# Noctura Extension B1b-2a — the daily wallet screens

**Status:** draft, 2026-09-29. Awaiting the owner's review, then the implementation plan.

**What this is.** The screens of the owner's design (`/home/user/Downloads/index.html`,
`/home/user/Downloads/screen.md`) built on the B1b-1 wallet engine that is already merged:
onboarding, unlock and re-authentication (the vault page), the dashboard, send, receive, the
transaction flow, activity, the offline and server-refused states, an account switcher and a
minimal Settings tab. It also adds the four engine extensions the owner listed. B1b-2b
(settings and security) is a separate spec.

**Sources.** Owner decisions `.superpowers/sdd/b1b2a-decisions.md` (binding); screen inventory
`.superpowers/sdd/b1b2-screen-inventory.md`; parent spec
`docs/superpowers/specs/2026-09-27-extension-b1-design.md` (rev 5 + coordinator answers); the
engine in `extension/src/background/*`, `extension/src/unlock/*`; `web/src/ui/*` and
`web/src/styles/design-system.css`.

**How to read the per-screen sections.** Every design state is listed with its copy. Copy in
"quotes" is the design's English, unchanged, unless it is marked **→ adapted**. Each adapted
string names the decision or engine fact that forces the change. Each screen ends with a
**Differs from the design** list. Everything the design shows that this spec does not build is
on that list, with where it goes (CLAUDE.md: "never silently omit design elements").

---

## Decisions

The owner's decisions for this spec, from `b1b2a-decisions.md`, with how the spec applies them.

