# Noctura Extension B1c · Plan 3 — red flags (B1 §3's table on #48: warnings named, blocks with a one-transaction override of a typed word + re-authentication, Token-2022 mint warnings, dependent batches under the override, the 1.5 s hold) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 1 (2026-10-17):** first issue, dry-run in full — every task implemented for real on a scratch clone of `main` b13bbd1 (one commit per task: c1d98b4, f1f4a13, 82ffdf7, 614e54b, afb3e09, 05a1f32, fd3ebd6, 3c478d1), each red on its predecessor and green on its own tree with `tsc`, the whole suite, the build and the gates; 188 named mutations, every one compiling and red; the whole Playwright suite in a normal launch and under `unshare -rn` at Tasks 7 and 8; the end state's `verify`, the root `tsc` + `jest` and web's `verify`. Replaying task-1 … task-8's diffs onto `git archive b13bbd1` gives a tree identical to the dry run's end commit for every prefix (Dry-run record). Spec: rev 3.6 is written by Task 1 (owner decisions O1–O4 of 2026-10-16, the controller's rulings, Q28–Q55). Next: the owner reads the rulings at the end (the copy marked), then a Fable 5.1 review (owner rule: every plan goes to a Fable review before execution).

**Goal:** Build B1c spec plan 3 ("B1c-3 — red flags", the spec's header table): B1 §3's deterministic red-flag table on #48 exactly — warnings named (unknown program; every non-transfer instruction; Token-2022 transfer hook, permanent delegate and freeze authority on a token the request touches; a durable nonce; the whole balance to a first-time address; a bounded approval), **blocks** (System Assign / Allocate of the wallet account; SetAuthority on an account the user owns; an approval of the whole balance or u64::MAX; a step of a batch that depends on an earlier one — O2) that only a **one-transaction override** opens: the token symbol from the wallet's own table or the word shown, typed exactly, **plus re-authentication through #10** (D11, O1); no setting disables a block; every confirming CTA on a red-flag screen held 1.5 s on C15's triggers, no default focus, Enter never confirms. Plus B1c-2's carried items (R10's owner resolution, `outgoingGrew`'s `omitted`, non-Checked amounts with decimals, the ATA create's token program, four visual items) and #47's gate-line overlap. After this plan B1c is complete (D10: B1c-1, -2 and -3 on `main`); a store build is a B1e decision.

**Architecture:** Spec §1's layers are unchanged. **[3] The background** computes every flag — the window renders, never decides (C13). `tokenState.ts` (Task 1) is the one parser of token accounts and mints (classic and Token-2022, TLV from byte 166) for the simulation and the flags. `redFlags.ts` (Task 2) is a pure function over the decoded instructions, the simulation's pre- and post-state, the mints read through the proxy and each transaction's outcome; the simulation (Task 3) reads every mint the flags name, stores the flags with the simulation (strictly read back), adds the re-authentication reason `override` whenever a block or a dependent step exists, resolves an SPL transfer's destination to its owner (R10) and attributes a later transaction's failure to an account an earlier one of the batch creates (F10). `dapp.decide` (Task 4) refuses an approval whose typed words are missing (`override-missing`) or wrong (`override-mismatch`) against the flags it stored, before the re-authentication gate, in both decide sections; the challenge's `about` carries the flags so #10 names what is overridden and a refresh that adds one re-issues it. **[4] The approval window** (Task 5) renders per transaction the danger banners, then the warn banners, one `.s9-typed-confirm` per (transaction, block kind), the design's red "Approve unlimited" or "Approve anyway" behind #37's greyed gate, the synthesized "delegated" rows, the dependent step's own section, and holds every confirming CTA 1.5 s on a flagged screen. No new permission, no new message type, CSP unchanged.

**Tech Stack:** TypeScript 5 strict, React 18, Vite 8, Vitest 5 + happy-dom + Testing Library, Playwright 1.63 (contained), `@solana/web3.js` 1.99 (the parser, already). No new dependency. `@solana/errors` 5.5.1 (already in `extension/node_modules`, transitively) is read only as the source of the node's error shapes (Task 3); nothing imports it.

**Spec:** `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (approved rev 3; Task 1 writes rev 3.6) — the header table's third row; §1.3 (`redFlags.ts`), §2.3 (`dapp.decide`'s refusals), §3.3 (all — rev 3.6 adds the red-flag table as built, the override rule, the holds, the typed field, the banners), §6, §9 (the rows rev 3.6 adds and changes), §10 (Q28–Q55). Parent: B1 spec §3 (`docs/superpowers/specs/2026-09-27-extension-b1-design.md`, the red-flag table and the override rule), binding where B1c does not refine it. Owner decisions: `.superpowers/sdd/b1c3-owner-decisions.md` (O1–O4, 2026-10-16). Design (binding): `/home/user/Downloads/index.html` — #48 ix:18261-18705, state 2 "unlimited-spend · typed-confirm" ix:18325-18396, CSS ix:3824-3868; #37's typed gate ix:14949-15147; `screen.md` §48. Template: `docs/superpowers/plans/2026-10-12-extension-b1c-plan2.md` (its conventions are this plan's).

## Global Constraints

Every task's requirements include these.

- Mutations only in a scratch copy outside the repo.
- Every task touching repo-root src/ runs the FULL root jest; core/ tests run under extension's and web's vitest. (Plan 3 touches neither core/ nor the root src/; the dry run ran web's `npm run verify` and the root `tsc` + `jest` on the end state anyway.)
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

## Review Focus

Six inputs a person will meet that the spec implies and no first draft exercised — each has its test in the owning task (named there).

1. **A drainer's unlimited approval through a program call, not an instruction the decoder lists** (a dApp program CPIs into the token program): the decoded list shows nothing, the simulation's chain state shows the delegation raised to the whole balance — F5 must block from the chain state alone, with Q43's body (no code span: no instruction says it). Tests: Task 2 (`redFlags.test.ts`, the F5 chain-state cases), Task 5 (`tx.test.tsx`, Q43).
2. **A fake token that calls itself USDC** (Token-2022 TokenMetadata, or a classic mint with USDC's decimals but another address): the typed word must be `UNLIMITED`, never "USDC", and the delegated row must not name it. Tests: Task 2 (the F5 word cases), Task 3 (`simulate.test.ts`, the word recomputed from the read mints), Task 7 (B1c-30).
3. **A swap that is a batch** (create the token account, swap into it, close it): step 2's simulation fails because step 1 has not run — the window must say which step it depends on, show its effects as unknown, and open only under `UNCHECKED` + re-authentication; an unrelated failure in step 2 stays Reject-only; a failure naming an account a LATER step creates is not dependent. Tests: Task 3 (the F10 cases), Task 4 (`overrides.test.ts`), Task 7 (B1c-33).
4. **A wrong-case or near-miss typed word** (`usdc`, `USDC `, a pasted `USDC` with a zero-width character): Approve stays disabled after the hold, and a window that sends it anyway is refused `override-mismatch`. Tests: Task 4 (`overrides.test.ts`), Task 5 (`tx.test.tsx`), Task 7 (B1c-30, the background asked directly from approve.html).
5. **A refresh that adds a block after the user re-authenticated** (the 30 s re-simulation shows a new SetAuthority): the proof must not carry over — the challenge is re-issued and #10 names the new block. Tests: Task 4 (`overrides.test.ts`, "a proof for a challenge issued before a refresh added a NEW block").
6. **PYUSD-like Token-2022 mints** (freeze authority, permanent delegate, a transfer hook whose program is the zero key) beside **USDC-like classic mints** (freeze authority): PYUSD warns for exactly freeze + permanent delegate (the zero-key hook is no hook); USDC warns for nothing (O3). Tests: Task 1 (`tokenState.test.ts`), Task 2, Task 7 (B1c-32).

---

## Scope — what plan 3 builds, the seams it uses, every departure, and where the trust boundary sits

### 1. Plan 3 builds

- The red-flag table (spec rev 3.6 §3.3, F1–F11; F11 — the origin mismatch — is B1c-1/B1c-2's, unchanged):

| # | condition (B1 §3) | severity | override word |
|---|---|---|---|
| F1 | a program not in the decoded set | warn, named by address | — |
| F2 | an instruction of a decoded program that is not a transfer (Compute Budget exempt — it is the fee row; an instruction a more specific flag names is not repeated) | warn, named | — |
| F3 | System Assign / Allocate (or a `…WithSeed` form) of the wallet account — decoded, or the wallet account's owner or data changed in the simulation | **block** | `ASSIGN` (Q28) |
| F4 | SetAuthority on an account the user owns — decoded, or an own account's owner / close authority, or an own mint's mint / freeze authority, moved in the simulation | **block** | `AUTHORITY` (Q29) |
| F5 | Approve / ApproveChecked of the whole balance or u64::MAX — decoded, or a delegation raised to it in the simulation | **block** | the wallet table's symbol; `UNLIMITED` (Q30) |
| F6 | a bounded approval | warn + re-auth | — |
| F7 | Token-2022 transfer hook, permanent delegate, freeze authority on a mint the request touches (O3: Token-2022 only) | warn, named per mint; Q36 when unreadable | — |
| F8 | a durable nonce (AdvanceNonceAccount first) | warn "This transaction does not expire." | — (sign-and-send stays refused, plan 2 R12) |
| F9 | the whole or nearly whole balance to a first-time address | warn + re-auth | — |
| F10 | a step of a batch whose failure names an account an earlier step creates (O2) | **block** | `UNCHECKED` (Q31) |

- The override (O1): per blocked transaction one typed field per block kind; the background checks the words; every block requires #10's proof.
- #48's red-flag states (Task 5) and #10's override rows (Task 4); E2E B1c-30 … B1c-34 (Task 7); the visual pass (Task 8).
- B1c-2's carried items: R10 resolved to the owner (Task 3); `outgoingGrew` compares `omitted` (Task 3); non-Checked amounts with their mint's decimals and the ATA create's token program (Task 6); #46's Q26 as a danger banner, B1b's pending-send strip on #11 inside the popup with its chevron, #10's unsigned headline, one Tensor colour (Task 6); #10 shows no headline for an override or an allowance (Task 8, F-4); #47's gate line no longer drawn over the account label (Task 8, F-5); B1b's Home #42 tests off the wall clock (Task 7).

### 2. The seams it uses

- B1c-2's decoder (`decode/decode.ts`), simulation (`simulate.ts`), reasons (`reauthPolicy.ts` and the three other lists), `txRefused` and the two decide sections (`signTx.ts`, `decide.ts`), the challenge store (`reauthChallenges.ts`) and the vault page's description (`unlock/challenge.ts`, `unlock/screens/reauth.ts`), the window's `Tx.tsx` / `ui.tsx` / `useArmed`, the harnesses (`txHarness.ts`, `windowHarness.tsx`, `pageHarness.ts`), the E2E fakes (`fakeCoordinator.ts`, `dappPage.ts`), the extractor (`scripts/extract-design-css.mjs`).
- No new message, no new storage key, no new permission; the challenge's `about` and the stored simulation gain fields, both strictly validated.

### 3. Departures and controller rulings (each loud; listed again for the owner at the end)

- **Declared omissions (spec §9, rev 3.6):** the design's "Recommended alternative · Approve only the swap amount ~250 USDC" card (a wallet cannot change a dApp's transaction; any amount would be invented); the design's annotation that #34 flags the session (#34 is out, D1); the design summary's "red destructive Reject + tertiary Approve" line (it contradicts the drawn mockup, which is built); classic SPL freeze authority (O3); a first send through a program call and the other transfer shapes first-send does not read (O4 — the 5 % and dollar rules still bound every simulated outflow; those shapes carry F1's / F2's warning).
- **The design draws one red-flag state (unlimited spend) and the origin mismatch;** every other block and warning uses the design's own `.s9-flag-banner` danger / warn structure and #37's typed gate, with controller copy Q28–Q55 (flagged).
- **Stricter than the brief, accepted:** F4 blocks the wallet signing as `currentAuthority` and a wallet-held mint / freeze authority moved in chain state; F5's unreadable source counts as balance 0 (block); the challenge re-issues on any added flag, word or step; the token parsers refuse bytes the token programs' own unpack refuses (a malformed own account reads as lost); a create-then-transfer batch also carries `first-send`; every unreadable window detail is Q26.
- **The 1.5 s hold replaces C15's 500 ms on a flagged screen** (same triggers), and the risk sheet's own hold is 1.5 s there; a lookalike with a block: the typed fields first, then the 2-second confirm; the block's eyebrow replaces "Suspicious origin".
- **Numbering:** transaction indices (`tx`, `at`) are 0-based; a step (`step`, an outcome's `on`) is 1-based; the window reads a step only through `dependsOnStep`.

### 4. The trust boundary

Unchanged from plan 2 §4: the page and the window are untrusted, the coordinator is the simulation's one source (a lying coordinator can hide chain-state flags — the decoded rows do not depend on it, and every decoded block still fires), the port's sender is the browser's. New: the mints are read through the same proxy (a lying coordinator can hide F7 or misreport decimals — the same trust as every B1c-2 balance line; F5's word then falls to `UNLIMITED`, never to a wrong symbol, because the word needs the table's mint AND its decimals).

## How to read the steps

- A **new file** is given in full. A **changed file** is a unified diff against the file as the previous task left it; save the block and apply it with `git apply --recount` from the repository root. Several files grow task by task (`redFlags.ts`, `simulate.ts`, `signTx.ts`, `Tx.tsx`, `strings.ts`, `app.css`, the spec, some test files), so their diffs apply in task order.
- One file is **generated**, never typed: `src/styles/design-ext.css` (by `scripts/extract-design-css.mjs`; Task 5 adds `.s9-typed-confirm` to its allowlist and re-pins the hash).
- Commands run from `extension/` unless they start with `cd`. "Whole suite" is `npx tsc --noEmit; echo $?` then `npx vitest run`. The expected totals are the dry run's: each task's own test files on its predecessor's tree (red), then on its own tree (green), with `tsc`, the whole suite, `node scripts/build.mjs` and `npm run gates` at every task. A reviewer-added test raises the totals; that is not a defect.
- Background tests drive the real handlers over `fakeExt` and fake ports (`pageHarness.ts`) and a steered chain (`txHarness.ts`); window tests render `approve.html`'s `Approve` against the real background (`windowHarness.tsx`); popup tests use B1b's `renderInWallet`. Each screen test asserts `unstyledClasses(…)` is empty.
- **Each task ends with its named mutations** — each one alone, in a fresh `git archive` copy, `tsc`'s own exit code first; every one must turn the named test red.
- Each task ends with **"Dry-run notes"**: the rulings its dry run made beyond this header and what the next task relies on. They are part of the plan.

## Tasks

### Task 1: Spec rev 3.6 (the red-flag table as built, O1–O4, §9 rows, Q28–Q36); the token-state parsers (one source of truth for the simulation and the red flags); System's four `…WithSeed` instructions decoded

**Spec:** B1c §3.3 (rev 3.6, written by this task), §9, §10; B1 §3 (the red-flag table, binding); owner decisions O1–O4 (`.superpowers/sdd/b1c3-owner-decisions.md`); brief "The red-flag table as built" (F3's R2, F7, F10's creators)

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (rev 3.6)
- Test (new): `extension/src/background/dapp/__tests__/tokenBytes.ts` (byte builders + the USDC-like and PYUSD-like fixtures; later tasks import it)
- Test (new): `extension/src/background/dapp/__tests__/tokenState.test.ts`
- Test: `extension/src/background/dapp/__tests__/simulate.test.ts` (one test added; B1c-2's tests unchanged)
- Test: `extension/src/background/dapp/decode/__tests__/decode.test.ts` (one describe added; B1c-2's tests unchanged)
- Create: `extension/src/background/dapp/tokenState.ts`
- Modify: `extension/src/background/dapp/simulate.ts` (`isTokenAccountLayout` gone; `ownTokenAccountOf`, `rawTokenOwner`, `mintDecimals` read through tokenState)
- Modify: `extension/src/background/dapp/decode/decode.ts` (System tags 3, 9, 10, 11)
- Modify: `extension/src/approve/Tx.tsx`, `extension/src/approve/strings.ts` (two comments that named `transferWithSeed` / `createAccountWithSeed` as undecoded examples — now false)

**Interfaces:**
- Consumes: B1c-2's `TOKEN_PROGRAM`, `TOKEN_2022_PROGRAM`, `SYSTEM_PROGRAM` (`decode/decode.ts`); `AccountData` (`core/solana/rpc.ts`); the decoder's `Reader`, `acc2`/`acc3`, `addr`/`lamports`/`num`/`text`/`hex`, `nameOnly`.
- Produces:
  - `dapp/tokenState.ts`:
    ```ts
    export type TokenProgramKey = 'token' | 'token-2022';
    export interface MintInfo {program: TokenProgramKey; decimals: number; mintAuthority: string | null; freezeAuthority: string | null; permanentDelegate: string | null; transferHookProgram: string | null}
    export interface TokenAccountInfo {program: TokenProgramKey; mint: string; owner: string; amount: bigint; delegate: string | null; delegatedAmount: bigint; closeAuthority: string | null; state: 'initialized' | 'frozen'; isNative: boolean}
    export function mintInfo(data: Uint8Array, owner: string): MintInfo | null       // owner = the account's owner PROGRAM
    export function tokenAccountInfo(data: Uint8Array, owner: string): TokenAccountInfo | null
    ```
    `null` = not a mint / token account of either program, or any malformed byte (fail closed). `permanentDelegate` / `transferHookProgram` are null for a classic mint, an absent extension, or 32 zero bytes. `TokenAccountInfo.owner` is the account's owner FIELD (the wallet), not its program.
  - `decode/decode.ts` — new fully decoded System instructions (field names are the runtime's own; the target account first):
    - `createAccountWithSeed` (tag 3): `from`, `newAccount`, `base`, `seed`, `lamports` (lamports), `space` (number), `owner` (address)
    - `allocateWithSeed` (tag 9): `account`, `base`, `seed`, `space`, `owner`
    - `assignWithSeed` (tag 10): `account`, `base`, `seed`, `owner`
    - `transferWithSeed` (tag 11): `from`, `fromBase`, `to`, `lamports`, `fromSeed`, `fromOwner`
    - a seed field is `{kind: 'text'}` when every byte is printable ASCII (0x20–0x7e), else `{kind: 'hex'}`; a seed over 32 bytes, not UTF-8, cut short, trailing bytes, or too few accounts (3: 2 · 9/10: 1 · 11: 3) → the whole instruction is an unknown program (B1c-2's fail-closed rule).
  - `__tests__/tokenBytes.ts` (test helper): `MINT_SIZE`, `ACCOUNT_SIZE`, `MULTISIG_SIZE`, `U64_MAX`, `keyOf(n)`, `interface Extension {type; value; length?}`, `permanentDelegateExt(key|null)`, `transferHookExt(authority|null, program|null)`, `otherExt(type, size, fill?)`, `mintBytes(MintSpec)`, `tokenAccountBytes(TokenAccountSpec)`, `withU32(bytes, offset, value)`, `withByte(bytes, offset, value)`, the issuer keys `ISSUER`, `FREEZER`, `PERMANENT_DELEGATE`, `HOOK_AUTHORITY`, `HOOK_PROGRAM`, and the fixtures `usdcLikeMint()` (classic, 6 decimals, mint + freeze authority) and `pyusdLikeMint()` (Token-2022, 6 decimals, mint + freeze authority, permanent delegate, a transfer hook with an authority and a ZERO program id, among ConfidentialTransferMint / TransferFeeConfig / MetadataPointer / TokenMetadata extensions).

The spec first: rev 3.6 writes the red-flag table as plan 3 builds it into §3.3, so every later task cites one text. Then one parser for token state: B1c-2's simulation had its own layout checks (`isTokenAccountLayout`, `ownTokenAccountOf`, `rawTokenOwner`, `mintDecimals`); F4, F5 and F7 need the same reads plus a mint's authorities and Token-2022 extensions, so both now read through `tokenState.ts` and nothing else parses token bytes. The parsers are stricter than B1c-2's checks only where the token programs' own unpack refuses the bytes (a COption tag other than 0/1, a malformed TLV, non-zero padding before a mint's AccountType byte) — data a token program never writes; every B1c-2 simulate test stays green unchanged, and a new simulate test pins that the simulation now reads through the parsers. Last, System's four `…WithSeed` instructions are fully decoded: F3 compares `allocateWithSeed` / `assignWithSeed`'s target with the wallet account (Task 2), F10 counts `createAccountWithSeed`'s new account among the accounts a batch creates (Task 3).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/dapp/__tests__/tokenBytes.ts`:

````ts
import {base58} from '@scure/base';

/**
 * Byte builders for SPL Token / Token-2022 mints and token accounts (B1c-3): every fixture a red-flag or token-state
 * test reads is built here from named fields, never typed as a hex blob. Offsets are the programs' own (the base Mint
 * is 82 bytes, the base Account 165; Token-2022's extended layout puts the AccountType byte at 165 and its TLV
 * extensions from 166).
 */
export const MINT_SIZE = 82;
export const ACCOUNT_SIZE = 165;
export const MULTISIG_SIZE = 355;
export const U64_MAX = 0xffff_ffff_ffff_ffffn;

/** A deterministic address: 32 bytes of `n` (never the zero key unless `n` is 0). */
export const keyOf = (n: number): string => base58.encode(new Uint8Array(32).fill(n));
const keyBytes = (k: string | null): Uint8Array => (k === null ? new Uint8Array(32) : base58.decode(k));

/** One TLV entry. `length` overrides the length written (an overrun when it exceeds `value`). */
export interface Extension {
  type: number;
  value: Uint8Array;
  length?: number;
}
/** PermanentDelegate (12): its delegate, an OptionalNonZeroPubkey — null writes 32 zero bytes. */
export const permanentDelegateExt = (delegate: string | null): Extension => ({type: 12, value: keyBytes(delegate)});
/** TransferHook (14): its authority and its program id, both OptionalNonZeroPubkey. */
export const transferHookExt = (authority: string | null, programId: string | null): Extension => ({type: 14, value: Uint8Array.of(...keyBytes(authority), ...keyBytes(programId))});
/** Any other extension, of `size` bytes of `fill` — the parser must step over it. */
export const otherExt = (type: number, size: number, fill = 0xab): Extension => ({type, value: new Uint8Array(size).fill(fill)});

const tlv = (extensions: readonly Extension[]): number[] =>
  extensions.flatMap(e => {
    const length = e.length ?? e.value.length;
    return [e.type & 0xff, e.type >> 8, length & 0xff, length >> 8, ...e.value];
  });

/** Base bytes + Token-2022's extended tail: zero padding to 165, the AccountType byte, the TLV, then `tail`. */
function extended(base: Uint8Array, accountType: number, extensions: readonly Extension[], tail: readonly number[]): Uint8Array {
  const out = new Uint8Array(ACCOUNT_SIZE + 1 + tlv(extensions).length + tail.length);
  out.set(base, 0);
  out[ACCOUNT_SIZE] = accountType;
  out.set([...tlv(extensions), ...tail], ACCOUNT_SIZE + 1);
  return out;
}

export interface MintSpec {
  decimals?: number;
  supply?: bigint;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  /** Token-2022's extended layout (AccountType at 165, TLV from 166) — implied by `extensions` or `tail`. */
  extended?: boolean;
  extensions?: readonly Extension[];
  /** The AccountType byte written at 165 (1 = Mint, the default). */
  accountType?: number;
  /** Raw bytes after the TLV (a cut header, padding). */
  tail?: readonly number[];
}

/** A mint's account data: the 82-byte base Mint, or Token-2022's extended layout. */
export function mintBytes(s: MintSpec = {}): Uint8Array {
  const base = new Uint8Array(MINT_SIZE);
  const view = new DataView(base.buffer);
  const mintAuthority = s.mintAuthority ?? null;
  const freezeAuthority = s.freezeAuthority ?? null;
  view.setUint32(0, mintAuthority === null ? 0 : 1, true);
  base.set(keyBytes(mintAuthority), 4);
  view.setBigUint64(36, s.supply ?? 1_000_000_000n, true);
  base[44] = s.decimals ?? 6;
  base[45] = 1;
  view.setUint32(46, freezeAuthority === null ? 0 : 1, true);
  base.set(keyBytes(freezeAuthority), 50);
  if (!(s.extended ?? false) && s.extensions === undefined && s.tail === undefined) return base;
  return extended(base, s.accountType ?? 1, s.extensions ?? [], s.tail ?? []);
}

export interface TokenAccountSpec {
  mint: string;
  owner: string;
  amount?: bigint;
  delegate?: string | null;
  delegatedAmount?: bigint;
  /** The state byte at 108: 1 Initialized (the default), 2 Frozen. */
  state?: number;
  /** is_native: the rent-exempt reserve of a native (wrapped SOL) account, or null. */
  nativeReserve?: bigint | null;
  closeAuthority?: string | null;
  extended?: boolean;
  extensions?: readonly Extension[];
  /** The AccountType byte written at 165 (2 = Account, the default). */
  accountType?: number;
  tail?: readonly number[];
}

/** A token account's data: the 165-byte base Account, or Token-2022's extended layout. */
export function tokenAccountBytes(s: TokenAccountSpec): Uint8Array {
  const base = new Uint8Array(ACCOUNT_SIZE);
  const view = new DataView(base.buffer);
  const delegate = s.delegate ?? null;
  const closeAuthority = s.closeAuthority ?? null;
  const nativeReserve = s.nativeReserve ?? null;
  base.set(base58.decode(s.mint), 0);
  base.set(base58.decode(s.owner), 32);
  view.setBigUint64(64, s.amount ?? 0n, true);
  view.setUint32(72, delegate === null ? 0 : 1, true);
  base.set(keyBytes(delegate), 76);
  base[108] = s.state ?? 1;
  view.setUint32(109, nativeReserve === null ? 0 : 1, true);
  view.setBigUint64(113, nativeReserve ?? 0n, true);
  view.setBigUint64(121, s.delegatedAmount ?? 0n, true);
  view.setUint32(129, closeAuthority === null ? 0 : 1, true);
  base.set(keyBytes(closeAuthority), 133);
  if (!(s.extended ?? false) && s.extensions === undefined && s.tail === undefined) return base;
  return extended(base, s.accountType ?? 2, s.extensions ?? [], s.tail ?? []);
}

/** `bytes` with the u32 LE at `offset` set to `value` (a COption tag forged). */
export function withU32(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const out = Uint8Array.from(bytes);
  new DataView(out.buffer).setUint32(offset, value, true);
  return out;
}
/** `bytes` with the byte at `offset` set to `value`. */
export function withByte(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const out = Uint8Array.from(bytes);
  out[offset] = value;
  return out;
}

/** Issuer keys for the fixtures below. */
export const ISSUER = keyOf(11);
export const FREEZER = keyOf(12);
export const PERMANENT_DELEGATE = keyOf(13);
export const HOOK_AUTHORITY = keyOf(14);
export const HOOK_PROGRAM = keyOf(15);

/** USDC-like: a classic SPL mint, 6 decimals, a mint authority and a freeze authority (O3: never flagged). */
export const usdcLikeMint = (): Uint8Array => mintBytes({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER});

/**
 * PYUSD-like: a Token-2022 mint, 6 decimals, a mint and a freeze authority, a permanent delegate, and a transfer hook
 * initialised with an authority but NO program (32 zero bytes) — among the other extensions such a mint carries
 * (ConfidentialTransferMint 4: 65 bytes, TransferFeeConfig 1: 108 bytes, MetadataPointer 18: 64 bytes, TokenMetadata 19:
 * variable), which the parser steps over.
 */
export const pyusdLikeMint = (): Uint8Array =>
  mintBytes({
    decimals: 6,
    mintAuthority: ISSUER,
    freezeAuthority: FREEZER,
    extensions: [otherExt(4, 65), otherExt(1, 108), permanentDelegateExt(PERMANENT_DELEGATE), transferHookExt(HOOK_AUTHORITY, null), otherExt(18, 64), otherExt(19, 141, 0x41)],
  });
````

Create `extension/src/background/dapp/__tests__/tokenState.test.ts`:

````ts
import {SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
import {mintInfo, tokenAccountInfo} from '../tokenState';
import {
  ACCOUNT_SIZE,
  FREEZER,
  HOOK_AUTHORITY,
  HOOK_PROGRAM,
  ISSUER,
  MINT_SIZE,
  MULTISIG_SIZE,
  PERMANENT_DELEGATE,
  U64_MAX,
  keyOf,
  mintBytes,
  otherExt,
  permanentDelegateExt,
  pyusdLikeMint,
  tokenAccountBytes,
  transferHookExt,
  usdcLikeMint,
  withByte,
  withU32,
} from './tokenBytes';

const MINT = keyOf(21);
const OWNER = keyOf(22);
const DELEGATE = keyOf(23);
const CLOSER = keyOf(24);

// B1c-3 (spec B1c §3.3 rev 3.6, F4/F5/F7): one parser for a mint and one for a token account, for both token programs.
describe('mintInfo', () => {
  it('USDC-like: a classic mint — its decimals, mint and freeze authority; no extension can exist', () => {
    expect(mintInfo(usdcLikeMint(), TOKEN_PROGRAM)).toEqual({program: 'token', decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER, permanentDelegate: null, transferHookProgram: null});
  });

  it('PYUSD-like: Token-2022 — freeze authority, permanent delegate; a hook with a zero program id is no hook; other extensions stepped over', () => {
    expect(mintInfo(pyusdLikeMint(), TOKEN_2022_PROGRAM)).toEqual({program: 'token-2022', decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER, permanentDelegate: PERMANENT_DELEGATE, transferHookProgram: null});
  });

  it('a transfer hook with a program id names it; a permanent delegate of 32 zero bytes is none', () => {
    const hooked = mintBytes({decimals: 9, extensions: [transferHookExt(HOOK_AUTHORITY, HOOK_PROGRAM), permanentDelegateExt(null)]});
    expect(mintInfo(hooked, TOKEN_2022_PROGRAM)).toEqual({program: 'token-2022', decimals: 9, mintAuthority: null, freezeAuthority: null, permanentDelegate: null, transferHookProgram: HOOK_PROGRAM});
  });

  it('Token-2022 without extensions: the 82-byte base, and the extended layout with an empty TLV', () => {
    const plain = {program: 'token-2022', decimals: 2, mintAuthority: ISSUER, freezeAuthority: null, permanentDelegate: null, transferHookProgram: null};
    expect(mintInfo(mintBytes({decimals: 2, mintAuthority: ISSUER}), TOKEN_2022_PROGRAM)).toEqual(plain);
    const empty = mintBytes({decimals: 2, mintAuthority: ISSUER, extended: true});
    expect(empty.length).toBe(ACCOUNT_SIZE + 1);
    expect(mintInfo(empty, TOKEN_2022_PROGRAM)).toEqual(plain);
  });

  it('no mint: an owner that is no token program, a classic mint of any other size, an extended layout under classic Token', () => {
    expect(mintInfo(usdcLikeMint(), SYSTEM_PROGRAM)).toBeNull();
    expect(mintInfo(Uint8Array.of(...usdcLikeMint(), 0), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(usdcLikeMint().subarray(0, MINT_SIZE - 1), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(pyusdLikeMint(), TOKEN_PROGRAM)).toBeNull();
    // Positive control: the same bytes under their own program.
    expect(mintInfo(pyusdLikeMint(), TOKEN_2022_PROGRAM)).not.toBeNull();
  });

  it('a COption tag other than 0 or 1 is no mint (fail closed); 1 is a key and 0 none, whatever its 32 bytes', () => {
    const base = mintBytes({mintAuthority: ISSUER, freezeAuthority: FREEZER});
    expect(mintInfo(withU32(base, 0, 2), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(withU32(base, 46, 2), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(withU32(base, 46, 0x0100), TOKEN_PROGRAM)).toBeNull();
    expect(mintInfo(withU32(base, 46, 0), TOKEN_PROGRAM)).toMatchObject({mintAuthority: ISSUER, freezeAuthority: null});
    expect(mintInfo(withU32(base, 0, 0), TOKEN_PROGRAM)).toMatchObject({mintAuthority: null, freezeAuthority: FREEZER});
  });

  it('the extended layout: the AccountType byte must be Mint (1) — an Account’s (2) or Uninitialized (0) is no mint', () => {
    const ext = [permanentDelegateExt(PERMANENT_DELEGATE)];
    expect(mintInfo(mintBytes({extensions: ext}), TOKEN_2022_PROGRAM)).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
    expect(mintInfo(mintBytes({extensions: ext, accountType: 2}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: ext, accountType: 0}), TOKEN_2022_PROGRAM)).toBeNull();
  });

  it('the extended layout: the padding between the base mint and the AccountType byte must be zero', () => {
    const good = mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)]});
    expect(mintInfo(withByte(good, MINT_SIZE, 1), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(withByte(good, ACCOUNT_SIZE - 1, 1), TOKEN_2022_PROGRAM)).toBeNull();
  });

  it('a TLV that overruns the data is no mint: a value past the end, a header cut short', () => {
    expect(mintInfo(mintBytes({extensions: [{...permanentDelegateExt(PERMANENT_DELEGATE), length: 33}]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)], tail: [14, 0]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)], tail: [14, 0, 64]}), TOKEN_2022_PROGRAM)).toBeNull();
    // Positive control: the same entries with nothing cut.
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), transferHookExt(null, HOOK_PROGRAM)]}), TOKEN_2022_PROGRAM)).toMatchObject({
      permanentDelegate: PERMANENT_DELEGATE,
      transferHookProgram: HOOK_PROGRAM,
    });
  });

  it('a read extension of the wrong size, or an extension twice, is no mint', () => {
    expect(mintInfo(mintBytes({extensions: [{type: 12, value: new Uint8Array(31).fill(9)}]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [{type: 14, value: new Uint8Array(65).fill(9)}]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), permanentDelegateExt(null)]}), TOKEN_2022_PROGRAM)).toBeNull();
    // An extension the parser does not read may have any size.
    expect(mintInfo(mintBytes({extensions: [otherExt(3, 31)]}), TOKEN_2022_PROGRAM)).not.toBeNull();
  });

  it('an Uninitialized (0) TLV header ends the extensions; anything but zeros after it is no mint', () => {
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE)], tail: [0, 0, 0, 0, 0, 0]}), TOKEN_2022_PROGRAM)).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
    expect(mintInfo(mintBytes({extensions: [{type: 0, value: new Uint8Array(0)}, permanentDelegateExt(PERMANENT_DELEGATE)]}), TOKEN_2022_PROGRAM)).toBeNull();
  });

  it('a 355-byte account (a Multisig’s size) is never an extended mint, even with byte 165 = 1 and a well-formed TLV', () => {
    const filler = MULTISIG_SIZE - (ACCOUNT_SIZE + 1) - 4 - 32 - 4;
    const forged = mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), otherExt(3, filler)]});
    expect(forged.length).toBe(MULTISIG_SIZE);
    expect(mintInfo(forged, TOKEN_2022_PROGRAM)).toBeNull();
    // Positive control: one byte longer reads.
    expect(mintInfo(mintBytes({extensions: [permanentDelegateExt(PERMANENT_DELEGATE), otherExt(3, filler + 1)]}), TOKEN_2022_PROGRAM)).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
  });
});

describe('tokenAccountInfo', () => {
  it('a classic account: mint, owner, amount, delegate and its amount, close authority, state, native', () => {
    const data = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 500n, delegate: DELEGATE, delegatedAmount: U64_MAX, closeAuthority: CLOSER});
    expect(tokenAccountInfo(data, TOKEN_PROGRAM)).toEqual({
      program: 'token',
      mint: MINT,
      owner: OWNER,
      amount: 500n,
      delegate: DELEGATE,
      delegatedAmount: U64_MAX,
      closeAuthority: CLOSER,
      state: 'initialized',
      isNative: false,
    });
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, state: 2, nativeReserve: 2_039_280n}), TOKEN_PROGRAM)).toMatchObject({state: 'frozen', isNative: true, delegate: null, closeAuthority: null});
  });

  it('Token-2022: the 165-byte base, and the extended layout (AccountType 2) with its TLV', () => {
    const plain = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 7n});
    expect(tokenAccountInfo(plain, TOKEN_2022_PROGRAM)).toMatchObject({program: 'token-2022', mint: MINT, owner: OWNER, amount: 7n});
    const ext = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 7n, extensions: [otherExt(7, 0), otherExt(15, 1, 0)]});
    expect(tokenAccountInfo(ext, TOKEN_2022_PROGRAM)).toMatchObject({program: 'token-2022', amount: 7n});
  });

  it('no account: Uninitialized or an unknown state, another program, a classic account of another size', () => {
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, state: 0}), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, state: 3}), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER}), SYSTEM_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extended: true}), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER}).subarray(0, ACCOUNT_SIZE - 1), TOKEN_PROGRAM)).toBeNull();
  });

  it('a COption tag other than 0 or 1 (delegate, is_native, close authority) is no account', () => {
    const base = tokenAccountBytes({mint: MINT, owner: OWNER, delegate: DELEGATE, closeAuthority: CLOSER});
    expect(tokenAccountInfo(base, TOKEN_PROGRAM)).not.toBeNull();
    expect(tokenAccountInfo(withU32(base, 72, 2), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(withU32(base, 109, 2), TOKEN_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(withU32(base, 129, 2), TOKEN_PROGRAM)).toBeNull();
  });

  it('the extended layout: the AccountType byte must be Account (2); a TLV overrun is no account', () => {
    const ext = [otherExt(7, 0)];
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extensions: ext, accountType: 1}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extensions: [{type: 15, value: Uint8Array.of(0), length: 2}]}), TOKEN_2022_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, extensions: ext, tail: [7]}), TOKEN_2022_PROGRAM)).toBeNull();
  });

  it('a 355-byte account (a Multisig’s size) is never a token account, even with byte 165 = 2', () => {
    const forged = tokenAccountBytes({mint: MINT, owner: OWNER, amount: 1n, extensions: [otherExt(3, MULTISIG_SIZE - (ACCOUNT_SIZE + 1) - 4)]});
    expect(forged.length).toBe(MULTISIG_SIZE);
    expect(tokenAccountInfo(forged, TOKEN_2022_PROGRAM)).toBeNull();
    expect(tokenAccountInfo(tokenAccountBytes({mint: MINT, owner: OWNER, amount: 1n, extensions: [otherExt(3, MULTISIG_SIZE - (ACCOUNT_SIZE + 1) - 3)]}), TOKEN_2022_PROGRAM)).toMatchObject({amount: 1n});
  });
});
````

Change `extension/src/background/dapp/__tests__/simulate.test.ts` and `extension/src/background/dapp/decode/__tests__/decode.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/simulate.test.ts b/extension/src/background/dapp/__tests__/simulate.test.ts
index ae5b29d..46c0c84 100644
--- a/extension/src/background/dapp/__tests__/simulate.test.ts
+++ b/extension/src/background/dapp/__tests__/simulate.test.ts
@@ -8,6 +8,7 @@ import {ADDRESS_LOOKUP_TABLE_PROGRAM} from '../decode/keys';
 import {TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
 import {parseWire} from '../decode/wire';
 import {simulateTransactions, WRAPPED_SOL_MINT, type TxSimulation} from '../simulate';
+import {ACCOUNT_SIZE, mintBytes, otherExt, tokenAccountBytes, withByte} from './tokenBytes';
 
 const ME = new PublicKey(PUB);
 const TO = new PublicKey(RECIPIENT);
@@ -386,6 +387,32 @@ describe('simulateTransactions', () => {
     expect(line).toMatchObject({mint: ODD_MINT, amount: '-100000', decimals: null, usdMicros: null});
   });
 
+  // B1c-3 (spec B1c §3.3 rev 3.6): token accounts and mints are read through tokenState's parsers — one source of truth.
+  it('one parser: an extended Token-2022 account and mint are read; a TLV that overruns, or a mint’s padding not zero, is not', async () => {
+    const t22 = (amount: bigint, tail: readonly number[] = []): SimulatedAccount => ({
+      lamports: 2_039_280n,
+      owner: TOKEN_2022_PROGRAM,
+      data: tokenAccountBytes({mint: ODD_MINT, owner: ME.toBase58(), amount, extensions: [otherExt(7, 0)], tail}),
+    });
+    const mint = mintBytes({decimals: 4, extended: true});
+    const lineFor = async (post: SimulatedAccount, mintData: Uint8Array) => {
+      const s = scene({
+        accounts: new Map<string, AccountData | null>([
+          [SRC, t22(1_000_000n)],
+          [ODD_MINT, {lamports: 1n, owner: TOKEN_2022_PROGRAM, data: mintData}],
+        ]),
+        post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? post : null),
+      });
+      const out = (await run(s, [wire([unknownIx([SRC])])])).outcomes[0];
+      return out?.ok === true ? out.changes.find(c => c.mint === ODD_MINT) : undefined;
+    };
+    expect(await lineFor(t22(900_000n), mint)).toMatchObject({amount: '-100000', decimals: 4});
+    // The post-state's TLV cut short: not a token account of the wallet's any more — the whole pre amount shows as lost.
+    expect(await lineFor(t22(900_000n, [7]), mint)).toMatchObject({amount: '-1000000', decimals: 4});
+    // The mint's padding before its AccountType byte not zero: no mint — its decimals unknown (base units).
+    expect(await lineFor(t22(900_000n), withByte(mint, ACCOUNT_SIZE - 1, 1))).toMatchObject({amount: '-100000', decimals: null});
+  });
+
   it('an own account reassigned to someone else (a CPI SetAuthority AccountOwner) re-authenticates too, on top of the −all loss already shown', async () => {
     const s = scene({
       // A large enough holdings balance that losing SRC's 100 is under the unrelated 5 % rule — isolates this test to
diff --git a/extension/src/background/dapp/decode/__tests__/decode.test.ts b/extension/src/background/dapp/decode/__tests__/decode.test.ts
index 8d96ad6..5986b44 100644
--- a/extension/src/background/dapp/decode/__tests__/decode.test.ts
+++ b/extension/src/background/dapp/decode/__tests__/decode.test.ts
@@ -124,6 +124,99 @@ describe('decodeInstructions — System', () => {
   });
 });
 
+// B1c-3 (spec B1c §3.3 rev 3.6): System's four …WithSeed instructions, with their target account — F3 compares
+// allocateWithSeed / assignWithSeed's account with the wallet's, F10 counts createAccountWithSeed's new account.
+describe('decodeInstructions — System …WithSeed', () => {
+  const BASE = new PublicKey(new Uint8Array(32).fill(5));
+  const ascii = (t: string): number[] => Array.from(t, c => c.charCodeAt(0));
+  const seedOf = (bytes: number[], length = bytes.length): number[] => [...u64(BigInt(length)), ...bytes];
+  const sys = (tag: number, data: number[], keys: PublicKey[]) =>
+    new TransactionInstruction({programId: SystemProgram.programId, data: Buffer.from([tag, 0, 0, 0, ...data]), keys: keys.map((pubkey, i) => ({pubkey, isSigner: i === 1, isWritable: i !== 1}))});
+  const addressOf = (k: PublicKey | string) => ({kind: 'address', value: typeof k === 'string' ? k : k.toBase58()});
+
+  it('createAccountWithSeed, allocateWithSeed, assignWithSeed, transferWithSeed: every field, the target account included', () => {
+    expect(one(SystemProgram.createAccountWithSeed({fromPubkey: ME, newAccountPubkey: DST, basePubkey: BASE, seed: 'stake:0', lamports: 2_282_880, space: 200, programId: new PublicKey(TOKEN_PROGRAM)}))).toEqual({
+      programId: SYSTEM_PROGRAM,
+      program: 'system',
+      name: 'createAccountWithSeed',
+      fields: [
+        {name: 'from', value: addressOf(ME)},
+        {name: 'newAccount', value: addressOf(DST)},
+        {name: 'base', value: addressOf(BASE)},
+        {name: 'seed', value: {kind: 'text', value: 'stake:0'}},
+        {name: 'lamports', value: {kind: 'lamports', value: '2282880'}},
+        {name: 'space', value: {kind: 'number', value: '200'}},
+        {name: 'owner', value: addressOf(TOKEN_PROGRAM)},
+      ],
+    });
+    expect(one(SystemProgram.allocate({accountPubkey: ME, basePubkey: BASE, seed: 'x', space: 64, programId: UNKNOWN}))).toMatchObject({
+      program: 'system',
+      name: 'allocateWithSeed',
+      fields: [
+        {name: 'account', value: addressOf(ME)},
+        {name: 'base', value: addressOf(BASE)},
+        {name: 'seed', value: {kind: 'text', value: 'x'}},
+        {name: 'space', value: {kind: 'number', value: '64'}},
+        {name: 'owner', value: addressOf(UNKNOWN)},
+      ],
+    });
+    expect(one(SystemProgram.assign({accountPubkey: ME, basePubkey: BASE, seed: 'vault', programId: UNKNOWN}))).toMatchObject({
+      program: 'system',
+      name: 'assignWithSeed',
+      fields: [
+        {name: 'account', value: addressOf(ME)},
+        {name: 'base', value: addressOf(BASE)},
+        {name: 'seed', value: {kind: 'text', value: 'vault'}},
+        {name: 'owner', value: addressOf(UNKNOWN)},
+      ],
+    });
+    expect(one(SystemProgram.transfer({fromPubkey: SRC, basePubkey: ME, toPubkey: TO, lamports: 42, seed: 'pay', programId: SystemProgram.programId}))).toMatchObject({
+      program: 'system',
+      name: 'transferWithSeed',
+      fields: [
+        {name: 'from', value: addressOf(SRC)},
+        {name: 'fromBase', value: addressOf(ME)},
+        {name: 'to', value: addressOf(TO)},
+        {name: 'lamports', value: {kind: 'lamports', value: '42'}},
+        {name: 'fromSeed', value: {kind: 'text', value: 'pay'}},
+        {name: 'fromOwner', value: addressOf(SYSTEM_PROGRAM)},
+      ],
+    });
+  });
+
+  it('the seed: at most 32 bytes; printable ASCII is text, other UTF-8 hex; not UTF-8, cut short or a huge length is an unknown program', () => {
+    const assignWith = (seed: number[], length?: number) => one(sys(10, [...BASE.toBytes(), ...seedOf(seed, length), ...UNKNOWN.toBytes()], [ME, BASE]));
+    expect(assignWith(ascii('a'.repeat(32))).fields[2]).toEqual({name: 'seed', value: {kind: 'text', value: 'a'.repeat(32)}});
+    expect(assignWith(ascii('a'.repeat(33)))).toEqual({programId: SYSTEM_PROGRAM, program: null, name: null, fields: []});
+    const accented = Array.from(new TextEncoder().encode('caf\u00e9'));
+    expect(assignWith(accented).fields[2]).toEqual({name: 'seed', value: {kind: 'hex', value: '636166c3a9'}});
+    expect(assignWith(ascii('a\u0007b')).fields[2]).toEqual({name: 'seed', value: {kind: 'hex', value: '610762'}});
+    expect(assignWith([0x61, 0xff])).toMatchObject({program: null, name: null});
+    expect(assignWith(ascii('abc'), 5)).toMatchObject({program: null, name: null});
+    expect(assignWith(ascii('abc'), 2 ** 53)).toMatchObject({program: null, name: null});
+    expect(assignWith(ascii(''))).toMatchObject({program: 'system', name: 'assignWithSeed', fields: [{name: 'account'}, {name: 'base'}, {name: 'seed', value: {kind: 'text', value: ''}}, {name: 'owner'}]});
+  });
+
+  it('strict: a trailing byte, or fewer accounts than the instruction needs, is an unknown program', () => {
+    const unknown = {programId: SYSTEM_PROGRAM, program: null, name: null, fields: []};
+    const created = [...BASE.toBytes(), ...seedOf(ascii('s')), ...u64(1n), ...u64(0n), ...UNKNOWN.toBytes()];
+    expect(one(sys(3, created, [ME, DST]))).toMatchObject({name: 'createAccountWithSeed'});
+    expect(one(sys(3, [...created, 0], [ME, DST]))).toEqual(unknown);
+    expect(one(sys(3, created, [ME]))).toEqual(unknown);
+    const allocated = [...BASE.toBytes(), ...seedOf(ascii('s')), ...u64(10n), ...UNKNOWN.toBytes()];
+    expect(one(sys(9, allocated, [ME]))).toMatchObject({name: 'allocateWithSeed'});
+    expect(one(sys(9, [...allocated, 0], [ME, BASE]))).toEqual(unknown);
+    expect(one(sys(9, allocated, []))).toEqual(unknown);
+    const assigned = [...BASE.toBytes(), ...seedOf(ascii('s')), ...UNKNOWN.toBytes()];
+    expect(one(sys(10, [...assigned, 0], [ME, BASE]))).toEqual(unknown);
+    expect(one(sys(10, assigned, []))).toEqual(unknown);
+    const moved = [...u64(5n), ...seedOf(ascii('s')), ...SystemProgram.programId.toBytes()];
+    expect(one(sys(11, moved, [SRC, ME, TO]))).toMatchObject({name: 'transferWithSeed'});
+    expect(one(sys(11, [...moved, 0], [SRC, ME, TO]))).toEqual(unknown);
+    expect(one(sys(11, moved, [SRC, ME]))).toEqual(unknown);
+  });
+});
+
 describe('decodeInstructions — SPL Token and Token-2022', () => {
   for (const program of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
     const key = program === TOKEN_PROGRAM ? 'token' : 'token-2022';
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/background/dapp/__tests__/tokenState.test.ts src/background/dapp/__tests__/simulate.test.ts src/background/dapp/decode/__tests__/decode.test.ts`

Expected (the dry run): Test Files  3 failed (3) · Tests  4 failed | 54 passed (58) — `tokenState.test.ts` does not load (`Cannot find module '../tokenState'`); simulate "one parser: …" (the overrun post-state still read as the wallet's: `-100000` instead of `-1000000`); decode's three `…WithSeed` tests (name-only, no fields).

- [ ] **Step 3: Implement.**

Change the spec (rev 3.6 — the status paragraph, §3.3's decoder line and its new "Red flags as B1c-3 builds them", §8's row, §9's two updated and five new rows, §10's Q28–Q36):

````diff
diff --git a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
index 6a03a6e..7c03645 100644
--- a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
+++ b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
@@ -1,6 +1,6 @@
 # Noctura Extension B1c — the dApp provider (connect, sign, approve)
 
-**Status:** **approved rev 3**, 2026-10-10 (current text: **rev 3.5**, 2026-10-16) — the owner approved this spec, the strings of §10 (Q01–Q24) and the known list of §2.5. The owner approved the design in conversation (sections 1–3) and took
+**Status:** **approved rev 3**, 2026-10-10 (current text: **rev 3.6**, 2026-10-16) — the owner approved this spec, the strings of §10 (Q01–Q24) and the known list of §2.5. The owner approved the design in conversation (sections 1–3) and took
 decisions D1–D11. Rev 2 applied every finding of Fable 5.1 review 1 (`.superpowers/sdd/b1c-spec-review-1.md`: H1–H3,
 M1–M12, L1–L13); M1 and M2 were the owner's decisions D10 and D11. **Rev 3** applies every finding of Fable review 2
 (`.superpowers/sdd/b1c-spec-review-2.md`: H1–H2, M1–M10, L1–L13; verdict "approve after fixes"). Where each finding
@@ -29,6 +29,17 @@ leaving the worker (Task 5 ruling: "never sent twice" kept over at-least-once; n
 gain ✕ on a window while a riding mismatch notice is shown (Task 3 ruling, round 4); §10 gains Q27, the line for an
 approval refused because its simulation is merely old (final review I3 — controller copy, flagged to the owner). No
 other rule changed.
+**Rev 3.6 (owner decisions O1–O4 of 2026-10-16 and the controller's rulings for plan 3 —
+`.superpowers/sdd/b1c3-owner-decisions.md`, `.superpowers/sdd/b1c3-plan-brief.md`):** §3.3 gains B1 §3's red-flag
+table as plan 3 builds it (F1–F11: how each is detected, its severity, its override word), the override rule (one typed
+field per blocked transaction and kind, plus re-authentication through #10; the background recomputes every word), the
+1.5 s hold, the typed field and the banners; the decoder gains System's four `…WithSeed` instructions. **O1:** an
+unlimited approve needs the typed symbol **and** re-authentication through #10 (not typed-only). **O2:** a later
+transaction of a batch whose simulation fails on an account an earlier transaction of the same batch creates is
+approvable under the override rule; every other failed simulation stays Reject-only. **O3:** the Token-2022 warnings
+are for Token-2022 mints only; a classic SPL mint's freeze authority is not flagged. **O4:** a first send to a new
+address through a CPI is an accepted limit. §9 gains five rows (the declared omissions, O3, O4) and updates two (R10,
+dependent batches); §10 gains Q28–Q36 (controller copy, flagged to the owner). No other rule changed.
 
 **What this is.** The extension becomes a wallet any Solana site can use through Wallet Standard: connect, disconnect,
 events, `signMessage`, `signTransaction`, `signAndSendTransaction`, on `solana:mainnet` only. It builds the design's
@@ -570,7 +581,8 @@ cannot mask an earlier one (review M5):
   payer or signer; otherwise `invalid-request`.
 - Lookup tables resolved with `getMultipleAccounts` through the proxy before decoding; unresolvable → that instruction is
   "unknown program".
-- **Decoder:** System (transfer, createAccount, assign, allocate, advanceNonceAccount), SPL Token and Token-2022
+- **Decoder:** System (transfer, createAccount, assign, allocate, advanceNonceAccount; rev 3.6: createAccountWithSeed,
+  allocateWithSeed, assignWithSeed, transferWithSeed, each with its target account), SPL Token and Token-2022
   (transfer, transferChecked, approve, approveChecked, revoke, setAuthority, closeAccount, burn, burnChecked,
   initializeAccount*, syncNative) and the Token-2022 extensions B1 §3 names, ATA (create, createIdempotent), Compute
   Budget (limit, price), the presale program (by Anchor discriminator from the IDL in the repo).
@@ -592,6 +604,61 @@ cannot mask an earlier one (review M5):
 - **B1c-3** builds B1 §3's red-flag table exactly, with its override rule (typed symbol or word + re-authentication,
   one transaction, no setting disables a block) and B1 §3's Confirm hold of 1.5 s on any red-flag screen (on top of C15).
 
+#### Red flags as B1c-3 builds them (rev 3.6)
+
+Flags are computed in the **background** (`src/background/dapp/redFlags.ts`), per transaction of the request, from the
+decoded instructions, the simulation's pre- and post-state, the account's holdings and the mints read through the
+proxy (`getMultipleAccounts`). The window only renders the flags stored with the simulation; it computes none (C13).
+
+| # | condition (B1 §3) | how it is detected | severity | override word |
+|---|---|---|---|---|
+| F1 | a program not in the decoded set — also an instruction that touches an account no lookup table resolved, and a known program's instruction that does not parse strictly | the decoded instruction's program is unknown | warning, named by the program's address (one banner per transaction listing every unknown program, each address whole, in groups of four) | — |
+| F2 | an instruction of a decoded program that is not a transfer | the decoded name is none of System `transfer`, Token / Token-2022 `transfer`, `transferChecked`. **Compute Budget is exempt** — it is the fee, already shown as the fee row; the only exemption | warning, one banner per transaction naming the instructions | — |
+| F3 | System `Assign` / `Allocate` on the user's own wallet account | a decoded `assign`, `allocate`, `assignWithSeed` or `allocateWithSeed` (tags 1, 8, 10, 9) whose target account (index 0) is the wallet account; **and** chain state: the simulation's post-state of the wallet account has an owner other than the System program, or any data (a CPI names no top-level instruction) | **blocked** | `ASSIGN` (Q28) — one word for all four; the banner names which |
+| F4 | SPL / Token-2022 `SetAuthority` (any authority type) on an account the user owns | a decoded `setAuthority` whose account is a token account whose pre-state owner field is the wallet account, or a mint whose pre-state mint authority or freeze authority is the wallet account; **and** chain state (a CPI): an own token account's owner reassigned away, or its close authority changed | **blocked** | `AUTHORITY` (Q29) |
+| F5 | `Approve` / `ApproveChecked` of the whole balance or u64 max | a decoded approve whose amount is u64::MAX or at least the source's pre-state amount; **and** chain state (a CPI): an own account's post-state delegated amount is u64::MAX or at least its pre-state amount | **blocked** | the token's symbol from **the wallet's own token table**, exact and case-sensitive — only when the simulation's decimals match the table's; a mint the wallet cannot name → `UNLIMITED` (Q30). Never a symbol a mint claims for itself (a fake mint can call itself USDC) |
+| F6 | a bounded `Approve` / `ApproveChecked` | as B1c-2 (the `approval` reason, from chain state) | warning + re-authentication | — |
+| F7 | Token-2022 transfer hook, permanent delegate or freeze authority on a token the user holds (**O3: Token-2022 mints only**) | every mint of an own token account the transaction touches (pre- or post-state) and every mint a decoded instruction names, read through the proxy. A Token-2022 mint (owner = the Token-2022 program): its base layout's freeze authority (COption, tag at 46), and its TLV extensions from byte 166 (byte 165 = 1, Mint) — extension 12 PermanentDelegate with a non-zero key, extension 14 TransferHook with a non-zero program id (32 zero bytes are "none"). A mint that cannot be read or parsed → "Could not read this token's settings" (Q36; fail closed — a warning, never silence) | warning, named per mint (which of the three, with the authority's or the program's address) | — |
+| F8 | durable nonce (`AdvanceNonceAccount` first) | B1c-2's `usesDurableNonce` | warning: "This transaction does not expire." (B1 §3's copy, capitalised) | — (`signAndSendTransaction` stays refused for it, B1c-2) |
+| F9 | whole or nearly whole balance to a first-time address | as B1c-2 (`whole-balance-to-new`) | warning + re-authentication, now with a banner | — |
+| F10 | simulation failed and the user continues | **O2:** only a failure attributable to an earlier transaction of the same batch (below) has a continue path; every other failure stays Reject-only — stricter than B1 §3's warning, which is allowed. An expired blockhash anywhere: Reject only | **blocked** | `UNCHECKED` (Q31) |
+| F11 | request origin differs from the granted origin | built in B1c-1 / B1c-2 | **blocked, no override** | — |
+
+- **Attribution (F10, O2).** Transaction *k* (*k* ≥ 2) of a batch failed with an `InstructionError` naming instruction
+  *i* — or with one of the top-level errors a node returns for an account that does not exist, exactly as plan 3
+  lists them from Agave's `TransactionError` — **and** instruction *i*'s resolved accounts intersect the accounts that
+  transactions 1 … *k*−1 of the same batch create: System `createAccount` / `createAccountWithSeed` (the new account),
+  ATA `create` / `createIdempotent` (the account), Token / Token-2022 `initializeAccount`, `initializeAccount2`,
+  `initializeAccount3` (the account). Then step *k* reads "This step depends on step <N> and could not be checked on
+  its own." (Q32), shows no balance changes (they are unknown, and it says so) and F10 blocks it. A dependent step's
+  effects are unknown, so the request always re-authenticates. Every other failure: Reject only, as B1c-2.
+- **The override rule (B1 §3, O1).** Each blocked transaction carries its own typed field, in its own section of the
+  screen; a transaction with two kinds of block needs both words — one field per (transaction, kind). Approve is
+  enabled only when every field matches. The window sends the words it was given with the approval; the background
+  recomputes every expected word from its stored simulation and refuses the approval unless every block has its exact
+  word, and refuses it when any block has none. A request with any block always re-authenticates through #10 (the
+  reason line: "Re-auth required to override a blocked transaction.", Q33); #10's description names what is
+  overridden, and a refresh that adds a block asks for a new re-authentication. The re-authentication stays bound to
+  the exact bytes (B1c-2); the words are not secrets and are bound only by the background recomputing them. No setting
+  disables a block.
+- **Holds (B1 §3).** On any screen with a flag (warning or block) every confirming CTA is held **1.5 s** — on top of
+  C15's hold after focus and after each state change, a typed field's match changing included. No control is focused
+  at open, the typed field included; Enter never confirms, and Enter in a typed field never submits. Reject is never
+  held.
+- **The typed field** is the design's `.s9-typed-confirm`: the label "Type <code>WORD</code> to enable Approve" (the
+  design's), the word shown in its true case; the input with `autocapitalize`, `autocomplete`, `autocorrect` and
+  `spellcheck` off, an exact, case-sensitive match with no trimming (a trailing space does not match), the design's
+  `.input.match` border on a match, and #37's helper "Case-sensitive · must match exactly.". Never pre-filled. The
+  CTA: for an unlimited approve the design's red "Approve unlimited" with the alert icon; for any other block "Approve
+  anyway" (Q34), red; drawn as #37's gated CTA (greyed, full label) until every field matches.
+- **Banners.** `.s9-flag-banner danger` for a block (head, body, meta — the design's state 2; for F5 the design's own
+  copy with the real token and delegate), `.s9-flag-banner warn` for a warning; blocks first, then warnings, per
+  transaction, in that transaction's section. The top-bar eyebrow: "Critical · Unlimited spend approval" for F5 (the
+  design's), "Critical · Blocked transaction" (Q35) for any other block, unchanged otherwise. An approve's balance card
+  gains the design's synthesized row ("<SYM> delegated · unlimited · ≈ all current + future"; a bounded approve
+  "<SYM> delegated · <amount>"): an approve changes no balance, so the "No balance changes" line is replaced wherever an
+  authority or approve flag exists.
+
 The plans for B1c-2 and B1c-3 refine this section; they may not loosen it.
 
 ---
@@ -796,7 +863,7 @@ empty, detail, hold, undo toast, blocked section) at 412 px; the opus-tier revie
 |---|---|
 | `extension/src/provider/` | the MAIN-world provider (bundle `provider.js`) |
 | `extension/src/relay/` | the ISOLATED relay (bundle `relay.js`) |
-| `extension/src/background/dapp/` | ports, queue, grants, known list + classifier + confusables + punycode, blocked, pageApi, window, decide, lockHook, signMessage; B1c-2 decode/simulate/signTx; B1c-3 redFlags |
+| `extension/src/background/dapp/` | ports, queue, grants, known list + classifier + confusables + punycode, blocked, pageApi, window, decide, lockHook, signMessage; B1c-2 decode/simulate/signTx; B1c-3 redFlags, tokenState (the mint and token-account parsers) |
 | `extension/src/background/autolock.ts`, `session.ts`, `index.ts` | every lock caller routed through the lock hook |
 | `extension/src/approve/` + `approve.html` | the approval window (#46, #47, #48, locked) |
 | `extension/src/app/screens/ConnectedApps.tsx` | #49 |
@@ -841,12 +908,17 @@ empty, detail, hold, undo toast, blocked section) at 412 px; the opus-tier revie
 | design frame 916 px high | the window is 720 px; the body scrolls, the sticky bar stays |
 | unlock inside the flow (implied by the design's modal stack) | the locked window points to the toolbar (D11) |
 | first six / last six highlighted on review screens | B1 §3 (owner): labels + first-send warning, unchanged |
-| a `signTransaction` batch whose later transactions depend on earlier ones (create a token account, then transfer to it; a swap's setup / swap / cleanup) | **unapprovable in B1c-2** (owner, 2026-10-15; plan 2 review 1 M4): a batch is simulated transaction by transaction against the current slot — a node cannot chain them — so a transaction that needs an earlier one's effect simulates as failed, and a failed simulation offers only [Reject] (plan 2 R6, R8). **B1c-3 must solve dependent batches** — e.g. a per-transaction override for a failure attributable to an earlier transaction of the same batch (one that creates the account the failure names), under B1 §3's override rule — rather than leave them to the typed override of every failed simulation |
+| a `signTransaction` batch whose later transactions depend on earlier ones (create a token account, then transfer to it; a swap's setup / swap / cleanup) | **unapprovable in B1c-2** (owner, 2026-10-15; plan 2 review 1 M4): a batch is simulated transaction by transaction against the current slot — a node cannot chain them — so a transaction that needs an earlier one's effect simulates as failed, and a failed simulation offered only [Reject] (plan 2 R6, R8). **Solved in B1c-3 under the override rule (O2, rev 3.6):** a step whose failure is attributable to an earlier transaction of the same batch (one that creates an account the failing instruction names — §3.3 "Attribution") says it depends on that step (Q32), its effects unknown, and is approvable only with the typed word `UNCHECKED` (Q31) and re-authentication. Every other failed simulation stays Reject-only — stricter than B1 §3's "warning", which is allowed |
 | §1.6 / §3.3's order for transactions: `unauthorized` before any other check | a **malformed** `page.signTransaction` / `page.signAndSendTransaction` payload (`transactions` / `transaction` not base64 strings, a batch of 0 or more than 5, a transaction over 1 232 bytes or not one canonical transaction; `account` not a base58 32-byte key; another chain; `options` present and not an object) is answered `invalid-request` before the grant is read (plan 2, Task 3) — the same reasoning as the `signMessage` row below: a page without a grant learns only that its own payload was malformed, never whether a grant exists; a well-formed request keeps the grant check first (rev 3.3, plan 2 review 1 L6) |
 | §1.5 / C17 "answered once" for `signAndSendTransaction` | a `{signature}` answered from the entry's recorded bytes (a restart, a dead effect, a lock, C4's expiry) is a promise that the bytes reach the route, **not that they land** (rev 3.4, plan 2 review 2 L3): accepted limits — the route may refuse the poller's first broadcast (the dApp's blockhash died while the worker was down: `failed not-sent`), the record may have expired before any sweep answered (nothing is sent: it could not land), or the lock hook's `due` mark may fail to write (logged; the effect still running sends it). In each, nothing lands and no funds move; a dApp told a signature confirms it (B1 §3), and since a dApp's record is hidden from the popup, only the site tells the user |
 | §1.5 / C17 "never sent twice" for `signAndSendTransaction` — the claim before the route call | a fourth accepted limit beside the row above (rev 3.5, plan 2 Task 5 ruling): the first broadcast of a dApp's recorded bytes is claimed `held`/`due` → `done` in one write **before** the bytes are handed to the route, so whoever claims sends and nobody sends again. If the service worker stops in the window between that write and the route call actually leaving it, the bytes never reach the route, yet the record reads `done` and is never handed over again; the page — answered `{signature}` from the entry's recorded bytes by the restart's sweep, a lock or C4's expiry — is told a signature for bytes the network never received. Nothing lands and **no funds move**: the record polls until its blockhash expires ("Not confirmed — no funds moved.") and the dApp's own confirmation of the signature fails. Kept deliberately: re-sending on doubt would trade this window for an at-least-once rule, and "never sent twice" (rev 3.4) is the binding one |
-| B1 §3 re-authentication "first send to a new address" for a token transfer | the destination of an SPL `transfer` / `transferChecked` is a token account, not the owner the user knows: **every SPL transfer to a token account that is not the account's own re-authenticates** (fail closed — plan 2 R10; rev 3.4) until B1c-3 or later resolves a token account to its owner |
+| B1 §3 re-authentication "first send to a new address" for a token transfer | the destination of an SPL `transfer` / `transferChecked` is a token account, not the owner the user knows; rev 3.4 re-authenticated every SPL transfer to a token account that is not the account's own (plan 2 R10). **Rev 3.6 (plan 3):** the destination is resolved to its owner — its pre-state read through the proxy, a token-account layout's owner field; absent before but created in the same transaction by an ATA `create` / `createIdempotent`, that instruction's wallet — and the transfer is a first send unless that owner is a known recipient or the account itself. Unreadable, not a token account, or not created by the transaction → a first send (fail closed, as before) |
 | §3.2's order: rule 1 (`unauthorized`) before any other check | a **malformed** `page.signMessage` payload (`message` not a string, not base64 or over the size bound; `account` not a base58 32-byte key) is answered `invalid-request` before rule 1 runs (plan-mandated, Task 6). No leak: a page without a grant learns only that its own payload was malformed, never whether a grant exists; a well-formed request keeps rule 1's order |
+| #48 "Recommended alternative · Approve only the swap amount ~ 250 USDC" card (state 2) | **omitted** (rev 3.6): a wallet cannot change a dApp's transaction (its bytes, its blockhash — §3.3), and any amount shown would be invented |
+| #48 annotation "approval: 'unlimited' … so #34 connected-apps can flag this session" | **omitted** (rev 3.6): #34 is out (D1), and #49 has no such flag |
+| the design's Section IX summary: "red destructive primary Reject + tertiary-demoted" Approve on unlimited spend | **the drawn mockup is built** (rev 3.6): secondary Reject and the red "Approve unlimited" with the alert icon (ix:18388-18391); the summary line contradicts the state it describes |
+| B1 §3 "freeze authority on a token the user holds" for a **classic SPL** mint | **not flagged** (owner, O3, rev 3.6): the Token-2022 warnings are for Token-2022 mints only. USDC and USDT are classic mints with a freeze authority; flagging it would warn on nearly every dApp transaction that moves them |
+| B1 §3 "first send to a new address" for a transfer a dApp program makes by **CPI** | **accepted limit** (owner, O4, rev 3.6): first send is read from the top-level decoded System `transfer` and SPL `transfer` / `transferChecked`. A transfer made inside another program's instruction names no top-level instruction; it is bounded only by the 5 % and dollar rules on the simulated outflow (B1c-2), which still apply. The other moving shapes the first-send rule does not read (System `transferWithSeed`, Token-2022's `transferCheckedWithFee`, a close to a foreign destination, a burn) carry F1's or F2's warning and the same amount rules |
 
 ---
 
@@ -879,6 +951,15 @@ empty, detail, hold, undo toast, blocked section) at 412 px; the opus-tier revie
 | Q25 | #49 undo refused (rev 3.2, owner-delegated 2026-10-12) | "Could not undo — <name> stays disconnected." |
 | Q26 | #46 request can no longer be signed (rev 3.2, owner-delegated 2026-10-12) | "This request can no longer be signed. Reject it and ask the site to try again." |
 | Q27 | #48 an approval refused because the simulation it named, still the newest, is 40 s old — its refresh has not landed (rev 3.5, controller copy, flagged to the owner; final review I3) | "This simulation is out of date. Wait a moment for it to refresh." — never "The transaction changed while you were reviewing…", which is said only when the window named another simulation than the newest |
+| Q28 | #48 typed override word: System `Assign` / `Allocate` (or a `…WithSeed` form) on the wallet account, F3 (rev 3.6, controller copy, flagged to the owner) | `ASSIGN` |
+| Q29 | #48 typed override word: `SetAuthority` on an account the user owns, F4 (rev 3.6, controller copy, flagged to the owner) | `AUTHORITY` |
+| Q30 | #48 typed override word: an unlimited approve of a token the wallet's own table cannot name, F5 (rev 3.6, controller copy, flagged to the owner) | `UNLIMITED` |
+| Q31 | #48 typed override word: a step that depends on an earlier one, F10 (rev 3.6, controller copy, flagged to the owner) | `UNCHECKED` |
+| Q32 | #48 a dependent step's outcome, F10 (rev 3.6, controller copy, flagged to the owner) | "This step depends on step <N> and could not be checked on its own." |
+| Q33 | #10 reason line for an override (rev 3.6, controller copy, flagged to the owner) | "Re-auth required to override a blocked transaction." |
+| Q34 | #48 red CTA for a block other than an unlimited approve (rev 3.6, controller copy, flagged to the owner) | "Approve anyway" |
+| Q35 | #48 top-bar eyebrow for a block other than an unlimited approve (rev 3.6, controller copy, flagged to the owner) | "Critical · Blocked transaction" |
+| Q36 | #48 F7 warning, a mint that cannot be read or parsed (rev 3.6, controller copy, flagged to the owner) | "Could not read this token's settings" |
 
 (Q09 and Q11 of rev 1 are gone: the window no longer shows "expired" for a request it did not show, and the undo toast
 uses the design's drawn strings.)
````

Create `extension/src/background/dapp/tokenState.ts`:

````ts
import {base58} from '@scure/base';
import {TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from './decode/decode';

/**
 * Token state (spec B1c §3.3 rev 3.6): the one reader of SPL Token and Token-2022 mints and token accounts, from their
 * account data and owner program — the simulation's balance changes (B1c-2) and the red flags (F4, F5, F7) both read
 * through it. Pure, and fail closed: any byte the program itself would refuse to unpack makes the whole account
 * unreadable (null), never a partial answer.
 *
 * Layouts (the programs' own): a Mint is 82 bytes — mint authority COption<Pubkey> (u32 tag at 0, key at 4), supply u64
 * at 36, decimals at 44, is_initialized at 45, freeze authority COption<Pubkey> (tag at 46, key at 50). An Account is
 * 165 bytes — mint 0..32, owner 32..64, amount u64 at 64, delegate COption<Pubkey> (tag at 72, key at 76), state at
 * 108 (1 Initialized, 2 Frozen), is_native COption<u64> (tag at 109), delegated amount u64 at 121, close authority
 * COption<Pubkey> (tag at 129, key at 133). A COption tag is 0 (None) or 1 (Some); anything else is malformed.
 * Token-2022 may extend either: the base, zero padding up to 165, an AccountType byte at 165 (1 Mint, 2 Account), then
 * TLV extensions from 166 — u16 LE type, u16 LE length, the value. Never 355 bytes, a Multisig's size (an extended
 * account of that length would be indistinguishable from one). A TLV header or value past the end, an extension twice,
 * or anything but zeros after an Uninitialized (0) header is malformed. Read here: PermanentDelegate (12, its delegate)
 * and TransferHook (14, its authority and program id) — both OptionalNonZeroPubkey, 32 zero bytes being none.
 */
export type TokenProgramKey = 'token' | 'token-2022';

export interface MintInfo {
  program: TokenProgramKey;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  /** Token-2022's PermanentDelegate extension, when set to a non-zero key. */
  permanentDelegate: string | null;
  /** Token-2022's TransferHook extension's program, when set to a non-zero key. */
  transferHookProgram: string | null;
}

export interface TokenAccountInfo {
  program: TokenProgramKey;
  mint: string;
  /** The owner field: the wallet that may move it. */
  owner: string;
  amount: bigint;
  delegate: string | null;
  delegatedAmount: bigint;
  closeAuthority: string | null;
  state: 'initialized' | 'frozen';
  /** is_native set: a wrapped-SOL account of either program's native mint (its lamports are its value). */
  isNative: boolean;
}

const MINT_SIZE = 82;
const ACCOUNT_SIZE = 165;
const MULTISIG_SIZE = 355;
const ACCOUNT_TYPE_MINT = 1;
const ACCOUNT_TYPE_ACCOUNT = 2;
const PERMANENT_DELEGATE = 12;
const TRANSFER_HOOK = 14;

const programOf = (owner: string): TokenProgramKey | null => (owner === TOKEN_PROGRAM ? 'token' : owner === TOKEN_2022_PROGRAM ? 'token-2022' : null);
const viewOf = (data: Uint8Array): DataView => new DataView(data.buffer, data.byteOffset, data.byteLength);

/** A COption tag at `at`: true Some, false None, null malformed. */
function tag(view: DataView, at: number): boolean | null {
  const t = view.getUint32(at, true);
  return t === 1 ? true : t === 0 ? false : null;
}
/** A COption<Pubkey> (tag at `at`, key at `at + 4`): the key, null for None, undefined when malformed. */
function optionKey(data: Uint8Array, view: DataView, at: number): string | null | undefined {
  const t = tag(view, at);
  if (t === null) return undefined;
  return t ? base58.encode(data.subarray(at + 4, at + 36)) : null;
}
/** An OptionalNonZeroPubkey: 32 zero bytes are none. */
const nonZeroKey = (b: Uint8Array): string | null => (b.every(x => x === 0) ? null : base58.encode(b));

/**
 * Token-2022's extended layout after a base of `base` bytes: the extensions by type, or null when the layout is not an
 * extended `accountType` or is malformed.
 */
function extensionsOf(data: Uint8Array, base: number, accountType: number): ReadonlyMap<number, Uint8Array> | null {
  if (data.length <= ACCOUNT_SIZE || data.length === MULTISIG_SIZE || data[ACCOUNT_SIZE] !== accountType) return null;
  if (data.subarray(base, ACCOUNT_SIZE).some(b => b !== 0)) return null;
  const view = viewOf(data);
  const out = new Map<number, Uint8Array>();
  let at = ACCOUNT_SIZE + 1;
  while (at < data.length) {
    if (at + 4 > data.length) return null;
    const type = view.getUint16(at, true);
    if (type === 0) return data.subarray(at).every(b => b === 0) ? out : null;
    const end = at + 4 + view.getUint16(at + 2, true);
    if (end > data.length || out.has(type)) return null;
    out.set(type, data.subarray(at + 4, end));
    at = end;
  }
  return out;
}

/** A mint's state from its data and owner program, or null (not a mint of either token program, or malformed). */
export function mintInfo(data: Uint8Array, owner: string): MintInfo | null {
  const program = programOf(owner);
  if (program === null) return null;
  let extensions: ReadonlyMap<number, Uint8Array> = new Map();
  if (data.length !== MINT_SIZE) {
    const ext = program === 'token-2022' ? extensionsOf(data, MINT_SIZE, ACCOUNT_TYPE_MINT) : null;
    if (ext === null) return null;
    extensions = ext;
  }
  const view = viewOf(data);
  const mintAuthority = optionKey(data, view, 0);
  const freezeAuthority = optionKey(data, view, 46);
  const delegate = extensions.get(PERMANENT_DELEGATE);
  const hook = extensions.get(TRANSFER_HOOK);
  if (mintAuthority === undefined || freezeAuthority === undefined) return null;
  if ((delegate !== undefined && delegate.length !== 32) || (hook !== undefined && hook.length !== 64)) return null;
  return {
    program,
    decimals: view.getUint8(44),
    mintAuthority,
    freezeAuthority,
    permanentDelegate: delegate === undefined ? null : nonZeroKey(delegate),
    transferHookProgram: hook === undefined ? null : nonZeroKey(hook.subarray(32, 64)),
  };
}

/** A token account's state from its data and owner program, or null (not an initialized token account, or malformed). */
export function tokenAccountInfo(data: Uint8Array, owner: string): TokenAccountInfo | null {
  const program = programOf(owner);
  if (program === null) return null;
  if (data.length !== ACCOUNT_SIZE && (program !== 'token-2022' || extensionsOf(data, ACCOUNT_SIZE, ACCOUNT_TYPE_ACCOUNT) === null)) return null;
  const state = data[108];
  if (state !== 1 && state !== 2) return null;
  const view = viewOf(data);
  const delegate = optionKey(data, view, 72);
  const isNative = tag(view, 109);
  const closeAuthority = optionKey(data, view, 129);
  if (delegate === undefined || isNative === null || closeAuthority === undefined) return null;
  return {
    program,
    mint: base58.encode(data.subarray(0, 32)),
    owner: base58.encode(data.subarray(32, 64)),
    amount: view.getBigUint64(64, true),
    delegate,
    delegatedAmount: view.getBigUint64(121, true),
    closeAuthority,
    state: state === 1 ? 'initialized' : 'frozen',
    isNative,
  };
}
````

Change `extension/src/background/dapp/simulate.ts`, `extension/src/background/dapp/decode/decode.ts`, `extension/src/approve/Tx.tsx`, `extension/src/approve/strings.ts`:

````diff
diff --git a/extension/src/approve/Tx.tsx b/extension/src/approve/Tx.tsx
index 12471b2..b973b8a 100644
--- a/extension/src/approve/Tx.tsx
+++ b/extension/src/approve/Tx.tsx
@@ -150,7 +150,7 @@ function Payload({item, labels}: {item: TxItem; labels: readonly AddressLabel[]}
               <span className="v mono">
                 {ix.name ?? TX_TEXT.unknownInstruction}
                 {/* Fix round 1, I3 (controller ruling): a known program's instruction the decoder names but did not
-                    decode the fields of (mintTo, withdrawNonceAccount, transferWithSeed, …) never looks fully decoded. */}
+                    decode the fields of (mintTo, withdrawNonceAccount, initializeMint, …) never looks fully decoded. */}
                 {ix.fields.length === 0 ? <span className="noc-caption"> · {TX_TEXT.notDecoded}</span> : null}
               </span>
             </div>
diff --git a/extension/src/approve/strings.ts b/extension/src/approve/strings.ts
index 48563a7..ea76c85 100644
--- a/extension/src/approve/strings.ts
+++ b/extension/src/approve/strings.ts
@@ -152,7 +152,7 @@ export const TX_TEXT = {
   /** Controller (owner copy): an instruction of a decoded program whose tag the wallet does not know. */
   unknownInstruction: 'unknown instruction',
   /** Fix round 1, I3 (controller ruling, overrides plan R2's display): a known program's instruction the decoder names but
-   * does not decode the fields of (mintTo, transferWithSeed, createAccountWithSeed, withdrawNonceAccount, Token-2022
+   * does not decode the fields of (mintTo, initializeMint, initializeNonceAccount, withdrawNonceAccount, Token-2022
    * extension instructions, recoverNested, …) must never look fully decoded. */
   notDecoded: 'Details not decoded — check them on the site before approving.',
   computeUnits: 'Compute units',
diff --git a/extension/src/background/dapp/decode/decode.ts b/extension/src/background/dapp/decode/decode.ts
index 6caa63c..4014501 100644
--- a/extension/src/background/dapp/decode/decode.ts
+++ b/extension/src/background/dapp/decode/decode.ts
@@ -7,7 +7,8 @@ import type {ParsedTx} from './wire';
 /**
  * The decoder (spec B1c §3.3, B1 §3; D6 — our own, no new third-party code in the signing path): every instruction of a
  * dApp's transaction, named and with its fields, for the programs the wallet knows — System (transfer, createAccount,
- * assign, allocate, advanceNonceAccount), SPL Token and Token-2022 (transfer, transferChecked, approve, approveChecked,
+ * assign, allocate, advanceNonceAccount; B1c-3: createAccountWithSeed, allocateWithSeed, assignWithSeed,
+ * transferWithSeed), SPL Token and Token-2022 (transfer, transferChecked, approve, approveChecked,
  * revoke, setAuthority, closeAccount, burn, burnChecked, initializeAccount 1/2/3, syncNative, freezeAccount,
  * thawAccount, and the Token-2022 extensions B1 §3 names: the transfer hook and the permanent delegate), the Associated
  * Token Account program (create, createIdempotent), Compute Budget (the unit limit and price) and the presale program
@@ -129,12 +130,21 @@ class Reader {
     const b = this.bytes(32);
     return b === null ? null : base58.encode(b);
   }
+  /** A System seed: bincode's String (u64 length, then the bytes) of at most MAX_SEED_LEN bytes — longer, the runtime
+   * refuses the instruction. */
+  seed(): Uint8Array | null {
+    const n = this.u64();
+    return n === null || n > BigInt(MAX_SEED_LEN) ? null : this.bytes(Number(n));
+  }
   /** The bytes all read, none left over (a strict decode). */
   done(): boolean {
     return this.at === this.data.length;
   }
 }
 
+/** The runtime's MAX_SEED_LEN for an address derived with a seed. */
+const MAX_SEED_LEN = 32;
+
 /** An address field: `value` is always present — a resolution failure never reaches here (see `Acc`, below). */
 const addr = (name: string, value: string): Field => ({name, value: {kind: 'address', value}});
 /** A legitimate, protocol-level absence (never a resolution failure — those make the whole instruction unknown). */
@@ -146,6 +156,16 @@ const amount = (name: string, v: bigint, decimals: number | null): Field => ({na
 const num = (name: string, v: number | bigint): Field => ({name, value: {kind: 'number', value: v.toString()}});
 const text = (name: string, v: string): Field => ({name, value: {kind: 'text', value: v}});
 const hex = (b: Uint8Array): string => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
+/** A seed as text when it is printable ASCII, else its bytes in hex (never an invisible or look-alike character shown as
+ * text); null when it is not UTF-8 — bincode's String refuses it, so the runtime never runs the instruction. */
+function seedField(name: string, b: Uint8Array): Field | null {
+  try {
+    new TextDecoder('utf-8', {fatal: true}).decode(b);
+  } catch {
+    return null;
+  }
+  return b.every(x => x >= 0x20 && x <= 0x7e) ? text(name, String.fromCharCode(...b)) : {name, value: {kind: 'hex', value: hex(b)}};
+}
 
 /** The instruction's own accounts, resolved by index — undefined when the instruction simply did not supply that many
  * accounts (never null: an account that failed lookup-table resolution already made the whole instruction unknown,
@@ -206,6 +226,18 @@ function system(r: Reader, acc: Acc): Known | null {
       const [from, to] = accs;
       return {name: 'transfer', fields: [addr('from', from), addr('to', to), lamports('lamports', l)]};
     }
+    case 3: {
+      const base = r.pubkey();
+      const seed = r.seed();
+      const l = r.u64();
+      const space = r.u64();
+      const owner = r.pubkey();
+      const accs = acc2(acc, 0, 1);
+      const seedF = seed === null ? null : seedField('seed', seed);
+      if (base === null || seedF === null || l === null || space === null || owner === null || accs === null || !r.done()) return null;
+      const [from, newAccount] = accs;
+      return {name: 'createAccountWithSeed', fields: [addr('from', from), addr('newAccount', newAccount), addr('base', base), seedF, lamports('lamports', l), num('space', space), addr('owner', owner)]};
+    }
     case 4: {
       const accs = acc2(acc, 0, 2);
       if (accs === null || !r.done()) return null;
@@ -218,6 +250,28 @@ function system(r: Reader, acc: Acc): Known | null {
       if (space === null || account === undefined || !r.done()) return null;
       return {name: 'allocate', fields: [addr('account', account), num('space', space)]};
     }
+    case 9:
+    case 10: {
+      const base = r.pubkey();
+      const seed = r.seed();
+      const space = tag === 9 ? r.u64() : 0n;
+      const owner = r.pubkey();
+      const account = acc(0);
+      const seedF = seed === null ? null : seedField('seed', seed);
+      if (base === null || seedF === null || space === null || owner === null || account === undefined || !r.done()) return null;
+      const head = [addr('account', account), addr('base', base), seedF];
+      return tag === 9 ? {name: 'allocateWithSeed', fields: [...head, num('space', space), addr('owner', owner)]} : {name: 'assignWithSeed', fields: [...head, addr('owner', owner)]};
+    }
+    case 11: {
+      const l = r.u64();
+      const seed = r.seed();
+      const fromOwner = r.pubkey();
+      const accs = acc3(acc, 0, 1, 2);
+      const seedF = seed === null ? null : seedField('fromSeed', seed);
+      if (l === null || seedF === null || fromOwner === null || accs === null || !r.done()) return null;
+      const [from, fromBase, to] = accs;
+      return {name: 'transferWithSeed', fields: [addr('from', from), addr('fromBase', fromBase), addr('to', to), lamports('lamports', l), seedF, addr('fromOwner', fromOwner)]};
+    }
     default:
       return nameOnly(SYSTEM_NAMES, tag);
   }
diff --git a/extension/src/background/dapp/simulate.ts b/extension/src/background/dapp/simulate.ts
index deaaa67..47961aa 100644
--- a/extension/src/background/dapp/simulate.ts
+++ b/extension/src/background/dapp/simulate.ts
@@ -1,4 +1,4 @@
-import {base58, base64, base64urlnopad} from '@scure/base';
+import {base64, base64urlnopad} from '@scure/base';
 import type {WalletDeps} from '../deps';
 import {dappReauthReasons, usdMicros, type DappReauthReason} from '../reauthPolicy';
 import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../core/presale/addresses';
@@ -6,6 +6,7 @@ import type {AccountData} from '../../../../core/solana/rpc';
 import {COMPUTE_BUDGET_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, decodeInstructions, type DecodedInstruction} from './decode/decode';
 import {ADDRESS_LOOKUP_TABLE_PROGRAM, resolveKeys, tableAddresses, tablesOf} from './decode/keys';
 import {isWritableIndex, type ParsedTx} from './decode/wire';
+import {mintInfo, tokenAccountInfo} from './tokenState';
 
 /**
  * The simulation (spec B1c §3.3, B1 §3): a dApp's transactions are run through the proxy (`simulateTransaction`, one
@@ -66,36 +67,16 @@ export interface TxSimulation {
   lastValidBlockHeight: number;
 }
 
-/**
- * Whether `a`'s bytes are a real SPL Token / Token-2022 account — never by length alone (fix round 1, I2: a 355-byte
- * Multisig, or any other same-length impostor, must never be read as a token account just because it is long enough).
- * Classic Token accounts are exactly 165 bytes; Token-2022 accounts are the same 165 bytes, or longer with an
- * AccountType::Account discriminator (2) at a fixed offset 165 (its TLV extensions follow) — EXCEPT 355 bytes
- * specifically, the Multisig struct's own size, which collides with that discriminator's position by coincidence and
- * must stay excluded even when byte 165 happens to equal 2. Either way, the state byte (108) must be Initialized (1)
- * or Frozen (2) — never Uninitialized (0), which carries no meaning at all.
- */
-function isTokenAccountLayout(a: AccountData): boolean {
-  if (a.owner === TOKEN_PROGRAM) {
-    if (a.data.length !== 165) return false;
-  } else if (a.owner === TOKEN_2022_PROGRAM) {
-    if (!(a.data.length === 165 || (a.data.length > 165 && a.data.length !== 355 && a.data[165] === 2))) return false;
-  } else {
-    return false;
-  }
-  return a.data[108] === 1 || a.data[108] === 2;
-}
-
 /**
  * `a`'s state as a token account owned by `owner` — read from CHAIN STATE alone (fix round 1, I1: never the decoded
  * instruction, which a dApp program can route an Approve or a close-authority change through by CPI without any
- * top-level instruction that names it). Null when `a` is not a real token account (`isTokenAccountLayout`, I2) or its
- * owner field is not `owner`. `delegate`/`delegatedAmount` (COption<Pubkey> at 72..108, u64 at 121..129) and
- * `closeAuthority` (COption<Pubkey> at 129..165) are read as the runtime does; `lamports` is `a`'s own, for Promoted
- * Minor 3 (a close to a foreign destination moves them out of the wallet's custody without ever touching the wallet's
- * own system account). `isNative` is the `is_native` COption's own tag (u32 LE at 109) — fix round 3, IMPORTANT: this,
- * not the mint address, is what decides native status (below), since Token-2022 has its OWN native mint
- * (`9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP`) carrying the identical invariant at the identical offset.
+ * top-level instruction that names it). Null when `a` is not a real token account (tokenState's `tokenAccountInfo` — I2:
+ * never by length alone, a 355-byte Multisig excluded; B1c-3: one parser for the simulation and the red flags) or its
+ * owner field is not `owner`. `lamports` is `a`'s own, for Promoted Minor 3 (a close to a foreign destination moves them
+ * out of the wallet's custody without ever touching the wallet's own system account). `isNative` is the `is_native`
+ * COption's own tag — fix round 3, IMPORTANT: this, not the mint address, is what decides native status (below), since
+ * Token-2022 has its OWN native mint (`9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP`) carrying the identical invariant at
+ * the identical offset.
  */
 interface OwnTokenAccount {
   mint: string;
@@ -107,45 +88,25 @@ interface OwnTokenAccount {
   isNative: boolean;
 }
 function ownTokenAccountOf(a: AccountData | null, owner: string): OwnTokenAccount | null {
-  if (a === null || !isTokenAccountLayout(a)) return null;
-  if (base58.encode(a.data.subarray(32, 64)) !== owner) return null;
-  const view = new DataView(a.data.buffer, a.data.byteOffset, a.data.byteLength);
-  return {
-    mint: base58.encode(a.data.subarray(0, 32)),
-    amount: view.getBigUint64(64, true),
-    lamports: a.lamports,
-    delegate: view.getUint32(72, true) === 1 ? base58.encode(a.data.subarray(76, 108)) : null,
-    delegatedAmount: view.getBigUint64(121, true),
-    isNative: view.getUint32(109, true) === 1,
-    closeAuthority: view.getUint32(129, true) === 1 ? base58.encode(a.data.subarray(133, 165)) : null,
-  };
+  const t = a === null ? null : tokenAccountInfo(a.data, a.owner);
+  if (a === null || t === null || t.owner !== owner) return null;
+  return {mint: t.mint, amount: t.amount, lamports: a.lamports, delegate: t.delegate, delegatedAmount: t.delegatedAmount, closeAuthority: t.closeAuthority, isNative: t.isNative};
 }
 
 /**
- * The raw owner field (32..64) of any real token-account-layout account, whoever it names — unlike `ownTokenAccountOf`,
- * which already requires the owner to match and so cannot see what it changed TO. Fix round 2, ruled-in: an own
- * account's owner reassigned away (a CPI SetAuthority AccountOwner) is its own re-authentication signal, on top of the
- * −all loss `ownTokenAccountOf`'s owner mismatch already produces (the post side no longer reads as "ours" at all).
+ * The raw owner field of any real token account, whoever it names — unlike `ownTokenAccountOf`, which already requires
+ * the owner to match and so cannot see what it changed TO. Fix round 2, ruled-in: an own account's owner reassigned
+ * away (a CPI SetAuthority AccountOwner) is its own re-authentication signal, on top of the −all loss
+ * `ownTokenAccountOf`'s owner mismatch already produces (the post side no longer reads as "ours" at all).
  */
 function rawTokenOwner(a: AccountData | null): string | null {
-  if (a === null || !isTokenAccountLayout(a)) return null;
-  return base58.encode(a.data.subarray(32, 64));
+  return a === null ? null : (tokenAccountInfo(a.data, a.owner)?.owner ?? null);
 }
 
-/** A mint account's decimals (byte 44 of the base layout — 82 bytes classic, or Token-2022 with the same AccountType
- * discriminator at 165, this time marking a Mint (1) rather than an Account (2)), or null. Fix round 2 (Minor,
- * consistent with I2): the same 355-byte exclusion as `isTokenAccountLayout` — a Multisig that happens to be 355 bytes
- * with byte 165 equal to 1 is not an extended Mint either. */
+/** A mint account's decimals (tokenState's `mintInfo`: either program's mint, never a 355-byte Multisig — fix round 2,
+ * Minor, consistent with I2), or null. */
 function mintDecimals(a: AccountData | null): number | null {
-  if (a === null) return null;
-  if (a.owner === TOKEN_PROGRAM) {
-    if (a.data.length !== 82) return null;
-  } else if (a.owner === TOKEN_2022_PROGRAM) {
-    if (!(a.data.length === 82 || (a.data.length > 165 && a.data.length !== 355 && a.data[165] === 1))) return null;
-  } else {
-    return null;
-  }
-  return a.data[44] ?? null;
+  return a === null ? null : (mintInfo(a.data, a.owner)?.decimals ?? null);
 }
 
 /**
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run src/background/dapp/__tests__/tokenState.test.ts src/background/dapp/__tests__/simulate.test.ts src/background/dapp/decode/__tests__/decode.test.ts` — expected: Test Files  3 passed (3) · Tests  76 passed (76)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  168 passed (168) · Tests  3322 passed (3322) (B1c-2's end state: 167 files, 3300 tests). `node scripts/build.mjs && npm run gates` — expected: every gate ok (permissions, page bundles, vault isolation, rpc methods, no TGE date, fonts, classes). Nothing touches the repository root's `src/` or `core/`.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | named test → observed (`tsc` exit, then the named test file) |
|---|---|---|
| M1a | `tokenState.ts` `tag`: any non-zero COption tag is Some (`t === 0 ? false : true`) | tokenState.test.ts "a COption tag other than 0 or 1 is no mint …" — tsc 0 · RED Tests  2 failed \| 16 passed (18) |
| M1b | `tokenState.ts` `extensionsOf`: the AccountType byte only has to be non-zero (`data[ACCOUNT_SIZE] === 0`) | "the extended layout: the AccountType byte must be Mint (1) …" — tsc 0 · RED Tests  2 failed \| 16 passed (18) |
| M1c | `tokenState.ts` `extensionsOf`: the 355-byte exclusion never fires (`data.length === -MULTISIG_SIZE`) | "a 355-byte account (a Multisig’s size) is never an extended mint …" — tsc 0 · RED Tests  2 failed \| 16 passed (18) (the account twin too) |
| M1d | `tokenState.ts` `extensionsOf`: a value past the end accepted (`end > data.length` dropped) | "a TLV that overruns the data is no mint …" — tsc 0 · RED Tests  2 failed \| 16 passed (18) |
| M1e | `tokenState.ts` `mintInfo`: the permanent delegate's zero key not none (`base58.encode(delegate)`) | "a transfer hook with a program id names it; a permanent delegate of 32 zero bytes is none" — tsc 0 · RED Tests  1 failed \| 17 passed (18) |
| M1f | `tokenState.ts` `extensionsOf`: the padding check dropped | "the extended layout: the padding between the base mint and the AccountType byte must be zero" — tsc 0 · RED Tests  1 failed \| 17 passed (18) |
| M1g | `tokenState.ts` `extensionsOf`: the header-fits check dropped (`at + 4 > data.length`) | "a TLV that overruns the data is no mint …" — tsc 0 · RED Tests  2 failed \| 16 passed (18) (the cut header throws a RangeError instead of null) |
| M1h | `tokenState.ts` `extensionsOf`: an extension twice accepted (`out.has(type)` dropped) | "a read extension of the wrong size, or an extension twice, is no mint" — tsc 0 · RED Tests  1 failed \| 17 passed (18) |
| M1i | `tokenState.ts` `extensionsOf`: an Uninitialized header ends the walk whatever follows (`if (type === 0) return out;`) | "an Uninitialized (0) TLV header ends the extensions; anything but zeros after it is no mint" — tsc 0 · RED Tests  1 failed \| 17 passed (18) |
| M1j | `tokenState.ts` `tokenAccountInfo`: state 0 (Uninitialized) accepted | "no account: Uninitialized or an unknown state, …" — tsc 0 · RED Tests  1 failed \| 17 passed (18) |
| M1k | `simulate.ts` `mintDecimals`: reads only the first 82 bytes (`mintInfo(a.data.subarray(0, 82), a.owner)` — the extended layout not validated) | simulate.test.ts "one parser: an extended Token-2022 account and mint are read; …" — tsc 0 · RED Tests  2 failed \| 26 passed (28) (B1c-2's 355-byte mint test too) |
| M1l | `decode.ts` `Reader.seed`: a seed up to 1 024 bytes accepted (`BigInt(MAX_SEED_LEN) * 32n`) | decode.test.ts "the seed: at most 32 bytes; …" — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M1m | `decode.ts` `seedField`: every UTF-8 seed shown as text (`text(name, new TextDecoder().decode(b))`) | "the seed: at most 32 bytes; …" — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M1n | `decode.ts` `seedField`: a seed that is not UTF-8 accepted (`{fatal: false}`) | "the seed: at most 32 bytes; …" — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M1o | `decode.ts` tags 9/10: the target `account` field shows the base (`addr('account', base)`) — what F3 compares | "createAccountWithSeed, allocateWithSeed, assignWithSeed, transferWithSeed: every field, the target account included" — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M1p | `decode.ts` tag 11: a trailing byte accepted (`!r.done()` dropped) | "strict: a trailing byte, or fewer accounts than the instruction needs, is an unknown program" — tsc 0 · RED Tests  1 failed \| 29 passed (30) |

16 mutations, all red, every one compiling (`tsc` 0). Three first drafts did not compile and were replaced (INVALID, not red): M1c, M1k and M1l as first written left `MULTISIG_SIZE`, `mintInfo` or `MAX_SEED_LEN` unused (`noUnusedLocals`, tsc 2). Counts are on this task's own tree (the named file's tests), each mutant alone in a fresh `git archive` copy with `node_modules` linked, under `timeout 300`.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-3 spec rev 3.6, the token-state parsers (one source of truth for the simulation and the red flags), System's …WithSeed instructions decoded" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

#### Dry-run notes (Task 1)

- **Ruling: one behaviour change in the simulation, only for bytes a token program refuses** — `tokenAccountInfo` / `mintInfo` are stricter than B1c-2's `isTokenAccountLayout` / `mintDecimals`: a COption tag other than 0/1 (an account's delegate, is_native, close authority; a mint's two authorities), a malformed Token-2022 TLV (a header or value past the end, an extension twice, non-zero bytes after an Uninitialized header), non-zero padding between a Token-2022 mint's base and its AccountType byte, and an extension 12 / 14 of the wrong size now read as "not a token account / not a mint". The brief asked for exactly these parser rules AND for simulate to use them (one source of truth), so the tightening is inherent; it is not silent: the new simulate test "one parser: …" pins it (red on B1c-2's tree), and every B1c-2 simulate test stays green unchanged. Direction: an own account whose post-state is malformed reads as lost (−all, the alarming side); a malformed mint gives base units — why: the token programs' own unpack refuses these bytes and they never write them, so only a lying node could serve them — cost if wrong: a real account the program accepts would show as lost / in base units / with Q36 "could not read" (never a missed flag).
- **Ruling: `mintInfo` does not check is_initialized (byte 45)** — B1c-2's simulate fixture for `ODD_MINT` (82 bytes, only byte 44 set) must stay green unchanged, and it has 0 there — why: an uninitialized mint holds no balance, and F7 still reads its authorities and extensions (no flag is lost) — cost if wrong: an uninitialized Token-2022 mint is parsed instead of "could not read" (harmless).
- **Ruling: the TLV walk is stricter than Token-2022's at the tail** — 1–3 bytes left after the last entry → null (the program tolerates fewer than 2), and after an Uninitialized (0) header every remaining byte must be zero (the program ignores them) — why: fail closed; a mint the wallet cannot fully read is Q36's warning, never silence — cost if wrong: a false "Could not read this token's settings" on an oddly padded mint (real mints are sized exactly).
- **Ruling: a seed is shown as text only when every byte is printable ASCII (0x20–0x7e), else in hex; not UTF-8 or over 32 bytes → unknown program** — why: bincode's String refuses non-UTF-8 and the runtime refuses seeds over MAX_SEED_LEN (32), so such an instruction never runs as named; hex keeps invisible / look-alike characters off the screen — cost if wrong: a legitimate non-ASCII seed is less readable (hex), never hidden.
- **Ruling: field names are the runtime's own, account minimums the runtime's** — `base`/`seed`/`owner`; transferWithSeed's `from_seed`/`from_owner` as `fromSeed`/`fromOwner`, its base signer account as `fromBase`; createAccountWithSeed needs 2 accounts, allocate/assignWithSeed 1, transferWithSeed 3 (the runtime's `check_number_of_instruction_accounts`). The base shown for tags 3/9/10 is the data's (the signer account at index 2 / 1 is not shown). Task 2's F3 reads `addressField(ix, 'account')` for `assign`, `allocate`, `assignWithSeed`, `allocateWithSeed`; Task 3's creators read `newAccount` for `createAccount` and `createAccountWithSeed`.
- **Deviation (additive): `TokenAccountInfo` carries `program` and `isNative` beyond the brief's list** — `isNative` is what simulate's native rule needs (fix round 3), `program` is free and lets Task 6 name an account's token program; `MintInfo` has no `supply` (no consumer).
- **Spec:** Q36 numbers the brief's unnumbered "Could not read this token's settings" (controller copy, flagged). F10's exact top-level error list is left to Task 3 ("exactly as plan 3 lists them from Agave's `TransactionError`") — Task 3 must list them (and write them into §3.3 if it accepts any beyond `InstructionError`). The O4 row also discloses the other moving shapes first-send does not read (`transferWithSeed`, `transferCheckedWithFee`, a close to a foreign destination, a burn) and says they carry F1's/F2's warning — a disclosure beyond O4's CPI wording, flagged to the owner; Task 2 must make that sentence true (F2 names every non-transfer).
- **For Task 5 (copy not yet in the spec):** the heads/bodies of F1–F4, F7 (per kind), F9 and F10's banners, and the line that replaces "No balance changes" beside an authority/approve flag, are not in the spec, the design or B1 §3 beyond what §3.3 now quotes ("unknown program", "This transaction does not expire.", the F5 design copy, Q32, Q36). Task 1 did not invent them: Task 5 adds them as Q37+ (controller copy, flagged) with a spec touch.
- **For every later task:** the dry-run clone has no git identity configured — commit with `git -c user.name=… -c user.email=… commit …`. Mint and token-account fixtures come from `__tests__/tokenBytes.ts` (`mintBytes`, `tokenAccountBytes`, `usdcLikeMint`, `pyusdLikeMint`, `withU32`/`withByte`); never hand-typed bytes. `decodeInstructions` now returns fields for `transferWithSeed`; simulate's first-send is unchanged (it reads `from` only for a System `transfer`), as O4 accepts.
- **Prettier:** the surrounding files are not `prettier --check`-clean at HEAD~1 (the repo's long-line style); the new code follows the surrounding style, as plan 2 did.

---

### Task 2: `redFlags.ts` — B1 §3's red-flag table, F1–F10, as a pure function over the simulation's reads; the override words and their check

**Spec:** B1c §3.3 rev 3.6 "Red flags as B1c-3 builds them" (F1–F10, the override rule), B1 §3 (the table, binding); owner decisions O1–O3; brief "The red-flag table as built", R1–R4

**Files:**
- Test (new): `extension/src/background/dapp/__tests__/redFlags.test.ts`
- Create: `extension/src/background/dapp/redFlags.ts`

**Interfaces:**
- Consumes: Task 1's `mintInfo`, `tokenAccountInfo`, `TokenAccountInfo` (`dapp/tokenState.ts`), the decoder's `…WithSeed` fields (`account` for `assignWithSeed` / `allocateWithSeed`), `__tests__/tokenBytes.ts` (`keyOf`, `mintBytes`, `tokenAccountBytes`, `usdcLikeMint`, `pyusdLikeMint`, `permanentDelegateExt`, `transferHookExt`, `U64_MAX`, the issuer keys); B1c-2's `decodeInstructions`, `addressField`, `DecodedInstruction`, `ProgramKey`, the program ids (`decode/decode.ts`), `ParsedTx`/`parseWire` (`decode/wire.ts`), `resolveKeys` (`decode/keys.ts`), `usesDurableNonce` (`txRequest.ts`), `DappReauthReason` (`reauthPolicy.ts`), `AccountData` (`core/solana/rpc.ts`), `WALLET_TOKENS`, `tokenForMint`, `WalletToken` (`core/solana/balances.ts`).
- Produces (`dapp/redFlags.ts`):
  ```ts
  export const OVERRIDE_WORDS = {assign: 'ASSIGN', setAuthority: 'AUTHORITY', unlimited: 'UNLIMITED', dependent: 'UNCHECKED'} as const;
  export type FlagOutcome = {status: 'simulated'; post: ReadonlyMap<string, AccountData | null>} | {status: 'failed'} | {status: 'dependent'; on: number};   // on: 0-based
  export interface TxFlagInput {tx: ParsedTx; decoded: readonly DecodedInstruction[]; pre: ReadonlyMap<string, AccountData | null>; outcome: FlagOutcome; firstSend: boolean}
  export interface RedFlagInput {account: string; txs: readonly TxFlagInput[]; mints: ReadonlyMap<string, AccountData | null>; reasons: readonly DappReauthReason[]}
  export interface FlaggedInstruction {index: number; program: ProgramKey; name: string | null}
  export interface AuthorityInstruction {index: number; program: ProgramKey; account: string; owned: 'token-account' | 'mint' | 'current-authority'; authorityType: string; newAuthority: string | null}
  export interface AuthorityChange {account: string; change: 'owner' | 'close-authority' | 'mint-authority' | 'freeze-authority'; from: string | null; to: string | null}
  export interface Approval {at: number | null; source: string; mint: string | null; symbol: WalletToken | null; decimals: number | null; delegate: string | null; amount: string; balance: string}
  export interface Token2022Settings {freezeAuthority: string | null; permanentDelegate: string | null; transferHookProgram: string | null}
  export type RedFlag =
    | {kind: 'unknown-program'; severity: 'warn'; word: null; at: number; programs: (string | null)[]}
    | {kind: 'non-transfer'; severity: 'warn'; word: null; at: number; instructions: FlaggedInstruction[]}
    | {kind: 'assign'; severity: 'block'; word: 'ASSIGN'; at: number | null; instructions: FlaggedInstruction[]; chain: {owner: string; space: number} | null}
    | {kind: 'set-authority'; severity: 'block'; word: 'AUTHORITY'; at: number | null; instructions: AuthorityInstruction[]; chain: AuthorityChange[]}
    | {kind: 'unlimited-approve'; severity: 'block'; word: string; at: number | null; approvals: Approval[]}
    | {kind: 'bounded-approve'; severity: 'warn'; word: null; at: number | null; approvals: Approval[]}
    | {kind: 'token-2022'; severity: 'warn'; word: null; at: number | null; mint: string; settings: Token2022Settings | null}   // settings null = Q36
    | {kind: 'durable-nonce'; severity: 'warn'; word: null; at: number}
    | {kind: 'whole-balance'; severity: 'warn'; word: null; at: null}
    | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; on: number};
  export type RedFlagKind = RedFlag['kind'];
  export type TxFlags = RedFlag[];
  export function flagMints(input: Pick<RedFlagInput, 'account' | 'txs'>): string[];
  export function redFlagsOf(input: RedFlagInput): TxFlags[];                       // index = transaction index
  export function expectedOverrides(flags: readonly (readonly RedFlag[])[]): {tx: number; word: string}[];
  export function overridesMatch(flags: readonly (readonly RedFlag[])[], given: readonly {tx: number; word: string}[]): 'ok' | 'missing' | 'mismatch';
  ```
  At most one flag per (transaction, kind), except `token-2022` (one per mint) — so `expectedOverrides` is one word per (transaction, block kind). `at` is the index of the first instruction a flag concerns, null for chain state and whole-transaction flags. Amounts are base-unit decimal strings. Each transaction's list is ordered: blocks, then warnings; within each by `at` (null last), then by the table's row, then as found.

The table is computed in one place, in the background, from what the simulation reads (spec §3.3: the window only renders it). `redFlagsOf` is pure: Task 3 gathers its input — per transaction the raw transaction and its decoded instructions, the pre-state it already reads immediately before that transaction's simulation (the wallet account and every writable account), the simulation's post-state for the same addresses, whether that transaction is a first send, and whether it simulated, failed, or depends on an earlier step (Task 3's attribution) — plus the mints `flagMints` names, read through the proxy, and the request's re-authentication reasons. Each block rule reads both the decoded instruction and chain state, because a dApp program can do by CPI what no top-level instruction names (B1c-2's fix round 1, I1). Token accounts and mints are read only through Task 1's parsers. `expectedOverrides` and `overridesMatch` are what Task 4's decide gate runs on the stored flags (C13: the background recomputes every word; the window's are only compared).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/dapp/__tests__/redFlags.test.ts`:

````ts
import {AddressLookupTableAccount, ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import type {AccountData} from '../../../../../core/solana/rpc';
import {BLOCKHASH, PUB, RECIPIENT} from '../../__tests__/fixtures';
import type {DappReauthReason} from '../../reauthPolicy';
import {ATA_PROGRAM, SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, decodeInstructions} from '../decode/decode';
import {resolveKeys} from '../decode/keys';
import {parseWire} from '../decode/wire';
import {expectedOverrides, flagMints, overridesMatch, redFlagsOf, type FlagOutcome, type RedFlag, type TxFlagInput} from '../redFlags';
import {
  FREEZER,
  HOOK_AUTHORITY,
  HOOK_PROGRAM,
  ISSUER,
  PERMANENT_DELEGATE,
  U64_MAX,
  keyOf,
  mintBytes,
  permanentDelegateExt,
  pyusdLikeMint,
  tokenAccountBytes,
  transferHookExt,
  usdcLikeMint,
} from './tokenBytes';

const ME = new PublicKey(PUB);
const ACCT = ME.toBase58();
const TO = new PublicKey(RECIPIENT);
const UNKNOWN = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const OTHER_PROGRAM = new PublicKey(keyOf(41));
const SRC = new PublicKey(keyOf(31));
const SRC2 = new PublicKey(keyOf(32));
const THEIRS = new PublicKey(keyOf(33));
const DELEGATE = new PublicKey(keyOf(34));
const T22_MINT = keyOf(35);
const ODD_MINT = keyOf(36);
const MINT_ACCT = new PublicKey(keyOf(37));
const SOL = 10_000_000_000n;

const u64 = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const meta = (pubkey: PublicKey, signer = false, writable = false) => ({pubkey, isSigner: signer, isWritable: writable});
const tokenIx = (data: number[], keys: ReturnType<typeof meta>[], program = TOKEN_PROGRAM) => new TransactionInstruction({programId: new PublicKey(program), data: Buffer.from(data), keys});
const transferIx = (amount: bigint, program = TOKEN_PROGRAM) => tokenIx([3, ...u64(amount)], [meta(SRC, false, true), meta(TO, false, true), meta(ME, true)], program);
const transferCheckedIx = (amount: bigint, mint: string, program = TOKEN_PROGRAM) =>
  tokenIx([12, ...u64(amount), 6], [meta(SRC, false, true), meta(new PublicKey(mint)), meta(TO, false, true), meta(ME, true)], program);
const approveIx = (amount: bigint, source = SRC, owner = ME, program = TOKEN_PROGRAM) => tokenIx([4, ...u64(amount)], [meta(source, false, true), meta(DELEGATE), meta(owner, true)], program);
const approveCheckedIx = (amount: bigint, mint: string, source = SRC) => tokenIx([13, ...u64(amount), 6], [meta(source, false, true), meta(new PublicKey(mint)), meta(DELEGATE), meta(ME, true)]);
/** SetAuthority: `type` 0 MintTokens, 1 FreezeAccount, 2 AccountOwner, 3 CloseAccount; the new authority TO. */
const setAuthorityIx = (account: PublicKey, current: PublicKey, type = 2) => tokenIx([6, type, 1, ...TO.toBytes()], [meta(account, false, true), meta(current, true)]);
const ataCreateIx = (mint: string) =>
  new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), data: Buffer.from([1]), keys: [meta(ME, true, true), meta(SRC2, false, true), meta(ME), meta(new PublicKey(mint)), meta(SystemProgram.programId), meta(new PublicKey(TOKEN_PROGRAM))]});
const unknownIx = (program = UNKNOWN, keys: PublicKey[] = [SRC]) => new TransactionInstruction({programId: program, data: Buffer.from([1]), keys: keys.map(k => meta(k, false, true))});

const plain = (lamports = SOL): AccountData => ({lamports, owner: SYSTEM_PROGRAM, data: new Uint8Array()});
const tokenAcc = (s: {mint: string; owner?: PublicKey; amount?: bigint; delegate?: PublicKey | null; delegatedAmount?: bigint; closeAuthority?: PublicKey | null}, program = TOKEN_PROGRAM): AccountData => ({
  lamports: 2_039_280n,
  owner: program,
  data: tokenAccountBytes({mint: s.mint, owner: (s.owner ?? ME).toBase58(), amount: s.amount ?? 0n, delegate: s.delegate?.toBase58() ?? null, delegatedAmount: s.delegatedAmount ?? 0n, closeAuthority: s.closeAuthority?.toBase58() ?? null}),
});
const mintAcc = (data: Uint8Array, owner = TOKEN_PROGRAM): AccountData => ({lamports: 1_461_600n, owner, data});
const USDC_MINT = mintAcc(usdcLikeMint());

interface Spec {
  ixs: TransactionInstruction[];
  tables?: AddressLookupTableAccount[];
  pre?: [PublicKey | string, AccountData | null][];
  /** The simulation's post-state (the wallet account plain unless given), or the outcome when it did not simulate. */
  post?: [PublicKey | string, AccountData | null][] | 'failed' | {dependentOn: number};
  firstSend?: boolean;
}
const addr = (k: PublicKey | string): string => (typeof k === 'string' ? k : k.toBase58());
function txOf(s: Spec): TxFlagInput {
  const bytes = new VersionedTransaction(new TransactionMessage({payerKey: ME, recentBlockhash: BLOCKHASH, instructions: s.ixs}).compileToV0Message(s.tables ?? [])).serialize();
  const tx = parseWire(bytes);
  if (tx === null) throw new Error('did not parse');
  const pre = new Map<string, AccountData | null>([[ACCT, plain()], ...(s.pre ?? []).map(([k, v]) => [addr(k), v] as const)]);
  const outcome: FlagOutcome =
    s.post === 'failed'
      ? {status: 'failed'}
      : s.post !== undefined && !Array.isArray(s.post)
        ? {status: 'dependent', on: s.post.dependentOn}
        : {status: 'simulated', post: new Map<string, AccountData | null>([[ACCT, plain(SOL - 5_000n)], ...(s.post ?? []).map(([k, v]) => [addr(k), v] as const)])};
  return {tx, decoded: decodeInstructions(tx, resolveKeys(tx, new Map())), pre, outcome, firstSend: s.firstSend ?? false};
}
function flagsOf(specs: Spec[], opts: {mints?: [string, AccountData | null][]; reasons?: DappReauthReason[]} = {}): RedFlag[][] {
  return redFlagsOf({account: ACCT, txs: specs.map(txOf), mints: new Map([[MAINNET_USDC_MINT, USDC_MINT], ...(opts.mints ?? [])]), reasons: opts.reasons ?? []});
}
const one = (spec: Spec, opts?: Parameters<typeof flagsOf>[1]): RedFlag[] => flagsOf([spec], opts)[0] ?? [];
const kinds = (flags: readonly RedFlag[]): string[] => flags.map(f => f.kind);
const find = <K extends RedFlag['kind']>(flags: readonly RedFlag[], kind: K): Extract<RedFlag, {kind: K}> | undefined => flags.find((f): f is Extract<RedFlag, {kind: K}> => f.kind === kind);

// B1c-3 (spec B1c §3.3 rev 3.6, B1 §3): the red-flag table, computed in the background, per transaction.
describe('redFlagsOf — F1 unknown program', () => {
  it('every unknown program of a transaction in one warning, each address once, anchored at the first', () => {
    const flags = one({ixs: [SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1}), unknownIx(), unknownIx(OTHER_PROGRAM), unknownIx()]});
    expect(flags).toEqual([{kind: 'unknown-program', severity: 'warn', word: null, at: 1, programs: [UNKNOWN.toBase58(), OTHER_PROGRAM.toBase58()]}]);
  });

  it('a known program whose data does not parse strictly, and an account no lookup table resolved, are unknown programs', () => {
    const trailing = tokenIx([3, ...u64(5n), 0], [meta(SRC, false, true), meta(TO, false, true), meta(ME, true)]);
    expect(one({ixs: [trailing]})).toEqual([{kind: 'unknown-program', severity: 'warn', word: null, at: 0, programs: [TOKEN_PROGRAM]}]);
    const table = new AddressLookupTableAccount({key: new PublicKey(keyOf(42)), state: {deactivationSlot: U64_MAX, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: [THEIRS]}});
    const viaTable = SystemProgram.transfer({fromPubkey: ME, toPubkey: THEIRS, lamports: 1});
    expect(one({ixs: [viaTable], tables: [table]})).toEqual([{kind: 'unknown-program', severity: 'warn', word: null, at: 0, programs: [SYSTEM_PROGRAM]}]);
    // Negative control: the same transfer without a table decodes, and is no flag.
    expect(one({ixs: [viaTable]})).toEqual([]);
  });
});

describe('redFlagsOf — F2 non-transfer', () => {
  it('every instruction of a decoded program that is not a transfer, named, in one warning — an unknown tag too', () => {
    const unknownTag = tokenIx([99], [meta(SRC, false, true)]);
    const transferWithSeed = SystemProgram.transfer({fromPubkey: SRC, basePubkey: ME, toPubkey: TO, lamports: 1, seed: 's', programId: SystemProgram.programId});
    const flags = one({ixs: [SystemProgram.assign({accountPubkey: THEIRS, programId: UNKNOWN}), ataCreateIx(MAINNET_USDC_MINT), unknownTag, transferWithSeed]});
    expect(find(flags, 'non-transfer')).toEqual({
      kind: 'non-transfer',
      severity: 'warn',
      word: null,
      at: 0,
      instructions: [
        {index: 0, program: 'system', name: 'assign'},
        {index: 1, program: 'associated-token', name: 'createIdempotent'},
        {index: 2, program: 'token', name: null},
        {index: 3, program: 'system', name: 'transferWithSeed'},
      ],
    });
  });

  it('never for Compute Budget (the fee) and never for System transfer, Token / Token-2022 transfer and transferChecked', () => {
    const ixs = [
      ComputeBudgetProgram.setComputeUnitLimit({units: 200_000}),
      ComputeBudgetProgram.setComputeUnitPrice({microLamports: 1_000}),
      SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1}),
      transferIx(5n),
      transferIx(5n, TOKEN_2022_PROGRAM),
      transferCheckedIx(5n, MAINNET_USDC_MINT),
    ];
    expect(one({ixs, pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 100n})]]})).toEqual([]);
    // Positive control: a revoke beside them is named.
    const revoke = tokenIx([5], [meta(SRC, false, true), meta(ME, true)]);
    expect(find(one({ixs: [...ixs, revoke]}), 'non-transfer')?.instructions).toEqual([{index: 6, program: 'token', name: 'revoke'}]);
  });
});

describe('redFlagsOf — F3 assign / allocate on the wallet account', () => {
  it('assign, allocate, assignWithSeed, allocateWithSeed of the wallet account: one block, ASSIGN, naming each', () => {
    const ixs = [
      SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN}),
      SystemProgram.allocate({accountPubkey: ME, space: 64}),
      SystemProgram.assign({accountPubkey: ME, basePubkey: SRC, seed: 'x', programId: UNKNOWN}),
      SystemProgram.allocate({accountPubkey: ME, basePubkey: SRC, seed: 'x', space: 64, programId: UNKNOWN}),
    ];
    const flags = one({ixs});
    expect(kinds(flags)).toEqual(['assign', 'non-transfer']);
    expect(find(flags, 'assign')).toEqual({
      kind: 'assign',
      severity: 'block',
      word: 'ASSIGN',
      at: 0,
      instructions: [
        {index: 0, program: 'system', name: 'assign'},
        {index: 1, program: 'system', name: 'allocate'},
        {index: 2, program: 'system', name: 'assignWithSeed'},
        {index: 3, program: 'system', name: 'allocateWithSeed'},
      ],
      chain: null,
    });
  });

  it('another account assigned or allocated is F2 only — the …WithSeed forms by their target, never their base', () => {
    for (const ix of [
      SystemProgram.assign({accountPubkey: THEIRS, programId: UNKNOWN}),
      SystemProgram.allocate({accountPubkey: THEIRS, space: 64}),
      SystemProgram.assign({accountPubkey: THEIRS, basePubkey: ME, seed: 'x', programId: UNKNOWN}),
      SystemProgram.allocate({accountPubkey: THEIRS, basePubkey: ME, seed: 'x', space: 64, programId: UNKNOWN}),
    ]) {
      expect(kinds(one({ixs: [ix]}))).toEqual(['non-transfer']);
    }
  });

  it('chain state: the wallet account owned by another program, or holding data, after the simulation — a CPI — is a block', () => {
    const assigned = one({ixs: [unknownIx()], post: [[ME, {lamports: SOL, owner: UNKNOWN.toBase58(), data: new Uint8Array()}]]});
    expect(find(assigned, 'assign')).toEqual({kind: 'assign', severity: 'block', word: 'ASSIGN', at: null, instructions: [], chain: {owner: UNKNOWN.toBase58(), space: 0}});
    const allocated = one({ixs: [unknownIx()], post: [[ME, {lamports: SOL, owner: SYSTEM_PROGRAM, data: new Uint8Array(100)}]]});
    expect(find(allocated, 'assign')?.chain).toEqual({owner: SYSTEM_PROGRAM, space: 100});
    // Negative controls: a plain wallet account after; and one already so before, which this transaction does not change.
    expect(kinds(one({ixs: [unknownIx()]}))).toEqual(['unknown-program']);
    const before: AccountData = {lamports: SOL, owner: UNKNOWN.toBase58(), data: new Uint8Array(8)};
    expect(kinds(one({ixs: [unknownIx()], pre: [[ME, before]], post: [[ME, before]]}))).toEqual(['unknown-program']);
  });
});

describe('redFlagsOf — F4 setAuthority on an account the user owns', () => {
  it('an own token account (its pre-state owner field is the wallet): a block, AUTHORITY', () => {
    const flags = one({ixs: [setAuthorityIx(SRC, ME, 3)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n})]]});
    expect(kinds(flags)).toEqual(['set-authority', 'non-transfer']);
    expect(find(flags, 'set-authority')).toEqual({
      kind: 'set-authority',
      severity: 'block',
      word: 'AUTHORITY',
      at: 0,
      instructions: [{index: 0, program: 'token', account: SRC.toBase58(), owned: 'token-account', authorityType: 'closeAccount', newAuthority: TO.toBase58()}],
      chain: [],
    });
    // Its owner field alone decides: a close authority the user once granted signing.
    expect(find(one({ixs: [setAuthorityIx(SRC, DELEGATE, 3)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n, closeAuthority: DELEGATE})]]}), 'set-authority')?.instructions[0]?.owned).toBe('token-account');
  });

  it('a mint whose mint or freeze authority is the wallet — even when someone else signs as its current authority', () => {
    const frozenByMe = mintAcc(mintBytes({mintAuthority: ISSUER, freezeAuthority: ACCT}));
    expect(find(one({ixs: [setAuthorityIx(MINT_ACCT, new PublicKey(ISSUER), 0)], pre: [[MINT_ACCT, frozenByMe]]}), 'set-authority')?.instructions).toEqual([
      {index: 0, program: 'token', account: MINT_ACCT.toBase58(), owned: 'mint', authorityType: 'mintTokens', newAuthority: TO.toBase58()},
    ]);
    const mintedByMe = mintAcc(mintBytes({mintAuthority: ACCT, freezeAuthority: FREEZER}));
    expect(find(one({ixs: [setAuthorityIx(MINT_ACCT, new PublicKey(FREEZER), 1)], pre: [[MINT_ACCT, mintedByMe]]}), 'set-authority')?.instructions[0]?.owned).toBe('mint');
  });

  it('the wallet signing as the current authority of an account it cannot read is a block too (fail closed)', () => {
    expect(find(one({ixs: [setAuthorityIx(THEIRS, ME)], pre: [[THEIRS, null]]}), 'set-authority')?.instructions[0]?.owned).toBe('current-authority');
  });

  it('someone else’s token account, or a mint of others, is F2 only', () => {
    expect(kinds(one({ixs: [setAuthorityIx(THEIRS, TO)], pre: [[THEIRS, tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n})]]}))).toEqual(['non-transfer']);
    expect(kinds(one({ixs: [setAuthorityIx(MINT_ACCT, new PublicKey(ISSUER), 0)], pre: [[MINT_ACCT, mintAcc(usdcLikeMint())]]}))).toEqual(['non-transfer']);
  });

  it('chain state (a CPI): an own account’s owner reassigned, its close authority changed, a mint authority of the wallet’s moved', () => {
    const mine = tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n});
    const reassigned = one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine]], post: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n})]]});
    expect(find(reassigned, 'set-authority')).toEqual({kind: 'set-authority', severity: 'block', word: 'AUTHORITY', at: null, instructions: [], chain: [{account: SRC.toBase58(), change: 'owner', from: ACCT, to: TO.toBase58()}]});
    const closer = one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine]], post: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n, closeAuthority: TO})]]});
    expect(find(closer, 'set-authority')?.chain).toEqual([{account: SRC.toBase58(), change: 'close-authority', from: null, to: TO.toBase58()}]);
    const mintMine = mintAcc(mintBytes({mintAuthority: ACCT, freezeAuthority: ACCT}));
    const moved = one({ixs: [unknownIx(UNKNOWN, [MINT_ACCT])], pre: [[MINT_ACCT, mintMine]], post: [[MINT_ACCT, mintAcc(mintBytes({mintAuthority: TO.toBase58(), freezeAuthority: null}))]]});
    expect(find(moved, 'set-authority')?.chain).toEqual([
      {account: MINT_ACCT.toBase58(), change: 'mint-authority', from: ACCT, to: TO.toBase58()},
      {account: MINT_ACCT.toBase58(), change: 'freeze-authority', from: ACCT, to: null},
    ]);
    // Negative controls: someone else's account changing hands; an own account left as it was.
    const theirs = tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n});
    expect(kinds(one({ixs: [unknownIx(UNKNOWN, [THEIRS])], pre: [[THEIRS, theirs]], post: [[THEIRS, tokenAcc({mint: MAINNET_USDC_MINT, owner: DELEGATE, amount: 5n, closeAuthority: DELEGATE})]]}))).toEqual(['unknown-program']);
    expect(kinds(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, mine]], post: [[SRC, mine]]}))).toEqual(['unknown-program']);
  });
});

describe('redFlagsOf — F5 unlimited approve, F6 bounded approve', () => {
  const held = (amount = 1_000n) => [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount})]] as [PublicKey, AccountData][];

  it('u64::MAX, or at least the source’s whole pre-state balance: a block whose word is the wallet’s own symbol', () => {
    const flags = one({ixs: [approveIx(U64_MAX)], pre: held()});
    expect(kinds(flags)).toEqual(['unlimited-approve', 'non-transfer']);
    expect(find(flags, 'unlimited-approve')).toEqual({
      kind: 'unlimited-approve',
      severity: 'block',
      word: 'USDC',
      at: 0,
      approvals: [{at: 0, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: U64_MAX.toString(), balance: '1000'}],
    });
    expect(find(one({ixs: [approveIx(1_000n)], pre: held()}), 'unlimited-approve')?.approvals[0]?.amount).toBe('1000');
    expect(find(one({ixs: [approveCheckedIx(5_000n, MAINNET_USDC_MINT)], pre: held()}), 'unlimited-approve')?.word).toBe('USDC');
  });

  it('balance − 1 is bounded: a warning, no block', () => {
    const flags = one({ixs: [approveIx(999n)], pre: held()});
    expect(kinds(flags)).toEqual(['non-transfer', 'bounded-approve']);
    expect(find(flags, 'bounded-approve')).toEqual({
      kind: 'bounded-approve',
      severity: 'warn',
      word: null,
      at: 0,
      approvals: [{at: 0, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: '999', balance: '1000'}],
    });
    expect(kinds(one({ixs: [approveCheckedIx(999n, MAINNET_USDC_MINT)], pre: held()}))).toEqual(['non-transfer', 'bounded-approve']);
  });

  it('a source the wallet cannot read, approved by the wallet, counts as an empty balance (fail closed)', () => {
    expect(kinds(one({ixs: [approveIx(1n)], pre: [[SRC, null]]}))).toEqual(['unlimited-approve', 'non-transfer']);
  });

  it('someone else’s account approved by its own owner is F2 only', () => {
    expect(kinds(one({ixs: [approveIx(U64_MAX, THEIRS, TO)], pre: [[THEIRS, tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n})]]}))).toEqual(['non-transfer']);
  });

  it('chain state (a CPI): an own account’s delegation new or raised to u64::MAX or its whole balance is a block; less is bounded', () => {
    const viaCpi = (delegatedAmount: bigint, pre = tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n})) =>
      one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, pre]], post: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate: DELEGATE, delegatedAmount})]]});
    expect(find(viaCpi(U64_MAX), 'unlimited-approve')).toEqual({
      kind: 'unlimited-approve',
      severity: 'block',
      word: 'USDC',
      at: null,
      approvals: [{at: null, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: U64_MAX.toString(), balance: '1000'}],
    });
    expect(kinds(viaCpi(1_000n))).toEqual(['unlimited-approve', 'unknown-program']);
    expect(kinds(viaCpi(999n))).toEqual(['unknown-program', 'bounded-approve']);
    // Negative control: a delegation already there, unchanged by this transaction.
    const already = tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate: DELEGATE, delegatedAmount: U64_MAX});
    expect(kinds(viaCpi(U64_MAX, already))).toEqual(['unknown-program']);
  });

  it('an approve seen both decoded and in chain state is listed once', () => {
    const post: [PublicKey, AccountData][] = [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate: DELEGATE, delegatedAmount: U64_MAX})]];
    expect(find(one({ixs: [approveIx(U64_MAX)], pre: held(), post}), 'unlimited-approve')?.approvals.map(a => a.at)).toEqual([0]);
  });

  it('the word: the wallet table’s symbol only when the mint’s decimals match it; else UNLIMITED — never a name the mint claims', () => {
    expect(find(one({ixs: [approveIx(U64_MAX)], pre: held()}, {mints: [[MAINNET_USDC_MINT, mintAcc(mintBytes({decimals: 9}))]]}), 'unlimited-approve')).toMatchObject({word: 'UNLIMITED', approvals: [{symbol: null, decimals: 9}]});
    expect(find(one({ixs: [approveIx(U64_MAX)], pre: held()}, {mints: [[MAINNET_USDC_MINT, null]]}), 'unlimited-approve')).toMatchObject({word: 'UNLIMITED', approvals: [{symbol: null, decimals: null}]});
    const claimsUsdc = mintAcc(mintBytes({decimals: 6, extensions: [{type: 19, value: Uint8Array.from('USDC', c => c.charCodeAt(0))}]}), TOKEN_2022_PROGRAM);
    const fake = [[SRC, tokenAcc({mint: ODD_MINT, amount: 1_000n}, TOKEN_2022_PROGRAM)]] as [PublicKey, AccountData][];
    expect(find(one({ixs: [approveIx(U64_MAX, SRC, ME, TOKEN_2022_PROGRAM)], pre: fake}, {mints: [[ODD_MINT, claimsUsdc]]}), 'unlimited-approve')).toMatchObject({word: 'UNLIMITED', approvals: [{mint: ODD_MINT, symbol: null, decimals: 6}]});
  });

  it('one word per transaction: one symbol for every unlimited approval, else UNLIMITED', () => {
    const both = [
      [SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 10n})],
      [SRC2, tokenAcc({mint: MAINNET_USDT_MINT, amount: 10n})],
    ] as [PublicKey, AccountData][];
    const usdt = mintAcc(mintBytes({decimals: 6}));
    expect(find(one({ixs: [approveIx(U64_MAX), approveIx(U64_MAX, SRC2)], pre: both}, {mints: [[MAINNET_USDT_MINT, usdt]]}), 'unlimited-approve')?.word).toBe('UNLIMITED');
    expect(find(one({ixs: [approveIx(U64_MAX), approveIx(10n)], pre: both}), 'unlimited-approve')?.word).toBe('USDC');
  });
});

describe('redFlagsOf — F7 Token-2022 mint settings', () => {
  const holding = (mint: string) => [[SRC, tokenAcc({mint, amount: 5n}, TOKEN_2022_PROGRAM)]] as [PublicKey, AccountData][];

  it('a Token-2022 mint of an own account: its freeze authority, permanent delegate and transfer hook, named', () => {
    const flags = one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints: [[T22_MINT, mintAcc(pyusdLikeMint(), TOKEN_2022_PROGRAM)]]});
    expect(find(flags, 'token-2022')).toEqual({kind: 'token-2022', severity: 'warn', word: null, at: null, mint: T22_MINT, settings: {freezeAuthority: FREEZER, permanentDelegate: PERMANENT_DELEGATE, transferHookProgram: null}});
    const hooked = mintAcc(mintBytes({extensions: [transferHookExt(HOOK_AUTHORITY, HOOK_PROGRAM)]}), TOKEN_2022_PROGRAM);
    expect(find(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints: [[T22_MINT, hooked]]}), 'token-2022')?.settings).toEqual({freezeAuthority: null, permanentDelegate: null, transferHookProgram: HOOK_PROGRAM});
  });

  it('no flag: a Token-2022 mint whose delegate is the zero key and with no freeze authority or hook; a classic mint with a freeze authority', () => {
    const zero = mintAcc(mintBytes({mintAuthority: ISSUER, extensions: [permanentDelegateExt(null), transferHookExt(HOOK_AUTHORITY, null)]}), TOKEN_2022_PROGRAM);
    expect(kinds(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints: [[T22_MINT, zero]]}))).toEqual(['unknown-program']);
    expect(kinds(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n})]]}))).toEqual(['unknown-program']);
    // Positive control: the same Token-2022 mint with a real delegate key.
    const real = mintAcc(mintBytes({mintAuthority: ISSUER, extensions: [permanentDelegateExt(PERMANENT_DELEGATE)]}), TOKEN_2022_PROGRAM);
    expect(find(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints: [[T22_MINT, real]]}), 'token-2022')?.settings).toMatchObject({permanentDelegate: PERMANENT_DELEGATE});
  });

  it('a mint that cannot be read — not read at all, absent, another owner, Token-2022 bytes that do not parse — warns (Q36)', () => {
    const unreadable = (mints: [string, AccountData | null][]) => find(one({ixs: [unknownIx(UNKNOWN, [SRC])], pre: holding(T22_MINT)}, {mints}), 'token-2022');
    const q36 = {kind: 'token-2022', severity: 'warn', word: null, at: null, mint: T22_MINT, settings: null};
    expect(unreadable([])).toEqual(q36);
    expect(unreadable([[T22_MINT, null]])).toEqual(q36);
    expect(unreadable([[T22_MINT, mintAcc(pyusdLikeMint(), UNKNOWN.toBase58())]])).toEqual(q36);
    expect(unreadable([[T22_MINT, mintAcc(mintBytes({extensions: [{...permanentDelegateExt(PERMANENT_DELEGATE), length: 40}]}), TOKEN_2022_PROGRAM)]])).toEqual(q36);
  });

  it('the mints: own token accounts pre and post, and every mint a decoded token or ATA instruction names — not someone else’s account', () => {
    const t22Post = [[SRC2, tokenAcc({mint: ODD_MINT, amount: 1n}, TOKEN_2022_PROGRAM)]] as [PublicKey, AccountData][];
    const theirs = [[THEIRS, tokenAcc({mint: keyOf(43), owner: TO, amount: 1n}, TOKEN_2022_PROGRAM)]] as [PublicKey, AccountData][];
    const spec: Spec = {ixs: [transferCheckedIx(1n, T22_MINT, TOKEN_2022_PROGRAM), ataCreateIx(keyOf(44))], pre: [...holding(MAINNET_USDC_MINT), ...theirs], post: [...t22Post, ...theirs]};
    expect(flagMints({account: ACCT, txs: [txOf(spec)]})).toEqual([T22_MINT, keyOf(44), MAINNET_USDC_MINT, ODD_MINT]);
    const flags = one(spec);
    expect(flags.filter(f => f.kind === 'token-2022').map(f => [f.at, f.kind === 'token-2022' ? f.mint : null])).toEqual([
      [0, T22_MINT],
      [1, keyOf(44)],
      [null, ODD_MINT],
    ]);
  });
});

describe('redFlagsOf — F8 durable nonce, F9 whole balance, F10 dependent step', () => {
  it('AdvanceNonceAccount first: "does not expire" (and it is named among the non-transfers); at index 1 it is F2 only', () => {
    const nonce = SystemProgram.nonceAdvance({noncePubkey: SRC, authorizedPubkey: ME});
    const transfer = SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1});
    expect(one({ixs: [nonce, transfer]})).toEqual([
      {kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'system', name: 'advanceNonceAccount'}]},
      {kind: 'durable-nonce', severity: 'warn', word: null, at: 0},
    ]);
    expect(kinds(one({ixs: [transfer, nonce]}))).toEqual(['non-transfer']);
  });

  it('whole balance to a first-time address: on each transaction that sends to one, when the request has the reason', () => {
    const transfer = SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1});
    const reasons: DappReauthReason[] = ['first-send', 'whole-balance-to-new'];
    expect(flagsOf([{ixs: [transfer], firstSend: true}, {ixs: [transfer]}], {reasons})).toEqual([[{kind: 'whole-balance', severity: 'warn', word: null, at: null}], []]);
    expect(flagsOf([{ixs: [transfer], firstSend: true}], {reasons: ['first-send']})).toEqual([[]]);
  });

  it('a step that depends on an earlier one: a block, UNCHECKED; any other failure is no flag (Reject only) — decoded flags stay', () => {
    const assign = SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN});
    expect(one({ixs: [transferIx(1n)], post: {dependentOn: 0}})).toEqual([{kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, on: 0}]);
    expect(one({ixs: [transferIx(1n)], post: 'failed'})).toEqual([]);
    expect(kinds(one({ixs: [assign], post: 'failed'}))).toEqual(['assign', 'non-transfer']);
    // A failed step has no post-state: chain-state rules read nothing (the wallet's plain post is not consulted).
    expect(kinds(one({ixs: [unknownIx()], pre: [[ME, {lamports: SOL, owner: UNKNOWN.toBase58(), data: new Uint8Array(4)}]], post: 'failed'}))).toEqual(['unknown-program']);
  });
});

describe('redFlagsOf — the order', () => {
  it('blocks first, then warnings; within each by instruction index (chain state and whole-transaction flags after), then by row', () => {
    const nonce = SystemProgram.nonceAdvance({noncePubkey: SRC2, authorizedPubkey: ME});
    const flags = one(
      {ixs: [nonce, SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN}), unknownIx(), approveIx(U64_MAX)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1n})]], post: {dependentOn: 0}, firstSend: true},
      {reasons: ['whole-balance-to-new']},
    );
    expect(flags.map(f => [f.kind, f.at])).toEqual([
      ['assign', 1],
      ['unlimited-approve', 3],
      ['dependent', null],
      ['non-transfer', 0],
      ['durable-nonce', 0],
      ['unknown-program', 2],
      ['whole-balance', null],
    ]);
  });
});

describe('expectedOverrides / overridesMatch', () => {
  const batch = (): RedFlag[][] =>
    flagsOf([
      {ixs: [SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN}), approveIx(U64_MAX)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1n})]]},
      {ixs: [approveIx(1n)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 9n})]]},
      {ixs: [transferIx(1n)], post: {dependentOn: 1}},
    ]);
  const expected = [
    {tx: 0, word: 'ASSIGN'},
    {tx: 0, word: 'USDC'},
    {tx: 2, word: 'UNCHECKED'},
  ];

  it('one word per (transaction, block kind), in order; none for warnings', () => {
    expect(expectedOverrides(batch())).toEqual(expected);
    expect(expectedOverrides(flagsOf([{ixs: [approveIx(1n)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 9n})]]}]))).toEqual([]);
  });

  it('ok only for exactly the expected words, in any order; missing when some are absent; mismatch for anything else', () => {
    expect(overridesMatch(batch(), expected)).toBe('ok');
    expect(overridesMatch(batch(), [...expected].reverse())).toBe('ok');
    expect(overridesMatch([[], []], [])).toBe('ok');
    expect(overridesMatch(batch(), expected.slice(1))).toBe('missing');
    expect(overridesMatch(batch(), [])).toBe('missing');
    expect(overridesMatch(batch(), [{tx: 0, word: 'ASSIGN'}, {tx: 0, word: 'usdc'}, {tx: 2, word: 'UNCHECKED'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [{tx: 0, word: 'ASSIGN '}, {tx: 0, word: 'USDC'}, {tx: 2, word: 'UNCHECKED'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [...expected, {tx: 1, word: 'USDC'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [...expected, {tx: 0, word: 'ASSIGN'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [{tx: 1, word: 'ASSIGN'}, {tx: 0, word: 'USDC'}, {tx: 2, word: 'UNCHECKED'}])).toBe('mismatch');
    expect(overridesMatch(batch(), [{tx: 0, word: 'USDC'}, {tx: 0, word: 'USDC'}, {tx: 2, word: 'UNCHECKED'}])).toBe('mismatch');
    expect(overridesMatch([[], []], [{tx: 0, word: 'ASSIGN'}])).toBe('mismatch');
  });
});
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/background/dapp/__tests__/redFlags.test.ts`

Expected (the dry run): Test Files  1 failed (1) · Tests  no tests — `Error: Cannot find module '../redFlags' imported from …/redFlags.test.ts`.

- [ ] **Step 3: Implement.**

Create `extension/src/background/dapp/redFlags.ts`:

````ts
import {tokenForMint, WALLET_TOKENS, type WalletToken} from '../../../../core/solana/balances';
import type {AccountData} from '../../../../core/solana/rpc';
import type {DappReauthReason} from '../reauthPolicy';
import {SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, type DecodedInstruction, type ProgramKey} from './decode/decode';
import type {ParsedTx} from './decode/wire';
import {mintInfo, tokenAccountInfo, type TokenAccountInfo} from './tokenState';
import {usesDurableNonce} from './txRequest';

/**
 * The red flags (spec B1c §3.3 rev 3.6, B1 §3's table): per transaction of a request, from its decoded instructions,
 * the pre-state read immediately before its simulation, the simulation's post-state, and the mints read through the
 * proxy. Pure — the simulation (Task 3) gathers the reads and stores the result; the window only renders it (C13).
 *
 * F1 unknown program (warn) · F2 an instruction of a decoded program that is not a transfer (warn; Compute Budget is
 * the fee — the only exemption) · F3 System assign / allocate (and their …WithSeed forms) of the wallet account, or the
 * wallet account owned by another program or holding data after the simulation (block, ASSIGN) · F4 SetAuthority on a
 * token account whose owner field is the wallet, on a mint whose mint or freeze authority is the wallet, or signed by
 * the wallet as the current authority; or, in chain state, an own token account's owner or close authority changed, a
 * mint authority of the wallet's moved (block, AUTHORITY) · F5 an approve of u64::MAX or at least the source's whole
 * balance, decoded or in chain state (block, the wallet's own symbol or UNLIMITED) · F6 any other approve (warn) · F7 a
 * Token-2022 mint's freeze authority, permanent delegate or transfer hook, or a mint that cannot be read (warn; a
 * classic mint never, O3) · F8 a durable nonce (warn) · F9 the whole balance to a first-time address (warn) · F10 a
 * step that depends on an earlier one (block, UNCHECKED). F11 (origin mismatch) is B1c-1/2's and never reaches here.
 */
export const OVERRIDE_WORDS = {assign: 'ASSIGN', setAuthority: 'AUTHORITY', unlimited: 'UNLIMITED', dependent: 'UNCHECKED'} as const;

/** What the simulation says of one transaction: its post-state by address, a failure, or that it depends on transaction `on` (0-based). */
export type FlagOutcome = {status: 'simulated'; post: ReadonlyMap<string, AccountData | null>} | {status: 'failed'} | {status: 'dependent'; on: number};

export interface TxFlagInput {
  tx: ParsedTx;
  decoded: readonly DecodedInstruction[];
  /** The wallet account and every writable account, read immediately before this transaction's simulation; null: absent. */
  pre: ReadonlyMap<string, AccountData | null>;
  outcome: FlagOutcome;
  /** Whether a decoded transfer of this transaction sends to a first-time address (B1b's first-send rule). */
  firstSend: boolean;
}

export interface RedFlagInput {
  account: string;
  txs: readonly TxFlagInput[];
  /** Every mint `flagMints` names, as read; a mint not in the map, or null, could not be read. */
  mints: ReadonlyMap<string, AccountData | null>;
  /** The request's re-authentication reasons (B1b's rules over the whole batch). */
  reasons: readonly DappReauthReason[];
}

export interface FlaggedInstruction {
  index: number;
  program: ProgramKey;
  name: string | null;
}
export interface AuthorityInstruction {
  index: number;
  program: ProgramKey;
  account: string;
  /** Why the account is the user's: a token account's owner field, a mint's mint or freeze authority, or the wallet signing as its current authority. */
  owned: 'token-account' | 'mint' | 'current-authority';
  authorityType: string;
  newAuthority: string | null;
}
export interface AuthorityChange {
  account: string;
  change: 'owner' | 'close-authority' | 'mint-authority' | 'freeze-authority';
  from: string | null;
  to: string | null;
}
export interface Approval {
  /** The approving instruction's index; null when it is seen only in chain state (a CPI). */
  at: number | null;
  source: string;
  mint: string | null;
  /** The wallet's own symbol for the mint, only when the mint's decimals match the wallet's table. */
  symbol: WalletToken | null;
  decimals: number | null;
  delegate: string | null;
  /** Base units, decimal strings. */
  amount: string;
  balance: string;
}
export interface Token2022Settings {
  freezeAuthority: string | null;
  permanentDelegate: string | null;
  transferHookProgram: string | null;
}

/** `at`: the index of the first instruction the flag concerns; null for chain state and the whole transaction. */
export type RedFlag =
  | {kind: 'unknown-program'; severity: 'warn'; word: null; at: number; programs: (string | null)[]}
  | {kind: 'non-transfer'; severity: 'warn'; word: null; at: number; instructions: FlaggedInstruction[]}
  | {kind: 'assign'; severity: 'block'; word: 'ASSIGN'; at: number | null; instructions: FlaggedInstruction[]; chain: {owner: string; space: number} | null}
  | {kind: 'set-authority'; severity: 'block'; word: 'AUTHORITY'; at: number | null; instructions: AuthorityInstruction[]; chain: AuthorityChange[]}
  | {kind: 'unlimited-approve'; severity: 'block'; word: string; at: number | null; approvals: Approval[]}
  | {kind: 'bounded-approve'; severity: 'warn'; word: null; at: number | null; approvals: Approval[]}
  /** settings null: the mint could not be read (Q36). */
  | {kind: 'token-2022'; severity: 'warn'; word: null; at: number | null; mint: string; settings: Token2022Settings | null}
  | {kind: 'durable-nonce'; severity: 'warn'; word: null; at: number}
  | {kind: 'whole-balance'; severity: 'warn'; word: null; at: null}
  | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; on: number};
export type RedFlagKind = RedFlag['kind'];
export type TxFlags = RedFlag[];

const KIND_ORDER: readonly RedFlagKind[] = ['unknown-program', 'non-transfer', 'assign', 'set-authority', 'unlimited-approve', 'bounded-approve', 'token-2022', 'durable-nonce', 'whole-balance', 'dependent'];
const ASSIGNS: readonly string[] = ['assign', 'allocate', 'assignWithSeed', 'allocateWithSeed'];

const isToken = (ix: DecodedInstruction): boolean => ix.program === 'token' || ix.program === 'token-2022';
const isTransfer = (ix: DecodedInstruction): boolean => (ix.program === 'system' && ix.name === 'transfer') || (isToken(ix) && (ix.name === 'transfer' || ix.name === 'transferChecked'));
const tokenOf = (a: AccountData | null | undefined): TokenAccountInfo | null => (a === null || a === undefined ? null : tokenAccountInfo(a.data, a.owner));
const plainAccount = (a: AccountData): boolean => a.owner === SYSTEM_PROGRAM && a.data.length === 0;

/** Every mint F5's word and F7 read: those a decoded token or ATA instruction names, then those of the wallet's own token accounts, pre and post. */
export function flagMints(input: Pick<RedFlagInput, 'account' | 'txs'>): string[] {
  return [...new Set(input.txs.flatMap(t => [...mintsOf(input.account, t).keys()]))];
}

function mintsOf(account: string, t: TxFlagInput): Map<string, number | null> {
  const out = new Map<string, number | null>();
  t.decoded.forEach((ix, index) => {
    const mint = isToken(ix) || ix.program === 'associated-token' ? addressField(ix, 'mint') : null;
    if (mint !== null && !out.has(mint)) out.set(mint, index);
  });
  const states = t.outcome.status === 'simulated' ? [t.pre, t.outcome.post] : [t.pre];
  for (const m of states) {
    for (const a of m.values()) {
      const own = tokenOf(a);
      if (own !== null && own.owner === account && !out.has(own.mint)) out.set(own.mint, null);
    }
  }
  return out;
}

/** The flags of every transaction of the request, each list in the order the window shows them. */
export function redFlagsOf(input: RedFlagInput): TxFlags[] {
  return input.txs.map(t => ordered(txFlags(input, t)));
}

function ordered(flags: RedFlag[]): RedFlag[] {
  const at = (f: RedFlag): number => f.at ?? Number.MAX_SAFE_INTEGER;
  return flags
    .map((f, i) => ({f, i}))
    .sort((x, y) => (x.f.severity === y.f.severity ? 0 : x.f.severity === 'block' ? -1 : 1) || at(x.f) - at(y.f) || KIND_ORDER.indexOf(x.f.kind) - KIND_ORDER.indexOf(y.f.kind) || x.i - y.i)
    .map(x => x.f);
}

function txFlags(input: RedFlagInput, t: TxFlagInput): RedFlag[] {
  const {account, mints} = input;
  const {decoded, pre} = t;
  const post = t.outcome.status === 'simulated' ? t.outcome.post : null;
  const out: RedFlag[] = [];
  const indexed = decoded.map((ix, index) => ({ix, index}));

  // F1
  const unknown = indexed.filter(x => x.ix.program === null);
  const first = unknown[0];
  if (first !== undefined) out.push({kind: 'unknown-program', severity: 'warn', word: null, at: first.index, programs: [...new Set(unknown.map(x => x.ix.programId))]});

  // F2
  const named = indexed.flatMap(({ix, index}) => (ix.program === null || ix.program === 'compute-budget' || isTransfer(ix) ? [] : [{index, program: ix.program, name: ix.name}]));
  const firstNamed = named[0];
  if (firstNamed !== undefined) out.push({kind: 'non-transfer', severity: 'warn', word: null, at: firstNamed.index, instructions: named});

  // F3
  const assigns = indexed.flatMap(({ix, index}) => (ix.program === 'system' && ix.name !== null && ASSIGNS.includes(ix.name) && addressField(ix, 'account') === account ? [{index, program: ix.program, name: ix.name}] : []));
  const selfPre = pre.get(account) ?? null;
  const selfPost = post?.get(account) ?? null;
  const assignedChain =
    selfPost !== null && !plainAccount(selfPost) && (selfPre === null || selfPre.owner !== selfPost.owner || selfPre.data.length !== selfPost.data.length) ? {owner: selfPost.owner, space: selfPost.data.length} : null;
  if (assigns.length > 0 || assignedChain !== null) out.push({kind: 'assign', severity: 'block', word: OVERRIDE_WORDS.assign, at: assigns[0]?.index ?? null, instructions: assigns, chain: assignedChain});

  // F4
  const authorities: AuthorityInstruction[] = [];
  for (const {ix, index} of indexed) {
    if (!isToken(ix) || ix.name !== 'setAuthority' || ix.program === null) continue;
    const target = addressField(ix, 'account');
    if (target === null) continue;
    const state = pre.get(target) ?? mints.get(target) ?? null;
    const asAccount = tokenOf(state);
    const asMint = state === null ? null : mintInfo(state.data, state.owner);
    const owned =
      asAccount?.owner === account ? 'token-account' : asMint !== null && (asMint.mintAuthority === account || asMint.freezeAuthority === account) ? 'mint' : addressField(ix, 'currentAuthority') === account ? 'current-authority' : null;
    if (owned === null) continue;
    const type = ix.fields.find(f => f.name === 'authorityType')?.value;
    authorities.push({index, program: ix.program, account: target, owned, authorityType: type?.kind === 'text' ? type.value : '', newAuthority: addressField(ix, 'newAuthority')});
  }
  const changes: AuthorityChange[] = [];
  for (const [address, after] of post ?? []) {
    if (address === account) continue;
    const before = pre.get(address) ?? null;
    const preToken = tokenOf(before);
    const preOwn = preToken?.owner === account ? preToken : null;
    const postToken = tokenOf(after);
    if (preOwn !== null && postToken !== null && postToken.owner !== account) changes.push({account: address, change: 'owner', from: account, to: postToken.owner});
    if (postToken !== null && postToken.owner === account && postToken.closeAuthority !== (preOwn?.closeAuthority ?? null)) {
      changes.push({account: address, change: 'close-authority', from: preOwn?.closeAuthority ?? null, to: postToken.closeAuthority});
    }
    const preMint = before === null ? null : mintInfo(before.data, before.owner);
    const postMint = after === null ? null : mintInfo(after.data, after.owner);
    if (preMint !== null && postMint !== null) {
      if (preMint.mintAuthority === account && postMint.mintAuthority !== account) changes.push({account: address, change: 'mint-authority', from: account, to: postMint.mintAuthority});
      if (preMint.freezeAuthority === account && postMint.freezeAuthority !== account) changes.push({account: address, change: 'freeze-authority', from: account, to: postMint.freezeAuthority});
    }
  }
  if (authorities.length > 0 || changes.length > 0) out.push({kind: 'set-authority', severity: 'block', word: OVERRIDE_WORDS.setAuthority, at: authorities[0]?.index ?? null, instructions: authorities, chain: changes});

  // F5, F6
  const decimalsOf = (mint: string | null): number | null => {
    const a = mint === null ? null : (mints.get(mint) ?? null);
    return a === null ? null : (mintInfo(a.data, a.owner)?.decimals ?? null);
  };
  const symbolOf = (mint: string | null, decimals: number | null): WalletToken | null => {
    const candidate = mint === null ? null : tokenForMint(mint);
    return candidate !== null && decimals === WALLET_TOKENS[candidate].decimals ? candidate : null;
  };
  // Unlimited: at least the source's whole balance before — u64::MAX always is.
  const found: {approval: Approval; unlimited: boolean}[] = [];
  const approval = (at: number | null, source: string, mint: string | null, delegate: string | null, amount: bigint, balance: bigint) => {
    const decimals = decimalsOf(mint);
    found.push({approval: {at, source, mint, symbol: symbolOf(mint, decimals), decimals, delegate, amount: amount.toString(), balance: balance.toString()}, unlimited: amount >= balance});
  };
  for (const {ix, index} of indexed) {
    if (!isToken(ix) || (ix.name !== 'approve' && ix.name !== 'approveChecked')) continue;
    const source = addressField(ix, 'source');
    const value = ix.fields.find(f => f.name === 'amount')?.value;
    if (source === null || value?.kind !== 'amount') continue;
    const src = tokenOf(pre.get(source));
    const own = src !== null && src.owner === account;
    if (!own && addressField(ix, 'owner') !== account) continue;
    approval(index, source, src?.mint ?? addressField(ix, 'mint'), addressField(ix, 'delegate'), BigInt(value.value), own ? src.amount : 0n);
  }
  for (const [address, after] of post ?? []) {
    const postToken = tokenOf(after);
    if (postToken === null || postToken.owner !== account || postToken.delegate === null) continue;
    const preToken = tokenOf(pre.get(address));
    const preOwn = preToken?.owner === account ? preToken : null;
    if (postToken.delegate === (preOwn?.delegate ?? null) && postToken.delegatedAmount <= (preOwn?.delegatedAmount ?? 0n)) continue;
    approval(null, address, postToken.mint, postToken.delegate, postToken.delegatedAmount, preOwn?.amount ?? 0n);
  }
  const approvals = found.filter(x => x.approval.at !== null || !found.some(y => y.approval.at !== null && y.approval.source === x.approval.source && y.unlimited === x.unlimited));
  const unlimited = approvals.filter(x => x.unlimited).map(x => x.approval);
  const unlimitedSources = new Set(unlimited.map(a => a.source));
  const bounded = approvals.filter(x => !x.unlimited && !unlimitedSources.has(x.approval.source)).map(x => x.approval);
  if (unlimited.length > 0) {
    const symbols = [...new Set(unlimited.map(a => a.symbol))];
    const only = symbols.length === 1 ? symbols[0] : null;
    out.push({kind: 'unlimited-approve', severity: 'block', word: only ?? OVERRIDE_WORDS.unlimited, at: unlimited.find(a => a.at !== null)?.at ?? null, approvals: unlimited});
  }
  if (bounded.length > 0) out.push({kind: 'bounded-approve', severity: 'warn', word: null, at: bounded.find(a => a.at !== null)?.at ?? null, approvals: bounded});

  // F7
  for (const [mint, at] of mintsOf(account, t)) {
    const a = mints.get(mint) ?? null;
    if (a !== null && a.owner === TOKEN_PROGRAM) continue;
    const info = a !== null && a.owner === TOKEN_2022_PROGRAM ? mintInfo(a.data, a.owner) : null;
    if (info === null) {
      out.push({kind: 'token-2022', severity: 'warn', word: null, at, mint, settings: null});
    } else if (info.freezeAuthority !== null || info.permanentDelegate !== null || info.transferHookProgram !== null) {
      out.push({kind: 'token-2022', severity: 'warn', word: null, at, mint, settings: {freezeAuthority: info.freezeAuthority, permanentDelegate: info.permanentDelegate, transferHookProgram: info.transferHookProgram}});
    }
  }

  // F8, F9, F10
  if (usesDurableNonce(t.tx)) out.push({kind: 'durable-nonce', severity: 'warn', word: null, at: 0});
  if (t.firstSend && input.reasons.includes('whole-balance-to-new')) out.push({kind: 'whole-balance', severity: 'warn', word: null, at: null});
  if (t.outcome.status === 'dependent') out.push({kind: 'dependent', severity: 'block', word: OVERRIDE_WORDS.dependent, at: null, on: t.outcome.on});
  return out;
}

/** The words the user must type: one per (transaction, block kind), in the transactions' order and each one's flag order. */
export function expectedOverrides(flags: readonly (readonly RedFlag[])[]): {tx: number; word: string}[] {
  return flags.flatMap((list, tx) => list.flatMap(f => (f.severity === 'block' ? [{tx, word: f.word}] : [])));
}

/**
 * Whether the words the window sent are exactly the expected ones (exact, case-sensitive): `ok`; `missing` when some
 * expected word was not given and nothing else is wrong; `mismatch` for any entry not expected, or one given twice.
 */
export function overridesMatch(flags: readonly (readonly RedFlag[])[], given: readonly {tx: number; word: string}[]): 'ok' | 'missing' | 'mismatch' {
  const key = (o: {tx: number; word: string}): string => JSON.stringify([o.tx, o.word]);
  const expected = new Set(expectedOverrides(flags).map(key));
  const seen = new Set<string>();
  for (const g of given) {
    const k = key(g);
    if (!expected.has(k) || seen.has(k)) return 'mismatch';
    seen.add(k);
  }
  return seen.size === expected.size ? 'ok' : 'missing';
}
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run src/background/dapp/__tests__/redFlags.test.ts` — expected: Test Files  1 passed (1) · Tests  30 passed (30)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  169 passed (169) · Tests  3352 passed (3352) (Task 1's end state: 168 files, 3322 tests). `node scripts/build.mjs && npm run gates` — expected: every gate ok (permissions, page bundles, vault isolation, rpc methods, no TGE date, fonts, classes). Nothing imports `redFlags.ts` yet (Task 3 does), so the bundles are unchanged. Nothing touches the repository root's `src/` or `core/`.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

Every mutation is in `extension/src/background/dapp/redFlags.ts`; every named test is in `redFlags.test.ts`. Each block rule is dropped once (M2a, M2b, M2e–M2k, M2m, M2s), the F5 word's three rules once each (M2p, M2q, M2r), and the override check's three refusals once each (M2ac–M2ae).

| id | the change | named test → observed (`tsc` exit, then the named test file) |
|---|---|---|
| M2a | F3 decoded dropped: `if (assigns.length > 0 \|\| assignedChain !== null)` → `if (assignedChain !== null)` | “assign, allocate, assignWithSeed, allocateWithSeed of the wallet ac…”; “a step that depends on an earlier one: a block, UNCHECKED; any othe…”; “blocks first, then warnings; within each by instruction index (chai…”; … — tsc 0 · RED Tests  5 failed \| 25 passed (30) |
| M2b | F3 chain dropped: `if (assigns.length > 0 \|\| assignedChain !== null)` → `if (assigns.length > 0)` | “chain state: the wallet account owned by another program, or holdin…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2c | F3 chain: any non-plain post, changed or not: `(selfPre === null \|\| selfPre.owner !== selfPost.owner \|\| selfPre.data.length !== selfPost.data.length)` → `(selfPre === null \|\| selfPre.owner !== selfPost.owner \|\| selfPre.data.length !== selfPost.data.length \|\| selfPre !== null)` | “chain state: the wallet account owned by another program, or holdin…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2d | F3 by base, not target: `ASSIGNS.includes(ix.name) && addressField(ix, 'account') === account` → `ASSIGNS.includes(ix.name) && (addressField(ix, 'base') ?? addressField(ix, 'account')) === account` | “assign, allocate, assignWithSeed, allocateWithSeed of the wallet ac…”; “another account assigned or allocated is F2 only — the …WithSeed fo…” — tsc 0 · RED Tests  2 failed \| 28 passed (30) |
| M2e | F4 own token account dropped: `asAccount?.owner === account ? 'token-account' :` → `asAccount?.owner === '' ? 'token-account' :` | “an own token account (its pre-state owner field is the wallet): a b…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2f | F4 mint authorities dropped: `asMint !== null && (asMint.mintAuthority === account \|\| asMint.freezeAuthority === account)` → `asMint !== null && asMint.decimals < 0 && (asMint.mintAuthority === account \|\| asMint.freezeAuthority === account)` | “a mint whose mint or freeze authority is the wallet — even when som…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2g | F4 current authority dropped: `addressField(ix, 'currentAuthority') === account ? 'current-authority' : null` → `addressField(ix, 'currentAuthority') === '' ? 'current-authority' : null` | “the wallet signing as the current authority of an account it cannot…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2h | F4 chain owner reassigned dropped: `if (preOwn !== null && postToken !== null && postToken.owner !== account) changes` → `if (preOwn !== null && postToken !== null && postToken.owner === '') changes` | “chain state (a CPI): an own account’s owner reassigned, its close a…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2i | F4 chain close authority dropped: `postToken.closeAuthority !== (preOwn?.closeAuthority ?? null)) {` → `postToken.closeAuthority !== (preOwn?.closeAuthority ?? null) && address === '') {` | “chain state (a CPI): an own account’s owner reassigned, its close a…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2j | F4 chain mint authority dropped: `if (preMint !== null && postMint !== null) {` → `if (preMint !== null && postMint !== null && address === '') {` | “chain state (a CPI): an own account’s owner reassigned, its close a…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2k | F5 decoded approves dropped: `(ix.name !== 'approve' && ix.name !== 'approveChecked')) continue;` → `(ix.name !== 'approve-' && ix.name !== 'approveChecked-')) continue;` | “u64::MAX, or at least the source’s whole pre-state balance: a block…”; “balance − 1 is bounded: a warning, no block”; “a source the wallet cannot read, approved by the wallet, counts as …”; … — tsc 0 · RED Tests  9 failed \| 21 passed (30) |
| M2l | F5 whole balance strictly above (>=  ->  >): `unlimited: amount >= balance});` → `unlimited: amount > balance});` | “u64::MAX, or at least the source’s whole pre-state balance: a block…”; “chain state (a CPI): an own account’s delegation new or raised to u…” — tsc 0 · RED Tests  2 failed \| 28 passed (30) |
| M2m | F5/F6 chain-state approvals dropped: `if (postToken === null \|\| postToken.owner !== account \|\| postToken.delegate === null) continue;` → `if (postToken === null \|\| postToken.owner !== account \|\| postToken.delegate === null \|\| address !== '') continue;` | “chain state (a CPI): an own account’s delegation new or raised to u…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2n | F5 chain: new-or-raised gate dropped: `if (postToken.delegate === (preOwn?.delegate ?? null) && postToken.delegatedAmount <= (preOwn?.delegatedAmount ?? 0n)) continue;` → `if (postToken.delegate === '' && postToken.delegatedAmount <= (preOwn?.delegatedAmount ?? 0n)) continue;` | “chain state (a CPI): an own account’s delegation new or raised to u…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2o | F5 an unreadable own source read as bounded: `own ? src.amount : 0n);` → `own ? src.amount : 1n << 64n);` | “a source the wallet cannot read, approved by the wallet, counts as …” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2p | word: decimals match dropped: `return candidate !== null && decimals === WALLET_TOKENS[candidate].decimals ? candidate : null;` → `return candidate !== null && (decimals ?? WALLET_TOKENS[candidate].decimals) >= 0 ? candidate : null;` | “the word: the wallet table’s symbol only when the mint’s decimals m…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2q | word: an unreadable mint assumed to match: `return a === null ? null : (mintInfo(a.data, a.owner)?.decimals ?? null);   };   const symbolOf` → `return a === null ? 6 : (mintInfo(a.data, a.owner)?.decimals ?? null);   };   const symbolOf` | “the word: the wallet table’s symbol only when the mint’s decimals m…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2r | word: first symbol, not one-for-all: `const only = symbols.length === 1 ? symbols[0] : null;` → `const only = symbols[0] ?? null;` | “one word per transaction: one symbol for every unlimited approval, …” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2s | F10 dropped: `if (t.outcome.status === 'dependent') out.push` → `if (t.outcome.status === 'dependent' && t.outcome.on < 0) out.push` | “a step that depends on an earlier one: a block, UNCHECKED; any othe…”; “blocks first, then warnings; within each by instruction index (chai…”; “one word per (transaction, block kind), in order; none for warnings”; … — tsc 0 · RED Tests  4 failed \| 26 passed (30) |
| M2t | F2 Compute Budget not exempt: `ix.program === null \|\| ix.program === 'compute-budget' \|\| isTransfer(ix)` → `ix.program === null \|\| isTransfer(ix)` | “never for Compute Budget (the fee) and never for System transfer, T…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2u | F2 transferChecked not a transfer: `(ix.name === 'transfer' \|\| ix.name === 'transferChecked'))` → `ix.name === 'transfer')` | “never for Compute Budget (the fee) and never for System transfer, T…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2v | F7 classic mints flagged: `if (a !== null && a.owner === TOKEN_PROGRAM) continue;` → `if (a !== null && a.owner === TOKEN_PROGRAM && mint === '') continue;` | “never for Compute Budget (the fee) and never for System transfer, T…”; “an own token account (its pre-state owner field is the wallet): a b…”; “chain state (a CPI): an own account’s owner reassigned, its close a…”; … — tsc 0 · RED Tests  9 failed \| 21 passed (30) |
| M2w | F7 unreadable mint silent: `out.push({kind: 'token-2022', severity: 'warn', word: null, at, mint, settings: null});` → `if (mint === '') out.push({kind: 'token-2022', severity: 'warn', word: null, at, mint, settings: null});` | “a mint that cannot be read — not read at all, absent, another owner…”; “the mints: own token accounts pre and post, and every mint a decode…” — tsc 0 · RED Tests  2 failed \| 28 passed (30) |
| M2x | F7 permanent delegate ignored: `info.freezeAuthority !== null \|\| info.permanentDelegate !== null \|\| info.transferHookProgram !== null` → `info.freezeAuthority !== null \|\| info.transferHookProgram !== null` | “no flag: a Token-2022 mint whose delegate is the zero key and with …” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2y | F7 someone else's token accounts counted: `if (own !== null && own.owner === account && !out.has(own.mint))` → `if (own !== null && !out.has(own.mint))` | “the mints: own token accounts pre and post, and every mint a decode…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2z | F8 from any decoded advanceNonceAccount: `if (usesDurableNonce(t.tx)) out.push` → `if (usesDurableNonce(t.tx) \|\| t.decoded.some(ix => ix.name === 'advanceNonceAccount')) out.push` | “AdvanceNonceAccount first: "does not expire" (and it is named among…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2aa | F9 without the first-send gate: `if (t.firstSend && input.reasons.includes('whole-balance-to-new'))` → `if (input.reasons.includes('whole-balance-to-new'))` | “whole balance to a first-time address: on each transaction that sen…” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2ab | order: blocks not first: `(x.f.severity === y.f.severity ? 0 : x.f.severity === 'block' ? -1 : 1) \|\|` → `` | “assign, allocate, assignWithSeed, allocateWithSeed of the wallet ac…”; “an own token account (its pre-state owner field is the wallet): a b…”; “u64::MAX, or at least the source’s whole pre-state balance: a block…”; … — tsc 0 · RED Tests  7 failed \| 23 passed (30) |
| M2ac | overrides: duplicates accepted: `if (!expected.has(k) \|\| seen.has(k)) return 'mismatch';` → `if (!expected.has(k)) return 'mismatch';` | “ok only for exactly the expected words, in any order; missing when …” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2ad | overrides: extra entries accepted: `if (!expected.has(k) \|\| seen.has(k)) return 'mismatch';` → `if (seen.has(k)) return 'mismatch';` | “ok only for exactly the expected words, in any order; missing when …” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2ae | overrides: case-insensitive: `JSON.stringify([o.tx, o.word])` → `JSON.stringify([o.tx, o.word.toUpperCase()])` | “ok only for exactly the expected words, in any order; missing when …” — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
| M2af | expectedOverrides: warnings too: `(f.severity === 'block' ? [{tx, word: f.word}] : [])` → `[{tx, word: f.word ?? ''}]` | “one word per (transaction, block kind), in order; none for warnings”; “ok only for exactly the expected words, in any order; missing when …” — tsc 0 · RED Tests  2 failed \| 28 passed (30) |

32 mutations, all red, every one compiling (`tsc` 0). One first draft did not compile and was replaced (INVALID, not red): M2w as first written (`if (info === null && mint === '') {`) left `info` possibly null in the `else` branch (tsc 2). Counts are on this task's own tree (`redFlags.test.ts`, 30 tests), each mutant alone in a fresh `git archive` copy with `node_modules` linked, under `timeout 300`.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-3 red flags — B1 §3's table F1–F10 as a pure function of the simulation's reads, the override words and their check" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

#### Dry-run notes (Task 2)

- **Ruling: F2 is literal — it names every instruction of a decoded program that is not a System `transfer` or a Token / Token-2022 `transfer` / `transferChecked`, including those another row also flags (`assign`, `setAuthority`, `approve`, `advanceNonceAccount`, an unknown tag of a known program as `name: null`, `transferWithSeed`, ATA `create`, the presale's instructions)** — why: the brief makes Compute Budget "the only exemption", and Task 1's §9 O4 row says `transferWithSeed` / `transferCheckedWithFee` carry F2 (now true, tested) — cost if wrong: a redundant warning line beside a block (Task 5 may group them; it may not drop one).
- **Ruling: F4 is stricter than the brief in two places** — (c) the wallet signing as `currentAuthority` of an account it cannot read or does not own blocks (`owned: 'current-authority'`; the user is giving away an authority it holds); and chain state also blocks a pre-state mint whose mint or freeze authority was the wallet and is not after (B1 §3's row names "mint, freeze") — why: fail closed, never loosening — cost if wrong: a typed override on a transaction that hands off an authority the user holds without owning the account (e.g. a close authority granted to the user).
- **Ruling: F3's chain rule fires only when the wallet account's post-state is not plain (owner ≠ System or data) AND differs from its pre-state in owner or data length** — why: an account already so before this transaction would otherwise block every transaction it signs — cost if wrong: a wallet account already assigned away before the request is not re-flagged (its funds were already gone; F3's decoded rule still fires on any assign of it).
- **Ruling: F5 is `amount ≥ balance`, where balance is the source's pre-state amount when its pre-state is a token account owned by the wallet, else 0** — u64::MAX is always ≥ any balance, so the brief's "=== u64::MAX" is the same comparison (tested both ways: u64::MAX and exactly the balance; M2l). A decoded approve counts when the source's owner field is the wallet or the instruction's `owner` is the wallet; a source the wallet cannot read (absent, created in the same transaction, not a token account) is an empty balance → a block (fail closed; an approve of 0 on an empty account blocks too) — cost if wrong: a typed override for an approve on a fresh account. Someone else's account approved by its own owner is F2 only.
- **Ruling: F5/F6 from chain state keep B1c-2's gate** — only a delegation that is new or raised (`approvalFromChain` case 1) is an approval; one already there and unchanged is no flag — why: otherwise every transaction touching an account with a standing delegation would block. An approve seen both decoded and in chain state with the same severity is listed once (decoded); when chain state shows unlimited and the decoded instruction bounded, the account is F5 only.
- **Ruling: F5's word is one per transaction** — the one wallet symbol every unlimited approval of that transaction shares, else `UNLIMITED` (two different tokens, or any unnamed one) — why: the override is one field per (transaction, kind) (O1/R4) — cost if wrong: a user unlimited-approving USDC and USDT in one transaction types `UNLIMITED`, not a symbol. The symbol is the wallet table's (`tokenForMint`) only when the **mint's own decimals as read through the proxy** (the `mints` map) equal the table's; an unreadable mint → `UNLIMITED`. Never anything the mint's bytes claim (a Token-2022 TokenMetadata naming itself USDC is tested). **Task 3 must read every mint `flagMints` names, the wallet's own tokens included** — today's `KNOWN_DECIMALS` shortcut (no read) would leave them unnamed → `UNLIMITED` (fail closed, but not what the design draws).
- **Ruling: F7's mints are the `mint` field of decoded Token / Token-2022 / ATA instructions (not other programs' account names) and the mints of the wallet's own token accounts in pre- and post-state; someone else's token account adds none.** A mint owned by classic Token is never flagged, even if its bytes do not parse (O3: no Token-2022 setting can exist on it); not in the map, null, owned by any other program, or Token-2022 bytes that do not parse → `settings: null` (Q36). One F7 flag per mint.
- **Ruling: F8 reads B1c-2's `usesDurableNonce` on the raw transaction, not the decoded name** — it also catches a first instruction the runtime runs as AdvanceNonceAccount but the strict decoder shows as an unknown program (trailing bytes) — `at: 0`; at index 1 it is F2 only (M2z).
- **Ruling: F9 is per transaction: the request's reasons include `whole-balance-to-new` AND that transaction's own `firstSend`** — the reason is computed over the batch, so it is shown on each transaction that sends to a first-time address. **Task 3 must compute `firstSend` per transaction** (today's `firstSend` is one `.some` over all of them).
- **Ruling: a `failed` (or expired) transaction gets its decoded flags but no chain-state ones and no F10; a `dependent` one gets its decoded flags and F10** — the request is Reject-only anyway when any step failed undependently (O2). `on` is 0-based (the window shows `on + 1` in Q32).
- **Ruling: `overridesMatch`'s precedence** — any given entry that is not an expected (tx, word), or that repeats one, is `mismatch`; otherwise fewer than expected is `missing`; exact `===` on the word (case-sensitive, no trimming). Task 4 maps `missing` → `blocked`, `mismatch` → `override-mismatch` and must validate `tx` as a safe non-negative integer before calling it (the key is `JSON.stringify([tx, word])`).
- **Ruling: F1's `programs` may hold `null`** — a program index that is not a static key (the decoder's `programId: null`); Task 5 must render it (e.g. "a program no static key names"), never drop it.
- **Deviation (additive): `flagMints` is exported** — Task 3 reads exactly these mints (one `getAccountsData`; past the 100 cap, the ones left out are simply absent from the map and warn Q36 — fail closed). `TxFlags` is `RedFlag[]` (the brief's `TxFlags[]` return, indexed by transaction), not an object.
- **For Task 3:** `pre` must be the map of the addresses `getAccountsData` read before that transaction (the wallet account first); `post` the simulation's `accounts` for the same addresses; `mints` the read of `flagMints(...)`; `reasons` the final reasons (computed before the flags, then `override` added when `expectedOverrides(flags).length > 0`). `redFlags.ts` imports `txRequest.ts` (`usesDurableNonce`) — no cycle today.
- **For Task 5 (copy):** the meta each banner needs is in the flag (instruction names and indices, addresses, `authorityType`, the approval's amount/balance/decimals/symbol/delegate, the T22 settings, `on`). No new string was invented here; F1–F4, F7, F9, F10 banner heads/bodies remain Task 5's Q37+ (Task 1's note).

---

### Task 3: The simulation integration — every flag mint read (one batch, the cap handled), the red flags stored with the simulation (strictly read back), the `override` reason in all four reason lists, first send per transaction with R10's owner resolution, F10's dependent steps, `outgoingGrew` and `omitted`

**Spec:** B1c §3.3 rev 3.6 "Red flags as B1c-3 builds them" (F9, F10 "Attribution" — this task writes its exact error list, the override rule), §9 (R10 row, dependent batches), §10 Q33; B1 §3; owner decisions O2, O4; brief "The red-flag table as built" (F10, R3), "Override rule" (R4), "Carried items" (R8 = R10's resolution, `outgoingGrew`, durable nonce vs the refresh)

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (§3.3 "Attribution": the exact error shapes)
- Test: `extension/src/background/dapp/__tests__/simulate.test.ts` (scene: `errAt`, `readFails`, the real reader's 100-address cap; five B1c-2 tests updated; one describe added)
- Test: `extension/src/background/dapp/__tests__/signTx.test.ts` (two describes added)
- Test: `extension/src/background/__tests__/reauthChallenges.test.ts` (one test added; the `dappAbout` helper takes reasons)
- Test: `extension/src/unlock/__tests__/challenge.test.ts` (one describe added)
- Test: `extension/src/approve/__tests__/tx.test.tsx` (one test added)
- Modify: `extension/src/background/dapp/simulate.ts` (the mint read, the flags, `override`, `firstSendOf`, `createdBy`, `accountsNamed`, the `dependent` outcome, `simStateOf`)
- Modify: `extension/src/background/dapp/redFlags.ts` (`storedFlagsOf` — the strict reader of stored flags)
- Modify: `extension/src/background/reauthPolicy.ts` (`DappReauthReason` gains `override`)
- Modify: `extension/src/background/reauthChallenges.ts` (`DAPP_REASONS`)
- Modify: `extension/src/unlock/challenge.ts`, `extension/src/unlock/strings.ts` (`reasonLine`, `REAUTH.override` = Q33)
- Modify: `extension/src/approve/client.ts` (the window's own strict reason list; the `dependent` outcome)
- Modify: `extension/src/background/dapp/signTx.ts` (`outgoingGrew` exported, compares `omitted`)

**Interfaces:**
- Consumes: Task 2's `redFlagsOf`, `flagMints`, `expectedOverrides`, `OVERRIDE_WORDS`, `RedFlag`, `TxFlags`, `TxFlagInput`, `FlagOutcome` (`dapp/redFlags.ts`); Task 1's `tokenAccountInfo`, `mintInfo` (`dapp/tokenState.ts`), the decoder's `createAccountWithSeed.newAccount`, `__tests__/tokenBytes.ts` (`keyOf`, `mintBytes`, `usdcLikeMint`, `U64_MAX`); B1c-2's `simulateTransactions`, `SimulateInput`, `simStateOf`, `TxOutcome`, `TxSimulation` (`simulate.ts`), `dappAbout`, `reauthGate`, `txRefused` (`signTx.ts`), `ChallengeAbout`, `DappOutgoing`, `issueChallenge` (`reauthChallenges.ts`), `describeChallenge` (`unlock/challenge.ts`), `pendingOf` (`approve/client.ts`), `MAX_MULTIPLE_ACCOUNTS` (`core/solana/rpc.ts`), `AUTHORITY_TYPES` (`decode/decode.ts`).
- Produces:
  ```ts
  // dapp/simulate.ts
  export type TxOutcome =
    | {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null}
    | {ok: false; error: 'expired' | 'failed'; detail: string}
    | {ok: false; error: 'dependent'; on: number; detail: string};   // on: 1-based step that creates the account
  export interface TxSimulation {/* B1c-2's fields */; flags: RedFlag[][]}  // one list per transaction, redFlagsOf's order
  // simStateOf: as B1c-2, plus — flags.length === outcomes.length, every flag exactly storedFlagsOf's, any block ⇔ reasons
  // include 'override', an outcome `dependent` (on n) ⇔ its transaction's `dependent` flag with on === n − 1.
  // dapp/redFlags.ts
  export function storedFlagsOf(x: unknown): TxFlags | null;   // one transaction's stored list, rebuilt; null if any flag is off
  // reauthPolicy.ts
  export type DappReauthReason = SendReauthReason | 'approval' | 'override';
  // signTx.ts
  export function outgoingGrew(fresh: Pick<DappAbout, 'outgoing' | 'omitted'>, issued: Pick<DappAbout, 'outgoing' | 'omitted'>): boolean;
  // approve/client.ts
  export type TxOutcome = /* the background's three variants, `dependent` included */;
  // unlock/strings.ts
  REAUTH.override = 'Re-auth required to override a blocked transaction.'   // Q33
  ```
  `reasons` is B1b's rules over the batch, then `'override'` last whenever `expectedOverrides(flags)` is non-empty (any block; a dependent step always is one). The flags are NOT yet in the window's view (`TxDetail`): Task 4/5 add them; until then a `dependent` outcome renders as B1c-2's failure (Tx.tsx `stateOf` → `failed`, its `detail` in the banner's meta) and `txRefused` still refuses it `simulation-failed` (Task 4 opens it under the override).

The simulation already reads everything the table needs except the mints. This task adds that one read — every mint `flagMints` names, the wallet's own tokens included (Task 2's note: `KNOWN_DECIMALS` must not skip them, or an unlimited USDC approve could only ever be typed `UNLIMITED`), merged with B1c-2's decimals read so a request still costs at most one mint call. A read is capped at `MAX_MULTIPLE_ACCOUNTS` (core's reader throws past it); the mints past the cap are simply not read, so they reach `redFlagsOf` absent and warn Q36 — fail closed, never silence and never an unreachable proxy; a read that fails still throws (unreachable, as before). The flags are computed per transaction from the `pre` / `post` maps the loop already holds and stored on the simulation; `simStateOf` reads them back strictly (a stored flag that is not exactly what `redFlagsOf` can give makes the stored simulation invalid — it is simulated again, never approvable). A block adds `override` to the reasons, so B1c-2's deciding check (`sim.reasons.length > 0` ⇒ a proof) requires re-authentication for every override; `override` is added to all four places a reason is named (code map §3), each with a test that it passes and an unknown one still fails — the window's list did not exist (it took any string) and is created here. First send is now per transaction (F9) and resolves an SPL transfer's destination to its owner (R10). F10's attribution maps the node's error to accounts and intersects them with what earlier transactions of the batch create. Last, `outgoingGrew` counts a mint newly cut from #10's list, and a test pins what the 30 s refresh does to a durable-nonce transaction.

**F10's accepted error shapes** (Agave's `TransactionError` as the RPC returns it — serde's externally tagged JSON). Source: the dry run read `extension/node_modules/@solana/errors` 5.5.1 (`dist/index.node.cjs`, `transaction-error.ts` / `instruction-error.ts`, whose list says "Keep synced with RPC source: agave/sdk/src/transaction/error.rs"): unit variants arrive as strings (`"AccountNotFound"`, `"BlockhashNotFound"`, …), `InstructionError(u8, InstructionError)` as `{"InstructionError": [i, e]}` with `e` a string or `{"Custom": n}` / `{"BorshIoError": …}`, and the two account-index variants as `{"InsufficientFundsForRent": {"account_index": n}}` / `{"ProgramExecutionTemporarilyRestricted": {"account_index": n}}`. What each variant MEANS — that `AccountNotFound` is raised by the fee-payer check alone (a payer holding no lamports: "Attempt to debit an account but found no record of a prior credit"), and that an absent non-payer account is loaded as an empty System account so the program, not the runtime, fails (an `InstructionError`) — is from the writer's knowledge of Agave's `account_loader` / `validate_fee_payer`, not from a file read in the dry run. Accepted:
1. `{"InstructionError": [i, <anything>]}` — exactly one key, a two-element array, `i` a safe non-negative integer naming one of the message's instructions → instruction `i`'s resolved accounts (its account indices through the resolved keys; a key a lookup table did not resolve is dropped).
2. `"AccountNotFound"` → the fee payer (static key 0).
Not accepted (a plain failure): every other variant — `ProgramAccountNotFound` (no creator creates a program), `InvalidAccountForFee`, `InsufficientFundsForRent` (an account that exists but is short of rent is not "missing"), `BlockhashNotFound` (always `expired`, never dependent), and any other shape of the two (an index that is a string, fractional, negative or past the last instruction; a one- or three-element array; a second key).

- [ ] **Step 1: Write the failing tests.**

The scene gains `errAt` (one error per simulateTransaction call), `readFails` and the real reader's 100-address cap (`core/solana/rpc.ts` throws past `MAX_MULTIPLE_ACCOUNTS`). Five B1c-2 tests change, each by a rule this task brings: the reads test now ends with the one mint read (`[NOC, USDC, ODD_MINT]` — the wallet's own tokens are read for the flags); the close-authority change and both owner-reassigned tests now expect `['approval', 'override']` (Task 2's F4 chain rule blocks them); the own-token-accounts first-send test is renamed to what it proves under R10 (its `away` destination is unreadable → still a first send). The B1c-2 assertion that "every SPL transfer re-auths" lived only in that test (and the §9 row, rewritten by Task 1); R10's positive and negative controls are the new `R10` describe.

`extension/src/background/dapp/__tests__/simulate.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/simulate.test.ts b/extension/src/background/dapp/__tests__/simulate.test.ts
index 46c0c84..1213840 100644
--- a/extension/src/background/dapp/__tests__/simulate.test.ts
+++ b/extension/src/background/dapp/__tests__/simulate.test.ts
@@ -1,14 +1,14 @@
 import {base58} from '@scure/base';
-import {ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount} from '@solana/web3.js';
-import type {AccountData, SimulatedAccount, SimulationOutcome, TokenAccountEntry} from '../../../../../core/solana/rpc';
+import {ComputeBudgetProgram, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount} from '@solana/web3.js';
+import {MAX_MULTIPLE_ACCOUNTS, type AccountData, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../../core/solana/rpc';
 import {MAINNET_NOC_MINT, MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
 import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
 import {BLOCKHASH, PUB, RECIPIENT, tokenAccountData} from '../../__tests__/fixtures';
 import {ADDRESS_LOOKUP_TABLE_PROGRAM} from '../decode/keys';
-import {TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
+import {ATA_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
 import {parseWire} from '../decode/wire';
-import {simulateTransactions, WRAPPED_SOL_MINT, type TxSimulation} from '../simulate';
-import {ACCOUNT_SIZE, mintBytes, otherExt, tokenAccountBytes, withByte} from './tokenBytes';
+import {simStateOf, simulateTransactions, WRAPPED_SOL_MINT, type TxSimulation} from '../simulate';
+import {ACCOUNT_SIZE, U64_MAX, keyOf, mintBytes, otherExt, tokenAccountBytes, usdcLikeMint, withByte} from './tokenBytes';
 
 const ME = new PublicKey(PUB);
 const TO = new PublicKey(RECIPIENT);
@@ -91,7 +91,17 @@ const forgedMultisig = (ownerField: string, amount: bigint): SimulatedAccount =>
  * A reader for one request: the wallet's SOL and token accounts before, and per simulateTransaction call the post-state
  * of each requested address (a function of the address) — or an error.
  */
-function scene(o: {holdings?: TokenAccountEntry[]; post?: (address: string, call: number) => SimulatedAccount | null; err?: unknown; accounts?: Map<string, AccountData | null>; lamports?: bigint}) {
+function scene(o: {
+  holdings?: TokenAccountEntry[];
+  post?: (address: string, call: number) => SimulatedAccount | null;
+  err?: unknown;
+  /** B1c-3: the error of simulateTransaction call `call` (1-based); null or undefined: it runs. */
+  errAt?: (call: number) => unknown;
+  accounts?: Map<string, AccountData | null>;
+  lamports?: bigint;
+  /** B1c-3: a getAccountsData call this answers true for throws (the proxy failing that read). */
+  readFails?: (addresses: readonly string[]) => boolean;
+}) {
   const simulations: {tx: string; accounts: readonly string[] | undefined}[] = [];
   const reads: string[][] = [];
   const reader = fakeReader({
@@ -99,13 +109,17 @@ function scene(o: {holdings?: TokenAccountEntry[]; post?: (address: string, call
     getTokenAccountsByOwner: async (_owner, filter) => ('programId' in filter && filter.programId === TOKEN_PROGRAM ? (o.holdings ?? []) : []),
     getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 4_242}),
     getAccountsData: async addresses => {
+      // The real reader's own cap (core/solana/rpc.ts): more than MAX_MULTIPLE_ACCOUNTS addresses in one call throws.
+      if (addresses.length > MAX_MULTIPLE_ACCOUNTS) throw new RangeError(`getAccountsData: at most ${MAX_MULTIPLE_ACCOUNTS} addresses`);
+      if (o.readFails?.(addresses) === true) throw new Error('the proxy is unreachable');
       reads.push([...addresses]);
       return addresses.map(a => o.accounts?.get(a) ?? null);
     },
     simulateTransaction: async (tx, opts): Promise<SimulationOutcome> => {
       simulations.push({tx, accounts: opts?.accounts});
       const call = simulations.length;
-      if (o.err !== undefined) return {err: o.err, logs: [], unitsConsumed: 0, slot: 300 + call, accounts: null};
+      const err = o.errAt !== undefined ? o.errAt(call) : o.err;
+      if (err !== undefined && err !== null) return {err, logs: [], unitsConsumed: 0, slot: 300 + call, accounts: null};
       return {err: null, logs: [], unitsConsumed: 1_234, slot: 300 + call, accounts: (opts?.accounts ?? []).map(a => o.post?.(a, call) ?? null)};
     },
   });
@@ -167,7 +181,9 @@ describe('simulateTransactions', () => {
       {mint: ODD_MINT, amount: '777', decimals: 4, usdMicros: null},
       {mint: MAINNET_USDC_MINT, amount: '-2000000', decimals: 6, usdMicros: '-2000000'},
     ]);
-    expect(s.reads).toEqual([[], [ME.toBase58(), SRC, NEW_ATA, closing], [ODD_MINT]]);
+    // B1c-3: one mint read for the batch — every mint the red flags need (each own token account's, pre and post: the
+    // wallet's own NOC and USDC too, whose decimals it already knows), which also gives ODD_MINT's decimals.
+    expect(s.reads).toEqual([[], [ME.toBase58(), SRC, NEW_ATA, closing], [MAINNET_NOC_MINT, MAINNET_USDC_MINT, ODD_MINT]]);
   });
 
   it('a writable token account of SOMEONE ELSE (a recipient’s) is not the account’s change, however its amount moves', async () => {
@@ -184,7 +200,9 @@ describe('simulateTransactions', () => {
     ]);
   });
 
-  it('a transfer between the account’s own token accounts is not a first send; a token transfer to anyone else is', async () => {
+  // B1c-3 (R10): an own token account the holdings name is still never a recipient; an unreadable destination is a first
+  // send (fail closed). The destination's owner rule is the describe below.
+  it('a transfer between the account’s own token accounts is not a first send; a token transfer to a destination it cannot read is', async () => {
     const other = 'CLoSE7RZXBqUBQuYuPxMjBwRGt6aMYn7nUykAmgdUCLu';
     const s = scene({holdings: [holding(SRC, MAINNET_NOC_MINT, 100n), holding(other, MAINNET_NOC_MINT, 0n)], post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
     const own = await run(s, [wire([tokenIx([3, ...u64(1n)], [SRC, other, ME.toBase58()])])]);
@@ -231,13 +249,14 @@ describe('simulateTransactions', () => {
     expect(sim.reasons).toEqual([]);
   });
 
-  it('a changed close authority re-authenticates too (I1; documented choice: the same `approval` reason — no separate copy exists for it)', async () => {
+  // B1c-3 (F4): a changed close authority of an own account is now also a block — the `override` reason follows it.
+  it('a changed close authority re-authenticates too (I1; documented choice: the same `approval` reason — no separate copy exists for it), and blocks (F4: override)', async () => {
     const s = scene({
       accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 100n)]]),
       post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenWithCloseAuthority(MAINNET_NOC_MINT, 100n, NEW_ATA) : null),
     });
     const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
-    expect(sim.reasons).toEqual(['approval']);
+    expect(sim.reasons).toEqual(['approval', 'override']);
   });
 
   it('an outgoing token with no price is above the dollar threshold (fail closed)', async () => {
@@ -413,7 +432,7 @@ describe('simulateTransactions', () => {
     expect(await lineFor(t22(900_000n), withByte(mint, ACCOUNT_SIZE - 1, 1))).toMatchObject({amount: '-100000', decimals: null});
   });
 
-  it('an own account reassigned to someone else (a CPI SetAuthority AccountOwner) re-authenticates too, on top of the −all loss already shown', async () => {
+  it('an own account reassigned to someone else (a CPI SetAuthority AccountOwner) re-authenticates too, on top of the −all loss already shown — and blocks (F4: override)', async () => {
     const s = scene({
       // A large enough holdings balance that losing SRC's 100 is under the unrelated 5 % rule — isolates this test to
       // the owner-change reason alone.
@@ -423,7 +442,7 @@ describe('simulateTransactions', () => {
     });
     const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
     const out = sim.outcomes[0];
-    expect(sim.reasons).toEqual(['approval']);
+    expect(sim.reasons).toEqual(['approval', 'override']);
     // The fee, plus SRC's rent (2 039 280) — no longer ours to attribute lamports to once its owner field isn't ours.
     expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([
       [null, '-2044280'],
@@ -431,13 +450,13 @@ describe('simulateTransactions', () => {
     ]);
   });
 
-  it('an owner change on an otherwise-empty account (only its rent moves) still re-authenticates', async () => {
+  it('an owner change on an otherwise-empty account (only its rent moves) still re-authenticates — and blocks (F4: override)', async () => {
     const s = scene({
       accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 0n)]]),
       post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 0n, NEW_ATA) : null),
     });
     const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
-    expect(sim.reasons).toEqual(['approval']);
+    expect(sim.reasons).toEqual(['approval', 'override']);
     // Empty (amount 0 both sides, so no token line at all) — only the rent, treated as lost along with control, shows.
     const out = sim.outcomes[0];
     expect(out?.ok === true ? out.changes : null).toEqual([{mint: null, amount: '-2044280', decimals: 9, usdMicros: '-306642'}]);
@@ -499,3 +518,277 @@ describe('simulateTransactions', () => {
     await expect(run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})])])).rejects.toThrow('unreachable');
   });
 });
+
+// B1c-3 (spec B1c §3.3 rev 3.6): the red flags are computed with the simulation, from its own reads, and stored with it.
+describe('simulateTransactions: the red flags (B1c-3)', () => {
+  type Json = Record<string, unknown>;
+  const SYSTEM = SystemProgram.programId.toBase58();
+  const NOC = MAINNET_NOC_MINT;
+  const DEST = NEW_ATA;
+  const DELEGATE = keyOf(51);
+  const plain = (lamports: bigint): SimulatedAccount => ({lamports, owner: SYSTEM, data: new Uint8Array()});
+  const meAfter = (a: string): SimulatedAccount | null => (a === ME.toBase58() ? plain(SOL - 5_000n) : null);
+  /** An associated-token-account create (tag 0) or createIdempotent (tag 1), paid by the account. */
+  const ataIx = (account: string, wallet: string, mint: string, tag: 0 | 1 = 1) =>
+    new TransactionInstruction({
+      programId: new PublicKey(ATA_PROGRAM),
+      data: Buffer.from([tag]),
+      keys: [
+        {pubkey: ME, isSigner: true, isWritable: true},
+        {pubkey: new PublicKey(account), isSigner: false, isWritable: true},
+        {pubkey: new PublicKey(wallet), isSigner: false, isWritable: false},
+        {pubkey: new PublicKey(mint), isSigner: false, isWritable: false},
+        {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
+        {pubkey: new PublicKey(TOKEN_PROGRAM), isSigner: false, isWritable: false},
+      ],
+    });
+  const tokenTransfer = (destination: string, amount = 1n) => tokenIx([3, ...u64(amount)], [SRC, destination, ME.toBase58()]);
+  const approve = (amount: bigint) => wire([tokenIx([4, ...u64(amount)], [SRC, DELEGATE, ME.toBase58()])]);
+  const USDC_MINT: AccountData = {lamports: 1n, owner: TOKEN_PROGRAM, data: usdcLikeMint()};
+  const approveScene = (delegated: bigint, mint: AccountData | null, o: {readFails?: (addresses: readonly string[]) => boolean} = {}) =>
+    scene({
+      holdings: [holding(SRC, MAINNET_USDC_MINT, 100n, 6)],
+      accounts: new Map<string, AccountData | null>([
+        [SRC, tokenAfter(MAINNET_USDC_MINT, 100n)],
+        [MAINNET_USDC_MINT, mint],
+      ]),
+      post: a => (a === SRC ? tokenDelegated(MAINNET_USDC_MINT, 100n, DELEGATE, delegated) : meAfter(a)),
+      ...o,
+    });
+  /** The stored form of a simulation (as storage.session gives it back), edited. */
+  const storedWith = (sim: TxSimulation, edit: (s: Json) => void = () => {}): unknown => {
+    const copy = JSON.parse(JSON.stringify(sim)) as Json;
+    edit(copy);
+    return {status: 'ok', sim: copy};
+  };
+  const flagsOf = (s: Json, tx = 0): Json[] => (s.flags as Json[][])[tx] ?? [];
+  const flag = (s: Json, kind: string, tx = 0): Json => {
+    const f = flagsOf(s, tx).find(x => x.kind === kind);
+    if (f === undefined) throw new Error(`no ${kind} flag`);
+    return f;
+  };
+
+  it('every mint the flags need is read in one batch, the wallet’s own tokens too: an unlimited USDC approve’s word is USDC, and the block adds `override`', async () => {
+    const s = approveScene(U64_MAX, USDC_MINT);
+    const sim = await run(s, [approve(U64_MAX)], () => true);
+    // USDC's decimals are known without a read (KNOWN_DECIMALS) — read anyway: F5's word needs the mint's own decimals.
+    expect(s.reads).toEqual([[], [ME.toBase58(), SRC, DELEGATE], [MAINNET_USDC_MINT]]);
+    expect(sim.flags[0]?.find(f => f.kind === 'unlimited-approve')).toMatchObject({severity: 'block', word: 'USDC'});
+    expect(sim.reasons).toEqual(['approval', 'override']);
+    // The mint unreadable: no symbol (fail closed) — the word is UNLIMITED, still a block.
+    const unread = await run(approveScene(U64_MAX, null), [approve(U64_MAX)], () => true);
+    expect(unread.flags[0]?.find(f => f.kind === 'unlimited-approve')?.word).toBe('UNLIMITED');
+    expect(unread.reasons).toEqual(['approval', 'override']);
+    // Negative control: a bounded approve is a warning — no block, no `override`.
+    const bounded = await run(approveScene(50n, USDC_MINT), [approve(50n)], () => true);
+    expect(bounded.flags[0]?.map(f => [f.kind, f.severity])).toEqual([
+      ['non-transfer', 'warn'],
+      ['bounded-approve', 'warn'],
+    ]);
+    expect(bounded.reasons).toEqual(['approval']);
+  });
+
+  it('the mint read failing is a failed read like any other: it throws (the caller records the simulation as unreachable)', async () => {
+    const s = approveScene(50n, USDC_MINT, {readFails: a => a.includes(MAINNET_USDC_MINT)});
+    await expect(run(s, [approve(50n)], () => true)).rejects.toThrow('unreachable');
+  });
+
+  it('more mints than one read may name: the first MAX_MULTIPLE_ACCOUNTS read in one call, every other one warns it could not be read (Q36) — never silence, never unreachable', async () => {
+    const k = (tag: number, n: number) => base58.encode(Uint8Array.from({length: 32}, (_, i) => (i === 0 ? tag : i === 1 ? n : 7)));
+    const owned = Array.from({length: 120}, (_, n) => k(201, n));
+    const mints = Array.from({length: 120}, (_, n) => k(202, n));
+    const table = new PublicKey(k(203, 0));
+    const data = new Uint8Array(56 + 32 * owned.length);
+    new DataView(data.buffer).setUint32(0, 1, true);
+    owned.forEach((a, n) => data.set(base58.decode(a), 56 + 32 * n));
+    const alt = {key: table, state: {deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: owned.map(a => new PublicKey(a))}, isActive: () => true} as unknown as AddressLookupTableAccount;
+    const accounts = new Map<string, AccountData | null>([[table.toBase58(), {lamports: 1n, owner: ADDRESS_LOOKUP_TABLE_PROGRAM, data}]]);
+    owned.forEach((a, n) => accounts.set(a, tokenAfter(mints[n] ?? '', 1n)));
+    // Every mint a classic one (never flagged, O3) — so a warning can only mean "not read".
+    for (const m of mints) accounts.set(m, {lamports: 1n, owner: TOKEN_PROGRAM, data: mintBytes({decimals: 0})});
+    const s = scene({accounts, post: a => (a === ME.toBase58() ? plain(SOL - 5_000n) : (accounts.get(a) ?? null))});
+    const sim = await run(s, [wire([unknownIx(owned.slice(0, 60))], {tables: [alt]}), wire([unknownIx(owned.slice(60))], {tables: [alt]})], () => true);
+    expect(s.reads.map(r => r.length)).toEqual([1, 61, 61, MAX_MULTIPLE_ACCOUNTS]);
+    expect(s.reads[3]).toEqual(mints.slice(0, MAX_MULTIPLE_ACCOUNTS));
+    expect(sim.flags[0]?.filter(f => f.kind === 'token-2022')).toEqual([]);
+    expect(sim.flags[1]?.filter(f => f.kind === 'token-2022')).toEqual(mints.slice(MAX_MULTIPLE_ACCOUNTS).map(mint => ({kind: 'token-2022', severity: 'warn', word: null, at: null, mint, settings: null})));
+  });
+
+  it('simStateOf: the stored flags are read back strictly — a stored `override` with its block passes, as fresh objects', async () => {
+    const sim = await run(approveScene(U64_MAX, USDC_MINT), [approve(U64_MAX)], () => true);
+    const stored = storedWith(sim);
+    const back = simStateOf(stored);
+    expect(back).toEqual({status: 'ok', sim});
+    expect(back?.status === 'ok' ? back.sim.flags[0]?.[0] : null).not.toBe(((stored as {sim: Json}).sim.flags as Json[][])[0]?.[0]);
+    const bounded = await run(approveScene(50n, USDC_MINT), [approve(50n)], () => true);
+    expect(simStateOf(storedWith(bounded))).toEqual({status: 'ok', sim: bounded});
+  });
+
+  it('simStateOf: an invalid stored flag makes the stored simulation invalid (it is simulated again, never approvable)', async () => {
+    const sim = await run(approveScene(U64_MAX, USDC_MINT), [approve(U64_MAX)], () => true);
+    const bounded = await run(approveScene(50n, USDC_MINT), [approve(50n)], () => true);
+    const edits: [string, TxSimulation, (s: Json) => void][] = [
+      ['no flags', sim, s => delete s.flags],
+      ['a list per transaction missing', sim, s => (s.flags = [])],
+      ['an unknown kind', sim, s => (flag(s, 'unlimited-approve').kind = 'drain')],
+      ['a word not the one its approvals give (case)', sim, s => (flag(s, 'unlimited-approve').word = 'usdc')],
+      ['a word not the one its approvals give', sim, s => (flag(s, 'unlimited-approve').word = 'UNLIMITED')],
+      ['a block stored as a warning', sim, s => (flag(s, 'unlimited-approve').severity = 'warn')],
+      ['a key more', sim, s => (flag(s, 'unlimited-approve').extra = 1)],
+      ['a key less', sim, s => delete flag(s, 'non-transfer').at],
+      ['an approval’s symbol not its mint’s', sim, s => ((flag(s, 'unlimited-approve').approvals as Json[])[0] = {...(flag(s, 'unlimited-approve').approvals as Json[])[0], symbol: 'USDT'})],
+      [
+        'an approval’s symbol not its mint’s, its word made to agree',
+        sim,
+        s => {
+          const f = flag(s, 'unlimited-approve');
+          f.approvals = [{...(f.approvals as Json[])[0], symbol: 'USDT'}];
+          f.word = 'USDT';
+        },
+      ],
+      ['an approval’s amount not base units', sim, s => ((flag(s, 'unlimited-approve').approvals as Json[])[0] = {...(flag(s, 'unlimited-approve').approvals as Json[])[0], amount: '-1'})],
+      ['a flag’s position not its first instruction', sim, s => (flag(s, 'non-transfer').at = 3)],
+      ['a block without the `override` reason', sim, s => (s.reasons = ['approval'])],
+      ['an unknown reason', sim, s => (s.reasons = ['approval', 'override', 'drain'])],
+      ['`override` with no block', bounded, s => (s.reasons = ['approval', 'override'])],
+      ['a warning stored as a block', bounded, s => (flag(s, 'bounded-approve').severity = 'block')],
+    ];
+    for (const [name, base, edit] of edits) expect([name, simStateOf(storedWith(base, edit))]).toEqual([name, null]);
+  });
+
+  describe('R10: an SPL transfer’s destination resolved to its owner', () => {
+    /** Whether the request re-authenticates as a first send; `dest` is the destination's pre-state. */
+    const firstSend = async (txs: TransactionInstruction[][], o: {dest?: AccountData | null; known?: string[]} = {}) => {
+      const s = scene({
+        holdings: [holding(SRC, NOC, 1_000n)],
+        accounts: new Map<string, AccountData | null>([
+          [SRC, tokenAfter(NOC, 1_000n)],
+          [DEST, o.dest ?? null],
+        ]),
+        post: a => (a === SRC ? tokenAfter(NOC, 999n) : meAfter(a)),
+      });
+      const sim = await run(s, txs.map(ixs => wire(ixs)), a => (o.known ?? []).includes(a));
+      return sim.reasons.includes('first-send');
+    };
+    const theirs = tokenAfter(NOC, 0n, TO.toBase58());
+
+    it('its pre-state, a token account: an owner the account sent to before, or the account itself, is no first send; anyone else is', async () => {
+      expect(await firstSend([[tokenTransfer(DEST)]], {dest: theirs, known: [TO.toBase58()]})).toBe(false);
+      expect(await firstSend([[tokenTransfer(DEST)]], {dest: t22After(NOC, 0n, TO.toBase58()), known: [TO.toBase58()]})).toBe(false);
+      expect(await firstSend([[tokenTransfer(DEST)]], {dest: theirs})).toBe(true);
+      // The account's own token account, though the holdings snapshot does not list it.
+      expect(await firstSend([[tokenTransfer(DEST)]], {dest: tokenAfter(NOC, 0n)})).toBe(false);
+    });
+
+    it('absent before and created in the same transaction by an ATA create / createIdempotent: that instruction’s wallet decides', async () => {
+      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC), tokenTransfer(DEST)]], {known: [TO.toBase58()]})).toBe(false);
+      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC, 0), tokenTransfer(DEST)]], {known: [TO.toBase58()]})).toBe(false);
+      expect(await firstSend([[ataIx(DEST, ME.toBase58(), NOC), tokenTransfer(DEST)]])).toBe(false);
+      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC), tokenTransfer(DEST)]])).toBe(true);
+      // An ATA created for another account is not this destination's.
+      expect(await firstSend([[ataIx(keyOf(52), TO.toBase58(), NOC), tokenTransfer(DEST)]], {known: [TO.toBase58()]})).toBe(true);
+    });
+
+    it('fail closed: unreadable, not a token account, an existing account an ATA create names, or created by another transaction of the batch — a first send', async () => {
+      expect(await firstSend([[tokenTransfer(DEST)]], {known: [TO.toBase58(), DEST]})).toBe(true);
+      // A plain account at the destination (no token layout) — its own address "known" changes nothing.
+      expect(await firstSend([[tokenTransfer(DEST)]], {dest: plain(1n), known: [TO.toBase58(), DEST]})).toBe(true);
+      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC), tokenTransfer(DEST)]], {dest: plain(1n), known: [TO.toBase58()]})).toBe(true);
+      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(DEST)]], {known: [TO.toBase58()]})).toBe(true);
+    });
+
+    it('per transaction (F9 is per transaction): the whole-balance warning only on the transaction that sends to a first-time address', async () => {
+      const s = scene({post: (a, call) => (a === ME.toBase58() ? plain(call === 1 ? SOL - 5_001n : SOL - 9_950_005_000n) : null)});
+      const sim = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]), wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: new PublicKey(keyOf(53)), lamports: 9_950_000_000})])], a => a === TO.toBase58());
+      expect(sim.reasons).toContain('whole-balance-to-new');
+      expect(sim.flags.map(list => list.some(f => f.kind === 'whole-balance'))).toEqual([false, true]);
+    });
+  });
+
+  describe('F10: a step that depends on an earlier one of the same batch', () => {
+    const invalid = {InstructionError: [0, 'InvalidAccountData']};
+    const batch = (txs: TransactionInstruction[][], errAt: (call: number) => unknown, payers: (PublicKey | undefined)[] = []) =>
+      run(
+        scene({holdings: [holding(SRC, NOC, 1_000n)], accounts: new Map([[SRC, tokenAfter(NOC, 1_000n)]]), post: a => (a === SRC ? tokenAfter(NOC, 1_000n) : meAfter(a)), errAt}),
+        txs.map((ixs, i) => wire(ixs, {payer: payers[i]})),
+        () => true,
+      );
+    const dependent = (sim: TxSimulation): boolean => sim.outcomes.some(o => !o.ok && o.error === 'dependent') || sim.flags.flat().some(f => f.kind === 'dependent');
+
+    it('create the token account, then transfer to it: step 2 depends on step 1 — said in its outcome, blocked (UNCHECKED), and the request re-authenticates (override)', async () => {
+      const sim = await batch([[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(DEST)]], call => (call === 2 ? invalid : null));
+      expect(sim.outcomes[0]).toMatchObject({ok: true});
+      expect(sim.outcomes[1]).toEqual({ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'});
+      expect(sim.flags[1]).toContainEqual({kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, on: 0});
+      // The transfer's destination is created by step 1, not by its own transaction: R10 cannot name its owner — a first send.
+      expect(sim.reasons).toEqual(['first-send', 'override']);
+      // Stored and read back; a stored dependent step without its flag, or with another step, is invalid.
+      expect(simStateOf(storedWith(sim))).toEqual({status: 'ok', sim});
+      const drop = (s: Json) => ((s.flags as Json[][])[1] = flagsOf(s, 1).filter(f => f.kind !== 'dependent'));
+      expect(simStateOf(storedWith(sim, drop))).toBeNull();
+      expect(simStateOf(storedWith(sim, s => (flag(s, 'dependent', 1).on = 1)))).toBeNull();
+      expect(simStateOf(storedWith(sim, s => ((s.outcomes as Json[])[1] = {...(s.outcomes as Json[])[1], on: 0})))).toBeNull();
+      expect(simStateOf(storedWith(sim, s => ((s.outcomes as Json[])[1] = {...(s.outcomes as Json[])[1], error: 'failed'})))).toBeNull();
+    });
+
+    it('never dependent: a failure in step 1 (nor on itself); one naming an account only a LATER step creates; an unrelated one; an expired blockhash stays expired', async () => {
+      const first = await batch([[tokenTransfer(DEST)], [ataIx(DEST, TO.toBase58(), NOC)]], call => (call === 1 ? invalid : null));
+      expect(first.outcomes[0]).toEqual({ok: false, error: 'failed', detail: '{"InstructionError":[0,"InvalidAccountData"]}'});
+      const itself = await batch([[ataIx(DEST, TO.toBase58(), NOC), tokenTransfer(DEST)]], () => ({InstructionError: [1, 'InvalidAccountData']}));
+      expect(itself.outcomes[0]).toMatchObject({ok: false, error: 'failed'});
+      const later = await batch([[SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})], [tokenTransfer(DEST)], [ataIx(DEST, TO.toBase58(), NOC)]], call => (call === 2 ? invalid : null));
+      expect(later.outcomes[1]).toMatchObject({ok: false, error: 'failed'});
+      const unrelated = await batch([[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(keyOf(54))]], call => (call === 2 ? invalid : null));
+      expect(unrelated.outcomes[1]).toMatchObject({ok: false, error: 'failed'});
+      const expired = await batch([[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(DEST)]], call => (call === 2 ? 'BlockhashNotFound' : null));
+      expect(expired.outcomes[1]).toEqual({ok: false, error: 'expired', detail: '"BlockhashNotFound"'});
+      for (const sim of [first, itself, later, unrelated, expired]) {
+        expect(dependent(sim)).toBe(false);
+        expect(sim.reasons).not.toContain('override');
+      }
+    });
+
+    it('the instruction the error names decides — its own resolved accounts, never another instruction’s', async () => {
+      const txs = [[ataIx(DEST, TO.toBase58(), NOC)], [SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1}), tokenTransfer(DEST)]];
+      expect((await batch(txs, call => (call === 2 ? {InstructionError: [0, {Custom: 1}]} : null))).outcomes[1]).toMatchObject({error: 'failed'});
+      expect((await batch(txs, call => (call === 2 ? {InstructionError: [1, {Custom: 1}]} : null))).outcomes[1]).toMatchObject({error: 'dependent', on: 1});
+    });
+
+    it('only the shapes Agave’s TransactionError takes for it: InstructionError [index, error], and AccountNotFound for a fee payer an earlier step creates; anything else is a plain failure', async () => {
+      const txs = [[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(DEST)]];
+      for (const err of [{InstructionError: ['0', 'InvalidAccountData']}, {InstructionError: [0]}, {InstructionError: [0, 'X', 1]}, {InstructionError: [1, 'X']}, {InstructionError: [-1, 'X']}, {InstructionError: [0.5, 'X']}, {InstructionError: [0, 'X'], extra: 1}, 'InvalidAccountForFee', 'ProgramAccountNotFound', {InsufficientFundsForRent: {account_index: 1}}, 'AccountNotFound']) {
+        const sim = await batch(txs, call => (call === 2 ? err : null));
+        expect([err, sim.outcomes[1]]).toEqual([err, {ok: false, error: 'failed', detail: JSON.stringify(err)}]);
+      }
+      // AccountNotFound: the fee payer has no lamports — attributable when an earlier step creates it.
+      const payer = new PublicKey(keyOf(55));
+      const fund = SystemProgram.createAccount({fromPubkey: ME, newAccountPubkey: payer, lamports: 1_000_000, space: 0, programId: SystemProgram.programId});
+      const spend = SystemProgram.transfer({fromPubkey: payer, toPubkey: TO, lamports: 1});
+      const sim = await batch([[fund], [spend]], call => (call === 2 ? 'AccountNotFound' : null), [undefined, payer]);
+      expect(sim.outcomes[1]).toEqual({ok: false, error: 'dependent', on: 1, detail: '"AccountNotFound"'});
+      // The same error when no earlier step creates the fee payer: a plain failure.
+      const other = await batch([[SystemProgram.transfer({fromPubkey: ME, toPubkey: payer, lamports: 1})], [spend]], call => (call === 2 ? 'AccountNotFound' : null), [undefined, payer]);
+      expect(other.outcomes[1]).toMatchObject({error: 'failed'});
+    });
+
+    it('every creator counts — System createAccount / createAccountWithSeed, ATA create / createIdempotent, Token initializeAccount / 2 / 3; a step that only pays the account does not', async () => {
+      const dest = new PublicKey(DEST);
+      const owner = Array.from(ME.toBytes());
+      const creators: [string, TransactionInstruction][] = [
+        ['createAccount', SystemProgram.createAccount({fromPubkey: ME, newAccountPubkey: dest, lamports: 2_039_280, space: 165, programId: new PublicKey(TOKEN_PROGRAM)})],
+        ['createAccountWithSeed', SystemProgram.createAccountWithSeed({fromPubkey: ME, newAccountPubkey: dest, basePubkey: ME, seed: 'noc', lamports: 2_039_280, space: 165, programId: new PublicKey(TOKEN_PROGRAM)})],
+        ['create', ataIx(DEST, TO.toBase58(), NOC, 0)],
+        ['createIdempotent', ataIx(DEST, TO.toBase58(), NOC, 1)],
+        ['initializeAccount', tokenIx([1], [DEST, NOC, ME.toBase58(), SYSVAR_RENT_PUBKEY.toBase58()])],
+        ['initializeAccount2', tokenIx([16, ...owner], [DEST, NOC, SYSVAR_RENT_PUBKEY.toBase58()])],
+        ['initializeAccount3', tokenIx([18, ...owner], [DEST, NOC])],
+      ];
+      for (const [name, ix] of creators) {
+        const sim = await batch([[ix], [tokenTransfer(DEST)]], call => (call === 2 ? invalid : null));
+        expect([name, sim.outcomes[1]]).toEqual([name, {ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'}]);
+      }
+      const pays = await batch([[SystemProgram.transfer({fromPubkey: ME, toPubkey: dest, lamports: 2_039_280})], [tokenTransfer(DEST)]], call => (call === 2 ? invalid : null));
+      expect(pays.outcomes[1]).toMatchObject({error: 'failed'});
+    });
+  });
+});
````

`extension/src/background/dapp/__tests__/signTx.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/signTx.test.ts b/extension/src/background/dapp/__tests__/signTx.test.ts
index 9410f37..5c41a64 100644
--- a/extension/src/background/dapp/__tests__/signTx.test.ts
+++ b/extension/src/background/dapp/__tests__/signTx.test.ts
@@ -1,11 +1,11 @@
 import {ed25519} from '@noble/curves/ed25519.js';
 import {base58, base64} from '@scure/base';
-import {VersionedTransaction} from '@solana/web3.js';
+import {PublicKey, SystemProgram, VersionedTransaction} from '@solana/web3.js';
 import {AUTOLOCK_ALARM, lock} from '../../autolock';
 import {GRANTS_KEY, type Grant} from '../grants';
 import {runtimeFor} from '../ports';
 import {DAPP_SESSION_KEY, readDappSession} from '../store';
-import {SIM_REFRESH_MS, SIM_RETRY_MS, SIM_VALID_MS, dappAbout, dappDigest, withSignature} from '../signTx';
+import {SIM_REFRESH_MS, SIM_RETRY_MS, SIM_VALID_MS, dappAbout, dappDigest, outgoingGrew, withSignature} from '../signTx';
 import {MAX_DAPP_OUTGOING, issueChallenge} from '../../reauthChallenges';
 import {REAUTH_KEY} from '../../session';
 import {ACCOUNT, RECIPIENT} from '../../__tests__/fixtures';
@@ -528,6 +528,55 @@ describe('re-authentication for a transaction request', () => {
   });
 });
 
+// B1c-3 (the final review's minor): #10 lists at most MAX_DAPP_OUTGOING mints and counts the rest — a refresh that
+// adds a mint past the list moves nothing listed, but the description no longer covers it.
+describe('outgoingGrew', () => {
+  const row = {mint: null, symbol: 'SOL' as const, amount: '5', decimals: 9};
+  it('a mint more cut from the list (omitted grew) is growth; the same count, or fewer, is not', () => {
+    expect(outgoingGrew({outgoing: [row], omitted: 1}, {outgoing: [row], omitted: 0})).toBe(true);
+    expect(outgoingGrew({outgoing: [row], omitted: 1}, {outgoing: [row], omitted: 1})).toBe(false);
+    expect(outgoingGrew({outgoing: [row], omitted: 0}, {outgoing: [row], omitted: 1})).toBe(false);
+    // B1c-2's rule unchanged: a listed amount that grew.
+    expect(outgoingGrew({outgoing: [{...row, amount: '6'}], omitted: 0}, {outgoing: [row], omitted: 0})).toBe(true);
+  });
+});
+
+// Brief "Carried items" (B1c-3): a durable-nonce transaction against the 30 s refresh and Q21. The proxy simulates with
+// replaceRecentBlockhash: false (core/solana/rpc.ts; pinned by core's rpc.test.ts), so the node checks a nonce
+// transaction's blockhash against its nonce account, not against the recent-blockhash queue: its age never expires it,
+// and the wallet derives no expiry of its own. Only the node's BlockhashNotFound does — the nonce advanced or the
+// account closed, so the transaction can never land: Q21 is then the truth.
+describe('a durable-nonce transaction and the refresh (Q21)', () => {
+  const nonceTx = () => v0([SystemProgram.nonceAdvance({noncePubkey: new PublicKey(new Uint8Array(32).fill(61)), authorizedPubkey: ME}), transfer(1)]);
+
+  it('every refresh stays simulated — never expired by age; the warning is stored with each; approvable', async () => {
+    const c = await txScene({known: [RECIPIENT]});
+    const requestId = String((await c.signTx('t', [nonceTx()]))?.requestId);
+    let id = String((await c.simulated()).request?.tx?.simulation.id);
+    for (let n = 0; n < 3; n++) {
+      c.deps.clock.t += SIM_REFRESH_MS;
+      const view = await c.simulated(id);
+      id = String(view.request?.tx?.simulation.id);
+      expect((view.request?.tx?.transactions as {outcome: unknown}[])[0]?.outcome).toMatchObject({ok: true});
+      const e = await c.entry(requestId);
+      expect(e?.sim?.status === 'ok' ? e.sim.sim.flags[0]?.map(f => f.kind) : null).toContain('durable-nonce');
+    }
+    expect(c.chain.calls.get('simulateTransaction')).toBe(4);
+    expect(await c.approve(requestId, id)).toEqual({ok: true});
+  });
+
+  it('the node’s own BlockhashNotFound (the nonce advanced) is expired, as for any transaction: Reject only', async () => {
+    const c = await txScene({known: [RECIPIENT]});
+    const requestId = String((await c.signTx('t', [nonceTx()]))?.requestId);
+    const id = String((await c.simulated()).request?.tx?.simulation.id);
+    c.chain.err = 'BlockhashNotFound';
+    c.deps.clock.t += SIM_REFRESH_MS;
+    const view = await c.simulated(id);
+    expect((view.request?.tx?.transactions as {outcome: unknown}[])[0]?.outcome).toEqual({ok: false, error: 'expired', detail: '"BlockhashNotFound"'});
+    expect(await c.approve(requestId, view.request?.tx?.simulation.id)).toEqual({ok: false, error: 'blockhash-expired'});
+  });
+});
+
 describe('#48’s other views', () => {
   // Fix round 1, test hygiene item 5: retitled to what this actually checks — a queued signTransaction request is
   // swept the same way a connect/signMessage one is (there is no reachable "locked, a queued tx shows only its
````

`extension/src/background/__tests__/reauthChallenges.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/reauthChallenges.test.ts b/extension/src/background/__tests__/reauthChallenges.test.ts
index fc74a05..89d9f1d 100644
--- a/extension/src/background/__tests__/reauthChallenges.test.ts
+++ b/extension/src/background/__tests__/reauthChallenges.test.ts
@@ -3,17 +3,18 @@ import {lock} from '../autolock';
 import {REAUTH_KEY} from '../session';
 import {CHALLENGE_TTL_MS, type ChallengeAbout, type DappOutgoing, challengeSatisfied, consumeChallenge, dropChallenge, issueChallenge, satisfyChallenge} from '../reauthChallenges';
 import {WALLET_TOKENS} from '../../../../core/solana/balances';
+import type {DappReauthReason} from '../reauthPolicy';
 import {fakeDeps} from './fakeDeps';
 import {fakeExt} from './fakeExt';
 
-const dappAbout = (outgoing: DappOutgoing[]): ChallengeAbout => ({
+const dappAbout = (outgoing: DappOutgoing[], reasons: DappReauthReason[] = ['first-send']): ChallengeAbout => ({
   kind: 'dapp',
   account: ACCOUNT.publicKey,
   site: 'dapp.test',
   transactions: 1,
   outgoing,
   omitted: 0,
-  reasons: ['first-send'],
+  reasons,
   thresholdCents: 10_000,
 });
 
@@ -199,4 +200,15 @@ describe('re-auth challenges', () => {
       await expect(issueChallenge(ext, deps, 'e4', dappAbout([{mint: WALLET_TOKENS.NOC.mint, symbol: 'NOC', amount: '1', decimals: WALLET_TOKENS.USDC.decimals}]))).rejects.toThrow();
     });
   });
+
+  // B1c-3 (spec §3.3 rev 3.6, the override rule): `override` — a request with a block — is a dApp reason like the others.
+  it('a dApp challenge for `override` is issued and read back from the store; an unknown reason is never issued', async () => {
+    const ext = fakeExt();
+    const deps = fakeDeps();
+    const sol: DappOutgoing = {mint: null, symbol: 'SOL', amount: '1', decimals: WALLET_TOKENS.SOL.decimals};
+    const id = await issueChallenge(ext, deps, 'o1', dappAbout([sol], ['approval', 'override']));
+    expect(await satisfyChallenge(ext, deps.now(), id)).toBe(true);
+    expect(await challengeSatisfied(ext, deps.now(), id, 'o1')).toBe(true);
+    await expect(issueChallenge(ext, deps, 'o2', dappAbout([sol], ['overrides'] as unknown as DappReauthReason[]))).rejects.toThrow();
+  });
 });
````

`extension/src/unlock/__tests__/challenge.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/challenge.test.ts b/extension/src/unlock/__tests__/challenge.test.ts
index c6c3a52..ceec0e2 100644
--- a/extension/src/unlock/__tests__/challenge.test.ts
+++ b/extension/src/unlock/__tests__/challenge.test.ts
@@ -77,6 +77,14 @@ describe('describeChallenge: a dApp’s transaction (B1c-2)', () => {
   });
 });
 
+// B1c-3 (spec §3.3 rev 3.6): a request with a block re-authenticates with the reason `override` (Q33).
+describe('describeChallenge: the override reason (B1c-3)', () => {
+  it('`override` reads Q33’s line; an unknown reason still makes the whole description unshowable', () => {
+    expect(describeChallenge({...DAPP, reasons: ['approval', 'override']})).toMatchObject({kind: 'dapp', reasons: ['Re-auth required to approve a token allowance.', 'Re-auth required to override a blocked transaction.']});
+    expect(describeChallenge({...DAPP, reasons: ['override', 'overrides']})).toBeNull();
+  });
+});
+
 // Final review I2: #10 accepts every site the background can issue (shared/site.ts — the same shape on all three sides).
 describe('describeChallenge: a dApp’s site is any host `new URL` gives an https origin', () => {
   it('an underscore host, an IPv6 literal with a port, punycode: described; a path, a space, credentials, a query: refused', () => {
````

`extension/src/approve/__tests__/tx.test.tsx`:

````diff
diff --git a/extension/src/approve/__tests__/tx.test.tsx b/extension/src/approve/__tests__/tx.test.tsx
index d72d86d..adede35 100644
--- a/extension/src/approve/__tests__/tx.test.tsx
+++ b/extension/src/approve/__tests__/tx.test.tsx
@@ -418,6 +418,41 @@ describe('#48 dapp-tx-approval', () => {
     expect(pendingOf({state: 'request', waiting: 0, windowNotice: false, request})).toBeNull();
   });
 
+  // B1c-3: the window's own list of re-authentication reasons (one of the four places a reason is named) and the
+  // dependent step's outcome (F10) — read strictly, like everything else the background sends.
+  it('pendingOf: `override` and a dependent step’s outcome are read; an unknown reason, or a dependent outcome naming no earlier step, is refused', () => {
+    const view = (reasons: unknown[], outcome: unknown) => ({
+      state: 'request',
+      waiting: 0,
+      windowNotice: false,
+      request: {
+        requestId: 'x',
+        type: 'signTransaction',
+        origin: 'https://jup.ag',
+        host: 'jup.ag',
+        site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
+        offerBlock: false,
+        connect: null,
+        sign: null,
+        mismatch: null,
+        tx: {
+          kind: 'signTransaction',
+          account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
+          simulation: {status: 'ok', id: 'AAAAAAAAAAAAAAAAAAAAAA', slot: 1, elapsedMs: 1, at: 1},
+          reauth: {reasons, state: 'needed'},
+          labels: [],
+          transactions: [{version: 0, feePayer: ACCOUNT.publicKey, unitLimit: null, feeLamports: null, outcome, instructions: []}],
+        },
+      },
+    });
+    const dependent = {ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'};
+    const read = pendingOf(view(['first-send', 'override'], dependent));
+    expect(read?.state === 'request' ? [read.request.tx?.reauth?.reasons, read.request.tx?.transactions[0]?.outcome] : null).toEqual([['first-send', 'override'], dependent]);
+    expect(pendingOf(view(['overrides'], null))).toBeNull();
+    expect(pendingOf(view(['override'], {...dependent, on: 0}))).toBeNull();
+    expect(pendingOf(view(['override'], {ok: false, error: 'dependent', detail: 'x'}))).toBeNull();
+  });
+
   // Fix round 1, I2: the sheet is for exactly the simulation it opened on; a refresh landing while it is open must
   // close it (or, if a captured click still slips in, the background refuses it `stale`) — never sign effects the
   // user never saw.
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/background/dapp/__tests__/simulate.test.ts src/background/dapp/__tests__/signTx.test.ts src/background/__tests__/reauthChallenges.test.ts src/unlock/__tests__/challenge.test.ts src/approve/__tests__/tx.test.tsx` — expected: Test Files  5 failed (5) · Tests  23 failed | 124 passed (147). The 23: the 14 new simulate tests and the 4 updated ones (reads, close authority, two owner reassignments — `override` missing / no mint read), `outgoingGrew is not a function`, the nonce refresh test (`flags` undefined), `issueChallenge: malformed about`, the #10 line (undefined), `pendingOf` → null. The second nonce test (the node's BlockhashNotFound → expired) passes on the old tree: it pins behaviour this task must keep. `npx tsc --noEmit; echo $?` → `2` (the tests name `outgoingGrew`, `flags`, `'override'`, not yet there).

- [ ] **Step 3: Implement.**

§3.3 "Attribution" — the exact list the spec left to plan 3:

`docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md`:

````diff
diff --git a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
index 7c03645..6e7b723 100644
--- a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
+++ b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
@@ -624,12 +624,14 @@ proxy (`getMultipleAccounts`). The window only renders the flags stored with the
 | F10 | simulation failed and the user continues | **O2:** only a failure attributable to an earlier transaction of the same batch (below) has a continue path; every other failure stays Reject-only — stricter than B1 §3's warning, which is allowed. An expired blockhash anywhere: Reject only | **blocked** | `UNCHECKED` (Q31) |
 | F11 | request origin differs from the granted origin | built in B1c-1 / B1c-2 | **blocked, no override** | — |
 
-- **Attribution (F10, O2).** Transaction *k* (*k* ≥ 2) of a batch failed with an `InstructionError` naming instruction
-  *i* — or with one of the top-level errors a node returns for an account that does not exist, exactly as plan 3
-  lists them from Agave's `TransactionError` — **and** instruction *i*'s resolved accounts intersect the accounts that
-  transactions 1 … *k*−1 of the same batch create: System `createAccount` / `createAccountWithSeed` (the new account),
+- **Attribution (F10, O2).** Transaction *k* (*k* ≥ 2) of a batch failed with exactly one of two errors of Agave's
+  `TransactionError`, in the JSON the RPC returns — `{"InstructionError": [i, <any InstructionError>]}` (instruction
+  *i* of the message, an index of one of its instructions), whose named accounts are instruction *i*'s resolved
+  accounts; or `"AccountNotFound"` (the fee payer holds no lamports), whose named account is the fee payer — **and**
+  the named accounts intersect the accounts that transactions 1 … *k*−1 of the same batch create: System `createAccount` / `createAccountWithSeed` (the new account),
   ATA `create` / `createIdempotent` (the account), Token / Token-2022 `initializeAccount`, `initializeAccount2`,
-  `initializeAccount3` (the account). Then step *k* reads "This step depends on step <N> and could not be checked on
+  `initializeAccount3` (the account); *N* is the earliest such transaction. Any other error, or any other shape of
+  these two, is a plain failure. Then step *k* reads "This step depends on step <N> and could not be checked on
   its own." (Q32), shows no balance changes (they are unknown, and it says so) and F10 blocks it. A dependent step's
   effects are unknown, so the request always re-authenticates. Every other failure: Reject only, as B1c-2.
 - **The override rule (B1 §3, O1).** Each blocked transaction carries its own typed field, in its own section of the
````

`extension/src/background/dapp/simulate.ts`:

````diff
diff --git a/extension/src/background/dapp/simulate.ts b/extension/src/background/dapp/simulate.ts
index 47961aa..c59ab53 100644
--- a/extension/src/background/dapp/simulate.ts
+++ b/extension/src/background/dapp/simulate.ts
@@ -2,10 +2,11 @@ import {base64, base64urlnopad} from '@scure/base';
 import type {WalletDeps} from '../deps';
 import {dappReauthReasons, usdMicros, type DappReauthReason} from '../reauthPolicy';
 import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../core/presale/addresses';
-import type {AccountData} from '../../../../core/solana/rpc';
+import {MAX_MULTIPLE_ACCOUNTS, type AccountData} from '../../../../core/solana/rpc';
 import {COMPUTE_BUDGET_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, decodeInstructions, type DecodedInstruction} from './decode/decode';
 import {ADDRESS_LOOKUP_TABLE_PROGRAM, resolveKeys, tableAddresses, tablesOf} from './decode/keys';
 import {isWritableIndex, type ParsedTx} from './decode/wire';
+import {expectedOverrides, flagMints, redFlagsOf, storedFlagsOf, type FlagOutcome, type RedFlag, type TxFlagInput} from './redFlags';
 import {mintInfo, tokenAccountInfo} from './tokenState';
 
 /**
@@ -28,6 +29,9 @@ import {mintInfo, tokenAccountInfo} from './tokenState';
  * `approval` from chain state too (a new or raised delegation, a changed close authority, or an own account's owner
  * reassigned away — fix round 2, ruled-in: a dApp program can CPI an Approve, a SetAuthority close-authority change or a
  * SetAuthority AccountOwner with no top-level instruction that names it) — so `dapp.decide` needs no read of its own.
+ * B1c-3 (spec §3.3 rev 3.6): the red flags (redFlags.ts) are computed here too, from the same reads plus one read of
+ * every mint they need, and stored with the simulation; a block adds the reason `override`. A failed transaction of a
+ * batch whose error names an account an earlier transaction creates is `dependent` (F10).
  */
 export const DEFAULT_UNITS_PER_INSTRUCTION = 200_000;
 export const MAX_COMPUTE_UNITS = 1_400_000;
@@ -51,7 +55,9 @@ export interface BalanceChange {
 export type TxOutcome =
   | {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null}
   /** `expired`: the node does not know the transaction's blockhash any more (Q21); `failed`: it ran and failed. */
-  | {ok: false; error: 'expired' | 'failed'; detail: string};
+  | {ok: false; error: 'expired' | 'failed'; detail: string}
+  /** B1c-3 (F10): it failed on an account transaction `on` (1-based) of the same batch creates — its effects unknown. */
+  | {ok: false; error: 'dependent'; on: number; detail: string};
 
 export interface TxSimulation {
   /** 128 random bits: `dapp.decide` names the simulation the window showed (stale → refused). */
@@ -63,6 +69,8 @@ export interface TxSimulation {
   keys: (string | null)[][];
   outcomes: TxOutcome[];
   reasons: DappReauthReason[];
+  /** B1c-3: per transaction, its red flags (redFlags.ts), in the order the window shows them. */
+  flags: RedFlag[][];
   /** An upper bound of the dApp blockhash's last valid height (the latest blockhash's, read now): a pending send's expiry check waits at least this long. */
   lastValidBlockHeight: number;
 }
@@ -132,6 +140,31 @@ export function feeOf(p: ParsedTx, decoded: readonly DecodedInstruction[]): {fee
 /** The node's own word for an unknown blockhash (Q21). */
 const isExpired = (err: unknown): boolean => err === 'BlockhashNotFound';
 
+/** The account an instruction creates (F10's creators, spec §3.3 "Attribution"), or null. */
+function createdBy(ix: DecodedInstruction): string | null {
+  if (ix.program === 'system' && (ix.name === 'createAccount' || ix.name === 'createAccountWithSeed')) return addressField(ix, 'newAccount');
+  if (ix.program === 'associated-token' && (ix.name === 'create' || ix.name === 'createIdempotent')) return addressField(ix, 'account');
+  if ((ix.program === 'token' || ix.program === 'token-2022') && (ix.name === 'initializeAccount' || ix.name === 'initializeAccount2' || ix.name === 'initializeAccount3')) return addressField(ix, 'account');
+  return null;
+}
+
+/**
+ * The accounts a simulation's error names, for F10's attribution — null for every other error. Agave's
+ * `TransactionError` as the RPC returns it (serde's JSON; mirrored by @solana/errors' `transaction-error.ts`, "Keep
+ * synced with RPC source: agave/sdk/src/transaction/error.rs"): `{"InstructionError": [i, <InstructionError>]}` —
+ * instruction i of the message failed: its resolved accounts; `"AccountNotFound"` — the fee payer holds no lamports
+ * (Agave's fee-payer check): the fee payer. Nothing else names an account a transaction could have created.
+ */
+function accountsNamed(err: unknown, p: ParsedTx, keys: readonly (string | null)[]): string[] | null {
+  if (err === 'AccountNotFound') return p.staticKeys.slice(0, 1);
+  if (typeof err !== 'object' || err === null || Array.isArray(err) || Object.keys(err).length !== 1) return null;
+  const pair: unknown = (err as Record<string, unknown>).InstructionError;
+  if (!Array.isArray(pair) || pair.length !== 2) return null;
+  const i: unknown = pair[0];
+  const ix = typeof i === 'number' && Number.isSafeInteger(i) && i >= 0 ? p.instructions[i] : undefined;
+  return ix === undefined ? null : ix.accounts.map(a => keys[a] ?? null).filter((a): a is string => a !== null);
+}
+
 /** USD per whole token for a change's fiat line and the dollar rule: SOL (and wrapped SOL), USDC, USDT, NOC at the stage price; else none. */
 async function pricesFor(deps: Pick<WalletDeps, 'prices' | 'stagePrice'>): Promise<(mint: string | null) => number | undefined> {
   const [p, stage] = await Promise.all([deps.prices().catch(() => null), deps.stagePrice().catch(() => null)]);
@@ -182,12 +215,14 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
   // 3. Each transaction.
   let slot = 0;
   const outcomes: TxOutcome[] = [];
-  const decodedAll: DecodedInstruction[][] = [];
+  const flagInputs: TxFlagInput[] = [];
+  /** Per transaction, the accounts it creates (F10). */
+  const created: Set<string>[] = [];
   let approvalFromChain = false;
   for (const [i, p] of input.txs.entries()) {
     const keys = resolved[i]?.keys ?? [];
     const decoded = decodeInstructions(p, {keys});
-    decodedAll.push(decoded);
+    created.push(new Set(decoded.map(createdBy).filter((a): a is string => a !== null)));
     const writable = [...new Set(keys.filter((k, j): k is string => k !== null && k !== account && isWritableIndex(p, j)))];
     const addresses = [account, ...writable];
     // Fix round 1 (I1, I2): the pre state is read fresh, immediately before THIS transaction's own simulation, for
@@ -196,13 +231,24 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
     // paired index-for-index with a transaction's own writable set (an own account the snapshot does not cover would
     // otherwise show +post instead of post − pre).
     const preAccounts = await deps.reader.getAccountsData(addresses);
+    const pre = new Map(addresses.map((a, j) => [a, preAccounts[j] ?? null]));
+    const firstSend = firstSendOf(decoded, pre, account, input.known, a => before.has(a));
     const sim = await deps.reader.simulateTransaction(base64.encode(input.wires[i] ?? new Uint8Array()), {accounts: addresses});
     slot = Math.max(slot, sim.slot);
     if (sim.err !== null) {
-      outcomes.push({ok: false, error: isExpired(sim.err) ? 'expired' : 'failed', detail: JSON.stringify(sim.err)});
+      const detail = JSON.stringify(sim.err);
+      // F10 (O2): a transaction k ≥ 2 whose error names an account an earlier transaction of the batch creates — the
+      // earliest such step. An expired blockhash is never dependent.
+      const named = isExpired(sim.err) ? null : accountsNamed(sim.err, p, keys);
+      const on = named === null ? -1 : created.slice(0, i).findIndex(c => named.some(a => c.has(a)));
+      const outcome: TxOutcome = isExpired(sim.err) ? {ok: false, error: 'expired', detail} : on >= 0 ? {ok: false, error: 'dependent', on: on + 1, detail} : {ok: false, error: 'failed', detail};
+      outcomes.push(outcome);
+      flagInputs.push({tx: p, decoded, pre, outcome: on >= 0 ? {status: 'dependent', on} : {status: 'failed'}, firstSend});
       continue;
     }
     const post = sim.accounts ?? [];
+    const flagOutcome: FlagOutcome = {status: 'simulated', post: new Map(addresses.map((a, j) => [a, post[j] ?? null]))};
+    flagInputs.push({tx: p, decoded, pre, outcome: flagOutcome, firstSend});
     const delta = new Map<string | null, bigint>();
     const add = (mint: string | null, d: bigint) => delta.set(mint, (delta.get(mint) ?? 0n) + d);
     const selfPre = preAccounts[0] ?? null;
@@ -255,14 +301,17 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
     const changes: {mint: string | null; amount: bigint}[] = [...delta].filter(([, d]) => d !== 0n).map(([mint, amount]) => ({mint, amount}));
     outcomes.push({ok: true, changes: changes.map(c => ({mint: c.mint, amount: c.amount.toString(), decimals: null, usdMicros: null})), unitsConsumed: sim.unitsConsumed, unitLimit, feeLamports: p.signers[0] === account ? feeLamports.toString() : null});
   }
-  // 4. Decimals the holdings did not tell (a mint the account did not hold before), read once.
+  // 4. The mints, read once: every one the red flags need (the wallet's own tokens too — F5's word compares the mint's
+  // own decimals with the wallet's table) and the decimals the holdings did not tell (a mint the account did not hold
+  // before). At most one read's worth: a mint past MAX_MULTIPLE_ACCOUNTS is not read — it warns that it could not be
+  // read (Q36) and its amounts stay in base units (fail closed, never an unreachable proxy).
   const unknownMints = [...new Set(outcomes.flatMap(o => (o.ok ? o.changes.map(c => c.mint) : [])).filter((m): m is string => m !== null && !decimals.has(m)))];
-  if (unknownMints.length > 0) {
-    const mints = await deps.reader.getAccountsData(unknownMints);
-    unknownMints.forEach((m, i) => {
-      const d = mintDecimals(mints[i] ?? null);
-      if (d !== null) decimals.set(m, d);
-    });
+  const wanted = [...new Set([...flagMints({account, txs: flagInputs}), ...unknownMints])].slice(0, MAX_MULTIPLE_ACCOUNTS);
+  const mintData = wanted.length > 0 ? await deps.reader.getAccountsData(wanted) : [];
+  const mints = new Map(wanted.map((m, i) => [m, mintData[i] ?? null]));
+  for (const m of unknownMints) {
+    const d = mintDecimals(mints.get(m) ?? null);
+    if (d !== null) decimals.set(m, d);
   }
   // 5. Decimals and dollars on every change; the outgoing totals per mint for the rules.
   const outgoing = new Map<string | null, bigint>();
@@ -278,15 +327,8 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
       if (amount < 0n) outgoing.set(c.mint, (outgoing.get(c.mint) ?? 0n) - amount);
     }
   }
-  const firstSend = decodedAll.some(list =>
-    list.some(ix => {
-      const from = ix.program === 'system' && ix.name === 'transfer' ? addressField(ix, 'from') : (ix.program === 'token' || ix.program === 'token-2022') && (ix.name === 'transfer' || ix.name === 'transferChecked') ? addressField(ix, 'owner') : null;
-      const to = ix.program === 'system' ? addressField(ix, 'to') : addressField(ix, 'destination');
-      // An own token account (held before) is not a recipient.
-      return from === account && to !== null && !input.known(to) && !before.has(to);
-    }),
-  );
-  const reasons = dappReauthReasons({
+  const firstSend = flagInputs.some(t => t.firstSend);
+  const base = dappReauthReasons({
     outgoing: [...outgoing].map(([mint, amount]) => {
       const d = mint === null ? 9 : (decimals.get(mint) ?? null);
       return {amount, balance: balanceOf(mint), usdMicros: d === null ? null : usdMicros(amount, d, priceOf(mint))};
@@ -295,6 +337,9 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
     approval: approvalFromChain,
     thresholdCents: input.thresholdCents,
   });
+  const flags = redFlagsOf({account, txs: flagInputs, mints, reasons: base});
+  // The override rule (spec §3.3): a request with any block re-authenticates — a dependent step is always one.
+  const reasons: DappReauthReason[] = expectedOverrides(flags).length > 0 ? [...base, 'override'] : base;
   return {
     id: base64urlnopad.encode(deps.randomBytes(16)),
     at: deps.now(),
@@ -303,14 +348,43 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
     keys: resolved.map(r => r.keys),
     outcomes,
     reasons,
+    flags,
     lastValidBlockHeight: latest.lastValidBlockHeight,
   };
 }
 
+/**
+ * B1b's first-send rule for one transaction (F9 is per transaction): a decoded System transfer from the account to an
+ * address it never sent to, or a Token / Token-2022 transfer signed by the account whose destination's OWNER is not
+ * one (R10, spec §9): the destination's pre-state as a token account gives its owner field; absent before and created
+ * in the same transaction by an ATA create / createIdempotent, that instruction's wallet. A destination unreadable, not
+ * a token account, or not created by the transaction is a first send (fail closed). `known`: B1b's recipients; `held`:
+ * the account's own token accounts in the holdings snapshot (never a recipient).
+ */
+function firstSendOf(decoded: readonly DecodedInstruction[], pre: ReadonlyMap<string, AccountData | null>, account: string, known: (address: string) => boolean, held: (address: string) => boolean): boolean {
+  const ownerOf = (destination: string): string | null => {
+    const state = pre.get(destination) ?? null;
+    if (state !== null) return tokenAccountInfo(state.data, state.owner)?.owner ?? null;
+    const creating = decoded.find(ix => ix.program === 'associated-token' && (ix.name === 'create' || ix.name === 'createIdempotent') && addressField(ix, 'account') === destination);
+    return creating === undefined ? null : addressField(creating, 'wallet');
+  };
+  return decoded.some(ix => {
+    if (ix.program === 'system' && ix.name === 'transfer') {
+      const to = addressField(ix, 'to');
+      return addressField(ix, 'from') === account && to !== null && !known(to) && !held(to);
+    }
+    if ((ix.program !== 'token' && ix.program !== 'token-2022') || (ix.name !== 'transfer' && ix.name !== 'transferChecked') || addressField(ix, 'owner') !== account) return false;
+    const to = addressField(ix, 'destination');
+    if (to === null || held(to)) return false;
+    const owner = ownerOf(to);
+    return owner === null || !(owner === account || known(owner));
+  });
+}
+
 /** What an entry holds (store.ts): the newest simulation, or that the last attempt could not reach the proxy. */
 export type SimState = {status: 'ok'; sim: TxSimulation} | {status: 'unreachable'; at: number};
 
-const REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new', 'approval'];
+const REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new', 'approval', 'override'];
 const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
 const isIntOrNull = (x: unknown): x is number | null => x === null || isInt(x);
 const SIGNED = /^-?\d{1,40}$/;
@@ -328,6 +402,7 @@ function changeOf(x: unknown): BalanceChange | null {
 function outcomeOf(x: unknown): TxOutcome | null {
   const o = obj(x);
   if (o === null) return null;
+  if (o.ok === false && o.error === 'dependent') return isInt(o.on) && o.on >= 1 && typeof o.detail === 'string' ? {ok: false, error: 'dependent', on: o.on, detail: o.detail} : null;
   if (o.ok === false) return (o.error === 'expired' || o.error === 'failed') && typeof o.detail === 'string' ? {ok: false, error: o.error, detail: o.detail} : null;
   if (o.ok !== true || !Array.isArray(o.changes) || !isIntOrNull(o.unitsConsumed) || !isInt(o.unitLimit) || !(o.feeLamports === null || (typeof o.feeLamports === 'string' && DIGITS.test(o.feeLamports)))) return null;
   const changes = (o.changes as unknown[]).map(changeOf);
@@ -346,6 +421,17 @@ export function simStateOf(x: unknown): SimState | null {
   if (!Array.isArray(s.outcomes) || !Array.isArray(s.reasons) || !(s.reasons as unknown[]).every(r => typeof r === 'string' && REASONS.includes(r))) return null;
   const outcomes = (s.outcomes as unknown[]).map(outcomeOf);
   if (outcomes.some(x => x === null) || outcomes.length !== s.keys.length) return null;
+  // B1c-3: the flags, one list per transaction, each flag exactly as redFlagsOf gives it; a block ⇔ the reason
+  // `override`; a dependent outcome ⇔ its transaction's F10 flag naming the same step (the flag's `on` is 0-based).
+  const flags = Array.isArray(s.flags) ? (s.flags as unknown[]).map(storedFlagsOf) : null;
+  if (flags === null || flags.length !== outcomes.length || flags.some(f => f === null)) return null;
+  const lists = flags as RedFlag[][];
+  if (lists.some(l => l.some(f => f.severity === 'block')) !== (s.reasons as unknown[]).includes('override')) return null;
+  const stepsAgree = (outcomes as TxOutcome[]).every((o, i) => {
+    const on = lists[i]?.find(f => f.kind === 'dependent')?.on;
+    return !o.ok && o.error === 'dependent' ? on === o.on - 1 : on === undefined;
+  });
+  if (!stepsAgree) return null;
   return {
     status: 'ok',
     sim: {
@@ -356,6 +442,7 @@ export function simStateOf(x: unknown): SimState | null {
       keys: (s.keys as (string | null)[][]).map(k => k.slice()),
       outcomes: outcomes as TxOutcome[],
       reasons: (s.reasons as DappReauthReason[]).slice(),
+      flags: lists,
       lastValidBlockHeight: s.lastValidBlockHeight,
     },
   };
````

`extension/src/background/dapp/redFlags.ts`:

````diff
diff --git a/extension/src/background/dapp/redFlags.ts b/extension/src/background/dapp/redFlags.ts
index 74a28ad..0df74da 100644
--- a/extension/src/background/dapp/redFlags.ts
+++ b/extension/src/background/dapp/redFlags.ts
@@ -1,7 +1,7 @@
 import {tokenForMint, WALLET_TOKENS, type WalletToken} from '../../../../core/solana/balances';
 import type {AccountData} from '../../../../core/solana/rpc';
 import type {DappReauthReason} from '../reauthPolicy';
-import {SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, type DecodedInstruction, type ProgramKey} from './decode/decode';
+import {AUTHORITY_TYPES, SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, type DecodedInstruction, type ProgramKey} from './decode/decode';
 import type {ParsedTx} from './decode/wire';
 import {mintInfo, tokenAccountInfo, type TokenAccountInfo} from './tokenState';
 import {usesDurableNonce} from './txRequest';
@@ -286,3 +286,149 @@ export function overridesMatch(flags: readonly (readonly RedFlag[])[], given: re
   }
   return seen.size === expected.size ? 'ok' : 'missing';
 }
+
+type J = Record<string, unknown>;
+const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
+const DIGITS = /^\d{1,20}$/;
+const PROGRAM_KEYS: readonly string[] = ['system', 'token', 'token-2022', 'associated-token', 'compute-budget', 'presale'];
+const AUTHORITY_TYPE_NAMES: readonly string[] = ['', ...AUTHORITY_TYPES];
+const TOKENS: readonly string[] = Object.keys(WALLET_TOKENS);
+/** `x` as an object with exactly these keys, or null. */
+const exactly = (x: unknown, keys: readonly string[]): J | null => {
+  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
+  const o = x as J;
+  return Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k)) ? o : null;
+};
+const isIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
+const isIndexOrNull = (x: unknown): x is number | null => x === null || isIndex(x);
+const isAddress = (x: unknown): x is string => typeof x === 'string' && ADDRESS.test(x);
+const isAddressOrNull = (x: unknown): x is string | null => x === null || isAddress(x);
+/** Every item read by `f` (fresh), or null when any is not; `nonEmpty` refuses an empty list. */
+function listOf<T>(x: unknown, f: (v: unknown) => T | null, nonEmpty: boolean): T[] | null {
+  if (!Array.isArray(x) || (nonEmpty && x.length === 0)) return null;
+  const out: T[] = [];
+  for (const v of x as unknown[]) {
+    const r = f(v);
+    if (r === null) return null;
+    out.push(r);
+  }
+  return out;
+}
+
+function flaggedOf(x: unknown): FlaggedInstruction | null {
+  const o = exactly(x, ['index', 'program', 'name']);
+  if (o === null || !isIndex(o.index) || typeof o.program !== 'string' || !PROGRAM_KEYS.includes(o.program) || !(o.name === null || typeof o.name === 'string')) return null;
+  return {index: o.index, program: o.program as ProgramKey, name: o.name};
+}
+
+function authorityOf(x: unknown): AuthorityInstruction | null {
+  const o = exactly(x, ['index', 'program', 'account', 'owned', 'authorityType', 'newAuthority']);
+  if (o === null || !isIndex(o.index) || (o.program !== 'token' && o.program !== 'token-2022') || !isAddress(o.account) || !isAddressOrNull(o.newAuthority)) return null;
+  if ((o.owned !== 'token-account' && o.owned !== 'mint' && o.owned !== 'current-authority') || typeof o.authorityType !== 'string' || !AUTHORITY_TYPE_NAMES.includes(o.authorityType)) return null;
+  return {index: o.index, program: o.program, account: o.account, owned: o.owned, authorityType: o.authorityType, newAuthority: o.newAuthority};
+}
+
+function changeOf(x: unknown): AuthorityChange | null {
+  const o = exactly(x, ['account', 'change', 'from', 'to']);
+  if (o === null || !isAddress(o.account) || !isAddressOrNull(o.from) || !isAddressOrNull(o.to)) return null;
+  if (o.change !== 'owner' && o.change !== 'close-authority' && o.change !== 'mint-authority' && o.change !== 'freeze-authority') return null;
+  return {account: o.account, change: o.change, from: o.from, to: o.to};
+}
+
+function approvalOf(x: unknown): Approval | null {
+  const o = exactly(x, ['at', 'source', 'mint', 'symbol', 'decimals', 'delegate', 'amount', 'balance']);
+  if (o === null || !isIndexOrNull(o.at) || !isAddress(o.source) || !isAddressOrNull(o.mint) || !isAddressOrNull(o.delegate) || !(o.decimals === null || (isIndex(o.decimals) && o.decimals <= 255))) return null;
+  if (typeof o.amount !== 'string' || !DIGITS.test(o.amount) || typeof o.balance !== 'string' || !DIGITS.test(o.balance)) return null;
+  // The symbol is the wallet's own name for the mint, only at its own decimals (redFlagsOf's rule) — never another.
+  if (o.symbol !== null && (typeof o.symbol !== 'string' || !TOKENS.includes(o.symbol) || o.mint === null || tokenForMint(o.mint) !== o.symbol || o.decimals !== WALLET_TOKENS[o.symbol as WalletToken].decimals)) return null;
+  return {at: o.at, source: o.source, mint: o.mint, symbol: o.symbol as WalletToken | null, decimals: o.decimals, delegate: o.delegate, amount: o.amount, balance: o.balance};
+}
+
+function settingsOf(x: unknown): Token2022Settings | null {
+  const o = exactly(x, ['freezeAuthority', 'permanentDelegate', 'transferHookProgram']);
+  if (o === null || !isAddressOrNull(o.freezeAuthority) || !isAddressOrNull(o.permanentDelegate) || !isAddressOrNull(o.transferHookProgram)) return null;
+  if (o.freezeAuthority === null && o.permanentDelegate === null && o.transferHookProgram === null) return null;
+  return {freezeAuthority: o.freezeAuthority, permanentDelegate: o.permanentDelegate, transferHookProgram: o.transferHookProgram};
+}
+
+const firstAt = (approvals: readonly Approval[]): number | null => approvals.find(a => a.at !== null)?.at ?? null;
+
+/** One stored flag, rebuilt field by field (fresh objects) — null when its shape, its severity or its word is not what redFlagsOf gives. */
+function storedFlagOf(x: unknown): RedFlag | null {
+  const head = typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as J) : null;
+  if (head === null) return null;
+  switch (head.kind) {
+    case 'unknown-program': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'programs']);
+      const programs = listOf(o?.programs, v => (isAddressOrNull(v) ? {v} : null), true);
+      if (o === null || o.severity !== 'warn' || o.word !== null || !isIndex(o.at) || programs === null) return null;
+      return {kind: 'unknown-program', severity: 'warn', word: null, at: o.at, programs: programs.map(p => p.v)};
+    }
+    case 'non-transfer': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions']);
+      const instructions = listOf(o?.instructions, flaggedOf, true);
+      const first = instructions?.[0];
+      if (o === null || o.severity !== 'warn' || o.word !== null || first === undefined || o.at !== first.index || instructions === null) return null;
+      return {kind: 'non-transfer', severity: 'warn', word: null, at: first.index, instructions};
+    }
+    case 'assign': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions', 'chain']);
+      const instructions = listOf(o?.instructions, v => {
+        const f = flaggedOf(v);
+        return f !== null && f.program === 'system' && f.name !== null && ASSIGNS.includes(f.name) ? f : null;
+      }, false);
+      if (o === null || o.severity !== 'block' || o.word !== OVERRIDE_WORDS.assign || instructions === null) return null;
+      let chain: {owner: string; space: number} | null = null;
+      if (o.chain !== null) {
+        const c = exactly(o.chain, ['owner', 'space']);
+        if (c === null || !isAddress(c.owner) || !isIndex(c.space)) return null;
+        chain = {owner: c.owner, space: c.space};
+      }
+      if ((instructions.length === 0 && chain === null) || o.at !== (instructions[0]?.index ?? null)) return null;
+      return {kind: 'assign', severity: 'block', word: OVERRIDE_WORDS.assign, at: instructions[0]?.index ?? null, instructions, chain};
+    }
+    case 'set-authority': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions', 'chain']);
+      const instructions = listOf(o?.instructions, authorityOf, false);
+      const chain = listOf(o?.chain, changeOf, false);
+      if (o === null || o.severity !== 'block' || o.word !== OVERRIDE_WORDS.setAuthority || instructions === null || chain === null) return null;
+      if ((instructions.length === 0 && chain.length === 0) || o.at !== (instructions[0]?.index ?? null)) return null;
+      return {kind: 'set-authority', severity: 'block', word: OVERRIDE_WORDS.setAuthority, at: instructions[0]?.index ?? null, instructions, chain};
+    }
+    case 'unlimited-approve':
+    case 'bounded-approve': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'approvals']);
+      const approvals = listOf(o?.approvals, approvalOf, true);
+      if (o === null || approvals === null || o.at !== firstAt(approvals)) return null;
+      if (head.kind === 'bounded-approve') return o.severity === 'warn' && o.word === null ? {kind: 'bounded-approve', severity: 'warn', word: null, at: firstAt(approvals), approvals} : null;
+      const symbols = [...new Set(approvals.map(a => a.symbol))];
+      const word = (symbols.length === 1 ? symbols[0] : null) ?? OVERRIDE_WORDS.unlimited;
+      return o.severity === 'block' && o.word === word ? {kind: 'unlimited-approve', severity: 'block', word, at: firstAt(approvals), approvals} : null;
+    }
+    case 'token-2022': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'mint', 'settings']);
+      const settings = o?.settings === null ? null : settingsOf(o?.settings);
+      if (o === null || o.severity !== 'warn' || o.word !== null || !isIndexOrNull(o.at) || !isAddress(o.mint) || (o.settings !== null && settings === null)) return null;
+      return {kind: 'token-2022', severity: 'warn', word: null, at: o.at, mint: o.mint, settings};
+    }
+    case 'durable-nonce': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at']);
+      return o !== null && o.severity === 'warn' && o.word === null && o.at === 0 ? {kind: 'durable-nonce', severity: 'warn', word: null, at: 0} : null;
+    }
+    case 'whole-balance': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at']);
+      return o !== null && o.severity === 'warn' && o.word === null && o.at === null ? {kind: 'whole-balance', severity: 'warn', word: null, at: null} : null;
+    }
+    case 'dependent': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'on']);
+      return o !== null && o.severity === 'block' && o.word === OVERRIDE_WORDS.dependent && o.at === null && isIndex(o.on) ? {kind: 'dependent', severity: 'block', word: OVERRIDE_WORDS.dependent, at: null, on: o.on} : null;
+    }
+    default:
+      return null;
+  }
+}
+
+/** One transaction's stored flags (simulate.ts's simStateOf), rebuilt — null when any flag is off. */
+export function storedFlagsOf(x: unknown): TxFlags | null {
+  return listOf(x, storedFlagOf, false);
+}
````

`extension/src/background/reauthPolicy.ts`:

````diff
diff --git a/extension/src/background/reauthPolicy.ts b/extension/src/background/reauthPolicy.ts
index d7f2d74..d841dd3 100644
--- a/extension/src/background/reauthPolicy.ts
+++ b/extension/src/background/reauthPolicy.ts
@@ -45,10 +45,11 @@ export function sendReauthReasons(i: {knownRecipient: boolean; amount: bigint; b
  * this account loses (SOL with the fee), with the account's balance of it before and its dollar value (null: no price,
  * which counts as above the threshold — fail closed, as B1b). `firstSend`: a transfer from this account to an address
  * it never sent to (the same facts as B1b's first-send rule). `approval`: an Approve / ApproveChecked by this account
- * (B1 §3 "bounded approvals"; the whole-balance and u64-max ones are B1c-3's blocks — until then they re-authenticate
- * too). Every rule fails closed, as sendReauthReasons.
+ * (B1 §3 "bounded approvals"; the whole-balance and u64-max ones are B1c-3's blocks, which re-authenticate as well).
+ * Every rule fails closed, as sendReauthReasons. `override` (B1c-3, spec §3.3's override rule): the request has a
+ * block — added by the simulation from its red flags, never by these rules.
  */
-export type DappReauthReason = SendReauthReason | 'approval';
+export type DappReauthReason = SendReauthReason | 'approval' | 'override';
 
 export function dappReauthReasons(i: {outgoing: readonly {amount: bigint; balance: bigint; usdMicros: bigint | null}[]; firstSend: boolean; approval: boolean; thresholdCents: number}): DappReauthReason[] {
   const out: DappReauthReason[] = [];
````

`extension/src/background/reauthChallenges.ts`:

````diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
index dd18dde..d1b95f5 100644
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -77,7 +77,7 @@ type Store = Map<string, Challenge>;
 const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
 const REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new'];
 const FEE_REASONS: readonly string[] = ['pre-tge', 'zero-fee-eligible', 'status-unknown', 'charged'];
-const DAPP_REASONS: readonly string[] = [...REASONS, 'approval'];
+const DAPP_REASONS: readonly string[] = [...REASONS, 'approval', 'override'];
 /** At most this many mints in a dApp challenge's description (more than a five-transaction batch can name sensibly; the rest are counted in `omitted`). */
 export const MAX_DAPP_OUTGOING = 16;
 const DIGITS = /^\d{1,20}$/;
````

`extension/src/unlock/challenge.ts`:

````diff
diff --git a/extension/src/unlock/challenge.ts b/extension/src/unlock/challenge.ts
index 3c1dd25..29c629b 100644
--- a/extension/src/unlock/challenge.ts
+++ b/extension/src/unlock/challenge.ts
@@ -126,10 +126,11 @@ function describeSettings(a: Record<string, unknown>): SettingsDescription | nul
   return lines.length === 0 ? null : {kind: 'settings', lines};
 }
 
-/** One reason's line (#10's own table; `approval` is B1c-2's). */
+/** One reason's line (#10's own table; `approval` is B1c-2's, `override` B1c-3's). */
 function reasonLine(r: unknown, thresholdCents: number): string | null {
   if (r === 'over-usd-threshold') return REAUTH.overUsd(dollars(thresholdCents));
   if (r === 'approval') return REAUTH.approval;
+  if (r === 'override') return REAUTH.override;
   return typeof r === 'string' && own(REAUTH.reason, r) ? REAUTH.reason[r as keyof typeof REAUTH.reason] : null;
 }
 
````

`extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 7b1ece2..9bd5be6 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -430,6 +430,8 @@ export const REAUTH = {
   /** Plan 2 review 1 L9 — controller copy, owner to confirm (Scope R28): the tokens past the sixteen #10 lists. */
   omitted: (n: number): string => `and ${n} more ${n === 1 ? 'token' : 'tokens'}`,
   approval: 'Re-auth required to approve a token allowance.',
+  /** B1c-3 Q33 (spec §3.3 rev 3.6) — controller copy, flagged to the owner: a request with a block re-authenticates. */
+  override: 'Re-auth required to override a blocked transaction.',
   dappConfirmed: 'Confirmed. Go back to the approval window and approve the transaction.',
   dappExpired: 'This confirmation has expired. Approve the transaction again in the approval window.',
   dappNotUnlocked: "The wallet locked while you were confirming. The site's request was declined — ask the site to try again.",
````

`extension/src/approve/client.ts`:

````diff
diff --git a/extension/src/approve/client.ts b/extension/src/approve/client.ts
index 68039f7..0335fab 100644
--- a/extension/src/approve/client.ts
+++ b/extension/src/approve/client.ts
@@ -72,7 +72,11 @@ export interface BalanceChange {
   decimals: number | null;
   usdMicros: string | null;
 }
-export type TxOutcome = {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null} | {ok: false; error: 'expired' | 'failed'; detail: string};
+export type TxOutcome =
+  | {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null}
+  | {ok: false; error: 'expired' | 'failed'; detail: string}
+  /** B1c-3 (F10): it depends on step `on` (1-based) of the same batch. */
+  | {ok: false; error: 'dependent'; on: number; detail: string};
 export interface TxItem {
   version: 'legacy' | 0;
   feePayer: string;
@@ -205,6 +209,7 @@ function changeOf(x: unknown): BalanceChange | undefined {
 function outcomeOf(x: unknown): TxOutcome | undefined {
   const o = obj(x);
   if (o === undefined) return undefined;
+  if (o.ok === false && o.error === 'dependent') return isInt(o.on) && o.on >= 1 && isStr(o.detail) ? {ok: false, error: 'dependent', on: o.on, detail: o.detail} : undefined;
   if (o.ok === false) return (o.error === 'expired' || o.error === 'failed') && isStr(o.detail) ? {ok: false, error: o.error, detail: o.detail} : undefined;
   if (o.ok !== true || !Array.isArray(o.changes) || !(o.unitsConsumed === null || isInt(o.unitsConsumed)) || !isInt(o.unitLimit) || !(o.feeLamports === null || (isStr(o.feeLamports) && DIGITS.test(o.feeLamports)))) return undefined;
   const changes = (o.changes as unknown[]).map(changeOf);
@@ -236,6 +241,9 @@ function simulationOf(x: unknown): SimulationView | undefined {
   return {status: 'ok', id: o.id, slot: o.slot, elapsedMs: o.elapsedMs, at: o.at};
 }
 
+/** The background's dApp re-authentication reasons (reauthPolicy.ts `DappReauthReason`): anything else is refused. */
+const REAUTH_REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new', 'approval', 'override'];
+
 function txDetailOf(x: unknown): TxDetail | undefined {
   const o = obj(x);
   const account = accountOf(o?.account);
@@ -251,7 +259,7 @@ function txDetailOf(x: unknown): TxDetail | undefined {
   }
   const reauth = nullOr(o.reauth, v => {
     const r = obj(v);
-    if (r === undefined || !Array.isArray(r.reasons) || !(r.reasons as unknown[]).every(isStr) || (r.state !== 'needed' && r.state !== 'waiting' && r.state !== 'proven')) return undefined;
+    if (r === undefined || !Array.isArray(r.reasons) || !(r.reasons as unknown[]).every(x => isStr(x) && REAUTH_REASONS.includes(x)) || (r.state !== 'needed' && r.state !== 'waiting' && r.state !== 'proven')) return undefined;
     return {reasons: (r.reasons as string[]).slice(), state: r.state as 'needed' | 'waiting' | 'proven'};
   });
   if (reauth === undefined) return undefined;
````

`extension/src/background/dapp/signTx.ts`:

````diff
diff --git a/extension/src/background/dapp/signTx.ts b/extension/src/background/dapp/signTx.ts
index 103875d..bcac35b 100644
--- a/extension/src/background/dapp/signTx.ts
+++ b/extension/src/background/dapp/signTx.ts
@@ -178,6 +178,8 @@ export async function txDetail(ext: Ext, e: Entry, session: readonly {publicKey:
   return {transactions, simulation, reauth, labels};
 }
 
+type DappAbout = Extract<ChallengeAbout, {kind: 'dapp'}>;
+
 /** What a dApp challenge is bound to: this request and its exact bytes, for this account. */
 export const dappDigest = (e: Pick<Entry, 'requestId' | 'account' | 'transactions'>): string => digestOf('dapp', {requestId: e.requestId, account: e.account, transactions: e.transactions});
 
@@ -249,11 +251,13 @@ function reasonsCovered(fresh: readonly DappReauthReason[], issued: readonly Dap
 
 /**
  * Whether any mint's fresh outgoing amount exceeds what the issued challenge described — a mint absent from the
- * issued list (new since the challenge was issued) counts as having had 0.
+ * issued list (new since the challenge was issued) counts as having had 0 — or more mints are cut from the list than
+ * were (B1c-3, the final review's minor: a mint past MAX_DAPP_OUTGOING was never described either).
  */
-function outgoingGrew(fresh: readonly DappOutgoing[], issued: readonly DappOutgoing[]): boolean {
-  const had = new Map(issued.map(o => [o.mint, BigInt(o.amount)]));
-  return fresh.some(o => BigInt(o.amount) > (had.get(o.mint) ?? 0n));
+export function outgoingGrew(fresh: Pick<DappAbout, 'outgoing' | 'omitted'>, issued: Pick<DappAbout, 'outgoing' | 'omitted'>): boolean {
+  if (fresh.omitted > issued.omitted) return true;
+  const had = new Map(issued.outgoing.map(o => [o.mint, BigInt(o.amount)]));
+  return fresh.outgoing.some(o => BigInt(o.amount) > (had.get(o.mint) ?? 0n));
 }
 
 /**
@@ -279,7 +283,7 @@ export async function reauthGate(ext: Ext, deps: Pick<WalletDeps, 'now' | 'rando
   const current = e.challengeId !== null ? await challengeInfo(ext, now, e.challengeId) : null;
   const fresh = dappAbout(e, site, (await readSettings(ext)).reauthUsdCents);
   if (fresh === null) return 'stale';
-  const stillCovers = current !== null && current.kind === 'dapp' && reasonsCovered(fresh.reasons, current.reasons) && !outgoingGrew(fresh.outgoing, current.outgoing);
+  const stillCovers = current !== null && current.kind === 'dapp' && reasonsCovered(fresh.reasons, current.reasons) && !outgoingGrew(fresh, current);
   if (!stillCovers) {
     const id = await issueChallenge(ext, deps, digest, fresh);
     const superseded = e.challengeId;
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: the five files of Step 2 — expected: Test Files  5 passed (5) · Tests  147 passed (147) (simulate 42, signTx 30, reauthChallenges 15, challenge 38, tx 22).

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  169 passed (169) · Tests  3372 passed (3372) (Task 2's end state: 169 files, 3352 tests; +20). `node scripts/build.mjs && npm run gates` — expected: every gate ok (permissions, page bundles, vault isolation, rpc methods — no new method: the mint read is B1c-2's `getMultipleAccounts` —, no TGE date, fonts, classes). Nothing touches the repository root's `src/` or `core/` (core's `MAX_MULTIPLE_ACCOUNTS` is only imported).

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

Every block-adding rule, every F10 attribution rule (earlier-only, the index, each shape check, AccountNotFound's payer, two creators), each R10 branch, the strict reader's main checks, each of the four reason lists and the window's strict list, and `outgoingGrew`'s `omitted` are mutated once. The named test file is the one in brackets; the counts are that file's.

| id | the change | named test → observed (`tsc` exit, then the named test file) |
|---|---|---|
| M3a | `simulate.ts`: `const wanted = [...new Set([...flagMints({account, txs: flagInputs}), ...unknownMints])]` → `const wanted = [...new Set([...flagMints({account, txs: flagInputs}).filter(m => !decimals.has(m)), ...unknownMints])]` | “tokens: an existing account loses, a new account (created by the trans…”; “every mint the flags need is read in one batch, the wallet’s own token…”; “the mint read failing is a failed read like any other: it throws (the …”; … (`simulate.test.ts`) — tsc 0 · RED Tests  4 failed \| 38 passed (42) |
| M3b | `simulate.ts`: `.slice(0, MAX_MULTIPLE_ACCOUNTS);` → `.slice(0, MAX_MULTIPLE_ACCOUNTS + 20);` | “more mints than one read may name: the first MAX_MULTIPLE_ACCOUNTS rea…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3c | `simulate.ts`: `expectedOverrides(flags).length > 0 ?` → `expectedOverrides(flags).length > 1 ?` | “a changed close authority re-authenticates too (I1; documented choice:…”; “an own account reassigned to someone else (a CPI SetAuthority AccountO…”; “an owner change on an otherwise-empty account (only its rent moves) st…”; … (`simulate.test.ts`) — tsc 0 · RED Tests  6 failed \| 36 passed (42) |
| M3d | `simulate.ts`: `expectedOverrides(flags).length > 0 ?` → `expectedOverrides(flags).length > 0 \|\| flags.some(l => l.length > 0) ?` | “an approval by the account re-authenticates (B1 §3 "bounded approvals"…”; “a CPI approval (an unknown program raising a delegation) re-authentica…”; “a raised delegated amount re-authenticates even when the delegate itse…”; … (`simulate.test.ts`) — tsc 0 · RED Tests  8 failed \| 34 passed (42) |
| M3e | `simulate.ts`: `const flags = redFlagsOf({account, txs: flagInputs, mints, reasons: base});` → `const flags = redFlagsOf({account, txs: flagInputs.map(t => ({...t, firstSend})), mints, reasons: base});` | “per transaction (F9 is per transaction): the whole-balance warning onl…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3f | `simulate.ts`: `return owner === null \|\| !(owner === account \|\| known(owner));` → `return owner === null \|\| owner !== account;` | “its pre-state, a token account: an owner the account sent to before, o…”; “absent before and created in the same transaction by an ATA create / c…” (`simulate.test.ts`) — tsc 0 · RED Tests  2 failed \| 40 passed (42) |
| M3g | `simulate.ts`: `return owner === null \|\| !(owner === account \|\| known(owner));` → `return owner === null \|\| !known(owner);` | “its pre-state, a token account: an owner the account sent to before, o…”; “absent before and created in the same transaction by an ATA create / c…” (`simulate.test.ts`) — tsc 0 · RED Tests  2 failed \| 40 passed (42) |
| M3h | `simulate.ts`: `(ix.name === 'create' \|\| ix.name === 'createIdempotent') && addressField(ix, 'account') === destination);` → `(ix.name === 'create' \|\| ix.name === 'createIdempotent') && addressField(ix, 'account') !== destination);` | “absent before and created in the same transaction by an ATA create / c…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3i | `simulate.ts`: `if (state !== null) return tokenAccountInfo(state.data, state.owner)?.owner ?? null;` → `if (state !== null && tokenAccountInfo(state.data, state.owner) !== null) return tokenAccountInfo(state.data, state.owner)?.owner ?? null;` | “fail closed: unreadable, not a token account, an existing account an A…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3j | `simulate.ts`: `if (to === null \|\| held(to)) return false;` → `if (to === null \|\| held(to) \|\| known(to)) return false;` | “fail closed: unreadable, not a token account, an existing account an A…”; “create the token account, then transfer to it: step 2 depends on step …” (`simulate.test.ts`) — tsc 0 · RED Tests  2 failed \| 40 passed (42) |
| M3k | `simulate.ts`: `created.slice(0, i).findIndex` → `created.slice(0, i + 1).findIndex` | “never dependent: a failure in step 1 (nor on itself); one naming an ac…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3l | `simulate.ts`: `created.slice(0, i).findIndex` → `created.findIndex` | “never dependent: a failure in step 1 (nor on itself); one naming an ac…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3m | `simulate.ts`: `return ix === undefined ? null : ix.accounts.map(a => keys[a] ?? null)` → `return ix === undefined ? null : p.instructions.flatMap(x => x.accounts).map(a => keys[a] ?? null)` | “the instruction the error names decides — its own resolved accounts, n…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3n | `simulate.ts`: `if (!Array.isArray(pair) \|\| pair.length !== 2) return null;` → `if (!Array.isArray(pair)) return null;` | “only the shapes Agave’s TransactionError takes for it: InstructionErro…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3o | `simulate.ts`: `if (typeof err !== 'object' \|\| err === null \|\| Array.isArray(err) \|\| Object.keys(err).length !== 1) return null;` → `if (typeof err !== 'object' \|\| err === null \|\| Array.isArray(err)) return null;` | “only the shapes Agave’s TransactionError takes for it: InstructionErro…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3p | `simulate.ts`: `const ix = typeof i === 'number' && Number.isSafeInteger(i) && i >= 0 ? p.instructions[i] : undefined;` → `const ix = p.instructions[Number(i)];` | “only the shapes Agave’s TransactionError takes for it: InstructionErro…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3q | `simulate.ts`: `if (err === 'AccountNotFound') return p.staticKeys.slice(0, 1);` → `if (err === 'AccountNotFound') return p.staticKeys.slice(1, 2);` | “only the shapes Agave’s TransactionError takes for it: InstructionErro…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3r | `simulate.ts`: `if (ix.program === 'system' && (ix.name === 'createAccount' \|\| ix.name === 'createAccountWithSeed')) return addressField(ix, 'newAccount');` → `if (ix.program === 'system' && ix.name === 'createAccount') return addressField(ix, 'newAccount');` | “every creator counts — System createAccount / createAccountWithSeed, A…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3s | `simulate.ts`: ` \|\| ix.name === 'initializeAccount3')) return addressField(ix, 'account');` → `)) return addressField(ix, 'account');` | “every creator counts — System createAccount / createAccountWithSeed, A…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3t | `simulate.ts`: `flagInputs.push({tx: p, decoded, pre, outcome: on >= 0 ? {status: 'dependent', on} : {status: 'failed'}, firstSend});` → `flagInputs.push({tx: p, decoded, pre, outcome: {status: 'failed'}, firstSend});` | “create the token account, then transfer to it: step 2 depends on step …” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3u | `simulate.ts`: `{ok: false, error: 'dependent', on: on + 1, detail}` → `{ok: false, error: 'dependent', on, detail}` | “create the token account, then transfer to it: step 2 depends on step …”; “the instruction the error names decides — its own resolved accounts, n…”; “only the shapes Agave’s TransactionError takes for it: InstructionErro…”; … (`simulate.test.ts`) — tsc 0 · RED Tests  4 failed \| 38 passed (42) |
| M3v | `simulate.ts`: `if (lists.some(l => l.some(f => f.severity === 'block')) !== (s.reasons as unknown[]).includes('override')) return null;` → `if (lists.some(l => l.some(f => f.severity === 'block')) && !(s.reasons as unknown[]).includes('override')) return null;` | “simStateOf: an invalid stored flag makes the stored simulation invalid…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3v2 | `simulate.ts`: `if (lists.some(l => l.some(f => f.severity === 'block')) !== (s.reasons as unknown[]).includes('override')) return null;` → `if (!lists.some(l => l.some(f => f.severity === 'block')) && (s.reasons as unknown[]).includes('override')) return null;` | “simStateOf: an invalid stored flag makes the stored simulation invalid…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3w | `simulate.ts`: `return !o.ok && o.error === 'dependent' ? on === o.on - 1 : on === undefined;` → `return !o.ok && o.error === 'dependent' ? on !== undefined : true;` | “create the token account, then transfer to it: step 2 depends on step …” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3x | `simulate.ts`: `'whole-balance-to-new', 'approval', 'override'];⏎const isInt` → `'whole-balance-to-new', 'approval'];⏎const isInt` | “simStateOf: the stored flags are read back strictly — a stored `overri…”; “create the token account, then transfer to it: step 2 depends on step …” (`simulate.test.ts`) — tsc 0 · RED Tests  2 failed \| 40 passed (42) |
| M3y | `redFlags.ts`: `return o.severity === 'block' && o.word === word ?` → `return o.severity === 'block' && typeof o.word === 'string' ?` | “simStateOf: an invalid stored flag makes the stored simulation invalid…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3z | `redFlags.ts`: `return o.severity === 'block' && o.word === word ?` → `return o.word === word ?` | “simStateOf: an invalid stored flag makes the stored simulation invalid…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3aa | `redFlags.ts`: `return Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k)) ? o : null;` → `return keys.every(k => Object.hasOwn(o, k)) ? o : null;` | “simStateOf: an invalid stored flag makes the stored simulation invalid…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3ab | `redFlags.ts`: `if (o.symbol !== null && (typeof o.symbol !== 'string' \|\| !TOKENS.includes(o.symbol) \|\| o.mint === null \|\| tokenForMint(o.mint) !== o.symbol \|\|` → `if (o.symbol !== null && (typeof o.symbol !== 'string' \|\| !TOKENS.includes(o.symbol) \|\| o.mint === null \|\|` | “simStateOf: an invalid stored flag makes the stored simulation invalid…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3ac | `redFlags.ts`: `first === undefined \|\| o.at !== first.index \|\| instructions === null` → `first === undefined \|\| instructions === null` | “simStateOf: an invalid stored flag makes the stored simulation invalid…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3ad | `redFlags.ts`: `return o.severity === 'warn' && o.word === null ? {kind: 'bounded-approve'` → `return o.word === null ? {kind: 'bounded-approve'` | “simStateOf: an invalid stored flag makes the stored simulation invalid…” (`simulate.test.ts`) — tsc 0 · RED Tests  1 failed \| 41 passed (42) |
| M3ae | `reauthChallenges.ts`: `const DAPP_REASONS: readonly string[] = [...REASONS, 'approval', 'override'];` → `const DAPP_REASONS: readonly string[] = [...REASONS, 'approval'];` | “a dApp challenge for `override` is issued and read back from the store…” (`reauthChallenges.test.ts`) — tsc 0 · RED Tests  1 failed \| 14 passed (15) |
| M3af | `challenge.ts`: `  if (r === 'override') return REAUTH.override;⏎` → (the line removed) | “`override` reads Q33’s line; an unknown reason still makes the whole d…” (`challenge.test.ts`) — tsc 0 · RED Tests  1 failed \| 37 passed (38) |
| M3ag | `client.ts`: `'whole-balance-to-new', 'approval', 'override'];⏎⏎function txDetailOf` → `'whole-balance-to-new', 'approval'];⏎⏎function txDetailOf` | “a setAuthority to None renders — the window’s own "none" field is not …”; “pendingOf: `override` and a dependent step’s outcome are read; an unkn…” (`tx.test.tsx`) — tsc 0 · RED Tests  2 failed \| 20 passed (22) |
| M3ah | `client.ts`: `.every(x => isStr(x) && REAUTH_REASONS.includes(x))` → `.every(x => isStr(x) && (REAUTH_REASONS.includes(x) \|\| x.length > 0))` | “pendingOf: `override` and a dependent step’s outcome are read; an unkn…” (`tx.test.tsx`) — tsc 0 · RED Tests  1 failed \| 21 passed (22) |
| M3ai | `client.ts`: `return isInt(o.on) && o.on >= 1 && isStr(o.detail) ?` → `return isInt(o.on) && isStr(o.detail) ?` | “pendingOf: `override` and a dependent step’s outcome are read; an unkn…” (`tx.test.tsx`) — tsc 0 · RED Tests  1 failed \| 21 passed (22) |
| M3aj | `signTx.ts`: `if (fresh.omitted > issued.omitted) return true;` → `if (fresh.omitted > issued.omitted + 1) return true;` | “a mint more cut from the list (omitted grew) is growth; the same count…” (`signTx.test.ts`) — tsc 0 · RED Tests  1 failed \| 29 passed (30) |
37 mutations, all red, every one compiling (`tsc` 0). One first run was GREEN and the test was strengthened (not the code): M3ab (the approval's `tokenForMint(mint) === symbol` check dropped) survived because the only variant, `symbol: 'USDT'` on a USDC approval, was also caught by the word check (the word `USDC` no longer agreed with its approvals). The variant "an approval's symbol not its mint's, its word made to agree" (`symbol` and `word` both `USDT`) was added; M3ab then turned red (`Tests  1 failed | 41 passed (42)`), and it is in the code above. Not mutated, stated: `outcomeOf`'s `o.on >= 1` in `simStateOf` is implied by the step-agreement check (a flag's `on` is ≥ 0 and must equal the outcome's − 1), so no test can separate it — kept as the shape check of the outcome itself; the expired-before-dependent order (`isExpired(sim.err) ? null : accountsNamed(…)`) cannot be mutated observably because `accountsNamed` never names an account for `"BlockhashNotFound"` — the expired test is a negative control of the outcome. M3ag also turned the B1c-2 test "a setAuthority to None renders" red: that request now carries `override` (F4 — the wallet signs as the current authority), and a window that did not know the reason would stay blank.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-3 simulation — the flags' mints read in one batch, red flags stored with the simulation, the override reason, R10's owner resolution, F10's dependent steps" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

#### Dry-run notes (Task 3)

- **Ruling: F10 accepts exactly two error shapes — `{"InstructionError": [i, *]}` (i an index of one of the message's instructions → its resolved accounts) and `"AccountNotFound"` (→ the fee payer, static key 0)** — why: these are the only `TransactionError` variants that name an account a batch's earlier step could have created (an absent non-payer account loads as an empty System account, so the program fails with an `InstructionError`); the JSON shapes are from `@solana/errors` 5.5.1 (in `extension/node_modules`, mirrored from Agave's `error.rs`), the variants' meaning from the writer's knowledge of Agave (stated) — cost if wrong: a rare dependent shape (e.g. `InsufficientFundsForRent` on an account an earlier step funds) stays Reject-only (stricter, allowed). Written into §3.3.
- **Ruling: the step a dependent transaction names is the EARLIEST earlier transaction creating any account its error names**; a transaction never depends on itself or on a later one (tested; M3k, M3l).
- **Ruling: the outcome's `on` is 1-based (the controller's brief), Task 2's `FlagOutcome.on` / the `dependent` flag's `on` 0-based** — `simStateOf` requires flag.on === outcome.on − 1. Task 5: Q32's "step <N>" is `outcome.on` (or `flag.on + 1`); never mix them.
- **Ruling: R10 — for an SPL transfer, B1b's `known` is applied to the destination's OWNER only, never to the token-account address itself** (B1c-2 also tested `known(to)`; dropping it is stricter); B1c-2's "an own token account in the holdings snapshot is never a recipient" (`before.has(to)`) is kept (the RPC's own answer that it is the wallet's — the same fact the owner rule reads). An existing destination that is not a token account is a first send even when the same transaction ATA-creates it (`createIdempotent` on an existing account names nothing new). A destination created by ANOTHER transaction of the batch is a first send (the brief: "in the same transaction") — so a create-then-transfer batch also carries `first-send` (tested) — cost if wrong: one more #10 reason line on such batches.
- **Ruling: the mint read is merged with B1c-2's decimals read and capped at `MAX_MULTIPLE_ACCOUNTS` (flag mints first, then the decimals-only ones)** — a mint past the cap gets no decimals (base units, unpriced → over the dollar threshold) and Q36's warning; B1c-2 had no cap (more than 100 changed mints threw → unreachable). No read at all when no mint is named.
- **Ruling: `override` is appended by the simulation (after the flags, which read B1b's reasons for F9), never by `dappReauthReasons`.** `simStateOf` requires block ⇔ `override` both ways.
- **Ruling: `storedFlagsOf` is stricter than "shape"**: exact key sets, addresses by base58 shape, amounts ≤ 20 digits, each flag's severity and word for its kind, the unlimited word recomputed from its approvals, an approval's symbol only for its own mint at the table's decimals, `at` equal to the first instruction (F2/F3/F4) or first decoded approval (F5/F6), F3/F4 non-empty, F7 settings with at least one value, F8 `at` 0. NOT checked: the list's order, F1's `at` against its programs (no index is stored), F3's `chain` against anything. A refused stored simulation is simulated again on the next `dapp.pending` (B1c-2's `entryOf` behaviour).
- **Deviation (additive): the window's reason list is created** — `approve/client.ts` took any string (code map §3 said "types reasons as `string[]`"); it now refuses an unknown reason (`pendingOf` → null, the window stays on its last view). The window also parses the `dependent` outcome (needed now: without it a dependent batch blanked the window — M3ag/M3ai), but renders it as B1c-2's failure until Task 5; `TxDetail` carries no flags yet (Task 4/5).
- **Deviation: `txRefused` is unchanged** — a dependent step is still `simulation-failed` here; Task 4 makes it approvable only with the overrides and the proof.
- **Durable nonce vs the 30 s refresh / Q21 (brief "Carried items") — stated behaviour:** the wallet derives no expiry of its own; `expired` is only ever the node's `"BlockhashNotFound"`. The proxy simulates with `replaceRecentBlockhash: false` (core `rpc.ts:379`, pinned by core's `rpc.test.ts:232`), under which Agave checks a nonce transaction's blockhash against its nonce account (writer's knowledge), so a valid nonce transaction never turns Q21 by age (tested: three refreshes, still simulated, the warning stored with each, approvable). If the node does say `BlockhashNotFound` for it, the nonce was advanced or closed and the transaction can never land, so Q21 is the truth (tested: expired, `blockhash-expired`, Reject only). No code change.
- **For Task 4:** `sim.flags` is what `expectedOverrides` / `overridesMatch` run on; `override` is already in `sim.reasons`, so the deciding fail-closed check needs no change to demand a proof; `dappAbout` must add the flags to `about` (and `isAbout` both sides, `reasonsCovered`); `outgoingGrew(fresh, current)` now takes the whole abouts.
- **For Task 5:** `outcome.error === 'dependent'` (Q32 with `outcome.on`), the flags per transaction in redFlagsOf's order; the two B1c-2 window tests touched by reasons stay green (M3ag shows the setAuthority one now carries `override`).
- **E2E not run** (as Tasks 1–2): Task 7 should expect `override` (and #10's Q33 line) on any existing E2E request that F4/F5 now block, and the mint read in fakeCoordinator's `getMultipleAccounts` counts.

---

### Task 4: The decide gate — the typed overrides (`override-missing`, `override-mismatch`) in both decide sections, a dependent step approvable only overridden, the override's re-authentication following the flags (the challenge's `flags`, #10's rows), and the window's `TxDetail.flags`

**Spec:** B1c §3.3 rev 3.6 "The override rule" (this task writes #10's rows into it), §10 (Q37–Q40, added here, flagged); B1 §3 ("Blocked" — "by typing … the word shown, plus re-authentication"; "There is no setting that disables a block"); owner decisions O1, O2; brief "Override rule" (R4), F10 (R3); C13 (the window decides nothing), C17

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (§3.3 the override rule names #10's rows and what re-issues; §10 Q37–Q40)
- Test (new): `extension/src/background/dapp/__tests__/overrides.test.ts`
- Test: `extension/src/background/dapp/__tests__/txHarness.ts` (`assign`, `ataCreate`, `tokenTransfer`; `Chain.errFor` — one transaction's error by its keys)
- Test: `extension/src/background/__tests__/reauthChallenges.test.ts` (the `dappAbout` helper takes flags; one test updated, one describe added)
- Test: `extension/src/unlock/__tests__/challenge.test.ts` (the fixture gains `flags`; one test updated, one describe added)
- Test: `extension/src/unlock/__tests__/reauthScreen.test.ts` (the fixture gains `flags`; one test added)
- Test: `extension/src/approve/__tests__/tx.test.tsx` (fixtures gain `flags`; B1c-2's I1 negative control and Task 3's `pendingOf` test rewritten to the new rule; three tests added)
- Test: `extension/src/background/dapp/__tests__/signTx.test.ts`, `extension/src/app/__tests__/Home.test.tsx` (dApp `about` fixtures gain `flags: []`)
- Modify: `extension/src/background/dapp/decide.ts` (`DecideRequest.overrides`, `MAX_OVERRIDES`, `overridesOf`; both sections pass the words)
- Modify: `extension/src/background/dapp/signTx.ts` (`TxRefusal`, `txRefused`, `FlagView`/`flagView`, `TxItemView.flags`, `dappAbout`'s flags, `flagsCovered`, `reauthGate`)
- Modify: `extension/src/background/reauthChallenges.ts` (`FlagRow`, `DappFlag`, `FLAG_ROW`, `MAX_DAPP_FLAGS`, `isDappFlags`; the dapp `about` gains `flags`)
- Modify: `extension/src/approve/client.ts` (`Flag` and its parts, `TxItem.flags`, `dependsOnStep`, `Decision.overrides`, the strict flag reader; a detail the window cannot read is `tx: null`)
- Modify: `extension/src/unlock/challenge.ts`, `extension/src/unlock/strings.ts`, `extension/src/unlock/screens/reauth.ts` (#10's override rows, Q37–Q40)

**Interfaces:**
- Consumes: Task 2's `overridesMatch`, `OVERRIDE_WORDS`, `RedFlag`, `RedFlagKind` (`dapp/redFlags.ts`); Task 3's `TxSimulation.flags`, the `dependent` `TxOutcome` (`on` 1-based) and its invariant (`simStateOf`: a dependent outcome ⇔ its transaction's `dependent` flag with `on === outcome.on − 1`; a block ⇔ `override` in `reasons`), `outgoingGrew` (`signTx.ts`), `REAUTH.override` (Q33); B1c-2's `decide`, `DecideRequest`, `decideRequestOf`, `reauthGate`, `dappAbout`, `txDetail`, `txRefused`, `ChallengeAbout`, `issueChallenge`, `describeChallenge`, `pendingOf`, `txScene` (`txHarness.ts`), `MAX_BATCH` (`txRequest.ts`).
- Produces:
  ```ts
  // dapp/decide.ts
  export interface DecideRequest {/* B1c-2's fields */; overrides: {tx: number; word: string}[]}   // absent in the message → []
  export const MAX_OVERRIDES = MAX_BATCH * Object.keys(OVERRIDE_WORDS).length;   // 20
  // decideRequestOf → null ('malformed') unless `overrides` is absent or an array of ≤ MAX_OVERRIDES objects with
  // exactly {tx, word}: tx a safe integer 0 ≤ tx < MAX_BATCH, word a string of ≤ 32 characters.
  // dapp/signTx.ts
  export type TxRefusal = 'not-simulated' | 'stale' | 'out-of-date' | 'simulation-failed' | 'blockhash-expired' | 'override-mismatch' | 'override-missing';
  export function txRefused(e: Entry, simulation: string | null, overrides: readonly {tx: number; word: string}[], now: number): TxRefusal | null;
  export type FlagView = Exclude<RedFlag, {kind: 'dependent'}> | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; step: number};  // step = on + 1
  export const flagView: (f: RedFlag) => FlagView;
  export interface TxItemView {/* B1c-2's fields */; flags: FlagView[] | null}   // null while simulating (as `outcome`)
  // reauthChallenges.ts
  export type FlagRow = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9' | 'F10';
  export interface DappFlag {tx: number; row: FlagRow; word: string | null; step: number | null}
  export const FLAG_ROW: Record<RedFlagKind, FlagRow>;
  export const MAX_DAPP_FLAGS = 50;
  // ChallengeAbout's dapp variant gains `flags: DappFlag[]` (9 keys).
  // approve/client.ts
  export type FlagSymbol = 'NOC' | 'USDC' | 'USDT';
  export type Flag = /* the ten kinds, exactly redFlags.ts's RedFlag, with `dependent`'s `on` replaced by `step` (1-based) */;
  export interface FlaggedInstruction, AuthorityInstruction, AuthorityChange, Approval, Token2022Settings;  // as redFlags.ts
  export interface TxItem {/* B1c-2's fields */; flags: Flag[] | null}
  export const dependsOnStep: (t: TxItem) => number | null;   // Q32's <N>, 1-based — the one accessor the window uses
  export type Decision = {decision: 'reject' | 'report' | 'block'} | {decision: 'approve'; account: string; scope?; simulation?; overrides?: {tx: number; word: string}[]};
  // unlock/challenge.ts
  export interface DappDescription {/* B1c-2's fields */; overrides: {label: string; transaction: string | null}[]}
  // unlock/strings.ts
  REAUTH.overridden = {F3: Q37, F4: Q38, F5: (symbol | null) => Q39, F10: (step) => Q40}; REAUTH.transactionOf(k, n)  // #48's batch label
  ```
  **The refusal order** (both decide sections; every B1c-2 row keeps its place, the two new ones come after all of them): `expired` → `not-head` → `locked` → `unknown-account` → (connect: `malformed` / `scope`) → `blocked` (§2.3: the site blocked or cooling down) → `cap` → `no-grant` → `account` → `siws-mismatch` → `not-simulated` → `stale` → `out-of-date` → `blockhash-expired` → `simulation-failed` → **`override-mismatch`** → **`override-missing`** (a block without its word) → `reauth-required` (the pre-section's gate, then the deciding section's fail-closed proof check). A wrong word beside a missing one is `override-mismatch` (`overridesMatch`'s precedence). The words never reach the re-authentication gate unless they are right: no challenge is issued for a request whose words are missing or wrong.

**The 0/1-based convention, resolved.** One rule, stated once: a field named `tx` (an override's, a challenge flag's) or `at`/`index` is a 0-based index; a field named `step` or an outcome's `on` is a 1-based step number, as the copy says it. redFlags.ts's internal `on` (0-based) never leaves the background: `txDetail` maps it to `step = on + 1` (`flagView`), `dappAbout` to the challenge's `step = on + 1`. The window reads the step only through `dependsOnStep` (its parser requires the flag's `step` to equal the dependent outcome's `on`, exactly one F10 flag beside a dependent outcome and none beside any other, and `step` ≤ the transaction's own 0-based index — an earlier step); the test "#48's view of the flags" proves that step 3 of a three-step batch depending on step 2 reads `2` (a 0-based slip reads `1`, a self-index `3`).

The background is the gate. `dapp.decide` now carries the typed words, read strictly (malformed beyond the shape above), and `txRefused` — called in the pre-section AND in the deciding section, against the entry each one reads — compares them with the words the STORED simulation's flags give (`overridesMatch`): any word not expected, or given twice, is `override-mismatch`; a block left without its word is `override-missing` (controller ruling: not `blocked`, which §2.3 already uses for a blocked site). A dependent step is no longer `simulation-failed` when its own F10 flag stands beside it (the flag is a block, so it is approvable only with `UNCHECKED`); every other failed outcome still is, and an expired blockhash still comes first. The re-authentication needs no new check: Task 3 put `override` in `reasons` for every block, and the deciding section's fail-closed check already demands a proof bound to the entry's current challenge whenever `reasons` is non-empty — this task proves it (right words, no proof → `reauth-required`; the proof never stands in for a word). What #10 describes now includes the flags, compact (one entry per transaction and row of the red-flag table, with the block's word and a dependent step's step), validated exactly on both sides; `reauthGate` re-issues the challenge when the fresh simulation has a flag — a block or a warning, a word, a step — the issued one did not name. #10 shows Q33's reason line (Task 3) and one row per block: what is overridden (Q37–Q40) and, in a batch, on which transaction. Last, the window's `TxDetail` gains each transaction's flags — what Task 5 renders — read strictly: a flag the window cannot read makes the whole detail unreadable, which is now `tx: null` (Q26, only Reject), never the request shown with a flag silently dropped.

- [ ] **Step 1: Write the failing tests.**

The harness gains three instructions and `Chain.errFor` (a batch whose later step fails alone — B1c-2's `chain.err` fails every transaction):

`extension/src/background/dapp/__tests__/txHarness.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/txHarness.ts b/extension/src/background/dapp/__tests__/txHarness.ts
index bc921be..0d5c145 100644
--- a/extension/src/background/dapp/__tests__/txHarness.ts
+++ b/extension/src/background/dapp/__tests__/txHarness.ts
@@ -8,7 +8,7 @@ import {VAULT_KEY} from '../../accountsStore';
 import {GRANTS_KEY, type Grant} from '../grants';
 import {runUnlockHook} from '../queue';
 import {readDappSession, type Entry} from '../store';
-import {TOKEN_PROGRAM} from '../decode/decode';
+import {ATA_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
 import {fakeExt} from '../../__tests__/fakeExt';
 import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
 import {ACCOUNT, BLOCKHASH, RECIPIENT} from '../../__tests__/fixtures';
@@ -66,9 +66,44 @@ export const mintTo = (mint = TO, destination = ME, authority = ME, amount = 1n)
     ],
   });
 
+/**
+ * B1c-3: System assign of `account` (the wallet's, by default) to another program — F3, a block (ASSIGN) decoded from
+ * the instruction alone, whatever the chain says.
+ */
+export const assign = (account = ME, programId = new PublicKey(new Uint8Array(32).fill(71))): TransactionInstruction => SystemProgram.assign({accountPubkey: account, programId});
+
+/** B1c-3: an associated-token-account createIdempotent (tag 1) of `account` for `wallet`, paid by the account — one of F10's creators. */
+export const ataCreate = (account: PublicKey, wallet = TO, mint = new PublicKey(new Uint8Array(32).fill(72))): TransactionInstruction =>
+  new TransactionInstruction({
+    programId: new PublicKey(ATA_PROGRAM),
+    data: Buffer.from([1]),
+    keys: [
+      {pubkey: ME, isSigner: true, isWritable: true},
+      {pubkey: account, isSigner: false, isWritable: true},
+      {pubkey: wallet, isSigner: false, isWritable: false},
+      {pubkey: mint, isSigner: false, isWritable: false},
+      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
+      {pubkey: new PublicKey(TOKEN_PROGRAM), isSigner: false, isWritable: false},
+    ],
+  });
+
+/** B1c-3: a Token transfer (tag 3) from `source` to `destination`, the account its authority. */
+export const tokenTransfer = (destination: PublicKey, source = new PublicKey(new Uint8Array(32).fill(73)), amount = 1n): TransactionInstruction =>
+  new TransactionInstruction({
+    programId: new PublicKey(TOKEN_PROGRAM),
+    data: Buffer.from([3, ...u64le(amount)]),
+    keys: [
+      {pubkey: source, isSigner: false, isWritable: true},
+      {pubkey: destination, isSigner: false, isWritable: true},
+      {pubkey: ME, isSigner: true, isWritable: false},
+    ],
+  });
+
 export interface Chain {
   /** simulateTransaction's error (null: it runs). */
   err: unknown;
+  /** B1c-3: an error for one transaction by its static keys (null: it runs) — a batch whose later step fails alone. */
+  errFor: ((keys: string[]) => unknown) | null;
   /** Calls per method. */
   calls: Map<string, number>;
   /** getBalance throws while set. */
@@ -101,9 +136,10 @@ export function chainReader(chain: Chain): SolanaReader {
     },
     simulateTransaction: async (txBase64, opts): Promise<SimulationOutcome> => {
       count('simulateTransaction');
-      if (chain.err !== null) return {err: chain.err, logs: [], unitsConsumed: 0, slot: 777, accounts: null};
       const m = VersionedTransaction.deserialize(base64.decode(txBase64)).message;
       const keys = m.staticAccountKeys.map(k => k.toBase58());
+      const err = chain.err !== null ? chain.err : (chain.errFor?.(keys) ?? null);
+      if (err !== null) return {err, logs: [], unitsConsumed: 0, slot: 777, accounts: null};
       let out = 0n;
       for (const ix of m.compiledInstructions) {
         if (keys[ix.programIdIndex] === SystemProgram.programId.toBase58() && ix.data[0] === 2 && keys[ix.accountKeyIndexes[0] ?? -1] === ME.toBase58()) out += new DataView(ix.data.buffer, ix.data.byteOffset + 4, 8).getBigUint64(0, true);
@@ -123,7 +159,7 @@ export async function until(done: () => Promise<boolean>, turns = 400): Promise<
   throw new Error('never settled');
 }
 
-export const newChain = (): Chain => ({err: null, calls: new Map(), down: false});
+export const newChain = (): Chain => ({err: null, errFor: null, calls: new Map(), down: false});
 
 export async function txScene(o: {grant?: Partial<Grant> | null; known?: string[]; origin?: string} = {}) {
   const origin = o.origin ?? DAPP;
````

Create `extension/src/background/dapp/__tests__/overrides.test.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {PublicKey, VersionedTransaction} from '@solana/web3.js';
import {ATA_PROGRAM} from '../decode/decode';
import {MAX_OVERRIDES, decideRequestOf} from '../decide';
import {DAPP_SESSION_KEY, readDappSession, type Entry} from '../store';
import {SIM_REFRESH_MS, SIM_VALID_MS, txRefused} from '../signTx';
import {REAUTH_KEY} from '../../session';
import {ACCOUNT, RECIPIENT} from '../../__tests__/fixtures';
import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {dependsOnStep, pendingOf} from '../../../approve/client';
import {describeChallenge} from '../../../unlock/challenge';
import {ME, assign, ataCreate, tokenTransfer, transfer, txScene, v0} from './txHarness';

/**
 * B1c-3 (spec §3.3 rev 3.6, "The override rule"; B1 §3; O1, O2): dapp.decide's override gate against the real
 * background. A block is approvable only with its exact typed word for its own transaction AND a re-authentication
 * through #10 (the `override` reason); the background recomputes every word from the simulation it stored (C13).
 */
const DEST = new PublicKey(new Uint8Array(32).fill(74));
const OTHER = new PublicKey(new Uint8Array(32).fill(75));
const invalid = (i = 0) => ({InstructionError: [i, 'InvalidAccountData']});
/** The later step fails alone: its token transfer names DEST, which the step with the ATA create makes. */
const dependentStep =
  (i = 0) =>
  (keys: string[]) =>
    keys.includes(DEST.toBase58()) && !keys.includes(ATA_PROGRAM) ? invalid(i) : null;
const message = (b64: string) => VersionedTransaction.deserialize(base64.decode(b64)).message.serialize();
const signedBy = (b64: string, slot = 0) => {
  const tx = VersionedTransaction.deserialize(base64.decode(b64));
  return ed25519.verify(tx.signatures[slot] ?? new Uint8Array(64), tx.message.serialize(), ME.toBytes());
};
const REFUSED = (error: string) => ({ok: false, error});

/** A queued, simulated request (by default one System assign of the wallet account: F3, ASSIGN) and its approval. */
async function scene(o: {txs?: string[]; errFor?: (keys: string[]) => unknown; err?: unknown} = {}) {
  const c = await txScene({known: [RECIPIENT]});
  if (o.errFor !== undefined) c.chain.errFor = o.errFor;
  if (o.err !== undefined) c.chain.err = o.err;
  const wires = o.txs ?? [v0([assign()])];
  const requestId = String((await c.signTx('t', wires))?.requestId);
  const view = await c.simulated();
  const simulation = String(view.request?.tx?.simulation.id);
  const approve = (overrides?: unknown, sim = simulation) => c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, simulation: sim, ...(overrides === undefined ? {} : {overrides})});
  const challengeId = async (): Promise<string | null> => (await c.entry(requestId))?.challengeId ?? null;
  const signed = (): string[] => (c.page.answersFor(requestId)[0]?.result as {signed: string[]} | undefined)?.signed ?? [];
  /** The stored simulation rewritten in place (another id, unless `id` is given) — as a refresh would store it. */
  const restore = async (f: (sim: Extract<Entry['sim'], {status: 'ok'}>['sim']) => void, id = 'N'.repeat(22)): Promise<string> => {
    const s = await readDappSession(c.ext);
    const queue = structuredClone(s.queue);
    const e = queue.find(x => x.requestId === requestId);
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    f(e.sim.sim);
    e.sim.sim.id = id;
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue});
    return id;
  };
  return {...c, wires, requestId, view, simulation, approve, challengeId, signed, restore};
}
type Scene = Awaited<ReturnType<typeof scene>>;

/** The challenge proven for these words: the first approval issues it, #10's proof satisfies it. */
async function proveWith(c: Scene, words: {tx: number; word: string}[], simulation = c.simulation): Promise<string> {
  expect(await c.approve(words, simulation)).toEqual(REFUSED('reauth-required'));
  const id = String(await c.challengeId());
  expect(await c.reauthOk(id)).toEqual({ok: true});
  return id;
}

/** A chain-state F4 block (an own token account's owner reassigned by a CPI) — as redFlagsOf stores it. */
const authorityBlock = {
  kind: 'set-authority',
  severity: 'block',
  word: 'AUTHORITY',
  at: null,
  instructions: [],
  chain: [{account: OTHER.toBase58(), change: 'owner', from: ME.toBase58(), to: DEST.toBase58()}],
} as const;

describe('dapp.decide reads the overrides strictly (decideRequestOf)', () => {
  const base = {requestId: 'r', decision: 'approve', account: ACCOUNT.publicKey, simulation: 's'};
  it('absent → none; at most MAX_OVERRIDES of exactly {tx, word}, tx a whole number below the batch cap, a word of at most 32 characters; anything else is malformed', async () => {
    expect(decideRequestOf(base)?.overrides).toEqual([]);
    const ok = [
      {tx: 0, word: 'ASSIGN'},
      {tx: 4, word: 'U'.repeat(32)},
      {tx: 1, word: ''},
    ];
    expect(decideRequestOf({...base, overrides: ok})?.overrides).toEqual(ok);
    expect(MAX_OVERRIDES).toBe(20);
    expect(decideRequestOf({...base, overrides: Array.from({length: MAX_OVERRIDES}, (_, i) => ({tx: i % 5, word: 'X'}))})?.overrides).toHaveLength(MAX_OVERRIDES);
    const bad: unknown[] = [
      null,
      {},
      'ASSIGN',
      [null],
      new Array(1),
      [[0, 'ASSIGN']],
      [{tx: 0}],
      [{word: 'ASSIGN'}],
      [{tx: 0, word: 'ASSIGN', extra: 1}],
      [{tx: -1, word: 'ASSIGN'}],
      [{tx: 5, word: 'ASSIGN'}],
      [{tx: 0.5, word: 'ASSIGN'}],
      [{tx: '0', word: 'ASSIGN'}],
      [{tx: Number.NaN, word: 'ASSIGN'}],
      [{tx: 0, word: 1}],
      [{tx: 0, word: null}],
      [{tx: 0, word: 'U'.repeat(33)}],
      Array.from({length: MAX_OVERRIDES + 1}, () => ({tx: 0, word: 'X'})),
    ];
    for (const overrides of bad) expect([overrides, decideRequestOf({...base, overrides})]).toEqual([overrides, null]);
    // End to end: the message is refused before any check runs.
    const c = await scene();
    expect(await c.approve([{tx: '0', word: 'ASSIGN'}])).toEqual(REFUSED('malformed'));
    expect(c.page.answersFor(c.requestId)).toEqual([]);
  });
});

describe('dapp.decide for a request with a block (B1 §3’s override rule)', () => {
  it('no word → override-missing; a wrong, cased, padded, extra, repeated or another step’s word → override-mismatch; the right word without the proof → reauth-required; with it → signed, exactly the stored bytes', async () => {
    const c = await scene();
    expect(c.view.request?.tx?.reauth).toEqual({reasons: ['override'], state: 'needed'});
    expect(await c.approve()).toEqual(REFUSED('override-missing'));
    expect(await c.approve([])).toEqual(REFUSED('override-missing'));
    const wrong = [
      [{tx: 0, word: 'assign'}],
      [{tx: 0, word: 'ASSIGN '}],
      [{tx: 0, word: ' ASSIGN'}],
      [{tx: 1, word: 'ASSIGN'}],
      [{tx: 0, word: 'UNCHECKED'}],
      [
        {tx: 0, word: 'ASSIGN'},
        {tx: 0, word: 'ASSIGN'},
      ],
      [
        {tx: 0, word: 'ASSIGN'},
        {tx: 0, word: 'AUTHORITY'},
      ],
    ];
    for (const overrides of wrong) expect([overrides, await c.approve(overrides)]).toEqual([overrides, REFUSED('override-mismatch')]);
    // None of these reached the re-authentication gate: no challenge was issued.
    expect(await c.challengeId()).toBeNull();
    const words = [{tx: 0, word: 'ASSIGN'}];
    const challengeId = await proveWith(c, words);
    // The proof never stands in for the word, nor a wrong one for it.
    expect(await c.approve()).toEqual(REFUSED('override-missing'));
    expect(await c.approve([{tx: 0, word: 'Assign'}])).toEqual(REFUSED('override-mismatch'));
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect(await c.approve(words)).toEqual({ok: true});
    expect(c.page.answersFor(c.requestId)).toHaveLength(1);
    const [signed] = c.signed();
    expect(message(signed ?? '')).toEqual(message(c.wires[0] ?? ''));
    expect(signedBy(signed ?? '')).toBe(true);
    // Single use, as every proof.
    expect(await c.challengeInfo(challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('a request with no block: no words → signed; any word → override-mismatch (negative control)', async () => {
    const c = await scene({txs: [v0([transfer(1)])]});
    expect(c.view.request?.tx?.reauth).toBeNull();
    expect(await c.approve([{tx: 0, word: 'ASSIGN'}])).toEqual(REFUSED('override-mismatch'));
    expect(await c.approve([])).toEqual({ok: true});
  });

  it('every earlier refusal keeps its place: not-simulated, stale, out-of-date, an expired blockhash and a failed simulation come before the words', async () => {
    const early = await txScene({known: [RECIPIENT]});
    const r = await early.signTx('t', [v0([assign()])]);
    expect(await early.decide({requestId: r?.requestId, decision: 'approve', account: ACCOUNT.publicKey, overrides: [{tx: 0, word: 'nope'}]})).toEqual(REFUSED('not-simulated'));
    const c = await scene();
    expect(await c.approve([{tx: 0, word: 'nope'}], 'A'.repeat(22))).toEqual(REFUSED('stale'));
    c.deps.clock.t += SIM_VALID_MS;
    expect(await c.approve([{tx: 0, word: 'nope'}])).toEqual(REFUSED('out-of-date'));
    const expired = await scene({err: 'BlockhashNotFound'});
    expect(expired.view.request?.tx?.reauth).toMatchObject({reasons: ['override']});
    for (const words of [undefined, [{tx: 0, word: 'ASSIGN'}], [{tx: 0, word: 'nope'}]]) expect(await expired.approve(words)).toEqual(REFUSED('blockhash-expired'));
    const failed = await scene({err: {InstructionError: [0, {Custom: 1}]}});
    for (const words of [undefined, [{tx: 0, word: 'ASSIGN'}], [{tx: 0, word: 'nope'}]]) expect(await failed.approve(words)).toEqual(REFUSED('simulation-failed'));
    // A wrong word beside a missing one is the mismatch (the precedence of overridesMatch).
    const two = await scene({txs: [v0([assign()]), v0([assign()])]});
    expect(await two.approve([{tx: 0, word: 'nope'}])).toEqual(REFUSED('override-mismatch'));
    expect(await two.approve([{tx: 0, word: 'ASSIGN'}])).toEqual(REFUSED('override-missing'));
    expect(await two.approve([{tx: 1, word: 'ASSIGN'}])).toEqual(REFUSED('override-missing'));
    expect(await two.approve([{tx: 0, word: 'ASSIGN'}, {tx: 1, word: 'ASSIGN'}])).toEqual(REFUSED('reauth-required'));
  });

  it('a dependent step (F10): no word → override-missing, never simulation-failed; UNCHECKED for that step and the proof → the batch signed as stored', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])], errFor: dependentStep()});
    const items = c.view.request?.tx?.transactions as {outcome: unknown}[];
    expect(items[1]?.outcome).toEqual({ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'});
    expect(c.view.request?.tx?.reauth).toMatchObject({reasons: ['first-send', 'override']});
    expect(await c.approve()).toEqual(REFUSED('override-missing'));
    expect(await c.approve([{tx: 0, word: 'UNCHECKED'}])).toEqual(REFUSED('override-mismatch'));
    expect(await c.approve([{tx: 1, word: 'unchecked'}])).toEqual(REFUSED('override-mismatch'));
    const words = [{tx: 1, word: 'UNCHECKED'}];
    await proveWith(c, words);
    expect(await c.approve(words)).toEqual({ok: true});
    const signed = c.signed();
    expect(signed.map(message)).toEqual(c.wires.map(message));
    expect(signed.map(s => signedBy(s))).toEqual([true, true]);
  });

  it('negative controls: a later failure no earlier step explains, or an expired step, stays Reject-only with or without words', async () => {
    const unrelated = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(OTHER)])], errFor: keys => (keys.includes(OTHER.toBase58()) ? invalid() : null)});
    expect((unrelated.view.request?.tx?.transactions as {outcome: unknown}[])[1]?.outcome).toMatchObject({ok: false, error: 'failed'});
    for (const words of [undefined, [{tx: 1, word: 'UNCHECKED'}]]) expect(await unrelated.approve(words)).toEqual(REFUSED('simulation-failed'));
    const expired = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])], errFor: keys => (keys.includes(DEST.toBase58()) && !keys.includes(ATA_PROGRAM) ? 'BlockhashNotFound' : null)});
    for (const words of [undefined, [{tx: 1, word: 'UNCHECKED'}]]) expect(await expired.approve(words)).toEqual(REFUSED('blockhash-expired'));
    expect(unrelated.page.answersFor(unrelated.requestId)).toEqual([]);
    expect(expired.page.answersFor(expired.requestId)).toEqual([]);
  });

  it('two kinds of block on one step need both words (one field per transaction and kind); #10 names each, on its transaction', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([assign(), tokenTransfer(DEST)])], errFor: dependentStep(1)});
    expect(await c.approve([{tx: 1, word: 'ASSIGN'}])).toEqual(REFUSED('override-missing'));
    expect(await c.approve([{tx: 1, word: 'UNCHECKED'}])).toEqual(REFUSED('override-missing'));
    const words = [
      {tx: 1, word: 'UNCHECKED'},
      {tx: 1, word: 'ASSIGN'},
    ];
    expect(await c.approve(words)).toEqual(REFUSED('reauth-required'));
    const info = (await c.challengeInfo(String(await c.challengeId()))) as {ok: true; data: {flags: unknown[]}};
    expect(info.data.flags).toEqual(
      expect.arrayContaining([
        {tx: 1, row: 'F3', word: 'ASSIGN', step: null},
        {tx: 1, row: 'F10', word: 'UNCHECKED', step: 1},
        {tx: 0, row: 'F2', word: null, step: null},
      ]),
    );
    expect(describeChallenge(info.data)).toMatchObject({
      kind: 'dapp',
      overrides: [
        {label: 'Assign / Allocate on your wallet account', transaction: 'Transaction 2 of 2'},
        {label: 'Depends on step 1 — not checked on its own', transaction: 'Transaction 2 of 2'},
      ],
    });
  });
});

describe('the override’s re-authentication follows the flags (reauthGate)', () => {
  const WORDS = [{tx: 0, word: 'ASSIGN'}];

  it('a refresh with the same flags keeps the proof: signed with it (positive control)', async () => {
    const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
    const first = await proveWith(c, WORDS);
    c.deps.clock.t += SIM_REFRESH_MS;
    const fresh = String((await c.simulated(c.simulation)).request?.tx?.simulation.id);
    expect(fresh).not.toBe(c.simulation);
    expect(await c.approve(WORDS, fresh)).toEqual({ok: true});
    expect(await c.challengeInfo(first)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('a refresh that adds a block (reasons and amounts unchanged) re-issues the challenge: the old proof is not satisfied, the old id is gone', async () => {
    const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
    const first = await proveWith(c, WORDS);
    const fresh = await c.restore(sim => (sim.flags[0] = [structuredClone(authorityBlock) as unknown as (typeof sim.flags)[0][0], ...(sim.flags[0] ?? [])]));
    const both = [...WORDS, {tx: 0, word: 'AUTHORITY'}];
    expect(await c.approve(WORDS, fresh)).toEqual(REFUSED('override-missing'));
    expect(await c.approve(both, fresh)).toEqual(REFUSED('reauth-required'));
    const second = String(await c.challengeId());
    expect(second).not.toBe(first);
    expect(await c.reauthOk(first)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(((await c.challengeInfo(second)) as {data: {flags: unknown[]; reasons: unknown}}).data).toMatchObject({reasons: ['override'], flags: expect.arrayContaining([{tx: 0, row: 'F4', word: 'AUTHORITY', step: null}])});
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect(await c.reauthOk(second)).toEqual({ok: true});
    expect(await c.approve(both, fresh)).toEqual({ok: true});
  });

  it('a refresh that adds a warning re-issues it too — #10 described every flag it was shown', async () => {
    const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
    const first = await proveWith(c, WORDS);
    const fresh = await c.restore(sim => sim.flags[0]?.push({kind: 'whole-balance', severity: 'warn', word: null, at: null}));
    expect(await c.approve(WORDS, fresh)).toEqual(REFUSED('reauth-required'));
    expect(await c.challengeId()).not.toBe(first);
  });

  it('a refresh that changes a block’s word (the wallet no longer names the token: USDC → UNLIMITED) re-issues it — the word is part of what #10 named', async () => {
    const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
    const approval = {at: null, source: OTHER.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DEST.toBase58(), amount: '18446744073709551615', balance: '0'};
    const unlimited = (symbol: string | null, decimals: number) => ({kind: 'unlimited-approve', severity: 'block', word: symbol ?? 'UNLIMITED', at: null, approvals: [{...approval, symbol, decimals}]}) as unknown as Extract<Entry['sim'], {status: 'ok'}>['sim']['flags'][0][0];
    const named = await c.restore(sim => (sim.flags[0] = [unlimited('USDC', 6), ...(sim.flags[0] ?? [])]), 'U'.repeat(22));
    const first = await proveWith(c, [...WORDS, {tx: 0, word: 'USDC'}], named);
    const unnamed = await c.restore(sim => (sim.flags[0] = [unlimited(null, 9), ...(sim.flags[0] ?? []).slice(1)]), 'V'.repeat(22));
    expect(await c.approve([...WORDS, {tx: 0, word: 'USDC'}], unnamed)).toEqual(REFUSED('override-mismatch'));
    expect(await c.approve([...WORDS, {tx: 0, word: 'UNLIMITED'}], unnamed)).toEqual(REFUSED('reauth-required'));
    expect(await c.challengeId()).not.toBe(first);
    expect(c.page.answersFor(c.requestId)).toEqual([]);
  });

  it('the deciding section checks the words itself: a block stored between the gate and that section (the same simulation) is refused override-missing — nothing signed', async () => {
    const c = await scene();
    await proveWith(c, WORDS);
    const get = c.ext.session.get;
    let reads = 0;
    c.ext.session.get = async k => {
      // The gate's first read of the challenge store: the entry's stored simulation gains a block, keeping its id.
      if (k === REAUTH_KEY && ++reads === 1) await c.restore(sim => (sim.flags[0] = [structuredClone(authorityBlock) as unknown as (typeof sim.flags)[0][0], ...(sim.flags[0] ?? [])]), c.simulation);
      return get(k);
    };
    expect(await c.approve(WORDS)).toEqual(REFUSED('override-missing'));
    expect(reads).toBeGreaterThan(0);
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await c.entry(c.requestId))?.state).toBe('queued');
  });
});

describe('txRefused: a dependent step is open only beside its own F10 flag', () => {
  it('without the flag, or with one naming another step, the dependent outcome is a failure (simulation-failed)', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])], errFor: dependentStep()});
    const e = structuredClone(await c.entry(c.requestId));
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    const words = [{tx: 1, word: 'UNCHECKED'}];
    const now = c.deps.now();
    expect(txRefused(e, c.simulation, words, now)).toBeNull();
    const flags = e.sim.sim.flags;
    const dependent = flags[1]?.find(f => f.kind === 'dependent');
    if (dependent === undefined || dependent.kind !== 'dependent') throw new Error('no dependent flag');
    dependent.on = 1;
    expect(txRefused(e, c.simulation, words, now)).toBe('simulation-failed');
    flags[1] = (flags[1] ?? []).filter(f => f.kind !== 'dependent');
    expect(txRefused(e, c.simulation, [], now)).toBe('simulation-failed');
  });
});

describe('#48’s view of the flags (TxDetail)', () => {
  it('each transaction’s flags in the order stored, null while simulating; a dependent step names the step it depends on 1-based (dependsOnStep) — never the background’s 0-based index', async () => {
    const c = await txScene({known: [RECIPIENT]});
    c.chain.errFor = dependentStep();
    const requestId = String((await c.signTx('t', [v0([transfer(1)]), v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])]))?.requestId);
    const first = (await c.pend()) as unknown as {request: {tx: {transactions: {flags: unknown}[]}}};
    expect(first.request.tx.transactions.map(t => t.flags)).toEqual([null, null, null]);
    const view = await c.simulated();
    const raw = (view.request?.tx?.transactions as {flags: Record<string, unknown>[]}[])[2]?.flags ?? [];
    expect(raw.find(f => f.kind === 'dependent')).toEqual({kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, step: 2});
    const stored = await c.entry(requestId);
    expect(stored === undefined || stored.sim?.status !== 'ok' ? null : stored.sim.sim.flags.map(list => list.map(f => f.kind))).toEqual(
      (view.request?.tx?.transactions as {flags: {kind: string}[]}[]).map(t => t.flags.map(f => f.kind)),
    );
    const read = pendingOf(view);
    const items = read?.state === 'request' ? (read.request.tx?.transactions ?? []) : [];
    expect(items.map(dependsOnStep)).toEqual([null, null, 2]);
    expect(items[2]?.outcome).toMatchObject({error: 'dependent', on: 2});
  });
});
````

The challenge store's flags, both sides (B1c-2's helper and Task 3's `override` test gain flags — under this task's rule a challenge naming `override` must name a block, and one naming a block must give `override`):

`extension/src/background/__tests__/reauthChallenges.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/reauthChallenges.test.ts b/extension/src/background/__tests__/reauthChallenges.test.ts
index 89d9f1d..f8a9450 100644
--- a/extension/src/background/__tests__/reauthChallenges.test.ts
+++ b/extension/src/background/__tests__/reauthChallenges.test.ts
@@ -1,21 +1,22 @@
 import {ACCOUNT, RECIPIENT, SETTINGS_ABOUT} from './fixtures';
 import {lock} from '../autolock';
 import {REAUTH_KEY} from '../session';
-import {CHALLENGE_TTL_MS, type ChallengeAbout, type DappOutgoing, challengeSatisfied, consumeChallenge, dropChallenge, issueChallenge, satisfyChallenge} from '../reauthChallenges';
+import {CHALLENGE_TTL_MS, MAX_DAPP_FLAGS, type ChallengeAbout, type DappFlag, type DappOutgoing, challengeInfo, challengeSatisfied, consumeChallenge, dropChallenge, issueChallenge, satisfyChallenge} from '../reauthChallenges';
 import {WALLET_TOKENS} from '../../../../core/solana/balances';
 import type {DappReauthReason} from '../reauthPolicy';
 import {fakeDeps} from './fakeDeps';
 import {fakeExt} from './fakeExt';
 
-const dappAbout = (outgoing: DappOutgoing[], reasons: DappReauthReason[] = ['first-send']): ChallengeAbout => ({
+const dappAbout = (outgoing: DappOutgoing[], reasons: DappReauthReason[] = ['first-send'], flags: DappFlag[] = [], transactions = 1): ChallengeAbout => ({
   kind: 'dapp',
   account: ACCOUNT.publicKey,
   site: 'dapp.test',
-  transactions: 1,
+  transactions,
   outgoing,
   omitted: 0,
   reasons,
   thresholdCents: 10_000,
+  flags,
 });
 
 describe('re-auth challenges', () => {
@@ -206,9 +207,74 @@ describe('re-auth challenges', () => {
     const ext = fakeExt();
     const deps = fakeDeps();
     const sol: DappOutgoing = {mint: null, symbol: 'SOL', amount: '1', decimals: WALLET_TOKENS.SOL.decimals};
-    const id = await issueChallenge(ext, deps, 'o1', dappAbout([sol], ['approval', 'override']));
+    const id = await issueChallenge(ext, deps, 'o1', dappAbout([sol], ['approval', 'override'], [{tx: 0, row: 'F3', word: 'ASSIGN', step: null}]));
     expect(await satisfyChallenge(ext, deps.now(), id)).toBe(true);
     expect(await challengeSatisfied(ext, deps.now(), id, 'o1')).toBe(true);
     await expect(issueChallenge(ext, deps, 'o2', dappAbout([sol], ['overrides'] as unknown as DappReauthReason[]))).rejects.toThrow();
   });
 });
+
+// B1c-3 (spec §3.3 rev 3.6): #10 names what is overridden — the flags travel in the challenge, compact and exact.
+describe('a dApp challenge’s flags', () => {
+  const sol: DappOutgoing = {mint: null, symbol: 'SOL', amount: '1', decimals: WALLET_TOKENS.SOL.decimals};
+  const FLAGS: DappFlag[] = [
+    {tx: 0, row: 'F5', word: 'USDC', step: null},
+    {tx: 0, row: 'F7', word: null, step: null},
+    {tx: 1, row: 'F4', word: 'AUTHORITY', step: null},
+    {tx: 2, row: 'F10', word: 'UNCHECKED', step: 2},
+    {tx: 2, row: 'F3', word: 'ASSIGN', step: null},
+    {tx: 2, row: 'F5', word: 'UNLIMITED', step: null},
+    {tx: 2, row: 'F2', word: null, step: null},
+  ];
+  const about = (flags: unknown[], reasons: DappReauthReason[] = ['override']) => dappAbout([sol], reasons, flags as DappFlag[], 3);
+
+  it('every row of the table (F1–F10), each block with its own word, a dependent step naming an earlier one: issued and read back exactly (positive control)', async () => {
+    const ext = fakeExt();
+    const deps = fakeDeps();
+    const warnings: DappFlag[] = (['F1', 'F2', 'F6', 'F7', 'F8', 'F9'] as const).map(row => ({tx: 1, row, word: null, step: null}));
+    for (const flags of [FLAGS, warnings]) {
+      const reasons: DappReauthReason[] = flags === FLAGS ? ['first-send', 'override'] : ['first-send'];
+      const id = await issueChallenge(ext, deps, 'f1', about(flags, reasons));
+      expect(await challengeInfo(ext, deps.now(), id)).toEqual(about(flags, reasons));
+    }
+    expect(MAX_DAPP_FLAGS).toBe(50);
+  });
+
+  it('refused: a key more or less, an unknown row (F11 never reaches a challenge), a transaction past the batch, a warning with a word, a block without its own word, a symbol the wallet does not name, a step not before its own, a row twice on one transaction, a block without `override` or `override` without a block, too many', async () => {
+    const ext = fakeExt();
+    const deps = fakeDeps();
+    const one = (f: Record<string, unknown>) => [{tx: 1, row: 'F3', word: 'ASSIGN', step: null, ...f}];
+    const bad: unknown[][] = [
+      [{tx: 1, row: 'F3', word: 'ASSIGN'}],
+      one({extra: 1}),
+      one({row: 'F11'}),
+      one({tx: 3}),
+      one({tx: -1}),
+      one({tx: 0.5}),
+      one({tx: '1'}),
+      one({row: 'F2'}),
+      one({word: null}),
+      one({word: 'AUTHORITY'}),
+      one({word: 'assign'}),
+      one({row: 'F4', word: 'ASSIGN'}),
+      one({row: 'F5', word: 'SOL'}),
+      one({row: 'F5', word: 'BONK'}),
+      one({row: 'F5', word: 'usdc'}),
+      one({row: 'F10', word: 'UNCHECKED', step: null}),
+      one({row: 'F10', word: 'UNCHECKED', step: 0}),
+      one({row: 'F10', word: 'UNCHECKED', step: 2}),
+      one({step: 1}),
+      [...one({}), ...one({})],
+      [...one({}), ...one({word: 'ASSIGN'})],
+      Array.from({length: MAX_DAPP_FLAGS + 1}, (_, i) => ({tx: i % 3, row: 'F7', word: null, step: null})),
+    ];
+    for (const flags of bad) await expect(issueChallenge(ext, deps, 'b', about(flags))).rejects.toThrow();
+    await expect(issueChallenge(ext, deps, 'b', about(FLAGS, ['first-send']))).rejects.toThrow();
+    await expect(issueChallenge(ext, deps, 'b', about([{tx: 0, row: 'F7', word: null, step: null}], ['override']))).rejects.toThrow();
+    await expect(issueChallenge(ext, deps, 'b', {...about(FLAGS), flags: undefined} as unknown as ChallengeAbout)).rejects.toThrow();
+    // Positive control for the cases above: each one's valid form issues.
+    await expect(issueChallenge(ext, deps, 'b', about(one({})))).resolves.toMatch(/^[0-9a-f]{32}$/);
+    await expect(issueChallenge(ext, deps, 'b', about(one({row: 'F10', word: 'UNCHECKED', step: 1})))).resolves.toMatch(/^[0-9a-f]{32}$/);
+    await expect(issueChallenge(ext, deps, 'b', about(one({row: 'F5', word: 'NOC'})))).resolves.toMatch(/^[0-9a-f]{32}$/);
+  });
+});
````

`extension/src/unlock/__tests__/challenge.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/challenge.test.ts b/extension/src/unlock/__tests__/challenge.test.ts
index ceec0e2..db860e4 100644
--- a/extension/src/unlock/__tests__/challenge.test.ts
+++ b/extension/src/unlock/__tests__/challenge.test.ts
@@ -38,6 +38,7 @@ const DAPP: ChallengeAbout = {
   omitted: 0,
   reasons: ['first-send', 'approval'],
   thresholdCents: 10_000,
+  flags: [],
 };
 
 describe('describeChallenge: a dApp’s transaction (B1c-2)', () => {
@@ -53,6 +54,7 @@ describe('describeChallenge: a dApp’s transaction (B1c-2)', () => {
       ],
       omitted: 0,
       reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required to approve a token allowance.'],
+      overrides: [],
     });
   });
 
@@ -80,8 +82,71 @@ describe('describeChallenge: a dApp’s transaction (B1c-2)', () => {
 // B1c-3 (spec §3.3 rev 3.6): a request with a block re-authenticates with the reason `override` (Q33).
 describe('describeChallenge: the override reason (B1c-3)', () => {
   it('`override` reads Q33’s line; an unknown reason still makes the whole description unshowable', () => {
-    expect(describeChallenge({...DAPP, reasons: ['approval', 'override']})).toMatchObject({kind: 'dapp', reasons: ['Re-auth required to approve a token allowance.', 'Re-auth required to override a blocked transaction.']});
-    expect(describeChallenge({...DAPP, reasons: ['override', 'overrides']})).toBeNull();
+    const flags = [{tx: 0, row: 'F3', word: 'ASSIGN', step: null}];
+    expect(describeChallenge({...DAPP, reasons: ['approval', 'override'], flags})).toMatchObject({kind: 'dapp', reasons: ['Re-auth required to approve a token allowance.', 'Re-auth required to override a blocked transaction.']});
+    expect(describeChallenge({...DAPP, reasons: ['override', 'overrides'], flags})).toBeNull();
+  });
+});
+
+// B1c-3 (spec §3.3 rev 3.6, "#10's description names what is overridden"): one row per block — what is overridden and,
+// in a batch, on which transaction; the warnings travel too (the re-issue compares them) but are not rows here.
+describe('describeChallenge: what is overridden (B1c-3)', () => {
+  const FLAGS = [
+    {tx: 0, row: 'F5', word: 'USDC', step: null},
+    {tx: 0, row: 'F2', word: null, step: null},
+    {tx: 1, row: 'F4', word: 'AUTHORITY', step: null},
+    {tx: 1, row: 'F10', word: 'UNCHECKED', step: 1},
+    {tx: 1, row: 'F3', word: 'ASSIGN', step: null},
+    {tx: 1, row: 'F5', word: 'UNLIMITED', step: null},
+    {tx: 1, row: 'F7', word: null, step: null},
+  ];
+  const OVERRIDE = {...DAPP, reasons: ['first-send', 'override'], flags: FLAGS};
+
+  it('one row per block, in the order given: the label and “Transaction <n> of <m>” in a batch; a single transaction’s rows carry no transaction', () => {
+    expect(describeChallenge(OVERRIDE)).toMatchObject({
+      kind: 'dapp',
+      reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required to override a blocked transaction.'],
+      overrides: [
+        {label: 'Unlimited USDC spend approval', transaction: 'Transaction 1 of 2'},
+        {label: 'SetAuthority on an account you own', transaction: 'Transaction 2 of 2'},
+        {label: 'Depends on step 1 — not checked on its own', transaction: 'Transaction 2 of 2'},
+        {label: 'Assign / Allocate on your wallet account', transaction: 'Transaction 2 of 2'},
+        {label: 'Unlimited token spend approval', transaction: 'Transaction 2 of 2'},
+      ],
+    });
+    expect(describeChallenge({...OVERRIDE, transactions: 1, flags: [{tx: 0, row: 'F3', word: 'ASSIGN', step: null}]})).toMatchObject({overrides: [{label: 'Assign / Allocate on your wallet account', transaction: null}]});
+    // Warnings only: no rows, and no `override` reason.
+    expect(describeChallenge({...DAPP, flags: [{tx: 1, row: 'F8', word: null, step: null}]})).toMatchObject({overrides: []});
+  });
+
+  it('fails closed on anything the background never issues: the flags missing, an unknown row, a transaction past the batch, a wrong word, a step not before its own, a row twice, a block without `override` or `override` without a block', () => {
+    const one = (f: Record<string, unknown>) => ({...OVERRIDE, flags: [{tx: 1, row: 'F3', word: 'ASSIGN', step: null, ...f}]});
+    for (const bad of [
+      Object.fromEntries(Object.entries(OVERRIDE).filter(([k]) => k !== 'flags')),
+      {...OVERRIDE, flags: null},
+      one({extra: 1}),
+      one({row: 'F11'}),
+      one({tx: 2}),
+      one({tx: -1}),
+      one({word: 'assign'}),
+      one({word: null}),
+      one({row: 'F2', word: 'ASSIGN'}),
+      one({row: 'F5', word: 'SOL'}),
+      one({row: 'F5', word: 'BONK'}),
+      one({row: 'F10', word: 'UNCHECKED', step: 2}),
+      one({row: 'F10', word: 'UNCHECKED', step: 0}),
+      one({row: 'F10', word: 'UNCHECKED', step: null}),
+      one({step: 1}),
+      {...OVERRIDE, flags: [...FLAGS, FLAGS[2]]},
+      {...OVERRIDE, reasons: ['first-send']},
+      {...DAPP, reasons: ['first-send', 'override']},
+      {...OVERRIDE, flags: Array.from({length: 51}, (_, i) => ({tx: i % 2, row: 'F7', word: null, step: null}))},
+    ]) {
+      expect([bad, describeChallenge(bad)]).toEqual([bad, null]);
+    }
+    // Positive control: each one's valid form.
+    expect(describeChallenge(one({}))).not.toBeNull();
+    expect(describeChallenge(one({row: 'F10', word: 'UNCHECKED', step: 1}))).not.toBeNull();
   });
 });
 
````

`extension/src/unlock/__tests__/reauthScreen.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/reauthScreen.test.ts b/extension/src/unlock/__tests__/reauthScreen.test.ts
index 894373e..ae94fce 100644
--- a/extension/src/unlock/__tests__/reauthScreen.test.ts
+++ b/extension/src/unlock/__tests__/reauthScreen.test.ts
@@ -622,7 +622,7 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
   });
 
   // B1c-2 (spec B1c §3.3, D11): a site's transaction, reached from the popup's strip — #10 proves; the window signs.
-  const DAPP: ChallengeAbout = {kind: 'dapp', account: K0, site: 'jup.ag', transactions: 1, outgoing: [{mint: null, symbol: 'SOL', amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000};
+  const DAPP: ChallengeAbout = {kind: 'dapp', account: K0, site: 'jup.ag', transactions: 1, outgoing: [{mint: null, symbol: 'SOL', amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000, flags: []};
   it('a dApp’s transaction: "You are about to approve", the site and what leaves the account; confirmed → back to the approval window, nothing sent here', async () => {
     const {h, broadcast} = await shown(DAPP);
     expect(text(el('ra-about'))).toBe('You are about to approve');
@@ -669,6 +669,34 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag']);
   });
 
+  // B1c-3 (spec §3.3 rev 3.6): an override — Q33's reason line, and one row per block after what leaves the account:
+  // what is overridden and, in a batch, on which transaction. A warning is no row.
+  it('a dApp’s override: Q33’s line and one row per block (what, and on which transaction of a batch); a warning is no row', async () => {
+    await shown({
+      ...DAPP,
+      transactions: 2,
+      reasons: ['first-send', 'override'],
+      flags: [
+        {tx: 0, row: 'F2', word: null, step: null},
+        {tx: 1, row: 'F10', word: 'UNCHECKED', step: 1},
+        {tx: 1, row: 'F5', word: 'USDC', step: null},
+      ],
+    });
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual([
+      'Sitejup.ag',
+      'Transactions2',
+      'Depends on step 1 — not checked on its ownTransaction 2 of 2',
+      'Unlimited USDC spend approvalTransaction 2 of 2',
+    ]);
+    expect([...el('ra-reasons').children].map(text)).toEqual(['Re-auth required for the first send to a new address.', 'Re-auth required to override a blocked transaction.']);
+    expect(unstyled('v-reauth')).toEqual([]);
+    loadPage();
+    await shown({...DAPP, reasons: ['override'], flags: [{tx: 0, row: 'F4', word: 'AUTHORITY', step: null}]});
+    // A single transaction: the row names what, the headline is still the one asset leaving.
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'SetAuthority on an account you own']);
+    expect([visible(el('ra-amount-row')), text(el('ra-amount'))]).toEqual([true, '−0.001005']);
+  });
+
   it('a dApp’s transaction: expired and locked say what is true for a site’s request; Cancel only closes the tab', async () => {
     const one = await shown(DAPP);
     one.h.wallet.clock.t += CHALLENGE_TTL_MS;
````

The window: the `TxItem` fixtures gain `flags: null` (simulating); B1c-2's I1 negative control keeps its point (a malformed field value is refused) with the new consequence (the detail is `null` → Q26, never a blank window); Task 3's one-transaction `pendingOf` test is rewritten as a two-step batch (a dependent outcome on a batch's first transaction names no earlier step, which the parser now refuses) and carries every flag kind:

`extension/src/approve/__tests__/tx.test.tsx`:

````diff
diff --git a/extension/src/approve/__tests__/tx.test.tsx b/extension/src/approve/__tests__/tx.test.tsx
index adede35..96ed97e 100644
--- a/extension/src/approve/__tests__/tx.test.tsx
+++ b/extension/src/approve/__tests__/tx.test.tsx
@@ -13,7 +13,7 @@ import {GRANTS_KEY} from '../../background/dapp/grants';
 import {openPage} from '../../background/dapp/__tests__/pageHarness';
 import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
 import {ME, coSigned, mintTo, setAuthorityToNone, transfer, v0} from '../../background/dapp/__tests__/txHarness';
-import {pendingOf, type RequestView} from '../client';
+import {dependsOnStep, pendingOf, type RequestView} from '../client';
 import {Tx} from '../Tx';
 import {ARM_MS} from '../useArmed';
 import {CONFIRM_DELAY_MS} from '../ui';
@@ -410,47 +410,119 @@ describe('#48 dapp-tx-approval', () => {
             unitLimit: null,
             feeLamports: null,
             outcome: null,
+            flags: null,
             instructions: [{programId: null, program: null, name: null, fields: [{name: 'x', value: {kind: 'bogus'}}]}],
           },
         ],
       },
     };
-    expect(pendingOf({state: 'request', waiting: 0, windowNotice: false, request})).toBeNull();
+    // B1c-3: a transaction detail the window cannot read is no detail — Q26 and only Reject, never a blank window.
+    const read = pendingOf({state: 'request', waiting: 0, windowNotice: false, request});
+    expect(read?.state === 'request' ? read.request.tx : 'unread').toBeNull();
   });
 
-  // B1c-3: the window's own list of re-authentication reasons (one of the four places a reason is named) and the
-  // dependent step's outcome (F10) — read strictly, like everything else the background sends.
-  it('pendingOf: `override` and a dependent step’s outcome are read; an unknown reason, or a dependent outcome naming no earlier step, is refused', () => {
-    const view = (reasons: unknown[], outcome: unknown) => ({
-      state: 'request',
-      waiting: 0,
-      windowNotice: false,
-      request: {
-        requestId: 'x',
-        type: 'signTransaction',
-        origin: 'https://jup.ag',
-        host: 'jup.ag',
-        site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
-        offerBlock: false,
-        connect: null,
-        sign: null,
-        mismatch: null,
-        tx: {
-          kind: 'signTransaction',
-          account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
-          simulation: {status: 'ok', id: 'AAAAAAAAAAAAAAAAAAAAAA', slot: 1, elapsedMs: 1, at: 1},
-          reauth: {reasons, state: 'needed'},
-          labels: [],
-          transactions: [{version: 0, feePayer: ACCOUNT.publicKey, unitLimit: null, feeLamports: null, outcome, instructions: []}],
-        },
+  // B1c-3: the window's own list of re-authentication reasons (one of the four places a reason is named), the
+  // dependent step's outcome (F10) and every red flag — read strictly, like everything else the background sends; a
+  // detail it cannot read is refused whole (Q26, only Reject), never shown with a flag or a reason dropped.
+  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
+  const ok = {ok: true, changes: [], unitsConsumed: 1, unitLimit: 200_000, feeLamports: '5000'};
+  const dependentOutcome = {ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'};
+  const DEPENDENT = {kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, step: 1};
+  /** Every kind redFlagsOf gives, as the background's view sends it (signTx.ts txDetail). */
+  const EVERY_FLAG = [
+    {kind: 'assign', severity: 'block', word: 'ASSIGN', at: 0, instructions: [{index: 0, program: 'system', name: 'assign'}], chain: {owner: RECIPIENT, space: 0}},
+    {kind: 'set-authority', severity: 'block', word: 'AUTHORITY', at: 1, instructions: [{index: 1, program: 'token', account: RECIPIENT, owned: 'token-account', authorityType: 'accountOwner', newAuthority: null}], chain: [{account: RECIPIENT, change: 'owner', from: ACCOUNT.publicKey, to: RECIPIENT}]},
+    {kind: 'unlimited-approve', severity: 'block', word: 'USDC', at: 2, approvals: [{at: 2, source: RECIPIENT, mint: USDC_MINT, symbol: 'USDC', decimals: 6, delegate: RECIPIENT, amount: '18446744073709551615', balance: '5'}]},
+    {kind: 'unlimited-approve', severity: 'block', word: 'UNLIMITED', at: null, approvals: [{at: null, source: RECIPIENT, mint: null, symbol: null, decimals: null, delegate: null, amount: '5', balance: '5'}]},
+    {kind: 'unknown-program', severity: 'warn', word: null, at: 0, programs: [RECIPIENT, null]},
+    {kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'system', name: 'assign'}, {index: 3, program: 'token', name: null}]},
+    {kind: 'bounded-approve', severity: 'warn', word: null, at: 2, approvals: [{at: 2, source: RECIPIENT, mint: RECIPIENT, symbol: null, decimals: 0, delegate: RECIPIENT, amount: '4', balance: '5'}]},
+    {kind: 'token-2022', severity: 'warn', word: null, at: null, mint: RECIPIENT, settings: {freezeAuthority: RECIPIENT, permanentDelegate: null, transferHookProgram: RECIPIENT}},
+    {kind: 'token-2022', severity: 'warn', word: null, at: 4, mint: USDC_MINT, settings: null},
+    {kind: 'durable-nonce', severity: 'warn', word: null, at: 0},
+    {kind: 'whole-balance', severity: 'warn', word: null, at: null},
+  ];
+  /** A two-step batch: step 1 as given, step 2 (dependent on step 1 unless said otherwise) with its flags. */
+  const batchView = (o: {reasons?: unknown[]; first?: unknown; second?: unknown; outcome?: unknown; firstOutcome?: unknown}) => ({
+    state: 'request',
+    waiting: 0,
+    windowNotice: false,
+    request: {
+      requestId: 'x',
+      type: 'signTransaction',
+      origin: 'https://jup.ag',
+      host: 'jup.ag',
+      site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
+      offerBlock: false,
+      connect: null,
+      sign: null,
+      mismatch: null,
+      tx: {
+        kind: 'signTransaction',
+        account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
+        simulation: {status: 'ok', id: 'AAAAAAAAAAAAAAAAAAAAAA', slot: 1, elapsedMs: 1, at: 1},
+        reauth: {reasons: o.reasons ?? ['first-send', 'override'], state: 'needed'},
+        labels: [],
+        transactions: [
+          {version: 0, feePayer: ACCOUNT.publicKey, unitLimit: null, feeLamports: null, outcome: 'firstOutcome' in o ? o.firstOutcome : ok, instructions: [], flags: 'first' in o ? o.first : []},
+          {version: 0, feePayer: ACCOUNT.publicKey, unitLimit: null, feeLamports: null, outcome: 'outcome' in o ? o.outcome : dependentOutcome, instructions: [], flags: 'second' in o ? o.second : [DEPENDENT]},
+        ],
       },
-    });
-    const dependent = {ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'};
-    const read = pendingOf(view(['first-send', 'override'], dependent));
-    expect(read?.state === 'request' ? [read.request.tx?.reauth?.reasons, read.request.tx?.transactions[0]?.outcome] : null).toEqual([['first-send', 'override'], dependent]);
-    expect(pendingOf(view(['overrides'], null))).toBeNull();
-    expect(pendingOf(view(['override'], {...dependent, on: 0}))).toBeNull();
-    expect(pendingOf(view(['override'], {ok: false, error: 'dependent', detail: 'x'}))).toBeNull();
+    },
+  });
+  const txOf = (x: unknown) => {
+    const read = pendingOf(x);
+    return read?.state === 'request' ? read.request.tx : 'unread';
+  };
+
+  it('pendingOf: `override`, a dependent step’s outcome and every kind of flag are read exactly; dependsOnStep names the 1-based step', () => {
+    const tx = txOf(batchView({first: EVERY_FLAG}));
+    expect(tx === null || tx === 'unread' ? null : [tx.reauth?.reasons, tx.transactions.map(t => t.outcome), tx.transactions.map(t => t.flags)]).toEqual([
+      ['first-send', 'override'],
+      [ok, dependentOutcome],
+      [EVERY_FLAG, [DEPENDENT]],
+    ]);
+    expect(tx === null || tx === 'unread' ? null : tx.transactions.map(dependsOnStep)).toEqual([null, 1]);
+    // While simulating: no outcome, no flags.
+    expect(txOf(batchView({first: null, firstOutcome: null, second: null, outcome: null}))).toMatchObject({transactions: [{flags: null}, {flags: null}]});
+  });
+
+  it('pendingOf refuses the whole detail (tx null → Q26) for an unknown reason, an unknown flag kind, a key more or less, a block’s wrong word, or a dependent step that disagrees with its outcome or names no earlier step', () => {
+    const assign = EVERY_FLAG[0] as Record<string, unknown>;
+    for (const bad of [
+      batchView({reasons: ['overrides']}),
+      batchView({first: [{kind: 'drain', severity: 'warn', word: null, at: 0}]}),
+      batchView({first: [{...assign, extra: 1}]}),
+      batchView({first: [Object.fromEntries(Object.entries(assign).filter(([k]) => k !== 'chain'))]}),
+      batchView({first: [{...assign, word: 'assign'}]}),
+      batchView({first: [{...assign, severity: 'warn'}]}),
+      batchView({first: [{...(EVERY_FLAG[2] as Record<string, unknown>), word: 'BONK'}]}),
+      batchView({first: [{...(EVERY_FLAG[4] as Record<string, unknown>), word: 'X'}]}),
+      batchView({first: [{...(EVERY_FLAG[9] as Record<string, unknown>), at: null}]}),
+      batchView({first: [{...(EVERY_FLAG[7] as Record<string, unknown>), settings: {freezeAuthority: 'x'}}]}),
+      batchView({first: 'none'}),
+      batchView({second: [{...DEPENDENT, on: 0}]}),
+      batchView({second: [{...DEPENDENT, step: 2}]}),
+      batchView({second: []}),
+      batchView({second: [DEPENDENT], outcome: ok}),
+      batchView({second: [DEPENDENT, DEPENDENT]}),
+      batchView({outcome: {...dependentOutcome, on: 2}}),
+      batchView({outcome: {...dependentOutcome, on: 0}}),
+      batchView({outcome: {ok: false, error: 'dependent', detail: 'x'}}),
+      batchView({first: [{...DEPENDENT}], firstOutcome: {...dependentOutcome}}),
+      batchView({second: null}),
+      batchView({first: [], firstOutcome: null}),
+    ]) {
+      expect([bad, txOf(bad)]).toEqual([bad, null]);
+    }
+  });
+
+  it('a detail refused for an unknown flag kind: Q26 and only Reject — never the request with the flag dropped', () => {
+    const read = pendingOf(batchView({first: [{kind: 'drain', severity: 'warn', word: null, at: 0}]}));
+    if (read?.state !== 'request') throw new Error('unread');
+    render(<Tx request={read.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    expect(screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.')).toBeTruthy();
+    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
   });
 
   // Fix round 1, I2: the sheet is for exactly the simulation it opened on; a refresh landing while it is open must
@@ -506,7 +578,7 @@ describe('#48 dapp-tx-approval', () => {
         simulation: {status: 'simulating'},
         reauth: null,
         labels: [],
-        transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null}],
+        transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null, flags: null}],
       },
     };
     render(<Tx request={request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
@@ -535,7 +607,7 @@ describe('#48 dapp-tx-approval', () => {
         simulation: {status: 'simulating'},
         reauth: null,
         labels: [],
-        transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null}],
+        transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null, flags: null}],
       },
     };
     const withoutTx: RequestView = {...withTx, tx: null};
````

The `about` fixtures B1c-2 wrote by hand gain `flags: []`:

````diff
diff --git a/extension/src/background/dapp/__tests__/signTx.test.ts b/extension/src/background/dapp/__tests__/signTx.test.ts
index 5c41a64..ee1c243 100644
--- a/extension/src/background/dapp/__tests__/signTx.test.ts
+++ b/extension/src/background/dapp/__tests__/signTx.test.ts
@@ -269,7 +269,7 @@ describe('re-authentication for a transaction request', () => {
     expect((await c.pend()).request?.tx?.reauth).toEqual({reasons: ['first-send'], state: 'waiting'});
     expect(await c.challengeInfo(challengeId)).toEqual({
       ok: true,
-      data: {kind: 'dapp', account: ACCOUNT.publicKey, site: 'dapp.test', transactions: 1, outgoing: [{mint: null, symbol: 'SOL', amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000},
+      data: {kind: 'dapp', account: ACCOUNT.publicKey, site: 'dapp.test', transactions: 1, outgoing: [{mint: null, symbol: 'SOL', amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000, flags: []},
     });
     // Still refused while unproven; the challenge is not reissued.
     expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'reauth-required'});
@@ -639,6 +639,7 @@ describe('dapp.reauth (the popup’s offer of #10)', () => {
       omitted: 0,
       reasons: ['first-send' as const],
       thresholdCents: 10_000,
+      flags: [],
     };
     entry.challengeId = await issueChallenge(c.ext, c.deps, dappDigest(entry), about);
     await c.ext.session.set(DAPP_SESSION_KEY, {queue: [entry], grants: [], window: null, opening: null, undo: []});
diff --git a/extension/src/app/__tests__/Home.test.tsx b/extension/src/app/__tests__/Home.test.tsx
index b83a580..f35a32a 100644
--- a/extension/src/app/__tests__/Home.test.tsx
+++ b/extension/src/app/__tests__/Home.test.tsx
@@ -673,7 +673,7 @@ describe('#11: a site’s transaction waiting for its confirmation (B1c-2)', ()
       message: null, transactions: ['AQ=='], granted: null, sim: null, challengeId: null as string | null, sent: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null,
       decision: null, answer: null, answeredAt: null,
     };
-    const about = {kind: 'dapp' as const, account: ACCOUNT.publicKey, site: 'jup.ag', transactions: 1, outgoing: [{mint: null, symbol: 'SOL' as const, amount: '1', decimals: 9}], omitted: 0, reasons: ['first-send' as const], thresholdCents: 10_000};
+    const about = {kind: 'dapp' as const, account: ACCOUNT.publicKey, site: 'jup.ag', transactions: 1, outgoing: [{mint: null, symbol: 'SOL' as const, amount: '1', decimals: 9}], omitted: 0, reasons: ['first-send' as const], thresholdCents: 10_000, flags: []};
     entry.challengeId = await issueChallenge(ext, {now: () => T, randomBytes: n => new Uint8Array(n).fill(4)}, dappDigest(entry), about);
     await ext.session.set(DAPP_SESSION_KEY, {queue: [entry], grants: [], window: null, opening: null, undo: []});
     return entry.challengeId;
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/background/dapp/__tests__/overrides.test.ts src/background/__tests__/reauthChallenges.test.ts src/unlock/__tests__/challenge.test.ts src/unlock/__tests__/reauthScreen.test.ts src/approve/__tests__/tx.test.tsx src/background/dapp/__tests__/signTx.test.ts src/app/__tests__/Home.test.tsx` — expected: Test Files  7 failed (7) · Tests  38 failed | 176 passed (214). The 38: 12 of `overrides.test.ts`'s 14 (`overrides` undefined; `reauth-required` where `override-missing` is expected — the gate ran with no word; a dependent batch `simulation-failed`; a refresh that adds a block, a warning or a new word signed on the old proof; `flags` undefined in the view) — its two controls pass on the old tree and pin what this task keeps: a later failure no earlier step explains (or an expired step) stays Reject-only, and a refresh with the same flags keeps the proof; every test issuing or describing a dApp `about` with `flags` (`issueChallenge: malformed about` — 9 keys — or `describeChallenge` → null: reauthChallenges 4, challenge 6, reauthScreen 6, Home 4, signTx 2); and the window's three new tests plus the rewritten I1 control (`pendingOf` → null, not `tx: null`). `npx tsc --noEmit; echo $?` → `2` (24 errors: `MAX_OVERRIDES`, `DecideRequest.overrides`, `txRefused`'s fourth argument, `DappFlag`, `MAX_DAPP_FLAGS`, `dependsOnStep`, `TxItem.flags`, the `about`'s `flags`).

- [ ] **Step 3: Implement.**

The spec: §3.3's override rule says what #10 names and what re-issues; §10 gains Q37–Q40 (controller copy, flagged to the owner):

`docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md`:

````diff
diff --git a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
index 6e7b723..5d55641 100644
--- a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
+++ b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
@@ -640,7 +640,8 @@ proxy (`getMultipleAccounts`). The window only renders the flags stored with the
   recomputes every expected word from its stored simulation and refuses the approval unless every block has its exact
   word, and refuses it when any block has none. A request with any block always re-authenticates through #10 (the
   reason line: "Re-auth required to override a blocked transaction.", Q33); #10's description names what is
-  overridden, and a refresh that adds a block asks for a new re-authentication. The re-authentication stays bound to
+  overridden — one row per block, Q37–Q40, with "Transaction <n> of <m>" in a batch — and a refresh that adds a
+  flag (a block or a warning) or changes a block's word or step asks for a new re-authentication. The re-authentication stays bound to
   the exact bytes (B1c-2); the words are not secrets and are bound only by the background recomputing them. No setting
   disables a block.
 - **Holds (B1 §3).** On any screen with a flag (warning or block) every confirming CTA is held **1.5 s** — on top of
@@ -962,6 +963,10 @@ empty, detail, hold, undo toast, blocked section) at 412 px; the opus-tier revie
 | Q34 | #48 red CTA for a block other than an unlimited approve (rev 3.6, controller copy, flagged to the owner) | "Approve anyway" |
 | Q35 | #48 top-bar eyebrow for a block other than an unlimited approve (rev 3.6, controller copy, flagged to the owner) | "Critical · Blocked transaction" |
 | Q36 | #48 F7 warning, a mint that cannot be read or parsed (rev 3.6, controller copy, flagged to the owner) | "Could not read this token's settings" |
+| Q37 | #10 row for an overridden F3 block (rev 3.6, plan 3 Task 4, controller copy, flagged to the owner — B1 §3's row) | "Assign / Allocate on your wallet account" |
+| Q38 | #10 row for an overridden F4 block (rev 3.6, plan 3 Task 4, controller copy, flagged to the owner — B1 §3's row) | "SetAuthority on an account you own" |
+| Q39 | #10 row for an overridden F5 block (rev 3.6, plan 3 Task 4, controller copy, flagged to the owner — the design's F5 head) | "Unlimited <SYM> spend approval"; "Unlimited token spend approval" when the wallet's table names no symbol (`UNLIMITED`) |
+| Q40 | #10 row for an overridden F10 block (rev 3.6, plan 3 Task 4, controller copy, flagged to the owner — Q32 as a row) | "Depends on step <N> — not checked on its own" |
 
 (Q09 and Q11 of rev 1 are gone: the window no longer shows "expired" for a request it did not show, and the undo toast
 uses the design's drawn strings.)
````

The decision's words, read strictly, and passed to both sections:

`extension/src/background/dapp/decide.ts`:

````diff
diff --git a/extension/src/background/dapp/decide.ts b/extension/src/background/dapp/decide.ts
index 6026110..56dbd26 100644
--- a/extension/src/background/dapp/decide.ts
+++ b/extension/src/background/dapp/decide.ts
@@ -16,6 +16,8 @@ import {base64} from '@scure/base';
 import {checkMessage, checkSiws, finishSign, homoglyphRanges, keywordIn} from './signMessage';
 import {dappDigest, finishSend, finishSignTx, isTxType, needsSimulation, reauthGate, runSimulation, txDetail, txRefused, type TxDetail, type TxRefusal} from './signTx';
 import {consumeChallenge} from '../reauthChallenges';
+import {OVERRIDE_WORDS} from './redFlags';
+import {MAX_BATCH} from './txRequest';
 
 /**
  * The approval window's two messages (spec §1.4, §2.3, C13, C17): `dapp.pending` — what the window shows — and
@@ -180,18 +182,43 @@ export interface DecideRequest {
   scope: Grant['scope'] | null;
   /** B1c-2: a transaction request's approval names the simulation the window showed (C13). */
   simulation: string | null;
+  /**
+   * B1c-3 (the override rule): the words typed, one per blocked (transaction, kind) — `tx` the transaction's index in
+   * the batch. Never trusted: txRefused compares them with the words the stored simulation's flags give.
+   */
+  overrides: {tx: number; word: string}[];
 }
 
 const DECISIONS: readonly string[] = ['approve', 'reject', 'report', 'block'];
+/** One word per (transaction, block kind), at most: four kinds of block over a five-transaction batch. */
+export const MAX_OVERRIDES = MAX_BATCH * Object.keys(OVERRIDE_WORDS).length;
+/** No override word is near this long (the longest is UNCHECKED / UNLIMITED); a longer string is not a typed word. */
+const MAX_WORD = 32;
 
-/** dapp.decide's shape: a request id, a decision, and — for an approval — the account (and a connect's scope). */
+/** The overrides' exact shape — absent is none; anything else than at most MAX_OVERRIDES `{tx, word}` is null (malformed). */
+function overridesOf(x: unknown): {tx: number; word: string}[] | null {
+  if (x === undefined) return [];
+  if (!Array.isArray(x) || x.length > MAX_OVERRIDES) return null;
+  const out: {tx: number; word: string}[] = [];
+  for (const v of x as unknown[]) {
+    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
+    const {tx, word, ...rest} = v as Record<string, unknown>;
+    if (Object.keys(rest).length > 0 || typeof tx !== 'number' || !Number.isSafeInteger(tx) || tx < 0 || tx >= MAX_BATCH || typeof word !== 'string' || word.length > MAX_WORD) return null;
+    out.push({tx, word});
+  }
+  return out;
+}
+
+/** dapp.decide's shape: a request id, a decision, and — for an approval — the account (and a connect's scope, a transaction's simulation and overrides). */
 export function decideRequestOf(msg: Record<string, unknown>): DecideRequest | null {
   const {requestId, decision, account, scope, simulation} = msg;
   if (typeof requestId !== 'string' || typeof decision !== 'string' || !DECISIONS.includes(decision)) return null;
   if (account !== undefined && typeof account !== 'string') return null;
   if (scope !== undefined && scope !== 'session' && scope !== 'persistent') return null;
   if (simulation !== undefined && typeof simulation !== 'string') return null;
-  return {requestId, decision: decision as Decision, account: account ?? null, scope: scope ?? null, simulation: simulation ?? null};
+  const overrides = overridesOf(msg.overrides);
+  if (overrides === null) return null;
+  return {requestId, decision: decision as Decision, account: account ?? null, scope: scope ?? null, simulation: simulation ?? null, overrides};
 }
 
 /** Blocking a host (§2.6): every grant of that host (both scopes, every port and scheme) revoked, its queued requests rejected. */
@@ -302,7 +329,7 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
       const head = headRefused(tx, e);
       if (head !== null) return head;
       if (e === undefined || !isTxType(e.type)) return 'other';
-      return approvalRefused(tx, e, d) ?? txRefused(e, d.simulation, tx.now) ?? structuredClone(e);
+      return approvalRefused(tx, e, d) ?? txRefused(e, d.simulation, d.overrides, tx.now) ?? structuredClone(e);
     });
     if (typeof pre === 'string' && pre !== 'other') return {ok: false, error: pre};
     if (typeof pre === 'object') {
@@ -329,7 +356,8 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
       blockHost(tx, fx, e.host);
       return 'done';
     }
-    const refused = approvalRefused(tx, e, d) ?? (isTxType(e.type) ? txRefused(e, d.simulation, tx.now) : null);
+    // B1c-3: the words again, against the entry as this section reads it (a block stored since the pre-section counts).
+    const refused = approvalRefused(tx, e, d) ?? (isTxType(e.type) ? txRefused(e, d.simulation, d.overrides, tx.now) : null);
     if (refused !== null) return refused;
     // Fix round 1 item 1: fail closed even when the peek above missed this entry (the pre-section and the gate never
     // ran, so `proof` is still null here) — a simulation that names reasons may proceed only with a proof bound to
````

`txRefused` gains the words; `txDetail` the window's flags; `dappAbout` the challenge's; `reauthGate` compares them:

`extension/src/background/dapp/signTx.ts`:

````diff
diff --git a/extension/src/background/dapp/signTx.ts b/extension/src/background/dapp/signTx.ts
index bcac35b..ed5150b 100644
--- a/extension/src/background/dapp/signTx.ts
+++ b/extension/src/background/dapp/signTx.ts
@@ -6,7 +6,7 @@ import {digestOf} from '../digest';
 import {getSession} from '../session';
 import {readSettings} from '../settings';
 import {recipientFacts} from '../knownRecipients';
-import {MAX_DAPP_OUTGOING, challengeInfo, challengeSatisfied, dropChallenge, issueChallenge, type ChallengeAbout, type DappOutgoing} from '../reauthChallenges';
+import {FLAG_ROW, MAX_DAPP_OUTGOING, challengeInfo, challengeSatisfied, dropChallenge, issueChallenge, type ChallengeAbout, type DappFlag, type DappOutgoing} from '../reauthChallenges';
 import {readContacts} from '../contacts';
 import {decodeInstructions, type DecodedInstruction} from './decode/decode';
 import {resolveKeys} from './decode/keys';
@@ -19,6 +19,7 @@ import {tokenForMint, WALLET_TOKENS} from '../../../../core/solana/balances';
 import {runtimeFor} from './ports';
 import {answer, queueAccess} from './queue';
 import {feeOf, simulateTransactions, type SimState, type TxOutcome} from './simulate';
+import {overridesMatch, type RedFlag} from './redFlags';
 import {grantIn, putGrant, type Entry, type Tx} from './store';
 import {slotOf} from './txRequest';
 import type {DappReauthReason} from '../reauthPolicy';
@@ -126,8 +127,18 @@ export interface TxItemView {
   feeLamports: string | null;
   /** This transaction's simulated outcome, or null while simulating. */
   outcome: TxOutcome | null;
+  /** B1c-3: this transaction's red flags as #48 renders them (redFlags.ts's order), or null while simulating. */
+  flags: FlagView[] | null;
 }
 
+/**
+ * B1c-3: a red flag as the window sees it — the background's own, except that a dependent step names the step it
+ * depends on as `step`, 1-based as Q32 says it ("depends on step <N>"), never redFlags.ts's 0-based `on`: the window
+ * gets one convention only, the same as its outcome's `on`.
+ */
+export type FlagView = Exclude<RedFlag, {kind: 'dependent'}> | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; step: number};
+export const flagView = (f: RedFlag): FlagView => (f.kind === 'dependent' ? {kind: 'dependent', severity: 'block', word: f.word, at: null, step: f.on + 1} : f);
+
 export type SimulationView = {status: 'simulating'} | {status: 'unreachable'} | {status: 'ok'; id: string; slot: number; elapsedMs: number; at: number};
 
 /** #48's view of a transaction request (spec §3.3). */
@@ -155,6 +166,7 @@ export async function txDetail(ext: Ext, e: Entry, session: readonly {publicKey:
       unitLimit: local?.unitLimit ?? null,
       feeLamports: local !== null && p.signers[0] === e.account ? local.feeLamports.toString() : null,
       outcome: sim?.outcomes[i] ?? null,
+      flags: sim === null ? null : (sim.flags[i] ?? []).map(flagView),
     };
   });
   const simulation: SimulationView =
@@ -183,9 +195,14 @@ type DappAbout = Extract<ChallengeAbout, {kind: 'dapp'}>;
 /** What a dApp challenge is bound to: this request and its exact bytes, for this account. */
 export const dappDigest = (e: Pick<Entry, 'requestId' | 'account' | 'transactions'>): string => digestOf('dapp', {requestId: e.requestId, account: e.account, transactions: e.transactions});
 
-/** The decision's checks for a transaction request (§2.3's table, extended by §3.3): null when approvable. */
-export type TxRefusal = 'not-simulated' | 'stale' | 'out-of-date' | 'simulation-failed' | 'blockhash-expired';
-export function txRefused(e: Entry, simulation: string | null, now: number): TxRefusal | null {
+/**
+ * The decision's checks for a transaction request (§2.3's table, extended by §3.3): null when approvable. B1c-3 (the
+ * override rule): after every B1c-2 row, the typed words against the flags THIS stored simulation carries (C13: the
+ * background recomputes them; the window's are only compared) — `override-mismatch` for any word not expected or given
+ * twice, `override-missing` for a block with no word.
+ */
+export type TxRefusal = 'not-simulated' | 'stale' | 'out-of-date' | 'simulation-failed' | 'blockhash-expired' | 'override-mismatch' | 'override-missing';
+export function txRefused(e: Entry, simulation: string | null, overrides: readonly {tx: number; word: string}[], now: number): TxRefusal | null {
   if (e.sim?.status !== 'ok') return 'not-simulated';
   const sim = e.sim.sim;
   // C13: the window names the simulation it showed; another one (a refresh landed) or an old one is not approvable.
@@ -197,7 +214,12 @@ export function txRefused(e: Entry, simulation: string | null, now: number): TxR
   if (simulation !== sim.id) return 'stale';
   if (now - sim.at >= SIM_VALID_MS) return 'out-of-date';
   if (sim.outcomes.some(o => !o.ok && o.error === 'expired')) return 'blockhash-expired';
-  if (sim.outcomes.some(o => !o.ok)) return 'simulation-failed';
+  // O2: a step that depends on an earlier one is not a failure of its own only beside its F10 flag for that same step
+  // — a block, so approvable only with UNCHECKED (below). Every other failure stays Reject-only.
+  if (sim.outcomes.some((o, i) => !o.ok && !(o.error === 'dependent' && sim.flags[i]?.some(f => f.kind === 'dependent' && f.on === o.on - 1)))) return 'simulation-failed';
+  const words = overridesMatch(sim.flags, overrides);
+  if (words === 'mismatch') return 'override-mismatch';
+  if (words === 'missing') return 'override-missing';
   return null;
 }
 
@@ -240,7 +262,17 @@ export function dappAbout(e: Entry, site: string, thresholdCents: number): Extra
     const symbol = candidate !== null && v.decimals === WALLET_TOKENS[candidate].decimals ? candidate : null;
     return {mint, symbol, amount: v.amount.toString(), decimals: v.decimals};
   });
-  return {kind: 'dapp', account: e.account, site, transactions: e.transactions.length, outgoing, omitted: all.length - outgoing.length, reasons: e.sim.sim.reasons.slice(), thresholdCents};
+  // B1c-3: the flags, one per (transaction, row) — what #10 names (a block's word, a dependent step's step) and what
+  // a refresh is compared on; several Token-2022 mints of one transaction are one entry.
+  const flags: DappFlag[] = [];
+  e.sim.sim.flags.forEach((list, tx) => {
+    for (const f of list) {
+      const row = FLAG_ROW[f.kind];
+      if (flags.some(x => x.tx === tx && x.row === row)) continue;
+      flags.push({tx, row, word: f.severity === 'block' ? f.word : null, step: f.kind === 'dependent' ? f.on + 1 : null});
+    }
+  });
+  return {kind: 'dapp', account: e.account, site, transactions: e.transactions.length, outgoing, omitted: all.length - outgoing.length, reasons: e.sim.sim.reasons.slice(), thresholdCents, flags};
 }
 
 /** Whether every reason the fresh simulation gives was already named in the challenge issued for it. */
@@ -249,6 +281,17 @@ function reasonsCovered(fresh: readonly DappReauthReason[], issued: readonly Dap
   return fresh.every(r => have.has(r));
 }
 
+/**
+ * B1c-3: whether every flag of the fresh simulation — its transaction, row, word and step — was already named in the
+ * challenge issued for it (#10 described those); a refresh that adds a block, or a warning, or moves one to another
+ * transaction or step, is not covered.
+ */
+function flagsCovered(fresh: readonly DappFlag[], issued: readonly DappFlag[]): boolean {
+  const key = (f: DappFlag): string => JSON.stringify([f.tx, f.row, f.word, f.step]);
+  const have = new Set(issued.map(key));
+  return fresh.every(f => have.has(key(f)));
+}
+
 /**
  * Whether any mint's fresh outgoing amount exceeds what the issued challenge described — a mint absent from the
  * issued list (new since the challenge was issued) counts as having had 0 — or more mints are cut from the list than
@@ -271,7 +314,8 @@ export function outgoingGrew(fresh: Pick<DappAbout, 'outgoing' | 'omitted'>, iss
  * Fix round 1 item 3: a live, even proven, challenge is frozen from the simulation that issued it (#10 described that
  * one) — a 30 s refresh that grows an outgoing amount, or adds a reason, makes that description stale: it no longer
  * speaks for what Approve is about to sign. Re-issued (a new id) whenever the fresh simulation's reasons are not all
- * already named, or any mint's outgoing amount grew past what was described. Fix round 1 item 1: the superseded id is
+ * already named, or any mint's outgoing amount grew past what was described, or (B1c-3) it has a flag the issued
+ * challenge did not name. Fix round 1 item 1: the superseded id is
  * then DELETED (dropChallenge, by id — never dropChallengesFor by digest, since the new one is issued for the same
  * digest and a digest-keyed drop could not tell the two apart), so a #10 tab already open on it reads back
  * `unknown-challenge` (dappExpired) instead of still showing "Confirmed" for a description Approve no longer honors.
@@ -283,7 +327,7 @@ export async function reauthGate(ext: Ext, deps: Pick<WalletDeps, 'now' | 'rando
   const current = e.challengeId !== null ? await challengeInfo(ext, now, e.challengeId) : null;
   const fresh = dappAbout(e, site, (await readSettings(ext)).reauthUsdCents);
   if (fresh === null) return 'stale';
-  const stillCovers = current !== null && current.kind === 'dapp' && reasonsCovered(fresh.reasons, current.reasons) && !outgoingGrew(fresh, current);
+  const stillCovers = current !== null && current.kind === 'dapp' && reasonsCovered(fresh.reasons, current.reasons) && !outgoingGrew(fresh, current) && flagsCovered(fresh.flags, current.flags);
   if (!stillCovers) {
     const id = await issueChallenge(ext, deps, digest, fresh);
     const superseded = e.challengeId;
````

The challenge store's flags. A flag is named by its row of the red-flag table (F1–F10), not by redFlags.ts's kind string: the vault page's sources may not contain the word `assign` at all (`scripts/check-vault-isolation.mjs` refuses it with `Reflect`, `defineProperty`, … — "the names themselves are refused"), and #10 needs no other name than the spec's own row number:

`extension/src/background/reauthChallenges.ts`:

````diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
index d1b95f5..d2937d3 100644
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -6,6 +6,7 @@ import type {DappReauthReason, SendReauthReason} from './reauthPolicy';
 import type {FeeReason} from '../../../core/fees/transferMarkup';
 import {WALLET_TOKENS} from '../../../core/solana/balances';
 import {SITE} from '../shared/site';
+import {OVERRIDE_WORDS, type RedFlagKind} from './dapp/redFlags';
 
 /** How long the vault page has to prove the factor (brief decision 6), counted from the last prepare of the same intent. */
 export const CHALLENGE_TTL_MS = 120_000;
@@ -47,8 +48,10 @@ export type ChallengeAbout =
    * and why. Bound to the request and its exact bytes (signTx.ts dappDigest). #10 describes it; the approval window
    * signs only once the challenge is proven and consumed. `outgoing` holds at most MAX_DAPP_OUTGOING mints (SOL first,
    * then the largest in USD); `omitted` counts the mints left out (plan 2 review 1 L9: a long list is cut, never refused).
+   * B1c-3: `flags` — the red flags of every transaction, one per (transaction, row), so #10 names what is overridden
+   * and a refresh that adds one asks again (signTx.ts reauthGate).
    */
-  | {kind: 'dapp'; account: string; site: string; transactions: number; outgoing: DappOutgoing[]; omitted: number; reasons: DappReauthReason[]; thresholdCents: number};
+  | {kind: 'dapp'; account: string; site: string; transactions: number; outgoing: DappOutgoing[]; omitted: number; reasons: DappReauthReason[]; thresholdCents: number; flags: DappFlag[]};
 
 export interface DappOutgoing {
   mint: string | null;
@@ -58,6 +61,33 @@ export interface DappOutgoing {
   decimals: number | null;
 }
 
+/**
+ * B1c-3 (spec §3.3 rev 3.6): one red flag of a dApp challenge — `tx` the transaction's index in the batch (0-based, as
+ * the decision's overrides name it), its row of the red-flag table (F1–F10, the spec's own numbers: #10 needs no other
+ * name for it), the typed word for a block (null for a warning), and for a dependent step the step it depends on
+ * (`step`, 1-based, as the copy says it; null for every other row).
+ */
+export type FlagRow = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9' | 'F10';
+export interface DappFlag {
+  tx: number;
+  row: FlagRow;
+  word: string | null;
+  step: number | null;
+}
+/** Each red flag's row of the table (spec §3.3; F11, the origin mismatch, never reaches a challenge). */
+export const FLAG_ROW: Record<RedFlagKind, FlagRow> = {
+  'unknown-program': 'F1',
+  'non-transfer': 'F2',
+  assign: 'F3',
+  'set-authority': 'F4',
+  'unlimited-approve': 'F5',
+  'bounded-approve': 'F6',
+  'token-2022': 'F7',
+  'durable-nonce': 'F8',
+  'whole-balance': 'F9',
+  dependent: 'F10',
+};
+
 /** The fields a re-prepare of the same intent may refresh; the identity fields (account, token, recipient, amount) never change. */
 export type SendAboutRefresh = Pick<
   Extract<ChallengeAbout, {kind: 'send'}>,
@@ -80,6 +110,23 @@ const FEE_REASONS: readonly string[] = ['pre-tge', 'zero-fee-eligible', 'status-
 const DAPP_REASONS: readonly string[] = [...REASONS, 'approval', 'override'];
 /** At most this many mints in a dApp challenge's description (more than a five-transaction batch can name sensibly; the rest are counted in `omitted`). */
 export const MAX_DAPP_OUTGOING = 16;
+/** At most one flag per (transaction, row): ten rows over a five-transaction batch. */
+export const MAX_DAPP_FLAGS = 50;
+/** Each row's override word (a block), or null (a warning) — F5's is checked against its own list. */
+const ROW_WORDS: Record<FlagRow, string | null> = {
+  F1: null,
+  F2: null,
+  F3: OVERRIDE_WORDS.assign,
+  F4: OVERRIDE_WORDS.setAuthority,
+  F5: OVERRIDE_WORDS.unlimited,
+  F6: null,
+  F7: null,
+  F8: null,
+  F9: null,
+  F10: OVERRIDE_WORDS.dependent,
+};
+/** F5's word: the wallet's own symbol for a token it names (never SOL — an approve is of a token account), else UNLIMITED. */
+const UNLIMITED_WORDS: readonly string[] = ['NOC', 'USDC', 'USDT', OVERRIDE_WORDS.unlimited];
 const DIGITS = /^\d{1,20}$/;
 /** A base58 Solana address's shape (32–44 characters). */
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
@@ -112,7 +159,8 @@ function isAbout(x: unknown): x is ChallengeAbout {
       new Set(reasons).size === reasons.length &&
       (reasons as unknown[]).every(r => typeof r === 'string' && DAPP_REASONS.includes(r)) &&
       isInt(a.thresholdCents) &&
-      Object.keys(a).length === 8
+      isDappFlags(a.flags, a.transactions, reasons as unknown[]) &&
+      Object.keys(a).length === 9
     );
   }
   if (a.kind !== 'send') return false;
@@ -161,6 +209,31 @@ function isOutgoing(x: unknown): x is DappOutgoing {
   );
 }
 
+/**
+ * B1c-3: a dApp challenge's flags, exactly as signTx.ts dappAbout builds them — each row known, on a transaction of the
+ * batch, a block with its own word and a warning with none, a dependent step naming an earlier one, one per
+ * (transaction, row); and a block present exactly when the reasons name `override` (simulate.ts adds it for one).
+ */
+function isDappFlags(x: unknown, transactions: number, reasons: readonly unknown[]): x is DappFlag[] {
+  if (!Array.isArray(x) || x.length > MAX_DAPP_FLAGS) return false;
+  const seen = new Set<string>();
+  let blocks = 0;
+  for (const v of x as unknown[]) {
+    if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
+    const f = v as Record<string, unknown>;
+    if (Object.keys(f).length !== 4 || !isInt(f.tx) || f.tx < 0 || f.tx >= transactions || typeof f.row !== 'string' || !Object.hasOwn(ROW_WORDS, f.row)) return false;
+    const row = f.row as FlagRow;
+    const word = ROW_WORDS[row];
+    if (word === null ? f.word !== null : row === 'F5' ? typeof f.word !== 'string' || !UNLIMITED_WORDS.includes(f.word) : f.word !== word) return false;
+    if (row === 'F10' ? !isInt(f.step) || f.step < 1 || f.step > f.tx : f.step !== null) return false;
+    const key = `${f.tx}:${row}`;
+    if (seen.has(key)) return false;
+    seen.add(key);
+    if (word !== null) blocks++;
+  }
+  return (blocks > 0) === reasons.includes('override');
+}
+
 function isChallenge(x: unknown): x is Challenge {
   if (typeof x !== 'object' || x === null) return false;
   const c = x as Record<string, unknown>;
````

#10 — the rows, re-validated on the vault page's own side:

`extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 9bd5be6..90a5680 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -432,6 +432,20 @@ export const REAUTH = {
   approval: 'Re-auth required to approve a token allowance.',
   /** B1c-3 Q33 (spec §3.3 rev 3.6) — controller copy, flagged to the owner: a request with a block re-authenticates. */
   override: 'Re-auth required to override a blocked transaction.',
+  /**
+   * B1c-3 Q37–Q40 — controller copy, flagged to the owner (spec §3.3 rev 3.6: "#10's description names what is
+   * overridden"): one row per block, by its row of the red-flag table. Q37 (F3) and Q38 (F4) are B1 §3's own rows;
+   * Q39 (F5) the design's F5 head ("Unlimited <SYM> spend approval", #48 state 2), "token" when the wallet's table
+   * names no symbol; Q40 (F10) is Q32 shortened to a row.
+   */
+  overridden: {
+    F3: 'Assign / Allocate on your wallet account',
+    F4: 'SetAuthority on an account you own',
+    F5: (symbol: string | null): string => `Unlimited ${symbol ?? 'token'} spend approval`,
+    F10: (step: number): string => `Depends on step ${step} — not checked on its own`,
+  },
+  /** #48's batch label (owner copy, approve/strings.ts batchItem): which transaction of a batch a row is on. */
+  transactionOf: (k: number, n: number): string => `Transaction ${k} of ${n}`,
   dappConfirmed: 'Confirmed. Go back to the approval window and approve the transaction.',
   dappExpired: 'This confirmation has expired. Approve the transaction again in the approval window.',
   dappNotUnlocked: "The wallet locked while you were confirming. The site's request was declined — ask the site to try again.",
````

`extension/src/unlock/challenge.ts`:

````diff
diff --git a/extension/src/unlock/challenge.ts b/extension/src/unlock/challenge.ts
index 29c629b..b860965 100644
--- a/extension/src/unlock/challenge.ts
+++ b/extension/src/unlock/challenge.ts
@@ -19,7 +19,16 @@ export type TokenSymbol = keyof typeof TOKENS;
 const DIGITS = /^\d{1,20}$/;
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const SEND_KEYS = ['account', 'amount', 'kind', 'markupLamports', 'markupReason', 'networkLamports', 'priorityLamports', 'reasons', 'recipient', 'rentLamports', 'thresholdCents', 'token'];
-const DAPP_KEYS = ['account', 'kind', 'omitted', 'outgoing', 'reasons', 'site', 'thresholdCents', 'transactions'];
+const DAPP_KEYS = ['account', 'flags', 'kind', 'omitted', 'outgoing', 'reasons', 'site', 'thresholdCents', 'transactions'];
+const FLAG_KEYS = ['row', 'step', 'tx', 'word'];
+/**
+ * B1c-3: each row of the red-flag table (spec §3.3, F1–F10) and its override word (a block) or null (a warning) — this
+ * page's own copy of the background's table (reauthChallenges.ts); F5's word is the wallet's own symbol for the token,
+ * or UNLIMITED.
+ */
+const ROW_WORDS: Record<string, string | null> = {F1: null, F2: null, F3: 'ASSIGN', F4: 'AUTHORITY', F5: 'UNLIMITED', F6: null, F7: null, F8: null, F9: null, F10: 'UNCHECKED'};
+const UNLIMITED_WORDS: readonly string[] = ['NOC', 'USDC', 'USDT', 'UNLIMITED'];
+const MAX_FLAGS = 50;
 const OUTGOING_KEYS = ['amount', 'decimals', 'mint', 'symbol'];
 const SETTINGS_KEYS = ['autoLockMinutes', 'kind', 'reauthUsdCents'];
 const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
@@ -53,6 +62,8 @@ export interface DappDescription {
   /** How many more tokens leave the account than the rows show (plan 2 review 1 L9: the background lists at most 16). */
   omitted: number;
   reasons: string[];
+  /** B1c-3: one row per block — what is overridden and, in a batch, on which transaction ("Transaction 2 of 3"). */
+  overrides: {label: string; transaction: string | null}[];
 }
 export type Description = SendDescription | SettingsDescription | DappDescription;
 
@@ -167,7 +178,34 @@ function describeDapp(a: Record<string, unknown>): DappDescription | null {
     if (line === null) return null;
     lines.push(line);
   }
-  return {kind: 'dapp', site, transactions, outgoing: rows, omitted, reasons: lines};
+  const overrides = overridesOf(a.flags, transactions, reasons as unknown[]);
+  if (overrides === null) return null;
+  return {kind: 'dapp', site, transactions, outgoing: rows, omitted, reasons: lines, overrides};
+}
+
+/**
+ * B1c-3: the rows for what is overridden, from the challenge's flags — each re-validated as the background issues it
+ * (a known row on a transaction of the batch, a block with its own word and a warning with none, a dependent step
+ * naming an earlier one, one per (transaction, row), a block exactly when a reason is `override`); null for anything
+ * else. A warning is no row: #10 names what the typed words override.
+ */
+function overridesOf(flags: unknown, transactions: number, reasons: readonly unknown[]): DappDescription['overrides'] | null {
+  if (!Array.isArray(flags) || flags.length > MAX_FLAGS) return null;
+  const seen = new Set<string>();
+  const rows: DappDescription['overrides'] = [];
+  for (const x of flags as unknown[]) {
+    if (typeof x !== 'object' || x === null || Array.isArray(x) || !hasExactly(x as Record<string, unknown>, FLAG_KEYS)) return null;
+    const {row, tx, word, step} = x as Record<string, unknown>;
+    if (typeof row !== 'string' || !own(ROW_WORDS, row) || !isInt(tx, 0, transactions - 1) || seen.has(`${tx}:${row}`)) return null;
+    seen.add(`${tx}:${row}`);
+    const expected = ROW_WORDS[row] ?? null;
+    if (expected === null ? word !== null : row === 'F5' ? typeof word !== 'string' || !UNLIMITED_WORDS.includes(word) : word !== expected) return null;
+    if (row === 'F10' ? !isInt(step, 1, tx) : step !== null) return null;
+    if (expected === null) continue;
+    const label = row === 'F3' ? REAUTH.overridden.F3 : row === 'F4' ? REAUTH.overridden.F4 : row === 'F10' ? REAUTH.overridden.F10(step as number) : REAUTH.overridden.F5(word === 'UNLIMITED' ? null : (word as string));
+    rows.push({label, transaction: transactions > 1 ? REAUTH.transactionOf(tx + 1, transactions) : null});
+  }
+  return (rows.length > 0) === reasons.includes('override') ? rows : null;
 }
 
 /** The closed-alphabet renderer: a description built only from fixed strings and validated values, or null. */
````

`extension/src/unlock/screens/reauth.ts`:

````diff
diff --git a/extension/src/unlock/screens/reauth.ts b/extension/src/unlock/screens/reauth.ts
index 9ad4ee1..8ffcf12 100644
--- a/extension/src/unlock/screens/reauth.ts
+++ b/extension/src/unlock/screens/reauth.ts
@@ -181,6 +181,8 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
       }
       // Review 1 L9: past the sixteen rows the background lists, the count of the rest.
       if (d.omitted > 0) rows.push(row(REAUTH.omitted(d.omitted), null));
+      // B1c-3: what the typed words override, one row per block — on which transaction, in a batch.
+      for (const o of d.overrides) rows.push(row(o.label, o.transaction));
       byId('ra-rows').replaceChildren(...rows);
       byId('ra-reasons').replaceChildren(...d.reasons.map(r => h('p', 'noc-body-sm vlt-lede', r)));
       setText(cancel, REAUTH.cancel);
````

The window: the flags, read exactly; a detail it cannot read is none:

`extension/src/approve/client.ts`:

````diff
diff --git a/extension/src/approve/client.ts b/extension/src/approve/client.ts
index 0335fab..87ba836 100644
--- a/extension/src/approve/client.ts
+++ b/extension/src/approve/client.ts
@@ -77,6 +77,58 @@ export type TxOutcome =
   | {ok: false; error: 'expired' | 'failed'; detail: string}
   /** B1c-3 (F10): it depends on step `on` (1-based) of the same batch. */
   | {ok: false; error: 'dependent'; on: number; detail: string};
+/**
+ * B1c-3 (spec §3.3 rev 3.6): the red flags as the background computed them (redFlags.ts) — the window renders them and
+ * computes none (C13). `at`: the first instruction a flag concerns (0-based), null for chain state and the whole
+ * transaction. A dependent step names the step it depends on as `step`, 1-based — read it with `dependsOnStep`.
+ */
+export type FlagSymbol = 'NOC' | 'USDC' | 'USDT';
+export interface FlaggedInstruction {
+  index: number;
+  program: ProgramKey;
+  name: string | null;
+}
+export interface AuthorityInstruction {
+  index: number;
+  program: 'token' | 'token-2022';
+  account: string;
+  owned: 'token-account' | 'mint' | 'current-authority';
+  authorityType: string;
+  newAuthority: string | null;
+}
+export interface AuthorityChange {
+  account: string;
+  change: 'owner' | 'close-authority' | 'mint-authority' | 'freeze-authority';
+  from: string | null;
+  to: string | null;
+}
+export interface Approval {
+  at: number | null;
+  source: string;
+  mint: string | null;
+  symbol: FlagSymbol | null;
+  decimals: number | null;
+  delegate: string | null;
+  amount: string;
+  balance: string;
+}
+export interface Token2022Settings {
+  freezeAuthority: string | null;
+  permanentDelegate: string | null;
+  transferHookProgram: string | null;
+}
+export type Flag =
+  | {kind: 'unknown-program'; severity: 'warn'; word: null; at: number; programs: (string | null)[]}
+  | {kind: 'non-transfer'; severity: 'warn'; word: null; at: number; instructions: FlaggedInstruction[]}
+  | {kind: 'assign'; severity: 'block'; word: 'ASSIGN'; at: number | null; instructions: FlaggedInstruction[]; chain: {owner: string; space: number} | null}
+  | {kind: 'set-authority'; severity: 'block'; word: 'AUTHORITY'; at: number | null; instructions: AuthorityInstruction[]; chain: AuthorityChange[]}
+  | {kind: 'unlimited-approve'; severity: 'block'; word: FlagSymbol | 'UNLIMITED'; at: number | null; approvals: Approval[]}
+  | {kind: 'bounded-approve'; severity: 'warn'; word: null; at: number | null; approvals: Approval[]}
+  /** settings null: the mint could not be read (Q36). */
+  | {kind: 'token-2022'; severity: 'warn'; word: null; at: number | null; mint: string; settings: Token2022Settings | null}
+  | {kind: 'durable-nonce'; severity: 'warn'; word: null; at: 0}
+  | {kind: 'whole-balance'; severity: 'warn'; word: null; at: null}
+  | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; step: number};
 export interface TxItem {
   version: 'legacy' | 0;
   feePayer: string;
@@ -85,7 +137,12 @@ export interface TxItem {
   unitLimit: number | null;
   feeLamports: string | null;
   outcome: TxOutcome | null;
+  /** B1c-3: this transaction's red flags, blocks first (null while simulating, as `outcome`). */
+  flags: Flag[] | null;
 }
+
+/** B1c-3 (Q32): the step (1-based, as the copy says it) this transaction depends on, or null — the one way the window reads it. */
+export const dependsOnStep = (t: TxItem): number | null => t.flags?.find(f => f.kind === 'dependent')?.step ?? null;
 export type SimulationView = {status: 'simulating'} | {status: 'unreachable'} | {status: 'ok'; id: string; slot: number; elapsedMs: number; at: number};
 export interface AddressLabel {
   address: string;
@@ -113,7 +170,10 @@ export interface RequestView {
   mismatch: {granted: string} | null;
 }
 export type PendingView = {state: 'none'} | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};
-export type Decision = {decision: 'reject' | 'report' | 'block'} | {decision: 'approve'; account: string; scope?: 'session' | 'persistent'; simulation?: string};
+/** B1c-3: an approval's `overrides` — the typed word of each blocked (transaction, kind), `tx` the 0-based index in the batch. */
+export type Decision =
+  | {decision: 'reject' | 'report' | 'block'}
+  | {decision: 'approve'; account: string; scope?: 'session' | 'persistent'; simulation?: string; overrides?: {tx: number; word: string}[]};
 export type DecideReply = {ok: true} | {ok: false; error: string};
 
 type J = Record<string, unknown>;
@@ -217,6 +277,125 @@ function outcomeOf(x: unknown): TxOutcome | undefined {
   return {ok: true, changes: changes as BalanceChange[], unitsConsumed: o.unitsConsumed, unitLimit: o.unitLimit, feeLamports: o.feeLamports};
 }
 
+const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
+const AMOUNT = /^\d{1,20}$/;
+const SYMBOLS: readonly string[] = ['NOC', 'USDC', 'USDT'];
+const isAddress = (x: unknown): x is string => isStr(x) && ADDRESS.test(x);
+const isAddressOrNull = (x: unknown): x is string | null => x === null || isAddress(x);
+const isIntOrNull = (x: unknown): x is number | null => x === null || isInt(x);
+/** `x` with exactly these keys, or undefined. */
+const exactly = (x: unknown, keys: readonly string[]): J | undefined => {
+  const o = obj(x);
+  return o !== undefined && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k)) ? o : undefined;
+};
+/** Every item read by `f`, or undefined when any is not (or `x` is no list; `nonEmpty`: an empty one). */
+function listOf<T>(x: unknown, f: (v: unknown) => T | undefined, nonEmpty = false): T[] | undefined {
+  if (!Array.isArray(x) || (nonEmpty && x.length === 0)) return undefined;
+  const out: T[] = [];
+  for (const v of x as unknown[]) {
+    const r = f(v);
+    if (r === undefined) return undefined;
+    out.push(r);
+  }
+  return out;
+}
+
+function flaggedOf(x: unknown): FlaggedInstruction | undefined {
+  const o = exactly(x, ['index', 'program', 'name']);
+  return o !== undefined && isInt(o.index) && isStr(o.program) && PROGRAM_KEYS.includes(o.program) && (o.name === null || isStr(o.name)) ? {index: o.index, program: o.program as ProgramKey, name: o.name} : undefined;
+}
+
+function authorityOf(x: unknown): AuthorityInstruction | undefined {
+  const o = exactly(x, ['index', 'program', 'account', 'owned', 'authorityType', 'newAuthority']);
+  if (o === undefined || !isInt(o.index) || (o.program !== 'token' && o.program !== 'token-2022') || !isAddress(o.account) || !isStr(o.authorityType) || !isAddressOrNull(o.newAuthority)) return undefined;
+  if (o.owned !== 'token-account' && o.owned !== 'mint' && o.owned !== 'current-authority') return undefined;
+  return {index: o.index, program: o.program, account: o.account, owned: o.owned, authorityType: o.authorityType, newAuthority: o.newAuthority};
+}
+
+function authorityChangeOf(x: unknown): AuthorityChange | undefined {
+  const o = exactly(x, ['account', 'change', 'from', 'to']);
+  if (o === undefined || !isAddress(o.account) || !isAddressOrNull(o.from) || !isAddressOrNull(o.to)) return undefined;
+  if (o.change !== 'owner' && o.change !== 'close-authority' && o.change !== 'mint-authority' && o.change !== 'freeze-authority') return undefined;
+  return {account: o.account, change: o.change, from: o.from, to: o.to};
+}
+
+function approvalOf(x: unknown): Approval | undefined {
+  const o = exactly(x, ['at', 'source', 'mint', 'symbol', 'decimals', 'delegate', 'amount', 'balance']);
+  if (o === undefined || !isIntOrNull(o.at) || !isAddress(o.source) || !isAddressOrNull(o.mint) || !isAddressOrNull(o.delegate) || !(o.decimals === null || (isInt(o.decimals) && o.decimals <= 255))) return undefined;
+  if (!isStr(o.amount) || !AMOUNT.test(o.amount) || !isStr(o.balance) || !AMOUNT.test(o.balance) || !(o.symbol === null || (isStr(o.symbol) && SYMBOLS.includes(o.symbol)))) return undefined;
+  return {at: o.at, source: o.source, mint: o.mint, symbol: o.symbol as FlagSymbol | null, decimals: o.decimals, delegate: o.delegate, amount: o.amount, balance: o.balance};
+}
+
+function settingsOf(x: unknown): Token2022Settings | undefined {
+  const o = exactly(x, ['freezeAuthority', 'permanentDelegate', 'transferHookProgram']);
+  return o !== undefined && isAddressOrNull(o.freezeAuthority) && isAddressOrNull(o.permanentDelegate) && isAddressOrNull(o.transferHookProgram)
+    ? {freezeAuthority: o.freezeAuthority, permanentDelegate: o.permanentDelegate, transferHookProgram: o.transferHookProgram}
+    : undefined;
+}
+
+/** One flag, read exactly: its kind known, its keys exactly that kind's, its severity and word that kind's — else undefined. */
+function flagOf(x: unknown): Flag | undefined {
+  const kind = obj(x)?.kind;
+  const warn = (o: J | undefined): o is J => o !== undefined && o.severity === 'warn' && o.word === null;
+  switch (kind) {
+    case 'unknown-program': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'programs']);
+      const programs = listOf(o?.programs, v => (isAddressOrNull(v) ? {v} : undefined), true);
+      return warn(o) && isInt(o.at) && programs !== undefined ? {kind, severity: 'warn', word: null, at: o.at, programs: programs.map(p => p.v)} : undefined;
+    }
+    case 'non-transfer': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions']);
+      const instructions = listOf(o?.instructions, flaggedOf, true);
+      return warn(o) && isInt(o.at) && instructions !== undefined ? {kind, severity: 'warn', word: null, at: o.at, instructions} : undefined;
+    }
+    case 'assign': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions', 'chain']);
+      const instructions = listOf(o?.instructions, flaggedOf);
+      const chain = nullOr(o?.chain, v => {
+        const c = exactly(v, ['owner', 'space']);
+        return c !== undefined && isAddress(c.owner) && isInt(c.space) ? {owner: c.owner, space: c.space} : undefined;
+      });
+      if (o === undefined || o.severity !== 'block' || o.word !== 'ASSIGN' || !isIntOrNull(o.at) || instructions === undefined || chain === undefined) return undefined;
+      return {kind, severity: 'block', word: 'ASSIGN', at: o.at, instructions, chain};
+    }
+    case 'set-authority': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions', 'chain']);
+      const instructions = listOf(o?.instructions, authorityOf);
+      const chain = listOf(o?.chain, authorityChangeOf);
+      if (o === undefined || o.severity !== 'block' || o.word !== 'AUTHORITY' || !isIntOrNull(o.at) || instructions === undefined || chain === undefined) return undefined;
+      return {kind, severity: 'block', word: 'AUTHORITY', at: o.at, instructions, chain};
+    }
+    case 'unlimited-approve':
+    case 'bounded-approve': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'approvals']);
+      const approvals = listOf(o?.approvals, approvalOf, true);
+      if (o === undefined || !isIntOrNull(o.at) || approvals === undefined) return undefined;
+      if (kind === 'bounded-approve') return warn(o) ? {kind, severity: 'warn', word: null, at: o.at, approvals} : undefined;
+      const word = o.word;
+      return o.severity === 'block' && isStr(word) && (word === 'UNLIMITED' || SYMBOLS.includes(word)) ? {kind, severity: 'block', word: word as FlagSymbol | 'UNLIMITED', at: o.at, approvals} : undefined;
+    }
+    case 'token-2022': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'mint', 'settings']);
+      const settings = nullOr(o?.settings, settingsOf);
+      return warn(o) && isIntOrNull(o.at) && isAddress(o.mint) && settings !== undefined ? {kind, severity: 'warn', word: null, at: o.at, mint: o.mint, settings} : undefined;
+    }
+    case 'durable-nonce': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at']);
+      return warn(o) && o.at === 0 ? {kind, severity: 'warn', word: null, at: 0} : undefined;
+    }
+    case 'whole-balance': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at']);
+      return warn(o) && o.at === null ? {kind, severity: 'warn', word: null, at: null} : undefined;
+    }
+    case 'dependent': {
+      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'step']);
+      return o !== undefined && o.severity === 'block' && o.word === 'UNCHECKED' && o.at === null && isInt(o.step) && o.step >= 1 ? {kind, severity: 'block', word: 'UNCHECKED', at: null, step: o.step} : undefined;
+    }
+    default:
+      return undefined;
+  }
+}
+
 function txItemOf(x: unknown): TxItem | undefined {
   const o = obj(x);
   if (o === undefined || (o.version !== 'legacy' && o.version !== 0) || !isStr(o.feePayer)) return undefined;
@@ -230,8 +409,14 @@ function txItemOf(x: unknown): TxItem | undefined {
   if (!(o.unitLimit === null || isInt(o.unitLimit))) return undefined;
   if (!(o.feeLamports === null || (isStr(o.feeLamports) && DIGITS.test(o.feeLamports)))) return undefined;
   const outcome = nullOr(o.outcome, outcomeOf);
-  if (outcome === undefined) return undefined;
-  return {version: o.version, feePayer: o.feePayer, instructions, unitLimit: o.unitLimit, feeLamports: o.feeLamports, outcome};
+  // B1c-3: the flags come with the outcome (the same simulation): both, or neither while simulating.
+  const flags = nullOr(o.flags, v => listOf(v, flagOf));
+  if (outcome === undefined || flags === undefined || (outcome === null) !== (flags === null)) return undefined;
+  // A dependent outcome stands exactly beside one F10 flag naming the same step (Q32's <N>).
+  const dependent = (flags ?? []).filter(f => f.kind === 'dependent');
+  const on = outcome !== null && !outcome.ok && outcome.error === 'dependent' ? outcome.on : null;
+  if (on === null ? dependent.length > 0 : dependent.length !== 1 || dependent[0]?.step !== on) return undefined;
+  return {version: o.version, feePayer: o.feePayer, instructions, unitLimit: o.unitLimit, feeLamports: o.feeLamports, outcome, flags};
 }
 
 function simulationOf(x: unknown): SimulationView | undefined {
@@ -251,6 +436,8 @@ function txDetailOf(x: unknown): TxDetail | undefined {
   if (o === undefined || account === undefined || simulation === undefined || (o.kind !== 'signTransaction' && o.kind !== 'signAndSendTransaction') || !Array.isArray(o.transactions) || !Array.isArray(o.labels)) return undefined;
   const transactions = (o.transactions as unknown[]).map(txItemOf);
   if (transactions.length === 0 || transactions.some(t => t === undefined)) return undefined;
+  // A step depends only on an earlier one: step <N> of transaction i (0-based) is at most i.
+  if ((transactions as TxItem[]).some((t, i) => (dependsOnStep(t) ?? 0) > i)) return undefined;
   const labels: AddressLabel[] = [];
   for (const l of o.labels as unknown[]) {
     const lo = obj(l);
@@ -274,8 +461,9 @@ function requestOf(x: unknown): RequestView | undefined {
   if (o === undefined || site === undefined || !isStr(o.requestId) || !isStr(o.type) || !TYPES.includes(o.type) || !isStr(o.origin) || !isStr(o.host) || !isBool(o.offerBlock)) return undefined;
   const connect = nullOr(o.connect, connectOf);
   const sign = nullOr(o.sign, signOf);
-  // An older background sends neither (B1c-1): read as none.
-  const tx = o.tx === undefined ? null : nullOr(o.tx, txDetailOf);
+  // An older background sends neither (B1c-1): read as none. B1c-3: a detail the window cannot read is none either —
+  // the request shows Q26 with only Reject, never a blank window and never the detail with a flag dropped.
+  const tx = o.tx === undefined || o.tx === null ? null : (txDetailOf(o.tx) ?? null);
   const mismatch = o.mismatch === undefined ? null : nullOr(o.mismatch, v => (isStr(obj(v)?.granted) ? {granted: obj(v)?.granted as string} : undefined));
   if (connect === undefined || sign === undefined || tx === undefined || mismatch === undefined) return undefined;
   return {requestId: o.requestId, type: o.type as RequestView['type'], origin: o.origin, host: o.host, site, offerBlock: o.offerBlock, connect, sign, tx, mismatch};
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: the seven files of Step 2 — expected: Test Files  7 passed (7) · Tests  214 passed (214) (overrides 14, reauthChallenges 17, challenge 40, reauthScreen 53, tx 24, signTx 30, Home 36).

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  170 passed (170) · Tests  3393 passed (3393) (Task 3's end state: 169 files, 3372 tests; +1 file, +21). `node scripts/build.mjs && npm run gates` — expected: every gate ok (permissions, page bundles, vault isolation — see Step 3's note on `assign` —, rpc methods, no TGE date, fonts, classes). Nothing touches the repository root's `src/` or `core/`.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

Every shape check of the decision's words, each new refusal, the dependent exemption and both of its conditions, the words in each of the two decide sections, `flagsCovered` and its key, `dappAbout`'s flags (warnings, the step), the window's step, the challenge store's main checks on both sides, #10's rows, and the window's strict reader are mutated once. The named test file is the one in brackets; the counts are that file's whole run.

| id | the change | named test → observed (`tsc` exit, then the named test file) |
|---|---|---|
| M4a | `decide.ts`: `if (!Array.isArray(x) \|\| x.length > MAX_OVERRIDES) return null;` → `if (!Array.isArray(x)) return null;` | “absent → none…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4b | `decide.ts`: `if (Object.keys(rest).length > 0 \|\| typeof tx` → `if (Object.keys(rest).length > 1 \|\| typeof tx` | “absent → none…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4c | `decide.ts`: ` \|\| tx >= MAX_BATCH` → (removed) | “absent → none…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4d | `decide.ts`: ` \|\| word.length > MAX_WORD` → ` \|\| word.length > MAX_WORD + 1` | “absent → none…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4e | `signTx.ts`: `  if (words === 'missing') return 'override-missing';` → (the line removed) | “no word → override-missing; a wrong…” (`overrides.test.ts`) — tsc 0 · RED Tests  6 failed \| 8 passed (14) |
| M4f | `signTx.ts`: `  if (words === 'mismatch') return 'override-mismatch';` → (the line removed) | “no word → override-missing; a wrong…” (`overrides.test.ts`) — tsc 0 · RED Tests  5 failed \| 9 passed (14) |
| M4g | `signTx.ts`: `!(o.error === 'dependent' && sim.flags[i]?.some(f => f.kind === 'dependent' && f.on === o.on - 1))` → `i >= 0` | “a dependent step (F10)…” (`overrides.test.ts`) — tsc 0 · RED Tests  3 failed \| 11 passed (14) |
| M4h | `signTx.ts`: `sim.flags[i]?.some(f => f.kind === 'dependent' && f.on === o.on - 1)` → `i >= 0` | “without the flag, or with one naming another step…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4i | `signTx.ts`: ` && f.on === o.on - 1` → (removed) | “without the flag, or with one naming another step…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4j | `decide.ts`: `txRefused(e, d.simulation, d.overrides, tx.now) ?? structuredClone(e)` → `txRefused(e, d.simulation, (e.sim?.status === 'ok' ? e.sim.sim.flags.flatMap((l, t) => l.filter(f => f.severity === 'block').map(f => ({tx: t, word: f.word ?? ''}))) : []), tx.now) ?? structuredClone(e)` | “no word → override-missing; a wrong…” (`overrides.test.ts`) — tsc 0 · RED Tests  6 failed \| 8 passed (14) |
| M4k | `decide.ts`: `(isTxType(e.type) ? txRefused(e, d.simulation, d.overrides, tx.now) : null)` → `(isTxType(e.type) ? txRefused(e, d.simulation, (e.sim?.status === 'ok' ? e.sim.sim.flags.flatMap((l, t) => l.filter(f => f.severity === 'block').map(f => ({tx: t, word: f.word ?? ''}))) : []), tx.now) : null)` | “the deciding section checks the words itself…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4l | `signTx.ts`: ` && flagsCovered(fresh.flags, current.flags)` → ` && flagsCovered(fresh.flags, fresh.flags)` | “a refresh that adds a block…” (`overrides.test.ts`) — tsc 0 · RED Tests  3 failed \| 11 passed (14) |
| M4m | `signTx.ts`: `JSON.stringify([f.tx, f.row, f.word, f.step])` → `JSON.stringify([f.tx, f.row])` | “changes a block’s word…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4n | `signTx.ts`: `    for (const f of list) {⏎      const row = FLAG_ROW[f.kind];` → `    for (const f of list.filter(x => x.severity === 'block')) {⏎      const row = FLAG_ROW[f.kind];` | “a refresh that adds a warning…” (`overrides.test.ts`) — tsc 0 · RED Tests  2 failed \| 12 passed (14) |
| M4o | `signTx.ts`: `step: f.kind === 'dependent' ? f.on + 1 : null` → `step: f.kind === 'dependent' ? f.on : null` | “two kinds of block on one step…” (`overrides.test.ts`) — tsc 0 · RED Tests  2 failed \| 12 passed (14) |
| M4p | `signTx.ts`: `step: f.on + 1} : f);` → `step: f.on} : f);` | “each transaction’s flags in the order stored…” (`overrides.test.ts`) — tsc 0 · RED Tests  1 failed \| 13 passed (14) |
| M4q | `reauthChallenges.ts`: `return (blocks > 0) === reasons.includes('override');` → `return blocks >= 0;` | “refused: a key more or less…” (`reauthChallenges.test.ts`) — tsc 0 · RED Tests  1 failed \| 16 passed (17) |
| M4r | `reauthChallenges.ts`: ` \|\| f.step > f.tx` → (removed) | “refused: a key more or less…” (`reauthChallenges.test.ts`) — tsc 0 · RED Tests  1 failed \| 16 passed (17) |
| M4s | `reauthChallenges.ts`: `    if (seen.has(key)) return false;` → (the line removed) | “refused: a key more or less…” (`reauthChallenges.test.ts`) — tsc 0 · RED Tests  1 failed \| 16 passed (17) |
| M4t | `reauthChallenges.ts`: `typeof f.word !== 'string' \|\| !UNLIMITED_WORDS.includes(f.word)` → `typeof f.word !== 'string' \|\| !UNLIMITED_WORDS.includes(f.word.toUpperCase())` | “refused: a key more or less…” (`reauthChallenges.test.ts`) — tsc 0 · RED Tests  1 failed \| 16 passed (17) |
| M4u | `challenge.ts`: `return (rows.length > 0) === reasons.includes('override') ? rows : null;` → `return rows;` | “fails closed on anything the background never issues…” (`challenge.test.ts`) — tsc 0 · RED Tests  1 failed \| 39 passed (40) |
| M4v | `challenge.ts`: `    if (expected === null) continue;` → (the line removed) | “one row per block…” (`challenge.test.ts`) — tsc 0 · RED Tests  1 failed \| 39 passed (40) |
| M4w | `challenge.ts`: `REAUTH.transactionOf(tx + 1, transactions)` → `REAUTH.transactionOf(tx, transactions)` | “one row per block…” (`challenge.test.ts`) — tsc 0 · RED Tests  1 failed \| 39 passed (40) |
| M4x | `challenge.ts`: ` \|\| seen.has(`${tx}:${row}`)) return null;` → `) return null;` | “fails closed on anything the background never issues…” (`challenge.test.ts`) — tsc 0 · RED Tests  1 failed \| 39 passed (40) |
| M4y | `reauth.ts`: `      for (const o of d.overrides) rows.push(row(o.label, o.transaction));` → (the line removed) | “a dApp’s override…” (`reauthScreen.test.ts`) — tsc 0 · RED Tests  1 failed \| 52 passed (53) |
| M4z | `client.ts`: `const tx = o.tx === undefined \|\| o.tx === null ? null : (txDetailOf(o.tx) ?? null);` → `const tx = o.tx === undefined ? null : nullOr(o.tx, txDetailOf);` | “a detail refused for an unknown flag kind…” (`tx.test.tsx`) — tsc 0 · RED Tests  3 failed \| 21 passed (24) |
| M4aa | `client.ts`: `if (on === null ? dependent.length > 0 : ` → `if (on === null ? false : ` | “pendingOf refuses the whole detail…” (`tx.test.tsx`) — tsc 0 · RED Tests  1 failed \| 23 passed (24) |
| M4ag | `client.ts`: `dependent.length !== 1 \|\| dependent[0]?.step !== on) return undefined;` → `dependent.length !== 1 \|\| dependent[0]?.step === undefined) return undefined;` | “pendingOf refuses the whole detail…” (`tx.test.tsx`) — tsc 0 · RED Tests  1 failed \| 23 passed (24) |
| M4ab | `client.ts`: `const flags = nullOr(o.flags, v => listOf(v, flagOf));` → `const flags = nullOr(o.flags, v => (Array.isArray(v) ? (v as unknown[]).map(flagOf).filter((f): f is Flag => f !== undefined) : undefined));` | “pendingOf refuses the whole detail…” (`tx.test.tsx`) — tsc 0 · RED Tests  2 failed \| 22 passed (24) |
| M4ac | `client.ts`: `  if ((transactions as TxItem[]).some((t, i) => (dependsOnStep(t) ?? 0) > i)) return undefined;` → (the line removed) | “pendingOf refuses the whole detail…” (`tx.test.tsx`) — tsc 0 · RED Tests  1 failed \| 23 passed (24) |
| M4ad | `client.ts`: ` \|\| (outcome === null) !== (flags === null)) return undefined;` → `) return undefined;` | “pendingOf refuses the whole detail…” (`tx.test.tsx`) — tsc 0 · RED Tests  1 failed \| 23 passed (24) |
| M4ae | `client.ts`: `if (o === undefined \|\| o.severity !== 'block' \|\| o.word !== 'ASSIGN' \|\| ` → `if (o === undefined \|\| o.severity !== 'block' \|\| ` | “pendingOf refuses the whole detail…” (`tx.test.tsx`) — tsc 0 · RED Tests  1 failed \| 23 passed (24) |

32 mutations, all red, every one compiling (`tsc` 0), each turning its named test red.

Dry-run history, stated: five first variants did not compile — M4b and M4d (deleting the check left `rest` / `MAX_WORD` unused), M4l (deleting the call left `flagsCovered` unused), M4t and M4aa (likewise `UNLIMITED_WORDS`, the `dependent`/`on` locals) — `tsc` 2, INVALID, not counted; each was replaced by the compiling variant in the table (a bound moved by one, the issued list compared with itself, a case-folded word, one half of the cross-check). M4g's first run reported nothing red because the runner filtered with `vitest -t`, which reads a regular expression — "(F10)" in the name matched nothing and no test ran; the runner now runs each named file whole and checks the named test is among the failed ones (the table's counts are those whole-file runs). One first run was GREEN and the test was strengthened (not the code): M4ag (the flag's `step` no longer compared with the outcome's `on`) survived because the only disagreeing case, `step: 2` beside `on: 1` on the second transaction, was also refused by the earlier-step rule (2 > index 1); the case `on: 2` beside `step: 1` (an earlier step, but not the outcome's) was added, and M4ag then turned red (`Tests  1 failed | 23 passed (24)`) — it is in the code above. Not mutated, stated: the exact-key checks of a challenge flag (`Object.keys(f).length !== 4` in `isDappFlags`, `hasExactly(…, FLAG_KEYS)` on #10) — a key more and a key less are cases of both refusal tests, but no mutant was run on them; and `flagView`'s pass-through of the nine kinds other than `dependent` — the window's strict reader is what checks them (M4z–M4ag).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-3 decide gate — typed overrides checked against the stored flags in both sections, dependent steps approvable only overridden, the challenge's flags and #10's override rows, the window's TxDetail flags" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

#### Dry-run notes (Task 4)

- **Ruling: the challenge's flags are named by their row of the red-flag table (`F1`–`F10`), not by redFlags.ts's kind** — why: the vault page's sources may not contain the word `assign` (`scripts/check-vault-isolation.mjs`, MARKUP_EVASIONS: "the names themselves are refused" — `Object.assign` is a reflective setter), so #10 cannot spell F3's kind; the spec's own row numbers are compact, stable and need no new name. `FLAG_ROW` is a `Record<RedFlagKind, FlagRow>`, so a new kind does not compile without a row. The first dry-run version used the kinds and failed the gate (`src/unlock/challenge.ts: sets properties reflectively`) — never weaken that gate for data — cost if wrong: one more vocabulary (kind ↔ row) to keep in sync, by type.
- **Controller ruling: the new refusal is `override-missing`, not the brief's `'blocked'`** — `DecideError` already has `'blocked'` (§2.3: the site blocked or cooling down); one name per meaning, so the window can give each its own line. The spec names neither string (it says "refuses it when any block has none").
- **Ruling: a transaction detail the window cannot read is `tx: null` (Q26, only Reject); before, `pendingOf` returned null and the window kept its last view — on a first read, a blank window (B1c-2's I1 history).** The brief asks for exactly this for an unknown flag kind ("the detail is invalid → the window shows Q26"); applying it to every unreadable detail is one rule instead of two. B1c-2's I1 negative control and Task 3's reasons test now assert `tx: null` (their point — refused — is unchanged) — cost if wrong: none for funds (Reject only either way); a request the window cannot read is no longer "waiting for the next poll".
- **Ruling: the words are checked before the re-authentication gate** — the last two rows of `txRefused`, so a request with a missing or wrong word never gets a challenge issued (tested: `challengeId` stays null). The window enables Approve only when every field matches (Task 5), so a user never meets the gate before the words — cost if wrong: none found.
- **Ruling: the challenge carries the warnings too, and `flagsCovered` compares (transaction, row, word, step)** — a refresh that adds a block, adds a warning, changes F5's word (USDC → UNLIMITED: the wallet no longer names the token) or a dependent step re-issues; a refresh that drops a flag does not. Stricter than the brief's "a flag kind/tx the issued challenge did not name" (word and step added) — cost if wrong: one more #10 when a refresh surfaces, e.g., a Token-2022 warning. The challenge does NOT bind a block's details (which account, which delegate): the proof stays bound to the exact bytes (`dappDigest`), the bytes cannot change, and the words are recomputed from the newest simulation at every decision.
- **Ruling: one challenge entry per (transaction, row)** — several F7 mints of one transaction are one entry; `MAX_DAPP_FLAGS` = 10 rows × 5 transactions = 50; a dependent step's `step` must name an earlier one (1 ≤ step ≤ tx, 1-based against a 0-based index); a block ⇔ `override` in the reasons on both sides (as `simStateOf`).
- **Ruling: #10 shows rows for blocks only, after the outgoing rows and the "and n more" line; the warnings travel for the re-issue but are not rows** (the brief: "one row per block"). In a batch each row's value is "Transaction <n> of <m>" (#48's owner copy `batchItem`, reused, not new); a single transaction's row has no value. F5's row is the design's F5 head with the word as the symbol, "token" for `UNLIMITED`.
- **Ruling: `txRefused`'s dependent exemption also requires its own F10 flag (`on === outcome.on − 1`)** — Task 3's `simStateOf` already guarantees it for anything read from storage, so this is reachable only in memory; it is tested at unit level (M4h, M4i), not claimed beyond that.
- **Ruling: `decideRequestOf` reads `overrides` for every decision** (a malformed list is `malformed` even on a reject — the window never sends one there) but only a transaction approval checks them; `MAX_OVERRIDES` = MAX_BATCH × the four block words = 20, a word ≤ 32 characters (the empty string is a valid shape and simply a mismatch).
- **Copy (flagged):** Q37 "Assign / Allocate on your wallet account" (B1 §3's F3 row), Q38 "SetAuthority on an account you own" (F4's row), Q39 "Unlimited <SYM> spend approval" / "Unlimited token spend approval" (the design's F5 head; "token" is new), Q40 "Depends on step <N> — not checked on its own" (Q32 shortened to a row) — written into §10. **Task 5's banner copy starts at Q41.**
- **Deviation (additive): the spec is touched** (§3.3's override rule: two lines on #10's rows and what re-issues; §10 Q37–Q40) — Task 1 owns rev 3.6. **Deviation (additive): `txHarness.ts` gains `Chain.errFor` and `assign` / `ataCreate` / `tokenTransfer`** — Task 5's window tests and Task 7 can reuse them.
- **For Task 5:** each transaction's `flags` (null while simulating, as `outcome`) is the background's list in redFlags.ts's order (blocks first); the typed fields are its `severity === 'block'` entries (at most one per kind per transaction — Task 2), each field's word the flag's `word`; send `overrides: [{tx: <0-based index of the transaction's section>, word: <typed>}]` for every field — only matched fields, or Approve stays disabled. Q32's <N> is `dependsOnStep(item)` only (never `outcome.on`, never a flag's index). A dependent outcome still renders as B1c-2's failure (Tx.tsx `stateOf` → `failed`) until Task 5 gives it its own section; the background now accepts it overridden.
- **E2E not run** (as Tasks 1–3): any existing E2E request that F3/F4/F5 now blocks will be refused `override-missing` at Approve until Task 5's window sends the words — Task 7 must expect it.


---

### Task 5: #48 renders the red flags — the banners in each transaction's section (blocks, then warnings), one typed field per (transaction, block kind), the red CTAs behind #37's gate, the synthesized "delegated" rows, the dependent step's own section, the eyebrows, and the 1.5 s hold

**Spec:** B1c §3.3 rev 3.6 "Holds", "The typed field", "Banners", "Attribution (F10)" (this task adds two lines: the typed field is in no form, and a lookalike's order of gates; and the banners' copy index); §10 (Q41–Q55 added here, controller copy, flagged); B1 §3 (Confirm disabled 1.5 s on any red-flag screen, no default focus, Enter does not confirm; "by typing the token symbol … or the word shown"); the design, BINDING: `/home/user/Downloads/index.html` #48 ix:18261-18705, state 2 "unlimited-spend · typed-confirm" ix:18325-18396, CSS ix:3847-3860 (the design map `.superpowers/sdd/b1c3-context-design.md` §1); #37's typed gate (ix:~15000); brief "Override rule" (R4), "Holds" (R5), "Typed field" (R6), "Banners" (R7); C13, C15, rule 6

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (§3.3: the typed field in no form, a lookalike's order of gates, the banners' copy index; §10: Q41–Q55)
- Test: `extension/src/approve/__tests__/tx.test.tsx` (a new describe "#48 red flags (B1c-3)", seven tests)
- Test: `extension/src/background/dapp/__tests__/txHarness.ts` (`tokenApprove`; `Chain.accounts` — the accounts getAccountsData reads and the simulation returns unchanged)
- Test: `extension/src/__tests__/designExt2b.test.ts` (the typed-confirm rules; the hash re-pinned)
- Modify: `extension/src/approve/Tx.tsx` (the banners, the typed fields, the CTAs, the eyebrows, the delegated rows, the dependent step's balance card and its place in `stateOf`, the hold)
- Modify: `extension/src/approve/strings.ts` (`FLAG_TEXT`)
- Modify: `extension/src/approve/useArmed.ts` (`FLAG_HOLD_MS`)
- Modify: `extension/src/approve/ui.tsx` (`RiskConfirm`'s `holdMs`)
- Modify: `extension/src/app/app.css` (the code spans, the word's true case, the helper, #37's gate for `.app-cta-gated`)
- Modify: `extension/scripts/extract-design-css.mjs` (`.s9-typed-confirm` added to the allowlist)
- Generated: `extension/src/styles/design-ext.css` (re-run of the extractor: the five `.s9-typed-confirm` rules, ix:3856-3860)
- Not modified: `extension/src/approve/client.ts` — Task 4's `Flag`, `TxItem.flags`, `dependsOnStep` and `Decision.overrides` are exactly what the window needs.

**Interfaces:**
- Consumes: Task 4's `Flag` (the ten kinds), `TxItem.flags` (null while simulating; blocks first), `dependsOnStep(item)` (Q32's 1-based <N> — the one accessor), `Decision.overrides: {tx: number; word: string}[]` (`tx` 0-based), the `dependent` `TxOutcome`, the background's refusals `override-missing` / `override-mismatch` and its `reauth-required` for every block (Task 3's `override` reason); Task 2's flag fields (instruction indices, approvals, settings); B1c-2's `Tx`, `BalanceCard`, `Payload`, `ConfirmButton`, `RiskConfirm`, `useArmed`, `ARM_MS`, `windowHarness.openWindow`, `txHarness` (`v0`, `coSigned`, `assign`, `ataCreate`, `tokenTransfer`, `Chain.errFor`), `tokenBytes` (`tokenAccountBytes`, `usdcLikeMint`, `U64_MAX`), `styled.unstyledClasses`.
- Produces:
  ```ts
  // approve/useArmed.ts
  export const FLAG_HOLD_MS = 1_500;            // B1 §3: on a screen with any flag, every confirming CTA (and the 2-second confirm's)
  // approve/ui.tsx
  export function RiskConfirm(p: {onCancel; onProceed; delay?: number; holdMs?: number /* default ARM_MS */}): JSX.Element;
  // approve/strings.ts
  export const FLAG_TEXT: {overlineUnlimited; overlineBlocked /* Q35 */; approveUnlimited; approveBlocked /* Q34 */; typed; typedHelp;
    unlimitedHead /* design, Q39 */; all /* design, Q41 */; unlimitedMax /* design, Q41 */; unlimitedWhole /* Q42 */; unlimitedChain /* Q43 */;
    boundedHead /* Q44 */; bounded /* Q45 */; meta /* design, Q55 */; delegated; unlimited; allFuture /* design */;
    assignHead /* Q37 */; assign /* Q46 */; authorityHead /* Q38 */; authority /* Q47 */; dependsOn /* Q32 */; dependent /* Q48 */;
    balanceUnknown; balanceUnknownLine /* Q49 */; unknownHead /* screen.md */; unknown; unknownNull /* Q50 */; nonTransferHead; nonTransfer /* Q51 */;
    token2022Head; freeze; permanentDelegate; transferHook /* Q52 */; unreadable /* Q36 */; nonce /* B1 §3 */; wholeHead; whole /* Q53 */;
    noChangesAuthority /* Q54 */; postSimulation /* Q55 */};
  // approve/Tx.tsx
  export interface TypedField {key: string; tx: number; word: string}   // key `${tx}:${kind}` — one per (transaction, block kind)
  // background/dapp/__tests__/txHarness.ts
  export const tokenApprove: (source: PublicKey, delegate: PublicKey, amount: bigint) => TransactionInstruction;
  export interface Chain {/* B1c-2's, Task 4's */; accounts: Map<string, AccountData>}
  ```

The window renders what the background computed and decides nothing (C13). Each transaction's section now opens with its banners — every block as `.s9-flag-banner danger`, then every warning as `.s9-flag-banner warn` (a stable split of the background's list, so a warning the background listed first can never sit above a block) — each with the design's head / body / meta structure (ix:18348-18355). F5 is the design's own copy with the real token, the real delegate and the real instruction: the body's code spans read `spl_token::Approve` and `amount = u64::MAX` only when that is literally the instruction (another program or `approveChecked` names itself; a decoded amount below u64::MAX that is still the whole balance says so with its own base units, Q42; an approval seen only in the simulation's chain state says it was a program call, Q43). Every address is shown whole, in groups of four — never the design's `JUP6L…vRet9` (the address-poisoning lesson; Q55). An approve changes no balance, so its row is synthesized: "<SYM> delegated · unlimited · ≈ all current + future" at u64::MAX (the design's), "<SYM> delegated · <amount>" otherwise; beside an F3 / F4 block where nothing moves, L3's line is replaced (Q54). A dependent step (F10) is no longer a failure of the screen: it has its own section with Q32's head (its <N> read only through `dependsOnStep`), Q48's body, the node's error as meta, and a balance card that says its effects are unknown (Q49) — every other failure stays B1c-2's Reject-only screen.

One typed field per (transaction, block kind), in that transaction's section, after its instructions (the design's order: banner, balance card, typed field): the design's `.s9-typed-confirm`, its label "Type <code>WORD</code> to enable Approve" with the word in its true case (app.css `text-transform: none` under the design's uppercase label), an `<input>` with `autocapitalize`, `autocomplete`, `autocorrect` off and `spellcheck` false, in no form, never focused, never pre-filled, `.input.match` on an exact `===` match (no trimming, no case folding), and #37's helper. The CTA is the design's red "Approve unlimited" with `#i-alert-triangle` when every block on the screen is an unlimited approve, "Approve anyway" (Q34) for any other block — `btn btn-destructive`, with #37's greyed gate (`app-cta-gated`: `--bg-surface-3`, `--fg-disabled`, opacity 1) until every field matches; the eyebrow is the design's "Critical · Unlimited spend approval" or Q35 "Critical · Blocked transaction" (a block's eyebrow also replaces a lookalike's "Suspicious origin"; the lookalike banner and the flipped bar stay). The approval sends `overrides` built from the fields that match, and only those (`tx` = the section's 0-based index); the background recomputes every word and then asks for #10 (Q33). A lookalike origin with a block passes both gates in this order: the typed fields enable its demoted "Approve anyway (not recommended)", which opens the 2-second confirm.

The hold: on any screen with a flag (a warning or a block), `useArmed(key, FLAG_HOLD_MS)` — the same triggers as C15 (mount, focus, every key change), 1.5 s instead of 500 ms; the key gains every typed field's match state, so a match gained or lost re-holds; the 2-second confirm's own C15 hold is 1.5 s too on such a screen. Reject is never held; Enter never confirms (ConfirmButton) and the typed field has nothing to submit.

- [ ] **Step 1: Write the failing tests.**

The harness gains a Token approve and the accounts a chain holds besides the wallet's (a token account and its mint — Task 2's F5 word needs the mint's decimals as read):

`extension/src/background/dapp/__tests__/txHarness.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/txHarness.ts b/extension/src/background/dapp/__tests__/txHarness.ts
index 0d5c145..d135c13 100644
--- a/extension/src/background/dapp/__tests__/txHarness.ts
+++ b/extension/src/background/dapp/__tests__/txHarness.ts
@@ -1,7 +1,7 @@
 import {ed25519} from '@noble/curves/ed25519.js';
 import {base64} from '@scure/base';
 import {PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
-import type {SimulationOutcome, SolanaReader} from '../../../../../core/solana/rpc';
+import type {AccountData, SimulationOutcome, SolanaReader} from '../../../../../core/solana/rpc';
 import {handleMessage} from '../../messages';
 import {setSession} from '../../session';
 import {VAULT_KEY} from '../../accountsStore';
@@ -99,6 +99,18 @@ export const tokenTransfer = (destination: PublicKey, source = new PublicKey(new
     ],
   });
 
+/** B1c-3 (Task 5): a Token approve (tag 4) of `amount` from `source` to `delegate`, the account its owner. */
+export const tokenApprove = (source: PublicKey, delegate: PublicKey, amount: bigint): TransactionInstruction =>
+  new TransactionInstruction({
+    programId: new PublicKey(TOKEN_PROGRAM),
+    data: Buffer.from([4, ...u64le(amount)]),
+    keys: [
+      {pubkey: source, isSigner: false, isWritable: true},
+      {pubkey: delegate, isSigner: false, isWritable: false},
+      {pubkey: ME, isSigner: true, isWritable: false},
+    ],
+  });
+
 export interface Chain {
   /** simulateTransaction's error (null: it runs). */
   err: unknown;
@@ -108,6 +120,11 @@ export interface Chain {
   calls: Map<string, number>;
   /** getBalance throws while set. */
   down: boolean;
+  /**
+   * B1c-3 (Task 5): accounts besides the wallet's (a token account, a mint) — what getAccountsData reads, and each one's
+   * post-state in a simulation (unchanged by it).
+   */
+  accounts: Map<string, AccountData>;
 }
 
 /** The steered chain (exported for the approval window's tests). */
@@ -132,7 +149,7 @@ export function chainReader(chain: Chain): SolanaReader {
     },
     getAccountsData: async addresses => {
       count('getAccountsData');
-      return addresses.map(() => null);
+      return addresses.map(a => chain.accounts.get(a) ?? null);
     },
     simulateTransaction: async (txBase64, opts): Promise<SimulationOutcome> => {
       count('simulateTransaction');
@@ -145,7 +162,7 @@ export function chainReader(chain: Chain): SolanaReader {
         if (keys[ix.programIdIndex] === SystemProgram.programId.toBase58() && ix.data[0] === 2 && keys[ix.accountKeyIndexes[0] ?? -1] === ME.toBase58()) out += new DataView(ix.data.buffer, ix.data.byteOffset + 4, 8).getBigUint64(0, true);
       }
       const fee = keys[0] === ME.toBase58() ? 5_000n * BigInt(m.header.numRequiredSignatures) : 0n;
-      return {err: null, logs: [], unitsConsumed: 450, slot: 777, accounts: (opts?.accounts ?? []).map(a => (a === ME.toBase58() ? {lamports: SOL - out - fee, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null))};
+      return {err: null, logs: [], unitsConsumed: 450, slot: 777, accounts: (opts?.accounts ?? []).map(a => (a === ME.toBase58() ? {lamports: SOL - out - fee, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : (chain.accounts.get(a) ?? null)))};
     },
   });
 }
@@ -159,7 +176,7 @@ export async function until(done: () => Promise<boolean>, turns = 400): Promise<
   throw new Error('never settled');
 }
 
-export const newChain = (): Chain => ({err: null, errFor: null, calls: new Map(), down: false});
+export const newChain = (): Chain => ({err: null, errFor: null, calls: new Map(), down: false, accounts: new Map()});
 
 export async function txScene(o: {grant?: Partial<Grant> | null; known?: string[]; origin?: string} = {}) {
   const origin = o.origin ?? DAPP;
````

The window tests: the design's state 2 against the real background end to end (banners, rows, the field's attributes and exactness, never focused, the gate, the hold, Enter, the words, #10, signed); the hold's timing with fake timers on the real background (1.49 s disabled, 1.5 s enabled — after a match change, a focus, a match lost and regained, a new simulation; Reject never held; negative control: an unflagged screen at 500 ms); two blocks in one transaction (Q35, "Approve anyway", both words needed) and Q54; a three-step dependent batch (step 3 depends on step 2 — a 0-based slip reads 1, a self-index 3); a lookalike with a block (both gates, in order; the sheet's 1.5 s); every kind of flag's banner from a view (the copy, blocks before warnings — the view lists a warning first —, whole addresses, the synthesized rows); the design's rules as extracted and the hand-written ones:

`extension/src/approve/__tests__/tx.test.tsx`:

````diff
diff --git a/extension/src/approve/__tests__/tx.test.tsx b/extension/src/approve/__tests__/tx.test.tsx
index 96ed97e..378a09d 100644
--- a/extension/src/approve/__tests__/tx.test.tsx
+++ b/extension/src/approve/__tests__/tx.test.tsx
@@ -4,7 +4,7 @@ import {join} from 'node:path';
 import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
 import {ed25519} from '@noble/curves/ed25519.js';
 import {base64} from '@scure/base';
-import {VersionedTransaction} from '@solana/web3.js';
+import {PublicKey, VersionedTransaction} from '@solana/web3.js';
 import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
 import {handleMessage} from '../../background/messages';
 import {setSession} from '../../background/session';
@@ -12,10 +12,12 @@ import {readDappSession} from '../../background/dapp/store';
 import {GRANTS_KEY} from '../../background/dapp/grants';
 import {openPage} from '../../background/dapp/__tests__/pageHarness';
 import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
-import {ME, coSigned, mintTo, setAuthorityToNone, transfer, v0} from '../../background/dapp/__tests__/txHarness';
-import {dependsOnStep, pendingOf, type RequestView} from '../client';
+import {ME, assign, ataCreate, coSigned, mintTo, setAuthorityToNone, tokenApprove, tokenTransfer, transfer, v0} from '../../background/dapp/__tests__/txHarness';
+import {U64_MAX, tokenAccountBytes, usdcLikeMint} from '../../background/dapp/__tests__/tokenBytes';
+import {ATA_PROGRAM, TOKEN_PROGRAM} from '../../background/dapp/decode/decode';
+import {dependsOnStep, pendingOf, type Flag, type RequestView} from '../client';
 import {Tx} from '../Tx';
-import {ARM_MS} from '../useArmed';
+import {ARM_MS, FLAG_HOLD_MS} from '../useArmed';
 import {CONFIRM_DELAY_MS} from '../ui';
 import {SECOND, openWindow} from './windowHarness';
 
@@ -643,3 +645,379 @@ describe('#48 origin-mismatch · auto-reject', () => {
     await waitFor(() => expect(w.closed.n).toBe(1));
   });
 });
+
+// B1c-3 (spec §3.3 rev 3.6; index.html #48 state 2 "unlimited-spend · typed-confirm", ix:18325-18396): the background's
+// red flags in each transaction's section, the typed fields, the red CTAs, the 1.5 s hold — against the real background.
+describe('#48 red flags (B1c-3)', () => {
+  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
+  const SRC = new PublicKey(new Uint8Array(32).fill(81));
+  const DELEGATE = new PublicKey(new Uint8Array(32).fill(82));
+  const X = new PublicKey(new Uint8Array(32).fill(83));
+  const Y = new PublicKey(new Uint8Array(32).fill(84));
+  type W = Awaited<ReturnType<typeof openWindow>>;
+  /** The account holds 250 USDC in SRC (a classic token account, owner field = the account); the USDC mint reads 6 decimals. */
+  const holdUsdc = (w: W) => {
+    w.chain.accounts.set(SRC.toBase58(), {lamports: 2_039_280n, owner: TOKEN_PROGRAM, data: tokenAccountBytes({mint: USDC, owner: ACCOUNT.publicKey, amount: 250_000_000n})});
+    w.chain.accounts.set(USDC, {lamports: 1_461_600n, owner: TOKEN_PROGRAM, data: usdcLikeMint()});
+  };
+  const holdAfter = () => new Promise(r => setTimeout(r, FLAG_HOLD_MS + 50));
+  const decided = (w: W) => w.sent.filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null && (m as {type?: unknown}).type === 'dapp.decide');
+  const field = (word: string) => screen.getByLabelText(`Type ${word} to enable Approve`) as HTMLInputElement;
+  const type = (word: string, value: string) => fireEvent.change(field(word), {target: {value}});
+  const heads = (root: ParentNode = document) => [...root.querySelectorAll('.s9-flag-banner .head')].map(e => e.textContent);
+  const sections = () => [...document.querySelectorAll('.app-tx-item')];
+  /** A batch whose later step fails on an account an earlier one creates (F10's attribution, Task 3). */
+  const dependentOn = (created: PublicKey) => (keys: string[]) => (keys.includes(created.toBase58()) && !keys.includes(ATA_PROGRAM) ? {InstructionError: [0, 'InvalidAccountData']} : null);
+
+  it('an unlimited USDC approve (the design’s state 2): the eyebrow, the danger banner with the design’s copy, the delegated row, the typed field — exact, case-sensitive, never focused — "Approve unlimited" gated, then held 1.5 s; the words go with the approval, then #10, then signed', async () => {
+    const w = await openWindow();
+    holdUsdc(w);
+    const {page, requestId} = await w.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, U64_MAX)])]);
+    w.show();
+    await simulated(w, 'Unlimited USDC spend approval');
+    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Critical · Unlimited spend approval', 'title noc-overline noc-danger']);
+    // Blocks first, then warnings (F2 names the approve), in the transaction's section.
+    expect([...document.querySelectorAll('.app-tx-item .s9-flag-banner')].map(b => b.className)).toEqual(['s9-flag-banner danger', 's9-flag-banner warn']);
+    expect(heads()).toEqual(['Unlimited USDC spend approval', 'Instructions that are not transfers']);
+    const danger = document.querySelector('.s9-flag-banner.danger') as HTMLElement;
+    expect(within(danger).getByText(/This transaction includes/).textContent).toBe(
+      'This transaction includes a spl_token::Approve instruction with amount = u64::MAX (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move all your USDC, now and in the future, until you revoke.',
+    );
+    expect([...danger.querySelectorAll('.body code')].map(c => c.textContent)).toEqual(['spl_token::Approve', 'amount = u64::MAX']);
+    expect(danger.querySelector('.body i')?.textContent).toBe('all your USDC');
+    expect(danger.querySelector('.meta')?.textContent).toBe(`delegate: ${DELEGATE.toBase58()} · token: USDC mint ${USDC} · scope: u64::MAX`);
+    expect(texts('.s9-flag-banner.warn .meta')).toEqual(['#1 spl_token::Approve']);
+    // The synthesized row first (an approve changes no balance), then the simulation's own (the fee).
+    expect(texts('.s9-bal-row .pri')).toEqual(['USDC delegated', 'SOL']);
+    expect(texts('.s9-bal-row .delta')).toEqual(['unlimited', '−0.000005']);
+    expect(texts('.s9-bal-row .fiat')[0]).toBe('≈ all current + future');
+    expect(document.querySelector('.app-tx-none')).toBeNull();
+    // The typed field, in the section, after the instructions: the word in its true case, the attributes, #37's helper.
+    expect(text('.app-tx-item .s9-typed-confirm .label')).toBe('Type USDC to enable Approve');
+    expect(text('.s9-typed-confirm .label code')).toBe('USDC');
+    expect(text('.s9-typed-confirm .app-typed-help')).toBe('Case-sensitive · must match exactly.');
+    const input = field('USDC');
+    expect(['autocapitalize', 'autocomplete', 'autocorrect', 'spellcheck'].map(a => input.getAttribute(a))).toEqual(['off', 'off', 'off', 'false']);
+    expect([input.value, input.className, input.form]).toEqual(['', 'input', null]);
+    // No control is focused at open — the typed field included.
+    expect(document.activeElement).toBe(document.body);
+    const gated = cta('Approve unlimited');
+    expect([gated.className, gated.disabled, gated.querySelector('svg') !== null]).toEqual(['btn btn-destructive app-cta-wide app-cta-gated', true, true]);
+    expect(unstyled()).toEqual([]);
+    // Exact and case-sensitive: no trimming, no case folding — past the hold, so only the match gates.
+    await holdAfter();
+    for (const wrong of ['usdc', 'USDC ', ' USDC', 'USD', 'USDCC']) {
+      type('USDC', wrong);
+      expect([wrong, field('USDC').className, cta('Approve unlimited').className, cta('Approve unlimited').disabled]).toEqual([wrong, 'input', 'btn btn-destructive app-cta-wide app-cta-gated', true]);
+    }
+    type('USDC', 'USDC');
+    expect([field('USDC').className, cta('Approve unlimited').className, cta('Approve unlimited').disabled]).toEqual(['input match', 'btn btn-destructive app-cta-wide', true]);
+    expect(unstyled()).toEqual([]);
+    await holdAfter();
+    expect(cta('Approve unlimited').disabled).toBe(false);
+    // Enter never confirms: neither in the field nor on the CTA.
+    fireEvent.keyDown(field('USDC'), {key: 'Enter'});
+    fireEvent.keyDown(cta('Approve unlimited'), {key: 'Enter'});
+    expect(decided(w)).toEqual([]);
+    fireEvent.click(cta('Approve unlimited'));
+    // The override re-authenticates (Q33, O1): the words went with the approval; the window points to the toolbar.
+    await screen.findByText("Confirm it's you");
+    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 0, word: 'USDC'}]]);
+    const challengeId = String((await readDappSession(w.ext)).queue[0]?.challengeId);
+    await handleMessage(w.ext, {type: 'vault.reauthOk', challengeId}, {id: w.ext.runtimeId, origin: w.ext.extensionOrigin, url: `${w.ext.extensionOrigin}/unlock.html`}, w.deps);
+    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
+    await waitFor(() => expect(screen.queryByText("Confirm it's you")).toBeNull());
+    await holdAfter();
+    fireEvent.click(cta('Approve unlimited'));
+    await waitFor(() => expect(w.closed.n).toBe(1));
+    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 0, word: 'USDC'}], [{tx: 0, word: 'USDC'}]]);
+    expect((page.answersFor(requestId)[0]?.result as {signed: string[]}).signed).toHaveLength(1);
+  }, 15_000);
+
+  it('holds (fake timers, the real background): any flag holds the CTA 1.49 s, enables it at 1.5 s — after a match change, a focus, a new simulation; Reject never held; an unflagged screen 500 ms (negative control)', async () => {
+    const w = await openWindow();
+    holdUsdc(w);
+    await w.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, U64_MAX)])]);
+    w.show();
+    await simulated(w, 'Unlimited USDC spend approval');
+    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']});
+    try {
+      const at = async (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
+      const held = async () => {
+        await at(FLAG_HOLD_MS - 10);
+        expect([cta('Approve unlimited').disabled, cta('Reject').disabled]).toEqual([true, false]);
+        await at(10);
+        expect(cta('Approve unlimited').disabled).toBe(false);
+      };
+      // A match change (the field now matches): held from here.
+      await act(async () => void type('USDC', 'USDC'));
+      expect([cta('Approve unlimited').disabled, cta('Reject').disabled]).toEqual([true, false]);
+      await held();
+      // A focus re-holds.
+      await act(async () => void window.dispatchEvent(new Event('focus')));
+      expect(cta('Approve unlimited').disabled).toBe(true);
+      await held();
+      // The match lost, then regained: held again from the regain.
+      await act(async () => void type('USDC', 'USDCx'));
+      await at(FLAG_HOLD_MS * 2);
+      expect(cta('Approve unlimited').disabled).toBe(true);
+      await act(async () => void type('USDC', 'USDC'));
+      expect(cta('Approve unlimited').disabled).toBe(true);
+      await held();
+      // A new simulation (the 30 s refresh): the background stores it; the window's next read (no focus) re-holds.
+      const first = (await readDappSession(w.ext)).queue[0]?.sim;
+      w.deps.clock.t += 30_000;
+      await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
+      for (let i = 0; i < 400 && JSON.stringify((await readDappSession(w.ext)).queue[0]?.sim) === JSON.stringify(first); i++) await at(0);
+      expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first);
+      await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
+      expect(cta('Approve unlimited').disabled).toBe(true);
+      await held();
+    } finally {
+      vi.useRealTimers();
+    }
+    // Negative control: a screen with no flag keeps C15's 500 ms.
+    cleanup();
+    const plain = await openWindow();
+    await known(plain);
+    await plain.signTx('https://jup.ag', [v0()]);
+    plain.show();
+    await simulated(plain, 'Balance changes (post-simulation)');
+    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']});
+    try {
+      await act(async () => void window.dispatchEvent(new Event('focus')));
+      await act(async () => void (await vi.advanceTimersByTimeAsync(ARM_MS - 10)));
+      expect(cta('Approve').disabled).toBe(true);
+      await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
+      expect(cta('Approve').disabled).toBe(false);
+    } finally {
+      vi.useRealTimers();
+    }
+  });
+
+  it('System assign of the wallet account (F3) and an unlimited approve in one transaction: "Critical · Blocked transaction", both banners, one field per block — "Approve anyway" only when both match; the L3 line replaced beside an authority flag', async () => {
+    const w = await openWindow();
+    holdUsdc(w);
+    await w.signTx('https://jup.ag', [v0([assign(), tokenApprove(SRC, DELEGATE, U64_MAX)])]);
+    w.show();
+    await simulated(w, 'Assign / Allocate on your wallet account');
+    expect(text('.top-bar .title')).toBe('Critical · Blocked transaction');
+    expect(heads()).toEqual(['Assign / Allocate on your wallet account', 'Unlimited USDC spend approval', 'Instructions that are not transfers']);
+    expect(texts('.s9-flag-banner.danger .body')[0]).toBe("This changes your wallet account itself. Assigned to another program, it is that program's to control; given data, it can no longer pay fees or send SOL.");
+    expect(texts('.s9-flag-banner .meta')).toEqual(['#1 system_program::Assign', `delegate: ${DELEGATE.toBase58()} · token: USDC mint ${USDC} · scope: u64::MAX`, '#1 system_program::Assign', '#2 spl_token::Approve']);
+    expect(texts('.s9-typed-confirm .label')).toEqual(['Type ASSIGN to enable Approve', 'Type USDC to enable Approve']);
+    const anyway = () => cta('Approve anyway');
+    expect([anyway().className, anyway().querySelector('svg')]).toEqual(['btn btn-destructive app-cta-wide app-cta-gated', null]);
+    expect(screen.queryByRole('button', {name: 'Approve unlimited'})).toBeNull();
+    type('ASSIGN', 'ASSIGN');
+    await holdAfter();
+    expect([anyway().className, anyway().disabled]).toEqual(['btn btn-destructive app-cta-wide app-cta-gated', true]);
+    type('USDC', 'USDC');
+    await holdAfter();
+    expect([anyway().className, anyway().disabled]).toEqual(['btn btn-destructive app-cta-wide', false]);
+    expect(unstyled()).toEqual([]);
+    fireEvent.click(anyway());
+    await screen.findByText("Confirm it's you");
+    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 0, word: 'ASSIGN'}, {tx: 0, word: 'USDC'}]]);
+    // The assign alone, paid by the dApp: nothing of the account's moves — L3's line is replaced (Q54).
+    cleanup();
+    const solo = await openWindow();
+    await solo.signTx('https://jup.ag', [coSigned([assign()])]);
+    solo.show();
+    await simulated(solo, 'Assign / Allocate on your wallet account');
+    expect([texts('.s9-bal-row'), text('.app-tx-none')]).toEqual([[], 'No SOL or token balance changes — but this transaction changes who controls an account of yours (above).']);
+    expect(unstyled()).toEqual([]);
+  });
+
+  it('a dependent step (F10): step 3 of a batch depending on step 2 — its own section with Q32 (step 2, never 1 or 3), effects unknown, the field UNCHECKED there only; no "Couldn’t simulate"; the word goes with tx 2', async () => {
+    const w = await openWindow();
+    w.chain.errFor = dependentOn(Y);
+    await w.signTx('https://jup.ag', [v0([ataCreate(X)]), v0([ataCreate(Y)]), v0([tokenTransfer(Y)])]);
+    w.show();
+    await simulated(w, 'This step depends on step 2 and could not be checked on its own.');
+    expect(screen.queryByText("Couldn't simulate")).toBeNull();
+    expect(text('.top-bar .title')).toBe('Critical · Blocked transaction');
+    const [one, two, three] = sections();
+    expect([heads(one), heads(two)]).toEqual([
+      ['Instructions that are not transfers', "Could not read this token's settings"],
+      ['Instructions that are not transfers', "Could not read this token's settings"],
+    ]);
+    expect(heads(three)).toEqual(['This step depends on step 2 and could not be checked on its own.']);
+    expect([...(three?.querySelectorAll('.s9-flag-banner .body, .s9-flag-banner .meta') ?? [])].map(e => e.textContent)).toEqual([
+      'Its effects are unknown: it was simulated without the changes step 2 makes, which it needs.',
+      '{"InstructionError":[0,"InvalidAccountData"]}',
+    ]);
+    expect([three?.querySelector('.s9-bal-card .label')?.textContent, three?.querySelector('.s9-bal-card .app-tx-none')?.textContent, three?.querySelectorAll('.s9-bal-row').length]).toEqual([
+      'Balance changes (unknown)',
+      'This step was not simulated on its own, so its effects are unknown.',
+      0,
+    ]);
+    expect(sections().map(sec => [...sec.querySelectorAll('.s9-typed-confirm .label')].map(l => l.textContent))).toEqual([[], [], ['Type UNCHECKED to enable Approve']]);
+    expect(unstyled()).toEqual([]);
+    type('UNCHECKED', 'UNCHECKED');
+    await holdAfter();
+    fireEvent.click(cta('Approve anyway'));
+    await screen.findByText("Confirm it's you");
+    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 2, word: 'UNCHECKED'}]]);
+  });
+
+  it('a lookalike origin with a block: both gates — the typed field first (the demoted "Approve anyway (not recommended)" stays disabled until it matches), then the 2-second confirm (held 1.5 s on a focus); the words go with the approval', async () => {
+    const w = await openWindow();
+    await w.signTx('https://tensr.trade', [coSigned([assign()])]);
+    w.show();
+    await simulated(w, 'Assign / Allocate on your wallet account');
+    expect(text('.s9-domain-warn .body b')).toBe('This domain is not tensor.trade');
+    expect(text('.top-bar .title')).toBe('Critical · Blocked transaction');
+    expect(document.querySelector('.s9-origin-pill')).toBeNull();
+    const demoted = () => cta('Approve anyway (not recommended)');
+    await holdAfter();
+    expect(demoted().disabled).toBe(true);
+    fireEvent.click(demoted());
+    expect(screen.queryByRole('dialog')).toBeNull();
+    type('ASSIGN', 'ASSIGN');
+    await holdAfter();
+    fireEvent.click(demoted());
+    const sheet = await screen.findByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'});
+    await new Promise(r => setTimeout(r, CONFIRM_DELAY_MS + 50));
+    const understand = () => within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement;
+    expect(understand().disabled).toBe(false);
+    // C15 inside the sheet, at the red-flag screen's 1.5 s: still held 1 s after a focus (500 ms would have released it).
+    await act(async () => void window.dispatchEvent(new Event('focus')));
+    await new Promise(r => setTimeout(r, 1_000));
+    expect(understand().disabled).toBe(true);
+    await new Promise(r => setTimeout(r, FLAG_HOLD_MS - 1_000 + 50));
+    expect(understand().disabled).toBe(false);
+    fireEvent.click(understand());
+    await screen.findByText("Confirm it's you");
+    expect(decided(w).map(m => m.overrides)).toEqual([[{tx: 0, word: 'ASSIGN'}]]);
+    expect(unstyled()).toEqual([]);
+  }, 15_000);
+
+  /** One transaction carrying every kind of flag (as the background sends them), rendered from its view. */
+  const P1 = new PublicKey(new Uint8Array(32).fill(91)).toBase58();
+  const MINT = new PublicKey(new Uint8Array(32).fill(92)).toBase58();
+  const AUTH = new PublicKey(new Uint8Array(32).fill(93)).toBase58();
+  const ix = (program: 'system' | 'token' | 'token-2022' | null, name: string | null) => ({programId: program === null ? P1 : AUTH, program, name, fields: []});
+  const flagged = (flags: Flag[], changes: {mint: string | null; amount: string; decimals: number | null; usdMicros: string | null}[] = []): RequestView => ({
+    requestId: 'f',
+    type: 'signTransaction',
+    origin: 'https://jup.ag',
+    host: 'jup.ag',
+    site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
+    offerBlock: false,
+    connect: null,
+    sign: null,
+    mismatch: null,
+    tx: {
+      kind: 'signTransaction',
+      account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
+      simulation: {status: 'ok', id: 'AAAAAAAAAAAAAAAAAAAAAA', slot: 1, elapsedMs: 1, at: 1},
+      reauth: {reasons: ['override'], state: 'needed'},
+      labels: [],
+      transactions: [
+        {
+          version: 0,
+          feePayer: ACCOUNT.publicKey,
+          unitLimit: null,
+          feeLamports: null,
+          outcome: {ok: true, changes, unitsConsumed: 1, unitLimit: 200_000, feeLamports: null},
+          instructions: [ix('system', 'advanceNonceAccount'), ix('system', 'assign'), ix('token', 'setAuthority'), ix('token', 'approve'), ix('token-2022', 'approveChecked'), ix(null, null), ix('token', null)],
+          flags,
+        },
+      ],
+    },
+  });
+  const approval = (o: Partial<{at: number | null; symbol: 'USDC' | null; decimals: number | null; mint: string | null; amount: string}>) => ({
+    at: 3,
+    source: SRC.toBase58(),
+    mint: USDC,
+    symbol: 'USDC' as const,
+    decimals: 6,
+    delegate: DELEGATE.toBase58(),
+    amount: U64_MAX.toString(),
+    balance: '250000000',
+    ...o,
+  });
+
+  it('every kind of flag: its banner’s head, body and meta (the copy of spec §10), blocks before warnings, every address whole; the synthesized rows', () => {
+    const flags: Flag[] = [
+      {kind: 'durable-nonce', severity: 'warn', word: null, at: 0},
+      {kind: 'assign', severity: 'block', word: 'ASSIGN', at: 1, instructions: [{index: 1, program: 'system', name: 'assign'}], chain: {owner: P1, space: 8}},
+      {kind: 'set-authority', severity: 'block', word: 'AUTHORITY', at: 2, instructions: [{index: 2, program: 'token', account: SRC.toBase58(), owned: 'token-account', authorityType: 'accountOwner', newAuthority: null}], chain: [{account: SRC.toBase58(), change: 'close-authority', from: null, to: AUTH}]},
+      {kind: 'unlimited-approve', severity: 'block', word: 'UNLIMITED', at: 3, approvals: [approval({}), approval({at: 4, symbol: null, decimals: null, mint: MINT, amount: '250000000'}), approval({at: null, symbol: null, mint: null})]},
+      {kind: 'bounded-approve', severity: 'warn', word: null, at: 3, approvals: [approval({amount: '5000000'})]},
+      {kind: 'unknown-program', severity: 'warn', word: null, at: 5, programs: [P1, null]},
+      {kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'system', name: 'advanceNonceAccount'}, {index: 6, program: 'token', name: null}]},
+      {kind: 'token-2022', severity: 'warn', word: null, at: null, mint: MINT, settings: {freezeAuthority: AUTH, permanentDelegate: null, transferHookProgram: P1}},
+      {kind: 'token-2022', severity: 'warn', word: null, at: 4, mint: USDC, settings: null},
+      {kind: 'whole-balance', severity: 'warn', word: null, at: null},
+    ];
+    render(<Tx request={flagged(flags)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    const banners = [...document.querySelectorAll('.s9-flag-banner')].map(b => ({
+      tone: b.className.replace('s9-flag-banner ', ''),
+      head: b.querySelector('.head')?.textContent,
+      body: [...b.querySelectorAll('.body')].map(e => e.textContent),
+      meta: [...b.querySelectorAll('.meta')].map(e => e.textContent),
+    }));
+    const src = SRC.toBase58();
+    const del = DELEGATE.toBase58();
+    expect(banners).toEqual([
+      {tone: 'danger', head: 'Assign / Allocate on your wallet account', body: ["This changes your wallet account itself. Assigned to another program, it is that program's to control; given data, it can no longer pay fees or send SOL."], meta: ['#2 system_program::Assign', `post-simulation · owner: ${P1} · space: 8`]},
+      {
+        tone: 'danger',
+        head: 'SetAuthority on an account you own',
+        body: ['This gives an authority over an account you own to another address, or removes it. You cannot take it back yourself.'],
+        meta: [`#3 spl_token::SetAuthority · authorityType: accountOwner · account: ${src} · newAuthority: —`, `post-simulation · close-authority: — → ${AUTH} · account: ${src}`],
+      },
+      {
+        tone: 'danger',
+        head: 'Unlimited token spend approval',
+        body: [
+          'This transaction includes a spl_token::Approve instruction with amount = u64::MAX (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move all your USDC, now and in the future, until you revoke.',
+          "This transaction includes a spl_token_2022::ApproveChecked instruction for amount = 250000000, at least this account's whole balance. Even verified dApps can be exploited; this lets the program move all of this token until you revoke.",
+          'The simulation shows a program call — not an instruction listed here — that lets a delegate move all of this token, now and in the future, until you revoke. Even verified dApps can be exploited.',
+        ],
+        meta: [`delegate: ${del} · token: USDC mint ${USDC} · scope: u64::MAX`, `delegate: ${del} · token: mint ${MINT} · scope: 250000000`, `delegate: ${del} · token: mint — · scope: u64::MAX`],
+      },
+      {tone: 'warn', head: 'This transaction does not expire.', body: [], meta: ['#1 system_program::AdvanceNonceAccount']},
+      {tone: 'warn', head: 'USDC spend approval', body: ['This lets a delegate move up to 5 USDC of your USDC until you revoke.'], meta: [`delegate: ${del} · token: USDC mint ${USDC} · scope: 5 USDC`]},
+      {tone: 'warn', head: 'Unknown program', body: ['The wallet cannot decode what this program does — only the simulation shows its effects.'], meta: [P1, 'a program the transaction does not name in its own keys']},
+      {tone: 'warn', head: 'Instructions that are not transfers', body: ['Each can do more than move a balance. Check what it does before approving.'], meta: ['#1 system_program::AdvanceNonceAccount', '#7 spl_token::unknown instruction']},
+      {
+        tone: 'warn',
+        head: 'Token-2022 settings on a token you hold',
+        body: ['Freeze authority — the issuer can freeze your account of this token.', 'Transfer hook — a program that runs on every transfer of this token.'],
+        meta: [`mint: ${MINT}`, `freezeAuthority: ${AUTH}`, `transferHookProgram: ${P1}`],
+      },
+      {tone: 'warn', head: "Could not read this token's settings", body: [], meta: [`mint: ${USDC}`]},
+      {tone: 'warn', head: 'Whole balance to a first-time address', body: ['All or nearly all of a balance goes to an address you have not sent to before.'], meta: []},
+    ]);
+    // The synthesized rows (an approve moves no balance): unlimited at u64::MAX, else the amount.
+    expect(texts('.s9-bal-row .pri')).toEqual(['USDC delegated', `${MINT.slice(0, 4)}…${MINT.slice(-4)} delegated`, `${src.slice(0, 4)}…${src.slice(-4)} delegated`, 'USDC delegated']);
+    expect(texts('.s9-bal-row .delta')).toEqual(['unlimited', '250000000', 'unlimited', '5']);
+    expect(texts('.s9-bal-row .fiat')).toEqual(['≈ all current + future', '≈ all current + future']);
+    expect(document.querySelector('.app-tx-none')).toBeNull();
+    // One field per block kind, in the flag order.
+    expect(texts('.s9-typed-confirm .label')).toEqual(['Type ASSIGN to enable Approve', 'Type AUTHORITY to enable Approve', 'Type UNLIMITED to enable Approve']);
+    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
+  });
+
+  it('the design’s typed-confirm and flag-banner rules, as extracted (design-ext.css), and the hand-written ones (app.css)', () => {
+    const designRule = (selector: string): string => {
+      const css = readFileSync(join(__dirname, '..', '..', 'styles', 'design-ext.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
+      const at = css.split('}').find(r => r.split('{')[0]?.split(',').some(sel => sel.trim() === selector));
+      return at === undefined ? '' : (at.split('{')[1] ?? '').replace(/\s+/g, ' ').trim();
+    };
+    expect(designRule('.s9-typed-confirm')).toContain('background: var(--bg-surface-2)');
+    expect(designRule('.s9-typed-confirm .label')).toContain('text-transform: uppercase');
+    expect(designRule('.s9-typed-confirm .input')).toContain('border: 1px solid color-mix(in oklab, var(--danger) 32%, transparent)');
+    expect(designRule('.s9-typed-confirm .input.match')).toBe('border-color: var(--success);');
+    expect(designRule('.s9-flag-banner.danger')).toContain('border: 1px solid color-mix(in oklab, var(--danger) 40%, transparent)');
+    expect(designRule('.s9-flag-banner.warn')).toContain('border-left: 3px solid var(--warning)');
+    expect(designRule('.s9-flag-banner .meta')).toContain('word-break: break-all');
+    expect(cssRule('.s9-typed-confirm .label code')).toContain('text-transform: none');
+    expect(cssRule('.s9-flag-banner.danger .body code')).toContain('color: var(--danger)');
+    expect(cssRule('.btn.app-cta-gated:disabled')).toContain('background: var(--bg-surface-3)');
+    expect(cssRule('.btn.app-cta-gated:disabled')).toContain('opacity: 1');
+  });
+});
````

`design-ext.css` is regenerated with `.s9-typed-confirm` added to the extractor's allowlist; the test names its rules and re-pins the hash:

`extension/src/__tests__/designExt2b.test.ts`:

````diff
diff --git a/extension/src/__tests__/designExt2b.test.ts b/extension/src/__tests__/designExt2b.test.ts
index 0b76ad0..24bdbd4 100644
--- a/extension/src/__tests__/designExt2b.test.ts
+++ b/extension/src/__tests__/designExt2b.test.ts
@@ -35,7 +35,14 @@ describe('design-ext.css (B1b-2b plan 1)', () => {
     }
   });
 
+  // B1c plan 3 re-ran the extraction with #48's typed-confirm added (ix:3856-3860).
+  it('carries #48’s typed-confirm (B1c plan 3)', () => {
+    for (const sel of ['.s9-typed-confirm', '.s9-typed-confirm .label', '.s9-typed-confirm .input', '.s9-typed-confirm .input.match', '.s9-typed-confirm .input.empty']) {
+      expect(CSS).toContain(`\n${sel} {`);
+    }
+  });
+
   it('is the extraction output, byte for byte (the hash the plan pins; scripts/extract-design-css.mjs --check against the design)', () => {
-    expect(createHash('sha256').update(CSS).digest('hex')).toBe('c91f92205f2d033d27dfe578e7d7515db37a0e240ddb0aca4752834c9551da44');
+    expect(createHash('sha256').update(CSS).digest('hex')).toBe('ccbae441c059119e3bc32e5b88909e2974dd4d374bdc4f89bff13a475de72f8a');
   });
 });
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx tsc --noEmit; echo $?` → `2` (one error: `src/approve/__tests__/tx.test.tsx(20,17): error TS2305: Module '"../useArmed"' has no exported member 'FLAG_HOLD_MS'.`). `npx vitest run src/approve/__tests__/tx.test.tsx src/__tests__/designExt2b.test.ts` → **Tests 9 failed | 28 passed (37)**: the seven new #48 tests (no banner: `Unable to find an element with the text: Unlimited USDC spend approval` / `Assign / Allocate on your wallet account` / `This step depends on step 2 …`; the every-kind test `expected [] to deeply equal [ { tone: 'danger', …(3) }, …(9) ]`; the CSS test `expected '' to contain 'background: var(--bg-surface-2)'`), and designExt2b's two (`to contain '\n.s9-typed-confirm {'`, the hash `c91f9220…` ≠ `ccbae441…`).

- [ ] **Step 3: Implement.**

The copy — every string the design, #37, B1 §3 or screen.md does not draw is a numbered controller Q (§10, below):

`extension/src/approve/strings.ts`:

````diff
diff --git a/extension/src/approve/strings.ts b/extension/src/approve/strings.ts
index ea76c85..282f24f 100644
--- a/extension/src/approve/strings.ts
+++ b/extension/src/approve/strings.ts
@@ -179,6 +179,81 @@ export const TX_TEXT = {
   ownAccount: (name: string): string => `Your account: ${name}`,
 } as const;
 
+/**
+ * B1c-3 (spec §3.3 rev 3.6 "The typed field", "Banners"; §10): #48's red flags — the design's own strings (state 2
+ * "unlimited-spend · typed-confirm", ix:18325-18396), #37's helper, B1 §3's ("This transaction does not expire."),
+ * screen.md §48's ("Unknown program"), Q32, Q34–Q39 and the controller's Q41–Q55 (each flagged to the owner in §10).
+ */
+export const FLAG_TEXT = {
+  /** The design's eyebrow (ix:18335). */
+  overlineUnlimited: 'Critical · Unlimited spend approval',
+  /** Q35. */
+  overlineBlocked: 'Critical · Blocked transaction',
+  /** The design's red CTA (ix:18390). */
+  approveUnlimited: 'Approve unlimited',
+  /** Q34. */
+  approveBlocked: 'Approve anyway',
+  /** The design's label (ix:18379): the word between, in a code span, in its true case. */
+  typed: ['Type ', ' to enable Approve'],
+  /** #37's helper (ix:~15000). */
+  typedHelp: 'Case-sensitive · must match exactly.',
+  /** F5 head: the design's (ix:18351); Q39's "token" when the wallet's table names no symbol. */
+  unlimitedHead: (symbol: string | null): string => (symbol === null ? 'Unlimited token spend approval' : `Unlimited ${symbol} spend approval`),
+  /** The design's "all your USDC" (ix:18352); Q41: "all of this token" when the wallet's table names no symbol. */
+  all: (symbol: string | null): string => (symbol === null ? 'all of this token' : `all your ${symbol}`),
+  /** F5, a decoded approve of u64::MAX: the design's body (ix:18352), the code span the real instruction (Q41). */
+  unlimitedMax: ['This transaction includes a ', ' instruction with ', 'amount = u64::MAX', ' (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move ', ', now and in the future, until you revoke.'],
+  /** Q42: F5, a decoded approve below u64::MAX that is at least the account's whole balance. */
+  unlimitedWhole: ['This transaction includes a ', ' instruction for ', ", at least this account's whole balance. Even verified dApps can be exploited; this lets the program move ", ' until you revoke.'],
+  /** Q43: F5 seen only in the simulation's chain state (a program call, no instruction listed). */
+  unlimitedChain: ['The simulation shows a program call — not an instruction listed here — that lets a delegate move ', ', now and in the future, until you revoke.', ' until you revoke.', ' Even verified dApps can be exploited.'],
+  /** Q44: F6's head. */
+  boundedHead: (symbol: string | null): string => (symbol === null ? 'Token spend approval' : `${symbol} spend approval`),
+  /** Q45: F6's body. */
+  bounded: (amount: string, symbol: string | null): string => `This lets a delegate move up to ${amount} ${symbol === null ? 'of this token' : `of your ${symbol}`} until you revoke.`,
+  /** The design's meta (ix:18353) — every address whole, in groups (Q55). */
+  meta: {delegate: 'delegate: ', token: ' · token: ', mint: 'mint ', scope: ' · scope: ', max: 'u64::MAX'},
+  /** The design's synthesized balance row (ix:18361-18363); a bounded amount as spec §3.3 says. */
+  delegated: (name: string): string => `${name} delegated`,
+  unlimited: 'unlimited',
+  allFuture: '≈ all current + future',
+  /** Q37 (F3's #10 row, reused as the banner head) and Q46. */
+  assignHead: 'Assign / Allocate on your wallet account',
+  assign: "This changes your wallet account itself. Assigned to another program, it is that program's to control; given data, it can no longer pay fees or send SOL.",
+  /** Q38 (F4's #10 row, reused as the banner head) and Q47. */
+  authorityHead: 'SetAuthority on an account you own',
+  authority: 'This gives an authority over an account you own to another address, or removes it. You cannot take it back yourself.',
+  /** Q32: F10's head. */
+  dependsOn: (step: number): string => `This step depends on step ${step} and could not be checked on its own.`,
+  /** Q48: F10's body. */
+  dependent: (step: number): string => `Its effects are unknown: it was simulated without the changes step ${step} makes, which it needs.`,
+  /** Q49: F10's balance card. */
+  balanceUnknown: 'Balance changes (unknown)',
+  balanceUnknownLine: 'This step was not simulated on its own, so its effects are unknown.',
+  /** screen.md §48 ("Unknown program") and Q50. */
+  unknownHead: 'Unknown program',
+  unknown: 'The wallet cannot decode what this program does — only the simulation shows its effects.',
+  unknownNull: 'a program the transaction does not name in its own keys',
+  /** Q51: F2. */
+  nonTransferHead: 'Instructions that are not transfers',
+  nonTransfer: 'Each can do more than move a balance. Check what it does before approving.',
+  /** Q52: F7, per mint; Q36 when the mint cannot be read. */
+  token2022Head: 'Token-2022 settings on a token you hold',
+  freeze: 'Freeze authority — the issuer can freeze your account of this token.',
+  permanentDelegate: 'Permanent delegate — an address that can move or burn this token from any account, yours included.',
+  transferHook: 'Transfer hook — a program that runs on every transfer of this token.',
+  unreadable: "Could not read this token's settings",
+  /** B1 §3 ("this transaction does not expire", capitalised). */
+  nonce: 'This transaction does not expire.',
+  /** Q53: F9. */
+  wholeHead: 'Whole balance to a first-time address',
+  whole: 'All or nearly all of a balance goes to an address you have not sent to before.',
+  /** Q54: L3's line, replaced beside an authority flag (F3, F4) when nothing else moves. */
+  noChangesAuthority: 'No SOL or token balance changes — but this transaction changes who controls an account of yours (above).',
+  /** Q55: the banners' meta — the instruction (`#<n> <program>::<Instruction>`), the simulation's chain state. */
+  postSimulation: 'post-simulation',
+} as const;
+
 /** #48's origin-mismatch · auto-reject (ix:18484-18521), as drawn — "Settings → dApps" reads Settings → Connected dApps (Q03, D1). */
 export const MISMATCH_TEXT = {
   overline: 'Auto-rejected · Origin mismatch',
````

`extension/src/approve/useArmed.ts`:

````diff
diff --git a/extension/src/approve/useArmed.ts b/extension/src/approve/useArmed.ts
index ec0cae5..12d787d 100644
--- a/extension/src/approve/useArmed.ts
+++ b/extension/src/approve/useArmed.ts
@@ -2,6 +2,8 @@ import {useEffect, useState} from 'react';
 
 /** C15: a confirming CTA is held this long after the window gains focus and after each state change. */
 export const ARM_MS = 500;
+/** B1 §3 (spec §3.3 rev 3.6 "Holds"): on any screen with a red flag, a confirming CTA is held this long instead. */
+export const FLAG_HOLD_MS = 1_500;
 
 /**
  * C15 (review 1 M12, review 2 L8): false for ARM_MS after mount, after every change of `state` (an ack toggled, the
````

`extension/src/approve/ui.tsx`:

````diff
diff --git a/extension/src/approve/ui.tsx b/extension/src/approve/ui.tsx
index fa5b85f..498bf32 100644
--- a/extension/src/approve/ui.tsx
+++ b/extension/src/approve/ui.tsx
@@ -4,7 +4,7 @@ import {LockedButton} from '../app/ui/LockedButton';
 import {Sheet} from '../app/ui/Sheet';
 import type {Site} from './client';
 import {WINDOW_TEXT} from './strings';
-import {useArmed} from './useArmed';
+import {ARM_MS, useArmed} from './useArmed';
 
 /**
  * The approval window's shared pieces (spec §3.1, §3.2, §4.3): the top bar (✕ = Reject), the origin card, the lookalike
@@ -141,10 +141,11 @@ export function ConfirmButton({armed, onPress, className, children}: {armed: boo
 
 /** The design's 2-second confirm (#46 E; §3.1, §3.2 step 5): only "I understand the risk" proceeds, enabled after 2 s. */
 export const CONFIRM_DELAY_MS = 2_000;
-export function RiskConfirm({onCancel, onProceed, delay = CONFIRM_DELAY_MS}: {onCancel: () => void; onProceed: () => Promise<unknown> | void; delay?: number}) {
+export function RiskConfirm({onCancel, onProceed, delay = CONFIRM_DELAY_MS, holdMs = ARM_MS}: {onCancel: () => void; onProceed: () => Promise<unknown> | void; delay?: number; holdMs?: number}) {
   const [ready, setReady] = useState(false);
-  // C15 inside the sheet too (review 1 L4): held 500 ms again whenever the window regains focus.
-  const armed = useArmed('risk-confirm');
+  // C15 inside the sheet too (review 1 L4): held 500 ms again whenever the window regains focus — B1c-3: 1.5 s on a
+  // screen with a red flag (`holdMs`, the caller's).
+  const armed = useArmed('risk-confirm', holdMs);
   useEffect(() => {
     const t = setTimeout(() => setReady(true), delay);
     return () => clearTimeout(t);
````

#48 itself:

`extension/src/approve/Tx.tsx`:

````diff
diff --git a/extension/src/approve/Tx.tsx b/extension/src/approve/Tx.tsx
index b973b8a..aec9f92 100644
--- a/extension/src/approve/Tx.tsx
+++ b/extension/src/approve/Tx.tsx
@@ -1,4 +1,4 @@
-import {useEffect, useRef, useState, type ReactNode} from 'react';
+import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
 import {AddressGroups} from '../../../web/src/ui/AddressGroups';
 import {ExtIcon} from '../app/ui/ExtIcon';
 import {LockedButton} from '../app/ui/LockedButton';
@@ -6,10 +6,10 @@ import {SkelCircle, SkelLine} from '../app/ui/Skeleton';
 import {feeUsd, shortAddress, showSol} from '../app/format';
 import {fromBook} from '../app/addressBook';
 import {formatAmount} from '../shared/amount';
-import type {AddressLabel, BalanceChange, Decision, DecodedInstruction, FieldValue, ProgramKey, RequestView, TxDetail, TxItem} from './client';
+import {dependsOnStep, type AddressLabel, type Approval, type BalanceChange, type Decision, type DecodedInstruction, type FieldValue, type Flag, type ProgramKey, type RequestView, type TxDetail, type TxItem} from './client';
 import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop, siteLabel} from './ui';
-import {useArmed} from './useArmed';
-import {SIGN_TEXT, TX_TEXT, WINDOW_TEXT} from './strings';
+import {ARM_MS, FLAG_HOLD_MS, useArmed} from './useArmed';
+import {FLAG_TEXT, SIGN_TEXT, TX_TEXT, WINDOW_TEXT} from './strings';
 
 /** The design's mono program names (#48: "jupiter_v6", "spl_token"), for the programs the wallet decodes. */
 const PROGRAM_NAMES: Record<ProgramKey, string> = {
@@ -51,6 +51,32 @@ function changeRow(c: BalanceChange): {key: string; tile: string; tileText: stri
   };
 }
 
+const U64_MAX = '18446744073709551615';
+const TILES: Readonly<Record<string, string>> = {NOC: 'noc', USDC: 'usdc', USDT: 'usdt'};
+/** An approval's amount as the user reads it: with the mint's decimals and the wallet's symbol when known, else base units. */
+const approvalAmount = (a: Approval): string => {
+  const value = a.decimals === null ? a.amount : formatAmount(BigInt(a.amount), a.decimals, {min: 0, max: a.decimals});
+  return a.symbol === null ? value : `${value} ${a.symbol}`;
+};
+const approvalsOf = (item: TxItem): Approval[] => (item.flags ?? []).flatMap(f => (f.kind === 'unlimited-approve' || f.kind === 'bounded-approve' ? f.approvals : []));
+
+/**
+ * B1c-3 (spec §3.3 "Banners", the design's ix:18358-18364): an approve changes no balance, so its row is synthesized from
+ * the flag — "<SYM> delegated", "unlimited" / "≈ all current + future" at u64::MAX, else the amount.
+ */
+function delegatedRow(a: Approval): {key: string; tile: string; tileText: string; name: string; delta: string; neg: boolean; fiat: string | null} {
+  const known = a.symbol === null ? undefined : TILES[a.symbol];
+  const max = a.amount === U64_MAX;
+  return {
+    key: `delegated:${a.source}`,
+    tile: known === undefined ? 'ico app-tok-other' : `ico s8-tok ${known}`,
+    tileText: a.symbol ?? '?',
+    name: FLAG_TEXT.delegated(a.symbol ?? shortAddress(a.mint ?? a.source)),
+    delta: max ? FLAG_TEXT.unlimited : (a.decimals === null ? a.amount : formatAmount(BigInt(a.amount), a.decimals, {min: 0, max: a.decimals})),
+    neg: true,
+    fiat: max ? FLAG_TEXT.allFuture : null,
+  };
+}
 function BalanceCard({item, simulating}: {item: TxItem; simulating: boolean}) {
   if (simulating || item.outcome === null) {
     return (
@@ -66,17 +92,27 @@ function BalanceCard({item, simulating}: {item: TxItem; simulating: boolean}) {
       </div>
     );
   }
+  // F10 (Q49): a step that depends on an earlier one was not simulated on its own — its effects are unknown, said so.
+  if (!item.outcome.ok && item.outcome.error === 'dependent') {
+    return (
+      <div className="s9-bal-card">
+        <span className="label">{FLAG_TEXT.balanceUnknown}</span>
+        <p className="noc-body-sm app-dim app-tx-none">{FLAG_TEXT.balanceUnknownLine}</p>
+      </div>
+    );
+  }
   if (!item.outcome.ok) return null;
-  const rows = item.outcome.changes.map(changeRow);
+  const rows = [...approvalsOf(item).map(delegatedRow), ...item.outcome.changes.map(changeRow)];
+  const authority = (item.flags ?? []).some(f => f.kind === 'assign' || f.kind === 'set-authority');
   return (
     <div className="s9-bal-card">
       <span className="label">{TX_TEXT.balancePost}</span>
-      {rows.length === 0 ? <p className="noc-body-sm app-dim app-tx-none">{TX_TEXT.noChanges}</p> : null}
+      {rows.length === 0 ? <p className="noc-body-sm app-dim app-tx-none">{authority ? FLAG_TEXT.noChangesAuthority : TX_TEXT.noChanges}</p> : null}
       {rows.map(r => (
         <div className="s9-bal-row" key={r.key}>
           <div className={r.tile}>{r.tileText}</div>
           <div>
-            <div className={r.name === r.tileText ? 'pri' : 'pri noc-mono'}>{r.name}</div>
+            <div className={r.name === r.tileText || r.name === FLAG_TEXT.delegated(r.tileText) ? 'pri' : 'pri noc-mono'}>{r.name}</div>
           </div>
           <div>
             <div className={`delta noc-numeral ${r.neg ? 'neg' : 'pos'}`}>{r.delta}</div>
@@ -184,6 +220,242 @@ function Payload({item, labels}: {item: TxItem; labels: readonly AddressLabel[]}
   );
 }
 
+/** An instruction as the banners name it, the design's way (ix:18352 `spl_token::Approve`): program, then the instruction's own name. */
+function instructionName(item: TxItem, at: number | null): string | null {
+  const ix = at === null ? undefined : item.instructions?.[at];
+  if (ix === undefined || ix.program === null) return null;
+  const name = ix.name === null ? TX_TEXT.unknownInstruction : `${ix.name.charAt(0).toUpperCase()}${ix.name.slice(1)}`;
+  return `${PROGRAM_NAMES[ix.program]}::${name}`;
+}
+/** A meta line's instruction (Q55): "#<n> <program>::<Instruction>", n 1-based as "Program <n>" counts. */
+const instructionMeta = (item: TxItem, at: number): string => `#${at + 1} ${instructionName(item, at) ?? TX_TEXT.unknownInstruction}`;
+const Addr = ({address}: {address: string | null}) => (address === null ? <>—</> : <AddressGroups address={address} />);
+
+function FlagBanner({tone, head, body, meta}: {tone: 'danger' | 'warn'; head: ReactNode; body?: ReactNode[]; meta?: ReactNode[]}) {
+  return (
+    <div className={`s9-flag-banner ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
+      <ExtIcon name="alert-triangle" size={18} />
+      <div>
+        <p className="head">{head}</p>
+        {(body ?? []).map((b, i) => (
+          <p className="body" key={i}>
+            {b}
+          </p>
+        ))}
+        {(meta ?? []).map((m, i) => (
+          <p className="meta" key={i}>
+            {m}
+          </p>
+        ))}
+      </div>
+    </div>
+  );
+}
+
+/** The design's meta line (ix:18353): "delegate: … · token: USDC mint … · scope: u64::MAX" — every address whole (Q55). */
+const approvalMeta = (a: Approval): ReactNode => (
+  <>
+    {FLAG_TEXT.meta.delegate}
+    <Addr address={a.delegate} />
+    {FLAG_TEXT.meta.token}
+    {a.symbol === null ? '' : `${a.symbol} `}
+    {FLAG_TEXT.meta.mint}
+    <code>
+      <Addr address={a.mint} />
+    </code>
+    {FLAG_TEXT.meta.scope}
+    {a.amount === U64_MAX ? FLAG_TEXT.meta.max : approvalAmount(a)}
+  </>
+);
+
+/** F5's body: the design's at u64::MAX (decoded), Q42 below it, Q43 when only the chain state shows it. */
+function unlimitedBody(item: TxItem, a: Approval): ReactNode {
+  const all = <i>{FLAG_TEXT.all(a.symbol)}</i>;
+  const ix = instructionName(item, a.at);
+  if (ix === null) {
+    const [lead, future, untilRevoke, exploited] = FLAG_TEXT.unlimitedChain;
+    return (
+      <>
+        {lead}
+        {all}
+        {a.amount === U64_MAX ? future : untilRevoke}
+        {exploited}
+      </>
+    );
+  }
+  if (a.amount === U64_MAX) {
+    const [lead, withAmount, max, units, end] = FLAG_TEXT.unlimitedMax;
+    return (
+      <>
+        {lead}
+        <code>{ix}</code>
+        {withAmount}
+        <code>{max}</code>
+        {units}
+        {all}
+        {end}
+      </>
+    );
+  }
+  const [lead, forAmount, whole, end] = FLAG_TEXT.unlimitedWhole;
+  return (
+    <>
+      {lead}
+      <code>{ix}</code>
+      {forAmount}
+      <code>{`amount = ${a.amount}`}</code>
+      {whole}
+      {all}
+      {end}
+    </>
+  );
+}
+
+/** One flag's banner (spec §3.3 "Banners"): a block `.s9-flag-banner danger`, a warning `warn`; head, body, meta. */
+function flagBanner(item: TxItem, f: Flag, key: number): ReactNode {
+  switch (f.kind) {
+    case 'unlimited-approve':
+      return (
+        <FlagBanner key={key} tone="danger" head={FLAG_TEXT.unlimitedHead(f.word === 'UNLIMITED' ? null : f.word)} body={f.approvals.map(a => unlimitedBody(item, a))} meta={f.approvals.map(approvalMeta)} />
+      );
+    case 'bounded-approve':
+      return (
+        <FlagBanner key={key} tone="warn" head={FLAG_TEXT.boundedHead(f.approvals.length === 1 ? (f.approvals[0]?.symbol ?? null) : null)} body={f.approvals.map(a => FLAG_TEXT.bounded(approvalAmount(a), a.symbol))} meta={f.approvals.map(approvalMeta)} />
+      );
+    case 'assign':
+      return (
+        <FlagBanner
+          key={key}
+          tone="danger"
+          head={FLAG_TEXT.assignHead}
+          body={[FLAG_TEXT.assign]}
+          meta={[
+            ...f.instructions.map(ix => instructionMeta(item, ix.index)),
+            ...(f.chain === null
+              ? []
+              : [
+                  <>
+                    {`${FLAG_TEXT.postSimulation} · owner: `}
+                    <Addr address={f.chain.owner} />
+                    {` · space: ${f.chain.space}`}
+                  </>,
+                ]),
+          ]}
+        />
+      );
+    case 'set-authority':
+      return (
+        <FlagBanner
+          key={key}
+          tone="danger"
+          head={FLAG_TEXT.authorityHead}
+          body={[FLAG_TEXT.authority]}
+          meta={[
+            ...f.instructions.map(ix => (
+              <>
+                {`${instructionMeta(item, ix.index)} · authorityType: ${ix.authorityType} · account: `}
+                <Addr address={ix.account} />
+                {' · newAuthority: '}
+                <Addr address={ix.newAuthority} />
+              </>
+            )),
+            ...f.chain.map(c => (
+              <>
+                {`${FLAG_TEXT.postSimulation} · ${c.change}: `}
+                <Addr address={c.from} />
+                {' → '}
+                <Addr address={c.to} />
+                {' · account: '}
+                <Addr address={c.account} />
+              </>
+            )),
+          ]}
+        />
+      );
+    case 'dependent': {
+      // Q32's <N>: only through dependsOnStep (client.ts) — never the outcome's `on` or a flag index read raw.
+      const step = dependsOnStep(item);
+      if (step === null) return null;
+      return <FlagBanner key={key} tone="danger" head={FLAG_TEXT.dependsOn(step)} body={[FLAG_TEXT.dependent(step)]} meta={item.outcome !== null && !item.outcome.ok ? [item.outcome.detail] : []} />;
+    }
+    case 'unknown-program':
+      return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.unknownHead} body={[FLAG_TEXT.unknown]} meta={f.programs.map(p => (p === null ? FLAG_TEXT.unknownNull : <AddressGroups address={p} />))} />;
+    case 'non-transfer':
+      return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.nonTransferHead} body={[FLAG_TEXT.nonTransfer]} meta={f.instructions.map(ix => instructionMeta(item, ix.index))} />;
+    case 'token-2022': {
+      const mint = (
+        <>
+          {'mint: '}
+          <AddressGroups address={f.mint} />
+        </>
+      );
+      if (f.settings === null) return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.unreadable} meta={[mint]} />;
+      const s = f.settings;
+      const lines: [string, string, string | null][] = [
+        [FLAG_TEXT.freeze, 'freezeAuthority', s.freezeAuthority],
+        [FLAG_TEXT.permanentDelegate, 'permanentDelegate', s.permanentDelegate],
+        [FLAG_TEXT.transferHook, 'transferHookProgram', s.transferHookProgram],
+      ];
+      const set = lines.filter((l): l is [string, string, string] => l[2] !== null);
+      return (
+        <FlagBanner
+          key={key}
+          tone="warn"
+          head={FLAG_TEXT.token2022Head}
+          body={set.map(l => l[0])}
+          meta={[
+            mint,
+            ...set.map(l => (
+              <>
+                {`${l[1]}: `}
+                <AddressGroups address={l[2]} />
+              </>
+            )),
+          ]}
+        />
+      );
+    }
+    case 'durable-nonce':
+      return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.nonce} meta={[instructionMeta(item, f.at)]} />;
+    case 'whole-balance':
+      return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.wholeHead} body={[FLAG_TEXT.whole]} />;
+  }
+}
+
+/** A transaction's banners: its blocks first, then its warnings (spec §3.3 "Banners"), each as the background listed it. */
+function FlagBanners({item}: {item: TxItem}) {
+  const flags = item.flags ?? [];
+  const ordered = [...flags.filter(f => f.severity === 'block'), ...flags.filter(f => f.severity === 'warn')];
+  return <>{ordered.map((f, i) => flagBanner(item, f, i))}</>;
+}
+
+/** One block's typed field (spec §3.3 "The typed field"; the design's `.s9-typed-confirm`, ix:18378-18381). */
+export interface TypedField {
+  key: string;
+  tx: number;
+  word: string;
+}
+function TypedConfirm({field, value, onChange}: {field: TypedField; value: string; onChange: (v: string) => void}) {
+  const id = useId();
+  const [lead, tail] = FLAG_TEXT.typed;
+  return (
+    <div className="s9-typed-confirm">
+      <label className="label" htmlFor={id}>
+        {lead}
+        <code>{field.word}</code>
+        {tail}
+      </label>
+      {/* Never pre-filled, never focused at open; an exact, case-sensitive match — no trimming, no case folding. */}
+      <input id={id} className={value === field.word ? 'input match' : 'input'} value={value} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} onChange={e => onChange(e.target.value)} />
+      <p className="noc-caption app-dim app-typed-help">{FLAG_TEXT.typedHelp}</p>
+    </div>
+  );
+}
+
+/** Every block's field: one per (transaction, kind) — `tx` the 0-based index the background reads (Task 4). */
+const typedFieldsOf = (d: TxDetail | null): TypedField[] =>
+  (d?.transactions ?? []).flatMap((t, tx) => (t.flags ?? []).flatMap(f => (f.severity === 'block' ? [{key: `${tx}:${f.kind}`, tx, word: f.word}] : [])));
+
 type TxState = 'simulating' | 'ready' | 'failed' | 'expired' | 'unreachable';
 function stateOf(d: TxDetail | null): TxState | null {
   if (d === null) return null;
@@ -191,7 +463,8 @@ function stateOf(d: TxDetail | null): TxState | null {
   if (d.simulation.status === 'unreachable') return 'unreachable';
   const outcomes = d.transactions.map(t => t.outcome);
   if (outcomes.some(o => o !== null && !o.ok && o.error === 'expired')) return 'expired';
-  if (outcomes.some(o => o === null || !o.ok)) return 'failed';
+  // B1c-3 (F10, O2): a step that depends on an earlier one is no failure here — its own block (UNCHECKED) gates it.
+  if (outcomes.some(o => o === null || (!o.ok && o.error !== 'dependent'))) return 'failed';
   return 'ready';
 }
 
@@ -205,14 +478,20 @@ function stateOf(d: TxDetail | null): TxState | null {
  *    a lookalike's screen vouches for nothing); a batch shows each transaction's section, approved as a whole;
  *  - re-authentication (B1b's rules, through #10 — reached from the Noctura icon, D11): a line before Approve asks
  *    for it; after Approve asked, the banner says where, and Approve waits until the background says it is proven;
- *  - couldn't simulate / unreachable / blockhash expired (Q21): only Reject (B1c-3 adds the red-flag override);
+ *  - couldn't simulate / unreachable / blockhash expired (Q21): only Reject — a step that depends on an earlier one
+ *    of the batch (F10, O2) excepted: it is a block of its own (B1c-3);
  *  - lookalike: the banner and the flipped bar — [Reject and report], "Approve anyway (not recommended)" → the
  *    2-second confirm;
  *  - approving: "Approving", the body at .65, "Approving…" with the ring, every CTA and ✕ disabled;
  *  - the request can no longer be signed (`tx` null): Q26 and only Reject.
- * B1c-3 builds the red-flag blocks, the typed-confirm override and the unlimited-spend state.
+ * B1c-3 (spec §3.3 rev 3.6) renders the background's red flags in each transaction's section — blocks first, then
+ * warnings — with one typed field per (transaction, block kind); the CTA is the design's red "Approve unlimited" for
+ * unlimited approves only, "Approve anyway" (Q34) for any other block, greyed as #37's until every field matches, and
+ * the approval sends the matched words (`overrides`). A lookalike origin with a block passes both gates: the typed
+ * fields enable its demoted "Approve anyway (not recommended)", which then opens the 2-second confirm.
  * C15 holds Approve (and its demoted forms) 500 ms after focus and after each state change — the request, a new
- * simulation, the re-authentication's state, busy; Reject is never held.
+ * simulation, the re-authentication's state, busy, every typed field's match; on a screen with any flag, 1.5 s (B1 §3).
+ * Reject is never held.
  */
 export function Tx({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
   const detail = request.tx;
@@ -226,7 +505,13 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
   // landed) — that line is true only while that simulation is the one shown, so it goes when the refresh lands.
   const [refused, setRefused] = useState<{kind: 'stale' | 'out-of-date'; simId: string} | null>(null);
   const simId = detail !== null && detail.simulation.status === 'ok' ? detail.simulation.id : 'none';
-  const armed = useArmed([request.requestId, simId, detail?.reauth?.state ?? 'none', confirming, busy].join('|'));
+  // B1c-3: what the user typed per (transaction, kind); a match is exact — `===`, no trimming, no case folding.
+  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
+  const fields = typedFieldsOf(detail);
+  const matches = fields.map(f => typed[f.key] === f.word);
+  const allMatch = matches.every(m => m);
+  const flagged = (detail?.transactions ?? []).some(t => (t.flags ?? []).length > 0);
+  const armed = useArmed([request.requestId, simId, detail?.reauth?.state ?? 'none', confirming, busy, matches.map(m => (m ? 1 : 0)).join('')].join('|'), flagged ? FLAG_HOLD_MS : ARM_MS);
   const reject = () => onDecide({decision: 'reject'});
   // Promoted minor 1: a reply arriving after this screen is gone (a new head replaced it, or it closed) sets nothing.
   const alive = useRef(true);
@@ -247,7 +532,7 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
   const simulating = state === 'simulating';
   const ready = state === 'ready';
   const reauthWaiting = detail?.reauth?.state === 'waiting';
-  const canApprove = ready && !reauthWaiting && !busy;
+  const canApprove = ready && !reauthWaiting && !busy && allMatch;
   // Fix round 1, I2: the sheet is for exactly the simulation it opened on — a refresh that lands while it is open
   // (simId no longer matches what was captured, or canApprove itself goes false) closes it; a captured click that
   // still slips past that (the background is the final, fail-closed word) is refused `stale`, never signed.
@@ -283,7 +568,9 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
   const approve = async (overrideSimId?: string) => {
     setRefused(null);
     const sentSimId = overrideSimId ?? (detail.simulation.status === 'ok' ? detail.simulation.id : undefined);
-    const reply = await onDecide({decision: 'approve', account: detail.account.publicKey, ...(sentSimId !== undefined ? {simulation: sentSimId} : {})});
+    // B1c-3: the words of the fields that match, and only those (the background recomputes every expected word).
+    const overrides = fields.flatMap(f => (typed[f.key] === f.word ? [{tx: f.tx, word: typed[f.key] ?? ''}] : []));
+    const reply = await onDecide({decision: 'approve', account: detail.account.publicKey, ...(sentSimId !== undefined ? {simulation: sentSimId} : {}), ...(overrides.length > 0 ? {overrides} : {})});
     if (!alive.current) return;
     const error = typeof reply === 'object' && reply !== null && 'error' in reply ? reply.error : null;
     if (error === 'stale' || error === 'out-of-date') setRefused({kind: error, simId: sentSimId ?? 'none'});
@@ -291,10 +578,13 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
   const stale = refused !== null && refused.kind === 'stale';
   const outOfDate = refused !== null && refused.kind === 'out-of-date' && refused.simId === simId;
   const n = detail.transactions.length;
-  const overline = busy ? TX_TEXT.overlineApproving : lookalike ? TX_TEXT.overlineLookalike : TX_TEXT.overline;
+  const blocks = ready ? detail.transactions.flatMap(t => (t.flags ?? []).filter(f => f.severity === 'block')) : [];
+  // The design's red "Approve unlimited" (and its eyebrow) only when every block is an unlimited approve.
+  const unlimitedOnly = blocks.length > 0 && blocks.every(f => f.kind === 'unlimited-approve');
+  const overline = busy ? TX_TEXT.overlineApproving : unlimitedOnly ? FLAG_TEXT.overlineUnlimited : blocks.length > 0 ? FLAG_TEXT.overlineBlocked : lookalike ? TX_TEXT.overlineLookalike : TX_TEXT.overline;
   return (
     <div className="screen app-approve">
-      <WindowTop overline={overline} tone={!busy && lookalike ? 'danger' : 'neutral'} onClose={reject} disabled={busy || simulating} />
+      <WindowTop overline={overline} tone={!busy && (lookalike || blocks.length > 0) ? 'danger' : 'neutral'} onClose={reject} disabled={busy || simulating} />
       <div className={busy ? 'scroll-area app-approve-scroll app-tx-busy' : 'scroll-area app-approve-scroll'}>
         {notice ? <BudgetNotice /> : null}
         <div className="app-origin-slot">
@@ -353,8 +643,14 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
         {detail.transactions.map((t, i) => (
           <section className="app-tx-item" key={i}>
             {n > 1 ? <h2 className="noc-overline app-tx-batch">{TX_TEXT.batchItem(i + 1, n)}</h2> : null}
+            <FlagBanners item={t} />
             {state === 'failed' || state === 'expired' || state === 'unreachable' ? null : <BalanceCard item={t} simulating={simulating} />}
             <Payload item={t} labels={detail.labels} />
+            {ready
+              ? fields
+                  .filter(f => f.tx === i)
+                  .map(f => <TypedConfirm key={f.key} field={f} value={typed[f.key] ?? ''} onChange={v => setTyped(prev => ({...prev, [f.key]: v}))} />)
+              : null}
           </section>
         ))}
         {simulating ? <p className="noc-caption app-dim app-tx-caption">{TX_TEXT.mandatory}</p> : null}
@@ -411,6 +707,13 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
               <Spinner />
               {TX_TEXT.approving}
             </button>
+          ) : blocks.length > 0 ? (
+            // B1c-3: the design's red CTA (ix:18390) for an unlimited approve, Q34 for any other block; #37's greyed
+            // gate (full label, no opacity wash) until every typed field matches.
+            <ConfirmButton armed={armed && canApprove} className={allMatch ? 'btn btn-destructive app-cta-wide' : 'btn btn-destructive app-cta-wide app-cta-gated'} onPress={() => approve()}>
+              {unlimitedOnly ? <ExtIcon name="alert-triangle" size={18} /> : null}
+              {unlimitedOnly ? FLAG_TEXT.approveUnlimited : FLAG_TEXT.approveBlocked}
+            </ConfirmButton>
           ) : (
             // Final review MUST-FIX 2: drawn at .4 while simulating (ix:18318) — its own class, in that state only.
             <ConfirmButton armed={armed && canApprove} className={simulating ? 'btn btn-primary app-cta-wide app-cta-simulating' : 'btn btn-primary app-cta-wide'} onPress={approve}>
@@ -422,6 +725,7 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
       )}
       {confirming ? (
         <RiskConfirm
+          holdMs={flagged ? FLAG_HOLD_MS : ARM_MS}
           onCancel={() => setConfirming(false)}
           onProceed={async () => {
             // I2: the effect above already closes this sheet the instant either goes stale; this is the backstop —
````

The hand-written rules (the design's inline code-span styles as rules, the word's true case, the helper, #37's gate for the red CTA):

`extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 3a08a6d..257d061 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1047,7 +1047,9 @@ a.btn {
   letter-spacing: 0.16em;
 }
 /* 37a/37b: the gated CTA greyed at full opacity (ix:15000: --bg-surface-3, --fg-disabled, opacity 1). */
-.btn.app-delete-gated:disabled {
+/* B1c-3: #48's red CTA behind its typed fields takes #37's gated look (spec §3.3 "The typed field"). */
+.btn.app-delete-gated:disabled,
+.btn.app-cta-gated:disabled {
   background: var(--bg-surface-3);
   color: var(--fg-disabled);
   opacity: 1;
@@ -2001,6 +2003,25 @@ body:has(.app-window) {
   margin-inline-start: 4px;
   white-space: nowrap;
 }
+/*
+ * B1c-3: #48's red flags (spec §3.3 rev 3.6). The design's code spans (ix:18352, 18379: `font-family:var(--font-mono);
+ * color:var(--danger)` inline) as rules; the typed field's word keeps its true case under the label's uppercase.
+ */
+.s9-flag-banner .body code,
+.s9-flag-banner .meta code {
+  font-family: var(--font-mono);
+}
+.s9-flag-banner.danger .body code {
+  color: var(--danger);
+}
+.s9-typed-confirm .label code {
+  font-family: var(--font-mono);
+  color: var(--danger);
+  text-transform: none;
+}
+.app-typed-help {
+  margin: 0;
+}
 /* #48 mismatch detail (ix:18504-18507): the session in --success, the request and the verdict in --danger — the card's
    own `.row .v` colour (three classes) outranks the one-class tone. */
 .s9-payload-card .row .v.noc-success {
````

The extractor's allowlist, then `node scripts/extract-design-css.mjs` (writes `design-ext.css`; never edited by hand) and `node scripts/extract-design-css.mjs --check` → `design-ext.css is the extraction output`:

`extension/scripts/extract-design-css.mjs`:

````diff
diff --git a/extension/scripts/extract-design-css.mjs b/extension/scripts/extract-design-css.mjs
index f1757bc..63773cc 100644
--- a/extension/scripts/extract-design-css.mjs
+++ b/extension/scripts/extract-design-css.mjs
@@ -35,6 +35,8 @@ export const PREFIXES = ['.screen', '.top-bar', '.sticky-bar', '.scroll-area', '
   '.s9-scope-card', '.s9-scope-row', '.s9-flag-banner', '.s9-ack-row', '.s9-gate-status', '.s10-',
   // B1c plan 2: #48 (ix:3824-3837, 3854-3859) and the OriginBadge of #26/#27 (ix:4080-4084).
   '.s9-sim-banner', '.s9-bal-card', '.s9-bal-row', '.s9-origin-pill', '.origin-badge',
+  // B1c plan 3: #48's typed-confirm (ix:3856-3860).
+  '.s9-typed-confirm',
 ];
 export const KEYFRAMES = ['shimmer', 'spin', 'shake',
   // Plan 3: what the send-flow rules animate with (#19's progress strip and skeleton, #21's ring and status dot, #54's ring; #20's caret — its rule comes with .s-conf, the typed field does not, D22).
````

The generated result (for review):

`extension/src/styles/design-ext.css`:

````diff
diff --git a/extension/src/styles/design-ext.css b/extension/src/styles/design-ext.css
index 434e742..ef3c418 100644
--- a/extension/src/styles/design-ext.css
+++ b/extension/src/styles/design-ext.css
@@ -1737,6 +1737,11 @@
 .s9-flag-banner.danger .head { color: var(--danger); }
 .s9-flag-banner .body { font-size: 12px; line-height: 16px; color: var(--fg-secondary); margin: 4px 0 0; }
 .s9-flag-banner .meta { font-family: var(--font-mono); font-size: 11px; color: var(--fg-tertiary); margin-top: 4px; word-break: break-all; }
+.s9-typed-confirm { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); background: var(--bg-surface-2); border-radius: var(--radius-md); margin-top: var(--space-2); }
+.s9-typed-confirm .label { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--danger); }
+.s9-typed-confirm .input { padding: 10px 14px; background: var(--bg-base); border: 1px solid color-mix(in oklab, var(--danger) 32%, transparent); border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 16px; line-height: 22px; font-weight: 600; color: var(--fg-primary); letter-spacing: 0.05em; min-height: 48px; display: flex; align-items: center; }
+.s9-typed-confirm .input.match { border-color: var(--success); }
+.s9-typed-confirm .input.empty { color: var(--fg-tertiary); font-weight: 400; }
 .s9-origin-pill { display: flex; align-items: center; gap: var(--space-2); padding: 8px 12px; background: var(--bg-surface-2); border-radius: var(--radius-md); }
 .s9-origin-pill .dot { width: 6px; height: 6px; border-radius: 50%; }
 .s9-origin-pill .dot.ok   { background: var(--success); }
````

The spec — §3.3 (two lines) and §10 (Q41–Q55):

`docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md`:

````diff
diff --git a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
index 5d55641..c679008 100644
--- a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
+++ b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
@@ -651,7 +651,9 @@ proxy (`getMultipleAccounts`). The window only renders the flags stored with the
 - **The typed field** is the design's `.s9-typed-confirm`: the label "Type <code>WORD</code> to enable Approve" (the
   design's), the word shown in its true case; the input with `autocapitalize`, `autocomplete`, `autocorrect` and
   `spellcheck` off, an exact, case-sensitive match with no trimming (a trailing space does not match), the design's
-  `.input.match` border on a match, and #37's helper "Case-sensitive · must match exactly.". Never pre-filled. The
+  `.input.match` border on a match, and #37's helper "Case-sensitive · must match exactly.". Never pre-filled, not
+  in a form (Enter in it has nothing to submit). A lookalike origin with a block passes both gates in this order: the
+  typed fields enable its demoted "Approve anyway (not recommended)", which opens the 2-second confirm. The
   CTA: for an unlimited approve the design's red "Approve unlimited" with the alert icon; for any other block "Approve
   anyway" (Q34), red; drawn as #37's gated CTA (greyed, full label) until every field matches.
 - **Banners.** `.s9-flag-banner danger` for a block (head, body, meta — the design's state 2; for F5 the design's own
@@ -660,7 +662,7 @@ proxy (`getMultipleAccounts`). The window only renders the flags stored with the
   design's), "Critical · Blocked transaction" (Q35) for any other block, unchanged otherwise. An approve's balance card
   gains the design's synthesized row ("<SYM> delegated · unlimited · ≈ all current + future"; a bounded approve
   "<SYM> delegated · <amount>"): an approve changes no balance, so the "No balance changes" line is replaced wherever an
-  authority or approve flag exists.
+  authority or approve flag exists. Every banner's copy is the design's, B1 §3's or §10's (Q32, Q36–Q39, Q41–Q55).
 
 The plans for B1c-2 and B1c-3 refine this section; they may not loosen it.
 
@@ -967,6 +969,21 @@ empty, detail, hold, undo toast, blocked section) at 412 px; the opus-tier revie
 | Q38 | #10 row for an overridden F4 block (rev 3.6, plan 3 Task 4, controller copy, flagged to the owner — B1 §3's row) | "SetAuthority on an account you own" |
 | Q39 | #10 row for an overridden F5 block (rev 3.6, plan 3 Task 4, controller copy, flagged to the owner — the design's F5 head) | "Unlimited <SYM> spend approval"; "Unlimited token spend approval" when the wallet's table names no symbol (`UNLIMITED`) |
 | Q40 | #10 row for an overridden F10 block (rev 3.6, plan 3 Task 4, controller copy, flagged to the owner — Q32 as a row) | "Depends on step <N> — not checked on its own" |
+| Q41 | #48 F5 banner body, adapted (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | the design's body with its code span naming the real instruction (`spl_token::Approve`, `spl_token::ApproveChecked`, `spl_token_2022::Approve`, `spl_token_2022::ApproveChecked`), and "all of this token" for "all your <SYM>" when the wallet's table names no symbol |
+| Q42 | #48 F5 body, a decoded approve below u64::MAX that is at least the whole balance (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | "This transaction includes a `<instruction>` instruction for `amount = <base units>`, at least this account's whole balance. Even verified dApps can be exploited; this lets the program move *all your <SYM>* until you revoke." |
+| Q43 | #48 F5 body, seen only in the simulation's chain state (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | "The simulation shows a program call — not an instruction listed here — that lets a delegate move *all your <SYM>*, now and in the future, until you revoke. Even verified dApps can be exploited." (", now and in the future," only at u64::MAX) |
+| Q44 | #48 F6 banner head (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | "<SYM> spend approval"; "Token spend approval" when the wallet's table names no symbol |
+| Q45 | #48 F6 banner body (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | "This lets a delegate move up to <amount> of your <SYM> until you revoke." ("of this token" when unnamed) |
+| Q46 | #48 F3 banner body; its head is Q37 (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | "This changes your wallet account itself. Assigned to another program, it is that program's to control; given data, it can no longer pay fees or send SOL." |
+| Q47 | #48 F4 banner body; its head is Q38 (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | "This gives an authority over an account you own to another address, or removes it. You cannot take it back yourself." |
+| Q48 | #48 F10 banner body; its head is Q32 (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | "Its effects are unknown: it was simulated without the changes step <N> makes, which it needs." |
+| Q49 | #48 F10 balance card (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | label "Balance changes (unknown)"; line "This step was not simulated on its own, so its effects are unknown." |
+| Q50 | #48 F1 banner (head "Unknown program", screen.md §48; rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | body "The wallet cannot decode what this program does — only the simulation shows its effects."; a program index that is no static key: "a program the transaction does not name in its own keys" |
+| Q51 | #48 F2 banner (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | head "Instructions that are not transfers"; body "Each can do more than move a balance. Check what it does before approving." |
+| Q52 | #48 F7 banner, per mint (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner; Q36 when unreadable) | head "Token-2022 settings on a token you hold"; one body line per setting present: "Freeze authority — the issuer can freeze your account of this token." / "Permanent delegate — an address that can move or burn this token from any account, yours included." / "Transfer hook — a program that runs on every transfer of this token." |
+| Q53 | #48 F9 banner (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | head "Whole balance to a first-time address"; body "All or nearly all of a balance goes to an address you have not sent to before." |
+| Q54 | #48 the line replacing "No SOL or token balance changes — review the instructions below." beside an F3 / F4 block (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | "No SOL or token balance changes — but this transaction changes who controls an account of yours (above)." |
+| Q55 | #48 banner meta lines (rev 3.6, plan 3 Task 5, controller copy, flagged to the owner) | the design's "delegate: … · token: <SYM> mint … · scope: u64::MAX" (the scope otherwise the amount); an instruction as "#<n> <program>::<Instruction>" (the design's `spl_token::Approve` form, n as "Program <n>" counts); the decoder's own field names (`authorityType`, `account`, `newAuthority`, `owner`, `space`, `mint`, `freezeAuthority`, `permanentDelegate`, `transferHookProgram`); "post-simulation" for chain state; every address whole, in groups of four — never the design's `JUP6L…vRet9` truncation (a poisoned address matches on exactly those ends) |
 
 (Q09 and Q11 of rev 1 are gone: the window no longer shows "expired" for a request it did not show, and the undo toast
 uses the design's drawn strings.)
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

`npx tsc --noEmit; echo $?` → `0`. `npx vitest run` → **Test Files 170 passed (170), Tests 3401 passed (3401)** (Task 4: 170 / 3393; +7 in `tx.test.tsx`, +1 in `designExt2b.test.ts`; `tx.test.tsx` takes ~28 s — two tests wait out real 1.5 s holds and carry a 15 s timeout). `node scripts/build.mjs` → exit 0. `npm run gates` → exit 0 (`classes ok: every class in 56 src/app and src/approve files is defined by …`). `node scripts/extract-design-css.mjs --check` → `design-ext.css is the extraction output`. Nothing under the repository root's `src/` or `core/` is touched (root `tsc`/`jest` and web's `verify` not needed). The `act(...)` warnings `tx.test.tsx` prints come from the window's own 1 s poll landing between the test's steps, as in B1c-2's tests; no assertion depends on them.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

All in `extension/src/approve/Tx.tsx` unless named; tests in `src/approve/__tests__/tx.test.tsx` ("#48 red flags (B1c-3)") unless named. Observed in the dry run: every mutant `tsc` exit 0, the named test red (`Tests 1 failed`).

| id | the change | the test that turns red | observed |
|---|---|---|---|
| M5a | `matches`: `typed[f.key]?.trim() === f.word` (trims) | "an unlimited USDC approve …" (`'USDC '` enables) | tsc 0, 1 failed |
| M5b | `matches`: `typed[f.key]?.toUpperCase() === f.word` (case folding) | "an unlimited USDC approve …" (`'usdc'` enables) | tsc 0, 1 failed |
| M5c | `useArmed(…, ARM_MS)` always (no 1.5 s) | "holds (fake timers …)" (`[false, false]` at 1.49 s) | tsc 0, 1 failed |
| M5d | the key without the match state (`busy].join('|')`) | "holds (fake timers …)" (no re-hold on a match change) | tsc 0, 1 failed |
| M5e | `canApprove` without `&& allMatch` | "System assign … and an unlimited approve …" (enabled with one word) | tsc 0, 1 failed |
| M5f | `overrides` never sent (`overrides.length > 99`) | "an unlimited USDC approve …" (refused `override-missing`; no #10) | tsc 0, 1 failed |
| M5g | `overrides`' `tx` always `0` | "a dependent step (F10) …" (refused `override-mismatch`) | tsc 0, 1 failed |
| M5h | Q32's step `dependsOnStep(item) === null ? null : f.step - 1` (a 0-based slip) | "a dependent step (F10) …" ("step 1") | tsc 0, 1 failed |
| M5i | `stateOf` counts a dependent outcome as failed (B1c-2's rule) | "a dependent step (F10) …" (Couldn't simulate shown) | tsc 0, 1 failed |
| M5j | `FlagBanners`: the background's order as given (no blocks-first split) | "every kind of flag …" (the warning first) | tsc 0, 1 failed |
| M5k | `autoFocus` on the typed input | "an unlimited USDC approve …" (`activeElement` is the input) | tsc 0, 1 failed |
| M5l | the typed field inside a `<form onSubmit>` | "an unlimited USDC approve …" (`input.form` not null) | tsc 0, 1 failed |
| M5m | `unlimitedOnly = blocks.length > 0` | "System assign …" ("Critical · Unlimited spend approval") | tsc 0, 1 failed |
| M5n | the eyebrow without Q35 (a block falls through to "Approve transaction") | "System assign …" | tsc 0, 1 failed |
| M5o | the red CTA's class without `app-cta-gated` | "an unlimited USDC approve …" | tsc 0, 1 failed |
| M5p | `RiskConfirm` without `holdMs` (500 ms in the sheet) | "a lookalike origin with a block …" (enabled 1 s after focus) | tsc 0, 1 failed |
| M5q | the lookalike's demoted CTA armed without the typed gate (`ready && !reauthWaiting && !busy`) | "a lookalike origin with a block …" (enabled before typing) | tsc 0, 1 failed |
| M5r | the delegated row's delta never "unlimited" | "an unlimited USDC approve …" (`18,446,744,073,709.551615`) | tsc 0, 1 failed |
| M5s | L3's line never replaced beside an authority flag | "System assign …" (Q54) | tsc 0, 1 failed |
| M5t | `scripts/extract-design-css.mjs`: `.s9-typed-confirm` dropped from PREFIXES | `scripts/__tests__/extract-design-css.test.mjs` "design-ext.css starts with the script's HEADER, and every rule after it is one the extraction keeps" (5 rules not kept) | tsc 0, 1 failed |
| M5u | `instructionName` always `spl_token::…` (the design's span, not the real program) | "every kind of flag …" (`spl_token_2022::ApproveChecked`) | tsc 0, 1 failed |
| M5v | `Addr` shows `shortAddress` (the design's truncation) | "an unlimited USDC approve …" (meta `6YME…GKSy`) | tsc 0, 1 failed |

- [ ] **Step 6: Commit.**

```bash
git add docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md extension/scripts/extract-design-css.mjs extension/src/__tests__/designExt2b.test.ts extension/src/app/app.css extension/src/approve/Tx.tsx extension/src/approve/__tests__/tx.test.tsx extension/src/approve/strings.ts extension/src/approve/ui.tsx extension/src/approve/useArmed.ts extension/src/background/dapp/__tests__/txHarness.ts extension/src/styles/design-ext.css
git commit -m "feat(extension): B1c-3 Task 5 — #48 renders the red flags: banners, typed fields, red CTAs, delegated rows, the 1.5 s hold, the dependent step's section

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Dry run: clone commit `afb3e09` on Task 4's `614e54b`.)

#### Dry-run notes (Task 5)

- **Ruling: the 1.5 s hold replaces C15's 500 ms on a flagged screen (same triggers: mount, focus, every key change), it is not added to it (2 s)** — why: the brief's own mechanism is `useArmed(key, 1500)` and its test is "1.49 s disabled / 1.5 s enabled"; "on top of C15" read as "C15's re-hold triggers still apply" — cost if wrong: 0.5 s less friction than a summed reading.
- **Ruling: the 2-second confirm's own C15 hold is 1.5 s on a flagged screen (`RiskConfirm`'s `holdMs`)** — B1 §3 "Confirm is disabled for 1.5 s" read as every confirming CTA; its 2 s delay already covers the open — cost if wrong: none (stricter).
- **Ruling: a lookalike with a block — the typed fields first, then the 2-second confirm; the lookalike keeps its demoted bar (no red CTA), and a block's eyebrow (Q35 / the design's) replaces "Suspicious origin"** — why: the sheet is the last gate before the words leave; the eyebrow names what is being overridden, the lookalike banner stays directly under the origin card — cost if wrong: the eyebrow reads "Critical · Blocked transaction" where the owner might prefer "Suspicious origin" (a one-line change). Written into §3.3.
- **Ruling: "Approve unlimited" (with the icon) and the design's eyebrow only when EVERY block on the screen is an unlimited approve; any other block present → Q34 / Q35** — why: "Approve unlimited" would understate an Assign beside it — cost if wrong: none for funds.
- **Ruling: the red CTA is `btn btn-destructive` (design-system's `--danger` / `--danger-on`, the exact colours the design inlines on `.btn-primary`), greyed by #37's rule (`.app-cta-gated`, added to `.app-delete-gated`'s selector) while any field does not match; matched but still held it is every held CTA's `.btn[disabled]`** — no inline styles (CSP); cost if wrong: one class name.
- **Ruling: every address in a banner is whole, in groups of four (`AddressGroups`), never the design's `JUP6L…vRet9`** — the September 2026 poisoning address matches the Squads vault on exactly the truncated ends; Q55 says so — cost if wrong: longer meta lines (the design's `word-break: break-all` wraps them).
- **Ruling: F5's code spans name the real instruction** (`spl_token::Approve`, `spl_token::ApproveChecked`, `spl_token_2022::…`, from the decoded instruction at the approval's `at`); a decoded amount below u64::MAX gets Q42 with `amount = <base units>`, a chain-only approval Q43 (no code span: no instruction says it). "~18.4 quintillion units" appears only at u64::MAX — cost if wrong: none (literal truth).
- **Ruling: banner meta vocabulary (Q55)** — `#<n> <program>::<Instruction>` (n 1-based as "Program <n>"; the instruction capitalised the design's way; an unknown tag `unknown instruction`), the decoder's own field names, "post-simulation" for chain state, `—` for none (the payload card's). Copy flagged; the owner may prefer prose.
- **Ruling: Q37 / Q38 (#10's rows, Task 4) are reused as the F3 / F4 banner heads** — one wording per block across #48 and #10; Q32 is F10's head. F8 has only B1 §3's head (no body); F1's head is screen.md §48's "Unknown program".
- **Ruling: F2's banner is kept beside a block even when it names the same instruction** (Task 2's literal F2: "Task 5 may group them; it may not drop one") — not grouped: every flag the background sends is shown — cost if wrong: one more warning on an unlimited-approve screen (the design draws only the danger banner; flagged as a design deviation below).
- **Ruling: the typed field sits after the transaction's instructions card** (the design draws banner → balance → [alternative, omitted] → typed field; B1c-2 kept the instructions card the design omits in state 2) — closest to the CTA and after what it overrides. No placeholder (the design specifies none; `.input.empty` unused).
- **Ruling: the delegated rows are named by the approval's `symbol` (the background's, decimals-verified), never by the window's `KNOWN_MINTS`** — the same name as the typed word; an unnamed one shows the mint (or, unreadable, the source account) short, as B1c-2's unnamed rows do — cost if wrong: none.
- **Ruling: banners render whenever a transaction has flags, typed fields and the block eyebrow/CTA only in the `ready` state** (a failed / expired / unreachable screen stays Reject-only, its banners informational).
- **Deviation (design, loud):** the design's state 2 draws ONE banner; this screen also shows F2's warning beside it (Task 2's ruling) — the visual pass (Task 8) will show two banners on the USDC state. The design's "Recommended alternative" card is omitted (§9, Task 1). The design's typed field is drawn only matched; the unmatched state uses the design's own unmatched border (CSS) with no placeholder.
- **Deviation (additive): `txHarness.ts` gains `tokenApprove` and `Chain.accounts`** (getAccountsData and an unchanged post-state) — Task 7's fakeCoordinator needs the same shapes.
- **Deviation: `client.ts` is not modified** (the brief allowed "as needed"; Task 4's reader is complete).
- **Copy (flagged, written into §10):** Q41 (F5 body adapted: the real instruction, "all of this token"), Q42 (F5 whole balance), Q43 (F5 chain only), Q44–Q45 (F6), Q46 (F3 body), Q47 (F4 body), Q48 (F10 body), Q49 (F10 card), Q50 (F1 body + a non-static program), Q51 (F2), Q52 (F7), Q53 (F9), Q54 (L3 replacement), Q55 (meta vocabulary). **Task 6 / 8's copy starts at Q56.**
- **For Task 6:** Tx.tsx's `PROGRAM_NAMES` / `KNOWN_MINTS` and `BalanceCard` grew here (the delegated rows come before the simulation's rows); the non-Checked decimals and ATA token-program rows go into `Payload`. **For Task 7 (E2E):** an unlimited approve now needs the typed symbol in the field (`getByLabelText('Type USDC to enable Approve')`), then the 1.5 s hold, then #10; Enter never confirms. **For Task 8 (visual):** new states — USDC unlimited typed empty / matched (gated vs red CTA), Assign + approve (two fields, Q35, "Approve anyway"), a dependent batch (step 3 on 2), every warning banner (the "every kind" view), a lookalike with a block; take shots after `FLAG_HOLD_MS`.
- **E2E not run** (as Tasks 1–4).

---

### Task 6: F2 beside a more specific flag (the controller's ruling); a non-Checked amount with its mint's decimals; an ATA create's token program; the four carried visual items (#46's Q26 banner, #11's pending strip, #10's unsigned headline, one Tensor colour)

**Spec:** B1c §3.3 rev 3.6 F2's row (this task adds the ruling), "Banners" (this task adds "Instruction rows"), §3.2 #46's "Can no longer be signed" (Q26 now a danger banner); B1 §3 ("an instruction … that is not a transfer: warning, named"); the plan-3 ledger's Task 5 ruling (F2 does not repeat an instruction a more specific flag already names); brief "Carried items in scope" (non-Checked decimals, the ATA token program — final-review triage row 1, the four visual items, R9); the design, BINDING: `/home/user/Downloads/index.html` #48 state 2 ix:18325-18396 (one banner for an unlimited approve), #10's send headline ix:6061-6064 (unsigned), #11's chevron ix:6374, #49's Tensor tile ix:3885 (and #47's cyan ix:17711, now replaced); C13

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (§3.2 Q26's form; §3.3 F2's row, "Instruction rows")
- Test: `extension/src/background/dapp/__tests__/redFlags.test.ts` (one describe added, five tests; eight B1c-3 assertions updated to the ruling)
- Test: `extension/src/background/dapp/__tests__/simulate.test.ts` (one describe added, five tests; Task 3's bounded-approve list and two stored-flag edits retargeted to the ruling)
- Test: `extension/src/background/dapp/decode/__tests__/decode.test.ts` (B1c-2's ATA test gains `tokenProgram`, its 4-account `create` built with six; one test added)
- Test: `extension/src/background/dapp/__tests__/txHarness.ts` (`ataCreate`'s token program a parameter)
- Test: `extension/src/approve/__tests__/tx.test.tsx` (two tests added; Task 5's two block tests updated to the ruling; the origin-tile test gains Tensor)
- Test: `extension/src/approve/__tests__/sign.test.tsx` (the Q26 assertion)
- Test: `extension/src/app/__tests__/Home.test.tsx` (one test added — the computed style)
- Test: `extension/src/unlock/__tests__/challenge.test.ts`, `extension/src/unlock/__tests__/reauthScreen.test.ts` (the sign of #10's amounts)
- Test: `extension/e2e/visual-dapp-tx.spec.ts` (#10's headline regex unsigned — not run here; Task 8 runs it)
- Modify: `extension/src/background/dapp/redFlags.ts` (F2 last, `namedBy`)
- Modify: `extension/src/background/dapp/simulate.ts` (`AmountDecimals`, `amountMintsOf`, `withAmountDecimals`, `TxSimulation.amountDecimals`, the mint read, `simStateOf`)
- Modify: `extension/src/background/dapp/signTx.ts` (`txDetail` applies them)
- Modify: `extension/src/background/dapp/decode/decode.ts` (ATA `tokenProgram`, six accounts)
- Modify: `extension/src/approve/Tx.tsx` (`TOKEN_PROGRAMS`, the address field's program name)
- Modify: `extension/src/approve/Sign.tsx` (Q26 as `.s9-flag-banner danger`)
- Modify: `extension/src/approve/ui.tsx` (the `BRAND_TILES` comment — Tensor is one colour now)
- Modify: `extension/src/app/screens/Home.tsx` (`PendingStrip`: `app-pending-strip`, the chevron)
- Modify: `extension/src/app/app.css` (the pending strip on the dApp strip's rules; `.app-brand-tensor` = #49's gradient)
- Modify: `extension/src/unlock/challenge.ts` (`DappDescription.outgoing[].amount` unsigned), `extension/src/unlock/screens/reauth.ts` (the rows add the minus, the headline does not)
- Not modified: `extension/src/approve/client.ts` (a field's `amount` already carries `decimals`, validated 0–18), `src/styles/design-ext.css` (no new design class), anything under the repository root's `src/` or `core/`.

**Interfaces:**
- Consumes: Task 2's `redFlagsOf`, `RedFlag` (the instruction indices each kind names: `assign`/`set-authority` `.instructions[].index`, the approvals' `at`, `durable-nonce`'s `at`); Task 3's `simulateTransactions` (the per-transaction `pre` map, the one capped mint read, `decimals`), `simStateOf`; Task 1's `tokenAccountInfo` (`program`, `mint`); B1c-2's `txDetail` (`signTx.ts`), `decodeInstructions`, `addressField`, `acc2`/`acc4`, `addr`, `FieldValueView`/`PROGRAM_NAMES` (`Tx.tsx`), `describeChallenge`'s dapp rows (`unlock/challenge.ts`), #10's `describe` (`reauth.ts`), `DappReauthStrip`'s CSS (`app.css`), `txHarness.ataCreate`, `tokenApprove`, `tokenTransfer`; Task 5's #48 test helpers (`holdUsdc`, `heads`, `simulated`).
- Produces:
  ```ts
  // dapp/redFlags.ts — redFlagsOf's contract, refined: a `non-transfer` flag never lists an instruction index that the
  // same transaction's `assign` / `set-authority` (instructions), `unlimited-approve` / `bounded-approve` (a decoded
  // approval's `at`) or `durable-nonce` (`at` 0) flag names; every other non-transfer it listed stays (F7's `at` does
  // not exclude). No F2 at all when nothing is left.
  // dapp/simulate.ts
  export interface AmountDecimals {at: number; decimals: number}   // at: the instruction's 0-based index; decimals 0–18
  export interface TxSimulation {/* Task 3's fields */; amountDecimals: AmountDecimals[][]}   // one list per transaction
  export function withAmountDecimals(decoded: DecodedInstruction[], list: readonly AmountDecimals[]): DecodedInstruction[];
  // simStateOf: as Task 3, plus — amountDecimals.length === outcomes.length, each entry exactly {at, decimals ≤ 18}.
  // decode/decode.ts — ATA create / createIdempotent: fields payer, account, wallet, mint, tokenProgram (account 5,
  // an address); fewer than six accounts → an unknown program.
  // unlock/challenge.ts — DappDescription.outgoing[].amount is unsigned (what leaves); reauth.ts adds U+2212 on rows.
  ```

The controller ruled at Task 5 that F2 does not repeat an instruction a more specific flag of the same transaction already names: the design draws ONE banner for an unlimited approve (state 2), and B1 §3's "named" is satisfied by the specific banner, which names the instruction in its own meta line. `redFlagsOf` now computes F2 last and leaves out every instruction index F3, F4, F5, F6 or F8 lists — and nothing else: an assign of someone else's account, a setAuthority on an account the user does not own, someone else's approve, an `AdvanceNonceAccount` that is not first, a decoded approve that no flag names (a bounded approve whose account the chain state shows unlimited is F5 from chain state, `at: null`, so its instruction stays F2's), and an ATA create that F7 anchors on all stay listed. The window changes nothing: it renders what the background lists, so #48's unlimited-approve screen now has exactly the design's one danger banner.

Three carried rows of the final review. A non-Checked Token / Token-2022 `transfer`, `approve` or `burn` carries no decimals in its data, so #48 showed its amount in base units; the background now names the decimals per instruction when the pre-state it already reads for that transaction's simulation shows the source account as a token account of the instruction's own program (a burn: of the mint the burn names — the program refuses any other), with the mint's decimals as the simulation knows them (the wallet's table, the holdings, or the one capped mint read, which now also covers these mints) and only 0–18 (the window's own bound — more stays base units, never an unreadable detail). They are stored with the simulation (`amountDecimals`, strictly read back) and applied in `txDetail` to the decoded field, so the window formats an amount it was given, as for every Checked amount, and computes nothing (C13). A transaction that failed keeps them (its instructions are still shown). An ATA `create` / `createIdempotent` now names its token program — account 5, which the ATA program reads (with the System program at 4), so a create with fewer than six accounts never runs and decodes as an unknown program (B1c-2's fail-closed rule for too few accounts) — and #48 shows it whole, with `spl_token` / `spl_token_2022` (the design's mono names, B1c-2's `PROGRAM_NAMES`) beside it when it is one of the two; any other address gets no name.

The four visual items. #46's Q26 is drawn as #48 draws it — a danger flag banner with the alert icon, role alert — instead of the lede's plain line. B1b's pending-send strip on #11 sits on the dApp strip's gutter (`app-pending-strip` joins `.s-dash .app-banner.app-dapp-strip`'s rule: `width: auto`, `--space-5` sides, centred) with the same trailing chevron; the unit test reads the COMPUTED style in happy-dom from the three real sheets (the design system's tokens resolve the margins), compares it with the dApp strip's, and proves the measurement on B1b's bare strip (width 100% beside 16 px margins — the overflow); the visual pass (Task 8) asserts the viewport. #10's headline amount is unsigned like the design's send headline (ix:6062): `describeChallenge` gives what leaves without a sign and #10's rows add U+2212 — every test that pinned the sign was checked (`challenge.test.ts`, `reauthScreen.test.ts`; `e2e/visual-dapp-tx.spec.ts`'s headline regex; `e2e/send.spec.ts`, `visual-vault.spec.ts` and `csp.spec.ts` pin the SEND headline, already unsigned; the `−` rows in `reauthScreen.test.ts` stay). Tensor's tile on #46/#47/#48 takes #49's oklch gradient (R9: one colour, the design's latest), so all three of its rules are equal.

- [ ] **Step 1: Write the failing tests.**

The ruling's tests, in `redFlags.test.ts` — a new describe with the brief's three cases (the unlimited approve alone; beside an ATA create, F2 naming only the create; the lone `closeAccount` still F2), the boundary per specific flag (the same instruction on someone else's account stays), a decoded approve no flag names, and F7 not among them — and eight Task 2 assertions updated: each listed `non-transfer` beside an assign / setAuthority / approve / first nonce that now names the same instruction; the order test keeps a non-transfer (a revoke, and a nonce that is not first) so it still proves where F2 sits:

`extension/src/background/dapp/__tests__/redFlags.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/redFlags.test.ts b/extension/src/background/dapp/__tests__/redFlags.test.ts
index a51ec03..95b6270 100644
--- a/extension/src/background/dapp/__tests__/redFlags.test.ts
+++ b/extension/src/background/dapp/__tests__/redFlags.test.ts
@@ -142,6 +142,56 @@ describe('redFlagsOf — F2 non-transfer', () => {
   });
 });
 
+// Controller ruling (plan 3, Task 5's ledger): F2 does not repeat an instruction a more specific flag of the same
+// transaction already names (F3, F4, F5, F6, F8) — the design draws one banner for an unlimited approve; every other
+// instruction F2 named stays named.
+describe('redFlagsOf — F2 beside a more specific flag', () => {
+  const held = [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n})]] as [PublicKey, AccountData][];
+  const closeIx = tokenIx([9], [meta(SRC, false, true), meta(TO, false, true), meta(ME, true)]);
+
+  it('an unlimited approve alone is F5 only; beside an ATA create, F2 names only the create', () => {
+    expect(kinds(one({ixs: [approveIx(U64_MAX)], pre: held}))).toEqual(['unlimited-approve']);
+    const flags = one({ixs: [approveIx(U64_MAX), ataCreateIx(MAINNET_USDC_MINT)], pre: held});
+    expect(kinds(flags)).toEqual(['unlimited-approve', 'non-transfer']);
+    expect(find(flags, 'non-transfer')).toEqual({kind: 'non-transfer', severity: 'warn', word: null, at: 1, instructions: [{index: 1, program: 'associated-token', name: 'createIdempotent'}]});
+  });
+
+  it('negative control: a lone closeAccount, or a revoke, is still F2', () => {
+    expect(one({ixs: [closeIx], pre: held})).toEqual([{kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'token', name: 'closeAccount'}]}]);
+    const revoke = tokenIx([5], [meta(SRC, false, true), meta(ME, true)]);
+    expect(kinds(one({ixs: [revoke], pre: held}))).toEqual(['non-transfer']);
+  });
+
+  it('only the instructions the specific flag names leave F2 — the same instruction on someone else’s account stays', () => {
+    const named = (spec: Spec): number[] => find(one(spec), 'non-transfer')?.instructions.map(x => x.index) ?? [];
+    // F3: the wallet's assign is F3's, another account's stays F2's.
+    expect(named({ixs: [SystemProgram.assign({accountPubkey: THEIRS, programId: UNKNOWN}), SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN})]})).toEqual([0]);
+    // F4: the own account's setAuthority is F4's, someone else's stays F2's.
+    const theirs = tokenAcc({mint: MAINNET_USDC_MINT, owner: TO, amount: 5n});
+    expect(named({ixs: [setAuthorityIx(THEIRS, TO), setAuthorityIx(SRC, ME, 3)], pre: [...held, [THEIRS, theirs]]})).toEqual([0]);
+    // F5 / F6: the wallet's approves are theirs; an approve by someone else of their own account stays F2's.
+    expect(named({ixs: [approveIx(U64_MAX, THEIRS, TO), approveIx(U64_MAX)], pre: [...held, [THEIRS, theirs]]})).toEqual([0]);
+    expect(named({ixs: [approveIx(U64_MAX, THEIRS, TO), approveIx(5n)], pre: [...held, [THEIRS, theirs]]})).toEqual([0]);
+    // F8 names instruction 0 only: a second AdvanceNonceAccount stays F2's.
+    const nonce = SystemProgram.nonceAdvance({noncePubkey: SRC, authorizedPubkey: ME});
+    expect(named({ixs: [nonce, SystemProgram.nonceAdvance({noncePubkey: SRC2, authorizedPubkey: ME})]})).toEqual([1]);
+  });
+
+  it('a decoded approve no flag names stays F2: bounded, while the chain state shows the account unlimited (F5 is the chain’s)', () => {
+    const post: [PublicKey, AccountData][] = [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1_000n, delegate: DELEGATE, delegatedAmount: U64_MAX})]];
+    const flags = one({ixs: [approveIx(5n)], pre: held, post});
+    expect(kinds(flags)).toEqual(['unlimited-approve', 'non-transfer']);
+    expect(find(flags, 'unlimited-approve')?.approvals.map(a => a.at)).toEqual([null]);
+    expect(find(flags, 'non-transfer')?.instructions).toEqual([{index: 0, program: 'token', name: 'approve'}]);
+  });
+
+  it('F7 is not among them: an ATA create of a Token-2022 mint with settings is F7 and F2', () => {
+    const flags = one({ixs: [ataCreateIx(T22_MINT)]}, {mints: [[T22_MINT, mintAcc(pyusdLikeMint(), TOKEN_2022_PROGRAM)]]});
+    expect(kinds(flags)).toEqual(['non-transfer', 'token-2022']);
+    expect(flags.map(f => f.at)).toEqual([0, 0]);
+  });
+});
+
 describe('redFlagsOf — F3 assign / allocate on the wallet account', () => {
   it('assign, allocate, assignWithSeed, allocateWithSeed of the wallet account: one block, ASSIGN, naming each', () => {
     const ixs = [
@@ -151,7 +201,7 @@ describe('redFlagsOf — F3 assign / allocate on the wallet account', () => {
       SystemProgram.allocate({accountPubkey: ME, basePubkey: SRC, seed: 'x', space: 64, programId: UNKNOWN}),
     ];
     const flags = one({ixs});
-    expect(kinds(flags)).toEqual(['assign', 'non-transfer']);
+    expect(kinds(flags)).toEqual(['assign']);
     expect(find(flags, 'assign')).toEqual({
       kind: 'assign',
       severity: 'block',
@@ -193,7 +243,7 @@ describe('redFlagsOf — F3 assign / allocate on the wallet account', () => {
 describe('redFlagsOf — F4 setAuthority on an account the user owns', () => {
   it('an own token account (its pre-state owner field is the wallet): a block, AUTHORITY', () => {
     const flags = one({ixs: [setAuthorityIx(SRC, ME, 3)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 5n})]]});
-    expect(kinds(flags)).toEqual(['set-authority', 'non-transfer']);
+    expect(kinds(flags)).toEqual(['set-authority']);
     expect(find(flags, 'set-authority')).toEqual({
       kind: 'set-authority',
       severity: 'block',
@@ -248,7 +298,7 @@ describe('redFlagsOf — F5 unlimited approve, F6 bounded approve', () => {
 
   it('u64::MAX, or at least the source’s whole pre-state balance: a block whose word is the wallet’s own symbol', () => {
     const flags = one({ixs: [approveIx(U64_MAX)], pre: held()});
-    expect(kinds(flags)).toEqual(['unlimited-approve', 'non-transfer']);
+    expect(kinds(flags)).toEqual(['unlimited-approve']);
     expect(find(flags, 'unlimited-approve')).toEqual({
       kind: 'unlimited-approve',
       severity: 'block',
@@ -262,7 +312,7 @@ describe('redFlagsOf — F5 unlimited approve, F6 bounded approve', () => {
 
   it('balance − 1 is bounded: a warning, no block', () => {
     const flags = one({ixs: [approveIx(999n)], pre: held()});
-    expect(kinds(flags)).toEqual(['non-transfer', 'bounded-approve']);
+    expect(kinds(flags)).toEqual(['bounded-approve']);
     expect(find(flags, 'bounded-approve')).toEqual({
       kind: 'bounded-approve',
       severity: 'warn',
@@ -270,11 +320,11 @@ describe('redFlagsOf — F5 unlimited approve, F6 bounded approve', () => {
       at: 0,
       approvals: [{at: 0, source: SRC.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DELEGATE.toBase58(), amount: '999', balance: '1000'}],
     });
-    expect(kinds(one({ixs: [approveCheckedIx(999n, MAINNET_USDC_MINT)], pre: held()}))).toEqual(['non-transfer', 'bounded-approve']);
+    expect(kinds(one({ixs: [approveCheckedIx(999n, MAINNET_USDC_MINT)], pre: held()}))).toEqual(['bounded-approve']);
   });
 
   it('a source the wallet cannot read, approved by the wallet, counts as an empty balance (fail closed)', () => {
-    expect(kinds(one({ixs: [approveIx(1n)], pre: [[SRC, null]]}))).toEqual(['unlimited-approve', 'non-transfer']);
+    expect(kinds(one({ixs: [approveIx(1n)], pre: [[SRC, null]]}))).toEqual(['unlimited-approve']);
   });
 
   it('someone else’s account approved by its own owner is F2 only', () => {
@@ -365,13 +415,10 @@ describe('redFlagsOf — F7 Token-2022 mint settings', () => {
 });
 
 describe('redFlagsOf — F8 durable nonce, F9 whole balance, F10 dependent step', () => {
-  it('AdvanceNonceAccount first: "does not expire" (and it is named among the non-transfers); at index 1 it is F2 only', () => {
+  it('AdvanceNonceAccount first: "does not expire" (F8 names it, so F2 does not); at index 1 it is F2 only', () => {
     const nonce = SystemProgram.nonceAdvance({noncePubkey: SRC, authorizedPubkey: ME});
     const transfer = SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1});
-    expect(one({ixs: [nonce, transfer]})).toEqual([
-      {kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'system', name: 'advanceNonceAccount'}]},
-      {kind: 'durable-nonce', severity: 'warn', word: null, at: 0},
-    ]);
+    expect(one({ixs: [nonce, transfer]})).toEqual([{kind: 'durable-nonce', severity: 'warn', word: null, at: 0}]);
     expect(kinds(one({ixs: [transfer, nonce]}))).toEqual(['non-transfer']);
   });
 
@@ -386,7 +433,7 @@ describe('redFlagsOf — F8 durable nonce, F9 whole balance, F10 dependent step'
     const assign = SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN});
     expect(one({ixs: [transferIx(1n)], post: {dependentOn: 0}})).toEqual([{kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, on: 0}]);
     expect(one({ixs: [transferIx(1n)], post: 'failed'})).toEqual([]);
-    expect(kinds(one({ixs: [assign], post: 'failed'}))).toEqual(['assign', 'non-transfer']);
+    expect(kinds(one({ixs: [assign], post: 'failed'}))).toEqual(['assign']);
     // A failed step has no post-state: chain-state rules read nothing (the wallet's plain post is not consulted).
     expect(kinds(one({ixs: [unknownIx()], pre: [[ME, {lamports: SOL, owner: UNKNOWN.toBase58(), data: new Uint8Array(4)}]], post: 'failed'}))).toEqual(['unknown-program']);
   });
@@ -395,19 +442,21 @@ describe('redFlagsOf — F8 durable nonce, F9 whole balance, F10 dependent step'
 describe('redFlagsOf — the order', () => {
   it('blocks first, then warnings; within each by instruction index (chain state and whole-transaction flags after), then by row', () => {
     const nonce = SystemProgram.nonceAdvance({noncePubkey: SRC2, authorizedPubkey: ME});
+    const revoke = tokenIx([5], [meta(SRC, false, true), meta(ME, true)]);
     const flags = one(
-      {ixs: [nonce, SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN}), unknownIx(), approveIx(U64_MAX)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1n})]], post: {dependentOn: 0}, firstSend: true},
+      {ixs: [revoke, nonce, SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN}), unknownIx(), approveIx(U64_MAX)], pre: [[SRC, tokenAcc({mint: MAINNET_USDC_MINT, amount: 1n})]], post: {dependentOn: 0}, firstSend: true},
       {reasons: ['whole-balance-to-new']},
     );
+    // The nonce is not first, so it is no F8: F2 names it beside the revoke.
     expect(flags.map(f => [f.kind, f.at])).toEqual([
-      ['assign', 1],
-      ['unlimited-approve', 3],
+      ['assign', 2],
+      ['unlimited-approve', 4],
       ['dependent', null],
       ['non-transfer', 0],
-      ['durable-nonce', 0],
-      ['unknown-program', 2],
+      ['unknown-program', 3],
       ['whole-balance', null],
     ]);
+    expect(find(flags, 'non-transfer')?.instructions.map(x => x.index)).toEqual([0, 1]);
   });
 });
````

`simulate.test.ts` — Task 3's bounded approve is F6 alone now, and the two stored-flag edits that used the (now absent) `non-transfer` flag use the `unlimited-approve` one (same rule: a key less, an `at` not its first approval); the new describe for the decimals:

`extension/src/background/dapp/__tests__/simulate.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/simulate.test.ts b/extension/src/background/dapp/__tests__/simulate.test.ts
index 1213840..18acd47 100644
--- a/extension/src/background/dapp/__tests__/simulate.test.ts
+++ b/extension/src/background/dapp/__tests__/simulate.test.ts
@@ -581,10 +581,8 @@ describe('simulateTransactions: the red flags (B1c-3)', () => {
     expect(unread.reasons).toEqual(['approval', 'override']);
     // Negative control: a bounded approve is a warning — no block, no `override`.
     const bounded = await run(approveScene(50n, USDC_MINT), [approve(50n)], () => true);
-    expect(bounded.flags[0]?.map(f => [f.kind, f.severity])).toEqual([
-      ['non-transfer', 'warn'],
-      ['bounded-approve', 'warn'],
-    ]);
+    // (F6 names the approve, so F2 does not repeat it — the controller's ruling.)
+    expect(bounded.flags[0]?.map(f => [f.kind, f.severity])).toEqual([['bounded-approve', 'warn']]);
     expect(bounded.reasons).toEqual(['approval']);
   });
 
@@ -635,7 +633,7 @@ describe('simulateTransactions: the red flags (B1c-3)', () => {
       ['a word not the one its approvals give', sim, s => (flag(s, 'unlimited-approve').word = 'UNLIMITED')],
       ['a block stored as a warning', sim, s => (flag(s, 'unlimited-approve').severity = 'warn')],
       ['a key more', sim, s => (flag(s, 'unlimited-approve').extra = 1)],
-      ['a key less', sim, s => delete flag(s, 'non-transfer').at],
+      ['a key less', sim, s => delete flag(s, 'unlimited-approve').at],
       ['an approval’s symbol not its mint’s', sim, s => ((flag(s, 'unlimited-approve').approvals as Json[])[0] = {...(flag(s, 'unlimited-approve').approvals as Json[])[0], symbol: 'USDT'})],
       [
         'an approval’s symbol not its mint’s, its word made to agree',
@@ -647,7 +645,7 @@ describe('simulateTransactions: the red flags (B1c-3)', () => {
         },
       ],
       ['an approval’s amount not base units', sim, s => ((flag(s, 'unlimited-approve').approvals as Json[])[0] = {...(flag(s, 'unlimited-approve').approvals as Json[])[0], amount: '-1'})],
-      ['a flag’s position not its first instruction', sim, s => (flag(s, 'non-transfer').at = 3)],
+      ['a flag’s position not its first instruction', sim, s => (flag(s, 'unlimited-approve').at = 3)],
       ['a block without the `override` reason', sim, s => (s.reasons = ['approval'])],
       ['an unknown reason', sim, s => (s.reasons = ['approval', 'override', 'drain'])],
       ['`override` with no block', bounded, s => (s.reasons = ['approval', 'override'])],
@@ -792,3 +790,82 @@ describe('simulateTransactions: the red flags (B1c-3)', () => {
     });
   });
 });
+
+// B1c-3 (the final review's carried minor): a non-Checked Token / Token-2022 transfer, approve or burn carries no
+// decimals of its own; the simulation names the mint's when the source account's pre-state is a token account of the
+// instruction's own program — #48 then shows the amount with them, else in base units as before.
+describe('simulateTransactions: the decimals of a non-Checked amount (B1c-3)', () => {
+  const NOC = MAINNET_NOC_MINT;
+  const DELEGATE = keyOf(52);
+  const plain = (lamports: bigint): SimulatedAccount => ({lamports, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()});
+  const t22Ix = (data: number[], keys: string[]) =>
+    new TransactionInstruction({programId: new PublicKey(TOKEN_2022_PROGRAM), data: Buffer.from(data), keys: keys.map(k => ({pubkey: new PublicKey(k), isSigner: k === ME.toBase58(), isWritable: k !== ME.toBase58()}))});
+  const transferIx = (source = SRC, amount = 5n) => tokenIx([3, ...u64(amount)], [source, TO.toBase58(), ME.toBase58()]);
+  const approveIx = (source = SRC) => tokenIx([4, ...u64(5n)], [source, DELEGATE, ME.toBase58()]);
+  const burnIx = (mint: string, source = SRC) => tokenIx([8, ...u64(5n)], [source, mint, ME.toBase58()]);
+  const checkedIx = (mint: string) => tokenIx([12, ...u64(5n), 9], [SRC, mint, TO.toBase58(), ME.toBase58()]);
+  /** The source's pre-state `src`, unchanged by the simulation (so no balance change names its mint: only the amount does). */
+  const decimalsScene = (src: AccountData | null, o: {mints?: [string, AccountData | null][]; err?: unknown} = {}) => {
+    const accounts = new Map<string, AccountData | null>([[SRC, src], ...(o.mints ?? [])]);
+    return scene({accounts, post: a => (a === ME.toBase58() ? plain(SOL - 5_000n) : (accounts.get(a) ?? null)), err: o.err});
+  };
+
+  it('a transfer, an approve and a burn from a token account the pre-state reads: the mint’s decimals, per instruction; a Checked one carries its own', async () => {
+    const sim = await run(decimalsScene(tokenAfter(NOC, 1_000n)), [wire([transferIx(), approveIx(), burnIx(NOC), checkedIx(NOC)])]);
+    expect(sim.amountDecimals).toEqual([
+      [
+        {at: 0, decimals: 9},
+        {at: 1, decimals: 9},
+        {at: 2, decimals: 9},
+      ],
+    ]);
+    // Someone else's token account (a delegate's transfer) names its mint as well: the decimals are the mint's, not the owner's.
+    const theirs = await run(decimalsScene(tokenAfter(NOC, 1_000n, TO.toBase58())), [wire([transferIx()])]);
+    expect(theirs.amountDecimals).toEqual([[{at: 0, decimals: 9}]]);
+  });
+
+  it('a mint the wallet does not know: its decimals from the one mint read; unreadable, or above 18, none (base units)', async () => {
+    const odd = (decimals: number | null) => decimalsScene(tokenAfter(ODD_MINT, 1_000n), {mints: [[ODD_MINT, decimals === null ? null : {lamports: 1n, owner: TOKEN_PROGRAM, data: mintBytes({decimals})}]]});
+    const s = odd(4);
+    expect((await run(s, [wire([transferIx()])])).amountDecimals).toEqual([[{at: 0, decimals: 4}]]);
+    expect(s.reads.at(-1)).toEqual([ODD_MINT]);
+    expect((await run(odd(null), [wire([transferIx()])])).amountDecimals).toEqual([[]]);
+    expect((await run(odd(19), [wire([transferIx()])])).amountDecimals).toEqual([[]]);
+    expect((await run(odd(18), [wire([transferIx()])])).amountDecimals).toEqual([[{at: 0, decimals: 18}]]);
+  });
+
+  it('none when the pre-state does not name the mint: absent, not a token account, another token program’s account, a burn of another mint', async () => {
+    const none = async (src: AccountData | null, ix: TransactionInstruction = transferIx()) => (await run(decimalsScene(src), [wire([ix])])).amountDecimals;
+    expect(await none(null)).toEqual([[]]);
+    expect(await none(plain(SOL))).toEqual([[]]);
+    expect(await none(t22After(NOC, 1_000n))).toEqual([[]]);
+    expect(await none(tokenAfter(NOC, 1_000n), burnIx(MAINNET_USDC_MINT))).toEqual([[]]);
+    // Positive controls: the Token-2022 account under Token-2022's own instruction; the burn of its own mint.
+    expect(await none(t22After(NOC, 1_000n), t22Ix([3, ...u64(5n)], [SRC, TO.toBase58(), ME.toBase58()]))).toEqual([[{at: 0, decimals: 9}]]);
+    expect(await none(tokenAfter(NOC, 1_000n), burnIx(NOC))).toEqual([[{at: 0, decimals: 9}]]);
+  });
+
+  it('a transaction that failed keeps them (its instructions are still shown); one list per transaction', async () => {
+    const failed = await run(decimalsScene(tokenAfter(NOC, 1_000n), {err: {InstructionError: [0, 'InsufficientFunds']}}), [wire([transferIx()]), wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})])]);
+    expect(failed.amountDecimals).toEqual([[{at: 0, decimals: 9}], []]);
+  });
+
+  it('simStateOf: read back strictly — any other shape makes the stored simulation invalid', async () => {
+    const sim = await run(decimalsScene(tokenAfter(NOC, 1_000n)), [wire([transferIx()])]);
+    const stored = JSON.parse(JSON.stringify({status: 'ok', sim})) as {status: string; sim: Record<string, unknown>};
+    expect(simStateOf(stored)).toEqual({status: 'ok', sim});
+    const edits: [string, (s: Record<string, unknown>) => void][] = [
+      ['missing', s => delete s.amountDecimals],
+      ['a list per transaction missing', s => (s.amountDecimals = [])],
+      ['above 18', s => (s.amountDecimals = [[{at: 0, decimals: 19}]])],
+      ['a negative index', s => (s.amountDecimals = [[{at: -1, decimals: 9}]])],
+      ['a key more', s => (s.amountDecimals = [[{at: 0, decimals: 9, mint: NOC}]])],
+      ['not a number', s => (s.amountDecimals = [[{at: 0, decimals: '9'}]])],
+    ];
+    for (const [name, edit] of edits) {
+      const copy = JSON.parse(JSON.stringify(stored)) as typeof stored;
+      edit(copy.sim);
+      expect([name, simStateOf(copy)]).toEqual([name, null]);
+    }
+  });
+});
````

The decoder — B1c-2's ATA test names the token program; its `create` was built from the four FIELDS (four accounts) and is built from the builder's six; one test for Token-2022's program and the six-account minimum (with the positive controls):

`extension/src/background/dapp/decode/__tests__/decode.test.ts`:

````diff
diff --git a/extension/src/background/dapp/decode/__tests__/decode.test.ts b/extension/src/background/dapp/decode/__tests__/decode.test.ts
index 5986b44..0b5c043 100644
--- a/extension/src/background/dapp/decode/__tests__/decode.test.ts
+++ b/extension/src/background/dapp/decode/__tests__/decode.test.ts
@@ -4,6 +4,7 @@ import {
   Keypair,
   NONCE_ACCOUNT_LENGTH,
   PublicKey,
+  SYSVAR_RENT_PUBKEY,
   SystemProgram,
   Transaction,
   TransactionInstruction,
@@ -306,16 +307,32 @@ describe('decodeInstructions — ATA, Compute Budget, the presale program', () =
     const ata = findAssociatedTokenAddress(TO, MINT);
     const idem = one(buildCreateAtaIdempotentInstruction(ME, ata, TO, MINT));
     expect(idem).toMatchObject({programId: ATA_PROGRAM, program: 'associated-token', name: 'createIdempotent'});
+    // B1c-3 (the final review's triage row 1): the token program (account 5) is named too — classic or Token-2022.
     expect(idem.fields.map(f => [f.name, f.value.kind === 'address' ? f.value.value : null])).toEqual([
       ['payer', ME.toBase58()],
       ['account', ata.toBase58()],
       ['wallet', TO.toBase58()],
       ['mint', MINT.toBase58()],
+      ['tokenProgram', TOKEN_PROGRAM],
     ]);
-    const create = one(new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), keys: idem.fields.map(f => ({pubkey: new PublicKey(f.value.kind === 'address' ? (f.value.value ?? '') : ''), isSigner: false, isWritable: true})), data: Buffer.alloc(0)}));
+    const built = buildCreateAtaIdempotentInstruction(ME, ata, TO, MINT);
+    const create = one(new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), keys: built.keys, data: Buffer.alloc(0)}));
     expect(create.name).toBe('create');
   });
 
+  it('associated token account (B1c-3): a Token-2022 create names Token-2022’s program; fewer than the six accounts the program reads is unknown (fail closed)', () => {
+    const built = buildCreateAtaIdempotentInstruction(ME, TO, ME, MINT);
+    const keys = built.keys.map((k, i) => (i === 5 ? {...k, pubkey: new PublicKey(TOKEN_2022_PROGRAM)} : k));
+    const t22 = one(new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), keys, data: Buffer.from([1])}));
+    expect(t22.fields.at(-1)).toEqual({name: 'tokenProgram', value: {kind: 'address', value: TOKEN_2022_PROGRAM}});
+    for (const n of [4, 5]) {
+      const short = one(new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), keys: built.keys.slice(0, n), data: Buffer.from([1])}));
+      expect([n, short.program, short.name, short.fields]).toEqual([n, null, null, []]);
+    }
+    // Positive control: exactly six decode; a seventh (the legacy rent sysvar) is not read.
+    expect(one(new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), keys: [...built.keys, {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false}], data: Buffer.from([1])})).name).toBe('createIdempotent');
+  });
+
   it('compute budget: the unit limit and price', () => {
     expect(one(ComputeBudgetProgram.setComputeUnitLimit({units: 200_000}))).toMatchObject({program: 'compute-budget', name: 'setComputeUnitLimit', fields: [{name: 'units', value: {kind: 'number', value: '200000'}}]});
     expect(one(ComputeBudgetProgram.setComputeUnitPrice({microLamports: 10_000}))).toMatchObject({name: 'setComputeUnitPrice', fields: [{name: 'microLamports', value: {kind: 'number', value: '10000'}}]});
````

The harness's `ataCreate` takes its token program:

`extension/src/background/dapp/__tests__/txHarness.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/txHarness.ts b/extension/src/background/dapp/__tests__/txHarness.ts
index d135c13..32268ca 100644
--- a/extension/src/background/dapp/__tests__/txHarness.ts
+++ b/extension/src/background/dapp/__tests__/txHarness.ts
@@ -72,8 +72,8 @@ export const mintTo = (mint = TO, destination = ME, authority = ME, amount = 1n)
  */
 export const assign = (account = ME, programId = new PublicKey(new Uint8Array(32).fill(71))): TransactionInstruction => SystemProgram.assign({accountPubkey: account, programId});
 
-/** B1c-3: an associated-token-account createIdempotent (tag 1) of `account` for `wallet`, paid by the account — one of F10's creators. */
-export const ataCreate = (account: PublicKey, wallet = TO, mint = new PublicKey(new Uint8Array(32).fill(72))): TransactionInstruction =>
+/** B1c-3: an associated-token-account createIdempotent (tag 1) of `account` for `wallet`, paid by the account — one of F10's creators; `tokenProgram` its account 5. */
+export const ataCreate = (account: PublicKey, wallet = TO, mint = new PublicKey(new Uint8Array(32).fill(72)), tokenProgram = new PublicKey(TOKEN_PROGRAM)): TransactionInstruction =>
   new TransactionInstruction({
     programId: new PublicKey(ATA_PROGRAM),
     data: Buffer.from([1]),
@@ -83,7 +83,7 @@ export const ataCreate = (account: PublicKey, wallet = TO, mint = new PublicKey(
       {pubkey: wallet, isSigner: false, isWritable: false},
       {pubkey: mint, isSigner: false, isWritable: false},
       {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
-      {pubkey: new PublicKey(TOKEN_PROGRAM), isSigner: false, isWritable: false},
+      {pubkey: tokenProgram, isSigner: false, isWritable: false},
     ],
   });
````

#48, against the real background — Task 5's unlimited-approve test now expects the design's one banner (F2's warning beside it was Task 5's declared deviation), the assign-and-approve test two danger banners and no warning; two tests added (the approve beside an ATA create; the instruction rows); the origin tiles gain Tensor and its colour:

`extension/src/approve/__tests__/tx.test.tsx`:

````diff
diff --git a/extension/src/approve/__tests__/tx.test.tsx b/extension/src/approve/__tests__/tx.test.tsx
index 378a09d..b3406dc 100644
--- a/extension/src/approve/__tests__/tx.test.tsx
+++ b/extension/src/approve/__tests__/tx.test.tsx
@@ -14,7 +14,7 @@ import {openPage} from '../../background/dapp/__tests__/pageHarness';
 import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
 import {ME, assign, ataCreate, coSigned, mintTo, setAuthorityToNone, tokenApprove, tokenTransfer, transfer, v0} from '../../background/dapp/__tests__/txHarness';
 import {U64_MAX, tokenAccountBytes, usdcLikeMint} from '../../background/dapp/__tests__/tokenBytes';
-import {ATA_PROGRAM, TOKEN_PROGRAM} from '../../background/dapp/decode/decode';
+import {ATA_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../../background/dapp/decode/decode';
 import {dependsOnStep, pendingOf, type Flag, type RequestView} from '../client';
 import {Tx} from '../Tx';
 import {ARM_MS, FLAG_HOLD_MS} from '../useArmed';
@@ -338,6 +338,7 @@ describe('#48 dapp-tx-approval', () => {
     const tile = () => document.querySelector('.s9-origin-card .ico')?.className;
     for (const [origin, cls] of [
       ['https://jup.ag', 'ico app-ico-verified app-brand-jupiter'],
+      ['https://tensor.trade', 'ico app-ico-verified app-brand-tensor'],
       ['https://raydium.io', 'ico app-ico-verified'],
       ['https://tensr.trade', 'ico app-ico-lookalike'],
       ['https://dapp.test', 'ico app-ico-unknown'],
@@ -352,6 +353,13 @@ describe('#48 dapp-tx-approval', () => {
       cleanup();
     }
     expect(cssRule('.s9-origin-card .ico.app-brand-jupiter')).toContain('linear-gradient(135deg, #FFC800, #FF7A00)');
+    // B1c-3 (R9, controller): Tensor in one colour — #49's (the design's latest), on #46/#47/#48's tile too, never the
+    // window mockups' cyan; #49's own two tiles keep it.
+    const tensor = 'background: linear-gradient(135deg, oklch(72% 0.18 295), oklch(65% 0.16 320));';
+    expect([cssRule('.s9-origin-card .ico.app-brand-tensor'), cssRule('.s10-sheet .head-row .ico.app-tile-tensor')]).toEqual([tensor, tensor]);
+    const ext = readFileSync(join(__dirname, '..', '..', 'styles', 'design-ext.css'), 'utf8');
+    expect(ext).toContain(`.s10-app-row .ico.tensor { ${tensor} }`);
+    expect(cssRule('.s9-origin-card .ico.app-brand-tensor')).not.toContain('#00DBFF');
   });
 
   it('the design minors’ own rules: Approve at .4 while simulating; "I understand the risk" never wraps', async () => {
@@ -676,9 +684,10 @@ describe('#48 red flags (B1c-3)', () => {
     w.show();
     await simulated(w, 'Unlimited USDC spend approval');
     expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Critical · Unlimited spend approval', 'title noc-overline noc-danger']);
-    // Blocks first, then warnings (F2 names the approve), in the transaction's section.
-    expect([...document.querySelectorAll('.app-tx-item .s9-flag-banner')].map(b => b.className)).toEqual(['s9-flag-banner danger', 's9-flag-banner warn']);
-    expect(heads()).toEqual(['Unlimited USDC spend approval', 'Instructions that are not transfers']);
+    // One banner, as the design draws it, in the transaction's section: F5 names the approve, so F2 does not repeat it
+    // (the controller's ruling, plan 3 Task 6).
+    expect([...document.querySelectorAll('.app-tx-item .s9-flag-banner')].map(b => b.className)).toEqual(['s9-flag-banner danger']);
+    expect(heads()).toEqual(['Unlimited USDC spend approval']);
     const danger = document.querySelector('.s9-flag-banner.danger') as HTMLElement;
     expect(within(danger).getByText(/This transaction includes/).textContent).toBe(
       'This transaction includes a spl_token::Approve instruction with amount = u64::MAX (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move all your USDC, now and in the future, until you revoke.',
@@ -686,7 +695,6 @@ describe('#48 red flags (B1c-3)', () => {
     expect([...danger.querySelectorAll('.body code')].map(c => c.textContent)).toEqual(['spl_token::Approve', 'amount = u64::MAX']);
     expect(danger.querySelector('.body i')?.textContent).toBe('all your USDC');
     expect(danger.querySelector('.meta')?.textContent).toBe(`delegate: ${DELEGATE.toBase58()} · token: USDC mint ${USDC} · scope: u64::MAX`);
-    expect(texts('.s9-flag-banner.warn .meta')).toEqual(['#1 spl_token::Approve']);
     // The synthesized row first (an approve changes no balance), then the simulation's own (the fee).
     expect(texts('.s9-bal-row .pri')).toEqual(['USDC delegated', 'SOL']);
     expect(texts('.s9-bal-row .delta')).toEqual(['unlimited', '−0.000005']);
@@ -795,6 +803,40 @@ describe('#48 red flags (B1c-3)', () => {
     }
   });
 
+  it('an unlimited approve beside an ATA create: F5’s banner, and F2’s naming only the create', async () => {
+    const w = await openWindow();
+    holdUsdc(w);
+    await w.signTx('https://jup.ag', [v0([tokenApprove(SRC, DELEGATE, U64_MAX), ataCreate(X, ME, new PublicKey(USDC))])]);
+    w.show();
+    await simulated(w, 'Unlimited USDC spend approval');
+    expect(heads()).toEqual(['Unlimited USDC spend approval', 'Instructions that are not transfers']);
+    expect(texts('.s9-flag-banner.warn .meta')).toEqual(['#2 spl_associated_token_account::CreateIdempotent']);
+    expect(unstyled()).toEqual([]);
+  });
+
+  // B1c-3 (the final review's carried minors): a non-Checked amount with the mint's decimals, from the background's
+  // read of its source account (the window computes none); an ATA create's token program named.
+  it('instruction rows: a non-Checked approve with the mint’s decimals, a transfer from an unreadable account in base units; an ATA create names its token program', async () => {
+    const w = await openWindow();
+    holdUsdc(w);
+    const unread = new PublicKey(new Uint8Array(32).fill(86));
+    const odd = new PublicKey(new Uint8Array(32).fill(87));
+    const usdc = new PublicKey(USDC);
+    await w.signTx('https://jup.ag', [
+      v0([tokenApprove(SRC, DELEGATE, 1_500_000n), tokenTransfer(X, unread, 1_500_000n), ataCreate(X, ME, usdc), ataCreate(Y, ME, usdc, new PublicKey(TOKEN_2022_PROGRAM)), ataCreate(odd, ME, usdc, DELEGATE)]),
+    ]);
+    w.show();
+    await simulated(w, 'USDC spend approval');
+    const values = (name: string) => [...document.querySelectorAll('.s9-payload-card .app-tx-field')].filter(r => r.querySelector('.k')?.textContent === name).map(r => r.querySelector('.v'));
+    expect(values('amount').map(v => v?.textContent)).toEqual(['1.5', '1500000']);
+    expect(values('tokenProgram').map(v => [v?.querySelector('.addr-groups')?.textContent, v?.querySelector('.app-tx-addr-label')?.textContent ?? null])).toEqual([
+      [TOKEN_PROGRAM, 'spl_token'],
+      [TOKEN_2022_PROGRAM, 'spl_token_2022'],
+      [DELEGATE.toBase58(), null],
+    ]);
+    expect(unstyled()).toEqual([]);
+  });
+
   it('System assign of the wallet account (F3) and an unlimited approve in one transaction: "Critical · Blocked transaction", both banners, one field per block — "Approve anyway" only when both match; the L3 line replaced beside an authority flag', async () => {
     const w = await openWindow();
     holdUsdc(w);
@@ -802,9 +844,9 @@ describe('#48 red flags (B1c-3)', () => {
     w.show();
     await simulated(w, 'Assign / Allocate on your wallet account');
     expect(text('.top-bar .title')).toBe('Critical · Blocked transaction');
-    expect(heads()).toEqual(['Assign / Allocate on your wallet account', 'Unlimited USDC spend approval', 'Instructions that are not transfers']);
+    expect(heads()).toEqual(['Assign / Allocate on your wallet account', 'Unlimited USDC spend approval']);
     expect(texts('.s9-flag-banner.danger .body')[0]).toBe("This changes your wallet account itself. Assigned to another program, it is that program's to control; given data, it can no longer pay fees or send SOL.");
-    expect(texts('.s9-flag-banner .meta')).toEqual(['#1 system_program::Assign', `delegate: ${DELEGATE.toBase58()} · token: USDC mint ${USDC} · scope: u64::MAX`, '#1 system_program::Assign', '#2 spl_token::Approve']);
+    expect(texts('.s9-flag-banner .meta')).toEqual(['#1 system_program::Assign', `delegate: ${DELEGATE.toBase58()} · token: USDC mint ${USDC} · scope: u64::MAX`]);
     expect(texts('.s9-typed-confirm .label')).toEqual(['Type ASSIGN to enable Approve', 'Type USDC to enable Approve']);
     const anyway = () => cta('Approve anyway');
     expect([anyway().className, anyway().querySelector('svg')]).toEqual(['btn btn-destructive app-cta-wide app-cta-gated', null]);
````

#46's Q26:

`extension/src/approve/__tests__/sign.test.tsx`:

````diff
diff --git a/extension/src/approve/__tests__/sign.test.tsx b/extension/src/approve/__tests__/sign.test.tsx
index 098dfd5..6cd9902 100644
--- a/extension/src/approve/__tests__/sign.test.tsx
+++ b/extension/src/approve/__tests__/sign.test.tsx
@@ -159,9 +159,16 @@ describe('#46 sign-message', () => {
     await screen.findByText('Sign this message?');
     expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
     expect(document.querySelector('.s9-msg-preview')).toBeNull();
-    // Rev 3.2 (Q26, owner-delegated 2026-10-12): the line under the title says why, in the lede's body tier.
-    const why = document.querySelector('.app-approve-title + p');
-    expect([why?.textContent, why?.className]).toEqual(['This request can no longer be signed. Reject it and ask the site to try again.', 'noc-body-sm app-muted app-approve-lede']);
+    // Rev 3.2 (Q26, owner-delegated 2026-10-12), drawn as #48 draws it (B1c-3, the carried visual item): a danger flag
+    // banner under the title, the alert icon, the role — never the lede's plain line.
+    const why = document.querySelector('.app-approve-title + .s9-flag-banner');
+    expect([why?.className, why?.getAttribute('role'), why?.querySelector('.head')?.textContent, why?.querySelectorAll('svg').length]).toEqual([
+      's9-flag-banner danger app-tx-block',
+      'alert',
+      'This request can no longer be signed. Reject it and ask the site to try again.',
+      1,
+    ]);
+    expect(document.querySelector('.app-approve-lede')).toBeNull();
     expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
     fireEvent.click(cta('Reject'));
     await waitFor(() => expect(w.closed.n).toBe(1));
````

#11's pending strip, with the computed style:

`extension/src/app/__tests__/Home.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Home.test.tsx b/extension/src/app/__tests__/Home.test.tsx
index f35a32a..3063c64 100644
--- a/extension/src/app/__tests__/Home.test.tsx
+++ b/extension/src/app/__tests__/Home.test.tsx
@@ -699,6 +699,45 @@ describe('#11: a site’s transaction waiting for its confirmation (B1c-2)', ()
     expect(screen.queryByText(/waits for your confirmation/)).toBeNull();
   });
 
+  // B1c-3 (the carried visual item): B1b's pending-send strip sits on the dApp strip's gutter with its trailing
+  // chevron — before, `.app-strip`'s width: 100% beside `.app-banner`'s side margins ran it past the popup's right edge.
+  // Computed in happy-dom from the real sheets (the design system's tokens resolve the margins); the visual pass
+  // measures the viewport.
+  it('the pending strip: on the dApp strip’s gutter, its own chevron, never wider than the popup (computed style)', async () => {
+    const sheets = UI_SHEETS.map(sheet => {
+      const style = document.createElement('style');
+      style.textContent = readFileSync(join(__dirname, '..', '..', '..', sheet), 'utf8');
+      return document.head.appendChild(style);
+    });
+    try {
+      await renderHome({
+        before: async ext => {
+          await waitingDapp(ext);
+          await ext.local.set(PENDING_KEY, [pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]);
+        },
+      });
+      const dapp = await screen.findByRole('button', {name: 'A transaction from jup.ag waits for your confirmation'});
+      const pending = (await screen.findByText('Sending 2.48 SOL · pending')).closest('button') as HTMLButtonElement;
+      expect(pending.className).toBe('banner info app-banner app-strip app-pending-strip');
+      expect(pending.querySelectorAll('.app-strip-chev svg')).toHaveLength(1);
+      expect(unstyledClasses(pending, selectorsOf(UI_SHEETS))).toEqual([]);
+      const box = (el: Element) => {
+        const cs = getComputedStyle(el);
+        return {width: cs.width, marginLeft: cs.marginLeft, marginRight: cs.marginRight, alignItems: cs.alignItems};
+      };
+      expect(box(pending)).toEqual({width: 'auto', marginLeft: '20px', marginRight: '20px', alignItems: 'center'});
+      expect(box(pending)).toEqual(box(dapp));
+      expect(getComputedStyle(pending.querySelector('.app-strip-chev') as Element).flexShrink).toBe('0');
+      // Negative control: the strip as B1b drew it — width 100% and side margins, wider than its container.
+      const bare = document.createElement('button');
+      bare.className = 'banner info app-banner app-strip';
+      document.querySelector('.s-dash')?.append(bare);
+      expect(box(bare)).toEqual({width: '100%', marginLeft: '16px', marginRight: '16px', alignItems: 'flex-start'});
+    } finally {
+      for (const s of sheets) s.remove();
+    }
+  });
+
   // Fix round 1 item 5 (rule 6): the strip is a LockedButton — a second click before `disabled` is lifted opens #10
   // no second time. happy-dom drops `disabled` before React re-renders it, so the test lifts it itself (as Send's).
   it('the strip is a LockedButton: a double click opens #10 once', async () => {
````

#10 — the description is unsigned, the headline unsigned, the rows keep the minus (the new row strings written as `−` escapes; the unchanged ones keep the file's literal):

`extension/src/unlock/__tests__/challenge.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/challenge.test.ts b/extension/src/unlock/__tests__/challenge.test.ts
index db860e4..c4abf1e 100644
--- a/extension/src/unlock/__tests__/challenge.test.ts
+++ b/extension/src/unlock/__tests__/challenge.test.ts
@@ -48,9 +48,10 @@ describe('describeChallenge: a dApp’s transaction (B1c-2)', () => {
       site: 'jup.ag',
       transactions: 2,
       outgoing: [
-        {label: 'SOL', amount: '−0.001005', mint: null},
-        {label: 'USDC', amount: '−250', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'},
-        {label: 'Token', amount: '−777 (base units)', mint: RECIPIENT},
+        // B1c-3: unsigned — what leaves; #10's rows add the minus, its headline does not (reauth.ts).
+        {label: 'SOL', amount: '0.001005', mint: null},
+        {label: 'USDC', amount: '250', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'},
+        {label: 'Token', amount: '777 (base units)', mint: RECIPIENT},
       ],
       omitted: 0,
       reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required to approve a token allowance.'],
````

`extension/src/unlock/__tests__/reauthScreen.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/reauthScreen.test.ts b/extension/src/unlock/__tests__/reauthScreen.test.ts
index ae94fce..bea373d 100644
--- a/extension/src/unlock/__tests__/reauthScreen.test.ts
+++ b/extension/src/unlock/__tests__/reauthScreen.test.ts
@@ -626,8 +626,9 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
   it('a dApp’s transaction: "You are about to approve", the site and what leaves the account; confirmed → back to the approval window, nothing sent here', async () => {
     const {h, broadcast} = await shown(DAPP);
     expect(text(el('ra-about'))).toBe('You are about to approve');
-    // Final review MUST-FIX 2: the intent card leads with the headline amount, as #10 draws it (ix:6061-6064).
-    expect([visible(el('ra-amount-row')), text(el('ra-amount')), text(el('ra-symbol'))]).toEqual([true, '−0.001005', 'SOL']);
+    // Final review MUST-FIX 2: the intent card leads with the headline amount, as #10 draws it (ix:6061-6064) — B1c-3:
+    // unsigned, like the design's send headline (ix:6062); the minus stays on the rows (below, and the next tests).
+    expect([visible(el('ra-amount-row')), text(el('ra-amount')), text(el('ra-symbol'))]).toEqual([true, '0.001005', 'SOL']);
     expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag']);
     expect([...el('ra-reasons').children].map(text)).toEqual(['Re-auth required for the first send to a new address.']);
     expect(text(el('ra-cancel'))).toBe('Cancel');
@@ -654,7 +655,7 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
     await shown({...DAPP, transactions: 2, outgoing: [{mint: null, symbol: 'SOL', amount: '5001', decimals: 9}, {mint: USDC, symbol: 'USDC', amount: '250000000', decimals: 6}]});
     expect(visible(el('ra-amount-row'))).toBe(false);
-    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'Transactions2', 'SOL−0.000005001', 'USDC−250']);
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'Transactions2', 'SOL\u22120.000005001', 'USDC\u2212250']);
     loadPage();
     await shown({...DAPP, omitted: 1});
     expect(visible(el('ra-amount-row'))).toBe(false);
@@ -694,7 +695,7 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     await shown({...DAPP, reasons: ['override'], flags: [{tx: 0, row: 'F4', word: 'AUTHORITY', step: null}]});
     // A single transaction: the row names what, the headline is still the one asset leaving.
     expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'SetAuthority on an account you own']);
-    expect([visible(el('ra-amount-row')), text(el('ra-amount'))]).toEqual([true, '−0.001005']);
+    expect([visible(el('ra-amount-row')), text(el('ra-amount'))]).toEqual([true, '0.001005']);
   });
 
   it('a dApp’s transaction: expired and locked say what is true for a site’s request; Cancel only closes the tab', async () => {
````

The visual pass's #10 headline (not run in this task's gates — Task 8 runs the visual specs):

`extension/e2e/visual-dapp-tx.spec.ts`:

````diff
diff --git a/extension/e2e/visual-dapp-tx.spec.ts b/extension/e2e/visual-dapp-tx.spec.ts
index cb82233..f076edb 100644
--- a/extension/e2e/visual-dapp-tx.spec.ts
+++ b/extension/e2e/visual-dapp-tx.spec.ts
@@ -170,9 +170,10 @@ test('visual · #48: simulating, simulated, a batch, re-authentication, approvin
     await tab.setViewportSize({width: 412, height: 916});
     await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
     await expect(tab.locator('#ra-rows')).toContainText('jup.ag');
-    // Final review MUST-FIX 2: the intent card's headline amount (#10 ix:6061-6064) — what leaves the account.
+    // Final review MUST-FIX 2: the intent card's headline amount (#10 ix:6061-6064) — what leaves the account; B1c-3:
+    // unsigned, as the design's send headline (the minus stays on the rows).
     await expect(tab.locator('#ra-amount-row')).toBeVisible();
-    await expect(tab.locator('#ra-amount')).toHaveText(new RegExp(`^${MINUS}0\\.\\d+$`));
+    await expect(tab.locator('#ra-amount')).toHaveText(/^0\.\d+$/);
     await expect(tab.locator('#ra-symbol')).toHaveText('SOL');
     await shot(tab, '10-dapp', {fullPage: false});
     await tab.close();
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx tsc --noEmit; echo $?` → `2` (eight errors, all `src/background/dapp/__tests__/simulate.test.ts(…): error TS2339: Property 'amountDecimals' does not exist on type 'TxSimulation'.`). `npx vitest run src/background/dapp/__tests__/redFlags.test.ts src/background/dapp/__tests__/simulate.test.ts src/background/dapp/decode/__tests__/decode.test.ts src/approve/__tests__/tx.test.tsx src/approve/__tests__/sign.test.tsx src/app/__tests__/Home.test.tsx src/unlock/__tests__/challenge.test.ts src/unlock/__tests__/reauthScreen.test.ts` → **Test Files 8 failed (8), Tests 28 failed | 260 passed (288)**: redFlags 10 (`expected [ 'unlimited-approve', 'non-transfer' ] to deeply equal [ 'unlimited-approve' ]`, `… [ 'assign', 'non-transfer' ] …`, the order test `expected [ +0, 1, 2, 4 ] to deeply equal [ +0, 1 ]` …; the closeAccount, bounded-plus-chain and F7 cases are controls and pass on both trees), simulate 6 (the bounded list; the five decimals tests `expected undefined to deeply equal [ [ { at: +0, decimals: 9 }, …(2) ] ]`, simStateOf `expected [ 'missing', …(1) ] to deeply equal [ 'missing', null ]`), decode 2 (`… [ 'payer', …(1) ], …(3) ] to deeply equal [ …(4) ]`, `expected { name: 'mint', … } to deeply equal { name: 'tokenProgram', … }`), tx 5 (one banner: `expected [ 's9-flag-banner danger', …(1) ] to deeply equal [ 's9-flag-banner danger' ]`; the ATA-create one `expected [ '#1 spl_token::Approve', …(1) ] …`; the rows `expected [ '1500000', '1500000' ] to deeply equal [ '1.5', '1500000' ]`; the assign one; the tiles), sign 1, Home 1 (`expected 'banner info app-banner app-strip' to be 'banner info app-banner app-strip app-…'`), challenge 1, reauthScreen 2 (`expected [ true, '−0.001005', 'SOL' ] to deeply equal [ true, '0.001005', 'SOL' ]`).

- [ ] **Step 3: Implement.**

F2, last, without what a more specific flag names:

`extension/src/background/dapp/redFlags.ts`:

````diff
diff --git a/extension/src/background/dapp/redFlags.ts b/extension/src/background/dapp/redFlags.ts
index 0df74da..e1a5301 100644
--- a/extension/src/background/dapp/redFlags.ts
+++ b/extension/src/background/dapp/redFlags.ts
@@ -12,7 +12,7 @@ import {usesDurableNonce} from './txRequest';
  * proxy. Pure — the simulation (Task 3) gathers the reads and stores the result; the window only renders it (C13).
  *
  * F1 unknown program (warn) · F2 an instruction of a decoded program that is not a transfer (warn; Compute Budget is
- * the fee — the only exemption) · F3 System assign / allocate (and their …WithSeed forms) of the wallet account, or the
+ * the fee — the only exemption; an instruction F3, F4, F5, F6 or F8 already names is not repeated) · F3 System assign / allocate (and their …WithSeed forms) of the wallet account, or the
  * wallet account owned by another program or holding data after the simulation (block, ASSIGN) · F4 SetAuthority on a
  * token account whose owner field is the wallet, on a mint whose mint or freeze authority is the wallet, or signed by
  * the wallet as the current authority; or, in chain state, an own token account's owner or close authority changed, a
@@ -155,11 +155,6 @@ function txFlags(input: RedFlagInput, t: TxFlagInput): RedFlag[] {
   const first = unknown[0];
   if (first !== undefined) out.push({kind: 'unknown-program', severity: 'warn', word: null, at: first.index, programs: [...new Set(unknown.map(x => x.ix.programId))]});
 
-  // F2
-  const named = indexed.flatMap(({ix, index}) => (ix.program === null || ix.program === 'compute-budget' || isTransfer(ix) ? [] : [{index, program: ix.program, name: ix.name}]));
-  const firstNamed = named[0];
-  if (firstNamed !== undefined) out.push({kind: 'non-transfer', severity: 'warn', word: null, at: firstNamed.index, instructions: named});
-
   // F3
   const assigns = indexed.flatMap(({ix, index}) => (ix.program === 'system' && ix.name !== null && ASSIGNS.includes(ix.name) && addressField(ix, 'account') === account ? [{index, program: ix.program, name: ix.name}] : []));
   const selfPre = pre.get(account) ?? null;
@@ -263,9 +258,31 @@ function txFlags(input: RedFlagInput, t: TxFlagInput): RedFlag[] {
   if (usesDurableNonce(t.tx)) out.push({kind: 'durable-nonce', severity: 'warn', word: null, at: 0});
   if (t.firstSend && input.reasons.includes('whole-balance-to-new')) out.push({kind: 'whole-balance', severity: 'warn', word: null, at: null});
   if (t.outcome.status === 'dependent') out.push({kind: 'dependent', severity: 'block', word: OVERRIDE_WORDS.dependent, at: null, on: t.outcome.on});
+
+  // F2, last: an instruction a more specific flag of this transaction already names (F3, F4, F5, F6, F8) is not repeated.
+  const specific = new Set(out.flatMap(namedBy));
+  const named = indexed.flatMap(({ix, index}) => (ix.program === null || ix.program === 'compute-budget' || isTransfer(ix) || specific.has(index) ? [] : [{index, program: ix.program, name: ix.name}]));
+  const firstNamed = named[0];
+  if (firstNamed !== undefined) out.push({kind: 'non-transfer', severity: 'warn', word: null, at: firstNamed.index, instructions: named});
   return out;
 }
 
+/** The instructions a flag names by index — F3's and F4's, F5's and F6's decoded approvals, F8's first instruction. */
+function namedBy(f: RedFlag): number[] {
+  switch (f.kind) {
+    case 'assign':
+    case 'set-authority':
+      return f.instructions.map(x => x.index);
+    case 'unlimited-approve':
+    case 'bounded-approve':
+      return f.approvals.flatMap(a => (a.at === null ? [] : [a.at]));
+    case 'durable-nonce':
+      return [f.at];
+    default:
+      return [];
+  }
+}
+
 /** The words the user must type: one per (transaction, block kind), in the transactions' order and each one's flag order. */
 export function expectedOverrides(flags: readonly (readonly RedFlag[])[]): {tx: number; word: string}[] {
   return flags.flatMap((list, tx) => list.flatMap(f => (f.severity === 'block' ? [{tx, word: f.word}] : [])));
````

The decimals of a non-Checked amount — read from the pre-state the loop already holds, the mints among the one capped mint read, stored with the simulation:

`extension/src/background/dapp/simulate.ts`:

````diff
diff --git a/extension/src/background/dapp/simulate.ts b/extension/src/background/dapp/simulate.ts
index c59ab53..3d41015 100644
--- a/extension/src/background/dapp/simulate.ts
+++ b/extension/src/background/dapp/simulate.ts
@@ -36,6 +36,8 @@ import {mintInfo, tokenAccountInfo} from './tokenState';
 export const DEFAULT_UNITS_PER_INSTRUCTION = 200_000;
 export const MAX_COMPUTE_UNITS = 1_400_000;
 export const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
+/** The most decimals #48 formats an amount with (the window's own bound); a mint with more stays in base units. */
+const MAX_DECIMALS = 18;
 /** Decimals the wallet knows without a read (SOL's own and its wrapped mint, NOC, USDC, USDT). */
 const KNOWN_DECIMALS: ReadonlyMap<string, number> = new Map([
   [WRAPPED_SOL_MINT, 9],
@@ -71,10 +73,49 @@ export interface TxSimulation {
   reasons: DappReauthReason[];
   /** B1c-3: per transaction, its red flags (redFlags.ts), in the order the window shows them. */
   flags: RedFlag[][];
+  /**
+   * B1c-3: per transaction, the decimals of each non-Checked Token / Token-2022 `transfer`, `approve` or `burn` (by its
+   * instruction index) whose source account the pre-state reads as a token account of that instruction's program —
+   * its mint's, as the simulation knows them (0–18); #48 shows that amount with them, every other one in base units.
+   */
+  amountDecimals: AmountDecimals[][];
   /** An upper bound of the dApp blockhash's last valid height (the latest blockhash's, read now): a pending send's expiry check waits at least this long. */
   lastValidBlockHeight: number;
 }
 
+export interface AmountDecimals {
+  at: number;
+  decimals: number;
+}
+
+/** The non-Checked amounts a token instruction carries without decimals, and the account its amount leaves. */
+const NON_CHECKED: Readonly<Record<string, string>> = {transfer: 'source', approve: 'source', burn: 'account'};
+
+/**
+ * B1c-3: the mint of each non-Checked transfer / approve / burn's source account, by instruction index — only when
+ * the pre-state reads it as a token account of the instruction's own program (a burn: of the mint it names); the
+ * token program refuses any other, so no other mint is named.
+ */
+function amountMintsOf(decoded: readonly DecodedInstruction[], pre: ReadonlyMap<string, AccountData | null>): {at: number; mint: string}[] {
+  return decoded.flatMap((ix, at) => {
+    const role = (ix.program === 'token' || ix.program === 'token-2022') && ix.name !== null ? NON_CHECKED[ix.name] : undefined;
+    const source = role === undefined ? null : addressField(ix, role);
+    const state = source === null ? null : (pre.get(source) ?? null);
+    const info = state === null ? null : tokenAccountInfo(state.data, state.owner);
+    if (info === null || info.program !== ix.program || (ix.name === 'burn' && addressField(ix, 'mint') !== info.mint)) return [];
+    return [{at, mint: info.mint}];
+  });
+}
+
+/** `decoded` with each non-Checked amount `list` names given its decimals (txDetail, for #48); every other field as decoded. */
+export function withAmountDecimals(decoded: DecodedInstruction[], list: readonly AmountDecimals[]): DecodedInstruction[] {
+  return decoded.map((ix, at) => {
+    const decimals = list.find(x => x.at === at)?.decimals;
+    if (decimals === undefined) return ix;
+    return {...ix, fields: ix.fields.map(f => (f.name === 'amount' && f.value.kind === 'amount' && f.value.decimals === null ? {name: f.name, value: {kind: 'amount', value: f.value.value, decimals}} : f))};
+  });
+}
+
 /**
  * `a`'s state as a token account owned by `owner` — read from CHAIN STATE alone (fix round 1, I1: never the decoded
  * instruction, which a dApp program can route an Approve or a close-authority change through by CPI without any
@@ -216,6 +257,8 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
   let slot = 0;
   const outcomes: TxOutcome[] = [];
   const flagInputs: TxFlagInput[] = [];
+  /** Per transaction, its non-Checked amounts' mints (B1c-3). */
+  const amountMints: {at: number; mint: string}[][] = [];
   /** Per transaction, the accounts it creates (F10). */
   const created: Set<string>[] = [];
   let approvalFromChain = false;
@@ -232,6 +275,7 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
     // otherwise show +post instead of post − pre).
     const preAccounts = await deps.reader.getAccountsData(addresses);
     const pre = new Map(addresses.map((a, j) => [a, preAccounts[j] ?? null]));
+    amountMints.push(amountMintsOf(decoded, pre));
     const firstSend = firstSendOf(decoded, pre, account, input.known, a => before.has(a));
     const sim = await deps.reader.simulateTransaction(base64.encode(input.wires[i] ?? new Uint8Array()), {accounts: addresses});
     slot = Math.max(slot, sim.slot);
@@ -305,7 +349,8 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
   // own decimals with the wallet's table) and the decimals the holdings did not tell (a mint the account did not hold
   // before). At most one read's worth: a mint past MAX_MULTIPLE_ACCOUNTS is not read — it warns that it could not be
   // read (Q36) and its amounts stay in base units (fail closed, never an unreachable proxy).
-  const unknownMints = [...new Set(outcomes.flatMap(o => (o.ok ? o.changes.map(c => c.mint) : [])).filter((m): m is string => m !== null && !decimals.has(m)))];
+  const changed = outcomes.flatMap(o => (o.ok ? o.changes.map(c => c.mint) : []));
+  const unknownMints = [...new Set([...changed, ...amountMints.flat().map(x => x.mint)].filter((m): m is string => m !== null && !decimals.has(m)))];
   const wanted = [...new Set([...flagMints({account, txs: flagInputs}), ...unknownMints])].slice(0, MAX_MULTIPLE_ACCOUNTS);
   const mintData = wanted.length > 0 ? await deps.reader.getAccountsData(wanted) : [];
   const mints = new Map(wanted.map((m, i) => [m, mintData[i] ?? null]));
@@ -338,6 +383,12 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
     thresholdCents: input.thresholdCents,
   });
   const flags = redFlagsOf({account, txs: flagInputs, mints, reasons: base});
+  const amountDecimals = amountMints.map(list =>
+    list.flatMap(({at, mint}) => {
+      const d = decimals.get(mint);
+      return d !== undefined && d <= MAX_DECIMALS ? [{at, decimals: d}] : [];
+    }),
+  );
   // The override rule (spec §3.3): a request with any block re-authenticates — a dependent step is always one.
   const reasons: DappReauthReason[] = expectedOverrides(flags).length > 0 ? [...base, 'override'] : base;
   return {
@@ -349,6 +400,7 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
     outcomes,
     reasons,
     flags,
+    amountDecimals,
     lastValidBlockHeight: latest.lastValidBlockHeight,
   };
 }
@@ -410,6 +462,18 @@ function outcomeOf(x: unknown): TxOutcome | null {
   return {ok: true, changes: changes as BalanceChange[], unitsConsumed: o.unitsConsumed, unitLimit: o.unitLimit, feeLamports: o.feeLamports};
 }
 
+/** One transaction's stored non-Checked decimals, rebuilt; null when any entry is not exactly {at, decimals ≤ 18}. */
+function amountDecimalsOf(x: unknown): AmountDecimals[] | null {
+  if (!Array.isArray(x)) return null;
+  const out: AmountDecimals[] = [];
+  for (const v of x as unknown[]) {
+    const o = obj(v);
+    if (o === null || Object.keys(o).length !== 2 || !isInt(o.at) || !isInt(o.decimals) || o.decimals > MAX_DECIMALS) return null;
+    out.push({at: o.at, decimals: o.decimals});
+  }
+  return out;
+}
+
 /** A stored SimState, rebuilt field by field (fresh objects, never the stored ones); null when anything is off — it is then simulated again. */
 export function simStateOf(x: unknown): SimState | null {
   const o = obj(x);
@@ -432,6 +496,8 @@ export function simStateOf(x: unknown): SimState | null {
     return !o.ok && o.error === 'dependent' ? on === o.on - 1 : on === undefined;
   });
   if (!stepsAgree) return null;
+  const amountDecimals = Array.isArray(s.amountDecimals) ? (s.amountDecimals as unknown[]).map(amountDecimalsOf) : null;
+  if (amountDecimals === null || amountDecimals.length !== outcomes.length || amountDecimals.some(a => a === null)) return null;
   return {
     status: 'ok',
     sim: {
@@ -443,6 +509,7 @@ export function simStateOf(x: unknown): SimState | null {
       outcomes: outcomes as TxOutcome[],
       reasons: (s.reasons as DappReauthReason[]).slice(),
       flags: lists,
+      amountDecimals: amountDecimals as AmountDecimals[][],
       lastValidBlockHeight: s.lastValidBlockHeight,
     },
   };
````

`txDetail` applies them to the decoded instructions it sends the window:

`extension/src/background/dapp/signTx.ts`:

````diff
diff --git a/extension/src/background/dapp/signTx.ts b/extension/src/background/dapp/signTx.ts
index ed5150b..aac27da 100644
--- a/extension/src/background/dapp/signTx.ts
+++ b/extension/src/background/dapp/signTx.ts
@@ -18,7 +18,7 @@ import {firstSignature} from '../../../../core/solana/broadcast';
 import {tokenForMint, WALLET_TOKENS} from '../../../../core/solana/balances';
 import {runtimeFor} from './ports';
 import {answer, queueAccess} from './queue';
-import {feeOf, simulateTransactions, type SimState, type TxOutcome} from './simulate';
+import {feeOf, simulateTransactions, withAmountDecimals, type SimState, type TxOutcome} from './simulate';
 import {overridesMatch, type RedFlag} from './redFlags';
 import {grantIn, putGrant, type Entry, type Tx} from './store';
 import {slotOf} from './txRequest';
@@ -157,7 +157,7 @@ export async function txDetail(ext: Ext, e: Entry, session: readonly {publicKey:
   const sim = e.sim?.status === 'ok' ? e.sim.sim : null;
   const transactions = parsed.txs.map((p, i): TxItemView => {
     const keys = sim?.keys[i];
-    const instructions = keys !== undefined ? decodeInstructions(p, {keys}) : p.lookups.length === 0 ? decodeInstructions(p, resolveKeys(p, new Map())) : null;
+    const instructions = keys !== undefined ? withAmountDecimals(decodeInstructions(p, {keys}), sim?.amountDecimals[i] ?? []) : p.lookups.length === 0 ? decodeInstructions(p, resolveKeys(p, new Map())) : null;
     const local = instructions === null ? null : feeOf(p, instructions);
     return {
       version: p.version,
````

The ATA create's token program:

`extension/src/background/dapp/decode/decode.ts`:

````diff
diff --git a/extension/src/background/dapp/decode/decode.ts b/extension/src/background/dapp/decode/decode.ts
index 4014501..444b3e7 100644
--- a/extension/src/background/dapp/decode/decode.ts
+++ b/extension/src/background/dapp/decode/decode.ts
@@ -395,9 +395,11 @@ function token(r: Reader, acc: Acc, names: readonly string[]): Known | null {
 function ata(r: Reader, acc: Acc): Known | null {
   const tag = r.data.length === 0 ? 0 : r.u8();
   if (tag === 0 || tag === 1) {
+    // B1c-3: the token program (account 5, after the System program) is named — the program reads all six accounts.
     const accs = acc4(acc, 0, 1, 2, 3);
-    if (accs === null || !r.done()) return null;
-    const fields = [addr('payer', accs[0]), addr('account', accs[1]), addr('wallet', accs[2]), addr('mint', accs[3])];
+    const tokenProgram = acc2(acc, 4, 5);
+    if (accs === null || tokenProgram === null || !r.done()) return null;
+    const fields = [addr('payer', accs[0]), addr('account', accs[1]), addr('wallet', accs[2]), addr('mint', accs[3]), addr('tokenProgram', tokenProgram[1])];
     return {name: tag === 0 ? 'create' : 'createIdempotent', fields};
   }
   if (tag === 2) {
````

#48 names a token program an address field holds:

`extension/src/approve/Tx.tsx`:

````diff
diff --git a/extension/src/approve/Tx.tsx b/extension/src/approve/Tx.tsx
index aec9f92..30cbff8 100644
--- a/extension/src/approve/Tx.tsx
+++ b/extension/src/approve/Tx.tsx
@@ -20,6 +20,11 @@ const PROGRAM_NAMES: Record<ProgramKey, string> = {
   'compute-budget': 'compute_budget',
   presale: 'noctura_presale',
 };
+/** B1c-3: the token programs an address field can name (an ATA create's `tokenProgram`), shown by their mono name beside the address. */
+const TOKEN_PROGRAMS: Readonly<Partial<Record<string, ProgramKey>>> = {
+  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'token',
+  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'token-2022',
+};
 /** The wallet's own tokens by mint (core/presale/addresses.ts; the approval window imports no core): symbol, tile and decimals. */
 const KNOWN_MINTS: Record<string, {symbol: string; tile: string}> = {
   B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW: {symbol: 'NOC', tile: 'noc'},
@@ -129,10 +134,15 @@ function FieldValueView({value, labels}: {value: FieldValue; labels: readonly Ad
   switch (value.kind) {
     case 'address': {
       const label = labels.find(l => l.address === value.value);
+      const program = TOKEN_PROGRAMS[value.value];
       return (
         <>
           <AddressGroups address={value.value} />
-          {label === undefined ? null : <span className="app-tx-addr-label noc-caption">{label.kind === 'account' ? TX_TEXT.ownAccount(label.name) : fromBook(label.name)}</span>}
+          {label !== undefined ? (
+            <span className="app-tx-addr-label noc-caption">{label.kind === 'account' ? TX_TEXT.ownAccount(label.name) : fromBook(label.name)}</span>
+          ) : program !== undefined ? (
+            <span className="app-tx-addr-label noc-caption">{PROGRAM_NAMES[program]}</span>
+          ) : null}
         </>
       );
     }
````

#46's Q26:

`extension/src/approve/Sign.tsx`:

````diff
diff --git a/extension/src/approve/Sign.tsx b/extension/src/approve/Sign.tsx
index 038fc4a..573f1b7 100644
--- a/extension/src/approve/Sign.tsx
+++ b/extension/src/approve/Sign.tsx
@@ -50,7 +50,7 @@ export function Sign({request, waiting, notice, busy, onDecide}: {request: Reque
    * Fix round 1, item 2 (promoted): `sign` is null when the account is no longer unlocked, or the message was
    * refused (decide.ts's viewOf/signDetail) — the request itself is still live. A blank window with no ✕ and no
    * Reject would trap the user; show the bare top bar and a Reject-only exit. The design never drew this state: its
-   * one line, Q26, is the owner-delegated string of rev 3.2, set in the lede's own body tier under the title.
+   * one line, Q26, is the owner-delegated string of rev 3.2 — B1c-3: drawn as #48 draws it, a danger flag banner.
    */
   if (detail === null) {
     return (
@@ -59,7 +59,12 @@ export function Sign({request, waiting, notice, busy, onDecide}: {request: Reque
         <div className="scroll-area app-approve-scroll">
           {notice ? <BudgetNotice /> : null}
           <h1 className="noc-h1 app-approve-title">{SIGN_TEXT.title}</h1>
-          <p className="noc-body-sm app-muted app-approve-lede">{SIGN_TEXT.cannotSign}</p>
+          <div className="s9-flag-banner danger app-tx-block" role="alert">
+            <ExtIcon name="alert-triangle" size={18} />
+            <div>
+              <p className="head">{SIGN_TEXT.cannotSign}</p>
+            </div>
+          </div>
         </div>
         <Waiting n={waiting} />
         <div className="sticky-bar">
````

#11's pending strip:

`extension/src/app/screens/Home.tsx`:

````diff
diff --git a/extension/src/app/screens/Home.tsx b/extension/src/app/screens/Home.tsx
index 99fc578..b911eab 100644
--- a/extension/src/app/screens/Home.tsx
+++ b/extension/src/app/screens/Home.tsx
@@ -46,16 +46,22 @@ function NetBanner({mode, sustainedNow, lastSync, failures, now}: {mode: NetMode
   );
 }
 
-/** #11's pending strip: an open send of this account, which opens #21 (or #54 once it is stuck). */
+/**
+ * #11's pending strip: an open send of this account, which opens #21 (or #54 once it is stuck). B1c-3: on the dApp
+ * strip's gutter, with the same trailing chevron — a strip that opens something says so.
+ */
 function PendingStrip({p, now, onOpen}: {p: Pending; now: number; onOpen: () => void}) {
   const slow = p.state === 'stuck' || now - p.createdAt > 80_000;
   const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
   return (
-    <button type="button" className="banner info app-banner app-strip" onClick={onOpen}>
+    <button type="button" className="banner info app-banner app-strip app-pending-strip" onClick={onOpen}>
       <ExtIcon name="send" size={18} />
       <span className="noc-body-sm">
         Sending {amount} {p.intent.token} · {slow ? 'taking longer than usual' : 'pending'}
       </span>
+      <span className="app-strip-chev">
+        <ExtIcon name="chevron-right" size={18} />
+      </span>
     </button>
   );
 }
````

The pending strip on the dApp strip's rules; Tensor's one colour:

`extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 257d061..b688e97 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -120,14 +120,17 @@ body:has(.app-popup) {
 }
 /* Final review MUST-FIX 2: #11's dApp re-authentication strip — on the hero's gutter (--space-5, the hero's own
    margin), a gap before the hero below it, the line centred on the icons, and the design's trailing chevron (#11's
-   own strip, ix:6374: 18 px in --fg-secondary; four classes outrank `.banner.info svg`'s --info). */
-.s-dash .app-banner.app-dapp-strip {
+   own strip, ix:6374: 18 px in --fg-secondary; four classes outrank `.banner.info svg`'s --info). B1c-3: B1b's
+   pending-send strip (app-pending-strip) the same. */
+.s-dash .app-banner.app-dapp-strip,
+.s-dash .app-banner.app-pending-strip {
   /* `.app-strip`'s width: 100% plus side margins ran the strip past the popup's right edge (its chevron clipped). */
   width: auto;
   margin: var(--space-3) var(--space-5) var(--space-4);
   align-items: center;
 }
-.app-dapp-strip > .noc-body-sm {
+.app-dapp-strip > .noc-body-sm,
+.app-pending-strip > .noc-body-sm {
   flex: 1;
   min-width: 0;
 }
@@ -1509,7 +1512,8 @@ body:has(.app-window) {
   background: linear-gradient(135deg, var(--accent), var(--accent-shielded));
 }
 /* Final review MUST-FIX 2: a verified brand's own tile, as the design draws it (approve/ui.tsx BRAND_TILES says where
-   each comes from): the window's mockups for Jupiter, Magic Eden, Tensor and Noctura, #49's tiles for Drift and Kamino. */
+   each comes from): the window's mockups for Jupiter, Magic Eden and Noctura, #49's tiles for Drift and Kamino — and,
+   B1c-3 (R9), for Tensor, which the design draws differently (#47 cyan, #49 violet): #49's (its latest), on every screen. */
 .s9-origin-card .ico.app-brand-jupiter {
   background: linear-gradient(135deg, #FFC800, #FF7A00);
 }
@@ -1517,7 +1521,7 @@ body:has(.app-window) {
   background: linear-gradient(135deg, #14F195, #9945FF);
 }
 .s9-origin-card .ico.app-brand-tensor {
-  background: linear-gradient(135deg, #00DBFF, #0066FF);
+  background: linear-gradient(135deg, oklch(72% 0.18 295), oklch(65% 0.16 320));
 }
 .s9-origin-card .ico.app-brand-noctura {
   background: linear-gradient(135deg, #B084FC, #5BE3C2);
````

`extension/src/approve/ui.tsx`:

````diff
diff --git a/extension/src/approve/ui.tsx b/extension/src/approve/ui.tsx
index 498bf32..9e813d3 100644
--- a/extension/src/approve/ui.tsx
+++ b/extension/src/approve/ui.tsx
@@ -39,10 +39,10 @@ export function siteLabel(origin: string, host: string): string {
 
 /**
  * Final review MUST-FIX 2 (design binding): a verified site's tile in the brand gradient the design draws for it — the
- * approval window's own mockups (#48 ix:18283 and #47 ix:17578 Jupiter, #46 ix:17467 Magic Eden, #47 ix:17711 Tensor,
- * #48 ix:18414 Noctura) and, for the brands only #49 draws (Drift, Kamino), #49's tiles (ix:3885-3889), so a brand keeps
- * one colour across the screens that draw it; where two screens draw one brand differently (Tensor), each keeps its
- * own, as §9 rules for #37's and #49's holds. Keyed by the known list's name, which the background gives only for a
+ * approval window's own mockups (#48 ix:18283 and #47 ix:17578 Jupiter, #46 ix:17467 Magic Eden, #48 ix:18414 Noctura)
+ * and, for the brands only #49 draws (Drift, Kamino), #49's tiles (ix:3885-3889), so a brand keeps one colour across the
+ * screens that draw it. Tensor, which the design draws differently (#47 ix:17711 cyan, #49 ix:3885 violet), takes #49's — the
+ * design's latest — on every screen (B1c-3, R9, controller ruling). Keyed by the known list's name, which the background gives only for a
  * verified host (C7) — an unknown or lookalike host never gets a brand's colours. Any other verified site keeps the
  * accent tile.
  */
````

#10 — the description unsigned, the rows signed:

`extension/src/unlock/challenge.ts`:

````diff
diff --git a/extension/src/unlock/challenge.ts b/extension/src/unlock/challenge.ts
index b860965..27b0464 100644
--- a/extension/src/unlock/challenge.ts
+++ b/extension/src/unlock/challenge.ts
@@ -57,7 +57,10 @@ export interface DappDescription {
   kind: 'dapp';
   site: string;
   transactions: number;
-  /** One row per token leaving the account: the label (a symbol, or "Token") and the exact amount (never rounded). */
+  /**
+   * One row per token leaving the account: the label (a symbol, or "Token") and the exact amount (never rounded), unsigned
+   * — B1c-3: #10's rows show it with a minus, its headline without one, as the design's send headline (reauth.ts).
+   */
   outgoing: {label: string; amount: string; mint: string | null}[];
   /** How many more tokens leave the account than the rows show (plan 2 review 1 L9: the background lists at most 16). */
   omitted: number;
@@ -158,7 +161,7 @@ function describeDapp(a: Record<string, unknown>): DappDescription | null {
     if (mint === null) {
       // SOL: its own name and nine decimals, nothing else.
       if (symbol !== 'SOL' || decimals !== 9) return null;
-      rows.push({label: 'SOL', amount: `−${formatAmount(BigInt(amount), 9, {min: 0, max: 9})}`, mint: null});
+      rows.push({label: 'SOL', amount: formatAmount(BigInt(amount), 9, {min: 0, max: 9}), mint: null});
       continue;
     }
     if (typeof mint !== 'string' || !ADDRESS.test(mint)) return null;
@@ -166,11 +169,11 @@ function describeDapp(a: Record<string, unknown>): DappDescription | null {
       // A named token must carry its own decimals (this page's table): anything else describes no real token.
       if (typeof symbol !== 'string' || !own(TOKENS, symbol) || symbol === 'SOL' || decimals !== TOKENS[symbol as TokenSymbol]) return null;
       const d = TOKENS[symbol as TokenSymbol];
-      rows.push({label: symbol, amount: `−${formatAmount(BigInt(amount), d, {min: 0, max: d})}`, mint});
+      rows.push({label: symbol, amount: formatAmount(BigInt(amount), d, {min: 0, max: d}), mint});
       continue;
     }
     if (decimals !== null && !isInt(decimals, 0, 18)) return null;
-    rows.push({label: REAUTH.token, amount: decimals === null ? `−${REAUTH.baseUnits(amount)}` : `−${formatAmount(BigInt(amount), decimals, {min: 0, max: decimals})}`, mint});
+    rows.push({label: REAUTH.token, amount: decimals === null ? REAUTH.baseUnits(amount) : formatAmount(BigInt(amount), decimals, {min: 0, max: decimals}), mint});
   }
   const lines: string[] = [];
   for (const r of reasons as unknown[]) {
````

`extension/src/unlock/screens/reauth.ts`:

````diff
diff --git a/extension/src/unlock/screens/reauth.ts b/extension/src/unlock/screens/reauth.ts
index 8ffcf12..ec38ff4 100644
--- a/extension/src/unlock/screens/reauth.ts
+++ b/extension/src/unlock/screens/reauth.ts
@@ -11,6 +11,9 @@ import {byId, h, setText, showScreen, shown} from '../view/dom';
 import {startCooldown} from '../view/cooldown';
 import {addressGroups} from '../view/words';
 
+/** What leaves the account, on #10's rows (U+2212, as #48's deltas). */
+const MINUS = '−';
+
 export interface ReauthScreen {
   show(challengeId: string): Promise<void>;
   /** Whether the screen still references a typed password (the field, or one not yet handed to the attempt). */
@@ -160,7 +163,8 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
       // dappAbout), where SOL is usually only the network fee, and carries no USD value for SOL to rank by. A headline
       // there would put the fee, not what is sent, in the largest type — so several outflows (or any cut by `omitted`)
       // get no headline and every outflow is a row. An unnamed token gets none either: its amount means nothing without
-      // the mint, which only its row shows whole. The minus sign stays: what leaves the account.
+      // the mint, which only its row shows whole. B1c-3: the headline is unsigned, as the design's send headline
+      // (ix:6062); every row keeps the minus — what leaves the account.
       const only = d.outgoing.length === 1 && d.omitted === 0 ? d.outgoing[0] : undefined;
       const head = only !== undefined && (only.mint === null || only.label !== REAUTH.token) ? only : null;
       if (head !== null) {
@@ -172,10 +176,10 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
       if (d.transactions > 1) rows.push(row(REAUTH.transactions, String(d.transactions)));
       for (const o of d.outgoing) {
         if (o === head) continue;
-        if (o.mint === null || o.label !== REAUTH.token) rows.push(row(o.label, o.amount));
+        if (o.mint === null || o.label !== REAUTH.token) rows.push(row(o.label, `${MINUS}${o.amount}`));
         else {
           const value = h('span');
-          value.append(o.amount, ' · ', addressGroups(o.mint));
+          value.append(`${MINUS}${o.amount}`, ' · ', addressGroups(o.mint));
           rows.push(row(o.label, value));
         }
       }
````

The spec:

`docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md`:

````diff
diff --git a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
index c679008..2b3ac66 100644
--- a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
+++ b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
@@ -556,7 +556,8 @@ cannot mask an earlier one (review M5):
    [Reject] + [Sign]. Top-bar ✕ = Reject; disabled while signing. **Can no longer be signed** (rev 3.2): when the
    request is live but its signing detail is gone (the account is unlocked no more, or the message is now refused), #46
    keeps the overline, ✕ and the title, shows Q26 *"This request can no longer be signed. Reject it and ask the site to
-   try again."* under the title in the lede's body tier, and offers only [Reject] (the design does not draw this state).
+   try again."* under the title as #48 shows it — a danger flag banner (B1c-3; B1c-1 set it in the lede's body tier) —
+   and offers only [Reject] (the design does not draw this state).
 5. **Lookalike:** overline "Suspicious origin"; the short lede "A signature proves you control this wallet."; the banner
    (§3.1); in the preview, every non-ASCII character that `skel` maps to Latin is `<mark>`ed (as the design marks "а"
    in "Domain: phаntom.app"); primary "Reject and report"; tertiary "Sign anyway (not recommended)" → the design's
@@ -613,7 +614,7 @@ proxy (`getMultipleAccounts`). The window only renders the flags stored with the
 | # | condition (B1 §3) | how it is detected | severity | override word |
 |---|---|---|---|---|
 | F1 | a program not in the decoded set — also an instruction that touches an account no lookup table resolved, and a known program's instruction that does not parse strictly | the decoded instruction's program is unknown | warning, named by the program's address (one banner per transaction listing every unknown program, each address whole, in groups of four) | — |
-| F2 | an instruction of a decoded program that is not a transfer | the decoded name is none of System `transfer`, Token / Token-2022 `transfer`, `transferChecked`. **Compute Budget is exempt** — it is the fee, already shown as the fee row; the only exemption | warning, one banner per transaction naming the instructions | — |
+| F2 | an instruction of a decoded program that is not a transfer | the decoded name is none of System `transfer`, Token / Token-2022 `transfer`, `transferChecked`. **Compute Budget is exempt** — it is the fee, already shown as the fee row; the only exemption. An instruction a more specific flag of the same transaction already names (F3's assign, F4's setAuthority, F5's or F6's approve, F8's `AdvanceNonceAccount`) is not listed again — B1 §3's "named" is that flag's banner (controller ruling, plan 3: the design draws one banner for an unlimited approve); every other one stays listed | warning, one banner per transaction naming the instructions | — |
 | F3 | System `Assign` / `Allocate` on the user's own wallet account | a decoded `assign`, `allocate`, `assignWithSeed` or `allocateWithSeed` (tags 1, 8, 10, 9) whose target account (index 0) is the wallet account; **and** chain state: the simulation's post-state of the wallet account has an owner other than the System program, or any data (a CPI names no top-level instruction) | **blocked** | `ASSIGN` (Q28) — one word for all four; the banner names which |
 | F4 | SPL / Token-2022 `SetAuthority` (any authority type) on an account the user owns | a decoded `setAuthority` whose account is a token account whose pre-state owner field is the wallet account, or a mint whose pre-state mint authority or freeze authority is the wallet account; **and** chain state (a CPI): an own token account's owner reassigned away, or its close authority changed | **blocked** | `AUTHORITY` (Q29) |
 | F5 | `Approve` / `ApproveChecked` of the whole balance or u64 max | a decoded approve whose amount is u64::MAX or at least the source's pre-state amount; **and** chain state (a CPI): an own account's post-state delegated amount is u64::MAX or at least its pre-state amount | **blocked** | the token's symbol from **the wallet's own token table**, exact and case-sensitive — only when the simulation's decimals match the table's; a mint the wallet cannot name → `UNLIMITED` (Q30). Never a symbol a mint claims for itself (a fake mint can call itself USDC) |
@@ -663,6 +664,12 @@ proxy (`getMultipleAccounts`). The window only renders the flags stored with the
   gains the design's synthesized row ("<SYM> delegated · unlimited · ≈ all current + future"; a bounded approve
   "<SYM> delegated · <amount>"): an approve changes no balance, so the "No balance changes" line is replaced wherever an
   authority or approve flag exists. Every banner's copy is the design's, B1 §3's or §10's (Q32, Q36–Q39, Q41–Q55).
+- **Instruction rows (B1c-3, the final review's carried minors).** A non-Checked Token / Token-2022 `transfer`,
+  `approve` or `burn` carries no decimals: its amount is shown with the mint's decimals (0–18, as the simulation knows
+  them) when the background read the source account's pre-state as a token account of the instruction's own program
+  (a burn: of the mint it names) — otherwise in base units, as B1c-2; the window computes none. An ATA `create` /
+  `createIdempotent` names its token program (account 5; fewer than the six accounts the program reads is an unknown
+  program): the whole address, with `spl_token` or `spl_token_2022` beside it when it is one of the two.
 
 The plans for B1c-2 and B1c-3 refine this section; they may not loosen it.
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

`npx tsc --noEmit; echo $?` → `0`. `npx vitest run` → **Test Files 170 passed (170), Tests 3415 passed (3415)** (Task 5: 170 / 3401; +5 `redFlags.test.ts`, +5 `simulate.test.ts`, +1 `decode.test.ts`, +2 `tx.test.tsx`, +1 `Home.test.tsx`). `node scripts/build.mjs` → exit 0. `npm run gates` → exit 0 (`classes ok: every class in 56 src/app and src/approve files is defined by …` — `app-pending-strip` is app.css's; the vault-isolation gate passes reauth.ts's `MINUS`). `node scripts/extract-design-css.mjs --check` → `design-ext.css is the extraction output` (unchanged). Nothing under the repository root's `src/` or `core/` is touched (root `tsc`/`jest` and web's `verify` not needed). The e2e change is not run here (Task 8).

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

Observed in the dry run: every mutant `tsc` exit 0, the named test red. (`-t` is a regex: the filters below are written without parentheses.)

| id | the change | the test that turns red | observed |
|---|---|---|---|
| M6a | F2's filter without the exclusion (`specific.has(-1)` for `specific.has(index)`) | redFlags "an unlimited approve alone is F5 only …" | tsc 0, 1 failed |
| M6b | `namedBy` without F8 (`durable-nonce` names nothing) | redFlags "AdvanceNonceAccount first …" | tsc 0, 1 failed |
| M6c | `namedBy`: a chain-only approval names instruction 0 (`a.at ?? 0`) | redFlags "a decoded approve no flag names stays F2 …" | tsc 0, 1 failed |
| M6d | `namedBy` without F3 (`assign` names nothing) | redFlags "assign, allocate, assignWithSeed, allocateWithSeed of the wallet account …" | tsc 0, 1 failed |
| M6e | `namedBy` without F4 (`set-authority` names nothing) | redFlags "an own token account …" | tsc 0, 1 failed |
| M6f | `namedBy` also excludes F7's `at` | redFlags "F7 is not among them …" | tsc 0, 1 failed |
| M6g | F2 excludes every `approve` / `assign` / `setAuthority` by name, whoever's | redFlags "only the instructions the specific flag names leave F2 …" | tsc 0, 1 failed |
| M6h | F2 excludes every `closeAccount` (the negative control) | redFlags "negative control: a lone closeAccount …" | tsc 0, 1 failed |
| M6i | `amountMintsOf` without the program check (`info.program !== ix.program`) | simulate "none when the pre-state does not name the mint …" | tsc 0, 1 failed |
| M6j | `amountMintsOf` without the burn's mint check | simulate "none when the pre-state does not name the mint …" | tsc 0, 1 failed |
| M6k | the amount decimals without the 0–18 bound | simulate "a mint the wallet does not know …" (19 named) | tsc 0, 1 failed |
| M6l | the mint read without the amount mints (only the changes' unknown mints) | simulate "a mint the wallet does not know …" (no decimals for 4) | tsc 0, 1 failed |
| M6m | a failed transaction's amount mints dropped (pushed only after a simulation) | simulate "a transaction that failed keeps them …" | tsc 0, 1 failed |
| M6n | `amountDecimalsOf` accepts decimals above 18 | simulate "simStateOf: read back strictly …" ("above 18") | tsc 0, 1 failed |
| M6o | `simStateOf` without `amountDecimals.length === outcomes.length` | simulate "simStateOf: read back strictly …" ("a list per transaction missing") | tsc 0, 1 failed |
| M6p | `txDetail` applies no decimals (`withAmountDecimals(…, [])`) | tx "instruction rows …" (`1500000`) | tsc 0, 1 failed |
| M6q | `decode.ts`: the ATA create without its `tokenProgram` field | decode "associated token account …" (both) | tsc 0, 2 failed |
| M6r | `decode.ts`: a create with fewer than six accounts decodes (the mint standing in as `tokenProgram`) | decode "… fewer than the six accounts …" | tsc 0, 1 failed |
| M6s | `Tx.tsx`: `TOKEN_PROGRAMS` without Token-2022 | tx "instruction rows …" (no `spl_token_2022`) | tsc 0, 1 failed |
| M6t | `Sign.tsx`: Q26 back in the lede | sign "request.sign === null …" | tsc 0, 1 failed |
| M6u | `Home.tsx`: the pending strip without `app-pending-strip` (chevron kept) | Home "the pending strip: on the dApp strip’s gutter …" (class) | tsc 0, 1 failed |
| M6v | `app.css`: `.s-dash .app-banner.app-pending-strip` dropped from the gutter rule (class kept) | Home "the pending strip: on the dApp strip’s gutter …" (the computed style) | tsc 0, 1 failed |
| M6w | `Home.tsx`: the pending strip without its chevron | Home "the pending strip: on the dApp strip’s gutter …" (no chevron) | tsc 0, 1 failed |
| M6x | `reauth.ts`: the headline signed again | reauthScreen "a dApp’s transaction: “You are about to approve” …" | tsc 0, 1 failed |
| M6y | `reauth.ts`: a named row unsigned | reauthScreen "a dApp’s transaction moving several tokens …" | tsc 0, 1 failed |
| M6z | `challenge.ts`: SOL's row amount signed again | challenge "the site, the batch’s size …" | tsc 0, 1 failed |
| M6aa | `app.css`: `.app-brand-tensor` back to the window mockups' cyan | tx "origin tiles …" | tsc 0, 1 failed |
| M6ab | `ui.tsx`: `BRAND_TILES` without Tensor | tx "origin tiles …" | tsc 0, 1 failed |

- [ ] **Step 6: Commit.**

```bash
git add docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md extension/e2e/visual-dapp-tx.spec.ts extension/src/app/__tests__/Home.test.tsx extension/src/app/app.css extension/src/app/screens/Home.tsx extension/src/approve/Sign.tsx extension/src/approve/Tx.tsx extension/src/approve/__tests__/sign.test.tsx extension/src/approve/__tests__/tx.test.tsx extension/src/approve/ui.tsx extension/src/background/dapp/__tests__/redFlags.test.ts extension/src/background/dapp/__tests__/simulate.test.ts extension/src/background/dapp/__tests__/txHarness.ts extension/src/background/dapp/decode/__tests__/decode.test.ts extension/src/background/dapp/decode/decode.ts extension/src/background/dapp/redFlags.ts extension/src/background/dapp/signTx.ts extension/src/background/dapp/simulate.ts extension/src/unlock/__tests__/challenge.test.ts extension/src/unlock/__tests__/reauthScreen.test.ts extension/src/unlock/challenge.ts extension/src/unlock/screens/reauth.ts
git commit -m "feat(extension): B1c-3 Task 6 — F2 beside a more specific flag, non-Checked decimals, the ATA token program, the four carried visual items

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Dry run: clone commit `05a1f32` on Task 5's `afb3e09`.)

#### Dry-run notes (Task 6)

- **Ruling (the controller's, implemented as written): "named by a more specific flag" is the FINAL flags' indices** — F3's and F4's `instructions[].index`, F5's / F6's decoded approvals' `at`, F8's `at` 0 — not every instruction of those names: an assign of someone else's account, a setAuthority the user does not own, someone else's approve, an `AdvanceNonceAccount` that is not first, and a decoded approve that F5 dropped in favour of the chain state's unlimited reading (`at: null`) all stay F2's (tested, M6c, M6g) — why: the ruling removes repetition, never a name; an instruction no banner names would otherwise be named nowhere — cost if wrong: none for funds (only a warning line differs).
- **Ruling: F7 does not exclude (its `at` anchors a mint, it does not name the instruction)** — the ruling's list is F3, F4, F5, F6, F8; tested (M6f) — cost if wrong: an ATA create of a flagged Token-2022 mint shows F2 and F7 (two warnings).
- **Not checked: the stored list's cross-flag invariant** (`storedFlagsOf` does not refuse a stored F2 that repeats a specific flag's index) — as Task 3's "not checked" list (order, F1's `at`); the store is the background's own `storage.session` — cost if wrong: a stale session simulation from before this change shows one extra warning until its next refresh.
- **Ruling: the decimals are the simulation's own mint decimals (the wallet's table, the holdings snapshot, else the one capped mint read — now also covering these mints), 0–18 only; the source account need not be the user's** (a delegate's transfer from someone else's account names its mint the same way; tested) — why: the decimals belong to the mint, and B1c-2's balance changes already trust exactly these sources; the 18 bound is the window's own (`fieldValueOf`), so a hostile mint's 19+ never makes the whole detail unreadable (Q26) — it stays base units — cost if wrong: an amount shown with a mint's decimals that a lying node reported (the same trust as every B1c-2 balance line).
- **Ruling: a source of another token program, or a burn of a mint other than its account's, gets no decimals** (the token program refuses both, so the instruction never runs as shown) — fail closed to base units.
- **Ruling: an ATA create/createIdempotent needs six accounts** (the program's own reads: payer, account, wallet, mint, System, token program); four or five → an unknown program (B1c-2's too-few-accounts rule, the decode doc's own wording). B1c-2's decode test built `create` from the four decoded FIELDS and was changed to the builder's six accounts — the only B1c-2 test changed. F10's creators and R10's `createdBy`/`ownerOf` read only decoded ATA instructions, so a 4-account create no longer counts as creating its account (correct: it never runs) — cost if wrong: none found (every builder in the repo, web3.js and `core/solana/transfer.ts` emit six).
- **Ruling: the token program is shown as the whole address plus the design's mono name (`spl_token` / `spl_token_2022`, B1c-2's `PROGRAM_NAMES`) in the address-label slot; any other address no name** — no new copy (the brief's "classic / Token-2022" is the meaning, the design's names are the words); an own-account or contact label, if one ever matched, wins.
- **Ruling: #46's Q26 keeps the title** (the banner replaces the lede only; #48's Q26 screen has no title but an origin card — #46 keeps its own structure) — cost if wrong: one line of layout for Task 8 to compare.
- **Ruling: the minus moved from the description to #10's rows** (`DappDescription.outgoing[].amount` is now unsigned) rather than stripped from the headline — the description says what leaves; the sign is #10's presentation. `reauth.ts` gains a `MINUS` constant (U+2212, literal as in `Tx.tsx` and the old `challenge.ts`); new test strings use `−` escapes.
- **Ruling (R9 as briefed): Tensor's `.s9-origin-card` tile = #49's oklch gradient exactly**; the design also draws a third Tensor colour on #37's dApp list (`.s7-dapp-icon.tensor`, ix:3601, `#B084FC → #FC84E8`) — not a screen this plan builds; flagged.
- **Deviation (additive): `txHarness.ataCreate` gains a `tokenProgram` parameter** (default classic; every existing call unchanged). **Deviation: `client.ts` untouched** (a field's `amount.decimals` already exists and is validated).
- **Finding (not this task's, flagged): B1b's `Home.test.tsx` #42 tests fail when the run crosses local midnight** — "just disconnected", "sustained …" and "sustained after 30 s" failed once in this dry run's red run at 23:59→00:00 CEST and passed on every rerun (three runs on Task 6's tree, two on Task 5's); the file's own comment says it stamps "a few seconds ago, today" for the clock-time captions. Not a security UI; not fixed here (out of scope) — the next writer should not mistake it for a regression.
- **For Task 7 (E2E):** an unlimited approve's #48 has ONE banner (no F2 warning) — any E2E or visual assertion expecting "Instructions that are not transfers" beside F3/F4/F5/F6/F8 must drop it; an ATA create row now has a `tokenProgram` field (fakeCoordinator's ATA instructions must carry six accounts or they decode as unknown programs); non-Checked approve/transfer/burn amounts show decimals once simulated. **For Task 8 (visual):** new shots — #46's Q26 banner (`48-cannot-sign`'s sibling on #46, `visual-dapp.spec.ts:260`), #11 with the pending strip (assert the strip and its chevron `toBeInViewport({ratio: 1})` as the dApp strip's shot does), #10's dapp headline unsigned (the regex is already updated), a Tensor origin tile (#47) in #49's violet, a #48 instruction card with an ATA create and a non-Checked approve.

---

### Task 7: E2E B1c-30 … B1c-34 — the red flags against the real extension through StandardWalletAdapter (an unlimited approve, an Assign of the wallet account, a lone closeAccount, a Token-2022 mint, a dependent batch, a durable nonce); the fake coordinator models what they need; B1b's Home #42 tests on the harness's clock

**Spec:** B1c §3.3 rev 3.6 (the red-flag table F1–F10, the override rule, the typed field, the holds, the banners), §6.3 (E2E against the fake coordinator, contained), D11 (re-authentication through the toolbar), R12 (no durable nonce through sign-and-send); B1 §3 l.276-322; owner decisions O1 (typed symbol AND #10), O2 (dependent batches), O3 (Token-2022 only); the plan-3 ledger's Task 6 ruling (Home.test #42's midnight dependence is a finding → fixed here with the harness's clock); C13 (the background is the gate)

**Files:**
- Test: `extension/e2e/fakeCoordinator.ts` (Token-2022 token accounts; mint accounts with `mintData` — the classic layout and Token-2022's TLV, a copy of the builders' logic, no import from core/ or src/; the wallet's three mints by default; ApproveChecked's delegate; CloseAccount; System Assign / Allocate (and …WithSeed) on the post-state; the dependent step's node error documented — it was already the fake's per-transaction behaviour)
- Test: `extension/e2e/fixtures/dapp/page.ts` (`named`, `adapterCustomSign`, `adapterCustomSignAll`, `adapterCustomSend`)
- Test: `extension/e2e/dappPage.ts` (`adapter.customSign`, `adapter.customSignAll`, `adapter.customSend`)
- Test: `extension/e2e/dappTx.spec.ts` (B1c-30 … B1c-34, their helpers; B1c-25 … B1c-29 unchanged)
- Test: `extension/e2e/visual-dapp-tx.spec.ts` (two B1c-2 states updated deliberately — below)
- Test: `extension/src/app/__tests__/Home.test.tsx` (three #42 tests on the harness's clock)
- Not modified: anything under `extension/src/` but that test file, `core/`, the repository root's `src/` — this task adds no product code. No new devDependency.

**Interfaces:**
- Consumes: Tasks 1–6 built (the background's `redFlagsOf` through `simulateTransactions`, the decide gate's `override-missing` / `override-mismatch` / `reauth-required`, `simulation-failed` for an undependent failure, #48's banners / typed fields / red CTAs / 1.5 s hold, #10's override rows and Q33); B1c-2's E2E harness (`launchPopup`, `serveDapp`, `openDapp`, `approvalWindow`, `windowClosed`, `noWindow`, `contained`, `adapter`, `RawIx`, the test dApp's `customTx` and `theAdapter`); the harness's `WalletOptions.now` / `deps.now` (`src/app/__tests__/harness.tsx`).
- Produces (test code only):
  ```ts
  // e2e/fakeCoordinator.ts
  export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
  export interface MintSpec {decimals: number; mintAuthority: string | null; freezeAuthority: string | null;
    extensions?: {permanentDelegate?: string | null; transferHook?: {authority: string | null; program: string | null}}}
  export function mintData(spec: MintSpec): Uint8Array;   // 82 bytes classic; with `extensions`, Token-2022's padded base + AccountType 1 + TLV (12, 14)
  interface FakeCoordinator {
    tokenAccounts: Map<string, {pubkey; mint; amount; decimals; program?: 'token' | 'token-2022'}[]>;   // program: default classic
    mints: Map<string, {program: 'token' | 'token-2022'; data: Uint8Array}>;   // starts with NOC (9), USDC (6), USDT (6), classic
  }
  // e2e/dappPage.ts — adapter
  customSign(p, blockhash, ixs: RawIx[]): Promise<Result>;                         // {signed, message}
  customSignAll(p, blockhash, batch: RawIx[][]): Promise<Result | NamedFailure>;    // {signed[], messages[]}
  customSend(p, blockhash, ixs: RawIx[]): Promise<Result | NamedFailure>;           // the signature, or the adapter's own error type
  ```

The red flags are the background's (C13), so each one is driven the way a wallet-adapter dApp sends it — `StandardWalletAdapter`'s `signTransaction`, `signAllTransactions` and `sendTransaction` over the provider — through the relay, the decoder, the simulation against the fake node and #48, and every block is asked of the background directly too: the window's own `dapp.decide`, sent from the window's page (approve.html, the one sender the background takes it from), without the word, with a wrong one, and with the right one before #10 (`decideRaw`). What the fake now answers is what a node answers for these transactions: a Token-2022 token account owned by its program, a mint's bytes in the programs' own layout (the classic 82 bytes; Token-2022's padded base, AccountType 1 and TLV — the builders' logic copied into e2e, which imports nothing from core/ or src/), the wallet's three mints by default (classic, their decimals — without them the wallet could name no token, and every approve of NOC or USDC warned "Could not read this token's settings": the first full visual run showed exactly that on `48-approval-reauth`), ApproveChecked's delegate in the source's post-state, a closed token account, and the wallet account's new owner program / data after Assign / Allocate. A dependent step needed nothing new: the fake already simulates each transaction on its own against the current state, so a transfer into a token account only an earlier transaction creates fails as uninitialized — exactly Task 3's attribution input.

B1c-30 (F5, O1): an ApproveChecked of u64::MAX of the wallet's USDC — the design's eyebrow and one danger banner (Task 6: no F2 beside it) with the real instruction, delegate and mint, the synthesized "USDC delegated" row, "Approve unlimited" greyed and disabled; the background answers `override-missing` and, for `usdc`, `override-mismatch`; typing `usdc` and then `USDC ` leaves it gated AND disabled after the 1.5 s hold has passed (so it is the match, not the hold); `USDC` un-gates it, Enter submits nothing, the click asks for #10 — the page has no answer, and the right word without the proof is `reauth-required`; #10 (from the popup's strip) lists "Unlimited USDC spend approval" with both reasons (the allowance from chain state, Q33); then the window signs the page's own bytes. B1c-31 (F3): an Assign of the wallet account to a dApp program — Q35's eyebrow, F3's banner with the decoded instruction AND the fake node's post-state owner, `ASSIGN` (not `Assign`) and #10 → signed; a lone CloseAccount of the wallet's empty USDC account is F2's warning only — no field, no #10, Approve held ≥ 1 s (1.5 s, measured from the moment the state is seen), signed; the negative control of that measure: a plain transfer is held < 1 s (C15's 500 ms). B1c-32 (F7, O3): a dApp's CreateIdempotent preamble for a Token-2022 PYUSD-shaped mint and for USDC — one F7 banner, naming the freeze authority and the permanent delegate (and no transfer-hook line: its program is unset), nothing naming USDC's mint though it has a freeze authority; F2 names both creates; Approve signs. B1c-33 (O2, F10): a batch of two (create the recipient's ATA; transfer USDC into it) — step 2's section says "This step depends on step 1 …" with the node's error, "Balance changes (unknown)", one `UNCHECKED` field in that section, `override-missing` / `override-mismatch` (the word on transaction 0), then #10 with "Depends on step 1 — not checked on its own · Transaction 2 of 2" and first-send's line → both signed; then step 2 failing for a reason of its own (more USDC than held, into an existing account) is "Couldn't simulate", Reject only, no field, and the word is refused `simulation-failed`; the adapter reports the rejection. B1c-34 (F8, R12): AdvanceNonceAccount + a transfer through `signTransaction` — "This transaction does not expire." alone, held ≥ 1 s, signed; the same through `sendTransaction` — no window, the adapter's `WalletSendTransactionError` "The request is not valid.", nothing broadcast, no fallback to the dApp's own RPC. Every B1c-3 test also watches the whole context's console for a Content Security Policy line (each document's `securitypolicyviolation` logged to it) and asserts none; B1c-34 ends with the watch's positive control (an inline `<style>` added to the popup is refused and heard).

B1b's #42 tests (the ledger's Task 6 finding): "just disconnected", "sustained (two failed refreshes)" and "sustained after 30 s" read clock-time captions ("last synced 09:41:13", "Stale · …", "price …") whose day part appears when the stamp is not today — so a run crossing local midnight failed. They now run on the harness's clock: the provider's `now` and the background's `deps.now` at a fixed local noon, the cache stamped from it.

- [ ] **Step 1: Write the tests (and the fake's models they need).**

Change `extension/e2e/fakeCoordinator.ts`:

````diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
index 760e3b7..5749bdc 100644
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -14,7 +14,15 @@ const METHOD_NOT_FOUND: unique symbol = Symbol('method not found');
 const SYSTEM_PROGRAM = '11111111111111111111111111111111';
 const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';
 export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
+/** B1c-3: Token-2022 — its token accounts and mints the fake answers like the classic program's, with the extensions. */
+export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
 export const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
+/** B1c-3: the wallet's own tokens' mints (NOC, USDC, USDT) and their decimals — what the fake chain holds by default. */
+const WALLET_MINTS: [string, number][] = [
+  ['B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', 9],
+  ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6],
+  ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 6],
+];
 /** The rent-exempt minimum of a 165-byte token account: what an associated-token-account Create takes from its payer. */
 export const TOKEN_ACCOUNT_RENT = 2_039_280;
 
@@ -62,7 +70,15 @@ export interface FakeCoordinator {
    * decimals}}). They feed the balances #11 and #43 show, and (final review, carry d) a token send's simulation:
    * a requested token account comes back in its 165-byte layout after the transaction's transfers.
    */
-  tokenAccounts: Map<string, {pubkey: string; mint: string; amount: string; decimals: number}[]>;
+  tokenAccounts: Map<string, {pubkey: string; mint: string; amount: string; decimals: number; program?: 'token' | 'token-2022'}[]>;
+  /**
+   * B1c-3: mint accounts by address — their owner program and bytes (`mintData`), answered by getMultipleAccounts (the
+   * simulation's one mint read, for decimals and the red flags F5/F7) and getAccountInfo. It starts with the wallet's
+   * three tokens as the chain has them — classic SPL mints, NOC at 9 decimals, USDC and USDT at 6 (their authorities
+   * are not modeled: no flag reads a classic mint's, O3). An unlisted mint reads as every other unlisted address does:
+   * a system account (no mint data — the wallet cannot read it).
+   */
+  mints: Map<string, {program: 'token' | 'token-2022'; data: Uint8Array}>;
   /** Per owner, newest first: the signatures getSignaturesForAddress pages through, and each getTransaction result. */
   history: Map<string, {signature: string; tx: unknown}[]>;
   /**
@@ -93,6 +109,51 @@ function tokenAccountData(mint: string, owner: string, amount: bigint, delegate:
   return data;
 }
 
+/**
+ * B1c-3: a mint's bytes, the token programs' own layout (e2e copies the builder — it imports nothing from core/ or src/):
+ * mint authority COption<Pubkey> (u32 tag at 0, key at 4), supply u64 at 36, decimals at 44, is_initialized at 45,
+ * freeze authority COption<Pubkey> (tag at 46, key at 50) — 82 bytes. With `extensions` (Token-2022 only), zero padding
+ * to 165, the AccountType byte 1 (Mint) at 165, then each extension as TLV from 166: u16 LE type, u16 LE length, the
+ * value — PermanentDelegate (12: its delegate, 32 bytes) and TransferHook (14: its authority, then its program id; 64
+ * bytes), 32 zero bytes being "none" in both.
+ */
+export interface MintSpec {
+  decimals: number;
+  mintAuthority: string | null;
+  freezeAuthority: string | null;
+  extensions?: {permanentDelegate?: string | null; transferHook?: {authority: string | null; program: string | null}};
+}
+const keyBytes = (key: string | null): Uint8Array => (key === null ? new Uint8Array(32) : base58.decode(key));
+export function mintData(spec: MintSpec): Uint8Array {
+  const tlv: {type: number; value: Uint8Array}[] = [];
+  const ext = spec.extensions;
+  if (ext?.permanentDelegate !== undefined) tlv.push({type: 12, value: keyBytes(ext.permanentDelegate)});
+  if (ext?.transferHook !== undefined) tlv.push({type: 14, value: new Uint8Array([...keyBytes(ext.transferHook.authority), ...keyBytes(ext.transferHook.program)])});
+  const size = ext === undefined ? 82 : 166 + tlv.reduce((n, e) => n + 4 + e.value.length, 0);
+  const data = new Uint8Array(size);
+  const view = new DataView(data.buffer);
+  if (spec.mintAuthority !== null) {
+    view.setUint32(0, 1, true);
+    data.set(base58.decode(spec.mintAuthority), 4);
+  }
+  data[44] = spec.decimals;
+  data[45] = 1;
+  if (spec.freezeAuthority !== null) {
+    view.setUint32(46, 1, true);
+    data.set(base58.decode(spec.freezeAuthority), 50);
+  }
+  if (ext === undefined) return data;
+  data[165] = 1;
+  let at = 166;
+  for (const e of tlv) {
+    view.setUint16(at, e.type, true);
+    view.setUint16(at + 2, e.value.length, true);
+    data.set(e.value, at + 4);
+    at += 4 + e.value.length;
+  }
+  return data;
+}
+
 /** Compact-u16: the signature count that opens a serialized transaction. */
 function shortVec(bytes: Uint8Array): {value: number; size: number} {
   let value = 0;
@@ -166,6 +227,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     simulations: [],
     simulatedPayerAfter: [],
     tokenAccounts: new Map(),
+    mints: new Map(WALLET_MINTS.map(([mint, decimals]) => [mint, {program: 'token' as const, data: mintData({decimals, mintAuthority: null, freezeAuthority: null})}])),
     history: new Map(),
     hold: () => {
       let release: () => void = () => undefined;
@@ -206,6 +268,13 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
    * than it holds, fails as the Token program does (Custom 1, InsufficientFunds), and one to an account that is
    * neither listed nor created earlier in the transaction fails as uninitialized. Its error switch answers err with
    * accounts: null, as the real RPC does (review H2).
+   * B1c-3: Token-2022 token accounts move the same way (their own program as the owner); Approve and ApproveChecked
+   * (both programs) leave the source account delegated in its post-state; CloseAccount closes the account (null, as
+   * every account holding no lamports reads here) and pays its rent to the destination when that is the payer; System
+   * Assign / Allocate (and their …WithSeed
+   * forms) give the account they name its new owner program / its zeroed data, as the post-state reports it. Each
+   * transaction is simulated on its own against the current state, as a node does — so a transfer into a token account
+   * that only an EARLIER transaction of a batch creates fails here as uninitialized (B1c-3's dependent step, F10).
    */
   const simulate = (params: unknown[]): unknown => {
     const config = params[1] as {accounts?: {encoding?: string; addresses?: unknown}} | undefined;
@@ -227,6 +296,11 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
      * depicted an approve as moving nothing at all, which the engine's own re-authentication rule (simulate.ts,
      * `approvalFromChain`) would never agree with on mainnet. */
     const approvals = new Map<string, {address: string; amount: bigint}>();
+    /** B1c-3: System Assign / Allocate (and …WithSeed): the account's new owner program, its new data size. */
+    const assigned = new Map<string, string>();
+    const allocated = new Map<string, number>();
+    /** B1c-3: the token accounts a CloseAccount closed. */
+    const closed = new Set<string>();
     for (const [i, ix] of instructions.entries()) {
       const data = ix.data;
       const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
@@ -241,8 +315,23 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
         if (data[0] !== 1 || tokenAccountAt(ata) === null) out += TOKEN_ACCOUNT_RENT;
         created.add(ata);
       }
+      // B1c-3: Assign (1: owner at 4), Allocate (8: space u64 at 4), AllocateWithSeed (9) and AssignWithSeed (10): base
+      // at 4, the seed (u64 length at 36, then its bytes), then AllocateWithSeed's space and owner, AssignWithSeed's owner.
+      if (program === SYSTEM_PROGRAM && data.length >= 4) {
+        const target = keys[ix.accounts[0] ?? -1] ?? '';
+        const tag = view.getUint32(0, true);
+        const seedEnd = data.length >= 44 ? 44 + Number(view.getBigUint64(36, true)) : 0;
+        if (tag === 1) assigned.set(target, base58.encode(data.subarray(4, 36)));
+        if (tag === 8) allocated.set(target, Number(view.getBigUint64(4, true)));
+        if (tag === 9) {
+          allocated.set(target, Number(view.getBigUint64(seedEnd, true)));
+          assigned.set(target, base58.encode(data.subarray(seedEnd + 8, seedEnd + 40)));
+        }
+        if (tag === 10) assigned.set(target, base58.encode(data.subarray(seedEnd, seedEnd + 32)));
+      }
+      const token = program === TOKEN_PROGRAM || program === TOKEN_2022_PROGRAM;
       // Transfer (3) and TransferChecked (12): the amount (u64 LE at 1) leaves the source (the first account).
-      if (program === TOKEN_PROGRAM && (data[0] === 3 || data[0] === 12)) {
+      if (token && (data[0] === 3 || data[0] === 12)) {
         const source = keys[ix.accounts[0] ?? -1] ?? '';
         const held = tokenAccountAt(source);
         const taken = (tokenOut.get(source) ?? 0n) + view.getBigUint64(1, true);
@@ -254,22 +343,34 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
         if (held === null || taken > BigInt(held.amount)) return failed({Custom: 1});
         tokenOut.set(source, taken);
       }
-      // Approve (4): the delegate and amount (u64 LE at 1) the source account's post-state now carries.
-      if (program === TOKEN_PROGRAM && data[0] === 4) {
+      // Approve (4): the delegate and amount (u64 LE at 1) the source account's post-state now carries. B1c-3:
+      // ApproveChecked (13) too — source, mint, delegate, owner; the amount at 1, the decimals after it.
+      if (token && (data[0] === 4 || data[0] === 13)) {
         const source = keys[ix.accounts[0] ?? -1] ?? '';
-        const delegate = keys[ix.accounts[1] ?? -1] ?? '';
+        const delegate = keys[ix.accounts[data[0] === 13 ? 2 : 1] ?? -1] ?? '';
         approvals.set(source, {address: delegate, amount: view.getBigUint64(1, true)});
       }
+      // CloseAccount (9): account, destination, owner — the account's rent goes to the destination.
+      if (token && data[0] === 9) {
+        closed.add(keys[ix.accounts[0] ?? -1] ?? '');
+        if (keys[ix.accounts[1] ?? -1] === payer) out -= TOKEN_ACCOUNT_RENT;
+      }
     }
     const fee = 5_000 * signers + Number((price * limit + 999_999n) / 1_000_000n);
     const after = lamportsOf(payer) - out - fee;
     fake.simulatedPayerAfter.push(after);
+    /** A system account's post-state: its owner program and data as Assign / Allocate left them (B1c-3). */
+    const systemAccount = (a: string, lamports: number) => {
+      const space = allocated.get(a) ?? 0;
+      return {lamports, owner: assigned.get(a) ?? SYSTEM_PROGRAM, data: [base64.encode(new Uint8Array(space)), 'base64'], executable: false, rentEpoch: 18446744073709552000, space};
+    };
     const accounts = (addresses ?? []).map(a => {
-      if (a === payer) return {lamports: after, owner: SYSTEM_PROGRAM, data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0};
+      if (a === payer) return systemAccount(a, after);
+      if (closed.has(a)) return null;
       const t = tokenAccountAt(a);
       if (t !== null) {
         const amount = BigInt(t.amount) - (tokenOut.get(a) ?? 0n);
-        return {lamports: TOKEN_ACCOUNT_RENT, owner: TOKEN_PROGRAM, data: [base64.encode(tokenAccountData(t.mint, t.owner, amount, approvals.get(a) ?? null)), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 165};
+        return {lamports: TOKEN_ACCOUNT_RENT, owner: t.program, data: [base64.encode(tokenAccountData(t.mint, t.owner, amount, approvals.get(a) ?? null)), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 165};
       }
       // B1c-2 Task 10 fix round 1 (test-only, additive — LIMITATION, fix round 2 L1: this models an unaffected
       // address correctly, but if a FUTURE spec ever requested simulateTransaction.accounts for a non-payer,
@@ -281,37 +382,42 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
       // exactly as getMultipleAccounts already reports it, never null (null reads, one level up in
       // simulateTransactions.ts, as the whole account having vanished).
       const lamports = lamportsOf(a);
-      return lamports > 0 ? {lamports, owner: SYSTEM_PROGRAM, data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0} : null;
+      return lamports > 0 ? systemAccount(a, lamports) : null;
     });
     return {context: context(), value: {err: null, logs: ['Program 11111111111111111111111111111111 success'], accounts, unitsConsumed: 450, returnData: null}};
   };
 
-  /** A token account listed in `tokenAccounts`, with its owner, or null. */
-  const tokenAccountAt = (address: string): {mint: string; owner: string; amount: string} | null => {
+  /** A token account listed in `tokenAccounts`, with its owner and its program (B1c-3: classic unless listed Token-2022), or null. */
+  const tokenAccountAt = (address: string): {mint: string; owner: string; amount: string; program: string} | null => {
     for (const [owner, list] of fake.tokenAccounts) {
       const t = list.find(x => x.pubkey === address);
-      if (t !== undefined) return {mint: t.mint, owner, amount: t.amount};
+      if (t !== undefined) return {mint: t.mint, owner, amount: t.amount, program: t.program === 'token-2022' ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM};
     }
     return null;
   };
+  /** B1c-3: a mint listed in `mints`, as the node reports the account. */
+  const mintAt = (address: string): {lamports: number; owner: string; data: [string, 'base64']; executable: false; rentEpoch: number; space: number} | null => {
+    const m = fake.mints.get(address);
+    return m === undefined ? null : {lamports: 1_461_600, owner: m.program === 'token-2022' ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM, data: [base64.encode(m.data), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: m.data.length};
+  };
 
   /** getTokenAccountsByOwner in the node's jsonParsed shape, filtered by `mint` or `programId` as a node filters. */
   const tokenAccountsOf = (owner: string, filter: {mint?: string; programId?: string} | undefined): unknown[] =>
     (fake.tokenAccounts.get(owner) ?? [])
       .filter(t => filter?.mint === undefined || t.mint === filter.mint)
-      // Every listed account is owned by the classic SPL Token program: another programId (Token-2022) matches none.
-      .filter(() => filter?.programId === undefined || filter.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
+      // A listed account is owned by the classic SPL Token program unless listed as Token-2022 (B1c-3).
+      .filter(t => filter?.programId === undefined || filter.programId === (t.program === 'token-2022' ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM))
       .map(t => ({
         pubkey: t.pubkey,
         account: {
           data: {
             parsed: {info: {isNative: false, mint: t.mint, owner, state: 'initialized', tokenAmount: {amount: t.amount, decimals: t.decimals, uiAmount: Number(t.amount) / 10 ** t.decimals, uiAmountString: String(Number(t.amount) / 10 ** t.decimals)}}, type: 'account'},
-            program: 'spl-token',
+            program: t.program === 'token-2022' ? 'spl-token-2022' : 'spl-token',
             space: 165,
           },
           executable: false,
           lamports: 2_039_280,
-          owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
+          owner: t.program === 'token-2022' ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM,
           rentEpoch: 18446744073709552000,
           space: 165,
         },
@@ -350,7 +456,9 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
           context: context(),
           value: (params[0] as string[]).map(a => {
             const t = tokenAccountAt(a);
-            if (t !== null) return {lamports: TOKEN_ACCOUNT_RENT, owner: TOKEN_PROGRAM, data: [base64.encode(tokenAccountData(t.mint, t.owner, BigInt(t.amount))), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 165};
+            if (t !== null) return {lamports: TOKEN_ACCOUNT_RENT, owner: t.program, data: [base64.encode(tokenAccountData(t.mint, t.owner, BigInt(t.amount))), 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 165};
+            const mint = mintAt(a);
+            if (mint !== null) return mint;
             const lamports = lamportsOf(a);
             return lamports > 0 ? {lamports, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0} : null;
           }),
@@ -361,8 +469,10 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
         const token = tokenAccountAt(params[0] as string);
         if (kind === undefined && token !== null) {
           const data = base64.encode(tokenAccountData(token.mint, token.owner, BigInt(token.amount)));
-          return {context: context(), value: {lamports: TOKEN_ACCOUNT_RENT, owner: TOKEN_PROGRAM, executable: false, data: [data, 'base64'], rentEpoch: 0, space: 165}};
+          return {context: context(), value: {lamports: TOKEN_ACCOUNT_RENT, owner: token.program, executable: false, data: [data, 'base64'], rentEpoch: 0, space: 165}};
         }
+        const mint = mintAt(params[0] as string);
+        if (kind === undefined && mint !== null) return {context: context(), value: mint};
         if (kind === undefined) return {context: context(), value: null};
         const owner = kind === 'wallet' ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
         return {context: context(), value: {lamports: 1_000_000, owner, executable: kind === 'program', data: ['', 'base64'], rentEpoch: 0, space: 0}};
````

Change `extension/e2e/fixtures/dapp/page.ts`:

````diff
diff --git a/extension/e2e/fixtures/dapp/page.ts b/extension/e2e/fixtures/dapp/page.ts
index 2f54df9..ec65f5d 100644
--- a/extension/e2e/fixtures/dapp/page.ts
+++ b/extension/e2e/fixtures/dapp/page.ts
@@ -57,6 +57,16 @@ async function run(f: () => Promise<unknown>): Promise<Result> {
   }
 }
 
+/** B1c-3: `run`, but a failure keeps the adapter's own error TYPE (`adapterSignAll`'s NamedFailure shape). */
+async function named(f: () => Promise<unknown>): Promise<Result | NamedFailure> {
+  try {
+    return {ok: true, value: await f()};
+  } catch (e) {
+    const err = e as {message?: unknown; name?: unknown};
+    return {ok: false, message: String(err.message), name: typeof err.name === 'string' ? err.name : undefined};
+  }
+}
+
 interface SignTransaction {
   signTransaction(...inputs: {account: WalletAccount; transaction: Uint8Array; chain?: string}[]): Promise<{signedTransaction: Uint8Array}[]>;
 }
@@ -247,6 +257,40 @@ const dapp = {
       const [out] = await (w.features['solana:signTransaction'] as SignTransaction).signTransaction({account, transaction: tx.serialize(), chain: 'solana:mainnet'});
       return b64(out?.signedTransaction ?? new Uint8Array());
     }),
+  /**
+   * B1c-3: a transaction from arbitrary instructions through the adapter's own signTransaction (the connected account
+   * its fee payer) — the red-flag states reached the way a wallet-adapter dApp reaches them; the signed wire and this
+   * page's message bytes, base64.
+   */
+  adapterCustomSign: (blockhash: string, ixs: RawIx[]): Promise<Result> =>
+    run(async () => {
+      const a = theAdapter();
+      const from = a.publicKey?.toBase58();
+      if (from === undefined) throw new Error('not connected');
+      if (a.signTransaction === undefined) throw new Error('no signTransaction');
+      const tx = customTx(from, blockhash, ixs);
+      const signed = await a.signTransaction(tx);
+      return {signed: b64(signed.serialize()), message: b64(tx.message.serialize())};
+    }),
+  /** B1c-3: a batch — one transaction per instruction list — through the adapter's signAllTransactions. */
+  adapterCustomSignAll: (blockhash: string, batch: RawIx[][]): Promise<Result | NamedFailure> =>
+    named(async () => {
+      const a = theAdapter();
+      const from = a.publicKey?.toBase58();
+      if (from === undefined) throw new Error('not connected');
+      if (a.signAllTransactions === undefined) throw new Error('no signAllTransactions');
+      const txs = batch.map(ixs => customTx(from, blockhash, ixs));
+      const signed = await a.signAllTransactions(txs);
+      return {signed: signed.map(t => b64(t.serialize())), messages: txs.map(t => b64(t.message.serialize()))};
+    }),
+  /** B1c-3: one transaction from arbitrary instructions through the adapter's sendTransaction (the wallet's signAndSend). */
+  adapterCustomSend: (blockhash: string, ixs: RawIx[]): Promise<Result | NamedFailure> =>
+    named(async () => {
+      const a = theAdapter();
+      const from = a.publicKey?.toBase58();
+      if (from === undefined) throw new Error('not connected');
+      return a.sendTransaction(customTx(from, blockhash, ixs), CONNECTION);
+    }),
   /** Review fix I3: the signature AND the original message bytes (base64) this page built before sending. */
   adapterSend: (blockhash: string): Promise<Result> =>
     run(async () => {
````

Change `extension/e2e/dappPage.ts`:

````diff
diff --git a/extension/e2e/dappPage.ts b/extension/e2e/dappPage.ts
index 50bc473..cd1ba29 100644
--- a/extension/e2e/dappPage.ts
+++ b/extension/e2e/dappPage.ts
@@ -100,6 +100,9 @@ declare const dapp: {
   raw(type: string, payload: Record<string, unknown>): Promise<unknown>;
   rawTx(account: string, blockhash: string): string;
   customSign(blockhash: string, payer: string, ixs: RawIx[]): Promise<Result>;
+  adapterCustomSign(blockhash: string, ixs: RawIx[]): Promise<Result>;
+  adapterCustomSignAll(blockhash: string, batch: RawIx[][]): Promise<Result | NamedFailure>;
+  adapterCustomSend(blockhash: string, ixs: RawIx[]): Promise<Result | NamedFailure>;
 };
 
 /** A dApp tab at `origin`, its Wallet Standard registry ready (Noctura found, or not). */
@@ -133,6 +136,10 @@ export const adapter = {
   sign: (p: Page, blockhash: string) => p.evaluate(b => dapp.adapterSign(b), blockhash),
   signAll: (p: Page, count: number, blockhash: string) => p.evaluate(({n, b}) => dapp.adapterSignAll(n, b), {n: count, b: blockhash}),
   send: (p: Page, blockhash: string) => p.evaluate(b => dapp.adapterSend(b), blockhash),
+  /** B1c-3: arbitrary instructions through the adapter — one transaction, a batch, and sendTransaction. */
+  customSign: (p: Page, blockhash: string, ixs: RawIx[]) => p.evaluate(({b, i}) => dapp.adapterCustomSign(b, i), {b: blockhash, i: ixs}),
+  customSignAll: (p: Page, blockhash: string, batch: RawIx[][]) => p.evaluate(({b, i}) => dapp.adapterCustomSignAll(b, i), {b: blockhash, i: batch}),
+  customSend: (p: Page, blockhash: string, ixs: RawIx[]) => p.evaluate(({b, i}) => dapp.adapterCustomSend(b, i), {b: blockhash, i: ixs}),
 };
 
 /**
````

Change `extension/e2e/dappTx.spec.ts` (B1c-30 … B1c-34 appended):

````diff
diff --git a/extension/e2e/dappTx.spec.ts b/extension/e2e/dappTx.spec.ts
index 98fb1eb..2ceb7f5 100644
--- a/extension/e2e/dappTx.spec.ts
+++ b/extension/e2e/dappTx.spec.ts
@@ -1,11 +1,11 @@
-import {test, expect, type Page} from '@playwright/test';
+import {test, expect, type Locator, type Page} from '@playwright/test';
 import {ed25519} from '@noble/curves/ed25519.js';
 import {base58, base64} from '@scure/base';
 import {contained, launchPopup, type Harness} from './popupHarness';
 import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
 import {unlockWith} from './vaultPage';
-import {DAPP_HOSTS, adapter, approvalWindow, connect, features, noWindow, openDapp, rawSignTx, relayed, sendTx, serveDapp, signTx, windowClosed, type DappServer} from './dappPage';
-import {parseV0, type FakeCoordinator} from './fakeCoordinator';
+import {DAPP_HOSTS, adapter, approvalWindow, connect, features, noWindow, openDapp, rawSignTx, relayed, sendTx, serveDapp, signTx, windowClosed, type DappServer, type RawIx} from './dappPage';
+import {ATA_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, mintData, parseV0, type FakeCoordinator} from './fakeCoordinator';
 
 // Spec B1c §6.3 (B1c-2), §3.3, §1.4: the transaction features against the real extension — the provider, the relay,
 // the background's decoder and simulation (through the fake coordinator's proxy), #48 in the approval window, the
@@ -405,3 +405,418 @@ test('containment positive control · a request to the test dApp\'s own RPC host
     await h.close();
   }
 });
+
+// ——— B1c-3 (spec §3.3 rev 3.6, B1 §3's red-flag table): the flags computed in the background from the decoded
+// instructions and the fake node's pre/post state, rendered on #48, the blocks overridden only by the exact typed word
+// AND a re-authentication through the toolbar (O1, D11), each through StandardWalletAdapter as a wallet-adapter dApp
+// sends it. The background is the gate (C13): every block is also asked of it directly — the window's own dapp.decide,
+// sent from the window's page — without the word, with a wrong one, and with the right one before #10.
+
+const SYSTEM_PROGRAM = '11111111111111111111111111111111';
+const RECENT_BLOCKHASHES = 'SysvarRecentB1ockHashes11111111111111111111';
+const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
+const U64_MAX = 2n ** 64n - 1n;
+/** Fixed, distinct keys (a byte fill, as BLOCKHASH): the accounts and authorities of B1c-30 … B1c-34. */
+const key = (fill: number): string => base58.encode(new Uint8Array(32).fill(fill));
+const OWN_USDC = key(31);
+const DELEGATE = key(32);
+const T22_MINT = key(33);
+const OWN_T22 = key(34);
+const ISSUER = key(35);
+const FREEZER = key(36);
+const PERMANENT_DELEGATE = key(37);
+const HOOK_AUTHORITY = key(38);
+const NEW_ATA = key(39);
+const RECIPIENT_USDC = key(40);
+const NONCE = key(41);
+const DAPP_PROGRAM = key(42);
+const OWN_EMPTY = key(43);
+/** B1 §3: Confirm held 1.5 s on any red-flag screen; C15's 500 ms elsewhere. */
+const FLAG_HOLD_MS = 1_500;
+
+const u64le = (n: bigint): number[] => {
+  const b = new Uint8Array(8);
+  new DataView(b.buffer).setBigUint64(0, n, true);
+  return Array.from(b);
+};
+const signer = (pubkey: string, isWritable = true) => ({pubkey, isSigner: true, isWritable});
+const writable = (pubkey: string) => ({pubkey, isSigner: false, isWritable: true});
+const readonly = (pubkey: string) => ({pubkey, isSigner: false, isWritable: false});
+const ix = {
+  /** SPL Token ApproveChecked (13): source, mint, delegate, owner; amount, decimals. */
+  approveChecked: (source: string, mint: string, delegate: string, amount: bigint, decimals: number): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(source), readonly(mint), readonly(delegate), signer(ACCOUNT, false)], data: [13, ...u64le(amount), decimals]}),
+  /** SPL Token TransferChecked (12): source, mint, destination, owner; amount, decimals. */
+  transferChecked: (source: string, mint: string, destination: string, amount: bigint, decimals: number): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(source), readonly(mint), writable(destination), signer(ACCOUNT, false)], data: [12, ...u64le(amount), decimals]}),
+  /** SPL Token CloseAccount (9): account, destination, owner. */
+  closeAccount: (account: string): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(account), writable(ACCOUNT), signer(ACCOUNT, false)], data: [9]}),
+  /** System Assign (1) of the wallet account to `owner`. */
+  assign: (owner: string): RawIx => ({programId: SYSTEM_PROGRAM, keys: [signer(ACCOUNT)], data: [1, 0, 0, 0, ...base58.decode(owner)]}),
+  /** System Transfer (2) from the wallet account. */
+  transfer: (to: string, lamports: bigint): RawIx => ({programId: SYSTEM_PROGRAM, keys: [signer(ACCOUNT), writable(to)], data: [2, 0, 0, 0, ...u64le(lamports)]}),
+  /** System AdvanceNonceAccount (4): nonce account, the recent-blockhashes sysvar, the nonce authority. */
+  advanceNonce: (nonce: string): RawIx => ({programId: SYSTEM_PROGRAM, keys: [writable(nonce), readonly(RECENT_BLOCKHASHES), signer(ACCOUNT, false)], data: [4, 0, 0, 0]}),
+  /** ATA Create (no data) / CreateIdempotent (1): payer, account, wallet, mint, System, the token program — six accounts. */
+  ataCreate: (account: string, wallet: string, mint: string, tokenProgram: string, idempotent: boolean): RawIx => ({
+    programId: ATA_PROGRAM,
+    keys: [signer(ACCOUNT), writable(account), readonly(wallet), readonly(mint), readonly(SYSTEM_PROGRAM), readonly(tokenProgram)],
+    data: idempotent ? [1] : [],
+  }),
+};
+
+/** The wallet holds 740.21 USDC in a (classic) token account; the USDC mint reads as Circle's does: 6 decimals, a mint and a freeze authority. */
+function holdUsdc(fake: FakeCoordinator, more: {pubkey: string; mint: string; amount: string; decimals: number; program?: 'token' | 'token-2022'}[] = []): void {
+  fake.tokenAccounts.set(ACCOUNT, [{pubkey: OWN_USDC, mint: USDC_MINT, amount: '740210000', decimals: 6}, ...more]);
+  fake.mints.set(USDC_MINT, {program: 'token', data: mintData({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER})});
+}
+/** A page connected through StandardWalletAdapter (its own connect → #47b's two gates). */
+async function adapterConnected(h: Harness): Promise<Page> {
+  const page = await openDapp(h.ctx, DAPP);
+  let c!: Promise<unknown>;
+  const w47 = await approvalWindow(h.ctx, () => (c = adapter.connect(page)));
+  await w47.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
+  await w47.getByRole('checkbox', {name: /I've read these permissions/}).click();
+  await w47.getByRole('button', {name: 'Connect for this session'}).click();
+  expect(await c).toEqual({ok: true, value: ACCOUNT});
+  await windowClosed(w47);
+  return page;
+}
+/**
+ * The window's own dapp.decide, sent from the window's page (approve.html, the one sender the background takes it from)
+ * for the request it shows — an approval of the simulation it shows, with `extra` (the typed words). What the
+ * background answers is the gate's own word, whatever the window's buttons allow.
+ */
+async function decideRaw(win: Page, extra: {overrides?: {tx: number; word: string}[]}): Promise<unknown> {
+  return win.evaluate(async x => {
+    const view = (await chrome.runtime.sendMessage({type: 'dapp.pending'})) as {data: {request: {requestId: string; tx: {account: {publicKey: string}; simulation: {id?: string}}}}};
+    const r = view.data.request;
+    return chrome.runtime.sendMessage({type: 'dapp.decide', requestId: r.requestId, decision: 'approve', account: r.tx.account.publicKey, simulation: r.tx.simulation.id, ...x});
+  }, extra);
+}
+/**
+ * How long `cta` stays disabled from now (polled every 50 ms) — called the moment a state is seen, so it measures the
+ * hold that state's render started, less the time it took to see it (0 when it was already enabled).
+ */
+async function heldFor(cta: Locator): Promise<number> {
+  const from = Date.now();
+  await expect.poll(() => cta.isEnabled(), {intervals: [50], timeout: 10_000}).toBe(true);
+  return Date.now() - from;
+}
+/**
+ * The re-authentication (D11) a block always needs: the window asks for it, the popup's strip opens #10, which names
+ * what is overridden (`rows`) and why (`reasons`); the password; then the window, told by a focus (B1c-28's I4: the
+ * background's own state polled first, never the window's 1 s timer), no longer waits.
+ */
+async function reauthFromToolbar(h: Harness, win: Page, rows: string[], reasons: string[]): Promise<void> {
+  await expect(win.getByText("Confirm it's you")).toBeVisible();
+  const toolbar = await h.openPopup();
+  const strip = toolbar.getByRole('button', {name: 'A transaction from dapp.test waits for your confirmation'});
+  const [tab] = await Promise.all([h.ctx.waitForEvent('page', {predicate: p => /unlock\.html/.test(p.url())}), strip.click()]);
+  await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
+  for (const r of rows) await expect(tab.locator('#ra-rows .intent-row', {hasText: r})).toHaveCount(1);
+  await expect(tab.locator('#ra-reasons p')).toHaveText(reasons);
+  await tab.locator('#ra-password').fill(E2E_PASSWORD);
+  await tab.locator('#ra-confirm').click();
+  await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. Go back to the approval window and approve the transaction.', {timeout: 60_000});
+  await expect
+    .poll(async () => {
+      const reply = (await toolbar.evaluate(() => chrome.runtime.sendMessage({type: 'dapp.reauth'}))) as {ok: true; data: unknown} | {ok: false; error: string};
+      return reply.ok ? reply.data : 'not-ok';
+    })
+    .toBeNull();
+  await win.evaluate(() => window.dispatchEvent(new Event('focus')));
+  await expect(win.getByText("Confirm it's you")).toHaveCount(0);
+  await toolbar.close();
+}
+/**
+ * Every Content Security Policy line any page of the context logs — the approval windows, #10's tab, the popup — with
+ * each document's `securitypolicyviolation` events logged to the same channel (csp.spec.ts watches the vault page the
+ * same two ways; B1c-34 ends with this watch's own positive control). Asserted empty by each B1c-3 test.
+ */
+async function watchCsp(h: Harness): Promise<string[]> {
+  const lines: string[] = [];
+  h.ctx.on('console', m => {
+    if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) lines.push(m.text());
+  });
+  await h.ctx.addInitScript(() => {
+    document.addEventListener('securitypolicyviolation', e => console.error(`Content Security Policy violation: ${e.effectiveDirective} ${e.blockedURI}`));
+  });
+  return lines;
+}
+const APPROVAL_LINE = 'Re-auth required to approve a token allowance.';
+const OVERRIDE_LINE = 'Re-auth required to override a blocked transaction.';
+
+test('B1c-30 · unlimited approve (F5, USDC): blocked — the typed symbol, exact, case-sensitive, then #10 through the toolbar; the background refuses without the word, with a wrong one, and without the proof', async () => {
+  test.setTimeout(300_000);
+  const {h, server} = await scene('noctura-e2e-dapptx-unlimited-');
+  try {
+    const csp = await watchCsp(h);
+    holdUsdc(h.fake);
+    await popup(h);
+    const page = await adapterConnected(h);
+    let signed!: Promise<unknown>;
+    const win = await approvalWindow(h.ctx, () => (signed = adapter.customSign(page, BLOCKHASH, [ix.approveChecked(OWN_USDC, USDC_MINT, DELEGATE, U64_MAX, 6)])));
+    let answered = false;
+    // (A rejection is the test's teardown closing the page — never this test's verdict.)
+    void signed.then(
+      () => (answered = true),
+      () => undefined,
+    );
+    // The design's state 2: the eyebrow, ONE danger banner (Task 6: F2 does not repeat the approve), the synthesized row.
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Unlimited spend approval', {timeout: 10_000});
+    const banner = win.locator('.s9-flag-banner.danger');
+    await expect(banner).toHaveCount(1);
+    await expect(banner.locator('.head')).toHaveText('Unlimited USDC spend approval');
+    await expect(banner.locator('.body')).toContainText('spl_token::ApproveChecked');
+    await expect(banner.locator('.body')).toContainText('amount = u64::MAX');
+    await expect(banner.locator('.meta')).toContainText(DELEGATE);
+    await expect(banner.locator('.meta')).toContainText(USDC_MINT);
+    await expect(win.locator('.s9-flag-banner.warn')).toHaveCount(0);
+    await expect(win.getByText('USDC delegated')).toBeVisible();
+    // Approve unlimited: red, gated (#37's look) and disabled until the field matches.
+    const cta = win.getByRole('button', {name: 'Approve unlimited'});
+    const field = win.getByLabel('Type USDC to enable Approve');
+    await expect(field).toHaveValue('');
+    await expect(field).not.toBeFocused();
+    await expect(cta).toHaveClass(/app-cta-gated/);
+    await expect(cta).toBeDisabled();
+    // The background, asked directly: no word → override-missing; a wrong case → override-mismatch. Nothing is issued.
+    expect(await decideRaw(win, {})).toEqual({ok: false, error: 'override-missing'});
+    expect(await decideRaw(win, {overrides: [{tx: 0, word: 'usdc'}]})).toEqual({ok: false, error: 'override-mismatch'});
+    // The wrong case, then a trailing space: still gated — and still disabled once the 1.5 s hold has passed, so it is
+    // the match that keeps it disabled, not the hold.
+    for (const wrong of ['usdc', 'USDC ']) {
+      await field.fill(wrong);
+      await expect(field).not.toHaveClass(/\bmatch\b/);
+      await expect(cta).toHaveClass(/app-cta-gated/);
+      await win.waitForTimeout(FLAG_HOLD_MS + 500);
+      await expect(cta).toBeDisabled();
+    }
+    // The exact symbol: the match, the red CTA un-gated, held 1.5 s again (a match change re-holds), then enabled.
+    await field.fill('USDC');
+    await expect(field).toHaveClass(/\bmatch\b/);
+    await expect(cta).not.toHaveClass(/app-cta-gated/);
+    await expect(cta).toBeEnabled();
+    // Enter in the field submits nothing, and the page has no answer.
+    await field.press('Enter');
+    await cta.click();
+    // The word alone is not enough: the background asks for #10 (the `override` reason), and the page still waits.
+    await expect(win.getByText("Confirm it's you")).toBeVisible();
+    expect(await decideRaw(win, {overrides: [{tx: 0, word: 'USDC'}]})).toEqual({ok: false, error: 'reauth-required'});
+    expect(answered).toBe(false);
+    await reauthFromToolbar(h, win, ['Sitedapp.test', 'Unlimited USDC spend approval'], [APPROVAL_LINE, OVERRIDE_LINE]);
+    expect(answered).toBe(false);
+    await cta.click();
+    const r = (await signed) as {ok: true; value: {signed: string; message: string}};
+    expect(r.ok).toBe(true);
+    expect(signedBy(r.value.signed)).toBe(true);
+    expectOwnMessage(r.value.signed, r.value.message);
+    await windowClosed(win);
+    expect(csp).toEqual([]);
+    done(h, server);
+  } finally {
+    await h.close();
+  }
+});
+
+test('B1c-31 · Assign of the wallet account (F3): blocked, "ASSIGN" overrides it end to end; a lone closeAccount is a warning only — held 1.5 s, no typed field; a plain transfer is held only C15’s 500 ms', async () => {
+  test.setTimeout(300_000);
+  const {h, server} = await scene('noctura-e2e-dapptx-assign-');
+  try {
+    const csp = await watchCsp(h);
+    holdUsdc(h.fake, [{pubkey: OWN_EMPTY, mint: USDC_MINT, amount: '0', decimals: 6}]);
+    await popup(h);
+    const page = await adapterConnected(h);
+    let assigned!: Promise<unknown>;
+    const win = await approvalWindow(h.ctx, () => (assigned = adapter.customSign(page, BLOCKHASH, [ix.assign(DAPP_PROGRAM)])));
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
+    const banner = win.locator('.s9-flag-banner.danger');
+    await expect(banner).toHaveCount(1);
+    await expect(banner.locator('.head')).toHaveText('Assign / Allocate on your wallet account');
+    // The decoded instruction AND the fake node's post-state (the wallet account now owned by the dApp's program).
+    await expect(banner.locator('.meta').first()).toHaveText('#1 system_program::Assign');
+    await expect(banner.locator('.meta').nth(1)).toHaveText(`post-simulation · owner: ${DAPP_PROGRAM} · space: 0`);
+    const cta = win.getByRole('button', {name: 'Approve anyway'});
+    const field = win.getByLabel('Type ASSIGN to enable Approve');
+    await expect(cta).toBeDisabled();
+    expect(await decideRaw(win, {})).toEqual({ok: false, error: 'override-missing'});
+    await field.fill('Assign');
+    await expect(cta).toHaveClass(/app-cta-gated/);
+    await field.fill('ASSIGN');
+    await expect(cta).not.toHaveClass(/app-cta-gated/);
+    await cta.click();
+    await reauthFromToolbar(h, win, ['Sitedapp.test', 'Assign / Allocate on your wallet account'], [OVERRIDE_LINE]);
+    await cta.click();
+    const r = (await assigned) as {ok: true; value: {signed: string; message: string}};
+    expect(signedBy(r.value.signed)).toBe(true);
+    expectOwnMessage(r.value.signed, r.value.message);
+    await windowClosed(win);
+
+    // A lone closeAccount of the wallet's empty USDC account: F2's warning names it; nothing to type, no #10.
+    let closed!: Promise<unknown>;
+    const wc = await approvalWindow(h.ctx, () => (closed = adapter.customSign(page, BLOCKHASH, [ix.closeAccount(OWN_EMPTY)])));
+    const warn = wc.locator('.s9-flag-banner.warn');
+    await expect(warn).toHaveCount(1, {timeout: 10_000});
+    const approveClose = wc.getByRole('button', {name: 'Approve', exact: true});
+    expect(await heldFor(approveClose)).toBeGreaterThanOrEqual(1_000);
+    await expect(warn.locator('.head')).toHaveText('Instructions that are not transfers');
+    await expect(warn.locator('.meta')).toHaveText('#1 spl_token::CloseAccount');
+    await expect(wc.locator('.top-bar .title')).toHaveText('Approve transaction');
+    await expect(wc.locator('.s9-flag-banner.danger, .s9-typed-confirm, input')).toHaveCount(0);
+    await approveClose.click();
+    const rc = (await closed) as {ok: true; value: {signed: string; message: string}};
+    expect(signedBy(rc.value.signed)).toBe(true);
+    expectOwnMessage(rc.value.signed, rc.value.message);
+    await windowClosed(wc);
+
+    // The negative control of that measure: a plain transfer to a known recipient has no flag — C15's 500 ms only.
+    let plain!: Promise<unknown>;
+    const wp = await approvalWindow(h.ctx, () => (plain = adapter.sign(page, BLOCKHASH)));
+    await expect(wp.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
+    expect(await heldFor(wp.getByRole('button', {name: 'Approve', exact: true}))).toBeLessThan(1_000);
+    await expect(wp.locator('.s9-flag-banner')).toHaveCount(0);
+    await wp.getByRole('button', {name: 'Approve', exact: true}).click();
+    expect(((await plain) as {ok: boolean}).ok).toBe(true);
+    await windowClosed(wp);
+    expect(csp).toEqual([]);
+    done(h, server);
+  } finally {
+    await h.close();
+  }
+});
+
+test('B1c-32 · Token-2022 (F7): a held mint with a permanent delegate and a freeze authority is named; classic USDC with a freeze authority is not (O3)', async () => {
+  test.setTimeout(240_000);
+  const {h, server} = await scene('noctura-e2e-dapptx-t22-');
+  try {
+    const csp = await watchCsp(h);
+    holdUsdc(h.fake, [{pubkey: OWN_T22, mint: T22_MINT, amount: '1000000', decimals: 6, program: 'token-2022'}]);
+    // PYUSD's shape: a mint and a freeze authority, a permanent delegate, a transfer hook whose program is unset.
+    h.fake.mints.set(T22_MINT, {program: 'token-2022', data: mintData({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER, extensions: {permanentDelegate: PERMANENT_DELEGATE, transferHook: {authority: HOOK_AUTHORITY, program: null}}})});
+    await popup(h);
+    const page = await adapterConnected(h);
+    let signed!: Promise<unknown>;
+    // A dApp's usual preamble: its token accounts made sure of (CreateIdempotent of accounts that exist — nothing moves).
+    const win = await approvalWindow(h.ctx, () => (signed = adapter.customSign(page, BLOCKHASH, [ix.ataCreate(OWN_T22, ACCOUNT, T22_MINT, TOKEN_2022_PROGRAM, true), ix.ataCreate(OWN_USDC, ACCOUNT, USDC_MINT, TOKEN_PROGRAM, true)])));
+    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
+    const t22 = win.locator('.s9-flag-banner.warn', {hasText: 'Token-2022 settings on a token you hold'});
+    await expect(t22).toHaveCount(1);
+    await expect(t22.locator('.body')).toHaveText(['Freeze authority — the issuer can freeze your account of this token.', 'Permanent delegate — an address that can move or burn this token from any account, yours included.']);
+    await expect(t22.locator('.meta')).toHaveText([`mint: ${T22_MINT}`, `freezeAuthority: ${FREEZER}`, `permanentDelegate: ${PERMANENT_DELEGATE}`]);
+    // The negative controls: no transfer-hook line (its program is unset), and USDC's freeze authority is no flag.
+    await expect(win.getByText(/Transfer hook/)).toHaveCount(0);
+    await expect(win.locator('.s9-flag-banner', {hasText: USDC_MINT})).toHaveCount(0);
+    await expect(win.locator('.s9-flag-banner', {hasText: FREEZER})).toHaveCount(1);
+    // F2 names the two creates; warnings only: no block, no field — Approve after the 1.5 s hold.
+    await expect(win.locator('.s9-flag-banner.warn', {hasText: 'Instructions that are not transfers'}).locator('.meta')).toHaveText(['#1 spl_associated_token_account::CreateIdempotent', '#2 spl_associated_token_account::CreateIdempotent']);
+    await expect(win.locator('.s9-flag-banner.danger, .s9-typed-confirm')).toHaveCount(0);
+    await win.getByRole('button', {name: 'Approve', exact: true}).click();
+    const r = (await signed) as {ok: true; value: {signed: string; message: string}};
+    expect(signedBy(r.value.signed)).toBe(true);
+    expectOwnMessage(r.value.signed, r.value.message);
+    await windowClosed(win);
+    expect(csp).toEqual([]);
+    done(h, server);
+  } finally {
+    await h.close();
+  }
+});
+
+test('B1c-33 · a dependent batch (O2): create an account, then transfer into it — step 2 "depends on step 1", UNCHECKED + #10 → both signed; an unrelated failure in step 2 stays Reject only', async () => {
+  test.setTimeout(300_000);
+  const {h, server} = await scene('noctura-e2e-dapptx-dependent-');
+  try {
+    const csp = await watchCsp(h);
+    holdUsdc(h.fake);
+    h.fake.tokenAccounts.set(RECIPIENT, [{pubkey: RECIPIENT_USDC, mint: USDC_MINT, amount: '1000000', decimals: 6}]);
+    await popup(h);
+    const page = await adapterConnected(h);
+    const create = ix.ataCreate(NEW_ATA, RECIPIENT, USDC_MINT, TOKEN_PROGRAM, false);
+    let both!: Promise<unknown>;
+    const win = await approvalWindow(h.ctx, () => (both = adapter.customSignAll(page, BLOCKHASH, [[create], [ix.transferChecked(OWN_USDC, USDC_MINT, NEW_ATA, 500_000n, 6)]])));
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
+    const step2 = win.locator('section.app-tx-item').nth(1);
+    // The fake node simulated step 2 on its own: the account step 1 creates does not exist yet.
+    await expect(step2.locator('.s9-flag-banner.danger .head')).toHaveText('This step depends on step 1 and could not be checked on its own.');
+    await expect(step2.locator('.s9-flag-banner.danger .meta')).toHaveText('{"InstructionError":[0,"UninitializedAccount"]}');
+    await expect(step2.getByText('Balance changes (unknown)')).toBeVisible();
+    await expect(win.getByText("Couldn't simulate")).toHaveCount(0);
+    // One field, in step 2's section.
+    await expect(win.locator('.s9-typed-confirm')).toHaveCount(1);
+    const field = step2.getByLabel('Type UNCHECKED to enable Approve');
+    const cta = win.getByRole('button', {name: 'Approve anyway'});
+    expect(await decideRaw(win, {})).toEqual({ok: false, error: 'override-missing'});
+    expect(await decideRaw(win, {overrides: [{tx: 0, word: 'UNCHECKED'}]})).toEqual({ok: false, error: 'override-mismatch'});
+    await field.fill('unchecked');
+    await expect(cta).toHaveClass(/app-cta-gated/);
+    await field.fill('UNCHECKED');
+    await cta.click();
+    await reauthFromToolbar(h, win, ['Sitedapp.test', 'Transactions2', 'Depends on step 1 — not checked on its ownTransaction 2 of 2'], ['Re-auth required for the first send to a new address.', OVERRIDE_LINE]);
+    await cta.click();
+    const r = (await both) as {ok: true; value: {signed: string[]; messages: string[]}};
+    expect(r.ok).toBe(true);
+    expect(r.value.signed).toHaveLength(2);
+    r.value.signed.forEach((wire, i) => {
+      expect(signedBy(wire)).toBe(true);
+      expectOwnMessage(wire, r.value.messages[i] ?? '');
+    });
+    await windowClosed(win);
+
+    // Step 2 fails for a reason of its own (more USDC than the wallet holds, into an account that exists): no account
+    // step 1 creates is in its failing instruction — a plain failure, Reject only, and the background refuses the word.
+    let failed!: Promise<unknown>;
+    const wf = await approvalWindow(h.ctx, () => (failed = adapter.customSignAll(page, BLOCKHASH, [[create], [ix.transferChecked(OWN_USDC, USDC_MINT, RECIPIENT_USDC, 10_000_000_000n, 6)]])));
+    await expect(wf.getByText("Couldn't simulate")).toBeVisible({timeout: 10_000});
+    await expect(wf.locator('.s9-flag-banner.danger .meta')).toHaveText('Transaction 2 of 2: {"InstructionError":[0,{"Custom":1}]}');
+    await expect(wf.locator('.s9-typed-confirm')).toHaveCount(0);
+    await expect(wf.locator('.sticky-bar button')).toHaveText(['Reject']);
+    expect(await decideRaw(wf, {overrides: [{tx: 1, word: 'UNCHECKED'}]})).toEqual({ok: false, error: 'simulation-failed'});
+    await wf.getByRole('button', {name: 'Reject', exact: true}).click();
+    expect(await failed).toEqual({ok: false, message: 'The user rejected the request.', name: 'WalletSignTransactionError'});
+    await windowClosed(wf);
+    expect(csp).toEqual([]);
+    done(h, server);
+  } finally {
+    await h.close();
+  }
+});
+
+test('B1c-34 · durable nonce (F8): signTransaction shows "This transaction does not expire." and signs after the hold; signAndSendTransaction is still refused with no window (R12)', async () => {
+  test.setTimeout(240_000);
+  const {h, server} = await scene('noctura-e2e-dapptx-nonce-');
+  try {
+    const csp = await watchCsp(h);
+    await popup(h);
+    const page = await adapterConnected(h);
+    const ixs = [ix.advanceNonce(NONCE), ix.transfer(RECIPIENT, 5n)];
+    let signed!: Promise<unknown>;
+    const win = await approvalWindow(h.ctx, () => (signed = adapter.customSign(page, BLOCKHASH, ixs)));
+    const nonce = win.locator('.s9-flag-banner.warn');
+    await expect(nonce).toHaveCount(1, {timeout: 10_000});
+    const cta = win.getByRole('button', {name: 'Approve', exact: true});
+    expect(await heldFor(cta)).toBeGreaterThanOrEqual(1_000);
+    await expect(nonce.locator('.head')).toHaveText('This transaction does not expire.');
+    await expect(nonce.locator('.meta')).toHaveText('#1 system_program::AdvanceNonceAccount');
+    await expect(win.locator('.s9-flag-banner.danger, .s9-typed-confirm')).toHaveCount(0);
+    await cta.click();
+    const r = (await signed) as {ok: true; value: {signed: string; message: string}};
+    expect(signedBy(r.value.signed)).toBe(true);
+    expectOwnMessage(r.value.signed, r.value.message);
+    await windowClosed(win);
+    // The same transaction through sendTransaction (the wallet's signAndSendTransaction): refused at the page, no window,
+    // nothing broadcast — and the adapter does not fall back to its own Connection (done() checks the dApp's RPC).
+    expect(await noWindow(h.ctx, () => adapter.customSend(page, BLOCKHASH, ixs))).toEqual({ok: false, message: 'The request is not valid.', name: 'WalletSendTransactionError'});
+    expect(h.fake.broadcasts).toEqual([]);
+    expect(csp).toEqual([]);
+    // The watch's positive control: an inline <style> added to an extension page (the popup) is refused and heard.
+    const p = await h.openPopup();
+    await p.evaluate(() => {
+      const style = document.createElement('style');
+      style.textContent = 'body { outline: 0 }';
+      document.head.append(style);
+    });
+    await expect.poll(() => csp.length).toBeGreaterThan(0);
+    done(h, server);
+  } finally {
+    await h.close();
+  }
+});
````

Change `extension/src/app/__tests__/Home.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Home.test.tsx b/extension/src/app/__tests__/Home.test.tsx
index 3063c64..c784db9 100644
--- a/extension/src/app/__tests__/Home.test.tsx
+++ b/extension/src/app/__tests__/Home.test.tsx
@@ -27,7 +27,13 @@ const cssRule = (selector: string): string => {
 // Synced a few seconds ago, today: the clock-time captions ("last synced 09:41:13") read as clock times.
 // Stamped when each test writes it, not at module load (the final review's M2): under a loaded full
 // suite a module-load stamp aged past a minute before the later tests ran ("cached 1 min ago").
-const cache = () => ({[ACCOUNT.publicKey]: {sol: '62482100000', noc: '4200000000000', usdc: '740210000', usdt: '0', at: Date.now() - 5_000}});
+const cache = (now = Date.now()) => ({[ACCOUNT.publicKey]: {sol: '62482100000', noc: '4200000000000', usdc: '740210000', usdt: '0', at: now - 5_000}});
+/**
+ * B1c-3 (ledger Task 6): the tests that read a clock-time caption run on the harness's clock (the provider's `now` and
+ * the background's `deps.now`), never the wall clock — "today" is a fixed local noon, so a run that crosses local
+ * midnight cannot turn "last synced 23:59:57" into "Oct 16, 23:59:57".
+ */
+const NOON = new Date(2026, 4, 6, 12, 0, 0).getTime();
 const never = () => new Promise<never>(() => undefined);
 const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', {value, configurable: true});
 const nav = {onSend: vi.fn(), onReceive: vi.fn(), onPending: vi.fn(), onAccounts: vi.fn()};
@@ -420,8 +426,8 @@ describe('#42 offline and the D26 refused state', () => {
         throw new RequestUnreachable('u', 'offline');
       },
     });
-    // The background's clock at today's time, so the fresh prices' `at` reads as a clock time.
-    await renderHome({reader, deps: {now: () => Date.now()}, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
+    // The background's clock and the provider's at today's noon, so the cache's and the fresh prices' `at` read as clock times.
+    await renderHome({reader, now: () => NOON, deps: {now: () => NOON}, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache(NOON))});
     expect(await screen.findByText("You're offline")).toBeTruthy();
     expect(screen.getByText('Network just dropped · the Noctura server is unreachable')).toBeTruthy();
     expect(screen.getByText('Sending needs a network connection. Receiving works — your address is on this device. Use the refresh button to retry.')).toBeTruthy();
@@ -444,7 +450,7 @@ describe('#42 offline and the D26 refused state', () => {
         throw new RequestUnreachable('u', 'offline');
       },
     });
-    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
+    await renderHome({reader, now: () => NOON, deps: {now: () => NOON}, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache(NOON))});
     await screen.findByText("You're offline");
     fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
     expect(await screen.findByText("You're offline · Showing cached data")).toBeTruthy();
@@ -630,13 +636,13 @@ describe('#42 offline and the D26 refused state', () => {
   });
 
   it('sustained after 30 s (the injected clock), with no retry made: no retry count, the stale label', async () => {
-    let t = Date.now();
+    let t = NOON;
     const reader = walletReader({
       getBalance: async () => {
         throw new RequestUnreachable('u', 'no answer');
       },
     });
-    await renderHome({reader, now: () => t, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
+    await renderHome({reader, now: () => t, deps: {now: () => t}, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache(NOON))});
     expect(await screen.findByText('Showing your last synced balances.')).toBeTruthy();
     expect(screen.queryByText(/^Stale · /)).toBeNull();
     t += 31_000;
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

This task adds no product code: B1c-30 … B1c-34 pass against Task 6's build (that is what they prove — Tasks 1–6 work end to end), so their red runs are this task's named mutations (Step 5), each a build that differs in one check. Home.test's red is the wall clock: the dry run moved the test worker's clock (a scratch `--import` module, below — never committed) and ran the #42 describe on Task 6's tree:

```bash
# clockAt.mjs: this process's Date set to CLOCK_AT (local) at its first clock read, then running on in real time.
CLOCK_AT=23:59:59.900 NODE_OPTIONS="--import <scratch>/clockAt.mjs" npx vitest run src/app/__tests__/Home.test.tsx -t '#42'
```

```js
// <scratch>/clockAt.mjs (dry-run aid, not in the repository)
const at = process.env.CLOCK_AT;
if (at !== undefined) {
  const Real = Date;
  let offset = null;
  const shift = () => {
    if (offset === null) {
      const [h, m, s] = at.split(':');
      const target = new Real();
      target.setHours(Number(h), Number(m), Math.floor(Number(s)), Math.round((Number(s) % 1) * 1000));
      offset = target.getTime() - Real.now();
    }
    return offset;
  };
  class Shifted extends Real {
    constructor(...a) {
      if (a.length === 0) super(Real.now() + shift());
      else super(...a);
    }
    static now() {
      return Real.now() + shift();
    }
  }
  globalThis.Date = Shifted;
}
```

Observed on Task 6's tree (18 #42 tests run, 19 skipped): `CLOCK_AT=23:59:59.900` and `23:59:58.000` (the tests run just after midnight; the cache's stamp is yesterday) → **2 failed** ("just disconnected", "sustained (two failed refreshes)"); `23:59:56.000`, `23:59:54.000`, `23:59:52.000`, `23:59:50.000` (midnight falls during the run) → **1 failed** ("sustained after 30 s"). Without the shift every test passes, as the ledger said.

- [ ] **Step 3: Implement.**

Nothing to implement in the product. Two B1c-2 visual states are updated deliberately — what F1 and F6 now draw on them (spec §3.3 rev 3.6), nothing else in any existing spec changed; every other B1c-1 / B1c-2 E2E passed unchanged on Task 6's tree (the dry run's first full run: 46 non-visual passed, 19 of 20 visual — `visual-dapp-tx` #48 failing at these two states):
- `48-unknown-program`: `getByText('unknown program')` now matches two elements (F1's banner head "Unknown program" and the row's "· unknown program") — the row's own text is asserted, and the banner's head.
- `48-approval-reauth`: a bounded approve (500 000 000 of 5 000 000 000 NOC base units) is F6 — its "NOC spend approval" warning and the design's synthesized "NOC delegated · 0.5" row replace L3's "No SOL or token balance changes" line (spec §3.3); the shot's anchor is the delegated row; L3's line is asserted absent; the re-authentication line stays.

Change `extension/e2e/visual-dapp-tx.spec.ts`:

````diff
diff --git a/extension/e2e/visual-dapp-tx.spec.ts b/extension/e2e/visual-dapp-tx.spec.ts
index f076edb..e38c6d6 100644
--- a/extension/e2e/visual-dapp-tx.spec.ts
+++ b/extension/e2e/visual-dapp-tx.spec.ts
@@ -215,8 +215,10 @@ test('visual · #48: simulating, simulated, a batch, re-authentication, approvin
     await fresh(h.sw);
     win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [{programId: UNKNOWN_PROGRAM, keys: [{pubkey: MAIN.publicKey, isSigner: true, isWritable: true}], data: [9, 9, 9, 9]}]));
     await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
-    const unknownProgram = win.getByText('unknown program');
+    // B1c-3: the instruction row's own "· unknown program" — F1's warning banner ("Unknown program") now stands above it.
+    const unknownProgram = win.getByText('· unknown program');
     await expect(unknownProgram).toBeVisible();
+    await expect(win.locator('.s9-flag-banner.warn .head')).toHaveText('Unknown program');
     await still(win, '48-unknown-program', unknownProgram, win.getByRole('button', {name: 'Approve', exact: true}));
     await dismiss(win);
 
@@ -273,11 +275,16 @@ test('visual · #48: simulating, simulated, a batch, re-authentication, approvin
         {programId: TOKEN_PROGRAM, keys: [{pubkey: SOURCE_TOKEN_ACCT, isSigner: false, isWritable: true}, {pubkey: RECIPIENT, isSigner: false, isWritable: false}, {pubkey: MAIN.publicKey, isSigner: true, isWritable: false}], data: [4, ...u64le(500_000_000n)]},
       ]),
     );
-    const noChangesApproval = win.getByText('No SOL or token balance changes — review the instructions below.');
+    // B1c-3: a bounded approve is F6 — its warning banner, and the design's synthesized "<SYM> delegated · <amount>" row
+    // in place of L3's "No SOL or token balance changes" line (spec §3.3 rev 3.6); still re-authenticated.
+    const delegatedRow = win.locator('.s9-bal-row', {hasText: 'NOC delegated'});
     const reauthLine = win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.");
-    await expect(noChangesApproval).toBeVisible({timeout: 10_000});
+    await expect(delegatedRow).toBeVisible({timeout: 10_000});
+    await expect(delegatedRow).toContainText('0.5');
+    await expect(win.getByText('No SOL or token balance changes — review the instructions below.')).toHaveCount(0);
+    await expect(win.locator('.s9-flag-banner.warn .head')).toHaveText(['NOC spend approval']);
     await expect(reauthLine).toBeVisible();
-    await still(win, '48-approval-reauth', noChangesApproval, win.getByRole('button', {name: 'Approve', exact: true}));
+    await still(win, '48-approval-reauth', delegatedRow, win.getByRole('button', {name: 'Approve', exact: true}));
     await dismiss(win);
 
     // signAndSendTransaction's own copy: Noctura broadcasts, never the site.
````

(B1c-25 … B1c-29 need no change: a System transfer carries no flag. No existing E2E request is blocked by F3/F4/F5 — the only approve in B1c-1/B1c-2's specs is the bounded one above.)

- [ ] **Step 4: Run — green, the whole suite, the build, the gates, and the whole Playwright suite twice.**

`npx tsc --noEmit; echo $?` → `0`. `npx vitest run` → **Test Files 170 passed (170), Tests 3415 passed (3415)** (unchanged: three Home tests rewritten, none added). `node scripts/build.mjs` → exit 0. `npm run gates` → exit 0 (every gate's ok line, `classes ok: every class in 56 src/app and src/approve files …`). Nothing under `core/` or the repository root's `src/` is touched (root `tsc`/`jest`, web's `verify` not needed).

Home.test on the harness's clock, under the same shifted wall clock: `CLOCK_AT` = 23:59:59.900, 23:59:58.000, 23:59:56.000, 23:59:54.000, 23:59:52.000, 23:59:50.000 with `-t '#42'` → **18 passed** each time; the whole file at 23:59:59.900 → 37 passed.

The new specs: `node scripts/build.mjs && npx playwright test e2e/dappTx.spec.ts -g 'B1c-3[0-4]'` → **5 passed**.

The whole Playwright suite, sequentially, visual specs last, `test-results` removed before each part:

```bash
rm -rf test-results && npx playwright test $(ls e2e/*.spec.ts | grep -v visual)
rm -rf test-results && npx playwright test $(ls e2e/visual*.spec.ts)
# then the same two under: unshare -rn npx playwright test …
```

Observed: normally **51 passed** (11.8 min) + **20 passed** (6.9 min); under `unshare -rn` **51 passed** (12.0 min) + **20 passed** (6.9 min) — the first pair before the CSP watch was added; after it (the final commit) again normally 51 + 20 passed (12.2 / 6.8 min) and under `unshare -rn` 51 + 20 passed (11.9 / 6.9 min). Every test ends with `contained(h)` / `done(h, server)` (the fake's `unexpected`, the Solscan and other-noc-tura.io counters, the test dApp's `server.unexpected` — empty), containment's positive controls pass, `csp.spec.ts` (zero violations on every vault-page mode, its positive control reported) passes, and each B1c-3 test's own CSP watch is empty (B1c-34's positive control heard).

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy (node_modules linked), built (`node scripts/build.mjs`); `tsc`'s own exit code first (0), then the named spec: red.**

| id | the change | the test that turns red | observed |
|---|---|---|---|
| M7a | `signTx.ts` `txRefused`: the `override-missing` row dropped (a block without its word passes the background — the typed-free approve goes on to the re-authentication and would sign once proven) | B1c-30: `decideRaw(win, {})` → `override-missing` | tsc 0, 1 failed (l. 583) |
| M7b | `Tx.tsx`: `canApprove` without `allMatch` (the CTA still looks gated) | B1c-30: `usdc` typed, the hold passed → still disabled | tsc 0, 1 failed (l. 592, `Received: enabled`) |
| M7c | `Tx.tsx`: the window's match case-folded (`toUpperCase()` both sides) | B1c-30: `usdc` typed → still `app-cta-gated` | tsc 0, 1 failed (l. 590) |
| M7d | `redFlags.ts`: F5 dropped (`unlimited: false` — every approve bounded, a warning) | B1c-30: the eyebrow | tsc 0, 1 failed (`Received: "Approve transaction"`) |
| M7e | `redFlags.ts`: F7 reads classic mints too (O3 dropped: the TOKEN_PROGRAM skip made dead) | B1c-32: no banner names USDC's mint | tsc 0, 1 failed (`Expected: 0, Received: 1`) |
| M7f | `simulate.ts`: F10's attribution consults no earlier step (`created.slice(0, 0)`) | B1c-33: the eyebrow (a plain failure instead) | tsc 0, 1 failed (`Received: "Approve transaction"`) |
| M7g | `useArmed.ts`: `FLAG_HOLD_MS = 500` | B1c-31 (closeAccount) and B1c-34 (nonce): held ≥ 1 000 ms | tsc 0, 2 failed (`Received: 184`) |
| M7h | `redFlags.ts`: F3 dropped (decoded and chain) | B1c-31: the eyebrow | tsc 0, 1 failed |
| M7i | `redFlags.ts`: F8 dropped | B1c-34: the banner's head (`Received: "Instructions that are not transfers"` — F2 then names AdvanceNonceAccount) | tsc 0, 1 failed |
| M7j | `fakeCoordinator.ts` (test-side): ApproveChecked's delegate not modeled | B1c-30: #10's reasons (no allowance line — the chain state the fake must report is load-bearing) | tsc 0, 1 failed (l. 516) |
| M7k | `Home.test.tsx`: Task 6's version (the wall clock) | Home #42 under `CLOCK_AT=23:59:55.000` (whole file) / the `-t '#42'` settings of Step 2 | tsc 0, 1 failed ("sustained after 30 s"); the whole file at 23:59:59.900 passes (the #42 tests run seconds after the anchor — the `-t '#42'` runs are the ones that land on midnight) |

Each E2E mutant was built from this task's end tree and its spec run alone (`npx playwright test e2e/dappTx.spec.ts -g '<B1c-NN>'`).

- [ ] **Step 6: Commit.**

```bash
git add extension/e2e/fakeCoordinator.ts extension/e2e/fixtures/dapp/page.ts extension/e2e/dappPage.ts extension/e2e/dappTx.spec.ts extension/e2e/visual-dapp-tx.spec.ts extension/src/app/__tests__/Home.test.tsx
git commit -m "test(extension): B1c-3 Task 7 — E2E B1c-30 … B1c-34: the red flags through StandardWalletAdapter; the fake models them; Home #42 on the harness's clock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Dry run: clone commit `fd3ebd6` on Task 6's `05a1f32`.)

#### Dry-run notes (Task 7)

- **Ruling: the background is asked directly from the window's own page** (`decideRaw`: `dapp.pending` then `dapp.decide` via `chrome.runtime.sendMessage` from approve.html) — why: the window's gate (a disabled button) cannot prove the background's; this is the window's own message, so it is exactly what a compromised or buggy window could send — cost if wrong: none (test only; messages.ts already accepts dapp.decide only from approve.html).
- **Ruling: "still disabled" after a wrong word is asserted after a deliberate wait of FLAG_HOLD_MS + 500 ms** (`waitForTimeout`) — not to paper over a flake but to make a negative assertion mean "the gate", not "the hold" (M7b proves it: with the match check dropped only the post-hold assertion catches it). The 1.5 s hold itself is measured (`heldFor`, 50 ms polling) from the moment the state is seen: ≥ 1 000 ms on flagged screens, < 1 000 ms on an unflagged one (the negative control) — a lower bound below 1 500 because the state is seen a little after its render started the hold — cost if wrong: a loaded runner could stretch the unflagged measure past 1 s (none in four full runs).
- **Ruling: the fake holds the wallet's three mints by default (classic, NOC 9, USDC/USDT 6, authorities not modeled)** — why: the real chain has them; without them the wallet reads no mint, F5's word is always `UNLIMITED` and every NOC/USDC approve warns Q36 (seen on `48-approval-reauth` in the first run) — cost if wrong: a spec wanting an unreadable wallet mint must `fake.mints.delete(…)`.
- **Ruling: the fake's CloseAccount returns the closed account as null** (its convention for an account holding no lamports) and pays its rent to the payer when it is the destination; F4's chain rule reads no owner change from a null post-state (redFlags.ts), so a lone close stays a warning — the spec's claim. Whether a real node reports a closed account as null or as a 0-lamport System account, both are "not a token account" to `tokenAccountInfo`, so the flag outcome is the same.
- **Ruling: the dependent step's node error stays the fake's existing `{"InstructionError":[i,"UninitializedAccount"]}`** — a real classic Token program refuses a 0-byte destination with `InvalidAccountData` (the account is loaded empty); Task 3 attributes any `InstructionError` the same way, so the shape does not matter to F10 — not changed, to keep B1c-2's fake behaviour.
- **Ruling: B1c-3's specs go through StandardWalletAdapter throughout** (connect, signTransaction, signAllTransactions, sendTransaction) — the brief's "where it applies": all five do; B1c-25 … B1c-29 keep their own paths.
- **Ruling (CSP): each B1c-3 test watches the whole context's console** (every approval window, #10's tab, the popup) with each document's `securitypolicyviolation` logged to it, and asserts none; one positive control (B1c-34, an inline style on the popup). B1c-25 … B1c-29 are not given the watch (unchanged) — `csp.spec.ts` covers the vault page as before.
- **Deviation: no red run of the new specs on Task 6's tree** — this task adds no product code (they are green there by design); their red runs are M7a–M7j. Home.test's red run is Step 2's shifted clock (the harness's clock is the fix; there is no other implementation).
- **Finding for the owner (not changed):** a dependent batch carries first-send's reason as well as `override` (Task 3's ruling — the destination is created by another transaction); #10 shows both lines (B1c-33 pins it).
- **For Task 8 (visual):** the new states are reachable with these builders (`ix.*`, `holdUsdc`, `fake.mints`, `mintData`); `48-unknown-program` now shows F1's banner and `48-approval-reauth` F6's banner and the delegated row (the shots themselves not re-reviewed here); `visual-dapp-tx.spec.ts`'s header line "B1c-3's states … are not shot" is Task 8's to change.

---

### Task 8: The visual pass — every B1c-3 #48 state shot at 412 × 720 and compared with the design (state 2, ix:18325-18396), #10 for an override, the four carried visual items; the design deviations it found fixed (banner meta addresses inline, the red CTA on one line, payload keys unwrapped, no #10 headline for an override or an allowance, #47's gate line clear of the scroll area)

**Spec:** B1c §6.4 (the visual pass: every state the real extension can be put in, saved for review against index.html, its own copy asserted before its shot), §3.3 rev 3.6 ("Banners", "The typed field", "Holds", the override rule and #10's override rows), B1 §3 l.276-322; the design #48 ix:18261-18705 (state 2 `unlimited-spend · typed-confirm` ix:18325-18396, its CSS ix:3824-3868, the DS class map ix:18522-18536), #10 ix:6061-6064, #11 ix:6374, #49 ix:3885; the brief's carried items (R9 Tensor; #46 Q26; #11 strip; #10 unsigned headline)

**Files:**
- Test: `extension/e2e/visual-dapp-tx.spec.ts` (header: "B1c-3's states … are not shot" replaced; the B1c-3 test — 21 shots; the carried-items test — 4 shots; helpers `ix`, `pastHold`, `into`, `lines`, `oneLine`, `metaInline`; `47a-tensor` also `gateClear`)
- Test: `extension/e2e/visual-dapp.spec.ts` (#46's `46-sign-null` asserts the Q26 banner, not the old lede; `still` runs `gateClear` on every state with #47's gate line)
- Test: `extension/e2e/visualTab.ts` (`gateClear` — the gate line's text and what the scroll area paints above it do not intersect, ≥ 7.5 px apart)
- Test: `extension/src/approve/__tests__/connect.test.tsx` (the rendered gate line's computed padding-top / flex-shrink / background, both sheets loaded in happy-dom)
- Test: `extension/e2e/dappPage.ts` (`DAPP_HOSTS` gains `tensor.trade` — the verified Tensor, routed and unresolvable like every test host)
- Test: `extension/src/unlock/__tests__/reauthScreen.test.ts` (one test added, two expectations changed — the #10 headline finding)
- Modify: `extension/src/app/app.css` (four rules — findings F-1, F-2, F-3, F-5)
- Modify: `extension/src/unlock/screens/reauth.ts` (finding F-4)
- Modify: `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (§3.3: #10's headline with an override or an allowance)
- Not modified: `core/`, the repository root's `src/`, `web/`, design-ext.css (generated-only; nothing new extracted). No new devDependency. No new copy (every string asserted is the spec's, the design's or a numbered Q of Tasks 1–6).

**Interfaces:**
- Consumes: Tasks 1–7 built (#48's banners / typed fields / red CTAs / delegated rows / 1.5 s hold / dependent section; #10's override rows and Q33; the fake's mints, Token-2022 accounts, ApproveChecked delegate, Assign post-state; the test dApp's `customSign` and the adapter's `customSignAll`); B1c-2's visual harness (`scene`, `granted`, `windowFor`, `still` — copy first, then every sticky-bar button wholly in the viewport, then the shot —, `dismiss`, `pop`, `shot`).
- Produces: shots under `extension/test-results/visual/` (not committed — B1c-2's convention): `48-unlimited`, `48-unlimited-typed-empty`, `48-unlimited-typed-wrong-case`, `48-unlimited-typed-matched`, `10-dapp-override`, `48-assign`, `48-assign-typed-empty`, `48-approve-anyway`, `48-set-authority`, `48-batch-one-blocked`, `48-batch-one-blocked-section`, `48-warn-non-transfer`, `48-warn-token-2022`, `48-warn-token-2022-unreadable`, `48-warn-nonce`, `48-warn-whole-balance`, `48-dependent`, `48-dependent-typed-empty`, `48-lookalike-block`, `48-lookalike-block-typed`, `48-lookalike-block-confirm`, `11-pending-strip`, `47a-tensor`, `48-tensor`, `49-tensor`. F1's and F6's warnings are B1c-2's `48-unknown-program` and `48-approval-reauth` (Task 7 updated them; re-reviewed here), #10's unsigned headline is `10-dapp`, #46's Q26 banner `46-sign-null`.
- Product behaviour changed: #10 (`reauth.ts`) draws no headline amount when the description carries an override row or the allowance reason line (`REAUTH.approval`); the one outflow is then a row with its minus.

How each state is reached: the instructions are B1c-30 … B1c-34's (`ix.*`, the same byte fills), signed by `MAIN`; jup.ag — verified, the design's own state 2 origin — asks through the provider's `signTransaction` (`customSignTx`), a batch through StandardWalletAdapter's `signAllTransactions` on the same granted page (its `connect` is answered without a window: the grant exists). The wallet holds 740.21 USDC, an empty USDC account and two Token-2022 accounts; one Token-2022 mint carries all three settings B1 §3 names (freeze authority, permanent delegate, transfer-hook program), the other is not on the fake chain (Q36). Every shot asserts its own copy first and every sticky-bar button wholly in the 412 × 720 viewport (`still` → `barInView`). Holds: a shot whose CTA is enabled awaits it (`ready` — the 1.5 s hold); a gated CTA is shot after `pastHold` — `waitForTimeout(FLAG_HOLD_MS)` then still disabled — so the drawn state is the gate's, not the hold's. No other wall-clock wait. A section below the fold is brought into view by its own `scrollIntoView` and asserted in the viewport (`into`).

**The comparison with the design (state 2, rendered from index.html beside `48-unlimited`, `-typed-empty`, `-typed-wrong-case`, `-typed-matched`) — findings, fixed (before → after):**

| id | seen on | before | after | where |
|---|---|---|---|---|
| F-1 | every banner meta with an address (`48-unlimited`, `48-set-authority`, `48-assign`, `48-warn-token-2022`, `48-unknown-program`, `48-approval-reauth`, …) | the design's meta is ONE flowing 11 px mono line in `--fg-tertiary` (ix:18353 "delegate: … · token: USDC mint … · scope: u64::MAX"); ours broke before and after every address — web's `.addr-groups` is a 12/20 `--fg-primary` `inline-flex` box — so "· token: USDC mint" and "· scope: u64::MAX" each started a line of their own and the addresses read brighter and larger than the line they belong to | the address flows in the meta line, the meta's own size and colour, each group an atomic inline box (#20's recipient rule — a line breaks only between groups); still whole, in groups (Q55) | app.css `.s9-flag-banner .meta .addr-groups` |
| F-2 | `48-unlimited*`, `48-batch-one-blocked` | "Approve unlimited" wrapped onto two lines in its 1.4 share of the bar (icon + 17 px label + 20 px sides > ~210 px); the design draws one line beside the icon (ix:18390) | one line: `white-space: nowrap`, sides `--space-4`; asserted: the label's text boxes on one line AND `scrollWidth ≤ clientWidth` (no clipping) | app.css `.sticky-bar.row .btn.btn-destructive.app-cta-wide` |
| F-3 | `48-warn-token-2022-unreadable` (an ATA create's program row) | "Program 1" wrapped to "Program / 1" beside the long `ATok…8knL · spl_associated_token_account` value (a B1c-2 card, first seen with B1c-3's ATA rows); the design's keys never wrap | the key on one line, the value wraps | app.css `.app-tx-ix > .row > .k` |
| F-4 | `10-dapp-override` | #10 for an unlimited USDC approve led with the headline "0.000005 SOL" — the network fee, the one asset leaving — in the largest type above "Unlimited USDC spend approval": read as the size of the approval. Re-review N1's rule ("never the fee standing in for what is sent") did not cover a lone outflow | no headline when the description has an override row or the allowance reason (`approval`, a bounded approve too); the outflow is a row ("SOL −0.000005"); a plain send keeps its headline (`10-dapp`, positive control) | reauth.ts, spec §3.3, reauthScreen.test.ts |
| F-5 (controller ruling) | every #47 state at 412 × 720 (`47a-initial`, `47a-tensor`, `47b-initial`, `47-lookalike-gates`, …) | the gate line ("0 OF 1 ACKNOWLEDGMENTS", `.s9-gate-status`, "between scroll-area and sticky-bar", ix:18192) has the design's padding `0 … --space-2` — none on top; in the window the body scrolls, so the row cut at the scroll area's clip edge ("ACCOUNT", 603–617 px against the edge at 609) sat flush against the line's text (609): read as drawn over it. Q12's line had the same cause (B1c-1 fix round 2, item 6) | the line keeps a `--space-2` gap below the clip edge (`padding-top`), is never shrunk (`flex: 0 0 auto`), on the bar's `--bg-base`; measured in Chromium on every #47 shot (`gateClear`: gap 8 px) and its computed style in happy-dom | app.css `.app-approve > .s9-gate-status`, visualTab.ts, visual-dapp.spec.ts, connect.test.tsx |

**Deviations from the design kept (each with its reason):**
- The caption "The site sends this transaction itself after you approve." and B1b's re-authentication line sit between the origin card and the banner (B1c-2: L7, and re-authentication "first, under the origin, seen without scrolling"); the design's banner follows the origin card directly.
- The balance card's second row is the simulation's SOL change ("SOL −0.000005 $0.0007", the fee included) where the design draws "Network fee −0.0000050 $0.0008"; the fee itself is the instructions card's row (B1c-2 balance changes = post − pre).
- The instructions card stands between the balance card and the typed field (B1 §3: decoded instructions beside the balance changes; the design's state 2 draws none) — the typed field after it, nearest the CTA (Task 5).
- "Recommended alternative · Approve only the swap amount ~250 USDC" omitted (declared, spec §9: a wallet cannot change a dApp's transaction).
- Banner addresses whole in groups, never `JUP6L…vRet9` (Q55, the September poisoning address); the meta runs to three or four lines.
- The meta's `word-break: break-all` (the design's own rule, ix:3829) splits long unbroken tokens ("authorityType: ac|countOwner", "::CreateIdempot|ent"); and a banner with several meta lines shows the `<p>`'s UA bottom margin between them (the design has one meta per banner and no `p` reset). Both kept: design CSS, generated-only.
- The typed field: no placeholder (the design specifies none), #37's helper "Case-sensitive · must match exactly." under it (R6), and, while typed into, the platform focus ring around the success/danger border (the design draws no focus state; an accessibility indicator is not removed).
- The gated red CTA uses #37's greyed look (the design draws no unmatched state; R6).
- The sticky bar is the markup's row, Reject 1 : CTA 1.4 (ix:18388-18391); the design file's own `.sticky-bar` column rule renders its mockup stacked — the markup is built (B1c-2).
- #49's tile shows "TE", #47/#48's "T" — each screen's own initials as drawn; the colour is one (R9, asserted).
- The lookalike-with-a-block screen keeps the lookalike's demoted bar and Q35's eyebrow (Task 5's ruling); its gated "Approve anyway (not recommended)" is the tertiary button's disabled (outlined) look until the word matches and the hold passes.

- [ ] **Step 1: Write the tests.**

The visual specs, the dApp host, and #10's tests — as committed (Step 3 shows the product change they hold):

Change `extension/e2e/visual-dapp-tx.spec.ts`:

````diff
diff --git a/extension/e2e/visual-dapp-tx.spec.ts b/extension/e2e/visual-dapp-tx.spec.ts
index e38c6d6..0d304bb 100644
--- a/extension/e2e/visual-dapp-tx.spec.ts
+++ b/extension/e2e/visual-dapp-tx.spec.ts
@@ -1,16 +1,21 @@
 import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
 import {base58} from '@scure/base';
 import {contained, launchPopup, seedUnlockedWallet, MAIN, SAVINGS, type Harness} from './popupHarness';
-import {DAPP_HOSTS, approvalWindow, connect, customSignTx, noWindow, openDapp, rawSignTx, sendTx, serveDapp, signTx, type DappServer} from './dappPage';
-import {shot} from './visualTab';
+import {DAPP_HOSTS, adapter, approvalWindow, connect, customSignTx, noWindow, openDapp, rawSignTx, sendTx, serveDapp, signTx, type DappServer, type RawIx} from './dappPage';
+import {ATA_PROGRAM, TOKEN_2022_PROGRAM, mintData} from './fakeCoordinator';
+import {gateClear, shot} from './visualTab';
 
 // Spec B1c §6.4 (B1c-2): every #48 state B1c-2 builds, the origin-mismatch notice, the popup's re-authentication strip
 // (D11), #10 for a site's transaction, and #26/#27's "Dapp · simulated" badge — saved for the opus-tier review against
 // index.html (#48 ix:18261-18705, #26b ix:11813, #27b ix:12163). The approval window at 412 × 720, the popup at
 // 412 × 600, the vault page at 412 × 916. Every state asserts its own copy before its shot; transient states are held
-// by the test (the coordinator's answers held, a dapp.decide held), never slept through. B1c-3's states (red flags,
-// the typed-confirm override, unlimited spend) are not B1c-2's and are not shot.
-declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}}};
+// by the test (the coordinator's answers held, a dapp.decide held), never slept through. B1c-3 (spec §3.3 rev 3.6, the
+// design's state 2 ix:18325-18396): every red-flag state — the unlimited approve's typed field empty, in the wrong case
+// and matched, each other block, a batch with one blocked transaction, every warning's banner, the dependent step, a
+// lookalike with a block, #10 for an override — and the carried B1c-2 items (#11's pending-send strip, Tensor's tile on
+// #47/#48 beside #49's). A flagged screen's CTA is held 1.5 s: a shot with an enabled CTA awaits it; a gated one is
+// shot once that hold has passed, so the drawn state is the gate's, not the hold's.
+declare const chrome: {storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}}};
 
 const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
 const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
@@ -387,6 +392,384 @@ test('visual · #48: simulating, simulated, a batch, re-authentication, approvin
   }
 });
 
+// ——— B1c-3: the red flags (spec §3.3 rev 3.6), the background's, as #48 draws them. The instructions are B1c-30 … B1c-34's
+// (dappTx.spec.ts), signed by MAIN: jup.ag (verified — the design's own state 2 origin) asks through the provider's
+// signTransaction, a batch through StandardWalletAdapter's signAllTransactions.
+const SYSTEM_PROGRAM = '11111111111111111111111111111111';
+const RECENT_BLOCKHASHES = 'SysvarRecentB1ockHashes11111111111111111111';
+const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
+const U64_MAX = 2n ** 64n - 1n;
+/** Fixed, distinct keys (a byte fill, as BLOCKHASH), the same fills as dappTx.spec.ts's B1c-3 keys. */
+const key = (fill: number): string => base58.encode(new Uint8Array(32).fill(fill));
+const OWN_USDC = key(31);
+const DELEGATE = key(32);
+const T22_MINT = key(33);
+const OWN_T22 = key(34);
+const ISSUER = key(35);
+const FREEZER = key(36);
+const PERMANENT_DELEGATE = key(37);
+const HOOK_AUTHORITY = key(38);
+const NEW_ATA = key(39);
+const NONCE = key(41);
+const DAPP_PROGRAM = key(42);
+const OWN_EMPTY = key(43);
+const STRANGER = key(44);
+const HOOK_PROGRAM = key(45);
+const UNREAD_MINT = key(46);
+const OWN_UNREAD = key(47);
+const NEW_OWNER = key(48);
+/** B1 §3: Confirm held 1.5 s on any red-flag screen (useArmed.ts FLAG_HOLD_MS). */
+const FLAG_HOLD_MS = 1_500;
+const signer = (pubkey: string, isWritable = true) => ({pubkey, isSigner: true, isWritable});
+const writable = (pubkey: string) => ({pubkey, isSigner: false, isWritable: true});
+const readonly = (pubkey: string) => ({pubkey, isSigner: false, isWritable: false});
+const ix = {
+  /** SPL Token ApproveChecked (13): source, mint, delegate, owner; amount, decimals. */
+  approveChecked: (source: string, mint: string, delegate: string, amount: bigint, decimals: number): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(source), readonly(mint), readonly(delegate), signer(MAIN.publicKey, false)], data: [13, ...u64le(amount), decimals]}),
+  /** SPL Token TransferChecked (12): source, mint, destination, owner; amount, decimals. */
+  transferChecked: (source: string, mint: string, destination: string, amount: bigint, decimals: number): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(source), readonly(mint), writable(destination), signer(MAIN.publicKey, false)], data: [12, ...u64le(amount), decimals]}),
+  /** SPL Token SetAuthority (6) of a token account: AccountOwner (2) to `to`. */
+  setOwner: (account: string, to: string): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(account), signer(MAIN.publicKey, false)], data: [6, 2, 1, ...base58.decode(to)]}),
+  /** SPL Token CloseAccount (9): account, destination, owner. */
+  closeAccount: (account: string): RawIx => ({programId: TOKEN_PROGRAM, keys: [writable(account), writable(MAIN.publicKey), signer(MAIN.publicKey, false)], data: [9]}),
+  /** System Assign (1) of the wallet account to `owner`. */
+  assign: (owner: string): RawIx => ({programId: SYSTEM_PROGRAM, keys: [signer(MAIN.publicKey)], data: [1, 0, 0, 0, ...base58.decode(owner)]}),
+  /** System Transfer (2) from the wallet account. */
+  transfer: (to: string, lamports: bigint): RawIx => ({programId: SYSTEM_PROGRAM, keys: [signer(MAIN.publicKey), writable(to)], data: [2, 0, 0, 0, ...u64le(lamports)]}),
+  /** System AdvanceNonceAccount (4): nonce account, the recent-blockhashes sysvar, the nonce authority. */
+  advanceNonce: (nonce: string): RawIx => ({programId: SYSTEM_PROGRAM, keys: [writable(nonce), readonly(RECENT_BLOCKHASHES), signer(MAIN.publicKey, false)], data: [4, 0, 0, 0]}),
+  /** ATA Create (no data) / CreateIdempotent (1): payer, account, wallet, mint, System, the token program. */
+  ataCreate: (account: string, wallet: string, mint: string, tokenProgram: string, idempotent: boolean): RawIx => ({
+    programId: ATA_PROGRAM,
+    keys: [signer(MAIN.publicKey), writable(account), readonly(wallet), readonly(mint), readonly(SYSTEM_PROGRAM), readonly(tokenProgram)],
+    data: idempotent ? [1] : [],
+  }),
+};
+/** The flagged screen's 1.5 s hold, passed — a gated CTA shot after it shows the gate, not the hold. */
+async function pastHold(win: Page, cta: Locator): Promise<void> {
+  await win.waitForTimeout(FLAG_HOLD_MS);
+  await expect(cta).toBeDisabled();
+}
+/** A section of the scroll area brought into view under the window's top bar (its own `scrollIntoView`, re-checked). */
+async function into(l: Locator, block: 'start' | 'center' | 'end' = 'center'): Promise<void> {
+  await l.evaluate((e, b) => e.scrollIntoView({block: b}), block);
+  await expect(l).toBeInViewport();
+}
+const OVERRIDE_LINE = 'Re-auth required to override a blocked transaction.';
+/** How many lines an element's text takes, read from its text nodes' own boxes (an icon beside it is not a line). */
+const lines = (l: Locator) =>
+  l.evaluate(e => {
+    const tops = new Set<number>();
+    const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
+    for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
+      const r = document.createRange();
+      r.selectNodeContents(n);
+      for (const box of r.getClientRects()) if (box.width > 0) tops.add(Math.round(box.top));
+    }
+    return tops.size;
+  });
+/** The visual pass's findings, asserted where they were seen: the CTA's label on one line, inside its box. */
+async function oneLine(cta: Locator): Promise<void> {
+  expect(await lines(cta)).toBe(1);
+  expect(await cta.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
+}
+/** An address in a banner's meta flows in the meta's own 11 px line (the design's ix:18353), not as a block of its own. */
+async function metaInline(banner: Locator): Promise<void> {
+  const groups = banner.locator('.meta .addr-groups').first();
+  expect(await groups.evaluate(e => [getComputedStyle(e).display, getComputedStyle(e).fontSize])).toEqual(['inline', '11px']);
+}
+
+test('visual · #48 (B1c-3): an unlimited approve typed empty, wrong case, matched, and #10 for it; Assign and SetAuthority blocked, "Approve anyway"; a batch with one blocked transaction; every warning; the dependent step; a lookalike with a block', async () => {
+  test.setTimeout(420_000);
+  const {h, server} = await scene();
+  try {
+    // The wallet holds 740.21 USDC, an empty USDC account and two Token-2022 accounts; USDC's mint reads as Circle's.
+    h.fake.tokenAccounts.set(MAIN.publicKey, [
+      {pubkey: OWN_USDC, mint: USDC_MINT, amount: '740210000', decimals: 6},
+      {pubkey: OWN_EMPTY, mint: USDC_MINT, amount: '0', decimals: 6},
+      {pubkey: OWN_T22, mint: T22_MINT, amount: '1000000', decimals: 6, program: 'token-2022'},
+      {pubkey: OWN_UNREAD, mint: UNREAD_MINT, amount: '1000000', decimals: 6, program: 'token-2022'},
+    ]);
+    h.fake.mints.set(USDC_MINT, {program: 'token', data: mintData({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER})});
+    // A Token-2022 mint with all three settings B1 §3 names (UNREAD_MINT stays unlisted: the wallet cannot read it, Q36).
+    h.fake.mints.set(T22_MINT, {program: 'token-2022', data: mintData({decimals: 6, mintAuthority: ISSUER, freezeAuthority: FREEZER, extensions: {permanentDelegate: PERMANENT_DELEGATE, transferHook: {authority: HOOK_AUTHORITY, program: HOOK_PROGRAM}}})});
+    const p = await h.openPopup();
+    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
+    const jup = await granted(h, 'https://jup.ag');
+    // StandardWalletAdapter on the same granted page: its connect is answered without a window (the grant exists).
+    expect(await adapter.connect(jup)).toEqual({ok: true, value: MAIN.publicKey});
+
+    // F5 (O1): the design's state 2 — the eyebrow, ONE danger banner, the synthesized row, the field empty and the red
+    // CTA greyed (#37's gated look) and disabled.
+    await fresh(h.sw);
+    let win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.approveChecked(OWN_USDC, USDC_MINT, DELEGATE, U64_MAX, 6)]));
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Unlimited spend approval', {timeout: 10_000});
+    const unlimited = win.locator('.s9-flag-banner.danger');
+    await expect(unlimited).toHaveCount(1);
+    await expect(unlimited.locator('.head')).toHaveText('Unlimited USDC spend approval');
+    await expect(unlimited.locator('.body')).toHaveText(
+      'This transaction includes a spl_token::ApproveChecked instruction with amount = u64::MAX (~18.4 quintillion units). Even verified dApps can be exploited; this lets the program move all your USDC, now and in the future, until you revoke.',
+    );
+    await expect(unlimited.locator('.meta')).toHaveText(`delegate: ${DELEGATE} · token: USDC mint ${USDC_MINT} · scope: u64::MAX`);
+    await expect(win.locator('.s9-flag-banner.warn')).toHaveCount(0);
+    const delegated = win.locator('.s9-bal-row', {hasText: 'USDC delegated'});
+    await expect(delegated).toContainText('unlimited');
+    await expect(delegated).toContainText('≈ all current + future');
+    const approveUnlimited = win.getByRole('button', {name: 'Approve unlimited'});
+    const usdcField = win.getByLabel('Type USDC to enable Approve');
+    await expect(usdcField).toHaveValue('');
+    await expect(usdcField).not.toBeFocused();
+    await expect(approveUnlimited).toHaveClass(/app-cta-gated/);
+    await pastHold(win, approveUnlimited);
+    await oneLine(approveUnlimited);
+    await metaInline(unlimited);
+    await still(win, '48-unlimited', unlimited);
+    const usdcConfirm = win.locator('.s9-typed-confirm');
+    await into(usdcConfirm);
+    await expect(usdcConfirm.locator('.label')).toHaveText('Type USDC to enable Approve');
+    await expect(usdcConfirm.getByText('Case-sensitive · must match exactly.')).toBeVisible();
+    await still(win, '48-unlimited-typed-empty', usdcConfirm);
+    // The wrong case: no match border, still gated once the hold has passed.
+    await usdcField.fill('usdc');
+    await expect(usdcField).not.toHaveClass(/\bmatch\b/);
+    await expect(approveUnlimited).toHaveClass(/app-cta-gated/);
+    await pastHold(win, approveUnlimited);
+    await still(win, '48-unlimited-typed-wrong-case', usdcConfirm);
+    // Matched: the success border, the red CTA with its icon, enabled after the hold (the shot awaits it).
+    await usdcField.fill('USDC');
+    await expect(usdcField).toHaveClass(/\bmatch\b/);
+    await expect(approveUnlimited).not.toHaveClass(/app-cta-gated/);
+    await still(win, '48-unlimited-typed-matched', usdcConfirm, approveUnlimited);
+    await oneLine(approveUnlimited);
+    // #10 for the override (D11): the window asks for it; the popup's strip opens #10, which names it and both reasons.
+    await approveUnlimited.click();
+    await expect(win.getByText("Confirm it's you")).toBeVisible();
+    const toolbar = await h.openPopup();
+    const strip = toolbar.getByRole('button', {name: 'A transaction from jup.ag waits for your confirmation'});
+    const [tab] = await Promise.all([h.ctx.waitForEvent('page', {predicate: pg => /unlock\.html/.test(pg.url())}), strip.click()]);
+    await tab.setViewportSize({width: 412, height: 916});
+    await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
+    await expect(tab.locator('#ra-rows .intent-row', {hasText: 'Unlimited USDC spend approval'})).toHaveCount(1);
+    await expect(tab.locator('#ra-reasons p')).toHaveText(['Re-auth required to approve a token allowance.', OVERRIDE_LINE]);
+    // An approve moves no balance: no headline amount.
+    await expect(tab.locator('#ra-amount-row')).toBeHidden();
+    await shot(tab, '10-dapp-override', {fullPage: false});
+    await tab.close();
+    await toolbar.close();
+    await dismiss(win);
+
+    // F3: an Assign of the wallet account — Q35's eyebrow, the banner with the instruction and the node's post-state.
+    await fresh(h.sw);
+    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.assign(DAPP_PROGRAM)]));
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
+    const assign = win.locator('.s9-flag-banner.danger');
+    await expect(assign.locator('.head')).toHaveText('Assign / Allocate on your wallet account');
+    await expect(assign.locator('.meta')).toHaveText(['#1 system_program::Assign', `post-simulation · owner: ${DAPP_PROGRAM} · space: 0`]);
+    const approveAnyway = win.getByRole('button', {name: 'Approve anyway', exact: true});
+    await expect(approveAnyway).toHaveClass(/app-cta-gated/);
+    await pastHold(win, approveAnyway);
+    await still(win, '48-assign', assign);
+    const assignConfirm = win.locator('.s9-typed-confirm');
+    await into(assignConfirm);
+    await expect(assignConfirm.locator('.label')).toHaveText('Type ASSIGN to enable Approve');
+    await still(win, '48-assign-typed-empty', assignConfirm);
+    // "Approve anyway" (Q34): the word matched, the red CTA without the icon, enabled after the hold.
+    await win.getByLabel('Type ASSIGN to enable Approve').fill('ASSIGN');
+    await expect(approveAnyway).not.toHaveClass(/app-cta-gated/);
+    await expect(approveAnyway.locator('svg')).toHaveCount(0);
+    await still(win, '48-approve-anyway', assignConfirm, approveAnyway);
+    await dismiss(win);
+
+    // F4: SetAuthority (AccountOwner) of the wallet's own USDC account.
+    await fresh(h.sw);
+    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.setOwner(OWN_USDC, NEW_OWNER)]));
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
+    const authority = win.locator('.s9-flag-banner.danger');
+    await expect(authority.locator('.head')).toHaveText('SetAuthority on an account you own');
+    await expect(authority.locator('.body')).toHaveText('This gives an authority over an account you own to another address, or removes it. You cannot take it back yourself.');
+    await expect(authority.locator('.meta')).toHaveText(`#1 spl_token::SetAuthority · authorityType: accountOwner · account: ${OWN_USDC} · newAuthority: ${NEW_OWNER}`);
+    await expect(win.getByLabel('Type AUTHORITY to enable Approve')).toHaveValue('');
+    await pastHold(win, win.getByRole('button', {name: 'Approve anyway', exact: true}));
+    await metaInline(authority);
+    await still(win, '48-set-authority', authority);
+    await dismiss(win);
+
+    // A batch of three, the second an unlimited approve: its banner and its field in its own section only.
+    await fresh(h.sw);
+    win = await windowFor(h, () => adapter.customSignAll(jup, BLOCKHASH, [[ix.transfer(RECIPIENT, 5n)], [ix.approveChecked(OWN_USDC, USDC_MINT, DELEGATE, U64_MAX, 6)], [ix.transfer(RECIPIENT, 6n)]]));
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Unlimited spend approval', {timeout: 10_000});
+    const sections = win.locator('section.app-tx-item');
+    await expect(sections).toHaveCount(3);
+    await expect(sections.nth(0).locator('.s9-flag-banner, .s9-typed-confirm')).toHaveCount(0);
+    await expect(sections.nth(2).locator('.s9-flag-banner, .s9-typed-confirm')).toHaveCount(0);
+    await expect(sections.nth(1).locator('.s9-flag-banner.danger .head')).toHaveText('Unlimited USDC spend approval');
+    await expect(sections.nth(1).locator('.s9-typed-confirm')).toHaveCount(1);
+    await pastHold(win, win.getByRole('button', {name: 'Approve unlimited'}));
+    await still(win, '48-batch-one-blocked', win.getByText('Transaction 1 of 3'));
+    await into(sections.nth(1).locator('.app-tx-batch'), 'start');
+    await still(win, '48-batch-one-blocked-section', sections.nth(1).locator('.s9-flag-banner.danger'));
+    await dismiss(win);
+
+    // F2: a lone closeAccount — a warning only, no field; Approve after the 1.5 s hold.
+    await fresh(h.sw);
+    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.closeAccount(OWN_EMPTY)]));
+    const nonTransfer = win.locator('.s9-flag-banner.warn');
+    await expect(nonTransfer.locator('.head')).toHaveText('Instructions that are not transfers', {timeout: 10_000});
+    await expect(nonTransfer.locator('.body')).toHaveText('Each can do more than move a balance. Check what it does before approving.');
+    await expect(nonTransfer.locator('.meta')).toHaveText('#1 spl_token::CloseAccount');
+    await expect(win.locator('.top-bar .title')).toHaveText('Approve transaction');
+    await expect(win.locator('.s9-typed-confirm')).toHaveCount(0);
+    await still(win, '48-warn-non-transfer', nonTransfer, win.getByRole('button', {name: 'Approve', exact: true}));
+    await dismiss(win);
+
+    // F7 (O3): two Token-2022 accounts' mints — one with a freeze authority, a permanent delegate and a transfer hook,
+    // one the wallet cannot read (Q36); F2 names the two creates.
+    await fresh(h.sw);
+    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.ataCreate(OWN_T22, MAIN.publicKey, T22_MINT, TOKEN_2022_PROGRAM, true), ix.ataCreate(OWN_UNREAD, MAIN.publicKey, UNREAD_MINT, TOKEN_2022_PROGRAM, true)]));
+    const t22 = win.locator('.s9-flag-banner.warn', {hasText: 'Token-2022 settings on a token you hold'});
+    await expect(t22.locator('.body')).toHaveText(
+      ['Freeze authority — the issuer can freeze your account of this token.', 'Permanent delegate — an address that can move or burn this token from any account, yours included.', 'Transfer hook — a program that runs on every transfer of this token.'],
+      {timeout: 10_000},
+    );
+    await expect(t22.locator('.meta')).toHaveText([`mint: ${T22_MINT}`, `freezeAuthority: ${FREEZER}`, `permanentDelegate: ${PERMANENT_DELEGATE}`, `transferHookProgram: ${HOOK_PROGRAM}`]);
+    const unreadable = win.locator('.s9-flag-banner.warn', {hasText: "Could not read this token's settings"});
+    await expect(unreadable.locator('.meta')).toHaveText(`mint: ${UNREAD_MINT}`);
+    await expect(win.locator('.s9-flag-banner.danger, .s9-typed-confirm')).toHaveCount(0);
+    await metaInline(t22);
+    // "Program 1" on one line beside the associated-token program's long value (its value wraps instead).
+    expect(await lines(win.locator('.app-tx-ix > .row > .k').first())).toBe(1);
+    await still(win, '48-warn-token-2022', t22, win.getByRole('button', {name: 'Approve', exact: true}));
+    await into(unreadable);
+    await still(win, '48-warn-token-2022-unreadable', unreadable, win.getByRole('button', {name: 'Approve', exact: true}));
+    await dismiss(win);
+
+    // F8: a durable nonce — B1 §3's line alone.
+    await fresh(h.sw);
+    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.advanceNonce(NONCE), ix.transfer(RECIPIENT, 5n)]));
+    const nonce = win.locator('.s9-flag-banner.warn');
+    await expect(nonce.locator('.head')).toHaveText('This transaction does not expire.', {timeout: 10_000});
+    await expect(nonce.locator('.meta')).toHaveText('#1 system_program::AdvanceNonceAccount');
+    await still(win, '48-warn-nonce', nonce, win.getByRole('button', {name: 'Approve', exact: true}));
+    await dismiss(win);
+
+    // F9: 9.95 of the 10 SOL to an address never sent to — the warning and B1b's re-authentication line.
+    await fresh(h.sw);
+    win = await windowFor(h, () => customSignTx(jup, BLOCKHASH, MAIN.publicKey, [ix.transfer(STRANGER, 9_950_000_000n)]));
+    const whole = win.locator('.s9-flag-banner.warn');
+    await expect(whole.locator('.head')).toHaveText('Whole balance to a first-time address', {timeout: 10_000});
+    await expect(whole.locator('.body')).toHaveText('All or nearly all of a balance goes to an address you have not sent to before.');
+    await expect(win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.")).toBeVisible();
+    await still(win, '48-warn-whole-balance', whole, win.getByRole('button', {name: 'Approve', exact: true}));
+    await dismiss(win);
+
+    // F10 (O2): create the recipient's USDC account, then transfer into it — step 2 depends on step 1.
+    await fresh(h.sw);
+    win = await windowFor(h, () => adapter.customSignAll(jup, BLOCKHASH, [[ix.ataCreate(NEW_ATA, RECIPIENT, USDC_MINT, TOKEN_PROGRAM, false)], [ix.transferChecked(OWN_USDC, USDC_MINT, NEW_ATA, 500_000n, 6)]]));
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
+    const step2 = win.locator('section.app-tx-item').nth(1);
+    const dependent = step2.locator('.s9-flag-banner.danger');
+    await expect(dependent.locator('.head')).toHaveText('This step depends on step 1 and could not be checked on its own.');
+    await expect(dependent.locator('.body')).toHaveText('Its effects are unknown: it was simulated without the changes step 1 makes, which it needs.');
+    await expect(dependent.locator('.meta')).toHaveText('{"InstructionError":[0,"UninitializedAccount"]}');
+    await expect(step2.getByText('Balance changes (unknown)')).toBeVisible();
+    await expect(step2.getByText('This step was not simulated on its own, so its effects are unknown.')).toBeVisible();
+    await expect(win.getByText("Couldn't simulate")).toHaveCount(0);
+    await expect(step2.getByLabel('Type UNCHECKED to enable Approve')).toHaveValue('');
+    await pastHold(win, win.getByRole('button', {name: 'Approve anyway', exact: true}));
+    await into(step2.locator('.app-tx-batch'), 'start');
+    await still(win, '48-dependent', dependent);
+    await into(step2.locator('.s9-typed-confirm'));
+    await still(win, '48-dependent-typed-empty', step2.locator('.s9-typed-confirm'));
+    await dismiss(win);
+
+    // A lookalike (tensr.trade, granted through "Connect anyway") with a block: the word first, then the demoted
+    // "Approve anyway (not recommended)" opens the 2-second confirm.
+    const tensr = await granted(h, 'https://tensr.trade');
+    await fresh(h.sw);
+    win = await windowFor(h, () => customSignTx(tensr, BLOCKHASH, MAIN.publicKey, [ix.assign(DAPP_PROGRAM)]));
+    await expect(win.locator('.top-bar .title')).toHaveText('Critical · Blocked transaction', {timeout: 10_000});
+    await expect(win.getByText('It looks like tensor.trade but is a different site.')).toBeVisible();
+    await expect(win.locator('.s9-flag-banner.danger .head')).toHaveText('Assign / Allocate on your wallet account');
+    const anywayLookalike = win.getByRole('button', {name: 'Approve anyway (not recommended)'});
+    await pastHold(win, anywayLookalike);
+    await still(win, '48-lookalike-block', win.getByText('It looks like tensor.trade but is a different site.'));
+    const lookalikeConfirm = win.locator('.s9-typed-confirm');
+    await win.getByLabel('Type ASSIGN to enable Approve').fill('ASSIGN');
+    await into(lookalikeConfirm);
+    await still(win, '48-lookalike-block-typed', lookalikeConfirm, anywayLookalike);
+    await anywayLookalike.click();
+    await still(win, '48-lookalike-block-confirm', win.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}), win.getByRole('button', {name: 'I understand the risk'}));
+    await win.getByRole('button', {name: 'Cancel'}).click();
+    await dismiss(win);
+    contained(h);
+    expect(server.unexpected).toEqual([]);
+  } finally {
+    await h.close();
+  }
+});
+
+// ——— B1c-3: the carried B1c-2 visual items — #11's pending-send strip (B1b's) on the dApp strip's gutter with its
+// chevron, and Tensor's tile, one colour on #47, #48 and #49 (R9: #49's, the design's latest). #46's Q26 banner is shot
+// in visual-dapp.spec.ts (46-sign-null), #10's unsigned headline above (10-dapp).
+test('visual · carried (B1c-3): #11’s pending-send strip inside the popup; Tensor’s tile on #47, #48 and #49', async () => {
+  test.setTimeout(240_000);
+  const {h, server} = await scene();
+  try {
+    // An open send of 0.01 SOL from MAIN (B1b's record, as visual-settings.spec.ts writes it).
+    await set(h.sw, {
+      v1_pending: [{id: 'ef'.repeat(16), account: MAIN.publicKey, signature: '5'.repeat(88), wire: 'AQ==', lastValidBlockHeight: 1150, createdAt: Date.now(), lastSentAt: Date.now(), state: 'pending', detail: null, detailCode: null, intent: {token: 'SOL', recipient: RECIPIENT, amount: '10000000'}, expiryNullSeenAt: null, failure: null, fee: null}],
+    });
+    const p = await h.openPopup();
+    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
+    const pending = p.getByRole('button', {name: 'Sending 0.01 SOL · pending'});
+    await expect(pending.locator('.app-strip-chev')).toBeInViewport({ratio: 1});
+    await expect(pending).toBeInViewport({ratio: 1});
+    // On the dApp strip's gutter (the hero's own --space-5): the strip's sides inside the popup's 412 px by 20 px each.
+    const box = await pending.boundingBox();
+    expect(box === null ? null : [Math.round(box.x), Math.round(412 - box.x - box.width)]).toEqual([20, 20]);
+    await pop(p, '11-pending-strip', pending);
+    await p.close();
+    await h.sw.evaluate(() => chrome.storage.local.remove('v1_pending'));
+
+    const tile = (page: Page, sel: string) => page.locator(sel).first().evaluate(e => getComputedStyle(e).backgroundImage);
+    // #47a for the verified tensor.trade (no grant yet): the origin card's tile.
+    const tensor = await openDapp(h.ctx, 'https://tensor.trade');
+    await fresh(h.sw);
+    let connected!: Promise<unknown>;
+    let win = await windowFor(h, () => (connected = connect(tensor)));
+    await expect(win.locator('.s9-origin-card .name')).toHaveText('Tensor');
+    const on47 = await tile(win, '.s9-origin-card .ico');
+    await gateClear(win);
+    await still(win, '47a-tensor', win.getByText('0 of 1 acknowledgments'), win.getByRole('button', {name: 'Reject'}));
+    await win.getByRole('checkbox').click();
+    await win.getByRole('button', {name: 'Connect', exact: true}).click();
+    expect(await connected).toEqual({ok: true, value: [MAIN.publicKey]});
+    // #48 for its transaction.
+    await fresh(h.sw);
+    win = await windowFor(h, () => signTx(tensor, 1, BLOCKHASH));
+    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
+    await expect(win.locator('.s9-origin-card .name')).toHaveText('Tensor');
+    const on48 = await tile(win, '.s9-origin-card .ico');
+    await still(win, '48-tensor', win.locator('.s9-origin-card'), win.getByRole('button', {name: 'Approve', exact: true}));
+    await dismiss(win);
+    // #49's row for the same grant.
+    const s = await h.openPopup();
+    await expect(s.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
+    await s.getByRole('button', {name: 'Settings'}).click();
+    await s.locator('.s7-row', {hasText: 'Connected dApps'}).click();
+    const row = s.locator('.s10-app-row', {hasText: 'tensor.trade'});
+    await expect(row).toBeVisible({timeout: 10_000});
+    const on49 = await row.locator('.ico').evaluate(e => getComputedStyle(e).backgroundImage);
+    await pop(s, '49-tensor', row);
+    expect(on49).toMatch(/^linear-gradient/);
+    expect([on47, on48]).toEqual([on49, on49]);
+    contained(h);
+    expect(server.unexpected).toEqual([]);
+  } finally {
+    await h.close();
+  }
+});
+
 test('visual · #26 and #27: a site’s transaction badged "Dapp · simulated"', async () => {
   test.setTimeout(240_000);
   const {h, server} = await scene();
````

Change `extension/e2e/visual-dapp.spec.ts`:

````diff
diff --git a/extension/e2e/visual-dapp.spec.ts b/extension/e2e/visual-dapp.spec.ts
index 780f9f4..eee0774 100644
--- a/extension/e2e/visual-dapp.spec.ts
+++ b/extension/e2e/visual-dapp.spec.ts
@@ -1,7 +1,7 @@
 import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
 import {contained, launchPopup, seedUnlockedWallet, MAIN, SAVINGS, type Harness} from './popupHarness';
 import {DAPP_HOSTS, approvalWindow, connect, openDapp, serveDapp, sign, windowClosed, type DappServer} from './dappPage';
-import {shot} from './visualTab';
+import {gateClear, shot} from './visualTab';
 
 // Spec B1c §6.4: every B1c-1 state the real extension can be put in, saved for the opus-tier review against index.html
 // (#46 ix:17442-17686, #47 ix:17686-18261, #49 ix:18705-19100, #31 ix:13552) — not a pixel diff. The approval window at
@@ -38,9 +38,13 @@ const grant = (origin: string, o: {scope?: string; lastUsedAt?: number; connecte
 /** A computed style of the element (the `css()` helper pattern, visual-settings.spec.ts:50) — real Chromium, not happy-dom. */
 const css = (l: Locator, prop: string) => l.evaluate((e, x) => getComputedStyle(e).getPropertyValue(x), prop);
 
-/** A window state: its own copy first, then the shot (the pointer off the column; `ready`, a held CTA, awaited enabled). */
+/**
+ * A window state: its own copy first, then the shot (the pointer off the column; `ready`, a held CTA, awaited enabled).
+ * B1c-3: a #47 state (one with the gate line) also proves the line clear of the scroll area (`gateClear`).
+ */
 async function still(win: Page, name: string, visible: Locator, ready?: Locator): Promise<void> {
   await expect(visible).toBeVisible();
+  if ((await win.locator('.app-approve > .s9-gate-status').count()) > 0) await gateClear(win);
   await win.mouse.move(0, 0);
   await shot(win, name, {fullPage: false, ...(ready === undefined ? {} : {ready})});
 }
@@ -256,8 +260,9 @@ test('visual · #46: verified (SIWS), unknown, keyword alert, lookalike and its
     await h.sw.evaluate(a => chrome.storage.session.set({v1_session: {accounts: [a]}}), {index: SAVINGS.index, publicKey: SAVINGS.publicKey, secretKey: SAVINGS.secretKey});
     await win.evaluate(() => void window.dispatchEvent(new Event('focus')));
     await expect(win.getByRole('button', {name: 'Sign', exact: true})).toHaveCount(0);
-    // Rev 3.2 (Q26, owner-delegated 2026-10-12): the line under the title says why; asserted before the shot.
-    await expect(win.getByText('This request can no longer be signed. Reject it and ask the site to try again.')).toBeVisible();
+    // Rev 3.2 (Q26, owner-delegated 2026-10-12): the line under the title says why; asserted before the shot. B1c-3: drawn
+    // as #48 draws it — a danger flag banner, its head.
+    await expect(win.locator('.s9-flag-banner.danger .head')).toHaveText('This request can no longer be signed. Reject it and ask the site to try again.');
     await still(win, '46-sign-null', win.getByRole('button', {name: 'Reject'}));
     await dismiss(win);
     await seedUnlockedWallet(h.sw);
````

Change `extension/e2e/visualTab.ts`:

````diff
diff --git a/extension/e2e/visualTab.ts b/extension/e2e/visualTab.ts
index 7c4bdb2..7c0a2f1 100644
--- a/extension/e2e/visualTab.ts
+++ b/extension/e2e/visualTab.ts
@@ -69,3 +69,31 @@ export const releaseKdf = async (p: Page) => {
     k.queue.splice(0).forEach(f => f());
   });
 };
+
+/**
+ * B1c-3 visual pass (controller ruling): #47's gate line never touches what the scroll area paints above it — the
+ * lowest text box inside `.app-approve-scroll`, clipped to its edge, and the gate line's own text box do not
+ * intersect, with at least the --space-2 gap between them (the row cut at the clip edge sat flush against it, 47a).
+ */
+export async function gateClear(win: Page): Promise<void> {
+  const r = await win.evaluate(() => {
+    const scroll = document.querySelector('.app-approve-scroll');
+    const gate = document.querySelector('.s9-gate-status');
+    if (scroll === null || gate === null) return null;
+    const edge = scroll.getBoundingClientRect().bottom;
+    let painted = -Infinity;
+    const walk = document.createTreeWalker(scroll, NodeFilter.SHOW_TEXT);
+    for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
+      const range = document.createRange();
+      range.selectNodeContents(n);
+      for (const b of range.getClientRects()) if (b.width > 0 && b.top < edge) painted = Math.max(painted, Math.min(b.bottom, edge));
+    }
+    const text = document.createRange();
+    text.selectNodeContents(gate);
+    return {painted, gateText: text.getBoundingClientRect().top, paddingBottom: getComputedStyle(gate).paddingBottom};
+  });
+  expect(r, 'a gate line on the screen').not.toBeNull();
+  if (r === null) return;
+  expect(r.gateText - r.painted, `the gate line's text ${r.gateText} below the scroll area's last painted text ${r.painted}`).toBeGreaterThanOrEqual(7.5);
+  expect(r.paddingBottom).toBe('8px');
+}
````

Change `extension/e2e/dappPage.ts`:

````diff
diff --git a/extension/e2e/dappPage.ts b/extension/e2e/dappPage.ts
index cd1ba29..eaa9a54 100644
--- a/extension/e2e/dappPage.ts
+++ b/extension/e2e/dappPage.ts
@@ -10,7 +10,8 @@ import {fileURLToPath} from 'node:url';
  * serve (asserted empty).
  */
 // Final review I2: `my_site.test` — a host URL-legal to the browser (an underscore) outside the old SITE shape (B1c-29).
-export const DAPP_HOSTS = ['dapp.test', 'jup.ag', 'tensr.trade', 'xn--phntom-4nf.app', 'xn--bcher-kva.example', 'my_site.test', 'api.mainnet-beta.solana.com'] as const;
+// B1c-3 (the visual pass): `tensor.trade` — the verified Tensor, whose tile #47 and #48 draw in #49's colours (R9).
+export const DAPP_HOSTS = ['dapp.test', 'jup.ag', 'tensr.trade', 'tensor.trade', 'xn--phntom-4nf.app', 'xn--bcher-kva.example', 'my_site.test', 'api.mainnet-beta.solana.com'] as const;
 /**
  * B1c-2: the test dApp's own RPC endpoint (its @solana/web3.js Connection — a wallet-adapter dApp's). The adapter never
  * calls it while the wallet sends through signAndSendTransaction; a call would mean it fell back to sending itself.
````

Change `extension/src/unlock/__tests__/reauthScreen.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/reauthScreen.test.ts b/extension/src/unlock/__tests__/reauthScreen.test.ts
index bea373d..eaa7bf6 100644
--- a/extension/src/unlock/__tests__/reauthScreen.test.ts
+++ b/extension/src/unlock/__tests__/reauthScreen.test.ts
@@ -686,6 +686,7 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual([
       'Sitejup.ag',
       'Transactions2',
+      'SOL\u22120.001005',
       'Depends on step 1 — not checked on its ownTransaction 2 of 2',
       'Unlimited USDC spend approvalTransaction 2 of 2',
     ]);
@@ -693,9 +694,28 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     expect(unstyled('v-reauth')).toEqual([]);
     loadPage();
     await shown({...DAPP, reasons: ['override'], flags: [{tx: 0, row: 'F4', word: 'AUTHORITY', step: null}]});
-    // A single transaction: the row names what, the headline is still the one asset leaving.
-    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'SetAuthority on an account you own']);
-    expect([visible(el('ra-amount-row')), text(el('ra-amount'))]).toEqual([true, '0.001005']);
+    // A single transaction: the row names what is overridden; no headline (B1c-3 visual pass: the one asset leaving is
+    // not what is approved) — it is a row, with its minus.
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'SOL\u22120.001005', 'SetAuthority on an account you own']);
+    expect(visible(el('ra-amount-row'))).toBe(false);
+  });
+
+  // B1c-3 visual pass (10-dapp-override): an unlimited approve paid by the account itself — its one outflow is the
+  // network fee. The headline would have read "0.000005 SOL" above "Unlimited USDC spend approval". Neither an override
+  // nor an allowance (a bounded approve's `approval`) gets a headline; the plain send beside them still does.
+  it('a dApp’s override or allowance: no headline amount, the outflow a row; the same outflow alone keeps it', async () => {
+    const fee = {mint: null, symbol: 'SOL' as const, amount: '5000', decimals: 9};
+    await shown({...DAPP, outgoing: [fee], reasons: ['approval', 'override'], flags: [{tx: 0, row: 'F5', word: 'USDC', step: null}]});
+    expect(visible(el('ra-amount-row'))).toBe(false);
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'SOL\u22120.000005', 'Unlimited USDC spend approval']);
+    loadPage();
+    await shown({...DAPP, outgoing: [fee], reasons: ['approval']});
+    expect(visible(el('ra-amount-row'))).toBe(false);
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'SOL\u22120.000005']);
+    loadPage();
+    await shown({...DAPP, outgoing: [fee], reasons: ['first-send']});
+    expect([visible(el('ra-amount-row')), text(el('ra-amount')), text(el('ra-symbol'))]).toEqual([true, '0.000005', 'SOL']);
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag']);
   });
 
   it('a dApp’s transaction: expired and locked say what is true for a site’s request; Cancel only closes the tab', async () => {
````

Change `extension/src/approve/__tests__/connect.test.tsx`:

````diff
diff --git a/extension/src/approve/__tests__/connect.test.tsx b/extension/src/approve/__tests__/connect.test.tsx
index 2e49f15..daacd3e 100644
--- a/extension/src/approve/__tests__/connect.test.tsx
+++ b/extension/src/approve/__tests__/connect.test.tsx
@@ -1,5 +1,7 @@
 // @vitest-environment happy-dom
 import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
+import {readFileSync} from 'node:fs';
+import {join} from 'node:path';
 import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
 import {GRANTS_KEY, MAX_GRANTS, type Grant} from '../../background/dapp/grants';
 import {BLOCKED_KEY} from '../../background/dapp/blocked';
@@ -542,3 +544,28 @@ describe('fix round 1, I2: the unacked domain-ack box carries no `.is-acked` (it
     expect(domainAck.className).toBe('ack');
   });
 });
+
+// B1c-3 visual pass (controller ruling): #47's gate line sat flush against the card the scroll area cuts at its edge
+// ("ACCOUNT" at 412 × 720, 47a). happy-dom lays nothing out, so this proves the rule that keeps them apart — on the
+// rendered window, with both sheets loaded — and visual-dapp.spec.ts measures the gap in Chromium.
+describe('B1c-3: #47’s gate line keeps a gap below the scroll area’s clip edge', () => {
+  it('the rendered gate line: a --space-2 top padding, never shrunk, on the bar’s background', async () => {
+    const style = document.createElement('style');
+    const sheet = (p: string) => readFileSync(join(__dirname, ...p.split('/')), 'utf8');
+    style.textContent = `:root { --space-2: 8px; --bg-base: rgb(1, 2, 3); }\n${sheet('../../styles/design-ext.css')}\n${sheet('../../app/app.css')}`;
+    document.head.append(style);
+    try {
+      const w = await openWindow();
+      await w.connect('https://jup.ag');
+      w.show();
+      await screen.findByText('Connect to Jupiter?');
+      const gate = document.querySelector('.s9-gate-status') as HTMLElement;
+      expect(gate.parentElement?.classList.contains('app-approve')).toBe(true);
+      expect(gate.previousElementSibling?.classList.contains('app-approve-scroll')).toBe(true);
+      const cs = getComputedStyle(gate);
+      expect([cs.paddingTop, cs.flexShrink, cs.backgroundColor]).toEqual(['8px', '0', 'rgb(1, 2, 3)']);
+    } finally {
+      style.remove();
+    }
+  });
+});
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

The visual pass is a review: its first run was on Task 7's tree (`fd3ebd6`) with these specs minus the four findings' assertions, and the shots themselves showed F-1 … F-4 (described above). With the assertions in, on Task 7's product: `npx vitest run src/unlock/__tests__/reauthScreen.test.ts` → **2 failed | 52 passed (54)** ("a dApp’s override: Q33’s line …" — `Received` has no `SOL−0.001005` row; "a dApp’s override or allowance: no headline amount …" — the headline visible); `npx playwright test e2e/visual-dapp-tx.spec.ts -g 'B1c-3'` → 1 failed at the first finding asserted (`oneLine(approveUnlimited)`: `Expected: 1, Received: 2` — the label on two lines). `npx vitest run src/approve/__tests__/connect.test.tsx` → **1 failed | 26 passed (27)** (`expected [ '0px', '', '' ]` — F-5's rule absent). Each finding's own red run, alone, is its named mutation (Step 5: M8a–M8f, M8j); the carried items' assertions are proven on Task 6's product changes by M8g–M8i.

- [ ] **Step 3: Implement.**

Change `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index b688e97..7cd238e 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1662,6 +1662,18 @@ body:has(.app-window) {
   background: var(--bg-base);
   padding-top: var(--space-1);
 }
+/*
+ * B1c-3 visual pass (controller ruling): #47's gate line (`.s9-gate-status`, "between scroll-area and sticky-bar",
+ * ix:18192) is in normal flow right after `.app-approve-scroll`, as Q12's line is — and like it read as drawn over the
+ * card it follows: the design's own padding is `0 … --space-2` (no top), so at 412 × 720, where the body scrolls, the
+ * row cut at the scroll area's clip edge ("ACCOUNT", 47a) sat flush against the line's text. Q12's guard: a gap
+ * (`padding-top`) between that edge and the text, never shrunk (`flex: 0 0 auto`), on the bar's own background.
+ */
+.app-approve > .s9-gate-status {
+  flex: 0 0 auto;
+  padding-top: var(--space-2);
+  background: var(--bg-base);
+}
 .app-approve-block {
   display: flex;
   justify-content: center;
@@ -1986,6 +1998,10 @@ body:has(.app-window) {
   font-size: 11px;
   line-height: 14px;
 }
+/* B1c-3 visual pass: "Program 1" on one line beside a long program value (the design's keys never wrap); the value wraps. */
+.app-tx-ix > .row > .k {
+  white-space: nowrap;
+}
 /* An address in full, in groups of four (B1 §3), its label under it; an unknown program's whole address likewise. */
 .s9-payload-card .row .v.app-tx-addr,
 .s9-payload-card .row .v.app-tx-unknown {
@@ -2026,6 +2042,27 @@ body:has(.app-window) {
 .app-typed-help {
   margin: 0;
 }
+/*
+ * B1c-3 visual pass: the design's meta is one flowing line in its own 11 px mono and --fg-tertiary (ix:18353) — an
+ * address in it (whole, in groups: Q55) flows in that line, not as web's 12/20 primary inline-flex block that broke
+ * the line before and after it. Each group an atomic inline box (#20's recipient rule), so a line breaks only
+ * between groups under the meta's `word-break: break-all`.
+ */
+.s9-flag-banner .meta .addr-groups {
+  display: inline;
+  font-size: inherit;
+  line-height: inherit;
+  color: inherit;
+}
+.s9-flag-banner .meta .addr-groups > span {
+  display: inline-block;
+  margin-inline-end: 0.6ch;
+}
+/* B1c-3 visual pass: the red CTA's label on one line, as drawn (ix:18390 "Approve unlimited" beside its icon). */
+.sticky-bar.row .btn.btn-destructive.app-cta-wide {
+  white-space: nowrap;
+  padding-inline: var(--space-4);
+}
 /* #48 mismatch detail (ix:18504-18507): the session in --success, the request and the verdict in --danger — the card's
    own `.row .v` colour (three classes) outranks the one-class tone. */
 .s9-payload-card .row .v.noc-success {
````

Change `extension/src/unlock/screens/reauth.ts`:

````diff
diff --git a/extension/src/unlock/screens/reauth.ts b/extension/src/unlock/screens/reauth.ts
index ec38ff4..593d287 100644
--- a/extension/src/unlock/screens/reauth.ts
+++ b/extension/src/unlock/screens/reauth.ts
@@ -164,8 +164,11 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
       // there would put the fee, not what is sent, in the largest type — so several outflows (or any cut by `omitted`)
       // get no headline and every outflow is a row. An unnamed token gets none either: its amount means nothing without
       // the mint, which only its row shows whole. B1c-3: the headline is unsigned, as the design's send headline
-      // (ix:6062); every row keeps the minus — what leaves the account.
-      const only = d.outgoing.length === 1 && d.omitted === 0 ? d.outgoing[0] : undefined;
+      // (ix:6062); every row keeps the minus — what leaves the account. B1c-3 visual pass: nor when the request sets an
+      // allowance or overrides a block — what is approved then is not an amount leaving, and the one outflow (most often
+      // only the network fee) in the largest type would read as the size of an unlimited approve; it is a row instead.
+      const plain = d.overrides.length === 0 && !d.reasons.includes(REAUTH.approval);
+      const only = plain && d.outgoing.length === 1 && d.omitted === 0 ? d.outgoing[0] : undefined;
       const head = only !== undefined && (only.mint === null || only.label !== REAUTH.token) ? only : null;
       if (head !== null) {
         setText(byId('ra-amount'), head.amount);
````

Change `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md`:

````diff
diff --git a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
index 2b3ac66..a2e9fb2 100644
--- a/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
+++ b/docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md
@@ -641,7 +641,9 @@ proxy (`getMultipleAccounts`). The window only renders the flags stored with the
   recomputes every expected word from its stored simulation and refuses the approval unless every block has its exact
   word, and refuses it when any block has none. A request with any block always re-authenticates through #10 (the
   reason line: "Re-auth required to override a blocked transaction.", Q33); #10's description names what is
-  overridden — one row per block, Q37–Q40, with "Transaction <n> of <m>" in a batch — and a refresh that adds a
+  overridden — one row per block, Q37–Q40, with "Transaction <n> of <m>" in a batch; with an override (or an allowance,
+  the `approval` reason) #10 draws no headline amount, what leaves the account is a row (the visual pass: the network
+  fee alone stood in the largest type above "Unlimited USDC spend approval") — and a refresh that adds a
   flag (a block or a warning) or changes a block's word or step asks for a new re-authentication. The re-authentication stays bound to
   the exact bytes (B1c-2); the words are not secrets and are bound only by the background recomputing them. No setting
   disables a block.
````

- [ ] **Step 4: Run — green, the whole suite, the build, the gates, verify, and the whole Playwright suite twice.**

`npx tsc --noEmit; echo $?` → `0`. `npx vitest run` → **Test Files 170 passed (170), Tests 3417 passed (3417)** (Task 7's 3415 + the new #10 test + the #47 gate-line test). `node scripts/build.mjs` → exit 0. `npm run gates` → exit 0 (`classes ok: every class in 56 src/app and src/approve files …`). `npm run verify` (extension) → exit 0 (3417 passed, CSP ok, secrets, gates, reproducible: chrome 26 files / firefox 26 files). The repository root: `npx tsc --noEmit` → 0, `npx jest` → **Test Suites 180 passed, 1 skipped; Tests 1234 passed, 1 skipped**. `web`: `npm run verify` → exit 0 (**43 files / 550 tests**, then 1 / 3). (Nothing under core/, root src/ or web/ is touched; run because the brief asks for the whole tree at the end of the plan.)

The new tests alone: `npx playwright test e2e/visual-dapp-tx.spec.ts` → **4 passed** (B1c-2's #48 test 54 s, the B1c-3 test ~51 s, the carried test ~7 s, #26/#27 5 s).

The whole Playwright suite, sequentially, visual specs last, `test-results` removed before each part:

```bash
rm -rf test-results && npx playwright test $(ls e2e/*.spec.ts | grep -v visual)
rm -rf test-results && npx playwright test $(ls e2e/visual*.spec.ts)
rm -rf test-results && unshare -rn npx playwright test $(ls e2e/*.spec.ts | grep -v visual)
rm -rf test-results && unshare -rn npx playwright test $(ls e2e/visual*.spec.ts)
```

Observed: normally **51 passed** (12.1 min) + **22 passed** (7.9 min); under `unshare -rn` **51 passed** (11.9 min) + **22 passed** (7.9 min). After F-5 (the controller's ruling; no non-visual file changed) the visual specs again: normally **22 passed** (7.8 min), under `unshare -rn` **22 passed** (7.9 min); `npm run verify` exit 0 (3417). Every test ends with `contained(h)` and the test dApp's `server.unexpected` empty (`tensor.trade` is routed and unresolvable like every test host).

Every shot was opened and compared (the B1c-3 ones beside the design's state 2 rendered from index.html; the carried ones beside #11 ix:6374, #49 ix:3885 and B1c-2's own shots): the findings F-1 … F-5 above are fixed; the kept deviations are listed above. Re-reviewed B1c-2 shots that B1c-3 changes: `48-unknown-program` (F1's banner — its address now inline, F-1), `48-approval-reauth` (F6's banner, "NOC delegated · 0.5"), `10-dapp` (the unsigned headline "0.000005001 SOL" — the positive control of F-4), `46-sign-null` (Q26 as a danger banner under #46's title — Task 6's ruling kept), and all eighteen #47 shots after F-5 (the gate line 8 px clear of the cut row on each).

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy (node_modules linked), `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | the test that turns red | observed |
|---|---|---|---|
| M8a | app.css: the `.s9-flag-banner .meta .addr-groups` rule dropped (F-1) | visual B1c-3: `metaInline(unlimited)` | tsc 0; 1 failed (`toEqual(['inline', '11px'])`, l. 479) |
| M8b | app.css: the red CTA's nowrap rule dropped (F-2) | visual B1c-3: `oneLine(approveUnlimited)` | tsc 0; 1 failed (`Expected: 1, Received: 2`, l. 473) |
| M8c | app.css: `.app-tx-ix > .row > .k` dropped (F-3) | visual B1c-3: "Program 1" on one line | tsc 0; 1 failed (`Expected: 1, Received: 2`, l. 640) |
| M8d | reauth.ts: `const plain = d.overrides.length >= 0` (F-4 dropped whole) | reauthScreen: both override tests; visual B1c-3: `#ra-amount-row` hidden | tsc 0; vitest 2 failed / 52 passed; playwright 1 failed (`Received: visible`, l. 555) |
| M8e | reauth.ts: the allowance condition dropped (`plain` = no override only) | reauthScreen: "a dApp’s override or allowance …" (the `approval`-only case) | tsc 0; 1 failed / 53 passed |
| M8f | reauth.ts: the override condition dropped (`plain` = no allowance only) | reauthScreen: "a dApp’s override: Q33’s line …" (the `override`-only F4 case) | tsc 0; 1 failed / 53 passed |
| M8g | app.css: `.app-pending-strip` dropped from the strip gutter selector (Task 6's carried item) | visual carried: the strip wholly in the popup | tsc 0; 1 failed (`viewport ratio 0.961…`, l. 726) |
| M8h | app.css: Tensor's `.s9-origin-card` tile back to Task 5's cyan (`#00DBFF → #0066FF`) | visual carried: `[on47, on48]` equal to #49's | tsc 0; 1 failed (l. 764) |
| M8i | Sign.tsx: Q26 back to the lede `<p>` (Task 5's) | visual #46: `46-sign-null`'s banner head | tsc 0; 1 failed (element not found, l. 261) |
| M8j | app.css: the `.app-approve > .s9-gate-status` rule dropped (F-5, the overlap back) | connect.test.tsx: the gate line's computed style; visual #47 and carried: `gateClear` | tsc 0; vitest 1 failed / 26 passed (`expected [ '0px', '', '' ]`); playwright 2 failed (`the gate line's text 609 below the scroll area's last painted text 609`, `Received: 0`) |

Each E2E mutant was built from this task's end tree (`node scripts/build.mjs`) and its test run alone (`npx playwright test <spec> -g '<B1c-3 | carried | #46>'`); the other visual tests in the same run passed.

- [ ] **Step 6: Commit.**

```bash
git add docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md extension/e2e/dappPage.ts extension/e2e/visualTab.ts extension/e2e/visual-dapp-tx.spec.ts extension/e2e/visual-dapp.spec.ts extension/src/app/app.css extension/src/approve/__tests__/connect.test.tsx extension/src/unlock/screens/reauth.ts extension/src/unlock/__tests__/reauthScreen.test.ts
git commit -m "test(extension): B1c-3 Task 8 — the visual pass: every red-flag state of #48, #10 for an override, the carried items; banner meta addresses inline, the red CTA on one line, payload keys unwrapped, no #10 headline for an override or an allowance, #47's gate line clear of the scroll area

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Dry run: clone commit `3c478d1` on Task 7's `fd3ebd6`.)

**The dry run's consistency pass (the whole plan).** A script (`replay.py`, scratch) extracts every part's blocks in document order — each ````diff block applied with `git apply --recount`, each "Create `path`:" block written whole — onto a fresh `git archive b13bbd1`, and compares the tree with `git archive` of the clone's commit (`diff -r`). Result: tasks 1…N give a tree **identical** to the clone's commit for every N — 1 → `c1d98b4`, 2 → `f1f4a13`, 3 → `82ffdf7`, 4 → `614e54b`, 5 → `afb3e09`, 6 → `05a1f32`, 7 → `fd3ebd6`, 8 → `3c478d1`. (Block counts: task-1 3 diffs + 3 created files; task-2 2 created; task-3 14 diffs; task-4 14 diffs + 1 created; task-5 11; task-6 22; task-7 6; task-8 9.) No part needed fixing.

#### Dry-run notes (Task 8)

- **Finding F-4 overrules an earlier task's assertion (loud):** Task 4/6's reauthScreen test said "a single transaction: the row names what, the headline is still the one asset leaving". Seen on `10-dapp-override`, that headline was "0.000005 SOL" — the fee — above "Unlimited USDC spend approval". **Ruling: #10 draws no headline amount when the description has an override row or the `approval` reason line; the outflow is a row** — why: what is approved is not an amount leaving, and the largest type must never understate an unlimited approve (re-review N1's own principle) — cost if wrong: a bounded approve's / an override's #10 loses its headline (the amount is still a row). Spec §3.3 says so. The allowance half extends to a B1c-2 state (a bounded approve paid by the account) — stricter, flagged.
- **Ruling: the CSS findings F-1 … F-3 are fixed in app.css (hand-written), never design-ext.css** (generated-only). F-1 changes how every banner meta with an address looks (B1c-2's `48-unknown-program` too).
- **Ruling: "F7 with each of the three mint settings" = one Token-2022 mint carrying all three (one banner, three lines, each named with its address) plus a second, unreadable mint (Q36)** — not three mints — cost if wrong: none (each line asserted and shot).
- **Ruling: F1 and F6 are B1c-2's shots** (`48-unknown-program`, `48-approval-reauth`, updated by Task 7, re-reviewed here), not duplicated in the B1c-3 test.
- **Ruling: a gated CTA is shot after `waitForTimeout(FLAG_HOLD_MS)` and an assert that it is still disabled** — the only wall-clock wait, the hold the state needs; an enabled CTA is awaited (`ready`).
- **Ruling: `tensor.trade` joins `DAPP_HOSTS`** (test infrastructure) — the only way to shoot the verified Tensor tile on #47/#48; containment unchanged (routed, unresolvable).
- **Ruling: the pending-send strip is seeded through `v1_pending`** (visual-settings.spec.ts's record shape), not a real send — the strip is the subject, not the send.
- **Kept deviations:** listed above, each with its reason (B1c-2's caption/re-auth line/balance rows/instructions card; §9's omitted alternative card; Q55's whole addresses; the design's own `break-all` and `p` margins; the focus ring; #37's gated look; the markup's 1 : 1.4 bar; per-screen initials).
- **F-5 (controller ruling, fixed here):** #47's gate line read as drawn over the row the scroll area cuts ("ACCOUNT", 412 × 720) — B1c-1's screen; the cause is Q12's (no gap below the clip edge: the design's padding has no top). Fixed in app.css; measured in Chromium on every #47 state through `still` (`gateClear`, now in visualTab.ts), its computed style in happy-dom (padding-bottom is not asserted there: happy-dom drops the design shorthand's bottom beside the longhand — Chromium asserts it, 8 px). **Ruling: "do not intersect" is measured as what paints** — the scroll area's lowest text box clipped to its edge vs the gate line's text box, ≥ 7.5 px apart — because the cut row's own box always extends under the line (it is clipped, not painted); cost if wrong: none (the gap is the visible symptom).
- **Flagged to the owner (not changed):** the design file's own `.sticky-bar` CSS renders #48 state 2's bar stacked although its markup is a row.
- **Deviation: no separate red run of the whole visual pass on Task 7's tree beyond Step 2** — the pass is a review; each finding's red run is its mutation (M8a–M8f).
- **For the final review:** 25 new shots, 10 mutations; the B1c-3 test is ~51 s. The `lines()` helper counts distinct text-box tops — a label with an icon counts only text.

---


## Dry-run record

| task | dry-run commit | red on the predecessor | green (whole suite) | mutations |
|---|---|---|---|---|
| 1 | c1d98b4 | 3 files, 4 failed / 54 passed; `tokenState.test.ts` does not load | 168 files / 3322 | 16, all red |
| 2 | f1f4a13 | `redFlags.test.ts` does not load (`Cannot find module '../redFlags'`) | 169 / 3352 | 32, all red |
| 3 | 82ffdf7 | `tsc` 2; 5 files, 23 failed / 124 passed | 169 / 3372 | 37, all red |
| 4 | 614e54b | `tsc` 2 (24 errors); 7 files, 38 failed / 176 passed | 170 / 3393 | 32, all red |
| 5 | afb3e09 | `tsc` 2 (`FLAG_HOLD_MS` not exported); 2 files, 9 failed / 28 passed | 170 / 3401 | 22, all red |
| 6 | 05a1f32 | `tsc` 2 (8 × TS2339 `amountDecimals`); 8 files, 28 failed / 260 passed | 170 / 3415 | 28, all red |
| 7 | fd3ebd6 | no product code (red evidence = M7a–M7k); Home #42 red at six wall-clock times 23:59:50–23:59:59.9 before the fix | 170 / 3415; Playwright 51 + 20 normal and under `unshare -rn` (twice) | 11, all red |
| 8 | 3c478d1 | (visual; its findings F-1 … F-5 each with a red test) | 170 / 3417; Playwright 51 + 22 normal and under `unshare -rn`; `npm run verify` 0; root `tsc` 0, `jest` 1234 + 1 skipped; web `verify` 0 (550, then 3) | 10, all red |

- Every mutant compiled (`tsc` 0) before it counted; the first drafts that did not compile (Task 1: 3, Task 2: 1, Task 4: 5) were replaced, never counted as red. Three survivors were found and closed by strengthening the TEST, never the code (Task 3 M3ab, Task 4 M4ag; Task 7's M7b is caught only by the post-hold "still disabled" assertion, which is why it exists).
- Consistency: task-1 … task-N's blocks applied in order to `git archive b13bbd1` reproduce the dry run's commit N byte for byte, for every N from 1 to 8.
- One wall-clock dependence was found in B1b's tests (Home #42 across local midnight) and fixed in Task 7 — not a B1c-3 regression.
- Not run in the dry run: CI itself (the Before-the-PR repro is the executor's).

## Before the PR (the standing rules)

- [ ] Reproduce CI with **only** `web/` and `extension/` installed, on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`), npm 11.6.2: `npm ci --ignore-scripts` in both, `npm run verify` in both, `npm run e2e` in `extension/` — in a normal launch and under `unshare -rn`.
- [ ] `node scripts/check-no-tge-date.mjs` from the repository root — this plan and every file it adds are clean.
- [ ] The opus-tier visual review of Task 8's shots against index.html (#48 ix:18261-18705, state 2 ix:18325-18396; #37's gate ix:14949-15147), then an independent opus review of that review; each finding fixed or declared in the spec's §9; the result in the PR description.
- [ ] The owner has read the rulings below (copy Q28–Q55 marked) and the Fable 5.1 review is applied.
- [ ] The PR says loudly: with B1c-3 on `main`, B1c is complete (D10) — a store build is B1e's decision, with its release gates (§6.5); the declared omissions (Scope §3); first send through a program call is an accepted limit (O4).

## Self-review

- **Spec coverage:** B1 §3's table row by row is F1–F11 (Scope §1); the override rule (typed + re-auth, one transaction, no setting) is Task 4 + Task 5; the 1.5 s hold, no default focus and Enter are Task 5; Token-2022 warnings are Tasks 1–3 + 5; §9's dependent-batch row is solved (O2: Tasks 3–5, 7); R10's row is resolved (Task 3).
- **Placeholders:** none — every step carries its code or diff as committed in the dry run.
- **Type consistency:** the interfaces each task produces are the ones the next consumes (each task's **Interfaces** block; checked by the replay, which compiles at every prefix).
- **Review Focus:** six lines, each with its tests named in the owning task.

## Execution handoff

The owner chose subagent-driven development for B1c-1 and B1c-2; plan 3 is meant for the same (funds-critical tasks — 2, 3, 4 — on the most capable implementer, every task reviewed, a final whole-branch Fable review).

## The controller's rulings, for the owner

Owner decisions applied: **O1** unlimited approve = the design's typed symbol AND re-authentication through #10; **O2** dependent batches open under `UNCHECKED` + re-authentication, every other failure stays Reject-only; **O3** Token-2022 mint warnings only (classic freeze authority not flagged); **O4** first send through a program call is an accepted limit (spec §9).

Controller copy to confirm (spec §10, rev 3.6 — all flagged): Q28 `ASSIGN`, Q29 `AUTHORITY`, Q30 `UNLIMITED`, Q31 `UNCHECKED` (the override words); Q32 "This step depends on step <N> and could not be checked on its own."; Q33 "Re-auth required to override a blocked transaction."; Q34 "Approve anyway"; Q35 "Critical · Blocked transaction"; Q36 "Could not read this token's settings"; Q37–Q40 (#10's override rows); Q41–Q55 (#48's banner heads and bodies, the F10 balance card, the line replacing "No balance changes" beside a block, the banner meta vocabulary — Q55 uses technical wording, e.g. `#1 spl_token::Approve`; the owner may prefer prose). Still open from plan 2: **Q27** ("This simulation is out of date. Wait a moment for it to refresh.").

Rulings beyond the spec, each loud (detail in the tasks' Dry-run notes):
- R1 Compute Budget is F2's only exemption; an instruction a more specific flag names is not repeated in F2 (the design draws one banner for an unlimited approve).
- R2 F3 covers the four System forms by their target account; its chain-state rule needs the wallet account to change in this transaction.
- R3 F10 accepts exactly `{"InstructionError":[i,*]}` and `"AccountNotFound"` (source: `@solana/errors` 5.5.1, mirroring Agave); the step named is the earliest earlier creator.
- R4 the override words are checked before re-authentication (no challenge is issued for a wrong word); the challenge carries every flag and re-issues on an added flag, word or step.
- R5 the 1.5 s hold replaces C15's 500 ms on a flagged screen (C15's triggers kept).
- R6 the typed field: exact and case-sensitive, never autocapitalised / autocorrected / autofocused, paste allowed, #37's helper "Case-sensitive · must match exactly.", no placeholder (the design draws none).
- R7 "Approve unlimited" only when every block on the screen is an unlimited approve; otherwise "Approve anyway" (Q34); a lookalike with a block: typed fields, then the 2-second confirm, the block's eyebrow.
- R8 R10: an SPL transfer's destination is resolved to its owner; a destination created by another transaction of the batch is a first send (a dependent batch shows both #10 lines).
- R9 Tensor's tile is #49's colour on #46 / #47 / #48. **For the owner:** the design draws Tensor in three colours (#47 blue, #49 violet, #37's dApp list pink, ix:3601) — #37's list is not built here.
- R10 banner addresses whole, in groups of four (never the design's `JUP6L…vRet9`).
- R11 #10 shows no headline amount for an override or an allowance (the headline was the network fee — Task 8, F-4).
- R12 #47's gate line moved clear of the account label at 412 × 720 (B1c-1's layout bug — Task 8, F-5).
- **For the owner:** the design file's own CSS stacks state 2's sticky bar although its markup is a row; the markup (a row) is built.
