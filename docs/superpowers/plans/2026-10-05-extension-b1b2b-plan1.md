# Noctura Extension B1b-2b · Plan 1 — settings & security (E9–E16, the vault modes, #31, #35, the accounts manager, the passkey screen, #37) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 2 (2026-10-05):** Fable 5.1 review 1 applied — H1, M1–M4, L1–L9; where each landed is in "Review 1" at the end.

**Goal:** Build spec §12's plan 1 of B1b-2b ("security"): the engine extensions E9–E16 with their refusals and partition tests; the vault-page modes `password` (#36), `delete` (#37's proof, C17), `passkey&op=add|remove`, `reveal`, `verify`, `accounts&op=add|remove` and #10's settings states; the popup screens #31 (full), #35, the accounts manager, the passkey screen and #37; E2E specs 14–18 (the PRF probe first); the visual pass of every state.

**Architecture:** The background (`src/background/`) stays the only writer of `storage.local`: three new `v1_settings` fields (one rule: every write rebuilds all six by name, under `settingsMutex`), three new vault-page-only messages (`vault.changePassword`, `vault.removePasskey`, `vault.phraseVerified`), E9's branch in `vault.reauthOk` that applies a weakened setting itself, and the store refusals C3 (a stored passkey cannot be dropped by a store) and C5 (an account with an open send cannot be dropped). The vault page (`unlock.html`, DOM only, no React, under the vault-isolation gate) gains four screens and rewrites two; every secret it opens stays in that page and is zeroed or dropped on every path. The popup (React 18, `src/app/`) reads booleans and settings — never a key — and opens vault-page URLs it can only build from a closed list (`ExtensionPage`, `removeAccountPage(index)`).

**Tech Stack:** TypeScript 5 strict, React 18, Vite, Vitest + happy-dom + Testing Library, Playwright (contained: `ctx.route` + `--host-resolver-rules`; CDP virtual authenticator with PRF), Argon2id (WASM worker) + AES-KW + AES-GCM (WebCrypto) for the envelope, WebAuthn PRF for the passkey wrap.

**Spec:** `docs/superpowers/specs/2026-10-05-extension-b1b2b-settings-security-design.md` (rev 3, approved by the owner 2026-10-05 with C1–C20 and O01–O88; O89–O91 added by the owner the same day after this plan's review) — §1 (pages, routes, partition, CSS), §2 E9–E16, §3.1–§3.7, §4.1–§4.4, §5, §7, §8.1–§8.4, §11; parents `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md` and `docs/superpowers/specs/2026-09-27-extension-b1-design.md` (rev 5). Design (binding): `/home/user/Downloads/index.html` + `screen.md` — #31, #35, #36, #37, #6, #3, #4, #10.

## Global Constraints

Every task's requirements include these.

- Mutations only in a scratch copy outside the repo.
- Every task touching repo-root src/ runs the FULL root jest; core/ tests run under extension's and web's vitest.
- Before pushing, reproduce CI with ONLY web/ and extension/ installed on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`), npm 11.6.2.
- e2e makes no value/type imports from core/.
- E2E containment: ctx.route + --host-resolver-rules for every noc-tura.io name AND solscan.io, counters asserted empty; containment positive-control spec and zero-CSP-violation spec stay.
- Tests never contact *.noc-tura.io or solscan.io.
- Commit trailers name the executing model truthfully.
- The TGE date is never written anywhere (repo gate).
- extension/ has no eslint gate; never add eslint-disable.

And, from the brief's binding lessons and CLAUDE.md:

- **Mutations:** `git archive HEAD | tar -x -C "$(mktemp -d <scratch>/mut.XXXXXX)"`, `node_modules` linked FROM the copy (`ln -s <repo>/extension/node_modules <copy>/extension/node_modules`, the same for `web/` and the root), every run under `timeout 300`. Never `git worktree`, never the repository's own files, never `pkill` with a pattern that can match your own shell.
- **Rule 6:** every send/sign/confirm/delete button is a `LockedButton` (popup) or runs through the vault page's `exclusive()` busy gate (≥ 500 ms, never before the action settles). Tests lift `disabled` before the second click (happy-dom drops clicks on disabled buttons).
- **Every async path checks its generation / `alive` / held-proof identity after each await** (pagehide, leave, unmount, lock, a newer read), with a test for each.
- **`extension/src/styles/design-ext.css` is generated only** (Task 8 regenerates it with the extraction script and pins the hash); `src/app/app.css` and `src/unlock/unlock.css` are hand-written.
- **No regex-only security gates.** The source backstops here (who names `deleteWallet`'s message, the vault-isolation gate) sit beside behavioural tests and mutations.
- **E2E is deterministic in a normal launch AND under `unshare -rn`.** The popup starts offline under `unshare`: a spec that needs #11's numbers waits for them before it navigates.
- **Visual pass:** every state asserts its own copy before its shot (and, in the popup, `toBeInViewport` clear of the pinned bars); transient states are held by the test (the KDF hold) or under the page's paused clock; never fast-forward a popup clock past an expiry the background stamped.
- CLAUDE.md: the design is binding — every scope-down is stated (Scope 3); TypeScript strict, no `any`, no `@ts-ignore`; no placeholders; BigInt base units; UTC in data. Prettier style of the surrounding code: single quotes, trailing commas, no spaces inside braces, no parens around a single arrow parameter.

## Scope — what plan 1 builds, what plan 2 adds, every departure, and where each secret lives

### 1. Plan 1 builds

- **Engine (Tasks 1–6):** E14 display order (`accounts.order`) and the three `v1_settings` fields (C7, C8, C10); E9 settings applied in `vault.reauthOk` (C1); E10 change password (`rewrapPassword`, `onlyPasswordChanged`, `vault.changePassword`, `passwordFlow.ts`, C2, C20); E12 passkey state + `vault.removePasskey` + C3; E13 re-add at a chosen index + C5 `send-open`; E15 `vault.phraseVerified` (+ the create path, C8); E11 `deleteWallet` over a factor proof; E16 reveal password-only (D23).
- **UI client (Task 7):** `engine.settingsSet`, `engine.order`, `WalletState.passkey`, `ExtensionPage` + `removeAccountPage` (C14), four bare routes, `PASSWORD_TOAST_KEY`.
- **Vault-page modes (Tasks 8–12, plus Task 2 for #10):** `password` (#36), `delete`, `passkey&op=add|remove`, `reveal`, `verify`, `accounts&op=add|remove`, #10's settings outcomes.
- **Popup screens (Tasks 13–17):** the passkey screen, the accounts manager, #37, #35, #31 (with 36e).
- **E2E (Tasks 18–19):** the PRF probe (the first E2E task), specs 14, 15 (×4), 16, 17, 18 (×2); the CSP spec over every new mode. **Visual pass (Task 20).**

### 2. Plan 2 (not in this plan) — and how it extends plan 1 without undoing it

Plan 2 = the address book: E17 (`v1_contacts`, `contacts.*`), #15, the contact sheet, the hooks in #12/#20/#27 and the label (O67–O88), C12, C18, C19 (`FORBIDDEN_IN_NAME` widened), E2E spec 19. Plan 1 leaves these seams, each a one-place change:

- **The delete wipe list.** `vault.forgetWallet`'s step 7 (`src/background/accountsStore.ts`, the `if (next === null)` block that removes `KNOWN_RECIPIENTS_KEY` and `SETTINGS_KEY`) and `storeEnvelope`'s first-write cleanup (the `if (first)` block) are the two places a wallet's data is wiped. Plan 1 does **not** name `v1_contacts` (the key does not exist yet; naming it would be dead code the gate cannot check). Plan 2 adds `await ext.local.remove(CONTACTS_KEY)` to the `if (next === null)` block only — a restore (`next !== null`) keeps contacts (D20) — and to the `if (first)` block; adds `'v1_contacts'` to `BACKGROUND_OWNED_KEYS` in `scripts/check-vault-isolation.mjs` with its fixture; and adds `'v1_contacts'` to the key list E2E spec 15 asserts is gone after a delete (Task 19's `for (const key of ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_balance_cache', 'v1_price_cache'])`) and to the background's forget tests.
- **#37's 37a "erased" bullet** (`DELETE_TEXT.bulletErased`, Task 15) is the spec's plan-1 wording; plan 2 switches it to §5's plan-2 wording ("Local settings, cached balances, your address book and the list of addresses you have sent to are **erased** and not recoverable.") in the same task that adds the wipe.
- **`settingsMutex` / `updateSettings`** (Task 1) is where plan 2's `contacts.*` must NOT go (contacts are their own key with their own mutex) — stated so nobody reuses it.
- **Account names (C19):** plan 1 keeps 2a's `cleanName`; plan 2 widens `FORBIDDEN_IN_NAME` for contacts and account names together.
- **The design-ext hash pin (review L6).** `src/__tests__/designExt2b.test.ts` (Task 8) pins `design-ext.css`'s SHA-256 (`541733…`). Plan 2's extraction (`.s-abook` and the contact sheet) changes the file, so plan 2 re-runs the script with its prefixes added and **re-pins the hash in the same task** — a red pin there is expected, not drift.

### 3. Departures (each loud; each is in the spec's Differs or §11 unless marked NEW)

1. **"1 outstanding task." (singular) on #35's card — owner-confirmed O89.** The spec had "N outstanding tasks." (adapted from ix:14411) and the singular only for #31's meta (O43 "1 to do"); the plan uses the singular because "1 outstanding tasks." is wrong English. The owner confirmed it on 2026-10-05 (spec §12, O89).
2. **NEW — 36e's toast is `position: fixed`,** not the design's absolute: in the popup the screen grows inside the scrolling region, so an absolute toast sat at the foot of the whole list, out of view (found by the dry run's visual pass). Same place on screen as the design (80 px + `--space-4` above the bottom, centred).
3. **NEW — `.s7-pw`** is added to the design-ext extraction (§1.6's list does not name it): #37's DELETE field uses the design's `.s7-pw` wrapper.
4. **#10's kind-neutral expired line (§11 item 4)** is unchanged: a settings challenge already gone when the tab loads shows 2a's send-worded `expired` line; the approved O40 pair shows when the proof outlived the challenge.
5. **States reachable only with fault injection** — setting failed (O51), #36 `failed` (O07), delete `failed` (O16), passkey `failed` (O26) — are asserted in component tests, not shot (the real extension cannot be put in them without breaking it).
6. **`PageMode`'s remove index is `number | null`**, not `number`: a malformed `index=` parses to `null` and the page says "There is no account with that number." — never coerced to 0.
7. **#3's copy/select guards** (copy, cut, dragstart, selectstart, contextmenu refused on the grid while words are in the DOM) apply to onboarding #3 too — a hardening of 2a's screen, stated.
8. **Verify's Back closes the tab** (there is no screen behind a verify that started in this tab) — see 15 for its notice.
9. **The cancel modal for #36 is its own section** (`v-cp-cancel`) using #3's modal chrome (the design draws it over #36; the vault page shows one section at a time).
10. **The passkey page's cooldown omits the "Wait a moment" h1** (the page's title stays; the ring and the line show the wait).
11. **The Switcher's balance loading moves into `useAccountBalances`** (shared with the manager and #37) — a refactor of 2a code, behaviour unchanged (the Switcher's tests stay green unchanged except a stub).
12. **`LockedButton` gains `keepFocus` and `pressed`** (the manager's reorder keeps focus on the moved row; the pickers' aria-pressed).
13. **The 'added'/'removed' passkey outcomes are not backoff PROVEN outcomes** (an existing negative control asserts 'added' leaves the streak) — unlike `applied`/`refused` (Task 2), which are.
14. **NEW — the vault-isolation gate's passkey markers change** (Task 13, a security gate — flagged for the controller; rev 2 per review H1). The gate proved that passkey code stays out of the popup by looking for the RP ID string `wallet.noc-tura.io` in built JS. The approved copy of the passkey screen's tip (2a's #6 line, reused by §4.4: "…Other extensions allowed on wallet.noc-tura.io can ask for it too.") puts that host into the popup bundle as prose, so the gate failed on copy, not code (found by the dry run's per-task replay: `npm run gates` red from Task 13). Two markers replace it, each counted for presence (INCONCLUSIVE if no built JS carries it) and for leaks: **`passkey`** = the WebAuthn PRF evaluation as Vite emits it, `extensions:{prf:{eval:{first:` (only `src/vault/passkey.ts`), and **`webauthn`** = `navigator.credentials` (only `src/unlock/browser.ts` spells it; checked against the real build: in the unlock bundle, in no other built file). Together they catch any WebAuthn use outside the vault page — PRF or not, as the RP ID did — and prose cannot match either. Gate tests: the RP ID in popup prose passes; a non-PRF `navigator.credentials.get(…)` in a popup chunk fails (webauthn); the PRF marker alone fails (passkey); the manifest-only fixture is retargeted to the webauthn marker (review L1). Mutations M13b (the RP ID as the marker again) and M13c (the webauthn marker removed) are red. The copy is not changed (it is the owner's).
15. **O29 is reused for verify's Back** (review L2): `mountPhrase`'s cancel is #4's Back in verify mode too, so a verify that never showed anything says "Nothing is shown. You can close this tab." (O29) — true, but O29's listed use is "reveal cancel". Declared for the owner.
16. **#36 `failed` offers `[Start again]`** (review L3): spec §3.1 lists O07 alone; the plan shows O07 with 2a's `[Start again]` (back to step 1), as every other #36 notice that ends the flow does.

### Owner-confirmed copy added by the plan (O89–O91, owner, 2026-10-05, plan-1 review)

The plan needed three strings the approved O-list did not have (review L8 found the two AT labels). The owner confirmed all three on 2026-10-05; they are in the spec's §12 table as O89–O91.

- **O89 "1 outstanding task."** — #35's card, the singular of "N outstanding tasks." (Task 16, `SECURITY_TEXT.outstanding`; Scope 3.1).
- **O90 `aria-label="Close"`** — the vault page's ✕ on #36 (`cp-x`) and on the reveal/verify proof (`pp-x`) (Tasks 8, 11). The popup's `Sheet` already uses "Close"; the vault page did not.
- **O91 `aria-label="Updating your password"`** — #36's `<progress>` (Task 8): O04 without its ellipsis.

### 4. Key and secret handling — where the seed, the data key and the PRF output live in each new flow (none reaches the popup)

The popup receives, over `wallet.state` and `settings.get`, only: account indexes, names, public keys, the scheme, `passkey: boolean`, the selection, and the six settings fields (numbers or null). No message the popup may send (`messages.ts`' popup partition) returns a key, a wrap, a salt, a PRF output, a phrase or a revision. Every new secret-touching message is in `VAULT_PAGE_ONLY` (Tasks 3, 4, 6 — each with a partition test that a popup-origin sender gets `forbidden`).

| Flow (task) | What is opened | Where it lives | When it is dropped |
|---|---|---|---|
| #36 change password (3, 8) | the data key (unwrapped by the current password); the phrase that `openProven` also returns is **not kept** | the vault page's `HeldProof` (a frozen object in the #36 closure) | zeroed by `changePassword` on every path; by the screen on `pagehide`, ✕/cancel, leave, success, and at 5 min (C20: a timer + a deadline re-check after every await) |
| #36 "same password" check (3, 8) | one KEK + the unwrapped key from the candidate | `isCurrentPassword` locals | zeroed before it returns (`unlockWithPassword` zeroes its KEK; the key is filled with 0) |
| settings applied (2) | nothing | — | the background applies the patch it stored at issue; the page only proves |
| passkey add / replace (10) | the data key (password only, C4) and the new credential's PRF output | 2a's `addPasskey` in the vault page | both zeroed in `addPasskey`'s `finally` |
| passkey remove (4, 10) | the factor's KEK / PRF output, to prove only | `removePasskey` → `openProven` locals | PRF output zeroed on every path; the message carries only `expectedRevision` |
| delete (6, 9) | the factor's KEK / PRF output, to prove only (no session needed) | `proveFactor` locals; the proof object holds only `{kind: 'factor', revision}` | zeroed in `proveFactor`; the message carries only `expectedRevision` |
| reveal (6, 11) | the phrase (password only, D23) | the #3 grid's DOM text and the seed screen's `words` | removed from the DOM on blur/release/leave/20 s (2a's `REVEAL_MS`) ("Still looking?" has no word in the DOM — E2E spec 16 asserts it); `drop()` after the check |
| verify (6, 11) | the phrase, to pick three words | the confirm screen's closure | dropped when the check passes or the page is left; `vault.phraseVerified` carries no data |
| accounts add / remove (5, 12) | the data key and the phrase (`openProven`, password or passkey) | 2a's `accountsFlow` in the vault page; the derived account keys go only to the background session (`vault.setKeys` → `storage.session`, memory-only, 2a) | the data key zeroed in `finally`; the PRF output zeroed on every path (a `bad-index` before any proof); the store carries public keys only |

## How to read the steps

- A **new file** is given in full. A **changed file** is a unified diff against the file as the previous task left it; save the block and apply it with `git apply --recount` from the repository root (or by hand — every hunk is exact). `strings.ts`, `unlock.html`, `app.css`, `App.tsx`, `messages.ts`, `walletApi.ts` and `accountsStore.ts` grow task by task, so their diffs apply in task order.
- Commands run from `extension/` unless they start with `cd`. "Whole suite" is `npx tsc --noEmit && npx vitest run`. The expected totals are the dry run's task-by-task replay: each task's own test files run on its predecessor's tree (red) and then on its own tree (green), with tsc, the whole suite and `npm run gates` at every task. A reviewer-added test raises the totals; that is not a defect.
- Component tests drive each popup screen against the REAL background (`renderInWallet` / `setupWallet` in `src/app/__tests__/harness.tsx`: `handleMessage` over the in-memory `fakeExt`). Vault-page screen tests mount the real `unlock.html` body under happy-dom (`src/unlock/__tests__/pageHarness.ts`) with fake timers and a fake KDF; each popup screen test asserts `unstyledClasses(…)` is empty.
- No task touches the repository root's `src/` or `core/`. The dry run ran the root `tsc` + `jest` and web's `npm run verify` anyway (Dry-run record).

## Tasks


### Task 1: Settings gains `accountOrder`, `phraseVerifiedAt`, `passwordChangedAt`; `updateSettings` under `settingsMutex`; `accounts.order` (E14)

**Spec:** §2 E14, D17, C7; §2 E15 (the field only), C10 (the field only)

**Files:**
- Create: `extension/src/background/__tests__/accountsOrder.test.ts`
- Modify: `extension/src/background/__tests__/messages.test.ts`
- Modify: `extension/src/background/__tests__/settings.test.ts`
- Modify: `extension/src/background/__tests__/walletApi.test.ts`
- Modify: `extension/src/background/settings.ts`
- Modify: `extension/src/background/walletApi.ts`

**Interfaces:**
- Consumes: `readSettings`, `writeSettings`, `parsePatch`, `weakens` (`src/background/settings.ts`); `readWalletView` (`walletApi.ts`); `createMutex` (`src/background/mutex.ts`); `MAX_ACCOUNTS` (`src/shared/envelopeRules.ts`).
- Produces (exact signatures, as exported):
  - `export const DEFAULT_SETTINGS: Settings = {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null};`
  - `export const settingsMutex = createMutex();`
  - `export function updateSettings(ext: Ext, change: (s: Settings) => Settings): Promise<Settings>`
  - `export function displayOrder<T extends {index: number}>(accounts: readonly T[], order: readonly number[] | null): T[]`

Every later task reads or writes one of three new `v1_settings` fields, so they land first, together with the one rule that keeps them: **every write rebuilds all six fields by name** (C7) — a field `writeSettings` does not name would be erased by the next write of any other. The read-modify-write helper moves from `walletApi.ts` into `settings.ts` as `updateSettings(ext, change)` under its own `settingsMutex` (order: `settingsMutex` → `sessionMutex`, never the reverse). `accounts.order` (E14, D17) is a no-proof write of a permutation of the stored envelope's index set: anything else is `malformed` (not an array, a non-index, a duplicate), a different set is `stale`, no wallet is `no-wallet`. `wallet.state` returns the accounts in display order; the selection falls back to the first display-order account still in the session.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/__tests__/accountsOrder.test.ts`:

````ts
import {handleWallet} from '../walletApi';
import {handleMessage} from '../messages';
import {SETTINGS_KEY, readSettings, updateSettings} from '../settings';
import {VAULT_KEY} from '../accountsStore';
import {setSession} from '../session';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from './fixtures';

// B1b-2b E14 (D17, C7): the display order lives in v1_settings, outside the envelope; every settings write keeps
// every field.
const THIRD = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const ENV = {
  v: 1,
  scheme: 'slip10',
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: RECIPIENT},
    {index: 2, name: 'Third', publicKey: THIRD},
  ],
};
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const web = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};
const popup = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};

async function wallet() {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, ENV);
  return ext;
}
const indexesOf = (r: {data?: unknown}) => (r.data as {accounts: {index: number}[]}).accounts.map(a => a.index);

describe('accounts.order and the display order (E14)', () => {
  it('a permutation of the stored indexes is kept, and wallet.state answers in that order', async () => {
    const ext = await wallet();
    expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order: [2, 0, 1]})).toEqual({ok: true});
    expect((await readSettings(ext)).accountOrder).toEqual([2, 0, 1]);
    expect(indexesOf(await handleWallet(ext, fakeDeps(), 'wallet.state', {}))).toEqual([2, 0, 1]);
  });

  it('refuses duplicates and non-indexes (malformed), another set (stale), and no wallet (no-wallet); nothing is written', async () => {
    const ext = await wallet();
    for (const order of [[0, 0, 1], [0, 1, -1], [0, 1, 1.5], 'x', null, [0, 1, '2']]) {
      expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order})).toEqual({ok: false, error: 'malformed'});
    }
    expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order: [0, 1]})).toEqual({ok: false, error: 'stale'});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order: [0, 1, 3]})).toEqual({ok: false, error: 'stale'});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order: [0, 1, 2, 3]})).toEqual({ok: false, error: 'stale'});
    expect(await ext.local.get(SETTINGS_KEY)).toBeUndefined();
    expect(await handleWallet(fakeExt(), fakeDeps(), 'accounts.order', {order: [0]})).toEqual({ok: false, error: 'no-wallet'});
  });

  it('allowed while locked (like accounts.select), and refused from a web page', async () => {
    const ext = await wallet();
    expect(await handleMessage(ext, {type: 'accounts.order', order: [1, 0, 2]}, popup, fakeDeps())).toEqual({ok: true});
    expect(await handleMessage(ext, {type: 'accounts.order', order: [0, 1, 2]}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    expect((await readSettings(ext)).accountOrder).toEqual([1, 0, 2]);
  });

  it('an order naming an index the envelope lost is read past it; an account it does not name comes after, in envelope order', async () => {
    const ext = await wallet();
    await ext.local.set(SETTINGS_KEY, {accountOrder: [2, 7]});
    expect(indexesOf(await handleWallet(ext, fakeDeps(), 'wallet.state', {}))).toEqual([2, 0, 1]);
  });

  it('a stored order that is not a list of unique indexes reads as no order (never repaired)', async () => {
    const ext = await wallet();
    for (const accountOrder of [[1, 1], [0, -1], 'x', [0.5], Array.from({length: 101}, (_, i) => i)]) {
      await ext.local.set(SETTINGS_KEY, {accountOrder});
      expect((await readSettings(ext)).accountOrder).toBeNull();
      expect(indexesOf(await handleWallet(ext, fakeDeps(), 'wallet.state', {}))).toEqual([0, 1, 2]);
    }
  });

  it('the selection falls back to the first account of the display order the session holds', async () => {
    const ext = await wallet();
    await ext.local.set(SETTINGS_KEY, {selectedAccount: 9, accountOrder: [2, 1, 0]});
    // Locked: the first of the display order.
    expect((await handleWallet(ext, fakeDeps(), 'wallet.state', {})).data).toMatchObject({selected: 2});
    // Unlocked with accounts 0 and 1 only: the first of the display order the session holds.
    await setSession(ext, [ACCOUNT, {index: 1, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey}]);
    expect((await handleWallet(ext, fakeDeps(), 'wallet.state', {})).data).toMatchObject({selected: 1});
  });

  it('C7: accounts.select and settings.set keep accountOrder, phraseVerifiedAt and passwordChangedAt', async () => {
    const ext = await wallet();
    await unlocked(ext);
    await updateSettings(ext, s => ({...s, accountOrder: [2, 1, 0], phraseVerifiedAt: 111, passwordChangedAt: 222}));
    expect(await handleWallet(ext, fakeDeps(), 'accounts.select', {index: 1})).toEqual({ok: true});
    expect(await handleWallet(ext, fakeDeps(), 'settings.set', {patch: {autoLockMinutes: 2}})).toMatchObject({ok: true});
    expect(await readSettings(ext)).toEqual({autoLockMinutes: 2, reauthUsdCents: 10_000, selectedAccount: 1, accountOrder: [2, 1, 0], phraseVerifiedAt: 111, passwordChangedAt: 222});
  });

  it('updateSettings writes one change at a time: two concurrent changes both land', async () => {
    const ext = await wallet();
    await Promise.all([updateSettings(ext, s => ({...s, phraseVerifiedAt: 5})), updateSettings(ext, s => ({...s, accountOrder: [0, 2, 1]}))]);
    expect(await readSettings(ext)).toMatchObject({phraseVerifiedAt: 5, accountOrder: [0, 2, 1]});
  });
});
````

Modify `extension/src/background/__tests__/messages.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index b7ce437..b0bb553 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -199,7 +199,7 @@ describe('message partitions (B1b-1 types)', () => {
   const ALL = [
     'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
-    'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
+    'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
   ];
 
   it('every privileged type is refused from a web page and from another extension', async () => {
````

Modify `extension/src/background/__tests__/settings.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/settings.test.ts b/extension/src/background/__tests__/settings.test.ts
index 038ae4f..90217dd 100644
--- a/extension/src/background/__tests__/settings.test.ts
+++ b/extension/src/background/__tests__/settings.test.ts
@@ -2,17 +2,17 @@ import {DEFAULT_SETTINGS, SETTINGS_KEY, parsePatch, readSettings, weakens, write
 import {fakeExt} from './fakeExt';
 
 describe('settings', () => {
-  it('defaults to a 5-minute auto-lock, a $100 re-auth threshold and account 0', async () => {
-    expect(DEFAULT_SETTINGS).toEqual({autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0});
+  it('defaults to a 5-minute auto-lock, a $100 re-auth threshold and account 0; no order, no phrase or password fact', async () => {
+    expect(DEFAULT_SETTINGS).toEqual({autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null});
     expect(await readSettings(fakeExt())).toEqual(DEFAULT_SETTINGS);
   });
 
   it('keeps a stored value that is an integer in range', async () => {
     const ext = fakeExt();
-    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 60, reauthUsdCents: 100, selectedAccount: 3});
-    expect(await readSettings(ext)).toEqual({autoLockMinutes: 60, reauthUsdCents: 100, selectedAccount: 3});
+    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 60, reauthUsdCents: 100, selectedAccount: 3, accountOrder: [3, 0], phraseVerifiedAt: 7, passwordChangedAt: 0});
+    expect(await readSettings(ext)).toEqual({autoLockMinutes: 60, reauthUsdCents: 100, selectedAccount: 3, accountOrder: [3, 0], phraseVerifiedAt: 7, passwordChangedAt: 0});
     await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 1, reauthUsdCents: 100_000});
-    expect(await readSettings(ext)).toEqual({autoLockMinutes: 1, reauthUsdCents: 100_000, selectedAccount: 0});
+    expect(await readSettings(ext)).toEqual({...DEFAULT_SETTINGS, autoLockMinutes: 1, reauthUsdCents: 100_000});
   });
 
   // Controller ruling (overrides the plan's clamp): a stored value outside what parsePatch would
@@ -25,8 +25,8 @@ describe('settings', () => {
     expect(await readSettings(ext)).toEqual(DEFAULT_SETTINGS);
     await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 0, reauthUsdCents: 99});
     expect(await readSettings(ext)).toEqual(DEFAULT_SETTINGS);
-    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: '15', reauthUsdCents: 25_000.4, selectedAccount: 2});
-    expect(await readSettings(ext)).toEqual({autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 2});
+    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: '15', reauthUsdCents: 25_000.4, selectedAccount: 2, phraseVerifiedAt: -1, passwordChangedAt: '5'});
+    expect(await readSettings(ext)).toEqual({...DEFAULT_SETTINGS, selectedAccount: 2});
     await ext.local.set(SETTINGS_KEY, {reauthUsdCents: 1_000_000});
     expect((await readSettings(ext)).reauthUsdCents).toBe(10_000);
     await ext.local.set(SETTINGS_KEY, 'garbage');
````

Modify `extension/src/background/__tests__/walletApi.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/walletApi.test.ts b/extension/src/background/__tests__/walletApi.test.ts
index 304dd98..e0718e2 100644
--- a/extension/src/background/__tests__/walletApi.test.ts
+++ b/extension/src/background/__tests__/walletApi.test.ts
@@ -339,7 +339,7 @@ describe('handleWallet', () => {
     const deps = fakeDeps();
     const [a, b] = await Promise.all([handleWallet(ext, deps, 'accounts.select', {index: 3}), handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 2}})]);
     expect([a.ok, b.ok]).toEqual([true, true]);
-    expect(await readSettings(ext)).toEqual({autoLockMinutes: 2, reauthUsdCents: 10_000, selectedAccount: 3});
+    expect(await readSettings(ext)).toMatchObject({autoLockMinutes: 2, reauthUsdCents: 10_000, selectedAccount: 3});
   });
 
   it('settings.set: strengthening applies at once; weakening needs a satisfied challenge for that exact patch', async () => {
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/accountsOrder.test.ts src/background/__tests__/messages.test.ts src/background/__tests__/settings.test.ts src/background/__tests__/walletApi.test.ts
```
Expected (dry run, these test files on the branch's starting tree (db57fa9)): **red** — Test Files 3 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/background/settings.ts`:

````diff
diff --git a/extension/src/background/settings.ts b/extension/src/background/settings.ts
index a3f47db..289b613 100644
--- a/extension/src/background/settings.ts
+++ b/extension/src/background/settings.ts
@@ -1,4 +1,6 @@
 import type {Ext} from '../ext';
+import {createMutex} from './mutex';
+import {MAX_ACCOUNTS} from '../shared/envelopeRules';
 
 /** storage.local key. Written only by the background (scripts/check-vault-isolation.mjs). */
 export const SETTINGS_KEY = 'v1_settings';
@@ -10,14 +12,32 @@ export interface Settings {
   reauthUsdCents: number;
   /** The account index the popup shows. */
   selectedAccount: number;
+  /**
+   * B1b-2b E14 (D17, C7): the popup's display order of the accounts, by index — outside the envelope, so it
+   * needs no proof and touches no AAD. Null: no order (envelope order).
+   */
+  accountOrder: number[] | null;
+  /** B1b-2b E15 (C8): when the recovery phrase was last verified (epoch ms). A fact, not a security guarantee. */
+  phraseVerifiedAt: number | null;
+  /** B1b-2b C10: when the password was last changed (epoch ms), written by vault.changePassword (E10). */
+  passwordChangedAt: number | null;
 }
 
-export const DEFAULT_SETTINGS: Settings = {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0};
+export const DEFAULT_SETTINGS: Settings = {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null};
 export const AUTOLOCK_RANGE = {min: 1, max: 60};
 /** $1 … $1 000: one re-authentication must not be able to raise the threshold a hundredfold (controller ruling). */
 export const REAUTH_USD_CENTS_RANGE = {min: 100, max: 100_000};
 
 const inRange = (v: unknown, r: {min: number; max: number}): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= r.min && v <= r.max;
+const isIndex = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
+
+/** An array of unique safe non-negative integers, at most MAX_ACCOUNTS long; anything else is no order — never "repaired". */
+function orderOf(x: unknown): number[] | null {
+  if (!Array.isArray(x) || x.length > MAX_ACCOUNTS) return null;
+  const list = x as unknown[];
+  if (!list.every(isIndex) || new Set(list).size !== list.length) return null;
+  return [...(list as number[])];
+}
 
 /**
  * Stored values are claims: a field that is not an integer in its range falls back to the safe
@@ -32,11 +52,39 @@ export async function readSettings(ext: Ext): Promise<Settings> {
     autoLockMinutes: inRange(o.autoLockMinutes, AUTOLOCK_RANGE) ? o.autoLockMinutes : DEFAULT_SETTINGS.autoLockMinutes,
     reauthUsdCents: inRange(o.reauthUsdCents, REAUTH_USD_CENTS_RANGE) ? o.reauthUsdCents : DEFAULT_SETTINGS.reauthUsdCents,
     selectedAccount: typeof sel === 'number' && Number.isSafeInteger(sel) && sel >= 0 ? sel : DEFAULT_SETTINGS.selectedAccount,
+    accountOrder: orderOf(o.accountOrder),
+    phraseVerifiedAt: isIndex(o.phraseVerifiedAt) ? o.phraseVerifiedAt : null,
+    passwordChangedAt: isIndex(o.passwordChangedAt) ? o.passwordChangedAt : null,
   };
 }
 
+/** Every field, rebuilt by name (C7): a field this does not name would be erased by the next write of any other. */
 export async function writeSettings(ext: Ext, s: Settings): Promise<void> {
-  await ext.local.set(SETTINGS_KEY, {autoLockMinutes: s.autoLockMinutes, reauthUsdCents: s.reauthUsdCents, selectedAccount: s.selectedAccount});
+  await ext.local.set(SETTINGS_KEY, {
+    autoLockMinutes: s.autoLockMinutes,
+    reauthUsdCents: s.reauthUsdCents,
+    selectedAccount: s.selectedAccount,
+    accountOrder: s.accountOrder,
+    phraseVerifiedAt: s.phraseVerifiedAt,
+    passwordChangedAt: s.passwordChangedAt,
+  });
+}
+
+/**
+ * Every read-modify-write of v1_settings, one at a time (C7: moved here from walletApi.ts): a select that read
+ * the settings before a strengthening must not write the weaker value back after it. Its own mutex, not
+ * sessionMutex (which is not re-entrant, and which the challenge calls inside take): the order is always
+ * settingsMutex first, then sessionMutex; nothing under sessionMutex takes this one.
+ */
+export const settingsMutex = createMutex();
+
+/** One read-modify-write of v1_settings under settingsMutex; resolves to what was written. */
+export function updateSettings(ext: Ext, change: (s: Settings) => Settings): Promise<Settings> {
+  return settingsMutex(async () => {
+    const next = change(await readSettings(ext));
+    await writeSettings(ext, next);
+    return next;
+  });
 }
 
 export type SettingsPatch = {autoLockMinutes?: number; reauthUsdCents?: number};
````

Modify `extension/src/background/walletApi.ts`:

````diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
index 6eb4507..bed2add 100644
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -3,8 +3,7 @@ import type {Ext} from '../ext';
 import type {WalletDeps} from './deps';
 import {REAUTH_KEY, getSession, sessionMutex} from './session';
 import {armAutolock} from './autolock';
-import {createMutex} from './mutex';
-import {parsePatch, readSettings, weakens, writeSettings, type Settings} from './settings';
+import {parsePatch, readSettings, settingsMutex, updateSettings, weakens, writeSettings, type Settings} from './settings';
 import {cleanName, readWalletView, renameAccount} from './accountsStore';
 import {consumeChallenge, issueChallenge} from './reauthChallenges';
 import {digestOf} from './digest';
@@ -38,6 +37,7 @@ export const WALLET_TYPES = [
   'wallet.discardPrepared',
   'accounts.rename',
   'accounts.select',
+  'accounts.order',
   'settings.get',
   'settings.set',
 ] as const;
@@ -49,13 +49,6 @@ const MAX_PROBE = 6;
 const MALFORMED: Result = {ok: false, error: 'malformed'};
 const histories = new WeakMap<WalletDeps, History>();
 const isIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
-/**
- * Every read-modify-write of v1_settings (settings.set, accounts.select), one at a time: a select
- * that read the settings before a strengthening must not write the weaker value back after it.
- * Its own mutex, not sessionMutex (which is not re-entrant, and which the challenge calls inside
- * take); nothing under sessionMutex takes this one.
- */
-const settingsMutex = createMutex();
 
 /** A transaction signature: base58 of exactly 64 bytes (review M6 — a page cursor is never passed on unchecked). */
 function isSignature(x: unknown): x is string {
@@ -97,16 +90,36 @@ function failure(e: unknown): Result {
   return {ok: false, error: 'failed'};
 }
 
+/**
+ * E14 (D17): the envelope's accounts in the display order — the indexes of `order` that exist, in that order,
+ * then every account `order` does not name, in envelope order. The envelope, its AAD and the session never see it.
+ */
+export function displayOrder<T extends {index: number}>(accounts: readonly T[], order: readonly number[] | null): T[] {
+  if (order === null) return [...accounts];
+  const byIndex = new Map(accounts.map(a => [a.index, a]));
+  const out: T[] = [];
+  for (const i of order) {
+    const a = byIndex.get(i);
+    if (a !== undefined) {
+      out.push(a);
+      byIndex.delete(i);
+    }
+  }
+  for (const a of accounts) if (byIndex.has(a.index)) out.push(a);
+  return out;
+}
+
 async function walletState(ext: Ext) {
   const [view, session, settings] = await Promise.all([readWalletView(ext), getSession(ext), readSettings(ext)]);
   if (view === null) return {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null};
+  const accounts = displayOrder(view.accounts, settings.accountOrder);
   // The selection is only ever an account that exists: in the envelope, and — while unlocked — in the
-  // session too (an account removed in the vault page must not stay selected). Otherwise the first
-  // such account: the session's first while unlocked, the envelope's first while locked.
-  const inView = (i: number) => view.accounts.some(a => a.index === i);
-  const choices = session === null ? view.accounts.map(a => a.index) : session.map(a => a.index).filter(inView);
-  const selected = choices.includes(settings.selectedAccount) ? settings.selectedAccount : (choices[0] ?? view.accounts[0]?.index ?? null);
-  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts: view.accounts, selected};
+  // session too (an account removed in the vault page must not stay selected). Otherwise the first such
+  // account of the display order (E14).
+  const inSession = (i: number) => session === null || session.some(a => a.index === i);
+  const choices = accounts.map(a => a.index).filter(inSession);
+  const selected = choices.includes(settings.selectedAccount) ? settings.selectedAccount : (choices[0] ?? accounts[0]?.index ?? null);
+  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts, selected};
 }
 
 /** Balances for onboarding's candidate addresses: public keys in, public numbers out. */
@@ -221,7 +234,26 @@ async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unkno
 async function selectAccount(ext: Ext, index: number): Promise<Result> {
   const view = await readWalletView(ext);
   if (view === null || !view.accounts.some(a => a.index === index)) return {ok: false, error: 'unknown-account'};
-  await settingsMutex(async () => writeSettings(ext, {...(await readSettings(ext)), selectedAccount: index}));
+  await updateSettings(ext, s => ({...s, selectedAccount: index}));
+  return {ok: true};
+}
+
+/**
+ * accounts.order (E14, D17): a permutation of the stored envelope's index set, kept in v1_settings. No proof — the
+ * order never touches the envelope or the session; every action names an account by index or key, never by
+ * position. A different set (an account added or removed since the manager read it) is `stale`: an order is
+ * never written for a list the user did not see. Two popups moving rows at once are last-writer-wins (review L9).
+ */
+async function orderAccounts(ext: Ext, order: unknown): Promise<Result> {
+  if (!Array.isArray(order)) return MALFORMED;
+  const list = order as unknown[];
+  if (!list.every(isIndex) || new Set(list).size !== list.length) return MALFORMED;
+  const indexes = list as number[];
+  const view = await readWalletView(ext);
+  if (view === null) return {ok: false, error: 'no-wallet'};
+  const stored = new Set(view.accounts.map(a => a.index));
+  if (indexes.length !== stored.size || !indexes.every(i => stored.has(i))) return {ok: false, error: 'stale'};
+  await updateSettings(ext, s => ({...s, accountOrder: [...indexes]}));
   return {ok: true};
 }
 
@@ -322,6 +354,8 @@ export async function handleWallet(ext: Ext, deps: WalletDeps, type: WalletType,
         if (!isIndex(index)) return MALFORMED;
         return await selectAccount(ext, index);
       }
+      case 'accounts.order':
+        return await orderAccounts(ext, msg.order);
       case 'settings.get':
         return {ok: true, data: await readSettings(ext)};
       case 'settings.set':
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/accountsOrder.test.ts src/background/__tests__/messages.test.ts src/background/__tests__/settings.test.ts src/background/__tests__/walletApi.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 4 passed (4) · Tests 67 passed (67); tsc clean; whole suite Test Files 114 passed (114) · Tests 2121 passed (2121); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M1a** — order: a stale index set is written — `extension/src/background/walletApi.ts`:

  ```diff
  - if (indexes.length !== stored.size || !indexes.every(i => stored.has(i))) return {ok: false, error: 'stale'};
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/accountsOrder.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M1b** — writeSettings drops phraseVerifiedAt (C7) — `extension/src/background/settings.ts`:

  ```diff
  -     phraseVerifiedAt: s.phraseVerifiedAt,
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/settings.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/accountsOrder.test.ts extension/src/background/__tests__/messages.test.ts extension/src/background/__tests__/settings.test.ts extension/src/background/__tests__/walletApi.test.ts extension/src/background/settings.ts extension/src/background/walletApi.ts
git commit -F - <<'MSG'
feat(extension): Settings gains accountOrder, phraseVerifiedAt, passwordChangedAt; updateSettings under settingsMutex; accounts.order (E14)

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 2: E9: a weakening `settings.set` is applied by the background on `vault.reauthOk` (C1); #10's settings outcomes

**Spec:** §2 E9, C1, D4; §3.7 (#10 settings kind); O26, O39–O41

**Files:**
- Modify: `extension/src/background/__tests__/messages.test.ts`
- Create: `extension/src/background/__tests__/settingsApply.test.ts`
- Modify: `extension/src/background/__tests__/walletApi.test.ts`
- Modify: `extension/src/background/messages.ts`
- Modify: `extension/src/background/reauthChallenges.ts`
- Modify: `extension/src/background/walletApi.ts`
- Modify: `extension/src/unlock/__tests__/orchestrate.test.ts`
- Modify: `extension/src/unlock/__tests__/reauthFlow.test.ts`
- Modify: `extension/src/unlock/__tests__/reauthScreen.test.ts`
- Modify: `extension/src/unlock/orchestrate.ts`
- Modify: `extension/src/unlock/reauthFlow.ts`
- Modify: `extension/src/unlock/screens/reauth.ts`
- Modify: `extension/src/unlock/strings.ts`

**Interfaces:**
- Consumes: Task 1's `updateSettings`; `issueChallenge`, `challengeInfo` (`reauthChallenges.ts`); `armAutolock` (`autolock.ts`); `REAUTH` strings; `orchestrate.ts`'s `PROVEN` list.
- Produces (exact signatures, as exported):
  - `export type SettingsChallengePatch = {autoLockMinutes: number | null; reauthUsdCents: number | null};`
  - `export async function takeSettingsChallenge(ext: Ext, now: number, id: string): Promise<SettingsChallengePatch | 'unknown-challenge' | 'locked'>`
  - `export async function applySettingsChallenge(ext: Ext, deps: Pick<WalletDeps, 'now'>, challengeId: string): Promise<Result>`
  - `export type ReauthPageOutcome = 'confirmed' | 'applied' | 'refused' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'expired' | 'damaged' | 'no-wallet' | 'failed';`

C1: `settings.set` never takes a `challengeId` (a message carrying one is `malformed`), and a weakening always answers `reauth-required` with a fresh challenge whose `about` is `{kind: 'settings', …}`. The challenge is consumed in **`vault.reauthOk`**: for a settings challenge the background takes it (`takeSettingsChallenge`: unknown/expired → `unknown-challenge`, no session → `locked`), re-parses the stored patch with `parsePatch`, writes it with `updateSettings`, re-arms the auto-lock alarm when the minutes changed, and answers `{ok: true, data: {applied: 'settings'}}`. A send challenge is untouched (it keeps plan 2a's path). The vault page maps the answer: `applied` → O39, `expired` → "Took too long — try again" + O40, `not-unlocked` → O41 with [Unlock], anything else → O26. `applied` and `refused` are proven outcomes for the backoff (they leave the wrong-attempt streak).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/messages.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index b0bb553..34806db 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -1,4 +1,4 @@
-import {SETTINGS_ABOUT} from './fixtures';
+
 import {ed25519} from '@noble/curves/ed25519.js';
 import {base58, base64} from '@scure/base';
 import {PRIVILEGED, handleMessage} from '../messages';
@@ -220,10 +220,11 @@ describe('message partitions (B1b-1 types)', () => {
     const ext = vaultExt();
     const deps = fakeDeps();
     await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
-    const challengeId = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
+    // A settings challenge with a patch in range (B1b-2b E9: confirming it applies it).
+    const challengeId = await issueChallenge(ext, deps, 'd', {kind: 'settings', autoLockMinutes: 10, reauthUsdCents: null});
     expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, popup, deps)).toEqual({ok: false, error: 'forbidden'});
     expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId: 'f'.repeat(32)}, unlockPage, deps)).toEqual({ok: false, error: 'unknown-challenge'});
-    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps)).toEqual({ok: true});
+    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps)).toEqual({ok: true, data: {applied: 'settings'}});
     await handleMessage(ext, {type: 'vault.lock'}, popup);
     expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps)).toEqual({ok: false, error: 'locked'});
   });
````

Create `extension/src/background/__tests__/settingsApply.test.ts`:

````ts
import {handleMessage} from '../messages';
import {handleWallet} from '../walletApi';
import {readSettings} from '../settings';
import {AUTOLOCK_ALARM, lock} from '../autolock';
import {CHALLENGE_TTL_MS, challengeInfo, issueChallenge, takeSettingsChallenge} from '../reauthChallenges';
import {REAUTH_KEY} from '../session';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from './fixtures';

// B1b-2b E9 (D6, C1): a weakening setting is applied by the background when #10's proof satisfies its challenge —
// vault.reauthOk carries only the id, the patch is the one bound at issue, applied exactly once.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};
const popup = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};

async function weaken(patch: {autoLockMinutes?: number; reauthUsdCents?: number}) {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = fakeDeps();
  const r = await handleWallet(ext, deps, 'settings.set', {patch});
  expect(r).toMatchObject({ok: false, error: 'reauth-required'});
  return {ext, deps, challengeId: (r.data as {challengeId: string}).challengeId};
}
const reauthOk = (ext: ReturnType<typeof fakeExt>, deps: ReturnType<typeof fakeDeps>, challengeId: string) =>
  handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps);

describe('E9: settings applied on vault.reauthOk', () => {
  it('a weakening answers reauth-required and writes nothing; vault.reauthOk applies it, re-arms the alarm, and says so', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: true, data: {applied: 'settings'}});
    expect(await handleWallet(ext, deps, 'settings.get', {})).toMatchObject({ok: true, data: {autoLockMinutes: 15}});
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(15);
  });

  it('the threshold: applied in cents, exactly as bound', async () => {
    const {ext, deps, challengeId} = await weaken({reauthUsdCents: 50_000});
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: true, data: {applied: 'settings'}});
    expect(await readSettings(ext)).toMatchObject({reauthUsdCents: 50_000, autoLockMinutes: 5});
  });

  it('applied exactly once: a replayed vault.reauthOk is unknown-challenge and writes nothing twice', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    expect(await reauthOk(ext, deps, challengeId)).toMatchObject({ok: true});
    // Strengthen in between: a replay that applied again would put 15 back.
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 1}})).toMatchObject({ok: true});
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(1);
  });

  it('an expired id is unknown-challenge; nothing is written', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    deps.clock.t += CHALLENGE_TTL_MS;
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
  });

  it('locked: refused, nothing applied (a lock clears the challenges anyway)', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    await lock(ext);
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: false, error: 'locked'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
  });

  it('a send challenge is satisfied as before and applies no settings ({ok: true} with no data)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    const about = {kind: 'send', account: ACCOUNT.publicKey, token: 'SOL', recipient: RECIPIENT, amount: '1', networkLamports: '5000', priorityLamports: '0', markupLamports: '0', markupReason: 'pre-tge', rentLamports: '0', reasons: ['first-send'], thresholdCents: 10_000} as const;
    const id = await issueChallenge(ext, deps, 'd', {...about, reasons: ['first-send']});
    expect(await reauthOk(ext, deps, id)).toEqual({ok: true});
    expect(await readSettings(ext)).toMatchObject({autoLockMinutes: 5, reauthUsdCents: 10_000});
    // takeSettingsChallenge never takes a send challenge.
    expect(await takeSettingsChallenge(ext, deps.now(), id)).toBe('unknown-challenge');
    expect(await challengeInfo(ext, deps.now(), id)).toMatchObject({kind: 'send'});
  });

  it('a stored settings record out of range is malformed: burned, nothing written (the range is re-checked)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    // isAbout checks only that the fields are integers or null: a record with 600 minutes is storable.
    const id = await issueChallenge(ext, deps, 'd', {kind: 'settings', autoLockMinutes: 600, reauthUsdCents: null});
    expect(await reauthOk(ext, deps, id)).toEqual({ok: false, error: 'malformed'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
    expect(await reauthOk(ext, deps, id)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('a settings record with no field set is malformed too', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', {kind: 'settings', autoLockMinutes: null, reauthUsdCents: null});
    expect(await reauthOk(ext, deps, id)).toEqual({ok: false, error: 'malformed'});
  });

  it('C1: settings.set carrying a challengeId is malformed, whatever the patch', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 15}, challengeId})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 1}, challengeId})).toEqual({ok: false, error: 'malformed'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
    // The challenge is untouched by the refused call: #10 can still apply it.
    expect(await reauthOk(ext, deps, challengeId)).toMatchObject({ok: true});
  });

  it('review M6: the last CONFIRMED proof wins — weaken A, strengthen B, confirm A → A', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 60});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 1}})).toMatchObject({ok: true});
    expect(await reauthOk(ext, deps, challengeId)).toMatchObject({ok: true});
    expect((await readSettings(ext)).autoLockMinutes).toBe(60);
  });

  it('review M6, the reverse order: confirm A, then strengthen B → B', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 60});
    expect(await reauthOk(ext, deps, challengeId)).toMatchObject({ok: true});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 1}})).toMatchObject({ok: true});
    expect((await readSettings(ext)).autoLockMinutes).toBe(1);
  });

  it('only the vault page may confirm: the popup is refused and nothing is applied', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, popup, deps)).toEqual({ok: false, error: 'forbidden'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
  });

  it('a storage failure while applying is failed, never a thrown error', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    const set = ext.local.set;
    ext.local.set = async () => {
      throw new Error('quota');
    };
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: false, error: 'failed'});
    ext.local.set = set;
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
    expect(await ext.session.get(REAUTH_KEY)).toEqual({});
  });
});
````

Modify `extension/src/background/__tests__/walletApi.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/walletApi.test.ts b/extension/src/background/__tests__/walletApi.test.ts
index e0718e2..54c8b7e 100644
--- a/extension/src/background/__tests__/walletApi.test.ts
+++ b/extension/src/background/__tests__/walletApi.test.ts
@@ -3,7 +3,7 @@ import {handleWallet} from '../walletApi';
 import {SETTINGS_KEY, readSettings} from '../settings';
 import {VAULT_KEY} from '../accountsStore';
 import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
-import {satisfyChallenge} from '../reauthChallenges';
+import {challengeInfo, satisfyChallenge} from '../reauthChallenges';
 import {AUTOLOCK_ALARM} from '../autolock';
 import {PREPARED_TTL_MS} from '../prepare';
 import {PREPARED_KEY, REAUTH_KEY, SESSION_KEY, setSession} from '../session';
@@ -342,7 +342,7 @@ describe('handleWallet', () => {
     expect(await readSettings(ext)).toMatchObject({autoLockMinutes: 2, reauthUsdCents: 10_000, selectedAccount: 3});
   });
 
-  it('settings.set: strengthening applies at once; weakening needs a satisfied challenge for that exact patch', async () => {
+  it('settings.set: strengthening applies at once; a weakening always answers reauth-required and writes nothing (E9 applies it)', async () => {
     const ext = fakeExt();
     await unlocked(ext);
     const deps = fakeDeps();
@@ -351,29 +351,21 @@ describe('handleWallet', () => {
     const ask = await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}});
     expect(ask).toMatchObject({ok: false, error: 'reauth-required'});
     const {challengeId} = ask.data as {challengeId: string};
-    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}, challengeId})).toMatchObject({ok: false, error: 'reauth-required'});
+    // A challenge the vault page satisfied is still not a way in through settings.set (C1).
     await satisfyChallenge(ext, deps.now(), challengeId);
-    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 60}, challengeId})).toMatchObject({ok: false, error: 'reauth-required'});
-    const second = await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}});
-    const id2 = (second.data as {challengeId: string}).challengeId;
-    await satisfyChallenge(ext, deps.now(), id2);
-    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}, challengeId: id2})).toMatchObject({ok: true, data: {autoLockMinutes: 30}});
-    expect(await handleWallet(ext, deps, 'settings.get', {})).toMatchObject({ok: true, data: {autoLockMinutes: 30}});
+    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}, challengeId})).toEqual({ok: false, error: 'malformed'});
+    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}})).toMatchObject({ok: false, error: 'reauth-required'});
+    expect(await handleWallet(ext, deps, 'settings.get', {})).toMatchObject({ok: true, data: {autoLockMinutes: 2}});
   });
 
-  it('settings.set: a challenge proved for one dollar threshold cannot raise it to another (the digest binds both fields)', async () => {
+  it('settings.set: each weakening binds its own patch — the threshold challenge describes exactly its own value', async () => {
     const ext = fakeExt();
     await unlocked(ext);
     const deps = fakeDeps();
     const ask = await handleWallet(ext, deps, 'settings.set', {patch: {reauthUsdCents: 20_000}});
     const {challengeId} = ask.data as {challengeId: string};
-    await satisfyChallenge(ext, deps.now(), challengeId);
-    expect(await handleWallet(ext, deps, 'settings.set', {patch: {reauthUsdCents: 100_000}, challengeId})).toMatchObject({ok: false, error: 'reauth-required'});
+    expect(await challengeInfo(ext, deps.now(), challengeId)).toEqual({kind: 'settings', autoLockMinutes: null, reauthUsdCents: 20_000});
     expect(await readSettings(ext)).toMatchObject({reauthUsdCents: 10_000});
-    const again = await handleWallet(ext, deps, 'settings.set', {patch: {reauthUsdCents: 20_000}});
-    const id2 = (again.data as {challengeId: string}).challengeId;
-    await satisfyChallenge(ext, deps.now(), id2);
-    expect(await handleWallet(ext, deps, 'settings.set', {patch: {reauthUsdCents: 20_000}, challengeId: id2})).toMatchObject({ok: true, data: {reauthUsdCents: 20_000}});
   });
 
   it('settings.set: a lock landing before the challenge is issued answers locked and leaves no challenge behind', async () => {
````

Modify `extension/src/unlock/__tests__/orchestrate.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/orchestrate.test.ts b/extension/src/unlock/__tests__/orchestrate.test.ts
index a82fae3..11b26b4 100644
--- a/extension/src/unlock/__tests__/orchestrate.test.ts
+++ b/extension/src/unlock/__tests__/orchestrate.test.ts
@@ -254,6 +254,17 @@ describe('wrong-password backoff (spec §2: an increasing delay on top of the Ar
     expect(slept).toEqual([1000, 1000]);
   });
 
+  it.each(['applied', 'refused'])("B1b-2b: resets on #10's '%s' (the proof held, as 'confirmed')", async proven => {
+    const {slept, sleep} = recordingSleep();
+    const backoff = createWrongBackoff(sleep);
+    await backoff.run(async () => 'wrong', () => undefined);
+    await backoff.run(async () => 'wrong', () => undefined);
+    await backoff.run(async () => proven, () => undefined);
+    await backoff.run(async () => 'wrong', () => undefined);
+    await backoff.run(async () => 'wrong', () => undefined);
+    expect(slept).toEqual([1000, 1000]);
+  });
+
   it('resets on unlocked', async () => {
     const {slept, sleep} = recordingSleep();
     const backoff = createWrongBackoff(sleep);
````

Modify `extension/src/unlock/__tests__/reauthFlow.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/reauthFlow.test.ts b/extension/src/unlock/__tests__/reauthFlow.test.ts
index dea092d..1aed490 100644
--- a/extension/src/unlock/__tests__/reauthFlow.test.ts
+++ b/extension/src/unlock/__tests__/reauthFlow.test.ts
@@ -70,20 +70,29 @@ describe('runReauth (the vault page proves the factor, the background is told)',
     expect(sent.map(m => m.type)).toEqual(['vault.status', 'vault.reauthOk']);
   });
 
-  it('a refused reauthOk (an expired challenge) is a failure', async () => {
+  it('a reauthOk refused without a named reason is `refused` (B1b-2b: the proof held, nothing was applied)', async () => {
     const {deps} = await setup(MNEMONIC, type => ({ok: type !== 'vault.reauthOk'}));
-    expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('failed');
+    expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('refused');
+  });
+
+  it("B1b-2b E9: {ok: true, data: {applied: 'settings'}} is 'applied'; {ok: true} with no data stays 'confirmed' (a send)", async () => {
+    const applied = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? ({ok: true, data: {applied: 'settings'}} as {ok: boolean}) : {ok: true}));
+    expect(await runReauth(applied.deps, ID, {password: PASSWORD, kdf})).toBe('applied');
+    const other = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? ({ok: true, data: {applied: 'send'}} as {ok: boolean}) : {ok: true}));
+    expect(await runReauth(other.deps, ID, {password: PASSWORD, kdf})).toBe('confirmed');
+    const plain = await setup(MNEMONIC);
+    expect(await runReauth(plain.deps, ID, {password: PASSWORD, kdf})).toBe('confirmed');
   });
 
   // D39 (plan-1 carry): the challenge expired while the password was typed — #10 says "expired", never
   // "failed"; a lock between the status read and the confirmation is "not-unlocked".
-  it("vault.reauthOk answered unknown-challenge is 'expired'; locked is 'not-unlocked'; any other refusal 'failed'", async () => {
+  it("vault.reauthOk answered unknown-challenge is 'expired'; locked is 'not-unlocked'; any other refusal 'refused'", async () => {
     const expired = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'unknown-challenge'} : {ok: true}));
     expect(await runReauth(expired.deps, ID, {password: PASSWORD, kdf})).toBe('expired');
     const locked = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'locked'} : {ok: true}));
     expect(await runReauth(locked.deps, ID, {password: PASSWORD, kdf})).toBe('not-unlocked');
     const other = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'malformed'} : {ok: true}));
-    expect(await runReauth(other.deps, ID, {password: PASSWORD, kdf})).toBe('failed');
+    expect(await runReauth(other.deps, ID, {password: PASSWORD, kdf})).toBe('refused');
   });
 
   it('a damaged envelope is named, and the background is told nothing — not even the status read (stored.ts)', async () => {
````

Modify `extension/src/unlock/__tests__/reauthScreen.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/reauthScreen.test.ts b/extension/src/unlock/__tests__/reauthScreen.test.ts
index d5341ae..95d3eec 100644
--- a/extension/src/unlock/__tests__/reauthScreen.test.ts
+++ b/extension/src/unlock/__tests__/reauthScreen.test.ts
@@ -552,21 +552,68 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     expect(h.went).toEqual([]);
   });
 
-  it('a settings challenge (B1b-2b): "You are about to change" and its lines; confirmed → "Confirmed. You can close this tab."', async () => {
-    const {h, broadcast} = await shown({kind: 'settings', autoLockMinutes: 5, reauthUsdCents: 25_000});
+  it('a settings challenge (B1b-2b E9): "You are about to change" and its lines; confirmed → applied by the background (O39)', async () => {
+    const {h, broadcast} = await shown({kind: 'settings', autoLockMinutes: 15, reauthUsdCents: 25_000});
     expect(text(el('ra-about'))).toBe('You are about to change');
     expect(visible(el('ra-amount-row'))).toBe(false);
-    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Auto-lock → 5 minutes', 'Re-authentication threshold → $250']);
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Auto-lock → 15 minutes', 'Re-authentication threshold → $250']);
     expect(el('ra-reasons').childElementCount).toBe(0);
     expect(text(el('ra-cancel'))).toBe('Cancel');
     expect(unstyled('v-reauth')).toEqual([]);
     confirmWith(PW);
     await h.until(() => visible(el('ra-notice')));
-    expect(text(el('ra-notice-line'))).toBe('Confirmed. You can close this tab.');
+    expect(text(el('ra-notice-line'))).toBe('Confirmed. The change is saved — you can close this tab.');
+    expect(text(document.body)).not.toContain('Confirmed. You can close this tab.');
+    // The background applied exactly the patch it bound — nothing was re-sent from this page.
+    expect(await h.ext.local.get('v1_settings')).toMatchObject({autoLockMinutes: 15, reauthUsdCents: 25_000});
+    expect(h.sent.filter(m => m.type === 'vault.reauthOk')).toHaveLength(1);
     expect(h.went).toEqual([]);
     nothingSent(h, broadcast);
   });
 
+  it('§3.7 settings-expired: a settings proof that outlived its challenge — the approved line and O40, nothing changed', async () => {
+    const {h} = await shown({kind: 'settings', autoLockMinutes: 15, reauthUsdCents: null});
+    h.wallet.clock.t += CHALLENGE_TTL_MS;
+    confirmWith(PW);
+    await h.until(() => visible(el('ra-notice')));
+    expect(text(el('ra-notice-line'))).toBe('Took too long — try again');
+    expect(text(el('ra-notice-help'))).toBe('Nothing was changed. Choose the setting again in Security center.');
+    expect(text(document.body)).not.toContain('Start the send again');
+    expect(await h.ext.local.get('v1_settings')).toBeUndefined();
+  });
+
+  it('§3.7 settings-not-unlocked: locked mid-confirm — O41 with [Unlock], nothing changed', async () => {
+    const {h} = await shown({kind: 'settings', autoLockMinutes: 15, reauthUsdCents: null});
+    const inner = h.deps.send;
+    h.deps.send = async m => ((m as {type: string}).type === 'vault.reauthOk' ? {ok: false, error: 'locked'} : inner(m));
+    confirmWith(PW);
+    await h.until(() => visible(el('ra-notice')));
+    expect(text(el('ra-notice-line'))).toBe('The wallet locked while you were confirming. Nothing was changed. Unlock it and choose the setting again.');
+    expect(visible(el('ra-unlock'))).toBe(true);
+  });
+
+  it('§3.7 settings-failed: a malformed or failed apply — O26, never "Confirmed"', async () => {
+    for (const error of ['malformed', 'failed']) {
+      loadPage();
+      const {h} = await shown({kind: 'settings', autoLockMinutes: 15, reauthUsdCents: null});
+      const inner = h.deps.send;
+      h.deps.send = async m => ((m as {type: string}).type === 'vault.reauthOk' ? {ok: false, error} : inner(m));
+      confirmWith(PW);
+      await h.until(() => visible(el('ra-notice')));
+      expect(text(el('ra-notice-line'))).toBe('Something went wrong. Nothing was changed.');
+      expect(text(document.body)).not.toMatch(/Confirmed/);
+    }
+  });
+
+  it('a settings description answered {ok: true} with no data (no apply) is never called confirmed', async () => {
+    const {h} = await shown({kind: 'settings', autoLockMinutes: 15, reauthUsdCents: null});
+    const inner = h.deps.send;
+    h.deps.send = async m => ((m as {type: string}).type === 'vault.reauthOk' ? {ok: true} : inner(m));
+    confirmWith(PW);
+    await h.until(() => visible(el('ra-notice')));
+    expect(text(el('ra-notice-line'))).toBe('Something went wrong. Nothing was changed.');
+  });
+
   it('a settings challenge’s Cancel only closes the tab: no discard, no "cancelled"', async () => {
     const {h} = await shown({kind: 'settings', autoLockMinutes: 5, reauthUsdCents: null});
     click(el('ra-cancel'));
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/messages.test.ts src/background/__tests__/settingsApply.test.ts src/background/__tests__/walletApi.test.ts src/unlock/__tests__/orchestrate.test.ts src/unlock/__tests__/reauthFlow.test.ts src/unlock/__tests__/reauthScreen.test.ts
```
Expected (dry run, these test files on Task 1's tree): **red** — Test Files 6 failed (6) · Tests 21 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/background/messages.ts`:

````diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index 7ce3601..2ea75da 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -9,7 +9,7 @@ import {CHALLENGE_ID, challengeInfo, satisfyChallenge} from './reauthChallenges'
 import {forgetWallet, readWalletView, storeEnvelope} from './accountsStore';
 import {isOpen, readPending} from './pendingStore';
 import {startPoller} from './pending';
-import {WALLET_TYPES, handleWallet, isWalletType, type Result} from './walletApi';
+import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
 
 /** What the browser reports about a message's origin (runtime.MessageSender). */
 export interface Sender {
@@ -144,6 +144,10 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       const challengeId = (msg as {challengeId?: unknown}).challengeId;
       if (typeof challengeId !== 'string') return {ok: false, error: 'malformed'};
       if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
+      // E9 (D6): a settings challenge is applied here, by the background, from the patch it bound at issue — the
+      // message carries only the id. A send challenge (or an unknown one) is satisfied as before (D38).
+      const about = await challengeInfo(ext, deps.now(), challengeId);
+      if (about?.kind === 'settings') return applySettingsChallenge(ext, deps, challengeId);
       return (await satisfyChallenge(ext, deps.now(), challengeId)) ? {ok: true} : {ok: false, error: 'unknown-challenge'};
     }
     case 'vault.challengeInfo': {
````

Modify `extension/src/background/reauthChallenges.ts`:

````diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
index cd0ba3b..c85fbca 100644
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -1,6 +1,6 @@
 import type {Ext} from '../ext';
 import type {WalletDeps} from './deps';
-import {REAUTH_KEY, sessionMutex} from './session';
+import {REAUTH_KEY, getSession, sessionMutex} from './session';
 import {randomId} from './digest';
 import type {SendReauthReason} from './reauthPolicy';
 import type {FeeReason} from '../../../core/fees/transferMarkup';
@@ -212,6 +212,29 @@ export async function consumeChallenge(ext: Ext, now: number, id: string, digest
   });
 }
 
+/** The patch a settings challenge was issued for (E9): the values parsePatch accepted at issue, null where unchanged. */
+export type SettingsChallengePatch = {autoLockMinutes: number | null; reauthUsdCents: number | null};
+
+/**
+ * B1b-2b E9 (D6): the background applies a weakening setting when #10's proof satisfies its challenge. Under
+ * sessionMutex, in ONE section: an unknown, expired or non-settings id is `unknown-challenge`; no session is
+ * `locked`; otherwise the record is DELETED (single use — a replayed vault.reauthOk finds nothing) and its patch
+ * returned. A send challenge is never taken here, and a settings challenge is never satisfied for a re-call
+ * (C1: settings.set no longer accepts a challengeId).
+ */
+export async function takeSettingsChallenge(ext: Ext, now: number, id: string): Promise<SettingsChallengePatch | 'unknown-challenge' | 'locked'> {
+  if (!CHALLENGE_ID.test(id)) return 'unknown-challenge';
+  return sessionMutex(async () => {
+    const store = live(await load(ext), now);
+    const c = store.get(id);
+    if (c === undefined || c.about.kind !== 'settings') return 'unknown-challenge';
+    if ((await getSession(ext)) === null) return 'locked';
+    store.delete(id);
+    await save(ext, store);
+    return {autoLockMinutes: c.about.autoLockMinutes, reauthUsdCents: c.about.reauthUsdCents};
+  });
+}
+
 /** Remove every challenge bound to one of these digests (wallet.discardPrepared, E7). Under sessionMutex by the caller. */
 export async function dropChallengesFor(ext: Ext, digests: ReadonlySet<string>): Promise<void> {
   const store = await load(ext);
````

Modify `extension/src/background/walletApi.ts`:

````diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
index bed2add..4f91eba 100644
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -3,9 +3,9 @@ import type {Ext} from '../ext';
 import type {WalletDeps} from './deps';
 import {REAUTH_KEY, getSession, sessionMutex} from './session';
 import {armAutolock} from './autolock';
-import {parsePatch, readSettings, settingsMutex, updateSettings, weakens, writeSettings, type Settings} from './settings';
+import {parsePatch, readSettings, settingsMutex, updateSettings, weakens, writeSettings, type Settings, type SettingsPatch} from './settings';
 import {cleanName, readWalletView, renameAccount} from './accountsStore';
-import {consumeChallenge, issueChallenge} from './reauthChallenges';
+import {issueChallenge, takeSettingsChallenge} from './reauthChallenges';
 import {digestOf} from './digest';
 import {discardPrepared, isAddress, parseIntent, preparedFor, prepareSend} from './prepare';
 import {isKnownRecipient, lastSentAt} from './knownRecipients';
@@ -198,30 +198,34 @@ async function recipientInfo(ext: Ext, account: unknown, recipient: unknown): Pr
   };
 }
 
+/**
+ * settings.set. Strengthening writes at once, also while locked (it lowers nothing). A weakening always issues a
+ * challenge bound to the exact patch and answers `reauth-required`; it is applied only by vault.reauthOk (E9,
+ * applySettingsChallenge). C1: a message carrying `challengeId` is `malformed` — the re-call path is gone, so it
+ * cannot be a second door.
+ */
 async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unknown>): Promise<Result> {
+  if (msg.challengeId !== undefined) return MALFORMED;
   const patch = parsePatch(msg.patch);
   if (patch === null) return MALFORMED;
   const out = await settingsMutex(async (): Promise<Result> => {
     const current = await readSettings(ext);
     if (weakens(current, patch)) {
       if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
-      const digest = digestOf('settings', {autoLockMinutes: patch.autoLockMinutes ?? null, reauthUsdCents: patch.reauthUsdCents ?? null});
-      const id = msg.challengeId;
-      // Neither call runs inside sessionMutex here: each takes it itself (it is not re-entrant).
-      if (typeof id !== 'string' || !(await consumeChallenge(ext, deps.now(), id, digest))) {
-        // A lock may have landed since the check above: never issue a challenge into a locked session.
-        if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
-        const challengeId = await issueChallenge(ext, deps, digest, {kind: 'settings', autoLockMinutes: patch.autoLockMinutes ?? null, reauthUsdCents: patch.reauthUsdCents ?? null});
-        // …nor keep one a lock raced past (issueChallenge wrote after the lock's clear): as in
-        // prepareSend, remove just the challenges, under the mutex the lock takes — never lock()
-        // or clearSession() here, which would wait on this very mutex.
-        const lockedMeanwhile = await sessionMutex(async () => {
-          if ((await getSession(ext)) !== null) return false;
-          await ext.session.remove(REAUTH_KEY);
-          return true;
-        });
-        return lockedMeanwhile ? {ok: false, error: 'locked'} : {ok: false, error: 'reauth-required', data: {challengeId}};
-      }
+      const about = {autoLockMinutes: patch.autoLockMinutes ?? null, reauthUsdCents: patch.reauthUsdCents ?? null};
+      // A lock may have landed since the check above: never issue a challenge into a locked session.
+      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
+      // issueChallenge takes sessionMutex itself (it is not re-entrant): never called inside it here.
+      const challengeId = await issueChallenge(ext, deps, digestOf('settings', about), {kind: 'settings', ...about});
+      // …nor keep one a lock raced past (issueChallenge wrote after the lock's clear): as in
+      // prepareSend, remove just the challenges, under the mutex the lock takes — never lock()
+      // or clearSession() here, which would wait on this very mutex.
+      const lockedMeanwhile = await sessionMutex(async () => {
+        if ((await getSession(ext)) !== null) return false;
+        await ext.session.remove(REAUTH_KEY);
+        return true;
+      });
+      return lockedMeanwhile ? {ok: false, error: 'locked'} : {ok: false, error: 'reauth-required', data: {challengeId}};
     }
     const next: Settings = {...current, ...patch};
     await writeSettings(ext, next);
@@ -231,6 +235,37 @@ async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unkno
   return out;
 }
 
+/**
+ * E9 (D6): #10's Confirm satisfied a settings challenge — the background applies the patch it bound at issue. Inside
+ * settingsMutex (taken BEFORE sessionMutex, the existing order): take the challenge (deleted in the same section
+ * that reads it: applied exactly once), re-check the range (the stored `about` is checked only for integers), write
+ * over whatever is stored now — the last confirmed proof wins, nothing re-bases or revokes another live challenge
+ * (review M6). Then, outside the mutex, the auto-lock alarm is re-armed when it changed and a session exists.
+ * Refusals: `unknown-challenge` (absent, expired, applied), `locked`, `malformed` (the challenge is burned, nothing
+ * written), `failed` (storage).
+ */
+export async function applySettingsChallenge(ext: Ext, deps: Pick<WalletDeps, 'now'>, challengeId: string): Promise<Result> {
+  const applied: {patch: SettingsPatch | null} = {patch: null};
+  try {
+    const out = await settingsMutex(async (): Promise<Result> => {
+      const taken = await takeSettingsChallenge(ext, deps.now(), challengeId);
+      if (taken === 'unknown-challenge' || taken === 'locked') return {ok: false, error: taken};
+      const raw: Record<string, number> = {};
+      if (taken.autoLockMinutes !== null) raw.autoLockMinutes = taken.autoLockMinutes;
+      if (taken.reauthUsdCents !== null) raw.reauthUsdCents = taken.reauthUsdCents;
+      const patch = parsePatch(raw);
+      if (patch === null) return MALFORMED;
+      await writeSettings(ext, {...(await readSettings(ext)), ...patch});
+      applied.patch = patch;
+      return {ok: true, data: {applied: 'settings'}};
+    });
+    if (out.ok && applied.patch?.autoLockMinutes !== undefined && (await getSession(ext)) !== null) await armAutolock(ext);
+    return out;
+  } catch {
+    return {ok: false, error: 'failed'};
+  }
+}
+
 async function selectAccount(ext: Ext, index: number): Promise<Result> {
   const view = await readWalletView(ext);
   if (view === null || !view.accounts.some(a => a.index === index)) return {ok: false, error: 'unknown-account'};
````

Modify `extension/src/unlock/orchestrate.ts`:

````diff
diff --git a/extension/src/unlock/orchestrate.ts b/extension/src/unlock/orchestrate.ts
index 5e1a435..0238574 100644
--- a/extension/src/unlock/orchestrate.ts
+++ b/extension/src/unlock/orchestrate.ts
@@ -120,7 +120,7 @@ export interface WrongBackoff {
  * the backoff just by breaking its own display of it.
  */
 /** Outcomes that proved the factor: unlocked, re-auth confirmed, accounts changed (even if then locked), phrase shown, #40's factor proof. */
-const PROVEN: readonly string[] = ['unlocked', 'confirmed', 'done', 'done-locked', 'done-not-locked', 'shown', 'proven'];
+const PROVEN: readonly string[] = ['unlocked', 'confirmed', 'applied', 'refused', 'done', 'done-locked', 'done-not-locked', 'shown', 'proven'];
 
 export function createWrongBackoff(sleep: (ms: number) => Promise<void>): WrongBackoff {
   let streak = 0;
````

Modify `extension/src/unlock/reauthFlow.ts`:

````diff
diff --git a/extension/src/unlock/reauthFlow.ts b/extension/src/unlock/reauthFlow.ts
index 53710be..334d7dd 100644
--- a/extension/src/unlock/reauthFlow.ts
+++ b/extension/src/unlock/reauthFlow.ts
@@ -2,7 +2,12 @@ import {reauthenticate, type ReauthFactor, type SessionKeys} from '../vault/reau
 import {storedVault} from './stored';
 import type {Send} from './types';
 
-export type ReauthPageOutcome = 'confirmed' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'expired' | 'damaged' | 'no-wallet' | 'failed';
+/**
+ * `applied` (B1b-2b E9): the background applied a settings challenge's patch on this proof. `refused`: the proof
+ * held but vault.reauthOk was refused for another reason (`malformed`, `failed`) — for a settings challenge,
+ * nothing was changed.
+ */
+export type ReauthPageOutcome = 'confirmed' | 'applied' | 'refused' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'expired' | 'damaged' | 'no-wallet' | 'failed';
 
 /** The session's PUBLIC keys, from vault.status — never its secret keys. Null while locked. */
 export async function sessionKeys(send: Send): Promise<SessionKeys | null> {
@@ -48,12 +53,13 @@ export async function runReauth(
     if (outcome === 'mismatch') return await lockOnMismatch(deps.send);
     if (outcome !== 'ok') return outcome;
     const r = await deps.send({type: 'vault.reauthOk', challengeId});
-    if (r.ok) return 'confirmed';
+    // A send description answers {ok: true} with no data (D38: #20 sends); a settings one says it was applied.
+    if (r.ok) return typeof r.data === 'object' && r.data !== null && (r.data as {applied?: unknown}).applied === 'settings' ? 'applied' : 'confirmed';
     // D39: the challenge expired (or was discarded) while the password was typed — #10's `expired`,
     // never `failed`. A lock that landed after the status read is `not-unlocked`.
     if (r.error === 'unknown-challenge') return 'expired';
     if (r.error === 'locked') return 'not-unlocked';
-    return 'failed';
+    return 'refused';
   } catch {
     return 'failed';
   } finally {
````

Modify `extension/src/unlock/screens/reauth.ts`:

````diff
diff --git a/extension/src/unlock/screens/reauth.ts b/extension/src/unlock/screens/reauth.ts
index ba5edbc..3339225 100644
--- a/extension/src/unlock/screens/reauth.ts
+++ b/extension/src/unlock/screens/reauth.ts
@@ -172,6 +172,14 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
   const settle = (out: ReauthPageOutcome | 'unavailable') => {
     endCooldown();
     field.value = '';
+    // B1b-2b E9 (§3.7): a settings description has its own end states — applied by the background, or nothing changed.
+    if (described?.kind === 'settings') {
+      if (out === 'applied') return notice(REAUTH.settingsApplied);
+      if (out === 'expired') return notice(REAUTH.settingsExpired, {help: REAUTH.settingsExpiredHelp});
+      if (out === 'not-unlocked') return notice(REAUTH.settingsNotUnlocked, {unlock: true});
+      // Never "Confirmed" for a setting the background did not say it applied (fail closed).
+      if (out === 'confirmed' || out === 'refused') return notice(REAUTH.settingsFailed);
+    }
     if (out === 'confirmed') {
       helper('', false);
       if (described?.kind === 'send') {
@@ -189,11 +197,11 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
         // proven send must fail closed: never "Confirmed. You can close this tab." for a send that went nowhere.
         return helper(COMMON.failedTryAgain, false);
       }
-      return notice(REAUTH.settingsConfirmed);
+      return helper(COMMON.failedTryAgain, false);
     }
     if (out === 'wrong') return helper(COMMON.wrongConfirm, true);
     if (out === 'unavailable') return helper(COMMON.passkeyUnavailableConfirm, false);
-    if (out === 'failed') return helper(COMMON.failedTryAgain, false);
+    if (out === 'failed' || out === 'refused' || out === 'applied') return helper(COMMON.failedTryAgain, false);
     if (out === 'expired') return notice(REAUTH.expired);
     if (out === 'not-unlocked') return notice(REAUTH.notUnlocked, {unlock: true});
     if (out === 'mismatch-locked') return notice(COMMON.mismatchLocked);
````

Modify `extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index c9ce850..26e858e 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -254,7 +254,16 @@ export const REAUTH = {
   expired: 'This confirmation has expired. Start the send again from the Noctura icon.',
   checking: 'Checking…',
   cancelled: 'Send cancelled. Nothing was sent.',
-  settingsConfirmed: 'Confirmed. You can close this tab.',
+  /** O39 (B1b-2b E9, §3.7): the background applied the setting on this proof — replaces 2a's "Confirmed. You can close this tab." */
+  settingsApplied: 'Confirmed. The change is saved — you can close this tab.',
+  /** The approved design §3: a settings proof that outlived its challenge (§3.7 `settings-expired`). */
+  settingsExpired: 'Took too long — try again',
+  /** O40. */
+  settingsExpiredHelp: 'Nothing was changed. Choose the setting again in Security center.',
+  /** O41 (`settings-not-unlocked`). */
+  settingsNotUnlocked: 'The wallet locked while you were confirming. Nothing was changed. Unlock it and choose the setting again.',
+  /** O26 (`settings-failed`). */
+  settingsFailed: 'Something went wrong. Nothing was changed.',
   aboutSend: 'You are about to send',
   aboutChange: 'You are about to change',
   to: 'To',
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/messages.test.ts src/background/__tests__/settingsApply.test.ts src/background/__tests__/walletApi.test.ts src/unlock/__tests__/orchestrate.test.ts src/unlock/__tests__/reauthFlow.test.ts src/unlock/__tests__/reauthScreen.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 6 passed (6) · Tests 164 passed (164); tsc clean; whole suite Test Files 115 passed (115) · Tests 2141 passed (2141); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M2a** — C1: settings.set accepts a challengeId — `extension/src/background/walletApi.ts`:

  ```diff
  - if (msg.challengeId !== undefined) return MALFORMED;
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/settingsApply.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M2b** — a send challenge applies as settings — `extension/src/background/reauthChallenges.ts`:

  ```diff
  - if (c === undefined || c.about.kind !== 'settings') return 'unknown-challenge';
  + if (c === undefined) return 'unknown-challenge';
  ```
  `timeout 300 npx vitest run src/background/__tests__/settingsApply.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/messages.test.ts extension/src/background/__tests__/settingsApply.test.ts extension/src/background/__tests__/walletApi.test.ts extension/src/background/messages.ts extension/src/background/reauthChallenges.ts extension/src/background/walletApi.ts extension/src/unlock/__tests__/orchestrate.test.ts extension/src/unlock/__tests__/reauthFlow.test.ts extension/src/unlock/__tests__/reauthScreen.test.ts extension/src/unlock/orchestrate.ts extension/src/unlock/reauthFlow.ts extension/src/unlock/screens/reauth.ts extension/src/unlock/strings.ts
git commit -F - <<'MSG'
feat(extension): E9: a weakening settings.set is applied by the background on vault.reauthOk (C1); #10's settings outcomes

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 3: E10: change password — `rewrapPassword`, `onlyPasswordChanged`, `vault.changePassword`, the vault page's `passwordFlow`

**Spec:** §2 E10, D8, C2, C10, C20

**Files:**
- Create: `extension/src/background/__tests__/changePassword.test.ts`
- Modify: `extension/src/background/__tests__/messages.test.ts`
- Modify: `extension/src/background/accountsStore.ts`
- Modify: `extension/src/background/messages.ts`
- Create: `extension/src/unlock/__tests__/passwordFlow.test.ts`
- Create: `extension/src/unlock/passwordFlow.ts`
- Create: `extension/src/vault/__tests__/rewrapPassword.test.ts`
- Modify: `extension/src/vault/envelope.ts`

**Interfaces:**
- Consumes: `unlockWithPassword`, `WrongPassword`, `wrapKey`/`unwrapKey` (`src/vault/envelope.ts`); `openProven` (`src/vault/reauth.ts`); `envelopeRevision`; `lockOnMismatch`, `sessionKeys` (`reauthFlow.ts`); `storedVault`; Task 1's `updateSettings`.
- Produces (exact signatures, as exported):
  - `export type StoredEnvelope =`
  - `export type ChangePasswordResult = 'changed' | 'malformed' | 'locked' | 'no-wallet' | 'stored-invalid' | 'busy';`
  - `export function onlyPasswordChanged(current: StoredEnvelope, next: StoredEnvelope): boolean`
  - `export async function changePassword(ext: Ext, now: number, expectedRevision: unknown, envelope: unknown): Promise<ChangePasswordResult>`
  - `export const PRIVILEGED = [`
  - `export interface HeldProof`
  - `export type ProveOutcome = {outcome: 'proven'; held: HeldProof} | {outcome: 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed'};`
  - `export async function proveCurrent(deps: {readEnvelope(): Promise<unknown>; send: Send}, password: string, kdf: Kdf): Promise<ProveOutcome>`
  - `export async function isCurrentPassword(env: EnvelopeV1, candidate: string, kdf: Kdf): Promise<boolean>`
  - `export type ChangeOutcome = 'changed' | 'weak-password' | 'locked' | 'busy' | 'no-wallet' | 'damaged' | 'failed';`
  - `export async function changePassword(deps: {send: Send; kdf: Kdf}, held: HeldProof, newPassword: string): Promise<ChangeOutcome>`
  - `export async function rewrapPassword(env: EnvelopeV1, dataKey: Uint8Array, password: string, kdf: Kdf): Promise<{salt: string; wrapped: string}>`

The data key does not change; only its password wrap does. `rewrapPassword(env, dataKey, password, kdf)` draws a fresh 16-byte salt, keeps the stored Argon2id cost, wraps the data key under the new KEK and **opens the new wrap again before returning** (a wrap that does not round-trip throws). The background's `vault.changePassword` (vault page only) stores the new envelope only when `onlyPasswordChanged(current, next)` holds — same `v`, `scheme`, KDF alg/m/t/p, a **different** salt, a different wrap, the same seed iv/ct, the same passkey (all three fields) and the same accounts in the same order — at the revision the page proved (`busy` otherwise), with a session (`locked`), and then writes `passwordChangedAt` (best effort, after the store). The page's half (`passwordFlow.ts`): `proveCurrent` (password only — D8; proves against the session, a mismatch locks; keeps only the data key, drops the phrase), `isCurrentPassword` (step 2's "same password" check: one Argon2id with the stored salt), `changePassword` (zeroes the data key on every path). **`HeldProof` is frozen, not minted** (review L4; spec E10 says "minted, frozen"): no WeakSet is kept, because a forged `HeldProof` gains nothing — `changePassword` can send only a wrap that `rewrapPassword` proved opens to the data key it was given and decrypts this envelope's seed, i.e. a holder of the real data key. `rewrapPassword`'s self-check has two halves, each with a test that a named mutation turns red: the seed half (a key that does not open this seed) and the unwrap half (the platform made to wrap a different key — review M4).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/__tests__/changePassword.test.ts`:

````ts
import {base64} from '@scure/base';
import {VAULT_KEY, changePassword, onlyPasswordChanged, storeEnvelope, type StoredEnvelope} from '../accountsStore';
import {handleMessage} from '../messages';
import {readSettings} from '../settings';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {unlocked} from './fixtures';

// B1b-2b E10 (C2): vault.changePassword accepts exactly a new salt and a new password wrap — nothing else.
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const K2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const PASSKEY = {credentialId: B(16, 7), prfSalt: B(32, 8), wrapped: B(40, 9)};
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  passkey: PASSKEY,
  accounts: [
    {index: 0, name: 'Main', publicKey: K0},
    {index: 1, name: 'Savings', publicKey: K1},
  ],
};
type Env = typeof STORED;
const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
/** A well-formed change: a new salt and a new wrap, names as the page knows them. */
const CHANGED: Env = {...STORED, kdf: {...STORED.kdf, salt: B(16, 11)}, password: {wrapped: B(40, 12)}};
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};

async function stored(o: {session?: boolean; env?: unknown} = {}) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, o.env ?? STORED);
  if (o.session !== false) await unlocked(ext);
  return ext;
}

describe('vault.changePassword (E10)', () => {
  it('accepted when only the salt and the wrap change: stored, names carried over, passwordChangedAt written', async () => {
    const ext = await stored();
    const renamedByPage = {...CHANGED, accounts: CHANGED.accounts.map(a => ({...a, name: 'whatever the page says'}))};
    expect(await changePassword(ext, 4242, REV, renamedByPage)).toBe('changed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(CHANGED);
    expect((await readSettings(ext)).passwordChangedAt).toBe(4242);
  });

  const refused: [string, Env][] = [
    ['the same salt', {...CHANGED, kdf: {...CHANGED.kdf, salt: STORED.kdf.salt}}],
    ['the same wrap', {...CHANGED, password: {wrapped: STORED.password.wrapped}}],
    ['the seed ciphertext changed', {...CHANGED, seed: {...STORED.seed, ct: B(48, 13)}}],
    ['the seed IV changed', {...CHANGED, seed: {...STORED.seed, iv: B(12, 14)}}],
    ['the passkey dropped', (({passkey: _p, ...rest}) => rest as Env)(CHANGED)],
    ['the passkey changed', {...CHANGED, passkey: {...PASSKEY, wrapped: B(40, 15)}}],
    ['the accounts reordered', {...CHANGED, accounts: [STORED.accounts[1], STORED.accounts[0]] as Env['accounts']}],
    ['a key changed', {...CHANGED, accounts: [STORED.accounts[0], {index: 1, name: 'Savings', publicKey: K2}] as Env['accounts']}],
    ['an account added', {...CHANGED, accounts: [...STORED.accounts, {index: 2, name: 'Third', publicKey: K2}]}],
    ['the cost changed', {...CHANGED, kdf: {...CHANGED.kdf, t: 4}}],
    // Review M4: one case per remaining clause of onlyPasswordChanged, each differing in that field alone.
    ['the envelope version changed', {...CHANGED, v: 2}],
    ['the KDF algorithm changed', {...CHANGED, kdf: {...CHANGED.kdf, alg: 'scrypt'}}],
    ['the memory cost changed', {...CHANGED, kdf: {...CHANGED.kdf, m: 131072}}],
    ['the parallelism changed', {...CHANGED, kdf: {...CHANGED.kdf, p: 2}}],
    ['the passkey credential changed', {...CHANGED, passkey: {...PASSKEY, credentialId: B(16, 16)}}],
    ['the passkey PRF salt changed', {...CHANGED, passkey: {...PASSKEY, prfSalt: B(32, 17)}}],
    ['an account removed', {...CHANGED, accounts: [STORED.accounts[0]] as Env['accounts']}],
    ['an index changed under the same key', {...CHANGED, accounts: [STORED.accounts[0], {index: 5, name: 'Savings', publicKey: K1}] as Env['accounts']}],
  ];
  for (const [what, env] of refused) {
    it(`malformed: ${what} — nothing is written`, async () => {
      const ext = await stored();
      expect(await changePassword(ext, 1, REV, env)).toBe('malformed');
      expect(await ext.local.get(VAULT_KEY)).toEqual(STORED);
      expect((await readSettings(ext)).passwordChangedAt).toBeNull();
    });
  }

  // Review M4: the shape check (envelopeShape: v 1, alg argon2id) refuses these before the rule runs, so through the message
  // they cannot fail; the rule is exported and its own clauses are held here, directly.
  it('onlyPasswordChanged itself refuses a changed envelope version and a changed KDF algorithm', () => {
    const cur = STORED as unknown as StoredEnvelope;
    expect(onlyPasswordChanged(cur, CHANGED as unknown as StoredEnvelope)).toBe(true);
    expect(onlyPasswordChanged(cur, {...CHANGED, v: 2} as unknown as StoredEnvelope)).toBe(false);
    expect(onlyPasswordChanged(cur, {...CHANGED, kdf: {...CHANGED.kdf, alg: 'scrypt'}} as unknown as StoredEnvelope)).toBe(false);
  });

  it('malformed: the scheme changed (a one-account wallet, so nothing but the scheme differs)', async () => {
    const one = {...STORED, accounts: [STORED.accounts[0]] as Env['accounts']};
    const ext = await stored({env: one});
    const rev = envelopeRevision(one as Parameters<typeof envelopeRevision>[0]);
    expect(await changePassword(ext, 1, rev, {...CHANGED, accounts: one.accounts, scheme: 'cli'})).toBe('malformed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(one);
    expect(await changePassword(ext, 1, rev, {...CHANGED, accounts: one.accounts})).toBe('changed');
  });

  it('a wallet without a passkey: accepted only while the passkey stays absent', async () => {
    const {passkey: _p, ...noPk} = STORED;
    const {passkey: _q, ...changedNoPk} = CHANGED;
    const ext = await stored({env: noPk});
    const rev = envelopeRevision(noPk as Parameters<typeof envelopeRevision>[0]);
    expect(await changePassword(ext, 1, rev, {...changedNoPk, passkey: PASSKEY})).toBe('malformed');
    expect(await changePassword(ext, 1, rev, changedNoPk)).toBe('changed');
  });

  it('busy on a stale revision; locked with no session; no-wallet; stored-invalid; malformed revision or shape', async () => {
    expect(await changePassword(await stored(), 1, 'f'.repeat(64), CHANGED)).toBe('busy');
    expect(await changePassword(await stored({session: false}), 1, REV, CHANGED)).toBe('locked');
    const none = fakeExt();
    await unlocked(none);
    expect(await changePassword(none, 1, REV, CHANGED)).toBe('no-wallet');
    expect(await changePassword(await stored({env: {...STORED, seed: 'x'}}), 1, REV, CHANGED)).toBe('stored-invalid');
    expect(await changePassword(await stored(), 1, 'nope', CHANGED)).toBe('malformed');
    expect(await changePassword(await stored(), 1, REV, {...CHANGED, v: 2})).toBe('malformed');
  });

  it('storeEnvelope still refuses a password change (C2: sameWallet is unchanged)', async () => {
    const ext = await stored();
    expect(await storeEnvelope(ext, REV, CHANGED)).toBe('malformed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(STORED);
  });

  it('the message: only from the vault page (popup, wallet.html and a web origin refused); a storage failure is failed', async () => {
    const msg = {type: 'vault.changePassword', expectedRevision: REV, envelope: CHANGED};
    const popup = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
    const tab = {id: ID, origin: ORIGIN, url: `${ORIGIN}/wallet.html`};
    const web = {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};
    const ext = await stored();
    for (const sender of [popup, tab, web]) expect(await handleMessage(ext, msg, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    expect(await ext.local.get(VAULT_KEY)).toEqual(STORED);
    expect(await handleMessage(ext, msg, unlockPage, fakeDeps())).toEqual({ok: true});
    const broken = await stored();
    broken.local.set = async () => {
      throw new Error('quota');
    };
    expect(await handleMessage(broken, msg, unlockPage, fakeDeps())).toEqual({ok: false, error: 'failed'});
  });
});
````

Modify `extension/src/background/__tests__/messages.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index 34806db..8f6b2ae 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -197,7 +197,7 @@ describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
   // 'unknown type' here, which fails, rather than silently shrinking the test.
   const ALL = [
-    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'activity.ping',
+    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
   ];
````

Create `extension/src/unlock/__tests__/passwordFlow.test.ts`:

````ts
import {addPasskeyWrap, createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {lock} from '../../background/autolock';
import {setSession} from '../../background/session';
import {changePassword, isCurrentPassword, proveCurrent} from '../passwordFlow';
import {harness, testKdf} from './pageHarness';

// B1b-2b E10: the vault page's half of a password change — against the REAL background (pageHarness).
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const OLD = 'correct horse battery';
const NEW = 'a brand new long password';

async function setup(o: {session?: string | null; passkey?: boolean} = {}) {
  let env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: OLD, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf});
  if (o.passkey === true) {
    const dk = await unlockWithPassword(env, OLD, testKdf);
    env = await addPasskeyWrap(env, dk, crypto.getRandomValues(new Uint8Array(32)), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
  }
  const h = await harness({vault: env});
  const session = o.session === undefined ? M : o.session;
  if (session !== null) await setSession(h.ext, await deriveSessionAccounts(session, 'slip10', [0]));
  const deps = {readEnvelope: h.deps.store.readEnvelope, send: h.deps.send};
  return {h, env, deps};
}

describe('proveCurrent (step 1)', () => {
  it('proven: holds the envelope, its revision and the data key — and no phrase', async () => {
    const {deps} = await setup();
    const r = await proveCurrent(deps, OLD, testKdf);
    expect(r.outcome).toBe('proven');
    if (r.outcome !== 'proven') return;
    expect(Object.keys(r.held).sort()).toEqual(['dataKey', 'env', 'revision']);
    expect(JSON.stringify({...r.held, dataKey: null})).not.toContain('abandon');
    expect(Object.isFrozen(r.held)).toBe(true);
    expect(r.held.dataKey).toHaveLength(32);
  });

  it('wrong, not-unlocked, mismatch-locked (the vault locks), damaged, no-wallet', async () => {
    expect((await proveCurrent((await setup()).deps, 'nope nope nope nope', testKdf)).outcome).toBe('wrong');
    expect((await proveCurrent((await setup({session: null})).deps, OLD, testKdf)).outcome).toBe('not-unlocked');
    const mismatch = await setup({session: OTHER});
    expect((await proveCurrent(mismatch.deps, OLD, testKdf)).outcome).toBe('mismatch-locked');
    expect(mismatch.h.sent.map(m => m.type)).toContain('vault.lock');
    const damaged = await setup();
    await damaged.h.ext.local.set(VAULT_KEY, {...damaged.env, seed: 'x'});
    expect((await proveCurrent(damaged.deps, OLD, testKdf)).outcome).toBe('damaged');
    const none = await setup();
    await none.h.ext.local.remove(VAULT_KEY);
    expect((await proveCurrent(none.deps, OLD, testKdf)).outcome).toBe('no-wallet');
  });
});

describe('isCurrentPassword (step 2 `same`, review H2)', () => {
  it('true for the current password, false for another; the KEK is zeroed both ways', async () => {
    const {env} = await setup();
    const keks: Uint8Array[] = [];
    const kdf: typeof testKdf = async (pw, salt, p) => {
      const k = await testKdf(pw, salt, p);
      keks.push(k);
      return k;
    };
    expect(await isCurrentPassword(env, OLD, kdf)).toBe(true);
    expect(await isCurrentPassword(env, NEW, kdf)).toBe(false);
    expect(keks).toHaveLength(2);
    expect(keks.every(k => k.every(b => b === 0))).toBe(true);
  });
});

describe('changePassword (step 3)', () => {
  it('changed: only the salt and the wrap move; the new password opens the wallet, the old does not; the proof is spent', async () => {
    const {h, env, deps} = await setup({passkey: true});
    const r = await proveCurrent(deps, OLD, testKdf);
    if (r.outcome !== 'proven') throw new Error(r.outcome);
    expect(await changePassword({send: h.deps.send, kdf: testKdf}, r.held, NEW)).toBe('changed');
    const after = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(after.seed).toEqual(env.seed);
    expect(after.accounts).toEqual(env.accounts);
    expect(after.passkey).toEqual(env.passkey);
    expect(after.kdf.salt).not.toBe(env.kdf.salt);
    expect(after.password.wrapped).not.toBe(env.password.wrapped);
    expect(await decryptMnemonic(after, await unlockWithPassword(after, NEW, testKdf))).toBe(M);
    await expect(unlockWithPassword(after, OLD, testKdf)).rejects.toThrow();
    expect(r.held.dataKey.every(b => b === 0)).toBe(true);
    expect(await h.ext.local.get('v1_settings')).toMatchObject({passwordChangedAt: h.wallet.now()});
  });

  it('weak-password: nothing is sent, the key is zeroed', async () => {
    const {h, deps} = await setup();
    const r = await proveCurrent(deps, OLD, testKdf);
    if (r.outcome !== 'proven') throw new Error(r.outcome);
    const before = h.sent.length;
    expect(await changePassword({send: h.deps.send, kdf: testKdf}, r.held, 'short')).toBe('weak-password');
    expect(h.sent.length).toBe(before);
    expect(r.held.dataKey.every(b => b === 0)).toBe(true);
  });

  it('busy when the envelope moved after step 1; locked when the session went', async () => {
    const moved = await setup();
    const r1 = await proveCurrent(moved.deps, OLD, testKdf);
    if (r1.outcome !== 'proven') throw new Error(r1.outcome);
    // Another tab enrolled a passkey meanwhile: a new revision.
    const dk = await unlockWithPassword(moved.env, OLD, testKdf);
    await moved.h.ext.local.set(VAULT_KEY, await addPasskeyWrap(moved.env, dk, crypto.getRandomValues(new Uint8Array(32)), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32))));
    expect(await changePassword({send: moved.h.deps.send, kdf: testKdf}, r1.held, NEW)).toBe('busy');

    const locked = await setup();
    const r2 = await proveCurrent(locked.deps, OLD, testKdf);
    if (r2.outcome !== 'proven') throw new Error(r2.outcome);
    await lock(locked.h.ext);
    expect(await changePassword({send: locked.h.deps.send, kdf: testKdf}, r2.held, NEW)).toBe('locked');
    expect(r2.held.dataKey.every(b => b === 0)).toBe(true);
  });
});
````

Create `extension/src/vault/__tests__/rewrapPassword.test.ts`:

````ts
import {vi} from 'vitest';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {WrongPassword, addPasskeyWrap, createEnvelope, decryptMnemonic, rewrapPassword, unlockWithPassword, unlockWithPrf, type Kdf} from '../envelope';

// B1b-2b E10: a new password wrap of the same data key, at the stored cost, proven before it is returned.
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const OLD = 'correct horse battery';
const NEW = 'a brand new long password';
const make = (mnemonic = MNEMONIC) => createEnvelope({mnemonic, password: OLD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});

describe('rewrapPassword', () => {
  it('the new wrap opens with the new password and not the old; the seed still decrypts; the cost is unchanged; the salt is fresh', async () => {
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const {salt, wrapped} = await rewrapPassword(env, dk, NEW, kdf);
    const next = {...env, kdf: {...env.kdf, salt}, password: {wrapped}};
    expect(salt).not.toBe(env.kdf.salt);
    expect(wrapped).not.toBe(env.password.wrapped);
    expect([next.kdf.m, next.kdf.t, next.kdf.p]).toEqual([env.kdf.m, env.kdf.t, env.kdf.p]);
    const opened = await unlockWithPassword(next, NEW, kdf);
    expect(await decryptMnemonic(next, opened)).toBe(MNEMONIC);
    await expect(unlockWithPassword(next, OLD, kdf)).rejects.toBeInstanceOf(WrongPassword);
    // The caller's data key is left as it was (the caller zeroes it).
    expect(dk.some(b => b !== 0)).toBe(true);
  });

  it('uses the stored cost: the KDF is asked for exactly the envelope’s m, t, p', async () => {
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const asked: {m: number; t: number; p: number}[] = [];
    await rewrapPassword(env, dk, NEW, async (pw, salt, params) => (asked.push(params), kdf(pw, salt, params)));
    expect(asked).toEqual([{m: env.kdf.m, t: env.kdf.t, p: env.kdf.p}]);
  });

  it('a passkey wrap keeps working after the password changes (it wraps the same key)', async () => {
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const withPk = await addPasskeyWrap(env, dk, prf, crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
    const {salt, wrapped} = await rewrapPassword(withPk, dk, NEW, kdf);
    const next = {...withPk, kdf: {...withPk.kdf, salt}, password: {wrapped}};
    expect(await decryptMnemonic(next, await unlockWithPrf(next, prf))).toBe(MNEMONIC);
  });

  it('refuses a data key that does not open THIS seed: nothing is returned (the self-check)', async () => {
    const env = await make();
    const other = await make(OTHER);
    const wrongKey = await unlockWithPassword(other, OLD, kdf);
    await expect(rewrapPassword(env, wrongKey, NEW, kdf)).rejects.toThrow();
  });

  it('review M4: refuses a wrap that does not open to the data key it was given — the unwrap half of the self-check', async () => {
    // AES-KW is deterministic, so a correct WebCrypto never produces this; the test makes the platform wrap a DIFFERENT
    // key. The seed half of the self-check alone would pass (it decrypts with the caller's key, not the wrap's).
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const proto = Object.getPrototypeOf(crypto.subtle) as SubtleCrypto;
    const real = proto.wrapKey;
    const stranger = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', true, ['encrypt', 'decrypt']);
    const spy = vi.spyOn(proto, 'wrapKey').mockImplementation(function (this: SubtleCrypto, format, _key, wrappingKey, alg) {
      return real.call(this, format, stranger, wrappingKey, alg);
    });
    try {
      await expect(rewrapPassword(env, dk, NEW, kdf)).rejects.toThrow('does not open to the same data key');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('zeroes the KEK it derived', async () => {
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const keks: Uint8Array[] = [];
    await rewrapPassword(env, dk, NEW, async (pw, salt, params) => {
      const k = await kdf(pw, salt, params);
      keks.push(k);
      return k;
    });
    expect(keks).toHaveLength(1);
    expect(keks[0]?.every(b => b === 0)).toBe(true);
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/changePassword.test.ts src/background/__tests__/messages.test.ts src/unlock/__tests__/passwordFlow.test.ts src/vault/__tests__/rewrapPassword.test.ts
```
Expected (dry run, these test files on Task 2's tree): **red** — Test Files 4 failed (4) · Tests 31 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/background/accountsStore.ts`:

````diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index e7b9ff5..6381343 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -5,7 +5,7 @@ import {lock} from './autolock';
 import {getSession, sessionMutex} from './session';
 import {isOpen, updatePending} from './pendingStore';
 import {KNOWN_RECIPIENTS_KEY} from './knownRecipients';
-import {SETTINGS_KEY} from './settings';
+import {SETTINGS_KEY, updateSettings} from './settings';
 import {clearCaches} from './balanceCache';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, accountsPolicyOk, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
@@ -88,7 +88,7 @@ export async function renameAccount(ext: Ext, index: number, name: string): Prom
 }
 
 export type StoreResult = 'stored' | 'malformed' | 'no-wallet' | 'wallet-exists' | 'busy' | 'stored-invalid';
-type StoredEnvelope = {
+export type StoredEnvelope = {
   v: 1;
   scheme: 'slip10' | 'cli';
   kdf: {alg: 'argon2id'; m: number; t: number; p: number; salt: string};
@@ -229,6 +229,66 @@ export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelop
   });
 }
 
+export type ChangePasswordResult = 'changed' | 'malformed' | 'locked' | 'no-wallet' | 'stored-invalid' | 'busy';
+
+/**
+ * B1b-2b E10 (C2): the one change vault.changePassword may make — a new salt and a new password wrap, nothing else.
+ * Holds exactly when `v`, `scheme` and `kdf.alg/m/t/p` are equal; `kdf.salt` DIFFERS; `password.wrapped` DIFFERS;
+ * `seed.iv` and `seed.ct` are equal; `passkey` is absent in both or equal field by field; and the account list has
+ * the same length with the same `index` and `publicKey` at every position (order included). storeEnvelope's
+ * sameWallet is left unchanged and still refuses any password or KDF change: this narrower rule revisits it without
+ * widening the path every account change and passkey enrolment uses.
+ */
+export function onlyPasswordChanged(current: StoredEnvelope, next: StoredEnvelope): boolean {
+  const a = current.kdf;
+  const b = next.kdf;
+  if (next.v !== current.v || next.scheme !== current.scheme) return false;
+  if (b.alg !== a.alg || b.m !== a.m || b.t !== a.t || b.p !== a.p) return false;
+  if (b.salt === a.salt) return false;
+  if (next.password.wrapped === current.password.wrapped) return false;
+  if (next.seed.iv !== current.seed.iv || next.seed.ct !== current.seed.ct) return false;
+  const p = current.passkey;
+  const q = next.passkey;
+  if ((p === undefined) !== (q === undefined)) return false;
+  if (p !== undefined && q !== undefined && (p.credentialId !== q.credentialId || p.prfSalt !== q.prfSalt || p.wrapped !== q.wrapped)) return false;
+  if (next.accounts.length !== current.accounts.length) return false;
+  return next.accounts.every((x, i) => x.index === current.accounts[i]?.index && x.publicKey === current.accounts[i]?.publicKey);
+}
+
+/**
+ * vault.changePassword (E10, D8, C2). The vault page proved the current password against the session and re-wrapped
+ * the same data key under the new one (rewrapPassword proves the wrap before it is sent); the background cannot check
+ * a password, so it checks what it can: inside `serial` (the mutex every v1_vault write takes) — the shape; an
+ * unlocked session (`locked` otherwise: the proof was against a session that is gone); the stored envelope present
+ * (`no-wallet`), well formed (`stored-invalid`) and at the proven revision (`busy`); onlyPasswordChanged
+ * (`malformed`). The stored names are carried over (names are outside the revision). After the write — best effort,
+ * never undoing it — `passwordChangedAt` is recorded (C10: #31's 36e reads it).
+ */
+export async function changePassword(ext: Ext, now: number, expectedRevision: unknown, envelope: unknown): Promise<ChangePasswordResult> {
+  if (!isStr(expectedRevision) || !REVISION.test(expectedRevision)) return 'malformed';
+  const next = envelopeShape(envelope);
+  if (next === null) return 'malformed';
+  const out = await serial(async (): Promise<ChangePasswordResult> => {
+    if ((await getSession(ext)) === null) return 'locked';
+    const stored = await ext.local.get(VAULT_KEY);
+    if (stored === undefined) return 'no-wallet';
+    const current = envelopeShape(stored);
+    if (current === null) return 'stored-invalid';
+    if (envelopeRevision(current) !== expectedRevision) return 'busy';
+    if (!onlyPasswordChanged(current, next)) return 'malformed';
+    await ext.local.set(VAULT_KEY, {...next, accounts: current.accounts});
+    return 'changed';
+  });
+  if (out === 'changed') {
+    try {
+      await updateSettings(ext, s => ({...s, passwordChangedAt: now}));
+    } catch (e) {
+      console.warn('changePassword: changed, but passwordChangedAt was not recorded', e);
+    }
+  }
+  return out;
+}
+
 export type ForgetResult =
   | 'forgotten'
   | 'malformed'
````

Modify `extension/src/background/messages.ts`:

````diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index 2ea75da..f076289 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -6,7 +6,7 @@ import {getSession, setSessionIf} from './session';
 import {armAutolock, lock} from './autolock';
 import type {WalletDeps} from './deps';
 import {CHALLENGE_ID, challengeInfo, satisfyChallenge} from './reauthChallenges';
-import {forgetWallet, readWalletView, storeEnvelope} from './accountsStore';
+import {changePassword, forgetWallet, readWalletView, storeEnvelope} from './accountsStore';
 import {isOpen, readPending} from './pendingStore';
 import {startPoller} from './pending';
 import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
@@ -26,14 +26,26 @@ export interface Sender {
  * sets — never the URL the message claims, and never "has a tab", which a full-tab
  * extension page also has.
  */
-export const PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'activity.ping', ...WALLET_TYPES] as const;
+export const PRIVILEGED = [
+  'vault.setKeys',
+  'vault.lock',
+  'vault.status',
+  'vault.reauthOk',
+  'vault.storeEnvelope',
+  'vault.challengeInfo',
+  'vault.forgetWallet',
+  'vault.changePassword',
+  'activity.ping',
+  ...WALLET_TYPES,
+] as const;
 /**
  * Only the vault page itself may hand over keys, report a re-authentication it proved, hand over
  * the envelope it re-encrypted (the background is the one writer of v1_vault), or read what a
  * re-authentication is for (vault.challengeInfo, B1b-2a E3), or forget the wallet it proved
- * (vault.forgetWallet, E5): the popup and the tab cannot.
+ * (vault.forgetWallet, E5), or change the password it proved (vault.changePassword, B1b-2b E10): the popup and
+ * the tab cannot.
  */
-const VAULT_PAGE_ONLY: readonly string[] = ['vault.setKeys', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet'];
+const VAULT_PAGE_ONLY: readonly string[] = ['vault.setKeys', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword'];
 export const PAGE: readonly string[] = [];
 
 function isOwnPage(ext: Ext, s: Sender): boolean {
@@ -181,6 +193,16 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       }
       return {ok: true};
     }
+    case 'vault.changePassword': {
+      if (deps === undefined) return {ok: false, error: 'unavailable'};
+      const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
+      try {
+        const r = await changePassword(ext, deps.now(), expectedRevision, envelope);
+        return r === 'changed' ? {ok: true} : {ok: false, error: r};
+      } catch {
+        return {ok: false, error: 'failed'};
+      }
+    }
     case 'vault.storeEnvelope': {
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
       const r = await storeEnvelope(ext, expectedRevision, envelope);
````

Create `extension/src/unlock/passwordFlow.ts`:

````ts
import {WrongPassword, rewrapPassword, unlockWithPassword, type EnvelopeV1, type Kdf} from '../vault/envelope';
import {openProven} from '../vault/reauth';
import {envelopeRevision} from '../shared/envelopeRevision';
import {MIN_PASSWORD_LENGTH} from './onboarding';
import {lockOnMismatch, sessionKeys} from './reauthFlow';
import {storedVault} from './stored';
import type {Send} from './types';

/**
 * #36 change password (spec B1b-2b E10, D8, C2, C20): the vault page's half of vault.changePassword.
 *
 * Step 1 proves the CURRENT password against the session (openProven: a mismatch locks) and yields the data key —
 * held by the screen until step 3 sends, and zeroed on `pagehide`, on leave, after success and at the 5-minute TTL
 * (C20; the screen owns that). Password only (D8): a passkey holder must not take over the password. The phrase that
 * openProven also returns is dropped at once — its reference is neither kept nor returned (a JS string cannot be
 * zeroed; dropping it is the most this can do).
 */
export interface HeldProof {
  /** The envelope the proof opened (a private copy). */
  readonly env: EnvelopeV1;
  /** envelopeRevision(env): what vault.changePassword compares (a concurrent change answers `busy`). */
  readonly revision: string;
  /** The data key. Zeroed by changePassword on every path, or by the screen when it drops the proof. */
  readonly dataKey: Uint8Array;
}

export type ProveOutcome = {outcome: 'proven'; held: HeldProof} | {outcome: 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed'};

/** Step 1: the current password, proven against the session. Never a passkey (D8). */
export async function proveCurrent(deps: {readEnvelope(): Promise<unknown>; send: Send}, password: string, kdf: Kdf): Promise<ProveOutcome> {
  try {
    const stored = storedVault(await deps.readEnvelope());
    if (stored.kind === 'none') return {outcome: 'no-wallet'};
    if (stored.kind === 'damaged') return {outcome: 'damaged'};
    const session = await sessionKeys(deps.send);
    if (session === null) return {outcome: 'not-unlocked'};
    const env = structuredClone(stored.env);
    const proven = await openProven(env, {password, kdf}, session);
    if (proven.outcome === 'mismatch') return {outcome: await lockOnMismatch(deps.send)};
    if (proven.outcome !== 'ok') return {outcome: proven.outcome};
    // Only the data key is kept: `proven.mnemonic` is not read past this line.
    const held: HeldProof = Object.freeze({env: Object.freeze(env), revision: envelopeRevision(env), dataKey: proven.dataKey});
    return {outcome: 'proven', held};
  } catch {
    return {outcome: 'failed'};
  }
}

/**
 * Step 2's `same` check (rev 2, review H2): is `candidate` the CURRENT password? One Argon2id over the candidate with
 * the STORED salt and cost, then the stored wrap: it opens → true; AES-KW refuses → false. Nothing of either password
 * is kept to compare strings; the KEK and the unwrapped key are zeroed (unlockWithPassword zeroes its KEK). Never
 * charged to the backoff (rev 3, review L1): a `true` is the expected way to O02, not a wrong attempt.
 */
export async function isCurrentPassword(env: EnvelopeV1, candidate: string, kdf: Kdf): Promise<boolean> {
  let key: Uint8Array;
  try {
    key = await unlockWithPassword(env, candidate, kdf);
  } catch (e) {
    if (e instanceof WrongPassword) return false;
    throw e;
  }
  key.fill(0);
  return true;
}

/** vault.changePassword's refusals as the page names them, plus `weak-password` (never sent) and `failed`. */
export type ChangeOutcome = 'changed' | 'weak-password' | 'locked' | 'busy' | 'no-wallet' | 'damaged' | 'failed';
const NAMED: readonly string[] = ['locked', 'busy', 'no-wallet'];

/**
 * Step 3: the new password wraps the same data key (rewrapPassword proves the new wrap before it is sent), and the
 * background stores exactly `{kdf.salt, password.wrapped}` changed over the revision step 1 proved (its own rule,
 * onlyPasswordChanged). The data key is zeroed on every path — after this call the proof is spent.
 */
export async function changePassword(deps: {send: Send; kdf: Kdf}, held: HeldProof, newPassword: string): Promise<ChangeOutcome> {
  try {
    if (newPassword.length < MIN_PASSWORD_LENGTH) return 'weak-password';
    const {salt, wrapped} = await rewrapPassword(held.env, held.dataKey, newPassword, deps.kdf);
    const next: EnvelopeV1 = {...held.env, kdf: {...held.env.kdf, salt}, password: {wrapped}};
    const r = await deps.send({type: 'vault.changePassword', expectedRevision: held.revision, envelope: next});
    if (r.ok) return 'changed';
    if (r.error === 'stored-invalid') return 'damaged';
    return (NAMED.find(n => n === r.error) as ChangeOutcome | undefined) ?? 'failed';
  } catch {
    return 'failed';
  } finally {
    held.dataKey.fill(0);
  }
}
````

Modify `extension/src/vault/envelope.ts`:

````diff
diff --git a/extension/src/vault/envelope.ts b/extension/src/vault/envelope.ts
index 8f77c5c..f20ff3a 100644
--- a/extension/src/vault/envelope.ts
+++ b/extension/src/vault/envelope.ts
@@ -282,6 +282,36 @@ export async function addPasskeyWrap(
   }
 }
 
+/**
+ * B1b-2b E10 (D8): a new password wrap of the SAME data key — the change-password step. A fresh 16-byte salt, Argon2id
+ * at the envelope's STORED cost (never a new one: the cost is in the AAD), AES-KW of `dataKey`. Before anything is
+ * returned the new wrap is proven: it unwraps (under the same KEK) to `dataKey` byte for byte, and `dataKey` decrypts
+ * this envelope's seed — so a wrap of the wrong key, which would brick password unlock, is never handed out (as
+ * addPasskeyWrap proves the key first). The seed ciphertext, the IV and the passkey wrap are untouched: the AAD covers
+ * none of the salt and the wraps. Every KEK and copy is zeroed; throws on any mismatch.
+ */
+export async function rewrapPassword(env: EnvelopeV1, dataKey: Uint8Array, password: string, kdf: Kdf): Promise<{salt: string; wrapped: string}> {
+  checkEnvelope(env);
+  assertArrayBufferBacked(dataKey);
+  const salt = random(16);
+  const check = dataKey.slice();
+  let kek: Uint8Array | undefined;
+  let back: Uint8Array | undefined;
+  try {
+    kek = await kdf(password, salt, {m: env.kdf.m, t: env.kdf.t, p: env.kdf.p});
+    assertArrayBufferBacked(kek);
+    const wrapped = await wrap(dataKey, kek);
+    back = await unwrap(wrapped, kek);
+    if (back.length !== dataKey.length || !back.every((b, i) => b === dataKey[i])) throw new Error('rewrapPassword: the new wrap does not open to the same data key');
+    await decryptMnemonic(env, check);
+    return {salt: b64(salt), wrapped};
+  } finally {
+    kek?.fill(0);
+    back?.fill(0);
+    check.fill(0);
+  }
+}
+
 export async function unlockWithPrf(env: EnvelopeV1, prfOutput: Uint8Array): Promise<Uint8Array> {
   checkEnvelope(env);
   if (!env.passkey) throw new WrongPasskey();
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/changePassword.test.ts src/background/__tests__/messages.test.ts src/unlock/__tests__/passwordFlow.test.ts src/vault/__tests__/rewrapPassword.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 4 passed (4) · Tests 65 passed (65); tsc clean; whole suite Test Files 118 passed (118) · Tests 2178 passed (2178); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M3a** — change password keeps the old salt — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (b.salt === a.salt) return false;
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3b** — change password may swap the seed ciphertext — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (next.seed.iv !== current.seed.iv || next.seed.ct !== current.seed.ct) return false;
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 2 failed (Playwright)).

- **M3c** — a session mismatch does not lock — `extension/src/unlock/passwordFlow.ts`:

  ```diff
  - if (proven.outcome === 'mismatch') return {outcome: await lockOnMismatch(deps.send)};
  + if (proven.outcome === 'mismatch') return {outcome: 'wrong'};
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/passwordFlow.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3d** — onlyPasswordChanged: clause v — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (next.v !== current.v || next.scheme !== current.scheme) return false;
  + if (next.scheme !== current.scheme) return false;
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3e** — onlyPasswordChanged: clause scheme — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (next.v !== current.v || next.scheme !== current.scheme) return false;
  + if (next.v !== current.v) return false;
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3f** — onlyPasswordChanged: clause kdf alg — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (b.alg !== a.alg || b.m !== a.m || b.t !== a.t || b.p !== a.p) return false;
  + if (b.m !== a.m || b.t !== a.t || b.p !== a.p) return false;
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3g** — onlyPasswordChanged: clause kdf m — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (b.alg !== a.alg || b.m !== a.m || b.t !== a.t || b.p !== a.p) return false;
  + if (b.alg !== a.alg || b.t !== a.t || b.p !== a.p) return false;
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3h** — onlyPasswordChanged: clause kdf t — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (b.alg !== a.alg || b.m !== a.m || b.t !== a.t || b.p !== a.p) return false;
  + if (b.alg !== a.alg || b.m !== a.m || b.p !== a.p) return false;
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3i** — onlyPasswordChanged: clause kdf p — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (b.alg !== a.alg || b.m !== a.m || b.t !== a.t || b.p !== a.p) return false;
  + if (b.alg !== a.alg || b.m !== a.m || b.t !== a.t) return false;
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3j** — onlyPasswordChanged: clause the wrap must change — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (next.password.wrapped === current.password.wrapped) return false;
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3k** — onlyPasswordChanged: clause seed iv — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (next.seed.iv !== current.seed.iv || next.seed.ct !== current.seed.ct) return false;
  + if (next.seed.ct !== current.seed.ct) return false;
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3l** — onlyPasswordChanged: clause seed ct — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (next.seed.iv !== current.seed.iv || next.seed.ct !== current.seed.ct) return false;
  + if (next.seed.iv !== current.seed.iv) return false;
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3m** — onlyPasswordChanged: clause passkey presence — `extension/src/background/accountsStore.ts`:

  ```diff
  - if ((p === undefined) !== (q === undefined)) return false;
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 2 failed (Playwright)).

- **M3n** — onlyPasswordChanged: clause passkey credentialId — `extension/src/background/accountsStore.ts`:

  ```diff
  - (p.credentialId !== q.credentialId || p.prfSalt !== q.prfSalt || p.wrapped !== q.wrapped)
  + (p.prfSalt !== q.prfSalt || p.wrapped !== q.wrapped)
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3o** — onlyPasswordChanged: clause passkey prfSalt — `extension/src/background/accountsStore.ts`:

  ```diff
  - (p.credentialId !== q.credentialId || p.prfSalt !== q.prfSalt || p.wrapped !== q.wrapped)
  + (p.credentialId !== q.credentialId || p.wrapped !== q.wrapped)
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3p** — onlyPasswordChanged: clause passkey wrapped — `extension/src/background/accountsStore.ts`:

  ```diff
  - (p.credentialId !== q.credentialId || p.prfSalt !== q.prfSalt || p.wrapped !== q.wrapped)
  + (p.credentialId !== q.credentialId || p.prfSalt !== q.prfSalt)
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3q** — onlyPasswordChanged: clause accounts length — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (next.accounts.length !== current.accounts.length) return false;
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3r** — onlyPasswordChanged: clause accounts index — `extension/src/background/accountsStore.ts`:

  ```diff
  - return next.accounts.every((x, i) => x.index === current.accounts[i]?.index && x.publicKey === current.accounts[i]?.publicKey);
  + return next.accounts.every((x, i) => x.publicKey === current.accounts[i]?.publicKey);
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3s** — onlyPasswordChanged: clause accounts publicKey — `extension/src/background/accountsStore.ts`:

  ```diff
  - return next.accounts.every((x, i) => x.index === current.accounts[i]?.index && x.publicKey === current.accounts[i]?.publicKey);
  + return next.accounts.every((x, i) => x.index === current.accounts[i]?.index);
  ```
  `timeout 300 npx vitest run src/background/__tests__/changePassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M3t** — rewrapPassword: the unwrap half of the self-check deleted — `extension/src/vault/envelope.ts`:

  ```diff
  - if (back.length !== dataKey.length || !back.every((b, i) => b === dataKey[i])) throw new Error('rewrapPassword: the new wrap does not open to the same data key');
  + (deleted)
  ```
  `timeout 300 npx vitest run src/vault/__tests__/rewrapPassword.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/changePassword.test.ts extension/src/background/__tests__/messages.test.ts extension/src/background/accountsStore.ts extension/src/background/messages.ts extension/src/unlock/__tests__/passwordFlow.test.ts extension/src/unlock/passwordFlow.ts extension/src/vault/__tests__/rewrapPassword.test.ts extension/src/vault/envelope.ts
git commit -F - <<'MSG'
feat(extension): E10: change password — rewrapPassword, onlyPasswordChanged, vault.changePassword, the vault page's passwordFlow

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 4: E12: `wallet.state.passkey`; `vault.removePasskey`; C3 — a store can never drop a stored passkey

**Spec:** §2 E12, D12, D13, C3, C4

**Files:**
- Modify: `extension/src/background/__tests__/accountsStore.test.ts`
- Modify: `extension/src/background/__tests__/messages.test.ts`
- Create: `extension/src/background/__tests__/removePasskey.test.ts`
- Modify: `extension/src/background/__tests__/walletApi.test.ts`
- Modify: `extension/src/background/accountsStore.ts`
- Modify: `extension/src/background/messages.ts`
- Modify: `extension/src/background/walletApi.ts`
- Create: `extension/src/unlock/__tests__/passkeyFlow.test.ts`
- Create: `extension/src/unlock/passkeyFlow.ts`

**Interfaces:**
- Consumes: `storeEnvelope`, `readWalletView` (`accountsStore.ts`); `proveFactor`/`openProven`; `ReauthFactor` (`src/unlock/types.ts`); `lockOnMismatch`.
- Produces (exact signatures, as exported):
  - `export type RemovePasskeyResult = 'removed' | 'malformed' | 'locked' | 'no-wallet' | 'stored-invalid' | 'busy' | 'no-passkey';`
  - `export async function removePasskey(ext: Ext, expectedRevision: unknown): Promise<RemovePasskeyResult>`
  - `export type RemovePasskeyOutcome = 'removed' | 'no-passkey' | 'busy' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed';`
  - `export async function removePasskey(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RemovePasskeyOutcome>`

The popup learns only whether a passkey is stored (`WalletView.passkey: boolean`, carried by `wallet.state`), never the credential. Removing the passkey is its own message, `vault.removePasskey` (vault page only), at a proven revision: `no-passkey` when none is stored, `busy` on a revision change, `locked` with no session. C3 closes the other door: `storeEnvelope` refuses (`malformed`) any envelope that drops a stored passkey, so only `vault.removePasskey` can. The page's `removePasskey(deps, factor)` proves the factor (password or the passkey itself) against the session, retries once on `busy` (a re-read), and reports `busy` after that; a passkey factor's PRF output is zeroed on every path.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/accountsStore.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/accountsStore.test.ts b/extension/src/background/__tests__/accountsStore.test.ts
index bc840bb..e140eca 100644
--- a/extension/src/background/__tests__/accountsStore.test.ts
+++ b/extension/src/background/__tests__/accountsStore.test.ts
@@ -31,7 +31,7 @@ describe('accountsStore', () => {
     await ext.local.set(VAULT_KEY, {...ENV, accounts: 'x'});
     expect(await readWalletView(ext)).toBeNull();
     await ext.local.set(VAULT_KEY, ENV);
-    expect(await readWalletView(ext)).toEqual({scheme: 'slip10', accounts: ENV.accounts});
+    expect(await readWalletView(ext)).toEqual({scheme: 'slip10', accounts: ENV.accounts, passkey: false});
   });
 
   it('cleanName trims, and refuses empty, long, control and bidi-override names', () => {
````

Modify `extension/src/background/__tests__/messages.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index 8f6b2ae..bc533c9 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -197,7 +197,7 @@ describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
   // 'unknown type' here, which fails, rather than silently shrinking the test.
   const ALL = [
-    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'activity.ping',
+    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'vault.removePasskey', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
   ];
````

Create `extension/src/background/__tests__/removePasskey.test.ts`:

````ts
import {base64} from '@scure/base';
import {VAULT_KEY, readWalletView, removePasskey, storeEnvelope} from '../accountsStore';
import {handleMessage} from '../messages';
import {handleWallet} from '../walletApi';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {unlocked} from './fixtures';

// B1b-2b E12 (D12, C3): the passkey's state in wallet.state, its removal by the background, and storeEnvelope never
// dropping it.
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const PASSKEY = {credentialId: B(16, 7), prfSalt: B(32, 8), wrapped: B(40, 9)};
const WITH = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  passkey: PASSKEY,
  accounts: [{index: 0, name: 'Main', publicKey: K0}],
};
const {passkey: _dropped, ...WITHOUT} = WITH;
const rev = (e: object) => envelopeRevision(e as Parameters<typeof envelopeRevision>[0]);
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};

async function stored(env: object = WITH, session = true) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, env);
  if (session) await unlocked(ext);
  return ext;
}

describe('E12: passkey state and removal', () => {
  it('wallet.state.passkey: true with a passkey, false without one, false without a wallet (answered while locked)', async () => {
    expect((await handleWallet(await stored(WITH, false), fakeDeps(), 'wallet.state', {})).data).toMatchObject({passkey: true, unlocked: false});
    expect((await handleWallet(await stored(WITHOUT, false), fakeDeps(), 'wallet.state', {})).data).toMatchObject({passkey: false});
    expect((await handleWallet(fakeExt(), fakeDeps(), 'wallet.state', {})).data).toMatchObject({hasWallet: false, passkey: false});
    expect(await readWalletView(await stored())).toMatchObject({passkey: true});
  });

  it('removes only the passkey: every other field and every name as stored', async () => {
    const ext = await stored();
    expect(await removePasskey(ext, rev(WITH))).toBe('removed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(WITHOUT);
  });

  it('refusals: no-passkey (nothing written), busy, locked, no-wallet, stored-invalid, malformed', async () => {
    const none = await stored(WITHOUT);
    expect(await removePasskey(none, rev(WITHOUT))).toBe('no-passkey');
    expect(await none.local.get(VAULT_KEY)).toEqual(WITHOUT);
    expect(await removePasskey(await stored(), rev(WITHOUT))).toBe('busy');
    expect(await removePasskey(await stored(WITH, false), rev(WITH))).toBe('locked');
    const empty = fakeExt();
    await unlocked(empty);
    expect(await removePasskey(empty, rev(WITH))).toBe('no-wallet');
    expect(await removePasskey(await stored({...WITH, seed: 7}), rev(WITH))).toBe('stored-invalid');
    expect(await removePasskey(await stored(), 'x')).toBe('malformed');
  });

  it('C3: storeEnvelope refuses an envelope that drops the stored passkey, and accepts one that replaces it', async () => {
    const ext = await stored();
    const added = {...WITH, seed: {iv: B(12, 5), ct: B(48, 6)}, accounts: [...WITH.accounts, {index: 1, name: 'Two', publicKey: K1}]};
    const {passkey: _p, ...addedWithout} = added;
    expect(await storeEnvelope(ext, rev(WITH), addedWithout)).toBe('malformed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(WITH);
    const replaced = {...WITH, passkey: {...PASSKEY, credentialId: B(20, 1), wrapped: B(40, 2)}};
    expect(await storeEnvelope(ext, rev(WITH), replaced)).toBe('stored');
    // Carried (an account change with the passkey kept) stays accepted too.
    const carried = {...replaced, seed: {iv: B(12, 5), ct: B(48, 6)}, accounts: added.accounts};
    expect(await storeEnvelope(ext, rev(replaced), carried)).toBe('stored');
  });

  it('the message: vault page only (popup, wallet.html and a web origin refused); a storage failure is failed', async () => {
    const msg = {type: 'vault.removePasskey', expectedRevision: rev(WITH)};
    const ext = await stored();
    for (const sender of [
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`},
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/wallet.html`},
      {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0},
    ]) {
      expect(await handleMessage(ext, msg, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await ext.local.get(VAULT_KEY)).toEqual(WITH);
    expect(await handleMessage(ext, msg, unlockPage, fakeDeps())).toEqual({ok: true});
    const broken = await stored();
    broken.local.set = async () => {
      throw new Error('quota');
    };
    expect(await handleMessage(broken, msg, unlockPage, fakeDeps())).toEqual({ok: false, error: 'failed'});
  });
});
````

Modify `extension/src/background/__tests__/walletApi.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/walletApi.test.ts b/extension/src/background/__tests__/walletApi.test.ts
index 54c8b7e..02ab435 100644
--- a/extension/src/background/__tests__/walletApi.test.ts
+++ b/extension/src/background/__tests__/walletApi.test.ts
@@ -25,13 +25,13 @@ const NOC = WALLET_TOKENS.NOC.mint as string;
 describe('handleWallet', () => {
   it('wallet.state: public account data, lock state and the selected account', async () => {
     const ext = fakeExt();
-    expect(await handleWallet(ext, fakeDeps(), 'wallet.state', {})).toEqual({ok: true, data: {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null}});
+    expect(await handleWallet(ext, fakeDeps(), 'wallet.state', {})).toEqual({ok: true, data: {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null, passkey: false}});
     await ext.local.set(VAULT_KEY, ENV);
     await unlocked(ext);
     await ext.local.set(SETTINGS_KEY, {selectedAccount: 3});
     await setSession(ext, [ACCOUNT, OTHER]);
     const r = await handleWallet(ext, fakeDeps(), 'wallet.state', {});
-    expect(r).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 3}});
+    expect(r).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 3, passkey: false}});
     expect(JSON.stringify(r)).not.toContain('secretKey');
   });
````

Create `extension/src/unlock/__tests__/passkeyFlow.test.ts`:

````ts
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {removePasskey} from '../passkeyFlow';
import type {Send} from '../types';
import {harness, testKdf} from './pageHarness';

// B1b-2b E12: removing the passkey from the vault page, against the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const PRF = crypto.getRandomValues(new Uint8Array(32));

async function setup(o: {session?: string | null; passkey?: boolean; send?: (inner: Send) => Send} = {}) {
  let env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf});
  if (o.passkey !== false) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), PRF.slice(), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: env, ...(o.send === undefined ? {} : {send: o.send})});
  const session = o.session === undefined ? M : o.session;
  if (session !== null) await setSession(h.ext, await deriveSessionAccounts(session, 'slip10', [0]));
  return {h, env, deps: {readEnvelope: h.deps.store.readEnvelope, send: h.deps.send}};
}
const stored = async (h: {ext: {local: {get(k: string): Promise<unknown>}}}) => (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;

describe('removePasskey (E12)', () => {
  it('by password: removed; the envelope keeps every other field; the message carries only the revision', async () => {
    const {h, env, deps} = await setup();
    expect(await removePasskey(deps, {password: PW, kdf: testKdf})).toBe('removed');
    const {passkey: _p, ...rest} = env;
    expect(await stored(h)).toEqual(rest);
    const msg = h.sent.find(m => m.type === 'vault.removePasskey');
    expect(Object.keys(msg ?? {}).sort()).toEqual(['expectedRevision', 'type']);
  });

  it('by the passkey itself: removed, and the PRF output is zeroed', async () => {
    const {h, deps} = await setup();
    const prfOutput = PRF.slice();
    expect(await removePasskey(deps, {prfOutput})).toBe('removed');
    expect(prfOutput.every(b => b === 0)).toBe(true);
    expect((await stored(h)).passkey).toBeUndefined();
  });

  it('a mismatch locks the vault and removes nothing', async () => {
    const {h, deps} = await setup({session: OTHER});
    expect(await removePasskey(deps, {password: PW, kdf: testKdf})).toBe('mismatch-locked');
    expect((await stored(h)).passkey).toBeDefined();
    expect(h.sent.map(m => m.type)).toContain('vault.lock');
  });

  it('wrong, not-unlocked, no-passkey; the PRF output zeroed on a refusal too', async () => {
    expect(await removePasskey((await setup()).deps, {password: 'nope nope nope nope', kdf: testKdf})).toBe('wrong');
    const locked = await setup({session: null});
    const prfOutput = PRF.slice();
    expect(await removePasskey(locked.deps, {prfOutput})).toBe('not-unlocked');
    expect(prfOutput.every(b => b === 0)).toBe(true);
    expect(await removePasskey((await setup({passkey: false})).deps, {password: PW, kdf: testKdf})).toBe('no-passkey');
  });

  it('busy once: the whole flow runs again (a fresh read and proof); busy twice is `busy`', async () => {
    let busy = 1;
    const once = await setup({send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' && busy-- > 0 ? {ok: false, error: 'busy'} : inner(m))});
    expect(await removePasskey(once.deps, {password: PW, kdf: testKdf})).toBe('removed');
    expect(once.h.sent.filter(m => m.type === 'vault.status')).toHaveLength(2);
    const always = await setup({send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' ? {ok: false, error: 'busy'} : inner(m))});
    expect(await removePasskey(always.deps, {password: PW, kdf: testKdf})).toBe('busy');
    expect((await stored(always.h)).passkey).toBeDefined();
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/accountsStore.test.ts src/background/__tests__/messages.test.ts src/background/__tests__/removePasskey.test.ts src/background/__tests__/walletApi.test.ts src/unlock/__tests__/passkeyFlow.test.ts
```
Expected (dry run, these test files on Task 3's tree): **red** — Test Files 5 failed (5) · Tests 8 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/background/accountsStore.ts`:

````diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index 6381343..4bfa780 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -29,6 +29,8 @@ export interface AccountView {
 export interface WalletView {
   scheme: 'slip10' | 'cli';
   accounts: AccountView[];
+  /** B1b-2b E12: whether the stored envelope has a passkey wrap (#31's and #35's "Passkey · On/Off"). */
+  passkey: boolean;
 }
 
 const serial = createMutex();
@@ -45,12 +47,12 @@ function accountsOf(env: Json): AccountView[] | null {
   return out;
 }
 
-/** Public data only: the scheme and each account's index, name and address. Null without a wallet. */
+/** Public data only: the scheme, each account's index, name and address, and whether a passkey is enrolled. Null without a wallet. */
 export async function readWalletView(ext: Ext): Promise<WalletView | null> {
   const env = await ext.local.get(VAULT_KEY);
   if (!isObj(env) || (env.scheme !== 'slip10' && env.scheme !== 'cli')) return null;
   const accounts = accountsOf(env);
-  return accounts === null ? null : {scheme: env.scheme, accounts};
+  return accounts === null ? null : {scheme: env.scheme, accounts, passkey: isObj(env.passkey)};
 }
 
 export type RenameResult = 'renamed' | 'malformed' | 'unknown-account' | 'busy';
@@ -208,6 +210,9 @@ export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelop
       if (current === null) return 'stored-invalid';
       if (envelopeRevision(current) !== expectedRevision) return 'busy';
       if (!sameWallet(current, next)) return 'malformed';
+      // B1b-2b C3: a stored passkey may be replaced (addPasskey) or carried (an account change), never dropped
+      // here — removal is vault.removePasskey's alone, so a page bug that omitted the field cannot disable it.
+      if (current.passkey !== undefined && next.passkey === undefined) return 'malformed';
       for (const a of current.accounts) names.set(a.index, a.name);
     }
     const accounts: AccountView[] = [];
@@ -229,6 +234,32 @@ export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelop
   });
 }
 
+export type RemovePasskeyResult = 'removed' | 'malformed' | 'locked' | 'no-wallet' | 'stored-invalid' | 'busy' | 'no-passkey';
+
+/**
+ * vault.removePasskey (B1b-2b E12, D12, C3). The vault page proved a factor (password or the passkey itself) against
+ * the session and sends only the revision it proved — no envelope: the background drops the `passkey` field itself and
+ * writes every other field and every name as stored, so a removal can carry no other change. Removal only takes a
+ * factor away, and the passkey is outside the AAD (no re-encryption). The authenticator keeps the credential; the
+ * page says so. Inside `serial`: `malformed` (revision), `locked` (no session), `no-wallet`, `stored-invalid`, `busy`
+ * (another change landed: the page re-proves), `no-passkey` (nothing to remove; nothing written).
+ */
+export async function removePasskey(ext: Ext, expectedRevision: unknown): Promise<RemovePasskeyResult> {
+  if (!isStr(expectedRevision) || !REVISION.test(expectedRevision)) return 'malformed';
+  return serial(async () => {
+    if ((await getSession(ext)) === null) return 'locked';
+    const stored = await ext.local.get(VAULT_KEY);
+    if (stored === undefined) return 'no-wallet';
+    const current = envelopeShape(stored);
+    if (current === null) return 'stored-invalid';
+    if (envelopeRevision(current) !== expectedRevision) return 'busy';
+    if (current.passkey === undefined) return 'no-passkey';
+    const {v, scheme, kdf, seed, password, accounts} = current;
+    await ext.local.set(VAULT_KEY, {v, scheme, kdf, seed, password, accounts});
+    return 'removed';
+  });
+}
+
 export type ChangePasswordResult = 'changed' | 'malformed' | 'locked' | 'no-wallet' | 'stored-invalid' | 'busy';
 
 /**
````

Modify `extension/src/background/messages.ts`:

````diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index f076289..1935971 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -6,7 +6,7 @@ import {getSession, setSessionIf} from './session';
 import {armAutolock, lock} from './autolock';
 import type {WalletDeps} from './deps';
 import {CHALLENGE_ID, challengeInfo, satisfyChallenge} from './reauthChallenges';
-import {changePassword, forgetWallet, readWalletView, storeEnvelope} from './accountsStore';
+import {changePassword, forgetWallet, readWalletView, removePasskey, storeEnvelope} from './accountsStore';
 import {isOpen, readPending} from './pendingStore';
 import {startPoller} from './pending';
 import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
@@ -35,6 +35,7 @@ export const PRIVILEGED = [
   'vault.challengeInfo',
   'vault.forgetWallet',
   'vault.changePassword',
+  'vault.removePasskey',
   'activity.ping',
   ...WALLET_TYPES,
 ] as const;
@@ -42,10 +43,18 @@ export const PRIVILEGED = [
  * Only the vault page itself may hand over keys, report a re-authentication it proved, hand over
  * the envelope it re-encrypted (the background is the one writer of v1_vault), or read what a
  * re-authentication is for (vault.challengeInfo, B1b-2a E3), or forget the wallet it proved
- * (vault.forgetWallet, E5), or change the password it proved (vault.changePassword, B1b-2b E10): the popup and
- * the tab cannot.
+ * (vault.forgetWallet, E5), change the password it proved (vault.changePassword, B1b-2b E10) or remove the passkey
+ * (vault.removePasskey, E12): the popup and the tab cannot.
  */
-const VAULT_PAGE_ONLY: readonly string[] = ['vault.setKeys', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword'];
+const VAULT_PAGE_ONLY: readonly string[] = [
+  'vault.setKeys',
+  'vault.reauthOk',
+  'vault.storeEnvelope',
+  'vault.challengeInfo',
+  'vault.forgetWallet',
+  'vault.changePassword',
+  'vault.removePasskey',
+];
 export const PAGE: readonly string[] = [];
 
 function isOwnPage(ext: Ext, s: Sender): boolean {
@@ -203,6 +212,15 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
         return {ok: false, error: 'failed'};
       }
     }
+    case 'vault.removePasskey': {
+      const {expectedRevision} = msg as {expectedRevision?: unknown};
+      try {
+        const r = await removePasskey(ext, expectedRevision);
+        return r === 'removed' ? {ok: true} : {ok: false, error: r};
+      } catch {
+        return {ok: false, error: 'failed'};
+      }
+    }
     case 'vault.storeEnvelope': {
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
       const r = await storeEnvelope(ext, expectedRevision, envelope);
````

Modify `extension/src/background/walletApi.ts`:

````diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
index 4f91eba..16fe0d2 100644
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -111,7 +111,7 @@ export function displayOrder<T extends {index: number}>(accounts: readonly T[],
 
 async function walletState(ext: Ext) {
   const [view, session, settings] = await Promise.all([readWalletView(ext), getSession(ext), readSettings(ext)]);
-  if (view === null) return {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null};
+  if (view === null) return {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null, passkey: false};
   const accounts = displayOrder(view.accounts, settings.accountOrder);
   // The selection is only ever an account that exists: in the envelope, and — while unlocked — in the
   // session too (an account removed in the vault page must not stay selected). Otherwise the first such
@@ -119,7 +119,7 @@ async function walletState(ext: Ext) {
   const inSession = (i: number) => session === null || session.some(a => a.index === i);
   const choices = accounts.map(a => a.index).filter(inSession);
   const selected = choices.includes(settings.selectedAccount) ? settings.selectedAccount : (choices[0] ?? accounts[0]?.index ?? null);
-  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts, selected};
+  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts, selected, passkey: view.passkey};
 }
 
 /** Balances for onboarding's candidate addresses: public keys in, public numbers out. */
````

Create `extension/src/unlock/passkeyFlow.ts`:

````ts
import {openProven, type ReauthFactor} from '../vault/reauth';
import {envelopeRevision} from '../shared/envelopeRevision';
import {lockOnMismatch, sessionKeys} from './reauthFlow';
import {storedVault} from './stored';
import type {Send} from './types';

export type RemovePasskeyOutcome = 'removed' | 'no-passkey' | 'busy' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed';
const NAMED: readonly string[] = ['no-passkey', 'no-wallet'];

/** One attempt: read, prove against the session, send the revision proven. `retry`: the envelope moved (busy). */
async function attempt(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RemovePasskeyOutcome | 'retry'> {
  const stored = storedVault(await deps.readEnvelope());
  if (stored.kind === 'none') return 'no-wallet';
  if (stored.kind === 'damaged') return 'damaged';
  const session = await sessionKeys(deps.send);
  if (session === null) return 'not-unlocked';
  const proven = await openProven(stored.env, factor, session);
  if (proven.outcome === 'mismatch') return lockOnMismatch(deps.send);
  if (proven.outcome !== 'ok') return proven.outcome;
  // Nothing of the proof is needed past this line: the background drops the field itself (E12).
  proven.dataKey.fill(0);
  const r = await deps.send({type: 'vault.removePasskey', expectedRevision: envelopeRevision(stored.env)});
  if (r.ok) return 'removed';
  if (r.error === 'busy') return 'retry';
  if (r.error === 'stored-invalid') return 'damaged';
  if (r.error === 'locked') return 'not-unlocked';
  return (NAMED.find(n => n === r.error) as RemovePasskeyOutcome | undefined) ?? 'failed';
}

/**
 * #6 "manage" → remove (spec B1b-2b E12, D12): the password or the passkey itself proves the wallet against the session
 * (openProven: a mismatch locks), then vault.removePasskey with the proven revision — the page sends no envelope. On
 * `busy` (another change landed) the whole flow runs once more with a fresh read and a fresh proof; a second `busy` is
 * the outcome `busy` (review L1: the wallet changed — "Start again"). A PRF output is zeroed on every path.
 */
export async function removePasskey(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RemovePasskeyOutcome> {
  try {
    for (let i = 0; i < 2; i++) {
      const out = await attempt(deps, factor);
      if (out !== 'retry') return out;
    }
    return 'busy';
  } catch {
    return 'failed';
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/accountsStore.test.ts src/background/__tests__/messages.test.ts src/background/__tests__/removePasskey.test.ts src/background/__tests__/walletApi.test.ts src/unlock/__tests__/passkeyFlow.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 5 passed (5) · Tests 89 passed (89); tsc clean; whole suite Test Files 120 passed (120) · Tests 2188 passed (2188); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M4a** — C3: a store may drop a stored passkey — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (current.passkey !== undefined && next.passkey === undefined) return 'malformed';
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/removePasskey.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M4b** — remove with no passkey stored writes — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (current.passkey === undefined) return 'no-passkey';
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/removePasskey.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/accountsStore.test.ts extension/src/background/__tests__/messages.test.ts extension/src/background/__tests__/removePasskey.test.ts extension/src/background/__tests__/walletApi.test.ts extension/src/background/accountsStore.ts extension/src/background/messages.ts extension/src/background/walletApi.ts extension/src/unlock/__tests__/passkeyFlow.test.ts extension/src/unlock/passkeyFlow.ts
git commit -F - <<'MSG'
feat(extension): E12: wallet.state.passkey; vault.removePasskey; C3 — a store can never drop a stored passkey

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 5: E13: re-add an account at a chosen index; C5 — an open send refuses removing its account

**Spec:** §2 E13, D14, D16, C5; O36, O37

**Files:**
- Create: `extension/src/background/__tests__/storeSendOpen.test.ts`
- Modify: `extension/src/background/accountsStore.ts`
- Modify: `extension/src/unlock/__tests__/accountsFlow.test.ts`
- Modify: `extension/src/unlock/__tests__/stored.test.ts`
- Modify: `extension/src/unlock/accountsFlow.ts`
- Modify: `extension/src/unlock/screens/accounts.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/types.ts`
- Modify: `extension/src/unlock/vaultStore.ts`

**Interfaces:**
- Consumes: `storeEnvelope` and `readPending`/`isOpen`; `accountsFlow.ts` (2a); `ACCOUNTS` strings; `vaultStore.ts`'s `NAMED`.
- Produces (exact signatures, as exported):
  - `export type StoreResult = 'stored' | 'malformed' | 'no-wallet' | 'wallet-exists' | 'busy' | 'stored-invalid' | 'send-open';`
  - `export const MAX_ACCOUNT_INDEX = 2 ** 31 - 1;`
  - `export const isAccountIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= MAX_ACCOUNT_INDEX;`
  - `export function lowestFreeIndex(indexes: readonly number[]): number`
  - `export function addAccount(deps: Deps, factor: ReauthFactor, index: number): Promise<AccountsOutcome>`
  - `export type StoreOutcome = 'stored' | 'busy' | 'wallet-exists' | 'stored-invalid' | 'malformed' | 'no-wallet' | 'send-open' | 'failed';`

`addAccount(deps, factor, index)` takes the index the page shows (pre-filled with the lowest free one; spec §3.6): an index that is not an integer in [0, 2³¹−1] is `bad-index` **before anything is proven** (the PRF output zeroed), an index already in the envelope is `index-taken`. Re-adding a removed index derives the same address. C5: `storeEnvelope` refuses with `send-open` when the new envelope drops an account that has an open pending send (`isOpen`) — the background decides, so no page can race it.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/__tests__/storeSendOpen.test.ts`:

````ts
import {base64} from '@scure/base';
import {VAULT_KEY, storeEnvelope} from '../accountsStore';
import {PENDING_KEY} from '../pendingStore';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeExt} from './fakeExt';
import {pendingRecord} from './fixtures';

// B1b-2b C5: storeEnvelope refuses to drop an account whose send is still open — in the background, because the vault
// page cannot read v1_pending.
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const K2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const THREE = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [
    {index: 0, name: 'A', publicKey: K0},
    {index: 1, name: 'B', publicKey: K1},
    {index: 2, name: 'C', publicKey: K2},
  ],
};
const REV = envelopeRevision(THREE as Parameters<typeof envelopeRevision>[0]);
const reencrypted = (accounts: typeof THREE.accounts) => ({...THREE, seed: {iv: B(12, 5), ct: B(48, 6)}, accounts});
const WITHOUT_1 = reencrypted([THREE.accounts[0]!, THREE.accounts[2]!]);

async function wallet(records: object[]) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, THREE);
  await ext.local.set(PENDING_KEY, records);
  return ext;
}

describe('storeEnvelope: C5 send-open', () => {
  it('refuses a store that drops an account with a pending or stuck send; nothing is written', async () => {
    for (const state of ['pending', 'stuck'] as const) {
      const ext = await wallet([pendingRecord({account: K1, state})]);
      expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('send-open');
      expect(await ext.local.get(VAULT_KEY)).toEqual(THREE);
    }
  });

  it('accepts it once the send is closed (confirmed, failed, expired)', async () => {
    for (const state of ['confirmed', 'failed', 'expired'] as const) {
      const ext = await wallet([pendingRecord({account: K1, state})]);
      expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('stored');
    }
  });

  it('an open send from an account the change KEEPS does not refuse it — whichever account is selected', async () => {
    const ext = await wallet([pendingRecord({account: K0}), pendingRecord({id: 'r2', account: K2})]);
    expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('stored');
  });

  it('an open send from a dropped account refuses even when another account’s send is open too', async () => {
    const ext = await wallet([pendingRecord({account: K0}), pendingRecord({id: 'r2', account: K1})]);
    expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('send-open');
  });

  it('adding an account while a send is open is fine (nothing dropped)', async () => {
    const two = {...THREE, accounts: THREE.accounts.slice(0, 2)};
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, two);
    await ext.local.set(PENDING_KEY, [pendingRecord({account: K1})]);
    expect(await storeEnvelope(ext, envelopeRevision(two as Parameters<typeof envelopeRevision>[0]), reencrypted(THREE.accounts))).toBe('stored');
  });
});
````

Modify `extension/src/unlock/__tests__/accountsFlow.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/accountsFlow.test.ts b/extension/src/unlock/__tests__/accountsFlow.test.ts
index 7f21881..2664ce7 100644
--- a/extension/src/unlock/__tests__/accountsFlow.test.ts
+++ b/extension/src/unlock/__tests__/accountsFlow.test.ts
@@ -6,7 +6,7 @@ import {deriveSessionAccounts} from '../../vault/accounts';
 import {envelopeRevision} from '../../shared/envelopeRevision';
 import {MAX_ACCOUNTS} from '../../shared/envelopeRules';
 import {storeEnvelope} from '../../background/accountsStore';
-import {addAccount, removeAccount} from '../accountsFlow';
+import {addAccount, isAccountIndex, lowestFreeIndex, removeAccount} from '../accountsFlow';
 import type {Send, VaultStore} from '../types';
 import {memoryVault} from './memoryVault';
 
@@ -42,7 +42,7 @@ async function wallet(indexes: number[], scheme: 'slip10' | 'cli' = 'slip10', se
 describe('accounts in the vault page', () => {
   it('adds the next SLIP-0010 account: re-encrypted under the same password, stored over the opened revision, new keys handed over (positive control)', async () => {
     const {deps, store, sent, opened} = await wallet([0]);
-    expect(await addAccount(deps, {password: PASSWORD, kdf})).toBe('done');
+    expect(await addAccount(deps, {password: PASSWORD, kdf}, 1)).toBe('done');
     expect(store.calls).toEqual([{expectedRevision: envelopeRevision(opened), outcome: 'stored'}]);
     const env = store.writes[0]!;
     const expected = await deriveSessionAccounts(MNEMONIC, 'slip10', [0, 1]);
@@ -74,14 +74,14 @@ describe('accounts in the vault page', () => {
     expect(refused.sent.map(m => m.type)).toEqual(['vault.status', 'vault.setKeys', 'vault.lock']);
     expect((await refused.store.stored())?.accounts.map(a => a.index)).toEqual([0]);
     const neither = await wallet([0], 'slip10', MNEMONIC, undefined, type => ({ok: type !== 'vault.setKeys' && type !== 'vault.lock'}));
-    expect(await addAccount(neither.deps, {password: PASSWORD, kdf})).toBe('done-not-locked');
+    expect(await addAccount(neither.deps, {password: PASSWORD, kdf}, 1)).toBe('done-not-locked');
     expect(neither.sent.map(m => m.type)).toEqual(['vault.status', 'vault.setKeys', 'vault.lock']);
     expect((await neither.store.stored())?.accounts.map(a => a.index)).toEqual([0, 1]);
   });
 
   it(`refuses an account past MAX_ACCOUNTS (${MAX_ACCOUNTS}) by name, before re-encrypting`, async () => {
     const full = await wallet(Array.from({length: MAX_ACCOUNTS}, (_, i) => i));
-    expect(await addAccount(full.deps, {password: PASSWORD, kdf})).toBe('too-many-accounts');
+    expect(await addAccount(full.deps, {password: PASSWORD, kdf}, 1)).toBe('too-many-accounts');
     expect(full.store.calls).toHaveLength(0);
     expect(full.sent.map(m => m.type)).toEqual(['vault.status']);
     // Deriving 100 keys takes ~6 s under a parallel run's CPU load — past vitest's 5 s default.
@@ -89,33 +89,33 @@ describe('accounts in the vault page', () => {
 
   it('a cli wallet has exactly one account', async () => {
     const cli = await wallet([0], 'cli');
-    expect(await addAccount(cli.deps, {password: PASSWORD, kdf})).toBe('cli-single');
+    expect(await addAccount(cli.deps, {password: PASSWORD, kdf}, 1)).toBe('cli-single');
     expect(cli.store.calls).toHaveLength(0);
   });
 
   it('a wrong password changes nothing; a proof mismatch locks the vault and changes nothing', async () => {
     const w = await wallet([0]);
-    expect(await addAccount(w.deps, {password: 'nope nope nope nope', kdf})).toBe('wrong');
+    expect(await addAccount(w.deps, {password: 'nope nope nope nope', kdf}, 1)).toBe('wrong');
     expect(w.store.calls).toHaveLength(0);
     const foreign = await wallet([0], 'slip10', OTHER);
-    expect(await addAccount(foreign.deps, {password: PASSWORD, kdf})).toBe('mismatch-locked');
+    expect(await addAccount(foreign.deps, {password: PASSWORD, kdf}, 1)).toBe('mismatch-locked');
     expect(foreign.sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
     expect(foreign.store.calls).toHaveLength(0);
   });
 
   it('busy: the whole flow runs again once — a fresh read and a fresh proof — and stores over the NEW revision', async () => {
     const {deps, store, opened, sent} = await wallet([0]);
-    // Another tab adds account 1 between this flow's read and its store.
+    // Another tab adds account 3 between this flow's read and its store.
     let moved = '';
     store.setBeforeStore(async call => {
       if (call !== 0) return;
       const dk = await unlockWithPassword(opened, PASSWORD, kdf);
-      const next = await reencryptForAccounts(opened, dk, [{index: 0, name: 'Account 1'}, {index: 1, name: 'Account 2'}]);
+      const next = await reencryptForAccounts(opened, dk, [{index: 0, name: 'Account 1'}, {index: 2, name: 'Account 3'}]);
       dk.fill(0);
       moved = envelopeRevision(next);
       expect(await storeEnvelope(store.ext, envelopeRevision(opened), next)).toBe('stored');
     });
-    expect(await addAccount(deps, {password: PASSWORD, kdf})).toBe('done');
+    expect(await addAccount(deps, {password: PASSWORD, kdf}, 1)).toBe('done');
     expect(store.calls).toEqual([
       {expectedRevision: envelopeRevision(opened), outcome: 'busy'},
       {expectedRevision: moved, outcome: 'stored'},
@@ -123,8 +123,52 @@ describe('accounts in the vault page', () => {
     // Ours twice (the proof is re-run, not skipped), the other tab's once.
     expect(kdfCalls).toBe(3);
     expect(sent.filter(m => m.type === 'vault.status')).toHaveLength(2);
-    // The second attempt built on the other tab's envelope: 0, 1, and the new 2.
-    expect((await store.stored())?.accounts.map(a => a.index)).toEqual([0, 1, 2]);
+    // The second attempt built on the other tab's envelope: 0, 2, and ours appended — 1.
+    expect((await store.stored())?.accounts.map(a => a.index)).toEqual([0, 2, 1]);
+  });
+
+  it('B1b-2b E13: re-adding a removed middle account brings back the same address (explicit index, C6)', async () => {
+    const three = await wallet([0, 1, 2]);
+    const before = (await three.store.stored())!.accounts.find(a => a.index === 1)!.publicKey;
+    expect(await removeAccount(three.deps, {password: PASSWORD, kdf}, 1)).toBe('done');
+    expect((await three.store.stored())?.accounts.map(a => a.index)).toEqual([0, 2]);
+    expect(await addAccount(three.deps, {password: PASSWORD, kdf}, 1)).toBe('done');
+    const after = (await three.store.stored())!;
+    expect(after.accounts.map(a => a.index)).toEqual([0, 2, 1]);
+    expect(after.accounts.find(a => a.index === 1)).toEqual({index: 1, name: 'Account 2', publicKey: before});
+  });
+
+  it('B1b-2b E13: index-taken after a proof; bad-index before anything (no read, no proof, PRF zeroed)', async () => {
+    const two = await wallet([0, 1]);
+    expect(await addAccount(two.deps, {password: PASSWORD, kdf}, 1)).toBe('index-taken');
+    expect(two.store.calls).toHaveLength(0);
+    for (const bad of [-1, 1.5, 2 ** 31, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
+      const w = await wallet([0]);
+      const prfOutput = crypto.getRandomValues(new Uint8Array(32));
+      expect(await addAccount(w.deps, {prfOutput}, bad)).toBe('bad-index');
+      expect(prfOutput.every(b => b === 0)).toBe(true);
+      expect(w.sent).toEqual([]);
+      expect(kdfCalls).toBe(0);
+    }
+    // The hardened limit itself is an account number.
+    expect(isAccountIndex(2 ** 31 - 1)).toBe(true);
+    expect(isAccountIndex(2 ** 31)).toBe(false);
+  });
+
+  it('C6: lowestFreeIndex', () => {
+    expect(lowestFreeIndex([0])).toBe(1);
+    expect(lowestFreeIndex([0, 2])).toBe(1);
+    expect(lowestFreeIndex([1, 2])).toBe(0);
+    expect(lowestFreeIndex([0, 1, 2])).toBe(3);
+    expect(lowestFreeIndex([])).toBe(0);
+  });
+
+  it('C5: a remove the background refuses as send-open is `send-open`, and nothing changes', async () => {
+    const two = await wallet([0, 1]);
+    const refusing = vi.fn<VaultStore['storeEnvelope']>(async () => 'send-open');
+    expect(await removeAccount({...two.deps, storeEnvelope: refusing}, {password: PASSWORD, kdf}, 1)).toBe('send-open');
+    expect(refusing).toHaveBeenCalledTimes(1);
+    expect(two.sent.filter(m => m.type === 'vault.setKeys')).toHaveLength(0);
   });
 
   it('a passkey factor survives the retry and is zeroed only at the end', async () => {
@@ -138,7 +182,7 @@ describe('accounts in the vault page', () => {
       await storeEnvelope(store.ext, envelopeRevision(opened), next);
     });
     const prfOutput = prf.slice();
-    expect(await addAccount(deps, {prfOutput})).toBe('done');
+    expect(await addAccount(deps, {prfOutput}, 1)).toBe('done');
     expect(store.calls.map(c => c.outcome)).toEqual(['busy', 'stored']);
     expect(prfOutput.every(b => b === 0)).toBe(true);
   });
@@ -146,14 +190,14 @@ describe('accounts in the vault page', () => {
   it('busy twice gives up; a stored envelope the background cannot read is damaged, not retried; neither hands over keys', async () => {
     const {deps, sent} = await wallet([0]);
     const busy = vi.fn<VaultStore['storeEnvelope']>(async () => 'busy');
-    expect(await addAccount({...deps, storeEnvelope: busy}, {password: PASSWORD, kdf})).toBe('failed');
+    expect(await addAccount({...deps, storeEnvelope: busy}, {password: PASSWORD, kdf}, 1)).toBe('failed');
     expect(busy).toHaveBeenCalledTimes(2);
     expect(kdfCalls).toBe(2);
     const invalid = vi.fn<VaultStore['storeEnvelope']>(async () => 'stored-invalid');
-    expect(await addAccount({...deps, storeEnvelope: invalid}, {password: PASSWORD, kdf})).toBe('damaged');
+    expect(await addAccount({...deps, storeEnvelope: invalid}, {password: PASSWORD, kdf}, 1)).toBe('damaged');
     expect(invalid).toHaveBeenCalledTimes(1);
     const gone = vi.fn<VaultStore['storeEnvelope']>(async () => 'no-wallet');
-    expect(await addAccount({...deps, storeEnvelope: gone}, {password: PASSWORD, kdf})).toBe('no-wallet');
+    expect(await addAccount({...deps, storeEnvelope: gone}, {password: PASSWORD, kdf}, 1)).toBe('no-wallet');
     expect(sent.filter(m => m.type === 'vault.setKeys')).toHaveLength(0);
   });
 
@@ -168,7 +212,7 @@ describe('accounts in the vault page', () => {
     try {
       const ok = await wallet([0]);
       const refused = await wallet([0, 1]);
-      expect(await addAccount(ok.deps, {password: PASSWORD, kdf})).toBe('done');
+      expect(await addAccount(ok.deps, {password: PASSWORD, kdf}, 1)).toBe('done');
       expect(await removeAccount({...refused.deps, storeEnvelope: async () => 'busy'}, {password: PASSWORD, kdf}, 1)).toBe('failed');
       expect(await removeAccount({...refused.deps, storeEnvelope: async () => 'malformed'}, {password: PASSWORD, kdf}, 1)).toBe('failed');
       // One for the add, two for the busy remove (the proof re-run), one for the refused remove.
````

Modify `extension/src/unlock/__tests__/stored.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/stored.test.ts b/extension/src/unlock/__tests__/stored.test.ts
index f703750..9a79b06 100644
--- a/extension/src/unlock/__tests__/stored.test.ts
+++ b/extension/src/unlock/__tests__/stored.test.ts
@@ -141,7 +141,7 @@ describe('every page flow reads a stored null as a damaged wallet, never as "no
     const randomBytes = (n: number) => new Uint8Array(n);
     const credentials = {create: async () => null, get: async () => null};
     expect(await addPasskey({...store, credentials, randomBytes}, {password: PASSWORD, kdf})).toBe('damaged');
-    expect(await addAccount({...store, send}, {password: PASSWORD, kdf})).toBe('damaged');
+    expect(await addAccount({...store, send}, {password: PASSWORD, kdf}, 1)).toBe('damaged');
     expect(await runReveal({readEnvelope: store.readEnvelope, send}, {password: PASSWORD, kdf})).toEqual({outcome: 'damaged'});
     expect(await runReauth({readEnvelope: store.readEnvelope, send}, ID, {password: PASSWORD, kdf})).toBe('damaged');
     expect(sent).toEqual([]);
@@ -152,7 +152,7 @@ describe('every page flow reads a stored null as a damaged wallet, never as "no
   it('an absent vault is still "no wallet" (negative control of the rule above)', async () => {
     const store = await memoryVault();
     const {send} = recorder();
-    expect(await addAccount({...store, send}, {password: PASSWORD, kdf})).toBe('no-wallet');
+    expect(await addAccount({...store, send}, {password: PASSWORD, kdf}, 1)).toBe('no-wallet');
     expect(await runReveal({readEnvelope: store.readEnvelope, send}, {password: PASSWORD, kdf})).toEqual({outcome: 'no-wallet'});
     expect(await runReauth({readEnvelope: store.readEnvelope, send}, ID, {password: PASSWORD, kdf})).toBe('no-wallet');
   });
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/storeSendOpen.test.ts src/unlock/__tests__/accountsFlow.test.ts src/unlock/__tests__/stored.test.ts
```
Expected (dry run, these test files on Task 4's tree): **red** — Test Files 2 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/background/accountsStore.ts`:

````diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index 4bfa780..d033deb 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -3,7 +3,7 @@ import type {WalletDeps} from './deps';
 import {createMutex} from './mutex';
 import {lock} from './autolock';
 import {getSession, sessionMutex} from './session';
-import {isOpen, updatePending} from './pendingStore';
+import {isOpen, readPending, updatePending} from './pendingStore';
 import {KNOWN_RECIPIENTS_KEY} from './knownRecipients';
 import {SETTINGS_KEY, updateSettings} from './settings';
 import {clearCaches} from './balanceCache';
@@ -89,7 +89,7 @@ export async function renameAccount(ext: Ext, index: number, name: string): Prom
   });
 }
 
-export type StoreResult = 'stored' | 'malformed' | 'no-wallet' | 'wallet-exists' | 'busy' | 'stored-invalid';
+export type StoreResult = 'stored' | 'malformed' | 'no-wallet' | 'wallet-exists' | 'busy' | 'stored-invalid' | 'send-open';
 export type StoredEnvelope = {
   v: 1;
   scheme: 'slip10' | 'cli';
@@ -213,6 +213,11 @@ export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelop
       // B1b-2b C3: a stored passkey may be replaced (addPasskey) or carried (an account change), never dropped
       // here — removal is vault.removePasskey's alone, so a page bug that omitted the field cannot disable it.
       if (current.passkey !== undefined && next.passkey === undefined) return 'malformed';
+      // B1b-2b C5: an account this change drops must have no open send — its key leaves the session, and the poller
+      // would watch a send it could never re-send. The vault page cannot read v1_pending; this is the guard.
+      const kept = new Set(next.accounts.map(a => a.index));
+      const dropped = new Set(current.accounts.filter(a => !kept.has(a.index)).map(a => a.publicKey));
+      if (dropped.size > 0 && (await readPending(ext)).some(r => isOpen(r) && dropped.has(r.account))) return 'send-open';
       for (const a of current.accounts) names.set(a.index, a.name);
     }
     const accounts: AccountView[] = [];
````

Modify `extension/src/unlock/accountsFlow.ts`:

````diff
diff --git a/extension/src/unlock/accountsFlow.ts b/extension/src/unlock/accountsFlow.ts
index 5720fa5..204d077 100644
--- a/extension/src/unlock/accountsFlow.ts
+++ b/extension/src/unlock/accountsFlow.ts
@@ -21,8 +21,26 @@ export type AccountsOutcome =
   | 'last-account'
   | 'no-such-account'
   | 'too-many-accounts'
+  /** B1b-2b E13: the account number is not one (not a safe integer in 0 … 2^31 − 1). */
+  | 'bad-index'
+  /** B1b-2b E13: that account is already in the envelope. */
+  | 'index-taken'
+  /** B1b-2b C5: a send from an account this change drops is still open (the background refused the store). */
+  | 'send-open'
   | 'failed';
 
+/** The SLIP-0010 hardened limit of the account level (m/44'/501'/{account}'/0'): the highest index there is. */
+export const MAX_ACCOUNT_INDEX = 2 ** 31 - 1;
+export const isAccountIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= MAX_ACCOUNT_INDEX;
+
+/** C6: the lowest account index not in the list — what the add form pre-fills, so "add it again" is the default after a remove. */
+export function lowestFreeIndex(indexes: readonly number[]): number {
+  const taken = new Set(indexes);
+  let i = 0;
+  while (taken.has(i)) i += 1;
+  return i;
+}
+
 type Deps = VaultStore & {send: Send};
 /** The new account list: indexes and names only — reencryptForAccounts derives every public key. */
 type Named = {index: number; name: string}[];
@@ -49,6 +67,7 @@ async function attempt(deps: Deps, factor: ReauthFactor, change: (env: EnvelopeV
     const reencrypted = await reencryptForAccounts(env, proven.dataKey, next);
     const stored = await deps.storeEnvelope(envelopeRevision(env), reencrypted);
     if (stored === 'busy') return 'busy';
+    if (stored === 'send-open') return 'send-open';
     if (stored === 'stored-invalid') return 'damaged';
     if (stored === 'no-wallet') return 'no-wallet';
     if (stored !== 'stored') return 'failed';
@@ -97,16 +116,27 @@ async function withProvenSeed(deps: Deps, factor: ReauthFactor, change: (env: En
   }
 }
 
-/** The next SLIP-0010 account (a cli wallet has exactly one). */
-export function addAccount(deps: Deps, factor: ReauthFactor): Promise<AccountsOutcome> {
+/**
+ * B1b-2b E13 (D16, C6): the SLIP-0010 account at `index` — any index not in the envelope, so an account removed earlier
+ * can be added again: reencryptForAccounts derives its key from the seed, so re-adding index N always yields the address
+ * N had (with the default name "Account N+1": a removed account's name is not kept, review L3). Appended to the
+ * envelope order (the display order is E14's). A bad index is refused before anything is read or proven; a cli wallet
+ * has exactly one account. A PRF output is zeroed on every path, a bad index included.
+ */
+export function addAccount(deps: Deps, factor: ReauthFactor, index: number): Promise<AccountsOutcome> {
+  if (!isAccountIndex(index)) {
+    if ('prfOutput' in factor) factor.prfOutput.fill(0);
+    return Promise.resolve('bad-index');
+  }
   return withProvenSeed(deps, factor, env => {
     if (env.scheme === 'cli') return 'cli-single';
     if (env.accounts.length >= MAX_ACCOUNTS) return 'too-many-accounts';
-    const next = Math.max(...env.accounts.map(a => a.index)) + 1;
-    return [...env.accounts.map(a => ({index: a.index, name: a.name})), {index: next, name: `Account ${next + 1}`}];
+    if (env.accounts.some(a => a.index === index)) return 'index-taken';
+    return [...env.accounts.map(a => ({index: a.index, name: a.name})), {index, name: `Account ${index + 1}`}];
   });
 }
 
+/** Removing an account (D16): allowed with funds (they stay on Solana); refused by the background while a send from it is open (C5). */
 export function removeAccount(deps: Deps, factor: ReauthFactor, index: number): Promise<AccountsOutcome> {
   return withProvenSeed(deps, factor, env => {
     if (!env.accounts.some(a => a.index === index)) return 'no-such-account';
````

Modify `extension/src/unlock/screens/accounts.ts`:

````diff
diff --git a/extension/src/unlock/screens/accounts.ts b/extension/src/unlock/screens/accounts.ts
index 96bd9d8..67bb0fe 100644
--- a/extension/src/unlock/screens/accounts.ts
+++ b/extension/src/unlock/screens/accounts.ts
@@ -1,4 +1,5 @@
-import {addAccount, removeAccount} from '../accountsFlow';
+import {addAccount, lowestFreeIndex, removeAccount} from '../accountsFlow';
+import {storedVault} from '../stored';
 import {createWrongBackoff} from '../orchestrate';
 import {exclusive, type PageDeps} from '../page';
 import {ACCOUNTS, COMMON} from '../strings';
@@ -33,7 +34,9 @@ export function mountAccounts(deps: PageDeps): {show(): void} {
     void exclusive(deps, render, async () => {
       const f = factor();
       say(ACCOUNTS.adding);
-      say(ACCOUNTS.outcome[await backoff.run(() => addAccount(store, f), () => say(COMMON.waitConfirm))]);
+      const stored = storedVault(await deps.store.readEnvelope());
+      const index = lowestFreeIndex(stored.kind === 'wallet' ? stored.env.accounts.map(a => a.index) : []);
+      say(ACCOUNTS.outcome[await backoff.run(() => addAccount(store, f, index), () => say(COMMON.waitConfirm))]);
     });
   deps.gate.onIdle(render);
   add.addEventListener('click', doAdd);
````

Modify `extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 26e858e..1a4c27b 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -189,6 +189,12 @@ export const ACCOUNTS = {
     'last-account': 'The last account cannot be removed.',
     'no-such-account': 'There is no account with that number.',
     'too-many-accounts': 'This wallet already has the most accounts it can hold.',
+    /** O37 (B1b-2b E13). */
+    'bad-index': 'That is not an account number.',
+    /** O36 (B1b-2b E13). */
+    'index-taken': 'That account is already in this wallet.',
+    /** B1b-2b C5: RESTORE `sendOpen` (2a) → adapted, "wallet" → "account" (§3.6). */
+    'send-open': 'A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.',
     failed: 'Something went wrong.',
   },
 } as const;
````

Modify `extension/src/unlock/types.ts`:

````diff
diff --git a/extension/src/unlock/types.ts b/extension/src/unlock/types.ts
index 916638a..503d2fc 100644
--- a/extension/src/unlock/types.ts
+++ b/extension/src/unlock/types.ts
@@ -7,7 +7,7 @@ export type Send = (m: unknown) => Promise<{ok: boolean; error?: string; data?:
  * The background's answer to vault.storeEnvelope (src/background/accountsStore.ts), plus 'failed'
  * for anything else: an error it does not name, or a message that never came back.
  */
-export type StoreOutcome = 'stored' | 'busy' | 'wallet-exists' | 'stored-invalid' | 'malformed' | 'no-wallet' | 'failed';
+export type StoreOutcome = 'stored' | 'busy' | 'wallet-exists' | 'stored-invalid' | 'malformed' | 'no-wallet' | 'send-open' | 'failed';
 
 /**
  * The envelope in storage.local. The vault page reads it (shared/readLocal) and never writes it: the
````

Modify `extension/src/unlock/vaultStore.ts`:

````diff
diff --git a/extension/src/unlock/vaultStore.ts b/extension/src/unlock/vaultStore.ts
index da1a123..2521b9b 100644
--- a/extension/src/unlock/vaultStore.ts
+++ b/extension/src/unlock/vaultStore.ts
@@ -1,7 +1,7 @@
 import type {EnvelopeV1} from '../vault/envelope';
 import type {Send, StoreOutcome, VaultStore} from './types';
 
-const NAMED: readonly StoreOutcome[] = ['busy', 'wallet-exists', 'stored-invalid', 'malformed', 'no-wallet'];
+const NAMED: readonly StoreOutcome[] = ['busy', 'wallet-exists', 'stored-invalid', 'malformed', 'no-wallet', 'send-open'];
 
 /**
  * The vault page's VaultStore: reads with the reader it is given, stores by sending
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/storeSendOpen.test.ts src/unlock/__tests__/accountsFlow.test.ts src/unlock/__tests__/stored.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 3 passed (3) · Tests 34 passed (34); tsc clean; whole suite Test Files 121 passed (121) · Tests 2197 passed (2197); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M5a** — C5: an open send does not block dropping its account — `extension/src/background/accountsStore.ts`:

  ```diff
  - if (dropped.size > 0 && (await readPending(ext)).some(r => isOpen(r) && dropped.has(r.account))) return 'send-open';
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/storeSendOpen.test.ts` — Expected: **red** (dry run: 2 failed (Playwright)).

- **M5b** — re-add over an existing index — `extension/src/unlock/accountsFlow.ts`:

  ```diff
  - if (env.accounts.some(a => a.index === index)) return 'index-taken';
  + (deleted)
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/accountsFlow.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M5c** — the hardened-index ceiling — `extension/src/unlock/accountsFlow.ts`:

  ```diff
  - x >= 0 && x <= MAX_ACCOUNT_INDEX
  + x >= 0
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/accountsFlow.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/storeSendOpen.test.ts extension/src/background/accountsStore.ts extension/src/unlock/__tests__/accountsFlow.test.ts extension/src/unlock/__tests__/stored.test.ts extension/src/unlock/accountsFlow.ts extension/src/unlock/screens/accounts.ts extension/src/unlock/strings.ts extension/src/unlock/types.ts extension/src/unlock/vaultStore.ts
git commit -F - <<'MSG'
feat(extension): E13: re-add an account at a chosen index; C5 — an open send refuses removing its account

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 6: E15 `vault.phraseVerified` (C8); E11 `deleteWallet` over a factor proof; E16 reveal is password-only

**Spec:** §2 E11, E15, E16, D23, C8, C17

**Files:**
- Modify: `extension/src/background/__tests__/messages.test.ts`
- Create: `extension/src/background/__tests__/phraseVerified.test.ts`
- Modify: `extension/src/background/messages.ts`
- Modify: `extension/src/unlock/__tests__/create.test.ts`
- Create: `extension/src/unlock/__tests__/deleteWallet.test.ts`
- Modify: `extension/src/unlock/__tests__/import.test.ts`
- Modify: `extension/src/unlock/__tests__/revealFlow.test.ts`
- Modify: `extension/src/unlock/forgetFlow.ts`
- Modify: `extension/src/unlock/revealFlow.ts`
- Modify: `extension/src/unlock/screens/createRun.ts`

**Interfaces:**
- Consumes: `forget` (internal, `forgetFlow.ts`), `proveFactor`, `minted`; `runReveal` (2a); `createRun.ts`; Task 1's `updateSettings`.
- Produces (exact signatures, as exported):
  - `export type DeleteOutcome = 'deleted' | 'send-open' | 'busy' | 'unlocked' | 'no-wallet' | 'damaged' | 'failed';`
  - `export async function deleteWallet(send: Send, proof: FactorProof): Promise<DeleteOutcome>`
  - `export async function runReveal(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: {password: string; kdf: Kdf}): Promise<RevealOutcome>`
  - `export async function recordVerified(send: Send): Promise<boolean>`

Three small engine pieces the vault modes need. **E15/C8:** `vault.phraseVerified` (vault page only, a session required) stamps `phraseVerifiedAt`; onboarding's create run sends it once the wallet is `created` (the three-word check already passed), so a fresh wallet starts verified. **E11:** `deleteWallet(send, proof)` — the only caller of `vault.forgetWallet` besides the 2a flows — takes a `FactorProof` minted by `proveFactor` (no session needed: a locked wallet can be deleted with its password) and sends its revision; a seed proof or a forged object is `failed`. **E16/D23:** `runReveal` takes `{password, kdf}` only — a passkey cannot show the phrase; a passkey-shaped factor reaching it at runtime is refused and its PRF output zeroed.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/messages.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index bc533c9..38a76e6 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -197,7 +197,7 @@ describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
   // 'unknown type' here, which fails, rather than silently shrinking the test.
   const ALL = [
-    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'vault.removePasskey', 'activity.ping',
+    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'vault.removePasskey', 'vault.phraseVerified', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
   ];
````

Create `extension/src/background/__tests__/phraseVerified.test.ts`:

````ts
import {base64} from '@scure/base';
import {VAULT_KEY, forgetWallet, storeEnvelope} from '../accountsStore';
import {handleMessage} from '../messages';
import {readSettings, updateSettings} from '../settings';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, unlocked} from './fixtures';

// B1b-2b E15 (D15, C8): vault.phraseVerified records a fact — vault page only, refused while locked; kept by the
// changes that keep the wallet, cleared by a delete and a first write.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};
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
const zero = () => fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});

describe('vault.phraseVerified (E15)', () => {
  it('sets phraseVerifiedAt to now; refused while locked (nothing written)', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    expect(await handleMessage(ext, {type: 'vault.phraseVerified'}, unlockPage, deps)).toEqual({ok: false, error: 'locked'});
    expect((await readSettings(ext)).phraseVerifiedAt).toBeNull();
    await unlocked(ext);
    deps.clock.t = 777;
    expect(await handleMessage(ext, {type: 'vault.phraseVerified'}, unlockPage, deps)).toEqual({ok: true});
    expect((await readSettings(ext)).phraseVerifiedAt).toBe(777);
  });

  it('only from the vault page: the popup, wallet.html and a web origin are refused', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    for (const sender of [
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`},
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/wallet.html`},
      {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0},
    ]) {
      expect(await handleMessage(ext, {type: 'vault.phraseVerified'}, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
    expect((await readSettings(ext)).phraseVerifiedAt).toBeNull();
  });

  it('kept by a restore (a forget with a replacement); cleared by a delete and by a first write', async () => {
    const replacement = {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}};
    const kept = fakeExt();
    await kept.local.set(VAULT_KEY, STORED);
    await updateSettings(kept, s => ({...s, phraseVerifiedAt: 5}));
    expect(await forgetWallet(kept, fakeDeps({reader: zero()}), {expectedRevision: REV, replacement})).toBe('forgotten');
    expect((await readSettings(kept)).phraseVerifiedAt).toBe(5);

    const deleted = fakeExt();
    await deleted.local.set(VAULT_KEY, STORED);
    await updateSettings(deleted, s => ({...s, phraseVerifiedAt: 5}));
    expect(await forgetWallet(deleted, fakeDeps({reader: zero()}), {expectedRevision: REV})).toBe('forgotten');
    expect((await readSettings(deleted)).phraseVerifiedAt).toBeNull();

    const first = fakeExt();
    await updateSettings(first, s => ({...s, phraseVerifiedAt: 5}));
    expect(await storeEnvelope(first, null, STORED)).toBe('stored');
    expect((await readSettings(first)).phraseVerifiedAt).toBeNull();
  });
});
````

Modify `extension/src/unlock/__tests__/create.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/create.test.ts b/extension/src/unlock/__tests__/create.test.ts
index 698feff..f4c4066 100644
--- a/extension/src/unlock/__tests__/create.test.ts
+++ b/extension/src/unlock/__tests__/create.test.ts
@@ -929,6 +929,10 @@ describe('the create run, end to end in one page, against the real background',
     expect((await getSession(h.ext))?.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
     // H2: the phrase is dropped once stored; #5's password is held for #6 only.
     expect(run.holds()).toEqual({phrase: false, password: true});
+    // B1b-2b C8 (E15): the phrase passed #4 — recorded once the wallet is stored and its keys handed over.
+    const types = h.sent.map(m => m.type);
+    expect(types.indexOf('vault.phraseVerified')).toBeGreaterThan(types.indexOf('vault.setKeys'));
+    expect(await h.ext.local.get('v1_settings')).toMatchObject({phraseVerifiedAt: h.wallet.now()});
     // No word of the phrase is left in the DOM — text or attribute: #3 and #4 took theirs out when the run moved on.
     expect(leaked()).toEqual([]);
     await press(h, 'pk-skip');
````

Create `extension/src/unlock/__tests__/deleteWallet.test.ts`:

````ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {derivePublicKeys} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {SETTINGS_KEY} from '../../background/settings';
import {PENDING_KEY} from '../../background/pendingStore';
import {FORBIDDEN_UNTIL_KEY} from '../../background/deps';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {pendingRecord} from '../../background/__tests__/fixtures';
import {deleteWallet, proveFactor, proveSeed, type FactorProof} from '../forgetFlow';
import type {Send} from '../types';

// B1b-2b E11: #37's delete — a factor proof, then ONE vault.forgetWallet with neither `replacement` nor `guard`, against
// the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PW = 'correct horse battery';
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const UNLOCK = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});

async function background(o: {funded?: boolean; pending?: boolean} = {}) {
  const keys = await derivePublicKeys(M, 'slip10', [0]);
  const env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: keys[0] ?? ''}], kdf});
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, env);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: keys[0], at: 1}]);
  await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 2});
  await ext.local.set(FORBIDDEN_UNTIL_KEY, 9);
  if (o.pending === true) await ext.local.set(PENDING_KEY, [pendingRecord({account: keys[0]})]);
  // A funded wallet: the C6 guard would refuse it — #37's delete sends no guard (D11).
  const reader = fakeReader({getBalance: async () => (o.funded === true ? 5_000_000_000n : 0n), getTokenAccountsByOwner: async () => []});
  const deps = fakeDeps({reader});
  const sent: {type: string; [k: string]: unknown}[] = [];
  const send: Send = async m => {
    sent.push(JSON.parse(JSON.stringify(m)) as {type: string});
    return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK, deps)) as {ok: boolean; error?: string};
  };
  return {ext, send, sent, read: () => ext.local.get(VAULT_KEY)};
}
async function proof(b: Awaited<ReturnType<typeof background>>): Promise<FactorProof> {
  const r = await proveFactor(b.read, {password: PW, kdf});
  if (r.outcome !== 'proven') throw new Error(r.outcome);
  return r.proof;
}

describe('deleteWallet (E11)', () => {
  it('a funded wallet is deleted: one forget with neither replacement nor guard; the wipe list; v1_forbidden_until kept', async () => {
    const b = await background({funded: true});
    expect(await deleteWallet(b.send, await proof(b))).toBe('deleted');
    const forgets = b.sent.filter(m => m.type === 'vault.forgetWallet');
    expect(forgets).toHaveLength(1);
    expect(Object.keys(forgets[0] ?? {}).sort()).toEqual(['expectedRevision', 'type']);
    expect(await b.read()).toBeUndefined();
    expect(await b.ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
    expect(await b.ext.local.get(SETTINGS_KEY)).toBeUndefined();
    expect(await b.ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(9);
  });

  it('refuses an unminted proof and a seed proof: nothing is sent', async () => {
    const b = await background();
    const forged = Object.freeze({kind: 'factor', revision: (await proof(b)).revision}) as FactorProof;
    expect(await deleteWallet(b.send, forged)).toBe('failed');
    const seed = await proveSeed(b.read, M);
    if (seed.outcome !== 'match') throw new Error(seed.outcome);
    expect(await deleteWallet(b.send, seed.proof as unknown as FactorProof)).toBe('failed');
    expect(b.sent.filter(m => m.type === 'vault.forgetWallet')).toHaveLength(0);
    expect(await b.read()).toBeDefined();
  });

  it('send-open: refused, the vault intact (the background locked the wallet)', async () => {
    const b = await background({pending: true});
    expect(await deleteWallet(b.send, await proof(b))).toBe('send-open');
    expect(await b.read()).toBeDefined();
  });

  it('maps every refusal: busy, unlocked, no-wallet, damaged (stored-invalid), and the guard-only codes as failed', async () => {
    const b = await background();
    const p = await proof(b);
    for (const [error, out] of [
      ['busy', 'busy'],
      ['unlocked', 'unlocked'],
      ['no-wallet', 'no-wallet'],
      ['stored-invalid', 'damaged'],
      ['send-open', 'send-open'],
      ['funded', 'failed'],
      ['unreachable', 'failed'],
      ['coordinator-refused', 'failed'],
      ['something-else', 'failed'],
    ] as const) {
      expect(await deleteWallet(async () => ({ok: false, error}), p)).toBe(out);
    }
    expect(
      await deleteWallet(async () => {
        throw new Error('gone');
      }, p),
    ).toBe('failed');
  });
});
````

Modify `extension/src/unlock/__tests__/import.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/import.test.ts b/extension/src/unlock/__tests__/import.test.ts
index fd5ffe4..8ed8230 100644
--- a/extension/src/unlock/__tests__/import.test.ts
+++ b/extension/src/unlock/__tests__/import.test.ts
@@ -391,6 +391,8 @@ describe('#8 → #5 → #40: the plain import run, against the real background',
     expect(el('imp-grid').children).toHaveLength(0);
     await setPassword(h);
     expect(h.went).toEqual(['wallet.html#/imported']);
+    // B1b-2b C8: a pasted phrase proves nothing about a written copy — no phraseVerified on import.
+    expect(h.sent.map(m => m.type)).not.toContain('vault.phraseVerified');
     const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
     expect(env.accounts.map(a => a.publicKey)).toEqual([K0]);
     expect(await decryptMnemonic(env, await unlockWithPassword(env, PW, testKdf))).toBe(M);
````

Modify `extension/src/unlock/__tests__/revealFlow.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/revealFlow.test.ts b/extension/src/unlock/__tests__/revealFlow.test.ts
index 607804f..38372d7 100644
--- a/extension/src/unlock/__tests__/revealFlow.test.ts
+++ b/extension/src/unlock/__tests__/revealFlow.test.ts
@@ -2,7 +2,7 @@ import {argon2idAsync} from '@noble/hashes/argon2.js';
 import {createEnvelope, type Kdf} from '../../vault/envelope';
 import * as envelopeModule from '../../vault/envelope';
 import {deriveSessionAccounts} from '../../vault/accounts';
-import {runReveal} from '../revealFlow';
+import {recordVerified, runReveal} from '../revealFlow';
 import type {Send} from '../types';
 
 const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
@@ -53,9 +53,34 @@ describe('runReveal (spec §2: the phrase, only after a proof, only in the vault
     const foreign = await setup(OTHER);
     expect(await runReveal(foreign.deps, {password: PASSWORD, kdf})).toEqual({outcome: 'mismatch-locked'});
     expect(foreign.sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
+    expect(await runReveal((await setup(null)).deps, {password: PASSWORD, kdf})).toEqual({outcome: 'not-unlocked'});
+  });
+
+  it('B1b-2b E16 (D23): a passkey factor cast past the type is refused — failed, nothing read or sent, the PRF output zeroed', async () => {
+    const {deps, sent} = await setup(MNEMONIC);
+    let reads = 0;
     const prfOutput = crypto.getRandomValues(new Uint8Array(32));
-    expect(await runReveal((await setup(null)).deps, {prfOutput})).toEqual({outcome: 'not-unlocked'});
+    const factor = {prfOutput} as unknown as {password: string; kdf: Kdf};
+    expect(await runReveal({...deps, readEnvelope: async () => (reads++, deps.readEnvelope())}, factor)).toEqual({outcome: 'failed'});
     expect(prfOutput.every(b => b === 0)).toBe(true);
+    expect(reads).toBe(0);
+    expect(sent).toEqual([]);
+    // Even beside a password: any prfOutput refuses.
+    const both = {password: PASSWORD, kdf, prfOutput: crypto.getRandomValues(new Uint8Array(32))};
+    expect(await runReveal(deps, both)).toEqual({outcome: 'failed'});
+    expect(both.prfOutput.every(b => b === 0)).toBe(true);
+  });
+
+  it('recordVerified: sends only the fact (no word of the phrase); true when the background says so', async () => {
+    const {deps, sent} = await setup(MNEMONIC);
+    expect(await recordVerified(deps.send)).toBe(true);
+    expect(sent).toEqual([{type: 'vault.phraseVerified'}]);
+    expect(await recordVerified(async () => ({ok: false, error: 'locked'}))).toBe(false);
+    expect(
+      await recordVerified(async () => {
+        throw new Error('gone');
+      }),
+    ).toBe(false);
   });
 
   it('no wallet, and a damaged envelope, show nothing', async () => {
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/messages.test.ts src/background/__tests__/phraseVerified.test.ts src/unlock/__tests__/create.test.ts src/unlock/__tests__/deleteWallet.test.ts src/unlock/__tests__/import.test.ts src/unlock/__tests__/revealFlow.test.ts
```
Expected (dry run, these test files on Task 5's tree): **red** — Test Files 5 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/background/messages.ts`:

````diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index 1935971..cdbdfe1 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -4,6 +4,7 @@ import type {Ext} from '../ext';
 import type {SessionAccount} from '../vault/accounts';
 import {getSession, setSessionIf} from './session';
 import {armAutolock, lock} from './autolock';
+import {updateSettings} from './settings';
 import type {WalletDeps} from './deps';
 import {CHALLENGE_ID, challengeInfo, satisfyChallenge} from './reauthChallenges';
 import {changePassword, forgetWallet, readWalletView, removePasskey, storeEnvelope} from './accountsStore';
@@ -36,6 +37,7 @@ export const PRIVILEGED = [
   'vault.forgetWallet',
   'vault.changePassword',
   'vault.removePasskey',
+  'vault.phraseVerified',
   'activity.ping',
   ...WALLET_TYPES,
 ] as const;
@@ -44,7 +46,8 @@ export const PRIVILEGED = [
  * the envelope it re-encrypted (the background is the one writer of v1_vault), or read what a
  * re-authentication is for (vault.challengeInfo, B1b-2a E3), or forget the wallet it proved
  * (vault.forgetWallet, E5), change the password it proved (vault.changePassword, B1b-2b E10) or remove the passkey
- * (vault.removePasskey, E12): the popup and the tab cannot.
+ * (vault.removePasskey, E12), or record that the phrase was verified (vault.phraseVerified, E15): the popup and the
+ * tab cannot.
  */
 const VAULT_PAGE_ONLY: readonly string[] = [
   'vault.setKeys',
@@ -54,6 +57,7 @@ const VAULT_PAGE_ONLY: readonly string[] = [
   'vault.forgetWallet',
   'vault.changePassword',
   'vault.removePasskey',
+  'vault.phraseVerified',
 ];
 export const PAGE: readonly string[] = [];
 
@@ -221,6 +225,18 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
         return {ok: false, error: 'failed'};
       }
     }
+    case 'vault.phraseVerified': {
+      // E15 (D15, C8): a fact, not a security guarantee — the background cannot check it, and it gates nothing; it
+      // only decides two #35 task rows and one protections row. Vault page only keeps the popup and the web out.
+      if (deps === undefined) return {ok: false, error: 'unavailable'};
+      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
+      try {
+        await updateSettings(ext, s => ({...s, phraseVerifiedAt: deps.now()}));
+        return {ok: true};
+      } catch {
+        return {ok: false, error: 'failed'};
+      }
+    }
     case 'vault.storeEnvelope': {
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
       const r = await storeEnvelope(ext, expectedRevision, envelope);
````

Modify `extension/src/unlock/forgetFlow.ts`:

````diff
diff --git a/extension/src/unlock/forgetFlow.ts b/extension/src/unlock/forgetFlow.ts
index da1797e..59ba038 100644
--- a/extension/src/unlock/forgetFlow.ts
+++ b/extension/src/unlock/forgetFlow.ts
@@ -17,10 +17,12 @@ import type {Send, VaultStore} from './types';
  *  - SEED proof (#39's restore): the phrase derives, under the STORED scheme, every stored account's
  *    key. Its only use is restoreWallet, whose message always carries a `replacement` — the same wallet
  *    re-encrypted under a new password (the background binds it, C4).
- *  - FACTOR proof (#40's "Try a different seed", D41): the password (or passkey) unwraps the stored
- *    data key; no session is needed. Its only use is replaceEmptyWallet, whose message ALWAYS carries
- *    `guard: 'unfunded'`. The background cannot enforce "a factor-proven delete only with the guard"
- *    — #37's delete (B1b-2b) has none — so this module does (plan-1 carry).
+ *  - FACTOR proof (#40's "Try a different seed", D41; #37's delete, B1b-2b E11): the password (or passkey)
+ *    unwraps the stored data key; no session is needed. Its two uses: replaceEmptyWallet, whose message ALWAYS
+ *    carries `guard: 'unfunded'`, and deleteWallet (#37), whose message carries neither the guard nor a
+ *    replacement — on purpose (D11: a funded wallet may be deleted; its seed still controls the funds). The
+ *    background cannot tell the two apart, so this module holds the boundary, and a source test holds
+ *    deleteWallet to its one importer (screens/delete.ts).
  * A proof is an object only proveSeed/proveFactor can mint (a WeakSet records each one): a value
  * that merely looks like a proof sends nothing.
  */
@@ -165,6 +167,23 @@ export async function restoreWallet(deps: {send: Send; kdf: Kdf}, proof: SeedPro
   }
 }
 
+export type DeleteOutcome = 'deleted' | 'send-open' | 'busy' | 'unlocked' | 'no-wallet' | 'damaged' | 'failed';
+
+/**
+ * #37's delete (B1b-2b E11, D9, D11): the factor-proven wallet is removed — NO `replacement`, NO `guard`: a funded wallet
+ * is deleted too (#37 shows the funds first, C13). The proof is proveFactor's (password or passkey, no session, works
+ * locked). `funded`, `unreachable` and `coordinator-refused` cannot occur without the guard; if they ever did, they are
+ * `failed`. The background's E5 locks, refuses while a send is open (`send-open`, the wallet left locked), and removes the
+ * vault, the known recipients, the settings and the caches (plan 2 adds v1_contacts there).
+ */
+export async function deleteWallet(send: Send, proof: FactorProof): Promise<DeleteOutcome> {
+  if (!minted.has(proof) || proof.kind !== 'factor') return 'failed';
+  const r = await forget(send, {type: 'vault.forgetWallet', expectedRevision: proof.revision});
+  if (r === 'forgotten') return 'deleted';
+  if (r === 'funded' || r === 'unreachable' || r === 'coordinator-refused') return 'failed';
+  return r;
+}
+
 export type ReplaceOutcome = 'created' | 'created-locked' | 'exists' | 'store-failed' | ForgetRefusal;
 
 /**
````

Modify `extension/src/unlock/revealFlow.ts`:

````diff
diff --git a/extension/src/unlock/revealFlow.ts b/extension/src/unlock/revealFlow.ts
index 2200589..25720c1 100644
--- a/extension/src/unlock/revealFlow.ts
+++ b/extension/src/unlock/revealFlow.ts
@@ -1,4 +1,5 @@
-import {openProven, type ReauthFactor} from '../vault/reauth';
+import type {Kdf} from '../vault/envelope';
+import {openProven} from '../vault/reauth';
 import {lockOnMismatch, sessionKeys} from './reauthFlow';
 import {storedVault} from './stored';
 import type {Send} from './types';
@@ -13,7 +14,16 @@ export type RevealOutcome =
  * key is zeroed at once; the phrase leaves this function only as words for the page to render —
  * nothing of it is sent to the background, logged or stored.
  */
-export async function runReveal(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RevealOutcome> {
+export async function runReveal(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: {password: string; kdf: Kdf}): Promise<RevealOutcome> {
+  // B1b-2b E16 (D23): the phrase is opened by the PASSWORD only — never by a passkey, whose holder would gain permanent
+  // access that survives removing it (E12) or changing the password (E10). Refused at the function boundary, before any
+  // envelope is read, whatever a caller cast past the type; a PRF output handed in anyway is zeroed.
+  const cast = factor as unknown as {prfOutput?: unknown};
+  if (cast.prfOutput !== undefined) {
+    if (cast.prfOutput instanceof Uint8Array) cast.prfOutput.fill(0);
+    return {outcome: 'failed'};
+  }
+  if (typeof factor.password !== 'string') return {outcome: 'failed'};
   try {
     const stored = storedVault(await deps.readEnvelope());
     if (stored.kind === 'none') return {outcome: 'no-wallet'};
@@ -27,7 +37,17 @@ export async function runReveal(deps: {readEnvelope(): Promise<unknown>; send: S
     return {outcome: 'shown', words: proven.mnemonic.split(' ')};
   } catch {
     return {outcome: 'failed'};
-  } finally {
-    if ('prfOutput' in factor) factor.prfOutput.fill(0);
+  }
+}
+
+/**
+ * The verify check passed (B1b-2b E15, §3.5): the background records `phraseVerifiedAt`. True when it says so. Nothing of
+ * the phrase is sent — only the fact.
+ */
+export async function recordVerified(send: Send): Promise<boolean> {
+  try {
+    return (await send({type: 'vault.phraseVerified'})).ok;
+  } catch {
+    return false;
   }
 }
````

Modify `extension/src/unlock/screens/createRun.ts`:

````diff
diff --git a/extension/src/unlock/screens/createRun.ts b/extension/src/unlock/screens/createRun.ts
index 0bdc11c..141facc 100644
--- a/extension/src/unlock/screens/createRun.ts
+++ b/extension/src/unlock/screens/createRun.ts
@@ -112,6 +112,14 @@ export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; im
         // The page was left (pagehide) while this ran: the run was dropped, and #1 shows what is stored now.
         if (started !== generation) return null;
         if (out === 'created') {
+          // B1b-2b C8 (E15): this wallet's phrase just passed #4's check — recorded once it is stored and its keys are
+          // in the session. A refusal is ignored: the fact is cosmetic (two #35 rows), and #6 must not wait on it.
+          try {
+            await deps.send({type: 'vault.phraseVerified'});
+          } catch {
+            // Not recorded: #35 asks the user to verify, which is true enough.
+          }
+          if (started !== generation) return null;
           // §3.5: held for #6 only — unless the tab was hidden meanwhile, which drops it (#6 asks again).
           password = leftWhileStoring ? null : chosen;
           passkey.show({get: () => password, drop: () => void (password = null)});
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/messages.test.ts src/background/__tests__/phraseVerified.test.ts src/unlock/__tests__/create.test.ts src/unlock/__tests__/deleteWallet.test.ts src/unlock/__tests__/import.test.ts src/unlock/__tests__/revealFlow.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 6 passed (6) · Tests 134 passed (134); tsc clean; whole suite Test Files 123 passed (123) · Tests 2206 passed (2206); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M6a** — deleteWallet takes a seed proof — `extension/src/unlock/forgetFlow.ts`:

  ```diff
  - if (!minted.has(proof) || proof.kind !== 'factor') return 'failed';
  -   const r = await forget(send, {type: 'vault.forgetWallet', expectedRevision: proof.revision});
  + if (!minted.has(proof)) return 'failed';
  +   const r = await forget(send, {type: 'vault.forgetWallet', expectedRevision: proof.revision});
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/deleteWallet.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M6b** — reveal opens with a PRF output beside the password (E16) — `extension/src/unlock/revealFlow.ts`:

  ```diff
  -     if (cast.prfOutput instanceof Uint8Array) cast.prfOutput.fill(0);
  -     return {outcome: 'failed'};
  +     if (cast.prfOutput instanceof Uint8Array) cast.prfOutput.fill(0);
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/revealFlow.test.ts` — Expected: **red** (dry run: E16 (D23): a passkey factor cast past the type is refused — failed, nothing read or sent, the PRF output zeroed | AssertionError: expected { outcome: 'wrong' } ).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/messages.test.ts extension/src/background/__tests__/phraseVerified.test.ts extension/src/background/messages.ts extension/src/unlock/__tests__/create.test.ts extension/src/unlock/__tests__/deleteWallet.test.ts extension/src/unlock/__tests__/import.test.ts extension/src/unlock/__tests__/revealFlow.test.ts extension/src/unlock/forgetFlow.ts extension/src/unlock/revealFlow.ts extension/src/unlock/screens/createRun.ts
git commit -F - <<'MSG'
feat(extension): E15 vault.phraseVerified (C8); E11 deleteWallet over a factor proof; E16 reveal is password-only

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 7: The UI client: `engine.settingsSet`/`order`, `WalletState.passkey`, the new pages and routes, `PASSWORD_TOAST_KEY`

**Spec:** §1.2 (pages), §1.3 (routes, C14), §4 (client calls)

**Files:**
- Modify: `extension/src/app/WalletContext.tsx`
- Modify: `extension/src/app/__tests__/Switcher.test.tsx`
- Modify: `extension/src/app/__tests__/engine.test.ts`
- Modify: `extension/src/app/__tests__/links.test.ts`
- Modify: `extension/src/app/__tests__/platform.test.ts`
- Modify: `extension/src/app/__tests__/router.test.ts`
- Modify: `extension/src/app/engine.ts`
- Modify: `extension/src/app/platform.ts`
- Modify: `extension/src/app/prefs.ts`
- Modify: `extension/src/app/router.ts`
- Modify: `extension/src/app/screens/Switcher.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 4 (`accounts.order`, `settings.set` with `reauth-required`, `wallet.state.passkey`); `MAX_ACCOUNT_INDEX` (Task 5).
- Produces (exact signatures, as exported):
  - `export type SettingsPatch = {autoLockMinutes?: number; reauthUsdCents?: number};`
  - `export type RemoveAccountPage = string & {readonly [REMOVE_ACCOUNT_PAGE]: true};`
  - `export function removeAccountPage(index: number): RemoveAccountPage | null`
  - `export const PASSWORD_TOAST_KEY = 'noctura.ui.v1.passwordToastSeen';`
  - `export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status', 'security', 'accounts', 'passkey', 'delete']);`

The popup side of Tasks 1–6, with no screen yet. `ExtensionPage` lists every vault-page URL the popup may open (`accounts&op=add`, `password`, `delete`, `passkey&op=add|remove`, `reveal`, `verify`); the remove page is a branded string only `removeAccountPage(index)` makes (C14 — an out-of-range index yields `null`, never a URL). The router gains four bare routes (`security`, `accounts`, `passkey`, `delete` — any query dropped). `WalletContext` treats a `passkey` change as a state change. The Switcher's "Add account" opens `accounts&op=add`.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/app/__tests__/Switcher.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Switcher.test.tsx b/extension/src/app/__tests__/Switcher.test.tsx
index c9396af..daca51f 100644
--- a/extension/src/app/__tests__/Switcher.test.tsx
+++ b/extension/src/app/__tests__/Switcher.test.tsx
@@ -16,7 +16,7 @@ import type {Platform} from '../platform';
 /** A fully self-contained Engine (no background involved): full control over the account list and every reply. */
 function stubEngine(accounts: Account[], selected: number): Engine {
   return {
-    state: async () => ({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts, selected}}),
+    state: async () => ({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts, selected, passkey: false}}),
     balances: async () => ({ok: true, data: {sol: 62_482_100_000n, noc: 4_200_000_000_000n, usdc: 740_210_000n, usdt: 0n}}),
     prices: async () => ({ok: true, data: {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: 1}}),
     cached: async () => ({ok: true, data: {balances: null, prices: null}}),
@@ -30,7 +30,9 @@ function stubEngine(accounts: Account[], selected: number): Engine {
     discardPrepared: async () => ({ok: true, data: null}),
     rename: async () => ({ok: false, error: 'failed'}),
     select: async () => ({ok: true, data: null}),
-    settings: async () => ({ok: true, data: {autoLockMinutes: 5, reauthUsdCents: 0, selectedAccount: selected}}),
+    settings: async () => ({ok: true, data: {autoLockMinutes: 5, reauthUsdCents: 0, selectedAccount: selected, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null}}),
+    settingsSet: async () => ({ok: false, error: 'failed'}),
+    order: async () => ({ok: false, error: 'failed'}),
     lock: async () => ({ok: true, data: null}),
     ping: async () => ({ok: true, data: null}),
   };
@@ -98,7 +100,7 @@ describe('the account switcher', () => {
   it('Add account opens the vault page’s accounts mode; a CLI wallet cannot add one', async () => {
     const {platform} = await open();
     fireEvent.click(screen.getByRole('button', {name: 'Add account'}));
-    expect(platform.opened).toEqual(['unlock.html?mode=accounts']);
+    expect(platform.opened).toEqual(['unlock.html?mode=accounts&op=add']);
   });
 
   it('a CLI wallet: Add account disabled, with the reason', async () => {
````

Modify `extension/src/app/__tests__/engine.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/engine.test.ts b/extension/src/app/__tests__/engine.test.ts
index fe58f98..e04b92c 100644
--- a/extension/src/app/__tests__/engine.test.ts
+++ b/extension/src/app/__tests__/engine.test.ts
@@ -27,11 +27,34 @@ async function wired(depsOver: Parameters<typeof fakeDeps>[0] = {}, unlocked = t
   return {ext, deps, engine: createEngine(transport, noSleep)};
 }
 
+describe('the B1b-2b client calls against the real background', () => {
+  it('settingsSet: a strengthening is written; a weakening is reauth-required with its challenge id; locked; malformed', async () => {
+    const {engine} = await wired();
+    expect(await engine.settingsSet({autoLockMinutes: 1})).toMatchObject({ok: true, data: {autoLockMinutes: 1}});
+    const weak = await engine.settingsSet({reauthUsdCents: 50_000});
+    expect(weak).toMatchObject({ok: false, error: 'reauth-required'});
+    expect((weak as {data?: {challengeId?: string}}).data?.challengeId).toMatch(/^[0-9a-f]{32}$/);
+    expect(await engine.settingsSet({autoLockMinutes: 61})).toEqual({ok: false, error: 'malformed'});
+    const locked = await wired({}, false);
+    expect(await locked.engine.settingsSet({autoLockMinutes: 60})).toEqual({ok: false, error: 'locked'});
+  });
+
+  it('order: ok for a permutation, stale for another set; wallet.state follows it', async () => {
+    const {engine, ext} = await wired();
+    await ext.local.set(VAULT_KEY, {...ENV, accounts: [...ENV.accounts, {index: 1, name: 'Two', publicKey: RECIPIENT}]});
+    expect(await engine.order([1, 0])).toEqual({ok: true, data: null});
+    const state = await engine.state();
+    expect(state.ok ? state.data.accounts.map(a => a.index) : null).toEqual([1, 0]);
+    expect(await engine.order([0])).toEqual({ok: false, error: 'stale'});
+    expect(await engine.order([0, 0])).toEqual({ok: false, error: 'malformed'});
+  });
+});
+
 describe('the message client against the real background', () => {
   it('state, settings, ping, lock', async () => {
     const {engine} = await wired();
-    expect(await engine.state()).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 0}});
-    expect(await engine.settings()).toEqual({ok: true, data: {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0}});
+    expect(await engine.state()).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 0, passkey: false}});
+    expect(await engine.settings()).toEqual({ok: true, data: {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null}});
     expect(await engine.ping()).toEqual({ok: true, data: null});
     expect(await engine.lock()).toEqual({ok: true, data: null});
     expect((await engine.state()).data).toMatchObject({unlocked: false});
@@ -119,12 +142,25 @@ describe('shape checks: a reply of the wrong shape is failed', () => {
   });
 
   it('state: an address outside base58, an unknown scheme', async () => {
-    const good = {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: acc}], selected: 0};
+    const good = {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: acc}], selected: 0, passkey: false};
     expect((await engineAnswering({ok: true, data: good}).state()).ok).toBe(true);
     expect(await engineAnswering({ok: true, data: {...good, accounts: [{index: 0, name: 'A', publicKey: '0OIl'}]}}).state()).toEqual({ok: false, error: 'failed'});
     expect(await engineAnswering({ok: true, data: {...good, scheme: 'bip32'}}).state()).toEqual({ok: false, error: 'failed'});
   });
 
+  it('B1b-2b: state requires a boolean passkey; settings requires the three new fields', async () => {
+    const good = {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: acc}], selected: 0, passkey: true};
+    expect(await engineAnswering({ok: true, data: good}).state()).toEqual({ok: true, data: good});
+    const {passkey: _p, ...missing} = good;
+    expect(await engineAnswering({ok: true, data: missing}).state()).toEqual({ok: false, error: 'failed'});
+    expect(await engineAnswering({ok: true, data: {...good, passkey: 'yes'}}).state()).toEqual({ok: false, error: 'failed'});
+    const settings = {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: [1, 0], phraseVerifiedAt: 3, passwordChangedAt: null};
+    expect(await engineAnswering({ok: true, data: settings}).settings()).toEqual({ok: true, data: settings});
+    for (const bad of [{accountOrder: [1, -1]}, {accountOrder: 'x'}, {phraseVerifiedAt: -1}, {passwordChangedAt: '1'}, {phraseVerifiedAt: undefined}]) {
+      expect(await engineAnswering({ok: true, data: {...settings, ...bad}}).settings()).toEqual({ok: false, error: 'failed'});
+    }
+  });
+
   it('prices: zero is not a price (null is)', async () => {
     expect(await engineAnswering({ok: true, data: {sol: 0, usdc: 1, usdt: 1, noc: null, at: 1}}).prices()).toEqual({ok: false, error: 'failed'});
     expect((await engineAnswering({ok: true, data: {sol: null, usdc: 1, usdt: 1, noc: null, at: 1}}).prices()).ok).toBe(true);
````

Modify `extension/src/app/__tests__/links.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/links.test.ts b/extension/src/app/__tests__/links.test.ts
index f0a5577..b20e9ef 100644
--- a/extension/src/app/__tests__/links.test.ts
+++ b/extension/src/app/__tests__/links.test.ts
@@ -50,9 +50,11 @@ describe('links out of the UI', () => {
     expect(platform).toMatch(/navigate: page => location\.assign\(page\)/);
     // The closed list, plus #20's one data-built page — a branded ReauthPage only reauthPage() makes (Task 9 fix round 1).
     expect(platform).toMatch(/navigate\(page: ExtensionPage \| ReauthPage\): void;/);
-    expect(platform).toMatch(/openPage\(page: ExtensionPage \| ReauthPage\): void;/);
+    // B1b-2b §1.3: and the accounts manager's remove page — a branded RemoveAccountPage only removeAccountPage() makes.
+    expect(platform).toMatch(/openPage\(page: ExtensionPage \| ReauthPage \| RemoveAccountPage\): void;/);
     expect([...platform.matchAll(/as ReauthPage\b/g)]).toHaveLength(1);
-    for (const {path, text} of sources) if (path !== 'platform.ts') expect(`${path}: ${/as ReauthPage\b/.test(text)}`).toBe(`${path}: false`);
+    expect([...platform.matchAll(/as RemoveAccountPage\b/g)]).toHaveLength(1);
+    for (const {path, text} of sources) if (path !== 'platform.ts') expect(`${path}: ${/as (?:ReauthPage|RemoveAccountPage)\b/.test(text)}`).toBe(`${path}: false`);
   });
 
   it('no URL but Solscan’s and the extension’s own pages', () => {
````

Modify `extension/src/app/__tests__/platform.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/platform.test.ts b/extension/src/app/__tests__/platform.test.ts
index 8725a2b..711e84b 100644
--- a/extension/src/app/__tests__/platform.test.ts
+++ b/extension/src/app/__tests__/platform.test.ts
@@ -1,4 +1,4 @@
-import {reauthPage} from '../platform';
+import {reauthPage, removeAccountPage} from '../platform';
 
 // #20's one extension page built from data (spec §4.5 step 2): only 32 lowercase hex characters make a page.
 describe('reauthPage', () => {
@@ -21,3 +21,15 @@ describe('reauthPage', () => {
     }
   });
 });
+
+// B1b-2b §1.3 (C14): the accounts manager's remove page — the envelope's 0-based index, checked, never a name.
+describe('removeAccountPage', () => {
+  it('a safe integer in 0 … 2^31 − 1: the remove page for that index', () => {
+    expect(removeAccountPage(0)).toBe('unlock.html?mode=accounts&op=remove&index=0');
+    expect(removeAccountPage(2 ** 31 - 1)).toBe(`unlock.html?mode=accounts&op=remove&index=${2 ** 31 - 1}`);
+  });
+
+  it('anything else: null — no page', () => {
+    for (const index of [-1, 1.5, 2 ** 31, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) expect(removeAccountPage(index)).toBeNull();
+  });
+});
````

Modify `extension/src/app/__tests__/router.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/router.test.ts b/extension/src/app/__tests__/router.test.ts
index f45a2b3..cad92e8 100644
--- a/extension/src/app/__tests__/router.test.ts
+++ b/extension/src/app/__tests__/router.test.ts
@@ -18,7 +18,7 @@ describe('the router', () => {
   });
 
   it('the pushable screens are a closed list; the hand-over screens are first routes only; the flow screens own their Esc', () => {
-    expect([...SCREENS].sort()).toEqual(['about', 'confirm', 'receive', 'review', 'send', 'status', 'tab', 'tx']);
+    expect([...SCREENS].sort()).toEqual(['about', 'accounts', 'confirm', 'delete', 'passkey', 'receive', 'review', 'security', 'send', 'status', 'tab', 'tx']);
     expect([...TAB_ONLY].sort()).toEqual(['created', 'imported', 'resume']);
     expect([...FLOW].sort()).toEqual(['confirm', 'resume', 'review', 'send', 'status']);
     for (const route of [{screen: 'created'}, {screen: 'imported'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
@@ -29,6 +29,15 @@ describe('the router', () => {
     expect(routeReducer(HOME, {type: 'push', route: forged})).toBe(HOME);
   });
 
+  it('B1b-2b §1.4: security, accounts, passkey and delete carry exactly their name — any other key refuses the route', () => {
+    for (const screen of ['security', 'accounts', 'passkey', 'delete'] as const) {
+      expect(routeReducer(HOME, {type: 'push', route: {screen}})).toEqual([...HOME, {screen}]);
+      for (const extra of [{challengeId: 'ab'.repeat(16)}, {index: 1}, {address: ADDR}]) {
+        expect(routeReducer(HOME, {type: 'push', route: {screen, ...extra} as unknown as Route})).toBe(HOME);
+      }
+    }
+  });
+
   it('the flow routes: a draft is the user’s text, an intent an address and a positive u64, a status id 32 hex or null', () => {
     const ok: Route[] = [
       {screen: 'send', draft: null, notice: null},
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/Switcher.test.tsx src/app/__tests__/engine.test.ts src/app/__tests__/links.test.ts src/app/__tests__/platform.test.ts src/app/__tests__/router.test.ts
```
Expected (dry run, these test files on Task 6's tree): **red** — Test Files 5 failed (5) · Tests 10 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/WalletContext.tsx`:

````diff
diff --git a/extension/src/app/WalletContext.tsx b/extension/src/app/WalletContext.tsx
index 5512011..20bbfff 100644
--- a/extension/src/app/WalletContext.tsx
+++ b/extension/src/app/WalletContext.tsx
@@ -280,7 +280,7 @@ export function WalletProvider({
       if (!alive.current || !r.ok) return;
       const w = r.data;
       setWallet(prev => {
-        const changed = prev === null || prev.unlocked !== w.unlocked || prev.selected !== w.selected || JSON.stringify(prev.accounts) !== JSON.stringify(w.accounts);
+        const changed = prev === null || prev.unlocked !== w.unlocked || prev.selected !== w.selected || prev.passkey !== w.passkey || JSON.stringify(prev.accounts) !== JSON.stringify(w.accounts);
         return changed ? w : prev;
       });
       if (!w.hasWallet || !w.unlocked) {
````

Modify `extension/src/app/engine.ts`:

````diff
diff --git a/extension/src/app/engine.ts b/extension/src/app/engine.ts
index 126db7e..cdc38d8 100644
--- a/extension/src/app/engine.ts
+++ b/extension/src/app/engine.ts
@@ -20,8 +20,11 @@ export interface WalletState {
   hasWallet: boolean;
   unlocked: boolean;
   scheme: 'slip10' | 'cli' | null;
+  /** In the display order (B1b-2b E14). */
   accounts: Account[];
   selected: number | null;
+  /** B1b-2b E12: the stored envelope has a passkey wrap. */
+  passkey: boolean;
 }
 export interface Balances {
   sol: bigint;
@@ -115,7 +118,15 @@ export interface Settings {
   autoLockMinutes: number;
   reauthUsdCents: number;
   selectedAccount: number;
-}
+  /** B1b-2b E14: the display order, by account index; null — envelope order. */
+  accountOrder: number[] | null;
+  /** B1b-2b E15: when the recovery phrase was last verified (epoch ms), or null. */
+  phraseVerifiedAt: number | null;
+  /** B1b-2b C10: when the password was last changed (epoch ms), or null. */
+  passwordChangedAt: number | null;
+}
+/** The two security settings settings.set may change (B1b-2b §4.2). */
+export type SettingsPatch = {autoLockMinutes?: number; reauthUsdCents?: number};
 export interface RecipientInfo {
   known: boolean;
   lastSentAt: number | null;
@@ -155,6 +166,13 @@ export interface Engine {
   rename(index: number, name: string): Promise<Reply<null, 'malformed' | 'unknown-account' | 'busy'>>;
   select(index: number): Promise<Reply<null, 'malformed' | 'unknown-account'>>;
   settings(): Promise<Reply<Settings, never>>;
+  /**
+   * settings.set (B1b-2b E9, C1): a strengthening is written at once; a weakening answers `reauth-required` with
+   * `data: {challengeId}` — #10 confirms it and the background applies it. The client never re-sends a patch with an id.
+   */
+  settingsSet(patch: SettingsPatch): Promise<Reply<Settings, 'malformed' | 'locked' | 'reauth-required'>>;
+  /** accounts.order (B1b-2b E14): a permutation of the stored indexes; `stale` when the set changed. */
+  order(order: number[]): Promise<Reply<null, 'malformed' | 'stale' | 'no-wallet'>>;
   lock(): Promise<Reply<null, never>>;
   ping(): Promise<Reply<null, never>>;
 }
@@ -200,8 +218,8 @@ export function walletStateOf(x: unknown): WalletState | undefined {
   const scheme = o.scheme === null ? null : oneOf(o.scheme, ['slip10', 'cli'] as const);
   const accounts = all(o.accounts, account);
   const selected = o.selected === null ? null : isInt(o.selected) ? o.selected : undefined;
-  if (scheme === undefined || accounts === undefined || selected === undefined) return undefined;
-  return {hasWallet: o.hasWallet, unlocked: o.unlocked, scheme, accounts, selected};
+  if (scheme === undefined || accounts === undefined || selected === undefined || typeof o.passkey !== 'boolean') return undefined;
+  return {hasWallet: o.hasWallet, unlocked: o.unlocked, scheme, accounts, selected, passkey: o.passkey};
 }
 
 function balancesOf(x: unknown): Balances | undefined {
@@ -378,7 +396,11 @@ function historyPageOf(x: unknown): HistoryPage | undefined {
 function settingsOf(x: unknown): Settings | undefined {
   const o = obj(x);
   if (o === undefined || !isInt(o.autoLockMinutes) || !isInt(o.reauthUsdCents) || !isInt(o.selectedAccount)) return undefined;
-  return {autoLockMinutes: o.autoLockMinutes, reauthUsdCents: o.reauthUsdCents, selectedAccount: o.selectedAccount};
+  const accountOrder = o.accountOrder === null ? null : all(o.accountOrder, v => (isInt(v) ? v : undefined));
+  const phraseVerifiedAt = o.phraseVerifiedAt === null ? null : isTime(o.phraseVerifiedAt) ? o.phraseVerifiedAt : undefined;
+  const passwordChangedAt = o.passwordChangedAt === null ? null : isTime(o.passwordChangedAt) ? o.passwordChangedAt : undefined;
+  if (accountOrder === undefined || phraseVerifiedAt === undefined || passwordChangedAt === undefined) return undefined;
+  return {autoLockMinutes: o.autoLockMinutes, reauthUsdCents: o.reauthUsdCents, selectedAccount: o.selectedAccount, accountOrder, phraseVerifiedAt, passwordChangedAt};
 }
 
 function recipientInfoOf(x: unknown): RecipientInfo | undefined {
@@ -463,6 +485,8 @@ export function createEngine(transport: Transport = runtimeSend, sleep: (ms: num
     rename: (index, name) => call({type: 'accounts.rename', index, name}, ['malformed', 'unknown-account', 'busy'], nothing),
     select: index => call({type: 'accounts.select', index}, ['malformed', 'unknown-account'], nothing),
     settings: () => call({type: 'settings.get'}, [], settingsOf),
+    settingsSet: patch => call({type: 'settings.set', patch}, ['malformed', 'locked', 'reauth-required'], settingsOf),
+    order: order => call({type: 'accounts.order', order}, ['malformed', 'stale', 'no-wallet'], nothing),
     lock: () => call({type: 'vault.lock'}, [], nothing),
     ping: () => call({type: 'activity.ping'}, [], nothing),
   };
````

Modify `extension/src/app/platform.ts`:

````diff
diff --git a/extension/src/app/platform.ts b/extension/src/app/platform.ts
index 1cdf290..8805f5f 100644
--- a/extension/src/app/platform.ts
+++ b/extension/src/app/platform.ts
@@ -9,15 +9,25 @@ interface PlatformApi {
   tabs: {create(o: {url: string}): Promise<unknown> | void};
 }
 
-/** Every fixed extension page the UI opens. A closed list: nothing here builds a URL from data (#20's one data-built page is a ReauthPage, below). */
+/**
+ * Every fixed extension page the UI opens. A closed list: nothing here builds a URL from data (the two data-built pages
+ * are a ReauthPage and a RemoveAccountPage, below). B1b-2b §1.3 adds the security pages; the add-account page is
+ * `…&op=add` (2a's bare `mode=accounts` is replaced).
+ */
 export type ExtensionPage =
   | 'unlock.html?mode=welcome'
   | 'unlock.html?mode=unlock'
   | 'unlock.html?mode=forgot'
-  | 'unlock.html?mode=accounts'
+  | 'unlock.html?mode=accounts&op=add'
   | 'unlock.html?mode=unlock&return=created'
   | 'unlock.html?mode=unlock&return=imported'
-  | 'unlock.html?mode=import&source=retry';
+  | 'unlock.html?mode=import&source=retry'
+  | 'unlock.html?mode=password'
+  | 'unlock.html?mode=delete'
+  | 'unlock.html?mode=passkey&op=add'
+  | 'unlock.html?mode=passkey&op=remove'
+  | 'unlock.html?mode=reveal'
+  | 'unlock.html?mode=verify';
 
 declare const REAUTH_PAGE: unique symbol;
 /** #20's re-authentication page: a string only reauthPage() makes (the brand cannot be written by hand). */
@@ -31,9 +41,23 @@ export function reauthPage(challengeId: string): ReauthPage | null {
   return /^[0-9a-f]{32}$/.test(challengeId) ? (`unlock.html?mode=reauth&challenge=${challengeId}` as ReauthPage) : null;
 }
 
+declare const REMOVE_ACCOUNT_PAGE: unique symbol;
+/** The accounts manager's remove page (B1b-2b §1.3, C14): a string only removeAccountPage() makes. */
+export type RemoveAccountPage = string & {readonly [REMOVE_ACCOUNT_PAGE]: true};
+/** The SLIP-0010 hardened limit of the account level (vault page: accountsFlow.MAX_ACCOUNT_INDEX). */
+const MAX_ACCOUNT_INDEX = 2 ** 31 - 1;
+
+/**
+ * The remove page for the account with this envelope `index` (0-based): null unless `index` is a safe integer in
+ * 0 … 2^31 − 1. The page shows "Account index+1" and the stored address — never the name — and acts only after a proof.
+ */
+export function removeAccountPage(index: number): RemoveAccountPage | null {
+  return Number.isSafeInteger(index) && index >= 0 && index <= MAX_ACCOUNT_INDEX ? (`unlock.html?mode=accounts&op=remove&index=${index}` as RemoveAccountPage) : null;
+}
+
 export interface Platform {
   /** A new tab (the popup closes itself after). */
-  openPage(page: ExtensionPage | ReauthPage): void;
+  openPage(page: ExtensionPage | ReauthPage | RemoveAccountPage): void;
   /** This tab moves to the page (the UI tab's #7 and #40 hand over to the vault page and back). */
   navigate(page: ExtensionPage | ReauthPage): void;
   closeWindow(): void;
````

Modify `extension/src/app/prefs.ts`:

````diff
diff --git a/extension/src/app/prefs.ts b/extension/src/app/prefs.ts
index c44ff0d..9a9c618 100644
--- a/extension/src/app/prefs.ts
+++ b/extension/src/app/prefs.ts
@@ -10,6 +10,11 @@ export const ACTIVITY_FILTER_KEY = 'noctura.ui.v1.activityFilter';
  * In localStorage because the round trip through #10 may close the popup that saw the first strike.
  */
 export const CONFIRM_STRIKE_KEY = 'noctura.ui.v1.confirmStrike';
+/**
+ * #31's 36e (B1b-2b C10): the `passwordChangedAt` whose "Password updated" toast this popup already showed — so it shows
+ * once per change. UI state only: the fact itself is the background's (a page could not forge a "Password updated").
+ */
+export const PASSWORD_TOAST_KEY = 'noctura.ui.v1.passwordToastSeen';
 
 export function readPref(key: string): string | null {
   try {
````

Modify `extension/src/app/router.ts`:

````diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index 927ef3f..3fbb0dd 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -21,6 +21,11 @@ export type Route =
   | {screen: 'receive'}
   | {screen: 'tx'; signature: string; account: string}
   | {screen: 'about'}
+  /** B1b-2b §1.4: #35 security center, the accounts manager, the passkey screen, #37 delete wallet — no data on any. */
+  | {screen: 'security'}
+  | {screen: 'accounts'}
+  | {screen: 'passkey'}
+  | {screen: 'delete'}
   | {screen: 'send'; draft: Draft | null; notice: 'start-again' | null}
   | {screen: 'review'; account: string; intent: Intent; notice: 'confirmation-expired' | null}
   | {screen: 'confirm'; account: string; entry: 'flow'; preparedId: string}
@@ -31,7 +36,9 @@ export type Route =
   | {screen: 'resume'; account: string};
 export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};
 
-export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status']);
+export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status', 'security', 'accounts', 'passkey', 'delete']);
+/** B1b-2b: the settings screens carry nothing but their name — no secret, no challenge, no address to act on. */
+const BARE: ReadonlySet<string> = new Set<Route['screen']>(['security', 'accounts', 'passkey', 'delete']);
 /** The send flow's screens: each handles Esc itself (#19 discards first, #20 keeps, #21 has no back while open). */
 export const FLOW: ReadonlySet<string> = new Set<Route['screen']>(['send', 'review', 'confirm', 'status', 'resume']);
 /** The UI tab's hand-over screens: a first route from `location.hash`, never pushed. */
@@ -49,6 +56,7 @@ function isRoute(r: unknown): r is Route {
   const o = r as Record<string, unknown>;
   if (typeof o.screen !== 'string' || !SCREENS.has(o.screen)) return false;
   if (o.screen === 'tab') return typeof o.tab === 'string' && TABS.has(o.tab);
+  if (BARE.has(o.screen)) return only(o, ['screen']);
   // #27 carries the account whose history the signature came from: its [Try again] is offered only while that account is selected (fix round 1).
   if (o.screen === 'tx') return only(o, ['screen', 'signature', 'account']) && typeof o.signature === 'string' && o.signature.length > 0 && isAddress(o.account);
   if (o.screen === 'send') return only(o, ['screen', 'draft', 'notice']) && (o.draft === null || isDraft(o.draft)) && (o.notice === null || o.notice === 'start-again');
````

Modify `extension/src/app/screens/Switcher.tsx`:

````diff
diff --git a/extension/src/app/screens/Switcher.tsx b/extension/src/app/screens/Switcher.tsx
index 20720c3..db133c9 100644
--- a/extension/src/app/screens/Switcher.tsx
+++ b/extension/src/app/screens/Switcher.tsx
@@ -164,7 +164,7 @@ export function Switcher({onClose}: {onClose: () => void}) {
         })}
       </div>
       {selectError === null ? null : <p className="field-msg noc-danger" role="alert">{selectError}</p>}
-      <button type="button" className="btn btn-secondary" disabled={cli} onClick={() => m.platform.openPage('unlock.html?mode=accounts')}>
+      <button type="button" className="btn btn-secondary" disabled={cli} onClick={() => m.platform.openPage('unlock.html?mode=accounts&op=add')}>
         <ExtIcon name="plus" size={18} />
         Add account
       </button>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/Switcher.test.tsx src/app/__tests__/engine.test.ts src/app/__tests__/links.test.ts src/app/__tests__/platform.test.ts src/app/__tests__/router.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 5 passed (5) · Tests 74 passed (74); tsc clean; whole suite Test Files 123 passed (123) · Tests 2212 passed (2212); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M7a** — removeAccountPage past the hardened range — `extension/src/app/platform.ts`:

  ```diff
  - index >= 0 && index <= MAX_ACCOUNT_INDEX ?
  + index >= 0 ?
  ```
  `timeout 300 npx vitest run src/app/__tests__/platform.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M7b** — the delete route keeps a query — `extension/src/app/router.ts`:

  ```diff
  - ['security', 'accounts', 'passkey', 'delete']
  + ['security', 'accounts', 'passkey']
  ```
  `timeout 300 npx vitest run src/app/__tests__/router.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/app/WalletContext.tsx extension/src/app/__tests__/Switcher.test.tsx extension/src/app/__tests__/engine.test.ts extension/src/app/__tests__/links.test.ts extension/src/app/__tests__/platform.test.ts extension/src/app/__tests__/router.test.ts extension/src/app/engine.ts extension/src/app/platform.ts extension/src/app/prefs.ts extension/src/app/router.ts extension/src/app/screens/Switcher.tsx
git commit -F - <<'MSG'
feat(extension): The UI client: engine.settingsSet/order, WalletState.passkey, the new pages and routes, PASSWORD_TOAST_KEY

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 8: #36 change password in the vault tab (36a–36d + the extension states); design-ext regenerated

**Spec:** §3.1 (#36), D8, C2, C20; O01–O10; design #36 (ix:14700–14900)

**Files:**
- Modify: `extension/e2e/visual-vault.spec.ts`
- Modify: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Create: `extension/src/__tests__/designExt2b.test.ts`
- Modify: `extension/src/styles/design-ext.css`
- Create: `extension/src/unlock/__tests__/changePasswordScreen.test.ts`
- Modify: `extension/src/unlock/__tests__/fakeTimers.ts`
- Modify: `extension/src/unlock/mode.ts`
- Modify: `extension/src/unlock/modes.ts`
- Create: `extension/src/unlock/screens/changePassword.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/view/dom.ts`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Task 3's `proveCurrent`, `isCurrentPassword`, `changePassword`; `PageDeps` (timers, kdf, store, send); `startCooldown`, `createWrongBackoff`.
- Produces (exact signatures, as exported):
  - `export const HOLD_TTL_MS = 5 * 60_000;`
  - `export interface ChangePasswordScreen`
  - `export function mountChangePassword(deps: PageDeps): ChangePasswordScreen`
  - `export const CHANGE =`

`?mode=password` mounts #36: step 1 (current password → `proveCurrent`), step 2 (new password: ≥ 12 characters with the meter; the current one again → O02 via `isCurrentPassword`), step 3 (confirm; a mismatch shows "Passwords don't match — try again" and clears after 600 ms — 2a's `MISMATCH_CLEAR_MS`, the design's 320 ms shake + 280 ms), then `changing` and the notice (O05, plus O06 when a passkey is stored). The held proof lives at most 5 minutes (C20): a page-local timer **and** a deadline re-check after every await drop it (`dropped`, "Enter your current password again."); `pagehide` and the ✕ → "Cancel password change?" modal (its own section, `v-cp-cancel`, #3's modal chrome) also drop it. Every async path checks `held`/`phase` after each await, and step 1's proof also checks a `generation` counter (review M1): `dropProof()` and a `pagehide` with nothing held both bump it, so a proof that settles after the user left is zeroed and the page shows `dropped`, never step 2. `restored` (back from the back/forward cache, timers frozen) re-checks the deadline like `visible`. `design-ext.css` is regenerated (never hand-edited) with the `s7-picker`, `s7-tip`, `s7-score-card`, `s7-task`, `s7-stepper`, `s7-pw`, `s7-longpress`, `s7-toast` families; its hash is pinned.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/visual-vault.spec.ts`:

````diff
diff --git a/extension/e2e/visual-vault.spec.ts b/extension/e2e/visual-vault.spec.ts
index e7714da..9acee1c 100644
--- a/extension/e2e/visual-vault.spec.ts
+++ b/extension/e2e/visual-vault.spec.ts
@@ -188,7 +188,8 @@ test('visual: the create run — #1, #2, #3, #4, #5, #6 and #7', async () => {
     await p.locator('#pw-field').fill(PASSWORD);
     await p.locator('#pw-cta').click();
     await expect(p.getByText('Creating your wallet…')).toBeVisible();
-    await expect(p.getByText('Securing your password takes a few seconds.')).toBeVisible();
+    // Scoped: #36's `changing` section (B1b-2b) carries the same line, hidden.
+    await expect(p.locator('#pw-creating').getByText('Securing your password takes a few seconds.')).toBeVisible();
     await shot(p, '05-creating');
     await releaseKdf(p);
````

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index 481a378..14f4c9a 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -1524,7 +1524,9 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
     const views = modules('src/unlock/view');
     // The readdir is not empty or short by accident: the folders hold exactly plan 2's screens (Tasks 6–14)
     // and views — a module added or removed there is named here too, and each named one must be reached.
-    const named = ['welcome', 'seed', 'confirm', 'password', 'passkey', 'createRun', 'importScreen', 'importRun', 'restoreRun', 'retryRun', 'forgot', 'unlock', 'reauth', 'accounts', 'reveal'];
+    const named = ['welcome', 'seed', 'confirm', 'password', 'passkey', 'createRun', 'importScreen', 'importRun', 'restoreRun', 'retryRun', 'forgot', 'unlock', 'reauth', 'accounts', 'reveal',
+      // B1b-2b plan 1.
+      'changePassword'];
     expect([...screens].sort()).toEqual(named.map(n => `src/unlock/screens/${n}.ts`).sort());
     expect([...views].sort()).toEqual(['dom', 'words', 'hold', 'meter', 'cooldown'].map(n => `src/unlock/view/${n}.ts`).sort());
     expect(resolved).toEqual(
@@ -1536,6 +1538,7 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
         'src/unlock/challenge.ts',
         'src/unlock/stored.ts',
         'src/unlock/page.ts',
+        'src/unlock/passwordFlow.ts',
       ]),
     );
   });
````

Create `extension/src/__tests__/designExt2b.test.ts`:

````ts
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// B1b-2b §1.6: design-ext.css regenerated from index.html with plan 1's prefixes — never by hand. The ring is not
// copied (C15: no score, no ring).
const CSS = readFileSync(join(__dirname, '..', 'styles', 'design-ext.css'), 'utf8');

describe('design-ext.css (B1b-2b plan 1)', () => {
  it('carries the settings and security classes, and not the score ring', () => {
    for (const sel of ['.s7-picker .opt.sel', '.s7-tip svg', '.s7-score-card', '.s7-task .label', '.s7-stepper .seg.cur', '.s7-pw input', '.s7-longpress .fill', '.s7-toast', '.s7-row.danger .s7-glyph,']) {
      expect(CSS).toContain(`${sel} `);
    }
    expect(CSS).not.toContain('.s7-ring');
  });

  it('is the extraction output, byte for byte (the hash the plan pins)', () => {
    expect(createHash('sha256').update(CSS).digest('hex')).toBe('541733335b0e35945521c490435e6910c1a8e23663954f04a0fc4c7dbec1bd6f');
  });
});
````

Create `extension/src/unlock/__tests__/changePasswordScreen.test.ts`:

````ts
// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {lock} from '../../background/autolock';
import {mountChangePassword, HOLD_TTL_MS, type ChangePasswordScreen} from '../screens/changePassword';
import {startMode} from '../modes';
import {pageMode} from '../mode';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1b-2b §3.1 (#36, E10, D8, C20) against the REAL background and the real unlock.html.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const OLD = 'correct horse battery';
const NEW = 'a brand new long password';

beforeEach(loadPage);

async function shown(o: {passkey?: boolean; unlocked?: boolean; holdSleep?: boolean; send?: (inner: Send) => Send} = {}): Promise<{h: Harness; screen: ChangePasswordScreen; env: EnvelopeV1}> {
  let env = await createEnvelope({mnemonic: M, password: OLD, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf});
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, OLD, testKdf), crypto.getRandomValues(new Uint8Array(32)), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: env, ...(o.holdSleep === true ? {holdSleep: true} : {}), ...(o.send === undefined ? {} : {send: o.send})});
  if (o.unlocked !== false) await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  const screen = mountChangePassword(h.deps);
  screen.show();
  return {h, screen, env};
}
const cta = () => el<HTMLButtonElement>('cp-cta');
const field = () => el<HTMLInputElement>('cp-field');
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
async function submit(h: Harness, value: string): Promise<void> {
  await idle(h);
  type(field(), value);
  click(cta());
}
async function toStep2(h: Harness): Promise<void> {
  await submit(h, OLD);
  await h.until(() => text(el('cp-step')) === 'Step 2 of 3' && !h.deps.gate.isBusy());
}
async function toStep3(h: Harness): Promise<void> {
  await toStep2(h);
  await submit(h, NEW);
  await h.until(() => text(el('cp-step')) === 'Step 3 of 3' && !h.deps.gate.isBusy());
}
const changes = (h: Harness) => h.sent.filter(m => m.type === 'vault.changePassword');

describe('#36 change password: the steps', () => {
  it('step-1: the adapted copy, the stepper at 1 of 3, a password field — and no passkey button', async () => {
    await shown({passkey: true});
    expect(pageMode('?mode=password')).toEqual({mode: 'password'});
    expect(text(el('v-change-password').querySelector('.top-bar .title'))).toBe('Change password');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(el('cp-seg-1').classList.contains('cur')).toBe(true);
    expect(text(el('cp-title'))).toBe('Enter current password');
    expect(text(el('cp-lede'))).toBe("Verify it's you before changing your password.");
    expect(field().autocomplete).toBe('current-password');
    expect(text(cta())).toBe('Continue');
    expect(cta().disabled).toBe(true);
    expect(visible(el('cp-toggle'))).toBe(false);
    expect(document.querySelector('#v-change-password [id*="passkey"]')).toBeNull();
    expect(unstyled('v-change-password')).toEqual([]);
    expect(unstyled('v-cp-cancel')).toEqual([]);
  });

  it('step-1 wrong: "That did not confirm it."; the typed password left the field at the click', async () => {
    const {h} = await shown();
    await submit(h, 'nope nope nope nope');
    expect(field().value).toBe('');
    await h.until(() => text(el('cp-helper')) === 'That did not confirm it.');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
  });

  it('step-2: the adapted copy, new-password field with show/hide and the length meter; Continue from 12 characters', async () => {
    const {h} = await shown();
    await toStep2(h);
    expect(text(el('cp-title'))).toBe('Choose a new password');
    expect(text(el('cp-lede'))).toBe('At least 12 characters. A few unrelated words work well.');
    expect(field().autocomplete).toBe('new-password');
    expect(text(el('cp-meter-label'))).toBe('0 of 12 characters');
    type(field(), 'short');
    expect(text(el('cp-meter-label'))).toBe('5 of 12 characters');
    expect(cta().disabled).toBe(true);
    type(field(), NEW);
    expect(text(el('cp-meter-label'))).toBe('Long enough');
    expect(cta().disabled).toBe(false);
    click(el('cp-toggle'));
    expect(field().type).toBe('text');
    expect(el('cp-toggle').getAttribute('aria-label')).toBe('Hide password');
  });

  it('step-2 same (review H2): the current password again → O02, nothing sent, no cooldown', async () => {
    const {h} = await shown();
    await toStep2(h);
    await submit(h, OLD);
    await h.until(() => text(el('cp-helper')) === 'That is your current password. Choose a new one.');
    expect(text(el('cp-step'))).toBe('Step 2 of 3');
    expect(changes(h)).toEqual([]);
    expect(visible(el('cp-cooldown'))).toBe(false);
  });

  it('step-3 mismatch: the adapted line, the shake, the field cleared after 600 ms; no attempt counter', async () => {
    const {h} = await shown();
    await toStep3(h);
    expect(text(el('cp-title'))).toBe('Confirm new password');
    expect(text(el('cp-lede'))).toBe('Enter the same password again.');
    expect(text(cta())).toBe('Change password');
    await submit(h, `${NEW}!`);
    await h.until(() => text(el('cp-helper')) === "Passwords don't match — try again");
    expect(field().classList.contains('is-error')).toBe(true);
    expect(field().value).toBe(`${NEW}!`);
    h.timers.advance(599);
    expect(field().value).toBe(`${NEW}!`);
    h.timers.advance(1);
    expect(field().value).toBe('');
    expect(changes(h)).toEqual([]);
  });

  it('done: only the salt and the wrap changed; "Password updated." + O05 + O06 with a passkey; the key zeroed', async () => {
    const {h, screen, env} = await shown({passkey: true});
    await toStep3(h);
    await submit(h, NEW);
    await h.until(() => text(el('cp-notice-line')) === 'Password updated.');
    expect(text(el('cp-notice-help'))).toBe('You can close this tab. Your passkey still works.');
    expect(visible(el('cp-close'))).toBe(true);
    const after = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect([after.seed, after.passkey, after.accounts]).toEqual([env.seed, env.passkey, env.accounts]);
    expect(after.password.wrapped).not.toBe(env.password.wrapped);
    expect(screen.holds()).toEqual({key: false, password: false});
    click(el('cp-close'));
    await h.until(() => h.closed === 1);
  });

  it('done without a passkey: no passkey line', async () => {
    const {h} = await shown();
    await toStep3(h);
    await submit(h, NEW);
    await h.until(() => text(el('cp-notice-line')) === 'Password updated.');
    expect(text(el('cp-notice-help'))).toBe('You can close this tab.');
  });

  it('busy (the envelope moved after step 1): RESTORE busy + [Start again] → step 1; locked → not-unlocked + [Unlock]', async () => {
    const busy = await shown({send: inner => async m => ((m as {type: string}).type === 'vault.changePassword' ? {ok: false, error: 'busy'} : inner(m))});
    await toStep3(busy.h);
    await submit(busy.h, NEW);
    await busy.h.until(() => text(el('cp-notice-line')) === 'The wallet changed while you were typing. Start again.');
    expect(busy.screen.holds().key).toBe(false);
    await idle(busy.h);
    click(el('cp-again'));
    await busy.h.until(() => text(el('cp-step')) === 'Step 1 of 3' && visible(el('cp-entry')));

    loadPage();
    const locked = await shown();
    await toStep3(locked.h);
    await lock(locked.h.ext);
    await submit(locked.h, NEW);
    await locked.h.until(() => text(el('cp-notice-line')) === 'The wallet is locked. Unlock it first, then try again.');
    await idle(locked.h);
    click(el('cp-unlock'));
    await locked.h.until(() => locked.h.went.length === 1);
    expect(locked.h.went).toEqual(['unlock.html?mode=unlock']);
  });

  it('not unlocked at step 1: the common notice with [Unlock]', async () => {
    const {h} = await shown({unlocked: false});
    await submit(h, OLD);
    await h.until(() => text(el('cp-notice-line')) === 'The wallet is locked. Unlock it first, then try again.');
    expect(visible(el('cp-unlock'))).toBe(true);
  });
});

describe('#36 memory (M2 ruling, C20)', () => {
  it('hidden → visible keeps step 2 and its field', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), 'half typed new');
    h.leave('hidden');
    h.back('visible');
    expect(text(el('cp-step'))).toBe('Step 2 of 3');
    expect(field().value).toBe('half typed new');
    expect(screen.holds().key).toBe(true);
  });

  it('pagehide zeroes the held data key and empties the field: step 1 with O10', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), 'half typed new');
    h.leave('pagehide');
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
  });

  it('C20: held key zeroed and fields emptied at 5 min with no keystroke', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), 'half typed new');
    h.timers.advance(HOLD_TTL_MS - 1);
    expect(screen.holds().key).toBe(true);
    h.timers.advance(1);
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
  });

  it('C20: a keystroke at 4 min moves the deadline to 9 min', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    h.timers.advance(4 * 60_000);
    type(field(), 'x');
    h.timers.advance(4 * 60_000 + 59_000);
    expect(screen.holds().key).toBe(true);
    h.timers.advance(1_000);
    expect(screen.holds().key).toBe(false);
  });

  it('C20: `visible` after the deadline shows dropped at once — the timer suppressed (a throttled tab) — no button enabled', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), NEW);
    h.leave('hidden');
    h.timers.skip(HOLD_TTL_MS + 1);
    h.back('visible');
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
    expect(cta().disabled).toBe(true);
  });

  it('C20: [Change password] pressed past the deadline (timer suppressed) sends nothing', async () => {
    const {h, screen} = await shown();
    await toStep3(h);
    type(field(), NEW);
    h.timers.skip(HOLD_TTL_MS + 1);
    click(cta());
    await new Promise(r => setTimeout(r, 20));
    expect(changes(h)).toEqual([]);
    expect(screen.holds().key).toBe(false);
  });

  it('C20: the deadline passing DURING step 2\'s same-password check (timer suppressed) drops the proof — step 3 never opens', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    // The check's one Argon2id run outlives the deadline, and the throttled tab's timer never fires.
    const deps = h.deps as {kdf: Kdf};
    deps.kdf = async (pw, salt, params) => {
      h.timers.skip(HOLD_TTL_MS + 1);
      return testKdf(pw, salt, params);
    };
    await submit(h, NEW);
    await h.until(() => text(el('cp-helper')) === 'Enter your current password again.');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(changes(h)).toEqual([]);
  });

  it('review M1: pagehide DURING step 1\'s proof — the proof that settles after is not kept: step 1 with O10, nothing held', async () => {
    const {h, screen} = await shown();
    const deps = h.deps as {kdf: Kdf};
    deps.kdf = async (pw, salt, params) => {
      // The user leaves while Argon2id runs (back/forward, a navigation): nothing is held yet.
      h.leave('pagehide');
      return testKdf(pw, salt, params);
    };
    await submit(h, OLD);
    await h.until(() => text(el('cp-helper')) === 'Enter your current password again.');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(screen.holds()).toEqual({key: false, password: false});
    // Restored from the back/forward cache: still step 1, and nothing to drop.
    h.back('restored');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
  });

  it('review M1: `restored` (back/forward cache, timers frozen) past the deadline drops the proof at once', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    h.leave('hidden');
    h.timers.skip(HOLD_TTL_MS + 1);
    h.back('restored');
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
  });

  it('cancel-confirm: the X over step 2 asks; [Keep changing] returns with the field; [Cancel change] zeroes and closes', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), 'kept while asking');
    click(el('cp-x'));
    await h.until(() => visible(el('v-cp-cancel')));
    expect(text(el('cpc-title'))).toBe('Cancel password change?');
    expect([text(el('cpc-keep')), text(el('cpc-cancel'))]).toEqual(['Keep changing', 'Cancel change']);
    await idle(h);
    click(el('cpc-keep'));
    await h.until(() => visible(el('v-change-password')));
    expect(field().value).toBe('kept while asking');
    await idle(h);
    click(el('cp-x'));
    await h.until(() => visible(el('v-cp-cancel')));
    await idle(h);
    click(el('cpc-cancel'));
    await h.until(() => h.closed === 1);
    expect(screen.holds()).toEqual({key: false, password: false});
  });

  it('the X at step 1 closes at once (nothing held)', async () => {
    const {h} = await shown();
    click(el('cp-x'));
    await h.until(() => h.closed === 1);
    expect(visible(el('v-cp-cancel'))).toBe(false);
  });
});

describe('#36 rule 6', () => {
  it('a second Continue inside the floor (its `disabled` lifted) runs no second proof', async () => {
    const {h} = await shown({holdSleep: true});
    type(field(), OLD);
    click(cta());
    cta().disabled = false;
    field().disabled = false;
    type(field(), OLD);
    click(cta());
    await h.until(() => h.sent.filter(m => m.type === 'vault.status').length >= 1);
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    h.wake();
  });
});

describe('#36 through startMode', () => {
  it('?mode=password mounts #36', async () => {
    const h = await harness({vault: await createEnvelope({mnemonic: M, password: OLD, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf})});
    startMode({mode: 'password'}, h.deps);
    expect(visible(el('v-change-password'))).toBe(true);
  });
});
````

Modify `extension/src/unlock/__tests__/fakeTimers.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/fakeTimers.ts b/extension/src/unlock/__tests__/fakeTimers.ts
index d3b1f20..31751df 100644
--- a/extension/src/unlock/__tests__/fakeTimers.ts
+++ b/extension/src/unlock/__tests__/fakeTimers.ts
@@ -4,7 +4,7 @@ import type {Timers} from '../page';
  * A manual clock for the vault page's timers: nothing runs until `advance(ms)`, which fires every due
  * timeout and interval in time order. Deterministic — no real time passes in a screen test.
  */
-export function fakeTimers(start = 1_000_000): Timers & {advance(ms: number): void; pending(): number} {
+export function fakeTimers(start = 1_000_000): Timers & {advance(ms: number): void; skip(ms: number): void; pending(): number} {
   let now = start;
   let next = 1;
   const jobs = new Map<number, {at: number; every: number | null; f: () => void}>();
@@ -40,6 +40,13 @@ export function fakeTimers(start = 1_000_000): Timers & {advance(ms: number): vo
       }
       now = end;
     },
+    /**
+     * B1b-2b C20: the clock moves on and NO timer fires — a background tab whose timers the browser throttled. A screen
+     * that relies on its timer alone keeps whatever the timer was to drop.
+     */
+    skip(ms: number) {
+      now += ms;
+    },
     pending: () => jobs.size,
   };
   return timers;
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/__tests__/designExt2b.test.ts src/unlock/__tests__/changePasswordScreen.test.ts src/unlock/__tests__/fakeTimers.ts
```
Expected (dry run, these test files on Task 7's tree): **red** — Test Files 3 failed (3) · Tests 3 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

First regenerate `extension/src/styles/design-ext.css` — never edit it by hand. Save this one-off script **outside the repository** (it is plan 2a's extraction script with one line of prefixes added — the line marked "B1b-2b plan 1") and run it from the repository root. Before adding the line, the script must reproduce the current file (`sha256sum extension/src/styles/design-ext.css` = `df829f1cadacc9f4fe51d4019acde4dd91066edca852277e92ecdd3a87063411`); a different hash means `/home/user/Downloads/index.html` changed — stop and ask the controller. With the line, the output is 1695 lines, 25 more, and its hash is `541733335b0e35945521c490435e6910c1a8e23663954f04a0fc4c7dbec1bd6f` (pinned by `designExt2b.test.ts`). The resulting diff is shown below with the other files.

````js
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
  '.s8-stale', '.s8-stale-mark', '.s8-empty-illust', '.s8-empty-copy', '.tab-bar', '.chip-row', '.copy-toast', '.skel-line', '.skel-circle', '.skel-tile', '.skel-block',
  // Plan 2 (B1b-2a-2): the vault-page screens #1–#6, #8–#10, #39 and the UI tab's #7 and #40.
  '.card', '.trust-chip', '.s-welcome', '.s-secintro', '.s-seed', '.s-seed-modal', '.s-confirm', '.s-pin', '.cooldown-card', '.s-bio', '.s-success', '.s-import',
  '.s8-step-card', '.s8-success-hero', '.s8-recovered-card', '.s8-addr-chip',
  // Plan 3 (B1b-2a-3): the send flow — #12, #19, #20, #21, #44 (and its cancelled toast), #54.
  '.s-send', '.s-sim', '.s-conf', '.s-stat', '.s-stuck', '.s9-fail-hero', '.s9-reason-banner', '.s9-payload-card', '.s9-toast-cancelled',
  // B1b-2b plan 1: #31's tip, #35's picker, score card (no ring, C15) and tasks, #36's stepper, #37's typed field and long-press, 36e's toast.
  '.s7-picker', '.s7-tip', '.s7-score-card', '.s7-task', '.s7-stepper', '.s7-pw', '.s7-longpress', '.s7-toast',
];
const KEYFRAMES = ['shimmer', 'spin', 'shake',
  // Plan 3: what the send-flow rules animate with (#19's progress strip and skeleton, #21's ring and status dot, #54's ring; #20's caret — its rule comes with .s-conf, the typed field does not, D22).
  'm3-slide', 'shimmer-bg', 'zk-spin', 'zk-pulse', 'stk-spin', 'caret'];
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
````

```bash
node /path/outside/the/repo/extract-design-css-2b.mjs
sha256sum extension/src/styles/design-ext.css
```

Modify `extension/src/styles/design-ext.css`:

````diff
diff --git a/extension/src/styles/design-ext.css b/extension/src/styles/design-ext.css
index 980f06a..116096a 100644
--- a/extension/src/styles/design-ext.css
+++ b/extension/src/styles/design-ext.css
@@ -1467,6 +1467,31 @@
 .s7-row.toggle .s7-chev { display: none; }
 .s7-row.danger .s7-glyph, .s7-row.danger .s7-title { color: var(--danger); }
 .s7-row.shielded .s7-glyph { color: var(--accent-shielded); }
+.s7-picker { display: flex; gap: var(--space-2); padding: var(--space-2); background: var(--bg-surface-3); border-radius: 9999px; }
+.s7-picker .opt { padding: 6px 12px; border-radius: 9999px; font-size: 12px; line-height: 14px; font-weight: 500; color: var(--fg-secondary); font-variant-numeric: tabular-nums; }
+.s7-picker .opt.sel { background: var(--accent); color: #0a0a0a; }
+.s7-tip { display: grid; grid-template-columns: 18px 1fr; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: color-mix(in oklab, var(--info) 10%, var(--bg-surface-1)); border-radius: var(--radius-lg); border: 1px solid color-mix(in oklab, var(--info) 24%, transparent); }
+.s7-tip svg { color: var(--info); }
+.s7-tip p { font-size: 13px; line-height: 18px; color: var(--fg-primary); margin: 0; }
+.s7-pw { background: var(--bg-surface-3); border-radius: var(--radius-md); padding: 14px var(--space-4); display: flex; align-items: center; gap: var(--space-3); min-height: 48px; }
+.s7-pw input { background: none; border: 0; outline: 0; flex: 1; color: var(--fg-primary); font-family: var(--font-body); font-size: 15px; letter-spacing: 0.12em; }
+.s7-pw .eye { color: var(--fg-tertiary); }
+.s7-pw .ms-mismatch { border: 1px solid var(--danger); }
+.s7-score-card { background: var(--bg-surface-1); border-radius: var(--radius-2xl); padding: var(--space-6); display: grid; grid-template-columns: 120px 1fr; gap: var(--space-5); align-items: center; }
+.s7-task { display: grid; grid-template-columns: 20px 1fr 16px; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-4); background: var(--bg-surface-1); border-radius: var(--radius-lg); min-height: 48px; }
+.s7-task svg { color: var(--warning); }
+.s7-task .label { font-size: 14px; line-height: 18px; color: var(--fg-primary); }
+.s7-task .chev { color: var(--fg-tertiary); }
+.s7-stepper { display: flex; gap: var(--space-2); align-items: center; justify-content: center; padding: var(--space-3) 0; }
+.s7-stepper .seg { width: 24px; height: 4px; border-radius: 2px; background: var(--bg-surface-3); }
+.s7-stepper .seg.done { background: var(--accent); }
+.s7-stepper .seg.cur { background: var(--accent); }
+.s7-stepper .label { font-size: 12px; line-height: 16px; color: var(--fg-tertiary); margin-inline-start: var(--space-3); font-variant-numeric: tabular-nums; }
+.s7-longpress { position: relative; overflow: hidden; }
+.s7-longpress .fill { position: absolute; inset: 0; background: color-mix(in oklab, var(--danger) 22%, transparent); transition: transform 600ms linear; transform-origin: left; }
+.s7-longpress .label { position: relative; z-index: 1; }
+.s7-toast { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--space-7) + var(--inset-bottom)); background: color-mix(in oklab, var(--success) 12%, var(--bg-surface-2)); border: 1px solid color-mix(in oklab, var(--success) 30%, transparent); padding: 10px var(--space-4); border-radius: 9999px; display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 18px; color: var(--fg-primary); }
+.s7-toast svg { color: var(--success); }
 .s7-wordmark { font-size: 36px; line-height: 42px; font-weight: 600; letter-spacing: -0.02em; color: var(--fg-primary); }
 .s7-wordmark .dot { color: var(--accent-shielded); }
 .s8-step-card { background: var(--bg-surface-1); border-radius: var(--radius-lg); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
````

Modify `extension/src/unlock/mode.ts`:

````diff
diff --git a/extension/src/unlock/mode.ts b/extension/src/unlock/mode.ts
index dece4ef..0a89dd2 100644
--- a/extension/src/unlock/mode.ts
+++ b/extension/src/unlock/mode.ts
@@ -11,7 +11,9 @@ export type PageMode =
   | {mode: 'forgot'}
   | {mode: 'accounts'}
   | {mode: 'reveal'}
-  | {mode: 'reauth'; challengeId: string};
+  | {mode: 'reauth'; challengeId: string}
+  /** B1b-2b §1.2: #36 change password (unlocked session, password only, D8). */
+  | {mode: 'password'};
 
 const SOURCES: readonly string[] = ['forgot', 'retry'];
 const RETURNS: readonly string[] = ['created', 'imported'];
@@ -24,7 +26,7 @@ const RETURNS: readonly string[] = ['created', 'imported'];
 export function pageMode(search: string): PageMode {
   const p = new URLSearchParams(search);
   const m = p.get('mode');
-  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal') return {mode: m};
+  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal' || m === 'password') return {mode: m};
   if (m === 'import') {
     const source = p.get('source') ?? '';
     return {mode: 'import', source: SOURCES.includes(source) ? (source as ImportSource) : null};
````

Modify `extension/src/unlock/modes.ts`:

````diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 44722f6..d671b1a 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -1,6 +1,7 @@
 import type {PageMode} from './mode';
 import type {PageDeps} from './page';
 import {mountAccounts} from './screens/accounts';
+import {mountChangePassword} from './screens/changePassword';
 import {createCreateRun} from './screens/createRun';
 import {mountForgot} from './screens/forgot';
 import {createImportRun} from './screens/importRun';
@@ -52,6 +53,9 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
     case 'reveal':
       mountReveal(deps).show();
       return;
+    case 'password':
+      mountChangePassword(deps).show();
+      return;
     case 'unlock':
       void mountUnlock(deps).show(mode.returnTo);
       return;
````

Create `extension/src/unlock/screens/changePassword.ts`:

````ts
import {MIN_PASSWORD_LENGTH} from '../onboarding';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {changePassword, isCurrentPassword, proveCurrent, type HeldProof} from '../passwordFlow';
import {ACCOUNTS, CHANGE, COMMON, PASSWORD, RESTORE, cooldownLabel} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';
import {renderMeter} from '../view/meter';
import {MISMATCH_CLEAR_MS} from './password';

/** C20: the held proof and #36's fields live at most this long from the step-1 proof, renewed by each keystroke in steps 2–3. */
export const HOLD_TTL_MS = 5 * 60_000;

export interface ChangePasswordScreen {
  show(): void;
  /** For the tests: what the screen still references — the held proof's data key, a typed or chosen password. */
  holds(): {key: boolean; password: boolean};
}

type Phase = 'step1' | 'step2' | 'step3' | 'changing' | 'notice' | 'done';
type Action = 'again' | 'unlock' | 'setup' | 'close' | null;

/**
 * #36 change password (spec B1b-2b §3.1, E10, D8, C20) in the vault tab. Step 1: the CURRENT password (never a passkey,
 * D8) is proven against the session — the proof's data key is held for step 3. Step 2: a new password of at least 12
 * characters, with #5's length meter; one Argon2id run checks it is not the current one (`same`, never charged to the
 * backoff). Step 3: the same password again; a mismatch shakes the field and clears it after 600 ms. Then the background
 * stores exactly a new salt and a new wrap (vault.changePassword).
 *
 * Memory (rev 2 ruling on review-1 M2, bounded by C20): the held key and the fields are NOT dropped when the tab is
 * hidden — changing a password means fetching one from a password manager in another tab — but on `pagehide`, on leave
 * (the X → [Cancel change]), after success, and at the 5-minute TTL from the step-1 proof (each keystroke in steps 2–3
 * renews it). The deadline is re-checked when the tab is shown again and before every step change and every send, so a
 * timer delayed by a throttled background tab never leaves an expired proof usable (`dropped`: step 1, O10).
 *
 * Rule 6: every button runs through the page's one `exclusive()` gate, guarded by `phase`.
 */
export function mountChangePassword(deps: PageDeps): ChangePasswordScreen {
  const field = byId<HTMLInputElement>('cp-field');
  const cta = byId<HTMLButtonElement>('cp-cta');
  const toggle = byId<HTMLButtonElement>('cp-toggle');
  const x = byId<HTMLButtonElement>('cp-x');
  const again = byId<HTMLButtonElement>('cp-again');
  const unlock = byId<HTMLButtonElement>('cp-unlock');
  const setup = byId<HTMLButtonElement>('cp-setup');
  const close = byId<HTMLButtonElement>('cp-close');
  const keep = byId<HTMLButtonElement>('cpc-keep');
  const cancelChange = byId<HTMLButtonElement>('cpc-cancel');
  const helperEl = byId('cp-helper');
  const live = byId('cp-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let phase: Phase = 'step1';
  let held: HeldProof | null = null;
  /** Bumped whenever the proof is dropped or the page is left: a step-1 proof that settles after is not kept (review M1). */
  let generation = 0;
  /** The new password from step 2, until step 3's send answers or the proof is dropped. */
  let chosen: string | null = null;
  /** Whether the held envelope had a passkey (the `done` line). */
  let hadPasskey = false;
  let deadline = 0;
  let ttl: number | null = null;
  let clearing: number | null = null;
  let stopCooldown: (() => void) | null = null;
  let action: Action = null;
  /** The cancel-confirm modal is up (over steps 2–3). */
  let asking = false;
  let reveal = false;
  /** Step 1's proof or step 2's `same` check is running: the field takes nothing. */
  let checking = false;

  const step = (): 1 | 2 | 3 => (phase === 'step2' ? 2 : phase === 'step3' || phase === 'changing' ? 3 : 1);
  const render = () => {
    const busy = deps.gate.isBusy();
    const s = step();
    const entry = phase === 'step1' || phase === 'step2' || phase === 'step3';
    const cooling = stopCooldown !== null;
    for (const n of [1, 2, 3] as const) {
      byId(`cp-seg-${n}`).classList.toggle('done', n < s || phase === 'done');
      byId(`cp-seg-${n}`).classList.toggle('cur', n === s && phase !== 'done');
    }
    setText(byId('cp-step'), CHANGE.stepOf(s));
    shown(byId('cp-stepper'), phase !== 'notice' && phase !== 'done');
    setText(byId('cp-title'), CHANGE.title[s]);
    setText(byId('cp-lede'), CHANGE.lede[s]);
    shown(byId('cp-entry'), entry && !cooling);
    shown(byId('cp-cooldown'), cooling);
    shown(byId('cp-changing'), phase === 'changing');
    shown(byId('cp-notice'), phase === 'notice' || phase === 'done');
    shown(helperEl, entry && !cooling);
    const newPassword = phase === 'step2' || phase === 'step3';
    field.type = newPassword && reveal ? 'text' : 'password';
    field.autocomplete = newPassword ? 'new-password' : 'current-password';
    shown(toggle, newPassword);
    toggle.setAttribute('aria-label', reveal ? PASSWORD.hide : PASSWORD.show);
    byId('cp-toggle-icon').setAttribute('href', reveal ? '#i-eye-off' : '#i-eye-on');
    shown(byId('cp-meter'), phase === 'step2');
    shown(byId('cp-meter-label'), phase === 'step2');
    renderMeter(byId('cp-meter'), byId('cp-meter-label'), field.value.length);
    // Typing is not a click: the field follows the phase, not the 500 ms floor (as #5, M2).
    field.disabled = !entry || cooling || checking;
    toggle.disabled = !newPassword;
    shown(cta, entry && !cooling);
    shown(byId('cp-paused'), cooling);
    setText(cta, phase === 'step3' ? CHANGE.change : CHANGE.continue);
    cta.disabled = busy || !entry || cooling || clearing !== null || (phase === 'step2' ? field.value.length < MIN_PASSWORD_LENGTH : field.value.length === 0);
    for (const [b, a] of [[again, 'again'], [unlock, 'unlock'], [setup, 'setup'], [close, 'close']] as const) {
      shown(b, (phase === 'notice' || phase === 'done') && action === a);
      b.disabled = busy;
    }
    x.disabled = busy && !cooling;
    keep.disabled = busy;
    cancelChange.disabled = busy;
  };
  const helper = (text: string, error: boolean) => {
    setText(helperEl, text);
    helperEl.classList.toggle('error', error);
    field.classList.toggle('is-error', error);
  };
  const noticeLines = (line: string, help: string) => {
    setText(byId('cp-notice-line'), line);
    setText(byId('cp-notice-help'), help);
    shown(byId('cp-notice-help'), help !== '');
  };

  /** Zero the held key and forget everything typed or chosen. Bumps `generation`: a proof still running is spent. */
  const dropProof = () => {
    generation += 1;
    held?.dataKey.fill(0);
    held = null;
    chosen = null;
    field.value = '';
    reveal = false;
    if (ttl !== null) deps.timers.clearTimeout(ttl);
    ttl = null;
    if (clearing !== null) deps.timers.clearTimeout(clearing);
    clearing = null;
  };
  /** `dropped` (C20, or the page left): step 1 again, with O10. */
  const dropped = () => {
    dropProof();
    asking = false;
    phase = 'step1';
    showScreen('v-change-password');
    helper(CHANGE.dropped, false);
    render();
  };
  const arm = () => {
    deadline = deps.timers.now() + HOLD_TTL_MS;
    if (ttl !== null) deps.timers.clearTimeout(ttl);
    ttl = deps.timers.setTimeout(() => {
      ttl = null;
      if (held !== null) dropped();
    }, HOLD_TTL_MS);
  };
  /** True — and the proof is dropped — when the deadline has passed (whatever the timer did). */
  const expired = (): boolean => {
    if (held === null || deps.timers.now() < deadline) return false;
    dropped();
    return true;
  };
  const notice = (line: string, help: string, next: Action) => {
    dropProof();
    phase = 'notice';
    action = next;
    noticeLines(line, help);
    render();
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('cp-timer'), label: byId('cp-cooldown-label'), ring: byId('cp-ring')});
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };

  const proveStep = () =>
    void exclusive(deps, render, async () => {
      if (phase !== 'step1' || field.value === '') return;
      const password = field.value;
      field.value = '';
      helper(CHANGE.checking, false);
      checking = true;
      render();
      const flow = {readEnvelope: deps.store.readEnvelope, send: deps.send};
      let proof: HeldProof | null = null;
      // Review M1: a `pagehide` during this KDF finds nothing held yet; the counter is how the settled proof learns it.
      const mine = generation;
      const out = await backoff.run(async () => {
        const r = await proveCurrent(flow, password, deps.kdf);
        if (r.outcome !== 'proven') return r.outcome;
        proof = r.held;
        return 'proven' as const;
      }, cooldown);
      checking = false;
      endCooldown();
      const p = proof as HeldProof | null;
      if (out === 'proven' && p !== null) {
        // The page was left (pagehide) or the proof otherwise dropped while it ran: nothing is kept.
        if (mine !== generation) {
          p.dataKey.fill(0);
          return dropped();
        }
        if (phase !== 'step1') return p.dataKey.fill(0);
        held = p;
        hadPasskey = p.env.passkey !== undefined;
        arm();
        phase = 'step2';
        helper('', false);
        render();
        field.focus();
        return;
      }
      if (out === 'wrong') return helper(COMMON.wrongConfirm, true);
      if (out === 'not-unlocked') return notice(ACCOUNTS.outcome['not-unlocked'], '', 'unlock');
      if (out === 'mismatch-locked') return notice(COMMON.mismatchLocked, '', null);
      if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
      if (out === 'no-wallet') return notice(COMMON.noWallet, '', 'setup');
      helper(CHANGE.failed, false);
    });

  const chooseStep = () => {
    if (expired()) return;
    void exclusive(deps, render, async () => {
      if (phase !== 'step2' || held === null || field.value.length < MIN_PASSWORD_LENGTH) return;
      const candidate = field.value;
      const proof = held;
      helper(CHANGE.checking, false);
      checking = true;
      render();
      let same: boolean;
      try {
        same = await isCurrentPassword(proof.env, candidate, deps.kdf);
      } catch {
        helper(CHANGE.failed, false);
        return;
      } finally {
        checking = false;
      }
      // Dropped (TTL, pagehide) while the check ran: nothing moves on.
      if (held !== proof || phase !== 'step2' || expired()) return;
      field.value = '';
      if (same) return helper(CHANGE.same, true);
      chosen = candidate;
      reveal = false;
      phase = 'step3';
      helper('', false);
      arm();
      render();
      field.focus();
    });
  };

  const changeStep = () => {
    if (expired()) return;
    void exclusive(deps, render, async () => {
      if (phase !== 'step3' || held === null || chosen === null || clearing !== null) return;
      const typed = field.value;
      if (typed !== chosen) {
        helper(CHANGE.mismatch, true);
        clearing = deps.timers.setTimeout(() => {
          clearing = null;
          field.value = '';
          field.classList.toggle('is-error', false);
          render();
        }, MISMATCH_CLEAR_MS);
        return;
      }
      const proof = held;
      const password = chosen;
      field.value = '';
      phase = 'changing';
      if (ttl !== null) deps.timers.clearTimeout(ttl);
      ttl = null;
      render();
      // changePassword zeroes the data key on every path: the proof is spent either way.
      const out = await changePassword({send: deps.send, kdf: deps.kdf}, proof, password);
      held = null;
      chosen = null;
      if (out === 'changed') {
        phase = 'done';
        action = 'close';
        noticeLines(CHANGE.updated, hadPasskey ? `${CHANGE.closeTab} ${CHANGE.passkeyStillWorks}` : CHANGE.closeTab);
        return render();
      }
      if (out === 'busy') return notice(RESTORE.busy, '', 'again');
      if (out === 'locked') return notice(ACCOUNTS.outcome['not-unlocked'], '', 'unlock');
      if (out === 'no-wallet') return notice(COMMON.noWallet, '', 'setup');
      if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
      notice(CHANGE.failed, '', 'again');
    });
  };

  /** The X: at step 1 (nothing held) it closes; over steps 2–3 it asks first (cancel-confirm). */
  const doX = () => {
    if (phase === 'step2' || phase === 'step3') {
      if (expired()) return;
      void exclusive(deps, render, async () => {
        if (phase !== 'step2' && phase !== 'step3') return;
        asking = true;
        showScreen('v-cp-cancel');
      });
      return;
    }
    if (phase === 'changing') return;
    void exclusive(deps, render, async () => {
      dropProof();
      deps.closeTab();
    });
  };

  deps.gate.onIdle(render);
  byId('cp-form').addEventListener('submit', e => {
    e.preventDefault();
    if (phase === 'step1') proveStep();
    else if (phase === 'step2') chooseStep();
    else if (phase === 'step3') changeStep();
  });
  cta.addEventListener('click', () => {
    if (phase === 'step1') proveStep();
    else if (phase === 'step2') chooseStep();
    else if (phase === 'step3') changeStep();
  });
  field.addEventListener('input', () => {
    // C20: each keystroke in steps 2–3 renews the deadline — unless it has already passed.
    if ((phase === 'step2' || phase === 'step3') && !expired()) arm();
    if (clearing === null) field.classList.toggle('is-error', false);
    render();
  });
  toggle.addEventListener('click', () => {
    if (phase !== 'step2' && phase !== 'step3') return;
    reveal = !reveal;
    render();
  });
  x.addEventListener('click', doX);
  keep.addEventListener('click', () => {
    if (!asking) return;
    void exclusive(deps, render, async () => {
      asking = false;
      showScreen('v-change-password');
      if (!expired()) field.focus();
    });
  });
  byId('cpc-backdrop').addEventListener('click', () => keep.click());
  cancelChange.addEventListener('click', () => {
    if (!asking) return;
    void exclusive(deps, render, async () => {
      asking = false;
      dropProof();
      phase = 'notice';
      action = null;
      noticeLines(CHANGE.closeTab, '');
      showScreen('v-change-password');
      deps.closeTab();
    });
  });
  again.addEventListener('click', () => {
    if (action !== 'again') return;
    void exclusive(deps, render, async () => {
      action = null;
      phase = 'step1';
      helper('', false);
      render();
      field.focus();
    });
  });
  unlock.addEventListener('click', () => {
    if (action !== 'unlock') return;
    void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
  });
  setup.addEventListener('click', () => {
    if (action !== 'setup') return;
    void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  close.addEventListener('click', () => {
    if (action !== 'close') return;
    void exclusive(deps, render, async () => deps.closeTab());
  });
  // The M2 ruling: a hidden tab keeps steps 2–3 and the held key (a password manager is in another tab). Step 1's typed
  // password follows 2a's rule. `pagehide` drops everything (the page may sit in the back/forward cache).
  deps.onLeave(why => {
    if (why === 'pagehide') {
      if (held !== null || chosen !== null) dropped();
      else {
        // Nothing held — but a step-1 proof may be running: it must not be kept when it settles (review M1).
        generation += 1;
        field.value = '';
      }
      return;
    }
    if (phase === 'step1') field.value = '';
  });
  deps.onReturn(why => {
    // `restored`: back from the back/forward cache, where timers were frozen (review M1).
    if (why === 'visible' || why === 'restored') expired();
  });

  return {
    show() {
      phase = 'step1';
      showScreen('v-change-password');
      helper('', false);
      render();
      field.focus();
    },
    holds: () => ({key: held !== null && held.dataKey.some(b => b !== 0), password: chosen !== null || field.value !== ''}),
  };
}
````

Modify `extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 1a4c27b..abeee69 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -221,6 +221,39 @@ export const PASSKEY = {
   failed: 'Something went wrong. Your password still works.',
 } as const;
 
+/**
+ * #36 change-pin → change password (B1b-2b §3.1, D8, C20). Adapted from the design's PIN copy (2a-D7); O-numbers are
+ * the owner-confirmed controller additions (spec §12).
+ */
+export const CHANGE = {
+  stepOf: (n: 1 | 2 | 3): string => `Step ${n} of 3`,
+  title: {1: 'Enter current password', 2: 'Choose a new password', 3: 'Confirm new password'},
+  lede: {
+    1: "Verify it's you before changing your password.",
+    2: 'At least 12 characters. A few unrelated words work well.',
+    3: 'Enter the same password again.',
+  },
+  /** O01. */
+  continue: 'Continue',
+  /** O03. */
+  change: 'Change password',
+  checking: 'Checking…',
+  /** O02 (step-2 `same`). */
+  same: 'That is your current password. Choose a new one.',
+  /** 36d, adapted ("PINs don't match — try again"). */
+  mismatch: "Passwords don't match — try again",
+  /** 36e, adapted ("PIN updated"). */
+  updated: 'Password updated.',
+  /** O05. */
+  closeTab: 'You can close this tab.',
+  /** O06. */
+  passkeyStillWorks: 'Your passkey still works.',
+  /** O07. */
+  failed: 'Something went wrong. Your password was not changed.',
+  /** O10 (`dropped`: the page was left, or the 5-minute TTL ran out, C20). */
+  dropped: 'Enter your current password again.',
+} as const;
+
 /** #9 unlock (D7, D11). */
 export const UNLOCK = {
   unlocking: 'Unlocking…',
````

Modify `extension/src/unlock/view/dom.ts`:

````diff
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index 4625ee3..9e68394 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -43,6 +43,8 @@ export const SCREENS = [
   'v-reauth',
   'v-accounts',
   'v-reveal',
+  'v-change-password',
+  'v-cp-cancel',
 ] as const;
 export type ScreenId = (typeof SCREENS)[number];
````

Modify `extension/unlock.html`:

````diff
diff --git a/extension/unlock.html b/extension/unlock.html
index d8f88f5..f277d74 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -493,6 +493,72 @@
         </div>
       </section>
 
+      <!-- #36 change-pin → change password (B1b-2b §3.1, D8, C20): three steps in the vault tab; the held proof lives 5 minutes. -->
+      <section id="v-change-password" class="screen s-pin" hidden>
+        <div class="top-bar">
+          <button id="cp-x" type="button" class="icon-btn" aria-label="Close"><svg width="22" height="22" aria-hidden="true"><use href="#i-x" /></svg></button>
+          <span class="title noc-h1">Change password</span>
+        </div>
+        <div id="cp-stepper" class="s7-stepper">
+          <span id="cp-seg-1" class="seg"></span><span id="cp-seg-2" class="seg"></span><span id="cp-seg-3" class="seg"></span>
+          <span id="cp-step" class="label noc-numeral"></span>
+        </div>
+        <div id="cp-entry" class="pin-head">
+          <h2 id="cp-title" class="noc-h2"></h2>
+          <p id="cp-lede" class="noc-body-sm vlt-lede vlt-narrow"></p>
+          <label for="cp-field" class="noc-body-sm vlt-lede vlt-field-label">Password</label>
+          <form id="cp-form" class="vlt-field-row vlt-field-row-labelled">
+            <input id="cp-field" class="vlt-input" type="password" autocomplete="current-password" />
+            <button id="cp-toggle" type="button" class="icon-btn" aria-label="Show password" hidden><svg width="20" height="20" aria-hidden="true"><use id="cp-toggle-icon" href="#i-eye-on" /></svg></button>
+          </form>
+          <div id="cp-meter" class="vlt-meter" aria-hidden="true" hidden><i></i><i></i><i></i><i></i></div>
+          <p id="cp-meter-label" class="noc-caption vlt-muted" hidden></p>
+        </div>
+        <p id="cp-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        <div id="cp-cooldown" hidden>
+          <div class="vlt-pad-cooldown">
+            <h1 class="noc-h1 vlt-center vlt-gap-2">Wait a moment</h1>
+            <p class="noc-body vlt-lede vlt-center vlt-narrow-300 vlt-gap-5">That did not confirm it. Wait a moment before trying again.</p>
+          </div>
+          <div class="cooldown-card">
+            <div id="cp-ring" class="ring"></div>
+            <div id="cp-timer" class="timer noc-numeral"></div>
+            <div id="cp-cooldown-label" class="noc-body-sm label"></div>
+          </div>
+        </div>
+        <span id="cp-cooldown-live" class="vlt-sr" aria-live="polite"></span>
+        <div id="cp-changing" class="vlt-notice" role="status" hidden>
+          <p class="noc-body">Updating your password…</p>
+          <p class="noc-body-sm vlt-lede">Securing your password takes a few seconds.</p>
+          <progress class="noc-progress" aria-label="Updating your password"></progress>
+        </div>
+        <div id="cp-notice" class="vlt-notice" role="status" hidden>
+          <p id="cp-notice-line" class="noc-body"></p>
+          <p id="cp-notice-help" class="noc-body-sm vlt-lede"></p>
+        </div>
+        <div class="pin-spacer"></div>
+        <div class="sticky-bar">
+          <button id="cp-cta" type="button" class="btn btn-primary"></button>
+          <button id="cp-paused" type="button" class="btn btn-secondary" disabled hidden>Confirm paused</button>
+          <button id="cp-again" type="button" class="btn btn-primary" hidden>Start again</button>
+          <button id="cp-unlock" type="button" class="btn btn-primary" hidden>Unlock</button>
+          <button id="cp-setup" type="button" class="btn btn-primary" hidden>Set up a wallet</button>
+          <button id="cp-close" type="button" class="btn btn-secondary" hidden>Close this tab</button>
+        </div>
+      </section>
+
+      <!-- #36's cancel-confirm (ix:14918; the X during steps 2–3): #3's modal chrome. -->
+      <section id="v-cp-cancel" class="screen s-seed-modal" hidden>
+        <div id="cpc-backdrop" class="modal-backdrop"></div>
+        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="cpc-title">
+          <h2 id="cpc-title" class="noc-h2">Cancel password change?</h2>
+          <div class="ctas">
+            <button id="cpc-keep" type="button" class="btn btn-primary">Keep changing</button>
+            <button id="cpc-cancel" type="button" class="btn btn-secondary">Cancel change</button>
+          </div>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/__tests__/designExt2b.test.ts src/unlock/__tests__/changePasswordScreen.test.ts src/unlock/__tests__/fakeTimers.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 3 passed (3) · Tests 396 passed (396); tsc clean; whole suite Test Files 125 passed (125) · Tests 2236 passed (2236); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  #36 36a step 1, wrong, 36b step 2 (meter), same-password, 36c step 3, the cancel modal, 36d mismatch (paused clock), changing (held KDF), done (with the passkey line), dropped (TTL) — Task 20 shoots each; check against index.html #36 with §8.4's checklist (stepper segments, the field's eye toggle, the meter's colours, the sticky CTA, the modal's chrome).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M8a** — C20: an expired proof moves on after the same-password check — `extension/src/unlock/screens/changePassword.ts`:

  ```diff
  - if (held !== proof || phase !== 'step2' || expired()) return;
  + if (held !== proof || phase !== 'step2') return;
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/changePasswordScreen.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M8b** — the hold TTL doubled — `extension/src/unlock/screens/changePassword.ts`:

  ```diff
  - deadline = deps.timers.now() + HOLD_TTL_MS;
  + deadline = deps.timers.now() + 2 * HOLD_TTL_MS;
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/changePasswordScreen.test.ts` — Expected: **red** (dry run: 4 failed (Playwright)).

- **M8c** — M1: a proof settling after pagehide is kept — `extension/src/unlock/screens/changePassword.ts`:

  ```diff
  -         if (mine !== generation) {
  -           p.dataKey.fill(0);
  -           return dropped();
  -         }
  + (deleted)
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/changePasswordScreen.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M8d** — M1: restored does not re-check the deadline — `extension/src/unlock/screens/changePassword.ts`:

  ```diff
  - if (why === 'visible' || why === 'restored') expired();
  + if (why === 'visible') expired();
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/changePasswordScreen.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/e2e/visual-vault.spec.ts extension/scripts/__tests__/check-vault-isolation.test.mjs extension/src/__tests__/designExt2b.test.ts extension/src/styles/design-ext.css extension/src/unlock/__tests__/changePasswordScreen.test.ts extension/src/unlock/__tests__/fakeTimers.ts extension/src/unlock/mode.ts extension/src/unlock/modes.ts extension/src/unlock/screens/changePassword.ts extension/src/unlock/strings.ts extension/src/unlock/view/dom.ts extension/unlock.html
git commit -F - <<'MSG'
feat(extension): #36 change password in the vault tab (36a–36d + the extension states); design-ext regenerated

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 9: `?mode=delete` — #37's proof page: the address it will delete, C17's revision binding, `deleteWallet`

**Spec:** §3.2, E11, D9–D11, C6, C17; O11–O16

**Files:**
- Modify: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Create: `extension/src/unlock/__tests__/deleteScreen.test.ts`
- Modify: `extension/src/unlock/__tests__/pageHarness.ts`
- Modify: `extension/src/unlock/mode.ts`
- Modify: `extension/src/unlock/modes.ts`
- Create: `extension/src/unlock/screens/delete.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/src/unlock/view/dom.ts`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Task 6's `deleteWallet`; `proveFactor`; `envelopeRevision`; `addressGroups` (`view/words.ts`); the backoff and cooldown helpers.
- Produces (exact signatures, as exported):
  - `export interface DeleteScreen`
  - `export function firstAccount(env: EnvelopeV1): string`
  - `export function mountDelete(deps: PageDeps): DeleteScreen`
  - `export const DELETE =`

The page shows the **first account by lowest index** of the stored envelope (never the popup's top row) and remembers that envelope's revision. Before any KDF runs, it re-reads the envelope: a different revision (another wallet, an account added, a passkey removed) is `changed` — "The wallet in this browser changed. Check the address and try again." — with the new address shown, nothing proven, **no wrong attempt charged** (C17). Otherwise `proveFactor` (password or passkey; no session needed) and `deleteWallet`. Outcomes: deleted → `?mode=welcome`; `send-open` → the wallet is locked, nothing deleted, [Unlock] and [Close this tab]; `busy` → [Start again]; no wallet / damaged notices. Only `screens/delete.ts` and `forgetFlow.ts` name `deleteWallet`'s message (a source test).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index 14f4c9a..2cdafac 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -1526,7 +1526,7 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
     // and views — a module added or removed there is named here too, and each named one must be reached.
     const named = ['welcome', 'seed', 'confirm', 'password', 'passkey', 'createRun', 'importScreen', 'importRun', 'restoreRun', 'retryRun', 'forgot', 'unlock', 'reauth', 'accounts', 'reveal',
       // B1b-2b plan 1.
-      'changePassword'];
+      'changePassword', 'delete'];
     expect([...screens].sort()).toEqual(named.map(n => `src/unlock/screens/${n}.ts`).sort());
     expect([...views].sort()).toEqual(['dom', 'words', 'hold', 'meter', 'cooldown'].map(n => `src/unlock/view/${n}.ts`).sort());
     expect(resolved).toEqual(
````

Create `extension/src/unlock/__tests__/deleteScreen.test.ts`:

````ts
// @vitest-environment happy-dom
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {derivePublicKeys} from '../../vault/accounts';
import {reencryptForAccounts} from '../../vault/reencrypt';
import {VAULT_KEY} from '../../background/accountsStore';
import {PENDING_KEY} from '../../background/pendingStore';
import {pendingRecord} from '../../background/__tests__/fixtures';
import type {CredentialsApi} from '../../vault/passkey';
import {firstAccount, mountDelete} from '../screens/delete';
import {pageMode} from '../mode';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1b-2b §3.2 (#37's proof, E11, C17) against the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PW = 'correct horse battery';
const PRF = crypto.getRandomValues(new Uint8Array(32));

beforeEach(loadPage);

async function wallet(mnemonic = M, indexes = [0], o: {passkey?: boolean} = {}): Promise<EnvelopeV1> {
  const keys = await derivePublicKeys(mnemonic, 'slip10', indexes);
  let env = await createEnvelope({mnemonic, password: PW, scheme: 'slip10', accounts: indexes.map((index, i) => ({index, name: `Account ${index + 1}`, publicKey: keys[i] ?? ''})), kdf: testKdf});
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), PRF.slice(), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
  return env;
}
/** A passkey authenticator that answers with PRF. */
const prfCredentials = (): CredentialsApi => ({
  create: async () => null,
  get: async () => ({getClientExtensionResults: () => ({prf: {results: {first: PRF.slice().buffer}}})}) as unknown as Credential,
});
async function shown(env: EnvelopeV1 | undefined, o: {holdSleep?: boolean; credentials?: CredentialsApi} = {}) {
  const h = await harness({vault: env, deleteMode: true, ...o});
  let kdfRuns = 0;
  h.deps.kdf = async (pw, salt, p) => (kdfRuns++, testKdf(pw, salt, p));
  const screen = mountDelete(h.deps);
  await screen.show();
  return {h, screen, kdfRuns: () => kdfRuns};
}
const forgets = (h: Harness) => h.sent.filter(m => m.type === 'vault.forgetWallet');
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());

describe('#37’s proof: the delete page', () => {
  it('idle: its copy, the first account’s address in groups of four (the LOWEST index, not list order), the passkey button when stored', async () => {
    // Envelope order 2, 0: the first account is index 0's, never the first listed (rev 3, review M1).
    const env = await wallet(M, [2, 0], {passkey: true});
    await shown(env);
    expect(pageMode('?mode=delete')).toEqual({mode: 'delete'});
    const k0 = env.accounts.find(a => a.index === 0)?.publicKey ?? '';
    expect(firstAccount(env)).toBe(k0);
    expect([...el('dl-address').querySelectorAll('.addr-groups span')].map(s => s.textContent).join('')).toBe(k0);
    expect(text(el('v-delete').querySelector('h2'))).toBe('Delete this wallet?');
    expect(text(el('dl-entry'))).toContain("This wallet's first account");
    expect(text(el('dl-entry'))).toContain('Enter your password to delete this wallet from this browser. Your funds stay on Solana; your recovery phrase still controls them.');
    expect(text(el('dl-delete'))).toBe('Delete wallet');
    expect(visible(el('dl-passkey'))).toBe(true);
    expect(text(el('dl-passkey'))).toBe('Confirm with passkey');
    expect(text(el('dl-cancel'))).toBe('Cancel');
    expect(unstyled('v-delete')).toEqual([]);
  });

  it('the right password deletes the wallet — one forget with neither field — and lands on welcome, no toast', async () => {
    const {h} = await shown(await wallet());
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    expect(el<HTMLInputElement>('dl-password').value).toBe('');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['unlock.html?mode=welcome']);
    expect(forgets(h)).toHaveLength(1);
    expect(Object.keys(forgets(h)[0] ?? {}).sort()).toEqual(['expectedRevision', 'type']);
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('a wrong password: "That did not confirm it." and the wallet stays', async () => {
    const {h} = await shown(await wallet());
    type(el<HTMLInputElement>('dl-password'), 'nope nope nope nope');
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')) === 'That did not confirm it.');
    expect(forgets(h)).toEqual([]);
    expect(await h.ext.local.get(VAULT_KEY)).toBeDefined();
  });

  it('C17 rev 3: the wallet REPLACED under the tab — the old password is `changed`, no KDF run, not charged, the new address shown', async () => {
    const a = await wallet(M);
    const b = await wallet(OTHER);
    const {h, kdfRuns} = await shown(a);
    await h.ext.local.set(VAULT_KEY, b);
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')) === 'The wallet in this browser changed. Check the address and try again.' && !h.deps.gate.isBusy());
    expect(kdfRuns()).toBe(0);
    expect([...el('dl-address').querySelectorAll('.addr-groups span')].map(s => s.textContent).join('')).toBe(firstAccount(b));
    expect(visible(el('dl-cooldown'))).toBe(false);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(b);
    expect(forgets(h)).toEqual([]);
    // Never charged: a wrong guess right after waits nothing (the first wrong in a streak has no wait).
    type(el<HTMLInputElement>('dl-password'), 'nope nope nope nope');
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')) === 'That did not confirm it.' && !h.deps.gate.isBusy());
    expect(visible(el('dl-cooldown'))).toBe(false);
  });

  it('C17: the same wallet at a new revision (an account added) is `changed` too; a new proof then deletes the wallet now shown', async () => {
    const a = await wallet(M, [0]);
    const {h} = await shown(a);
    const moved = await reencryptForAccounts(a, await unlockWithPassword(a, PW, testKdf), [{index: 0, name: 'Account 1'}, {index: 1, name: 'Account 2'}]);
    await h.ext.local.set(VAULT_KEY, moved);
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')).startsWith('The wallet in this browser changed.') && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => h.went.length === 1);
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('send-open: the pending line + O15, [Unlock] → ?mode=unlock and [Close this tab]; the vault intact', async () => {
    const env = await wallet();
    const {h} = await shown(env);
    await h.ext.local.set(PENDING_KEY, [pendingRecord({account: env.accounts[0]?.publicKey})]);
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => visible(el('dl-notice')));
    expect(text(el('dl-notice-line'))).toBe('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.');
    expect(text(el('dl-notice-help'))).toBe('The wallet has been locked. Nothing was deleted.');
    expect([visible(el('dl-unlock')), visible(el('dl-close')), visible(el('dl-cancel'))]).toEqual([true, true, false]);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(env);
    await idle(h);
    click(el('dl-unlock'));
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['unlock.html?mode=unlock']);
  });

  it('a damaged vault: the damaged lines, no delete (D10); no wallet: the notice and [Set up a wallet]', async () => {
    await shown({...(await wallet()), seed: 'x'} as unknown as EnvelopeV1);
    expect(text(el('dl-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(visible(el('dl-delete'))).toBe(false);
    loadPage();
    await shown(undefined);
    expect(text(el('dl-notice-line'))).toBe('No wallet on this browser yet.');
    expect(visible(el('dl-setup'))).toBe(true);
  });

  it('the passkey: unavailable says so; with PRF output it deletes (the PRF zeroed by the proof)', async () => {
    const none = await shown(await wallet(M, [0], {passkey: true}));
    click(el('dl-passkey'));
    await none.h.until(() => text(el('dl-helper')) === 'This device cannot confirm with a passkey; your password still works.');
    loadPage();
    const yes = await shown(await wallet(M, [0], {passkey: true}), {credentials: prfCredentials()});
    click(el('dl-passkey'));
    await yes.h.until(() => yes.h.went.length === 1);
    expect(await yes.h.ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('rule 6: a second Delete inside the floor (`disabled` lifted) sends no second proof', async () => {
    const {h, kdfRuns} = await shown(await wallet(), {holdSleep: true});
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    el<HTMLButtonElement>('dl-delete').disabled = false;
    el<HTMLInputElement>('dl-password').disabled = false;
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => forgets(h).length === 1);
    await new Promise(r => setTimeout(r, 20));
    expect(kdfRuns()).toBe(1);
    expect(forgets(h)).toHaveLength(1);
    h.wake();
  });

  it('a hidden tab empties the field', async () => {
    const {h, screen} = await shown(await wallet());
    type(el<HTMLInputElement>('dl-password'), PW);
    h.leave();
    expect(screen.holds()).toBe(false);
  });
});

// E11: deleteWallet is reachable from ONE screen — the delete page. Every other src/unlock file is held away from it.
describe('the deleteWallet boundary (source)', () => {
  it('only screens/delete.ts (and forgetFlow.ts, which defines it) names deleteWallet', () => {
    const root = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
          if (e !== '__tests__') walk(p);
        } else if (/\.ts$/.test(e)) files.push(relative(root, p).split(sep).join('/'));
      }
    };
    walk(root);
    expect(files.filter(f => /\bdeleteWallet\b/.test(readFileSync(join(root, f), 'utf8'))).sort()).toEqual(['forgetFlow.ts', 'screens/delete.ts']);
  });
});
````

Modify `extension/src/unlock/__tests__/pageHarness.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/pageHarness.ts b/extension/src/unlock/__tests__/pageHarness.ts
index 09c7025..12a66b5 100644
--- a/extension/src/unlock/__tests__/pageHarness.ts
+++ b/extension/src/unlock/__tests__/pageHarness.ts
@@ -55,7 +55,19 @@ export interface Harness {
  * floor and the backoff waits are asserted through the clock where a test needs them.
  */
 export async function harness(
-  o: {vault?: unknown; reader?: Partial<WalletDeps['reader']>; send?: (inner: Send) => Send; credentials?: CredentialsApi; mnemonic?: string; holdSleep?: boolean} = {},
+  o: {
+    vault?: unknown;
+    reader?: Partial<WalletDeps['reader']>;
+    send?: (inner: Send) => Send;
+    credentials?: CredentialsApi;
+    mnemonic?: string;
+    holdSleep?: boolean;
+    /**
+     * B1b-2b E11: the delete mode's harness. Its one forget is #37's bare delete — so the tripwire inverts: a forget
+     * carrying a `replacement` or a `guard` throws instead.
+     */
+    deleteMode?: boolean;
+  } = {},
 ): Promise<Harness> {
   const ext = fakeExt();
   if ('vault' in o && o.vault !== undefined) await ext.local.set(VAULT_KEY, o.vault);
@@ -71,7 +83,9 @@ export async function harness(
   // Checked on the page's own send, before a test's `send` wrapper can answer in the background's place.
   const send: Send = async m => {
     const f = m as {type?: unknown; replacement?: unknown; guard?: unknown};
-    if (f.type === 'vault.forgetWallet' && f.replacement === undefined && f.guard !== 'unfunded') throw new Error('forgetWallet without replacement or guard');
+    if (o.deleteMode === true) {
+      if (f.type === 'vault.forgetWallet' && (f.replacement !== undefined || f.guard !== undefined)) throw new Error('the delete page sent a forgetWallet with a replacement or a guard');
+    } else if (f.type === 'vault.forgetWallet' && f.replacement === undefined && f.guard !== 'unfunded') throw new Error('forgetWallet without replacement or guard');
     return outer(m);
   };
   const read = () => ext.local.get(VAULT_KEY);
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/unlock/__tests__/deleteScreen.test.ts src/unlock/__tests__/pageHarness.ts
```
Expected (dry run, these test files on Task 8's tree): **red** — Test Files 2 failed (2) · Tests 1 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/unlock/mode.ts`:

````diff
diff --git a/extension/src/unlock/mode.ts b/extension/src/unlock/mode.ts
index 0a89dd2..3307370 100644
--- a/extension/src/unlock/mode.ts
+++ b/extension/src/unlock/mode.ts
@@ -13,7 +13,9 @@ export type PageMode =
   | {mode: 'reveal'}
   | {mode: 'reauth'; challengeId: string}
   /** B1b-2b §1.2: #36 change password (unlocked session, password only, D8). */
-  | {mode: 'password'};
+  | {mode: 'password'}
+  /** B1b-2b §1.2: #37's proof — no session needed (E5's factor proof), bound to the wallet it shows (C17). */
+  | {mode: 'delete'};
 
 const SOURCES: readonly string[] = ['forgot', 'retry'];
 const RETURNS: readonly string[] = ['created', 'imported'];
@@ -26,7 +28,7 @@ const RETURNS: readonly string[] = ['created', 'imported'];
 export function pageMode(search: string): PageMode {
   const p = new URLSearchParams(search);
   const m = p.get('mode');
-  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal' || m === 'password') return {mode: m};
+  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal' || m === 'password' || m === 'delete') return {mode: m};
   if (m === 'import') {
     const source = p.get('source') ?? '';
     return {mode: 'import', source: SOURCES.includes(source) ? (source as ImportSource) : null};
````

Modify `extension/src/unlock/modes.ts`:

````diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index d671b1a..5001018 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -2,6 +2,7 @@ import type {PageMode} from './mode';
 import type {PageDeps} from './page';
 import {mountAccounts} from './screens/accounts';
 import {mountChangePassword} from './screens/changePassword';
+import {mountDelete} from './screens/delete';
 import {createCreateRun} from './screens/createRun';
 import {mountForgot} from './screens/forgot';
 import {createImportRun} from './screens/importRun';
@@ -53,6 +54,9 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
     case 'reveal':
       mountReveal(deps).show();
       return;
+    case 'delete':
+      void mountDelete(deps).show();
+      return;
     case 'password':
       mountChangePassword(deps).show();
       return;
````

Create `extension/src/unlock/screens/delete.ts`:

````ts
import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {EnvelopeV1} from '../../vault/envelope';
import type {ReauthFactor} from '../../vault/reauth';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {deleteWallet, proveFactor, type FactorProof} from '../forgetFlow';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, DELETE, RESTORE, cooldownLabel} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';
import {addressGroups} from '../view/words';

export interface DeleteScreen {
  show(): Promise<void>;
  /** For the tests: a typed password the screen still references. */
  holds(): boolean;
}

type View = 'loading' | 'entry' | 'notice';
type Action = 'unlock' | 'again' | 'setup' | 'close';

/** C17 (rev 3, review M1): "first account" is the account with the LOWEST index — never the display order, never list position. */
export function firstAccount(env: EnvelopeV1): string {
  let low = env.accounts[0];
  for (const a of env.accounts) if (low === undefined || a.index < low.index) low = a;
  return low?.publicKey ?? '';
}

/**
 * #37's proof (spec B1b-2b §3.2, E11, D9, D10, C17) in the vault tab, after #37's typed DELETE and 1 s hold in the popup.
 * The page names the wallet it deletes: it reads the envelope's public fields at load and shows the first account's
 * address (C17); at the click, BEFORE any KDF run or passkey prompt, it reads the envelope again and compares the
 * revision with the one it showed — a different one (another wallet, or any change) is `changed`: nothing proven,
 * nothing sent, never charged to the backoff, the new address shown. Only on a match does the factor proof run
 * (proveFactor: password or passkey, no session — it works locked), then deleteWallet: the one E5 delete message, with
 * neither `replacement` nor `guard` (D11: a funded wallet is deleted too). Deleted → the welcome page, no toast (the
 * absence of the wallet IS the confirmation, ix:15138). A damaged vault cannot be deleted here (D10).
 *
 * The password leaves the field at the click; a hidden tab or `pagehide` empties the field (2a §3.5). Rule 6: the
 * page's one `exclusive()` gate on every button, guarded by `view`.
 */
export function mountDelete(deps: PageDeps): DeleteScreen {
  const field = byId<HTMLInputElement>('dl-password');
  const del = byId<HTMLButtonElement>('dl-delete');
  const passkey = byId<HTMLButtonElement>('dl-passkey');
  const cancel = byId<HTMLButtonElement>('dl-cancel');
  const buttons = {unlock: byId<HTMLButtonElement>('dl-unlock'), again: byId<HTMLButtonElement>('dl-again'), setup: byId<HTMLButtonElement>('dl-setup'), close: byId<HTMLButtonElement>('dl-close')};
  const helperEl = byId('dl-helper');
  const live = byId('dl-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let view: View = 'loading';
  /** The notice's buttons (none: the page's [Cancel] closes the tab). */
  let actions: readonly Action[] = [];
  /** The revision of the envelope whose address is on screen (C17). */
  let shownRevision: string | null = null;
  let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
  let stopCooldown: (() => void) | null = null;
  let typed: string | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    const cooling = stopCooldown !== null;
    shown(byId('dl-entry'), entry && !cooling);
    shown(helperEl, entry && !cooling);
    shown(byId('dl-cooldown'), cooling);
    shown(byId('dl-notice'), view === 'notice');
    shown(del, entry && !cooling);
    shown(byId('dl-paused'), cooling);
    shown(passkey, entry && !cooling && pk !== null);
    field.disabled = busy || !entry;
    del.disabled = busy || !entry;
    passkey.disabled = busy || !entry || pk === null;
    cancel.disabled = busy && !cooling;
    for (const [name, b] of Object.entries(buttons)) {
      shown(b, view === 'notice' && actions.includes(name as Action));
      b.disabled = busy;
    }
    shown(cancel, view !== 'notice' || actions.length === 0);
  };
  const helper = (text: string, tone: 'plain' | 'error' | 'warn') => {
    setText(helperEl, text);
    helperEl.classList.toggle('error', tone === 'error');
    helperEl.classList.toggle('warn', tone === 'warn');
    field.classList.toggle('is-error', tone === 'error');
  };
  const notice = (line: string, help: string, next: readonly Action[]) => {
    view = 'notice';
    actions = next;
    field.value = '';
    setText(byId('dl-notice-line'), line);
    setText(byId('dl-notice-help'), help);
    shown(byId('dl-notice-help'), help !== '');
    render();
  };
  /** The stored envelope's first account and revision on screen (C17). */
  const showWallet = (env: EnvelopeV1) => {
    shownRevision = envelopeRevision(env);
    pk = env.passkey ?? null;
    byId('dl-address').replaceChildren(addressGroups(firstAccount(env)));
  };
  /** Reads what is stored now: the envelope, or the notice it reads as (null). */
  const readWallet = async (): Promise<EnvelopeV1 | null> => {
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      notice(COMMON.unreadable, '', []);
      return null;
    }
    const stored = storedVault(raw);
    if (stored.kind === 'none') {
      notice(COMMON.noWallet, '', ['setup']);
      return null;
    }
    if (stored.kind === 'damaged') {
      notice(COMMON.damaged, COMMON.damagedHelp, []);
      return null;
    }
    return stored.env;
  };
  /** C17: the wallet under the tab is still the one on screen — checked before any KDF run or passkey prompt. */
  const stillShown = async (): Promise<boolean> => {
    const env = await readWallet();
    if (env === null) return false;
    if (envelopeRevision(env) === shownRevision) return true;
    showWallet(env);
    field.value = '';
    helper(DELETE.changed, 'warn');
    render();
    return false;
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('dl-timer'), label: byId('dl-cooldown-label'), ring: byId('dl-ring')});
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };
  /** The proof and the delete, under the backoff (only a wrong factor is charged). */
  const prove = async (factor: ReauthFactor) => {
    helper(DELETE.deleting, 'plain');
    let proof: FactorProof | null = null;
    const out = await backoff.run(async () => {
      const r = await proveFactor(deps.store.readEnvelope, factor);
      if (r.outcome !== 'proven') return r.outcome;
      proof = r.proof;
      return 'proven' as const;
    }, cooldown);
    endCooldown();
    const p = proof as FactorProof | null;
    if (out === 'wrong') return helper(COMMON.wrongConfirm, 'error');
    if (out === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
    if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, []);
    if (out !== 'proven' || p === null) return helper(DELETE.failed, 'plain');
    const r = await deleteWallet(deps.send, p);
    if (r === 'deleted') return deps.go('unlock.html?mode=welcome');
    // E5 locked the wallet before it refused (review M1): the way back in, and the way out.
    if (r === 'send-open') return notice(RESTORE.sendOpen, DELETE.lockedNothingDeleted, ['unlock', 'close']);
    if (r === 'busy') return notice(RESTORE.busy, '', ['again']);
    if (r === 'unlocked') return notice(RESTORE.unlocked, '', ['again']);
    if (r === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
    if (r === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, []);
    helper(DELETE.failed, 'plain');
  };
  const withPassword = () => {
    if (view !== 'entry' || field.value === '') return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry' || field.value === '') return;
      typed = field.value;
      field.value = '';
      const password = typed;
      typed = null;
      if (!(await stillShown())) return;
      await prove({password, kdf: deps.kdf});
    });
  };
  const withPasskey = () => {
    if (view !== 'entry' || pk === null) return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry') return;
      field.value = '';
      if (!(await stillShown())) return;
      const key = pk;
      if (key === null) return;
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      if (prfOutput === null) return helper(COMMON.passkeyUnavailableConfirm, 'plain');
      // proveFactor zeroes the PRF output on every path.
      await prove({prfOutput});
    });
  };
  const load = async () => {
    view = 'loading';
    actions = [];
    endCooldown();
    helper('', 'plain');
    render();
    const env = await readWallet();
    if (env === null) return;
    showWallet(env);
    view = 'entry';
    render();
    field.focus();
  };

  deps.gate.onIdle(render);
  byId('dl-form').addEventListener('submit', e => {
    e.preventDefault();
    withPassword();
  });
  del.addEventListener('click', withPassword);
  passkey.addEventListener('click', withPasskey);
  cancel.addEventListener('click', () => void exclusive(deps, render, async () => deps.closeTab()));
  buttons.unlock.addEventListener('click', () => {
    if (actions.includes('unlock')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
  });
  buttons.setup.addEventListener('click', () => {
    if (actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  buttons.close.addEventListener('click', () => {
    if (actions.includes('close')) void exclusive(deps, render, async () => deps.closeTab());
  });
  buttons.again.addEventListener('click', () => {
    if (actions.includes('again')) void exclusive(deps, render, load);
  });
  deps.onLeave(() => {
    field.value = '';
  });

  return {
    async show() {
      showScreen('v-delete');
      await load();
    },
    holds: () => typed !== null || field.value !== '',
  };
}
````

Modify `extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index abeee69..e12b92a 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -254,6 +254,18 @@ export const CHANGE = {
   dropped: 'Enter your current password again.',
 } as const;
 
+/** #37's proof in the vault tab (B1b-2b §3.2, E11, C17). */
+export const DELETE = {
+  /** O13. */
+  deleting: 'Deleting…',
+  /** O14 (`changed`, C17): the wallet under the tab is not the one it showed — nothing proven, nothing sent. */
+  changed: 'The wallet in this browser changed. Check the address and try again.',
+  /** O15 (after `send-open`: E5 locked the wallet). */
+  lockedNothingDeleted: 'The wallet has been locked. Nothing was deleted.',
+  /** O16. */
+  failed: 'Something went wrong. Nothing was deleted.',
+} as const;
+
 /** #9 unlock (D7, D11). */
 export const UNLOCK = {
   unlocking: 'Unlocking…',
````

Modify `extension/src/unlock/unlock.css`:

````diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index b3a95f5..32b6728 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -418,3 +418,10 @@
   font: 500 14px/22px var(--font-mono);
   color: var(--fg-primary);
 }
+
+/* B1b-2b: an account address in groups of four under its caption (#37's proof, the remove page; C14, C17). */
+.vlt-address {
+  width: 100%;
+  display: flex;
+  justify-content: center;
+}
````

Modify `extension/src/unlock/view/dom.ts`:

````diff
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index 9e68394..4833c69 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -45,6 +45,7 @@ export const SCREENS = [
   'v-reveal',
   'v-change-password',
   'v-cp-cancel',
+  'v-delete',
 ] as const;
 export type ScreenId = (typeof SCREENS)[number];
````

Modify `extension/unlock.html`:

````diff
diff --git a/extension/unlock.html b/extension/unlock.html
index f277d74..4dc544c 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -559,6 +559,51 @@
         </div>
       </section>
 
+      <!-- #37's proof (B1b-2b §3.2, E11, C17): the password or passkey deletes the wallet whose first account it shows. -->
+      <section id="v-delete" class="screen s-pin" hidden>
+        <div class="top-bar">
+          <span class="title noc-h1">Delete wallet</span>
+        </div>
+        <div id="dl-entry" class="pin-head">
+          <h2 class="noc-h2 vlt-danger">Delete this wallet?</h2>
+          <p class="noc-caption vlt-muted">This wallet's first account</p>
+          <div id="dl-address" class="vlt-address"></div>
+          <p class="noc-body vlt-lede">Enter your password to delete this wallet from this browser. Your funds stay on Solana; your recovery phrase still controls them.</p>
+          <label for="dl-password" class="noc-body-sm vlt-lede vlt-field-label">Password</label>
+          <form id="dl-form" class="vlt-field-row vlt-field-row-labelled">
+            <input id="dl-password" class="vlt-input" type="password" autocomplete="current-password" />
+          </form>
+        </div>
+        <p id="dl-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        <div id="dl-cooldown" hidden>
+          <div class="vlt-pad-cooldown">
+            <h1 class="noc-h1 vlt-center vlt-gap-2">Wait a moment</h1>
+            <p class="noc-body vlt-lede vlt-center vlt-narrow-300 vlt-gap-5">That did not confirm it. Wait a moment before trying again.</p>
+          </div>
+          <div class="cooldown-card">
+            <div id="dl-ring" class="ring"></div>
+            <div id="dl-timer" class="timer noc-numeral"></div>
+            <div id="dl-cooldown-label" class="noc-body-sm label"></div>
+          </div>
+        </div>
+        <span id="dl-cooldown-live" class="vlt-sr" aria-live="polite"></span>
+        <div id="dl-notice" class="vlt-notice" role="status" hidden>
+          <p id="dl-notice-line" class="noc-body"></p>
+          <p id="dl-notice-help" class="noc-body-sm vlt-lede"></p>
+        </div>
+        <div class="pin-spacer"></div>
+        <div class="sticky-bar">
+          <button id="dl-delete" type="button" class="btn btn-destructive">Delete wallet</button>
+          <button id="dl-paused" type="button" class="btn btn-secondary" disabled hidden>Confirm paused</button>
+          <button id="dl-passkey" type="button" class="btn btn-secondary" hidden>Confirm with passkey</button>
+          <button id="dl-unlock" type="button" class="btn btn-primary" hidden>Unlock</button>
+          <button id="dl-again" type="button" class="btn btn-primary" hidden>Start again</button>
+          <button id="dl-setup" type="button" class="btn btn-primary" hidden>Set up a wallet</button>
+          <button id="dl-close" type="button" class="btn btn-secondary" hidden>Close this tab</button>
+          <button id="dl-cancel" type="button" class="btn btn-secondary">Cancel</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/unlock/__tests__/deleteScreen.test.ts src/unlock/__tests__/pageHarness.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 2 passed (2) · Tests 383 passed (383); tsc clean; whole suite Test Files 126 passed (126) · Tests 2247 passed (2247); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  delete idle (with the passkey button), wrong, changed (C17), deleting (held KDF), send-open, damaged, no wallet — Task 20; compare with #37's proof states (the destructive button, the address in groups of four).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M9a** — C17: a changed revision deletes — `extension/src/unlock/screens/delete.ts`:

  ```diff
  - if (envelopeRevision(env) === shownRevision) return true;
  + if (envelopeRevision(env) !== '') return true;
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/deleteScreen.test.ts` — Expected: **red** (dry run: 2 failed (Playwright)).

- **M9b** — delete shows the top row, not the lowest index — `extension/src/unlock/screens/delete.ts`:

  ```diff
  - addressGroups(firstAccount(env))
  + addressGroups(env.accounts[0]!.publicKey)
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/deleteScreen.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/scripts/__tests__/check-vault-isolation.test.mjs extension/src/unlock/__tests__/deleteScreen.test.ts extension/src/unlock/__tests__/pageHarness.ts extension/src/unlock/mode.ts extension/src/unlock/modes.ts extension/src/unlock/screens/delete.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/src/unlock/view/dom.ts extension/unlock.html
git commit -F - <<'MSG'
feat(extension): ?mode=delete — #37's proof page: the address it will delete, C17's revision binding, deleteWallet

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 10: `?mode=passkey&op=add|remove` — passkey add / replace / remove in the vault tab

**Spec:** §3.3, E12, D12, D13, C3, C4; O05, O17–O26

**Files:**
- Modify: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Create: `extension/src/unlock/__tests__/passkeyManageScreen.test.ts`
- Modify: `extension/src/unlock/mode.ts`
- Modify: `extension/src/unlock/modes.ts`
- Create: `extension/src/unlock/screens/passkeyManage.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/view/dom.ts`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Task 4's `removePasskey`; 2a's `addPasskey`, `evaluatePrf`; `PageDeps`.
- Produces (exact signatures, as exported):
  - `export interface PasskeyManageScreen`
  - `export function mountPasskeyManage(deps: PageDeps): PasskeyManageScreen`
  - `export const MANAGE =`

One section, three operations. `op=add` with no passkey stored: the password unwraps the data key and a new passkey (PRF) wraps it (2a's `addPasskey`). With one stored the same operation **replaces** it (one slot, C4) and is worded as a replace. Add and replace are **password only** (C4: a passkey holder must not enrol a passkey of their own — the passkey button is shown only for `op=remove`). `op=remove`: the password or the passkey proves the wallet (Task 4's `removePasskey`); `no-passkey` says "This wallet has no passkey. Nothing was changed." The 'added' and 'removed' outcomes stay off the backoff's PROVEN list (an existing negative control asserts 'added' does not reset the streak).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index 2cdafac..8b5712a 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -1526,7 +1526,7 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
     // and views — a module added or removed there is named here too, and each named one must be reached.
     const named = ['welcome', 'seed', 'confirm', 'password', 'passkey', 'createRun', 'importScreen', 'importRun', 'restoreRun', 'retryRun', 'forgot', 'unlock', 'reauth', 'accounts', 'reveal',
       // B1b-2b plan 1.
-      'changePassword', 'delete'];
+      'changePassword', 'delete', 'passkeyManage'];
     expect([...screens].sort()).toEqual(named.map(n => `src/unlock/screens/${n}.ts`).sort());
     expect([...views].sort()).toEqual(['dom', 'words', 'hold', 'meter', 'cooldown'].map(n => `src/unlock/view/${n}.ts`).sort());
     expect(resolved).toEqual(
@@ -1539,6 +1539,7 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
         'src/unlock/stored.ts',
         'src/unlock/page.ts',
         'src/unlock/passwordFlow.ts',
+        'src/unlock/passkeyFlow.ts',
       ]),
     );
   });
````

Create `extension/src/unlock/__tests__/passkeyManageScreen.test.ts`:

````ts
// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, unlockWithPassword, unlockWithPrf, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import type {CredentialsApi} from '../../vault/passkey';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {mountPasskeyManage} from '../screens/passkeyManage';
import {pageMode} from '../mode';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1b-2b §3.3 (#6 "manage", E12, D12, D13, C3, C4) against the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const OLD_PRF = crypto.getRandomValues(new Uint8Array(32));
const NEW_PRF = crypto.getRandomValues(new Uint8Array(32));

beforeEach(loadPage);

/** An authenticator: create() makes credential `id`, get() answers `prf` (null: no PRF). */
function authenticator(prf: Uint8Array | null, id = new Uint8Array([7, 7, 7, 7])): CredentialsApi {
  return {
    create: async () => ({rawId: id.slice().buffer}) as unknown as Credential,
    get: async () => ({getClientExtensionResults: () => (prf === null ? {} : {prf: {results: {first: prf.slice().buffer}}})}) as unknown as Credential,
  };
}
async function shown(op: 'add' | 'remove', o: {passkey?: boolean; unlocked?: boolean; credentials?: CredentialsApi; holdSleep?: boolean; send?: (inner: Send) => Send} = {}) {
  let env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf});
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), OLD_PRF.slice(), new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: env, ...(o.credentials === undefined ? {} : {credentials: o.credentials}), ...(o.holdSleep === true ? {holdSleep: true} : {}), ...(o.send === undefined ? {} : {send: o.send})});
  if (o.unlocked !== false) await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  const screen = mountPasskeyManage(h.deps);
  await screen.show(op);
  return {h, screen, env};
}
const stored = async (h: Harness) => (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
const withPassword = (password = PW) => {
  type(el<HTMLInputElement>('pm-password'), password);
  click(el('pm-act'));
};

describe('#6 manage: add and replace (password only, C4)', () => {
  it('?mode=passkey&op=… is a closed enum (anything else is add)', () => {
    expect(pageMode('?mode=passkey&op=remove')).toEqual({mode: 'passkey', op: 'remove'});
    expect(pageMode('?mode=passkey&op=add')).toEqual({mode: 'passkey', op: 'add'});
    expect(pageMode('?mode=passkey&op=delete')).toEqual({mode: 'passkey', op: 'add'});
    expect(pageMode('?mode=passkey')).toEqual({mode: 'passkey', op: 'add'});
  });

  it('add, no passkey: #6’s copy, the password line, [Add a passkey], [Cancel]; no passkey button', async () => {
    await shown('add');
    expect(text(el('pm-title'))).toBe('Unlock Noctura with a passkey');
    expect(text(el('pm-lede'))).toBe('Adds convenience. Your password always works too — keep it safe.');
    expect(text(el('pm-ask'))).toBe('Enter your password to add the passkey.');
    expect(text(el('pm-act'))).toBe('Add a passkey');
    expect(visible(el('pm-passkey'))).toBe(false);
    expect(text(el('pm-cancel'))).toBe('Cancel');
    expect(unstyled('v-passkey-manage')).toEqual([]);
  });

  it('added: "Waiting for your passkey…", then "Passkey added." + O05 + [Close this tab]; the wallet opens with the new passkey', async () => {
    const {h} = await shown('add', {credentials: authenticator(NEW_PRF)});
    withPassword();
    expect(text(el('pm-line'))).toBe('Waiting for your passkey…');
    await h.until(() => text(el('pm-line')) === 'Passkey added.');
    expect(text(el('pm-line-help'))).toBe('You can close this tab.');
    expect(visible(el('pm-close'))).toBe(true);
    const env = await stored(h);
    expect(env.passkey).toBeDefined();
    expect((await unlockWithPrf(env, NEW_PRF.slice())).length).toBe(32);
  });

  it('replace (a passkey stored): O17/O18 and [Replace passkey]; replaced → O19 + O05; the new credential is the one stored', async () => {
    const {h, env} = await shown('add', {passkey: true, credentials: authenticator(NEW_PRF, new Uint8Array([9, 9]))});
    expect(text(el('pm-title'))).toBe('Replace your passkey');
    expect(text(el('pm-lede'))).toBe('The new passkey replaces the one this wallet uses now. The old one stays in your passkey manager until you delete it there.');
    expect(text(el('pm-act'))).toBe('Replace passkey');
    // C4: a replace is password only — the stored passkey is never offered as the factor that enrols its successor.
    expect(visible(el('pm-passkey'))).toBe(false);
    withPassword();
    await h.until(() => text(el('pm-line')) === 'Passkey replaced.');
    expect(text(el('pm-line-help'))).toBe('You can close this tab.');
    const after = await stored(h);
    expect(after.passkey?.credentialId).not.toBe(env.passkey?.credentialId);
    await expect(unlockWithPrf(after, OLD_PRF.slice())).rejects.toThrow();
  });

  it('unsupported (no PRF) and a wrong password', async () => {
    const none = await shown('add', {credentials: authenticator(null)});
    withPassword();
    await none.h.until(() => text(el('pm-line')) === 'This device cannot unlock the wallet with a passkey; your password still works.');
    loadPage();
    const wrong = await shown('add', {credentials: authenticator(NEW_PRF)});
    withPassword('nope nope nope nope');
    await wrong.h.until(() => text(el('pm-helper')) === 'That did not confirm it.');
    expect((await stored(wrong.h)).passkey).toBeUndefined();
  });
});

describe('#6 manage: remove (password or passkey, E12)', () => {
  it('idle: O20/O21, [Remove passkey], [Confirm with passkey]; no "add" line', async () => {
    await shown('remove', {passkey: true});
    expect(text(el('pm-title'))).toBe('Remove your passkey');
    expect(text(el('pm-lede'))).toBe('Confirm with your password or with the passkey itself. Your password keeps working.');
    expect(text(el('pm-act'))).toBe('Remove passkey');
    expect(visible(el('pm-passkey'))).toBe(true);
    expect(visible(el('pm-ask'))).toBe(false);
  });

  it('by password: "Removing the passkey…", then O23 + O24 + [Close this tab]; the envelope has no passkey', async () => {
    const {h} = await shown('remove', {passkey: true});
    withPassword();
    expect(text(el('pm-line'))).toBe('Removing the passkey…');
    await h.until(() => text(el('pm-line')) === 'Passkey removed.');
    expect(text(el('pm-line-help'))).toBe('It is still saved in your passkey manager (Google, Apple or your password manager). Delete it there if you no longer need it.');
    expect((await stored(h)).passkey).toBeUndefined();
  });

  it('by the passkey itself: removed', async () => {
    const {h} = await shown('remove', {passkey: true, credentials: authenticator(OLD_PRF)});
    click(el('pm-passkey'));
    await h.until(() => text(el('pm-line')) === 'Passkey removed.');
    expect((await stored(h)).passkey).toBeUndefined();
  });

  it('no passkey stored: O25; locked: the common notice + [Unlock]; busy twice: RESTORE busy + [Start again]', async () => {
    const none = await shown('remove');
    withPassword();
    await none.h.until(() => text(el('pm-line')) === 'This wallet has no passkey. Nothing was changed.');
    loadPage();
    const locked = await shown('remove', {passkey: true, unlocked: false});
    withPassword();
    await locked.h.until(() => text(el('pm-line')) === 'The wallet is locked. Unlock it first, then try again.');
    expect(visible(el('pm-unlock'))).toBe(true);
    loadPage();
    const busy = await shown('remove', {passkey: true, send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' ? {ok: false, error: 'busy'} : inner(m))});
    withPassword();
    await busy.h.until(() => text(el('pm-line')) === 'The wallet changed while you were typing. Start again.');
    expect(visible(el('pm-again'))).toBe(true);
    await busy.h.until(() => !busy.h.deps.gate.isBusy());
    click(el('pm-again'));
    await busy.h.until(() => visible(el('pm-act')));
  });

  it('a device that cannot evaluate the passkey says so; the passkey stays', async () => {
    const {h} = await shown('remove', {passkey: true, credentials: authenticator(null)});
    click(el('pm-passkey'));
    await h.until(() => text(el('pm-helper')) === 'This device cannot confirm with a passkey; your password still works.');
    expect((await stored(h)).passkey).toBeDefined();
  });

  it('rule 6: a second [Remove passkey] inside the floor (`disabled` lifted) runs no second proof', async () => {
    const {h} = await shown('remove', {passkey: true, holdSleep: true});
    withPassword();
    el<HTMLButtonElement>('pm-act').disabled = false;
    el<HTMLInputElement>('pm-password').disabled = false;
    withPassword();
    await h.until(() => h.sent.some(m => m.type === 'vault.removePasskey'));
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    h.wake();
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/unlock/__tests__/passkeyManageScreen.test.ts
```
Expected (dry run, these test files on Task 9's tree): **red** — Test Files 2 failed (2) · Tests 1 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/unlock/mode.ts`:

````diff
diff --git a/extension/src/unlock/mode.ts b/extension/src/unlock/mode.ts
index 3307370..fddda59 100644
--- a/extension/src/unlock/mode.ts
+++ b/extension/src/unlock/mode.ts
@@ -15,7 +15,9 @@ export type PageMode =
   /** B1b-2b §1.2: #36 change password (unlocked session, password only, D8). */
   | {mode: 'password'}
   /** B1b-2b §1.2: #37's proof — no session needed (E5's factor proof), bound to the wallet it shows (C17). */
-  | {mode: 'delete'};
+  | {mode: 'delete'}
+  /** B1b-2b §1.2: #6 "manage" — add (or replace, C4) by password; remove by password or passkey (E12). */
+  | {mode: 'passkey'; op: 'add' | 'remove'};
 
 const SOURCES: readonly string[] = ['forgot', 'retry'];
 const RETURNS: readonly string[] = ['created', 'imported'];
@@ -33,6 +35,7 @@ export function pageMode(search: string): PageMode {
     const source = p.get('source') ?? '';
     return {mode: 'import', source: SOURCES.includes(source) ? (source as ImportSource) : null};
   }
+  if (m === 'passkey') return {mode: 'passkey', op: p.get('op') === 'remove' ? 'remove' : 'add'};
   if (m === 'reauth') {
     const id = p.get('challenge') ?? '';
     return /^[0-9a-f]{32}$/.test(id) ? {mode: 'reauth', challengeId: id} : {mode: 'unlock', returnTo: null};
````

Modify `extension/src/unlock/modes.ts`:

````diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 5001018..c07700e 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -3,6 +3,7 @@ import type {PageDeps} from './page';
 import {mountAccounts} from './screens/accounts';
 import {mountChangePassword} from './screens/changePassword';
 import {mountDelete} from './screens/delete';
+import {mountPasskeyManage} from './screens/passkeyManage';
 import {createCreateRun} from './screens/createRun';
 import {mountForgot} from './screens/forgot';
 import {createImportRun} from './screens/importRun';
@@ -54,6 +55,9 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
     case 'reveal':
       mountReveal(deps).show();
       return;
+    case 'passkey':
+      void mountPasskeyManage(deps).show(mode.op);
+      return;
     case 'delete':
       void mountDelete(deps).show();
       return;
````

Create `extension/src/unlock/screens/passkeyManage.ts`:

````ts
import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {EnvelopeV1} from '../../vault/envelope';
import type {ReauthFactor} from '../../vault/reauth';
import {addPasskey, type PasskeyOutcome} from '../onboarding';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {removePasskey, type RemovePasskeyOutcome} from '../passkeyFlow';
import {storedVault} from '../stored';
import {ACCOUNTS, COMMON, MANAGE, PASSKEY, RESTORE, cooldownLabel} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';

export interface PasskeyManageScreen {
  show(op: 'add' | 'remove'): Promise<void>;
  /** For the tests: a typed password the screen still references. */
  holds(): boolean;
}

type View = 'loading' | 'entry' | 'working' | 'end';
type Action = 'again' | 'unlock' | 'setup' | 'close';

/**
 * #6 "manage" (spec B1b-2b §3.3, E12, D12, D13, C3, C4) in the vault tab.
 * - `op=add` with no passkey stored: add — the password unwraps the data key and a new passkey wraps it (addPasskey,
 *   unchanged from #6). With one stored: the same operation REPLACES it (one slot, C4), worded as a replace. Password
 *   only (C4): a passkey holder must not enrol a passkey of their own.
 * - `op=remove`: the password OR the passkey itself proves the wallet against the session (a mismatch locks), then the
 *   background drops the wrap (vault.removePasskey: the page sends no envelope). The authenticator keeps the credential;
 *   the page says so (O24).
 * The password leaves the field at the click; a hidden tab or `pagehide` empties the field. A wrong factor gets the
 * page's backoff only; `damaged` and `no-wallet` are never charged. Rule 6: the page's one `exclusive()` gate.
 */
export function mountPasskeyManage(deps: PageDeps): PasskeyManageScreen {
  const field = byId<HTMLInputElement>('pm-password');
  const act = byId<HTMLButtonElement>('pm-act');
  const passkeyBtn = byId<HTMLButtonElement>('pm-passkey');
  const cancel = byId<HTMLButtonElement>('pm-cancel');
  const buttons = {again: byId<HTMLButtonElement>('pm-again'), unlock: byId<HTMLButtonElement>('pm-unlock'), setup: byId<HTMLButtonElement>('pm-setup'), close: byId<HTMLButtonElement>('pm-close')};
  const helperEl = byId('pm-helper');
  const live = byId('pm-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let op: 'add' | 'remove' = 'add';
  let view: View = 'loading';
  let actions: readonly Action[] = [];
  /** The passkey stored at load: `add` then words a replace (C4); `remove` offers it as a factor. */
  let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
  let stopCooldown: (() => void) | null = null;
  let typed: string | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    const cooling = stopCooldown !== null;
    const replacing = op === 'add' && pk !== null;
    setText(byId('pm-title'), op === 'remove' ? MANAGE.removeTitle : replacing ? MANAGE.replaceTitle : MANAGE.addTitle);
    setText(byId('pm-lede'), op === 'remove' ? MANAGE.removeLede : replacing ? MANAGE.replaceLede : MANAGE.addLede);
    setText(act, op === 'remove' ? MANAGE.remove : replacing ? MANAGE.replace : MANAGE.add);
    shown(byId('pm-form'), (entry || view === 'working') && !cooling);
    shown(byId('pm-ask'), op === 'add');
    shown(helperEl, entry && !cooling);
    shown(byId('pm-cooldown'), cooling);
    shown(act, entry && !cooling);
    shown(byId('pm-paused'), cooling);
    shown(passkeyBtn, entry && !cooling && op === 'remove' && pk !== null);
    field.disabled = busy || !entry;
    act.disabled = busy || !entry;
    passkeyBtn.disabled = busy || !entry || pk === null;
    for (const [name, b] of Object.entries(buttons)) {
      shown(b, view === 'end' && actions.includes(name as Action));
      b.disabled = busy;
    }
    shown(cancel, view !== 'end' || actions.length === 0);
    cancel.disabled = busy && !cooling;
  };
  const helper = (text: string, error: boolean) => {
    setText(helperEl, text);
    helperEl.classList.toggle('vlt-danger', error);
    field.classList.toggle('is-error', error);
  };
  const line = (text: string, help = '') => {
    setText(byId('pm-line'), text);
    shown(byId('pm-line'), text !== '');
    setText(byId('pm-line-help'), help);
    shown(byId('pm-line-help'), help !== '');
  };
  const end = (text: string, help: string, next: readonly Action[]) => {
    view = 'end';
    actions = next;
    field.value = '';
    helper('', false);
    line(text, help);
    render();
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('pm-timer'), label: byId('pm-cooldown-label'), ring: byId('pm-ring')});
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };

  const added = (out: PasskeyOutcome, replacing: boolean) => {
    if (out === 'added') return end(replacing ? MANAGE.replaced : PASSKEY.added, MANAGE.closeTab, ['close']);
    if (out === 'wrong') {
      view = 'entry';
      line('');
      return helper(COMMON.wrongConfirm, true);
    }
    if (out === 'unsupported') return end(PASSKEY.unsupported, '', []);
    if (out === 'no-wallet') return end(COMMON.noWallet, '', ['setup']);
    if (out === 'damaged') return end(COMMON.damaged, COMMON.damagedHelp, []);
    end(PASSKEY.failed, '', []);
  };
  const removed = (out: RemovePasskeyOutcome) => {
    if (out === 'removed') return end(MANAGE.removed, MANAGE.removedHelp, ['close']);
    if (out === 'wrong') {
      view = 'entry';
      line('');
      return helper(COMMON.wrongConfirm, true);
    }
    if (out === 'no-passkey') return end(MANAGE.noPasskey, '', []);
    if (out === 'busy') return end(RESTORE.busy, '', ['again']);
    if (out === 'not-unlocked') return end(ACCOUNTS.outcome['not-unlocked'], '', ['unlock']);
    if (out === 'mismatch-locked') return end(COMMON.mismatchLocked, '', []);
    if (out === 'damaged') return end(COMMON.damaged, COMMON.damagedHelp, []);
    if (out === 'no-wallet') return end(COMMON.noWallet, '', ['setup']);
    end(MANAGE.failed, '', []);
  };

  const runRemove = async (factor: ReauthFactor) => {
    view = 'working';
    line(MANAGE.removing);
    render();
    const out = await backoff.run(() => removePasskey({readEnvelope: deps.store.readEnvelope, send: deps.send}, factor), cooldown);
    endCooldown();
    removed(out);
  };
  const withPassword = () => {
    if (view !== 'entry' || field.value === '') return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry' || field.value === '') return;
      typed = field.value;
      field.value = '';
      const password = typed;
      typed = null;
      helper('', false);
      if (op === 'remove') return runRemove({password, kdf: deps.kdf});
      const replacing = pk !== null;
      view = 'working';
      line(PASSKEY.adding);
      render();
      const out = await backoff.run(() => addPasskey({...deps.store, credentials: deps.credentials, randomBytes: deps.randomBytes}, {password, kdf: deps.kdf}), cooldown);
      endCooldown();
      added(out, replacing);
    });
  };
  const withPasskey = () => {
    if (view !== 'entry' || op !== 'remove' || pk === null) return;
    void exclusive(deps, render, async () => {
      const key = pk;
      if (view !== 'entry' || key === null) return;
      field.value = '';
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      if (prfOutput === null) return helper(COMMON.passkeyUnavailableConfirm, false);
      // removePasskey zeroes the PRF output on every path.
      await runRemove({prfOutput});
    });
  };
  const load = async () => {
    view = 'loading';
    actions = [];
    endCooldown();
    helper('', false);
    line('');
    render();
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      return end(COMMON.unreadable, '', []);
    }
    const stored = storedVault(raw);
    if (stored.kind === 'none') return end(COMMON.noWallet, '', ['setup']);
    if (stored.kind === 'damaged') return end(COMMON.damaged, COMMON.damagedHelp, []);
    pk = stored.env.passkey ?? null;
    view = 'entry';
    render();
    field.focus();
  };

  deps.gate.onIdle(render);
  byId('pm-form').addEventListener('submit', e => {
    e.preventDefault();
    withPassword();
  });
  act.addEventListener('click', withPassword);
  passkeyBtn.addEventListener('click', withPasskey);
  cancel.addEventListener('click', () => void exclusive(deps, render, async () => deps.closeTab()));
  buttons.close.addEventListener('click', () => {
    if (actions.includes('close')) void exclusive(deps, render, async () => deps.closeTab());
  });
  buttons.again.addEventListener('click', () => {
    if (actions.includes('again')) void exclusive(deps, render, load);
  });
  buttons.unlock.addEventListener('click', () => {
    if (actions.includes('unlock')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
  });
  buttons.setup.addEventListener('click', () => {
    if (actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  deps.onLeave(() => {
    field.value = '';
  });

  return {
    async show(which) {
      op = which;
      showScreen('v-passkey-manage');
      await load();
    },
    holds: () => typed !== null || field.value !== '',
  };
}
````

Modify `extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index e12b92a..32ee761 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -266,6 +266,39 @@ export const DELETE = {
   failed: 'Something went wrong. Nothing was deleted.',
 } as const;
 
+/** #6 "manage" in the vault tab: add, replace, remove (B1b-2b §3.3, E12, D12, D13, C3, C4). */
+export const MANAGE = {
+  addTitle: 'Unlock Noctura with a passkey',
+  addLede: 'Adds convenience. Your password always works too — keep it safe.',
+  /** O17. */
+  replaceTitle: 'Replace your passkey',
+  /** O18. */
+  replaceLede: 'The new passkey replaces the one this wallet uses now. The old one stays in your passkey manager until you delete it there.',
+  /** O20. */
+  removeTitle: 'Remove your passkey',
+  /** O21. */
+  removeLede: 'Confirm with your password or with the passkey itself. Your password keeps working.',
+  add: 'Add a passkey',
+  /** D13. */
+  replace: 'Replace passkey',
+  /** D13. */
+  remove: 'Remove passkey',
+  /** O19. */
+  replaced: 'Passkey replaced.',
+  /** O22. */
+  removing: 'Removing the passkey…',
+  /** O23. */
+  removed: 'Passkey removed.',
+  /** O24. */
+  removedHelp: 'It is still saved in your passkey manager (Google, Apple or your password manager). Delete it there if you no longer need it.',
+  /** O25. */
+  noPasskey: 'This wallet has no passkey. Nothing was changed.',
+  /** O26. */
+  failed: 'Something went wrong. Nothing was changed.',
+  /** O05. */
+  closeTab: 'You can close this tab.',
+} as const;
+
 /** #9 unlock (D7, D11). */
 export const UNLOCK = {
   unlocking: 'Unlocking…',
````

Modify `extension/src/unlock/view/dom.ts`:

````diff
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index 4833c69..5b8e0a0 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -46,6 +46,7 @@ export const SCREENS = [
   'v-change-password',
   'v-cp-cancel',
   'v-delete',
+  'v-passkey-manage',
 ] as const;
 export type ScreenId = (typeof SCREENS)[number];
````

Modify `extension/unlock.html`:

````diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 4dc544c..66ac73b 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -604,6 +604,44 @@
         </div>
       </section>
 
+      <!-- #6 "manage" (B1b-2b §3.3): add or replace a passkey (password), remove it (password or passkey). #6's chrome, no step counter. -->
+      <section id="v-passkey-manage" class="screen s-bio" hidden>
+        <div class="hero-icon"><svg width="56" height="56" aria-hidden="true"><use href="#i-key" /></svg></div>
+        <div class="vlt-pad-6 vlt-center">
+          <h1 id="pm-title" class="noc-h1 vlt-gap-2"></h1>
+          <p id="pm-lede" class="noc-body vlt-lede vlt-narrow-300"></p>
+        </div>
+        <form id="pm-form" class="vlt-pad vlt-gap-top-5">
+          <p id="pm-ask" class="noc-body-sm vlt-lede vlt-gap-2">Enter your password to add the passkey.</p>
+          <input id="pm-password" class="vlt-input" type="password" autocomplete="current-password" aria-label="Password" />
+        </form>
+        <p id="pm-helper" class="noc-caption vlt-center vlt-pad vlt-gap-top-3" aria-live="polite"></p>
+        <div id="pm-cooldown" hidden>
+          <div class="vlt-pad-cooldown">
+            <p class="noc-body vlt-lede vlt-center vlt-narrow-300 vlt-gap-5">That did not confirm it. Wait a moment before trying again.</p>
+          </div>
+          <div class="cooldown-card">
+            <div id="pm-ring" class="ring"></div>
+            <div id="pm-timer" class="timer noc-numeral"></div>
+            <div id="pm-cooldown-label" class="noc-body-sm label"></div>
+          </div>
+        </div>
+        <span id="pm-cooldown-live" class="vlt-sr" aria-live="polite"></span>
+        <p id="pm-line" class="noc-body vlt-center vlt-pad vlt-gap-top-5" role="status" hidden></p>
+        <p id="pm-line-help" class="noc-body-sm vlt-lede vlt-center vlt-pad vlt-gap-top-3" hidden></p>
+        <div class="vlt-grow"></div>
+        <div class="sticky-bar">
+          <button id="pm-act" type="button" class="btn btn-primary"></button>
+          <button id="pm-paused" type="button" class="btn btn-secondary" disabled hidden>Confirm paused</button>
+          <button id="pm-passkey" type="button" class="btn btn-secondary" hidden>Confirm with passkey</button>
+          <button id="pm-again" type="button" class="btn btn-primary" hidden>Start again</button>
+          <button id="pm-unlock" type="button" class="btn btn-primary" hidden>Unlock</button>
+          <button id="pm-setup" type="button" class="btn btn-primary" hidden>Set up a wallet</button>
+          <button id="pm-close" type="button" class="btn btn-secondary" hidden>Close this tab</button>
+          <button id="pm-cancel" type="button" class="btn btn-secondary">Cancel</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/unlock/__tests__/passkeyManageScreen.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 2 passed (2) · Tests 383 passed (383); tsc clean; whole suite Test Files 127 passed (127) · Tests 2258 passed (2258); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  add idle, adding (held KDF), added, replace idle, replaced, remove idle, removing (held KDF), removed, no-passkey — Task 20; the design never draws 'manage' (Differs, §3.3): compare with #6's chrome.

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M10a** — C4: the passkey offered as a factor for add — `extension/src/unlock/screens/passkeyManage.ts`:

  ```diff
  - shown(passkeyBtn, entry && !cooling && op === 'remove' && pk !== null);
  + shown(passkeyBtn, entry && !cooling && pk !== null);
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/passkeyManageScreen.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/scripts/__tests__/check-vault-isolation.test.mjs extension/src/unlock/__tests__/passkeyManageScreen.test.ts extension/src/unlock/mode.ts extension/src/unlock/modes.ts extension/src/unlock/screens/passkeyManage.ts extension/src/unlock/strings.ts extension/src/unlock/view/dom.ts extension/unlock.html
git commit -F - <<'MSG'
feat(extension): ?mode=passkey&op=add|remove — passkey add / replace / remove in the vault tab

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 11: `?mode=reveal` and `?mode=verify` — the phrase behind a password, #3's grid with its guards, #4's check, `phraseVerifiedAt`

**Spec:** §3.4, §3.5, E15, E16, D14, D15, D23, C8, C9; O01, O05, O27–O32

**Files:**
- Modify: `extension/e2e/csp.spec.ts`
- Modify: `extension/e2e/visual-vault.spec.ts`
- Modify: `extension/src/unlock/__tests__/accountsReveal.test.ts`
- Create: `extension/src/unlock/__tests__/phraseScreen.test.ts`
- Modify: `extension/src/unlock/mode.ts`
- Modify: `extension/src/unlock/modes.ts`
- Modify: `extension/src/unlock/screens/confirm.ts`
- Modify: `extension/src/unlock/screens/reveal.ts`
- Modify: `extension/src/unlock/screens/seed.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/src/unlock/view/dom.ts`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Task 6's `runReveal`, `recordVerified`; 2a's `mountSeed`, `mountConfirm`.
- Produces (exact signatures, as exported):
  - `export interface ConfirmChrome`
  - `export function mountConfirm(deps: PageDeps, next: {back(): void; done(): void; verified?(): void}, chrome: ConfirmChrome = ONBOARDING): ConfirmScreen`
  - `export interface PhraseRun`
  - `export function mountPhrase(deps: PageDeps, kind: 'reveal' | 'verify'): PhraseRun`
  - `export interface SeedChrome`
  - `export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}, chrome: SeedChrome = ONBOARDING): SeedScreen`
  - `export const PHRASE =`

Both modes start on a password proof (`v-phrase-proof`, password only — D23). Reveal then runs #3 (pre-reveal modal → press-and-hold → 20 s → "Still looking?"; `REVEAL_MS`, `HOLD_MS` and `TICK_MS` are 2a's and are not changed) and #4's three-word check; verify goes straight to the check. A passed check sends `vault.phraseVerified`; a refusal (locked meanwhile) shows O32. #3's grid now refuses copy, cut, drag, select and the context menu **while words are in the DOM** (listeners added with the words, removed with them) — this also hardens onboarding #3. `SeedChrome`/`ConfirmChrome` carry the eyebrow, the step label and the success copy so the same screens serve onboarding and these modes. Verify's Back closes the tab (there is nothing behind it), with O29 (Scope 3.15). **Verify's proof is `runReveal`** (review M4): `mountPhrase` proves both kinds through it, so D23's boundary guard (Task 6) covers both modes — there is no second flow to guard.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/csp.spec.ts`:

````diff
diff --git a/extension/e2e/csp.spec.ts b/extension/e2e/csp.spec.ts
index ae4e628..6cec284 100644
--- a/extension/e2e/csp.spec.ts
+++ b/extension/e2e/csp.spec.ts
@@ -95,9 +95,13 @@ test('csp: every vault-page mode runs with zero CSP violations; an inline style
     await p.goto(`${base}?mode=accounts`);
     await expect(p.getByRole('button', {name: 'Add an account'})).toBeVisible();
     await clean('accounts');
+    // B1b-2b §3.4 / §3.5: the reveal and verify modes' proof.
     await p.goto(`${base}?mode=reveal`);
-    await expect(p.locator('#v-reveal h1')).toHaveText('Your recovery phrase');
+    await expect(p.locator('#pp-title')).toHaveText('Show your recovery phrase');
     await clean('reveal');
+    await p.goto(`${base}?mode=verify`);
+    await expect(p.locator('#pp-title')).toHaveText('Verify your recovery phrase');
+    await clean('verify');
 
     // #10 with a live challenge: a send of 2.48 of the fake's 10 SOL to a new address.
     let challengeId: string | null = null;
@@ -133,7 +137,7 @@ test('csp: every vault-page mode runs with zero CSP violations; an inline style
     await expect(p.locator('#imp-phrase')).toBeVisible();
     await clean('import');
 
-    expect(seen).toHaveLength(9);
+    expect(seen).toHaveLength(10);
 
     // The positive control, on the same page and watch: an inline <style> and a remote <img> are both refused and reported.
     await p.evaluate(src => {
````

Modify `extension/e2e/visual-vault.spec.ts`:

````diff
diff --git a/extension/e2e/visual-vault.spec.ts b/extension/e2e/visual-vault.spec.ts
index 9acee1c..e67597a 100644
--- a/extension/e2e/visual-vault.spec.ts
+++ b/extension/e2e/visual-vault.spec.ts
@@ -326,7 +326,7 @@ test('visual: #40 with two accounts, and the D26 state', async () => {
   }
 });
 
-test('visual: #9, #39, the restore and retry steps, the accounts and reveal forms', async () => {
+test('visual: #9, #39, the restore and retry steps, the accounts form', async () => {
   const h = await launchPopup('noctura-e2e-vis-unlock-');
   try {
     await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
@@ -408,9 +408,7 @@ test('visual: #9, #39, the restore and retry steps, the accounts and reveal form
     await p.goto(`chrome-extension://${h.id}/unlock.html?mode=accounts`);
     await expect(p.getByRole('button', {name: 'Add an account'})).toBeVisible();
     await shot(p, 'accounts-form');
-    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reveal`);
-    await expect(p.locator('#v-reveal h1')).toHaveText('Your recovery phrase');
-    await shot(p, 'reveal-form');
+
 
     await h.sw.evaluate(() => chrome.storage.local.set({v1_vault: null}));
     await p.goto(`chrome-extension://${h.id}/unlock.html`);
````

Modify `extension/src/unlock/__tests__/accountsReveal.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/accountsReveal.test.ts b/extension/src/unlock/__tests__/accountsReveal.test.ts
index 3723a8a..b9705d3 100644
--- a/extension/src/unlock/__tests__/accountsReveal.test.ts
+++ b/extension/src/unlock/__tests__/accountsReveal.test.ts
@@ -4,11 +4,10 @@ import {deriveSessionAccounts} from '../../vault/accounts';
 import {VAULT_KEY} from '../../background/accountsStore';
 import {setSession} from '../../background/session';
 import {mountAccounts} from '../screens/accounts';
-import {mountReveal, type RevealScreen} from '../screens/reveal';
 import {startMode} from '../modes';
-import {SCREENS, showScreen} from '../view/dom';
+import {SCREENS} from '../view/dom';
 import type {PageMode} from '../mode';
-import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';
+import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';
 
 const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
 const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
@@ -27,8 +26,6 @@ const carries = (secret: RegExp): string[] => {
   for (const f of document.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) if (secret.test(f.value)) out.push(`#${f.id}.value`);
   return out;
 };
-/** A word of the phrase ("abandon" is in no static copy of the page: the baseline below proves it). */
-const PHRASE = /(?<![a-z])abandon(?![a-z])/;
 const PASSWORD = /correct horse battery/;
 
 beforeEach(loadPage);
@@ -108,147 +105,9 @@ describe('the add-account form, restyled (spec §1.2 accounts)', () => {
   });
 });
 
-describe('the reveal form, restyled with the tokens (spec §1.2 reveal)', () => {
-  /** The phrase shown after the proof: 12 words, as text. */
-  async function shownPhrase(h: Harness, screen: RevealScreen): Promise<void> {
-    type(el<HTMLInputElement>('rev-password'), PW);
-    click(el('rev-show'));
-    // The password leaves the field at the click; the page carries it nowhere.
-    expect(el<HTMLInputElement>('rev-password').value).toBe('');
-    expect(carries(PASSWORD)).toEqual([]);
-    await h.until(() => el('rev-words').children.length === 12);
-    expect(text(el('rev-helper'))).toBe('Write them down, in order, and keep them offline. Noctura never copies them anywhere.');
-    expect([...el('rev-words').children].map(text)).toEqual(M.split(' '));
-    expect(screen.holds()).toEqual({phrase: true, password: false});
-  }
-  /** Nothing of the phrase (or the password) left: not in the DOM in any form, not in the module. */
-  function gone(screen: RevealScreen): void {
-    expect(el('rev-words').children).toHaveLength(0);
-    expect(carries(PHRASE)).toEqual([]);
-    expect(carries(PASSWORD)).toEqual([]);
-    expect(text(el('rev-helper'))).toBe('');
-    expect(screen.holds()).toEqual({phrase: false, password: false});
-  }
-
-  it('the page carries no phrase word before the proof (the detector’s baseline)', async () => {
-    await unlockedWallet();
-    expect(carries(PHRASE)).toEqual([]);
-  });
-
-  it('the copy and the tokens; the phrase shown after the proof, as text', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    expect(text(el('v-reveal').querySelector('h1'))).toBe('Your recovery phrase');
-    expect(text(el('rev-show'))).toBe('Show the phrase');
-    expect(text(el('rev-hide'))).toBe('Hide');
-    expect(unstyled('v-reveal')).toEqual([]);
-    expect(screen.holds()).toEqual({phrase: false, password: false});
-    await shownPhrase(h, screen);
-    expect(carries(PHRASE)).toEqual(Array.from({length: 11}, () => 'text'));
-    expect(unstyled('v-reveal')).toEqual([]);
-  }, 30_000);
-
-  it('[Hide] takes the phrase out of the DOM and the module', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    await shownPhrase(h, screen);
-    type(el<HTMLInputElement>('rev-password'), PW);
-    click(el('rev-hide'));
-    gone(screen);
-  }, 30_000);
-
-  it('a hidden tab (visibilitychange) takes it out', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    await shownPhrase(h, screen);
-    type(el<HTMLInputElement>('rev-password'), PW);
-    h.leave('hidden');
-    gone(screen);
-  }, 30_000);
-
-  it('pagehide takes it out', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    await shownPhrase(h, screen);
-    type(el<HTMLInputElement>('rev-password'), PW);
-    h.leave('pagehide');
-    gone(screen);
-  }, 30_000);
-
-  it('leaving the screen (any other screen shown) takes it out in the same turn — no tick for an observer', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    await shownPhrase(h, screen);
-    type(el<HTMLInputElement>('rev-password'), PW);
-    showScreen('v-unlock');
-    gone(screen);
-  }, 30_000);
-
-  it('a bounce — another screen, then reveal again in the same turn — still dropped the phrase', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    await shownPhrase(h, screen);
-    type(el<HTMLInputElement>('rev-password'), PW);
-    showScreen('v-unlock');
-    showScreen('v-reveal');
-    gone(screen);
-    // Nor does anything bring it back a tick later.
-    await new Promise(r => setTimeout(r, 0));
-    gone(screen);
-  }, 30_000);
-
-  it('a tab hidden while the proof runs: the phrase that arrives after is never put in the DOM', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    type(el<HTMLInputElement>('rev-password'), PW);
-    click(el('rev-show'));
-    expect(text(el('rev-helper'))).toBe('Checking…');
-    h.leave('hidden');
-    // The proof settles (the gate frees up) with the tab hidden: nothing rendered, nothing held.
-    await h.until(() => !h.deps.gate.isBusy());
-    gone(screen);
-    // A new proof shows it again.
-    await shownPhrase(h, screen);
-  }, 30_000);
-
-  it('a wrong password shows nothing', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    type(el<HTMLInputElement>('rev-password'), 'not the password at all');
-    click(el('rev-show'));
-    await h.until(() => text(el('rev-helper')) === 'That did not confirm it.');
-    expect(carries(PHRASE)).toEqual([]);
-    expect(screen.holds()).toEqual({phrase: false, password: false});
-  }, 30_000);
-
-  it('rule 6: a second Show inside the first run runs no second proof', async () => {
-    const h = await unlockedWallet();
-    const screen = mountReveal(h.deps);
-    screen.show();
-    type(el<HTMLInputElement>('rev-password'), PW);
-    click(el('rev-show'));
-    el<HTMLButtonElement>('rev-show').disabled = false;
-    el<HTMLInputElement>('rev-password').disabled = false;
-    type(el<HTMLInputElement>('rev-password'), PW);
-    click(el('rev-show'));
-    // The refused click left the field as typed: the gate refused it before it was read.
-    expect(el<HTMLInputElement>('rev-password').value).toBe(PW);
-    await h.until(() => el('rev-words').children.length === 12);
-    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
-  }, 30_000);
-});
-
 describe('the two password fields are labelled where a sighted user sees it (Task 18 visual pass)', () => {
-  it('accounts and reveal: a visible <label for> "Password", no aria-label standing in, no minlength or required', () => {
-    for (const id of ['acc-password', 'rev-password']) {
+  it('accounts, the phrase proof, #36 and the delete page: a visible <label for> "Password", no aria-label standing in, no minlength or required', () => {
+    for (const id of ['acc-password', 'pp-password', 'cp-field', 'dl-password']) {
       const field = el<HTMLInputElement>(id);
       const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
       expect(text(label)).toBe('Password');
@@ -271,7 +130,12 @@ describe('the dispatcher: each mode shows its one screen', () => {
     [{mode: 'forgot'}, 'v-forgot'],
     [{mode: 'reauth', challengeId: 'ab'.repeat(16)}, 'v-reauth'],
     [{mode: 'accounts'}, 'v-accounts'],
-    [{mode: 'reveal'}, 'v-reveal'],
+    [{mode: 'reveal'}, 'v-phrase-proof'],
+    [{mode: 'verify'}, 'v-phrase-proof'],
+    [{mode: 'password'}, 'v-change-password'],
+    [{mode: 'delete'}, 'v-delete'],
+    [{mode: 'passkey', op: 'add'}, 'v-passkey-manage'],
+    [{mode: 'passkey', op: 'remove'}, 'v-passkey-manage'],
     [{mode: 'unlock', returnTo: null}, 'v-unlock'],
   ])('%j → #%s', async (mode, screen) => {
     const h = await unlockedWallet();
````

Create `extension/src/unlock/__tests__/phraseScreen.test.ts`:

````ts
// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {setSession} from '../../background/session';
import {HOLD_MS, TICK_MS} from '../view/hold';
import {mountPhrase} from '../screens/reveal';
import {pageMode} from '../mode';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1b-2b §3.4 / §3.5 (D14, D15, D23, C9): the reveal and verify modes, against the REAL background and unlock.html.
const M = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const OTHER = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const WORDS = M.split(' ');
const PW = 'correct horse battery';
const HELD = HOLD_MS + TICK_MS;

beforeEach(loadPage);

/** Every place the page carries `word` (text, attribute, field value), hidden sections included. */
const carries = (word: string): number => {
  const re = new RegExp(`(?<![a-z])${word}(?![a-z])`);
  let n = 0;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t !== null; t = walk.nextNode()) if (re.test(t.nodeValue ?? '')) n += 1;
  for (const e of document.body.querySelectorAll('*')) for (const a of e.attributes) if (re.test(a.value)) n += 1;
  for (const f of document.body.querySelectorAll<HTMLInputElement>('input, textarea')) if (re.test(f.value)) n += 1;
  return n;
};
/** "sausage" and "useful" appear once in the phrase and in no static copy: their count is the leak detector. */
const leaked = () => carries('sausage') + carries('useful');

async function shown(kind: 'reveal' | 'verify', o: {session?: string | null; passkey?: boolean; send?: (inner: Send) => Send; holdSleep?: boolean} = {}) {
  const keys = await deriveSessionAccounts(M, 'slip10', [0]);
  let env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: keys[0]?.publicKey ?? ''}], kdf: testKdf});
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), crypto.getRandomValues(new Uint8Array(32)), new Uint8Array([1]), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: env, ...(o.send === undefined ? {} : {send: o.send}), ...(o.holdSleep === true ? {holdSleep: true} : {})});
  const session = o.session === undefined ? M : o.session;
  if (session !== null) await setSession(h.ext, await deriveSessionAccounts(session, 'slip10', [0]));
  const run = mountPhrase(h.deps, kind);
  run.show();
  return {h, run};
}
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
async function press(h: Harness, id: string): Promise<void> {
  await h.until(() => !el<HTMLButtonElement>(id).disabled);
  click(el(id));
}
async function prove(h: Harness, password = PW): Promise<void> {
  type(el<HTMLInputElement>('pp-password'), password);
  click(el('pp-continue'));
}
/** The check: the three right words from the pool, then Confirm. */
async function check(h: Harness): Promise<void> {
  for (const s of [...el('cnf-slots').querySelectorAll('.label')].map(text)) {
    const n = Number(/#(\d+)/.exec(s)?.[1]);
    const b = () => [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === WORDS[n - 1] && !x.classList.contains('used')) as HTMLButtonElement;
    await h.until(() => !b().disabled);
    click(b());
  }
  await press(h, 'cnf-cta');
  await h.until(() => visible(el('cnf-success')));
}
const cancelable = (target: Element, type: string) => {
  const e = new Event(type, {bubbles: true, cancelable: true});
  target.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('the reveal and verify proofs (D23: password only)', () => {
  it('?mode=verify and ?mode=reveal are modes; reveal’s proof: O27, O28, the "Recovery phrase" bar, Continue — no passkey button with a passkey stored', async () => {
    expect(pageMode('?mode=verify')).toEqual({mode: 'verify'});
    expect(pageMode('?mode=reveal')).toEqual({mode: 'reveal'});
    await shown('reveal', {passkey: true});
    expect(text(el('pp-title'))).toBe('Show your recovery phrase');
    expect(text(el('pp-lede'))).toBe('Enter your password first. Nothing is shown until you press and hold.');
    expect(text(el('v-phrase-proof').querySelector('.top-bar .title'))).toBe('Recovery phrase');
    expect(text(el('pp-continue'))).toBe('Continue');
    expect(text(el('v-phrase-proof'))).not.toMatch(/passkey/i);
    expect(document.querySelector('#v-phrase-proof [id*="passkey"]')).toBeNull();
    expect(unstyled('v-phrase-proof')).toEqual([]);
  });

  it('verify’s proof: O30, O31; no passkey button either', async () => {
    await shown('verify', {passkey: true});
    expect(text(el('pp-title'))).toBe('Verify your recovery phrase');
    expect(text(el('pp-lede'))).toBe('Enter your password, then pick three words from your written copy.');
    expect(text(el('v-phrase-proof'))).not.toMatch(/passkey/i);
  });

  it('wrong: the helper; not unlocked: the notice + [Unlock]; a mismatch locks', async () => {
    const wrong = await shown('reveal');
    await prove(wrong.h, 'nope nope nope nope');
    await wrong.h.until(() => text(el('pp-helper')) === 'That did not confirm it.');
    loadPage();
    const locked = await shown('reveal', {session: null});
    await prove(locked.h);
    await locked.h.until(() => text(el('pp-notice-line')) === 'The wallet is locked. Unlock it first, then try again.');
    expect(visible(el('pp-unlock'))).toBe(true);
    loadPage();
    const mismatch = await shown('verify', {session: OTHER});
    await prove(mismatch.h);
    await mismatch.h.until(() => text(el('pp-notice-line')) === 'That did not match this wallet, so the wallet has been locked.');
    expect(leaked()).toBe(0);
  });
});

describe('reveal: #3’s mechanics on the proven phrase, then #4’s check (C9)', () => {
  it('proof → the pre-reveal modal (count adapted) → #3 framed "Recovery phrase", no step, 2 × 6 → hold → the words → check → verified and recorded', async () => {
    const {h, run} = await shown('reveal');
    expect(leaked()).toBe(0);
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    expect(text(el('sg-body'))).toBe('Move to a private place. Anyone who sees these 12 words can spend everything in this wallet, forever.');
    expect(leaked()).toBe(0);
    await press(h, 'sg-continue');
    expect(text(el('seed-eyebrow'))).toBe('Recovery phrase');
    expect(visible(el('seed-step'))).toBe(false);
    expect(text(el('seed-lede'))).toBe('12 words. Write them down on paper, in order. This is the only backup.');
    expect(el('seed-grid').classList.contains('vlt-grid-12')).toBe(true);
    // Blurred: the stand-in, never a word.
    expect(leaked()).toBe(0);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect([...el('seed-grid').querySelectorAll('.term')].map(text)).toEqual(WORDS);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    expect(leaked()).toBe(0);
    await press(h, 'seed-cta');
    await h.until(() => visible(el('v-confirm')));
    expect(text(el('cnf-eyebrow'))).toBe('Recovery phrase');
    expect(visible(el('cnf-step'))).toBe(false);
    await check(h);
    expect(text(el('cnf-success-title'))).toBe('Recovery phrase verified');
    expect(text(el('cnf-success-body'))).toBe('All three words matched. You can close this tab.');
    expect(text(el('cnf-cta'))).toBe('Close this tab');
    await h.until(() => h.sent.some(m => m.type === 'vault.phraseVerified'));
    await vi.waitFor(async () => expect(await h.ext.local.get('v1_settings')).toMatchObject({phraseVerifiedAt: h.wallet.now()}));
    expect(run.holds().phrase).toBe(false);
    expect(leaked()).toBe(0);
    // No message carries a word of the phrase.
    for (const m of h.sent) expect(JSON.stringify(m)).not.toMatch(/sausage|useful/);
    await press(h, 'cnf-cta');
    await h.until(() => h.closed === 1);
  });

  it('D14: on the grid copy, cut, drag, select and the context menu are cancelled — only while the grid is up, never on the password field', async () => {
    const {h} = await shown('reveal');
    // Before the proof: nothing is cancelled, the proof field takes a selection.
    expect(cancelable(el('seed-grid'), 'copy')).toBe(false);
    expect(cancelable(el('pp-password'), 'selectstart')).toBe(false);
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    for (const ev of ['copy', 'cut', 'dragstart', 'selectstart', 'contextmenu']) expect(cancelable(el('seed-grid'), ev)).toBe(true);
    expect(cancelable(el('pp-password'), 'selectstart')).toBe(false);
    // Revealed too.
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect(cancelable(el('seed-grid'), 'copy')).toBe(true);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
  });

  it('the modal’s Cancel: the phrase dropped, the tab asked to close, O29 if it stays', async () => {
    const {h, run} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-cancel');
    await h.until(() => h.closed === 1);
    expect(text(el('pp-notice-line'))).toBe('Nothing is shown. You can close this tab.');
    expect(run.holds().phrase).toBe(false);
  });

  it('the backdrop is the Cancel too (review L6)', async () => {
    const {h} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await idle(h);
    click(el('sg-backdrop'));
    await h.until(() => h.closed === 1);
  });

  it('pagehide drops the phrase; a restore from the back/forward cache starts again at the proof', async () => {
    const {h, run} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    h.leave('pagehide');
    expect(run.holds().phrase).toBe(false);
    expect(leaked()).toBe(0);
    h.back('restored');
    expect(visible(el('v-phrase-proof'))).toBe(true);
  });

  it('a hidden tab re-blurs (#3’s rule) and keeps the phrase in the run for the check', async () => {
    const {h, run} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    h.leave('hidden');
    expect(leaked()).toBe(0);
    expect(run.holds().phrase).toBe(true);
  });
});

describe('verify: the check, never the grid', () => {
  it('proof → #4 directly (#3 never shown) → verified; the phrase never rendered beyond the pool', async () => {
    const {h} = await shown('verify');
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    expect(visible(el('v-seed'))).toBe(false);
    expect(el('seed-grid').querySelectorAll('.term')).toHaveLength(0);
    await check(h);
    expect(text(el('cnf-success-title'))).toBe('Recovery phrase verified');
  });

  it('success-not-recorded: the background refused the fact — O32', async () => {
    const {h} = await shown('verify', {send: inner => async m => ((m as {type: string}).type === 'vault.phraseVerified' ? {ok: false, error: 'locked'} : inner(m))});
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    await check(h);
    await h.until(() => text(el('cnf-success-body')) === 'All three words matched, but this could not be saved. Try again later.');
  });

  it('Back from the check closes the tab (nothing to go back to) and drops the phrase', async () => {
    const {h, run} = await shown('verify');
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    await press(h, 'cnf-back');
    await h.until(() => h.closed === 1);
    expect(run.holds().phrase).toBe(false);
  });

  it('rule 6: a second Continue inside the floor (`disabled` lifted) runs no second proof', async () => {
    const {h} = await shown('verify', {holdSleep: true});
    await prove(h);
    el<HTMLButtonElement>('pp-continue').disabled = false;
    el<HTMLInputElement>('pp-password').disabled = false;
    await prove(h);
    await h.until(() => h.sent.some(m => m.type === 'vault.status'));
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    h.wake();
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/unlock/__tests__/accountsReveal.test.ts src/unlock/__tests__/phraseScreen.test.ts
```
Expected (dry run, these test files on Task 10's tree): **red** — Test Files 2 failed (2) · Tests 16 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/unlock/mode.ts`:

````diff
diff --git a/extension/src/unlock/mode.ts b/extension/src/unlock/mode.ts
index fddda59..b39abe4 100644
--- a/extension/src/unlock/mode.ts
+++ b/extension/src/unlock/mode.ts
@@ -17,7 +17,9 @@ export type PageMode =
   /** B1b-2b §1.2: #37's proof — no session needed (E5's factor proof), bound to the wallet it shows (C17). */
   | {mode: 'delete'}
   /** B1b-2b §1.2: #6 "manage" — add (or replace, C4) by password; remove by password or passkey (E12). */
-  | {mode: 'passkey'; op: 'add' | 'remove'};
+  | {mode: 'passkey'; op: 'add' | 'remove'}
+  /** B1b-2b §3.5: the verify check (unlocked session, password only, D23). `reveal` is the designed #3 (§3.4). */
+  | {mode: 'verify'};
 
 const SOURCES: readonly string[] = ['forgot', 'retry'];
 const RETURNS: readonly string[] = ['created', 'imported'];
@@ -30,7 +32,7 @@ const RETURNS: readonly string[] = ['created', 'imported'];
 export function pageMode(search: string): PageMode {
   const p = new URLSearchParams(search);
   const m = p.get('mode');
-  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal' || m === 'password' || m === 'delete') return {mode: m};
+  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal' || m === 'password' || m === 'delete' || m === 'verify') return {mode: m};
   if (m === 'import') {
     const source = p.get('source') ?? '';
     return {mode: 'import', source: SOURCES.includes(source) ? (source as ImportSource) : null};
````

Modify `extension/src/unlock/modes.ts`:

````diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index c07700e..48db711 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -11,7 +11,7 @@ import {mountPassword} from './screens/password';
 import {mountReauth} from './screens/reauth';
 import {createRestoreRun} from './screens/restoreRun';
 import {createRetryRun} from './screens/retryRun';
-import {mountReveal} from './screens/reveal';
+import {mountPhrase} from './screens/reveal';
 import {mountUnlock} from './screens/unlock';
 
 /**
@@ -53,7 +53,8 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
       mountAccounts(deps).show();
       return;
     case 'reveal':
-      mountReveal(deps).show();
+    case 'verify':
+      mountPhrase(deps, mode.mode).show();
       return;
     case 'passkey':
       void mountPasskeyManage(deps).show(mode.op);
````

Modify `extension/src/unlock/screens/confirm.ts`:

````diff
diff --git a/extension/src/unlock/screens/confirm.ts b/extension/src/unlock/screens/confirm.ts
index 1ba84c8..496ff94 100644
--- a/extension/src/unlock/screens/confirm.ts
+++ b/extension/src/unlock/screens/confirm.ts
@@ -63,6 +63,16 @@ export function confirmPlan(words: readonly string[], randomBytes: (n: number) =
 /** The design's ~700 ms before the slots reset after a wrong pick. */
 export const RESET_MS = 700;
 
+/** What frames #4 (B1b-2b §3.5): onboarding's, or the verify check's (no step, its own success and a close). */
+export interface ConfirmChrome {
+  eyebrow: string;
+  step: string | null;
+  successTitle: string;
+  successBody: string;
+  successCta: string;
+}
+const ONBOARDING: ConfirmChrome = {eyebrow: CONFIRM.onboarding, step: CONFIRM.step, successTitle: CONFIRM.verifiedTitle, successBody: CONFIRM.verifiedBody, successCta: CONFIRM.continue};
+
 export interface ConfirmScreen {
   /** Opens #4 with a new plan for this phrase. */
   show(words: readonly string[]): void;
@@ -85,7 +95,7 @@ export interface ConfirmScreen {
  * `exclusive()` gate. `phase` is the `offered`-style guard (welcome.ts, seed.ts): a button acts only on
  * the step it belongs to, whatever its `hidden`/`disabled` say.
  */
-export function mountConfirm(deps: PageDeps, next: {back(): void; done(): void}): ConfirmScreen {
+export function mountConfirm(deps: PageDeps, next: {back(): void; done(): void; verified?(): void}, chrome: ConfirmChrome = ONBOARDING): ConfirmScreen {
   const cta = byId<HTMLButtonElement>('cnf-cta');
   const back = byId<HTMLButtonElement>('cnf-back');
   const slotsEl = byId('cnf-slots');
@@ -151,7 +161,7 @@ export function mountConfirm(deps: PageDeps, next: {back(): void; done(): void})
     shown(byId('cnf-success'), phase === 'success');
     cta.disabled = busy || !(phase === 'success' || (phase === 'pick' && resetting === null && complete()));
     back.disabled = busy || phase === 'off';
-    setText(cta, phase === 'success' ? CONFIRM.continue : CONFIRM.confirm);
+    setText(cta, phase === 'success' ? chrome.successCta : CONFIRM.confirm);
   };
 
   const stop = () => {
@@ -203,6 +213,8 @@ export function mountConfirm(deps: PageDeps, next: {back(): void; done(): void})
         phase = 'success';
         drop();
         render();
+        // B1b-2b E15: the verify check records the fact (the success body says whether it could).
+        next.verified?.();
       });
     }
   });
@@ -224,6 +236,11 @@ export function mountConfirm(deps: PageDeps, next: {back(): void; done(): void})
   return {
     show(words) {
       drop();
+      setText(byId('cnf-eyebrow'), chrome.eyebrow);
+      setText(byId('cnf-step'), chrome.step ?? '');
+      shown(byId('cnf-step'), chrome.step !== null);
+      setText(byId('cnf-success-title'), chrome.successTitle);
+      setText(byId('cnf-success-body'), chrome.successBody);
       plan = confirmPlan(words, deps.randomBytes);
       filled = plan.slots.map(() => null);
       phase = 'pick';
````

Modify `extension/src/unlock/screens/reveal.ts`:

````diff
diff --git a/extension/src/unlock/screens/reveal.ts b/extension/src/unlock/screens/reveal.ts
index 88fdec4..6d99d09 100644
--- a/extension/src/unlock/screens/reveal.ts
+++ b/extension/src/unlock/screens/reveal.ts
@@ -1,90 +1,203 @@
 import {createWrongBackoff} from '../orchestrate';
 import {exclusive, type PageDeps} from '../page';
-import {runReveal} from '../revealFlow';
-import {COMMON, REVEAL} from '../strings';
-import {byId, h, onHidden, setText, showScreen} from '../view/dom';
+import {recordVerified, runReveal} from '../revealFlow';
+import {COMMON, PHRASE, REVEAL, cooldownLabel} from '../strings';
+import {byId, setText, showScreen, shown} from '../view/dom';
+import {startCooldown} from '../view/cooldown';
+import {mountConfirm} from './confirm';
+import {mountSeed} from './seed';
 
-export interface RevealScreen {
+export interface PhraseRun {
   show(): void;
-  /**
-   * What the screen still references: the phrase (its words in the list — the module keeps no other copy)
-   * and a typed password (the field, or one taken at the click and not yet handed to the proof).
-   */
+  /** What the run still references: the phrase (its closure, #3's cells, #4's plan) and a typed password. */
   holds(): {phrase: boolean; password: boolean};
 }
 
+type Action = 'unlock' | 'setup';
+
 /**
- * The B1b-1 reveal form (spec §1.2 `reveal`), restyled with the tokens only — B1b-2b builds the
- * designed screen. The phrase is shown after a proof (runReveal: re-authentication, the data key zeroed
- * at once, a passkey's PRF output zeroed on every path), as text, one list item per word. It leaves the
- * DOM — never only CSS-hidden — on [Hide], when the tab is hidden, on `pagehide` and when the screen is
- * left (showScreen's onHidden hook, in the same turn; a MutationObserver on #v-reveal's `hidden` is the
- * backstop): it comes back only with a new proof. A proof that settles after one of those renders
- * nothing (`gen`), so a phrase never lands in a hidden tab.
+ * The reveal and verify modes (spec B1b-2b §3.4, §3.5; D14, D15, D23, C9), on #3's and #4's own mechanics.
+ *
+ * `reveal`: the PASSWORD proves the wallet against the session (runReveal: a mismatch locks; a passkey is refused at the
+ * function boundary, D23 — and no passkey button is drawn, even when one is stored) → #3's pre-reveal modal → press and
+ * hold 2 s → the 20 s auto-blur → "Still looking?"; the grid cancels copy, cut, drag, select and the context menu
+ * (D14), and holds the words only while revealed. #3's [Continue] goes on to #4's check with the words already in
+ * memory (C9: one proof for both). `verify`: the same proof → #4's check directly; the phrase is opened for the check and
+ * never rendered — only #4's pool of nine.
  *
- * The password leaves the field at the click and is handed to the proof in the same turn; a hidden tab
- * or `pagehide` empties the field (§3.5). Rule 6: the page's one `exclusive()` gate.
+ * A passed check records `phraseVerifiedAt` (vault.phraseVerified, E15): "Recovery phrase verified", or O32 when the
+ * background refused. The phrase stays in this closure until the check finishes or the page is left: `pagehide` drops it
+ * (the page may sit in the back/forward cache, which then starts again at the proof); a hidden tab re-blurs #3 and
+ * conceals #4 (their own rules). The modal's Cancel (or its backdrop) drops it and closes the tab — O29 if the browser
+ * keeps the tab open. The password leaves the field at the click; a hidden tab or `pagehide` empties the field.
+ * Rule 6: the page's one `exclusive()` gate on every button.
  */
-export function mountReveal(deps: PageDeps): RevealScreen {
-  const section = byId('v-reveal');
-  const field = byId<HTMLInputElement>('rev-password');
-  const showBtn = byId<HTMLButtonElement>('rev-show');
-  const list = byId('rev-words');
+export function mountPhrase(deps: PageDeps, kind: 'reveal' | 'verify'): PhraseRun {
+  const field = byId<HTMLInputElement>('pp-password');
+  const go = byId<HTMLButtonElement>('pp-continue');
+  const x = byId<HTMLButtonElement>('pp-x');
+  const buttons = {unlock: byId<HTMLButtonElement>('pp-unlock'), setup: byId<HTMLButtonElement>('pp-setup')};
+  const helperEl = byId('pp-helper');
+  const live = byId('pp-cooldown-live');
   const backoff = createWrongBackoff(deps.sleep);
-  const say = (text: string) => setText(byId('rev-helper'), text);
-  /** The typed password between the click and the proof taking it (the same turn). */
+  let view: 'proof' | 'notice' | 'phrase' = 'proof';
+  let actions: readonly Action[] = [];
+  let words: readonly string[] = [];
+  /** Bumped whenever the phrase is dropped: a proof that settles after it shows nothing. */
+  let generation = 0;
   let typed: string | null = null;
-  /** Bumped whenever the phrase is dropped: a proof started before it shows nothing. */
-  let gen = 0;
-  const drop = () => {
-    gen += 1;
-    list.replaceChildren();
+  let stopCooldown: (() => void) | null = null;
+
+  const render = () => {
+    const busy = deps.gate.isBusy();
+    const proof = view === 'proof';
+    const cooling = stopCooldown !== null;
+    setText(byId('pp-title'), kind === 'reveal' ? PHRASE.revealTitle : PHRASE.verifyTitle);
+    setText(byId('pp-lede'), kind === 'reveal' ? PHRASE.revealLede : PHRASE.verifyLede);
+    shown(byId('pp-entry'), proof && !cooling);
+    shown(helperEl, proof && !cooling);
+    shown(byId('pp-cooldown'), cooling);
+    shown(byId('pp-notice'), view === 'notice');
+    shown(go, proof && !cooling);
+    shown(byId('pp-paused'), cooling);
+    field.disabled = busy || !proof;
+    go.disabled = busy || !proof;
+    x.disabled = busy && !cooling;
+    for (const [name, b] of Object.entries(buttons)) {
+      shown(b, view === 'notice' && actions.includes(name as Action));
+      b.disabled = busy;
+    }
+  };
+  const helper = (text: string, error: boolean) => {
+    setText(helperEl, text);
+    helperEl.classList.toggle('error', error);
+    field.classList.toggle('is-error', error);
+  };
+  const notice = (line: string, help: string, next: readonly Action[]) => {
+    view = 'notice';
+    actions = next;
     field.value = '';
-    say('');
+    setText(byId('pp-notice-line'), line);
+    setText(byId('pp-notice-help'), help);
+    shown(byId('pp-notice-help'), help !== '');
+    showScreen('v-phrase-proof');
+    render();
   };
-  const render = () => {
-    showBtn.disabled = deps.gate.isBusy();
-    field.disabled = deps.gate.isBusy();
+  const toProof = () => {
+    view = 'proof';
+    actions = [];
+    helper('', false);
+    showScreen('v-phrase-proof');
+    render();
+    field.focus();
+  };
+  /** The phrase out of this closure (#3 and #4 take theirs out of the DOM themselves). */
+  const drop = () => {
+    words = [];
+    generation += 1;
+  };
+  /** The modal's Cancel, its backdrop, #3's back: nothing is shown any more, and the tab closes. */
+  const cancel = () => {
+    drop();
+    notice(PHRASE.nothingShown, '', []);
+    deps.closeTab();
+  };
+
+  const seed = mountSeed(deps, {back: cancel, done: () => confirm.show(words)}, {eyebrow: PHRASE.eyebrow, step: null});
+  const confirm = mountConfirm(
+    deps,
+    {
+      back: kind === 'reveal' ? () => seed.show(words) : cancel,
+      done: () => deps.closeTab(),
+      verified: () => {
+        // The check is finished: the phrase is no longer needed.
+        drop();
+        void recordVerified(deps.send).then(ok => {
+          if (!ok) setText(byId('cnf-success-body'), PHRASE.notRecorded);
+        });
+      },
+    },
+    {eyebrow: PHRASE.eyebrow, step: null, successTitle: PHRASE.verifiedTitle, successBody: PHRASE.verifiedBody, successCta: PHRASE.closeTab},
+  );
+
+  const endCooldown = () => {
+    stopCooldown?.();
+    stopCooldown = null;
+    setText(live, '');
+  };
+  const cooldown = (ms: number) => {
+    field.value = '';
+    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('pp-timer'), label: byId('pp-cooldown-label'), ring: byId('pp-ring')});
+    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
+    render();
   };
-  const reveal = () =>
+  const prove = () => {
+    if (view !== 'proof' || field.value === '') return;
     void exclusive(deps, render, async () => {
+      if (view !== 'proof' || field.value === '') return;
       typed = field.value;
       field.value = '';
-      list.replaceChildren();
-      say(REVEAL.checking);
-      const mine = gen;
-      const outcome = await backoff.run(async () => {
+      helper(REVEAL.checking, false);
+      const mine = generation;
+      let shownWords: string[] = [];
+      const out = await backoff.run(async () => {
         const password = typed ?? '';
         typed = null;
+        // Password only (D23): the factor type admits nothing else, and runReveal refuses a cast-in PRF output.
         const r = await runReveal({readEnvelope: deps.store.readEnvelope, send: deps.send}, {password, kdf: deps.kdf});
-        if (r.outcome === 'shown' && mine === gen) list.replaceChildren(...r.words.map(w => h('li', '', w)));
+        if (r.outcome === 'shown') shownWords = r.words;
         return r.outcome;
-      }, () => say(COMMON.waitConfirm));
-      // Dropped while the proof ran: the phrase was never put in the DOM, and the helper says nothing of it.
-      say(outcome === 'shown' && mine !== gen ? '' : REVEAL.outcome[outcome]);
+      }, cooldown);
+      endCooldown();
+      if (out === 'shown') {
+        // Dropped (pagehide) while the proof ran: nothing is shown.
+        if (mine !== generation) return;
+        words = shownWords;
+        view = 'phrase';
+        helper('', false);
+        if (kind === 'reveal') seed.show(words);
+        else confirm.show(words);
+        return;
+      }
+      if (out === 'wrong') return helper(COMMON.wrongConfirm, true);
+      if (out === 'not-unlocked') return notice(REVEAL.outcome['not-unlocked'], '', ['unlock']);
+      if (out === 'mismatch-locked') return notice(REVEAL.outcome['mismatch-locked'], '', []);
+      if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, []);
+      if (out === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
+      helper(REVEAL.outcome.failed, false);
     });
+  };
+
   deps.gate.onIdle(render);
-  showBtn.addEventListener('click', reveal);
-  byId('rev-form').addEventListener('submit', e => {
+  byId('pp-form').addEventListener('submit', e => {
     e.preventDefault();
-    reveal();
+    prove();
+  });
+  go.addEventListener('click', prove);
+  x.addEventListener('click', () =>
+    void exclusive(deps, render, async () => {
+      drop();
+      field.value = '';
+      deps.closeTab();
+    }),
+  );
+  buttons.unlock.addEventListener('click', () => {
+    if (actions.includes('unlock')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
+  });
+  buttons.setup.addEventListener('click', () => {
+    if (actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
+  });
+  deps.onLeave(why => {
+    field.value = '';
+    if (why === 'pagehide') drop();
   });
-  byId('rev-hide').addEventListener('click', drop);
-  // Leaving the page (closing the tab, navigating, the back/forward cache) or hiding it (another tab, a
-  // minimised window) drops the words and the typed password.
-  deps.onLeave(drop);
-  // Leaving the screen: showScreen of another screen drops the words in the same turn (onHidden). The
-  // observer is the backstop for anything else that hides #v-reveal (a microtask later).
-  onHidden('v-reveal', drop);
-  new MutationObserver(() => {
-    if (section.hidden) drop();
-  }).observe(section, {attributes: true, attributeFilter: ['hidden']});
+  // A page restored from the back/forward cache dropped its phrase on `pagehide`: it starts again at the proof.
+  deps.onReturn(why => {
+    if (why === 'restored') toProof();
+  });
+
   return {
-    show() {
-      showScreen('v-reveal');
-      render();
-      field.focus();
-    },
-    holds: () => ({phrase: list.childElementCount > 0, password: typed !== null || field.value !== ''}),
+    show: toProof,
+    holds: () => ({phrase: words.length > 0 || seed.holds() || confirm.holds(), password: typed !== null || field.value !== ''}),
   };
 }
````

Modify `extension/src/unlock/screens/seed.ts`:

````diff
diff --git a/extension/src/unlock/screens/seed.ts b/extension/src/unlock/screens/seed.ts
index e732b76..2215331 100644
--- a/extension/src/unlock/screens/seed.ts
+++ b/extension/src/unlock/screens/seed.ts
@@ -4,6 +4,18 @@ import {createHold, type Hold, type HoldState} from '../view/hold';
 import {byId, setText, showScreen, shown} from '../view/dom';
 import {seedWordCells} from '../view/words';
 
+/** What frames #3 (B1b-2b §3.4): onboarding's "Onboarding · 2 / 5", or the reveal mode's "Recovery phrase" with no step. */
+export interface SeedChrome {
+  eyebrow: string;
+  step: string | null;
+}
+const ONBOARDING: SeedChrome = {eyebrow: SEED.onboarding, step: SEED.step};
+/**
+ * D14: while the grid is up (blurred, revealed, still-looking, confirmed) these are cancelled ON THE GRID — never on
+ * the document, so a password manager can still fill a field elsewhere on the page (rev 2, review L5).
+ */
+const GUARDED = ['copy', 'cut', 'dragstart', 'selectstart', 'contextmenu'] as const;
+
 export interface SeedScreen {
   /** Opens #3 at its pre-reveal gate for this phrase (whatever an earlier show() left is taken out first). */
   show(words: readonly string[]): void;
@@ -31,7 +43,7 @@ export interface SeedScreen {
  * `offered`-style guard (welcome.ts): a button acts only on the step it belongs to, whatever its
  * `hidden`/`disabled` say. The grid's press-and-hold is not a click action and is not gated.
  */
-export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}): SeedScreen {
+export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}, chrome: SeedChrome = ONBOARDING): SeedScreen {
   const grid = byId('seed-grid');
   const cta = byId<HTMLButtonElement>('seed-cta');
   const gateContinue = byId<HTMLButtonElement>('sg-continue');
@@ -67,7 +79,7 @@ export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}): S
     byId('seed-overlay-icon').setAttribute('href', still ? '#i-clock' : '#i-eye-off');
     setText(byId('seed-overlay-title'), still ? SEED.stillTitle : SEED.holdTitle);
     setText(byId('seed-overlay-body'), still ? SEED.stillBody : SEED.holdBody);
-    setText(byId('seed-lede'), state === 'confirmed' ? SEED.ledeConfirmed : SEED.lede);
+    setText(byId('seed-lede'), state === 'confirmed' ? SEED.ledeConfirmed : SEED.lede(words.length));
     // A new countdown may announce 10 s again; an ended one leaves nothing for a screen reader to find.
     setText(live, '');
     setText(cta, state === 'confirmed' ? SEED.continue : SEED.written);
@@ -85,12 +97,14 @@ export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}): S
    * Out of the DOM, timers cleared, and the screen's own reference dropped (H2 of the plan review): after
    * any way out of #3 the phrase is held only by the create run, which drops it once the wallet is stored.
    */
+  const guard = (e: Event) => e.preventDefault();
   const clear = () => {
     hold?.dispose();
     hold = null;
     words = [];
     phase = 'off';
     grid.querySelectorAll('.word').forEach(w => w.remove());
+    for (const ev of GUARDED) grid.removeEventListener(ev, guard);
     setText(live, '');
   };
   const press = () => hold?.press();
@@ -137,6 +151,8 @@ export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}): S
   button(byId('sg-backdrop'), 'gate', leave);
   button(gateContinue, 'gate', () => {
     phase = 'seed';
+    for (const ev of GUARDED) grid.addEventListener(ev, guard);
+    grid.classList.toggle('vlt-grid-12', words.length === 12);
     hold = createHold(deps.timers, {state: paint, tick});
     paint('blurred');
     showScreen('v-seed');
@@ -153,6 +169,10 @@ export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}): S
       clear();
       words = w;
       phase = 'gate';
+      setText(byId('seed-eyebrow'), chrome.eyebrow);
+      setText(byId('seed-step'), chrome.step ?? '');
+      shown(byId('seed-step'), chrome.step !== null);
+      setText(byId('sg-body'), SEED.gateBody(w.length));
       showScreen('v-seed-gate');
       render();
     },
````

Modify `extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 32ee761..01d589e 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -32,7 +32,12 @@ export const WELCOME = {
 
 /** #3 seed-display. */
 export const SEED = {
-  lede: '24 words. Write them down on paper, in order. This is the only backup.',
+  /** #3's lede; the count adapted to the phrase (B1b-2b §3.4: 12 or 24 — import accepts both). */
+  lede: (n: number): string => `${n} words. Write them down on paper, in order. This is the only backup.`,
+  /** The pre-reveal modal's body, the count adapted the same way. */
+  gateBody: (n: number): string => `Move to a private place. Anyone who sees these ${n} words can spend everything in this wallet, forever.`,
+  onboarding: 'Onboarding',
+  step: '2 / 5',
   ledeConfirmed: 'Phrase locked in. Tap continue to verify a few words.',
   holdTitle: 'Press and hold to reveal',
   holdBody: 'Make sure no one is looking over your shoulder. Hold for 2 seconds. Auto re-blurs after 20 s for safety.',
@@ -61,6 +66,10 @@ export const CONFIRM = {
   wrongHelper: (position: number): string => `Word #${position} was wrong. Slots will reset in a moment.`,
   confirm: 'Confirm',
   continue: 'Continue',
+  onboarding: 'Onboarding',
+  step: '3 / 5',
+  verifiedTitle: 'Phrase verified',
+  verifiedBody: 'All three words matched. Now lock the wallet with a password.',
 } as const;
 
 /** #5 create password (D7). */
@@ -199,7 +208,31 @@ export const ACCOUNTS = {
   },
 } as const;
 
-/** The reveal form (the B1b-1 words, kept). */
+/** The reveal and verify modes (B1b-2b §3.4, §3.5, D14, D15, D23, C9). */
+export const PHRASE = {
+  /** 2a's top bar, now the #3/#4 eyebrow in place of "Onboarding · 2 / 5" (→ adapted). */
+  eyebrow: 'Recovery phrase',
+  /** O27. */
+  revealTitle: 'Show your recovery phrase',
+  /** O28. */
+  revealLede: 'Enter your password first. Nothing is shown until you press and hold.',
+  /** O30. */
+  verifyTitle: 'Verify your recovery phrase',
+  /** O31. */
+  verifyLede: 'Enter your password, then pick three words from your written copy.',
+  /** O29: the pre-reveal modal's Cancel when the browser keeps the tab open. */
+  nothingShown: 'Nothing is shown. You can close this tab.',
+  /** → adapted (ix:5162 "Phrase verified"; the approved design's wording). */
+  verifiedTitle: 'Recovery phrase verified',
+  /** → adapted (ix:5163 without "Now lock the wallet with a PIN.") + O05. */
+  verifiedBody: 'All three words matched. You can close this tab.',
+  /** O32 (`success-not-recorded`). */
+  notRecorded: 'All three words matched, but this could not be saved. Try again later.',
+  /** 2a's button. */
+  closeTab: 'Close this tab',
+} as const;
+
+/** The reveal proof's outcomes (the B1b-1 words, kept). */
 export const REVEAL = {
   checking: 'Checking…',
   outcome: {
````

Modify `extension/src/unlock/unlock.css`:

````diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 32b6728..1118b15 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -407,17 +407,7 @@
 .vlt-col .vlt-field-row.vlt-field-row-labelled {
   margin-top: 0;
 }
-.vlt-words {
-  display: grid;
-  grid-template-columns: repeat(2, 1fr);
-  grid-auto-flow: column;
-  grid-template-rows: repeat(12, auto);
-  gap: var(--space-2) var(--space-4);
-  margin: 0 var(--space-5);
-  padding-left: var(--space-5);
-  font: 500 14px/22px var(--font-mono);
-  color: var(--fg-primary);
-}
+
 
 /* B1b-2b: an account address in groups of four under its caption (#37's proof, the remove page; C14, C17). */
 .vlt-address {
@@ -425,3 +415,8 @@
   display: flex;
   justify-content: center;
 }
+
+/* B1b-2b §3.4: a 12-word phrase on #3's grid is 2 × 6 (the design draws 24 as 2 × 12, column-major). */
+.vlt-col .s-seed .seed-grid.vlt-grid-12 {
+  grid-template-rows: repeat(6, auto);
+}
````

Modify `extension/src/unlock/view/dom.ts`:

````diff
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index 5b8e0a0..a0aaab4 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -42,7 +42,7 @@ export const SCREENS = [
   'v-forgot',
   'v-reauth',
   'v-accounts',
-  'v-reveal',
+  'v-phrase-proof',
   'v-change-password',
   'v-cp-cancel',
   'v-delete',
````

Modify `extension/unlock.html`:

````diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 66ac73b..70dbd37 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -95,7 +95,7 @@
         <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="sg-title">
           <div class="modal-icon"><svg width="28" height="28" aria-hidden="true"><use href="#i-shield-lock" /></svg></div>
           <h2 id="sg-title" class="noc-h2">About to show your recovery phrase</h2>
-          <p class="body noc-body">Move to a private place. Anyone who sees these 24 words can spend everything in this wallet, forever.</p>
+          <p id="sg-body" class="body noc-body">Move to a private place. Anyone who sees these 24 words can spend everything in this wallet, forever.</p>
           <div class="shield-callout">
             <svg width="14" height="14" aria-hidden="true"><use href="#i-shield-lock" /></svg>
             <span class="noc-caption">We can't recover this for you if someone takes it. Your only copy is the one you write by hand.</span>
@@ -111,8 +111,8 @@
       <section id="v-seed" class="screen s-seed" hidden>
         <div class="top-bar">
           <button id="seed-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
-          <span class="title noc-overline vlt-muted">Onboarding</span>
-          <span class="step noc-body-sm noc-numeral">2 / 5</span>
+          <span id="seed-eyebrow" class="title noc-overline vlt-muted">Onboarding</span>
+          <span id="seed-step" class="step noc-body-sm noc-numeral">2 / 5</span>
         </div>
         <div class="scroll-area">
           <h1 class="noc-h1 vlt-gap-2">Recovery phrase</h1>
@@ -141,8 +141,8 @@
       <section id="v-confirm" class="screen s-confirm" hidden>
         <div class="top-bar">
           <button id="cnf-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
-          <span class="title noc-overline vlt-muted">Onboarding</span>
-          <span class="step noc-body-sm noc-numeral">3 / 5</span>
+          <span id="cnf-eyebrow" class="title noc-overline vlt-muted">Onboarding</span>
+          <span id="cnf-step" class="step noc-body-sm noc-numeral">3 / 5</span>
         </div>
         <div id="cnf-main" class="scroll-area">
           <h1 class="noc-h1 vlt-gap-2">Confirm phrase</h1>
@@ -154,8 +154,8 @@
         <div id="cnf-success" class="success-state" hidden>
           <div class="ring"><svg width="36" height="36" aria-hidden="true"><use href="#i-check" /></svg></div>
           <div>
-            <h2 class="noc-h2 vlt-gap-2">Phrase verified</h2>
-            <p class="noc-body vlt-lede vlt-narrow">All three words matched. Now lock the wallet with a password.</p>
+            <h2 id="cnf-success-title" class="noc-h2 vlt-gap-2">Phrase verified</h2>
+            <p id="cnf-success-body" class="noc-body vlt-lede vlt-narrow">All three words matched. Now lock the wallet with a password.</p>
           </div>
         </div>
         <div class="sticky-bar">
@@ -471,25 +471,44 @@
         </div>
       </section>
 
-      <!-- The B1b-1 reveal form (spec §1.2 `reveal`): restyled with the tokens only; B1b-2b builds the designed screen. -->
-      <section id="v-reveal" class="screen s-pin" hidden>
+      <!-- The reveal and verify proof (B1b-2b §3.4, §3.5, D14, D23): the PASSWORD only, before #3 or #4 shows anything. -->
+      <section id="v-phrase-proof" class="screen s-pin" hidden>
         <div class="top-bar">
+          <button id="pp-x" type="button" class="icon-btn" aria-label="Close"><svg width="22" height="22" aria-hidden="true"><use href="#i-x" /></svg></button>
           <span class="title noc-overline vlt-muted">Recovery phrase</span>
+          <span class="vlt-bar-spacer"></span>
         </div>
-        <div class="pin-head">
-          <h1 class="noc-h1">Your recovery phrase</h1>
-          <p class="noc-body vlt-lede">Anyone who sees these words can take everything in this wallet. There is no copy button, on purpose.</p>
-          <label for="rev-password" class="noc-body-sm vlt-lede vlt-field-label">Password</label>
-          <form id="rev-form" class="vlt-field-row vlt-field-row-labelled">
-            <input id="rev-password" class="vlt-input" type="password" autocomplete="current-password" />
+        <div id="pp-entry" class="pin-head">
+          <h1 id="pp-title" class="noc-h1"></h1>
+          <p id="pp-lede" class="noc-body vlt-lede vlt-narrow"></p>
+          <label for="pp-password" class="noc-body-sm vlt-lede vlt-field-label">Password</label>
+          <form id="pp-form" class="vlt-field-row vlt-field-row-labelled">
+            <input id="pp-password" class="vlt-input" type="password" autocomplete="current-password" />
           </form>
         </div>
-        <p id="rev-helper" class="noc-caption pin-helper" aria-live="polite"></p>
-        <ol id="rev-words" class="vlt-words"></ol>
+        <p id="pp-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        <div id="pp-cooldown" hidden>
+          <div class="vlt-pad-cooldown">
+            <h1 class="noc-h1 vlt-center vlt-gap-2">Wait a moment</h1>
+            <p class="noc-body vlt-lede vlt-center vlt-narrow-300 vlt-gap-5">That did not confirm it. Wait a moment before trying again.</p>
+          </div>
+          <div class="cooldown-card">
+            <div id="pp-ring" class="ring"></div>
+            <div id="pp-timer" class="timer noc-numeral"></div>
+            <div id="pp-cooldown-label" class="noc-body-sm label"></div>
+          </div>
+        </div>
+        <span id="pp-cooldown-live" class="vlt-sr" aria-live="polite"></span>
+        <div id="pp-notice" class="vlt-notice" role="status" hidden>
+          <p id="pp-notice-line" class="noc-body"></p>
+          <p id="pp-notice-help" class="noc-body-sm vlt-lede"></p>
+        </div>
         <div class="pin-spacer"></div>
         <div class="sticky-bar">
-          <button id="rev-show" type="button" class="btn btn-primary">Show the phrase</button>
-          <button id="rev-hide" type="button" class="btn btn-secondary">Hide</button>
+          <button id="pp-continue" type="button" class="btn btn-primary">Continue</button>
+          <button id="pp-paused" type="button" class="btn btn-secondary" disabled hidden>Confirm paused</button>
+          <button id="pp-unlock" type="button" class="btn btn-primary" hidden>Unlock</button>
+          <button id="pp-setup" type="button" class="btn btn-primary" hidden>Set up a wallet</button>
         </div>
       </section>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/unlock/__tests__/accountsReveal.test.ts src/unlock/__tests__/phraseScreen.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 2 passed (2) · Tests 35 passed (35); tsc clean; whole suite Test Files 128 passed (128) · Tests 2266 passed (2266); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  reveal proof, checking (held KDF), pre-reveal modal, blurred, revealed at 13 s (paused clock), still looking, acknowledged, #4 empty, verified; verify proof; not recorded (O32) — Task 20.

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M11a** — the grid copy/select guards never armed — `extension/src/unlock/screens/seed.ts`:

  ```diff
  -     for (const ev of GUARDED) grid.addEventListener(ev, guard);
  + (deleted)
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/phraseScreen.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M11b** — verify does not record the fact — `extension/src/unlock/screens/reveal.ts`:

  ```diff
  - void recordVerified(deps.send).then(
  + void Promise.resolve(true).then(
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/phraseScreen.test.ts` — Expected: **red** (dry run: 2 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/e2e/csp.spec.ts extension/e2e/visual-vault.spec.ts extension/src/unlock/__tests__/accountsReveal.test.ts extension/src/unlock/__tests__/phraseScreen.test.ts extension/src/unlock/mode.ts extension/src/unlock/modes.ts extension/src/unlock/screens/confirm.ts extension/src/unlock/screens/reveal.ts extension/src/unlock/screens/seed.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/src/unlock/view/dom.ts extension/unlock.html
git commit -F - <<'MSG'
feat(extension): ?mode=reveal and ?mode=verify — the phrase behind a password, #3's grid with its guards, #4's check, phraseVerifiedAt

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 12: `?mode=accounts&op=add|remove` — add at a chosen number, remove by index (C14)

**Spec:** §3.6, E13, D16, C5, C6, C14; O33–O38

**Files:**
- Modify: `extension/e2e/csp.spec.ts`
- Modify: `extension/e2e/visual-vault.spec.ts`
- Modify: `extension/src/unlock/__tests__/accountsReveal.test.ts`
- Create: `extension/src/unlock/__tests__/accountsScreen.test.ts`
- Modify: `extension/src/unlock/__tests__/mode.test.ts`
- Modify: `extension/src/unlock/mode.ts`
- Modify: `extension/src/unlock/modes.ts`
- Modify: `extension/src/unlock/screens/accounts.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Task 5's `addAccount`, `lowestFreeIndex`, `isAccountIndex`; 2a's `removeAccount`; `mode.ts`.
- Produces (exact signatures, as exported):
  - `export type AccountsOp = {op: 'add'} | {op: 'remove'; index: number | null};`
  - `export interface AccountsScreen`
  - `export function mountAccounts(deps: PageDeps): AccountsScreen`

`op=add` pre-fills "Account number" with the lowest free index **+ 1** (the user counts from 1) and adds at the number typed (Task 5's `addAccount`): `index-taken`, `bad-index` ("That is not an account number."), `send-open` never applies to add. `op=remove&index=N` names the account by envelope index (0-based; "Remove Account 1?" for `index=0`), shows its address in groups of four, and after the proof removes it (`send-open` refused by the background, C5). An index the envelope lacks is "There is no account with that number." with no form. `PageMode`'s remove index is `number | null` (a malformed index is `null`, never coerced).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/csp.spec.ts`:

````diff
diff --git a/extension/e2e/csp.spec.ts b/extension/e2e/csp.spec.ts
index 6cec284..ea9c2dc 100644
--- a/extension/e2e/csp.spec.ts
+++ b/extension/e2e/csp.spec.ts
@@ -92,9 +92,13 @@ test('csp: every vault-page mode runs with zero CSP violations; an inline style
     await expect(p.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
     await clean('unlock + cooldown ring');
 
-    await p.goto(`${base}?mode=accounts`);
-    await expect(p.getByRole('button', {name: 'Add an account'})).toBeVisible();
-    await clean('accounts');
+    // B1b-2b §3.6: the accounts mode, add and remove.
+    await p.goto(`${base}?mode=accounts&op=add`);
+    await expect(p.locator('#acc-title')).toHaveText('Add an account');
+    await clean('accounts, add');
+    await p.goto(`${base}?mode=accounts&op=remove&index=0`);
+    await expect(p.locator('#acc-title')).toHaveText('Remove Account 1?');
+    await clean('accounts, remove');
     // B1b-2b §3.4 / §3.5: the reveal and verify modes' proof.
     await p.goto(`${base}?mode=reveal`);
     await expect(p.locator('#pp-title')).toHaveText('Show your recovery phrase');
@@ -137,7 +141,7 @@ test('csp: every vault-page mode runs with zero CSP violations; an inline style
     await expect(p.locator('#imp-phrase')).toBeVisible();
     await clean('import');
 
-    expect(seen).toHaveLength(10);
+    expect(seen).toHaveLength(11);
 
     // The positive control, on the same page and watch: an inline <style> and a remote <img> are both refused and reported.
     await p.evaluate(src => {
````

Modify `extension/e2e/visual-vault.spec.ts`:

````diff
diff --git a/extension/e2e/visual-vault.spec.ts b/extension/e2e/visual-vault.spec.ts
index e67597a..57923e6 100644
--- a/extension/e2e/visual-vault.spec.ts
+++ b/extension/e2e/visual-vault.spec.ts
@@ -326,7 +326,7 @@ test('visual: #40 with two accounts, and the D26 state', async () => {
   }
 });
 
-test('visual: #9, #39, the restore and retry steps, the accounts form', async () => {
+test('visual: #9, #39, the restore and retry steps', async () => {
   const h = await launchPopup('noctura-e2e-vis-unlock-');
   try {
     await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
@@ -404,10 +404,6 @@ test('visual: #9, #39, the restore and retry steps, the accounts form', async ()
     await expect(p.getByText('Confirm with the password of the wallet you are replacing')).toBeVisible();
     await shot(p, '08-retry-password');
 
-    await unlockWith(p, h.id, E2E_PASSWORD);
-    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=accounts`);
-    await expect(p.getByRole('button', {name: 'Add an account'})).toBeVisible();
-    await shot(p, 'accounts-form');
 
 
     await h.sw.evaluate(() => chrome.storage.local.set({v1_vault: null}));
````

Modify `extension/src/unlock/__tests__/accountsReveal.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/accountsReveal.test.ts b/extension/src/unlock/__tests__/accountsReveal.test.ts
index b9705d3..bb8d778 100644
--- a/extension/src/unlock/__tests__/accountsReveal.test.ts
+++ b/extension/src/unlock/__tests__/accountsReveal.test.ts
@@ -1,33 +1,18 @@
 // @vitest-environment happy-dom
-import {createEnvelope, type EnvelopeV1} from '../../vault/envelope';
+import {createEnvelope} from '../../vault/envelope';
 import {deriveSessionAccounts} from '../../vault/accounts';
-import {VAULT_KEY} from '../../background/accountsStore';
 import {setSession} from '../../background/session';
-import {mountAccounts} from '../screens/accounts';
 import {startMode} from '../modes';
 import {SCREENS} from '../view/dom';
 import type {PageMode} from '../mode';
-import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';
+import {el, harness, loadPage, testKdf, text, visible} from './pageHarness';
 
+// The vault page's modes and their password fields (B1b-2a §1.2, extended in B1b-2b §1.2). The accounts mode's own
+// tests are accountsScreen.test.ts; the reveal and verify modes', phraseScreen.test.ts.
 const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
 const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
 const PW = 'correct horse battery';
 
-/**
- * Everything the page carries as strings (Task 7's leak detector, as unlockScreen.test.ts has it): every
- * text node, every attribute value and every field's typed `value`, hidden sections included — a phrase
- * only CSS-hidden is still in the DOM. Returns where `secret` was found.
- */
-const carries = (secret: RegExp): string[] => {
-  const out: string[] = [];
-  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
-  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) if (secret.test(n.nodeValue ?? '')) out.push('text');
-  for (const e of document.body.querySelectorAll('*')) for (const a of e.attributes) if (secret.test(a.value)) out.push(`@${a.name}`);
-  for (const f of document.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) if (secret.test(f.value)) out.push(`#${f.id}.value`);
-  return out;
-};
-const PASSWORD = /correct horse battery/;
-
 beforeEach(loadPage);
 
 async function unlockedWallet() {
@@ -37,74 +22,6 @@ async function unlockedWallet() {
   return h;
 }
 
-describe('the add-account form, restyled (spec §1.2 accounts)', () => {
-  it('the design’s chrome around the B1b-1 form; the password adds account 2 and hands over its key', async () => {
-    const h = await unlockedWallet();
-    mountAccounts(h.deps).show();
-    expect(text(el('v-accounts').querySelector('h1'))).toBe('Accounts');
-    expect(text(el('acc-add'))).toBe('Add an account');
-    expect(text(el('acc-remove'))).toBe('Remove the account');
-    expect(unstyled('v-accounts')).toEqual([]);
-    type(el<HTMLInputElement>('acc-password'), PW);
-    click(el('acc-add'));
-    // The password leaves the field at the click.
-    expect(el<HTMLInputElement>('acc-password').value).toBe('');
-    // Rule 6, proven by the gate and not by `disabled`: lift it, type again, click again inside the first run.
-    el<HTMLButtonElement>('acc-add').disabled = false;
-    el<HTMLInputElement>('acc-password').disabled = false;
-    type(el<HTMLInputElement>('acc-password'), PW);
-    click(el('acc-add'));
-    await h.until(() => text(el('acc-helper')) === 'Done. The accounts are updated.');
-    expect(((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1).accounts.map(a => a.index)).toEqual([0, 1]);
-    // The second click inside the first's run did nothing: exactly one addAccount — one proof (its one
-    // vault.status, sent before any Argon2id, so a second run's would already be here) and one store.
-    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
-    expect(h.sent.filter(m => m.type === 'vault.storeEnvelope')).toHaveLength(1);
-  }, 30_000);
-
-  it('remove asks for an account number first', async () => {
-    const h = await unlockedWallet();
-    mountAccounts(h.deps).show();
-    click(el('acc-remove'));
-    await h.until(() => text(el('acc-helper')) !== '');
-    expect(text(el('acc-helper'))).toBe('Enter the number of the account to remove (1, 2, …).');
-  });
-
-  it('remove with no valid number still takes the typed password out of the field', async () => {
-    const h = await unlockedWallet();
-    mountAccounts(h.deps).show();
-    type(el<HTMLInputElement>('acc-password'), PW);
-    type(el<HTMLInputElement>('acc-remove-index'), '0');
-    click(el('acc-remove'));
-    expect(el<HTMLInputElement>('acc-password').value).toBe('');
-    expect(carries(PASSWORD)).toEqual([]);
-    await h.until(() => text(el('acc-helper')) === 'Enter the number of the account to remove (1, 2, …).');
-    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(0);
-  });
-
-  it('remove stays the B1b-1 flow: account 2 removed with the password', async () => {
-    const h = await unlockedWallet();
-    mountAccounts(h.deps).show();
-    type(el<HTMLInputElement>('acc-password'), PW);
-    click(el('acc-add'));
-    await h.until(() => text(el('acc-helper')) === 'Done. The accounts are updated.');
-    type(el<HTMLInputElement>('acc-remove-index'), '2');
-    type(el<HTMLInputElement>('acc-password'), PW);
-    click(el('acc-remove'));
-    expect(text(el('acc-helper'))).toBe('Removing the account…');
-    await h.until(() => text(el('acc-helper')) === 'Done. The accounts are updated.');
-    expect(((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1).accounts.map(a => a.index)).toEqual([0]);
-  }, 30_000);
-
-  it('a hidden tab empties the password field (§3.5)', async () => {
-    const h = await unlockedWallet();
-    mountAccounts(h.deps).show();
-    type(el<HTMLInputElement>('acc-password'), PW);
-    h.leave();
-    expect(carries(PASSWORD)).toEqual([]);
-  });
-});
-
 describe('the two password fields are labelled where a sighted user sees it (Task 18 visual pass)', () => {
   it('accounts, the phrase proof, #36 and the delete page: a visible <label for> "Password", no aria-label standing in, no minlength or required', () => {
     for (const id of ['acc-password', 'pp-password', 'cp-field', 'dl-password']) {
@@ -129,7 +46,8 @@ describe('the dispatcher: each mode shows its one screen', () => {
     [{mode: 'import', source: 'retry'}, 'v-retry'],
     [{mode: 'forgot'}, 'v-forgot'],
     [{mode: 'reauth', challengeId: 'ab'.repeat(16)}, 'v-reauth'],
-    [{mode: 'accounts'}, 'v-accounts'],
+    [{mode: 'accounts', op: 'add'}, 'v-accounts'],
+    [{mode: 'accounts', op: 'remove', index: 0}, 'v-accounts'],
     [{mode: 'reveal'}, 'v-phrase-proof'],
     [{mode: 'verify'}, 'v-phrase-proof'],
     [{mode: 'password'}, 'v-change-password'],
````

Create `extension/src/unlock/__tests__/accountsScreen.test.ts`:

````ts
// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import type {CredentialsApi} from '../../vault/passkey';
import {VAULT_KEY} from '../../background/accountsStore';
import {PENDING_KEY} from '../../background/pendingStore';
import {setSession} from '../../background/session';
import {pendingRecord} from '../../background/__tests__/fixtures';
import {mountAccounts, type AccountsOp} from '../screens/accounts';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1b-2b §3.6 (D16, C6, C14, E13, E16): the accounts mode, against the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PW = 'correct horse battery';
const PRF = crypto.getRandomValues(new Uint8Array(32));

beforeEach(loadPage);

/** Every place the page carries `s` as text, attribute or field value. */
const carries = (s: string): boolean => {
  if (document.body.textContent?.includes(s) === true) return true;
  for (const e of document.body.querySelectorAll('*')) for (const a of e.attributes) if (a.value.includes(s)) return true;
  return [...document.body.querySelectorAll<HTMLInputElement>('input')].some(f => f.value.includes(s));
};

async function shown(op: AccountsOp, o: {indexes?: number[]; names?: string[]; passkey?: boolean; credentials?: CredentialsApi; holdSleep?: boolean} = {}) {
  const indexes = o.indexes ?? [0];
  const keys = await deriveSessionAccounts(M, 'slip10', indexes);
  let env: EnvelopeV1 = await createEnvelope({
    mnemonic: M,
    password: PW,
    scheme: 'slip10',
    accounts: keys.map((k, i) => ({index: k.index, name: o.names?.[i] ?? `Account ${k.index + 1}`, publicKey: k.publicKey})),
    kdf: testKdf,
  });
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), PRF.slice(), new Uint8Array([3]), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: env, ...(o.credentials === undefined ? {} : {credentials: o.credentials}), ...(o.holdSleep === true ? {holdSleep: true} : {})});
  await setSession(h.ext, keys);
  const screen = mountAccounts(h.deps);
  await screen.show(op);
  return {h, screen, env, keys};
}
const stored = async (h: Harness) => (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
const withPassword = (password = PW) => {
  type(el<HTMLInputElement>('acc-password'), password);
  click(el('acc-act'));
};
const DONE = 'Done. The accounts are updated.';

describe('the accounts mode: add (C6)', () => {
  it('idle: O33, the lowest free account number pre-filled (1-based), O35, the extension-only notice, [Add an account]', async () => {
    await shown({op: 'add'}, {indexes: [0, 2]});
    expect(text(el('acc-title'))).toBe('Add an account');
    expect(text(document.querySelector('label[for="acc-index"]'))).toBe('Account number');
    expect(el<HTMLInputElement>('acc-index').value).toBe('2');
    expect(text(el('acc-add-fields'))).toContain('Adding a number this wallet had before brings back the same address.');
    expect(text(el('acc-only'))).toBe('Accounts after the first one exist only in this extension until the phone app supports more than one account.');
    expect(text(el('acc-act'))).toBe('Add an account');
    expect(visible(el('acc-passkey'))).toBe(false);
    expect(visible(el('acc-cancel'))).toBe(false);
    expect(unstyled('v-accounts')).toEqual([]);
  });

  it('adds the pre-filled number (a removed middle account comes back), and pre-fills the next free one after', async () => {
    const {h, keys} = await shown({op: 'add'}, {indexes: [0, 2]});
    withPassword();
    expect(el<HTMLInputElement>('acc-password').value).toBe('');
    await h.until(() => text(el('acc-helper')) === DONE);
    const env = await stored(h);
    expect(env.accounts.map(a => a.index)).toEqual([0, 2, 1]);
    expect(env.accounts.find(a => a.index === 1)?.publicKey).toBe((await deriveSessionAccounts(M, 'slip10', [1]))[0]?.publicKey);
    expect(keys).toHaveLength(2);
    await h.until(() => el<HTMLInputElement>('acc-index').value === '4');
  });

  it('a number taken: O36; not a number: O37 — before any proof', async () => {
    const {h} = await shown({op: 'add'}, {indexes: [0, 1]});
    type(el<HTMLInputElement>('acc-index'), '2');
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'That account is already in this wallet.');
    await h.until(() => !h.deps.gate.isBusy());
    const statuses = h.sent.filter(m => m.type === 'vault.status').length;
    for (const bad of ['0', '1.5', '', '2147483649']) {
      type(el<HTMLInputElement>('acc-index'), bad);
      withPassword();
      await h.until(() => text(el('acc-helper')) === 'That is not an account number.' && !h.deps.gate.isBusy());
      el('acc-helper').textContent = '';
    }
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(statuses);
  });

  it('E16: the passkey proves an add', async () => {
    const credentials: CredentialsApi = {create: async () => null, get: async () => ({getClientExtensionResults: () => ({prf: {results: {first: PRF.slice().buffer}}})}) as unknown as Credential};
    const {h} = await shown({op: 'add'}, {passkey: true, credentials});
    expect(visible(el('acc-passkey'))).toBe(true);
    click(el('acc-passkey'));
    await h.until(() => text(el('acc-helper')) === DONE);
    expect((await stored(h)).accounts.map(a => a.index)).toEqual([0, 1]);
  });
});

describe('the accounts mode: remove (C14)', () => {
  it('index=0 → "Remove Account 1?" (review L2); the address in groups of four, the D16 line — never the name', async () => {
    const {h, keys} = await shown({op: 'remove', index: 0}, {indexes: [0, 1], names: ['Grandma savings', 'Two']});
    expect(text(el('acc-title'))).toBe('Remove Account 1?');
    expect([...el('acc-address').querySelectorAll('.addr-groups span')].map(s => s.textContent).join('')).toBe(keys[0]?.publicKey);
    expect(text(el('acc-remove-info'))).toContain('Its funds stay on Solana; add it again to use them.');
    expect(carries('Grandma savings')).toBe(false);
    expect(text(el('acc-act'))).toBe('Remove the account');
    expect(visible(el('acc-cancel'))).toBe(true);
    expect(visible(el('acc-only'))).toBe(false);
    expect(unstyled('v-accounts')).toEqual([]);
    click(el('acc-cancel'));
    await h.until(() => h.closed === 1);
  });

  it('removes it with the password; the list keeps the others', async () => {
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1, 2]});
    expect(text(el('acc-title'))).toBe('Remove Account 2?');
    withPassword();
    expect(text(el('acc-helper'))).toBe('Removing the account…');
    await h.until(() => text(el('acc-helper')) === DONE);
    expect((await stored(h)).accounts.map(a => a.index)).toEqual([0, 2]);
    expect(visible(el('acc-act'))).toBe(false);
  });

  it('C5: a send from it still open — the adapted send-open line; nothing changes', async () => {
    const {h, keys, env} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    await h.ext.local.set(PENDING_KEY, [pendingRecord({account: keys[1]?.publicKey})]);
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.');
    expect(await stored(h)).toEqual(env);
  });

  it('unknown-index: an index the envelope does not hold, or one that did not parse — the line, no action', async () => {
    await shown({op: 'remove', index: 7}, {indexes: [0, 1]});
    expect(text(el('acc-helper'))).toBe('There is no account with that number.');
    expect(visible(el('acc-act'))).toBe(false);
    expect(visible(el('acc-form'))).toBe(false);
    loadPage();
    await shown({op: 'remove', index: null}, {indexes: [0, 1]});
    expect(text(el('acc-helper'))).toBe('There is no account with that number.');
    expect(visible(el('acc-act'))).toBe(false);
  });

  it('the last account: refused by the flow (the manager disables its trash button anyway)', async () => {
    const {h} = await shown({op: 'remove', index: 0}, {indexes: [0]});
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'The last account cannot be removed.');
  });

  it('rule 6: a second [Remove the account] inside the floor (`disabled` lifted) runs no second proof', async () => {
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1], holdSleep: true});
    withPassword();
    el<HTMLButtonElement>('acc-act').disabled = false;
    el<HTMLInputElement>('acc-password').disabled = false;
    withPassword();
    await h.until(() => h.sent.some(m => m.type === 'vault.status'));
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    h.wake();
  });

  it('a hidden tab empties the password field', async () => {
    const {h, screen} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    type(el<HTMLInputElement>('acc-password'), PW);
    h.leave();
    expect(screen.holds()).toBe(false);
  });
});

````

Modify `extension/src/unlock/__tests__/mode.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/mode.test.ts b/extension/src/unlock/__tests__/mode.test.ts
index f270c8a..671d1c8 100644
--- a/extension/src/unlock/__tests__/mode.test.ts
+++ b/extension/src/unlock/__tests__/mode.test.ts
@@ -8,11 +8,27 @@ describe('pageMode', () => {
     expect(pageMode('?mode=create')).toEqual({mode: 'create'});
     expect(pageMode('?mode=import')).toEqual({mode: 'import', source: null});
     expect(pageMode('?mode=forgot')).toEqual({mode: 'forgot'});
-    expect(pageMode('?mode=accounts')).toEqual({mode: 'accounts'});
+    expect(pageMode('?mode=accounts')).toEqual({mode: 'accounts', op: 'add'});
     expect(pageMode('?mode=reveal')).toEqual({mode: 'reveal'});
+    expect(pageMode('?mode=verify')).toEqual({mode: 'verify'});
+    expect(pageMode('?mode=password')).toEqual({mode: 'password'});
+    expect(pageMode('?mode=delete')).toEqual({mode: 'delete'});
     expect(pageMode('?mode=export')).toEqual({mode: 'unlock', returnTo: null});
   });
 
+  // B1b-2b §1.2 (L2): `index` is the envelope's own 0-based index; one that does not parse, or above 2^31 − 1, is null —
+  // the page names no account and offers nothing. `op` is a closed enum (anything else is add).
+  it('accounts: op=add|remove; index ^\\d{1,10}$ within the hardened limit', () => {
+    expect(pageMode('?mode=accounts&op=add')).toEqual({mode: 'accounts', op: 'add'});
+    expect(pageMode('?mode=accounts&op=forget')).toEqual({mode: 'accounts', op: 'add'});
+    expect(pageMode('?mode=accounts&op=remove&index=0')).toEqual({mode: 'accounts', op: 'remove', index: 0});
+    expect(pageMode('?mode=accounts&op=remove&index=2147483647')).toEqual({mode: 'accounts', op: 'remove', index: 2 ** 31 - 1});
+    for (const index of ['2147483648', '-1', '1.5', '', 'x', '12345678901', '0x10']) {
+      expect(pageMode(`?mode=accounts&op=remove&index=${index}`)).toEqual({mode: 'accounts', op: 'remove', index: null});
+    }
+    expect(pageMode('?mode=accounts&op=remove')).toEqual({mode: 'accounts', op: 'remove', index: null});
+  });
+
   it('re-authentication needs a well-formed challenge id', () => {
     expect(pageMode(`?mode=reauth&challenge=${id}`)).toEqual({mode: 'reauth', challengeId: id});
     expect(pageMode('?mode=reauth&challenge=<b>')).toEqual({mode: 'unlock', returnTo: null});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/unlock/__tests__/accountsReveal.test.ts src/unlock/__tests__/accountsScreen.test.ts src/unlock/__tests__/mode.test.ts
```
Expected (dry run, these test files on Task 11's tree): **red** — Test Files 2 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/unlock/mode.ts`:

````diff
diff --git a/extension/src/unlock/mode.ts b/extension/src/unlock/mode.ts
index b39abe4..97499cb 100644
--- a/extension/src/unlock/mode.ts
+++ b/extension/src/unlock/mode.ts
@@ -9,7 +9,13 @@ export type PageMode =
   | {mode: 'create'}
   | {mode: 'import'; source: ImportSource | null}
   | {mode: 'forgot'}
-  | {mode: 'accounts'}
+  /**
+   * B1b-2b §1.2, §3.6: add (`op=add`, the default) or remove the account whose envelope `index` (0-based) the URL names —
+   * null when it does not parse or exceeds 2^31 − 1: the page then says there is no such account and offers nothing.
+   * The index only names what the proof screen describes; nothing starts without a proof.
+   */
+  | {mode: 'accounts'; op: 'add'}
+  | {mode: 'accounts'; op: 'remove'; index: number | null}
   | {mode: 'reveal'}
   | {mode: 'reauth'; challengeId: string}
   /** B1b-2b §1.2: #36 change password (unlocked session, password only, D8). */
@@ -22,6 +28,8 @@ export type PageMode =
   | {mode: 'verify'};
 
 const SOURCES: readonly string[] = ['forgot', 'retry'];
+/** The SLIP-0010 hardened limit (accountsFlow.MAX_ACCOUNT_INDEX; mode.ts imports nothing that holds a key). */
+const MAX_INDEX = 2 ** 31 - 1;
 const RETURNS: readonly string[] = ['created', 'imported'];
 
 /**
@@ -32,7 +40,13 @@ const RETURNS: readonly string[] = ['created', 'imported'];
 export function pageMode(search: string): PageMode {
   const p = new URLSearchParams(search);
   const m = p.get('mode');
-  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal' || m === 'password' || m === 'delete' || m === 'verify') return {mode: m};
+  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'reveal' || m === 'password' || m === 'delete' || m === 'verify') return {mode: m};
+  if (m === 'accounts') {
+    if (p.get('op') !== 'remove') return {mode: 'accounts', op: 'add'};
+    const raw = p.get('index') ?? '';
+    const index = /^\d{1,10}$/.test(raw) ? Number(raw) : null;
+    return {mode: 'accounts', op: 'remove', index: index !== null && index <= MAX_INDEX ? index : null};
+  }
   if (m === 'import') {
     const source = p.get('source') ?? '';
     return {mode: 'import', source: SOURCES.includes(source) ? (source as ImportSource) : null};
````

Modify `extension/src/unlock/modes.ts`:

````diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 48db711..e9b12ff 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -50,7 +50,7 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
       void mountReauth(deps).show(mode.challengeId);
       return;
     case 'accounts':
-      mountAccounts(deps).show();
+      void mountAccounts(deps).show(mode.op === 'add' ? {op: 'add'} : {op: 'remove', index: mode.index});
       return;
     case 'reveal':
     case 'verify':
````

Modify `extension/src/unlock/screens/accounts.ts`:

````diff
diff --git a/extension/src/unlock/screens/accounts.ts b/extension/src/unlock/screens/accounts.ts
index 67bb0fe..6dd0a6e 100644
--- a/extension/src/unlock/screens/accounts.ts
+++ b/extension/src/unlock/screens/accounts.ts
@@ -1,68 +1,175 @@
-import {addAccount, lowestFreeIndex, removeAccount} from '../accountsFlow';
-import {storedVault} from '../stored';
+import {evaluatePrf} from '../../vault/passkey';
+import {unb64} from '../../vault/bytes';
+import type {EnvelopeV1} from '../../vault/envelope';
+import type {ReauthFactor} from '../../vault/reauth';
+import {addAccount, lowestFreeIndex, removeAccount, type AccountsOutcome} from '../accountsFlow';
 import {createWrongBackoff} from '../orchestrate';
 import {exclusive, type PageDeps} from '../page';
+import {storedVault} from '../stored';
 import {ACCOUNTS, COMMON} from '../strings';
-import {byId, setText, showScreen} from '../view/dom';
+import {byId, setText, showScreen, shown} from '../view/dom';
+import {addressGroups} from '../view/words';
+
+export type AccountsOp = {op: 'add'} | {op: 'remove'; index: number | null};
+
+export interface AccountsScreen {
+  show(op: AccountsOp): Promise<void>;
+  /** For the tests: a typed password the screen still references. */
+  holds(): boolean;
+}
 
 /**
- * The add-account form (spec §1.2 `accounts`, opened by the switcher's [Add account]): the password →
- * a re-encrypted envelope with one more account. Restyled into the design's chrome; remove stays the
- * B1b-1 form (B1b-2b designs the accounts manager). Rule 6 on both buttons (the page's one gate). The
- * flows read v1_vault through stored.ts's storedVault (accountsFlow); this screen reads nothing itself.
- * The password leaves the field at the click, and a hidden tab or `pagehide` empties the field (§3.5).
+ * The accounts mode (spec B1b-2b §3.6; D16, C6, C14, E13, E16). Opened by the accounts manager.
+ * - `op=add`: the account number (1-based) is pre-filled with the LOWEST free one (C6: "add it again" is the default
+ *   after a remove) and may be changed — adding a number this wallet had before brings back the same address. The
+ *   extension-only notice (B1 §2) stands under it.
+ * - `op=remove&index=N`: "Remove Account N+1?" with the address of envelope index N in groups of four, read from the
+ *   stored envelope before any proof — never the account's name (C14: the vault page shows no user text but the phrase).
+ *   An index the envelope does not hold (or that did not parse) is "There is no account with that number." with no
+ *   action. The background refuses a remove while a send from it is open (C5).
+ * Both prove with the password or — when one is stored — the passkey (E16; a mismatch locks). The password leaves the
+ * field at the click; a hidden tab or `pagehide` empties it. Rule 6: the page's one `exclusive()` gate.
  */
-export function mountAccounts(deps: PageDeps): {show(): void} {
+export function mountAccounts(deps: PageDeps): AccountsScreen {
   const field = byId<HTMLInputElement>('acc-password');
-  const add = byId<HTMLButtonElement>('acc-add');
-  const remove = byId<HTMLButtonElement>('acc-remove');
+  const number = byId<HTMLInputElement>('acc-index');
+  const act = byId<HTMLButtonElement>('acc-act');
+  const passkeyBtn = byId<HTMLButtonElement>('acc-passkey');
+  const cancel = byId<HTMLButtonElement>('acc-cancel');
   const backoff = createWrongBackoff(deps.sleep);
+  let op: AccountsOp = {op: 'add'};
+  /** The page can act: a wallet is stored, and (remove) it holds the account named. */
+  let ready = false;
+  let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
+  let typed: string | null = null;
+
   const say = (text: string) => setText(byId('acc-helper'), text);
   const render = () => {
     const busy = deps.gate.isBusy();
-    add.disabled = busy;
-    remove.disabled = busy;
-    field.disabled = busy;
+    const remove = op.op === 'remove';
+    shown(byId('acc-add-fields'), !remove);
+    shown(byId('acc-only'), !remove);
+    shown(byId('acc-remove-info'), remove && ready);
+    shown(byId('acc-password-label'), ready);
+    shown(byId('acc-form'), ready);
+    shown(act, ready);
+    setText(act, remove ? ACCOUNTS.remove : ACCOUNTS.add);
+    shown(passkeyBtn, ready && pk !== null);
+    shown(cancel, remove);
+    field.disabled = busy || !ready;
+    number.disabled = busy || !ready;
+    act.disabled = busy || !ready;
+    passkeyBtn.disabled = busy || !ready || pk === null;
+    cancel.disabled = busy;
   };
-  const factor = () => {
-    const password = field.value;
-    field.value = '';
-    return {password, kdf: deps.kdf};
+  /** Reads the stored envelope: what the page shows comes from its public fields only (readLocal), before any proof. */
+  const load = async () => {
+    ready = false;
+    pk = null;
+    render();
+    let raw: unknown;
+    try {
+      raw = await deps.store.readEnvelope();
+    } catch {
+      return say(COMMON.unreadable);
+    }
+    const stored = storedVault(raw);
+    if (stored.kind === 'none') return say(COMMON.noWallet);
+    if (stored.kind === 'damaged') return say(COMMON.damaged);
+    const env = stored.env;
+    if (op.op === 'add') {
+      setText(byId('acc-title'), ACCOUNTS.addTitle);
+      number.value = String(lowestFreeIndex(env.accounts.map(a => a.index)) + 1);
+    } else {
+      const index = op.index;
+      const account = index === null ? undefined : env.accounts.find(a => a.index === index);
+      if (index === null || account === undefined) {
+        setText(byId('acc-title'), '');
+        return say(ACCOUNTS.outcome['no-such-account']);
+      }
+      setText(byId('acc-title'), ACCOUNTS.removeTitle(index + 1));
+      byId('acc-address').replaceChildren(addressGroups(account.publicKey));
+    }
+    pk = env.passkey ?? null;
+    ready = true;
+    render();
+    field.focus();
   };
-  const store = {...deps.store, send: deps.send};
-  const doAdd = () =>
-    void exclusive(deps, render, async () => {
-      const f = factor();
-      say(ACCOUNTS.adding);
+  const outcome = async (run: () => Promise<AccountsOutcome>) => {
+    say(op.op === 'remove' ? ACCOUNTS.removing : ACCOUNTS.adding);
+    const out = await backoff.run(run, () => say(COMMON.waitConfirm));
+    say(ACCOUNTS.outcome[out]);
+    // The account list changed: the next free number moves on (add), and a removed account is gone (remove).
+    if (out === 'done' && op.op === 'add') {
       const stored = storedVault(await deps.store.readEnvelope());
-      const index = lowestFreeIndex(stored.kind === 'wallet' ? stored.env.accounts.map(a => a.index) : []);
-      say(ACCOUNTS.outcome[await backoff.run(() => addAccount(store, f, index), () => say(COMMON.waitConfirm))]);
+      if (stored.kind === 'wallet') number.value = String(lowestFreeIndex(stored.env.accounts.map(a => a.index)) + 1);
+    }
+    if ((out === 'done' || out === 'done-locked' || out === 'done-not-locked') && op.op === 'remove') {
+      ready = false;
+      render();
+    }
+  };
+  const act1 = (factor: ReauthFactor) => {
+    const current = op;
+    if (current.op === 'remove') {
+      const index = current.index;
+      if (index === null) return outcome(async () => 'no-such-account');
+      return outcome(() => removeAccount({...deps.store, send: deps.send}, factor, index));
+    }
+    // The 1-based number as typed: anything that is not a whole number from 1 is `bad-index` (addAccount refuses it
+    // before any proof).
+    const n = Number(number.value);
+    const index = number.value.trim() === '' || !Number.isSafeInteger(n) ? -1 : n - 1;
+    return outcome(() => addAccount({...deps.store, send: deps.send}, factor, index));
+  };
+  const withPassword = () => {
+    if (!ready || field.value === '') return;
+    void exclusive(deps, render, async () => {
+      if (!ready || field.value === '') return;
+      typed = field.value;
+      field.value = '';
+      const password = typed;
+      typed = null;
+      await act1({password, kdf: deps.kdf});
+    });
+  };
+  const withPasskey = () => {
+    if (!ready || pk === null) return;
+    void exclusive(deps, render, async () => {
+      const key = pk;
+      if (!ready || key === null) return;
+      field.value = '';
+      let prfOutput: Uint8Array | null;
+      try {
+        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
+      } catch {
+        prfOutput = null;
+      }
+      if (prfOutput === null) return say(COMMON.passkeyUnavailableConfirm);
+      // The accounts flow zeroes the PRF output on every path (withProvenSeed; a bad index too).
+      await act1({prfOutput});
     });
+  };
+
   deps.gate.onIdle(render);
-  add.addEventListener('click', doAdd);
+  act.addEventListener('click', withPassword);
   byId('acc-form').addEventListener('submit', e => {
     e.preventDefault();
-    doAdd();
+    withPassword();
   });
-  remove.addEventListener('click', () =>
-    void exclusive(deps, render, async () => {
-      const n = Number(byId<HTMLInputElement>('acc-remove-index').value);
-      // The password leaves the field at the click on every branch, the refused number included.
-      const f = factor();
-      if (!Number.isSafeInteger(n) || n < 1) return say(ACCOUNTS.whichToRemove);
-      say(ACCOUNTS.removing);
-      say(ACCOUNTS.outcome[await backoff.run(() => removeAccount(store, f, n - 1), () => say(COMMON.waitConfirm))]);
-    }),
-  );
-  // A hidden tab or a page left behind (the back/forward cache) keeps nothing typed (§3.5's memory rule).
+  passkeyBtn.addEventListener('click', withPasskey);
+  cancel.addEventListener('click', () => void exclusive(deps, render, async () => deps.closeTab()));
+  // A hidden tab or a page left behind (the back/forward cache) keeps nothing typed (2a §3.5's memory rule).
   deps.onLeave(() => {
     field.value = '';
   });
   return {
-    show() {
+    async show(which) {
+      op = which;
+      say('');
       showScreen('v-accounts');
-      render();
-      field.focus();
+      await load();
     },
+    holds: () => typed !== null || field.value !== '',
   };
 }
````

Modify `extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 01d589e..adea4aa 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -180,11 +180,17 @@ export const RETRY = {
   storeFailed: 'The new wallet was not saved. Try again.',
 } as const;
 
-/** The add-account form (the B1b-1 words, kept). */
+/** The accounts mode (B1b-2b §3.6; the B1b-1 words kept). */
 export const ACCOUNTS = {
   adding: 'Adding an account…',
   removing: 'Removing the account…',
-  whichToRemove: 'Enter the number of the account to remove (1, 2, …).',
+  /** O33. */
+  addTitle: 'Add an account',
+  /** O38: N is the envelope index + 1 (index=0 → "Remove Account 1?", review L2). */
+  removeTitle: (n: number): string => `Remove Account ${n}?`,
+  /** 2a's buttons. */
+  add: 'Add an account',
+  remove: 'Remove the account',
   outcome: {
     done: 'Done. The accounts are updated.',
     'done-locked': 'The accounts were changed, and the wallet has been locked. Unlock it to use them.',
````

Modify `extension/src/unlock/unlock.css`:

````diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 1118b15..2d18c4c 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -420,3 +420,7 @@
 .vlt-col .s-seed .seed-grid.vlt-grid-12 {
   grid-template-rows: repeat(6, auto);
 }
+/* B1b-2b §3.6: the accounts page's number field and the remove page's address span the head's column. */
+.vlt-full {
+  width: 100%;
+}
````

Modify `extension/unlock.html`:

````diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 70dbd37..531f8a3 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -446,28 +446,39 @@
         </div>
       </section>
 
-      <!-- The add-account form (spec §1.2 `accounts`): restyled; remove stays the B1b-1 form (B1b-2b designs the manager). -->
+      <!-- The accounts mode (B1b-2b §3.6, C6, C14, E13, E16): add an account at a chosen number, or remove the one the
+           manager named — after a password or passkey proof. The remove page shows "Account N" and the address, never the name. -->
       <section id="v-accounts" class="screen s-pin" hidden>
         <div class="top-bar">
           <span class="title noc-overline vlt-muted">Accounts</span>
         </div>
         <div class="pin-head">
           <div class="vlt-lock-tile" aria-hidden="true"><svg width="28" height="28"><use href="#i-key" /></svg></div>
-          <h1 class="noc-h1">Accounts</h1>
-          <label for="acc-password" class="noc-body-sm vlt-lede vlt-field-label">Password</label>
+          <h1 id="acc-title" class="noc-h1"></h1>
+          <div id="acc-add-fields" class="vlt-stack vlt-full">
+            <label for="acc-index" class="noc-body-sm vlt-lede vlt-field-label">Account number</label>
+            <input id="acc-index" class="vlt-input" type="number" min="1" inputmode="numeric" />
+            <p class="noc-caption vlt-muted">Adding a number this wallet had before brings back the same address.</p>
+          </div>
+          <div id="acc-remove-info" class="vlt-full" hidden>
+            <div id="acc-address" class="vlt-address"></div>
+            <p class="noc-body vlt-lede vlt-gap-top-3">Its funds stay on Solana; add it again to use them.</p>
+          </div>
+          <label id="acc-password-label" for="acc-password" class="noc-body-sm vlt-lede vlt-field-label">Password</label>
           <form id="acc-form" class="vlt-field-row vlt-field-row-labelled">
             <input id="acc-password" class="vlt-input" type="password" autocomplete="current-password" />
           </form>
         </div>
         <p id="acc-helper" class="noc-caption pin-helper" aria-live="polite"></p>
-        <div class="vlt-pad vlt-stack">
-          <label for="acc-remove-index" class="noc-body-sm vlt-lede">Account number to remove</label>
-          <input id="acc-remove-index" class="vlt-input" type="number" min="1" />
-          <button id="acc-remove" type="button" class="btn btn-secondary">Remove the account</button>
+        <div id="acc-only" class="banner info vlt-banner-gap">
+          <svg width="16" height="16" aria-hidden="true"><use href="#i-info" /></svg>
+          <div class="noc-body-sm">Accounts after the first one exist only in this extension until the phone app supports more than one account.</div>
         </div>
         <div class="pin-spacer"></div>
         <div class="sticky-bar">
-          <button id="acc-add" type="button" class="btn btn-primary">Add an account</button>
+          <button id="acc-act" type="button" class="btn btn-primary"></button>
+          <button id="acc-passkey" type="button" class="btn btn-secondary" hidden>Confirm with passkey</button>
+          <button id="acc-cancel" type="button" class="btn btn-secondary" hidden>Cancel</button>
         </div>
       </section>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/unlock/__tests__/accountsReveal.test.ts src/unlock/__tests__/accountsScreen.test.ts src/unlock/__tests__/mode.test.ts
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 3 passed (3) · Tests 35 passed (35); tsc clean; whole suite Test Files 129 passed (129) · Tests 2274 passed (2274); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  add idle (pre-filled 3), adding (held KDF), done, index taken, bad index, remove idle, removing (held KDF), send-open, unknown index — Task 20.

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M12a** — remove of an unknown index names an account — `extension/src/unlock/screens/accounts.ts`:

  ```diff
  - env.accounts.find(a => a.index === index)
  + env.accounts[0]
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/accountsScreen.test.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M12b** — the add page pre-fills a 0-based number — `extension/src/unlock/screens/accounts.ts`:

  ```diff
  - number.value = String(lowestFreeIndex(env.accounts.map(a => a.index)) + 1);
  + number.value = String(lowestFreeIndex(env.accounts.map(a => a.index)));
  ```
  `timeout 300 npx vitest run src/unlock/__tests__/accountsScreen.test.ts` — Expected: **red** (dry run: 3 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/e2e/csp.spec.ts extension/e2e/visual-vault.spec.ts extension/src/unlock/__tests__/accountsReveal.test.ts extension/src/unlock/__tests__/accountsScreen.test.ts extension/src/unlock/__tests__/mode.test.ts extension/src/unlock/mode.ts extension/src/unlock/modes.ts extension/src/unlock/screens/accounts.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/unlock.html
git commit -F - <<'MSG'
feat(extension): ?mode=accounts&op=add|remove — add at a chosen number, remove by index (C14)

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 13: The passkey screen (popup, off / on) and the icons the new screens use

**Spec:** §4.4, D12, D13; O62, O63; #6 (ix:13616)

**Files:**
- Modify: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Modify: `extension/src/app/App.tsx`
- Create: `extension/src/app/__tests__/Passkey.test.tsx`
- Modify: `extension/src/app/app.css`
- Create: `extension/src/app/screens/Passkey.tsx`
- Modify: `extension/src/app/ui/ExtIcon.tsx`

**Interfaces:**
- Consumes: Task 7's `ExtensionPage` and `WalletState.passkey`; `LockedButton`; `TopBar`.
- Produces (exact signatures, as exported):
  - `export const PASSKEY_MARKER = 'extensions:{prf:{eval:{first:';`
  - `export const WEBAUTHN_MARKER = 'navigator.credentials';`
  - `export const PASSKEY_TEXT =`
  - `export function Passkey({onBack}: {onBack: () => void})`

A bare route from #31 and #35. Off: "Unlock Noctura with a passkey", the lede, the three benefit rows, the synced-passkey tip, `[Add a passkey]` → `passkey&op=add`. On: "Passkey is on", `[Replace passkey]` → `passkey&op=add`, `[Remove passkey]` → `passkey&op=remove`. Each button is a `LockedButton` (rule 6) that opens the page and closes the popup. `ExtIcon` gains user, key, fingerprint, shield-check, database, trash, zap, arrow-up, arrow-down. **The vault-isolation gate's passkey markers change** (Scope 3.14): the approved tip names `wallet.noc-tura.io` in the popup's prose, which the old marker (the RP ID) read as passkey code. Two markers replace it: the PRF evaluation as built (`extensions:{prf:{eval:{first:`) and the WebAuthn API itself (`navigator.credentials`, only `src/unlock/browser.ts` spells it — review H1), each with presence and leak fixtures; the manifest-only fixture is retargeted (review L1).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index 8b5712a..17c7167 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -4,7 +4,7 @@ import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {
   bundleViolations, htmlViolations, listSourceFiles, manifestViolations, sourceViolations, vaultPageModuleViolations, vaultPageViolations,
-  BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, REACT_MARKER, VAULT_MARKER, WORDLIST_MARKER,
+  BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, REACT_MARKER, VAULT_MARKER, WEBAUTHN_MARKER, WORDLIST_MARKER,
 } from '../check-vault-isolation.mjs';
 import {render} from '../../manifest/source.mjs';
 
@@ -490,7 +490,7 @@ describe('vault isolation (built output)', () => {
     write('assets/react-1.js', `export const R="${REACT_MARKER}";`);
     write('assets/send-1.js', 'export const t=()=>1;');
     write('unlock.html', html('./assets/unlock-1.js'));
-    write('assets/unlock-1.js', `import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
+    write('assets/unlock-1.js', `import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const n="${WEBAUTHN_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
     write('assets/kdf.worker-1.js', `throw Error("${KDF_MARKER}");`);
   };
 
@@ -867,16 +867,16 @@ describe('vault isolation (built output)', () => {
 
   it('does not follow imports out of the unlock bundle (it may carry the vault)', () => {
     write('assets/unlock-1.js', `import"./vault-1.js";`);
-    write('assets/vault-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
+    write('assets/vault-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const n="${WEBAUTHN_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
     expect(bundleViolations(dir)).toEqual([]);
   });
 
   it('fails when the vault page imports the background entry, directly or through a chunk (it would run the background)', () => {
-    write('assets/unlock-1.js', `import{t as x}from"../background.js";import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
+    write('assets/unlock-1.js', `import{t as x}from"../background.js";import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const n="${WEBAUTHN_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
     // …and through it the background's storage.session chunk (the rule below).
     const viaBackground = 'assets/session-1.js (reachable from unlock.html) touches storage.session — only the background may';
     expect(bundleViolations(dir)).toEqual(['the vault page (assets/unlock-1.js) reaches background.js — it would run the background', viaBackground]);
-    write('assets/unlock-1.js', `import"./mid-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
+    write('assets/unlock-1.js', `import"./mid-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const n="${WEBAUTHN_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
     write('assets/mid-1.js', 'import"../background.js";');
     expect(bundleViolations(dir)).toEqual(['the vault page (assets/unlock-1.js) reaches background.js — it would run the background', viaBackground]);
   });
@@ -889,9 +889,9 @@ describe('vault isolation (built output)', () => {
   });
 
   it('is INCONCLUSIVE — and fails — when any marker is in no built file', () => {
-    const all = {i: VAULT_MARKER, d: DERIVATION_MARKER, b: BIP39_MARKER, r: PASSKEY_MARKER, w: WORDLIST_MARKER};
+    const all = {i: VAULT_MARKER, d: DERIVATION_MARKER, b: BIP39_MARKER, r: PASSKEY_MARKER, n: WEBAUTHN_MARKER, w: WORDLIST_MARKER};
     const without = k => Object.entries(all).filter(([n]) => n !== k).map(([n, m]) => `const ${n}=\`${m}\`;`).join('');
-    for (const [k, name, marker] of [['i', 'envelope', VAULT_MARKER], ['d', 'derivation', DERIVATION_MARKER], ['b', 'bip39', BIP39_MARKER], ['r', 'passkey', PASSKEY_MARKER], ['w', 'wordlist', WORDLIST_MARKER]]) {
+    for (const [k, name, marker] of [['i', 'envelope', VAULT_MARKER], ['d', 'derivation', DERIVATION_MARKER], ['b', 'bip39', BIP39_MARKER], ['r', 'passkey', PASSKEY_MARKER], ['n', 'webauthn', WEBAUTHN_MARKER], ['w', 'wordlist', WORDLIST_MARKER]]) {
       write('assets/unlock-1.js', without(k));
       expect(bundleViolations(dir)).toEqual([`INCONCLUSIVE: the ${name} marker "${marker}" is in no built JS file — the check would pass trivially`]);
     }
@@ -900,12 +900,18 @@ describe('vault isolation (built output)', () => {
     expect(bundleViolations(dir)).toEqual([`INCONCLUSIVE: the kdf marker "${KDF_MARKER}" is in no built JS file — the check would pass trivially`]);
   });
 
-  // The built manifest names wallet.noc-tura.io (a host permission): a marker that only a
-  // non-JS file carries must not count as present.
+  // Only JS files count: a marker that only a non-JS file carries (here the manifest, which really
+  // does name wallet.noc-tura.io as a host permission; B1b-2b review L1 retargeted this fixture when the
+  // passkey markers stopped being that host) must not count as present.
   it('does not count a marker found only in a non-JS file (the manifest) as present', () => {
-    write('assets/unlock-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
-    write('manifest.json', `{"host_permissions":["https://${PASSKEY_MARKER}/*"]}`);
-    expect(bundleViolations(dir)).toEqual([`INCONCLUSIVE: the passkey marker "${PASSKEY_MARKER}" is in no built JS file — the check would pass trivially`]);
+    write('assets/unlock-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
+    write('manifest.json', `{"host_permissions":["https://wallet.noc-tura.io/*"],"note":"${WEBAUTHN_MARKER}"}`);
+    expect(bundleViolations(dir)).toEqual([`INCONCLUSIVE: the webauthn marker "${WEBAUTHN_MARKER}" is in no built JS file — the check would pass trivially`]);
+  });
+
+  it('B1b-2b review H1: a non-PRF WebAuthn call in a popup chunk fails (the webauthn marker alone)', () => {
+    write('assets/send-1.js', 'export const t=()=>navigator.credentials.get({publicKey:{rpId:"wallet.noc-tura.io",challenge:new Uint8Array(32)}});');
+    expect(bundleViolations(dir)).toEqual(['assets/send-1.js (reachable from assets/popup-1.js) contains vault code (webauthn)']);
   });
 
   it('fails on the passkey marker alone — the reproduced leak split passkey.ts into its own chunk', () => {
@@ -915,6 +921,11 @@ describe('vault isolation (built output)', () => {
     expect(bundleViolations(dir)).toEqual(['assets/passkey-1.js (reachable from assets/prf-1.js) contains vault code (passkey)']);
   });
 
+  it('B1b-2b: the RP ID in popup prose (#6\'s synced-passkey tip) is not passkey code — the popup passes', () => {
+    write('assets/send-1.js', 'export const t=()=>1;export const tip="Other extensions allowed on wallet.noc-tura.io can ask for it too.";');
+    expect(bundleViolations(dir)).toEqual([]);
+  });
+
   it('fails on the wordlist marker alone — generateMnemonic outside the vault page', () => {
     write('assets/send-1.js', `export const words=\`${WORDLIST_MARKER}\`;`);
     expect(bundleViolations(dir)).toEqual(['assets/send-1.js (reachable from assets/popup-1.js) contains vault code (wordlist)']);
@@ -931,7 +942,7 @@ describe('vault isolation (built output)', () => {
 
   // Final review minor 4: readLocal lived in src/ext.ts, so the vault page's bundle carried the
   // whole of ext.ts (storage.session, setAccessLevel) in a shared chunk — every source rule passed.
-  const UNLOCK_MARKERS = `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`;
+  const UNLOCK_MARKERS = `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const n="${WEBAUTHN_MARKER}";const w=\`${WORDLIST_MARKER}\`;`;
   const SESSION = (file, from) => `${file} (reachable from ${from}) touches storage.session — only the background may`;
 
   it('fails when the vault page reaches storage.session — the old layout: ext.ts in a shared chunk', () => {
````

Create `extension/src/app/__tests__/Passkey.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {base64} from '@scure/base';
import {Passkey} from '../screens/Passkey';
import {ENV, renderInWallet} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';

// B1b-2b §4.4 (#6 "manage", D12, D13): off and on, each action a vault-tab page; the popup closes.
const SELECTORS = selectorsOf(UI_SHEETS);
const B = (n: number) => base64.encode(new Uint8Array(n).fill(1));
const WITH_PASSKEY = {...ENV, passkey: {credentialId: B(16), prfSalt: B(32), wrapped: B(40)}};

describe('the passkey screen', () => {
  it('off: #6’s offer — title, lede, three rows, the tip, [Add a passkey] and its caption; nothing of "PIN still wins"', async () => {
    await renderInWallet(<Passkey onBack={() => undefined} />);
    expect(await screen.findByRole('heading', {name: 'Unlock Noctura with a passkey'})).toBeTruthy();
    expect(screen.getByText('Passkey')).toBeTruthy();
    expect(screen.getByText('Adds convenience. Your password always works too — keep it safe.')).toBeTruthy();
    for (const t of ['Faster unlock', 'Password still works', 'Where your passkey lives']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText('Your password always works too.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Add a passkey'})).toBeTruthy();
    expect(screen.getByText('Confirmation opens in a new tab.')).toBeTruthy();
    for (const gone of ['PIN still wins', 'Resets on enrollment change', 'Replace passkey', 'Remove passkey']) expect(screen.queryByText(gone)).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-bio')!, SELECTORS)).toEqual([]);
  });

  it('[Add a passkey] opens passkey&op=add and closes the popup', async () => {
    const w = await renderInWallet(<Passkey onBack={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Add a passkey'}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=passkey&op=add']);
    expect(w.platform.closed).toBe(1);
  });

  it('on: "Passkey is on", O62, the one row, the tip; [Replace passkey] → op=add, [Remove passkey] → op=remove; O63', async () => {
    const w = await renderInWallet(<Passkey onBack={() => undefined} />, {env: WITH_PASSKEY});
    expect(await screen.findByRole('heading', {name: 'Passkey is on'})).toBeTruthy();
    expect(screen.getByText('You can unlock and confirm with it. A wallet has one passkey: a new one replaces this one.')).toBeTruthy();
    expect(screen.getByText('Where your passkey lives')).toBeTruthy();
    expect(screen.queryByText('Faster unlock')).toBeNull();
    expect(screen.getByText('Removing it here does not delete it from your passkey manager.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Replace passkey'}));
    await waitFor(() => expect(w.platform.opened).toEqual(['unlock.html?mode=passkey&op=add']));
    fireEvent.click(screen.getByRole('button', {name: 'Remove passkey'}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=passkey&op=add', 'unlock.html?mode=passkey&op=remove']);
    expect(unstyledClasses(document.querySelector('.s-bio')!, SELECTORS)).toEqual([]);
  });

  it('rule 6: a second [Add a passkey] inside 500 ms opens nothing more', async () => {
    const w = await renderInWallet(<Passkey onBack={() => undefined} />);
    const add = await screen.findByRole('button', {name: 'Add a passkey'});
    fireEvent.click(add);
    (add as HTMLButtonElement).disabled = false;
    fireEvent.click(add);
    expect(w.platform.opened).toHaveLength(1);
  });

  it('Back pops', async () => {
    let backs = 0;
    await renderInWallet(<Passkey onBack={() => void (backs += 1)} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}));
    expect(backs).toBe(1);
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/app/__tests__/Passkey.test.tsx
```
Expected (dry run, these test files on Task 12's tree): **red** — Test Files 2 failed (2) · Tests 4 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/scripts/check-vault-isolation.mjs`:

````diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
index eb90f9d..88d0638 100644
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -303,9 +303,17 @@ export const DERIVATION_MARKER = 'ed25519 seed';
 // A string that exists only in @scure/bip39 (its phrase normalizer, which mnemonicToSeed and
 // validateMnemonic run): core/keys/mnemonic carries neither marker above.
 export const BIP39_MARKER = 'invalid mnemonic type: ';
-// The passkey RP ID, which only src/vault/passkey.ts spells in code. The built manifest names
-// the same host (a host permission), so only JS files count — for presence and for leaks.
-export const PASSKEY_MARKER = 'wallet.noc-tura.io';
+// The WebAuthn PRF evaluation as the build emits it (src/vault/passkey.ts's evaluatePrf and
+// registerPasskey; checked against a real Vite build): no other code asks an authenticator for PRF.
+// B1b-2b: it was the RP ID, 'wallet.noc-tura.io' — but the owner-approved popup copy now names
+// that host in prose (#6's synced-passkey tip on the passkey screen), so the RP ID no longer
+// proves that passkey CODE is in a bundle. Only JS files count — for presence and for leaks.
+export const PASSKEY_MARKER = 'extensions:{prf:{eval:{first:';
+// B1b-2b plan 1 review H1: the PRF marker alone proves less than the RP ID did — a non-PRF WebAuthn
+// call (navigator.credentials.get/create) outside the vault page would pass it. The WebAuthn API
+// itself is the second passkey marker: only src/unlock/browser.ts spells it (checked against a real
+// build: the unlock bundle carries it, no other built file does). Prose cannot match it.
+export const WEBAUTHN_MARKER = 'navigator.credentials';
 // An error message of @noble/hashes' Argon2 parameter check: the KDF, found in the vault
 // worker only (checked against the real build: no other built file carries it).
 export const KDF_MARKER = '(memory) must be at least 8*p bytes';
@@ -323,6 +331,7 @@ const MARKERS = [
   ['derivation', DERIVATION_MARKER],
   ['bip39', BIP39_MARKER],
   ['passkey', PASSKEY_MARKER],
+  ['webauthn', WEBAUTHN_MARKER],
   ['kdf', KDF_MARKER],
   ['wordlist', WORDLIST_MARKER],
 ];
````

Modify `extension/src/app/App.tsx`:

````diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index f876464..28af938 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -15,6 +15,7 @@ import {Activity} from './screens/Activity';
 import {TxDetail} from './screens/TxDetail';
 import {Settings} from './screens/Settings';
 import {About} from './screens/About';
+import {Passkey} from './screens/Passkey';
 import {Created} from './screens/Created';
 import {Imported} from './screens/Imported';
 import {Send} from './screens/Send';
@@ -260,6 +261,8 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
         }}
       />
     );
+  } else if (route.screen === 'passkey') {
+    screen = <Passkey onBack={() => go({type: 'pop'})} />;
   } else {
     screen = <About onBack={() => go({type: 'pop'})} />;
   }
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index b3e08f8..256aa00 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -809,3 +809,35 @@ a.btn {
   display: inline-block;
   margin-inline-end: 0.6ch;
 }
+
+/* B1b-2b §4.4: the passkey screen — #6's chrome in the popup (index.html #s06's inline spacing, as classes). */
+.app-grow {
+  flex: 1 1 auto;
+}
+.app-content .s-bio .hero-icon {
+  margin: var(--space-5) auto var(--space-5);
+}
+.app-bio-head {
+  padding: 0 var(--space-6);
+  text-align: center;
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-2);
+}
+.app-bio-head h1,
+.app-bio-head p {
+  margin: 0;
+}
+.app-bio-features {
+  margin-top: var(--space-5);
+  padding: 0 var(--space-2);
+}
+.app-bio-features .noc-body-sm {
+  margin-top: 2px;
+}
+.app-bio-tip {
+  margin: var(--space-4) var(--space-5) 0;
+}
+.sticky-bar .app-center {
+  margin: 0;
+}
````

Create `extension/src/app/screens/Passkey.tsx`:

````tsx
import {useWallet} from '../WalletContext';
import type {ExtensionPage} from '../platform';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';

/** The passkey screen's copy (B1b-2b §4.4): 2a's #6 strings, D13's and the owner-confirmed O62/O63. */
export const PASSKEY_TEXT = {
  title: 'Passkey',
  offTitle: 'Unlock Noctura with a passkey',
  offLede: 'Adds convenience. Your password always works too — keep it safe.',
  fasterTitle: 'Faster unlock',
  fasterBody: 'Use your fingerprint, face or security key instead of typing your password.',
  stillTitle: 'Password still works',
  stillBody: 'If the passkey is unavailable, your password unlocks the wallet and confirms everything.',
  livesTitle: 'Where your passkey lives',
  livesBody: "A passkey synced to Google, Apple or a password manager keeps its secret in that provider's cloud. Other extensions allowed on wallet.noc-tura.io can ask for it too.",
  tip: 'Your password always works too.',
  add: 'Add a passkey',
  onTitle: 'Passkey is on',
  onLede: 'You can unlock and confirm with it. A wallet has one passkey: a new one replaces this one.',
  replace: 'Replace passkey',
  remove: 'Remove passkey',
  removeNote: 'Removing it here does not delete it from your passkey manager.',
  opensTab: 'Confirmation opens in a new tab.',
} as const;

/**
 * The passkey screen — #6's "manage" variant (spec B1b-2b §4.4, D12, D13): referenced by the design (ix:13616, 14659,
 * 14663), never drawn, so derived from #6's chrome. `off`: #6's offer, [Add a passkey]. `on`: "Passkey is on", the one-slot
 * rule, [Replace passkey] and [Remove passkey]. Every action is a proof, so each opens the vault tab (`passkey&op=…`) and
 * the popup closes; the screen itself reads only `wallet.state.passkey` (E12). Rule 6: LockedButton.
 */
export function Passkey({onBack}: {onBack: () => void}) {
  const m = useWallet();
  const on = m.wallet?.passkey === true;
  const open = (page: ExtensionPage) => {
    m.platform.openPage(page);
    if (m.surface === 'popup') m.platform.closeWindow();
  };
  const feature = (icon: 'check' | 'shield-lock' | 'info', title: string, body: string) => (
    <div className="feature-row">
      <div className="icon">
        <ExtIcon name={icon} size={18} />
      </div>
      <div>
        <div className="noc-body-lg">{title}</div>
        <div className="noc-body-sm app-muted">{body}</div>
      </div>
    </div>
  );
  return (
    <div className="screen s-bio">
      <TopBar title={PASSKEY_TEXT.title} onBack={onBack} />
      <div className="hero-icon">
        <ExtIcon name="key" size={56} />
      </div>
      <div className="app-bio-head">
        <h1 className="noc-h1">{on ? PASSKEY_TEXT.onTitle : PASSKEY_TEXT.offTitle}</h1>
        <p className="noc-body app-muted">{on ? PASSKEY_TEXT.onLede : PASSKEY_TEXT.offLede}</p>
      </div>
      <div className="app-bio-features">
        {on ? null : feature('check', PASSKEY_TEXT.fasterTitle, PASSKEY_TEXT.fasterBody)}
        {on ? null : feature('shield-lock', PASSKEY_TEXT.stillTitle, PASSKEY_TEXT.stillBody)}
        {feature('info', PASSKEY_TEXT.livesTitle, PASSKEY_TEXT.livesBody)}
      </div>
      <div className="s7-tip app-bio-tip">
        <ExtIcon name="info" size={18} />
        <p>{PASSKEY_TEXT.tip}</p>
      </div>
      <div className="app-grow" />
      <div className="sticky-bar">
        {on ? (
          <>
            <LockedButton onPress={() => open('unlock.html?mode=passkey&op=add')}>{PASSKEY_TEXT.replace}</LockedButton>
            <LockedButton className="btn btn-secondary" onPress={() => open('unlock.html?mode=passkey&op=remove')}>
              {PASSKEY_TEXT.remove}
            </LockedButton>
            <p className="noc-caption app-muted app-center">{PASSKEY_TEXT.removeNote}</p>
          </>
        ) : (
          <LockedButton onPress={() => open('unlock.html?mode=passkey&op=add')}>{PASSKEY_TEXT.add}</LockedButton>
        )}
        <p className="noc-caption app-muted app-center">{PASSKEY_TEXT.opensTab}</p>
      </div>
    </div>
  );
}
````

Modify `extension/src/app/ui/ExtIcon.tsx`:

````diff
diff --git a/extension/src/app/ui/ExtIcon.tsx b/extension/src/app/ui/ExtIcon.tsx
index 37240c0..ef13b17 100644
--- a/extension/src/app/ui/ExtIcon.tsx
+++ b/extension/src/app/ui/ExtIcon.tsx
@@ -37,9 +37,77 @@ export type ExtIconName =
   | 'clip'
   | 'alert'
   | 'cpu'
-  | 'check-circle';
+  | 'check-circle'
+  // B1b-2b plan 1: #31, #35, the accounts manager, the passkey screen, #37.
+  | 'user'
+  | 'key'
+  | 'fingerprint'
+  | 'shield-check'
+  | 'database'
+  | 'trash'
+  | 'zap'
+  | 'arrow-up'
+  | 'arrow-down';
 
 const PATHS: Record<ExtIconName, ReactNode> = {
+  // B1b-2b plan 1, from the design's sprite (#i-user, #i-key, #i-fingerprint, #i-shield-check, #i-database, #i-trash,
+  // #i-zap, #i-arrow-down); `arrow-up` is #i-arrow-down turned, drawn in the same style (the sprite lacks it).
+  user: (
+    <>
+      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
+      <circle cx="12" cy="7" r="4" />
+    </>
+  ),
+  key: (
+    <>
+      <circle cx="7.5" cy="15.5" r="3.5" />
+      <path d="m10 13 9-9 3 3-3 3 2 2-3 3-2-2-3 3" />
+    </>
+  ),
+  fingerprint: (
+    <>
+      <path d="M12 11c0 5-1.5 8-3 10" />
+      <path d="M16 13.5c-.5 4-2 6-3 7.5" />
+      <path d="M8 11c0-2 2-4 4-4s4 2 4 4c0 2-1 4-2 6" />
+      <path d="M5 11c0-4 3-7 7-7s7 3 7 7" />
+      <path d="M3 14c0-1.5.5-3 1-4" />
+      <path d="M21 14c-.5 0-1 1-2 3" />
+    </>
+  ),
+  'shield-check': (
+    <>
+      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
+      <polyline points="9 12 11 14 15 10" />
+    </>
+  ),
+  database: (
+    <>
+      <ellipse cx="12" cy="5" rx="9" ry="3" />
+      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
+      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
+    </>
+  ),
+  trash: (
+    <>
+      <polyline points="3 6 5 6 21 6" />
+      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
+      <line x1="10" y1="11" x2="10" y2="17" />
+      <line x1="14" y1="11" x2="14" y2="17" />
+    </>
+  ),
+  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
+  'arrow-down': (
+    <>
+      <line x1="12" y1="5" x2="12" y2="19" />
+      <polyline points="19 12 12 19 5 12" />
+    </>
+  ),
+  'arrow-up': (
+    <>
+      <line x1="12" y1="19" x2="12" y2="5" />
+      <polyline points="5 12 12 5 19 12" />
+    </>
+  ),
   // Plan 3: #12's paste button (#i-clip) and its helper lines' glyph (#i-alert).
   clip: (
     <>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/app/__tests__/Passkey.test.tsx
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 2 passed (2) · Tests 379 passed (379); tsc clean; whole suite Test Files 130 passed (130) · Tests 2281 passed (2281); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  passkey off and on at 412 × 600 — Task 20; against #6's 'bio' layout (the ring glyph, the benefit rows, the tip).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M13a** — the passkey screen ignores the stored passkey — `extension/src/app/screens/Passkey.tsx`:

  ```diff
  - <h1 className="noc-h1">{on ? PASSKEY_TEXT.onTitle : PASSKEY_TEXT.offTitle}</h1>
  + <h1 className="noc-h1">{PASSKEY_TEXT.offTitle}</h1>
  ```
  `timeout 300 npx vitest run src/app/__tests__/Passkey.test.tsx` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M13b** — the passkey marker is the RP ID again (popup prose trips the gate) — `extension/scripts/check-vault-isolation.mjs`:

  ```diff
  - export const PASSKEY_MARKER = 'extensions:{prf:{eval:{first:';
  + export const PASSKEY_MARKER = 'wallet.noc-tura.io';
  ```
  `timeout 300 npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` — Expected: **red** (dry run: 2 failed (Playwright)).

- **M13c** — H1: the webauthn marker removed (a non-PRF WebAuthn call in the popup passes) — `extension/scripts/check-vault-isolation.mjs`:

  ```diff
  -   ['webauthn', WEBAUTHN_MARKER],
  + (deleted)
  ```
  `timeout 300 npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` — Expected: **red** (dry run: 3 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/check-vault-isolation.mjs extension/src/app/App.tsx extension/src/app/__tests__/Passkey.test.tsx extension/src/app/app.css extension/src/app/screens/Passkey.tsx extension/src/app/ui/ExtIcon.tsx
git commit -F - <<'MSG'
feat(extension): The passkey screen (popup, off / on) and the icons the new screens use

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 14: The accounts manager (Profile): order, rename, remove sheet; `useAccountBalances` shared with the Switcher

**Spec:** §4.3, E14, D16, D17, C14; O52–O61

**Files:**
- Modify: `extension/src/app/App.tsx`
- Create: `extension/src/app/__tests__/AccountsManager.test.tsx`
- Modify: `extension/src/app/__tests__/LockedButton.test.tsx`
- Modify: `extension/src/app/app.css`
- Create: `extension/src/app/screens/AccountsManager.tsx`
- Modify: `extension/src/app/screens/Switcher.tsx`
- Modify: `extension/src/app/ui/LockedButton.tsx`
- Create: `extension/src/app/useAccountBalances.ts`

**Interfaces:**
- Consumes: Task 7's `engine.order`, `removeAccountPage`; the Switcher's rename errors; `valuation`. (Review L5: `useAccountBalances` returns a `Record<address, RowBalance>` here; **Task 15 widens its return type** to `{rows, done, failed}` and patches both callers.)
- Produces (exact signatures, as exported):
  - `export const ACCOUNTS_TEXT =`
  - `export function holdsLine(row: RowBalance | undefined, prices: Parameters<typeof valuation>[1]): string`
  - `export function AccountsManager({onBack}: {onBack: () => void})`
  - `export {FRESH_ROWS} from '../useAccountBalances';`
  - `export const RENAME_FAILED = 'Something went wrong.';`
  - `export const RENAME_ERRORS: Record<string, string> =`
  - `export const FRESH_ROWS = 10;`
  - `export type RowBalance = {b: Balances; at: number; fresh: boolean};`
  - `export function useAccountBalances(accounts: readonly Account[]): Record<string, RowBalance>`

Rows in display order with name, short address and balance; `[↑]`/`[↓]` (aria "Move <name> up/down") write `accounts.order` (`stale` → "The accounts changed. Try again." and a re-read); rename (2a's errors); the trash (aria "Remove <name>") opens a sheet: "Remove <name>?", the address in groups of four, "Holds <balance>" (D16), and `[Continue to remove]` → `removeAccountPage(index)`. The last account cannot be removed. Balances come from `useAccountBalances` (extracted from the Switcher, keyed on the addresses so a list that arrives after mount still loads). `LockedButton` gains `keepFocus` (a moved row keeps focus) and `pressed` (aria-pressed).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/AccountsManager.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {AccountsManager} from '../screens/AccountsManager';
import {ENV, renderInWallet, walletReader} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {VAULT_KEY} from '../../background/accountsStore';
import {PENDING_KEY} from '../../background/pendingStore';
import {SETTINGS_KEY} from '../../background/settings';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {fakeReader} from '../../background/__tests__/fakeDeps';

// B1b-2b §4.3 (D16, D17, C6, C14): the accounts manager against the real background.
const SELECTORS = selectorsOf(UI_SHEETS);
const THIRD = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const ENV3 = {...ENV, accounts: [...ENV.accounts, {index: 2, name: 'Third', publicKey: THIRD}]};
/** An open send from Savings, in the shape wallet.pending reports (a real signature, a real recipient). */
const OPEN_FROM_SAVINGS = pendingRecord({account: RECIPIENT, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: ACCOUNT.publicKey, amount: '1'}});
const names = () => [...document.querySelectorAll('.app-account-row .pri')].map(e => e.textContent);
const shown = (o: Parameters<typeof renderInWallet>[1] = {}) => renderInWallet(<AccountsManager onBack={() => undefined} />, {env: ENV3, ...o});

describe('the accounts manager', () => {
  it('list: rows in the display order (E14), each with rename, ↑, ↓ and remove; the ends disabled; Add account', async () => {
    await shown({before: async ext => ext.local.set(SETTINGS_KEY, {accountOrder: [2, 0, 1]})});
    await waitFor(() => expect(names()).toEqual(['Third', 'Main', 'Savings']));
    expect(screen.getByText('Accounts', {selector: '.top-bar .title'})).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Move Third up'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Move Savings down'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Move Main up'}) as HTMLButtonElement).disabled).toBe(false);
    for (const n of ['Third', 'Main', 'Savings']) {
      expect(screen.getByRole('button', {name: `Rename ${n}`})).toBeTruthy();
      expect(screen.getByRole('button', {name: `Remove ${n}`})).toBeTruthy();
    }
    expect(screen.getByRole('button', {name: /Add account/})).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('↓ writes accounts.order: the list follows and focus stays on the moved row’s same button', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
    const down = screen.getByRole('button', {name: 'Move Main down'});
    down.focus();
    fireEvent.click(down);
    await waitFor(() => expect(names()).toEqual(['Savings', 'Main', 'Third']));
    expect(await w.ext.local.get(SETTINGS_KEY)).toMatchObject({accountOrder: [1, 0, 2]});
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Main down'));
  });

  it('stale: the account set changed under the manager — O55, the list re-read; nothing written', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
    await w.ext.local.set(VAULT_KEY, ENV);
    fireEvent.click(screen.getByRole('button', {name: 'Move Main down'}));
    expect(await screen.findByText('The accounts changed. Try again.')).toBeTruthy();
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings']));
    expect(await w.ext.local.get(SETTINGS_KEY)).toBeUndefined();
  });

  it('remove: the sheet — O57, the address in groups of four, what it holds, the D16 line, [Continue to remove] → the remove page', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
    const sheet = await screen.findByRole('dialog', {name: 'Remove Savings?'});
    expect([...sheet.querySelectorAll('.addr-groups span')].map(s => s.textContent).join('')).toBe(RECIPIENT);
    // walletReader: 62.4821 SOL, 4 200 NOC, 740.21 USDC; SOL $150, USDC $1 → $10,112.52 (NOC at stage price is not in the total).

    await waitFor(() => expect(within(sheet).getByText('Holds 62.4821 SOL · 4,200.00 NOC · 740.21 USDC · $10,112.52')).toBeTruthy());
    expect(within(sheet).getByText('Its funds stay on Solana; add it again to use them.')).toBeTruthy();
    expect(within(sheet).getByText('Confirmation opens in a new tab.')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', {name: 'Continue to remove'}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=accounts&op=remove&index=1']);
    expect(w.platform.closed).toBe(1);
  });

  it('remove: "Holds no funds" for an empty account; "Balance not checked" when nothing could be read', async () => {
    const empty = await shown({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []})});
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Main'}));
    expect(await screen.findByText('Holds no funds')).toBeTruthy();
    void empty;
  });

  it('remove: "Balance not checked" when no read answered', async () => {
    await shown({reader: walletReader({getBalance: async () => new Promise<bigint>(() => undefined)})});
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Third'}));
    expect(await screen.findByText('Balance not checked')).toBeTruthy();
  });

  it('remove · send open: [Continue to remove] disabled and the adapted pending line', async () => {
    await shown({before: async ext => ext.local.set(PENDING_KEY, [OPEN_FROM_SAVINGS])});
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
    const sheet = await screen.findByRole('dialog', {name: 'Remove Savings?'});
    await waitFor(() => expect(within(sheet).getByText('A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.')).toBeTruthy());
    expect((within(sheet).getByRole('button', {name: 'Continue to remove'}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the last account: its trash button disabled, and "The last account cannot be removed."', async () => {
    await renderInWallet(<AccountsManager onBack={() => undefined} />, {env: {...ENV, accounts: [ENV.accounts[0]]}, accounts: [ACCOUNT]});
    await waitFor(() => expect(names()).toEqual(['Main']));
    expect((screen.getByRole('button', {name: 'Remove Main'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('The last account cannot be removed.')).toBeTruthy();
  });

  it('rename inline (2a’s rule and errors); select from a row', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Rename Third'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Account name'}), {target: {value: 'Rainy day'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(names()).toContain('Rainy day'));
    fireEvent.click(screen.getByText('Savings'));
    await waitFor(async () => expect(await w.ext.local.get(SETTINGS_KEY)).toMatchObject({selectedAccount: 1}));
  });

  it('rule 6: a second ↓ inside 500 ms (`disabled` lifted) writes no second order', async () => {
    let orders = 0;
    await shown({gate: m => void ((m as {type: string}).type === 'accounts.order' && (orders += 1))});
    await waitFor(() => expect(names()).toHaveLength(3));
    const down = screen.getByRole('button', {name: 'Move Main down'}) as HTMLButtonElement;
    fireEvent.click(down);
    down.disabled = false;
    fireEvent.click(down);
    await act(async () => new Promise(r => setTimeout(r, 30)));
    expect(orders).toBe(1);
  });

  it('[Add account] opens accounts&op=add and closes; a cli wallet cannot add', async () => {
    const w = await shown();
    fireEvent.click(await screen.findByRole('button', {name: /Add account/}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=accounts&op=add']);
  });
});
````

Modify `extension/src/app/__tests__/LockedButton.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/LockedButton.test.tsx b/extension/src/app/__tests__/LockedButton.test.tsx
index c122269..8c8342b 100644
--- a/extension/src/app/__tests__/LockedButton.test.tsx
+++ b/extension/src/app/__tests__/LockedButton.test.tsx
@@ -50,6 +50,43 @@ describe('LockedButton', () => {
     await floor();
   });
 
+  // B1b-2b §4.3: the manager's ↑/↓ — a keyboard user pressing it keeps the focus on it once it is enabled again.
+  async function pressed(keepFocus: boolean, after: 'lost' | 'moved') {
+    let release: () => void = () => undefined;
+    const {unmount} = render(
+      <>
+        <LockedButton onPress={async () => undefined} keepFocus={keepFocus} wait={() => new Promise<void>(r => (release = r))}>
+          Move
+        </LockedButton>
+        <button type="button">Elsewhere</button>
+      </>,
+    );
+    const button = screen.getByRole('button', {name: 'Move'}) as HTMLButtonElement;
+    button.focus();
+    fireEvent.click(button);
+    if (after === 'moved') (screen.getByRole('button', {name: 'Elsewhere'}) as HTMLButtonElement).focus();
+    else {
+      // What a browser does to a focused button the lock disables (or a row the list moves): the page has the focus.
+      const blip = document.createElement('input');
+      document.body.append(blip);
+      blip.focus();
+      blip.remove();
+    }
+    await act(async () => release());
+    const at = document.activeElement === button ? 'button' : document.activeElement === document.body ? 'page' : 'elsewhere';
+    unmount();
+    return at;
+  }
+
+  it('keepFocus: a button focused when pressed takes the focus back from the page when the lock ends', async () => {
+    expect(await pressed(true, 'lost')).toBe('button');
+    expect(await pressed(false, 'lost')).toBe('page');
+  });
+
+  it('keepFocus never takes the focus from where the user moved it meanwhile', async () => {
+    expect(await pressed(true, 'moved')).toBe('elsewhere');
+  });
+
   it('holds for LOCK_MS = 500 by default', () => {
     expect(LOCK_MS).toBe(500);
   });
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/AccountsManager.test.tsx src/app/__tests__/LockedButton.test.tsx
```
Expected (dry run, these test files on Task 13's tree): **red** — Test Files 2 failed (2) · Tests 1 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/App.tsx`:

````diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index 28af938..793e0db 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -16,6 +16,7 @@ import {TxDetail} from './screens/TxDetail';
 import {Settings} from './screens/Settings';
 import {About} from './screens/About';
 import {Passkey} from './screens/Passkey';
+import {AccountsManager} from './screens/AccountsManager';
 import {Created} from './screens/Created';
 import {Imported} from './screens/Imported';
 import {Send} from './screens/Send';
@@ -261,6 +262,8 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
         }}
       />
     );
+  } else if (route.screen === 'accounts') {
+    screen = <AccountsManager onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'passkey') {
     screen = <Passkey onBack={() => go({type: 'pop'})} />;
   } else {
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 256aa00..97f7a32 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -841,3 +841,43 @@ a.btn {
 .sticky-bar .app-center {
   margin: 0;
 }
+
+/* B1b-2b §4.3: the accounts manager — the switcher's rows (2a §5.2) on a pushed screen, with their tools. */
+.app-manager-body {
+  padding: 0 var(--space-4) var(--space-6);
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-3);
+}
+.app-manager-list {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-1);
+}
+.app-row-tools {
+  display: inline-flex;
+  align-items: center;
+}
+.app-row-tools .icon-btn {
+  width: var(--touch-target-min);
+  height: var(--touch-target-min);
+  display: inline-flex;
+  align-items: center;
+  justify-content: center;
+  border-radius: var(--radius-pill);
+  color: var(--fg-secondary);
+  background: transparent;
+  border: 0;
+  cursor: pointer;
+}
+.app-row-tools .icon-btn span {
+  display: inline-flex;
+}
+.app-remove-sheet {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-3);
+}
+.app-remove-sheet p {
+  margin: 0;
+}
````

Create `extension/src/app/screens/AccountsManager.tsx`:

````tsx
import {useState} from 'react';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {useWallet} from '../WalletContext';
import {FRESH_ROWS, useAccountBalances, type RowBalance} from '../useAccountBalances';
import {valuation} from '../valuation';
import {ago, showAmount, showUsd, twoGroups} from '../format';
import {useNow} from '../useNow';
import {removeAccountPage} from '../platform';
import {TopBar} from '../ui/TopBar';
import {Sheet} from '../ui/Sheet';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {RENAME_ERRORS, RENAME_FAILED} from './Switcher';
import type {Account, Token} from '../engine';

/** The accounts manager's copy (B1b-2b §4.3): 2a's strings and the owner-confirmed O52–O61. */
export const ACCOUNTS_TEXT = {
  title: 'Accounts',
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  remove: (name: string) => `Remove ${name}`,
  rename: (name: string) => `Rename ${name}`,
  stale: 'The accounts changed. Try again.',
  orderFailed: 'Could not save the order. Try again.',
  removeTitle: (name: string) => `Remove ${name}?`,
  holds: (parts: string[]) => `Holds ${parts.join(' · ')}`,
  holdsNothing: 'Holds no funds',
  notChecked: 'Balance not checked',
  fundsStay: 'Its funds stay on Solana; add it again to use them.',
  continueRemove: 'Continue to remove',
  opensTab: 'Confirmation opens in a new tab.',
  cancel: 'Cancel',
  lastAccount: 'The last account cannot be removed.',
  sendOpen: 'A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.',
  add: 'Add account',
  cli: 'A Solana CLI wallet has exactly one account.',
  selectFailed: 'Could not switch accounts. Try again.',
  notCheckedYet: 'not checked yet',
  save: 'Save',
  accountName: 'Account name',
} as const;

const TOKENS: readonly Token[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const BALANCE_KEY: Record<Token, 'sol' | 'noc' | 'usdc' | 'usdt'> = {SOL: 'sol', NOC: 'noc', USDC: 'usdc', USDT: 'usdt'};

/** O58 / O59 / O60: what the removed account holds, from the rows' last read — never a guard (D16). */
export function holdsLine(row: RowBalance | undefined, prices: Parameters<typeof valuation>[1]): string {
  if (row === undefined) return ACCOUNTS_TEXT.notChecked;
  const parts = TOKENS.filter(t => row.b[BALANCE_KEY[t]] > 0n).map(t => `${showAmount(t, row.b[BALANCE_KEY[t]])} ${t}`);
  if (parts.length === 0) return ACCOUNTS_TEXT.holdsNothing;
  const total = valuation(row.b, prices).total;
  return ACCOUNTS_TEXT.holds(total === null ? parts : [...parts, showUsd(total)]);
}

/**
 * The accounts manager (spec B1b-2b §4.3; D16, D17, C6, C14, C16) — no design exists (context §1.7); derived from the
 * 2a switcher (2a-D14) and #43's sheet. Rows in the display order (E14): select, inline rename, ↑ / ↓ (buttons, not drag:
 * keyboard-first — Tab to the button, Enter or Space) and remove. A move writes accounts.order (no proof: the order never
 * touches the envelope); `stale` re-reads the list. Remove opens a sheet that says what the account holds and that its
 * funds stay on Solana, then the vault tab's proof (`removeAccountPage(index)`, C14: the page shows "Account N", never the
 * name). The background refuses a remove while a send from it is open (C5); the sheet says so first. Rule 6: every write
 * and every page it opens through LockedButton.
 */
export function AccountsManager({onBack}: {onBack: () => void}) {
  const m = useWallet();
  const now = useNow(1_000, m.now);
  const accounts = m.wallet?.accounts ?? [];
  const rows = useAccountBalances(accounts);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Account | null>(null);
  const cli = m.wallet?.scheme === 'cli';
  const last = accounts.length <= 1;

  const open = (page: Parameters<typeof m.platform.openPage>[0]) => {
    m.platform.openPage(page);
    if (m.surface === 'popup') m.platform.closeWindow();
  };
  const select = async (a: Account) => {
    const r = await m.engine.select(a.index);
    if (!r.ok) return setLine(ACCOUNTS_TEXT.selectFailed);
    setLine(null);
    await m.reload();
  };
  const save = async (a: Account) => {
    const r = await m.engine.rename(a.index, name);
    if (r.ok) {
      setEditing(null);
      setRenameError(null);
      await m.reload();
    } else setRenameError(RENAME_ERRORS[r.error] ?? RENAME_FAILED);
  };
  /** Moves the account at `at` one place; the pressed button keeps the focus (LockedButton keepFocus: keyboard reorder). */
  const move = async (at: number, by: -1 | 1) => {
    const order = accounts.map(a => a.index);
    const to = at + by;
    const a = order[at];
    const b = order[to];
    if (a === undefined || b === undefined) return;
    order.splice(to, 1, a);
    order.splice(at, 1, b);
    const r = await m.engine.order(order);
    await m.reload();
    if (!r.ok) return setLine(r.error === 'stale' ? ACCOUNTS_TEXT.stale : ACCOUNTS_TEXT.orderFailed);
    setLine(null);
  };
  const sendOpen = (a: Account) => m.pending.some(p => p.account === a.publicKey && (p.state === 'pending' || p.state === 'stuck'));

  return (
    <div className="screen">
      <TopBar title={ACCOUNTS_TEXT.title} onBack={onBack} />
      <div className="app-manager-body">
        <div className="app-manager-list">
          {accounts.map((a, i) => {
            const row = rows[a.publicKey];
            const selected = a.index === m.wallet?.selected;
            const total = row === undefined ? null : valuation(row.b, m.prices).total;
            return (
              <div key={a.index} className={`app-account-row${selected ? ' sel' : ''}`} data-account={a.index}>
                {editing === a.index ? (
                  <div className="app-rename">
                    <input className="app-input" aria-label={ACCOUNTS_TEXT.accountName} maxLength={32} value={name} onChange={e => setName(e.target.value)} />
                    <LockedButton className="btn btn-primary app-btn-sm" onPress={() => save(a)}>
                      {ACCOUNTS_TEXT.save}
                    </LockedButton>
                    <button
                      type="button"
                      className="btn btn-secondary app-btn-sm"
                      onClick={() => {
                        setEditing(null);
                        setRenameError(null);
                      }}
                    >
                      {ACCOUNTS_TEXT.cancel}
                    </button>
                    {renameError === null ? null : (
                      <p className="field-msg noc-danger" role="alert">
                        {renameError}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <button type="button" className="app-account-pick" aria-pressed={selected} onClick={() => void select(a)}>
                      <span className="avatar">{a.name.slice(0, 1).toUpperCase()}</span>
                      <span>
                        <span className="pri noc-body-lg">{a.name}</span>
                        <span className="sec noc-mono">{twoGroups(a.publicKey)}</span>
                        <span className="sec noc-numeral">
                          {row === undefined ? (i >= FRESH_ROWS ? ACCOUNTS_TEXT.notCheckedYet : '') : `${showAmount('SOL', row.b.sol)} SOL${total === null ? '' : ` · ${showUsd(total)}`}`}
                        </span>
                        {row !== undefined && !row.fresh ? <span className="sec noc-caption">cached {ago(row.at, now)}</span> : null}
                      </span>
                      {selected ? <ExtIcon name="check" size={18} label="Selected" /> : null}
                    </button>
                    <span className="app-row-tools">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={ACCOUNTS_TEXT.rename(a.name)}
                        onClick={() => {
                          setEditing(a.index);
                          setName(a.name);
                          setRenameError(null);
                        }}
                      >
                        <ExtIcon name="pencil" size={16} />
                      </button>
                      <LockedButton className="icon-btn" keepFocus label={ACCOUNTS_TEXT.moveUp(a.name)} disabled={i === 0} onPress={() => move(i, -1)}>
                        <ExtIcon name="arrow-up" size={16} />
                      </LockedButton>
                      <LockedButton className="icon-btn" keepFocus label={ACCOUNTS_TEXT.moveDown(a.name)} disabled={i === accounts.length - 1} onPress={() => move(i, 1)}>
                        <ExtIcon name="arrow-down" size={16} />
                      </LockedButton>
                      <button type="button" className="icon-btn" aria-label={ACCOUNTS_TEXT.remove(a.name)} disabled={last} onClick={() => setRemoving(a)}>
                        <ExtIcon name="trash" size={16} />
                      </button>
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {last ? <p className="noc-caption app-muted">{ACCOUNTS_TEXT.lastAccount}</p> : null}
        {line === null ? null : (
          <p className="field-msg noc-danger" role="alert">
            {line}
          </p>
        )}
        <LockedButton className="btn btn-secondary" disabled={cli} onPress={() => open('unlock.html?mode=accounts&op=add')}>
          <ExtIcon name="plus" size={18} />
          {ACCOUNTS_TEXT.add}
        </LockedButton>
        {cli ? <p className="noc-caption app-muted">{ACCOUNTS_TEXT.cli}</p> : null}
      </div>
      {removing === null ? null : (
        <Sheet title={ACCOUNTS_TEXT.removeTitle(removing.name)} onClose={() => setRemoving(null)}>
          <div className="app-remove-sheet">
            <AddressGroups address={removing.publicKey} />
            <p className="noc-body-sm noc-numeral">{holdsLine(rows[removing.publicKey], m.prices)}</p>
            <p className="noc-body-sm app-muted">{ACCOUNTS_TEXT.fundsStay}</p>
            {sendOpen(removing) ? (
              <p className="field-msg noc-warning" role="status">
                {ACCOUNTS_TEXT.sendOpen}
              </p>
            ) : null}
            <LockedButton
              className="btn btn-destructive"
              disabled={sendOpen(removing)}
              onPress={() => {
                const page = removeAccountPage(removing.index);
                if (page !== null) open(page);
              }}
            >
              {ACCOUNTS_TEXT.continueRemove}
            </LockedButton>
            <p className="noc-caption app-muted app-center-text">{ACCOUNTS_TEXT.opensTab}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setRemoving(null)}>
              {ACCOUNTS_TEXT.cancel}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
````

Modify `extension/src/app/screens/Switcher.tsx`:

````diff
diff --git a/extension/src/app/screens/Switcher.tsx b/extension/src/app/screens/Switcher.tsx
index db133c9..2376fb3 100644
--- a/extension/src/app/screens/Switcher.tsx
+++ b/extension/src/app/screens/Switcher.tsx
@@ -1,20 +1,19 @@
-import {useEffect, useRef, useState} from 'react';
+import {useState} from 'react';
 import {useWallet} from '../WalletContext';
+import {FRESH_ROWS, useAccountBalances} from '../useAccountBalances';
 import {valuation} from '../valuation';
 import {ago, showAmount, showUsd, twoGroups} from '../format';
 import {useNow} from '../useNow';
 import {Sheet} from '../ui/Sheet';
 import {ExtIcon} from '../ui/ExtIcon';
 import {LockedButton} from '../ui/LockedButton';
-import type {Account, Balances} from '../engine';
+import type {Account} from '../engine';
 
-/** Fresh balances for the first ten rows, one account at a time (2 requests each, inside the proxy's budget). */
-export const FRESH_ROWS = 10;
+export {FRESH_ROWS} from '../useAccountBalances';
 
-type RowBalance = {b: Balances; at: number; fresh: boolean};
-
-const RENAME_FAILED = 'Something went wrong.';
-const RENAME_ERRORS: Record<string, string> = {
+/** The rename refusals (2a §5.2), shared with the B1b-2b accounts manager's inline rename. */
+export const RENAME_FAILED = 'Something went wrong.';
+export const RENAME_ERRORS: Record<string, string> = {
   malformed: 'Names are 1 to 32 characters, without control characters.',
   busy: 'The wallet is busy. Try again.',
   'unknown-account': 'That account no longer exists.',
@@ -28,62 +27,18 @@ const NETWORK_ERRORS = new Set<string>(['coordinator-refused', 'unreachable']);
 
 /**
  * The account switcher (spec §5.2, D14): derived from #43's sheet — accounts with balances, select,
- * rename, "Add account". Remove and reorder are B1b-2b's accounts manager.
+ * rename, "Add account". Remove and reorder are the B1b-2b accounts manager's; the rows come in the display
+ * order (E14) like every account list.
  */
 export function Switcher({onClose}: {onClose: () => void}) {
   const m = useWallet();
   const now = useNow(1_000, m.now);
   const accounts = m.wallet?.accounts ?? [];
-  const [rows, setRows] = useState<Record<string, RowBalance>>({});
+  const rows = useAccountBalances(accounts);
   const [editing, setEditing] = useState<number | null>(null);
   const [name, setName] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [selectError, setSelectError] = useState<string | null>(null);
-  // The live net mode (WalletContext's own netRef pattern): a ref, kept current every render, so the
-  // async pass below reads what net.mode IS when it checks, not what it was when the effect started.
-  const netRef = useRef(m.net);
-  netRef.current = m.net;
-
-  useEffect(() => {
-    let alive = true;
-    // No fresh pass during the 403 cool-down, nor while offline or unreachable (review M5): the cached
-    // rows are what there is, and ten reads that cannot answer would only wait. Read live (netRef), not
-    // a value captured once: the sequential cached loop below can run long enough for net.mode to flip
-    // mid-pass, and a snapshot taken at mount would miss that (review follow-up).
-    const away = (): boolean => {
-      const mode = netRef.current.mode;
-      return mode === 'refused' || mode === 'offline' || mode === 'unreachable';
-    };
-    void (async () => {
-      for (const a of accounts) {
-        const c = await m.engine.cached(a.publicKey);
-        if (!alive) return;
-        if (c.ok && c.data.balances !== null) {
-          const {at, ...b} = c.data.balances;
-          setRows(r => ({...r, [a.publicKey]: {b, at, fresh: false}}));
-        }
-      }
-      if (away()) return;
-      for (const a of accounts.slice(0, FRESH_ROWS)) {
-        if (away()) return;
-        const f = await m.engine.balances(a.publicKey);
-        if (!alive) return;
-        if (f.ok) {
-          setRows(r => ({...r, [a.publicKey]: {b: f.data, at: m.now(), fresh: true}}));
-          continue;
-        }
-        // A 403 or no answer is the whole app's state (M4), and ends the pass: the next read would fare no better.
-        m.report(f.error);
-        if (f.error === 'coordinator-refused' || f.error === 'unreachable') return;
-      }
-    })();
-    return () => {
-      alive = false;
-    };
-    // Mount-only, deliberately: the account list is read once per opening (a rename changes names, not
-    // balances), and the live net mode is read through netRef above rather than restarting this whole
-    // pass on every net.mode change. extension/ has no lint gate to satisfy here; this is a plain note.
-  }, []);
 
   const select = async (a: Account) => {
     const r = await m.engine.select(a.index);
````

Modify `extension/src/app/ui/LockedButton.tsx`:

````diff
diff --git a/extension/src/app/ui/LockedButton.tsx b/extension/src/app/ui/LockedButton.tsx
index e6e08b9..6036b2b 100644
--- a/extension/src/app/ui/LockedButton.tsx
+++ b/extension/src/app/ui/LockedButton.tsx
@@ -1,4 +1,4 @@
-import {useEffect, useRef, useState, type ReactNode} from 'react';
+import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
 
 /** Cardinal rule 6: no double submit — 500 ms at least, and never before the action settles. */
 export const LOCK_MS = 500;
@@ -17,6 +17,7 @@ export function LockedButton({
   className = 'btn btn-primary',
   disabled = false,
   label,
+  keepFocus = false,
   wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
 }: {
   onPress: () => Promise<unknown> | void;
@@ -24,10 +25,25 @@ export function LockedButton({
   className?: string;
   disabled?: boolean;
   label?: string;
+  /**
+   * B1b-2b §4.3 (keyboard reorder): a button that had the focus when pressed takes it back once it is enabled again —
+   * the lock disables it, and a disabled (or moved) button loses the focus to the page. Only from the page: a focus the
+   * user moved elsewhere meanwhile is left where it is.
+   */
+  keepFocus?: boolean;
   wait?: (ms: number) => Promise<void>;
 }) {
   const busy = useRef(false);
   const [locked, setLocked] = useState(false);
+  const self = useRef<HTMLButtonElement>(null);
+  const refocus = useRef(false);
+  useLayoutEffect(() => {
+    if (!locked && !disabled && refocus.current) {
+      refocus.current = false;
+      const at = document.activeElement;
+      if (at === null || at === document.body) self.current?.focus();
+    }
+  }, [locked, disabled]);
   /** False once unmounted: an action that settles after the screen went sets nothing. */
   const alive = useRef(true);
   useEffect(() => {
@@ -39,6 +55,7 @@ export function LockedButton({
   const press = () => {
     if (busy.current || disabled) return;
     busy.current = true;
+    refocus.current = keepFocus && document.activeElement === self.current;
     setLocked(true);
     const floor = wait(LOCK_MS);
     let action: Promise<unknown>;
@@ -54,7 +71,7 @@ export function LockedButton({
     });
   };
   return (
-    <button type="button" className={`${className}${locked ? ' is-busy' : ''}`} disabled={disabled || locked} aria-label={label} onClick={press}>
+    <button ref={self} type="button" className={`${className}${locked ? ' is-busy' : ''}`} disabled={disabled || locked} aria-label={label} onClick={press}>
       {children}
     </button>
   );
````

Create `extension/src/app/useAccountBalances.ts`:

````ts
import {useEffect, useRef, useState} from 'react';
import {useWallet} from './WalletContext';
import type {Account, Balances} from './engine';

/** Fresh balances for the first ten rows, one account at a time (2 requests each, inside the proxy's budget). */
export const FRESH_ROWS = 10;

export type RowBalance = {b: Balances; at: number; fresh: boolean};

/**
 * The account rows' balances (spec B1b-2a §5.2; shared by the switcher and the B1b-2b accounts manager): every account's
 * cached balances first, then a fresh read for the first FRESH_ROWS rows. No fresh pass during the 403 cool-down, nor
 * while offline or unreachable; a 403 or no answer ends the pass and is reported to the app (M4). Read once per set of
 * addresses: a rename changes names, not balances, and reads nothing again; an account added, removed or first known
 * (a screen mounted before the wallet state arrived) reads again.
 */
export function useAccountBalances(accounts: readonly Account[]): Record<string, RowBalance> {
  const m = useWallet();
  const [rows, setRows] = useState<Record<string, RowBalance>>({});
  // The live net mode (WalletContext's own netRef pattern): a ref, kept current every render, so the
  // async pass below reads what net.mode IS when it checks, not what it was when the effect started.
  const netRef = useRef(m.net);
  netRef.current = m.net;
  const keys = accounts.map(a => a.publicKey).join(',');

  useEffect(() => {
    let alive = true;
    // No fresh pass during the 403 cool-down, nor while offline or unreachable (review M5): the cached
    // rows are what there is, and ten reads that cannot answer would only wait. Read live (netRef), not
    // a value captured once: the sequential cached loop below can run long enough for net.mode to flip
    // mid-pass, and a snapshot taken at mount would miss that (review follow-up).
    const away = (): boolean => {
      const mode = netRef.current.mode;
      return mode === 'refused' || mode === 'offline' || mode === 'unreachable';
    };
    void (async () => {
      for (const a of accounts) {
        const c = await m.engine.cached(a.publicKey);
        if (!alive) return;
        if (c.ok && c.data.balances !== null) {
          const {at, ...b} = c.data.balances;
          setRows(r => ({...r, [a.publicKey]: {b, at, fresh: false}}));
        }
      }
      if (away()) return;
      for (const a of accounts.slice(0, FRESH_ROWS)) {
        if (away()) return;
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
    // Keyed on the addresses only, deliberately (see above). extension/ has no lint gate; this is a plain note.
  }, [keys]);
  return rows;
}
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/AccountsManager.test.tsx src/app/__tests__/LockedButton.test.tsx
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 2 passed (2) · Tests 17 passed (17); tsc clean; whole suite Test Files 131 passed (131) · Tests 2294 passed (2294); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  list, remove sheet, stale + last account — Task 20.

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M14a** — the last account is removable — `extension/src/app/screens/AccountsManager.tsx`:

  ```diff
  - const last = accounts.length <= 1;
  + const last = false;
  ```
  `timeout 300 npx vitest run src/app/__tests__/AccountsManager.test.tsx` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M14b** — keepFocus never refocuses — `extension/src/app/ui/LockedButton.tsx`:

  ```diff
  - refocus.current = keepFocus && document.activeElement === self.current;
  + refocus.current = false;
  ```
  `timeout 300 npx vitest run src/app/__tests__/LockedButton.test.tsx` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/src/app/App.tsx extension/src/app/__tests__/AccountsManager.test.tsx extension/src/app/__tests__/LockedButton.test.tsx extension/src/app/app.css extension/src/app/screens/AccountsManager.tsx extension/src/app/screens/Switcher.tsx extension/src/app/ui/LockedButton.tsx extension/src/app/useAccountBalances.ts
git commit -F - <<'MSG'
feat(extension): The accounts manager (Profile): order, rename, remove sheet; useAccountBalances shared with the Switcher

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 15: #37 delete wallet (popup): funds line, type DELETE, hold 1 s → the proof page

**Spec:** §5, D9, D11, C13, C17; O11, O64–O66; #37 (ix:15000–15100)

**Files:**
- Modify: `extension/src/app/App.tsx`
- Create: `extension/src/app/__tests__/DeleteWallet.test.tsx`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/screens/AccountsManager.tsx`
- Create: `extension/src/app/screens/DeleteWallet.tsx`
- Modify: `extension/src/app/screens/Switcher.tsx`
- Create: `extension/src/app/ui/HoldButton.tsx`
- Modify: `extension/src/app/useAccountBalances.ts`

**Interfaces:**
- Consumes: Task 7's `ExtensionPage`; Task 14's `useAccountBalances`; `pendingOf`.
- Produces (exact signatures, as exported):
  - `export const DELETE_TEXT =`
  - `export const WORD = 'DELETE';`
  - `export const HOLD_MS = 1_000;`
  - `export function firstAccount(accounts: readonly Account[]): Account | null`
  - `export function DeleteWallet({onBack, clock = realClock}: {onBack: () => void; clock?: HoldClock})`
  - `export interface HoldClock`
  - `export const realClock: HoldClock =`
  - `export const HOLD_TICK_MS = 30;`
  - `export function HoldButton(`
  - `export interface AccountBalances`
  - `export function useAccountBalances(accounts: readonly Account[]): AccountBalances`

37a: what the wallet holds (or "Balances could not all be checked — this wallet may hold funds."), the first account by **lowest index** (the one the proof page will show), a type-to-confirm field. 37b: partial ("N of 6 characters · keep going"), not a prefix ("Type DELETE exactly — it is case-sensitive."). 37c: matched → `HoldButton` — hold 1 s (a fill and a countdown; release cancels; Cancel disabled while held) → opens `?mode=delete` and closes the popup. An open send shows the pending line and no hold. `HoldButton` takes an injectable clock (tests drive it manually; E2E uses Playwright's paused clock).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/DeleteWallet.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {DeleteWallet, firstAccount} from '../screens/DeleteWallet';
import type {HoldClock} from '../ui/HoldButton';
import {ENV, renderInWallet, walletReader} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {PENDING_KEY} from '../../background/pendingStore';
import {SETTINGS_KEY} from '../../background/settings';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {fakeReader} from '../../background/__tests__/fakeDeps';

// B1b-2b §5 (#37; D9, D11, C13, C17): typed DELETE and a 1 s hold open the vault tab's proof.
const SELECTORS = selectorsOf(UI_SHEETS);

/** A clock the test moves: every tick the hold registered runs at each 30 ms step. */
function manualClock() {
  let t = 0;
  const jobs = new Set<() => void>();
  const clock: HoldClock = {now: () => t, every: (_ms, f) => (jobs.add(f), () => void jobs.delete(f))};
  return {
    clock,
    advance: (ms: number) =>
      act(() => {
        for (let step = 0; step < ms; step += 30) {
          t += 30;
          for (const f of [...jobs]) f();
        }
      }),
  };
}
async function shown(o: Parameters<typeof renderInWallet>[1] = {}) {
  const c = manualClock();
  let backs = 0;
  const w = await renderInWallet(<DeleteWallet onBack={() => void (backs += 1)} clock={c.clock} />, o);
  await screen.findByText('Delete this wallet?');
  return {...w, ...c, backs: () => backs};
}
const field = () => screen.getByRole('textbox', {name: 'Type DELETE here'}) as HTMLInputElement;
const typeIn = (v: string) => fireEvent.change(field(), {target: {value: v}});
const cta = () => document.querySelector('.sticky-bar .btn-primary') as HTMLButtonElement;

describe('#37 delete wallet', () => {
  it('37a idle: the adapted copy, the two bullets (no staking, no dApps, no backup file), the typed field, the CTA greyed and disabled', async () => {
    await shown();
    expect(screen.getByText('Delete wallet', {selector: '.top-bar .title'})).toBeTruthy();
    expect(document.querySelector('.app-delete-card .noc-body')?.textContent).toBe('This removes all encrypted keys and local data from this browser.');
    const bullets = [...document.querySelectorAll('.app-delete-bullets li')].map(li => li.textContent);
    expect(bullets).toEqual([
      "Your assets won't be lost on-chain — but you'll need your recovery phrase to access them again.",
      'Local settings, cached balances and the list of addresses you have sent to are erased and not recoverable.',
    ]);
    expect(document.body.textContent).not.toMatch(/staking|dApp|backup file|seed phrase/);
    expect(document.querySelector('.app-delete-eyebrow')?.textContent).toBe('Type DELETE to confirm');
    expect(field().getAttribute('autocapitalize')).toBe('characters');
    expect(field().getAttribute('autocomplete')).toBe('off');
    expect(field().getAttribute('spellcheck')).toBe('false');
    expect(screen.getByText('Case-sensitive · must match exactly.')).toBeTruthy();
    expect(cta().textContent).toBe('Delete wallet');
    expect(cta().disabled).toBe(true);
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('C17: the first account is the LOWEST index — not the first row of the display order', async () => {
    await shown({before: async ext => ext.local.set(SETTINGS_KEY, {accountOrder: [1, 0]})});
    expect(firstAccount([{index: 1, name: 'B', publicKey: RECIPIENT}, {index: 0, name: 'A', publicKey: ACCOUNT.publicKey}])?.publicKey).toBe(ACCOUNT.publicKey);
    await waitFor(() => expect([...document.querySelectorAll('.app-delete-first .addr-groups span')].map(s => s.textContent).join('')).toBe(ACCOUNT.publicKey));
    expect(screen.getByText("This wallet's first account")).toBeTruthy();
  });

  it('negative controls: "DELET", "delete", "DELETE " and "DEL" keep the CTA disabled', async () => {
    await shown();
    for (const v of ['DELET', 'delete', 'DELETE ', 'DEL']) {
      typeIn(v);
      expect(cta().disabled).toBe(true);
      expect(document.querySelector('.app-hold')).toBeNull();
    }
  });

  it('37b partial: the body collapses, "3 of 6 characters · keep going"; not a prefix: O66', async () => {
    await shown();
    typeIn('DEL');
    expect(document.querySelector('.app-delete-bullets')).toBeNull();
    expect(document.querySelector('.app-delete-help')?.textContent).toBe('3 of 6 characters · keep going');
    expect(document.querySelector('.s7-pw')?.classList.contains('app-pw-active')).toBe(true);
    typeIn('DEX');
    expect(screen.getByText('Type DELETE exactly — it is case-sensitive.')).toBeTruthy();
  });

  it('37c matched: the hold copy, "Confirmation matched", the caption; a 0.9 s hold opens nothing; the full second opens the proof and closes', async () => {
    const w = await shown();
    typeIn('DELETE');
    expect(screen.getByText('Hold the red button below — release to cancel, hold for the full second to delete.')).toBeTruthy();
    expect(document.querySelector('.app-delete-eyebrow')?.textContent?.trim()).toBe('Confirmation matched');
    expect(screen.getByText('Hold the red button to delete · release to cancel')).toBeTruthy();
    expect(screen.getByText('Confirmation opens in a new tab.')).toBeTruthy();
    const hold = document.querySelector('.app-hold') as HTMLButtonElement;
    expect(hold.textContent).toBe('Hold to delete');
    fireEvent.pointerDown(hold, {button: 0});
    w.advance(600);
    expect(hold.textContent).toBe('Hold to delete · 0.4 s');
    expect((screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement).disabled).toBe(true);
    w.advance(300);
    fireEvent.pointerUp(hold);
    expect(w.platform.opened).toEqual([]);
    expect(hold.textContent).toBe('Hold to delete');
    expect((screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.pointerDown(hold, {button: 0});
    w.advance(1_020);
    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
    expect(w.platform.closed).toBe(1);
    // The hold is the lock: one open per completed hold, none after.
    w.advance(2_000);
    fireEvent.pointerDown(hold, {button: 0});
    w.advance(1_020);
    expect(w.platform.opened).toHaveLength(1);
  });

  it('the keyboard: Space held on the focused CTA holds; keyup releases; key repeats are ignored', async () => {
    const w = await shown();
    typeIn('DELETE');
    const hold = document.querySelector('.app-hold') as HTMLButtonElement;
    fireEvent.keyDown(hold, {key: ' '});
    w.advance(500);
    fireEvent.keyDown(hold, {key: ' ', repeat: true});
    fireEvent.keyUp(hold, {key: ' '});
    expect(w.platform.opened).toEqual([]);
    fireEvent.keyDown(hold, {key: 'Enter'});
    w.advance(1_020);
    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
  });

  it('funded (D11, C13): "This wallet holds funds", the summed balances, the USD total and O64 — and the hold still works', async () => {
    await shown();
    await waitFor(() => expect(screen.getByText('This wallet holds funds')).toBeTruthy());
    // Two accounts × walletReader (62.4821 SOL, 4 200 NOC, 740.21 USDC): 124.9642 SOL, 8,400.00 NOC, 1,480.42 USDC.
    await waitFor(() => expect(document.querySelector('.app-delete-funds')?.textContent).toBe('124.9642 SOL8,400.00 NOC1,480.42 USDC$20,225.05They stay on Solana. Only your recovery phrase reaches them after this.'));
  });

  it('balances unknown: a read failed — O65', async () => {
    await shown({reader: walletReader({getBalance: async () => Promise.reject(new Error('x'))})});
    expect(await screen.findByText('Balances could not all be checked — this wallet may hold funds.')).toBeTruthy();
  });

  it('nothing funded and everything read: neither banner', async () => {
    await shown({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []})});
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByText('This wallet holds funds')).toBeNull();
    expect(screen.queryByText('Balances could not all be checked — this wallet may hold funds.')).toBeNull();
  });

  it('send open: the pending banner; the typed gate usable; the CTA disabled', async () => {
    const open = pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
    await shown({before: async ext => ext.local.set(PENDING_KEY, [open])});
    expect(await screen.findByText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.')).toBeTruthy();
    typeIn('DELETE');
    expect((document.querySelector('.app-hold') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Cancel and Back leave with the typed text wiped', async () => {
    const w = await shown({env: ENV});
    typeIn('DELE');
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(w.backs()).toBe(1);
    expect(field().value).toBe('');
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/DeleteWallet.test.tsx
```
Expected (dry run, these test files on Task 14's tree): **red** — Test Files 1 failed (1) · the file fails to load (it imports what this task creates). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/App.tsx`:

````diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index 793e0db..6339ab6 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -17,6 +17,7 @@ import {Settings} from './screens/Settings';
 import {About} from './screens/About';
 import {Passkey} from './screens/Passkey';
 import {AccountsManager} from './screens/AccountsManager';
+import {DeleteWallet} from './screens/DeleteWallet';
 import {Created} from './screens/Created';
 import {Imported} from './screens/Imported';
 import {Send} from './screens/Send';
@@ -262,6 +263,8 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
         }}
       />
     );
+  } else if (route.screen === 'delete') {
+    screen = <DeleteWallet onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'accounts') {
     screen = <AccountsManager onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'passkey') {
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 97f7a32..c9546af 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -881,3 +881,135 @@ a.btn {
 .app-remove-sheet p {
   margin: 0;
 }
+
+/* B1b-2b §5: #37 delete wallet — index.html #s37's inline styles, as classes. */
+.app-delete-body {
+  padding: 0 var(--space-5) var(--space-6);
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-5);
+}
+.app-delete-body p,
+.app-delete-body ul {
+  margin: 0;
+}
+.app-delete-card {
+  background: color-mix(in oklab, var(--danger) 10%, var(--bg-surface-1));
+  border: 1px solid color-mix(in oklab, var(--danger) 36%, transparent);
+  border-radius: var(--radius-2xl);
+  padding: var(--space-6);
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-4);
+}
+.app-delete-head {
+  display: flex;
+  align-items: center;
+  gap: var(--space-3);
+}
+.app-delete-head h2 {
+  margin: 0;
+}
+.app-delete-icon {
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
+.app-delete-bullets {
+  list-style: none;
+  padding: 0;
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-2);
+}
+.app-delete-bullets li {
+  color: var(--fg-secondary);
+  display: flex;
+  align-items: flex-start;
+  gap: var(--space-3);
+}
+.app-delete-x {
+  color: var(--danger);
+  flex: 0 0 16px;
+  line-height: 18px;
+  padding-top: 2px;
+  display: flex;
+}
+.app-delete-first {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-1);
+}
+.app-delete-eyebrow {
+  margin-bottom: var(--space-2);
+  display: flex;
+  align-items: center;
+  gap: 4px;
+}
+.app-delete-word {
+  color: var(--danger);
+  letter-spacing: 0.16em;
+}
+.app-delete-help {
+  margin-top: 6px;
+}
+.app-delete-funds {
+  display: flex;
+  flex-direction: column;
+}
+.s7-pw input::placeholder {
+  color: var(--fg-tertiary);
+  letter-spacing: 0.16em;
+}
+.s7-pw.app-pw-active {
+  border: 1px solid var(--accent);
+}
+.s7-pw.app-pw-ok {
+  background: color-mix(in oklab, var(--success) 8%, var(--bg-surface-3));
+  border: 1px solid color-mix(in oklab, var(--success) 30%, transparent);
+}
+.s7-pw.app-pw-ok input {
+  font-weight: 600;
+}
+.s7-pw input {
+  letter-spacing: 0.16em;
+}
+/* 37a/37b: the gated CTA greyed at full opacity (ix:15000: --bg-surface-3, --fg-disabled, opacity 1). */
+.btn.app-delete-gated:disabled {
+  background: var(--bg-surface-3);
+  color: var(--fg-disabled);
+  opacity: 1;
+  box-shadow: none;
+}
+/* 37c: the hold CTA in --danger, its fill darkening as it is held (ix:15087-15088). The design's 600 ms transition is
+   for its own 600 ms hold: here the fill follows the 30 ms ticks of the owner's 1 s hold (D9). */
+.btn.s7-longpress.app-hold {
+  background: var(--danger);
+  color: var(--danger-on);
+  box-shadow: none;
+}
+.btn.s7-longpress.app-hold .fill {
+  background: color-mix(in oklab, #000 35%, transparent);
+  transition: none;
+}
+.app-hold-label {
+  display: flex;
+  align-items: center;
+  justify-content: center;
+  gap: var(--space-2);
+}
+@media (prefers-reduced-motion: reduce) {
+  .btn.s7-longpress.app-hold .fill {
+    display: none;
+  }
+}
+/* 37c: Cancel at the design's .45 while the CTA is pressed. */
+.app-delete .sticky-bar .btn-secondary:disabled {
+  opacity: 0.45;
+}
````

Modify `extension/src/app/screens/AccountsManager.tsx`:

````diff
diff --git a/extension/src/app/screens/AccountsManager.tsx b/extension/src/app/screens/AccountsManager.tsx
index 4cc11f7..4ea01f1 100644
--- a/extension/src/app/screens/AccountsManager.tsx
+++ b/extension/src/app/screens/AccountsManager.tsx
@@ -65,7 +65,7 @@ export function AccountsManager({onBack}: {onBack: () => void}) {
   const m = useWallet();
   const now = useNow(1_000, m.now);
   const accounts = m.wallet?.accounts ?? [];
-  const rows = useAccountBalances(accounts);
+  const {rows} = useAccountBalances(accounts);
   const [editing, setEditing] = useState<number | null>(null);
   const [name, setName] = useState('');
   const [renameError, setRenameError] = useState<string | null>(null);
````

Create `extension/src/app/screens/DeleteWallet.tsx`:

````tsx
import {useState} from 'react';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {useWallet} from '../WalletContext';
import {useAccountBalances} from '../useAccountBalances';
import {valuation} from '../valuation';
import {showAmount, showUsd} from '../format';
import {TopBar} from '../ui/TopBar';
import {Banner} from '../ui/Banner';
import {ExtIcon} from '../ui/ExtIcon';
import {HoldButton, type HoldClock, realClock} from '../ui/HoldButton';
import type {Account, Balances, Token} from '../engine';

/** #37's copy (B1b-2b §5): the design's strings, adapted where marked in the spec, and O11, O64, O65, O66. */
export const DELETE_TEXT = {
  title: 'Delete wallet',
  heading: 'Delete this wallet?',
  bulletAssets: ["Your assets won't be lost on-chain — but you'll need your ", 'recovery phrase', ' to access them again.'],
  bulletErased: ['Local settings, cached balances and the list of addresses you have sent to are ', 'erased', ' and not recoverable.'],
  holdBody: 'Hold the red button below — release to cancel, hold for the full second to delete.',
  firstAccount: "This wallet's first account",
  typeLead: 'Type ',
  typeWord: 'DELETE',
  typeTail: ' to confirm',
  placeholder: 'Type DELETE here',
  caseSensitive: 'Case-sensitive · must match exactly.',
  keepGoing: (n: number) => [String(n), ' of ', '6', ' characters · keep going'] as const,
  notAPrefix: 'Type DELETE exactly — it is case-sensitive.',
  matched: 'Confirmation matched',
  holdCaption: 'Hold the red button to delete · release to cancel',
  hold: 'Hold to delete',
  opensTab: 'Confirmation opens in a new tab.',
  cancel: 'Cancel',
  funded: 'This wallet holds funds',
  fundedTail: 'They stay on Solana. Only your recovery phrase reaches them after this.',
  unknown: 'Balances could not all be checked — this wallet may hold funds.',
  sendOpen: 'A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.',
} as const;

export const WORD = 'DELETE';
/** D9: the owner chose "the full second" (the design says both 600 ms and "the full second", ix:15072). */
export const HOLD_MS = 1_000;
const TOKENS: readonly Token[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const KEY: Record<Token, keyof Balances> = {SOL: 'sol', NOC: 'noc', USDC: 'usdc', USDT: 'usdt'};

/** C17: the account with the LOWEST index — never the display order (E14), never list position. */
export function firstAccount(accounts: readonly Account[]): Account | null {
  let low: Account | null = null;
  for (const a of accounts) if (low === null || a.index < low.index) low = a;
  return low;
}

/**
 * #37 delete wallet (spec B1b-2b §5; D9, D11, C13, C17) in the popup. Two gates of friction — DELETE typed exactly (case
 * sensitive, `autocapitalize="characters"`) and a 1 s hold (pointer, or Space / Enter held) — then the vault tab's proof
 * (`?mode=delete`, §3.2), where the password or passkey deletes the wallet. Neither gate is the security: the proof is.
 * The screen shows what is at stake first: "This wallet holds funds" with the summed balances (the popup's reading, C13 —
 * it informs, never gates: D11), or that the balances could not all be checked; an open send disables the CTA (E5
 * refuses it anyway). The first account's address (lowest index) is the one the delete page will show (C17). Cancel and
 * Back leave with the typed text wiped.
 */
export function DeleteWallet({onBack, clock = realClock}: {onBack: () => void; clock?: HoldClock}) {
  const m = useWallet();
  const accounts = m.wallet?.accounts ?? [];
  const {rows, done, failed} = useAccountBalances(accounts);
  const [typed, setTyped] = useState('');
  const [pressing, setPressing] = useState(false);
  const matched = typed === WORD;
  const partial = typed !== '' && !matched;
  const prefix = WORD.startsWith(typed);
  const first = firstAccount(accounts);
  const sendOpen = m.pending.some(p => p.state === 'pending' || p.state === 'stuck');

  // C13: the popup's reading, summed over the accounts it has a row for.
  const sum: Balances = {sol: 0n, noc: 0n, usdc: 0n, usdt: 0n};
  for (const a of accounts) {
    const r = rows[a.publicKey];
    if (r === undefined) continue;
    for (const t of TOKENS) sum[KEY[t]] += r.b[KEY[t]];
  }
  const held = TOKENS.filter(t => sum[KEY[t]] > 0n);
  const total = held.length === 0 ? null : valuation(sum, m.prices).total;
  const unknown = done && (failed || accounts.some(a => rows[a.publicKey] === undefined));

  const leave = () => {
    setTyped('');
    onBack();
  };
  const toProof = () => {
    setTyped('');
    m.platform.openPage('unlock.html?mode=delete');
    if (m.surface === 'popup') m.platform.closeWindow();
  };

  return (
    <div className="screen app-delete">
      <TopBar title={DELETE_TEXT.title} onBack={leave} />
      <div className="app-delete-body">
        {held.length > 0 ? (
          <Banner tone="warning" title={DELETE_TEXT.funded}>
            <span className="app-delete-funds">
              {held.map(t => (
                <span key={t} className="noc-numeral">{`${showAmount(t, sum[KEY[t]])} ${t}`}</span>
              ))}
              {total === null ? null : <span className="noc-numeral">{showUsd(total)}</span>}
              <span>{DELETE_TEXT.fundedTail}</span>
            </span>
          </Banner>
        ) : null}
        {unknown ? <Banner tone="warning" title={DELETE_TEXT.unknown} /> : null}
        {sendOpen ? <Banner tone="warning" title={DELETE_TEXT.sendOpen} /> : null}
        <div className="app-delete-card">
          <div className="app-delete-head">
            <span className="app-delete-icon">
              <ExtIcon name="alert-triangle" size={24} />
            </span>
            <h2 className="noc-h2 noc-danger">{DELETE_TEXT.heading}</h2>
          </div>
          {matched ? (
            <p className="noc-body">{DELETE_TEXT.holdBody}</p>
          ) : (
            <p className="noc-body">
              This removes <b>all encrypted keys</b> and <b>local data</b> from this browser.
            </p>
          )}
          {typed === '' ? (
            <ul className="app-delete-bullets">
              {[DELETE_TEXT.bulletAssets, DELETE_TEXT.bulletErased].map(([a, b, c]) => (
                <li key={b} className="noc-body-sm">
                  <span className="app-delete-x">
                    <ExtIcon name="close" size={16} />
                  </span>
                  <span>
                    {a}
                    <b>{b}</b>
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {first === null ? null : (
          <div className="app-delete-first">
            <p className="noc-caption app-muted">{DELETE_TEXT.firstAccount}</p>
            <AddressGroups address={first.publicKey} />
          </div>
        )}
        <div>
          {matched ? (
            <p className="noc-overline noc-success app-delete-eyebrow">
              <ExtIcon name="check" size={12} /> {DELETE_TEXT.matched}
            </p>
          ) : (
            <p className="noc-overline app-dim app-delete-eyebrow">
              {DELETE_TEXT.typeLead}
              <b className="app-delete-word">{DELETE_TEXT.typeWord}</b>
              {DELETE_TEXT.typeTail}
            </p>
          )}
          <label className={`s7-pw${matched ? ' app-pw-ok' : partial ? ' app-pw-active' : ''}`}>
            <input
              aria-label={DELETE_TEXT.placeholder}
              placeholder={DELETE_TEXT.placeholder}
              value={typed}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={e => setTyped(e.target.value)}
            />
            {matched ? (
              <span className="noc-success">
                <ExtIcon name="check" size={20} />
              </span>
            ) : null}
          </label>
          {typed === '' ? <p className="noc-caption app-dim app-delete-help">{DELETE_TEXT.caseSensitive}</p> : null}
          {partial && prefix ? (
            <p className="noc-caption app-dim app-delete-help">
              {DELETE_TEXT.keepGoing(typed.length).map((part, i) => (i === 0 || i === 2 ? <span key={i} className="noc-numeral">{part}</span> : part))}
            </p>
          ) : null}
          {partial && !prefix ? <p className="noc-caption noc-danger app-delete-help">{DELETE_TEXT.notAPrefix}</p> : null}
        </div>
        {matched ? <p className="noc-caption app-dim app-center-text">{DELETE_TEXT.holdCaption}</p> : null}
      </div>
      <div className="sticky-bar">
        {matched ? (
          <HoldButton label={DELETE_TEXT.hold} holdMs={HOLD_MS} disabled={sendOpen} onHeld={toProof} onPressing={setPressing} clock={clock} />
        ) : (
          <button type="button" className="btn btn-primary app-delete-gated" disabled>
            <ExtIcon name="trash" size={18} />
            {DELETE_TEXT.title}
          </button>
        )}
        {matched ? <p className="noc-caption app-dim app-center-text">{DELETE_TEXT.opensTab}</p> : null}
        <button type="button" className="btn btn-secondary" disabled={pressing} onClick={leave}>
          {DELETE_TEXT.cancel}
        </button>
      </div>
    </div>
  );
}
````

Modify `extension/src/app/screens/Switcher.tsx`:

````diff
diff --git a/extension/src/app/screens/Switcher.tsx b/extension/src/app/screens/Switcher.tsx
index 2376fb3..20a2516 100644
--- a/extension/src/app/screens/Switcher.tsx
+++ b/extension/src/app/screens/Switcher.tsx
@@ -34,7 +34,7 @@ export function Switcher({onClose}: {onClose: () => void}) {
   const m = useWallet();
   const now = useNow(1_000, m.now);
   const accounts = m.wallet?.accounts ?? [];
-  const rows = useAccountBalances(accounts);
+  const {rows} = useAccountBalances(accounts);
   const [editing, setEditing] = useState<number | null>(null);
   const [name, setName] = useState('');
   const [error, setError] = useState<string | null>(null);
````

Create `extension/src/app/ui/HoldButton.tsx`:

````tsx
import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {ExtIcon} from './ExtIcon';

/** A clock the hold reads (injectable: a test holds and releases on its own time). */
export interface HoldClock {
  now(): number;
  /** Calls `f` every `ms` until the returned stop is called. */
  every(ms: number, f: () => void): () => void;
}
export const realClock: HoldClock = {
  now: () => Date.now(),
  every: (ms, f) => {
    const id = setInterval(f, ms);
    return () => clearInterval(id);
  },
};
/** How often the fill and the count move while held. */
export const HOLD_TICK_MS = 30;

/**
 * #37's long-press CTA (index.html #s37c: `.btn-primary.s7-longpress`, `--danger`, an inner `.fill` scaled by the share
 * held). Pointer down, or Space / Enter held on the focused button (repeats ignored), starts it; pointer up, leave or
 * cancel, keyup and blur release it — back to the rest label, the fill reset. Held for `holdMs` it calls `onHeld` once:
 * the hold itself is rule 6's lock (one call per completed hold, and none after). While held the label counts the
 * seconds left with one decimal ("Hold to delete · 0.4 s"); `prefers-reduced-motion` hides the fill (app.css), the
 * count still runs.
 */
export function HoldButton({
  label,
  holdMs,
  disabled,
  onHeld,
  onPressing,
  clock = realClock,
}: {
  label: string;
  holdMs: number;
  disabled: boolean;
  onHeld: () => void;
  onPressing?: (pressing: boolean) => void;
  clock?: HoldClock;
}) {
  const [share, setShare] = useState<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const done = useRef(false);
  const latest = useRef({onHeld, onPressing});
  latest.current = {onHeld, onPressing};

  const release = () => {
    if (stop.current === null) return;
    stop.current();
    stop.current = null;
    setShare(null);
    latest.current.onPressing?.(false);
  };
  const press = () => {
    if (disabled || done.current || stop.current !== null) return;
    const started = clock.now();
    setShare(0);
    latest.current.onPressing?.(true);
    stop.current = clock.every(HOLD_TICK_MS, () => {
      const held = clock.now() - started;
      if (held < holdMs) return setShare(held / holdMs);
      stop.current?.();
      stop.current = null;
      done.current = true;
      setShare(1);
      latest.current.onPressing?.(false);
      latest.current.onHeld();
    });
  };
  useEffect(() => () => stop.current?.(), []);
  useEffect(() => {
    if (disabled) release();
  }, [disabled]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) press();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') release();
  };
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    press();
  };
  const left = share === null ? null : Math.max(0, holdMs - share * holdMs) / 1000;
  return (
    <button
      type="button"
      className="btn btn-primary s7-longpress app-hold"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={release}
      onContextMenu={e => e.preventDefault()}
    >
      <span className="fill" aria-hidden="true" style={{transform: `scaleX(${share ?? 0})`}} />
      <span className="label app-hold-label">
        <ExtIcon name="trash" size={18} />
        {left === null ? label : `${label} · `}
        {left === null ? null : <span className="noc-numeral">{`${left.toFixed(1)} s`}</span>}
      </span>
    </button>
  );
}
````

Modify `extension/src/app/useAccountBalances.ts`:

````diff
diff --git a/extension/src/app/useAccountBalances.ts b/extension/src/app/useAccountBalances.ts
index 21b0766..4156ac5 100644
--- a/extension/src/app/useAccountBalances.ts
+++ b/extension/src/app/useAccountBalances.ts
@@ -7,6 +7,13 @@ export const FRESH_ROWS = 10;
 
 export type RowBalance = {b: Balances; at: number; fresh: boolean};
 
+/** The rows, and how the pass went: `done` once it ended; `failed` when a fresh read of one of the first rows failed. */
+export interface AccountBalances {
+  rows: Record<string, RowBalance>;
+  done: boolean;
+  failed: boolean;
+}
+
 /**
  * The account rows' balances (spec B1b-2a §5.2; shared by the switcher and the B1b-2b accounts manager): every account's
  * cached balances first, then a fresh read for the first FRESH_ROWS rows. No fresh pass during the 403 cool-down, nor
@@ -14,9 +21,11 @@ export type RowBalance = {b: Balances; at: number; fresh: boolean};
  * addresses: a rename changes names, not balances, and reads nothing again; an account added, removed or first known
  * (a screen mounted before the wallet state arrived) reads again.
  */
-export function useAccountBalances(accounts: readonly Account[]): Record<string, RowBalance> {
+export function useAccountBalances(accounts: readonly Account[]): AccountBalances {
   const m = useWallet();
   const [rows, setRows] = useState<Record<string, RowBalance>>({});
+  const [done, setDone] = useState(false);
+  const [failed, setFailed] = useState(false);
   // The live net mode (WalletContext's own netRef pattern): a ref, kept current every render, so the
   // async pass below reads what net.mode IS when it checks, not what it was when the effect started.
   const netRef = useRef(m.net);
@@ -33,7 +42,13 @@ export function useAccountBalances(accounts: readonly Account[]): Record<string,
       const mode = netRef.current.mode;
       return mode === 'refused' || mode === 'offline' || mode === 'unreachable';
     };
+    setDone(false);
+    setFailed(false);
     void (async () => {
+      await pass();
+      if (alive) setDone(true);
+    })();
+    async function pass(): Promise<void> {
       for (const a of accounts) {
         const c = await m.engine.cached(a.publicKey);
         if (!alive) return;
@@ -52,14 +67,15 @@ export function useAccountBalances(accounts: readonly Account[]): Record<string,
           continue;
         }
         // A 403 or no answer is the whole app's state (M4), and ends the pass: the next read would fare no better.
+        setFailed(true);
         m.report(f.error);
         if (f.error === 'coordinator-refused' || f.error === 'unreachable') return;
       }
-    })();
+    }
     return () => {
       alive = false;
     };
     // Keyed on the addresses only, deliberately (see above). extension/ has no lint gate; this is a plain note.
   }, [keys]);
-  return rows;
+  return {rows, done, failed};
 }
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/DeleteWallet.test.tsx
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 1 passed (1) · Tests 11 passed (11); tsc clean; whole suite Test Files 132 passed (132) · Tests 2305 passed (2305); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  37a idle funded, 37b partial, not a prefix, 37c matched, mid-hold (~60 %, paused clock), send open, balances unknown — Task 20.

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M15a** — #37 names the highest index — `extension/src/app/screens/DeleteWallet.tsx`:

  ```diff
  - a.index < low.index
  + a.index > low.index
  ```
  `timeout 300 npx vitest run src/app/__tests__/DeleteWallet.test.tsx` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M15b** — DELETE is case-insensitive — `extension/src/app/screens/DeleteWallet.tsx`:

  ```diff
  - const matched = typed === WORD;
  + const matched = typed.toUpperCase() === WORD;
  ```
  `timeout 300 npx vitest run src/app/__tests__/DeleteWallet.test.tsx` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/src/app/App.tsx extension/src/app/__tests__/DeleteWallet.test.tsx extension/src/app/app.css extension/src/app/screens/AccountsManager.tsx extension/src/app/screens/DeleteWallet.tsx extension/src/app/screens/Switcher.tsx extension/src/app/ui/HoldButton.tsx extension/src/app/useAccountBalances.ts
git commit -F - <<'MSG'
feat(extension): #37 delete wallet (popup): funds line, type DELETE, hold 1 s → the proof page

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 16: #35 security center: tasks or all-clear, auto-lock and threshold pickers (D1, D5), danger zone

**Spec:** §4.2, D1–D5, C8, C15, E9; O47–O51

**Files:**
- Modify: `extension/src/app/App.tsx`
- Create: `extension/src/app/__tests__/Security.test.tsx`
- Modify: `extension/src/app/app.css`
- Create: `extension/src/app/screens/Security.tsx`
- Modify: `extension/src/app/ui/LockedButton.tsx`
- Create: `extension/src/app/ui/Picker.tsx`

**Interfaces:**
- Consumes: Task 7's `engine.settingsSet`, `ExtensionPage`; Task 13's Passkey route; Task 15's DeleteWallet route; `Picker`.
- Produces (exact signatures, as exported):
  - `export const SECURITY_TEXT =`
  - `export const AUTOLOCK_OPTIONS = [1, 5, 15, 60].map(value => ({value, label: SECURITY_TEXT.minutes(value)}));`
  - `export const THRESHOLD_OPTIONS = [5_000, 10_000, 50_000, 100_000].map(value => ({value, label: dollars(value)}));`
  - `export function dollars(cents: number): string`
  - `export type SecurityTask = 'write' | 'verify' | 'passkey';`
  - `export function securityTasks(passkey: boolean, phraseVerifiedAt: number | null): SecurityTask[]`
  - `export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onPasskey: () => void; onDelete: () => void})`
  - `export function Picker({options, value, onPick, label}: {options: readonly {value: number; label: string}[]; value: number; onPick: (v: number) => Promise<void>; label: string})`

No score and no ring (C15): the card says "Improve your security" with "N outstanding tasks." (35a) or "Looks great" / "All checks pass." (35b). Tasks: write down and verify the phrase (both follow `phraseVerifiedAt`, C8) and add a passkey. Locks: Auto-lock (1/5/15/60 min, D1), "Locks when the browser closes", the re-authentication threshold ($50/$100/$500/$1,000, D5) — a strengthening is written at once; a weakening gets the background's challenge and opens #10 (Task 2). A stored value that is no preset shows as the meta with nothing selected. Change password → `?mode=password`; Passkey → the passkey screen; the danger card's `[Delete wallet]` → #37.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Security.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {render, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {base64} from '@scure/base';
import {Security, dollars, securityTasks} from '../screens/Security';
import {WalletProvider} from '../WalletContext';
import {ENV, renderInWallet, setupWallet} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {SETTINGS_KEY} from '../../background/settings';

// B1b-2b §4.2 (#35; D1–D5, C8, C15, E9).
const SELECTORS = selectorsOf(UI_SHEETS);
const B = (n: number) => base64.encode(new Uint8Array(n).fill(1));
const WITH_PASSKEY = {...ENV, passkey: {credentialId: B(16), prfSalt: B(32), wrapped: B(40)}};
async function shown(o: Parameters<typeof renderInWallet>[1] = {}) {
  const calls = {passkey: 0, delete: 0, back: 0};
  const w = await renderInWallet(<Security onBack={() => void calls.back++} onPasskey={() => void calls.passkey++} onDelete={() => void calls.delete++} />, o);
  await screen.findByText('Security center', {selector: '.top-bar .title'});
  return {...w, calls};
}
const meta = (title: string) => screen.getByText(title, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');

describe('#35 security center', () => {
  it('securityTasks: both phrase rows follow the one fact (C8); the passkey row the passkey', () => {
    expect(securityTasks(false, null)).toEqual(['write', 'verify', 'passkey']);
    expect(securityTasks(true, null)).toEqual(['write', 'verify']);
    expect(securityTasks(false, 5)).toEqual(['passkey']);
    expect(securityTasks(true, 5)).toEqual([]);
    expect([dollars(5_000), dollars(100_000), dollars(1_250)]).toEqual(['$50', '$1,000', '$12.50']);
  });

  it('35a tasks outstanding: the ring-less card (C15), the three tasks, Locks, the danger zone — no score, no "Never", no staking, no air-gap', async () => {
    await shown();
    expect(screen.getByText('Improve your security')).toBeTruthy();
    expect(screen.getByText('3 outstanding tasks.')).toBeTruthy();
    expect(screen.getByText('Outstanding tasks')).toBeTruthy();
    expect([...document.querySelectorAll('.s7-task .label')].map(e => e.textContent)).toEqual(['Write down your recovery phrase', 'Verify recovery phrase', 'Add a passkey']);
    expect(screen.queryByText('Active protections')).toBeNull();
    expect(meta('Auto-lock')?.textContent).toBe('5 min');
    expect(screen.getByText('Locks when the browser closes')).toBeTruthy();
    expect(meta('Re-authentication threshold')?.textContent).toBe('$100');
    expect(meta('Passkey')?.textContent).toBe('Off');
    expect(meta('Passkey')?.classList.contains('noc-warning')).toBe(true);
    expect(screen.getByText('Change password')).toBeTruthy();
    expect(screen.getByText('Danger zone')).toBeTruthy();
    expect(screen.getByText("Removes the encrypted keys and local data from this browser. To restore, you'll need your recovery phrase.")).toBeTruthy();
    expect(document.querySelector('.s7-ring')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Never|\/ 100|Score|staking|Air-gap|App-lock timer|Immediately/);
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('the tasks open their pages (the popup closes); "Add a passkey" pushes the passkey screen', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Write down your recovery phrase'));
    expect(w.platform.opened).toEqual(['unlock.html?mode=reveal']);
    expect(w.platform.closed).toBe(1);
    await new Promise(r => setTimeout(r, 0));
    fireEvent.click(screen.getByText('Verify recovery phrase'));
    expect(w.platform.opened).toEqual(['unlock.html?mode=reveal', 'unlock.html?mode=verify']);
    fireEvent.click(screen.getByText('Add a passkey'));
    expect(w.calls.passkey).toBe(1);
  });

  it('35b all clear: "Looks great" / "All checks pass."; Active protections, every meta --success; no tasks', async () => {
    await shown({env: WITH_PASSKEY, before: async ext => ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 5})});
    expect(screen.getByText('Looks great')).toBeTruthy();
    expect(screen.getByText('All checks pass.')).toBeTruthy();
    expect(screen.queryByText('Outstanding tasks')).toBeNull();
    const protections = screen.getByText('Active protections').nextElementSibling as HTMLElement;
    expect([...protections.querySelectorAll('.s7-row')].map(r => [r.querySelector('.s7-title')?.textContent, r.querySelector('.s7-meta')?.textContent, r.querySelector('.s7-meta')?.classList.contains('noc-success')])).toEqual([
      ['Auto-lock', '5 min', true],
      ['Passkey', 'On', true],
      ['Recovery phrase verified', 'Yes', true],
    ]);
  });

  it('35c: the Auto-lock row opens its card — 1 / 5 / 15 / 60 min (D1), the current one selected, O47', async () => {
    await shown();
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    const card = document.querySelector('.app-picker-card') as HTMLElement;
    expect(within(card).getByText('When idle, lock the wallet after')).toBeTruthy();
    expect([...card.querySelectorAll('.opt')].map(o => [o.textContent, o.getAttribute('aria-pressed')])).toEqual([
      ['1 min', 'false'],
      ['5 min', 'true'],
      ['15 min', 'false'],
      ['60 min', 'false'],
    ]);
    expect(within(card).getByText('A longer time asks for your password in a new tab.')).toBeTruthy();
    expect(unstyledClasses(card, SELECTORS)).toEqual([]);
  });

  it('strengthening (1 min) is written at once and the meta follows; nothing opens', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    fireEvent.click(screen.getByRole('button', {name: '1 min'}));
    await waitFor(() => expect(meta('Auto-lock')?.textContent).toBe('1 min'));
    expect(await w.ext.local.get(SETTINGS_KEY)).toMatchObject({autoLockMinutes: 1});
    expect(w.platform.opened).toEqual([]);
  });

  it('weakening (15 min) opens #10 for the background’s challenge and closes; the stored value is unchanged', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    fireEvent.click(screen.getByRole('button', {name: '15 min'}));
    await waitFor(() => expect(w.platform.opened).toHaveLength(1));
    expect(w.platform.opened[0]).toMatch(/^unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    expect(w.platform.closed).toBe(1);
    expect(await w.ext.local.get(SETTINGS_KEY)).toBeUndefined();
  });

  it('the threshold card (D5): $50 / $100 / $500 / $1,000, O48–O50; $500 is a weakening', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Re-authentication threshold', {selector: '.s7-title'}));
    const card = document.querySelector('.app-picker-card') as HTMLElement;
    expect(within(card).getByText('Ask for your password before sends worth more than')).toBeTruthy();
    expect(within(card).getByText('A higher amount asks for your password in a new tab.')).toBeTruthy();
    expect([...card.querySelectorAll('.opt')].map(o => o.textContent)).toEqual(['$50', '$100', '$500', '$1,000']);
    fireEvent.click(within(card).getByRole('button', {name: '$500'}));
    await waitFor(() => expect(w.platform.opened[0]).toMatch(/mode=reauth/));
  });

  it('value not a preset: the stored value as the meta, no option selected', async () => {
    await shown({before: async ext => ext.local.set(SETTINGS_KEY, {autoLockMinutes: 7, reauthUsdCents: 25_000})});
    expect(meta('Auto-lock')?.textContent).toBe('7 min');
    expect(meta('Re-authentication threshold')?.textContent).toBe('$250');
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    expect(document.querySelectorAll('.app-picker-card .opt.sel')).toHaveLength(0);
  });

  it('setting failed: O51, and the picker keeps the stored value', async () => {
    const w = await setupWallet();
    const engine = {...w.engine, settingsSet: async () => ({ok: false as const, error: 'failed' as const})};
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Security onBack={() => undefined} onPasskey={() => undefined} onDelete={() => undefined} />
      </WalletProvider>,
    );
    fireEvent.click(await screen.findByText('Auto-lock', {selector: '.s7-title'}));
    fireEvent.click(screen.getByRole('button', {name: '1 min'}));
    expect(await screen.findByText('Could not save the setting. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', {name: '5 min'}).getAttribute('aria-pressed')).toBe('true');
  });

  it('rule 6: a second option click inside 500 ms writes nothing more', async () => {
    let sets = 0;
    await shown({gate: m => void ((m as {type: string}).type === 'settings.set' && sets++)});
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    const one = screen.getByRole('button', {name: '1 min'}) as HTMLButtonElement;
    fireEvent.click(one);
    one.disabled = false;
    fireEvent.click(one);
    await new Promise(r => setTimeout(r, 30));
    expect(sets).toBe(1);
  });

  it('Change password opens #36; the danger card’s [Delete wallet] pushes #37; Passkey pushes the passkey screen', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Change password'));
    expect(w.platform.opened).toEqual(['unlock.html?mode=password']);
    fireEvent.click(screen.getByRole('button', {name: 'Delete wallet'}));
    expect(w.calls.delete).toBe(1);
    fireEvent.click(screen.getByText('Passkey', {selector: '.s7-title'}));
    expect(w.calls.passkey).toBe(1);
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/Security.test.tsx
```
Expected (dry run, these test files on Task 15's tree): **red** — Test Files 1 failed (1) · the file fails to load (it imports what this task creates). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/App.tsx`:

````diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index 6339ab6..3d48e94 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -18,6 +18,7 @@ import {About} from './screens/About';
 import {Passkey} from './screens/Passkey';
 import {AccountsManager} from './screens/AccountsManager';
 import {DeleteWallet} from './screens/DeleteWallet';
+import {Security} from './screens/Security';
 import {Created} from './screens/Created';
 import {Imported} from './screens/Imported';
 import {Send} from './screens/Send';
@@ -263,6 +264,14 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
         }}
       />
     );
+  } else if (route.screen === 'security') {
+    screen = (
+      <Security
+        onBack={() => go({type: 'pop'})}
+        onPasskey={() => go({type: 'push', route: {screen: 'passkey'}})}
+        onDelete={() => go({type: 'push', route: {screen: 'delete'}})}
+      />
+    );
   } else if (route.screen === 'delete') {
     screen = <DeleteWallet onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'accounts') {
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index c9546af..8fd79c3 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1013,3 +1013,105 @@ a.btn {
 .app-delete .sticky-bar .btn-secondary:disabled {
   opacity: 0.45;
 }
+
+/* B1b-2b §4.1/§4.2: #31's and #35's rows — a meta tinted where the design tints it (the design's `.s7-row .s7-meta`
+   colour is two classes; a one-class .noc-* tone alone lost to it). */
+.s7-row .s7-meta.noc-warning {
+  color: var(--warning);
+}
+.s7-row .s7-meta.noc-success {
+  color: var(--success);
+}
+.app-content button.s7-task {
+  width: 100%;
+  text-align: start;
+  font: inherit;
+  color: inherit;
+  border: 0;
+  cursor: pointer;
+}
+/* A static row (#35's app-lock line, D2): no chevron column. */
+.s7-row.app-no-chev {
+  grid-template-columns: 28px 1fr;
+}
+/* #35 (index.html #s35's inline layout, as classes). C15: the score card without its ring is one column. */
+.app-security-body {
+  padding: 0 var(--space-5) var(--space-7);
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-4);
+}
+.app-security-body h3,
+.app-security-body p {
+  margin: 0;
+}
+.s7-score-card.no-ring {
+  grid-template-columns: 1fr;
+}
+.s7-score-card.no-ring .noc-h3 {
+  margin-bottom: 6px;
+}
+.app-overline {
+  margin-top: var(--space-2);
+}
+.app-picker-card {
+  background: var(--bg-surface-1);
+  border-radius: var(--radius-lg);
+  padding: var(--space-4);
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-3);
+}
+.app-picker-head {
+  display: flex;
+  align-items: center;
+  gap: var(--space-3);
+}
+.app-picker-head .s7-glyph {
+  color: var(--fg-secondary);
+  display: flex;
+}
+.app-picker-head .noc-caption {
+  margin-top: 2px;
+}
+/* ix:14647: picker options 32 px to the eye, 48 px to the pointer. */
+.s7-picker .opt.app-picker-opt {
+  position: relative;
+  border: 0;
+  background: transparent;
+  font-family: inherit;
+  cursor: pointer;
+  min-height: 32px;
+}
+.s7-picker .opt.sel.app-picker-opt {
+  background: var(--accent);
+}
+.s7-picker .opt.app-picker-opt::after {
+  content: '';
+  position: absolute;
+  inset: -8px 0;
+}
+.app-danger-overline {
+  margin-top: var(--space-5);
+}
+.app-danger-card {
+  background: color-mix(in oklab, var(--danger) 8%, var(--bg-surface-1));
+  border: 1px solid color-mix(in oklab, var(--danger) 30%, transparent);
+  border-radius: var(--radius-lg);
+  padding: var(--space-5);
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-3);
+}
+.app-danger-head {
+  display: flex;
+  align-items: center;
+  gap: var(--space-3);
+  color: var(--danger);
+}
+.btn.btn-secondary.app-danger-btn {
+  background: color-mix(in oklab, var(--danger) 12%, var(--bg-surface-2));
+  color: var(--danger);
+  border: 1px solid color-mix(in oklab, var(--danger) 30%, transparent);
+  align-self: flex-start;
+}
````

Create `extension/src/app/screens/Security.tsx`:

````tsx
import {useEffect, useState} from 'react';
import {useWallet} from '../WalletContext';
import {formatAmount} from '../../shared/amount';
import {reauthPage, type ExtensionPage} from '../platform';
import {TopBar} from '../ui/TopBar';
import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {Picker} from '../ui/Picker';
import type {Settings} from '../engine';

/** #35's copy (B1b-2b §4.2): the design's strings adapted where marked, D2/D4/D5's, and O47–O51. */
export const SECURITY_TEXT = {
  title: 'Security center',
  improve: 'Improve your security',
  outstanding: (n: number) => (n === 1 ? '1 outstanding task.' : `${n} outstanding tasks.`),
  great: 'Looks great',
  allPass: 'All checks pass.',
  tasks: 'Outstanding tasks',
  taskWrite: 'Write down your recovery phrase',
  taskVerify: 'Verify recovery phrase',
  taskPasskey: 'Add a passkey',
  protections: 'Active protections',
  autoLock: 'Auto-lock',
  passkey: 'Passkey',
  verified: 'Recovery phrase verified',
  yes: 'Yes',
  on: 'On',
  off: 'Off',
  locks: 'Locks',
  autoLockCaption: 'When idle, lock the wallet after',
  autoLockNote: 'A longer time asks for your password in a new tab.',
  appLock: 'Locks when the browser closes',
  threshold: 'Re-authentication threshold',
  thresholdCaption: 'Ask for your password before sends worth more than',
  thresholdNote: 'A higher amount asks for your password in a new tab.',
  changePassword: 'Change password',
  saveFailed: 'Could not save the setting. Try again.',
  danger: 'Danger zone',
  deleteTitle: 'Delete this wallet',
  deleteBody: "Removes the encrypted keys and local data from this browser. To restore, you'll need your recovery phrase.",
  deleteButton: 'Delete wallet',
  minutes: (n: number) => `${n} min`,
} as const;

/** D1: 1 / 5 / 15 / 60 minutes — no "Never" (the engine's range is 1–60, and a short lock is one of B1's few limits). */
export const AUTOLOCK_OPTIONS = [1, 5, 15, 60].map(value => ({value, label: SECURITY_TEXT.minutes(value)}));
/** D5: $50 / $100 / $500 / $1,000, in cents. */
export const THRESHOLD_OPTIONS = [5_000, 10_000, 50_000, 100_000].map(value => ({value, label: dollars(value)}));

/** "$100", "$1,000", "$12.50" — cents, exactly (no float). */
export function dollars(cents: number): string {
  return `$${formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2})}`;
}

/** The outstanding tasks, from real facts only (D3, D4, C8): the phrase not verified (both phrase rows), no passkey. */
export type SecurityTask = 'write' | 'verify' | 'passkey';
export function securityTasks(passkey: boolean, phraseVerifiedAt: number | null): SecurityTask[] {
  return [...(phraseVerifiedAt === null ? (['write', 'verify'] as const) : []), ...(passkey ? [] : (['passkey'] as const))];
}

/**
 * #35 security center (spec B1b-2b §4.2; D1–D5, C8, C15) in the popup. No score, no ring (D3, C15): the card says whether
 * anything is left to do. Outstanding tasks (35a) or Active protections (35b, the all-clear state only — review L7, as
 * drawn); Locks with the auto-lock and threshold pickers (35c: the row opens its card) and the static app-lock row (D2);
 * the danger zone (35d) → #37. A picker value BELOW the current one is written at once; one ABOVE weakens the wallet and
 * answers `reauth-required` — the vault tab's #10 confirms it and the background applies it (E9); the popup closes and
 * never shows a choice still waiting for #10: every open reads the stored value. Rule 6: LockedButton on every option and
 * every row that opens a page.
 */
export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onPasskey: () => void; onDelete: () => void}) {
  const m = useWallet();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState<'auto-lock' | 'threshold' | null>(null);
  const [failed, setFailed] = useState(false);
  const passkey = m.wallet?.passkey === true;

  useEffect(() => {
    let alive = true;
    void m.engine.settings().then(r => {
      if (alive && r.ok) setSettings(r.data);
    });
    return () => {
      alive = false;
    };
  }, [m.engine]);

  const openPage = (page: ExtensionPage | NonNullable<ReturnType<typeof reauthPage>>) => {
    m.platform.openPage(page);
    if (m.surface === 'popup') m.platform.closeWindow();
  };
  /** A picker choice: a strengthening is written; a weakening goes to #10 (E9, C1); anything else says so (O51). */
  const pick = async (key: 'autoLockMinutes' | 'reauthUsdCents', value: number) => {
    if (settings === null || settings[key] === value) return;
    setFailed(false);
    const r = await m.engine.settingsSet({[key]: value});
    if (r.ok) return setSettings(r.data);
    if (r.error === 'reauth-required') {
      const id = (r.data as {challengeId?: unknown} | undefined)?.challengeId;
      const page = typeof id === 'string' ? reauthPage(id) : null;
      if (page !== null) return openPage(page);
    }
    if (r.error === 'locked') return m.reload();
    setFailed(true);
  };

  if (settings === null) return <div className="screen" aria-busy="true" />;
  const tasks = securityTasks(passkey, settings.phraseVerifiedAt);
  const row = (icon: ExtIconName, title: string, meta: string | null, tone: 'warning' | 'success' | null, onPress: () => void, expanded?: boolean) => (
    <button type="button" className="s7-row" onClick={onPress} aria-expanded={expanded}>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className={tone === 'warning' ? 's7-meta noc-warning' : tone === 'success' ? 's7-meta noc-success' : 's7-meta'}>{meta}</span>
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </button>
  );
  const pageRow = (icon: ExtIconName, title: string, page: ExtensionPage) => (
    <LockedButton className="s7-row" onPress={() => openPage(page)}>
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">{title}</span>
      <span className="s7-meta" />
      <span className="s7-chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </LockedButton>
  );
  const task = (icon: ExtIconName, label: string, onPress: () => void) => (
    <button type="button" className="s7-task" onClick={onPress}>
      <ExtIcon name={icon} size={20} />
      <span className="label">{label}</span>
      <span className="chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </button>
  );

  return (
    <div className="screen">
      <TopBar title={SECURITY_TEXT.title} onBack={onBack} />
      <div className="app-security-body">
        <div className="s7-score-card no-ring">
          <div>
            <h3 className="noc-h3">{tasks.length === 0 ? SECURITY_TEXT.great : SECURITY_TEXT.improve}</h3>
            <p className="noc-body-sm app-muted">{tasks.length === 0 ? SECURITY_TEXT.allPass : SECURITY_TEXT.outstanding(tasks.length)}</p>
          </div>
        </div>

        {tasks.length > 0 ? (
          <>
            <p className="noc-overline app-dim app-overline">{SECURITY_TEXT.tasks}</p>
            <div className="s7-list">
              {tasks.includes('write') ? <LockedButtonTask icon="database" label={SECURITY_TEXT.taskWrite} onPress={() => openPage('unlock.html?mode=reveal')} /> : null}
              {tasks.includes('verify') ? <LockedButtonTask icon="shield-check" label={SECURITY_TEXT.taskVerify} onPress={() => openPage('unlock.html?mode=verify')} /> : null}
              {tasks.includes('passkey') ? task('fingerprint', SECURITY_TEXT.taskPasskey, onPasskey) : null}
            </div>
          </>
        ) : (
          <>
            <p className="noc-overline app-dim app-overline">{SECURITY_TEXT.protections}</p>
            <div className="s7-list">
              {row('lock', SECURITY_TEXT.autoLock, SECURITY_TEXT.minutes(settings.autoLockMinutes), 'success', () => setOpen(open === 'auto-lock' ? null : 'auto-lock'))}
              {row('fingerprint', SECURITY_TEXT.passkey, SECURITY_TEXT.on, 'success', onPasskey)}
              {row('shield-check', SECURITY_TEXT.verified, SECURITY_TEXT.yes, 'success', () => openPage('unlock.html?mode=verify'))}
            </div>
          </>
        )}

        <p className="noc-overline app-dim app-overline">{SECURITY_TEXT.locks}</p>
        <div className="s7-list">
          {row('lock', SECURITY_TEXT.autoLock, SECURITY_TEXT.minutes(settings.autoLockMinutes), null, () => setOpen(open === 'auto-lock' ? null : 'auto-lock'), open === 'auto-lock')}
          {open === 'auto-lock' ? (
            <div className="app-picker-card">
              <div className="app-picker-head">
                <span className="s7-glyph">
                  <ExtIcon name="lock" size={20} />
                </span>
                <div>
                  <div className="noc-body">{SECURITY_TEXT.autoLock}</div>
                  <div className="noc-caption app-dim">{SECURITY_TEXT.autoLockCaption}</div>
                </div>
              </div>
              <Picker label={SECURITY_TEXT.autoLock} options={AUTOLOCK_OPTIONS} value={settings.autoLockMinutes} onPick={v => pick('autoLockMinutes', v)} />
              <p className="noc-caption app-dim">{SECURITY_TEXT.autoLockNote}</p>
            </div>
          ) : null}
          <div className="s7-row app-static app-no-chev">
            <span className="s7-glyph">
              <ExtIcon name="zap" size={20} />
            </span>
            <span className="s7-title">{SECURITY_TEXT.appLock}</span>
          </div>
          {row('alert', SECURITY_TEXT.threshold, dollars(settings.reauthUsdCents), null, () => setOpen(open === 'threshold' ? null : 'threshold'), open === 'threshold')}
          {open === 'threshold' ? (
            <div className="app-picker-card">
              <div className="app-picker-head">
                <span className="s7-glyph">
                  <ExtIcon name="alert" size={20} />
                </span>
                <div>
                  <div className="noc-body">{SECURITY_TEXT.threshold}</div>
                  <div className="noc-caption app-dim">{SECURITY_TEXT.thresholdCaption}</div>
                </div>
              </div>
              <Picker label={SECURITY_TEXT.threshold} options={THRESHOLD_OPTIONS} value={settings.reauthUsdCents} onPick={v => pick('reauthUsdCents', v)} />
              <p className="noc-caption app-dim">{SECURITY_TEXT.thresholdNote}</p>
            </div>
          ) : null}
          {row('fingerprint', SECURITY_TEXT.passkey, passkey ? SECURITY_TEXT.on : SECURITY_TEXT.off, passkey ? 'success' : 'warning', onPasskey)}
          {pageRow('key', SECURITY_TEXT.changePassword, 'unlock.html?mode=password')}
        </div>
        {failed ? (
          <p className="field-msg noc-danger" role="alert">
            {SECURITY_TEXT.saveFailed}
          </p>
        ) : null}

        <p className="noc-overline noc-danger app-overline app-danger-overline">{SECURITY_TEXT.danger}</p>
        <div className="app-danger-card">
          <div className="app-danger-head">
            <ExtIcon name="alert-triangle" size={20} />
            <h3 className="noc-h3 noc-danger">{SECURITY_TEXT.deleteTitle}</h3>
          </div>
          <p className="noc-body-sm app-muted">{SECURITY_TEXT.deleteBody}</p>
          <button type="button" className="btn btn-secondary app-danger-btn" onClick={onDelete}>
            <ExtIcon name="trash" size={18} />
            {SECURITY_TEXT.deleteButton}
          </button>
        </div>
      </div>
    </div>
  );
}

/** An outstanding task that opens a vault page: a LockedButton (rule 6) in `.s7-task`'s chrome. */
function LockedButtonTask({icon, label, onPress}: {icon: ExtIconName; label: string; onPress: () => void}) {
  return (
    <LockedButton className="s7-task" onPress={onPress}>
      <ExtIcon name={icon} size={20} />
      <span className="label">{label}</span>
      <span className="chev">
        <ExtIcon name="chevron-right" size={16} />
      </span>
    </LockedButton>
  );
}
````

Modify `extension/src/app/ui/LockedButton.tsx`:

````diff
diff --git a/extension/src/app/ui/LockedButton.tsx b/extension/src/app/ui/LockedButton.tsx
index 6036b2b..9892887 100644
--- a/extension/src/app/ui/LockedButton.tsx
+++ b/extension/src/app/ui/LockedButton.tsx
@@ -18,6 +18,7 @@ export function LockedButton({
   disabled = false,
   label,
   keepFocus = false,
+  pressed,
   wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
 }: {
   onPress: () => Promise<unknown> | void;
@@ -31,6 +32,8 @@ export function LockedButton({
    * user moved elsewhere meanwhile is left where it is.
    */
   keepFocus?: boolean;
+  /** A toggle's state (aria-pressed): B1b-2b's picker options. */
+  pressed?: boolean;
   wait?: (ms: number) => Promise<void>;
 }) {
   const busy = useRef(false);
@@ -71,7 +74,7 @@ export function LockedButton({
     });
   };
   return (
-    <button ref={self} type="button" className={`${className}${locked ? ' is-busy' : ''}`} disabled={disabled || locked} aria-label={label} onClick={press}>
+    <button ref={self} type="button" className={`${className}${locked ? ' is-busy' : ''}`} disabled={disabled || locked} aria-label={label} aria-pressed={pressed} onClick={press}>
       {children}
     </button>
   );
````

Create `extension/src/app/ui/Picker.tsx`:

````tsx
import {LockedButton} from './LockedButton';

/**
 * #35's inline pill-picker (index.html #s35c: `.s7-picker` > `.opt`, the current one `.sel`). Each option is a
 * LockedButton (rule 6) with aria-pressed; a stored value that is no option selects none (§4.2 `value not a preset`).
 * The options are 32 px to the eye and 48 px to the pointer (ix:14647; app.css `.app-picker-opt`).
 */
export function Picker({options, value, onPick, label}: {options: readonly {value: number; label: string}[]; value: number; onPick: (v: number) => Promise<void>; label: string}) {
  return (
    <div className="s7-picker" role="group" aria-label={label}>
      {options.map(o => (
        <LockedButton key={o.value} className={o.value === value ? 'opt sel app-picker-opt' : 'opt app-picker-opt'} pressed={o.value === value} onPress={() => onPick(o.value)}>
          {o.label}
        </LockedButton>
      ))}
    </div>
  );
}
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/Security.test.tsx
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 1 passed (1) · Tests 12 passed (12); tsc clean; whole suite Test Files 133 passed (133) · Tests 2317 passed (2317); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  35a, 35b, 35c auto-lock expanded, threshold expanded, value not a preset, 35d danger zone — Task 20.

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M16a** — the phrase tasks follow the wrong fact — `extension/src/app/screens/Security.tsx`:

  ```diff
  - ...(phraseVerifiedAt === null ? (['write', 'verify'] as const) : [])
  + ...(phraseVerifiedAt !== null ? (['write', 'verify'] as const) : [])
  ```
  `timeout 300 npx vitest run src/app/__tests__/Security.test.tsx` — Expected: **red** (dry run: 4 failed (Playwright)).

- **M16b** — a weakening opens nothing — `extension/src/app/screens/Security.tsx`:

  ```diff
  - if (r.error === 'reauth-required') {
  + if (r.error === ('never' as string)) {
  ```
  `timeout 300 npx vitest run src/app/__tests__/Security.test.tsx` — Expected: **red** (dry run: 2 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/src/app/App.tsx extension/src/app/__tests__/Security.test.tsx extension/src/app/app.css extension/src/app/screens/Security.tsx extension/src/app/ui/LockedButton.tsx extension/src/app/ui/Picker.tsx
git commit -F - <<'MSG'
feat(extension): #35 security center: tasks or all-clear, auto-lock and threshold pickers (D1, D5), danger zone

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 17: #31 settings in full: Profile, Security center meta, Passkey, Change password + 36e, Recovery phrase, Lock now, Delete, About

**Spec:** §4.1, C8, C10, C15; O42–O46; 36e (ix:14856)

**Files:**
- Modify: `extension/e2e/visual.spec.ts`
- Modify: `extension/src/app/App.tsx`
- Modify: `extension/src/app/__tests__/Settings.test.tsx`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/screens/Settings.tsx`
- Modify: `extension/src/app/ui/ListRow.tsx`

**Interfaces:**
- Consumes: Tasks 13–16 (routes), Task 7 (`PASSWORD_TOAST_KEY`, `ExtensionPage`), Task 1 (`passwordChangedAt`, `phraseVerifiedAt`).
- Produces (exact signatures, as exported):
  - `export const SETTINGS_TEXT =`
  - `export const PASSWORD_TOAST_WINDOW_MS = 10 * 60_000;`
  - `export function Settings(`
  - `export function ListRow(`

#31's rows wired to Tasks 13–16 and the vault pages. 36e: when `passwordChangedAt` is within 10 minutes and this change has not been toasted yet (`PASSWORD_TOAST_KEY` remembers the stamp), "Password updated" shows for 1.8 s and the Change password row reads "Just updated" with the success border. The toast is `position: fixed` above the tab bar (the dry run's visual pass found the design's `absolute` placed it at the foot of the scrolled list, out of view). `ListRow` gains a `tone` for the meta.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/visual.spec.ts`:

````diff
diff --git a/extension/e2e/visual.spec.ts b/extension/e2e/visual.spec.ts
index 0e5d4d8..4a3c7ce 100644
--- a/extension/e2e/visual.spec.ts
+++ b/extension/e2e/visual.spec.ts
@@ -93,7 +93,8 @@ test('visual: the plan-1 screens and states at 412 × 600', async () => {
     }
 
     await p.getByRole('button', {name: 'Settings'}).click();
-    await expect(p.locator('.s7-row .s7-title')).toHaveText(['Accounts', 'Lock now', 'About Noctura']);
+    // B1b-2b plan 1 (#31 in full): the rows of every group; visual-settings.spec.ts shoots its states.
+    await expect(p.locator('.s7-row .s7-title')).toHaveText(['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Delete wallet', 'About Noctura']);
     await shot(p, '31-settings-minimal');
     await p.getByText('About Noctura').click();
     await expect(p.getByText('Solana wallet for your browser — your keys stay on this device.')).toBeVisible();
````

Modify `extension/src/app/__tests__/Settings.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Settings.test.tsx b/extension/src/app/__tests__/Settings.test.tsx
index 4b2f780..0501dab 100644
--- a/extension/src/app/__tests__/Settings.test.tsx
+++ b/extension/src/app/__tests__/Settings.test.tsx
@@ -5,29 +5,130 @@ import {renderApp} from './appHarness';
 import {setupWallet} from './harness';
 import {App} from '../App';
 import {getSession} from '../../background/session';
+import {SETTINGS_KEY} from '../../background/settings';
+import {base64} from '@scure/base';
+import {Settings} from '../screens/Settings';
+import {WalletProvider} from '../WalletContext';
+import {ENV} from './harness';
+import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
 
-// Spec §6.1: the minimal Settings tab and #38 about.
-async function openSettings() {
-  const r = await renderApp();
+const SELECTORS = selectorsOf(UI_SHEETS);
+const B = (n: number) => base64.encode(new Uint8Array(n).fill(1));
+const WITH_PASSKEY = {...ENV, passkey: {credentialId: B(16), prfSalt: B(32), wrapped: B(40)}};
+const noop = () => undefined;
+
+// B1b-2b §4.1: the full #31 (the 2a minimal tab's rows kept: Lock now, About) and #38 about.
+async function openSettings(o: Parameters<typeof renderApp>[0] = {}) {
+  const r = await renderApp(o);
   await screen.findByText('TOKENS');
   fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
   await screen.findByRole('heading', {name: 'Settings'});
   return r;
 }
 
-describe('Settings (minimal)', () => {
-  it('three groups: Accounts (with the count), Lock now, About Noctura (with the version); nothing else of #31', async () => {
+describe('Settings (#31, B1b-2b §4.1)', () => {
+  it('the groups and rows the extension has (D22): Account › Profile; Security › Security center, Passkey, Change password, Recovery phrase, Lock now; Advanced › Delete wallet; About', async () => {
     await openSettings();
-    expect(screen.getAllByText(/^(Account|Security|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'About']);
-    expect(screen.getByText('2 accounts')).toBeTruthy();
+    expect(screen.getAllByText(/^(Account|Security|Advanced|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'Advanced', 'About']);
+    expect([...document.querySelectorAll('.s7-row .s7-title')].map(e => e.textContent)).toEqual([
+      'Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Delete wallet', 'About Noctura',
+    ]);
     expect(screen.getByText('v0.1.0')).toBeTruthy();
-    for (const gone of ['Currency', 'Notifications', 'Change password', 'Backup', 'Delete wallet', 'Connections', 'Advanced']) expect(screen.queryByText(gone)).toBeNull();
+    for (const gone of ['Currency', 'Notifications', 'Material You accent', 'RPC endpoint', 'Connected dApps', 'Air-gap signing', 'Export transaction history', 'Diagnostics', 'Backup & restore', 'Biometric unlock', 'Change PIN', 'Address book', 'Accounts']) {
+      expect(screen.queryByText(gone)).toBeNull();
+    }
+    expect(document.querySelector('.s7-row.danger .s7-title')?.textContent).toBe('Delete wallet');
+  });
+
+  it('31a, no passkey: the tip (O42), Profile = the selected account, "3 to do" and "Off" in --warning, "Not verified"', async () => {
+    await openSettings();
+    expect(document.querySelector('.s7-tip p')?.textContent).toBe('Tip — add a passkey to unlock with your fingerprint, face or security key. Your password always works too.');
+    const meta = (t: string) => screen.getByText(t, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
+    expect(meta('Profile')?.textContent).toBe('Main');
+    await waitFor(() => expect(meta('Security center')?.textContent).toBe('3 to do'));
+    expect(meta('Security center')?.classList.contains('noc-warning')).toBe(true);
+    expect(meta('Passkey')?.textContent).toBe('Off');
+    expect(meta('Passkey')?.classList.contains('noc-warning')).toBe(true);
+    expect(meta('Recovery phrase')?.textContent).toBe('Not verified');
+    expect(meta('Recovery phrase')?.classList.contains('noc-warning')).toBe(true);
+    expect(unstyledClasses(document.querySelector('.app-content .screen')!, SELECTORS)).toEqual([]);
   });
 
-  it('Accounts opens the switcher', async () => {
+  it('passkey on and the phrase verified: no tip; "All done" in --success, "On", "Verified" in --fg-secondary', async () => {
+    await openSettings({env: WITH_PASSKEY, before: async ext => ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 1})});
+    const meta = (t: string) => screen.getByText(t, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
+    await waitFor(() => expect(meta('Security center')?.textContent).toBe('All done'));
+    expect(meta('Security center')?.classList.contains('noc-success')).toBe(true);
+    expect(meta('Passkey')?.textContent).toBe('On');
+    expect(meta('Recovery phrase')?.textContent).toBe('Verified');
+    expect(meta('Recovery phrase')?.className).toBe('s7-meta');
+    expect(document.querySelector('.s7-tip')).toBeNull();
+  });
+
+  it('the rows go where §4.1 says: Profile → the accounts manager; Security center → #35; Passkey → the passkey screen; Delete wallet → #37', async () => {
     await openSettings();
-    fireEvent.click(screen.getByText('Accounts'));
-    expect(await screen.findByRole('dialog', {name: 'Accounts'})).toBeTruthy();
+    fireEvent.click(screen.getByText('Profile'));
+    expect(await screen.findByRole('button', {name: 'Move Main down'})).toBeTruthy();
+    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
+    fireEvent.click(await screen.findByText('Security center'));
+    expect(await screen.findByText('Locks')).toBeTruthy();
+    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
+    fireEvent.click(await screen.findByText('Passkey', {selector: '.s7-title'}));
+    expect(await screen.findByRole('heading', {name: 'Unlock Noctura with a passkey'})).toBeTruthy();
+    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
+    fireEvent.click(await screen.findByText('Delete wallet', {selector: '.s7-title'}));
+    expect(await screen.findByText('Delete this wallet?')).toBeTruthy();
+  });
+
+  it('Change password and Recovery phrase open their vault pages and the popup closes', async () => {
+    const w = await openSettings();
+    fireEvent.click(screen.getByText('Change password'));
+    expect(w.platform.opened).toEqual(['unlock.html?mode=password']);
+    expect(w.platform.closed).toBe(1);
+    fireEvent.click(screen.getByText('Recovery phrase'));
+    expect(w.platform.opened).toEqual(['unlock.html?mode=password', 'unlock.html?mode=reveal']);
+  });
+
+  it('36e (C10): a password changed in the last ten minutes — the toast and "Just updated" once; the next open shows neither', async () => {
+    localStorage.clear();
+    const now = Date.now();
+    const settings = {passwordChangedAt: now - 60_000};
+    const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, settings)});
+    const {unmount} = render(
+      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} toastMs={40} decorateMs={80} />
+      </WalletProvider>,
+    );
+    expect(await screen.findByText('Password updated')).toBeTruthy();
+    const row = screen.getByText('Change password').closest('.s7-row');
+    expect(row?.classList.contains('app-just-updated')).toBe(true);
+    expect(row?.querySelector('.s7-meta')?.textContent).toBe('Just updated');
+    expect(row?.querySelector('.s7-meta')?.classList.contains('noc-success')).toBe(true);
+    expect(unstyledClasses(document.querySelector('.s7-toast')!, SELECTORS)).toEqual([]);
+    await waitFor(() => expect(screen.queryByText('Password updated')).toBeNull());
+    await waitFor(() => expect(screen.getByText('Change password').closest('.s7-row')?.classList.contains('app-just-updated')).toBe(false));
+    unmount();
+    render(
+      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+      </WalletProvider>,
+    );
+    await screen.findByText('Change password');
+    await new Promise(r => setTimeout(r, 30));
+    expect(screen.queryByText('Password updated')).toBeNull();
+  });
+
+  it('36e: a change older than ten minutes shows nothing', async () => {
+    localStorage.clear();
+    const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() - 11 * 60_000})});
+    render(
+      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+      </WalletProvider>,
+    );
+    await screen.findByText('Change password');
+    await new Promise(r => setTimeout(r, 30));
+    expect(screen.queryByText('Password updated')).toBeNull();
   });
 
   it('Lock now locks the wallet and shows the locked screen', async () => {
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/Settings.test.tsx
```
Expected (dry run, these test files on Task 16's tree): **red** — Test Files 1 failed (1) · Tests 7 failed. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/App.tsx`:

````diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index 3d48e94..0b2d0ce 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -191,7 +191,16 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
         />
       );
     } else {
-      screen = <Settings onAccounts={() => setAccounts(true)} onAbout={() => go({type: 'push', route: {screen: 'about'}})} />;
+      // C16: #31's Profile opens the accounts manager; the switcher stays on #11's avatar.
+      screen = (
+        <Settings
+          onProfile={() => go({type: 'push', route: {screen: 'accounts'}})}
+          onSecurity={() => go({type: 'push', route: {screen: 'security'}})}
+          onPasskey={() => go({type: 'push', route: {screen: 'passkey'}})}
+          onDelete={() => go({type: 'push', route: {screen: 'delete'}})}
+          onAbout={() => go({type: 'push', route: {screen: 'about'}})}
+        />
+      );
     }
   } else if (route.screen === 'receive') {
     screen = <Receive onBack={() => go({type: 'pop'})} />;
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 8fd79c3..62f067a 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1115,3 +1115,27 @@ a.btn {
   border: 1px solid color-mix(in oklab, var(--danger) 30%, transparent);
   align-self: flex-start;
 }
+
+/* B1b-2b §4.1: #31's Delete wallet row tints its chevron too (31c, inline in the mockup). */
+.s7-row.danger .s7-chev {
+  color: var(--danger);
+}
+/* 36e on #31 (ix:14856): the Change password row with a 30 % success border, a 6 % success fill, its glyph in success. */
+.s7-row.app-just-updated {
+  border: 1px solid color-mix(in oklab, var(--success) 30%, transparent);
+  background: color-mix(in oklab, var(--success) 6%, var(--bg-surface-1));
+}
+.s7-row.app-just-updated .s7-glyph {
+  color: var(--success);
+}
+/*
+ * 36e's toast (`.s7-toast`, 1.8 s) above the popup's 80 px tab bar. Fixed, not the design's absolute: the
+ * screen grows with its content inside the scrolling region, so an absolute toast sat at the foot of the
+ * whole list, out of view (found by the plan's visual pass). The popup is the viewport (412 × 600) and the
+ * tab's column is 100vh, so the viewport's foot is the app's foot in both.
+ */
+.s7-toast.app-settings-toast {
+  position: fixed;
+  bottom: calc(80px + var(--space-4));
+  z-index: 2;
+}
````

Modify `extension/src/app/screens/Settings.tsx`:

````diff
diff --git a/extension/src/app/screens/Settings.tsx b/extension/src/app/screens/Settings.tsx
index 836633f..9582a58 100644
--- a/extension/src/app/screens/Settings.tsx
+++ b/extension/src/app/screens/Settings.tsx
@@ -1,44 +1,165 @@
-import {useState} from 'react';
+import {useEffect, useState} from 'react';
 import {useWallet} from '../WalletContext';
+import {PASSWORD_TOAST_KEY, readPref, writePref} from '../prefs';
+import type {ExtensionPage} from '../platform';
 import {ListRow} from '../ui/ListRow';
 import {LockedButton} from '../ui/LockedButton';
-import {ExtIcon} from '../ui/ExtIcon';
+import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
+import {securityTasks} from './Security';
+import type {Settings as StoredSettings} from '../engine';
+
+/** #31's copy (B1b-2b §4.1): the design's strings adapted where marked, 2a's, and O42–O46. */
+export const SETTINGS_TEXT = {
+  title: 'Settings',
+  tipLead: 'Tip',
+  tipBody: ' — add a passkey to unlock with your fingerprint, face or security key. Your password always works too.',
+  account: 'Account',
+  profile: 'Profile',
+  security: 'Security',
+  securityCenter: 'Security center',
+  toDo: (n: number) => `${n} to do`,
+  allDone: 'All done',
+  passkey: 'Passkey',
+  on: 'On',
+  off: 'Off',
+  changePassword: 'Change password',
+  justUpdated: 'Just updated',
+  passwordUpdated: 'Password updated',
+  recoveryPhrase: 'Recovery phrase',
+  notVerified: 'Not verified',
+  verified: 'Verified',
+  lockNow: 'Lock now',
+  lockFailed: 'Could not lock the wallet. Try again.',
+  advanced: 'Advanced',
+  deleteWallet: 'Delete wallet',
+  about: 'About',
+  aboutNoctura: 'About Noctura',
+} as const;
+
+/** C10: 36e shows on #31's next open within this long of the change, once per change. */
+export const PASSWORD_TOAST_WINDOW_MS = 10 * 60_000;
 
 /**
- * The minimal Settings tab (spec §6.1): Accounts, Lock now, About. Everything else on #31 is
- * B1b-2b's by the owner's decision (profile, currency, notifications, security centre, passkeys,
- * change password, backup, RPC, connections, advanced, delete wallet).
+ * #31 settings (spec B1b-2b §4.1; D7, D22, C10, C16) — the popup's Settings tab root (2a §6.1: no back arrow). Account:
+ * Profile → the accounts manager (meta: the selected account's name). Security: Security center (meta: the tasks left,
+ * from #35's facts), Passkey (On / Off), Change password and Recovery phrase (vault-tab pages; the popup closes), and 2a's
+ * Lock now. Advanced: Delete wallet → #37. About. The tip (O42) is a passkey suggestion shown only while there is none
+ * (D22). 36e (C10): within ten minutes of a change the background recorded (`passwordChangedAt`), the first open shows
+ * the "Password updated" toast (1.8 s) and the row's "Just updated" decoration (5 s), once per change (a UI pref keeps
+ * the timestamp shown). Every row that opens a page is a LockedButton (rule 6). The rows #31 draws and the extension does
+ * not have are omitted (D22; the spec's Differs list).
  */
-export function Settings({onAccounts, onAbout}: {onAccounts: () => void; onAbout: () => void}) {
+export function Settings({
+  onProfile,
+  onSecurity,
+  onPasskey,
+  onDelete,
+  onAbout,
+  toastMs = 1_800,
+  decorateMs = 5_000,
+}: {
+  onProfile: () => void;
+  onSecurity: () => void;
+  onPasskey: () => void;
+  onDelete: () => void;
+  onAbout: () => void;
+  toastMs?: number;
+  decorateMs?: number;
+}) {
   const m = useWallet();
-  const n = m.wallet?.accounts.length ?? 0;
   const [lockFailed, setLockFailed] = useState(false);
-  // Rule 7, a controller ruling (review fix round 1 #6): Lock now never fails silently. The line awaits
-  // the owner's copy (spec §6.1). On success this screen is replaced by the locked one.
+  const [stored, setStored] = useState<StoredSettings | null>(null);
+  const [toast, setToast] = useState(false);
+  const [decorated, setDecorated] = useState(false);
+  const passkey = m.wallet?.passkey === true;
+
+  useEffect(() => {
+    let alive = true;
+    const timers: ReturnType<typeof setTimeout>[] = [];
+    void m.engine.settings().then(r => {
+      if (!alive || !r.ok) return;
+      setStored(r.data);
+      const at = r.data.passwordChangedAt;
+      if (at === null || m.now() - at > PASSWORD_TOAST_WINDOW_MS || readPref(PASSWORD_TOAST_KEY) === String(at)) return;
+      writePref(PASSWORD_TOAST_KEY, String(at));
+      setToast(true);
+      setDecorated(true);
+      timers.push(setTimeout(() => alive && setToast(false), toastMs));
+      timers.push(setTimeout(() => alive && setDecorated(false), decorateMs));
+    });
+    return () => {
+      alive = false;
+      for (const t of timers) clearTimeout(t);
+    };
+  }, [m.engine]);
+
+  // Rule 7, a controller ruling (2a review fix round 1 #6): Lock now never fails silently.
   const lockNow = async () => {
     setLockFailed(false);
     if (!(await m.lock())) setLockFailed(true);
   };
+  const open = (page: ExtensionPage) => {
+    m.platform.openPage(page);
+    if (m.surface === 'popup') m.platform.closeWindow();
+  };
+  const tasks = stored === null ? null : securityTasks(passkey, stored.phraseVerifiedAt).length;
+  const pageRow = (icon: ExtIconName, title: string, page: ExtensionPage, meta: {text: string; tone: 'warning' | 'success' | null} | null, justUpdated = false) => (
+    <LockedButton className={justUpdated ? 's7-row app-just-updated' : 's7-row'} onPress={() => open(page)}>
+      <span className="s7-glyph">
+        <ExtIcon name={icon} size={20} />
+      </span>
+      <span className="s7-title">{title}</span>
+      <span className={meta?.tone === 'warning' ? 's7-meta noc-warning' : meta?.tone === 'success' ? 's7-meta noc-success' : 's7-meta'}>{meta?.text ?? ''}</span>
+      <span className="s7-chev">
+        <ExtIcon name="chevron-right" size={16} />
+      </span>
+    </LockedButton>
+  );
+
   return (
     <div className="screen">
       <div className="s-vi-top">
         <div className="left">
-          <h1 className="noc-h1">Settings</h1>
+          <h1 className="noc-h1">{SETTINGS_TEXT.title}</h1>
         </div>
       </div>
       <div className="app-settings-body">
-        <div className="s7-group-label">Account</div>
+        {m.wallet !== null && !passkey ? (
+          <div className="s7-tip">
+            <ExtIcon name="info" size={18} />
+            <p>
+              <b>{SETTINGS_TEXT.tipLead}</b>
+              {SETTINGS_TEXT.tipBody}
+            </p>
+          </div>
+        ) : null}
+        <div className="s7-group-label">{SETTINGS_TEXT.account}</div>
         <div className="s7-list">
-          <ListRow icon="settings" title="Accounts" meta={`${n} ${n === 1 ? 'account' : 'accounts'}`} onPress={onAccounts} />
+          <ListRow icon="user" title={SETTINGS_TEXT.profile} meta={m.account?.name ?? ''} onPress={onProfile} />
         </div>
-        <div className="s7-group-label">Security</div>
+        <div className="s7-group-label">{SETTINGS_TEXT.security}</div>
         <div className="s7-list">
+          <ListRow
+            icon="shield-check"
+            title={SETTINGS_TEXT.securityCenter}
+            meta={tasks === null ? '' : tasks === 0 ? SETTINGS_TEXT.allDone : SETTINGS_TEXT.toDo(tasks)}
+            tone={tasks === null ? undefined : tasks === 0 ? 'success' : 'warning'}
+            onPress={onSecurity}
+          />
+          <ListRow icon="fingerprint" title={SETTINGS_TEXT.passkey} meta={passkey ? SETTINGS_TEXT.on : SETTINGS_TEXT.off} tone={passkey ? undefined : 'warning'} onPress={onPasskey} />
+          {pageRow('key', SETTINGS_TEXT.changePassword, 'unlock.html?mode=password', decorated ? {text: SETTINGS_TEXT.justUpdated, tone: 'success'} : null, decorated)}
+          {pageRow(
+            'database',
+            SETTINGS_TEXT.recoveryPhrase,
+            'unlock.html?mode=reveal',
+            stored === null ? null : stored.phraseVerifiedAt === null ? {text: SETTINGS_TEXT.notVerified, tone: 'warning'} : {text: SETTINGS_TEXT.verified, tone: null},
+          )}
           {/* Rule 6 (§7.6): "Lock now" is a LockedButton — one lock per tap, 500 ms floor. */}
           <LockedButton className="s7-row" onPress={lockNow}>
             <span className="s7-glyph">
               <ExtIcon name="lock" size={20} />
             </span>
-            <span className="s7-title">Lock now</span>
+            <span className="s7-title">{SETTINGS_TEXT.lockNow}</span>
             <span className="s7-meta" />
             <span className="s7-chev">
               <ExtIcon name="chevron-right" size={16} />
@@ -47,14 +168,24 @@ export function Settings({onAccounts, onAbout}: {onAccounts: () => void; onAbout
         </div>
         {lockFailed ? (
           <p className="field-msg noc-danger" role="alert">
-            Could not lock the wallet. Try again.
+            {SETTINGS_TEXT.lockFailed}
           </p>
         ) : null}
-        <div className="s7-group-label">About</div>
+        <div className="s7-group-label">{SETTINGS_TEXT.advanced}</div>
         <div className="s7-list">
-          <ListRow icon="info" title="About Noctura" meta={<span className="noc-mono">v{m.platform.version()}</span>} onPress={onAbout} />
+          <ListRow icon="trash" title={SETTINGS_TEXT.deleteWallet} onPress={onDelete} danger />
+        </div>
+        <div className="s7-group-label">{SETTINGS_TEXT.about}</div>
+        <div className="s7-list">
+          <ListRow icon="info" title={SETTINGS_TEXT.aboutNoctura} meta={<span className="noc-mono noc-caption">v{m.platform.version()}</span>} onPress={onAbout} />
         </div>
       </div>
+      {toast ? (
+        <div className="s7-toast app-settings-toast" role="status" aria-live="polite">
+          <ExtIcon name="check" size={16} />
+          <span>{SETTINGS_TEXT.passwordUpdated}</span>
+        </div>
+      ) : null}
     </div>
   );
 }
````

Modify `extension/src/app/ui/ListRow.tsx`:

````diff
diff --git a/extension/src/app/ui/ListRow.tsx b/extension/src/app/ui/ListRow.tsx
index e8fa07f..d3ce018 100644
--- a/extension/src/app/ui/ListRow.tsx
+++ b/extension/src/app/ui/ListRow.tsx
@@ -1,15 +1,32 @@
 import type {ReactNode} from 'react';
 import {ExtIcon, type ExtIconName} from './ExtIcon';
 
-/** The design's settings row (`.s7-row`, 56 px): glyph, title, meta, chevron — one button. */
-export function ListRow({icon, title, meta, onPress, danger = false}: {icon: ExtIconName; title: string; meta?: ReactNode; onPress: () => void; danger?: boolean}) {
+/**
+ * The design's settings row (`.s7-row`, 56 px): glyph, title, meta, chevron — one button. `tone`: the meta in
+ * --warning or --success where the design tints it (#31, #35); `danger`: the design's destructive row (#31c).
+ */
+export function ListRow({
+  icon,
+  title,
+  meta,
+  onPress,
+  danger = false,
+  tone,
+}: {
+  icon: ExtIconName;
+  title: string;
+  meta?: ReactNode;
+  onPress: () => void;
+  danger?: boolean;
+  tone?: 'warning' | 'success';
+}) {
   return (
-    <button type="button" className={`s7-row${danger ? ' danger' : ''}`} onClick={onPress}>
+    <button type="button" className={danger ? 's7-row danger' : 's7-row'} onClick={onPress}>
       <span className="s7-glyph">
         <ExtIcon name={icon} size={20} />
       </span>
       <span className="s7-title">{title}</span>
-      <span className="s7-meta">{meta}</span>
+      <span className={tone === 'warning' ? 's7-meta noc-warning' : tone === 'success' ? 's7-meta noc-success' : 's7-meta'}>{meta}</span>
       <span className="s7-chev">
         <ExtIcon name="chevron-right" size={16} />
       </span>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/Settings.test.tsx
npx tsc --noEmit && npx vitest run
npm run gates
```
Expected (dry run): own tests Test Files 1 passed (1) · Tests 14 passed (14); tsc clean; whole suite Test Files 133 passed (133) · Tests 2322 passed (2322); gates green.

- [ ] **Step 5: Copy and visual checklist (§8.4).** The copy above is the O-list's and the design's, verbatim, and the component tests assert each string. Every state below is shot in Task 20 and reviewed against index.html with §8.4's checklist (layout, type scale, tokens, spacing, the sticky bars, focus rings, the 412 px column):

  31a default (no passkey), 31a passkey on + verified, 31c scrolled to Advanced, 36e toast (paused clock) — Task 20.

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M17a** — 36e outside its 10-minute window — `extension/src/app/screens/Settings.tsx`:

  ```diff
  - m.now() - at > PASSWORD_TOAST_WINDOW_MS || 
  + (deleted)
  ```
  `timeout 300 npx vitest run src/app/__tests__/Settings.test.tsx` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M17b** — 36e every time, not once — `extension/src/app/screens/Settings.tsx`:

  ```diff
  - readPref(PASSWORD_TOAST_KEY) === String(at)
  + false
  ```
  `timeout 300 npx vitest run src/app/__tests__/Settings.test.tsx` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 7: Commit.**

```bash
git add extension/e2e/visual.spec.ts extension/src/app/App.tsx extension/src/app/__tests__/Settings.test.tsx extension/src/app/app.css extension/src/app/screens/Settings.tsx extension/src/app/ui/ListRow.tsx
git commit -F - <<'MSG'
feat(extension): #31 settings in full: Profile, Security center meta, Passkey, Change password + 36e, Recovery phrase, Lock now, Delete, About

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 18: E2E part 1: the PRF probe (first), spec 14 (change password), spec 16 (reveal + verify), CSP over the new modes

**Spec:** §8.3 specs 14 and 16, §11 item 9 (PRF)

**Files:**
- Modify: `extension/e2e/csp.spec.ts`
- Modify: `extension/e2e/makeEnvelope.ts`
- Modify: `extension/e2e/onboarding.spec.ts`
- Create: `extension/e2e/passkeyProbe.spec.ts`
- Create: `extension/e2e/settings.spec.ts`
- Create: `extension/e2e/virtualAuthenticator.ts`

**Interfaces:**
- Consumes: Tasks 8–17 (everything they drive); `launchPopup`, `contained`, `seedUnlockedWallet` (`e2e/popupHarness.ts`); the fake coordinator.
- Produces (exact signatures, as exported):
  - `export const E2E_ACCOUNTS = ['HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb', '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm'] as const;`
  - `export function makeEnvelope(o: {accounts?: 1 | 2 | 3} = {})`
  - `export async function addPrfAuthenticator(ctx: BrowserContext, page: Page): Promise<string>`
  - `export async function withAuthenticatorFocus(page: Page, act: () => Promise<void>): Promise<void>`

**The PRF probe is the first E2E task** (§11 item 9; Playwright may run the spec files in any order — both the probe and spec 14 fail loudly, never skip, so the order does not matter): the pinned Chromium's CDP virtual authenticator (`ctap2`, internal, resident key, UV, `hasPrf: true`) is asked for `create()` and `get()` with RP ID `wallet.noc-tura.io` inside the contained browser (the RP ID is resolved by nothing — `--host-resolver-rules` keeps it local) and must return a 32-byte PRF output. **Dry-run outcome: it does, in a normal launch and under `unshare -rn`.** If a future Chromium drops PRF from the virtual authenticator, the probe and spec 14's passkey steps **fail** — they never skip (mutation M18a/M18b prove it). Spec 14: wrong → right → same → new → mismatch → confirm; only the salt and the wrap changed in storage; 36e once; the old password fails, the new one and the passkey unlock. Spec 16: proof → modal → hold → words → "Still looking?" with no word in the DOM; Ctrl+C refused; → the check → verified; #35 all clear. `csp.spec` loads every new mode with zero CSP violations. `makeEnvelope` builds 1, 2 or 3 accounts. **Focus (review M2):** Chromium checks WebAuthn focus in the browser, and every popup or tab the test opens takes it; `withAuthenticatorFocus(page, act)` brings the tab to the front immediately before every action that drives `create()` or `get()` (`#pm-act` for add/replace, `#unl-passkey`), and `addPrfAuthenticator` does so at creation. Spec 16's Ctrl+C probe relies on `#seed-grid`'s `tabindex="0"` keeping the focus (review L7, stated in the spec's comment).

- [ ] **Step 1: Write the specs and their helpers.**

Modify `extension/e2e/csp.spec.ts`:

````diff
diff --git a/extension/e2e/csp.spec.ts b/extension/e2e/csp.spec.ts
index ea9c2dc..44be8b8 100644
--- a/extension/e2e/csp.spec.ts
+++ b/extension/e2e/csp.spec.ts
@@ -106,6 +106,19 @@ test('csp: every vault-page mode runs with zero CSP violations; an inline style
     await p.goto(`${base}?mode=verify`);
     await expect(p.locator('#pp-title')).toHaveText('Verify your recovery phrase');
     await clean('verify');
+    // B1b-2b §3.1–§3.3: #36, #37's proof and the passkey actions.
+    await p.goto(`${base}?mode=password`);
+    await expect(p.locator('#cp-title')).toHaveText('Enter current password');
+    await clean('password');
+    await p.goto(`${base}?mode=delete`);
+    await expect(p.locator('#dl-address .addr-groups')).toBeVisible();
+    await clean('delete');
+    await p.goto(`${base}?mode=passkey&op=add`);
+    await expect(p.locator('#pm-title')).toHaveText('Unlock Noctura with a passkey');
+    await clean('passkey, add');
+    await p.goto(`${base}?mode=passkey&op=remove`);
+    await expect(p.locator('#pm-title')).toHaveText('Remove your passkey');
+    await clean('passkey, remove');
 
     // #10 with a live challenge: a send of 2.48 of the fake's 10 SOL to a new address.
     let challengeId: string | null = null;
@@ -141,7 +154,7 @@ test('csp: every vault-page mode runs with zero CSP violations; an inline style
     await expect(p.locator('#imp-phrase')).toBeVisible();
     await clean('import');
 
-    expect(seen).toHaveLength(11);
+    expect(seen).toHaveLength(15);
 
     // The positive control, on the same page and watch: an inline <style> and a remote <img> are both refused and reported.
     await p.evaluate(src => {
````

Modify `extension/e2e/makeEnvelope.ts`:

````diff
diff --git a/extension/e2e/makeEnvelope.ts b/extension/e2e/makeEnvelope.ts
index 64a0a05..5446136 100644
--- a/extension/e2e/makeEnvelope.ts
+++ b/extension/e2e/makeEnvelope.ts
@@ -3,12 +3,12 @@ import {argon2idKdf} from '../src/vault/kdf';
 
 export const E2E_PASSWORD = 'correct horse battery staple';
 export const E2E_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
-/** E2E_MNEMONIC's SLIP-0010 accounts 0 and 1 (derived once with src/vault/accounts.ts; written here so the E2E imports no core/ code). */
-export const E2E_ACCOUNTS = ['HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'] as const;
+/** E2E_MNEMONIC's SLIP-0010 accounts 0, 1 and 2 (derived once with src/vault/accounts.ts; written here so the E2E imports no core/ code). */
+export const E2E_ACCOUNTS = ['HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb', '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm'] as const;
 
-/** A real envelope at production parameters — the E2E exercises the real cost. One account, or the two of E2E_ACCOUNTS. */
-export function makeEnvelope(o: {accounts?: 1 | 2} = {}) {
-  const names = ['Account 1', 'Savings'];
+/** A real envelope at production parameters — the E2E exercises the real cost. The first one, two or three of E2E_ACCOUNTS. */
+export function makeEnvelope(o: {accounts?: 1 | 2 | 3} = {}) {
+  const names = ['Account 1', 'Savings', 'Account 3'];
   return createEnvelope({
     mnemonic: E2E_MNEMONIC,
     password: E2E_PASSWORD,
````

Modify `extension/e2e/onboarding.spec.ts`:

````diff
diff --git a/extension/e2e/onboarding.spec.ts b/extension/e2e/onboarding.spec.ts
index f005c1b..4d58401 100644
--- a/extension/e2e/onboarding.spec.ts
+++ b/extension/e2e/onboarding.spec.ts
@@ -80,7 +80,7 @@ test('2 · import: #8 paste → the scheme detected (slip10, accounts 0 … the
     h.fake.lamports.set(E2E_ACCOUNTS[0], 10_000_000_000);
     h.fake.lamports.set(E2E_ACCOUNTS[1], 2_500_000_000);
     const {vault, ...detected} = await importDetected(h);
-    expect(detected).toEqual({scheme: 'slip10', accounts: [...E2E_ACCOUNTS]});
+    expect(detected).toEqual({scheme: 'slip10', accounts: E2E_ACCOUNTS.slice(0, 2)});
     await expect(vault.getByText('2 accounts · 1 token recovered.')).toBeVisible();
     await expect(vault.locator('.s8-token-row .amt')).toHaveText(['12.5000']);
     await expect(vault.locator('.s8-token-row .sec')).toHaveText(['Solana · 2 accounts']);
````

Create `extension/e2e/passkeyProbe.spec.ts`:

````ts
import {test, expect} from '@playwright/test';
import {rmSync} from 'node:fs';
import {containNocTura, containSolscan, expectContained, launchContained} from './launch';
import {addPrfAuthenticator} from './virtualAuthenticator';

// B1b-2b §11 item 9 (spec §8.3, M3): plan 1's FIRST E2E task — does the pinned Chromium's virtual authenticator give PRF
// output to the extension, with RP ID wallet.noc-tura.io, in the contained browser (the host unresolvable)? Spec 14's
// passkey steps depend on it; if this fails they FAIL — never skip — and the plan reports it.
test('the PRF probe: create() + get() with RP ID wallet.noc-tura.io return a 32-byte PRF output in the contained browser', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-prf-');
  const nocTura = await containNocTura(ctx);
  const solscan = await containSolscan(ctx);
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/unlock.html?mode=welcome`);
    await addPrfAuthenticator(ctx, page);
    const out = await page.evaluate(async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const created = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {id: 'wallet.noc-tura.io', name: 'Noctura'},
          user: {id: crypto.getRandomValues(new Uint8Array(16)), name: 'probe', displayName: 'probe'},
          pubKeyCredParams: [{type: 'public-key', alg: -7}],
          authenticatorSelection: {userVerification: 'required', residentKey: 'preferred'},
          extensions: {prf: {}} as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      if (created === null) return {created: false, enabled: null, length: 0};
      const enabled = (created.getClientExtensionResults() as {prf?: {enabled?: boolean}}).prf?.enabled ?? null;
      const got = (await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: 'wallet.noc-tura.io',
          allowCredentials: [{type: 'public-key', id: created.rawId}],
          userVerification: 'required',
          extensions: {prf: {eval: {first: salt}}} as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      const first = (got?.getClientExtensionResults() as {prf?: {results?: {first?: ArrayBuffer}}} | undefined)?.prf?.results?.first;
      return {created: true, enabled, length: first === undefined ? 0 : first.byteLength};
    });
    expect(out).toEqual({created: true, enabled: true, length: 32});
    expect(nocTura.hits).toEqual([]);
    expect(solscan.hits).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
````

Create `extension/e2e/settings.spec.ts`:

````ts
import {test, expect, type Page, type Worker} from '@playwright/test';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {confirmWords, tryUnlock, unlockWith} from './vaultPage';
import {addPrfAuthenticator, withAuthenticatorFocus} from './virtualAuthenticator';

// Spec B1b-2b §8.3, plan 1: specs 14 and 16 (Task 18; 15, 17 and 18 are Task 19's) against the real extension (popup + vault tab) and the contained fake
// coordinator. Every spec ends with contained(h). The passkey steps use the pinned virtual-authenticator recipe (M3);
// the PRF probe (passkeyProbe.spec.ts) established that the pinned Chromium gives PRF output here — if it ever stops,
// these steps FAIL, never skip.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
  alarms: {get(name: string): Promise<{scheduledTime: number} | undefined>};
};
type Env = {kdf: {salt: string}; seed: unknown; password: {wrapped: string}; passkey?: unknown; accounts: {index: number; publicKey: string}[]};
const NEW_PASSWORD = 'a brand new e2e password';

const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
const envOf = async (sw: Worker) => (await local(sw, 'v1_vault')) as Env | undefined;
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
/** The tab the popup opens (platform.openPage → tabs.create) while `act` runs. */
async function opened(h: Harness, act: () => Promise<unknown>): Promise<Page> {
  const [tab] = await Promise.all([h.ctx.waitForEvent('page'), act()]);
  await tab.waitForLoadState('domcontentloaded');
  return tab;
}
/** A popup on #31. */
async function settings(h: Harness): Promise<Page> {
  const popup = await h.openPopup();
  // #11's first read answered first: under `unshare -rn` the popup starts offline (navigator.onLine false) and the
  // screens below read balances only once a read got through (2a review M5).
  await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
  await popup.getByRole('button', {name: 'Settings'}).click();
  await expect(popup.locator('.s7-title', {hasText: 'Security center'})).toBeVisible();
  return popup;
}
/** The vault tab's own visibility, as a tab switch would set it (the page's listeners read document.visibilityState). */
const visibility = (page: Page, state: 'hidden' | 'visible') =>
  page.evaluate(s => {
    Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => s});
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
/** A real wallet of `accounts` accounts, unlocked in `vault` (a vault tab that may carry the virtual authenticator). */
async function unlockedWallet(h: Harness, accounts: 1 | 2 | 3 = 1, o: {passkey?: boolean} = {}): Promise<Page> {
  await h.sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope({accounts}));
  const vault = await h.ctx.newPage();
  await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
  if (o.passkey === true) await addPrfAuthenticator(h.ctx, vault);
  await unlockWith(vault, h.id, E2E_PASSWORD);
  if (o.passkey === true) {
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=passkey&op=add`);
    await vault.locator('#pm-password').fill(E2E_PASSWORD);
    await withAuthenticatorFocus(vault, () => vault.locator('#pm-act').click());
    await expect(vault.locator('#pm-line')).toHaveText('Passkey added.', {timeout: 60_000});
  }
  return vault;
}

test('14 · change password: wrong → right → same → new → mismatch → confirm; only the salt and the wrap changed; 36e once; the old password fails, the new one and the passkey unlock', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-change-password-');
  try {
    const vault = await unlockedWallet(h, 1, {passkey: true});
    const before = (await envOf(h.sw)) as Env;
    expect(before.passkey).toBeDefined();
    const popup = await settings(h);
    const tab = await opened(h, () => popup.locator('.s7-title', {hasText: 'Change password'}).click());
    await expect(tab).toHaveURL(/mode=password$/);
    await expect(tab.locator('#cp-step')).toHaveText('Step 1 of 3');
    await tab.locator('#cp-field').fill('not the password at all');
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await tab.locator('#cp-field').fill(E2E_PASSWORD);
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-step')).toHaveText('Step 2 of 3', {timeout: 60_000});
    await expect(tab.locator('#cp-meter-label')).toHaveText('0 of 12 characters');
    // The current password again: `step-2 same` (review H2) — nothing sent.
    await tab.locator('#cp-field').fill(E2E_PASSWORD);
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-helper')).toHaveText('That is your current password. Choose a new one.', {timeout: 60_000});
    await tab.locator('#cp-field').fill(NEW_PASSWORD);
    await expect(tab.locator('#cp-meter-label')).toHaveText('Long enough');
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-step')).toHaveText('Step 3 of 3', {timeout: 60_000});
    // M2: the tab hidden and shown again (a password manager in another tab) keeps step 3 and its field.
    await tab.locator('#cp-field').fill('half typed');
    await visibility(tab, 'hidden');
    await visibility(tab, 'visible');
    await expect(tab.locator('#cp-step')).toHaveText('Step 3 of 3');
    await expect(tab.locator('#cp-field')).toHaveValue('half typed');
    await tab.locator('#cp-field').fill(`${NEW_PASSWORD}!`);
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-helper')).toHaveText("Passwords don't match — try again");
    await expect(tab.locator('#cp-field')).toHaveValue('', {timeout: 5_000});
    await tab.locator('#cp-field').fill(NEW_PASSWORD);
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-notice-line')).toHaveText('Password updated.', {timeout: 60_000});
    await expect(tab.locator('#cp-notice-help')).toHaveText('You can close this tab. Your passkey still works.');

    const after = (await envOf(h.sw)) as Env;
    expect([after.seed, after.accounts, after.passkey]).toEqual([before.seed, before.accounts, before.passkey]);
    expect(after.kdf.salt).not.toBe(before.kdf.salt);
    expect(after.password.wrapped).not.toBe(before.password.wrapped);

    // 36e (C10): the next #31 shows "Just updated" and the toast — once.
    const again = await settings(h);
    await expect(again.getByText('Password updated')).toBeVisible();
    await expect(again.locator('.s7-row.app-just-updated .s7-meta')).toHaveText('Just updated');
    await again.close();
    const third = await settings(h);
    await expect(third.locator('.s7-title', {hasText: 'Change password'})).toBeVisible();
    await third.waitForTimeout(500);
    await expect(third.getByText('Password updated')).toHaveCount(0);

    // Lock: the old password fails, the new one unlocks, and the passkey (the same data key) unlocks.
    expect((await msg(vault, {type: 'vault.lock'})).ok).toBe(true);
    expect(await tryUnlock(vault, h.id, E2E_PASSWORD)).toBe('That did not unlock the wallet.');
    expect(await tryUnlock(vault, h.id, NEW_PASSWORD)).toBe('Unlocked.');
    expect((await msg(vault, {type: 'vault.lock'})).ok).toBe(true);
    await vault.goto(`chrome-extension://${h.id}/unlock.html`);
    // Popups and tabs opened since took the window's focus (review M2).
    await withAuthenticatorFocus(vault, () => vault.locator('#unl-passkey').click());
    await expect(vault.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
    contained(h);
  } finally {
    await h.close();
  }
});

test('16 · reveal: proof → modal → hold → the words → "Still looking?" with no word in the DOM; Ctrl+C cancelled; → the check → verified; #35 all clear', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-reveal-');
  try {
    await unlockedWallet(h, 1, {passkey: true});
    const popup = await settings(h);
    await expect(popup.locator('.s7-row', {hasText: 'Recovery phrase'}).locator('.s7-meta')).toHaveText('Not verified');
    const tab = await opened(h, () => popup.locator('.s7-title', {hasText: 'Recovery phrase'}).click());
    await expect(tab).toHaveURL(/mode=reveal$/);
    await expect(tab.locator('#pp-title')).toHaveText('Show your recovery phrase');
    // D23: no passkey button on the proof, a passkey stored or not.
    await expect(tab.locator('#v-phrase-proof').getByText(/passkey/i)).toHaveCount(0);
    // The clipboard recipe (M3): a sentinel written in this tab first, where the API allows it; a document-level probe
    // records whether the grid's `copy` was cancelled (it bubbles after the grid's own listener).
    const clipboard = await tab.evaluate(async () => {
      (window as unknown as {copies: boolean[]}).copies = [];
      document.addEventListener('copy', e => (window as unknown as {copies: boolean[]}).copies.push(e.defaultPrevented));
      try {
        await navigator.clipboard.writeText('e2e-sentinel');
        return (await navigator.clipboard.readText()) === 'e2e-sentinel';
      } catch {
        return false;
      }
    });
    await tab.locator('#pp-password').fill(E2E_PASSWORD);
    await tab.locator('#pp-continue').click();
    await expect(tab.locator('#v-seed-gate')).toBeVisible({timeout: 60_000});
    await expect(tab.locator('#sg-body')).toHaveText('Move to a private place. Anyone who sees these 12 words can spend everything in this wallet, forever.');
    await tab.locator('#sg-continue').click();
    await expect(tab.locator('#seed-eyebrow')).toHaveText('Recovery phrase');
    await tab.locator('#seed-grid').focus();
    await tab.locator('#seed-grid').hover();
    await tab.mouse.down();
    await expect(tab.locator('#seed-chip')).toBeVisible({timeout: 10_000});
    expect(await tab.locator('#seed-grid .term').allTextContents()).toEqual(E2E_MNEMONIC.split(' '));
    // Ctrl+C while revealed: cancelled on the grid, and the clipboard (where readable here) still holds the sentinel.
    // Review L7: `copy` goes to the focused element — this relies on #seed-grid's tabindex="0" (unlock.html) and on
    // focus() + hover() + mouse.down() leaving the focus on the grid. A tabindex change must keep the grid focusable.
    await tab.keyboard.press('Control+c');
    await expect.poll(() => tab.evaluate(() => (window as unknown as {copies: boolean[]}).copies)).toEqual([true]);
    if (clipboard) expect(await tab.evaluate(() => navigator.clipboard.readText())).toBe('e2e-sentinel');
    // Held past the 20 s auto-blur: "Still looking?", and no word of the phrase left in the DOM.
    await expect(tab.locator('#seed-overlay-title')).toHaveText('Still looking?', {timeout: 30_000});
    expect(await tab.locator('#seed-grid .term').allTextContents()).not.toContain('abandon');
    expect(await tab.evaluate(() => document.body.innerText.includes('abandon'))).toBe(false);
    await tab.mouse.up();
    // Released after the auto-blur: "Still looking?" stays; one full hold happened, so the CTA is offered (#3's rule).
    await expect(tab.locator('#seed-cta')).toBeEnabled();
    await tab.locator('#seed-cta').click();
    await expect(tab.locator('#cnf-eyebrow')).toHaveText('Recovery phrase');
    await confirmWords(tab, E2E_MNEMONIC.split(' '));
    await tab.locator('#cnf-cta').click();
    await expect(tab.locator('#cnf-success-title')).toHaveText('Recovery phrase verified');
    await expect(tab.locator('#cnf-success-body')).toHaveText('All three words matched. You can close this tab.');
    await expect.poll(async () => ((await local(h.sw, 'v1_settings')) as {phraseVerifiedAt?: unknown} | undefined)?.phraseVerifiedAt ?? null, {timeout: 10_000}).not.toBeNull();

    const after = await settings(h);
    await expect(after.locator('.s7-row', {hasText: 'Recovery phrase'}).locator('.s7-meta')).toHaveText('Verified');
    await after.locator('.s7-title', {hasText: 'Security center'}).click();
    await expect(after.getByText('Looks great')).toBeVisible();
    await expect(after.getByText('Outstanding tasks')).toHaveCount(0);
    await expect(after.locator('.s7-row', {hasText: 'Recovery phrase verified'}).locator('.s7-meta')).toHaveText('Yes');
    contained(h);
  } finally {
    await h.close();
  }
});
````

Create `extension/e2e/virtualAuthenticator.ts`:

````ts
import type {BrowserContext, Page} from '@playwright/test';

/**
 * B1b-2b spec §8.3 (review M3), the pinned recipe: a CDP virtual authenticator on the tab, added BEFORE the first
 * create(). PRF is CTAP2-only, and the vault's userVerification: 'required' (src/vault/passkey.ts) needs both UV
 * flags. The authenticator lives as long as the page's CDP session: one per vault-page tab.
 */
export async function addPrfAuthenticator(ctx: BrowserContext, page: Page): Promise<string> {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const {authenticatorId} = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true},
  });
  // WebAuthn refuses a page without focus (NotAllowedError, "the page does not have focus"): the full E2E run left
  // another page focused once (dry run). The tab that will call create()/get() is brought to the front here.
  await page.bringToFront();
  return authenticatorId;
}

/**
 * Review M2: Chromium's WebAuthn focus check is browser-side, and every new popup or tab takes the window's focus.
 * Every action that drives create() or get() brings its tab to the front first — a stated precondition, not timing.
 */
export async function withAuthenticatorFocus(page: Page, act: () => Promise<void>): Promise<void> {
  await page.bringToFront();
  await act();
}
````

- [ ] **Step 2: Type-check, build, and run them — contained, then under `unshare -rn`.**

```bash
cd extension
npx tsc --noEmit && npx vitest run
npm run build
npx playwright test e2e/csp.spec.ts e2e/onboarding.spec.ts e2e/passkeyProbe.spec.ts e2e/settings.spec.ts
unshare -rn npx playwright test e2e/csp.spec.ts e2e/onboarding.spec.ts e2e/passkeyProbe.spec.ts e2e/settings.spec.ts
```
Expected (dry run): tsc clean; whole vitest suite Test Files 133 passed (133) · Tests 2322 passed (2322); every listed spec passes in both launches (counts in "Dry-run record" below). An E2E spec is not "red first" — the code it drives exists; its red proof is the mutations in the next step.

- [ ] **Step 3: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M18a** — PRF unavailable: the probe fails (never skips) — `extension/e2e/virtualAuthenticator.ts`:

  ```diff
  - hasPrf: true
  + hasPrf: false
  ```
  `npm run build && timeout 300 npx playwright test e2e/passkeyProbe.spec.ts` — Expected: **red** (dry run: 1 failed (Playwright)).

- **M18b** — PRF unavailable: spec 14 fails at its passkey step (never skips) — `extension/e2e/virtualAuthenticator.ts`:

  ```diff
  - hasPrf: true
  + hasPrf: false
  ```
  `npm run build && timeout 300 npx playwright test e2e/settings.spec.ts:74` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 4: Commit.**

```bash
git add extension/e2e/csp.spec.ts extension/e2e/makeEnvelope.ts extension/e2e/onboarding.spec.ts extension/e2e/passkeyProbe.spec.ts extension/e2e/settings.spec.ts extension/e2e/virtualAuthenticator.ts
git commit -F - <<'MSG'
feat(extension): E2E part 1: the PRF probe (first), spec 14 (change password), spec 16 (reveal + verify), CSP over the new modes

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 19: E2E part 2: spec 17 (settings applied by the background), spec 18 ×2 (remove / re-add, send-open), spec 15 ×4 (delete)

**Spec:** §8.3 specs 15, 17, 18

**Files:**
- Modify: `extension/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: Task 18's helpers; Tasks 1–17.
- Produces: no new exports (test files only).

Spec 17: #35 → 15 min → #10 → applied once by the background; a replay of the same challenge is `unknown-challenge`; 1 min applies with no tab. Spec 18: account 2 removed after a proof (its balance and D16's line shown first), then re-added at the pre-filled number — the same address; and with a send from account 2 open, the remove is refused (`send-open`) and the envelope is unchanged. Spec 15: a funded wallet — #37 names the lowest index, DELETE, 1 s hold, the tab shows the same address, wrong then right → welcome, everything wiped; a send still open → `send-open`, vault intact, locked, [Unlock]; C17 — the same wallet at a new revision → `changed`, nothing deleted; rev 3 (the hard case) — wallet A replaced by B under the tab: A's password gets `changed` with B's address, no `wrong`, no cooldown, B untouched. Specs that read nothing from the network end with `quiet(h)` (no route hits expected, still nothing unexpected, Solscan and noc-tura.io untouched).

- [ ] **Step 1: Write the specs and their helpers.**

Modify `extension/e2e/settings.spec.ts`:

````diff
diff --git a/extension/e2e/settings.spec.ts b/extension/e2e/settings.spec.ts
index 59977c8..8dc60e7 100644
--- a/extension/e2e/settings.spec.ts
+++ b/extension/e2e/settings.spec.ts
@@ -1,10 +1,10 @@
 import {test, expect, type Page, type Worker} from '@playwright/test';
 import {contained, launchPopup, type Harness} from './popupHarness';
-import {E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
-import {confirmWords, tryUnlock, unlockWith} from './vaultPage';
+import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
+import {confirmWords, pastePhrase, setPassword, tryUnlock, unlockWith} from './vaultPage';
 import {addPrfAuthenticator, withAuthenticatorFocus} from './virtualAuthenticator';
 
-// Spec B1b-2b §8.3, plan 1: specs 14 and 16 (Task 18; 15, 17 and 18 are Task 19's) against the real extension (popup + vault tab) and the contained fake
+// Spec B1b-2b §8.3, plan 1: specs 14–18 against the real extension (popup + vault tab) and the contained fake
 // coordinator. Every spec ends with contained(h). The passkey steps use the pinned virtual-authenticator recipe (M3);
 // the PRF probe (passkeyProbe.spec.ts) established that the pinned Chromium gives PRF output here — if it ever stops,
 // these steps FAIL, never skip.
@@ -15,10 +15,24 @@ declare const chrome: {
 };
 type Env = {kdf: {salt: string}; seed: unknown; password: {wrapped: string}; passkey?: unknown; accounts: {index: number; publicKey: string}[]};
 const NEW_PASSWORD = 'a brand new e2e password';
+const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
+/** OTHER's SLIP-0010 account 0 (derived once with src/vault/accounts.ts). */
+const OTHER_ACCOUNT = 'BLeUXTx9thHGT7VJUtF9vHEmfMDgW1nnKZ9UVer2CoLX';
+const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
 
 const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
 const envOf = async (sw: Worker) => (await local(sw, 'v1_vault')) as Env | undefined;
 const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
+const groups = async (page: Page, scope: string): Promise<string> => (await page.locator(`${scope} .addr-groups > span`).allTextContents()).join('');
+/**
+ * What a spec that reads nothing from the network ends with (spec §8.3: hits > 0 only "where it reads"): nothing
+ * unexpected, and Solscan and every noc-tura.io name never contacted. containment.spec.ts proves the counters count.
+ */
+function quiet(h: Harness): void {
+  expect(h.fake.unexpected).toEqual([]);
+  expect(h.solscan.hits).toEqual([]);
+  expect(h.nocTura.hits).toEqual([]);
+}
 /** The tab the popup opens (platform.openPage → tabs.create) while `act` runs. */
 async function opened(h: Harness, act: () => Promise<unknown>): Promise<Page> {
   const [tab] = await Promise.all([h.ctx.waitForEvent('page'), act()]);
@@ -195,3 +209,255 @@ test('16 · reveal: proof → modal → hold → the words → "Still looking?"
     await h.close();
   }
 });
+
+test('17 · a weakened auto-lock is applied once, by the background: #35 → 15 → #10 → applied; a replay is unknown-challenge; 1 min applies with no tab', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-settings-apply-');
+  try {
+    await unlockedWallet(h);
+    const popup = await settings(h);
+    await popup.locator('.s7-title', {hasText: 'Security center'}).click();
+    await popup.locator('.s7-title', {hasText: 'Auto-lock'}).last().click();
+    const tab = await opened(h, () => popup.getByRole('button', {name: '15 min'}).click());
+    const challengeId = /challenge=([0-9a-f]{32})$/.exec(tab.url())?.[1] ?? '';
+    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
+    await expect(tab.locator('#ra-rows')).toHaveText('Auto-lock → 15 minutes');
+    // Nothing applied before #10's proof.
+    expect(((await local(h.sw, 'v1_settings')) as {autoLockMinutes?: number} | undefined)?.autoLockMinutes ?? 5).toBe(5);
+    await tab.locator('#ra-password').fill(E2E_PASSWORD);
+    await tab.locator('#ra-confirm').click();
+    await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. The change is saved — you can close this tab.', {timeout: 60_000});
+    expect(await local(h.sw, 'v1_settings')).toMatchObject({autoLockMinutes: 15});
+    const alarm = await h.sw.evaluate(() => chrome.alarms.get('autolock'));
+    const minutes = ((alarm?.scheduledTime ?? 0) - Date.now()) / 60_000;
+    expect(minutes).toBeGreaterThan(14);
+    expect(minutes).toBeLessThanOrEqual(15.01);
+    // The replay, sent from the unlock tab's own context (review L10: VAULT_PAGE_ONLY refuses any other page).
+    expect(await tab.evaluate(id => chrome.runtime.sendMessage({type: 'vault.reauthOk', challengeId: id}), challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
+    expect(await local(h.sw, 'v1_settings')).toMatchObject({autoLockMinutes: 15});
+    // A strengthening applies at once, with no tab.
+    const again = await settings(h);
+    await again.locator('.s7-title', {hasText: 'Security center'}).click();
+    await again.locator('.s7-title', {hasText: 'Auto-lock'}).last().click();
+    const pages = h.ctx.pages().length;
+    await again.getByRole('button', {name: '1 min'}).click();
+    await expect.poll(async () => ((await local(h.sw, 'v1_settings')) as {autoLockMinutes?: number}).autoLockMinutes).toBe(1);
+    expect(h.ctx.pages().length).toBe(pages);
+    await expect(again.locator('.s7-row', {hasText: 'Auto-lock'}).last().locator('.s7-meta')).toHaveText('1 min');
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
+
+test('18 · remove → re-add: account 2 removed after a proof (its balance and the D16 line first), then added again at the pre-filled number — the same address', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-accounts-');
+  try {
+    await unlockedWallet(h, 3);
+    const popup = await settings(h);
+    await popup.locator('.s7-title', {hasText: 'Profile'}).click();
+    await expect(popup.locator('.app-account-row .pri')).toHaveText(['Account 1', 'Savings', 'Account 3']);
+    await popup.getByRole('button', {name: 'Remove Savings'}).click();
+    const sheet = popup.getByRole('dialog', {name: 'Remove Savings?'});
+    expect(await groups(popup, '.app-remove-sheet')).toBe(E2E_ACCOUNTS[1]);
+    await expect(sheet.getByText('Holds 10.0000 SOL · $1,500.00')).toBeVisible({timeout: 30_000});
+    await expect(sheet.getByText('Its funds stay on Solana; add it again to use them.')).toBeVisible();
+    const tab = await opened(h, () => sheet.getByRole('button', {name: 'Continue to remove'}).click());
+    await expect(tab).toHaveURL(/mode=accounts&op=remove&index=1$/);
+    await expect(tab.locator('#acc-title')).toHaveText('Remove Account 2?');
+    expect(await groups(tab, '#acc-address')).toBe(E2E_ACCOUNTS[1]);
+    await tab.locator('#acc-password').fill(E2E_PASSWORD);
+    await tab.locator('#acc-act').click();
+    await expect(tab.locator('#acc-helper')).toHaveText('Done. The accounts are updated.', {timeout: 60_000});
+    expect((await envOf(h.sw))?.accounts.map(a => a.index)).toEqual([0, 2]);
+
+    const manager = await settings(h);
+    await manager.locator('.s7-title', {hasText: 'Profile'}).click();
+    await expect(manager.locator('.app-account-row .pri')).toHaveText(['Account 1', 'Account 3']);
+    const add = await opened(h, () => manager.getByRole('button', {name: 'Add account'}).click());
+    await expect(add.locator('#acc-title')).toHaveText('Add an account');
+    await expect(add.locator('#acc-index')).toHaveValue('2');
+    await add.locator('#acc-password').fill(E2E_PASSWORD);
+    await add.locator('#acc-act').click();
+    await expect(add.locator('#acc-helper')).toHaveText('Done. The accounts are updated.', {timeout: 60_000});
+    expect((await envOf(h.sw))?.accounts.find(a => a.index === 1)?.publicKey).toBe(E2E_ACCOUNTS[1]);
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
+
+test('18 · a send from account 2 still open: the remove is refused (send-open) and the envelope is unchanged', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-accounts-open-');
+  try {
+    const vault = await unlockedWallet(h, 2);
+    // An open send from account 2, as the engine records one (the background refuses the store, C5).
+    await h.sw.evaluate(
+      ([account, recipient]) =>
+        chrome.storage.local.set({
+          v1_pending: [{id: 'ab'.repeat(16), account, signature: '5'.repeat(88), wire: 'AQ==', lastValidBlockHeight: 1150, createdAt: Date.now(), lastSentAt: Date.now(), state: 'pending', detail: null, detailCode: null, intent: {token: 'SOL', recipient, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: null}],
+        }),
+      [E2E_ACCOUNTS[1], RECIPIENT] as const,
+    );
+    h.fake.mode = 'expire';
+    const before = JSON.stringify(await envOf(h.sw));
+    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=accounts&op=remove&index=1`);
+    await vault.locator('#acc-password').fill(E2E_PASSWORD);
+    await vault.locator('#acc-act').click();
+    await expect(vault.locator('#acc-helper')).toHaveText('A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
+    expect(JSON.stringify(await envOf(h.sw))).toBe(before);
+    // The manager says so first: its [Continue to remove] is disabled for that account.
+    const popup = await settings(h);
+    await popup.locator('.s7-title', {hasText: 'Profile'}).click();
+    await popup.getByRole('button', {name: 'Remove Savings'}).click();
+    await expect(popup.getByRole('button', {name: 'Continue to remove'})).toBeDisabled();
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
+
+/** #31 → #37 → DELETE → the hold (Space on the focused CTA, 1 s) → the delete tab. */
+async function toDeleteTab(h: Harness, popup: Page, o: {checkPartial?: boolean} = {}): Promise<Page> {
+  await popup.locator('.s7-title', {hasText: 'Delete wallet'}).click();
+  await expect(popup.getByText('Delete this wallet?')).toBeVisible();
+  const field = popup.getByRole('textbox', {name: 'Type DELETE here'});
+  if (o.checkPartial === true) {
+    await field.fill('DEL');
+    await expect(popup.locator('.app-delete-help')).toHaveText('3 of 6 characters · keep going');
+  }
+  await field.fill('DELETE');
+  await expect(popup.getByText('Confirmation matched')).toBeVisible();
+  const hold = popup.locator('.app-hold');
+  await hold.focus();
+  return opened(h, async () => {
+    await popup.keyboard.down(' ');
+    // The popup closes itself once the proof page opens; the key-up may land on a closed page.
+    await popup.waitForTimeout(1_200).catch(() => undefined);
+    await popup.keyboard.up(' ').catch(() => undefined);
+  });
+}
+
+test('15 · delete a funded wallet: #37 says so and names the lowest index (not the top row) → DELETE → 1 s hold → the tab shows the same address → wrong, then right → welcome; everything wiped', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-delete-');
+  try {
+    await unlockedWallet(h, 2);
+    // Account 2 moved to the top of the display order (E14; rev 3, review M1).
+    const manager = await settings(h);
+    await manager.locator('.s7-title', {hasText: 'Profile'}).click();
+    await manager.getByRole('button', {name: 'Move Savings up'}).click();
+    await expect(manager.locator('.app-account-row .pri')).toHaveText(['Savings', 'Account 1']);
+    const popup = await settings(h);
+    const delPage = popup.locator('.s7-title', {hasText: 'Delete wallet'});
+    await expect(delPage).toBeVisible();
+    await delPage.click();
+    await expect(popup.getByText('This wallet holds funds')).toBeVisible({timeout: 30_000});
+    await expect(popup.locator('.app-delete-funds')).toContainText('20.0000 SOL');
+    expect(await groups(popup, '.app-delete-first')).toBe(E2E_ACCOUNTS[0]);
+    await popup.getByRole('button', {name: 'Back'}).click();
+    const tab = await toDeleteTab(h, popup, {checkPartial: true});
+    await expect(tab).toHaveURL(/mode=delete$/);
+    await expect(tab.locator('#dl-address .addr-groups > span')).toHaveText(E2E_ACCOUNTS[0].match(/.{1,4}/g) ?? []);
+    const before = JSON.stringify(await envOf(h.sw));
+    await tab.locator('#dl-password').fill('not the password at all');
+    await tab.locator('#dl-delete').click();
+    await expect(tab.locator('#dl-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
+    expect(JSON.stringify(await envOf(h.sw))).toBe(before);
+    await tab.locator('#dl-password').fill(E2E_PASSWORD);
+    await tab.locator('#dl-delete').click();
+    await tab.waitForURL(/mode=welcome$/, {timeout: 60_000});
+    for (const key of ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_balance_cache', 'v1_price_cache']) expect(await local(h.sw, key), key).toBeUndefined();
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
+
+test('15 · a send still open: send-open — the vault intact, the wallet locked, [Unlock] → ?mode=unlock', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-delete-open-');
+  try {
+    const vault = await unlockedWallet(h, 1);
+    h.fake.mode = 'expire';
+    await h.sw.evaluate(
+      ([account, recipient]) =>
+        chrome.storage.local.set({
+          v1_pending: [{id: 'cd'.repeat(16), account, signature: '5'.repeat(88), wire: 'AQ==', lastValidBlockHeight: 1150, createdAt: Date.now(), lastSentAt: Date.now(), state: 'pending', detail: null, detailCode: null, intent: {token: 'SOL', recipient, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: null}],
+        }),
+      [E2E_ACCOUNTS[0], RECIPIENT] as const,
+    );
+    const before = JSON.stringify(await envOf(h.sw));
+    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=delete`);
+    await vault.locator('#dl-password').fill(E2E_PASSWORD);
+    await vault.locator('#dl-delete').click();
+    await expect(vault.locator('#dl-notice-line')).toHaveText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
+    await expect(vault.locator('#dl-notice-help')).toHaveText('The wallet has been locked. Nothing was deleted.');
+    expect(JSON.stringify(await envOf(h.sw))).toBe(before);
+    expect(await msg(vault, {type: 'vault.status'})).toMatchObject({ok: true, data: {unlocked: false}});
+    await vault.locator('#dl-unlock').click();
+    await vault.waitForURL(/mode=unlock$/);
+    quiet(h);
+  } finally {
+    await h.close();
+  }
+});
+
+test('15 · C17: the same wallet at a new revision under the delete tab (an account added) — `changed`, nothing deleted', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-delete-changed-');
+  try {
+    const vault = await unlockedWallet(h, 1);
+    const del = await h.ctx.newPage();
+    await del.goto(`chrome-extension://${h.id}/unlock.html?mode=delete`);
+    await expect(del.locator('#dl-address .addr-groups')).toBeVisible();
+    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=accounts&op=add`);
+    await vault.locator('#acc-password').fill(E2E_PASSWORD);
+    await vault.locator('#acc-act').click();
+    await expect(vault.locator('#acc-helper')).toHaveText('Done. The accounts are updated.', {timeout: 60_000});
+    await del.locator('#dl-password').fill(E2E_PASSWORD);
+    await del.locator('#dl-delete').click();
+    await expect(del.locator('#dl-helper')).toHaveText('The wallet in this browser changed. Check the address and try again.', {timeout: 30_000});
+    expect((await envOf(h.sw))?.accounts).toHaveLength(2);
+    quiet(h);
+  } finally {
+    await h.close();
+  }
+});
+
+test('15 · rev 3 (the hard case): wallet A replaced by wallet B under the tab — A’s password is `changed` with B’s address, no `wrong`, no cooldown; B untouched', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-delete-replaced-');
+  try {
+    h.fake.defaultLamports = 0;
+    await h.sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
+    const del = await h.ctx.newPage();
+    await del.goto(`chrome-extension://${h.id}/unlock.html?mode=delete`);
+    expect(await groups(del, '#dl-address')).toBe(E2E_ACCOUNTS[0]);
+    // A replaced by B through #40's retry path (E5 with the unfunded guard) in another tab.
+    const other = await h.ctx.newPage();
+    await other.goto(`chrome-extension://${h.id}/unlock.html?mode=import&source=retry`);
+    await other.locator('#rp-password').fill(E2E_PASSWORD);
+    await other.locator('#rp-confirm').click();
+    await expect(other.locator('#v-import')).toBeVisible({timeout: 60_000});
+    await pastePhrase(other, OTHER);
+    await other.locator('#imp-continue').click();
+    await expect(other.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
+    await setPassword(other, NEW_PASSWORD);
+    await other.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
+    const b = JSON.stringify(await envOf(h.sw));
+    expect((JSON.parse(b) as Env).accounts.map(a => a.publicKey)).toEqual([OTHER_ACCOUNT]);
+    await del.locator('#dl-password').fill(E2E_PASSWORD);
+    await del.locator('#dl-delete').click();
+    await expect(del.locator('#dl-helper')).toHaveText('The wallet in this browser changed. Check the address and try again.', {timeout: 30_000});
+    expect(await groups(del, '#dl-address')).toBe(OTHER_ACCOUNT);
+    await expect(del.locator('#dl-cooldown')).toBeHidden();
+    await expect(del.locator('#dl-helper')).not.toHaveText('That did not confirm it.');
+    expect(JSON.stringify(await envOf(h.sw))).toBe(b);
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
````

- [ ] **Step 2: Type-check, build, and run them — contained, then under `unshare -rn`.**

```bash
cd extension
npx tsc --noEmit && npx vitest run
npm run build
npx playwright test e2e/settings.spec.ts
unshare -rn npx playwright test e2e/settings.spec.ts
```
Expected (dry run): tsc clean; whole vitest suite Test Files 133 passed (133) · Tests 2322 passed (2322); every listed spec passes in both launches (counts in "Dry-run record" below). An E2E spec is not "red first" — the code it drives exists; its red proof is the mutations in the next step.

- [ ] **Step 3: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M19a** — C17 off: spec 15 rev-3 deletes wallet B — `extension/src/unlock/screens/delete.ts`:

  ```diff
  - if (envelopeRevision(env) === shownRevision) return true;
  + if (envelopeRevision(env) === shownRevision || shownRevision !== null) return true;
  ```
  `npm run build && timeout 300 npx playwright test e2e/settings.spec.ts -g 'C17|rev 3'` — Expected: **red** (dry run: 2 failed (Playwright)).

- [ ] **Step 4: Commit.**

```bash
git add extension/e2e/settings.spec.ts
git commit -F - <<'MSG'
feat(extension): E2E part 2: spec 17 (settings applied by the background), spec 18 ×2 (remove / re-add, send-open), spec 15 ×4 (delete)

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 20: The visual pass (§8.4): every plan-1 state, popup at 412 × 600 and the vault tab at 412 px

**Spec:** §8.4 (visual checklist), §3–§5

**Files:**
- Create: `extension/e2e/visual-settings.spec.ts`
- Modify: `extension/e2e/visual-vault.spec.ts`
- Create: `extension/e2e/visualTab.ts`

**Interfaces:**
- Consumes: Task 18's `addPrfAuthenticator`, `makeEnvelope({accounts})`; Tasks 8–17.
- Produces (exact signatures, as exported):
  - `export const DIR = 'test-results/visual';`
  - `export async function shot(page: Page, name: string, o: {fullPage?: boolean; ready?: Locator} = {}): Promise<void>`
  - `export async function vaultTab(h: Harness, path: string, o: {passkeyCreate?: 'null'} = {}): Promise<Page>`
  - `export const holdKdf = (p: Page) => p.evaluate(() => void ((window as unknown as {__kdf: {hold: boolean}}).__kdf.hold = true));`
  - `export const releaseKdf = async (p: Page) =>`

`visual-settings.spec.ts` shoots every state the real extension can be put in — 22 popup shots and 49 vault-tab shots — into `test-results/visual/` for the opus-tier review against index.html (#31, #35, #36, #37, #6, #3, #4) with §8.4's checklist. Each state asserts its own copy first (the popup ones also `toBeInViewport` clear of the pinned bars); transient states are held (the KDF hold for checking/changing/adding/removing/deleting, Playwright's paused **page** clock for the mismatch clear, the 60 % hold and the toast) — the popup clock is never run past an expiry the background stamped. The shared helpers move unchanged from `visual-vault.spec.ts` into `e2e/visualTab.ts`. States reachable only with fault injection (setting failed, #36 failed, delete failed, passkey failed) are covered by the component tests, not shot.

- [ ] **Step 1: Write the specs and their helpers.**

Create `extension/e2e/visual-settings.spec.ts`:

````ts
import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {base64} from '@scure/base';
import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {confirmWords, unlockWith} from './vaultPage';
import {holdKdf, releaseKdf, shot, vaultTab} from './visualTab';
import {addPrfAuthenticator, withAuthenticatorFocus} from './virtualAuthenticator';

// Spec B1b-2b §8.4, plan 1: every state of §§3–5 the real extension can be put in, rendered at the design's sizes —
// the popup at 412 × 600, the vault tab in its 412 px column (412 × 916) — and saved for the opus-tier review against
// index.html (#31, #35, #36, #37, #6, #3, #4) with §8.4's checklist. Not a pixel diff. Every state asserts its own copy
// (and, in the popup, that it is in the viewport clear of the pinned bars) before its shot; a state that lasts a moment
// (a mismatch clear, a hold, a toast) is shot under the page's paused clock, one that lasts as long as a computation
// (checking, changing, deleting, adding, removing) is held open by the test (holdKdf) — never raced. The popup's clock is
// never run past an expiry the background stamped (plan-3 lesson): the only clocks moved here are page-local timers.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {remove(k: string): Promise<void>}};
};
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const PASSKEY = {credentialId: B(16, 7), prfSalt: B(32, 8), wrapped: B(40, 9)};
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const NEW_PASSWORD = 'a brand new visual password';
const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
/** A popup shot: the state's own element is in the viewport (clear of the pinned bars) first. */
async function pop(page: Page, name: string, visible: Locator): Promise<void> {
  await expect(visible).toBeInViewport();
  await shot(page, name, {fullPage: false});
}
/** The popup on #11, its first read answered (see settings.spec.ts: the offline start under `unshare -rn`). */
async function popup(h: Harness, o: {clock?: boolean} = {}): Promise<Page> {
  const p = await h.openPopup(o);
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
const toSettings = async (p: Page) => {
  await p.getByRole('button', {name: 'Settings'}).click();
  await expect(p.locator('.s7-title', {hasText: 'Security center'})).toBeVisible();
};
const openPending = (account: string) => ({
  v1_pending: [{id: 'ef'.repeat(16), account, signature: '5'.repeat(88), wire: 'AQ==', lastValidBlockHeight: 1150, createdAt: Date.now(), lastSentAt: Date.now(), state: 'pending', detail: null, detailCode: null, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: null}],
});

test('visual: #31, #35, the passkey screen, the accounts manager and #37 in the popup (412 × 600)', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-vis-settings-');
  try {
    await seedUnlockedWallet(h.sw);
    let p = await popup(h);
    await toSettings(p);
    await expect(p.locator('.s7-tip p')).toHaveText('Tip — add a passkey to unlock with your fingerprint, face or security key. Your password always works too.');
    await expect(p.locator('.s7-row', {hasText: 'Security center'}).locator('.s7-meta')).toHaveText('3 to do');
    await pop(p, '31a-default-no-passkey', p.locator('.s7-tip'));
    await p.locator('.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
    await pop(p, '31c-scrolled-advanced', p.locator('.s7-row.danger'));

    // #35 · 35a, 35c, the threshold card, 35d.
    await p.locator('.app-content').evaluate(e => e.scrollTo(0, 0));
    await p.locator('.s7-title', {hasText: 'Security center'}).click();
    await expect(p.getByText('3 outstanding tasks.')).toBeVisible();
    await pop(p, '35a-tasks-outstanding', p.getByText('Improve your security'));
    await p.locator('.s7-title', {hasText: 'Auto-lock'}).click();
    await expect(p.getByText('When idle, lock the wallet after')).toBeVisible();
    await p.getByText('A longer time asks for your password in a new tab.').scrollIntoViewIfNeeded();
    await pop(p, '35c-auto-lock-expanded', p.locator('.s7-picker'));
    await p.locator('.s7-title', {hasText: 'Re-authentication threshold'}).click();
    await expect(p.getByText('Ask for your password before sends worth more than')).toBeVisible();
    await p.getByText('A higher amount asks for your password in a new tab.').scrollIntoViewIfNeeded();
    await pop(p, '35-threshold-expanded', p.locator('.s7-picker'));
    await p.locator('.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
    await expect(p.getByText('Danger zone')).toBeVisible();
    await pop(p, '35d-danger-zone', p.locator('.app-danger-card'));

    // The passkey screen, off.
    await p.locator('.app-content').evaluate(e => e.scrollTo(0, 0));
    await p.locator('.s7-title', {hasText: 'Passkey'}).click();
    await expect(p.getByRole('heading', {name: 'Unlock Noctura with a passkey'})).toBeVisible();
    await pop(p, '06m-passkey-off', p.getByRole('heading', {name: 'Unlock Noctura with a passkey'}));
    await p.close();

    // A passkey stored and the phrase verified: #31 passkey on, #35 all clear (35b), the passkey screen on.
    await set(h.sw, {
      v1_vault: {v: 1, scheme: 'slip10', kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)}, seed: {iv: B(12, 2), ct: B(48, 3)}, password: {wrapped: B(40, 4)}, passkey: PASSKEY, accounts: [MAIN, SAVINGS].map(a => ({index: a.index, name: a.name, publicKey: a.publicKey}))},
      v1_settings: {phraseVerifiedAt: Date.now()},
    });
    p = await popup(h);
    await toSettings(p);
    await expect(p.locator('.s7-row', {hasText: 'Security center'}).locator('.s7-meta')).toHaveText('All done');
    await expect(p.locator('.s7-row', {hasText: 'Recovery phrase'}).locator('.s7-meta')).toHaveText('Verified');
    await pop(p, '31a-passkey-on-verified', p.locator('.s7-row', {hasText: 'Profile'}));
    await p.locator('.s7-title', {hasText: 'Security center'}).click();
    await expect(p.getByText('Looks great')).toBeVisible();
    await pop(p, '35b-all-clear', p.getByText('Active protections'));
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-title', {hasText: 'Passkey'}).click();
    await expect(p.getByRole('heading', {name: 'Passkey is on'})).toBeVisible();
    await pop(p, '06m-passkey-on', p.getByRole('heading', {name: 'Passkey is on'}));
    await p.close();

    // 35: a stored value that is no preset.
    await set(h.sw, {v1_settings: {autoLockMinutes: 7, reauthUsdCents: 25_000, phraseVerifiedAt: Date.now()}});
    p = await popup(h);
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Security center'}).click();
    await p.locator('.s7-title', {hasText: 'Auto-lock'}).last().click();
    await expect(p.locator('.s7-row', {hasText: 'Auto-lock'}).last().locator('.s7-meta')).toHaveText('7 min');
    await expect(p.locator('.s7-picker .opt.sel')).toHaveCount(0);
    await pop(p, '35-value-not-a-preset', p.locator('.s7-picker'));
    await p.close();

    // 36e on #31: the toast held under the paused clock (a page-local timer).
    await set(h.sw, {v1_settings: {passwordChangedAt: Date.now() - 30_000}});
    p = await popup(h, {clock: true});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await toSettings(p);
    await expect(p.getByText('Password updated')).toBeVisible();
    await expect(p.locator('.s7-row.app-just-updated .s7-meta')).toHaveText('Just updated');
    await pop(p, '36e-password-updated', p.locator('.s7-toast'));
    await p.close();

    // The accounts manager: the list, the remove sheet, the stale line.
    p = await popup(h);
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Profile'}).click();
    await expect(p.locator('.app-account-row .pri')).toHaveText(['Main', 'Savings']);
    await expect(p.getByText('10.0000 SOL · $1,500.00').first()).toBeVisible();
    await pop(p, '43m-accounts-list', p.locator('.app-account-row').first());
    await p.getByRole('button', {name: 'Remove Savings'}).click();
    await expect(p.getByText('Holds 10.0000 SOL · $1,500.00')).toBeVisible();
    await pop(p, '43m-remove-sheet', p.getByRole('button', {name: 'Continue to remove'}));
    await p.getByRole('button', {name: 'Cancel'}).click();
    await set(h.sw, {v1_vault: {v: 1, scheme: 'slip10', kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)}, seed: {iv: B(12, 2), ct: B(48, 3)}, password: {wrapped: B(40, 4)}, accounts: [MAIN].map(a => ({index: a.index, name: a.name, publicKey: a.publicKey}))}});
    await p.getByRole('button', {name: 'Move Main down'}).click();
    await expect(p.getByText('The accounts changed. Try again.')).toBeVisible();
    await expect(p.getByText('The last account cannot be removed.')).toBeVisible();
    await pop(p, '43m-stale-and-last-account', p.getByText('The accounts changed. Try again.'));
    await p.close();

    // #37: idle (funded), partial, not a prefix, matched, mid-hold; then send open and balances unknown.
    await seedUnlockedWallet(h.sw);
    p = await popup(h, {clock: true});
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    await expect(p.getByText('This wallet holds funds')).toBeVisible({timeout: 30_000});
    await pop(p, '37a-idle-funded', p.getByText('Delete this wallet?'));
    const field = p.getByRole('textbox', {name: 'Type DELETE here'});
    await field.fill('DEL');
    await expect(p.locator('.app-delete-help')).toHaveText('3 of 6 characters · keep going');
    await pop(p, '37b-partial', field);
    await field.fill('DEX');
    await expect(p.getByText('Type DELETE exactly — it is case-sensitive.')).toBeVisible();
    await pop(p, '37-not-a-prefix', field);
    await field.fill('DELETE');
    await expect(p.getByText('Confirmation matched')).toBeVisible();
    await pop(p, '37c-matched', p.locator('.app-hold'));
    // §8.4 item 10: the fill and the countdown at a mid-hold frame (~60 %), the page's clock paused.
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('.app-hold').hover();
    await p.mouse.down();
    await p.clock.runFor(600);
    await expect(p.locator('.app-hold')).toHaveText('Hold to delete · 0.4 s');
    await expect(p.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    await pop(p, '37c-hold-60', p.locator('.app-hold'));
    await p.mouse.move(0, 0);
    await p.mouse.up();
    await p.close();
    await set(h.sw, openPending(MAIN.publicKey));
    p = await popup(h);
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    await expect(p.getByText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.')).toBeVisible();
    await pop(p, '37-send-open', p.getByText('A transaction from this wallet is still pending', {exact: false}));
    await p.close();
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_pending'));
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_balance_cache'));
    p = await popup(h);
    h.fake.network = 'unreachable';
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    await expect(p.getByText('Balances could not all be checked — this wallet may hold funds.')).toBeVisible({timeout: 30_000});
    await pop(p, '37-balances-unknown', p.getByText('Balances could not all be checked', {exact: false}));
    h.fake.network = 'ok';
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: the vault tab — #36, #37’s proof, the passkey actions, accounts, reveal and verify, #10’s settings kind (412 px)', async () => {
  test.setTimeout(600_000);
  const h = await launchPopup('noctura-e2e-vis-vault-2b-');
  try {
    await set(h.sw, {v1_vault: await makeEnvelope({accounts: 2})});
    const p = await vaultTab(h, 'unlock.html?mode=welcome');
    await addPrfAuthenticator(h.ctx, p);
    await unlockWith(p, h.id, E2E_PASSWORD);
    const go = (path: string) => p.goto(`chrome-extension://${h.id}/unlock.html?${path}`);

    // Passkey · add (idle, adding held, added), replace, remove (idle, removing held, removed), no passkey.
    await go('mode=passkey&op=add');
    await expect(p.locator('#pm-title')).toHaveText('Unlock Noctura with a passkey');
    await shot(p, '06m-add-idle', {ready: p.locator('#pm-act')});
    await holdKdf(p);
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await withAuthenticatorFocus(p, () => p.locator('#pm-act').click());
    await expect(p.locator('#pm-line')).toHaveText('Waiting for your passkey…');
    await shot(p, '06m-adding');
    await releaseKdf(p);
    await expect(p.locator('#pm-line')).toHaveText('Passkey added.', {timeout: 60_000});
    await shot(p, '06m-added', {ready: p.locator('#pm-close')});
    await go('mode=passkey&op=add');
    await expect(p.locator('#pm-title')).toHaveText('Replace your passkey');
    await shot(p, '06m-replace-idle', {ready: p.locator('#pm-act')});
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await withAuthenticatorFocus(p, () => p.locator('#pm-act').click());
    await expect(p.locator('#pm-line')).toHaveText('Passkey replaced.', {timeout: 60_000});
    await shot(p, '06m-replaced', {ready: p.locator('#pm-close')});
    await go('mode=passkey&op=remove');
    await expect(p.locator('#pm-title')).toHaveText('Remove your passkey');
    await shot(p, '06m-remove-idle', {ready: p.locator('#pm-passkey')});
    await holdKdf(p);
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await p.locator('#pm-act').click();
    await expect(p.locator('#pm-line')).toHaveText('Removing the passkey…');
    await shot(p, '06m-removing');
    await releaseKdf(p);
    await expect(p.locator('#pm-line')).toHaveText('Passkey removed.', {timeout: 60_000});
    await shot(p, '06m-removed', {ready: p.locator('#pm-close')});
    await go('mode=passkey&op=remove');
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await p.locator('#pm-act').click();
    await expect(p.locator('#pm-line')).toHaveText('This wallet has no passkey. Nothing was changed.', {timeout: 60_000});
    await shot(p, '06m-no-passkey');
    // A passkey again, for #36's `done` line and the delete page's passkey button.
    await go('mode=passkey&op=add');
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await withAuthenticatorFocus(p, () => p.locator('#pm-act').click());
    await expect(p.locator('#pm-line')).toHaveText('Passkey added.', {timeout: 60_000});

    // #36 · 36a–36e and the extension-only states.
    await go('mode=password');
    await expect(p.locator('#cp-title')).toHaveText('Enter current password');
    await shot(p, '36a-step-1', {ready: p.locator('#cp-x')});
    await p.locator('#cp-field').fill('not the password at all');
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await shot(p, '36-step-1-wrong', {ready: p.locator('#cp-x')});
    await p.locator('#cp-field').fill(E2E_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-title')).toHaveText('Choose a new password', {timeout: 60_000});
    await p.locator('#cp-field').fill('a few words');
    await expect(p.locator('#cp-meter-label')).toHaveText('11 of 12 characters');
    await shot(p, '36b-step-2', {ready: p.locator('#cp-x')});
    await p.locator('#cp-field').fill(E2E_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-helper')).toHaveText('That is your current password. Choose a new one.', {timeout: 60_000});
    await shot(p, '36-step-2-same', {ready: p.locator('#cp-x')});
    await p.locator('#cp-field').fill(NEW_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-title')).toHaveText('Confirm new password', {timeout: 60_000});
    await shot(p, '36c-step-3', {ready: p.locator('#cp-x')});
    await p.locator('#cp-x').click();
    await expect(p.locator('#cpc-title')).toHaveText('Cancel password change?');
    await shot(p, '36-cancel-confirm', {ready: p.locator('#cpc-keep')});
    await p.locator('#cpc-keep').click();
    await expect(p.locator('#cp-title')).toHaveText('Confirm new password');
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#cp-field').fill(`${NEW_PASSWORD}!`);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-helper')).toHaveText("Passwords don't match — try again");
    await shot(p, '36d-mismatch');
    await p.clock.runFor(700);
    await p.clock.resume();
    await expect(p.locator('#cp-field')).toHaveValue('');
    await holdKdf(p);
    await p.locator('#cp-field').fill(NEW_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.getByText('Updating your password…')).toBeVisible();
    await shot(p, '36-changing');
    await releaseKdf(p);
    await expect(p.locator('#cp-notice-line')).toHaveText('Password updated.', {timeout: 60_000});
    await expect(p.locator('#cp-notice-help')).toHaveText('You can close this tab. Your passkey still works.');
    await shot(p, '36-done', {ready: p.locator('#cp-close')});
    // `dropped`: the 5-minute TTL (C20), a page-local timer, run on the page's own clock.
    await go('mode=password');
    await p.locator('#cp-field').fill(NEW_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-title')).toHaveText('Choose a new password', {timeout: 60_000});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.clock.runFor(5 * 60_000 + 1_000);
    await expect(p.locator('#cp-helper')).toHaveText('Enter your current password again.');
    await shot(p, '36-dropped');
    await p.clock.resume();

    // The accounts mode: add (idle, adding, done, taken, not a number), remove (idle, removing, send-open, unknown).
    await go('mode=accounts&op=add');
    await expect(p.locator('#acc-title')).toHaveText('Add an account');
    await expect(p.locator('#acc-index')).toHaveValue('3');
    await shot(p, 'accounts-add-idle', {ready: p.locator('#acc-act')});
    await holdKdf(p);
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('Adding an account…');
    await shot(p, 'accounts-adding');
    await releaseKdf(p);
    await expect(p.locator('#acc-helper')).toHaveText('Done. The accounts are updated.', {timeout: 60_000});
    await shot(p, 'accounts-done', {ready: p.locator('#acc-act')});
    await p.locator('#acc-index').fill('1');
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('That account is already in this wallet.', {timeout: 60_000});
    await shot(p, 'accounts-index-taken', {ready: p.locator('#acc-act')});
    await p.locator('#acc-index').fill('0');
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('That is not an account number.');
    await shot(p, 'accounts-bad-index', {ready: p.locator('#acc-act')});
    await go('mode=accounts&op=remove&index=0');
    await expect(p.locator('#acc-title')).toHaveText('Remove Account 1?');
    await shot(p, 'accounts-remove-idle', {ready: p.locator('#acc-act')});
    await set(h.sw, openPending(E2E_ACCOUNTS[0]));
    await holdKdf(p);
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('Removing the account…');
    await shot(p, 'accounts-removing');
    await releaseKdf(p);
    await expect(p.locator('#acc-helper')).toHaveText('A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
    await shot(p, 'accounts-send-open', {ready: p.locator('#acc-act')});
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_pending'));
    await go('mode=accounts&op=remove&index=9');
    await expect(p.locator('#acc-helper')).toHaveText('There is no account with that number.');
    await shot(p, 'accounts-unknown-index');

    // #10's settings kind: idle (described), applied; expired (the challenge gone before the proof); locked meanwhile.
    const reauth = async (minutes: number): Promise<string> => {
      const r = await msg(p, {type: 'settings.set', patch: {autoLockMinutes: minutes}});
      const id = (r.data as {challengeId: string}).challengeId;
      await go(`mode=reauth&challenge=${id}`);
      await expect(p.locator('#ra-about')).toHaveText('You are about to change');
      return id;
    };
    await reauth(15);
    await expect(p.locator('#ra-rows')).toHaveText('Auto-lock → 15 minutes');
    await shot(p, '10-settings-idle', {ready: p.locator('#ra-confirm')});
    await p.locator('#ra-password').fill(NEW_PASSWORD);
    await p.locator('#ra-confirm').click();
    await expect(p.locator('#ra-notice-line')).toHaveText('Confirmed. The change is saved — you can close this tab.', {timeout: 60_000});
    await shot(p, '10-settings-applied');
    await reauth(60);
    await h.sw.evaluate(() => chrome.storage.session.remove('v1_reauth'));
    await p.locator('#ra-password').fill(NEW_PASSWORD);
    await p.locator('#ra-confirm').click();
    await expect(p.locator('#ra-notice-line')).toHaveText('Took too long — try again', {timeout: 60_000});
    await expect(p.locator('#ra-notice-help')).toHaveText('Nothing was changed. Choose the setting again in Security center.');
    await shot(p, '10-settings-expired');

    // Reveal: the proof, checking, the modal, blurred, revealed, still looking; the check; verify; not recorded.
    await go('mode=reveal');
    await expect(p.locator('#pp-title')).toHaveText('Show your recovery phrase');
    await shot(p, 'reveal-proof', {ready: p.locator('#pp-continue')});
    await holdKdf(p);
    await p.locator('#pp-password').fill(NEW_PASSWORD);
    await p.locator('#pp-continue').click();
    await expect(p.locator('#pp-helper')).toHaveText('Checking…');
    await shot(p, 'reveal-checking');
    await releaseKdf(p);
    await expect(p.locator('#sg-body')).toHaveText('Move to a private place. Anyone who sees these 12 words can spend everything in this wallet, forever.', {timeout: 60_000});
    await shot(p, '03r-pre-reveal-modal', {ready: p.locator('#sg-continue')});
    await p.locator('#sg-continue').click();
    await expect(p.locator('#seed-overlay-title')).toHaveText('Press and hold to reveal');
    await expect(p.locator('#seed-lede')).toHaveText('12 words. Write them down on paper, in order. This is the only backup.');
    await shot(p, '03r-blurred', {ready: p.locator('#seed-back')});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#seed-grid').hover();
    await p.mouse.down();
    await p.clock.runFor(2_030 + 7_000);
    await expect(p.locator('#seed-chip')).toHaveText('13 s· auto-blur');
    expect(await p.locator('#seed-grid .term').allTextContents()).toEqual(E2E_MNEMONIC.split(' '));
    await shot(p, '03r-revealed-13s', {fullPage: false});
    await p.clock.runFor(13_000);
    await expect(p.locator('#seed-overlay-title')).toHaveText('Still looking?');
    await shot(p, '03r-still-looking', {fullPage: false});
    await p.mouse.up();
    await p.mouse.down();
    await p.clock.runFor(2_030);
    await p.mouse.up();
    await expect(p.locator('#seed-stamp')).toHaveText('Acknowledged');
    await shot(p, '03r-confirmed', {ready: p.locator('#seed-cta')});
    await p.clock.resume();
    await p.locator('#seed-cta').click();
    await expect(p.locator('#cnf-eyebrow')).toHaveText('Recovery phrase');
    await shot(p, '04r-empty', {ready: p.locator('#cnf-back')});
    await confirmWords(p, E2E_MNEMONIC.split(' '));
    await p.locator('#cnf-cta').click();
    await expect(p.locator('#cnf-success-title')).toHaveText('Recovery phrase verified');
    await shot(p, '04r-verified', {ready: p.locator('#cnf-cta')});
    await go('mode=verify');
    await expect(p.locator('#pp-title')).toHaveText('Verify your recovery phrase');
    await shot(p, 'verify-proof', {ready: p.locator('#pp-continue')});
    await p.locator('#pp-password').fill(NEW_PASSWORD);
    await p.locator('#pp-continue').click();
    await expect(p.locator('#cnf-slots .slot')).toHaveCount(3, {timeout: 60_000});
    // The wallet locked meanwhile (another page): the background refuses the fact — O32.
    const other = await h.ctx.newPage();
    await other.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    await msg(other, {type: 'vault.lock'});
    await confirmWords(p, E2E_MNEMONIC.split(' '));
    await p.locator('#cnf-cta').click();
    await expect(p.locator('#cnf-success-body')).toHaveText('All three words matched, but this could not be saved. Try again later.');
    await shot(p, 'verify-not-recorded', {ready: p.locator('#cnf-cta')});
    await other.close();

    // #37's proof: idle (with the passkey button), deleting held, changed, send-open; then damaged and no wallet.
    await unlockWith(p, h.id, NEW_PASSWORD);
    await go('mode=delete');
    await expect(p.locator('#dl-passkey')).toBeVisible();
    await shot(p, 'delete-idle', {ready: p.locator('#dl-delete')});
    await p.locator('#dl-password').fill('not the password at all');
    await p.locator('#dl-delete').click();
    await expect(p.locator('#dl-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await shot(p, 'delete-wrong', {ready: p.locator('#dl-delete')});
    await msg(p, {type: 'accounts.rename', index: 0, name: 'Renamed'});
    // A rename moves no revision; a passkey removal does: the wallet under the tab changed.
    await go('mode=passkey&op=remove');
    await p.locator('#pm-password').fill(NEW_PASSWORD);
    await p.locator('#pm-act').click();
    await expect(p.locator('#pm-line')).toHaveText('Passkey removed.', {timeout: 60_000});
    await go('mode=delete');
    await expect(p.locator('#dl-address .addr-groups')).toBeVisible();
    await set(h.sw, {v1_vault: await makeEnvelope({accounts: 1})});
    await p.locator('#dl-password').fill(NEW_PASSWORD);
    await p.locator('#dl-delete').click();
    await expect(p.locator('#dl-helper')).toHaveText('The wallet in this browser changed. Check the address and try again.');
    await shot(p, 'delete-changed', {ready: p.locator('#dl-delete')});
    await set(h.sw, openPending(E2E_ACCOUNTS[0]));
    await holdKdf(p);
    await p.locator('#dl-password').fill(E2E_PASSWORD);
    await p.locator('#dl-delete').click();
    await expect(p.locator('#dl-helper')).toHaveText('Deleting…');
    await shot(p, 'delete-deleting');
    await releaseKdf(p);
    await expect(p.locator('#dl-notice-line')).toHaveText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
    await shot(p, 'delete-send-open', {ready: p.locator('#dl-unlock')});
    await set(h.sw, {v1_vault: null});
    await go('mode=delete');
    await expect(p.locator('#dl-notice-line')).toHaveText("This wallet's stored data is damaged.");
    await shot(p, 'delete-damaged');
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_vault'));
    await go('mode=delete');
    await expect(p.locator('#dl-notice-line')).toHaveText('No wallet on this browser yet.');
    await shot(p, 'delete-no-wallet', {ready: p.locator('#dl-setup')});
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_pending'));
    // The popup's #11 reads the network, so contained() sees the route at work.
    await set(h.sw, {v1_vault: await makeEnvelope({accounts: 1})});
    await unlockWith(p, h.id, E2E_PASSWORD);
    const q = await h.openPopup();
    await expect(q.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await q.close();
    contained(h);
  } finally {
    await h.close();
  }
});
````

Modify `extension/e2e/visual-vault.spec.ts`:

````diff
diff --git a/extension/e2e/visual-vault.spec.ts b/extension/e2e/visual-vault.spec.ts
index 57923e6..1341140 100644
--- a/extension/e2e/visual-vault.spec.ts
+++ b/extension/e2e/visual-vault.spec.ts
@@ -1,34 +1,16 @@
-import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
-import {mkdirSync} from 'node:fs';
-import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
+import {test, expect, type Page, type Worker} from '@playwright/test';
+import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet} from './popupHarness';
 import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
 import {confirmWords, pastePhrase, setPassword, unlockWith} from './vaultPage';
+import {holdKdf, releaseKdf, shot, vaultTab} from './visualTab';
 
-// Spec B1b-2a §8.6, plan 2: every vault-page state (#1–#6, #8–#10, #39, the accounts and reveal forms)
+// Spec B1b-2a §8.6, plan 2: every vault-page state (#1–#6, #8–#10, #39; the accounts and reveal modes are B1b-2b's visual-settings.spec.ts)
 // and the UI tab's #7 and #40, rendered by the real extension at the design's 412 px width (412 × 916,
 // the mockups' size), saved for the review against index.html (#sNN). Not a pixel diff: an opus-tier
 // reviewer compares each image with the same state using the plan's checklist. Every state asserts its
 // own copy before its shot; a state that lasts a moment (the hold, the cooldown, the wrong-word reset,
 // the mismatch clear) is shot under Playwright's paused clock, and a state that lasts as long as a
 // computation (creating, adding, checking, loading) is held open by the test — never raced.
-const DIR = 'test-results/visual';
-/**
- * The whole column (`fullPage`), except while #3 is held: a full-page capture resizes the view under the
- * pressed pointer, which the page reads as a release (pointerleave) — those shots are the 412 × 916
- * viewport, which holds the whole grid.
- *
- * `ready`: a control the state shows enabled, awaited first — a click runs through the page's one busy
- * gate with its 500 ms floor (rule 6), and a shot taken inside that floor draws every button disabled,
- * which is not the state (Task 18 visual pass: 03-pre-reveal-modal, 39's steps and others were). A
- * full-page shot also moves the pointer off the column first, so no button is drawn hovered.
- */
-async function shot(page: Page, name: string, o: {fullPage?: boolean; ready?: Locator} = {}): Promise<void> {
-  if (o.ready !== undefined) await expect(o.ready).toBeEnabled();
-  const fullPage = o.fullPage ?? true;
-  if (fullPage) await page.mouse.move(0, 0);
-  mkdirSync(DIR, {recursive: true});
-  await page.screenshot({path: `${DIR}/${name}.png`, fullPage});
-}
 const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
 const PASSWORD = 'a long enough password';
 const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
@@ -38,53 +20,6 @@ declare const chrome: {
   storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {set(o: object): Promise<void>}};
 };
 
-/**
- * A vault-page tab at the mockups' size, with the clock installed (it follows real time until paused)
- * and the Argon2id worker's answer holdable: `holdKdf()` keeps the next KDF result back until
- * `releaseKdf()` — a test-only wrapper around this page's Worker, so "Creating your wallet…" and
- * "Waiting for your passkey…" stay on screen while they are asserted and shot.
- */
-async function vaultTab(h: Harness, path: string, o: {passkeyCreate?: 'null'} = {}): Promise<Page> {
-  const page = await h.ctx.newPage();
-  await page.setViewportSize({width: 412, height: 916});
-  // A settled blank document first: installing the clock into a page still being created failed once
-  // ("Cannot read properties of undefined (reading 'controller')", fix round 1 run).
-  await page.goto('about:blank');
-  await page.clock.install();
-  await page.addInitScript(stub => {
-    type Held = {hold: boolean; queue: (() => void)[]};
-    const state: Held = {hold: false, queue: []};
-    const w = window as unknown as {__kdf: Held; Worker: typeof Worker};
-    w.__kdf = state;
-    const Native = w.Worker;
-    w.Worker = class extends Native {
-      constructor(url: string | URL, options?: WorkerOptions) {
-        super(url, options);
-        let handler: ((e: MessageEvent) => void) | null = null;
-        super.onmessage = (e: MessageEvent) => {
-          if (state.hold) state.queue.push(() => handler?.(e));
-          else handler?.(e);
-        };
-        Object.defineProperty(this, 'onmessage', {set: (f: (e: MessageEvent) => void) => void (handler = f), get: () => handler});
-      }
-    } as typeof Worker;
-    if (stub === 'null') Object.defineProperty(navigator, 'credentials', {value: {create: async () => null, get: async () => null}});
-  }, o.passkeyCreate ?? '');
-  await page.goto(`chrome-extension://${h.id}/${path}`);
-  return page;
-}
-const holdKdf = (p: Page) => p.evaluate(() => void ((window as unknown as {__kdf: {hold: boolean}}).__kdf.hold = true));
-const releaseKdf = async (p: Page) => {
-  // The hold relies on kdf.ts assigning `worker.onmessage`. Were it to use addEventListener, nothing
-  // would be held and the "creating" / "adding" shots would race the answer — so the held answer must
-  // be there before it is released, and the spec fails loudly otherwise (plan-2 review L6).
-  await expect.poll(() => p.evaluate(() => (window as unknown as {__kdf: {queue: unknown[]}}).__kdf.queue.length), {timeout: 60_000}).toBe(1);
-  await p.evaluate(() => {
-    const k = (window as unknown as {__kdf: {hold: boolean; queue: (() => void)[]}}).__kdf;
-    k.hold = false;
-    k.queue.splice(0).forEach(f => f());
-  });
-};
 const text = (p: Page, sel: string) => p.locator(sel);
 const stored = (sw: Worker): Promise<string> => sw.evaluate(async () => JSON.stringify(((await (chrome.storage.local as unknown as {get(k: string): Promise<Record<string, unknown>>}).get('v1_vault')) as Record<string, unknown>).v1_vault));
````

Create `extension/e2e/visualTab.ts`:

````ts
import {expect, type Locator, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import type {Harness} from './popupHarness';

// The visual specs' shared helpers (B1b-2a plan 2's, moved here unchanged for B1b-2b's visual-settings.spec.ts).
export const DIR = 'test-results/visual';
/**
 * The whole column (`fullPage`), except while #3 is held: a full-page capture resizes the view under the
 * pressed pointer, which the page reads as a release (pointerleave) — those shots are the 412 × 916
 * viewport, which holds the whole grid.
 *
 * `ready`: a control the state shows enabled, awaited first — a click runs through the page's one busy
 * gate with its 500 ms floor (rule 6), and a shot taken inside that floor draws every button disabled,
 * which is not the state (Task 18 visual pass: 03-pre-reveal-modal, 39's steps and others were). A
 * full-page shot also moves the pointer off the column first, so no button is drawn hovered.
 */
export async function shot(page: Page, name: string, o: {fullPage?: boolean; ready?: Locator} = {}): Promise<void> {
  if (o.ready !== undefined) await expect(o.ready).toBeEnabled();
  const fullPage = o.fullPage ?? true;
  if (fullPage) await page.mouse.move(0, 0);
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`, fullPage});
}

/**
 * A vault-page tab at the mockups' size, with the clock installed (it follows real time until paused)
 * and the Argon2id worker's answer holdable: `holdKdf()` keeps the next KDF result back until
 * `releaseKdf()` — a test-only wrapper around this page's Worker, so "Creating your wallet…" and
 * "Waiting for your passkey…" stay on screen while they are asserted and shot.
 */
export async function vaultTab(h: Harness, path: string, o: {passkeyCreate?: 'null'} = {}): Promise<Page> {
  const page = await h.ctx.newPage();
  await page.setViewportSize({width: 412, height: 916});
  // A settled blank document first: installing the clock into a page still being created failed once
  // ("Cannot read properties of undefined (reading 'controller')", fix round 1 run).
  await page.goto('about:blank');
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
export const holdKdf = (p: Page) => p.evaluate(() => void ((window as unknown as {__kdf: {hold: boolean}}).__kdf.hold = true));
export const releaseKdf = async (p: Page) => {
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
````

- [ ] **Step 2: Type-check, build, and run them — contained, then under `unshare -rn`.**

```bash
cd extension
npx tsc --noEmit && npx vitest run
npm run build
npx playwright test e2e/visual-settings.spec.ts e2e/visual-vault.spec.ts
unshare -rn npx playwright test e2e/visual-settings.spec.ts e2e/visual-vault.spec.ts
```
Expected (dry run): tsc clean; whole vitest suite Test Files 133 passed (133) · Tests 2322 passed (2322); every listed spec passes in both launches (counts in "Dry-run record" below). An E2E spec is not "red first" — the code it drives exists; its red proof is the mutations in the next step.

- [ ] **Step 3: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M20a** — 36e toast absolute (the design default): out of view — `extension/src/app/app.css`:

  ```diff
  -   position: fixed;
  -   bottom: calc(80px + var(--space-4));
  +   bottom: calc(80px + var(--space-4));
  ```
  `npm run build && timeout 300 npx playwright test e2e/visual-settings.spec.ts:45` — Expected: **red** (dry run: 1 failed (Playwright)).

- [ ] **Step 4: Commit.**

```bash
git add extension/e2e/visual-settings.spec.ts extension/e2e/visual-vault.spec.ts extension/e2e/visualTab.ts
git commit -F - <<'MSG'
feat(extension): The visual pass (§8.4): every plan-1 state, popup at 412 × 600 and the vault tab at 412 px

Co-Authored-By: <the executing model's own line>
MSG
```


## Dry-run record (each finding fixed in the code above)

The end state was built task by task in a scratch git repository outside the checkout (a `git archive` of this branch at db57fa9), one commit per task; the plan's code blocks are generated from those commits, and applying every block of this document in order onto a fresh archive of db57fa9 reproduces the dry-run tree byte for byte (165 blocks; no difference). Then:

- **Per-task replay** (copied `node_modules`): each task's unit test files on its predecessor's tree — red for every task 1–17 (the counts are in each task's Step 2); at each task — `tsc` clean, the task's own tests green, the whole vitest suite green, `node scripts/build.mjs` + `npm run gates` green. Final: **Test Files 133 passed (133) · Tests 2322 passed (2322)** (rev 2).
- **E2E, contained, normal launch:** 44 passed (44) — the 2a/2b specs plus the PRF probe, specs 14, 15 ×4, 16, 17, 18 ×2, the CSP spec over every new mode and both visual specs.
- **E2E under `unshare -rn`:** 44 passed (44) — the PRF probe included.
- **CI reproduction on Node 22.12.0 / npm 11.6.2 with ONLY `web/` and `extension/` installed** (`npm ci --ignore-scripts`; no root `node_modules`): web `npm run verify` green (Test Files 43 passed (43) · Tests 548 passed (548), plus its script tests 3 passed); extension `npm run verify` green (build, vitest 133 files / 2309 tests, CSP, secrets, every gate, reproducible — chrome `sha256:b3441db4…`, firefox `sha256:84db4b32…`); `npm run e2e` 44 passed, and under `unshare -rn` 44 passed.
- **Root:** `npx tsc --noEmit` clean; `npx jest` 180 suites passed, 1 skipped; 1234 tests passed, 1 skipped (no task touches the root).
- **TGE gate:** `node scripts/check-no-tge-date.mjs` clean over the end state and this plan.
- **Mutations:** every named mutation above was run alone in a scratch `git archive` copy under `timeout 300`; all 59 are red (rev 2: the 39 of rev 1 plus 16 clause mutations of `onlyPasswordChanged`, the unwrap half of `rewrapPassword`, the two M1 mutations and the H1 marker — each task's Step "Mutations" gives its count).

**Rev 2 re-run (after review 1):** the per-task replay from Task 3 onward (every task after a changed one: Tasks 3, 8, 13, 18, 19, 20 changed) — each task's tests red on its predecessor and green on its own tree, tsc, gates; the whole suite 133 files / 2322 tests; E2E contained 44 passed (44) and under `unshare -rn` 44 passed (44); all 59 mutations red in a fresh `git archive` copy. One whole-suite run at Task 17 reported 1 failed of 2322 once; the same tree then passed three full runs in a row and Task 18's identical vitest tree passed — not reproduced, so not identified, and recorded rather than hidden (plan 3 of 2a recorded the same kind of transient). Root `tsc`/`jest`, web `verify` and the Node 22.12 CI reproduction were not re-run: rev 2 changes nothing under the root `src/`, `core/` or `web/`, and no dependency.

What the dry run caught:

1. **The vault-isolation gate failed on copy, not code (Task 13).** The approved tip on the passkey screen names `wallet.noc-tura.io`; the gate's passkey marker was that RP ID. Fixed by a code-only marker and a new gate test (Scope 3.14) — flagged for the controller as a security-gate change.
2. **36e's toast was out of view (Task 17).** The design's `position: absolute` placed it at the foot of the scrolled list in the popup; it is `fixed` now (Scope 3.2); mutation M20a (absolute again) turns the visual spec red at `toBeInViewport`.
3. **The PRF probe failed once in the full E2E run** with `NotAllowedError: … the page does not have focus` (another page held focus). `addPrfAuthenticator` now brings the tab to the front (Task 18); the probe then passed in four full runs (normal and `unshare -rn`, on Node 24 and on Node 22.12).
4. **Two 2a specs broke on plan-1 changes:** `visual-vault.spec.ts`'s `getByText('Securing your password takes a few seconds.')` matched #36's hidden `changing` line too (scoped to `#pw-creating`, Task 8); `visual.spec.ts` expected 2a's three #31 rows (now the full list, Task 17).
5. **Mutation survivors that became tests:** removing #36's `expired()` re-check after step 2's same-password await survived — a test now lets the deadline pass during that check with the timer suppressed (Task 8, M8a); offering the stored passkey as the factor for a replace survived — the replace test asserts no passkey button (Task 10, M10a); `runReveal`'s `typeof factor.password` guard is an equivalent mutant (a non-string password throws in `unlockWithPassword` → `failed` either way) — the mutation targets the PRF refusal instead (M6b).
6. **An E2E mutation must compile:** the first form of M19a left `shownRevision` unread, `tsc` (inside `npm run build`) failed, and Playwright ran the stale `dist` green — the mutation harness now treats a failed build as invalid, never as red.
7. **Under `unshare -rn` the popup starts offline:** every spec that navigates from #11 waits for its balance first; specs that read nothing from the network end with `quiet(h)` instead of `contained(h)` (whose first assertion is that the route saw requests).
8. **Earlier, while building:** #10's settings branch must re-check the session before issuing the challenge (a test held it); `wallet.state.passkey` changed the expected shape in 2a tests; the accounts manager mounted before `wallet.state` answered and showed empty balance rows (`useAccountBalances` is keyed on the addresses); a reorder lost focus (`keepFocus`); the delete page's source test tripped on a comment that named the forget message (reworded).
9. **Not caused by this plan, left untouched:** the repository's own `node_modules/` contains a self-referencing symlink `node_modules/node_modules` (dated 2026-09-29). The dry run never wrote to the repository's `node_modules`.

## Review 1 (Fable 5.1) — how each finding was applied (rev 2)

Verdict: approve after fixes (Critical 0, High 1, Medium 4, Low 9). Every finding is applied in the tasks above; each code change has a test and a named mutation, and the dry run was re-run for every changed task and for the full end state (Dry-run record, rev 2).

- **H1** (Task 13, Scope 3.14) — a second passkey marker, `webauthn` = `navigator.credentials` (only `src/unlock/browser.ts`; verified against the real build: the unlock bundle only), presence + leak, beside the PRF marker. Gate fixtures: a non-PRF `navigator.credentials.get(…)` in a popup chunk fails; the RP ID in popup prose passes; INCONCLUSIVE when no built JS carries it. Mutation M13c (the marker removed) is red.
- **M1** (Task 8) — #36's step-1 proof checks a `generation` counter bumped by `dropProof()` and by a `pagehide` with nothing held; a proof that settles after is zeroed and the page shows `dropped`. `onReturn('restored')` re-checks the deadline like `visible`. Tests: pagehide during step 1's KDF; `restored` past the deadline. Mutations M8c, M8d red.
- **M2** (Tasks 18, 20) — `withAuthenticatorFocus(page, act)` (`e2e/virtualAuthenticator.ts`) brings the tab to the front before every WebAuthn-driving action: spec 14's passkey add and passkey unlock, the visual pass's add, replace and re-add.
- **M3** (Tasks 8, 11, Scope §4) — the prose now matches the code: 20 s (2a's `REVEAL_MS`; Task 11 says `REVEAL_MS`, `HOLD_MS` and `TICK_MS` are not changed) and 600 ms (2a's `MISMATCH_CLEAR_MS`).
- **M4** (Tasks 3, 11) — (a) one named mutation per clause of `onlyPasswordChanged`, M3d–M3s, each run and red. Running them found what the review assumed covered: eight clauses had no refusal case that differed in that field alone (version, algorithm, memory, parallelism, credential id, PRF salt, an account removed, an index changed under the same key). Each now has one; version and algorithm are refused by the shape check before the rule runs, so the rule's own clauses are held by a direct test of the exported `onlyPasswordChanged`. (b) `rewrapPassword`'s unwrap half has a failable test (the platform's `wrapKey` made to wrap a different key); M3t (that half deleted) is red. (c) Task 11 states that verify's proof is `runReveal` — one guard (D23, Task 6) for both modes.
- **L1** (Task 13) — the manifest-only fixture now tests the webauthn marker found only in a non-JS file; its comment says why.
- **L2** (Scope 3.15) — O29 on verify's Back declared for the owner.
- **L3** (Scope 3.16) — #36 `failed` with `[Start again]` declared.
- **L4** (Task 3) — `HeldProof` is frozen, not minted; the task says why a forged one gains nothing.
- **L5** (Task 14) — the Interfaces block says Task 15 widens `useAccountBalances`' return type.
- **L6** (Scope §2) — plan 2 re-pins the design-ext hash in the task that regenerates it.
- **L7** (Task 18) — spec 16's comment names its dependency on `#seed-grid`'s `tabindex="0"`.
- **L8** (Scope, "Owner-confirmed copy") — the two AT labels were listed beside "1 outstanding task." for the owner, who confirmed all three on 2026-10-05: O89–O91, added to the spec's §12 table in this revision's commit.
- **L9** (Task 18, Scope 1) — "the first E2E task", not "runs first": Playwright may order the files differently, and both the probe and spec 14 fail, never skip.

## Before the PR (the standing rules)

- [ ] Reproduce CI with **only** `web/` and `extension/` installed, on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`), npm 11.6.2: `npm ci --ignore-scripts` in both, `npm run verify` in both, `npm run e2e` in `extension/` — in a normal launch and under `unshare -rn`.
- [ ] No task touches the repository root's `src/` or `core/`; run the root `npx tsc --noEmit` and `npx jest` anyway (the dry run did).
- [ ] `node scripts/check-no-tge-date.mjs` from the repository root — this plan and every file it adds are clean.
- [ ] The opus-tier visual review of Task 20's shots (against index.html #31, #35, #36, #37, #6, #3, #4 with §8.4's checklist) is in the PR description: each finding fixed or declared in the spec's Differs.

## Self-review

- **Spec coverage.** §1.2 pages and §1.3 routes (Task 7); §1.5 partition (Tasks 3, 4, 6 — `VAULT_PAGE_ONLY` + the vault-isolation named list, Tasks 8–11); §1.6 CSS (Task 8, hash pinned); E9 (Task 2), E10 (Tasks 3, 8), E11 (Tasks 6, 9), E12 (Tasks 4, 10, 13), E13 (Tasks 5, 12), E14 (Tasks 1, 14), E15 (Tasks 1, 6, 11), E16 (Tasks 6, 11); §3.1 (Task 8), §3.2 (Task 9), §3.3 (Task 10), §3.4–§3.5 (Task 11), §3.6 (Task 12), §3.7 (Task 2); §4.1 (Task 17), §4.2 (Task 16), §4.3 (Task 14), §4.4 (Task 13); §5 (Task 15); §8.1–§8.2 (every task's tests and mutations); §8.3 specs 14–18 (Tasks 18, 19; spec 19 is plan 2); §8.4 (Task 20); §11 items 4 (Scope 3.4), 9 (Task 18: PRF probe passes), 13 (Task 2: the range re-check), 17 (Task 8, C20), 18–19 (Tasks 9, 15, C17). C1 (Task 2), C2/C20 (Tasks 3, 8), C3/C4 (Tasks 4, 10), C5 (Tasks 5, 12, 19), C6 (Task 15's funded/unknown lines; the background's guard is 2a), C7 (Task 1), C8 (Tasks 6, 16, 17), C10 (Tasks 3, 17), C13 (Task 15), C14 (Tasks 7, 12, 14), C15 (Task 16), C17 (Tasks 9, 15, 19). C9, C11, C12, C16, C18, C19 are plan 2's or unchanged 2a behaviour (C11: E5's proof and `addPasskey` keep not comparing with the session, as ruled).
- **Rule 6.** #31's rows, #35's options and rows, the passkey screen's buttons, the manager's moves/rename/remove/continue, #37's hold and Cancel are `LockedButton`s or the `HoldButton`; every vault-page action runs through `exclusive()`. Each has a double-press test with `disabled` lifted.
- **Generation checks.** #36 after each await (`held !== proof`, phase, `expired()` — M8a kills its removal; step 1's `generation` counter for a `pagehide` during the KDF — M8c; `restored` — M8d); the delete page's revision re-read before the KDF (C17); the passkey page's retry; reveal/verify's `drop()` on leave; the manager's and #37's balances (`useAccountBalances`: an `alive` flag, keyed on the addresses so a list that arrives after mount still loads); the manager's order write answered `stale` → re-read; #31's and #35's settings reads (`alive`); #31's toast timers cleared on unmount.
- **Placeholders.** None: every step has its code (new files in full, changes as exact diffs), its command and the dry run's expected output; the one generated file has its generator and its hash.
- **Type consistency.** The Interfaces blocks are the exports as they compile; the replay compiled and tested every task on its own predecessor (Dry-run record).
- **O-list.** Every visible string is O01–O66, a 2a string, or a design string the spec quotes; the three the plan added — "1 outstanding task." and the AT labels "Close" (vault page) and "Updating your password" — are owner-confirmed O89–O91 (Scope). The aria names "Move <name> up/down" and "Remove <name>" are O52–O54.

## Execution handoff

Plan complete. Execute with superpowers:subagent-driven-development (a fresh implementer per task, the two-stage review between tasks; Tasks 3, 8 and 9 — the password change and the delete binding — reviewed as the security core; Task 20's shots reviewed by an opus-tier reviewer), or superpowers:executing-plans in one session with checkpoints.