| # | owner decision (substance) | applied here |
|---|---|---|
| Split | B1b-2 = **B1b-2a** (daily wallet, this spec) + **B1b-2b** (settings & security: full #31, #35, #36 change password, #37 delete wallet, passkey management, reveal-phrase screen, accounts manager beyond the switcher, address book #15, with their engine extensions). Each its own spec, plan, PR | §9 lists what B1b-2b takes |
| UI stack | **React 18 like `web/`**, reusing `web/`'s `design-system.css` tokens and components (AddressGroups, CopyButton…) where they match the design | §1.3, §1.7 |
| D1 | Remove the "Screenshots disabled" banner | #3, #4, #5, #8, #9, #10 |
| D2 | Refresh on popup open + a small refresh button | #11, #26, #41, #42 |
| D3 | Bottom tab bar **Home / Activity / Settings** (80 px, as the design's bar) | §1.4 |
| D4 | Hide the shielded toggle and variants (B2) | every screen with a shielded variant |
| D6 | Remove the "ZK-private" chip on #1 | #1 |
| D7 | PIN → **password (≥ 12 chars)**; rewrite all "PIN" copy; the strength meter shows only the length rule | #2, #4, #5, #9, #10, #39 |
| D8 | On #8 import: "the seed is also the root of the phone's future shielded keys" + "accounts beyond the first exist only in the extension" | #8 |
| D9 | Passkey: optional step after the password on #6 (tab); management in B1b-2b | #6 |
| D10 | #40 in the tab: "Wallet is ready — open the Noctura icon" | #40, and #7 by the same rule (§3.7) |
| D11 | Wrong password: engine backoff only (≤ 30 s); no counter, no wipe | #9, #10 |
| D12 | Unlock and re-auth in a tab (as the parent spec) | §1.2, #9, #10 |
| D13 | QR scan #14 omitted in B1b-2a (paste the address) | #12 |
| D14 | Account switcher derived from **#43's bottom sheet**: accounts with balances, select, rename, "Add account"; opened by tapping the avatar/account name on #11 | §5.2 |
| D15 | Priority chips dropped (automatic priority; fee shown) | #12, #20 |
| D16 | `.sol` dropped | #12 |
| D17 | Encrypted backup file removed | #7, #8 |
| D18 | Token selector = #43's bottom sheet, as a list | #43 |
| D19 | Share → copy only | #13, #27 |
| D21 | #19 simulate: **extend the engine** for balance changes (before/after for SOL and the token) from the simulation, so #19 is as designed. A failed simulation stays refused (no "Continue anyway" — B1c's dApp path) | E2, #19 |
| D22 | Typed "CONFIRM" replaced by the engine's re-authentication | #20 |
| D23 | #54 **safe variant**: "Send again (same transaction)" + wait for expiry → "Not confirmed — no funds moved" → "Try again". The design's layout, only the levers differ | #54 |
| D24 | Activity filters All / Sent / Received / Purchases, and a generic row for "other" | #26 |
| D25 | "View popular dApps" removed (B1c) | #41 |
| D26 | Own banner for the 403 cool-down: "The server is not answering for now — try again in 10 minutes." | §7.2 |
| D27 | USD only | all fiat |
| D28 | Notifications and bell dropped | #11 |
| D34 | Token detail #28 and portfolio #25 not in B1b-2a | #11 |
| Settings | Settings tab in B1b-2a: minimal rows only (Lock, Accounts, About); full #31 in B1b-2b | §6.1 |
| Engine | Four extensions: prices; simulation balance changes for #19; a description of the action behind a re-auth challenge, read by the vault page from the background and never taken from a URL; locally cached last balances, marked stale until refreshed | §2 |
| Carried | `wallet.send` 'check-pending' / 'failed' → wallet.pending, never "nothing sent"; 'prepared-expired' → re-prepare carrying the challengeId, `wallet.preparedFor` to resume; fee reason 'status-unknown' → visible "No Noctura fee (status unknown)"; rule 6 (≥ 500 ms lock); full addresses in groups of four at equal weight, labels, first-send warning; clipboard not auto-cleared and the screen says so; never write the TGE date | §7, and each screen |

Owner answers to this spec's first draft (2026-09-29), and one controller ruling:

| # | answer (substance) | applied here |
|---|---|---|
| D35 | #39 → import works in B1b-2a: the **engine half of delete-wallet** moves into B1b-2a, **with re-authentication, via the vault page**. The #37 screen stays in B1b-2b | E5, #39, #8 |
| D36 | #42 offline: **Receive stays enabled** (the address is local); Send disabled. A deviation from the design, recorded | §5.4 |
| D37 | Explorer: **Solscan as in the design** (`https://solscan.io/tx/<signature>`), a link only, never fetched | S5, #27, #44, §6.5 |
| C1 | Controller ruling on the first draft's conflict 3: a read-only engine message **`wallet.recipientInfo`**, so #12 renders as drawn; the first-time-recipient warning goes back on #12 and stays on #20 | E6, #12, #20 |
| — | simulateTransaction's `accounts` through the proxy: keep E2 as specified; ICO Claude confirms the proxy forwards `accounts` unchanged before E2's task starts, and the plan's first task checks it — **confirmed 2026-09-29** (§11.5) | E2 precondition |
| — | Keep the three-plan split under this one spec | §12 |

Owner answers and controller rulings after the independent review (Fable 5.1, round 1,
`.superpowers/sdd/b1b2a-spec-review-1.md`; every finding B1, H1–H4, M1–M8, L1–L7 is applied), and
round 2 (`.superpowers/sdd/b1b2a-spec-review-2.md`: R2-H1, R2-M1–M5 and R2-L1–L7 applied; C5 and
C6 below):

| # | answer / ruling (substance) | applied here |
|---|---|---|
| D38 | After #10: **no auto-send**. After a proven re-auth, the **same tab** shows #20 with a fresh preview and the Send button — **one user tap per broadcast, always**. Replaces S3; resolves B1. A deviation from the design ("#10 executes send") | §4.5 (the one statement), §1.6, §3.10, §7.4 |
| D39 | A still-live challenge carried into a re-prepare of the **same intent** gets a fresh 120 s (re-based `expiresAt`; same digest, not a new grant). A `vault.reauthOk` answered `unknown-challenge` shows #10's `expired` state, never `failed` | E3, #10, #20 |
| D40 | A restore (#39, replacement proven by the seed) **keeps `v1_known_recipients`** (the same wallet is proven). A delete without replacement wipes them | E5 |
| D41 | #40 "Try a different seed" is **built in B1b-2a** as designed, using E5 | #40, E5 (§11 item 13 records how, since C4 forbids a replacement with other keys) |
| C2 | `wallet.discardPrepared {account}` (privileged, partition-tested): drops that account's prepared sends and any send challenge bound to their intent; called by #10 [Cancel send], #20 [Cancel], Esc/back past #19. After it, `preparedFor` returns null. No toast claim that cannot be true | E7, #10, #19, #20, #44 |
| C3 | `failure: 'landed' \| 'not-sent' \| null` on PendingRecord/PendingView, set where the engine writes each `failed`; #44 keys on it, `detail` stays the caption | E8, #44 |
| C5 | The challenge re-base (D39) is **capped**: a challenge records `issuedAt`, and no re-base extends it past `issuedAt + 10 min` (`CHALLENGE_MAX_LIFE_MS`). #20's automatic re-prepare at the quote's end runs **at most once without user input**; after that "Quote expired — refresh", and refresh is a tap (review R2-H1) | E3, §4.5 |
| C6 | D41's delete is guarded **in the background**: `vault.forgetWallet {…, guard: 'unfunded'}` reads every envelope account's balances through `deps.reader` inside E5's critical section, before the lock; any non-zero → `funded`, any read failure → `unreachable` (a 403 stays `coordinator-refused`). The vault page still never touches the network (review R2-M4) | E5, #8 retry, #40 |
| C4 | E5's `replacement` binding is enforced **in the background**: `replacement.scheme === stored.scheme` and identical `{index, publicKey}` sets, else `malformed`; mutation test | E5 |

The inventory's decision numbers D20 (address book) and D29–D33 (CSV/diagnostics, auto-lock
picker, #35's staking row, delete wallet, reveal phrase) belong to B1b-2b by the split. D5 (UI
stack) is the "UI stack" row above.

Decisions this spec takes itself (Claude, marked so the owner can overrule each):

| # | choice | why |
|---|---|---|
| S1 | The vault page stays **plain DOM, no React**. It gets the design's look through shared CSS and its own small DOM helpers | The seed lives in that page. A render library there is a large third-party surface in the one page that must stay small. The gate enforces it (§1.2) |
| S2 | The whole onboarding run (#1 → #6, #8, scheme choice, password) is **one vault page**. #7 and #40 are shown by the UI tab (`wallet.html`), which the vault page opens after the wallet is stored | #7 and #40 need balances and prices from the network, which the vault page never touches (§1) |
| S3 | After a re-authentication for a send, the vault page hands over **in the same tab** to the UI tab (`wallet.html`), which shows #20 with a fresh preview. It does not tell the user to reopen the popup. **Superseded in part by D38:** the send itself always needs a tap on #20 | The first draft auto-sent here; the review (B1) showed that let a resume broadcast without a tap (§4.5) |
| S4 | UI-only preferences (hidden balance, last activity filter) live in the UI's `localStorage` | They carry no security meaning, and the owner listed no engine store for them. The isolation gate forbids `storage.*` outside the background but allows `localStorage` |
| S5 | Explorer link: `https://solscan.io/tx/<signature>`, as the design says — **confirmed by the owner as D37** | The design names it. `web/` uses explorer.solana.com; the extension follows the design (§6.5) |
| S6 | QR: the `qrcode-generator` package, pinned exact, zero dependencies, rendered by our own SVG component; no CDN | Parent spec §4: "a small reviewed library with no dependencies" |

---

## 1. Architecture

### 1.1 Three surfaces, three HTML entries

| entry | bundle | size | what it shows |
|---|---|---|---|
| `popup.html` → `src/app/popup.tsx` | UI (React) | 412 × 600 px | the daily wallet: #11 and everything reached from it, #42 as a state of #11, the switcher, Settings, #38 |
| `wallet.html` → `src/app/tab.tsx` (**new**) | UI (React), the same app as the popup, `surface="tab"` | full tab; the app renders in a 412 px column centred on `--bg-base` | #7, #40, and a send finished after re-authentication (#20 resumed → #21 → #54/#44) |
| `unlock.html` → `src/unlock/main.ts` | vault page (plain DOM, S1) | full tab; a 412 px column centred on `--bg-base` | #1, #2, #3, #4, #5, #6, #8 (+ scheme choice + password), #9, #10, #39, the add-account form, the B1b-1 reveal form |

`popup.tsx` and `tab.tsx` are two-line wrappers that mount `<App surface="popup" | "tab" />`
from `src/app/App.tsx`. The background entry is unchanged apart from §2 and one
`runtime.onInstalled` listener (reason `install` → `tabs.create({url: 'unlock.html?mode=welcome'})`;
`tabs.create` needs no permission).

### 1.2 The vault page: the design's look without non-vault code

The seed and the password only ever exist in the vault page bundle. So every screen that shows or
takes them **is a vault-page mode**: #3 and #4 show the seed, #5 and #9 take the password, #8
takes the phrase, and #6 and #10 take the password or passkey. #1, #2 and #39 hold no secret. They
live in the vault page too because they sit in the same run: #1 → #2 → #3 keeps one page, so the
new mnemonic never crosses a navigation.

**Modes** (`src/unlock/mode.ts`, extended; anything unknown is still `unlock`):

| `?mode=` | starts at | notes |
|---|---|---|
| `welcome` | #1 | opened on install and by the popup when no wallet exists |
| `create` | #2 | (B1b-1 name kept) |
| `import` | #8 | `&source=forgot\|retry` (a closed enum): #39's restore (seed proof) or #40's "Try a different seed" (password first), both on E5 |
| `unlock` (default) | #9 | optional `&return=imported\|created` (#40, #7), a closed enum, never a URL. There is no `send` value: a lock clears prepared sends, so there is nothing to return to (review M7) |
| `forgot` | #39 | |
| `reauth&challenge=<32 hex>` | #10 | the description comes from `vault.challengeInfo` (E3), never from the URL |
| `accounts` | add-account form | restyled; remove stays the B1b-1 form (B1b-2b designs the manager) |
| `reveal` | B1b-1 reveal form | restyled with the tokens only; B1b-2b builds the designed screen |

The accounts and reveal password fields keep B1b-1's visible `<label for>` "Password" (plan-2 visual
pass: Task 14 had replaced it with an `aria-label`, which names the field for a screen reader but
tells a sighted user nothing on a form with no other instruction). `minlength` and `required` stay
dropped, as on #9 and #10: the page answers a short or empty password in its own helper line, and the
browser's validation bubble would answer instead with words this spec does not have.

**How the design's look gets there without importing non-vault code:**
1. **CSS only is shared.** `src/unlock/main.ts` imports two stylesheets:
   `../../../web/src/styles/design-system.css` (the one source of the tokens and type tiers) and
   `src/styles/design-ext.css`. The second holds the design classes that `web/` lacks, copied
   from `index.html`'s `<style>` under the same class names: `.banner(.info|.warning|.danger)`,
   `.chip`, `.s8-sheet`, `.skel-line/-circle/-tile`, `.status-pill`, `.tab-bar`, `.copy-toast`,
   `.s7-group-label`, `.s7-row`, the step counter, the word grid, the hold overlay, the keypad-free
   unlock card. A stylesheet cannot carry code into the page. Vite emits it as a `.css` asset.
2. **Vault-local DOM helpers** in `src/unlock/view/`: `stepHeader`, `banner`, `wordGrid`
   (2 × 12, column-major), `holdToReveal`, `passwordPair` (with the length-rule meter),
   `addressGroups` (a DOM twin of `web/`'s `AddressGroups`: groups of four, gaps in CSS, so a copy
   yields the exact address), `formatBaseUnits` (imported from `src/shared/amount.ts`, a pure
   module with no imports). Static markup stays in `unlock.html`'s sections, restyled.
3. **Every string** the page sets is a literal in `src/unlock/strings.ts`. The only other text
   it ever shows is the user's own words (#3, #4, #8) and, on #10, the validated challenge fields
   (E3), which come from a closed alphabet.

**The isolation gate grows accordingly** (`scripts/check-vault-isolation.mjs`, each rule with a
mutation test in `scripts/__tests__`):
- *Vault-page import allowlist (new, sources).* Every file reachable from `src/unlock/main.ts`
  must be one of: `src/unlock/**`, `src/vault/**`, `src/shared/**`, `src/ui/send.ts`,
  `src/styles/*.css`, `../web/src/styles/design-system.css`, `../core/keys/**`,
  `../core/util/**`, or a package in `{@noble/curves, @noble/hashes, @scure/base, @scure/bip39,
  micro-key-producer}`. So `src/app/**`, `react`, `react-dom` and `../web/src/ui/**` cannot reach
  it.
- *Stand-alone shared modules (new, sources; review M4).* `src/shared/amount.ts` and
  `src/unlock/strings.ts` join the `readLocal` rule's pattern: they may import nothing at all. The
  vault allowlist admits all of `src/shared/**`, so without this rule a shared file importing
  `src/app/**` would carry UI code into the vault page through an allowed door. Fixture: a
  `src/shared` file importing `src/app/x.tsx` → violation.
- *No React in the vault bundle (new, built output).* A React-only marker must be absent from every
  file reachable from `unlock.html`. The marker is **React 18's** internal export name
  `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`, which exists only in `react`/`react-dom`
  18. React 19 renamed it (`__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`), so
  the marker must also be **present in some built file**, else the gate reports INCONCLUSIVE and
  fails. That is what a React upgrade will trip, and the gate's message says to update the marker.
- *ENTRIES* becomes `{popup.html: src/app/popup.tsx, wallet.html: src/app/tab.tsx, unlock.html:
  src/unlock/main.ts}`. The existing rules carry over unchanged: no vault code in the UI bundles,
  no `storage.*` outside the background, runtime listeners only in the background, `unlock.html`
  never reaches `background.js`, the 6 markers. The existing "may load only its own entry" rule
  covers `<script>`. A Vite-injected `<link rel="stylesheet">` is not a script and stays allowed.
- `BACKGROUND_OWNED_KEYS` gains `v1_balance_cache` and `v1_price_cache` (E4).
- `vault.challengeInfo` (E3) and `vault.forgetWallet` (E5) join `VAULT_PAGE_ONLY`.
- *The browser keeps every CSS *load* off the vault page (controller hardening, 2026-10-01).* A stylesheet on the
  page that holds the seed and the password is an exfiltration surface: an attribute selector on an
  input's value plus a `url()` reads the field. Three review rounds of the text gates each found a new
  spelling that reached the built page, so the extension CSP now enforces it in the browser: it gains
  `default-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none';
  form-action 'none'; frame-ancestors 'none'` (script-src, object-src and connect-src unchanged; the
  full policy is in the parent spec, §5). No inline `<style>`/`style=""`, no remote sheet, image or
  font. The gate stays as the backstop: the vault page's sheets are read by a tokenizer
  (`scripts/css-scan.mjs`: comments removed to nothing, strings and escapes read whole) — every
  `url()` one of the two Geist faces, no `@import`, no `image-set()`/`image()`/`cross-fade()`/`src()`,
  no backslash, in the sources and in the built text; every CSS language Vite compiles is a sheet,
  and any non-`.css` sheet reaching the vault page is refused; `unlock.html` carries no `<style>`,
  no `style` attribute and no `<link>` in source, and in the build only links its own built
  stylesheets; and `src/unlock` (sources) and the chunks `unlock.html` loads (build) create no
  `<style>`/`<link>` element, construct or adopt no sheet, insert no rule and set no style
  attribute, declaration text or inline style (`.style`, `setProperty` — a CSSOM write the CSP
  allows; the vault page toggles classes instead). One exception (controller ruling, 2026-10-01, for
  #9/#10's conic-gradient cooldown ring): exactly `<el>.style.setProperty('--vlt-<name>', <value>)`,
  the name a literal matching `^--vlt-[a-z-]+$`, the value formatted from a number inside the same
  module (`ringShare(n: number)` in `view/cooldown.ts`), never a string parameter, `url(`, `var(` or
  a quote; the built chunks may carry only that literal shape. `createElement` taken as a value
  (`.bind`, `.call`, a destructured or assigned reference) is refused too. The gates are a backstop,
  with known limits: a member read of `.style` by a name computed at run time
  (`body[location.hash…]`), a type cast into the `--vlt-` formatter, and an aliased `h`. Under the
  CSP each of these can at most change how the page looks, never load anything.
- *Fonts from the vault page (review L5).* `design-system.css` loads `/fonts/*.woff2` by an
  absolute path. With Vite's `base: './'` a `public/` asset referenced absolutely stays
  `/fonts/…`, which resolves against the extension origin's root from any page, the vault page
  included. The build test asserts both woff2 files exist at `dist/app/fonts/` and that the
  built `unlock` CSS names `/fonts/Geist-Variable.woff2`. E2E spec 1 asserts on `unlock.html` that
  `document.fonts.load('16px Geist')` resolves to at least one face — the real assertion, since
  `document.fonts.check()` is also true when no face named Geist exists at all — and keeps
  `check('16px Geist')` beside it (plan-2 review ruling 5).

### 1.3 The UI bundle (popup and tab)

- **React 18.3** and `react-dom`, the versions `web/` pins, added to `extension/package.json`, with
  dev dependencies `@vitejs/plugin-react`, `@testing-library/react` and `happy-dom`. They install
  with `npm ci --ignore-scripts` like everything else.
- **Reused from `web/` by import** (no copies): `web/src/ui/AddressGroups.tsx`, `CopyButton.tsx`,
  `Icon.tsx`, `BrandMark.tsx`, and `web/src/styles/design-system.css`. `vite.config.ts`'s
  `coreResolvesFromHere` plugin is widened to `sharedResolvesFromHere`: a bare import made by a
  file under `../core/` **or `../web/src/ui/`** resolves from `extension/`, so `react` is
  extension's single copy. `check-rpc-methods.mjs` and the vault gate follow imports into
  `../web/src/ui/` the way they follow `../core/`. Those files may not fetch; `CopyButton` uses only
  `navigator.clipboard`.
- **Extension-local components** (`src/app/ui/`): `Banner`, `Sheet` (`.s8-sheet`, 70 % height,
  grabber, Esc and backdrop close, focus trap), `Toast`, `Skeleton`, `Chip`, `StatusPill`,
  `ListRow` (`.s7-row`), `TabBar`, `StepHeader`, `TokenTile` (the design's synthetic gradient
  token icon, no third-party logos), `QrCode` (S6), `ExtIcon` (the glyphs `Icon` lacks: eye,
  eye-off, arrow-up, arrow-down, refresh, home, activity, settings, plus, pencil, close, back,
  wifi-off, lock, spinner; drawn at `Icon`'s stroke style), `LockedButton` (rule 6, §7.6).
- **Fonts:** `design-system.css` loads `/fonts/Geist-Variable.woff2` and
  `/fonts/GeistMono-Variable.woff2`. The two files are copied into `extension/public/fonts/`, so
  they resolve against the extension's own origin. CSP needs no change: fonts from `'self'`, no
  `connect-src` involved.
- **Platform calls** live in `src/app/platform.ts`: `tabs.create`, `runtime.getURL`,
  `runtime.getManifest().version`, `window.close`. It never names `storage`
  (the gate forbids it) and never listens to runtime messages.

### 1.4 The popup's 412 × 600 layout

- `html, body { width: 412px; height: 600px; overflow: hidden; background: var(--bg-base) }`. The
  app root is a column: top bar 56 px, a scrolling content region (`overflow-y: auto`, no
  horizontal scroll at 412 px), then either the **tab bar** (80 px, `.tab-bar`, Home / Activity /
  Settings, D3) on the three tab screens, or a **sticky action bar** on flow screens.
- Height budget: tab screens 600 − 56 − 80 = 464 px of content; a flow screen with one CTA
  (56 + 2 × 12 padding) leaves 464 px; with two stacked CTAs (2 × 56 + 8 + 24) it leaves 408 px.
  No bar in B1b-2a stacks three CTAs: #19's third one ("Continue anyway") is gone by D21.
- The mockups are 412 × 916. Content keeps the design's order and spacing and scrolls. Nothing
  is dropped to make it fit.
- Touch targets keep the design's minimums (`--touch-target-min` 48 px on every control).
- Keyboard: every control is a `<button>` or `<a>`; `Enter`/`Space` act; sheets trap focus; Esc
  closes a sheet or goes back one step on flow screens (never past a broadcast).

### 1.5 The message client

`src/app/engine.ts` has one typed function per engine message: `state()`, `balances(account)`,
`prices()`, `cached(account)`, `prepareSend(account, intent, challengeId?)`,
`preparedFor(account)`, `send(id)`, `resend(id)`, `pending()`, `history(account, before?)`,
`rename(index, name)`, `select(index)`, `settings()`, `lock()`, `ping()`. Each:
- calls `src/ui/send.ts` (the existing `runtime.sendMessage` wrapper);
- **checks the reply's shape** before any screen sees it: numbers are numbers, base-unit amounts
  match `^\d+$` and become `bigint`, addresses match the base58 alphabet, enums are known. A reply
  of the wrong shape becomes `{ok: false, error: 'failed'}`. A thrown `sendMessage` (the service
  worker restarting) is retried once after 300 ms, then becomes `'failed'`;
- returns `{ok: true, data: T} | {ok: false, error: Code, data?: …}` where `Code` is the union of
  the refusal codes that message can return (§2 and the B1b-1 table).

### 1.6 State and routing

- **The engine is the source of truth.** No state library: web's TanStack Query is not added. The
  engine already caches, paces and latches, and a second cache in the page would disagree with it.
  The app has one React context, `WalletContext`, with `{state, selected, balances, prices,
  pending, stale, offline, refused}`. `useEngineQuery(fn, deps)` exposes `refresh()`. Screens
  read the context and call the client.
- **Popup open sequence** (D2):
  1. `wallet.state` (local). No wallet → `tabs.create('unlock.html?mode=welcome')`, then
     `window.close()`; the popup shows "Opening setup in a new tab…" for that moment. Locked →
     the locked screen (§4.1). Unlocked → #11.
  2. `wallet.cached(selected)` → #11 renders at once with the stale marks (E4).
  3. `wallet.pending` → the pending strip. `wallet.preparedFor(selected)` → if a resumable send
     exists, the popup opens #20 in resume mode. Resume is defined once, in §4.5: it shows #20 and
     **never sends without a tap** (D38).
  4. `wallet.balances(selected)` and `wallet.prices()` → fresh values; the stale marks go.
  5. `activity.ping`, then again on user input at most once per 30 s (the idle timer, parent §2).
- **While open:** `wallet.state` every 5 s (an auto-lock while open switches to the locked
  screen). `wallet.pending` every 2 s while a send is open. No other timer reads the network;
  refresh is on open and on the refresh button (D2).
- **Routing** is an in-memory stack `{screen, params}[]` held in a reducer: push, pop, replace,
  reset-to-tab. There is no router library. The tab surface reads its first route from
  `location.hash`. The only hashes are `#/created`, `#/imported`, `#/send/resume?account=<address>`
  and `#/home`, and the hash only chooses a screen: every value shown comes from the background.
  The address is validated like any address and only selects which `preparedFor` to read. **No
  hash causes an action.** Any extension page, or another extension opening `wallet.html#/send/…`,
  can at most make #20 appear, and #20 waits for a tap (review B1, D38).

### 1.7 Design-system reuse from `web/`

| design element | source |
|---|---|
| tokens, type tiers (`.noc-*`), `.btn*`, `.icon-btn`, `.seg`, `.badge`, `.field-msg`, `.addr*`, `.noc-card*`, `.noc-row`, `.noc-progress` | `web/src/styles/design-system.css`, imported |
| full address in groups of four | `web/src/ui/AddressGroups.tsx` (UI); `src/unlock/view/addressGroups.ts` (vault twin) |
| copy with honest "Copied"/"Copy failed" | `web/src/ui/CopyButton.tsx` |
| icons (18 names) | `web/src/ui/Icon.tsx` + `ExtIcon` |
| logo | `web/src/ui/BrandMark.tsx` |
| banner, chip, sheet, skeleton, status pill, tab bar, toast, list rows, step counter, word grid, hold overlay | `src/styles/design-ext.css`, copied from `index.html` under the same class names (§1.2) |
| amounts | `src/shared/amount.ts`: `parseAmount(text, decimals) → bigint \| null` with `^\d+(\.\d{0,d})?$` where `d` is the token's decimals; `formatAmount(base, decimals, {min, max})`, which truncates and never rounds a balance up |
| valuation | `core/portfolio/value.ts` (`valueHoldings`, `marketTotalUsd`): NOC at stage price, labelled, and outside the market total (spec §4, as `web/`) |

---

## 2. Engine extensions

Four as the owner listed (E1–E4), plus E5 (the engine half of delete-wallet: D35, D40, D41, C4),
E6 (`wallet.recipientInfo`, C1), E7 (`wallet.discardPrepared`, C2) and E8 (`failure` on pending
records, C3), and the re-based challenge life inside E3 (D39). **All engine work lands in plan 1**
(§12). Each is written in the background (`src/background/`), with its unit
tests beside the B1b-1 ones (vitest, node, fake `Ext` and fake `WalletDeps`). Every test that
proves a check comes with a mutation that shows the test can fail.

### E1 — `wallet.prices`

- **Request:** `{type: 'wallet.prices'}`. Privileged (extension origin), any extension page.
- **Reply:** `{ok: true, data: {sol: number | null, usdc: number | null, usdt: number | null,
  noc: number | null, at: number}}`. The first three are USD per whole token. `noc` is USD per NOC
  at the current presale stage price. `at` is epoch ms. Refusals: `coordinator-refused`,
  `unreachable` (E4), `failed`.
- **Computed:** `deps.prices()` (`/wallet/prices?ids=solana,usd-coin,tether`, 60 s cache) and
  `deps.stagePrice()` (`/stats`, strict `stagePriceFrom`, 60 s cache), both already in `deps.ts`.
  The two reads are independent: if one fails, only its fields are `null`. If both fail, the
  reply is the first read's refusal. A 403 from either is never swallowed.
- **Security notes:** only numbers leave the background, re-validated finite and > 0 (else
  `null`, never 0). The UI must render NOC's value as "at stage price" and keep it out of the
  total (`core/portfolio/value.ts`). A lying coordinator can mis-state dollar values. It cannot
  change an amount, and the dollar re-auth rule already fails closed on a missing price.
- **Writes** `v1_price_cache` on success (E4).
- **Tests:** fields map from a fake `/wallet/prices` and `/stats`; one source failing gives
  `null` for its fields only; both failing gives the refusal; 403 → `coordinator-refused` and no
  second request (latch); non-finite or ≤ 0 → `null`; the cache write happens only on success;
  refused from a non-extension origin (partition test).

### E2 — simulation balance changes in `wallet.prepareSend` / `wallet.preparedFor`

**`PreparedView` gains `simulation`** (and `ResumableView` with it, kept in `shown`):

```ts
simulation: {
  slot: number;                       // context.slot of the simulateTransaction reply
  elapsedMs: number;                  // wall time of the simulate call, measured by the engine
  instructions: number;               // compiled instruction count
  programs: ('compute-budget' | 'system' | 'token' | 'associated-token')[];
  recipient: 'wallet' | 'new' | 'program' | 'other';
  sol: {before: string; after: string};                          // lamports, fee payer
  token: {symbol: 'NOC' | 'USDC' | 'USDT'; before: string; after: string} | null; // source token account
}
```

- **Reader change** (`core/solana/rpc.ts`): `simulateTransaction(tx, {accounts?: string[]})`
  sends `{encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, commitment:
  'confirmed', accounts: {encoding: 'base64', addresses}}` and returns `{err, logs, unitsConsumed,
  slot, accounts: ({lamports: bigint, owner: string, data: Uint8Array} | null)[] | null}`.
  **The `accounts` rule (review H2):** the RPC answers `accounts: null` whenever `err` is non-null.
  So when `err === null`, `value.accounts` must be an array of exactly the requested length, else
  `RpcMalformed`. When `err !== null`, `accounts` may be `null`, and the outcome is `{err, accounts:
  null}`, which prepare turns into `simulation-failed` as today. A reply missing `context.slot` is
  `RpcMalformed` either way. Test and mutation: an `err` reply with `accounts: null` must give
  `simulation-failed`, not `failed`. The e2e fake's error path returns `accounts: null`, and its
  happy path returns consistent post-states. `getAccountInfo` gains a sibling
  `getAccountKind(address) → 'missing' | 'wallet' | 'program' | 'other'`: no account →
  `missing`; owner = System Program and not executable → `wallet`; `executable` → `program`;
  anything else → `other`. **One read answers both questions (review L4):** for a SOL send, prepare's
  existing `getAccountExists(recipient)` (which decides `recipient-below-rent`) is replaced by
  `getAccountKind(recipient)`, with `missing` ⇔ not exists. There is no second `getAccountInfo` for
  the same address.
  **No new RPC method**: `simulateTransaction` and `getAccountInfo` are already on
  `ALLOWED_RPC_METHODS`, and `check-rpc-methods.mjs` passes unchanged.
- **Precondition (owner, 2026-09-29): ICO Claude confirms that the proxy forwards `accounts`
  unchanged before E2's task starts, and the plan's first task checks that confirmation** (it
  records the answer, or stops E2 until it arrives). Background: the
  coordinator's `/rpc` allowlist, as recorded in the parent spec's coordinator answers, is
  **per method**. This spec relies on it forwarding `simulateTransaction`'s `accounts` config
  unchanged and not capping its size (2 addresses at most here). If it strips the field, the
  engine sees `RpcMalformed` and #19 shows its failed state for every send. That fails closed, and
  would be found on the first live try. The ask goes into the coordinator list: "confirm `/rpc`
  forwards `simulateTransaction` params, including `accounts`, unchanged".
- **Computed in `prepare.ts`**, after the existing refusals and before the challenge:
  - `addresses = [sender]`, plus the chosen source token account for SPL.
  - `sol.before` = the `getBalance` value prepare already read. `sol.after` = the simulated
    lamports of the sender.
  - **Cross-check (new refusal `simulation-mismatch`)**: `before − after` must equal
    `solRequired` (fee included in the simulated state) or `solRequired − networkLamports` (fee
    not included), exactly. SOL leaving the wallet in any other amount means the simulation shows
    a transaction other than the one the engine built, or the balance moved between the two
    reads. Either way the send is refused, and the detail names both numbers.
  - Token: the simulated source account is parsed as an SPL token account (mint = bytes 0–32,
    owner = 32–64, amount = u64 LE at 64–72, via `DataView.getBigUint64(64, true)`). Its mint must
    be the token's mint, its owner must be the sender, and `before − after` must equal the amount;
    otherwise `simulation-mismatch`.
  - `programs` comes from the compiled message's program ids. An id outside the four known ones
    throws, which is an engine bug surfaced as `failed`: the engine builds these messages itself.
  - `recipient`: SOL → `getAccountKind(recipient)`, where `missing` → `'new'`; SPL →
    `getAccountKind(recipient owner address)`. Only `'program'` and `'other'` are warnings. None
    refuses: sending to a program-owned address can be deliberate, and #19 shows it (§4.3).
- **Security notes:** the simulation has one source, the coordinator (parent §3). The cross-check
  means a coordinator cannot show "−2.48 SOL" for a transaction whose simulated effect is
  different. It can still lie consistently: it could show the engine's own numbers for a
  simulation it never ran. That is the accepted limit of one source. The numbers leave the
  background as decimal strings (rule 2).
- **Tests:** the SOL and SPL happy paths, with the fee included and with it excluded; one lamport
  off → `simulation-mismatch`; wrong mint or owner in the token account → mismatch; malformed
  `accounts` or missing `slot` → `failed` (RpcMalformed); the `accounts` param is sent, and the
  fake coordinator asserts its shape; `getAccountKind`'s four answers; `preparedFor` returns the
  same `simulation` object; the mutation `before − after >= solRequired` must fail the
  one-lamport-over test.

### E3 — `vault.challengeInfo` (the action behind a re-auth challenge)

- **Store change** (`reauthChallenges.ts`): a challenge record gains `about`, written by the same
  `issueChallenge` call that binds the digest, from the same parsed values:
  - send: `{kind: 'send', account, token: 'SOL'|'NOC'|'USDC'|'USDT', recipient, amount (base units),
    networkLamports, priorityLamports, markupLamports, markupReason, rentLamports, reasons,
    thresholdCents}` (`priorityLamports` added by plan 3, carry 1: the part of `networkLamports` that
    is the priority fee, never more than it);
  - settings: `{kind: 'settings', autoLockMinutes: number | null, reauthUsdCents: number | null}`.
  When `prepareSend` reuses a live challenge (`rebaseChallenge`), it refreshes the fee fields
  of `about` from the new prepare. The digest and the identity fields never change. `isChallenge`
  validates `about`'s exact shape; a stored record with another shape is dropped, as today.
- **Challenge life re-based on reuse (owner D39; review H3).** The timing rule, stated once:
  - a **prepared send** lives 30 s (`PREPARED_TTL_MS`): #20's "Quote valid N s" counts this and
    nothing else;
  - a **challenge** lives 120 s (`CHALLENGE_TTL_MS`) **from the last prepare of the same intent**.
    When `prepareSend` carries a still-live challenge into a re-prepare of the same intent (same
    digest), a new `rebaseChallenge(id, digest)` (under `sessionMutex`) sets `expiresAt = now +
    120 s` and keeps `satisfied`. It is the same grant renewed, not a new one: an expired challenge
    is never revived, a different digest is never re-based, and the challenge stays single-use
    (`consumeChallenge`).
  - **The re-base is capped (controller ruling C5; review R2-H1).** A challenge record gains
    `issuedAt`. `rebaseChallenge` sets `expiresAt = min(now + 120 s, issuedAt +
    CHALLENGE_MAX_LIFE_MS)`, with `CHALLENGE_MAX_LIFE_MS` = 10 min. So no chain of re-prepares keeps
    one proof alive longer than 10 minutes from the moment it was issued. #20 cannot build such a
    chain on its own either: its automatic re-prepare at the quote's end runs **at most once without
    user input** (§4.5).
  - **The real consequence:** a user who re-authenticates while #20 is on screen keeps the proof as
    long as they keep interacting, up to 10 minutes after the challenge was issued. After one
    automatic refresh, an untouched #20 shows "Quote expired — refresh", and the proof runs out 120 s
    after that last prepare. Past 10 minutes, whatever happens, the next Send asks for a new
    re-authentication (`reauth-required`, §4.5).
  - A `vault.reauthOk` answered `unknown-challenge` (the challenge expired while the password was
    typed) shows #10's `expired` state, never `failed`.
  - Tests: re-based on a same-intent reuse; not re-based for another digest; an expired challenge is
    not revived; `satisfied` survives the re-base; the Nth re-base near the cap stops at `issuedAt +
    10 min` and the one after that finds the challenge expired; the mutation "re-base on any digest"
    must fail, and so must the mutation "no cap"; the vault-page mapping `unknown-challenge` →
    `expired`.
- **Request:** `{type: 'vault.challengeInfo', challengeId}`. **Vault page only**: the sender path
  must be `/unlock.html` (`VAULT_PAGE_ONLY`), on top of the extension-origin check. The popup and
  the tab cannot read it; a partition test proves both are refused.
- **Reply:** `{ok: true, data: about}`. Refusals: `malformed` (id not 32 hex), `locked`,
  `unknown-challenge` (absent or expired).
- **Security notes:** the vault page takes the challenge **id** from its URL (as today) and the
  **description only from the background**. So a crafted `unlock.html?mode=reauth&challenge=…`
  link cannot make the page show one action while approving another: the id is bound to one digest
  and one `about`, both written by the background. The page still renders nothing untrusted. It
  re-validates every field against a closed alphabet before any text is set: the token is looked
  up in its own four-entry table, amounts must match `^\d{1,20}$`, the recipient must match
  `^[1-9A-HJ-NP-Za-km-z]{32,44}$`, each reason must be one of four known codes mapped to fixed
  strings, `thresholdCents` must be an integer in 100–100 000, and `markupReason` must be one of the
  four codes. **If any field fails, the page shows "The details of this action could not be shown."
  with only "Cancel"**: it never offers a confirmation it cannot describe. Values from a dApp
  (B1c) are outside this message's closed kinds, and B1c must add its own.
- **Tests:** `about` is stored and refreshed on reuse without changing the digest; a
  shape-violating stored `about` drops the record; `challengeInfo` from `/popup.html` and
  `/wallet.html` → `forbidden`; from `/unlock.html` → data; expired → `unknown-challenge`;
  locked → `locked`; vault-page renderer tests: each invalid field → the "could not be shown"
  state with no Confirm button (happy-dom).

### E4 — cached last balances (+ prices), marked stale; the `unreachable` code

- **Store:** `v1_balance_cache` in `storage.local`, background-written only:
  `{[publicKey]: {sol, noc, usdc, usdt (base-unit strings), at}}`. Written after every successful
  `wallet.balances`. On each write it is trimmed to the accounts in the envelope (≤ 100).
  `v1_price_cache`: `{sol, usdc, usdt, noc, at}`, written after every successful `wallet.prices`
  while a wallet is stored — checked under the same cache mutex as the balance write and E5's
  cache removal, so a price read in flight across a delete leaves no cache behind (final review M5).
  Both keys join `BACKGROUND_OWNED_KEYS` (no other file may even name them).
- **Request:** `{type: 'wallet.cached', account}` →
  `{ok: true, data: {balances: {sol, noc, usdc, usdt, at} | null, prices: {sol, usdc, usdt, noc, at} | null}}`.
  Refusals: `malformed`, `locked`. The cache is not served while locked: a locked popup shows no
  balances.
- **Stale:** everything from `wallet.cached` is stale until the fresh read replaces it. The UI
  marks it (§5.1) and never shows it as current.
- **Refusal refinement, `unreachable`:** a request that got no answer (`RequestTimedOut`, 20 s,
  or the fetch itself rejecting: DNS, offline, connection reset) is refused as `unreachable`
  instead of `failed`, on every message that reads the network. In `deps.ts`, `timedFetch` wraps
  both cases in a new `RequestUnreachable` error (`RequestTimedOut` becomes its subclass).
  `walletApi.failure()` maps `instanceof RequestUnreachable` → `unreachable`. `createRpc`,
  `createJsonGetter` and `broadcastSigned` must let it propagate unwrapped, and a test proves it
  for each. #42 needs this code to tell "offline" from "something failed". It is part of E4
  because the cache exists for exactly that state. The broadcast's own handling is unchanged: the
  pending record's rules decide there, not this code.
- **Privacy note:** the cache holds public balances of public addresses, already derivable from
  the addresses stored in the envelope's public part. Anyone with access to the browser profile
  can read it. That is the same exposure the envelope's account list already has, and it is
  stated in the privacy disclosure list (parent §5).
- **Tests:** write on success and none on refusal; trimmed to envelope accounts; `wallet.cached`
  refused while locked and served while unlocked; a shape-violating stored cache reads as `null`;
  timeout → `unreachable`; fetch rejection → `unreachable`; 403 → still `coordinator-refused`; the
  gate rejects any non-background file naming `v1_balance_cache`.

### E5 — `vault.forgetWallet` (the engine half of delete-wallet, D35, D40, D41, C4, C6)

- **Request:** `{type: 'vault.forgetWallet', expectedRevision: string, replacement?: EnvelopeV1,
  guard?: 'unfunded'}`. **Vault page only** (`VAULT_PAGE_ONLY`: extension origin and sender path
  `/unlock.html`). The popup, the tab and any web page are refused, and a partition test proves
  each. `guard` is set by #40's "Try a different seed" path only (C6).
- **Reply:** `{ok: true}`. Refusals, one vocabulary (review R2-L2):
  - `malformed`: the request's shape, or a `replacement` whose shape, first-write validation or
    binding (C4) fails. Anything the *caller* sent that is wrong is `malformed`;
  - `stored-invalid`: the *stored* `v1_vault` cannot be read as an envelope;
  - `no-wallet`;
  - `busy`: `expectedRevision` is not the stored envelope's revision, at the start or at the
    re-check before the vault write (R2-M1);
  - `unlocked`: the wallet was unlocked again meanwhile — a `vault.setKeys` landed between step 3's
    lock and step 5's re-check (R2-M1; `accountsStore.ts` step 5, ledger L4). Nothing was deleted,
    and the wallet is **not** locked (the unlock that landed stands);
  - `send-open`: a send is `pending` or `stuck`;
  - `funded` (only with `guard: 'unfunded'`): an account now holds one of the four tokens (C6);
  - `unreachable` / `coordinator-refused` (only with the guard): the balance read failed or was
    refused;
  - `failed`.
- **Re-authentication happens in the vault page, before the message is sent.** This is the same
  trust boundary as `vault.reauthOk` and `vault.storeEnvelope`: the background cannot check a
  password or a seed without holding it, so the proof runs in the one page allowed to hold them
  (parent §1, "the honest limit"). `src/unlock/forgetFlow.ts` accepts two proofs, each run against
  the envelope whose revision the message carries:
  - **seed proof**, used by #39. The phrase typed on #8 derives, **under the stored scheme**, the
    public key of **every account index in the envelope**, and each must equal the stored key. The
    user has forgotten the password, so the password cannot be the proof. The phrase is a stronger
    proof, since it already controls the funds. A phrase that does not match is refused in the page
    (`not-this-wallet`) and nothing is sent, so nobody at the keyboard can wipe a wallet whose
    phrase they do not hold.
  - **factor proof**, used by #40's "Try a different seed" (D41) and later by B1b-2b's #37. It has
    the **`openWithPassword` shape** (`src/unlock/onboarding.ts`): the password unwraps the stored
    envelope's data key through Argon2id, or the passkey's PRF output unwraps it. There is **no
    session comparison** (unlike #10's `reauthenticate`), so it works on a locked wallet. The data
    key is zeroed at once; nothing else is derived (review R2-L7).
- **The replacement is bound in the background (C4, review M1).** `replacement.scheme` must equal
  the stored scheme, and its `{index, publicKey}` set must equal the stored one exactly (same
  indexes, same keys, no extra, none missing). Anything else is `malformed`, and nothing changes. So
  a replacement can only ever re-encrypt **the same wallet** under a new password. It can never swap
  in other keys, even if the page's proof code were wrong. Mutation test: dropping the key-set
  comparison must fail the "other keys" test. Because the key sets are identical, **the page copies
  every stored account name into the replacement** (names are not in the envelope's authenticated
  header, so this needs no re-derivation; review R2-L3, in D40's spirit).
- **The unfunded guard (controller ruling C6; review R2-M4).** With `guard: 'unfunded'`, the
  background reads the balances of **every account in the stored envelope** through `deps.reader`
  (`readWalletBalances`: SOL, NOC, USDC, USDT; through the one 403 latch). Any non-zero → `funded`,
  "This wallet now holds funds. Nothing was changed." Any read failure → `unreachable`, and a 403 →
  `coordinator-refused`. So the guard fails closed. The vault page still never touches the
  network: the background does the reading. This makes D41's non-atomic delete safe even if funds
  arrive between #40 rendering and the click.
- **One critical section (review H1 and R2-M1).** Steps 1–7 run in **one `accountsStore` `serial`
  section**, the mutex every `v1_vault` write takes (`storeEnvelope`, `renameAccount`), so no
  envelope write can interleave. `lock()` runs inside it: it takes `sessionMutex`, which nests
  inside `serial` safely because nothing that holds `sessionMutex` ever takes `serial`.
  1. Read `v1_vault` (`no-wallet` / `stored-invalid`); compare `expectedRevision` (`busy`);
     validate and bind `replacement` (`malformed`).
  2. With `guard: 'unfunded'`: the balance reads above (`funded` / `unreachable` /
     `coordinator-refused`). Nothing has been changed yet.
  3. **`lock()`.** It clears `storage.session` (keys, prepared sends, challenges) and the auto-lock
     alarm. From here no new `sendPrepared` can pass its `getSession` check.
  4. **Check and clear `v1_pending` in one `updatePending(ext, records => …)`** (pendingStore's own
     mutex, the one `submitSigned` writes under): if any record `isOpen`, the change function throws
     `SendOpen` and nothing is written; otherwise it returns `[]`. Refused here → `send-open`. The
     wallet is left locked and otherwise unchanged; the page says so.
  5. **Immediately before the vault write, re-check** (R2-M1): re-read `v1_vault` and re-compare its
     revision with `expectedRevision` (`busy` if it moved), and, under `sessionMutex`, confirm
     `getSession() === null` (**`unlocked`** if an unlock landed since step 3; `vault.setKeys` does
     not take `serial`, so this is the one race left inside the section). A `busy` here has changed
     nothing but the lock and the removal of closed pending records. The page cannot tell a step-1
     `busy` from a step-5 one, so it shows one line for both: §3.8's "The wallet changed while you
     were typing. Start again." (true in both; plan-2 review ruling 3). An `unlocked` here has changed
     the same, but the wallet is unlocked again. #39's restore and #40's retry (both on #8) say
     instead: "The wallet was unlocked while this was running, so nothing was deleted. Start again." +
     `[Start again]` → #39 — **controller addition — confirmed by the owner 2026-10-01**.
  6. **The vault write:** `v1_vault` removed, or overwritten by `replacement`. A crash before this
     write leaves the old wallet in place and locked, and the operation can be repeated. There is
     never half a wallet.
  7. After it, the rest of the wallet's local data:
     - **without `replacement`** (a delete: D41's path, and B1b-2b's #37): remove
       `v1_known_recipients` (D40), `v1_settings` (the defaults apply to whatever comes next),
       `v1_balance_cache`, `v1_price_cache`;
     - **with `replacement`** (a restore of the same wallet, proven): **keep `v1_known_recipients`**
       (D40) and **keep `v1_settings`** (resetting could weaken a stricter auto-lock or threshold
       without a re-auth); remove the two caches.
     A crash between steps 6 and 7 of a delete could leave the old recipients and settings behind.
     So **a first write (`vault.storeEnvelope` with `expectedRevision: null`) also removes any
     `v1_known_recipients` and `v1_settings` it finds**, under the same `serial`, before it writes:
     they cannot belong to a wallet that does not exist yet. That way they never carry into the next
     wallet.
  - **Kept always:** `v1_forbidden_until`. The 403 cool-down belongs to the network, not to the
    wallet; clearing it could start a request burst during a ban.
  - **After step 7, one more `updatePending` read.** A `submitSigned` that had passed its
    session check before step 3 could still append a record after step 4. If an open record
    appears, it is **kept, never deleted**: the background poller watches it without keys, and the
    in-flight block stays for its account. The reply is still `ok`. The window is a few
    milliseconds; this rule makes it harmless rather than impossible.
- **Why a pending send refuses the delete, instead of warning.** While a send is open it can still
  land. Deleting would drop the only record that watches it and the in-flight block that stops a
  second transaction from the same account, and a re-import could then build a new send while the
  first lands — the double spend the engine exists to prevent. Waiting costs about two minutes at
  most (blockhash expiry plus the two null checks). The page says: "A transaction from this wallet is
  still pending. Wait until it confirms or expires — about two minutes — then try again."
- **Why `replacement`.** `vault.storeEnvelope(null, …)` refuses while a wallet exists. For #39's
  restore, forget-then-store as two messages would leave a window with no wallet if the second
  failed; the replacement makes the restore atomic.
- **#39 → "Continue to import" works as designed:** #39 → #8 (`?mode=import&source=forgot`) →
  phrase → seed proof → #5 (new password) → the page builds the new envelope with the **stored
  scheme, every stored account index and every stored name** → `vault.forgetWallet
  {expectedRevision, replacement}` → `vault.setKeys` → UI tab `#/imported`.
- **#40 "Try a different seed" (D41).** A different seed is a different wallet, so C4 forbids it
  as a `replacement`. It uses a guarded delete followed by a normal first write instead:
  1. #40 (`no-assets-empty` state only, as the design draws it; the button re-reads the balances on
     click and hides itself, showing the funded state, if anything arrived) →
     `unlock.html?mode=import&source=retry`;
  2. the page first asks for **the password just set for the wallet being replaced** (the factor
     proof; fixed strings: "Confirm with the password of the wallet you are replacing"; a passkey
     also works) and records the revision it proved against;
  3. #8 takes phrase B (cleared field, as the design says); scheme detection as a normal import; #5
     takes B's password;
  4. `vault.forgetWallet {expectedRevision, guard: 'unfunded'}` (no replacement), then at once
     `vault.storeEnvelope(null, envelopeB)` and `vault.setKeys` → UI tab `#/imported`.
  The two writes are not atomic. That is acceptable only here: the background has just proven the
  wallet being removed holds none of the four tokens (C6), and the user has just typed its phrase.
  If the first write fails, the page keeps phrase B and its password in memory and offers `[Try
  again]`, which retries only the first write. If that retry answers `wallet-exists` (another tab
  created a wallet meanwhile), the page shows the fixed `exists` string ("A wallet already exists in
  this browser. Nothing was changed.") and stops: no loop, no second delete (review R2-L6).
- **Tests:**
  - background: refused from `/popup.html`, `/wallet.html` and a web origin; `send-open` for a
    pending and for a stuck record, and allowed once they are closed; **H1:** a pending write
    injected between the lock and the clear (fake `Ext` hook) → `send-open`; mutation: replacing the
    atomic `updatePending` clear with `local.remove(v1_pending)` must fail that test; a record
    appended after step 4 is kept; `busy` on a stale revision; **R2-M1:** a `storeEnvelope`
    injected between steps → `busy` and `v1_vault` byte-identical; a `vault.setKeys` injected
    before step 5 → `unlocked` and `v1_vault` byte-identical; **C4:** other scheme, an extra account, a
    missing account and one changed key → `malformed`, nothing changed; **C6:** with the guard, a
    non-zero balance on any account (each of the four tokens) → `funded`, a failed read →
    `unreachable`, a 403 → `coordinator-refused`, each with nothing changed and the wallet not
    locked; mutation: dropping the read must fail the "funded meanwhile" test; **D40:** with
    replacement, known recipients and settings kept; without it, both removed; `v1_forbidden_until`
    kept in both; an unreadable stored vault → `stored-invalid`; a thrown write before step 6 leaves
    `v1_vault` intact; a first write removes leftover `v1_known_recipients` / `v1_settings`
    (a crash between steps 6 and 7 simulated).
  - vault page: the seed proof accepts the stored wallet's phrase (slip10 with several accounts;
    cli) and refuses a different valid phrase and the same phrase under the other scheme; the
    replacement carries the stored names; the factor proof accepts the right password and refuses a
    wrong one without any session; `wallet-exists` on the D41 retry shows the `exists` string and
    sends nothing more; nothing is sent on refusal.
  - E2E: §8.5 specs 10 and 12.

### E6 — `wallet.recipientInfo` (read-only, controller ruling C1)

- **Request:** `{type: 'wallet.recipientInfo', account, recipient}`. Privileged, any extension page.
- **Reply:** `{ok: true, data: {known: boolean, lastSentAt: number | null, label: {kind: 'own',
  index: number, name: string} | {kind: 'treasury'} | null, self: boolean}}`. Refusals:
  `malformed` (either address invalid), `locked`.
- **Computed locally, no network:**
  - `known` uses the **same function prepare uses** (`isKnownRecipient(ext, session, recipient)`,
    extracted from `prepare.ts`): one of the session's accounts, or in `v1_known_recipients`. So
    #12's prediction and #19/#20's `first-send` reason cannot disagree.
  - `label`: own account → its index and stored name; `MAINNET_FEE_TREASURY` → treasury; else
    `null`. `self`: recipient equals `account`.
  - `lastSentAt` is the time of the last confirmed send to this address. For this,
    `v1_known_recipients` entries become `{address, at}` (written by `addKnownRecipient`, which
    already runs on confirmation). A stored plain string (the B1b-1 format) reads as `{address,
    at: null}`, so no migration step is needed. `known` is unchanged by the format.
  - `accountKind` is **not** included: none of #12's drawn hints needs it (#19 shows the recipient
    check from E2), so no read goes to the network.
- **Security notes:** it reveals whom this wallet has paid, so it is refused while locked. It is a
  hint only: #19/#20 and the re-auth rule still come from `prepareSend`, which recomputes
  everything.
- **Tests:** own account / treasury / known / unknown; `self`; `lastSentAt` from the new format;
  the old string format still reads as known with `null`; refused while locked; parity: for a
  table of cases, `recipientInfo.known === !reasons.includes('first-send')` from a prepare of the
  same intent (fake deps).

### E7 — `wallet.discardPrepared` (controller ruling C2; review H4)

- **Request:** `{type: 'wallet.discardPrepared', account}`. Privileged, any extension page (the
  popup, the tab, and the vault page's #10 Cancel). Partition-tested: refused from a web origin.
- **Reply:** `{ok: true}` (also when there was nothing to drop). Refusal: `malformed`.
- **Computed** under `sessionMutex`: remove every `v1_prepared` entry of that account; remove every
  challenge in `v1_reauth` whose digest equals the `intentDigest` of a removed entry (send
  challenges only: a settings challenge has a different digest and survives). Afterwards
  `wallet.preparedFor(account)` returns `null`, and a stale #10 tab for that intent gets
  `unknown-challenge` → `expired`.
- **Called by:** #10 `[Cancel send]` (with the account from `challengeInfo`), #20 `[Cancel]`, and
  Esc/back from #19 to #12 (leaving the review). Not called by closing the popup: that is not a
  cancel, and `preparedFor` resumes it (§4.5).
- **Toast:** "Transaction cancelled. No fees charged." (#44's toast) is shown only where it is true
  and visible. It is true after this call, because nothing was signed. It is shown on #11 after
  #20's Cancel. After #10's Cancel the popup is closed, so the vault page shows "Send cancelled.
  Nothing was sent." and closes its tab (§3.10). No toast is promised in a popup that is not open.
- **Tests:** drops only that account's entries; drops the bound send challenge and keeps a
  settings challenge and another account's; `preparedFor` → `null` after; idempotent; a later
  `wallet.send` of a discarded id → `unknown-prepared`; mutation: "keep challenges" must fail the
  stale-#10 test.

### E8 — `failure` on pending records (controller ruling C3; review M3)

- **Store change** (`pendingStore.ts`): `PendingRecord` and `PendingView` gain `failure: 'landed' |
  'not-sent' | null`. `isRecord` reads a missing field as `null` (B1b-1 records), so no migration
  is needed.
- **Set where the engine writes each `failed`** (`pending.ts`):
  - `deliver()` first attempt, `BroadcastRejected` (the route's 400 naming a contract reason) →
    `'not-sent'`;
  - `deliver()` first attempt, `RpcCoolingDown` (the latch refused before sending) → `'not-sent'`;
  - the poller, **both** of its writers of a confirmed/finalized status with `err` (`landed() ===
    'failed'`) → `'landed'`: the regular status check of open records, and the full-history check
    past `lastValidBlockHeight + 32` (review R2-L1);
  - every other state (`pending`, `stuck`, `confirmed`, `expired`) → `null`.
- **#44 keys on it** (§4.7): `landed` → `rejected-by-program`; `not-sent` → `network-error`;
  `expired` (a state, not a failure) → `blockhash-expired`. A `failed` record with `failure: null`
  (only possible from an older build) → a generic "Transaction failed" with the `detail`. `detail`
  stays the caption under the title, as B1b-1 writes it.
- **Tests:** one per writer (four: two in `deliver()`, the two poller writers named above),
  asserting `failure` and that `detail` is unchanged; old-format records
  read as `null`; mutation: swapping the two first-attempt values must fail.

### What the engine does **not** gain (named so nobody assumes it)

24 h change (G2), a UI-preference store
(G3), block/memo/failure reason in history (G13), priority choice (G7, D15), max-sendable (G8;
the UI computes MAX, §4.2). Each missing item is on the "Differs" lists of the screens that
would have used it.

---

## 3. Onboarding and unlock (vault page, tab)

Every screen here renders inside a 412 px column centred on `--bg-base`, using the design's
classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.

### 3.1 #1 welcome

- **Purpose:** entry; create or import. **Where:** vault page, `?mode=welcome` (opened on install
  and by the popup with no wallet).
- **State `idle`:** logo — the mockup's `span.mark` "N" (index.html:4498) — + wordmark "Noctura"
  (`.noc-h1`); tagline "A Solana wallet built for private, non-custodial holding."; trust chips "E2E
  encrypted" · "Non-custodial"; terms line "By continuing you agree to the Terms and Privacy Policy."
  above the CTAs; `[Create new wallet]` `.btn-primary`; `[I have a wallet]` `.btn-secondary`.
- **Extension-only state `exists`** (a wallet is already stored): "A wallet already exists in this
  browser. Nothing was changed." + "Open the Noctura icon to use it." No CTAs.
- **Extension-only state `damaged`** (a stored value that fails validation, a stored `null`
  included): "This wallet's stored data is damaged." + "Your funds stay on Solana; your recovery
  phrase still controls them. To use them here, remove Noctura from this browser, install it again
  and import the phrase." (owner-confirmed copy, 2026-10-01, plan 2 carry 3). No CTAs; repairing it
  is #37's (B1b-2b).
- **Extension-only state `unreadable`** (the storage read itself throws): "This wallet's stored data
  could not be read. Reload this page." No help line, no CTAs.
- **Engine:** `readLocal('v1_vault')` presence (the vault page's one storage read).
- **Navigation:** Create → #2 (same page); I have a wallet → #8.
- **Differs from the design:**
  - "ZK-private" chip removed (D6).
  - "Terms" and "Privacy Policy" are plain text, not links, until the privacy policy exists (a
    release gate, parent §5 / B1e). The sentence stays.
  - `exists`, `damaged` and `unreadable` states added (the engine never overwrites a wallet, and a
    damaged or unreadable one is never silently treated as absent).

### 3.2 #2 security-intro

- **State `idle`:** eyebrow "Onboarding", step "1 / 5", title "Three layers protect your
  wallet", lede "You hold the keys. We never can.", three cards:
  - "Password" / "At least 12 characters you choose. It unlocks the wallet in this browser and is
    asked again before sends to new addresses or large amounts." **→ adapted** (D7; the design's
    "Local PIN — Six digits you choose. Required for every send and signature." would be false:
    the engine asks only on its four re-auth triggers);
  - "Passkey (optional)" / "A fingerprint, face or security key as a shortcut. Your password still
    works for everything." **→ adapted** (D9; design: "Biometric (optional) — Fingerprint as a
    shortcut. Your PIN still gates high-risk actions.");
  - "Recovery seed" / "24 words. Written offline. The only way back if this browser's data is
    lost." **→ adapted** ("device" → "browser's data");
  - footer "If you lose all three, no one — not Noctura, not a Solana validator — can recover your
    funds. That's the point."; `[Continue]`.
- **Navigation:** Continue → #3; back arrow → #1.
- **Differs:** card copy as marked. Nothing omitted.

### 3.3 #3 seed-display

- **Engine:** `newMnemonic()` in the page (24 words), in memory only; nothing is sent.
- **Memory:** the phrase lives in the create run's closure from #3's first show until the wallet is
  stored. A hidden tab keeps it (and re-blurs the grid); **`pagehide` drops the phrase** (and #5's
  password), whatever `persisted` says — the browser may keep the page in its back/forward cache — and
  a page restored from that cache starts again at #1 (Task 8 fix round 1, controller addition).
- **States:**
  - `pre-reveal modal`: route tag hidden; "About to show your recovery phrase"; "Move to a private
    place. Anyone who sees these 24 words can spend everything in this wallet, forever."; callout
    "We can't recover this for you if someone takes it. Your only copy is the one you write by
    hand." **→ adapted** (D1: "Screenshots are blocked on this screen —" removed; a browser cannot
    block them); `[I'm in a safe place — continue]`; `[Cancel — go back]` (and backdrop click) → #2.
    The word grid is not in the DOM until the modal is dismissed.
  - `blurred`: step "2 / 5", title "Recovery phrase", lede "24 words. Write them down on paper, in
    order. This is the only backup."; 2 × 12 column-major grid, index `.noc-mono` 11 px + word
    `.noc-mono` 14 px/500, blurred; overlay "Press and hold to reveal" **→ adapted** ("Tap" →
    "Press": mouse, and keyboard Space/Enter held) / "Make sure no one is looking over your
    shoulder. Hold for 2 seconds. Auto re-blurs after 20 s for safety."; `[I've written it down]`
    disabled.
  - `revealed · countdown`: chip "13 s · auto-blur" (`--warning` above 5 s; at ≤ 5 s "5 s — still
    memorizing?" in `--danger`); helper "Holding to reveal · Auto-blurs at 20 s for safety. Screen
    readers announce at 10 s and 5 s only." **→ adapted** ("TalkBack" → "Screen readers"); the chip
    itself is `aria-hidden="true"`, and a separate `.vlt-sr` polite live region (`#seed-live`) says
    the countdown at 10 s and 5 s only, and is emptied on every state change; CTA active.
  - `re-blurred at 20 s`: "Still looking?" / "Press and hold again to keep viewing. Releasing now is
    fine — your hand is remembering enough." **→ adapted** ("Tap-and-hold" → "Press and hold"); the
    hold resets and must be released and pressed again.
  - `confirmed`: lede "Phrase locked in. Tap continue to verify a few words."; grid re-blurred;
    stamp "Acknowledged" (`.noc-overline`, `--success`); `[Continue]` → #4. (3b–3d read "I've
    written it down", disabled until one full hold; 3e reads "Continue" — the design is binding,
    plan-2 review ruling 1.)
- **Mechanics:** hold timer 30 ms ticks to 2 s; `pointerup`/`pointerleave`/`blur`/`keyup` re-blur;
  the 20 s auto-blur fires even while held; every timer is cleared on leaving the step.
  `prefers-reduced-motion` removes the blur transition.
- **Differs:**
  - "Screenshots disabled · screen-recording blocked while this phrase is visible." banner removed
    (D1).
  - FLAG_SECURE, haptics and the predictive-back exit modal dropped (no browser equivalent).
    Leaving the page discards the mnemonic, and a new visit generates a new one.
  - **Plan 2:** the CTA reads "I've written it down" (disabled until one full hold) and, in
    `confirmed`, "Continue" — as 3e draws it; both go to #4. The design's route tag on the gate is
    not shown. The chip's countdown is announced at 10 s and 5 s through a separate live region (the
    chip itself is aria-hidden). Leaving #3 or #4 takes their words out of the DOM.
  - **Plan 2:** outside `revealed` the 24 cells hold the fixed stand-in "xxxxxx" under the blur, not
    the real words blurred as 3b, 3d and 3e draw them: the blur is CSS only, so a real word under it
    would be in the DOM (and in a screenshot with the filter off) whenever the grid is blurred. The
    words are in the DOM exactly while `revealed` (Task 4 carry). Seen blurred, the cells read as an
    even grey texture of one length, not 24 shapes of different lengths (visual pass, 03-blurred and
    03-confirmed against 3b and 3e).

### 3.4 #4 seed-confirm

- **States:** `empty` (step "3 / 5", "Confirm phrase", "Tap the correct word for each position.",
  slots "Word #5" / "Word #12" / "Word #19" with "— select —", a pool of nine: each slot's word
  with two BIP-39 distractors of the same first letter, none a phrase word, generated once
  (`screen.md`'s "1 correct + 8 distractors" counts from one slot's point of view; plan-2 review
  ruling 6), `[Confirm]` disabled); `partial-correct` (filled
  slots, used buttons dimmed); `wrong-answer` (lede "That's not the right word — let's start
  over." in `--danger`, slot flips `--danger` with the 320 ms shake, helper "Word #12 was wrong.
  Slots will reset in a moment.", reset after ~700 ms); `success` (96 px ring, "Phrase
  verified", "All three words matched. Now lock the wallet with a password." **→ adapted** (D7),
  `[Continue]` → #5).
- The slot numbers are random (3 distinct of 1–24), the pools come from the page's wordlist, and
  "Tap" stays because a click is a tap.
- **Differs:** the success copy as marked; the FLAG_SECURE note dropped (D1).
  - **Plan 2 (visual pass):** a pick is checked at once (a wrong one resets the slots), so a filled
    slot is always a verified one and is drawn as 4b/4c draw `.correct` (the `--success` dashed
    border on `--bg-surface-2`). 4b's `.filled` look — the latest pick tinted, not yet verified — is
    not used: no pick here is ever unverified.

### 3.5 #5 pin-create → create password (D7)

- **States:**
  - `enter`: step "4 / 5"; "Create a password" / "At least 12 characters. You'll need it to unlock
    the wallet and to confirm risky sends." **→ adapted** (design: "Create a PIN" / "6 digits.
    You'll need this to unlock the wallet and to send."); helper "Choose something long and
    memorable — a few unrelated words work well." **→ adapted** (design: "Choose something
    memorable but not 111111."); a password field (`autocomplete="new-password"`, show/hide toggle)
    with the **length meter**: 4 bars filling at 3/6/9/12 characters and the label "N of 12
    characters" until 12, then "Long enough" (D7: only the length rule).
  - `confirm`: "Confirm your password" / "Enter the same password to verify." **→ adapted**.
  - `mismatch`: "Passwords don't match — try again." **→ adapted** (design "PINs don't
    match — try again."), 320 ms shake, the confirm field cleared after 600 ms.
  - **extension-only `creating`**: "Creating your wallet…" / "Securing your password takes a few
    seconds." with `.noc-progress` indeterminate (Argon2id, ~3 s, parent §2). The buttons are
    disabled.
  - **extension-only outcomes** from `finishOnboarding` (the B1b-1 strings): `exists`
    ("A wallet already exists in this browser. Nothing was changed."), `weak-password`,
    `invalid-mnemonic`, `failed` ("Something went wrong. Nothing was saved.").
- **On the import path** this same screen appears after #8 with the step counter "Import · 2 / 2"
  **→ adapted** (the design's import path has no PIN step; the extension needs a password).
- **On #39's restore path** it appears after #8 with "Recovery" / "Restore · 2 / 2", and gains one
  extension-only state, **`retry`** (a refusal the same password may answer later — `send-open`, §3.8):
  the refusal's line in the helper and `[Try again]`, which runs the restore again with the password
  held in page memory. In `retry` the form and the lede are hidden (the lede would ask for a field that
  is not there); Back is offered and drops the held password, returning to #8 with the phrase in the
  field (plan-2 review L3). A tab hidden while the restore runs counts as hidden: a `retry` answer then
  holds nothing, and #5 goes back to `enter` with "Enter a new password to try again." (§3.5's rule,
  L5) — as it does when the tab is hidden behind `[Try again]` (Task 12, **controller addition**).
- **Navigation:** `created` → #6 (create path) or the UI tab `#/imported` (import path, no #6
  prompt; D9 puts the passkey step on #6 only). `created-locked` → the UI tab
  (`#/created` or `#/imported`), which shows its locked variant.
- **Memory:** the password stays in the page's closure until #6 finishes or is skipped, so #6 can
  run `addPasskey` without asking again. After that the reference is dropped. **It is also dropped
  on `pagehide` and on `visibilitychange` to `hidden`** (review L7). If that happens before #6
  finishes, #6 asks for the password once more before adding a passkey ("Enter your password to add
  the passkey."). JS strings cannot be zeroed; this is stated in a comment and in §8's review list.
- **Differs:**
  - The 6 PIN dots and keypad are replaced by a password field and confirm field (D7).
  - The step dots keep the design's two-step indicator. In `mismatch` both dots are wide, as 5c's
    state note says ("both step dots wide"); the 5c mockup itself draws only dot 2 wide.
  - **Plan 2:** on #39's restore path the eyebrow reads "Recovery" (#39's), with "Restore · 2 / 2";
    `send-open` and a failed store keep the password in the page behind `[Try again]` (the field
    hidden), as E5 asks.
  - FLAG_SECURE dropped (D1).

### 3.6 #6 biometric-setup → passkey (D9)

- **State `idle`:** step "5 / 5"; 56 px key icon; "Unlock Noctura with a passkey"; lede "Adds
  convenience. Your password always works too — keep it safe."; three rows:
  - "Faster unlock" / "Use your fingerprint, face or security key instead of typing your
    password.";
  - "Password still works" / "If the passkey is unavailable, your password unlocks the wallet and
    confirms everything.";
  - "Where your passkey lives" / "A passkey synced to Google, Apple or a password manager keeps its
    secret in that provider's cloud. Other extensions allowed on wallet.noc-tura.io can ask for it
    too.";
  - `[Add a passkey]` (primary) and `[Skip — use password only]` (secondary).
  All **→ adapted** (D9 plus the parent spec's stated limits; the design's "PIN still wins —
  Sends, signs, and changes always re-prompt for the PIN." is false: re-auth accepts either
  factor. Its "Resets on enrollment change" has no passkey analogue).
- **Extension-only states:** `adding` ("Waiting for your passkey…"); `added` ("Passkey added." →
  continue); `unsupported` ("This device cannot unlock the wallet with a passkey; your password
  still works." + `[Continue]`); `failed` ("Something went wrong. Your password still works." +
  `[Continue]`).
- **Engine:** `addPasskey()` (exists, `src/unlock/onboarding.ts`; wiring it to a page step is new).
- **Navigation:** any end → the UI tab `wallet.html#/created`.
- **Differs:** copy as marked; the fingerprint icon becomes a key icon; the native BiometricPrompt
  becomes the browser's WebAuthn prompt.
  **Plan 2:** the back arrow is not drawn — the wallet is already stored when #6 shows.

### 3.7 #7 onboard-success (UI tab `#/created`)

- **Where:** `wallet.html`. The vault page hands over after `created`, so this screen may use the
  network and React.
- **State `idle`:** 96 px success ring; "Wallet created" (`.noc-display`); "Your Solana address is
  below. Receive funds at any time."; eyebrow "Solana address"; the full address (`AddressGroups`)
  and `CopyButton` (48 px); helper "Copying puts the address on your clipboard. Noctura does not
  clear it afterwards." **→ adapted** (spec §4: no auto-clear; design "Tap copy → clipboard
  auto-clears in 30 s."); "Next steps": "Fund the wallet with SOL or NOC" and "Pin Noctura to your
  browser toolbar so it is one click away" **→ added**; then the line **"Wallet is ready — open the
  Noctura icon"** (D10, applied to #7 as to #40) and `[Close this tab]` (secondary; `window.close()`,
  hidden if the browser refuses).
- **Extension-only state `created-locked`:** "Wallet created. Unlock it to use it." + `[Unlock]` →
  `unlock.html?mode=unlock&return=created`.
- **Engine:** `wallet.state` → `accounts[0].publicKey` (available while locked, from the
  envelope's public part).
- **Differs:**
  - "Try a shielded send (privacy by design)" removed (D4).
  - "Export an encrypted backup from Settings" removed (D17).
  - `[Open wallet]` replaced by the D10 line: a tab cannot reliably open the action popup in both
    browsers.
  - The 30 s clipboard clear is not built (spec §4).
  - **Plan 2 (visual pass):** the address is in groups of four (`AddressGroups`, spec §3), not the
    design's continuous string, at the class map's `.noc-mono` + `.noc-body` size (15 px).
  - **Plan 2 (visual pass):** the sticky bar holds the D10 line above `[Close this tab]`, and stays
    at the bottom of the tab while the screen scrolls, as the phone frame pins it.

### 3.8 #8 import

- **States:**
  - `phrase idle`: "Import wallet" / "Bring an existing wallet onto this device." (`.noc-h2`); the
    textarea (`.noc-mono`, `autocomplete="off"`, `spellcheck="false"`); "Enter your 12 or 24-word
    recovery phrase, separated by spaces."; the D8 banner (`.banner.info`): "This phrase is also the
    root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this
    browser gets those too. Accounts after the first one exist only in this extension until the
    phone app supports more than one account." **→ added** (D8); `[Continue]` disabled until the
    phrase is 12 or 24 words with a valid checksum.
  - `paste-detected`: toast "Pasted from clipboard. Noctura cannot clear your clipboard — clear it
    yourself." **→ adapted** (the design's "clipboard cleared" would be false: no clipboard
    permission); the words shown in the mono cell grid (12 or 24); "Valid 24-word BIP-39 phrase ·
    checksum OK" (or "Valid 12-word …"); `[Continue]` active.
  - `idle-timer-active`: after 48 s without input, banner "Auto-clearing in 12 s" / "No activity
    for 60 s — phrase will be wiped from this field."; "9 of 24 words entered."; `[Keep working —
    reset timer]`; at 0 the field and grid are emptied.
  - **extension-only `checking`**: "Checking which addresses hold funds…" (`detectImport` → the
    background's `wallet.probeBalances`, public keys only).
  - **extension-only `choose-scheme`**: "Both address types on this phrase hold funds. Choose the one
    to use." or "Balances could not be checked. Choose the address type to use." + `[Standard
    (Phantom/Solflare)]` / `[Solana CLI (solana-keygen)]` (B1b-1 strings, now in design chrome:
    two `.noc-card` choice rows).
  - **extension-only `invalid-mnemonic`**: "That is not a valid 12- or 24-word recovery phrase."
  - **`&source=retry` (#40's "Try a different seed", D41):** before the phrase field, a password
    step: "Confirm with the password of the wallet you are replacing" + `[Confirm]` /
    `[Confirm with passkey]`; `wrong` → "That did not confirm it."; then #8 as a normal import. At
    the finish, `vault.forgetWallet {expectedRevision, guard: 'unfunded'}`: `send-open` / `busy` /
    `unlocked` as below (`[Start again]` restarts this path); `funded` → "This wallet now holds funds. Nothing was changed." (C6); `unreachable` →
    "Balances could not be checked, so nothing was changed. Try again later."; `coordinator-refused`
    → the D26 banner text. A failed first write after the delete → "The new wallet was not saved.
    Try again." + `[Try again]` (phrase and password kept in page memory); a `[Try again]` answered
    `wallet-exists` → "A wallet already exists in this browser. Nothing was changed." and the flow
    stops (review R2-L6), with the shared `exists` treatment (`existsLines`, as on create and plain
    import): the help line "Open the Noctura icon to use it." under it — or, when the stored vault
    reads as damaged, the damaged lines; unreadable, the reload line. Any other failure of the delete ("Something went wrong. Try again." + `[Try again]`) may have
    landed with its reply lost, so `[Try again]` never re-sends it blind: it reads the vault first —
    gone → the first write alone; still the proven revision → the guarded delete again; anything else →
    `busy` (controller addition, ruled 2026-10-01; no new copy). A tab hidden behind
    (or during) a `[Try again]` drops B prepared with its password (§3.5, L5); B is encrypted again under
    the password typed next. Once the delete has landed, #8 hides Back: there is no wallet left to
    prove, so the only ways on are finishing B or leaving (controller ruling, 2026-10-01).
  - **Restore path from #39 (`&source=forgot`, E5), extension-only states:**
    - `checking-match`: "Checking this phrase against the wallet in this browser…" (the seed
      proof, local, no network);
    - `not-this-wallet`: "This phrase does not belong to the wallet in this browser. Nothing was
      changed." + "To replace that wallet without its password, remove Noctura from this browser and
      install it again." + `[Try another phrase]`;
    - on a match there is no scheme choice (the stored scheme, account indexes and names are reused), and
      the flow goes to #5 with the step counter "Restore · 2 / 2";
    - at the finish, `vault.forgetWallet {expectedRevision, replacement}`:
      - `send-open` → "A transaction from this wallet is still pending. Wait until it confirms or
        expires — about two minutes — then try again." + `[Try again]`; the phrase stays in page
        memory while this page stays open; the password too, until the tab is hidden — §3.5's rule
        wins (plan-2 review L5): a hidden tab drops it and #5 reads "Enter a new password to try
        again." (**controller addition — confirmed by the owner 2026-10-01**); a tab hidden while the
        restore runs drops it too, and #5 reads the same line; Back from `[Try again]` returns to #8 with
        the phrase in the field (§3.5's `retry`);
      - `busy` → "The wallet changed while you were typing. Start again." → #39;
      - `unlocked` (an unlock landed mid-forget, E5 step 5) → "The wallet was unlocked while this was
        running, so nothing was deleted. Start again." → #39 — **controller addition — confirmed by the owner 2026-10-01**;
      - `ok` → `vault.setKeys` → UI tab `#/imported`.
- **Navigation:** Continue → (scheme) → #5 (import variant) → `created` → UI tab `#/imported`; on
  the restore path, as above.
- **Differs:**
  - The segmented control and the whole "Backup file" tab are removed (D17). With one option left,
    no control is shown.
  - The "Screenshots disabled · pasted phrase auto-clears from clipboard." banner is removed
    (D1; the clipboard half is false too).
  - FLAG_SECURE dropped.
  - Added: the D8 banner, the scheme choice and the password step.
  - The D8 banner shows in every #8 state, `paste-detected` and `idle-timer-active` included, though the
    design's 8b and 8d draw no banner there: it is an addition (D8), and what it says holds whenever a
    phrase is in the field (plan-2 Task 9 review, drift item).
  - The design's Android note — predictive back surfaces "Discard imported data?" when text is present —
    does not apply: an extension tab has no system back gesture. The back arrow empties the field and
    goes back without a prompt (plan-2 Task 9 review, drift item).
  - `invalid-mnemonic` is shown inline under the field as soon as it is certain (12 or 24 words with a
    bad checksum, more than 24 words, or from 12 words on a finished word not on the BIP-39 list), with
    `[Continue]` disabled; the grid stops at 24 cells (plan-2 Task 9 review, ruling 3).
  - `idle-timer-active`: the banner is a polite status whose per-second countdown screen readers do not
    hear; a separate live region says "Auto-clearing in 12 s" once and, at the wipe, "The phrase was
    wiped from this field." (**controller addition — confirmed by the owner 2026-10-02**). The timer also
    runs while `checking` (ruling 7): a probe that hangs still ends in the wipe.
  - **Plan 2:** the phrase stays editable in a field (inside the design's `.ta-wrap`), and the mono
    cell grid shows the words typed so far under it; the counter targets 12 words up to 12, then 24
    ("9 of 12 words entered."). The restore and retry refusals replace the field with their line and
    one button; `busy` and `unlocked` offer `[Start again]` (confirmed by the owner 2026-10-01, E5) —
    to #39 (restore) or the retry path's start (retry).
  - **Plan 2 (plan-2 review M4, L3, H2):** the phrase stays in page memory while this page is open, a
    hidden tab included — §3.5's hidden-tab rule is the password's, and dropping the phrase under an
    open #5 would end the run on an untrue "That is not a valid 12- or 24-word recovery phrase." It
    goes when the wallet is stored, at every other end of the run, and with the page. Back from #5
    returns to #8 with the phrase in the field on every path (plain import, restore, retry). On the
    retry path the new wallet prepared under #5's password (its envelope and its session keys) is
    kept only behind a pending `[Try again]`, and goes when the tab is hidden, with that password;
    the factor proof goes at every end of the run.

### 3.9 #9 unlock

- **Where:** vault page, tab (D12). The popup's locked screen (§4.1) only opens this tab.
- **States:**
  - `idle`: lock tile; "Welcome back" / "Enter your password to unlock." **→ adapted** (D7); a
    password field (`autocomplete="current-password"`) + `[Unlock]`; `[Unlock with passkey]`
    (secondary) only when the envelope has a passkey (it replaces the design's keypad biometric
    cell); "Forgot password?" `.btn-tertiary` → #39 **→ adapted**.
  - `error`: helper "That did not unlock the wallet." **→ adapted** (D11: no attempt counter;
    design "Wrong PIN · 3 attempts left."), with the 320 ms shake.
  - `cooldown`: the design's countdown card, fed by the engine's backoff (≤ 30 s, page memory):
    "Wait a moment" / "That did not unlock the wallet. Wait a moment before trying again." with the
    ring and a "0:12" countdown; `[Unlock paused]` disabled **→ adapted** (D11; design "Too many
    wrong PINs", "2:45", "Keypad paused").
  - **extension-only:** `unlocking` ("Unlocking…"), `unlocked` ("Unlocked." + "Open the Noctura icon
    to continue." + `[Close this tab]`, or, with `&return=`, straight on to that UI tab route),
    `damaged` ("This wallet's stored data is damaged." — never charged to the backoff), `no-wallet`
    ("No wallet on this browser yet." + `[Set up a wallet]` → `?mode=welcome`), passkey
    `unavailable` ("This device cannot unlock the wallet with a passkey; your password still
    works.").
- **Engine:** `attemptUnlock` / `attemptPasskeyUnlock` → `vault.setKeys` (B1b-1).
- **Differs:**
  - The `final-warning` state and the wipe are removed (D11).
  - The attempt counter and "Cycle 1 of 2" line are removed (D11).
  - The keypad is replaced by a password field (D7).
  - FLAG_SECURE dropped (D1).
  - **Plan 2:** the cooldown card keeps the design's helper line, its integers in `.noc-numeral`
    ("Cooldown · 12 seconds remaining"); the ring shows the share of the wait left. **Controller
    adjustment (Task 18 ruling):** the design's template ("2 minutes 45 seconds") is pluralised —
    "1 minute", "1 second" — and a zero part is left out: "Cooldown · 1 second remaining", "Cooldown · 1
    minute 5 seconds remaining", "Cooldown · 1 minute remaining" (the wait is ≤ 30 s, so in practice
    only the seconds show). #10's cooldown uses the same line.

### 3.10 #10 unlock-send (re-authentication)

- **Where:** vault page, tab, `?mode=reauth&challenge=<id>` (D12). It opens from #20 in the popup
  or the tab.
- **Data:** `vault.challengeInfo` (E3), validated field by field (§2 E3).
- **States:**
  - `loading`: "Reading the details…".
  - `idle`: eyebrow "Confirm with password" **→ adapted** (D7); "You are about to send"; amount
    (`formatBaseUnits`, token symbol from the page's own table); "To" + the **full recipient in
    groups of four** **→ adapted** (spec §3; design `Gabc…xyz9`); "Network fee" + the fee (network +
    Noctura fee + new-token-account cost when non-zero, each its own line); "Enter your password";
    one reason line per engine reason, fixed strings:
    - `over-5-percent` → "Re-auth required for transactions over 5 % of balance." (design string);
    - `first-send` → "Re-auth required for the first send to a new address.";
    - `over-usd-threshold` → "Re-auth required for transactions over $100." (the dollar value from
      `thresholdCents`);
    - `whole-balance-to-new` → "Re-auth required to send your whole balance to a new address.";
    - `[Confirm]`, `[Confirm with passkey]` when the envelope has one, `[Cancel send]`.
  - `error`: "That did not confirm it." **→ adapted** (D11; design "Wrong PIN · 4 attempts left.").
  - `cooldown`: #9's cooldown card with "That did not confirm it. Wait a moment before trying
    again." (the design reuses #9's cooldown on #10).
  - **extension-only:** `undescribable` ("The details of this action could not be shown." + only
    `[Cancel send]`, E3, which discards the send by its account — the one field re-validated by
    itself; when even that is not an address: + "Nothing was sent. Start the send again from the
    Noctura icon." and `[Close]`, which closes the tab and claims no cancel — **controller addition —
    confirmed by the owner 2026-10-01**, plan-2 review H1); `not-unlocked` ("The wallet locked while you were confirming. Unlock it
    and start the send again." + `[Unlock]` → `?mode=unlock`, with no return target: the lock
    cleared the prepared send, so there is nothing to resume, as §7.1 says; review M7);
    `mismatch-locked` ("That did not match this wallet, so the wallet has been
    locked."); `expired` (`unknown-challenge` from `vault.challengeInfo` **or from `vault.reauthOk`**,
    D39: "This confirmation has expired. Start the send again from the Noctura icon." — never the
    `failed` wording); `damaged`; `confirmed` → hands over (below).
  - Settings kind (used from B1b-2b): "You are about to change" + "Auto-lock → N minutes" or
    "Re-authentication threshold → $N"; after `confirmed`: "Confirmed. You can close this tab."
- **Navigation:** send `confirmed` → `location.replace('wallet.html#/send/resume?account=<account>')`
  in **the same tab** → #20 with a fresh preview and the Send button, which needs a tap (D38, §4.5).
  `[Cancel send]` → `wallet.discardPrepared {account}` (E7), then "Send cancelled. Nothing was sent."
  and `window.close()`; if the browser refuses to close the tab, the text stays with `[Close this
  tab]` hidden.
- **Differs:**
  - The keypad becomes a password field (D7).
  - The biometric copy "Confirm … with Face ID" becomes the browser's WebAuthn prompt, whose text
    the browser owns.
  - The 6+6 recipient becomes groups of four (spec §3).
  - The design has one reason line; the engine has four, so four fixed strings.
  - FLAG_SECURE dropped (D1).
  - **Success does not execute the send** (D38): the design's #10 → "executes send" becomes #10 →
    #20 in the same tab, where one tap sends.
  - **`[Cancel send]` closes the tab** (review L2). The design returns to #20, but the popup that
    showed #20 closed when this tab opened, and a tab cannot reopen it. It discards the prepared send
    first (E7), so nothing is left to resume.
  - **Plan 3 (carry 1):** `about` (E3) carries `priorityLamports` (a twelfth key, digits, never more
    than `networkLamports`; the background's `isAbout` and the page's closed-alphabet renderer both
    check it), so #10 shows §4.5's fee rows exactly as #19 and #20 do: "Network fee" (the base fee,
    `networkLamports − priorityLamports`), "Priority", "New token account" when non-zero, then
    "Noctura fee" or, when it is zero, its reason line (the carried rule); `charged` with a zero fee
    is not described. The amounts are exact and ungrouped ("0.000005 SOL") on all three screens, as
    the #19 and #20 mockups draw them; only #27's fee line keeps the design's grouped form (plan-1
    L7). (Plan 2 showed one "Network fee" row with the priority included, plan-2 review ruling 2.)
    The cooldown's disabled button reads "Confirm paused" and a
    settings challenge's cancel reads "Cancel" (it only closes the tab; the challenge simply
    expires) — **both controller additions — confirmed by the owner 2026-10-01**. A discard the background refuses
    says "Something went wrong. Try again." and keeps the screen: "Send cancelled" is shown only when
    it is true — including `undescribable` (H1, above). In `expired`, `not-unlocked`,
    `mismatch-locked` and every other notice with nothing to cancel, the top bar's X closes the tab
    and claims nothing (plan-2 review L4).
  - **Plan 2 (visual pass), as plan 3 left it:** #10a draws two intent rows ("To", "Network fee");
    here each fee is its own row (base fee, priority, new-token-account cost, Noctura fee or its
    reason line), ungrouped, as above — the mockup's one fee row does not describe a send that pays
    more than the network.
  - **Plan 2 (visual pass):** the To value is the recipient in groups of four (`AddressGroups`,
    whose own `.addr-groups` mono face draws it) inside a `.noc-body-sm .noc-numeral` value span;
    the design puts `.noc-mono .noc-body-sm` on the value span itself. The rendered face is mono
    either way; the class sits one level down.
  - **Plan 2 (visual pass):** the reason lines are fixed strings set as text, so "5 %" and "$100"
    carry no `.noc-numeral` span (the design wraps the "5" in one). The tabular-figures difference
    is not visible at this size; splitting the fixed strings to style a digit is not worth a second
    source of the copy.

### 3.11 #39 forgot-pin → "Forgot password?"

- **Where:** vault page, `?mode=forgot`, reached from #9.
- **States** (all three cards visible; the highlighted one changes):
  - `step-1-card`: eyebrow "Recovery", "1 / 3"; "Forgot your password?" / "Your recovery phrase is
    the only way back. Three steps to restore." **→ adapted**; card 1 "Recover from seed phrase" /
    "You'll need the 12 or 24 words you wrote down during setup. Make sure you have them on paper or
    steel — not on this computer." **→ adapted**; "If you don't have your seed, your funds cannot be
    recovered. That's the security tradeoff of self-custody."; card 2 "Enter your words"; card 3
    "Set a new password" **→ adapted**; "The recovery flow is offline-only. We never see your seed
    phrase, your password, or your wallet address." **→ adapted**; `[Restore from seed]` → step 2;
    `[Cancel]` → #9.
  - `step-2-card`: "2 / 3"; card 1 "Done — you confirmed you have your words."; card 2 highlighted,
    "You'll be taken to the import screen. Type or paste your words." **→ adapted**; warning card
    "One warning before you proceed" / "Restoring from seed replaces the wallet in this browser —
    including any unconfirmed transactions. Your funds on Solana are unaffected." **→ adapted**
    (no address book in B1b-2a); `[Continue]` → step 3.
  - `step-3-card`: "3 / 3"; "Set a new password" / "Once your phrase is verified against this
    wallet, you'll choose a new password (at least 12 characters). The old password stops working."
    **→ adapted**; `[Continue to import]` → #8 with `?mode=import&source=forgot` (the design's path,
    D35 / E5); `[Cancel]` → #9.
- The design's step-2 note "Enter your 24 words — Done — seed verified against your existing public
  key" is exactly E5's seed proof. A phrase that does not match is refused on #8 and nothing is
  changed.
- **Differs:**
  - **Step 1's `[Restore from seed]` goes to step 2, not straight to #8** (review L1). The design
    routes both `[Restore from seed]` and `[Continue to import]` to #8. Here the cards are walked in
    order, so the step-2 warning (the wallet is replaced) is always seen before import.
  - The FLAG_SECURE annotations are removed (D1).
  - Known recipients and settings are kept by the restore (D40, E5); the design's step-2 warning
    mentions address-book entries, which do not exist in B1b-2a.
  - The design's step-3 line "Biometric unlock is also reset — you'll re-enroll after this" becomes
    "A passkey is not carried over; you can add one again later." (passkey management is B1b-2b).
  - "24 words" becomes "12 or 24 words" (import accepts both).
  - "#36 change-pin" is not a step: import sets the password itself.
  - **The back arrow walks back through the steps** (3 → 2 → 1), and goes to #9 only from step 1;
    the design sends Back straight to #9. With the cards walked in order (L1), Back is the way to
    re-read a step (Task 12).
  - **Step 2's CTA reads "Continue"**, not the design's "Continue to import": step 2 leads to step
    3, not to #8 (plan-mandated, with L1); "Continue to import" is step 3's.
  - **Plan 2 (controller adaptations of the design's step copy — confirmed by the owner 2026-10-01):**
    step 1's card 2 "You'll be taken to the import screen. Type or paste your words." and card 3
    "Once your phrase is verified against this wallet, you'll choose a new password (at least 12
    characters). The old password stops working."; step 2's title "Enter your words", lede "Type or
    paste the 12 or 24 words, in order." (the design's word picker does not exist) and card 3 "After
    your phrase is verified."; step 3's card 3 "You'll choose a new password. The old password stops
    working. A passkey is not carried over; you can add one again later." The FLAG_SECURE hints are
    removed (D1). The mockup's `.s-secintro` scope is not carried: none of its rules applies to #39's
    cards.
  - **Step 3's card 2 reads "Next — your seed is checked against your existing public key."**
    → adapted (owner decision 2026-10-02): the design's "Done — seed verified against your existing
    public key." reads as false at step 3, since the seed proof runs on #8, after `[Continue to import]`.

### 3.12 #40 import-success (UI tab `#/imported`)

- **Where:** `wallet.html` (D10), after the vault page stores the imported wallet.
- **Engine:** `wallet.state` (accounts), `wallet.balances` per account (sequential, ≤ 6),
  `wallet.prices`.
- **States:**
  - `loading`: the ring + "Checking what this wallet holds…" + skeleton rows.
  - `single-account-N-tokens`: "Wallet imported"; "1 account · N tokens recovered. Welcome back.";
    "Total value recovered" + the market total (SOL + USDC + USDT) "≈ X SOL"; one row per token
    held (TokenTile, name, amount, USD; NOC's value reads "$… at stage price"); "Your wallet
    address" in groups of four + `CopyButton` ("Copied" / "Copy failed", honest), and under it #7's
    "Copying puts the address on your clipboard. Noctura does not clear it afterwards." (**controller
    addition** — confirmed by the owner 2026-10-01, plan-2 review M3); then **"Wallet is ready — open
    the Noctura icon"** (D10) and `[Close this tab]`. One token held reads "1 token" (**controller
    addition**, confirmed by the owner 2026-10-01). "≈ X SOL" is truncated, never rounded up — one
    `approxSol` shared with #11 (plan-1 ruling L6; plan-2 review M1).
  - `multi-account-N-tokens`: "N accounts · M tokens recovered."; "across N accounts"; rows summed
    over accounts ("Solana · N accounts"). Past six accounts the copy claims only what was read:
    "N accounts · M tokens recovered from the first 6." and "across the first 6 of N accounts"
    (**controller addition** — confirmed by the owner 2026-10-01, plan-2 review M2). With more than
    six accounts and nothing held on the six read, the screen is this state — "N accounts · 0 tokens
    recovered from the first 6." and a $0.00 total — never `no-assets-empty` (not every account was
    read) and so without `[Try a different seed]` (**controller addition, confirmed by the owner 2026-10-02**
    — Task 16 fix round 1).
  - **Reads:** the tab's provider is quiet on this route (as on #7): no open sequence, no
    `activity.ping`, and its `refresh()` — the `online` event's — reads nothing. #40 makes its own
    explicit reads, the balances one account at a time then the prices, on mount, on its refresh
    button, and on `[Try a different seed]`; each failure is reported to the model (`report`), so a
    403 sets the D26 cool-down and nothing on the page reads again.
  - `no-assets-empty` — shown **only when every account's balance read succeeded** and all four
    tokens are zero on every account (review R2-L5); if any read failed, the `unreachable` state
    shows instead, never "empty": "Wallet imported · empty"; "Your seed checked out, but this wallet
    holds none of the tokens Noctura shows yet. That's fine — go receive some." **→ adapted**
    (design "has no on-chain assets yet": the engine reads four tokens, not every asset); "Recovered 0 tokens" / "1 account ·
    address derivation succeeded"; "A few reasons this can happen:" / "This is a fresh seed — never
    received any tokens" / "You imported the wrong seed for this account" / "Your assets are on a
    different derivation path (we check m/44'/501'/n'/0' for n = 0–4, and the Solana CLI key)"
    **→ adapted** (the engine's real paths; design "m/44'/501'/n'/0/0 for n=0..9"); the address;
    "You can send SOL to this address to fund the wallet."; the D10 line; `[Try a different
    seed]` (secondary). On click it re-reads every account's balances first (`LockedButton`): if
    anything arrived, the button disappears and the screen switches to the funded state; only if all
    are still zero → `unlock.html?mode=import&source=retry` (D41, E5). The background guard (C6)
    repeats the check at the moment of deletion, whatever the page saw.
  - **extension-only:** `locked` ("Wallet imported. Unlock it to see what was recovered." +
    `[Unlock]` → `?mode=unlock&return=imported`); `refused` (D26 banner); `unreachable`
    ("Balances could not be read right now." + refresh). In both, under the message and the address,
    the sticky bar with the D10 line and `[Close this tab]`: the wallet is stored whatever the read
    said, so the user is never left without the way on (controller ruling, Task 18 fix round 1).
- **Differs:**
  - "+ N more tokens" overflow row not built (the engine knows 4 tokens).
  - BONK/JUP rows impossible (4 tokens).
  - The total excludes NOC (spec §4 / `web/`: the NOC value is not a market price; §11 conflict 2).
  - `[Try a different seed]` **is built** (D41), in the `no-assets-empty` state as drawn, but it is
    not a replacement of the same buffer as the design says: it asks for the current wallet's
    password first, then runs #8 → #5 for the new phrase, then deletes and stores (E5's D41 path).
    The extra password step is the re-authentication D35 requires.
  - `[Open wallet]` becomes the D10 line.
  - Long-press menu and 30 s clipboard clear dropped.
  - The `v1_imported` MMKV annotation does not apply.
  - **→ adapted:** the address is shown whole in groups of four (`AddressGroups`, as #7 and #13),
    not as the design's continuous string with the first and last six highlighted (`.ck`).
  - NOC's sub-label is "Noctura": the design's "Noctura · pre-TGE" suffix is dropped (no TGE wording
    or date on this screen).
  - The footer captions are dropped: the `v1_imported` / haptic note (single-account) and "3
    derivation paths scanned (m/44'/501'/0/0/0..2)" (multi-account) — design annotations, and the
    second is not the engine's paths (the empty state's third reason names the real ones).
  - The empty state's footer keeps "You can send SOL to this address to fund the wallet." and drops
    its second sentence, "Or tap "Open wallet" to keep going." — there is no `[Open wallet]` (D10).
  - The "Previous wallet replaced" 4-second toast (the design's atomic-replace annotation) is not
    built: every hand-over reaches the same `wallet.html#/imported` — a plain import, #39's restore
    (the same wallet, re-stored), the D41 retry's completion (a replacement) and the D41 retry's
    Back (no replacement) — so the tab cannot know a wallet was replaced, and the background keeps
    no record of it. A hash that said so would let the URL assert a fact the screen cannot check
    (§1.6: the hash only chooses a screen). The vault page names the replacement before it happens
    (#8 `source=retry`: "Confirm with the password of the wallet you are replacing").
  - **Plan 2 (visual pass):** the address keeps the design's chip colour and size (`--fg-secondary`,
    12/16) in groups of four; only the first-6/last-6 `.ck` accent is not drawn (above).
  - **Plan 2 (visual pass):** the copy button is the accent icon on the chip, with no chrome of its
    own (48 px hit area); the mockup's light square is the browser's default button style, which the
    design's CSS never sets. The refresh in `unreachable`/`refused` is a 48 px icon button.
  - **Plan 2 (visual pass):** the sticky bar (the D10 line with `[Close this tab]`, or with
    `[Try a different seed]` when empty) stays at the bottom of the tab while the screen scrolls.

---

## 4. The send flow (popup; the tab after re-authentication)

### 4.1 The popup's locked screen (derived from #9, no mockup of its own)

- Lock tile, "Welcome back", "Unlock Noctura to continue. Unlocking opens in a new tab.", `[Unlock]`
  (primary) → `tabs.create('unlock.html?mode=unlock')` + `window.close()`; "Forgot password?" →
  `?mode=forgot`. No password field: the password only ever exists in the vault page (D12).
- **Differs:** a derived screen. The password field and keypad are in the tab (D12).
  - "Forgot password?" (`.btn-tertiary`) → `?mode=forgot` in a tab, as #9 — built in plan 2 (the
    plan-1 stand-in is gone).

### 4.2 #12 send

- **Where:** popup, from #11 `Send`. **Engine:** `wallet.state`, the selected account's balances
  (fresh, else cached and marked), `wallet.prices`, `settings.get` (the dollar threshold), and
  `wallet.recipientInfo` (E6) each time the recipient field holds a valid address (local, no
  network); nothing is prepared until the CTA.
- **Elements:** title "Send" (`.noc-h1`); eyebrows "Token" / "Recipient" / "Amount"; token chip →
  #43; recipient field (`.noc-mono`, paste button 48 px); amount (`.noc-balance-lg`), `MAX` chip,
  "Available 62.4821 SOL" (+ "· ≈ $…" when a price is known); fee rows "Network fee" "~0.000005 SOL"
  and "Priority" "Set automatically — shown on the next step" **→ adapted** (D15); sticky
  `[Send SOL]` (the token symbol follows the selection).
- **States:**
  - `idle`: as above, placeholder "Solana address" **→ adapted** (D16: design "Solana address or
    .sol domain"), amount placeholder "0.000000".
  - `invalid recipient`: "Not a valid Solana address — check length & characters" (`--danger`),
    fee "—", CTA disabled. It checks the base58 alphabet, length 32–44, 32 decoded bytes.
  - `insufficient balance`: "Insufficient balance — short by 12.5179 SOL" (BigInt difference,
    formatted), CTA disabled. For SPL, "short by N USDC", plus, when SOL is below the base fee,
    "Not enough SOL for the network fee." (the spec's fee warning).
  - `sent before` (design state 3's recipient hint, from E6 `known`): "Verified · sent before ·
    last 12 days ago" (the days from `lastSentAt`, local time; with `lastSentAt: null`, "Verified ·
    sent before"). Own accounts read "Your account: <name>" and the fee treasury reads "Noctura
    treasury" in the same slot (spec §3 labels). E6 `self` → "This is the account you are sending
    from." and the CTA disabled.
  - `first-time recipient · re-auth gate` (design state 6, E6 `known: false`): banner "First-time
    recipient" / "Re-auth (password) required before broadcast · verify the address
    character-by-character below." **→ adapted** (D7: "PIN" → "password"); the recipient shown in
    full, **in groups of four** under the field **→ adapted** (spec §3; design 6+6 highlight);
    helper "Never sent here before" **→ adapted** (the design's "· checksum highlighted (first 6 +
    last 6)" removed with the highlight); amount line "≈ $1,896.48 · 19% of balance — re-auth
    required"; CTA "Review & unlock to send".
  - The CTA also flips to "Review & unlock to send" and the amount line gains "— re-auth required"
    when #12 predicts the 5 % rule (amount × 100 > balance × 5, BigInt) or the dollar rule (the
    value above `reauthUsdCents`, or no price known: fail closed as the engine does). The
    prediction is a hint: #19/#20 show the engine's own `reauth.reasons`, which decide.
  - **extension-only `pending`**: an open send exists for this account (`wallet.pending`) → banner
    "A send from this account is still pending. Wait until it confirms or expires." + `[View it]`
    → #21/#54; CTA disabled (the engine would refuse `in-flight`).
  - **extension-only `stale`**: balances from the cache → the available line reads "Available
    62.4821 SOL · last synced 2 min ago" in `--warning`.
- **MAX:** SPL → the whole token balance. SOL → `balance − (5 000 + CEILING.normal ×
  computeUnitLimitFor({kind:'sol'}) / 1e6 + TRANSFER_MARKUP_LAMPORTS) − 890 880`, floored at 0.
  That is the worst-case fee plus the rent-exempt minimum, so the engine's `sender-below-rent` rule
  can never refuse a MAX send. The helper reads "MAX keeps 0.00089 SOL so the account stays open,
  plus the network fee."
- **Amount rule:** `^\d+(\.\d{0,d})?$` with `d` = the token's decimals (9 SOL/NOC, 6 USDC/USDT)
  **→ adapted** (design regex allows 6 decimals; rule 2: exact base units via BigInt).
- **CTA:** `LockedButton` (rule 6) → push #19 with `{token, recipient, amount}`.
- **Differs, loudly:**
  - Priority chips Normal/Fast/Instant removed (D15). The engine picks, and the fee shows on #19.
  - `.sol` resolution and its state "marko.sol → Resolved …" removed (D16).
  - Scan icon removed (D13).
  - Address-book (contact) icon removed (B1b-2b, address book #15).
  - **State `fee loading` is not rendered on #12.** The fee is known only after the engine
    prepares, which is #19's `simulating` state.
  - The shielded variant is hidden (D4).

### 4.3 #43 token-selector (sheet, D18)

- **Where:** popup, a `.s8-sheet` over #12 (70 % height, grabber, backdrop).
- **State `default`:** title "Choose a token"; four rows (TokenTile, symbol, name — "Solana",
  "Noctura", "USD Coin", "Tether" — balance, USD value; NOC reads "at stage price"); the current
  token has the design's selected treatment (14 % accent border + tint). A row click selects and
  closes. Esc, backdrop or the grabber close without a change.
- **Differs:**
  - Search, "Popular" grid, "All tokens · 12", the USDC/USDCet explainer, the "no results" state
    and the contract-paste/scan fallbacks are removed (D18: four tokens).
  - The shielded split state is hidden (D4).
  - Long-press → #28 removed (D34).

### 4.4 #19 tx-simulate ("3 of 4")

- **Engine:** `wallet.prepareSend(account, intent)` — its simulation is this screen (E2).
- **States:**
  - `simulating`: title "Review transfer", "3 of 4"; eyebrow "Simulating on Solana mainnet"
    **→ adapted** (design "devnet RPC"); intent card "2.4800 SOL → " + the recipient **in groups of
    four** **→ adapted**; "Building call · N ms" (live elapsed); footer "Noctura server ·
    simulateTransaction · N instructions" **→ adapted** (design "RPC api.devnet.solana.com · …";
    reads go through the coordinator); skeleton card; CTA "Simulating…" disabled; `[Cancel]`.
  - `ready`: "Simulation passed"; "Ready · 412 ms" (`simulation.elapsedMs`); "What this
    transaction does":
    - "No interactions with unknown contracts" / SOL: "SystemProgram · transfer only"; SPL:
      "Token Program · transfer" (+ " · creates the recipient's token account" when rent > 0) —
      PASS;
    - "No token approvals granted" / "Native SOL transfer · zero allowances changed" or "Token
      transfer · zero allowances changed" — PASS;
    - "Recipient is a regular wallet" / "no executable account at <first group>…" — PASS for
      `wallet`; for `new`: "Recipient is a new address" / "no account exists yet — this transfer
      creates it" — PASS; for `program`: "Recipient is a program, not a wallet" / "funds sent to a
      program address may not be recoverable" — WARNING (orange); for `other`: "Recipient is not a
      regular wallet" / "this address is owned by a program" — WARNING.
    - "Balance delta": "Sending" "− 2.4800 SOL" (SPL: "− 12.00 USDC"); "Network fee" "− 0.000005
      SOL"; "Priority" "− 0.00012 SOL"; **added rows when non-zero**: "New token account" "−
      0.00203928 SOL" (rent, spec §4 "shown up front") and "Noctura fee" "− …", or, when zero, one
      line with the reason: "No Noctura fee (status unknown)" / "No Noctura fee before TGE" / "No
      Noctura fee (zero-fee eligible)" (the carried rule); "After" = `simulation.sol.after`
      (`.noc-balance-md`); for SPL a second "After" for the token.
    - no first-time banner here: the design has it on #12 and #20, and both show it (C1);
    - footer "Simulated against slot 271 408 921 · result valid for 30 s" **→ adapted** (the
      engine's prepared-send life; design "~2 s");
    - `[Continue to confirm]`, `[Cancel]`.
  - `failed`, one layout with the design's banner and the cause from the refusal code:
    - `simulation-failed`: "Couldn't simulate" / banner "The network would reject this
      transfer" + the error detail (`.noc-mono`, ≤ 240 chars);
    - `unreachable`: "Could not reach the Noctura server" (review L3: never "you're offline" unless
      `navigator.onLine` is false) / "No answer from the Noctura server within 20
      s." + "Last known state · 9 m ago" / "Stale balance" / "Showing balance from cache · 62.4821
      SOL" CACHED (from E4) + "Cannot verify recipient type" UNKNOWN (design rows kept);
    - `simulation-mismatch`: "Your balance changed while this was being checked" / "Review it
      again.";
    - `insufficient-sol`: "Not enough SOL for the network fee" + detail;
    - `insufficient-token` / `split-balance`: "This token is spread across several accounts in
      your wallet. Send at most N, or move it into one account first." (split) / "Not enough
      <TOKEN> in this account." (insufficient);
    - `sender-below-rent`: "This would leave less than 0.00089088 SOL in your account. Keep at least
      that much, or send everything.";
    - `recipient-below-rent`: "A new Solana account needs at least 0.00089088 SOL. Send at least
      that much.";
    - `in-flight`: #12's pending banner;
    - `failed`: "Something went wrong while checking this transfer.";
    - `coordinator-refused`: the D26 banner (§7.2), and Retry disabled;
    - `locked`: the popup switches to the locked screen (§7.1).
    CTAs: `[Retry simulation]` (re-runs the prepare, `LockedButton`; hidden for refusals a retry
    cannot fix: the rent, split and insufficient ones) and `[Cancel]` → #12 with the draft kept.
    In a failed state there is no `[Continue to confirm]` at all (review L6's negative control).
  - **Leaving #19 towards #12** (`[Cancel]` in any state, the back arrow, Esc) calls
    `wallet.discardPrepared {account}` (E7) first, so a prepared send and its challenge never
    outlive the review the user abandoned. Continuing to #20 keeps them.
- **Differs:**
  - **`[Continue anyway]` removed (D21)**, and with it the design's "proceed at your own risk"
    wording.
  - "3 retries attempted · last error ETIMEDOUT after 5.2 s" replaced by the single cause line.
    The engine never retries (403 terminal, parent §4).
  - RPC names replaced (coordinator).
  - The shielded states are hidden (D4).

### 4.5 #20 tx-confirm ("4 of 4") and the re-authentication hand-off

This section is **the one statement of resume and re-authentication**. §1.6, §3.10 and §7.4
point here. **One user tap per broadcast, always (D38; review B1).**

- **Engine:** the `PreparedView` from #19 (or `wallet.preparedFor` on resume); `wallet.send(id)`;
  `wallet.discardPrepared` (E7).
- **Fee rows, defined once (review M2; the same on #19, #20, #10):**
  - "Network fee" = `networkLamports − priorityLamports` (the base fee: 5 000 per signature);
  - "Priority" = `priorityLamports`;
  - "New token account" = `rentLamports` (when > 0);
  - "Noctura fee" = `markupLamports` when > 0, else the reason line ("No Noctura fee (status
    unknown)" / "No Noctura fee before TGE" / "No Noctura fee (zero-fee eligible)");
  - "Total" (SOL) = amount + `networkLamports` + `rentLamports` + `markupLamports` =
    `solRequiredLamports`. For SPL: "12.00 USDC + <solRequiredLamports> SOL".
  - Component test: the displayed SOL rows sum to `solRequiredLamports`, and on #19 for a SOL send
    `before − solRequired === after`.
- **States:**
  - `default`: title "Confirm send", "4 of 4"; headline "Send 2.4800 SOL to" + **the recipient in
    groups of four, equal weight** **→ adapted** (spec §3; design `Gabc12…7cxyz9` with 6+6
    `--accent`); review card "You are about to send" / "2.4800 SOL" / "≈ $412.34 USD"; "From" +
    the account name and full address; "To" + full address + label when known ("Your account:
    <name>", "Noctura treasury"); "Network" "Solana mainnet · sent through Noctura's broadcast
    route" **→ adapted** (design "Solana mainnet-beta DIRECT"); "Fees" as defined above; "Total"
    with USD; "Quote valid 28 s · slot 271 408 921" — the 30 s prepared life and nothing else (D39).
    At 0, #20 re-prepares by itself (a read, never a send) and shows the fresh values with "Updated
    with a fresh network quote" — **at most once without user input** (C5; review R2-H1). When that
    quote also runs out with no input since, #20 shows "Quote expired — refresh" and a `[Refresh]`
    button; the refresh is a tap, which also sends `activity.ping`. `[Send 2.4800 SOL]`
    (`LockedButton`); `[Cancel]`. **Send is never autofocused** in any state, `confirmed` and
    `resume` included (review R2-L4): Enter on a freshly loaded #20 does nothing.
  - `first-time recipient` (`first-send` in reasons): banner "You've never sent to this address" /
    "First-time recipient · check the whole address below, group by group, against what you
    expect." **→ adapted** (spec §3; design "double-check the first 6 and last 6 characters in
    --accent").
  - `high-value` (`over-5-percent` or `over-usd-threshold`): the design's red border, "High-value
    transfer", "42.5000 SOL ≈ $7,074 USD · 68 % of your balance"; in place of the typed field, the
    line "You'll confirm with your password (or passkey) in a new tab before this is sent."
    **→ adapted** (D22); CTA enabled.
  - Any reauth reason also shows, under the CTA, "Confirmation opens in a new tab." (D12).
  - **extension-only `confirmed`** (a resume after a proven re-auth): the banner "Confirmed. Review
    the fresh quote and send." above the same content, and the CTA `[Send 2.4800 SOL]`.
  - **extension-only `resume`** (popup reopened with a live resumable): the same #20, with "You have
    a send waiting." Nothing is sent until a tap.
  - **extension-only `pending`**: a send from this account is open → Send disabled with "A send
    from this account is still pending." (review L6).
- **Send sequence** (the rule 6 lock is held from the tap until the reply):
  1. Tap with `reauth === null` → `wallet.send(id)`.
  2. Tap with `reauth !== null` → `tabs.create('unlock.html?mode=reauth&challenge=<id>')`. The popup
     closes (focus leaves it). In the tab, #10 → `confirmed` → the same tab loads
     `wallet.html#/send/resume?account=…`.
  3. **Resume** (that tab, or a reopened popup; also any other opener of that hash): read
     `wallet.preparedFor(account)`. If `expired`, `wallet.prepareSend(account, intent,
     challengeId)` with the carried challenge (re-based, D39). `expired` is also true when the send's
     challenge is already dead, however young the send (plan 3, review M1: a re-based challenge ends at
     C5's 10-minute cap, not 120 s after the send was prepared); the re-prepare then gets a fresh
     challenge, and the tap opens #10 for it — once. **Then show #20** (`confirmed` if a
     re-auth was just proven, `resume` otherwise) **and wait for a tap.** No code path from a resume
     calls `wallet.send` without a tap. After the tap, step 1 or 2 applies.
  4. `wallet.send` refusals:
     - `prepared-expired` (the quote expired between the tap and the send) → re-prepare with the
       challengeId, show the fresh #20 with "Updated with a fresh network quote — review and send",
       and **wait for a new tap**. The earlier tap is never reused for new values.
     - `reauth-required` **with** `{challengeId}` (the prepared send is intact; the proof is
       missing) → the #10 tab again, on a tap only. `reauth-required` **without** a challengeId (the
       engine consumed the prepared send and the challenge did not match or had expired, e.g. past
       C5's 10-minute cap) → back to #19 with "Your confirmation expired — review again" (review
       R2-M3). The client accepts both shapes, and both are tested against the real
       `handleMessage`.
     - **Loop guard** (for `reauth-required` with a challengeId): if it happens right after a
       `confirmed` resume for the same intent, the screen shows "Your
       confirmation did not carry over. Confirm again." once. A second time in a row goes back to
       #12 with the draft and "Something went wrong — start the send again." A tab is never opened
       without a user tap.
     - `check-pending {id, signature}` → #21, tracking that pending record (never "nothing sent").
     - `failed` → read `wallet.pending`. If a record for this account created after the tap exists,
       #21 tracks it. Otherwise #21's `check-pending` state: "We could not confirm whether it was
       sent. Check Activity before trying again." (carried rule: never "nothing sent").
     - `coordinator-refused` → D26 banner; nothing retried.
     - `locked` → locked screen.
     - `unknown-prepared` / `prepared-invalid` (after a tap) → **first read `wallet.pending`**: a
       record of this account created at or after the time #20 was shown means the send went out
       (a second window, or a double tap that raced the lock), so #21 tracks that record. Only
       without one → back to #19 (re-prepare). Component test with the record present → #21, not
       #19 (review R2-M2).
- **Cancel and back:** `[Cancel]` → `wallet.discardPrepared {account}` (C2) → #11 with the toast
  "Transaction cancelled. No fees charged." (true: nothing was signed). The back arrow → #19 with
  the prepared send kept (not a cancel).
- **Client tests (review B1):** a resume with `reauth: null` never calls `wallet.send`; any resume
  (confirmed, expired, popup reopen, hash opened by another page) never calls `wallet.send` before a
  tap event; `prepared-expired` after a tap never calls `wallet.send` again without a second tap.
  Mutation: an auto-send on resume must fail these tests.
- **Differs:**
  - Priority chip strip removed (D15).
  - "Save as — Add to address book? · Add · Skip" removed (B1b-2b, #15).
  - The typed-CONFIRM field removed (D22).
  - The 6+6 checksum highlight replaced by groups of four + labels + the first-send warning
    (spec §3).
  - The design's absolute threshold "5 SOL" is the engine's $100 setting.
  - **After #10, the send is not executed automatically** (D38): #20 returns with a fresh preview
    and one tap sends.
  - **`[Cancel]` cancels** (C2) and returns to #11; the design's Cancel → #19 is the back arrow here.
  - The shielded state is hidden (D4).

### 4.6 #21 tx-status

- **Where:** popup, or the tab after a resumed send. **Engine:** `PendingView` from `wallet.send`,
  then `wallet.pending` every 2 s, matched by id.
- **States:**
  - `broadcasting` (`pending`, < 80 s): "Sending…"; ring; "Broadcasting transaction…"; "Submitted
    to Solana mainnet · waiting for first confirmation"; Amount / USD; "To" + the address in groups
    of four; "Status" "Broadcasting"; "You can close this window — Noctura keeps watching this
    transaction." **→ adapted** (the design's "Don't close the app · this usually takes 8–12 s" is
    untrue here: pending sends live in `storage.local` and the background polls); "If this fails,
    your funds stay in your wallet — no fees are charged until the network accepts the
    transaction."; disabled CTA "Waiting for confirmation" **→ adapted** (design "Don't close ·
    waiting for confirmation").
  - `stuck · about to redirect` (`pending`, 80–90 s after `createdAt`): pill SLOW; "Taking longer
    than usual"; "The network hasn't included it in a block yet." **→ adapted** (design "Network is
    congested · the tx is in the mempool …": the engine cannot tell congestion from a drop); "Tx
    hash" + `CopyButton`; "Status" "Waiting · 1 m 23 s"; "Recovery options will appear in 07 s".
    At 90 s, or when the engine reports `stuck`, it goes to #54.
  - `success` (`confirmed`): "Sent"; pill CONFIRMED; "Sent successfully"; "Confirmed in N s"
    **→ adapted** (only when this screen saw the change live; the design's "in 2 blocks · finalized
    in < 13 s" needs data the engine does not keep); Amount/USD; To; "Tx hash" (full, mono, Copy);
    "Fee paid" = the prepared network fee (exact: the compute-unit price and limit are signed) +
    Noctura fee when charged; `[View details]` → #27 (by signature, §6.3); `[Done]` → #11 (popup) /
    "Done — open the Noctura icon any time." + `[Close this tab]` (tab).
  - `failed` (`failed`) → #44. `expired` (`expired`) → #44's expired state.
  - **extension-only `check-pending`**: "Checking whether it was sent…" while `wallet.pending` is
    read; if no record is found: "We could not confirm whether it was sent. Check Activity before
    trying again." + `[Open Activity]`.
  - **extension-only `detail`**: a non-null `detail` from the engine (e.g. "Not acknowledged yet;
    still watching. \"Send again\" re-sends the same transaction.") shows as a caption under the
    status.
- **Differs:**
  - "Slot" row removed (not in `PendingView`).
  - "Confirmed in 2 blocks · finalized" replaced as marked.
  - The back arrow stays disabled while broadcasting (design); closing the popup is allowed and
    said so.
  - The shielded success is hidden (D4).
  - Haptics and Dynamic Island dropped.

### 4.7 #44 tx-failed

- **Where:** popup or tab, from #21/#54. **Engine:** `PendingView.state`, **`PendingView.failure`
  (E8, C3) selects the state**, and `detail` is the caption. The screen never parses `detail`.
- **States (the design's categories the engine can report):**
  - `blockhash-expired` (engine `expired`): "Transaction" / "Failed"; hero title "Recent blockhash
    expired" (design); hero sub "Not confirmed — no funds moved." **→ adapted** (the engine's exact
    line replaces the design's first sentence under the title); "Solana rotated past the blockhash
    before your transaction reached a leader. Tap retry — the wallet will fetch a fresh one."; "Reason · blockhash-expired"; "Original payload
    preserved": To (groups of four), Amount; "Valid until block <lastValidBlockHeight>" **→
    adapted** (design "Built at 9 : 39 : 47 (89 s ago)", "slot … age …" — the engine keeps the
    height, not the age); "No fees were charged. Retry is a fresh transaction with a new blockhash —
    same recipient, same amount."; `[Try again]` → #19 with the same intent (a fresh prepare);
    `[Edit transaction]` → #12 prefilled.
  - `rejected-by-program` (`state: 'failed'`, `failure: 'landed'`): "Transaction" /
    "Rejected"; "Program rejected the transaction"; "The on-chain program returned an error. Your
    funds are unchanged — the failure happened on the program, not on your wallet." — **→
    adapted:** the last sentence becomes "The network fee was charged; the amount did not move."
    (for a transfer that failed on chain the fee is charged); "Reason · rejected-by-program" + the
    engine `detail` (`.noc-mono`, ≤ 240 chars); `[Try again]` → #19; `[View on explorer]` →
    solscan (S5).
  - `network-error` (`state: 'failed'`, `failure: 'not-sent'`: the route's 400 rejection or the
    cool-down): "Couldn't send"; the engine `detail` ("The network refused this transaction (…). No
    funds moved." / "Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds
    moved."); "Reason · network-error"; `[Try again]` → #19 (disabled during the cool-down, D26).
  - **extension-only generic** (`state: 'failed'`, `failure: null`, only from a record written by
    an older build): "Transaction failed" + `detail`; `[View on explorer]`.
  - `user-cancelled toast`: back on #11, the pill toast "Transaction cancelled. No fees charged."
    (1.8 s), after #20's `[Cancel]` (E7 discarded the prepared send, so the sentence is true). #10's
    Cancel shows its own line in the vault tab instead (§3.10, E7).
- **Differs, loudly:**
  - **`insufficient-fee` state removed.** The engine never reports "fee too low", and priority is
    automatic (D15).
  - `rejected-by-program`'s Jupiter slippage content and `[Adjust slippage and retry]` removed
    (no swaps; #45 not planned).
  - `network-error`'s RPC picker and `[Switch RPC and retry]` removed (reads and broadcast are fixed
    to the coordinator; #55 not planned).
  - The shielded variant is hidden (D4).
  - `[View details]` → #27 is offered only when a history entry exists.

### 4.8 #54 stuck-tx — the safe variant (D23)

- **Where:** popup or tab, from #21 at 90 s / engine `stuck`. **Engine:** `wallet.pending` (every
  2 s), `wallet.resend(id)`.
- **The design's layout, only the levers differ:**
  - `stuck` (default): "Transaction stuck"; chip "90 s timeout"; warning banner "Pending for 01 : 34"
    (counts from `createdAt`, 1 Hz) / "The network hasn't confirmed it yet — it may be congested, or
    the transaction may have been dropped." **→ adapted** (design "Solana mempool eviction or
    expired blockhash." states a cause the engine cannot know); "Funds have not moved yet. This
    transaction can still land until its blockhash expires." **→ adapted** (the design's "Funds NOT
    moved — they are still in your wallet" is not known to be true while it can land); "Original
    transaction" card: Send / Amount / "Recipient" (groups of four) / "Tx hash" + Copy / "Valid until
    block <lastValidBlockHeight>" **→ adapted** (design "Blockhash …" and "Priority fee 10,000
    µ-lamports / CU": neither is in `PendingView`). Two cards:
    - "Send again" / "Recommended" / "Re-send the exact same signed transaction. Same signature —
      it can land at most once, and you pay its fee at most once." **→ adapted** (D23; design "Speed
      up — Re-broadcast the same payload with a higher priority fee");
    - "Wait for expiry" / "If it has not landed when its blockhash expires, Noctura checks twice
      and then tells you no funds moved. Only then can you try again." **→ adapted** (D23; design
      "Cancel with replacement — Submit a 0 SOL self-transfer …").
    Sticky: `[Send again (same transaction)]` (primary, `LockedButton` ≥ 500 ms; the engine also
    refuses `too-soon` within 2 s) and `[Close]` (secondary) → #11 **→ adapted** (design `[Cancel
    with replacement]`).
  - `sending-again`: "Sending again…" / "Re-sending the same transaction." + the elapsed counter;
    CTAs disabled.
  - `sent-again` (design `done-speedup` layout): "Sent again"; "The same transaction was sent to the
    network again. Its signature is unchanged, so only one copy can land." **→ adapted**; "Tx hash"
    (the same) + Copy; "Status" "Watching"; `[View in Activity]` → #26, `[Done]` → #11.
  - `expired` (design `done-cancelled` layout, neutral X): **"Not confirmed — no funds moved."**
    (the engine's line) / "Its blockhash expired and two checks found it on no block. You can now
    make a new attempt."; `[Try again]` → #19 with the same intent (fresh prepare); `[Done]` → #11.
  - while on this screen: `confirmed` → #21 success; `failed` → #44.
  - `wallet.resend` refusals: `too-soon` → "Wait a moment before sending again."; `not-open` → the
    record's current state screen; `unknown` → "This transaction is no longer tracked." + `[Open
    Activity]`.
- **Differs, loudly:**
  - **"Speed up" (a higher priority fee) and "Cancel with replacement" (a 0 SOL self-transfer) are
    not built (D23).** Both are new transactions with new signatures while the original can
    still land. The design's line "Solana enforces single-execution by tx hash — only one settles"
    is false for a re-signed payload.
  - The priority-fee and blockhash rows are replaced as marked.

---

## 5. Home, receive, accounts (popup)

### 5.1 #11 dashboard

- **Where:** popup, tab bar "Home". **Engine:** §1.6's open sequence; `wallet.pending` for the
  strip.
- **Elements:** top bar: avatar (the account's first letter, e.g. "M") + account name + chevron →
  the switcher (D14); refresh icon button 48 px (D2; spins while reading); eye button 44 px in a 48
  px shell. Hero: eyebrow "Total balance" (`.noc-overline`), the market total `$14,881` + `.19`
  (`.noc-balance-xl .noc-numeral`), sub-balances "62.4821 SOL" · "4,200.00 NOC" (`.noc-body-sm
  .noc-numeral`). Quick actions: Send → #12, Receive → #13. "TOKENS" header. Token rows (TokenTile,
  `.noc-body-lg` symbol/name, amount, USD; NOC's USD with "at stage price"). Only held tokens show,
  except SOL and NOC, which always show.
- **States:**
  - `cold-mount skeleton`: only when no cache exists (first open). Skeleton hero and 4 rows, until
    the first read answers — either way.
  - **extension-only `read failed`** (final review I1): the first read answered with a failure that
    has no banner of its own (`failed`, not `unreachable` or `coordinator-refused`) and nothing is
    cached → #11's layout with "—" (never the skeleton, never "$0.00"), Receive (D36), the refresh
    button, and the danger line "Could not read your balances. Try again." — **a controller
    addition (final review), confirmed by the owner 2026-10-01**. A good refresh replaces it.
  - `loaded`: as above.
  - `hidden balance`: eye toggled → "Tap eye to reveal" in place of the total, "••••SOL" /
    "••••NOC", rows "•••••• SOL" / "••••". Persisted per S4 (`localStorage`
    `noctura.ui.v1.hideBalances`).
  - `refresh active` (D2, replaces `pull-refresh active`): the refresh icon spins and the hero keeps
    the old values until new ones arrive (no flicker).
  - **extension-only `stale`**: cached values (E4) with the design's #42 stale treatment (0.6
    opacity, `--fg-secondary` meta) and the caption "Total balance · cached 2 min ago", until the
    fresh read lands.
  - **extension-only `stale after a failed refresh`** — **owner decision 2026-10-01 (delegated to
    the controller)**: any failed balance read while balances are shown (`failed`, `unreachable`,
    a timeout, or `coordinator-refused`) marks them stale exactly as cached values are (E4): the same
    0.6-opacity treatment, the caption "Total balance · cached 2 min ago" (the age of the last good
    read), rows "· cached", and the existing "last synced 09:41:13" hero line. `lastSync` stays at
    the last successful read and never moves forward on a failure. A `failed` read (a non-network
    error) also shows the danger line "Could not read your balances. Try again." with the stale
    balances (until now it appeared only when nothing was cached). The #42 and D26 banners behave
    as before; this only adds the stale mark under them, and the 403 state stays sticky (a success
    never clears refused). A later successful read clears the stale mark and the line. Never zero or
    "failed" in place of a balance (§7.3).
  - **extension-only `pending strip`**: an open send of this account → a `.banner.info` strip
    "Sending 2.48 SOL · pending" (or "· taking longer than usual") → #21/#54.
  - **extension-only `resume`**: a live resumable prepared send → the popup opens #20 (§1.6).
  - `offline` / `refused`: §5.4.
  - **extension-only `no price`**: prices unknown → the total reads "—" with "Prices unavailable";
    token amounts still show (never "$0.00", `core/portfolio/value.ts`).
- **Differs, loudly:**
  - Mode toggle and the shielded state removed (D4).
  - Bell and badge removed (D28).
  - Scan removed (D13).
  - **"+2.34% · 24h" and each row's 24 h % removed** (no 24 h source in the engine, G2; not among
    the engine extensions of §2).
  - **Quick actions "Swap" and "Buy" removed** (swap not planned; presale is B1d).
  - **Presale banner "NOC Presale · Stage 3 …" removed** (B1d).
  - "See all" and token-row taps removed (#25/#28, D34).
  - BONK row impossible (4 tokens).
  - **The total excludes NOC** (spec §4 / `web/`; §11 conflict 2).
  - **Cold skeleton (from Task 12):** the real top bar instead of skeleton circles; no mode-toggle
    bar (D4); no "See all" skeleton; the quick-action skeleton shows only the actions that exist —
    Receive in plan 1, Receive + Send from plan 3.
  - **Plan-1 stand-in:** no Send quick action and no resume until plan 3 (§12); the pending strip
    shows the state text and opens Activity.
  - The bottom nav is Home / Activity / Settings (D3), not Home/Portfolio/NFTs/Profile.
  - Pull-to-refresh becomes the refresh button (D2).

### 5.2 Account switcher (derived from #43's sheet, D14)

- **Where:** popup, `.s8-sheet` opened from the avatar/name on #11 (and from Settings → Accounts).
- **Engine:** `wallet.state` (accounts, names, selected, scheme); `wallet.cached(account)` for each
  row; fresh `wallet.balances` for the first 10 rows in list order, one at a time (2 requests each,
  inside the proxy's budget); `accounts.select`, `accounts.rename`.
- **Copy (derived; no mockup, so each string is new):** title "Accounts"; a row per account:
  avatar initial, name (`.noc-body-lg`), the address's first two groups of four + "…" (`.noc-mono`,
  equal weight), balance "12.4821 SOL · $1,234.56" (USD market total), a caption "cached 2 h ago"
  when stale, "not checked yet" beyond the first 10; the selected row gets #43's selected treatment
  and a check. Row click → `accounts.select` → sheet closes, #11 reloads. A pencil icon on each row
  → inline rename field (`maxlength=32`) + `[Save]` / `[Cancel]`; errors: `malformed` → "Names are 1
  to 32 characters, without control characters."; `busy` → "The wallet is busy. Try again.";
  `unknown-account` → "That account no longer exists." Bottom: `[Add account]` →
  `tabs.create('unlock.html?mode=accounts')` (password asked there). For a `cli` wallet it is
  disabled with "A Solana CLI wallet has exactly one account."
- **Differs:** a derived surface (D14). Remove and reorder accounts are B1b-2b (accounts manager).

### 5.3 #13 receive

- **Where:** popup, from #11 Receive (and #41).
- **States:**
  - `plain address`: "Receive"; eyebrow "Transparent · public address" **→ adapted** to "Public
    address" (D4 hides the mode vocabulary); QR (S6) of `solana:<address>` with the centre "N" mark;
    "URI · solana:Gabc…xyz9" (helper, `.noc-caption .noc-mono`); card "WALLET ADDRESS" / "tap to
    copy" + the full address in groups of four (click copies); "Request amount (optional)" field
    (0.0 SOL, clear-X); `[Copy address]`.
  - `pay request` (amount valid): ribbon "PAY · 2.480000 SOL"; QR of `solana:<address>?amount=2.48&label=Noctura`
    (rebuilt 200 ms after the last keystroke); "URI · solana:Gabc…xyz9?amount=2.48"; "Requested
    amount" 2.480000 / "SOL · ≈ $391.84"; `[Copy link]`.
  - `copy active`: toast "Copied. Noctura does not clear your clipboard." **→ adapted** (design
    "Copied — auto-clears in 28s"); card header "COPIED TO CLIPBOARD" / "Noctura does not clear it
    afterwards." **→ adapted** (design "auto-clears in 28 s"); the button reads "Copied" for 2 s
    (CopyButton's honest states, including "Copy failed").
- **Differs:**
  - `[Share]` / `[Share request]` removed (D19: copy only).
  - The 30 s auto-clear and its countdown are not built (spec §4).
  - The shielded payment-code state is hidden (D4).
  - The amount request is SOL only, as the design shows.

### 5.4 #42 offline, and the server-refused state (states of #11)

- **Detection:** `navigator.onLine` false or the `offline` event → `just-disconnected` with the
  design's copy below. A read answering `unreachable` (E4) while `navigator.onLine` is true → the
  same layout, but the banner reads **"Could not reach the Noctura server"** / "Showing your last
  synced balances." (review L3: the extension cannot tell a dead network from an unresponsive
  server, so it does not claim the user is offline). `coordinator-refused` → the D26 state.
- **States:**
  - `just-disconnected`: banner "You're offline" / "Network just dropped · the Noctura server is
    unreachable" **→ adapted** (design "api.mainnet-beta.solana.com unreachable"); "Total balance ·
    cached 2 s ago" + cached values (0.6 opacity); "≈ 79.04 SOL · last synced 09:41:13" (local time
    from the cache's `at`); **Send disabled, Receive enabled** (D36); "Sending needs a network
    connection. Receiving works — your address is on this device. Use the refresh button to retry."
    **→ adapted** (D36, D2: no pull; design "Sending and receiving need a network connection. Pull
    down to retry."); rows with "· cached"
    and "price 09:41:13".
  - `sustained` (≥ 30 s offline or 2+ failed refreshes): "You're offline · Showing cached data";
    "Last synced 2 min 18 s ago · 3 retries failed" (the retries this popup made); "Stale · 09:41:13"
    in `--warning`; "prices may have moved"; callout "What you can still do offline:" / "Read your
    last synced balances" / "Show your address to receive funds" / "Lock the wallet from
    Settings" **→ adapted** (the
    design's address book and air-gap items do not exist in B1b-2a); rows "stale".
  - `reconnecting`: "Connected · syncing" / "Auto-dismisses in 1.5 s"; the refresh spinner beside the
    cached value; rows flip to "live" in `--success` when the fresh values land; actions enabled.
  - **`refused` (D26):** banner (`.banner.warning`) **"The server is not answering for now — try
    again in 10 minutes."**, cached values with the stale treatment, Send and the refresh button
    disabled. Nothing retries automatically (403 is terminal, parent §4). The state clears on the
    first successful read after the popup reopens.
- **Differs:**
  - "Reachable · 48 ms" latency line removed (the engine does not measure it).
  - "+0.4 % live" becomes "live" (no 24 h change).
  - Pull-to-refresh becomes the button (D2).
  - **Receive stays enabled offline (owner, D36)**; the design disables Send, Receive and Swap.
    #13 needs only the local address (its fiat line shows "—" offline). Send stays disabled.
  - The air-gap link is removed.
  - **#42's own layout is not used (from Task 12):** #42 is rendered as states of #11 — #11's hero,
    quick-action row and token rows, with #42's banners, copy and stale marking applied. The design's
    disabled Send/Receive/Swap row becomes #11's quick row with Receive enabled (D36) and Send
    disabled from plan 3 (absent in plan 1); Swap is not planned.
  - Rows read "62.4821 SOL · cached" (the token symbol stays), not "62.4821 · cached".
  - A retry count of zero omits "· N retries failed"; a sync time on another day reads with its date
    ("Jan 2, 09:41:13").

---

## 6. Activity, detail, settings (popup)

### 6.1 Settings tab (minimal) and #38 about

- **Settings** (tab bar "Settings"): title "Settings" (`.noc-h1`); group "Account"
  (`.s7-group-label`): row "Accounts" / meta "N accounts" → the switcher sheet; group "Security":
  row "Lock now" → `vault.lock` → the locked screen; group "About": row "About Noctura" / meta
  "v0.1.0" (`.noc-mono`, from `runtime.getManifest()`) → #38. Rows are `.s7-row`, 56 px.
  A failed "Lock now" (vault.lock not ok, or the wallet still unlocked on the re-read) shows the
  danger line "Could not lock the wallet. Try again." and re-enables the row — **a controller addition
  (Task 16 review, rule 7), confirmed by the owner 2026-10-01**.
- **#38 about:** wordmark "noctura." (`.s7-wordmark`, the dot in `--accent-shielded`); "Solana
  wallet for your browser — your keys stay on this device." **→ adapted** (design "…transparent and
  shielded modes in one app…", D4); "v0.1.0" (mono); "Resources": "noc-tura.io" as plain text
  (`.noc-mono`), not a link (§6.5: Solscan is the one external link); footer "© 2026 Noctura" / "BSL 1.1 · converts to MIT on 2034-01-01".
- **Differs, loudly:**
  - Everything else on #31 is B1b-2b by the owner's decision: Profile, Currency, Notifications,
    Security center, Biometric/passkey, Change password, Backup, Material You, RPC, Connections,
    Advanced, Delete wallet.
  - #38: "build 1234 · 2026-05-08" is replaced by the version only.
  - #38: the rows "Terms of Service", "Privacy Policy", "Open-source licenses · 142 packages" and
    "Help & support" are not built until those pages exist (the privacy policy is a release gate,
    B1e). The design's "noctura.io" becomes the project's real domain "noc-tura.io", shown as
    text, not as a link (§6.5).

### 6.2 #26 activity

- **Where:** popup, tab bar "Activity". **Engine:** `wallet.history(account, before?)` (10 per
  page, ~5 s per page at 2 `getTransaction`/s), `wallet.pending` (open sends on top). `wallet.history`
  answers `{items, next}`, not a bare array (review fix round 1, #1): `next` is the
  getSignaturesForAddress page's own last signature when that page was full, else null — never
  derived from `items.length`, because a signature the RPC has not indexed yet is dropped from
  `items` without shrinking the underlying page, and "Load more" must still offer it.
- **Elements:** title "Activity"; filter chips "All" / "Sent" / "Received" / "Purchases" (D24;
  persisted per S4, `noctura.ui.v1.activityFilter`); refresh icon (D2); date sections (local time):
  "TODAY · MAY 8", "YESTERDAY · MAY 7", "THIS WEEK", "THIS MONTH", then "APRIL 2026"-style month
  headers; rows (40 px icon circle tinted per type, `.noc-body-lg` title, `.noc-body-sm` meta,
  amount `.noc-numeral`, `--success` for incoming):
  - sent: "Sent SOL" / "to Gabc…xyz9 · 9:14 AM" / "−2.4800";
  - received: "Received USDC" / "from H4qZ…m2N1 · 8:02 AM" / "+250.00";
  - purchase: "Presale purchase" / "NOC · 4:36 PM" / the decoded amount when present **→ added**
    (D24);
  - other: "Other transaction" / "no transfer to or from this account · 11:45 AM" / "—" **→
    added** (D24's generic row);
  - failed (any kind with `failed`): "Failed · sent SOL" / "the network fee was charged" / "—"
    (red icon);
  - own accounts show their label ("to Your account: Savings").
  `[Load more]` at the end while the last page was full.
- **States:** `cold-mount skeleton` (5 rows over 2 sections); `loaded mixed`; `filter Sent`
  (sent-only, same grouping; filters apply to loaded rows and "Load more" continues); **filter
  Received / Purchases** (same pattern); **extension-only `pending rows`**: a "PENDING" section on
  top with open sends ("Sending 2.48 SOL" / "waiting · 1 m 12 s") → #21/#54; empty → #41;
  `unreachable` / `refused` → #42/D26 banner over whatever loaded.
- **Differs:**
  - "Swaps" and "Shielded" chips removed (no swaps; D4). "Purchases" added (D24).
  - **Fiat per row ("$369.42") removed**: it would need historical prices. Current prices would
    mis-state past value.
  - OriginBadge "Wallet" / "Dapp · simulated" removed (origin is not derivable from chain; B1c).
  - Row counterparties are truncated as the design draws them (first 4 … last 4, equal weight).
    They are a scanning aid; verification surfaces (#20, #27, #10, #13) show the full address (§11
    conflict 7).
  - Pull-to-refresh becomes the button (D2).
  - **Plan-1 stand-in — failed rows** (Task 17 fix round 1): `core/solana/history.ts` decodes every
    failed transaction as `other` with no token or amount (`if (failed) return other;`), so a failed
    row reads "Failed · transaction" / "the network fee was charged" / "—" (red `.ic.fail` with the
    ✕ glyph), not "Failed · sent SOL"; and the **Sent filter does not include failed sends** (a failed
    row matches only "All"). The design's failed row ("— SOL" with the fee in dollars beneath) needs
    the attempted kind and token, which the decoder does not keep. Owner decision in plan 3.
  - **Purchase row:** the design has no purchase row; it follows 26b's swap row (`.ic.swap` with
    `#i-swap`).
  - **Other row:** the design's no-funds row (`.ic` neutral, `#i-doc`, 26b) is used, but its amount
    stays "—" (D24's generic row), not the design's "No funds moved": the meta line already says "no
    transfer to or from this account".
  - **Meta lines:** an address line ("from H4qZ…m2N1 · 8:02 AM") is `noc-mono` as 26b draws it. A
    line that names an own account ("to Your account: Savings · …") stays in the body face: the design
    has no labelled row, and in mono the label is clipped at 412 px.

### 6.3 #27 tx-detail

- **Where:** popup, from a #26 row or #21 `[View details]`. **Engine:** the `HistoryView` row (from
  #26's loaded pages, or `wallet.history` paged until the signature is found, at most 3 pages; else
  "This transaction is not in the recent history yet." + explorer link).
- **States:**
  - `transparent-send`: top bar "Transaction"; eyebrow "SENT"; "−2.4800 SOL" (`.noc-balance-lg`) /
    "≈ $369.42" **→ adapted** to "≈ $… now" (current price, labelled so; historical price is not
    available); status pill "Confirmed"; rows: "Type" "Transfer" (SPL: "USDC transfer"); "From"
    (the account name + full address in groups, Copy); "To" (full, groups, Copy, label if known);
    "Hash" (full, mono, Copy); "Network fee" "0.000 005 SOL · $0.0007" (the fraction in groups of
    three with the design's plain space; dollars at today's SOL price, four places, truncated; "· —"
    with no price); "Date" "May 8 2026 · 9:14 AM" (local); `[Explorer]` → solscan (S5). Each Copy is
    the design's `.copy-btn` (the copy glyph and "Copy"; "Copied" / "Copy failed" as CopyButton).
  - `received`: eyebrow "RECEIVED"; "+250.00 USDC" in `--success`; pill "Confirmed · 8 h ago" (the
    block time's age; "Confirmed" when it is unknown); "Type" "USDC transfer" (SOL: "Transfer");
    "From" (full, Copy); "To" "Your wallet" (in `--accent`) + address; "Network fee" "Paid by
    sender"; `[Explorer]`.
  - `failed` **→ adapted** (the design's 27d is a failed swap): the card's danger wash and the
    eyebrow in `--danger` (27d); eyebrow "FAILED · SENT"; "— SOL" / "Fee charged · $0.0007"; pill
    "Failed" (danger); banner "The transaction failed on chain. The network fee was charged; the
    amount did not move."; "Hash", "Network fee charged" "0.000 005 SOL", "Date"; `[Try again]` →
    #19 with the same intent (sent kind only); `[Explorer]`.
  - **extension-only `purchase` / `other`**: eyebrow "PRESALE PURCHASE" / "OTHER"; the decoded
    fields that exist; `[Explorer]`.
- **Differs, loudly:**
  - **"Block" and "Memo" rows removed** (not in `HistoryView`, G13; not among the engine extensions of §2).
  - `[Save]` / `[Save sender]` removed (address book, B1b-2b).
  - Share icon removed (D19).
  - The 6+6 checksum highlight is replaced by groups of four (spec §3).
  - The shielded/dApp state 27b is hidden (D4, B1c).
  - Fiat is labelled "now" as marked.
  - **Plan-1 stand-in — failed** (Task 17 fix round 1; see §6.2's failed-rows entry): the decoder
    gives a failed transaction as `other` with no token, so #27 reads eyebrow "FAILED" (not "FAILED ·
    SENT") and amount "—" (not "— SOL"); `[Try again]` is absent until the send flow (plan 3).
    `TxDetail.tsx` keeps the "FAILED · SENT" arm for that decision. Owner decision in plan 3.
  - 27d's "Reason", "Tried to swap", "Slippage limit" and "Observed move" rows are a swap's; a failed
    transfer has none of them (no swaps, and no failure reason in `HistoryView`).
  - `received`: "To" shows the full address in groups with Copy (a verification surface, §11
    conflict 7), not 27c's short caption "7xKp…vN9D" without Copy.
  - `transparent-send`: "From" adds the account's name above the address, and "To" an own account's
    label ("Your account: Savings") — 27a shows the address alone.
  - The pill's age reads "8 h ago" (format.ts's one age form, as #42's "0 s ago"), not 27c's "8h ago".

### 6.4 #41 empty-activity

- **States:** `default`: title "Activity"; illustration; "No activity yet"; "Your transactions will
  appear here once you send or receive assets."; `[Receive crypto]` → #13; footer "Use the refresh
  button to check again." **→ adapted** (D2; design "Pull down to refresh · we'll re-query the
  Solana indexer."). `refresh active` (replaces `pull-down active`): "Checking the network…" /
  "Re-fetching through the Noctura server" **→ adapted** (design "Checking the indexer…" /
  "Re-fetching from api.mainnet-beta.solana.com"); rows arriving → #26.
- **Differs:**
  - `[View popular dApps]` removed (D25).
  - The top-bar filter and search icons removed (search not built; filters live on #26).
  - Pull becomes the button (D2).

### 6.5 The explorer link — the one external link (D37)

- `[Explorer]` (#27) and `[View on explorer]` (#44) are `<a href="https://solscan.io/tx/<signature>"
  target="_blank" rel="noopener noreferrer">`. The signature is checked (base58, 64 bytes) before it
  is put in the URL. This is the **only external link** in B1b-2a; every other design link that
  would leave the extension is text or omitted (#1 Terms/Privacy, #38).
- **A link only: nothing is fetched.** Opening it is a top-level navigation in a new tab, which the
  extension CSP's `connect-src https://api.noc-tura.io` does not govern (it covers fetch/XHR/WebSocket
  from extension pages). So there is **no CSP change, no host permission, and no change to the
  host allowlist gate**: Solscan is never a fetch target, and `check-csp.mjs` /
  `check-permissions.mjs` pass unchanged. What leaves the device: when the user clicks, their
  browser loads Solscan with that transaction's signature, which is public. The privacy list
  (parent §5) gains that line.
- **Test:** a component test asserts the exact `href`, `target` and `rel`; a source test over
  `src/app/**` asserts that no `href`, `window.open` or `tabs.create` target other than extension
  pages and the Solscan prefix exists.

---

## 7. Errors and edge cases, across screens

### 7.1 Locked mid-flow

Any reply `locked` (or `wallet.state.unlocked === false` from the 5 s poll) switches the popup to
the locked screen (§4.1). The in-memory draft (#12 fields) is kept while the popup stays open.
Prepared sends and challenges are gone (a lock clears `storage.session`), so a flow resumes at #12,
not #20. **Pending sends survive** (`storage.local`): after unlock, #11's pending strip and #26's
PENDING section show them. The tab surface does the same: its `[Unlock]` opens `?mode=unlock` with
no return target, and #10's `not-unlocked` state says to start the send again (review M7).

### 7.2 The 403 cool-down (D26)

`coordinator-refused` from any message → the banner "The server is not answering for now — try
again in 10 minutes." on the current screen (`.banner.warning`, top of the content). Every button
that would reach the network is disabled: refresh, the #12 CTA, Retry on #19, `[Try again]`, Send
again. Cached values stay, marked stale. No timer retries, because the latch would refuse locally
anyway and a retry storm is what bans an IP. A pending send keeps its own engine rules (the latch
refuses its polls locally, and the record stays open until the cool-down ends).

### 7.3 Offline and timeouts

`unreachable` (E4) or `navigator.onLine === false` → #42's states on #11, and on flow screens the
refusal-specific copy (#19's `unreachable`). A timed-out read is never shown as "failed" or as
zero. Sends in progress are the pending record's business: the engine keeps watching, and #21
shows its `detail`.

### 7.4 Prepared-expired carry-over and resume

Defined once in §4.5 (D38, review B1): a resume or a `prepared-expired` re-prepares (carrying the
challengeId, whose 120 s life is re-based by a same-intent re-prepare, D39, never past 10 minutes
from its issue, C5) and **shows #20; one tap
sends; nothing is ever sent without a tap**. `wallet.preparedFor` on popup open resumes a live
prepared send as #20 `resume`. A prepared send the engine no longer reports (past the challenge's
life, or discarded by E7) is gone, and the flow starts at #12.

### 7.5 check-pending and failed sends

Never "nothing sent" (carried rule): `check-pending` → #21 tracking the given id; `failed` → look
in `wallet.pending` for a record of this account created after the tap; if none, #21's
`check-pending` wording, which sends the user to Activity, not to a retry.

### 7.6 Rule 6 — no double submit

`LockedButton` disables itself synchronously in the click handler and re-enables no earlier than
500 ms after the click **and** not before its promise settles. It is used on: #12 CTA, #19
Continue/Retry, #20 Send, #54 Send again, #44 Try again, the switcher's Save, Settings "Lock now".
The vault page's buttons (Create, Import, Unlock, Confirm, Add a passkey, Add account) use the
existing `runExclusive` gate plus the same 500 ms floor. A component test for each proves a second
click inside 500 ms and a second click before the promise settles both do nothing (mutation: remove
the lock → the test fails).

### 7.7 Re-auth loop avoidance

A #10 tab opens only on a user tap. A `reauth-required` right after a `confirmed` resume shows
"Your confirmation did not carry over. Confirm again." once; a second one ends the flow (§4.5). The
re-prepare always carries the known challengeId, so the engine reuses it rather than issuing a new
one.

---

## 8. Testing

### 8.1 Engine (vitest, node)

E1–E8 and E3's re-based challenge life as listed in §2, each with its mutation, plus:
- partition: `vault.challengeInfo` and `vault.forgetWallet` refused from `/popup.html` and
  `/wallet.html`, accepted from `/unlock.html`; `wallet.prices`, `wallet.cached`,
  `wallet.recipientInfo` and `wallet.discardPrepared` refused from a non-extension origin;
- `runtime.onInstalled` opens the welcome tab once, on `install` only (not `update`).

### 8.2 Gates (`scripts/__tests__`)

Each new gate rule (§1.2) gets a fixture that violates it and must fail, and a clean fixture that
must pass:
- a `src/unlock` file importing `src/app/x.tsx`;
- `react` imported from `src/unlock`;
- a built `unlock` chunk containing the React marker;
- a popup file naming `v1_balance_cache`;
- a `src/shared` file importing `src/app/x.tsx`, and `src/unlock/strings.ts` importing anything
  (M4);
- a built output with no React marker at all → INCONCLUSIVE, which fails (M4);
- `wallet.html` loading `src/unlock/main.ts`;
- a `../web/src/ui` file calling `fetch`.

### 8.3 Message client against a fake background

`src/app/__tests__/engine.test.ts`: the client's `send` is wired to the **real** `handleMessage`
with a fake `Ext` (in-memory `storage.session`/`storage.local`), fake `WalletDeps` and a
`/popup.html` sender. That is the real background logic with no browser. It covers:
- every client function's happy path and each of its refusal codes;
- shape checking (a hand-corrupted reply → `failed`);
- the one retry on a thrown `sendMessage`;
- the §4.5 sequences: expire → re-prepare with challengeId → #20 shown, **no send without a tap**;
  `reauth-required` loop guard; `check-pending` → pending id; `failed` → pending lookup;
- **review B1's tests:** a resume with `reauth: null` never calls `wallet.send`; no resume (after
  `confirmed`, after `expired`, on popup reopen, or from a hash another page opened) calls
  `wallet.send` before a tap event; a `prepared-expired` after a tap waits for a second tap.
  Mutation: an auto-send on resume must fail them;
- E7: #20 Cancel and #19 back call `wallet.discardPrepared`, and `preparedFor` is `null` after;
- **R2-M3:** `reauth-required` with a challengeId → the #10 route; without one → #19 with "Your
  confirmation expired — review again"; both shapes produced by the real `handleMessage` (the
  second by consuming the prepared send against an expired challenge);
- **R2-M2:** after a tap, `unknown-prepared` with a pending record of this account created at or
  after #20 was shown → #21 on that record, not #19;
- **C5:** with no input, #20 re-prepares exactly once at the quote's end, then shows `[Refresh]` and
  makes no further `wallet.prepareSend` call (fake timers).

### 8.4 Components (vitest + happy-dom + @testing-library/react, like `web/`)

`vite.config.ts` test config gains `environmentMatchGlobs: [['src/app/**', 'happy-dom'],
['src/unlock/**/view/**', 'happy-dom']]`; everything else stays `node`. Per screen, one test per
state from §§3–6 that renders it from a fixture and asserts:
- the state's **exact strings** (the copy tables here are the source; an adapted string is
  asserted in its adapted form);
- the elements present and the ones deliberately absent (e.g. no "Continue anyway" on #19, no
  "Speed up" on #54, no "ZK-private" on #1, no "Screenshots disabled" anywhere, no "auto-clears"
  anywhere);
- navigation targets;
- **negative controls (review L6):** in every #19 failed state no CTA that continues is enabled
  (no `[Continue to confirm]` at all); #20's Send is disabled while a send is pending for the
  account; #10's `undescribable` state has no Confirm button; **#20's Send is never focused on
  mount**, in `default`, `confirmed` and `resume` (`document.activeElement` is not the Send
  button, and Enter does nothing; review R2-L4).

Plus: `AddressGroups` everywhere an address is verified (#10, #13, #19, #20, #27, #54, #7, #40);
the hidden-balance ladder hides all three layers; `formatAmount` never rounds a balance up; MAX
never produces a `sender-below-rent` amount (a property test over balances). A whole-bundle text
test fails the build if the TGE date appears in any source or built file. It checks the date
formats of the design's #22/#35, and the test file builds its pattern from parts so it does not
contain the date either.

### 8.5 End to end (Playwright, real extension, contained fake coordinator)

The existing harness: `launchContained` (noc-tura.io unresolvable inside the browser),
`installFakeCoordinator` routing every `api.noc-tura.io` request. **Containment grows for the
explorer link (review M5):** `HOST_RESOLVER_RULES` adds `MAP solscan.io ~NOTFOUND, MAP
*.solscan.io ~NOTFOUND`, and a `ctx.route('https://solscan.io/**')` / `*.solscan.io` handler
aborts and counts. Every spec asserts the Solscan counter is 0 (spec 8 checks the link's `href`
without following it). `expectContained` checks the new rule on the command line too. The fake
grows:
- `simulateTransaction` with `accounts`: on the happy path, post-states consistent with the
  transaction (lamports − amount − fee; the token account's amount − amount); on its error switch,
  `err` set and `accounts: null`, as the real RPC answers (review H2). It records whether `accounts`
  was sent and lists a missing field in `unexpected`;
- `getAccountInfo` kinds;
- `getSignaturesForAddress` / `getTransaction` fixtures for sent/received/purchase/other/failed;
- a 403 switch;
- an "unreachable" switch (`route.abort()`).
The popup is opened as `chrome-extension://<id>/popup.html` in a page sized 412 × 600 (Playwright
cannot click the toolbar action; stated). Specs:
1. **Onboarding create:** welcome → #2 → #3 (modal, hold 2 s, confirmed) → #4 (picks the right
   words from the page's own grid) → #5 (password, confirm) → #6 skip → `wallet.html#/created` shows
   the address; the popup then shows #11. On `unlock.html`, `document.fonts.load('16px Geist')`
   resolves to at least one face and `document.fonts.check('16px Geist')` is true (review L5;
   plan-2 review ruling 5: `check()` alone passes when no Geist face exists).
2. **Import:** #8 paste a fixture phrase → scheme auto → #5 → `#/imported` with the fake's balances.
3. **Unlock:** popup locked screen → tab → wrong password → cooldown → right password → popup #11.
4. **Send with re-auth:** #11 → #12 → #43 pick SOL → #19 shows the balance delta and "After" from
   the fake's simulated state → #20 first-time banner → tab #10 shows the amount and full recipient
   **read from `vault.challengeInfo`** (the test also opens a URL with a different, valid challenge
   id → "This confirmation has expired…") → confirm → the same tab shows #20 `confirmed` with a
   fresh preview and **no broadcast yet** (asserted: `broadcasts` is empty) → one tap → #21
   success. It asserts exactly one broadcast. A second run cancels on #10 → the tab closes and
   `preparedFor` is `null` (E7).
5. **Stuck → send again → expire:** the fake in `expire` mode; #21 → #54 at 90 s; `[Send again]` →
   `broadcastWires` holds the **same** bytes twice and nothing else; height past expiry → "Not
   confirmed — no funds moved." → `[Try again]` → #19 with a new prepare.
6. **403:** the fake answers one read with 403 → the D26 banner; no further coordinator hits
   during the test (`hits` unchanged after the banner).
7. **Offline:** reads aborted → #42 `just-disconnected` with the cached balances from an earlier
   successful read; Send disabled and Receive opens #13 with the address (D36); reads restored →
   `reconnecting` → live.
8. **Activity:** filters, a detail page, "Load more", the explorer link's `href`.
9. **Switcher:** rename, select, the dashboard follows.
10. **Forgot password → restore (E5):** a wallet with 2 slip10 accounts, locked → #9 → "Forgot
    password?" → #39 → `[Continue to import]` → #8 with a *different* valid phrase →
    `not-this-wallet`, and the stored envelope is byte-identical afterwards → the right phrase → #5
    new password → `#/imported` shows both accounts; the old password no longer unlocks and the new
    one does; an address sent to before the restore is still known (D40) — in plan 2 asserted
    through the engine's `wallet.recipientInfo` (#12 is plan 3's); plan 3 restores the on-screen
    "Verified · sent before" check, folded into spec 11, which already drives #12 after a confirmed
    send (plan-2 review ruling 4).
    A second run with a pending send open (the fake in `expire` mode, before expiry) gets
    `send-open` and the envelope is unchanged; after expiry the restore goes through.
11. **#12 recipient hints (E6):** a first-time address shows the state-6 banner and "Review &
    unlock to send"; after a confirmed send to it, the same address shows "Verified · sent before".
12. **Try a different seed (D41):** import a phrase with no funds → #40 `no-assets-empty` →
    `[Try a different seed]` → wrong password refused and the envelope unchanged → right password →
    phrase B → #5 → `#/imported` shows B's address; the old password no longer unlocks. **A second
    run (C6):** after #40 has rendered empty and the flow has passed the #40 click, the fake credits
    account 0 → at the finish `funded`, "This wallet now holds funds. Nothing was changed.", and the
    stored envelope is byte-identical.
Every spec asserts `fake.unexpected` is empty and `hits > 0` (routing proven).

### 8.6 Visual fidelity against the design

`e2e/visual.spec.ts` drives every state in §§3–6 from fixtures and saves
`test-results/visual/<NN>-<state>.png` at **412 × 600** for the popup and at 412 px column width for
the tabs. A reviewer (the owner, or a review subagent that is shown both images) compares each
image with the same state in `index.html` (`#sNN`, the A mockups). The check is not a pixel diff:
the mockups are 412 × 916 phone frames with status bars. The reviewer checks, per state:
1. colours are the tokens the DS class map names (accent, danger/warning/success, surfaces);
2. each text element's type tier (`.noc-h1`, `.noc-body-sm`, `.noc-mono`, `.noc-numeral`) matches the
   class map;
3. element order and grouping match the mockup;
4. every string matches the design or is an adapted string listed in this spec;
5. every element is present, or appears in that screen's "Differs" list;
6. controls are ≥ 48 px, there is no horizontal scroll at 412 px, and the sticky bar never covers
   content that cannot scroll clear;
7. dark theme only (the design is dark).
The review's findings are recorded in the PR. The screenshots are CI artifacts, not committed.

**Plan 2's pass** (`e2e/visual-vault.spec.ts`, 59 vault-page, #7 and #40 shots at 412 × 916; findings
in the PR) found these differences that hold on every screen, declared here once:
- `.btn-primary` carries web's `design-system.css` glow (`inset 0 1px 0 …, var(--glow-accent)`) and a
  disabled `.btn` is `--elev-2` with a 1 px `--border-strong` ring and `--fg-tertiary` text; the
  mockups' own CSS draws no glow and a flat `--bg-surface-3` disabled button. `design-system.css` is
  the one source of `.btn*` for the popup, the tab and the vault page (§1.2, §1.7), so the vault page
  does not fork it.
- The column is the tab's full 412 px; the mockups' screen sits inside a ~10 px phone bezel, so every
  horizontal measure here is ~20 px wider. No status bar or gesture pill is drawn.
- A full-page capture keeps a sticky bar where the viewport ended: where a shot shows the bar over
  content, the content scrolls clear in the page (`08-choose-scheme` asserts it; `40-no-assets-empty-end`
  shows the scrolled end).

---

## 9. Out of scope

- **B1b-2b (settings & security):** full #31; #35 security center (incl. the auto-lock picker, the
  re-auth threshold row, and without #35's staking row and its claimable date); #36 change password
  (new vault flow + store rule); the #37 delete-wallet **screen** (its engine half, E5, and both
  proofs are in B1b-2a; #40's `[Try a different seed]` already uses the factor proof, D41); passkey management (#6 manage
  variant); the designed reveal-phrase screen; the accounts manager (remove, reorder); #15 address
  book (storage + messages), with #12's contact icon, #20's "Add to address book?", #27's
  Save/Save sender and the "from your address book" label.
- **B1c (sites):** Wallet Standard provider, #46, #47, #48, #49; "Continue anyway" on a failed dApp
  simulation; OriginBadge; "View popular dApps" (#34).
- **B1d (presale):** #23, #24, #50; the #11 presale banner and the Buy action; purchase details
  beyond the history row.
- **B2 (shielded):** the mode toggle and every shielded variant (#11, #12, #13, #19, #20, #21, #26,
  #27, #43, #44, #54), #16, #17, #18.
- **B1e / release:** Terms, Privacy, licenses and help links (#1, #38); the drainer list; the
  anti-phishing phrase; store packaging.
- **Not planned in B1:** #14 scan (D13), #22 stake, #25 portfolio and #28 token detail (D34), #29
  notifications (D28), #30 NFTs, #32 currency (D27), #33 backup file (D17), #45 advanced (D15),
  #51–#53 air-gap, #55 RPC switcher, swap, fiat on-ramp, `.sol` (D16), 24 h change, historical fiat,
  block/memo in details.

---

## 10. Where things live (new or changed files)

- `extension/wallet.html` (new), `extension/popup.html` (entry → `src/app/popup.tsx`),
  `extension/unlock.html` (sections restyled, new sections for #1, #2, #4, #6, #39).
- `extension/src/app/` (new): `App.tsx`, `popup.tsx`, `tab.tsx`, `engine.ts`, `platform.ts`,
  `WalletContext.tsx`, `router.ts`, `screens/*` (one file per screen), `ui/*`.
- `extension/src/unlock/`: `mode.ts`, `strings.ts` (new), `view/*` (new), `main.ts`, `modes.ts`,
  `onboarding.ts` (passkey step wiring), `reauthFlow.ts` (reads `vault.challengeInfo`),
  `forgetFlow.ts` (new: seed proof and factor proof for E5), `strings.ts` (stand-alone, M4).
- `extension/src/shared/amount.ts` (new, pure).
- `extension/src/styles/design-ext.css` (new); `extension/public/fonts/*` (copied).
- `extension/src/background/`: `walletApi.ts` (`wallet.prices`, `wallet.cached`,
  `wallet.recipientInfo`, `wallet.discardPrepared`, `unreachable`), `messages.ts`
  (`vault.challengeInfo`, `vault.forgetWallet`), `accountsStore.ts` (the forget/replace critical
  section: one `serial` section, the C4 binding, the C6 guard, the step-5 re-check, and a first
  write's cleanup of leftover recipients/settings), `reauthChallenges.ts` (`about`, `issuedAt`,
  `rebaseChallenge` with the 10-minute cap), `prepare.ts`
  (simulation; `isKnownRecipient` extracted; `getAccountKind` replaces `getAccountExists` for the
  recipient; discard), `pendingStore.ts` and `pending.ts` (`failure`, E8),
  `knownRecipients.ts` (`{address, at}` entries), `deps.ts` (`RequestUnreachable`),
  `balanceCache.ts` (new), `index.ts` (`onInstalled`).
- `core/solana/rpc.ts` (`simulateTransaction` accounts + slot, `getAccountKind`).
- `extension/scripts/check-vault-isolation.mjs`, `check-rpc-methods.mjs` (+ tests);
  `extension/vite.config.ts` (entries, React plugin, `sharedResolvesFromHere`, test environments);
  `extension/package.json` (React and test dependencies, `qrcode-generator` exact pin).
- `e2e/fakeCoordinator.ts` (the `accounts: null` error path, the switches), `e2e/launch.ts`
  (Solscan containment, M5), new specs as §8.5–8.6.

---

## 11. Conflicts found between the design, the decisions and the parent spec

Resolved by the owner or the controller after the first draft (kept here so the history is
visible):

1. **#39 restore needed wallet deletion.** *Resolved by D35:* the engine half moved into B1b-2a
   (E5, seed proof in the vault page, refused while a send is open), and #39 → "Continue to
   import" works as designed.
3. **#12's first-time state needed a lookup before prepare.** *Resolved by C1:* E6
   `wallet.recipientInfo` (local only). #12 renders states 3 and 6 as drawn, and #20 keeps its
   banner.
5. **simulateTransaction `accounts` pass-through was unverified.** *Resolved as a precondition:*
   ICO Claude confirms before E2's task starts, and the plan's first task checks it (§2 E2).
   **Confirmed 2026-09-29** (one live call through `/api/v1/rpc`, config `{encoding: 'base64',
   sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed', accounts: {encoding:
   'base64', addresses: [...]}}`): the proxy checks only the method name and forwards the body
   unchanged; `value.accounts` has one entry per requested address in order, `data` is
   `[<base64>, 'base64']`; `preBalances`/`postBalances` and `pre/postTokenBalances` are also present.
   Two rules follow for E2's reader: **never use `rentEpoch`** (u64 max, which `JSON.parse` rounds to
   18446744073709552000); and a **non-existent address is `null`** in `accounts` (Solana RPC spec;
   not tried live) — the reader accepts `null` for exactly those entries and E2's test covers it.
   JSON numbers for lamports are exact only below 2^53 (≈ 9 million SOL) — above that the reader
   refuses as malformed rather than compute on a rounded value.
   **Full-drain simulation — answered by the coordinator team 2026-10-01** (their measurements;
   the wallet side contacted no server):
   - *Measured, drained non-payer:* through `/api/v1/rpc` with an extension `Origin`, HTTP 200,
     `err: null`. One deterministic simulation: an existing account A (the payer) sends 1 000 000
     lamports to a new account B, and B sends exactly 1 000 000 to a new account C. B, drained to
     exactly 0, appears in `value.accounts` as an **object, not `null`**: `lamports: 0`, `owner` the
     System Program, `data` empty base64, `space: 0`, `rentEpoch` u64 max (rounded by JSON). B was
     not the fee payer and did not exist before.
   - *Measured, the payer itself drained ("send everything"):* three simulations (two outcomes below)
     through the same route, all HTTP 200; the payer a quiet, pre-existing System account (one of the project's own fee payers),
     so the payer is the drained account.
     1. The payer sends `balance − 5 000` to a new address and ends at exactly 0: `err: null`, fee
        5 000; `accounts[0]` (the payer) is an **object** — `lamports: 0`, owner the System
        Program, `space: 0`, `executable: false`; `accounts[1]` (the new account) holds the amount
        sent; `postBalances[0] = 0`. A payer that ends at 0 is `{lamports: 0}`, not `null`.
     2. The payer is left with 1 000 lamports (below rent exemption): `err:
        {"InsufficientFundsForRent": {"account_index": 0}}`, fee 5 000; **every** element of
        `value.accounts` is `null`, the recipient's included; `postBalances[0] = balance − fee`, so
        the transfer was not applied. The logs show the System Program transfer as "success": the
        rent check fails after execution, so the logs do not reveal the refusal.
   - *Rules:* a System Program sender may end at exactly 0, but a remainder of 1 … 890 879 lamports
     is refused by the simulation — **measured for the payer** (case 2). A recipient that does not
     exist yet must receive at least 890 880 lamports (the rent-exempt minimum of a 0-data account)
     — **the coordinator's knowledge, not measured**.
   - *Reader rules for plan 3:* decide on `err`, never on `accounts` or the logs. A non-null `err`
     → `simulation-failed`, with `accounts` allowed to be `null` (the existing H2 rule; the reader
     returns `{err, accounts: null}` whatever `accounts` holds). `InsufficientFundsForRent` for the
     sender maps to its own #19 copy in plan 3 — and the max-send must never produce it. Such a
     transaction would still be charged its fee if broadcast, so refusing before broadcast matters.
   - *Consequences for plan 3:* the reader in `core/solana/rpc.ts` (`simulatedAccount`) already
     accepts `lamports: 0` and never reads `rentEpoch`, so a drained payer is not refused as
     malformed (unit tests decode the measured drained object and the refused shape). Max-send must
     either drain to exactly 0 or leave at least the rent-exempt minimum — never a 1 … 890 879
     lamport remainder (§4.2's MAX keeps the minimum). A send to a new recipient below 890 880
     lamports must be refused before simulation with its own copy, to be decided in plan 3 (the
     engine's `recipient-below-rent` and `sender-below-rent` checks in `prepare.ts` and the §4.4
     drafts are the starting point).
6. **#42 disabled Receive although the address is local.** *Resolved by D36:* Receive enabled,
   Send disabled, recorded as a deviation.
9. **Explorer target** (design solscan.io, `web/` explorer.solana.com). *Resolved by D37:* Solscan,
   a link only; §6.5.

Resolved after the independent review (round 1):

14. **#10 "executes send" vs one tap per broadcast** (review B1). The first draft auto-sent after
    re-auth; a reopened popup or another page opening the resume hash could then broadcast a
    preview nobody tapped. *Resolved by D38:* #10 → #20 in the same tab with a fresh preview; one
    tap sends. A deviation from the design, listed on #10 and #20.
15. **Challenge life vs re-prepare** (H3). *Resolved by D39:* re-based on a same-intent re-prepare;
    `unknown-challenge` → #10 `expired`.
16. **Cancel left a live prepared send and challenge** (H4). *Resolved by C2:* E7
    `wallet.discardPrepared`; the #10 toast claim is replaced by the vault tab's own line.
17. **#44 parsed free text to choose a state** (M3). *Resolved by C3:* E8 `failure`.
18. **The E5 replacement binding lived only in the page** (M1). *Resolved by C4:* bound in the
    background.
19. **Restore wiped known recipients** (M6). *Resolved by D40:* kept on a proven same-wallet
    restore; wiped by a delete.

Resolved after round 2:

20. **The re-base could keep one proof alive indefinitely** (R2-H1): #20's automatic re-prepare
    renewed the challenge every 30 s while the screen stayed open. *Resolved by C5:* a 10-minute cap
    from `issuedAt`, and one automatic re-prepare without user input.
21. **E5's steps were not one section** (R2-M1): an envelope write or an unlock could land between
    steps. *Resolved:* one `serial` section, with a revision and session re-check right before the
    vault write. Cleanup of wallet-scoped keys was moved after that write, and a first write clears
    any leftovers, so a `busy` changes nothing.
22. **D41's "empty" was the page's word** (R2-M4). *Resolved by C6:* the background re-reads every
    balance at deletion time.
23. **A tap whose send already went out could re-prepare** (R2-M2), and **`reauth-required`
    without a challengeId was unhandled** (R2-M3). *Resolved in §4.5*, with tests against the real
    `handleMessage`.
24. **Plan 1 pointed at a vault mode it did not ship** (R2-M5). *Resolved:* a minimal `welcome`
    mode, `wallet.html` and the `ENTRIES` change are in plan 1 (§12).

Still standing (each with the default this spec builds):

2. **Dashboard total vs NOC.** The design's total includes NOC ($14,881.19 with 4,200 NOC). The
   parent spec §4 ("valued at stage price, as on web/") and `core/portfolio/value.ts` keep NOC out
   of the market total and label it. This spec follows the spec and `web/`.
4. **#19 wording:** the design's "valid for ~2 s" and devnet/mainnet-beta RPC names vs the engine's
   30 s prepared life and the coordinator proxy. Adapted, and listed.
7. **Truncated addresses in lists.** The owner's rule (full, groups of four) is written for
   confirmations. #26 rows keep the design's short form, at equal weight. Verification surfaces show
   the full address. The poisoning concern in `AddressGroups`' own comment applies if a user copies
   from a list row; rows have no copy action.
8. **D10 names #40 only.** This spec applies the same line to #7 (same tab-cannot-open-popup
   reason).
10. **The parent spec's "Window" row** ("a full tab for onboarding, security and passkey unlock")
    is narrower than D12 (password unlock also in a tab). No real conflict, since B1a already opens
    a tab; noted so the parent's row can be read as D12.
11. **#6 lede.** The design says the PIN "is still required for sends, signing, and any high-risk
    action". The parent spec lets re-auth accept a passkey. The copy is adapted to the parent spec.
12. **#38's website link** (new, from D37's "the one external link"). The design links
    "noctura.io". Here "noc-tura.io" is shown as text, so Solscan stays the only external link. The
    owner can allow a second link; it would need no CSP change either (§6.5).
13. **D41 vs C4** (new with this revision; **I disagree with the letter of D41 and say so**). The
    owner asked for #40's "Try a different seed" using "E5's seed-proven replacement". A different
    seed is a different wallet, and C4 (which I agree with) makes the background refuse any
    replacement whose keys differ, so a replacement cannot do it, and a seed proof of the *old*
    wallet would mean re-typing the phrase just entered. This spec builds D41 with E5's **delete
    without replacement, proven by the password just set**, followed by a normal first write. It is
    offered only in the design's `no-assets-empty` state, where the non-atomic delete-then-store
    risks nothing on chain (§2 E5). If the owner wants the seed proof instead, the page asks for
    the old phrase and nothing else changes. *Round 2 (C6):* the background now also refuses the
    delete if any account holds any of the four tokens at that moment, so "risks nothing on chain"
    is enforced by the engine, not assumed from what #40 showed.


---

## 12. Self-review

- **Placeholders.** None: every state has copy, an engine source and a destination. The
  mockups' sample values ("62.4821", "Gabc…xyz9") are examples of the format, rendered from real
  data. The one external dependency with an open answer (the proxy forwarding `accounts`) is named
  as a precondition with its fail-closed behaviour, not left open.
- **Contradictions checked.** The D10 line on #7 as well as #40 (§11.8). The vault page "renders
  nothing untrusted" vs #10 showing a recipient: closed-alphabet fields from the background only,
  and a fail-closed state (E3). The popup "unlock in a tab" (D12) vs the design's in-place #9: the
  popup has a derived locked screen.
- **Contradictions checked after the review (round 1).** Resume is stated once (§4.5) and §1.6,
  §3.10 and §7.4 point to it: every path shows #20 and needs a tap (D38, B1), with client tests and
  a mutation. The timing rule is stated once (E3): 30 s quote, 120 s challenge re-based per
  same-intent prepare (D39). §7.1 and #10's `not-unlocked` agree that a lock leaves nothing to
  resume (M7; `return=send` removed). Cancel means discard everywhere it is called (E7), and no
  toast is promised where it cannot be seen. #44 reads `failure`, never `detail` (E8). E5's order
  (lock, then one atomic pending check-and-clear, vault last) closes H1's race, and a record that
  still slips in is kept rather than deleted. D40 vs E5's delete path: recipients and settings kept
  only on a proven same-wallet replacement. **D41 vs C4 is not resolved by the letter of D41**:
  §11.13 states the disagreement and the build.
- **Contradictions checked after round 2.**
  - C5 vs D39: the re-base stays, and the cap bounds it. The copy on #20 ("Quote expired — refresh")
    matches the one-automatic-re-prepare rule.
  - E5's `busy` copy ("Nothing was deleted") is now true, because the removals follow the vault
    write.
  - C6 vs "the vault page never touches the network": the guard reads in the background.
  - #40's `no-assets-empty` vs a failed read: `unreachable` wins, and "empty" needs every read to
    succeed.
  - Restore names (R2-L3) vs C4: identical key sets, so every name carries over.
  - The factor proof vs a locked wallet (R2-L7): it has the `openWithPassword` shape and needs no
    session.
- **Contradictions checked after the owner's answers.** E5 vs "a pending send must never be hidden":
  E5 refuses while a send is open, instead of clearing it. E5 vs "the vault page renders nothing
  untrusted": it adds only fixed strings. E5's proof vs a locked wallet: the seed proof needs no
  unlock, which is the point of #39. E6 vs #19/#20: one shared `isKnownRecipient`, with a parity
  test. D36 vs #11's quick actions: Receive enabled offline there too. D37 vs #38: the website shown
  as text (§11.12).
- **Ambiguity left for the owner.** §11 items 2, 7, 12 and 13. Each has a default this spec builds.
- **Scope.** This is more than one plan's worth: 8 engine extensions plus E3's re-based life,
  gate changes, a vault-page restyle of 11 screens, ~20 popup/tab surfaces and 12 E2E specs. **Three
  plans and PRs under this one spec (owner: keep the split). All engine work is in plan 1**, so
  plans 2 and 3 are UI-only:
  1. **B1b-2a-1 — engine + scaffold + read-only popup.** First task: record ICO Claude's
     confirmation that the proxy forwards `simulateTransaction`'s `accounts` unchanged. E2 does not
     start without it; the other tasks do not depend on it. Then:
     - the engine: E1–E8, E3's `rebaseChallenge` (D39) with its 10-minute cap (C5), E5 with the C4
       binding, the one-`serial` order and step-5 re-check (H1, R2-M1), the unfunded guard (C6) and
       the first write's leftover cleanup, E2's H2 `accounts` rule and L4's single read,
       `discardPrepared` (E7), `failure` with all four writers (E8);
     - the `onInstalled` listener, the gate changes (M4, L5) **including the new `ENTRIES`**, the
       Solscan containment (M5);
     - **`wallet.html` and `src/app/tab.tsx`** (review R2-M5): in plan 1 the tab has one route,
       `#/home` (#11 in a column); any other hash shows it too;
     - **a minimal `welcome` vault mode** (review R2-M5): `?mode=welcome` shows the B1b-1 thin page's
       look with the two existing actions, "Create a wallet" → `?mode=create` and "Import a wallet"
       → `?mode=import`, fixed strings only. The popup's no-wallet path and `onInstalled` both open
       it, so nothing in plan 1 points at a mode that does not exist. Plan 2 replaces it with #1;
     - React and CSS plumbing, the message client, `WalletContext`, router, shared UI components;
     - #11, #13, the switcher, Settings, #38, #42 states, #26, #27 (with §6.5), #41;
     - E2E 6–9.
     **Plan-1 stand-ins (review M8), so plan 1 ships without dangling routes:** #11's pending strip
     shows the state text ("Sending 2.48 SOL · pending" / "· taking longer than usual") and opens
     Activity, not #21/#54; #26's PENDING rows open nothing; the popup open sequence does not call
     `preparedFor` (no resume) and #11 has no Send action; #27 and #44's `[Try again]` do not exist
     yet; `welcome` is the minimal mode above and `wallet.html` has only `#/home`. Plan 2 replaces
     `welcome` with #1 and adds `#/created` / `#/imported`; plan 3 replaces the rest with its real
     routes.
     It is useful on its own: a read-only wallet.
  2. **B1b-2a-2 — vault-page screens + #7/#40:** #1–#10 (with #10's discard and its `expired`
     mapping), #39 with the #8 restore path on E5, #40 with "Try a different seed" (D41), the
     `accounts` restyle, #7 and #40 in the UI tab; E2E 1–3, 10 and 12. #10's `confirmed` hand-off
     lands on `wallet.html#/send/resume`, which plan 2 ships as a route that shows "Open the Noctura
     icon to continue." until plan 3 replaces it with #20 (no dangling route, and no send).
  3. **B1b-2a-3 — send flow:** #12 (with E6's hints), #43, #19, #20 (the §4.5 resume, one tap per
     broadcast, the once-only automatic re-prepare and `[Refresh]` of C5, no autofocus), #21, #54,
     #44 (on `failure`); removes plan 1's and plan 2's stand-ins; E2E 4, 5
     and 11.
  The order is fixed by dependencies: plans 2 and 3 need plan 1's engine; plan 3 needs #10 from
  plan 2.
