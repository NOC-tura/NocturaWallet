# Noctura Extension B1b-2a · Plan 1 — the engine extensions, the React scaffold and the read-only popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the extension every engine extension B1b-2a needs (E1–E8, the re-based and capped challenge life, the forget/replace critical section with its C4 binding and C6 guard), the React 18 scaffold shared by the popup and a new UI tab, the new isolation gates, a minimal `welcome` vault mode, and the read-only daily screens — #11 with #42 and the D26 state, #13, the account switcher, #43's sheet, #26/#27/#41, a minimal Settings tab with #38, and the popup's locked screen — exactly as spec §12 assigns to plan 1.

**Architecture:** The engine work is background code (`extension/src/background/*`) and the core reader (`core/solana/rpc.ts`), each extension with its message, refusals, partition and unit tests against the real `handleMessage`. The UI is one React 18 app (`src/app/App.tsx`) mounted by `popup.tsx` (412 × 600) and `tab.tsx` (`wallet.html`, a 412 px column); it talks to the background only through a shape-checking client (`src/app/engine.ts`), keeps no state library (the engine is the source of truth), reuses `web/src/ui/*` and `web/src/styles/design-system.css` by import, and copies the design's own screen classes into `src/styles/design-ext.css`. The vault page stays plain DOM; new gates prove no UI code, no React and no package outside five can reach it.

**Tech Stack:** TypeScript 5 (strict), React 18.3.1 + react-dom 18.3.1 (exact), `@vitejs/plugin-react` 6, Vite 8, Vitest 5 (node; `// @vitest-environment happy-dom` per component test file), `@testing-library/react` 16 + `@testing-library/dom` 10, happy-dom 20, `qrcode-generator` 2.0.4 (exact), `@scure/base`, `@solana/web3.js` 1.99 (background only), Playwright 1.63 (Chromium, contained), Node 22.12.0, npm 11.6.2.

**Spec:** `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md` (approved 2026-09-29). Read §1 (architecture, gates, message client, routing), §2 (E1–E8), §5 (#11, switcher, #13, #42), §6 (Settings, #38, #26, #27, #41, the explorer link), §7 (errors), §8 (testing) and §12 (the three-plan split) before starting. Parent spec: `docs/superpowers/specs/2026-09-27-extension-b1-design.md` (rev 5). The design: `/home/user/Downloads/index.html` and `/home/user/Downloads/screen.md` (binding, CLAUDE.md). The previous plan, `docs/superpowers/plans/2026-09-29-extension-b1b1-engine.md`, shows the engine this builds on.

**Dry run (2026-09-29).** This plan's end state was built in a scratch copy of the repository outside the checkout, and then **replayed task by task** in a second clean copy: each task's tests were applied first and run (all red, as each Step 2 below states), then its implementation (green), then `tsc --noEmit` and the whole vitest suite (green after every task, 691 → 915 tests). Under Node 22.12.0 with only `web/` and `extension/` installed (`npm ci --ignore-scripts`, npm 11.6.2): `npm run verify` in `extension/` (build, 915 tests, csp, secrets, gates incl. the two new ones, reproducible) passed; all 8 Playwright specs passed inside an offline network namespace (`unshare -rn`), the fake coordinator seeing the service worker's requests and the Solscan counter at 0; `web/`'s `npm run verify` passed (501 + 3 tests, csp, scan, reproducible); the root app's `tsc --noEmit` and the **full** root `jest` passed (180 suites, 1 228 tests; root `node_modules` linked in for that step only). Intermediate states were checked too: the wallet E2E at the end of Tasks 3 and 5, the gates at the end of Tasks 9 and 10, gates + E2E at the end of Task 16. Every mutation named below was run and turned its test red. What the dry run caught is listed at the end ("Dry-run findings"); every catch is fixed in the code below.

**Revision 2 (2026-09-30): review round 1 applied** (`.superpowers/sdd/b1b2a-plan1-review-1.md`: H1, H2, M1–M6, L1–L10 and the controller's rulings). Where each lands is listed under "Review round 1" at the end. The affected tasks (3, 5, 7, 9, 10, 12, 13, 15, 16, 17) were replayed again test-first from Task 3 on, every new mutation was run (all red), and the full end state was re-verified CI-like (`npm ci`, `verify`, all 8 E2E specs contained, `npm audit`).

## Scope, and where this plan departs from the spec or the brief — stated

Each of these is a decision the plan takes; the controller may overrule any of them before execution.

1. **Task 1 checks the E2 precondition by reading the spec, not the network.** Spec §2 E2 / §11.5 records ICO Claude's confirmation (2026-09-29, one live call) that `/api/v1/rpc` forwards `simulateTransaction`'s `accounts` unchanged. Task 1 Step 1 verifies that record is in the spec; nothing contacts `*.noc-tura.io`. The two rules §11.5 derived (never read `rentEpoch`; a missing account is `null`; lamports above 2^53 refused) are in Task 3's reader.
2. **E2's reader and E2's prepare are one task (Task 3).** Split, the reader's new `SimulationOutcome` shape leaves the old test fixtures untypable until prepare changes — a task that ends with `tsc` red. The replay found this; they ship together.
3. **E5 lives in `accountsStore.ts` (the one `serial` section), and the balance-cache writer takes the envelope's addresses from its caller.** `balanceCache.ts` reading `readWalletView` itself would make `accountsStore → balanceCache → accountsStore` a cycle once E5 clears the caches.
4. **E5 step 5 is tighter than the spec's words:** the "no unlock since the lock" check and the vault write run inside **one** `sessionMutex` call, so a `vault.setKeys` cannot land between the check and the write either; an unlock that did land answers `unlocked` (review L4 ruling), a moved revision `busy`. The spec's "one more `updatePending` read" after step 7 is done by the message handler: `readPending` + `startPoller` when anything is open (a record appended after step 4 is kept and watched, never deleted) — which keeps `accountsStore.ts` from importing `pending.ts` (that import would close a cycle once the poller reads the envelope, review M1).
5. **E3 refreshes `reasons` and `thresholdCents` with the fee fields** on a same-intent re-base (a re-prepare recomputes both); the identity fields (account, token, recipient, amount) never change. A settings challenge is never re-based as a send.
6. **E3's vault-page half is plan 2.** The #10 renderer's closed-alphabet validation, its "could not be shown" state and the `unknown-challenge → expired` mapping are the #10 screen, which spec §12 puts in plan 2. Plan 1 ships the store change, the re-base with its cap and `vault.challengeInfo` with its partition test.
7. **#43 (token selector sheet) is built but not opened in plan 1.** Spec §12 lists #43 under plan 3; the brief lists it in plan 1. Plan 1 builds `screens/TokenSheet.tsx` with its tests (it shares the sheet with the account switcher, which plan 1 needs); #12 opens it in plan 3. No route points at it.
8. **Plan-1 stand-ins, exactly spec §12's:** #11 has **no Send quick action**; the pending strip opens Activity; #26's PENDING rows open nothing; the popup does not call `preparedFor`; #27 has no `[Try again]`; `wallet.html` has one route (`#/home`, any hash shows it); `welcome` is the minimal vault mode. **Also stated here:** the popup's locked screen has **no "Forgot password?"** in plan 1 — `?mode=forgot` does not exist until #39 (plan 2), and linking it now would open the plain unlock page. Controller ruling: it moves to **plan 2**, and the spec's §12 plan-2 list gains "the popup locked screen's "Forgot password?" → `?mode=forgot`".
9. **The tab surface with no wallet does not close itself.** Spec §1.6 step 1 (open welcome, close) is written for the popup. `wallet.html` with no wallet shows #9's words "No wallet on this browser yet." with `[Set up a wallet]` → `unlock.html?mode=welcome`.
10. **Failed history rows.** The engine decodes every failed transaction as `kind: 'other'`, `token: null` (`core/solana/history.ts`), so the spec's "Failed · sent SOL" and #27's "FAILED · SENT" cannot be known. #26 shows **"Failed · transaction"** / "the network fee was charged"; #27 shows **"FAILED"**, with "· SENT" only if a future decoder reports the kind. The spec is contradictory here (see the report).
11. **#42 for "unreachable while online"** (accepted by controller ruling). When `navigator.onLine` is true the banner reads "Could not reach the Noctura server" / "Showing your last synced balances." (review L3) and, sustained, "Last synced … · N retries failed"; the callout "What you can still do offline:" shows in both. "≈ 79.04 SOL" in the design's hero line is the market total divided by the SOL price.
12. **Fonts: the spec's §1.2 L5 claim is wrong about the built path.** With `base: './'`, Vite rewrites `/fonts/Geist-Variable.woff2` to `../fonts/Geist-Variable.woff2` (relative to `assets/`), not "stays `/fonts/…`". Both resolve to `dist/app/fonts/`. The new `check-fonts.mjs` checks where each font URL **resolves**, and that both files are in the build; plan 2 extends it to the vault page's CSS and adds the `document.fonts.check('16px Geist')` E2E assertion with #1.
13. **Vitest 5 has no `environmentMatchGlobs`** (spec §8.4 names it). Every component test file starts with `// @vitest-environment happy-dom`; everything else stays `node`.
14. **The popup E2E specs (6–9) seed the wallet through the service worker**, not the vault page: a shape-valid envelope (only its public part is read by the UI) and two signing keys in `storage.session`. The vault page's unlock is covered by `unlock.spec.ts` and `wallet.spec.ts`; these specs are about the popup. `wallet.spec.ts` now sends its messages from `wallet.html` — `popup.html`, with no wallet, opens the welcome page and closes itself (§1.6).
15. **The E2E fake parses v0 transactions by hand.** Under Playwright's loader `@solana/web3.js`'s CommonJS dependencies do not load ("module is not linked"); the fake reads the signature count, the static keys and the instructions itself.
16. **The visual pass (§8.6) runs in Task 17**, the first point at which the popup can be opened with fixtures. Each screen task lists the states it adds to that pass.
17. **Two welcome tabs are possible, and accepted (review L9, documented):** on install, `onInstalled` opens `unlock.html?mode=welcome`; if the user clicks the toolbar icon before finishing setup, the popup (no wallet) opens a second one. Deduplicating would need the `tabs` query permission for extension pages (or a background message to find the tab) — a permission this plan does not add for a cosmetic case. Both tabs show the same fixed page; creating in either is safe (a first write refuses when a wallet exists).
18. **What plan 1 does not build, loudly** (spec §12 → plans 2 and 3): #1–#10, #39, #40, #7 and the vault-page restyle (plan 2); #12, #19, #20, #21, #44, #54, #43's opener (plan 3); E2E specs 1–5 and 10–12. From the design screens plan 1 does build, every omission is in that screen's "Differs" list in the spec and is asserted absent by a test (Send/Swap/Buy/bell/scan/24 h/presale banner on #11; Share on #13/#27; Block/Memo/Save on #27; Swaps/Shielded chips and fiat per row on #26; View popular dApps on #41; everything of #31 but three rows; Terms/Privacy/licences/help on #38).

## Global Constraints

Every task's requirements include these. Spec quotations are verbatim.

- CLAUDE.md: TypeScript strict — **no `any`, no `@ts-ignore`**; **no placeholders** (`// TODO` never); **money is BigInt in the smallest unit** — every amount crosses a message or storage as a decimal string and becomes `bigint` in the client; **UTC everywhere** (`Date.now()` ms), local time only in `src/app/format.ts`; **rule 6** — "`LockedButton` disables itself synchronously in the click handler and re-enables no earlier than 500 ms after the click **and** not before its promise settles."
- CLAUDE.md: the design (`/home/user/Downloads/index.html`, `screen.md`) is binding — build every state it draws; "never silently omit design elements": every scope-down is in the spec's "Differs" list and stated in the task.
- Spec: "Copy in "quotes" is the design's English, unchanged, unless it is marked **→ adapted**." Every string a plan-1 screen shows is the spec's; the component tests assert them exactly.
- Spec S1: "The vault page stays **plain DOM, no React**." The gates enforce it (Tasks 9 and 16).
- Spec §1.6: "**The engine is the source of truth.** No state library"; "**No hash causes an action.**"; "No other timer reads the network; refresh is on open and on the refresh button (D2)."
- Spec §1.5: every reply is shape-checked; "A reply of the wrong shape becomes `{ok: false, error: 'failed'}`. A thrown `sendMessage` … is retried once after 300 ms, then becomes `'failed'`."
- Spec §6.5: Solscan is "the **only external link** in B1b-2a"; "**A link only: nothing is fetched.**" No CSP change, no host permission, no manifest change in this plan.
- Spec (Decisions): D27 "USD only"; D4 "Hide the shielded toggle and variants"; D19 "Share → copy only"; spec §4 "no auto-clear" of the clipboard, and the screen says so.
- Spec (Carried): "full addresses in groups of four at equal weight" on verification surfaces (`web/src/ui/AddressGroups.tsx`); lists may show first 4 … last 4 at equal weight (§11.7).
- **The TGE date is never written** — not in code, tests, fixtures, comments, docs or commit messages. Task 9's gate assembles its forms from parts.
- **No test ever contacts `*.noc-tura.io` or `solscan.io`.** Unit tests inject readers and fetches; the E2E routes `https://api.noc-tura.io/**` to a fake, routes `solscan.io` to an abort counter, and maps every `noc-tura.io` and `solscan.io` name to `~NOTFOUND` (`--host-resolver-rules`); every spec asserts the counters.
- The RPC method allowlist is unchanged (the spec's eleven methods); the vault page never touches the network; `storage.*` only in the background; runtime listeners only in the background.
- Versions: React and react-dom **18.3.1 exact**, `qrcode-generator` **2.0.4 exact**; npm **11.6.2**; Node **22.12.0** in CI; the extension installs with `npm ci --ignore-scripts`.
- **Standing process rules (B1b-1):** implementers run mutations **in a scratch copy outside the repo**, never in the checkout; every task that touches `core/` or the root app's `src/` runs the **full** root `jest` (no task here touches the root `src/`; Tasks 1 and 3 touch `core/`); before pushing, reproduce CI with **only** `web/` and `extension/` installed and Node 22.12: `PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`; the E2E has **no value imports from `core/`**; E2E containment is `ctx.route` + `--host-resolver-rules` for `noc-tura.io` **and** `solscan.io`, with the counters asserted 0; never contact `*.noc-tura.io` from tests.
- Prettier style of the surrounding code: single quotes, trailing commas, no spaces inside braces (`{a, b}`), no parens around a single arrow parameter.
- Every commit ends with the **executing model's own truthful `Co-Authored-By:` line**; the commit blocks below mark its place as `Co-Authored-By: <the executing model's own line>`.

## How to read the steps

- A **new file** is given in full. A **changed file** is given as a unified diff against the file as the previous task left it; apply it with `git apply --recount` from the repository root (save the block to a file first), or by hand — every hunk is exact.
- Commands run from `extension/` unless they start with `cd`. "Whole suite" means `npx tsc --noEmit && npx vitest run`; its expected totals are the dry run's.
- Mutations are run **in a scratch copy outside the repository** (`git worktree` is not outside it): copy the checkout, apply the edit there, run the named test, expect it red, discard the copy.

## File map

| path | task | responsibility |
|---|---|---|
| `core/solana/rpc.ts` (+ test) | 1, 3 | `RequestUnreachable`; `simulateTransaction` with `accounts` + `slot`; `getAccountKind` |
| `core/solana/broadcast.ts` | 1 | lets `RequestUnreachable` through unwrapped |
| `extension/src/background/deps.ts` | 1 | `timedFetch` turns a rejected fetch into `RequestUnreachable`; `RequestTimedOut` is its subclass |
| `extension/src/background/walletApi.ts` | 1, 2, 4, 5 | `unreachable`; `wallet.prices`, `wallet.cached`, the cache write; settings `about`; `wallet.recipientInfo`, `wallet.discardPrepared` |
| `extension/src/background/balanceCache.ts` | 2 | `v1_balance_cache`, `v1_price_cache` (E4) |
| `extension/src/background/prepare.ts`, `sendTypes.ts` | 3, 4, 5 | the simulation and `simulation-mismatch` (E2); challenge `about` + re-base (E3); `isKnownRecipient`, `discardPrepared` (E6, E7) |
| `extension/src/background/reauthChallenges.ts` | 4, 5 | `about`, `issuedAt`, `rebaseChallenge` with the 10-minute cap, `challengeInfo`; `dropChallengesFor` |
| `extension/src/background/messages.ts` | 4, 7 | `vault.challengeInfo`, `vault.forgetWallet` (vault page only); `vault.setKeys` bound to the stored envelope (review H1) |
| `extension/src/background/knownRecipients.ts`, `pending.ts` | 5 | `{address, at}` entries, `lastSentAt`, `isKnownRecipient` |
| `extension/src/background/pendingStore.ts`, `pending.ts` | 6, 7 | `failure: 'landed' | 'not-sent' | null` (E8); known recipients only for the stored wallet's accounts (review M1) |
| `extension/src/background/accountsStore.ts` | 7 | `forgetWallet` (E5: C4, C6, H1, R2-M1), the first write's cleanup |
| `extension/src/background/index.ts`, `src/unlock/mode.ts`, `modes.ts`, `unlock.html` | 8 | `runtime.onInstalled` → welcome; the minimal `welcome` mode |
| `extension/scripts/check-vault-isolation.mjs`, `check-rpc-methods.mjs`, `check-no-tge-date.mjs`, `check-fonts.mjs` (+ tests) | 2, 9, 16 | owned keys; vault-page allowlist, stand-alone modules, `src/shared` ↛ UI; `.tsx`; the TGE-date gate; ENTRIES + React marker; fonts |
| `extension/package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `public/fonts/*` | 10, 16 | React, the test stack, `qrcode-generator`; the shared-resolution plugin; JSX; fonts; `wallet.html` input |
| `extension/src/styles/design-ext.css` | 10 | the design's screen classes, extracted from `index.html` |
| `extension/src/shared/amount.ts` | 10 | `parseAmount`, `formatAmount` (pure, stand-alone) |
| `extension/src/app/engine.ts`, `format.ts`, `valuation.ts`, `prefs.ts`, `platform.ts`, `useNow.ts` | 10 | the message client; words and numbers; UI prefs; browser calls |
| `extension/src/app/ui/*` | 11 | ExtIcon, LockedButton, Banner, Toast, Skeleton, Chip, StatusPill, ListRow, TabBar, TokenTile, TopBar, Sheet, QrCode, useCopy |
| `extension/src/app/WalletContext.tsx`, `screens/Home.tsx` | 12 | the open sequence, polling, network state; #11 + #42 + D26 |
| `extension/src/app/screens/Switcher.tsx`, `TokenSheet.tsx` | 13 | the account switcher; #43's sheet |
| `extension/src/app/screens/Receive.tsx` | 14 | #13 |
| `extension/src/app/history.ts`, `explorer.ts`, `screens/Activity.tsx`, `TxDetail.tsx` | 15 | #26, #41, #27, the Solscan link |
| `extension/src/app/App.tsx`, `router.ts`, `mount.tsx`, `popup.tsx`, `tab.tsx`, `app.css`, `screens/{Locked,NoWallet,Settings,About}.tsx`, `popup.html`, `wallet.html` | 16 | the app shell, both surfaces, Settings, #38, the locked screen |
| `extension/e2e/*` | 3, 5, 16, 17, 18 | the fake's simulation; recipients format; `wallet.html`; containment, the fake's switches, the visual pass; specs 6–9 |
| `.github/workflows/extension.yml` | 16 | CI runs on `web/src/ui`, `web/src/styles`, `web/public/fonts` changes too |

---

### Task 1: The E2 precondition, and `unreachable` — a request that got no answer (E4, part 1)

**Files:**
- Modify: `core/solana/broadcast.ts`
- Modify: `core/solana/rpc.ts`
- Modify: `extension/src/background/deps.ts`
- Modify: `extension/src/background/walletApi.ts`
- Test (create): `extension/src/background/__tests__/unreachable.test.ts`

**Interfaces:**
- Consumes: B1b-1: `createRpc`, `createJsonGetter`, `broadcastSigned`, `timedFetch`, `walletApi.failure()`.
- Produces:
  - `core/solana/rpc.ts`: `class RequestUnreachable extends Error { constructor(what: string, why: string) }`
  - `extension/src/background/deps.ts`: `export {RequestUnreachable}`; `class RequestTimedOut extends RequestUnreachable`; `timedFetch` rejects with `RequestUnreachable` when the fetch itself rejects
  - every `wallet.*` message that reads the network: refusal `'unreachable'`

Spec §2 E4: "a request that got no answer (`RequestTimedOut`, 20 s, or the fetch itself rejecting: DNS, offline, connection reset) is refused as `unreachable` instead of `failed`, on every message that reads the network". #42 needs this code to tell "offline" from "something failed". `RequestUnreachable` lives in `core/solana/rpc.ts` beside `RpcForbidden` (core owns the transport errors; `broadcast.ts` must name it to let it through), and `deps.ts` re-exports it with `RequestTimedOut` as its subclass. The pending record's own rules are unchanged: `deliver()` already treats every non-refusal as "not acknowledged".

- [ ] **Step 0: Check the E2 precondition (no network).** Spec §12 plan 1: "First task: record ICO Claude's confirmation that the proxy forwards `simulateTransaction`'s `accounts` unchanged. E2 does not start without it."

Run (from the repository root): `grep -n "Confirmed 2026-09-29" docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
Expected: one match, in §11 item 5 ("**Confirmed 2026-09-29** (one live call through `/api/v1/rpc` …): the proxy checks only the method name and forwards the body unchanged"). If it is missing, stop Task 3 (E2) and ask the controller; Tasks 1–2 and 4–18 do not depend on it. Do not make the call yourself.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/__tests__/unreachable.test.ts`:

```ts
import {REQUEST_TIMEOUT_MS, RequestTimedOut, RequestUnreachable, createJsonGetter, timedFetch} from '../deps';
import {handleWallet} from '../walletApi';
import {RpcForbidden, createForbiddenLatch, createRpc, solanaReader} from '../../../../core/solana/rpc';
import {BroadcastUnavailable, broadcastSigned} from '../../../../core/solana/broadcast';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, signedWire} from './fixtures';

// Spec B1b-2a E4: a request that got no answer is 'unreachable', never 'failed' — #42 needs the code
// to tell "offline" from "something failed". Nothing here opens a socket: fetch is stubbed.
describe('RequestUnreachable (E4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('timedFetch turns a rejected fetch (offline, DNS, reset) into RequestUnreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const e = await timedFetch(REQUEST_TIMEOUT_MS)('https://example.invalid/x', {method: 'GET'}).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(RequestUnreachable);
    expect(e).not.toBeInstanceOf(RpcForbidden);
  });

  it('a timeout is a RequestUnreachable too (RequestTimedOut is its subclass)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const settled = timedFetch(REQUEST_TIMEOUT_MS)('https://example.invalid/x', {method: 'GET'}).catch((x: unknown) => x);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    const e = await settled;
    expect(e).toBeInstanceOf(RequestTimedOut);
    expect(e).toBeInstanceOf(RequestUnreachable);
  });

  // Each client must let it through UNWRAPPED — the same instance — or the message layer sees 'failed'.
  const lost = new RequestUnreachable('https://example.invalid', 'offline');
  const rejecting = async (): Promise<never> => {
    throw lost;
  };

  it('createRpc lets it propagate unwrapped', async () => {
    const reader = solanaReader(createRpc({fetch: rejecting, latch: createForbiddenLatch()}));
    await expect(reader.getBlockHeight()).rejects.toBe(lost);
  });

  it('createJsonGetter lets it propagate unwrapped', async () => {
    await expect(createJsonGetter(rejecting, createForbiddenLatch()).get('/stats')).rejects.toBe(lost);
  });

  it('broadcastSigned lets it propagate unwrapped (any other failure to reach is still BroadcastUnavailable)', async () => {
    await expect(broadcastSigned({fetch: rejecting, latch: createForbiddenLatch()}, signedWire())).rejects.toBe(lost);
    const typeError = async (): Promise<never> => {
      throw new TypeError('Failed to fetch');
    };
    await expect(broadcastSigned({fetch: typeError, latch: createForbiddenLatch()}, signedWire())).rejects.toBeInstanceOf(BroadcastUnavailable);
  });

  it('the message layer answers unreachable for a timeout and a rejected fetch, coordinator-refused for a 403, failed for anything else', async () => {
    const withError = (e: Error) =>
      fakeDeps({
        reader: fakeReader({
          getBalance: async () => {
            throw e;
          },
          getTokenAccountsByOwner: async () => [],
        }),
      });
    const ask = (e: Error) => handleWallet(fakeExt(), withError(e), 'wallet.balances', {account: ACCOUNT.publicKey});
    expect(await ask(new RequestTimedOut('u', 1))).toEqual({ok: false, error: 'unreachable'});
    expect(await ask(new RequestUnreachable('u', 'offline'))).toEqual({ok: false, error: 'unreachable'});
    expect(await ask(new RpcForbidden('getBalance'))).toEqual({ok: false, error: 'coordinator-refused'});
    expect(await ask(new Error('boom'))).toEqual({ok: false, error: 'failed'});
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/background/__tests__/unreachable.test.ts`
Expected: FAIL — `TypeError: RequestUnreachable is not a constructor` (the export does not exist yet); `Tests  no tests`.

- [ ] **Step 3: Implement.**

Modify `core/solana/broadcast.ts`:

```diff
diff --git a/core/solana/broadcast.ts b/core/solana/broadcast.ts
--- a/core/solana/broadcast.ts
+++ b/core/solana/broadcast.ts
@@ -1,5 +1,5 @@
 import {base58, base64} from '@scure/base';
-import {API_BASE, RpcForbidden, type FetchLike, type FetchResponse, type ForbiddenLatch} from './rpc';
+import {API_BASE, RequestUnreachable, RpcForbidden, type FetchLike, type FetchResponse, type ForbiddenLatch} from './rpc';
 
 /**
  * The coordinator's broadcast-only route (spec §4 "Broadcast — through the coordinator"). The
@@ -81,7 +81,9 @@ export async function broadcastSigned(opts: {fetch: FetchLike; latch: ForbiddenL
       opts.fetch(opts.endpoint ?? BROADCAST_ENDPOINT, {method: 'POST', headers: {'content-type': 'application/json'}, body, credentials: 'omit'}),
     );
   } catch (e) {
-    if (e instanceof RpcForbidden) throw e;
+    // A 403 is terminal; no answer at all is the caller's to name ("unreachable"). Both mean "not
+    // acknowledged" to the pending record, which keeps watching either way.
+    if (e instanceof RpcForbidden || e instanceof RequestUnreachable) throw e;
     throw new BroadcastUnavailable(null);
   }
   if (res.status === 400) {
```

Modify `core/solana/rpc.ts`:

```diff
diff --git a/core/solana/rpc.ts b/core/solana/rpc.ts
--- a/core/solana/rpc.ts
+++ b/core/solana/rpc.ts
@@ -93,6 +93,18 @@ export class RpcMalformed extends Error {
     this.name = 'RpcMalformed';
   }
 }
+/**
+ * A coordinator request that got no answer: the fetch itself rejected (DNS, offline, a reset
+ * connection) or its deadline passed (extension/src/background/deps.ts timedFetch). Not a 403 — it
+ * never trips the cool-down — and not "failed": the screens say the server could not be reached.
+ * Every client in core/ lets it through unwrapped, so the caller can tell the two apart.
+ */
+export class RequestUnreachable extends Error {
+  constructor(what: string, why: string) {
+    super(`${what}: ${why}`);
+    this.name = 'RequestUnreachable';
+  }
+}
 
 export type FetchResponse = {status: number; json(): Promise<unknown>};
 
```

Modify `extension/src/background/deps.ts`:

```diff
diff --git a/extension/src/background/deps.ts b/extension/src/background/deps.ts
--- a/extension/src/background/deps.ts
+++ b/extension/src/background/deps.ts
@@ -1,6 +1,6 @@
 import type {JsonGetter} from '../../../core/ports';
 import type {Ext} from '../ext';
-import {API_BASE, RpcHttpError, createForbiddenLatch, createRpc, solanaReader, type FetchLike, type ForbiddenLatch, type LatchStore, type SolanaReader} from '../../../core/solana/rpc';
+import {API_BASE, RequestUnreachable, RpcHttpError, createForbiddenLatch, createRpc, solanaReader, type FetchLike, type ForbiddenLatch, type LatchStore, type SolanaReader} from '../../../core/solana/rpc';
 import {PRESALE_STAGE_PRICES} from '../../../core/presale/stagePrices';
 import {broadcastSigned} from '../../../core/solana/broadcast';
 import {fetchUsdPrices} from '../../../core/portfolio/prices';
@@ -65,10 +65,12 @@ export const REQUEST_TIMEOUT_MS = 20_000;
 /** The broadcast route forwards to the network before answering: a little longer. */
 export const BROADCAST_TIMEOUT_MS = 30_000;
 
-/** A coordinator request got no answer in time. Not a 403: it never trips the cool-down. */
-export class RequestTimedOut extends Error {
+export {RequestUnreachable};
+
+/** A coordinator request got no answer in time. Not a 403: it never trips the cool-down. Unreachable, like a rejected fetch. */
+export class RequestTimedOut extends RequestUnreachable {
   constructor(url: string, ms: number) {
-    super(`${url}: no answer within ${ms} ms; aborted`);
+    super(url, `no answer within ${ms} ms; aborted`);
     this.name = 'RequestTimedOut';
   }
 }
@@ -77,7 +79,8 @@ export class RequestTimedOut extends Error {
  * globalThis.fetch with a deadline covering the response AND its body: the request is aborted and
  * the promise rejected when the deadline passes — even if the fetch ignored the abort — so the
  * latch moves on to the next request. The timer is cleared as soon as the body is read (or the
- * fetch fails), so a finished request leaves nothing behind.
+ * fetch fails), so a finished request leaves nothing behind. A fetch that rejects (DNS, offline, a
+ * reset connection) becomes RequestUnreachable, as a deadline does: "no answer", never "failed".
  */
 export function timedFetch(ms: number): FetchLike {
   return async (url, init) => {
@@ -104,7 +107,8 @@ export function timedFetch(ms: number): FetchLike {
       };
     } catch (e) {
       done();
-      throw e;
+      if (e instanceof RequestUnreachable) throw e;
+      throw new RequestUnreachable(url, `the request failed (${e instanceof Error ? e.message : String(e)})`);
     }
   };
 }
```

Modify `extension/src/background/walletApi.ts`:

```diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -15,7 +15,7 @@ import {isOpen, readPending, viewOf} from './pendingStore';
 import {createHistory, type History} from './history';
 import {ResendRefused, SendRefused, SentUnconfirmed} from './sendTypes';
 import {readWalletBalances, WALLET_TOKENS} from '../../../core/solana/balances';
-import {RpcForbidden} from '../../../core/solana/rpc';
+import {RequestUnreachable, RpcForbidden} from '../../../core/solana/rpc';
 
 export type Result = {ok: true; data?: unknown} | {ok: false; error: string; data?: unknown};
 
@@ -72,8 +72,9 @@ function historyFor(deps: WalletDeps): History {
 /**
  * Every refusal is a fixed code. A 403 — and the latch refusing during the cool-down that follows
  * one (RpcCoolingDown, a subclass) — is 'coordinator-refused': terminal, never retried. A send
- * recorded (and possibly broadcast) whose state could not be read back is 'check-pending'. Anything
- * unexpected is 'failed', never a thrown error across the message boundary.
+ * recorded (and possibly broadcast) whose state could not be read back is 'check-pending'. A request
+ * that got no answer is 'unreachable'. Anything unexpected is 'failed', never a thrown error across
+ * the message boundary.
  */
 function failure(e: unknown): Result {
   if (e instanceof SendRefused) {
@@ -84,6 +85,8 @@ function failure(e: unknown): Result {
   // Recorded and possibly broadcast: not 'failed' — the screens send the user to wallet.pending.
   if (e instanceof SentUnconfirmed) return {ok: false, error: 'check-pending', data: {id: e.id, signature: e.signature}};
   if (e instanceof RpcForbidden) return {ok: false, error: 'coordinator-refused'};
+  // No answer at all (a timeout, or the fetch rejecting): the screens say "could not reach", never "failed".
+  if (e instanceof RequestUnreachable) return {ok: false, error: 'unreachable'};
   return {ok: false, error: 'failed'};
 }
 
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/background/__tests__/unreachable.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 55 files, 697 tests.

- [ ] **Step 6: The root app, because `core/` changed** (standing rule). From the repository root, with the root install present:

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; `Test Suites: 1 skipped, 180 passed` · `Tests: 1 skipped, 1228 passed` (the dry run's numbers at the end of this plan; no root test changes in this plan).

- [ ] **Step 7: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **drop the mapping:** in `walletApi.ts` `failure()`, delete the line `if (e instanceof RequestUnreachable) return {ok: false, error: 'unreachable'};`. Run `npx vitest run src/background/__tests__/unreachable.test.ts` → RED: 1 failed (the message-layer test).
  - **wrap it in broadcast:** in `core/solana/broadcast.ts`, change `if (e instanceof RpcForbidden || e instanceof RequestUnreachable) throw e;` back to `if (e instanceof RpcForbidden) throw e;`. Run `npx vitest run src/background/__tests__/unreachable.test.ts` → RED: 1 failed ("broadcastSigned lets it propagate unwrapped").
  - **rethrow the raw fetch error:** in `deps.ts` `timedFetch`'s `catch`, replace the two lines after `done();` with `throw e;`. Run `npx vitest run src/background/__tests__/unreachable.test.ts` → RED: 1 failed.

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add core/solana/broadcast.ts core/solana/rpc.ts extension/src/background/__tests__/unreachable.test.ts extension/src/background/deps.ts extension/src/background/walletApi.ts
git commit -m "feat(extension): 'unreachable' — a coordinator request that got no answer (B1b-2a E4)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 2: `wallet.prices` (E1), the balance and price caches and `wallet.cached` (E4)

**Files:**
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Create: `extension/src/background/balanceCache.ts`
- Modify: `extension/src/background/walletApi.ts`
- Test (modify): `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Test (create): `extension/src/background/__tests__/balanceCache.test.ts`
- Test (modify): `extension/src/background/__tests__/messages.test.ts`

**Interfaces:**
- Consumes: Task 1's `RequestUnreachable`; B1b-1's `deps.prices()`, `deps.stagePrice()`, `readWalletView`, `readWalletBalances`.
- Produces:
  - `balanceCache.ts`: `BALANCE_CACHE_KEY = 'v1_balance_cache'`, `PRICE_CACHE_KEY = 'v1_price_cache'`; `interface CachedBalances {sol, noc, usdc, usdt: string; at: number}`; `interface PriceView {sol, usdc, usdt, noc: number | null; at: number}`; `readCachedBalances(ext, account)`, `readCachedPrices(ext)`, `writeCachedBalances(ext, envelope: readonly string[], account, b, at)`, `writeCachedPrices(ext, p)`, `clearCaches(ext)`
  - messages `{type: 'wallet.prices'}` → `PriceView`; `{type: 'wallet.cached', account}` → `{balances: CachedBalances | null, prices: PriceView | null}` (refusals `malformed`, `locked`)
  - `WALLET_TYPES` gains `'wallet.prices'`, `'wallet.cached'`

Spec §2 E1: SOL/USDC/USDT from `/wallet/prices`, NOC at the stage price from `/stats`, "The two reads are independent: if one fails, only its fields are `null`. If both fail, the reply is the first read's refusal. A 403 from either is never swallowed." Values are re-validated finite and > 0, else `null`, never 0. E4: `v1_balance_cache` (written after every successful `wallet.balances`, trimmed to the envelope's accounts) and `v1_price_cache`; `wallet.cached` "is not served while locked". Both keys join `BACKGROUND_OWNED_KEYS`, so no other file may even name them. The cache writer takes the envelope's addresses from its caller (see Scope item 3).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -341,6 +341,13 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
       OWNED('src/popup/main.ts', 'v1_forbidden_until'),
     ]);
   });
+  // B1b-2a E4: the balance and price caches are the background's too.
+  it('lets only the background name the two cache keys', () => {
+    const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
+    expect(sourceViolations([f('src/background/balanceCache.ts', "export const BALANCE_CACHE_KEY = 'v1_balance_cache'; export const P = 'v1_price_cache';")])).toEqual([]);
+    expect(sourceViolations([f('src/app/screens/Home.tsx', "const k = 'v1_balance_cache';")])).toEqual([OWNED('src/app/screens/Home.tsx', 'v1_balance_cache')]);
+    expect(sourceViolations([f('src/popup/main.ts', "const k = 'v1_price_cache';")])).toEqual([OWNED('src/popup/main.ts', 'v1_price_cache')]);
+  });
 });
 
 describe('vault isolation (HTML entries)', () => {
```

Create `extension/src/background/__tests__/balanceCache.test.ts`:

```ts
import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY, clearCaches, readCachedBalances, readCachedPrices, writeCachedBalances} from '../balanceCache';
import {handleWallet} from '../walletApi';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {browserDeps} from '../deps';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from './fixtures';

const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT.publicKey}]};
const NOC = WALLET_TOKENS.NOC.mint as string;
const balanceReader = () => fakeReader({getBalance: async () => 7n, getTokenAccountsByOwner: async () => [{pubkey: 'a', mint: NOC, owner: ACCOUNT.publicKey, amount: 12n, decimals: 9}]});

describe('wallet.prices (E1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps /wallet/prices and the stage price to numbers, with the time, and caches them', async () => {
    const ext = fakeExt();
    const deps = fakeDeps({prices: async () => ({solana: 150, usdc: 1, usdt: 0.999}), stagePrice: async () => 0.1501});
    const r = await handleWallet(ext, deps, 'wallet.prices', {});
    expect(r).toEqual({ok: true, data: {sol: 150, usdc: 1, usdt: 0.999, noc: 0.1501, at: deps.clock.t}});
    expect(await readCachedPrices(ext)).toEqual({sol: 150, usdc: 1, usdt: 0.999, noc: 0.1501, at: deps.clock.t});
  });

  it('one source failing nulls only its own fields', async () => {
    const noStats = fakeDeps({stagePrice: async () => {
      throw new Error('stats down');
    }});
    expect((await handleWallet(fakeExt(), noStats, 'wallet.prices', {})).data).toMatchObject({sol: 150, usdc: 1, usdt: 1, noc: null});
    const noMarket = fakeDeps({prices: async () => {
      throw new RequestUnreachable('u', 'offline');
    }});
    expect((await handleWallet(fakeExt(), noMarket, 'wallet.prices', {})).data).toMatchObject({sol: null, usdc: null, usdt: null, noc: 0.1501});
  });

  it("both failing is the first read's refusal, and nothing is cached", async () => {
    const ext = fakeExt();
    const down = fakeDeps({
      prices: async () => {
        throw new RequestUnreachable('u', 'offline');
      },
      stagePrice: async () => {
        throw new Error('x');
      },
    });
    expect(await handleWallet(ext, down, 'wallet.prices', {})).toEqual({ok: false, error: 'unreachable'});
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });

  it('a 403 from either source is never swallowed', async () => {
    const forbidden = fakeDeps({stagePrice: async () => {
      throw new RpcForbidden('/stats');
    }});
    expect(await handleWallet(fakeExt(), forbidden, 'wallet.prices', {})).toEqual({ok: false, error: 'coordinator-refused'});
  });

  it('a 403 sends no second request: the shared latch refuses the other read locally', async () => {
    let requests = 0;
    vi.stubGlobal('fetch', async () => (requests++, {status: 403, json: async () => null}));
    const ext = fakeExt();
    expect(await handleWallet(ext, browserDeps(ext), 'wallet.prices', {})).toEqual({ok: false, error: 'coordinator-refused'});
    expect(requests).toBe(1);
  });

  it('a non-finite, zero or negative price is null, never 0', async () => {
    const odd = fakeDeps({prices: async () => ({solana: Number.NaN, usdc: 0, usdt: -1}), stagePrice: async () => Number.POSITIVE_INFINITY});
    expect((await handleWallet(fakeExt(), odd, 'wallet.prices', {})).data).toMatchObject({sol: null, usdc: null, usdt: null, noc: null});
  });

  it('is refused from a web page (the privileged partition)', async () => {
    const ext = fakeExt();
    const web = {id: ext.runtimeId, origin: 'https://evil.example', url: 'https://evil.example/'};
    expect(await handleMessage(ext, {type: 'wallet.prices'}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
  });
});

describe('cached balances and prices (E4)', () => {
  it('a successful wallet.balances is cached for an envelope account; a refusal writes nothing', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    const deps = fakeDeps({reader: balanceReader()});
    await handleWallet(ext, deps, 'wallet.balances', {account: ACCOUNT.publicKey});
    expect(await readCachedBalances(ext, ACCOUNT.publicKey)).toEqual({sol: '7', noc: '12', usdc: '0', usdt: '0', at: deps.clock.t});
    const failing = fakeDeps({reader: fakeReader({getBalance: async () => {
      throw new RequestUnreachable('u', 'x');
    }, getTokenAccountsByOwner: async () => []})});
    const other = fakeExt();
    await other.local.set(VAULT_KEY, ENV);
    expect(await handleWallet(other, failing, 'wallet.balances', {account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'unreachable'});
    expect(await other.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
  });

  it('only envelope accounts are cached, and each write trims the rest', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    await ext.local.set(BALANCE_CACHE_KEY, {[RECIPIENT]: {sol: '1', noc: '0', usdc: '0', usdt: '0', at: 1}});
    await writeCachedBalances(ext, [ACCOUNT.publicKey], RECIPIENT, {sol: '5', noc: '0', usdc: '0', usdt: '0'}, 2);
    // Not an envelope account: nothing written (the stale entry is still there, untouched).
    expect(Object.keys((await ext.local.get(BALANCE_CACHE_KEY)) as object)).toEqual([RECIPIENT]);
    await writeCachedBalances(ext, [ACCOUNT.publicKey], ACCOUNT.publicKey, {sol: '5', noc: '0', usdc: '0', usdt: '0'}, 3);
    expect(Object.keys((await ext.local.get(BALANCE_CACHE_KEY)) as object)).toEqual([ACCOUNT.publicKey]);
  });

  it('wallet.cached: refused while locked, served while unlocked', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    await writeCachedBalances(ext, [ACCOUNT.publicKey], ACCOUNT.publicKey, {sol: '5', noc: '1', usdc: '2', usdt: '3'}, 9);
    await ext.local.set(PRICE_CACHE_KEY, {sol: 150, usdc: 1, usdt: 1, noc: null, at: 9});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.cached', {account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'locked'});
    await unlocked(ext);
    expect(await handleWallet(ext, fakeDeps(), 'wallet.cached', {account: ACCOUNT.publicKey})).toEqual({
      ok: true,
      data: {balances: {sol: '5', noc: '1', usdc: '2', usdt: '3', at: 9}, prices: {sol: 150, usdc: 1, usdt: 1, noc: null, at: 9}},
    });
    expect(await handleWallet(ext, fakeDeps(), 'wallet.cached', {account: 'nope'})).toEqual({ok: false, error: 'malformed'});
  });

  it('a shape-violating stored cache reads as null', async () => {
    const ext = fakeExt();
    await ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: {sol: '5', noc: 1, usdc: '2', usdt: '3', at: 9}});
    await ext.local.set(PRICE_CACHE_KEY, {sol: 0, usdc: 1, usdt: 1, noc: null, at: 9});
    expect(await readCachedBalances(ext, ACCOUNT.publicKey)).toBeNull();
    expect(await readCachedPrices(ext)).toBeNull();
    await ext.local.set(BALANCE_CACHE_KEY, {['__proto__']: {}});
    expect(await readCachedBalances(ext, 'constructor')).toBeNull();
  });

  it('clearCaches removes both keys', async () => {
    const ext = fakeExt();
    await ext.local.set(BALANCE_CACHE_KEY, {});
    await ext.local.set(PRICE_CACHE_KEY, {});
    await clearCaches(ext);
    expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });

  it('wallet.cached is refused from a web page', async () => {
    const ext = fakeExt();
    const web = {id: ext.runtimeId, origin: 'https://evil.example', url: 'https://evil.example/'};
    expect(await handleMessage(ext, {type: 'wallet.cached', account: ACCOUNT.publicKey}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
  });
});
```

Modify `extension/src/background/__tests__/messages.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -192,7 +192,7 @@ describe('message partitions (B1b-1 types)', () => {
   const ALL = [
     'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
-    'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
+    'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
   ];
 
   it('every privileged type is refused from a web page and from another extension', async () => {
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/background/__tests__/balanceCache.test.ts src/background/__tests__/messages.test.ts scripts/__tests__/check-vault-isolation.test.mjs`
Expected: FAIL — `Cannot find module '../balanceCache'`; `× lets only the background name the two cache keys`; `× every privileged type is refused from a web page and from another extension` (the exhaustive type list).

- [ ] **Step 3: Implement.**

Modify `extension/scripts/check-vault-isolation.mjs`:

```diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -65,7 +65,8 @@ const LISTENS_RUNTIME = /\bon(?:Message|Connect)(?:External)?\b/;
 const LISTEN_ALLOWED = /^src\/background\//;
 // storage.local keys only the background writes (plan B1b-1): no other file may even name them —
 // a popup writing v1_settings could undo a re-authenticated setting without re-authenticating.
-export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until'];
+// B1b-2a E4 adds the two caches: a popup writing one could show a balance the chain never had.
+export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache'];
 const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
 
 // A string that exists only in the vault's envelope code (the passkey-wrap HKDF info).
```

Create `extension/src/background/balanceCache.ts`:

```ts
import type {Ext} from '../ext';
import {createMutex} from './mutex';

/**
 * The last balances and prices the background read, so a popup opened offline or before the network
 * answers shows something — marked stale until a fresh read replaces it (spec B1b-2a E4). storage.local,
 * written only by the background (scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS). Public data
 * of public addresses: the same exposure the envelope's own account list has.
 */
export const BALANCE_CACHE_KEY = 'v1_balance_cache';
export const PRICE_CACHE_KEY = 'v1_price_cache';

/** Base units as decimal strings (rule 2), and when they were read (epoch ms). */
export interface CachedBalances {
  sol: string;
  noc: string;
  usdc: string;
  usdt: string;
  at: number;
}

/** USD per whole token; null when unknown — never 0. `noc` is the presale stage price. */
export interface PriceView {
  sol: number | null;
  usdc: number | null;
  usdt: number | null;
  noc: number | null;
  at: number;
}

const serial = createMutex();
const DIGITS = /^\d{1,20}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isPrice = (x: unknown): x is number | null => x === null || (typeof x === 'number' && Number.isFinite(x) && x > 0);

/** A stored entry is a claim: only the exact shape is read, anything else is null. */
function balancesOf(x: unknown): CachedBalances | null {
  if (!isObj(x)) return null;
  const {sol, noc, usdc, usdt, at} = x;
  for (const v of [sol, noc, usdc, usdt]) if (typeof v !== 'string' || !DIGITS.test(v)) return null;
  if (!isTime(at)) return null;
  return {sol: sol as string, noc: noc as string, usdc: usdc as string, usdt: usdt as string, at};
}

function pricesOf(x: unknown): PriceView | null {
  if (!isObj(x)) return null;
  const {sol, usdc, usdt, noc, at} = x;
  if (!isPrice(sol) || !isPrice(usdc) || !isPrice(usdt) || !isPrice(noc) || !isTime(at)) return null;
  return {sol, usdc, usdt, noc, at};
}

export async function readCachedBalances(ext: Ext, account: string): Promise<CachedBalances | null> {
  const all = await ext.local.get(BALANCE_CACHE_KEY);
  return isObj(all) && Object.hasOwn(all, account) ? balancesOf(all[account]) : null;
}

export async function readCachedPrices(ext: Ext): Promise<PriceView | null> {
  return pricesOf(await ext.local.get(PRICE_CACHE_KEY));
}

/**
 * After a successful wallet.balances. Only an account of the stored envelope is cached (`envelope`:
 * its accounts' addresses, read by the caller), and every write trims the cache to them (at most
 * MAX_ACCOUNTS), so a removed account's balances do not linger and the key cannot grow without bound.
 */
export async function writeCachedBalances(ext: Ext, envelope: readonly string[], account: string, b: Omit<CachedBalances, 'at'>, at: number): Promise<void> {
  await serial(async () => {
    const keep = new Set(envelope);
    if (!keep.has(account)) return;
    const stored = await ext.local.get(BALANCE_CACHE_KEY);
    const next: Record<string, CachedBalances> = {};
    if (isObj(stored)) {
      for (const [k, v] of Object.entries(stored)) {
        const e = balancesOf(v);
        if (keep.has(k) && e !== null) next[k] = e;
      }
    }
    next[account] = {sol: b.sol, noc: b.noc, usdc: b.usdc, usdt: b.usdt, at};
    await ext.local.set(BALANCE_CACHE_KEY, next);
  });
}

export async function writeCachedPrices(ext: Ext, p: PriceView): Promise<void> {
  await ext.local.set(PRICE_CACHE_KEY, {sol: p.sol, usdc: p.usdc, usdt: p.usdt, noc: p.noc, at: p.at});
}

/** Both caches, removed (vault.forgetWallet, E5). */
export async function clearCaches(ext: Ext): Promise<void> {
  await serial(async () => {
    await ext.local.remove(BALANCE_CACHE_KEY);
    await ext.local.remove(PRICE_CACHE_KEY);
  });
}
```

Modify `extension/src/background/walletApi.ts`:

```diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -14,6 +14,7 @@ import {resend, startPoller} from './pending';
 import {isOpen, readPending, viewOf} from './pendingStore';
 import {createHistory, type History} from './history';
 import {ResendRefused, SendRefused, SentUnconfirmed} from './sendTypes';
+import {readCachedBalances, readCachedPrices, writeCachedBalances, writeCachedPrices, type PriceView} from './balanceCache';
 import {readWalletBalances, WALLET_TOKENS} from '../../../core/solana/balances';
 import {RequestUnreachable, RpcForbidden} from '../../../core/solana/rpc';
 
@@ -29,6 +30,8 @@ export const WALLET_TYPES = [
   'wallet.pending',
   'wallet.preparedFor',
   'wallet.history',
+  'wallet.prices',
+  'wallet.cached',
   'accounts.rename',
   'accounts.select',
   'settings.get',
@@ -131,6 +134,31 @@ async function probe(deps: WalletDeps, keys: unknown): Promise<Result> {
   return {ok: true, data: {resolved: true, balances}};
 }
 
+/** USD per whole token, re-validated: finite and > 0, else null — never 0 (E1). */
+const usd = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : null);
+
+/**
+ * wallet.prices (E1): SOL, USDC and USDT from /wallet/prices, NOC at the presale stage price from
+ * /stats. The two reads are independent: one failing nulls only its own fields; both failing is the
+ * first read's refusal. A 403 from either is never swallowed. The reply is cached (E4).
+ */
+async function prices(ext: Ext, deps: WalletDeps): Promise<Result> {
+  const [market, stage] = await Promise.allSettled([deps.prices(), deps.stagePrice()]);
+  for (const r of [market, stage]) if (r.status === 'rejected' && r.reason instanceof RpcForbidden) throw r.reason;
+  if (market.status === 'rejected' && stage.status === 'rejected') throw market.reason;
+  const m = market.status === 'fulfilled' ? market.value : {};
+  const data: PriceView = {
+    sol: usd(m.solana),
+    usdc: usd(m.usdc),
+    usdt: usd(m.usdt),
+    noc: stage.status === 'fulfilled' ? usd(stage.value) : null,
+    at: deps.now(),
+  };
+  // Best effort: a storage hiccup must not turn fresh prices into 'failed'.
+  await writeCachedPrices(ext, data).catch(() => undefined);
+  return {ok: true, data};
+}
+
 async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unknown>): Promise<Result> {
   const patch = parsePatch(msg.patch);
   if (patch === null) return MALFORMED;
@@ -193,7 +221,21 @@ export async function handleWallet(ext: Ext, deps: WalletDeps, type: WalletType,
         const {account} = msg;
         if (!isAddress(account)) return MALFORMED;
         const b = await readWalletBalances(deps.reader, account);
-        return {ok: true, data: {sol: b.sol.toString(), noc: b.noc.toString(), usdc: b.usdc.toString(), usdt: b.usdt.toString()}};
+        const data = {sol: b.sol.toString(), noc: b.noc.toString(), usdc: b.usdc.toString(), usdt: b.usdt.toString()};
+        // E4: the last good read, for the next popup to show (stale) at once. Best effort.
+        const envelope = (await readWalletView(ext))?.accounts.map(a => a.publicKey) ?? [];
+        await writeCachedBalances(ext, envelope, account, data, deps.now()).catch(() => undefined);
+        return {ok: true, data};
+      }
+      case 'wallet.prices':
+        return await prices(ext, deps);
+      case 'wallet.cached': {
+        const {account} = msg;
+        if (!isAddress(account)) return MALFORMED;
+        // Not served while locked: a locked popup shows no balances.
+        if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
+        const [balances, cachedPrices] = await Promise.all([readCachedBalances(ext, account), readCachedPrices(ext)]);
+        return {ok: true, data: {balances, prices: cachedPrices}};
       }
       case 'wallet.probeBalances':
         return await probe(deps, msg.publicKeys);
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/background/__tests__/balanceCache.test.ts src/background/__tests__/messages.test.ts scripts/__tests__/check-vault-isolation.test.mjs`
Expected: PASS — 3 files.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 56 files, 711 tests.

- [ ] **Step 6: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **swallow a 403:** in `walletApi.ts` `prices()`, delete the line `for (const r of [market, stage]) if (r.status === 'rejected' && r.reason instanceof RpcForbidden) throw r.reason;`. Run `npx vitest run src/background/__tests__/balanceCache.test.ts` → RED: 1 failed.
  - **serve the cache while locked:** in the `'wallet.cached'` case, delete `if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};`. Run `npx vitest run src/background/__tests__/balanceCache.test.ts` → RED: 1 failed.
  - **forget the owned keys:** in `check-vault-isolation.mjs`, remove `, 'v1_balance_cache', 'v1_price_cache'` from `BACKGROUND_OWNED_KEYS`. Run `npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` → RED: 1 failed.

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/check-vault-isolation.mjs extension/src/background/__tests__/balanceCache.test.ts extension/src/background/__tests__/messages.test.ts extension/src/background/balanceCache.ts extension/src/background/walletApi.ts
git commit -m "feat(extension): wallet.prices, the balance and price caches, wallet.cached (B1b-2a E1, E4)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 3: The simulation's balance changes in `prepareSend` (E2) — reader and engine

**Files:**
- Modify: `core/solana/rpc.ts`
- Modify: `extension/e2e/fakeCoordinator.ts`
- Modify: `extension/e2e/wallet.spec.ts`
- Modify: `extension/src/background/__tests__/fakeDeps.ts`
- Modify: `extension/src/background/prepare.ts`
- Modify: `extension/src/background/sendTypes.ts`
- Test (modify): `core/solana/__tests__/rpc.test.ts`
- Test (modify): `extension/src/background/__tests__/fixtures.ts`
- Test (modify): `extension/src/background/__tests__/prepare.test.ts`
- Test (create): `extension/src/background/__tests__/prepareSimulation.test.ts`

**Interfaces:**
- Consumes: B1b-1's `prepareSend`, `SolanaReader`; Task 1's Step 0 record.
- Produces:
  - `core/solana/rpc.ts`: `interface SimulatedAccount {lamports: bigint; owner: string; data: Uint8Array}`; `SimulationOutcome` gains `slot: number` and `accounts: (SimulatedAccount | null)[] | null`; `type AccountKind = 'missing' | 'wallet' | 'program' | 'other'`; `SYSTEM_PROGRAM_ID`; `SolanaReader.simulateTransaction(tx, opts?: {accounts?: readonly string[]})`, `SolanaReader.getAccountKind(address)`
  - `prepare.ts`: `type SimulatedProgram`; `interface SimulationView {slot, elapsedMs, instructions, programs, recipient: 'wallet' | 'new' | 'program' | 'other', sol: {before, after}, token: {symbol, before, after} | null}`; `PreparedView.simulation`
  - `sendTypes.ts`: `SendRefusal` gains `'simulation-mismatch'` and `'self-send'` (review L2, ruling: a send to the sending account itself is refused before any request)
  - test fixtures: `SIMULATED_SLOT`, `tokenAccountData(mint, owner, amount)`, `simulateAgainst(...)`, `consistentSimulation(reader, tx, addresses)`; `sendReader` defaults `getAccountKind: 'wallet'`
  - E2E fake: `lamports`, `simulateError`, `simulations` fields; `parseV0`

Spec §2 E2: `simulateTransaction(tx, {accounts})` returns the requested accounts' post-states and `context.slot`; "when `err === null`, `value.accounts` must be an array of exactly the requested length, else `RpcMalformed`. When `err !== null`, `accounts` may be `null`" (review H2). §11.5 adds: never read `rentEpoch`, a missing account is `null`, lamports above 2^53 are refused. `getAccountKind` answers `missing | wallet | program | other` and, for a SOL send, replaces `getAccountExists` ("One read answers both questions", L4). Prepare cross-checks: "`before − after` must equal `solRequired` … or `solRequired − networkLamports` … exactly" (else the new refusal `simulation-mismatch`), parses the source token account (mint, owner, amount), and stores the `SimulationView` in `PreparedView` (and so in `wallet.preparedFor`). No new RPC method. The test fixtures' `sendReader` now simulates **consistently with the transaction it is given**, so every existing prepare test keeps meaning what it meant; the E2E fake does the same (Scope item 15). A send to the sending account itself is refused as `self-send` before any request (review L2, controller ruling; #12 already disables it in plan 3). The precondition is Task 1 Step 0.

- [ ] **Step 1: Write the failing tests.**

Modify `core/solana/__tests__/rpc.test.ts`:

```diff
diff --git a/core/solana/__tests__/rpc.test.ts b/core/solana/__tests__/rpc.test.ts
--- a/core/solana/__tests__/rpc.test.ts
+++ b/core/solana/__tests__/rpc.test.ts
@@ -207,12 +207,70 @@ describe('solanaReader', () => {
     expect(await r.getAccountExists(OWNER)).toBe(true);
   });
 
-  it('simulateTransaction sends base64 without signature verification and returns err, logs and units', async () => {
+  it('simulateTransaction sends base64 without signature verification and returns err, logs, units and the slot', async () => {
     const {r, calls} = reader(() => ok({context: {slot: 1}, value: {err: {InstructionError: [0, 'Custom']}, logs: ['a', 3], unitsConsumed: 450}}));
-    expect(await r.simulateTransaction('AQID')).toEqual({err: {InstructionError: [0, 'Custom']}, logs: ['a'], unitsConsumed: 450});
+    expect(await r.simulateTransaction('AQID')).toEqual({err: {InstructionError: [0, 'Custom']}, logs: ['a'], unitsConsumed: 450, slot: 1, accounts: null});
     expect(calls[0]?.body.params).toEqual(['AQID', {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, commitment: 'confirmed'}]);
   });
 
+  // B1b-2a E2: the post-states of the requested accounts, for #19's balance changes.
+  describe('simulateTransaction with accounts (E2)', () => {
+    const SYSTEM = '11111111111111111111111111111111';
+    const U64_MAX = 18446744073709552000; // what JSON.parse makes of rentEpoch u64::MAX — never read
+    const acct = (lamports: number, data = '') => ({lamports, owner: SYSTEM, data: [data, 'base64'], executable: false, rentEpoch: U64_MAX, space: 0});
+
+    it('asks for the addresses in base64 and returns their post-states in order; a missing account is null', async () => {
+      const {r, calls} = reader(() => ok({context: {slot: 271408921}, value: {err: null, logs: [], unitsConsumed: 450, accounts: [acct(7_500_000_000, 'AQID'), null]}}));
+      const out = await r.simulateTransaction('AQID', {accounts: [OWNER, MINT]});
+      expect(out.slot).toBe(271408921);
+      expect(out.accounts).toEqual([{lamports: 7_500_000_000n, owner: SYSTEM, data: Uint8Array.from([1, 2, 3])}, null]);
+      expect(calls[0]?.body.params).toEqual([
+        'AQID',
+        {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, commitment: 'confirmed', accounts: {encoding: 'base64', addresses: [OWNER, MINT]}},
+      ]);
+    });
+
+    it('a failed simulation answers accounts: null — that is {err, accounts: null}, not a malformed reply (review H2)', async () => {
+      const {r} = reader(() => ok({context: {slot: 5}, value: {err: 'AccountNotFound', logs: null, accounts: null, unitsConsumed: 0}}));
+      expect(await r.simulateTransaction('AQID', {accounts: [OWNER]})).toEqual({err: 'AccountNotFound', logs: [], unitsConsumed: 0, slot: 5, accounts: null});
+    });
+
+    it('with err null, accounts must be an array of exactly the requested length', async () => {
+      for (const accounts of [null, undefined, [], [acct(1)], [acct(1), acct(2), acct(3)]]) {
+        const {r} = reader(() => ok({context: {slot: 5}, value: {err: null, logs: [], accounts}}));
+        await expect(r.simulateTransaction('AQID', {accounts: [OWNER, MINT]})).rejects.toBeInstanceOf(RpcMalformed);
+      }
+    });
+
+    it('a reply without context.slot is malformed, whether or not the simulation failed', async () => {
+      for (const value of [{err: null, logs: [], accounts: [acct(1)]}, {err: 'x', logs: [], accounts: null}]) {
+        const {r} = reader(() => ok({context: {}, value}));
+        await expect(r.simulateTransaction('AQID', {accounts: [OWNER]})).rejects.toBeInstanceOf(RpcMalformed);
+      }
+    });
+
+    it('refuses lamports a JSON number cannot hold exactly (above 2^53), and data that is not [base64, "base64"]', async () => {
+      const bad = [{...acct(1), lamports: 2 ** 53}, {...acct(1), lamports: -1}, {...acct(1), data: 'AQID'}, {...acct(1), data: ['AQID', 'base58']}, {...acct(1), owner: 7}];
+      for (const a of bad) {
+        const {r} = reader(() => ok({context: {slot: 5}, value: {err: null, logs: [], accounts: [a]}}));
+        await expect(r.simulateTransaction('AQID', {accounts: [OWNER]})).rejects.toBeInstanceOf(RpcMalformed);
+      }
+    });
+  });
+
+  it('getAccountKind: missing, a System-owned wallet, an executable program, anything else (E2)', async () => {
+    let value: unknown = null;
+    const {r, calls} = reader(() => ok({context: {slot: 1}, value}));
+    expect(await r.getAccountKind(OWNER)).toBe('missing');
+    expect(calls[0]?.body).toMatchObject({method: 'getAccountInfo', params: [OWNER, {encoding: 'base64', dataSlice: {offset: 0, length: 0}, commitment: 'confirmed'}]});
+    value = {lamports: 1, owner: '11111111111111111111111111111111', executable: false, data: ['', 'base64']};
+    expect(await r.getAccountKind(OWNER)).toBe('wallet');
+    value = {lamports: 1, owner: 'BPFLoaderUpgradeab1e11111111111111111111111', executable: true, data: ['', 'base64']};
+    expect(await r.getAccountKind(OWNER)).toBe('program');
+    value = {lamports: 1, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', executable: false, data: ['', 'base64']};
+    expect(await r.getAccountKind(OWNER)).toBe('other');
+  });
+
   it('getTransaction asks for jsonParsed v0 and passes null through', async () => {
     const {r, calls} = reader(() => ok(null));
     expect(await r.getTransaction('sig')).toBeNull();
```

Modify `extension/src/background/__tests__/fixtures.ts`:

```diff
diff --git a/extension/src/background/__tests__/fixtures.ts b/extension/src/background/__tests__/fixtures.ts
--- a/extension/src/background/__tests__/fixtures.ts
+++ b/extension/src/background/__tests__/fixtures.ts
@@ -3,7 +3,7 @@ import {base58, base64} from '@scure/base';
 import {PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
 import type {Ext} from '../../ext';
 import type {SessionAccount} from '../../vault/accounts';
-import type {SolanaReader} from '../../../../core/solana/rpc';
+import type {SimulationOutcome, SolanaReader} from '../../../../core/solana/rpc';
 import {setSession} from '../session';
 import type {PendingRecord} from '../pendingStore';
 import {fakeReader} from './fakeDeps';
@@ -22,17 +22,75 @@ export async function unlocked(ext: Ext): Promise<void> {
   await setSession(ext, [ACCOUNT]);
 }
 
-/** The reads a SOL send makes: quiet fees, blockhash valid to height 1000, 10 SOL, simulation passes. */
+const SYSTEM = '11111111111111111111111111111111';
+const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
+const ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
+export const SIMULATED_SLOT = 271_408_921;
+const u64 = (d: Uint8Array, at: number) => new DataView(d.buffer, d.byteOffset, d.byteLength).getBigUint64(at, true);
+
+/** An SPL token account's 165 bytes: mint, owner, amount (u64 LE at 64). */
+export function tokenAccountData(mint: string, owner: string, amount: bigint): Uint8Array {
+  const d = new Uint8Array(165);
+  d.set(base58.decode(mint), 0);
+  d.set(base58.decode(owner), 32);
+  new DataView(d.buffer).setBigUint64(64, amount, true);
+  return d;
+}
+
+/**
+ * What a node's simulateTransaction answers for these bytes: the requested accounts after the
+ * transaction ran, WITHOUT the network fee (the E2 check accepts either form). System transfers and a
+ * recipient token account's rent leave the payer; a TransferChecked leaves its source. `lamports` is the
+ * payer's balance before; `holdings` maps a token account to its amount before.
+ */
+export function simulateAgainst(txBase64: string, addresses: readonly string[], lamports: bigint, holdings: Map<string, {mint: string; amount: bigint}>): SimulationOutcome {
+  const message = VersionedTransaction.deserialize(base64.decode(txBase64)).message;
+  const keys = message.staticAccountKeys.map(k => k.toBase58());
+  const payer = keys[0] ?? '';
+  let solOut = 0n;
+  const tokenOut = new Map<string, bigint>();
+  for (const ix of message.compiledInstructions) {
+    const program = keys[ix.programIdIndex];
+    const at = (i: number) => keys[ix.accountKeyIndexes[i] ?? -1] ?? '';
+    if (program === SYSTEM && ix.data[0] === 2 && at(0) === payer) solOut += u64(ix.data, 4);
+    if (program === ATA && at(0) === payer) solOut += 2_039_280n;
+    if (program === TOKEN && ix.data[0] === 12) tokenOut.set(at(0), (tokenOut.get(at(0)) ?? 0n) + u64(ix.data, 1));
+  }
+  const accounts = addresses.map(address => {
+    if (address === payer) return {lamports: lamports - solOut, owner: SYSTEM, data: new Uint8Array(0)};
+    const h = holdings.get(address);
+    if (h === undefined) return null;
+    return {lamports: 2_039_280n, owner: TOKEN, data: tokenAccountData(h.mint, payer, h.amount - (tokenOut.get(address) ?? 0n))};
+  });
+  return {err: null, logs: [], unitsConsumed: 450, slot: SIMULATED_SLOT, accounts: addresses.length === 0 ? null : accounts};
+}
+
+/**
+ * The reads a SOL send makes: quiet fees, blockhash valid to height 1000, 10 SOL, the recipient an
+ * existing wallet, and a simulation consistent with the transaction (E2) — computed from the reader's
+ * own balance and token accounts, so an override of either stays consistent.
+ */
 export function sendReader(overrides: Partial<SolanaReader> = {}): SolanaReader {
-  return fakeReader({
+  const reader = fakeReader({
     getRecentPrioritizationFees: async () => [],
     getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
     getBalance: async () => 10_000_000_000n,
-    simulateTransaction: async () => ({err: null, logs: [], unitsConsumed: 450}),
     // The recipient's system account exists (a new one must receive ≥ 890 880 lamports — M4).
     getAccountExists: async () => true,
+    getAccountKind: async () => 'wallet',
     ...overrides,
   });
+  if (overrides.simulateTransaction !== undefined) return reader;
+  return {...reader, simulateTransaction: (tx, opts) => consistentSimulation(reader, tx, opts?.accounts ?? [])};
+}
+
+/** simulateAgainst with the balance and holdings `reader` reports for ACCOUNT. */
+export async function consistentSimulation(reader: SolanaReader, tx: string, addresses: readonly string[]): Promise<SimulationOutcome> {
+  const holdings = new Map<string, {mint: string; amount: bigint}>();
+  if (addresses.length > 1) {
+    for (const h of await reader.getTokenAccountsByOwner(ACCOUNT.publicKey, {programId: TOKEN})) holdings.set(h.pubkey, {mint: h.mint, amount: h.amount});
+  }
+  return simulateAgainst(tx, addresses, await reader.getBalance(ACCOUNT.publicKey), holdings);
 }
 
 /** A pending record with every field set; override what a test is about. */
```

Modify `extension/src/background/__tests__/prepare.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/prepare.test.ts b/extension/src/background/__tests__/prepare.test.ts
--- a/extension/src/background/__tests__/prepare.test.ts
+++ b/extension/src/background/__tests__/prepare.test.ts
@@ -75,11 +75,10 @@ describe('prepareSend', () => {
     expect(await challengeSatisfied(ext, deps.now(), view.reauth!.challengeId, p!.intentDigest)).toBe(false);
   });
 
-  it('sending to the account itself is not a first send', async () => {
+  it('refuses a send to the sending account itself — before any request (review L2)', async () => {
     const ext = fakeExt();
     await unlocked(ext);
-    const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, recipient: ACCOUNT.publicKey});
-    expect(view.reauth).toBeNull();
+    await expect(prepareSend(ext, fakeDeps({reader: fakeReader()}), ACCOUNT.publicKey, {...SOL_INTENT, recipient: ACCOUNT.publicKey})).rejects.toMatchObject({code: 'self-send'});
   });
 
   it('a missing price counts as above the dollar threshold', async () => {
@@ -151,7 +150,7 @@ describe('prepareSend', () => {
 
   it('refuses less than the rent-exempt minimum to a brand-new recipient account', async () => {
     const ext = await knownSetup();
-    const reader = sendReader({getAccountExists: async () => false});
+    const reader = sendReader({getAccountKind: async () => 'missing'});
     await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '890879'})).rejects.toMatchObject({code: 'recipient-below-rent'});
     expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '890880'})).id).toMatch(/^[0-9a-f]{32}$/);
     expect((await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '1000'})).id).toMatch(/^[0-9a-f]{32}$/);
@@ -179,7 +178,8 @@ describe('prepareSend', () => {
 
   it('refuses a transaction whose simulation fails', async () => {
     const ext = await knownSetup();
-    const reader = sendReader({simulateTransaction: async () => ({err: {InstructionError: [2, {Custom: 1}]}, logs: [], unitsConsumed: null})});
+    // A failed simulation: the RPC answers accounts: null alongside err (review H2) — simulation-failed, not failed.
+    const reader = sendReader({simulateTransaction: async () => ({err: {InstructionError: [2, {Custom: 1}]}, logs: [], unitsConsumed: null, slot: 5, accounts: null})});
     await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-failed', detail: '{"InstructionError":[2,{"Custom":1}]}'});
   });
 
@@ -209,12 +209,14 @@ describe('prepareSend', () => {
     for (const known of [true, false]) {
       const ext = known ? await knownSetup() : fakeExt();
       if (!known) await unlocked(ext);
-      const reader = sendReader({
-        simulateTransaction: async () => {
+      const base = sendReader();
+      const reader = {
+        ...base,
+        simulateTransaction: async (tx: string, o?: {accounts?: readonly string[]}) => {
           await clearSession(ext);
-          return {err: null, logs: [], unitsConsumed: 450};
+          return base.simulateTransaction(tx, o);
         },
-      });
+      };
       await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'locked'});
       expect(await ext.session.get(PREPARED_KEY)).toBeUndefined();
       expect(await ext.session.get(REAUTH_KEY)).toBeUndefined();
@@ -233,13 +235,15 @@ describe('prepareSend', () => {
       if (key === SESSION_KEY && locked && unlockDone === undefined) unlockDone = setSession(ext, [ACCOUNT]);
       return v;
     };
-    const reader = sendReader({
-      simulateTransaction: async () => {
+    const base = sendReader();
+    const reader = {
+      ...base,
+      simulateTransaction: async (tx: string, o?: {accounts?: readonly string[]}) => {
         await clearSession(ext);
         locked = true;
-        return {err: null, logs: [], unitsConsumed: 450};
+        return base.simulateTransaction(tx, o);
       },
-    });
+    };
     await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'locked'});
     expect(unlockDone).toBeDefined();
     await unlockDone;
@@ -253,13 +257,15 @@ describe('prepareSend', () => {
     await unlocked(ext);
     const clear = vi.spyOn(ext.session, 'clear');
     const remove = vi.spyOn(ext.session, 'remove');
-    const reader = sendReader({
-      simulateTransaction: async () => {
+    const base = sendReader();
+    const reader = {
+      ...base,
+      simulateTransaction: async (tx: string, o?: {accounts?: readonly string[]}) => {
         await clearSession(ext);
         clear.mockClear();
-        return {err: null, logs: [], unitsConsumed: 450};
+        return base.simulateTransaction(tx, o);
       },
-    });
+    };
     await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'locked'});
     expect(clear).not.toHaveBeenCalled();
     expect(remove.mock.calls).toEqual([[REAUTH_KEY]]);
```

Create `extension/src/background/__tests__/prepareSimulation.test.ts`:

```ts
import {preparedFor, prepareSend} from '../prepare';
import {handleWallet} from '../walletApi';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {RpcMalformed, createForbiddenLatch, createRpc, solanaReader, type SimulationOutcome, type SolanaReader} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, HOLDING_LARGE, RECIPIENT, SIMULATED_SLOT, consistentSimulation, sendReader, tokenAccountData, unlocked} from './fixtures';

// Spec B1b-2a E2: #19 shows what the simulation says the transaction does, and the engine refuses a
// simulation whose effect is not the transaction it built.
const SOL_INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};
const NOC = WALLET_TOKENS.NOC.mint as string;
const NOC_INTENT = {token: 'NOC' as const, recipient: RECIPIENT, amount: '1000000'};
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const nocHoldings = async () => [{pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 13_399_619n, decimals: 9}];

async function setup() {
  const ext = fakeExt();
  await unlocked(ext);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  return ext;
}

/** sendReader whose simulation is the consistent one, then changed by `edit`. Records the addresses asked for. */
function editedReader(edit: (o: SimulationOutcome) => SimulationOutcome, overrides: Partial<SolanaReader> = {}) {
  const asked: (readonly string[])[] = [];
  const base = sendReader(overrides);
  const reader: SolanaReader = {
    ...base,
    simulateTransaction: async (tx, o) => {
      asked.push(o?.accounts ?? []);
      return edit(await consistentSimulation(base, tx, o?.accounts ?? []));
    },
  };
  return {reader, asked};
}
const withSenderLamports = (o: SimulationOutcome, lamports: bigint): SimulationOutcome => ({
  ...o,
  accounts: (o.accounts ?? []).map((a, i) => (i === 0 && a !== null ? {...a, lamports} : a)),
});

describe('prepareSend: the simulation (E2)', () => {
  it('a SOL send: the payer before and after, the programs, the recipient kind, the slot — and the addresses asked for', async () => {
    const ext = await setup();
    const {reader, asked} = editedReader(o => o);
    const view = await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT);
    expect(asked).toEqual([[ACCOUNT.publicKey]]);
    // Fee not in the simulated state: after = 10 SOL − 1 000 000.
    expect(view.simulation).toEqual({
      slot: SIMULATED_SLOT,
      elapsedMs: 0,
      instructions: 3,
      programs: ['compute-budget', 'system'],
      recipient: 'wallet',
      sol: {before: '10000000000', after: '9999000000'},
      token: null,
    });
  });

  it('accepts the simulated state with the network fee included, exactly', async () => {
    const ext = await setup();
    // solRequired = 1 000 000 + 5 050.
    const {reader} = editedReader(o => withSenderLamports(o, 10_000_000_000n - 1_005_050n));
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).simulation.sol.after).toBe('9998994950');
  });

  it('one lamport off in either direction is simulation-mismatch, naming both numbers', async () => {
    const ext = await setup();
    for (const after of [10_000_000_000n - 1_000_001n, 10_000_000_000n - 999_999n, 10_000_000_000n - 1_005_051n]) {
      const {reader} = editedReader(o => withSenderLamports(o, after));
      await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-mismatch'});
    }
  });

  it('a simulation that does not show the sender is simulation-mismatch', async () => {
    const ext = await setup();
    const {reader} = editedReader(o => ({...o, accounts: [null]}));
    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-mismatch'});
  });

  it('measures the simulate call with the engine clock', async () => {
    const ext = await setup();
    const deps = fakeDeps();
    const base = sendReader();
    const reader: SolanaReader = {
      ...base,
      simulateTransaction: async (tx, o) => {
        deps.clock.t += 412;
        return base.simulateTransaction(tx, o);
      },
    };
    expect((await prepareSend(ext, {...deps, reader}, ACCOUNT.publicKey, SOL_INTENT)).simulation.elapsedMs).toBe(412);
  });

  it('an SPL send: the source token account before and after, the ATA program when the recipient account is created', async () => {
    const ext = await setup();
    const {reader, asked} = editedReader(o => o, {getTokenAccountsByOwner: nocHoldings, getAccountExists: async () => false});
    const view = await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT);
    expect(asked).toEqual([[ACCOUNT.publicKey, HOLDING_LARGE]]);
    expect(view.simulation.token).toEqual({symbol: 'NOC', before: '13399619', after: '12399619'});
    expect(view.simulation.programs).toEqual(['compute-budget', 'associated-token', 'token']);
    // The payer pays the recipient account's rent: 10 SOL − 2 039 280.
    expect(view.simulation.sol).toEqual({before: '10000000000', after: '9997960720'});
  });

  it('a token account with the wrong mint, the wrong owner or the wrong amount is simulation-mismatch', async () => {
    const ext = await setup();
    const tokenAt = (mint: string, owner: string, amount: bigint) => (o: SimulationOutcome): SimulationOutcome => ({
      ...o,
      accounts: [o.accounts?.[0] ?? null, {lamports: 2_039_280n, owner: TOKEN, data: tokenAccountData(mint, owner, amount)}],
    });
    const USDC = WALLET_TOKENS.USDC.mint as string;
    for (const edit of [tokenAt(USDC, ACCOUNT.publicKey, 12_399_619n), tokenAt(NOC, RECIPIENT, 12_399_619n), tokenAt(NOC, ACCOUNT.publicKey, 12_399_620n)]) {
      const {reader} = editedReader(edit, {getTokenAccountsByOwner: nocHoldings});
      await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT)).rejects.toMatchObject({code: 'simulation-mismatch'});
    }
    // Positive control: the right mint, owner and amount pass.
    const {reader} = editedReader(tokenAt(NOC, ACCOUNT.publicKey, 12_399_619n), {getTokenAccountsByOwner: nocHoldings});
    expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, NOC_INTENT)).simulation.token?.after).toBe('12399619');
  });

  it('the recipient kind: a missing account is "new"; a program or another owner is shown, never refused', async () => {
    const ext = await setup();
    for (const [kind, shown] of [['missing', 'new'], ['program', 'program'], ['other', 'other'], ['wallet', 'wallet']] as const) {
      const {reader} = editedReader(o => o, {getAccountKind: async () => kind});
      expect((await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).simulation.recipient).toBe(shown);
    }
  });

  it('a SOL send reads the recipient once (getAccountKind answers rent and kind; review L4)', async () => {
    const ext = await setup();
    let kindReads = 0;
    const {reader} = editedReader(o => o, {
      getAccountKind: async () => (kindReads++, 'wallet'),
      getAccountExists: async () => {
        throw new Error('a SOL send must not read the recipient twice');
      },
    });
    await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT);
    expect(kindReads).toBe(1);
  });

  it('wallet.preparedFor returns the same simulation', async () => {
    const ext = await setup();
    const deps = fakeDeps({reader: sendReader()});
    const view = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.simulation).toEqual(view.simulation);
  });

  it('a malformed simulation reply is failed; a failed simulation (err, accounts: null) is simulation-failed — through the real reader', async () => {
    const ext = await setup();
    const realSimulate = (value: unknown) => {
      const rpc = createRpc({fetch: async () => ({status: 200, json: async () => ({jsonrpc: '2.0', id: 1, result: {context: {slot: 9}, value}})}), latch: createForbiddenLatch()});
      return solanaReader(rpc).simulateTransaction;
    };
    const failing = {...sendReader(), simulateTransaction: realSimulate({err: 'AccountNotFound', logs: [], accounts: null})};
    expect(await handleWallet(ext, fakeDeps({reader: failing}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT})).toEqual({
      ok: false,
      error: 'simulation-failed',
      data: {detail: '"AccountNotFound"'},
    });
    const malformed = {...sendReader(), simulateTransaction: realSimulate({err: null, logs: [], accounts: null})};
    expect(await handleWallet(ext, fakeDeps({reader: malformed}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT})).toEqual({ok: false, error: 'failed'});
    const thrown = {
      ...sendReader(),
      simulateTransaction: async () => {
        throw new RpcMalformed('simulateTransaction.context.slot');
      },
    };
    expect(await handleWallet(ext, fakeDeps({reader: thrown}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT})).toEqual({ok: false, error: 'failed'});
  });

  it('refuses simulation-mismatch through the message layer with the detail', async () => {
    const ext = await setup();
    const {reader} = editedReader(o => withSenderLamports(o, 1n));
    const r = await handleWallet(ext, fakeDeps({reader}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT});
    expect(r).toMatchObject({ok: false, error: 'simulation-mismatch'});
    expect((r as {data: {detail: string}}).data.detail).toContain('1005050');
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run ../core/solana/__tests__/rpc.test.ts src/background/__tests__/prepareSimulation.test.ts src/background/__tests__/prepare.test.ts`
Expected: FAIL — the self-send test (`unexpected RPC call: getLatestBlockhash` — nothing refuses it yet), 7 reader tests (`simulateTransaction … returns … the slot`, `asks for the addresses …`, `getAccountKind …`) and 13 prepare tests (`× a SOL send: the payer before and after …`, `× one lamport off …`, `× refuses less than the rent-exempt minimum to a brand-new recipient account` — it now reads `getAccountKind`).

- [ ] **Step 3: Implement.**

Modify `core/solana/rpc.ts`:

```diff
diff --git a/core/solana/rpc.ts b/core/solana/rpc.ts
--- a/core/solana/rpc.ts
+++ b/core/solana/rpc.ts
@@ -13,6 +13,7 @@
  * extension/scripts/check-rpc-methods.mjs proves that every method name the extension bundles is
  * on this list and that this list equals the spec's.
  */
+import {base64} from '@scure/base';
 
 export const API_ORIGIN = 'https://api.noc-tura.io';
 /** Already ends in /api/v1: append bare paths (never another /v1). */
@@ -206,22 +207,40 @@ export interface SignatureInfo {
   blockTime: number | null;
   err: unknown;
 }
+/** An account as simulateTransaction reports it after the simulated transaction. Never its rentEpoch (u64 max, which JSON rounds). */
+export interface SimulatedAccount {
+  lamports: bigint;
+  owner: string;
+  data: Uint8Array;
+}
 export interface SimulationOutcome {
   err: unknown;
   logs: string[];
   unitsConsumed: number | null;
+  /** context.slot of the reply. */
+  slot: number;
+  /**
+   * The requested accounts' post-states, in request order; null for an address with no account.
+   * Null as a whole when none were requested, or when `err` is set (the RPC then answers null).
+   */
+  accounts: (SimulatedAccount | null)[] | null;
 }
+/** What an address holds: nothing, a plain wallet (System-owned), a program (executable), or anything else. */
+export type AccountKind = 'missing' | 'wallet' | 'program' | 'other';
+
+export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
 
 /** Every chain read the extension makes, typed. The only way to reach the RPC above. */
 export interface SolanaReader {
   getBalance(owner: string): Promise<bigint>;
   getAccountExists(address: string): Promise<boolean>;
+  getAccountKind(address: string): Promise<AccountKind>;
   getMultipleLamports(addresses: readonly string[]): Promise<bigint[]>;
   getLatestBlockhash(): Promise<{blockhash: string; lastValidBlockHeight: number}>;
   getBlockHeight(): Promise<number>;
   getSignatureStatuses(signatures: readonly string[], searchTransactionHistory?: boolean): Promise<(SignatureStatus | null)[]>;
   getRecentPrioritizationFees(): Promise<{prioritizationFee: number}[]>;
-  simulateTransaction(transactionBase64: string): Promise<SimulationOutcome>;
+  simulateTransaction(transactionBase64: string, opts?: {accounts?: readonly string[]}): Promise<SimulationOutcome>;
   getTokenAccountsByOwner(owner: string, filter: {mint: string} | {programId: string}): Promise<TokenAccountEntry[]>;
   getSignaturesForAddress(address: string, opts: {limit: number; before?: string}): Promise<SignatureInfo[]>;
   getTransaction(signature: string): Promise<unknown>;
@@ -253,6 +272,27 @@ function valueOf(result: unknown, what: string): unknown {
   return o.value;
 }
 
+/**
+ * One simulated account: lamports exact (a JSON number above 2^53 has already been rounded, so it is
+ * refused rather than computed on), the owner, and the base64 data. rentEpoch is never read: it is
+ * u64 max, which JSON.parse rounds.
+ */
+function simulatedAccount(x: unknown): SimulatedAccount | null {
+  if (x === null) return null;
+  const a = obj(x, 'simulated account');
+  const lamports = a.lamports;
+  if (typeof lamports !== 'number' || !Number.isSafeInteger(lamports) || lamports < 0) throw new RpcMalformed('simulated account lamports');
+  const data = list(a.data, 'simulated account data');
+  if (data.length !== 2 || data[1] !== 'base64' || typeof data[0] !== 'string') throw new RpcMalformed('simulated account data encoding');
+  let bytes: Uint8Array;
+  try {
+    bytes = base64.decode(data[0]);
+  } catch {
+    throw new RpcMalformed('simulated account data');
+  }
+  return {lamports: BigInt(lamports), owner: text(a.owner, 'simulated account owner'), data: bytes};
+}
+
 function signatureStatus(x: unknown): SignatureStatus | null {
   if (x === null) return null;
   const s = obj(x, 'getSignatureStatuses entry');
@@ -284,6 +324,14 @@ export function solanaReader(rpc: Rpc): SolanaReader {
     async getAccountExists(address) {
       return valueOf(await rpc.call('getAccountInfo', [address, {encoding: 'base64', ...COMMITMENT}]), 'getAccountInfo') !== null;
     },
+    async getAccountKind(address) {
+      // Only the header is needed: a zero-length data slice keeps the answer small.
+      const v = valueOf(await rpc.call('getAccountInfo', [address, {encoding: 'base64', dataSlice: {offset: 0, length: 0}, ...COMMITMENT}]), 'getAccountInfo');
+      if (v === null) return 'missing';
+      const a = obj(v, 'getAccountInfo.value');
+      if (a.executable === true) return 'program';
+      return text(a.owner, 'getAccountInfo.owner') === SYSTEM_PROGRAM_ID ? 'wallet' : 'other';
+    },
     async getMultipleLamports(addresses) {
       const params = [addresses, {encoding: 'base64', dataSlice: {offset: 0, length: 0}, ...COMMITMENT}];
       const v = list(valueOf(await rpc.call('getMultipleAccounts', params), 'getMultipleAccounts'), 'getMultipleAccounts.value');
@@ -310,11 +358,21 @@ export function solanaReader(rpc: Rpc): SolanaReader {
         return {prioritizationFee: typeof fee === 'number' ? fee : Number.NaN};
       });
     },
-    async simulateTransaction(transactionBase64) {
-      const params = [transactionBase64, {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, ...COMMITMENT}];
-      const v = obj(valueOf(await rpc.call('simulateTransaction', params), 'simulateTransaction'), 'simulateTransaction.value');
+    async simulateTransaction(transactionBase64, opts = {}) {
+      const addresses = opts.accounts ?? [];
+      const config = {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, ...COMMITMENT};
+      const params = [transactionBase64, addresses.length === 0 ? config : {...config, accounts: {encoding: 'base64', addresses}}];
+      const result = obj(await rpc.call('simulateTransaction', params), 'simulateTransaction');
+      const slot = count(obj(result.context, 'simulateTransaction.context').slot, 'simulateTransaction.context.slot');
+      const v = obj(valueOf(result, 'simulateTransaction'), 'simulateTransaction.value');
       const logs = Array.isArray(v.logs) ? (v.logs as unknown[]).filter((l): l is string => typeof l === 'string') : [];
-      return {err: v.err ?? null, logs, unitsConsumed: typeof v.unitsConsumed === 'number' ? v.unitsConsumed : null};
+      const err = v.err ?? null;
+      const outcome = {err, logs, unitsConsumed: typeof v.unitsConsumed === 'number' ? v.unitsConsumed : null, slot};
+      // The RPC answers accounts: null whenever err is set: that is a failed simulation, not a malformed reply.
+      if (err !== null || addresses.length === 0) return {...outcome, accounts: null};
+      const accounts = list(v.accounts, 'simulateTransaction.accounts');
+      if (accounts.length !== addresses.length) throw new RpcMalformed('simulateTransaction.accounts: wrong length');
+      return {...outcome, accounts: accounts.map(simulatedAccount)};
     },
     async getTokenAccountsByOwner(owner, filter) {
       const result = await rpc.call('getTokenAccountsByOwner', [owner, filter, {encoding: 'jsonParsed', ...COMMITMENT}]);
```

Modify `extension/e2e/fakeCoordinator.ts`:

```diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -24,6 +24,12 @@ export interface FakeCoordinator {
   historyChecks: {signature: string; at: number}[];
   /** Anything the fake was asked that it does not implement, or asked in the wrong shape. */
   unexpected: string[];
+  /** SOL per address, lamports; anything unlisted holds 10 SOL. */
+  lamports: Map<string, number>;
+  /** The simulation's error switch (E2): err set and accounts null, as the real RPC answers. */
+  simulateError: boolean;
+  /** Every simulateTransaction's requested addresses (null = the field was missing). */
+  simulations: (string[] | null)[];
 }
 
 /** Compact-u16: the signature count that opens a serialized transaction. */
@@ -37,6 +43,38 @@ function shortVec(bytes: Uint8Array): {value: number; size: number} {
   return {value, size: 3};
 }
 
+/**
+ * The static keys and instructions of a serialized v0 transaction: signature count and slots, then
+ * the message (0x80 prefix, 3-byte header, keys, blockhash, instructions). Read by hand: the E2E runs
+ * under Playwright's loader, where @solana/web3.js's CommonJS dependencies do not load.
+ */
+function parseV0(wire: Uint8Array): {keys: string[]; instructions: {program: number; accounts: number[]; data: Uint8Array}[]} {
+  let at = 0;
+  const vec = (): number => {
+    const {value, size} = shortVec(wire.subarray(at));
+    at += size;
+    return value;
+  };
+  const signatures = vec();
+  at += 64 * signatures;
+  if (wire[at] !== 0x80) throw new Error('not a v0 message');
+  at += 4;
+  const keys: string[] = [];
+  for (let n = vec(), i = 0; i < n; i++, at += 32) keys.push(base58.encode(wire.subarray(at, at + 32)));
+  at += 32;
+  const instructions: {program: number; accounts: number[]; data: Uint8Array}[] = [];
+  for (let n = vec(), i = 0; i < n; i++) {
+    const program = wire[at++] ?? 0;
+    const accounts: number[] = [];
+    const count = vec();
+    for (let j = 0; j < count; j++) accounts.push(wire[at++] ?? 0);
+    const len = vec();
+    instructions.push({program, accounts, data: wire.slice(at, at + len)});
+    at += len;
+  }
+  return {keys, instructions};
+}
+
 /**
  * A simulated coordinator: the read proxy for the methods the engine uses, the broadcast route
  * with the contract this plan defines (docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md),
@@ -53,6 +91,9 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     broadcastWires: [],
     historyChecks: [],
     unexpected: [],
+    lamports: new Map(),
+    simulateError: false,
+    simulations: [],
   };
   const statusChecks = new Map<string, number>();
   const context = () => ({slot: fake.blockHeight + 50});
@@ -68,16 +109,44 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     }),
   });
 
+  const lamportsOf = (address: string): number => fake.lamports.get(address) ?? 10_000_000_000;
+
+  /**
+   * What a node answers: the requested accounts after the transaction, WITHOUT the fee (the engine
+   * accepts either form, E2) — the payer's lamports less every System transfer it makes. Its error
+   * switch answers err with accounts: null, as the real RPC does (review H2).
+   */
+  const simulate = (params: unknown[]): unknown => {
+    const config = params[1] as {accounts?: {encoding?: string; addresses?: unknown}} | undefined;
+    const addresses = Array.isArray(config?.accounts?.addresses) ? (config.accounts.addresses as string[]) : null;
+    fake.simulations.push(addresses);
+    if (addresses === null || config?.accounts?.encoding !== 'base64') fake.unexpected.push('simulateTransaction without accounts {encoding: base64, addresses}');
+    if (fake.simulateError) return {context: context(), value: {err: {InstructionError: [2, {Custom: 1}]}, logs: [], accounts: null, unitsConsumed: 0, returnData: null}};
+    const {keys, instructions} = parseV0(base64.decode(params[0] as string));
+    const payer = keys[0] ?? '';
+    let out = 0;
+    for (const ix of instructions) {
+      const data = ix.data;
+      if (keys[ix.program] === '11111111111111111111111111111111' && data[0] === 2 && keys[ix.accounts[0] ?? -1] === payer) {
+        out += Number(new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(4, true));
+      }
+    }
+    const accounts = (addresses ?? []).map(a =>
+      a === payer ? {lamports: lamportsOf(payer) - out, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0} : null,
+    );
+    return {context: context(), value: {err: null, logs: ['Program 11111111111111111111111111111111 success'], accounts, unitsConsumed: 450, returnData: null}};
+  };
+
   const rpcResult = (method: string, params: unknown[]): unknown => {
     switch (method) {
       case 'getBalance':
-        return {context: context(), value: 10_000_000_000};
+        return {context: context(), value: lamportsOf(params[0] as string)};
       case 'getLatestBlockhash':
         return {context: context(), value: {blockhash: base58.encode(randomBytes(32)), lastValidBlockHeight: fake.blockHeight + BLOCKHASH_LIFETIME}};
       case 'getRecentPrioritizationFees':
         return [];
       case 'simulateTransaction':
-        return {context: context(), value: {err: null, logs: ['Program 11111111111111111111111111111111 success'], accounts: null, unitsConsumed: 450, returnData: null}};
+        return simulate(params);
       case 'getTokenAccountsByOwner':
         return {context: context(), value: []};
       case 'getMultipleAccounts':
```

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -147,6 +147,9 @@ test('create a wallet, unlock it, re-authenticate a first send, send SOL: pendin
     await expect.poll(() => pendingState(popup, signature), {timeout: 30_000, intervals: [1_000]}).toBe('confirmed');
     expect(fake.broadcasts).toEqual([signature]);
     expect(await sw.evaluate(() => chrome.storage.local.get('v1_known_recipients'))).toEqual({v1_known_recipients: [RECIPIENT]});
+    // E2: every simulation asked for the sender's post-state.
+    expect(fake.simulations.length).toBeGreaterThan(0);
+    for (const s of fake.simulations) expect(s).toEqual([account]);
     // Owner decision A: the record lives in storage.local, where a lock or a restart cannot drop it.
     const stored = (await sw.evaluate(() => chrome.storage.local.get('v1_pending'))) as {v1_pending?: {signature: string; state: string}[]};
     expect(stored.v1_pending?.map(r => [r.signature, r.state])).toEqual([[signature, 'confirmed']]);
```

Modify `extension/src/background/__tests__/fakeDeps.ts`:

```diff
diff --git a/extension/src/background/__tests__/fakeDeps.ts b/extension/src/background/__tests__/fakeDeps.ts
--- a/extension/src/background/__tests__/fakeDeps.ts
+++ b/extension/src/background/__tests__/fakeDeps.ts
@@ -10,6 +10,7 @@ export function fakeReader(overrides: Partial<SolanaReader> = {}): SolanaReader
   return {
     getBalance: unexpected('getBalance'),
     getAccountExists: unexpected('getAccountExists'),
+    getAccountKind: unexpected('getAccountKind'),
     getMultipleLamports: unexpected('getMultipleLamports'),
     getLatestBlockhash: unexpected('getLatestBlockhash'),
     getBlockHeight: unexpected('getBlockHeight'),
```

Modify `extension/src/background/prepare.ts`:

```diff
diff --git a/extension/src/background/prepare.ts b/extension/src/background/prepare.ts
--- a/extension/src/background/prepare.ts
+++ b/extension/src/background/prepare.ts
@@ -1,5 +1,5 @@
-import {PublicKey, TransactionMessage, VersionedTransaction, type TransactionInstruction} from '@solana/web3.js';
-import {base64} from '@scure/base';
+import {PublicKey, TransactionMessage, VersionedTransaction, type MessageV0, type TransactionInstruction} from '@solana/web3.js';
+import {base58, base64} from '@scure/base';
 import type {Ext} from '../ext';
 import type {WalletDeps} from './deps';
 import {PREPARED_KEY, REAUTH_KEY, getSession, sessionMutex} from './session';
@@ -15,6 +15,8 @@ import {estimatePriorityFee} from '../../../core/solana/priorityFee';
 import {
   InsufficientTokenBalance,
   SYSTEM_ACCOUNT_RENT_LAMPORTS,
+  SPL_ATA_PROGRAM_ID,
+  SPL_TOKEN_PROGRAM_ID,
   SplitTokenBalance,
   TOKEN_ACCOUNT_RENT_LAMPORTS,
   buildSolTransferInstructions,
@@ -29,7 +31,7 @@ import {
 import {WALLET_TOKENS, type WalletToken} from '../../../core/solana/balances';
 import {MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS, effectiveFee, type FeeReason} from '../../../core/fees/transferMarkup';
 import type {Prices} from '../../../core/portfolio/value';
-import {RpcForbidden} from '../../../core/solana/rpc';
+import {RpcForbidden, SYSTEM_PROGRAM_ID, type AccountKind, type SimulatedAccount} from '../../../core/solana/rpc';
 
 /** Spec §3: after 30 s unconfirmed a transaction is simulated again — a prepared send older than that is re-prepared. */
 export const PREPARED_TTL_MS = 30_000;
@@ -55,7 +57,25 @@ export interface PreparedSend {
   /** preparedIntegrity of every field above: an entry changed after prepare is refused at send. */
   integrity: string;
   /** What prepare showed, kept so wallet.preparedFor can show it again. Not signed, not bound. */
-  shown: {fees: PreparedView['fees']; solRequiredLamports: string; reasons: SendReauthReason[]};
+  shown: {fees: PreparedView['fees']; solRequiredLamports: string; reasons: SendReauthReason[]; simulation: SimulationView};
+}
+
+export type SimulatedProgram = 'compute-budget' | 'system' | 'token' | 'associated-token';
+
+/** What the simulation showed (spec B1b-2a E2), for #19. Amounts are base-unit decimal strings. */
+export interface SimulationView {
+  /** context.slot of the simulateTransaction reply. */
+  slot: number;
+  /** Wall time of the simulate call, measured by the engine. */
+  elapsedMs: number;
+  /** Compiled instruction count. */
+  instructions: number;
+  programs: SimulatedProgram[];
+  recipient: 'wallet' | 'new' | 'program' | 'other';
+  /** Lamports of the fee payer before (the balance prepare read) and after (the simulated state). */
+  sol: {before: string; after: string};
+  /** The source token account, for an SPL send. */
+  token: {symbol: 'NOC' | 'USDC' | 'USDT'; before: string; after: string} | null;
 }
 
 export interface PreparedView {
@@ -63,6 +83,7 @@ export interface PreparedView {
   fees: {networkLamports: string; priorityLamports: string; rentLamports: string; markupLamports: string; markupReason: FeeReason};
   solRequiredLamports: string;
   reauth: {challengeId: string; reasons: SendReauthReason[]} | null;
+  simulation: SimulationView;
 }
 
 /** wallet.preparedFor: the view again, with the intent; `expired` = no longer sendable, prepare again. */
@@ -126,7 +147,41 @@ async function unitPrice(deps: WalletDeps, token: WalletToken): Promise<number |
 function isPreparedShape(x: unknown): x is PreparedSend {
   if (typeof x !== 'object' || x === null) return false;
   const p = x as Record<string, unknown>;
-  return typeof p.id === 'string' && typeof p.integrity === 'string' && typeof p.createdAt === 'number' && typeof p.shown === 'object' && p.shown !== null;
+  if (typeof p.id !== 'string' || typeof p.integrity !== 'string' || typeof p.createdAt !== 'number' || typeof p.shown !== 'object' || p.shown === null) return false;
+  // An entry from before E2 has no simulation to show: not ours to resume.
+  const sim = (p.shown as Record<string, unknown>).simulation;
+  return typeof sim === 'object' && sim !== null;
+}
+
+/** The four programs this engine's own messages use. Anything else is an engine bug, never shown as "unknown". */
+const PROGRAM_NAMES = new Map<string, SimulatedProgram>([
+  ['ComputeBudget111111111111111111111111111111', 'compute-budget'],
+  [SYSTEM_PROGRAM_ID, 'system'],
+  [SPL_TOKEN_PROGRAM_ID.toBase58(), 'token'],
+  [SPL_ATA_PROGRAM_ID.toBase58(), 'associated-token'],
+]);
+
+function programsOf(message: MessageV0): SimulatedProgram[] {
+  const out: SimulatedProgram[] = [];
+  for (const ix of message.compiledInstructions) {
+    const id = message.staticAccountKeys[ix.programIdIndex]?.toBase58() ?? '';
+    const name = PROGRAM_NAMES.get(id);
+    if (name === undefined) throw new Error(`prepare built an instruction for an unexpected program ${id}`);
+    if (!out.includes(name)) out.push(name);
+  }
+  return out;
+}
+
+const recipientKind = (k: AccountKind): SimulationView['recipient'] => (k === 'missing' ? 'new' : k);
+
+/**
+ * An SPL token account's mint (bytes 0–32), owner (32–64) and amount (u64 LE at 64–72). Null when the
+ * simulated account is missing, not owned by the token program, or too short to be one.
+ */
+function tokenAccountOf(a: SimulatedAccount | null): {mint: string; owner: string; amount: bigint} | null {
+  if (a === null || a.owner !== SPL_TOKEN_PROGRAM_ID.toBase58() || a.data.length < 72) return null;
+  const view = new DataView(a.data.buffer, a.data.byteOffset, a.data.byteLength);
+  return {mint: base58.encode(a.data.subarray(0, 32)), owner: base58.encode(a.data.subarray(32, 64)), amount: view.getBigUint64(64, true)};
 }
 
 async function loadPrepared(ext: Ext): Promise<PreparedSend[]> {
@@ -151,6 +206,8 @@ export async function prepareSend(
   const session = await getSession(ext);
   if (session === null) throw new SendRefused('locked');
   if (!session.some(a => a.publicKey === account)) throw new SendRefused('unknown-account');
+  // A send to the sending account itself moves nothing but the fees: refused (review L2; #12 disables it).
+  if (intent.recipient === account) throw new SendRefused('self-send');
   // One in-flight send per account: nothing new is built while an earlier one may still land.
   if (inFlightFor(await readPending(ext), account) !== undefined) throw new SendRefused('in-flight');
 
@@ -171,8 +228,13 @@ export async function prepareSend(
   let rent = 0n;
   let tokenBalance: bigint;
   let recipientExists = true;
+  let recipientAccount: AccountKind;
+  let source: string | null = null;
+  let sourceBefore = 0n;
   if (token.mint === null) {
-    recipientExists = await deps.reader.getAccountExists(intent.recipient);
+    // One read answers both questions (review L4): is there an account (rent), and what kind is it (#19).
+    recipientAccount = await deps.reader.getAccountKind(intent.recipient);
+    recipientExists = recipientAccount !== 'missing';
     computeUnitLimit = computeUnitLimitFor({kind: 'sol'});
     instructions = buildSolTransferInstructions({sender, recipient, lamports: amount, priorityFee: price, computeUnitLimit, markup});
     tokenBalance = solBalance;
@@ -180,7 +242,6 @@ export async function prepareSend(
     const mint = new PublicKey(token.mint);
     const holdings = await deps.reader.getTokenAccountsByOwner(account, {mint: token.mint});
     tokenBalance = holdings.reduce((sum, h) => sum + h.amount, 0n);
-    let source: string | null;
     try {
       source = selectSourceTokenAccount(holdings.map(h => ({pubkey: h.pubkey, amount: h.amount})), amount);
     } catch (e) {
@@ -189,6 +250,9 @@ export async function prepareSend(
       throw e;
     }
     if (source === null) throw new SendRefused('insufficient-token', 'This account holds none of this token.');
+    const chosen = source;
+    sourceBefore = holdings.find(h => h.pubkey === chosen)?.amount ?? 0n;
+    recipientAccount = await deps.reader.getAccountKind(intent.recipient);
     const createAta = !(await deps.reader.getAccountExists(findAssociatedTokenAddress(recipient, mint).toBase58()));
     rent = createAta ? TOKEN_ACCOUNT_RENT_LAMPORTS : 0n;
     computeUnitLimit = computeUnitLimitFor({kind: 'spl', createAta});
@@ -223,8 +287,37 @@ export async function prepareSend(
     throw new SendRefused('recipient-below-rent', `a new account needs at least ${SYSTEM_ACCOUNT_RENT_LAMPORTS} lamports`);
   }
 
-  const simulation = await deps.reader.simulateTransaction(base64.encode(new VersionedTransaction(message).serialize()));
-  if (simulation.err !== null) throw new SendRefused('simulation-failed', JSON.stringify(simulation.err));
+  // E2: the simulation also reports the sender's (and the token source's) state after the transaction.
+  const addresses = source === null ? [account] : [account, source];
+  const started = deps.now();
+  const simulated = await deps.reader.simulateTransaction(base64.encode(new VersionedTransaction(message).serialize()), {accounts: addresses});
+  const elapsedMs = Math.max(0, deps.now() - started);
+  if (simulated.err !== null) throw new SendRefused('simulation-failed', JSON.stringify(simulated.err));
+  const senderAfter = simulated.accounts?.[0] ?? null;
+  if (senderAfter === null) throw new SendRefused('simulation-mismatch', 'the simulation does not show the sending account');
+  // SOL leaving the wallet must be exactly what this send costs: with the network fee in the simulated
+  // state, or without it. Anything else is another transaction, or a balance that moved between reads.
+  const spent = solBalance - senderAfter.lamports;
+  if (spent !== solRequired && spent !== solRequired - networkLamports) {
+    throw new SendRefused('simulation-mismatch', `the simulation moves ${spent} lamports; this send moves ${solRequired} (${solRequired - networkLamports} without the network fee)`);
+  }
+  let tokenChange: SimulationView['token'] = null;
+  if (source !== null && intent.token !== 'SOL') {
+    const after = tokenAccountOf(simulated.accounts?.[1] ?? null);
+    if (after === null || after.mint !== token.mint || after.owner !== account || sourceBefore - after.amount !== amount) {
+      throw new SendRefused('simulation-mismatch', `the simulated token account does not show ${amount} leaving ${source}`);
+    }
+    tokenChange = {symbol: intent.token, before: sourceBefore.toString(), after: after.amount.toString()};
+  }
+  const simulation: SimulationView = {
+    slot: simulated.slot,
+    elapsedMs,
+    instructions: message.compiledInstructions.length,
+    programs: programsOf(message),
+    recipient: recipientKind(recipientAccount),
+    sol: {before: solBalance.toString(), after: senderAfter.lamports.toString()},
+    token: tokenChange,
+  };
 
   const knownRecipient = session.some(a => a.publicKey === intent.recipient) || (await knownRecipients(ext)).has(intent.recipient);
   const settings = await readSettings(ext);
@@ -261,7 +354,7 @@ export async function prepareSend(
     intentDigest,
     challengeId,
   };
-  const prepared: PreparedSend = {...bound, integrity: preparedIntegrity(bound), shown: {fees, solRequiredLamports: solRequired.toString(), reasons}};
+  const prepared: PreparedSend = {...bound, integrity: preparedIntegrity(bound), shown: {fees, solRequiredLamports: solRequired.toString(), reasons, simulation}};
   // Under sessionMutex, the one lock (clearSession) takes: a lock that landed while this send was
   // being read, simulated or challenged is seen here, and nothing is written back after it.
   await sessionMutex(async () => {
@@ -287,6 +380,7 @@ function viewOf(p: PreparedSend): PreparedView {
     fees: p.shown.fees,
     solRequiredLamports: p.shown.solRequiredLamports,
     reauth: p.challengeId === null ? null : {challengeId: p.challengeId, reasons: p.shown.reasons},
+    simulation: p.shown.simulation,
   };
 }
 
```

Modify `extension/src/background/sendTypes.ts`:

```diff
diff --git a/extension/src/background/sendTypes.ts b/extension/src/background/sendTypes.ts
--- a/extension/src/background/sendTypes.ts
+++ b/extension/src/background/sendTypes.ts
@@ -10,11 +10,13 @@ export interface SendIntent {
 export type SendRefusal =
   | 'locked'
   | 'unknown-account'
+  | 'self-send'
   | 'in-flight'
   | 'split-balance'
   | 'insufficient-token'
   | 'insufficient-sol'
   | 'simulation-failed'
+  | 'simulation-mismatch'
   | 'unknown-prepared'
   | 'prepared-expired'
   | 'prepared-invalid'
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run ../core/solana/__tests__/rpc.test.ts src/background/__tests__/prepareSimulation.test.ts src/background/__tests__/prepare.test.ts`
Expected: PASS — 3 files, 67 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 57 files, 729 tests.

- [ ] **Step 6: The root app, because `core/` changed** (standing rule). From the repository root, with the root install present:

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; `Test Suites: 1 skipped, 180 passed` · `Tests: 1 skipped, 1228 passed` (the dry run's numbers at the end of this plan; no root test changes in this plan).

- [ ] **Step 7: The existing E2E still passes** (the fake coordinator and `wallet.spec.ts` changed).

Run: `npm run build && npx playwright test e2e/wallet.spec.ts e2e/unlock.spec.ts`
Expected: `3 passed`. (The dry run ran it inside `unshare -rn`; both specs are contained either way.)

- [ ] **Step 8: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **`>=` instead of exact:** in `prepare.ts`, replace `if (spent !== solRequired && spent !== solRequired - networkLamports) {` with `if (spent < solRequired - networkLamports) {`. Run `npx vitest run src/background/__tests__/prepareSimulation.test.ts` → RED: 2 failed ("one lamport off in either direction").
  - **ignore the mint:** in `prepare.ts`, delete `after.mint !== token.mint || `. Run `npx vitest run src/background/__tests__/prepareSimulation.test.ts` → RED: 1 failed.
  - **ignore the owner:** in `prepare.ts`, delete `after.owner !== account || `. Run `npx vitest run src/background/__tests__/prepareSimulation.test.ts` → RED: 1 failed.
  - **allow a send to itself (L2):** in `prepare.ts`, delete `if (intent.recipient === account) throw new SendRefused('self-send');`. Run `npx vitest run src/background/__tests__/prepare.test.ts` → RED: 1 failed.
  - **treat an err reply as malformed:** in `core/solana/rpc.ts`, replace `if (err !== null || addresses.length === 0) return {...outcome, accounts: null};` with `if (addresses.length === 0) return {...outcome, accounts: null};`. Run `npx vitest run src/background/__tests__/prepareSimulation.test.ts` → RED: 1 failed ("… is simulation-failed — through the real reader").

- [ ] **Step 9: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add core/solana/__tests__/rpc.test.ts core/solana/rpc.ts extension/e2e/fakeCoordinator.ts extension/e2e/wallet.spec.ts extension/src/background/__tests__/fakeDeps.ts extension/src/background/__tests__/fixtures.ts extension/src/background/__tests__/prepare.test.ts extension/src/background/__tests__/prepareSimulation.test.ts extension/src/background/prepare.ts extension/src/background/sendTypes.ts
git commit -m "feat(extension,core): the simulation's balance changes and simulation-mismatch (B1b-2a E2)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 4: The action behind a challenge (E3): `about`, the re-based and capped life, `vault.challengeInfo`

**Files:**
- Modify: `extension/src/background/messages.ts`
- Modify: `extension/src/background/prepare.ts`
- Modify: `extension/src/background/reauthChallenges.ts`
- Modify: `extension/src/background/walletApi.ts`
- Test (create): `extension/src/background/__tests__/challengeAbout.test.ts`
- Test (modify): `extension/src/background/__tests__/fixtures.ts`
- Test (modify): `extension/src/background/__tests__/messages.test.ts`
- Test (modify): `extension/src/background/__tests__/reauthChallenges.test.ts`

**Interfaces:**
- Consumes: Task 3's `prepareSend` (fees, reasons, settings are computed before the challenge).
- Produces:
  - `reauthChallenges.ts`: `CHALLENGE_MAX_LIFE_MS = 600_000`; `type ChallengeAbout = {kind: 'send'; account; token; recipient; amount; networkLamports; markupLamports; markupReason; rentLamports; reasons; thresholdCents} | {kind: 'settings'; autoLockMinutes: number | null; reauthUsdCents: number | null}`; `type SendAboutRefresh`; `issueChallenge(ext, deps, digest, about)` (4th parameter, required); `rebaseChallenge(ext, now, id, digest, refresh): Promise<boolean>`; `challengeInfo(ext, now, id): Promise<ChallengeAbout | null>`
  - message `{type: 'vault.challengeInfo', challengeId}` → `ChallengeAbout` (refusals `malformed`, `locked`, `unknown-challenge`; `forbidden` from anywhere but `/unlock.html`)
  - test fixture `SETTINGS_ABOUT`

Spec §2 E3: a challenge record gains `about` ("written by the same `issueChallenge` call that binds the digest, from the same parsed values") and `issuedAt`; `isChallenge` validates `about`'s exact shape. D39: a still-live challenge carried into a re-prepare of the **same intent** is re-based to `now + 120 s` — never revived, never for another digest, `satisfied` kept. C5: "`rebaseChallenge` sets `expiresAt = min(now + 120 s, issuedAt + CHALLENGE_MAX_LIFE_MS)`" with 10 minutes. `vault.challengeInfo` is vault-page-only (`VAULT_PAGE_ONLY`) — "The popup and the tab cannot read it". The page-side renderer and the `unknown-challenge → expired` mapping are plan 2 (Scope item 6).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/__tests__/challengeAbout.test.ts`:

```ts
import {CHALLENGE_MAX_LIFE_MS, CHALLENGE_TTL_MS, challengeInfo, issueChallenge, rebaseChallenge, satisfyChallenge, type ChallengeAbout, type SendAboutRefresh} from '../reauthChallenges';
import {handleMessage} from '../messages';
import {prepareSend, sendIntentDigest} from '../prepare';
import {REAUTH_KEY} from '../session';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, SETTINGS_ABOUT, sendReader, unlocked} from './fixtures';

// Spec B1b-2a E3: the action behind a challenge, read by the vault page from the background; the
// challenge life re-based by a same-intent re-prepare (D39) and capped at ten minutes (C5).
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const from = (path: string) => ({id: ID, origin: ORIGIN, url: `${ORIGIN}${path}`});
const SEND_ABOUT: ChallengeAbout = {
  kind: 'send',
  account: ACCOUNT.publicKey,
  token: 'SOL',
  recipient: RECIPIENT,
  amount: '1000000',
  networkLamports: '5050',
  markupLamports: '0',
  markupReason: 'status-unknown',
  rentLamports: '0',
  reasons: ['first-send'],
  thresholdCents: 10_000,
};
const REFRESH: SendAboutRefresh = {networkLamports: '9050', markupLamports: '0', markupReason: 'status-unknown', rentLamports: '0', reasons: ['first-send', 'over-usd-threshold'], thresholdCents: 10_000};
const SOL_INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};

describe('the challenge describes its action (E3)', () => {
  it('prepareSend stores what #10 shows, from the values it bound the digest to', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const view = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    expect(await challengeInfo(ext, deps.now(), view.reauth!.challengeId)).toEqual({
      kind: 'send',
      account: ACCOUNT.publicKey,
      token: 'SOL',
      recipient: RECIPIENT,
      amount: '1000000',
      networkLamports: '5050',
      markupLamports: '0',
      markupReason: 'status-unknown',
      rentLamports: '0',
      reasons: ['first-send'],
      thresholdCents: 10_000,
    });
  });

  it('a reuse refreshes the fee fields and keeps the digest and the identity fields', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const first = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    const id = first.reauth!.challengeId;
    const before = ((await ext.session.get(REAUTH_KEY)) as Record<string, {digest: string}>)[id]!.digest;
    const busier = fakeDeps({reader: sendReader({getRecentPrioritizationFees: async () => [{prioritizationFee: 4_000_000}]})});
    busier.clock.t = deps.clock.t + 10_000;
    const again = await prepareSend(ext, busier, ACCOUNT.publicKey, SOL_INTENT, {challengeId: id});
    expect(again.reauth?.challengeId).toBe(id);
    const stored = ((await ext.session.get(REAUTH_KEY)) as Record<string, {digest: string; about: ChallengeAbout}>)[id]!;
    expect(stored.digest).toBe(before);
    expect(stored.digest).toBe(sendIntentDigest(ACCOUNT.publicKey, SOL_INTENT));
    expect(stored.about).toMatchObject({account: ACCOUNT.publicKey, recipient: RECIPIENT, amount: '1000000', token: 'SOL'});
    expect(stored.about).not.toMatchObject({networkLamports: '5050'});
  });

  it('a stored record whose about has another shape is dropped', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    const stored = (await ext.session.get(REAUTH_KEY)) as Record<string, Record<string, unknown>>;
    for (const about of [{...SEND_ABOUT, token: 'BONK'}, {...SEND_ABOUT, amount: '1.5'}, {...SEND_ABOUT, reasons: ['nope']}, {...SEND_ABOUT, extra: 1}, {kind: 'settings'}, null]) {
      await ext.session.set(REAUTH_KEY, {[id]: {...stored[id], about}});
      expect(await challengeInfo(ext, deps.now(), id)).toBeNull();
    }
  });

  it('issueChallenge refuses a malformed about', async () => {
    await expect(issueChallenge(fakeExt(), fakeDeps(), 'd', {kind: 'settings'} as unknown as ChallengeAbout)).rejects.toThrow();
  });
});

describe('rebaseChallenge (D39, C5)', () => {
  it('a same-intent reuse renews the 120 s life and keeps satisfied', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    expect(await satisfyChallenge(ext, deps.now(), id)).toBe(true);
    deps.clock.t += 100_000;
    expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(true);
    deps.clock.t += 100_000; // 200 s after issue: alive only because it was re-based
    const c = ((await ext.session.get(REAUTH_KEY)) as Record<string, {expiresAt: number; satisfied: boolean; about: ChallengeAbout}>)[id]!;
    expect(c.satisfied).toBe(true);
    expect(c.expiresAt).toBe(deps.clock.t - 100_000 + CHALLENGE_TTL_MS);
    expect(c.about).toMatchObject({networkLamports: '9050', reasons: ['first-send', 'over-usd-threshold'], amount: '1000000'});
    expect(await challengeInfo(ext, deps.now(), id)).not.toBeNull();
  });

  it('never re-bases another digest, and never revives an expired challenge', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    expect(await rebaseChallenge(ext, deps.now(), id, 'other', REFRESH)).toBe(false);
    deps.clock.t += CHALLENGE_TTL_MS;
    expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(false);
    expect(await challengeInfo(ext, deps.now(), id)).toBeNull();
  });

  it('the Nth re-base stops at issuedAt + 10 min, and the one after finds the challenge expired', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const issuedAt = deps.clock.t;
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    // A re-prepare every 100 s keeps it alive…
    while (deps.clock.t + 100_000 < issuedAt + CHALLENGE_MAX_LIFE_MS) {
      deps.clock.t += 100_000;
      expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(true);
    }
    const c = ((await ext.session.get(REAUTH_KEY)) as Record<string, {expiresAt: number}>)[id]!;
    expect(c.expiresAt).toBe(issuedAt + CHALLENGE_MAX_LIFE_MS);
    // …but never past the cap.
    deps.clock.t = issuedAt + CHALLENGE_MAX_LIFE_MS;
    expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(false);
    expect(await challengeInfo(ext, deps.now(), id)).toBeNull();
  });

  it('a settings challenge is never re-based as a send', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(false);
  });
});

describe('vault.challengeInfo (E3)', () => {
  async function setup() {
    const ext = fakeExt();
    const deps = fakeDeps();
    await unlocked(ext);
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    return {ext, deps, id};
  }

  it('answers the vault page with the stored description', async () => {
    const {ext, deps, id} = await setup();
    expect(await handleMessage(ext, {type: 'vault.challengeInfo', challengeId: id}, from('/unlock.html'), deps)).toEqual({ok: true, data: SEND_ABOUT});
  });

  it('refuses the popup, the tab and a web page', async () => {
    const {ext, deps, id} = await setup();
    for (const sender of [from('/popup.html'), from('/wallet.html'), {id: ID, origin: 'https://evil.example', url: 'https://evil.example/unlock.html'}]) {
      expect(await handleMessage(ext, {type: 'vault.challengeInfo', challengeId: id}, sender, deps)).toEqual({ok: false, error: 'forbidden'});
    }
  });

  it('malformed id, locked, expired', async () => {
    const {ext, deps, id} = await setup();
    const ask = (challengeId: unknown) => handleMessage(ext, {type: 'vault.challengeInfo', challengeId}, from('/unlock.html'), deps);
    expect(await ask('<b>')).toEqual({ok: false, error: 'malformed'});
    expect(await ask('f'.repeat(32))).toEqual({ok: false, error: 'unknown-challenge'});
    deps.clock.t += CHALLENGE_TTL_MS;
    expect(await ask(id)).toEqual({ok: false, error: 'unknown-challenge'});
    await handleMessage(ext, {type: 'vault.lock'}, from('/popup.html'), deps);
    expect(await ask(id)).toEqual({ok: false, error: 'locked'});
  });
});
```

Modify `extension/src/background/__tests__/fixtures.ts`:

```diff
diff --git a/extension/src/background/__tests__/fixtures.ts b/extension/src/background/__tests__/fixtures.ts
--- a/extension/src/background/__tests__/fixtures.ts
+++ b/extension/src/background/__tests__/fixtures.ts
@@ -6,6 +6,7 @@ import type {SessionAccount} from '../../vault/accounts';
 import type {SimulationOutcome, SolanaReader} from '../../../../core/solana/rpc';
 import {setSession} from '../session';
 import type {PendingRecord} from '../pendingStore';
+import type {ChallengeAbout} from '../reauthChallenges';
 import {fakeReader} from './fakeDeps';
 
 /** A real Ed25519 keypair (32 × 0x01 seed): its address is AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9. */
@@ -121,3 +122,6 @@ export function signedWire(lamports = 1n): Uint8Array {
   tx.addSignature(payer, ed25519.sign(message.serialize(), SEED));
   return tx.serialize();
 }
+
+/** A well-formed `about` for challenges whose action a test does not care about. */
+export const SETTINGS_ABOUT: ChallengeAbout = {kind: 'settings', autoLockMinutes: null, reauthUsdCents: null};
```

Modify `extension/src/background/__tests__/messages.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -1,3 +1,4 @@
+import {SETTINGS_ABOUT} from './fixtures';
 import {ed25519} from '@noble/curves/ed25519.js';
 import {base58, base64} from '@scure/base';
 import {PRIVILEGED, handleMessage} from '../messages';
@@ -190,7 +191,7 @@ describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
   // 'unknown type' here, which fails, rather than silently shrinking the test.
   const ALL = [
-    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'activity.ping',
+    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
   ];
@@ -213,7 +214,7 @@ describe('message partitions (B1b-1 types)', () => {
     const ext = fakeExt();
     const deps = fakeDeps();
     await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
-    const challengeId = await issueChallenge(ext, deps, 'd');
+    const challengeId = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
     expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, popup, deps)).toEqual({ok: false, error: 'forbidden'});
     expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId: 'f'.repeat(32)}, unlockPage, deps)).toEqual({ok: false, error: 'unknown-challenge'});
     expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps)).toEqual({ok: true});
```

Modify `extension/src/background/__tests__/reauthChallenges.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/reauthChallenges.test.ts b/extension/src/background/__tests__/reauthChallenges.test.ts
--- a/extension/src/background/__tests__/reauthChallenges.test.ts
+++ b/extension/src/background/__tests__/reauthChallenges.test.ts
@@ -1,3 +1,4 @@
+import {SETTINGS_ABOUT} from './fixtures';
 import {lock} from '../autolock';
 import {REAUTH_KEY} from '../session';
 import {CHALLENGE_TTL_MS, challengeReusable, challengeSatisfied, consumeChallenge, issueChallenge, satisfyChallenge} from '../reauthChallenges';
@@ -8,7 +9,7 @@ describe('re-auth challenges', () => {
   it('issue → satisfy → consume once, with the same digest (positive control)', async () => {
     const ext = fakeExt();
     const deps = fakeDeps();
-    const id = await issueChallenge(ext, deps, 'd1');
+    const id = await issueChallenge(ext, deps, 'd1', SETTINGS_ABOUT);
     expect(id).toMatch(/^[0-9a-f]{32}$/);
     expect(await challengeSatisfied(ext, deps.now(), id, 'd1')).toBe(false);
     expect(await satisfyChallenge(ext, deps.now(), id)).toBe(true);
@@ -20,7 +21,7 @@ describe('re-auth challenges', () => {
   it('an unsatisfied challenge cannot be consumed, and stays usable', async () => {
     const ext = fakeExt();
     const deps = fakeDeps();
-    const id = await issueChallenge(ext, deps, 'd1');
+    const id = await issueChallenge(ext, deps, 'd1', SETTINGS_ABOUT);
     expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
     await satisfyChallenge(ext, deps.now(), id);
     expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(true);
@@ -29,7 +30,7 @@ describe('re-auth challenges', () => {
   it('a different digest never consumes it — and burns it', async () => {
     const ext = fakeExt();
     const deps = fakeDeps();
-    const id = await issueChallenge(ext, deps, 'd1');
+    const id = await issueChallenge(ext, deps, 'd1', SETTINGS_ABOUT);
     await satisfyChallenge(ext, deps.now(), id);
     expect(await consumeChallenge(ext, deps.now(), id, 'd2')).toBe(false);
     expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
@@ -38,8 +39,8 @@ describe('re-auth challenges', () => {
   it('expires after two minutes, satisfied or not', async () => {
     const ext = fakeExt();
     const deps = fakeDeps();
-    const a = await issueChallenge(ext, deps, 'd');
-    const b = await issueChallenge(ext, deps, 'd');
+    const a = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
+    const b = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
     expect(await satisfyChallenge(ext, deps.now() + CHALLENGE_TTL_MS - 1, b)).toBe(true);
     expect(await satisfyChallenge(ext, deps.now() + CHALLENGE_TTL_MS, a)).toBe(false);
     expect(await consumeChallenge(ext, deps.now() + CHALLENGE_TTL_MS, b, 'd')).toBe(false);
@@ -53,7 +54,7 @@ describe('re-auth challenges', () => {
   it('ids that name inherited properties, or are malformed, are refused by every function', async () => {
     const ext = fakeExt();
     const deps = fakeDeps();
-    const real = await issueChallenge(ext, deps, 'd');
+    const real = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
     await satisfyChallenge(ext, deps.now(), real);
     const hostile = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'xyz', '', 'F'.repeat(32), 'f'.repeat(31), 'f'.repeat(33), `${real} `];
     for (const id of hostile) {
@@ -87,14 +88,14 @@ describe('re-auth challenges', () => {
   });
 
   it('issueChallenge refuses to bind an empty digest', async () => {
-    await expect(issueChallenge(fakeExt(), fakeDeps(), '')).rejects.toThrow();
+    await expect(issueChallenge(fakeExt(), fakeDeps(), '', SETTINGS_ABOUT)).rejects.toThrow();
   });
 
   it('consume succeeds at TTL − 1 and fails at TTL', async () => {
     const ext = fakeExt();
     const deps = fakeDeps();
-    const a = await issueChallenge(ext, deps, 'd');
-    const b = await issueChallenge(ext, deps, 'd');
+    const a = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
+    const b = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
     await satisfyChallenge(ext, deps.now(), a);
     await satisfyChallenge(ext, deps.now(), b);
     expect(await challengeSatisfied(ext, deps.now() + CHALLENGE_TTL_MS - 1, a, 'd')).toBe(true);
@@ -106,9 +107,9 @@ describe('re-auth challenges', () => {
   it('issueChallenge prunes expired entries', async () => {
     const ext = fakeExt();
     const deps = fakeDeps();
-    const old = await issueChallenge(ext, deps, 'd');
+    const old = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
     deps.clock.t += CHALLENGE_TTL_MS;
-    const fresh = await issueChallenge(ext, deps, 'd');
+    const fresh = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
     expect(Object.keys((await ext.session.get(REAUTH_KEY)) as object)).toEqual([fresh]);
     expect(old).not.toBe(fresh);
   });
@@ -128,7 +129,7 @@ describe('re-auth challenges', () => {
       }
       return realGet(k);
     };
-    const issuing = issueChallenge(ext, deps, 'd');
+    const issuing = issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
     await readStarted;
     const locking = lock(ext);
     // Give the lock every chance to run ahead of the pending write.
@@ -146,7 +147,7 @@ describe('challengeReusable (a re-prepared send keeps its proof)', () => {
   it('true for a live challenge with the same digest, proven or not; false for another digest, an expired or unknown id', async () => {
     const ext = fakeExt();
     const deps = fakeDeps();
-    const id = await issueChallenge(ext, deps, 'd1');
+    const id = await issueChallenge(ext, deps, 'd1', SETTINGS_ABOUT);
     expect(await challengeReusable(ext, deps.now(), id, 'd1')).toBe(true);
     await satisfyChallenge(ext, deps.now(), id);
     expect(await challengeReusable(ext, deps.now(), id, 'd1')).toBe(true);
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/background/__tests__/challengeAbout.test.ts src/background/__tests__/reauthChallenges.test.ts src/background/__tests__/messages.test.ts`
Expected: FAIL — 12 tests in `challengeAbout.test.ts` (`issueChallenge` ignores `about`, `rebaseChallenge`/`challengeInfo` do not exist) and the exhaustive type list in `messages.test.ts`.

- [ ] **Step 3: Implement.**

Modify `extension/src/background/messages.ts`:

```diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -5,7 +5,7 @@ import type {SessionAccount} from '../vault/accounts';
 import {getSession, setSession} from './session';
 import {armAutolock, lock} from './autolock';
 import type {WalletDeps} from './deps';
-import {satisfyChallenge} from './reauthChallenges';
+import {challengeInfo, satisfyChallenge} from './reauthChallenges';
 import {storeEnvelope} from './accountsStore';
 import {WALLET_TYPES, handleWallet, isWalletType, type Result} from './walletApi';
 
@@ -24,12 +24,13 @@ export interface Sender {
  * sets — never the URL the message claims, and never "has a tab", which a full-tab
  * extension page also has.
  */
-export const PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'activity.ping', ...WALLET_TYPES] as const;
+export const PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'activity.ping', ...WALLET_TYPES] as const;
 /**
- * Only the vault page itself may hand over keys, report a re-authentication it proved, or hand over
- * the envelope it re-encrypted (the background is the one writer of v1_vault).
+ * Only the vault page itself may hand over keys, report a re-authentication it proved, hand over
+ * the envelope it re-encrypted (the background is the one writer of v1_vault), or read what a
+ * re-authentication is for (vault.challengeInfo, B1b-2a E3: the popup and the tab cannot).
  */
-const VAULT_PAGE_ONLY: readonly string[] = ['vault.setKeys', 'vault.reauthOk', 'vault.storeEnvelope'];
+const VAULT_PAGE_ONLY: readonly string[] = ['vault.setKeys', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo'];
 export const PAGE: readonly string[] = [];
 
 function isOwnPage(ext: Ext, s: Sender): boolean {
@@ -130,6 +131,15 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
       return (await satisfyChallenge(ext, deps.now(), challengeId)) ? {ok: true} : {ok: false, error: 'unknown-challenge'};
     }
+    case 'vault.challengeInfo': {
+      if (deps === undefined) return {ok: false, error: 'unavailable'};
+      const challengeId = (msg as {challengeId?: unknown}).challengeId;
+      if (typeof challengeId !== 'string' || !/^[0-9a-f]{32}$/.test(challengeId)) return {ok: false, error: 'malformed'};
+      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
+      // The description comes only from here, never from the vault page's URL (E3).
+      const about = await challengeInfo(ext, deps.now(), challengeId);
+      return about === null ? {ok: false, error: 'unknown-challenge'} : {ok: true, data: about};
+    }
     case 'vault.storeEnvelope': {
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
       const r = await storeEnvelope(ext, expectedRevision, envelope);
```

Modify `extension/src/background/prepare.ts`:

```diff
diff --git a/extension/src/background/prepare.ts b/extension/src/background/prepare.ts
--- a/extension/src/background/prepare.ts
+++ b/extension/src/background/prepare.ts
@@ -8,7 +8,7 @@ import {EXTENSION_FEE_INPUTS} from './feePolicy';
 import {knownRecipients} from './knownRecipients';
 import {readSettings} from './settings';
 import {sendReauthReasons, usdMicros, type SendReauthReason} from './reauthPolicy';
-import {CHALLENGE_TTL_MS, challengeReusable, issueChallenge} from './reauthChallenges';
+import {CHALLENGE_TTL_MS, issueChallenge, rebaseChallenge, type SendAboutRefresh} from './reauthChallenges';
 import {digestOf, randomId} from './digest';
 import {SendRefused, type SendIntent} from './sendTypes';
 import {estimatePriorityFee} from '../../../core/solana/priorityFee';
@@ -333,10 +333,6 @@ export async function prepareSend(
   const intentDigest = sendIntentDigest(account, intent);
   const carried = opts.challengeId;
   // Issued before the critical section below: issueChallenge takes sessionMutex itself, which is not re-entrant.
-  let challengeId: string | null = null;
-  if (reasons.length > 0) {
-    challengeId = carried !== undefined && (await challengeReusable(ext, deps.now(), carried, intentDigest)) ? carried : await issueChallenge(ext, deps, intentDigest);
-  }
   const fees = {
     networkLamports: networkLamports.toString(),
     priorityLamports: priorityLamports.toString(),
@@ -344,6 +340,23 @@ export async function prepareSend(
     markupLamports: markupLamports.toString(),
     markupReason: fee.reason,
   };
+  // E3: what #10 shows, bound to the challenge by the same values the digest was computed from.
+  const refresh: SendAboutRefresh = {
+    networkLamports: fees.networkLamports,
+    markupLamports: fees.markupLamports,
+    markupReason: fees.markupReason,
+    rentLamports: fees.rentLamports,
+    reasons,
+    thresholdCents: settings.reauthUsdCents,
+  };
+  let challengeId: string | null = null;
+  if (reasons.length > 0) {
+    // A live challenge of this intent is renewed (D39, capped by C5); anything else gets a new one.
+    const renewed = carried !== undefined && (await rebaseChallenge(ext, deps.now(), carried, intentDigest, refresh));
+    challengeId = renewed
+      ? (carried as string)
+      : await issueChallenge(ext, deps, intentDigest, {kind: 'send', account, token: intent.token, recipient: intent.recipient, amount: intent.amount, ...refresh});
+  }
   const bound = {
     id: randomId(deps.randomBytes),
     account,
```

Modify `extension/src/background/reauthChallenges.ts`:

```diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -2,25 +2,86 @@ import type {Ext} from '../ext';
 import type {WalletDeps} from './deps';
 import {REAUTH_KEY, sessionMutex} from './session';
 import {randomId} from './digest';
+import type {SendReauthReason} from './reauthPolicy';
+import type {FeeReason} from '../../../core/fees/transferMarkup';
 
-/** How long the vault page has to prove the factor (brief decision 6). */
+/** How long the vault page has to prove the factor (brief decision 6), counted from the last prepare of the same intent. */
 export const CHALLENGE_TTL_MS = 120_000;
+/**
+ * No re-base extends a challenge past its issue plus this (controller ruling C5): whatever re-prepares
+ * happen, one proof lives at most ten minutes (spec B1b-2a E3).
+ */
+export const CHALLENGE_MAX_LIFE_MS = 10 * 60_000;
 
 /** What randomId produces. Anything else — `__proto__`, `constructor`, garbage — is refused unread. */
 const CHALLENGE_ID = /^[0-9a-f]{32}$/;
 
+/**
+ * The action behind a challenge, written by the same call that binds the digest, from the same parsed
+ * values (E3). The vault page reads it through vault.challengeInfo — never from its URL. Amounts are
+ * base-unit decimal strings.
+ */
+export type ChallengeAbout =
+  | {
+      kind: 'send';
+      account: string;
+      token: 'SOL' | 'NOC' | 'USDC' | 'USDT';
+      recipient: string;
+      amount: string;
+      networkLamports: string;
+      markupLamports: string;
+      markupReason: FeeReason;
+      rentLamports: string;
+      reasons: SendReauthReason[];
+      thresholdCents: number;
+    }
+  | {kind: 'settings'; autoLockMinutes: number | null; reauthUsdCents: number | null};
+
+/** The fields a re-prepare of the same intent may refresh; the identity fields (account, token, recipient, amount) never change. */
+export type SendAboutRefresh = Pick<Extract<ChallengeAbout, {kind: 'send'}>, 'networkLamports' | 'markupLamports' | 'markupReason' | 'rentLamports' | 'reasons' | 'thresholdCents'>;
+
 interface Challenge {
   digest: string;
+  issuedAt: number;
   expiresAt: number;
   satisfied: boolean;
+  about: ChallengeAbout;
 }
 // A Map, not an object: no id can resolve to an inherited property.
 type Store = Map<string, Challenge>;
 
+const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
+const REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new'];
+const FEE_REASONS: readonly string[] = ['pre-tge', 'zero-fee-eligible', 'status-unknown', 'charged'];
+const DIGITS = /^\d{1,20}$/;
+const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x);
+const isIntOrNull = (x: unknown): boolean => x === null || isInt(x);
+
+/** The exact shape of `about`: a stored record with any other shape is dropped. */
+function isAbout(x: unknown): x is ChallengeAbout {
+  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
+  const a = x as Record<string, unknown>;
+  if (a.kind === 'settings') return isIntOrNull(a.autoLockMinutes) && isIntOrNull(a.reauthUsdCents) && Object.keys(a).length === 3;
+  if (a.kind !== 'send') return false;
+  return (
+    typeof a.account === 'string' &&
+    typeof a.recipient === 'string' &&
+    typeof a.token === 'string' &&
+    TOKENS.includes(a.token) &&
+    [a.amount, a.networkLamports, a.markupLamports, a.rentLamports].every(v => typeof v === 'string' && DIGITS.test(v)) &&
+    typeof a.markupReason === 'string' &&
+    FEE_REASONS.includes(a.markupReason) &&
+    Array.isArray(a.reasons) &&
+    (a.reasons as unknown[]).every(r => typeof r === 'string' && REASONS.includes(r)) &&
+    isInt(a.thresholdCents) &&
+    Object.keys(a).length === 11
+  );
+}
+
 function isChallenge(x: unknown): x is Challenge {
   if (typeof x !== 'object' || x === null) return false;
   const c = x as Record<string, unknown>;
-  return typeof c.digest === 'string' && typeof c.expiresAt === 'number' && typeof c.satisfied === 'boolean';
+  return typeof c.digest === 'string' && typeof c.issuedAt === 'number' && typeof c.expiresAt === 'number' && typeof c.satisfied === 'boolean' && isAbout(c.about);
 }
 
 async function load(ext: Ext): Promise<Store> {
@@ -43,18 +104,48 @@ function live(store: Store, now: number): Store {
 // never land between a read and its write and be undone by the write.
 
 /** A new challenge for the action whose digest is given; the vault page proves, the action consumes. */
-export async function issueChallenge(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, digest: string): Promise<string> {
+export async function issueChallenge(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, digest: string, about: ChallengeAbout): Promise<string> {
   if (digest.length === 0) throw new TypeError('issueChallenge: empty digest');
+  if (!isAbout(about)) throw new TypeError('issueChallenge: malformed about');
   const id = randomId(deps.randomBytes);
   await sessionMutex(async () => {
     const now = deps.now();
     const store = live(await load(ext), now);
-    store.set(id, {digest, expiresAt: now + CHALLENGE_TTL_MS, satisfied: false});
+    store.set(id, {digest, issuedAt: now, expiresAt: now + CHALLENGE_TTL_MS, satisfied: false, about});
     await save(ext, store);
   });
   return id;
 }
 
+/**
+ * A re-prepare of the same intent carries a still-live challenge (owner D39): the same grant renewed,
+ * not a new one. True, and `expiresAt` = min(now + CHALLENGE_TTL_MS, issuedAt + CHALLENGE_MAX_LIFE_MS)
+ * with `satisfied` kept, for a live challenge with this digest; the send fields of `about` that a
+ * re-prepare recomputes are refreshed. False — nothing changed — for an expired, unknown or other-digest
+ * challenge: an expired one is never revived, and one bound elsewhere is never re-based.
+ */
+export async function rebaseChallenge(ext: Ext, now: number, id: string, digest: string, refresh: SendAboutRefresh): Promise<boolean> {
+  if (!CHALLENGE_ID.test(id)) return false;
+  return sessionMutex(async () => {
+    const store = live(await load(ext), now);
+    const c = store.get(id);
+    if (c === undefined || c.digest !== digest || c.about.kind !== 'send') return false;
+    // A live challenge has issuedAt + CHALLENGE_MAX_LIFE_MS ≥ expiresAt > now, so this never shortens it.
+    const expiresAt = Math.min(now + CHALLENGE_TTL_MS, c.issuedAt + CHALLENGE_MAX_LIFE_MS);
+    const about = {...c.about, ...refresh};
+    store.set(id, {...c, expiresAt, about});
+    await save(ext, store);
+    return true;
+  });
+}
+
+/** vault.challengeInfo: the action a live challenge stands for, or null (unknown, malformed or expired). */
+export async function challengeInfo(ext: Ext, now: number, id: string): Promise<ChallengeAbout | null> {
+  if (!CHALLENGE_ID.test(id)) return null;
+  const c = (await load(ext)).get(id);
+  return c !== undefined && c.expiresAt > now ? c.about : null;
+}
+
 /** vault.reauthOk: the proof succeeded in the vault page. False for an unknown, malformed or expired id. */
 export async function satisfyChallenge(ext: Ext, now: number, id: string): Promise<boolean> {
   if (!CHALLENGE_ID.test(id)) return false;
@@ -100,3 +191,4 @@ export async function consumeChallenge(ext: Ext, now: number, id: string, digest
     return c.digest === digest;
   });
 }
+
```

Modify `extension/src/background/walletApi.ts`:

```diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -172,7 +172,7 @@ async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unkno
       if (typeof id !== 'string' || !(await consumeChallenge(ext, deps.now(), id, digest))) {
         // A lock may have landed since the check above: never issue a challenge into a locked session.
         if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
-        const challengeId = await issueChallenge(ext, deps, digest);
+        const challengeId = await issueChallenge(ext, deps, digest, {kind: 'settings', autoLockMinutes: patch.autoLockMinutes ?? null, reauthUsdCents: patch.reauthUsdCents ?? null});
         // …nor keep one a lock raced past (issueChallenge wrote after the lock's clear): as in
         // prepareSend, remove just the challenges, under the mutex the lock takes — never lock()
         // or clearSession() here, which would wait on this very mutex.
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/background/__tests__/challengeAbout.test.ts src/background/__tests__/reauthChallenges.test.ts src/background/__tests__/messages.test.ts`
Expected: PASS — 3 files, 51 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 58 files, 740 tests.

- [ ] **Step 6: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **re-base on any digest:** in `rebaseChallenge`, replace `if (c === undefined || c.digest !== digest || c.about.kind !== 'send') return false;` with `if (c === undefined || c.about.kind !== 'send') return false;`. Run `npx vitest run src/background/__tests__/challengeAbout.test.ts` → RED: 1 failed.
  - **no cap:** in `rebaseChallenge`, replace `const expiresAt = Math.min(now + CHALLENGE_TTL_MS, c.issuedAt + CHALLENGE_MAX_LIFE_MS);` with `const expiresAt = now + CHALLENGE_TTL_MS;`. Run `npx vitest run src/background/__tests__/challengeAbout.test.ts` → RED: 1 failed ("the Nth re-base stops at issuedAt + 10 min").

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/background/__tests__/challengeAbout.test.ts extension/src/background/__tests__/fixtures.ts extension/src/background/__tests__/messages.test.ts extension/src/background/__tests__/reauthChallenges.test.ts extension/src/background/messages.ts extension/src/background/prepare.ts extension/src/background/reauthChallenges.ts extension/src/background/walletApi.ts
git commit -m "feat(extension): what a re-auth challenge is for, re-based and capped at 10 minutes (B1b-2a E3, D39, C5)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 5: `wallet.recipientInfo` (E6) and `wallet.discardPrepared` (E7)

**Files:**
- Modify: `extension/e2e/wallet.spec.ts`
- Modify: `extension/src/background/knownRecipients.ts`
- Modify: `extension/src/background/pending.ts`
- Modify: `extension/src/background/prepare.ts`
- Modify: `extension/src/background/reauthChallenges.ts`
- Modify: `extension/src/background/walletApi.ts`
- Test (modify): `extension/src/background/__tests__/knownRecipients.test.ts`
- Test (modify): `extension/src/background/__tests__/messages.test.ts`
- Test (create): `extension/src/background/__tests__/recipientInfo.test.ts`

**Interfaces:**
- Consumes: Task 4's challenge store; B1b-1's `knownRecipients`, `addKnownRecipient` (called by the poller on confirmation).
- Produces:
  - `knownRecipients.ts`: `interface KnownRecipient {address: string; at: number | null}`; `lastSentAt(ext, address)`; `isKnownRecipient(ext, session, recipient)`; `addKnownRecipient(ext, address, at)` (3rd parameter)
  - `prepare.ts`: `discardPrepared(ext, account)`; `reauthChallenges.ts`: `dropChallengesFor(ext, digests)` (caller holds `sessionMutex`)
  - messages `{type: 'wallet.recipientInfo', account, recipient}` → `{known, lastSentAt, label: {kind: 'own', index, name} | {kind: 'treasury'} | null, self}` (refusals `malformed`, `locked`); `{type: 'wallet.discardPrepared', account}` → `{ok: true}` (refusal `malformed`)

Spec §2 E6 (controller ruling C1): a local, read-only answer for #12 — `known` "uses the **same function prepare uses** (`isKnownRecipient(ext, session, recipient)`, extracted from `prepare.ts`)", so #12's hint and #19/#20's `first-send` cannot disagree (parity test); `label` (own account / treasury); `self`; `lastSentAt` from `v1_known_recipients` entries that become `{address, at}` ("A stored plain string (the B1b-1 format) reads as `{address, at: null}`, so no migration step is needed"). Refused while locked. (The parity table leaves out the sending account itself: since Task 3 prepare refuses it as `self-send`.) E7 (C2): under `sessionMutex`, drop that account's prepared sends and every challenge bound to their intent digest; "Afterwards `wallet.preparedFor(account)` returns `null`, and a stale #10 tab for that intent gets `unknown-challenge`". The E2E's recipients assertion changes to the new format.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/knownRecipients.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/knownRecipients.test.ts b/extension/src/background/__tests__/knownRecipients.test.ts
--- a/extension/src/background/__tests__/knownRecipients.test.ts
+++ b/extension/src/background/__tests__/knownRecipients.test.ts
@@ -5,8 +5,8 @@ describe('known recipients', () => {
   it('starts empty, remembers an address once, and survives garbage in storage', async () => {
     const ext = fakeExt();
     expect((await knownRecipients(ext)).size).toBe(0);
-    await addKnownRecipient(ext, 'A');
-    await addKnownRecipient(ext, 'A');
+    await addKnownRecipient(ext, 'A', 1);
+    await addKnownRecipient(ext, 'A', 1);
     expect([...(await knownRecipients(ext))]).toEqual(['A']);
     await ext.local.set(KNOWN_RECIPIENTS_KEY, 'garbage');
     expect((await knownRecipients(ext)).size).toBe(0);
@@ -15,7 +15,7 @@ describe('known recipients', () => {
   it('keeps at most MAX_KNOWN_RECIPIENTS, dropping the oldest', async () => {
     const ext = fakeExt();
     await ext.local.set(KNOWN_RECIPIENTS_KEY, Array.from({length: MAX_KNOWN_RECIPIENTS}, (_, i) => `r${i}`));
-    await addKnownRecipient(ext, 'newest');
+    await addKnownRecipient(ext, 'newest', 2);
     const set = await knownRecipients(ext);
     expect(set.size).toBe(MAX_KNOWN_RECIPIENTS);
     expect(set.has('r0')).toBe(false);
```

Modify `extension/src/background/__tests__/messages.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -193,7 +193,7 @@ describe('message partitions (B1b-1 types)', () => {
   const ALL = [
     'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
-    'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
+    'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
   ];
 
   it('every privileged type is refused from a web page and from another extension', async () => {
```

Create `extension/src/background/__tests__/recipientInfo.test.ts`:

```ts
import {KNOWN_RECIPIENTS_KEY, addKnownRecipient, isKnownRecipient, lastSentAt} from '../knownRecipients';
import {handleWallet} from '../walletApi';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {PREPARED_KEY, REAUTH_KEY, setSession} from '../session';
import {discardPrepared, preparedFor, prepareSend} from '../prepare';
import {challengeInfo, issueChallenge} from '../reauthChallenges';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, SETTINGS_ABOUT, sendReader, unlocked} from './fixtures';

const OTHER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const SECOND = {index: 1, publicKey: OTHER, secretKey: ACCOUNT.secretKey};
const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}, {index: 1, name: 'Savings', publicKey: OTHER}]};

describe('known recipients: {address, at} (E6)', () => {
  it('records the confirmation time; the B1b-1 string format still reads as known, with no time', async () => {
    const ext = fakeExt();
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    expect(await lastSentAt(ext, RECIPIENT)).toBeNull();
    expect(await isKnownRecipient(ext, [], RECIPIENT)).toBe(true);
    await addKnownRecipient(ext, RECIPIENT, 1_700_000_000_000);
    expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1_700_000_000_000}]);
    expect(await lastSentAt(ext, RECIPIENT)).toBe(1_700_000_000_000);
  });
});

describe('wallet.recipientInfo (E6)', () => {
  async function setup() {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    await setSession(ext, [ACCOUNT, SECOND]);
    return ext;
  }
  const ask = (ext: ReturnType<typeof fakeExt>, recipient: unknown, account: unknown = ACCOUNT.publicKey) =>
    handleWallet(ext, fakeDeps(), 'wallet.recipientInfo', {account, recipient});

  it('an own account: known, labelled with its index and name', async () => {
    expect(await ask(await setup(), OTHER)).toEqual({ok: true, data: {known: true, lastSentAt: null, label: {kind: 'own', index: 1, name: 'Savings'}, self: false}});
  });

  it('the sending account itself: self', async () => {
    expect((await ask(await setup(), ACCOUNT.publicKey)).data).toMatchObject({known: true, self: true, label: {kind: 'own', index: 0}});
  });

  it('the fee treasury is labelled, and a first send there is still unknown', async () => {
    expect((await ask(await setup(), MAINNET_FEE_TREASURY)).data).toEqual({known: false, lastSentAt: null, label: {kind: 'treasury'}, self: false});
  });

  it('a confirmed recipient: known, with the time of the last send', async () => {
    const ext = await setup();
    await addKnownRecipient(ext, RECIPIENT, 1_700_000_000_000);
    expect((await ask(ext, RECIPIENT)).data).toEqual({known: true, lastSentAt: 1_700_000_000_000, label: null, self: false});
  });

  it('an unknown address: not known, no label', async () => {
    expect((await ask(await setup(), RECIPIENT)).data).toEqual({known: false, lastSentAt: null, label: null, self: false});
  });

  it('refused while locked, and for a malformed address', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await ask(ext, RECIPIENT)).toEqual({ok: false, error: 'locked'});
    await unlocked(ext);
    expect(await ask(ext, 'nope')).toEqual({ok: false, error: 'malformed'});
    expect(await ask(ext, RECIPIENT, 'nope')).toEqual({ok: false, error: 'malformed'});
  });

  it('parity: known === !first-send, for the same intent through prepareSend', async () => {
    for (const [recipient, remember] of [[RECIPIENT, false], [RECIPIENT, true], [OTHER, false]] as const) {
      const ext = await setup();
      if (remember) await addKnownRecipient(ext, recipient, 5);
      const info = (await ask(ext, recipient)).data as {known: boolean};
      const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {token: 'SOL', recipient, amount: '1000000'});
      expect(info.known).toBe(!(view.reauth?.reasons ?? []).includes('first-send'));
    }
  });

  it('is refused from a web page', async () => {
    const ext = await setup();
    const web = {id: ext.runtimeId, origin: 'https://evil.example', url: 'https://evil.example/'};
    expect(await handleMessage(ext, {type: 'wallet.recipientInfo', account: ACCOUNT.publicKey, recipient: RECIPIENT}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
  });
});

describe('wallet.discardPrepared (E7)', () => {
  const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};

  it('drops this account’s prepared sends and the send challenge bound to them; keeps a settings challenge and another account’s', async () => {
    const ext = fakeExt();
    await setSession(ext, [ACCOUNT, SECOND]);
    const deps = fakeDeps({reader: sendReader({getBalance: async () => 10_000_000_000n})});
    const mine = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    const settings = await issueChallenge(ext, deps, 'settings-digest', SETTINGS_ABOUT);
    const theirs = await issueChallenge(ext, deps, 'their-send-digest', {...SETTINGS_ABOUT});
    expect(await handleWallet(ext, deps, 'wallet.discardPrepared', {account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
    // A stale #10 tab for that intent now finds nothing: unknown-challenge, which #10 shows as "expired".
    expect(await challengeInfo(ext, deps.now(), mine.reauth!.challengeId)).toBeNull();
    expect(await challengeInfo(ext, deps.now(), settings)).not.toBeNull();
    expect(await challengeInfo(ext, deps.now(), theirs)).not.toBeNull();
    // A later Send of the discarded id finds nothing.
    expect(await handleWallet(ext, deps, 'wallet.send', {id: mine.id})).toEqual({ok: false, error: 'unknown-prepared'});
  });

  it('leaves another account’s prepared send alone, and is idempotent', async () => {
    const ext = fakeExt();
    await setSession(ext, [ACCOUNT, SECOND]);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const deps = fakeDeps({reader: sendReader()});
    await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    await discardPrepared(ext, OTHER);
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).not.toBeNull();
    await discardPrepared(ext, ACCOUNT.publicKey);
    await discardPrepared(ext, ACCOUNT.publicKey);
    expect(await ext.session.get(PREPARED_KEY)).toEqual([]);
  });

  it('writes nothing when there is nothing to drop (a lock leaves the area empty)', async () => {
    const ext = fakeExt();
    await discardPrepared(ext, ACCOUNT.publicKey);
    expect(await ext.session.get(PREPARED_KEY)).toBeUndefined();
    expect(await ext.session.get(REAUTH_KEY)).toBeUndefined();
  });

  it('refuses a malformed account, and a web page', async () => {
    const ext = fakeExt();
    expect(await handleWallet(ext, fakeDeps(), 'wallet.discardPrepared', {account: 'nope'})).toEqual({ok: false, error: 'malformed'});
    const web = {id: ext.runtimeId, origin: 'https://evil.example', url: 'https://evil.example/'};
    expect(await handleMessage(ext, {type: 'wallet.discardPrepared', account: ACCOUNT.publicKey}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/background/__tests__/recipientInfo.test.ts src/background/__tests__/knownRecipients.test.ts src/background/__tests__/messages.test.ts`
Expected: FAIL — `recipientInfo.test.ts` (13 tests: `isKnownRecipient`/`lastSentAt`/`discardPrepared` missing), `knownRecipients.test.ts` (3-argument `addKnownRecipient`), the exhaustive type list.

- [ ] **Step 3: Implement.**

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -146,7 +146,8 @@ test('create a wallet, unlock it, re-authenticate a first send, send SOL: pendin
     expect((await pendingRecord(popup, signature))?.state).toBe('pending');
     await expect.poll(() => pendingState(popup, signature), {timeout: 30_000, intervals: [1_000]}).toBe('confirmed');
     expect(fake.broadcasts).toEqual([signature]);
-    expect(await sw.evaluate(() => chrome.storage.local.get('v1_known_recipients'))).toEqual({v1_known_recipients: [RECIPIENT]});
+    // E6: a confirmed recipient is stored with the time of the confirmation.
+    expect(await sw.evaluate(() => chrome.storage.local.get('v1_known_recipients'))).toEqual({v1_known_recipients: [{address: RECIPIENT, at: expect.any(Number)}]});
     // E2: every simulation asked for the sender's post-state.
     expect(fake.simulations.length).toBeGreaterThan(0);
     for (const s of fake.simulations) expect(s).toEqual([account]);
```

Modify `extension/src/background/knownRecipients.ts`:

```diff
diff --git a/extension/src/background/knownRecipients.ts b/extension/src/background/knownRecipients.ts
--- a/extension/src/background/knownRecipients.ts
+++ b/extension/src/background/knownRecipients.ts
@@ -3,26 +3,64 @@ import {createMutex} from './mutex';
 
 /**
  * Addresses this wallet has sent to (a send confirmed on chain), for the "first send to a new
- * address" re-authentication trigger. storage.local, written only by the background.
+ * address" re-authentication trigger. storage.local, written only by the background. Since B1b-2a
+ * (E6) each entry is `{address, at}` — `at` the confirmation time, for #12's "sent before · last N
+ * days ago". An entry stored as a plain string (the B1b-1 format) reads as `{address, at: null}`:
+ * still known, with no date, so no migration is needed.
  */
 export const KNOWN_RECIPIENTS_KEY = 'v1_known_recipients';
 export const MAX_KNOWN_RECIPIENTS = 1000;
 
+export interface KnownRecipient {
+  address: string;
+  at: number | null;
+}
+
 const serial = createMutex();
 
-async function load(ext: Ext): Promise<string[]> {
+function entryOf(x: unknown): KnownRecipient | null {
+  if (typeof x === 'string') return {address: x, at: null};
+  if (typeof x !== 'object' || x === null) return null;
+  const {address, at} = x as {address?: unknown; at?: unknown};
+  if (typeof address !== 'string') return null;
+  return {address, at: typeof at === 'number' && Number.isSafeInteger(at) && at >= 0 ? at : null};
+}
+
+async function load(ext: Ext): Promise<KnownRecipient[]> {
   const v = await ext.local.get(KNOWN_RECIPIENTS_KEY);
-  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
+  if (!Array.isArray(v)) return [];
+  const out: KnownRecipient[] = [];
+  for (const x of v as unknown[]) {
+    const e = entryOf(x);
+    if (e !== null) out.push(e);
+  }
+  return out;
 }
 
 export async function knownRecipients(ext: Ext): Promise<Set<string>> {
-  return new Set(await load(ext));
+  return new Set((await load(ext)).map(e => e.address));
+}
+
+/** When a send to this address last confirmed; null when never, or when only the B1b-1 format knows it. */
+export async function lastSentAt(ext: Ext, address: string): Promise<number | null> {
+  let at: number | null = null;
+  for (const e of await load(ext)) if (e.address === address) at = e.at;
+  return at;
+}
+
+/**
+ * The one rule for "known" (E6): one of the session's accounts, or an address a send has confirmed
+ * to. prepareSend's `first-send` reason and wallet.recipientInfo both call this, so #12's hint and
+ * #19/#20's reason cannot disagree.
+ */
+export async function isKnownRecipient(ext: Ext, session: readonly {publicKey: string}[], recipient: string): Promise<boolean> {
+  return session.some(a => a.publicKey === recipient) || (await knownRecipients(ext)).has(recipient);
 }
 
-export async function addKnownRecipient(ext: Ext, address: string): Promise<void> {
+export async function addKnownRecipient(ext: Ext, address: string, at: number): Promise<void> {
   await serial(async () => {
-    const list = (await load(ext)).filter(a => a !== address);
-    list.push(address);
+    const list = (await load(ext)).filter(e => e.address !== address);
+    list.push({address, at});
     await ext.local.set(KNOWN_RECIPIENTS_KEY, list.slice(-MAX_KNOWN_RECIPIENTS));
   });
 }
```

Modify `extension/src/background/pending.ts`:

```diff
diff --git a/extension/src/background/pending.ts b/extension/src/background/pending.ts
--- a/extension/src/background/pending.ts
+++ b/extension/src/background/pending.ts
@@ -202,7 +202,7 @@ export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
     }),
   );
   for (const r of open) {
-    if (updates.get(r.id)?.state === 'confirmed') await addKnownRecipient(ext, r.intent.recipient);
+    if (updates.get(r.id)?.state === 'confirmed') await addKnownRecipient(ext, r.intent.recipient, now);
   }
   return after.some(isOpen);
 }
```

Modify `extension/src/background/prepare.ts`:

```diff
diff --git a/extension/src/background/prepare.ts b/extension/src/background/prepare.ts
--- a/extension/src/background/prepare.ts
+++ b/extension/src/background/prepare.ts
@@ -5,10 +5,10 @@ import type {WalletDeps} from './deps';
 import {PREPARED_KEY, REAUTH_KEY, getSession, sessionMutex} from './session';
 import {inFlightFor, readPending} from './pendingStore';
 import {EXTENSION_FEE_INPUTS} from './feePolicy';
-import {knownRecipients} from './knownRecipients';
+import {isKnownRecipient} from './knownRecipients';
 import {readSettings} from './settings';
 import {sendReauthReasons, usdMicros, type SendReauthReason} from './reauthPolicy';
-import {CHALLENGE_TTL_MS, issueChallenge, rebaseChallenge, type SendAboutRefresh} from './reauthChallenges';
+import {CHALLENGE_TTL_MS, dropChallengesFor, issueChallenge, rebaseChallenge, type SendAboutRefresh} from './reauthChallenges';
 import {digestOf, randomId} from './digest';
 import {SendRefused, type SendIntent} from './sendTypes';
 import {estimatePriorityFee} from '../../../core/solana/priorityFee';
@@ -319,7 +319,7 @@ export async function prepareSend(
     token: tokenChange,
   };
 
-  const knownRecipient = session.some(a => a.publicKey === intent.recipient) || (await knownRecipients(ext)).has(intent.recipient);
+  const knownRecipient = await isKnownRecipient(ext, session, intent.recipient);
   const settings = await readSettings(ext);
   const reasons = sendReauthReasons({
     knownRecipient,
@@ -411,6 +411,22 @@ export async function preparedFor(ext: Ext, deps: Pick<WalletDeps, 'now'>, accou
   return {...viewOf(newest), intent: newest.intent, expired: now - newest.createdAt >= PREPARED_TTL_MS};
 }
 
+/**
+ * wallet.discardPrepared (E7): the user left the review (#19 back, #20 Cancel, #10 Cancel send). Every
+ * prepared send of this account goes, and every challenge bound to one of their intents — a settings
+ * challenge or another account's has another digest and stays. Afterwards preparedFor is null, and a
+ * stale #10 tab for that intent gets unknown-challenge. Nothing was signed, so nothing else changes.
+ */
+export async function discardPrepared(ext: Ext, account: string): Promise<void> {
+  await sessionMutex(async () => {
+    const all = await loadPrepared(ext);
+    const dropped = all.filter(p => p.account === account);
+    if (dropped.length === 0) return;
+    await ext.session.set(PREPARED_KEY, all.filter(p => p.account !== account));
+    await dropChallengesFor(ext, new Set(dropped.map(p => p.intentDigest)));
+  });
+}
+
 export async function peekPrepared(ext: Ext, id: string): Promise<PreparedSend | null> {
   return (await loadPrepared(ext)).find(p => p.id === id) ?? null;
 }
```

Modify `extension/src/background/reauthChallenges.ts`:

```diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -192,3 +192,15 @@ export async function consumeChallenge(ext: Ext, now: number, id: string, digest
   });
 }
 
+/** Remove every challenge bound to one of these digests (wallet.discardPrepared, E7). Under sessionMutex by the caller. */
+export async function dropChallengesFor(ext: Ext, digests: ReadonlySet<string>): Promise<void> {
+  const store = await load(ext);
+  let changed = false;
+  for (const [id, c] of store) {
+    if (digests.has(c.digest)) {
+      store.delete(id);
+      changed = true;
+    }
+  }
+  if (changed) await save(ext, store);
+}
```

Modify `extension/src/background/walletApi.ts`:

```diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -8,7 +8,9 @@ import {parsePatch, readSettings, weakens, writeSettings, type Settings} from '.
 import {cleanName, readWalletView, renameAccount} from './accountsStore';
 import {consumeChallenge, issueChallenge} from './reauthChallenges';
 import {digestOf} from './digest';
-import {isAddress, parseIntent, preparedFor, prepareSend} from './prepare';
+import {discardPrepared, isAddress, parseIntent, preparedFor, prepareSend} from './prepare';
+import {isKnownRecipient, lastSentAt} from './knownRecipients';
+import {MAINNET_FEE_TREASURY} from '../../../core/fees/transferMarkup';
 import {sendPrepared} from './send';
 import {resend, startPoller} from './pending';
 import {isOpen, readPending, viewOf} from './pendingStore';
@@ -32,6 +34,8 @@ export const WALLET_TYPES = [
   'wallet.history',
   'wallet.prices',
   'wallet.cached',
+  'wallet.recipientInfo',
+  'wallet.discardPrepared',
   'accounts.rename',
   'accounts.select',
   'settings.get',
@@ -159,6 +163,24 @@ async function prices(ext: Ext, deps: WalletDeps): Promise<Result> {
   return {ok: true, data};
 }
 
+/**
+ * wallet.recipientInfo (E6): what #12 may say about a recipient before anything is prepared. Local
+ * only — no network. Refused while locked: it reveals whom this wallet has paid. A hint: prepareSend
+ * recomputes everything that decides.
+ */
+async function recipientInfo(ext: Ext, account: unknown, recipient: unknown): Promise<Result> {
+  if (!isAddress(account) || !isAddress(recipient)) return MALFORMED;
+  const session = await getSession(ext);
+  if (session === null) return {ok: false, error: 'locked'};
+  const view = await readWalletView(ext);
+  const own = view?.accounts.find(a => a.publicKey === recipient);
+  const label = own !== undefined ? {kind: 'own' as const, index: own.index, name: own.name} : recipient === MAINNET_FEE_TREASURY ? {kind: 'treasury' as const} : null;
+  return {
+    ok: true,
+    data: {known: await isKnownRecipient(ext, session, recipient), lastSentAt: await lastSentAt(ext, recipient), label, self: recipient === account},
+  };
+}
+
 async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unknown>): Promise<Result> {
   const patch = parsePatch(msg.patch);
   if (patch === null) return MALFORMED;
@@ -252,6 +274,14 @@ export async function handleWallet(ext: Ext, deps: WalletDeps, type: WalletType,
         if (!session.some(a => a.publicKey === account)) return {ok: false, error: 'unknown-account'};
         return {ok: true, data: await prepareSend(ext, deps, account, intent, challengeId === undefined ? {} : {challengeId})};
       }
+      case 'wallet.recipientInfo':
+        return await recipientInfo(ext, msg.account, msg.recipient);
+      case 'wallet.discardPrepared': {
+        const {account} = msg;
+        if (!isAddress(account)) return MALFORMED;
+        await discardPrepared(ext, account);
+        return {ok: true};
+      }
       case 'wallet.preparedFor': {
         const {account} = msg;
         if (!isAddress(account)) return MALFORMED;
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/background/__tests__/recipientInfo.test.ts src/background/__tests__/knownRecipients.test.ts src/background/__tests__/messages.test.ts`
Expected: PASS — 3 files, 43 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 59 files, 753 tests.

- [ ] **Step 6: The existing E2E still passes** (the fake coordinator and `wallet.spec.ts` changed).

Run: `npm run build && npx playwright test e2e/wallet.spec.ts e2e/unlock.spec.ts`
Expected: `3 passed`. (The dry run ran it inside `unshare -rn`; both specs are contained either way.)

- [ ] **Step 7: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **keep the challenges:** in `discardPrepared`, delete the line `await dropChallengesFor(ext, new Set(dropped.map(p => p.intentDigest)));`. Run `npx vitest run src/background/__tests__/recipientInfo.test.ts` → RED: 1 failed (the stale-#10 assertion).
  - **break parity:** in `isKnownRecipient`, replace the body with `return (await knownRecipients(ext)).has(recipient);`. Run `npx vitest run src/background/__tests__/recipientInfo.test.ts` → RED: 2 failed (own account, parity).

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/e2e/wallet.spec.ts extension/src/background/__tests__/knownRecipients.test.ts extension/src/background/__tests__/messages.test.ts extension/src/background/__tests__/recipientInfo.test.ts extension/src/background/knownRecipients.ts extension/src/background/pending.ts extension/src/background/prepare.ts extension/src/background/reauthChallenges.ts extension/src/background/walletApi.ts
git commit -m "feat(extension): wallet.recipientInfo and wallet.discardPrepared (B1b-2a E6, E7)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 6: Why a send failed: `failure` on pending records (E8)

**Files:**
- Modify: `extension/src/background/pending.ts`
- Modify: `extension/src/background/pendingStore.ts`
- Test (modify): `extension/src/background/__tests__/fixtures.ts`
- Test (create): `extension/src/background/__tests__/pendingFailure.test.ts`

**Interfaces:**
- Consumes: B1b-1's `pendingStore.ts`, `pending.ts`.
- Produces:
  `pendingStore.ts`: `type PendingFailure = 'landed' | 'not-sent'`; `PendingRecord.failure: PendingFailure | null`; `PendingView` carries it.

Spec §2 E8 (C3): `PendingRecord`/`PendingView` gain `failure: 'landed' | 'not-sent' | null`, "set where the engine writes each `failed`": `deliver()`'s first attempt refused by the route (`BroadcastRejected`) or by the cool-down (`RpcCoolingDown`) → `not-sent`; **both** poller writers of a final status with `err` → `landed`; every other state `null`. "`isRecord` reads a missing field as `null` (B1b-1 records)". `detail` stays exactly what B1b-1 writes. #44 (plan 3) keys on this, never on `detail`.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/fixtures.ts`:

```diff
diff --git a/extension/src/background/__tests__/fixtures.ts b/extension/src/background/__tests__/fixtures.ts
--- a/extension/src/background/__tests__/fixtures.ts
+++ b/extension/src/background/__tests__/fixtures.ts
@@ -107,6 +107,7 @@ export const pendingRecord = (over: Partial<PendingRecord> = {}): PendingRecord
   detail: null,
   intent: {token: 'SOL', recipient: 'R', amount: '1'},
   expiryNullSeenAt: null,
+  failure: null,
   ...over,
 });
 
```

Create `extension/src/background/__tests__/pendingFailure.test.ts`:

```ts
import {NOT_CONFIRMED, pollOnce, submitSigned} from '../pending';
import {PENDING_KEY, readPending, viewOf} from '../pendingStore';
import type {WalletDeps} from '../deps';
import {BroadcastRejected, firstSignature} from '../../../../core/solana/broadcast';
import {RpcCoolingDown, type SignatureStatus} from '../../../../core/solana/rpc';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire, unlocked} from './fixtures';

// Spec B1b-2a E8: every place the engine writes `failed` says why — #44 keys on `failure`, never on
// the free-text `detail`, which stays exactly what B1b-1 wrote.
const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1'};
const landedWithErr: SignatureStatus = {err: {InstructionError: [0, 'x']}, confirmationStatus: 'finalized'};
const EXPIRED_HEIGHT = 1033;

async function submitted(broadcast?: WalletDeps['broadcast']) {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = fakeDeps({broadcast: broadcast ?? (async wire => firstSignature(wire))});
  const view = await submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT});
  return {ext, deps, view};
}

describe('PendingRecord.failure (E8)', () => {
  it('first broadcast refused by the route (400 with a contract reason): not-sent, detail unchanged', async () => {
    const {view} = await submitted(async () => {
      throw new BroadcastRejected('rejected', 'Blockhash not found');
    });
    expect(view).toMatchObject({state: 'failed', failure: 'not-sent', detail: 'The network refused this transaction (rejected: Blockhash not found). No funds moved.'});
  });

  it('first broadcast refused by the cool-down before sending: not-sent, detail unchanged', async () => {
    const {view} = await submitted(async () => {
      throw new RpcCoolingDown('broadcast');
    });
    expect(view).toMatchObject({state: 'failed', failure: 'not-sent', detail: 'Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds moved.'});
  });

  it('the poller’s regular status check finds it landed with an error: landed', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({getSignatureStatuses: async () => [landedWithErr], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'failed', failure: 'landed', detail: 'Landed but failed ({"InstructionError":[0,"x"]}): the network fee was paid, nothing was sent.'});
  });

  it('the full-history check past lastValidBlockHeight + 32 finds it landed with an error: landed', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({
      getSignatureStatuses: async (sigs, history) => (history === true ? [landedWithErr] : sigs.map(() => null)),
      getBlockHeight: async () => EXPIRED_HEIGHT,
    });
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'failed', failure: 'landed'});
  });

  it('every other state carries null: pending, confirmed, expired', async () => {
    const {ext, deps, view} = await submitted();
    expect(view.failure).toBeNull();
    deps.reader = fakeReader({getSignatureStatuses: async sigs => sigs.map(() => null), getBlockHeight: async () => EXPIRED_HEIGHT});
    await pollOnce(ext, deps);
    deps.clock.t += 2_000;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'expired', detail: NOT_CONFIRMED, failure: null});
    const ok = await submitted();
    ok.deps.reader = fakeReader({getSignatureStatuses: async () => [{err: null, confirmationStatus: 'confirmed'}], getBlockHeight: async () => 900});
    await pollOnce(ok.ext, ok.deps);
    expect((await readPending(ok.ext))[0]).toMatchObject({state: 'confirmed', failure: null});
  });

  it('a record from before E8 (no failure field) reads as null; any other value drops it', async () => {
    const ext = fakeExt();
    const {failure: _dropped, ...old} = pendingRecord({state: 'failed'});
    await ext.local.set(PENDING_KEY, [old, {...old, id: 'r2', failure: 'exploded'}]);
    const read = await readPending(ext);
    expect(read.map(r => [r.id, r.failure])).toEqual([['r1', null]]);
    expect(viewOf(read[0]!).failure).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/background/__tests__/pendingFailure.test.ts`
Expected: FAIL — the four writers (`expected { …(10) } to match object { state: 'failed', … failure: 'not-sent' … }`) and the old-format test.

- [ ] **Step 3: Implement.**

Modify `extension/src/background/pending.ts`:

```diff
diff --git a/extension/src/background/pending.ts b/extension/src/background/pending.ts
--- a/extension/src/background/pending.ts
+++ b/extension/src/background/pending.ts
@@ -24,7 +24,7 @@ export const NOT_CONFIRMED = 'Not confirmed — no funds moved.';
 export const PENDING_ALARM = 'pending-poll';
 export const PENDING_ALARM_MINUTES = 0.5;
 
-type Update = Partial<Pick<PendingRecord, 'state' | 'detail' | 'expiryNullSeenAt'>>;
+type Update = Partial<Pick<PendingRecord, 'state' | 'detail' | 'expiryNullSeenAt' | 'failure'>>;
 
 async function patch(ext: Ext, id: string, change: (r: PendingRecord) => PendingRecord): Promise<void> {
   await updatePending(ext, records => records.map(r => (r.id === id && isOpen(r) ? change(r) : r)));
@@ -47,9 +47,9 @@ async function deliver(ext: Ext, deps: WalletDeps, record: PendingRecord, attemp
     await patch(ext, record.id, r => ({...r, detail: null}));
   } catch (e) {
     if (attempt === 'first' && e instanceof BroadcastRejected) {
-      await patch(ext, record.id, r => ({...r, state: 'failed', detail: `The network refused this transaction (${e.reason}: ${e.detail}). No funds moved.`}));
+      await patch(ext, record.id, r => ({...r, state: 'failed', failure: 'not-sent', detail: `The network refused this transaction (${e.reason}: ${e.detail}). No funds moved.`}));
     } else if (attempt === 'first' && e instanceof RpcCoolingDown) {
-      await patch(ext, record.id, r => ({...r, state: 'failed', detail: 'Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds moved.'}));
+      await patch(ext, record.id, r => ({...r, state: 'failed', failure: 'not-sent', detail: 'Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds moved.'}));
     } else if (e instanceof RpcCoolingDown) {
       await patch(ext, record.id, r => ({...r, detail: 'Not sent again: cooling down after an earlier HTTP 403; still watching the first copy.'}));
     } else if (e instanceof RpcForbidden) {
@@ -80,6 +80,7 @@ export async function submitSigned(
     detail: null,
     intent: input.intent,
     expiryNullSeenAt: null,
+    failure: null,
   };
   const guard = {refused: false};
   await updatePending(ext, records => {
@@ -172,7 +173,7 @@ export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
     if (verdict === 'confirmed') {
       updates.set(r.id, {state: 'confirmed', detail: null});
     } else if (verdict === 'failed') {
-      updates.set(r.id, {state: 'failed', detail: failedDetail(s?.err)});
+      updates.set(r.id, {state: 'failed', failure: 'landed', detail: failedDetail(s?.err)});
     } else if (height !== null && height > r.lastValidBlockHeight + EXPIRY_MARGIN_BLOCKS) {
       // Past the blockhash's life, with margin, so this transaction can no longer land — but it may
       // have landed before. Ask with the full status history, and say "no funds moved" only after
@@ -185,7 +186,7 @@ export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
       }
       const final = landed(last);
       if (final === 'confirmed') updates.set(r.id, {state: 'confirmed', detail: null});
-      else if (final === 'failed') updates.set(r.id, {state: 'failed', detail: failedDetail(last?.err)});
+      else if (final === 'failed') updates.set(r.id, {state: 'failed', failure: 'landed', detail: failedDetail(last?.err)});
       // Only a literal null in both answers is a null round; any status seen (processed, with or
       // without err) means the network knows the transaction: restart the count, keep watching.
       else if (last !== null || s !== null) updates.set(r.id, {expiryNullSeenAt: null});
```

Modify `extension/src/background/pendingStore.ts`:

```diff
diff --git a/extension/src/background/pendingStore.ts b/extension/src/background/pendingStore.ts
--- a/extension/src/background/pendingStore.ts
+++ b/extension/src/background/pendingStore.ts
@@ -10,6 +10,13 @@ import type {SendIntent} from './sendTypes';
 export const PENDING_KEY = 'v1_pending';
 
 export type PendingState = 'pending' | 'stuck' | 'confirmed' | 'failed' | 'expired';
+/**
+ * Why a `failed` record failed (spec B1b-2a E8), set where the engine writes each `failed`: `landed`
+ * — on chain with an error, the network fee was paid; `not-sent` — refused before anything reached the
+ * network. Null in every other state (and on a record from before E8). #44 chooses its state from
+ * this, never from `detail`.
+ */
+export type PendingFailure = 'landed' | 'not-sent';
 
 /** A signed send, from before its broadcast until confirmed, failed or expired (spec §4 "No double spend"). */
 export interface PendingRecord {
@@ -26,6 +33,7 @@ export interface PendingRecord {
   intent: SendIntent;
   /** When a full-history status check past expiry first came back null; `expired` needs a second one ≥ 2 s later. */
   expiryNullSeenAt: number | null;
+  failure: PendingFailure | null;
 }
 
 /** What leaves the background: everything but the signed bytes. */
@@ -40,8 +48,8 @@ const serial = createMutex();
 const STATES: readonly string[] = ['pending', 'stuck', 'confirmed', 'failed', 'expired'];
 const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
 
-/** A stored element is a claim: only an exact record shape is read; anything else is dropped. */
-function isRecord(x: unknown): x is PendingRecord {
+/** A stored element is a claim: only an exact record shape is read; anything else is dropped. `failure` is checked by recordOf. */
+function isRecord(x: unknown): x is Omit<PendingRecord, 'failure'> & {failure?: unknown} {
   if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
   const r = x as Record<string, unknown>;
   const i = r.intent as Record<string, unknown> | null;
@@ -65,9 +73,23 @@ function isRecord(x: unknown): x is PendingRecord {
   );
 }
 
+/** A record from before E8 has no `failure`: it reads as null, so no migration is needed. Any other value drops the record. */
+function recordOf(x: unknown): PendingRecord | null {
+  if (!isRecord(x)) return null;
+  const f = x.failure;
+  if (f === undefined || f === null) return {...x, failure: null};
+  return f === 'landed' || f === 'not-sent' ? {...x, failure: f} : null;
+}
+
 export async function readPending(ext: Ext): Promise<PendingRecord[]> {
   const v = await ext.local.get(PENDING_KEY);
-  return Array.isArray(v) ? (v as unknown[]).filter(isRecord) : [];
+  if (!Array.isArray(v)) return [];
+  const out: PendingRecord[] = [];
+  for (const x of v as unknown[]) {
+    const r = recordOf(x);
+    if (r !== null) out.push(r);
+  }
+  return out;
 }
 
 export function inFlightFor(records: readonly PendingRecord[], account: string): PendingRecord | undefined {
@@ -86,6 +108,7 @@ export function viewOf(r: PendingRecord): PendingView {
     detail: r.detail,
     intent: r.intent,
     expiryNullSeenAt: r.expiryNullSeenAt,
+    failure: r.failure,
   };
 }
 
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/background/__tests__/pendingFailure.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 60 files, 759 tests.

- [ ] **Step 6: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **swap the first-attempt values:** in `deliver()`, change the `BroadcastRejected` branch's `failure: 'not-sent'` to `failure: 'landed'`. Run `npx vitest run src/background/__tests__/pendingFailure.test.ts` → RED: 1 failed.

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/background/__tests__/fixtures.ts extension/src/background/__tests__/pendingFailure.test.ts extension/src/background/pending.ts extension/src/background/pendingStore.ts
git commit -m "feat(extension): pending records say why they failed (B1b-2a E8)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 7: `vault.forgetWallet` — the engine half of delete-wallet (E5: C4, C6, H1, R2-M1, D40) — and `vault.setKeys` bound to the stored envelope

**Files:**
- Modify: `extension/src/background/accountsStore.ts`
- Modify: `extension/src/background/messages.ts`
- Modify: `extension/src/background/pending.ts`
- Test (create): `extension/src/background/__tests__/forgetWallet.test.ts`
- Test (modify): `extension/src/background/__tests__/messages.test.ts`
- Test (modify): `extension/src/background/__tests__/pending.test.ts`
- Test (create): `extension/src/background/__tests__/setKeysBinding.test.ts`

**Interfaces:**
- Consumes: Task 2's `clearCaches`; B1b-1's `serial`, `envelopeShape`, `envelopeRevision`, `lock`, `updatePending`, `readWalletBalances`, `startPoller`.
- Produces:
  - `accountsStore.ts`: `type ForgetResult = 'forgotten' | 'malformed' | 'stored-invalid' | 'no-wallet' | 'busy' | 'unlocked' | 'send-open' | 'funded' | 'unreachable' | 'coordinator-refused'`; `forgetWallet(ext, deps, {expectedRevision, replacement?, guard?}): Promise<ForgetResult>`
  - message `{type: 'vault.forgetWallet', expectedRevision, replacement?, guard?: 'unfunded'}` → `{ok: true}` or the refusal (`failed` on a thrown storage error); `forbidden` from anywhere but `/unlock.html`
  - `vault.setKeys`: new refusal `unknown-account` (keys the stored envelope does not record)
  - `pending.ts` `pollOnce`: known recipients only for accounts of the stored envelope

Spec §2 E5. Vault page only. Refusals, one vocabulary: `malformed` (anything the caller sent, including a replacement whose C4 binding fails: "`replacement.scheme` must equal the stored scheme, and its `{index, publicKey}` set must equal the stored one exactly"), `stored-invalid`, `no-wallet`, `busy` (the revision moved), `unlocked` (an unlock landed during the forget — its own code, review L4 ruling), `send-open`, `funded` / `unreachable` / `coordinator-refused` (only with `guard: 'unfunded'`, C6: "reads the balances of **every account in the stored envelope** … Any non-zero → `funded` … Any read failure → `unreachable`, and a 403 → `coordinator-refused`"), `failed` (a storage failure; the vault stays). **One critical section** — the `accountsStore` `serial` mutex every `v1_vault` write takes: 1 read + revision + bind; 2 the guard (nothing changed yet, not locked); 3 `lock()`; 4 check-and-clear `v1_pending` in **one** `updatePending` (H1: an open record throws inside the change function, nothing is written); 5 re-read the revision and, under `sessionMutex` together with the write, confirm no unlock landed (Scope item 4); 6 the vault write (removed, or the replacement with every stored name) — **the commit point**; 7 a delete removes `v1_known_recipients` and `v1_settings` (D40), both paths remove the caches, inside a `try/catch` that only logs (review M2: a failed cleanup never un-forgets; the next first write clears leftovers); `v1_forbidden_until` always stays. `guard` together with `replacement` is `malformed`. A first write (`vault.storeEnvelope(null, …)`) now removes leftover recipients, settings **and both caches** first (L1). After `forgotten`, the message handler restarts the poller if a late open record exists (so `accountsStore` does not import `pending.ts`). Two more rules from review: **H1** — `vault.setKeys` now binds to the stored envelope: every `{index, publicKey}` handed over must be one `v1_vault` records, else `unknown-account` and no session is written. Every vault-page flow already stores before it hands over keys — onboarding and D41's retry (`storeEnvelope(null, …)` then `setKeys`), #39's restore (`forgetWallet` with the same-key replacement, then `setKeys`), add account (`storeEnvelope` then `setKeys`), unlock (the envelope exists) — so none is affected; `messages.test.ts`'s own setKeys tests now start from a stored envelope. **M1** — the poller adds a known recipient only for an account of the envelope stored **now**, so a send that outlived a delete cannot make its recipient "known" to the next wallet. The vault page's two proofs (seed, factor) are plan 2's #39/#40.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/__tests__/forgetWallet.test.ts`:

```ts
import {base64} from '@scure/base';
import {VAULT_KEY, forgetWallet, storeEnvelope} from '../accountsStore';
import {handleMessage} from '../messages';
import {SESSION_KEY, getSession, setSession} from '../session';
import {PENDING_KEY, readPending, updatePending} from '../pendingStore';
import {pollOnce} from '../pending';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {SETTINGS_KEY} from '../settings';
import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../balanceCache';
import {FORBIDDEN_UNTIL_KEY} from '../deps';
import {AUTOLOCK_ALARM} from '../autolock';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {RequestUnreachable, RpcForbidden, type SolanaReader} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, pendingRecord} from './fixtures';

// Spec B1b-2a E5: the engine half of delete-wallet. The proof ran in the vault page; the background
// binds a replacement to the same wallet (C4), guards a delete against funds (C6), and does it all in
// one serial section (H1, R2-M1).
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const from = (path: string) => ({id: ID, origin: ORIGIN, url: `${ORIGIN}${path}`});
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: K1},
  ],
};
const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
/** The same wallet under a new password: new salt, wrap and ciphertext; the same keys; names the page copied. */
const REPLACEMENT = {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}};
const zero = () => fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});

async function setup(reader: SolanaReader = zero()) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, STORED);
  await setSession(ext, [ACCOUNT]);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
  await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
  await ext.local.set(BALANCE_CACHE_KEY, {});
  await ext.local.set(PRICE_CACHE_KEY, {});
  await ext.local.set(FORBIDDEN_UNTIL_KEY, 123);
  const deps = fakeDeps({reader});
  return {ext, deps};
}
const vault = (ext: ReturnType<typeof fakeExt>) => ext.local.get(VAULT_KEY);

describe('vault.forgetWallet — who may ask', () => {
  it('only the vault page: refused from the popup, the tab and a web page', async () => {
    const {ext, deps} = await setup();
    const msg = {type: 'vault.forgetWallet', expectedRevision: REV};
    for (const sender of [from('/popup.html'), from('/wallet.html'), {id: ID, origin: 'https://evil.example', url: 'https://evil.example/unlock.html'}]) {
      expect(await handleMessage(ext, msg, sender, deps)).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await vault(ext)).toEqual(STORED);
    expect(await handleMessage(ext, msg, from('/unlock.html'), deps)).toEqual({ok: true});
    expect(await vault(ext)).toBeUndefined();
  });

  it('malformed requests change nothing', async () => {
    const {ext, deps} = await setup();
    for (const req of [
      {expectedRevision: 'x'},
      {expectedRevision: REV, guard: 'funded'},
      {expectedRevision: REV, guard: 'unfunded', replacement: REPLACEMENT},
      {expectedRevision: REV, replacement: {...REPLACEMENT, v: 2}},
    ]) {
      expect(await forgetWallet(ext, deps, req)).toBe('malformed');
    }
    expect(await vault(ext)).toEqual(STORED);
    expect(await getSession(ext)).not.toBeNull();
  });
});

describe('vault.forgetWallet — the stored wallet', () => {
  it('no-wallet, stored-invalid, busy on a stale revision — nothing changed, not locked', async () => {
    const ext = fakeExt();
    expect(await forgetWallet(ext, fakeDeps(), {expectedRevision: REV})).toBe('no-wallet');
    await ext.local.set(VAULT_KEY, {...STORED, seed: 'damaged'});
    expect(await forgetWallet(ext, fakeDeps(), {expectedRevision: REV})).toBe('stored-invalid');
    const s = await setup();
    expect(await forgetWallet(s.ext, s.deps, {expectedRevision: 'f'.repeat(64)})).toBe('busy');
    expect(await vault(s.ext)).toEqual(STORED);
    expect(await getSession(s.ext)).not.toBeNull();
  });
});

describe('vault.forgetWallet — a delete (no replacement)', () => {
  it('locks, removes the vault, the known recipients, the settings and both caches; keeps the 403 cool-down', async () => {
    const {ext, deps} = await setup();
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await vault(ext)).toBeUndefined();
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
    for (const key of [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) expect(await ext.local.get(key)).toBeUndefined();
    expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
  });

  it('removes closed pending records', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(PENDING_KEY, [pendingRecord({state: 'confirmed'}), pendingRecord({id: 'r2', state: 'expired'})]);
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await readPending(ext)).toEqual([]);
  });
});

describe('vault.forgetWallet — a restore (replacement, C4, D40)', () => {
  it('replaces the envelope, keeps every stored name, the known recipients and the settings; removes the caches', async () => {
    const {ext, deps} = await setup();
    const renamedByPage = {...REPLACEMENT, accounts: REPLACEMENT.accounts.map(a => ({...a, name: 'x'}))};
    expect(await forgetWallet(ext, deps, {expectedRevision: REV, replacement: renamedByPage})).toBe('forgotten');
    expect(await vault(ext)).toEqual(REPLACEMENT);
    expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1}]);
    expect(await ext.local.get(SETTINGS_KEY)).toEqual({autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
    expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
    expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
    expect(await getSession(ext)).toBeNull();
  });

  it('C4: another scheme, an extra account, a missing account or one changed key is malformed — nothing changed', async () => {
    const {ext, deps} = await setup();
    const [a0, a1] = REPLACEMENT.accounts as [(typeof REPLACEMENT.accounts)[0], (typeof REPLACEMENT.accounts)[0]];
    for (const replacement of [
      {...REPLACEMENT, scheme: 'cli', accounts: [a0]},
      {...REPLACEMENT, accounts: [a0, a1, {index: 2, name: 'Extra', publicKey: RECIPIENT}]},
      {...REPLACEMENT, accounts: [a0]},
      {...REPLACEMENT, accounts: [a0, {...a1, publicKey: RECIPIENT}]},
    ]) {
      expect(await forgetWallet(ext, deps, {expectedRevision: REV, replacement})).toBe('malformed');
    }
    expect(await vault(ext)).toEqual(STORED);
    expect(await getSession(ext)).not.toBeNull();
  });
});

describe('vault.forgetWallet — a send still open refuses (H1)', () => {
  it('send-open for a pending and for a stuck record — locked, otherwise unchanged; allowed once closed', async () => {
    for (const state of ['pending', 'stuck'] as const) {
      const {ext, deps} = await setup();
      await ext.local.set(PENDING_KEY, [pendingRecord({state})]);
      expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('send-open');
      expect(await vault(ext)).toEqual(STORED);
      expect(await getSession(ext)).toBeNull();
      expect((await readPending(ext)).map(r => r.state)).toEqual([state]);
      await ext.local.set(PENDING_KEY, [pendingRecord({state: 'expired'})]);
      expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    }
  });

  it('a send written by a send that passed its session check before the lock, landing DURING the pending check, is never deleted', async () => {
    const {ext, deps} = await setup();
    const get = ext.local.get.bind(ext.local);
    let injected: Promise<unknown> | undefined;
    ext.local.get = async key => {
      const v = await get(key);
      // The first pending read after the lock: submitSigned appends its record now, through the store's
      // mutex, and this read gives it a moment to land. Atomic (the real step 4): the append waits for the
      // clear and lands after it. A check-then-remove would let it land in between and delete it.
      if (key === PENDING_KEY && injected === undefined && (await getSession(ext)) === null) {
        injected = updatePending(ext, rs => [...rs, pendingRecord({id: 'late', account: ACCOUNT.publicKey})]);
        await Promise.race([injected, new Promise(resolve => setTimeout(resolve, 50))]);
      }
      return v;
    };
    const r = await forgetWallet(ext, deps, {expectedRevision: REV});
    await injected;
    expect(r).toBe('forgotten');
    expect((await readPending(ext)).map(x => x.id)).toEqual(['late']);
    // It confirms later: its recipient must not become "known" to whatever wallet comes next (review M1).
    deps.reader = fakeReader({getSignatureStatuses: async () => [{err: null, confirmationStatus: 'confirmed'}], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
    expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
  });
});

describe('vault.forgetWallet — one serial section (R2-M1)', () => {
  it('an envelope write landing after the lock makes it busy, and the vault holds that write untouched', async () => {
    const {ext, deps} = await setup();
    const clear = ext.session.clear.bind(ext.session);
    const OTHER = {...STORED, seed: {iv: B(12, 5), ct: B(48, 6)}};
    ext.session.clear = async () => {
      await clear();
      await ext.local.set(VAULT_KEY, OTHER); // a writer outside the section (an older page, a bug)
    };
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('busy');
    expect(await vault(ext)).toEqual(OTHER);
  });

  it('an unlock landing after the lock is refused as unlocked (review L4), and the vault is byte-identical', async () => {
    const {ext, deps} = await setup();
    const clear = ext.session.clear.bind(ext.session);
    ext.session.clear = async () => {
      await clear();
      void setSession(ext, [ACCOUNT]); // vault.setKeys does not take serial
    };
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('unlocked');
    expect(JSON.stringify(await vault(ext))).toBe(JSON.stringify(STORED));
  });

  it('a storeEnvelope issued mid-forget waits for it (the same mutex), then finds no wallet', async () => {
    const {ext, deps} = await setup();
    const clear = ext.session.clear.bind(ext.session);
    let store: Promise<unknown> | undefined;
    ext.session.clear = async () => {
      await clear();
      store = storeEnvelope(ext, REV, {...STORED, seed: {iv: B(12, 5), ct: B(48, 6)}});
    };
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await store).toBe('no-wallet');
    expect(await vault(ext)).toBeUndefined();
  });

  it('the vault write is the commit point: a failed cleanup after it still answers forgotten (review M2)', async () => {
    const {ext, deps} = await setup();
    const remove = ext.local.remove.bind(ext.local);
    ext.local.remove = async key => {
      if (key === SETTINGS_KEY) throw new Error('quota');
      return remove(key);
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await vault(ext)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a storage failure before the vault write leaves the vault in place', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(PENDING_KEY, []);
    const set = ext.local.set.bind(ext.local);
    ext.local.set = async (key, value) => {
      if (key === PENDING_KEY) throw new Error('quota');
      return set(key, value);
    };
    expect(await handleMessage(ext, {type: 'vault.forgetWallet', expectedRevision: REV}, from('/unlock.html'), deps)).toEqual({ok: false, error: 'failed'});
    expect(await vault(ext)).toEqual(STORED);
  });
});

describe('vault.forgetWallet — the unfunded guard (C6)', () => {
  const NOC = WALLET_TOKENS.NOC.mint as string;
  const USDC = WALLET_TOKENS.USDC.mint as string;
  const USDT = WALLET_TOKENS.USDT.mint as string;
  const holding = (mint: string) => async (owner: string) => (owner === K1 ? [{pubkey: 'a', mint, owner, amount: 1n, decimals: 6}] : []);

  it('reads every account; any of the four tokens anywhere is funded — nothing changed, not locked', async () => {
    const readers = [
      fakeReader({getBalance: async owner => (owner === K1 ? 1n : 0n), getTokenAccountsByOwner: async () => []}),
      fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: holding(NOC)}),
      fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: holding(USDC)}),
      fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: holding(USDT)}),
    ];
    for (const reader of readers) {
      const {ext, deps} = await setup(reader);
      expect(await forgetWallet(ext, deps, {expectedRevision: REV, guard: 'unfunded'})).toBe('funded');
      expect(await vault(ext)).toEqual(STORED);
      expect(await getSession(ext)).not.toBeNull();
    }
  });

  it('funds arriving after #40 rendered empty are caught at the moment of deletion', async () => {
    let credited = false;
    const reader = fakeReader({getBalance: async owner => (credited && owner === ACCOUNT.publicKey ? 5n : 0n), getTokenAccountsByOwner: async () => []});
    const {ext, deps} = await setup(reader);
    credited = true;
    expect(await forgetWallet(ext, deps, {expectedRevision: REV, guard: 'unfunded'})).toBe('funded');
  });

  it('a failed read is unreachable, a 403 coordinator-refused — fail closed, nothing changed', async () => {
    for (const [e, code] of [[new RequestUnreachable('u', 'x'), 'unreachable'], [new Error('boom'), 'unreachable'], [new RpcForbidden('getBalance'), 'coordinator-refused']] as const) {
      const reader = fakeReader({
        getBalance: async () => {
          throw e;
        },
        getTokenAccountsByOwner: async () => [],
      });
      const {ext, deps} = await setup(reader);
      expect(await forgetWallet(ext, deps, {expectedRevision: REV, guard: 'unfunded'})).toBe(code);
      expect(await vault(ext)).toEqual(STORED);
      expect(await getSession(ext)).not.toBeNull();
    }
  });

  it('all zero: deleted', async () => {
    const {ext, deps} = await setup();
    expect(await forgetWallet(ext, deps, {expectedRevision: REV, guard: 'unfunded'})).toBe('forgotten');
    expect(await vault(ext)).toBeUndefined();
  });
});

describe('a first write clears what a crashed delete left behind', () => {
  it('vault.storeEnvelope with expectedRevision null removes leftover known recipients, settings and caches (L1)', async () => {
    const ext = fakeExt();
    await ext.local.set(BALANCE_CACHE_KEY, {});
    await ext.local.set(PRICE_CACHE_KEY, {});
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 60, reauthUsdCents: 100000, selectedAccount: 0});
    expect(await storeEnvelope(ext, null, STORED)).toBe('stored');
    expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
    expect(await ext.local.get(SETTINGS_KEY)).toBeUndefined();
    expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });
});
```

Modify `extension/src/background/__tests__/messages.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -4,7 +4,7 @@ import {base58, base64} from '@scure/base';
 import {PRIVILEGED, handleMessage} from '../messages';
 import {getSession} from '../session';
 import {AUTOLOCK_ALARM, DEFAULT_AUTOLOCK_MINUTES} from '../autolock';
-import {fakeExt} from './fakeExt';
+import {fakeExt, memKV} from './fakeExt';
 import {issueChallenge} from '../reauthChallenges';
 import {fakeDeps} from './fakeDeps';
 import {envelopeRevision} from '../../shared/envelopeRevision';
@@ -23,87 +23,93 @@ const ACC = [{index: 0, publicKey: base58.encode(PUB), secretKey: SECRET64}];
 // 64 × 0x01 is 64 bytes but not a keypair: its "public half" is not what its seed derives.
 const ONES64 = base64.encode(new Uint8Array(64).fill(1));
 const UNRELATED = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
+/** A fake extension whose stored envelope records ACC's key: vault.setKeys binds to it (review H1). */
+function vaultExt() {
+  const ext = fakeExt();
+  (ext.local as ReturnType<typeof memKV>).data.set('v1_vault', {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: base58.encode(PUB)}]});
+  return ext;
+}
 
 describe('message partitions', () => {
   it('accepts vault.setKeys from the vault page (positive control)', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage)).toEqual({ok: true});
     expect(await getSession(ext)).toEqual(ACC);
   });
 
   it('refuses vault.setKeys from the popup — only the vault page may', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, popup)).toEqual({ok: false, error: 'forbidden'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses every privileged type from a web page', async () => {
     for (const type of ['vault.setKeys', 'vault.lock', 'vault.status', 'activity.ping']) {
-      const ext = fakeExt();
+      const ext = vaultExt();
       expect(await handleMessage(ext, {type, accounts: ACC}, page)).toEqual({ok: false, error: 'forbidden'});
     }
   });
 
   it('refuses a page that claims the extension origin in its url but not in sender.origin', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const spoof = {...page, url: `${ORIGIN}/unlock.html`};
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, spoof)).toEqual({ok: false, error: 'forbidden'});
   });
 
   it('refuses a vault page sender (own id+origin) whose url claims another origin — negative control on pagePath', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const spoofedPath = {id: ID, origin: ORIGIN, url: 'https://evil.example/unlock.html', tab: {}, frameId: 0};
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, spoofedPath)).toEqual({ok: false, error: 'forbidden'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses a message from another extension', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     expect(await handleMessage(ext, {type: 'vault.status'}, {...popup, id: 'someotherextensionidxxxxxxxxxxxx'})).toEqual({ok: false, error: 'forbidden'});
   });
 
   it('refuses unknown types and malformed messages', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     expect(await handleMessage(ext, {type: 'vault.export'}, popup)).toEqual({ok: false, error: 'unknown type'});
     expect(await handleMessage(ext, 'hello', popup)).toEqual({ok: false, error: 'malformed'});
   });
 
   it('refuses malformed accounts in vault.setKeys, and never writes a session for them', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: [{index: 0}]}, unlockPage)).toEqual({ok: false, error: 'malformed'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses a negative index', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const bad = [{index: -1, publicKey: ACC[0]?.publicKey, secretKey: SECRET64}];
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses a secretKey that does not decode to 64 bytes', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const bad = [{index: 0, publicKey: ACC[0]?.publicKey, secretKey: 'AAAA'}];
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses 64 × 0x01 with an unrelated address — 64 bytes is not a keypair', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const bad = [{index: 0, publicKey: UNRELATED, secretKey: ONES64}];
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses a real keypair sent under another address', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const bad = [{index: 0, publicKey: UNRELATED, secretKey: SECRET64}];
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses a secretKey whose embedded public key matches the address but whose seed does not derive it', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const otherSeed = new Uint8Array(32).fill(2);
     const bad = [{index: 0, publicKey: ACC[0]?.publicKey, secretKey: base64.encode(new Uint8Array([...otherSeed, ...PUB]))}];
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
@@ -111,28 +117,28 @@ describe('message partitions', () => {
   });
 
   it('refuses a secretKey whose seed derives the address but whose embedded public half is something else', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const bad = [{index: 0, publicKey: ACC[0]?.publicKey, secretKey: base64.encode(new Uint8Array([...SEED, ...new Uint8Array(32).fill(9)]))}];
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses a publicKey that is not base58', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const bad = [{index: 0, publicKey: '0OIl', secretKey: SECRET64}];
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('refuses an empty publicKey', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const bad = [{index: 0, publicKey: '', secretKey: SECRET64}];
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('vault.status reports locked/unlocked without keys', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     expect(await handleMessage(ext, {type: 'vault.status'}, popup)).toEqual({ok: true, data: {unlocked: false, accounts: []}});
     await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
     const r = await handleMessage(ext, {type: 'vault.status'}, popup);
@@ -141,27 +147,27 @@ describe('message partitions', () => {
   });
 
   it('vault.lock clears the session', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
     await handleMessage(ext, {type: 'vault.lock'}, popup);
     expect(await getSession(ext)).toBeNull();
   });
 
   it('vault.setKeys from an own-origin sender whose url does not parse is forbidden', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const badUrl = {id: ID, origin: ORIGIN, url: 'not a url', tab: {}, frameId: 0};
     expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, badUrl)).toEqual({ok: false, error: 'forbidden'});
     expect(await getSession(ext)).toBeNull();
   });
 
   it('a successful vault.setKeys arms the auto-lock alarm at the default', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
     expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(DEFAULT_AUTOLOCK_MINUTES);
   });
 
   it('vault.setKeys leaves no session behind when arming the auto-lock alarm fails (no fail-open)', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     ext.alarms.create = async () => {
       throw new Error('alarms.create rejected');
     };
@@ -171,14 +177,14 @@ describe('message partitions', () => {
   });
 
   it('activity.ping while locked leaves no alarm armed', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     expect(await getSession(ext)).toBeNull();
     await handleMessage(ext, {type: 'activity.ping'}, popup);
     expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
   });
 
   it('activity.ping while unlocked re-arms using the current settings', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
     expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(DEFAULT_AUTOLOCK_MINUTES);
     await ext.local.set('v1_settings', {autoLockMinutes: 20});
@@ -191,7 +197,7 @@ describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
   // 'unknown type' here, which fails, rather than silently shrinking the test.
   const ALL = [
-    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'activity.ping',
+    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
   ];
@@ -205,13 +211,13 @@ describe('message partitions (B1b-1 types)', () => {
       {...unlockPage, id: otherId},
     ];
     for (const type of ALL) {
-      expect(await handleMessage(fakeExt(), {type}, page, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
-      for (const sender of others) expect(await handleMessage(fakeExt(), {type}, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
+      expect(await handleMessage(vaultExt(), {type}, page, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
+      for (const sender of others) expect(await handleMessage(vaultExt(), {type}, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
     }
   });
 
   it('vault.reauthOk only from the vault page, only while unlocked, only for a live challenge', async () => {
-    const ext = fakeExt();
+    const ext = vaultExt();
     const deps = fakeDeps();
     await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
     const challengeId = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
```

Modify `extension/src/background/__tests__/pending.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/pending.test.ts b/extension/src/background/__tests__/pending.test.ts
--- a/extension/src/background/__tests__/pending.test.ts
+++ b/extension/src/background/__tests__/pending.test.ts
@@ -6,6 +6,7 @@ import {
 import {PENDING_KEY, readPending, type PendingRecord} from '../pendingStore';
 import {knownRecipients} from '../knownRecipients';
 import {lock} from '../autolock';
+import {VAULT_KEY} from '../accountsStore';
 import type {WalletDeps} from '../deps';
 import {BroadcastRejected, BroadcastSubstituted, BroadcastUnavailable, firstSignature} from '../../../../core/solana/broadcast';
 import {RpcCoolingDown, RpcForbidden} from '../../../../core/solana/rpc';
@@ -257,6 +258,8 @@ describe('pollOnce', () => {
 
   it('confirmed: the state, and the recipient becomes known', async () => {
     const {ext, deps} = await submitted();
+    // The recipient becomes known only for an account of the stored wallet (review M1).
+    await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT.publicKey}]});
     deps.reader = fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900});
     expect(await pollOnce(ext, deps)).toBe(false);
     expect((await readPending(ext))[0]?.state).toBe('confirmed');
```

Create `extension/src/background/__tests__/setKeysBinding.test.ts`:

```ts
import {base58, base64} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {SESSION_KEY} from '../session';
import {fakeExt} from './fakeExt';

// Review H1: vault.setKeys binds to the stored envelope — keys of no stored wallet never reach the session.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};
const key = (fill: number, index: number) => {
  const seed = new Uint8Array(32).fill(fill);
  const pub = ed25519.getPublicKey(seed);
  return {index, publicKey: base58.encode(pub), secretKey: base64.encode(new Uint8Array([...seed, ...pub]))};
};
const A0 = key(1, 0);
const A1 = key(2, 1);
const envelopeOf = (...accounts: {index: number; publicKey: string}[]) => ({v: 1, scheme: 'slip10', accounts: accounts.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}))});
const setKeys = (ext: ReturnType<typeof fakeExt>, accounts: unknown) => handleMessage(ext, {type: 'vault.setKeys', accounts}, unlockPage);

describe('vault.setKeys binds to the stored envelope (review H1)', () => {
  it('accepts the stored wallet’s keys, all or some of them (positive control)', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, envelopeOf(A0, A1));
    expect(await setKeys(ext, [A0, A1])).toEqual({ok: true});
    expect(await setKeys(ext, [A1])).toEqual({ok: true});
  });

  it('refuses a key the envelope does not record, and writes no session', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, envelopeOf(A0));
    expect(await setKeys(ext, [A0, A1])).toEqual({ok: false, error: 'unknown-account'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });

  it('refuses a stored key under another index', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, envelopeOf(A0));
    expect(await setKeys(ext, [{...A0, index: 3}])).toEqual({ok: false, error: 'unknown-account'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });

  it('refuses any keys while no wallet is stored', async () => {
    const ext = fakeExt();
    expect(await setKeys(ext, [A0])).toEqual({ok: false, error: 'unknown-account'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/background/__tests__/forgetWallet.test.ts src/background/__tests__/messages.test.ts src/background/__tests__/setKeysBinding.test.ts src/background/__tests__/pending.test.ts`
Expected: FAIL — `forgetWallet.test.ts` (`forgetWallet is not a function`), `setKeysBinding.test.ts` (keys of no stored wallet accepted), `pending.test.ts`'s M1 case, the exhaustive type list.

- [ ] **Step 3: Implement.**

Modify `extension/src/background/accountsStore.ts`:

```diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -1,7 +1,16 @@
 import type {Ext} from '../ext';
+import type {WalletDeps} from './deps';
 import {createMutex} from './mutex';
+import {lock} from './autolock';
+import {getSession, sessionMutex} from './session';
+import {isOpen, updatePending} from './pendingStore';
+import {KNOWN_RECIPIENTS_KEY} from './knownRecipients';
+import {SETTINGS_KEY} from './settings';
+import {clearCaches} from './balanceCache';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
+import {readWalletBalances} from '../../../core/solana/balances';
+import {RpcForbidden} from '../../../core/solana/rpc';
 
 export {MAX_ACCOUNTS, MAX_NAME_LENGTH, cleanName} from '../shared/envelopeRules';
 
@@ -202,7 +211,139 @@ export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelop
       if (name === null) return 'malformed';
       accounts.push({...a, name});
     }
+    // A first write: recipients and settings left behind cannot belong to a wallet that does not exist
+    // yet (a crash between vault.forgetWallet's vault write and its cleanup could leave them). E5.
+    if (first) {
+      await ext.local.remove(KNOWN_RECIPIENTS_KEY);
+      await ext.local.remove(SETTINGS_KEY);
+      // …and the caches of a wallet that no longer exists (review L1).
+      await clearCaches(ext);
+    }
     await ext.local.set(VAULT_KEY, {...next, accounts});
     return 'stored';
   });
 }
+
+export type ForgetResult =
+  | 'forgotten'
+  | 'malformed'
+  | 'stored-invalid'
+  | 'no-wallet'
+  | 'busy'
+  | 'unlocked'
+  | 'send-open'
+  | 'funded'
+  | 'unreachable'
+  | 'coordinator-refused';
+
+class SendOpen extends Error {
+  constructor() {
+    super('a send is still open');
+    this.name = 'SendOpen';
+  }
+}
+
+/** C4: a replacement re-encrypts the same wallet — same scheme, exactly the same {index, publicKey} set. */
+function sameKeys(current: StoredEnvelope, next: StoredEnvelope): boolean {
+  if (next.scheme !== current.scheme || next.accounts.length !== current.accounts.length) return false;
+  const keys = new Map(current.accounts.map(a => [a.index, a.publicKey]));
+  return next.accounts.every(a => keys.get(a.index) === a.publicKey);
+}
+
+/** C6: does any account of the stored envelope hold any of the four tokens right now? Throws on a failed read. */
+async function anyFunded(deps: Pick<WalletDeps, 'reader'>, env: StoredEnvelope): Promise<boolean> {
+  for (const a of env.accounts) {
+    const b = await readWalletBalances(deps.reader, a.publicKey);
+    if (b.sol > 0n || b.noc > 0n || b.usdc > 0n || b.usdt > 0n) return true;
+  }
+  return false;
+}
+
+/**
+ * vault.forgetWallet (spec B1b-2a E5): the engine half of delete-wallet, after the vault page proved
+ * the wallet (its seed, or a factor). `replacement` re-encrypts the SAME wallet under a new password
+ * (#39's restore, bound in the background: C4); without it the wallet is deleted (#40's "Try a
+ * different seed", with `guard: 'unfunded'`: C6). One `serial` section, the mutex every v1_vault
+ * write takes, so no envelope write interleaves (R2-M1):
+ *  1. read and shape-check the stored envelope, compare the revision, bind the replacement;
+ *  2. with the guard, read every account's balances — nothing changed yet;
+ *  3. lock: from here no new send can pass its session check;
+ *  4. check-and-clear v1_pending in ONE updatePending (the mutex submitSigned writes under): an open
+ *     record refuses, and nothing is written (H1);
+ *  5. re-read the envelope's revision (`busy` if it moved), and — under sessionMutex, with the write
+ *     inside it — confirm no unlock landed since step 3 (`unlocked` if one did, review L4);
+ *  6. the vault write: removed, or replaced;
+ *  7. the rest: a delete removes the known recipients and the settings (D40); both remove the caches.
+ *     The vault write is the commit point: a failure here is logged and the answer stays 'forgotten'
+ *     (the next first write clears any leftovers; review M2).
+ * v1_forbidden_until is always kept (it belongs to the network). A record appended after step 4 by a
+ * send that passed its session check before step 3 is kept, never deleted; the message handler
+ * restarts the poller for it. `guard` and `replacement` together are malformed (review L4).
+ */
+export async function forgetWallet(
+  ext: Ext,
+  deps: WalletDeps,
+  req: {expectedRevision: unknown; replacement?: unknown; guard?: unknown},
+): Promise<ForgetResult> {
+  const {expectedRevision, replacement, guard} = req;
+  if (!isStr(expectedRevision) || !REVISION.test(expectedRevision)) return 'malformed';
+  if (guard !== undefined && guard !== 'unfunded') return 'malformed';
+  if (guard !== undefined && replacement !== undefined) return 'malformed';
+  const next = replacement === undefined ? null : envelopeShape(replacement);
+  if (replacement !== undefined && next === null) return 'malformed';
+  return serial(async (): Promise<ForgetResult> => {
+    // 1.
+    const stored = await ext.local.get(VAULT_KEY);
+    if (!isObj(stored)) return 'no-wallet';
+    const current = envelopeShape(stored);
+    if (current === null) return 'stored-invalid';
+    if (envelopeRevision(current) !== expectedRevision) return 'busy';
+    if (next !== null && !sameKeys(current, next)) return 'malformed';
+    // 2.
+    if (guard === 'unfunded') {
+      try {
+        if (await anyFunded(deps, current)) return 'funded';
+      } catch (e) {
+        return e instanceof RpcForbidden ? 'coordinator-refused' : 'unreachable';
+      }
+    }
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
+    // 5 + 6.
+    const again = envelopeShape(await ext.local.get(VAULT_KEY));
+    if (again === null || envelopeRevision(again) !== expectedRevision) return 'busy';
+    const written = await sessionMutex(async () => {
+      if ((await getSession(ext)) !== null) return false;
+      if (next === null) {
+        await ext.local.remove(VAULT_KEY);
+      } else {
+        // Same keys (C4), so every stored name carries over (R2-L3).
+        const names = new Map(current.accounts.map(a => [a.index, a.name]));
+        await ext.local.set(VAULT_KEY, {...next, accounts: next.accounts.map(a => ({...a, name: names.get(a.index) ?? a.name}))});
+      }
+      return true;
+    });
+    if (!written) return 'unlocked';
+    // 7. After the commit point: best effort, never un-forgotten.
+    try {
+      if (next === null) {
+        await ext.local.remove(KNOWN_RECIPIENTS_KEY);
+        await ext.local.remove(SETTINGS_KEY);
+      }
+      await clearCaches(ext);
+    } catch (e) {
+      console.warn('forgetWallet: cleanup after the vault write failed; the next first write clears it', e);
+    }
+    return 'forgotten';
+  });
+}
```

Modify `extension/src/background/messages.ts`:

```diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -6,7 +6,9 @@ import {getSession, setSession} from './session';
 import {armAutolock, lock} from './autolock';
 import type {WalletDeps} from './deps';
 import {challengeInfo, satisfyChallenge} from './reauthChallenges';
-import {storeEnvelope} from './accountsStore';
+import {forgetWallet, readWalletView, storeEnvelope} from './accountsStore';
+import {isOpen, readPending} from './pendingStore';
+import {startPoller} from './pending';
 import {WALLET_TYPES, handleWallet, isWalletType, type Result} from './walletApi';
 
 /** What the browser reports about a message's origin (runtime.MessageSender). */
@@ -24,13 +26,14 @@ export interface Sender {
  * sets — never the URL the message claims, and never "has a tab", which a full-tab
  * extension page also has.
  */
-export const PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'activity.ping', ...WALLET_TYPES] as const;
+export const PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'activity.ping', ...WALLET_TYPES] as const;
 /**
  * Only the vault page itself may hand over keys, report a re-authentication it proved, hand over
  * the envelope it re-encrypted (the background is the one writer of v1_vault), or read what a
- * re-authentication is for (vault.challengeInfo, B1b-2a E3: the popup and the tab cannot).
+ * re-authentication is for (vault.challengeInfo, B1b-2a E3), or forget the wallet it proved
+ * (vault.forgetWallet, E5): the popup and the tab cannot.
  */
-const VAULT_PAGE_ONLY: readonly string[] = ['vault.setKeys', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo'];
+const VAULT_PAGE_ONLY: readonly string[] = ['vault.setKeys', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet'];
 export const PAGE: readonly string[] = [];
 
 function isOwnPage(ext: Ext, s: Sender): boolean {
@@ -103,6 +106,14 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
     case 'vault.setKeys': {
       const accounts = (msg as {accounts?: unknown}).accounts;
       if (!validAccounts(accounts)) return {ok: false, error: 'malformed'};
+      // The keys must be the stored wallet's (B1b-2a review H1): every {index, publicKey} handed over is
+      // one the envelope records. Every vault-page flow stores the envelope before it hands over keys
+      // (onboarding and D41's retry: storeEnvelope then setKeys; #39's restore: forgetWallet with the
+      // same-key replacement, then setKeys; add account: storeEnvelope then setKeys; unlock: the
+      // envelope exists), so this refuses only keys of no stored wallet.
+      const view = await readWalletView(ext);
+      const stored = new Map((view?.accounts ?? []).map(a => [a.index, a.publicKey]));
+      if (!accounts.every(a => stored.get(a.index) === a.publicKey)) return {ok: false, error: 'unknown-account'};
       // Fail closed: keys in storage.session with no alarm armed would never auto-lock, while
       // the vault page reports "Unlock failed". Anything that throws after the write undoes it.
       try {
@@ -140,6 +151,21 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       const about = await challengeInfo(ext, deps.now(), challengeId);
       return about === null ? {ok: false, error: 'unknown-challenge'} : {ok: true, data: about};
     }
+    case 'vault.forgetWallet': {
+      if (deps === undefined) return {ok: false, error: 'unavailable'};
+      const {expectedRevision, replacement, guard} = msg as {expectedRevision?: unknown; replacement?: unknown; guard?: unknown};
+      try {
+        const r = await forgetWallet(ext, deps, {expectedRevision, replacement, guard});
+        if (r !== 'forgotten') return {ok: false, error: r};
+        // A send that passed its session check before the lock may have appended a record after the
+        // clear: it is kept, and watched without keys.
+        if ((await readPending(ext)).some(isOpen)) void startPoller(ext, deps);
+        return {ok: true};
+      } catch {
+        // A storage failure: the steps before the vault write leave the wallet in place (locked at most).
+        return {ok: false, error: 'failed'};
+      }
+    }
     case 'vault.storeEnvelope': {
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
       const r = await storeEnvelope(ext, expectedRevision, envelope);
```

Modify `extension/src/background/pending.ts`:

```diff
diff --git a/extension/src/background/pending.ts b/extension/src/background/pending.ts
--- a/extension/src/background/pending.ts
+++ b/extension/src/background/pending.ts
@@ -2,6 +2,7 @@ import {base64} from '@scure/base';
 import type {Ext} from '../ext';
 import type {WalletDeps} from './deps';
 import {addKnownRecipient} from './knownRecipients';
+import {readWalletView} from './accountsStore';
 import {randomId} from './digest';
 import {inFlightFor, isOpen, readPending, updatePending, viewOf, type PendingRecord, type PendingView} from './pendingStore';
 import {ResendRefused, SendRefused, SentUnconfirmed, type ResendRefusal, type SendIntent} from './sendTypes';
@@ -202,8 +203,12 @@ export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
       return u !== undefined && isOpen(r) ? {...r, ...u} : r;
     }),
   );
-  for (const r of open) {
-    if (updates.get(r.id)?.state === 'confirmed') await addKnownRecipient(ext, r.intent.recipient, now);
+  const confirmed = open.filter(r => updates.get(r.id)?.state === 'confirmed');
+  if (confirmed.length > 0) {
+    // Only for an account of the wallet stored now (review M1): a send that outlived a delete must not
+    // make its recipient "known" to the next wallet.
+    const own = new Set((await readWalletView(ext))?.accounts.map(a => a.publicKey) ?? []);
+    for (const r of confirmed) if (own.has(r.account)) await addKnownRecipient(ext, r.intent.recipient, now);
   }
   return after.some(isOpen);
 }
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/background/__tests__/forgetWallet.test.ts src/background/__tests__/messages.test.ts src/background/__tests__/setKeysBinding.test.ts src/background/__tests__/pending.test.ts`
Expected: PASS — 4 files, 86 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 62 files, 782 tests.

- [ ] **Step 6: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **check-then-remove (H1):** replace the `await updatePending(ext, records => { … });` block of step 4 with `if ((await readPending(ext)).some(isOpen)) throw new SendOpen();` + `await ext.local.remove('v1_pending');`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 2 failed — the late record is deleted ("… landing DURING the pending check, is never deleted") and the storage-failure test.
  - **drop the key-set comparison (C4):** in `sameKeys`, replace the last line with `return keys.size >= 0;`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 1 failed.
  - **drop the guard's read (C6):** replace `if (await anyFunded(deps, current)) return 'funded';` with `void anyFunded;`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 3 failed (incl. "funds arriving after #40 rendered empty").
  - **no session re-check (R2-M1):** delete `if ((await getSession(ext)) !== null) return false;` inside the step-5 `sessionMutex` call. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 1 failed.
  - **no binding in setKeys (H1):** in `messages.ts`, delete `if (!accounts.every(a => stored.get(a.index) === a.publicKey)) return {ok: false, error: 'unknown-account'};`. Run `npx vitest run src/background/__tests__/setKeysBinding.test.ts` → RED: 3 failed.
  - **any account's recipient (M1):** in `pending.ts`, replace `if (own.has(r.account))` with `if (own.size >= 0)`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 1 failed.
  - **cleanup failure un-forgets (M2):** replace the step-7 `catch (e) { console.warn(…); }` with `finally { void 0; }`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 1 failed.
  - **no cache cleanup on a first write (L1):** delete `await clearCaches(ext);` under `if (first) {`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 1 failed.
  - **an unlock is just busy (L4):** replace `if (!written) return 'unlocked';` with `if (!written) return 'busy';`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 1 failed.
  - **no revision re-check (R2-M1):** replace `if (again === null || envelopeRevision(again) !== expectedRevision) return 'busy';` with `void again;`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 1 failed.
  - **no first-write cleanup:** in `storeEnvelope`, delete the two `ext.local.remove` lines under `if (first) {`. Run `npx vitest run src/background/__tests__/forgetWallet.test.ts` → RED: 1 failed.

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/background/__tests__/forgetWallet.test.ts extension/src/background/__tests__/messages.test.ts extension/src/background/__tests__/pending.test.ts extension/src/background/__tests__/setKeysBinding.test.ts extension/src/background/accountsStore.ts extension/src/background/messages.ts extension/src/background/pending.ts
git commit -m "feat(extension): vault.forgetWallet — one serial section, bound replacement, unfunded guard (B1b-2a E5)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 8: `runtime.onInstalled` → the minimal `welcome` vault mode

**Files:**
- Modify: `extension/src/background/index.ts`
- Modify: `extension/src/unlock/mode.ts`
- Modify: `extension/src/unlock/modes.ts`
- Modify: `extension/unlock.html`
- Test (modify): `extension/src/background/__tests__/start.test.ts`
- Test (modify): `extension/src/unlock/__tests__/mode.test.ts`

**Interfaces:**
- Consumes: B1b-1's `pageMode`, `startMode`, `SECTIONS`.
- Produces:
  `PageMode` gains `{mode: 'welcome'}`; `unlock.html` gains `<section id="welcome">` with `#welcome-create` and `#welcome-import`.

Spec §1.1: "one `runtime.onInstalled` listener (reason `install` → `tabs.create({url: 'unlock.html?mode=welcome'})`; `tabs.create` needs no permission)". Spec §12 (review R2-M5): "`?mode=welcome` shows the B1b-1 thin page's look with the two existing actions, "Create a wallet" → `?mode=create` and "Import a wallet" → `?mode=import`, fixed strings only. The popup's no-wallet path and `onInstalled` both open it, so nothing in plan 1 points at a mode that does not exist. Plan 2 replaces it with #1." The two actions are plain links: no script, no string set at run time.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/start.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/start.test.ts b/extension/src/background/__tests__/start.test.ts
--- a/extension/src/background/__tests__/start.test.ts
+++ b/extension/src/background/__tests__/start.test.ts
@@ -12,14 +12,15 @@ describe('background start', () => {
     const on = (name: string) => ({addListener: () => void listeners.push(name)});
     const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
     vi.stubGlobal('chrome', {
-      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onStartup: on('onStartup')},
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onStartup: on('onStartup'), onInstalled: on('onInstalled')},
+      tabs: {create: async () => undefined},
       storage: {session: {...area(), setAccessLevel: async (o: unknown) => void accessLevels.push(o)}, local: area()},
       alarms: {create: () => undefined, clear: async () => true, onAlarm: on('onAlarm')},
       windows: {getAll: async () => [], onRemoved: on('onRemoved')},
     });
     await import('../index');
     expect(accessLevels).toEqual([{accessLevel: 'TRUSTED_CONTEXTS'}]);
-    expect(listeners.sort()).toEqual(['onAlarm', 'onMessage', 'onRemoved', 'onStartup']);
+    expect(listeners.sort()).toEqual(['onAlarm', 'onInstalled', 'onMessage', 'onRemoved', 'onStartup']);
   });
 
   // Fable re-review: pinSessionAccess() was fired with `void`, not awaited or caught — a
@@ -33,7 +34,8 @@ describe('background start', () => {
     const warnings: unknown[] = [];
     vi.spyOn(console, 'warn').mockImplementation((...args) => void warnings.push(args));
     vi.stubGlobal('chrome', {
-      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onStartup: on('onStartup')},
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onStartup: on('onStartup'), onInstalled: on('onInstalled')},
+      tabs: {create: async () => undefined},
       storage: {
         session: {
           ...area(),
@@ -50,7 +52,7 @@ describe('background start', () => {
     // Let the rejected pinSessionAccess() promise's .catch handler run.
     await Promise.resolve();
     await Promise.resolve();
-    expect(listeners.sort()).toEqual(['onAlarm', 'onMessage', 'onRemoved', 'onStartup']);
+    expect(listeners.sort()).toEqual(['onAlarm', 'onInstalled', 'onMessage', 'onRemoved', 'onStartup']);
     expect(warnings).toEqual([['storage.session access level not pinned', expect.any(Error)]]);
   });
 
@@ -83,7 +85,8 @@ describe('background start', () => {
       });
       const on = () => ({addListener: () => undefined});
       vi.stubGlobal('chrome', {
-        runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onStartup: on()},
+        runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onStartup: on(), onInstalled: on()},
+        tabs: {create: async () => undefined},
         storage: {
           session: {get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined, setAccessLevel: async () => undefined},
           local: {
@@ -128,7 +131,8 @@ describe('background start', () => {
     const on = () => ({addListener: () => undefined});
     const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
     vi.stubGlobal('chrome', {
-      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onStartup: on()},
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onStartup: on(), onInstalled: on()},
+        tabs: {create: async () => undefined},
       storage: {session: {...area(), setAccessLevel: async () => undefined}, local: area()},
       alarms: {create: (name: string) => void created.push(name), clear: async () => true, onAlarm: on()},
       windows: {getAll: async () => [], onRemoved: on()},
@@ -139,4 +143,31 @@ describe('background start', () => {
     await Promise.resolve();
     expect(created).toEqual([]);
   });
+
+  // B1b-2a §1.1: a fresh install opens the welcome page once — not on an update, not on a browser update.
+  it('opens unlock.html?mode=welcome on install only', async () => {
+    let installed: ((d: {reason: string}) => void) | undefined;
+    const opened: string[] = [];
+    const on = () => ({addListener: () => undefined});
+    const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
+    vi.stubGlobal('chrome', {
+      runtime: {
+        id: 'x',
+        getURL: (p: string) => `https://ext.example/${p}`,
+        onMessage: on(),
+        onStartup: on(),
+        onInstalled: {addListener: (cb: (d: {reason: string}) => void) => void (installed = cb)},
+      },
+      tabs: {create: async (o: {url: string}) => void opened.push(o.url)},
+      storage: {session: area(), local: area()},
+      alarms: {create: () => undefined, clear: async () => true, onAlarm: on()},
+      windows: {getAll: async () => [], onRemoved: on()},
+    });
+    await import('../index');
+    installed?.({reason: 'update'});
+    installed?.({reason: 'chrome_update'});
+    expect(opened).toEqual([]);
+    installed?.({reason: 'install'});
+    expect(opened).toEqual(['https://ext.example/unlock.html?mode=welcome']);
+  });
 });
```

Modify `extension/src/unlock/__tests__/mode.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/mode.test.ts b/extension/src/unlock/__tests__/mode.test.ts
--- a/extension/src/unlock/__tests__/mode.test.ts
+++ b/extension/src/unlock/__tests__/mode.test.ts
@@ -4,6 +4,7 @@ describe('pageMode', () => {
   const id = 'ab'.repeat(16);
   it('reads the mode from the query string; anything unknown is the unlock page', () => {
     expect(pageMode('')).toEqual({mode: 'unlock'});
+    expect(pageMode('?mode=welcome')).toEqual({mode: 'welcome'});
     expect(pageMode('?mode=create')).toEqual({mode: 'create'});
     expect(pageMode('?mode=import')).toEqual({mode: 'import'});
     expect(pageMode('?mode=accounts')).toEqual({mode: 'accounts'});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/background/__tests__/start.test.ts src/unlock/__tests__/mode.test.ts`
Expected: FAIL — the three `start.test.ts` listener lists (`onInstalled` missing), `opens unlock.html?mode=welcome on install only`, and `pageMode('?mode=welcome')`.

- [ ] **Step 3: Implement.**

Modify `extension/src/background/index.ts`:

```diff
diff --git a/extension/src/background/index.ts b/extension/src/background/index.ts
--- a/extension/src/background/index.ts
+++ b/extension/src/background/index.ts
@@ -7,9 +7,12 @@ import {PENDING_ALARM, armPendingAlarm, onPendingAlarm, startPoller} from './pen
 
 interface BgApi {
   runtime: {
+    getURL(path: string): string;
     onMessage: {addListener(cb: (m: unknown, s: Sender, reply: (r: unknown) => void) => boolean): void};
     onStartup: {addListener(cb: () => void): void};
+    onInstalled: {addListener(cb: (details: {reason: string}) => void): void};
   };
+  tabs: {create(o: {url: string}): Promise<unknown> | void};
   alarms: {onAlarm: {addListener(cb: (a: {name: string}) => void): void}};
   windows: {onRemoved: {addListener(cb: () => void): void}};
 }
@@ -38,6 +41,12 @@ api.windows.onRemoved.addListener(() => {
 api.runtime.onStartup.addListener(() => {
   void lock(ext);
 });
+// B1b-2a §1.1: a fresh install opens the welcome page (the vault page's `welcome` mode) once. An
+// update or a browser update opens nothing. tabs.create needs no permission.
+api.runtime.onInstalled.addListener(details => {
+  if (details.reason !== 'install') return;
+  void Promise.resolve(api.tabs.create({url: api.runtime.getURL('unlock.html?mode=welcome')})).catch(e => console.warn('welcome tab not opened', e));
+});
 
 // A service worker stopped while a send was open restarts here: resume watching it.
 void readPending(ext).then(
```

Modify `extension/src/unlock/mode.ts`:

```diff
diff --git a/extension/src/unlock/mode.ts b/extension/src/unlock/mode.ts
--- a/extension/src/unlock/mode.ts
+++ b/extension/src/unlock/mode.ts
@@ -1,10 +1,10 @@
-export type PageMode = {mode: 'unlock'} | {mode: 'create'} | {mode: 'import'} | {mode: 'accounts'} | {mode: 'reveal'} | {mode: 'reauth'; challengeId: string};
+export type PageMode = {mode: 'unlock'} | {mode: 'welcome'} | {mode: 'create'} | {mode: 'import'} | {mode: 'accounts'} | {mode: 'reveal'} | {mode: 'reauth'; challengeId: string};
 
 /** unlock.html?mode=…; anything unknown or malformed is the plain unlock page. */
 export function pageMode(search: string): PageMode {
   const p = new URLSearchParams(search);
   const m = p.get('mode');
-  if (m === 'create' || m === 'import' || m === 'accounts' || m === 'reveal') return {mode: m};
+  if (m === 'welcome' || m === 'create' || m === 'import' || m === 'accounts' || m === 'reveal') return {mode: m};
   if (m === 'reauth') {
     const id = p.get('challenge') ?? '';
     return /^[0-9a-f]{32}$/.test(id) ? {mode: 'reauth', challengeId: id} : {mode: 'unlock'};
```

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -67,7 +67,8 @@ const REVEAL_WORDS: Record<RevealOutcome['outcome'], string> = {
 };
 const WAIT = 'That did not confirm it. Wait a moment before trying again.';
 const UNREADABLE = "This wallet's stored data could not be read. Reload this page.";
-const SECTIONS = ['unlock-section', 'create', 'import', 'reauth', 'accounts', 'reveal'] as const;
+// `welcome` (B1b-2a plan 1, minimal): two links to create and import, fixed strings in unlock.html. Plan 2 replaces it with #1.
+const SECTIONS = ['unlock-section', 'welcome', 'create', 'import', 'reauth', 'accounts', 'reveal'] as const;
 
 const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
 const say = (text: string): void => {
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -15,6 +15,11 @@
         </form>
         <button id="passkey" type="button" hidden>Unlock with passkey</button>
       </section>
+      <section id="welcome" hidden>
+        <h1>Noctura</h1>
+        <p><a id="welcome-create" href="unlock.html?mode=create">Create a wallet</a></p>
+        <p><a id="welcome-import" href="unlock.html?mode=import">Import a wallet</a></p>
+      </section>
       <section id="create" hidden>
         <h1>Create a wallet</h1>
         <p>Write these 24 words down, in order. They are the only way to recover this wallet.</p>
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/background/__tests__/start.test.ts src/unlock/__tests__/mode.test.ts`
Expected: PASS — 2 files, 7 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 62 files, 783 tests.

- [ ] **Step 6: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **open on any reason:** in `index.ts`, delete `if (details.reason !== 'install') return;`. Run `npx vitest run src/background/__tests__/start.test.ts` → RED: 1 failed.

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/background/__tests__/start.test.ts extension/src/background/index.ts extension/src/unlock/__tests__/mode.test.ts extension/src/unlock/mode.ts extension/src/unlock/modes.ts extension/unlock.html
git commit -m "feat(extension): open the welcome page on install; the minimal welcome mode (B1b-2a §1.1, §12)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 9: The source gates: the vault page's import allowlist, stand-alone modules, `.tsx`, the TGE date

**Files:**
- Modify: `extension/package.json`
- Create: `extension/scripts/check-no-tge-date.mjs`
- Modify: `extension/scripts/check-rpc-methods.mjs`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Test (create): `extension/scripts/__tests__/check-no-tge-date.test.mjs`
- Test (modify): `extension/scripts/__tests__/check-rpc-methods.test.mjs`
- Test (modify): `extension/scripts/__tests__/check-vault-isolation.test.mjs`

**Interfaces:**
- Consumes: B1b-1's `moduleReferences`, `resolveSource`, `sourceViolations`, `reachable`.
- Produces:
  - `check-vault-isolation.mjs`: `STANDALONE`, `VAULT_PAGE_ENTRY`, `VAULT_PAGE_PACKAGES`, `vaultPageViolations(read, exists, entry?)`; the main run adds it
  - `check-rpc-methods.mjs`: `EXTENSIONS` includes `.tsx` and `/index.tsx`
  - `check-no-tge-date.mjs`: `forbiddenForms()`, `dateViolations(files, forms?)`, `listScanned(root)`; `npm run gates` runs it

Spec §1.2: "Every file reachable from `src/unlock/main.ts` must be one of: `src/unlock/**`, `src/vault/**`, `src/shared/**`, `src/ui/send.ts`, `src/styles/*.css`, `../web/src/styles/design-system.css`, `../core/keys/**`, `../core/util/**`, or a package in `{@noble/curves, @noble/hashes, @scure/base, @scure/bip39, micro-key-producer}`." The walk follows relative imports (into `../core` and `../web`), a worker's `new URL(…)`, and not type-only imports. M4: "`src/shared/amount.ts` and `src/unlock/strings.ts` join the `readLocal` rule's pattern: they may import nothing at all" — and any `src/shared` file importing `src/app` or `../web` is a violation outright. `check-rpc-methods.mjs` follows `.tsx` (the screens) into `../web/src/ui`, whose files may not fetch. The TGE-date gate (§8.4, "A whole-bundle text test fails the build if the TGE date appears in any source or built file") scans the package and `dist/`; it assembles the forms from parts and never prints them. Review H2: the comparison is **case-insensitive**, and the forms include slash-ISO, unpadded US, "Mon D YYYY" without a comma, the full month name with and without a comma, ordinals (day-first and month-first), and the millisecond timestamp beside the seconds one — each with its own test whose fixture is assembled from parts. The built-output rules (ENTRIES, the React marker, fonts) need the React bundle and come in Task 16.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/check-no-tge-date.test.mjs`:

```js
import {dateViolations, forbiddenForms, listScanned} from '../check-no-tge-date.mjs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The owner's rule: the TGE date is never written. These tests assemble it from parts too.
describe('the TGE-date gate', () => {
  const [iso, monDay] = forbiddenForms();

  it('refuses a source or built file carrying any form of the date', () => {
    expect(dateViolations([{path: 'src/app/x.tsx', text: `const d = '${iso}';`}])).toHaveLength(1);
    expect(dateViolations([{path: 'dist/app/assets/p.js', text: `"claimable ${monDay}"`}])).toHaveLength(1);
    const seconds = forbiddenForms().find(f => /^\d{10}$/.test(f));
    expect(dateViolations([{path: 'dist/app/background.js', text: `t=${seconds}`}])).toHaveLength(1);
  });

  it('covers the forms the design writes (#22, #35): ISO, "Mon D, YYYY" and the Unix timestamp', () => {
    const forms = forbiddenForms();
    expect(forms.some(f => /^\d{4}-\d{2}-\d{2}$/.test(f))).toBe(true);
    expect(forms.some(f => /^[a-z]{3} \d{1,2}, \d{4}$/.test(f))).toBe(true);
    expect(forms.some(f => /^\d{10}$/.test(f))).toBe(true);
  });

  // Review H2: each added form, its fixture built here from parts — the test never holds the date either.
  describe('the added forms (review H2)', () => {
    const y = 2000 + 27;
    const m = 3 - 2;
    const d = 2 * 9;
    const p2 = n => String(n).padStart(2, '0');
    const month = ['Jan', 'uary'].join('');
    const ms = String(Date.UTC(y, m - 1, d));
    const cases = [
      ['slash ISO', `${y}/${p2(m)}/${p2(d)}`],
      ['unpadded US', `${m}/${d}/${y}`],
      ['"Mon D YYYY" without a comma', `${month.slice(0, 3)} ${d} ${y}`],
      ['the full month name without a comma', `${month} ${d} ${y}`],
      ['an ordinal, day first', `${d}th ${month} ${y}`],
      ['an ordinal, month first', `${month} ${d}th, ${y}`],
      ['the millisecond timestamp', ms],
    ];
    it.each(cases)('%s is a form, and is refused in any letter case', (_, form) => {
      expect(forbiddenForms()).toContain(form.toLowerCase());
      // (the millisecond form also contains the seconds form, so it may be reported twice)
      expect(dateViolations([{path: 'x', text: `a ${form.toUpperCase()} b`}]).length).toBeGreaterThanOrEqual(1);
      expect(dateViolations([{path: 'x', text: form}])[0]).not.toContain(form);
    });
  });

  it('passes a file without it (negative control), and never prints the date in its message', () => {
    expect(dateViolations([{path: 'src/app/x.tsx', text: "const d = '2026-09-29';"}])).toEqual([]);
    const [msg] = dateViolations([{path: 'x', text: iso}]);
    expect(msg).not.toContain(iso);
  });

  it('scans the package including dist/, and skips node_modules', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const scanned = listScanned(root);
    expect(scanned).toContain('src/background/index.ts');
    expect(scanned).toContain('unlock.html');
    expect(scanned.some(p => p.startsWith('node_modules/'))).toBe(false);
  });
});
```

Modify `extension/scripts/__tests__/check-rpc-methods.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-rpc-methods.test.mjs b/extension/scripts/__tests__/check-rpc-methods.test.mjs
--- a/extension/scripts/__tests__/check-rpc-methods.test.mjs
+++ b/extension/scripts/__tests__/check-rpc-methods.test.mjs
@@ -188,4 +188,18 @@ describe('the RPC method gate', () => {
     const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
     expect(checkRepo(root)).toEqual([]);
   });
+
+  // B1b-2a §1.3: the screens are .tsx and import ../web/src/ui; the gate follows both, and those files may not fetch.
+  it('follows .tsx imports into ../web/src/ui, where a fetch is a violation', () => {
+    const files = {
+      'src/app/popup.tsx': "import {CopyButton} from '../../../web/src/ui/CopyButton';",
+      '../web/src/ui/CopyButton.tsx': "export function CopyButton() { return fetch('https://example.invalid'); }",
+    };
+    const {files: seen, problems} = reachable(['src/app/popup.tsx'], p => files[p], p => p in files);
+    expect(problems).toEqual([]);
+    expect(seen).toContain('../web/src/ui/CopyButton.tsx');
+    expect(networkViolations(seen.map(p => f(p, files[p])))).toEqual([
+      `../web/src/ui/CopyButton.tsx: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
+    ]);
+  });
 });
```

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -1,8 +1,9 @@
-import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
+import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
 import {tmpdir} from 'node:os';
-import {dirname, join} from 'node:path';
+import {dirname, join, resolve} from 'node:path';
+import {fileURLToPath} from 'node:url';
 import {
-  bundleViolations, htmlViolations, listSourceFiles, manifestViolations, sourceViolations,
+  bundleViolations, htmlViolations, listSourceFiles, manifestViolations, sourceViolations, vaultPageViolations,
   BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, VAULT_MARKER, WORDLIST_MARKER,
 } from '../check-vault-isolation.mjs';
 import {render} from '../../manifest/source.mjs';
@@ -640,3 +641,86 @@ describe('vault isolation (manifest)', () => {
     expect(manifestViolations(withWar([{matches: ['<all_urls>']}]))).toEqual(['web_accessible_resources has an unexpected shape']);
   });
 });
+
+// B1b-2a §1.2: the vault page reaches only vault-page code, and a few modules stand alone.
+describe('the vault page import allowlist', () => {
+  const tree = files => [p => files[p], p => p in files];
+  const ENTRY = "import {x} from './modes';";
+
+  it('passes the real vault page, and the walk really reaches the vault, core/keys and the KDF worker (positive control)', () => {
+    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
+    const read = rel => {
+      try {
+        return readFileSync(join(root, rel), 'utf8');
+      } catch {
+        return undefined;
+      }
+    };
+    const seen = [];
+    const spy = rel => {
+      const t = read(rel);
+      if (t !== undefined) seen.push(rel);
+      return t;
+    };
+    expect(vaultPageViolations(spy, rel => read(rel) !== undefined)).toEqual([]);
+    expect(seen).toEqual(expect.arrayContaining(['src/unlock/main.ts', 'src/vault/envelope.ts', 'src/vault/kdf.worker.ts', '../core/keys/mnemonic.ts']));
+  });
+
+  it('refuses a src/unlock file importing src/app', () => {
+    const [read, exists] = tree({'src/unlock/main.ts': "import {App} from '../app/x';", 'src/app/x.tsx': 'export const App = 1;'});
+    expect(vaultPageViolations(read, exists)).toEqual(['the vault page reaches src/app/x.tsx — only vault-page code may be bundled with the seed']);
+  });
+
+  it('refuses react, react-dom and any package outside the five', () => {
+    const [read, exists] = tree({'src/unlock/main.ts': "import React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {PublicKey} from '@solana/web3.js';"});
+    expect(vaultPageViolations(read, exists)).toEqual([
+      'src/unlock/main.ts: the vault page imports the package react',
+      'src/unlock/main.ts: the vault page imports the package react-dom/client',
+      'src/unlock/main.ts: the vault page imports the package @solana/web3.js',
+    ]);
+  });
+
+  it('follows an allowed door: a src/shared file that imports src/app, and a ../web/src/ui component', () => {
+    const [read, exists] = tree({
+      'src/unlock/main.ts': ENTRY,
+      'src/unlock/modes.ts': "import {a} from '../shared/x';\nimport {B} from '../../../web/src/ui/Icon';",
+      'src/shared/x.ts': "import {App} from '../app/x';",
+      'src/app/x.tsx': '',
+      '../web/src/ui/Icon.tsx': '',
+    });
+    expect(vaultPageViolations(read, exists).sort()).toEqual([
+      'the vault page reaches ../web/src/ui/Icon.tsx — only vault-page code may be bundled with the seed',
+      'the vault page reaches src/app/x.tsx — only vault-page code may be bundled with the seed',
+    ]);
+  });
+
+  it('allows the shared stylesheets and the five packages (negative control of the rule above)', () => {
+    const [read, exists] = tree({
+      'src/unlock/main.ts': "import '../../../web/src/styles/design-system.css';\nimport '../styles/design-ext.css';\nimport {base58} from '@scure/base';\nimport {sha256} from '@noble/hashes/sha2.js';",
+      '../web/src/styles/design-system.css': '',
+      'src/styles/design-ext.css': '',
+    });
+    expect(vaultPageViolations(read, exists)).toEqual([]);
+  });
+
+  it('does not follow a type-only import, nor prose that looks like one', () => {
+    const [read, exists] = tree({'src/unlock/main.ts': "import type {X} from '../app/x';\nif (mode === 'import' || m === 'accounts') run();"});
+    expect(vaultPageViolations(read, exists)).toEqual([]);
+  });
+});
+
+describe('stand-alone modules (review M4)', () => {
+  it('src/shared/amount.ts and src/unlock/strings.ts may import nothing (a type-only import is erased)', () => {
+    expect(sourceViolations([f('src/unlock/strings.ts', "import {x} from './y';")])).toEqual(['src/unlock/strings.ts: imports a module — it must stand alone']);
+    expect(sourceViolations([f('src/shared/amount.ts', "export * from './y';")])).toEqual(['src/shared/amount.ts: imports a module — it must stand alone']);
+    expect(sourceViolations([f('src/shared/amount.ts', "import type {X} from './y';")])).toEqual([]);
+    expect(sourceViolations([f('src/shared/amount.ts', 'export const parse = (s: string) => s;'), f('src/unlock/strings.ts', "export const S = 'x';")])).toEqual([]);
+  });
+
+  it('a src/shared file may not import src/app or ../web', () => {
+    expect(sourceViolations([f('src/shared/x.ts', "import {App} from '../app/x';")])).toEqual([
+      'src/shared/x.ts: imports UI code (src/app, ../web) — src/shared is vault-page reachable',
+    ]);
+    expect(sourceViolations([f('src/shared/x.ts', "import {Icon} from '../../../web/src/ui/Icon';")])).toHaveLength(1);
+  });
+});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run scripts/__tests__/`
Expected: FAIL — `check-no-tge-date.test.mjs` cannot load its module; `vaultPageViolations` undefined (6 tests); the stand-alone and `src/shared` rules (2); the `.tsx` follow (1) — `9 failed | 143 passed`.

- [ ] **Step 3: Implement.**

Modify `extension/package.json`:

```diff
diff --git a/extension/package.json b/extension/package.json
--- a/extension/package.json
+++ b/extension/package.json
@@ -9,7 +9,7 @@
     "e2e": "playwright test",
     "csp": "node scripts/check-csp.mjs dist/app",
     "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox",
-    "gates": "node scripts/check-permissions.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs",
+    "gates": "node scripts/check-permissions.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs",
     "reproducible": "node scripts/verify-reproducible.mjs",
     "verify": "rm -rf dist && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
   },
```

Create `extension/scripts/check-no-tge-date.mjs`:

```js
#!/usr/bin/env node
// Owner rule: the TGE date is not published anywhere yet — not in the extension's sources, not in
// what it ships. This gate reads every source file of the package (src/, e2e/, scripts/, the HTML
// entries, the stylesheets) and every built file under dist/, and fails on any written form of the
// date the design uses (#22, #35: ISO, "Mon D, YYYY", the Unix timestamp) plus the other common ones.
//
// The date itself is never written in this file either: it is assembled from parts at run time, so
// the gate cannot become the leak it looks for.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** English ordinal suffix: 1st, 2nd, 3rd, 4th … 11th–13th, 21st … */
const ordinal = n => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[n % 10] ?? 'th'));

/**
 * Every written form this gate refuses, assembled from parts, lowercased (the comparison is
 * case-insensitive: "JAN", "Jan" and "jan" are the same date). Review H2 added the slash-ISO,
 * unpadded US, comma-less and ordinal forms, and the millisecond timestamp.
 */
export function forbiddenForms() {
  const year = 2000 + 27;
  const month = 3 - 2;
  const day = 2 * 9;
  const pad = n => String(n).padStart(2, '0');
  const long = MONTHS[month - 1];
  const short = long.slice(0, 3);
  const nth = `${day}${ordinal(day)}`;
  const seconds = Date.UTC(year, month - 1, day) / 1000;
  return [
    `${year}-${pad(month)}-${pad(day)}`,
    `${year}/${pad(month)}/${pad(day)}`,
    `${short} ${day}, ${year}`,
    `${short} ${day} ${year}`,
    `${long} ${day}, ${year}`,
    `${long} ${day} ${year}`,
    `${day} ${short} ${year}`,
    `${day} ${long} ${year}`,
    `${nth} ${long} ${year}`,
    `${long} ${nth}, ${year}`,
    `${long} ${nth} ${year}`,
    `${pad(day)}.${pad(month)}.${year}`,
    `${pad(month)}/${pad(day)}/${year}`,
    `${month}/${day}/${year}`,
    String(seconds),
    String(seconds * 1000),
  ].map(f => f.toLowerCase());
}

/** [path, form] for every file whose text contains a forbidden form, in any letter case. */
export function dateViolations(files, forms = forbiddenForms()) {
  const out = [];
  for (const {path, text} of files) {
    const lower = text.toLowerCase();
    for (const form of forms) if (lower.includes(form)) out.push(`${path}: contains the TGE date (${form.length} characters, not repeated here)`);
  }
  return out;
}

const TEXT = /\.(?:[cm]?[jt]sx?|html?|css|json|md|txt|svg|map)$/;
const SKIP_ROOT = new Set(['node_modules', 'test-results', 'playwright-report']);

function walk(dir, root, atRoot, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (atRoot && SKIP_ROOT.has(e)) continue;
      walk(p, root, false, out);
    } else if (TEXT.test(e)) out.push(relative(root, p).split(sep).join('/'));
  }
}

export function listScanned(root) {
  const out = [];
  walk(root, root, true, out);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (!existsSync(join(ROOT, 'dist', 'app'))) {
    console.error('INCONCLUSIVE: dist/app does not exist — build first, or the built files go unchecked');
    process.exit(1);
  }
  const files = listScanned(ROOT).map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')}));
  const problems = dateViolations(files);
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`no TGE date: ${files.length} source and built files checked`);
}
```

Modify `extension/scripts/check-rpc-methods.mjs`:

```diff
diff --git a/extension/scripts/check-rpc-methods.mjs b/extension/scripts/check-rpc-methods.mjs
--- a/extension/scripts/check-rpc-methods.mjs
+++ b/extension/scripts/check-rpc-methods.mjs
@@ -101,7 +101,8 @@ export const DEPS_FILE = 'src/background/deps.ts';
 // never on rpc.ts itself composing it).
 export const RPC_PATH_LITERAL = '/api/v1/rpc';
 
-const EXTENSIONS = ['', '.ts', '.mts', '.mjs', '.js', '/index.ts'];
+// .tsx: the React screens (B1b-2a) and ../web/src/ui/*, which they import and which this gate follows.
+const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts', '/index.tsx'];
 const FROM_SPEC = /\bfrom\s*(['"`])([^'"`]+)\1/g;
 const CALL_SPEC = /\bimport\s*\(?\s*(['"`])([^'"`$]+)\1/g;
 
```

Modify `extension/scripts/check-vault-isolation.mjs`:

```diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -51,6 +51,12 @@ const EXT_IMPORT_ALLOWED = /^src\/background\//;
 const LOCAL_READER = 'src/shared/readLocal';
 const LOCAL_READER_PATH = `${LOCAL_READER}.ts`;
 const LOCAL_READER_ALLOWED = /^src\/unlock\//;
+// Modules that may import nothing (B1b-2a review M4; a type-only import is erased and allowed, as it
+// always was for readLocal): the vault page's storage
+// reader, and the two pure modules the vault page shares — amounts and its fixed strings. The vault
+// page may reach all of src/shared/, so a shared file importing UI code would carry it in through an
+// allowed door; a stand-alone module cannot.
+export const STANDALONE = [LOCAL_READER_PATH, 'src/shared/amount.ts', 'src/unlock/strings.ts'];
 // A storage write in any spelling: a call (`.set(`), a bracket (`['set']`), a destructured name.
 const WRITES_STORAGE = /(?:\?\.|\.)\s*(?:set|remove|clear)\s*\(|\[\s*['"`](?:set|remove|clear)['"`]\s*\]|[{,]\s*(?:set|remove|clear)\s*[,}:=]/;
 const TOUCHES_SESSION = /storage\s*(?:\?\.|\.)\s*session\b|storage\s*\[\s*['"`]session['"`]\s*\]/;
@@ -154,6 +160,63 @@ function namesLocalReader(fromPath, spec) {
   return target !== null && target.replace(/\.[cm]?[jt]s$/, '') === LOCAL_READER;
 }
 
+function namesUiCode(fromPath, spec) {
+  const target = resolveSource(fromPath, spec);
+  return target !== null && (target === 'src/app' || target.startsWith('src/app/') || target.startsWith('../web/'));
+}
+
+// ── The vault page's import allowlist (B1b-2a §1.2) ─────────────────────────────────────────────
+// Every file reachable from the vault page's entry, following relative imports (into ../core and
+// ../web too), must be vault-page code or a stylesheet; every package it imports must be one of the
+// five the vault needs. So src/app/**, react, react-dom and ../web/src/ui/** can never reach the page
+// that holds the seed. Type-only imports are erased and not followed.
+export const VAULT_PAGE_ENTRY = 'src/unlock/main.ts';
+const VAULT_PAGE_FILES = [
+  /^src\/unlock\//,
+  /^src\/vault\//,
+  /^src\/shared\//,
+  /^src\/ui\/send\.ts$/,
+  /^src\/styles\/[^/]+\.css$/,
+  /^\.\.\/web\/src\/styles\/design-system\.css$/,
+  /^\.\.\/core\/keys\//,
+  /^\.\.\/core\/util\//,
+];
+export const VAULT_PAGE_PACKAGES = ['@noble/curves', '@noble/hashes', '@scure/base', '@scure/bip39', 'micro-key-producer'];
+const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx'];
+const MODULE_SPECIFIER = /^[\w@.\/-]+$/;
+const packageOf = spec => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
+
+/** `read(path)` → text or undefined; `exists(path)` → boolean. Paths package-relative, / separators. */
+export function vaultPageViolations(read, exists, entry = VAULT_PAGE_ENTRY) {
+  const out = [];
+  const seen = new Set();
+  const stack = [entry];
+  if (read(entry) === undefined) return [`INCONCLUSIVE: the vault page entry ${entry} does not exist`];
+  while (stack.length > 0) {
+    const path = stack.pop();
+    if (seen.has(path)) continue;
+    seen.add(path);
+    if (!VAULT_PAGE_FILES.some(re => re.test(path))) out.push(`the vault page reaches ${path} — only vault-page code may be bundled with the seed`);
+    if (!SOURCE_EXT.test(path)) continue; // a stylesheet carries no code and imports nothing we follow
+    const text = read(path) ?? '';
+    for (const ref of moduleReferences(text)) {
+      // The loose patterns above also match prose (`mode === 'import' || …`); a module specifier has
+      // no spaces or operators. A computed specifier is out of any static reach (the bundle checks are
+      // the backstop).
+      if (ref.typeOnly || !MODULE_SPECIFIER.test(ref.spec)) continue;
+      const target = resolveSource(path, ref.spec);
+      if (target === null) {
+        if (!VAULT_PAGE_PACKAGES.includes(packageOf(ref.spec))) out.push(`${path}: the vault page imports the package ${ref.spec}`);
+        continue;
+      }
+      const file = RESOLVE_EXTENSIONS.map(e => target + e).find(exists);
+      if (file === undefined) out.push(`${path} imports ${ref.spec}, which does not resolve to a file`);
+      else stack.push(file);
+    }
+  }
+  return out;
+}
+
 export function sourceViolations(files) {
   const out = [];
   for (const {path, text} of files) {
@@ -163,10 +226,12 @@ export function sourceViolations(files) {
     if (!VAULT_ALLOWED.test(path) && values.some(r => namesVault(path, r.spec))) out.push(`${path}: imports the vault`);
     if (!VAULT_ALLOWED.test(path) && values.some(r => namesCoreKeys(path, r.spec))) out.push(`${path}: imports core/keys (seed code)`);
     if (!UNLOCK_ALLOWED.test(path) && values.some(r => namesUnlock(path, r.spec))) out.push(`${path}: imports the vault page (src/unlock)`);
+    if (STANDALONE.includes(path) && values.length > 0) out.push(`${path}: imports a module — it must stand alone`);
+    // src/shared/ is reachable from the vault page: it may never reach UI code (B1b-2a M4).
+    if (/^src\/shared\//.test(path) && moduleReferences(text).some(r => namesUiCode(path, r.spec))) out.push(`${path}: imports UI code (src/app, ../web) — src/shared is vault-page reachable`);
     if (path === LOCAL_READER_PATH) {
       if (TOUCHES_SESSION.test(text)) out.push(`${path}: touches storage.session — it may read storage.local only`);
       if (WRITES_STORAGE.test(text)) out.push(`${path}: writes storage — it may only read`);
-      if (values.length > 0) out.push(`${path}: imports a module — it must stand alone`);
     } else if (!SESSION_ALLOWED.test(path) && (TOUCHES_SESSION.test(text) || TOUCHES_STORAGE.test(text))) {
       out.push(`${path}: touches storage outside src/ext.ts and the background`);
     }
@@ -385,7 +450,11 @@ if (import.meta.url === `file://${process.argv[1]}`) {
   const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
   const files = listSourceFiles(ROOT).map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')}));
   const pages = readdirSync(ROOT).filter(e => /\.html?$/i.test(e)).map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')}));
-  const problems = [...sourceViolations(files), ...htmlViolations(pages)];
+  const readRel = rel => {
+    const abs = join(ROOT, rel);
+    return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : undefined;
+  };
+  const problems = [...sourceViolations(files), ...htmlViolations(pages), ...vaultPageViolations(readRel, rel => readRel(rel) !== undefined)];
   for (const d of ['app', 'chrome', 'firefox']) {
     for (const p of bundleViolations(join(ROOT, 'dist', d))) problems.push(`dist/${d}: ${p}`);
   }
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run scripts/__tests__/`
Expected: PASS — 4 files, 163 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 63 files, 803 tests.

- [ ] **Step 6: Build and the gates.**

Run: `rm -rf dist && npm run build && npm run gates`
Expected: `permissions ok…`, `vault isolation ok…`, `rpc methods ok…`, `no TGE date: … files checked` — exit 0.

- [ ] **Step 7: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **admit src/app:** add `/^src\/app\//,` to `VAULT_PAGE_FILES`. Run `npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` → RED: 2 failed.
  - **stand-alone only for readLocal:** replace `if (STANDALONE.includes(path) && values.length > 0)` with `if (path === LOCAL_READER_PATH && values.length > 0)`. Run `npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` → RED: 1 failed.
  - **no `.tsx`:** remove `'.tsx'` and `'/index.tsx'` from `EXTENSIONS` in `check-rpc-methods.mjs`. Run `npx vitest run scripts/__tests__/check-rpc-methods.test.mjs` → RED: 3 failed.
  - **forget slash-ISO (H2):** delete the `` `${year}/${pad(month)}/${pad(day)}`, `` line. Run `npx vitest run scripts/__tests__/check-no-tge-date.test.mjs` → RED: 1 failed.
  - **forget the millisecond form (H2):** delete `String(seconds * 1000),`. Run `npx vitest run scripts/__tests__/check-no-tge-date.test.mjs` → RED: 1 failed.
  - **case-sensitive (H2):** replace `const lower = text.toLowerCase();` with `const lower = text;`. Run `npx vitest run scripts/__tests__/check-no-tge-date.test.mjs` → RED: 4 failed.
  - **forget the seconds form:** delete `String(seconds),` in `forbiddenForms()`. Run `npx vitest run scripts/__tests__/check-no-tge-date.test.mjs` → RED: 1 failed.

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/package.json extension/scripts/__tests__/check-no-tge-date.test.mjs extension/scripts/__tests__/check-rpc-methods.test.mjs extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/check-no-tge-date.mjs extension/scripts/check-rpc-methods.mjs extension/scripts/check-vault-isolation.mjs
git commit -m "feat(extension): gates — the vault page's import allowlist, stand-alone modules, .tsx, no TGE date (B1b-2a §1.2, §8.4)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 10: The UI foundation: React, the test stack, the shared resolution, the design classes, the message client

**Files:**
- Modify: `extension/package-lock.json`
- Modify: `extension/package.json`
- Create: `extension/public/fonts/Geist-Variable.woff2`
- Create: `extension/public/fonts/GeistMono-Variable.woff2`
- Create: `extension/src/app/engine.ts`
- Create: `extension/src/app/format.ts`
- Create: `extension/src/app/platform.ts`
- Create: `extension/src/app/prefs.ts`
- Create: `extension/src/app/useNow.ts`
- Create: `extension/src/app/valuation.ts`
- Create: `extension/src/shared/amount.ts`
- Create: `extension/src/styles/design-ext.css`
- Modify: `extension/tsconfig.json`
- Modify: `extension/vite.config.ts`
- Test (create): `extension/src/app/__tests__/engine.test.ts`
- Test (create): `extension/src/app/__tests__/format.test.ts`
- Test (create): `extension/src/shared/__tests__/amount.test.ts`

**Interfaces:**
- Consumes: Tasks 1–7's messages (the client covers all of them); `src/ui/send.ts`; `core/portfolio/value.ts`.
- Produces:
  - `src/shared/amount.ts`: `parseAmount(text, decimals): bigint | null`; `formatAmount(base, decimals, {min, max}): string` (truncates)
  - `src/app/engine.ts`: `type Token`, `type Reply<T, C>`, `interface Account, WalletState, Balances, Prices, Cached, Intent, Simulation, Prepared, Resumable, Pending, HistoryItem, Settings, RecipientInfo`; `interface Engine {state, balances, prices, cached, prepareSend, preparedFor, send, resend, pending, history, recipientInfo, discardPrepared, rename, select, settings, lock, ping}`; `createEngine(transport?, sleep?)`; `RETRY_AFTER_MS = 300`
  - `src/app/format.ts`: `TOKEN_INFO`, `showAmount`, `showSol`, `usdParts`, `showUsd`, `shortAddress`, `twoGroups`, `ago`, `agoLong`, `clock`, `timeOfDay`, `fullDate`, `dateSection`
  - `src/app/valuation.ts`: `interface TokenValue`, `valuation(balances, prices) → {total: number | null; rows: Record<Token, TokenValue>}`
  - `src/app/prefs.ts`: `HIDE_BALANCES_KEY`, `ACTIVITY_FILTER_KEY`, `readPref`, `writePref`; `src/app/platform.ts`: `type ExtensionPage`, `interface Platform {openPage, closeWindow, version}`, `browserPlatform`; `src/app/useNow.ts`: `useNow(ms?, now?)`
  - `src/styles/design-ext.css` (611 lines, sha256 `22f5aec5eda5e20061c0875b6170f90b3c341e092e2e75f36d5a5488c0383771`)

Spec §1.3: React 18.3 and react-dom "the versions `web/` pins" (18.3.1, pinned exact here so the React-18 marker of Task 16 cannot drift), `@vitejs/plugin-react`, `@testing-library/react`, `happy-dom`, `qrcode-generator` pinned exact (S6). `coreResolvesFromHere` becomes `sharedResolvesFromHere`: a bare import made by a `../core/` **or `../web/src/ui/`** file resolves from `extension/`, so React is one copy (in CI only `extension/` is installed; locally `web/node_modules` would otherwise give a second React and break hooks — the mutation proves it). `tsconfig` maps `react`/`react-dom` types to `extension/`'s and compiles `../web/src/ui/*`. The fonts are copied into `public/fonts/`. `src/styles/design-ext.css` is **extracted** from the owner's `index.html` by a one-off script (below) — the design's own rules under the same class names (§1.2 item 1). `src/shared/amount.ts` is pure and stand-alone (Task 9's rule). `src/app/engine.ts` is the §1.5 client: one typed function per message, every reply shape-checked (numbers are numbers, `^\d+$` amounts become `bigint`, addresses base58, enums known), a wrong shape → `failed`, one retry after 300 ms — safe for `wallet.send` too, and documented in the code so plan 3 does not "fix" it (review L5: a prepared id is single-use, so a retried send answers `unknown-prepared`, which §4.5's R2-M2 rule resolves through `wallet.pending`). `format.ts`, `valuation.ts` (NOC at the stage price, outside the market total — `core/portfolio/value.ts`), `prefs.ts` (S4: `localStorage`, every access wrapped), `platform.ts` (`tabs.create` of a closed list of extension pages, `window.close`, the version — never storage, never a listener), `useNow.ts`.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/engine.test.ts`:

```ts
import {createEngine, RETRY_AFTER_MS, type Transport} from '../engine';
import {handleMessage} from '../../background/messages';
import {VAULT_KEY} from '../../background/accountsStore';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {setSession} from '../../background/session';
import {firstSignature} from '../../../../core/solana/broadcast';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, RECIPIENT, sendReader} from '../../background/__tests__/fixtures';

// Spec B1b-2a §8.3: the client wired to the REAL handleMessage, a fake Ext and fake deps, sent from
// /popup.html — the real background logic with no browser.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const POPUP = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]};
const NOC = WALLET_TOKENS.NOC.mint as string;
const noSleep = async () => undefined;

async function wired(depsOver: Parameters<typeof fakeDeps>[0] = {}, unlocked = true) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, ENV);
  if (unlocked) await setSession(ext, [ACCOUNT]);
  const deps = fakeDeps(depsOver);
  const transport: Transport = m => handleMessage(ext, m, POPUP, deps);
  return {ext, deps, engine: createEngine(transport, noSleep)};
}

describe('the message client against the real background', () => {
  it('state, settings, ping, lock', async () => {
    const {engine} = await wired();
    expect(await engine.state()).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 0}});
    expect(await engine.settings()).toEqual({ok: true, data: {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0}});
    expect(await engine.ping()).toEqual({ok: true, data: null});
    expect(await engine.lock()).toEqual({ok: true, data: null});
    expect((await engine.state()).data).toMatchObject({unlocked: false});
  });

  it('balances become bigint; its refusals come through typed', async () => {
    const reader = fakeReader({getBalance: async () => 7n, getTokenAccountsByOwner: async () => [{pubkey: 'a', mint: NOC, owner: ACCOUNT.publicKey, amount: 12n, decimals: 9}]});
    const {engine} = await wired({reader});
    expect(await engine.balances(ACCOUNT.publicKey)).toEqual({ok: true, data: {sol: 7n, noc: 12n, usdc: 0n, usdt: 0n}});
    expect(await engine.balances('nope')).toEqual({ok: false, error: 'malformed'});
    for (const [e, code] of [[new RequestUnreachable('u', 'x'), 'unreachable'], [new RpcForbidden('getBalance'), 'coordinator-refused'], [new Error('x'), 'failed']] as const) {
      const failing = fakeReader({
        getBalance: async () => {
          throw e;
        },
        getTokenAccountsByOwner: async () => [],
      });
      expect(await (await wired({reader: failing})).engine.balances(ACCOUNT.publicKey)).toEqual({ok: false, error: code});
    }
  });

  it('prices and the cache', async () => {
    const reader = fakeReader({getBalance: async () => 7n, getTokenAccountsByOwner: async () => []});
    const {engine, deps} = await wired({reader});
    expect(await engine.prices()).toEqual({ok: true, data: {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: deps.clock.t}});
    expect(await engine.cached(ACCOUNT.publicKey)).toEqual({ok: true, data: {balances: null, prices: {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: deps.clock.t}}});
    await engine.balances(ACCOUNT.publicKey);
    expect((await engine.cached(ACCOUNT.publicKey)).data).toMatchObject({balances: {sol: 7n, noc: 0n, usdc: 0n, usdt: 0n, at: deps.clock.t}});
    await engine.lock();
    expect(await engine.cached(ACCOUNT.publicKey)).toEqual({ok: false, error: 'locked'});
  });

  it('prepare, resume, send, pending — and the refusal that carries a challenge', async () => {
    const {engine, ext, deps} = await wired({reader: sendReader()});
    deps.broadcast = async wire => firstSignature(wire);
    const intent = {token: 'SOL' as const, recipient: RECIPIENT, amount: 1_000_000n};
    const first = await engine.prepareSend(ACCOUNT.publicKey, intent);
    expect(first.ok && first.data.reauth?.reasons).toEqual(['first-send']);
    if (!first.ok) throw new Error('prepare');
    expect(first.data.simulation.sol.before).toBe(10_000_000_000n);
    const resumed = await engine.preparedFor(ACCOUNT.publicKey);
    expect(resumed.ok && resumed.data?.intent).toEqual(intent);
    expect(await engine.send(first.data.id)).toEqual({ok: false, error: 'reauth-required', data: {challengeId: first.data.reauth?.challengeId}});
    // A known recipient: no re-auth, and the send goes out.
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const again = await engine.prepareSend(ACCOUNT.publicKey, intent);
    if (!again.ok) throw new Error('prepare');
    expect(again.data.reauth).toBeNull();
    const sent = await engine.send(again.data.id);
    expect(sent.ok && sent.data.state).toBe('pending');
    const pending = await engine.pending();
    expect(pending.ok && pending.data.map(p => [p.state, p.intent.amount])).toEqual([['pending', 1_000_000n]]);
    expect(await engine.send(again.data.id)).toEqual({ok: false, error: 'unknown-prepared'});
  });

  it('recipientInfo, discardPrepared, rename, select, history', async () => {
    const reader = sendReader({getSignaturesForAddress: async () => []});
    const {engine} = await wired({reader});
    expect(await engine.recipientInfo(ACCOUNT.publicKey, RECIPIENT)).toEqual({ok: true, data: {known: false, lastSentAt: null, label: null, self: false}});
    await engine.prepareSend(ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: 1_000_000n});
    expect(await engine.discardPrepared(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
    expect(await engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
    expect(await engine.rename(0, 'Savings')).toEqual({ok: true, data: null});
    expect((await engine.state()).data).toMatchObject({accounts: [{name: 'Savings'}]});
    expect(await engine.rename(9, 'x')).toEqual({ok: false, error: 'unknown-account'});
    expect(await engine.select(0)).toEqual({ok: true, data: null});
    expect(await engine.history(ACCOUNT.publicKey)).toEqual({ok: true, data: []});
    expect(await engine.history(ACCOUNT.publicKey, 'not-a-signature')).toEqual({ok: false, error: 'malformed'});
  });
});

describe('shape checks: a reply of the wrong shape is failed', () => {
  const engineAnswering = (reply: unknown) => createEngine(async () => reply, noSleep);
  const acc = ACCOUNT.publicKey;

  it.each([
    ['a number where a base-unit string belongs', {ok: true, data: {sol: 7, noc: '0', usdc: '0', usdt: '0'}}],
    ['a decimal amount', {ok: true, data: {sol: '7.5', noc: '0', usdc: '0', usdt: '0'}}],
    ['a missing field', {ok: true, data: {sol: '7', noc: '0', usdc: '0'}}],
    ['an unknown refusal code', {ok: false, error: 'exploded'}],
    ['not an object', 'ok'],
    ['nothing', undefined],
  ])('balances: %s', async (_, reply) => {
    expect(await engineAnswering(reply).balances(acc)).toEqual({ok: false, error: 'failed'});
  });

  it('state: an address outside base58, an unknown scheme', async () => {
    const good = {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: acc}], selected: 0};
    expect((await engineAnswering({ok: true, data: good}).state()).ok).toBe(true);
    expect(await engineAnswering({ok: true, data: {...good, accounts: [{index: 0, name: 'A', publicKey: '0OIl'}]}}).state()).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: true, data: {...good, scheme: 'bip32'}}).state()).toEqual({ok: false, error: 'failed'});
  });

  it('prices: zero is not a price (null is)', async () => {
    expect(await engineAnswering({ok: true, data: {sol: 0, usdc: 1, usdt: 1, noc: null, at: 1}}).prices()).toEqual({ok: false, error: 'failed'});
    expect((await engineAnswering({ok: true, data: {sol: null, usdc: 1, usdt: 1, noc: null, at: 1}}).prices()).ok).toBe(true);
  });

  it('pending: an unknown state or failure value', async () => {
    const p = {
      id: 'r1', account: acc, signature: '5'.repeat(88), lastValidBlockHeight: 1, createdAt: 1, lastSentAt: 1, state: 'pending', detail: null,
      intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null,
    };
    expect((await engineAnswering({ok: true, data: [p]}).pending()).ok).toBe(true);
    expect(await engineAnswering({ok: true, data: [{...p, state: 'lost'}]}).pending()).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: true, data: [{...p, failure: 'maybe'}]}).pending()).toEqual({ok: false, error: 'failed'});
  });
});

describe('a thrown sendMessage (the service worker restarting)', () => {
  it('is retried once after 300 ms', async () => {
    let calls = 0;
    const waits: number[] = [];
    const engine = createEngine(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error('Could not establish connection. Receiving end does not exist.');
        return {ok: true};
      },
      async ms => void waits.push(ms),
    );
    expect(await engine.ping()).toEqual({ok: true, data: null});
    expect(calls).toBe(2);
    expect(waits).toEqual([RETRY_AFTER_MS]);
  });

  it('twice is failed', async () => {
    let calls = 0;
    const engine = createEngine(async () => {
      calls += 1;
      throw new Error('gone');
    }, noSleep);
    expect(await engine.ping()).toEqual({ok: false, error: 'failed'});
    expect(calls).toBe(2);
  });
});
```

Create `extension/src/app/__tests__/format.test.ts`:

```ts
import {ago, agoLong, clock, dateSection, shortAddress, showAmount, showSol, twoGroups, usdParts} from '../format';
import {valuation} from '../valuation';

// The words and numbers the screens print, from one place.
describe('format', () => {
  it('token amounts as the design prints them, truncated', () => {
    expect(showAmount('SOL', 62_482_199_999n)).toBe('62.4821');
    expect(showAmount('NOC', 4_200_000_000_000n)).toBe('4,200.00');
    expect(showAmount('USDC', 740_219_999n)).toBe('740.21');
    expect(showSol(5_000n)).toBe('0.000005');
  });

  it('the hero’s dollars and cents, floored', () => {
    expect(usdParts(14_881.199)).toEqual({whole: '$14,881', cents: '.19'});
    expect(usdParts(0.5)).toEqual({whole: '$0', cents: '.50'});
  });

  it('addresses in lists: four … four; in the switcher: two groups', () => {
    const a = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
    expect(shortAddress(a)).toBe('HAgk…Kpqk');
    expect(twoGroups(a)).toBe('HAgk 14Jp…');
  });

  it('ages and clock times', () => {
    expect(ago(0, 2_000)).toBe('2 s ago');
    expect(ago(0, 120_000)).toBe('2 min ago');
    expect(ago(0, 7_200_000)).toBe('2 h ago');
    expect(ago(0, 3 * 86_400_000)).toBe('3 d ago');
    expect(agoLong(0, 138_000)).toBe('2 min 18 s ago');
    expect(clock(new Date(2026, 0, 2, 9, 41, 13).getTime())).toBe('09:41:13');
  });

  it('date sections, local calendar days', () => {
    const now = new Date(2026, 4, 8, 15, 0).getTime();
    expect(dateSection(new Date(2026, 4, 8, 9, 14).getTime(), now)).toBe('TODAY · MAY 8');
    expect(dateSection(new Date(2026, 4, 7, 23, 59).getTime(), now)).toBe('YESTERDAY · MAY 7');
    expect(dateSection(new Date(2026, 4, 4, 12).getTime(), now)).toBe('THIS WEEK');
    expect(dateSection(new Date(2026, 4, 1, 12).getTime(), now)).toBe('THIS MONTH');
    expect(dateSection(new Date(2026, 3, 20, 12).getTime(), now)).toBe('APRIL 2026');
    expect(dateSection(null, now)).toBe('TODAY · MAY 8');
  });
});

describe('valuation (parent spec §4, as web/)', () => {
  const b = {sol: 62_482_100_000n, noc: 4_200_000_000_000n, usdc: 740_210_000n, usdt: 0n};

  it('the total is SOL + USDC + USDT at market; NOC at the stage price, beside it, never in it', () => {
    const v = valuation(b, {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: 1});
    expect(v.total).toBeCloseTo(62.4821 * 150 + 740.21, 6);
    expect(v.rows.NOC).toMatchObject({usd: 4200 * 0.1501, basis: 'stage'});
    expect(v.rows.USDT.usd).toBe(0);
  });

  it('no price is null — never $0 — and a total with no market price at all is null', () => {
    const v = valuation(b, null);
    expect(v.total).toBeNull();
    expect(v.rows.SOL.usd).toBeNull();
    expect(v.rows.NOC.usd).toBeNull();
    expect(v.rows.USDT.usd).toBeNull();
    expect(valuation(b, {sol: null, usdc: 1, usdt: null, noc: null, at: 1}).total).toBeCloseTo(740.21, 6);
  });
});
```

Create `extension/src/shared/__tests__/amount.test.ts`:

```ts
import {formatAmount, parseAmount} from '../amount';

describe('parseAmount', () => {
  it('reads digits with at most the token’s decimals, exactly', () => {
    expect(parseAmount('2.48', 9)).toBe(2_480_000_000n);
    expect(parseAmount('12', 6)).toBe(12_000_000n);
    expect(parseAmount('0.000001', 6)).toBe(1n);
    expect(parseAmount('1.', 6)).toBe(1_000_000n);
    expect(parseAmount('18446744073.709551615', 9)).toBe(18_446_744_073_709_551_615n);
  });

  it('refuses anything else — more places than the token has, signs, spaces, exponents, commas', () => {
    for (const bad of ['', '.5', '1.0000001', '-1', ' 1', '1e3', '1,000', '0x10', 'NaN']) expect(parseAmount(bad, 6)).toBeNull();
    expect(parseAmount('1.5', 0)).toBeNull();
    expect(parseAmount('15', 0)).toBe(15n);
  });
});

describe('formatAmount', () => {
  it('groups thousands and keeps min..max fraction digits', () => {
    expect(formatAmount(4_200_000_000_000n, 9, {min: 2, max: 2})).toBe('4,200.00');
    expect(formatAmount(62_482_100_000n, 9, {min: 4, max: 4})).toBe('62.4821');
    expect(formatAmount(5_000n, 9, {min: 0, max: 9})).toBe('0.000005');
    expect(formatAmount(1_000_000n, 6, {min: 0, max: 6})).toBe('1');
  });

  it('truncates, never rounds a balance up', () => {
    expect(formatAmount(62_482_199_999n, 9, {min: 4, max: 4})).toBe('62.4821');
    expect(formatAmount(999_999n, 6, {min: 2, max: 2})).toBe('0.99');
    // property: for many balances, the shown value never exceeds the real one
    for (let i = 0n; i < 2000n; i++) {
      const base = i * 7_919_000n + 999_999n;
      const shown = parseAmount(formatAmount(base, 9, {min: 4, max: 4}).replaceAll(',', ''), 9);
      expect(shown !== null && shown <= base).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/shared/__tests__/amount.test.ts src/app/__tests__/engine.test.ts src/app/__tests__/format.test.ts`
Expected: FAIL — `Cannot find module '../amount'` (and `../engine`, `../format`).

- [ ] **Step 3: Implement.**

Modify `extension/package.json`:

```diff
diff --git a/extension/package.json b/extension/package.json
--- a/extension/package.json
+++ b/extension/package.json
@@ -2,7 +2,9 @@
   "name": "noctura-extension",
   "private": true,
   "type": "module",
-  "engines": {"node": ">=22.12.0"},
+  "engines": {
+    "node": ">=22.12.0"
+  },
   "scripts": {
     "build": "tsc --noEmit && node scripts/build.mjs",
     "test": "vitest run",
@@ -20,11 +22,20 @@
     "@scure/bip39": "^2.0.1",
     "@solana/web3.js": "^1.99.0",
     "buffer": "^6.0.3",
-    "micro-key-producer": "^0.8.5"
+    "micro-key-producer": "^0.8.5",
+    "qrcode-generator": "2.0.4",
+    "react": "18.3.1",
+    "react-dom": "18.3.1"
   },
   "devDependencies": {
     "@playwright/test": "^1.55.0",
+    "@testing-library/dom": "^10.4.2",
+    "@testing-library/react": "^16.3.3",
     "@types/node": "^22.7.0",
+    "@types/react": "^18.3.31",
+    "@types/react-dom": "^18.3.7",
+    "@vitejs/plugin-react": "^6.1.1",
+    "happy-dom": "^20.14.5",
     "typescript": "^5.5.0",
     "vite": "^8.3.0",
     "vitest": "^5.0.1"
```

Create `extension/src/app/engine.ts`:

```ts
import {send as runtimeSend} from '../ui/send';

/**
 * The popup's and the tab's one way to the background (spec B1b-2a §1.5): one typed function per
 * engine message. Every reply is shape-checked before a screen sees it — numbers are numbers,
 * base-unit amounts match ^\d+$ and become bigint, addresses are base58, enums are known — and a
 * reply of any other shape is `failed`. A thrown sendMessage (the service worker restarting) is
 * retried once after 300 ms, then `failed`. No screen ever handles a raw reply.
 */

export type Token = 'SOL' | 'NOC' | 'USDC' | 'USDT';
export type Reply<T, C extends string> = {ok: true; data: T} | {ok: false; error: C | 'failed'; data?: unknown};

export interface Account {
  index: number;
  name: string;
  publicKey: string;
}
export interface WalletState {
  hasWallet: boolean;
  unlocked: boolean;
  scheme: 'slip10' | 'cli' | null;
  accounts: Account[];
  selected: number | null;
}
export interface Balances {
  sol: bigint;
  noc: bigint;
  usdc: bigint;
  usdt: bigint;
}
export interface Prices {
  sol: number | null;
  usdc: number | null;
  usdt: number | null;
  noc: number | null;
  at: number;
}
export interface Cached {
  balances: (Balances & {at: number}) | null;
  prices: Prices | null;
}
export type FeeReason = 'pre-tge' | 'zero-fee-eligible' | 'status-unknown' | 'charged';
export type ReauthReason = 'first-send' | 'over-5-percent' | 'over-usd-threshold' | 'whole-balance-to-new';
export interface Intent {
  token: Token;
  recipient: string;
  amount: bigint;
}
export interface Simulation {
  slot: number;
  elapsedMs: number;
  instructions: number;
  programs: ('compute-budget' | 'system' | 'token' | 'associated-token')[];
  recipient: 'wallet' | 'new' | 'program' | 'other';
  sol: {before: bigint; after: bigint};
  token: {symbol: 'NOC' | 'USDC' | 'USDT'; before: bigint; after: bigint} | null;
}
export interface Prepared {
  id: string;
  fees: {networkLamports: bigint; priorityLamports: bigint; rentLamports: bigint; markupLamports: bigint; markupReason: FeeReason};
  solRequiredLamports: bigint;
  reauth: {challengeId: string; reasons: ReauthReason[]} | null;
  simulation: Simulation;
}
export type Resumable = Prepared & {intent: Intent; expired: boolean};
export type PendingState = 'pending' | 'stuck' | 'confirmed' | 'failed' | 'expired';
export interface Pending {
  id: string;
  account: string;
  signature: string;
  lastValidBlockHeight: number;
  createdAt: number;
  lastSentAt: number;
  state: PendingState;
  detail: string | null;
  intent: Intent;
  expiryNullSeenAt: number | null;
  failure: 'landed' | 'not-sent' | null;
}
export type HistoryKind = 'sent' | 'received' | 'purchase' | 'other';
export interface HistoryItem {
  signature: string;
  blockTime: number | null;
  kind: HistoryKind;
  token: Token | null;
  mint: string | null;
  amount: bigint | null;
  counterparty: string | null;
  feeLamports: bigint;
  failed: boolean;
}
export interface Settings {
  autoLockMinutes: number;
  reauthUsdCents: number;
  selectedAccount: number;
}
export interface RecipientInfo {
  known: boolean;
  lastSentAt: number | null;
  label: {kind: 'own'; index: number; name: string} | {kind: 'treasury'} | null;
  self: boolean;
}

type Network = 'unreachable' | 'coordinator-refused';
type SendRefusal =
  | 'locked'
  | 'unknown-account'
  | 'self-send'
  | 'in-flight'
  | 'split-balance'
  | 'insufficient-token'
  | 'insufficient-sol'
  | 'simulation-failed'
  | 'simulation-mismatch'
  | 'sender-below-rent'
  | 'recipient-below-rent'
  | 'malformed'
  | Network;

export interface Engine {
  state(): Promise<Reply<WalletState, never>>;
  balances(account: string): Promise<Reply<Balances, 'malformed' | Network>>;
  prices(): Promise<Reply<Prices, Network>>;
  cached(account: string): Promise<Reply<Cached, 'malformed' | 'locked'>>;
  prepareSend(account: string, intent: Intent, challengeId?: string): Promise<Reply<Prepared, SendRefusal>>;
  preparedFor(account: string): Promise<Reply<Resumable | null, 'malformed'>>;
  send(id: string): Promise<Reply<Pending, 'malformed' | 'locked' | 'unknown-account' | 'unknown-prepared' | 'prepared-expired' | 'prepared-invalid' | 'reauth-required' | 'in-flight' | 'check-pending' | Network>>;
  resend(id: string): Promise<Reply<Pending, 'malformed' | 'unknown' | 'not-open' | 'too-soon' | Network>>;
  pending(): Promise<Reply<Pending[], never>>;
  history(account: string, before?: string): Promise<Reply<HistoryItem[], 'malformed' | Network>>;
  recipientInfo(account: string, recipient: string): Promise<Reply<RecipientInfo, 'malformed' | 'locked'>>;
  discardPrepared(account: string): Promise<Reply<null, 'malformed'>>;
  rename(index: number, name: string): Promise<Reply<null, 'malformed' | 'unknown-account' | 'busy'>>;
  select(index: number): Promise<Reply<null, 'malformed' | 'unknown-account'>>;
  settings(): Promise<Reply<Settings, never>>;
  lock(): Promise<Reply<null, never>>;
  ping(): Promise<Reply<null, never>>;
}

// ── Shape checks ──────────────────────────────────────────────────────────────────────────────
// Each returns the typed value or undefined (→ 'failed'). A value that passes is rebuilt field by
// field, so nothing the background did not promise reaches a screen.

type J = Record<string, unknown>;
const obj = (x: unknown): J | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as J) : undefined);
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const UNITS = /^\d{1,20}$/;
const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const isAddress = (x: unknown): x is string => typeof x === 'string' && ADDRESS.test(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isTime = isInt;
const isToken = (x: unknown): x is Token => typeof x === 'string' && TOKENS.includes(x);
const units = (x: unknown): bigint | undefined => (typeof x === 'string' && UNITS.test(x) ? BigInt(x) : undefined);
const price = (x: unknown): number | null | undefined => (x === null ? null : typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : undefined);
const oneOf = <T extends string>(x: unknown, values: readonly T[]): T | undefined => (typeof x === 'string' && (values as readonly string[]).includes(x) ? (x as T) : undefined);
function all<T>(xs: unknown, each: (x: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(xs)) return undefined;
  const out: T[] = [];
  for (const x of xs as unknown[]) {
    const v = each(x);
    if (v === undefined) return undefined;
    out.push(v);
  }
  return out;
}

function account(x: unknown): Account | undefined {
  const o = obj(x);
  if (o === undefined || !isInt(o.index) || typeof o.name !== 'string' || !isAddress(o.publicKey)) return undefined;
  return {index: o.index, name: o.name, publicKey: o.publicKey};
}

export function walletStateOf(x: unknown): WalletState | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.hasWallet !== 'boolean' || typeof o.unlocked !== 'boolean') return undefined;
  const scheme = o.scheme === null ? null : oneOf(o.scheme, ['slip10', 'cli'] as const);
  const accounts = all(o.accounts, account);
  const selected = o.selected === null ? null : isInt(o.selected) ? o.selected : undefined;
  if (scheme === undefined || accounts === undefined || selected === undefined) return undefined;
  return {hasWallet: o.hasWallet, unlocked: o.unlocked, scheme, accounts, selected};
}

function balancesOf(x: unknown): Balances | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  const [sol, noc, usdc, usdt] = [units(o.sol), units(o.noc), units(o.usdc), units(o.usdt)];
  if (sol === undefined || noc === undefined || usdc === undefined || usdt === undefined) return undefined;
  return {sol, noc, usdc, usdt};
}

function pricesOf(x: unknown): Prices | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  const [sol, usdc, usdt, noc] = [price(o.sol), price(o.usdc), price(o.usdt), price(o.noc)];
  if (sol === undefined || usdc === undefined || usdt === undefined || noc === undefined || !isTime(o.at)) return undefined;
  return {sol, usdc, usdt, noc, at: o.at};
}

function cachedOf(x: unknown): Cached | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  let balances: Cached['balances'] = null;
  if (o.balances !== null) {
    const b = balancesOf(o.balances);
    const at = obj(o.balances)?.at;
    if (b === undefined || !isTime(at)) return undefined;
    balances = {...b, at};
  }
  const prices = o.prices === null ? null : pricesOf(o.prices);
  if (prices === undefined) return undefined;
  return {balances, prices};
}

function intentOf(x: unknown): Intent | undefined {
  const o = obj(x);
  const amount = units(o?.amount);
  if (o === undefined || !isToken(o.token) || !isAddress(o.recipient) || amount === undefined) return undefined;
  return {token: o.token, recipient: o.recipient, amount};
}

const PROGRAMS = ['compute-budget', 'system', 'token', 'associated-token'] as const;
function simulationOf(x: unknown): Simulation | undefined {
  const o = obj(x);
  if (o === undefined || !isInt(o.slot) || !isInt(o.elapsedMs) || !isInt(o.instructions)) return undefined;
  const programs = all(o.programs, p => oneOf(p, PROGRAMS));
  const recipient = oneOf(o.recipient, ['wallet', 'new', 'program', 'other'] as const);
  const sol = obj(o.sol);
  const [before, after] = [units(sol?.before), units(sol?.after)];
  if (programs === undefined || recipient === undefined || before === undefined || after === undefined) return undefined;
  let token: Simulation['token'] = null;
  if (o.token !== null) {
    const t = obj(o.token);
    const symbol = oneOf(t?.symbol, ['NOC', 'USDC', 'USDT'] as const);
    const [tb, ta] = [units(t?.before), units(t?.after)];
    if (symbol === undefined || tb === undefined || ta === undefined) return undefined;
    token = {symbol, before: tb, after: ta};
  }
  return {slot: o.slot, elapsedMs: o.elapsedMs, instructions: o.instructions, programs, recipient, sol: {before, after}, token};
}

const REASONS = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new'] as const;
const FEE_REASONS = ['pre-tge', 'zero-fee-eligible', 'status-unknown', 'charged'] as const;
function preparedOf(x: unknown): Prepared | undefined {
  const o = obj(x);
  const f = obj(o?.fees);
  if (o === undefined || f === undefined || typeof o.id !== 'string' || !HEX32.test(o.id)) return undefined;
  const fees = {
    networkLamports: units(f.networkLamports),
    priorityLamports: units(f.priorityLamports),
    rentLamports: units(f.rentLamports),
    markupLamports: units(f.markupLamports),
    markupReason: oneOf(f.markupReason, FEE_REASONS),
  };
  const solRequiredLamports = units(o.solRequiredLamports);
  const simulation = simulationOf(o.simulation);
  let reauth: Prepared['reauth'] = null;
  if (o.reauth !== null) {
    const r = obj(o.reauth);
    const reasons = all(r?.reasons, v => oneOf(v, REASONS));
    if (r === undefined || typeof r.challengeId !== 'string' || !HEX32.test(r.challengeId) || reasons === undefined) return undefined;
    reauth = {challengeId: r.challengeId, reasons};
  }
  if (Object.values(fees).some(v => v === undefined) || solRequiredLamports === undefined || simulation === undefined) return undefined;
  return {id: o.id, fees: fees as Prepared['fees'], solRequiredLamports, reauth, simulation};
}

function resumableOf(x: unknown): Resumable | null | undefined {
  if (x === null) return null;
  const p = preparedOf(x);
  const o = obj(x);
  const intent = intentOf(o?.intent);
  if (p === undefined || intent === undefined || typeof o?.expired !== 'boolean') return undefined;
  return {...p, intent, expired: o.expired};
}

const STATES = ['pending', 'stuck', 'confirmed', 'failed', 'expired'] as const;
function pendingOf(x: unknown): Pending | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.id !== 'string' || !isAddress(o.account) || typeof o.signature !== 'string' || !SIGNATURE.test(o.signature)) return undefined;
  const state = oneOf(o.state, STATES);
  const intent = intentOf(o.intent);
  const failure = o.failure === null ? null : oneOf(o.failure, ['landed', 'not-sent'] as const);
  const expiry = o.expiryNullSeenAt === null ? null : isTime(o.expiryNullSeenAt) ? o.expiryNullSeenAt : undefined;
  if (state === undefined || intent === undefined || failure === undefined || expiry === undefined) return undefined;
  if (!isInt(o.lastValidBlockHeight) || !isTime(o.createdAt) || !isTime(o.lastSentAt) || !(o.detail === null || typeof o.detail === 'string')) return undefined;
  return {
    id: o.id,
    account: o.account,
    signature: o.signature,
    lastValidBlockHeight: o.lastValidBlockHeight,
    createdAt: o.createdAt,
    lastSentAt: o.lastSentAt,
    state,
    detail: o.detail,
    intent,
    expiryNullSeenAt: expiry,
    failure,
  };
}

function historyOf(x: unknown): HistoryItem | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.signature !== 'string' || !SIGNATURE.test(o.signature)) return undefined;
  const kind = oneOf(o.kind, ['sent', 'received', 'purchase', 'other'] as const);
  const token = o.token === null ? null : isToken(o.token) ? o.token : undefined;
  const amount = o.amount === null ? null : units(o.amount);
  const feeLamports = units(o.feeLamports);
  const blockTime = o.blockTime === null ? null : isInt(o.blockTime) ? o.blockTime : undefined;
  const mint = o.mint === null ? null : isAddress(o.mint) ? o.mint : undefined;
  const counterparty = o.counterparty === null ? null : isAddress(o.counterparty) ? o.counterparty : undefined;
  if (kind === undefined || token === undefined || amount === undefined || feeLamports === undefined || blockTime === undefined || mint === undefined || counterparty === undefined || typeof o.failed !== 'boolean') return undefined;
  return {signature: o.signature, blockTime, kind, token, mint, amount, counterparty, feeLamports, failed: o.failed};
}

function settingsOf(x: unknown): Settings | undefined {
  const o = obj(x);
  if (o === undefined || !isInt(o.autoLockMinutes) || !isInt(o.reauthUsdCents) || !isInt(o.selectedAccount)) return undefined;
  return {autoLockMinutes: o.autoLockMinutes, reauthUsdCents: o.reauthUsdCents, selectedAccount: o.selectedAccount};
}

function recipientInfoOf(x: unknown): RecipientInfo | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.known !== 'boolean' || typeof o.self !== 'boolean') return undefined;
  const lastSentAt = o.lastSentAt === null ? null : isTime(o.lastSentAt) ? o.lastSentAt : undefined;
  let label: RecipientInfo['label'] | undefined = null;
  if (o.label !== null) {
    const l = obj(o.label);
    if (l?.kind === 'treasury') label = {kind: 'treasury'};
    else if (l?.kind === 'own' && isInt(l.index) && typeof l.name === 'string') label = {kind: 'own', index: l.index, name: l.name};
    else label = undefined;
  }
  if (lastSentAt === undefined || label === undefined) return undefined;
  return {known: o.known, lastSentAt, label, self: o.self};
}

const nothing = (x: unknown): null | undefined => (x === undefined ? null : undefined);

// ── The transport ─────────────────────────────────────────────────────────────────────────────

export type Transport = (message: unknown) => Promise<unknown>;
export const RETRY_AFTER_MS = 300;

export function createEngine(transport: Transport = runtimeSend, sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))): Engine {
  /**
   * One retry is safe for every message, `wallet.send` included (review L5): a prepared id is single
   * use, so if the first attempt did reach the background, the retry answers `unknown-prepared`, and
   * the send screen's R2-M2 rule (spec §4.5) then looks in `wallet.pending` for the record the first
   * attempt wrote. Nothing is ever signed twice. Do not "fix" this by skipping the retry for sends.
   */
  async function ask(message: unknown): Promise<unknown> {
    try {
      return await transport(message);
    } catch {
      // The service worker was restarting: once more, then give up.
      await sleep(RETRY_AFTER_MS);
      return transport(message);
    }
  }

  async function call<T, C extends string>(message: J, codes: readonly C[], parse: (data: unknown) => T | undefined): Promise<Reply<T, C>> {
    let raw: unknown;
    try {
      raw = await ask(message);
    } catch {
      return {ok: false, error: 'failed'};
    }
    const r = obj(raw);
    if (r?.ok === true) {
      const data = parse(r.data);
      return data === undefined ? {ok: false, error: 'failed'} : {ok: true, data};
    }
    if (r?.ok === false && typeof r.error === 'string' && (codes as readonly string[]).includes(r.error)) {
      return r.data === undefined ? {ok: false, error: r.error as C} : {ok: false, error: r.error as C, data: r.data};
    }
    return {ok: false, error: 'failed'};
  }

  const NET = ['unreachable', 'coordinator-refused'] as const;
  const SEND_PREPARE = [
    'locked', 'unknown-account', 'self-send', 'in-flight', 'split-balance', 'insufficient-token', 'insufficient-sol', 'simulation-failed',
    'simulation-mismatch', 'sender-below-rent', 'recipient-below-rent', 'malformed', ...NET,
  ] as const;
  const SEND = ['malformed', 'locked', 'unknown-account', 'unknown-prepared', 'prepared-expired', 'prepared-invalid', 'reauth-required', 'in-flight', 'check-pending', ...NET] as const;
  const wire = (i: Intent) => ({token: i.token, recipient: i.recipient, amount: i.amount.toString()});

  return {
    state: () => call({type: 'wallet.state'}, [], walletStateOf),
    balances: account => call({type: 'wallet.balances', account}, ['malformed', ...NET], balancesOf),
    prices: () => call({type: 'wallet.prices'}, NET, pricesOf),
    cached: account => call({type: 'wallet.cached', account}, ['malformed', 'locked'], cachedOf),
    prepareSend: (account, intent, challengeId) =>
      call({type: 'wallet.prepareSend', account, intent: wire(intent), ...(challengeId === undefined ? {} : {challengeId})}, SEND_PREPARE, preparedOf),
    preparedFor: account => call({type: 'wallet.preparedFor', account}, ['malformed'], resumableOf),
    send: id => call({type: 'wallet.send', id}, SEND, pendingOf),
    resend: id => call({type: 'wallet.resend', id}, ['malformed', 'unknown', 'not-open', 'too-soon', ...NET], pendingOf),
    pending: () => call({type: 'wallet.pending'}, [], d => all(d, pendingOf)),
    history: (account, before) => call({type: 'wallet.history', account, ...(before === undefined ? {} : {before})}, ['malformed', ...NET], d => all(d, historyOf)),
    recipientInfo: (account, recipient) => call({type: 'wallet.recipientInfo', account, recipient}, ['malformed', 'locked'], recipientInfoOf),
    discardPrepared: account => call({type: 'wallet.discardPrepared', account}, ['malformed'], nothing),
    rename: (index, name) => call({type: 'accounts.rename', index, name}, ['malformed', 'unknown-account', 'busy'], nothing),
    select: index => call({type: 'accounts.select', index}, ['malformed', 'unknown-account'], nothing),
    settings: () => call({type: 'settings.get'}, [], settingsOf),
    lock: () => call({type: 'vault.lock'}, [], nothing),
    ping: () => call({type: 'activity.ping'}, [], nothing),
  };
}
```

Create `extension/src/app/format.ts`:

```ts
import {formatAmount} from '../shared/amount';
import type {Token} from './engine';

/** Decimals and display precision per token (the design: "62.4821 SOL", "4,200.00 NOC", "740.21 USDC"). */
export const TOKEN_INFO: Record<Token, {decimals: number; name: string; min: number; max: number}> = {
  SOL: {decimals: 9, name: 'Solana', min: 4, max: 4},
  NOC: {decimals: 9, name: 'Noctura', min: 2, max: 2},
  USDC: {decimals: 6, name: 'USD Coin', min: 2, max: 2},
  USDT: {decimals: 6, name: 'Tether', min: 2, max: 2},
};

/** A balance as the design shows it: truncated, never rounded up. */
export const showAmount = (token: Token, base: bigint): string => formatAmount(base, TOKEN_INFO[token].decimals, TOKEN_INFO[token].min === 4 ? {min: 4, max: 4} : {min: 2, max: 2});
/** Lamports shown in full precision ("0.000005"), for fees. */
export const showSol = (lamports: bigint): string => formatAmount(lamports, 9, {min: 0, max: 9});

/** "$14,881.19" split as the hero draws it: whole part and cents. */
export function usdParts(usd: number): {whole: string; cents: string} {
  const cents = Math.floor(usd * 100 + 1e-9);
  const whole = Math.floor(cents / 100).toLocaleString('en-US');
  return {whole: `$${whole}`, cents: `.${String(cents % 100).padStart(2, '0')}`};
}
export const showUsd = (usd: number): string => {
  const p = usdParts(usd);
  return `${p.whole}${p.cents}`;
};

/** The first four and the last four characters, at equal weight — a scanning aid in lists only (spec §11.7). */
export const shortAddress = (a: string): string => `${a.slice(0, 4)}…${a.slice(-4)}`;
/** The first two groups of four, then "…" (the account switcher). */
export const twoGroups = (a: string): string => `${a.slice(0, 4)} ${a.slice(4, 8)}…`;

/** "2 s ago", "2 min ago", "2 h ago", "3 d ago". */
export function ago(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "2 min 18 s ago" — the sustained-offline line. */
export function agoLong(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return `${s} s ago`;
  return `${Math.floor(s / 60)} min ${s % 60} s ago`;
}

/** Local wall-clock time "09:41:13" (UTC stored, local only at the UI layer — cardinal rule 3). */
export const clock = (at: number): string => {
  const d = new Date(at);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
};

/** "9:14 AM", local. */
export const timeOfDay = (at: number): string => new Date(at).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});

/** "May 8 2026 · 9:14 AM", local. */
export function fullDate(at: number): string {
  const d = new Date(at);
  return `${d.toLocaleDateString('en-US', {month: 'short'})} ${d.getDate()} ${d.getFullYear()} · ${timeOfDay(at)}`;
}

const startOfDay = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * The activity list's section headers (#26), local time: "TODAY · MAY 8", "YESTERDAY · MAY 7",
 * "THIS WEEK", "THIS MONTH", then "APRIL 2026"-style month headers. A transaction with no block time
 * yet is "TODAY".
 */
export function dateSection(at: number | null, now: number): string {
  if (at === null) return `TODAY · ${new Date(now).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}).toUpperCase()}`;
  const day = startOfDay(at);
  const today = startOfDay(now);
  const label = (t: number) => new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}).toUpperCase();
  if (day === today) return `TODAY · ${label(at)}`;
  // Calendar days, not 24 h steps: a daylight-saving day is 23 or 25 hours long.
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === yesterday.getTime()) return `YESTERDAY · ${label(at)}`;
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  if (day >= weekAgo.getTime()) return 'THIS WEEK';
  const a = new Date(at);
  const n = new Date(now);
  if (a.getFullYear() === n.getFullYear() && a.getMonth() === n.getMonth()) return 'THIS MONTH';
  return a.toLocaleDateString('en-US', {month: 'long', year: 'numeric'}).toUpperCase();
}
```

Create `extension/src/app/platform.ts`:

```ts
/**
 * The popup's and the tab's calls to the browser (spec B1b-2a §1.3): open an extension page, close
 * this window, read the version. Never storage (scripts/check-vault-isolation.mjs forbids it outside
 * the background) and never a runtime listener (only the background listens). The one external link,
 * Solscan, is an <a> (screens/TxDetail.tsx), not a call here.
 */
interface PlatformApi {
  runtime: {getURL(path: string): string; getManifest(): {version: string}};
  tabs: {create(o: {url: string}): Promise<unknown> | void};
}

/** Every extension page the UI opens. A closed list: nothing here builds a URL from data. */
export type ExtensionPage = 'unlock.html?mode=welcome' | 'unlock.html?mode=unlock' | 'unlock.html?mode=accounts';

export interface Platform {
  openPage(page: ExtensionPage): void;
  closeWindow(): void;
  version(): string;
}

function api(): PlatformApi {
  const g = globalThis as unknown as {browser?: PlatformApi; chrome?: PlatformApi};
  const b = g.browser ?? g.chrome;
  if (b === undefined) throw new Error('not running in an extension');
  return b;
}

export const browserPlatform: Platform = {
  openPage: page => {
    void Promise.resolve(api().tabs.create({url: api().runtime.getURL(page)})).catch((e: unknown) => console.warn('tab not opened', e));
  },
  closeWindow: () => window.close(),
  version: () => api().runtime.getManifest().version,
};
```

Create `extension/src/app/prefs.ts`:

```ts
/**
 * UI-only preferences in this page's localStorage (spec S4): no security meaning, per viewer,
 * allowed to vanish. Every access is wrapped — a blocked or private store must never break a screen.
 */
export const HIDE_BALANCES_KEY = 'noctura.ui.v1.hideBalances';
export const ACTIVITY_FILTER_KEY = 'noctura.ui.v1.activityFilter';

export function readPref(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Not remembered: fine for a preference.
  }
}
```

Create `extension/src/app/useNow.ts`:

```ts
import {useEffect, useState} from 'react';

const systemNow = (): number => Date.now();

/** The current time, re-read every `ms` — for "cached 2 s ago" and the offline counters. */
export function useNow(ms = 1_000, now: () => number = systemNow): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    const i = setInterval(() => setT(now()), ms);
    return () => clearInterval(i);
  }, [ms, now]);
  return t;
}
```

Create `extension/src/app/valuation.ts`:

```ts
import {marketTotalUsd, valueHoldings} from '../../../core/portfolio/value';
import type {Balances, Prices, Token} from './engine';

export interface TokenValue {
  token: Token;
  base: bigint;
  /** USD, or null when no price is known — never 0 (core/portfolio/value.ts). */
  usd: number | null;
  /** 'stage' for NOC: the presale stage price, labelled "at stage price", never in the total. */
  basis: 'market' | 'stage';
}

/**
 * The dashboard's numbers (spec §5.1, parent §4): each token's USD value, and the market total —
 * SOL + USDC + USDT only. NOC is valued at the stage price and kept out of the total, exactly as
 * web/ does (core/portfolio/value.ts). A total with no market price at all is null, shown as "—".
 */
export function valuation(b: Balances, p: Prices | null): {total: number | null; rows: Record<Token, TokenValue>} {
  const market = valueHoldings({sol: b.sol, noc: null, usdc: b.usdc, usdt: b.usdt}, {solana: p?.sol ?? undefined, usdc: p?.usdc ?? undefined, usdt: p?.usdt ?? undefined}, 0);
  const usdOf = (symbol: string): number | null => market.find(v => v.symbol === symbol)?.usd ?? null;
  const nocUsd = p?.noc == null ? null : valueHoldings({sol: null, noc: b.noc, usdc: null, usdt: null}, {}, p.noc)[0]?.usd ?? null;
  return {
    total: marketTotalUsd(market),
    rows: {
      SOL: {token: 'SOL', base: b.sol, usd: usdOf('SOL'), basis: 'market'},
      NOC: {token: 'NOC', base: b.noc, usd: nocUsd, basis: 'stage'},
      USDC: {token: 'USDC', base: b.usdc, usd: b.usdc === 0n ? (p?.usdc == null ? null : 0) : usdOf('USDC'), basis: 'market'},
      USDT: {token: 'USDT', base: b.usdt, usd: b.usdt === 0n ? (p?.usdt == null ? null : 0) : usdOf('USDT'), basis: 'market'},
    },
  };
}
```

Create `extension/src/shared/amount.ts`:

```ts
/**
 * Token amounts as text, exactly (cardinal rule 2): base units are a bigint, never a float. Pure, and
 * stand-alone (scripts/check-vault-isolation.mjs STANDALONE): the vault page imports it too, so it
 * may import nothing.
 */

/** "12.5" with 6 decimals → 12 500 000n. Null for anything but digits with at most `decimals` places. */
export function parseAmount(text: string, decimals: number): bigint | null {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) return null;
  const pattern = decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`);
  if (!pattern.test(text)) return null;
  const [whole = '0', frac = ''] = text.split('.');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

/**
 * Base units → "4,200.00". The fraction keeps between `min` and `max` digits and is TRUNCATED, never
 * rounded: a balance is never shown as more than it is. Thousands are grouped with ",".
 */
export function formatAmount(base: bigint, decimals: number, opts: {min: number; max: number}): string {
  const negative = base < 0n;
  const abs = negative ? -base : base;
  const scale = 10n ** BigInt(decimals);
  const whole = (abs / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let frac = (abs % scale).toString().padStart(decimals, '0').slice(0, Math.min(opts.max, decimals));
  while (frac.length > opts.min && frac.endsWith('0')) frac = frac.slice(0, -1);
  return `${negative ? '-' : ''}${whole}${frac.length > 0 ? `.${frac}` : ''}`;
}
```

Modify `extension/tsconfig.json`:

```diff
diff --git a/extension/tsconfig.json b/extension/tsconfig.json
--- a/extension/tsconfig.json
+++ b/extension/tsconfig.json
@@ -1,25 +1,81 @@
 {
   "compilerOptions": {
     "target": "ES2022",
-    "lib": ["ES2022", "DOM", "WebWorker"],
+    "lib": [
+      "ES2022",
+      "DOM",
+      "DOM.Iterable",
+      "WebWorker"
+    ],
     "module": "ESNext",
     "moduleResolution": "bundler",
     "strict": true,
     "noUnusedLocals": true,
     "noUncheckedIndexedAccess": true,
     "skipLibCheck": true,
-    "types": ["vitest/globals", "node"],
+    "types": [
+      "vitest/globals",
+      "node",
+      "vite/client"
+    ],
     "baseUrl": ".",
     "paths": {
-      "@noble/curves/*": ["./node_modules/@noble/curves/*"],
-      "@noble/hashes/*": ["./node_modules/@noble/hashes/*"],
-      "@scure/base": ["./node_modules/@scure/base"],
-      "@scure/bip39": ["./node_modules/@scure/bip39"],
-      "@scure/bip39/*": ["./node_modules/@scure/bip39/*"],
-      "micro-key-producer/*": ["./node_modules/micro-key-producer/*"],
-      "@solana/web3.js": ["./node_modules/@solana/web3.js"],
-      "buffer": ["./node_modules/buffer"]
-    }
+      "@noble/curves/*": [
+        "./node_modules/@noble/curves/*"
+      ],
+      "@noble/hashes/*": [
+        "./node_modules/@noble/hashes/*"
+      ],
+      "@scure/base": [
+        "./node_modules/@scure/base"
+      ],
+      "@scure/bip39": [
+        "./node_modules/@scure/bip39"
+      ],
+      "@scure/bip39/*": [
+        "./node_modules/@scure/bip39/*"
+      ],
+      "micro-key-producer/*": [
+        "./node_modules/micro-key-producer/*"
+      ],
+      "@solana/web3.js": [
+        "./node_modules/@solana/web3.js"
+      ],
+      "buffer": [
+        "./node_modules/buffer"
+      ],
+      "react": [
+        "./node_modules/@types/react"
+      ],
+      "react/*": [
+        "./node_modules/@types/react/*"
+      ],
+      "react-dom": [
+        "./node_modules/@types/react-dom"
+      ],
+      "react-dom/*": [
+        "./node_modules/@types/react-dom/*"
+      ],
+      "@testing-library/react": [
+        "./node_modules/@testing-library/react"
+      ],
+      "qrcode-generator": [
+        "./node_modules/qrcode-generator"
+      ]
+    },
+    "jsx": "react-jsx"
   },
-  "include": ["src", "e2e", "../core/keys", "../core/util", "../core/solana", "../core/fees", "../core/portfolio"]
+  "include": [
+    "src",
+    "e2e",
+    "../core/keys",
+    "../core/util",
+    "../core/solana",
+    "../core/fees",
+    "../core/portfolio",
+    "../web/src/ui/AddressGroups.tsx",
+    "../web/src/ui/CopyButton.tsx",
+    "../web/src/ui/Icon.tsx",
+    "../web/src/ui/BrandMark.tsx"
+  ]
 }
```

Modify `extension/vite.config.ts`:

```diff
diff --git a/extension/vite.config.ts b/extension/vite.config.ts
--- a/extension/vite.config.ts
+++ b/extension/vite.config.ts
@@ -1,20 +1,22 @@
 import {defineConfig, type Plugin} from 'vite';
 import type {UserConfig} from 'vitest/config';
+import react from '@vitejs/plugin-react';
 import {resolve, sep} from 'node:path';
 
-// core/ is imported by relative path, and a bare import in a core/ file would otherwise resolve
-// upwards from core/ — to the repository root's node_modules (the app's copies) locally, and to
-// nothing in CI, which installs only extension/. This resolves every bare import made BY a core/
-// file as if it were made from this package, and touches nothing else: a dependency's own imports
-// (@solana/web3.js 1.x needs @noble v1, this package has v2) resolve normally, next to it.
-const CORE = resolve(__dirname, '../core');
+// core/ and web/src/ui/ are imported by relative path, and a bare import in one of their files would
+// otherwise resolve upwards from there — to web/node_modules or the repository root's node_modules
+// locally (a second React: hooks break), and to nothing in CI, which installs only extension/. This
+// resolves every bare import made BY a core/ or web/src/ui/ file as if it were made from this package,
+// and touches nothing else: a dependency's own imports (@solana/web3.js 1.x needs @noble v1, this
+// package has v2) resolve normally, next to it.
+const SHARED = [resolve(__dirname, '../core'), resolve(__dirname, '../web/src/ui')];
 const HERE = resolve(__dirname, 'package.json');
-function coreResolvesFromHere(): Plugin {
+function sharedResolvesFromHere(): Plugin {
   return {
-    name: 'noctura:core-resolves-from-extension',
+    name: 'noctura:shared-resolves-from-extension',
     enforce: 'pre',
     async resolveId(source, importer, options) {
-      if (importer === undefined || !importer.startsWith(CORE + sep)) return null;
+      if (importer === undefined || !SHARED.some(dir => importer.startsWith(dir + sep))) return null;
       if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null;
       return this.resolve(source, HERE, {...options, skipSelf: true});
     },
@@ -23,7 +25,7 @@ function coreResolvesFromHere(): Plugin {
 
 export default defineConfig({
   base: './',
-  plugins: [coreResolvesFromHere()],
+  plugins: [sharedResolvesFromHere(), react()],
   server: {fs: {allow: [resolve(__dirname, '..')]}},
   build: {
     outDir: 'dist/app',
@@ -46,10 +48,13 @@ export default defineConfig({
   },
   worker: {format: 'es'},
   test: {
+    // node by default; the component tests say `// @vitest-environment happy-dom` on their first line
+    // (vitest 5 has no environmentMatchGlobs).
     environment: 'node',
     globals: true,
     include: [
       'src/**/*.test.ts',
+      'src/**/*.test.tsx',
       'manifest/**/*.test.mjs',
       'scripts/**/*.test.mjs',
       '../core/keys/**/*.test.ts',
```

Install the packages with npm **11.6.2** (the CI pin, which writes the lockfile), without install scripts:

```bash
npm install --ignore-scripts --save-exact react@18.3.1 react-dom@18.3.1 qrcode-generator@2.0.4
npm install --ignore-scripts --save-dev @vitejs/plugin-react@^6.1.1 @testing-library/react@^16.3.0 @testing-library/dom@^10.4.0 happy-dom@^20.14.5 @types/react@^18.3.3 @types/react-dom@^18.3.0
```
`package.json` must end as the diff above shows; `package-lock.json` is npm's (commit it). `npm audit --audit-level=high` still exits 0 (4 moderate advisories, all in `@solana/web3.js`'s tree, unchanged).

Copy the two fonts web/ serves (spec §1.3: "The two files are copied into `extension/public/fonts/`"):

```bash
mkdir -p public/fonts && cp ../web/public/fonts/Geist-Variable.woff2 ../web/public/fonts/GeistMono-Variable.woff2 public/fonts/
sha256sum public/fonts/*.woff2
```
Expected: `a369fcf5628ea2aa4e1b9e2ec6a5b3624e365bda588e1f0f2f12b564f728fbb8  public/fonts/Geist-Variable.woff2` and `fba8f577f38a2bbcbe818efa6348dd58f36303a10b8737c42fefad275be563ab  public/fonts/GeistMono-Variable.woff2`.

Create `extension/src/styles/design-ext.css` by extraction — the design's own rules, not a hand copy (spec §1.2: "copied from `index.html`'s `<style>` under the same class names"). Save this one-off script outside the repository (it is not committed) and run it **from the repository root**:

```js
// One-off: copy the design classes web/'s design-system.css lacks out of the owner's design file,
// under the same class names (spec B1b-2a §1.2, §1.7). Reads /home/user/Downloads/index.html,
// writes extension/src/styles/design-ext.css. Run from the repository root; not committed.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const lines = readFileSync('/home/user/Downloads/index.html', 'utf8').split('\n');
// The first <style> block: line 10 opens it, line 4306 closes it; its body is lines 11–4305.
if (!lines[9].startsWith('<style>') || !lines[4305].includes('</style>')) throw new Error('index.html changed: re-check the <style> block bounds');
const css = lines.slice(10, 4305).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

// Top-level rules, split on brace depth.
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

const PREFIXES = ['.screen', '.top-bar', '.sticky-bar', '.scroll-area', '.banner', '.s-dash', '.s-recv', '.s-act', '.s-txd', '.s-vi-top', '.tx-row',
  '.s7-list', '.s7-group-label', '.s7-row', '.s7-wordmark', '.s8-sheet', '.s8-sheet-overlay', '.s8-token-row', '.s8-tok', '.s8-offline-banner',
  '.s8-stale', '.s8-stale-mark', '.s8-empty-illust', '.s8-empty-copy', '.tab-bar', '.chip-row', '.copy-toast', '.skel-line', '.skel-circle', '.skel-tile', '.skel-block'];
const KEYFRAMES = ['shimmer', 'spin', 'shake'];
const selectorOf = r => r.slice(0, r.indexOf('{')).trim();
const matches = s => PREFIXES.some(p => s === p || [' ', '.', ':', '[', '>'].some(c => s.startsWith(p + c)) || (p.endsWith('-') && s.startsWith(p)));

let out = rules.filter(r => {
  const sel = selectorOf(r);
  if (sel.startsWith('@keyframes')) return KEYFRAMES.includes(sel.split(/\s+/)[1]);
  if (sel.startsWith('@')) return false;
  return sel.split(',').map(x => x.trim()).every(matches);
});
// One @keyframes per name: the last wins in CSS, so keep only that one.
const lastKeyframe = new Map(out.map((r, i) => [selectorOf(r), i]).filter(([s]) => s.startsWith('@keyframes')));
out = out.filter((r, i) => !selectorOf(r).startsWith('@keyframes') || lastKeyframe.get(selectorOf(r)) === i).map(r => r.replace(/\n\s*\n/g, '\n'));

const header = `/*
 * The design classes web/src/styles/design-system.css lacks, copied from the owner's design file
 * (/home/user/Downloads/index.html, its first <style> block) under the SAME class names, rule for
 * rule, comments and blank lines removed (spec B1b-2a §1.2, §1.7). Generated once by the plan's
 * extraction step; edit by re-running it against the design, never by hand, so the two cannot drift.
 * Tokens come from design-system.css, which every page imports first.
 */
:root { --inset-top: 0px; --inset-bottom: 0px; }
`;
mkdirSync('extension/src/styles', {recursive: true});
writeFileSync('extension/src/styles/design-ext.css', `${header}${out.join('\n')}\n`);
```

```bash
node /path/to/extract-design-css.mjs
sha256sum extension/src/styles/design-ext.css; wc -l extension/src/styles/design-ext.css
```
Expected: `22f5aec5eda5e20061c0875b6170f90b3c341e092e2e75f36d5a5488c0383771` and `611`. A different hash means the design file changed since this plan: stop and ask the controller (the classes the screens use must exist). The file carries the design's shielded rules too (`data-mode="shielded"` variants); nothing in B1b-2a sets that mode (D4).

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/shared/__tests__/amount.test.ts src/app/__tests__/engine.test.ts src/app/__tests__/format.test.ts`
Expected: PASS — 3 files, 27 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 66 files, 830 tests.

- [ ] **Step 6: Build and the gates.**

Run: `rm -rf dist && npm run build && npm run gates`
Expected: `permissions ok…`, `vault isolation ok…`, `rpc methods ok…`, `no TGE date: … files checked` — exit 0.

- [ ] **Step 7: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **accept numbers as amounts:** in `engine.ts`, make `units` accept `typeof x === 'number'` too (`BigInt(x)` for either). Run `npx vitest run src/app/__tests__/engine.test.ts` → RED: 2 failed.
  - **no retry:** in `ask()`, replace the `catch` body with `throw new Error('no retry');`. Run `npx vitest run src/app/__tests__/engine.test.ts` → RED: 2 failed.
  - **NOC in the total:** in `valuation.ts`, replace `total: marketTotalUsd(market),` with `total: (marketTotalUsd(market) ?? 0) + (nocUsd ?? 0),`. Run `npx vitest run src/app/__tests__/format.test.ts` → RED: 2 failed.

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/package-lock.json extension/package.json extension/public/fonts/Geist-Variable.woff2 extension/public/fonts/GeistMono-Variable.woff2 extension/src/app/__tests__/engine.test.ts extension/src/app/__tests__/format.test.ts extension/src/app/engine.ts extension/src/app/format.ts extension/src/app/platform.ts extension/src/app/prefs.ts extension/src/app/useNow.ts extension/src/app/valuation.ts extension/src/shared/__tests__/amount.test.ts extension/src/shared/amount.ts extension/src/styles/design-ext.css extension/tsconfig.json extension/vite.config.ts
git commit -m "feat(extension): React 18 and the UI foundation — shared resolution, design classes, the message client (B1b-2a §1.3, §1.5)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 11: The shared UI components

**Files:**
- Create: `extension/src/app/ui/Banner.tsx`
- Create: `extension/src/app/ui/Chip.tsx`
- Create: `extension/src/app/ui/ExtIcon.tsx`
- Create: `extension/src/app/ui/ListRow.tsx`
- Create: `extension/src/app/ui/LockedButton.tsx`
- Create: `extension/src/app/ui/QrCode.tsx`
- Create: `extension/src/app/ui/Sheet.tsx`
- Create: `extension/src/app/ui/Skeleton.tsx`
- Create: `extension/src/app/ui/StatusPill.tsx`
- Create: `extension/src/app/ui/TabBar.tsx`
- Create: `extension/src/app/ui/Toast.tsx`
- Create: `extension/src/app/ui/TokenTile.tsx`
- Create: `extension/src/app/ui/TopBar.tsx`
- Create: `extension/src/app/ui/useCopy.ts`
- Test (create): `extension/src/app/__tests__/LockedButton.test.tsx`
- Test (create): `extension/src/app/__tests__/ui.test.tsx`

**Interfaces:**
- Consumes: Task 10's packages and design classes.
- Produces:
  - `ui/ExtIcon.tsx`: `type ExtIconName`, `ExtIcon({name, size?, label?})`
  - `ui/LockedButton.tsx`: `LOCK_MS = 500`, `LockedButton({onPress, children, className?, disabled?, label?, wait?})`
  - `ui/Banner.tsx`: `Banner({tone, title, children?, icon?})`, `REFUSED_TEXT`, `RefusedBanner()`
  - `ui/Toast.tsx`: `Toast({text, onDone, ms?})`; `ui/Skeleton.tsx`: `SkelLine`, `SkelCircle`; `ui/Chip.tsx`: `ChipRow({options, active, onChange, label})`; `ui/StatusPill.tsx`: `StatusPill({text, fail?})`; `ui/ListRow.tsx`: `ListRow({icon, title, meta?, onPress, danger?})`; `ui/TabBar.tsx`: `type Tab = 'home' | 'activity' | 'settings'`, `TabBar({active, onChange})`; `ui/TokenTile.tsx`: `TokenTile({token, size?})`; `ui/TopBar.tsx`: `TopBar({title, onBack?, trailing?, titleClass?})`; `ui/Sheet.tsx`: `Sheet({title, onClose, children})`; `ui/QrCode.tsx`: `QrCode({value, label})`; `ui/useCopy.ts`: `type CopyState`, `useCopy(): [CopyState, (value: string) => void]`

Spec §1.3's extension-local components, each in the design's classes: `ExtIcon` (the glyphs `web/src/ui/Icon.tsx` lacks, copied path-for-path from the design's sprite; `pencil` drawn in the same style), `LockedButton` (§7.6 rule 6: a ref guards the same-frame double click, the disabled state the rest, released no earlier than 500 ms **and** after the action settles), `Banner` (with the D26 text), `Toast`, `Skeleton`, `ChipRow`, `StatusPill`, `ListRow` (`.s7-row`), `TabBar` (D3), `TokenTile` (synthetic, no third-party logos), `TopBar`, `Sheet` (`.s8-sheet`: Esc, backdrop and grabber close it, focus trap, focus returned), `QrCode` (S6: our own SVG from `qrcode-generator`'s matrix, error correction H for the centre mark), `useCopy` (CopyButton's honesty: "Copied" only when the clipboard accepted it). `StepHeader` arrives with its first user (plan 2/3).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/LockedButton.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, render, screen} from '@testing-library/react';
import {LOCK_MS, LockedButton} from '../ui/LockedButton';

// Cardinal rule 6 / spec §7.6: disabled synchronously on the click; back no earlier than 500 ms after
// it AND not before the action settles.
describe('LockedButton', () => {
  function setup(action: () => Promise<unknown>) {
    let release: () => void = () => undefined;
    const wait = () => new Promise<void>(r => (release = r));
    const onPress = vi.fn(action);
    render(
      <LockedButton onPress={onPress} wait={wait}>
        Save
      </LockedButton>,
    );
    return {onPress, button: screen.getByRole('button', {name: 'Save'}) as HTMLButtonElement, floor: () => act(async () => release())};
  }

  it('a second click inside 500 ms does nothing', async () => {
    const {onPress, button, floor} = setup(async () => undefined);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await floor();
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('a second click after 500 ms but before the action settles does nothing', async () => {
    let settle: () => void = () => undefined;
    const {onPress, button, floor} = setup(() => new Promise<void>(r => (settle = r)));
    fireEvent.click(button);
    await floor();
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => settle());
    expect(button.disabled).toBe(false);
  });

  it('two clicks in the same frame, before React re-renders the button disabled: the second does nothing', async () => {
    const {onPress, button, floor} = setup(async () => undefined);
    act(() => {
      button.click();
      button.click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    await floor();
  });

  it('holds for LOCK_MS = 500 by default', () => {
    expect(LOCK_MS).toBe(500);
  });
});
```

Create `extension/src/app/__tests__/ui.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {Sheet} from '../ui/Sheet';
import {QrCode} from '../ui/QrCode';
import {Banner, REFUSED_TEXT, RefusedBanner} from '../ui/Banner';
import {TabBar} from '../ui/TabBar';
import {Toast} from '../ui/Toast';
import {ChipRow} from '../ui/Chip';
import {useCopy} from '../ui/useCopy';

// Spec §1.3: the extension-local components, each doing what the screens rely on.
describe('Sheet (#43’s sheet)', () => {
  it('a dialog with its title; Esc, the backdrop, the grabber and the close button all close it', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Accounts" onClose={onClose}>
        <button type="button">Inside</button>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', {name: 'Accounts'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    for (const b of screen.getAllByRole('button', {name: 'Close'})) fireEvent.click(b);
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('traps focus: Tab from the last control returns to the first, Shift+Tab from the first goes to the last', () => {
    render(
      <Sheet title="Accounts" onClose={() => undefined}>
        <button type="button">Last</button>
      </Sheet>,
    );
    const [grabber] = screen.getAllByRole('button', {name: 'Close'});
    const last = screen.getByRole('button', {name: 'Last'});
    expect(document.activeElement).toBe(grabber);
    last.focus();
    fireEvent.keyDown(document, {key: 'Tab'});
    expect(document.activeElement).toBe(grabber);
    fireEvent.keyDown(document, {key: 'Tab', shiftKey: true});
    expect(document.activeElement).toBe(last);
  });

  it('gives focus back to where it was when it closes', () => {
    const {rerender} = render(<button type="button">Opener</button>);
    const opener = screen.getByRole('button', {name: 'Opener'});
    opener.focus();
    rerender(
      <>
        <button type="button">Opener</button>
        <Sheet title="Accounts" onClose={() => undefined}>
          <span />
        </Sheet>
      </>,
    );
    expect(document.activeElement).not.toBe(opener);
    rerender(<button type="button">Opener</button>);
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Opener'}));
  });
});

describe('QrCode (S6)', () => {
  it('draws the payload’s modules as one SVG path, with a quiet zone, and says what it encodes', () => {
    render(<QrCode value="solana:HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk" label="QR code for receive" />);
    const svg = screen.getByRole('img', {name: 'QR code for receive'});
    expect(svg.getAttribute('data-qr')).toBe('solana:HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    const size = Number(svg.getAttribute('viewBox')?.split(' ')[2]);
    // Version ≥ 4 at error correction H for this payload: 33+ modules, plus 4 quiet modules each side.
    expect(size).toBeGreaterThanOrEqual(41);
    expect((svg.querySelector('path')?.getAttribute('d') ?? '').length).toBeGreaterThan(1000);
  });

  it('a different payload draws a different code', () => {
    const {rerender} = render(<QrCode value="solana:a" label="q" />);
    const first = screen.getByRole('img').querySelector('path')?.getAttribute('d');
    rerender(<QrCode value="solana:b" label="q" />);
    expect(screen.getByRole('img').querySelector('path')?.getAttribute('d')).not.toBe(first);
  });
});

describe('Banner, TabBar, Toast, ChipRow', () => {
  it('Banner: info is a status, warning an alert; the D26 text is exact', () => {
    render(<Banner tone="info" title="Heads up" />);
    expect(screen.getByRole('status').textContent).toBe('Heads up');
    render(<RefusedBanner />);
    expect(screen.getByRole('alert').textContent).toBe(REFUSED_TEXT);
    expect(REFUSED_TEXT).toBe('The server is not answering for now — try again in 10 minutes.');
  });

  it('TabBar: Home / Activity / Settings (D3), the active one marked', () => {
    const onChange = vi.fn();
    render(<TabBar active="activity" onChange={onChange} />);
    const tabs = screen.getAllByRole('button');
    expect(tabs.map(t => t.textContent)).toEqual(['Home', 'Activity', 'Settings']);
    expect(tabs[1]?.getAttribute('aria-current')).toBe('page');
    fireEvent.click(tabs[2] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('settings');
  });

  it('Toast: shown, then gone after its time', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast text="Copied." onDone={onDone} ms={1800} />);
    expect(screen.getByRole('status').textContent).toContain('Copied.');
    await act(async () => vi.advanceTimersByTime(1799));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('ChipRow: one selected, a click chooses', () => {
    const onChange = vi.fn();
    render(<ChipRow label="Filter" options={[{value: 'a', text: 'A'}, {value: 'b', text: 'B'}]} active="a" onChange={onChange} />);
    expect(screen.getByRole('tab', {name: 'A'}).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', {name: 'B'}));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('useCopy (CopyButton’s honesty)', () => {
  function Probe() {
    const [state, copy] = useCopy();
    return (
      <button type="button" onClick={() => copy('abc')}>
        {state}
      </button>
    );
  }
  const clipboard = (writeText: unknown) => Object.defineProperty(navigator, 'clipboard', {value: writeText === undefined ? undefined : {writeText}, configurable: true});

  it('copied only when the clipboard accepted it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('copied'));
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('failed when it refused, and when there is no clipboard at all', async () => {
    clipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const {unmount} = render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('failed'));
    unmount();
    clipboard(undefined);
    render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('failed');
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/LockedButton.test.tsx src/app/__tests__/ui.test.tsx`
Expected: FAIL — `Failed to resolve import "../ui/Sheet"` (and `../ui/LockedButton`).

- [ ] **Step 3: Implement.**

Create `extension/src/app/ui/Banner.tsx`:

```tsx
import type {ReactNode} from 'react';
import {ExtIcon, type ExtIconName} from './ExtIcon';

/** The design's `.banner` (info | warning | danger), icon + title + optional line. */
export function Banner({tone, title, children, icon}: {tone: 'info' | 'warning' | 'danger'; title: string; children?: ReactNode; icon?: ExtIconName}) {
  return (
    <div className={`banner ${tone}`} role={tone === 'info' ? 'status' : 'alert'}>
      <ExtIcon name={icon ?? (tone === 'info' ? 'info' : 'alert-triangle')} size={18} />
      <div>
        <div className="noc-body-sm banner-title">{title}</div>
        {children === undefined ? null : <div className="noc-caption banner-line">{children}</div>}
      </div>
    </div>
  );
}

/** Spec §7.2 (D26): the one line for the coordinator's 403 cool-down, on whatever screen is showing. */
export const REFUSED_TEXT = 'The server is not answering for now — try again in 10 minutes.';

export function RefusedBanner() {
  return <Banner tone="warning" title={REFUSED_TEXT} />;
}
```

Create `extension/src/app/ui/Chip.tsx`:

```tsx
/** The design's `.chip-row` of filter chips (#26): one active, each a 48 px target. */
export function ChipRow<T extends string>({options, active, onChange, label}: {options: readonly {value: T; text: string}[]; active: T; onChange: (v: T) => void; label: string}) {
  return (
    <div className="chip-row" role="tablist" aria-label={label}>
      {options.map(o => (
        <span key={o.value} className="chip-shell">
          <button type="button" role="tab" aria-selected={o.value === active} className="chip" data-active={o.value === active ? 'true' : undefined} onClick={() => onChange(o.value)}>
            {o.text}
          </button>
        </span>
      ))}
    </div>
  );
}
```

Create `extension/src/app/ui/ExtIcon.tsx`:

```tsx
import type {ReactNode} from 'react';

/**
 * The glyphs web/src/ui/Icon.tsx does not have, copied path-for-path from the design file's sprite
 * (/home/user/Downloads/index.html, `<symbol id="i-*">`) in Icon's stroke style: 1.75, round caps and
 * joins, currentColor. `pencil` is the one the sprite lacks; it is drawn in the same style.
 */
export type ExtIconName =
  | 'eye'
  | 'eye-off'
  | 'send'
  | 'receive'
  | 'refresh'
  | 'home'
  | 'activity'
  | 'settings'
  | 'plus'
  | 'pencil'
  | 'close'
  | 'back'
  | 'wifi-off'
  | 'lock'
  | 'chevron-down'
  | 'chevron-right'
  | 'info'
  | 'link-out'
  | 'arrow-up-right'
  | 'alert-triangle'
  | 'check'
  | 'shield-lock'
  | 'globe';

const PATHS: Record<ExtIconName, ReactNode> = {
  eye: (
    <>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  receive: (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  refresh: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </>
  ),
  home: (
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  activity: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  'wifi-off': (
    <>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  'chevron-down': <polyline points="6 9 12 15 18 9" />,
  'chevron-right': <polyline points="9 18 15 12 9 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  'link-out': (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  'arrow-up-right': (
    <>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </>
  ),
  'alert-triangle': (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  'shield-lock': (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <rect x="9" y="11" width="6" height="6" rx="1.2" />
      <path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
};

/** Decorative unless labelled, as Icon. */
export function ExtIcon({name, size = 20, label}: {name: ExtIconName; size?: number; label?: string}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
```

Create `extension/src/app/ui/ListRow.tsx`:

```tsx
import type {ReactNode} from 'react';
import {ExtIcon, type ExtIconName} from './ExtIcon';

/** The design's settings row (`.s7-row`, 56 px): glyph, title, meta, chevron — one button. */
export function ListRow({icon, title, meta, onPress, danger = false}: {icon: ExtIconName; title: string; meta?: ReactNode; onPress: () => void; danger?: boolean}) {
  return (
    <button type="button" className={`s7-row${danger ? ' danger' : ''}`} onClick={onPress}>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className="s7-meta">{meta}</span>
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </button>
  );
}
```

Create `extension/src/app/ui/LockedButton.tsx`:

```tsx
import {useRef, useState, type ReactNode} from 'react';

/** Cardinal rule 6: no double submit — 500 ms at least, and never before the action settles. */
export const LOCK_MS = 500;

/**
 * A button that disables itself synchronously in its click handler and comes back no earlier than
 * LOCK_MS after the click AND not before `onPress`'s promise settles (spec §7.6). The ref, not only the
 * state, guards: a second click in the same frame, before React re-renders, is refused too.
 */
export function LockedButton({
  onPress,
  children,
  className = 'btn btn-primary',
  disabled = false,
  label,
  wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
}: {
  onPress: () => Promise<unknown> | void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  label?: string;
  wait?: (ms: number) => Promise<void>;
}) {
  const busy = useRef(false);
  const [locked, setLocked] = useState(false);
  const press = () => {
    if (busy.current || disabled) return;
    busy.current = true;
    setLocked(true);
    const floor = wait(LOCK_MS);
    let action: Promise<unknown>;
    try {
      action = Promise.resolve(onPress());
    } catch (e) {
      action = Promise.reject(e);
    }
    action = action.catch((e: unknown) => console.warn('action failed', e));
    void Promise.all([floor, action]).then(() => {
      busy.current = false;
      setLocked(false);
    });
  };
  return (
    <button type="button" className={`${className}${locked ? ' is-busy' : ''}`} disabled={disabled || locked} aria-label={label} onClick={press}>
      {children}
    </button>
  );
}
```

Create `extension/src/app/ui/QrCode.tsx`:

```tsx
import {useMemo} from 'react';
import qrcode from 'qrcode-generator';

/**
 * A QR code drawn as our own SVG from qrcode-generator's module matrix (spec S6: a small, reviewed,
 * zero-dependency library, pinned exact; no CDN, no canvas, no data: URL). Error correction H, so the
 * design's centre "N" mark (the `.center` overlay) never makes it unreadable.
 */
export function QrCode({value, label}: {value: string; label: string}) {
  const {size, path} = useMemo(() => {
    const qr = qrcode(0, 'H');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return {size: n + 8, path: d};
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label={label} shapeRendering="crispEdges" data-qr={value}>
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
```

Create `extension/src/app/ui/Sheet.tsx`:

```tsx
import {useEffect, useRef, type ReactNode} from 'react';
import {ExtIcon} from './ExtIcon';

/**
 * The design's bottom sheet (`.s8-sheet`, #43): 70 % of the height at most, a grabber, a title and a
 * close button. Esc, the backdrop and the grabber close it; Tab stays inside it while it is open
 * (focus trap), and focus returns to where it was when it closes.
 */
export function Sheet({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = (): HTMLElement[] => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (first === undefined || last === undefined) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, [onClose]);
  return (
    <div className="app-sheet-layer">
      <div className="s8-sheet-overlay" data-testid="sheet-backdrop" onClick={onClose} />
      <div className="s8-sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <button type="button" className="grabber-hit" aria-label="Close" onClick={onClose}>
          <span className="grabber" />
        </button>
        <div className="head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <ExtIcon name="close" size={20} />
          </button>
        </div>
        <div className="app-sheet-body">{children}</div>
      </div>
    </div>
  );
}
```

Create `extension/src/app/ui/Skeleton.tsx`:

```tsx
/** The design's shimmer placeholders (`.skel-line`, `.skel-circle`). Decorative: hidden from screen readers. */
export function SkelLine({width, height = 12}: {width: number; height?: number}) {
  return <span className="skel-line" aria-hidden="true" style={{display: 'block', width, height}} />;
}
export function SkelCircle({size = 36}: {size?: number}) {
  return <span className="skel-circle" aria-hidden="true" style={{display: 'block', width: size, height: size}} />;
}
```

Create `extension/src/app/ui/StatusPill.tsx`:

```tsx
import {ExtIcon} from './ExtIcon';

/** The design's `.status-pill` (#27): success, or `.fail` in danger. */
export function StatusPill({text, fail = false}: {text: string; fail?: boolean}) {
  return (
    <div className={`status-pill${fail ? ' fail' : ''}`}>
      <ExtIcon name={fail ? 'close' : 'check'} size={12} />
      {text}
    </div>
  );
}
```

Create `extension/src/app/ui/TabBar.tsx`:

```tsx
import {ExtIcon} from './ExtIcon';

export type Tab = 'home' | 'activity' | 'settings';
const TABS: {tab: Tab; text: string; icon: 'home' | 'activity' | 'settings'}[] = [
  {tab: 'home', text: 'Home', icon: 'home'},
  {tab: 'activity', text: 'Activity', icon: 'activity'},
  {tab: 'settings', text: 'Settings', icon: 'settings'},
];

/** D3: Home / Activity / Settings, 80 px, the design's `.tab-bar`. */
export function TabBar({active, onChange}: {active: Tab; onChange: (t: Tab) => void}) {
  return (
    <nav className="tab-bar app-tab-bar" aria-label="Main">
      {TABS.map(t => (
        <button key={t.tab} type="button" className={`item${t.tab === active ? ' is-active' : ''}`} aria-current={t.tab === active ? 'page' : undefined} onClick={() => onChange(t.tab)}>
          <ExtIcon name={t.icon} size={22} />
          {t.text}
        </button>
      ))}
    </nav>
  );
}
```

Create `extension/src/app/ui/Toast.tsx`:

```tsx
import {useEffect, useRef} from 'react';
import {ExtIcon} from './ExtIcon';

/** The design's `.copy-toast` pill: shown for `ms`, then gone. */
export function Toast({text, onDone, ms = 1800}: {text: string; onDone: () => void; ms?: number}) {
  // The latest callback, without restarting the timer on every render of the parent.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), ms);
    return () => clearTimeout(t);
  }, [text, ms]);
  return (
    <div className="copy-toast" role="status">
      <ExtIcon name="check" size={16} />
      <span>{text}</span>
    </div>
  );
}
```

Create `extension/src/app/ui/TokenTile.tsx`:

```tsx
import type {Token} from '../engine';

/** The design's synthetic token icon (`.ico.sol|noc|usdc`): a tinted circle with the symbol. No third-party logos. */
export function TokenTile({token, size = 36}: {token: Token; size?: number}) {
  return (
    <div className={`ico s8-tok ${token.toLowerCase()}`} style={{width: size, height: size}} aria-hidden="true">
      {token}
    </div>
  );
}
```

Create `extension/src/app/ui/TopBar.tsx`:

```tsx
import type {ReactNode} from 'react';
import {ExtIcon} from './ExtIcon';

/** The design's `.top-bar` (56 px): back, title, and an optional trailing control. */
export function TopBar({title, onBack, trailing, titleClass = 'noc-h1'}: {title: string; onBack?: () => void; trailing?: ReactNode; titleClass?: string}) {
  return (
    <div className="top-bar">
      {onBack === undefined ? null : (
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ExtIcon name="back" size={22} />
        </button>
      )}
      <div className={`title ${titleClass}`}>{title}</div>
      {trailing}
    </div>
  );
}
```

Create `extension/src/app/ui/useCopy.ts`:

```ts
import {useEffect, useState} from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Copy with web/src/ui/CopyButton.tsx's honesty: "Copied" only when the clipboard accepted it, "Copy
 * failed" when it refused or there is no clipboard API; back to idle after 2 s. The clipboard is never
 * cleared afterwards (spec §4), and the screens say so.
 */
export function useCopy(): [CopyState, (value: string) => void] {
  const [state, setState] = useState<CopyState>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);
  const copy = (value: string) => {
    const clip: Clipboard | undefined = navigator.clipboard;
    if (!clip) {
      setState('failed');
      return;
    }
    clip.writeText(value).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  };
  return [state, copy];
}
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/app/__tests__/LockedButton.test.tsx src/app/__tests__/ui.test.tsx`
Expected: PASS — 2 files, 15 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 68 files, 845 tests.

- [ ] **Step 6: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **no same-frame guard:** in `LockedButton`, replace `if (busy.current || disabled) return;` with `if (disabled) return;`. Run `npx vitest run src/app/__tests__/LockedButton.test.tsx` → RED: 1 failed ("two clicks in the same frame").
  - **no lock at all:** additionally delete `busy.current = true;` and `setLocked(true);`. Run `npx vitest run src/app/__tests__/LockedButton.test.tsx` → RED: 3 failed.

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/app/__tests__/LockedButton.test.tsx extension/src/app/__tests__/ui.test.tsx extension/src/app/ui/Banner.tsx extension/src/app/ui/Chip.tsx extension/src/app/ui/ExtIcon.tsx extension/src/app/ui/ListRow.tsx extension/src/app/ui/LockedButton.tsx extension/src/app/ui/QrCode.tsx extension/src/app/ui/Sheet.tsx extension/src/app/ui/Skeleton.tsx extension/src/app/ui/StatusPill.tsx extension/src/app/ui/TabBar.tsx extension/src/app/ui/Toast.tsx extension/src/app/ui/TokenTile.tsx extension/src/app/ui/TopBar.tsx extension/src/app/ui/useCopy.ts
git commit -m "feat(extension): the shared UI components (B1b-2a §1.3, rule 6)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 12: The wallet model and #11 — with #42 offline and the D26 refused state

**Files:**
- Create: `extension/src/app/WalletContext.tsx`
- Create: `extension/src/app/screens/Home.tsx`
- Test (create): `extension/src/app/__tests__/Home.test.tsx`
- Test (create): `extension/src/app/__tests__/harness.tsx`

**Interfaces:**
- Consumes: Tasks 10–11: `Engine`, `Platform`, `valuation`, `format`, `prefs`, `useNow`, the components.
- Produces:
  - `WalletContext.tsx`: `type Surface = 'popup' | 'tab'`, `type Phase`, `type NetMode`, `interface Net`, `interface WalletModel` (with `now()` and `report(error)`), `STATE_POLL_MS`, `PENDING_POLL_MS`, `PING_EVERY_MS`, `RECONNECTED_MS`, `SUSTAINED_MS`, `sustained(net, now)`, `useWallet()`, `WalletProvider({engine, platform, surface, now?, children})`
  - `screens/Home.tsx`: `Home({onReceive, onActivity, onAccounts})`
  - test harness `src/app/__tests__/harness.tsx`: `walletReader`, `setupWallet`, `renderInWallet` (options include `now`), `ENV`, `SECOND`, `NOC`, `USDC`

Spec §1.6: "The app has one React context, `WalletContext` … The engine is the source of truth." The open sequence: `wallet.state` → `wallet.cached(selected)` ("#11 renders at once with the stale marks") → `wallet.pending` → `wallet.balances` + `wallet.prices` → `activity.ping`; while open, `wallet.state` every 5 s (an auto-lock switches to the locked screen), `wallet.pending` every 2 s while a send of this account is open, `activity.ping` on user input at most every 30 s. Network state (§5.4): `offline` only when `navigator.onLine` is false; `unreachable` otherwise (review L3: "Could not reach the Noctura server"); `refused` (D26, sticky until the popup reopens, refresh disabled); `reconnecting` for 1.5 s after the first good read; `sustained` after 30 s or two failed refreshes. #11 (§5.1): account button → switcher, refresh (D2), eye (hidden balance persisted per S4), hero with the market total (NOC outside it, "at stage price"), sub-balances, **Receive only** (Scope item 8), token rows (SOL and NOC always), the pending strip (stand-in: opens Activity), cold-mount skeleton, stale caption, no-price "—" / "Prices unavailable". Two traps the dry run found are fixed in this code: a default-parameter clock re-created every render re-ran every effect (the stable `systemNow` fixes it), and the first refresh ran before the render that derives `account` (the ref is pointed at the account before the read). Review M4: the model exposes `report(error)` — any screen that reads the network reports `coordinator-refused` / `unreachable`, so the D26 banner and the disabled network buttons apply app-wide (Tasks 13 and 15 use it) — and `now()`, the one clock (L8). Review L6: the "≈ N SOL" line truncates, never rounds up.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Home.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, walletReader, type WalletOptions} from './harness';
import {Home} from '../screens/Home';
import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../../background/balanceCache';
import {PENDING_KEY} from '../../background/pendingStore';
import {HIDE_BALANCES_KEY} from '../prefs';
import {REFUSED_TEXT} from '../ui/Banner';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';

// Spec §5.1 (#11) and §5.4 (#42 and the D26 refused state). Totals from walletReader: SOL
// 62.4821 × $150 + USDC 740.21 × $1 = $10,112.52 (NOC at the stage price is outside it).
const CACHE = {[ACCOUNT.publicKey]: {sol: '62482100000', noc: '4200000000000', usdc: '740210000', usdt: '0', at: 1_000}};
const never = () => new Promise<never>(() => undefined);
const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', {value, configurable: true});
const nav = {onReceive: vi.fn(), onActivity: vi.fn(), onAccounts: vi.fn()};
/** #11 inside the real provider; its three ways out are spies (App.test.tsx follows them). */
const renderHome = (o: WalletOptions = {}) => renderInWallet(<Home {...nav} />, o);

afterEach(() => {
  setOnline(true);
  localStorage.clear();
  vi.clearAllMocks();
});

describe('#11 dashboard', () => {
  it('loaded: the market total, SOL and NOC under it, one row per held token; NOC at the stage price, outside the total', async () => {
    await renderHome();
    expect(await screen.findByText('$10,112')).toBeTruthy();
    expect(screen.getByText('.52')).toBeTruthy();
    expect(screen.getByText('Total balance')).toBeTruthy();
    const rows = [...document.querySelectorAll('.tokens .row')].map(r => r.getAttribute('data-token'));
    expect(rows).toEqual(['SOL', 'NOC', 'USDC']);
    expect(screen.getByText('62.4821 SOL')).toBeTruthy();
    expect(screen.getByText('4,200.00 NOC')).toBeTruthy();
    expect(screen.getByText('740.21 USDC')).toBeTruthy();
    const noc = document.querySelector('[data-token="NOC"]') as HTMLElement;
    expect(within(noc).getByText('$630.42')).toBeTruthy();
    expect(within(noc).getByText('at stage price')).toBeTruthy();
    // The account and its switcher, the refresh button (D2), the eye.
    expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Main');
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    expect(nav.onAccounts).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', {name: 'Refresh'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Hide balance'})).toBeTruthy();
  });

  it('what is deliberately absent: Send (plan 3), Swap, Buy, the bell, scan, 24 h change, the presale banner, See all', async () => {
    await renderHome();
    await screen.findByText('$10,112');
    for (const gone of ['Send', 'Swap', 'Buy', 'See all', 'Transparent', 'Shielded']) expect(screen.queryByText(gone)).toBeNull();
    expect(screen.queryByLabelText('Notifications')).toBeNull();
    expect(screen.queryByLabelText('Scan')).toBeNull();
    expect(document.body.textContent).not.toMatch(/24h|Presale|Stage \d/);
    expect(screen.getByRole('button', {name: 'Receive'})).toBeTruthy();
  });

  it('cold mount: the skeleton until the first read, when no cache exists', async () => {
    await renderHome({reader: walletReader({getBalance: never})});
    expect(await screen.findByTestId('skeleton')).toBeTruthy();
    expect(screen.queryByText('TOKENS')).toBeNull();
  });

  it('stale: cached values at once, marked, until the fresh read lands', async () => {
    let answer: (v: bigint) => void = () => undefined;
    const reader = walletReader({getBalance: () => new Promise<bigint>(r => (answer = r))});
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText(/^Total balance · cached \d+ (s|min|h|d) ago$/)).toBeTruthy();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(true);
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    await act(async () => answer(1_000_000_000n));
    expect(await screen.findByText('1.0000 SOL')).toBeTruthy();
    expect(screen.getByText('Total balance')).toBeTruthy();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(false);
  });

  it('hidden balance: every layer hidden, and remembered in this page\u2019s localStorage', async () => {
    await renderHome();
    await screen.findByText('$10,112');
    fireEvent.click(screen.getByRole('button', {name: 'Hide balance'}));
    expect(screen.getByText('Tap eye to reveal')).toBeTruthy();
    expect(screen.queryByText('$10,112')).toBeNull();
    expect(document.querySelector('.sub-balance')?.textContent).toBe('••••SOL••••NOC');
    expect(screen.getByText('•••••• SOL')).toBeTruthy();
    expect(screen.queryByText('$630.42')).toBeNull();
    expect(localStorage.getItem(HIDE_BALANCES_KEY)).toBe('1');
    fireEvent.click(screen.getByRole('button', {name: 'Show balance'}));
    expect(screen.getByText('$10,112')).toBeTruthy();
  });

  it('no price: the total reads — and "Prices unavailable"; amounts still show, never $0.00', async () => {
    await renderHome({
      deps: {
        prices: async () => {
          throw new Error('down');
        },
        stagePrice: async () => {
          throw new Error('down');
        },
      },
    });
    expect(await screen.findByText('Prices unavailable')).toBeTruthy();
    expect(screen.getByText('62.4821 SOL')).toBeTruthy();
    expect(document.body.textContent).not.toContain('$0.00');
  });

  it('pending strip: an open send of this account — its text, and it opens Activity (plan-1 stand-in)', async () => {
    await renderHome({
      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
    });
    fireEvent.click(await screen.findByText('Sending 2.48 SOL · pending'));
    expect(nav.onActivity).toHaveBeenCalledTimes(1);
  });
});

describe('#42 offline and the D26 refused state', () => {
  it('refused (a 403): the D26 banner, cached values marked, refresh disabled, nothing retried', async () => {
    let reads = 0;
    const reader = walletReader({
      getBalance: async () => {
        reads += 1;
        throw new RpcForbidden('getBalance');
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    expect(reads).toBe(1);
  });

  it('unreachable while the browser is online: "Could not reach the Noctura server", never "offline" (review L3)', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'no answer');
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
    expect(screen.getByText('Showing your last synced balances.')).toBeTruthy();
    expect(screen.queryByText(/offline/)).toBeNull();
  });

  it('just disconnected: the design\u2019s banner and caption; Receive stays enabled and opens #13 (D36)', async () => {
    setOnline(false);
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'offline');
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(screen.getByText('Network just dropped · the Noctura server is unreachable')).toBeTruthy();
    expect(screen.getByText('Sending needs a network connection. Receiving works — your address is on this device. Use the refresh button to retry.')).toBeTruthy();
    // (62.4821 × $150 + 740.21) / $150 = 67.4168…: truncated to 67.41, never rounded up (review L6).
    expect(screen.getByText(/^≈ 67\.41 SOL · last synced \d\d:\d\d:\d\d$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Receive'}));
    expect(nav.onReceive).toHaveBeenCalledTimes(1);
  });

  it('sustained (two failed refreshes): "Showing cached data", the retry count, the stale label and the offline callout', async () => {
    setOnline(false);
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'offline');
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    await screen.findByText("You're offline");
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText("You're offline · Showing cached data")).toBeTruthy();
    expect(screen.getByText(/^Last synced .+ ago · 2 retries failed$/)).toBeTruthy();
    expect(screen.getByText(/^Stale · \d\d:\d\d:\d\d$/)).toBeTruthy();
    expect(screen.getByText('prices may have moved')).toBeTruthy();
    for (const line of ['What you can still do offline:', 'Read your last synced balances', 'Show your address to receive funds', 'Lock the wallet from Settings']) {
      expect(screen.getByText(line)).toBeTruthy();
    }
    expect(screen.getAllByText('stale').length).toBeGreaterThan(0);
  });

  it('reconnecting: the first good read after being away shows "Connected · syncing" and rows turn live', async () => {
    let down = true;
    const reader = walletReader({
      getBalance: async () => {
        if (down) throw new RequestUnreachable('u', 'no answer');
        return 62_482_100_000n;
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    await screen.findByText('Could not reach the Noctura server');
    down = false;
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText('Connected · syncing')).toBeTruthy();
    expect(screen.getByText('Auto-dismisses in 1.5 s')).toBeTruthy();
    expect(screen.getAllByText('live').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText('Connected · syncing')).toBeNull(), {timeout: 3_000});
  });

  it('the price cache feeds the stale view too', async () => {
    await renderHome({
      reader: walletReader({getBalance: never}),
      before: async ext => {
        await ext.local.set(BALANCE_CACHE_KEY, CACHE);
        await ext.local.set(PRICE_CACHE_KEY, {sol: 100, usdc: 1, usdt: 1, noc: null, at: 1_000});
      },
    });
    // 62.4821 × $100 + 740.21 = $6,988.42.
    expect(await screen.findByText('$6,988')).toBeTruthy();
  });
});
```

Create `extension/src/app/__tests__/harness.tsx`:

```tsx
import type {ReactElement} from 'react';
import {render} from '@testing-library/react';
import {createEngine, type Engine, type Transport} from '../engine';
import type {Platform} from '../platform';
import {WalletProvider, type Surface} from '../WalletContext';
import {handleMessage} from '../../background/messages';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import type {WalletDeps} from '../../background/deps';
import type {SessionAccount} from '../../vault/accounts';
import type {SolanaReader} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';

/**
 * The screens against the REAL background (handleMessage, fake Ext, fake deps) — the same wiring as
 * engine.test.ts, rendered in happy-dom. The platform (tabs, window.close, version) is a spy. Screens
 * are rendered inside the real WalletProvider; App.test.tsx renders the whole App.
 */
export const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
export const POPUP = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};
export const SECOND = {index: 1, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey};
export const ENV = {
  v: 1,
  scheme: 'slip10',
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: RECIPIENT},
  ],
};
export const NOC = WALLET_TOKENS.NOC.mint as string;
export const USDC = WALLET_TOKENS.USDC.mint as string;

/** 62.4821 SOL, 4 200 NOC, 740.21 USDC, no USDT — the design's #11 numbers. */
export function walletReader(over: Partial<SolanaReader> = {}): SolanaReader {
  return fakeReader({
    getBalance: async () => 62_482_100_000n,
    getTokenAccountsByOwner: async owner => [
      {pubkey: 'h1', mint: NOC, owner, amount: 4_200_000_000_000n, decimals: 9},
      {pubkey: 'h2', mint: USDC, owner, amount: 740_210_000n, decimals: 6},
    ],
    getSignaturesForAddress: async () => [],
    ...over,
  });
}

export interface Wallet {
  ext: ReturnType<typeof fakeExt>;
  deps: ReturnType<typeof fakeDeps>;
  platform: Platform & {opened: string[]; closed: number};
  engine: Engine;
}

export interface WalletOptions {
  surface?: Surface;
  unlocked?: boolean;
  wallet?: boolean;
  env?: object;
  accounts?: SessionAccount[];
  reader?: SolanaReader;
  deps?: Partial<WalletDeps>;
  before?: (ext: ReturnType<typeof fakeExt>) => Promise<void>;
  /** The provider's clock (default: Date.now). */
  now?: () => number;
}

/** A background with this wallet in it, a client wired to it, and a spy platform. */
export async function setupWallet(o: WalletOptions = {}): Promise<Wallet> {
  const ext = fakeExt();
  if (o.wallet !== false) await ext.local.set(VAULT_KEY, o.env ?? ENV);
  if (o.unlocked !== false && o.wallet !== false) await setSession(ext, o.accounts ?? [ACCOUNT, SECOND]);
  if (o.before !== undefined) await o.before(ext);
  // History paces getTransaction with sleeps under 2 s, which resolve at once here; the pending poller's
  // 2 s sleep never resolves, so no poll loop outlives a test.
  const sleep = (ms: number) => (ms >= 2_000 ? new Promise<void>(() => undefined) : Promise.resolve());
  const deps = fakeDeps({reader: o.reader ?? walletReader(), sleep, ...o.deps});
  const opened: string[] = [];
  const platform = {
    opened,
    closed: 0,
    openPage(page: string) {
      opened.push(page);
    },
    closeWindow() {
      platform.closed += 1;
    },
    version: () => '0.1.0',
  };
  const transport: Transport = m => handleMessage(ext, m, POPUP, deps);
  return {ext, deps, platform, engine: createEngine(transport, async () => undefined)};
}

/** One screen inside the real provider (the open sequence runs as in the popup). */
export async function renderInWallet(ui: ReactElement, o: WalletOptions = {}): Promise<Wallet> {
  const w = await setupWallet(o);
  render(
    <WalletProvider engine={w.engine} platform={w.platform} surface={o.surface ?? 'popup'} {...(o.now === undefined ? {} : {now: o.now})}>
      {ui}
    </WalletProvider>,
  );
  return w;
}
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/Home.test.tsx`
Expected: FAIL — `Failed to resolve import "../screens/Home"`.

- [ ] **Step 3: Implement.**

Create `extension/src/app/WalletContext.tsx`:

```tsx
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import type {Account, Balances, Engine, Pending, Prices, WalletState} from './engine';
import type {Platform} from './platform';

export type Surface = 'popup' | 'tab';
export type Phase = 'loading' | 'no-wallet' | 'locked' | 'unlocked';
/**
 * #42 and D26 as one state: online; offline (navigator says so); unreachable (a read got no answer
 * while navigator says online — never called "offline", review L3); refused (the 403 cool-down, until
 * the popup reopens); reconnecting (the first good read after offline/unreachable, for 1.5 s).
 */
export type NetMode = 'online' | 'offline' | 'unreachable' | 'refused' | 'reconnecting';
export interface Net {
  mode: NetMode;
  /** When the current offline/unreachable spell began. */
  since: number;
  /** Failed refreshes in this spell. */
  failures: number;
}

export interface WalletModel {
  surface: Surface;
  engine: Engine;
  platform: Platform;
  phase: Phase;
  wallet: WalletState | null;
  account: Account | null;
  balances: Balances | null;
  /** When `balances` were read; with `stale`, they came from the cache (E4) and no fresh read has replaced them. */
  balancesAt: number | null;
  stale: boolean;
  prices: Prices | null;
  pending: Pending[];
  net: Net;
  lastSync: number | null;
  refreshing: boolean;
  /** The clock every screen uses (injectable for tests). */
  now(): number;
  /**
   * A screen that read the network reports a refusal here (review M4): 'coordinator-refused' puts the
   * whole app into the D26 state (banner, network buttons disabled), 'unreachable' into #42's.
   */
  report(error: string): void;
  refresh(): Promise<void>;
  reload(): Promise<void>;
  lock(): Promise<void>;
}

export const STATE_POLL_MS = 5_000;
export const PENDING_POLL_MS = 2_000;
export const PING_EVERY_MS = 30_000;
export const RECONNECTED_MS = 1_500;
/** Sustained offline: 30 s, or two failed refreshes (#42). */
export const SUSTAINED_MS = 30_000;
export const sustained = (net: Net, now: number): boolean => (net.mode === 'offline' || net.mode === 'unreachable') && (now - net.since >= SUSTAINED_MS || net.failures >= 2);

const Ctx = createContext<WalletModel | null>(null);

export function useWallet(): WalletModel {
  const m = useContext(Ctx);
  if (m === null) throw new Error('useWallet outside WalletProvider');
  return m;
}

/** A stable default clock: a new function per render would re-run every effect that depends on it. */
const systemNow = (): number => Date.now();
const online = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/**
 * The engine is the source of truth (spec §1.6): no cache of our own, only the last replies. The open
 * sequence: wallet.state → wallet.cached (stale at once) → wallet.pending → wallet.balances and
 * wallet.prices (fresh) → activity.ping. While open: wallet.state every 5 s, wallet.pending every 2 s
 * while a send of this account is open, and activity.ping on user input at most every 30 s. Nothing
 * else reads the network by itself: refresh is on open and on the refresh button (D2).
 */
export function WalletProvider({engine, platform, surface, now = systemNow, children}: {engine: Engine; platform: Platform; surface: Surface; now?: () => number; children: ReactNode}) {
  const [phase, setPhaseState] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balancesAt, setBalancesAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [net, setNet] = useState<Net>(() => (online() ? {mode: 'online', since: now(), failures: 0} : {mode: 'offline', since: now(), failures: 0}));
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const netRef = useRef(net);
  netRef.current = net;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shownKey = useRef<string | null>(null);

  const account = useMemo(() => wallet?.accounts.find(a => a.index === wallet.selected) ?? null, [wallet]);
  const accountRef = useRef(account);
  accountRef.current = account;

  const failed = useCallback(
    (error: string) => {
      if (error === 'coordinator-refused') {
        setNet(n => ({mode: 'refused', since: n.mode === 'refused' ? n.since : now(), failures: n.failures}));
      } else if (error === 'unreachable') {
        setNet(n => {
          if (n.mode === 'refused') return n;
          const spell = n.mode === 'offline' || n.mode === 'unreachable';
          return {mode: online() ? 'unreachable' : 'offline', since: spell ? n.since : now(), failures: (spell ? n.failures : 0) + 1};
        });
      }
    },
    [now],
  );

  const succeeded = useCallback(() => {
    setLastSync(now());
    if (netRef.current.mode === 'offline' || netRef.current.mode === 'unreachable') {
      setNet({mode: 'reconnecting', since: now(), failures: 0});
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => setNet(n => (n.mode === 'reconnecting' ? {mode: 'online', since: now(), failures: 0} : n)), RECONNECTED_MS);
    }
  }, [now]);

  /** Fresh balances and prices for the selected account. Refused while the 403 cool-down holds. */
  const refresh = useCallback(async () => {
    const a = accountRef.current;
    if (a === null || netRef.current.mode === 'refused') return;
    setRefreshing(true);
    try {
      const [b, p] = await Promise.all([engine.balances(a.publicKey), engine.prices()]);
      if (accountRef.current?.publicKey !== a.publicKey) return;
      if (b.ok) {
        setBalances(b.data);
        setBalancesAt(now());
        setStale(false);
        succeeded();
      } else failed(b.error);
      if (p.ok) setPrices(p.data);
      else if (b.ok) failed(p.error);
    } finally {
      setRefreshing(false);
    }
  }, [engine, now, failed, succeeded]);

  const readPending = useCallback(async () => {
    const r = await engine.pending();
    if (r.ok) setPending(r.data);
  }, [engine]);

  /** The open sequence for the unlocked wallet: cache first (stale), then pending, then fresh. */
  const openUnlocked = useCallback(
    async (w: WalletState) => {
      const a = w.accounts.find(x => x.index === w.selected) ?? null;
      if (a === null) return;
      // The render that derives `account` from this state has not happened yet: point the ref at it now.
      accountRef.current = a;
      const c = await engine.cached(a.publicKey);
      if (c.ok) {
        if (c.data.balances !== null) {
          const {at, ...b} = c.data.balances;
          setBalances(b);
          setBalancesAt(at);
          setStale(true);
        } else {
          setBalances(null);
          setBalancesAt(null);
          setStale(false);
        }
        setPrices(c.data.prices);
        if (c.data.prices !== null || c.data.balances !== null) setLastSync(c.data.balances?.at ?? c.data.prices?.at ?? null);
      }
      await readPending();
      await refresh();
      await engine.ping();
    },
    [engine, readPending, refresh],
  );

  const applyState = useCallback(
    async (fresh: boolean) => {
      const r = await engine.state();
      if (!r.ok) return;
      const w = r.data;
      setWallet(prev => {
        const changed = prev === null || prev.unlocked !== w.unlocked || prev.selected !== w.selected || JSON.stringify(prev.accounts) !== JSON.stringify(w.accounts);
        return changed ? w : prev;
      });
      if (!w.hasWallet) {
        setPhase('no-wallet');
        return;
      }
      if (!w.unlocked) {
        setPhase('locked');
        setBalances(null);
        setPrices(null);
        return;
      }
      const wasUnlocked = phaseRef.current === 'unlocked';
      setPhase('unlocked');
      // Read again on open, on unlock, and when the selected account changed (a select here, or an
      // account list changed elsewhere) — otherwise the 5 s poll only watches the lock.
      const key = w.accounts.find(x => x.index === w.selected)?.publicKey ?? null;
      if (!wasUnlocked || fresh || key !== shownKey.current) {
        shownKey.current = key;
        await openUnlocked(w);
      }
    },
    [engine, openUnlocked, setPhase],
  );

  const reload = useCallback(() => applyState(true), [applyState]);

  // Open, then wallet.state every 5 s: an auto-lock while open switches to the locked screen.
  useEffect(() => {
    void applyState(true);
    const t = setInterval(() => void applyState(false), STATE_POLL_MS);
    return () => clearInterval(t);
  }, [applyState]);

  const selectedKey = account?.publicKey ?? null;

  // wallet.pending every 2 s while a send of this account is open.
  const open = pending.some(p => p.account === selectedKey && (p.state === 'pending' || p.state === 'stuck'));
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void readPending(), PENDING_POLL_MS);
    return () => clearInterval(t);
  }, [open, readPending]);

  // activity.ping on user input, at most every 30 s (the idle timer, parent §2).
  useEffect(() => {
    if (phase !== 'unlocked') return;
    let last = now();
    const onInput = () => {
      if (now() - last < PING_EVERY_MS) return;
      last = now();
      void engine.ping();
    };
    document.addEventListener('pointerdown', onInput);
    document.addEventListener('keydown', onInput);
    return () => {
      document.removeEventListener('pointerdown', onInput);
      document.removeEventListener('keydown', onInput);
    };
  }, [phase, engine, now]);

  // The browser's own connectivity events: offline shows #42 at once; online refreshes.
  useEffect(() => {
    const off = () => setNet(n => (n.mode === 'refused' ? n : {mode: 'offline', since: n.mode === 'offline' || n.mode === 'unreachable' ? n.since : now(), failures: n.failures}));
    const on = () => void refresh();
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, [refresh, now]);
  useEffect(() => () => clearTimeout(reconnectTimer.current), []);

  // No wallet in the popup: setup opens in a tab and the popup closes (§1.6 step 1).
  useEffect(() => {
    if (phase !== 'no-wallet' || surface !== 'popup') return;
    platform.openPage('unlock.html?mode=welcome');
    platform.closeWindow();
  }, [phase, surface, platform]);

  const lock = useCallback(async () => {
    await engine.lock();
    await applyState(true);
  }, [engine, applyState]);

  const model: WalletModel = {surface, engine, platform, phase, wallet, account, balances, balancesAt, stale, prices, pending, net, lastSync, refreshing, now, report: failed, refresh, reload, lock};
  return <Ctx.Provider value={model}>{children}</Ctx.Provider>;
}
```

Create `extension/src/app/screens/Home.tsx`:

```tsx
import {useState} from 'react';
import {useWallet, sustained, type NetMode} from '../WalletContext';
import {valuation} from '../valuation';
import {TOKEN_INFO, ago, agoLong, clock, showAmount, showUsd, usdParts} from '../format';
import {formatAmount} from '../../shared/amount';
import {HIDE_BALANCES_KEY, readPref, writePref} from '../prefs';
import {useNow} from '../useNow';
import {ExtIcon} from '../ui/ExtIcon';
import {RefusedBanner} from '../ui/Banner';
import {SkelCircle, SkelLine} from '../ui/Skeleton';
import {TokenTile} from '../ui/TokenTile';
import type {Pending, Token} from '../engine';

/** #42's banner: offline is navigator's word; unreachable says the server did not answer (review L3). */
function NetBanner({mode, sustainedNow, lastSync, failures, now}: {mode: NetMode; sustainedNow: boolean; lastSync: number | null; failures: number; now: number}) {
  if (mode === 'reconnecting') {
    return (
      <div className="s8-offline-banner success app-banner" role="status">
        <ExtIcon name="check" size={18} />
        <div>
          <p>Connected · syncing</p>
          <div className="meta noc-caption">Auto-dismisses in 1.5 s</div>
        </div>
      </div>
    );
  }
  if (mode !== 'offline' && mode !== 'unreachable') return null;
  const title = mode === 'offline' ? (sustainedNow ? "You're offline · Showing cached data" : "You're offline") : 'Could not reach the Noctura server';
  const line = sustainedNow
    ? `Last synced ${lastSync === null ? 'never' : agoLong(lastSync, now)} · ${failures} ${failures === 1 ? 'retry' : 'retries'} failed`
    : mode === 'offline'
      ? 'Network just dropped · the Noctura server is unreachable'
      : 'Showing your last synced balances.';
  return (
    <div className="s8-offline-banner warn app-banner" role="alert">
      <ExtIcon name="wifi-off" size={18} />
      <div>
        <p>{title}</p>
        <div className="meta">{line}</div>
      </div>
    </div>
  );
}

/** #11's pending strip (plan-1 stand-in: it opens Activity, not #21/#54). */
function PendingStrip({p, now, onOpen}: {p: Pending; now: number; onOpen: () => void}) {
  const slow = p.state === 'stuck' || now - p.createdAt > 80_000;
  const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
  return (
    <button type="button" className="banner info app-banner app-strip" onClick={onOpen}>
      <ExtIcon name="send" size={18} />
      <span className="noc-body-sm">
        Sending {amount} {p.intent.token} · {slow ? 'taking longer than usual' : 'pending'}
      </span>
    </button>
  );
}

const HIDDEN_ROW = '••••••';

/**
 * #11 dashboard (spec §5.1) with #42's offline states and the D26 refused state (§5.4). Plan-1
 * stand-ins, stated in the plan: no Send quick action (the send flow is plan 3), and the pending
 * strip opens Activity.
 */
export function Home({onReceive, onActivity, onAccounts}: {onReceive: () => void; onActivity: () => void; onAccounts: () => void}) {
  const m = useWallet();
  const now = useNow();
  const [hidden, setHidden] = useState(() => readPref(HIDE_BALANCES_KEY) === '1');
  const toggleHidden = () => {
    setHidden(h => {
      writePref(HIDE_BALANCES_KEY, h ? '0' : '1');
      return !h;
    });
  };
  const account = m.account;
  const mode = m.net.mode;
  const refused = mode === 'refused';
  const away = mode === 'offline' || mode === 'unreachable';
  const long = sustained(m.net, now);
  const stale = m.stale || away || refused;
  const open = m.pending.find(p => p.account === account?.publicKey && (p.state === 'pending' || p.state === 'stuck'));

  const top = (
    <div className="top">
      <button type="button" className="app-account" aria-label="Accounts" onClick={onAccounts}>
        <span className="avatar">{(account?.name ?? '?').slice(0, 1).toUpperCase()}</span>
        <span className="noc-body-lg app-account-name">{account?.name ?? ''}</span>
        <ExtIcon name="chevron-down" size={16} />
      </button>
      <div className="top-actions">
        <button type="button" aria-label="Refresh" className={m.refreshing ? 'is-spinning' : undefined} disabled={refused || m.refreshing} onClick={() => void m.refresh()}>
          <ExtIcon name="refresh" size={22} />
        </button>
      </div>
    </div>
  );

  if (m.balances === null) {
    // Cold mount: no cache yet, nothing read yet.
    return (
      <div className="screen s-dash" aria-busy="true">
        {top}
        {refused ? <RefusedBanner /> : <NetBanner mode={mode} sustainedNow={long} lastSync={m.lastSync} failures={m.net.failures} now={now} />}
        <div className="hero">
          <SkelLine width={90} height={14} />
          <SkelLine width={200} height={44} />
          <SkelLine width={140} height={14} />
        </div>
        <div className="tokens" data-testid="skeleton">
          {[60, 54, 64, 50].map(w => (
            <div className="row" key={w}>
              <SkelCircle />
              <div className="meta">
                <SkelLine width={w} height={13} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const v = valuation(m.balances, m.prices);
  const tokens: Token[] = (['SOL', 'NOC', 'USDC', 'USDT'] as const).filter(t => t === 'SOL' || t === 'NOC' || v.rows[t].base > 0n);
  const priceAt = m.prices?.at ?? null;
  const label = long && m.lastSync !== null ? `Stale · ${clock(m.lastSync)}` : stale && m.balancesAt !== null ? `Total balance · cached ${ago(m.balancesAt, now)}` : 'Total balance';
  const rowNote = mode === 'reconnecting' ? 'live' : long ? 'stale' : stale ? 'cached' : null;
  const solPrice = m.prices?.sol ?? null;

  return (
    <div className="screen s-dash">
      {top}
      {refused ? <RefusedBanner /> : <NetBanner mode={mode} sustainedNow={long} lastSync={m.lastSync} failures={m.net.failures} now={now} />}
      {open === undefined ? null : <PendingStrip p={open} now={now} onOpen={onActivity} />}
      <section className={`hero${stale ? ' s8-stale' : ''}`}>
        <div className="label-row">
          <div className="left">
            <span className={`noc-overline${long ? ' app-warning' : ''}`}>{label}</span>
          </div>
          <button type="button" className="eye-btn" aria-label={hidden ? 'Show balance' : 'Hide balance'} onClick={toggleHidden}>
            <ExtIcon name={hidden ? 'eye-off' : 'eye'} size={20} />
          </button>
        </div>
        {hidden ? (
          <div className="balance">
            <span className="noc-body app-reveal">Tap eye to reveal</span>
          </div>
        ) : v.total === null ? (
          <div className="balance">
            <span className="real noc-balance-xl noc-numeral">—</span>
            <div className="noc-caption app-muted">Prices unavailable</div>
          </div>
        ) : (
          <div className="balance">
            <span className="real noc-balance-xl noc-numeral">{usdParts(v.total).whole}</span>
            <span className="cents noc-numeral">{usdParts(v.total).cents}</span>
          </div>
        )}
        {away && !hidden && m.lastSync !== null ? (
          <div className="noc-body-sm app-muted">
            {v.total !== null && solPrice !== null ? `≈ ${(Math.floor((v.total / solPrice) * 100) / 100).toFixed(2)} SOL · ` : ''}last synced {clock(m.lastSync)}
          </div>
        ) : null}
        {long ? <div className="noc-caption app-warning">prices may have moved</div> : null}
        <div className="sub-balance noc-body-sm">
          <div>
            <b className="noc-numeral">{hidden ? '••••' : showAmount('SOL', m.balances.sol)}</b>
            <span>SOL</span>
          </div>
          <span className="dot" />
          <div>
            <b className="noc-numeral">{hidden ? '••••' : showAmount('NOC', m.balances.noc)}</b>
            <span>NOC</span>
          </div>
        </div>
      </section>
      <div className="quick">
        <button type="button" className="qa" onClick={onReceive}>
          <span className="icon">
            <ExtIcon name="receive" size={18} />
          </span>
          <span className="lbl">Receive</span>
        </button>
      </div>
      {away ? <p className="noc-caption app-muted app-offline-note">Sending needs a network connection. Receiving works — your address is on this device. Use the refresh button to retry.</p> : null}
      {away && long ? (
        <div className="banner info app-banner app-callout">
          <ExtIcon name="info" size={18} />
          <div className="noc-body-sm">
            <div>What you can still do offline:</div>
            <ul>
              <li>Read your last synced balances</li>
              <li>Show your address to receive funds</li>
              <li>Lock the wallet from Settings</li>
            </ul>
          </div>
        </div>
      ) : null}
      <div className="section-h">
        <h3 className="noc-overline">TOKENS</h3>
      </div>
      <div className={`tokens${stale ? ' s8-stale' : ''}`}>
        {tokens.map(t => {
          const row = v.rows[t];
          return (
            <div className="row" key={t} data-token={t}>
              <TokenTile token={t} />
              <div className="meta">
                <div className="pri noc-body-lg">{TOKEN_INFO[t].name}</div>
                <div className="sec noc-body-sm noc-numeral">
                  {hidden ? `${HIDDEN_ROW} ${t}` : `${showAmount(t, row.base)} ${t}`}
                  {rowNote === 'cached' ? ' · cached' : ''}
                </div>
              </div>
              <div className="price">
                <div className="pri noc-body-lg noc-numeral">{hidden ? '••••' : row.usd === null ? '—' : showUsd(row.usd)}</div>
                {row.basis === 'stage' ? <div className="sec noc-body-sm">at stage price</div> : null}
                {rowNote === 'live' ? <div className="sec noc-body-sm app-success">live</div> : null}
                {rowNote === 'stale' ? <div className="sec noc-body-sm app-warning">stale</div> : null}
                {rowNote === 'cached' && away && priceAt !== null ? <div className="sec noc-body-sm">price {clock(priceAt)}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/app/__tests__/Home.test.tsx`
Expected: PASS — 13 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 69 files, 858 tests.

- [ ] **Step 6: Visual pass (spec §8.6).** These states are captured at 412 × 600 by Task 17's `e2e/visual.spec.ts` and reviewed there against the design: `09-locked (after Task 16)`, `11-loaded`, `11-hidden-balance`, `42-just-disconnected`, `42-sustained`, `42-reconnecting`, `42-refused-d26`. Nothing to do here but check the names still match the states this task built.

- [ ] **Step 7: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **forget the cache's staleness:** in `Home.tsx`, replace `const stale = m.stale || away || refused;` with `const stale = away || refused;`. Run `npx vitest run src/app/__tests__/Home.test.tsx` → RED: 1 failed.
  - **call it offline (L3):** replace `const title = mode === 'offline' ?` with `const title = mode === 'offline' || mode === 'unreachable' ?`. Run `npx vitest run src/app/__tests__/Home.test.tsx` → RED: 2 failed.
  - **refresh during the cool-down:** replace `disabled={refused || m.refreshing}` with `disabled={m.refreshing}`. Run `npx vitest run src/app/__tests__/Home.test.tsx` → RED: 1 failed.
  - **round the SOL line up (L6):** replace `(Math.floor((v.total / solPrice) * 100) / 100).toFixed(2)` with `(v.total / solPrice).toFixed(2)`. Run `npx vitest run src/app/__tests__/Home.test.tsx` → RED: 1 failed.

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/app/WalletContext.tsx extension/src/app/__tests__/Home.test.tsx extension/src/app/__tests__/harness.tsx extension/src/app/screens/Home.tsx
git commit -m "feat(extension): the wallet model and #11 with #42 and the D26 state (B1b-2a §1.6, §5.1, §5.4)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 13: The account switcher (D14) and #43's token sheet

**Files:**
- Create: `extension/src/app/screens/Switcher.tsx`
- Create: `extension/src/app/screens/TokenSheet.tsx`
- Test (create): `extension/src/app/__tests__/Switcher.test.tsx`
- Test (create): `extension/src/app/__tests__/TokenSheet.test.tsx`

**Interfaces:**
- Consumes: Task 12's `useWallet`, `WalletProvider`, `Home`; Task 11's `Sheet`, `LockedButton`, `TokenTile`.
- Produces:
  `screens/Switcher.tsx`: `FRESH_ROWS = 10`, `Switcher({onClose})`; `screens/TokenSheet.tsx`: `TokenSheet({balances, prices, selected, onSelect, onClose})`.

Spec §5.2: a `.s8-sheet` titled "Accounts": a row per account — initial, name, the address's first two groups + "…", "12.4821 SOL · $1,234.56" (the market total), "cached 2 h ago" when stale, "not checked yet" beyond the first 10; cached balances first, then fresh `wallet.balances` for the first 10, one at a time; the selected row checked; a row click → `accounts.select` → closes, #11 reloads; the pencil → inline rename (`maxlength=32`, `[Save]` is a `LockedButton`) with the three refusal strings; `[Add account]` → `unlock.html?mode=accounts`, disabled for a CLI wallet with "A Solana CLI wallet has exactly one account." Spec §4.3 (#43, D18): "Choose a token", four rows (symbol, name, balance, USD; NOC "at stage price"), the current one selected; a row selects and closes; Esc/backdrop close without a change. #43 is not opened in plan 1 (Scope item 7). The dry-run's visual pass caught `.s8-sheet .row` (the design's 3-column grid) swallowing the switcher's row layout: the switcher rows use their own class. Review M5: the fresh pass is skipped while the app is offline or unreachable, and stops at the first read that gets no answer (reporting it, M4). Review L8: ages use the model's clock.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Switcher.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {useState} from 'react';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, type WalletOptions} from './harness';
import {Home} from '../screens/Home';
import {Switcher} from '../screens/Switcher';
import {VAULT_KEY} from '../../background/accountsStore';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {walletReader} from './harness';
import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
import {RequestUnreachable} from '../../../../core/solana/rpc';

// Spec §5.2 (D14): the switcher, derived from #43's sheet, opened from #11's account button.
function HomeWithSwitcher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => setOpen(true)} />
      {open ? <Switcher onClose={() => setOpen(false)} /> : null}
    </>
  );
}
const renderApp = (o: WalletOptions = {}) => renderInWallet(<HomeWithSwitcher />, o);

async function open() {
  const r = await renderApp();
  await screen.findByText('$10,112');
  fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
  return {...r, sheet: await screen.findByRole('dialog', {name: 'Accounts'})};
}

describe('the account switcher', () => {
  it('a row per account: initial, name, the first two groups, balance and value; the selected one checked', async () => {
    const {sheet} = await open();
    const rows = sheet.querySelectorAll('[data-account]');
    expect(rows).toHaveLength(2);
    const main = within(rows[0] as HTMLElement);
    expect(main.getByText('Main')).toBeTruthy();
    expect(main.getByText(`${ACCOUNT.publicKey.slice(0, 4)} ${ACCOUNT.publicKey.slice(4, 8)}…`)).toBeTruthy();
    expect(await main.findByText('62.4821 SOL · $10,112.52')).toBeTruthy();
    expect(main.getByRole('img', {name: 'Selected'})).toBeTruthy();
    expect((rows[0] as HTMLElement).className).toContain('sel');
  });

  it('selecting an account closes the sheet and #11 follows it', async () => {
    await open();
    fireEvent.click(screen.getByText('Savings'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Savings'));
  });

  it('rename: saved names show at once; a refused name says why', async () => {
    const {ext} = await open();
    fireEvent.click(screen.getByRole('button', {name: 'Rename Main'}));
    const input = screen.getByRole('textbox', {name: 'Account name'}) as HTMLInputElement;
    expect(input.maxLength).toBe(32);
    fireEvent.change(input, {target: {value: 'Daily'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Daily'));
    expect(((await ext.local.get(VAULT_KEY)) as {accounts: {name: string}[]}).accounts[0]?.name).toBe('Daily');
    fireEvent.click(screen.getByRole('button', {name: 'Rename Daily'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Account name'}), {target: {value: 'bad\u0007name'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(await screen.findByText('Names are 1 to 32 characters, without control characters.')).toBeTruthy();
  });

  it('Add account opens the vault page’s accounts mode; a CLI wallet cannot add one', async () => {
    const {platform} = await open();
    fireEvent.click(screen.getByRole('button', {name: 'Add account'}));
    expect(platform.opened).toEqual(['unlock.html?mode=accounts']);
  });

  it('a CLI wallet: Add account disabled, with the reason', async () => {
    await renderApp({env: {v: 1, scheme: 'cli', accounts: [{index: 0, name: 'CLI', publicKey: ACCOUNT.publicKey}]}, accounts: [ACCOUNT]});
    await screen.findByText('TOKENS');
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    expect((await screen.findByRole('button', {name: 'Add account'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('A Solana CLI wallet has exactly one account.')).toBeTruthy();
  });

  it('Esc and the backdrop close it without a change', async () => {
    await open();
    fireEvent.keyDown(document, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    fireEvent.click(await screen.findByTestId('sheet-backdrop'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Main');
  });

  // Review M5: no fresh pass while away; and the pass stops at the first read that gets no answer.
  it('offline or unreachable: only the cached rows, no fresh reads', async () => {
    const asked: string[] = [];
    const reader = walletReader({
      getBalance: async owner => {
        asked.push(owner);
        throw new RequestUnreachable('u', 'no answer');
      },
    });
    await renderApp({reader, before: ext => ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: {sol: '1000000000', noc: '0', usdc: '0', usdt: '0', at: 1}})});
    await screen.findByText('Could not reach the Noctura server');
    const before = asked.length;
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    const sheet = await screen.findByRole('dialog', {name: 'Accounts'});
    expect(await within(sheet).findByText(/^cached /)).toBeTruthy();
    await new Promise(r => setTimeout(r, 50));
    expect(asked.length).toBe(before);
  });

  it('a first fresh read with no answer ends the pass (the second account is not asked) and sets #42', async () => {
    let down = false;
    const asked: string[] = [];
    const reader = walletReader({
      getBalance: async owner => {
        asked.push(owner);
        if (down) throw new RequestUnreachable('u', 'no answer');
        return 1_000_000_000n;
      },
    });
    await renderApp({reader});
    await screen.findByText('1.0000 SOL');
    down = true;
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    await screen.findByText('Could not reach the Noctura server');
    await new Promise(r => setTimeout(r, 50));
    expect(asked.filter(o => o === RECIPIENT)).toEqual([]);
  });

  it('ages come from the provider\u2019s clock (review L8)', async () => {
    const at = 1_000_000;
    await renderInWallet(<HomeWithSwitcher />, {now: () => at + 2 * 3_600_000, reader: walletReader({getBalance: () => new Promise(() => undefined)}), before: ext => ext.local.set(BALANCE_CACHE_KEY, {[RECIPIENT]: {sol: '1', noc: '0', usdc: '0', usdt: '0', at}})});
    fireEvent.click(await screen.findByRole('button', {name: 'Accounts'}));
    expect(await screen.findByText('cached 2 h ago')).toBeTruthy();
  });
});
```

Create `extension/src/app/__tests__/TokenSheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {fireEvent, render, screen, within} from '@testing-library/react';
import {TokenSheet} from '../screens/TokenSheet';

// Spec §4.3 (#43, D18): the four tokens as a list; built in plan 1, opened by #12 in plan 3.
const balances = {sol: 62_482_100_000n, noc: 4_200_000_000_000n, usdc: 740_210_000n, usdt: 0n};
const prices = {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: 1};

describe('#43 token selector', () => {
  it('four rows — symbol, name, balance, value; NOC at stage price; the current token selected', () => {
    render(<TokenSheet balances={balances} prices={prices} selected="SOL" onSelect={() => undefined} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', {name: 'Choose a token'});
    const rows = within(dialog).getAllByRole('button', {pressed: undefined}).filter(b => b.classList.contains('app-token-row'));
    expect(rows.map(r => r.querySelector('.pri')?.textContent)).toEqual(['SOL', 'NOC', 'USDC', 'USDT']);
    expect(rows.map(r => r.querySelector('.sec')?.textContent)).toEqual(['Solana', 'Noctura', 'USD Coin', 'Tether']);
    expect(rows[1]?.querySelector('.fiat')?.textContent).toBe('$630.42 at stage price');
    expect(rows[0]?.getAttribute('aria-pressed')).toBe('true');
    for (const gone of ['Popular', 'Search', 'All tokens']) expect(screen.queryByText(new RegExp(gone))).toBeNull();
  });

  it('a row selects and closes; Esc closes without a change', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<TokenSheet balances={balances} prices={prices} selected="SOL" onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText('USD Coin'));
    expect(onSelect).toHaveBeenCalledWith('USDC');
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/Switcher.test.tsx src/app/__tests__/TokenSheet.test.tsx`
Expected: FAIL — `Failed to resolve import "../screens/TokenSheet"` (and `Switcher`).

- [ ] **Step 3: Implement.**

Create `extension/src/app/screens/Switcher.tsx`:

```tsx
import {useEffect, useState} from 'react';
import {useWallet} from '../WalletContext';
import {valuation} from '../valuation';
import {ago, showAmount, showUsd, twoGroups} from '../format';
import {useNow} from '../useNow';
import {Sheet} from '../ui/Sheet';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import type {Account, Balances} from '../engine';

/** Fresh balances for the first ten rows, one account at a time (2 requests each, inside the proxy's budget). */
export const FRESH_ROWS = 10;

type RowBalance = {b: Balances; at: number; fresh: boolean};

const RENAME_ERRORS: Record<string, string> = {
  malformed: 'Names are 1 to 32 characters, without control characters.',
  busy: 'The wallet is busy. Try again.',
  'unknown-account': 'That account no longer exists.',
  failed: 'Something went wrong.',
};

/**
 * The account switcher (spec §5.2, D14): derived from #43's sheet — accounts with balances, select,
 * rename, "Add account". Remove and reorder are B1b-2b's accounts manager.
 */
export function Switcher({onClose}: {onClose: () => void}) {
  const m = useWallet();
  const now = useNow(1_000, m.now);
  const accounts = m.wallet?.accounts ?? [];
  const [rows, setRows] = useState<Record<string, RowBalance>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refused = m.net.mode === 'refused';
  const away = m.net.mode === 'offline' || m.net.mode === 'unreachable';

  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const a of accounts) {
        const c = await m.engine.cached(a.publicKey);
        if (!alive) return;
        if (c.ok && c.data.balances !== null) {
          const {at, ...b} = c.data.balances;
          setRows(r => ({...r, [a.publicKey]: {b, at, fresh: false}}));
        }
      }
      // No fresh pass during the 403 cool-down, nor while offline or unreachable (review M5): the
      // cached rows are what there is, and ten reads that cannot answer would only wait.
      if (refused || away) return;
      for (const a of accounts.slice(0, FRESH_ROWS)) {
        const f = await m.engine.balances(a.publicKey);
        if (!alive) return;
        if (f.ok) {
          setRows(r => ({...r, [a.publicKey]: {b: f.data, at: m.now(), fresh: true}}));
          continue;
        }
        // A 403 or no answer is the whole app's state (M4), and ends the pass: the next read would fare no better.
        m.report(f.error);
        if (f.error === 'coordinator-refused' || f.error === 'unreachable') return;
      }
    })();
    return () => {
      alive = false;
    };
    // The list is read once per opening; a rename changes names, not balances.
  }, []);

  const select = async (a: Account) => {
    const r = await m.engine.select(a.index);
    if (r.ok) {
      onClose();
      await m.reload();
    }
  };

  const save = async (a: Account) => {
    const r = await m.engine.rename(a.index, name);
    if (r.ok) {
      setEditing(null);
      setError(null);
      await m.reload();
    } else setError(RENAME_ERRORS[r.error] ?? RENAME_ERRORS.failed ?? null);
  };

  const cli = m.wallet?.scheme === 'cli';
  return (
    <Sheet title="Accounts" onClose={onClose}>
      <div className="list">
        {accounts.map((a, i) => {
          const row = rows[a.publicKey];
          const selected = a.index === m.wallet?.selected;
          const total = row === undefined ? null : valuation(row.b, m.prices).total;
          return (
            <div key={a.index} className={`app-account-row${selected ? ' sel' : ''}`} data-account={a.index}>
              {editing === a.index ? (
                <div className="app-rename">
                  <input
                    className="app-input"
                    aria-label="Account name"
                    maxLength={32}
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                  <LockedButton className="btn btn-primary app-btn-sm" onPress={() => save(a)}>
                    Save
                  </LockedButton>
                  <button type="button" className="btn btn-secondary app-btn-sm" onClick={() => {
                    setEditing(null);
                    setError(null);
                  }}>
                    Cancel
                  </button>
                  {error === null ? null : <p className="field-msg noc-danger" role="alert">{error}</p>}
                </div>
              ) : (
                <>
                  <button type="button" className="app-account-pick" aria-pressed={selected} onClick={() => void select(a)}>
                    <span className="avatar">{a.name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <span className="pri noc-body-lg">{a.name}</span>
                      <span className="sec noc-mono">{twoGroups(a.publicKey)}</span>
                      <span className="sec noc-numeral">
                        {row === undefined ? (i >= FRESH_ROWS ? 'not checked yet' : '') : `${showAmount('SOL', row.b.sol)} SOL${total === null ? '' : ` · ${showUsd(total)}`}`}
                      </span>
                      {row !== undefined && !row.fresh ? <span className="sec noc-caption">cached {ago(row.at, now)}</span> : null}
                    </span>
                    {selected ? <ExtIcon name="check" size={18} label="Selected" /> : null}
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Rename ${a.name}`} onClick={() => {
                    setEditing(a.index);
                    setName(a.name);
                    setError(null);
                  }}>
                    <ExtIcon name="pencil" size={16} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-secondary" disabled={cli} onClick={() => m.platform.openPage('unlock.html?mode=accounts')}>
        <ExtIcon name="plus" size={18} />
        Add account
      </button>
      {cli ? <p className="noc-caption app-muted">A Solana CLI wallet has exactly one account.</p> : null}
    </Sheet>
  );
}
```

Create `extension/src/app/screens/TokenSheet.tsx`:

```tsx
import {Sheet} from '../ui/Sheet';
import {TokenTile} from '../ui/TokenTile';
import {TOKEN_INFO, showAmount, showUsd} from '../format';
import {valuation} from '../valuation';
import type {Balances, Prices, Token} from '../engine';

/**
 * #43 token selector (D18: the design's bottom sheet, as a list of the four tokens). Built in plan 1
 * with the sheet it shares with the account switcher; #12 opens it in plan 3.
 */
export function TokenSheet({balances, prices, selected, onSelect, onClose}: {balances: Balances; prices: Prices | null; selected: Token; onSelect: (t: Token) => void; onClose: () => void}) {
  const v = valuation(balances, prices);
  return (
    <Sheet title="Choose a token" onClose={onClose}>
      <div className="list">
        {(['SOL', 'NOC', 'USDC', 'USDT'] as const).map(t => (
          <button
            type="button"
            key={t}
            className={`row app-token-row${t === selected ? ' sel' : ''}`}
            aria-pressed={t === selected}
            onClick={() => {
              onSelect(t);
              onClose();
            }}
          >
            <TokenTile token={t} size={32} />
            <span>
              <span className="pri">{t}</span>
              <span className="sec">{TOKEN_INFO[t].name}</span>
            </span>
            <span>
              <span className="amt">{showAmount(t, v.rows[t].base)}</span>
              <span className="fiat">{v.rows[t].usd === null ? '—' : showUsd(v.rows[t].usd)}{t === 'NOC' ? ' at stage price' : ''}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/app/__tests__/Switcher.test.tsx src/app/__tests__/TokenSheet.test.tsx`
Expected: PASS — 2 files, 11 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 71 files, 869 tests.

- [ ] **Step 6: Visual pass (spec §8.6).** These states are captured at 412 × 600 by Task 17's `e2e/visual.spec.ts` and reviewed there against the design: `43-account-switcher`. Nothing to do here but check the names still match the states this task built.

- [ ] **Step 7: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **select without reload:** in `Switcher.tsx` `select`, delete `await m.reload();`. Run `npx vitest run src/app/__tests__/Switcher.test.tsx` → RED: 1 failed ("selecting an account closes the sheet and #11 follows it").
  - **fresh reads while away (M5):** replace `if (refused || away) return;` with `if (refused) return;`. Run `npx vitest run src/app/__tests__/Switcher.test.tsx` → RED: 1 failed.
  - **no stop after a miss (M5):** delete `if (f.error === 'coordinator-refused' || f.error === 'unreachable') return;`. Run `npx vitest run src/app/__tests__/Switcher.test.tsx` → RED: 1 failed.
  - **the wall clock (L8):** replace `useNow(1_000, m.now)` with `useNow()`. Run `npx vitest run src/app/__tests__/Switcher.test.tsx` → RED: 1 failed.

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/app/__tests__/Switcher.test.tsx extension/src/app/__tests__/TokenSheet.test.tsx extension/src/app/screens/Switcher.tsx extension/src/app/screens/TokenSheet.tsx
git commit -m "feat(extension): the account switcher and #43's token sheet (B1b-2a §5.2, §4.3)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 14: #13 receive

**Files:**
- Create: `extension/src/app/screens/Receive.tsx`
- Test (create): `extension/src/app/__tests__/Receive.test.tsx`

**Interfaces:**
- Consumes: Task 12's model; Task 11's `QrCode`, `Toast`, `useCopy`, `TopBar`; `web/src/ui/AddressGroups.tsx`; Task 10's `parseAmount`/`formatAmount`.
- Produces:
  `screens/Receive.tsx`: `QR_DEBOUNCE_MS = 200`, `Receive({onBack})`.

Spec §5.3: "Public address" (→ adapted, D4), the QR of `solana:<address>` with the centre "N", "URI · solana:Gabc…xyz9", the card "WALLET ADDRESS" / "tap to copy" with the full address in groups of four (the card copies), "Request amount (optional)" (SOL only, `^\d+(\.\d{0,9})?$`), `[Copy address]`; a valid amount → "PAY · 2.480000 SOL", the QR of `…?amount=2.48&label=Noctura` rebuilt 200 ms after the last keystroke, "Requested amount", "SOL · ≈ $…" ("—" offline or without a price), `[Copy link]`; a copy → toast "Copied. Noctura does not clear your clipboard.", card header "COPIED TO CLIPBOARD" / "Noctura does not clear it afterwards.", the button "Copied" for 2 s, or "Copy failed". No Share (D19), no auto-clear (spec §4). Works offline (D36).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Receive.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderInWallet} from './harness';
import {Receive} from '../screens/Receive';
import {QR_DEBOUNCE_MS} from '../screens/Receive';
import {ACCOUNT} from '../../background/__tests__/fixtures';

// Spec §5.3 (#13).
const A = ACCOUNT.publicKey;
const short = `${A.slice(0, 4)}…${A.slice(-4)}`;
function clipboard(writeText: (v: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
}
const onBack = vi.fn();
async function openReceive() {
  const r = await renderInWallet(<Receive onBack={onBack} />);
  await waitFor(() => expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`));
  return r;
}

describe('#13 receive', () => {
  it('plain address: the QR of solana:<address>, the short URI, the full address in groups, Copy address', async () => {
    await openReceive();
    expect(screen.getByText('Receive')).toBeTruthy();
    expect(screen.getByText('Public address')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`);
    expect(screen.getByText(`solana:${short}`)).toBeTruthy();
    expect(screen.getByText('WALLET ADDRESS')).toBeTruthy();
    expect(screen.getByText('tap to copy')).toBeTruthy();
    const groups = [...(document.querySelector('.addr-groups')?.children ?? [])].map(c => c.textContent);
    expect(groups.join('')).toBe(A);
    expect(groups.every(g => (g ?? '').length <= 4)).toBe(true);
    expect(screen.getByText('Request amount (optional)')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Copy address'})).toBeTruthy();
    // D19 and D4: no Share, no shielded vocabulary; spec §4: nothing auto-clears.
    expect(screen.queryByText(/Share|Transparent|Shielded|auto-clears/)).toBeNull();
  });

  it('copy: "Copied" only when the clipboard accepted it — with the card header and the toast saying it is not cleared', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    await openReceive();
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    expect(writeText).toHaveBeenCalledWith(A);
    expect(await screen.findByText('Copied. Noctura does not clear your clipboard.')).toBeTruthy();
    expect(screen.getByText('COPIED TO CLIPBOARD')).toBeTruthy();
    expect(screen.getByText('Noctura does not clear it afterwards.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Copied'})).toBeTruthy();
  });

  it('a refused clipboard says "Copy failed", never "Copied"', async () => {
    clipboard(vi.fn().mockRejectedValue(new Error('denied')));
    await openReceive();
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    expect(await screen.findByRole('button', {name: 'Copy failed'})).toBeTruthy();
    expect(screen.queryByText('COPIED TO CLIPBOARD')).toBeNull();
  });

  it('pay request: the ribbon, the QR with amount and label (after 200 ms), the fiat line, Copy link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    await openReceive();
    fireEvent.change(screen.getByRole('textbox', {name: 'Request amount'}), {target: {value: '2.48'}});
    await act(async () => new Promise(r => setTimeout(r, QR_DEBOUNCE_MS + 20)));
    expect(screen.getByText('Requested amount')).toBeTruthy();
    expect(document.querySelector('.pay-ribbon')?.textContent).toBe('PAY · 2.480000 SOL');
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}?amount=2.48&label=Noctura`);
    expect(screen.getByText(`solana:${short}?amount=2.48`)).toBeTruthy();
    expect(screen.getByText('SOL · ≈ $372.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Copy link'}));
    expect(writeText).toHaveBeenCalledWith(`solana:${A}?amount=2.48&label=Noctura`);
    fireEvent.click(screen.getByRole('button', {name: 'Clear amount'}));
    await waitFor(() => expect(screen.getByText('Request amount (optional)')).toBeTruthy());
  });

  it('an amount with more places than SOL has is not a request', async () => {
    await openReceive();
    fireEvent.change(screen.getByRole('textbox', {name: 'Request amount'}), {target: {value: '1.0000000001'}});
    await act(async () => new Promise(r => setTimeout(r, QR_DEBOUNCE_MS + 20)));
    expect(document.querySelector('.pay-ribbon')).toBeNull();
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/Receive.test.tsx`
Expected: FAIL — `Failed to resolve import "../screens/Receive"`.

- [ ] **Step 3: Implement.**

Create `extension/src/app/screens/Receive.tsx`:

```tsx
import {useEffect, useState} from 'react';
import {useWallet} from '../WalletContext';
import {parseAmount, formatAmount} from '../../shared/amount';
import {shortAddress, showUsd} from '../format';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {QrCode} from '../ui/QrCode';
import {Toast} from '../ui/Toast';
import {ExtIcon} from '../ui/ExtIcon';
import {useCopy} from '../ui/useCopy';

/** The pay request's QR is rebuilt this long after the last keystroke. */
export const QR_DEBOUNCE_MS = 200;

/**
 * #13 receive (spec §5.3). Share is copy only (D19); the clipboard is never cleared (spec §4); the
 * shielded payment code is hidden (D4); the amount request is SOL only, as the design draws it.
 * Works offline (D36): the address is local, only the fiat line needs a price.
 */
export function Receive({onBack}: {onBack: () => void}) {
  const m = useWallet();
  const address = m.account?.publicKey ?? '';
  const [text, setText] = useState('');
  const [amount, setAmount] = useState<bigint | null>(null);
  const [copy, doCopy] = useCopy();
  const [toast, setToast] = useState(false);

  // 200 ms after the last keystroke, the request (and its QR) follows the field.
  useEffect(() => {
    const t = setTimeout(() => {
      const v = parseAmount(text, 9);
      setAmount(v !== null && v > 0n ? v : null);
    }, QR_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const decimal = amount === null ? null : formatAmount(amount, 9, {min: 0, max: 9});
  const uri = amount === null ? `solana:${address}` : `solana:${address}?amount=${decimal}&label=Noctura`;
  const shownUri = amount === null ? `solana:${shortAddress(address)}` : `solana:${shortAddress(address)}?amount=${decimal}`;
  const fiat = amount === null || m.prices?.sol == null || m.net.mode === 'offline' ? '—' : showUsd((Number(amount) / 1e9) * m.prices.sol);

  const copyNow = doCopy;
  useEffect(() => {
    if (copy === 'copied') setToast(true);
  }, [copy]);

  const copied = copy === 'copied';
  const buttonText = copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Copy failed' : amount === null ? 'Copy address' : 'Copy link';
  return (
    <div className="screen s-recv">
      <TopBar title="Receive" onBack={onBack} />
      <div className="scroll">
        <div className="mode-strip noc-overline">Public address</div>
        <div className="qr-card">
          {amount === null ? null : (
            <div className="pay-ribbon">
              PAY · <b>{formatAmount(amount, 9, {min: 6, max: 9})} SOL</b>
            </div>
          )}
          <div className="qr">
            <QrCode value={uri} label="QR code for receive" />
            <div className="center" aria-hidden="true">
              N
            </div>
          </div>
          <div className="noc-caption app-muted">
            URI · <span className="noc-mono">{shownUri}</span>
          </div>
        </div>
        <button type="button" className="addr-card app-addr-card" onClick={() => copyNow(address)} aria-label="Copy wallet address">
          <div className="lbl noc-overline">
            <span>{copied ? 'COPIED TO CLIPBOARD' : 'WALLET ADDRESS'}</span>
            <span className="noc-caption app-muted">{copied ? 'Noctura does not clear it afterwards.' : 'tap to copy'}</span>
          </div>
          <div className="addr noc-body-sm">
            <AddressGroups address={address} />
          </div>
        </button>
        <div className="amount-card">
          <div className="head">
            <span className="noc-overline">{amount === null ? 'Request amount (optional)' : 'Requested amount'}</span>
            {text === '' ? null : (
              <button type="button" className="clear-x" aria-label="Clear amount" onClick={() => setText('')}>
                <ExtIcon name="close" size={14} />
              </button>
            )}
          </div>
          <div className="input">
            <input className="app-amount-input noc-numeral" inputMode="decimal" aria-label="Request amount" placeholder="0.0" value={text} onChange={e => setText(e.target.value.trim())} />
            <span className="ticker">{amount === null ? 'SOL' : `SOL · ≈ ${fiat}`}</span>
          </div>
        </div>
      </div>
      <div className="sticky-bar">
        <button type="button" className="btn btn-primary" onClick={() => copyNow(amount === null ? address : uri)}>
          <ExtIcon name={copy === 'failed' ? 'close' : 'check'} size={18} />
          {buttonText}
        </button>
      </div>
      {toast ? <Toast text="Copied. Noctura does not clear your clipboard." onDone={() => setToast(false)} /> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/app/__tests__/Receive.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 72 files, 874 tests.

- [ ] **Step 6: Visual pass (spec §8.6).** These states are captured at 412 × 600 by Task 17's `e2e/visual.spec.ts` and reviewed there against the design: `13-plain-address`, `13-pay-request`. Nothing to do here but check the names still match the states this task built.

- [ ] **Step 7: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **the QR ignores the request:** replace the `const uri = …` line with ``const uri = `solana:${address}`;``. Run `npx vitest run src/app/__tests__/Receive.test.tsx` → RED: 1 failed.

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/app/__tests__/Receive.test.tsx extension/src/app/screens/Receive.tsx
git commit -m "feat(extension): #13 receive — QR, pay request, honest copy (B1b-2a §5.3)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 15: #26 activity, #41 empty, #27 detail and the one external link

**Files:**
- Create: `extension/src/app/explorer.ts`
- Create: `extension/src/app/history.ts`
- Create: `extension/src/app/screens/Activity.tsx`
- Create: `extension/src/app/screens/TxDetail.tsx`
- Test (create): `extension/e2e/historyFixtures.ts`
- Test (create): `extension/src/app/__tests__/Activity.test.tsx`
- Test (create): `extension/src/app/__tests__/TxDetail.test.tsx`
- Test (create): `extension/src/app/__tests__/links.test.ts`

**Interfaces:**
- Consumes: Task 12's model; Tasks 10–11; `web/src/ui/{AddressGroups,CopyButton}.tsx`; `core/fees/transferMarkup.ts` (`MAINNET_FEE_TREASURY`).
- Produces:
  - `history.ts`: `type Filter`, `FILTERS`, `isFilter`, `matches(item, filter)`, `rowText(item, accounts)`
  - `explorer.ts`: `EXPLORER_PREFIX`, `explorerUrl(signature): string | null`
  - `screens/Activity.tsx`: `PAGE_SIZE = 10`, `Activity({onTx, onReceive})`; `screens/TxDetail.tsx`: `FIND_PAGES = 3`, `ExplorerLink({signature})`, `TxDetail({signature, item?, onBack})`
  - `e2e/historyFixtures.ts` (shared by unit tests and the E2E; imports nothing from `core/`): `PRESALE_PROGRAM`, `USDC_MINT`, `COUNTERPARTY`, `sig(n)`, `sentSol`, `receivedUsdc`, `presalePurchase`, `otherTx`, `failedTx`

Spec §6.2: "Activity", chips All / Sent / Received / Purchases (D24; persisted per S4; they filter the loaded rows), refresh (D2), local-time sections ("TODAY · MAY 8", "YESTERDAY · MAY 7", "THIS WEEK", "THIS MONTH", "APRIL 2026"), rows sent / received / purchase / other / failed (Scope item 10), own accounts labelled ("to Your account: Savings"), `[Load more]` while the last page was full (10), a PENDING section on top (stand-in: opens nothing), the #42/D26 banners over what loaded. No fiat per row, no origin badge. §6.4 (#41): "No activity yet", the line, `[Receive crypto]`, "Use the refresh button to check again."; refresh active: "Checking the network…" / "Re-fetching through the Noctura server"; no "View popular dApps" (D25). §6.3 (#27): top bar "Transaction"; SENT / RECEIVED / FAILED / PRESALE PURCHASE / OTHER; "≈ $… now"; "Confirmed"; Type ("Transfer" / "USDC transfer"), From / To with the full address in groups and `CopyButton`, labels, Hash, fee ("Paid by sender" for a receive), Date; the failed banner; reached by signature only, it reads at most 3 history pages, else "This transaction is not in the recent history yet." §6.5: `[Explorer]` is `<a href="https://solscan.io/tx/<signature>" target="_blank" rel="noopener noreferrer">`, the signature checked (base58, 64 bytes) first; a source test proves no other URL, no `window.open`, and `tabs.create` only in `platform.ts`. Review M4: Activity and #27 report a 403 / no-answer to the model, so a 403 on Activity disables Home's refresh too, with no further request. Review L3: a failed row's amount is "—", never "— SOL". Failed rows keep the "Failed · transaction" stand-in (ruling; plan 3 asks the owner).

- [ ] **Step 1: Write the failing tests.**

Create `extension/e2e/historyFixtures.ts`:

```ts
import {base58} from '@scure/base';

/**
 * getTransaction (jsonParsed) results of each kind the engine decodes (core/solana/history.ts), for
 * the activity screens — unit tests and the E2E's fake coordinator both use these. Public constants
 * only; nothing here is imported from core/ (the E2E rule).
 */
export const PRESALE_PROGRAM = '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const COUNTERPARTY = 'H4qZoWSv5iyeysmHzYnVfqVBtSfoJTZQJ33YtjAXm2N1';

/** A well-formed transaction signature (64 bytes, base58), different for each n. */
export const sig = (n: number): string => base58.encode(Uint8Array.from({length: 64}, (_, i) => (n * 7 + i) % 251 || 1));

const tx = (blockTime: number, meta: object, accountKeys: string[], instructions: object[]) => ({
  blockTime,
  meta: {err: null, fee: 5000, preTokenBalances: [], postTokenBalances: [], ...meta},
  transaction: {message: {accountKeys: accountKeys.map(pubkey => ({pubkey})), instructions}},
});

export function sentSol(owner: string, to: string, lamports: number, blockTime: number) {
  return tx(blockTime, {preBalances: [10_000_000_000, 0], postBalances: [10_000_000_000 - lamports - 5000, lamports]}, [owner, to], [
    {program: 'system', parsed: {type: 'transfer', info: {source: owner, destination: to, lamports}}},
  ]);
}

export function receivedUsdc(owner: string, from: string, amount: number, blockTime: number) {
  const bal = (who: string, a: number) => ({owner: who, mint: USDC_MINT, uiTokenAmount: {amount: String(a), decimals: 6}});
  return tx(
    blockTime,
    {preBalances: [1, 1], postBalances: [1, 1], preTokenBalances: [bal(owner, 0), bal(from, amount)], postTokenBalances: [bal(owner, amount), bal(from, 0)]},
    [from, owner],
    [],
  );
}

export function presalePurchase(owner: string, lamports: number, blockTime: number) {
  return tx(blockTime, {preBalances: [10_000_000_000], postBalances: [10_000_000_000 - lamports - 5000]}, [owner, PRESALE_PROGRAM], [{programId: PRESALE_PROGRAM, data: 'x'}]);
}

export function otherTx(owner: string, blockTime: number) {
  return tx(blockTime, {preBalances: [1_000], postBalances: [1_000], fee: 0}, [COUNTERPARTY, owner], []);
}

export function failedTx(owner: string, blockTime: number) {
  return {...sentSol(owner, COUNTERPARTY, 1_000_000, blockTime), meta: {err: {InstructionError: [0, 'Custom']}, fee: 5000, preBalances: [1, 1], postBalances: [1, 1]}};
}
```

Create `extension/src/app/__tests__/Activity.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, walletReader} from './harness';
import {Activity} from '../screens/Activity';
import {Home} from '../screens/Home';
import {PENDING_KEY} from '../../background/pendingStore';
import {ACTIVITY_FILTER_KEY} from '../prefs';
import {REFUSED_TEXT} from '../ui/Banner';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {COUNTERPARTY, failedTx, otherTx, presalePurchase, receivedUsdc, sentSol, sig} from '../../../e2e/historyFixtures';

// Spec §6.2 (#26) and §6.4 (#41).
const NOW = Math.floor(Date.now() / 1000);
function historyReader(n = 5) {
  const txs: Record<string, unknown> = {
    [sig(1)]: sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW - 60),
    [sig(2)]: receivedUsdc(ACCOUNT.publicKey, COUNTERPARTY, 250_000_000, NOW - 120),
    [sig(3)]: presalePurchase(ACCOUNT.publicKey, 1_000_000_000, NOW - 180),
    [sig(4)]: otherTx(ACCOUNT.publicKey, NOW - 240),
    [sig(5)]: failedTx(ACCOUNT.publicKey, NOW - 300),
  };
  const list = Array.from({length: n}, (_, i) => sig(i + 1));
  for (let i = 6; i <= n; i++) txs[sig(i)] = otherTx(ACCOUNT.publicKey, NOW - 300 - i);
  return walletReader({
    getSignaturesForAddress: async (_a, o) => {
      const from = o.before === undefined ? 0 : list.indexOf(o.before) + 1;
      return list.slice(from, from + o.limit).map(s => ({signature: s, blockTime: null, err: null}));
    },
    getTransaction: async s => txs[s] ?? null,
  });
}

const nav = {onTx: vi.fn(), onReceive: vi.fn()};
async function openActivity(reader = historyReader(), before?: NonNullable<Parameters<typeof renderInWallet>[1]>['before']) {
  return renderInWallet(<Activity {...nav} />, {reader, before});
}

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('#26 activity', () => {
  it('rows per kind: sent (own account label), received, purchase, other, failed — no fiat, no origin badge', async () => {
    await openActivity();
    expect(await screen.findByText('Sent SOL')).toBeTruthy();
    const sent = screen.getByText('Sent SOL').closest('button') as HTMLElement;
    expect(within(sent).getByText(/^to Your account: Savings · /)).toBeTruthy();
    expect(within(sent).getByText('−2.4800')).toBeTruthy();
    const received = screen.getByText('Received USDC').closest('button') as HTMLElement;
    expect(within(received).getByText(/^from H4qZ…m2N1 · /)).toBeTruthy();
    expect(within(received).getByText('+250.00')).toBeTruthy();
    expect(screen.getByText('Presale purchase')).toBeTruthy();
    expect(screen.getByText(/^no transfer to or from this account/)).toBeTruthy();
    expect(screen.getByText('Failed · transaction')).toBeTruthy();
    expect(screen.getByText(/^the network fee was charged · /)).toBeTruthy();
    expect(screen.getByText(/^TODAY · /)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\$\d|Wallet|Dapp|Swaps|Shielded/);
    fireEvent.click(sent);
    expect(nav.onTx).toHaveBeenCalledWith(expect.objectContaining({signature: sig(1), kind: 'sent', amount: 2_480_000_000n}));
  });

  it('filters Sent / Received / Purchases apply to the loaded rows, and the choice is remembered', async () => {
    await openActivity();
    await screen.findByText('Sent SOL');
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['All', 'Sent', 'Received', 'Purchases']);
    fireEvent.click(screen.getByRole('tab', {name: 'Sent'}));
    expect(screen.getByText('Sent SOL')).toBeTruthy();
    expect(screen.queryByText('Received USDC')).toBeNull();
    fireEvent.click(screen.getByRole('tab', {name: 'Received'}));
    expect(screen.getByText('Received USDC')).toBeTruthy();
    expect(screen.queryByText('Sent SOL')).toBeNull();
    fireEvent.click(screen.getByRole('tab', {name: 'Purchases'}));
    expect(screen.getByText('Presale purchase')).toBeTruthy();
    expect(localStorage.getItem(ACTIVITY_FILTER_KEY)).toBe('purchases');
  });

  it('"Load more" while the last page was full, continuing from its last signature', async () => {
    await openActivity(historyReader(12));
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}));
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Load more'})).toBeNull());
    expect(document.querySelectorAll('button.tx-row')).toHaveLength(12);
  });

  it('open sends on top, in a PENDING section', async () => {
    await openActivity(historyReader(), ext =>
      ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now() - 72_000})]),
    );
    expect(await screen.findByText('PENDING')).toBeTruthy();
    expect(screen.getByText('Sending 2.48 SOL')).toBeTruthy();
    expect(screen.getByText(/^waiting · 1 m \d+ s$/)).toBeTruthy();
  });

  it('unreachable and refused show their banners over what loaded', async () => {
    const down = walletReader({
      getSignaturesForAddress: async () => {
        throw new RequestUnreachable('u', 'x');
      },
    });
    await openActivity(down);
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
  });

  it('a 403 is the D26 banner', async () => {
    const refused = walletReader({
      getSignaturesForAddress: async () => {
        throw new RpcForbidden('getSignaturesForAddress');
      },
    });
    await openActivity(refused);
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
  });
});

describe('#41 empty activity', () => {
  it('no rows and no open send: the empty state, Receive crypto → #13; no "View popular dApps"', async () => {
    await openActivity(walletReader());
    expect(await screen.findByText('No activity yet')).toBeTruthy();
    expect(screen.getByText('Your transactions will appear here once you send or receive assets.')).toBeTruthy();
    expect(screen.getByText('Use the refresh button to check again.')).toBeTruthy();
    expect(screen.queryByText('View popular dApps')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Receive crypto'}));
    expect(nav.onReceive).toHaveBeenCalledTimes(1);
  });

  it('refresh active: "Checking the network…" while it reads again', async () => {
    let calls = 0;
    const reader = walletReader({
      getSignaturesForAddress: async () => {
        calls += 1;
        if (calls > 1) await new Promise(() => undefined);
        return [];
      },
    });
    await openActivity(reader);
    await screen.findByText('No activity yet');
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText('Checking the network…')).toBeTruthy();
    expect(screen.getByText('Re-fetching through the Noctura server')).toBeTruthy();
  });

  // Review M4: a 403 on any screen is the whole app's D26 state — Home's refresh is disabled too, and nothing more is asked.
  it('a 403 on Activity disables Home\u2019s refresh; no further coordinator request', async () => {
    let reads = 0;
    const reader = walletReader({
      getBalance: async () => (reads++, 62_482_100_000n),
      getSignaturesForAddress: async () => {
        reads++;
        throw new RpcForbidden('getSignaturesForAddress');
      },
    });
    await renderInWallet(
      <>
        <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
        <Activity {...nav} />
      </>,
      {reader},
    );
    await waitFor(() => expect(screen.getAllByText(REFUSED_TEXT).length).toBe(2));
    const refresh = screen.getAllByRole('button', {name: 'Refresh'});
    expect(refresh.every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    const seen = reads;
    for (const b of refresh) fireEvent.click(b);
    await new Promise(r => setTimeout(r, 50));
    expect(reads).toBe(seen);
  });
});
```

Create `extension/src/app/__tests__/TxDetail.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {render, screen, waitFor} from '@testing-library/react';
import {base58} from '@scure/base';
import {renderInWallet, walletReader} from './harness';
import {ExplorerLink, TxDetail} from '../screens/TxDetail';
import {explorerUrl} from '../explorer';
import type {HistoryItem} from '../engine';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {COUNTERPARTY, sentSol, sig} from '../../../e2e/historyFixtures';

// Spec §6.3 (#27) and §6.5 (the one external link).
const NOW = Math.floor(Date.now() / 1000);
const item = (over: Partial<HistoryItem>): HistoryItem => ({
  signature: sig(1),
  blockTime: NOW,
  kind: 'sent',
  token: 'SOL',
  mint: null,
  amount: 2_480_000_000n,
  counterparty: RECIPIENT,
  feeLamports: 5_000n,
  failed: false,
  ...over,
});
const show = async (i: HistoryItem) => {
  const w = await renderInWallet(<TxDetail signature={i.signature} item={i} onBack={() => undefined} />);
  // The account is read by the provider's open sequence; its address then appears on the page.
  await waitFor(() => expect(document.body.textContent).toContain(ACCOUNT.publicKey));
  return w;
};

describe('#27 tx-detail', () => {
  it('a send: eyebrow, amount, fiat "now", Confirmed; From (name + full address), To (full, labelled), Hash, fee, date, Explorer', async () => {
    await show(item({}));
    expect(screen.getByText('SENT')).toBeTruthy();
    expect(screen.getByText('−2.4800 SOL')).toBeTruthy();
    expect(await screen.findByText('≈ $372.00 now')).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText('Transfer')).toBeTruthy();
    expect(screen.getByText('Your account: Savings')).toBeTruthy();
    // Full addresses in groups of four (AddressGroups): the groups join to the exact address.
    const groups = [...document.querySelectorAll('.addr-groups')].map(g => [...g.children].map(c => c.textContent).join(''));
    expect(groups).toEqual([ACCOUNT.publicKey, RECIPIENT, sig(1)]);
    expect(screen.getByText('0.000005 SOL')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Copy recipient'})).toBeTruthy();
    // Absent by decision: Block and Memo (G13), Save (B1b-2b), share (D19).
    for (const gone of ['Block', 'Memo', 'Save', 'Share']) expect(screen.queryByText(gone)).toBeNull();
    expect((screen.getByRole('link', {name: 'Explorer'}) as HTMLAnchorElement).getAttribute('href')).toBe(`https://solscan.io/tx/${sig(1)}`);
  });

  it('an SPL send reads "USDC transfer"', async () => {
    await show(item({token: 'USDC', amount: 12_000_000n}));
    expect(screen.getByText('USDC transfer')).toBeTruthy();
    expect(screen.getByText('−12.00 USDC')).toBeTruthy();
  });

  it('a receive: RECEIVED, +amount, To "Your wallet", fee paid by sender', async () => {
    await show(item({kind: 'received', token: 'USDC', amount: 250_000_000n, counterparty: COUNTERPARTY}));
    expect(screen.getByText('RECEIVED')).toBeTruthy();
    expect(screen.getByText('+250.00 USDC')).toBeTruthy();
    expect(screen.getByText('Your wallet')).toBeTruthy();
    expect(screen.getByText('Paid by sender')).toBeTruthy();
  });

  it('a failed transaction: the danger pill and banner, the fee charged; no Try again in plan 1', async () => {
    const w = renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} />);
    await w;
    expect(await screen.findByText('FAILED')).toBeTruthy();
    // No token is known for a failed row: a dash, never "— SOL" (review L3).
    expect(document.querySelector('.amount-card .amt')?.textContent).toBe('—');
    expect(screen.getByText('Fee charged')).toBeTruthy();
    expect(document.querySelector('.status-pill.fail')?.textContent).toBe('Failed');
    expect(screen.getByText('The transaction failed on chain. The network fee was charged; the amount did not move.')).toBeTruthy();
    expect(screen.getByText('Network fee charged')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('a presale purchase and an other: their eyebrows and the decoded fields that exist', async () => {
    renderInWallet(<TxDetail signature={sig(3)} item={item({signature: sig(3), kind: 'purchase', amount: 1_000_000_000n, counterparty: null})} onBack={() => undefined} />);
    expect(await screen.findByText('PRESALE PURCHASE')).toBeTruthy();
    expect(screen.getByText('−1.0000 SOL')).toBeTruthy();
  });

  it('reached by signature only: reads history pages until it finds it; not found in 3 pages → the not-yet line and the explorer link', async () => {
    const reader = walletReader({
      getSignaturesForAddress: async () => [{signature: sig(1), blockTime: NOW, err: null}],
      getTransaction: async () => sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW),
    });
    await renderInWallet(<TxDetail signature={sig(1)} onBack={() => undefined} />, {reader});
    expect(await screen.findByText('SENT')).toBeTruthy();
  });

  it('not in the recent history: the line, and still the explorer link', async () => {
    let pages = 0;
    const reader = walletReader({getSignaturesForAddress: async () => (pages++, [])});
    await renderInWallet(<TxDetail signature={sig(8)} onBack={() => undefined} />, {reader});
    expect(await screen.findByText('This transaction is not in the recent history yet.')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
    await waitFor(() => expect(pages).toBe(1));
  });
});

describe('the explorer link (§6.5)', () => {
  it('Solscan, a new tab, no opener, no referrer — and only for a real signature', () => {
    render(<ExplorerLink signature={sig(9)} />);
    const a = screen.getByRole('link', {name: 'Explorer'}) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe(`https://solscan.io/tx/${sig(9)}`);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(explorerUrl('not-a-signature')).toBeNull();
    expect(explorerUrl(ACCOUNT.publicKey)).toBeNull(); // 32 bytes: an address, not a signature
    // In the signature's length range, but 48 bytes: not a signature either.
    const notASignature = base58.encode(new Uint8Array(48).fill(7));
    expect(notASignature.length).toBeGreaterThanOrEqual(64);
    expect(explorerUrl(notASignature)).toBeNull();
    expect(explorerUrl(`${sig(9)}?x=1`)).toBeNull();
  });
});
```

Create `extension/src/app/__tests__/links.test.ts`:

```ts
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Spec §6.5: Solscan is the ONLY external link. Over every file of src/app (tests aside): an href is a
// Solscan URL built by explorer.ts or absent; nothing calls window.open; tabs.create is reached only
// through platform.ts, whose targets are a closed list of extension pages.
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap(e => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return e === '__tests__' ? [] : files(p);
    return /\.(ts|tsx)$/.test(e) ? [p] : [];
  });
}

describe('links out of the UI', () => {
  const sources = files(APP).map(p => ({path: relative(APP, p), text: readFileSync(p, 'utf8')}));

  it('reads the real tree (positive control)', () => {
    expect(sources.map(s => s.path)).toEqual(expect.arrayContaining(['explorer.ts', 'platform.ts', 'screens/TxDetail.tsx']));
  });

  it('no URL but Solscan’s and the extension’s own pages', () => {
    for (const {path, text} of sources) {
      for (const m of text.matchAll(/https?:\/\/[^\s'"`)]+/g)) expect(`${path}: ${m[0]}`).toBe(`${path}: https://solscan.io/tx/`);
    }
  });

  it('no window.open, and tabs.create only in platform.ts', () => {
    for (const {path, text} of sources) {
      expect(`${path}: ${/\bwindow\.open\b|\bopen\s*\(\s*['"`]http/.test(text)}`).toBe(`${path}: false`);
      if (path !== 'platform.ts') expect(`${path}: ${/tabs\.create/.test(text)}`).toBe(`${path}: false`);
    }
  });

  it('every href is the explorer link', () => {
    for (const {path, text} of sources) {
      for (const m of text.matchAll(/\bhref=\{?([^\s>}]+)/g)) expect(`${path}: ${m[1]}`).toBe('screens/TxDetail.tsx: href');
    }
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/Activity.test.tsx src/app/__tests__/TxDetail.test.tsx src/app/__tests__/links.test.ts`
Expected: FAIL — `links.test.ts` positive control (`explorer.ts`, `screens/TxDetail.tsx` absent) and `Failed to resolve import "../screens/Activity"` / `TxDetail`.

- [ ] **Step 3: Implement.**

Create `extension/src/app/explorer.ts`:

```ts
import {base58} from '@scure/base';

/** The one external link (spec §6.5, D37): Solscan, as the design names it. A link only — nothing is fetched. */
export const EXPLORER_PREFIX = 'https://solscan.io/tx/';

/** A signature is checked (base58, 64 bytes) before it is put in the URL; anything else has no link. */
export function explorerUrl(signature: string): string | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) return null;
  try {
    return base58.decode(signature).length === 64 ? `${EXPLORER_PREFIX}${signature}` : null;
  } catch {
    return null;
  }
}
```

Create `extension/src/app/history.ts`:

```ts
import type {Account, HistoryItem} from './engine';
import {shortAddress, showAmount} from './format';

export type Filter = 'all' | 'sent' | 'received' | 'purchases';
export const FILTERS: readonly {value: Filter; text: string}[] = [
  {value: 'all', text: 'All'},
  {value: 'sent', text: 'Sent'},
  {value: 'received', text: 'Received'},
  {value: 'purchases', text: 'Purchases'},
];
export const isFilter = (x: string | null): x is Filter => x === 'all' || x === 'sent' || x === 'received' || x === 'purchases';

/** D24: the filters apply to the rows already loaded; "Load more" continues underneath. */
export function matches(item: HistoryItem, f: Filter): boolean {
  if (f === 'all') return true;
  if (item.failed) return false;
  if (f === 'sent') return item.kind === 'sent';
  if (f === 'received') return item.kind === 'received';
  return item.kind === 'purchase';
}

/** An own account's label, for "to Your account: Savings" (spec §3 labels). */
function counterpartyText(address: string | null, accounts: readonly Account[]): string {
  if (address === null) return 'an unknown address';
  const own = accounts.find(a => a.publicKey === address);
  return own === undefined ? shortAddress(address) : `Your account: ${own.name}`;
}

const MINUS = '−';

/** One #26 row's words: title, meta (before the time), amount, and its tone. */
export function rowText(item: HistoryItem, accounts: readonly Account[]): {title: string; meta: string; amount: string; tone: 'send' | 'recv' | 'swap' | 'fail'} {
  if (item.failed) {
    // The engine decodes a failed transaction as `other` with no token (core/solana/history.ts): the
    // kind and token of what was attempted are not known here.
    const what = item.kind === 'other' || item.token === null ? 'transaction' : `${item.kind} ${item.token}`;
    return {title: `Failed · ${what}`, meta: 'the network fee was charged', amount: '—', tone: 'fail'};
  }
  const amount = (sign: string) => (item.amount === null || item.token === null ? '—' : `${sign}${showAmount(item.token, item.amount)}`);
  switch (item.kind) {
    case 'sent':
      return {title: `Sent ${item.token ?? ''}`.trim(), meta: `to ${counterpartyText(item.counterparty, accounts)}`, amount: amount(MINUS), tone: 'send'};
    case 'received':
      return {title: `Received ${item.token ?? ''}`.trim(), meta: `from ${counterpartyText(item.counterparty, accounts)}`, amount: amount('+'), tone: 'recv'};
    case 'purchase':
      return {title: 'Presale purchase', meta: 'NOC', amount: amount(MINUS), tone: 'swap'};
    case 'other':
      return {title: 'Other transaction', meta: 'no transfer to or from this account', amount: '—', tone: 'swap'};
  }
}
```

Create `extension/src/app/screens/Activity.tsx`:

```tsx
import {useCallback, useEffect, useState} from 'react';
import {useWallet} from '../WalletContext';
import {ACTIVITY_FILTER_KEY, readPref, writePref} from '../prefs';
import {FILTERS, isFilter, matches, rowText, type Filter} from '../history';
import {TOKEN_INFO, dateSection, timeOfDay} from '../format';
import {formatAmount} from '../../shared/amount';
import {useNow} from '../useNow';
import {ChipRow} from '../ui/Chip';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import type {HistoryItem, Pending} from '../engine';

/** wallet.history answers 10 per page (background HISTORY_PAGE_SIZE); a full page means there may be more. */
export const PAGE_SIZE = 10;

function PendingRow({p, now}: {p: Pending; now: number}) {
  const secs = Math.max(0, Math.floor((now - p.createdAt) / 1000));
  const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
  // Plan-1 stand-in: a pending row opens nothing (#21/#54 arrive with the send flow, plan 3).
  return (
    <div className="tx-row" data-pending={p.id}>
      <span className="ic send">
        <ExtIcon name="arrow-up-right" size={20} />
      </span>
      <div className="meta">
        <span className="pri noc-body-lg">
          Sending {amount} {p.intent.token}
        </span>
        <span className="sec noc-body-sm">
          waiting · {Math.floor(secs / 60)} m {secs % 60} s
        </span>
      </div>
    </div>
  );
}

/** #41 empty-activity (spec §6.4). */
function Empty({refreshing, onReceive}: {refreshing: boolean; onReceive: () => void}) {
  return (
    <div className="app-empty">
      <div className="s8-empty-illust">
        <div className="ring1" />
        <svg width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      {refreshing ? (
        <div className="s8-empty-copy">
          <h3 className="noc-h2">Checking the network…</h3>
          <p className="noc-body">Re-fetching through the Noctura server</p>
        </div>
      ) : (
        <div className="s8-empty-copy">
          <h3 className="noc-h2">No activity yet</h3>
          <p className="noc-body">Your transactions will appear here once you send or receive assets.</p>
        </div>
      )}
      <div className="app-empty-actions">
        <button type="button" className="btn btn-primary" onClick={onReceive}>
          <ExtIcon name="receive" size={18} />
          Receive crypto
        </button>
      </div>
      <p className="noc-caption app-muted app-center-text">Use the refresh button to check again.</p>
    </div>
  );
}

/**
 * #26 activity (spec §6.2) and #41 when there is nothing. Rows from wallet.history (10 a page, paced by
 * the background), open sends on top. No fiat per row (it would need historical prices), no origin
 * badge (B1c), counterparties short at equal weight (a list is a scanning aid; #27 shows the whole address).
 */
export function Activity({onTx, onReceive}: {onTx: (item: HistoryItem) => void; onReceive: () => void}) {
  const m = useWallet();
  const now = useNow();
  const account = m.account;
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(() => {
    const saved = readPref(ACTIVITY_FILTER_KEY);
    return isFilter(saved) ? saved : 'all';
  });
  const refused = m.net.mode === 'refused' || error === 'coordinator-refused';

  const key = account?.publicKey ?? null;
  const {engine, report} = m;
  const load = useCallback(async () => {
    if (key === null) return;
    setBusy(true);
    const r = await engine.history(key);
    setBusy(false);
    if (r.ok) {
      setItems(r.data);
      setFull(r.data.length === PAGE_SIZE);
      setError(null);
    } else {
      setError(r.error);
      report(r.error);
    }
  }, [key, engine, report]);

  // Read on open (and when the selected account changes); after that only the refresh button reads (D2).
  useEffect(() => {
    if (m.net.mode !== 'refused') void load();
  }, [load]);

  const more = async () => {
    if (account === null || items === null || items.length === 0) return;
    setBusy(true);
    const r = await m.engine.history(account.publicKey, items[items.length - 1]?.signature);
    setBusy(false);
    if (r.ok) {
      setItems([...items, ...r.data]);
      setFull(r.data.length === PAGE_SIZE);
    } else {
      setError(r.error);
      m.report(r.error);
    }
  };

  const choose = (f: Filter) => {
    setFilter(f);
    writePref(ACTIVITY_FILTER_KEY, f);
  };

  const open = m.pending.filter(p => p.account === account?.publicKey && (p.state === 'pending' || p.state === 'stuck'));
  const shown = (items ?? []).filter(i => matches(i, filter));
  const accounts = m.wallet?.accounts ?? [];
  const sections: {title: string; rows: HistoryItem[]}[] = [];
  for (const item of shown) {
    const title = dateSection(item.blockTime === null ? null : item.blockTime * 1000, now);
    const last = sections[sections.length - 1];
    if (last !== undefined && last.title === title) last.rows.push(item);
    else sections.push({title, rows: [item]});
  }

  const banner = refused ? (
    <RefusedBanner />
  ) : error === 'unreachable' ? (
    <Banner tone="warning" icon="wifi-off" title={m.net.mode === 'offline' ? "You're offline" : 'Could not reach the Noctura server'} />
  ) : null;

  const top = (
    <div className="s-vi-top">
      <div className="left">
        <h1 className="noc-h1">Activity</h1>
      </div>
      <div className="right">
        <button type="button" className={`icon-btn${busy ? ' is-spinning' : ''}`} aria-label="Refresh" disabled={refused || busy} onClick={() => void load()}>
          <ExtIcon name="refresh" size={22} />
        </button>
      </div>
    </div>
  );

  if (items !== null && items.length === 0 && open.length === 0 && error === null) {
    return (
      <div className="screen s-act">
        {top}
        <Empty refreshing={busy} onReceive={onReceive} />
      </div>
    );
  }

  return (
    <div className="screen s-act">
      {top}
      <ChipRow options={FILTERS} active={filter} onChange={choose} label="Filter" />
      {banner}
      <div className="scroll">
        {open.length > 0 ? (
          <>
            <div className="date-h noc-overline">PENDING</div>
            {open.map(p => (
              <PendingRow key={p.id} p={p} now={now} />
            ))}
          </>
        ) : null}
        {items === null && error === null ? (
          <div data-testid="skeleton">
            {['TODAY', 'YESTERDAY'].map((t, s) => (
              <div key={t}>
                <div className="date-h noc-overline">{t}</div>
                {Array.from({length: s === 0 ? 2 : 3}, (_, i) => (
                  <div className="tx-row skel" key={i}>
                    <span className="ic" />
                    <div className="meta">
                      <span className="pri" />
                      <span className="sec" />
                    </div>
                    <span className="amt" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        {sections.map(s => (
          <div key={s.title}>
            <div className="date-h noc-overline">{s.title}</div>
            {s.rows.map(item => {
              const t = rowText(item, accounts);
              const time = item.blockTime === null ? '' : ` · ${timeOfDay(item.blockTime * 1000)}`;
              return (
                <button type="button" className="tx-row" key={item.signature} onClick={() => onTx(item)}>
                  <span className={`ic ${t.tone}`}>
                    <ExtIcon name={t.tone === 'fail' ? 'close' : 'arrow-up-right'} size={20} />
                  </span>
                  <span className="meta">
                    <span className="pri noc-body-lg">{t.title}</span>
                    <span className="sec noc-body-sm">
                      {t.meta}
                      {time}
                    </span>
                  </span>
                  <span className={`amt noc-body-lg noc-numeral${t.tone === 'recv' ? ' up' : t.tone === 'fail' ? ' fail' : ''}`}>{t.amount}</span>
                </button>
              );
            })}
          </div>
        ))}
        {full ? (
          <button type="button" className="btn btn-secondary app-load-more" disabled={busy || refused} onClick={() => void more()}>
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
```

Create `extension/src/app/screens/TxDetail.tsx`:

```tsx
import {useEffect, useState, type ReactNode} from 'react';
import {useWallet} from '../WalletContext';
import {TOKEN_INFO, fullDate, showAmount, showSol, showUsd} from '../format';
import {explorerUrl} from '../explorer';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {CopyButton} from '../../../../web/src/ui/CopyButton';
import {TopBar} from '../ui/TopBar';
import {StatusPill} from '../ui/StatusPill';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner} from '../ui/Banner';
import type {HistoryItem} from '../engine';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';

/** At most this many history pages are read to find a signature the list has not loaded. */
export const FIND_PAGES = 3;
const MINUS = '−';

function Row({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="detail-row">
      <span className="lbl noc-body-sm">{label}</span>
      <span className="val">{children}</span>
    </div>
  );
}

function Address({address, label}: {address: string; label: string}) {
  return (
    <>
      <span className="mono-addr">
        <AddressGroups address={address} />
      </span>
      <CopyButton value={address} label={label} />
    </>
  );
}

export function ExplorerLink({signature}: {signature: string}) {
  const href = explorerUrl(signature);
  if (href === null) return null;
  return (
    <a className="btn btn-secondary" href={href} target="_blank" rel="noopener noreferrer">
      <ExtIcon name="link-out" size={16} />
      Explorer
    </a>
  );
}

/**
 * #27 tx-detail (spec §6.3), from the #26 row (or, when only the signature is known, the first
 * FIND_PAGES history pages). No Block or Memo rows (not in HistoryView, G13), no Save (address book,
 * B1b-2b), no share (D19); fiat is today's price and says "now". Plan-1 stand-in: no [Try again].
 */
export function TxDetail({signature, item: given, onBack}: {signature: string; item?: HistoryItem; onBack: () => void}) {
  const m = useWallet();
  const [item, setItem] = useState<HistoryItem | null | undefined>(given);
  const owner = m.account?.publicKey ?? '';

  useEffect(() => {
    if (given !== undefined) return;
    let alive = true;
    void (async () => {
      let before: string | undefined;
      for (let page = 0; page < FIND_PAGES; page++) {
        const r = await m.engine.history(owner, before);
        if (!alive) return;
        if (!r.ok) {
          m.report(r.error);
          break;
        }
        const hit = r.data.find(i => i.signature === signature);
        if (hit !== undefined) return setItem(hit);
        if (r.data.length === 0) break;
        before = r.data[r.data.length - 1]?.signature;
      }
      if (alive) setItem(null);
    })();
    return () => {
      alive = false;
    };
  }, [given, owner, signature, m.engine]);

  const top = <TopBar title="Transaction" onBack={onBack} titleClass="noc-h3" />;
  if (item === undefined) return <div className="screen s-txd">{top}</div>;
  if (item === null) {
    return (
      <div className="screen s-txd">
        {top}
        <div className="scroll">
          <p className="noc-body app-muted">This transaction is not in the recent history yet.</p>
          <div className="actions-row">
            <ExplorerLink signature={signature} />
          </div>
        </div>
      </div>
    );
  }

  const account = m.account;
  const accounts = m.wallet?.accounts ?? [];
  const labelOf = (address: string | null): string | null => {
    if (address === null) return null;
    const own = accounts.find(a => a.publicKey === address);
    if (own !== undefined) return `Your account: ${own.name}`;
    return address === MAINNET_FEE_TREASURY ? 'Noctura treasury' : null;
  };
  const price = item.token === null ? null : item.token === 'NOC' ? null : m.prices?.[item.token === 'SOL' ? 'sol' : item.token === 'USDC' ? 'usdc' : 'usdt'] ?? null;
  const fiat = item.amount === null || item.token === null || price === null ? null : (Number(item.amount) / 10 ** TOKEN_INFO[item.token].decimals) * price;
  const date = item.blockTime === null ? '—' : fullDate(item.blockTime * 1000);
  const hash = <Address address={item.signature} label="Copy hash" />;

  if (item.failed) {
    return (
      <div className="screen s-txd">
        {top}
        <div className="scroll">
          <div className="amount-card">
            <div className="eyebrow noc-overline">{item.kind === 'sent' ? 'FAILED · SENT' : 'FAILED'}</div>
            <div className="amt noc-balance-lg noc-numeral">{item.token === null ? '—' : `— ${item.token}`}</div>
            <div className="fiat noc-body">Fee charged</div>
            <StatusPill text="Failed" fail />
          </div>
          <Banner tone="danger" title="The transaction failed on chain. The network fee was charged; the amount did not move." />
          <div className="detail-card">
            <Row label="Hash">{hash}</Row>
            <Row label="Network fee charged">
              <span className="noc-body noc-numeral">{showSol(item.feeLamports)} SOL</span>
            </Row>
            <Row label="Date">
              <span className="noc-body">{date}</span>
            </Row>
          </div>
          <div className="actions-row">
            <ExplorerLink signature={item.signature} />
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === 'purchase' || item.kind === 'other') {
    return (
      <div className="screen s-txd">
        {top}
        <div className="scroll">
          <div className="amount-card">
            <div className="eyebrow noc-overline">{item.kind === 'purchase' ? 'PRESALE PURCHASE' : 'OTHER'}</div>
            {item.amount !== null && item.token !== null ? (
              <div className="amt noc-balance-lg noc-numeral">
                {MINUS}
                {showAmount(item.token, item.amount)} {item.token}
              </div>
            ) : null}
            <StatusPill text="Confirmed" />
          </div>
          <div className="detail-card">
            <Row label="Hash">{hash}</Row>
            <Row label="Network fee">
              <span className="noc-body noc-numeral">{showSol(item.feeLamports)} SOL</span>
            </Row>
            <Row label="Date">
              <span className="noc-body">{date}</span>
            </Row>
          </div>
          <div className="actions-row">
            <ExplorerLink signature={item.signature} />
          </div>
        </div>
      </div>
    );
  }

  const sent = item.kind === 'sent';
  const token = item.token ?? 'SOL';
  const toLabel = labelOf(item.counterparty);
  return (
    <div className="screen s-txd">
      {top}
      <div className="scroll">
        <div className="amount-card">
          <div className="eyebrow noc-overline">{sent ? 'SENT' : 'RECEIVED'}</div>
          <div className="amt noc-balance-lg noc-numeral">
            {sent ? MINUS : '+'}
            {item.amount === null ? '—' : showAmount(token, item.amount)} {token}
          </div>
          {fiat === null ? null : <div className="fiat noc-body noc-numeral">≈ {showUsd(fiat)} now</div>}
          <StatusPill text="Confirmed" />
        </div>
        <div className="detail-card">
          {sent ? (
            <>
              <Row label="Type">
                <span className="noc-body">{token === 'SOL' ? 'Transfer' : `${token} transfer`}</span>
              </Row>
              <Row label="From">
                <span className="noc-body-sm">{account?.name}</span>
                <Address address={owner} label="Copy sender" />
              </Row>
              <Row label="To">
                {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
                {item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy recipient" />}
              </Row>
            </>
          ) : (
            <>
              <Row label="From">{item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy sender" />}</Row>
              <Row label="To">
                <span className="noc-body-sm">Your wallet</span>
                <Address address={owner} label="Copy recipient" />
              </Row>
            </>
          )}
          <Row label="Hash">{hash}</Row>
          <Row label="Network fee">
            <span className="noc-body noc-numeral">{sent ? `${showSol(item.feeLamports)} SOL` : 'Paid by sender'}</span>
          </Row>
          <Row label="Date">
            <span className="noc-body">{date}</span>
          </Row>
        </div>
        <div className="actions-row">
          <ExplorerLink signature={item.signature} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/app/__tests__/Activity.test.tsx src/app/__tests__/TxDetail.test.tsx src/app/__tests__/links.test.ts`
Expected: PASS — 3 files, 21 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 75 files, 895 tests.

- [ ] **Step 6: Visual pass (spec §8.6).** These states are captured at 412 × 600 by Task 17's `e2e/visual.spec.ts` and reviewed there against the design: `26-loaded-mixed`, `26-filter-sent`, `27-transparent-send`, `27-received`, `27-failed`, `27-purchase`, `41-empty`. Nothing to do here but check the names still match the states this task built.

- [ ] **Step 7: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **no length check:** in `explorer.ts`, return the URL without `base58.decode(signature).length === 64`. Run `npx vitest run src/app/__tests__/TxDetail.test.tsx` → RED: 1 failed.
  - **screens keep refusals to themselves (M4):** in `Activity.tsx` `load`, delete `report(r.error);`. Run `npx vitest run src/app/__tests__/Activity.test.tsx` → RED: 1 failed.
  - **"— SOL" for no token (L3):** replace `{item.token === null ? '—' : `— ${item.token}`}` with `— {item.token ?? 'SOL'}`. Run `npx vitest run src/app/__tests__/TxDetail.test.tsx` → RED: 1 failed.
  - **a second external link:** in any `src/app` file (the dry run used `screens/About.tsx` once it existed), add `<a href="https://noc-tura.io">noc-tura.io</a>`. Run `npx vitest run src/app/__tests__/links.test.ts` → RED: 2 failed.

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/e2e/historyFixtures.ts extension/src/app/__tests__/Activity.test.tsx extension/src/app/__tests__/TxDetail.test.tsx extension/src/app/__tests__/links.test.ts extension/src/app/explorer.ts extension/src/app/history.ts extension/src/app/screens/Activity.tsx extension/src/app/screens/TxDetail.tsx
git commit -m "feat(extension): #26 activity, #41, #27 and the Solscan link (B1b-2a §6.2–§6.5)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 16: The app shell: both surfaces, the router, the locked screen, Settings and #38 — and the built-output gates

**Files:**
- Modify: `.github/workflows/extension.yml`
- Modify: `extension/e2e/wallet.spec.ts`
- Modify: `extension/package.json`
- Modify: `extension/popup.html`
- Create: `extension/scripts/check-fonts.mjs`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Create: `extension/src/app/App.tsx`
- Create: `extension/src/app/app.css`
- Create: `extension/src/app/mount.tsx`
- Create: `extension/src/app/popup.tsx`
- Create: `extension/src/app/router.ts`
- Create: `extension/src/app/screens/About.tsx`
- Create: `extension/src/app/screens/Locked.tsx`
- Create: `extension/src/app/screens/NoWallet.tsx`
- Create: `extension/src/app/screens/Settings.tsx`
- Create: `extension/src/app/tab.tsx`
- Delete: `extension/src/popup/main.ts`
- Modify: `extension/vite.config.ts`
- Create: `extension/wallet.html`
- Test (create): `extension/scripts/__tests__/check-fonts.test.mjs`
- Test (modify): `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Test (create): `extension/src/app/__tests__/App.test.tsx`
- Test (create): `extension/src/app/__tests__/Settings.test.tsx`
- Test (create): `extension/src/app/__tests__/appHarness.tsx`

**Interfaces:**
- Consumes: Tasks 10–15.
- Produces:
  - `router.ts`: `type Route`, `type RouteAction`, `routeReducer`, `firstRoute()`; `App.tsx`: `App({surface, engine?, platform?})`; `mount.tsx`: `mount(surface)`; `popup.tsx`, `tab.tsx`
  - `screens/Locked.tsx`, `NoWallet.tsx`, `Settings.tsx` (`Settings({onAccounts, onAbout})`), `About.tsx` (`About({onBack})`)
  - `check-vault-isolation.mjs`: `ENTRIES` with `wallet.html`; `REACT_MARKER`; `check-fonts.mjs`: `FONTS`, `fontViolations(distApp)`; `npm run gates` runs it
  - test harness `appHarness.tsx`: `renderApp(options)`

Spec §1.1: "`popup.tsx` and `tab.tsx` are two-line wrappers that mount `<App surface="popup" | "tab" />`"; `wallet.html` is new (a 412 px column; plan 1's one route is `#/home`, any hash shows it). §1.4: 412 × 600, a scrolling content region, the 80 px tab bar on the three tab screens, no bar on flow screens, Esc back one step. §1.6: an in-memory route stack; "No hash causes an action." §4.1: the locked screen — "Welcome back", "Unlock Noctura to continue. Unlocking opens in a new tab.", `[Unlock]` → `unlock.html?mode=unlock` + close; no password field (D12). §6.1: Settings — "Account" → "Accounts" (count) → the switcher; "Security" → "Lock now"; "About" → "About Noctura" (version) → #38 with "noctura." (`.s7-wordmark`), "Solana wallet for your browser — your keys stay on this device.", the version, "Resources" → "noc-tura.io" as text, "© 2026 Noctura", "BSL 1.1 · converts to MIT on 2034-01-01". The gates: `ENTRIES` becomes `{popup.html: src/app/popup.tsx, wallet.html: src/app/tab.tsx, unlock.html: src/unlock/main.ts}`; "A React-only marker must be absent from every file reachable from `unlock.html`" and present in some built file, else INCONCLUSIVE; `check-fonts.mjs` (Scope item 12). CI runs on `web/src/ui`, `web/src/styles` and `web/public/fonts` changes. `wallet.spec.ts` sends from `wallet.html` (Scope item 14). The dry run's E2E caught a layout bug fixed in `app.css`: a long list squeezed the filter chips to zero height (`.app-content .screen > * { flex-shrink: 0 }`). Review M3: "Lock now" is a `LockedButton` with the two §7.6 tests. Review L10: `mount.tsx` notes that StrictMode's double effects are dev-only.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/check-fonts.test.mjs`:

```js
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fontViolations} from '../check-fonts.mjs';

describe('the font gate', () => {
  let dir;
  const write = (rel, text) => {
    mkdirSync(join(dir, rel, '..'), {recursive: true});
    writeFileSync(join(dir, rel), text);
  };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fonts-'));
    write('fonts/Geist-Variable.woff2', 'x');
    write('fonts/GeistMono-Variable.woff2', 'x');
    write('assets/mount-1.css', "@font-face{src:url(/fonts/Geist-Variable.woff2) format('woff2-variations')}@font-face{src:url('/fonts/GeistMono-Variable.woff2')}");
  });
  afterEach(() => rmSync(dir, {recursive: true, force: true}));

  it('passes both files, loaded from /fonts/ or — as Vite rewrites it with base ./ — ../fonts/', () => {
    expect(fontViolations(dir)).toEqual([]);
    write('assets/mount-1.css', '@font-face{src:url(../fonts/Geist-Variable.woff2)}@font-face{src:url(../fonts/GeistMono-Variable.woff2)}');
    expect(fontViolations(dir)).toEqual([]);
  });

  it('fails a missing file, and a font loaded from anywhere else', () => {
    rmSync(join(dir, 'fonts/GeistMono-Variable.woff2'));
    write('assets/mount-1.css', '@font-face{src:url(/fonts/Geist-Variable.woff2)}@font-face{src:url(https://fonts.example/x.woff2)}');
    expect(fontViolations(dir)).toEqual([
      'fonts/GeistMono-Variable.woff2 is missing from the build',
      'assets/mount-1.css loads a font from https://fonts.example/x.woff2 — only a bundled fonts/ file is allowed',
    ]);
    write('assets/mount-1.css', '@font-face{src:url(../../fonts/Geist-Variable.woff2)}');
    expect(fontViolations(dir)).toContain('INCONCLUSIVE: no built CSS loads fonts/Geist-Variable.woff2');
  });
});
```

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -4,7 +4,7 @@ import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {
   bundleViolations, htmlViolations, listSourceFiles, manifestViolations, sourceViolations, vaultPageViolations,
-  BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, VAULT_MARKER, WORDLIST_MARKER,
+  BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, REACT_MARKER, VAULT_MARKER, WORDLIST_MARKER,
 } from '../check-vault-isolation.mjs';
 import {render} from '../../manifest/source.mjs';
 
@@ -19,7 +19,7 @@ describe('vault isolation (source)', () => {
   });
 
   it('refuses a value import of the vault from the popup or the background', () => {
-    expect(sourceViolations([f('src/popup/main.ts', "import {decryptMnemonic} from '../vault/envelope';")])).toHaveLength(1);
+    expect(sourceViolations([f('src/app/popup.tsx', "import {decryptMnemonic} from '../vault/envelope';")])).toHaveLength(1);
     expect(sourceViolations([f('src/background/messages.ts', "import {deriveSessionAccounts} from '../vault/accounts';")])).toHaveLength(1);
   });
 
@@ -49,7 +49,7 @@ describe('vault isolation (source)', () => {
     ['a worker URL', "new Worker(new URL('../vault/kdf.worker.ts', import.meta.url), {type: 'module'});"],
     ['an import of the folder itself', "import {x} from '../vault';"],
   ])('refuses %s of the vault from the popup', (_, text) => {
-    expect(sourceViolations([f('src/popup/main.ts', text)])).toEqual(['src/popup/main.ts: imports the vault']);
+    expect(sourceViolations([f('src/app/popup.tsx', text)])).toEqual(['src/app/popup.tsx: imports the vault']);
   });
 
   it('refuses a vault import from src/ui/ and from a file at the top of src/', () => {
@@ -63,18 +63,18 @@ describe('vault isolation (source)', () => {
 
   it('allows type-only imports and re-exports from anywhere', () => {
     expect(sourceViolations([
-      f('src/popup/main.ts', "import type {EnvelopeV1} from '../vault/envelope';"),
+      f('src/app/popup.tsx', "import type {EnvelopeV1} from '../vault/envelope';"),
       f('src/popup/types.ts', "export type {EnvelopeV1} from '../vault/envelope';"),
       f('src/background/messages.ts', "import type {\n  SessionAccount,\n} from '../vault/accounts';"),
     ])).toEqual([]);
   });
 
   it('does not mistake a folder that merely contains "vault" in its name', () => {
-    expect(sourceViolations([f('src/popup/main.ts', "import {x} from '../vaultish/x';")])).toEqual([]);
+    expect(sourceViolations([f('src/app/popup.tsx', "import {x} from '../vaultish/x';")])).toEqual([]);
   });
 
   it('reports each file once per rule even with several vault imports', () => {
-    expect(sourceViolations([f('src/popup/main.ts', "import {a} from '../vault/a';\nimport {b} from '../vault/b';")])).toHaveLength(1);
+    expect(sourceViolations([f('src/app/popup.tsx', "import {a} from '../vault/a';\nimport {b} from '../vault/b';")])).toHaveLength(1);
   });
 
   // Fix round 1: core/keys (mnemonic → seed, SLIP-0010) is the vault's seed code, shared with the app.
@@ -89,7 +89,7 @@ describe('vault isolation (source)', () => {
     ['a mixed type/value import', "import {type X, mnemonicToSeed} from '../../../core/keys/mnemonic';"],
     ['an aliased specifier', "import {x} from '@core/keys/mnemonic';"],
   ])('refuses %s of core/keys from the popup', (_, text) => {
-    expect(sourceViolations([f('src/popup/main.ts', text)])).toEqual(['src/popup/main.ts: imports core/keys (seed code)']);
+    expect(sourceViolations([f('src/app/popup.tsx', text)])).toEqual(['src/app/popup.tsx: imports core/keys (seed code)']);
   });
 
   it('refuses core/keys from the background, ui and ext.ts, resolving from each file', () => {
@@ -102,18 +102,18 @@ describe('vault isolation (source)', () => {
     expect(sourceViolations([
       f('src/vault/accounts.ts', "import {deriveTransparentKeypair} from '../../../core/keys/transparent';\nimport {mnemonicToSeed} from '../../../core/keys/mnemonic';"),
       f('src/unlock/main.ts', "import {x} from '../../../core/keys/mnemonic';"),
-      f('src/popup/main.ts', "import type {X} from '../../../core/keys/mnemonic';"),
+      f('src/app/popup.tsx', "import type {X} from '../../../core/keys/mnemonic';"),
     ])).toEqual([]);
   });
 
   it('does not mistake a path that resolves elsewhere for core/keys', () => {
-    expect(sourceViolations([f('src/popup/main.ts', "import {x} from '../../../core/keysmith/x';")])).toEqual([]);
-    expect(sourceViolations([f('src/popup/main.ts', "import {x} from '../../../core/util/x';")])).toEqual([]);
+    expect(sourceViolations([f('src/app/popup.tsx', "import {x} from '../../../core/keysmith/x';")])).toEqual([]);
+    expect(sourceViolations([f('src/app/popup.tsx', "import {x} from '../../../core/util/x';")])).toEqual([]);
   });
 
   it('refuses storage.session in any spelling outside the background', () => {
-    expect(sourceViolations([f('src/popup/main.ts', 'chrome.storage?.session.get(null)')])).toHaveLength(1);
-    expect(sourceViolations([f('src/popup/main.ts', "chrome.storage['session'].get(null)")])).toHaveLength(1);
+    expect(sourceViolations([f('src/app/popup.tsx', 'chrome.storage?.session.get(null)')])).toHaveLength(1);
+    expect(sourceViolations([f('src/app/popup.tsx', "chrome.storage['session'].get(null)")])).toHaveLength(1);
   });
 
   // src/ext.ts is the one wrapper over chrome.* and so names storage.session; it is allowed to,
@@ -123,8 +123,8 @@ describe('vault isolation (source)', () => {
     expect(sourceViolations([f('src/ext.ts', 'session: kv(b.storage.session),')])).toEqual([]);
     expect(sourceViolations([f('src/background/index.ts', "import {browserExt} from '../ext';")])).toEqual([]);
     expect(sourceViolations([f('src/background/messages.ts', "import type {Ext} from '../ext';")])).toEqual([]);
-    expect(sourceViolations([f('src/popup/main.ts', "import {browserExt} from '../ext';")])).toEqual([
-      'src/popup/main.ts: imports src/ext.ts (storage.session) outside the background',
+    expect(sourceViolations([f('src/app/popup.tsx', "import {browserExt} from '../ext';")])).toEqual([
+      'src/app/popup.tsx: imports src/ext.ts (storage.session) outside the background',
     ]);
     expect(sourceViolations([f('src/unlock/main.ts', "import {browserExt} from '../ext';")])).toHaveLength(1);
   });
@@ -140,7 +140,7 @@ describe('vault isolation (source)', () => {
     ['runtime.onConnectExternal', 'chrome.runtime.onConnectExternal.addListener(p => p);'],
     ['a destructured listener', 'const {onMessage} = chrome.runtime;\nonMessage.addListener(m => m);'],
   ])('refuses %s outside the background', (_, text) => {
-    for (const path of ['src/popup/main.ts', 'src/unlock/main.ts', 'src/vault/reauth.ts', 'src/ui/send.ts', 'src/ext.ts']) {
+    for (const path of ['src/app/popup.tsx', 'src/unlock/main.ts', 'src/vault/reauth.ts', 'src/ui/send.ts', 'src/ext.ts']) {
       expect(sourceViolations([f(path, text)])).toEqual([`${path}: listens for runtime messages outside the background`]);
     }
   });
@@ -185,7 +185,7 @@ describe('vault isolation (files outside src/, and the vault page as a target)',
     ['a side-effect import', "import '../unlock/main';"],
     ['an import of the folder', "import {x} from '../unlock';"],
   ])('refuses %s of src/unlock from the popup', (_, text) => {
-    expect(sourceViolations([f('src/popup/main.ts', text)])).toEqual(['src/popup/main.ts: imports the vault page (src/unlock)']);
+    expect(sourceViolations([f('src/app/popup.tsx', text)])).toEqual(['src/app/popup.tsx: imports the vault page (src/unlock)']);
   });
 
   it('refuses src/unlock from the vault folder and the background, but not from src/unlock itself', () => {
@@ -194,12 +194,12 @@ describe('vault isolation (files outside src/, and the vault page as a target)',
     expect(sourceViolations([
       f('src/unlock/main.ts', "import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';"),
       f('src/unlock/sub/x.ts', "import {runExclusive} from '../orchestrate';"),
-      f('src/popup/main.ts', "import type {Outcome} from '../unlock/orchestrate';"),
+      f('src/app/popup.tsx', "import type {Outcome} from '../unlock/orchestrate';"),
     ])).toEqual([]);
   });
 
   it('does not mistake a folder that merely starts with "unlock"', () => {
-    expect(sourceViolations([f('src/popup/main.ts', "import {x} from '../unlockish/x';")])).toEqual([]);
+    expect(sourceViolations([f('src/app/popup.tsx', "import {x} from '../unlockish/x';")])).toEqual([]);
   });
 });
 
@@ -222,7 +222,7 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
     ['bracketed storage', "chrome['storage'].local.get(null);"],
     ['storage.session (still)', 'chrome.storage.session.get(null);'],
   ])('refuses %s outside ext.ts and the background', (_, text) => {
-    for (const path of ['src/popup/main.ts', 'src/unlock/main.ts', 'src/vault/reauth.ts', 'src/ui/send.ts', 'leak/x.ts']) {
+    for (const path of ['src/app/popup.tsx', 'src/unlock/main.ts', 'src/vault/reauth.ts', 'src/ui/send.ts', 'leak/x.ts']) {
       expect(sourceViolations([f(path, text)])).toEqual([STORAGE(path)]);
     }
   });
@@ -236,7 +236,7 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
 
   it('does not mistake localStorage, sessionStorage or prose for the extension storage API', () => {
     expect(sourceViolations([
-      f('src/popup/main.ts', "localStorage.getItem('x'); sessionStorage.clear();\n// the vault is kept in local storage, keys in session storage"),
+      f('src/app/popup.tsx', "localStorage.getItem('x'); sessionStorage.clear();\n// the vault is kept in local storage, keys in session storage"),
     ])).toEqual([]);
   });
 
@@ -267,7 +267,7 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
     ])).toEqual([]);
     const READER = path => `${path}: imports src/shared/readLocal, the vault page's storage reader`;
     for (const [path, text] of [
-      ['src/popup/main.ts', "import {readLocal} from '../shared/readLocal';"],
+      ['src/app/popup.tsx', "import {readLocal} from '../shared/readLocal';"],
       ['src/background/x.ts', "import {readLocal} from '../shared/readLocal';"],
       ['src/ui/send.ts', "const m = await import('../shared/readLocal');"],
       ['src/shared/other.ts', "export {readLocal} from './readLocal';"],
@@ -320,7 +320,7 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
       f('src/background/accountsStore.ts', "import {envelopeRevision} from '../shared/envelopeRevision';\nimport {MAX_ACCOUNTS} from '../shared/envelopeRules';"),
       f('src/unlock/accountsFlow.ts', "import {envelopeRevision} from '../shared/envelopeRevision';"),
       f('src/vault/envelope.ts', "import {MAX_ACCOUNTS, cleanName} from '../shared/envelopeRules';"),
-      f('src/popup/main.ts', "import {cleanName} from '../shared/envelopeRules';"),
+      f('src/app/popup.tsx', "import {cleanName} from '../shared/envelopeRules';"),
       f('src/shared/envelopeRevision.ts', "import {sha256} from '@noble/hashes/sha2.js';"),
     ])).toEqual([]);
     // …and src/shared/ itself is held to the same rules: it may not reach into the vault.
@@ -334,12 +334,12 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
       f('src/background/settings.ts', "export const SETTINGS_KEY = 'v1_settings';"),
       f('src/background/knownRecipients.ts', "export const KNOWN_RECIPIENTS_KEY = 'v1_known_recipients';"),
     ])).toEqual([]);
-    expect(sourceViolations([f('src/popup/main.ts', "chrome.runtime.sendMessage({type: 'x', key: 'v1_settings'});")])).toEqual([OWNED('src/popup/main.ts', 'v1_settings')]);
+    expect(sourceViolations([f('src/app/popup.tsx', "chrome.runtime.sendMessage({type: 'x', key: 'v1_settings'});")])).toEqual([OWNED('src/app/popup.tsx', 'v1_settings')]);
     expect(sourceViolations([f('src/unlock/main.ts', '// v1_known_recipients')])).toEqual([OWNED('src/unlock/main.ts', 'v1_known_recipients')]);
     expect(sourceViolations([f('src/ext.ts', "const k = 'v1_settings';")])).toEqual([OWNED('src/ext.ts', 'v1_settings')]);
-    expect(sourceViolations([f('src/popup/main.ts', "const p = 'v1_pending'; const f = 'v1_forbidden_until';")])).toEqual([
-      OWNED('src/popup/main.ts', 'v1_pending'),
-      OWNED('src/popup/main.ts', 'v1_forbidden_until'),
+    expect(sourceViolations([f('src/app/popup.tsx', "const p = 'v1_pending'; const f = 'v1_forbidden_until';")])).toEqual([
+      OWNED('src/app/popup.tsx', 'v1_pending'),
+      OWNED('src/app/popup.tsx', 'v1_forbidden_until'),
     ]);
   });
   // B1b-2a E4: the balance and price caches are the background's too.
@@ -347,7 +347,7 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
     const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
     expect(sourceViolations([f('src/background/balanceCache.ts', "export const BALANCE_CACHE_KEY = 'v1_balance_cache'; export const P = 'v1_price_cache';")])).toEqual([]);
     expect(sourceViolations([f('src/app/screens/Home.tsx', "const k = 'v1_balance_cache';")])).toEqual([OWNED('src/app/screens/Home.tsx', 'v1_balance_cache')]);
-    expect(sourceViolations([f('src/popup/main.ts', "const k = 'v1_price_cache';")])).toEqual([OWNED('src/popup/main.ts', 'v1_price_cache')]);
+    expect(sourceViolations([f('src/app/popup.tsx', "const k = 'v1_price_cache';")])).toEqual([OWNED('src/app/popup.tsx', 'v1_price_cache')]);
   });
 });
 
@@ -356,31 +356,37 @@ describe('vault isolation (HTML entries)', () => {
 
   it('accepts each page loading exactly its own entry (positive control)', () => {
     expect(htmlViolations([
-      f('popup.html', page('./src/popup/main.ts')),
+      f('popup.html', page('./src/app/popup.tsx')),
       f('unlock.html', page('./src/unlock/main.ts')),
     ])).toEqual([]);
-    expect(htmlViolations([f('popup.html', page('/src/popup/main.ts')), f('unlock.html', page('src/unlock/main.ts'))])).toEqual([]);
+    expect(htmlViolations([f('popup.html', page('/src/app/popup.tsx')), f('unlock.html', page('src/unlock/main.ts'))])).toEqual([]);
+  });
+
+  // B1b-2a: wallet.html is a third entry, the UI tab; it may load only src/app/tab.tsx.
+  it('holds wallet.html to its own entry', () => {
+    expect(htmlViolations([f('wallet.html', page('./src/app/tab.tsx'))])).toEqual([]);
+    expect(htmlViolations([f('wallet.html', page('./src/unlock/main.ts'))])).toEqual(['wallet.html: loads ./src/unlock/main.ts — only src/app/tab.tsx may be its entry']);
   });
 
   it('refuses the reproduced layout: popup.html also loading ./leak/prf.ts', () => {
-    expect(htmlViolations([f('popup.html', page('./src/popup/main.ts', './leak/prf.ts'))])).toEqual([
-      'popup.html: loads ./leak/prf.ts — only src/popup/main.ts may be its entry',
+    expect(htmlViolations([f('popup.html', page('./src/app/popup.tsx', './leak/prf.ts'))])).toEqual([
+      'popup.html: loads ./leak/prf.ts — only src/app/popup.tsx may be its entry',
     ]);
   });
 
   it('refuses the popup loading the vault page entry, and the vault page loading the popup entry', () => {
     expect(htmlViolations([f('popup.html', page('./src/unlock/main.ts'))])).toHaveLength(1);
-    expect(htmlViolations([f('unlock.html', page('./src/popup/main.ts'))])).toHaveLength(1);
+    expect(htmlViolations([f('unlock.html', page('./src/app/popup.tsx'))])).toHaveLength(1);
   });
 
   it('refuses a script on a page that has no entry of its own', () => {
-    expect(htmlViolations([f('options.html', page('./src/popup/main.ts'))])).toEqual([
-      'options.html: loads ./src/popup/main.ts — this page has no entry of its own',
+    expect(htmlViolations([f('options.html', page('./src/app/popup.tsx'))])).toEqual([
+      'options.html: loads ./src/app/popup.tsx — this page has no entry of its own',
     ]);
   });
 
   it('refuses an inline script and a script tag whose src it cannot read', () => {
-    expect(htmlViolations([f('popup.html', `${page('./src/popup/main.ts')}<script type="module">import '../src/vault/passkey';</script>`)])).toEqual([
+    expect(htmlViolations([f('popup.html', `${page('./src/app/popup.tsx')}<script type="module">import '../src/vault/passkey';</script>`)])).toEqual([
       'popup.html: has a <script> without a src',
     ]);
     expect(htmlViolations([f('popup.html', '<script type="module" src=./leak/prf.ts></script>')])).toEqual([
@@ -402,11 +408,11 @@ describe('vault isolation (which files the source rule reads)', () => {
 
   it('reads every source file under the package except node_modules, dist, tests, e2e and scripts', () => {
     for (const rel of [
-      'src/popup/main.ts', 'src/ui/a.tsx', 'leak/prf.ts', 'x.mjs', 'vite.config.ts', 'manifest/source.mjs', 'deep/a/b.js',
+      'src/app/popup.tsx', 'src/ui/a.tsx', 'leak/prf.ts', 'x.mjs', 'vite.config.ts', 'manifest/source.mjs', 'deep/a/b.js',
       'node_modules/p/index.js', 'dist/app/background.js', 'src/vault/__tests__/a.test.ts', 'e2e/a.spec.ts',
       'scripts/check.mjs', 'popup.html', 'notes.md',
     ]) touch(rel);
-    expect(listSourceFiles(root).sort()).toEqual(['deep/a/b.js', 'leak/prf.ts', 'manifest/source.mjs', 'src/popup/main.ts', 'src/ui/a.tsx', 'vite.config.ts', 'x.mjs']);
+    expect(listSourceFiles(root).sort()).toEqual(['deep/a/b.js', 'leak/prf.ts', 'manifest/source.mjs', 'src/app/popup.tsx', 'src/ui/a.tsx', 'vite.config.ts', 'x.mjs']);
   });
 
   // Fable re-review: SKIP_DIRS (node_modules, dist, e2e, scripts) must only apply at the
@@ -446,6 +452,8 @@ describe('vault isolation (built output)', () => {
     write('assets/session-1.js', 'export const s=r=>({session:r.storage.session,pin:()=>r.storage.session.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"})});');
     write('popup.html', html('./assets/popup-1.js'));
     write('assets/popup-1.js', 'import{t as e}from"./send-1.js";e();');
+    // The popup bundles React (B1b-2a): its internal marker is in some built file, as in a real build.
+    write('assets/react-1.js', `export const R="${REACT_MARKER}";`);
     write('assets/send-1.js', 'export const t=()=>1;');
     write('unlock.html', html('./assets/unlock-1.js'));
     write('assets/unlock-1.js', `import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
@@ -462,6 +470,19 @@ describe('vault isolation (built output)', () => {
     expect(bundleViolations(dir)).toEqual([]);
   });
 
+  // B1b-2a S1 / §1.2: React never reaches the vault page, and the marker proves the check is live.
+  it('fails when a chunk the vault page loads carries React', () => {
+    write('assets/base-1.js', `export const n=()=>"${REACT_MARKER}";`);
+    expect(bundleViolations(dir)).toEqual(['assets/base-1.js (reachable from unlock.html) contains React — the vault page must stay plain DOM']);
+  });
+
+  it('is INCONCLUSIVE — a failure — when no built file carries the React 18 marker (React upgraded or gone)', () => {
+    write('assets/react-1.js', 'export const R="__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE";');
+    expect(bundleViolations(dir)).toEqual([
+      `INCONCLUSIVE: the React marker "${REACT_MARKER}" is in no built JS file — React 19 renamed it: update REACT_MARKER, or the no-React-in-the-vault-page rule passes trivially`,
+    ]);
+  });
+
   it('fails when a static import from the background reaches a chunk with the envelope marker', () => {
     write('assets/base-1.js', `export const n=()=>"${VAULT_MARKER}";`);
     expect(bundleViolations(dir)).toEqual(['assets/base-1.js (reachable from background.js) contains vault code (envelope)']);
```

Create `extension/src/app/__tests__/App.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {renderApp} from './appHarness';
import {walletReader} from './harness';
import {PENDING_KEY} from '../../background/pendingStore';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {sentSol, sig} from '../../../e2e/historyFixtures';

// Spec §1.6 step 1 and §4.1: what the popup and the tab show before #11.
describe('the app before #11', () => {
  it('popup, no wallet: opens the welcome page in a tab, closes itself, and says so meanwhile', async () => {
    const {platform} = await renderApp({wallet: false});
    expect(await screen.findByText('Opening setup in a new tab…')).toBeTruthy();
    await waitFor(() => expect(platform.opened).toEqual(['unlock.html?mode=welcome']));
    expect(platform.closed).toBe(1);
  });

  it('tab, no wallet: never closes itself; offers setup with a button', async () => {
    const {platform} = await renderApp({wallet: false, surface: 'tab'});
    fireEvent.click(await screen.findByRole('button', {name: 'Set up a wallet'}));
    expect(screen.getByText('No wallet on this browser yet.')).toBeTruthy();
    expect(platform.opened).toEqual(['unlock.html?mode=welcome']);
    expect(platform.closed).toBe(0);
  });

  it('locked: the derived locked screen — no password field; Unlock opens the vault page in a tab', async () => {
    const {platform} = await renderApp({unlocked: false});
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('Unlock Noctura to continue. Unlocking opens in a new tab.')).toBeTruthy();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    // Plan 1: no "Forgot password?" until #39 exists (plan 2).
    expect(screen.queryByText('Forgot password?')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Unlock'}));
    expect(platform.opened).toEqual(['unlock.html?mode=unlock']);
    expect(platform.closed).toBe(1);
  });

  it('unlocked: #11 with the tab bar Home / Activity / Settings (D3)', async () => {
    await renderApp();
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    const nav = screen.getByRole('navigation', {name: 'Main'});
    expect([...nav.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Home', 'Activity', 'Settings']);
  });
});

describe('navigation (spec §1.6: an in-memory stack; no route acts)', () => {
  it('#11 → #13 → back; Esc also goes back one step', async () => {
    await renderApp();
    fireEvent.click(await screen.findByRole('button', {name: 'Receive'}));
    expect(await screen.findByText('Public address')).toBeTruthy();
    expect(screen.queryByRole('navigation', {name: 'Main'})).toBeNull(); // a flow screen: no tab bar
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Receive'}));
    await screen.findByText('Public address');
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(await screen.findByText('TOKENS')).toBeTruthy();
  });

  it('Activity → a row → #27 → back to the list', async () => {
    const now = Math.floor(Date.now() / 1000);
    const reader = walletReader({
      getSignaturesForAddress: async () => [{signature: sig(1), blockTime: now, err: null}],
      getTransaction: async () => sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, now),
    });
    await renderApp({reader});
    fireEvent.click(await screen.findByRole('button', {name: 'Activity'}));
    fireEvent.click(await screen.findByText('Sent SOL'));
    expect(await screen.findByText('SENT')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText('Sent SOL')).toBeTruthy();
  });

  it('the pending strip opens Activity (plan-1 stand-in), where the send is in PENDING', async () => {
    await renderApp({
      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
    });
    fireEvent.click(await screen.findByText('Sending 2.48 SOL · pending'));
    expect(await screen.findByText('PENDING')).toBeTruthy();
  });

  it('the avatar opens the account switcher; Settings → Accounts opens it too', async () => {
    await renderApp();
    fireEvent.click(await screen.findByRole('button', {name: 'Accounts'}));
    expect(await screen.findByRole('dialog', {name: 'Accounts'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('an auto-lock while open switches to the locked screen at the next 5 s state read', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const {ext} = await renderApp();
      await screen.findByText('TOKENS');
      await ext.session.clear();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await screen.findByText('Welcome back')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
```

Create `extension/src/app/__tests__/Settings.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {render} from '@testing-library/react';
import {renderApp} from './appHarness';
import {setupWallet} from './harness';
import {App} from '../App';
import {getSession} from '../../background/session';

// Spec §6.1: the minimal Settings tab and #38 about.
async function openSettings() {
  const r = await renderApp();
  await screen.findByText('TOKENS');
  fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
  await screen.findByRole('heading', {name: 'Settings'});
  return r;
}

describe('Settings (minimal)', () => {
  it('three groups: Accounts (with the count), Lock now, About Noctura (with the version); nothing else of #31', async () => {
    await openSettings();
    expect(screen.getAllByText(/^(Account|Security|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'About']);
    expect(screen.getByText('2 accounts')).toBeTruthy();
    expect(screen.getByText('v0.1.0')).toBeTruthy();
    for (const gone of ['Currency', 'Notifications', 'Change password', 'Backup', 'Delete wallet', 'Connections', 'Advanced']) expect(screen.queryByText(gone)).toBeNull();
  });

  it('Accounts opens the switcher', async () => {
    await openSettings();
    fireEvent.click(screen.getByText('Accounts'));
    expect(await screen.findByRole('dialog', {name: 'Accounts'})).toBeTruthy();
  });

  it('Lock now locks the wallet and shows the locked screen', async () => {
    const {ext} = await openSettings();
    fireEvent.click(screen.getByText('Lock now'));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    expect(await getSession(ext)).toBeNull();
  });

  it('#38 about: the wordmark, the adapted line, the version, the site as text, the licence', async () => {
    await openSettings();
    fireEvent.click(screen.getByText('About Noctura'));
    expect(await screen.findByText('Solana wallet for your browser — your keys stay on this device.')).toBeTruthy();
    expect(document.querySelector('.s7-wordmark')?.textContent).toBe('noctura.');
    expect(screen.getByText('noc-tura.io').closest('a')).toBeNull();
    expect(screen.getByText('© 2026 Noctura')).toBeTruthy();
    expect(screen.getByText(/BSL 1\.1 · converts to MIT on/)).toBeTruthy();
    for (const gone of ['Terms of Service', 'Privacy Policy', 'Open-source licenses', 'Help & support', 'shielded']) expect(screen.queryByText(new RegExp(gone))).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    await waitFor(() => expect(screen.getByRole('heading', {name: 'Settings'})).toBeTruthy());
  });

  // Review M3 / spec §7.6: "Lock now" is a LockedButton — a second click inside 500 ms, or before the
  // lock settles, does nothing.
  async function withSlowLock(settle: 'now' | 'never') {
    const w = await setupWallet();
    let locks = 0;
    const engine = {...w.engine, lock: () => (locks++, settle === 'now' ? Promise.resolve({ok: true as const, data: null}) : new Promise<never>(() => undefined))};
    render(<App surface="popup" engine={engine} platform={w.platform} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Settings'}));
    return {count: () => locks};
  }

  it('Lock now: a second click inside 500 ms does nothing', async () => {
    const {count} = await withSlowLock('now');
    const button = await screen.findByRole('button', {name: /Lock now/});
    fireEvent.click(button);
    // The lock has settled; the 500 ms floor has not passed.
    await new Promise(r => setTimeout(r, 50));
    fireEvent.click(button);
    expect(count()).toBe(1);
  });

  it('Lock now: a second click after 500 ms but before the lock settles does nothing', async () => {
    const {count} = await withSlowLock('never');
    const button = await screen.findByRole('button', {name: /Lock now/});
    fireEvent.click(button);
    await new Promise(r => setTimeout(r, 600));
    fireEvent.click(button);
    expect(count()).toBe(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
```

Create `extension/src/app/__tests__/appHarness.tsx`:

```tsx
import {render} from '@testing-library/react';
import {App} from '../App';
import {setupWallet, type Wallet, type WalletOptions} from './harness';

/** The whole App — its own provider, router and tab bar — against the real background. */
export async function renderApp(o: WalletOptions = {}): Promise<Wallet> {
  const w = await setupWallet(o);
  render(<App surface={o.surface ?? 'popup'} engine={w.engine} platform={w.platform} />);
  return w;
}
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/App.test.tsx src/app/__tests__/Settings.test.tsx scripts/__tests__/check-vault-isolation.test.mjs scripts/__tests__/check-fonts.test.mjs`
Expected: FAIL — `Failed to resolve import "../App"`; `check-fonts.mjs` missing; the React-marker and `wallet.html` gate tests.

- [ ] **Step 3: Implement.**

Modify `.github/workflows/extension.yml`:

```diff
diff --git a/.github/workflows/extension.yml b/.github/workflows/extension.yml
--- a/.github/workflows/extension.yml
+++ b/.github/workflows/extension.yml
@@ -2,10 +2,10 @@ name: extension
 
 on:
   pull_request:
-    paths: ['extension/**', 'core/**', 'web/scripts/**', '.github/workflows/extension.yml']
+    paths: ['extension/**', 'core/**', 'web/scripts/**', 'web/src/ui/**', 'web/src/styles/**', 'web/public/fonts/**', '.github/workflows/extension.yml']
   push:
     branches: [main]
-    paths: ['extension/**', 'core/**', 'web/scripts/**', '.github/workflows/extension.yml']
+    paths: ['extension/**', 'core/**', 'web/scripts/**', 'web/src/ui/**', 'web/src/styles/**', 'web/public/fonts/**', '.github/workflows/extension.yml']
 
 jobs:
   verify:
```

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -37,9 +37,10 @@ async function launch() {
   await expectContained(ctx);
   const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
   const id = new URL(sw.url()).host;
-  // An extension page (own origin), so its messages are privileged — it stands in for the B1b-2 popup screens.
+  // An extension page (own origin), so its messages are privileged. B1b-2a: the UI tab, wallet.html —
+  // the popup, with no wallet yet, would open the welcome page and close itself (spec §1.6).
   const popup = await ctx.newPage();
-  await popup.goto(`chrome-extension://${id}/popup.html`);
+  await popup.goto(`chrome-extension://${id}/wallet.html#/home`);
   return {ctx, fake, sw, id, popup, profile};
 }
 
```

Modify `extension/package.json`:

```diff
diff --git a/extension/package.json b/extension/package.json
--- a/extension/package.json
+++ b/extension/package.json
@@ -11,7 +11,7 @@
     "e2e": "playwright test",
     "csp": "node scripts/check-csp.mjs dist/app",
     "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox",
-    "gates": "node scripts/check-permissions.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs",
+    "gates": "node scripts/check-permissions.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs",
     "reproducible": "node scripts/verify-reproducible.mjs",
     "verify": "rm -rf dist && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
   },
```

Modify `extension/popup.html`:

```diff
diff --git a/extension/popup.html b/extension/popup.html
--- a/extension/popup.html
+++ b/extension/popup.html
@@ -5,11 +5,7 @@
     <title>Noctura</title>
   </head>
   <body>
-    <main>
-      <p id="state" role="status">Reading…</p>
-      <button id="unlock" type="button" hidden>Unlock</button>
-      <button id="lock" type="button" hidden>Lock</button>
-    </main>
-    <script type="module" src="./src/popup/main.ts"></script>
+    <div id="root"></div>
+    <script type="module" src="./src/app/popup.tsx"></script>
   </body>
 </html>
```

Create `extension/scripts/check-fonts.mjs`:

```js
#!/usr/bin/env node
// Spec B1b-2a §1.2/§1.3 (review L5): design-system.css loads Geist from `/fonts/*.woff2`. Both files
// must be in the build at dist/app/fonts/, and every font URL in the built CSS must resolve to one of
// them — a font from anywhere else would be a third-party request.
//
// Measured in the plan's dry run: with `base: './'`, Vite rewrites the absolute `/fonts/…` of a
// public/ asset to `../fonts/…`, relative to the CSS file in assets/ — not "stays /fonts/…" as the
// spec assumed. Both forms land on dist/app/fonts/, so both are accepted; what is checked is where the
// URL resolves. Plan 2 adds the vault page's CSS, which the same rule covers.
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join, posix, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const FONTS = ['Geist-Variable.woff2', 'GeistMono-Variable.woff2'];

/** Where a url() in assets/<file>.css points, relative to dist/app; null for another origin. */
function target(url) {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) return null;
  return url.startsWith('/') ? posix.normalize(url.slice(1)) : posix.normalize(posix.join('assets', url));
}

export function fontViolations(distApp) {
  const out = [];
  for (const f of FONTS) if (!existsSync(join(distApp, 'fonts', f))) out.push(`fonts/${f} is missing from the build`);
  const assets = join(distApp, 'assets');
  const css = existsSync(assets) ? readdirSync(assets).filter(f => f.endsWith('.css')) : [];
  let geist = false;
  for (const f of css) {
    const text = readFileSync(join(assets, f), 'utf8');
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+\.woff2)['"]?\s*\)/g)) {
      const t = target(m[1]);
      if (t === null || !FONTS.some(name => t === `fonts/${name}`)) out.push(`assets/${f} loads a font from ${m[1]} — only a bundled fonts/ file is allowed`);
      if (t === 'fonts/Geist-Variable.woff2') geist = true;
    }
  }
  if (!geist) out.push('INCONCLUSIVE: no built CSS loads fonts/Geist-Variable.woff2');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = fontViolations(join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist', 'app'));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('fonts ok: both Geist files are in dist/app/fonts and every font URL in the CSS resolves there');
}
```

Modify `extension/scripts/check-vault-isolation.mjs`:

```diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -29,7 +29,7 @@ const VAULT_ALLOWED = /^src\/(unlock|vault)\//;
 // they are vault code too, and only the vault page itself may import them.
 const UNLOCK_ALLOWED = /^src\/unlock\//;
 // The one entry each HTML page at the package root may load.
-export const ENTRIES = {'popup.html': 'src/popup/main.ts', 'unlock.html': 'src/unlock/main.ts'};
+export const ENTRIES = {'popup.html': 'src/app/popup.tsx', 'wallet.html': 'src/app/tab.tsx', 'unlock.html': 'src/unlock/main.ts'};
 // node_modules/, dist/, e2e/ and scripts/ are skipped only at the package ROOT — a nested
 // src/popup/scripts/ is ordinary source a page can bundle, not this package's own tooling.
 // __tests__/ is skipped at any depth (never bundled, wherever it sits). See the header.
@@ -93,6 +93,11 @@ export const KDF_MARKER = '(memory) must be at least 8*p bytes';
 // checked against a real Vite build): generateMnemonic and validateMnemonic carry it into the vault
 // page, and nothing else may carry it.
 export const WORDLIST_MARKER = 'abandon\nability\nable\nabout';
+// React 18's internal export name, present only in react / react-dom 18 (React 19 renamed it). The
+// vault page is plain DOM (spec B1b-2a S1): no file it loads may carry React. The marker must also be
+// present in SOME built file (the popup's), or a React upgrade would make the rule pass trivially —
+// that INCONCLUSIVE is what an upgrade trips, and the fix is to update this marker.
+export const REACT_MARKER = '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED';
 const MARKERS = [
   ['envelope', VAULT_MARKER],
   ['derivation', DERIVATION_MARKER],
@@ -376,6 +381,10 @@ export function bundleViolations(distApp) {
     }
   }
 
+  if (!js.some(p => readFileSync(join(distApp, p), 'utf8').includes(REACT_MARKER))) {
+    out.push(`INCONCLUSIVE: the React marker "${REACT_MARKER}" is in no built JS file — React 19 renamed it: update REACT_MARKER, or the no-React-in-the-vault-page rule passes trivially`);
+  }
+
   // The other direction: the vault page may not load the background entry. Importing background.js
   // runs it — its runtime listeners and its poller — inside the vault page (a Rolldown runtime helper
   // placed in background.js once made the unlock bundle import it, and every marker check passed).
@@ -384,7 +393,13 @@ export function bundleViolations(distApp) {
     for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g)) {
       const r = resolveBuilt(distApp, 'unlock.html', m[1]);
       if (r.problem) problems.add(r.problem);
-      else if (reachable(distApp, r.target, problems).includes('background.js')) out.push(`the vault page (${r.target}) reaches background.js — it would run the background`);
+      else {
+        const files = reachable(distApp, r.target, problems);
+        if (files.includes('background.js')) out.push(`the vault page (${r.target}) reaches background.js — it would run the background`);
+        for (const file of files) {
+          if (/\.m?js$/.test(file) && readFileSync(join(distApp, file), 'utf8').includes(REACT_MARKER)) out.push(`${file} (reachable from unlock.html) contains React — the vault page must stay plain DOM`);
+        }
+      }
     }
   }
 
```

Create `extension/src/app/App.tsx`:

```tsx
import {useEffect, useReducer, useState} from 'react';
import {WalletProvider, useWallet, type Surface} from './WalletContext';
import {createEngine, type Engine, type HistoryItem} from './engine';
import {browserPlatform, type Platform} from './platform';
import {firstRoute, routeReducer} from './router';
import {TabBar} from './ui/TabBar';
import {Home} from './screens/Home';
import {Locked} from './screens/Locked';
import {NoWallet} from './screens/NoWallet';
import {Switcher} from './screens/Switcher';
import {Receive} from './screens/Receive';
import {Activity} from './screens/Activity';
import {TxDetail} from './screens/TxDetail';
import {Settings} from './screens/Settings';
import {About} from './screens/About';

function Shell() {
  const m = useWallet();
  const [stack, go] = useReducer(routeReducer, undefined, firstRoute);
  const [accounts, setAccounts] = useState(false);
  const [txItems, setTxItems] = useState<Record<string, HistoryItem>>({});
  const route = stack[stack.length - 1] ?? {screen: 'tab', tab: 'home'};

  // Esc goes back one step on a pushed screen (a sheet handles its own Esc).
  useEffect(() => {
    if (stack.length < 2 || accounts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') go({type: 'pop'});
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [stack.length, accounts]);

  if (m.phase === 'loading') return <div className="app-content" aria-busy="true" />;
  if (m.phase === 'no-wallet') return <NoWallet />;
  if (m.phase === 'locked') return <Locked />;

  let screen;
  if (route.screen === 'tab') {
    if (route.tab === 'home') {
      screen = <Home onReceive={() => go({type: 'push', route: {screen: 'receive'}})} onActivity={() => go({type: 'tab', tab: 'activity'})} onAccounts={() => setAccounts(true)} />;
    } else if (route.tab === 'activity') {
      screen = (
        <Activity
          onTx={item => {
            setTxItems(t => ({...t, [item.signature]: item}));
            go({type: 'push', route: {screen: 'tx', signature: item.signature}});
          }}
          onReceive={() => go({type: 'push', route: {screen: 'receive'}})}
        />
      );
    } else {
      screen = <Settings onAccounts={() => setAccounts(true)} onAbout={() => go({type: 'push', route: {screen: 'about'}})} />;
    }
  } else if (route.screen === 'receive') {
    screen = <Receive onBack={() => go({type: 'pop'})} />;
  } else if (route.screen === 'tx') {
    screen = <TxDetail signature={route.signature} item={txItems[route.signature]} onBack={() => go({type: 'pop'})} />;
  } else {
    screen = <About onBack={() => go({type: 'pop'})} />;
  }

  return (
    <>
      <main className="app-content">{screen}</main>
      {route.screen === 'tab' ? <TabBar active={route.tab} onChange={tab => go({type: 'tab', tab})} /> : null}
      {accounts ? <Switcher onClose={() => setAccounts(false)} /> : null}
    </>
  );
}

/** The popup (412 × 600) and the tab (wallet.html, a 412 px column) are one app (spec §1.1). */
export function App({surface, engine, platform = browserPlatform}: {surface: Surface; engine?: Engine; platform?: Platform}) {
  // One client for the life of the page: the provider's effects key on it.
  const [client] = useState<Engine>(() => engine ?? createEngine());
  return (
    <div className={`app app-${surface}`}>
      <WalletProvider engine={client} platform={platform} surface={surface}>
        <Shell />
      </WalletProvider>
    </div>
  );
}
```

Create `extension/src/app/app.css`:

```css
/*
 * The extension's own layout (spec B1b-2a §1.4), on top of design-system.css (tokens, type, buttons)
 * and design-ext.css (the design's screen classes). Only what the phone mockups cannot say: the
 * popup's fixed 412 × 600 frame, the tab's 412 px column, a scrolling content region between a 56 px
 * top and an 80 px tab bar, and a few state helpers. Colours are tokens only.
 */
html,
body {
  margin: 0;
  background: var(--bg-base);
  color: var(--fg-primary);
}
#root {
  height: 100%;
}

/* The popup: exactly the action popup's size, never a horizontal scroll. */
html:has(.app-popup),
body:has(.app-popup) {
  width: 412px;
  height: 600px;
  overflow: hidden;
}
.app {
  display: flex;
  flex-direction: column;
  width: 412px;
  height: 600px;
  overflow: hidden;
  position: relative;
  background: var(--bg-base);
}
/* The tab: the same app in a 412 px column centred on the page. */
.app-tab {
  height: 100vh;
  margin-inline: auto;
}
.app-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}
/*
 * The mockups clip their scroll areas (a phone frame); here the content region scrolls instead: a
 * screen grows with its content and nothing in it shrinks (a long list once squeezed the activity
 * filter chips to zero height — found by the plan's E2E dry run).
 */
.app-content .scroll,
.app-content .screen {
  overflow: visible;
}
.app-content > .screen {
  flex: 1 0 auto;
}
.app-content .screen > * {
  flex-shrink: 0;
}
.app-tab-bar {
  flex: 0 0 80px;
  height: 80px;
}
.app-tab-bar .item {
  min-height: var(--touch-target-min);
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
}

/* Buttons that are rows or tiles in the design. */
.app-content button.tx-row,
.app-content button.s7-row,
.app-account,
.app-account-pick,
.app-addr-card,
.app-strip,
.app-token-row {
  width: 100%;
  text-align: start;
  font: inherit;
  color: inherit;
  border: 0;
  cursor: pointer;
}
.app-account {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  min-height: var(--touch-target-min);
  width: auto;
  padding: 0;
}
.app-account-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.top-actions button:disabled,
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.is-spinning svg {
  animation: spin var(--dur-spin) linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .is-spinning svg {
    animation: none;
  }
}

.app-banner {
  margin: var(--space-3) var(--space-4) 0;
}
.banner .banner-line {
  color: var(--fg-secondary);
  margin-top: 2px;
}
.app-callout ul {
  margin: var(--space-2) 0 0;
  padding-inline-start: var(--space-5);
}
.app-offline-note {
  padding: var(--space-3) var(--space-4) 0;
  text-align: center;
  margin: 0;
}

.app-muted {
  color: var(--fg-secondary);
}
.app-dim {
  color: var(--fg-tertiary);
}
.app-warning {
  color: var(--warning);
}
.app-success {
  color: var(--success);
}
.app-reveal {
  color: var(--fg-secondary);
}

/* Centered states: locked, no wallet. */
.app-center {
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-4);
  padding: var(--space-6);
}
.app-center-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.app-center-text {
  text-align: center;
}
.app-lock-tile {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-icon-hero);
  background: var(--bg-surface-2);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sheets: the design's .s8-sheet, laid over the whole app. */
.app-sheet-layer {
  position: absolute;
  inset: 0;
  z-index: 10;
}
.s8-sheet .grabber-hit {
  background: transparent;
  border: 0;
  padding: var(--space-2) 0;
  cursor: pointer;
  width: 100%;
  min-height: 24px;
}
.app-sheet-body {
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.app-account-row,
.app-token-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2);
  border-radius: var(--radius-md);
}
.app-token-row {
  grid-template-columns: 32px 1fr auto;
  background: transparent;
}
.app-account-row.sel,
.app-token-row.sel {
  background: color-mix(in oklab, var(--accent) 14%, var(--bg-surface-3));
  border: 1px solid color-mix(in oklab, var(--accent) 32%, transparent);
}
.app-account-pick {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: var(--space-3);
  align-items: center;
  background: transparent;
  min-height: var(--touch-target-min);
}
.app-account-pick > span:nth-child(2),
.app-token-row > span {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.app-account-pick .pri {
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  color: var(--fg-primary);
}
.app-account-pick .sec {
  font-size: 13px;
  line-height: 18px;
  color: var(--fg-tertiary);
}
.app-account-row .avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.app-rename {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--space-2);
  align-items: center;
}
.app-rename .field-msg {
  grid-column: 1 / -1;
}
.app-input,
.app-amount-input {
  background: var(--bg-surface-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--fg-primary);
  font: inherit;
  min-height: var(--touch-target-min);
  padding: 0 var(--space-3);
}
.app-amount-input {
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 28px;
  line-height: 34px;
  width: 100%;
}
.app-btn-sm {
  width: auto;
  height: var(--touch-target-min);
  padding: 0 var(--space-4);
  font-size: 15px;
}

/* Receive */
.app-addr-card {
  display: block;
}

/* Activity */
.app-content .tx-row {
  background: transparent;
}
.app-load-more {
  margin: var(--space-4) 0;
}
.app-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-6);
}
.app-empty-actions {
  margin-top: var(--space-6);
  width: 100%;
}

/* Settings and About */
.app-settings-body,
.app-about-body {
  padding: 0 var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.s7-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.app-static {
  cursor: default;
}
.app-about-card {
  background: var(--bg-surface-1);
  border-radius: var(--radius-2xl);
  padding: var(--space-7) var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
}
.app-about-mark {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-icon-hero);
  background: linear-gradient(135deg, var(--accent-transparent), var(--accent-shielded));
  color: var(--bg-base);
  display: flex;
  align-items: center;
  justify-content: center;
}
.app-about-foot {
  text-align: center;
  padding: var(--space-7) var(--space-4);
}
.s8-sheet .grabber-hit .grabber {
  display: block;
}
```

Create `extension/src/app/mount.tsx`:

```tsx
import '../../../web/src/styles/design-system.css';
import '../styles/design-ext.css';
import './app.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import type {Surface} from './WalletContext';

/**
 * StrictMode runs every effect twice in development builds only (mount, unmount, mount): the provider's
 * open sequence may then read twice in `vite dev`. Production builds — what the extension ships — run
 * each effect once (review L10).
 */
export function mount(surface: Surface): void {
  const root = document.getElementById('root');
  if (root === null) throw new Error('no #root element');
  createRoot(root).render(
    <StrictMode>
      <App surface={surface} />
    </StrictMode>,
  );
}
```

Create `extension/src/app/popup.tsx`:

```tsx
import {mount} from './mount';
mount('popup');
```

Create `extension/src/app/router.ts`:

```ts
import type {Tab} from './ui/TabBar';

/**
 * In-memory navigation (spec §1.6): a stack of routes in a reducer — push, pop, replace, back to a
 * tab. No router library, and no route that acts: every value a screen shows comes from the
 * background. Plan 1's routes only; plan 3 adds the send flow.
 */
export type Route = {screen: 'tab'; tab: Tab} | {screen: 'receive'} | {screen: 'tx'; signature: string} | {screen: 'about'};
export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab};

export function routeReducer(stack: Route[], action: RouteAction): Route[] {
  switch (action.type) {
    case 'push':
      return [...stack, action.route];
    case 'pop':
      return stack.length > 1 ? stack.slice(0, -1) : stack;
    case 'tab':
      return [{screen: 'tab', tab: action.tab}];
  }
}

/**
 * The tab surface's first route, from `location.hash`. Plan 1 has one route, `#/home` (#11 in a
 * column); any other hash shows it too. The hash only ever chooses a screen — it never acts.
 */
export function firstRoute(): Route[] {
  return [{screen: 'tab', tab: 'home'}];
}
```

Create `extension/src/app/screens/About.tsx`:

```tsx
import {useWallet} from '../WalletContext';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';

/**
 * #38 about (spec §6.1). The version only (no build stamp); "noc-tura.io" as text, not a link —
 * Solscan is the one external link (§6.5). Terms, Privacy, licences and help arrive with their pages
 * (a release gate, B1e).
 */
export function About({onBack}: {onBack: () => void}) {
  const m = useWallet();
  return (
    <div className="screen app-about">
      <TopBar title="About" onBack={onBack} />
      <div className="app-about-body">
        <div className="app-about-card">
          <div className="app-about-mark" aria-hidden="true">
            <ExtIcon name="shield-lock" size={36} />
          </div>
          <h2 className="s7-wordmark">
            noctura<span className="dot">.</span>
          </h2>
          <p className="noc-body-sm app-muted">Solana wallet for your browser — your keys stay on this device.</p>
          <p className="noc-caption noc-mono app-dim">v{m.platform.version()}</p>
        </div>
        <p className="noc-overline app-dim">Resources</p>
        <div className="s7-list">
          <div className="s7-row app-static">
            <span className="s7-glyph">
              <ExtIcon name="globe" size={20} />
            </span>
            <span className="s7-title noc-mono">noc-tura.io</span>
          </div>
        </div>
        <div className="app-about-foot">
          <p className="noc-caption app-dim">© 2026 Noctura</p>
          <p className="noc-caption app-dim">
            BSL 1.1 · converts to MIT on <span className="noc-numeral">2034-01-01</span>
          </p>
        </div>
      </div>
    </div>
  );
}
```

Create `extension/src/app/screens/Locked.tsx`:

```tsx
import {useWallet} from '../WalletContext';
import {ExtIcon} from '../ui/ExtIcon';

/**
 * The popup's locked screen (spec §4.1, derived from #9): no password field — the password only ever
 * exists in the vault page (D12), so [Unlock] opens it in a tab. "Forgot password?" arrives with #39 in
 * plan 2 (the `forgot` vault mode does not exist yet; linking it now would open the plain unlock page).
 */
export function Locked() {
  const {platform} = useWallet();
  const unlock = () => {
    platform.openPage('unlock.html?mode=unlock');
    platform.closeWindow();
  };
  return (
    <div className="screen app-center">
      <div className="app-lock-tile" aria-hidden="true">
        <ExtIcon name="lock" size={28} />
      </div>
      <h1 className="noc-h1">Welcome back</h1>
      <p className="noc-body app-muted">Unlock Noctura to continue. Unlocking opens in a new tab.</p>
      <div className="app-center-actions">
        <button type="button" className="btn btn-primary" onClick={unlock}>
          Unlock
        </button>
      </div>
    </div>
  );
}
```

Create `extension/src/app/screens/NoWallet.tsx`:

```tsx
import {useWallet} from '../WalletContext';

/**
 * No wallet yet (§1.6 step 1). The popup has already opened the welcome page and asked to close;
 * this is what shows for that moment. The tab (wallet.html) does not close itself: it offers the
 * same page with a button (#9's no-wallet words).
 */
export function NoWallet() {
  const {surface, platform} = useWallet();
  if (surface === 'popup') {
    return (
      <div className="screen app-center">
        <p className="noc-body app-muted" role="status">
          Opening setup in a new tab…
        </p>
      </div>
    );
  }
  return (
    <div className="screen app-center">
      <p className="noc-body">No wallet on this browser yet.</p>
      <div className="app-center-actions">
        <button type="button" className="btn btn-primary" onClick={() => platform.openPage('unlock.html?mode=welcome')}>
          Set up a wallet
        </button>
      </div>
    </div>
  );
}
```

Create `extension/src/app/screens/Settings.tsx`:

```tsx
import {useWallet} from '../WalletContext';
import {ListRow} from '../ui/ListRow';
import {LockedButton} from '../ui/LockedButton';
import {ExtIcon} from '../ui/ExtIcon';

/**
 * The minimal Settings tab (spec §6.1): Accounts, Lock now, About. Everything else on #31 is
 * B1b-2b's by the owner's decision (profile, currency, notifications, security centre, passkeys,
 * change password, backup, RPC, connections, advanced, delete wallet).
 */
export function Settings({onAccounts, onAbout}: {onAccounts: () => void; onAbout: () => void}) {
  const m = useWallet();
  const n = m.wallet?.accounts.length ?? 0;
  return (
    <div className="screen app-settings">
      <div className="s-vi-top">
        <div className="left">
          <h1 className="noc-h1">Settings</h1>
        </div>
      </div>
      <div className="app-settings-body">
        <p className="s7-group-label">Account</p>
        <div className="s7-list">
          <ListRow icon="settings" title="Accounts" meta={`${n} ${n === 1 ? 'account' : 'accounts'}`} onPress={onAccounts} />
        </div>
        <p className="s7-group-label">Security</p>
        <div className="s7-list">
          {/* Rule 6 (§7.6): "Lock now" is a LockedButton — one lock per tap, 500 ms floor. */}
          <LockedButton className="s7-row" onPress={() => m.lock()}>
            <span className="s7-glyph">
              <ExtIcon name="lock" size={20} />
            </span>
            <span className="s7-title">Lock now</span>
            <span className="s7-meta" />
            <span className="s7-chev">
              <ExtIcon name="chevron-right" size={16} />
            </span>
          </LockedButton>
        </div>
        <p className="s7-group-label">About</p>
        <div className="s7-list">
          <ListRow icon="info" title="About Noctura" meta={<span className="noc-mono">v{m.platform.version()}</span>} onPress={onAbout} />
        </div>
      </div>
    </div>
  );
}
```

Create `extension/src/app/tab.tsx`:

```tsx
import {mount} from './mount';
mount('tab');
```

Delete `extension/src/popup/main.ts` (`git rm extension/src/popup/main.ts`).

Modify `extension/vite.config.ts`:

```diff
diff --git a/extension/vite.config.ts b/extension/vite.config.ts
--- a/extension/vite.config.ts
+++ b/extension/vite.config.ts
@@ -36,6 +36,7 @@ export default defineConfig({
       input: {
         background: resolve(__dirname, 'src/background/index.ts'),
         popup: resolve(__dirname, 'popup.html'),
+        wallet: resolve(__dirname, 'wallet.html'),
         unlock: resolve(__dirname, 'unlock.html'),
       },
       output: {
```

Create `extension/wallet.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Noctura</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/app/tab.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Run the tests and watch them pass.**

Run: `npx vitest run src/app/__tests__/App.test.tsx src/app/__tests__/Settings.test.tsx scripts/__tests__/check-vault-isolation.test.mjs scripts/__tests__/check-fonts.test.mjs`
Expected: PASS — 4 files, 147 tests.

- [ ] **Step 5: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 78 files, 915 tests.

- [ ] **Step 6: The whole local gate, and the E2E that exists so far.**

Run: `npm run verify && npx playwright test e2e/wallet.spec.ts e2e/unlock.spec.ts`
Expected: build ok; `Test Files  78 passed (78)` · `Tests  915 passed (915)`; `CSP ok`; the secret scan passes; `permissions ok`, `vault isolation ok`, `rpc methods ok`, `no TGE date`, `fonts ok: both Geist files are in dist/app/fonts and every font URL in the CSS resolves there`; `reproducible: chrome 17 files …` and `firefox 17 files …`; then `3 passed`.

- [ ] **Step 7: Visual pass (spec §8.6).** These states are captured at 412 × 600 by Task 17's `e2e/visual.spec.ts` and reviewed there against the design: `09-locked`, `31-settings-minimal`, `38-about`. Nothing to do here but check the names still match the states this task built.

- [ ] **Step 8: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **React allowed in the vault page:** in `bundleViolations`, make the unlock-reachable React check `if (false)`. Run `npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` → RED: 1 failed.
  - **no INCONCLUSIVE:** make the React-marker presence check `if (false) {`. Run `npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` → RED: 1 failed.
  - **any font URL:** in `check-fonts.mjs`, make the per-URL check `if (false) out.push(…)`. Run `npx vitest run scripts/__tests__/check-fonts.test.mjs` → RED: 1 failed.
  - **two Reacts:** in `vite.config.ts`, drop `resolve(__dirname, '../web/src/ui')` from `SHARED` (with `web/node_modules` present, `CopyButton` gets web's React). Run `npx vitest run src/app/__tests__/TxDetail.test.tsx` → RED: 4 failed (invalid hook call).
  - **Lock now without the floor (M3):** pass `wait={async () => undefined}` to the Lock now `LockedButton`. Run `npx vitest run src/app/__tests__/Settings.test.tsx` → RED: 1 failed.
  - **no Esc:** in `App.tsx`, delete `if (e.key === 'Escape') go({type: 'pop'});`. Run `npx vitest run src/app/__tests__/App.test.tsx` → RED: 1 failed.
  - **popup stays open with no wallet:** in `WalletContext.tsx`, delete `platform.closeWindow();` from the no-wallet effect. Run `npx vitest run src/app/__tests__/App.test.tsx` → RED: 1 failed.

- [ ] **Step 9: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add .github/workflows/extension.yml extension/e2e/wallet.spec.ts extension/package.json extension/popup.html extension/scripts/__tests__/check-fonts.test.mjs extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/check-fonts.mjs extension/scripts/check-vault-isolation.mjs extension/src/app/App.tsx extension/src/app/__tests__/App.test.tsx extension/src/app/__tests__/Settings.test.tsx extension/src/app/__tests__/appHarness.tsx extension/src/app/app.css extension/src/app/mount.tsx extension/src/app/popup.tsx extension/src/app/router.ts extension/src/app/screens/About.tsx extension/src/app/screens/Locked.tsx extension/src/app/screens/NoWallet.tsx extension/src/app/screens/Settings.tsx extension/src/app/tab.tsx extension/src/popup/main.ts extension/vite.config.ts extension/wallet.html
git commit -m "feat(extension): the app shell for the popup and wallet.html, Settings, #38, the locked screen; React and font gates (B1b-2a §1.1–§1.6, §4.1, §6.1)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 17: E2E containment for Solscan, the fake coordinator's switches, and the visual pass

**Files:**
- Modify: `extension/e2e/fakeCoordinator.ts`
- Modify: `extension/e2e/launch.ts`
- Create: `extension/e2e/popupHarness.ts`
- Modify: `extension/e2e/unlock.spec.ts`
- Create: `extension/e2e/visual.spec.ts`
- Modify: `extension/e2e/wallet.spec.ts`

**Interfaces:**
- Consumes: Task 16's popup; Task 15's `historyFixtures.ts`; Task 3's fake simulation.
- Produces:
  - `launch.ts`: `HOST_RESOLVER_RULES` with Solscan; `containSolscan(ctx): Promise<{hits: string[]}>`; `unlock.spec.ts` uses it
  - `fakeCoordinator.ts`: `network: 'ok' | 'forbidden' | 'unreachable'`, `accountKinds`, `history`
  - `popupHarness.ts`: `account(index, name, fill)`, `MAIN`, `SAVINGS`, `seedUnlockedWallet(sw, accounts?)`, `interface Harness`, `launchPopup(prefix)`, `contained(h)`
  - `visual.spec.ts`

Spec §8.5 (review M5): "`HOST_RESOLVER_RULES` adds `MAP solscan.io ~NOTFOUND, MAP *.solscan.io ~NOTFOUND`, and a `ctx.route('https://solscan.io/**')` / `*.solscan.io` handler aborts and counts. Every spec asserts the Solscan counter is 0". `unlock.spec.ts` installs the same Solscan counter and asserts it empty (review M6). The fake grows `getAccountInfo` kinds, per-owner history pages, a 403 switch and an "unreachable" switch (`route.abort()`). `popupHarness.ts` opens `popup.html` at 412 × 600 ("Playwright cannot click the toolbar action; stated") and seeds a wallet (Scope item 14). §8.6: `e2e/visual.spec.ts` "drives every state … and saves `test-results/visual/<NN>-<state>.png` at **412 × 600**", compared by a reviewer against `index.html` — the checklist is Step 4. Screenshots are CI artifacts, never committed.

- [ ] **Step 1: Implement.**

Modify `extension/e2e/fakeCoordinator.ts`:

```diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -24,12 +24,21 @@ export interface FakeCoordinator {
   historyChecks: {signature: string; at: number}[];
   /** Anything the fake was asked that it does not implement, or asked in the wrong shape. */
   unexpected: string[];
+  /**
+   * B1b-2a: 'ok' answers; 'forbidden' answers every request 403 (the D26 cool-down); 'unreachable'
+   * aborts every request — no answer at all (#42).
+   */
+  network: 'ok' | 'forbidden' | 'unreachable';
   /** SOL per address, lamports; anything unlisted holds 10 SOL. */
   lamports: Map<string, number>;
+  /** What getAccountInfo says an address is (E2); anything unlisted does not exist. */
+  accountKinds: Map<string, 'wallet' | 'program' | 'other'>;
   /** The simulation's error switch (E2): err set and accounts null, as the real RPC answers. */
   simulateError: boolean;
   /** Every simulateTransaction's requested addresses (null = the field was missing). */
   simulations: (string[] | null)[];
+  /** Per owner, newest first: the signatures getSignaturesForAddress pages through, and each getTransaction result. */
+  history: Map<string, {signature: string; tx: unknown}[]>;
 }
 
 /** Compact-u16: the signature count that opens a serialized transaction. */
@@ -91,9 +100,12 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     broadcastWires: [],
     historyChecks: [],
     unexpected: [],
+    network: 'ok',
     lamports: new Map(),
+    accountKinds: new Map(),
     simulateError: false,
     simulations: [],
+    history: new Map(),
   };
   const statusChecks = new Map<string, number>();
   const context = () => ({slot: fake.blockHeight + 50});
@@ -151,18 +163,31 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
         return {context: context(), value: []};
       case 'getMultipleAccounts':
         return {context: context(), value: (params[0] as unknown[]).map(() => null)};
-      case 'getAccountInfo':
-        return {context: context(), value: null};
+      case 'getAccountInfo': {
+        const kind = fake.accountKinds.get(params[0] as string);
+        if (kind === undefined) return {context: context(), value: null};
+        const owner = kind === 'wallet' ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
+        return {context: context(), value: {lamports: 1_000_000, owner, executable: kind === 'program', data: ['', 'base64'], rentEpoch: 0, space: 0}};
+      }
       case 'getBlockHeight':
         return fake.blockHeight;
       case 'getSignatureStatuses': {
         const config = params[1] as {searchTransactionHistory?: boolean} | undefined;
         return signatureStatuses(params[0] as string[], config?.searchTransactionHistory === true);
       }
-      case 'getSignaturesForAddress':
-        return [];
-      case 'getTransaction':
+      case 'getSignaturesForAddress': {
+        const list = fake.history.get(params[0] as string) ?? [];
+        const o = params[1] as {limit?: number; before?: string} | undefined;
+        const from = o?.before === undefined ? 0 : list.findIndex(e => e.signature === o.before) + 1;
+        return list.slice(from, from + (o?.limit ?? 10)).map(e => ({signature: e.signature, slot: 1, err: null, memo: null, blockTime: null, confirmationStatus: 'finalized'}));
+      }
+      case 'getTransaction': {
+        for (const list of fake.history.values()) {
+          const hit = list.find(e => e.signature === params[0]);
+          if (hit !== undefined) return hit.tx;
+        }
         return null;
+      }
       default:
         fake.unexpected.push(`rpc ${method}`);
         return null;
@@ -174,6 +199,15 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
   await ctx.route('https://api.noc-tura.io/**', async route => {
     const req = route.request();
     const url = req.url();
+    // B1b-2a: the two failure switches, counted as hits (the request did leave the extension).
+    if (fake.network === 'unreachable') {
+      fake.hits.push({url, rpcMethod: null});
+      return route.abort('internetdisconnected');
+    }
+    if (fake.network === 'forbidden') {
+      fake.hits.push({url, rpcMethod: null});
+      return json(route, 403, {error: 'forbidden'});
+    }
     if (url === RPC && req.method() === 'POST') {
       const body = JSON.parse(req.postData() ?? '{}') as {jsonrpc?: string; id?: number; method?: string; params?: unknown[]};
       const method = body.method ?? '';
```

Modify `extension/e2e/launch.ts`:

```diff
diff --git a/extension/e2e/launch.ts b/extension/e2e/launch.ts
--- a/extension/e2e/launch.ts
+++ b/extension/e2e/launch.ts
@@ -8,11 +8,13 @@ import {join} from 'node:path';
 export const EXT = fileURLToPath(new URL('../dist/chrome', import.meta.url));
 
 /**
- * The safety net under any ctx.route: every noc-tura.io name fails to resolve inside this
- * browser, so a request nothing catches fails locally instead of reaching the real host (a
- * CrowdSec bouncer bans IPs on 403s). Every E2E launches through launchContained.
+ * The safety net under any ctx.route: every noc-tura.io name — and, since the explorer link (B1b-2a
+ * §6.5, review M5), every solscan.io name — fails to resolve inside this browser, so a request nothing
+ * catches fails locally instead of reaching the real host (a CrowdSec bouncer bans IPs on 403s).
+ * Every E2E launches through launchContained.
  */
-export const HOST_RESOLVER_RULES = '--host-resolver-rules=MAP *.noc-tura.io ~NOTFOUND, MAP noc-tura.io ~NOTFOUND';
+export const HOST_RESOLVER_RULES =
+  '--host-resolver-rules=MAP *.noc-tura.io ~NOTFOUND, MAP noc-tura.io ~NOTFOUND, MAP solscan.io ~NOTFOUND, MAP *.solscan.io ~NOTFOUND';
 
 /** Chromium with the built extension loaded and noc-tura.io unresolvable, in a fresh profile. */
 export async function launchContained(profilePrefix: string): Promise<{ctx: BrowserContext; profile: string}> {
@@ -33,8 +35,23 @@ export async function expectContained(ctx: BrowserContext): Promise<void> {
   const page = await ctx.newPage();
   try {
     await page.goto('chrome://version');
-    await expect(page.locator('#command_line')).toContainText('MAP *.noc-tura.io ~NOTFOUND, MAP noc-tura.io ~NOTFOUND');
+    await expect(page.locator('#command_line')).toContainText('MAP *.noc-tura.io ~NOTFOUND, MAP noc-tura.io ~NOTFOUND, MAP solscan.io ~NOTFOUND, MAP *.solscan.io ~NOTFOUND');
   } finally {
     await page.close();
   }
 }
+
+/**
+ * The explorer link's host, routed and counted: any request to solscan.io is aborted and recorded.
+ * Every spec asserts the count is 0 — the link's href is checked, never followed.
+ */
+export async function containSolscan(ctx: BrowserContext): Promise<{hits: string[]}> {
+  const hits: string[] = [];
+  const abort = (route: import('@playwright/test').Route) => {
+    hits.push(route.request().url());
+    return route.abort();
+  };
+  await ctx.route('https://solscan.io/**', abort);
+  await ctx.route(/^https?:\/\/([^/]*\.)?solscan\.io(\/|$)/, abort);
+  return {hits};
+}
```

Create `extension/e2e/popupHarness.ts`:

```ts
import {expect, type BrowserContext, type Page, type Worker} from '@playwright/test';
import {rmSync} from 'node:fs';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {installFakeCoordinator, type FakeCoordinator} from './fakeCoordinator';
import {containSolscan, expectContained, launchContained} from './launch';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {set(o: object): Promise<void>}}};

/** Two accounts with known keys (32-byte seeds of 1s and 2s): public data only reaches the popup. */
export function account(index: number, name: string, fill: number) {
  const seed = new Uint8Array(32).fill(fill);
  const pub = ed25519.getPublicKey(seed);
  return {index, name, publicKey: base58.encode(pub), secretKey: base64.encode(new Uint8Array([...seed, ...pub]))};
}
export const MAIN = account(0, 'Main', 1);
export const SAVINGS = account(1, 'Savings', 2);

const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));

/**
 * A wallet the popup can show: an envelope of the right shape (the popup reads only its public part)
 * and the two signing keys in storage.session — written by the test, not through the vault page, which
 * these specs are not about (unlock.spec.ts and wallet.spec.ts cover it).
 */
export async function seedUnlockedWallet(sw: Worker, accounts = [MAIN, SAVINGS]): Promise<void> {
  const envelope = {
    v: 1,
    scheme: 'slip10',
    kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
    seed: {iv: B(12, 2), ct: B(48, 3)},
    password: {wrapped: B(40, 4)},
    accounts: accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})),
  };
  const session = {accounts: accounts.map(a => ({index: a.index, publicKey: a.publicKey, secretKey: a.secretKey}))};
  await sw.evaluate(({e, s}) => Promise.all([chrome.storage.local.set({v1_vault: e}), chrome.storage.session.set({v1_session: s})]), {e: envelope, s: session});
}

export interface Harness {
  ctx: BrowserContext;
  fake: FakeCoordinator;
  sw: Worker;
  id: string;
  solscan: {hits: string[]};
  openPopup(): Promise<Page>;
  close(): Promise<void>;
}

/** The contained browser (noc-tura.io and solscan.io unresolvable, both routed), the fake, a popup opener at 412 × 600. */
export async function launchPopup(prefix: string): Promise<Harness> {
  const {ctx, profile} = await launchContained(prefix);
  const fake = await installFakeCoordinator(ctx);
  const solscan = await containSolscan(ctx);
  await expectContained(ctx);
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const id = new URL(sw.url()).host;
  return {
    ctx,
    fake,
    sw,
    id,
    solscan,
    // Playwright cannot click the toolbar action: the popup page is opened as a page, at the popup's size.
    async openPopup() {
      const page = await ctx.newPage();
      await page.setViewportSize({width: 412, height: 600});
      await page.goto(`chrome-extension://${id}/popup.html`);
      return page;
    },
    async close() {
      await ctx.close();
      rmSync(profile, {recursive: true, force: true});
    },
  };
}

/** What every spec ends with: the route saw the worker's requests, nothing unexpected, Solscan never contacted. */
export function contained(h: Harness): void {
  expect(h.fake.hits.length).toBeGreaterThan(0);
  expect(h.fake.unexpected).toEqual([]);
  expect(h.solscan.hits).toEqual([]);
}
```

Modify `extension/e2e/unlock.spec.ts`:

```diff
diff --git a/extension/e2e/unlock.spec.ts b/extension/e2e/unlock.spec.ts
--- a/extension/e2e/unlock.spec.ts
+++ b/extension/e2e/unlock.spec.ts
@@ -1,7 +1,7 @@
 import {test, expect} from '@playwright/test';
 import {rmSync} from 'node:fs';
 import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';
-import {expectContained, launchContained} from './launch';
+import {containSolscan, expectContained, launchContained} from './launch';
 
 declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {get(k: null): Promise<object>; clear(): Promise<void>}}};
 
@@ -14,6 +14,8 @@ test('unlocking in the vault page puts only signing keys into session storage',
     contacted.push(route.request().url());
     return route.abort();
   });
+  // The explorer's host too (review M6): routed, counted, asserted empty at the end.
+  const solscan = await containSolscan(ctx);
   try {
     await expectContained(ctx);
     const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
@@ -54,6 +56,7 @@ test('unlocking in the vault page puts only signing keys into session storage',
     await expect(page.locator('#status')).toHaveText("This wallet's stored data is damaged.", {timeout: 60_000});
     expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});
     expect(contacted).toEqual([]);
+    expect(solscan.hits).toEqual([]);
   } finally {
     await ctx.close();
     rmSync(profile, {recursive: true, force: true});
```

Create `extension/e2e/visual.spec.ts`:

```ts
import {test, expect, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet} from './popupHarness';
import {COUNTERPARTY, failedTx, otherTx, presalePurchase, receivedUsdc, sentSol, sig} from './historyFixtures';

// Spec B1b-2a §8.6: every plan-1 state, rendered by the real popup at 412 × 600, saved for the review
// against the design (index.html #sNN). Not a pixel diff: a reviewer compares each image with the
// mockup of the same state using the checklist in the plan. Screenshots are CI artifacts, never committed.
const DIR = 'test-results/visual';
const shot = async (page: Page, name: string) => {
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`});
};

test('visual: the plan-1 screens and states at 412 × 600', async () => {
  const h = await launchPopup('noctura-e2e-visual-');
  try {
    // #9-derived locked screen.
    await seedUnlockedWallet(h.sw);
    await h.sw.evaluate(() => (globalThis as unknown as {chrome: {storage: {session: {clear(): Promise<void>}}}}).chrome.storage.session.clear());
    const locked = await h.openPopup();
    await expect(locked.getByText('Welcome back')).toBeVisible();
    await shot(locked, '09-locked');
    await locked.close();

    await seedUnlockedWallet(h.sw);
    const now = Math.floor(Date.now() / 1000);
    h.fake.history.set(MAIN.publicKey, [
      {signature: sig(1), tx: sentSol(MAIN.publicKey, SAVINGS.publicKey, 2_480_000_000, now - 60)},
      {signature: sig(2), tx: receivedUsdc(MAIN.publicKey, COUNTERPARTY, 250_000_000, now - 120)},
      {signature: sig(3), tx: presalePurchase(MAIN.publicKey, 1_000_000_000, now - 90_000)},
      {signature: sig(4), tx: otherTx(MAIN.publicKey, now - 200_000)},
      {signature: sig(5), tx: failedTx(MAIN.publicKey, now - 3_000_000)},
    ]);
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    await shot(p, '11-loaded');
    await p.getByRole('button', {name: 'Hide balance'}).click();
    await shot(p, '11-hidden-balance');
    await p.getByRole('button', {name: 'Show balance'}).click();

    await p.getByRole('button', {name: 'Accounts'}).click();
    await expect(p.getByRole('dialog', {name: 'Accounts'}).getByText('10.0000 SOL · $1,500.00').first()).toBeVisible();
    await shot(p, '43-account-switcher');
    await p.keyboard.press('Escape');

    await p.getByRole('button', {name: 'Receive'}).click();
    await expect(p.getByText('Public address')).toBeVisible();
    await shot(p, '13-plain-address');
    await p.getByRole('textbox', {name: 'Request amount'}).fill('2.48');
    await expect(p.locator('.pay-ribbon')).toBeVisible();
    await shot(p, '13-pay-request');
    await p.getByRole('button', {name: 'Back'}).click();

    await p.getByRole('button', {name: 'Activity'}).click();
    await expect(p.getByText('Sent SOL')).toBeVisible({timeout: 30_000});
    await shot(p, '26-loaded-mixed');
    await p.getByRole('tab', {name: 'Sent'}).click();
    await shot(p, '26-filter-sent');
    await p.getByRole('tab', {name: 'All'}).click();
    for (const [title, name] of [['Sent SOL', '27-transparent-send'], ['Received USDC', '27-received'], ['Failed · transaction', '27-failed'], ['Presale purchase', '27-purchase']] as const) {
      await p.getByText(title).click();
      await expect(p.getByText('Transaction', {exact: true})).toBeVisible();
      await shot(p, name);
      await p.getByRole('button', {name: 'Back'}).click();
    }

    await p.getByRole('button', {name: 'Settings'}).click();
    await shot(p, '31-settings-minimal');
    await p.getByText('About Noctura').click();
    await shot(p, '38-about');
    await p.close();

    // #41: an account with no history.
    const empty = await h.openPopup();
    await empty.getByRole('button', {name: 'Accounts'}).click();
    await empty.getByRole('dialog', {name: 'Accounts'}).getByText('Savings').click();
    await empty.getByRole('button', {name: 'Activity'}).click();
    await expect(empty.getByText('No activity yet')).toBeVisible({timeout: 30_000});
    await shot(empty, '41-empty');
    await empty.getByRole('button', {name: 'Home'}).click();
    await empty.getByRole('button', {name: 'Accounts'}).click();
    await empty.getByRole('dialog', {name: 'Accounts'}).getByText('Main').click();
    await empty.close();

    // #42 and D26.
    h.fake.network = 'unreachable';
    await h.ctx.setOffline(true);
    const off = await h.openPopup();
    await expect(off.getByText("You're offline")).toBeVisible();
    await shot(off, '42-just-disconnected');
    await off.getByRole('button', {name: 'Refresh'}).click();
    await expect(off.getByText("You're offline · Showing cached data")).toBeVisible();
    await shot(off, '42-sustained');
    h.fake.network = 'ok';
    await h.ctx.setOffline(false);
    await off.getByRole('button', {name: 'Refresh'}).click();
    await expect(off.getByText('Connected · syncing')).toBeVisible();
    await shot(off, '42-reconnecting');
    await off.close();
    h.fake.network = 'forbidden';
    const refused = await h.openPopup();
    await expect(refused.getByText('The server is not answering for now — try again in 10 minutes.')).toBeVisible();
    await shot(refused, '42-refused-d26');
    contained(h);
  } finally {
    await h.close();
  }
});
```

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -2,7 +2,7 @@ import {test, expect, type BrowserContext, type Page} from '@playwright/test';
 import {readFileSync, rmSync} from 'node:fs';
 import {BLOCKHASH_LIFETIME, installFakeCoordinator, type FakeCoordinator} from './fakeCoordinator';
 import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';
-import {expectContained, launchContained} from './launch';
+import {containSolscan, expectContained, launchContained} from './launch';
 // Read from the source rather than imported: core/ has no package.json "type", so Playwright's loader
 // on Node 22 (CI) treats core/solana/rpc.ts as CommonJS and cannot take a named export from it.
 // The same literal the RPC-method gate parses; not found means it moved — fail loudly.
@@ -34,6 +34,7 @@ async function launch() {
   // launchContained makes every noc-tura.io name unresolvable, so one the route misses fails locally.
   const {ctx, profile} = await launchContained('noctura-e2e-wallet-');
   const fake = await installFakeCoordinator(ctx);
+  const solscan = await containSolscan(ctx);
   await expectContained(ctx);
   const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
   const id = new URL(sw.url()).host;
@@ -41,7 +42,7 @@ async function launch() {
   // the popup, with no wallet yet, would open the welcome page and close itself (spec §1.6).
   const popup = await ctx.newPage();
   await popup.goto(`chrome-extension://${id}/wallet.html#/home`);
-  return {ctx, fake, sw, id, popup, profile};
+  return {ctx, fake, sw, id, popup, profile, solscan};
 }
 
 const msg = async (page: Page, m: unknown): Promise<Reply> => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as Reply;
@@ -79,10 +80,11 @@ async function prepareAndSend(page: Page, account: string, intent: object): Prom
   }
 }
 
-function onlyTheSimulatedCoordinator(fake: FakeCoordinator): void {
+function onlyTheSimulatedCoordinator(fake: FakeCoordinator, solscan: {hits: string[]}): void {
   // Not vacuous: the route really saw the service worker's requests.
   expect(fake.hits.length).toBeGreaterThan(0);
   expect(fake.unexpected).toEqual([]);
+  expect(solscan.hits).toEqual([]);
   for (const h of fake.hits) {
     expect(h.url.startsWith('https://api.noc-tura.io/api/v1/')).toBe(true);
     if (h.rpcMethod !== null) expect(ALLOWED_RPC_METHODS).toContain(h.rpcMethod);
@@ -90,7 +92,7 @@ function onlyTheSimulatedCoordinator(fake: FakeCoordinator): void {
 }
 
 test('create a wallet, unlock it, re-authenticate a first send, send SOL: pending → confirmed', async () => {
-  const {ctx, fake, id, popup, sw, profile} = await launch();
+  const {ctx, fake, id, popup, sw, profile, solscan} = await launch();
   try {
     // 1. Onboarding: the vault page's create mode.
     const vault = await ctx.newPage();
@@ -155,7 +157,7 @@ test('create a wallet, unlock it, re-authenticate a first send, send SOL: pendin
     // Owner decision A: the record lives in storage.local, where a lock or a restart cannot drop it.
     const stored = (await sw.evaluate(() => chrome.storage.local.get('v1_pending'))) as {v1_pending?: {signature: string; state: string}[]};
     expect(stored.v1_pending?.map(r => [r.signature, r.state])).toEqual([[signature, 'confirmed']]);
-    onlyTheSimulatedCoordinator(fake);
+    onlyTheSimulatedCoordinator(fake, solscan);
   } finally {
     await ctx.close();
     rmSync(profile, {recursive: true, force: true});
@@ -163,7 +165,7 @@ test('create a wallet, unlock it, re-authenticate a first send, send SOL: pendin
 });
 
 test('an unconfirmed send expires: "no funds moved", nothing re-sent, and only then a new transaction', async () => {
-  const {ctx, fake, id, popup, sw, profile} = await launch();
+  const {ctx, fake, id, popup, sw, profile, solscan} = await launch();
   try {
     fake.mode = 'expire';
     await sw.evaluate(({env, recipient}) => chrome.storage.local.set({v1_vault: env, v1_known_recipients: [recipient]}), {env: await makeEnvelope(), recipient: RECIPIENT});
@@ -214,7 +216,7 @@ test('an unconfirmed send expires: "no funds moved", nothing re-sent, and only t
     expect(secondRecord?.state).toBe('pending');
     expect(secondRecord?.lastValidBlockHeight).toBe(fake.blockHeight + BLOCKHASH_LIFETIME);
     expect(await pendingState(popup, signature)).toBe('expired');
-    onlyTheSimulatedCoordinator(fake);
+    onlyTheSimulatedCoordinator(fake, solscan);
   } finally {
     await ctx.close();
     rmSync(profile, {recursive: true, force: true});
```

- [ ] **Step 2: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 78 files, 915 tests (unchanged).

- [ ] **Step 3: Run the contained E2E, including the visual pass.**

Run: `npm run build && npx playwright test e2e/unlock.spec.ts e2e/wallet.spec.ts e2e/visual.spec.ts`
Expected: `4 passed`; `test-results/visual/` holds `09-locked.png`, `11-loaded.png`, `11-hidden-balance.png`, `13-plain-address.png`, `13-pay-request.png`, `26-loaded-mixed.png`, `26-filter-sent.png`, `27-transparent-send.png`, `27-received.png`, `27-failed.png`, `27-purchase.png`, `31-settings-minimal.png`, `38-about.png`, `41-empty.png`, `42-just-disconnected.png`, `42-sustained.png`, `42-reconnecting.png`, `42-refused-d26.png`, `43-account-switcher.png`.

- [ ] **Step 4: The visual review (spec §8.6).** Open each screenshot beside the same state of the design (`/home/user/Downloads/index.html`: `#s09` locked-derived, `#s11`, `#s13`, `#s26`, `#s27`, `#s31` (Settings rows only), `#s38`, `#s41`, `#s42`, `#s43` for the sheet chrome) — the A mockups, 412 × 916 phone frames, not a pixel diff. For every state check, and record findings in the PR:
  1. colours are the tokens the DS class map names (accent, danger/warning/success, surfaces);
  2. each text element's type tier (`.noc-h1`, `.noc-body-sm`, `.noc-mono`, `.noc-numeral`) matches the class map;
  3. element order and grouping match the mockup;
  4. every string matches the design or is an adapted string listed in the spec;
  5. every element is present, or appears in that screen's "Differs" list (spec §5–§6);
  6. controls are ≥ 48 px, there is no horizontal scroll at 412 px, and the sticky bar never covers content that cannot scroll clear;
  7. dark theme only (the design is dark).
  Known item to decide in this review (review L7): the design writes fees with thin grouping ("0.000 005 SOL"); `showSol` prints "0.000005". Either keep it and record it as a listed difference, or change `showSol` with a test.
  A finding that is a real defect is fixed in this task (with a test when it is behaviour); a difference the spec already lists is not a finding. The screenshots are CI artifacts, never committed.

- [ ] **Step 5: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **Solscan left resolvable:** in `launch.ts`, drop `, MAP solscan.io ~NOTFOUND, MAP *.solscan.io ~NOTFOUND` from `HOST_RESOLVER_RULES` (keep `expectContained`'s expectation). Run `npm run build && npx playwright test e2e/unlock.spec.ts` → RED: the spec fails at `expectContained` (`toContainText` on `chrome://version`).

- [ ] **Step 6: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/e2e/fakeCoordinator.ts extension/e2e/launch.ts extension/e2e/popupHarness.ts extension/e2e/unlock.spec.ts extension/e2e/visual.spec.ts extension/e2e/wallet.spec.ts
git commit -m "test(extension): Solscan containment, the fake's 403/unreachable/history switches, the 412×600 visual pass (B1b-2a §8.5, §8.6)" -m "Co-Authored-By: <the executing model's own line>"
```

---

### Task 18: E2E specs 6–9: 403, offline, activity, switcher

**Files:**
- Create: `extension/e2e/popup.spec.ts`

**Interfaces:**
- Consumes: Task 17's harness, fake and containment.
- Produces:
  `e2e/popup.spec.ts`.

Spec §8.5, plan 1's four: "6. **403:** the fake answers one read with 403 → the D26 banner; no further coordinator hits during the test (`hits` unchanged after the banner)." "7. **Offline:** reads aborted → #42 `just-disconnected` with the cached balances from an earlier successful read; Send disabled and Receive opens #13 with the address (D36); reads restored → `reconnecting` → live." (plan 1 has no Send; the "unreachable" banner is asserted against `navigator.onLine` — inside an offline namespace navigator itself is offline.) "8. **Activity:** filters, a detail page, "Load more", the explorer link's `href`." "9. **Switcher:** rename, select, the dashboard follows." "Every spec asserts `fake.unexpected` is empty and `hits > 0`".

- [ ] **Step 1: Implement.**

Create `extension/e2e/popup.spec.ts`:

```ts
import {test, expect} from '@playwright/test';
import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet} from './popupHarness';
import {COUNTERPARTY, failedTx, otherTx, presalePurchase, receivedUsdc, sentSol, sig} from './historyFixtures';

// Spec B1b-2a §8.5, plan 1: specs 6–9, against the real popup and the contained fake coordinator.
const REFUSED = 'The server is not answering for now — try again in 10 minutes.';

test('6 · 403: the D26 banner, and no further coordinator request while it shows', async () => {
  const h = await launchPopup('noctura-e2e-403-');
  try {
    await seedUnlockedWallet(h.sw);
    h.fake.network = 'forbidden';
    const popup = await h.openPopup();
    await expect(popup.getByText(REFUSED)).toBeVisible();
    await expect(popup.getByRole('button', {name: 'Refresh'})).toBeDisabled();
    const seen = h.fake.hits.length;
    expect(seen).toBe(1); // the first read tripped the latch; everything after it was refused locally
    await popup.waitForTimeout(6_000); // past one 5 s wallet.state poll
    expect(h.fake.hits.length).toBe(seen);
    contained(h);
  } finally {
    await h.close();
  }
});

test('7 · offline: cached balances with #42, Receive still works (D36), then reconnecting → live', async () => {
  const h = await launchPopup('noctura-e2e-offline-');
  try {
    await seedUnlockedWallet(h.sw);
    const first = await h.openPopup();
    // 10 SOL × $150: an earlier good read fills the cache.
    await expect(first.getByText('$1,500', {exact: true})).toBeVisible();
    await first.close();

    // The server gives no answer. "Offline" is the browser's word only (review L3): with navigator
    // online the banner says the server could not be reached. (Inside an offline network namespace —
    // the plan's dry run — navigator itself is offline, and the banner rightly says so.)
    h.fake.network = 'unreachable';
    const quiet = await h.openPopup();
    const online = await quiet.evaluate(() => navigator.onLine);
    await expect(quiet.getByText(online ? 'Could not reach the Noctura server' : "You're offline", {exact: true})).toBeVisible();
    if (online) await expect(quiet.getByText("You're offline")).toHaveCount(0);
    await expect(quiet.getByText('10.0000 SOL · cached')).toBeVisible();
    await quiet.close();

    // The browser itself offline: the design's just-disconnected state.
    await h.ctx.setOffline(true);
    const offline = await h.openPopup();
    await expect(offline.getByText("You're offline")).toBeVisible();
    await expect(offline.getByText('Network just dropped · the Noctura server is unreachable')).toBeVisible();
    await expect(offline.getByText(/Total balance · cached|Stale ·/)).toBeVisible();
    await offline.getByRole('button', {name: 'Receive'}).click();
    await expect(offline.getByText('Public address')).toBeVisible();
    const groups = await offline.locator('.addr-groups span').allTextContents();
    expect(groups.join('')).toBe(MAIN.publicKey);
    await offline.getByRole('button', {name: 'Back'}).click();

    // Back online: the first good read shows "Connected · syncing", then the rows are live.
    h.fake.network = 'ok';
    await h.ctx.setOffline(false);
    await offline.getByRole('button', {name: 'Refresh'}).click();
    await expect(offline.getByText('Connected · syncing')).toBeVisible();
    await expect(offline.getByText('live').first()).toBeVisible();
    contained(h);
  } finally {
    await h.close();
  }
});

test('8 · activity: kinds, filters, a detail page, Load more, and the explorer link (never followed)', async () => {
  const h = await launchPopup('noctura-e2e-activity-');
  try {
    await seedUnlockedWallet(h.sw);
    const now = Math.floor(Date.now() / 1000);
    const list = [
      {signature: sig(1), tx: sentSol(MAIN.publicKey, SAVINGS.publicKey, 2_480_000_000, now - 60)},
      {signature: sig(2), tx: receivedUsdc(MAIN.publicKey, COUNTERPARTY, 250_000_000, now - 120)},
      {signature: sig(3), tx: presalePurchase(MAIN.publicKey, 1_000_000_000, now - 180)},
      {signature: sig(4), tx: otherTx(MAIN.publicKey, now - 240)},
      {signature: sig(5), tx: failedTx(MAIN.publicKey, now - 300)},
      ...Array.from({length: 7}, (_, i) => ({signature: sig(10 + i), tx: otherTx(MAIN.publicKey, now - 400 - i)})),
    ];
    h.fake.history.set(MAIN.publicKey, list);
    const popup = await h.openPopup();
    await popup.getByRole('button', {name: 'Activity'}).click();
    await expect(popup.getByText('Sent SOL')).toBeVisible({timeout: 30_000});
    await expect(popup.getByText('Received USDC')).toBeVisible();
    await expect(popup.getByText('Presale purchase')).toBeVisible();
    await expect(popup.getByText('Failed · transaction')).toBeVisible();
    await expect(popup.getByText(/^to Your account: Savings/)).toBeVisible();

    await popup.getByRole('tab', {name: 'Received'}).click();
    await expect(popup.getByText('Sent SOL')).toHaveCount(0);
    await popup.getByRole('tab', {name: 'All'}).click();

    await popup.getByRole('button', {name: 'Load more'}).click();
    await expect(popup.locator('button.tx-row')).toHaveCount(12, {timeout: 30_000});

    await popup.getByText('Sent SOL').click();
    await expect(popup.getByText('SENT', {exact: true})).toBeVisible();
    const link = popup.getByRole('link', {name: 'Explorer'});
    await expect(link).toHaveAttribute('href', `https://solscan.io/tx/${sig(1)}`);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    contained(h);
  } finally {
    await h.close();
  }
});

test('9 · switcher: rename, select — the dashboard follows', async () => {
  const h = await launchPopup('noctura-e2e-switcher-');
  try {
    await seedUnlockedWallet(h.sw);
    h.fake.lamports.set(SAVINGS.publicKey, 2_500_000_000);
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL')).toBeVisible();
    await popup.getByRole('button', {name: 'Accounts'}).click();
    const sheet = popup.getByRole('dialog', {name: 'Accounts'});
    await expect(sheet.getByText('2.5000 SOL · $375.00')).toBeVisible();
    await sheet.getByRole('button', {name: 'Rename Savings'}).click();
    await sheet.getByRole('textbox', {name: 'Account name'}).fill('Rainy day');
    await sheet.getByRole('button', {name: 'Save'}).click();
    await expect(sheet.getByText('Rainy day')).toBeVisible();
    await sheet.getByText('Rainy day').click();
    await expect(popup.getByRole('dialog')).toHaveCount(0);
    await expect(popup.getByRole('button', {name: 'Accounts'})).toContainText('Rainy day');
    await expect(popup.getByText('2.5000 SOL', {exact: true})).toBeVisible();
    contained(h);
  } finally {
    await h.close();
  }
});
```

- [ ] **Step 2: The whole suite.**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; 78 files, 915 tests (unchanged).

- [ ] **Step 3: Run every E2E spec.**

Run: `npm run build && npx playwright test`
Expected: `8 passed` (popup 6–9, unlock, visual, wallet ×2).

- [ ] **Step 4: Mutations — in a scratch copy outside the repository.** Each edit alone must turn its test red; discard the copy after.

  - **refresh during the cool-down:** in `Home.tsx`, replace `disabled={refused || m.refreshing}` with `disabled={m.refreshing}` (rebuild). Run `npm run build && npx playwright test e2e/popup.spec.ts -g 403` → RED: spec 6 fails at `toBeDisabled`.

- [ ] **Step 5: Reproduce CI before pushing** (standing rule): only `web/` and `extension/` installed, Node 22.12, npm 11.6.2. In a scratch copy of the branch outside the repository (no root `node_modules`):

```bash
export PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"
node --version   # v22.12.0
npm --version    # 11.6.2
(cd extension && rm -rf node_modules && npm ci --ignore-scripts && npm run verify && npx playwright test && npm audit --audit-level=high)
(cd web && rm -rf node_modules && npm ci && npm run verify)
```
Expected: extension verify as Task 16 Step 6; `8 passed`; audit exits 0 (4 moderate advisories, all in `@solana/web3.js`'s tree, as before this plan); web: `Tests  501 passed` + the bundle test, `CSP ok`, scan and reproducible pass. Then, with the root install, `npx tsc --noEmit && npx jest` from the root as Task 1's step. The dry run did exactly this; if an offline namespace is available, run the Playwright step inside it (`unshare -rn npx playwright test`) — nothing can then leave the machine even if a route were missed.

- [ ] **Step 6: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/e2e/popup.spec.ts
git commit -m "test(extension): E2E — 403, offline, activity, switcher at 412×600 (B1b-2a §8.5 specs 6–9)" -m "Co-Authored-By: <the executing model's own line>"
```

---

## Dry-run findings

What building and replaying this plan caught, each fixed in the code above:

1. **The first H1 test was blind to the mutation it exists for.** "A pending write injected between the lock and the clear" landed **before** the pending check in both the atomic and the check-then-remove versions, so replacing the atomic `updatePending` with `readPending` + `remove` stayed green (only an unrelated storage test went red). The test now lets `submitSigned`'s append start **during** step 4's read and gives it 50 ms to land: atomic, it waits for the clear and survives; check-then-remove deletes it. Mutation re-run: red on the right test.
2. **Vite rewrites the fonts' absolute path.** With `base: './'`, `/fonts/Geist-Variable.woff2` becomes `../fonts/Geist-Variable.woff2` in `assets/*.css` — the spec's §1.2 L5 says it "stays `/fonts/…`". The font gate checks where every font URL resolves instead (Scope item 12).
3. **The E2E cannot import `@solana/web3.js`** under Playwright's loader ("module is not linked", from `rpc-websockets`); the fake parses v0 transactions by hand. (A first version of that parser lost one byte to `at += 64 * vec()` — `at` read before `vec()` advanced it; caught by the wallet E2E.)
4. **A long activity list squeezed the filter chips to zero height** (the design's `.s-act .scroll { flex: 1 }` inside a scrolling region): Playwright could not click "Received". `app.css` stops screen children from shrinking.
5. **Inside an offline network namespace `navigator.onLine` is false**, so the popup correctly says "You're offline" where CI (online) will say "Could not reach the Noctura server". Spec 7 asserts the banner **relative to `navigator.onLine`** — the rule under test (L3) — not a fixed string.
6. **Four tests were blind to their mutation** and were strengthened: `LockedButton`'s same-frame guard (React disables the button between two `fireEvent` clicks, so the ref was untested — now two clicks inside one `act`); the TGE gate's timestamp form (the test read "the last form", whatever it was — now it asserts the three shapes); the explorer's 64-byte check (the test used a 44-character address, which the regex already refuses — now a 48-byte value in the signature's length range); the valuation (including NOC through `valueHoldings` with a zero stage price is equivalent — the mutation is now "add NOC to the total").
7. **A default-parameter clock re-created on every render re-ran every effect** (`now = () => Date.now()` in `WalletProvider` and `useNow`): an open sequence on every render. Stable module-level `systemNow`.
8. **The first refresh ran before the render that derives `account`** — the popup showed the skeleton until the 5 s poll. The account ref is set before the read.
9. **The vault-page allowlist walk matched prose** (`mode === 'import' || m === 'accounts'` looks like `import '…'` to the loose reference patterns): only strings shaped like module specifiers are followed.
10. **The design's `.s8-sheet .row` grid (32 px / 1fr / auto) swallowed the switcher rows** (seen in the visual pass): the switcher uses its own row class; #43's sheet keeps the design's.
11. **E2's reader alone left `tsc` red** until prepare changed (Scope item 2) — merged into one task.
12. **Vitest 5 has no `environmentMatchGlobs`** (Scope item 13).
13. **Existing tests that must change with the engine:** `messages.test.ts`'s exhaustive privileged-type list (Tasks 2, 4, 5, 7), `start.test.ts`'s listener stubs and lists (Task 8), `reauthChallenges.test.ts`'s `issueChallenge` calls (Task 4), the prepare tests' simulation stubs (Task 3), `knownRecipients.test.ts` (Task 5), the bundle-gate fixtures and the HTML-entry tests (Task 16), and `wallet.spec.ts` in four places (Tasks 3, 5, 16, 17). Each change is in its task's diff.

Not done in the dry run: the E2E against a browser that is **online** (every Playwright run was inside `unshare -rn`, so CI's first run is the first online one — the "Could not reach the Noctura server" branch of spec 7 is covered by the unit test in Task 12); a second browser (Firefox) run; the visual review itself (Task 17 Step 5 is a person's or a review agent's comparison — the dry run only looked at a contact sheet of eight screenshots, which is how finding 10 was seen).

## Review round 1 (2026-09-30) — where each item landed

| item | change | task | new test / mutation |
|---|---|---|---|
| H1 | `vault.setKeys` refuses keys the stored envelope does not record (`unknown-account`); every vault-page flow stores first (shown in Task 7) | 7 | `setKeysBinding.test.ts`; drop the comparison → 3 red |
| H2 | TGE gate: case-insensitive; slash-ISO, unpadded US, comma-less, full month, ordinals, milliseconds — all assembled from parts | 9 | one test per added form; drop slash-ISO / ms / lowercasing → red |
| M1 | the poller adds a known recipient only for an account of the stored envelope | 7 | delete with a late open record, then confirm → no recipient; `own.size >= 0` → red |
| M2 | the vault write is the commit point; cleanup failures are logged, still `forgotten` | 7 | throw on `remove(v1_settings)`; `finally` instead of `catch` → red |
| M3 | Settings "Lock now" is a `LockedButton` + the two §7.6 tests | 16 | no floor → red |
| M4 | `report(error)` on the model; Activity, #27 and the switcher report 403 / no answer | 12, 13, 15 | 403 on Activity → Home's refresh disabled, no further request; drop `report` → red |
| M5 | the switcher's fresh pass skipped while away, stopped at the first miss | 13 | two tests; each guard removed → red |
| M6 | `unlock.spec.ts` counts Solscan requests too | 17 | — |
| L1 | a first write also clears both caches | 7 | extended test; removed → red |
| L2 | `prepareSend` refuses `self-send` (ruling) | 3 | test; removed → red |
| L3 | a failed row with no token shows "—" | 15 | test; reverted → red |
| L4 | `unlocked` distinct from `busy` (ruling); `guard` + `replacement` = `malformed` stated | 7 | test; `busy` → red |
| L5 | why the one retry is safe for `wallet.send`, in `engine.ts` | 10 | — |
| L6 | "≈ N SOL" truncates | 12 | exact "≈ 67.41 SOL"; `toFixed` → red |
| L7 | fee thin grouping ("0.000 005") listed for the visual review | 17 | — |
| L8 | the switcher uses the model's clock | 13 | "cached 2 h ago" from an injected clock; wall clock → red |
| L9 | two welcome tabs possible — documented, accepted | Scope 17 | — |
| L10 | StrictMode's double effects noted as dev-only | 16 | — |

Re-run after the round: the replay from Task 3 on (every task red → green, `tsc` clean, whole suite green; 915 tests at the end); every new mutation red (the first M3 test was blind to "no 500 ms floor" and was strengthened to click again after the lock settled but inside the floor); the plan document re-applied to a fresh base and compared equal to the replay; under Node 22.12 with only `web/` and `extension/`: `npm ci --ignore-scripts`, `npm run verify` (915 tests, all gates), all 8 Playwright specs inside `unshare -rn`, `npm audit --audit-level=high` exit 0. `core/` and `web/` did not change in this round, so the root jest and web's verify results stand.

## Contradictions and gaps found in the spec (for the controller)

1. **Failed history rows (§6.2, §6.3) cannot say what failed.** (Ruling: keep plan 1's stand-in; plan 3 asks the owner.) `core/solana/history.ts` returns `kind: 'other'`, `token: null` for every failed transaction, so "Failed · sent SOL", "FAILED · SENT" and #27's `[Try again]` "with the same intent (sent kind only)" are not buildable from `HistoryView`. Plan 1 shows "Failed · transaction" / "FAILED" (Scope item 10). Plan 3's `[Try again]` on #27 needs either a decoder change (report the attempted kind and token of a failed transfer) or dropping that button for history rows — an owner decision.
2. **§1.2 L5 (fonts) states a built path Vite does not produce** (dry-run finding 2). Harmless — both paths reach `dist/app/fonts/` — but the build test as the spec words it ("the built `unlock` CSS names `/fonts/Geist-Variable.woff2`") would fail. Plan 2 should adopt the resolved-path rule.
3. **§8.4 names `environmentMatchGlobs`, which Vitest 5 removed.**
4. **§12 vs the brief on #43.** §12 puts #43 in plan 3; the brief puts "#43 token list sheet" in plan 1. Built here, not opened (Scope item 7).
5. **§4.1's "Forgot password?" points at `?mode=forgot`, which does not exist until plan 2.** Ruled: plan 2 (Scope item 8).
6. **#42 has no sustained copy for "unreachable while online"** — ruled: the plan's copy is accepted (Scope item 11).
7. **E3's `about` refresh** names only the fee fields; `reasons` and `thresholdCents` are recomputed by the same re-prepare and are refreshed too (Scope item 5) — otherwise #10 could show a reason the engine no longer applies.
8. **The tab surface's no-wallet behaviour is unspecified** (Scope item 9).

## Self-review

**Spec coverage (plan 1's share, §12):**

| spec item | task |
|---|---|
| E2 precondition recorded, first task | 1 (Step 0) |
| E1 `wallet.prices` (independent reads, 403 never swallowed, > 0 else null, cache on success, partition) | 2 |
| E2 reader (`accounts`, `slot`, H2 rule, §11.5 rules), `getAccountKind`, L4 single read, `simulation-mismatch`, token parse, programs, recipient kind, `preparedFor` carries it | 3 |
| E3 `about` (shape-checked, refreshed on reuse), `issuedAt`, D39 re-base, C5 cap, `vault.challengeInfo` (vault page only, partition) | 4 |
| E4 caches (write on success, trim, locked refusal, shape), `unreachable` (timeout, rejection, 403 unchanged, three clients unwrapped), owned keys | 1, 2 |
| E5 (one `serial` section, H1, R2-M1, C4, C6, D40, first-write cleanup, `v1_forbidden_until` kept, partition) | 7 |
| E6 `wallet.recipientInfo` (shared `isKnownRecipient`, parity test, `{address, at}`, old format) | 5 |
| E7 `wallet.discardPrepared` (challenges bound to the dropped intents only, idempotent, partition) | 5 |
| E8 `failure` (four writers, `detail` unchanged, old records) | 6 |
| `runtime.onInstalled` (install only) + minimal `welcome` | 8 |
| Gates: vault allowlist, stand-alone modules (M4), React marker + INCONCLUSIVE, ENTRIES with `wallet.html`, `.tsx` + `../web/src/ui` may not fetch, owned keys, fonts (L5), TGE date | 2, 9, 16 |
| React 18.3 + test stack, `sharedResolvesFromHere`, fonts, design classes, message client with shape checks and retry | 10 |
| Components (§1.3) incl. rule-6 `LockedButton`, `Sheet`, `QrCode` (S6) | 11 |
| `WalletContext`, open sequence, polling, `activity.ping`, #11, #42 (all four states), D26 | 12 |
| Account switcher (D14), #43's sheet (D18) | 13 |
| #13 (D19, D36, no auto-clear) | 14 |
| #26 (D24), #41 (D25), #27, §6.5 link + source test | 15 |
| `wallet.html`/`tab.tsx` with `#/home`, `popup.tsx`, router, locked screen (§4.1), Settings (§6.1), #38 | 16 |
| Solscan containment (M5), fake growth, visual pass (§8.6) | 17 |
| E2E specs 6–9 | 18 |

Not in plan 1, by §12: E2E specs 1–5 and 10–12, the vault-page screens and the two E5 proofs (plan 2), the send flow (plan 3).

**Placeholders:** none — every step has its code, command and expected output; the one generated file (`design-ext.css`) has its generator and its hash.

**Type consistency:** the names each task produces are the ones later tasks consume (checked by the replay: each task compiled and passed on the previous task's tree): `RequestUnreachable`, `writeCachedBalances(ext, envelope, …)`, `SimulationView`, `ChallengeAbout` / `issueChallenge(…, about)`, `isKnownRecipient`, `addKnownRecipient(…, at)`, `dropChallengesFor`, `PendingFailure`, `forgetWallet`, `Engine`, `WalletModel`, `Tab`, `Surface`.
