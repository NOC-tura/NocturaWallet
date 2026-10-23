# Noctura Extension B1d · Plan 1a — presale foundations (the build-time switch and its gate, a purchase as a send kind in the shared pipeline, the generic purchase record, the program state from the pinned IDL, core's limits, the shared jurisdiction gate) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 2 (2026-10-22):** Fable review 1 (approve after fixes: M1–M5, L1–L7) and owner decisions D16–D19 applied, dry-run again — rebuilt from Task 1 (4ec596b) on `dry/b1d1a-r2`: Tasks 2–6 are 1f6fe9b, 30626f6, 7333c87, a76655e, 45fa811, each green with `tsc`, both vitest runs, both builds, every gate, csp, secrets and reproducible; each changed task's new tests red on its predecessor (and, where they test new behaviour, on rev 1's code). M1 (Task 6: the expired-cache-plus-failed-re-read row, K6), M2 (Task 3: a send-shaped entry under an unregistered kind, K3), M3 (Task 5: the zero-referrer row and nine "every rule before any verdict" rows, S30–S33), M4 (every "byte-identical in 1a" statement reworded: plan, PR text, the gate's header comment), M5/D16 (the spec's **rev 3.1** paragraph lists every spec change this plan makes — see "Spec" below), D17 (`wallet.send` signs only a send, Task 3, D1–D2), D18 (min(server, 30), Task 6, D1–D4), D19 (no code; ruling), L1 (the capture adds a USDC send and a dApp record — regenerated from 0b79442's own code), L2, L3, L4 (popup `pendingOf`), L5, L6; every change marked "(rev 2)". 155 named mutations, all red; Playwright 77 normal and under `unshare -rn` on the end state; the consistency replay identical at every prefix. Change list: `.superpowers/sdd/b1d1a-plan-parts/rev2-changes.md`.

**Revision 1 (2026-10-19):** first issue, dry-run in full — every task implemented for real on a scratch clone of `feat/extension-b1d-plan1a` at 923b714 (main 0b79442 + the approved spec), one commit per task (4ec596b, c5550a0, 9bed436, b436245, b523457, f941887), each red on its predecessor and green on its own tree with `tsc`, the whole suite, the off-build suite, both builds, every gate (both builds), csp, secrets and the reproducible check; 143 named mutations, every one compiling and red; Playwright (75 → 77) at Tasks 1, 3 and 4, E2E 7 normal and under `unshare -rn`; web `verify` and the root `tsc` + `jest` at every task touching `core/`. Replaying task-1 … task-6's 67 blocks onto `git archive 923b714` reproduces each task's commit for every prefix (two generated fixtures are produced by their commands, given in the tasks). Next: a Fable 5.1 review (owner rule), then the owner.

**Goal:** Build B1d spec plan 1a (the header table's first row): the foundations for the presale with **no presale UI in either build** — the build-time switch (`__NOCTURA_PRESALE__`, the `presaleSwitch` Vite plugin and its off-build stubs, `--no-presale`), the off-build gate `check-no-presale.mjs`, `core/solana/encoding.ts`, the intent-kind registry with a purchase as a send kind in the shared pipeline (every existing send byte-for-byte unchanged), the generic rendering of a null-intent record on #11 / #26 / #21 / #44 / #54 (Q42, both builds), the program state from the pinned IDL (`layouts.ts`, `state.ts`, pins C5), `core/presale/limits.ts` (D7), and the shared jurisdiction gate (`core/geo/fetch.ts`, `src/background/geo/gate.ts`, both builds — D15). B1d-1a is a merge-to-`main` milestone, not a release (C26).

**Architecture:** Spec §1's layers. The build-time switch is resolve-time stub substitution (the background is a module service worker — no `import()`, no conditional static import): the off build replaces the three on-path entry modules with stubs, so no presale module is in its module map, which `check-no-presale.mjs` proves against an allowlist. A purchase becomes a kind in the shared send pipeline: the kind is the digest's domain (`'send'` unchanged) and part of the prepared entry's integrity (`'prepared'` unchanged for sends), `beforeSign` runs after `challengeSatisfied` and before `takePrepared` / `consumeChallenge`, the pending record carries `extra` (written only when set) and the validator, `inFlightFor` and `viewOf` know a null-intent record — so every existing send, challenge and record is byte-for-byte what it was (fixtures captured from 0b79442's own code). The background alone decides (C13): `state.ts` reads the program through the proxy and checks every pin before any verdict; `gate.ts` decides the jurisdiction with core's `presaleGeoGate`, fail closed, in both builds.

**Tech Stack:** TypeScript 5 strict, React 18, Vite 8 (a new local plugin), Vitest 5 + happy-dom, Playwright 1.63 (contained), `@solana/web3.js` 1.99. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md` (approved rev 3 → **rev 3.1**: the spec edits this plan's tasks make — Tasks 2, 4 and 6, each a diff in its task — are collected as rev 3.1 by owner decision D16, and Task 6 writes a status paragraph that lists **every** changed passage, one line each: C9, C11, C38, §1.2, §1.3, §1.4, §2.1, §2.2, §3.3 step 5, §3.3 step 7, §6.2, §8.2; rev 1 announced "three sentences", which undercounted them — review 1 M5). Parent: B1 spec §4. Owner decisions: `.superpowers/sdd/b1d-owner-decisions.md` (D1–D19; D16–D19 on this plan's review 1). Design (binding, contains the TGE date — never copy it): `/home/user/Downloads/index.html` (#11, #21, #26, #44, #54 rows). Template: `docs/superpowers/plans/2026-10-16-extension-b1c-plan3.md`.

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


And, for B1d-1a:

- **Both builds at every task:** the on build and the off build (`node scripts/build.mjs --no-presale`, `dist-nopresale/`) are built, tested (`vitest` and the off-build run `vitest.nopresale.config.ts`) and gate-checked (`npm run gates` runs the gate list once per build via `NOCTURA_DIST`).
- **Every existing send unchanged:** digests, integrity, challenges, pending records (a SOL send with a challenge, a USDC send without one, a dApp record — sent and polled) and validator verdicts equal the fixture captured from 0b79442's own code byte for byte; stored prepared entries equal it **but for their new `kind` key** (Task 3). A prepared entry stored before the update has no `kind` and is not read (`isPreparedShape`, fail closed): it is prepared again, its challenge carrying over (rev 2, review 1 L2).
- **The off build carries no presale module:** `check-no-presale.mjs` reads the module maps (the packages are byte-identical through Task 4; from Task 5 the on build carries the presale background modules, so the maps — not the files — remain the gate's evidence; rev 2, review 1 M4); each task appends its own modules to `ON_BUILD` / `BOTH_BUILDS` / `MUST_STAY` and the pinned rows.
- **Fail closed:** an unreadable, short, malformed or unpinned program read → presale unavailable; a missing, stale or ill-typed list, an unknown country, a 403 or a timeout → the gate closed.
- **Rent:** `PRESALE_*_RENT_LAMPORTS` and B1b's rent constants are upper bounds only; the exact outflow check (1b) uses the simulation's own rent (measured mainnet rate 5 080 lamports per byte). B1b's `sender-below-rent` stays at 890 880 (D19: stricter is safe; re-pinning from the chain is a separate later task — no code in 1a).
- **One kind per signer (D17):** `wallet.send` signs only `kind: 'send'`; a purchase is signed only through `presale.buy` (1b), which names its kind (Task 3).
- **The staleness limit is the extension's too (D18):** the gate judges a list against min(the server's `max_staleness_days`, 30) (Task 6).

## Review Focus

1. **A pending send written before this update, read after it** (a user with an open send updates the extension): it must be polled and shown exactly as before. Test: Task 3 (the 0b79442 fixture, restart survival).
2. **A second purchase or send while a purchase is open for the same account**: refused, in both builds. Tests: Task 3 (`inFlightFor`), Task 4 (off build, the record kept and shown).
3. **A config whose treasury or mint changed** (a single admin key could redirect buyers): the presale closes, never pays the new address. Tests: Task 5 (S6 and the pins).
4. **A restricted-region list that grew a field, or lost one**: an added field changes nothing; a missing required one closes the gate. Tests: Task 6.
5. **The off build quietly carrying presale code** (a new import path through shared code): the gate fails naming the module. Tests: Task 2 (fixture self-test, leak mutations), every later task's list rows.
6. **(rev 2) A purchase id sent to `wallet.send`, or an entry of a kind this build does not know**: refused before anything is burned (D17, review 1 M2). Tests: Task 3 (K3, D1, D2).
7. **(rev 2) An expired cached list whose re-read fails, and a coordinator that raises its own staleness limit**: closed, never the old list, never a list older than 30 days. Tests: Task 6 (K6, D1–D4).

---

## How to read the steps

- A **new file** is given in full. A **changed file** is a unified diff against the file as the previous task left it. Apply each ```diff block on its own, in order, with `git apply --recount` from the repository root — never concatenate blocks.
- Two **generated fixtures** are produced by commands given in their tasks (`app.modules.0b79442.json`, Task 2; `sends.0b79442.json`, Task 3); one generated module (`layouts.ts`, Task 5) by its committed generator, hash-pinned. CI never runs a generator.
- Commands run from `extension/` unless they start with `cd`. "Whole suite" is `npx tsc --noEmit; echo $?`, `npx vitest run` and `npx vitest run -c vitest.nopresale.config.ts`.
- **Each task ends with its named mutations** — each one alone, in a fresh `git archive` copy, `tsc`'s own exit code first; every one must turn the named test red.
- Each task ends with **"Dry-run notes"**: the rulings its dry run made; they are part of the plan.

## Tasks

### Task 1: The build-time switch — `NOCTURA_PRESALE` (one input), the `presaleSwitch` Vite plugin and `__NOCTURA_PRESALE__` in both Vite configs (parity tested), the three off-build stubs and the three on-path entries as skeletons wired into shared code, `scripts/build.mjs --no-presale` → `dist-nopresale/` with `app.features.json`, `npm run test` / `gates` / `csp` / `secrets` / `reproducible` over both builds, the off build booted in Chromium, and `core/solana/encoding.ts` (M2)

**Spec:** B1d §1.1 (all), §1.2 (`api.ts` row: 1a skeleton), §6.1 "Switch (1a)" and "Switch, off build", §6.2 `core/solana/encoding.ts`, "Vault isolation", "Reproducible", §8.2 rows 1 and `core/solana/encoding.ts`; C4, C38 (the module list this task makes true); owner decision D2.

**Files:**
- Create: `extension/scripts/presaleFlag.mjs`, `extension/scripts/presaleSwitch.mjs`, `extension/scripts/distDir.mjs`
- Create: `extension/vitest.nopresale.config.ts`, `extension/src/features.d.ts`
- Create: `extension/src/presale-off/background.ts`, `extension/src/presale-off/app.ts`, `extension/src/presale-off/unlock.ts` (the stubs)
- Create: `extension/src/background/presale/api.ts`, `extension/src/app/presale/index.ts`, `extension/src/unlock/presale.ts` (the on-path entries, skeletons), `extension/src/background/presaleHost.ts` (the entry contract, types only)
- Create: `core/solana/encoding.ts`
- Modify: `extension/vite.config.ts` (`appConfig(env)` factory; `define` + plugin, worker too), `extension/vite.content.config.ts` (`contentConfig(env)` factory; the same), `extension/scripts/build.mjs`, `extension/scripts/verify-reproducible.mjs`, `extension/package.json`, `extension/.gitignore`
- Modify (gates read `NOCTURA_DIST`): `extension/scripts/check-permissions.mjs`, `check-page-bundles.mjs`, `check-vault-isolation.mjs` (also: the vault-page stub allowed, `dist-nopresale/` skipped as source), `check-no-tge-date.mjs`, `check-fonts.mjs`
- Modify (shared code imports the entries): `extension/src/background/index.ts`, `extension/src/background/messages.ts`, `extension/src/app/router.ts`, `extension/src/unlock/challenge.ts`
- Modify: `core/presale/buyInstructions.ts` (re-exports), `core/solana/transfer.ts`, `core/solana/history.ts`, `core/solana/balances.ts`
- Modify: `extension/e2e/launch.ts` (`EXT_NOPRESALE`, `launchContained(…, {ext})`), `extension/e2e/popupHarness.ts` (`launchPopup(…, {ext})`)
- Test (new): `extension/scripts/__tests__/presaleSwitch.test.mjs`, `extension/scripts/__tests__/presaleBuilds.test.mjs`, `extension/src/__tests__/presaleSwitch.test.ts` (runs in both vitest runs), `extension/src/app/__tests__/routerPresale.test.ts`, `core/solana/__tests__/encoding.test.ts`, `extension/e2e/presaleSwitch.spec.ts`
- Test: `extension/scripts/__tests__/check-vault-isolation.test.mjs` (one test, two `it.each` rows, one list entry added)

**Interfaces:**
- Consumes: B1b/B1c's `Ext` (`src/ext.ts`), `WalletDeps` (`background/deps.ts`), `PRIVILEGED` (`background/messages.ts`), the router's closed list (`app/router.ts` `SCREENS`, `isRoute`), `describeChallenge` (`unlock/challenge.ts`), `launchContained` / `launchPopup` / `seedUnlockedWallet` / `contained` (e2e), `buildManifest` (`web/scripts/build-manifest.mjs`).
- Produces:
  - `scripts/presaleFlag.mjs`: `presaleFlag(env: {NOCTURA_PRESALE?: string}): boolean` — `'1'`/unset → `true`, `'0'` → `false`, anything else throws (`'NOCTURA_PRESALE must be …'`).
  - `scripts/presaleSwitch.mjs`:
    ```js
    export const PRESALE_ENTRIES: {entry: string; stub: string}[]   // package-relative; exactly the three of §1.1, in this order
    export function presaleSwitch(on: boolean, root?: string): Plugin // name 'noctura:presale-switch', enforce 'pre', api {presale: on}
    ```
    Off: `resolveId` resolves an import whose resolved id (query/hash stripped) is an entry to the stub's absolute path; anything else, external or unresolved → `null`. On: always `null`, never calls `this.resolve`. Throws on a non-boolean `on` or any missing stub (in either mode).
  - `scripts/distDir.mjs`: `DIST_DIRS = ['dist', 'dist-nopresale']`; `distDir(env = process.env): string` — `NOCTURA_DIST` or `'dist'`, anything else throws. Every build-reading gate's main uses it.
  - `vite.config.ts`: `export function appConfig(env): UserConfig` (default export `defineConfig(appConfig(process.env))`); `vite.content.config.ts`: `export function contentConfig(env): UserConfig` (default export `defineConfig(() => contentConfig(process.env))` — the module no longer throws on import without `NOCTURA_CONTENT`; the factory does). Both: `define: {__NOCTURA_PRESALE__: JSON.stringify(on)}` and exactly one `presaleSwitch(on)` (the app config's worker plugins too).
  - `vitest.nopresale.config.ts`: `export const NOPRESALE_TESTS: string[]` (1a: `src/__tests__/presaleSwitch.test.ts`, `src/background/__tests__/messages.test.ts`, `src/app/__tests__/router.test.ts`, `src/app/__tests__/App.test.tsx`, `src/unlock/__tests__/challenge.test.ts`) — **later tasks append their off-build test files here**; `test.env = {NOCTURA_PRESALE: '0'}` marks the run (`process.env.NOCTURA_PRESALE === '0'` inside a test).
  - `src/features.d.ts`: `declare const __NOCTURA_PRESALE__: boolean;`
  - `src/background/presaleHost.ts`: `interface PresaleHost {ext: Ext; deps: WalletDeps}`.
  - `src/background/presale/api.ts` and its stub `src/presale-off/background.ts`: `PRESALE_MESSAGE_TYPES: readonly string[] = []`, `registerPresale(host: PresaleHost): void` (does nothing). `index.ts` calls `registerPresale({ext, deps})` once, before any listener is added; `PRIVILEGED` ends with `...PRESALE_MESSAGE_TYPES`.
  - `src/app/presale/index.ts` and its stub `src/presale-off/app.ts`: `presaleRoutes: readonly PresaleRoute[] = []`, `presaleSlots: null = null`. `router.ts` exports `interface PresaleRoute {screen: string; isRoute(o: Readonly<Record<string, unknown>>): boolean}`; `isRoute` asks a presale route only for a screen outside `SCREENS` (a presale route can add a screen, never loosen one).
  - `src/unlock/presale.ts` and its stub `src/presale-off/unlock.ts`: `describePresale(about: Readonly<Record<string, unknown>>): null`; `describeChallenge` returns `describePresale(a)` for any kind other than `send` / `settings` / `dapp` (today's `null`).
  - `core/solana/encoding.ts`: `SPL_TOKEN_PROGRAM: string`, `encodeU64LE(value: bigint): Buffer`, `findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey` — moved verbatim; `core/presale/buyInstructions.ts` re-exports all three (the same bindings), `transfer.ts` / `history.ts` / `balances.ts` import from `./encoding`.
  - `scripts/build.mjs [outDir] [--no-presale]`: `NOCTURA_PRESALE` `'1'`/`'0'` in every vite build's env; default outDir `dist` / `dist-nopresale`; `<outDir>/app.features.json` = `{"presale":true|false}\n`, removed first, written last.
  - `e2e/launch.ts`: `EXT_NOPRESALE` (`dist-nopresale/chrome`); `launchContained(prefix, {hosts?, ext?})`, `launchPopup(prefix, {hosts?, ext?})` — `EXT` by default.
  - `package.json`: `build` builds both; `test` = `vitest run && vitest run --config vitest.nopresale.config.ts`; `gates` = `npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build` (`gates:build` = the seven gates as before); `csp` and `secrets` over both; `verify` removes both dists first; `reproducible` = four builds.

**Why the plugin (C4), shown by a test:** the background is a module service worker — an import cannot sit in an `if`, and `import()` throws there. A three-module fixture built with Vite (`presaleSwitch.test.mjs`, last describe) shows the three cases: on, the entry and its top-level effect are in the bundle; off, the stub is bundled and the effect is gone; and with only the constant (the call site folded away, no plugin) **the effect stays** — the negative control that makes the plugin necessary rather than decorative.

**What the dry run found about the bundles (read before Task 2):** at this task the two packages are **byte-identical** (`diff -rq dist/chrome dist-nopresale/chrome` is empty; the reproducible run prints the same digests for both variants) — the skeletons and the stubs compile to the same code, and module ids never reach the output. They stay byte-identical through Task 4; from Task 5 the on build carries the presale background modules (kept whole), so the files differ and the maps remain the evidence (rev 2, review 1 M4: rev 1 said "in B1d-1a", which is false from Task 5). Only the module maps differ: on carries `src/background/presale/api.ts`, `src/app/presale/index.ts`, `src/unlock/presale.ts`; off carries `src/presale-off/{background,app,unlock}.ts` instead. So the module map is the only evidence the switch did anything in 1a — which is what the build test and Task 2's gate read. After the move, `core/presale/**` in **both** builds is exactly `addresses.ts` and `stagePrices.ts` (`allocation.ts` went with `buyInstructions.ts`: only it imported it) — inside C38's allowlist.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/presaleSwitch.test.mjs`:

````js
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {presaleFlag} from '../presaleFlag.mjs';
import {PRESALE_ENTRIES, presaleSwitch} from '../presaleSwitch.mjs';
import {DIST_DIRS, distDir} from '../distDir.mjs';
import {appConfig} from '../../vite.config';
import {contentConfig} from '../../vite.content.config';
import nopresale from '../../vitest.nopresale.config';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// B1d §1.1 (D2, C4): one build input, two mechanisms — the plugin removes the three entry modules, the constant folds
// inline branches — and both Vite configs read the same flag.
describe('presaleFlag', () => {
  it("maps '1' and unset to on, '0' to off", () => {
    expect(presaleFlag({NOCTURA_PRESALE: '1'})).toBe(true);
    expect(presaleFlag({})).toBe(true);
    expect(presaleFlag({NOCTURA_PRESALE: '0'})).toBe(false);
  });

  it('throws on anything else — a typo never picks a build', () => {
    for (const v of ['', 'true', 'false', 'off', 'no', ' 0', '0 ', '00', '2']) expect(() => presaleFlag({NOCTURA_PRESALE: v})).toThrow('NOCTURA_PRESALE');
  });
});

describe('distDir', () => {
  it("selects dist by default and dist-nopresale by NOCTURA_DIST; anything else throws", () => {
    expect(DIST_DIRS).toEqual(['dist', 'dist-nopresale']);
    expect(distDir({})).toBe('dist');
    expect(distDir({NOCTURA_DIST: 'dist'})).toBe('dist');
    expect(distDir({NOCTURA_DIST: 'dist-nopresale'})).toBe('dist-nopresale');
    for (const v of ['', 'dist/', '../dist', 'dist-presale', '/tmp/dist']) expect(() => distDir({NOCTURA_DIST: v})).toThrow('NOCTURA_DIST');
  });
});

describe('presaleSwitch', () => {
  const ctx = id => ({resolve: async () => (id === null ? null : {id, external: false})});
  const call = (plugin, id, source = './x') => plugin.resolveId.call(ctx(id), source, join(ROOT, 'src/background/index.ts'), {});

  it('names exactly the three entries of §1.1 and their stubs outside every presale directory', () => {
    expect(PRESALE_ENTRIES).toEqual([
      {entry: 'src/background/presale/api.ts', stub: 'src/presale-off/background.ts'},
      {entry: 'src/app/presale/index.ts', stub: 'src/presale-off/app.ts'},
      {entry: 'src/unlock/presale.ts', stub: 'src/presale-off/unlock.ts'},
    ]);
  });

  it('off: resolves each entry to its stub, with or without a query or hash, and nothing else', async () => {
    const off = presaleSwitch(false);
    expect(off.enforce).toBe('pre');
    expect(off.api).toEqual({presale: false});
    for (const {entry, stub} of PRESALE_ENTRIES) {
      expect(await call(off, join(ROOT, entry))).toBe(join(ROOT, stub));
      expect(await call(off, `${join(ROOT, entry)}?v=1`)).toBe(join(ROOT, stub));
      expect(await call(off, `${join(ROOT, entry)}#x`)).toBe(join(ROOT, stub));
    }
    // Negative controls: a module beside an entry, a stub itself, an unresolvable import, an external one.
    expect(await call(off, join(ROOT, 'src/background/presaleHost.ts'))).toBeNull();
    expect(await call(off, join(ROOT, 'src/background/presale/state.ts'))).toBeNull();
    expect(await call(off, join(ROOT, 'src/presale-off/background.ts'))).toBeNull();
    expect(await call(off, null)).toBeNull();
    expect(await off.resolveId.call({resolve: async () => ({id: join(ROOT, PRESALE_ENTRIES[0].entry), external: true})}, 'x', undefined, {})).toBeNull();
  });

  it('on: resolves nothing — it never even asks the resolver', async () => {
    const on = presaleSwitch(true);
    expect(on.api).toEqual({presale: true});
    let asked = 0;
    const counting = {resolve: async () => ((asked += 1), {id: join(ROOT, PRESALE_ENTRIES[0].entry), external: false})};
    for (const {entry} of PRESALE_ENTRIES) expect(await on.resolveId.call(counting, join(ROOT, entry), undefined, {})).toBeNull();
    expect(asked).toBe(0);
  });

  it('throws on a flag that is not a boolean, and on a missing stub (naming it)', () => {
    for (const v of ['1', '0', 1, 0, undefined, null, 'true']) expect(() => presaleSwitch(v)).toThrow('presaleSwitch');
    const root = mkdtempSync(join(tmpdir(), 'presale-switch-'));
    try {
      mkdirSync(join(root, 'src/presale-off'), {recursive: true});
      writeFileSync(join(root, 'src/presale-off/background.ts'), '');
      writeFileSync(join(root, 'src/presale-off/app.ts'), '');
      expect(() => presaleSwitch(false, root)).toThrow('src/presale-off/unlock.ts');
      expect(() => presaleSwitch(true, root)).toThrow('src/presale-off/unlock.ts');
      writeFileSync(join(root, 'src/presale-off/unlock.ts'), '');
      expect(() => presaleSwitch(false, root)).not.toThrow();
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });
});

describe('both configs read the same flag (review L11)', () => {
  const switches = plugins => plugins.flat(Infinity).filter(p => p && p.name === 'noctura:presale-switch');
  const modeOf = plugins => switches(plugins).map(p => p.api.presale);

  it.each([
    ['unset', {}, true],
    ["'1'", {NOCTURA_PRESALE: '1'}, true],
    ["'0'", {NOCTURA_PRESALE: '0'}, false],
  ])('NOCTURA_PRESALE %s: the same define and the same plugin mode in the app, worker and content builds', (_name, env, on) => {
    const app = appConfig(env);
    const content = contentConfig({...env, NOCTURA_CONTENT: 'relay'});
    expect(app.define).toEqual({__NOCTURA_PRESALE__: JSON.stringify(on)});
    expect(content.define).toEqual({__NOCTURA_PRESALE__: JSON.stringify(on)});
    expect(modeOf(app.plugins)).toEqual([on]);
    expect(modeOf(app.worker.plugins())).toEqual([on]);
    expect(modeOf(content.plugins)).toEqual([on]);
  });

  it('a bad flag fails both configs; the content config still requires its script name', () => {
    expect(() => appConfig({NOCTURA_PRESALE: 'off'})).toThrow('NOCTURA_PRESALE');
    expect(() => contentConfig({NOCTURA_PRESALE: 'off', NOCTURA_CONTENT: 'relay'})).toThrow('NOCTURA_PRESALE');
    expect(() => contentConfig({NOCTURA_PRESALE: '1'})).toThrow('NOCTURA_CONTENT');
  });

  it('vitest.nopresale.config.ts is the app config with the flag off, its own include list, and the run marked off', () => {
    expect(nopresale.define).toEqual({__NOCTURA_PRESALE__: 'false'});
    expect(modeOf(nopresale.plugins)).toEqual([false]);
    expect(nopresale.test.env).toEqual({NOCTURA_PRESALE: '0'});
    expect(nopresale.test.include).toContain('src/__tests__/presaleSwitch.test.ts');
    // The on run (vite.config.ts) is not marked: unset reads as on.
    expect(appConfig({}).test.env).toBeUndefined();
  });
});

// Why the plugin and not a guarded call (C4): a module whose top level has an effect stays in the bundle when only its
// call site is folded away; resolving the import to the stub is what removes it. A three-module fixture, built twice.
describe('the plugin removes a module with a side-effectful top level; a folded call site does not', () => {
  let root;
  const EFFECT = 'presale-module-top-level-effect';
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'presale-switch-build-'));
    for (const {entry, stub} of PRESALE_ENTRIES) {
      mkdirSync(dirname(join(root, entry)), {recursive: true});
      mkdirSync(dirname(join(root, stub)), {recursive: true});
      writeFileSync(join(root, stub), "export const run = () => 'from-the-stub';\n");
      writeFileSync(join(root, entry), `globalThis.effects = [...(globalThis.effects ?? []), '${EFFECT}'];\nexport const run = () => 'from-the-entry';\n`);
    }
    writeFileSync(join(root, 'plain.js'), "import {run} from './src/background/presale/api.ts';\nglobalThis.ran = run();\n");
    writeFileSync(join(root, 'guarded.js'), "import {run} from './src/background/presale/api.ts';\nif (__NOCTURA_PRESALE__) globalThis.ran = run();\n");
  });
  afterAll(() => rmSync(root, {recursive: true, force: true}));

  const bundle = async (input, on) => {
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      define: {__NOCTURA_PRESALE__: JSON.stringify(on)},
      plugins: [presaleSwitch(on, root)],
      build: {write: false, minify: false, lib: {entry: join(root, input), formats: ['es'], fileName: 'out'}},
    });
    const chunk = (Array.isArray(out) ? out[0] : out).output[0];
    return {code: chunk.code, modules: chunk.moduleIds.map(id => id.slice(root.length + 1))};
  };

  it('on: the entry is bundled with its effect (positive control)', async () => {
    const b = await bundle('plain.js', true);
    expect(b.modules).toContain('src/background/presale/api.ts');
    expect(b.code).toContain(EFFECT);
    expect(b.code).toContain('from-the-entry');
  });

  it('off: the stub is bundled instead, and the effect is gone', async () => {
    const b = await bundle('plain.js', false);
    expect(b.modules).toContain('src/presale-off/background.ts');
    expect(b.modules).not.toContain('src/background/presale/api.ts');
    expect(b.code).toContain('from-the-stub');
    expect(b.code).not.toContain('from-the-entry');
    expect(b.code).not.toContain(EFFECT);
  });

  it('the constant alone (the call folded away, no plugin) keeps the effect — negative control for C4', async () => {
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      define: {__NOCTURA_PRESALE__: 'false'},
      build: {write: false, minify: false, lib: {entry: join(root, 'guarded.js'), formats: ['es'], fileName: 'out'}},
    });
    const chunk = (Array.isArray(out) ? out[0] : out).output[0];
    expect(chunk.code).not.toContain('from-the-entry');
    expect(chunk.code).toContain(EFFECT);
  });
});
````

Create `extension/scripts/__tests__/presaleBuilds.test.mjs`:

````js
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BUILD_MS = 180_000;

// B1d §1.1, §6.1 "Switch": the real build, both ways — `node scripts/build.mjs <dir> [--no-presale]` — read through the
// module maps the build writes next to its output (the bundler's own account of what each chunk carries).
const builds = {};
const modulesOf = dir => {
  const out = new Set();
  for (const f of readdirSync(dir).filter(f => /^app(\.[a-z]+)?\.modules\.json$/.test(f))) {
    for (const ids of Object.values(JSON.parse(readFileSync(join(dir, f), 'utf8')).chunks)) for (const id of ids) out.add(id);
  }
  return out;
};
beforeAll(() => {
  for (const [name, args] of [['on', []], ['off', ['--no-presale']]]) {
    const dir = mkdtempSync(join(tmpdir(), `presale-build-${name}-`));
    execFileSync('node', ['scripts/build.mjs', dir, ...args], {cwd: ROOT, stdio: 'pipe'});
    builds[name] = {dir, modules: modulesOf(dir), features: JSON.parse(readFileSync(join(dir, 'app.features.json'), 'utf8'))};
  }
}, BUILD_MS);
afterAll(() => {
  for (const b of Object.values(builds)) rmSync(b.dir, {recursive: true, force: true});
});

describe('the two builds', () => {
  it('each writes app.features.json next to app.modules.json, never inside a package', () => {
    expect(builds.on.features).toEqual({presale: true});
    expect(builds.off.features).toEqual({presale: false});
    for (const b of Object.values(builds)) {
      for (const d of ['app', 'chrome', 'firefox']) expect(existsSync(join(b.dir, d, 'app.features.json'))).toBe(false);
      expect(existsSync(join(b.dir, 'app.modules.json'))).toBe(true);
    }
  });

  it.each(PRESALE_ENTRIES.map(e => [e.entry, e.stub]))('on: %s is bundled and its stub is not (positive control)', (entry, stub) => {
    expect(builds.on.modules.has(entry)).toBe(true);
    expect(builds.on.modules.has(stub)).toBe(false);
  });

  it.each(PRESALE_ENTRIES.map(e => [e.entry, e.stub]))('off: %s is replaced by %s', (entry, stub) => {
    expect(builds.off.modules.has(entry)).toBe(false);
    expect(builds.off.modules.has(stub)).toBe(true);
  });

  it('off: no module under a presale directory at all', () => {
    const presale = [...builds.off.modules].filter(id => /^src\/(background|app)\/presale\/|^src\/unlock\/presale\.ts$/.test(id));
    expect(presale).toEqual([]);
  });

  it('both: the moved helpers come from core/solana/encoding.ts, and core/presale/buyInstructions.ts is in neither (M2)', () => {
    for (const b of Object.values(builds)) {
      expect(b.modules.has('../core/solana/encoding.ts')).toBe(true);
      expect(b.modules.has('../core/presale/buyInstructions.ts')).toBe(false);
    }
  });

  it('both: the same manifest — the switch adds no permission, host or CSP entry', () => {
    for (const browser of ['chrome', 'firefox']) {
      expect(readFileSync(join(builds.off.dir, browser, 'manifest.json'), 'utf8')).toBe(readFileSync(join(builds.on.dir, browser, 'manifest.json'), 'utf8'));
    }
  });

  // C4: the background is a module service worker, where import() throws. A method named `import` (`x.import()`) is not one.
  it('no chunk the background loads contains a dynamic import, in either build', () => {
    const DYNAMIC = /(?<![.\w$])import\s*\(/;
    for (const b of Object.values(builds)) {
      const app = join(b.dir, 'app');
      const seen = new Set();
      const stack = ['background.js'];
      while (stack.length > 0) {
        const file = stack.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        const code = readFileSync(join(app, file), 'utf8');
        expect([file, DYNAMIC.test(code)]).toEqual([file, false]);
        for (const m of code.matchAll(/(?:from|import)\s*["']\.\/([^"']+)["']/g)) stack.push(join(dirname(file), m[1]));
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });
});
````

Create `extension/src/__tests__/presaleSwitch.test.ts`:

````ts
import * as bgEntry from '../background/presale/api';
import * as bgStub from '../presale-off/background';
import * as appEntry from '../app/presale';
import * as appStub from '../presale-off/app';
import * as unlockEntry from '../unlock/presale';
import * as unlockStub from '../presale-off/unlock';

// B1d §1.1 (review L10): this file runs in both vitest runs — vite.config.ts (presale on) and vitest.nopresale.config.ts
// (off, the run marked NOCTURA_PRESALE=0). In each, the constant and the plugin must agree with the run: on, every entry
// is its own module; off, importing an entry gives the stub's module itself.
const off = process.env.NOCTURA_PRESALE === '0';

// Each stub has exactly its entry's shape, both ways (tsc proves it; nothing here runs).
const shapes: [typeof bgEntry, typeof bgStub, typeof appEntry, typeof appStub, typeof unlockEntry, typeof unlockStub] = [bgStub, bgEntry, appStub, appEntry, unlockStub, unlockEntry];

describe(`the build-time switch in this run (${off ? 'off' : 'on'})`, () => {
  it(`__NOCTURA_PRESALE__ is ${!off}`, () => {
    expect(__NOCTURA_PRESALE__).toBe(!off);
  });

  it(off ? 'each entry resolved to its stub' : 'each entry is its own module, not the stub (positive control)', () => {
    expect([bgEntry === bgStub, appEntry === appStub, unlockEntry === unlockStub]).toEqual([off, off, off]);
    expect(shapes).toHaveLength(6);
  });

  it('the skeletons and the stubs export the same empty values (B1d-1a: nothing registered, no route, no slot, no description)', () => {
    for (const m of [bgEntry, bgStub]) expect(m.PRESALE_MESSAGE_TYPES).toEqual([]);
    for (const m of [appEntry, appStub]) {
      expect(m.presaleRoutes).toEqual([]);
      expect(m.presaleSlots).toBeNull();
    }
    for (const m of [unlockEntry, unlockStub]) expect(m.describePresale({kind: 'presale-buy'})).toBeNull();
  });
});
````

Create `extension/src/app/__tests__/routerPresale.test.ts`:

````ts
import {routeReducer, type PresaleRoute, type Route} from '../router';

// B1d §1.1: the router takes the presale entry's routes (src/app/presale/index.ts, empty in B1d-1a and in the build
// without presale). Here the entry is replaced by a test double holding two: one with a screen of its own, and one
// that claims a screen the closed list already holds.
vi.mock('../presale', (): {presaleRoutes: readonly PresaleRoute[]; presaleSlots: null} => ({
  presaleRoutes: [
    {screen: 'x-presale', isRoute: o => Object.keys(o).length === 2 && o.n === 1},
    {screen: 'security', isRoute: () => true},
  ],
  presaleSlots: null,
}));

const HOME: Route[] = [{screen: 'tab', tab: 'home'}];
const push = (route: unknown) => routeReducer(HOME, {type: 'push', route: route as Route});

describe('the router with presale routes', () => {
  it('a presale route of its own screen is decided by its own validator', () => {
    expect(push({screen: 'x-presale', n: 1})).toEqual([...HOME, {screen: 'x-presale', n: 1}]);
    expect(push({screen: 'x-presale', n: 2})).toBe(HOME);
    expect(push({screen: 'x-presale', n: 1, extra: true})).toBe(HOME);
  });

  it('a presale route cannot loosen a screen of the closed list; an unknown screen stays refused', () => {
    expect(push({screen: 'security', extra: true})).toBe(HOME);
    expect(push({screen: 'security'})).toEqual([...HOME, {screen: 'security'}]);
    expect(push({screen: 'x-other'})).toBe(HOME);
  });
});
````

Create `core/solana/__tests__/encoding.test.ts`:

````ts
import {PublicKey} from '@solana/web3.js';
import {SPL_TOKEN_PROGRAM, encodeU64LE, findAssociatedTokenAddress} from '../encoding';
import * as buy from '../../presale/buyInstructions';
import * as transfer from '../transfer';
import * as balances from '../balances';

// B1d §6.2 (review M2): the helpers core/solana needs live here, so an extension build that leaves presale out does not
// carry core/presale/buyInstructions.ts. Every old name still answers — the same function, not a copy — so the app and
// web are unchanged.
describe('core/solana/encoding.ts', () => {
  it('encodeU64LE: little-endian by hand, u64 range only', () => {
    expect([...encodeU64LE(0x0102030405060708n)]).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    expect([...encodeU64LE(2n ** 64n - 1n)]).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
    expect(() => encodeU64LE(-1n)).toThrow(/out of u64 range/);
    expect(() => encodeU64LE(2n ** 64n)).toThrow(/out of u64 range/);
  });

  it('findAssociatedTokenAddress: the ATA program derivation, off-curve owners included', () => {
    // The live Squads vault (off-curve) and USDC: the vault ATA the presale's stablecoin purchases pay into.
    const owner = new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');
    const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const [expected] = PublicKey.findProgramAddressSync(
      [owner.toBytes(), new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBytes(), mint.toBytes()],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
    );
    expect(PublicKey.isOnCurve(owner.toBytes())).toBe(false);
    expect(findAssociatedTokenAddress(owner, mint).toBase58()).toBe(expected.toBase58());
  });

  it('SPL_TOKEN_PROGRAM is the classic Token program', () => {
    expect(SPL_TOKEN_PROGRAM).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  });

  it('the old names re-export the same bindings: buyInstructions, transfer and balances', () => {
    expect(buy.encodeU64LE).toBe(encodeU64LE);
    expect(buy.findAssociatedTokenAddress).toBe(findAssociatedTokenAddress);
    expect(buy.SPL_TOKEN_PROGRAM).toBe(SPL_TOKEN_PROGRAM);
    expect(transfer.findAssociatedTokenAddress).toBe(findAssociatedTokenAddress);
    expect(balances.SPL_TOKEN_PROGRAM).toBe(SPL_TOKEN_PROGRAM);
  });
});
````

Create `extension/e2e/presaleSwitch.spec.ts`:

````ts
import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {EXT, EXT_NOPRESALE} from './launch';
import {MAIN, contained, launchPopup, seedUnlockedWallet} from './popupHarness';

declare const chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}};

// B1d §1.1: both builds boot — the module service worker loads and answers, the popup renders #11 — and each is the
// build it claims to be (its app.features.json, written by scripts/build.mjs next to the package). The on build is the
// positive control for the off build: the same steps, the same answers.
for (const [name, ext, presale] of [
  ['on (dist)', EXT, true],
  ['off (dist-nopresale)', EXT_NOPRESALE, false],
] as const) {
  test(`switch · the ${name} build boots: the background answers, the popup renders #11`, async () => {
    expect(JSON.parse(readFileSync(join(dirname(ext), 'app.features.json'), 'utf8'))).toEqual({presale});
    const h = await launchPopup(`noctura-e2e-switch-${presale ? 'on' : 'off'}-`, {ext});
    try {
      await seedUnlockedWallet(h.sw);
      const popup = await h.openPopup();
      await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
      const status = await popup.evaluate(() => chrome.runtime.sendMessage({type: 'vault.status'}));
      expect(status).toEqual({ok: true, data: {unlocked: true, accounts: [{index: MAIN.index, publicKey: MAIN.publicKey}, expect.objectContaining({index: 1})]}});
      // B1d-1a registers no presale message in either build: an unknown type, refused before any handler.
      expect(await popup.evaluate(() => chrome.runtime.sendMessage({type: 'presale.view'}))).toEqual({ok: false, error: 'unknown type'});
      contained(h);
    } finally {
      await h.close();
    }
  });
}
````

In `extension/scripts/__tests__/check-vault-isolation.test.mjs` (the vault-page stub allowed, the other two refused; `dist-nopresale/` not read as source):

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index 6757b1a..7e2414e 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -530,10 +530,10 @@ describe('vault isolation (which files the source rule reads)', () => {
   });
   afterEach(() => rmSync(root, {recursive: true, force: true}));
 
-  it('reads every source file under the package except node_modules, dist, tests, e2e and scripts', () => {
+  it('reads every source file under the package except node_modules, both builds (dist, dist-nopresale), tests, e2e and scripts', () => {
     for (const rel of [
       'src/app/popup.tsx', 'src/ui/a.tsx', 'leak/prf.ts', 'x.mjs', 'vite.config.ts', 'manifest/source.mjs', 'deep/a/b.js',
-      'node_modules/p/index.js', 'dist/app/background.js', 'src/vault/__tests__/a.test.ts', 'e2e/a.spec.ts',
+      'node_modules/p/index.js', 'dist/app/background.js', 'dist-nopresale/app/background.js', 'src/vault/__tests__/a.test.ts', 'e2e/a.spec.ts',
       'scripts/check.mjs', 'popup.html', 'notes.md',
     ]) touch(rel);
     expect(listSourceFiles(root).sort()).toEqual(['deep/a/b.js', 'leak/prf.ts', 'manifest/source.mjs', 'src/app/popup.tsx', 'src/ui/a.tsx', 'vite.config.ts', 'x.mjs']);
@@ -744,6 +744,9 @@ describe('vault isolation (built output)', () => {
     ['node_modules/@scure/base/node_modules/evil/index.js', 'assets/base-1.js'],
     ['node_modules/@solana/web3.js/lib/index.browser.esm.js', 'assets/unlock-1.js'],
     ['\0virtual:app', 'assets/unlock-1.js'],
+    // B1d §1.1: of the three off-build stubs, only the vault page's own may be bundled with it.
+    ['src/presale-off/app.ts', 'assets/unlock-1.js'],
+    ['src/presale-off/background.ts', 'assets/unlock-1.js'],
   ])('fails when a chunk the vault page loads carries %s', (id, chunk) => {
     sheets();
     const map = MAP();
@@ -751,6 +754,15 @@ describe('vault isolation (built output)', () => {
     expect(vaultPageModuleViolations(dir, map)).toEqual([`${chunk} (reachable from unlock.html) carries ${JSON.stringify(id)} — only vault-page code and its five packages may be bundled with the seed`]);
   });
 
+  it('B1d §1.1: the vault-page stub of the off build (src/presale-off/unlock.ts) is vault-page code, as its entry src/unlock/presale.ts is', () => {
+    sheets();
+    for (const id of ['src/presale-off/unlock.ts', 'src/unlock/presale.ts']) {
+      const map = MAP();
+      map.chunks['assets/unlock-1.js'] = [...map.chunks['assets/unlock-1.js'], id];
+      expect(vaultPageModuleViolations(dir, map)).toEqual([]);
+    }
+  });
+
   it('fails a reachable chunk missing from the map, a missing map, and a map that does not describe the vault page', () => {
     sheets();
     const map = MAP();
````

The E2E spec needs `launchContained` / `launchPopup` to take `ext` — part of Step 3's e2e diff.

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run (from `extension/`): `npx vitest run scripts/__tests__/presaleSwitch.test.mjs scripts/__tests__/presaleBuilds.test.mjs src/__tests__/presaleSwitch.test.ts scripts/__tests__/check-vault-isolation.test.mjs ../core/solana/__tests__/encoding.test.ts src/app/__tests__/routerPresale.test.ts`

Expected (the dry run, on 923b714): `Test Files  6 failed (6)` · `Tests  3 failed | 419 passed (422)` —
- `presaleSwitch.test.mjs`: `Error: Cannot find module '../presaleFlag.mjs'`; `presaleBuilds.test.mjs`: `Cannot find module '../presaleSwitch.mjs'`; `src/__tests__/presaleSwitch.test.ts`: `Cannot find module '../background/presale/api'`; `encoding.test.ts`: `Cannot find module '../encoding'`;
- `check-vault-isolation.test.mjs`: “reads every source file under the package except node_modules, both builds…” (`dist-nopresale/app/background.js` read as source) and “B1d §1.1: the vault-page stub of the off build … is vault-page code…” (`expected [ Array(1) ] to deeply equal []`) red; the two new `it.each` rows (`src/presale-off/app.ts`, `src/presale-off/background.ts`) already pass — they are negative controls;
- `routerPresale.test.ts`: “a presale route of its own screen is decided by its own validator” red (the router ignores the mocked entry), the other test passes (a positive control: today's closed list).

`e2e/presaleSwitch.spec.ts` does not compile on the previous tree (`EXT_NOPRESALE` is not exported by `./launch`).

- [ ] **Step 3: Implement.**

Create `extension/scripts/presaleFlag.mjs`:

````js
// B1d §1.1 (D2): the one build input. scripts/build.mjs sets NOCTURA_PRESALE in the environment of every vite build it
// runs; both Vite configs read it here and nowhere else. '1' or unset → presale on (the default for B1d builds), '0' →
// off. Anything else throws: a typo must never pick a build.
export function presaleFlag(env) {
  const v = env.NOCTURA_PRESALE;
  if (v === undefined || v === '1') return true;
  if (v === '0') return false;
  throw new Error(`NOCTURA_PRESALE must be '1', '0' or unset, not ${JSON.stringify(v)}`);
}
````

Create `extension/scripts/presaleSwitch.mjs`:

````js
import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * B1d §1.1 (C4): the three entry modules through which presale code joins the shared code, and the stub each resolves
 * to when presale is off — outside every presale directory. Shared code imports the entries unconditionally; nothing
 * else under a presale directory may be imported by shared code (the off-build gate proves it on the module maps).
 */
export const PRESALE_ENTRIES = [
  {entry: 'src/background/presale/api.ts', stub: 'src/presale-off/background.ts'},
  {entry: 'src/app/presale/index.ts', stub: 'src/presale-off/app.ts'},
  {entry: 'src/unlock/presale.ts', stub: 'src/presale-off/unlock.ts'},
];

/**
 * The Vite plugin that removes presale code from the off build: its `resolveId` resolves each entry, however it is
 * spelled (a query or a hash included), to its stub, so the entry's module — and every module only it imports, with
 * whatever their top level does — never enters the bundle. A guarded call site could not do that, and the background is
 * a module service worker, where an import cannot sit in an `if` and `import()` throws. On, it resolves nothing.
 * `api.presale` says which mode it is in (the configs' parity test reads it).
 */
export function presaleSwitch(on, root = ROOT) {
  if (typeof on !== 'boolean') throw new Error(`presaleSwitch: the flag must be a boolean, not ${JSON.stringify(on)}`);
  const stubs = new Map();
  for (const {entry, stub} of PRESALE_ENTRIES) {
    if (!existsSync(join(root, stub))) throw new Error(`presaleSwitch: the stub ${stub} is missing`);
    stubs.set(join(root, entry), join(root, stub));
  }
  return {
    name: 'noctura:presale-switch',
    enforce: 'pre',
    api: {presale: on},
    async resolveId(source, importer, options) {
      if (on) return null;
      const resolved = await this.resolve(source, importer, {...options, skipSelf: true});
      if (resolved === null || resolved.external) return null;
      return stubs.get(resolved.id.replace(/[?#].*$/, '')) ?? null;
    },
  };
}
````

Create `extension/scripts/distDir.mjs`:

````js
// B1d §1.1: which build a gate reads, package-relative — `dist` (presale on, the default) or `dist-nopresale` (off).
// `npm run gates` runs every gate once per build, selecting it with NOCTURA_DIST; anything else throws.
export const DIST_DIRS = ['dist', 'dist-nopresale'];

export function distDir(env = process.env) {
  const d = env.NOCTURA_DIST ?? 'dist';
  if (!DIST_DIRS.includes(d)) throw new Error(`NOCTURA_DIST must be one of ${DIST_DIRS.join(', ')}, not ${JSON.stringify(d)}`);
  return d;
}
````

Create `extension/src/features.d.ts`:

````ts
/**
 * B1d §1.1: whether this build carries presale — substituted by Vite's `define` in both configs (vite.config.ts,
 * vite.content.config.ts) from the one build input (scripts/presaleFlag.mjs). For inline branches that need no
 * module; it never guards an import (the presaleSwitch plugin removes modules).
 */
declare const __NOCTURA_PRESALE__: boolean;
````

Create `extension/src/background/presaleHost.ts`:

````ts
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';

/**
 * B1d §1.1: what the background hands its presale entry module at start-up (`registerPresale`, called once by
 * index.ts) — the entry `presale/api.ts` in the presale build, its stub `src/presale-off/background.ts` in the build
 * without it. Types only: both import it, and neither imports the other.
 */
export interface PresaleHost {
  ext: Ext;
  deps: WalletDeps;
}
````

Create `extension/src/background/presale/api.ts`:

````ts
import type {PresaleHost} from '../presaleHost';

/**
 * B1d §1.1, §1.2: the background's presale entry — the one module of `presale/` that shared code imports (index.ts
 * calls `registerPresale`, messages.ts adds `PRESALE_MESSAGE_TYPES` to the privileged partition). The build without
 * presale resolves it to `src/presale-off/background.ts`. B1d-1a: registers nothing and adds no message type; B1d-1b
 * registers the `presale-buy` intent kind and the `presale.*` handlers here.
 */
export const PRESALE_MESSAGE_TYPES: readonly string[] = [];

export function registerPresale(host: PresaleHost): void {}
````

Create `extension/src/presale-off/background.ts`:

````ts
import type {PresaleHost} from '../background/presaleHost';

/**
 * B1d §1.1: what `src/background/presale/api.ts` resolves to in the build without presale (scripts/presaleSwitch.mjs):
 * no message type — every `presale.*` message is refused as an unknown type — and nothing registered.
 */
export const PRESALE_MESSAGE_TYPES: readonly string[] = [];

export function registerPresale(host: PresaleHost): void {}
````

Create `extension/src/app/presale/index.ts`:

````ts
import type {PresaleRoute} from '../router';

/**
 * B1d §1.1: the popup's presale entry — the one module of `src/app/presale/` that shared code imports (the router takes
 * `presaleRoutes`). The build without presale resolves it to `src/presale-off/app.ts`. B1d-1a: no route and no slot;
 * B1d-1b adds #23's routes and the slots (#11 banner and Buy, the #31 row, the resume hook, the kind renderers).
 */
export const presaleRoutes: readonly PresaleRoute[] = [];
export const presaleSlots: null = null;
````

Create `extension/src/presale-off/app.ts`:

````ts
import type {PresaleRoute} from '../app/router';

/**
 * B1d §1.1: what `src/app/presale/index.ts` resolves to in the build without presale (scripts/presaleSwitch.mjs): no
 * presale route and no slot — no #11 banner, no Buy, no #31 row.
 */
export const presaleRoutes: readonly PresaleRoute[] = [];
export const presaleSlots: null = null;
````

Create `extension/src/unlock/presale.ts`:

````ts
/**
 * B1d §1.1: the vault page's presale entry — #10's description of a challenge whose kind is none of the shared ones
 * (challenge.ts `describeChallenge` asks it last). The build without presale resolves it to
 * `src/presale-off/unlock.ts`. B1d-1a: it describes nothing, so #10 shows such a challenge as one it cannot describe
 * (only Cancel); B1d-1b describes a `presale-buy` challenge here.
 */
export function describePresale(about: Readonly<Record<string, unknown>>): null {
  return null;
}
````

Create `extension/src/presale-off/unlock.ts`:

````ts
/**
 * B1d §1.1: what `src/unlock/presale.ts` resolves to in the build without presale (scripts/presaleSwitch.mjs): it
 * describes nothing — a challenge of any other kind is one #10 cannot describe (only Cancel).
 */
export function describePresale(about: Readonly<Record<string, unknown>>): null {
  return null;
}
````

Create `extension/vitest.nopresale.config.ts`:

````ts
import {defineConfig} from 'vite';
import {appConfig} from './vite.config';

/**
 * B1d §1.1, §6.1 "Switch, off build": the second vitest run of `npm run test` — vite.config.ts with NOCTURA_PRESALE=0,
 * so the presaleSwitch plugin resolves the three entries to their stubs and `__NOCTURA_PRESALE__` is false, exactly as
 * in `node scripts/build.mjs --no-presale`. It runs the named shared test files below (each must hold in both builds),
 * not the whole suite; `test.env` marks the run, so a test can tell which one it is in without trusting the constant.
 */
export const NOPRESALE_TESTS = [
  'src/__tests__/presaleSwitch.test.ts',
  'src/background/__tests__/messages.test.ts',
  'src/app/__tests__/router.test.ts',
  'src/app/__tests__/App.test.tsx',
  'src/unlock/__tests__/challenge.test.ts',
];

const base = appConfig({...process.env, NOCTURA_PRESALE: '0'});
export default defineConfig({...base, test: {...base.test, include: NOPRESALE_TESTS, env: {NOCTURA_PRESALE: '0'}}});
````

Create `core/solana/encoding.ts`:

````ts
import {Buffer} from 'buffer';
import {PublicKey} from '@solana/web3.js';

/**
 * Encoding helpers shared by every transaction builder in core/ — moved out of core/presale/buyInstructions.ts (which
 * re-exports all three, so its callers are unchanged), so that core/solana does not import presale code: the
 * extension's build without presale carries this module, never buyInstructions.ts (B1d §6.2, review M2).
 */

/** SPL Token and Associated Token program ids — constants, not imports, so core stays dependency-free. */
const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** The classic SPL Token program. */
export const SPL_TOKEN_PROGRAM = SPL_TOKEN_PROGRAM_ID.toBase58();

/**
 * Encode a u64 little-endian by hand.
 *
 * `buffer@5.7.1`, which React Native ships, has no `writeBigUInt64LE` — the tidy call
 * works under Jest on Node and throws on a device.
 */
export function encodeU64LE(value: bigint): Buffer {
  const MAX_U64 = 18_446_744_073_709_551_615n;
  if (value < 0n || value > MAX_U64) {
    throw new Error(`presale buy: lamports out of u64 range: ${value}`);
  }
  const buf = Buffer.alloc(8);
  let remaining = value;
  for (let i = 0; i < 8; i++) {
    buf.writeUInt8(Number(remaining & 0xffn), i);
    remaining >>= 8n;
  }
  return buf;
}

/**
 * Associated token address, derived by hand rather than with web3.js's
 * `getAssociatedTokenAddress`. Two reasons, and the second one bit the website: the
 * helper is async for no reason here, and it REFUSES an off-curve owner unless told
 * `allowOwnerOffCurve`. The treasury is a Squads PDA and therefore off-curve, so the
 * tidy call throws where this one simply works.
 */
export function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBytes(), SPL_TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    SPL_ATA_PROGRAM_ID,
  );
  return ata;
}
````

`core/`: the helpers move; `buyInstructions.ts` re-exports them (web, the app and core's own tests unchanged); core/solana imports nothing from core/presale but `addresses.ts`:

````diff
diff --git a/core/presale/buyInstructions.ts b/core/presale/buyInstructions.ts
index 17c093b..ec9abab 100644
--- a/core/presale/buyInstructions.ts
+++ b/core/presale/buyInstructions.ts
@@ -12,6 +12,10 @@ import {
   MAINNET_USDT_MINT,
 } from './addresses';
 import {derivePresalePdas} from './allocation';
+import {SPL_TOKEN_PROGRAM, encodeU64LE, findAssociatedTokenAddress} from '../solana/encoding';
+
+/** Moved to core/solana/encoding.ts (B1d §6.2); re-exported so the app, web and the tests keep these names. */
+export {SPL_TOKEN_PROGRAM, encodeU64LE, findAssociatedTokenAddress};
 
 const PROGRAM = new PublicKey(MAINNET_PROGRAM_ID);
 const PYTH = new PublicKey(PYTH_SOL_USD_ACCOUNT);
@@ -23,26 +27,6 @@ export const REGISTER_REFERRER_DISCRIMINATOR = [122, 229, 215, 169, 100, 145, 19
 
 export const COMPUTE_UNIT_LIMIT = 120_000;
 
-/**
- * Encode a u64 little-endian by hand.
- *
- * `buffer@5.7.1`, which React Native ships, has no `writeBigUInt64LE` — the tidy call
- * works under Jest on Node and throws on a device.
- */
-export function encodeU64LE(value: bigint): Buffer {
-  const MAX_U64 = 18_446_744_073_709_551_615n;
-  if (value < 0n || value > MAX_U64) {
-    throw new Error(`presale buy: lamports out of u64 range: ${value}`);
-  }
-  const buf = Buffer.alloc(8);
-  let remaining = value;
-  for (let i = 0; i < 8; i++) {
-    buf.writeUInt8(Number(remaining & 0xffn), i);
-    remaining >>= 8n;
-  }
-  return buf;
-}
-
 /**
  * Hand-build the `presale_purchase_with_sol(sol_amount)` instruction.
  *
@@ -129,24 +113,7 @@ export function estimateNocForSol(solAmount: number, solUsd: number, stagePriceU
 }
 
 
-/** SPL Token and Associated Token program ids — constants, not imports, so core stays dependency-free. */
-const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
-const SPL_ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
-
-/**
- * Associated token address, derived by hand rather than with web3.js's
- * `getAssociatedTokenAddress`. Two reasons, and the second one bit the website: the
- * helper is async for no reason here, and it REFUSES an off-curve owner unless told
- * `allowOwnerOffCurve`. The treasury is a Squads PDA and therefore off-curve, so the
- * tidy call throws where this one simply works.
- */
-export function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
-  const [ata] = PublicKey.findProgramAddressSync(
-    [owner.toBytes(), SPL_TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
-    SPL_ATA_PROGRAM_ID,
-  );
-  return ata;
-}
+const SPL_TOKEN_PROGRAM_ID = new PublicKey(SPL_TOKEN_PROGRAM);
 
 export type StablecoinToken = 'USDC' | 'USDT';
 
@@ -237,8 +204,5 @@ export function buildStablecoinBuyInstructions(
   ];
 }
 
-/** The SPL Token program, which a stablecoin purchase touches and a SOL one does not. */
-export const SPL_TOKEN_PROGRAM = SPL_TOKEN_PROGRAM_ID.toBase58();
-
 /** Base units per whole token: 9 for SOL, 6 for both stablecoins. */
 export const TOKEN_DECIMALS: Record<'SOL' | StablecoinToken, number> = {SOL: 9, USDC: 6, USDT: 6};
diff --git a/core/solana/balances.ts b/core/solana/balances.ts
index fc373a1..d9f0e23 100644
--- a/core/solana/balances.ts
+++ b/core/solana/balances.ts
@@ -1,8 +1,8 @@
 import type {SolanaReader} from './rpc';
 import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT, NOC_DECIMALS} from '../presale/addresses';
-import {SPL_TOKEN_PROGRAM} from '../presale/buyInstructions';
+import {SPL_TOKEN_PROGRAM} from './encoding';
 
-/** The classic SPL Token program — one literal, owned by core/presale/buyInstructions.ts. */
+/** The classic SPL Token program — one literal, owned by core/solana/encoding.ts. */
 export {SPL_TOKEN_PROGRAM};
 
 export type WalletToken = 'SOL' | 'NOC' | 'USDC' | 'USDT';
diff --git a/core/solana/history.ts b/core/solana/history.ts
index d12dfdf..870ccea 100644
--- a/core/solana/history.ts
+++ b/core/solana/history.ts
@@ -1,6 +1,6 @@
 import {PublicKey} from '@solana/web3.js';
 import {MAINNET_PROGRAM_ID} from '../presale/addresses';
-import {findAssociatedTokenAddress} from '../presale/buyInstructions';
+import {findAssociatedTokenAddress} from './encoding';
 import {MAINNET_FEE_TREASURY} from '../fees/transferMarkup';
 import {WALLET_TOKENS, tokenForMint, type WalletToken} from './balances';
 
diff --git a/core/solana/transfer.ts b/core/solana/transfer.ts
index 779bd90..8a344fd 100644
--- a/core/solana/transfer.ts
+++ b/core/solana/transfer.ts
@@ -1,6 +1,6 @@
 import {Buffer} from 'buffer';
 import {ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js';
-import {encodeU64LE, findAssociatedTokenAddress} from '../presale/buyInstructions';
+import {encodeU64LE, findAssociatedTokenAddress} from './encoding';
 
 /**
  * SOL and SPL transfer building, shared by the app and the extension (spec §4 "Moves into core/").
````

The two Vite configs become factories over one env (the object bodies re-indented, nothing else moved), the build takes `--no-presale`, and the scripts cover both builds:

````diff
diff --git a/extension/.gitignore b/extension/.gitignore
index f0a232b..e6ea34e 100644
--- a/extension/.gitignore
+++ b/extension/.gitignore
@@ -1,4 +1,5 @@
 node_modules/
 dist/
+dist-nopresale/
 test-results/
 playwright-report/
diff --git a/extension/package.json b/extension/package.json
index 18b7346..af4ccb5 100644
--- a/extension/package.json
+++ b/extension/package.json
@@ -6,14 +6,15 @@
     "node": ">=22.12.0"
   },
   "scripts": {
-    "build": "tsc --noEmit && node scripts/build.mjs",
-    "test": "vitest run",
+    "build": "tsc --noEmit && node scripts/build.mjs && node scripts/build.mjs --no-presale",
+    "test": "vitest run && vitest run --config vitest.nopresale.config.ts",
     "e2e": "playwright test",
-    "csp": "node scripts/check-csp.mjs dist/app",
-    "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox",
-    "gates": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs",
+    "csp": "node scripts/check-csp.mjs dist/app && node scripts/check-csp.mjs dist-nopresale/app",
+    "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && test -d dist-nopresale/app && test -d dist-nopresale/chrome && test -d dist-nopresale/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox dist-nopresale/app dist-nopresale/chrome dist-nopresale/firefox",
+    "gates": "npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build",
+    "gates:build": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs",
     "reproducible": "node scripts/verify-reproducible.mjs",
-    "verify": "rm -rf dist && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
+    "verify": "rm -rf dist dist-nopresale && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
   },
   "dependencies": {
     "@noble/curves": "^2.0.1",
diff --git a/extension/scripts/build.mjs b/extension/scripts/build.mjs
index 7f6589e..38663df 100644
--- a/extension/scripts/build.mjs
+++ b/extension/scripts/build.mjs
@@ -2,6 +2,11 @@
 // vite build once into dist/app, then one directory per browser: the same files plus that
 // browser's manifest. The JS is identical across browsers by construction, so a reviewer
 // comparing the two packages sees only the manifest differ.
+//
+// B1d §1.1: `node scripts/build.mjs [outDir] [--no-presale]`. --no-presale builds the extension without presale
+// (NOCTURA_PRESALE=0 for every vite build, scripts/presaleFlag.mjs), into dist-nopresale/ unless outDir is given; the
+// default is the build with it, into dist/. Either way <outDir>/app.features.json says which it is — next to
+// app.modules.json, never inside a package — for the gates that read the build.
 import {execFileSync} from 'node:child_process';
 import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
 import {dirname, join, resolve} from 'node:path';
@@ -9,13 +14,21 @@ import {fileURLToPath} from 'node:url';
 import {render} from '../manifest/source.mjs';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
-const outRoot = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'dist');
+const args = process.argv.slice(2);
+const presale = !args.includes('--no-presale');
+const dirs = args.filter(a => a !== '--no-presale');
+if (dirs.length > 1 || dirs.some(a => a.startsWith('-'))) throw new Error('usage: node scripts/build.mjs [outDir] [--no-presale]');
+const outRoot = dirs[0] ? resolve(dirs[0]) : join(ROOT, presale ? 'dist' : 'dist-nopresale');
 const app = join(outRoot, 'app');
+const env = {...process.env, NOCTURA_PRESALE: presale ? '1' : '0'};
+// Written last, removed first: a build that fails part-way leaves no claim about what it built.
+const features = join(outRoot, 'app.features.json');
+rmSync(features, {force: true});
 
-execFileSync('npx', ['vite', 'build', '--outDir', app, '--emptyOutDir'], {cwd: ROOT, stdio: 'inherit'});
+execFileSync('npx', ['vite', 'build', '--outDir', app, '--emptyOutDir'], {cwd: ROOT, stdio: 'inherit', env});
 // B1c §1.7: the two content scripts, each a classic script, into the same directory (vite.content.config.ts).
 for (const content of ['provider', 'relay']) {
-  execFileSync('npx', ['vite', 'build', '--config', 'vite.content.config.ts', '--outDir', app], {cwd: ROOT, stdio: 'inherit', env: {...process.env, NOCTURA_CONTENT: content}});
+  execFileSync('npx', ['vite', 'build', '--config', 'vite.content.config.ts', '--outDir', app], {cwd: ROOT, stdio: 'inherit', env: {...env, NOCTURA_CONTENT: content}});
 }
 
 for (const browser of ['chrome', 'firefox']) {
@@ -25,3 +38,4 @@ for (const browser of ['chrome', 'firefox']) {
   cpSync(app, dir, {recursive: true});
   writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(render(browser), null, 2)}\n`);
 }
+writeFileSync(features, `${JSON.stringify({presale})}\n`);
diff --git a/extension/scripts/verify-reproducible.mjs b/extension/scripts/verify-reproducible.mjs
index fad8fce..d258dc1 100644
--- a/extension/scripts/verify-reproducible.mjs
+++ b/extension/scripts/verify-reproducible.mjs
@@ -1,28 +1,32 @@
 #!/usr/bin/env node
-// Two full builds (both browsers) into temp dirs; each browser's digest must match.
+// Two full builds (both browsers) into temp dirs; each browser's digest must match. B1d §6.2 (review L10): for both
+// builds — with presale and without (--no-presale) — so four builds in all.
 import {mkdtempSync, rmSync} from 'node:fs';
 import {execFileSync} from 'node:child_process';
 import {tmpdir} from 'node:os';
 import {join} from 'node:path';
 import {buildManifest} from '../../web/scripts/build-manifest.mjs';
 
-const dirs = [mkdtempSync(join(tmpdir(), 'noctura-ext-a-')), mkdtempSync(join(tmpdir(), 'noctura-ext-b-'))];
-try {
-  for (const d of dirs) execFileSync('node', ['scripts/build.mjs', d], {stdio: 'inherit'});
-  let bad = 0;
-  for (const browser of ['chrome', 'firefox']) {
-    const [a, b] = dirs.map(d => buildManifest(join(d, browser)));
-    if (a.files.length === 0) {
-      console.error(`INCONCLUSIVE: ${browser} build is empty`);
-      process.exitCode = 2;
-      break;
+let bad = 0;
+for (const [variant, flags] of [['presale', []], ['no-presale', ['--no-presale']]]) {
+  const dirs = [mkdtempSync(join(tmpdir(), `noctura-ext-${variant}-a-`)), mkdtempSync(join(tmpdir(), `noctura-ext-${variant}-b-`))];
+  try {
+    for (const d of dirs) execFileSync('node', ['scripts/build.mjs', d, ...flags], {stdio: 'inherit'});
+    for (const browser of ['chrome', 'firefox']) {
+      const [a, b] = dirs.map(d => buildManifest(join(d, browser)));
+      if (a.files.length === 0) {
+        console.error(`INCONCLUSIVE: ${variant} ${browser} build is empty`);
+        process.exitCode = 2;
+        break;
+      }
+      if (a.digest !== b.digest) {
+        console.error(`NOT REPRODUCIBLE: ${variant} ${browser} sha256:${a.digest} vs sha256:${b.digest}`);
+        bad += 1;
+      } else console.log(`reproducible: ${variant} ${browser} ${a.files.length} files sha256:${a.digest}`);
     }
-    if (a.digest !== b.digest) {
-      console.error(`NOT REPRODUCIBLE: ${browser} sha256:${a.digest} vs sha256:${b.digest}`);
-      bad += 1;
-    } else console.log(`reproducible: ${browser} ${a.files.length} files sha256:${a.digest}`);
+  } finally {
+    for (const d of dirs) rmSync(d, {recursive: true, force: true});
   }
-  if (bad && !process.exitCode) process.exitCode = 1;
-} finally {
-  for (const d of dirs) rmSync(d, {recursive: true, force: true});
+  if (process.exitCode === 2) break;
 }
+if (bad && !process.exitCode) process.exitCode = 1;
diff --git a/extension/vite.config.ts b/extension/vite.config.ts
index ec6d081..3029a5e 100644
--- a/extension/vite.config.ts
+++ b/extension/vite.config.ts
@@ -4,6 +4,8 @@ import react from '@vitejs/plugin-react';
 import {writeFileSync} from 'node:fs';
 import {relative, resolve, sep} from 'node:path';
 import {isStylesheet, scanCss} from './scripts/css-scan.mjs';
+import {presaleFlag} from './scripts/presaleFlag.mjs';
+import {presaleSwitch} from './scripts/presaleSwitch.mjs';
 
 // core/ and web/src/ui/ are imported by relative path, and a bare import in one of their files would
 // otherwise resolve upwards from there — to web/node_modules or the repository root's node_modules
@@ -74,47 +76,58 @@ function chunkModules(write: boolean): Plugin {
   };
 }
 
-export default defineConfig({
-  base: './',
-  plugins: [sharedResolvesFromHere(), react(), chunkModules(true)],
-  server: {fs: {allow: [resolve(__dirname, '..')]}},
-  build: {
-    outDir: 'dist/app',
-    emptyOutDir: true,
-    target: 'es2022',
-    modulePreload: false,
-    rollupOptions: {
-      input: {
-        background: resolve(__dirname, 'src/background/index.ts'),
-        popup: resolve(__dirname, 'popup.html'),
-        wallet: resolve(__dirname, 'wallet.html'),
-        unlock: resolve(__dirname, 'unlock.html'),
-        // B1c §1.7: the approval window.
-        approve: resolve(__dirname, 'approve.html'),
-      },
-      output: {
-        // The manifest names background.js; a hash there would change the manifest.
-        entryFileNames: chunk => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
-        chunkFileNames: 'assets/[name]-[hash].js',
-        assetFileNames: 'assets/[name]-[hash][extname]',
+/**
+ * B1d §1.1: the build without presale is this config with NOCTURA_PRESALE=0 (scripts/build.mjs --no-presale); both
+ * mechanisms — the plugin and the constant — follow the one flag here, in the worker build too, exactly as in
+ * vite.content.config.ts (the parity test, scripts/__tests__/presaleSwitch.test.mjs, imports both factories).
+ */
+export function appConfig(env: Record<string, string | undefined>): UserConfig {
+  const presale = presaleFlag(env);
+  return {
+    base: './',
+    define: {__NOCTURA_PRESALE__: JSON.stringify(presale)},
+    plugins: [sharedResolvesFromHere(), presaleSwitch(presale), react(), chunkModules(true)],
+    server: {fs: {allow: [resolve(__dirname, '..')]}},
+    build: {
+      outDir: 'dist/app',
+      emptyOutDir: true,
+      target: 'es2022',
+      modulePreload: false,
+      rollupOptions: {
+        input: {
+          background: resolve(__dirname, 'src/background/index.ts'),
+          popup: resolve(__dirname, 'popup.html'),
+          wallet: resolve(__dirname, 'wallet.html'),
+          unlock: resolve(__dirname, 'unlock.html'),
+          // B1c §1.7: the approval window.
+          approve: resolve(__dirname, 'approve.html'),
+        },
+        output: {
+          // The manifest names background.js; a hash there would change the manifest.
+          entryFileNames: chunk => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
+          chunkFileNames: 'assets/[name]-[hash].js',
+          assetFileNames: 'assets/[name]-[hash][extname]',
+        },
       },
     },
-  },
-  worker: {format: 'es', plugins: () => [chunkModules(false)]},
-  test: {
-    // node by default; the component tests say `// @vitest-environment happy-dom` on their first line
-    // (vitest 5 has no environmentMatchGlobs).
-    environment: 'node',
-    globals: true,
-    include: [
-      'src/**/*.test.ts',
-      'src/**/*.test.tsx',
-      'manifest/**/*.test.mjs',
-      'scripts/**/*.test.mjs',
-      '../core/keys/**/*.test.ts',
-      '../core/solana/**/*.test.ts',
-      '../core/fees/**/*.test.ts',
-      '../core/portfolio/**/*.test.ts',
-    ],
-  },
-} as UserConfig);
+    worker: {format: 'es', plugins: () => [presaleSwitch(presale), chunkModules(false)]},
+    test: {
+      // node by default; the component tests say `// @vitest-environment happy-dom` on their first line
+      // (vitest 5 has no environmentMatchGlobs).
+      environment: 'node',
+      globals: true,
+      include: [
+        'src/**/*.test.ts',
+        'src/**/*.test.tsx',
+        'manifest/**/*.test.mjs',
+        'scripts/**/*.test.mjs',
+        '../core/keys/**/*.test.ts',
+        '../core/solana/**/*.test.ts',
+        '../core/fees/**/*.test.ts',
+        '../core/portfolio/**/*.test.ts',
+      ],
+    },
+  };
+}
+
+export default defineConfig(appConfig(process.env));
diff --git a/extension/vite.content.config.ts b/extension/vite.content.config.ts
index 55e8794..389f470 100644
--- a/extension/vite.content.config.ts
+++ b/extension/vite.content.config.ts
@@ -1,6 +1,8 @@
-import {defineConfig, type Plugin} from 'vite';
+import {defineConfig, type Plugin, type UserConfig} from 'vite';
 import {writeFileSync} from 'node:fs';
 import {relative, resolve, sep} from 'node:path';
+import {presaleFlag} from './scripts/presaleFlag.mjs';
+import {presaleSwitch} from './scripts/presaleSwitch.mjs';
 
 /**
  * B1c §1.7: the two content scripts, built one at a time as classic scripts (an IIFE — a content script cannot be an
@@ -9,9 +11,6 @@ import {relative, resolve, sep} from 'node:path';
  * (`dist/app.<name>.modules.json`), for the page-bundle gate (scripts/check-page-bundles.mjs): a content script runs in
  * every page, so it may carry only its own sources and @wallet-standard.
  */
-const NAME = process.env.NOCTURA_CONTENT;
-if (NAME !== 'provider' && NAME !== 'relay') throw new Error('NOCTURA_CONTENT must be provider or relay');
-
 const moduleId = (id: string) => (id.startsWith('\0') ? id : relative(__dirname, id).split(sep).join('/'));
 function contentModules(name: string): Plugin {
   const chunks = new Map<string, string[]>();
@@ -28,16 +27,28 @@ function contentModules(name: string): Plugin {
   };
 }
 
-export default defineConfig({
-  base: './',
-  publicDir: false,
-  plugins: [contentModules(NAME)],
-  build: {
-    outDir: 'dist/app',
-    emptyOutDir: false,
-    target: 'es2022',
-    modulePreload: false,
-    copyPublicDir: false,
-    lib: {entry: resolve(__dirname, `src/${NAME}/index.ts`), formats: ['iife'], name: `noctura_${NAME}`, fileName: () => `${NAME}.js`},
-  },
-});
+/**
+ * B1d §1.1: the same flag, the same two mechanisms as vite.config.ts — a content script imports no presale entry
+ * today, and the parity test (scripts/__tests__/presaleSwitch.test.mjs) keeps it so should one ever do.
+ */
+export function contentConfig(env: Record<string, string | undefined>): UserConfig {
+  const name = env.NOCTURA_CONTENT;
+  if (name !== 'provider' && name !== 'relay') throw new Error('NOCTURA_CONTENT must be provider or relay');
+  const presale = presaleFlag(env);
+  return {
+    base: './',
+    publicDir: false,
+    define: {__NOCTURA_PRESALE__: JSON.stringify(presale)},
+    plugins: [presaleSwitch(presale), contentModules(name)],
+    build: {
+      outDir: 'dist/app',
+      emptyOutDir: false,
+      target: 'es2022',
+      modulePreload: false,
+      copyPublicDir: false,
+      lib: {entry: resolve(__dirname, `src/${name}/index.ts`), formats: ['iife'], name: `noctura_${name}`, fileName: () => `${name}.js`},
+    },
+  };
+}
+
+export default defineConfig(() => contentConfig(process.env));
````

The gates read the build `NOCTURA_DIST` names (and say which in their ok line); the vault page may carry its own stub; `dist-nopresale/` is not source:

````diff
diff --git a/extension/scripts/check-fonts.mjs b/extension/scripts/check-fonts.mjs
index 941f345..4ab040d 100644
--- a/extension/scripts/check-fonts.mjs
+++ b/extension/scripts/check-fonts.mjs
@@ -11,6 +11,7 @@
 import {existsSync, readdirSync, readFileSync} from 'node:fs';
 import {dirname, join, posix, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
+import {distDir} from './distDir.mjs';
 
 export const FONTS = ['Geist-Variable.woff2', 'GeistMono-Variable.woff2'];
 
@@ -66,11 +67,12 @@ export function vaultPageFontViolations(distApp) {
 }
 
 if (import.meta.url === `file://${process.argv[1]}`) {
-  const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist', 'app');
+  const DIST = distDir();
+  const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), DIST, 'app');
   const problems = [...fontViolations(dist), ...vaultPageFontViolations(dist)];
   if (problems.length > 0) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log('fonts ok: both Geist files are in dist/app/fonts, every font URL in the CSS resolves there, and the vault page loads Geist');
+  console.log(`fonts ok: both Geist files are in ${DIST}/app/fonts, every font URL in the CSS resolves there, and the vault page loads Geist`);
 }
diff --git a/extension/scripts/check-no-tge-date.mjs b/extension/scripts/check-no-tge-date.mjs
index 8f4b334..38dceb0 100644
--- a/extension/scripts/check-no-tge-date.mjs
+++ b/extension/scripts/check-no-tge-date.mjs
@@ -9,6 +9,7 @@
 import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
 import {dirname, join, relative, resolve, sep} from 'node:path';
 import {fileURLToPath} from 'node:url';
+import {distDir} from './distDir.mjs';
 
 const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
 
@@ -82,8 +83,9 @@ export function listScanned(root) {
 
 if (import.meta.url === `file://${process.argv[1]}`) {
   const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
-  if (!existsSync(join(ROOT, 'dist', 'app'))) {
-    console.error('INCONCLUSIVE: dist/app does not exist — build first, or the built files go unchecked');
+  const DIST = distDir();
+  if (!existsSync(join(ROOT, DIST, 'app'))) {
+    console.error(`INCONCLUSIVE: ${DIST}/app does not exist — build first, or the built files go unchecked`);
     process.exit(1);
   }
   const files = listScanned(ROOT).map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')}));
@@ -92,5 +94,5 @@ if (import.meta.url === `file://${process.argv[1]}`) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log(`no TGE date: ${files.length} source and built files checked`);
+  console.log(`no TGE date (${DIST} present): ${files.length} source and built files checked`);
 }
diff --git a/extension/scripts/check-page-bundles.mjs b/extension/scripts/check-page-bundles.mjs
index b8db8f8..a10b862 100644
--- a/extension/scripts/check-page-bundles.mjs
+++ b/extension/scripts/check-page-bundles.mjs
@@ -12,6 +12,7 @@
 import {existsSync, readFileSync} from 'node:fs';
 import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
+import {distDir} from './distDir.mjs';
 
 export const CONTENT = {
   provider: {own: 'src/provider/', packages: ['@wallet-standard/wallet', '@wallet-standard/base']},
@@ -55,21 +56,22 @@ export function devOriginViolations(backgroundJs) {
 
 if (import.meta.url === `file://${process.argv[1]}`) {
   const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
+  const DIST = distDir();
   const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : undefined);
   const problems = [];
   for (const name of Object.keys(CONTENT)) {
-    const map = read(join(ROOT, 'dist', `app.${name}.modules.json`));
+    const map = read(join(ROOT, DIST, `app.${name}.modules.json`));
     problems.push(...pageBundleViolations(name, map === undefined ? undefined : JSON.parse(map)));
-    const app = read(join(ROOT, 'dist', 'app', `${name}.js`));
+    const app = read(join(ROOT, DIST, 'app', `${name}.js`));
     problems.push(...classicScriptViolations(name, app));
     for (const browser of ['chrome', 'firefox']) {
-      if (read(join(ROOT, 'dist', browser, `${name}.js`)) !== app) problems.push(`dist/${browser}/${name}.js differs from dist/app/${name}.js`);
+      if (read(join(ROOT, DIST, browser, `${name}.js`)) !== app) problems.push(`${DIST}/${browser}/${name}.js differs from ${DIST}/app/${name}.js`);
     }
   }
-  for (const d of ['app', 'chrome', 'firefox']) problems.push(...devOriginViolations(read(join(ROOT, 'dist', d, 'background.js'))).map(p => `dist/${d}: ${p}`));
+  for (const d of ['app', 'chrome', 'firefox']) problems.push(...devOriginViolations(read(join(ROOT, DIST, d, 'background.js'))).map(p => `${DIST}/${d}: ${p}`));
   if (problems.length > 0) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log('page bundles ok: provider.js carries only src/provider and @wallet-standard, relay.js only src/relay; both classic scripts; background.js accepts no development origin');
+  console.log(`page bundles ok (${DIST}): provider.js carries only src/provider and @wallet-standard, relay.js only src/relay; both classic scripts; background.js accepts no development origin`);
 }
diff --git a/extension/scripts/check-permissions.mjs b/extension/scripts/check-permissions.mjs
index d932495..2f12549 100644
--- a/extension/scripts/check-permissions.mjs
+++ b/extension/scripts/check-permissions.mjs
@@ -11,6 +11,7 @@
 // purpose, same pattern as check-rpc-methods.mjs's SPEC_ALLOWED against core/solana/rpc.ts's list.
 import {readFileSync} from 'node:fs';
 import {join} from 'node:path';
+import {distDir} from './distDir.mjs';
 import {PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION} from '../manifest/source.mjs';
 
 // The one host anything in the extension ever fetches (extension/src/background/deps.ts — RPC
@@ -109,14 +110,15 @@ export function comparePermissions(manifest, browser) {
 }
 
 if (import.meta.url === `file://${process.argv[1]}`) {
+  const DIST = distDir();
   let bad = 0;
   for (const browser of ['chrome', 'firefox']) {
-    const m = JSON.parse(readFileSync(join('dist', browser, 'manifest.json'), 'utf8'));
+    const m = JSON.parse(readFileSync(join(DIST, browser, 'manifest.json'), 'utf8'));
     for (const p of comparePermissions(m, browser)) {
       console.error(`${browser}: ${p}`);
       bad += 1;
     }
   }
   if (bad) process.exit(1);
-  console.log('permissions ok: both manifests match manifest/source.mjs');
+  console.log(`permissions ok (${DIST}): both manifests match manifest/source.mjs`);
 }
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
index 28aa342..7bfef64 100644
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -38,6 +38,7 @@ import {dirname, join, posix, relative, resolve, sep} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import ts from 'typescript';
 import {isStylesheet, scanCss} from './css-scan.mjs';
+import {DIST_DIRS, distDir} from './distDir.mjs';
 
 const VAULT_ALLOWED = /^src\/(unlock|vault)\//;
 // The vault page's own modules (unlockFlow, orchestrate, main) hold the seed while they run:
@@ -45,10 +46,10 @@ const VAULT_ALLOWED = /^src\/(unlock|vault)\//;
 const UNLOCK_ALLOWED = /^src\/unlock\//;
 // The one entry each HTML page at the package root may load.
 export const ENTRIES = {'popup.html': 'src/app/popup.tsx', 'wallet.html': 'src/app/tab.tsx', 'unlock.html': 'src/unlock/main.ts', 'approve.html': 'src/approve/main.tsx'};
-// node_modules/, dist/, e2e/ and scripts/ are skipped only at the package ROOT — a nested
-// src/popup/scripts/ is ordinary source a page can bundle, not this package's own tooling.
+// node_modules/, both builds' dist/ and dist-nopresale/ (B1d §1.1), e2e/ and scripts/ are skipped only at the package
+// ROOT — a nested src/popup/scripts/ is ordinary source a page can bundle, not this package's own tooling.
 // __tests__/ is skipped at any depth (never bundled, wherever it sits). See the header.
-const SKIP_DIRS_ROOT = new Set(['node_modules', 'dist', 'e2e', 'scripts']);
+const SKIP_DIRS_ROOT = new Set(['node_modules', ...DIST_DIRS, 'e2e', 'scripts']);
 // Every extension a source file under the package can have: .ts/.tsx/.js/.jsx/.mjs/.cjs/.mts/.cts.
 const SOURCE_EXT = /\.[cm]?[jt]sx?$/;
 // The seed code the vault uses also lives in ../core/keys (mnemonic → seed, SLIP-0010), shared
@@ -470,6 +471,8 @@ const VAULT_PAGE_FILES = [
   /^src\/vault\//,
   /^src\/shared\//,
   /^src\/ui\/send\.ts$/,
+  // B1d §1.1: in the build without presale, src/unlock/presale.ts (vault-page code, above) resolves to this stub.
+  /^src\/presale-off\/unlock\.ts$/,
   /^\.\.\/core\/keys\//,
   /^\.\.\/core\/util\//,
 ];
@@ -1228,33 +1231,34 @@ if (import.meta.url === `file://${process.argv[1]}`) {
     const abs = join(ROOT, rel);
     return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : undefined;
   };
+  const DIST = distDir();
   const problems = [...sourceViolations(files), ...htmlViolations(pages), ...vaultPageViolations(readRel, rel => readRel(rel) !== undefined)];
   for (const d of ['app', 'chrome', 'firefox']) {
-    for (const p of bundleViolations(join(ROOT, 'dist', d))) problems.push(`dist/${d}: ${p}`);
+    for (const p of bundleViolations(join(ROOT, DIST, d))) problems.push(`${DIST}/${d}: ${p}`);
   }
   // dist/chrome and dist/firefox are copies of dist/app (scripts/build.mjs): one module map covers all three.
-  const mapPath = join(ROOT, 'dist', 'app.modules.json');
+  const mapPath = join(ROOT, DIST, 'app.modules.json');
   const modules = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : undefined;
-  for (const p of vaultPageModuleViolations(join(ROOT, 'dist', 'app'), modules)) problems.push(`dist/app: ${p}`);
-  for (const p of nonVaultModuleViolations(join(ROOT, 'dist', 'app'), modules)) problems.push(`dist/app: ${p}`);
+  for (const p of vaultPageModuleViolations(join(ROOT, DIST, 'app'), modules)) problems.push(`${DIST}/app: ${p}`);
+  for (const p of nonVaultModuleViolations(join(ROOT, DIST, 'app'), modules)) problems.push(`${DIST}/app: ${p}`);
   // Module ids are package-relative (vite.config.ts's moduleId), or absolute: both resolve against ROOT.
   const readSource = path => {
     const abs = resolve(ROOT, path);
     return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : undefined;
   };
-  for (const p of bundledWebAuthnViolations(join(ROOT, 'dist', 'app'), modules, readSource)) problems.push(`dist/app: ${p}`);
+  for (const p of bundledWebAuthnViolations(join(ROOT, DIST, 'app'), modules, readSource)) problems.push(`${DIST}/app: ${p}`);
   // ../core is bundled into the popup and the background: the WebAuthn rule reads it too (no core file is vault code).
   const CORE = resolve(ROOT, '..', 'core');
   const coreFiles = listSourceFiles(CORE).map(path => ({path: `../core/${path}`, text: readFileSync(join(CORE, path), 'utf8')}));
   if (coreFiles.length === 0) problems.push('INCONCLUSIVE: no ../core source file was read — the WebAuthn rule would pass trivially there');
   problems.push(...webAuthnViolations(coreFiles));
   for (const browser of ['chrome', 'firefox']) {
-    const m = JSON.parse(readFileSync(join(ROOT, 'dist', browser, 'manifest.json'), 'utf8'));
-    for (const p of manifestViolations(m)) problems.push(`dist/${browser}/manifest.json: ${p}`);
+    const m = JSON.parse(readFileSync(join(ROOT, DIST, browser, 'manifest.json'), 'utf8'));
+    for (const p of manifestViolations(m)) problems.push(`${DIST}/${browser}/manifest.json: ${p}`);
   }
   if (problems.length) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log('vault isolation ok: sources, built popup/background and both manifests carry no path to the vault; no chunk outside the vault page carries src/vault, src/unlock or core/keys, and no module bundled outside it reads WebAuthn (module map); no page reaches storage.session; every module bundled into the vault page is vault-page code or one of its five packages, and its stylesheets are the three named sheets, importing nothing and loading only the Geist faces; its HTML carries no inline CSS and links only its built sheets, and its code builds no CSS at run time');
+  console.log(`vault isolation ok (${DIST}): sources, built popup/background and both manifests carry no path to the vault; no chunk outside the vault page carries src/vault, src/unlock or core/keys, and no module bundled outside it reads WebAuthn (module map); no page reaches storage.session; every module bundled into the vault page is vault-page code or one of its five packages, and its stylesheets are the three named sheets, importing nothing and loading only the Geist faces; its HTML carries no inline CSS and links only its built sheets, and its code builds no CSS at run time`);
 }
````

Shared code imports the three entries unconditionally:

````diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index d8cc048..d11428d 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -2,6 +2,7 @@ import type {Tab} from './ui/TabBar';
 import type {Surface} from './WalletContext';
 import type {Intent} from './engine';
 import {isDraft, isIntent, type Draft} from './send/rules';
+import {presaleRoutes} from './presale';
 
 /**
  * In-memory navigation (spec §1.6): a stack of routes in a reducer — push, pop, replace, reset, back to a
@@ -41,6 +42,15 @@ export type Route =
   | {screen: 'created'}
   | {screen: 'imported'}
   | {screen: 'resume'; account: string};
+/**
+ * B1d §1.1: a route the presale entry adds (src/app/presale/index.ts — none in B1d-1a, none in the build without
+ * presale). Its screen is outside the closed list below, and its own validator decides it: exactly its keys, each one
+ * checked. It can only add a screen — a name the list already holds is decided by the list, never by it.
+ */
+export interface PresaleRoute {
+  screen: string;
+  isRoute(o: Readonly<Record<string, unknown>>): boolean;
+}
 export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};
 
 export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status', 'security', 'accounts', 'passkey', 'delete', 'contacts', 'connected']);
@@ -61,7 +71,8 @@ const only = (o: Record<string, unknown>, keys: string[]): boolean => Object.key
 function isRoute(r: unknown): r is Route {
   if (typeof r !== 'object' || r === null) return false;
   const o = r as Record<string, unknown>;
-  if (typeof o.screen !== 'string' || !SCREENS.has(o.screen)) return false;
+  if (typeof o.screen !== 'string') return false;
+  if (!SCREENS.has(o.screen)) return presaleRoutes.some(p => p.screen === o.screen && p.isRoute(o));
   if (o.screen === 'tab') return typeof o.tab === 'string' && TABS.has(o.tab);
   if (BARE.has(o.screen)) return only(o, ['screen']);
   if (o.screen === 'contacts') return only(o, ['screen', 'pick']) && typeof o.pick === 'boolean';
diff --git a/extension/src/background/index.ts b/extension/src/background/index.ts
index 4603e38..2b4e717 100644
--- a/extension/src/background/index.ts
+++ b/extension/src/background/index.ts
@@ -8,6 +8,7 @@ import {acceptPagePort} from './dapp/pageApi';
 import {QUEUE_ALARM} from './dapp/queue';
 import {onApprovalWindowRemoved, onQueueAlarm} from './dapp/window';
 import type {PortLike} from './dapp/ports';
+import {registerPresale} from './presale/api';
 
 interface BgApi {
   runtime: {
@@ -32,6 +33,8 @@ const deps = browserDeps(ext);
 // Firefox). Caught, not left to reject unhandled — a browser that refuses the call must not
 // stop the listeners below from registering.
 void ext.pinSessionAccess().catch(e => console.warn('storage.session access level not pinned', e));
+// B1d §1.1: presale joins here, before any listener can deliver a message (the stub in the build without it).
+registerPresale({ext, deps});
 
 api.runtime.onMessage.addListener((msg, sender, reply) => {
   handleMessage(ext, msg, sender, deps).then(reply, () => reply({ok: false, error: 'internal'}));
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index 5800760..7feb3f4 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -16,6 +16,7 @@ import {decide, decideRequestOf, pending} from './dapp/decide';
 import {runUnlockHook} from './dapp/queue';
 import {dropAccountGrants, listBlocked, listGrants, revokeAll, revokeGrant, undoRevoke, unblock} from './dapp/grantsApi';
 import {reauthWaiting} from './dapp/signTx';
+import {PRESALE_MESSAGE_TYPES} from './presale/api';
 
 /** What the browser reports about a message's origin (runtime.MessageSender). */
 export interface Sender {
@@ -60,6 +61,8 @@ export const PRIVILEGED = [
   'dapp.blocked.remove',
   // B1c-2 (D11): the popup's offer of #10 for a site's transaction.
   'dapp.reauth',
+  // B1d §1.4: the presale entry's (none in the build without presale, none in B1d-1a).
+  ...PRESALE_MESSAGE_TYPES,
 ] as const;
 /**
  * Only the vault page itself may hand over keys, report a re-authentication it proved, hand over
diff --git a/extension/src/unlock/challenge.ts b/extension/src/unlock/challenge.ts
index 10efc2d..a7d404e 100644
--- a/extension/src/unlock/challenge.ts
+++ b/extension/src/unlock/challenge.ts
@@ -1,6 +1,7 @@
 import {formatAmount} from '../shared/amount';
 import {SITE} from '../shared/site';
 import {REAUTH} from './strings';
+import {describePresale} from './presale';
 import type {Send} from './types';
 
 /**
@@ -223,7 +224,7 @@ export function describeChallenge(about: unknown): Description | null {
   if (a.kind === 'send') return describeSend(a);
   if (a.kind === 'settings') return describeSettings(a);
   if (a.kind === 'dapp') return describeDapp(a);
-  return null;
+  return describePresale(a);
 }
 
 export type ChallengeRead =
````

E2E: another build can be launched:

````diff
diff --git a/extension/e2e/launch.ts b/extension/e2e/launch.ts
index 83748e9..08251f4 100644
--- a/extension/e2e/launch.ts
+++ b/extension/e2e/launch.ts
@@ -6,6 +6,8 @@ import {join} from 'node:path';
 
 // The package is an ES module ("type": "module"), where __dirname does not exist.
 export const EXT = fileURLToPath(new URL('../dist/chrome', import.meta.url));
+/** B1d §1.1: the build without presale (`node scripts/build.mjs --no-presale`). */
+export const EXT_NOPRESALE = fileURLToPath(new URL('../dist-nopresale/chrome', import.meta.url));
 
 /**
  * The safety net under any ctx.route: every noc-tura.io name fails to resolve inside this
@@ -53,18 +55,19 @@ export async function containNocTura(ctx: BrowserContext): Promise<{hits: string
 /**
  * Chromium with the built extension loaded and noc-tura.io and solscan.io unresolvable, in a fresh profile. B1c: `hosts`
  * adds more names to the same resolver map (the test dApp's hosts, e2e/dappPage.ts DAPP_HOSTS) — each answered by a
- * route, and unresolvable should a request slip past it.
+ * route, and unresolvable should a request slip past it. B1d: `ext` loads another build (EXT_NOPRESALE); EXT by default.
  */
-export async function launchContained(profilePrefix: string, o: {hosts?: readonly string[]} = {}): Promise<{ctx: BrowserContext; profile: string}> {
+export async function launchContained(profilePrefix: string, o: {hosts?: readonly string[]; ext?: string} = {}): Promise<{ctx: BrowserContext; profile: string}> {
   const profile = mkdtempSync(join(tmpdir(), profilePrefix));
   const extra = (o.hosts ?? []).map(h => `, MAP ${h} ~NOTFOUND`).join('');
+  const ext = o.ext ?? EXT;
   const ctx = await chromium.launchPersistentContext(profile, {
     // The default headless browser is chrome-headless-shell, which does not load extensions
     // (the service worker never starts). channel 'chromium' is Playwright's full Chromium build
     // in new headless mode, which does.
     channel: 'chromium',
     headless: true,
-    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `${HOST_RESOLVER_RULES}${extra}`],
+    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `${HOST_RESOLVER_RULES}${extra}`],
   });
   return {ctx, profile};
 }
diff --git a/extension/e2e/popupHarness.ts b/extension/e2e/popupHarness.ts
index 8edfc2e..349d73c 100644
--- a/extension/e2e/popupHarness.ts
+++ b/extension/e2e/popupHarness.ts
@@ -53,7 +53,7 @@ export interface Harness {
 }
 
 /** The contained browser (noc-tura.io and solscan.io unresolvable, both routed), the fake, a popup opener at 412 × 600. */
-export async function launchPopup(prefix: string, o: {hosts?: readonly string[]} = {}): Promise<Harness> {
+export async function launchPopup(prefix: string, o: {hosts?: readonly string[]; ext?: string} = {}): Promise<Harness> {
   const {ctx, profile} = await launchContained(prefix, o);
   // First, so the fake's own route (registered after it, so run before it) answers api.noc-tura.io.
   const nocTura = await containNocTura(ctx);
````

- [ ] **Step 4: Run — green, and the whole suite, both builds, the gates, the E2E.**

Run: the Step 2 command — expected: `Test Files  6 passed (6)` · `Tests  455 passed (455)` (presaleSwitch.test.mjs 15, presaleBuilds.test.mjs 11, src presaleSwitch.test.ts 3, check-vault-isolation.test.mjs 420, encoding.test.ts 4, routerPresale.test.ts 2).

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected `Test Files  179 passed (179)` · `Tests  3498 passed (3498)` (previous tree: 174 / 3460; +5 files, +38 tests). `npx vitest run --config vitest.nopresale.config.ts` — expected `Test Files  5 passed (5)` · `Tests  120 passed (120)`, and its `presaleSwitch.test.ts` reports “the build-time switch in this run (off)” (`--reporter=verbose`). Together: `npm run test`.

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale` (or `npm run build`) — `dist/app.features.json` = `{"presale":true}`, `dist-nopresale/app.features.json` = `{"presale":false}`. `npm run gates` — every gate ok twice, once per build (`permissions ok (dist)…`, `… (dist-nopresale)…`; rpc methods and classes read sources and print the same line twice). `npm run csp` and `npm run secrets` — ok for both. `npm run reproducible` — four lines `reproducible: presale|no-presale chrome|firefox 26 files sha256:…` (in 1a the presale and no-presale digests are equal, see above).

Run: `npx playwright test e2e/presaleSwitch.spec.ts` — `2 passed`; under `unshare -rn` with `containment.spec.ts` — `4 passed`. The whole Playwright suite (`npx playwright test`): `75 passed` (73 + the two new; launch's default is unchanged).

This task touches `core/` (the move): `cd ../web && npm run verify` — green (`Test Files  44 passed (44)` · `Tests  554 passed (554)`, the bundle test, reproducible); from the repository root `npx tsc --noEmit; echo $?` → `0` and `npx jest` → `Test Suites: 1 skipped, 180 passed` · `Tests: 1 skipped, 1234 passed, 1235 total`. **The dry run's first root jest run had one red test that is not this task's** — `src/screens/__tests__/PresaleActive.test.tsx` “PresaleActive — geo gate › blocks the buy CTA and routes to GeoBlocked when sanctioned”, `Exceeded timeout of 5000 ms` (the app's geo gate UI; it mocks `checkJurisdiction` and touches no moved helper); green alone (12 passed) and in the second full run. Recorded as a finding (Writer notes), not papered over. `node scripts/check-no-tge-date.mjs` (repository root) — `no TGE date in 1252 tracked text files`.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy (`extension/node_modules` COPIED — the build test reads module maps; root and web linked), `timeout 300`; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | named test → observed |
|---|---|---|
| M1a | `presaleSwitch.mjs` resolveId: `if (resolved.id.includes('/background/presale/')) return null;` before the map lookup (one mapping dropped) | presaleSwitch.test.mjs “off: resolves each entry…”; presaleBuilds.test.mjs “off: src/background/presale/api.ts is replaced…”, “off: no module under a presale directory at all” — tsc 0 · vitest: RED Test Files  2 failed (2) · Tests  4 failed \| 22 passed (26) — first: “scripts/__tests__/presaleBuilds.test.mjs > the two builds > off: src/background/presale/api.ts is replaced by src/presale-off/background.ts…” |
| M1b | `vite.config.ts`: `presaleSwitch(presale)` → `presaleSwitch(true)` in `plugins` (the plugin off in the app build) | presaleBuilds.test.mjs (the three “off: … replaced” rows, “no module under a presale directory”); presaleSwitch.test.mjs parity row `'0'`; in vitest.nopresale `src/__tests__/presaleSwitch.test.ts` “each entry resolved to its stub” — tsc 0 · vitest: RED Test Files  2 failed (2) · Tests  6 failed \| 20 passed (26) — first: “scripts/__tests__/presaleBuilds.test.mjs > the two builds > off: src/background/presale/api.ts is replaced by src/presale-off/background.ts…” · vitest.nopresale: RED Test Files  1 failed (1) · Tests  1 failed \| 2 passed (3) — first: “src/__tests__/presaleSwitch.test.ts > the build-time switch in this run (off) > each entry resolved to its stub…” |
| M1c | `presaleSwitch.mjs`: `stubs.get(resolved.id.replace(/[?#].*$/, ''))` → `stubs.get(resolved.id)` (a query or hash bypasses the switch) | presaleSwitch.test.mjs “off: resolves each entry to its stub, with or without a query or hash…” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 14 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > presaleSwitch > off: resolves each entry to its stub, with or without a query or hash, and nothing else…” |
| M1d | `vite.content.config.ts`: the `define` line deleted (review L11's named mutation) | presaleSwitch.test.mjs the three parity rows — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  3 failed \| 12 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > both configs read the same flag (review L11) > NOCTURA_PRESALE unset: the same define and the same plugin m…” |
| M1e | `vite.config.ts`: the `define` line deleted | presaleSwitch.test.mjs the parity rows + the nopresale-config row; vitest.nopresale `__NOCTURA_PRESALE__ is false` (ReferenceError) — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  4 failed \| 11 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > both configs read the same flag (review L11) > NOCTURA_PRESALE unset: the same define and the same plugin m…” · vitest.nopresale: RED Test Files  1 failed (1) · Tests  1 failed \| 2 passed (3) — first: “src/__tests__/presaleSwitch.test.ts > the build-time switch in this run (off) > __NOCTURA_PRESALE__ is false…” |
| M1f | `vite.config.ts` worker: `[presaleSwitch(presale), chunkModules(false)]` → `[chunkModules(false)]` | presaleSwitch.test.mjs the three parity rows — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  3 failed \| 12 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > both configs read the same flag (review L11) > NOCTURA_PRESALE unset: the same define and the same plugin m…” |
| M1g | `presaleFlag.mjs`: the `'0'` branch and the throw → `return v !== '0';` (anything else reads as on) | presaleSwitch.test.mjs “throws on anything else…”, “a bad flag fails both configs…” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  2 failed \| 13 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > presaleFlag > throws on anything else — a typo never picks a build…” |
| M1h | `presaleSwitch.mjs`: the missing-stub `throw` deleted | presaleSwitch.test.mjs “throws on a flag that is not a boolean, and on a missing stub (naming it)” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 14 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > presaleSwitch > throws on a flag that is not a boolean, and on a missing stub (naming it)…” |
| M1i | `presaleSwitch.mjs`: the non-boolean `throw` deleted | the same test — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 14 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > presaleSwitch > throws on a flag that is not a boolean, and on a missing stub (naming it)…” |
| M1j | `build.mjs`: `NOCTURA_PRESALE: presale ? '1' : '0'` → `NOCTURA_PRESALE: '1'` (`--no-presale` only relabels) | presaleBuilds.test.mjs the three “off: … replaced” rows and “no module under a presale directory” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  4 failed \| 7 passed (11) — first: “scripts/__tests__/presaleBuilds.test.mjs > the two builds > off: src/background/presale/api.ts is replaced by src/presale-off/background.ts…” |
| M1k | `build.mjs`: `join(outRoot, 'app.features.json')` → `join(app, 'app.features.json')` (the features file inside the package) | presaleBuilds.test.mjs — its `beforeAll` cannot read `<dir>/app.features.json`: the file fails, all 11 skipped (red by the file, not by one assertion) — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  11 skipped (11) — first: “scripts/__tests__/presaleBuilds.test.mjs [ scripts/__tests__/presaleBuilds.test.mjs ]…” |
| M1l | `core/solana/transfer.ts` imports `encodeU64LE, findAssociatedTokenAddress` from `../presale/buyInstructions` again | presaleBuilds.test.mjs “both: the moved helpers come from core/solana/encoding.ts, and core/presale/buyInstructions.ts is in neither (M2)” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 10 passed (11) — first: “scripts/__tests__/presaleBuilds.test.mjs > the two builds > both: the moved helpers come from core/solana/encoding.ts, and core/presale/buyInstruction…” |
| M1m | `core/solana/balances.ts` imports `SPL_TOKEN_PROGRAM` from `../presale/buyInstructions` again (the third symbol the spec did not name) | the same test — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 10 passed (11) — first: “scripts/__tests__/presaleBuilds.test.mjs > the two builds > both: the moved helpers come from core/solana/encoding.ts, and core/presale/buyInstruction…” |
| M1n | `buyInstructions.ts`: `encodeU64LE` re-declared as a wrapper (`export const encodeU64LE = (value: bigint): Buffer => encodeU64LEShared(value);`, the import aliased) instead of re-exported | encoding.test.ts “the old names re-export the same bindings…” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 3 passed (4) — first: “../core/solana/__tests__/encoding.test.ts > core/solana/encoding.ts > the old names re-export the same bindings: buyInstructions, transfer and balance…” |
| M1o | `check-vault-isolation.mjs`: the `src/presale-off/unlock.ts` row of `VAULT_PAGE_FILES` deleted | check-vault-isolation.test.mjs “B1d §1.1: the vault-page stub of the off build … is vault-page code…” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 419 passed (420) — first: “scripts/__tests__/check-vault-isolation.test.mjs > vault isolation (built output) > B1d §1.1: the vault-page stub of the off build (src/presale-off/un…” |
| M1p | `check-vault-isolation.mjs`: `SKIP_DIRS_ROOT` back to `['node_modules', 'dist', 'e2e', 'scripts']` (dist-nopresale read as source) | check-vault-isolation.test.mjs “reads every source file under the package except node_modules, both builds…” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 419 passed (420) — first: “scripts/__tests__/check-vault-isolation.test.mjs > vault isolation (which files the source rule reads) > reads every source file under the package exc…” |
| M1q | `router.ts`: the presale route decides first (`const presale = presaleRoutes.find(…); if (presale !== undefined) return presale.isRoute(o);` before the closed-list check) | routerPresale.test.ts “a presale route cannot loosen a screen of the closed list…” (router.test.ts stays green — run beside it) — tsc 0 · vitest: RED Test Files  1 failed \| 1 passed (2) · Tests  1 failed \| 34 passed (35) — first: “src/app/__tests__/routerPresale.test.ts > the router with presale routes > a presale route cannot loosen a screen of the closed list; an unknown scree…” |
| M1r | `router.ts`: `return presaleRoutes.some(…)` → `return presaleRoutes.length < 0;` (presale routes never accepted). First draft (`return false;`) left the import unused — tsc 2, INVALID, replaced | routerPresale.test.ts “a presale route of its own screen is decided by its own validator” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 1 passed (2) — first: “src/app/__tests__/routerPresale.test.ts > the router with presale routes > a presale route of its own screen is decided by its own validator…” |
| M1s | `distDir.mjs`: the `throw` deleted (any NOCTURA_DIST accepted) | presaleSwitch.test.mjs “distDir: selects dist by default…” — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 14 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > distDir > selects dist by default and dist-nopresale by NOCTURA_DIST; anything else throws…” |
| M1t | `vitest.nopresale.config.ts`: `appConfig({...process.env, NOCTURA_PRESALE: '0'})` → `appConfig(process.env)` (the off run built on) | presaleSwitch.test.mjs “vitest.nopresale.config.ts is the app config with the flag off…”; vitest.nopresale `src/__tests__/presaleSwitch.test.ts` 2 red — tsc 0 · vitest: RED Test Files  1 failed (1) · Tests  1 failed \| 14 passed (15) — first: “scripts/__tests__/presaleSwitch.test.mjs > both configs read the same flag (review L11) > vitest.nopresale.config.ts is the app config with the flag o…” · vitest.nopresale: RED Test Files  1 failed (1) · Tests  2 failed \| 1 passed (3) — first: “src/__tests__/presaleSwitch.test.ts > the build-time switch in this run (off) > __NOCTURA_PRESALE__ is false…” |
| M1u | `src/presale-off/background.ts`: `registerPresale` throws (`throw new Error(\`no presale for ${host.ext.runtimeId}\`)`) — the off build's worker dies at start-up | e2e/presaleSwitch.spec.ts — the off test red, the on test green (both builds built in the copy) — tsc 0 · e2e `presaleSwitch.spec.ts`: RED ✘ e2e/presaleSwitch.spec.ts:16:3 › switch · the off (dist-nopresale) build boots: the background answers, the popup renders #11 (32.1s) · 1 failed · 1 passed (36.4s) |

21 mutations, all red, every one compiling (`tsc` 0). One first draft did not compile and was replaced (INVALID, not red): M1r as `return false;` left `presaleRoutes` unused (tsc 2, TS6133). M1k turns its file red through `beforeAll` (the build output no longer has `app.features.json` where the test reads it) rather than through one assertion — still red, recorded as such. The E2E mutation (M1u) builds both variants in its copy and runs `e2e/presaleSwitch.spec.ts`: the off test times out waiting for a worker that died at start-up, the on test stays green (its positive control).

Not covered by a mutation (stated): each gate's `main` reading `distDir()` (the gates' mains were never unit-tested; the ok line now names the build it read, which is how the dry run checked it), and `verify-reproducible.mjs` iterating both variants (its output names each variant).

- [ ] **Step 6: Commit.**

```bash
git add -A extension core
git commit -m "feat(extension): B1d-1a build-time switch — presaleSwitch plugin and __NOCTURA_PRESALE__ in both Vite configs, off-build stubs and skeleton entries, --no-presale build, gates/test/reproducible over both builds, core/solana/encoding.ts" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

#### Dry-run notes (Task 1)

- **Ruling: the move takes three symbols, not two — `SPL_TOKEN_PROGRAM` too** — why: the spec (§1.2, §6.2) names `encodeU64LE` and `findAssociatedTokenAddress` and says only `transfer.ts` imports them, but at 923b714 `core/solana/history.ts` also imports `findAssociatedTokenAddress` and `core/solana/balances.ts` imports `SPL_TOKEN_PROGRAM` from `buyInstructions.ts`; moving two would leave `buyInstructions.ts` in the off build (M1m proves the third is needed) — cost if wrong: none found; `buyInstructions.ts` re-exports all three, the app and web unchanged (web verify, root jest green). The spec text (§1.2, §6.2, §8.2) should say "three" and name history.ts/balances.ts — for the controller.
- **Ruling: the gates select the build by an env var, `NOCTURA_DIST` (`scripts/distDir.mjs`), and `npm run gates` runs the whole list once per build** — why: every gate hard-coded `dist`; an env var touched only each main block, leaves every exported checker and its tests unchanged, and Task 2 adds `check-no-presale.mjs dist-nopresale dist` (two dirs, run once) beside `gates:build` — cost if wrong: the two source-only gates (rpc methods, classes) run twice (seconds).
- **Ruling: `dist-nopresale/` is the off build's default directory, and the vault-isolation source walk skips it like `dist/`** — why: otherwise the walk read the off build's JS as package source (M1p) — cost if wrong: none.
- **Ruling: the vault page may carry `src/presale-off/unlock.ts` (`VAULT_PAGE_FILES`)**, exactly as the spec's §6.2 "Vault isolation" line says — the other two stubs stay refused there (negative controls).
- **Ruling: `registerPresale(host)` takes `PresaleHost = {ext, deps}` (`src/background/presaleHost.ts`, types only)** — why: the spec names the parameter `host` without a type; `{ext, deps}` is exactly what `index.ts` holds — cost if wrong: Task 3 / 1b widen the interface (types only, both the entry and the stub follow it; the shape test in `src/__tests__/presaleSwitch.test.ts` makes them agree both ways).
- **Ruling: `presaleRoutes` has a consumer in 1a — `router.ts`** — `PresaleRoute = {screen, isRoute(o)}` and `isRoute` asks a presale route only for a screen outside `SCREENS`; why: the plugin must map something real (review 2 M2), so the entry must be imported by shared code, and the router's closed list is the one place a route must be accepted; a presale route can add a screen, never loosen one (M1q) — cost if wrong: 1b may want a different route contract (rendering lives in `App.tsx`, which 1b adds; `isRoute`'s `r is Route` guard will then need the presale routes in the `Route` union — a type-level change for 1b).
- **Deviation (stated): `presaleSlots` is typed `null`, not `PresaleSlots | null`, and nothing consumes it yet** — why: in 1a there are no slots (both builds), and a `PresaleSlots` interface written now would invent 1b's banner/Buy/#31/resume/kind-renderer API without a consumer; the value exists so the skeleton matches §1.1's table — cost if wrong: Task 4 or 1b defines `PresaleSlots` and widens the type in the entry and the stub together (the shape test keeps them equal).
- **Ruling: `describeChallenge` asks `describePresale(a)` last, for any kind it does not know** (instead of `a.kind === 'presale-buy'` in shared code) — why: `presale-buy` is one of §6.2's off-build markers; the kind check belongs in the on-path module (1b) — cost if wrong: none (1a returns null either way, as before).
- **Ruling: the config files become factories (`appConfig(env)`, `contentConfig(env)`) and `vite.content.config.ts` no longer throws on import** — the factory throws on a missing `NOCTURA_CONTENT` (tested); why: the parity test must import both configs for every flag value (review L11) without a build running — cost if wrong: none (`build.mjs` passes the same env as before).
- **Ruling: `vitest.nopresale.config.ts` marks its run with `test.env = {NOCTURA_PRESALE: '0'}`** — why: `src/__tests__/presaleSwitch.test.ts` needs to know the run independently of the constant it checks (else it is a tautology); M1t shows the config built on is caught both by the parity test and inside the off run.
- **Ruling: the 1a off-run list (`NOPRESALE_TESTS`) = the switch test + `messages.test.ts` (PRIVILEGED), `router.test.ts`, `App.test.tsx` (the popup renders with the stub), `challenge.test.ts` (#10 with the stub)** — the shared files each entry's consumer is tested by. **Later tasks append** their off-build files (Task 3's pending/inFlight tests, Task 4's Q42 screens, Task 6's geo gate) — the spec's §6.1 "Switch, off build" list.
- **Ruling: the boot proof is an E2E (`e2e/presaleSwitch.spec.ts`), with the on build as its positive control** — why: "the background loads" is a property of Chromium's module service worker (C4: `import()` throws there), which no unit test reproduces; each test first asserts the build's `app.features.json`, so a `dist-nopresale` that is really an on build fails it. `launchContained`/`launchPopup` gained `ext` — **Task 4's E2E 7 launches `EXT_NOPRESALE` through it.**
- **Ruling: the build test (`presaleBuilds.test.mjs`) runs two real builds into temp dirs inside vitest** (`beforeAll`, 180 s budget; ~6 s each on the dry-run machine) — why: "assert on the built module map" is only true of a real build; the fixture test shows the mechanism, this one the product — cost if wrong: ~12 s of CPU in `npm run test`.
- **Finding (not this task's): `src/screens/__tests__/PresaleActive.test.tsx` (the Android app's presale geo gate) timed out once at 5 s in a full root `jest` run and passed alone and on a re-run** — a timing-dependent test in security UI; it should be looked at on its own (not fixed here: nothing in this task reaches it).
- **For Task 2:** the module maps to scan are `<dir>/app.modules.json`, `app.provider.modules.json`, `app.relay.modules.json`; `<dir>/app.features.json` is `{"presale": bool}` and `scripts/distDir.mjs` holds the two directory names. The off build carries exactly `src/presale-off/{background,app,unlock}.ts` and, of `core/presale/**`, `addresses.ts` + `stagePrices.ts` (no `core/geo/**` yet — Task 6 adds it). The fixture for 0b79442 must still be built from that commit (this task did not touch it). In 1a the packages are byte-identical, so any "the off build differs" assertion must read the maps, not the files.
- **For Task 3:** `index.ts` calls `registerPresale({ext, deps})` before the listeners are added — the place where 1b's `registerIntentKind('presale-buy', …)` will run; `intents.ts`'s `send` registration should not depend on it. `PRIVILEGED` ends with `...PRESALE_MESSAGE_TYPES`: `messages.test.ts`'s literal list is unchanged and runs in both vitest runs.

---

### Task 2: The off-build gate — `scripts/check-no-presale.mjs <offDir> <onDir>`: `app.features.json` must name its directory; the off build's module maps carry no presale module and, of `core/presale/**`, only the C38 allowlist (`core/geo/**` whole, D15); the staged positive controls (1a Task 2: the three on-path entries); presale markers (1a: none — armed by 1b) with their on-build control; the must-stay strings (B1b/B1c's presale copy + the decoder's instruction names); the 0b79442 fixture self-test; wired into `npm run gates`; and the spec text fixed to "three moved symbols"

**Spec:** B1d §6.2 items 1–3 (the gate, its allowlist, the staged positive controls, the strings, the must-stay control, the self-test with the 0b79442 fixture), C38, D15 (core/geo allowed in both builds), review 1 M2, review 2 M2 / L5; §1.2, §6.2 and §8.2 for the spec-text correction (Task 1's ruling: three symbols moved, not two).

**Files:**
- Create: `extension/scripts/check-no-presale.mjs`
- Create: `extension/scripts/__tests__/check-no-presale.test.mjs`
- Create: `extension/scripts/__tests__/fixtures/app.modules.0b79442.json` (generated in Step 1 by building commit 0b79442 — never hand-edited)
- Modify: `extension/scripts/__tests__/presaleBuilds.test.mjs` (one test: the gate over the two real builds, and swapped)
- Modify: `extension/package.json` (`gates` runs the gate once, after both `gates:build` runs)
- Modify: `docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md` (C38, §1.2, §6.2, §8.2: three moved symbols, named as the code names them)

**Interfaces:**
- Consumes: Task 1's `PRESALE_ENTRIES` (`scripts/presaleSwitch.mjs`), the module maps `<dir>/app.modules.json`, `app.provider.modules.json`, `app.relay.modules.json` (`{chunks: {file: moduleId[]}, …}`, ids package-relative: `src/…`, `../core/…`, `../web/…`, `node_modules/…`), `<dir>/app.features.json` = `{"presale": bool}`, `scripts/build.mjs [outDir] [--no-presale]`; B1c's `PRESALE_INSTRUCTIONS` (`src/background/dapp/decode/presaleIdl.ts`, the generated table — one `{name: '…', discriminator:` per row).
- Produces (`scripts/check-no-presale.mjs`):
  ```js
  export const OFF_FORBIDDEN: string[]          // 'src/background/presale/', 'src/app/presale/', 'src/unlock/presale.ts', 'core/referral/' (a trailing '/' = the directory)
  export const CORE_PRESALE_ALLOWED: string[]   // C38: 'core/presale/addresses.ts', 'core/presale/allocation.ts', 'core/presale/stagePrices.ts'
  export const ON_BUILD: string[]               // staged — Task 2: the three on-path entries; Task 5 appends src/background/presale/{layouts,state}.ts + core/presale/limits.ts; 1b, 2 per §6.2
  export const BOTH_BUILDS: string[]            // staged — Task 2: []; Task 6 appends src/background/geo/gate.ts + core/geo/fetch.ts
  export const MARKERS: string[]                // staged — 1a: [] (armed by 1b); each ≥ 8 characters or the gate throws
  export const MUST_STAY: string[]              // staged — Task 2: 'Presale purchase', 'PRESALE PURCHASE'; Task 4 appends Q42; 1b appends Q49–Q51
  export function moduleIds(maps: object[]): Set<string>       // normalized ids ('../core/x' → 'core/x', query/hash stripped); throws 'INCONCLUSIVE: …' on a map without chunks or no module at all
  export function offModuleViolations(ids: Set<string>): string[]   // 'off build carries <id> — …'
  export function missingModules(build: 'on'|'off', ids: Set<string>, required: string[]): string[]  // '<build> build does not carry <id> — renamed or moved? …'
  export function featureViolations(dir: string, features: unknown, presale: boolean): string[]       // exactly {"presale": presale}
  export function markerViolations(offFiles: {path, bytes: Buffer}[], onFiles: {path, bytes: Buffer}[], markers: string[]): string[]
  export function missingStrings(build: 'off', files: {path, bytes: Buffer}[], strings: string[]): string[]
  export function decoderInstructionNames(source: string): string[]
  export function checkNoPresale(offDir: string, onDir: string, o?: {markers?, mustStay?, onBuild?, bothBuilds?, decoderSource?}): string[]  // [] = pass; every problem a line
  ```
  CLI: `node scripts/check-no-presale.mjs <offDir> <onDir>` (package-relative or absolute), exit 1 with one line per problem, usage line + exit 1 without two arguments. `npm run gates` = `npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build && node scripts/check-no-presale.mjs dist-nopresale dist`.

**What the gate can and cannot see in 1a (read before Tasks 4–6):** the two packages are byte-identical through Task 4 (Task 1; checked again at Tasks 3 and 4 in rev 2: `diff -rq dist dist-nopresale` lists only `app.features.json` and `app.modules.json`); from Task 5 the on build carries the presale background modules (kept whole, Task 5), so the maps — not the files — remain the gate's evidence (rev 2, review 1 M4: rev 1 said "byte-identical in 1a", which is false from Task 5). Rule 1 therefore reads the module maps — the bundler's own account of what each chunk carries — and rule 2 (markers) has nothing to arm: any string in the on build is in the off build too, so a 1a marker would fail its own positive control or the off scan. The marker machinery is therefore proven on synthetic directories here and armed by 1b. A module whose only used export is a constant the bundler inlines does not appear in the map (observed: importing `MIN_PURCHASE_USD` from `core/presale/purchaseGate.ts` into shared code left the off map unchanged and the gate green) — the map reports what ships, which is the property the gate is about; a function import does ship the module and turns the gate red (M2b).

- [ ] **Step 1: Generate the fixture from commit 0b79442, then write the failing tests.**

`dist/` is untracked (review 2 L5), so the fixture is built from the commit, in a scratch copy with `extension/node_modules` **copied** (a symlinked one makes Vite write realpath-relative `node_modules` ids) and the repository's root and `web/` `node_modules` linked:

```bash
F=$(mktemp -d)
git archive 0b79442 | tar -x -C "$F"
ln -s "$PWD/node_modules" "$F/node_modules"; ln -s "$PWD/web/node_modules" "$F/web/node_modules"
cp -a extension/node_modules "$F/extension/node_modules"
(cd "$F/extension" && node scripts/build.mjs "$F/out")
mkdir -p extension/scripts/__tests__/fixtures
node -e '
const fs=require("fs");
const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const out={builtFrom:"commit 0b79442 — cd extension && node scripts/build.mjs <dir>; this is <dir>/app.modules.json as written, with only this key added (B1d §6.2 self-test of check-no-presale.mjs)",...m};
fs.writeFileSync("extension/scripts/__tests__/fixtures/app.modules.0b79442.json",JSON.stringify(out,null,2)+"\n");
' "$F/out/app.modules.json"
rm -rf "$F"
```

Expected (review 2 N1): the fixture is 14 451 bytes, sha256 `d3eb2975…`. A file of another size (25 035 bytes with a symlinked `extension/node_modules`) means the copy step was skipped — regenerate it; never commit it.

Expected (the dry run): the built map is 14 254 bytes, sha256 `d7df522003ddb7c2a039d0a165072d2c7fdb0a8f3af571622cd3d5025df8503e`; the fixture 14 451 bytes, sha256 `d3eb2975e402b168c607610ddfccae133f4472342ab9106f45e4efa9c086bb8b`; keys `builtFrom, chunks, css, chunkCss, cssRefs`; 14 chunks, 288 modules, of `core/presale/**` exactly `addresses.ts`, `allocation.ts`, `buyInstructions.ts`, `stagePrices.ts`, no `core/geo/**`, no `core/referral/**`.

Create `extension/scripts/__tests__/check-no-presale.test.mjs`:

````js
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  BOTH_BUILDS,
  CORE_PRESALE_ALLOWED,
  MARKERS,
  MUST_STAY,
  ON_BUILD,
  checkNoPresale,
  decoderInstructionNames,
  featureViolations,
  markerViolations,
  missingModules,
  missingStrings,
  moduleIds,
  offModuleViolations,
} from '../check-no-presale.mjs';
import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';
import {PRESALE_INSTRUCTIONS} from '../../src/background/dapp/decode/presaleIdl';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/app.modules.0b79442.json'), 'utf8'));
const map = ids => ({chunks: {'background.js': ids}});
const without = (m, id) => ({...m, chunks: Object.fromEntries(Object.entries(m.chunks).map(([f, ids]) => [f, ids.filter(i => i !== id)]))});
const SHARED = ['src/background/index.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];

// B1d §6.2 item 1 (C38, D15): the off build's module rule — an allowlist for core/presale/**, core/geo/** whole.
describe('the off-build module rule', () => {
  it('self-test: the map of commit 0b79442 (before B1d) fails naming exactly core/presale/buyInstructions.ts', () => {
    expect(Object.keys(FIXTURE)[0]).toBe('builtFrom');
    expect(FIXTURE.builtFrom).toMatch(/^commit 0b79442 /);
    const v = offModuleViolations(moduleIds([FIXTURE]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(/^off build carries core\/presale\/buyInstructions\.ts /);
  });

  it('self-test: and passes with that one entry removed', () => {
    expect(offModuleViolations(moduleIds([without(FIXTURE, '../core/presale/buyInstructions.ts')]))).toEqual([]);
  });

  it('allows exactly addresses, allocation and stagePrices of core/presale, and all of core/geo (D15)', () => {
    expect(CORE_PRESALE_ALLOWED).toEqual(['core/presale/addresses.ts', 'core/presale/allocation.ts', 'core/presale/stagePrices.ts']);
    const geo = ['../core/geo/fetch.ts', '../core/geo/freshness.ts', '../core/geo/classify.ts', '../core/geo/restrictedList.ts', 'src/background/geo/gate.ts'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...geo])]))).toEqual([]);
  });

  it.each([
    'src/background/presale/api.ts',
    'src/background/presale/state.ts',
    'src/app/presale/index.ts',
    'src/app/presale/Presale.tsx',
    'src/unlock/presale.ts',
    '../core/referral/index.ts',
    '../core/presale/buyInstructions.ts',
    '../core/presale/limits.ts',
    '../core/presale/stats.ts',
    '../core/presale/purchaseGate.ts',
    '../core/presale/buyInstructions.ts?commonjs-proxy',
    'src/unlock/presale.ts?v=1',
    '../core/presale/limits.ts#x',
  ])('refuses %s in the off build', id => {
    expect(offModuleViolations(moduleIds([map([...SHARED, id])]))).toHaveLength(1);
  });

  it('reads every chunk of every map it is given, and a map without chunks is INCONCLUSIVE', () => {
    const two = [map(SHARED), {chunks: {'assets/x.js': ['src/x.ts'], 'assets/y.js': ['src/app/presale/index.ts']}}];
    expect(offModuleViolations(moduleIds(two))).toHaveLength(1);
    expect(() => moduleIds([{}])).toThrow(/INCONCLUSIVE/);
    expect(() => moduleIds([])).toThrow(/INCONCLUSIVE/);
    expect(() => moduleIds([{chunks: {}}])).toThrow(/INCONCLUSIVE/);
  });

  it('a stub and a presale-named module outside the presale directories are not presale modules', () => {
    const ok = ['src/presale-off/background.ts', 'src/presale-off/app.ts', 'src/presale-off/unlock.ts', 'src/background/presaleHost.ts', 'src/background/dapp/decode/presaleIdl.ts'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...ok])]))).toEqual([]);
  });
});

// §6.2 item 1's positive control, staged per plan (review 2 M2): the lists only grow, and each plan's modules are named.
describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
  it('the on build must carry the three on-path entries — the plugin maps something real', () => {
    expect(ON_BUILD).toEqual(PRESALE_ENTRIES.map(e => e.entry));
    expect(BOTH_BUILDS).toEqual([]);
  });

  it('missingModules names each required module a map does not carry', () => {
    const on = moduleIds([map([...SHARED, ...ON_BUILD])]);
    expect(missingModules('on', on, ON_BUILD)).toEqual([]);
    const renamed = moduleIds([map([...SHARED, 'src/background/presale/index.ts', ...ON_BUILD.slice(1)])]);
    expect(missingModules('on', renamed, ON_BUILD)).toEqual(['on build does not carry src/background/presale/api.ts — renamed or moved? the positive control must name it']);
    expect(missingModules('off', moduleIds([map(['../core/geo/fetch.ts'])]), ['core/geo/fetch.ts'])).toEqual([]);
  });

  it('every ON_BUILD module is one the off build refuses (else its control proves nothing)', () => {
    for (const id of ON_BUILD) expect([id, offModuleViolations(new Set([id])).length]).toEqual([id, 1]);
  });
});

describe('wiring', () => {
  it('npm run gates runs the gate once, off build first, and npm run verify runs the gates after building both', () => {
    const {scripts} = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(scripts.gates.split(' && ').filter(c => c.includes('check-no-presale'))).toEqual(['node scripts/check-no-presale.mjs dist-nopresale dist']);
    expect(scripts.verify.split(' && ')).toEqual(expect.arrayContaining(['npm run build', 'npm run gates']));
    expect(scripts.build).toContain('node scripts/build.mjs --no-presale');
  });
});

describe('app.features.json', () => {
  it('must say what its directory is', () => {
    expect(featureViolations('dist-nopresale', {presale: false}, false)).toEqual([]);
    expect(featureViolations('dist', {presale: true}, true)).toEqual([]);
    expect(featureViolations('dist-nopresale', {presale: true}, false)).toHaveLength(1);
    expect(featureViolations('dist', {presale: false}, true)).toHaveLength(1);
    expect(featureViolations('dist', undefined, true)).toHaveLength(1);
    expect(featureViolations('dist', {presale: 'true'}, true)).toHaveLength(1);
    expect(featureViolations('dist', {presale: true, extra: 1}, true)).toHaveLength(1);
  });
});

// §6.2 items 2 and 3: markers stay out of the off build (each found in the on build), what both builds need stays in.
describe('strings', () => {
  const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});

  it('1a ships no marker: the list is empty and armed by B1d-1b (Q42 is "both")', () => {
    expect(MARKERS).toEqual([]);
  });

  it('a marker in any off-build file is a violation; each marker must be found in the on build', () => {
    const markers = ['NOC presale', 'v1_presale_records'];
    const off = [file('app/background.js', 'var a=1;'), file('chrome/assets/x.js', '"Buy in the NOC presale"')];
    const on = [file('app/background.js', '"v1_presale_records"'), file('app/assets/y.js', 'NOC presale')];
    expect(markerViolations(off, on, markers)).toEqual(['off build: chrome/assets/x.js contains the presale marker "NOC presale"']);
    expect(markerViolations([file('app/a.js', 'x')], on, markers)).toEqual([]);
    expect(markerViolations([file('app/a.js', 'x')], [file('app/a.js', 'NOC presale')], markers)).toEqual(['on build: no file contains the presale marker "v1_presale_records" — the marker does not describe the on build']);
  });

  it('refuses a marker shorter than 8 characters (it would match unrelated code)', () => {
    expect(() => markerViolations([], [file('app/a.js', 'presale')], ['presale'])).toThrow(/at least 8/);
  });

  it('must stay: B1b/B1c presale copy and the decoder instruction names are found in the off build', () => {
    expect(MUST_STAY).toEqual(['Presale purchase', 'PRESALE PURCHASE']);
    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"'), file('app/b.js', 'PRESALE PURCHASE')], MUST_STAY)).toEqual([]);
    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"')], MUST_STAY)).toEqual(['off build: no file contains "PRESALE PURCHASE" — the switch stripped what both builds need']);
  });

  it('the decoder names are read from presaleIdl.ts exactly as the module exports them', () => {
    const names = decoderInstructionNames(readFileSync(join(ROOT, 'src/background/dapp/decode/presaleIdl.ts'), 'utf8'));
    expect(names).toEqual(PRESALE_INSTRUCTIONS.map(i => i.name));
    expect(names).toContain('presale_purchase_with_sol');
    expect(decoderInstructionNames('export const X = 1;')).toEqual([]);
  });

  it('no marker overlaps a string that must stay', () => {
    for (const m of MARKERS) for (const s of MUST_STAY) expect([m, s, m.includes(s) || s.includes(m)]).toEqual([m, s, false]);
  });
});

// The whole gate over two directories, as `npm run gates` runs it — synthetic builds, each rule's red and green.
describe('checkNoPresale(offDir, onDir)', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'no-presale-'));
  });
  afterEach(() => rmSync(tmp, {recursive: true, force: true}));

  const IDL = "{name: 'presale_purchase_with_sol', discriminator: [1]}, {name: 'register_referrer', discriminator: [2]}";
  const write = (dir, {presale, modules, text}) => {
    mkdirSync(join(tmp, dir), {recursive: true});
    writeFileSync(join(tmp, dir, 'app.features.json'), `${JSON.stringify({presale})}\n`);
    writeFileSync(join(tmp, dir, 'app.modules.json'), JSON.stringify(map(modules)));
    writeFileSync(join(tmp, dir, 'app.relay.modules.json'), JSON.stringify({chunks: {'relay.js': ['src/relay/index.ts']}}));
    for (const p of ['app', 'chrome', 'firefox']) {
      mkdirSync(join(tmp, dir, p, 'assets'), {recursive: true});
      writeFileSync(join(tmp, dir, p, 'background.js'), `"Presale purchase";"PRESALE PURCHASE";"presale_purchase_with_sol";"register_referrer";${text}`);
    }
  };
  const good = () => {
    write('off', {presale: false, modules: [...SHARED, 'src/presale-off/background.ts'], text: ''});
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD], text: ''});
  };
  const run = (o = {}) => checkNoPresale(join(tmp, 'off'), join(tmp, 'on'), {decoderSource: IDL, ...o});

  it('passes on a clean pair (positive control)', () => {
    good();
    expect(run()).toEqual([]);
  });

  it('fails when a presale module leaks into the off build — in any module map', () => {
    good();
    writeFileSync(join(tmp, 'off', 'app.relay.modules.json'), JSON.stringify({chunks: {'relay.js': ['src/relay/index.ts', '../core/presale/limits.ts']}}));
    expect(run()).toEqual([expect.stringMatching(/^off build carries core\/presale\/limits\.ts /)]);
  });

  it('fails when the on build lacks a positive-control module', () => {
    good();
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD.slice(1)], text: ''});
    expect(run()).toEqual(['on build does not carry src/background/presale/api.ts — renamed or moved? the positive control must name it']);
  });

  it('fails when a marker is in the off build, in chrome/ or firefox/ alone too', () => {
    good();
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD], text: '"YOU RECEIVE (EST.)"'});
    expect(run({markers: ['YOU RECEIVE (EST.)']})).toEqual([]);
    writeFileSync(join(tmp, 'off', 'firefox', 'assets', 'p.js'), '"YOU RECEIVE (EST.)"');
    expect(run({markers: ['YOU RECEIVE (EST.)']})).toEqual(['off build: firefox/assets/p.js contains the presale marker "YOU RECEIVE (EST.)"']);
  });

  it('fails when a must-stay string or a decoder name is missing from the off build', () => {
    good();
    writeFileSync(join(tmp, 'off', 'app', 'background.js'), '"Presale purchase";"PRESALE PURCHASE";"presale_purchase_with_sol"');
    for (const p of ['chrome', 'firefox']) rmSync(join(tmp, 'off', p, 'background.js'));
    expect(run()).toEqual(['off build: no file contains "register_referrer" — the switch stripped what both builds need']);
  });

  it('is INCONCLUSIVE without the decoder names, a module map, a package directory or app.features.json — and with the directories swapped it fails', () => {
    good();
    expect(run({decoderSource: ''})).toEqual(['INCONCLUSIVE: no instruction names read from src/background/dapp/decode/presaleIdl.ts']);
    rmSync(join(tmp, 'off', 'app.modules.json'));
    expect(run()).toEqual([expect.stringMatching(/^INCONCLUSIVE: .*off.*app\.modules\.json/)]);
    good();
    rmSync(join(tmp, 'on', 'firefox'), {recursive: true});
    expect(run()).toEqual([expect.stringMatching(/^INCONCLUSIVE: .*on.*firefox/)]);
    good();
    rmSync(join(tmp, 'off', 'app.features.json'));
    expect(run()).toHaveLength(1);
    good();
    expect(checkNoPresale(join(tmp, 'on'), join(tmp, 'off'), {decoderSource: IDL}).length).toBeGreaterThan(2);
  });
});
````

Modify `extension/scripts/__tests__/presaleBuilds.test.mjs` (the gate over the two real builds this file already makes — the product, not a fixture):

````diff
diff --git a/extension/scripts/__tests__/presaleBuilds.test.mjs b/extension/scripts/__tests__/presaleBuilds.test.mjs
index b9483db..727f361 100644
--- a/extension/scripts/__tests__/presaleBuilds.test.mjs
+++ b/extension/scripts/__tests__/presaleBuilds.test.mjs
@@ -3,6 +3,7 @@ import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:f
 import {tmpdir} from 'node:os';
 import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
+import {checkNoPresale} from '../check-no-presale.mjs';
 import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
@@ -61,6 +62,11 @@ describe('the two builds', () => {
     }
   });
 
+  it('the off-build gate (scripts/check-no-presale.mjs) passes on the two builds, and fails with them swapped', () => {
+    expect(checkNoPresale(builds.off.dir, builds.on.dir)).toEqual([]);
+    expect(checkNoPresale(builds.on.dir, builds.off.dir).length).toBeGreaterThan(0);
+  });
+
   it('both: the same manifest — the switch adds no permission, host or CSP entry', () => {
     for (const browser of ['chrome', 'firefox']) {
       expect(readFileSync(join(builds.off.dir, browser, 'manifest.json'), 'utf8')).toBe(readFileSync(join(builds.on.dir, browser, 'manifest.json'), 'utf8'));
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run (from `extension/`): `npx vitest run scripts/__tests__/check-no-presale.test.mjs scripts/__tests__/presaleBuilds.test.mjs`

Expected (the dry run, on 4ec596b + the fixture and the two test files): `Test Files  2 failed (2)` · `Tests  no tests` — both files: `Error: Cannot find module '../check-no-presale.mjs'`.

- [ ] **Step 3: Implement.**

Create `extension/scripts/check-no-presale.mjs`:

````js
#!/usr/bin/env node
// B1d §6.2 (C38, D15): the off-build gate — `node scripts/check-no-presale.mjs <offDir> <onDir>` (npm run gates:
// dist-nopresale dist). Each directory's app.features.json must say what it is. Then three rules, each with its control:
//  1. Modules: the off build's module maps (every *.modules.json next to its packages) carry nothing under
//     src/background/presale/, src/app/presale/, src/unlock/presale.ts or core/referral/, and of core/presale/ only
//     CORE_PRESALE_ALLOWED; core/geo/ is allowed whole (D15). Positive control: the on build carries every ON_BUILD
//     module and both carry every BOTH_BUILDS module, so a renamed or moved module fails instead of passing silently.
//     The maps are the evidence, not the packages: the two packages were byte-identical through B1d-1a's Task 4; from
//     Task 5 the on build carries the presale background modules, so the maps — not the files — remain the evidence.
//  2. Strings: no file of the off build's app/, chrome/, firefox/ contains a MARKER; each marker is found in the on build.
//  3. Must stay: B1b/B1c's presale copy and the decoder's instruction names are found in the off build.
// ON_BUILD, BOTH_BUILDS, MARKERS and MUST_STAY are staged per plan (review 2 M2): each plan extends them, never loosens them.
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['app', 'chrome', 'firefox'];
const DECODER = 'src/background/dapp/decode/presaleIdl.ts';

export const OFF_FORBIDDEN = ['src/background/presale/', 'src/app/presale/', 'src/unlock/presale.ts', 'core/referral/'];
export const CORE_PRESALE_ALLOWED = ['core/presale/addresses.ts', 'core/presale/allocation.ts', 'core/presale/stagePrices.ts'];

// B1d-1a: the three on-path entries (§1.1); Task 5 adds presale/{layouts,state}.ts and core/presale/limits.ts;
// 1b adds presale/{quote,buy}.ts; B1d-2 adds presale/{record,referral}.ts and core/referral/index.ts.
export const ON_BUILD = ['src/background/presale/api.ts', 'src/app/presale/index.ts', 'src/unlock/presale.ts'];
// Task 6 adds src/background/geo/gate.ts and core/geo/fetch.ts (D15: the off build did not lose the gate).
export const BOTH_BUILDS = [];
// Armed by B1d-1b: 1a ships no presale string (Q42 is "both").
export const MARKERS = [];
// Task 4 adds Q42; 1b adds F12's Q49–Q51. The decoder's instruction names are read from its source (DECODER).
export const MUST_STAY = ['Presale purchase', 'PRESALE PURCHASE'];

const MIN_MARKER = 8;

/** A module id as the maps write it (package-relative: `../core/…`), without query or hash, rooted at the repository's `core/`. */
const normalize = id => String(id).replace(/[?#].*$/, '').replace(/^\.\.\/(?=core\/)/, '');

/** Every module of the given parsed module maps; throws INCONCLUSIVE when there is none to read. */
export function moduleIds(maps) {
  const out = new Set();
  for (const m of maps) {
    if (m === null || typeof m !== 'object' || m.chunks === null || typeof m.chunks !== 'object') throw new Error('INCONCLUSIVE: a module map has no chunks');
    for (const ids of Object.values(m.chunks)) for (const id of ids) out.add(normalize(id));
  }
  if (out.size === 0) throw new Error('INCONCLUSIVE: the module maps carry no module');
  return out;
}

/** §6.2 item 1: every module the off build may not carry. */
export function offModuleViolations(ids) {
  const out = [];
  for (const id of [...ids].sort()) {
    if (OFF_FORBIDDEN.some(f => (f.endsWith('/') ? id.startsWith(f) : id === f))) out.push(`off build carries ${id} — a presale module (${OFF_FORBIDDEN.join(', ')})`);
    else if (id.startsWith('core/presale/') && !CORE_PRESALE_ALLOWED.includes(id)) out.push(`off build carries ${id} — of core/presale/ it may carry only ${CORE_PRESALE_ALLOWED.join(', ')}`);
  }
  return out;
}

export function missingModules(build, ids, required) {
  return required.filter(id => !ids.has(id)).map(id => `${build} build does not carry ${id} — renamed or moved? the positive control must name it`);
}

export function featureViolations(dir, features, presale) {
  const ok = features !== null && typeof features === 'object' && Object.keys(features).length === 1 && features.presale === presale;
  return ok ? [] : [`${dir}/app.features.json must be {"presale":${presale}} — the directory is not the build the gate reads it as`];
}

/** §6.2 item 2: `files` are {path, bytes}; a marker in an off-build file is a violation, a marker in no on-build file too. */
export function markerViolations(offFiles, onFiles, markers) {
  for (const m of markers) if (m.length < MIN_MARKER) throw new Error(`a marker must be at least ${MIN_MARKER} characters (${JSON.stringify(m)})`);
  const out = [];
  for (const m of markers) {
    const b = Buffer.from(m, 'utf8');
    for (const f of offFiles) if (f.bytes.includes(b)) out.push(`off build: ${f.path} contains the presale marker ${JSON.stringify(m)}`);
    if (!onFiles.some(f => f.bytes.includes(b))) out.push(`on build: no file contains the presale marker ${JSON.stringify(m)} — the marker does not describe the on build`);
  }
  return out;
}

/** §6.2 item 3. */
export function missingStrings(build, files, strings) {
  return strings
    .filter(s => !files.some(f => f.bytes.includes(Buffer.from(s, 'utf8'))))
    .map(s => `${build} build: no file contains ${JSON.stringify(s)} — the switch stripped what both builds need`);
}

/** The names of PRESALE_INSTRUCTIONS, read from the decoder's source (the table is generated, one `{name: '…', discriminator:` per row). */
export function decoderInstructionNames(source) {
  return [...source.matchAll(/\{name: '(\w+)', discriminator:/g)].map(m => m[1]);
}

const filesUnder = (dir, base = dir) =>
  readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? filesUnder(join(dir, e.name), base) : [{path: relative(base, join(dir, e.name)).split(sep).join('/'), bytes: readFileSync(join(dir, e.name))}],
  );

/** Reads one build directory: its features, its module ids, its packages' files — each `problems` entry INCONCLUSIVE. */
function readBuild(dir, label) {
  const problems = [];
  const featuresFile = join(dir, 'app.features.json');
  const features = existsSync(featuresFile) ? JSON.parse(readFileSync(featuresFile, 'utf8')) : undefined;
  let ids;
  if (!existsSync(join(dir, 'app.modules.json'))) problems.push(`INCONCLUSIVE: the ${label} build ${dir} has no app.modules.json`);
  else {
    try {
      ids = moduleIds(
        readdirSync(dir)
          .filter(f => f.endsWith('.modules.json'))
          .sort()
          .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8'))),
      );
    } catch (e) {
      problems.push(`${e.message} (${label} build ${dir})`);
    }
  }
  const missing = PACKAGES.filter(p => !existsSync(join(dir, p)));
  if (missing.length > 0) problems.push(`INCONCLUSIVE: the ${label} build ${dir} has no ${missing.join(', ')}`);
  const files = missing.length > 0 ? undefined : PACKAGES.flatMap(p => filesUnder(join(dir, p), dir));
  return {features, ids, files, problems};
}

export function checkNoPresale(offDir, onDir, o = {}) {
  const {markers = MARKERS, mustStay = MUST_STAY, onBuild = ON_BUILD, bothBuilds = BOTH_BUILDS} = o;
  const decoderSource = o.decoderSource ?? readFileSync(join(ROOT, DECODER), 'utf8');
  const off = readBuild(offDir, 'off');
  const on = readBuild(onDir, 'on');
  const out = [...off.problems, ...on.problems];
  out.push(...featureViolations(offDir, off.features, false), ...featureViolations(onDir, on.features, true));
  if (off.ids !== undefined) out.push(...offModuleViolations(off.ids), ...missingModules('off', off.ids, bothBuilds));
  if (on.ids !== undefined) out.push(...missingModules('on', on.ids, [...onBuild, ...bothBuilds]));
  const names = decoderInstructionNames(decoderSource);
  if (names.length === 0) out.push(`INCONCLUSIVE: no instruction names read from ${DECODER}`);
  if (off.files !== undefined && on.files !== undefined) out.push(...markerViolations(off.files, on.files, markers));
  if (off.files !== undefined) out.push(...missingStrings('off', off.files, [...mustStay, ...names]));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [offArg, onArg] = process.argv.slice(2);
  if (offArg === undefined || onArg === undefined) {
    console.error('usage: node scripts/check-no-presale.mjs <offDir> <onDir>');
    process.exit(1);
  }
  const problems = checkNoPresale(resolve(ROOT, offArg), resolve(ROOT, onArg));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(
    `no presale ok (${offArg} off, ${onArg} on): the off build's module maps carry no presale module and of core/presale/ only ${CORE_PRESALE_ALLOWED.length} allowed; the on build carries ${ON_BUILD.length + BOTH_BUILDS.length} required modules; ${MARKERS.length} markers (none in the off build, each in the on build); ${MUST_STAY.length} strings and the decoder's instruction names stay in the off build`,
  );
}
````

Modify `extension/package.json`:

````diff
diff --git a/extension/package.json b/extension/package.json
index af4ccb5..f4b5b48 100644
--- a/extension/package.json
+++ b/extension/package.json
@@ -11,7 +11,7 @@
     "e2e": "playwright test",
     "csp": "node scripts/check-csp.mjs dist/app && node scripts/check-csp.mjs dist-nopresale/app",
     "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && test -d dist-nopresale/app && test -d dist-nopresale/chrome && test -d dist-nopresale/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox dist-nopresale/app dist-nopresale/chrome dist-nopresale/firefox",
-    "gates": "npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build",
+    "gates": "npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build && node scripts/check-no-presale.mjs dist-nopresale dist",
     "gates:build": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs",
     "reproducible": "node scripts/verify-reproducible.mjs",
     "verify": "rm -rf dist dist-nopresale && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
````

Modify the spec (Task 1's ruling — the move took three symbols; the text said two):

````diff
diff --git a/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md b/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
index b81369e..6cd2e20 100644
--- a/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
+++ b/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
@@ -112,7 +112,7 @@ spec's ruling C13 ("the window decides nothing"), which the approved design cite
 | C35 | **#23a re-reads every 25 s while visible, and only what the quote and the gate need** (review 1 L9, review 2 M3): the §2.1 snapshot and `/geo/check` — two requests; balances are read on mount, on focus, on a currency change and after a purchase confirms; the re-read pauses while `document.visibilityState !== 'visible'` | Buy never flickers off at `Quote`'s 30 s boundary, and the presale screen cannot spend the per-IP budget whose 403 trips the shared latch and so disables **Send** for the cool-down (B1b D36): a full view is ~5 requests, 12 a minute at this interval |
 | C36 | **The dollar re-auth rule takes the larger valuation** (review L6): `/wallet/prices`' or the simulation's `Δtotal_spent_cents` (the program's own Pyth valuation); unknown only when both are | fail closed; the program's number is the one that is actually charged |
 | C37 | **Account indices in this spec are 0-based** (review L2), as `buyInstructions.ts` counts them | one convention; the IDL order is listed once (§3.3) |
-| C38 | **The off build may contain, from `core/presale/**`, only an explicit allowlist** (review 1 M2): `core/presale/addresses.ts`, `allocation.ts`, `stagePrices.ts`; **`core/geo/**` is allowed whole** (D15: the jurisdiction gate is compliance code in both builds) | a denylist lets an unlisted module leak silently; today's off-build needs (B1b, B1c) are exactly these three once the two helpers move out of `buyInstructions.ts`, plus the shared gate |
+| C38 | **The off build may contain, from `core/presale/**`, only an explicit allowlist** (review 1 M2): `core/presale/addresses.ts`, `allocation.ts`, `stagePrices.ts`; **`core/geo/**` is allowed whole** (D15: the jurisdiction gate is compliance code in both builds) | a denylist lets an unlisted module leak silently; today's off-build needs (B1b, B1c) are exactly these three once the three shared symbols move out of `buyInstructions.ts` (§6.2), plus the shared gate |
 | C39 | **The busy-destination retry re-runs everything** (review 2 M1): the same message bytes are simulated again (nothing rebuilt); the fresh snapshot replaces the first for every rule, pin, stage comparison, limit, `firstPurchase`, referrer and "before"; all of §3.3 step 5 runs on the second result; the entry stores the second snapshot's values; one retry per prepare, only for a destination-only mismatch whose simulation slot is not below the snapshot's | a retry that re-checks less than the first pass would widen what is accepted; a simulation older than the snapshot is a stale answer, not a race (review 2 L1) |
 
 ---
@@ -194,9 +194,9 @@ approve.html (#48) — renders F12 as stored with the simulation; computes nothi
 (through `dapp/`) both call it.
 
 `core/` gains: `core/geo/fetch.ts` (`fetchGeoInputs(get: JsonGetter)`, §2.2), `core/presale/limits.ts` (bigint:
-`usdCentsForStable`, `tokensFor`, `checkLimits`, ticks, rents, §3.2) and `core/solana/encoding.ts` (`encodeU64LE`,
-`findAssociatedTokenAddress` moved out of `buyInstructions.ts`, which re-exports both for the app and web, so no caller
-outside the extension changes; §6.2). `deps.ts` gains `createJsonPoster(fetch, latch)` (B1d-2) — generic, beside
+`usdCentsForStable`, `tokensFor`, `checkLimits`, ticks, rents, §3.2) and `core/solana/encoding.ts` (`SPL_TOKEN_PROGRAM`,
+`encodeU64LE`, `findAssociatedTokenAddress` moved out of `buyInstructions.ts`, which re-exports all three for the app and
+web, so no caller outside the extension changes; §6.2). `deps.ts` gains `createJsonPoster(fetch, latch)` (B1d-2) — generic, beside
 `createJsonGetter`, the one place allowed to call the global fetch (`check-rpc-methods.mjs`).
 
 ### 1.3 The intent-kind registry and the shared shapes (C19; B1d-1a)
@@ -940,10 +940,13 @@ does), and a positive control wherever a negative is asserted. The plan that bui
 
 ### 6.2 Gates
 
-- **`core/solana/encoding.ts` (1a, review M2):** `encodeU64LE` and `findAssociatedTokenAddress` move there;
-  `core/solana/transfer.ts` imports them from it; `core/presale/buyInstructions.ts` re-exports both, so web and the app
-  are unchanged. Today `transfer.ts:3` imports both from `buyInstructions.ts`, which is why that module is in today's
-  off-build-to-be bundle (`dist/app.modules.json` at 0b79442).
+- **`core/solana/encoding.ts` (1a, review M2):** three symbols move there — `SPL_TOKEN_PROGRAM`, `encodeU64LE` and
+  `findAssociatedTokenAddress`; `core/solana/transfer.ts` (`encodeU64LE`, `findAssociatedTokenAddress`),
+  `core/solana/history.ts` (`findAssociatedTokenAddress`) and `core/solana/balances.ts` (`SPL_TOKEN_PROGRAM`) import them
+  from it; `core/presale/buyInstructions.ts` re-exports all three, so web and the app are unchanged. Today those three
+  modules import them from `buyInstructions.ts` (`transfer.ts:3`, `history.ts:3`, `balances.ts:3`), which is why that
+  module is in today's off-build-to-be bundle (`dist/app.modules.json` at 0b79442); moving only two would leave it there
+  (B1d-1a plan, Task 1).
 - **`check-no-presale.mjs <offDir> <onDir>`** (1a, in `npm run verify`, which builds both: `dist/` on and
   `dist-nopresale/` off; each `app.features.json` must say what its directory is, else the gate fails):
   1. **Modules:** the off build's module maps (`app.modules.json` and every other `*.modules.json`) contain no module
@@ -1135,8 +1138,8 @@ Also asked, not blocking: whether `/referral-stats` counts referrals made throug
 | `extension/src/app/presale/` | 1a (`index.ts` skeleton), 1b, 2 | #23, #20 purchase variant, #50b, #24, the routes, `presaleSlots` |
 | `extension/src/app/App.tsx`, `router.ts`, `screens/Settings.tsx`, `TxDetail.tsx` | 1b, 2 | resume, guarded routes, #31 row, #27 line |
 | `extension/src/unlock/presale.ts` | 1a (skeleton), 1b | #10's purchase description |
-| `core/geo/fetch.ts`, `core/presale/limits.ts`, `core/solana/encoding.ts` | 1a | fetcher; bigint limits, ticks, rents; the moved helpers |
-| `core/presale/addresses.ts`, `core/presale/buyInstructions.ts`, `core/presale/record.ts` | 1a, 1b, 2 | the vault ATAs; the `sourceTokenAccount` parameter and the re-exports; `paymentAmount: number \| string` |
+| `core/geo/fetch.ts`, `core/presale/limits.ts`, `core/solana/encoding.ts` | 1a | fetcher; bigint limits, ticks, rents; the three moved symbols (`SPL_TOKEN_PROGRAM`, `encodeU64LE`, `findAssociatedTokenAddress`) |
+| `core/presale/addresses.ts`, `core/presale/buyInstructions.ts`, `core/presale/record.ts`; `core/solana/{transfer,history,balances}.ts` | 1a, 1b, 2 | the vault ATAs; the `sourceTokenAccount` parameter and the three re-exports; `paymentAmount: number \| string`; the imports from `encoding.ts` (1a) |
 | `extension/e2e/presale*.spec.ts`, `visual-presale.spec.ts`, `fakeCoordinator.ts` | 1b, 2 | E2E, visual, fake program state |
 
 Facts re-read for this spec: `core/presale/{addresses,allocation,buyInstructions,purchaseGate,record,referrer,stats,stagePrices}.ts`,
````

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates.**

Run: the Step 2 command — expected `Test Files  2 passed (2)` · `Tests  47 passed (47)` (check-no-presale.test.mjs 35, presaleBuilds.test.mjs 12).

Run: `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  180 passed (180)` · `Tests  3534 passed (3534)` (previous tree 179 / 3498: +1 file, +36 tests). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  5 passed (5)` · `Tests  120 passed (120)` (unchanged: the gate's tests are not off-build tests).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0; the seven gates print their lines once per build as before, and the last line is
`no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 3 required modules; 0 markers (none in the off build, each in the on build); 2 strings and the decoder's instruction names stay in the off build`.

Negative controls from the command line: `node scripts/check-no-presale.mjs dist dist-nopresale` (swapped) — exit 1, 8 lines: both `app.features.json` lines, the three on-path entries carried by the "off" build, the three missing from the "on" build. `node scripts/check-no-presale.mjs dist-nopresale` — the usage line, exit 1.

`npm run csp` — ok for both; `npm run reproducible` — four lines, the presale and no-presale digests equal (unchanged from Task 1: no bundled source changed). Repository root `node scripts/check-no-tge-date.mjs` — `no TGE date in 1252 tracked text files`. No `core/` or root `src/` change: root `tsc`/`jest` and web `verify` not required.

- [ ] **Step 5: Commit.**

```bash
git add extension/scripts/check-no-presale.mjs extension/scripts/__tests__/check-no-presale.test.mjs extension/scripts/__tests__/fixtures/app.modules.0b79442.json extension/scripts/__tests__/presaleBuilds.test.mjs extension/package.json docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
git commit -m "feat(extension): B1d-1a — the off-build gate check-no-presale.mjs (C38 allowlist, staged positive controls, markers, must-stay, 0b79442 fixture self-test) in npm run gates; spec: three moved symbols"
```
(with the executing model's trailer.)

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive` copy; `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test.** Build mutations (B): `extension/node_modules` copied, the two test files run, then both builds and the gate CLI. Gate mutations (U): `check-no-presale.test.mjs`.

| id | the change | named test → observed |
|---|---|---|
| M2a (B) | `core/solana/transfer.ts`: `encodeU64LE, findAssociatedTokenAddress` imported from `'../presale/buyInstructions'` again (the pre-move state — a disallowed core module leaks) | presaleBuilds.test.mjs “the off-build gate … passes on the two builds” + Task 1's “both: the moved helpers … in neither (M2)” — tsc 0 · RED `Test Files  1 failed \| 1 passed (2)` · `Tests  2 failed \| 45 passed (47)`; CLI exit 1: `off build carries core/presale/buyInstructions.ts — of core/presale/ it may carry only …` |
| M2b (B) | `src/background/index.ts`: `import {nocStringToBase} from '../../../core/presale/stats'` + `console.debug(nocStringToBase('1'))` (shared code pulls a non-allowlisted core/presale module) | presaleBuilds.test.mjs “the off-build gate …” — tsc 0 · RED `Tests  1 failed \| 46 passed (47)`; CLI exit 1: `off build carries core/presale/stats.ts — …` |
| M2c (B) | new `src/background/presale/leak.ts` (`export const LEAK = 'leak-x'`), imported and logged by `src/background/index.ts` (a presale-directory module reached from shared code, not through an entry) | presaleBuilds.test.mjs “the off-build gate …” + Task 1's “off: no module under a presale directory at all” — tsc 0 · RED `Tests  2 failed \| 45 passed (47)`; CLI exit 1: `off build carries src/background/presale/leak.ts — a presale module (…)` |
| M2d (B) | `MARKERS = ['Presale purchase']` (a marker that lives in shared code — the leak §6.2 item 2 says “fails the scan itself”) | check-no-presale.test.mjs “1a ships no marker…”, “no marker overlaps…”, the checkNoPresale synthetic rows; presaleBuilds.test.mjs “the off-build gate …” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  8 failed \| 39 passed (47)`; CLI exit 1: `off build: app/assets/mount-….js contains the presale marker "Presale purchase"` (and chrome/, firefox/) |
| M2e (U) | `offModuleViolations`: the `core/presale/` allowlist branch deleted | “self-test: the map of commit 0b79442 … fails naming exactly core/presale/buyInstructions.ts”, the six core/presale `it.each` rows, “fails when a presale module leaks … in any module map” — tsc 0 · RED `Tests  8 failed \| 27 passed (35)` |
| M2f (U) | `OFF_FORBIDDEN` without `'core/referral/'` | “refuses ../core/referral/index.ts in the off build” — tsc 0 · RED `Tests  1 failed \| 34 passed (35)` |
| M2g (U) | `normalize`: the query/hash strip removed | “refuses src/unlock/presale.ts?v=1 in the off build” — tsc 0 · RED `Tests  1 failed \| 34 passed (35)` |
| M2h (U) | `markerViolations`: the off-build loop deleted (only the on-build control left) | “a marker in any off-build file is a violation…”, “fails when a marker is in the off build, in chrome/ or firefox/ alone too” — tsc 0 · RED `Tests  2 failed \| 33 passed (35)` |
| M2i (U) | `checkNoPresale`: the on build's `missingModules` call deleted (the positive control gone) | “fails when the on build lacks a positive-control module” — tsc 0 · RED `Tests  1 failed \| 34 passed (35)` |
| M2j (U) | `featureViolations`: `const ok = true \|\| …` | “app.features.json must say what its directory is”, “is INCONCLUSIVE without … app.features.json …” — tsc 0 · RED `Tests  2 failed \| 33 passed (35)` |
| M2k (U) | `checkNoPresale`: the `missingStrings` call deleted | “fails when a must-stay string or a decoder name is missing from the off build” — tsc 0 · RED `Tests  1 failed \| 34 passed (35)` |
| M2l (U) | `decoderInstructionNames`: the pattern reads `discriminators:` (a format drift) | “the decoder names are read from presaleIdl.ts exactly as the module exports them” and every synthetic checkNoPresale row (INCONCLUSIVE line) — tsc 0 · RED `Tests  7 failed \| 28 passed (35)` |
| M2m (U) | `readBuild`: only `app.modules.json` read (`.filter(f => f === 'app.modules.json')`) | “fails when a presale module leaks into the off build — in any module map” — tsc 0 · RED `Tests  1 failed \| 34 passed (35)` |
| M2n (U) | `ON_BUILD` without `'src/unlock/presale.ts'` (the staged list loosened) | “the on build must carry the three on-path entries…” — tsc 0 · RED `Tests  1 failed \| 34 passed (35)` |
| M2o (U) | `package.json` `gates`: ` && node scripts/check-no-presale.mjs dist-nopresale dist` removed | “wiring › npm run gates runs the gate once…” — tsc 0 · RED `Tests  1 failed \| 34 passed (35)` |
| M2p (U) | `CORE_PRESALE_ALLOWED` gains `'core/presale/buyInstructions.ts'` (the allowlist loosened) | the 0b79442 self-test, “allows exactly addresses, allocation and stagePrices…”, two `it.each` rows — tsc 0 · RED `Tests  4 failed \| 31 passed (35)` |

**Green controls (the same procedure — each must stay green):**

| id | the change | observed |
|---|---|---|
| G1 (B) | `src/background/index.ts` imports and logs `ALLOCATION_ACCOUNT_LENGTH` from `core/presale/allocation.ts` (an allowlisted core module now in the off build) | tsc 0 · `Tests  47 passed (47)` · CLI `no presale ok …` exit 0; the off map carries `../core/presale/allocation.ts` (it did not before) |
| G2 (B) | `src/background/index.ts` imports and logs `typeof evaluateListFreshness` from `core/geo/freshness.ts` (D15: core/geo allowed) | tsc 0 · `Tests  47 passed (47)` · CLI exit 0; the off map carries `../core/geo/freshness.ts` |

Recorded, not a mutation: the first M2b (`MIN_PURCHASE_USD`, a constant, from `purchaseGate.ts`) stayed green — the bundler inlined the constant and `purchaseGate.ts` is not in either map; the function import above is the valid mutant (see "What the gate can and cannot see").

#### Dry-run notes (Task 2)

- **Ruling: core module ids are normalized to `core/…` (the maps write `../core/…`) and query/hash are stripped before every rule** — why: §6.2 names `core/presale/**`; a `?commonjs-proxy`-style suffix must not let `src/unlock/presale.ts` (an exact-path rule) through (M2g) — cost if wrong: none found; ids starting `\0` (virtual) are left as they are and match no rule.
- **Ruling: the gate reads every `*.modules.json` beside the packages, `chunks` only** — why: §6.2 "every other `*.modules.json`"; a chunk's moduleIds include its stylesheets, so the `css` table adds nothing (M2m proves the other maps are read).
- **Ruling: a problem that makes a rule unreadable is `INCONCLUSIVE` and fails the gate** (no `app.modules.json`, a map without chunks, an empty map set, a missing `app/`/`chrome/`/`firefox/`, no decoder names read), like `check-page-bundles.mjs` — never a pass.
- **Ruling: the decoder's instruction names are read from `presaleIdl.ts`'s source by pattern, not listed in the gate** — why: §6.2 item 3 says "the decoder's instruction names" (36 today); a copied list drifts. The test compares the pattern's result to the imported `PRESALE_INSTRUCTIONS` names, so a format change is caught (M2l) rather than silently reading fewer.
- **Ruling: the staging is per task inside 1a, not only per plan** — §6.2's 1a positive-control list names `presale/{layouts,state}.ts` and `core/presale/limits.ts` (Task 5) and "both builds contain `src/background/geo/gate.ts` and `core/geo/fetch.ts`" (Task 6); the must-stay list names Q42 (Task 4). Those modules and strings do not exist at Task 2, so each task appends its own entries in the same commit that creates them (`ON_BUILD`, `BOTH_BUILDS`, `MUST_STAY`), and updates the test row that pins the list (“the on build must carry …”, `BOTH_BUILDS` `[]`, `MUST_STAY` `toEqual`). At the end of 1a the lists equal §6.2's 1a text.
- **Ruling: `MARKERS` is empty in 1a and the gate refuses a marker shorter than 8 characters** — §6.2 item 2 ("1a's list is empty"; "each literal part of at least 8 characters"). A marker containing a non-ASCII character is matched as UTF-8 bytes only; if the bundler escapes it (`\u…`) the marker's own on-build control fails, so it cannot pass silently — 1b decides the form when it arms the list.
- **Ruling: the gate also runs inside vitest over the two real builds `presaleBuilds.test.mjs` already makes (and swapped as the negative)** — why: the unit tests use synthetic directories; this one shows the gate passes on the product, at no extra build cost.
- **Ruling: the wiring is tested** (`package.json` `gates` carries the gate exactly once, off build first; `verify` runs `build` and `gates`) — why: otherwise removing it from `gates` is invisible (M2o).
- **Deviation (stated): the spec says the gate is "in `npm run verify`"; it is in `npm run gates`, which `verify` runs after building both** — the brief's wording; same effect.
- **Spec text fixed** (Task 1's ruling): C38, §1.2, §6.2 and §8.2 now say three symbols move — `SPL_TOKEN_PROGRAM`, `encodeU64LE`, `findAssociatedTokenAddress` — and name `history.ts:3` / `balances.ts:3` beside `transfer.ts:3` (verified at 923b714). The review-1 table row (§11) is history and was left as written.
- **For Task 4:** append Q42's literal (each part ≥ 8 characters between placeholders, as it appears in the bundle) to `MUST_STAY` and to the `MUST_STAY` `toEqual` row.
- **For Task 5:** append `src/background/presale/layouts.ts`, `src/background/presale/state.ts`, `core/presale/limits.ts` to `ON_BUILD` and its test row (“the on build must carry …” then compares `ON_BUILD` to the entries plus these three). They must be reachable from the on-path entry (`presale/api.ts`) for the on map to carry them — a module only tests import is not in the bundle and the positive control would fail. `core/presale/limits.ts` is refused in the off build already (`it.each` row).
- **For Task 6:** append `src/background/geo/gate.ts` and `core/geo/fetch.ts` to `BOTH_BUILDS` (and its `toEqual([])` row) — both builds are then required to carry them (D15's control). `core/geo/**` is already allowed off (G2).
- **(rev 2) The header comment of `check-no-presale.mjs`** says what is true at every task: the packages were byte-identical through Task 4, and from Task 5 the on build carries the presale background modules, so the maps remain the evidence (review 1 M4). Only the comment changed; no test or count moved.
- **For 1b:** arm `MARKERS` (§6.2 item 2 list) and append F12's Q49–Q51 to `MUST_STAY`. **(rev 2, review 1 L3)** Rule 1 proves "no presale *code*", not "no presale *value*": a constant imported from a forbidden module is inlined and leaves the off map unchanged (recorded above). So when 1b arms `MARKERS` it must include **at least one marker per forbidden module that exports a constant** — a string literal that module alone defines — so that a const-folded leak turns rule 2 red; 1a has no such value.

---

### Task 3: The intent-kind registry and the shared shapes — `PreparedEntry.kind`, the kind in the challenge digest (its domain) and in the integrity digest, `sendPrepared` in C29's order (`beforeSign` after `challengeSatisfied`, before `takePrepared` / `consumeChallenge`), `PendingRecord.extra` and the validator's third shape (a `presale-buy` record: `intent: null`, `origin: null`), `inFlightFor` across kinds, `viewOf` copying `extra` — every existing send byte-for-byte unchanged, proven against a capture of commit 0b79442's own code (a SOL send with a challenge, a USDC send without, a dApp record); `wallet.send` signs only a send (D17) (FUNDS-CRITICAL)

**Spec:** B1d §1.3 (all), §2.3, §6.1 "Shared shapes (1a)" and "Pipeline order (1a)", "Switch, off build" (the registry and a stored purchase record in the off run); C10, C19, C29; review 1 H1, M4; owner decision D17 (rev 2: `wallet.send` signs only `kind: 'send'` — the spec sentence lands in Task 6's rev 3.1 edit). Brief item 3: "Existing sends byte-for-byte unchanged (their digests/integrity must not change — prove with fixtures from today's code)".

**Files:**
- Create: `extension/src/background/intents.ts` (the registry)
- Create: `extension/src/background/__tests__/captured/sends.0b79442.json` (generated in Step 1 by running the capture program below in a `git archive 0b79442` copy — never hand-edited)
- Create: `extension/src/background/__tests__/intents.test.ts`, `extension/src/background/__tests__/pendingKinds.test.ts` (both also run in the off build's vitest run)
- Modify: `extension/src/background/prepare.ts` (`PreparedEntry` / `PreparedSend`, `kind`, `preparedIntegrity` per kind, `SEND_INTENT` registered, `storePrepared` extracted, `preparedFor` sends only), `extension/src/background/send.ts` (`sendPrepared` kind-agnostic in C29's order), `extension/src/background/pending.ts` (`submitSigned` takes an intent or an `extra`), `extension/src/background/pendingStore.ts` (`extra`, the third shape, `extraOf`, `viewOf`, the stored form)
- Modify (the gate's staged lists, Task 2's ruling): `extension/scripts/check-no-presale.mjs` (`BOTH_BUILDS` gains `src/background/intents.ts`), `extension/scripts/__tests__/check-no-presale.test.mjs`
- Modify (the off run, Task 1's ruling): `extension/vitest.nopresale.config.ts` (`NOPRESALE_TESTS` gains the two new files), `extension/scripts/__tests__/presaleSwitch.test.mjs` (one row pins them)
- Modify (tests of the changed shapes): `extension/src/background/__tests__/fixtures.ts` (`pendingRecord` sets `extra: null`), `extension/src/background/__tests__/prepare.test.ts` (two `peekPrepared` reads typed `PreparedSend`), `extension/src/background/__tests__/pendingStore.test.ts` (the one junk row whose verdict B1d changes)

**Interfaces:**
- Consumes: B1b's `prepareSend` / `peekPrepared` / `takePrepared` / `preparedFor` / `discardPrepared` / `preparedIntegrity` / `sendIntentDigest` / `parseIntent` (`prepare.ts`), `sendPrepared` / `signPrepared` (`send.ts`), `submitSigned` / `pollOnce` / `resend` / `recordDappSend` (`pending.ts`), `readPending` / `updatePending` / `inFlightFor` / `viewOf` (`pendingStore.ts`), `challengeSatisfied` / `consumeChallenge` / `issueChallenge` (`reauthChallenges.ts`), `digestOf` (`digest.ts`); Task 1's `registerPresale` (`presale/api.ts`, its stub off) and `NOPRESALE_TESTS`; Task 2's `BOTH_BUILDS`.
- Produces (`src/background/intents.ts`):
  ```ts
  export const SEND_KIND: 'send';
  export const KIND_NAME: RegExp;                     // /^[a-z][a-z0-9-]{0,31}$/ — a kind's name, and what PendingRecord.extra.kind must match
  export interface KindHost {ext: Ext; deps: WalletDeps}
  export interface IntentKind<I> {
    readonly kind: string;
    parseIntent(x: unknown): I | null;                // untrusted or stored → the intent rebuilt key by key, or null
    digestValue(account: string, intent: I): unknown; // plain JSON, key by key; hashed UNDER THE KIND by intentDigest
    beforeSign(host: KindHost, entry: PreparedEntry, intent: I): Promise<void>; // throws SendRefused to refuse (C29)
    pendingData?(entry: PreparedEntry, intent: I): unknown; // the record's extra.data — display only; never asked of send
  }
  export function registerIntentKind<I>(k: IntentKind<I>): void;   // throws on a non-kind name and on a second registration
  export function intentKind(kind: string): IntentKind<unknown> | undefined;
  export function registeredKinds(): string[];
  export function intentDigest<I>(k: IntentKind<I>, account: string, intent: I): string;  // digestOf(k.kind, k.digestValue(…))
  ```
- Produces (`src/background/prepare.ts`): `interface PreparedEntry {id; account; kind: string; intent: unknown; message; lastValidBlockHeight; createdAt; intentDigest; challengeId; integrity; shown: {fees: {networkLamports; markupLamports}; simulation: object}}`; `interface PreparedSend extends PreparedEntry {kind: 'send'; intent: SendIntent; shown: …B1b's…}`; `SEND_INTENT: IntentKind<SendIntent>` (registered when prepare.ts loads); `preparedIntegrity(p: Omit<PreparedEntry, 'integrity' | 'shown'>): string` (throws `SendRefused('prepared-invalid')` for an unregistered kind or an intent its kind does not read); `storePrepared(ext, deps: Pick<WalletDeps, 'now'>, entry: PreparedEntry): Promise<void>` (the lock check and the one-entry-per-account replacement, across kinds); `peekPrepared` / `takePrepared` → `PreparedEntry`; `preparedFor` → kind `send` only.
- Produces (`src/background/pendingStore.ts`): `interface PendingExtra {kind: string; data: unknown}`; `PendingRecord.extra: PendingExtra | null` (and so `PendingView.extra`); the stored form omits `extra` when null.
- Produces (`src/background/pending.ts`): `submitSigned(ext, deps, input: {account; wire; lastValidBlockHeight; fee} & ({intent: SendIntent; extra?: null} | {intent: null; extra: PendingExtra}))` — every existing call unchanged.
- `sendPrepared(ext, deps, id, kindName: string = SEND_KIND)` — every existing call unchanged (the fourth argument defaults to `send`; `wallet.send` passes none), the order of §1.3: session (`locked`) → `peekPrepared` (`unknown-prepared`; **(rev 2, D17) also an entry whose `kind` is not `kindName` — nothing burned, so `wallet.send` signs only a send and 1b's `presale.buy` passes `'presale-buy'`**) → the kind registered and its `parseIntent` of the entry's intent (else `prepared-invalid`) → `challengeSatisfied` on `intentDigest(kind, …)` (`reauth-required` + id, nothing burned) → **`kind.beforeSign`** (a refusal burns nothing) → `takePrepared` (TTL: `prepared-expired`) → the taken entry's `integrity` and `kind` equal the peeked one's (else `prepared-invalid`) → integrity and digest recomputed (as B1b) → `consumeChallenge` → session → `signPrepared` → `submitSigned` with the send's intent, or `{intent: null, extra: {kind, data: pendingData(…) ?? null}}` for any other kind.

**How "byte-for-byte unchanged" is reached (read before Step 3):** the challenge digest of a send was already `digestOf('send', {account, token, recipient, amount})` — the kind enters every digest as `digestOf`'s domain, so a send's is the same bytes and every other kind's is another binding. The integrity of a send keeps B1b's domain `prepared` and every other kind hashes under `prepared/<kind>` (both forms are injective: no kind maps to `prepared`). The send's intent in the integrity is `parseIntent`'s rebuild — token, recipient, amount in B1b's order. A pending record carries `extra` in memory (`| null`, required) but is written with it only when set, so a send's and a dApp's stored record is B1b's bytes. Each of these is compared with what commit 0b79442's own code computed and stored (the capture of Step 1), not with a hand-written expectation. **What "equal" means, exactly (rev 2, review 1 L2):** the digests, the integrity, the challenges, the pending records (sent and polled) and the validator's verdicts equal the capture byte for byte; a stored prepared entry equals it **but for its new `kind` key** (the replay compares the entry with `kind` removed, and asserts `kind: 'send'` separately). A prepared entry stored before the update (no `kind`) is not read (`isPreparedShape`, fail closed) — `sendPrepared` answers `unknown-prepared` and the popup prepares again, carrying the challenge, whose digest is unchanged (tested).

- [ ] **Step 1: Capture commit 0b79442's send pipeline, then write the failing tests.**

The fixture is the output of the program below, run once in a scratch copy of commit 0b79442 (main before B1d; its `prepare.ts`, `send.ts`, `pending.ts`, `pendingStore.ts`, `digest.ts`, `reauthChallenges.ts`, `session.ts`, `sendTypes.ts`, `knownRecipients.ts`, `fixtures.ts`, `fakeDeps.ts`, `fakeExt.ts`, `core/solana/rpc.ts`, `core/solana/broadcast.ts` and `core/fees/transferMarkup.ts` are identical to Task 2's tree — `git diff --quiet 0b79442 HEAD -- <those>` exits 0; the USDC flow also runs `core/solana/transfer.ts` and `balances.ts`, which differ from Task 2's only by Task 1's import move to `encoding.ts` — the replay on the new tree is what shows the moved helpers build the same bytes). The program is not committed. From the repository root:

```bash
F=$(mktemp -d)
OUT="$PWD/extension/src/background/__tests__/captured/sends.0b79442.json"
git archive 0b79442 | tar -x -C "$F"
ln -s "$PWD/node_modules" "$F/node_modules"; ln -s "$PWD/web/node_modules" "$F/web/node_modules"; ln -s "$PWD/extension/node_modules" "$F/extension/node_modules"
cat > "$F/extension/src/background/__tests__/capture-sends.test.ts" <<'CAPTURE'
// B1d-1a Task 3, Step 1: run ONCE in a `git archive 0b79442` copy (never committed). It records what the send pipeline
// of commit 0b79442 (main before B1d) computes and stores, so the tests of the change compare against that code's own
// output, not against hand-written expectations. Output: the JSON file named by CAPTURE_OUT.
import {writeFileSync} from 'node:fs';
import {sendPrepared} from '../send';
import {preparedIntegrity, prepareSend, sendIntentDigest} from '../prepare';
import {satisfyChallenge} from '../reauthChallenges';
import {PREPARED_KEY, REAUTH_KEY} from '../session';
import {PENDING_KEY, markDue, readPending, updatePending, type PendingRecord} from '../pendingStore';
import {pollOnce, recordDappSend} from '../pending';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {firstSignature} from '../../../../core/solana/broadcast';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, HOLDING_LARGE, RECIPIENT, pendingRecord, sendReader, signedWire, unlocked} from './fixtures';

const text = (v: unknown): string => JSON.stringify(v);
const without = (r: PendingRecord, key: keyof PendingRecord): Record<string, unknown> => Object.fromEntries(Object.entries(r).filter(([k]) => k !== key));
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

it('captures the send pipeline of this commit', async () => {
  const out = process.env.CAPTURE_OUT;
  if (out === undefined) throw new Error('CAPTURE_OUT is not set');

  // 1. The challenge digest of a send, over the four tokens, two accounts and the u64 bounds.
  const intents = [
    {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'},
    {token: 'NOC' as const, recipient: HOLDING_LARGE, amount: '123456789'},
    {token: 'USDC' as const, recipient: RECIPIENT, amount: '1'},
    {token: 'USDT' as const, recipient: ACCOUNT.publicKey, amount: '18446744073709551615'},
  ];
  const digests = [ACCOUNT.publicKey, RECIPIENT].flatMap(account => intents.map(intent => ({account, intent, digest: sendIntentDigest(account, intent)})));

  // 2. The integrity of a stored prepared send, with and without a challenge.
  const integrity = [null, 'ab'.repeat(16)].map(challengeId => {
    const entry = {id: 'cd'.repeat(16), account: ACCOUNT.publicKey, intent: intents[0]!, message: 'AQID', lastValidBlockHeight: 1000, createdAt: 1_000_000, intentDigest: 'ef'.repeat(32), challengeId};
    return {entry, integrity: preparedIntegrity(entry)};
  });

  const confirm = (deps: ReturnType<typeof fakeDeps>) => {
    deps.reader = {...deps.reader, getSignatureStatuses: async sigs => sigs.map(() => ({err: null, confirmationStatus: 'confirmed' as const})), getBlockHeight: async () => 900};
  };
  const engine = (reader = sendReader()) => {
    const deps = fakeDeps({reader});
    deps.broadcast = async wire => {
      deps.broadcasts.push(wire);
      return firstSignature(wire);
    };
    return deps;
  };

  // 3. One real send through the engine: prepared (a new recipient, so a challenge), proven, sent, confirmed.
  const ext = fakeExt();
  await unlocked(ext);
  const deps = engine();
  const view = await prepareSend(ext, deps, ACCOUNT.publicKey, intents[0]!);
  const prepared = text(await ext.session.get(PREPARED_KEY));
  const challenges = text(await ext.session.get(REAUTH_KEY));
  await satisfyChallenge(ext, deps.now(), view.reauth!.challengeId);
  await sendPrepared(ext, deps, view.id);
  const sent = text(await ext.local.get(PENDING_KEY));
  confirm(deps);
  await pollOnce(ext, deps);
  const polled = text(await ext.local.get(PENDING_KEY));

  // 3b. A token send through the engine (review 1 L1): USDC to a known recipient — no challenge, the SPL network fee.
  const uext = fakeExt();
  await unlocked(uext);
  await uext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  const udeps = engine(sendReader({getTokenAccountsByOwner: async () => [{pubkey: HOLDING_LARGE, mint: USDC_MINT, owner: ACCOUNT.publicKey, amount: 25_000_000n, decimals: 6}]}));
  const usdcIntent = {token: 'USDC' as const, recipient: RECIPIENT, amount: '1000000'};
  const uview = await prepareSend(uext, udeps, ACCOUNT.publicKey, usdcIntent);
  if (uview.reauth !== null) throw new Error('the USDC send asked for a re-authentication');
  const uprepared = text(await uext.session.get(PREPARED_KEY));
  const ureauth = text((await uext.session.get(REAUTH_KEY)) ?? null);
  await sendPrepared(uext, udeps, uview.id);
  const usent = text(await uext.local.get(PENDING_KEY));
  confirm(udeps);
  await pollOnce(uext, udeps);
  const upolled = text(await uext.local.get(PENDING_KEY));

  // 3c. A dApp record through the engine (review 1 L1): recorded held, promised (due), handed to the route by the
  // poller's first round and confirmed by the next.
  const dext = fakeExt();
  await unlocked(dext);
  const ddeps = engine();
  const wire = signedWire(11n);
  await recordDappSend(dext, ddeps, {account: ACCOUNT.publicKey, wire, lastValidBlockHeight: 1000, origin: 'https://noc-tura.io'});
  const held = text(await dext.local.get(PENDING_KEY));
  await markDue(dext, [firstSignature(wire)]);
  const due = text(await dext.local.get(PENDING_KEY));
  await pollOnce(dext, ddeps);
  const handed = text(await dext.local.get(PENDING_KEY));
  const dappBroadcasts = ddeps.broadcasts.length;
  confirm(ddeps);
  await pollOnce(dext, ddeps);
  const dpolled = text(await dext.local.get(PENDING_KEY));

  // 4. The validator's verdict on stored elements of every shape this commit knows, and its rewrite of them.
  const send = pendingRecord({id: 'send', account: ACCOUNT.publicKey, signature: 'sig-send', fee: {networkLamports: '5050', markupLamports: '0'}});
  const dapp = pendingRecord({id: 'dapp', account: ACCOUNT.publicKey, signature: 'sig-dapp', intent: null, origin: 'https://noc-tura.io', firstBroadcast: 'held'});
  const input: unknown[] = [
    send,
    {...without(send, 'failure'), id: 'before-e8'},
    {...without(send, 'fee'), id: 'before-fee'},
    {...without(send, 'detailCode'), id: 'before-code'},
    {...without(without(send, 'origin') as unknown as PendingRecord, 'firstBroadcast'), id: 'before-origin'},
    {...send, id: 'stuck', state: 'stuck', detail: 'x', detailCode: 'unacked', failure: null},
    {...send, id: 'landed', state: 'failed', failure: 'landed'},
    dapp,
    {...dapp, id: 'dapp-due', firstBroadcast: 'due'},
    {...without(dapp, 'firstBroadcast'), id: 'dapp-old'},
    {...send, id: 'own-held', firstBroadcast: 'held'},
    {...send, id: 'bad-state', state: 'bogus'},
    {...send, id: 'bad-failure', failure: 'weird'},
    {...send, id: 'http-origin', origin: 'http://noc-tura.io', intent: null},
    {...dapp, id: 'dapp-with-intent', intent: send.intent},
    {...send, id: 'bad-intent', intent: {token: 1, recipient: 'R', amount: '1'}},
    {...without(send, 'intent'), id: 'no-intent'},
    {...send, id: 'bad-signature', signature: 7},
  ];
  const vext = fakeExt();
  await vext.local.set(PENDING_KEY, input);
  const read = text(await readPending(vext));
  await updatePending(vext, records => records);
  const rewritten = text(await vext.local.get(PENDING_KEY));

  // 5. The one shape B1d-1a changes the verdict on (review H1): the wallet's own record with a null intent.
  const hext = fakeExt();
  await hext.local.set(PENDING_KEY, [{...send, id: 'own-null-intent', intent: null}]);
  const ownNullIntent = (await readPending(hext)).length === 0 ? 'dropped' : 'kept';

  writeFileSync(
    out,
    `${JSON.stringify(
      {
        capturedFrom:
          'commit 0b79442 — extension/src/background/__tests__/capture-sends.test.ts of the B1d-1a plan (Task 3, Step 1), run in a git archive of that commit; never edited by hand',
        digests,
        integrity,
        flow: {intent: intents[0], prepared, challenges, sent, polled},
        usdcFlow: {intent: usdcIntent, holding: {pubkey: HOLDING_LARGE, mint: USDC_MINT, amount: '25000000', decimals: 6}, prepared: uprepared, challenges: ureauth, sent: usent, polled: upolled},
        dappFlow: {wireLamports: '11', origin: 'https://noc-tura.io', held, due, handed, broadcasts: dappBroadcasts, polled: dpolled},
        validator: {input, read, rewritten, ownNullIntent},
      },
      null,
      2,
    )}\n`,
  );
});
CAPTURE
mkdir -p "$(dirname "$OUT")"
(cd "$F/extension" && CAPTURE_OUT="$OUT" npx vitest run src/background/__tests__/capture-sends.test.ts)
rm -rf "$F"
```

Expected (the dry run, twice — the capture is deterministic: fake clock, counting random bytes, Ed25519): `Tests  1 passed (1)`; the fixture is 35 990 bytes, sha256 `fed8cc8c630fe6845c0a3ccf17afb83a7ed586360dc0ea638bf122d5d24b805f` (rev 2; rev 1's 28 736-byte `e6f68036…dae1` had no `usdcFlow` / `dappFlow` — its five other keys are byte-identical in the rev 2 capture); keys `capturedFrom, digests (8 rows), integrity (2 rows), flow {intent, prepared, challenges, sent, polled}, usdcFlow {intent, holding, prepared, challenges (null: no challenge), sent, polled}, dappFlow {wireLamports, origin, held, due, handed, broadcasts (1), polled}, validator {input (18 elements), read, rewritten, ownNullIntent}`; the USDC record's `fee` is `{networkLamports: '7000', markupLamports: '0'}` (the SPL network fee, priority included); `validator.read` keeps 11 of the 18 (`send`, `before-e8`, `before-fee`, `before-code`, `before-origin`, `stuck`, `landed`, `dapp`, `dapp-due`, `dapp-old`, `own-held`); `ownNullIntent` is `"dropped"`.

Create `extension/src/background/__tests__/intents.test.ts`:

````ts
import {readFileSync} from 'node:fs';
import {base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {KIND_NAME, SEND_KIND, intentDigest, intentKind, registerIntentKind, registeredKinds, type IntentKind, type KindHost} from '../intents';
import {PREPARED_TTL_MS, SEND_INTENT, parseIntent, peekPrepared, preparedFor, preparedIntegrity, prepareSend, sendIntentDigest, storePrepared, type PreparedEntry} from '../prepare';
import {sendPrepared} from '../send';
import {challengeSatisfied, issueChallenge, satisfyChallenge} from '../reauthChallenges';
import {PREPARED_KEY, REAUTH_KEY, clearSession} from '../session';
import {PENDING_KEY, markDue, readPending} from '../pendingStore';
import {pollOnce, recordDappSend} from '../pending';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {handleWallet} from '../walletApi';
import {randomId} from '../digest';
import {SendRefused, type SendIntent} from '../sendTypes';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {registerPresale} from '../presale/api';
import {firstSignature} from '../../../../core/solana/broadcast';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, SETTINGS_ABOUT, pendingRecord, sendReader, signedWire, unlocked} from './fixtures';

/** What commit 0b79442 (main before B1d) computed and stored — generated by the plan's capture step, never edited. */
interface Captured {
  capturedFrom: string;
  digests: {account: string; intent: SendIntent; digest: string}[];
  integrity: {entry: Omit<PreparedEntry, 'kind' | 'integrity' | 'shown'> & {intent: SendIntent}; integrity: string}[];
  flow: {intent: SendIntent; prepared: string; challenges: string; sent: string; polled: string};
  usdcFlow: {intent: SendIntent; holding: {pubkey: string; mint: string; amount: string; decimals: number}; prepared: string; challenges: string; sent: string; polled: string};
  dappFlow: {wireLamports: string; origin: string; held: string; due: string; handed: string; broadcasts: number; polled: string};
}
const CAPTURED = JSON.parse(readFileSync(new URL('./captured/sends.0b79442.json', import.meta.url), 'utf8')) as Captured;

/** A kind of this test only: an amount, bound with the account; its checks are whatever `gate.beforeSign` does. */
interface TestIntent {
  amount: string;
}
const gate: {beforeSign: (host: KindHost, entry: PreparedEntry, intent: TestIntent) => Promise<void>; calls: {entry: PreparedEntry; intent: TestIntent}[]} = {
  beforeSign: async () => undefined,
  calls: [],
};
const TEST_BUY: IntentKind<TestIntent> = {
  kind: 'test-buy',
  parseIntent: x => {
    if (typeof x !== 'object' || x === null) return null;
    const {amount} = x as Record<string, unknown>;
    return typeof amount === 'string' && /^[1-9]\d{0,19}$/.test(amount) ? {amount} : null;
  },
  digestValue: (account, i) => ({account, amount: i.amount}),
  beforeSign: async (host, entry, intent) => {
    gate.calls.push({entry, intent});
    await gate.beforeSign(host, entry, intent);
  },
  pendingData: (entry, i) => ({amount: i.amount, preparedAt: entry.createdAt}),
};
/** A kind that reads and binds exactly what a send does: only the kind tells the two apart. */
const TWIN: IntentKind<SendIntent> = {kind: 'test-twin', parseIntent, digestValue: (account, i) => ({account, token: i.token, recipient: i.recipient, amount: i.amount}), beforeSign: async () => undefined};
registerIntentKind(TEST_BUY);
registerIntentKind(TWIN);

const INTENT: SendIntent = {token: 'SOL', recipient: RECIPIENT, amount: '1000000'};
/** The unsigned message of a real transfer from ACCOUNT (the payer is what signPrepared checks). */
const MESSAGE = base64.encode(VersionedTransaction.deserialize(signedWire(3n)).message.serialize());

function setup(reader = sendReader()) {
  const ext = fakeExt();
  const deps = fakeDeps({reader});
  deps.broadcast = async wire => {
    deps.broadcasts.push(wire);
    return firstSignature(wire);
  };
  return {ext, deps};
}

/** Stores a prepared entry of `kind` exactly as a kind's prepare would: integrity and intent digest computed, account's other entries replaced. */
async function store(ext: ReturnType<typeof fakeExt>, deps: ReturnType<typeof fakeDeps>, o: {kind?: IntentKind<unknown>; intent?: unknown; challengeId?: string | null; account?: string; message?: string} = {}): Promise<PreparedEntry> {
  const kind: IntentKind<unknown> = o.kind ?? TEST_BUY;
  const intent = o.intent ?? {amount: '5'};
  const account = o.account ?? ACCOUNT.publicKey;
  const parsed = kind.parseIntent(intent);
  if (parsed === null) throw new Error('the test intent does not parse');
  const bound = {
    id: randomId(deps.randomBytes),
    account,
    kind: kind.kind,
    intent,
    message: o.message ?? MESSAGE,
    lastValidBlockHeight: 1000,
    createdAt: deps.now(),
    intentDigest: intentDigest(kind, account, parsed),
    challengeId: o.challengeId ?? null,
  };
  const entry: PreparedEntry = {...bound, integrity: preparedIntegrity(bound), shown: {fees: {networkLamports: '5000', markupLamports: '0'}, simulation: {}}};
  await storePrepared(ext, deps, entry);
  return entry;
}

const withoutKind = (entries: Record<string, unknown>[]) => entries.map(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'kind')));

beforeEach(() => {
  gate.beforeSign = async () => undefined;
  gate.calls = [];
});

describe('the intent-kind registry (B1d §1.3, C19)', () => {
  it('send is registered by prepare.ts itself, and in this build registerPresale adds no kind (B1d-1a: no presale-buy in either build)', () => {
    expect(intentKind(SEND_KIND)).toBe(SEND_INTENT);
    const before = registeredKinds();
    registerPresale({ext: fakeExt(), deps: fakeDeps()});
    expect(registeredKinds()).toEqual(before);
    // This file's own kinds are named test-…; besides them, only send.
    expect(before.filter(k => !k.startsWith('test-'))).toEqual(['send']);
  });

  it('refuses a name that is not a kind name, and a kind registered twice (send included)', () => {
    for (const kind of ['', 'Buy', 'test buy', '1buy', '-buy', 'buy_x', `t${'a'.repeat(32)}`]) {
      expect(() => registerIntentKind({...TEST_BUY, kind})).toThrow(/not a kind name/);
    }
    expect(() => registerIntentKind(SEND_INTENT)).toThrow(/registered already/);
    expect(() => registerIntentKind({...TEST_BUY})).toThrow(/registered already/);
    // The boundaries of the name: one letter, and 32 characters.
    expect(KIND_NAME.test('b')).toBe(true);
    const longest = `test-${'a'.repeat(27)}`;
    registerIntentKind({...TEST_BUY, kind: longest});
    expect(registeredKinds()).toContain(longest);
  });
});

// The hard requirement: every existing send is byte-for-byte unchanged — compared with what commit 0b79442 computed.
describe('a send is byte-for-byte what it was before kinds (captured from commit 0b79442)', () => {
  it('the fixture is the capture step’s output', () => {
    expect(CAPTURED.capturedFrom).toMatch(/^commit 0b79442 /);
    expect(CAPTURED.digests).toHaveLength(8);
    expect(CAPTURED.integrity).toHaveLength(2);
  });

  it('its challenge digest: intentDigest of the send kind = sendIntentDigest = the captured digest, for every row', () => {
    for (const {account, intent, digest} of CAPTURED.digests) {
      expect([account, intent.token, sendIntentDigest(account, intent), intentDigest(SEND_INTENT, account, intent)]).toEqual([account, intent.token, digest, digest]);
    }
  });

  it('its integrity: an entry of kind send hashes to the captured integrity, with and without a challenge', () => {
    for (const {entry, integrity} of CAPTURED.integrity) expect(preparedIntegrity({...entry, kind: SEND_KIND})).toBe(integrity);
  });

  it('the whole send, replayed: the stored entry (but its kind), the challenge, the pending record and its confirmed rewrite are the captured bytes', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const view = await prepareSend(ext, deps, ACCOUNT.publicKey, CAPTURED.flow.intent);
    const stored = (await ext.session.get(PREPARED_KEY)) as Record<string, unknown>[];
    expect(stored.map(e => e.kind)).toEqual(['send']);
    expect(JSON.stringify(withoutKind(stored))).toBe(CAPTURED.flow.prepared);
    expect(JSON.stringify(await ext.session.get(REAUTH_KEY))).toBe(CAPTURED.flow.challenges);
    await satisfyChallenge(ext, deps.now(), view.reauth!.challengeId);
    await sendPrepared(ext, deps, view.id);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.flow.sent);
    deps.reader = {...deps.reader, getSignatureStatuses: async sigs => sigs.map(() => ({err: null, confirmationStatus: 'confirmed' as const})), getBlockHeight: async () => 900};
    await pollOnce(ext, deps);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.flow.polled);
  });

  it('a token send, replayed (review 1 L1): USDC to a known recipient — no challenge, the SPL fee; the stored entry (but its kind), the pending record and its confirmed rewrite are the captured bytes', async () => {
    const {intent, holding} = CAPTURED.usdcFlow;
    expect(holding.mint).toBe(WALLET_TOKENS.USDC.mint);
    const {ext, deps} = setup(sendReader({getTokenAccountsByOwner: async () => [{pubkey: holding.pubkey, mint: holding.mint, owner: ACCOUNT.publicKey, amount: BigInt(holding.amount), decimals: holding.decimals}]}));
    await unlocked(ext);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const view = await prepareSend(ext, deps, ACCOUNT.publicKey, intent);
    expect(view.reauth).toBeNull();
    const stored = (await ext.session.get(PREPARED_KEY)) as Record<string, unknown>[];
    expect(stored.map(e => e.kind)).toEqual(['send']);
    expect(JSON.stringify(withoutKind(stored))).toBe(CAPTURED.usdcFlow.prepared);
    expect(JSON.stringify((await ext.session.get(REAUTH_KEY)) ?? null)).toBe(CAPTURED.usdcFlow.challenges);
    await sendPrepared(ext, deps, view.id);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.usdcFlow.sent);
    deps.reader = {...deps.reader, getSignatureStatuses: async sigs => sigs.map(() => ({err: null, confirmationStatus: 'confirmed' as const})), getBlockHeight: async () => 900};
    await pollOnce(ext, deps);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.usdcFlow.polled);
  });

  it('a dApp record, replayed (review 1 L1): recorded held, promised due, handed to the route once by the poller, confirmed — every stored form the captured bytes', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const wire = signedWire(BigInt(CAPTURED.dappFlow.wireLamports));
    await recordDappSend(ext, deps, {account: ACCOUNT.publicKey, wire, lastValidBlockHeight: 1000, origin: CAPTURED.dappFlow.origin});
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.dappFlow.held);
    await markDue(ext, [firstSignature(wire)]);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.dappFlow.due);
    await pollOnce(ext, deps);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.dappFlow.handed);
    expect(deps.broadcasts).toHaveLength(CAPTURED.dappFlow.broadcasts);
    deps.reader = {...deps.reader, getSignatureStatuses: async sigs => sigs.map(() => ({err: null, confirmationStatus: 'confirmed' as const})), getBlockHeight: async () => 900};
    await pollOnce(ext, deps);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.dappFlow.polled);
  });

  it('an entry stored before kinds is not signed (fail closed) — but its challenge, bound to the same digest, carries over to the re-prepare', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const captured = JSON.parse(CAPTURED.flow.prepared) as {id: string; challengeId: string}[];
    await ext.session.set(PREPARED_KEY, captured);
    await ext.session.set(REAUTH_KEY, JSON.parse(CAPTURED.flow.challenges));
    const {id, challengeId} = captured[0]!;
    await satisfyChallenge(ext, deps.now(), challengeId);
    await expect(sendPrepared(ext, deps, id)).rejects.toMatchObject({code: 'unknown-prepared'});
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
    const again = await prepareSend(ext, deps, ACCOUNT.publicKey, CAPTURED.flow.intent, {challengeId});
    expect(again.reauth).toMatchObject({challengeId, proven: true});
    expect((await sendPrepared(ext, deps, again.id)).state).toBe('pending');
    expect(deps.broadcasts).toHaveLength(1);
  });
});

describe('the kind in the digest and in the integrity (B1d §1.3)', () => {
  it('the kind is the challenge digest’s domain: the same values under another kind are another binding', () => {
    expect(TWIN.digestValue(ACCOUNT.publicKey, INTENT)).toEqual(SEND_INTENT.digestValue(ACCOUNT.publicKey, INTENT));
    expect(intentDigest(TWIN, ACCOUNT.publicKey, INTENT)).not.toBe(sendIntentDigest(ACCOUNT.publicKey, INTENT));
  });

  it('a send’s proven challenge does not sign an entry of another kind with the same values; nothing broadcast, the proof unspent', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const send = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    const challengeId = send.reauth!.challengeId;
    await satisfyChallenge(ext, deps.now(), challengeId);
    const twin = await store(ext, deps, {kind: TWIN, intent: INTENT, challengeId});
    await expect(sendPrepared(ext, deps, twin.id, TWIN.kind)).rejects.toMatchObject({code: 'reauth-required', detail: challengeId});
    expect(deps.broadcasts).toHaveLength(0);
    // Positive control: the send itself, re-prepared carrying the proof, is signed with it.
    const again = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId});
    expect((await sendPrepared(ext, deps, again.id)).state).toBe('pending');
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('the integrity covers the kind: the same entry under send and under another kind hashes differently', () => {
    const {entry} = CAPTURED.integrity[1]!;
    const asSend = preparedIntegrity({...entry, kind: SEND_KIND});
    expect(preparedIntegrity({...entry, kind: TWIN.kind})).not.toBe(asSend);
    expect(preparedIntegrity({...entry, kind: SEND_KIND})).toBe(asSend);
  });

  it('an entry of an unregistered kind, or whose intent its kind does not read, has no integrity', () => {
    const {entry} = CAPTURED.integrity[0]!;
    expect(() => preparedIntegrity({...entry, kind: 'test-gone'})).toThrow(SendRefused);
    expect(() => preparedIntegrity({...entry, kind: TEST_BUY.kind, intent: {amount: '0'}})).toThrow(/prepared-invalid/);
    expect(() => preparedIntegrity({...entry, kind: SEND_KIND, intent: {...entry.intent, amount: '0'}})).toThrow(/prepared-invalid/);
  });
});

describe('sendPrepared for any kind, in the order of C29 (review M4)', () => {
  it('signs an entry of another kind: beforeSign sees the peeked entry and its intent; the record has no intent and the kind’s extra (positive control)', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const entry = await store(ext, deps);
    const view = await sendPrepared(ext, deps, entry.id, TEST_BUY.kind);
    expect(gate.calls).toEqual([{entry, intent: {amount: '5'}}]);
    expect(deps.broadcasts).toHaveLength(1);
    expect(view).toMatchObject({state: 'pending', intent: null, origin: null, extra: {kind: 'test-buy', data: {amount: '5', preparedAt: entry.createdAt}}, fee: {networkLamports: '5000', markupLamports: '0'}});
    expect((await readPending(ext))[0]?.extra).toEqual({kind: 'test-buy', data: {amount: '5', preparedAt: entry.createdAt}});
  });

  it('an unproven challenge is refused before beforeSign runs', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const challengeId = await issueChallenge(ext, deps, intentDigest(TEST_BUY, ACCOUNT.publicKey, {amount: '5'}), SETTINGS_ABOUT);
    const entry = await store(ext, deps, {challengeId});
    await expect(sendPrepared(ext, deps, entry.id, TEST_BUY.kind)).rejects.toMatchObject({code: 'reauth-required', detail: challengeId});
    expect(gate.calls).toHaveLength(0);
  });

  it('beforeSign refusing burns nothing: the entry stays, the proof stays proven, nothing signed — and the same entry then signs with the same proof', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const digest = intentDigest(TEST_BUY, ACCOUNT.publicKey, {amount: '5'});
    const challengeId = await issueChallenge(ext, deps, digest, SETTINGS_ABOUT);
    await satisfyChallenge(ext, deps.now(), challengeId);
    const entry = await store(ext, deps, {challengeId});
    gate.beforeSign = async () => {
      throw new SendRefused('simulation-mismatch', 'the state moved');
    };
    await expect(sendPrepared(ext, deps, entry.id, TEST_BUY.kind)).rejects.toMatchObject({code: 'simulation-mismatch'});
    expect(await peekPrepared(ext, entry.id)).toEqual(entry);
    expect(await challengeSatisfied(ext, deps.now(), challengeId, digest)).toBe(true);
    expect(deps.broadcasts).toHaveLength(0);
    expect(await ext.local.get(PENDING_KEY)).toBeUndefined();
    gate.beforeSign = async () => undefined;
    expect((await sendPrepared(ext, deps, entry.id, TEST_BUY.kind)).state).toBe('pending');
    expect(await challengeSatisfied(ext, deps.now(), challengeId, digest)).toBe(false);
  });

  it('a beforeSign slower than the prepared life ends in prepared-expired (the re-prepare path), the proof unspent', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const digest = intentDigest(TEST_BUY, ACCOUNT.publicKey, {amount: '5'});
    const challengeId = await issueChallenge(ext, deps, digest, SETTINGS_ABOUT);
    await satisfyChallenge(ext, deps.now(), challengeId);
    const entry = await store(ext, deps, {challengeId});
    gate.beforeSign = async () => {
      deps.clock.t += PREPARED_TTL_MS;
    };
    await expect(sendPrepared(ext, deps, entry.id, TEST_BUY.kind)).rejects.toMatchObject({code: 'prepared-expired'});
    expect(await challengeSatisfied(ext, deps.now(), challengeId, digest)).toBe(true);
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('an entry changed while beforeSign ran (same id, its own valid integrity) is refused: what is signed is what was checked', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const entry = await store(ext, deps);
    const other = base64.encode(VersionedTransaction.deserialize(signedWire(9n)).message.serialize());
    gate.beforeSign = async () => {
      const changed = {...entry, message: other};
      await ext.session.set(PREPARED_KEY, [{...changed, integrity: preparedIntegrity(changed)}]);
    };
    await expect(sendPrepared(ext, deps, entry.id, TEST_BUY.kind)).rejects.toMatchObject({code: 'prepared-invalid'});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('an entry of a kind this build does not handle is refused before anything else, and stays — one whose intent reads as a send’s too (review 1 M2)', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    // The second entry carries a send-shaped intent, so only the registry lookup refuses it (not the intent's shape).
    for (const o of [{}, {kind: TWIN, intent: INTENT}]) {
      const entry = await store(ext, deps, o);
      const gone = {...entry, kind: 'test-gone'};
      await ext.session.set(PREPARED_KEY, [gone]);
      await expect(sendPrepared(ext, deps, entry.id, 'test-gone')).rejects.toMatchObject({code: 'prepared-invalid'});
      expect(await peekPrepared(ext, entry.id)).toEqual(gone);
    }
    expect(gate.calls).toHaveLength(0);
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('wallet.send signs only a send (D17): an entry of another kind is refused as unknown before anything, burning nothing — a send signs (positive control)', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    for (const o of [{}, {kind: TWIN, intent: INTENT}]) {
      const entry = await store(ext, deps, o);
      expect(await handleWallet(ext, deps, 'wallet.send', {id: entry.id})).toEqual({ok: false, error: 'unknown-prepared'});
      await expect(sendPrepared(ext, deps, entry.id)).rejects.toMatchObject({code: 'unknown-prepared'});
      expect(await peekPrepared(ext, entry.id)).toEqual(entry);
    }
    expect(gate.calls).toHaveLength(0);
    expect(deps.broadcasts).toHaveLength(0);
    const send = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    await satisfyChallenge(ext, deps.now(), send.reauth!.challengeId);
    expect(await handleWallet(ext, deps, 'wallet.send', {id: send.id})).toMatchObject({ok: true, data: {state: 'pending', intent: INTENT}});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('an entry whose intent its kind does not read is refused, nothing signed', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const entry = await store(ext, deps);
    await ext.session.set(PREPARED_KEY, [{...entry, intent: {amount: '0'}}]);
    await expect(sendPrepared(ext, deps, entry.id, TEST_BUY.kind)).rejects.toMatchObject({code: 'prepared-invalid'});
    expect(deps.broadcasts).toHaveLength(0);
  });
});

describe('one prepared entry per account, across kinds (B1d §1.3)', () => {
  it('a prepare of either kind replaces the account’s entry of the other; another account’s stays', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const elsewhere = await store(ext, deps, {account: RECIPIENT});
    const buy = await store(ext, deps);
    const send = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    expect(await peekPrepared(ext, buy.id)).toBeNull();
    expect(await peekPrepared(ext, send.id)).not.toBeNull();
    const buyAgain = await store(ext, deps);
    expect(await peekPrepared(ext, send.id)).toBeNull();
    expect(await peekPrepared(ext, buyAgain.id)).not.toBeNull();
    expect(await peekPrepared(ext, elsewhere.id)).toEqual(elsewhere);
  });

  it('wallet.preparedFor never returns an entry of another kind', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    await store(ext, deps);
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
    const send = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.id).toBe(send.id);
  });

  it('storing while locked writes nothing and removes the challenges (the lock hook), for any kind', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    await issueChallenge(ext, deps, 'd'.repeat(64), SETTINGS_ABOUT);
    await clearSession(ext);
    await issueChallenge(ext, deps, 'e'.repeat(64), SETTINGS_ABOUT);
    await expect(store(ext, deps)).rejects.toMatchObject({code: 'locked'});
    expect(await ext.session.get(PREPARED_KEY)).toBeUndefined();
    expect(await ext.session.get(REAUTH_KEY)).toBeUndefined();
  });
});

describe('one in-flight transaction per account, a purchase included (C10)', () => {
  it('an entry of another kind is refused while the account’s send is open, nothing broadcast; another account’s send does not count', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    await ext.local.set(PENDING_KEY, [pendingRecord({id: 'other', account: RECIPIENT})]);
    const first = await store(ext, deps);
    expect((await sendPrepared(ext, deps, first.id, TEST_BUY.kind)).state).toBe('pending');
    await ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey})]);
    const second = await store(ext, deps);
    await expect(sendPrepared(ext, deps, second.id, TEST_BUY.kind)).rejects.toMatchObject({code: 'in-flight'});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('a second entry of another kind is refused while the first one’s record is open', async () => {
    const {ext, deps} = setup();
    await unlocked(ext);
    const first = await store(ext, deps);
    await sendPrepared(ext, deps, first.id, TEST_BUY.kind);
    const second = await store(ext, deps, {intent: {amount: '6'}});
    await expect(sendPrepared(ext, deps, second.id, TEST_BUY.kind)).rejects.toMatchObject({code: 'in-flight'});
    await expect(prepareSend(ext, deps, ACCOUNT.publicKey, INTENT)).rejects.toMatchObject({code: 'in-flight'});
    expect(deps.broadcasts).toHaveLength(1);
  });
});
````

Create `extension/src/background/__tests__/pendingKinds.test.ts`:

````ts
import {readFileSync} from 'node:fs';
import {base64} from '@scure/base';
import {PENDING_KEY, inFlightFor, readPending, updatePending, viewOf, type PendingRecord} from '../pendingStore';
import {EXPIRY_MARGIN_BLOCKS, POLL_INTERVAL_MS, pollOnce, resend, submitSigned} from '../pending';
import {prepareSend} from '../prepare';
import {handleWallet} from '../walletApi';
import {knownRecipients} from '../knownRecipients';
import {VAULT_KEY} from '../accountsStore';
import {firstSignature} from '../../../../core/solana/broadcast';
import type {SignatureStatus} from '../../../../core/solana/rpc';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, HOLDING_LARGE, RECIPIENT, pendingRecord, sendReader, signedWire, unlocked} from './fixtures';

/** What commit 0b79442 stored and read (the plan's capture step; never edited). */
interface Captured {
  capturedFrom: string;
  flow: {sent: string; polled: string};
  validator: {input: unknown[]; read: string; rewritten: string; ownNullIntent: 'dropped' | 'kept'};
}
const CAPTURED = JSON.parse(readFileSync(new URL('./captured/sends.0b79442.json', import.meta.url), 'utf8')) as Captured;

const WIRE = signedWire(7n);
/** B1d §2.3: a purchase in v1_pending — the wallet's own record, no intent, no origin, its kind and display data in `extra`. */
const PURCHASE: PendingRecord = pendingRecord({
  id: 'buy',
  account: ACCOUNT.publicKey,
  signature: firstSignature(WIRE),
  wire: base64.encode(WIRE),
  intent: null,
  fee: {networkLamports: '5050', markupLamports: '0'},
  extra: {
    kind: 'presale-buy',
    data: {currency: 'SOL', amount: '2000000000', stage: '2', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '30000', destination: RECIPIENT, referrer: null},
  },
});
const confirmed: SignatureStatus = {err: null, confirmationStatus: 'confirmed'};
const ENVELOPE = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT.publicKey}]};

const withoutExtra = (records: PendingRecord[]) => records.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'extra')));

describe('a record written before B1d survives the update (captured from commit 0b79442)', () => {
  it('the fixture is the capture step’s output', () => {
    expect(CAPTURED.capturedFrom).toMatch(/^commit 0b79442 /);
  });

  it('a send recorded by the old code, read after a restart: kept, extra null, still in flight, polled to the very bytes the old code wrote', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(PENDING_KEY, JSON.parse(CAPTURED.flow.sent));
    const [record, ...rest] = await readPending(ext);
    expect(rest).toEqual([]);
    expect(record).toMatchObject({account: ACCOUNT.publicKey, state: 'pending', extra: null});
    expect(viewOf(record!).extra).toBeNull();
    const deps = fakeDeps({reader: sendReader({getSignatureStatuses: async sigs => sigs.map(() => confirmed), getBlockHeight: async () => 900})});
    await expect(prepareSend(ext, deps, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1'})).rejects.toMatchObject({code: 'in-flight'});
    await pollOnce(ext, deps);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.flow.polled);
  });

  it('the validator’s verdict on every captured shape is the old one (extra null on each), and its rewrite is the old bytes', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, CAPTURED.validator.input);
    const read = await readPending(ext);
    expect(JSON.stringify(withoutExtra(read))).toBe(CAPTURED.validator.read);
    expect(read.map(r => r.extra)).toEqual(read.map(() => null));
    await updatePending(ext, records => records);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.validator.rewritten);
  });

  it('the one verdict B1d changes (review H1): the wallet’s own record with no intent was dropped, and is now kept — extra null, counted', async () => {
    expect(CAPTURED.validator.ownNullIntent).toBe('dropped');
    const ext = fakeExt();
    const own = {...pendingRecord({id: 'own', account: ACCOUNT.publicKey}), intent: null};
    const {extra: _none, ...stored} = own;
    await ext.local.set(PENDING_KEY, [stored]);
    const read = await readPending(ext);
    expect(read).toEqual([own]);
    expect(inFlightFor(read, ACCOUNT.publicKey)?.id).toBe('own');
  });
});

describe('the shared validator reads a purchase (B1d §1.3, §2.3, review H1)', () => {
  it('a presale-buy record is read back whole, and its rewrite keeps extra', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    expect(await readPending(ext)).toEqual([PURCHASE]);
    await updatePending(ext, records => records);
    expect(await ext.local.get(PENDING_KEY)).toEqual([PURCHASE]);
  });

  it('a send and a dApp record are written without extra (their stored form is unchanged); a purchase with it', async () => {
    const ext = fakeExt();
    const dapp = pendingRecord({id: 'dapp', account: 'B', intent: null, origin: 'https://noc-tura.io', firstBroadcast: 'held'});
    await updatePending(ext, () => [pendingRecord({id: 'send'}), dapp, PURCHASE]);
    const stored = (await ext.local.get(PENDING_KEY)) as Record<string, unknown>[];
    expect(stored.map(r => 'extra' in r)).toEqual([false, false, true]);
  });

  it('viewOf copies extra: a fresh object, data as stored', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    const [record] = await readPending(ext);
    const view = viewOf(record!);
    expect(view.extra).toEqual(PURCHASE.extra);
    expect(view.extra).not.toBe(record!.extra);
    expect('wire' in view).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a string', 'presale-buy'],
    ['an array', ['presale-buy']],
    ['a number kind', {kind: 3, data: {}}],
    ['an empty kind', {kind: '', data: {}}],
    ['an upper-case kind', {kind: 'Presale-buy', data: {}}],
    ['a kind with a space', {kind: 'presale buy', data: {}}],
    ['a kind starting with a digit', {kind: '1buy', data: {}}],
    ['a kind of 33 characters', {kind: `p${'a'.repeat(32)}`, data: {}}],
    ['no kind', {data: {}}],
  ])('a malformed extra (%s) keeps the record, with extra null', async (_what, extra) => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [{...PURCHASE, extra}]);
    const read = await readPending(ext);
    expect(read).toEqual([{...PURCHASE, extra: null}]);
    expect(inFlightFor(read, ACCOUNT.publicKey)?.id).toBe('buy');
  });

  it('the kind’s boundaries are read: one letter, 32 characters; data missing reads as null, any other data as stored', async () => {
    const ext = fakeExt();
    const long = `p${'a'.repeat(31)}`;
    await ext.local.set(PENDING_KEY, [
      {...PURCHASE, id: 'one', extra: {kind: 'b'}},
      {...PURCHASE, id: 'long', extra: {kind: long, data: [1, 'x', null]}},
    ]);
    expect((await readPending(ext)).map(r => r.extra)).toEqual([
      {kind: 'b', data: null},
      {kind: long, data: [1, 'x', null]},
    ]);
  });

  it('extra is read only on the wallet’s own record without an intent: on a send and on a dApp record it is null', async () => {
    const ext = fakeExt();
    const dapp = pendingRecord({id: 'dapp', intent: null, origin: 'https://noc-tura.io'});
    await ext.local.set(PENDING_KEY, [pendingRecord({id: 'send', extra: PURCHASE.extra}), {...dapp, extra: PURCHASE.extra}]);
    expect((await readPending(ext)).map(r => [r.id, r.extra])).toEqual([
      ['send', null],
      ['dapp', null],
    ]);
  });

  it('a record without an intent is still dropped when anything else is wrong (negative controls)', async () => {
    const ext = fakeExt();
    const {intent: _i, ...noIntent} = PURCHASE;
    await ext.local.set(PENDING_KEY, [
      {...PURCHASE, id: 'http', origin: 'http://noc-tura.io'},
      {...PURCHASE, id: 'origin-number', origin: 7},
      noIntent,
      {...PURCHASE, id: 'state', state: 'bogus'},
      {...PURCHASE, id: 'signature', signature: null},
      {...PURCHASE, id: 'failure', failure: 'weird'},
      {...PURCHASE, id: 'intent', intent: {token: 'SOL'}},
    ]);
    expect(await readPending(ext)).toEqual([]);
  });
});

describe('a purchase is one in-flight transaction of its account (C10)', () => {
  it('inFlightFor finds it; a send’s prepare and a send’s submit are then refused in-flight; another account and a closed purchase are not', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    expect(inFlightFor(await readPending(ext), ACCOUNT.publicKey)?.id).toBe('buy');
    expect(inFlightFor(await readPending(ext), RECIPIENT)).toBeUndefined();
    const deps = fakeDeps({reader: sendReader()});
    await expect(prepareSend(ext, deps, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1000000'})).rejects.toMatchObject({code: 'in-flight'});
    await expect(submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, fee: null})).rejects.toMatchObject({code: 'in-flight'});
    await ext.local.set(PENDING_KEY, [{...PURCHASE, state: 'confirmed'}]);
    expect(inFlightFor(await readPending(ext), ACCOUNT.publicKey)).toBeUndefined();
  });
});

describe('the poller, expiry, resend and wallet.pending are kind-agnostic (B1d §1.3)', () => {
  it('pollOnce confirms it, and names no known recipient (it has no intent) — a send confirmed beside it does', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENVELOPE);
    const send = pendingRecord({id: 'send', account: ACCOUNT.publicKey, signature: 's2', intent: {token: 'SOL', recipient: HOLDING_LARGE, amount: '1'}});
    await ext.local.set(PENDING_KEY, [PURCHASE, send]);
    const deps = fakeDeps({reader: fakeReader({getSignatureStatuses: async sigs => sigs.map(() => confirmed), getBlockHeight: async () => 900})});
    expect(await pollOnce(ext, deps)).toBe(false);
    expect(await readPending(ext)).toEqual([
      {...PURCHASE, state: 'confirmed'},
      {...send, state: 'confirmed'},
    ]);
    expect([...(await knownRecipients(ext))]).toEqual([HOLDING_LARGE]);
  });

  it('past its block height and two null rounds, it expires', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    const deps = fakeDeps({reader: fakeReader({getSignatureStatuses: async sigs => sigs.map(() => null), getBlockHeight: async () => 1000 + EXPIRY_MARGIN_BLOCKS + 1})});
    await pollOnce(ext, deps);
    deps.clock.t += POLL_INTERVAL_MS;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({id: 'buy', state: 'expired', extra: PURCHASE.extra});
  });

  it('resend sends its very bytes again', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [{...PURCHASE, lastSentAt: -10_000}]);
    const deps = fakeDeps();
    deps.broadcast = async wire => {
      deps.broadcasts.push(wire);
      return firstSignature(wire);
    };
    const view = await resend(ext, deps, 'buy');
    expect(deps.broadcasts.map(w => base64.encode(w))).toEqual([PURCHASE.wire]);
    expect(view.extra).toEqual(PURCHASE.extra);
  });

  it('wallet.pending lists it with its extra (origin null: the wallet’s own)', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [PURCHASE, pendingRecord({id: 'dapp', account: 'B', intent: null, origin: 'https://noc-tura.io'})]);
    const r = await handleWallet(ext, fakeDeps(), 'wallet.pending', {});
    expect(r).toEqual({ok: true, data: [viewOf(PURCHASE)]});
  });
});
````

Modify the tests of the shapes that change, the gate's staged list and the off run:

````diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index 07e253a..1c231df 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -24,7 +24,7 @@ const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
 const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/app.modules.0b79442.json'), 'utf8'));
 const map = ids => ({chunks: {'background.js': ids}});
 const without = (m, id) => ({...m, chunks: Object.fromEntries(Object.entries(m.chunks).map(([f, ids]) => [f, ids.filter(i => i !== id)]))});
-const SHARED = ['src/background/index.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];
+const SHARED = ['src/background/index.ts', 'src/background/intents.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];
 
 // B1d §6.2 item 1 (C38, D15): the off build's module rule — an allowlist for core/presale/**, core/geo/** whole.
 describe('the off-build module rule', () => {
@@ -82,7 +82,7 @@ describe('the off-build module rule', () => {
 describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
   it('the on build must carry the three on-path entries — the plugin maps something real', () => {
     expect(ON_BUILD).toEqual(PRESALE_ENTRIES.map(e => e.entry));
-    expect(BOTH_BUILDS).toEqual([]);
+    expect(BOTH_BUILDS).toEqual(['src/background/intents.ts']);
   });
 
   it('missingModules names each required module a map does not carry', () => {
@@ -96,6 +96,10 @@ describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
   it('every ON_BUILD module is one the off build refuses (else its control proves nothing)', () => {
     for (const id of ON_BUILD) expect([id, offModuleViolations(new Set([id])).length]).toEqual([id, 1]);
   });
+
+  it('every BOTH_BUILDS module is one the off build may carry (else the two rules contradict each other)', () => {
+    for (const id of BOTH_BUILDS) expect([id, offModuleViolations(new Set([id])).length]).toEqual([id, 0]);
+  });
 });
 
 describe('wiring', () => {
diff --git a/extension/scripts/__tests__/presaleSwitch.test.mjs b/extension/scripts/__tests__/presaleSwitch.test.mjs
index cd0622c..7fd18a2 100644
--- a/extension/scripts/__tests__/presaleSwitch.test.mjs
+++ b/extension/scripts/__tests__/presaleSwitch.test.mjs
@@ -123,6 +123,10 @@ describe('both configs read the same flag (review L11)', () => {
     // The on run (vite.config.ts) is not marked: unset reads as on.
     expect(appConfig({}).test.env).toBeUndefined();
   });
+
+  it('the shared send pipeline is tested in the off run too: the intent-kind registry and a purchase record (B1d §6.1 "Switch, off build", C19)', () => {
+    expect(nopresale.test.include).toEqual(expect.arrayContaining(['src/background/__tests__/intents.test.ts', 'src/background/__tests__/pendingKinds.test.ts']));
+  });
 });
 
 // Why the plugin and not a guarded call (C4): a module whose top level has an effect stays in the bundle when only its
diff --git a/extension/src/background/__tests__/fixtures.ts b/extension/src/background/__tests__/fixtures.ts
index ea40f0a..dc7ec57 100644
--- a/extension/src/background/__tests__/fixtures.ts
+++ b/extension/src/background/__tests__/fixtures.ts
@@ -113,6 +113,7 @@ export const pendingRecord = (over: Partial<PendingRecord> = {}): PendingRecord
   expiryNullSeenAt: null,
   failure: null,
   fee: null,
+  extra: null,
   ...over,
 });
 
diff --git a/extension/src/background/__tests__/pendingStore.test.ts b/extension/src/background/__tests__/pendingStore.test.ts
index 1204f48..52b5898 100644
--- a/extension/src/background/__tests__/pendingStore.test.ts
+++ b/extension/src/background/__tests__/pendingStore.test.ts
@@ -23,7 +23,9 @@ describe('pendingStore', () => {
   it('drops stored elements that are not a record, so nothing downstream throws on them', async () => {
     const ext = fakeExt();
     const good = record({account: 'A', state: 'stuck'});
-    const junk = [null, 7, 'x', [], {}, {...good, state: 'bogus'}, {...good, id: 1}, {...good, createdAt: 'x'}, {...good, intent: null}, {...good, detail: 3}];
+    // `{...good, intent: null}` is no longer junk (B1d §1.3, review H1): the wallet's own record of another kind than a
+    // send — kept, see pendingKinds.test.ts. A record without any intent still is.
+    const junk = [null, 7, 'x', [], {}, {...good, state: 'bogus'}, {...good, id: 1}, {...good, createdAt: 'x'}, {...good, intent: undefined}, {...good, detail: 3}];
     await ext.local.set(PENDING_KEY, [...junk, good]);
     const read = await readPending(ext);
     expect(read).toEqual([good]);
diff --git a/extension/src/background/__tests__/prepare.test.ts b/extension/src/background/__tests__/prepare.test.ts
index 2392ec1..ae484cd 100644
--- a/extension/src/background/__tests__/prepare.test.ts
+++ b/extension/src/background/__tests__/prepare.test.ts
@@ -1,6 +1,6 @@
 import {base64} from '@scure/base';
 import {VersionedMessage} from '@solana/web3.js';
-import {PREPARED_TTL_MS, parseIntent, peekPrepared, preparedIntegrity, prepareSend, sendIntentDigest, takePrepared} from '../prepare';
+import {PREPARED_TTL_MS, parseIntent, peekPrepared, preparedIntegrity, prepareSend, sendIntentDigest, takePrepared, type PreparedSend} from '../prepare';
 import {PREPARED_KEY, REAUTH_KEY, SESSION_KEY, clearSession, getSession, setSession} from '../session';
 import {PENDING_KEY} from '../pendingStore';
 import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
@@ -300,7 +300,7 @@ describe('prepareSend', () => {
     const ext = fakeExt();
     await unlocked(ext);
     const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
-    const p = (await peekPrepared(ext, view.id))!;
+    const p = (await peekPrepared(ext, view.id)) as PreparedSend;
     const {account, token, recipient, amount} = {account: p.account, ...p.intent};
     expect(p.intentDigest).toBe(digestOf('send', {account, token, recipient, amount}));
     expect(p.intentDigest).toBe(sendIntentDigest(account, p.intent));
@@ -314,7 +314,7 @@ describe('prepareSend', () => {
     const ext = fakeExt();
     await unlocked(ext);
     const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, SOL_INTENT);
-    const p = (await peekPrepared(ext, view.id))!;
+    const p = (await peekPrepared(ext, view.id)) as PreparedSend;
     for (const altered of [
       {...p, id: 'f'.repeat(32)},
       {...p, account: RECIPIENT},
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run (from `extension/`): `npx vitest run src/background/__tests__/intents.test.ts src/background/__tests__/pendingKinds.test.ts src/background/__tests__/prepare.test.ts src/background/__tests__/pendingStore.test.ts scripts/__tests__/check-no-presale.test.mjs scripts/__tests__/presaleSwitch.test.mjs`

Expected (the dry run, on Task 2's tree + the fixture and the test changes — rev 2 re-ran it on 1f6fe9b with the same result): `Test Files  4 failed | 2 passed (6)` · `Tests  26 failed | 88 passed (114)` — `intents.test.ts` fails as a file (`Error: Cannot find module '../intents'`); `pendingKinds.test.ts` 24 of 26 red — every row that reads `extra` or the third shape (e.g. `expected [] to deeply equal [ { id: 'buy', …(16) } ]`, `expected [ undefined, undefined, …(9) ] to deeply equal [ null, null, …(6) ]`); the two green are the fixture check and the negative controls "a record without an intent is still dropped when anything else is wrong", which hold on the old code too; `check-no-presale.test.mjs` 1 red (`expected [] to deeply equal [ 'src/background/intents.ts' ]`); `presaleSwitch.test.mjs` 1 red (the off-run list); `prepare.test.ts` and `pendingStore.test.ts` green (their changes are typings and a junk row that holds either way). `npx tsc --noEmit; echo $?` → `2` (rev 2: 54 errors — 37 in `intents.test.ts`, 16 in `pendingKinds.test.ts`, 1 in `fixtures.ts`: `../intents` missing, `extra` not on `PendingRecord` / `PendingView`, `sendPrepared`'s fourth argument).

**(rev 2) The new tests against rev 1's implementation** (9bed436 + rev 2's `intents.test.ts` and fixture): `Tests  1 failed | 25 passed (26)` — only the D17 row is red (`wallet.send` signs the `test-buy` entry: `expected { ok: true, … } to deeply equal { ok: false, error: 'unknown-prepared' }`); the M2 row and the two L1 replays pass, as they must — they are evidence for code that was already right (review 1's scenarios), and K3 below proves the M2 row now catches its mutant.

- [ ] **Step 3: Implement.**

Create `extension/src/background/intents.ts`:

````ts
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {digestOf} from './digest';
import type {PreparedEntry} from './prepare';

/**
 * B1d §1.3 (C19): the shared send pipeline knows kinds, not presale. Each kind is registered once, by the module that
 * owns it — B1b's send by prepare.ts, unconditionally (both builds); `presale-buy` by the presale entry module (B1d-1b),
 * which the build without presale replaces by a stub that registers nothing. A prepared entry carries its kind; one
 * whose kind is not registered here is refused at signing (`prepared-invalid`), while a pending record of such a kind is
 * still read, counted, polled and shown generically (pendingStore.ts).
 */
export const SEND_KIND: 'send' = 'send';

/** A kind's name — also what `PendingRecord.extra.kind` must look like to be read (pendingStore.ts). */
export const KIND_NAME = /^[a-z][a-z0-9-]{0,31}$/;

/** What a kind's checks may use: the background's own extension handle and deps. */
export interface KindHost {
  ext: Ext;
  deps: WalletDeps;
}

export interface IntentKind<I> {
  readonly kind: string;
  /** Untrusted or stored input → the intent rebuilt key by key (its one JSON form), or null. */
  parseIntent(x: unknown): I | null;
  /** What a re-authentication is bound to, as plain JSON built key by key; intentDigest hashes it under the kind. */
  digestValue(account: string, intent: I): unknown;
  /**
   * C29 (review M4): the kind's last checks, on the entry as peeked — after its challenge was found proven, before the
   * single-use take. Refuses by throwing SendRefused; a refusal burns neither the entry nor the proof.
   */
  beforeSign(host: KindHost, entry: PreparedEntry, intent: I): Promise<void>;
  /** The pending record's `extra.data` — display only, plain JSON. Not asked of `send`: its record carries its intent. */
  pendingData?(entry: PreparedEntry, intent: I): unknown;
}

const kinds = new Map<string, IntentKind<unknown>>();

export function registerIntentKind<I>(k: IntentKind<I>): void {
  if (!KIND_NAME.test(k.kind)) throw new TypeError(`registerIntentKind: ${JSON.stringify(k.kind)} is not a kind name`);
  if (kinds.has(k.kind)) throw new Error(`registerIntentKind: ${k.kind} is registered already`);
  kinds.set(k.kind, k);
}

export function intentKind(kind: string): IntentKind<unknown> | undefined {
  return kinds.get(kind);
}

export function registeredKinds(): string[] {
  return [...kinds.keys()];
}

/**
 * The re-authentication binding of an intent of any kind: the kind is the digest's domain, so two kinds never share a
 * binding, and a send's is B1b's `digestOf('send', …)` — the same bytes as before kinds existed.
 */
export function intentDigest<I>(k: IntentKind<I>, account: string, intent: I): string {
  return digestOf(k.kind, k.digestValue(account, intent));
}
````

Modify the pipeline:

````diff
diff --git a/extension/src/background/pending.ts b/extension/src/background/pending.ts
index c2d4ffb..562680e 100644
--- a/extension/src/background/pending.ts
+++ b/extension/src/background/pending.ts
@@ -4,7 +4,7 @@ import type {WalletDeps} from './deps';
 import {addKnownRecipient} from './knownRecipients';
 import {readWalletView} from './accountsStore';
 import {randomId} from './digest';
-import {inFlightFor, isOpen, readPending, updatePending, viewOf, type FirstBroadcast, type PendingFee, type PendingRecord, type PendingView} from './pendingStore';
+import {inFlightFor, isOpen, readPending, updatePending, viewOf, type FirstBroadcast, type PendingExtra, type PendingFee, type PendingRecord, type PendingView} from './pendingStore';
 import {COOLING_AGAIN_DETAIL, FORBIDDEN_DETAIL, ResendRefused, SendRefused, SentUnconfirmed, type ResendRefusal, type SendIntent} from './sendTypes';
 import {BroadcastRejected, BroadcastSubstituted, firstSignature} from '../../../core/solana/broadcast';
 import {RpcCoolingDown, RpcForbidden, type SignatureStatus} from '../../../core/solana/rpc';
@@ -66,7 +66,7 @@ async function deliver(ext: Ext, deps: WalletDeps, record: PendingRecord, attemp
 export async function submitSigned(
   ext: Ext,
   deps: WalletDeps,
-  input: {account: string; wire: Uint8Array; lastValidBlockHeight: number; intent: SendIntent; fee: PendingFee | null},
+  input: {account: string; wire: Uint8Array; lastValidBlockHeight: number; fee: PendingFee | null} & ({intent: SendIntent; extra?: null} | {intent: null; extra: PendingExtra}),
 ): Promise<PendingView> {
   const now = deps.now();
   const record: PendingRecord = {
@@ -86,6 +86,7 @@ export async function submitSigned(
     expiryNullSeenAt: null,
     failure: null,
     fee: input.fee,
+    extra: input.intent === null ? input.extra : null,
   };
   const guard = {refused: false};
   await updatePending(ext, records => {
@@ -142,6 +143,7 @@ export async function recordDappSend(ext: Ext, deps: WalletDeps, input: {account
     expiryNullSeenAt: null,
     failure: null,
     fee: null,
+    extra: null,
   };
   await updatePending(ext, records => [...records, record]);
   await armPendingAlarm(ext).catch((e: unknown) => console.warn('pending alarm not armed; the poller still runs', e));
diff --git a/extension/src/background/pendingStore.ts b/extension/src/background/pendingStore.ts
index 5fa7ee6..f505b3f 100644
--- a/extension/src/background/pendingStore.ts
+++ b/extension/src/background/pendingStore.ts
@@ -1,5 +1,6 @@
 import type {Ext} from '../ext';
 import {createMutex} from './mutex';
+import {KIND_NAME} from './intents';
 import type {SendIntent} from './sendTypes';
 
 /**
@@ -43,7 +44,10 @@ export interface PendingRecord {
   detail: string | null;
   /** See DetailCode. A stored value that is missing (a record from before it) or unknown reads as null; the record is kept. */
   detailCode: DetailCode | null;
-  /** What the user sent (#12's intent); null only for a dApp's transaction (B1c-2: `origin` set — the dApp built it). */
+  /**
+   * What the user sent (#12's intent); null for a dApp's transaction (B1c-2: `origin` set — the dApp built it) and for
+   * the wallet's own transaction of another kind than a send (B1d §1.3: `origin` null, what it was in `extra`).
+   */
   intent: SendIntent | null;
   /**
    * B1c-2 (spec B1c §1.5, §3.3): the site whose `signAndSendTransaction` this is — its signed bytes recorded here before
@@ -73,6 +77,19 @@ export interface PendingRecord {
    * digit strings: a display field never drops a record (a pending send must never be hidden).
    */
   fee: PendingFee | null;
+  /**
+   * B1d §1.3 (review H1): what the wallet's own transaction of another kind than a send was — its kind and that kind's
+   * display data, never used to decide anything. Null for a send and a dApp record, and for any stored value that is
+   * not an object with a kind name: a display field never drops a record. Written only when set, so a send's and a dApp
+   * record's stored form is what it was before kinds existed.
+   */
+  extra: PendingExtra | null;
+}
+
+/** See PendingRecord.extra. `data` is the kind's, as stored. */
+export interface PendingExtra {
+  kind: string;
+  data: unknown;
 }
 
 /** The two parts of what a pending send pays, base-unit decimal strings. */
@@ -97,12 +114,17 @@ const ORIGIN = /^https:\/\/[^\s/?#@]+$/;
 /** A dApp record's origin (B1c-2): an https origin, with its intent null; the wallet's own send has no origin and an intent. */
 const isDappOrigin = (x: unknown): x is string => typeof x === 'string' && ORIGIN.test(x);
 
-/** A stored element is a claim: only an exact record shape is read; anything else is dropped. `failure` and `fee` are checked by recordOf. */
-function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'fee' | 'detailCode' | 'origin' | 'firstBroadcast'> & {failure?: unknown; fee?: unknown; detailCode?: unknown; origin?: unknown; firstBroadcast?: unknown} {
+/**
+ * A stored element is a claim: only an exact record shape is read; anything else is dropped. Three shapes: a dApp's (an
+ * https origin, no intent), the wallet's send (no origin, a send intent) and the wallet's other kinds (B1d §1.3: no
+ * origin, no intent). `failure`, `fee` and `extra` are checked by recordOf.
+ */
+function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'fee' | 'detailCode' | 'origin' | 'firstBroadcast' | 'extra'> & {failure?: unknown; fee?: unknown; detailCode?: unknown; origin?: unknown; firstBroadcast?: unknown; extra?: unknown} {
   if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
   const r = x as Record<string, unknown>;
   const i = r.intent as Record<string, unknown> | null;
   const dapp = isDappOrigin(r.origin) && i === null;
+  const own = r.origin === undefined || r.origin === null;
   return (
     typeof r.id === 'string' &&
     typeof r.account === 'string' &&
@@ -115,13 +137,14 @@ function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'fee' | 'det
     isNum(r.lastSentAt) &&
     (r.detail === null || typeof r.detail === 'string') &&
     (r.expiryNullSeenAt === null || isNum(r.expiryNullSeenAt)) &&
-    (dapp || ((r.origin === undefined || r.origin === null) && typeof i === 'object' && i !== null && typeof i.token === 'string' && typeof i.recipient === 'string' && typeof i.amount === 'string'))
+    (dapp || (own && i === null) || (own && typeof i === 'object' && i !== null && typeof i.token === 'string' && typeof i.recipient === 'string' && typeof i.amount === 'string'))
   );
 }
 
 /**
  * A record from before E8 has no `failure`: it reads as null, so no migration is needed. Any other value drops the
- * record. `fee` (plan 3) reads as null when it is missing or not two digit strings — the record itself is kept.
+ * record. `fee` (plan 3) reads as null when it is missing or not two digit strings — the record itself is kept; so does
+ * `extra` (B1d §1.3), which only the wallet's own record without an intent can carry.
  */
 function recordOf(x: unknown): PendingRecord | null {
   if (!isRecord(x)) return null;
@@ -130,9 +153,18 @@ function recordOf(x: unknown): PendingRecord | null {
   const origin = isDappOrigin(x.origin) ? x.origin : null;
   // Only a dApp record can be owed a first broadcast; anything else (the wallet's own, missing, unknown) is `done`.
   const firstBroadcast: FirstBroadcast = origin !== null && (x.firstBroadcast === 'held' || x.firstBroadcast === 'due') ? x.firstBroadcast : 'done';
+  const extra = origin === null && x.intent === null ? extraOf(x.extra) : null;
   const f = x.failure;
-  if (f === undefined || f === null) return {...x, failure: null, fee, detailCode, origin, firstBroadcast};
-  return f === 'landed' || f === 'not-sent' ? {...x, failure: f, fee, detailCode, origin, firstBroadcast} : null;
+  if (f === undefined || f === null) return {...x, failure: null, fee, detailCode, origin, firstBroadcast, extra};
+  return f === 'landed' || f === 'not-sent' ? {...x, failure: f, fee, detailCode, origin, firstBroadcast, extra} : null;
+}
+
+/** An object whose `kind` is a kind name, its `data` as stored (missing → null); anything else is null. */
+function extraOf(x: unknown): PendingExtra | null {
+  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
+  const {kind, data} = x as Record<string, unknown>;
+  if (typeof kind !== 'string' || !KIND_NAME.test(kind)) return null;
+  return {kind, data: data === undefined ? null : data};
 }
 
 const DIGITS = /^\d{1,20}$/;
@@ -177,9 +209,17 @@ export function viewOf(r: PendingRecord): PendingView {
     expiryNullSeenAt: r.expiryNullSeenAt,
     failure: r.failure,
     fee: r.fee === null ? null : {networkLamports: r.fee.networkLamports, markupLamports: r.fee.markupLamports},
+    extra: r.extra === null ? null : {kind: r.extra.kind, data: r.extra.data},
   };
 }
 
+/** What is written: `extra` only when set (see PendingRecord.extra). */
+function storedForm(r: PendingRecord): PendingRecord | Omit<PendingRecord, 'extra'> {
+  if (r.extra !== null) return r;
+  const {extra: _none, ...rest} = r;
+  return rest;
+}
+
 /** Every open record, plus the newest closed ones up to MAX_RECORDS in all. */
 function trim(records: PendingRecord[]): PendingRecord[] {
   const openCount = records.filter(isOpen).length;
@@ -196,7 +236,7 @@ function trim(records: PendingRecord[]): PendingRecord[] {
 export async function updatePending(ext: Ext, change: (records: PendingRecord[]) => PendingRecord[]): Promise<PendingRecord[]> {
   return serial(async () => {
     const next = trim(change(await readPending(ext)));
-    await ext.local.set(PENDING_KEY, next);
+    await ext.local.set(PENDING_KEY, next.map(storedForm));
     return next;
   });
 }
diff --git a/extension/src/background/prepare.ts b/extension/src/background/prepare.ts
index 9d962f6..8338398 100644
--- a/extension/src/background/prepare.ts
+++ b/extension/src/background/prepare.ts
@@ -10,6 +10,7 @@ import {readSettings} from './settings';
 import {sendReauthReasons, usdMicros, type SendReauthReason} from './reauthPolicy';
 import {CHALLENGE_TTL_MS, challengeInfo, challengeSatisfied, dropChallengesFor, issueChallenge, rebaseChallenge, type SendAboutRefresh} from './reauthChallenges';
 import {digestOf, randomId} from './digest';
+import {SEND_KIND, intentKind, registerIntentKind, type IntentKind} from './intents';
 import {SendRefused, type SendIntent} from './sendTypes';
 import {estimatePriorityFee} from '../../../core/solana/priorityFee';
 import {
@@ -39,10 +40,16 @@ export const MAX_PREPARED = 5;
 const MAX_U64 = 18_446_744_073_709_551_615n;
 const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
 
-export interface PreparedSend {
+/**
+ * B1d §1.3: a prepared entry of any kind — what the shared pipeline (send.ts) signs. `intent` is the kind's own intent,
+ * read back through its `parseIntent`; `shown` is the kind's, of which the pipeline reads only the fee parts it records.
+ */
+export interface PreparedEntry {
   id: string;
   account: string;
-  intent: SendIntent;
+  /** The intent kind (intents.ts): `send` for B1b's send. Part of the integrity digest, and the domain of `intentDigest`. */
+  kind: string;
+  intent: unknown;
   /** The unsigned v0 message, base64 — exactly what will be signed. */
   message: string;
   lastValidBlockHeight: number;
@@ -56,6 +63,14 @@ export interface PreparedSend {
   challengeId: string | null;
   /** preparedIntegrity of every field above: an entry changed after prepare is refused at send. */
   integrity: string;
+  /** What prepare showed — the fee parts the pending record keeps, and the simulation every kind's entry has. Not signed, not bound. */
+  shown: {fees: {networkLamports: string; markupLamports: string}; simulation: object};
+}
+
+/** B1b's send as a prepared entry of kind `send`. */
+export interface PreparedSend extends PreparedEntry {
+  kind: typeof SEND_KIND;
+  intent: SendIntent;
   /** What prepare showed, kept so wallet.preparedFor can show it again. Not signed, not bound. */
   shown: {fees: PreparedView['fees']; solRequiredLamports: string; reasons: SendReauthReason[]; simulation: SimulationView};
 }
@@ -98,15 +113,27 @@ export type ResumableView = PreparedView & {intent: SendIntent; expired: boolean
 
 /** The re-auth binding of a send: who sends what to whom — amounts as decimal strings. */
 export function sendIntentDigest(account: string, intent: SendIntent): string {
-  return digestOf('send', {account, token: intent.token, recipient: intent.recipient, amount: intent.amount});
+  return digestOf(SEND_KIND, sendDigestValue(account, intent));
+}
+
+function sendDigestValue(account: string, intent: SendIntent): {account: string; token: string; recipient: string; amount: string} {
+  return {account, token: intent.token, recipient: intent.recipient, amount: intent.amount};
 }
 
-/** Message integrity of a stored prepared send: every field that decides what is signed, or whether re-auth is asked. */
-export function preparedIntegrity(p: Omit<PreparedSend, 'integrity' | 'shown'>): string {
-  return digestOf('prepared', {
+/**
+ * Message integrity of a stored prepared entry: every field that decides what is signed, or whether re-auth is asked,
+ * and its kind (B1d §1.3) — a send's under B1b's domain `prepared`, so it is what it was before kinds existed; any other
+ * kind's under `prepared/<kind>`. The intent is its kind's own rebuilt form (for a send exactly B1b's token, recipient,
+ * amount); an entry whose kind is not registered, or whose intent its kind does not read, is `prepared-invalid`.
+ */
+export function preparedIntegrity(p: Omit<PreparedEntry, 'integrity' | 'shown'>): string {
+  const kind = intentKind(p.kind);
+  const intent = kind === undefined ? null : kind.parseIntent(p.intent);
+  if (intent === null) throw new SendRefused('prepared-invalid');
+  return digestOf(p.kind === SEND_KIND ? 'prepared' : `prepared/${p.kind}`, {
     id: p.id,
     account: p.account,
-    intent: {token: p.intent.token, recipient: p.intent.recipient, amount: p.intent.amount},
+    intent,
     message: p.message,
     lastValidBlockHeight: p.lastValidBlockHeight,
     createdAt: p.createdAt,
@@ -134,6 +161,15 @@ export function parseIntent(x: unknown): SendIntent | null {
   return {token: token as WalletToken, recipient, amount};
 }
 
+/** B1d §1.3 (C19): B1b's send, registered unconditionally — in both builds, before any message can be handled. */
+export const SEND_INTENT: IntentKind<SendIntent> = {
+  kind: SEND_KIND,
+  parseIntent,
+  digestValue: sendDigestValue,
+  beforeSign: async () => undefined,
+};
+registerIntentKind(SEND_INTENT);
+
 /**
  * USD per whole token for the dollar re-auth rule. NOC has no market price; it is valued at the
  * current presale stage price (owner decision B). A price that cannot be read is `undefined`, which
@@ -151,10 +187,11 @@ async function unitPrice(deps: WalletDeps, token: WalletToken): Promise<number |
   }
 }
 
-function isPreparedShape(x: unknown): x is PreparedSend {
+function isPreparedShape(x: unknown): x is PreparedEntry {
   if (typeof x !== 'object' || x === null) return false;
   const p = x as Record<string, unknown>;
-  if (typeof p.id !== 'string' || typeof p.integrity !== 'string' || typeof p.createdAt !== 'number' || typeof p.shown !== 'object' || p.shown === null) return false;
+  // An entry from before kinds (B1d §1.3) has none: not ours to sign — its intent is prepared again (fail closed).
+  if (typeof p.id !== 'string' || typeof p.kind !== 'string' || typeof p.integrity !== 'string' || typeof p.createdAt !== 'number' || typeof p.shown !== 'object' || p.shown === null) return false;
   // An entry from before E2 has no simulation to show: not ours to resume.
   const sim = (p.shown as Record<string, unknown>).simulation;
   return typeof sim === 'object' && sim !== null;
@@ -220,7 +257,9 @@ export function rentRefusal(err: unknown, keys: readonly string[], sender: strin
   return null;
 }
 
-async function loadPrepared(ext: Ext): Promise<PreparedSend[]> {
+const isSend = (p: PreparedEntry): p is PreparedSend => p.kind === SEND_KIND;
+
+async function loadPrepared(ext: Ext): Promise<PreparedEntry[]> {
   const v = await ext.session.get(PREPARED_KEY);
   // An entry of another shape (an older build's) is not ours to sign or show.
   return Array.isArray(v) ? (v as unknown[]).filter(isPreparedShape) : [];
@@ -405,6 +444,7 @@ export async function prepareSend(
   const bound = {
     id: randomId(deps.randomBytes),
     account,
+    kind: SEND_KIND,
     intent,
     message: messageB64,
     lastValidBlockHeight: latest.lastValidBlockHeight,
@@ -413,9 +453,17 @@ export async function prepareSend(
     challengeId,
   };
   const prepared: PreparedSend = {...bound, integrity: preparedIntegrity(bound), shown: {fees, solRequiredLamports: solRequired.toString(), reasons, simulation}};
-  // Under sessionMutex, the mutex the lock takes (lock() clears storage.session in one section of it,
-  // lockHook.ts): a lock that landed while this send was being read, simulated or challenged is seen
-  // here, and nothing is written back after it.
+  await storePrepared(ext, deps, prepared);
+  return viewOf(ext, deps, prepared);
+}
+
+/**
+ * Stores a prepared entry of any kind (B1d §1.3), replacing every entry of its account — of every kind, so an account
+ * has at most one. Under sessionMutex, the mutex the lock takes (lock() clears storage.session in one section of it,
+ * lockHook.ts): a lock that landed while this entry was being read, simulated or challenged is seen here, and nothing
+ * is written back after it.
+ */
+export async function storePrepared(ext: Ext, deps: Pick<WalletDeps, 'now'>, prepared: PreparedEntry): Promise<void> {
   await sessionMutex(async () => {
     if ((await getSession(ext)) === null) {
       // Locked meanwhile. A challenge issued after the lock's clear would outlive it: remove just
@@ -427,10 +475,9 @@ export async function prepareSend(
     const now = deps.now();
     // Other accounts' entries stay while their challenge can live: past 30 s they are unsendable,
     // but wallet.preparedFor still resumes them (see there).
-    const keep = (await loadPrepared(ext)).filter(p => p.account !== account && now - p.createdAt < CHALLENGE_TTL_MS).slice(-(MAX_PREPARED - 1));
+    const keep = (await loadPrepared(ext)).filter(p => p.account !== prepared.account && now - p.createdAt < CHALLENGE_TTL_MS).slice(-(MAX_PREPARED - 1));
     await ext.session.set(PREPARED_KEY, [...keep, prepared]);
   });
-  return viewOf(ext, deps, prepared);
 }
 
 async function viewOf(ext: Ext, deps: Pick<WalletDeps, 'now'>, p: PreparedSend): Promise<PreparedView> {
@@ -459,7 +506,8 @@ async function viewOf(ext: Ext, deps: Pick<WalletDeps, 'now'>, p: PreparedSend):
  */
 export async function preparedFor(ext: Ext, deps: Pick<WalletDeps, 'now'>, account: string): Promise<ResumableView | null> {
   const now = deps.now();
-  const mine = (await loadPrepared(ext)).filter(p => p.account === account && now - p.createdAt < CHALLENGE_TTL_MS);
+  // A send only (B1d §1.3): another kind's entry is resumed by its own message (presale.preparedFor, B1d-1b).
+  const mine = (await loadPrepared(ext)).filter(isSend).filter(p => p.account === account && now - p.createdAt < CHALLENGE_TTL_MS);
   const newest = mine.reduce<PreparedSend | null>((a, p) => (a === null || p.createdAt >= a.createdAt ? p : a), null);
   if (newest === null) return null;
   const challengeDead = newest.challengeId !== null && (await challengeInfo(ext, now, newest.challengeId)) === null;
@@ -482,12 +530,12 @@ export async function discardPrepared(ext: Ext, account: string): Promise<void>
   });
 }
 
-export async function peekPrepared(ext: Ext, id: string): Promise<PreparedSend | null> {
+export async function peekPrepared(ext: Ext, id: string): Promise<PreparedEntry | null> {
   return (await loadPrepared(ext)).find(p => p.id === id) ?? null;
 }
 
 /** Single use: removed as it is taken, so a second "Send" with the same id finds nothing. */
-export async function takePrepared(ext: Ext, deps: Pick<WalletDeps, 'now'>, id: string): Promise<PreparedSend> {
+export async function takePrepared(ext: Ext, deps: Pick<WalletDeps, 'now'>, id: string): Promise<PreparedEntry> {
   return sessionMutex(async () => {
     const all = await loadPrepared(ext);
     const found = all.find(p => p.id === id);
diff --git a/extension/src/background/send.ts b/extension/src/background/send.ts
index 8d2ac90..490fd1d 100644
--- a/extension/src/background/send.ts
+++ b/extension/src/background/send.ts
@@ -7,16 +7,17 @@ import type {WalletDeps} from './deps';
 import {getSession} from './session';
 import {armAutolock} from './autolock';
 import {challengeSatisfied, consumeChallenge} from './reauthChallenges';
-import {peekPrepared, preparedIntegrity, sendIntentDigest, takePrepared, type PreparedSend} from './prepare';
+import {parseIntent, peekPrepared, preparedIntegrity, takePrepared, type PreparedEntry} from './prepare';
+import {SEND_KIND, intentDigest, intentKind, type IntentKind} from './intents';
 import {submitSigned} from './pending';
-import type {PendingView} from './pendingStore';
-import {SendRefused} from './sendTypes';
+import type {PendingExtra, PendingView} from './pendingStore';
+import {SendRefused, type SendIntent} from './sendTypes';
 
 /**
  * Sign exactly the prepared message bytes (deserialised, signed, serialised — never rebuilt), as
  * its payer, with the session key; the key bytes are zeroed after.
  */
-export function signPrepared(prepared: PreparedSend, account: SessionAccount): Uint8Array {
+export function signPrepared(prepared: PreparedEntry, account: SessionAccount): Uint8Array {
   const message = VersionedMessage.deserialize(base64.decode(prepared.message));
   const payer = message.staticAccountKeys[0];
   if (payer === undefined || payer.toBase58() !== account.publicKey) throw new SendRefused('unknown-account');
@@ -30,22 +31,49 @@ export function signPrepared(prepared: PreparedSend, account: SessionAccount): U
   }
 }
 
-export async function sendPrepared(ext: Ext, deps: WalletDeps, id: string): Promise<PendingView> {
+/** What the pending record says about a signed entry: a send carries its intent; any other kind its display data (B1d §1.3). */
+function recordFields(kind: IntentKind<unknown>, prepared: PreparedEntry, intent: unknown): {intent: SendIntent} | {intent: null; extra: PendingExtra} {
+  if (kind.kind !== SEND_KIND) return {intent: null, extra: {kind: kind.kind, data: kind.pendingData?.(prepared, intent) ?? null}};
+  const send = parseIntent(prepared.intent);
+  if (send === null) throw new SendRefused('prepared-invalid');
+  return {intent: send};
+}
+
+/**
+ * Sign and submit a prepared entry of the caller's kind (B1d §1.3, C29): the session, the entry and its kind; its
+ * challenge, checked without consuming it; the kind's beforeSign; only then the single-use take, the integrity and the
+ * challenge's consumption. `kindName` is the one kind the caller signs — `send` unless it names another (D17: wallet.send
+ * signs only a send; a purchase is signed only through presale.buy, which names its own).
+ */
+export async function sendPrepared(ext: Ext, deps: WalletDeps, id: string, kindName: string = SEND_KIND): Promise<PendingView> {
   if ((await getSession(ext)) === null) throw new SendRefused('locked');
   const peek = await peekPrepared(ext, id);
-  if (peek === null) throw new SendRefused('unknown-prepared');
+  // An entry of another kind is not this caller's to sign: refused as unknown, nothing burned.
+  if (peek === null || peek.kind !== kindName) throw new SendRefused('unknown-prepared');
+  // A kind this build does not handle (an entry of a build with presale, signed in one without it) is never signed.
+  const kind = intentKind(peek.kind);
+  const peekIntent = kind === undefined ? null : kind.parseIntent(peek.intent);
+  if (kind === undefined || peekIntent === null) throw new SendRefused('prepared-invalid');
   // Checked before the prepared send is taken, so a Send before re-authenticating does not burn it.
-  if (peek.challengeId !== null && !(await challengeSatisfied(ext, deps.now(), peek.challengeId, sendIntentDigest(peek.account, peek.intent)))) {
+  if (peek.challengeId !== null && !(await challengeSatisfied(ext, deps.now(), peek.challengeId, intentDigest(kind, peek.account, peekIntent)))) {
     throw new SendRefused('reauth-required', peek.challengeId);
   }
+  // C29 (review M4): the kind's own checks, still before the take — a refusal here leaves the entry stored and the
+  // proof proven, so the re-prepare that follows asks for no second re-authentication. A slow one ends in
+  // takePrepared's unchanged TTL (prepared-expired).
+  await kind.beforeSign({ext, deps}, peek, peekIntent);
   const prepared = await takePrepared(ext, deps, id);
+  // What is signed is the entry beforeSign checked: one changed or replaced since the peek is refused.
+  if (prepared.integrity !== peek.integrity || prepared.kind !== peek.kind) throw new SendRefused('prepared-invalid');
   // What is about to be signed must be what was bound at prepare time: a stored entry changed
   // since (message, amount, recipient, account, challenge) no longer matches its integrity
   // digest and is refused. The challenge is bound to the intent, recomputed from the stored
   // fields — never taken from the stored intentDigest.
-  const intentDigest = sendIntentDigest(prepared.account, prepared.intent);
-  if (preparedIntegrity(prepared) !== prepared.integrity || intentDigest !== prepared.intentDigest) throw new SendRefused('prepared-invalid');
-  if (prepared.challengeId !== null && !(await consumeChallenge(ext, deps.now(), prepared.challengeId, intentDigest))) {
+  const intent = kind.parseIntent(prepared.intent);
+  if (intent === null) throw new SendRefused('prepared-invalid');
+  const digest = intentDigest(kind, prepared.account, intent);
+  if (preparedIntegrity(prepared) !== prepared.integrity || digest !== prepared.intentDigest) throw new SendRefused('prepared-invalid');
+  if (prepared.challengeId !== null && !(await consumeChallenge(ext, deps.now(), prepared.challengeId, digest))) {
     throw new SendRefused('reauth-required');
   }
   // The session as it is now (a lock or a changed account list since the start is honoured).
@@ -57,7 +85,7 @@ export async function sendPrepared(ext: Ext, deps: WalletDeps, id: string): Prom
     account: prepared.account,
     wire: signPrepared(prepared, account),
     lastValidBlockHeight: prepared.lastValidBlockHeight,
-    intent: prepared.intent,
+    ...recordFields(kind, prepared, intent),
     // What this transaction pays, in two parts: its network fee (5 000 per signature plus the priority fee,
     // both fixed by the signed compute-unit price and limit) and the Noctura fee ('0' when none is charged).
     // Apart, because a landed-but-failed transaction pays the first and gets the second rolled back.
````

Modify the gate's staged list (Task 2's ruling) and the off run (Task 1's ruling):

````diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index 83a3ae0..dbe51bd 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -24,8 +24,9 @@ export const CORE_PRESALE_ALLOWED = ['core/presale/addresses.ts', 'core/presale/
 // B1d-1a: the three on-path entries (§1.1); Task 5 adds presale/{layouts,state}.ts and core/presale/limits.ts;
 // 1b adds presale/{quote,buy}.ts; B1d-2 adds presale/{record,referral}.ts and core/referral/index.ts.
 export const ON_BUILD = ['src/background/presale/api.ts', 'src/app/presale/index.ts', 'src/unlock/presale.ts'];
-// Task 6 adds src/background/geo/gate.ts and core/geo/fetch.ts (D15: the off build did not lose the gate).
-export const BOTH_BUILDS = [];
+// Task 3: the intent-kind registry (C19 — both builds sign and read through it); Task 6 adds src/background/geo/gate.ts
+// and core/geo/fetch.ts (D15: the off build did not lose the gate).
+export const BOTH_BUILDS = ['src/background/intents.ts'];
 // Armed by B1d-1b: 1a ships no presale string (Q42 is "both").
 export const MARKERS = [];
 // Task 4 adds Q42; 1b adds F12's Q49–Q51. The decoder's instruction names are read from its source (DECODER).
diff --git a/extension/vitest.nopresale.config.ts b/extension/vitest.nopresale.config.ts
index eb2cb13..a3210f2 100644
--- a/extension/vitest.nopresale.config.ts
+++ b/extension/vitest.nopresale.config.ts
@@ -13,6 +13,8 @@ export const NOPRESALE_TESTS = [
   'src/app/__tests__/router.test.ts',
   'src/app/__tests__/App.test.tsx',
   'src/unlock/__tests__/challenge.test.ts',
+  'src/background/__tests__/intents.test.ts',
+  'src/background/__tests__/pendingKinds.test.ts',
 ];
 
 const base = appConfig({...process.env, NOCTURA_PRESALE: '0'});
````

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, the E2E.**

Run: the Step 2 command — expected `Test Files  6 passed (6)` · `Tests  140 passed (140)` (intents 26, pendingKinds 26, prepare and pendingStore as before, check-no-presale 36, presaleSwitch 16; rev 1: 137 with intents 23 — rev 2 adds the USDC and dApp replays (L1) and the D17 row).

Run: `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  182 passed (182)` · `Tests  3588 passed (3588)` (previous tree 180 / 3534: +2 files, +54 tests — intents 26, pendingKinds 26, check-no-presale +1, presaleSwitch +1; rev 1: 3585). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  7 passed (7)` · `Tests  172 passed (172)` (previous 5 / 120 (rev 1: 169): the two new files run off too — the registry with only `send` after `registerPresale` resolved to its stub, and a stored purchase record read, counted, polled, re-sent and listed).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build, the last line `no presale ok (dist-nopresale off, dist on): … the on build carries 4 required modules; …` (3 entries + `src/background/intents.ts`, which both builds carry). `npm run csp` — ok for both. `npm run reproducible` — four lines, the presale and no-presale digests equal (chrome `sha256:6a2fdb7b…c2e1`, firefox `sha256:6d015c27…30d4` in the dry run). `npx playwright test` — `75 passed` (unchanged count; the send, settings, dApp and visual flows run through the changed pipeline). Rev 2 did not re-run Playwright at this task (no E2E-visible change: D17 refuses only a non-send id at `wallet.send`, which no flow sends); the whole suite ran on the end state instead (Task 6). Repository root `node scripts/check-no-tge-date.mjs` — `no TGE date in 1255 tracked text files`. No `core/` or root `src/` change: root `tsc`/`jest` and web `verify` not required.

- [ ] **Step 5: Commit.**

```bash
git add extension/src/background/intents.ts extension/src/background/prepare.ts extension/src/background/send.ts extension/src/background/pending.ts extension/src/background/pendingStore.ts extension/src/background/__tests__/intents.test.ts extension/src/background/__tests__/pendingKinds.test.ts extension/src/background/__tests__/captured/sends.0b79442.json extension/src/background/__tests__/fixtures.ts extension/src/background/__tests__/prepare.test.ts extension/src/background/__tests__/pendingStore.test.ts extension/scripts/check-no-presale.mjs extension/scripts/__tests__/check-no-presale.test.mjs extension/scripts/__tests__/presaleSwitch.test.mjs extension/vitest.nopresale.config.ts
git commit -m "feat(extension): B1d-1a — the intent-kind registry and the shared send/pending shapes (kind in the digest and the integrity, beforeSign before the single-use take, PendingRecord.extra and the validator's purchase shape, inFlightFor across kinds; wallet.send signs only a send, D17); sends byte-for-byte unchanged against a capture of 0b79442 (SOL with a challenge, USDC without, a dApp record)"
```
(with the executing model's trailer.)

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test files.** `I` = `intents.test.ts`, `P` = `pendingKinds.test.ts`.

| id | the change | named test → observed |
|---|---|---|
| K1 | `intents.ts` `intentDigest`: `digestOf(k.kind, …)` → `digestOf(SEND_KIND, …)` (the kind dropped from the challenge digest) | I “the kind is the challenge digest’s domain…”, “a send’s proven challenge does not sign an entry of another kind with the same values…” — tsc 0 · RED `Tests  2 failed \| 24 passed (26)` |
| K2 | `prepare.ts` `preparedIntegrity`: the domain always `'prepared'` (the kind dropped from the integrity) | I “the integrity covers the kind…” — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| K3 (rev 2, review 1 M2) | `send.ts`: `const kind = intentKind(peek.kind) ?? SEND_INTENT;` (an unregistered kind falls back to send; `SEND_INTENT` imported) — review 1's surviving T3-4 | I “an entry of a kind this build does not handle is refused before anything else, and stays — one whose intent reads as a send’s too” (the send-shaped entry is taken and burned: `expected null to deeply equal { …(11) }`) — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| D1 (rev 2, D17) | `send.ts`: `peek.kind !== kindName` → `(peek.kind !== kindName && false)` (the comparison gone) | I “wallet.send signs only a send (D17)…” (`wallet.send` signs the `test-buy` entry) — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| D2 (rev 2, D17) | `send.ts`: `kindName?: string` with the check only when given (`kindName !== undefined && peek.kind !== kindName` — rev 1's kind-agnostic `wallet.send`) | I the same row — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| O1 | `send.ts`: `beforeSign` moved after `takePrepared` (review M4's named mutation) | I “beforeSign refusing burns nothing…”, “a beforeSign slower than the prepared life…”, “an entry changed while beforeSign ran…” — tsc 0 · RED `Tests  3 failed \| 23 passed (26)` |
| O2 | `send.ts`: the peeked-vs-taken comparison (`prepared.integrity !== peek.integrity \|\| prepared.kind !== peek.kind`) deleted | I “an entry changed while beforeSign ran (same id, its own valid integrity) is refused…” — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| O3 | `send.ts`: `beforeSign` moved before the challenge check | I “an unproven challenge is refused before beforeSign runs”, “signs an entry of another kind: beforeSign sees the peeked entry…” — tsc 0 · RED `Tests  2 failed \| 24 passed (26)` |
| V1 | `pendingStore.ts` `isRecord`: the third shape `(own && i === null)` deleted (review H1's named mutation: the record vanishes) | P (every purchase row), I (the two in-flight / record rows) — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  22 failed \| 30 passed (52)` |
| V2 | `pendingStore.ts` `isRecord`: `r.extra !== undefined &&` required of every record (the validator too strict) | P “a send recorded by the old code, read after a restart…”, “the validator’s verdict on every captured shape is the old one…”, “the one verdict B1d changes…”, “a malformed extra (missing)…”, “pollOnce confirms it…”; I “the whole send, replayed…”, (rev 2) “a token send, replayed…”, “a dApp record, replayed…” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  8 failed \| 44 passed (52)` |
| V3 | `pendingStore.ts` `extraOf`: the kind-name test reduced to “not empty” (`!KIND_NAME.test(kind) && kind === ''`) — a malformed extra accepted | P “a malformed extra (an upper-case kind / a kind with a space / starting with a digit / of 33 characters)…” — tsc 0 · RED `Tests  4 failed \| 22 passed (26)` |
| V4 | `pendingStore.ts` `storedForm`: `if (r.extra !== null \|\| r.id !== '') return r;` (`extra: null` written into every stored record) | P “a send recorded by the old code…”, “the validator’s verdict … its rewrite is the old bytes”, “a send and a dApp record are written without extra…”; I “the whole send, replayed…”, (rev 2) “a token send, replayed…”, “a dApp record, replayed…” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  6 failed \| 46 passed (52)` |
| V5 | `pendingStore.ts` `viewOf`: `extra: r.extra` (the stored object itself) | P “viewOf copies extra: a fresh object, data as stored” — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| V6 | `pendingStore.ts` `recordOf`: `const extra = extraOf(x.extra);` (read on every record) | P “extra is read only on the wallet’s own record without an intent…” — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| I1 | `pendingStore.ts` `inFlightFor`: `&& r.intent !== null` (a purchase not counted) | P “inFlightFor finds it; a send’s prepare and a send’s submit are then refused in-flight…”, “the one verdict B1d changes…”, every malformed-extra row (each asserts the record is in flight); I “a second entry of another kind is refused while the first one’s record is open” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  14 failed \| 38 passed (52)` |
| R1 | `prepare.ts`: `registerIntentKind({...SEND_INTENT, kind: 'send-b1b'})` (the send not registered under its kind) | I “send is registered by prepare.ts itself…”, “refuses … a kind registered twice (send included)” — tsc 0 · RED `Tests  2 failed \| 24 passed (26)` |
| P1 | `prepare.ts` `isSend`: `p.kind.length > 0` (`preparedFor` returns any kind) | I “wallet.preparedFor never returns an entry of another kind” — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| P2 | `prepare.ts` `storePrepared`: an entry replaced only by one of the same kind (`p.account !== prepared.account \|\| p.kind !== prepared.kind`) | I “a prepare of either kind replaces the account’s entry of the other…” — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| S1 | `send.ts` `recordFields`: `data: null` (the kind’s `pendingData` not asked) | I “signs an entry of another kind: … the record has no intent and the kind’s extra (positive control)” — tsc 0 · RED `Tests  1 failed \| 25 passed (26)` |
| G1 | `check-no-presale.mjs`: `BOTH_BUILDS = []` (the staged list loosened) | `check-no-presale.test.mjs` “the on build must carry the three on-path entries…” — tsc 0 · RED `Tests  1 failed \| 35 passed (36)` |
| G2 | `vitest.nopresale.config.ts`: the two appended files removed (the pipeline untested off) | `presaleSwitch.test.mjs` “the shared send pipeline is tested in the off run too…” — tsc 0 · RED `Tests  1 failed \| 15 passed (16)` |

21 mutations (rev 1's 18, re-run on rev 2's tree, plus K3, D1, D2), all red, every one compiling (`tsc` 0). Two first drafts would not have compiled and were written differently before running (not counted): V3 as "the `KIND_NAME` test deleted" leaves the import unused (TS6133), so the mutant keeps the import and lets every non-empty string through; R1 as "the registration deleted" leaves `registerIntentKind` unused, so the mutant registers the send under another name. V1's run lists 22 failures (the table names the first ones by file).

Not covered by a mutation (stated): the `prepared-invalid` refusal of a taken entry whose `kind` differs from the peeked one's (`prepared.kind !== peek.kind`) — no test writes such an entry under the same id with a matching integrity, because the integrity covers the kind (K2) and the intent digest's domain is the kind (K1), so a changed kind is refused by either of those first; the extra comparison is a third binding, kept, and not claimed by a test.

#### Dry-run notes (Task 3)

- **Ruling: the kind enters the challenge digest as `digestOf`'s domain, and the integrity as a per-kind domain (`prepared` for a send, `prepared/<kind>` for any other)** — why: the brief's hard requirement (a send's digest and integrity byte-for-byte unchanged) and §1.3's "include `kind`" are both met only this way; a send's digest was already `digestOf('send', …)` — cost if wrong: none found; K1/K2 prove the kind separates bindings. **Spec conflict, for the controller:** §1.3 says "a challenge issued before the update no longer matches and is asked again — fail closed". Under the brief's requirement that is false for a send (its digest is the same bytes; the test "an entry stored before kinds … its challenge … carries over to the re-prepare" shows it), and for no other kind did a challenge exist before. The sentence should be removed or reworded ("a send's challenge is unchanged; no other kind existed").
- **Ruling: the registry entry has `digestValue`, not `intentDigest`; the registry's `intentDigest(kind, account, intent)` hashes it under the kind** — why: spec §1.3 lists `intentDigest` among the registered functions; a kind that computed its own digest could forget its domain, and then a send's proof could satisfy it (K1's failure mode). The spec's call form `intentDigest(kind, account, intent)` is the exported function — cost if wrong: a rename in 1b.
- **Deviation (stated): `describe` and `onConfirmed` are not in 1a's `IntentKind`; `pendingData?` is added** — why: 1a has no consumer of either (`describe` is #10's description, written by 1b's `buy.ts` when it issues its challenge; `onConfirmed` is B1d-2's record, called by the poller). `pendingData` is not in §1.3's list, but `extra.data` (§2.3) must come from the kind at signing, and nothing else in the pipeline knows it — cost if wrong: 1b/2 add the two members (an interface widening, and one call in `pollOnce` for B1d-2 — a funds-adjacent change that plan must test, not this one).
- **Ruling: a prepared entry stored before kinds (no `kind`) is not read** — fail closed: `sendPrepared` answers `unknown-prepared`, `preparedFor` null, the popup prepares again carrying the challenge id, whose digest is unchanged, so no second re-authentication (tested). Chrome is believed to clear `storage.session` when an extension updates, so such an entry would not be met — believed, not verified (rev 2, review 1 L5); the design does not depend on it — cost if wrong: one re-prepare.
- **Ruling: `PendingRecord.extra` is required (`| null`) in memory and written only when set** (`storedForm` in `updatePending`) — why: the brief's "its stored record byte-for-byte unchanged"; the existing rule for display fields (`fee`: "required, typed | null, so no writer can leave it out") is kept for writers, and the stored bytes of a send and of a dApp record are B1b's (V4, against the capture) — cost if wrong: none; an older build reading a purchase record ignores the extra key.
- **Ruling: the one validator verdict that changes is review H1's shape** — the wallet's own record with `intent: null` (no origin) was dropped by 0b79442 (`ownNullIntent: "dropped"` in the capture) and is now kept, `extra` read or null. `pendingStore.test.ts`'s junk row `{...good, intent: null}` therefore moves out of the junk list (replaced by `intent: undefined` — a record with no intent key, still dropped, and a negative control in `pendingKinds.test.ts`). Every other captured shape reads exactly as before (the verdict test compares the whole read and the rewrite with the capture).
- **Ruling: `extra` is read only on the third shape; a send's or a dApp's stored `extra` reads as null** — why: their verdict and view stay B1b's/B1c's; nothing but the wallet's own non-send record has display data (V6) — cost if wrong: none.
- **Ruling: `extra.data` is copied as stored, missing → null, never validated in the background** — §1.3 "data copied as stored", "parsed by the presale renderer; never used to decide anything" (1b's renderer must treat it as untrusted display input).
- **Ruling: the record's `intent` is set only for the `send` kind; every other kind gets `intent: null` and `extra: {kind, data}` from the pipeline** (`recordFields`) — why: a kind cannot write a record that reads as a send — cost if wrong: none.
- **Ruling: `send` registers itself in `prepare.ts` at module load (`registerIntentKind(SEND_INTENT)`)** — §1.3 "B1b's send registers itself unconditionally"; `intents.ts` imports only types from `prepare.ts`, so there is no runtime cycle; every path that signs imports `prepare.ts` (R1 proves the registration is what makes a send signable).
- **Ruling: `storePrepared` is extracted from `prepareSend` unchanged** (the lock check, the challenge clean-up, the 120 s / `MAX_PREPARED` keep rule, now keyed on the stored entry's account) — why: §1.3 "every prepare, of any kind, replaces every prepared entry of that account" needs one shared write that 1b's `buy.ts` calls; tested for both kinds and for the lock (P2).
- **Ruling: `PreparedEntry.shown` requires `fees` (the two parts the record keeps) and `simulation` (an object) of every kind** — today's `isPreparedShape` rule ("an entry from before E2 has no simulation") generalised; 1b's purchase entry must carry both.
- **(rev 2) Owner decision D17 replaces rev 1's ruling "`wallet.send` stays kind-agnostic":** `wallet.send` signs only `kind: 'send'`; a purchase is signed only through `presale.buy` (1b). Built as one comparison at the top of `sendPrepared` — `sendPrepared(ext, deps, id, kindName = SEND_KIND)` refuses an entry of any other kind as `unknown-prepared` before the registry, the challenge, `beforeSign` or the take, so nothing is burned; `wallet.send` passes no kind (the default), 1b's `presale.buy` passes `'presale-buy'`. Why the default and the code: the most restrictive default (a caller that forgets the argument signs only sends — fail closed for a purchase), and `unknown-prepared` matches `wallet.preparedFor`, which already returns only sends. Tested through `handleWallet('wallet.send', …)` with a `test-buy` entry and with a send-shaped `test-twin` entry (refused, entry kept, nothing broadcast), with a send through `wallet.send` as the positive control (D1, D2). Every `intents.test.ts` call that signs a non-send entry now names its kind.
- **(rev 2, review 1 M2)** The unregistered-kind test now also stores a send-shaped entry (`TWIN`, `INTENT`) under the unregistered kind `test-gone` and calls `sendPrepared(…, 'test-gone')`, so only the registry lookup can refuse it before the take; K3 (review 1's surviving T3-4) is red.
- **(rev 2, review 1 L1)** The capture covers three engine flows, not one: rev 1's SOL send to a new recipient (challenge), a USDC send to a known recipient (no challenge, `fee` with the SPL network fee 7 000) and a dApp record (`recordDappSend` → held, `markDue` → due, the poller's first round → handed once, then confirmed). The fixture was regenerated by the printed program from 0b79442's own code; rev 1's five keys are byte-identical in it.
- **Ruling: the capture is of commit 0b79442 (main), not of Task 2's commit** — the pipeline files are identical between the two (`git diff --quiet` exits 0 for every file the capture touches), and 0b79442 exists in the real repository, while the dry run's commits do not.
- **Gate lists (Task 2's ruling): `BOTH_BUILDS` gains `src/background/intents.ts`** (C19: both builds sign and read through the registry), with a new row "every BOTH_BUILDS module is one the off build may carry"; the synthetic `SHARED` list of the gate's tests gains it. `ON_BUILD` and `MUST_STAY` unchanged (Task 3 adds no presale module and no string). The `no presale ok` line now says "4 required modules".
- **Off run (Task 1's ruling): `NOPRESALE_TESTS` gains `intents.test.ts` and `pendingKinds.test.ts`**, pinned by a row in `presaleSwitch.test.mjs` (G2) — no pin existed for the list.
- **For Task 4:** the popup's `engine.ts` `pendingOf` requires an intent (`intentOf`) and so **drops a record with `intent: null` today** — the generic rendering (Q42) must start by accepting `intent: null` with `extra: {kind: string, data: unknown} | null` from `wallet.pending` / `wallet.send` / `wallet.resend` (every `PendingView` now carries `extra`). E2E 7's seeded record: the §2.3 shape exactly as `PURCHASE` in `pendingKinds.test.ts`, written to `v1_pending` (the background keeps, polls and lists it in both builds — tested here).
- **For B1d-1b:** `registerPresale` calls `registerIntentKind({kind: 'presale-buy', parseIntent, digestValue, beforeSign, pendingData})`; `beforeSign` throws `SendRefused` with codes `SendRefusal` does not have yet (Q14, Q15, Q40c, Q43 — the union widens); the purchase's prepare calls `issueChallenge(ext, deps, intentDigest(kind, …), about)`, builds the entry with `kind: 'presale-buy'` and `preparedIntegrity`, and writes it with `storePrepared`; `presale.buy` signs with `sendPrepared(ext, deps, id, 'presale-buy')` (D17: without the kind it would refuse the entry as `unknown-prepared`); `presale.preparedFor` needs a kind-filtered reader beside `preparedFor` (`loadPrepared` is not exported — export a `preparedOfKind(ext, deps, account, kind)` then); the in-flight check at its prepare is `inFlightFor(await readPending(ext), account)` exactly as `prepareSend`'s. `describePresale` (Task 1) stays the #10 hook.

---

### Task 4: The generic rendering of a record without an intent (Q42) — the popup reads `intent: null` with `extra`; #11, #26, #21, #44 and #54 show a purchase generically in both builds (no amount, no recipient, nothing of `extra.data`); E2E 7 on the off build; `MUST_STAY` gains Q42a; spec §1.3's challenge sentence corrected

**Spec:** B1d §1.3 "Pending records" and "Screens that read `intent`", §2.3 (the record's shape), §4.5 "Pending row", §6.1 "Shared shapes (1a)" (the five screens render Q42 for `intent: null` with an unregistered kind) and "Switch, off build" (a stored `presale-buy` record rendered with Q42), §6.2 item 3 (Q42 must stay in the off build), §6.3 E2E 7, §9 deviation "a purchase record in a build without presale — not drawn: the generic row and title (Q42)", §10 Q42; C19. Brief item 4. Binding design `/home/user/Downloads/index.html` (#11 ix 6272-6621 pending strip, #s26 pending row, #s21, #s44, #s54) for the row styles — the generic rows reuse B1b's classes exactly (no new class, no new CSS). The controller's ruling on Task 3 (ledger): spec §1.3's "a challenge issued before the update no longer matches" is reworded here.

**Files:**
- Create: `extension/src/app/generic.ts` (`GENERIC_TEXT`, Q42's three strings)
- Create: `extension/src/app/__tests__/genericRecord.test.tsx` (the five screens, against the real background; runs in both vitest runs)
- Create: `extension/e2e/presaleOff.spec.ts` (E2E 7 and its visual shots)
- Modify: `extension/src/app/engine.ts` (`PendingExtra`; `Pending.intent: Intent | null`, `Pending.extra`; `pendingOf` reads them, `extraOf` — (rev 2, review 1 L4) `extra` read only on a record without an intent, as the background reads it: a send's extra is null, whatever the wire carries, and the send is never dropped)
- Modify: `extension/src/app/screens/Home.tsx` (#11 strip), `Activity.tsx` (#26 row), `Status.tsx` (#21), `Failed.tsx` (#44), `Stuck.tsx` (#54)
- Modify (tests of the changed type): `extension/src/app/__tests__/engine.test.ts` (two new tests, one row of the existing shape test gains `extra: null`, one `p.intent.amount` → `p.intent?.amount`), `Failed.test.tsx`, `Status.test.tsx`, `Stuck.test.tsx` (their `Pending` builders gain `extra: null`)
- Modify (Task 2's staged lists): `extension/scripts/check-no-presale.mjs` (`MUST_STAY` gains Q42a), `extension/scripts/__tests__/check-no-presale.test.mjs`
- Modify (Task 1's off-run list): `extension/vitest.nopresale.config.ts` (`NOPRESALE_TESTS` gains `genericRecord.test.tsx` and `engine.test.ts`), `extension/scripts/__tests__/presaleSwitch.test.mjs` (one row pins them)
- Modify (spec, the controller's ruling on Task 3): `docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md` §1.3

**Interfaces:**
- Consumes: Task 3's `PendingView.extra: PendingExtra | null` (`wallet.pending`, `wallet.send`, `wallet.resend` answer it on every record — `viewOf`), the background's `KIND_NAME` rule (`/^[a-z][a-z0-9-]{0,31}$/`, `intents.ts`; the popup cannot import the background, so `engine.ts` repeats it as `KIND`), Task 3's validator (a record without an intent and without an origin is kept, `extra` read or null); Task 1's `EXT_NOPRESALE` / `launchPopup(prefix, {ext})` and `NOPRESALE_TESTS`; Task 2's `MUST_STAY`; B1b's fake coordinator (`mode`: `expire` holds a signature unseen, `confirm` confirms it at its second status check, `fail` lands it with an error; `blockHeight` drives expiry).
- Produces (`src/app/engine.ts`):
  ```ts
  export interface PendingExtra {kind: string; data: unknown}
  export interface Pending {
    /* …B1b's fields… */
    intent: Intent | null;          // null: the wallet's own transaction of another kind (B1d §1.3) — a purchase
    extra: PendingExtra | null;     // that kind and its display data, as the background stored it; null for a send
  }
  ```
  `pendingOf` accepts `intent: null` (with `extra` a kind name and its `data`, or `null`) and a send intent with `extra: null`; it fails the reply (`{ok: false, error: 'failed'}`, as every other field) for a missing `extra`, an `extra` that is not `null` or `{kind: <KIND>, data: <anything>}` (`data` must be present), a send that carries an `extra`, and an intent that is neither null nor a send intent. `data` is copied as it came (never read by the popup in 1a).
- Produces (`src/app/generic.ts`): `GENERIC_TEXT = {pending: 'Transaction · pending', slow: 'Transaction · taking longer than usual', line: 'Transaction'}` (Q42a, Q42a, Q42b).
- The five screens, for `intent === null` (whatever `extra` says — 1a has no kind renderer: `presaleSlots` is `null` in both builds):
  - **#11** strip: `GENERIC_TEXT.pending`, or `.slow` by B1b's rule (`stuck` or older than 80 s); the same icon, chevron and tap (→ #21/#54).
  - **#26** pending row: `.pri` = Q42a by #11's rule; `.sec` = B1b's "waiting · m s"; the same icon and tap.
  - **#21**: the amount card holds only `GENERIC_TEXT.line` in `.amount` (no "Amount" eyebrow, no ticker, no fiat line); no To row; every other row, line and button as for a send (Tx hash, Status, Fee paid, "Confirmed in N s", View details, Done).
  - **#44**: no [Try again] and no [Edit transaction] (nothing to prepare again — they need the intent); the explorer link in their place except for rejected-by-program (which keeps its banner link and [View details]); the back arrow and Esc close (they would open #12 with the draft); the kept payload card shows only "Valid until block"; the footer "…same recipient, same amount." is not shown. The eyebrow is B1b's "Transaction".
  - **#54**: the original's card pill reads `GENERIC_TEXT.line` instead of "Send", no Amount and no Recipient row (also in the sending layout's dim card); "Send again (same transaction)" unchanged (B1b's `resend` re-sends the record's own bytes — kind-agnostic, Task 3); the expired layout has no [Try again].

**What "generic" means here, and what it never shows:** a record without an intent is the wallet's own transaction of a kind the screen cannot describe. In 1a no build can describe one (`presaleSlots` is `null` in both, Task 1), so every such record — a `presale-buy` with valid `extra`, a record whose `extra` the background could not read (`extra: null`, kept by Task 3's validator), any future kind — is drawn the same way: Q42's words where a send's amount and recipient stand, and B1b's own rows for what the record knows about itself (the signature, its copy, the explorer link, the fee once paid, the block height, the time waited, B1b's resend). `extra.data` is never read by the popup in 1a — not even to pick a word — so nothing a stored record carries reaches the screen, and §6.2's off-build markers (1b) cannot be pulled into the off build by this code. The only text this task adds to either bundle is Q42 (source "new", build "both"), which the gate now requires in the off build (§6.2 item 3).

- [ ] **Step 1: Write the failing tests.**

`extension/src/app/__tests__/genericRecord.test.tsx` (new — the five screens inside the real provider and background, the record seeded in `v1_pending` exactly as §2.3 stores it; #44 and #54 rendered directly with the view `wallet.pending` hands them, as their own test files do):

````tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {base64} from '@scure/base';
import {renderInWallet, type Wallet} from './harness';
import {Home} from '../screens/Home';
import {Activity} from '../screens/Activity';
import {Status, STATUS_TEXT} from '../screens/Status';
import {FAILED_TEXT, Failed} from '../screens/Failed';
import {STUCK_TEXT, Stuck} from '../screens/Stuck';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {PENDING_KEY, type PendingRecord} from '../../background/pendingStore';
import {firstSignature} from '../../../../core/solana/broadcast';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire} from '../../background/__tests__/fixtures';
import type {Pending} from '../engine';

// B1d §1.3 "Screens that read intent", §4.5, Q42 (C19): the wallet's own record of a kind this build cannot show — a
// purchase (`intent: null`, `extra` of kind presale-buy) in both builds while no kind renderer exists (B1d-1a) — is
// shown generically on #11, #26, #21, #44 and #54: Q42's words, the transaction's own facts (signature, explorer link,
// fee, block height, B1b's resend), never an amount, a recipient or anything from `extra.data`. Runs in both vitest runs.
const SELECTORS = selectorsOf(UI_SHEETS);
// Q42, as literals: a wrong constant must not pass by being compared with itself.
const Q42 = {pending: 'Transaction · pending', slow: 'Transaction · taking longer than usual', line: 'Transaction'};
const WIRE = signedWire(9n);
const SIGNATURE = firstSignature(WIRE);
/** B1d §2.3's display data: every value here must stay off the screen. */
const DATA = {currency: 'USDC', amount: '25000000', stage: '2', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '2500', destination: RECIPIENT, referrer: null};
const EXTRA = {kind: 'presale-buy', data: DATA};
const FEE = {networkLamports: '5050', markupLamports: '0'};
/** A stored purchase record, B1d §2.3's shape (as pendingKinds.test.ts's PURCHASE). */
const purchase = (over: Partial<PendingRecord> = {}): PendingRecord =>
  pendingRecord({id: 'b1', account: ACCOUNT.publicKey, signature: SIGNATURE, wire: base64.encode(WIRE), createdAt: Date.now(), lastSentAt: Date.now(), lastValidBlockHeight: 1150, intent: null, fee: FEE, extra: EXTRA, ...over});
/** What wallet.pending hands a screen for it. */
const view = (over: Partial<Pending> = {}): Pending => ({
  id: 'b1',
  account: ACCOUNT.publicKey,
  signature: SIGNATURE,
  lastValidBlockHeight: 1150,
  createdAt: 1_000_000_000_000,
  lastSentAt: 1_000_000_000_000,
  state: 'pending',
  detail: null,
  detailCode: null,
  intent: null,
  extra: EXTRA,
  expiryNullSeenAt: null,
  failure: null,
  fee: {networkLamports: 5_050n, markupLamports: 0n},
  ...over,
});
const seed = (records: PendingRecord[]) => ({before: (ext: Wallet['ext']) => ext.local.set(PENDING_KEY, records)});
/** Nothing of a purchase's amount, recipient or display data, and no send wording, in `el` (the row, or the whole screen). */
function expectGeneric(el: Element = document.body) {
  const text = el.textContent ?? '';
  for (const v of ['USDC', '25,000', '25.00', '1998667554963357', '1,998,667', 'presale', 'Presale', 'Sending ', 'Recipient', RECIPIENT]) expect([v, text.includes(v)]).toEqual([v, false]);
  expect(el.querySelector('.addr-groups')).toBeNull();
}
const meta = () => [...document.querySelectorAll('.meta-row')].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]);
const cardRows = (card: string) => [...document.querySelectorAll(`${card} .row`)].map(r => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
const nav = {onSend: vi.fn(), onReceive: vi.fn(), onPending: vi.fn(), onAccounts: vi.fn(), onTx: vi.fn()};
const status = {onDone: vi.fn(), onDetails: vi.fn(), onActivity: vi.fn(), onTryAgain: vi.fn(), onEdit: vi.fn()};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('#11 and #26: the pending row of a record without an intent (Q42a)', () => {
  it('#11: "Transaction · pending", no amount; it opens that record — and a send beside it keeps its own row (positive control)', async () => {
    await renderInWallet(<Home onSend={nav.onSend} onReceive={nav.onReceive} onPending={nav.onPending} onAccounts={nav.onAccounts} />, seed([purchase()]));
    const strip = await screen.findByText(Q42.pending);
    expect(document.querySelector('.app-pending-strip .noc-body-sm')?.textContent).toBe(Q42.pending);
    expectGeneric(document.querySelector('.app-pending-strip')!);
    fireEvent.click(strip);
    expect(nav.onPending).toHaveBeenCalledWith(expect.objectContaining({id: 'b1', intent: null, extra: EXTRA}));
  });

  it('#11: a send is still "Sending 2.48 SOL · pending" (the generic row is only for a record without an intent)', async () => {
    await renderInWallet(
      <Home onSend={nav.onSend} onReceive={nav.onReceive} onPending={nav.onPending} onAccounts={nav.onAccounts} />,
      seed([pendingRecord({id: 's1', account: ACCOUNT.publicKey, signature: SIGNATURE, createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}})]),
    );
    expect(await screen.findByText('Sending 2.48 SOL · pending')).toBeTruthy();
    expect(screen.queryByText(Q42.pending)).toBeNull();
  });

  it('#11: past 80 s, or stuck, "Transaction · taking longer than usual"', async () => {
    for (const over of [{createdAt: Date.now() - 81_000}, {state: 'stuck' as const}]) {
      await renderInWallet(<Home onSend={nav.onSend} onReceive={nav.onReceive} onPending={nav.onPending} onAccounts={nav.onAccounts} />, seed([purchase(over)]));
      expect(await screen.findByText(Q42.slow)).toBeTruthy();
      expectGeneric(document.querySelector('.app-pending-strip')!);
      cleanup();
    }
  });

  it('#11: a record whose extra the background could not read (extra null) is shown the same way — kept, never hidden', async () => {
    await renderInWallet(<Home onSend={nav.onSend} onReceive={nav.onReceive} onPending={nav.onPending} onAccounts={nav.onAccounts} />, seed([purchase({extra: null})]));
    expect(await screen.findByText(Q42.pending)).toBeTruthy();
  });

  it('#26: "Transaction · pending" and the time it has waited, no amount; it opens that record', async () => {
    await renderInWallet(<Activity onTx={nav.onTx} onReceive={nav.onReceive} onPending={nav.onPending} />, seed([purchase({createdAt: Date.now() - 5_000})]));
    const row = await waitFor(() => {
      const r = document.querySelector('.tx-row[data-pending="b1"]');
      if (r === null) throw new Error('no pending row');
      return r as HTMLElement;
    });
    expect(row.querySelector('.pri')?.textContent).toBe(Q42.pending);
    expect(row.querySelector('.sec')?.textContent).toMatch(/^waiting · 0 m \d s$/);
    expectGeneric(row);
    fireEvent.click(row);
    expect(nav.onPending).toHaveBeenCalledWith(expect.objectContaining({id: 'b1', intent: null}));
    expect(unstyledClasses(row, SELECTORS)).toEqual([]);
  });

  it('#26: past 80 s, "Transaction · taking longer than usual"; a send beside it keeps "Sending …" (positive control)', async () => {
    const send = pendingRecord({id: 's1', account: ACCOUNT.publicKey, signature: SIGNATURE, createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}});
    await renderInWallet(<Activity onTx={nav.onTx} onReceive={nav.onReceive} onPending={nav.onPending} />, seed([purchase({createdAt: Date.now() - 81_000}), send]));
    await waitFor(() => expect(document.querySelectorAll('.tx-row[data-pending]').length).toBe(2));
    expect([...document.querySelectorAll('.tx-row[data-pending] .pri')].map(p => p.textContent)).toEqual([Q42.slow, 'Sending 2.48 SOL']);
  });
});

describe('#21: a record without an intent (Q42b)', () => {
  const renderStatus = (records: PendingRecord[]) => renderInWallet(<Status account={ACCOUNT.publicKey} id="b1" since={0} canRetry {...status} />, seed(records));

  it('broadcasting: the amount line is "Transaction" — no fiat, no To row; the status row and the honest lines as for a send', async () => {
    await renderStatus([purchase()]);
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(document.querySelector('.amount-card')?.textContent).toBe(Q42.line);
    expect(document.querySelector('.amount-card .amount')?.textContent).toBe(Q42.line);
    expect(document.querySelector('.amount-card .ticker')).toBeNull();
    expect(meta()).toEqual([['Status', STATUS_TEXT.statusBroadcasting]]);
    expect(screen.getByText(STATUS_TEXT.canClose)).toBeTruthy();
    expectGeneric();
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });

  it('slow (80–90 s): the hash with its copy and the waited time — still no To row', async () => {
    await renderStatus([purchase({createdAt: Date.now() - 83_000})]);
    expect(await screen.findByText(STATUS_TEXT.slowLabel)).toBeTruthy();
    expect(meta()).toEqual([
      ['Tx hash', SIGNATURE],
      ['Status', 'Waiting · 1 m 23 s'],
    ]);
    expect(screen.getByRole('button', {name: 'Copy transaction hash'})).toBeTruthy();
    expectGeneric();
  });

  it('polled to confirmed: "Sent successfully", the amount line "Transaction", the hash and the fee paid; [View details] opens its signature', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([purchase()]);
    await screen.findByText(STATUS_TEXT.broadcasting);
    await w.ext.local.set(PENDING_KEY, [purchase({state: 'confirmed'})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(STATUS_TEXT.sentOk)).toBeTruthy();
    expect(document.querySelector('.amount-card')?.textContent).toBe(Q42.line);
    expect(meta()).toEqual([
      ['Tx hash', SIGNATURE],
      ['Fee paid', '0.00000505 SOL'],
    ]);
    expectGeneric();
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.details}));
    expect(status.onDetails).toHaveBeenCalledWith(SIGNATURE);
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });
});

describe('#44: a record without an intent — no [Try again], no [Edit transaction] (nothing to prepare again)', () => {
  const renderFailed = (p: Pending) => renderInWallet(<Failed record={p} canRetry onTryAgain={status.onTryAgain} onEdit={status.onEdit} onDetails={status.onDetails} onClose={status.onDone} />);

  it('blockhash-expired: the kept payload is its block height only; the footer about the same recipient and amount is not shown; the explorer link instead of [Try again]', async () => {
    await renderFailed(view({state: 'expired', detail: 'Not confirmed — no funds moved.'}));
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    expect(document.querySelector('.top-bar .title')?.textContent).toBe(Q42.line);
    expect(cardRows('.s9-payload-card')).toEqual([['Valid until block', '1150']]);
    expect(screen.queryByText(FAILED_TEXT.expiredFoot)).toBeNull();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.edit})).toBeNull();
    expect(screen.getByRole('link', {name: FAILED_TEXT.explorer}).getAttribute('href')).toContain(SIGNATURE);
    expectGeneric();
    // The back arrow closes (it would open #12 with the draft for a send).
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(status.onDone).toHaveBeenCalledTimes(1);
    expect(status.onEdit).not.toHaveBeenCalled();
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('rejected by the program: the reason and its explorer link, [View details]; no [Try again]', async () => {
    await renderFailed(view({state: 'failed', failure: 'landed', detail: 'custom program error: 0x1'}));
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.details}));
    expect(status.onDetails).toHaveBeenCalledWith(SIGNATURE);
    expectGeneric();
  });

  it('not sent: the reason; the explorer link instead of [Try again]', async () => {
    await renderFailed(view({state: 'failed', failure: 'not-sent', detail: 'The route refused it.'}));
    expect(await screen.findByText(FAILED_TEXT.notSentHead)).toBeTruthy();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
    expect(screen.getByRole('link', {name: FAILED_TEXT.explorer})).toBeTruthy();
    expectGeneric();
  });
});

describe('#54: a record without an intent', () => {
  const NOW = 1_000_000_094_000;
  const renderStuck = (p: Pending, deps: Parameters<typeof renderInWallet>[1] = {}) =>
    renderInWallet(<Stuck record={p} now={NOW} canRetry onClose={status.onDone} onActivity={status.onActivity} onTryAgain={status.onTryAgain} />, {
      ...seed([purchase({state: p.state, createdAt: p.createdAt, lastSentAt: p.lastSentAt})]),
      ...deps,
    });

  it('stuck: the original’s card names it "Transaction" — its hash and block height, no amount, no recipient; Send again re-sends its own bytes', async () => {
    const broadcasts: string[] = [];
    await renderStuck(view({state: 'stuck'}), {
      deps: {
        now: () => NOW,
        broadcast: async wire => {
          broadcasts.push(base64.encode(wire));
          return firstSignature(wire);
        },
      },
    });
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    expect(document.querySelector('.orig-card .pill')?.textContent).toBe(Q42.line);
    expect(cardRows('.orig-card').map(([k]) => k)).toEqual(['Tx hash', 'Valid until block']);
    expectGeneric();
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.sentLine)).toBeTruthy();
    expect(broadcasts).toEqual([base64.encode(WIRE)]);
  });

  it('expired: "Not confirmed — no funds moved." and Done — no [Try again] (nothing to prepare again)', async () => {
    await renderStuck(view({state: 'expired'}));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(screen.queryByRole('button', {name: STUCK_TEXT.tryAgain})).toBeNull();
    expect(screen.getByRole('button', {name: STUCK_TEXT.done})).toBeTruthy();
    expectGeneric();
  });
});
````

`extension/src/app/__tests__/engine.test.ts` (the popup's reader; two new tests) and the three `Pending` builders of `Failed.test.tsx`, `Status.test.tsx`, `Stuck.test.tsx` (each gains `extra: null` — the field is required, as `fee`):

````diff
diff --git a/extension/src/app/__tests__/Failed.test.tsx b/extension/src/app/__tests__/Failed.test.tsx
index 753c419..1a46279 100644
--- a/extension/src/app/__tests__/Failed.test.tsx
+++ b/extension/src/app/__tests__/Failed.test.tsx
@@ -38,6 +38,7 @@ const record = (over: Partial<Pending>): Pending => ({
   state: 'failed',
   detail: null,
   intent: INTENT,
+  extra: null,
   expiryNullSeenAt: null,
   failure: null,
   detailCode: null,
diff --git a/extension/src/app/__tests__/Status.test.tsx b/extension/src/app/__tests__/Status.test.tsx
index 0c49bf6..391e9b1 100644
--- a/extension/src/app/__tests__/Status.test.tsx
+++ b/extension/src/app/__tests__/Status.test.tsx
@@ -387,6 +387,7 @@ const view = (over: Partial<Pending> = {}): Pending => ({
   detail: null,
   detailCode: null,
   intent: {token: 'SOL', recipient: ACCOUNT.publicKey, amount: 2_480_000_000n},
+  extra: null,
   expiryNullSeenAt: null,
   failure: null,
   fee: {networkLamports: 5_050n, markupLamports: 20_000n},
diff --git a/extension/src/app/__tests__/Stuck.test.tsx b/extension/src/app/__tests__/Stuck.test.tsx
index ef5cc2c..3e2326b 100644
--- a/extension/src/app/__tests__/Stuck.test.tsx
+++ b/extension/src/app/__tests__/Stuck.test.tsx
@@ -33,6 +33,7 @@ const view = (over: Partial<Pending> = {}): Pending => ({
   detail: null,
   detailCode: null,
   intent: {token: 'SOL', recipient: RECIPIENT, amount: 2_480_000_000n},
+  extra: null,
   expiryNullSeenAt: null,
   failure: null,
   fee: {networkLamports: 5_000n, markupLamports: 50n},
diff --git a/extension/src/app/__tests__/engine.test.ts b/extension/src/app/__tests__/engine.test.ts
index 9b55ba8..6018f52 100644
--- a/extension/src/app/__tests__/engine.test.ts
+++ b/extension/src/app/__tests__/engine.test.ts
@@ -8,7 +8,8 @@ import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
 import {WALLET_TOKENS} from '../../../../core/solana/balances';
 import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
 import {fakeExt} from '../../background/__tests__/fakeExt';
-import {ACCOUNT, RECIPIENT, sendReader} from '../../background/__tests__/fixtures';
+import {ACCOUNT, RECIPIENT, pendingRecord, sendReader} from '../../background/__tests__/fixtures';
+import {PENDING_KEY} from '../../background/pendingStore';
 
 // Spec B1b-2a §8.3: the client wired to the REAL handleMessage, a fake Ext and fake deps, sent from
 // /popup.html — the real background logic with no browser.
@@ -125,10 +126,20 @@ describe('the message client against the real background', () => {
     const sent = await engine.send(again.data.id);
     expect(sent.ok && sent.data.state).toBe('pending');
     const pending = await engine.pending();
-    expect(pending.ok && pending.data.map(p => [p.state, p.intent.amount])).toEqual([['pending', 1_000_000n]]);
+    expect(pending.ok && pending.data.map(p => [p.state, p.intent?.amount, p.extra])).toEqual([['pending', 1_000_000n, null]]);
     expect(await engine.send(again.data.id)).toEqual({ok: false, error: 'unknown-prepared'});
   });
 
+  // B1d §1.3, Q42: a purchase record (B1d §2.3) as the real background lists it — kept, its extra copied, a send's
+  // prepare refused in-flight while it is open.
+  it('pending: a stored record without an intent reaches the popup with its extra; a send is then in-flight', async () => {
+    const {engine, ext} = await wired({reader: sendReader()});
+    const extra = {kind: 'presale-buy', data: {currency: 'SOL', amount: '2000000000', stage: '2', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '30000', destination: RECIPIENT, referrer: null}};
+    await ext.local.set(PENDING_KEY, [pendingRecord({id: 'b1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: null, fee: {networkLamports: '5050', markupLamports: '0'}, extra})]);
+    expect(await engine.pending()).toEqual({ok: true, data: [expect.objectContaining({id: 'b1', intent: null, extra, fee: {networkLamports: 5050n, markupLamports: 0n}})]});
+    expect(await engine.prepareSend(ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: 1n})).toMatchObject({ok: false, error: 'in-flight'});
+  });
+
   it('recipientInfo, discardPrepared, rename, select, history', async () => {
     const reader = sendReader({getSignaturesForAddress: async () => []});
     const {engine} = await wired({reader});
@@ -258,7 +269,7 @@ describe('shape checks: a reply of the wrong shape is failed', () => {
   it('pending: an unknown state or failure value', async () => {
     const p = {
       id: 'r1', account: acc, signature: '5'.repeat(88), lastValidBlockHeight: 1, createdAt: 1, lastSentAt: 1, state: 'pending', detail: null, detailCode: null,
-      intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: {networkLamports: '5050', markupLamports: '0'},
+      intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: {networkLamports: '5050', markupLamports: '0'}, extra: null,
     };
     expect((await engineAnswering({ok: true, data: [p]}).pending()).ok).toBe(true);
     expect(await engineAnswering({ok: true, data: [{...p, state: 'lost'}]}).pending()).toEqual({ok: false, error: 'failed'});
@@ -283,6 +294,49 @@ describe('shape checks: a reply of the wrong shape is failed', () => {
     expect(await engineAnswering({ok: true, data: {...p, detailCode: 'other'}}).resend('r1')).toEqual({ok: false, error: 'failed'});
   });
 
+  // B1d §1.3 (review H1), Q42: the wallet's own record of another kind — no intent, its kind and display data in
+  // `extra` (or null: the background kept a record whose extra it could not read). On such a record the field must be
+  // there and anything else is failed, as every other field; a send's extra is never read (review 1 L4).
+  it('pending: a record without an intent is read with its extra, copied as it came; a malformed one is failed; a send’s extra is never read (review 1 L4)', async () => {
+    const p = {
+      id: 'r1', account: acc, signature: '5'.repeat(88), lastValidBlockHeight: 1, createdAt: 1, lastSentAt: 1, state: 'pending', detail: null, detailCode: null,
+      intent: null, expiryNullSeenAt: null, failure: null, fee: {networkLamports: '5050', markupLamports: '0'},
+      extra: {kind: 'presale-buy', data: {currency: 'SOL', amount: '2000000000', referrer: null, nested: [1, {a: 'b'}]}},
+    };
+    expect(await engineAnswering({ok: true, data: [p]}).pending()).toMatchObject({ok: true, data: [{id: 'r1', intent: null, extra: p.extra}]});
+    for (const data of [null, 0, 'x', [], {}]) expect(await engineAnswering({ok: true, data: [{...p, extra: {kind: 'k', data}}]}).pending()).toMatchObject({ok: true, data: [{extra: {kind: 'k', data}}]});
+    expect(await engineAnswering({ok: true, data: [{...p, extra: null}]}).pending()).toMatchObject({ok: true, data: [{intent: null, extra: null}]});
+    // wallet.send and wallet.resend answer the same view.
+    expect(await engineAnswering({ok: true, data: p}).resend('r1')).toMatchObject({ok: true, data: {intent: null, extra: p.extra}});
+    expect(await engineAnswering({ok: true, data: p}).send('ab'.repeat(16))).toMatchObject({ok: true, data: {intent: null, extra: p.extra}});
+    // A send with its extra null (positive control): read as before.
+    const send = {...p, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, extra: null};
+    expect(await engineAnswering({ok: true, data: [send]}).pending()).toMatchObject({ok: true, data: [{intent: {token: 'SOL', recipient: RECIPIENT, amount: 1n}, extra: null}]});
+    const kinds = ['Presale-buy', 'presale buy', '1kind', '', 'k'.repeat(33), 'kind\u200b'];
+    const malformed: unknown[] = [
+      undefined,
+      'presale-buy',
+      [],
+      {data: {}},
+      {kind: 7, data: {}},
+      {kind: 'presale-buy'},
+      ...kinds.map(kind => ({kind, data: {}})),
+    ];
+    for (const extra of malformed) expect([extra, await engineAnswering({ok: true, data: [{...p, extra}]}).pending()]).toEqual([extra, {ok: false, error: 'failed'}]);
+    const {extra: _omitted, ...withoutExtra} = p;
+    expect(await engineAnswering({ok: true, data: [withoutExtra]}).pending()).toEqual({ok: false, error: 'failed'});
+    // A send's extra is not read (review 1 L4): null whatever it carries — the send is shown, never dropped. An intent
+    // that is neither null nor a send intent is failed.
+    for (const extra of [p.extra, 'x', undefined]) {
+      expect(await engineAnswering({ok: true, data: [{...send, extra}]}).pending()).toMatchObject({ok: true, data: [{intent: {token: 'SOL', recipient: RECIPIENT, amount: 1n}, extra: null}]});
+    }
+    for (const intent of [undefined, {}, {token: 'BONK', recipient: RECIPIENT, amount: '1'}, 'x']) expect(await engineAnswering({ok: true, data: [{...p, intent}]}).pending()).toEqual({ok: false, error: 'failed'});
+    // One malformed record fails the whole list (it is never dropped silently).
+    expect(await engineAnswering({ok: true, data: [send, {...p, extra: 'x'}]}).pending()).toEqual({ok: false, error: 'failed'});
+    // A kind of 32 characters is a kind (the upper bound, positive control of the 33 above).
+    expect((await engineAnswering({ok: true, data: [{...p, extra: {kind: 'k'.repeat(32), data: null}}]}).pending()).ok).toBe(true);
+  });
+
   // Plan 3 follow-up ruling: what is shown as paid follows the state — a landed-but-failed send paid the network
   // fee and had its markup rolled back; not-sent and expired paid nothing; a send not yet settled claims nothing.
   it('feePaidLamports: confirmed = network + markup; failed/landed = network only; not-sent, expired, unsettled = null', () => {
````

The gate's staged list and the off-run pin (`check-no-presale.test.mjs`: the must-stay row and the synthetic builds' bundle text gain Q42a; `presaleSwitch.test.mjs`: one row):

````diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index 1c231df..10d2452 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -144,10 +144,17 @@ describe('strings', () => {
     expect(() => markerViolations([], [file('app/a.js', 'presale')], ['presale'])).toThrow(/at least 8/);
   });
 
-  it('must stay: B1b/B1c presale copy and the decoder instruction names are found in the off build', () => {
-    expect(MUST_STAY).toEqual(['Presale purchase', 'PRESALE PURCHASE']);
-    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"'), file('app/b.js', 'PRESALE PURCHASE')], MUST_STAY)).toEqual([]);
-    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"')], MUST_STAY)).toEqual(['off build: no file contains "PRESALE PURCHASE" — the switch stripped what both builds need']);
+  it('must stay: B1b/B1c presale copy, Q42 and the decoder instruction names are found in the off build', () => {
+    // Q42a (B1d §10, both builds): the generic pending row of a record the build cannot show (B1d-1a Task 4). Q42b
+    // ("Transaction") is too short to mean anything as a string search; its screens are tested in both vitest runs.
+    expect(MUST_STAY).toEqual(['Presale purchase', 'PRESALE PURCHASE', 'Transaction · pending', 'Transaction · taking longer than usual']);
+    const all = [file('app/a.js', '"Presale purchase"'), file('app/b.js', 'PRESALE PURCHASE'), file('app/c.js', '`Transaction · pending`,`Transaction · taking longer than usual`')];
+    expect(missingStrings('off', all, MUST_STAY)).toEqual([]);
+    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"')], MUST_STAY)).toEqual([
+      'off build: no file contains "PRESALE PURCHASE" — the switch stripped what both builds need',
+      'off build: no file contains "Transaction · pending" — the switch stripped what both builds need',
+      'off build: no file contains "Transaction · taking longer than usual" — the switch stripped what both builds need',
+    ]);
   });
 
   it('the decoder names are read from presaleIdl.ts exactly as the module exports them', () => {
@@ -178,7 +185,7 @@ describe('checkNoPresale(offDir, onDir)', () => {
     writeFileSync(join(tmp, dir, 'app.relay.modules.json'), JSON.stringify({chunks: {'relay.js': ['src/relay/index.ts']}}));
     for (const p of ['app', 'chrome', 'firefox']) {
       mkdirSync(join(tmp, dir, p, 'assets'), {recursive: true});
-      writeFileSync(join(tmp, dir, p, 'background.js'), `"Presale purchase";"PRESALE PURCHASE";"presale_purchase_with_sol";"register_referrer";${text}`);
+      writeFileSync(join(tmp, dir, p, 'background.js'), `"Presale purchase";"PRESALE PURCHASE";"Transaction · pending";"Transaction · taking longer than usual";"presale_purchase_with_sol";"register_referrer";${text}`);
     }
   };
   const good = () => {
@@ -214,7 +221,7 @@ describe('checkNoPresale(offDir, onDir)', () => {
 
   it('fails when a must-stay string or a decoder name is missing from the off build', () => {
     good();
-    writeFileSync(join(tmp, 'off', 'app', 'background.js'), '"Presale purchase";"PRESALE PURCHASE";"presale_purchase_with_sol"');
+    writeFileSync(join(tmp, 'off', 'app', 'background.js'), '"Presale purchase";"PRESALE PURCHASE";"Transaction · pending";"Transaction · taking longer than usual";"presale_purchase_with_sol"');
     for (const p of ['chrome', 'firefox']) rmSync(join(tmp, 'off', p, 'background.js'));
     expect(run()).toEqual(['off build: no file contains "register_referrer" — the switch stripped what both builds need']);
   });
diff --git a/extension/scripts/__tests__/presaleSwitch.test.mjs b/extension/scripts/__tests__/presaleSwitch.test.mjs
index 7fd18a2..a6d5335 100644
--- a/extension/scripts/__tests__/presaleSwitch.test.mjs
+++ b/extension/scripts/__tests__/presaleSwitch.test.mjs
@@ -127,6 +127,10 @@ describe('both configs read the same flag (review L11)', () => {
   it('the shared send pipeline is tested in the off run too: the intent-kind registry and a purchase record (B1d §6.1 "Switch, off build", C19)', () => {
     expect(nopresale.test.include).toEqual(expect.arrayContaining(['src/background/__tests__/intents.test.ts', 'src/background/__tests__/pendingKinds.test.ts']));
   });
+
+  it('the generic rendering of a record without an intent is tested in the off run too: #11, #26, #21, #44, #54 (B1d Q42, C19)', () => {
+    expect(nopresale.test.include).toEqual(expect.arrayContaining(['src/app/__tests__/genericRecord.test.tsx', 'src/app/__tests__/engine.test.ts']));
+  });
 });
 
 // Why the plugin and not a guarded call (C4): a module whose top level has an effect stays in the bundle when only its
````

`extension/e2e/presaleOff.spec.ts` (new — E2E 7; the visual shots `test-results/visual/q42-*.png`; nothing imported from `core/` or `src/`):

````ts
import {test, expect, type Page} from '@playwright/test';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {base58, base64} from '@scure/base';
import {BLOCKHASH_LIFETIME, FAKE_START_HEIGHT} from './fakeCoordinator';
import {EXT_NOPRESALE} from './launch';
import {MAIN, contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
import {RECIPIENT, msg} from './sendHelpers';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};

// B1d §6.3 E2E 7 (B1d-1a, review 2 L10), C19, Q42: the build without presale (dist-nopresale) has no presale UI and no
// presale handler, and a purchase signed by an on build before an update — a v1_pending record of exactly §2.3's shape
// — is not lost: shown generically on #11, #26 and #21 (Q42: no amount, no recipient, nothing of its display data),
// counted in flight (a send is refused), and polled to confirmed. The visual shots (test-results/visual/q42-*.png) are
// for the review against the design's row styles (index.html #s11, #s26, #s21, #s44, #s54).
const DIR = 'test-results/visual';
const shot = async (page: Page, name: string) => {
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`});
};
const Q42 = {pending: 'Transaction · pending', slow: 'Transaction · taking longer than usual', line: 'Transaction'};
const SIGNATURE = base58.encode(Uint8Array.from({length: 64}, (_, i) => (i * 13 + 5) % 251 || 1));
/** B1d §2.3's display data: none of it may reach the screen of a build that cannot show it. */
const DATA = {currency: 'USDC', amount: '25000000', stage: '2', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '2500', destination: RECIPIENT, referrer: null};
/** A purchase in v1_pending, B1d §2.3: the wallet's own record (origin null), no intent, its kind and data in `extra`. */
const purchase = (over: object = {}) => ({
  id: 'e7'.repeat(16),
  account: MAIN.publicKey,
  signature: SIGNATURE,
  wire: base64.encode(Uint8Array.of(1, 2, 3)),
  lastValidBlockHeight: FAKE_START_HEIGHT + BLOCKHASH_LIFETIME,
  createdAt: Date.now(),
  lastSentAt: Date.now(),
  state: 'pending',
  detail: null,
  detailCode: null,
  intent: null,
  origin: null,
  firstBroadcast: 'done',
  expiryNullSeenAt: null,
  failure: null,
  fee: {networkLamports: '5050', markupLamports: '0'},
  extra: {kind: 'presale-buy', data: DATA},
  ...over,
});
/** Nothing of the purchase's amount, destination or kind, and no presale word, anywhere in the popup. */
async function expectGeneric(p: Page) {
  const text = (await p.locator('body').textContent()) ?? '';
  for (const v of ['presale', 'Presale', 'PRESALE', 'USDC 25', '25.00', '1998667554963357', '1,998,667', RECIPIENT, 'Sending ']) expect([v, text.includes(v)]).toEqual([v, false]);
}
async function offBuild(prefix: string): Promise<Harness> {
  expect(JSON.parse(readFileSync(join(dirname(EXT_NOPRESALE), 'app.features.json'), 'utf8'))).toEqual({presale: false});
  return launchPopup(prefix, {ext: EXT_NOPRESALE});
}
const seed = (h: Harness, record: object) => h.sw.evaluate(r => chrome.storage.local.set({v1_pending: [r]}), record);
const meta = (p: Page) => p.locator('.meta-row').evaluateAll(rows => rows.map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]));

test('7 · off build: no presale UI or handler; a seeded purchase record is shown generically on #11, #26 and #21, blocks a send, and is polled to confirmed', async () => {
  const h = await offBuild('noctura-e2e-presale-off-');
  try {
    // Held pending until the test says otherwise: the network does not see it yet.
    h.fake.mode = 'expire';
    await seedUnlockedWallet(h.sw);
    await seed(h, purchase());
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    // No banner, no Buy (B1d §4.5's slots are absent), and presale.view refused before any handler.
    expect(await popup.locator('.quick .qa .lbl').allTextContents()).toEqual(['Send', 'Receive']);
    expect(await msg(popup, {type: 'presale.view'})).toEqual({ok: false, error: 'unknown type'});
    // #11: the generic pending row (Q42a).
    await expect(popup.locator('.app-pending-strip .noc-body-sm')).toHaveText(Q42.pending, {timeout: 30_000});
    await expectGeneric(popup);
    await shot(popup, 'q42-11-pending');
    // In flight (C10): a send of this account is refused while the purchase is open.
    expect(await msg(popup, {type: 'wallet.prepareSend', account: MAIN.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000000'}})).toMatchObject({ok: false, error: 'in-flight'});
    // #26: the pending row, generic too.
    await popup.getByRole('button', {name: 'Activity'}).click();
    const row = popup.locator(`.tx-row[data-pending="${'e7'.repeat(16)}"]`);
    await expect(row.locator('.pri')).toHaveText(Q42.pending, {timeout: 30_000});
    await expect(row.locator('.sec')).toHaveText(/^waiting · \d+ m \d+ s$/);
    await expectGeneric(popup);
    await shot(popup, 'q42-26-pending');
    // #21 from the row: the amount line is "Transaction", no To row.
    await row.click();
    await expect(popup.getByText('Broadcasting transaction…')).toBeVisible({timeout: 30_000});
    await expect(popup.locator('.amount-card')).toHaveText(Q42.line);
    expect(await meta(popup)).toEqual([['Status', 'Broadcasting']]);
    await expectGeneric(popup);
    await shot(popup, 'q42-21-pending');
    // The network confirms it (B1b's fake: at its second status check): the background's poller, then #21's read.
    h.fake.mode = 'confirm';
    await expect(popup.getByText('Sent successfully')).toBeVisible({timeout: 45_000});
    await expect(popup.locator('.amount-card')).toHaveText(Q42.line);
    expect(await meta(popup)).toEqual([
      ['Tx hash', SIGNATURE],
      ['Fee paid', '0.00000505 SOL'],
    ]);
    await expectGeneric(popup);
    await shot(popup, 'q42-21-confirmed');
    expect((await msg(popup, {type: 'wallet.pending'})).data).toEqual([expect.objectContaining({id: 'e7'.repeat(16), state: 'confirmed', intent: null, extra: {kind: 'presale-buy', data: DATA}})]);
    // Nothing was broadcast: polling a record never sends it.
    expect(h.fake.broadcasts).toEqual([]);
    // #31 (Settings) has no presale row.
    await popup.getByRole('button', {name: 'Done'}).click();
    await popup.getByRole('button', {name: 'Settings'}).click();
    await expect(popup.locator('.screen').first()).toBeVisible();
    expect(await popup.locator('main').textContent()).not.toMatch(/presale|referral/i);
    contained(h);
  } finally {
    await h.close();
  }
});

test('7 · visual: #54 and #44 for a purchase record in the off build — generic, no [Try again]', async () => {
  const h = await offBuild('noctura-e2e-presale-off-v-');
  try {
    h.fake.mode = 'expire';
    await seedUnlockedWallet(h.sw);
    // #54: a record the engine already calls stuck.
    await seed(h, purchase({state: 'stuck', createdAt: Date.now() - 95_000, lastSentAt: Date.now() - 95_000}));
    const popup = await h.openPopup();
    await expect(popup.locator('.app-pending-strip .noc-body-sm')).toHaveText(Q42.slow, {timeout: 30_000});
    await shot(popup, 'q42-11-slow');
    await popup.locator('.app-pending-strip').click();
    await expect(popup.getByText('Transaction stuck')).toBeVisible({timeout: 30_000});
    await expect(popup.locator('.orig-card .pill')).toHaveText(Q42.line);
    expect(await popup.locator('.orig-card .row .k').allTextContents()).toEqual(['Tx hash', 'Valid until block']);
    await expectGeneric(popup);
    await shot(popup, 'q42-54-stuck');
    // Its blockhash's life passed with margin: two null full-history checks, then the expired layout — Done only.
    h.fake.blockHeight = FAKE_START_HEIGHT + BLOCKHASH_LIFETIME + 33;
    await expect(popup.getByText('Not confirmed — no funds moved.')).toBeVisible({timeout: 45_000});
    await expect(popup.getByRole('button', {name: 'Try again'})).toHaveCount(0);
    await expect(popup.getByRole('button', {name: 'Done'})).toBeVisible();
    await expectGeneric(popup);
    await shot(popup, 'q42-54-expired');
    await popup.close();
    // #44: another purchase, open, that lands with a program error — in a popup opened after it was stored (the popup
    // re-reads wallet.pending every 2 s only while it knows an open record, B1b).
    h.fake.blockHeight = FAKE_START_HEIGHT;
    await seed(h, purchase({id: 'e8'.repeat(16)}));
    const again = await h.openPopup();
    await expect(again.locator('.app-pending-strip .noc-body-sm')).toHaveText(Q42.pending, {timeout: 30_000});
    await again.locator('.app-pending-strip').click();
    await expect(again.locator('.amount-card')).toHaveText(Q42.line, {timeout: 30_000});
    h.fake.mode = 'fail';
    await expect(again.getByText('Program rejected the transaction')).toBeVisible({timeout: 45_000});
    await expect(again.getByRole('button', {name: 'Try again'})).toHaveCount(0);
    await expect(again.getByRole('button', {name: 'View details'})).toBeVisible();
    await expectGeneric(again);
    await shot(again, 'q42-44-rejected');
    expect(h.fake.broadcasts).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run (in `extension/`): `npx vitest run src/app/__tests__/genericRecord.test.tsx src/app/__tests__/engine.test.ts scripts/__tests__/check-no-presale.test.mjs scripts/__tests__/presaleSwitch.test.mjs src/app/__tests__/Failed.test.tsx src/app/__tests__/Status.test.tsx src/app/__tests__/Stuck.test.tsx`

Expected (the dry run, on Task 3's tree + the Step 1 files; rev 2 re-ran it on 30626f6 with the same counts and `tsc` 2 with the same 5 errors): `Test Files  4 failed | 3 passed (7)` · `Tests  18 failed | 146 passed (164)`:
- `genericRecord.test.tsx` 13 of 14 red — #11 and #26 never draw the row (`Unable to find an element with the text: Transaction · pending`, `Error: no pending row`: the old `pendingOf` refuses `intent: null`, so the whole `wallet.pending` reply is `failed` and the provider shows no open record), #21 stays on "Checking…" (`Unable to find … Broadcasting transaction…`), #44 shows [Try again] (`expected <button …> to be null`), #54 throws (`TypeError: Cannot read properties of null (reading 'token')` / `(reading 'recipient')` — the old screens dereference `intent.*`). The green one is the positive control "#11: a send is still "Sending 2.48 SOL · pending"".
- `engine.test.ts` 3 red — the two new tests (`expected { ok: false, error: 'failed' } to match object { ok: true, … }`) and the round trip's new `extra` column (`expected [ [ 'pending', 1000000n, undefined ] ] to deeply equal [ [ 'pending', 1000000n, null ] ]`).
- `check-no-presale.test.mjs` 1 red (`expected [ 'Presale purchase', …(1) ] to deeply equal [ 'Presale purchase', …(3) ]`); `presaleSwitch.test.mjs` 1 red (the off-run list).
- `Failed.test.tsx`, `Status.test.tsx`, `Stuck.test.tsx` green (vitest does not type-check; their change is a field).

`npx tsc --noEmit; echo $?` → `2` (5 errors: `'extra' does not exist in type 'Pending'` in the three builders and `engine.test.ts`, `Type 'null' is not assignable to type 'Intent'` in `genericRecord.test.tsx`).

**(rev 2) The changed engine test against rev 1's implementation** (b436245 + rev 2's `engine.test.ts`): `Tests  1 failed | 29 passed (30)` — the shape test, at the send carrying an `extra` (`expected { ok: false, error: 'failed' } to match object { ok: true, … }`): rev 1's popup failed the whole `wallet.pending` reply for it.

E2E red (the dry run: 9bed436 + `presaleOff.spec.ts`, both builds built; not re-run in rev 2 — neither the spec file nor Task 3's popup changed): `npx playwright test e2e/presaleOff.spec.ts` → `2 failed` — both at their first #11 assertion (`Expected: "Transaction · pending"` / `"Transaction · taking longer than usual"`, `element(s) not found`): the off build keeps and polls the record (Task 3) but its popup cannot read it.

- [ ] **Step 3: Implement.**

`extension/src/app/generic.ts` (new):

````ts
/**
 * B1d Q42 (C19, §1.3 "Screens that read intent"): the words for the wallet's own record of a kind this build cannot show
 * (`intent: null` — a purchase, while no kind renderer exists). Only the transaction's own facts go beside them: never an
 * amount, a recipient or anything from `extra.data`.
 */
export const GENERIC_TEXT = {
  pending: 'Transaction · pending',
  slow: 'Transaction · taking longer than usual',
  line: 'Transaction',
} as const;
````

`extension/src/app/engine.ts`:

````diff
diff --git a/extension/src/app/engine.ts b/extension/src/app/engine.ts
index 8cc2b44..63872bb 100644
--- a/extension/src/app/engine.ts
+++ b/extension/src/app/engine.ts
@@ -86,7 +86,13 @@ export interface Pending {
   detail: string | null;
   /** What `detail` says about the last broadcast, as a code (background DetailCode): screens choose on this, never on the text. */
   detailCode: DetailCode | null;
-  intent: Intent;
+  /**
+   * The send's intent, or null: the wallet's own transaction of another kind (B1d §1.3, C19 — a purchase), which a
+   * screen shows through its kind's renderer when the build has one, else generically (Q42): no amount, no recipient.
+   */
+  intent: Intent | null;
+  /** B1d §1.3: that other kind and its display data, never used to decide anything; null for a send. */
+  extra: PendingExtra | null;
   expiryNullSeenAt: number | null;
   failure: 'landed' | 'not-sent' | null;
   /**
@@ -95,6 +101,11 @@ export interface Pending {
    */
   fee: {networkLamports: bigint; markupLamports: bigint} | null;
 }
+/** B1d §1.3 (background PendingExtra): a kind name and that kind's data, as the background stored it. */
+export interface PendingExtra {
+  kind: string;
+  data: unknown;
+}
 export type HistoryKind = 'sent' | 'received' | 'purchase' | 'other';
 export interface HistoryItem {
   signature: string;
@@ -380,12 +391,15 @@ function pendingOf(x: unknown): Pending | undefined {
   const o = obj(x);
   if (o === undefined || typeof o.id !== 'string' || !isAddress(o.account) || typeof o.signature !== 'string' || !SIGNATURE.test(o.signature)) return undefined;
   const state = oneOf(o.state, STATES);
-  const intent = intentOf(o.intent);
+  const intent = o.intent === null ? null : intentOf(o.intent);
+  // Read only on a record without an intent, as the background reads it (pendingStore.ts): a send's extra is null,
+  // whatever was stored — never a reason to drop the send (review 1 L4).
+  const extra = intent === null ? extraOf(o.extra) : null;
   const failure = o.failure === null ? null : oneOf(o.failure, ['landed', 'not-sent'] as const);
   const expiry = o.expiryNullSeenAt === null ? null : isTime(o.expiryNullSeenAt) ? o.expiryNullSeenAt : undefined;
   const fee = feeOf(o.fee);
   const detailCode = o.detailCode === null ? null : oneOf(o.detailCode, DETAIL_CODES);
-  if (state === undefined || intent === undefined || failure === undefined || expiry === undefined || fee === undefined || detailCode === undefined) return undefined;
+  if (state === undefined || intent === undefined || extra === undefined || failure === undefined || expiry === undefined || fee === undefined || detailCode === undefined) return undefined;
   if (!isInt(o.lastValidBlockHeight) || !isTime(o.createdAt) || !isTime(o.lastSentAt) || !(o.detail === null || typeof o.detail === 'string')) return undefined;
   return {
     id: o.id,
@@ -398,12 +412,23 @@ function pendingOf(x: unknown): Pending | undefined {
     detail: o.detail,
     detailCode,
     intent,
+    extra,
     expiryNullSeenAt: expiry,
     failure,
     fee,
   };
 }
 
+/** The background's KIND_NAME (intents.ts): a kind's name. */
+const KIND = /^[a-z][a-z0-9-]{0,31}$/;
+/** `null`, or a kind name and its data (any JSON, copied as it came); a missing field or any other value is undefined (failed). */
+function extraOf(x: unknown): PendingExtra | null | undefined {
+  if (x === null) return null;
+  const o = obj(x);
+  if (o === undefined || typeof o.kind !== 'string' || !KIND.test(o.kind) || !('data' in o)) return undefined;
+  return {kind: o.kind, data: o.data};
+}
+
 /** `null`, or exactly two base-unit strings; a missing field or any other value is undefined (failed). */
 function feeOf(x: unknown): Pending['fee'] | undefined {
   if (x === null) return null;
````

The five screens — `Home.tsx` (#11), `Activity.tsx` (#26), `Status.tsx` (#21), `Failed.tsx` (#44), `Stuck.tsx` (#54):

````diff
diff --git a/extension/src/app/screens/Activity.tsx b/extension/src/app/screens/Activity.tsx
index bbdda8e..4ea5254 100644
--- a/extension/src/app/screens/Activity.tsx
+++ b/extension/src/app/screens/Activity.tsx
@@ -10,13 +10,21 @@ import {ExtIcon} from '../ui/ExtIcon';
 import {Banner, RefusedBanner} from '../ui/Banner';
 import {OriginBadge} from '../ui/OriginBadge';
 import type {HistoryItem, Pending} from '../engine';
+import {GENERIC_TEXT} from '../generic';
 
 /** wallet.history answers 10 per page (background HISTORY_PAGE_SIZE); "Load more" follows the reply's own `next` cursor (review fix round 1 #1), not this count. */
 export const PAGE_SIZE = 10;
 
 function PendingRow({p, now, onOpen}: {p: Pending; now: number; onOpen: () => void}) {
   const secs = Math.max(0, Math.floor((now - p.createdAt) / 1000));
-  const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
+  const intent = p.intent;
+  // A record without an intent (B1d §1.3: another kind) reads Q42, with #11's rule for "taking longer than usual".
+  const title =
+    intent === null
+      ? p.state === 'stuck' || now - p.createdAt > 80_000
+        ? GENERIC_TEXT.slow
+        : GENERIC_TEXT.pending
+      : `Sending ${formatAmount(intent.amount, TOKEN_INFO[intent.token].decimals, {min: 0, max: TOKEN_INFO[intent.token].decimals})} ${intent.token}`;
   // An open send opens #21 (or #54 once it is stuck).
   return (
     <button type="button" className="tx-row" data-pending={p.id} onClick={onOpen}>
@@ -24,9 +32,7 @@ function PendingRow({p, now, onOpen}: {p: Pending; now: number; onOpen: () => vo
         <ExtIcon name="arrow-up-right" size={20} />
       </span>
       <div className="meta">
-        <span className="pri noc-body-lg">
-          Sending {amount} {p.intent.token}
-        </span>
+        <span className="pri noc-body-lg">{title}</span>
         <span className="sec noc-body-sm">
           waiting · {Math.floor(secs / 60)} m {secs % 60} s
         </span>
diff --git a/extension/src/app/screens/Failed.tsx b/extension/src/app/screens/Failed.tsx
index d02cf61..32a71cd 100644
--- a/extension/src/app/screens/Failed.tsx
+++ b/extension/src/app/screens/Failed.tsx
@@ -43,7 +43,9 @@ export function failedKind(p: Pending): Kind {
  * #44 tx-failed (spec §4.7): the design's categories the engine can report, chosen by `failure` (E8). Removed,
  * loudly: insufficient-fee (the engine never reports it; priority is automatic, D15), the slippage content (no
  * swaps), the RPC picker (reads and broadcast are fixed to the coordinator). `[Try again]` is a fresh prepare of
- * the same intent at #19 (rule 6: a LockedButton); the explorer link is Solscan's, checked (§6.5).
+ * the same intent at #19 (rule 6: a LockedButton); the explorer link is Solscan's, checked (§6.5). A record without an
+ * intent (B1d §1.3: another kind, Q42) has nothing to prepare again: no [Try again] or [Edit transaction] (the explorer
+ * link in their place, the back arrow closes), and its kept payload is its block height — no recipient, no amount.
  */
 export function Failed({
   record,
@@ -68,10 +70,14 @@ export function Failed({
   const m = useWallet();
   const kind = failedKind(record);
   const refused = m.net.mode === 'refused';
-  const edit = () => onEdit(draftOf(record.intent));
+  const intent = record.intent;
+  const retry = canRetry && intent !== null;
+  const edit = () => {
+    if (intent !== null) onEdit(draftOf(intent));
+  };
   // The design's back arrow returns to #12 with the form kept: the same as [Edit transaction] — while the record's
   // account is selected. Otherwise it closes to #11.
-  const back = canRetry ? edit : onClose;
+  const back = retry ? edit : onClose;
   useEscape(back);
   const head = kind === 'blockhash-expired' ? FAILED_TEXT.expiredHead : kind === 'rejected-by-program' ? FAILED_TEXT.rejectedHead : kind === 'network-error' ? FAILED_TEXT.notSentHead : FAILED_TEXT.genericHead;
   // The sub: expired, the engine's own line (its NOT_CONFIRMED; expiredSub only when the record has none); rejected, the
@@ -85,8 +91,8 @@ export function Failed({
         : kind === 'network-error'
           ? FAILED_TEXT.notSentSub
           : record.detail ?? '';
-  const tryAgain = !canRetry ? null : (
-    <LockedButton className="btn btn-primary" disabled={refused} onPress={() => onTryAgain(record.intent)}>
+  const tryAgain = !retry ? null : (
+    <LockedButton className="btn btn-primary" disabled={refused} onPress={() => onTryAgain(intent)}>
       <ExtIcon name="refresh" size={18} />
       {FAILED_TEXT.tryAgain}
     </LockedButton>
@@ -127,30 +133,34 @@ export function Failed({
           <>
             <div className="s9-payload-card">
               <span className="label">{FAILED_TEXT.payload}</span>
-              <div className="row">
-                <span className="k">To</span>
-                <span className="v mono noc-mono">
-                  <AddressGroups address={record.intent.recipient} />
-                </span>
-              </div>
-              <div className="row">
-                <span className="k">Amount</span>
-                <span className="v noc-numeral">
-                  {showExact(record.intent.token, record.intent.amount)} {record.intent.token}
-                </span>
-              </div>
+              {intent === null ? null : (
+                <>
+                  <div className="row">
+                    <span className="k">To</span>
+                    <span className="v mono noc-mono">
+                      <AddressGroups address={intent.recipient} />
+                    </span>
+                  </div>
+                  <div className="row">
+                    <span className="k">Amount</span>
+                    <span className="v noc-numeral">
+                      {showExact(intent.token, intent.amount)} {intent.token}
+                    </span>
+                  </div>
+                </>
+              )}
               <div className="row">
                 <span className="k">Valid until block</span>
                 <span className="v noc-numeral">{record.lastValidBlockHeight}</span>
               </div>
             </div>
-            <p className="noc-caption app-muted">{FAILED_TEXT.expiredFoot}</p>
+            {intent === null ? null : <p className="noc-caption app-muted">{FAILED_TEXT.expiredFoot}</p>}
           </>
         ) : null}
       </div>
       <div className="sticky-bar">
-        {kind === 'generic' ? explorer : tryAgain}
-        {kind === 'blockhash-expired' && canRetry ? (
+        {kind === 'generic' || (intent === null && kind !== 'rejected-by-program') ? explorer : tryAgain}
+        {kind === 'blockhash-expired' && retry ? (
           <button type="button" className="btn btn-secondary" onClick={edit}>
             {FAILED_TEXT.edit}
           </button>
diff --git a/extension/src/app/screens/Home.tsx b/extension/src/app/screens/Home.tsx
index b911eab..613128b 100644
--- a/extension/src/app/screens/Home.tsx
+++ b/extension/src/app/screens/Home.tsx
@@ -12,6 +12,7 @@ import {SkelCircle, SkelLine} from '../ui/Skeleton';
 import {TokenTile} from '../ui/TokenTile';
 import type {DappReauth, Pending, Token} from '../engine';
 import {reauthPage} from '../platform';
+import {GENERIC_TEXT} from '../generic';
 
 /** #42's banner: offline is navigator's word; unreachable says the server did not answer (review L3). */
 function NetBanner({mode, sustainedNow, lastSync, failures, now}: {mode: NetMode; sustainedNow: boolean; lastSync: number | null; failures: number; now: number}) {
@@ -48,17 +49,22 @@ function NetBanner({mode, sustainedNow, lastSync, failures, now}: {mode: NetMode
 
 /**
  * #11's pending strip: an open send of this account, which opens #21 (or #54 once it is stuck). B1c-3: on the dApp
- * strip's gutter, with the same trailing chevron — a strip that opens something says so.
+ * strip's gutter, with the same trailing chevron — a strip that opens something says so. A record without an intent
+ * (B1d §1.3: another kind) reads Q42.
  */
 function PendingStrip({p, now, onOpen}: {p: Pending; now: number; onOpen: () => void}) {
   const slow = p.state === 'stuck' || now - p.createdAt > 80_000;
-  const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
+  const intent = p.intent;
   return (
     <button type="button" className="banner info app-banner app-strip app-pending-strip" onClick={onOpen}>
       <ExtIcon name="send" size={18} />
-      <span className="noc-body-sm">
-        Sending {amount} {p.intent.token} · {slow ? 'taking longer than usual' : 'pending'}
-      </span>
+      {intent === null ? (
+        <span className="noc-body-sm">{slow ? GENERIC_TEXT.slow : GENERIC_TEXT.pending}</span>
+      ) : (
+        <span className="noc-body-sm">
+          Sending {formatAmount(intent.amount, TOKEN_INFO[intent.token].decimals, {min: 0, max: TOKEN_INFO[intent.token].decimals})} {intent.token} · {slow ? 'taking longer than usual' : 'pending'}
+        </span>
+      )}
       <span className="app-strip-chev">
         <ExtIcon name="chevron-right" size={18} />
       </span>
diff --git a/extension/src/app/screens/Status.tsx b/extension/src/app/screens/Status.tsx
index 96072f7..40e4129 100644
--- a/extension/src/app/screens/Status.tsx
+++ b/extension/src/app/screens/Status.tsx
@@ -12,6 +12,7 @@ import {useNow} from '../useNow';
 import {Stuck, STUCK_TEXT} from './Stuck';
 import {Failed} from './Failed';
 import {feePaidLamports, type Intent, type Pending, type PendingState} from '../engine';
+import {GENERIC_TEXT} from '../generic';
 
 /** The fixed strings #21 shows (spec §4.6); adapted ones are marked there. */
 export const STATUS_TEXT = {
@@ -213,28 +214,42 @@ function Tracked({account, id, since, canRetry, onDone, onDetails, onActivity, o
     );
   }
 
-  const token = record.intent.token;
-  const usd = usdOf(token, record.intent.amount, m.prices);
-  // The fiat line: --fg-secondary on success and slow, --fg-tertiary while broadcasting (index.html #s21).
-  const amountCard = (big: boolean, dim: boolean) => (
-    <div className="amount-card">
-      <span className="eyebrow">Amount</span>
-      <div className="amount-line">
-        <span className={`amount noc-numeral${big ? ' noc-balance-lg app-amount-big' : ''}`}>{showExact(token, record.intent.amount)}</span>
-        <span className="ticker">{token}</span>
+  const intent = record.intent;
+  // The fiat line: --fg-secondary on success and slow, --fg-tertiary while broadcasting (index.html #s21). A record
+  // without an intent (B1d §1.3: another kind) has Q42's line in the amount's place, and no To row: no amount, no
+  // recipient, no fiat.
+  const amountCard = (big: boolean, dim: boolean) => {
+    if (intent === null) {
+      return (
+        <div className="amount-card">
+          <div className="amount-line">
+            <span className="amount">{GENERIC_TEXT.line}</span>
+          </div>
+        </div>
+      );
+    }
+    const usd = usdOf(intent.token, intent.amount, m.prices);
+    return (
+      <div className="amount-card">
+        <span className="eyebrow">Amount</span>
+        <div className="amount-line">
+          <span className={`amount noc-numeral${big ? ' noc-balance-lg app-amount-big' : ''}`}>{showExact(intent.token, intent.amount)}</span>
+          <span className="ticker">{intent.token}</span>
+        </div>
+        {usd === null ? null : <span className={`noc-caption noc-numeral ${dim ? 'app-dim' : 'app-secondary'}`}>≈ {showUsd(usd)} USD</span>}
       </div>
-      {usd === null ? null : <span className={`noc-caption noc-numeral ${dim ? 'app-dim' : 'app-secondary'}`}>≈ {showUsd(usd)} USD</span>}
-    </div>
-  );
-  const toRow = (
-    <div className="meta-row">
-      <span className="lbl">To</span>
-      <span className="val mono noc-mono">
-        <AddressGroups address={record.intent.recipient} />
-      </span>
-      <CopyIcon value={record.intent.recipient} label="Copy recipient" />
-    </div>
-  );
+    );
+  };
+  const toRow =
+    intent === null ? null : (
+      <div className="meta-row">
+        <span className="lbl">To</span>
+        <span className="val mono noc-mono">
+          <AddressGroups address={intent.recipient} />
+        </span>
+        <CopyIcon value={intent.recipient} label="Copy recipient" />
+      </div>
+    );
   const hashRow = (
     <div className="meta-row">
       <span className="lbl">Tx hash</span>
diff --git a/extension/src/app/screens/Stuck.tsx b/extension/src/app/screens/Stuck.tsx
index 63515c4..b7643b9 100644
--- a/extension/src/app/screens/Stuck.tsx
+++ b/extension/src/app/screens/Stuck.tsx
@@ -8,6 +8,7 @@ import {RefusedBanner} from '../ui/Banner';
 import {LockedButton} from '../ui/LockedButton';
 import {useCopy} from '../ui/useCopy';
 import type {Intent, Pending, PendingState} from '../engine';
+import {GENERIC_TEXT} from '../generic';
 
 /** The fixed strings #54 shows (spec §4.8, D23); adapted ones are marked there. */
 export const STUCK_TEXT = {
@@ -72,7 +73,9 @@ const OPEN: readonly PendingState[] = ['pending', 'stuck'];
  * fails, #21 shows that instead (until then this screen shows only its neutral top bar); when it expires, this
  * screen shows its expired layout — the engine's `expired` (the record's, or a resend answer's), never a judgement of
  * the screen's own. No fee is shown on any of its layouts: none of them has paid one (feePaidLamports is null for
- * stuck and expired, and a re-send pays nothing new).
+ * stuck and expired, and a re-send pays nothing new). A record without an intent (B1d §1.3: another kind, Q42): the
+ * original's card names it "Transaction" and shows no amount and no recipient; "Send again" is the same (it re-sends
+ * the record's own bytes); there is nothing to prepare again, so the expired layout has no [Try again].
  */
 export function Stuck({
   record,
@@ -114,7 +117,8 @@ export function Stuck({
     };
   }, [record.id, record.state, record.account, elsewhere]);
   const refused = m.net.mode === 'refused';
-  const amount = `${showExact(record.intent.token, record.intent.amount)} ${record.intent.token}`;
+  const intent = record.intent;
+  const amount = intent === null ? null : `${showExact(intent.token, intent.amount)} ${intent.token}`;
   const {mm, ss} = mmss(record.createdAt, now);
   const hash = shortAddress(record.signature);
   const state = OPEN.includes(record.state) ? moved ?? record.state : record.state;
@@ -174,8 +178,8 @@ export function Stuck({
           </div>
         </div>
         <div className="sticky-bar">
-          {canRetry ? (
-            <LockedButton className="btn btn-primary" disabled={refused} onPress={() => onTryAgain(record.intent)}>
+          {canRetry && intent !== null ? (
+            <LockedButton className="btn btn-primary" disabled={refused} onPress={() => onTryAgain(intent)}>
               {STUCK_TEXT.tryAgain}
             </LockedButton>
           ) : null}
@@ -261,10 +265,12 @@ export function Stuck({
                 {mm}:{ss} elapsed
               </span>
             </div>
-            <div className="row">
-              <span className="k">Amount</span>
-              <span className="v amount noc-numeral">{amount}</span>
-            </div>
+            {amount === null ? null : (
+              <div className="row">
+                <span className="k">Amount</span>
+                <span className="v amount noc-numeral">{amount}</span>
+              </div>
+            )}
             <div className="row">
               <span className="k">Tx hash</span>
               <span className="v mono noc-mono">{hash}</span>
@@ -294,18 +300,22 @@ export function Stuck({
           <div className="orig-card">
             <div className="head">
               <span className="label">{STUCK_TEXT.original}</span>
-              <span className="pill">Send</span>
-            </div>
-            <div className="row">
-              <span className="k">Amount</span>
-              <span className="v amount noc-numeral">{amount}</span>
-            </div>
-            <div className="row">
-              <span className="k">Recipient</span>
-              <span className="v mono noc-mono">
-                <AddressGroups address={record.intent.recipient} />
-              </span>
+              <span className="pill">{intent === null ? GENERIC_TEXT.line : 'Send'}</span>
             </div>
+            {amount === null ? null : (
+              <div className="row">
+                <span className="k">Amount</span>
+                <span className="v amount noc-numeral">{amount}</span>
+              </div>
+            )}
+            {intent === null ? null : (
+              <div className="row">
+                <span className="k">Recipient</span>
+                <span className="v mono noc-mono">
+                  <AddressGroups address={intent.recipient} />
+                </span>
+              </div>
+            )}
             <div className="row">
               <span className="k">Tx hash</span>
               <span className="v mono noc-mono">
````

The staged lists (`MUST_STAY` gains Q42a; the off run gains the two files):

````diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index dbe51bd..33a722c 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -29,8 +29,9 @@ export const ON_BUILD = ['src/background/presale/api.ts', 'src/app/presale/index
 export const BOTH_BUILDS = ['src/background/intents.ts'];
 // Armed by B1d-1b: 1a ships no presale string (Q42 is "both").
 export const MARKERS = [];
-// Task 4 adds Q42; 1b adds F12's Q49–Q51. The decoder's instruction names are read from its source (DECODER).
-export const MUST_STAY = ['Presale purchase', 'PRESALE PURCHASE'];
+// Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
+// be a string search. The decoder's instruction names are read from its source (DECODER).
+export const MUST_STAY = ['Presale purchase', 'PRESALE PURCHASE', 'Transaction · pending', 'Transaction · taking longer than usual'];
 
 const MIN_MARKER = 8;
 
diff --git a/extension/vitest.nopresale.config.ts b/extension/vitest.nopresale.config.ts
index a3210f2..7a4c758 100644
--- a/extension/vitest.nopresale.config.ts
+++ b/extension/vitest.nopresale.config.ts
@@ -15,6 +15,8 @@ export const NOPRESALE_TESTS = [
   'src/unlock/__tests__/challenge.test.ts',
   'src/background/__tests__/intents.test.ts',
   'src/background/__tests__/pendingKinds.test.ts',
+  'src/app/__tests__/genericRecord.test.tsx',
+  'src/app/__tests__/engine.test.ts',
 ];
 
 const base = appConfig({...process.env, NOCTURA_PRESALE: '0'});
````

The spec (the controller's ruling on Task 3: the old sentence is false for a send — its digest and integrity are byte-for-byte unchanged, Task 3's capture — and no other kind existed before the update):

````diff
diff --git a/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md b/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
index 6cd2e20..0265b07 100644
--- a/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
+++ b/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
@@ -205,8 +205,10 @@ web, so no caller outside the extension changes; §6.2). `deps.ts` gains `create
 onConfirmed?})`. B1b's `send` registers itself unconditionally; `presale/api.ts` registers `presale-buy`.
 
 - **Prepared entries.** `PreparedSend` gains `kind: string`; `intent` becomes the kind's parsed intent.
-  `preparedIntegrity` and the challenge digest include `kind` (`intentDigest(kind, account, intent)`; a challenge
-  issued before the update no longer matches and is asked again — fail closed). `wallet.preparedFor` returns only
+  `preparedIntegrity` and the challenge digest include `kind` (`intentDigest(kind, account, intent)`: the kind is the
+  digest's domain). A send's domain was already `send`, so a send's digest is unchanged and a challenge issued before
+  the update still matches for a send (no second re-authentication); only a non-send kind's challenge is bound to its
+  kind — a send's proof never satisfies it, and the other way round (fail closed). `wallet.preparedFor` returns only
   `kind: 'send'` entries; `presale.preparedFor` only `presale-buy`. **Every prepare, of any kind, replaces every
   prepared entry of that account** (today's rule in `prepareSend`, extended across kinds), so an account has at most
   one prepared entry.
````

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, the E2E.**

Run: the Step 2 command — `Test Files  7 passed (7)` · `Tests  164 passed (164)`.

Run: `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  183 passed (183)` · `Tests  3605 passed (3605)` (previous tree 182 / 3588: +1 file, +17 tests — genericRecord 14, engine +2, presaleSwitch +1; check-no-presale's count unchanged; rev 1: 3602 on 3585). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  9 passed (9)` · `Tests  216 passed (216)` (previous 7 / 172 (rev 1: 213 on 169): `genericRecord.test.tsx` 14 and `engine.test.ts` 30 now run off too — the popup reads and draws a purchase record with the presale entries resolved to their stubs).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build, the last line `no presale ok (dist-nopresale off, dist on): … the on build carries 4 required modules; 0 markers (none in the off build, each in the on build); 4 strings and the decoder's instruction names stay in the off build`. `npm run csp`, `npm run secrets` — ok for both builds; `npm run reproducible` — ok, both variants. `node scripts/check-no-tge-date.mjs` (package) — `604 source and built files checked`; repository root — `no TGE date in 1259 tracked text files`. Classes: `classes ok` (the generic rows use B1b's classes only; `unstyledClasses` is asserted on #26's row and on #21, #44, #54 in `genericRecord.test.tsx`). No `core/` or root `src/` change: root `tsc`/`jest` and web `verify` not required.

Run: `npx playwright test e2e/presaleOff.spec.ts` — `2 passed` (~21 s); `--repeat-each=3` — `6 passed`; under `unshare -rn` with `containment.spec.ts` — `4 passed`. The whole suite `npx playwright test` — `77 passed` (75 + the two new; 21 min on the dry-run machine). **(rev 2)** `presaleOff.spec.ts` re-run on rev 2's Task 4 (both builds built in a `git archive` copy): `2 passed`, and under `unshare -rn` with `containment.spec.ts` `4 passed`; the whole suite ran on the end state (Task 6). The two packages are still byte-identical at this task (`diff -rq dist dist-nopresale` lists only `app.features.json` and `app.modules.json`).

Visual shots (opened and compared in the dry run; the design has no generic variant, so each is compared with B1b's own row/screen for a send, which is the design's): `q42-11-pending.png` / `q42-11-slow.png` — #11's info strip (send glyph, body-sm text, chevron) exactly as the send's, the text Q42a; `q42-26-pending.png` — #26's PENDING section, the `tx-row` with the arrow-up-right circle, Q42a primary and "waiting · 0 m 1 s" secondary, as the send's row; `q42-21-pending.png` / `q42-21-confirmed.png` — #21's ring, stage label and sub as for a send, the amount card holding "Transaction" at the amount's size and weight, Status / Tx hash / Fee paid rows; `q42-54-stuck.png` — the original's card with the pill "TRANSACTION", Tx hash with its Copy chip, Valid until block; `q42-54-expired.png` — "Not confirmed — no funds moved.", Tx hash, Done only; `q42-44-rejected.png` — the rejected hero and reason banner with its explorer link, [View details] only. No amount, address or presale word in any.

- [ ] **Step 5: Commit.**

```bash
git add -A extension docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
git commit -m "feat(extension): B1d-1a generic rendering of a record without an intent (Q42) on #11, #26, #21, #44, #54 in both builds — the popup reads intent null with extra; E2E 7 on the off build; Q42a must stay in the off build; spec §1.3: a send's challenge still matches after the update" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test files.** `G` = `genericRecord.test.tsx`, `E` = `engine.test.ts`.

| id | the change | named test → observed |
|---|---|---|
| E1 | `engine.ts` `pendingOf`: `const intent = intentOf(o.intent);` (null refused — the old reader) | G 9 rows — #11 ×3, #26 ×2, #21 ×3, #54 stuck: every row that reads the record through the engine (#44 and #54 expired are rendered from a view; the send row is the positive control); E “a record without an intent is read with its extra…”, “a stored record without an intent reaches the popup…” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  11 failed \| 33 passed (44)` |
| E2 (rev 2) | `engine.ts`: `const extra = extraOf(o.extra);` (a send's extra read — shown with it, or the whole reply failed for a malformed one; rev 1's E2, "a send carrying an extra accepted", is the behaviour rev 2 adopts, review 1 L4) | E “a record without an intent is read with its extra, copied as it came; a malformed one is failed; a send’s extra is never read (review 1 L4)” — tsc 0 · RED `Tests  1 failed \| 29 passed (30)` |
| E3 | `engine.ts` `extraOf`: `!KIND.test(o.kind.toLowerCase().trim())` (an upper-case or padded kind accepted) | E the same test (`Presale-buy`) — tsc 0 · RED `Tests  1 failed \| 29 passed (30)` |
| E4 | `engine.ts` `extraOf`: the `!('data' in o)` clause deleted (an extra without `data` accepted) | E the same test (`{kind: 'presale-buy'}`) — tsc 0 · RED `Tests  1 failed \| 29 passed (30)` |
| E5 | `engine.ts` `pendingOf`: `extra: extra === null ? null : null` (the extra read, then dropped) | E “a record without an intent is read…”, “a stored record … reaches the popup with its extra…”; G “#11: "Transaction · pending" … it opens that record…” (the tap hands `extra`) — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  3 failed \| 41 passed (44)` |
| H1 | `Home.tsx`: the generic strip always `GENERIC_TEXT.pending` (slow ignored) | G “#11: past 80 s, or stuck, "Transaction · taking longer than usual"” — tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| A1 | `Activity.tsx`: the generic title slow only when `stuck` (the 80 s rule dropped) | G “#26: past 80 s, "Transaction · taking longer than usual"…” — tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| S1 | `Status.tsx`: the generic amount card keeps the `Amount` eyebrow | G “broadcasting: the amount line is "Transaction"…”, “polled to confirmed…” — tsc 0 · RED `Tests  2 failed \| 12 passed (14)` |
| F1 | `Failed.tsx`: `const back = canRetry ? edit : onClose;` (the back arrow tries to edit a record it cannot) | G “blockhash-expired: … the back arrow closes” — tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| F2 | `Failed.tsx`: the expired footer always shown (“…same recipient, same amount.”) | G “blockhash-expired…” — tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| F3 | `Failed.tsx`: the sticky bar `kind === 'generic' ? explorer : tryAgain` (no explorer link in [Try again]'s place) | G “blockhash-expired…”, “not sent: the reason; the explorer link instead of [Try again]” — tsc 0 · RED `Tests  2 failed \| 12 passed (14)` |
| K1 | `Stuck.tsx`: the pill `intent !== null ? GENERIC_TEXT.line : 'Send'` (inverted) | G “stuck: the original’s card names it "Transaction"…” — tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| G1 | `check-no-presale.mjs`: `MUST_STAY` back to the two B1b strings (Q42 no longer required in the off build) | `check-no-presale.test.mjs` “must stay: B1b/B1c presale copy, Q42 and the decoder instruction names…” — tsc 0 · RED `Tests  1 failed \| 35 passed (36)` |
| G2 | `vitest.nopresale.config.ts`: `genericRecord.test.tsx` removed (the generic screens untested off) | `presaleSwitch.test.mjs` “the generic rendering of a record without an intent is tested in the off run too…” — tsc 0 · RED `Tests  1 failed \| 16 passed (17)` |

14 mutations (rev 2 re-ran all of them on 7333c87; E2 is rewritten for L4), all red, every one compiling (`tsc` 0). Not covered by a mutation, stated: the `intent !== null` guards on #44's and #54's [Try again] and on #44's `edit` — deleting any of them does not compile (`onTryAgain(intent)` / `draftOf(intent)` need an `Intent`), so the type checker is their test; the E2E's own red is Step 2's run on the previous tree (both tests red at their first #11 assertion), not a separate mutation.

#### Dry-run notes (Task 4)

- **Ruling: where Q42b goes on each screen** — the spec says "Transaction" (#21, #44, #54 amount line; no amount, no recipient). #21: the amount card holds only "Transaction" in `.amount` (no "Amount" eyebrow — it would label a word as an amount — no ticker, no fiat); #54: the original's card pill (B1b's "Send", the kind's label) reads "Transaction", and the Amount and Recipient rows are omitted (key/value rows: an "Amount · Transaction" row would be wrong); #44: its eyebrow is already B1b's "Transaction" and its kept payload card loses To and Amount (only "Valid until block") — why: each is the place a send names what it is; no new copy — cost if wrong: a markup move per screen (the visual shots show each).
- **Ruling: #44 and #54 offer no [Try again] / [Edit transaction] for a record without an intent** — both need the intent (`onTryAgain(intent)` re-prepares it at #19, `draftOf(intent)` fills #12); a purchase cannot be re-prepared by B1b's send flow. #44 shows the explorer link in [Try again]'s place (except rejected-by-program, which keeps its banner link and [View details]), its back arrow and Esc close instead of opening #12, and the footer "Retry is a fresh transaction … same recipient, same amount." is not shown; #54's expired layout keeps Done only — cost if wrong: none for 1a; **1b's purchase renderer decides the purchase's own retry** (Q32/Q33 + #23's flow). **Known wording gap (B1b copy, not changed):** #54's expired line "…You can now make a new attempt." stays (STUCK_TEXT is B1b's, spec §4.8) though no [Try again] follows for a purchase; #21's titles stay B1b's "Sending…" / "Sent" / "Sent successfully", and #44's rejected sub "…the amount did not move" — all true of a purchase in substance; no new copy was written (rule: copy only from the spec or a numbered Q). If the owner wants different words for a purchase's #21/#54 titles in the off build, that is a new Q.
- **Ruling: the popup refuses, rather than tolerates, a malformed or missing `extra` on a record without an intent** — the background already maps every unreadable stored value to `null` (Task 3, "a display field never drops a record"), so anything else on the wire is a broken contract between our own two halves, handled as every other `pendingOf` field (`fee`, `detailCode`: the reply is `failed`). The record itself is never hidden by the background; only a malformed wire reply fails — cost if wrong: a reply failed that could have been shown (none possible from the real background; tested against it).
- **(rev 2, review 1 L4) A send's `extra` is never read by the popup** — rev 1 failed the whole `wallet.pending` reply when a record carried an intent **and** an extra, which would hide a pending send behind a display field (against B1b's rule). The background never writes one (it reads `extra` only on the third shape and `viewOf` gives every send `extra: null`), so this was unreachable, but the popup now reads exactly as the background does: `extra` is read only when `intent` is null; on a send it is `null` whatever the wire carries (an object, a malformed value, or no key at all). The test asserts the send shown with `extra: null` for those three; E2 is the mutant that reads it again.
- **Ruling: Q42a's "taking longer than usual" on #26 uses #11's rule** (`stuck`, or older than 80 s) — #26's send row has no slow variant (it shows "waiting · m s"), but Q42 gives #26 both strings; #11's rule is the one B1b already uses for this exact pair of words.
- **Ruling: the popup's `KIND` repeats the background's `KIND_NAME`** — the popup cannot import `src/background/` (vault isolation / page bundles); a divergence would only make the popup fail a reply the background produced, which E1–E4 and the real-background round trip would show.
- **Ruling: `extra.data` is copied into `Pending.extra` but never read by any screen in 1a** — §1.3 "parsed by the presale renderer; never used to decide anything"; 1b's renderer must treat it as untrusted display input (it came from storage).
- **`MUST_STAY` gains Q42a's two strings** (Task 2's ruling, §6.2 item 3: Q42 is "both"); Q42b ("Transaction") is not a usable string search (it is in every build regardless) — its screens are tested in both vitest runs instead. The synthetic builds of `check-no-presale.test.mjs` carry the two strings so the whole-gate tests stay about their own rule.
- **Off run (Task 1's ruling): `NOPRESALE_TESTS` gains `genericRecord.test.tsx` and `engine.test.ts`** (pinned by a row, G2) — the popup's reader and the five screens hold with the presale entries resolved to their stubs (§6.1 "Switch, off build": "a stored `presale-buy` pending record is polled and rendered with Q42").
- **E2E 7 scope (stated):** the spec's list for E2E 7 — `dist-nopresale` loaded; no banner, no Buy (quick actions exactly Send, Receive), no #31 presale row (Settings has no "presale"/"referral" text); `presale.view` from the popup refused `unknown type`; the §2.3 record seeded into `v1_pending` shown with Q42 on #11 and #21 (and #26); a send refused `in-flight`; polled to `confirmed` with nothing broadcast. Added beyond the spec's list: a second test driving the same record shape to #54 (stuck → expired) and #44 (rejected) for the visual shots. The second test reopens the popup after seeding its #44 record: the provider re-reads `wallet.pending` every 2 s only while it knows an open record (B1b, `WalletContext`), so a record seeded behind a popup with none open appears only on the next open — **the dry run's first `unshare -rn` run failed there** (the spec had relied on a poll that was still running by chance in the normal run); the reopen is the real path (a user opens the popup), and the corrected spec passed normal, `--repeat-each=3` (6/6) and under `unshare -rn`. Not a product finding: B1b's provider poll is by design; recorded because it was a test-timing dependence.
- **Spec §1.3 reworded** (the controller's ruling on Task 3): "a challenge issued before the update still matches for a send (no second re-authentication); only a non-send kind's challenge is bound to its kind".
- **For Task 5 / 1b:** 1b's kind renderer plugs in at exactly the five `intent === null` branches (Home strip, Activity row, Status amount card / To row, Failed payload + sticky bar, Stuck pill + rows + expired) — each falls back to the generic branch when `presaleSlots` has no renderer for `extra.kind` or it refuses `extra.data` (§1.3). `GENERIC_TEXT` is in `src/app/generic.ts` (shared, both builds). 1b's markers must not overlap Q42a (`check-no-presale.test.mjs` "no marker overlaps a string that must stay").

---

### Task 5: The program state — account layouts generated from the pinned IDL (`layouts.ts`, hash-pinned, rebuilt by a test without the ICO repository), `state.ts` (config, the account's two PDAs, the treasury and its two vault ATAs in ONE `getAccountsData` through the proxy; C5's pins; a failed, short, malformed or wrong-discriminator read is `unavailable`, never open), `core/presale/limits.ts` (bigint cents / base units, the program's rules, D7, C6), the vault ATA constants; the on build keeps the presale background modules whole so `ON_BUILD` can name them (FUNDS-RELEVANT)

**Spec:** B1d §2.1 (constants, "Layouts from the IDL", "The snapshot" rules 1–8, "Derived values"), §3.2 (the `core/presale/limits.ts` part: `usdCentsForStable`, `tokensFor`, `checkLimits`), §6.1 "Layouts (1a)", "State (1a)", "Limits (1a)", §6.2 item 1 (1a's positive-control list: `presale/{layouts,state}.ts`, `core/presale/limits.ts`), §8.2 rows `gen-presale-idl.mjs`, `presale/`, `core/presale/limits.ts`, `core/presale/addresses.ts`; D4, D7, C5, C6, C7, C21. Brief item 5. The controller's ruling on Task 2 (ledger): Task 5's modules join `ON_BUILD` and must be reachable from `presale/api.ts`.

**Verified against the sources the spec cites (read-only, 2026-10-19):** ICO `lib/idl.json` at 75450df — sha256 `f3112275…c86a` both on disk and `git show 75450df:lib/idl.json`; its `accounts` discriminators and `types` struct fields are what the generator reads. ICO `programs/solana-ico-enhanced/src/lib.rs` (75450df): `Config` (3733-3772, `SPACE` = 362 → 370 with the discriminator), `UserAccount` (3775-3785, `SPACE` 50 → **58**), `PresaleAllocation` (3789-3803, `SPACE` 109 → 117) — the field order and widths of each struct equal the IDL's, so every generated offset (below) is the struct's own byte position; the constants `PRESALE_MIN_PURCHASE_USD` 2500 (:34), `PRESALE_MAX_PURCHASE_USD` 5 000 000 (:35), `PRESALE_MAX_TOTAL_PER_USER_USD` 20 000 000 (:36), `STAGE_PRICES` (:42-53); the SOL path's checks in order (:283-291 `presale_active`, `presale_start_time`, `tokens_sold < PRESALE_TOTAL_ALLOCATION * TOKEN_DECIMALS`; :294-297 `is_blocked`; :333-351 min, per-tx max, per-user total) and the stablecoin path's identical ones (:2389-2430); `calculate_tokens_for_usd` (:2793-2818); the stage-advance loop (:453-460) and `init_if_needed` of the two PDAs (:2904-2919). **One mainnet read** (public RPC `getMultipleAccounts`, slot 458 632 600 — not through the coordinator, whose per-IP budget the wallet shares) of config, the treasury and both vault ATAs, decoded with the generated offsets: config owner = the program, 370 bytes, Config's discriminator, `admin@8` = `KnZ5…`, `sale_token@40` = NOC, `usdt@72` / `usdc@104` = the pinned mints, `current_stage` 0, `presale_active` 1, `max_per_user_usd` 0, `min_purchase_usd` 1000, `sol_treasury@338` = `6Zia…o6Vd`; **rule 7 recorded as the spec requires: the treasury `6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd` is owned by the System program with 0 bytes of data**, not executable; both vault ATAs owned by the SPL Token program, 165 bytes, mint@0 = their mint, owner@32 = the treasury, state@108 = 1. (No balance and no date from that read is written anywhere.)

**Files:**
- Modify: `extension/scripts/gen-presale-idl.mjs` (second output `layouts.ts`: `LAYOUTS_PATH`, `LAYOUTS_SHA256`, `LAYOUT_ACCOUNTS`, `layoutsSource`; the main block writes both and checks both hashes; `presaleIdl.ts` and `OUTPUT_SHA256` unchanged)
- Create (generated — `node extension/scripts/gen-presale-idl.mjs <ICO>/lib/idl.json`, never by hand): `extension/src/background/presale/layouts.ts`
- Create: `extension/src/background/presale/state.ts`
- Modify: `extension/src/background/presale/api.ts` (imports `./state`)
- Modify: `extension/scripts/presaleSwitch.mjs` (on: the modules under `src/background/presale/` are kept whole)
- Create: `core/presale/limits.ts`
- Modify: `core/presale/addresses.ts` (`MAINNET_VAULT_USDC_ATA`, `MAINNET_VAULT_USDT_ATA`)
- Create (tests): `extension/src/background/presale/__tests__/state.test.ts`, `extension/src/background/presale/__tests__/layouts.test.ts`, `core/presale/__tests__/limits.test.ts`, `core/presale/__tests__/vaultAtas.test.ts`
- Modify (tests): `extension/scripts/__tests__/gen-presale-idl.test.mjs` (the layouts describe), `extension/scripts/__tests__/presaleSwitch.test.mjs` (the kept-whole describe)
- Modify (Task 2's staged list): `extension/scripts/check-no-presale.mjs` (`ON_BUILD` gains the three modules), `extension/scripts/__tests__/check-no-presale.test.mjs` (the row that pins it)

**Interfaces:**
- Consumes: B1c's generator and its pinned `IDL_SHA256`; `core/presale/addresses.ts` (the program, admin, NOC, treasury, USDC, USDT), `core/presale/allocation.ts` (`derivePresalePdas`, `readU64LE`, the hand constants), `core/presale/referrer.ts` (`resolveReferrerWith`, `AllocationRef`, `ResolvedReferrer`), `core/presale/stagePrices.ts`, `core/solana/rpc.ts` (`SolanaReader.getAccountsData` → `getMultipleAccounts`, already allowed; `RpcForbidden` incl. `RpcCoolingDown`; `SYSTEM_PROGRAM_ID`), `core/solana/encoding.ts` (Task 1: `findAssociatedTokenAddress`, `SPL_TOKEN_PROGRAM`), `core/solana/transfer.ts` (`SYSTEM_ACCOUNT_RENT_LAMPORTS`, `TOKEN_ACCOUNT_RENT_LAMPORTS`), B1c's `dapp/tokenState.ts` (`tokenAccountInfo` — the one token-account reader), Task 1's `presaleSwitch` and `PRESALE_ENTRIES`, Task 2's `ON_BUILD`.
- Produces (`src/background/presale/layouts.ts`, generated):
  ```ts
  export type LayoutFieldType = 'pubkey' | 'u8' | 'u32' | 'u64' | 'i64' | 'bool';
  export const CONFIG_LAYOUT = {name: 'Config', discriminator: [155, 12, 170, 224, 30, 250, 204, 130], length: 370, fields: {admin: {offset: 8, type: 'pubkey'}, /* … every IDL field in order … */}} as const;
  export const PRESALE_ALLOCATION_LAYOUT = {/* 117, [202, 26, 199, 26, 125, 244, 253, 18] */} as const;
  export const USER_ACCOUNT_LAYOUT = {/* 58, [211, 33, 136, 16, 186, 110, 242, 127] */} as const;
  ```
  A field is `LAYOUT.fields.<idl_name>.offset` — a renamed or removed IDL field is a compile error in `state.ts`, not a wrong offset.
- Produces (`src/background/presale/state.ts`):
  ```ts
  export type UnavailableCode = 'read-failed' | 'refused' | 'malformed';
  export interface StageFacts {stage: number; priceTicks: bigint; nextPriceTicks: bigint | null; stageSoldBase: bigint; stageCapBase: bigint; raisedCents: bigint}
  export interface AllocationFacts {exists: boolean; totalBase: bigint; bonusBase: bigint; spentCents: bigint; purchaseCount: number; referrer: string | null}
  export interface PresaleSnapshot {
    stage: StageFacts;
    limits: PurchaseLimits & {firstPurchase: boolean};       // minCents, maxTxCents, userRemainingCents (core) + C21
    allocation: AllocationFacts;
    userAccountExists: boolean;
    newPdaRent: bigint;                                       // the rent of the PDAs a purchase now would create
    treasuryLamports: bigint;                                 // C28's SOL "before", from this read
    vaults: {USDC: {address: string; amount: bigint}; USDT: {address: string; amount: bigint}};  // C28's stablecoin "before"
  }
  export type PresaleState =
    | {kind: 'unavailable'; code: UnavailableCode}
    | {kind: 'inactive' | 'blocked'; stage: StageFacts}
    | {kind: 'open'; snapshot: PresaleSnapshot};
  export function readPresaleState(reader: SolanaReader, account: string, nowMs: number): Promise<PresaleState>;
  export function allocationRefOf(snapshot: PresaleSnapshot): AllocationRef;
  export function referrerAllocationOf(snapshot: PresaleSnapshot, account: string): Promise<ResolvedReferrer>;  // captured = null (C7)
  ```
  `readPresaleState` makes exactly one `reader.getAccountsData` call with `[config PDA, ["user", account], ["allocation", account], MAINNET_SOL_TREASURY, MAINNET_VAULT_USDC_ATA, MAINNET_VAULT_USDT_ATA]`. The order of its verdicts: a thrown read → `refused` (`RpcForbidden`, which includes the latch's `RpcCoolingDown`) or `read-failed` (anything else: timeout, unreachable, HTTP, RPC error, a malformed RPC answer); a reply of another length → `malformed`; then §2.1 rules 1, 2, 3, 4 (active computed, the inactive test first; while active, `stage_tokens_sold` < a stage → else `malformed`), 5, 6, 7, 8 — each failure `malformed`; only then the verdicts `inactive` (not active), `blocked` (`is_blocked = 1`), `open`. 1b's `api.ts` maps `unavailable` → `PresaleView {why: 'unavailable', code}`, `inactive`/`blocked` → `{why, state}`.
- Produces (`core/presale/limits.ts`):
  ```ts
  export const PRESALE_MIN_PURCHASE_USD = 2_500n, PRESALE_MAX_PURCHASE_USD = 5_000_000n, PRESALE_MAX_TOTAL_PER_USER_USD = 20_000_000n;  // cents
  export const NOC_BASE_PER_NOC = 10n ** 9n, PRESALE_HARD_CAP_BASE, TOKENS_PER_STAGE_BASE;
  export const STAGE_PRICE_TICKS: readonly bigint[];             // 1501n … 3499n
  export const PRESALE_USER_ACCOUNT_RENT_LAMPORTS = 1_294_560n, PRESALE_ALLOCATION_RENT_LAMPORTS = 1_705_200n;
  export interface PurchaseLimits {minCents: bigint; maxTxCents: bigint; userRemainingCents: bigint}
  export function purchaseLimits(config: {minPurchaseUsd: bigint; maxPerUserUsd: bigint}, totalSpentCents: bigint): PurchaseLimits;
  export type LimitCode = 'below-min' | 'above-max-tx' | 'above-user-limit';
  export function checkLimits(q: {cents: bigint} & PurchaseLimits): LimitCode | null;
  export function usdCentsForStable(amount6: bigint): bigint;   // floors; RangeError if negative
  export function tokensFor(cents: bigint, stage: number): bigint;  // floors; RangeError on an unknown stage or a negative amount
  ```
  No currency parameter anywhere: one rule for SOL, USDC and USDT (D7) by construction.
- Produces (`core/presale/addresses.ts`): `MAINNET_VAULT_USDC_ATA = 'DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3'`, `MAINNET_VAULT_USDT_ATA = '8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp'`.
- Produces (`scripts/presaleSwitch.mjs`): on, a `transform` hook returns `{code, map: null, moduleSideEffects: 'no-treeshake'}` for every module under `src/background/presale/` (query/hash stripped), `null` for everything else; off, `null` always (resolution unchanged).

**Why the on build keeps `src/background/presale/` whole.** §6.2's 1a positive control names `layouts.ts` and `state.ts`, which no 1a code calls (1b's handlers will). Measured in the dry run with `api.ts` importing `./state` and no plugin change: the on build's `app.modules.json` listed `state.ts` and `core/presale/limits.ts` (pulled in through side-effectful imports) but **not** `layouts.ts` (pure `as const` objects) — the control would hold or fail by the bundler's side-effect analysis, not by what the entry imports. With the hook, the map lists all three by rule (the unit row and a two-build fixture in `presaleSwitch.test.mjs` show it, and the fixture's plugin-less build is the negative control). It changes nothing in the off build (the entries never resolve there). What it does not do: the minifier still removes uncalled functions — in the dry run's `dist/app/background.js` the layouts' field names are present and `readPresaleState`'s body is not, which is correct for 1a (nothing calls it); 1b's handlers make it live.

- [ ] **Step 1: Write the failing tests.**

`extension/src/background/presale/__tests__/state.test.ts` (new — the byte builders write each field at the generated offset; `layouts.test.ts` pins those offsets independently, and one row feeds the builder's config to core's hand-written `readSolTreasury`; the fake chain answers by address, the spec's literals written out whole):

````ts
import {PublicKey} from '@solana/web3.js';
import {readPresaleState, referrerAllocationOf, type PresaleSnapshot, type PresaleState} from '../state';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from '../layouts';
import {fakeReader} from '../../__tests__/fakeDeps';
import {ACCOUNT as SESSION_ACCOUNT, HOLDING_SMALL, RECIPIENT} from '../../__tests__/fixtures';
import {
  MAINNET_ADMIN_ADDRESS,
  MAINNET_NOC_MINT,
  MAINNET_PROGRAM_ID,
  MAINNET_SOL_TREASURY,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
  MAINNET_VAULT_USDC_ATA,
  MAINNET_VAULT_USDT_ATA,
} from '../../../../../core/presale/addresses';
import {derivePresalePdas, readSolTreasury} from '../../../../../core/presale/allocation';
import {PRESALE_HARD_CAP_BASE, TOKENS_PER_STAGE_BASE} from '../../../../../core/presale/limits';
import {SPL_TOKEN_PROGRAM} from '../../../../../core/solana/encoding';
import {
  RequestUnreachable,
  RpcCoolingDown,
  RpcForbidden,
  RpcHttpError,
  RpcMalformed,
  RpcResponseError,
  SYSTEM_PROGRAM_ID,
  type AccountData,
} from '../../../../../core/solana/rpc';
import {RequestTimedOut} from '../../deps';

// B1d §2.1, §6.1 "State (1a)": the presale opens only on a read where every rule holds; one refusal per rule, each a
// byte builder's single change from the valid fixture (never a hand-typed blob).
const ACCOUNT = SESSION_ACCOUNT.publicKey;
const REFERRER = RECIPIENT;
const OTHER = HOLDING_SMALL;
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const NOW_MS = 1_760_000_000_000;
const NOW_S = 1_760_000_000n;

type Field = {offset: number};
const putKey = (d: Uint8Array, f: Field, address: string) => d.set(new PublicKey(address).toBytes(), f.offset);
const putU64 = (d: Uint8Array, f: Field, v: bigint) => {
  let x = BigInt.asUintN(64, v);
  for (let i = 0; i < 8; i++) {
    d[f.offset + i] = Number(x & 0xffn);
    x >>= 8n;
  }
};
const putU32 = (d: Uint8Array, f: Field, v: number) => {
  for (let i = 0; i < 4; i++) d[f.offset + i] = (v >>> (8 * i)) & 0xff;
};

interface ConfigBytes {
  length: number;
  discriminator: readonly number[];
  admin: string;
  saleToken: string;
  usdt: string;
  usdc: string;
  stage: number;
  stageSold: bigint;
  tokensSold: bigint;
  raised: bigint;
  start: bigint;
  active: number;
  maxPerUser: bigint;
  minPurchase: bigint;
  treasury: string;
}
const CONFIG: ConfigBytes = {
  length: CONFIG_LAYOUT.length,
  discriminator: CONFIG_LAYOUT.discriminator,
  admin: MAINNET_ADMIN_ADDRESS,
  saleToken: MAINNET_NOC_MINT,
  usdt: MAINNET_USDT_MINT,
  usdc: MAINNET_USDC_MINT,
  stage: 0,
  stageSold: 1_312_240_123_017_711n,
  tokensSold: 1_312_240_123_017_711n,
  raised: 19_696_720n,
  start: NOW_S - 86_400n,
  active: 1,
  maxPerUser: 0n,
  minPurchase: 1_000n,
  treasury: MAINNET_SOL_TREASURY,
};
function configData(o: Partial<ConfigBytes> = {}): Uint8Array {
  const c = {...CONFIG, ...o};
  const F = CONFIG_LAYOUT.fields;
  const d = new Uint8Array(Math.max(c.length, CONFIG_LAYOUT.length));
  d.set(c.discriminator, 0);
  putKey(d, F.admin, c.admin);
  putKey(d, F.sale_token, c.saleToken);
  putKey(d, F.usdt_address, c.usdt);
  putKey(d, F.usdc_address, c.usdc);
  d[F.current_stage.offset] = c.stage;
  putU64(d, F.stage_tokens_sold, c.stageSold);
  putU64(d, F.tokens_sold, c.tokensSold);
  putU64(d, F.total_usd_raised_cents, c.raised);
  putU64(d, F.presale_start_time, c.start);
  d[F.presale_active.offset] = c.active;
  putU64(d, F.max_per_user_usd, c.maxPerUser);
  putU64(d, F.min_purchase_usd, c.minPurchase);
  putKey(d, F.sol_treasury, c.treasury);
  return d.subarray(0, c.length);
}

interface UserBytes {
  length: number;
  discriminator: readonly number[];
  blocked: number;
}
function userData(o: Partial<UserBytes> = {}): Uint8Array {
  const u = {length: USER_ACCOUNT_LAYOUT.length, discriminator: USER_ACCOUNT_LAYOUT.discriminator, blocked: 0, ...o};
  const d = new Uint8Array(Math.max(u.length, USER_ACCOUNT_LAYOUT.length));
  d.set(u.discriminator, 0);
  d[USER_ACCOUNT_LAYOUT.fields.is_blocked.offset] = u.blocked;
  return d.subarray(0, u.length);
}

interface AllocationBytes {
  length: number;
  discriminator: readonly number[];
  user: string;
  totalTokens: bigint;
  spent: bigint;
  count: number;
  bonus: bigint;
  referrer: string | null;
  claimed: number;
}
function allocationData(o: Partial<AllocationBytes> = {}): Uint8Array {
  const a: AllocationBytes = {
    length: PRESALE_ALLOCATION_LAYOUT.length,
    discriminator: PRESALE_ALLOCATION_LAYOUT.discriminator,
    user: ACCOUNT,
    totalTokens: 1_998_667_554_963n,
    spent: 30_000n,
    count: 2,
    bonus: 16_142_571_618n,
    referrer: null,
    claimed: 0,
    ...o,
  };
  const F = PRESALE_ALLOCATION_LAYOUT.fields;
  const d = new Uint8Array(Math.max(a.length, PRESALE_ALLOCATION_LAYOUT.length));
  d.set(a.discriminator, 0);
  putKey(d, F.user, a.user);
  putU64(d, F.total_tokens, a.totalTokens);
  putU64(d, F.total_spent_cents, a.spent);
  putU32(d, F.purchase_count, a.count);
  putU64(d, F.referral_bonus_tokens, a.bonus);
  if (a.referrer !== null) putKey(d, F.referrer, a.referrer);
  d[F.claimed.offset] = a.claimed;
  return d.subarray(0, a.length);
}

/** An SPL Token account (165 bytes): mint 0, owner 32, amount 64, delegate tag 72, state 108, is_native tag 109, close authority tag 129. */
function tokenAccountData(o: {mint: string; owner?: string; amount?: bigint; state?: number}): Uint8Array {
  const d = new Uint8Array(165);
  putKey(d, {offset: 0}, o.mint);
  putKey(d, {offset: 32}, o.owner ?? MAINNET_SOL_TREASURY);
  putU64(d, {offset: 64}, o.amount ?? 0n);
  d[108] = o.state ?? 1;
  return d;
}

const program = (data: Uint8Array): AccountData => ({lamports: 3_466_080n, owner: MAINNET_PROGRAM_ID, data});
const TREASURY: AccountData = {lamports: 48_288_800_000n, owner: SYSTEM_PROGRAM_ID, data: new Uint8Array(0)};
const vault = (o: {mint: string; owner?: string; amount?: bigint; state?: number}, programId = SPL_TOKEN_PROGRAM): AccountData => ({
  lamports: 1_488_440n,
  owner: programId,
  data: tokenAccountData(o),
});

interface Chain {
  config: AccountData | null;
  user: AccountData | null;
  allocation: AccountData | null;
  treasury: AccountData | null;
  usdc: AccountData | null;
  usdt: AccountData | null;
}
const CHAIN: Chain = {
  config: program(configData()),
  user: null,
  allocation: null,
  treasury: TREASURY,
  usdc: vault({mint: MAINNET_USDC_MINT, amount: 172_099_207n}),
  usdt: vault({mint: MAINNET_USDT_MINT, amount: 0n}),
};

// The chain answers by address — the spec's literals (§2.1), whole — so a reader that asks for the wrong account gets
// that account's bytes, not the slot it expected.
const CONFIG_PDA = '8MwasPrRzsCDuH78PJSDdWhdjFXT15MX7pHs3iE4b7Gx';
const TREASURY_ADDRESS = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
const USDC_VAULT = 'DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3';
const USDT_VAULT = '8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp';

async function read(o: Partial<Chain> = {}): Promise<{state: PresaleState; calls: string[][]}> {
  const c = {...CHAIN, ...o};
  const pdas = derivePresalePdas(new PublicKey(ACCOUNT));
  const chain = new Map<string, AccountData | null>([
    [CONFIG_PDA, c.config],
    [pdas.userAccount.toBase58(), c.user],
    [pdas.userAllocation.toBase58(), c.allocation],
    [TREASURY_ADDRESS, c.treasury],
    [USDC_VAULT, c.usdc],
    [USDT_VAULT, c.usdt],
  ]);
  const calls: string[][] = [];
  const reader = fakeReader({
    getAccountsData: async addresses => {
      calls.push([...addresses]);
      return addresses.map(a => {
        const account = chain.get(a);
        if (account === undefined) throw new Error(`unexpected address ${a}`);
        return account;
      });
    },
  });
  return {state: await readPresaleState(reader, ACCOUNT, NOW_MS), calls};
}
const stateOf = async (o: Partial<Chain> = {}) => (await read(o)).state;
const openSnapshot = async (o: Partial<Chain> = {}): Promise<PresaleSnapshot> => {
  const s = await stateOf(o);
  if (s.kind !== 'open') throw new Error(`not open: ${JSON.stringify(s, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))}`);
  return s.snapshot;
};
const MALFORMED = {kind: 'unavailable', code: 'malformed'};

describe('readPresaleState — the valid read (positive control)', () => {
  it('opens, with every derived value from the program’s numbers', async () => {
    expect(await openSnapshot()).toEqual({
      stage: {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 1_312_240_123_017_711n, stageCapBase: 10_240_000_000_000_000n, raisedCents: 19_696_720n},
      limits: {minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n, firstPurchase: true},
      allocation: {exists: false, totalBase: 0n, bonusBase: 0n, spentCents: 0n, purchaseCount: 0, referrer: null},
      userAccountExists: false,
      newPdaRent: 1_294_560n + 1_705_200n,
      treasuryLamports: 48_288_800_000n,
      vaults: {USDC: {address: MAINNET_VAULT_USDC_ATA, amount: 172_099_207n}, USDT: {address: MAINNET_VAULT_USDT_ATA, amount: 0n}},
    });
  });

  it('one getAccountsData for the six accounts, in order: config, user, allocation, treasury, the two vault ATAs', async () => {
    const {calls} = await read();
    const pdas = derivePresalePdas(new PublicKey(ACCOUNT));
    expect(calls).toEqual([[CONFIG_PDA, pdas.userAccount.toBase58(), pdas.userAllocation.toBase58(), TREASURY_ADDRESS, USDC_VAULT, USDT_VAULT]]);
    expect([pdas.config.toBase58(), MAINNET_SOL_TREASURY, MAINNET_VAULT_USDC_ATA, MAINNET_VAULT_USDT_ATA]).toEqual([CONFIG_PDA, TREASURY_ADDRESS, USDC_VAULT, USDT_VAULT]);
  });

  it('the builder’s config is one core’s hand-written reader accepts (two derivations of the layout agree)', () => {
    expect(readSolTreasury(configData()).toBase58()).toBe(MAINNET_SOL_TREASURY);
  });

  it('an existing allocation and user account: the totals, the remainder, the referrer, no new-PDA rent', async () => {
    const s = await openSnapshot({user: program(userData()), allocation: program(allocationData({spent: 300_000n, referrer: REFERRER}))});
    expect(s.allocation).toEqual({exists: true, totalBase: 1_998_667_554_963n, bonusBase: 16_142_571_618n, spentCents: 300_000n, purchaseCount: 2, referrer: REFERRER});
    expect(s.limits).toEqual({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 19_700_000n, firstPurchase: false});
    expect([s.userAccountExists, s.newPdaRent]).toEqual([true, 0n]);
  });

  it('firstPurchase (C21): absent, or purchase_count 0 — not 1; newPdaRent counts each absent PDA', async () => {
    expect((await openSnapshot({allocation: program(allocationData({count: 0}))})).limits.firstPurchase).toBe(true);
    expect((await openSnapshot({allocation: program(allocationData({count: 1}))})).limits.firstPurchase).toBe(false);
    expect((await openSnapshot({allocation: program(allocationData({count: 0x0100_0000}))})).allocation.purchaseCount).toBe(16_777_216);
    expect((await openSnapshot({allocation: program(allocationData({count: 0x8000_0001}))})).allocation.purchaseCount).toBe(2_147_483_649);
    expect((await openSnapshot({user: program(userData())})).newPdaRent).toBe(1_705_200n);
    expect((await openSnapshot({allocation: program(allocationData())})).newPdaRent).toBe(1_294_560n);
  });

  it('the config’s limits are read (min_purchase_usd, max_per_user_usd), the program’s fallbacks for 0', async () => {
    const s = await openSnapshot({config: program(configData({minPurchase: 0n, maxPerUser: 4_000_000n}))});
    expect([s.limits.minCents, s.limits.maxTxCents]).toEqual([2_500n, 4_000_000n]);
  });

  it('stage 9: price 3499, no next price; claimed = 1 is a readable allocation', async () => {
    const s = await openSnapshot({config: program(configData({stage: 9})), allocation: program(allocationData({claimed: 1}))});
    expect([s.stage.stage, s.stage.priceTicks, s.stage.nextPriceTicks]).toEqual([9, 3499n, null]);
  });

  it('boundaries that stay open: start time = now, tokens_sold one below the hard cap, stage_tokens_sold one below a stage', async () => {
    expect((await stateOf({config: program(configData({start: NOW_S}))})).kind).toBe('open');
    expect((await stateOf({config: program(configData({tokensSold: PRESALE_HARD_CAP_BASE - 1n}))})).kind).toBe('open');
    expect((await stateOf({config: program(configData({stageSold: TOKENS_PER_STAGE_BASE - 1n}))})).kind).toBe('open');
  });

  it('referrerAllocationOf (C7): the on-chain referrer’s allocation PDA, or the default key’s', async () => {
    const withRef = await referrerAllocationOf(await openSnapshot({allocation: program(allocationData({referrer: REFERRER}))}), ACCOUNT);
    expect(withRef.referrerAllocation.toBase58()).toBe(derivePresalePdas(new PublicKey(REFERRER)).userAllocation.toBase58());
    expect([withRef.effectiveReferrerAddress, withRef.registerReferrer]).toEqual([REFERRER, null]);
    const none = await referrerAllocationOf(await openSnapshot(), ACCOUNT);
    expect(none.referrerAllocation.toBase58()).toBe('C6TE5HwdPxJhUcAdwt6DRr2ceoavWBPqfCqcyFVFAWkQ');
    expect(none.effectiveReferrerAddress).toBeNull();
  });

  it('an existing allocation whose referrer@84 is all zero has no referrer (§2.1 rule 6, review 1 M3): null, and the default key’s PDA', async () => {
    const zero = await openSnapshot({allocation: program(allocationData({referrer: null}))});
    expect(zero.allocation).toMatchObject({exists: true, referrer: null});
    const r = await referrerAllocationOf(zero, ACCOUNT);
    expect(r.referrerAllocation.toBase58()).toBe('C6TE5HwdPxJhUcAdwt6DRr2ceoavWBPqfCqcyFVFAWkQ');
    expect(r.effectiveReferrerAddress).toBeNull();
  });
});

describe('readPresaleState — closed, a valid read of a closed sale (rule 4, rule 5)', () => {
  const stage0 = {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 1_312_240_123_017_711n, stageCapBase: TOKENS_PER_STAGE_BASE, raisedCents: 19_696_720n};

  it.each([
    ['presale_active = 0', {active: 0}],
    ['the start time one second ahead', {start: NOW_S + 1n}],
    ['tokens_sold at the hard cap', {tokensSold: PRESALE_HARD_CAP_BASE}],
  ])('inactive: %s', async (_name, o) => {
    expect(await stateOf({config: program(configData(o))})).toEqual({kind: 'inactive', stage: stage0});
  });

  it('the inactive test comes first (review 2 L9): a stage total at the cap is malformed only while active', async () => {
    expect(await stateOf({config: program(configData({stageSold: TOKENS_PER_STAGE_BASE}))})).toEqual(MALFORMED);
    expect(await stateOf({config: program(configData({stageSold: TOKENS_PER_STAGE_BASE, tokensSold: PRESALE_HARD_CAP_BASE, stage: 9}))})).toEqual({
      kind: 'inactive',
      stage: {...stage0, stage: 9, priceTicks: 3499n, nextPriceTicks: null, stageSoldBase: TOKENS_PER_STAGE_BASE},
    });
  });

  it('blocked: is_blocked = 1 (Q14); is_blocked = 0 opens; an inactive sale says inactive whoever asks', async () => {
    expect(await stateOf({user: program(userData({blocked: 1}))})).toEqual({kind: 'blocked', stage: stage0});
    expect((await stateOf({user: program(userData({blocked: 0}))})).kind).toBe('open');
    expect((await stateOf({config: program(configData({active: 0})), user: program(userData({blocked: 1}))})).kind).toBe('inactive');
  });
});

describe('readPresaleState — every rule refuses on its own (never open on doubt)', () => {
  const wrongOwner = (a: AccountData | null): AccountData => ({...(a as AccountData), owner: OTHER});

  it.each<[string, Partial<Chain>]>([
    // 1. config
    ['config absent', {config: null}],
    ['config not the program’s', {config: wrongOwner(program(configData()))}],
    ['config 369 bytes', {config: program(configData({length: 369}))}],
    ['config 371 bytes', {config: program(configData({length: 371}))}],
    ['config with PresaleAllocation’s discriminator', {config: program(configData({discriminator: PRESALE_ALLOCATION_LAYOUT.discriminator}))}],
    ['admin@8 moved', {config: program(configData({admin: OTHER}))}],
    ['sale_token@40 moved', {config: program(configData({saleToken: OTHER}))}],
    // 2. C5's pins
    ['sol_treasury changed', {config: program(configData({treasury: MAINNET_ADMIN_ADDRESS}))}],
    [
      'sol_treasury changed, the vault ATAs claiming the new owner (the pin alone catches it)',
      {
        config: program(configData({treasury: MAINNET_ADMIN_ADDRESS})),
        usdc: vault({mint: MAINNET_USDC_MINT, owner: MAINNET_ADMIN_ADDRESS}),
        usdt: vault({mint: MAINNET_USDT_MINT, owner: MAINNET_ADMIN_ADDRESS}),
      },
    ],
    ['usdc_address changed', {config: program(configData({usdc: OTHER}))}],
    ['usdt_address changed', {config: program(configData({usdt: OTHER}))}],
    ['the two stablecoin mints swapped', {config: program(configData({usdc: MAINNET_USDT_MINT, usdt: MAINNET_USDC_MINT}))}],
    // 3. a Borsh bool and a known stage
    ['presale_active = 2', {config: program(configData({active: 2}))}],
    ['stage 10', {config: program(configData({stage: 10}))}],
    ['stage 255', {config: program(configData({stage: 255}))}],
    // 5. the user account
    ['user account not the program’s', {user: wrongOwner(program(userData()))}],
    ['user account 57 bytes', {user: program(userData({length: 57}))}],
    ['user account 59 bytes', {user: program(userData({length: 59}))}],
    ['user account with Config’s discriminator', {user: program(userData({discriminator: CONFIG_LAYOUT.discriminator}))}],
    ['is_blocked = 2', {user: program(userData({blocked: 2}))}],
    // 6. the allocation
    ['allocation not the program’s', {allocation: wrongOwner(program(allocationData()))}],
    ['allocation 116 bytes', {allocation: program(allocationData({length: 116}))}],
    ['allocation 118 bytes', {allocation: program(allocationData({length: 118}))}],
    ['allocation with UserAccount’s discriminator', {allocation: program(allocationData({discriminator: USER_ACCOUNT_LAYOUT.discriminator}))}],
    ['allocation user@8 foreign', {allocation: program(allocationData({user: OTHER}))}],
    ['claimed = 2', {allocation: program(allocationData({claimed: 2}))}],
    // 7. the treasury
    ['treasury absent', {treasury: null}],
    ['treasury not System-owned', {treasury: {...TREASURY, owner: SPL_TOKEN_PROGRAM}}],
    ['treasury holding data', {treasury: {...TREASURY, data: new Uint8Array(1)}}],
    // 8. the vault ATAs
    ['USDC vault absent', {usdc: null}],
    ['USDT vault absent', {usdt: null}],
    ['USDC vault of the wrong mint', {usdc: vault({mint: MAINNET_USDT_MINT})}],
    ['USDT vault of the wrong mint', {usdt: vault({mint: MAINNET_USDC_MINT})}],
    ['USDC vault owned by someone else', {usdc: vault({mint: MAINNET_USDC_MINT, owner: MAINNET_ADMIN_ADDRESS})}],
    ['USDT vault owned by someone else', {usdt: vault({mint: MAINNET_USDT_MINT, owner: MAINNET_ADMIN_ADDRESS})}],
    ['USDC vault uninitialised', {usdc: vault({mint: MAINNET_USDC_MINT, state: 0})}],
    ['USDT vault uninitialised', {usdt: vault({mint: MAINNET_USDT_MINT, state: 0})}],
    ['USDC vault frozen', {usdc: vault({mint: MAINNET_USDC_MINT, state: 2})}],
    ['USDC vault under Token-2022', {usdc: vault({mint: MAINNET_USDC_MINT}, TOKEN_2022)}],
  ])('%s → unavailable (malformed)', async (_name, o) => {
    expect(await stateOf(o)).toEqual(MALFORMED);
  });

  // Every structural rule before any verdict (review 1 M3): a closed sale whose accounts break a rule is malformed, not
  // inactive or blocked (the valid closed reads are the positive controls above).
  const inactive = program(configData({active: 0}));
  const blocked = program(userData({blocked: 1}));
  it.each<[string, Partial<Chain>]>([
    ['inactive, the user account not the program’s (rule 5)', {config: inactive, user: wrongOwner(program(userData()))}],
    ['inactive, the allocation foreign (rule 6)', {config: inactive, allocation: program(allocationData({user: OTHER}))}],
    ['inactive, the treasury absent (rule 7)', {config: inactive, treasury: null}],
    ['inactive, the treasury holding data (rule 7)', {config: inactive, treasury: {...TREASURY, data: new Uint8Array(1)}}],
    ['inactive, the USDC vault absent (rule 8)', {config: inactive, usdc: null}],
    ['inactive, the USDT vault owned by someone else (rule 8)', {config: inactive, usdt: vault({mint: MAINNET_USDT_MINT, owner: MAINNET_ADMIN_ADDRESS})}],
    ['blocked, the allocation claimed = 2 (rule 6)', {user: blocked, allocation: program(allocationData({claimed: 2}))}],
    ['blocked, the treasury absent (rule 7)', {user: blocked, treasury: null}],
    ['blocked, the USDC vault absent (rule 8)', {user: blocked, usdc: null}],
  ])('%s → unavailable (malformed)', async (_name, o) => {
    expect(await stateOf(o)).toEqual(MALFORMED);
  });

  it('a reply of the wrong length is malformed — one short, or one extra', async () => {
    const six = [CHAIN.config, CHAIN.user, CHAIN.allocation, CHAIN.treasury, CHAIN.usdc, CHAIN.usdt];
    for (const reply of [six.slice(0, 5), [...six, null]]) {
      expect(await readPresaleState(fakeReader({getAccountsData: async () => reply}), ACCOUNT, NOW_MS)).toEqual(MALFORMED);
    }
  });

  it.each<[string, Error, string]>([
    ['a 403', new RpcForbidden('getMultipleAccounts'), 'refused'],
    ['the latch’s cool-down', new RpcCoolingDown('getMultipleAccounts'), 'refused'],
    ['a timeout', new RequestTimedOut('https://api.noc-tura.io/api/v1/rpc', 20_000), 'read-failed'],
    ['no answer', new RequestUnreachable('rpc', 'offline'), 'read-failed'],
    ['an HTTP 500', new RpcHttpError('rpc', 500), 'read-failed'],
    ['an RPC error', new RpcResponseError(-32005, 'node is behind'), 'read-failed'],
    ['a malformed RPC answer', new RpcMalformed('getMultipleAccounts'), 'read-failed'],
  ])('%s → unavailable (%s)', async (_name, error, code) => {
    const reader = fakeReader({
      getAccountsData: async () => {
        throw error;
      },
    });
    expect(await readPresaleState(reader, ACCOUNT, NOW_MS)).toEqual({kind: 'unavailable', code});
  });
});
````

`extension/src/background/presale/__tests__/layouts.test.ts` (new):

````ts
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from '../layouts';
import {
  ALLOCATION_ACCOUNT_LENGTH,
  ALLOCATION_REFERRAL_BONUS_OFFSET,
  ALLOCATION_TOTAL_TOKENS_OFFSET,
  CONFIG_ACCOUNT_LENGTH,
  CONFIG_SOL_TREASURY_OFFSET,
} from '../../../../../core/presale/allocation';

const PRESALE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const fieldsOf = (layout: {fields: Record<string, {offset: number; type: string}>}) => Object.entries(layout.fields).map(([name, f]) => `${name}@${f.offset}:${f.type}`);

// B1d §2.1 "Layouts from the IDL": the fields B1d reads, as the spec's table lists them (checked against the IDL and the
// program's structs on 2026-10-18 and by review 1) — the generated file must say exactly this.
describe('the generated account layouts', () => {
  it('Config (370 bytes): every field B1d reads at the spec’s offset', () => {
    expect(CONFIG_LAYOUT.length).toBe(370);
    expect(fieldsOf(CONFIG_LAYOUT)).toEqual(
      expect.arrayContaining([
        'admin@8:pubkey',
        'sale_token@40:pubkey',
        'usdt_address@72:pubkey',
        'usdc_address@104:pubkey',
        'current_stage@168:u8',
        'stage_tokens_sold@169:u64',
        'tokens_sold@177:u64',
        'total_usd_raised_cents@185:u64',
        'presale_start_time@193:i64',
        'presale_active@209:bool',
        'max_per_user_usd@322:u64',
        'min_purchase_usd@330:u64',
        'sol_treasury@338:pubkey',
      ]),
    );
    expect(fieldsOf(CONFIG_LAYOUT)).toHaveLength(29);
  });

  it('PresaleAllocation (117) and UserAccount (58 — review 1): every field, in order', () => {
    expect(PRESALE_ALLOCATION_LAYOUT.length).toBe(117);
    expect(fieldsOf(PRESALE_ALLOCATION_LAYOUT)).toEqual([
      'user@8:pubkey',
      'total_tokens@40:u64',
      'total_spent_cents@48:u64',
      'purchase_count@56:u32',
      'first_purchase_at@60:i64',
      'last_purchase_at@68:i64',
      'referral_bonus_tokens@76:u64',
      'referrer@84:pubkey',
      'claimed@116:bool',
    ]);
    expect(USER_ACCOUNT_LAYOUT.length).toBe(58);
    expect(fieldsOf(USER_ACCOUNT_LAYOUT)).toEqual(['is_blocked@8:bool', 'referrer@9:pubkey', 'has_staked@41:bool', 'total_referrals@42:u64', 'referral_rewards@50:u64']);
  });

  it('each discriminator is sha256("account:<Name>")[0..8] — recomputed here — and the spec’s', () => {
    for (const layout of [CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT]) {
      const expected = [...createHash('sha256').update(`account:${layout.name}`).digest().subarray(0, 8)];
      expect([layout.name, [...layout.discriminator]]).toEqual([layout.name, expected]);
    }
    expect([...CONFIG_LAYOUT.discriminator]).toEqual([155, 12, 170, 224, 30, 250, 204, 130]);
    expect([...PRESALE_ALLOCATION_LAYOUT.discriminator]).toEqual([202, 26, 199, 26, 125, 244, 253, 18]);
    expect([...USER_ACCOUNT_LAYOUT.discriminator]).toEqual([211, 33, 136, 16, 186, 110, 242, 127]);
  });

  it('two independent derivations agree: the generated offsets = core/presale/allocation.ts’s hand constants', () => {
    expect(PRESALE_ALLOCATION_LAYOUT.fields.total_tokens.offset).toBe(ALLOCATION_TOTAL_TOKENS_OFFSET);
    expect(PRESALE_ALLOCATION_LAYOUT.fields.referral_bonus_tokens.offset).toBe(ALLOCATION_REFERRAL_BONUS_OFFSET);
    expect(PRESALE_ALLOCATION_LAYOUT.length).toBe(ALLOCATION_ACCOUNT_LENGTH);
    expect(CONFIG_LAYOUT.fields.sol_treasury.offset).toBe(CONFIG_SOL_TREASURY_OFFSET);
    expect(CONFIG_LAYOUT.length).toBe(CONFIG_ACCOUNT_LENGTH);
  });

  it('no file under presale/ other than the generated layouts.ts names the config’s TGE field (§2.1, D5)', () => {
    const field = ['tge', 'timestamp'].join('_');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else files.push(path);
      }
    };
    walk(PRESALE_DIR);
    const named = files.filter(f => readFileSync(f, 'utf8').includes(field)).map(f => relative(PRESALE_DIR, f));
    expect(named).toEqual(['layouts.ts']);
    expect(files.map(f => relative(PRESALE_DIR, f))).toEqual(expect.arrayContaining(['api.ts', 'state.ts', 'layouts.ts']));
  });
});
````

`core/presale/__tests__/limits.test.ts` (new — runs in web's vitest, which includes `../core/presale/**`):

````ts
import {
  NOC_BASE_PER_NOC,
  PRESALE_ALLOCATION_RENT_LAMPORTS,
  PRESALE_HARD_CAP_BASE,
  PRESALE_MAX_PURCHASE_USD,
  PRESALE_MAX_TOTAL_PER_USER_USD,
  PRESALE_MIN_PURCHASE_USD,
  PRESALE_USER_ACCOUNT_RENT_LAMPORTS,
  STAGE_PRICE_TICKS,
  TOKENS_PER_STAGE_BASE,
  checkLimits,
  purchaseLimits,
  tokensFor,
  usdCentsForStable,
} from '../limits';
import {PRESALE_STAGE_PRICES, TOKENS_PER_STAGE} from '../stagePrices';
import {ALLOCATION_ACCOUNT_LENGTH} from '../allocation';
import {SYSTEM_ACCOUNT_RENT_LAMPORTS, TOKEN_ACCOUNT_RENT_LAMPORTS, TOKEN_ACCOUNT_SIZE} from '../../solana/transfer';

// B1d §2.1 "Derived values", §3.2, §6.1 "Limits (1a)": the program's rules in integer units — cents, NOC base units,
// lamports, price ticks (ICO lib.rs at 75450df).
describe('the program constants', () => {
  it('the fallbacks and the per-user cap are the program’s (lib.rs:34-36, C6)', () => {
    expect(PRESALE_MIN_PURCHASE_USD).toBe(2_500n);
    expect(PRESALE_MAX_PURCHASE_USD).toBe(5_000_000n);
    expect(PRESALE_MAX_TOTAL_PER_USER_USD).toBe(20_000_000n);
  });

  it('STAGE_PRICE_TICKS = core’s float table × 10 000, element by element (two independent copies agree)', () => {
    expect(STAGE_PRICE_TICKS).toHaveLength(PRESALE_STAGE_PRICES.length);
    PRESALE_STAGE_PRICES.forEach((p, i) => expect([i, STAGE_PRICE_TICKS[i]]).toEqual([i, BigInt(Math.round(p * 10_000))]));
    expect(STAGE_PRICE_TICKS[0]).toBe(1501n);
    expect(STAGE_PRICE_TICKS[9]).toBe(3499n);
  });

  it('the hard cap and a stage’s size in NOC base units (TOKENS_PER_STAGE × 10 stages × 10⁹)', () => {
    expect(NOC_BASE_PER_NOC).toBe(10n ** 9n);
    expect(TOKENS_PER_STAGE_BASE).toBe(BigInt(TOKENS_PER_STAGE) * 10n ** 9n);
    expect(PRESALE_HARD_CAP_BASE).toBe(TOKENS_PER_STAGE_BASE * 10n);
    expect(PRESALE_HARD_CAP_BASE).toBe(102_400_000_000_000_000n);
  });

  it('the new-PDA rents are (128 + length) × 6 960 — the formula that gives core’s system and token account rents', () => {
    const rent = (length: number) => BigInt((128 + length) * 6_960);
    expect(rent(0)).toBe(SYSTEM_ACCOUNT_RENT_LAMPORTS);
    expect(rent(TOKEN_ACCOUNT_SIZE)).toBe(TOKEN_ACCOUNT_RENT_LAMPORTS);
    expect(PRESALE_USER_ACCOUNT_RENT_LAMPORTS).toBe(rent(58));
    expect(PRESALE_ALLOCATION_RENT_LAMPORTS).toBe(rent(ALLOCATION_ACCOUNT_LENGTH));
    expect([PRESALE_USER_ACCOUNT_RENT_LAMPORTS, PRESALE_ALLOCATION_RENT_LAMPORTS]).toEqual([1_294_560n, 1_705_200n]);
  });
});

describe('purchaseLimits — the config’s fields, the program’s fallback for a 0, the per-user cap less what was spent', () => {
  it('the configured values are taken as they are (mainnet 2026-09-21: min 1 000, max 0)', () => {
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 0n)).toEqual({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n});
    expect(purchaseLimits({minPurchaseUsd: 7n, maxPerUserUsd: 99n}, 0n)).toEqual({minCents: 7n, maxTxCents: 99n, userRemainingCents: 20_000_000n});
  });

  it('a field of 0 is the program’s constant, each on its own', () => {
    expect(purchaseLimits({minPurchaseUsd: 0n, maxPerUserUsd: 0n}, 0n)).toEqual({minCents: 2_500n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n});
    expect(purchaseLimits({minPurchaseUsd: 0n, maxPerUserUsd: 123n}, 0n).minCents).toBe(2_500n);
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 0n).maxTxCents).toBe(5_000_000n);
  });

  it('the existing allocation is subtracted, floored at 0', () => {
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 300_000n).userRemainingCents).toBe(19_700_000n);
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 19_999_999n).userRemainingCents).toBe(1n);
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 20_000_000n).userRemainingCents).toBe(0n);
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 25_000_000n).userRemainingCents).toBe(0n);
  });
});

describe('checkLimits — the program’s order: minimum, per transaction, per user', () => {
  const limits = {minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n};

  it('every boundary of the minimum and the per-transaction maximum', () => {
    expect(checkLimits({...limits, cents: 999n})).toBe('below-min');
    expect(checkLimits({...limits, cents: 1_000n})).toBeNull();
    expect(checkLimits({...limits, cents: 5_000_000n})).toBeNull();
    expect(checkLimits({...limits, cents: 5_000_001n})).toBe('above-max-tx');
    expect(checkLimits({...limits, cents: 0n})).toBe('below-min');
  });

  it('the per-user remainder with an existing total_spent_cents, at the remainder and one above', () => {
    const l = purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 17_000_000n);
    expect(l.userRemainingCents).toBe(3_000_000n);
    expect(checkLimits({...l, cents: 3_000_000n})).toBeNull();
    expect(checkLimits({...l, cents: 3_000_001n})).toBe('above-user-limit');
  });

  it('the order: below the minimum wins over the remainder; the per-transaction maximum before the per-user one', () => {
    expect(checkLimits({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 0n, cents: 999n})).toBe('below-min');
    expect(checkLimits({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 1_000n, cents: 5_000_001n})).toBe('above-max-tx');
    expect(checkLimits({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 999n, cents: 1_000n})).toBe('above-user-limit');
  });

  it('the program’s fallback minimum when the field is 0: 2 499 below, 2 500 ok', () => {
    const l = purchaseLimits({minPurchaseUsd: 0n, maxPerUserUsd: 0n}, 0n);
    expect(checkLimits({...l, cents: 2_499n})).toBe('below-min');
    expect(checkLimits({...l, cents: 2_500n})).toBeNull();
  });
});

describe('usdCentsForStable and tokensFor — the program’s integer arithmetic, flooring', () => {
  it('a stablecoin amount floors to cents (9 999 base units → 0 cents)', () => {
    expect(usdCentsForStable(9_999n)).toBe(0n);
    expect(usdCentsForStable(10_000n)).toBe(1n);
    expect(usdCentsForStable(19_999n)).toBe(1n);
    expect(usdCentsForStable(10_000_000n)).toBe(1_000n);
    expect(() => usdCentsForStable(-1n)).toThrow(RangeError);
  });

  it('tokensFor(10 000, 0) = 666 222 518 321 (10¹⁵ / 1501, floored — review L1) and tokensFor(10 000, 9) = 285 795 941 697', () => {
    expect(tokensFor(10_000n, 0)).toBe(666_222_518_321n);
    expect(tokensFor(10_000n, 9)).toBe(285_795_941_697n);
    expect(tokensFor(1n, 0)).toBe(66_622_251n);
  });

  it('an unknown stage throws (the program answers PresaleEnded): 10, 255, −1, 1.5', () => {
    for (const s of [10, 255, -1, 1.5]) expect(() => tokensFor(10_000n, s)).toThrow(RangeError);
    expect(() => tokensFor(-1n, 0)).toThrow(RangeError);
  });
});
````

`core/presale/__tests__/vaultAtas.test.ts` (new):

````ts
import {PublicKey} from '@solana/web3.js';
import {
  MAINNET_ADMIN_ADDRESS,
  MAINNET_SOL_TREASURY,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
  MAINNET_VAULT_USDC_ATA,
  MAINNET_VAULT_USDT_ATA,
} from '../addresses';
import {findAssociatedTokenAddress} from '../../solana/encoding';

// B1d §2.1, C5: the stablecoin destinations are the treasury's own ATAs — whole addresses, re-derived here.
describe('the pinned vault ATAs', () => {
  it('each is findAssociatedTokenAddress(MAINNET_SOL_TREASURY, its mint)', () => {
    const treasury = new PublicKey(MAINNET_SOL_TREASURY);
    expect(findAssociatedTokenAddress(treasury, new PublicKey(MAINNET_USDC_MINT)).toBase58()).toBe(MAINNET_VAULT_USDC_ATA);
    expect(findAssociatedTokenAddress(treasury, new PublicKey(MAINNET_USDT_MINT)).toBase58()).toBe(MAINNET_VAULT_USDT_ATA);
  });

  it('the spec’s literals (§2.1), whole', () => {
    expect(MAINNET_VAULT_USDC_ATA).toBe('DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3');
    expect(MAINNET_VAULT_USDT_ATA).toBe('8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp');
  });

  it('negative control: the admin’s ATAs (the pre-2026-09-21 derivation) are different accounts', () => {
    const admin = new PublicKey(MAINNET_ADMIN_ADDRESS);
    expect(findAssociatedTokenAddress(admin, new PublicKey(MAINNET_USDC_MINT)).toBase58()).not.toBe(MAINNET_VAULT_USDC_ATA);
    expect(findAssociatedTokenAddress(admin, new PublicKey(MAINNET_USDT_MINT)).toBase58()).not.toBe(MAINNET_VAULT_USDT_ATA);
  });
});
````

`extension/scripts/__tests__/gen-presale-idl.test.mjs` (the layouts describe):

````diff
diff --git a/extension/scripts/__tests__/gen-presale-idl.test.mjs b/extension/scripts/__tests__/gen-presale-idl.test.mjs
index f198c61..6bf47bf 100644
--- a/extension/scripts/__tests__/gen-presale-idl.test.mjs
+++ b/extension/scripts/__tests__/gen-presale-idl.test.mjs
@@ -1,7 +1,8 @@
 import {createHash} from 'node:crypto';
 import {readFileSync} from 'node:fs';
-import {IDL_SHA256, OUTPUT_SHA256, OUT_PATH, PROGRAM_ID, presaleSource} from '../gen-presale-idl.mjs';
+import {IDL_SHA256, LAYOUTS_PATH, LAYOUTS_SHA256, LAYOUT_ACCOUNTS, OUTPUT_SHA256, OUT_PATH, PROGRAM_ID, layoutsSource, presaleSource} from '../gen-presale-idl.mjs';
 import {PRESALE_INSTRUCTIONS, STAKE_TIERS} from '../../src/background/dapp/decode/presaleIdl';
+import * as LAYOUTS from '../../src/background/presale/layouts';
 
 // Global constraints (plan 2 review 1 M2): presaleIdl.ts is generated only — it must be exactly what the committed
 // generator writes. The IDL itself is in the ICO repository, which CI does not have: the table's own content, turned
@@ -35,3 +36,51 @@ describe('the presale IDL generator', () => {
     expect(() => presaleSource(idlOf(wrong, STAKE_TIERS), IDL_SHA256)).toThrow('discriminator of');
   });
 });
+
+// B1d §2.1: layouts.ts is the generator's second output from the same pinned IDL — generated only, hash-pinned, and
+// rebuilt here from its own content (CI has no IDL). The IDL's shape for accounts: `accounts` carries each account's
+// discriminator, `types` its struct's fields in order.
+const layoutIdlOf = layouts => ({
+  address: PROGRAM_ID,
+  accounts: layouts.map(l => ({name: l.name, discriminator: [...l.discriminator]})),
+  types: layouts.map(l => ({name: l.name, type: {kind: 'struct', fields: Object.entries(l.fields).map(([name, f]) => ({name, type: f.type}))}})),
+});
+const GENERATED = LAYOUT_ACCOUNTS.map(([, constant]) => LAYOUTS[constant]);
+
+describe('the presale IDL generator — account layouts (B1d §2.1)', () => {
+  it('layouts.ts hashes to the generator’s pinned LAYOUTS_SHA256', () => {
+    expect(createHash('sha256').update(readFileSync(LAYOUTS_PATH)).digest('hex')).toBe(LAYOUTS_SHA256);
+  });
+
+  it('layouts.ts is byte for byte layoutsSource() of its own content (no IDL file needed) — Config, PresaleAllocation, UserAccount', () => {
+    expect(LAYOUT_ACCOUNTS.map(([name]) => name)).toEqual(['Config', 'PresaleAllocation', 'UserAccount']);
+    expect(GENERATED.map(l => l.name)).toEqual(['Config', 'PresaleAllocation', 'UserAccount']);
+    expect(layoutsSource(layoutIdlOf(GENERATED), IDL_SHA256)).toBe(readFileSync(LAYOUTS_PATH, 'utf8'));
+  });
+
+  it('a wrong account discriminator is refused — the generator recomputes sha256("account:<Name>") (negative control)', () => {
+    for (const i of [0, 1, 2]) {
+      const wrong = GENERATED.map((l, j) => (j === i ? {...l, discriminator: l.discriminator.map((b, k) => (k === 7 ? b ^ 1 : b))} : l));
+      expect(() => layoutsSource(layoutIdlOf(wrong), IDL_SHA256)).toThrow(`discriminator of account ${GENERATED[i].name}`);
+    }
+  });
+
+  it('u32 is accepted (purchase_count); any other type throws, naming the field; another program or a missing account is refused', () => {
+    expect(readFileSync(LAYOUTS_PATH, 'utf8')).toContain("purchase_count: {offset: 56, type: 'u32'}");
+    const typed = type => GENERATED.map((l, j) => (j === 2 ? {...l, fields: {...l.fields, has_staked: {offset: 41, type}}} : l));
+    for (const type of ['u16', 'u128', 'i32', 'string']) expect(() => layoutsSource(layoutIdlOf(typed(type)), IDL_SHA256)).toThrow('of UserAccount.has_staked');
+    const arrayType = layoutIdlOf(GENERATED);
+    arrayType.types[0].type.fields[0].type = {array: ['u8', 32]};
+    expect(() => layoutsSource(arrayType, IDL_SHA256)).toThrow('of Config.admin');
+    expect(() => layoutsSource({...layoutIdlOf(GENERATED), address: '11111111111111111111111111111111'}, IDL_SHA256)).toThrow('another program');
+    expect(() => layoutsSource(layoutIdlOf(GENERATED.slice(0, 2)), IDL_SHA256)).toThrow('no account UserAccount');
+  });
+
+  it('a changed field gives a different layouts.ts, with every later offset moved (negative control)', () => {
+    const inserted = GENERATED.map((l, j) => (j === 1 ? {...l, fields: {extra: {offset: 0, type: 'u8'}, ...l.fields}} : l));
+    const out = layoutsSource(layoutIdlOf(inserted), IDL_SHA256);
+    expect(out).not.toBe(readFileSync(LAYOUTS_PATH, 'utf8'));
+    expect(out).toContain("referrer: {offset: 85, type: 'pubkey'}");
+    expect(out).toContain('length: 118,');
+  });
+});
````

`extension/scripts/__tests__/presaleSwitch.test.mjs` (the kept-whole describe):

````diff
diff --git a/extension/scripts/__tests__/presaleSwitch.test.mjs b/extension/scripts/__tests__/presaleSwitch.test.mjs
index a6d5335..d4eb471 100644
--- a/extension/scripts/__tests__/presaleSwitch.test.mjs
+++ b/extension/scripts/__tests__/presaleSwitch.test.mjs
@@ -193,3 +193,57 @@ describe('the plugin removes a module with a side-effectful top level; a folded
     expect(chunk.code).toContain(EFFECT);
   });
 });
+
+// B1d §6.2 item 1's positive control names presale background modules no B1d-1a code calls yet (layouts.ts, state.ts):
+// in the on build every module under src/background/presale/ is kept whole, so the module maps list what the entry
+// imports rather than what tree-shaking left of it.
+describe('on: the presale background modules are kept whole', () => {
+  it('transform marks a module under src/background/presale/ (a query included) no-treeshake, its code unchanged; nothing else, and nothing off', () => {
+    const on = presaleSwitch(true);
+    const off = presaleSwitch(false);
+    for (const id of [join(ROOT, 'src/background/presale/state.ts'), `${join(ROOT, 'src/background/presale/layouts.ts')}?v=1`]) {
+      expect(on.transform('const x = 1;', id)).toEqual({code: 'const x = 1;', map: null, moduleSideEffects: 'no-treeshake'});
+      expect(off.transform('const x = 1;', id)).toBeNull();
+    }
+    for (const path of ['src/background/presaleHost.ts', 'src/app/presale/index.ts', 'src/unlock/presale.ts', 'src/background/index.ts', '../core/presale/limits.ts']) {
+      expect([path, on.transform('const x = 1;', join(ROOT, path))]).toEqual([path, null]);
+    }
+  });
+
+  let root;
+  const PURE = 'a-pure-presale-module-no-caller-uses';
+  beforeAll(() => {
+    root = mkdtempSync(join(tmpdir(), 'presale-switch-whole-'));
+    for (const {entry, stub} of PRESALE_ENTRIES) {
+      mkdirSync(dirname(join(root, entry)), {recursive: true});
+      mkdirSync(dirname(join(root, stub)), {recursive: true});
+      writeFileSync(join(root, stub), 'export const run = () => 0;\n');
+    }
+    writeFileSync(join(root, 'src/background/presale/api.ts'), "import './pure.ts';\nexport const run = () => 1;\n");
+    writeFileSync(join(root, 'src/background/presale/pure.ts'), `export const PURE = {name: '${PURE}'};\n`);
+    writeFileSync(join(root, 'main.js'), "import {run} from './src/background/presale/api.ts';\nglobalThis.ran = run();\n");
+  });
+  afterAll(() => rmSync(root, {recursive: true, force: true}));
+
+  const bundle = async plugins => {
+    const out = await build({
+      root,
+      configFile: false,
+      logLevel: 'silent',
+      define: {__NOCTURA_PRESALE__: 'true'},
+      plugins,
+      build: {write: false, minify: false, lib: {entry: join(root, 'main.js'), formats: ['es'], fileName: 'out'}},
+    });
+    return (Array.isArray(out) ? out[0] : out).output[0].moduleIds.map(id => id.slice(root.length + 1));
+  };
+
+  it('a pure module the entry imports and nobody calls is in the on build’s module map', async () => {
+    expect(await bundle([presaleSwitch(true, root)])).toContain('src/background/presale/pure.ts');
+  });
+
+  it('negative control: without the plugin, tree-shaking drops it from the map', async () => {
+    const modules = await bundle([]);
+    expect(modules).toContain('src/background/presale/api.ts');
+    expect(modules).not.toContain('src/background/presale/pure.ts');
+  });
+});
````

`extension/scripts/__tests__/check-no-presale.test.mjs` (the pinned `ON_BUILD` row):

````diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index 10d2452..c8f22c2 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -80,8 +80,8 @@ describe('the off-build module rule', () => {
 
 // §6.2 item 1's positive control, staged per plan (review 2 M2): the lists only grow, and each plan's modules are named.
 describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
-  it('the on build must carry the three on-path entries — the plugin maps something real', () => {
-    expect(ON_BUILD).toEqual(PRESALE_ENTRIES.map(e => e.entry));
+  it('the on build must carry the three on-path entries — the plugin maps something real — and the program state (Task 5)', () => {
+    expect(ON_BUILD).toEqual([...PRESALE_ENTRIES.map(e => e.entry), 'src/background/presale/layouts.ts', 'src/background/presale/state.ts', 'core/presale/limits.ts']);
     expect(BOTH_BUILDS).toEqual(['src/background/intents.ts']);
   });
 
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run (in a `git archive` copy of Task 4's tree with only the test files above added; rev 2 re-ran it on rev 2's Task 4 with the same counts — `state.test.ts` fails to load either way): `cd extension && npx vitest run src/background/presale/__tests__ scripts/__tests__/gen-presale-idl.test.mjs scripts/__tests__/presaleSwitch.test.mjs scripts/__tests__/check-no-presale.test.mjs` — `Test Files  5 failed (5)` · `Tests  3 failed | 53 passed (56)`: `state.test.ts` and `layouts.test.ts` fail to load (`Cannot find module '../state'`, `'../layouts'`), `gen-presale-idl.test.mjs` fails to load (`Cannot find module '../../src/background/presale/layouts'`); `check-no-presale.test.mjs` “the on build must carry the three on-path entries … and the program state (Task 5)” (`expected [ …(3) ] to deeply equal [ …(6) ]`); `presaleSwitch.test.mjs` “transform marks a module … no-treeshake” (`on.transform is not a function`) and “a pure module the entry imports and nobody calls is in the on build’s module map” (`expected [ …(2) ] to include 'src/background/presale/pure.ts'`). `cd web && npx vitest run ../core/presale/__tests__/limits.test.ts ../core/presale/__tests__/vaultAtas.test.ts` — `Test Files  2 failed (2)` · `Tests  2 failed | 1 passed (3)`: `limits.test.ts` fails to load (`Failed to resolve import "../limits"`), `vaultAtas.test.ts` two rows (`expected undefined to be 'DNMn9dt7…'`); its admin-ATA negative control passes, as a negative control must.

- [ ] **Step 3: Implement.**

The generator first, then run it against the ICO repository's IDL — it refuses any file but the pinned one, writes `presaleIdl.ts` unchanged (same `OUTPUT_SHA256`) and `layouts.ts`, and refuses an output whose hash is not `LAYOUTS_SHA256` (pinned from the dry run's run: `8ec812fc…4b91e90`):

```bash
node extension/scripts/gen-presale-idl.mjs ../Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/lib/idl.json
# 48651d64226625871caa39d79b42028e0e129c0d8e1cac3b9dafcb4541512886 36 8ec812fc19ac6858c2ceaeb5893891506910d7eaad14a6864bcfb18de4b91e90 3
```

`extension/scripts/gen-presale-idl.mjs`:

````diff
diff --git a/extension/scripts/gen-presale-idl.mjs b/extension/scripts/gen-presale-idl.mjs
index 1e72108..6ce7bb6 100644
--- a/extension/scripts/gen-presale-idl.mjs
+++ b/extension/scripts/gen-presale-idl.mjs
@@ -1,14 +1,16 @@
 // B1c plan 2, Task 1 (committed: plan 2 review 1 M2): writes src/background/dapp/decode/presaleIdl.ts — the presale
-// program's instruction table — from the program's Anchor IDL. The IDL lives in the ICO repository
-// (Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp, lib/idl.json at 75450df); the wallet repository has no copy.
+// program's instruction table — and (B1d §2.1) src/background/presale/layouts.ts — the account layouts B1d reads — from
+// the program's Anchor IDL. The IDL lives in the ICO repository (Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp,
+// lib/idl.json at 75450df); the wallet repository has no copy.
 //
 //   node extension/scripts/gen-presale-idl.mjs <path to the ICO repository's lib/idl.json>
 //
-// Re-run it only when the presale program's IDL changes (a program upgrade that adds or changes an instruction): pin the
-// new IDL's sha256 in IDL_SHA256 and the new output's in OUTPUT_SHA256, in the same commit as the regenerated table.
-// It refuses any other IDL file. CI never runs it (CI has no ICO repository): scripts/__tests__/gen-presale-idl.test.mjs
-// checks, without the IDL, that presaleIdl.ts is this script's output — its hash is OUTPUT_SHA256, and presaleSource()
-// rebuilt from the table's own content gives the file byte for byte.
+// Re-run it only when the presale program's IDL changes (a program upgrade that adds or changes an instruction or an
+// account): pin the new IDL's sha256 in IDL_SHA256 and the new outputs' in OUTPUT_SHA256 and LAYOUTS_SHA256, in the same
+// commit as the regenerated files. It refuses any other IDL file. CI never runs it (CI has no ICO repository):
+// scripts/__tests__/gen-presale-idl.test.mjs checks, without the IDL, that both files are this script's output — each
+// hashes to its pinned value, and presaleSource() / layoutsSource() rebuilt from the file's own content give it byte for
+// byte.
 import {createHash} from 'node:crypto';
 import {readFileSync, writeFileSync} from 'node:fs';
 import {dirname, join} from 'node:path';
@@ -21,6 +23,17 @@ export const PROGRAM_ID = '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';
 export const IDL_SHA256 = 'f31122758227e59673ad165aea75856d2ebb37be03a70d4c7e72c36c5e53c86a';
 /** presaleIdl.ts as this script writes it from that IDL. */
 export const OUTPUT_SHA256 = '48651d64226625871caa39d79b42028e0e129c0d8e1cac3b9dafcb4541512886';
+export const LAYOUTS_PATH = join(here, '..', 'src', 'background', 'presale', 'layouts.ts');
+/** layouts.ts as this script writes it from that IDL. */
+export const LAYOUTS_SHA256 = '8ec812fc19ac6858c2ceaeb5893891506910d7eaad14a6864bcfb18de4b91e90';
+/** The accounts B1d reads (§2.1), each with the name of its constant in layouts.ts. */
+export const LAYOUT_ACCOUNTS = [
+  ['Config', 'CONFIG_LAYOUT'],
+  ['PresaleAllocation', 'PRESALE_ALLOCATION_LAYOUT'],
+  ['UserAccount', 'USER_ACCOUNT_LAYOUT'],
+];
+/** Borsh sizes of the field types an account layout may hold; any other type throws. */
+const FIELD_SIZES = {pubkey: 32, u8: 1, u32: 4, u64: 8, i64: 8, bool: 1};
 
 const sha256 = b => createHash('sha256').update(b).digest('hex');
 
@@ -70,6 +83,46 @@ ${rows.join('\n')}
 `;
 }
 
+/** layouts.ts's full text for a parsed IDL whose file hashes to `idlSha` (every account discriminator checked against Anchor's rule). */
+export function layoutsSource(idl, idlSha) {
+  if (idl.address !== PROGRAM_ID) throw new Error('another program');
+  const blocks = LAYOUT_ACCOUNTS.map(([name, constant]) => {
+    const account = idl.accounts.find(a => a.name === name);
+    if (account === undefined) throw new Error(`no account ${name}`);
+    const check = [...createHash('sha256').update(`account:${name}`).digest().subarray(0, 8)];
+    if (JSON.stringify(check) !== JSON.stringify(account.discriminator)) throw new Error(`discriminator of account ${name}`);
+    const struct = idl.types.find(t => t.name === name);
+    if (struct === undefined || struct.type.kind !== 'struct') throw new Error(`no struct ${name}`);
+    let offset = 8;
+    const fields = struct.type.fields.map(f => {
+      if (!/^[a-z][a-z0-9_]*$/.test(f.name)) throw new Error(`field name ${f.name}`);
+      if (typeof f.type !== 'string' || !Object.hasOwn(FIELD_SIZES, f.type)) throw new Error(`type ${JSON.stringify(f.type)} of ${name}.${f.name}`);
+      const row = `    ${f.name}: {offset: ${offset}, type: '${f.type}'},`;
+      offset += FIELD_SIZES[f.type];
+      return row;
+    });
+    return `export const ${constant} = {
+  name: '${name}',
+  discriminator: [${check.join(', ')}],
+  length: ${offset},
+  fields: {
+${fields.join('\n')}
+  },
+} as const;
+`;
+  });
+  return `/**
+ * The presale program's account layouts (program ${idl.address}), generated from its Anchor IDL by
+ * scripts/gen-presale-idl.mjs — never edited by hand (spec B1d §2.1: one source of truth). The IDL lives in the ICO
+ * repository (lib/idl.json at 75450df, sha256 ${idlSha}). Each discriminator is sha256("account:" + name)[0..8], checked
+ * against the IDL's by the generator; each field's offset is the 8-byte discriminator plus the Borsh sizes of the fields
+ * before it, in the IDL's order; \`length\` is the whole account's data length.
+ */
+export type LayoutFieldType = 'pubkey' | 'u8' | 'u32' | 'u64' | 'i64' | 'bool';
+
+${blocks.join('\n')}`;
+}
+
 if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
   const source = process.argv[2];
   if (source === undefined) throw new Error('usage: node extension/scripts/gen-presale-idl.mjs <lib/idl.json>');
@@ -78,6 +131,9 @@ if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.
   if (sha !== IDL_SHA256) throw new Error(`not the pinned IDL: ${sha}`);
   const out = presaleSource(JSON.parse(text.toString('utf8')), sha);
   if (sha256(out) !== OUTPUT_SHA256) throw new Error(`the output is not the pinned one: ${sha256(out)}`);
+  const layouts = layoutsSource(JSON.parse(text.toString('utf8')), sha);
+  if (sha256(layouts) !== LAYOUTS_SHA256) throw new Error(`the layouts are not the pinned ones: ${sha256(layouts)}`);
   writeFileSync(OUT_PATH, out);
-  console.log(sha256(out), out.split('\n').filter(l => l.startsWith('  {name:')).length);
+  writeFileSync(LAYOUTS_PATH, layouts);
+  console.log(sha256(out), out.split('\n').filter(l => l.startsWith('  {name:')).length, sha256(layouts), LAYOUT_ACCOUNTS.length);
 }
````

`extension/src/background/presale/layouts.ts` (generated by the command above — byte for byte; never edited):

````ts
/**
 * The presale program's account layouts (program 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt), generated from its Anchor IDL by
 * scripts/gen-presale-idl.mjs — never edited by hand (spec B1d §2.1: one source of truth). The IDL lives in the ICO
 * repository (lib/idl.json at 75450df, sha256 f31122758227e59673ad165aea75856d2ebb37be03a70d4c7e72c36c5e53c86a). Each discriminator is sha256("account:" + name)[0..8], checked
 * against the IDL's by the generator; each field's offset is the 8-byte discriminator plus the Borsh sizes of the fields
 * before it, in the IDL's order; `length` is the whole account's data length.
 */
export type LayoutFieldType = 'pubkey' | 'u8' | 'u32' | 'u64' | 'i64' | 'bool';

export const CONFIG_LAYOUT = {
  name: 'Config',
  discriminator: [155, 12, 170, 224, 30, 250, 204, 130],
  length: 370,
  fields: {
    admin: {offset: 8, type: 'pubkey'},
    sale_token: {offset: 40, type: 'pubkey'},
    usdt_address: {offset: 72, type: 'pubkey'},
    usdc_address: {offset: 104, type: 'pubkey'},
    sol_price_for_token: {offset: 136, type: 'u64'},
    sol_price_for_stablecoin: {offset: 144, type: 'u64'},
    usdt_ratio: {offset: 152, type: 'u64'},
    usdc_ratio: {offset: 160, type: 'u64'},
    current_stage: {offset: 168, type: 'u8'},
    stage_tokens_sold: {offset: 169, type: 'u64'},
    tokens_sold: {offset: 177, type: 'u64'},
    total_usd_raised_cents: {offset: 185, type: 'u64'},
    presale_start_time: {offset: 193, type: 'i64'},
    tge_timestamp: {offset: 201, type: 'i64'},
    presale_active: {offset: 209, type: 'bool'},
    total_penalty_collected: {offset: 210, type: 'u64'},
    min_stake_amount: {offset: 218, type: 'u64'},
    total_staked: {offset: 226, type: 'u64'},
    total_staked_tier_a: {offset: 234, type: 'u64'},
    total_rewards_distributed: {offset: 242, type: 'u64'},
    total_stakers: {offset: 250, type: 'u64'},
    next_stake_id: {offset: 258, type: 'u64'},
    referral_reward_percentage: {offset: 266, type: 'u64'},
    total_referral_bonuses: {offset: 274, type: 'u64'},
    coordinator: {offset: 282, type: 'pubkey'},
    cross_chain_tokens_sold: {offset: 314, type: 'u64'},
    max_per_user_usd: {offset: 322, type: 'u64'},
    min_purchase_usd: {offset: 330, type: 'u64'},
    sol_treasury: {offset: 338, type: 'pubkey'},
  },
} as const;

export const PRESALE_ALLOCATION_LAYOUT = {
  name: 'PresaleAllocation',
  discriminator: [202, 26, 199, 26, 125, 244, 253, 18],
  length: 117,
  fields: {
    user: {offset: 8, type: 'pubkey'},
    total_tokens: {offset: 40, type: 'u64'},
    total_spent_cents: {offset: 48, type: 'u64'},
    purchase_count: {offset: 56, type: 'u32'},
    first_purchase_at: {offset: 60, type: 'i64'},
    last_purchase_at: {offset: 68, type: 'i64'},
    referral_bonus_tokens: {offset: 76, type: 'u64'},
    referrer: {offset: 84, type: 'pubkey'},
    claimed: {offset: 116, type: 'bool'},
  },
} as const;

export const USER_ACCOUNT_LAYOUT = {
  name: 'UserAccount',
  discriminator: [211, 33, 136, 16, 186, 110, 242, 127],
  length: 58,
  fields: {
    is_blocked: {offset: 8, type: 'bool'},
    referrer: {offset: 9, type: 'pubkey'},
    has_staked: {offset: 41, type: 'bool'},
    total_referrals: {offset: 42, type: 'u64'},
    referral_rewards: {offset: 50, type: 'u64'},
  },
} as const;
````

`core/presale/limits.ts` (new):

````ts
/**
 * The presale program's purchase rules in integer units (B1d §2.1, §3.2; cardinal rule 2): cents as bigint, NOC in base
 * units (9 decimals), lamports as bigint, a stage price in the program's own unit (ten-thousandths of a dollar). Every
 * number here is the program's (ICO `programs/solana-ico-enhanced/src/lib.rs` at 75450df); every division floors, as
 * the program's does.
 *
 * The configured limits are NOT here: `min_purchase_usd` and `max_per_user_usd` are read from the config account on
 * every view (`purchaseLimits`); these constants are only the program's fallbacks for a field that is 0.
 */

/** `PRESALE_MIN_PURCHASE_USD` (lib.rs:34): the minimum when `config.min_purchase_usd` is 0. */
export const PRESALE_MIN_PURCHASE_USD = 2_500n;
/** `PRESALE_MAX_PURCHASE_USD` (lib.rs:35): the per-transaction maximum when `config.max_per_user_usd` is 0. */
export const PRESALE_MAX_PURCHASE_USD = 5_000_000n;
/** `PRESALE_MAX_TOTAL_PER_USER_USD` (lib.rs:36, C6): the cap on an allocation's `total_spent_cents`; no config field. */
export const PRESALE_MAX_TOTAL_PER_USER_USD = 20_000_000n;

/** NOC base units per NOC (`TOKEN_DECIMALS`). */
export const NOC_BASE_PER_NOC = 1_000_000_000n;
/** `PRESALE_TOTAL_ALLOCATION × TOKEN_DECIMALS`: the hard cap on `config.tokens_sold`. */
export const PRESALE_HARD_CAP_BASE = 102_400_000n * NOC_BASE_PER_NOC;
/** `TOKENS_PER_STAGE × TOKEN_DECIMALS`: a stage's size; the program advances the stage when `stage_tokens_sold` reaches it. */
export const TOKENS_PER_STAGE_BASE = 10_240_000n * NOC_BASE_PER_NOC;

/** `STAGE_PRICES` (lib.rs:42-53), 0-indexed by `config.current_stage`. */
export const STAGE_PRICE_TICKS: readonly bigint[] = [1501n, 1723n, 1945n, 2167n, 2389n, 2611n, 2833n, 3055n, 3277n, 3499n];

/**
 * Rent-exempt minimums of the two PDAs a first purchase creates (`init_if_needed`, lib.rs:2904-2919): `(128 + length) ×
 * 6 960` for a UserAccount (58 bytes) and a PresaleAllocation (117), the formula of `SYSTEM_ACCOUNT_RENT_LAMPORTS` and
 * `TOKEN_ACCOUNT_RENT_LAMPORTS` (core/solana/transfer.ts).
 */
export const PRESALE_USER_ACCOUNT_RENT_LAMPORTS = 1_294_560n;
export const PRESALE_ALLOCATION_RENT_LAMPORTS = 1_705_200n;

export interface PurchaseLimits {
  minCents: bigint;
  maxTxCents: bigint;
  /** What this account may still spend: the per-user cap minus its allocation's `total_spent_cents`, floored at 0. */
  userRemainingCents: bigint;
}

/**
 * The program's limits for one purchase (lib.rs:333-351 SOL, 2414-2430 stablecoin — the same rule for every currency,
 * D7): the config's minimum and per-transaction maximum, each the program's constant when the field is 0, and the
 * per-user cap less what the allocation has already spent.
 */
export function purchaseLimits(config: {minPurchaseUsd: bigint; maxPerUserUsd: bigint}, totalSpentCents: bigint): PurchaseLimits {
  const remaining = PRESALE_MAX_TOTAL_PER_USER_USD - totalSpentCents;
  return {
    minCents: config.minPurchaseUsd > 0n ? config.minPurchaseUsd : PRESALE_MIN_PURCHASE_USD,
    maxTxCents: config.maxPerUserUsd > 0n ? config.maxPerUserUsd : PRESALE_MAX_PURCHASE_USD,
    userRemainingCents: remaining > 0n ? remaining : 0n,
  };
}

export type LimitCode = 'below-min' | 'above-max-tx' | 'above-user-limit';

/** The first limit a purchase of `cents` breaks, in the program's order (minimum, per transaction, per user), or null. */
export function checkLimits(q: {cents: bigint} & PurchaseLimits): LimitCode | null {
  if (q.cents < q.minCents) return 'below-min';
  if (q.cents > q.maxTxCents) return 'above-max-tx';
  if (q.cents > q.userRemainingCents) return 'above-user-limit';
  return null;
}

/** A stablecoin amount (6 decimals, base units) in cents, floored: the program's `amount × 100 / 10⁶`. */
export function usdCentsForStable(amount6: bigint): bigint {
  if (amount6 < 0n) throw new RangeError('usdCentsForStable: negative amount');
  return (amount6 * 100n) / 1_000_000n;
}

/** NOC base units for `cents` at a 0-indexed stage, floored: the program's `calculate_tokens_for_usd` (lib.rs:2793-2818). */
export function tokensFor(cents: bigint, stage: number): bigint {
  const ticks = Number.isInteger(stage) ? STAGE_PRICE_TICKS[stage] : undefined;
  if (ticks === undefined) throw new RangeError(`tokensFor: unknown stage ${stage}`);
  if (cents < 0n) throw new RangeError('tokensFor: negative amount');
  return (cents * NOC_BASE_PER_NOC * 100n) / ticks;
}
````

`core/presale/addresses.ts`:

````diff
diff --git a/core/presale/addresses.ts b/core/presale/addresses.ts
index 1e200f8..d2cf5fe 100644
--- a/core/presale/addresses.ts
+++ b/core/presale/addresses.ts
@@ -18,3 +18,12 @@ export const NOC_DECIMALS = 9;
 /** Circle's USDC and Tether's USDT on Solana mainnet, both 6 decimals. */
 export const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
 export const MAINNET_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
+
+/**
+ * The treasury's associated token accounts for USDC and USDT — where a stablecoin purchase pays (B1d §2.1, C5):
+ * `findAssociatedTokenAddress(MAINNET_SOL_TREASURY, mint)`, whole addresses (a test re-derives both). The extension
+ * reads `config.sol_treasury` and refuses the presale unless it is the pinned treasury, so these are the only
+ * destinations it ever pays.
+ */
+export const MAINNET_VAULT_USDC_ATA = 'DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3';
+export const MAINNET_VAULT_USDT_ATA = '8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp';
````

`extension/src/background/presale/state.ts` (new):

````ts
import {PublicKey} from '@solana/web3.js';
import {base58} from '@scure/base';
import {
  MAINNET_ADMIN_ADDRESS,
  MAINNET_NOC_MINT,
  MAINNET_PROGRAM_ID,
  MAINNET_SOL_TREASURY,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
  MAINNET_VAULT_USDC_ATA,
  MAINNET_VAULT_USDT_ATA,
} from '../../../../core/presale/addresses';
import {derivePresalePdas, readU64LE} from '../../../../core/presale/allocation';
import {
  PRESALE_ALLOCATION_RENT_LAMPORTS,
  PRESALE_HARD_CAP_BASE,
  PRESALE_USER_ACCOUNT_RENT_LAMPORTS,
  STAGE_PRICE_TICKS,
  TOKENS_PER_STAGE_BASE,
  purchaseLimits,
  type PurchaseLimits,
} from '../../../../core/presale/limits';
import {resolveReferrerWith, type AllocationRef, type ResolvedReferrer} from '../../../../core/presale/referrer';
import {RpcForbidden, SYSTEM_PROGRAM_ID, type AccountData, type SolanaReader} from '../../../../core/solana/rpc';
import {tokenAccountInfo} from '../dapp/tokenState';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from './layouts';

/**
 * B1d §2.1 (D4, C5, C6, C21, C28): the presale's state, read from the chain — the config account and the account's two
 * PDAs, parsed with the layouts generated from the pinned IDL, plus the three pinned destinations, all in ONE
 * `getAccountsData` through the proxy. The presale is open only when every rule below holds; anything else is closed,
 * and a failed or doubtful read is `unavailable`, never open.
 */
export type UnavailableCode = 'read-failed' | 'refused' | 'malformed';

/** The stage as the program holds it (`current_stage`, 0-indexed) and what it costs. Amounts as bigint. */
export interface StageFacts {
  stage: number;
  priceTicks: bigint;
  nextPriceTicks: bigint | null;
  stageSoldBase: bigint;
  stageCapBase: bigint;
  raisedCents: bigint;
}

export interface AllocationFacts {
  exists: boolean;
  totalBase: bigint;
  bonusBase: bigint;
  spentCents: bigint;
  purchaseCount: number;
  /** The referrer registered on chain, or null (absent, or 32 zero bytes). */
  referrer: string | null;
}

export interface PresaleSnapshot {
  stage: StageFacts;
  limits: PurchaseLimits & {firstPurchase: boolean};
  allocation: AllocationFacts;
  userAccountExists: boolean;
  /** Rent of the PDAs a purchase now would create (`init_if_needed`): the user account and the allocation, each if absent. */
  newPdaRent: bigint;
  /** C28's "before" of each destination, from this same read. */
  treasuryLamports: bigint;
  vaults: {USDC: {address: string; amount: bigint}; USDT: {address: string; amount: bigint}};
}

export type PresaleState =
  | {kind: 'unavailable'; code: UnavailableCode}
  | {kind: 'inactive' | 'blocked'; stage: StageFacts}
  | {kind: 'open'; snapshot: PresaleSnapshot};

type Field = {readonly offset: number};

const pubkeyAt = (data: Uint8Array, f: Field): string => base58.encode(data.subarray(f.offset, f.offset + 32));
const u64At = (data: Uint8Array, f: Field): bigint => readU64LE(data, f.offset);
const i64At = (data: Uint8Array, f: Field): bigint => BigInt.asIntN(64, readU64LE(data, f.offset));
// `* 2 ** 24`, not `<< 24`: the high byte never flips the sign.
const u32At = (data: Uint8Array, f: Field): number =>
  ((data[f.offset] as number) | ((data[f.offset + 1] as number) << 8) | ((data[f.offset + 2] as number) << 16)) + (data[f.offset + 3] as number) * 2 ** 24;
/** A Borsh bool: 0 or 1; any other byte is null (malformed). */
const boolAt = (data: Uint8Array, f: Field): boolean | null => {
  const b = data[f.offset];
  return b === 0 ? false : b === 1 ? true : null;
};
const isZero = (bytes: Uint8Array): boolean => bytes.every(b => b === 0);

/** The account is the program's, exactly `length` long, and starts with `discriminator`. */
function isProgramAccount(a: AccountData, layout: {readonly length: number; readonly discriminator: readonly number[]}): boolean {
  if (a.owner !== MAINNET_PROGRAM_ID || a.data.length !== layout.length) return false;
  return layout.discriminator.every((b, i) => a.data[i] === b);
}

/** A pinned vault ATA (rule 8): an initialized SPL Token account of `mint` owned by the treasury, or null. */
function vaultAmount(a: AccountData | null, mint: string, treasury: string): bigint | null {
  if (a === null) return null;
  const info = tokenAccountInfo(a.data, a.owner);
  if (info === null || info.program !== 'token' || info.state !== 'initialized') return null;
  return info.mint === mint && info.owner === treasury ? info.amount : null;
}

const unavailable = (code: UnavailableCode): PresaleState => ({kind: 'unavailable', code});

/**
 * Read the presale's state for `account` (a base58 key) at `nowMs` (UTC milliseconds). One `getAccountsData` for six
 * accounts: config, the user account and the allocation of `account`, the treasury and its two vault ATAs.
 */
export async function readPresaleState(reader: SolanaReader, account: string, nowMs: number): Promise<PresaleState> {
  const me = new PublicKey(account);
  const pdas = derivePresalePdas(me);
  const addresses = [
    pdas.config.toBase58(),
    pdas.userAccount.toBase58(),
    pdas.userAllocation.toBase58(),
    MAINNET_SOL_TREASURY,
    MAINNET_VAULT_USDC_ATA,
    MAINNET_VAULT_USDT_ATA,
  ];
  let accounts: (AccountData | null)[];
  try {
    accounts = await reader.getAccountsData(addresses);
  } catch (e) {
    return unavailable(e instanceof RpcForbidden ? 'refused' : 'read-failed');
  }
  if (accounts.length !== addresses.length) return unavailable('malformed');
  const [config, user, allocation, treasury, usdcVault, usdtVault] = accounts;

  // 1. Config: the program's, 370 bytes, Config's discriminator; the positional controls admin@8 and sale_token@40.
  const C = CONFIG_LAYOUT.fields;
  if (config === null || config === undefined || !isProgramAccount(config, CONFIG_LAYOUT)) return unavailable('malformed');
  const c = config.data;
  if (pubkeyAt(c, C.admin) !== MAINNET_ADMIN_ADDRESS || pubkeyAt(c, C.sale_token) !== MAINNET_NOC_MINT) return unavailable('malformed');
  // 2. C5's pins: a moved treasury or mint closes the presale.
  if (pubkeyAt(c, C.sol_treasury) !== MAINNET_SOL_TREASURY) return unavailable('malformed');
  if (pubkeyAt(c, C.usdc_address) !== MAINNET_USDC_MINT || pubkeyAt(c, C.usdt_address) !== MAINNET_USDT_MINT) return unavailable('malformed');
  // 3. A Borsh bool and a known stage.
  const activeFlag = boolAt(c, C.presale_active);
  const stage = c[C.current_stage.offset] as number;
  const priceTicks = STAGE_PRICE_TICKS[stage];
  if (activeFlag === null || priceTicks === undefined) return unavailable('malformed');
  // 4. Active as the program decides it — the inactive test first; while active, the stage total below a stage's size.
  const stageSold = u64At(c, C.stage_tokens_sold);
  const active = activeFlag && i64At(c, C.presale_start_time) <= BigInt(Math.floor(nowMs / 1000)) && u64At(c, C.tokens_sold) < PRESALE_HARD_CAP_BASE;
  if (active && stageSold >= TOKENS_PER_STAGE_BASE) return unavailable('malformed');

  // 5. The user account: absent, or the program's UserAccount with a Borsh bool for is_blocked.
  let blocked = false;
  if (user !== null && user !== undefined) {
    if (!isProgramAccount(user, USER_ACCOUNT_LAYOUT)) return unavailable('malformed');
    const b = boolAt(user.data, USER_ACCOUNT_LAYOUT.fields.is_blocked);
    if (b === null) return unavailable('malformed');
    blocked = b;
  }

  // 6. The allocation: absent, or the program's PresaleAllocation of this very account (user@8) with a Borsh bool claimed.
  const A = PRESALE_ALLOCATION_LAYOUT.fields;
  let facts: AllocationFacts = {exists: false, totalBase: 0n, bonusBase: 0n, spentCents: 0n, purchaseCount: 0, referrer: null};
  if (allocation !== null && allocation !== undefined) {
    const d = allocation.data;
    if (!isProgramAccount(allocation, PRESALE_ALLOCATION_LAYOUT) || pubkeyAt(d, A.user) !== me.toBase58() || boolAt(d, A.claimed) === null) {
      return unavailable('malformed');
    }
    const referrer = d.subarray(A.referrer.offset, A.referrer.offset + 32);
    facts = {
      exists: true,
      totalBase: u64At(d, A.total_tokens),
      bonusBase: u64At(d, A.referral_bonus_tokens),
      spentCents: u64At(d, A.total_spent_cents),
      purchaseCount: u32At(d, A.purchase_count),
      referrer: isZero(referrer) ? null : base58.encode(referrer),
    };
  }

  // 7. The treasury: a plain System account with no data.
  if (treasury === null || treasury === undefined || treasury.owner !== SYSTEM_PROGRAM_ID || treasury.data.length !== 0) return unavailable('malformed');
  // 8. Each vault ATA: an initialized SPL Token account of its mint, owned by config.sol_treasury.
  const solTreasury = pubkeyAt(c, C.sol_treasury);
  const usdc = vaultAmount(usdcVault ?? null, MAINNET_USDC_MINT, solTreasury);
  const usdt = vaultAmount(usdtVault ?? null, MAINNET_USDT_MINT, solTreasury);
  if (usdc === null || usdt === null) return unavailable('malformed');

  const stageFacts: StageFacts = {
    stage,
    priceTicks,
    nextPriceTicks: STAGE_PRICE_TICKS[stage + 1] ?? null,
    stageSoldBase: stageSold,
    stageCapBase: TOKENS_PER_STAGE_BASE,
    raisedCents: u64At(c, C.total_usd_raised_cents),
  };
  if (!active) return {kind: 'inactive', stage: stageFacts};
  if (blocked) return {kind: 'blocked', stage: stageFacts};

  const userAccountExists = user !== null && user !== undefined;
  return {
    kind: 'open',
    snapshot: {
      stage: stageFacts,
      limits: {
        ...purchaseLimits({minPurchaseUsd: u64At(c, C.min_purchase_usd), maxPerUserUsd: u64At(c, C.max_per_user_usd)}, facts.spentCents),
        firstPurchase: !facts.exists || facts.purchaseCount === 0,
      },
      allocation: facts,
      userAccountExists,
      newPdaRent: (userAccountExists ? 0n : PRESALE_USER_ACCOUNT_RENT_LAMPORTS) + (facts.exists ? 0n : PRESALE_ALLOCATION_RENT_LAMPORTS),
      treasuryLamports: treasury.lamports,
      vaults: {USDC: {address: MAINNET_VAULT_USDC_ATA, amount: usdc}, USDT: {address: MAINNET_VAULT_USDT_ATA, amount: usdt}},
    },
  };
}

/** The allocation as `resolveReferrerWith` takes it, from the snapshot (no second read). */
export function allocationRefOf(snapshot: PresaleSnapshot): AllocationRef {
  const a = snapshot.allocation;
  return {exists: a.exists, referrer: a.referrer, purchaseCount: a.purchaseCount};
}

/**
 * The referrer allocation a purchase by `account` passes (C7): the on-chain referrer's `["allocation", referrer]` PDA,
 * or the default key's when there is none. No captured referrer before B1d-2.
 */
export function referrerAllocationOf(snapshot: PresaleSnapshot, account: string): Promise<ResolvedReferrer> {
  return resolveReferrerWith(async () => allocationRefOf(snapshot), new PublicKey(account), null);
}
````

`extension/src/background/presale/api.ts`:

````diff
diff --git a/extension/src/background/presale/api.ts b/extension/src/background/presale/api.ts
index f7d9da0..2ffd5e9 100644
--- a/extension/src/background/presale/api.ts
+++ b/extension/src/background/presale/api.ts
@@ -1,4 +1,6 @@
 import type {PresaleHost} from '../presaleHost';
+// B1d-1a: the program-state reader (§2.1) joins the presale build here; B1d-1b's handlers call it.
+import './state';
 
 /**
  * B1d §1.1, §1.2: the background's presale entry — the one module of `presale/` that shared code imports (index.ts
````

`extension/scripts/presaleSwitch.mjs`:

````diff
diff --git a/extension/scripts/presaleSwitch.mjs b/extension/scripts/presaleSwitch.mjs
index ef2a0d5..bb4d79d 100644
--- a/extension/scripts/presaleSwitch.mjs
+++ b/extension/scripts/presaleSwitch.mjs
@@ -1,5 +1,5 @@
 import {existsSync} from 'node:fs';
-import {dirname, join, resolve} from 'node:path';
+import {dirname, join, resolve, sep} from 'node:path';
 import {fileURLToPath} from 'node:url';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
@@ -19,7 +19,10 @@ export const PRESALE_ENTRIES = [
  * The Vite plugin that removes presale code from the off build: its `resolveId` resolves each entry, however it is
  * spelled (a query or a hash included), to its stub, so the entry's module — and every module only it imports, with
  * whatever their top level does — never enters the bundle. A guarded call site could not do that, and the background is
- * a module service worker, where an import cannot sit in an `if` and `import()` throws. On, it resolves nothing.
+ * a module service worker, where an import cannot sit in an `if` and `import()` throws. On, it resolves nothing, and
+ * every module under `src/background/presale/` is kept whole (`moduleSideEffects: 'no-treeshake'`): the on build
+ * carries each presale background module the entry imports, whether or not a caller uses it yet, so the module maps —
+ * the off-build gate's positive control (§6.2) — say what the build really holds, not what tree-shaking left of it.
  * `api.presale` says which mode it is in (the configs' parity test reads it).
  */
 export function presaleSwitch(on, root = ROOT) {
@@ -29,6 +32,7 @@ export function presaleSwitch(on, root = ROOT) {
     if (!existsSync(join(root, stub))) throw new Error(`presaleSwitch: the stub ${stub} is missing`);
     stubs.set(join(root, entry), join(root, stub));
   }
+  const keptWhole = join(root, 'src', 'background', 'presale') + sep;
   return {
     name: 'noctura:presale-switch',
     enforce: 'pre',
@@ -39,5 +43,9 @@ export function presaleSwitch(on, root = ROOT) {
       if (resolved === null || resolved.external) return null;
       return stubs.get(resolved.id.replace(/[?#].*$/, '')) ?? null;
     },
+    transform(code, id) {
+      if (!on || !id.replace(/[?#].*$/, '').startsWith(keptWhole)) return null;
+      return {code, map: null, moduleSideEffects: 'no-treeshake'};
+    },
   };
 }
````

`extension/scripts/check-no-presale.mjs`:

````diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index 33a722c..5ac9d48 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -21,9 +21,16 @@ const DECODER = 'src/background/dapp/decode/presaleIdl.ts';
 export const OFF_FORBIDDEN = ['src/background/presale/', 'src/app/presale/', 'src/unlock/presale.ts', 'core/referral/'];
 export const CORE_PRESALE_ALLOWED = ['core/presale/addresses.ts', 'core/presale/allocation.ts', 'core/presale/stagePrices.ts'];
 
-// B1d-1a: the three on-path entries (§1.1); Task 5 adds presale/{layouts,state}.ts and core/presale/limits.ts;
-// 1b adds presale/{quote,buy}.ts; B1d-2 adds presale/{record,referral}.ts and core/referral/index.ts.
-export const ON_BUILD = ['src/background/presale/api.ts', 'src/app/presale/index.ts', 'src/unlock/presale.ts'];
+// B1d-1a: the three on-path entries (§1.1), the program state presale/{layouts,state}.ts and core/presale/limits.ts
+// (§2.1); 1b adds presale/{quote,buy}.ts; B1d-2 adds presale/{record,referral}.ts and core/referral/index.ts.
+export const ON_BUILD = [
+  'src/background/presale/api.ts',
+  'src/app/presale/index.ts',
+  'src/unlock/presale.ts',
+  'src/background/presale/layouts.ts',
+  'src/background/presale/state.ts',
+  'core/presale/limits.ts',
+];
 // Task 3: the intent-kind registry (C19 — both builds sign and read through it); Task 6 adds src/background/geo/gate.ts
 // and core/geo/fetch.ts (D15: the off build did not lose the gate).
 export const BOTH_BUILDS = ['src/background/intents.ts'];
````

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates.**

Run: the Step 2 commands — extension `Test Files  5 passed (5)` · `Tests  140 passed (140)` (state 71, layouts 5, generator 8, switch 20, gate 36; rev 1: 130 with state 61 — rev 2 adds the zero-referrer row and nine "every rule before any verdict" rows, review 1 M3); web `Test Files  2 passed (2)` · `Tests  17 passed (17)`.

Run: `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  185 passed (185)` · `Tests  3689 passed (3689)` (previous tree 183 / 3605: +2 files, +84 tests — state 71, layouts 5, generator +5, presaleSwitch +3; rev 1: 3676 on 3602). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  9 passed (9)` · `Tests  216 passed (216)` (rev 1: 213; unchanged from the previous tree: nothing of this task is in the off build, so none of its files joins `NOPRESALE_TESTS`).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build (rpc methods unchanged: `getAccountsData` is `getMultipleAccounts`), the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 7 required modules; 0 markers (none in the off build, each in the on build); 4 strings and the decoder's instruction names stay in the off build`. `npm run csp`, `npm run secrets` — ok for both builds; `npm run reproducible` — ok, both variants. `node scripts/check-no-tge-date.mjs` (package) — `608 source and built files checked` per build; repository root (after the commit) — `no TGE date in 1269 tracked text files`.

**(rev 2) Finding outside the plan:** the first rev 2 whole-suite run on this tree had one failure in B1b's `Confirm.test.tsx` “M4: while it stays open the block stays, and the re-reads stop once #20 is gone” (`expected 2 to be greater than 2` — the re-read count after `advanceTimersByTime` under `useFakeTimers({shouldAdvanceTime: true})`); the file then passed 5 of 5 alone and the whole suite passed on a rerun (3689 / 216). Nothing in it is touched by 1a; a timing-dependent test on a confirming screen is a finding for a later B1b task, not papered over here.

This task touches `core/` (rev 2 changed nothing under `core/`, `web/` or `src/` at any task — `git diff --name-only` between each rev 1 commit and its rev 2 commit lists only `extension/` and the spec — so these results, rev 1's, stand): `cd ../web && npm run verify` — green (`Test Files  46 passed (46)` · `Tests  571 passed (571)`, previous 44 / 554; the bundle test `3 passed`; reproducible); from the repository root `npx tsc --noEmit; echo $?` → `0`, `npx jest` → `Test Suites: 1 skipped, 180 passed` · `Tests: 1 skipped, 1234 passed, 1235 total` (the app imports neither new module).

- [ ] **Step 5: Commit.**

```bash
git add -A core/presale extension
git commit -m "feat(extension): B1d-1a program state — account layouts generated from the pinned IDL (hash-pinned), state.ts (one getAccountsData; C5's pins; never open on doubt), core/presale/limits.ts (bigint, the program's rules, D7, C6), the vault ATAs; the on build keeps presale background modules whole" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked), `timeout 300`; `tsc`'s own exit code first (0 for every one; for a `core/` mutation the repository root's `tsc` too), then the named test file.** `ST` = `state.test.ts` (61 tests), `LT` = `core/presale/__tests__/limits.test.ts` (14, web's vitest), `GT` = `gen-presale-idl.test.mjs` (8).

| id | the change | named test → observed |
|---|---|---|
| G1 | `gen-presale-idl.mjs` `layoutsSource`: `if (false && JSON.stringify(check) !== …)` (the account discriminator not recomputed) | GT “a wrong account discriminator is refused…” — tsc 0 · RED `Tests  1 failed \| 7 passed (8)` |
| G2 | `FIELD_SIZES` `u32: 8` | GT “layouts.ts is byte for byte layoutsSource()…”, “a changed field gives a different layouts.ts…” — tsc 0 · RED `Tests  2 failed \| 6 passed (8)` |
| G3 | `FIELD_SIZES` without `u32` (u32 unknown → throws) | GT byte-for-byte, wrong-discriminator, “u32 is accepted…”, changed-field — tsc 0 · RED `Tests  4 failed \| 4 passed (8)` |
| Y1 | `layouts.ts` hand-edited: `sol_treasury: {offset: 337,` | GT “hashes to the pinned LAYOUTS_SHA256”, byte-for-byte; `layouts.test.ts` “Config (370 bytes)…”, “two independent derivations agree…” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  4 failed \| 9 passed (13)` |
| P1 | `presaleSwitch.mjs` `transform`: `if (true \|\| …) return null` (nothing kept whole) | `presaleSwitch.test.mjs` “transform marks a module…”, “a pure module … is in the on build’s module map” — tsc 0 · RED `Tests  2 failed \| 18 passed (20)` |
| L1 | `check-no-presale.mjs` `ON_BUILD` without `state.ts` | `check-no-presale.test.mjs` “the on build must carry … the program state (Task 5)” — tsc 0 · RED `Tests  1 failed \| 35 passed (36)` |
| S1 | `state.ts` `isProgramAccount`: `(a.owner !== MAINNET_PROGRAM_ID && false) \|\|` | ST config / user account / allocation “not the program’s” — tsc 0 · RED `Tests  4 failed \| 67 passed (71)` |
| S2 | `isProgramAccount`: `a.data.length < layout.length` (a longer account accepted) | ST “config 371 bytes”, “user account 59 bytes”, “allocation 118 bytes” — tsc 0 · RED `Tests  3 failed \| 68 passed (71)` |
| S3 | `isProgramAccount`: `return layout.discriminator.length === 8;` (no discriminator check) | ST the three wrong-discriminator rows — tsc 0 · RED `Tests  3 failed \| 68 passed (71)` |
| S4 | rule 1: `(pubkeyAt(c, C.admin) !== MAINNET_ADMIN_ADDRESS && false) \|\|` | ST “admin@8 moved” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S5 | rule 1: the `sale_token@40` control `&& false` | ST “sale_token@40 moved” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S6 | rule 2: the `sol_treasury` pin deleted | ST “sol_treasury changed, the vault ATAs claiming the new owner (the pin alone catches it)” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S7 | rule 2: the `usdc_address` pin deleted | ST “usdc_address changed” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S8 | rule 2: the `usdt_address` pin deleted | ST “usdt_address changed” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S9 | rule 3: `if (priceTicks === undefined)` (the bool byte unchecked) | ST “presale_active = 2” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S10 | rule 3: `STAGE_PRICE_TICKS[stage % 10]` (an unknown stage priced) | ST “stage 10”, “stage 255” — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S11 | rule 4: the start-time test `\|\| true` | ST “inactive: the start time one second ahead” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S12 | rule 4: the hard-cap test `\|\| true` | ST “inactive: tokens_sold at the hard cap”, “the inactive test comes first (review 2 L9)…” — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S13 | rule 4: the `stage_tokens_sold` check deleted | ST “the inactive test comes first…” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S14 | rule 4: `if (stageSold >= TOKENS_PER_STAGE_BASE)` (not only while active — the L9 order) | ST “the inactive test comes first…” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S15 | rule 5: `blocked = b === true;` (`is_blocked = 2` read as not blocked) | ST “is_blocked = 2” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S16 | the `blocked` verdict never returned | ST “blocked: is_blocked = 1 (Q14)…” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S17 | rule 6: the `user@8` control deleted | ST “allocation user@8 foreign” — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S18 | rule 6: the `claimed` bool check deleted | ST “claimed = 2” — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S19 | rule 7: `(treasury.owner !== SYSTEM_PROGRAM_ID && false) \|\|` | ST “treasury not System-owned” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S20 | rule 7: the data-length check deleted | ST “treasury holding data” — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S21 | rule 8: `return info.owner === treasury ? …` (mint unchecked) | ST both “vault of the wrong mint” rows — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S22 | rule 8: `return info.mint === mint ? …` (owner unchecked) | ST both “vault owned by someone else” rows — tsc 0 · RED `Tests  3 failed \| 68 passed (71)` |
| S23 | rule 8: `info.state !== 'initialized'` deleted (a frozen vault accepted) | ST “USDC vault frozen” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S24 | rule 8: `info.program !== 'token'` deleted | ST “USDC vault under Token-2022” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S25 | the catch: `e instanceof RpcForbidden && e.name === 'never' ? 'refused'` (a 403 reported as read-failed) | ST “a 403”, “the latch’s cool-down” — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S26 | the reply-length check deleted | ST “a reply of the wrong length is malformed — one short, or one extra” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S27 | `newPdaRent`: the user account's rent always counted | ST “an existing allocation and user account…”, “firstPurchase (C21)…” — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S28 | `firstPurchase: !facts.exists` (C21's `purchase_count = 0` dropped) | ST “firstPurchase (C21)…” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S29 | `u32At`: `\| (data[f.offset + 3] << 24)` (the high byte flips the sign) | ST “firstPurchase (C21)…” (`0x8000_0001`) — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S30 (rev 2, review 1 M3) | `referrer: isZero(referrer) && false ? null : base58.encode(referrer)` (the zero key reported) — review 1's surviving T5-1 | ST “an existing allocation whose referrer@84 is all zero has no referrer…” — tsc 0 · RED `Tests  1 failed \| 70 passed (71)` |
| S31 (rev 2, review 1 M3) | the `inactive` return inserted above rule 7 — review 1's surviving T5-2 | ST the four `inactive, … (rule 7/8)` rows — tsc 0 · RED `Tests  4 failed \| 67 passed (71)` |
| S32 (rev 2) | the `blocked` return (while active) inserted above rule 7 | ST “blocked, the treasury absent (rule 7)”, “blocked, the USDC vault absent (rule 8)” — tsc 0 · RED `Tests  2 failed \| 69 passed (71)` |
| S33 (rev 2) | the `inactive` return inserted above rule 5 | ST the six `inactive, …` rows (rules 5–8) — tsc 0 · RED `Tests  6 failed \| 65 passed (71)` |
| A3 | `addresses.ts`: `MAINNET_VAULT_USDC_ATA` = the USDT vault's address (the state reads the wrong account) | ST 13 rows — every open and closed verdict (the USDC slot now holds a USDT account → malformed) — tsc 0, root tsc 0 · RED `Tests  14 failed \| 57 passed (71)` |
| A1 | `addresses.ts`: `MAINNET_VAULT_USDC_ATA` = the USDT vault's address | `vaultAtas.test.ts` re-derivation and literal rows — tsc 0, root tsc 0 · RED `Tests  2 failed \| 1 passed (3)` |
| A2 | `addresses.ts`: `MAINNET_VAULT_USDT_ATA` = the USDC vault's address | `vaultAtas.test.ts` the same two rows — tsc 0, root tsc 0 · RED `Tests  2 failed \| 1 passed (3)` |
| M1 | `limits.ts`: `config.minPurchaseUsd >= 0n ? …` (a 0 field kept as 0) | LT “a field of 0 is the program’s constant…”, “the program’s fallback minimum when the field is 0…” — tsc 0, root tsc 0 · RED `Tests  2 failed \| 12 passed (14)` |
| M2 | `config.maxPerUserUsd >= 0n ? …` | LT 4 rows (configured values, fallback, the per-user remainder, fallback minimum) — tsc 0, root tsc 0 · RED `Tests  4 failed \| 10 passed (14)` |
| M3 | `PRESALE_MAX_TOTAL_PER_USER_USD = 25_600_00n` | LT 5 rows — tsc 0, root tsc 0 · RED `Tests  5 failed \| 9 passed (14)` |
| M4 | `userRemainingCents: remaining` (not floored) | LT “the existing allocation is subtracted, floored at 0” — tsc 0, root tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| M5 | `checkLimits`: `q.cents <= q.minCents` (min − 0 refused) | LT 3 rows — tsc 0, root tsc 0 · RED `Tests  3 failed \| 11 passed (14)` |
| M6 | `checkLimits`: the per-user check before the per-transaction one | LT “the order: …” — tsc 0, root tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| M7 | `usdCentsForStable` rounds up | LT “a stablecoin amount floors to cents…” — tsc 0, root tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| M8 | `STAGE_PRICE_TICKS[3] = 2168n` | LT “STAGE_PRICE_TICKS = core’s float table × 10 000…” — tsc 0, root tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| M9 | `tokensFor` without `× 100` | LT “tokensFor(10 000, 0) = 666 222 518 321…” — tsc 0, root tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| M10 | `PRESALE_ALLOCATION_RENT_LAMPORTS = 1_294_560n` | LT “the new-PDA rents are (128 + length) × 6 960…” — tsc 0, root tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |
| M11 | `PRESALE_HARD_CAP_BASE = 102_400_001n * …` | LT “the hard cap and a stage’s size…” — tsc 0, root tsc 0 · RED `Tests  1 failed \| 13 passed (14)` |

53 mutations (rev 1's 49, re-run on rev 2's tree with the counts above, plus S30–S33), all red, every one compiling. **The first sweep found two greens, and both were fixed in the tests before the commit:** S6 (the treasury pin deleted) stayed green because the only row changing `sol_treasury` was also refused by rule 8 (the vault ATAs' owner is the pinned treasury, not the new one) — the row “the vault ATAs claiming the new owner” isolates the pin; A3 (the state asking for the wrong vault ATA) stayed green because the fake chain answered by position — it now answers by address, keyed by the spec's literals. Six mutants of that sweep did not compile (a removed check left an import unused: S1, S4, S5, S11, S12, S19) and were rewritten as the `&& false` / `|| true` forms above. Not covered by a mutation, stated: D7 (one minimum for every currency) — `core/presale/limits.ts` has no currency parameter, so a SOL-only floor is not expressible there; the mutation “a SOL-only floor” belongs to 1b's `quote.ts`, the first code that knows the currency.

#### Dry-run notes (Task 5)

- **Ruling: the on build keeps every module under `src/background/presale/` whole (`presaleSwitch`'s `transform`, `moduleSideEffects: 'no-treeshake'`), and `api.ts` imports `./state`** — why: §6.2 makes 1a's on build carry `layouts.ts` and `state.ts`, which nothing calls before 1b; measured without it, `layouts.ts` is missing from `app.modules.json` while `state.ts` and `limits.ts` happen to be listed, so the control would depend on the bundler's side-effect analysis. A live caller would be new presale behaviour (1a registers nothing). Off build unaffected (the entries never resolve) — cost if wrong: 1b may drop the hook once its handlers make the modules live, or keep it (dead exports kept in the on build's module graph; the minifier still removes uncalled functions).
- **Ruling: `layouts.ts` has its own size table (`FIELD_SIZES`, with `u32`), and `presaleIdl.ts`'s instruction type table is unchanged** — why: §2.1 "the type table gains `u32`" and "`presaleIdl.ts` (B1c) is unchanged" are only both true this way (adding `u32` to `typeOf` would change `PresaleArgType` in presaleIdl.ts's text and its `OUTPUT_SHA256`); an array or `defined` type in an account struct throws — cost if wrong: none.
- **Ruling: every structural rule (1–8) is checked before any verdict; `inactive` and `blocked` are returned only on a read that is otherwise well-formed, inactive before blocked** — why: "never open on doubt", and a `{inactive, stage}` answer must carry facts from a valid read; §2.1's load-bearing order (the `inactive` test before the stage-total check) is kept and tested (S14); **(rev 2, review 1 M3)** the order of every later rule is tested too — nine rows combine an inactive config or a blocked user with a broken rule 5, 6, 7 or 8 and expect `malformed` (S31–S33: the `inactive` or `blocked` return moved above rules 7–8 or above rule 5 turns them red; rev 1's S14 covered rule 4 only) — cost if wrong: a closed sale with, say, a missing vault ATA shows Q11 (unavailable) instead of Q13 (closed); both are closed.
- **(rev 2, review 1 M3) `referrer@84` all zero on an existing allocation is pinned:** a row reads an allocation whose referrer bytes are zero and expects `referrer: null` and `referrerAllocationOf` → the default key's PDA `C6TE…AWkQ` (S30: reporting the zero key `1111…1111` turns it red). Without it, C21/C22's "referrer changed" comparison and B1d-2's "offered only when no on-chain referrer" (C32) would have seen a referrer.
- **(rev 2) The new rows against rev 1's implementation** (b523457 + rev 2's `state.test.ts`): `Tests  71 passed (71)` — evidence for code that was already right (review 1's scenarios); S30–S33 prove the rows now catch their mutants.
- **Ruling: `RpcMalformed` from the reader is `read-failed`, not `malformed`** — the read failed before any account was parsed (§2.1's "any failed read … an RPC error"); `malformed` is reserved for accounts that arrived and broke a rule — cost if wrong: Q11 either way.
- **Ruling: rule 8 reads the vault through B1c's `tokenAccountInfo` (the one token-account reader) and additionally requires the SPL Token program (not Token-2022) and `initialized` (a frozen vault refused)** — §2.1 says "owned by the SPL Token program … state@108 = 1"; `tokenAccountInfo` also refuses a malformed COption tag — cost if wrong: none (stricter).
- **Ruling: `readPresaleState` takes `(reader, account, nowMs)`, not the host** — 1b's `api.ts` passes `host.deps.reader` and `host.deps.now()`; the function stays pure for C22's sign-time re-read and C39's retry — cost if wrong: a wrapper in 1b.
- **Ruling: `referrerAllocationOf(snapshot, account)` is the §2.1 "referrerAllocation" value, through core's `resolveReferrerWith` with `captured = null`** (C7) — B1d-2 adds the captured referrer.
- **Ruling: `checkLimits` / `purchaseLimits` take no currency** — D7 by construction; the D7 mutation moves to 1b's quote (stated under Step 6).
- **Finding, for the controller and 1b — the rent numbers are stale on mainnet.** `getMinimumBalanceForRentExemption` on mainnet (public RPC, 2026-10-19) answers 650 240 (0 bytes), 944 880 (58), 1 244 600 (117), 1 488 440 (165) — 5 080 lamports per byte, not 6 960 (the vault ATAs created on 2026-09-21 hold exactly 1 488 440). §2.1's `(128 + length) × 6 960` gives 1 294 560 / 1 705 200, and B1b's `SYSTEM_ACCOUNT_RENT_LAMPORTS` 890 880 / `TOKEN_ACCOUNT_RENT_LAMPORTS` 2 039 280 (core/solana/transfer.ts) are the same old rate. This task implements the spec's constants as written (tested by the spec's formula), because as **upper bounds** they are safe for every 1a use and for C9's MAX and the balance lines (they reserve a little more). They are **not** safe as an **exact** value: C11's "SOL out = amount + fee + new-PDA rent" check in 1b's simulation would then refuse every first purchase (the program pays the runtime's current rent). 1b must either take the new-PDA rent from the simulation (the created accounts' post-lamports) or the controller must update the spec's numbers; B1b's `sender-below-rent` rule is slightly stricter than the runtime as a result (safe). No code here depends on the exact value.
- **Rule 7 recorded (the spec's precondition for enabling it):** the treasury `6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd` is System-owned with 0 bytes of data (one mainnet read, slot 458 632 600); the rule is enabled.
- **For 1b:** `PresaleSnapshot` carries what `PresaleView` needs (`stage`, `limits`, `allocation` → `{exists, totalBase, bonusBase}`) plus C22's comparison inputs (`allocation.exists`, `purchaseCount`, `referrer`) and C28's "before" values (`treasuryLamports`, `vaults.*.amount`), all bigint — the view converts to decimal strings. `tokensFor` throws on a stage outside 0…9, which `state.ts` already refuses as `malformed`. `layouts.ts` is under `presale/`, so no off-build module may import it (the gate would fail).

---

### Task 6: The shared jurisdiction gate, both builds (D15) — `core/geo/fetch.ts` (`/geo/check` and `/geo/restricted-list` through the shared getter; required keys only, unknown keys ignored; a 403 told apart from every other failure), `src/background/geo/gate.ts` on core's `presaleGeoGate` (fail closed; the list cached < 10 minutes and its age re-evaluated on every call, against the server's `max_staleness_days` capped at 30 — D18; one request per answer, two when the list is due), `WalletDeps.geo()`; `BOTH_BUILDS` gains the gate and its fetcher; the spec's rent ruling and §2.2 as built, collected with every other plan-1a spec edit as **spec rev 3.1** (D16; D17, D19) (COMPLIANCE-RELEVANT)

**Spec:** B1d §2.2 (all), §1.2 "Shared, both builds", §3.6 "The gate (D15)" (the shape F12 consumes), §6.1 "Geo (1a)" and "Switch, off build" (the gate answers as in the on build), §6.2 item 1 ("both builds contain `src/background/geo/gate.ts` and `core/geo/fetch.ts`"), §8.2 rows `src/background/geo/gate.ts`, `core/geo/fetch.ts`; C12, C14, C31, C34, C38; D12, D15; review 1 M8, review 2 M3. The controller's rent ruling at Task 5 (ledger) — written into §2.1 / §3.3 here. **(rev 2)** Owner decisions D16 (the plan's spec edits collected as rev 3.1, with an explicit change list), D17 (`wallet.send` signs only a send — built in Task 3, the spec sentence here), D18 (the server's `max_staleness_days` capped at 30), D19 (B1b's `sender-below-rent` stays at 890 880); plan review 1 M1, M5.

**Verified against the sources the spec cites (read-only, 2026-10-19):** ICO coordinator at 75450df — `server.js:1443-1446` (`/geo/check` answers `geoCheckHandler`'s body with status 200), `walletRoutes.js:97-100` (`{countryCode, isVpn}`, no envelope), `services/geoService.js` (`{countryCode: 'UNKNOWN', isVpn: false}` whenever it cannot place the IP; `isVpn` hard-coded false), `server.js:1457-1467` (`/geo/restricted-list` = `200 {success: true, data: buildRestrictedList(…)}`, a stale list still served), `restrictedList.js:44-69` (`data` = `countries` (each `{code, category, basis}`), `updated_at`, `reviewed_by`, `reviewed_at`, `source`, `max_staleness_days`, `age_days`, `stale` — every key present, a missing value reported as null). Core at 923b714: `presaleGeoGate` / `evaluateListFreshness` (`core/geo/freshness.ts`) had no non-test caller; `createJsonGetter` (`deps.ts`) throws `RpcHttpError` on any non-200 and the latch throws `RpcForbidden` on a 403 (and `RpcCoolingDown`, a subclass, during the cool-down) before the status check; `timedFetch` turns silence into `RequestTimedOut` (a `RequestUnreachable`).

**Files:**
- Create: `core/geo/fetch.ts`, `extension/src/background/geo/gate.ts`
- Create (tests): `core/geo/__tests__/fetch.test.ts`, `extension/src/background/geo/__tests__/gate.test.ts`
- Modify: `core/geo/freshness.ts` (`isKnownCountry` exported — no behaviour change), `extension/src/background/deps.ts` (`WalletDeps.geo`, one gate per `browserDeps`), `extension/src/background/__tests__/fakeDeps.ts` (a `geo` that fails loudly)
- Modify (the runs): `extension/vite.config.ts` (the extension's vitest runs `../core/geo/**` too), `extension/vitest.nopresale.config.ts` (`NOPRESALE_TESTS` gains the gate test and `../core/geo/**`)
- Modify (Task 2's staged list): `extension/scripts/check-no-presale.mjs` (`BOTH_BUILDS` gains the two modules), `extension/scripts/__tests__/check-no-presale.test.mjs` (the pinned row; the synthetic builds carry them)
- Modify: `docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md` (C9, C11, §2.1 rent ruling (with D19), §3.3 step 5 and `PurchaseView.fees.rentLamports`; §1.2 and §2.2 as built (with D18); §1.3 and §1.4 for D17; **(rev 2)** the status line and the "Rev 3.1" paragraph listing every spec edit plan 1a makes — Tasks 2, 4 and 6 — one line per passage)
- Unchanged, proved: everything under `web/` and the app's `src/` (D12) — `git diff --name-only HEAD~1 HEAD` lists neither; web `npm run verify` and the root `tsc` + `jest` green (Step 4).

**Interfaces:**
- Consumes: `JsonGetter` (`core/ports.ts`); `RpcForbidden`, `RpcCoolingDown`, `RpcHttpError`, `RequestUnreachable` (`core/solana/rpc.ts`); `ListMeta`, `evaluateListFreshness`, `presaleGeoGate` (`core/geo/freshness.ts`), `RestrictedCountry` (`core/geo/restrictedList.ts`, the type only — never `BUNDLED_RESTRICTED_LIST`); `createJsonGetter`, `createForbiddenLatch`, `timedFetch(REQUEST_TIMEOUT_MS)`, `RequestTimedOut` (`deps.ts`); Task 2's `BOTH_BUILDS`; Task 1's `NOPRESALE_TESTS`.
- Produces (`core/geo/fetch.ts`):
  ```ts
  export class GeoMalformed extends Error {}                    // name 'GeoMalformed'; message '<path>: <what>'
  export const GEO_CHECK_PATH = '/geo/check', GEO_LIST_PATH = '/geo/restricted-list';
  export interface GeoLocation {countryCode: string; isVpn: boolean}
  export interface GeoList {countries: RestrictedCountry[]; meta: ListMeta}   // meta.source is always 'server'
  export function parseGeoCheck(body: unknown): GeoLocation;   // throws GeoMalformed
  export function parseRestrictedList(body: unknown): GeoList; // throws GeoMalformed
  export function fetchGeoCheck(get: JsonGetter): Promise<GeoLocation>;
  export function fetchRestrictedList(get: JsonGetter): Promise<GeoList>;
  export function isGeoRefusal(e: unknown): boolean;           // RpcForbidden (incl. RpcCoolingDown) or RpcHttpError 403
  ```
  The getter's own errors pass through unchanged.
- Produces (`core/geo/freshness.ts`): `export function isKnownCountry(code: string): boolean` (was module-private; same body).
- Produces (`src/background/geo/gate.ts`):
  ```ts
  export type GeoReason = 'refused' | 'no_check' | 'stale_list' | 'unknown_country' | 'sanctioned';
  export interface GeoAnswer {open: boolean; reason: GeoReason | null; countryCode: string | null}
  export const GEO_LIST_CACHE_MS = 600_000;
  export const GEO_MAX_STALENESS_DAYS = 30;           // (rev 2, D18) the gate evaluates min(server, 30); a missing limit stays missing
  export interface JurisdictionGate {check(): Promise<GeoAnswer>}
  export function createJurisdictionGate(io: {get: JsonGetter; now(): number}): JurisdictionGate;
  ```
  `check()` never rejects. Order: `/geo/check` (every call) → the list (cache or one request) → `presaleGeoGate` with `evaluateListFreshness(meta, new Date(now()))`, where `meta` is the list's with `maxStalenessDays` = min(the server's, `GEO_MAX_STALENESS_DAYS`) when the server sent one (D18). Any failure of either read → `refused` when `isGeoRefusal`, else `no_check`; after a failed check the list is not requested. `countryCode` = the detected code when `isKnownCountry`, else null (also null for `refused` / `no_check`). The cache: used while `0 ≤ now − at < GEO_LIST_CACHE_MS` (`at` = the request's start); a failed or malformed list is not kept; concurrent callers share one list request.
- Produces (`deps.ts`): `WalletDeps.geo(): Promise<GeoAnswer>`; `browserDeps(ext)` builds ONE gate on its shared `get` (the one latch, `REQUEST_TIMEOUT_MS`) and `now: Date.now`. **1b consumes it as `host.deps.geo()`** (`presale.view`, `prepareBuy`, `beforeSign` — §3.1, C12) **and as `deps.geo()` on the dApp path** (F12: `runSimulation` and the decision, §3.6); #50b renders `GeoAnswer` as returned. `fakeDeps().geo` throws `unexpected geo check` unless a test overrides it.
- Produces (`check-no-presale.mjs`): `BOTH_BUILDS = ['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts']` — at the end of 1a every staged list equals §6.2's 1a text.

**Why `WalletDeps.geo` and not a module of its own that 1b imports.** §6.2 requires both builds' module maps to carry `gate.ts` and `fetch.ts` in 1a, which has no caller of the gate (#23 and F12 are 1b). A module only tests import is not in the bundle (Task 2's note). `browserDeps` is shared code every background path receives, and its returned object escapes into every handler, so the gate is in both maps by construction — measured: `dist/app.modules.json` and `dist-nopresale/app.modules.json` both list `src/background/geo/gate.ts`, `../core/geo/fetch.ts`, `freshness.ts`, `classify.ts` — and it is the one place that already owns the shared getter and latch the gate must use (a second latch would let a 403 on the geo route leave Send's cool-down untouched — W1). It is also exactly the shape both 1b consumers already receive (`host.deps`, the dApp handlers' `deps`).

- [ ] **Step 1: Write the failing tests.**

`core/geo/__tests__/fetch.test.ts` (new — runs in web's vitest, which includes `../core/geo/**`, and from this task in both of the extension's runs):

````ts
import {GEO_CHECK_PATH, GEO_LIST_PATH, GeoMalformed, fetchGeoCheck, fetchRestrictedList, isGeoRefusal, parseGeoCheck, parseRestrictedList} from '../fetch';
import {RequestUnreachable, RpcCoolingDown, RpcForbidden, RpcHttpError} from '../../solana/rpc';
import type {JsonGetter} from '../../ports';

// The live list's shape (coordinator restrictedList.js at 75450df): an envelope, per-entry `basis`, every age key present.
const LIST = {
  success: true,
  data: {
    countries: [
      {code: 'KP', category: 'sanctioned', basis: 'OFAC North Korea Sanctions'},
      {code: 'CN', category: 'restricted', basis: 'our risk policy'},
      {code: 'ZW', category: 'restricted', basis: null},
    ],
    updated_at: '2026-10-10',
    reviewed_by: 'a reviewer',
    reviewed_at: '2026-10-11',
    source: 'OFAC sanctions programs',
    max_staleness_days: 30,
    age_days: 9,
    stale: false,
  },
};
const withData = (over: Record<string, unknown>) => ({...LIST, data: {...LIST.data, ...over}});
const without = (key: string) => {
  const data: Record<string, unknown> = {...LIST.data};
  delete data[key];
  return {...LIST, data};
};

describe('parseGeoCheck (B1d §2.2, C34)', () => {
  it('reads {countryCode, isVpn} at the top level (positive control)', () => {
    expect(parseGeoCheck({countryCode: 'SI', isVpn: false})).toEqual({countryCode: 'SI', isVpn: false});
  });

  it('ignores a key it does not need', () => {
    expect(parseGeoCheck({countryCode: 'SI', isVpn: true, city: 'Ljubljana', allowed: false})).toEqual({countryCode: 'SI', isVpn: true});
  });

  it('keeps an unknown country as written: the gate, not the parser, decides it is unknown', () => {
    expect(parseGeoCheck({countryCode: 'UNKNOWN', isVpn: false}).countryCode).toBe('UNKNOWN');
    expect(parseGeoCheck({countryCode: '', isVpn: false}).countryCode).toBe('');
  });

  it.each([
    ['isVpn missing', {countryCode: 'SI'}],
    ['isVpn a string', {countryCode: 'SI', isVpn: 'false'}],
    ['isVpn null', {countryCode: 'SI', isVpn: null}],
    ['countryCode missing', {isVpn: false}],
    ['countryCode a number', {countryCode: 705, isVpn: false}],
    ['an envelope', {success: true, data: {countryCode: 'SI', isVpn: false}}],
    ['null', null],
    ['an array', [{countryCode: 'SI', isVpn: false}]],
    ['a string', 'SI'],
  ])('%s → GeoMalformed', (_, body) => {
    expect(() => parseGeoCheck(body)).toThrow(GeoMalformed);
  });
});

describe('parseRestrictedList (B1d §2.2, C34, review 1 M8)', () => {
  it('reads the live shape: per-entry basis and the envelope extras ignored (positive control)', () => {
    expect(parseRestrictedList(LIST)).toEqual({
      countries: [
        {code: 'KP', category: 'sanctioned'},
        {code: 'CN', category: 'restricted'},
        {code: 'ZW', category: 'restricted'},
      ],
      meta: {source: 'server', updatedAt: '2026-10-10', reviewedAt: '2026-10-11', maxStalenessDays: 30, serverStale: false},
    });
  });

  it('a key the coordinator adds tomorrow is ignored, at either level', () => {
    const extra = {...withData({region_notes: {KP: 'x'}}), served_by: 'node-2'};
    expect(parseRestrictedList(extra)).toEqual(parseRestrictedList(LIST));
  });

  it('a null age key is not malformed: it is absent from the meta (which is stale downstream)', () => {
    const nulls = withData({updated_at: null, reviewed_at: null, max_staleness_days: null, stale: null});
    expect(parseRestrictedList(nulls).meta).toEqual({source: 'server'});
  });

  it.each(['updated_at', 'reviewed_at', 'max_staleness_days', 'stale'])('an absent %s is read as null, not as malformed', key => {
    expect(() => parseRestrictedList(without(key))).not.toThrow();
  });

  it.each([
    ['a non-object body', 'list'],
    ['null', null],
    ['an array body', [LIST]],
    ['success false', {...LIST, success: false}],
    ['success missing', {data: LIST.data}],
    ['success "true"', {...LIST, success: 'true'}],
    ['data missing', {success: true}],
    ['data an array', {success: true, data: [LIST.data]}],
    ['countries missing', without('countries')],
    ['countries empty', withData({countries: []})],
    ['countries an object', withData({countries: {KP: 'sanctioned'}})],
    ['an entry not an object', withData({countries: ['KP']})],
    ['an entry without code', withData({countries: [{category: 'sanctioned'}]})],
    ['a lowercase code', withData({countries: [{code: 'kp', category: 'sanctioned'}]})],
    ['a three-letter code', withData({countries: [{code: 'PRK', category: 'sanctioned'}]})],
    ['an unknown category', withData({countries: [{code: 'KP', category: 'embargoed'}]})],
    ['a category missing', withData({countries: [{code: 'KP'}]})],
    ['updated_at a number', withData({updated_at: 20261010})],
    ['reviewed_at an object', withData({reviewed_at: {day: '2026-10-11'}})],
    ['max_staleness_days a string', withData({max_staleness_days: '30'})],
    ['stale a string', withData({stale: 'false'})],
  ])('%s → GeoMalformed', (_, body) => {
    expect(() => parseRestrictedList(body)).toThrow(GeoMalformed);
  });

  it('one bad entry among good ones refuses the whole list', () => {
    const one = withData({countries: [...LIST.data.countries, {code: 'IR', category: 'Sanctioned'}]});
    expect(() => parseRestrictedList(one)).toThrow(/countries\[3\]\.category/);
  });
});

describe('fetchGeoCheck / fetchRestrictedList', () => {
  it('GET the two bare paths through the given getter, one request each', async () => {
    const paths: string[] = [];
    const get: JsonGetter = {
      get: async <T>(path: string): Promise<T> => {
        paths.push(path);
        return (path === GEO_CHECK_PATH ? {countryCode: 'SI', isVpn: false} : LIST) as T;
      },
    };
    expect(await fetchGeoCheck(get)).toEqual({countryCode: 'SI', isVpn: false});
    expect((await fetchRestrictedList(get)).countries).toHaveLength(3);
    expect(paths).toEqual(['/geo/check', '/geo/restricted-list']);
    expect([GEO_CHECK_PATH, GEO_LIST_PATH]).toEqual(paths);
  });

  it("a getter's error passes through unchanged — the caller tells a 403 from the rest", async () => {
    const e = new RpcForbidden('/geo/check');
    const get: JsonGetter = {get: async () => Promise.reject(e)};
    await expect(fetchGeoCheck(get)).rejects.toBe(e);
    await expect(fetchRestrictedList(get)).rejects.toBe(e);
  });
});

describe('isGeoRefusal (the 403 distinction, Q12 / Q27)', () => {
  it('a 403, the latch’s cool-down after one, and a getter’s HTTP 403 are refusals', () => {
    expect(isGeoRefusal(new RpcForbidden('/geo/check'))).toBe(true);
    expect(isGeoRefusal(new RpcCoolingDown('/geo/check'))).toBe(true);
    expect(isGeoRefusal(new RpcHttpError('/geo/check', 403))).toBe(true);
  });

  it('every other failure is not (negative controls)', () => {
    expect(isGeoRefusal(new RpcHttpError('/geo/check', 404))).toBe(false);
    expect(isGeoRefusal(new RpcHttpError('/geo/check', 500))).toBe(false);
    expect(isGeoRefusal(new RequestUnreachable('/geo/check', 'no answer within 20000 ms; aborted'))).toBe(false);
    expect(isGeoRefusal(new GeoMalformed('/geo/check', 'isVpn is not a boolean'))).toBe(false);
    expect(isGeoRefusal(new Error('403'))).toBe(false);
    expect(isGeoRefusal({status: 403})).toBe(false);
  });
});
````

`extension/src/background/geo/__tests__/gate.test.ts` (new — the gate over a scripted getter, then `browserDeps().geo` over a stubbed `fetch`; in `NOPRESALE_TESTS`, so it runs in both builds' runs):

````ts
import {GEO_LIST_CACHE_MS, GEO_MAX_STALENESS_DAYS, createJurisdictionGate, type GeoAnswer} from '../gate';
import {REQUEST_TIMEOUT_MS, RequestTimedOut, browserDeps} from '../../deps';
import {fakeExt} from '../../__tests__/fakeExt';
import {RequestUnreachable, RpcCoolingDown, RpcForbidden, RpcHttpError} from '../../../../../core/solana/rpc';
import type {JsonGetter} from '../../../../../core/ports';

// B1d §2.2, C12, C34, D15. This file runs in both vitest runs (NOPRESALE_TESTS): the gate answers the same in both builds.
const T0 = Date.parse('2026-10-19T12:00:00Z');
const CHECK = (countryCode: string, isVpn = false): Record<string, unknown> => ({countryCode, isVpn});
const COUNTRIES = [
  {code: 'CU', category: 'sanctioned', basis: 'OFAC Cuba Sanctions'},
  {code: 'IR', category: 'sanctioned', basis: 'OFAC Iran Sanctions'},
  {code: 'KP', category: 'sanctioned', basis: 'OFAC North Korea Sanctions'},
  {code: 'SY', category: 'sanctioned', basis: 'OFAC PAARSS (Syria)'},
  {code: 'RU', category: 'sanctioned', basis: 'our risk policy'},
  {code: 'CN', category: 'restricted', basis: 'our risk policy'},
  {code: 'ZW', category: 'restricted', basis: null},
];
const LIST = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  success: true,
  data: {countries: COUNTRIES, updated_at: '2026-10-10', reviewed_by: 'a reviewer', reviewed_at: '2026-10-10', source: 'OFAC', max_staleness_days: 30, age_days: 9, stale: false, ...over},
});

type Answer = unknown | (() => unknown);
/** A getter that answers each path from a script (a value, or a function that throws or returns), recording every request. */
function scripted(check: Answer, list: Answer) {
  const paths: string[] = [];
  const answers: Record<string, Answer> = {'/geo/check': check, '/geo/restricted-list': list};
  const get: JsonGetter = {
    async get<T>(path: string): Promise<T> {
      paths.push(path);
      if (!(path in answers)) throw new Error(`unexpected GET ${path}`);
      const a = answers[path];
      return (typeof a === 'function' ? (a as () => unknown)() : a) as T;
    },
  };
  return {get, paths, answers};
}
const clock = {t: T0};
const gateOf = (s: ReturnType<typeof scripted>) => createJurisdictionGate({get: s.get, now: () => clock.t});
const thrower = (e: Error) => () => {
  throw e;
};
const answer = async (check: Answer, list: Answer): Promise<GeoAnswer> => gateOf(scripted(check, list)).check();

beforeEach(() => {
  clock.t = T0;
});

describe('the jurisdiction gate — every reason (B1d §2.2, §6.1 "Geo")', () => {
  it('a fresh list and SI → open, with the country (positive control); one request per route', async () => {
    const s = scripted(CHECK('SI'), LIST());
    expect(await gateOf(s).check()).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list']);
  });

  it('KP → sanctioned; KP behind a VPN flag → sanctioned (sanctioned wins over VPN)', async () => {
    expect(await answer(CHECK('KP'), LIST())).toEqual({open: false, reason: 'sanctioned', countryCode: 'KP'});
    expect(await answer(CHECK('KP', true), LIST())).toEqual({open: false, reason: 'sanctioned', countryCode: 'KP'});
  });

  it.each(['CU', 'IR', 'SY', 'RU'])('%s (sanctioned on the served list) → sanctioned', async code => {
    expect((await answer(CHECK(code), LIST())).reason).toBe('sanctioned');
  });

  it('CN and ZW (restricted, not sanctioned) → open — OFAC-only; an allowed country behind a VPN → open', async () => {
    expect(await answer(CHECK('CN'), LIST())).toEqual({open: true, reason: null, countryCode: 'CN'});
    expect(await answer(CHECK('ZW'), LIST())).toEqual({open: true, reason: null, countryCode: 'ZW'});
    expect(await answer(CHECK('SI', true), LIST())).toEqual({open: true, reason: null, countryCode: 'SI'});
  });

  it('the served list decides, not a list of our own: a country the server marks sanctioned closes', async () => {
    const list = LIST({countries: [{code: 'SI', category: 'sanctioned'}]});
    expect(await answer(CHECK('SI'), list)).toEqual({open: false, reason: 'sanctioned', countryCode: 'SI'});
    expect(await answer(CHECK('KP'), list)).toEqual({open: true, reason: null, countryCode: 'KP'});
  });

  it.each(['UNKNOWN', '', 'XX', 'ZZ', 'si', 'S', 'SVN'])('countryCode %j → unknown_country, no country reported', async code => {
    expect(await answer(CHECK(code), LIST())).toEqual({open: false, reason: 'unknown_country', countryCode: null});
  });

  it('a list 30 days old is fresh (the boundary); 31 days old → stale_list, the known country still reported', async () => {
    expect(await answer(CHECK('SI'), LIST({updated_at: '2026-09-19', reviewed_at: '2026-09-19'}))).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(await answer(CHECK('SI'), LIST({updated_at: '2026-09-18', reviewed_at: '2026-09-18'}))).toEqual({open: false, reason: 'stale_list', countryCode: 'SI'});
  });

  it.each<[string, number | undefined, string, boolean]>([
    ['29: a list 29 days old is fresh', 29, '2026-09-20', true],
    ['29: 30 days old → stale (the server’s stricter limit holds)', 29, '2026-09-19', false],
    ['30: 30 days old is fresh', 30, '2026-09-19', true],
    ['30: 31 days old → stale', 30, '2026-09-18', false],
    ['31: 30 days old is fresh', 31, '2026-09-19', true],
    ['31: 31 days old → stale (capped at 30)', 31, '2026-09-18', false],
    ['365: 31 days old → stale (capped at 30)', 365, '2026-09-18', false],
    ['missing: a list of today → stale (a missing limit is not capped into one)', undefined, '2026-10-19', false],
  ])('D18: max_staleness_days %s', async (_, limit, day, open) => {
    expect(GEO_MAX_STALENESS_DAYS).toBe(30);
    const list = LIST({updated_at: day, reviewed_at: day, max_staleness_days: limit});
    expect(await answer(CHECK('SI'), list)).toEqual(open ? {open: true, reason: null, countryCode: 'SI'} : {open: false, reason: 'stale_list', countryCode: 'SI'});
  });

  it('a stale list closes before the country is looked at: an unknown country is not reported', async () => {
    expect(await answer(CHECK('UNKNOWN'), LIST({updated_at: null, reviewed_at: null}))).toEqual({open: false, reason: 'stale_list', countryCode: null});
  });

  it.each([
    ['missing dates', LIST({updated_at: undefined, reviewed_at: undefined})],
    ['null dates', LIST({updated_at: null, reviewed_at: null})],
    ['unparsable dates', LIST({updated_at: 'yesterday', reviewed_at: '10/10/2026'})],
    ['a date two days ahead', LIST({updated_at: '2026-10-21', reviewed_at: '2026-10-10'})],
    ['stale: false on a list past its limit', LIST({updated_at: '2026-04-04', reviewed_at: '2026-04-04', stale: false})],
    ['stale: true on a young list', LIST({stale: true})],
    ['max_staleness_days null', LIST({max_staleness_days: null})],
    ['max_staleness_days missing', LIST({max_staleness_days: undefined})],
    ['max_staleness_days 0', LIST({max_staleness_days: 0})],
  ])('%s → stale_list', async (_, list) => {
    expect(await answer(CHECK('SI'), list)).toEqual({open: false, reason: 'stale_list', countryCode: 'SI'});
  });

  it.each([
    ['/geo/check 500', thrower(new RpcHttpError('/geo/check', 500)), LIST()],
    ['/geo/check timed out', thrower(new RequestTimedOut('https://api.noc-tura.io/api/v1/geo/check', REQUEST_TIMEOUT_MS)), LIST()],
    ['/geo/check unreachable', thrower(new RequestUnreachable('/geo/check', 'the request failed (offline)')), LIST()],
    ['/geo/restricted-list 404', CHECK('SI'), thrower(new RpcHttpError('/geo/restricted-list', 404))],
    ['/geo/restricted-list timed out', CHECK('SI'), thrower(new RequestTimedOut('https://api.noc-tura.io/api/v1/geo/restricted-list', REQUEST_TIMEOUT_MS))],
  ])('%s → no_check; there is no fallback list to open on', async (_, check, list) => {
    expect(await answer(check, list)).toEqual({open: false, reason: 'no_check', countryCode: null});
  });

  it.each([
    ['/geo/check 403', thrower(new RpcForbidden('/geo/check')), LIST()],
    ['/geo/restricted-list 403', CHECK('SI'), thrower(new RpcForbidden('/geo/restricted-list'))],
    ['the latch cooling down', thrower(new RpcCoolingDown('/geo/check')), LIST()],
    ["another getter's HTTP 403", thrower(new RpcHttpError('/geo/check', 403)), LIST()],
  ])('%s → refused (not no_check)', async (_, check, list) => {
    expect(await answer(check, list)).toEqual({open: false, reason: 'refused', countryCode: null});
  });

  it('a failed /geo/check sends no list request — the answer is already closed', async () => {
    const refused = scripted(thrower(new RpcForbidden('/geo/check')), LIST());
    await gateOf(refused).check();
    expect(refused.paths).toEqual(['/geo/check']);
    const silent = scripted(thrower(new RequestTimedOut('/geo/check', REQUEST_TIMEOUT_MS)), LIST());
    await gateOf(silent).check();
    expect(silent.paths).toEqual(['/geo/check']);
  });
});

describe('parsing at the gate (C34, review 1 M8)', () => {
  it('a check body with an extra key, a list entry with basis and the envelope extras → parsed, open', async () => {
    const list = LIST({countries: [...COUNTRIES, {code: 'BY', category: 'restricted', basis: 'x', since: '2022'}], reviewed_by: 'r', source: 's', age_days: 9, extra: true});
    expect(await answer({...CHECK('SI'), city: 'Ljubljana', allowed: false}, {...list, served_by: 'node-2'})).toEqual({open: true, reason: null, countryCode: 'SI'});
  });

  it('max_staleness_days null → parsed, then stale (not no_check)', async () => {
    expect((await answer(CHECK('SI'), LIST({max_staleness_days: null}))).reason).toBe('stale_list');
  });

  it.each([
    ['isVpn missing', {countryCode: 'SI'}, LIST()],
    ['isVpn a string', {countryCode: 'SI', isVpn: 'false'}, LIST()],
    ['a non-object check body', 'SI', LIST()],
    ['a list without countries', CHECK('SI'), {success: true, data: {updated_at: '2026-10-10', max_staleness_days: 30}}],
    ['a list missing a required field (an entry without category)', CHECK('SI'), LIST({countries: [{code: 'KP'}]})],
    ['a list with success: false', CHECK('SI'), {...LIST(), success: false}],
    ['a non-object list body', CHECK('SI'), null],
  ])('%s → no_check', async (_, check, list) => {
    expect(await answer(check, list)).toEqual({open: false, reason: 'no_check', countryCode: null});
  });
});

describe('the cache and the request budget (C12, review 2 M3)', () => {
  it('/geo/check is asked on every call; the list once per 10 minutes', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    await gate.check();
    clock.t = T0 + 60_000;
    await gate.check();
    clock.t = T0 + GEO_LIST_CACHE_MS - 1;
    expect(await gate.check()).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list', '/geo/check', '/geo/check']);
    expect(GEO_LIST_CACHE_MS).toBe(600_000);
  });

  it('at exactly 10 minutes the list is read again (the boundary)', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    await gate.check();
    clock.t = T0 + GEO_LIST_CACHE_MS;
    await gate.check();
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list', '/geo/check', '/geo/restricted-list']);
  });

  it('a clock that went backwards does not make a cached list young — it is read again', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    await gate.check();
    clock.t = T0 - 1;
    await gate.check();
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list', '/geo/check', '/geo/restricted-list']);
  });

  it("a cached list's age is evaluated against the clock every time: it goes stale inside the cache window, without a request", async () => {
    clock.t = Date.parse('2026-10-18T23:55:00Z');
    const s = scripted(CHECK('SI'), LIST({updated_at: '2026-09-18', reviewed_at: '2026-09-18'}));
    const gate = gateOf(s);
    expect(await gate.check()).toEqual({open: true, reason: null, countryCode: 'SI'});
    clock.t = Date.parse('2026-10-19T00:01:00Z');
    expect(await gate.check()).toEqual({open: false, reason: 'stale_list', countryCode: 'SI'});
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list', '/geo/check']);
  });

  it('a failed or malformed list is not cached: the next call reads it again, and opens once it answers', async () => {
    const s = scripted(CHECK('SI'), thrower(new RpcHttpError('/geo/restricted-list', 404)));
    const gate = gateOf(s);
    expect((await gate.check()).reason).toBe('no_check');
    s.answers['/geo/restricted-list'] = LIST({countries: []});
    expect((await gate.check()).reason).toBe('no_check');
    s.answers['/geo/restricted-list'] = LIST();
    expect((await gate.check()).open).toBe(true);
    expect(s.paths.filter(p => p === '/geo/restricted-list')).toHaveLength(3);
  });

  it('a cached list past 10 minutes whose re-read fails → no_check (or refused), never the expired list; the next call reads it again (review 1 M1)', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    expect((await gate.check()).open).toBe(true);
    clock.t = T0 + GEO_LIST_CACHE_MS;
    s.answers['/geo/restricted-list'] = thrower(new RpcHttpError('/geo/restricted-list', 500));
    expect(await gate.check()).toEqual({open: false, reason: 'no_check', countryCode: null});
    s.answers['/geo/restricted-list'] = thrower(new RpcForbidden('/geo/restricted-list'));
    expect(await gate.check()).toEqual({open: false, reason: 'refused', countryCode: null});
    s.answers['/geo/restricted-list'] = LIST();
    expect(await gate.check()).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(s.paths.filter(p => p === '/geo/restricted-list')).toHaveLength(4);
  });

  it('a cached list does not open a failed check', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    expect((await gate.check()).open).toBe(true);
    s.answers['/geo/check'] = thrower(new RequestTimedOut('/geo/check', REQUEST_TIMEOUT_MS));
    expect(await gate.check()).toEqual({open: false, reason: 'no_check', countryCode: null});
    s.answers['/geo/check'] = thrower(new RpcForbidden('/geo/check'));
    expect(await gate.check()).toEqual({open: false, reason: 'refused', countryCode: null});
  });

  it('two callers at once (#23 and F12) share one list request', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    const [a, b] = await Promise.all([gate.check(), gate.check()]);
    expect([a.open, b.open]).toEqual([true, true]);
    expect(s.paths.filter(p => p === '/geo/restricted-list')).toHaveLength(1);
    expect(s.paths.filter(p => p === '/geo/check')).toHaveLength(2);
  });
});

describe('browserDeps().geo — the real getter, the shared 403 latch (D15: in both builds)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // A stubbed fetch: nothing here leaves the process.
  const respond = (byPath: Record<string, {status: number; body?: unknown}>, urls: string[]) =>
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      const r = byPath[url.replace('https://api.noc-tura.io/api/v1', '')];
      if (r === undefined) throw new Error(`unexpected fetch ${url}`);
      return {status: r.status, json: async () => r.body};
    });

  it('both GETs under API_BASE, answered → open (positive control)', async () => {
    const urls: string[] = [];
    respond({'/geo/check': {status: 200, body: CHECK('SI')}, '/geo/restricted-list': {status: 200, body: LIST({updated_at: new Date().toISOString().slice(0, 10)})}}, urls);
    expect(await browserDeps(fakeExt()).geo()).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(urls).toEqual(['https://api.noc-tura.io/api/v1/geo/check', 'https://api.noc-tura.io/api/v1/geo/restricted-list']);
  });

  it('a 403 on /geo/check → refused, and it trips the one latch: the next geo call and a price read send nothing', async () => {
    const urls: string[] = [];
    respond({'/geo/check': {status: 403}, '/wallet/prices?ids=solana,usd-coin,tether': {status: 200, body: {}}}, urls);
    const deps = browserDeps(fakeExt());
    expect(await deps.geo()).toEqual({open: false, reason: 'refused', countryCode: null});
    expect(await deps.geo()).toEqual({open: false, reason: 'refused', countryCode: null});
    await expect(deps.prices()).rejects.toBeInstanceOf(RpcCoolingDown);
    expect(urls).toEqual(['https://api.noc-tura.io/api/v1/geo/check']);
  });

  it('a non-403 failure (404 on the list) → no_check, and trips nothing', async () => {
    const urls: string[] = [];
    respond({'/geo/check': {status: 200, body: CHECK('SI')}, '/geo/restricted-list': {status: 404}, '/stats': {status: 200, body: {success: true, data: {currentStage: 0}}}}, urls);
    const deps = browserDeps(fakeExt());
    expect(await deps.geo()).toEqual({open: false, reason: 'no_check', countryCode: null});
    expect(await deps.stagePrice()).toBe(0.1501);
    expect(urls).toHaveLength(3);
  });

  it('a silent coordinator → no_check after REQUEST_TIMEOUT_MS (a timeout is not a refusal)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const settled = browserDeps(fakeExt()).geo();
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await settled).toEqual({open: false, reason: 'no_check', countryCode: null});
  });
});
````

`extension/scripts/__tests__/check-no-presale.test.mjs` (Task 2's staged row for `BOTH_BUILDS`; the synthetic builds carry the gate like every shared module):

````diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index c8f22c2..1abab41 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -24,7 +24,7 @@ const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
 const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/app.modules.0b79442.json'), 'utf8'));
 const map = ids => ({chunks: {'background.js': ids}});
 const without = (m, id) => ({...m, chunks: Object.fromEntries(Object.entries(m.chunks).map(([f, ids]) => [f, ids.filter(i => i !== id)]))});
-const SHARED = ['src/background/index.ts', 'src/background/intents.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];
+const SHARED = ['src/background/index.ts', 'src/background/intents.ts', 'src/background/geo/gate.ts', '../core/geo/fetch.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];
 
 // B1d §6.2 item 1 (C38, D15): the off build's module rule — an allowlist for core/presale/**, core/geo/** whole.
 describe('the off-build module rule', () => {
@@ -82,7 +82,10 @@ describe('the off-build module rule', () => {
 describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
   it('the on build must carry the three on-path entries — the plugin maps something real — and the program state (Task 5)', () => {
     expect(ON_BUILD).toEqual([...PRESALE_ENTRIES.map(e => e.entry), 'src/background/presale/layouts.ts', 'src/background/presale/state.ts', 'core/presale/limits.ts']);
-    expect(BOTH_BUILDS).toEqual(['src/background/intents.ts']);
+  });
+
+  it('both builds must carry the intent-kind registry (Task 3) and the jurisdiction gate with its fetcher (Task 6, D15)', () => {
+    expect(BOTH_BUILDS).toEqual(['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts']);
   });
 
   it('missingModules names each required module a map does not carry', () => {
````

- [ ] **Step 2: Run them on the previous task's tree (rev 1: b523457; rev 2 re-ran it on a76655e with the same counts) — red.**

Run (in `extension/`): `npx vitest run src/background/geo/__tests__/gate.test.ts scripts/__tests__/check-no-presale.test.mjs`
Expected: `Test Files  2 failed (2)` · `Tests  1 failed | 36 passed (37)` — `gate.test.ts`: `Error: Cannot find module '../gate'`; `check-no-presale.test.mjs` › “both builds must carry the intent-kind registry (Task 3) and the jurisdiction gate with its fetcher (Task 6, D15)”: `expected [ 'src/background/intents.ts' ] to deeply equal [ 'src/background/intents.ts', …(2) ]`.

Run (in `web/`): `npx vitest run ../core/geo/__tests__/fetch.test.ts`
Expected: `Test Files  1 failed (1)` · `Tests  no tests` — `Failed to resolve import "../fetch"`.

**(rev 2) The new gate tests against rev 1's implementation** (f941887 + rev 2's `gate.test.ts`): `Tests  8 failed | 57 passed (65)` — the eight D18 rows (rev 1 has no `GEO_MAX_STALENESS_DAYS`; D1 below shows that without the cap exactly the 31- and 365-day rows go red); the M1 row passes, as it must — evidence for code that was already right (review 1's scenario), and K6 proves it now catches its mutant.

- [ ] **Step 3: Implement.**

`core/geo/fetch.ts` (new):

````ts
import type {JsonGetter} from '../ports';
import {RpcForbidden, RpcHttpError} from '../solana/rpc';
import type {ListMeta} from './freshness';
import type {RestrictedCountry} from './restrictedList';

/**
 * The jurisdiction gate's two coordinator reads (B1d §2.2): `/geo/check` and `/geo/restricted-list`, through the caller's
 * getter (the extension's goes through the shared 403 latch). Each body is parsed for the keys the gate needs and
 * nothing else (C34): a key the coordinator adds is ignored, a required key that is missing or of the wrong type is
 * `GeoMalformed`. Nothing is cached or retried here, and there is no bundled fallback: a failed read is the caller's
 * closed answer. Used only by the extension in B1d (D12, C14).
 */
export class GeoMalformed extends Error {
  constructor(path: string, what: string) {
    super(`${path}: ${what}`);
    this.name = 'GeoMalformed';
  }
}

export const GEO_CHECK_PATH = '/geo/check';
export const GEO_LIST_PATH = '/geo/restricted-list';

export interface GeoLocation {
  countryCode: string;
  isVpn: boolean;
}

export interface GeoList {
  countries: RestrictedCountry[];
  meta: ListMeta;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `{countryCode: string, isVpn: boolean}` at the top level — no envelope (the live contract). */
export function parseGeoCheck(body: unknown): GeoLocation {
  if (!isObject(body)) throw new GeoMalformed(GEO_CHECK_PATH, 'the body is not an object');
  const {countryCode, isVpn} = body;
  if (typeof countryCode !== 'string') throw new GeoMalformed(GEO_CHECK_PATH, 'countryCode is not a string');
  if (typeof isVpn !== 'boolean') throw new GeoMalformed(GEO_CHECK_PATH, 'isVpn is not a boolean');
  return {countryCode, isVpn};
}

/** An age key: absent or null is "not reported" (stale downstream); any other type than its own is malformed. */
function optional<T>(data: Record<string, unknown>, key: string, type: 'string' | 'number' | 'boolean'): T | undefined {
  const v = data[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== type) throw new GeoMalformed(GEO_LIST_PATH, `${key} is neither a ${type} nor null`);
  return v as T;
}

/**
 * `{success: true, data: {countries: [{code, category}, …], updated_at, reviewed_at, max_staleness_days, stale}}`.
 * `countries` must be a non-empty array of `{code: /^[A-Z]{2}$/, category: 'sanctioned' | 'restricted'}`; the four age
 * keys are each their type or null (the coordinator reports a missing value as null) and reach `evaluateListFreshness`
 * as absent, which is stale. The list is the server's (`source: 'server'`): the extension has no bundled one.
 */
export function parseRestrictedList(body: unknown): GeoList {
  if (!isObject(body)) throw new GeoMalformed(GEO_LIST_PATH, 'the body is not an object');
  if (body.success !== true) throw new GeoMalformed(GEO_LIST_PATH, 'success is not true');
  const data = body.data;
  if (!isObject(data)) throw new GeoMalformed(GEO_LIST_PATH, 'data is not an object');
  const raw = data.countries;
  if (!Array.isArray(raw) || raw.length === 0) throw new GeoMalformed(GEO_LIST_PATH, 'countries is not a non-empty array');
  const countries = raw.map((c: unknown, i): RestrictedCountry => {
    if (!isObject(c)) throw new GeoMalformed(GEO_LIST_PATH, `countries[${i}] is not an object`);
    const {code, category} = c;
    if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) throw new GeoMalformed(GEO_LIST_PATH, `countries[${i}].code is not two capital letters`);
    if (category !== 'sanctioned' && category !== 'restricted') throw new GeoMalformed(GEO_LIST_PATH, `countries[${i}].category is unknown`);
    return {code, category};
  });
  const meta: ListMeta = {source: 'server'};
  const updatedAt = optional<string>(data, 'updated_at', 'string');
  const reviewedAt = optional<string>(data, 'reviewed_at', 'string');
  const maxStalenessDays = optional<number>(data, 'max_staleness_days', 'number');
  const serverStale = optional<boolean>(data, 'stale', 'boolean');
  if (updatedAt !== undefined) meta.updatedAt = updatedAt;
  if (reviewedAt !== undefined) meta.reviewedAt = reviewedAt;
  if (maxStalenessDays !== undefined) meta.maxStalenessDays = maxStalenessDays;
  if (serverStale !== undefined) meta.serverStale = serverStale;
  return {countries, meta};
}

export async function fetchGeoCheck(get: JsonGetter): Promise<GeoLocation> {
  return parseGeoCheck(await get.get<unknown>(GEO_CHECK_PATH));
}

export async function fetchRestrictedList(get: JsonGetter): Promise<GeoList> {
  return parseRestrictedList(await get.get<unknown>(GEO_LIST_PATH));
}

/**
 * Whether a failed geo read was the coordinator refusing this network — a 403, or the shared latch's cool-down after
 * one (`RpcCoolingDown` is an `RpcForbidden`) — rather than no answer or a bad one. The popup says the two apart
 * (Q12 / Q27 against "the region check is unavailable"); both close the gate.
 */
export function isGeoRefusal(e: unknown): boolean {
  return e instanceof RpcForbidden || (e instanceof RpcHttpError && e.status === 403);
}
````

`extension/src/background/geo/gate.ts` (new):

````ts
import type {JsonGetter} from '../../../../core/ports';
import {fetchGeoCheck, fetchRestrictedList, isGeoRefusal, type GeoList, type GeoLocation} from '../../../../core/geo/fetch';
import {evaluateListFreshness, isKnownCountry, presaleGeoGate} from '../../../../core/geo/freshness';

/**
 * B1d §2.2: the jurisdiction gate — shared compliance code, in both builds (D15). #23 asks it through `presale/` and
 * F12 through `dapp/` (both B1d-1b), via `WalletDeps.geo`; it imports nothing under a presale directory.
 *
 * It fails closed: a 403 (or the shared latch's cool-down) is `refused`; any other failed or malformed read is
 * `no_check`; otherwise core's `presaleGeoGate` decides — a stale list, an unknown or empty country, a sanctioned
 * country (whatever `isVpn` says). `/geo/check` is asked on every call; the list is kept in memory for less than
 * GEO_LIST_CACHE_MS and its age is evaluated against the clock on every call (C12), against the server's
 * `max_staleness_days` capped at GEO_MAX_STALENESS_DAYS (D18). There is no bundled list.
 */
export type GeoReason = 'refused' | 'no_check' | 'stale_list' | 'unknown_country' | 'sanctioned';

export interface GeoAnswer {
  open: boolean;
  reason: GeoReason | null;
  /** The detected country when it is a known one (#50b's region card); null when there is none to show. */
  countryCode: string | null;
}

export const GEO_LIST_CACHE_MS = 10 * 60_000;
/** D18: the gate judges a list's age against min(the server's `max_staleness_days`, 30); a missing limit stays missing (stale). */
export const GEO_MAX_STALENESS_DAYS = 30;

export interface JurisdictionGate {
  check(): Promise<GeoAnswer>;
}

export function createJurisdictionGate(io: {get: JsonGetter; now(): number}): JurisdictionGate {
  let cached: {at: number; list: GeoList} | null = null;
  let reading: Promise<GeoList> | null = null;

  const list = (): Promise<GeoList> => {
    const at = io.now();
    if (cached !== null && at >= cached.at && at - cached.at < GEO_LIST_CACHE_MS) return Promise.resolve(cached.list);
    // One list request for callers that arrive together; a failed or malformed read is not kept.
    reading ??= fetchRestrictedList(io.get).then(
      l => {
        cached = {at, list: l};
        reading = null;
        return l;
      },
      (e: unknown) => {
        reading = null;
        throw e;
      },
    );
    return reading;
  };

  return {
    async check() {
      let location: GeoLocation;
      let restricted: GeoList;
      try {
        location = await fetchGeoCheck(io.get);
        restricted = await list();
      } catch (e) {
        return {open: false, reason: isGeoRefusal(e) ? 'refused' : 'no_check', countryCode: null};
      }
      const limit = restricted.meta.maxStalenessDays;
      const meta = limit === undefined ? restricted.meta : {...restricted.meta, maxStalenessDays: Math.min(limit, GEO_MAX_STALENESS_DAYS)};
      const g = presaleGeoGate({freshness: evaluateListFreshness(meta, new Date(io.now())), location, restricted: restricted.countries});
      return {open: g.open, reason: g.reason, countryCode: isKnownCountry(location.countryCode) ? location.countryCode : null};
    },
  };
}
````

`isKnownCountry` exported; `WalletDeps.geo` and the one gate per `browserDeps`; the fake; the runs; Task 2's staged list:

````diff
diff --git a/core/geo/freshness.ts b/core/geo/freshness.ts
index 8471998..54386dc 100644
--- a/core/geo/freshness.ts
+++ b/core/geo/freshness.ts
@@ -118,7 +118,7 @@ export interface GeoGate {
 }
 
 /** ISO 3166-1 alpha-2, and not the placeholders geolocation services use for "unknown". */
-function isKnownCountry(code: string): boolean {
+export function isKnownCountry(code: string): boolean {
   return /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'ZZ';
 }
 
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index 5ac9d48..2064c0d 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -31,9 +31,9 @@ export const ON_BUILD = [
   'src/background/presale/state.ts',
   'core/presale/limits.ts',
 ];
-// Task 3: the intent-kind registry (C19 — both builds sign and read through it); Task 6 adds src/background/geo/gate.ts
-// and core/geo/fetch.ts (D15: the off build did not lose the gate).
-export const BOTH_BUILDS = ['src/background/intents.ts'];
+// The intent-kind registry (C19 — both builds sign and read through it); the jurisdiction gate and its fetcher (D15:
+// the off build did not lose the gate).
+export const BOTH_BUILDS = ['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts'];
 // Armed by B1d-1b: 1a ships no presale string (Q42 is "both").
 export const MARKERS = [];
 // Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
diff --git a/extension/src/background/__tests__/fakeDeps.ts b/extension/src/background/__tests__/fakeDeps.ts
index efa68f2..0f053fe 100644
--- a/extension/src/background/__tests__/fakeDeps.ts
+++ b/extension/src/background/__tests__/fakeDeps.ts
@@ -27,8 +27,8 @@ export function fakeReader(overrides: Partial<SolanaReader> = {}): SolanaReader
 
 /**
  * Deterministic deps: a settable clock, counting random bytes, prices for SOL/USDC/USDT, a sleep
- * that never resolves (no poller runs unless a test asks for one), and a broadcast that fails
- * unless a test overrides it.
+ * that never resolves (no poller runs unless a test asks for one), and a broadcast and a geo check
+ * that fail unless a test overrides them.
  */
 export function fakeDeps(overrides: Partial<WalletDeps> = {}): WalletDeps & {clock: {t: number}; broadcasts: Uint8Array[]} {
   const clock = {t: 1_000_000};
@@ -41,6 +41,9 @@ export function fakeDeps(overrides: Partial<WalletDeps> = {}): WalletDeps & {clo
     },
     prices: async () => ({solana: 150, usdc: 1, usdt: 1}),
     stagePrice: async () => 0.1501,
+    geo: async () => {
+      throw new Error('unexpected geo check');
+    },
     now: () => clock.t,
     randomBytes: n => {
       counter += 1;
diff --git a/extension/src/background/deps.ts b/extension/src/background/deps.ts
index 876ba37..e512105 100644
--- a/extension/src/background/deps.ts
+++ b/extension/src/background/deps.ts
@@ -5,6 +5,7 @@ import {PRESALE_STAGE_PRICES} from '../../../core/presale/stagePrices';
 import {broadcastSigned} from '../../../core/solana/broadcast';
 import {fetchUsdPrices} from '../../../core/portfolio/prices';
 import type {Prices} from '../../../core/portfolio/value';
+import {createJurisdictionGate, type GeoAnswer} from './geo/gate';
 
 /**
  * Everything the wallet engine needs from outside: chain reads, the broadcast route, prices, time
@@ -19,6 +20,8 @@ export interface WalletDeps {
   prices(): Promise<Prices>;
   /** USD per NOC at the current presale stage (owner decision B), or null when /stats does not say it validly. */
   stagePrice(): Promise<number | null>;
+  /** B1d §2.2: the jurisdiction gate's answer now (both builds, D15) — #23 and F12 (B1d-1b) ask it; never throws. */
+  geo(): Promise<GeoAnswer>;
   now(): number;
   randomBytes(n: number): Uint8Array;
   sleep(ms: number): Promise<void>;
@@ -136,6 +139,7 @@ export function browserDeps(ext: Ext): WalletDeps {
   const broadcastFetch = timedFetch(BROADCAST_TIMEOUT_MS);
   const latch = createForbiddenLatch({store: latchStore(ext)});
   const get = createJsonGetter(fetch, latch);
+  const gate = createJurisdictionGate({get, now: () => Date.now()});
   let cache: {at: number; prices: Prices} | null = null;
   let stage: {at: number; price: number} | null = null;
   return {
@@ -156,6 +160,7 @@ export function browserDeps(ext: Ext): WalletDeps {
       if (price !== null) stage = {at: now, price};
       return price;
     },
+    geo: () => gate.check(),
     now: () => Date.now(),
     // A CSPRNG: ids for prepared sends, pending records and re-auth challenges.
     randomBytes: n => globalThis.crypto.getRandomValues(new Uint8Array(n)),
diff --git a/extension/vite.config.ts b/extension/vite.config.ts
index 3029a5e..5e2e79a 100644
--- a/extension/vite.config.ts
+++ b/extension/vite.config.ts
@@ -125,6 +125,7 @@ export function appConfig(env: Record<string, string | undefined>): UserConfig {
         '../core/solana/**/*.test.ts',
         '../core/fees/**/*.test.ts',
         '../core/portfolio/**/*.test.ts',
+        '../core/geo/**/*.test.ts',
       ],
     },
   };
diff --git a/extension/vitest.nopresale.config.ts b/extension/vitest.nopresale.config.ts
index 7a4c758..0398b54 100644
--- a/extension/vitest.nopresale.config.ts
+++ b/extension/vitest.nopresale.config.ts
@@ -17,6 +17,8 @@ export const NOPRESALE_TESTS = [
   'src/background/__tests__/pendingKinds.test.ts',
   'src/app/__tests__/genericRecord.test.tsx',
   'src/app/__tests__/engine.test.ts',
+  'src/background/geo/__tests__/gate.test.ts',
+  '../core/geo/**/*.test.ts',
 ];
 
 const base = appConfig({...process.env, NOCTURA_PRESALE: '0'});
````

The spec — the controller's rent ruling (Task 5's finding) where the rents appear (C9, C11, §2.1, §3.3 step 5 and `PurchaseView`), and §1.2 / §2.2 as built (two fetch functions instead of one `fetchGeoInputs`; absent age keys read as null; the cache boundary; the request order; `countryCode`; `WalletDeps.geo`):

````diff
diff --git a/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md b/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
index 0265b07..9713172 100644
--- a/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
+++ b/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
@@ -1,12 +1,39 @@
 # Noctura Extension B1d — presale in the extension (buy, allocation, referral, jurisdiction gate)
 
-**Status:** **approved rev 3**, 2026-10-19 (owner: "ok je") — Fable reviews 1–2 applied with owner decisions D7–D15; next: plan B1d-1a →  Fable review. The owner approved
+**Status:** **approved rev 3**, 2026-10-19 (owner: "ok je") — Fable reviews 1–2 applied with owner decisions D7–D15; **rev 3.1**
+(D16): rev 3 plus plan B1d-1a's spec edits, listed below. The owner approved
 the design in conversation section by section (`.superpowers/sdd/b1d-approved-design.md`, approach A) and took
 decisions D1–D6, then D7–D14 on Fable's review 1 and D15 on review 2 (`.superpowers/sdd/b1d-owner-decisions.md`,
 `.superpowers/sdd/b1d-spec-review-1.md`, `.superpowers/sdd/b1d-spec-review-2.md`).
 Everything this spec adds beyond that text is a controller ruling (C1–C39 below) or a string in §10 (Q01–Q52, final
 under D14). Research map: `.superpowers/sdd/b1d-context.md`. Where each review finding landed: §11.
 
+**Rev 3.1 (2026-10-19, owner decision D16): rev 3 plus the spec edits plan B1d-1a makes, collected here — no separate
+rev 4 pass.** Each is a diff in the plan task named (`docs/superpowers/plans/2026-10-19-extension-b1d-plan1a.md`); every
+other passage is rev 3 as approved:
+- C9 (Task 6): every rent in SOL MAX is §2.1's upper-bound constant (MAX reserves a little more than the runtime charges).
+- C11 (Task 6): the exact outflow check's new-PDA rent comes from the simulation's post-state, never from a constant.
+- C38 (Task 2): "the two helpers" → the three shared symbols of §6.2.
+- §1.2 (Tasks 2, 6): `core/geo/fetch.ts` exports `fetchGeoCheck`, `fetchRestrictedList` and `isGeoRefusal` (not
+  `fetchGeoInputs`); `core/solana/encoding.ts` takes three symbols (`SPL_TOKEN_PROGRAM` too), re-exported by
+  `buyInstructions.ts`.
+- §1.3 (Task 4): a send's challenge digest is unchanged by the kind (its domain was already `send`), so a challenge issued
+  before the update still matches for a send; only a non-send kind's challenge is bound to its kind.
+- §1.3, §1.4 (Task 6, D17): `sendPrepared` signs only the caller's kind — `wallet.send` only `kind: 'send'` (any other
+  kind is `unknown-prepared`, nothing burned), `presale.buy` only `presale-buy`.
+- §2.1 (Task 6): the rent ruling — mainnet rent 5 080 lamports per byte; every rent constant (the presale PDAs' and
+  B1b's) is an upper bound only; B1b's `sender-below-rent` stays at 890 880 (D19).
+- §2.2 (Task 6): as built — two fetch functions and `isGeoRefusal`; a non-200 is the getter's error; an absent age key
+  reads as null (stale); the list cached for less than 10 minutes from its request, a failed list not kept, one shared
+  request; the request budget (`/geo/check` first, no list after a failed check); `countryCode` only when known;
+  `WalletDeps.geo()`; and (D18) the server's `max_staleness_days` capped at 30.
+- §3.3 step 5 (Task 6): the simulation's accounts also carry `["user", account]` when the snapshot found it absent;
+  SOL spent uses `simulatedRent` (the created PDAs' post-state lamports, each owned by the program with its layout's
+  length, > 0 and ≤ its §2.1 bound) — a change to 1b's funds-critical outflow check.
+- §3.3 step 7 (Task 6): `PurchaseView.fees.rentLamports` = `simulatedRent`.
+- §6.2 (Task 2): the encoding bullet — three symbols, and the three core modules that import them.
+- §8.2 (Task 2): the `core/` rows name the three moved symbols and `core/solana/{transfer,history,balances}.ts`.
+
 **Ledger (review L12).** The order, so nobody has to guess it: the facts were re-read from the code on 2026-10-18 (§8.2)
 and rev 1 was written from them; the owner's decisions D1–D6 and D7–D14 carry the date the decisions file records,
 2026-10-19, which is also the date in this file's name; rev 2 was written after both sets of decisions, and every
@@ -83,9 +110,9 @@ spec's ruling C13 ("the window decides nothing"), which the approved design cite
 | C6 | **The per-user cap is a pinned program constant:** `PRESALE_MAX_TOTAL_PER_USER_USD = 20_000_000` cents ($200 000, ICO `lib.rs:36`, checked against `total_spent_cents` at `lib.rs:344-351`). The config has no field for it | approved "max per user minus the existing allocation", made exact: the program's cumulative cap is on cents spent, not on NOC |
 | C7 | **Referrer (D8).** A referrer already registered on chain is always honoured from B1d-1b on (`resolveReferrerWith(ref, user, null)`: the purchase passes that referrer's allocation PDA, as the program requires). A new one is registered only through #23's optional field, in B1d-2, under C32's rules; there is no other capture channel (no deep link, no page reading) | D8; an extension has no capture channel, and the field is the owner's choice of one |
 | C8 | **Without a SOL price, SOL is not offered** (Buy disabled, Q19); USDC and USDT still are | a SOL purchase's limits and estimate need a price; the program prices at Pyth, but a wallet that cannot say what $ amount the user is spending must not offer it |
-| C9 | **MAX keeps the paying account rent-exempt:** SOL MAX = balance − network fee − rent of the PDAs this purchase creates − `SYSTEM_ACCOUNT_RENT_LAMPORTS` (890 880), then capped by the limits; stablecoin MAX = the largest holding account, capped by the limits | approved "MAX for SOL leaves fees and rent"; a wallet that empties itself cannot pay its next fee |
+| C9 | **MAX keeps the paying account rent-exempt:** SOL MAX = balance − network fee − rent of the PDAs this purchase creates − `SYSTEM_ACCOUNT_RENT_LAMPORTS` (890 880), then capped by the limits — every rent here is §2.1's upper-bound constant, so MAX reserves a little more than the runtime charges; stablecoin MAX = the largest holding account, capped by the limits | approved "MAX for SOL leaves fees and rent"; a wallet that empties itself cannot pay its next fee |
 | C10 | **One in-flight transaction per account, a purchase included.** B1b's `inFlightFor` counts a `presale-buy` record like a send — which needs the shared validator to read it at all (review H1, §1.3): neither a send nor a purchase is built while either is open | approved "one in-flight presale-buy per account", via the rule that already exists — stricter, one rule |
-| C11 | **The simulation is checked exactly** (§3.3): SOL out = amount + fee + new-PDA rent; the source token account loses exactly the amount; **the pinned destination gains exactly the amount** (C28); `total_spent_cents` rises by Δc and `total_tokens` by exactly `tokensFor(Δc, stage)`; `purchase_count` by 1 | approved "outflow equal to the entered amount (+ fee) and an allocation increase", made testable; rent is the refinement (two `init_if_needed` PDAs, ICO `lib.rs:2904-2919`) |
+| C11 | **The simulation is checked exactly** (§3.3): SOL out = amount + fee + new-PDA rent, the rent taken from the simulation's post-state (the created PDAs' lamports), never from a constant (§2.1, rent ruling); the source token account loses exactly the amount; **the pinned destination gains exactly the amount** (C28); `total_spent_cents` rises by Δc and `total_tokens` by exactly `tokensFor(Δc, stage)`; `purchase_count` by 1 | approved "outflow equal to the entered amount (+ fee) and an allocation increase", made testable; rent is the refinement (two `init_if_needed` PDAs, ICO `lib.rs:2904-2919`) |
 | C12 | **Geo:** `/geo/check` is fetched on every #23 mount, every prepare, every signature, and for #48 on every simulation and approval of a request carrying a presale purchase (§3.6); the list is cached ≤ 10 minutes, its freshness evaluated against the clock every time; **either fetch failing is `no_check`**; the extension bundles no fallback list | approved "re-checked on every #23 mount and before every signature"; a bundled list always counts as stale (B1 §4), so carrying one buys nothing |
 | C13 | **The NOC valuation for B1b's dollar rule (`deps.stagePrice`, `/stats`) is unchanged.** It is not presale code and exists in both builds | moving it to `state.ts` would put presale code in the off build |
 | C14 | **`core/geo/fetch.ts` is used only by the extension in B1d** (D12). Moving web and the app onto it changes *their* purchase gates (web ignores staleness today, the app fails open) and is a separate later task | owner decision D12 |
@@ -193,7 +220,7 @@ approve.html (#48) — renders F12 as stored with the simulation; computes nothi
 `GeoAnswer` (§2.2), the list cache; it imports nothing under a presale directory. #23 (through `presale/`) and F12
 (through `dapp/`) both call it.
 
-`core/` gains: `core/geo/fetch.ts` (`fetchGeoInputs(get: JsonGetter)`, §2.2), `core/presale/limits.ts` (bigint:
+`core/` gains: `core/geo/fetch.ts` (`fetchGeoCheck(get: JsonGetter)`, `fetchRestrictedList(get)`, `isGeoRefusal`, §2.2), `core/presale/limits.ts` (bigint:
 `usdCentsForStable`, `tokensFor`, `checkLimits`, ticks, rents, §3.2) and `core/solana/encoding.ts` (`SPL_TOKEN_PROGRAM`,
 `encodeU64LE`, `findAssociatedTokenAddress` moved out of `buyInstructions.ts`, which re-exports all three for the app and
 web, so no caller outside the extension changes; §6.2). `deps.ts` gains `createJsonPoster(fetch, latch)` (B1d-2) — generic, beside
@@ -212,9 +239,11 @@ onConfirmed?})`. B1b's `send` registers itself unconditionally; `presale/api.ts`
   `kind: 'send'` entries; `presale.preparedFor` only `presale-buy`. **Every prepare, of any kind, replaces every
   prepared entry of that account** (today's rule in `prepareSend`, extended across kinds), so an account has at most
   one prepared entry.
-- **`sendPrepared` (sign + submit), kind-agnostic, in this order** (C29; today's order in `send.ts:33-70` with one step
-  inserted):
-  1. session (`locked`); `peekPrepared` (`unknown-prepared`); the kind is registered (else `prepared-invalid`);
+- **`sendPrepared` (sign + submit), for one kind per caller (D17), in this order** (C29; today's order in
+  `send.ts:33-70` with one step inserted):
+  1. session (`locked`); `peekPrepared` (`unknown-prepared` — also for an entry of another kind than the caller's:
+     `wallet.send` signs only `kind: 'send'`, `presale.buy` only `presale-buy`; nothing burned); the kind is registered
+     (else `prepared-invalid`);
   2. `challengeSatisfied` on the peeked entry (`reauth-required` + the challenge id, as today — nothing burned);
   3. **the kind's `beforeSign(peeked)`** (presale: C12's geo check and C22's state re-read) — a refusal here burns
      nothing: the entry stays, the proof stays proven, and the popup re-prepares carrying the challenge id;
@@ -258,7 +287,7 @@ existing `vault.challengeInfo`).
 | `presale.quote` | `{account, currency, amount: string \| 'max'}` | `Quote` (§3.2) from the last `presale.view` snapshot of that account ≤ 30 s old; older → `{stale: true}` |
 | `presale.prepareBuy` | `{account, intent: {currency, amount, stage}, challengeId?}` (B1d-2: `intent.referrer: string \| null`) | `PurchaseView` (§3.3) or a refusal code (§5) |
 | `presale.preparedFor` | `{account}` | the account's `presale-buy` prepared entry's view, `expired` as B1b's `wallet.preparedFor` |
-| `presale.buy` | `{id}` | `PendingView` or a refusal code; via the kind-agnostic `sendPrepared` (§1.3) |
+| `presale.buy` | `{id}` | `PendingView` or a refusal code; via `sendPrepared` for `presale-buy` only (§1.3, D17) |
 | `presale.discardPrepared` | `{account}` | B1b's `discardPrepared` (all of the account's entries and their challenges) |
 | `presale.checkReferrer` (B1d-2) | `{account, referrer}` | `{ok: true}` or `{ok: false, line: 'referrer-invalid' \| 'referrer-self' \| 'referrer-no-allocation' \| 'referrer-not-applicable'}` (§3.5); a read failure → `presale-unavailable` |
 | `presale.referral` (B1d-2) | `{account}` | `ReferralView` (§3.5) |
@@ -363,13 +392,26 @@ the latch's cool-down); any other failed rule → `{unavailable: 'malformed'}`.
   `SYSTEM_ACCOUNT_RENT_LAMPORTS` (890 880 for 0 bytes) and `TOKEN_ACCOUNT_RENT_LAMPORTS` (2 039 280 for 165). New
   constants `PRESALE_USER_ACCOUNT_RENT_LAMPORTS`, `PRESALE_ALLOCATION_RENT_LAMPORTS` in `core/presale/limits.ts`, each
   with that formula as its test (`getMinimumBalanceForRentExemption` stays off the proxy's allowlist).
+- **Rent ruling (B1d-1a plan, 2026-10-19): these rents are upper bounds, never exact values.** Measured on mainnet the
+  same day (`getMinimumBalanceForRentExemption`, public RPC; the vault ATAs created 2026-09-21 hold exactly the 165-byte
+  figure): **5 080 lamports per byte** of `(128 + length)` — 0 / 58 / 117 / 165 bytes → **650 240 / 944 880 /
+  1 244 600 / 1 488 440** — not 6 960. So `PRESALE_USER_ACCOUNT_RENT_LAMPORTS`, `PRESALE_ALLOCATION_RENT_LAMPORTS` and
+  `newPdaRent`, and likewise B1b's `SYSTEM_ACCOUNT_RENT_LAMPORTS` 890 880 and `TOKEN_ACCOUNT_RENT_LAMPORTS` 2 039 280
+  (`core/solana/transfer.ts`), are **upper bounds**, used only where reserving more is safe: C9's MAX and §3.2's balance
+  lines (and B1b's `sender-below-rent`, which is therefore slightly stricter than the runtime — kept at 890 880 by D19;
+  re-pinning B1b's constants from the chain is a separate later task). **1b's exact outflow
+  check (C11, §3.3 step 5) takes the new-PDA rent from the simulation's post-state**, never from these constants: the
+  program pays the runtime's current rent, so an exact constant would refuse every first purchase. The constants and
+  their tests stay as written (they are the bound, and a lower runtime rate keeps them one).
 - `referrerAllocation` = `resolveReferrerWith(() => snapshotRef, account, captured)` — `captured` null before B1d-2 (C7).
 
 ### 2.2 The jurisdiction gate (`src/background/geo/gate.ts`, both builds — D15; B1 §4, C12, C34; B1d-1a)
 
-`core/geo/fetch.ts` — `fetchGeoInputs(get: JsonGetter): Promise<{location, list}>`. Both bodies: a non-200, a body
-that is not a JSON object, or a required key missing or of the wrong type → `GeoMalformed`; **every other key is
-ignored** (C34):
+`core/geo/fetch.ts` — `fetchGeoCheck(get: JsonGetter): Promise<GeoLocation>` and `fetchRestrictedList(get):
+Promise<GeoList>` (two functions, B1d-1a plan: the gate caches the list and never the check), `isGeoRefusal(e)` (a 403
+— `RpcForbidden`, the latch's `RpcCoolingDown`, or a getter's HTTP 403 — against every other failure). A non-200 is the
+getter's error (the extension's `createJsonGetter` throws on it); a body that is not a JSON object, or a required key
+missing or of the wrong type → `GeoMalformed`; **every other key is ignored** (C34):
 
 - `GET /geo/check` → required `countryCode: string`, `isVpn: boolean`, at the top level (no envelope — the live
   contract, `walletRoutes.js:97-100`, `web/src/geo/useGeo.ts`).
@@ -379,7 +421,9 @@ ignored** (C34):
   a boolean or null (the coordinator reports a missing value as null, `restrictedList.js:56-69`; a null is not
   malformed — it reaches `evaluateListFreshness` as an absent date or limit, which is stale). Envelope keys such as
   `reviewed_by`, `source`, `age_days` are ignored. Mapped to `ListMeta {source: 'server', updatedAt, reviewedAt,
-  maxStalenessDays, serverStale}` (null → absent).
+  maxStalenessDays, serverStale}` (null → absent). The four age keys are read the same when absent as when null (B1d-1a
+plan: the coordinator always sends them; an absent one closes the gate as `stale_list` rather than `no_check` — closed
+either way); present with another type → `GeoMalformed`.
 
 `gate.ts` decides, in this order:
 
@@ -389,12 +433,21 @@ ignored** (C34):
 | either GET failed otherwise (timeout, unreachable, non-200, `GeoMalformed`) | `no_check` |
 | `presaleGeoGate({freshness: evaluateListFreshness(meta, now), location, restricted})` | its own `stale_list` / `no_check` / `unknown_country` / `sanctioned` / `null` (open) |
 
-`presaleGeoGate` (`core/geo/freshness.ts:132`, tested, unused until now) already encodes B1 §4: missing or unparsable
+**The extension caps the server's staleness limit (D18):** the `meta` the gate evaluates carries min(`max_staleness_days`,
+30) (`GEO_MAX_STALENESS_DAYS`), so a coordinator that sends a larger limit cannot make an older list fresh; a missing
+limit stays missing (stale). `presaleGeoGate` (`core/geo/freshness.ts:132`, tested, unused until now) already encodes B1 §4: missing or unparsable
 dates are stale, a date more than a day in the future is unparsable, a server `stale: false` never overrides a locally
 computed age, an unknown or empty country (not `^[A-Z]{2}$`, or `XX` / `ZZ`) closes, and a sanctioned country closes
 whatever `isVpn` says (`sanctionedWinsOverVpn`; `isVpn` is always `false` today — B1 §5 coordinator answer 5 — and is
 read as nothing). A `restricted` country is open (OFAC-only policy, `classify.ts` `isPresaleBlocked`). The list is
-cached in the worker's memory ≤ 10 minutes; `/geo/check` is never cached. `GeoAnswer` = `{open, reason, countryCode | null}`.
+cached in the worker's memory for less than 10 minutes from its request (`GEO_LIST_CACHE_MS`; at 10 minutes, or on a
+clock that went backwards, it is read again); a failed or malformed list is not kept; callers that arrive together share
+one list request; `/geo/check` is never cached. **Request budget (review 2 M3):** `/geo/check` first, and after a
+failed check the list is not requested — one request per answer, two when the list is due, none in the latch's
+cool-down. `GeoAnswer` = `{open, reason, countryCode | null}` — `countryCode` is the detected country only when it is a
+known one (`isKnownCountry`, exported from `freshness.ts`), else null. The background reaches it as `WalletDeps.geo()`
+(`browserDeps` builds one gate on the shared getter and latch), which never throws — #23 through `host.deps` and F12
+through the dApp path's `deps` (1b).
 The same `gate.ts` answers #23 and F12 (§3.6), in both builds (D15): it is compliance code, not presale code, so it
 and `core/geo/**` are on the off-build allowlist (C38) and outside every presale directory.
 
@@ -510,14 +563,18 @@ user, 8 token_program, 9 system_program. `register_referrer` (B1d-2): 0 user_acc
    that the built instruction's account 5 equals `MAINNET_VAULT_USDC_ATA` / `_USDT_ATA` and account 4 the selected
    source; the vault ATA was already checked in the snapshot (§2.1 rule 8). Every compiled instruction's program is
    Compute Budget or the presale program; anything else is an engine bug (thrown, never shown).
-5. Simulate with `accounts = [payer, userAllocation, destination, source token account?]` — payer first, as B1b's
-   `prepareSend`; `destination` = `MAINNET_SOL_TREASURY` for SOL, the pinned vault ATA for a stablecoin (C28).
+5. Simulate with `accounts = [payer, userAllocation, destination, source token account?, userAccount?]` — payer first, as B1b's
+   `prepareSend`; `userAccount` (`["user", account]`) only when the snapshot found it absent (its post-state is rent this
+   purchase pays, step 5's first check); `destination` = `MAINNET_SOL_TREASURY` for SOL, the pinned vault ATA for a stablecoin (C28).
    Decide on `err` first (B1b §11.5): `{InstructionError: [i, {Custom: n}]}` on the presale instruction maps to
    6022 → `below-min`, 6023 → `above-limit` (the program uses one code for the per-transaction and the per-user
    maximum), 6002 → `blocked`, 6020 / 6021 / 6024 → `presale-closed`; B1b's rent refusal → `sender-below-rent`; any
    other error → `simulation-failed` (Q16). Then, with `err === null`, **all** of:
-   - SOL spent by the payer = `(currency = SOL ? amount : 0) + newPdaRent + networkFee`, or that minus `networkFee`
-     (B1b's two accepted readings);
+   - SOL spent by the payer = `(currency = SOL ? amount : 0) + simulatedRent + networkFee`, or that minus `networkFee`
+     (B1b's two accepted readings), where `simulatedRent` is the sum of the post-state lamports of the PDAs the snapshot
+     found absent (§2.1 rent ruling: the rent comes from the simulation, never from a constant) — so the simulation's
+     accounts also carry `["user", account]` when the user account is absent; each created PDA's post-state is owned by
+     the program with its layout's length, and its lamports are > 0 and ≤ its §2.1 upper bound;
    - **the destination (C28):** SOL — the treasury's lamports after − its lamports in the snapshot = `amount`
      exactly; stablecoin — the vault ATA after is a token account of that mint owned by `config.sol_treasury`, and its
      `amount` after − its amount in the snapshot = `amount` exactly;
@@ -543,7 +600,7 @@ user, 8 token_program, 9 system_program. `register_referrer` (B1d-2): 0 user_acc
    includes `kind`, `account`, `currency`, `amount`, `stage` and — B1d-2 — `referrer`).
 7. Store the prepared entry (§1.3) and answer `PurchaseView = {id, currency, amount, stage, priceTicks, nocBase: Δtokens,
    spentCents: Δc, destination, referrer: {address, registers: boolean} | null, fees: {networkLamports,
-   priorityLamports, rentLamports: newPdaRent}, reauth, validUntil, simulation: {slot, elapsedMs, programs:
+   priorityLamports, rentLamports: simulatedRent}, reauth, validUntil, simulation: {slot, elapsedMs, programs:
    ['compute-budget', 'presale'], instructionCount}}` — `simulation` carries #19's facts for #20 (C33).
 
 `presale.buy {id}` → `sendPrepared` (§1.3, C29) with `beforeSign` = C12's geo check and C22's re-read of the §2.1
````

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates; web and the app unchanged (D12).**

Run: the Step 2 commands — extension `Test Files  2 passed (2)` · `Tests  102 passed (102)` (gate 65, gate list 37; rev 1: 93 with gate 56 — rev 2 adds the eight D18 rows and the M1 row); web `Test Files  1 passed (1)` · `Tests  45 passed (45)`.

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  189 passed (189)` · `Tests  3851 passed (3851)` (previous tree 185 / 3689: +4 files, +162 tests — gate 65, fetch 45, and core's existing `freshness.test.ts` 43 and `classify.test.ts` 8, which the extension now runs too; `check-no-presale` +1). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  13 passed (13)` · `Tests  377 passed (377)` (previous 9 / 216: the same four files, +161 — the gate answers in the off run exactly as in the on run; rev 1: 3829 and 365).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build, the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 9 required modules; 0 markers (none in the off build, each in the on build); 4 strings and the decoder's instruction names stay in the off build`. Both `app.modules.json` list `src/background/geo/gate.ts`, `../core/geo/fetch.ts`, `../core/geo/freshness.ts`, `../core/geo/classify.ts` (and no `restrictedList.ts`: only its type is imported, so the bundled list is in neither build). `npm run csp`, `npm run secrets` — ok for both builds; `npm run reproducible` — ok, both variants; `node scripts/check-no-tge-date.mjs` (package) — `610 source and built files checked` per build; repository root (after the commit) — `no TGE date in 1273 tracked text files`. Rpc methods unchanged (the gate uses no RPC).

This task touches `core/`: `cd ../web && npm run verify` — green (`Test Files  47 passed (47)` · `Tests  616 passed (616)`, previous 46 / 571: +1 file, +45 — `fetch.test.ts`, the only new test web runs; no web test changed; the bundle test `3 passed`; reproducible). From the repository root `npx tsc --noEmit; echo $?` → `0`, `npx jest` → `Test Suites: 1 skipped, 180 passed` · `Tests: 1 skipped, 1234 passed, 1235 total` (unchanged: the app imports neither new module, and `isKnownCountry`'s export changes no caller). D12, shown: `git diff --name-only HEAD~1 HEAD | grep -E '^(web|src)/'` prints nothing.

**(rev 2) Playwright on the end state** (45fa811, both builds built in a `git archive` copy): `npx playwright test` — `77 passed` (17.7 min); the same under `unshare -rn` — `77 passed` (17.6 min).

- [ ] **Step 5: Commit.**

```bash
git add -A core/geo extension docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
git commit -m "feat(extension): B1d-1a jurisdiction gate in both builds — core/geo/fetch.ts (required keys only, a 403 told apart), src/background/geo/gate.ts on presaleGeoGate (list cache under 10 min, re-evaluated every call; the server's max_staleness_days capped at 30, D18; one request per answer), WalletDeps.geo; BOTH_BUILDS gains the gate; spec rev 3.1 (D16): every plan-1a spec edit listed — the rent ruling (D19), §2.2 as built, D17" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked), `timeout 300`; `tsc`'s own exit code first (0 for every one; for a `core/` mutation the repository root's `tsc` too), then the named test files.** `FT` = `core/geo/__tests__/fetch.test.ts` (45), `GT` = `gate.test.ts` (56) — run together where both are named (101); `NP` = `check-no-presale.test.mjs` (37); `PB` = `presaleBuilds.test.mjs` (two real builds).

| id | the change | named test → observed |
|---|---|---|
| F1 | `parseGeoCheck`: the `isVpn` check deleted, `return {countryCode, isVpn: isVpn === true}` | FT “isVpn missing → GeoMalformed”, “isVpn a string”, “isVpn null”; GT “isVpn missing → no_check”, “isVpn a string” — tsc 0, root tsc 0 · RED `Test Files  2 failed (2)` · `Tests  5 failed \| 105 passed (110)` |
| F2 | `parseRestrictedList`: `typeof code !== 'string'` only (the `^[A-Z]{2}$` test dropped) | FT “a lowercase code”, “a three-letter code” — tsc 0, root tsc 0 · RED `Tests  2 failed \| 108 passed (110)` |
| F3 | `if (body.success === false) throw` (a missing or non-boolean `success` accepted) | FT “success missing”, “success "true"” — tsc 0, root tsc 0 · RED `Tests  2 failed \| 108 passed (110)` |
| F4 | `!Array.isArray(raw)` only (an empty list accepted) | FT “countries empty”; GT “a failed or malformed list is not cached…” — tsc 0, root tsc 0 · RED `Test Files  2 failed (2)` · `Tests  2 failed \| 108 passed (110)` |
| F5 | `optional`: `if (typeof v !== type && false) throw` (an ill-typed age key passes through) | FT “updated_at a number”, “reviewed_at an object”, “max_staleness_days a string”, “stale a string” — tsc 0, root tsc 0 · RED `Tests  4 failed \| 41 passed (45)` |
| F6 | the category check deleted, `category: category === 'sanctioned' ? 'sanctioned' : 'restricted'` | FT “an unknown category”, “a category missing”, “one bad entry among good ones…”; GT “a list missing a required field (an entry without category)” — tsc 0, root tsc 0 · RED `Test Files  2 failed (2)` · `Tests  4 failed \| 106 passed (110)` |
| R1 | `isGeoRefusal`: `(e instanceof RpcForbidden && e.name === 'never') \|\| …` (a 403 and the cool-down not refusals) | FT “a 403, the latch’s cool-down after one…”; GT “/geo/check 403 → refused”, “/geo/restricted-list 403”, “the latch cooling down”; the `browserDeps` 403 row — tsc 0, root tsc 0 · RED `Test Files  2 failed (2)` · `Tests  7 failed \| 103 passed (110)` |
| R2 | gate: `reason: isGeoRefusal(e) && false ? 'refused' : 'no_check'` (the 403 distinction lost at the gate) | GT the four `→ refused (not no_check)` rows, “a cached list does not open a failed check”, the `browserDeps` 403 row — tsc 0 · RED `Tests  7 failed \| 58 passed (65)` |
| R3 | `isGeoRefusal`: `\|\| e instanceof RpcHttpError` (any HTTP error a refusal) | FT “every other failure is not (negative controls)”; GT “/geo/check 500 → no_check”, “/geo/restricted-list 404”, the `browserDeps` 404 row, the not-cached row — tsc 0, root tsc 0 · RED `Test Files  2 failed (2)` · `Tests  6 failed \| 104 passed (110)` |
| C1 | gate: `freshness: {...evaluateListFreshness(…), stale: false}` (`stale_list` never answered) | GT 13 rows — the 31-day boundary, the stale-before-country row, the nine `→ stale_list` rows, max_staleness_days null, the in-window staleness — tsc 0 · RED `Tests  18 failed \| 47 passed (65)` |
| C2 | gate: the age evaluated at the cache time (`new Date(cached !== null ? cached.at : io.now())`) | GT “a cached list's age is evaluated against the clock every time…” — tsc 0 · RED `Tests  1 failed \| 64 passed (65)` |
| U1 | core `presaleGeoGate`: `if (!isKnownCountry(…) && false) return` (`unknown_country` never answered) | GT the seven `countryCode … → unknown_country` rows — tsc 0, root tsc 0 · RED `Tests  7 failed \| 58 passed (65)` |
| U2 | gate: `countryCode: isKnownCountry(…) \|\| true ? …` (an unknown code reported) | GT the seven unknown rows and “a stale list closes before the country is looked at…” — tsc 0 · RED `Tests  8 failed \| 57 passed (65)` |
| S1 | core `presaleGeoGate`: `{sanctionedWinsOverVpn: false}` | GT “KP → sanctioned; KP behind a VPN flag → sanctioned” — tsc 0, root tsc 0 · RED `Tests  1 failed \| 64 passed (65)` |
| S2 | gate: `restricted: restricted.countries.filter(c => c.category !== 'sanctioned')` (`sanctioned` never answered) | GT the KP row, the four `(sanctioned on the served list)` rows, “the served list decides…” — tsc 0 · RED `Tests  6 failed \| 59 passed (65)` |
| N1 | gate: a failed list read falls back to a list of its own, dated today (`list().catch(() => ({countries: [KP], meta: {source: 'server', updatedAt: <today>, maxStalenessDays: 30}}))`) | GT “/geo/restricted-list 404 → no_check; there is no fallback list to open on”, the timeout row, the four parse rows of the list, “a failed or malformed list is not cached…”, the `browserDeps` 404 row — tsc 0 · RED `Tests  10 failed \| 55 passed (65)` |
| B1 | gate: `[location, restricted] = await Promise.all([fetchGeoCheck(io.get), list()])` (the list asked even after a failed check) | GT “a failed /geo/check sends no list request…” — tsc 0 · RED `Tests  1 failed \| 64 passed (65)` |
| K1 | `at - cached.at <= GEO_LIST_CACHE_MS` | GT “at exactly 10 minutes the list is read again (the boundary)” — tsc 0 · RED `Tests  2 failed \| 63 passed (65)` |
| K2 | the `at >= cached.at` guard deleted | GT “a clock that went backwards does not make a cached list young…” — tsc 0 · RED `Tests  1 failed \| 64 passed (65)` |
| K3 | `cached = at < 0 ? {at, list: l} : null;` (nothing cached). First draft (`cached !== null && false && …`) did not compile (tsc 2, TS18047) — INVALID, replaced | GT “/geo/check is asked on every call; the list once per 10 minutes”, the in-window staleness row — tsc 0 · RED `Tests  2 failed \| 63 passed (65)` |
| K4 | `reading = fetchRestrictedList(…)` (no shared in-flight read) | GT “two callers at once (#23 and F12) share one list request” — tsc 0 · RED `Tests  1 failed \| 64 passed (65)` |
| K5 | the rejection branch keeps `reading` (a failed read is kept) | GT “a failed or malformed list is not cached…” — tsc 0 · RED `Tests  2 failed \| 63 passed (65)` |
| W1 | `browserDeps`: the gate on its own getter and latch (`createJsonGetter(fetch, createForbiddenLatch())`) | GT “a 403 on /geo/check → refused, and it trips the one latch…” — tsc 0 · RED `Tests  1 failed \| 64 passed (65)` |
| W2 | `BOTH_BUILDS` without `src/background/geo/gate.ts` | NP “both builds must carry the intent-kind registry (Task 3) and the jurisdiction gate…” — tsc 0 · RED `Tests  1 failed \| 36 passed (37)` |
| W3 | `browserDeps` does not build the gate (`geo: async () => ({open: false, reason: 'no_check', countryCode: null})`, the import type-only) — the gate leaves both bundles | PB “the off-build gate (scripts/check-no-presale.mjs) passes on the two builds…” (`… build does not carry src/background/geo/gate.ts`, both builds); GT the three answering `browserDeps` rows — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  4 failed \| 73 passed (77)` |
| K6 (rev 2, review 1 M1) | the list's rejection branch returns the expired cached list (`if (cached !== null) return cached.list;` before `throw e`) — review 1's surviving T6-1, which opens the gate | GT “a cached list past 10 minutes whose re-read fails → no_check (or refused), never the expired list…” — tsc 0 · RED `Tests  1 failed \| 64 passed (65)` |
| D1 (rev 2, D18) | no cap (`maxStalenessDays: limit`) | GT “D18: … 31: 31 days old → stale (capped at 30)”, “… 365: 31 days old …” — tsc 0 · RED `Tests  2 failed \| 63 passed (65)` |
| D2 (rev 2, D18) | `Math.max(limit, 30)` (the cap as a floor) | GT “D18: … 29: 30 days old → stale”, the 31 and 365 rows, and “max_staleness_days 0 → stale_list” — tsc 0 · RED `Tests  4 failed \| 61 passed (65)` |
| D3 (rev 2, D18) | `GEO_MAX_STALENESS_DAYS = 31` | GT all eight D18 rows (each pins the constant, and the 31-day row decides) — tsc 0 · RED `Tests  8 failed \| 57 passed (65)` |
| D4 (rev 2, D18) | a missing limit capped into 30 (`Math.min(limit ?? 30, 30)`) | GT “D18: … missing: a list of today → stale…” and the other missing-limit rows (`max_staleness_days null` / `missing` → stale_list) — tsc 0 · RED `Tests  4 failed \| 61 passed (65)` |

Where a cell names several rows, they are the rows the change is aimed at (the first-reported failure is the first named); the red count is the observed total. 30 mutations (rev 1's 25, re-run on rev 2's tree with the counts above, plus K6 and D1–D4), all red, every one compiling (`tsc` 0; root `tsc` 0 for the eight in `core/`). Two first drafts did not compile and were replaced (INVALID, not red): F1 and F6 as `… && false` lost TypeScript's narrowing (`unknown` not assignable, tsc 2), and K3 as above. Every closed reason has its own mutation (`refused` R1/R2, `no_check` F1–F6/N1, `stale_list` C1/C2, `unknown_country` U1, `sanctioned` S1/S2), and the 403 distinction three (R1–R3, both directions). Not covered by a mutation, stated: the `> 0, ≤ bound` simulated-rent clause and the rest of the rent ruling are spec text for 1b (no code here reads rent).

#### Dry-run notes (Task 6)

- **Ruling: two fetch functions (`fetchGeoCheck`, `fetchRestrictedList`) instead of the spec's one `fetchGeoInputs(get) → {location, list}`** — why: the gate caches the list and never the check (C12), so one function fetching both would either defeat the cache or need a cache parameter; the spec's §1.2 and §2.2 now name the two (spec diff above) — cost if wrong: none (a one-line wrapper if anyone wants the pair).
- **Ruling: the 403 distinction lives in core (`isGeoRefusal`)** — `RpcForbidden` (which includes the latch's `RpcCoolingDown`) or an `RpcHttpError` with status 403 from some other getter; every other failure (timeout, unreachable, 404, 500, `GeoMalformed`) is not — why: the brief puts "a 403 distinguished" in `fetch.ts`; the extension's getter only ever produces the first form (the latch throws before the status check), the second keeps the rule true for a getter that throws on status alone — cost if wrong: none.
- **Ruling: "a non-200 → `GeoMalformed`" (§2.2) is the getter's error, not `GeoMalformed`** — `createJsonGetter` throws `RpcHttpError` on any non-200 before a body exists; the gate maps it to `no_check` exactly as it would `GeoMalformed`; spec §2.2 says so now — cost if wrong: none (same answer).
- **Ruling: the four age keys (`updated_at`, `reviewed_at`, `max_staleness_days`, `stale`) read the same absent as null** — why: §2.2 lists them as "string or null" while §6.1 requires "missing dates → `stale_list`"; reading an absent key as null satisfies both (the coordinator always sends them, `restrictedList.js:58-69`); present with another type stays `GeoMalformed` — cost if wrong: an absent date answers `stale_list` instead of `no_check` (closed either way; #50b's sub-line differs). Strictly required, as before: `success: true`, `data` an object, `countries` non-empty, every entry's `code` and `category`.
- **Ruling: the request budget — `/geo/check` first, and after a failed check the list is not requested** — why: review 2 M3 / C35 size #23's re-read at two requests (snapshot + `/geo/check`); with this order one gate answer is one request, two when the list is due (≤ once per 10 minutes), none in the latch's cool-down (`RpcCoolingDown` costs no request); a failing list (404/timeout) is re-read on the next call (no negative cache — a cached failure would keep #23 closed after the coordinator recovered) — cost if wrong: while the list fails, a #23 re-read is three requests (snapshot, check, list) instead of two. The table row "either GET answered 403" now means either GET that was sent — after a timed-out check the list is not asked, so its 403 cannot be seen (closed either way; the copy is `no_check`'s). 1b sizes the interval against P3's number when ICO has it.
- **Ruling: the cache window is `0 ≤ now − at < 10 min`, `at` = the list request's start** — "≤ 10 minutes" made exact on the safe side; a clock that went backwards refetches (K2); a failed or malformed list is never kept (K5); callers that arrive together share one list request (K4: #23 and F12 at once); `/geo/check` is never cached. The list's age is evaluated against `now()` on every call (C2), not when it was fetched.
- **Ruling: `GeoAnswer.countryCode` is the detected code only when `isKnownCountry` (exported from `core/geo/freshness.ts`), else null** — why: #50b shows the region card "as above when a country is known" for `stale_list`; a stale list closes before the country is looked at, so the gate must decide "known" itself; exporting core's existing predicate keeps one definition — cost if wrong: none (an export; web and the app call nothing new).
- **Ruling: the gate reaches the background as `WalletDeps.geo()`, built once in `browserDeps` on the shared getter and latch** — see "Why `WalletDeps.geo`" above: it puts the gate in both module maps in 1a without inventing a caller, and it is the one place the shared latch lives (W1: a gate on its own latch would let a geo 403 leave Send's cool-down untouched — red). `fakeDeps().geo` throws unless overridden, like `broadcast` — cost if wrong: 1b moves it (one field).
- **Ruling: the extension's vitest now runs `../core/geo/**` (both runs)** — why: core/geo is extension compliance code from this task (D15); web's vitest still runs the same files (web's count rises only by `fetch.test.ts`) — cost: ~1 s.
- **(rev 2, D18) The server's `max_staleness_days` is capped at 30 in the gate, not in core** — `gate.ts` evaluates `{...meta, maxStalenessDays: Math.min(server, 30)}`; a missing limit stays missing (so stale — `evaluateListFreshness`'s rule), never capped into one. Why the gate: D12 keeps web and the app on their current geo behaviour, and `evaluateListFreshness` is theirs too; the cap is the extension's own compliance rule (both builds, D15). Tested at 29 / 30 / 31 / 365 and missing (a list 30 and 31 days old against each; the 31 and 365 rows are the ones the cap decides) — D1 (no cap), D2 (`Math.max`), D3 (a cap of 31) and D4 (a missing limit capped into 30) are red.
- **(rev 2, review 1 M1) A cached list past 10 minutes whose re-read fails is `no_check` (a 403 `refused`), never the expired list**, and the next call reads it again — the one state rev 1's suite did not visit (cache filled → window passed → list route fails); K6 (the rejection branch returning the expired cached list — review 1's surviving T6-1, which opens the gate) is red.
- **(rev 2, D16, review 1 M5) Spec rev 3.1:** the spec's status line now says rev 3.1, and a paragraph under it lists every passage plan 1a changes — C9, C11, C38, §1.2, §1.3 (Task 4's challenge sentence; D17), §1.4 (D17), §2.1 (the rent ruling, D19), §2.2 (as built, D18), §3.3 step 5, §3.3 step 7, §6.2, §8.2 — one line each, naming the task. §3.3 step 5's two clauses and C11 change 1b's funds-critical outflow check; they are called out as such there.
- **No bundled list, by construction:** `gate.ts` imports only the `RestrictedCountry` type; neither build's module map lists `core/geo/restrictedList.ts`; every failed list read is `no_check` (N1 shows a fallback would be caught). "The bundled fallback always counts as stale" stays core's rule and test (`freshness.test.ts` “the bundled fallback is always stale”, now run by the extension too); the gate never builds a `bundled` meta.
- **Rent ruling written into the spec** (the controller's, ledger Task 5): C9 (the constants as upper bounds for MAX), C11 and §3.3 step 5 (`simulatedRent` = the post-state lamports of the PDAs the snapshot found absent, each > 0 and ≤ its §2.1 bound; the simulation's accounts carry `["user", account]` when it is absent), `PurchaseView.fees.rentLamports = simulatedRent`, and §2.1's ruling paragraph with the measured rate (5 080 lamports per byte; 0 / 58 / 117 / 165 B → 650 240 / 944 880 / 1 244 600 / 1 488 440) and B1b's 890 880 / 2 039 280 as upper bounds. **For 1b:** the C11 mutation "rent from the constant" must turn a first-purchase simulation red. The two new clauses beyond the ledger text — the user-account PDA in the simulation's accounts, and the `> 0, ≤ bound` check on each created PDA — are mine (the post-state rent cannot be read otherwise, and an unbounded "rent" would let a lying simulation hide an outflow in it); flagged for the controller.
- **D12 shown, not asserted:** no file under `web/` or `src/` changed; web verify 47 / 616 (+1 file, +45: `fetch.test.ts` only), root jest 1234 unchanged, root tsc 0. (rev 2 changes nothing under `core/`, `web/` or `src/` — these are rev 1's results, and they stand.)
- **For 1b:** `host.deps.geo()` for #23 (`presale.view`, `prepareBuy`, `beforeSign`) and `deps.geo()` for F12 (`runSimulation`, the decision) — the same gate instance, so the same list cache; `GeoReason` is exactly #50b's five reasons plus open; Q12/Q27 key on `refused`. The ledger's "an app-side wall-clock flake" (`PresaleActive.test.tsx`) did not recur in this task's root jest run.

#### The consistency pass (Task 6 is the last task)

Replayed every block of `task-1.md` … `task-6.md` onto `git archive 923b714`, in order (a ```` ```` ```` fence with `diff` → `git apply --recount`; any other language → the file in full at the path its label names), and compared the tree with `git archive` of the dry-run commit after each task (`diff -rq`). **Rev 2** replayed the regenerated parts against rev 2's commits (branch `dry/b1d1a-r2`):

| prefix | commit (rev 2) | blocks | applied | tree vs commit |
|---|---|---|---|---|
| Task 1 | 4ec596b | 25 | 25 | identical |
| Task 1–2 | 1f6fe9b | 5 | 5 | identical once the generated fixture `extension/scripts/__tests__/fixtures/app.modules.0b79442.json` is added (produced by the command printed in Task 2 Step 1, with its expected hash — not stored in a code block) |
| Task 1–3 | 30626f6 | 6 | 6 | identical once the generated capture `extension/src/background/__tests__/captured/sends.0b79442.json` is added (produced by the capture program printed in Task 3 Step 1 — rev 2 ran the printed command as extracted from this part, in a scratch clone: `Tests  1 passed (1)`, 35 990 bytes, sha256 `fed8cc8c…805f`, byte-identical to the committed file) |
| Task 1–4 | 7333c87 | 9 | 9 | identical |
| Task 1–5 | a76655e | 15 | 15 | identical (the generated `layouts.ts` is printed in full in the part) |
| Task 1–6 | 45fa811 | 7 | 7 | identical |

67 blocks, none failed; every prefix equals its commit; the only files not produced by a block are the two generated fixtures, each produced by the command printed in its part (rev 2, review 1 L6: rev 1's "not printed, by design" meant "not stored in a code block"). (The replay script: `scratchpad/replay-b1d1a.py <partsDir> <clone> <work> 923b714 <six commits>`.)

---


## Dry-run record

| task | dry-run commit (rev 2; rev 1) | green (vitest on / off) | mutations |
|---|---|---|---|
| 1 | 4ec596b (unchanged) | 179 / 3498 · 5 / 120; Playwright 75 | 21, all red (rev 1; not re-run — unchanged) |
| 2 | 1f6fe9b (c5550a0) | 180 / 3534 · 5 / 120 | 16, all red (+2 green controls) (rev 1; rev 2 changed one comment) |
| 3 | 30626f6 (9bed436) | 182 / 3588 · 7 / 172 | 21, all red (re-run + K3, D1, D2) |
| 4 | 7333c87 (b436245) | 183 / 3605 · 9 / 216; E2E 7 both ways | 14, all red (re-run) |
| 5 | a76655e (b523457) | 185 / 3689 · 9 / 216; web 46 / 571; root jest 1234 (rev 1) | 53, all red (re-run + S30–S33) |
| 6 | 45fa811 (f941887) | 189 / 3851 · 13 / 377; Playwright 77 normal + 77 `unshare -rn`; web 47 / 616; root jest 1234 (rev 1) | 30, all red (re-run + K6, D1–D4) |

- Every mutant compiled before it counted; non-compiling first drafts were replaced (Task 1: 1, Task 5: 6, Task 6: 3). Two survivors in Task 5 (S6, A3) were closed by strengthening the TEST.
- Consistency (rev 2): 67 blocks replayed onto `git archive 923b714` reproduce every rev 2 commit (`diff -rq`), the two generated fixtures by their printed commands (the Task 3 capture re-run from this plan's text: sha256 `fed8cc8c…805f`).
- 155 named mutations in rev 2 (rev 1: 143); the 118 of Tasks 3–6 re-run on rev 2's commits, every one compiling and red.
- Findings outside the plan: B1b's `Confirm.test.tsx` M4 re-read row failed once in a rev 2 whole-suite run (Task 5's tree; passed 5/5 alone and on the rerun) — a timing-dependent test on #20, for a later B1b task. The RN app's `PresaleActive.test.tsx` "blocks the buy CTA … sanctioned" timed out once under a full root `jest` run (an app-side wall-clock test; passed alone and on a rerun) — for a later app task.

## Before the PR (the standing rules)

- [ ] Reproduce CI with only `web/` and `extension/` installed on Node 22.12, npm 11.6.2: `npm ci --ignore-scripts` and `npm run verify` in both (both builds), `npm run e2e` in `extension/` normally and under `unshare -rn`.
- [ ] Root `npx tsc --noEmit` + `npx jest`; `node scripts/check-no-tge-date.mjs`.
- [ ] The PR says loudly: B1d-1a is a merge-to-`main` milestone with no presale UI (C26); the only visible change is the generic purchase row (Q42) in both builds; the off build carries no presale module (`check-no-presale.mjs` reads the module maps). It does **not** claim the two packages are identical (from Task 5 they differ: the on build carries the presale background modules — review 1 M4).
- [ ] The PR says what "every existing send unchanged" means: digests, integrity, challenges, pending records and validator verdicts equal the capture of 0b79442 byte for byte; a stored prepared entry equals it but for its new `kind` key, and an entry stored before the update (no `kind`) is not read — it is prepared again, its challenge carrying over (review 1 L2). And that `wallet.send` now signs only a send (D17).

## Self-review

- **Spec coverage:** the header table's B1d-1a row item by item → Tasks 1 (switch, plugin, stubs, skeletons, encoding.ts), 2 (gate + fixture + lists), 3 (registry and shared shapes), 4 (generic rendering, E2E 7), 5 (layouts, state, limits), 6 (core/geo/fetch, background gate).
- **Placeholders:** none — every step carries its code as committed in the dry run.
- **Type consistency:** checked by the replay, which compiles at every prefix.
- **Review Focus:** seven lines (rev 2 adds 6 and 7), each with its tests named.

## The controller's rulings, for the owner

- The three helpers (`SPL_TOKEN_PROGRAM`, `encodeU64LE`, `findAssociatedTokenAddress`) move to `core/solana/encoding.ts`; the spec said two (Task 2 corrects it).
- A send's digest and integrity are unchanged (the kind is the digest's domain, `'send'`); spec §1.3's "a challenge issued before the update no longer matches" is true only for a non-send kind (Task 4 corrects it).
- The generic purchase row keeps B1b's wording where no new copy exists ("Sending…", "You can now make a new attempt." on #54 without a button) — B1d-1b's purchase renderer replaces it.
- The on build keeps every module of `src/background/presale/` whole (a no-treeshake transform), so the gate's positive controls do not depend on the bundler.
- **Rent (funds-relevant):** mainnet rent measured at 5 080 lamports per byte; every rent constant is an upper bound only; B1d-1b's exact outflow check takes the new-PDA rent from the simulation, which must be > 0 and ≤ the bound (Task 6 writes it into the spec).
- The jurisdiction gate's request budget: `/geo/check` first, the list only when due and never after a failed check, none during the 403 cool-down; the list cached 10 minutes.
- **(rev 2) Every spec passage plan 1a changes**, collected as spec rev 3.1 (owner decision D16; the spec's own status paragraph lists them, and each is a diff in its task) — one line each:
  - C9 (Task 6): SOL MAX's rents are §2.1's upper-bound constants.
  - C11 (Task 6): the exact outflow check's new-PDA rent comes from the simulation, never a constant (**1b's funds-critical check**).
  - C38 (Task 2): three shared symbols move, not two.
  - §1.2 (Tasks 2, 6): `fetchGeoCheck` / `fetchRestrictedList` / `isGeoRefusal` instead of `fetchGeoInputs`; `encoding.ts` takes three symbols.
  - §1.3 (Task 4): a send's challenge still matches after the update (its digest is unchanged).
  - §1.3, §1.4 (Task 6, D17): `sendPrepared` signs only the caller's kind; `wallet.send` only a send, `presale.buy` only `presale-buy`.
  - §2.1 (Task 6): the rent ruling (5 080 lamports per byte; every rent constant an upper bound; D19).
  - §2.2 (Task 6): as built — two fetchers, absent age keys as null, the cache window, the request budget, `countryCode` only when known, `WalletDeps.geo()`, and D18's cap.
  - **§3.3 step 5** (Task 6): the simulation's accounts gain `["user", account]` when absent; `simulatedRent` (> 0 and ≤ its bound per created PDA) replaces `newPdaRent` in the outflow check (**1b's funds-critical check**).
  - §3.3 step 7 (Task 6): `PurchaseView.fees.rentLamports` = `simulatedRent`.
  - §6.2, §8.2 (Task 2): the encoding bullet and the `core/` rows name the three symbols and their three importers.
- **(rev 2) Owner decisions D16–D19, as built:** D16 — the list above, in the spec (Task 6); D17 — `sendPrepared(…, kindName = 'send')`, `wallet.send` signs only a send (Task 3); D18 — the gate's `GEO_MAX_STALENESS_DAYS = 30`, min(server, 30), a missing limit stays missing (Task 6); **D19 — needs no code:** B1b's `sender-below-rent` stays at 890 880 (stricter than the runtime's 650 240, which is the safe side); re-pinning B1b's constants from the chain is a separate later task (stated in §2.1).
