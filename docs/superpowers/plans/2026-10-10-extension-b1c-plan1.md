# Noctura Extension B1c · Plan 1 — connection (the provider, the relay, the PAGE partition, the request lifecycle, grants, the approval window with #46 and #47, #49 with #31's row and #37's bullet) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 1 (2026-10-10):** first issue, dry-run in full (every task replayed red → green, the whole suite, the build and every gate at every task; 105 named mutations; the E2E end state in a normal launch and under `unshare -rn`). Next: the owner reads Scope §3 (every controller ruling, listed again at the end for the owner), then a Fable 5.1 review (owner rule: every plan goes to a Fable review before execution).

**Revision 2 (2026-10-11):** applies every finding of Fable 5.1 review 1 (`.superpowers/sdd/b1c-plan1-review-1.md`, verdict "approve after fixes": M1–M5, L1–L10, and the change to R33) — where each landed: "Review 1 (Fable 5.1) — how each finding was applied" at the end. Changed: Tasks 2–11 (code and tests), Scope R8, R33, R35, R36 and the new R37–R39, Review Focus 2, the Global Constraints' mutation line; the spec gets rev 3.1 (L7: two text corrections, no rule changed). Every task re-replayed and every named mutation re-run on the new end state (Dry-run record). The owner copy checks R5, R21, R24 and R31 are still pending with the owner.

**Goal:** Build B1c spec plan 1 ("B1c-1 — connection", the spec's header table): the MAIN-world Wallet Standard provider and the isolated-world relay (content scripts on `<all_urls>`, top frame, `document_start`); the background's `PAGE` partition with its origin rule for messages and ports; the request lifecycle (queue, port delivery, resume/ack, keepalive, `deciding`, the lock hook = `lock()` rewritten, the unlock hook); the limits (per host and per tab, the rejection cooldown, the window budget, `documentId`); grants (session and persistent, the cap of 200, the undo token); the approval window `approve.html` (polling, the locked screen, #47 in every state incl. the lookalike, #46 in every state); the classifier (the known list, an own RFC 3492 decoder, Unicode confusables, rules a–d); blocked hosts; #49, #31's "Connected dApps" row and #37's bullet; `signMessage`; the gates (§6.2); E2E B1c-19 … B1c-24 with a real test dApp; the visual pass of every B1c-1 state. Plan 1 advertises only `standard:connect`, `standard:disconnect`, `standard:events` and `solana:signMessage` (D10) — no transaction, no #48, no decoder, no red flag (B1c-2, B1c-3).

**Architecture:** Spec §1's four layers, each its own bundle. **[1] The provider** (`src/provider/`, `provider.js`, MAIN world) registers one wallet "Noctura" with `@wallet-standard/wallet` and holds nothing but the accounts the background last sent; it talks to the relay with `window.postMessage(…, location.origin)`. **[2] The relay** (`src/relay/`, `relay.js`, isolated world) forwards exactly the five method types, opens its `noctura-page` port lazily (never while prerendering), and reconnects + resumes; it decides nothing. **[3] The background** (`src/background/dapp/`) is the only decider: the origin rule on `port.sender` (`sender.id`, a tab, frame 0, `https:`, an active document — never `sender.url`), one FIFO queue in `storage.session` under one queue mutex (`dappSection` = its own mutex, then `sessionMutex`), the grants (`v1_dapp_grants` in `storage.local`, session grants in `storage.session`), the blocks (`v1_dapp_blocked`) and the limits (`v1_dapp_limits`), the classifier, `signMessage`'s checks, and the lock hook — `autolock.ts`'s `lock()` itself — that answers the queue in the same `sessionMutex` section that clears the session. **[4] The approval window** (`approve.html`, `src/approve/`, React on the popup's three sheets) holds no state and no listener: it polls `dapp.pending` and sends `dapp.decide`, which the background validates as if it were untrusted (C13). The popup gains #49 (`src/app/screens/ConnectedApps.tsx`) and its row on #31. No new permission; CSP unchanged (C6).

**Tech Stack:** TypeScript 5 strict, React 18, Vite 8 (Rolldown; the two content scripts are built as classic IIFE scripts by `vite.content.config.ts`), Vitest 5 + happy-dom + Testing Library, Playwright 1.63 (contained: `ctx.route` + `--host-resolver-rules`), `@wallet-standard/wallet` 1.1.1 + `@wallet-standard/base` 1.1.1 (the provider; Apache-2.0), `@wallet-standard/app` 1.1.1 (E2E only; Apache-2.0), `@noble/curves` (ed25519, already a dependency), `@solana/web3.js` 1.x (already; only to refuse a transaction's bytes as a message).

**Spec:** `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (approved rev 3, 2026-10-10: D1–D11, C1–C17, Q01–Q24, the known list of §2.5) — the header table's first row; §1 (all), §2 (all), §3.1, §3.2, §4 (all), §5, §6.1, §6.2, §6.3 (19–24), §6.4 (B1c-1's states), §7, §8, §9, §10, §11. Parent: B1 spec §3 (`docs/superpowers/specs/2026-09-27-extension-b1-design.md`), binding where B1c does not refine it. Design (binding): `/home/user/Downloads/index.html` — #46 ix:17442-17686, #47 ix:17686-18261, #49 ix:18705-19100 (its DS class map ix:18951-18978, its CSS ix:3786-3950 and 4062-4084), #31 ix:13552/13621, #37 ix:14981 — and `screen.md` §46, §47, §49. Templates: `docs/superpowers/plans/2026-10-08-extension-b1b2b-plan2.md` and `…-plan1.md` (their conventions are this plan's).

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

- **Mutations:** `git archive HEAD | tar -x -C "$(mktemp -d <scratch>/mut.XXXXXX)"`, `node_modules` linked FROM the copy (`ln -s <repo>/extension/node_modules <copy>/extension/node_modules`, the same for `web/` and the root), every run under `timeout 300`. **Linked is right for unit mutations and for the E2E ones (M11a, M11b: they need only the build). Anything that runs `npm run gates` or reads the build's module maps needs `extension/node_modules` COPIED into the scratch copy (`cp -a`)** — or run there from the real tree: Vite resolves a linked `node_modules` to its real path, and the module maps then name modules outside the package (the dry run's per-task replay copies it for that reason; review 1 L8). A mutation that does not compile (`tsc`) or does not build is INVALID, not red. Never `git worktree`, never the repository's own files or its `node_modules`, never `pkill` with a pattern that can match your own shell — kill by task id or exact PID only (this dry run's own `pkill -f replay.py` killed the shell that ran it, again).
- **Rule 6:** every confirming, rejecting, revoking, blocking and opening control is a `LockedButton` (popup and approval window). Tests lift `disabled` before a second click (happy-dom drops clicks on disabled buttons); where a second press is indistinguishable from the first, the lock itself is asserted.
- **C15 on top of rule 6 in the approval window:** no CTA focused at open; the confirming CTAs (Connect, Sign, Connect/Sign anyway, I understand the risk) held 500 ms after the window gains focus and after each state change; Reject never held; Enter never confirms.
- **Every async path checks its generation / `alive` after each await** — the window's poll (`reads` + `alive`), #49's reads and actions, #31's count — and the background re-checks its own state in every section that writes an effect (a `deciding` entry is still this instance's; the session still unlocked; the account still in it).
- **`extension/src/styles/design-ext.css` is generated only** (Task 8 regenerates it with the extraction script and re-pins the hash); `src/app/app.css` is hand-written. `src/background/dapp/confusables.ts` and `src/provider/icon.ts` are generated only (Tasks 1 and 7 give the scripts; tests pin their outputs).
- **The page is untrusted, the window is untrusted, the port's sender is the browser's.** Every request is keyed `(tabId, origin)` from `port.sender`; every `dapp.decide` is validated in full; nothing a page sends names an origin, a tab or a scope.
- **E2E is deterministic in a normal launch AND under `unshare -rn`.** The test dApp is served by `ctx.route` only, its hosts unresolvable too (`DAPP_HOSTS` in the resolver map). Playwright selects by `-g 'B1c-NN · '` (B1b-2b's spec 19 already owns `19 · `).
- **Visual pass:** every state asserts its own copy before its shot; the approval window at 412 × 720, #49 in the popup at 412 × 600; transient states held by the test (a held `dapp.decide`, the page's paused clock), never slept through.
- **Copy:** only the strings the spec quotes (§3, §4, §10's Q01–Q24) and the design's own; anything else is a controller ruling flagged to the owner (Scope §3).
- CLAUDE.md: the design is binding — every scope-down is stated (Scope §3); TypeScript strict, no `any`, no `@ts-ignore`; no placeholders; UTC in data, local only at the UI (#49's dates); Prettier style of the surrounding code (single quotes, trailing commas, no spaces inside braces, no parens around a single arrow parameter).
- **No escaped-character drift:** test strings with invisible or confusable characters are written as `\u` escapes, never as the characters themselves (the dry run's writing tool turned escapes into characters; `grep -P '[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{0430}]'` over the added files must be empty).

## Review Focus

Five inputs the spec implies and no first draft of a task exercised — each now has its test in the owning task (named there).

1. **A site on an IP literal with a port** (`https://[2001:db8::1]:8443`): the origin rule, the stores' re-validation (`[` `]` and `:` in the origin and host), the block list and the limits keys must all keep it — a too-tight pattern would silently drop its grant on the next read. Tests: Task 2 (`store.test.ts`, "an IP literal and a port"), Task 3 (`lifecycle.test.ts`, "an IP-literal origin with a port").
2. **The request answered elsewhere while the window shows it** (the page disconnects, the popup revokes, the user blocks in another window): the window still shows it until its next poll (one a second, R33); its Connect must be refused (`not-head`), the window must move on and close, and the page must get exactly one answer. Test: Task 8 (`connect.test.tsx`, "a request answered elsewhere while shown").
3. **The tab reloads or navigates while its request is queued** (Chrome's `documentId`): the old document's request is answered `rejected`; a document that stays, or a browser that reports no `documentId`, cancels nothing. Tests: Task 3 (`lifecycle.test.ts`, "a document that goes away", with its negative control).
4. **The user switches the popup's active account while a site is connected** (C1): the site keeps the granted account — silent connects and `change` events never follow the popup. Test: Task 4 (`decide.test.ts`, "approve, this session only": the silent connect returns the granted account, not the active one).
5. **A message at the 4 KiB edge in multi-byte text**: the limit is UTF-8 bytes, not characters — 2 048 two-byte characters pass, one more byte is refused before any window. Test: Task 6 (`signMessage.test.ts`, "the 4 KiB limit counts UTF-8 bytes").

---

## Scope — what plan 1 builds, the seams it uses, every departure, and where the trust boundary sits

### 1. Plan 1 builds

- **The classifier (Task 1):** `knownList.ts` (the owner-approved fifteen), `punycode.ts` (an own RFC 3492 decoder), `confusables.ts` (generated from Unicode 16.0.0), `classify.ts` (rules 1, a–d, Q18's flag, the display rules, C7's name).
- **The stores (Task 2):** `grants.ts`, `blocked.ts`, `limits.ts` and `store.ts` (the `storage.session` state and `dappSection`, the queue mutex); the three keys in `WALLET_DATA_KEYS` (wiped by a delete, kept by a restore, C11) and in the vault-isolation gate's `BACKGROUND_OWNED_KEYS`.
- **The PAGE partition and the lifecycle (Task 3):** `ports.ts` (the origin rule, the port registry, delivery, events), `queue.ts`, `window.ts`, `pageApi.ts` (`page.connect`, `page.disconnect`, `page.resume`, `page.ack`, `page.ping`), `Ext.dappWindows`, `index.ts`'s `onConnect`, queue alarm and `windows.onRemoved`.
- **The window's messages and #49's (Task 4):** `decide.ts` (`dapp.pending`, `dapp.decide` with §2.3's table, the connect effect), `grantsApi.ts` (list, revoke + undo, revoke all, blocked list, unblock).
- **The lock hook and the unlock hook (Task 5):** `lock()` rewritten (`lockHook.ts`), `unlockHook.ts`, `vault.setKeys`'s call, an account removed (`storeEnvelope`'s `onDropped`).
- **`signMessage` (Task 6):** rules 1–6, SIWS, the keywords, the homoglyph marks, the signature (`deciding` → ed25519 → `answered`).
- **The page bundles, the manifest and the gates (Task 7):** `src/provider/`, `src/relay/`, `vite.content.config.ts`, `build.mjs`, the content scripts in `manifest/source.mjs`, the permissions gate's pin, the page-bundle and dev-origin gate (`check-page-bundles.mjs`), the relay's port-listener allowance in the vault-isolation gate, the three new dependencies.
- **The approval window with #47 (Task 8)** and **#46 (Task 9)**, **#49 with #31's row and #37's bullet (Task 10)**, **E2E B1c-19 … B1c-24 (Task 11)**, **the visual pass (Task 12)**.

### 2. The seams it uses, as B1b laid them

- **The one wipe list.** `accountsStore.ts`'s `WALLET_DATA_KEYS` gains `v1_dapp_grants`, `v1_dapp_blocked`, `v1_dapp_limits` (now exported); `forgetWallet` (no replacement) and a first `storeEnvelope` remove them, a restore keeps them. E2E spec 15's `WIPED` list gains the three (Task 11).
- **`sessionMutex` is not re-entrant.** `lock()` takes it once and clears the area with `ext.session.clear()` directly; `clearSession` stays for its existing callers and tests. Lock order: the dApp mutex, then `sessionMutex`; the lock hook, which runs inside `sessionMutex`, never takes the dApp mutex (it rewrites `v1_dapp_session` itself).
- **`handleMessage`'s partitions** (`messages.ts`): `PAGE` becomes the page types (refused through `runtime.sendMessage` from anyone — they travel on the port); `APPROVE_PAGE_ONLY` and `WALLET_UI_ONLY` mirror `VAULT_PAGE_ONLY`'s `pagePath` check.
- **The popup's engine** (`engine.ts`) gains six shape-checked calls; `Switcher.test.tsx`'s full stub engine gains them too.
- **`HoldButton`** gains `heldLabel` and `decimals` (#49's "Hold to disconnect all · 0.24 s"); #37's use is unchanged.
- **The design-ext pin** (`designExt2b.test.ts`) is re-pinned in the task that regenerates the file (Task 8) — a red pin there is expected.

### 3. Departures and controller rulings (each loud; R-numbers are listed again for the owner at the end)

The spec leaves these open or the dry run found them; each is the most secure default, stated.

- **R1 — rule a compares skeletons on both sides.** `confusables.txt` maps the ASCII `m` to `rn`, so `skel` of a Cyrillic em (U+043C) reaches `magiceden` only through `skel(magiceden.io)`; comparing `skel(pair)` with the raw listed domain (the spec's literal wording) would miss every listed domain containing an `m` (Magic Eden, Phantom, Meteora, Marinade, Kamino, pump.fun). UTS #39: two strings are confusable when their skeletons are equal. Mutation M1b.
- **R2 — the design's `xn--phntom-ezv.app` is not a "phantom" with a Cyrillic a (U+0430).** It decodes to "phnt" + U+0F58 (TIBETAN LETTER MA) + "om" — the mockup's punycode is invented. The Cyrillic one is `xn--phntom-4nf.app`; the classifier table (§6.1) and the visual pass use it, and a test pins that the design's string classifies **unknown, international** (Q18). The banner shows the host's real punycode, never the mockup's. **Owner/spec: §6.1's table should read `xn--phntom-4nf.app`.**
- **R3 — rule d needs at least one swap applied.** Otherwise every `jup.*` (and `drift.*`, …) is a rule-d lookalike with no swap at all, which §2.5 explicitly rejects for `jup.*` (the 4-character floor's reason). `jup.io` stays unknown (tested; M1e).
- **R4 — the confusables table** is every entry of type MA whose target is Latin a–z / 0–9 only, sources of any script — 792 entries, including the ASCII `1`, `I`, `m` and `|` (needed by R1).
- **R5 — rule a's sentence for a script outside the named list** reads "a non-Latin letter" (the template's `<script name> letter` has no name to put there); a Latin letter with a mark reads "a Latin letter (U+00F9), not a Latin "u"". **Owner copy check.**
- **R6 — no development origin at all.** §1.3 says a `NOCTURA_DEV` build *may* accept `http://localhost`; plan 1 builds no such variant (E2E serves its dApp on `https` through `ctx.route`), and the dev-origin gate pins that `background.js` names neither `localhost` nor `127.0.0.1`.
- **R7 — page types are refused on `runtime.sendMessage` from anyone**, an extension page included; they are accepted only on the `noctura-page` port (spec §1.4 says "on the port").
- **R8 — `dapp.grants.*` and `dapp.blocked.*` come from the popup or the tab only and are refused while locked** (the list says which sites the user connects to — as `contacts.*`, B1b-2b C12); `dapp.pending`/`dapp.decide` from `approve.html` only. The approval window cannot list, revoke or unblock. **Rev 2 (review 1 L2):** the window's "Reject and report" and "Block this site" are refused while locked too (`locked`, like an approval) — every write of the user's lists needs an unlocked wallet; the locked screen offers only [Reject], which stays accepted (M4z).
- **R9 — `dapp.blocked.remove` takes `{host}`**, not `{origin}`: §2.6 keys blocks by host.
- **R10 — the unlock hook's "ran" flag lives in the background's memory**, not in `storage.session`. Storing it put a `v1_dapp_session` key into a freshly unlocked session, which B1b's E2E (`unlock.spec.ts`: "only signing keys") rightly refused — the dry run's first find. A lock clears the flag; a worker restart re-runs the hook at its first queue access, which answers only what is still queued and repeats a `change` the pages already have.
- **R11 — what counts toward C14's cooldown:** user rejections only — Reject, ✕, closing the window, Reject and report, Block this site; not a lock, an expiry, the budget or any background refusal.
- **R12 — the window budget spent:** every queued request that would need the window is answered `rejected` (no window), and the notice flag is set for the next window (Q24, once).
- **R13 — closing the window with requests still queued** opens a window again for the next head (the budget applies) — otherwise they would wait unseen until they expire.
- **R14 — 47b's gates in order:** the domain acknowledgement first (the design's "second gate for unknown domain"); a tap on the permissions row before it shakes the domain gate; un-ticking the domain un-ticks the permissions. No new copy.
- **R15 — #47's lookalike state, undrawn:** title "Connect to this app?" (47b's — never the brand's name); lede the first sentence of 47a's ("Connecting lets the dApp see your public address.", as #46's lookalike shortens its own); before the confirm, the permissions card without its ack row and no scope card; after "I understand the risk", 47b's two gates under the lookalike chrome, "Until I revoke" disabled.
- **R16 — the cap state (Q16):** the origin card, Q16 as a `.s9-flag-banner.danger`, the permissions card without its ack row, and only [Reject].
- **R17 — the locked window's "Noctura mark"** is the extension's own: the lock tile (#9's, as the popup's locked screen) and the About screen's "noctura." wordmark (the extension ships no logo asset in its pages).
- **R18 — #47's in-progress state** (the spec names "Connecting…" only): the primary "Connecting…" with #46's ring, the origin card at .55, every CTA and ✕ disabled; the overline unchanged.
- **R19 — #46 for an unknown origin** keeps "Signature request" (§3.2 names only the lookalike's overline).
- **R20 — a SIWS mismatch is refused in the background too** (`dapp.decide` → `siws-mismatch`), not only by the missing Sign button (C13).
- **R21 — singulars:** #49's "1 active session" and "Hold to disconnect all · 1 session" / "All 1 session will be wiped …" — the design draws only plurals; "1 sessions" is wrong English (B1b-2b's O92 precedent). **Owner copy check.**
- **R22 — #49's hold helper** reads "All <n> sessions will be wiped · release the button to cancel": the design's "from `v1_dapp_sessions`" names an internal key (§9 drops the footer that names it too).
- **R23 — #49's sheet "Scope" value** is the spec's "Until revoked" / "This session only" (§4.4), not the mockup's "Until I revoke".
- **R24 — #49's "Last 3 interactions" rows** read "Connect" / "Sign message" / "Sign transaction" / "Sign and send transaction" + "(approved)" / "(rejected)", the time with the design's short form ("2 d ago"); the group is omitted when a grant has none (never, since a connect records itself). **Owner copy check** ("Connect", the two outcome words).
- **R25 — #49's tiles (C6):** the name's first two words' initials, or a one-word name's first two letters; the gradient one of the design's five, chosen from the host.
- **R26 — dropped from #49:** the skeleton's caption and every mention of `v1_dapp_sessions` (internal keys); [Browse dApps] (D1); pull-to-refresh (§9).
- **R27 — the "This session" pill** (Q10) in the row meta's neutral badge tint; [Unblock] in `--accent` (an undo, not a destructive act).
- **R28 — `.s-secintro` is not used** on the window's screens: it styles only the vault page's layer cards, and the class check (`unstyledClasses`) refuses a class that styles nothing.
- **R29 — E2E titles "B1c-19 · …"**: B1b-2b's spec 19 already owns "19 · " in `contacts.spec.ts`.
- **R30 — B1c-24 stops the worker by closing its CDP target.** `ServiceWorker.stopAllWorkers` from a page session left the extension's worker running (the dry run's find, proved by `runtime.getContexts`); `Target.closeTarget` stops it — the spec's alternative ("or closing the service-worker Target"). Positive control: no background context while stopped, a different one after.
- **R31 — #37's bullet:** "Local settings, cached balances, your address book, the list of addresses you have sent to, and dApp connections and blocked sites are erased and not recoverable." (Q08 placed where the design reserves "dApp connections"). **Owner copy check.**
- **R32 — `npm audit`** is not clean on `main` (4 moderate: `@solana/web3.js` → `jayson` → `stream-json`, `uuid`); the three `@wallet-standard` packages add none. Recorded, not fixed here (a web3.js 3 migration is breaking).
- **R33 — the window polls every second while it shows anything** (rev 2, review 1 L1: §2.3's "an unlock, an expiry or a new head reaches it within 1 s" taken literally, over its narrower list of states): an expiry of the shown request, a request arriving behind it and an unlock all reach the window within a second. One `dapp.pending` a second is cheap, and the window exists only while something is pending (M8j).
- **R34 — the account picker (Q01, undrawn)** is a native `<select>` in a card styled as the scope card, above "Stay connected"; options "<name> · <first 4>…<last 4>" (B1b's `shortAddress`, not the mockup's 5 + 4).
- **R35 — the origin card and #49 show the host, with the port when the origin has an explicit one** (rev 2, review 1 L5): `https://dapp.test` and `https://dapp.test:8443` are two grants (C8) and must not look alike; §2.5 Display's `h` with `:port` appended — real sites, with no explicit port, look exactly as before (M8m, M10g). Blocks stay by host (§2.6).
- **R36 — `Grant.recent` and `lastUsedAt`:** a silent or immediate connect moves `lastUsedAt` but records no interaction (only decisions in the window are interactions); a rejected sign request of a granted origin is recorded. **Rev 2 (review 1 L3):** `lastUsedAt` moves at most once a minute per grant (`LAST_USED_STEP_MS`), so a page's loop of silent connects is not a `storage.local` write each (M3u).
- **R37 — the wallet icon is the owner's PNG mark, not an SVG** (spec §1.1 says `data:image/svg+xml`; review 1 M5). The reason is the artwork: the owner's mark exists only as the 96 px raster `web/public/noc-mark.png` — the owner replaced the drawn "N" with it on 2026-09-26 (`web/src/ui/BrandMark.tsx`). An SVG would either redraw the logo (not the owner's artwork) or wrap the same PNG in an SVG `<image>` (the spec's letter and none of its point: still a raster, larger, and an SVG document every dApp then renders). Wallet Standard's `WalletIcon` type allows `data:image/png;base64,…`. **For the owner:** if a vector mark exists or is wanted, switching is two lines of Task 7's `gen-icon.mjs` (the source file and the media type) and the icon test's expected bytes.
- **R38 — a `deciding` entry has a deadline** (review 1 M1; the spec's C4 says "queued or shown" and §1.5 names no deadline for an effect): five minutes from `arrivedAt` apply to a `deciding` entry too (`timeout`), and one of this instance still `deciding` 30 s after `decidingAt` is a dead effect — answered `rejected`, like C17's restart (nothing left the extension; the effect's own sections refuse to answer an entry no longer `deciding`). Without it a thrown effect wedged the queue: the head stayed "Signing…", its host's next request was `request-pending`, and the window's poll kept the worker alive (M3s, M3t).
- **R39 — Firefox's `port.sender.origin`** (review 1 L9): the whole PAGE partition keys on it; the E2E run only Chromium. A line of B1e's manual Firefox run: "`port.sender.origin` is present on a content-script port and equals the page's origin" — if it is missing, the partition fails closed (no dApp support on Firefox, no exposure).

Spec items built as written and declared in its §9 are not repeated here (D1, D3, D8, D9, the dropped design text, the 720 px window, the dropped scroll-to-acknowledge).

### 4. The trust boundary

| layer | what it may do | what it never does |
|---|---|---|
| the page (any script on it) | call the four features; forge window messages to the provider (§1.1, stated) | reach the background except through the relay's five method types; name an origin, a tab or a scope |
| the relay | forward the five method types with the page's id; originate resume / ack / ping | decide, add fields the page could overwrite (its `type` and `id` win), listen to anything but its own port |
| the background | everything that decides — keyed from `port.sender` | read `sender.url`; accept a frame ≠ 0, a non-`https` or opaque origin, a prerendered document; write a grant after a lock; sign twice |
| the approval window | show what `dapp.pending` says; send `dapp.decide` | hold state or a listener; touch storage; show a password field (D11); confirm on Enter or inside 500 ms (C15) |
| the popup (#49) | list, revoke (with an undo token), revoke all, unblock — unlocked only | write a grant (it holds only the token) |

## How to read the steps

- A **new file** is given in full. A **changed file** is a unified diff against the file as the previous task left it; save the block and apply it with `git apply --recount` from the repository root (or by hand — every hunk is exact). Several files grow task by task (`messages.ts`, `queue.ts`, `decide.ts`, `pageApi.ts`, `app.css`, the test files), so their diffs apply in task order.
- Three files are **generated**, never typed: `src/background/dapp/confusables.ts` (Task 1, given in full as well), `src/provider/icon.ts` (Task 7; its test checks it decodes to `web/public/noc-mark.png`) and `src/styles/design-ext.css` (Task 8, the diff given for review). `package-lock.json` is written by npm 11.6.2 (Task 7's command), never by hand.
- Commands run from `extension/` unless they start with `cd`. "Whole suite" is `npx tsc --noEmit && npx vitest run`. The expected totals are the dry run's task-by-task replay: each task's own test files run on its predecessor's tree (red) and then on its own tree (green), with tsc, the whole suite, `node scripts/build.mjs` and `npm run gates` at every task. A reviewer-added test raises the totals; that is not a defect.
- Background tests drive the real handlers over `fakeExt` (its `approval` records every `windows.create`/`remove`) and fake ports (`pageHarness.ts`); window tests render `approve.html`'s `Approve` against the real background (`windowHarness.tsx`); popup tests use B1b's `renderInWallet`. Each screen test asserts `unstyledClasses(…)` is empty.
- No task touches the repository root's `src/` or `core/`, nor `web/`. The dry run ran the root `tsc` + `jest` and web's `npm run verify` anyway (Dry-run record).

## Tasks

### Task 1: The classifier: the known list, an own RFC 3492 decoder, the Unicode confusables, rules 1 and a–d, Q18's flag, C7's name

**Spec:** §2.5 (all, incl. Display), D2, C6, C7; §6.1 "Classifier"; §9 (the lookalike card never names the brand); Scope R1–R5

**Files:**
- Test: `extension/src/background/dapp/__tests__/classify.test.ts` (new)
- Test: `extension/src/background/dapp/__tests__/confusables.test.ts` (new)
- Test: `extension/src/background/dapp/__tests__/punycode.test.ts` (new)
- Create: `extension/src/background/dapp/classify.ts`
- Create: `extension/src/background/dapp/confusables.ts` (generated — Step 3)
- Create: `extension/src/background/dapp/knownList.ts`
- Create: `extension/src/background/dapp/punycode.ts`

**Interfaces:**
- Consumes: nothing (pure modules).
- Produces (as exported):
  - `knownList.ts`: `interface KnownDomain {name: string; domain: string}`, `KNOWN_DOMAINS: readonly KnownDomain[]` (the fifteen, in the spec's order).
  - `punycode.ts`: `decodePunycode(input: string): string | null`, `decodeLabel(label: string): string | null` (a non-`xn--` label is returned as it is).
  - `confusables.ts` (generated): `CONFUSABLES: ReadonlyMap<number, string>` (code point → Latin a–z / 0–9 prototype).
  - `classify.ts`: `type LookalikeRule = 'idn' | 'edit' | 'embedded' | 'swap'`; `interface IdnDetail {char: string; codePoint: string; script: string | null; latin: string; latinCodePoint: string}`; `type Classification = {kind: 'verified'; name: string; domain: string} | {kind: 'lookalike'; rule: LookalikeRule; imitates: string; idn: IdnDetail | null} | {kind: 'unknown'; international: boolean}`; `classify(host: string): Classification`; `skel(x: string): string`; `editDistance(a: string, b: string): number`; `decodedForDisplay(host: string): string`; `secondLevelLabel(host: string): string`; `siteName(host: string, c?: Classification): string`; `codePointOf(ch: string): string`.

A pure function of the host the browser reports, with a table test (§6.1). Rule 1 (verified: a listed domain or any subdomain of it) runs before every lookalike rule, so `xn--….jup.ag` is verified. Rule a decodes every `xn--` label with our own RFC 3492 decoder (no dependency, D6; an invalid label is kept as-is, never a throw), NFD-normalises, strips the combining marks (and every format character — a ZWJ cannot split a lookalike), maps through `confusables.ts` and lower-cases — on **both** sides of the comparison (R1). Rules b–d work on the second-level label (b: Damerau–Levenshtein ≤ 1 to a listed label of 4+ characters — distance 0 under another TLD counts; c: the whole host contains a listed domain or its dotted form with hyphens; d: the four swaps, at least one applied, R3). Q18's line is `international: true` on an unknown host. `siteName` is C7's: the list's name for a verified host, the second-level label otherwise — never the imitated brand (§9). The decoded Unicode is used only by rule a's banner, every format character removed (Display).

`confusables.ts` is generated, never typed: save this one-off script **outside the repository** and run it from the repository root against Unicode's `confusables.txt` 16.0.0 (`https://www.unicode.org/Public/security/16.0.0/confusables.txt`, sha256 `95bd0aad6dced5ebc63436f459c06ab21a8d107cd842fb57f5c3a1e91bca8611` — the script refuses any other file). The output is 792 entries, sha256 `64a02d1dad7cae885ee239a81f81ad87cc2703b8751f0da6e5be05ae3377fba1` (pinned by `confusables.test.ts`). The file follows in full as well, for review.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/dapp/__tests__/classify.test.ts`:

````ts
import {classify, decodedForDisplay, editDistance, siteName, skel} from '../classify';
import {KNOWN_DOMAINS} from '../knownList';

const kind = (h: string) => classify(h).kind;
const imitates = (h: string) => {
  const c = classify(h);
  return c.kind === 'lookalike' ? [c.rule, c.imitates] : [c.kind];
};

// Spec §2.5 and §6.1 "Classifier": a table, each rule with its positive and its negative controls.
describe('the origin classifier', () => {
  it('the known list is the owner-approved fifteen (D2)', () => {
    expect(KNOWN_DOMAINS.map(k => k.domain)).toEqual([
      'noc-tura.io', 'jup.ag', 'raydium.io', 'orca.so', 'meteora.ag', 'magiceden.io', 'tensor.trade', 'drift.trade',
      'marinade.finance', 'kamino.finance', 'jito.network', 'phantom.app', 'solflare.com', 'solscan.io', 'pump.fun',
    ]);
  });

  it('verified: a listed domain and any subdomain of it — the list name, never a page-supplied one (C7)', () => {
    expect(classify('app.noc-tura.io')).toEqual({kind: 'verified', name: 'Noctura', domain: 'noc-tura.io'});
    expect(classify('www.jup.ag')).toEqual({kind: 'verified', name: 'Jupiter', domain: 'jup.ag'});
    expect(classify('magiceden.io')).toEqual({kind: 'verified', name: 'Magic Eden', domain: 'magiceden.io'});
    expect(siteName('www.jup.ag')).toBe('Jupiter');
    // Rule 1 wins: an IDN subdomain of a listed domain is verified (review 2 L13).
    expect(kind('xn--ww-t2s.jup.ag')).toBe('verified');
    // Not a suffix trick: the dot is required.
    expect(kind('notjup.ag')).not.toBe('verified');
  });

  it('lookalike rule a (IDN): the Cyrillic ph\u0430ntom alone and as a label pair inside another host; a combining-mark j\u00F9p', () => {
    expect(imitates('xn--phntom-4nf.app')).toEqual(['idn', 'phantom.app']);
    expect(imitates('xn--phntom-4nf.app.evil.com')).toEqual(['idn', 'phantom.app']);
    expect(imitates('xn--jp-oka.ag')).toEqual(['idn', 'jup.ag']);
    expect(imitates('xn--rydium-3nf.io')).toEqual(['idn', 'raydium.io']);
    const c = classify('xn--phntom-4nf.app');
    expect(c.kind === 'lookalike' ? c.idn : null).toEqual({char: '\u0430', codePoint: 'U+0430', script: 'Cyrillic', latin: 'a', latinCodePoint: 'U+0061'});
    const mark = classify('xn--jp-oka.ag');
    expect(mark.kind === 'lookalike' ? mark.idn : null).toEqual({char: '\u00F9', codePoint: 'U+00F9', script: 'Latin', latin: 'u', latinCodePoint: 'U+0075'});
  });

  it('the design’s xn--phntom-ezv.app is NOT a Cyrillic ph\u0430ntom: it decodes to "phnt\u0F58om" (U+0F58, Tibetan) — unknown, international', () => {
    expect(decodedForDisplay('xn--phntom-ezv.app')).toBe('phnt\u0F58om.app');
    expect(classify('xn--phntom-ezv.app')).toEqual({kind: 'unknown', international: true});
  });

  it('lookalike rule b (edit distance ≤ 1 to a listed label of 4+ characters; distance 0 under another TLD counts)', () => {
    expect(imitates('tensr.trade')).toEqual(['edit', 'tensor.trade']);
    expect(imitates('orcaa.so')).toEqual(['edit', 'orca.so']);
    expect(imitates('orca.io')).toEqual(['edit', 'orca.so']);
    expect(imitates('magiceden.us')).toEqual(['edit', 'magiceden.io']);
    expect(imitates('jito.wtf')).toEqual(['edit', 'jito.network']);
    expect(imitates('n0c-tura.io')).toEqual(['edit', 'noc-tura.io']);
    expect(imitates('drfit.trade')).toEqual(['edit', 'drift.trade']); // an adjacent swap is one edit
  });

  it('lookalike rule c (embedded, on the whole host string)', () => {
    expect(imitates('jup.ag.evil.com')).toEqual(['embedded', 'jup.ag']);
    expect(imitates('jup-ag.io')).toEqual(['embedded', 'jup.ag']);
    expect(imitates('app-noc-tura-io.com')).toEqual(['embedded', 'noc-tura.io']);
    // Stated, accepted false positive (§2.5): a click on "Connect anyway".
    expect(imitates('jup.agency.com')).toEqual(['embedded', 'jup.ag']);
  });

  it('lookalike rule d (swaps 0→o, 1→l, rn→m, vv→w on the second-level label)', () => {
    expect(imitates('rnagiceden.io')).toEqual(['swap', 'magiceden.io']);
    expect(imitates('so1f1are.com')).toEqual(['swap', 'solflare.com']);
    // No swap applied, no rule d: every jup.* stays unknown (the 4-character floor's reason, review 2 M4).
    expect(kind('jup.io')).toBe('unknown');
  });

  it('unknown: everything else — including jupp.ag (the 4-character floor) and a two-label public suffix', () => {
    for (const h of ['example.com', 'solana-mint-hub.xyz', 'jupiter.com', 'orchard.so', 'notcoin.io', 'jupp.ag', 'orca.co.uk', 'dapp.test']) {
      expect([h, classify(h)]).toEqual([h, {kind: 'unknown', international: false}]);
    }
    expect(siteName('solana-mint-hub.xyz')).toBe('solana-mint-hub');
  });

  it('an unknown host with an xn-- label is international (Q18); an invalid punycode label is unknown, no throw', () => {
    expect(classify('xn--bcher-kva.example')).toEqual({kind: 'unknown', international: true});
    expect(() => classify('xn--a!b.example')).not.toThrow();
    expect(classify('xn--a!b.example')).toEqual({kind: 'unknown', international: true});
  });

  it('a lookalike is named by its own second-level label, never the brand it imitates (C7, §9)', () => {
    expect(siteName('tensr.trade')).toBe('tensr');
    expect(siteName('xn--phntom-4nf.app')).toBe('xn--phntom-4nf');
  });

  it('display strips every bidi and format control from the decoded form (§2.5 Display)', () => {
    // A format character never survives into what is shown, nor into a skeleton (a ZWJ or an RLO cannot split a lookalike).
    expect(decodedForDisplay('xn--phntom-4nf.app')).toBe('ph\u0430ntom.app');
    // xn--phntom-4nf8718cpia encodes "ph" RLO "\u0430" ZWJ "ntom": shown without the two, still the phantom lookalike.
    expect(decodedForDisplay('xn--phntom-4nf8718cpia.app')).toBe('ph\u0430ntom.app');
    expect(imitates('xn--phntom-4nf8718cpia.app')).toEqual(['idn', 'phantom.app']);
    expect(skel('ph\u202E\u0430\u200Dntom.app')).toBe(skel('phantom.app'));
    expect(/[\u202A-\u202E\u2066-\u2069\u200B-\u200F]/u.test(decodedForDisplay('xn--phntom-4nf.app'))).toBe(false);
  });

  it('skel and the edit distance', () => {
    expect(skel('ph\u0430ntom.app')).toBe(skel('phantom.app'));
    expect(skel('xn--phntom-4nf.app')).toBe('phantorn.app');
    expect(editDistance('tensr', 'tensor')).toBe(1);
    expect(editDistance('drfit', 'drift')).toBe(1);
    expect(editDistance('rnagiceden', 'magiceden')).toBe(2);
    expect(editDistance('', 'abc')).toBe(3);
  });
});
````

Create `extension/src/background/dapp/__tests__/confusables.test.ts`:

````ts
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CONFUSABLES} from '../confusables';

// Spec §2.5: the table is generated from Unicode's confusables.txt 16.0.0 — never edited by hand (the plan's script).
describe('confusables.ts', () => {
  it('maps the homoglyphs the lookalike rules meet to their Latin prototypes', () => {
    expect(CONFUSABLES.get(0x430)).toBe('a'); // Cyrillic \u0430
    expect(CONFUSABLES.get(0x3bf)).toBe('o'); // Greek \u03BF
    expect(CONFUSABLES.get(0x43e)).toBe('o'); // Cyrillic \u043E
    expect(CONFUSABLES.get(0x6d)).toBe('rn'); // confusables.txt's own prototype for m
    expect(CONFUSABLES.get(0x31)).toBe('l');
    expect(CONFUSABLES.size).toBe(792);
    // Every target is Latin a–z / 0–9 only.
    for (const t of CONFUSABLES.values()) expect(t).toMatch(/^[a-z0-9]+$/);
  });

  it('is the generator output, byte for byte (the hash the plan pins)', () => {
    const text = readFileSync(join(__dirname, '..', 'confusables.ts'), 'utf8');
    expect(createHash('sha256').update(text).digest('hex')).toBe('64a02d1dad7cae885ee239a81f81ad87cc2703b8751f0da6e5be05ae3377fba1');
  });
});
````

Create `extension/src/background/dapp/__tests__/punycode.test.ts`:

````ts
import {decodeLabel, decodePunycode} from '../punycode';

const cps = (s: string | null) => (s === null ? null : [...s].map(c => (c.codePointAt(0) ?? 0).toString(16)).join(' '));

// Spec §2.5: our own RFC 3492 decoder — against the RFC's sample strings (§7.1) and the labels the classifier meets.
describe('RFC 3492 Punycode decoder', () => {
  it('decodes the RFC 3492 §7.1 samples (A), (B), (L), (M), (O) and (S)', () => {
    expect(cps(decodePunycode('egbpdaj6bu4bxfgehfvwxn'))).toBe('644 64a 647 645 627 628 62a 643 644 645 648 634 639 631 628 64a 61f');
    expect(cps(decodePunycode('ihqwcrb4cv8a8dqg056pqjye'))).toBe('4ed6 4eec 4e3a 4ec0 4e48 4e0d 8bf4 4e2d 6587');
    expect(decodePunycode('3B-ww4c5e180e575a65lsy2b')).toBe('3\u5E74B\u7D44\u91D1\u516B\u5148\u751F');
    expect(decodePunycode('-with-SUPER-MONKEYS-pc58ag80a8qai00g7n9n')).toBe('\u5B89\u5BA4\u5948\u7F8E\u6075-with-SUPER-MONKEYS');
    expect(decodePunycode('2-u9tlzr9756bt3uc0v')).toBe('\u3072\u3068\u3064\u5C4B\u6839\u306E\u4E0B2');
    expect(decodePunycode('-> $1.00 <--')).toBe('-> $1.00 <-');
  });

  it('decodes host labels: b\u00FCcher, the Cyrillic ph\u0430ntom, a marked j\u00F9p; plain labels pass through', () => {
    expect(decodeLabel('xn--bcher-kva')).toBe('b\u00FCcher');
    expect(decodeLabel('xn--phntom-4nf')).toBe('ph\u0430ntom');
    expect(decodeLabel('xn--jp-oka')).toBe('j\u00F9p');
    expect(decodeLabel('jup')).toBe('jup');
  });

  it('an invalid label is null, never a throw: a bad digit, a truncated delta, a code point past U+10FFFF, a surrogate', () => {
    for (const bad of ['xn--a\u00E9', 'xn--a!b', 'xn--99999999999', 'xn--zzzzzzz', 'xn--ab-']) expect(() => decodeLabel(bad)).not.toThrow();
    expect(decodeLabel('xn--a!b')).toBeNull();
    expect(decodeLabel('xn--a\u00E9')).toBeNull();
    expect(decodePunycode('99999999999')).toBeNull();
    expect(decodePunycode('z')).toBeNull();
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/dapp/__tests__/classify.test.ts src/background/dapp/__tests__/confusables.test.ts src/background/dapp/__tests__/punycode.test.ts
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  3 failed (3) · Tests  no tests. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Generate `extension/src/background/dapp/confusables.ts` (save outside the repository, run from the repository root):

````js
// One-off (B1c-1 Task 1): writes extension/src/background/dapp/confusables.ts from Unicode's confusables.txt 16.0.0.
// Run from the repository root: node gen-confusables.mjs /path/to/confusables.txt
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const SOURCE_SHA256 = '95bd0aad6dced5ebc63436f459c06ab21a8d107cd842fb57f5c3a1e91bca8611';
const raw = readFileSync(process.argv[2]);
if (createHash('sha256').update(raw).digest('hex') !== SOURCE_SHA256) throw new Error('not confusables.txt 16.0.0');
const pairs = [];
for (const line of raw.toString('utf8').split('\n')) {
  const m = /^([0-9A-F]+) ;\t([0-9A-F ]+) ;\tMA\t/.exec(line);
  if (m === null) continue;
  const target = m[2].trim().split(' ').map(h => parseInt(h, 16));
  if (!target.every(c => (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39))) continue;
  pairs.push([parseInt(m[1], 16), String.fromCodePoint(...target)]);
}
pairs.sort((a, b) => a[0] - b[0]);
const body = pairs.map(([s, t]) => `${s.toString(16)}=${t}`);
const lines = [];
for (let i = 0; i < body.length; i += 12) lines.push(`  '${body.slice(i, i + 12).join(' ')}',`);
const out = `/**
 * GENERATED — never edit by hand (B1c-1 Task 1's one-off script, run against Unicode's confusables.txt 16.0.0,
 * sha256 ${SOURCE_SHA256}). Every entry of type MA whose target is Latin a–z / 0–9 only
 * (spec §2.5): ${pairs.length} entries, source code point (hex) = target. src/background/dapp/__tests__/confusables.test.ts pins
 * this file's hash.
 */
const TABLE = [
${lines.join('\n')}
].join(' ');

/** Code point → its Latin prototype (one or more of a–z, 0–9). */
export const CONFUSABLES: ReadonlyMap<number, string> = new Map(
  TABLE.split(' ').map(pair => {
    const [cp, target] = pair.split('=');
    return [parseInt(cp ?? '', 16), target ?? ''] as const;
  }),
);
`;
writeFileSync('extension/src/background/dapp/confusables.ts', out);
console.log(pairs.length);
````

```bash
curl -sSfo /tmp/confusables-16.txt https://www.unicode.org/Public/security/16.0.0/confusables.txt
node /path/outside/the/repo/gen-confusables.mjs /tmp/confusables-16.txt   # prints 792
sha256sum extension/src/background/dapp/confusables.ts                       # 64a02d1d…7fba1
```

Create `extension/src/background/dapp/classify.ts`:

````ts
import {CONFUSABLES} from './confusables';
import {KNOWN_DOMAINS} from './knownList';
import {decodeLabel} from './punycode';

/**
 * The classifier (spec §2.5): a pure function of the host the browser reports (lower-case ASCII / punycode). Rules in
 * order, so rule 1 wins: verified, then lookalike by rule a (IDN), b (edit distance), c (embedded), d (swaps) — the
 * first hit names the listed domain it imitates — else unknown. Nothing here fetches anything (C6).
 */
export type LookalikeRule = 'idn' | 'edit' | 'embedded' | 'swap';

/** Rule a's banner facts: the first character that is not what it looks like, and the Latin one it imitates. */
export interface IdnDetail {
  char: string;
  /** "U+0430". */
  codePoint: string;
  /** The Unicode script's English name ("Cyrillic"), or null for a script not in SCRIPTS. */
  script: string | null;
  latin: string;
  latinCodePoint: string;
}

export type Classification =
  | {kind: 'verified'; name: string; domain: string}
  | {kind: 'lookalike'; rule: LookalikeRule; imitates: string; idn: IdnDetail | null}
  /** `international`: some label is `xn--` (47b's extra line, Q18). */
  | {kind: 'unknown'; international: boolean};

/** Every format character (Cf, which holds the bidi embeddings, overrides and isolates and the zero-width ones). */
const FORMAT = /[\p{Cf}\u202A-\u202E\u2066-\u2069]/gu;
const MARKS = /\p{M}/gu;

/**
 * skel(x) (spec §2.5): decode every `xn--` label (an invalid one is kept as-is), NFD-normalise, strip combining marks
 * (and, defensively, every format character), map each character through confusables.ts, lower-case. Applied to BOTH
 * sides of a comparison (UTS #39: two strings are confusable when their skeletons are equal) — confusables.txt maps
 * the ASCII `m` to `rn`, so a Cyrillic `\u043C` reaches `magiceden` only through skel(magiceden) (controller ruling, plan
 * Scope §3).
 */
export function skel(x: string): string {
  const decoded = x
    .split('.')
    .map(label => decodeLabel(label) ?? label)
    .join('.');
  const bare = decoded.normalize('NFD').replace(MARKS, '').replace(FORMAT, '');
  let out = '';
  for (const ch of bare) out += CONFUSABLES.get(ch.codePointAt(0) ?? 0) ?? ch;
  return out.toLowerCase();
}

/** Optimal-string-alignment (restricted Damerau–Levenshtein) distance: insertions, deletions, substitutions, adjacent swaps. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({length: a.length + 1}, (_, i) => Array.from({length: b.length + 1}, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const at = (i: number, j: number): number => d[i]?.[j] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i <= a.length; i++) {
    const row = d[i] as number[];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, at(i - 2, j - 2) + 1);
      row[j] = v;
    }
  }
  return at(a.length, b.length);
}

/** The scripts rule a's banner can name; anything else is "a non-Latin letter" on screen. */
const SCRIPTS = ['Latin', 'Cyrillic', 'Greek', 'Armenian', 'Cherokee', 'Georgian', 'Hebrew', 'Arabic', 'Coptic', 'Lisu', 'Vai', 'Thai', 'Devanagari', 'Han', 'Hiragana', 'Katakana', 'Hangul'];
function scriptOf(ch: string): string | null {
  return SCRIPTS.find(s => new RegExp(`^\\p{Script=${s}}$`, 'u').test(ch)) ?? null;
}

export const codePointOf = (ch: string): string => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;

/** The host's labels decoded, every format character removed (spec §2.5 Display): what rule a's banner may quote. */
export function decodedForDisplay(host: string): string {
  return host
    .split('.')
    .map(label => decodeLabel(label) ?? label)
    .join('.')
    .replace(FORMAT, '');
}

/** Rule a's first character outside ASCII whose skeleton is Latin and differs from it. */
function idnDetail(host: string): IdnDetail | null {
  for (const ch of decodedForDisplay(host)) {
    if ((ch.codePointAt(0) ?? 0) < 0x80) continue;
    const latin = skel(ch);
    if (!/^[a-z0-9]+$/.test(latin)) continue;
    return {char: ch, codePoint: codePointOf(ch), script: scriptOf(ch), latin, latinCodePoint: codePointOf(latin)};
  }
  return null;
}

const KNOWN = KNOWN_DOMAINS.map(k => ({...k, skeleton: skel(k.domain), label: k.domain.split('.')[0] ?? ''}));

/** The label left of the host's TLD (C7's name for an unknown or lookalike origin), or the host when it has one label. */
export function secondLevelLabel(host: string): string {
  const labels = host.split('.');
  return labels.length >= 2 ? (labels[labels.length - 2] ?? host) : host;
}

/** Rule d's swaps: 0→o, 1→l, rn→m, vv→w. */
const swapped = (label: string): string => label.replace(/0/g, 'o').replace(/1/g, 'l').replace(/rn/g, 'm').replace(/vv/g, 'w');

export function classify(host: string): Classification {
  const h = host.toLowerCase();
  // 1. Verified: the domain or any subdomain of it — before every lookalike rule (an IDN subdomain of a listed domain is verified).
  for (const k of KNOWN_DOMAINS) if (h === k.domain || h.endsWith(`.${k.domain}`)) return {kind: 'verified', name: k.name, domain: k.domain};
  const labels = h.split('.');
  const international = labels.some(l => l.startsWith('xn--'));
  // 2a. IDN: an xn-- label, and the skeleton of two consecutive labels is a listed domain's skeleton.
  if (international) {
    for (let i = 0; i + 1 < labels.length; i++) {
      const pair = skel(`${labels[i]}.${labels[i + 1]}`);
      const hit = KNOWN.find(k => k.skeleton === pair);
      if (hit !== undefined) return {kind: 'lookalike', rule: 'idn', imitates: hit.domain, idn: idnDetail(h)};
    }
  }
  const sld = labels.length >= 2 ? (labels[labels.length - 2] ?? '') : '';
  // 2b. Edit distance ≤ 1 from a listed second-level label of 4+ characters (distance 0 with another TLD counts).
  if (sld !== '') {
    const hit = KNOWN.find(k => k.label.length >= 4 && editDistance(sld, k.label) <= 1);
    if (hit !== undefined) return {kind: 'lookalike', rule: 'edit', imitates: hit.domain, idn: null};
  }
  // 2c. Embedded: the whole host contains a listed domain, or the domain with its dots turned to hyphens.
  const embedded = KNOWN.find(k => h.includes(k.domain) || h.includes(k.domain.replace(/\./g, '-')));
  if (embedded !== undefined) return {kind: 'lookalike', rule: 'embedded', imitates: embedded.domain, idn: null};
  // 2d. Swaps that change the second-level label into a listed one (at least one swap applied: `jup.io` stays unknown).
  if (sld !== '' && swapped(sld) !== sld) {
    const hit = KNOWN.find(k => k.label === swapped(sld));
    if (hit !== undefined) return {kind: 'lookalike', rule: 'swap', imitates: hit.domain, idn: null};
  }
  return {kind: 'unknown', international};
}

/** C7: the name an origin is shown under — the known list's for a verified host, else its second-level label. Never page-supplied. */
export function siteName(host: string, c: Classification = classify(host)): string {
  return c.kind === 'verified' ? c.name : secondLevelLabel(host.toLowerCase());
}
````

Create `extension/src/background/dapp/confusables.ts`:

````ts
/**
 * GENERATED — never edit by hand (B1c-1 Task 1's one-off script, run against Unicode's confusables.txt 16.0.0,
 * sha256 95bd0aad6dced5ebc63436f459c06ab21a8d107cd842fb57f5c3a1e91bca8611). Every entry of type MA whose target is Latin a–z / 0–9 only
 * (spec §2.5): 792 entries, source code point (hex) = target. src/background/dapp/__tests__/confusables.test.ts pins
 * this file's hash.
 */
const TABLE = [
  '31=l 49=l 6d=rn 7c=l d7=x e6=ae 131=i 133=ij 153=oe 17f=f 184=b 18d=g',
  '196=l 1a7=2 1b7=3 1bc=5 1bd=s 1c0=l 1c1=ll 1c9=lj 1cc=nj 1f3=dz 21c=3 222=8',
  '223=8 251=a 261=g 263=y 269=i 26a=i 26f=w 28b=u 28f=y 2a3=dz 2a6=ts 2aa=ls',
  '2ab=lz 2db=i 37a=i 399=l 3b1=a 3b3=y 3b9=i 3bd=v 3bf=o 3c1=p 3c3=o 3c5=u',
  '3e8=2 3f1=p 3f2=c 3f3=j 406=l 417=3 42b=bl 42c=b 430=a 431=6 433=r 435=e',
  '43e=o 440=p 441=c 443=y 445=x 455=s 456=i 458=j 461=w 475=v 4af=y 4bb=h',
  '4bd=e 4c0=l 4cf=i 4d5=ae 4e0=3 501=d 51b=q 51d=w 561=w 563=q 566=q 570=h',
  '578=n 57c=n 57d=u 581=g 584=f 585=o 5c0=l 5d5=l 5d8=v 5df=l 5e1=o 5f0=ll',
  '627=l 647=o 661=l 665=o 6be=o 6c1=o 6d5=o 6f1=l 6f5=o 7ca=l 966=o 9ea=8',
  '9ed=9 a66=o a67=9 a6a=8 ae6=o b03=8 b68=9 be6=o c02=o c66=o c82=o ce6=o',
  'd02=o d20=o d66=o d6d=9 d82=o e50=o ed0=o 101d=o 1040=o 10e7=y 10ff=o 13a5=i',
  '13c2=h 13ce=4 13cf=b 13e7=d 13ee=6 146f=d 1472=b 14bf=2 1541=x 157d=x 15af=b 166e=x',
  '16c1=l 1d04=c 1d0f=o 1d11=o 1d1c=u 1d20=v 1d21=w 1d22=z 1d26=r 1d6b=ue 1d83=g 1d8c=y',
  '1e9d=f 1eff=y 1fbe=i 2016=ll 20b6=lt 210a=g 210e=h 2110=l 2111=l 2113=l 212e=e 212f=e',
  '2134=o 2139=i 213d=y 2146=d 2147=e 2148=i 2149=j 2160=l 2161=ll 2162=lll 2170=i 2171=ii',
  '2172=iii 2173=iv 2174=v 2175=vi 2176=vii 2177=viii 2178=ix 2179=x 217a=xi 217b=xii 217c=l 217d=c',
  '217e=d 217f=rn 221e=oo 2223=l 2225=ll 2228=v 22c1=v 2373=i 2374=p 237a=a 23fd=l 292b=x',
  '292c=x 2a2f=x 2c85=r 2c92=l 2c9f=o 2ca3=p 2ca5=c 2cca=9 2ccc=3 2cd2=6 2d4f=l a4d2=d',
  'a4f2=l a644=2 a647=i a699=oo a6ef=2 a731=s a733=aa a735=ao a737=au a739=av a73b=av a73d=ay',
  'a74f=oo a75a=2 a76a=3 a76e=9 a777=tf a799=f a79f=u a7ab=3 ab32=e ab35=f ab3d=o ab47=r',
  'ab48=r ab4e=u ab52=u ab5a=y ab63=uo ab75=i ab81=r ab83=w ab93=z aba9=v abaa=s abaf=c',
  'fb00=ff fb01=fi fb02=fl fb03=ffi fb04=ffl fb06=st fba6=o fba7=o fba8=o fba9=o fbaa=o fbab=o',
  'fbac=o fbad=o fe8d=l fe8e=l fee9=o feea=o feeb=o feec=o ff29=l ff41=a ff43=c ff45=e',
  'ff47=g ff48=h ff49=i ff4a=j ff4c=l ff4f=o ff50=p ff53=s ff56=v ff58=x ff59=y ffe8=l',
  '1028a=l 10309=l 1031a=8 10320=l 1042c=o 1043d=c 10448=s 104d2=7 104ea=o 104f6=u 11700=rn 11706=v',
  '1170a=w 1170e=w 1170f=w 118ac=9 118af=4 118bb=5 118c0=v 118c1=s 118c3=i 118c4=z 118c6=7 118c8=o',
  '118ca=3 118cc=9 118d5=6 118d6=9 118d7=o 118d8=u 118dc=y 118e3=rn 16f28=l 16f3b=3 1ccde=l 1ccf1=l',
  '1ccf2=2 1ccf3=3 1ccf4=4 1ccf5=5 1ccf6=6 1ccf7=7 1ccf8=8 1ccf9=9 1d206=3 1d212=7 1d408=l 1d41a=a',
  '1d41b=b 1d41c=c 1d41d=d 1d41e=e 1d41f=f 1d420=g 1d421=h 1d422=i 1d423=j 1d424=k 1d425=l 1d426=rn',
  '1d427=n 1d428=o 1d429=p 1d42a=q 1d42b=r 1d42c=s 1d42d=t 1d42e=u 1d42f=v 1d430=w 1d431=x 1d432=y',
  '1d433=z 1d43c=l 1d44e=a 1d44f=b 1d450=c 1d451=d 1d452=e 1d453=f 1d454=g 1d456=i 1d457=j 1d458=k',
  '1d459=l 1d45a=rn 1d45b=n 1d45c=o 1d45d=p 1d45e=q 1d45f=r 1d460=s 1d461=t 1d462=u 1d463=v 1d464=w',
  '1d465=x 1d466=y 1d467=z 1d470=l 1d482=a 1d483=b 1d484=c 1d485=d 1d486=e 1d487=f 1d488=g 1d489=h',
  '1d48a=i 1d48b=j 1d48c=k 1d48d=l 1d48e=rn 1d48f=n 1d490=o 1d491=p 1d492=q 1d493=r 1d494=s 1d495=t',
  '1d496=u 1d497=v 1d498=w 1d499=x 1d49a=y 1d49b=z 1d4b6=a 1d4b7=b 1d4b8=c 1d4b9=d 1d4bb=f 1d4bd=h',
  '1d4be=i 1d4bf=j 1d4c0=k 1d4c1=l 1d4c2=rn 1d4c3=n 1d4c5=p 1d4c6=q 1d4c7=r 1d4c8=s 1d4c9=t 1d4ca=u',
  '1d4cb=v 1d4cc=w 1d4cd=x 1d4ce=y 1d4cf=z 1d4d8=l 1d4ea=a 1d4eb=b 1d4ec=c 1d4ed=d 1d4ee=e 1d4ef=f',
  '1d4f0=g 1d4f1=h 1d4f2=i 1d4f3=j 1d4f4=k 1d4f5=l 1d4f6=rn 1d4f7=n 1d4f8=o 1d4f9=p 1d4fa=q 1d4fb=r',
  '1d4fc=s 1d4fd=t 1d4fe=u 1d4ff=v 1d500=w 1d501=x 1d502=y 1d503=z 1d51e=a 1d51f=b 1d520=c 1d521=d',
  '1d522=e 1d523=f 1d524=g 1d525=h 1d526=i 1d527=j 1d528=k 1d529=l 1d52a=rn 1d52b=n 1d52c=o 1d52d=p',
  '1d52e=q 1d52f=r 1d530=s 1d531=t 1d532=u 1d533=v 1d534=w 1d535=x 1d536=y 1d537=z 1d540=l 1d552=a',
  '1d553=b 1d554=c 1d555=d 1d556=e 1d557=f 1d558=g 1d559=h 1d55a=i 1d55b=j 1d55c=k 1d55d=l 1d55e=rn',
  '1d55f=n 1d560=o 1d561=p 1d562=q 1d563=r 1d564=s 1d565=t 1d566=u 1d567=v 1d568=w 1d569=x 1d56a=y',
  '1d56b=z 1d574=l 1d586=a 1d587=b 1d588=c 1d589=d 1d58a=e 1d58b=f 1d58c=g 1d58d=h 1d58e=i 1d58f=j',
  '1d590=k 1d591=l 1d592=rn 1d593=n 1d594=o 1d595=p 1d596=q 1d597=r 1d598=s 1d599=t 1d59a=u 1d59b=v',
  '1d59c=w 1d59d=x 1d59e=y 1d59f=z 1d5a8=l 1d5ba=a 1d5bb=b 1d5bc=c 1d5bd=d 1d5be=e 1d5bf=f 1d5c0=g',
  '1d5c1=h 1d5c2=i 1d5c3=j 1d5c4=k 1d5c5=l 1d5c6=rn 1d5c7=n 1d5c8=o 1d5c9=p 1d5ca=q 1d5cb=r 1d5cc=s',
  '1d5cd=t 1d5ce=u 1d5cf=v 1d5d0=w 1d5d1=x 1d5d2=y 1d5d3=z 1d5dc=l 1d5ee=a 1d5ef=b 1d5f0=c 1d5f1=d',
  '1d5f2=e 1d5f3=f 1d5f4=g 1d5f5=h 1d5f6=i 1d5f7=j 1d5f8=k 1d5f9=l 1d5fa=rn 1d5fb=n 1d5fc=o 1d5fd=p',
  '1d5fe=q 1d5ff=r 1d600=s 1d601=t 1d602=u 1d603=v 1d604=w 1d605=x 1d606=y 1d607=z 1d610=l 1d622=a',
  '1d623=b 1d624=c 1d625=d 1d626=e 1d627=f 1d628=g 1d629=h 1d62a=i 1d62b=j 1d62c=k 1d62d=l 1d62e=rn',
  '1d62f=n 1d630=o 1d631=p 1d632=q 1d633=r 1d634=s 1d635=t 1d636=u 1d637=v 1d638=w 1d639=x 1d63a=y',
  '1d63b=z 1d644=l 1d656=a 1d657=b 1d658=c 1d659=d 1d65a=e 1d65b=f 1d65c=g 1d65d=h 1d65e=i 1d65f=j',
  '1d660=k 1d661=l 1d662=rn 1d663=n 1d664=o 1d665=p 1d666=q 1d667=r 1d668=s 1d669=t 1d66a=u 1d66b=v',
  '1d66c=w 1d66d=x 1d66e=y 1d66f=z 1d678=l 1d68a=a 1d68b=b 1d68c=c 1d68d=d 1d68e=e 1d68f=f 1d690=g',
  '1d691=h 1d692=i 1d693=j 1d694=k 1d695=l 1d696=rn 1d697=n 1d698=o 1d699=p 1d69a=q 1d69b=r 1d69c=s',
  '1d69d=t 1d69e=u 1d69f=v 1d6a0=w 1d6a1=x 1d6a2=y 1d6a3=z 1d6a4=i 1d6b0=l 1d6c2=a 1d6c4=y 1d6ca=i',
  '1d6ce=v 1d6d0=o 1d6d2=p 1d6d4=o 1d6d6=u 1d6e0=p 1d6ea=l 1d6fc=a 1d6fe=y 1d704=i 1d708=v 1d70a=o',
  '1d70c=p 1d70e=o 1d710=u 1d71a=p 1d724=l 1d736=a 1d738=y 1d73e=i 1d742=v 1d744=o 1d746=p 1d748=o',
  '1d74a=u 1d754=p 1d75e=l 1d770=a 1d772=y 1d778=i 1d77c=v 1d77e=o 1d780=p 1d782=o 1d784=u 1d78e=p',
  '1d798=l 1d7aa=a 1d7ac=y 1d7b2=i 1d7b6=v 1d7b8=o 1d7ba=p 1d7bc=o 1d7be=u 1d7c8=p 1d7cf=l 1d7d0=2',
  '1d7d1=3 1d7d2=4 1d7d3=5 1d7d4=6 1d7d5=7 1d7d6=8 1d7d7=9 1d7d9=l 1d7da=2 1d7db=3 1d7dc=4 1d7dd=5',
  '1d7de=6 1d7df=7 1d7e0=8 1d7e1=9 1d7e3=l 1d7e4=2 1d7e5=3 1d7e6=4 1d7e7=5 1d7e8=6 1d7e9=7 1d7ea=8',
  '1d7eb=9 1d7ed=l 1d7ee=2 1d7ef=3 1d7f0=4 1d7f1=5 1d7f2=6 1d7f3=7 1d7f4=8 1d7f5=9 1d7f7=l 1d7f8=2',
  '1d7f9=3 1d7fa=4 1d7fb=5 1d7fc=6 1d7fd=7 1d7fe=8 1d7ff=9 1e8c7=l 1e8cb=8 1ee00=l 1ee24=o 1ee64=o',
  '1ee80=l 1ee84=o 1f75c=sss 1fbf1=l 1fbf2=2 1fbf3=3 1fbf4=4 1fbf5=5 1fbf6=6 1fbf7=7 1fbf8=8 1fbf9=9',
].join(' ');

/** Code point → its Latin prototype (one or more of a–z, 0–9). */
export const CONFUSABLES: ReadonlyMap<number, string> = new Map(
  TABLE.split(' ').map(pair => {
    const [cp, target] = pair.split('=');
    return [parseInt(cp ?? '', 16), target ?? ''] as const;
  }),
);
````

Create `extension/src/background/dapp/knownList.ts`:

````ts
/**
 * The known domains (spec §2.5, D2; owner-approved with rev 3): noc-tura.io and a short baked list of large Solana
 * dApps. The one list drives the "Verified" badge (#46, #47, #49's dot) and the lookalike rules. Baked — no remote list
 * and no favicon (C6). Rule (review M4.6): never list a domain whose subdomains users can register or control — every
 * subdomain of a listed domain is verified.
 */
export interface KnownDomain {
  name: string;
  domain: string;
}

export const KNOWN_DOMAINS: readonly KnownDomain[] = [
  {name: 'Noctura', domain: 'noc-tura.io'},
  {name: 'Jupiter', domain: 'jup.ag'},
  {name: 'Raydium', domain: 'raydium.io'},
  {name: 'Orca', domain: 'orca.so'},
  {name: 'Meteora', domain: 'meteora.ag'},
  {name: 'Magic Eden', domain: 'magiceden.io'},
  {name: 'Tensor', domain: 'tensor.trade'},
  {name: 'Drift', domain: 'drift.trade'},
  {name: 'Marinade', domain: 'marinade.finance'},
  {name: 'Kamino', domain: 'kamino.finance'},
  {name: 'Jito', domain: 'jito.network'},
  {name: 'Phantom', domain: 'phantom.app'},
  {name: 'Solflare', domain: 'solflare.com'},
  {name: 'Solscan', domain: 'solscan.io'},
  {name: 'pump.fun', domain: 'pump.fun'},
];
````

Create `extension/src/background/dapp/punycode.ts`:

````ts
/**
 * RFC 3492 Punycode, decoding only (spec §2.5: "own RFC 3492 decoder"): the classifier reads an `xn--` label's
 * Unicode form and nothing else. No dependency — the background takes no third-party code for this (D6).
 */
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const MAXINT = 0x7fffffff;

function adapt(delta: number, points: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / points);
  let k = 0;
  while (d > ((BASE - TMIN) * TMAX) >> 1) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

/** A basic code point's digit value (0–35), or BASE when it is not a digit. */
function digitOf(c: number): number {
  if (c >= 0x30 && c <= 0x39) return c - 22;
  if (c >= 0x41 && c <= 0x5a) return c - 0x41;
  if (c >= 0x61 && c <= 0x7a) return c - 0x61;
  return BASE;
}

/** The Unicode string a Punycode string (without `xn--`) encodes, or null when it is not valid Punycode. */
export function decodePunycode(input: string): string | null {
  const output: number[] = [];
  const delimiter = input.lastIndexOf('-');
  const basic = delimiter < 0 ? 0 : delimiter;
  for (let j = 0; j < basic; j++) {
    const c = input.charCodeAt(j);
    if (c >= 0x80) return null;
    output.push(c);
  }
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;
  for (let at = delimiter < 0 ? 0 : basic + 1; at < input.length; ) {
    const before = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (at >= input.length) return null;
      const d = digitOf(input.charCodeAt(at++));
      if (d >= BASE || d > Math.floor((MAXINT - i) / w)) return null;
      i += d * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (d < t) break;
      if (w > Math.floor(MAXINT / (BASE - t))) return null;
      w *= BASE - t;
    }
    const length = output.length + 1;
    bias = adapt(i - before, length, before === 0);
    if (Math.floor(i / length) > MAXINT - n) return null;
    n += Math.floor(i / length);
    i %= length;
    if (n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return null;
    output.splice(i, 0, n);
    i += 1;
  }
  return String.fromCodePoint(...output);
}

/** A host label as Unicode: an `xn--` label decoded, any other returned as it is; null for an invalid `xn--` label. */
export function decodeLabel(label: string): string | null {
  return label.startsWith('xn--') ? decodePunycode(label.slice(4)) : label;
}
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run src/background/dapp/__tests__/classify.test.ts src/background/dapp/__tests__/confusables.test.ts src/background/dapp/__tests__/punycode.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  3 passed (3) · Tests  17 passed (17); tsc clean; whole suite Test Files  141 passed (141) · Tests  2838 passed (2838); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M1a** — verified only for the exact domain, never a subdomain (rule 1) — `extension/src/background/dapp/classify.ts`:

  ```diff
  - if (h === k.domain || h.endsWith(`.${k.domain}`)) return {kind: 'verified'
  + if (h === k.domain) return {kind: 'verified'
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/classify.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 11 passed (12)).

- **M1b** — rule a compares the pair's skeleton with the raw listed domain (R1) — `extension/src/background/dapp/classify.ts`:

  ```diff
  - const hit = KNOWN.find(k => k.skeleton === pair);
  + const hit = KNOWN.find(k => k.domain === pair);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/classify.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 10 passed (12)).

- **M1c** — rule b's floor at 3 characters (jupp.ag a lookalike) — `extension/src/background/dapp/classify.ts`:

  ```diff
  - k.label.length >= 4 && editDistance
  + k.label.length >= 3 && editDistance
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/classify.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 10 passed (12)).

- **M1d** — rule c without the dotted-to-hyphen form — `extension/src/background/dapp/classify.ts`:

  ```diff
  - h.includes(k.domain) || h.includes(k.domain.replace(/\./g, '-'))
  + h.includes(k.domain)
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/classify.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 11 passed (12)).

- **M1e** — rule d without its "a swap applied" condition (R3) — `extension/src/background/dapp/classify.ts`:

  ```diff
  - if (sld !== '' && swapped(sld) !== sld) {
  + if (sld !== '') {
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/classify.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 11 passed (12)).

- **M1f** — skel keeps combining marks — `extension/src/background/dapp/classify.ts`:

  ```diff
  - const bare = decoded.normalize('NFD').replace(MARKS, '').replace(FORMAT, '');
  + const bare = decoded.normalize('NFD').replace(MARKS, '$&').replace(FORMAT, '');
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/classify.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 11 passed (12)).

- **M1g** — the displayed decoded host keeps format characters — `extension/src/background/dapp/classify.ts`:

  ```diff
  -     .join('.')
  -     .replace(FORMAT, '');
  - }
  +     .join('.');
  + }
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/classify.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 11 passed (12)).

- **M1h** — the decoder's bias adaptation never takes the first-time branch — `extension/src/background/dapp/punycode.ts`:

  ```diff
  - bias = adapt(i - before, length, before === 0);
  + bias = adapt(i - before, length, false);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/punycode.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 2 passed (3)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/dapp/__tests__/classify.test.ts extension/src/background/dapp/__tests__/confusables.test.ts extension/src/background/dapp/__tests__/punycode.test.ts extension/src/background/dapp/classify.ts extension/src/background/dapp/confusables.ts extension/src/background/dapp/knownList.ts extension/src/background/dapp/punycode.ts
git commit -F - <<'MSG'
feat(extension): B1c classifier — known list, own punycode decoder, Unicode confusables, rules a–d

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 2: The stores: grants (session + persistent, the cap, `recent`), blocked hosts, the limits (cooldown per host and per tab, the window budget), the session state and the queue mutex; wiped on delete, kept on restore; the gate owns the keys

**Spec:** §2.1, §2.6, C3, C11, C14 (counters), §2.3 ("under the queue mutex"); §6.1 "Grants" (delete wipes, restore keeps), "Queue and limits" (the counters); §6.2 vault-isolation (`BACKGROUND_OWNED_KEYS` + fixture); Review Focus 1; plan review 1 M1 (`decidingAt`)

**Files:**
- Test: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Test: `extension/src/background/__tests__/forgetWallet.test.ts`
- Modify: `extension/src/background/accountsStore.ts`
- Test: `extension/src/background/dapp/__tests__/store.test.ts` (new)
- Create: `extension/src/background/dapp/blocked.ts`
- Create: `extension/src/background/dapp/grants.ts`
- Create: `extension/src/background/dapp/limits.ts`
- Create: `extension/src/background/dapp/store.ts`

**Interfaces:**
- Consumes: `createMutex` (`../mutex`), `getSession`, `sessionMutex` (`../session`), `Ext` — unchanged.
- Produces (as exported):
  - `grants.ts`: `GRANTS_KEY = 'v1_dapp_grants'`, `MAX_GRANTS = 200`, `RECENT_KEPT = 3`, `type RequestType = 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction'`, `interface Recent {type; at; outcome: 'approved' | 'rejected'}`, `interface Grant {origin; account; scope: 'session' | 'persistent'; connectedAt; lastUsedAt; recent: Recent[]}`, `grantOf(x, scope)`, `grantsOf(x, scope, max)`, `withRecent(g, type, at, outcome)`.
  - `blocked.ts`: `BLOCKED_KEY = 'v1_dapp_blocked'`, `MAX_BLOCKED = 200`, `interface Blocked {host; blockedAt; imitates: string | null}`, `blockedOf(x)`, `isBlocked(list, host)`, `withBlock(list, host, imitates, now)`, `withoutBlock(list, host)`.
  - `limits.ts`: `LIMITS_KEY = 'v1_dapp_limits'`, `LIMIT_WINDOW_MS`, `REJECTIONS_FOR_COOLDOWN = 3`, `COOLDOWN_MS`, `WINDOW_BUDGET = 10`, `interface Limits {rejections; cooldowns; windows; notice}`, `EMPTY_LIMITS`, `hostKey`, `tabKey`, `limitsOf(x, now)`, `prune`, `rejectionsOf(l, host, tabId)`, `withRejection(l, host, tabId, now)`, `inCooldown(l, host, tabId, now)`, `budgetLeft(l, now)`, `withWindow(l, now)`.
  - `store.ts`: `DAPP_SESSION_KEY = 'v1_dapp_session'`, `type ErrorCode`, `ERROR_CODES`, `type Answer`, `type EntryType = 'connect' | 'signMessage'`, `type Decision = 'approve' | 'reject' | 'report' | 'block'`, `interface Entry` (with `decidingAt: number | null`, rev 2), `interface Undo`, `interface DappSession {queue; grants; window; opening; undo}`, `EMPTY_SESSION`, `entryOf`, `readDappSession(ext)`, `interface Tx {s; grants; blocked; limits; session; now}`, `dappSection<T>(ext, now, fn)`, `grantIn(tx, origin)`, `dropGrant(tx, origin)`, `putGrant(tx, g)`.
  - `accountsStore.ts`: `WALLET_DATA_KEYS` exported, with the three keys.

Everything the request lifecycle writes, and the one section that writes it. `dappSection` is THE queue mutex the spec names: its own mutex, then `sessionMutex`; inside, it reads the session state, the three `storage.local` keys and the session (locked or not), runs the caller's change, and writes back only what changed. So a check and the write it guards are never split by a lock (§2.3 "unlocked", `setSessionIf`'s pattern), and the lock hook — which runs inside `sessionMutex` — is totally ordered with every section. Every stored value is re-validated on read and never "repaired": a bad entry is dropped (an IP-literal origin or host is kept — Review Focus 1). The three keys join `WALLET_DATA_KEYS` (C11: a delete or a first write removes them, a restore keeps them) and the gate's `BACKGROUND_OWNED_KEYS` (no popup, window or vault-page file may name them).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -398,6 +398,15 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
     expect(sourceViolations([f('src/app/screens/Contacts.tsx', "const k = 'v1_contacts';")])).toEqual([OWNED('src/app/screens/Contacts.tsx', 'v1_contacts')]);
     expect(sourceViolations([f('src/unlock/main.ts', '// v1_contacts')])).toEqual([OWNED('src/unlock/main.ts', 'v1_contacts')]);
   });
+  // B1c (spec §2.1, review 1 L4): the dApp grants, blocked sites and limits are the background's — the approval window,
+  // the popup and the vault page reach them only through dapp.* messages.
+  it('lets only the background name the three dApp keys (v1_dapp_grants, v1_dapp_blocked, v1_dapp_limits)', () => {
+    const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
+    expect(sourceViolations([f('src/background/dapp/grants.ts', "export const GRANTS_KEY = 'v1_dapp_grants';")])).toEqual([]);
+    expect(sourceViolations([f('src/approve/Approve.tsx', "const k = 'v1_dapp_grants';")])).toEqual([OWNED('src/approve/Approve.tsx', 'v1_dapp_grants')]);
+    expect(sourceViolations([f('src/app/screens/ConnectedApps.tsx', "const k = 'v1_dapp_blocked';")])).toEqual([OWNED('src/app/screens/ConnectedApps.tsx', 'v1_dapp_blocked')]);
+    expect(sourceViolations([f('src/unlock/main.ts', '// v1_dapp_limits')])).toEqual([OWNED('src/unlock/main.ts', 'v1_dapp_limits')]);
+  });
   // B1b-2a E4: the balance and price caches are the background's too.
   it('lets only the background name the two cache keys', () => {
     const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
````

Modify `extension/src/background/__tests__/forgetWallet.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/forgetWallet.test.ts b/extension/src/background/__tests__/forgetWallet.test.ts
--- a/extension/src/background/__tests__/forgetWallet.test.ts
+++ b/extension/src/background/__tests__/forgetWallet.test.ts
@@ -8,6 +8,9 @@ import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
 import {SETTINGS_KEY} from '../settings';
 import {CONTACTS_KEY, removeContact} from '../contacts';
 import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../balanceCache';
+import {GRANTS_KEY} from '../dapp/grants';
+import {BLOCKED_KEY} from '../dapp/blocked';
+import {LIMITS_KEY} from '../dapp/limits';
 import {FORBIDDEN_UNTIL_KEY} from '../deps';
 import {AUTOLOCK_ALARM} from '../autolock';
 import {envelopeRevision} from '../../shared/envelopeRevision';
@@ -39,6 +42,10 @@ const STORED = {
 const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
 /** The same wallet under a new password: new salt, wrap and ciphertext; the same keys; names the page copied. */
 const REPLACEMENT = {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}};
+/** B1c (C11, C14): a persistent dApp grant, a blocked host and a cooldown — the wallet's, like the address book. */
+const GRANT = {origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []};
+const BLOCK = {host: 'tensr.trade', blockedAt: 1, imitates: 'tensor.trade'};
+const LIMITS = {rejections: [], cooldowns: [{key: 'host:tensr.trade', until: 9e12}], windows: [], notice: false};
 const zero = () => fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});
 
 async function setup(reader: SolanaReader = zero()) {
@@ -48,6 +55,9 @@ async function setup(reader: SolanaReader = zero()) {
   await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
   await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
   await ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Marko'}]);
+  await ext.local.set(GRANTS_KEY, [GRANT]);
+  await ext.local.set(BLOCKED_KEY, [BLOCK]);
+  await ext.local.set(LIMITS_KEY, LIMITS);
   await ext.local.set(BALANCE_CACHE_KEY, {});
   await ext.local.set(PRICE_CACHE_KEY, {});
   await ext.local.set(FORBIDDEN_UNTIL_KEY, 123);
@@ -133,8 +143,8 @@ describe('vault.forgetWallet — a delete (no replacement)', () => {
     expect(await vault(ext)).toBeUndefined();
     expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
     expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
-    // B1b-2b E17 (D20): the address book goes with the wallet.
-    for (const key of [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) expect(await ext.local.get(key)).toBeUndefined();
+    // B1b-2b E17 (D20): the address book goes with the wallet; B1c (C11, C14): so do the dApp grants, blocks and limits.
+    for (const key of [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) expect(await ext.local.get(key)).toBeUndefined();
     expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
   });
 
@@ -154,8 +164,9 @@ describe('vault.forgetWallet — a restore (replacement, C4, D40)', () => {
     expect(await vault(ext)).toEqual(REPLACEMENT);
     expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1}]);
     expect(await ext.local.get(SETTINGS_KEY)).toEqual({autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
-    // B1b-2b E17 (D20): a restore keeps the address book.
+    // B1b-2b E17 (D20): a restore keeps the address book; B1c (C11): and the dApp grants, blocks and limits.
     expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: RECIPIENT, name: 'Marko'}]);
+    expect([await ext.local.get(GRANTS_KEY), await ext.local.get(BLOCKED_KEY), await ext.local.get(LIMITS_KEY)]).toEqual([[GRANT], [BLOCK], LIMITS]);
     expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
     expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
     expect(await getSession(ext)).toBeNull();
@@ -341,7 +352,12 @@ describe('a first write clears what a crashed delete left behind', () => {
     await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
     await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 60, reauthUsdCents: 100000, selectedAccount: 0});
     await ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Left behind'}]);
+    await ext.local.set(GRANTS_KEY, [GRANT]);
+    await ext.local.set(BLOCKED_KEY, [BLOCK]);
+    await ext.local.set(LIMITS_KEY, LIMITS);
     expect(await storeEnvelope(ext, null, STORED)).toBe('stored');
+    // B1c: a grant a crashed delete left behind never connects a site to the next wallet.
+    for (const key of [GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY]) expect(await ext.local.get(key)).toBeUndefined();
     expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
     expect(await ext.local.get(SETTINGS_KEY)).toBeUndefined();
     // B1b-2b E17: a book a crashed delete left behind never reaches the next wallet.
````

Create `extension/src/background/dapp/__tests__/store.test.ts`:

````ts
import {GRANTS_KEY, MAX_GRANTS, grantsOf, withRecent, type Grant} from '../grants';
import {BLOCKED_KEY, MAX_BLOCKED, blockedOf, isBlocked, withBlock, withoutBlock} from '../blocked';
import {COOLDOWN_MS, EMPTY_LIMITS, LIMITS_KEY, LIMIT_WINDOW_MS, WINDOW_BUDGET, budgetLeft, inCooldown, limitsOf, rejectionsOf, withRejection, withWindow} from '../limits';
import {DAPP_SESSION_KEY, EMPTY_SESSION, dappSection, dropGrant, grantIn, putGrant, readDappSession, type Entry} from '../store';
import {setSession} from '../../session';
import {fakeExt} from '../../__tests__/fakeExt';
import {ACCOUNT} from '../../__tests__/fixtures';

const T = 1_000_000_000;
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: T, lastUsedAt: T, recent: [], ...over});
const entry = (over: Partial<Entry> = {}): Entry => ({
  requestId: 'r1', pageId: 'p1', origin: 'https://dapp.test', host: 'dapp.test', tabId: 7, documentId: null, type: 'connect', account: null,
  message: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null, decision: null, answer: null, answeredAt: null, ...over,
});

// Spec §2.1, §2.6, C14 — the stores the request lifecycle writes, and the one section that writes them.
describe('grants (§2.1)', () => {
  it('a stored list is re-validated: a bad field, an http origin and a second grant for one origin are dropped; at most the cap', () => {
    const ok = grant('https://jup.ag');
    const stored = [ok, {...ok}, grant('http://jup.ag'), {...grant('https://a.test'), scope: 'session'}, {...grant('https://b.test'), recent: [{type: 'x', at: 1, outcome: 'approved'}]}, null, 'x'];
    expect(grantsOf(stored, 'persistent', MAX_GRANTS)).toEqual([ok]);
    expect(grantsOf(Array.from({length: MAX_GRANTS + 5}, (_, i) => grant(`https://s${i}.test`)), 'persistent', MAX_GRANTS)).toHaveLength(MAX_GRANTS);
    expect(grantsOf({not: 'a list'}, 'persistent', MAX_GRANTS)).toEqual([]);
    expect(MAX_GRANTS).toBe(200);
  });

  // Review Focus 1: an IP-literal origin with a port is an origin like any other — kept by the re-validation.
  it('an IP literal and a port: https://[2001:db8::1]:8443 is kept, as its host is in the block list and the limits', () => {
    const ip = grant('https://[2001:db8::1]:8443');
    expect(grantsOf([ip], 'persistent', MAX_GRANTS)).toEqual([ip]);
    expect(blockedOf([{host: '[2001:db8::1]', blockedAt: 1, imitates: null}])).toEqual([{host: '[2001:db8::1]', blockedAt: 1, imitates: null}]);
    expect(inCooldown(withRejection(withRejection(withRejection(EMPTY_LIMITS, '[2001:db8::1]', 1, T), '[2001:db8::1]', 2, T), '[2001:db8::1]', 3, T), '[2001:db8::1]', 9, T + 1)).toBe(true);
    expect(limitsOf(withRejection(EMPTY_LIMITS, '[2001:db8::1]', 1, T), T).rejections).toHaveLength(2);
  });

  it('withRecent keeps the last three, newest first; only an approval moves lastUsedAt', () => {
    let g = grant('https://jup.ag');
    for (let i = 1; i <= 4; i++) g = withRecent(g, 'signMessage', T + i, i === 4 ? 'rejected' : 'approved');
    expect(g.recent.map(r => r.at)).toEqual([T + 4, T + 3, T + 2]);
    expect(g.lastUsedAt).toBe(T + 3);
  });
});

describe('blocked hosts (§2.6)', () => {
  it('newest first, one per host, at most 200 — the oldest falls out; unblock removes only the block', () => {
    let list = blockedOf(undefined);
    for (let i = 0; i < MAX_BLOCKED + 1; i++) list = withBlock(list, `h${i}.test`, null, T + i);
    expect(list).toHaveLength(MAX_BLOCKED);
    expect(isBlocked(list, 'h0.test')).toBe(false);
    expect(list[0]).toEqual({host: `h${MAX_BLOCKED}.test`, blockedAt: T + MAX_BLOCKED, imitates: null});
    list = withBlock(list, 'h5.test', 'tensor.trade', T + 999);
    expect(list.filter(b => b.host === 'h5.test')).toEqual([{host: 'h5.test', blockedAt: T + 999, imitates: 'tensor.trade'}]);
    expect(isBlocked(withoutBlock(list, 'h5.test'), 'h5.test')).toBe(false);
    expect(blockedOf([{host: 'a b', blockedAt: 1, imitates: null}, {host: 'ok.test', blockedAt: -1, imitates: null}])).toEqual([]);
  });
});

describe('limits (C14)', () => {
  it('the third rejection from one host within ten minutes starts a ten-minute cooldown for it — two do not', () => {
    let l = withRejection(withRejection(EMPTY_LIMITS, 'spam.test', 1, T), 'spam.test', 2, T + 1);
    expect(inCooldown(l, 'spam.test', 9, T + 2)).toBe(false);
    expect(rejectionsOf(l, 'spam.test', 9)).toBe(2);
    l = withRejection(l, 'spam.test', 3, T + 2);
    expect(inCooldown(l, 'spam.test', 9, T + 3)).toBe(true);
    expect(inCooldown(l, 'spam.test', 9, T + 2 + COOLDOWN_MS)).toBe(false);
    // Rejections older than the window do not count.
    const old = withRejection(withRejection(EMPTY_LIMITS, 'slow.test', 1, T), 'slow.test', 2, T + 1);
    expect(inCooldown(withRejection(old, 'slow.test', 3, T + LIMIT_WINDOW_MS + 5), 'slow.test', 9, T + LIMIT_WINDOW_MS + 6)).toBe(false);
  });

  it('one tab hopping across three origins is cooled down per tab (review 2 H2)', () => {
    let l = EMPTY_LIMITS;
    for (const [i, host] of ['a.test', 'b.test', 'c.test'].entries()) l = withRejection(l, host, 42, T + i);
    expect(inCooldown(l, 'd.test', 42, T + 5)).toBe(true);
    expect(inCooldown(l, 'd.test', 43, T + 5)).toBe(false);
  });

  it('the window budget: ten approval windows per ten minutes across all sites', () => {
    let l = EMPTY_LIMITS;
    for (let i = 0; i < WINDOW_BUDGET; i++) {
      expect(budgetLeft(l, T + i)).toBe(true);
      l = withWindow(l, T + i);
    }
    expect(budgetLeft(l, T + 20)).toBe(false);
    expect(budgetLeft(l, T + LIMIT_WINDOW_MS + 1)).toBe(true);
  });

  it('a stored value is re-validated and pruned; anything else is no limit', () => {
    expect(limitsOf('x', T)).toEqual(EMPTY_LIMITS);
    expect(limitsOf({rejections: [{key: 'host:a.test', at: T}, {key: 'evil', at: T}, {key: 'tab:1', at: T - LIMIT_WINDOW_MS - 1}], cooldowns: [], windows: [T, 'x'], notice: true}, T)).toEqual({
      rejections: [{key: 'host:a.test', at: T}],
      cooldowns: [],
      windows: [T],
      notice: true,
    });
  });
});

describe('dappSection — the queue mutex (store.ts)', () => {
  it('reads every store and the session, and writes back only what the section changed', async () => {
    const ext = fakeExt();
    await setSession(ext, [ACCOUNT]);
    await ext.local.set(GRANTS_KEY, [grant('https://jup.ag')]);
    const writes: string[] = [];
    const set = ext.local.set.bind(ext.local);
    ext.local.set = async (k, v) => {
      writes.push(k);
      await set(k, v);
    };
    const seen = await dappSection(ext, T, tx => {
      tx.blocked = withBlock(tx.blocked, 'tensr.trade', 'tensor.trade', T);
      tx.s.queue.push(entry());
      return {unlocked: tx.session !== null, grants: tx.grants.length};
    });
    expect(seen).toEqual({unlocked: true, grants: 1});
    expect(writes).toEqual([BLOCKED_KEY]);
    expect((await readDappSession(ext)).queue).toEqual([entry()]);
    expect(await ext.local.get(LIMITS_KEY)).toBeUndefined();
  });

  it('a session grant and a persistent grant: one per origin — putGrant replaces across scopes, dropGrant removes both', async () => {
    const ext = fakeExt();
    await dappSection(ext, T, tx => {
      putGrant(tx, grant('https://jup.ag'));
      putGrant(tx, grant('https://jup.ag', {scope: 'session'}));
      expect(tx.grants).toEqual([]);
      expect(grantIn(tx, 'https://jup.ag')?.scope).toBe('session');
      expect(grantIn(tx, 'https://www.jup.ag')).toBeNull();
      putGrant(tx, grant('https://www.jup.ag'));
      expect(dropGrant(tx, 'https://jup.ag')?.scope).toBe('session');
      expect(grantIn(tx, 'https://jup.ag')).toBeNull();
    });
    expect(await ext.local.get(GRANTS_KEY)).toEqual([grant('https://www.jup.ag')]);
  });

  it('the stored session state is re-validated: a malformed entry is dropped, never repaired', async () => {
    const ext = fakeExt();
    await ext.session.set(DAPP_SESSION_KEY, {queue: [entry(), {...entry(), state: 'weird'}, {...entry(), answer: {error: 'internal text'}}], window: {id: 'x'}});
    expect(await readDappSession(ext)).toEqual({...EMPTY_SESSION, queue: [entry()]});
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/background/__tests__/forgetWallet.test.ts src/background/dapp/__tests__/store.test.ts
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  3 failed (3) · Tests  1 failed | 414 passed (415). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/scripts/check-vault-isolation.mjs`:

````diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -88,7 +88,11 @@ const LISTEN_ALLOWED = /^src\/background\//;
 // a popup writing v1_settings could undo a re-authenticated setting without re-authenticating.
 // B1b-2a E4 adds the two caches: a popup writing one could show a balance the chain never had.
 // B1b-2b E17: the address book (v1_contacts) is the background's too — the popup reaches it only through contacts.*.
-export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache', 'v1_contacts'];
+// B1c (spec §2.1, review 1 L4): the dApp grants, blocked sites and limits — a page writing a grant would connect a site.
+export const BACKGROUND_OWNED_KEYS = [
+  'v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache', 'v1_contacts',
+  'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits',
+];
 const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
 // The vault page renders only fixed strings and the user's own words, as text (B1b-2a §1.2 item 3):
 // no file in src/unlock may parse or write markup, so nothing it shows can become an element.
````

Modify `extension/src/background/accountsStore.ts`:

````diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -8,6 +8,9 @@ import {KNOWN_RECIPIENTS_KEY} from './knownRecipients';
 import {SETTINGS_KEY, updateSettings} from './settings';
 import {CONTACTS_KEY} from './contacts';
 import {clearCaches} from './balanceCache';
+import {GRANTS_KEY} from './dapp/grants';
+import {BLOCKED_KEY} from './dapp/blocked';
+import {LIMITS_KEY} from './dapp/limits';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, accountsPolicyOk, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
 import {readWalletBalances} from '../../../core/solana/balances';
@@ -39,10 +42,11 @@ const serial = createMutex();
 /**
  * Everything a wallet owns in storage.local besides its envelope and the balance caches — removed together by a
  * delete (vault.forgetWallet without a replacement, E5 step 7 / B1b-2b E11) and by a first write. The one list, with
- * the address book (B1b-2b E17, D20: wiped on delete, kept on restore — a replacement does not come here).
+ * the address book (B1b-2b E17, D20: wiped on delete, kept on restore — a replacement does not come here), and B1c's
+ * dApp grants, blocked sites and rejection limits (spec C11, C14: wiped by a delete, kept by a restore).
  * `v1_forbidden_until` is not the wallet's (the coordinator's verdict) and is kept.
  */
-const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY];
+export const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY];
 async function removeWalletData(ext: Ext): Promise<void> {
   for (const key of WALLET_DATA_KEYS) await ext.local.remove(key);
 }
````

Create `extension/src/background/dapp/blocked.ts`:

````ts
/**
 * Blocked hosts (spec §2.6, D3): "Reject and report" and "Block this site" write here; a blocked host's requests are
 * answered `rejected` at once, with no window and no queue entry. Keyed by HOST — every port and scheme (review 2 H2,
 * L7). storage.local, background-owned (v1_dapp_blocked), at most MAX_BLOCKED (the oldest falls out), wiped by a delete
 * and kept by a restore (C11). Writes run inside store.ts's dappSection. Nothing is reported to a server (D3).
 */
export const BLOCKED_KEY = 'v1_dapp_blocked';
export const MAX_BLOCKED = 200;

export interface Blocked {
  host: string;
  blockedAt: number;
  /** The listed domain the host imitated (#49's "Looked like …"), or null. */
  imitates: string | null;
}

const HOST = /^[^\s/?#@:]{1,253}$|^\[[0-9a-f:.]{2,45}\]$/;

/** The stored list, re-validated, newest first; anything else in the key reads as no block. */
export function blockedOf(x: unknown): Blocked[] {
  if (!Array.isArray(x)) return [];
  const out: Blocked[] = [];
  const seen = new Set<string>();
  for (const item of x as unknown[]) {
    if (out.length >= MAX_BLOCKED) break;
    if (typeof item !== 'object' || item === null) continue;
    const {host, blockedAt, imitates} = item as Record<string, unknown>;
    if (typeof host !== 'string' || !HOST.test(host) || seen.has(host)) continue;
    if (typeof blockedAt !== 'number' || !Number.isSafeInteger(blockedAt) || blockedAt < 0) continue;
    if (imitates !== null && typeof imitates !== 'string') continue;
    seen.add(host);
    out.push({host, blockedAt, imitates});
  }
  return out;
}

export const isBlocked = (list: readonly Blocked[], host: string): boolean => list.some(b => b.host === host);

/** The list with `host` blocked first (an existing block moves to the front); at most MAX_BLOCKED, the oldest dropped. */
export function withBlock(list: readonly Blocked[], host: string, imitates: string | null, now: number): Blocked[] {
  return [{host, blockedAt: now, imitates}, ...list.filter(b => b.host !== host)].slice(0, MAX_BLOCKED);
}

export const withoutBlock = (list: readonly Blocked[], host: string): Blocked[] => list.filter(b => b.host !== host);
````

Create `extension/src/background/dapp/grants.ts`:

````ts
/**
 * Grants (spec §2.1, D4, C1, C2, C8, C11): which origin may see which one account. `persistent` grants live in
 * storage.local (v1_dapp_grants, background-owned: scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS), `session`
 * grants in the dApp session state (store.ts), wiped by the lock hook and by the browser on close. One grant per exact
 * origin (C8: `https://jup.ag` and `https://www.jup.ag` are two). Wiped by a wallet delete, kept by a restore (C11:
 * accountsStore's WALLET_DATA_KEYS). Every write runs inside store.ts's dappSection.
 */
export const GRANTS_KEY = 'v1_dapp_grants';
/** Persistent grants at most (§2.1): a connect beyond it opens #47 with Q16 and only [Reject]. */
export const MAX_GRANTS = 200;
/** Grant.recent keeps this many interactions (#49's "Last 3 interactions"). */
export const RECENT_KEPT = 3;

export type RequestType = 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction';
export interface Recent {
  type: RequestType;
  at: number;
  outcome: 'approved' | 'rejected';
}
export interface Grant {
  /** Exactly sender.origin. */
  origin: string;
  /** base58 publicKey of the granted account (C1: the dApp's account, not the popup's active one). */
  account: string;
  scope: 'session' | 'persistent';
  /** UTC ms. */
  connectedAt: number;
  /** UTC ms; every accepted request. */
  lastUsedAt: number;
  /** The last RECENT_KEPT interactions, newest first. */
  recent: Recent[];
}

const REQUEST_TYPES: readonly string[] = ['connect', 'signMessage', 'signTransaction', 'signAndSendTransaction'];
const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
/** An https origin as the browser reports it: scheme, host (ASCII / punycode, or an IP literal) and an optional port. */
const ORIGIN = /^https:\/\/[^\s/?#@]+$/;

function recentOf(x: unknown): Recent | null {
  if (typeof x !== 'object' || x === null) return null;
  const {type, at, outcome} = x as Record<string, unknown>;
  if (typeof type !== 'string' || !REQUEST_TYPES.includes(type) || !isTime(at) || (outcome !== 'approved' && outcome !== 'rejected')) return null;
  return {type: type as RequestType, at, outcome};
}

/** One stored grant, rebuilt field by field; null when any field is not what the background writes. */
export function grantOf(x: unknown, scope: Grant['scope']): Grant | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.origin !== 'string' || !ORIGIN.test(o.origin) || typeof o.account !== 'string' || o.account.length === 0) return null;
  if (o.scope !== scope || !isTime(o.connectedAt) || !isTime(o.lastUsedAt) || !Array.isArray(o.recent)) return null;
  const recent: Recent[] = [];
  for (const r of (o.recent as unknown[]).slice(0, RECENT_KEPT)) {
    const v = recentOf(r);
    if (v === null) return null;
    recent.push(v);
  }
  return {origin: o.origin, account: o.account, scope, connectedAt: o.connectedAt, lastUsedAt: o.lastUsedAt, recent};
}

/** A stored list, re-validated: a bad entry and a second grant for an origin already read are dropped; at most `max`. */
export function grantsOf(x: unknown, scope: Grant['scope'], max: number): Grant[] {
  if (!Array.isArray(x)) return [];
  const out: Grant[] = [];
  const seen = new Set<string>();
  for (const item of x as unknown[]) {
    if (out.length >= max) break;
    const g = grantOf(item, scope);
    if (g === null || seen.has(g.origin)) continue;
    seen.add(g.origin);
    out.push(g);
  }
  return out;
}

/** The grant with this interaction recorded (newest first, RECENT_KEPT kept) and, when approved, lastUsedAt moved. */
export function withRecent(g: Grant, type: RequestType, at: number, outcome: Recent['outcome']): Grant {
  return {...g, lastUsedAt: outcome === 'approved' ? at : g.lastUsedAt, recent: [{type, at, outcome}, ...g.recent].slice(0, RECENT_KEPT)};
}
````

Create `extension/src/background/dapp/limits.ts`:

````ts
/**
 * The rejection cooldown and the window budget (spec C14, §2.3; review 1 M8, review 2 H2, L1). Counters live in
 * storage.local (v1_dapp_limits, background-owned) so a lock does not reset them; wiped by a delete. Pure functions
 * over the stored value; store.ts's dappSection reads and writes it.
 */
export const LIMITS_KEY = 'v1_dapp_limits';
/** Everything here counts within the last ten minutes. */
export const LIMIT_WINDOW_MS = 10 * 60_000;
/** The third rejection from one host or one tab starts a cooldown … */
export const REJECTIONS_FOR_COOLDOWN = 3;
/** … of ten minutes, in which its requests are answered `rejected` with no window. */
export const COOLDOWN_MS = 10 * 60_000;
/** At most this many approval windows in LIMIT_WINDOW_MS, across all sites. */
export const WINDOW_BUDGET = 10;

export interface Limits {
  /** One per rejection and key (`host:<h>` and `tab:<id>`), at UTC ms. */
  rejections: {key: string; at: number}[];
  cooldowns: {key: string; until: number}[];
  /** When each approval window was opened. */
  windows: number[];
  /** A request was declined because the budget was spent: the next window shows Q24, once. */
  notice: boolean;
}

export const EMPTY_LIMITS: Limits = {rejections: [], cooldowns: [], windows: [], notice: false};

const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const KEY = /^(host:[^\s/?#@]{1,253}|tab:\d{1,10})$/;
/** Bounds what one key can grow to whatever happens (a tab key per rejection, ten minutes kept). */
const MAX_ENTRIES = 1000;

export const hostKey = (host: string): string => `host:${host}`;
export const tabKey = (tabId: number): string => `tab:${tabId}`;

/** The stored value, re-validated and pruned to the window; anything else reads as no limits at all. */
export function limitsOf(x: unknown, now: number): Limits {
  if (typeof x !== 'object' || x === null) return EMPTY_LIMITS;
  const o = x as Record<string, unknown>;
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);
  const rejections = list(o.rejections)
    .filter((r): r is {key: string; at: number} => typeof r === 'object' && r !== null && typeof (r as {key?: unknown}).key === 'string' && KEY.test((r as {key: string}).key) && isTime((r as {at?: unknown}).at))
    .map(r => ({key: r.key, at: r.at}));
  const cooldowns = list(o.cooldowns)
    .filter((c): c is {key: string; until: number} => typeof c === 'object' && c !== null && typeof (c as {key?: unknown}).key === 'string' && KEY.test((c as {key: string}).key) && isTime((c as {until?: unknown}).until))
    .map(c => ({key: c.key, until: c.until}));
  const windows = list(o.windows).filter(isTime);
  return prune({rejections, cooldowns, windows, notice: o.notice === true}, now);
}

/** Only what still counts: rejections and windows of the last ten minutes, cooldowns not yet over. */
export function prune(l: Limits, now: number): Limits {
  const since = now - LIMIT_WINDOW_MS;
  return {
    rejections: l.rejections.filter(r => r.at > since && r.at <= now).slice(-MAX_ENTRIES),
    cooldowns: l.cooldowns.filter(c => c.until > now).slice(-MAX_ENTRIES),
    windows: l.windows.filter(t => t > since && t <= now).slice(-MAX_ENTRIES),
    notice: l.notice,
  };
}

const count = (l: Limits, key: string): number => l.rejections.filter(r => r.key === key).length;

/** How many rejections the more-rejected of the request's host and tab has had in the window. */
export function rejectionsOf(l: Limits, host: string, tabId: number): number {
  return Math.max(count(l, hostKey(host)), count(l, tabKey(tabId)));
}

/** A rejection from this host and tab; the third within ten minutes for either starts its cooldown. */
export function withRejection(l: Limits, host: string, tabId: number, now: number): Limits {
  const keys = [hostKey(host), tabKey(tabId)];
  const next = prune({...l, rejections: [...l.rejections, ...keys.map(key => ({key, at: now}))]}, now);
  const cooling = keys.filter(k => count(next, k) >= REJECTIONS_FOR_COOLDOWN && !next.cooldowns.some(c => c.key === k));
  return {...next, cooldowns: [...next.cooldowns, ...cooling.map(key => ({key, until: now + COOLDOWN_MS}))]};
}

export function inCooldown(l: Limits, host: string, tabId: number, now: number): boolean {
  const keys = [hostKey(host), tabKey(tabId)];
  return l.cooldowns.some(c => keys.includes(c.key) && c.until > now);
}

export const budgetLeft = (l: Limits, now: number): boolean => prune(l, now).windows.length < WINDOW_BUDGET;

export const withWindow = (l: Limits, now: number): Limits => prune({...l, windows: [...l.windows, now]}, now);
````

Create `extension/src/background/dapp/store.ts`:

````ts
import type {Ext} from '../../ext';
import type {SessionAccount} from '../../vault/accounts';
import {createMutex} from '../mutex';
import {getSession, sessionMutex} from '../session';
import {BLOCKED_KEY, blockedOf, type Blocked} from './blocked';
import {GRANTS_KEY, MAX_GRANTS, grantOf, grantsOf, type Grant} from './grants';
import {LIMITS_KEY, limitsOf, type Limits} from './limits';

/**
 * The dApp provider's state (spec §1.5, §2). storage.session holds what dies with the session — the request queue,
 * the session grants, the approval window's id and its `opening` marker, the undo buffer — under one key, `v1_dapp`;
 * storage.local holds the persistent grants (grants.ts), the blocks (blocked.ts) and the limits (limits.ts).
 *
 * dappSection is THE queue mutex the spec names: every read-modify-write of any of them runs inside one, which takes
 * this module's mutex and then sessionMutex (lock order: dappMutex → sessionMutex; nothing under sessionMutex takes
 * dappMutex — the lock hook, which runs inside sessionMutex, reads and rewrites `v1_dapp` itself and never takes it).
 * A section sees the session (locked or not) as of the moment it runs, so a check and the write it guards are never
 * split by a lock (setSessionIf's pattern, §2.3 "unlocked").
 */
export const DAPP_SESSION_KEY = 'v1_dapp_session';

export type ErrorCode = 'rejected' | 'unauthorized' | 'request-pending' | 'busy' | 'timeout' | 'invalid-request';
export const ERROR_CODES: readonly ErrorCode[] = ['rejected', 'unauthorized', 'request-pending', 'busy', 'timeout', 'invalid-request'];
export type Answer = {result: Record<string, unknown>} | {error: ErrorCode};
export type EntryType = 'connect' | 'signMessage';
export type Decision = 'approve' | 'reject' | 'report' | 'block';

/** One request that needs the user (§1.5 step 1). */
export interface Entry {
  /** 128 random bits, base64url (review 2 M1). */
  requestId: string;
  /** The relay's own id for it: a re-sent request with the same id is the same request (idempotent, C9). */
  pageId: string;
  origin: string;
  host: string;
  tabId: number;
  /** sender.documentId where the browser reports it (Chrome 106+), else null. */
  documentId: string | null;
  type: EntryType;
  /** signMessage: the account it names and the message, base64. */
  account: string | null;
  message: string | null;
  arrivedAt: number;
  state: 'queued' | 'deciding' | 'answered';
  /** The worker instance that wrote `deciding` (C17): another instance's `deciding` entry is a restart. */
  decidedBy: string | null;
  /** When `deciding` was written (review 1 M1): an effect that has not answered DECIDING_TTL_MS later is dead. */
  decidingAt: number | null;
  decision: {kind: Decision; account: string | null; scope: Grant['scope'] | null} | null;
  answer: Answer | null;
  answeredAt: number | null;
}

export interface Undo {
  token: string;
  grant: Grant;
  expiresAt: number;
}

export interface DappSession {
  queue: Entry[];
  /** Session grants (scope 'session'). */
  grants: Grant[];
  /** The approval window: its id and the request it last showed (windows.onRemoved rejects only that one). */
  window: {id: number; showing: string | null} | null;
  /** The `opening` marker (§2.3): a windows.create is in flight since this UTC ms. */
  opening: number | null;
  undo: Undo[];
}

export const EMPTY_SESSION: DappSession = {queue: [], grants: [], window: null, opening: null, undo: []};

const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isStr = (x: unknown): x is string => typeof x === 'string';
const isNullStr = (x: unknown): x is string | null => x === null || typeof x === 'string';
const STATES: readonly string[] = ['queued', 'deciding', 'answered'];
const DECISIONS: readonly string[] = ['approve', 'reject', 'report', 'block'];

function answerOf(x: unknown): Answer | null | undefined {
  if (x === null) return null;
  if (typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  if (typeof o.error === 'string') return (ERROR_CODES as readonly string[]).includes(o.error) ? {error: o.error as ErrorCode} : undefined;
  return typeof o.result === 'object' && o.result !== null && !Array.isArray(o.result) ? {result: o.result as Record<string, unknown>} : undefined;
}

function decisionOf(x: unknown): Entry['decision'] | undefined {
  if (x === null) return null;
  if (typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  if (!isStr(o.kind) || !DECISIONS.includes(o.kind) || !isNullStr(o.account)) return undefined;
  if (o.scope !== null && o.scope !== 'session' && o.scope !== 'persistent') return undefined;
  return {kind: o.kind as Decision, account: o.account, scope: o.scope};
}

/** A stored entry, rebuilt field by field; null when anything is off (it is dropped, never "repaired"). */
export function entryOf(x: unknown): Entry | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (!isStr(o.requestId) || !isStr(o.pageId) || !isStr(o.origin) || !isStr(o.host) || !isTime(o.tabId) || !isNullStr(o.documentId)) return null;
  if ((o.type !== 'connect' && o.type !== 'signMessage') || !isNullStr(o.account) || !isNullStr(o.message) || !isTime(o.arrivedAt)) return null;
  if (!isStr(o.state) || !STATES.includes(o.state) || !isNullStr(o.decidedBy) || (o.answeredAt !== null && !isTime(o.answeredAt))) return null;
  if (o.decidingAt !== null && !isTime(o.decidingAt)) return null;
  const decision = decisionOf(o.decision);
  const answer = answerOf(o.answer);
  if (decision === undefined || answer === undefined) return null;
  return {
    requestId: o.requestId,
    pageId: o.pageId,
    origin: o.origin,
    host: o.host,
    tabId: o.tabId,
    documentId: o.documentId,
    type: o.type,
    account: o.account,
    message: o.message,
    arrivedAt: o.arrivedAt,
    state: o.state as Entry['state'],
    decidedBy: o.decidedBy,
    decidingAt: o.decidingAt,
    decision,
    answer,
    answeredAt: o.answeredAt as number | null,
  };
}

export async function readDappSession(ext: Ext): Promise<DappSession> {
  const v = await ext.session.get(DAPP_SESSION_KEY);
  if (typeof v !== 'object' || v === null) return {...EMPTY_SESSION};
  const o = v as Record<string, unknown>;
  const queue = Array.isArray(o.queue) ? (o.queue as unknown[]).map(entryOf).filter((e): e is Entry => e !== null) : [];
  const w = o.window as {id?: unknown; showing?: unknown} | null | undefined;
  const window = typeof w === 'object' && w !== null && isTime(w.id) && isNullStr(w.showing) ? {id: w.id, showing: w.showing} : null;
  const undo: Undo[] = [];
  for (const u of Array.isArray(o.undo) ? (o.undo as unknown[]) : []) {
    if (typeof u !== 'object' || u === null) continue;
    const {token, grant, expiresAt} = u as Record<string, unknown>;
    const g = typeof grant === 'object' && grant !== null ? grantOf(grant, (grant as {scope?: unknown}).scope === 'session' ? 'session' : 'persistent') : null;
    if (isStr(token) && g !== null && isTime(expiresAt)) undo.push({token, grant: g, expiresAt});
  }
  return {
    queue,
    grants: grantsOf(o.grants, 'session', MAX_GRANTS),
    window,
    opening: isTime(o.opening) ? o.opening : null,
    undo,
  };
}

/** What a section sees and may change. `s`, `grants`, `blocked` and `limits` are written back when changed. */
export interface Tx {
  s: DappSession;
  /** Persistent grants, newest first. */
  grants: Grant[];
  blocked: Blocked[];
  limits: Limits;
  /** The unlocked session's accounts, or null while locked — as of this section. */
  session: SessionAccount[] | null;
  now: number;
}

const dappMutex = createMutex();

export async function dappSection<T>(ext: Ext, now: number, fn: (tx: Tx) => Promise<T> | T): Promise<T> {
  return dappMutex(() =>
    sessionMutex(async () => {
      const [s, grants, blocked, limits, session] = await Promise.all([
        readDappSession(ext),
        ext.local.get(GRANTS_KEY),
        ext.local.get(BLOCKED_KEY),
        ext.local.get(LIMITS_KEY),
        getSession(ext),
      ]);
      const tx: Tx = {s, grants: grantsOf(grants, 'persistent', MAX_GRANTS), blocked: blockedOf(blocked), limits: limitsOf(limits, now), session, now};
      const before = {s: JSON.stringify(tx.s), grants: JSON.stringify(tx.grants), blocked: JSON.stringify(tx.blocked), limits: JSON.stringify(tx.limits)};
      const out = await fn(tx);
      if (JSON.stringify(tx.s) !== before.s) await ext.session.set(DAPP_SESSION_KEY, tx.s);
      if (JSON.stringify(tx.grants) !== before.grants) await ext.local.set(GRANTS_KEY, tx.grants);
      if (JSON.stringify(tx.blocked) !== before.blocked) await ext.local.set(BLOCKED_KEY, tx.blocked);
      if (JSON.stringify(tx.limits) !== before.limits) await ext.local.set(LIMITS_KEY, tx.limits);
      return out;
    }),
  );
}

/** The grant an origin holds now (session first — there is at most one per origin across both), or null. */
export function grantIn(tx: Pick<Tx, 's' | 'grants'>, origin: string): Grant | null {
  return tx.s.grants.find(g => g.origin === origin) ?? tx.grants.find(g => g.origin === origin) ?? null;
}

/** Removes an origin's grant, both scopes; the removed grant, or null. */
export function dropGrant(tx: Pick<Tx, 's' | 'grants'>, origin: string): Grant | null {
  const g = grantIn(tx, origin);
  tx.s.grants = tx.s.grants.filter(x => x.origin !== origin);
  tx.grants = tx.grants.filter(x => x.origin !== origin);
  return g;
}

/** Writes a grant in its scope (replacing the origin's grant in either), newest first. */
export function putGrant(tx: Pick<Tx, 's' | 'grants'>, g: Grant): void {
  dropGrant(tx, g.origin);
  if (g.scope === 'session') tx.s.grants = [g, ...tx.s.grants];
  else tx.grants = [g, ...tx.grants];
}
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/background/__tests__/forgetWallet.test.ts src/background/dapp/__tests__/store.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  3 passed (3) · Tests  456 passed (456); tsc clean; whole suite Test Files  142 passed (142) · Tests  2850 passed (2850); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M2a** — WALLET_DATA_KEYS without the grants (C11) — `extension/src/background/accountsStore.ts`:

  ```diff
  - CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY];
  + CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY].filter(k => k !== GRANTS_KEY);
  ```
  `timeout 300 npx vitest run src/background/__tests__/forgetWallet.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 28 passed (30)).

- **M2b** — the cooldown only after a fourth rejection — `extension/src/background/dapp/limits.ts`:

  ```diff
  - count(next, k) >= REJECTIONS_FOR_COOLDOWN
  + count(next, k) > REJECTIONS_FOR_COOLDOWN
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/store.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  3 failed | 8 passed (11)).

- **M2c** — rejections counted per host only (a tab hops origins, review 2 H2) — `extension/src/background/dapp/limits.ts`:

  ```diff
  - export function withRejection(l: Limits, host: string, tabId: number, now: number): Limits {
  -   const keys = [hostKey(host), tabKey(tabId)];
  + export function withRejection(l: Limits, host: string, tabId: number, now: number): Limits {
  +   const keys = [hostKey(host)];
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/store.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 9 passed (11)).

- **M2d** — the window budget allows an eleventh window — `extension/src/background/dapp/limits.ts`:

  ```diff
  - prune(l, now).windows.length < WINDOW_BUDGET
  + prune(l, now).windows.length <= WINDOW_BUDGET
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/store.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 10 passed (11)).

- **M2e** — the blocked list never drops its oldest — `extension/src/background/dapp/blocked.ts`:

  ```diff
  - return [{host, blockedAt: now, imitates}, ...list.filter(b => b.host !== host)].slice(0, MAX_BLOCKED);
  + return [{host, blockedAt: now, imitates}, ...list.filter(b => b.host !== host)];
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/store.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 10 passed (11)).

- **M2f** — the gate stops owning v1_dapp_limits — `extension/scripts/check-vault-isolation.mjs`:

  ```diff
  - 'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits',
  + 'v1_dapp_grants', 'v1_dapp_blocked',
  ```
  `timeout 300 npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 416 passed (417)).

- [ ] **Step 6: Commit.**

```bash
git add extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/check-vault-isolation.mjs extension/src/background/__tests__/forgetWallet.test.ts extension/src/background/accountsStore.ts extension/src/background/dapp/__tests__/store.test.ts extension/src/background/dapp/blocked.ts extension/src/background/dapp/grants.ts extension/src/background/dapp/limits.ts extension/src/background/dapp/store.ts
git commit -F - <<'MSG'
feat(extension): B1c stores — grants, blocked hosts, limits, the queue mutex; wiped on delete, kept on restore

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 3: The PAGE partition and the request lifecycle: the origin rule for ports and messages, the port registry, the queue (C3, C4, C9, C17's restart rule, documentId), delivery, resume and ack, the approval window's opening, connect and disconnect

**Spec:** §1.3, §1.4 (page messages, events), §1.5 steps 1, 3–6, §1.6, §2.2 (connect rows), §2.3 (opening the window, a document that goes away, `windows.onRemoved`, expiry), C2, C3, C4, C8, C9, C14 (the budget), C16, C17 (the restart rule); §5; §6.1 "Origin rule", "Partitions", "Lifecycle", "Queue and limits"; Review Focus 1, 3; plan review 1 M1, L3, L10

**Files:**
- Test: `extension/src/background/__tests__/fakeExt.ts`
- Test: `extension/src/background/__tests__/start.test.ts`
- Test: `extension/src/background/dapp/__tests__/lifecycle.test.ts` (new)
- Test: `extension/src/background/dapp/__tests__/pageHarness.ts` (new)
- Create: `extension/src/background/dapp/pageApi.ts`
- Create: `extension/src/background/dapp/ports.ts`
- Create: `extension/src/background/dapp/queue.ts`
- Create: `extension/src/background/dapp/window.ts`
- Modify: `extension/src/background/index.ts`
- Modify: `extension/src/background/messages.ts`
- Modify: `extension/src/ext.ts`

**Interfaces:**
- Consumes: Task 2's `dappSection`, `grantIn`, `dropGrant`, `putGrant`, `Entry`, `isBlocked`, `inCooldown`, `budgetLeft`, `withWindow`, `withRejection`, `withRecent`.
- Produces (as exported):
  - `ext.ts`: `interface WindowsApi {create(o: {page; width; height}): Promise<number | null>; exists(id): Promise<boolean>; remove(id): Promise<void>}`, `Ext.dappWindows`.
  - `fakeExt.ts`: `fakeExt().approval: FakeWindows` (`created`, `removed`, `open`, `failNext`, `hold()`).
  - `ports.ts`: `PAGE_PORT = 'noctura-page'`, `interface PageSenderInfo`, `interface PortLike`, `interface PageOrigin {tabId; origin; host; documentId}`, `pageOrigin(ext, sender)`, `interface LivePort`, `interface Runtime {instance; ports}`, `runtimeFor(ext)`, `restartRuntime(ext)` (tests only), `deliver(ext, entries)`, `sendChange(ext, changes)`, `liveOrigins(ext)`, `owns(p, e)`.
  - `queue.ts`: `REQUEST_TTL_MS`, `DECIDING_TTL_MS = 30_000` (rev 2), `ANSWER_TTL_MS`, `MAX_OPEN = 5`, `QUEUE_ALARM = 'dapp-queue'`, `QUEUE_TICK_MINUTES`, `isOpenEntry`, `headOf(tx)`, `newRequestId(deps)`, `interface Effects {answered; changes}`, `answer(fx, e, a, now)`, `userRejected(tx, fx, e)`, `rejectQueued(tx, fx, match)`, `sweep(tx, fx, instance)`, `documentChanged(tx, fx, p)`, `queueAccess(ext, deps, fn)`.
  - `window.ts`: `APPROVE_PAGE`, `WINDOW_WIDTH = 412`, `WINDOW_HEIGHT = 720`, `OPENING_STALE_MS`, `ensureWindow(ext, deps)`, `onApprovalWindowRemoved(ext, deps, id)`, `onQueueAlarm(ext, deps)`.
  - `pageApi.ts`: `PAGE_TYPES`, `type PageType`, `MAX_RESUME`, `LAST_USED_STEP_MS = 60_000` (rev 2), `onPageMessage(ext, deps, live, m)`, `acceptPagePort(ext, deps, port): LivePort | null`.
  - `messages.ts`: `Sender` gains `documentId?`, `documentLifecycle?`; `PAGE = PAGE_TYPES`.
  - `pageHarness.ts` (tests): `fakePort`, `TAB`, `senderFor`, `interface Page {port; live; ask; answersFor; changes}`, `openPage(ext, deps, origin, over?)`, `settle()`.

Spec §1.3–§1.5 as code. A port named `noctura-page` whose `port.sender` passes the origin rule — this extension's id, a tab, frame 0, an `https:` origin exactly as the browser serialises it (no path, no credentials; an IP literal with a port is fine), an active document where the browser reports one, and **never** `sender.url` — is registered keyed `(tabId, origin)`; any other port is disconnected at once. Page types arrive only on the port: through `runtime.sendMessage` they are refused from anyone (R7). Every access to the queue is one `queueAccess`: a `dappSection` that first sweeps (C4's expiry from `arrivedAt` — "queued or shown": a `deciding` entry too —, C17's rule — a `deciding` entry another worker instance wrote is answered `rejected`, and so is one of this instance still `deciding` 30 s after it was written: its effect died between its sections (review 1 M1, R38) —, the ten-minute cleanup, expired undo records), then the caller's change; after the commit, answers are delivered on every live port of that `(tabId, origin)` and `change` events sent, and the 30-second expiry alarm re-armed while anything is queued. A request is idempotent by the relay's own id (C9): re-sent after a lost connection, it is the same entry. C3: one open request per host and per tab, five in total. An accepted request moves its grant's `lastUsedAt` at most once a minute (review 1 L3, R36). A new port or request from a tab whose `documentId` changed answers the old document's queued requests `rejected` (§2.3; Firefox reports none — the per-tab caps bound it). The window opens in three steps around an `opening` marker (§2.3): a failed `windows.create` clears it in a `finally`, a marker older than 10 s is stale, a recorded id is checked with `windows.get` first; beyond C14's budget every request that would need the window is rejected with no window and the next one carries the notice (R12). Closing the window rejects only the request it showed (and counts it for C14), then reopens for the rest (R13).

`page.signMessage` is not handled yet (Task 6): until then it is refused as `invalid-request` like any other unknown type. The unlock hook comes in Task 5; the window's `dapp.pending` (which records the shown request) in Task 4 — this task's tests set `showing` themselves.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/fakeExt.ts`:

````diff
diff --git a/extension/src/background/__tests__/fakeExt.ts b/extension/src/background/__tests__/fakeExt.ts
--- a/extension/src/background/__tests__/fakeExt.ts
+++ b/extension/src/background/__tests__/fakeExt.ts
@@ -18,9 +18,61 @@ export function memKV(): KV & {data: Map<string, unknown>} {
   };
 }
 
+/**
+ * B1c: the approval windows the background opened. `failNext` makes the next create reject; `open` is the set a
+ * windows.get would find; `created` and `removed` record every call.
+ */
+export interface FakeWindows {
+  created: {page: string; width: number; height: number}[];
+  removed: number[];
+  open: Set<number>;
+  failNext: boolean;
+  /** Holds every create until the returned function is called (a create in flight). */
+  hold(): () => void;
+}
+
+function fakeWindows(): FakeWindows & {api: Ext['dappWindows']} {
+  let next = 100;
+  let gate: Promise<void> | null = null;
+  const w: FakeWindows & {api: Ext['dappWindows']} = {
+    created: [],
+    removed: [],
+    open: new Set(),
+    failNext: false,
+    hold() {
+      let release = () => undefined as void;
+      gate = new Promise<void>(r => (release = r));
+      return () => {
+        gate = null;
+        release();
+      };
+    },
+    api: {
+      create: async o => {
+        if (gate !== null) await gate;
+        if (w.failNext) {
+          w.failNext = false;
+          throw new Error('windows.create failed');
+        }
+        w.created.push(o);
+        const id = next++;
+        w.open.add(id);
+        return id;
+      },
+      exists: async id => w.open.has(id),
+      remove: async id => {
+        w.removed.push(id);
+        if (!w.open.delete(id)) throw new Error(`no window with id: ${id}`);
+      },
+    },
+  };
+  return w;
+}
+
 export function fakeExt(windows = 1) {
   const alarms = new Map<string, number>();
-  const ext: Ext & {alarmsSet: Map<string, number>; windows: number} = {
+  const win = fakeWindows();
+  const ext: Ext & {alarmsSet: Map<string, number>; windows: number; approval: FakeWindows} = {
     runtimeId: 'abcdefghijklmnopabcdefghijklmnop',
     extensionOrigin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
     session: memKV(),
@@ -33,8 +85,10 @@ export function fakeExt(windows = 1) {
     },
     windowCount: async () => ext.windows,
     pinSessionAccess: async () => undefined,
+    dappWindows: win.api,
     alarmsSet: alarms,
     windows,
+    approval: win,
   };
   return ext;
 }
````

Modify `extension/src/background/__tests__/start.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/start.test.ts b/extension/src/background/__tests__/start.test.ts
--- a/extension/src/background/__tests__/start.test.ts
+++ b/extension/src/background/__tests__/start.test.ts
@@ -12,7 +12,7 @@ describe('background start', () => {
     const on = (name: string) => ({addListener: () => void listeners.push(name)});
     const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
     vi.stubGlobal('chrome', {
-      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onStartup: on('onStartup'), onInstalled: on('onInstalled')},
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onConnect: on('onConnect'), onStartup: on('onStartup'), onInstalled: on('onInstalled')},
       tabs: {create: async () => undefined},
       storage: {session: {...area(), setAccessLevel: async (o: unknown) => void accessLevels.push(o)}, local: area()},
       alarms: {create: () => undefined, clear: async () => true, onAlarm: on('onAlarm')},
@@ -20,7 +20,7 @@ describe('background start', () => {
     });
     await import('../index');
     expect(accessLevels).toEqual([{accessLevel: 'TRUSTED_CONTEXTS'}]);
-    expect(listeners.sort()).toEqual(['onAlarm', 'onInstalled', 'onMessage', 'onRemoved', 'onStartup']);
+    expect(listeners.sort()).toEqual(['onAlarm', 'onConnect', 'onInstalled', 'onMessage', 'onRemoved', 'onStartup']);
   });
 
   // Fable re-review: pinSessionAccess() was fired with `void`, not awaited or caught — a
@@ -34,7 +34,7 @@ describe('background start', () => {
     const warnings: unknown[] = [];
     vi.spyOn(console, 'warn').mockImplementation((...args) => void warnings.push(args));
     vi.stubGlobal('chrome', {
-      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onStartup: on('onStartup'), onInstalled: on('onInstalled')},
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('onMessage'), onConnect: on('onConnect'), onStartup: on('onStartup'), onInstalled: on('onInstalled')},
       tabs: {create: async () => undefined},
       storage: {
         session: {
@@ -52,7 +52,7 @@ describe('background start', () => {
     // Let the rejected pinSessionAccess() promise's .catch handler run.
     await Promise.resolve();
     await Promise.resolve();
-    expect(listeners.sort()).toEqual(['onAlarm', 'onInstalled', 'onMessage', 'onRemoved', 'onStartup']);
+    expect(listeners.sort()).toEqual(['onAlarm', 'onConnect', 'onInstalled', 'onMessage', 'onRemoved', 'onStartup']);
     expect(warnings).toEqual([['storage.session access level not pinned', expect.any(Error)]]);
   });
 
@@ -85,7 +85,7 @@ describe('background start', () => {
       });
       const on = () => ({addListener: () => undefined});
       vi.stubGlobal('chrome', {
-        runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onStartup: on(), onInstalled: on()},
+        runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onConnect: on(), onStartup: on(), onInstalled: on()},
         tabs: {create: async () => undefined},
         storage: {
           session: {get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined, setAccessLevel: async () => undefined},
@@ -131,7 +131,7 @@ describe('background start', () => {
     const on = () => ({addListener: () => undefined});
     const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
     vi.stubGlobal('chrome', {
-      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onStartup: on(), onInstalled: on()},
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onConnect: on(), onStartup: on(), onInstalled: on()},
       tabs: {create: async () => undefined},
       storage: {session: {...area(), setAccessLevel: async () => undefined}, local: area()},
       alarms: {create: (name: string) => void created.push(name), clear: async () => true, onAlarm: on()},
@@ -155,6 +155,7 @@ describe('background start', () => {
         id: 'x',
         getURL: (p: string) => `https://ext.example/${p}`,
         onMessage: on(),
+        onConnect: on(),
         onStartup: on(),
         onInstalled: {addListener: (cb: (d: {reason: string}) => void) => void (installed = cb)},
       },
````

Create `extension/src/background/dapp/__tests__/lifecycle.test.ts`:

````ts
import {handleMessage} from '../../messages';
import {lock} from '../../autolock';
import {getSession, setSession} from '../../session';
import {GRANTS_KEY, type Grant} from '../grants';
import {BLOCKED_KEY} from '../blocked';
import {LIMITS_KEY, WINDOW_BUDGET} from '../limits';
import {DECIDING_TTL_MS, MAX_OPEN, QUEUE_ALARM, REQUEST_TTL_MS, ANSWER_TTL_MS} from '../queue';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {OPENING_STALE_MS, WINDOW_HEIGHT, WINDOW_WIDTH, ensureWindow, onApprovalWindowRemoved, onQueueAlarm} from '../window';
import {restartRuntime, runtimeFor} from '../ports';
import {LAST_USED_STEP_MS, acceptPagePort} from '../pageApi';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT} from '../../__tests__/fixtures';
import {TAB, fakePort, openPage, senderFor, settle} from './pageHarness';

const DAPP = 'https://dapp.test';
const OTHER = 'https://other.test';
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});

async function setup(o: {unlocked?: boolean} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  if (o.unlocked !== false) await setSession(ext, [ACCOUNT]);
  return {ext, deps};
}
const queue = async (ext: ReturnType<typeof fakeExt>) => (await readDappSession(ext)).queue;
const connect = (id: string, silent = false) => ({type: 'page.connect', id, silent});

// Spec §1.3–§1.6, §2.2, §2.3, C3, C4, C9, C14, C16, C17 — the PAGE partition and the request lifecycle, against the
// real background (fake chrome.* only).
describe('the origin rule, for ports (§1.3, §6.1)', () => {
  it('refuses an iframe, http:, a "null" or opaque origin, a foreign sender.id, no tab, a prerendered document — and accepts a top frame (positive control)', async () => {
    const {ext, deps} = await setup();
    const refused = [
      senderFor(ext, DAPP, {frameId: 1}),
      senderFor(ext, 'http://dapp.test'),
      senderFor(ext, 'null'),
      senderFor(ext, 'data:text/html,x'),
      senderFor(ext, DAPP, {id: 'another-extension-id'}),
      {...senderFor(ext, DAPP), tab: undefined},
      senderFor(ext, DAPP, {documentLifecycle: 'prerender'}),
      senderFor(ext, 'https://dapp.test/path'),
      senderFor(ext, 'https://user@dapp.test'),
      {...senderFor(ext, DAPP), origin: undefined},
    ];
    for (const s of refused) {
      const port = fakePort(s);
      expect([s, acceptPagePort(ext, deps, port)]).toEqual([s, null]);
      expect(port.disconnected).toBe(true);
    }
    expect(runtimeFor(ext).ports.size).toBe(0);
    const ok = fakePort(senderFor(ext, DAPP));
    expect(acceptPagePort(ext, deps, ok)).toMatchObject({tabId: TAB, origin: DAPP, host: 'dapp.test', documentId: 'doc-1'});
    expect(ok.disconnected).toBe(false);
    // A lifecycle the browser does not report (Firefox) is no refusal.
    expect(acceptPagePort(ext, deps, fakePort({...senderFor(ext, DAPP), documentLifecycle: undefined}))).not.toBeNull();
  });

  // Review Focus 1: an IP literal with a port — the origin as the browser serialises it, the bracketed host.
  it('an IP-literal origin with a port is accepted and keyed exactly; its request queues like any other', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, 'https://[2001:db8::1]:8443');
    expect([page.live.origin, page.live.host]).toEqual(['https://[2001:db8::1]:8443', '[2001:db8::1]']);
    expect(await page.ask(connect('c1'))).toMatchObject({accepted: true});
    expect((await queue(ext)).map(e => [e.origin, e.host])).toEqual([['https://[2001:db8::1]:8443', '[2001:db8::1]']]);
  });

  it('keys the port from sender.origin — a forged sender.url is never read', async () => {
    const {ext, deps} = await setup();
    const live = acceptPagePort(ext, deps, fakePort(senderFor(ext, 'https://evil.test', {url: 'https://jup.ag/'})));
    expect(live?.origin).toBe('https://evil.test');
    expect(live?.host).toBe('evil.test');
  });

  it('refuses a port of another name', async () => {
    const {ext, deps} = await setup();
    const port = fakePort(senderFor(ext, DAPP), 'other');
    expect(acceptPagePort(ext, deps, port)).toBeNull();
    expect(port.disconnected).toBe(true);
  });
});

describe('the partitions (§1.3, §6.1)', () => {
  it('a page type through runtime.sendMessage is refused — from an extension page and from a content script', async () => {
    const {ext, deps} = await setup();
    const popup = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`};
    expect(await handleMessage(ext, connect('a'), popup, deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await handleMessage(ext, connect('a'), {...senderFor(ext, DAPP)}, deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await queue(ext)).toEqual([]);
  });

  it('a privileged type on a page port is refused: vault.lock from a page locks nothing; a later-plan type is refused too', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    expect(await page.ask({type: 'vault.lock', id: 'x1'})).toEqual({id: 'x1', error: 'invalid-request'});
    expect(await page.ask({type: 'page.signTransaction', id: 'x2'})).toEqual({id: 'x2', error: 'invalid-request'});
    expect(await getSession(ext)).not.toBeNull();
  });

  it('a privileged message from a content script (sender.id ours, origin a web page) is forbidden', async () => {
    const {ext, deps} = await setup();
    expect(await handleMessage(ext, {type: 'vault.lock'}, senderFor(ext, DAPP), deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await getSession(ext)).not.toBeNull();
  });
});

describe('connect (§2.2) — silent and explicit, with and without a grant, locked and unlocked', () => {
  it('silent: [] without a grant, [account] with one while unlocked, [] while locked even for a persistent grant — never a window', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    expect(await page.ask(connect('s1', true))).toEqual({id: 's1', result: {accounts: []}});
    await ext.local.set(GRANTS_KEY, [grant(DAPP)]);
    deps.clock.t += 5;
    expect(await page.ask(connect('s2', true))).toEqual({id: 's2', result: {accounts: [ACCOUNT.publicKey]}});
    expect(((await ext.local.get(GRANTS_KEY)) as Grant[])[0]?.lastUsedAt).toBe(deps.clock.t);
    await lock(ext);
    expect(await page.ask(connect('s3', true))).toEqual({id: 's3', result: {accounts: []}});
    expect(ext.approval.created).toEqual([]);
    expect(await queue(ext)).toEqual([]);
  });

  it('explicit with a grant while unlocked: the account at once, no window (§2.2 row 3)', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(DAPP)]);
    expect(await openPage(ext, deps, DAPP).ask(connect('c1'))).toEqual({id: 'c1', result: {accounts: [ACCOUNT.publicKey]}});
    expect(ext.approval.created).toEqual([]);
  });

  it('explicit without a grant: queued, accepted with a 128-bit requestId, and the approval window opens at 412 × 720', async () => {
    const {ext, deps} = await setup();
    const r = await openPage(ext, deps, DAPP).ask(connect('c1'));
    expect(r).toEqual({id: 'c1', accepted: true, requestId: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/)});
    expect(await queue(ext)).toMatchObject([{requestId: r?.requestId, pageId: 'c1', origin: DAPP, host: 'dapp.test', tabId: TAB, documentId: 'doc-1', type: 'connect', state: 'queued', arrivedAt: deps.clock.t}]);
    expect(ext.approval.created).toEqual([{page: 'approve.html', width: WINDOW_WIDTH, height: WINDOW_HEIGHT}]);
    expect([WINDOW_WIDTH, WINDOW_HEIGHT]).toEqual([412, 720]);
    expect((await readDappSession(ext)).window).toEqual({id: 100, showing: null});
    expect(ext.alarmsSet.has(QUEUE_ALARM)).toBe(true);
  });

  it('explicit while locked, no grant: queued (the window shows "locked", D11)', async () => {
    const {ext, deps} = await setup({unlocked: false});
    expect(await openPage(ext, deps, DAPP).ask(connect('c1'))).toMatchObject({accepted: true});
    expect(ext.approval.created).toHaveLength(1);
  });

  it('a re-sent request (the same relay id, tab and origin) is the same request — C9, never a second entry', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const a = await page.ask(connect('c1'));
    const b = await openPage(ext, deps, DAPP).ask(connect('c1'));
    expect(b).toEqual(a);
    expect(await queue(ext)).toHaveLength(1);
  });

  it('malformed: no id or a bad silent flag — invalid-request when there is an id to answer, else nothing', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    expect(await page.ask({type: 'page.connect', id: 'c1', silent: 'yes'})).toEqual({id: 'c1', error: 'invalid-request'});
    expect(await page.ask({type: 'page.connect', id: 'has space', silent: false})).toBeUndefined();
    expect(await queue(ext)).toEqual([]);
  });
});

describe('C3 — one open request per host and per tab, five in total, FIFO across origins', () => {
  it('a second from the same host (another tab) or the same tab (another host) gets request-pending; the sixth gets busy', async () => {
    const {ext, deps} = await setup();
    expect(await openPage(ext, deps, DAPP).ask(connect('a'))).toMatchObject({accepted: true});
    expect(await openPage(ext, deps, DAPP, {tab: {id: 8}}).ask(connect('b'))).toEqual({id: 'b', error: 'request-pending'});
    expect(await openPage(ext, deps, OTHER).ask(connect('c'))).toEqual({id: 'c', error: 'request-pending'});
    for (let i = 1; i < MAX_OPEN; i++) expect(await openPage(ext, deps, `https://s${i}.test`, {tab: {id: 100 + i}}).ask(connect(`q${i}`))).toMatchObject({accepted: true});
    expect(await openPage(ext, deps, 'https://six.test', {tab: {id: 200}}).ask(connect('q6'))).toEqual({id: 'q6', error: 'busy'});
    expect((await queue(ext)).map(e => e.origin)).toEqual([DAPP, 'https://s1.test', 'https://s2.test', 'https://s3.test', 'https://s4.test']);
    // One window for all of them (C3: no stacked windows).
    expect(ext.approval.created).toHaveLength(1);
  });

  it('a page sending a thousand requests at once: the first is queued, the rest request-pending (§5)', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const out = await Promise.all(Array.from({length: 1000}, (_, i) => page.ask(connect(`m${i}`))));
    expect(out.filter(r => r?.accepted === true)).toHaveLength(1);
    expect(out.filter(r => r?.error === 'request-pending')).toHaveLength(999);
  });
});

describe('delivery, resume and ack (§1.5, C9)', () => {
  async function shownThenClosed() {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    const requestId = String(r?.requestId);
    // The window showed it (dapp.pending records that, Task 4), and the user closed the window.
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: requestId}});
    ext.approval.open.delete(100);
    await onApprovalWindowRemoved(ext, deps, 100);
    return {ext, deps, page, requestId};
  }

  it('the answer is delivered on every live port of that (tabId, origin) — and only there', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const twin = openPage(ext, deps, DAPP);
    const elsewhere = openPage(ext, deps, DAPP, {tab: {id: 9}});
    const r = await page.ask(connect('c1'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: r?.requestId}});
    await onApprovalWindowRemoved(ext, deps, 100);
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(twin.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(elsewhere.answersFor(String(r?.requestId))).toEqual([]);
  });

  it('a port that was down resumes: the stored answer, once acked gone; a foreign port gets unknown and its ack deletes nothing', async () => {
    const {ext, deps, page, requestId} = await shownThenClosed();
    page.port.drop();
    expect(runtimeFor(ext).ports.size).toBe(0);
    const back = openPage(ext, deps, DAPP);
    expect(await back.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, error: 'rejected'}]});
    // Another tab of the same origin, and another origin in the same tab, own nothing of it.
    const foreign = openPage(ext, deps, DAPP, {tab: {id: 9}});
    expect(await foreign.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, unknown: true}]});
    await foreign.ask({type: 'page.ack', requestId});
    await openPage(ext, deps, OTHER).ask({type: 'page.ack', requestId});
    expect((await queue(ext)).map(e => e.requestId)).toEqual([requestId]);
    // Positive control: the owner's ack deletes it.
    await back.ask({type: 'page.ack', requestId});
    expect(await queue(ext)).toEqual([]);
    expect(await back.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, unknown: true}]});
  });

  it('a still-open request resumes as pending; a worker restart keeps it (storage, not memory) — the old port is gone', async () => {
    const {ext, deps} = await setup();
    const r = await openPage(ext, deps, DAPP).ask(connect('c1'));
    restartRuntime(ext);
    expect(runtimeFor(ext).ports.size).toBe(0);
    const back = openPage(ext, deps, DAPP);
    expect(await back.ask({type: 'page.resume', requestIds: [r?.requestId]})).toEqual({resume: [{requestId: r?.requestId, pending: true}]});
  });

  it('an answered entry nobody acks is deleted ten minutes after its answer', async () => {
    const {ext, deps, requestId} = await shownThenClosed();
    deps.clock.t += ANSWER_TTL_MS - 1;
    await onQueueAlarm(ext, deps);
    expect((await queue(ext)).map(e => e.requestId)).toEqual([requestId]);
    deps.clock.t += 1;
    await onQueueAlarm(ext, deps);
    expect(await queue(ext)).toEqual([]);
    expect(ext.alarmsSet.has(QUEUE_ALARM)).toBe(false);
  });

  it('page.resume and page.ack with malformed ids do nothing', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    expect(await page.ask({type: 'page.resume', requestIds: 'x'})).toBeUndefined();
    expect(await page.ask({type: 'page.resume', requestIds: Array.from({length: 17}, () => 'A'.repeat(22))})).toBeUndefined();
    expect(await page.ask({type: 'page.ack', requestId: 42})).toBeUndefined();
    expect(await page.ask({type: 'page.ping'})).toBeUndefined();
  });
});

describe('expiry (C4) and the worker-restart rule (C17)', () => {
  it('a request is answered timeout five minutes after it arrived — by the alarm or by any queue access', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    deps.clock.t += REQUEST_TTL_MS - 1;
    await onQueueAlarm(ext, deps);
    expect(page.answersFor(String(r?.requestId))).toEqual([]);
    deps.clock.t += 1;
    await page.ask(connect('silent', true));
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'timeout'}]);
  });

  it('a deciding entry another worker instance wrote is answered rejected at the next access — nothing left the extension', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'a-dead-instance', decidingAt: deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: 'session'}}))});
    await page.ask(connect('s', true));
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    // Positive control: this instance's own deciding entry is left alone (its effect is running).
    const t = await openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('c2'));
    const s2 = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s2, queue: s2.queue.map(e => (e.requestId === t?.requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(ext).instance, decidingAt: deps.clock.t} : e))});
    await page.ask(connect('s2', true));
    expect((await queue(ext)).find(e => e.requestId === t?.requestId)?.state).toBe('deciding');
  });
});

describe('a deciding entry that never answers (review 1 M1)', () => {
  /** A request of DAPP made `deciding` by this instance at the clock's now, as dapp.decide writes it — and then nothing. */
  async function stuck() {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    const requestId = String(r?.requestId);
    const s = await readDappSession(ext);
    const decision = {kind: 'approve', account: ACCOUNT.publicKey, scope: 'session'};
    await ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: runtimeFor(ext).instance, decidingAt: deps.clock.t, decision}))});
    return {ext, deps, page, requestId};
  }

  it('this instance’s deciding entry is answered rejected DECIDING_TTL_MS after deciding — not a millisecond before — and the host may ask again', async () => {
    const c = await stuck();
    c.deps.clock.t += DECIDING_TTL_MS - 1;
    await onQueueAlarm(c.ext, c.deps);
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await queue(c.ext))[0]?.state).toBe('deciding');
    // While it is deciding the host's next request is request-pending (C3) — the wedge the deadline ends.
    expect(await c.page.ask(connect('c2'))).toEqual({id: 'c2', error: 'request-pending'});
    c.deps.clock.t += 1;
    await onQueueAlarm(c.ext, c.deps);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
    expect(await c.page.ask(connect('c3'))).toMatchObject({accepted: true});
  });

  it('C4 "queued or shown": a deciding entry is answered timeout five minutes after it arrived, even when deciding began a moment ago', async () => {
    const c = await stuck();
    c.deps.clock.t += REQUEST_TTL_MS - 10;
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, decidingAt: c.deps.clock.t}))});
    c.deps.clock.t += 10;
    await onQueueAlarm(c.ext, c.deps);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'timeout'}]);
  });
});

describe('lastUsedAt (§2.1, review 1 L3)', () => {
  it('moves at most once a minute: a loop of silent connects is not a grant write each', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(DAPP)]);
    const page = openPage(ext, deps, DAPP);
    const used = async () => ((await ext.local.get(GRANTS_KEY)) as Grant[])[0]?.lastUsedAt;
    const t0 = deps.clock.t;
    await page.ask(connect('s1', true));
    expect(await used()).toBe(t0);
    deps.clock.t += LAST_USED_STEP_MS - 1;
    for (let i = 0; i < 5; i++) await page.ask(connect(`s${i + 2}`, true));
    expect(await used()).toBe(t0);
    deps.clock.t += 1;
    await page.ask(connect('s9', true));
    expect(await used()).toBe(t0 + LAST_USED_STEP_MS);
  });
});

describe('a document that goes away (§2.3, review 2 H2)', () => {
  it('a new port from the same tab with another documentId answers the old document’s queued request rejected', async () => {
    const {ext, deps} = await setup();
    const old = openPage(ext, deps, DAPP);
    const r = await old.ask(connect('c1'));
    openPage(ext, deps, OTHER, {documentId: 'doc-2'});
    await settle();
    expect(old.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
  });

  it('negative control: the same document (or none reported, Firefox) cancels nothing', async () => {
    const {ext, deps} = await setup();
    const old = openPage(ext, deps, DAPP);
    const r = await old.ask(connect('c1'));
    openPage(ext, deps, DAPP);
    openPage(ext, deps, OTHER, {documentId: undefined});
    await settle();
    expect(old.answersFor(String(r?.requestId))).toEqual([]);
  });
});

describe('the approval window (§2.3, C14)', () => {
  it('windows.create rejects → the marker is cleared and the next request opens a window', async () => {
    const {ext, deps} = await setup();
    ext.approval.failNext = true;
    await expect(openPage(ext, deps, DAPP).ask(connect('c1'))).rejects.toThrow('windows.create failed');
    expect((await readDappSession(ext)).opening).toBeNull();
    expect(ext.approval.created).toEqual([]);
    expect(await openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('c2'))).toMatchObject({accepted: true});
    expect(ext.approval.created).toHaveLength(1);
    expect((await readDappSession(ext)).window).toEqual({id: 100, showing: null});
  });

  it('the alarm opens a window for a head that has none (a failed create is not left waiting)', async () => {
    const {ext, deps} = await setup();
    ext.approval.failNext = true;
    await openPage(ext, deps, DAPP)
      .ask(connect('c1'))
      .catch(() => undefined);
    await onQueueAlarm(ext, deps);
    expect(ext.approval.created).toHaveLength(1);
  });

  it('a stale marker (a worker that died mid-create) is cleared at the next queue access and the window opens', async () => {
    const {ext, deps} = await setup();
    await openPage(ext, deps, DAPP).ask(connect('c1'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: null, opening: deps.clock.t - OPENING_STALE_MS + 1});
    await ensureWindow(ext, deps);
    expect(ext.approval.created).toHaveLength(1);
    deps.clock.t += 1;
    await ensureWindow(ext, deps);
    expect(ext.approval.created).toHaveLength(2);
  });

  it('a recorded window that no longer exists is not "open": windows.get fails → a new one opens', async () => {
    const {ext, deps} = await setup();
    await openPage(ext, deps, DAPP).ask(connect('c1'));
    ext.approval.open.clear();
    await ensureWindow(ext, deps);
    expect(ext.approval.created).toHaveLength(2);
    expect((await readDappSession(ext)).window?.id).toBe(101);
  });

  it('two requests racing a window open: one create (the marker)', async () => {
    const {ext, deps} = await setup();
    const release = ext.approval.hold();
    const first = openPage(ext, deps, DAPP).ask(connect('c1'));
    const second = openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('c2'));
    await settle();
    release();
    await Promise.all([first, second]);
    expect(ext.approval.created).toHaveLength(1);
  });

  it('closing the window rejects only the request it showed, only if still queued, and counts it for C14', async () => {
    const {ext, deps} = await setup();
    const a = await openPage(ext, deps, DAPP).ask(connect('a'));
    const b = await openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('b'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: b?.requestId}});
    ext.approval.open.delete(100);
    await onApprovalWindowRemoved(ext, deps, 100);
    expect((await queue(ext)).map(e => [e.requestId, e.state])).toEqual([
      [a?.requestId, 'queued'],
      [b?.requestId, 'answered'],
    ]);
    expect(((await ext.local.get(LIMITS_KEY)) as {rejections: unknown[]}).rejections).toHaveLength(2);
    // The rest of the queue gets a window again.
    expect(ext.approval.created).toHaveLength(2);
    // Another window id is not ours: nothing happens.
    await onApprovalWindowRemoved(ext, deps, 555);
    expect((await queue(ext)).find(e => e.requestId === a?.requestId)?.state).toBe('queued');
  });

  it('C14 budget: beyond ten windows in ten minutes a request is rejected with no window, and the next window carries the notice flag', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: Array.from({length: WINDOW_BUDGET}, () => deps.clock.t), notice: false});
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(ext.approval.created).toEqual([]);
    expect(((await ext.local.get(LIMITS_KEY)) as {notice: boolean}).notice).toBe(true);
  });
});

describe('blocked and cooling-down hosts (§2.6, C14)', () => {
  it('a blocked host is answered rejected at once: no window, no queue entry — whatever its port or scheme', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    expect(await openPage(ext, deps, DAPP).ask(connect('c1'))).toEqual({id: 'c1', error: 'rejected'});
    expect(await openPage(ext, deps, 'https://dapp.test:8443', {tab: {id: 9}}).ask(connect('c2'))).toEqual({id: 'c2', error: 'rejected'});
    expect(await queue(ext)).toEqual([]);
    expect(ext.approval.created).toEqual([]);
  });

  it('a host or a tab in cooldown is answered rejected at once', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: `tab:${TAB}`, until: deps.clock.t + 1}], windows: [], notice: false});
    expect(await openPage(ext, deps, 'https://fresh.test').ask(connect('c1'))).toEqual({id: 'c1', error: 'rejected'});
    expect(await openPage(ext, deps, 'https://fresh.test', {tab: {id: 9}}).ask(connect('c2'))).toMatchObject({accepted: true});
  });
});

describe('page.disconnect (C2)', () => {
  it('removes a persistent grant, rejects the origin’s queued requests and sends change [] to its ports', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(DAPP), grant(OTHER)]);
    const page = openPage(ext, deps, DAPP);
    const twin = openPage(ext, deps, DAPP, {tab: {id: 9}});
    const other = openPage(ext, deps, OTHER, {tab: {id: 10}});
    expect(await page.ask({type: 'page.disconnect', id: 'd1'})).toEqual({id: 'd1', result: {}});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([grant(OTHER)]);
    expect([page.changes(), twin.changes(), other.changes()]).toEqual([[[]], [[]], []]);
    // The next connect asks again (#47).
    expect(await page.ask(connect('c1'))).toMatchObject({accepted: true});
  });
});
````

Create `extension/src/background/dapp/__tests__/pageHarness.ts`:

````ts
import type {WalletDeps} from '../../deps';
import {acceptPagePort, onPageMessage} from '../pageApi';
import type {LivePort, PageSenderInfo, PortLike} from '../ports';
import {fakeExt} from '../../__tests__/fakeExt';

/** A fake runtime.Port: what the background posted, whether it disconnected, and the listeners it registered. */
export interface FakePort extends PortLike {
  posted: Record<string, unknown>[];
  disconnected: boolean;
  /** The relay's side closing the port (fires onDisconnect). */
  drop(): void;
}

export function fakePort(sender: PageSenderInfo, name = 'noctura-page'): FakePort {
  const onDisconnect: (() => void)[] = [];
  const port: FakePort = {
    name,
    sender,
    posted: [],
    disconnected: false,
    postMessage(m) {
      if (port.disconnected) throw new Error('Attempting to use a disconnected port object');
      port.posted.push(m as Record<string, unknown>);
    },
    disconnect() {
      port.disconnected = true;
    },
    onMessage: {addListener: () => undefined},
    onDisconnect: {addListener: cb => void onDisconnect.push(cb)},
    drop() {
      port.disconnected = true;
      for (const cb of onDisconnect) cb();
    },
  };
  return port;
}

export const TAB = 7;
/** What Chrome reports for this extension's relay in a top-level https document (the origin rule's positive control). */
export function senderFor(ext: ReturnType<typeof fakeExt>, origin: string, over: Partial<PageSenderInfo> = {}): PageSenderInfo {
  return {id: ext.runtimeId, origin, url: `${origin}/app`, tab: {id: TAB}, frameId: 0, documentId: 'doc-1', documentLifecycle: 'active', ...over};
}

/** A page: its port, registered as the background registers one; `ask` hands it one message and waits for the handler. */
export interface Page {
  port: FakePort;
  live: LivePort;
  ask(m: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  /** Every message posted to this port that answers `requestId` (late answers), in order. */
  answersFor(requestId: string): Record<string, unknown>[];
  /** Every `change` event posted to this port. */
  changes(): unknown[][];
}

export function openPage(ext: ReturnType<typeof fakeExt>, deps: WalletDeps, origin: string, over: Partial<PageSenderInfo> = {}): Page {
  const port = fakePort(senderFor(ext, origin, over));
  const live = acceptPagePort(ext, deps, port);
  if (live === null) throw new Error(`port refused for ${origin}`);
  return {
    port,
    live,
    async ask(m) {
      const before = port.posted.length;
      await onPageMessage(ext, deps, live, m);
      return port.posted.slice(before).find(x => (typeof m.id === 'string' ? x.id === m.id : 'resume' in x));
    },
    answersFor: requestId => port.posted.filter(x => x.requestId === requestId && !('accepted' in x)),
    changes: () => port.posted.filter(x => x.event === 'change').map(x => x.accounts as unknown[]),
  };
}

/** Lets the background's fire-and-forget work (a port's document check) finish. */
/**
 * Lets fire-and-forget work finish: a port message runs a queue access (two mutexes, five storage reads, the writes,
 * the delivery, the alarm), each await one turn of the fake chrome.* — 20 macrotask turns is about twice what the
 * longest chain here needs (a port open that answers an old document's request, then opens the window).
 */
export async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise<void>(r => setTimeout(r, 0));
}
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/start.test.ts src/background/dapp/__tests__/lifecycle.test.ts
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  2 failed (2) · Tests  2 failed | 3 passed (5). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Create `extension/src/background/dapp/pageApi.ts`:

````ts
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {isBlocked} from './blocked';
import {inCooldown} from './limits';
import {PAGE_PORT, owns, pageOrigin, runtimeFor, type LivePort, type PortLike} from './ports';
import {MAX_OPEN, documentChanged, isOpenEntry, newRequestId, queueAccess, rejectQueued} from './queue';
import {dropGrant, grantIn, putGrant, type Entry, type ErrorCode, type Tx} from './store';
import {ensureWindow} from './window';

/**
 * The PAGE partition's handlers (spec §1.3–§1.6). Page messages arrive only on the `noctura-page` port; the port's
 * sender passed the origin rule when it connected (ports.ts pageOrigin), and every request is keyed `(tabId, origin)`
 * from that report — never from anything the page sends. The relay forwards exactly the method types and originates
 * resume / ack / ping itself (§1.2); a privileged type on a port is refused like any unknown one.
 */
export const PAGE_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.resume', 'page.ack', 'page.ping'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** The relay's own request id (it adds nothing else, §1.2). */
const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** A requestId this background issued: 16 bytes, base64url without padding. */
const REQUEST_ID = /^[A-Za-z0-9_-]{22}$/;
/** At most this many ids in one page.resume (C3 keeps a port's open requests far below it). */
export const MAX_RESUME = 16;

type Reply = {id: string; accepted: true; requestId: string} | {id: string; result: Record<string, unknown>} | {id: string; error: ErrorCode};

function reply(live: LivePort, m: unknown): void {
  try {
    live.port.postMessage(m);
  } catch {
    // The port died meanwhile: the relay re-sends (same id: the same request) or resumes.
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The accounts a grant shows a page right now: its account while unlocked and still in the session (D5), else none. */
function grantedAccount(tx: Tx, origin: string): string | null {
  const g = grantIn(tx, origin);
  if (g === null || tx.session === null || !tx.session.some(a => a.publicKey === g.account)) return null;
  return g.account;
}

/**
 * `lastUsedAt` moves on accepted requests (§2.1) — at most once a minute per grant (review 1 L3): a page's loop of
 * silent connects is not a storage write each, and #49 shows the time to the minute at best.
 */
export const LAST_USED_STEP_MS = 60_000;
function touch(tx: Tx, origin: string): void {
  const g = grantIn(tx, origin);
  if (g !== null && tx.now - g.lastUsedAt >= LAST_USED_STEP_MS) putGrant(tx, {...g, lastUsedAt: tx.now});
}

/** A request the user must answer, after C3's caps; null when it was queued, else the immediate refusal. */
function admit(tx: Tx, live: LivePort): ErrorCode | null {
  const open = tx.s.queue.filter(isOpenEntry);
  if (open.some(e => e.host === live.host || e.tabId === live.tabId)) return 'request-pending';
  if (open.length >= MAX_OPEN) return 'busy';
  return null;
}

function enqueue(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort, id: string, fields: Pick<Entry, 'type' | 'account' | 'message'>): Entry {
  const e: Entry = {
    requestId: newRequestId(deps),
    pageId: id,
    origin: live.origin,
    host: live.host,
    tabId: live.tabId,
    documentId: live.documentId,
    ...fields,
    arrivedAt: tx.now,
    state: 'queued',
    decidedBy: null,
    decidingAt: null,
    decision: null,
    answer: null,
    answeredAt: null,
  };
  tx.s.queue.push(e);
  return e;
}

/** The same request re-sent after a lost connection (same relay id, same tab and origin) is the same request (C9). */
function resent(tx: Tx, live: LivePort, id: string): Entry | null {
  return tx.s.queue.find(e => owns(live, e) && e.pageId === id) ?? null;
}

async function connect(ext: Ext, deps: WalletDeps, live: LivePort, id: string, silent: boolean): Promise<Reply> {
  return queueAccess(ext, deps, (tx, fx): Reply => {
    documentChanged(tx, fx, live);
    const again = resent(tx, live, id);
    if (again !== null) {
      if (again.state === 'answered') fx.answered.push(again);
      return {id, accepted: true, requestId: again.requestId};
    }
    const account = grantedAccount(tx, live.origin);
    // §2.2: a silent connect never opens a window and never tells "locked" from "not granted".
    if (silent) {
      if (account !== null) touch(tx, live.origin);
      return {id, result: {accounts: account === null ? [] : [account]}};
    }
    // §2.6, C14: a blocked or cooling-down host is answered at once — no window, no queue entry.
    if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {id, error: 'rejected'};
    if (account !== null) {
      touch(tx, live.origin);
      return {id, result: {accounts: [account]}};
    }
    const refused = admit(tx, live);
    if (refused !== null) return {id, error: refused};
    return {id, accepted: true, requestId: enqueue(tx, deps, live, id, {type: 'connect', account: null, message: null}).requestId};
  });
}

/** C2: a dApp's disconnect removes its grant, whichever the scope; its queued requests are answered `rejected`. */
async function disconnect(ext: Ext, deps: WalletDeps, live: LivePort, id: string): Promise<Reply> {
  return queueAccess(ext, deps, (tx, fx): Reply => {
    documentChanged(tx, fx, live);
    const dropped = dropGrant(tx, live.origin);
    rejectQueued(tx, fx, e => e.origin === live.origin);
    if (dropped !== null) fx.changes.set(live.origin, []);
    return {id, result: {}};
  });
}

/** §1.4 page.resume: per id this port's (tabId, origin) owns — the stored answer, or pending; anything else unknown. */
async function resume(ext: Ext, deps: WalletDeps, live: LivePort, ids: string[]): Promise<void> {
  const out = await queueAccess(ext, deps, tx =>
    ids.map(requestId => {
      const e = tx.s.queue.find(x => x.requestId === requestId);
      if (e === undefined || !owns(live, e)) return {requestId, unknown: true};
      return e.state === 'answered' && e.answer !== null ? {requestId, ...e.answer} : {requestId, pending: true};
    }),
  );
  reply(live, {resume: out});
}

/** §1.4 page.ack: the stored answer is dropped — only an answered entry this port's (tabId, origin) owns. */
async function ack(ext: Ext, deps: WalletDeps, live: LivePort, requestId: string): Promise<void> {
  await queueAccess(ext, deps, tx => {
    tx.s.queue = tx.s.queue.filter(e => !(e.requestId === requestId && e.state === 'answered' && owns(live, e)));
  });
}

/** One message on a page port. Malformed input gets `invalid-request` when it carries an id to answer, else nothing. */
export async function onPageMessage(ext: Ext, deps: WalletDeps, live: LivePort, m: unknown): Promise<void> {
  if (!isObj(m) || typeof m.type !== 'string') return;
  const id = typeof m.id === 'string' && PAGE_ID.test(m.id) ? m.id : null;
  const invalid = () => {
    if (id !== null) reply(live, {id, error: 'invalid-request'});
  };
  switch (m.type) {
    case 'page.ping':
      return;
    case 'page.ack':
      if (typeof m.requestId === 'string' && REQUEST_ID.test(m.requestId)) await ack(ext, deps, live, m.requestId);
      return;
    case 'page.resume': {
      const ids = m.requestIds;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_RESUME || !ids.every(x => typeof x === 'string' && REQUEST_ID.test(x))) return;
      await resume(ext, deps, live, ids as string[]);
      return;
    }
    case 'page.connect': {
      if (id === null || typeof m.silent !== 'boolean') return invalid();
      const r = await connect(ext, deps, live, id, m.silent);
      reply(live, r);
      if ('accepted' in r) await ensureWindow(ext, deps);
      return;
    }
    case 'page.disconnect':
      if (id === null) return invalid();
      reply(live, await disconnect(ext, deps, live, id));
      return;
    default:
      // A privileged type, a type of a later plan, or garbage: refused.
      return invalid();
  }
}

/**
 * runtime.onConnect (§1.3): a port named `noctura-page` whose sender passes the origin rule is registered, keyed
 * `(tabId, origin)` from `port.sender`; any other port is disconnected at once. A new document in a tab ends its
 * predecessor's queued requests (§2.3). Returns the registered port (null when refused).
 */
export function acceptPagePort(ext: Ext, deps: WalletDeps, port: PortLike): LivePort | null {
  const o = port.name === PAGE_PORT ? pageOrigin(ext, port.sender) : null;
  if (o === null) {
    port.disconnect();
    return null;
  }
  const live: LivePort = {...o, port};
  const rt = runtimeFor(ext);
  rt.ports.add(live);
  port.onDisconnect.addListener(() => {
    rt.ports.delete(live);
  });
  port.onMessage.addListener(m => {
    void onPageMessage(ext, deps, live, m).catch(e => console.warn('dApp page message failed', e));
  });
  void queueAccess(ext, deps, (tx, fx) => documentChanged(tx, fx, live)).catch(e => console.warn('dApp port: document check failed', e));
  return live;
}
````

Create `extension/src/background/dapp/ports.ts`:

````ts
import type {Ext} from '../../ext';
import type {Entry} from './store';

/**
 * The PAGE partition's ports (spec §1.3, §1.4, C9, C16). The relay holds one `runtime.connect({name: 'noctura-page'})`
 * port per document; results and events travel on it. The registry lives in memory — a service worker that stops
 * loses it, the relay reconnects and sends `page.resume` (§1.5), and nothing here treats "port disconnected" as
 * "request cancelled".
 */
export const PAGE_PORT = 'noctura-page';

/** What the browser reports about a port's or a message's sender (runtime.MessageSender). */
export interface PageSenderInfo {
  id?: string;
  origin?: string;
  url?: string;
  tab?: unknown;
  frameId?: number;
  documentId?: string;
  documentLifecycle?: string;
}

export interface PortLike {
  name: string;
  sender?: PageSenderInfo;
  postMessage(m: unknown): void;
  disconnect(): void;
  onMessage: {addListener(cb: (m: unknown) => void): void};
  onDisconnect: {addListener(cb: () => void): void};
}

/** A sender the origin rule accepted: everything keyed from the browser's report, never from what the page sends. */
export interface PageOrigin {
  tabId: number;
  /** Exactly sender.origin (C8): scheme + ASCII / punycode host + port. */
  origin: string;
  /** The origin's host (lower-case ASCII / punycode as the browser reports it). */
  host: string;
  documentId: string | null;
}

/**
 * The origin rule, for messages and for ports alike (§1.3; B1 §3, review M3, C16): this extension's own content
 * script (`sender.id`), in a tab, in the top frame, from an `https:` origin, of an active document where the browser
 * reports the lifecycle. Opaque and `null` origins are refused, and `sender.url` is never read (no fallback). The
 * store build accepts no `http://localhost` (the dev-origin gate). Null: refused.
 */
export function pageOrigin(ext: Pick<Ext, 'runtimeId'>, s: PageSenderInfo | undefined): PageOrigin | null {
  if (s === undefined || s.id !== ext.runtimeId) return null;
  const tabId = typeof s.tab === 'object' && s.tab !== null ? (s.tab as {id?: unknown}).id : undefined;
  if (typeof tabId !== 'number' || !Number.isSafeInteger(tabId) || tabId < 0) return null;
  if (s.frameId !== 0) return null;
  if (s.documentLifecycle !== undefined && s.documentLifecycle !== 'active') return null;
  if (typeof s.origin !== 'string') return null;
  let u: URL;
  try {
    u = new URL(s.origin);
  } catch {
    return null;
  }
  // Exactly an origin, as the browser serialises one: no path, no credentials, nothing the parser had to repair.
  if (u.protocol !== 'https:' || u.hostname === '' || `${u.protocol}//${u.host}` !== s.origin) return null;
  return {tabId, origin: s.origin, host: u.hostname, documentId: typeof s.documentId === 'string' ? s.documentId : null};
}

export interface LivePort extends PageOrigin {
  port: PortLike;
}

/** The ports of one background instance, and its instance id (C17: a `deciding` entry of another instance is a restart). */
export interface Runtime {
  instance: string;
  ports: Set<LivePort>;
}

const runtimes = new WeakMap<Pick<Ext, 'runtimeId'>, Runtime>();

function randomHex(n: number): string {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
}

/** This background instance's runtime for `ext` (one per service-worker start). */
export function runtimeFor(ext: Pick<Ext, 'runtimeId'>): Runtime {
  let r = runtimes.get(ext);
  if (r === undefined) {
    r = {instance: randomHex(16), ports: new Set()};
    runtimes.set(ext, r);
  }
  return r;
}

/**
 * A service-worker restart, as the unit tests model one: the ports and the instance id are gone (storage is not). Only
 * tests call it; a real restart starts a fresh module.
 */
export function restartRuntime(ext: Pick<Ext, 'runtimeId'>): void {
  runtimes.delete(ext);
}

/** Posts, ignoring a port that died meanwhile (its onDisconnect removes it). */
function post(p: LivePort, m: unknown): void {
  try {
    p.port.postMessage(m);
  } catch {
    // Disconnected: the relay resumes.
  }
}

const owns = (p: PageOrigin, e: Pick<Entry, 'tabId' | 'origin'>): boolean => p.tabId === e.tabId && p.origin === e.origin;

/** §1.5 step 3: every answered entry, on every live port keyed to its (tabId, origin). */
export function deliver(ext: Pick<Ext, 'runtimeId'>, entries: readonly Entry[]): void {
  for (const e of entries) {
    if (e.answer === null) continue;
    for (const p of runtimeFor(ext).ports) if (owns(p, e)) post(p, {requestId: e.requestId, ...e.answer});
  }
}

/** `change {accounts}` to every live port of these origins (review M3: callers name only origins that held a grant). */
export function sendChange(ext: Pick<Ext, 'runtimeId'>, changes: ReadonlyMap<string, readonly string[]>): void {
  for (const p of runtimeFor(ext).ports) {
    const accounts = changes.get(p.origin);
    if (accounts !== undefined) post(p, {event: 'change', accounts: [...accounts]});
  }
}

/** The origins of the live ports (the lock hook's "open ports"). */
export function liveOrigins(ext: Pick<Ext, 'runtimeId'>): Set<string> {
  return new Set([...runtimeFor(ext).ports].map(p => p.origin));
}

export {owns};
````

Create `extension/src/background/dapp/queue.ts`:

````ts
import {base64urlnopad} from '@scure/base';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {deliver, runtimeFor, sendChange, type PageOrigin} from './ports';
import {withRecent} from './grants';
import {withRejection} from './limits';
import {dappSection, grantIn, putGrant, type Answer, type Entry, type Tx} from './store';

/**
 * The request queue (spec §1.5, §2.3; C3, C4, C9, C17): one FIFO queue across origins in storage.session, decided one
 * at a time in the approval window. Every access runs `queueAccess`: one dappSection that first sweeps (expiry, a dead
 * instance's `deciding` entry, unacked answers past ten minutes, expired undo records), then the caller's change;
 * after the section commits, the answers are delivered on the ports, the `change` events sent and the expiry alarm
 * re-armed. Nothing is delivered before it is stored, so a resume always finds what a port missed.
 */
export const REQUEST_TTL_MS = 5 * 60_000;
/**
 * Review 1 M1: a `deciding` entry of this instance is an effect in flight (a grant write, a signature: milliseconds).
 * One still `deciding` this long after it was written died between its sections (a thrown storage call) — it is
 * answered `rejected` (nothing left the extension), so the queue, the window and the page move on.
 */
export const DECIDING_TTL_MS = 30_000;
export const ANSWER_TTL_MS = 10 * 60_000;
/** "Open" = queued or deciding (C3); at most this many in total — the next gets `busy`. */
export const MAX_OPEN = 5;
export const QUEUE_ALARM = 'dapp-queue';
/** Expiry is checked on every queue access and by this alarm (§2.3: every 30 s). */
export const QUEUE_TICK_MINUTES = 0.5;

export const isOpenEntry = (e: Entry): boolean => e.state === 'queued' || e.state === 'deciding';

/** The queue head: the first open entry (FIFO across origins). */
export function headOf(tx: Pick<Tx, 's'>): Entry | null {
  return tx.s.queue.find(isOpenEntry) ?? null;
}

/** 128 random bits, base64url (review 2 M1). */
export const newRequestId = (deps: Pick<WalletDeps, 'randomBytes'>): string => base64urlnopad.encode(deps.randomBytes(16));

/** What an access does besides storage: answers to deliver and `change` events to send, after the commit. */
export interface Effects {
  answered: Entry[];
  changes: Map<string, string[]>;
}

export function answer(fx: Effects, e: Entry, a: Answer, now: number): void {
  e.state = 'answered';
  e.answer = a;
  e.answeredAt = now;
  fx.answered.push(e);
}

/**
 * The user said no (Reject, the window's ✕, closing the window — C4): answered `rejected`, counted for C14 per host and
 * per tab, and recorded on the origin's grant when it holds one (§2.1: a rejected first connect has no grant, so it is
 * not recorded).
 */
export function userRejected(tx: Tx, fx: Effects, e: Entry): void {
  answer(fx, e, {error: 'rejected'}, tx.now);
  tx.limits = withRejection(tx.limits, e.host, e.tabId, tx.now);
  const g = grantIn(tx, e.origin);
  if (g !== null) putGrant(tx, withRecent(g, e.type, tx.now, 'rejected'));
}

/** Answers an origin's `queued` entries (never a `deciding` one: its effect is running) with this error. */
export function rejectQueued(tx: Tx, fx: Effects, match: (e: Entry) => boolean, code: 'rejected' = 'rejected'): void {
  for (const e of tx.s.queue) if (e.state === 'queued' && match(e)) answer(fx, e, {error: code}, tx.now);
}

/**
 * The housekeeping of every access: a `queued` entry older than five minutes is answered `timeout` (C4, counted from
 * arrivedAt by the background's clock — `queued` or `deciding`); a `deciding` entry another instance wrote is a restart
 * (C17, §1.5 step 2 — nothing left the extension: answered `rejected`), and so is one of this instance still `deciding`
 * DECIDING_TTL_MS after it was written (review 1 M1); an answered entry nobody acked is dropped ten minutes after its
 * answer; an expired undo record is dropped.
 */
export function sweep(tx: Tx, fx: Effects, instance: string): void {
  for (const e of tx.s.queue) {
    // C4 "queued or shown": five minutes from arrivedAt, whatever the open state (review 1 M1).
    if (isOpenEntry(e) && tx.now - e.arrivedAt >= REQUEST_TTL_MS) answer(fx, e, {error: 'timeout'}, tx.now);
    // C17: another instance's `deciding` is a restart; this instance's, DECIDING_TTL_MS after it was written, a dead effect.
    else if (e.state === 'deciding' && (e.decidedBy !== instance || e.decidingAt === null || tx.now - e.decidingAt >= DECIDING_TTL_MS)) answer(fx, e, {error: 'rejected'}, tx.now);
  }
  tx.s.queue = tx.s.queue.filter(e => e.state !== 'answered' || e.answeredAt === null || tx.now - e.answeredAt < ANSWER_TTL_MS);
  tx.s.undo = tx.s.undo.filter(u => u.expiresAt > tx.now);
}

/**
 * §2.3 (review 2 H2): a port or request from a tab whose document changed (Chrome's documentId) — the old document's
 * `queued` requests are answered `rejected`. Without a documentId (Firefox) nothing happens here; C3's per-tab cap and
 * C14's per-tab cooldown bound the effect.
 */
export function documentChanged(tx: Tx, fx: Effects, p: PageOrigin): void {
  if (p.documentId === null) return;
  rejectQueued(tx, fx, e => e.tabId === p.tabId && e.documentId !== null && e.documentId !== p.documentId);
}

/** Arms the expiry tick while anything is in the queue; clears it otherwise. */
async function tick(ext: Ext, queued: boolean): Promise<void> {
  if (queued) await ext.alarms.create(QUEUE_ALARM, {delayInMinutes: QUEUE_TICK_MINUTES});
  else await ext.alarms.clear(QUEUE_ALARM);
}

/** One queue access (see the header). `fn` runs inside the section, after the sweep. */
export async function queueAccess<T>(ext: Ext, deps: Pick<WalletDeps, 'now'>, fn: (tx: Tx, fx: Effects) => T | Promise<T>): Promise<T> {
  const fx: Effects = {answered: [], changes: new Map()};
  const instance = runtimeFor(ext).instance;
  let queued = false;
  const out = await dappSection(ext, deps.now(), async tx => {
    sweep(tx, fx, instance);
    const r = await fn(tx, fx);
    queued = tx.s.queue.length > 0;
    return r;
  });
  deliver(ext, fx.answered);
  sendChange(ext, fx.changes);
  await tick(ext, queued).catch(e => console.warn('dApp queue: the expiry tick was not armed', e));
  return out;
}
````

Create `extension/src/background/dapp/window.ts`:

````ts
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {budgetLeft, withWindow} from './limits';
import {headOf, queueAccess, rejectQueued, userRejected} from './queue';
import {readDappSession} from './store';

/**
 * The approval window (spec §2.3, review 1 M7, review 2 M2; C3, C14, D11). One at a time, always `approve.html`,
 * 412 × 720; it asks `dapp.pending` for what to show — no request data in a URL (C5). Opening runs in three steps:
 * under the queue mutex, if a head waits and no window is recorded, the window budget is checked and `{openingAt}` is
 * written; then windows.create; then, in one queue section, its id is recorded and the marker removed. A failed create
 * removes the marker (`finally`); a marker older than OPENING_STALE_MS is stale and the open is retried. A recorded id
 * is checked with windows.get before it counts as open.
 */
export const APPROVE_PAGE = 'approve.html';
export const WINDOW_WIDTH = 412;
export const WINDOW_HEIGHT = 720;
export const OPENING_STALE_MS = 10_000;

export async function ensureWindow(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<void> {
  const recorded = (await readDappSession(ext)).window;
  if (recorded !== null) {
    if (await ext.dappWindows.exists(recorded.id)) return;
    // Closed without our hearing of it (a restart lost the event): treat as closed.
    await queueAccess(ext, deps, tx => {
      if (tx.s.window?.id === recorded.id) tx.s.window = null;
    });
  }
  const marker = await queueAccess(ext, deps, (tx, fx) => {
    if (tx.s.window !== null || headOf(tx) === null) return null;
    if (tx.s.opening !== null && tx.now - tx.s.opening < OPENING_STALE_MS) return null;
    if (!budgetLeft(tx.limits, tx.now)) {
      // C14: beyond the budget every request that would need this window is declined with no window; the next one
      // that opens says so (Q24).
      rejectQueued(tx, fx, () => true);
      tx.limits = {...tx.limits, notice: true};
      return null;
    }
    tx.limits = withWindow(tx.limits, tx.now);
    tx.s.opening = tx.now;
    return tx.now;
  });
  if (marker === null) return;
  let id: number | null = null;
  try {
    id = await ext.dappWindows.create({page: APPROVE_PAGE, width: WINDOW_WIDTH, height: WINDOW_HEIGHT});
  } finally {
    const orphan = await queueAccess(ext, deps, tx => {
      // The marker is gone (a lock cleared it, or a stale-marker retry replaced it): this window is nobody's.
      if (tx.s.opening !== marker) return true;
      tx.s.opening = null;
      if (id !== null) tx.s.window = {id, showing: null};
      return false;
    });
    if (orphan && id !== null) await ext.dappWindows.remove(id).catch(() => undefined);
  }
}

/**
 * windows.onRemoved for the approval window (§2.3, C4): closing it rejects only the request it was showing, and only if
 * that is still `queued` (a `deciding` one finishes; an answered one stays answered). Another window id is not ours. A
 * queue that still holds requests gets a window again (the budget applies).
 */
export async function onApprovalWindowRemoved(ext: Ext, deps: Pick<WalletDeps, 'now'>, id: number): Promise<void> {
  const ours = await queueAccess(ext, deps, (tx, fx) => {
    if (tx.s.window?.id !== id) return false;
    const showing = tx.s.window.showing;
    tx.s.window = null;
    const e = tx.s.queue.find(x => x.requestId === showing);
    if (e?.state === 'queued') userRejected(tx, fx, e);
    return true;
  });
  if (ours) await ensureWindow(ext, deps);
}

/**
 * The expiry alarm (§2.3): a queue access that delivers whatever expired (the window learns on its next poll), then a
 * window for a head that has none — so a request whose window failed to open is not left waiting for the next request.
 */
export async function onQueueAlarm(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<void> {
  await queueAccess(ext, deps, () => undefined);
  await ensureWindow(ext, deps);
}
````

Modify `extension/src/background/index.ts`:

````diff
diff --git a/extension/src/background/index.ts b/extension/src/background/index.ts
--- a/extension/src/background/index.ts
+++ b/extension/src/background/index.ts
@@ -4,17 +4,23 @@ import {AUTOLOCK_ALARM, lock, onWindowRemoved} from './autolock';
 import {browserDeps} from './deps';
 import {isOpen, readPending} from './pendingStore';
 import {PENDING_ALARM, armPendingAlarm, onPendingAlarm, startPoller} from './pending';
+import {acceptPagePort} from './dapp/pageApi';
+import {QUEUE_ALARM} from './dapp/queue';
+import {onApprovalWindowRemoved, onQueueAlarm} from './dapp/window';
+import type {PortLike} from './dapp/ports';
 
 interface BgApi {
   runtime: {
     getURL(path: string): string;
     onMessage: {addListener(cb: (m: unknown, s: Sender, reply: (r: unknown) => void) => boolean): void};
+    /** B1c §1.3: the relay's `noctura-page` ports. */
+    onConnect: {addListener(cb: (port: PortLike) => void): void};
     onStartup: {addListener(cb: () => void): void};
     onInstalled: {addListener(cb: (details: {reason: string}) => void): void};
   };
   tabs: {create(o: {url: string}): Promise<unknown> | void};
   alarms: {onAlarm: {addListener(cb: (a: {name: string}) => void): void}};
-  windows: {onRemoved: {addListener(cb: () => void): void}};
+  windows: {onRemoved: {addListener(cb: (windowId: number) => void): void}};
 }
 
 const g = globalThis as unknown as {browser?: BgApi; chrome?: BgApi};
@@ -31,12 +37,18 @@ api.runtime.onMessage.addListener((msg, sender, reply) => {
   handleMessage(ext, msg, sender, deps).then(reply, () => reply({ok: false, error: 'internal'}));
   return true; // reply asynchronously
 });
+api.runtime.onConnect.addListener(port => acceptPagePort(ext, deps, port));
 api.alarms.onAlarm.addListener(a => {
   if (a.name === AUTOLOCK_ALARM) void lock(ext);
   if (a.name === PENDING_ALARM) void onPendingAlarm(ext, deps).catch(e => console.warn('pending alarm tick failed', e));
+  if (a.name === QUEUE_ALARM) void onQueueAlarm(ext, deps).catch(e => console.warn('dApp queue tick failed', e));
 });
-api.windows.onRemoved.addListener(() => {
-  void onWindowRemoved(ext);
+// The approval window first (closing it rejects the request it showed, §2.3), then the browser-closed lock: the
+// approval popup counts in windowCount, so closing the last browser window while it is open does not lock (review 2 L9).
+api.windows.onRemoved.addListener(windowId => {
+  void onApprovalWindowRemoved(ext, deps, windowId)
+    .catch(e => console.warn('dApp window removal failed', e))
+    .finally(() => onWindowRemoved(ext));
 });
 api.runtime.onStartup.addListener(() => {
   void lock(ext);
````

Modify `extension/src/background/messages.ts`:

````diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -11,6 +11,7 @@ import {changePassword, forgetWallet, provenRevisionIsStored, readWalletView, re
 import {isOpen, readPending} from './pendingStore';
 import {startPoller} from './pending';
 import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
+import {PAGE_TYPES} from './dapp/pageApi';
 
 /** What the browser reports about a message's origin (runtime.MessageSender). */
 export interface Sender {
@@ -19,13 +20,17 @@ export interface Sender {
   url?: string;
   tab?: unknown;
   frameId?: number;
+  /** B1c: Chrome 106+ (§2.3) — the document, and its lifecycle (C16). */
+  documentId?: string;
+  documentLifecycle?: string;
 }
 
 /**
  * Two partitions (spec §1). Privileged types come only from this extension's own pages;
- * page types (none until B1c) only from https top frames. `sender.origin` is what the browser
- * sets — never the URL the message claims, and never "has a tab", which a full-tab
- * extension page also has.
+ * page types only from https top frames, and only on the `noctura-page` port (B1c §1.3, §1.4:
+ * dapp/pageApi.ts) — never through runtime.sendMessage, so here a page type is refused from
+ * anyone, an extension page included. `sender.origin` is what the browser sets — never the URL
+ * the message claims, and never "has a tab", which a full-tab extension page also has.
  */
 export const PRIVILEGED = [
   'vault.setKeys',
@@ -59,7 +64,7 @@ const VAULT_PAGE_ONLY: readonly string[] = [
   'vault.removePasskey',
   'vault.phraseVerified',
 ];
-export const PAGE: readonly string[] = [];
+export const PAGE: readonly string[] = PAGE_TYPES;
 
 function isOwnPage(ext: Ext, s: Sender): boolean {
   return s.id === ext.runtimeId && s.origin === ext.extensionOrigin;
@@ -124,7 +129,9 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
   const type = (msg as {type: string}).type;
   const privileged = (PRIVILEGED as readonly string[]).includes(type);
   if (!privileged && !PAGE.includes(type)) return {ok: false, error: 'unknown type'};
-  if (privileged && !isOwnPage(ext, sender)) return {ok: false, error: 'forbidden'};
+  // B1c §1.4: page types travel on the page port only.
+  if (!privileged) return {ok: false, error: 'forbidden'};
+  if (!isOwnPage(ext, sender)) return {ok: false, error: 'forbidden'};
   if (VAULT_PAGE_ONLY.includes(type) && pagePath(ext, sender) !== '/unlock.html') return {ok: false, error: 'forbidden'};
 
   switch (type) {
````

Modify `extension/src/ext.ts`:

````diff
diff --git a/extension/src/ext.ts b/extension/src/ext.ts
--- a/extension/src/ext.ts
+++ b/extension/src/ext.ts
@@ -10,6 +10,15 @@ export interface KV {
   clear(): Promise<void>;
 }
 
+/** B1c (spec §2.3): the approval window — the one window the background opens. */
+export interface WindowsApi {
+  /** A focused popup window showing this extension page at this size; its id, or null when the browser gave none. */
+  create(o: {page: string; width: number; height: number}): Promise<number | null>;
+  /** Whether the window with this id still exists (windows.get rejects for a closed one). */
+  exists(id: number): Promise<boolean>;
+  remove(id: number): Promise<void>;
+}
+
 export interface Ext {
   runtimeId: string;
   extensionOrigin: string;
@@ -17,6 +26,7 @@ export interface Ext {
   local: KV;
   alarms: {create(name: string, o: {delayInMinutes: number}): Promise<void> | void; clear(name: string): Promise<boolean>};
   windowCount(): Promise<number>;
+  dappWindows: WindowsApi;
   /** Restrict storage.session to trusted (extension) contexts where the browser supports it. */
   pinSessionAccess(): Promise<void>;
 }
@@ -35,7 +45,12 @@ interface BrowserLike {
   runtime: {id: string; getURL(path: string): string};
   storage: {session: SessionArea; local: StorageArea};
   alarms: {create(name: string, o: {delayInMinutes: number}): Promise<void> | void; clear(name: string): Promise<boolean>};
-  windows: {getAll(): Promise<unknown[]>};
+  windows: {
+    getAll(): Promise<unknown[]>;
+    create(o: {type: 'popup'; url: string; width: number; height: number; focused: boolean}): Promise<{id?: number} | undefined>;
+    get(id: number): Promise<unknown>;
+    remove(id: number): Promise<void>;
+  };
 }
 
 function kv(area: StorageArea): KV {
@@ -84,6 +99,21 @@ export function browserExt(): Ext {
     local: kv(b.storage.local),
     alarms: b.alarms,
     windowCount: async () => (await b.windows.getAll()).length,
+    dappWindows: {
+      create: async o => {
+        const w = await b.windows.create({type: 'popup', url: b.runtime.getURL(o.page), width: o.width, height: o.height, focused: true});
+        return typeof w?.id === 'number' ? w.id : null;
+      },
+      exists: async id => {
+        try {
+          await b.windows.get(id);
+          return true;
+        } catch {
+          return false;
+        }
+      },
+      remove: id => b.windows.remove(id),
+    },
     // TRUSTED_CONTEXTS is Chrome's default today; pinning it means a future default (or another
     // piece of code) cannot open the signing keys to content scripts. Where the API is absent
     // (Firefox), there is nothing to pin and the call is a no-op.
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/start.test.ts src/background/dapp/__tests__/lifecycle.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  2 passed (2) · Tests  42 passed (42); tsc clean; whole suite Test Files  143 passed (143) · Tests  2887 passed (2887); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M3a** — the origin rule without frameId (an iframe asks) — `extension/src/background/dapp/ports.ts`:

  ```diff
  -   if (s.frameId !== 0) return null;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3b** — the origin rule without the lifecycle (a prerendered page asks, C16) — `extension/src/background/dapp/ports.ts`:

  ```diff
  -   if (s.documentLifecycle !== undefined && s.documentLifecycle !== 'active') return null;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3c** — the origin rule accepts http: — `extension/src/background/dapp/ports.ts`:

  ```diff
  - if (u.protocol !== 'https:' || u.hostname === ''
  + if (u.hostname === ''
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3d** — a page type accepted on runtime.sendMessage (R7) — `extension/src/background/messages.ts`:

  ```diff
  -   if (!privileged) return {ok: false, error: 'forbidden'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3e** — page.resume ignores ownership (a foreign id resumes) — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  - if (e === undefined || !owns(live, e)) return {requestId, unknown: true};
  + if (e === undefined) return {requestId, unknown: true};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3f** — page.ack ignores ownership — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  - e.state === 'answered' && owns(live, e))
  + e.state === 'answered')
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3g** — documentId ignored (a reloaded tab keeps its request) — `extension/src/background/dapp/queue.ts`:

  ```diff
  -   if (p.documentId === null) return;
  +   return;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3h** — no per-tab cap (C3) — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  - if (open.some(e => e.host === live.host || e.tabId === live.tabId)) return 'request-pending';
  + if (open.some(e => e.host === live.host)) return 'request-pending';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3i** — a sixth open request is queued (C3's five) — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  - if (open.length >= MAX_OPEN) return 'busy';
  + if (open.length > MAX_OPEN) return 'busy';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3j** — the opening marker kept when windows.create fails — `extension/src/background/dapp/window.ts`:

  ```diff
  -       tx.s.opening = null;
  -       if (id !== null) tx.s.window = {id, showing: null};
  +       if (id !== null) tx.s.opening = null;
  +       if (id !== null) tx.s.window = {id, showing: null};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Tests  2 failed | 35 passed (37) · FAIL  src/background/dapp/__tests__/lifecycle.test.ts > the approval window (§2.3, C14) > the alarm opens a window for a head that has none (a failed create is not left waiting)).

- **M3k** — a stale opening marker is never stale — `extension/src/background/dapp/window.ts`:

  ```diff
  - export const OPENING_STALE_MS = 10_000;
  + export const OPENING_STALE_MS = Number.POSITIVE_INFINITY;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3l** — closing the window rejects every queued request, not only the shown one — `extension/src/background/dapp/window.ts`:

  ```diff
  -     const e = tx.s.queue.find(x => x.requestId === showing);
  -     if (e?.state === 'queued') userRejected(tx, fx, e);
  +     for (const e of tx.s.queue) if (e.state === 'queued') userRejected(tx, fx, e);
  +     void showing;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3m** — no expiry (C4) — `extension/src/background/dapp/queue.ts`:

  ```diff
  -     if (isOpenEntry(e) && tx.now - e.arrivedAt >= REQUEST_TTL_MS) answer(fx, e, {error: 'timeout'}, tx.now);
  +     if (false) answer(fx, e, {error: 'timeout'}, tx.now);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 35 passed (37)).

- **M3n** — no restart rule (C17: another instance's deciding entry stays) — `extension/src/background/dapp/queue.ts`:

  ```diff
  - (e.decidedBy !== instance || e.decidingAt === null
  + (instance === '' || e.decidingAt === null
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3o** — an unacked answer is never deleted — `extension/src/background/dapp/queue.ts`:

  ```diff
  -   tx.s.queue = tx.s.queue.filter(e => e.state !== 'answered' || e.answeredAt === null || tx.now - e.answeredAt < ANSWER_TTL_MS);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  18 failed | 19 passed (37)).

- **M3p** — a blocked or cooling host still queues (§2.6) — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  -     if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {id, error: 'rejected'};
  -     if (account !== null) {
  +     if (account !== null) {
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 35 passed (37)).

- **M3q** — page.disconnect leaves a persistent grant (C2) — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  -     const dropped = dropGrant(tx, live.origin);
  +     void dropGrant;
  +     const dropped = tx.s.grants.find(g => g.origin === live.origin) ?? null;
  +     tx.s.grants = tx.s.grants.filter(g => g.origin !== live.origin);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3r** — an answer delivered to every port of the origin, any tab — `extension/src/background/dapp/ports.ts`:

  ```diff
  - const owns = (p: PageOrigin, e: Pick<Entry, 'tabId' | 'origin'>): boolean => p.tabId === e.tabId && p.origin === e.origin;
  + const owns = (p: PageOrigin, e: Pick<Entry, 'tabId' | 'origin'>): boolean => p.origin === e.origin;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 35 passed (37)).

- **M3s** — a deciding entry never expires by C4 (only queued ones do) — `extension/src/background/dapp/queue.ts`:

  ```diff
  - if (isOpenEntry(e) && tx.now - e.arrivedAt >= REQUEST_TTL_MS)
  + if (e.state === 'queued' && tx.now - e.arrivedAt >= REQUEST_TTL_MS)
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3t** — no deadline for this instance's deciding entry (a dead effect wedges the queue) — `extension/src/background/dapp/queue.ts`:

  ```diff
  -  || e.decidingAt === null || tx.now - e.decidingAt >= DECIDING_TTL_MS)) answer
  + )) answer
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- **M3u** — lastUsedAt written on every accepted request (no one-minute step) — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  - if (g !== null && tx.now - g.lastUsedAt >= LAST_USED_STEP_MS) putGrant
  + if (g !== null) putGrant
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lifecycle.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 36 passed (37)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/fakeExt.ts extension/src/background/__tests__/start.test.ts extension/src/background/dapp/__tests__/lifecycle.test.ts extension/src/background/dapp/__tests__/pageHarness.ts extension/src/background/dapp/pageApi.ts extension/src/background/dapp/ports.ts extension/src/background/dapp/queue.ts extension/src/background/dapp/window.ts extension/src/background/index.ts extension/src/background/messages.ts extension/src/ext.ts
git commit -F - <<'MSG'
feat(extension): B1c PAGE partition — origin rule, ports, queue, delivery, resume/ack, the approval window opening

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 4: `dapp.pending` and `dapp.decide` (§2.3's table, `deciding`, the connect effect, reject / report / block) and #49's messages (list, revoke with a single-shot undo token, revoke all, blocked list, unblock)

**Spec:** §1.4 (privileged messages), §1.5 step 2, §2.1 (cap), §2.3 (`dapp.decide` validations, cooldown and budget, revoke / block / disconnect reject the queue), §2.6, §2.7, §3.1 outcomes, §4.3 (`pending`'s states), C1, C2, C12, C13, C14 (Q17's offer), C17; §6.1 "Decide", "Undo"; Review Focus 4; Scope R8, R9, R11; plan review 1 M3, M4, L2

**Files:**
- Test: `extension/src/background/__tests__/messages.test.ts`
- Test: `extension/src/background/dapp/__tests__/decide.test.ts` (new)
- Create: `extension/src/background/dapp/decide.ts`
- Create: `extension/src/background/dapp/grantsApi.ts`
- Modify: `extension/src/background/messages.ts`

**Interfaces:**
- Consumes: Task 1's `classify`, `siteName`, `IdnDetail`, `LookalikeRule`; Tasks 2–3's stores, `queueAccess`, `answer`, `userRejected`, `rejectQueued`, `headOf`, `isOpenEntry`, `runtimeFor`; `armAutolock`, `getSession`, `readWalletView`, `readSettings`, `displayOrder`.
- Produces (as exported):
  - `decide.ts`: `interface SiteView {kind; name; imitates; rule; idn; international}`, `siteView(host)`, `interface AccountChoice {index; name; publicKey}`, `interface ConnectDetail {accounts; selected; cap}`, `interface RequestView {requestId; type; origin; host; site; offerBlock; connect}` (Task 6 adds `sign`), `type PendingView = {state: 'none'} | {state: 'locked' | 'deciding' | 'request'; request; waiting; windowNotice}`, `pending(ext, deps)`, `type DecideError`, `interface DecideRequest {requestId; decision; account; scope}`, `decideRequestOf(msg)`, `blockHost(tx, fx, host)`, `hostOf(origin)`, `decide(ext, deps, d)`.
  - `grantsApi.ts`: `UNDO_MS = 5_000`, `interface GrantView`, `listGrants`, `revokeGrant`, `type UndoError`, `undoRevoke`, `revokeAll`, `listBlocked`, `unblock`.
  - `messages.ts`: eight privileged types (`dapp.pending`, `dapp.decide` — `/approve.html` only; `dapp.grants.list|revoke|undo|revokeAll`, `dapp.blocked.list|remove` — `/popup.html` or `/wallet.html` only).

The window decides nothing (C13): every `dapp.decide` is checked here, one refusal per row of §2.3's table, in order — head (the queue head and `queued`; a `deciding` one is never decided twice), expiry, unlocked (read inside the section, so no grant is written after a lock), account, scope (C12: `persistent` only for a verified origin), blocked / cooldown, the cap (Q16), and — for a sign request (Task 6) — the grant still held and the same account. An approval writes `deciding` (with this worker's instance and the time, `decidingAt`) in the same section that passed the checks; only then does the effect run, in a later section that writes the grant and the answer together and first confirms the entry is still this instance's `deciding` one, the account still in the session and the host not blocked meanwhile (§1.5 step 2; each re-check has its test and mutation — review 1 M4). Reject counts for C14 per host and per tab; "Reject and report" and "Block this site" block the host (with what it imitates), revoke every grant of that host in both scopes (`change []`) and reject its queued requests (§2.6) — and, like every write of the user's lists, are refused while locked (review 1 L2, R8); revoke all rejects the revoked origins' queued requests too (review 1 M3; tested in Task 6, which brings the queued sign request). A decision is a user action: it arms the auto-lock (§2.2). `dapp.pending` returns the head as the window shows it — `locked` while locked (the origin card only, D11), `deciding` (never decidable), `none` — with the account picker's choices (the wallet's unlocked accounts in display order, the active one chosen — only a default, C1), the cap, Q17's offer (two rejections already), how many wait (Q12) and the budget notice once (Q24); it records which request the window shows. #49's messages are refused while locked (R8); revoke answers an undo token and keeps the record five seconds in `storage.session` (the popup never holds a grant); undo is single-shot and refused in every case §2.7 lists.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/messages.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -200,6 +200,8 @@ describe('message partitions (B1b-1 types)', () => {
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
     'contacts.list', 'contacts.set', 'contacts.remove',
+    // B1c §1.4: the approval window's and #49's.
+    'dapp.pending', 'dapp.decide', 'dapp.grants.list', 'dapp.grants.revoke', 'dapp.grants.undo', 'dapp.grants.revokeAll', 'dapp.blocked.list', 'dapp.blocked.remove',
   ];
 
   it('every privileged type is refused from a web page and from another extension', async () => {
````

Create `extension/src/background/dapp/__tests__/decide.test.ts`:

````ts
import {handleMessage} from '../../messages';
import {lock} from '../../autolock';
import {setSession} from '../../session';
import {VAULT_KEY} from '../../accountsStore';
import {SETTINGS_KEY} from '../../settings';
import {GRANTS_KEY, MAX_GRANTS, type Grant} from '../grants';
import {BLOCKED_KEY} from '../blocked';
import {LIMITS_KEY} from '../limits';
import {REQUEST_TTL_MS} from '../queue';
import {DAPP_SESSION_KEY, readDappSession, type Entry} from '../store';
import {restartRuntime, runtimeFor} from '../ports';
import {UNDO_MS} from '../grantsApi';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT, RECIPIENT} from '../../__tests__/fixtures';
import {openPage, type Page} from './pageHarness';

const SECOND = {index: 1, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey};
const DAPP = 'https://dapp.test';
const JUP = 'https://jup.ag';
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});

async function setup(o: {unlocked?: boolean} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}, {index: 1, name: 'Savings', publicKey: RECIPIENT}]});
  if (o.unlocked !== false) await setSession(ext, [ACCOUNT, SECOND]);
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const popup = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`};
  const pend = async () => (await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)) as {ok: boolean; data: Record<string, unknown> & {state: string; request: Record<string, unknown>}};
  const decide = (m: Record<string, unknown>) => handleMessage(ext, {type: 'dapp.decide', ...m}, approve, deps);
  const ui = (m: Record<string, unknown>) => handleMessage(ext, m, popup, deps);
  return {ext, deps, approve, popup, pend, decide, ui};
}
async function request(ext: ReturnType<typeof fakeExt>, deps: ReturnType<typeof fakeDeps>, origin: string, tab = 7): Promise<{page: Page; requestId: string}> {
  const page = openPage(ext, deps, origin, {tab: {id: tab}});
  const r = await page.ask({type: 'page.connect', id: `c${tab}`, silent: false});
  return {page, requestId: String(r?.requestId)};
}

// Spec §1.4, §1.5, §2.3, §2.7, C2, C12, C13, C14, C17 — the approval window's messages and #49's, against the real
// background. Each refusal of §2.3's table has its own test and its own mutation (plan Task 4).
describe('who may ask (§1.4)', () => {
  it('dapp.pending and dapp.decide only from approve.html; the grants messages only from the popup or the tab', async () => {
    const {ext, deps, approve, popup} = await setup();
    const unlock = {...popup, url: `${ext.extensionOrigin}/unlock.html`};
    const tab = {...popup, url: `${ext.extensionOrigin}/wallet.html`};
    const web = {id: ext.runtimeId, origin: DAPP, url: `${DAPP}/approve.html`, tab: {id: 1}, frameId: 0};
    for (const s of [popup, unlock, tab, web]) expect(await handleMessage(ext, {type: 'dapp.pending'}, s, deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)).toEqual({ok: true, data: {state: 'none'}});
    for (const s of [approve, unlock, web]) expect(await handleMessage(ext, {type: 'dapp.grants.list'}, s, deps)).toEqual({ok: false, error: 'forbidden'});
    for (const s of [popup, tab]) expect(await handleMessage(ext, {type: 'dapp.grants.list'}, s, deps)).toEqual({ok: true, data: {grants: []}});
  });
});

describe('dapp.pending (§2.3, §4.3)', () => {
  it('the head as the window shows it: origin, the classification, the account picker (display order, active chosen), waiting', async () => {
    const {ext, deps, pend} = await setup();
    await ext.local.set(SETTINGS_KEY, {selectedAccount: 1, accountOrder: [1, 0]});
    const {requestId} = await request(ext, deps, 'https://tensr.trade');
    await request(ext, deps, JUP, 8);
    const r = await pend();
    expect(r.data).toEqual({
      state: 'request',
      waiting: 1,
      windowNotice: false,
      request: {
        requestId,
        type: 'connect',
        origin: 'https://tensr.trade',
        host: 'tensr.trade',
        site: {kind: 'lookalike', name: 'tensr', imitates: 'tensor.trade', rule: 'edit', idn: null, international: false},
        offerBlock: false,
        connect: {
          accounts: [
            {index: 1, name: 'Savings', publicKey: RECIPIENT},
            {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
          ],
          selected: 1,
          cap: false,
        },
      },
    });
    // The window now shows it: closing the window rejects this one.
    expect((await readDappSession(ext)).window?.showing).toBe(requestId);
  });

  it('locked: the origin card only, no account list (D11); none: an empty queue (the window closes itself)', async () => {
    const {ext, deps, pend} = await setup({unlocked: false});
    await request(ext, deps, DAPP);
    const r = await pend();
    expect(r.data.state).toBe('locked');
    expect(r.data.request.connect).toBeNull();
    expect(r.data.request.site).toEqual({kind: 'unknown', name: 'dapp', imitates: null, rule: null, idn: null, international: false});
  });

  it('the budget notice (Q24) is shown once', async () => {
    const {ext, deps, pend} = await setup();
    await request(ext, deps, DAPP);
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: [], notice: true});
    expect((await pend()).data.windowNotice).toBe(true);
    expect((await pend()).data.windowNotice).toBe(false);
  });

  it('a request whose host or tab already has two rejections offers [Block this site] (Q17)', async () => {
    const {ext, deps, pend} = await setup();
    await ext.local.set(LIMITS_KEY, {rejections: [{key: 'host:dapp.test', at: deps.clock.t}, {key: 'host:dapp.test', at: deps.clock.t}], cooldowns: [], windows: [], notice: false});
    await request(ext, deps, DAPP);
    expect((await pend()).data.request.offerBlock).toBe(true);
  });

  it('the cap (§2.1): 200 persistent grants and none for this origin — cap: true', async () => {
    const {ext, deps, pend} = await setup();
    await ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => grant(`https://s${i}.test`)));
    await request(ext, deps, DAPP);
    expect((await pend()).data.request.connect).toMatchObject({cap: true});
  });
});

describe('dapp.decide — a connect (§3.1 outcomes)', () => {
  it('approve, this session only: a session grant, the page gets its account; the next request is the head; auto-lock armed', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, DAPP);
    ext.alarmsSet.clear();
    expect(await decide({requestId, decision: 'approve', account: RECIPIENT, scope: 'session'})).toEqual({ok: true});
    expect(page.answersFor(requestId)).toEqual([{requestId, result: {accounts: [RECIPIENT]}}]);
    const s = await readDappSession(ext);
    expect(s.grants).toEqual([{origin: DAPP, account: RECIPIENT, scope: 'session', connectedAt: deps.clock.t, lastUsedAt: deps.clock.t, recent: [{type: 'connect', at: deps.clock.t, outcome: 'approved'}]}]);
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect(ext.alarmsSet.has('autolock')).toBe(true);
    // C1: the dApp's account is the one granted — a silent connect returns it, not the popup's active account.
    expect(await page.ask({type: 'page.connect', id: 's', silent: true})).toEqual({id: 's', result: {accounts: [RECIPIENT]}});
  });

  it('approve, until revoked, for a verified origin: a persistent grant', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, JUP);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(((await ext.local.get(GRANTS_KEY)) as Grant[]).map(g => [g.origin, g.scope])).toEqual([[JUP, 'persistent']]);
  });

  it('reject: rejected, counted for C14 per host and per tab, nothing granted (a first connect has no grant to record on)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'reject'})).toEqual({ok: true});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(((await ext.local.get(LIMITS_KEY)) as {rejections: {key: string}[]}).rejections.map(r => r.key)).toEqual(['host:dapp.test', 'tab:7']);
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect((await readDappSession(ext)).grants).toEqual([]);
  });

  it('three rejections from one host: the fourth request is rejected with no queue entry (C14)', async () => {
    const {ext, deps, decide} = await setup();
    for (let i = 0; i < 3; i++) {
      const {requestId} = await request(ext, deps, DAPP, 10 + i);
      await decide({requestId, decision: 'reject'});
    }
    const page = openPage(ext, deps, DAPP, {tab: {id: 20}});
    expect(await page.ask({type: 'page.connect', id: 'x', silent: false})).toEqual({id: 'x', error: 'rejected'});
  });

  it('report (and Block this site): rejected, the host blocked with what it imitates, its grants revoked in both scopes, change [] (§2.6)', async () => {
    const {ext, deps, decide} = await setup();
    await ext.local.set(GRANTS_KEY, [grant('https://tensr.trade:8443')]);
    const holder = openPage(ext, deps, 'https://tensr.trade:8443', {tab: {id: 3}});
    const {page, requestId} = await request(ext, deps, 'https://tensr.trade');
    expect(await decide({requestId, decision: 'report'})).toEqual({ok: true});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(await ext.local.get(BLOCKED_KEY)).toEqual([{host: 'tensr.trade', blockedAt: deps.clock.t, imitates: 'tensor.trade'}]);
    expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
    expect(holder.changes()).toEqual([[]]);
    // The next request from it: no window, no entry.
    expect(await page.ask({type: 'page.connect', id: 'again', silent: false})).toEqual({id: 'again', error: 'rejected'});
    const {requestId: b} = await request(ext, deps, 'https://unknown.test', 30);
    expect(await decide({requestId: b, decision: 'block'})).toEqual({ok: true});
    expect(((await ext.local.get(BLOCKED_KEY)) as {host: string; imitates: string | null}[])[0]).toEqual({host: 'unknown.test', blockedAt: deps.clock.t, imitates: null});
  });

  it('block answers the host’s other queued requests rejected — every port of it (review 1 M3; seeded: C3 admits one open request per host)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, 'https://tensr.trade');
    const other = openPage(ext, deps, 'https://tensr.trade:8443', {tab: {id: 31}});
    // Through the page path the host's second request never queues (C3) — so the queue is seeded as a later change of
    // C3, or a restored session, could leave it.
    expect(await other.ask({type: 'page.connect', id: 'o', silent: false})).toEqual({id: 'o', error: 'request-pending'});
    const s = await readDappSession(ext);
    const head = s.queue[0] as Entry;
    const second: Entry = {...head, requestId: 'S'.repeat(22), pageId: 'o2', origin: 'https://tensr.trade:8443', tabId: 31};
    const elsewhere: Entry = {...head, requestId: 'E'.repeat(22), pageId: 'e2', origin: JUP, host: 'jup.ag', tabId: 32};
    await ext.session.set(DAPP_SESSION_KEY, {...s, queue: [head, second, elsewhere]});
    expect(await decide({requestId, decision: 'block'})).toEqual({ok: true});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(other.answersFor(second.requestId)).toEqual([{requestId: second.requestId, error: 'rejected'}]);
    // Positive control: another host's request is left queued.
    expect((await readDappSession(ext)).queue.find(e => e.requestId === elsewhere.requestId)?.state).toBe('queued');
  });
});

describe('dapp.decide — §2.3’s refusals, one row each', () => {
  it('head: not the head, or not queued; unknown id', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId: first} = await request(ext, deps, DAPP);
    const {requestId: second} = await request(ext, deps, JUP, 8);
    expect(await decide({requestId: second, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'not-head'});
    expect(await decide({requestId: 'A'.repeat(22), decision: 'reject'})).toEqual({ok: false, error: 'not-head'});
    // Positive control: the head is decidable.
    expect(await decide({requestId: first, decision: 'reject'})).toEqual({ok: true});
    expect(await decide({requestId: first, decision: 'reject'})).toEqual({ok: false, error: 'not-head'});
  });

  it('expiry: a request past five minutes', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    deps.clock.t += REQUEST_TTL_MS;
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'expired'});
    expect((await readDappSession(ext)).grants).toEqual([]);
  });

  it('unlocked: locked at the write — no grant written', async () => {
    const {ext, deps, decide} = await setup({unlocked: false});
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'locked'});
    // Review 1 L2: report and block write the user's lists — refused while locked too; nothing blocked.
    expect(await decide({requestId, decision: 'report'})).toEqual({ok: false, error: 'locked'});
    expect(await decide({requestId, decision: 'block'})).toEqual({ok: false, error: 'locked'});
    expect(await ext.local.get(BLOCKED_KEY)).toBeUndefined();
    // Reject works while locked (the locked screen's [Reject]).
    expect(await decide({requestId, decision: 'reject'})).toEqual({ok: true});
  });

  it('account: not one of the session’s accounts', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve', account: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', scope: 'session'})).toEqual({ok: false, error: 'unknown-account'});
    expect(await decide({requestId, decision: 'approve', scope: 'session'})).toEqual({ok: false, error: 'unknown-account'});
  });

  it('scope: persistent for an unknown or a lookalike origin (C12); session for them is fine', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: false, error: 'scope'});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: true});
    const {requestId: look} = await request(ext, deps, 'https://xn--phntom-4nf.app', 9);
    expect(await decide({requestId: look, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: false, error: 'scope'});
  });

  it('blocked: the host blocked, or the host or tab in cooldown, after the request was queued', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    await ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'blocked'});
    await ext.local.set(BLOCKED_KEY, []);
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: 'tab:7', until: deps.clock.t + 1}], windows: [], notice: false});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'blocked'});
  });

  it('cap: 200 persistent grants and none for this origin — only Reject (Q16)', async () => {
    const {ext, deps, decide} = await setup();
    await ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => grant(`https://s${i}.test`)));
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'cap'});
  });

  it('a second decide for a deciding entry is refused (not-head) — and dapp.pending shows it as deciding, never decidable', async () => {
    const {ext, deps, decide, pend} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: runtimeFor(ext).instance, decidingAt: deps.clock.t}))});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'not-head'});
    expect(await decide({requestId, decision: 'reject'})).toEqual({ok: false, error: 'not-head'});
    expect((await pend()).data.state).toBe('deciding');
  });

  it('malformed: a decision that is not one of the four', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve-all'})).toEqual({ok: false, error: 'malformed'});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'malformed'});
  });
});

describe('a worker restart after the request was shown (§1.5 step 5)', () => {
  it('the page gets the one answer through resume — never a second one, never re-run', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    restartRuntime(ext);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: true});
    const back = openPage(ext, deps, DAPP);
    expect(await back.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, result: {accounts: [ACCOUNT.publicKey]}}]});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'not-head'});
    expect((await readDappSession(ext)).grants).toHaveLength(1);
  });

  it('a lock between deciding and the effect: no grant is written', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, JUP);
    // The decision arms the auto-lock between the deciding section and the grant section: a lock lands right there.
    ext.alarms.create = () => lock(ext);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect((await readDappSession(ext)).grants).toEqual([]);
  });
});

describe('the effect section’s own re-checks (review 1 M4)', () => {
  it('a block between deciding and the grant: rejected, no grant written (review 1 M4 — the effect section re-checks the block)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, JUP);
    // Between the sections (the auto-lock is armed there) another window blocks the host.
    ext.alarms.create = async () => ext.local.set(BLOCKED_KEY, [{host: 'jup.ag', blockedAt: 1, imitates: null}]);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('an account removed between deciding and the grant: rejected, no grant for it (review 1 M4)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, JUP);
    // The removal leaves the session without ACCOUNT (as vault.storeEnvelope does); a deciding entry is not `queued`,
    // so dropAccountGrants's rejection does not reach it — the effect's own re-check must.
    ext.alarms.create = async () => setSession(ext, [SECOND]);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });
});

describe('#49’s messages: list, revoke + undo, revoke all, blocked, unblock (§2.7, §4.4)', () => {
  it('list: both scopes, each with its C7 name and the verified flag', async () => {
    const {ext, ui} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(JUP), grant('https://solana-mint-hub.xyz')]);
    const r = (await ui({type: 'dapp.grants.list'})) as {data: {grants: {origin: string; name: string; verified: boolean}[]}};
    expect(r.data.grants.map(g => [g.origin, g.name, g.verified])).toEqual([
      [JUP, 'Jupiter', true],
      ['https://solana-mint-hub.xyz', 'solana-mint-hub', false],
    ]);
  });

  it('revoke: the grant goes at once, change [] — Undo within five seconds restores exactly it and says change [account]', async () => {
    const {ext, deps, ui} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(JUP, {connectedAt: 5, lastUsedAt: 6})]);
    const page = openPage(ext, deps, JUP);
    const r = (await ui({type: 'dapp.grants.revoke', origin: JUP})) as {ok: boolean; data: {undoToken: string}};
    expect(r.ok).toBe(true);
    expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
    expect(await page.ask({type: 'page.connect', id: 's', silent: true})).toEqual({id: 's', result: {accounts: []}});
    expect(await ui({type: 'dapp.grants.undo', undoToken: r.data.undoToken})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([grant(JUP, {connectedAt: 5, lastUsedAt: 6})]);
    expect(page.changes()).toEqual([[], [ACCOUNT.publicKey]]);
    // Single-shot.
    expect(await ui({type: 'dapp.grants.undo', undoToken: r.data.undoToken})).toEqual({ok: false, error: 'unknown-token'});
  });

  it('undo refusals: expired, locked, blocked, granted again, account gone, cap, scope', async () => {
    const cases: [string, (c: Awaited<ReturnType<typeof setup>>) => Promise<void>, string, Grant][] = [
      ['expired', async c => void (c.deps.clock.t += UNDO_MS), 'unknown-token', grant(JUP)],
      ['locked', async c => lock(c.ext), 'unknown-token', grant(JUP)],
      ['blocked', async c => c.ext.local.set(BLOCKED_KEY, [{host: 'jup.ag', blockedAt: 1, imitates: null}]), 'blocked', grant(JUP)],
      ['granted', async c => c.ext.local.set(GRANTS_KEY, [grant(JUP, {connectedAt: 99})]), 'granted', grant(JUP)],
      ['account', async c => c.ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 1, name: 'Savings', publicKey: RECIPIENT}]}), 'unknown-account', grant(JUP)],
      ['cap', async c => c.ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => grant(`https://s${i}.test`))), 'cap', grant(JUP)],
      ['scope', async () => undefined, 'scope', grant(DAPP)],
    ];
    for (const [name, change, error, g] of cases) {
      const c = await setup();
      await c.ext.local.set(GRANTS_KEY, [g]);
      const r = (await c.ui({type: 'dapp.grants.revoke', origin: g.origin})) as {data: {undoToken: string}};
      await change(c);
      // A lock wipes the undo buffer with the session: the token is unknown then.
      if (name === 'locked') await setSession(c.ext, [ACCOUNT]);
      expect([name, await c.ui({type: 'dapp.grants.undo', undoToken: r.data.undoToken})]).toEqual([name, {ok: false, error}]);
    }
  });

  it('revoke all: every grant in both scopes, change [] to each, no undo', async () => {
    const {ext, deps, ui, decide} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(JUP)]);
    const {requestId} = await request(ext, deps, DAPP);
    await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'});
    const a = openPage(ext, deps, JUP, {tab: {id: 2}});
    const b = openPage(ext, deps, DAPP, {tab: {id: 3}});
    expect(await ui({type: 'dapp.grants.revokeAll'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
    expect((await readDappSession(ext)).grants).toEqual([]);
    expect([a.changes(), b.changes()]).toEqual([[[]], [[]]]);
  });

  it('unblock removes the block only: the grant the block revoked does not come back — the next connect opens #47 again', async () => {
    const {ext, deps, decide, ui} = await setup();
    // A grant on another port of the host: blocks are by host, every port and scheme (§2.6).
    await ext.local.set(GRANTS_KEY, [grant('https://dapp.test:8443')]);
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'block'})).toEqual({ok: true});
    expect(await ui({type: 'dapp.blocked.list'})).toEqual({ok: true, data: {blocked: [{host: 'dapp.test', blockedAt: deps.clock.t, imitates: null}]}});
    expect(await ui({type: 'dapp.blocked.remove', host: 'dapp.test'})).toEqual({ok: true});
    expect(await ui({type: 'dapp.blocked.list'})).toEqual({ok: true, data: {blocked: []}});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
    expect(await openPage(ext, deps, 'https://dapp.test:8443', {tab: {id: 6}}).ask({type: 'page.connect', id: 'n', silent: false})).toMatchObject({accepted: true});
  });

  it('refused while locked (a controller ruling, as contacts.*)', async () => {
    const {ui} = await setup({unlocked: false});
    for (const type of ['dapp.grants.list', 'dapp.grants.revokeAll', 'dapp.blocked.list']) expect(await ui({type})).toEqual({ok: false, error: 'locked'});
    expect(await ui({type: 'dapp.grants.revoke', origin: JUP})).toEqual({ok: false, error: 'locked'});
    expect(await ui({type: 'dapp.blocked.remove', host: 'x.test'})).toEqual({ok: false, error: 'locked'});
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/messages.test.ts src/background/dapp/__tests__/decide.test.ts
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  2 failed (2) · Tests  1 failed | 27 passed (28). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Create `extension/src/background/dapp/decide.ts`:

````ts
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {armAutolock} from '../autolock';
import {getSession} from '../session';
import {readWalletView} from '../accountsStore';
import {readSettings} from '../settings';
import {displayOrder} from '../walletApi';
import {isBlocked, withBlock} from './blocked';
import {classify, siteName, type IdnDetail, type LookalikeRule} from './classify';
import {MAX_GRANTS, type Grant} from './grants';
import {inCooldown, rejectionsOf, REJECTIONS_FOR_COOLDOWN} from './limits';
import {runtimeFor} from './ports';
import {answer, headOf, isOpenEntry, queueAccess, rejectQueued, userRejected, type Effects} from './queue';
import {dropGrant, grantIn, putGrant, type Decision, type Entry, type Tx} from './store';

/**
 * The approval window's two messages (spec §1.4, §2.3, C13, C17): `dapp.pending` — what the window shows — and
 * `dapp.decide` — validated here as if the window were untrusted (C13: "the window decides nothing"). A decision's
 * effect happens once (§1.5 step 2): `deciding` is written in the same queue section that passed the checks, and only
 * then does the effect run; its outcome is written as `answered` in a later section that first confirms the entry is
 * still this instance's `deciding` one (a lock in between answered it `rejected`, §2.4).
 */

/** What the origin card and the banners say about a site (§2.5, C7): never a name the page supplied. */
export interface SiteView {
  kind: 'verified' | 'unknown' | 'lookalike';
  /** C7: the known list's name for a verified host, else the host's second-level label — never the imitated brand. */
  name: string;
  /** The listed domain a lookalike imitates (shown only in the banner), or null. */
  imitates: string | null;
  rule: LookalikeRule | null;
  idn: IdnDetail | null;
  /** An `xn--` label anywhere in the host (47b's Q18 line for an unknown one). */
  international: boolean;
}

export function siteView(host: string): SiteView {
  const c = classify(host);
  return {
    kind: c.kind,
    name: siteName(host, c),
    imitates: c.kind === 'lookalike' ? c.imitates : null,
    rule: c.kind === 'lookalike' ? c.rule : null,
    idn: c.kind === 'lookalike' ? c.idn : null,
    international: c.kind === 'unknown' ? c.international : host.split('.').some(l => l.startsWith('xn--')),
  };
}

export interface AccountChoice {
  index: number;
  name: string;
  publicKey: string;
}

/** #47's details: the account picker (Q01; the wallet's unlocked accounts in display order, the active one chosen) and the cap (Q16). */
export interface ConnectDetail {
  accounts: AccountChoice[];
  selected: number;
  cap: boolean;
}

export interface RequestView {
  requestId: string;
  type: Entry['type'];
  origin: string;
  host: string;
  site: SiteView;
  /** C14: this host or tab already has two rejections in ten minutes — the screen offers [Block this site] (Q17). */
  offerBlock: boolean;
  /** Null while locked: the locked screen shows the origin card only (D11). */
  connect: ConnectDetail | null;
}

export type PendingView =
  | {state: 'none'}
  | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};

/** The wallet's accounts as the popup orders them (E14), only those unlocked, and the active one (C1: only a default). */
async function choices(ext: Ext, tx: Tx): Promise<{accounts: AccountChoice[]; selected: number}> {
  const [view, settings] = await Promise.all([readWalletView(ext), readSettings(ext)]);
  const unlocked = new Set((tx.session ?? []).map(a => a.publicKey));
  const accounts = displayOrder(view?.accounts ?? [], settings.accountOrder).filter(a => unlocked.has(a.publicKey));
  const selected = accounts.some(a => a.index === settings.selectedAccount) ? settings.selectedAccount : (accounts[0]?.index ?? 0);
  return {accounts: accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})), selected};
}

async function viewOf(ext: Ext, tx: Tx, e: Entry): Promise<RequestView> {
  const unlocked = tx.session !== null;
  let connect: ConnectDetail | null = null;
  if (unlocked && e.type === 'connect') {
    const c = await choices(ext, tx);
    connect = {...c, cap: grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS};
  }
  return {
    requestId: e.requestId,
    type: e.type,
    origin: e.origin,
    host: e.host,
    site: siteView(e.host),
    offerBlock: rejectionsOf(tx.limits, e.host, e.tabId) >= REJECTIONS_FOR_COOLDOWN - 1,
    connect,
  };
}

/**
 * dapp.pending (§2.3, §4.3): the head as the window shows it — a `deciding` head as `deciding` (never decidable),
 * `locked` while locked (D11), `none` when the queue is empty (the window closes itself) — with how many more wait (Q12)
 * and the budget notice (Q24, once). Records which request the window shows: closing the window rejects that one.
 */
export async function pending(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<PendingView> {
  return queueAccess(ext, deps, async (tx): Promise<PendingView> => {
    const h = headOf(tx);
    if (h === null) return {state: 'none'};
    if (tx.s.window !== null) tx.s.window = {...tx.s.window, showing: h.requestId};
    const windowNotice = tx.limits.notice;
    if (windowNotice) tx.limits = {...tx.limits, notice: false};
    const waiting = tx.s.queue.filter(isOpenEntry).length - 1;
    const state = tx.session === null ? 'locked' : h.state === 'deciding' ? 'deciding' : 'request';
    return {state, request: await viewOf(ext, tx, h), waiting, windowNotice};
  });
}

export type DecideError = 'malformed' | 'not-head' | 'expired' | 'locked' | 'unknown-account' | 'scope' | 'blocked' | 'cap' | 'no-grant' | 'account';
export interface DecideRequest {
  requestId: string;
  decision: Decision;
  account: string | null;
  scope: Grant['scope'] | null;
}

const DECISIONS: readonly string[] = ['approve', 'reject', 'report', 'block'];

/** dapp.decide's shape: a request id, a decision, and — for an approval — the account (and a connect's scope). */
export function decideRequestOf(msg: Record<string, unknown>): DecideRequest | null {
  const {requestId, decision, account, scope} = msg;
  if (typeof requestId !== 'string' || typeof decision !== 'string' || !DECISIONS.includes(decision)) return null;
  if (account !== undefined && typeof account !== 'string') return null;
  if (scope !== undefined && scope !== 'session' && scope !== 'persistent') return null;
  return {requestId, decision: decision as Decision, account: account ?? null, scope: scope ?? null};
}

/** Blocking a host (§2.6): every grant of that host (both scopes, every port and scheme) revoked, its queued requests rejected. */
export function blockHost(tx: Tx, fx: Effects, host: string): void {
  const imitates = siteView(host).imitates;
  tx.blocked = withBlock(tx.blocked, host, imitates, tx.now);
  const origins = new Set([...tx.s.grants, ...tx.grants].filter(g => hostOf(g.origin) === host).map(g => g.origin));
  for (const origin of origins) {
    dropGrant(tx, origin);
    fx.changes.set(origin, []);
  }
  rejectQueued(tx, fx, e => e.host === host);
}

export function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

/** §2.3's table, for an approval: each refusal in its row's order. Null: approvable. */
function approvalRefused(tx: Tx, e: Entry, d: DecideRequest): DecideError | null {
  // unlocked — read inside sessionMutex (dappSection), so a grant is never written after a concurrent lock.
  if (tx.session === null) return 'locked';
  if (d.account === null || !tx.session.some(a => a.publicKey === d.account)) return 'unknown-account';
  if (e.type === 'connect') {
    if (d.scope === null) return 'malformed';
    // C12: an unknown or lookalike origin can only get "This session only".
    if (d.scope === 'persistent' && classify(e.host).kind !== 'verified') return 'scope';
  }
  if (isBlocked(tx.blocked, e.host) || inCooldown(tx.limits, e.host, e.tabId, tx.now)) return 'blocked';
  // §2.1: beyond 200 persistent grants a connect has only [Reject] (Q16).
  if (e.type === 'connect' && grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS) return 'cap';
  if (e.type === 'signMessage') {
    // review 2 M9: the grant must still be held for the request's account.
    if (grantIn(tx, e.origin)?.account !== e.account) return 'no-grant';
    if (d.account !== e.account) return 'account';
  }
  return null;
}

/** The connect effect: the grant written and the request answered — in one section, only if still this instance's `deciding` entry. */
async function finishConnect(ext: Ext, deps: Pick<WalletDeps, 'now'>, requestId: string, instance: string): Promise<void> {
  await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.decision === null) return;
    const {account, scope} = e.decision;
    // The section's own checks again: a block or an account removed since `deciding` was written end it here (each
    // tested, review 1 M4). A lock cannot reach this line — the lock hook answers a `deciding` entry first — so
    // `tx.session === null` is the type's narrowing and a second line of defence.
    if (account === null || scope === null || tx.session === null || !tx.session.some(a => a.publicKey === account) || isBlocked(tx.blocked, e.host)) {
      answer(fx, e, {error: 'rejected'}, tx.now);
      return;
    }
    putGrant(tx, {origin: e.origin, account, scope, connectedAt: tx.now, lastUsedAt: tx.now, recent: [{type: 'connect', at: tx.now, outcome: 'approved'}]});
    answer(fx, e, {result: {accounts: [account]}}, tx.now);
  });
}

/** dapp.decide (§2.3): one refusal per row of the table, else the decision — a reject at once, an approval through `deciding`. */
export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Promise<{ok: true} | {ok: false; error: DecideError}> {
  const instance = runtimeFor(ext).instance;
  const out = await queueAccess(ext, deps, (tx, fx): DecideError | {approved: Entry['type']} | 'done' => {
    const e = tx.s.queue.find(x => x.requestId === d.requestId);
    // expiry: the sweep at the top of this section has answered an expired request `timeout`.
    if (e?.state === 'answered' && e.answer !== null && 'error' in e.answer && e.answer.error === 'timeout') return 'expired';
    // head: only the queue head, and only while `queued` (a `deciding` one is never decided twice).
    if (e === undefined || headOf(tx) !== e || e.state !== 'queued') return 'not-head';
    if (d.decision === 'reject') {
      userRejected(tx, fx, e);
      return 'done';
    }
    if (d.decision === 'report' || d.decision === 'block') {
      // Review 1 L2: a block writes the user's lists (it revokes grants) — refused while locked, as #49's messages are
      // (R8); the locked screen offers only [Reject].
      if (tx.session === null) return 'locked';
      userRejected(tx, fx, e);
      blockHost(tx, fx, e.host);
      return 'done';
    }
    const refused = approvalRefused(tx, e, d);
    if (refused !== null) return refused;
    e.state = 'deciding';
    e.decidedBy = instance;
    e.decidingAt = tx.now;
    e.decision = {kind: 'approve', account: d.account, scope: e.type === 'connect' ? d.scope : null};
    return {approved: e.type};
  });
  if (typeof out === 'string' && out !== 'done') return {ok: false, error: out};
  // §2.2: a decision in the window is a user action — it arms the auto-lock timer (page requests never do).
  if ((await getSession(ext)) !== null) await armAutolock(ext).catch(e => console.warn('dApp decide: the idle timer was not re-armed', e));
  if (typeof out === 'object') await finishConnect(ext, deps, d.requestId, instance);
  return {ok: true};
}
````

Create `extension/src/background/dapp/grantsApi.ts`:

````ts
import {base64urlnopad} from '@scure/base';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {readWalletView} from '../accountsStore';
import {isBlocked, withoutBlock, type Blocked} from './blocked';
import {hostOf, siteView} from './decide';
import {MAX_GRANTS, type Grant, type Recent} from './grants';
import {queueAccess, rejectQueued} from './queue';
import {dropGrant, grantIn, putGrant} from './store';

/**
 * #49's messages (spec §1.4, §2.7, §4.4, D3, C2): the grants list, revoke with a single-shot undo, revoke-all, and the
 * blocked sites with unblock — from the popup or the tab only (messages.ts). Every one is refused while locked: the
 * list says which sites the user connects to (a controller ruling, as contacts.* — B1b-2b C12). The popup holds only
 * an undo token; the record stays in the background (review H2: the popup is never a grant writer).
 */
export const UNDO_MS = 5_000;
const TOKEN = /^[A-Za-z0-9_-]{22}$/;

export interface GrantView {
  origin: string;
  host: string;
  /** C7: the list name for a verified host, else the second-level label. */
  name: string;
  /** On the known list (#49's dot, §9). */
  verified: boolean;
  account: string;
  scope: Grant['scope'];
  connectedAt: number;
  lastUsedAt: number;
  recent: Recent[];
}

function viewOf(g: Grant): GrantView {
  const host = hostOf(g.origin);
  const site = siteView(host);
  return {origin: g.origin, host, name: site.name, verified: site.kind === 'verified', account: g.account, scope: g.scope, connectedAt: g.connectedAt, lastUsedAt: g.lastUsedAt, recent: g.recent};
}

export type Locked = {ok: false; error: 'locked'};
const LOCKED: Locked = {ok: false, error: 'locked'};

/** dapp.grants.list: persistent and (unlocked, so always here) session grants. */
export async function listGrants(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<{ok: true; data: {grants: GrantView[]}} | Locked> {
  return queueAccess(ext, deps, tx => (tx.session === null ? LOCKED : {ok: true as const, data: {grants: [...tx.s.grants, ...tx.grants].map(viewOf)}}));
}

/** dapp.grants.revoke {origin} (§2.7): the grant goes at once, `change []`, its queued requests rejected; an undo token for five seconds. */
export async function revokeGrant(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, origin: unknown) {
  if (typeof origin !== 'string') return {ok: false as const, error: 'malformed' as const};
  return queueAccess(ext, deps, (tx, fx) => {
    if (tx.session === null) return LOCKED;
    const g = dropGrant(tx, origin);
    if (g === null) return {ok: false as const, error: 'unknown-origin' as const};
    fx.changes.set(origin, []);
    rejectQueued(tx, fx, e => e.origin === origin);
    const token = base64urlnopad.encode(deps.randomBytes(16));
    tx.s.undo = [...tx.s.undo, {token, grant: g, expiresAt: tx.now + UNDO_MS}];
    return {ok: true as const, data: {undoToken: token}};
  });
}

export type UndoError = 'malformed' | 'locked' | 'unknown-token' | 'blocked' | 'granted' | 'unknown-account' | 'cap' | 'scope';

/**
 * dapp.grants.undo {undoToken} (§2.7): restores THAT record, single-shot — the token is spent by any attempt. Refused:
 * unknown or expired; locked; the host now blocked; the origin granted again meanwhile (never overwritten, review 2
 * L10); the account no longer in the wallet; the persistent cap reached; a persistent grant whose origin no longer
 * classifies verified (C12 holds on restore too).
 */
export async function undoRevoke(ext: Ext, deps: Pick<WalletDeps, 'now'>, token: unknown): Promise<{ok: true} | {ok: false; error: UndoError}> {
  if (typeof token !== 'string' || !TOKEN.test(token)) return {ok: false, error: 'malformed'};
  const view = await readWalletView(ext);
  const wallet = new Set((view?.accounts ?? []).map(a => a.publicKey));
  return queueAccess(ext, deps, (tx, fx): {ok: true} | {ok: false; error: UndoError} => {
    const record = tx.s.undo.find(u => u.token === token);
    tx.s.undo = tx.s.undo.filter(u => u.token !== token);
    if (record === undefined || record.expiresAt <= tx.now) return {ok: false, error: 'unknown-token'};
    if (tx.session === null) return {ok: false, error: 'locked'};
    const g = record.grant;
    const host = hostOf(g.origin);
    if (isBlocked(tx.blocked, host)) return {ok: false, error: 'blocked'};
    if (grantIn(tx, g.origin) !== null) return {ok: false, error: 'granted'};
    if (!wallet.has(g.account) || !tx.session.some(a => a.publicKey === g.account)) return {ok: false, error: 'unknown-account'};
    if (g.scope === 'persistent' && tx.grants.length >= MAX_GRANTS) return {ok: false, error: 'cap'};
    if (g.scope === 'persistent' && siteView(host).kind !== 'verified') return {ok: false, error: 'scope'};
    putGrant(tx, g);
    fx.changes.set(g.origin, [g.account]);
    return {ok: true};
  });
}

/** dapp.grants.revokeAll (49d): every grant, both scopes; `change []` to each; their queued requests rejected. No undo. */
export async function revokeAll(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<{ok: true} | Locked> {
  return queueAccess(ext, deps, (tx, fx) => {
    if (tx.session === null) return LOCKED;
    const origins = new Set([...tx.s.grants, ...tx.grants].map(g => g.origin));
    tx.s.grants = [];
    tx.grants = [];
    for (const o of origins) fx.changes.set(o, []);
    rejectQueued(tx, fx, e => origins.has(e.origin));
    return {ok: true as const};
  });
}

/** dapp.blocked.list (D3, Q13). */
export async function listBlocked(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<{ok: true; data: {blocked: Blocked[]}} | Locked> {
  return queueAccess(ext, deps, tx => (tx.session === null ? LOCKED : {ok: true as const, data: {blocked: tx.blocked}}));
}

/** dapp.blocked.remove {host} (§2.6): the block only — no grant comes back; the next connect shows #47. */
export async function unblock(ext: Ext, deps: Pick<WalletDeps, 'now'>, host: unknown) {
  if (typeof host !== 'string') return {ok: false as const, error: 'malformed' as const};
  return queueAccess(ext, deps, tx => {
    if (tx.session === null) return LOCKED;
    tx.blocked = withoutBlock(tx.blocked, host);
    return {ok: true as const};
  });
}
````

Modify `extension/src/background/messages.ts`:

````diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -12,6 +12,8 @@ import {isOpen, readPending} from './pendingStore';
 import {startPoller} from './pending';
 import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
 import {PAGE_TYPES} from './dapp/pageApi';
+import {decide, decideRequestOf, pending} from './dapp/decide';
+import {listBlocked, listGrants, revokeAll, revokeGrant, undoRevoke, unblock} from './dapp/grantsApi';
 
 /** What the browser reports about a message's origin (runtime.MessageSender). */
 export interface Sender {
@@ -45,6 +47,15 @@ export const PRIVILEGED = [
   'vault.phraseVerified',
   'activity.ping',
   ...WALLET_TYPES,
+  // B1c §1.4: the approval window's two, and #49's.
+  'dapp.pending',
+  'dapp.decide',
+  'dapp.grants.list',
+  'dapp.grants.revoke',
+  'dapp.grants.undo',
+  'dapp.grants.revokeAll',
+  'dapp.blocked.list',
+  'dapp.blocked.remove',
 ] as const;
 /**
  * Only the vault page itself may hand over keys, report a re-authentication it proved, hand over
@@ -64,6 +75,10 @@ const VAULT_PAGE_ONLY: readonly string[] = [
   'vault.removePasskey',
   'vault.phraseVerified',
 ];
+/** B1c §1.4: the approval window's messages come from approve.html only (sender.origin ours, the path /approve.html). */
+const APPROVE_PAGE_ONLY: readonly string[] = ['dapp.pending', 'dapp.decide'];
+/** …and #49's from the popup or the UI tab only — never the approval window a site caused, nor the vault page. */
+const WALLET_UI_ONLY: readonly string[] = ['dapp.grants.list', 'dapp.grants.revoke', 'dapp.grants.undo', 'dapp.grants.revokeAll', 'dapp.blocked.list', 'dapp.blocked.remove'];
 export const PAGE: readonly string[] = PAGE_TYPES;
 
 function isOwnPage(ext: Ext, s: Sender): boolean {
@@ -133,6 +148,8 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
   if (!privileged) return {ok: false, error: 'forbidden'};
   if (!isOwnPage(ext, sender)) return {ok: false, error: 'forbidden'};
   if (VAULT_PAGE_ONLY.includes(type) && pagePath(ext, sender) !== '/unlock.html') return {ok: false, error: 'forbidden'};
+  if (APPROVE_PAGE_ONLY.includes(type) && pagePath(ext, sender) !== '/approve.html') return {ok: false, error: 'forbidden'};
+  if (WALLET_UI_ONLY.includes(type) && pagePath(ext, sender) !== '/popup.html' && pagePath(ext, sender) !== '/wallet.html') return {ok: false, error: 'forbidden'};
 
   switch (type) {
     case 'vault.setKeys': {
@@ -259,6 +276,25 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
         return {ok: false, error: 'failed'};
       }
     }
+    case 'dapp.pending':
+      return deps === undefined ? {ok: false, error: 'unavailable'} : {ok: true, data: await pending(ext, deps)};
+    case 'dapp.decide': {
+      if (deps === undefined) return {ok: false, error: 'unavailable'};
+      const d = decideRequestOf(msg as Record<string, unknown>);
+      return d === null ? {ok: false, error: 'malformed'} : decide(ext, deps, d);
+    }
+    case 'dapp.grants.list':
+      return deps === undefined ? {ok: false, error: 'unavailable'} : listGrants(ext, deps);
+    case 'dapp.grants.revoke':
+      return deps === undefined ? {ok: false, error: 'unavailable'} : revokeGrant(ext, deps, (msg as {origin?: unknown}).origin);
+    case 'dapp.grants.undo':
+      return deps === undefined ? {ok: false, error: 'unavailable'} : undoRevoke(ext, deps, (msg as {undoToken?: unknown}).undoToken);
+    case 'dapp.grants.revokeAll':
+      return deps === undefined ? {ok: false, error: 'unavailable'} : revokeAll(ext, deps);
+    case 'dapp.blocked.list':
+      return deps === undefined ? {ok: false, error: 'unavailable'} : listBlocked(ext, deps);
+    case 'dapp.blocked.remove':
+      return deps === undefined ? {ok: false, error: 'unavailable'} : unblock(ext, deps, (msg as {host?: unknown}).host);
     case 'vault.storeEnvelope': {
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
       const r = await storeEnvelope(ext, expectedRevision, envelope);
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/messages.test.ts src/background/dapp/__tests__/decide.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  2 passed (2) · Tests  59 passed (59); tsc clean; whole suite Test Files  144 passed (144) · Tests  2918 passed (2918); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M4a** — decide accepts a request that is not the head — `extension/src/background/dapp/decide.ts`:

  ```diff
  - if (e === undefined || headOf(tx) !== e || e.state !== 'queued') return 'not-head';
  + if (e === undefined || e.state !== 'queued') return 'not-head';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4b** — decide does not tell an expired request (§2.3 "expiry" row) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -     if (e?.state === 'answered' && e.answer !== null && 'error' in e.answer && e.answer.error === 'timeout') return 'expired';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4c** — decide does not check the lock at the write ("unlocked" row) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -   if (tx.session === null) return 'locked';
  -   if (d.account === null
  +   if (tx.session === null) return 'unknown-account';
  +   if (d.account === null
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4d** — decide accepts an account outside the session ("account" row) — `extension/src/background/dapp/decide.ts`:

  ```diff
  - if (d.account === null || !tx.session.some(a => a.publicKey === d.account)) return 'unknown-account';
  + if (d.account === null) return 'unknown-account';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4e** — persistent scope for an unknown or lookalike origin (C12, "scope" row) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -     if (d.scope === 'persistent' && classify(e.host).kind !== 'verified') return 'scope';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4f** — decide ignores a block or cooldown ("blocked" row) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -   if (isBlocked(tx.blocked, e.host) || inCooldown(tx.limits, e.host, e.tabId, tx.now)) return 'blocked';
  +   if ((isBlocked(tx.blocked, e.host) || inCooldown(tx.limits, e.host, e.tabId, tx.now)) && false) return 'blocked';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4g** — no cap (Q16) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -   if (e.type === 'connect' && grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS) return 'cap';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4k** — Reject and report does not block (D3) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -       userRejected(tx, fx, e);
  -       blockHost(tx, fx, e.host);
  +       userRejected(tx, fx, e);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  3 failed | 28 passed (31)).

- **M4l** — blocking keeps the grant (§2.6, spec mutation "keep the grant") — `extension/src/background/dapp/decide.ts`:

  ```diff
  -   for (const origin of origins) {
  -     dropGrant(tx, origin);
  -     fx.changes.set(origin, []);
  -   }
  +   for (const origin of origins) {
  +     void dropGrant;
  +     fx.changes.set(origin, []);
  +   }
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 29 passed (31)).

- **M4n** — undo is not single-shot — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -     tx.s.undo = tx.s.undo.filter(u => u.token !== token);
  -     if (record === undefined
  +     if (record === undefined
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4o** — undo overwrites a grant approved meanwhile (review 2 L10) — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -     if (grantIn(tx, g.origin) !== null) return {ok: false, error: 'granted'};
  +     if (grantIn(tx, g.origin) !== null && false) return {ok: false, error: 'granted'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4p** — undo restores a blocked host — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -     if (isBlocked(tx.blocked, host)) return {ok: false, error: 'blocked'};
  +     if (isBlocked(tx.blocked, host) && false) return {ok: false, error: 'blocked'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4q** — undo restores an account no longer in the wallet — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -     if (!wallet.has(g.account) || !tx.session.some(a => a.publicKey === g.account)) return {ok: false, error: 'unknown-account'};
  +     if ((!wallet.has(g.account) || !tx.session.some(a => a.publicKey === g.account)) && false) return {ok: false, error: 'unknown-account'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4r** — undo past the cap — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -     if (g.scope === 'persistent' && tx.grants.length >= MAX_GRANTS) return {ok: false, error: 'cap'};
  +     if (g.scope === 'persistent' && tx.grants.length >= MAX_GRANTS && false) return {ok: false, error: 'cap'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4s** — undo of a persistent grant for a non-verified origin (C12 on restore) — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -     if (g.scope === 'persistent' && siteView(host).kind !== 'verified') return {ok: false, error: 'scope'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4t** — dapp.pending does not record the shown request — `extension/src/background/dapp/decide.ts`:

  ```diff
  -     if (tx.s.window !== null) tx.s.window = {...tx.s.window, showing: h.requestId};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4u** — dapp.pending / dapp.decide from any own page — `extension/src/background/messages.ts`:

  ```diff
  -   if (APPROVE_PAGE_ONLY.includes(type) && pagePath(ext, sender) !== '/approve.html') return {ok: false, error: 'forbidden'};
  +   if (APPROVE_PAGE_ONLY.includes(type) && pagePath(ext, sender) !== '/approve.html' && false) return {ok: false, error: 'forbidden'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4v** — the connect effect writes the grant although the host was blocked meanwhile — `extension/src/background/dapp/decide.ts`:

  ```diff
  -  || isBlocked(tx.blocked, e.host)) {
  -       answer(fx, e, {error: 'rejected'}, tx.now);
  + ) {
  +       answer(fx, e, {error: 'rejected'}, tx.now);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4w** — the connect effect writes a grant for an account removed meanwhile — `extension/src/background/dapp/decide.ts`:

  ```diff
  - tx.session === null || !tx.session.some(a => a.publicKey === account) || isBlocked
  + tx.session === null || isBlocked
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4x** — block leaves the host's other queued requests — `extension/src/background/dapp/decide.ts`:

  ```diff
  -   rejectQueued(tx, fx, e => e.host === host);
  +   rejectQueued(tx, fx, e => e.host === host && false);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M4z** — report / block accepted while locked — `extension/src/background/dapp/decide.ts`:

  ```diff
  -       if (tx.session === null) return 'locked';
  -       userRejected(tx, fx, e);
  -       blockHost
  +       userRejected(tx, fx, e);
  +       blockHost
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/messages.test.ts extension/src/background/dapp/__tests__/decide.test.ts extension/src/background/dapp/decide.ts extension/src/background/dapp/grantsApi.ts extension/src/background/messages.ts
git commit -F - <<'MSG'
feat(extension): B1c dapp.pending / dapp.decide (§2.3 table, deciding) and #49 messages (revoke + undo, block)

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 5: The lock hook (`lock()` rewritten — one `sessionMutex` section — and every caller), the unlock hook, an account removed

**Spec:** §2.4 (both hooks, the caller list, the second pass), §2.1 (an account removed), §2.2 (D5), §5 ("the wallet locks while a window is open"), D4, D5, review 2 M6, M7, M9; §6.1 "Unlock hook", "Lock hook"; Scope R10; plan review 1 M4, L6

**Files:**
- Modify: `extension/src/background/accountsStore.ts`
- Modify: `extension/src/background/autolock.ts`
- Test: `extension/src/background/dapp/__tests__/decide.test.ts`
- Test: `extension/src/background/dapp/__tests__/lifecycle.test.ts`
- Test: `extension/src/background/dapp/__tests__/lockHook.test.ts` (new)
- Modify: `extension/src/background/dapp/grantsApi.ts`
- Create: `extension/src/background/dapp/lockHook.ts`
- Modify: `extension/src/background/dapp/ports.ts`
- Modify: `extension/src/background/dapp/queue.ts`
- Create: `extension/src/background/dapp/unlockHook.ts`
- Modify: `extension/src/background/messages.ts`

**Interfaces:**
- Consumes: Tasks 2–4: `readDappSession`, `DAPP_SESSION_KEY`, `EMPTY_SESSION`, `grantsOf`, `liveOrigins`, `deliver`, `sendChange`, `runtimeFor`, `queueAccess`, `rejectQueued`, `dropGrant`, `isBlocked`, `putGrant`.
- Produces (as exported):
  - `lockHook.ts`: `interface LockOutcome {windowId; answered; notify}`, `lockInSection(ext, now)`, `afterLock(ext, o)`.
  - `autolock.ts`: `lock(ext: Ext, now?: () => number): Promise<void>` (same callers, same signature).
  - `unlockHook.ts`: `unlockWork(tx, changes, answer)`.
  - `ports.ts`: `Runtime.hooked: boolean`.
  - `queue.ts`: `sweep(tx, fx, rt): boolean` (true when the hook ran), `runUnlockHook(ext, deps)`.
  - `grantsApi.ts`: `dropAccountGrants(ext, deps, publicKeys)`.
  - `accountsStore.ts`: `storeEnvelope(ext, expectedRevision, envelope, onDropped?)`.

`lock()` is the hook (review 2 M6): one `sessionMutex` section reads the queue, the recorded window and which open ports' origins hold a grant, clears the whole session area with `ext.session.clear()` (not `clearSession`, which would take the mutex again), and writes back the answered entries plus every formerly open one answered `rejected` (a `deciding` one as a restart — nothing has left the extension), so a relay's resume still finds them. Then the alarm is cleared, the window closed (`windows.remove`, errors ignored — closing it fires `onWindowRemoved`, whose second lock finds nothing and does not throw) and `change []` sent to granted origins' ports only (review M3). Every caller keeps calling `lock()` from outside `sessionMutex`: the auto-lock alarm, `vault.lock` (and the vault page's `lockOnMismatch`), `onStartup`, `onWindowRemoved`, `forgetWallet`, `vault.setKeys`'s failure path — a test each. The unlock hook (review 2 M7) is part of the first queue access of an unlocked session in this background instance (R10): each queued connect of a persistent-grant origin is answered `{accounts: [granted]}` — the grant, the account and the block re-checked at that moment — and `change [granted]` goes to those origins' open ports; the rest waits for the window's next poll. `vault.setKeys` makes that access right after `setSessionIf` and the auto-lock; if it throws, the session stays unlocked and the next access runs it again. The hook's flag is written inside the section (review 1 L6) and cleared again if the commit fails. An account removed by `vault.storeEnvelope` takes its grants with it (both scopes, `change []`, queued requests rejected — review 2 M9; the queued case is tested in Task 6, review 1 M3).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/dapp/__tests__/decide.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/decide.test.ts b/extension/src/background/dapp/__tests__/decide.test.ts
--- a/extension/src/background/dapp/__tests__/decide.test.ts
+++ b/extension/src/background/dapp/__tests__/decide.test.ts
@@ -6,7 +6,7 @@ import {SETTINGS_KEY} from '../../settings';
 import {GRANTS_KEY, MAX_GRANTS, type Grant} from '../grants';
 import {BLOCKED_KEY} from '../blocked';
 import {LIMITS_KEY} from '../limits';
-import {REQUEST_TTL_MS} from '../queue';
+import {REQUEST_TTL_MS, runUnlockHook} from '../queue';
 import {DAPP_SESSION_KEY, readDappSession, type Entry} from '../store';
 import {restartRuntime, runtimeFor} from '../ports';
 import {UNDO_MS} from '../grantsApi';
@@ -25,6 +25,8 @@ async function setup(o: {unlocked?: boolean} = {}) {
   const deps = fakeDeps();
   await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}, {index: 1, name: 'Savings', publicKey: RECIPIENT}]});
   if (o.unlocked !== false) await setSession(ext, [ACCOUNT, SECOND]);
+  // Written directly: the session's unlock hook runs before any page opens (as vault.setKeys runs it).
+  if (o.unlocked !== false) await runUnlockHook(ext, deps);
   const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
   const popup = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`};
   const pend = async () => (await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)) as {ok: boolean; data: Record<string, unknown> & {state: string; request: Record<string, unknown>}};
@@ -291,14 +293,15 @@ describe('a worker restart after the request was shown (§1.5 step 5)', () => {
     expect((await readDappSession(ext)).grants).toHaveLength(1);
   });
 
-  it('a lock between deciding and the effect: no grant is written', async () => {
+  it('a lock between deciding and the effect: no grant is written, the page gets rejected (the lock hook, §2.4)', async () => {
     const {ext, deps, decide} = await setup();
-    const {requestId} = await request(ext, deps, JUP);
+    const {page, requestId} = await request(ext, deps, JUP);
     // The decision arms the auto-lock between the deciding section and the grant section: a lock lands right there.
     ext.alarms.create = () => lock(ext);
     expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
     expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
     expect((await readDappSession(ext)).grants).toEqual([]);
+    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
   });
 });
 
````

Modify `extension/src/background/dapp/__tests__/lifecycle.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/lifecycle.test.ts b/extension/src/background/dapp/__tests__/lifecycle.test.ts
--- a/extension/src/background/dapp/__tests__/lifecycle.test.ts
+++ b/extension/src/background/dapp/__tests__/lifecycle.test.ts
@@ -4,7 +4,7 @@ import {getSession, setSession} from '../../session';
 import {GRANTS_KEY, type Grant} from '../grants';
 import {BLOCKED_KEY} from '../blocked';
 import {LIMITS_KEY, WINDOW_BUDGET} from '../limits';
-import {DECIDING_TTL_MS, MAX_OPEN, QUEUE_ALARM, REQUEST_TTL_MS, ANSWER_TTL_MS} from '../queue';
+import {DECIDING_TTL_MS, MAX_OPEN, QUEUE_ALARM, REQUEST_TTL_MS, ANSWER_TTL_MS, runUnlockHook} from '../queue';
 import {DAPP_SESSION_KEY, readDappSession} from '../store';
 import {OPENING_STALE_MS, WINDOW_HEIGHT, WINDOW_WIDTH, ensureWindow, onApprovalWindowRemoved, onQueueAlarm} from '../window';
 import {restartRuntime, runtimeFor} from '../ports';
@@ -21,7 +21,9 @@ const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, ac
 async function setup(o: {unlocked?: boolean} = {}) {
   const ext = fakeExt();
   const deps = fakeDeps();
+  // Written directly: the session's unlock hook runs before any page opens (as vault.setKeys runs it).
   if (o.unlocked !== false) await setSession(ext, [ACCOUNT]);
+  if (o.unlocked !== false) await runUnlockHook(ext, deps);
   return {ext, deps};
 }
 const queue = async (ext: ReturnType<typeof fakeExt>) => (await readDappSession(ext)).queue;
````

Create `extension/src/background/dapp/__tests__/lockHook.test.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {handleMessage} from '../../messages';
import {lock, onWindowRemoved, AUTOLOCK_ALARM} from '../../autolock';
import {SESSION_KEY, getSession, setSession} from '../../session';
import {VAULT_KEY, forgetWallet} from '../../accountsStore';
import {GRANTS_KEY, type Grant} from '../grants';
import {BLOCKED_KEY} from '../blocked';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {runtimeFor} from '../ports';
import {envelopeRevision} from '../../../shared/envelopeRevision';
import {fakeExt, memKV} from '../../__tests__/fakeExt';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {ACCOUNT} from '../../__tests__/fixtures';
import {runUnlockHook} from '../queue';
import {openPage} from './pageHarness';

const DAPP = 'https://dapp.test';
const JUP = 'https://jup.ag';
/** A second real keypair (32 × 0x02 seed): vault.setKeys checks every key against its address. */
const SEED2 = new Uint8Array(32).fill(2);
const PUB2 = ed25519.getPublicKey(SEED2);
const SECOND = {index: 1, publicKey: base58.encode(PUB2), secretKey: base64.encode(new Uint8Array([...SEED2, ...PUB2]))};
const RECIPIENT = SECOND.publicKey;
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: RECIPIENT},
  ],
};

/** A wallet unlocked with a queued connect from DAPP (a window open for it), a granted JUP page and an ungranted OTHER page. */
async function scene() {
  const ext = fakeExt();
  const deps = fakeDeps({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []})});
  await ext.local.set(VAULT_KEY, STORED);
  await setSession(ext, [ACCOUNT, SECOND]);
  await ext.local.set(GRANTS_KEY, [grant(JUP)]);
  const page = openPage(ext, deps, DAPP);
  const r = await page.ask({type: 'page.connect', id: 'c1', silent: false});
  const granted = openPage(ext, deps, JUP, {tab: {id: 8}});
  const ungranted = openPage(ext, deps, 'https://other.test', {tab: {id: 9}});
  return {ext, deps, page, granted, ungranted, requestId: String(r?.requestId)};
}
type Scene = Awaited<ReturnType<typeof scene>>;

/** What every lock must leave: no keys; the queued request answered rejected, stored for resume; the window closed; change [] to the granted page only. */
async function expectHooked(c: Scene): Promise<void> {
  expect(await getSession(c.ext)).toBeNull();
  expect((await readDappSession(c.ext)).queue.map(e => [e.requestId, e.state, e.answer])).toEqual([[c.requestId, 'answered', {error: 'rejected'}]]);
  expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
  expect(c.ext.approval.removed).toContain(100);
  expect(c.granted.changes()).toEqual([[]]);
  expect(c.ungranted.changes()).toEqual([]);
  expect(c.page.changes()).toEqual([]);
}

// Spec §2.4 (review H3, review 2 M6, M7, M9; D4, D5): lock() is the hook — one test per caller — and the unlock hook.
describe('the lock hook — one test per caller', () => {
  it('lock() itself: everything above; session grants wiped, persistent kept; the resume still finds the answer', async () => {
    const c = await scene();
    await c.ext.session.set(DAPP_SESSION_KEY, {...(await readDappSession(c.ext)), grants: [grant('https://s.test', {scope: 'session'})]});
    await lock(c.ext);
    await expectHooked(c);
    expect((await readDappSession(c.ext)).grants).toEqual([]);
    expect(await c.ext.local.get(GRANTS_KEY)).toEqual([grant(JUP)]);
    const back = openPage(c.ext, c.deps, DAPP);
    expect(await back.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, error: 'rejected'}]});
  });

  it('vault.lock (what the vault page’s lockOnMismatch sends)', async () => {
    const c = await scene();
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    expect(await handleMessage(c.ext, {type: 'vault.lock'}, popup, c.deps)).toEqual({ok: true});
    await expectHooked(c);
  });

  it('onWindowRemoved: the last browser window closed', async () => {
    const c = await scene();
    c.ext.windows = 0;
    await onWindowRemoved(c.ext);
    await expectHooked(c);
  });

  it('forgetWallet: a delete locks first', async () => {
    const c = await scene();
    expect(await forgetWallet(c.ext, c.deps, {expectedRevision: envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0])})).toBe('forgotten');
    await expectHooked(c);
    // …and then the wallet's grants go with it (C11).
    expect(await c.ext.local.get(GRANTS_KEY)).toBeUndefined();
  });

  it('vault.setKeys’s failure path: the auto-lock alarm refused', async () => {
    const c = await scene();
    const unlock = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/unlock.html`};
    c.ext.alarms.create = () => Promise.reject(new Error('alarm refused'));
    await expect(handleMessage(c.ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, unlock, c.deps)).rejects.toThrow('alarm refused');
    await expectHooked(c);
  });

  it('the auto-lock alarm and onStartup (the background’s own listeners)', async () => {
    for (const fire of ['alarm', 'startup'] as const) {
      const c = await scene();
      const listeners: Record<string, (x?: unknown) => void> = {};
      const on = (name: string) => ({addListener: (cb: (x?: unknown) => void) => void (listeners[name] = cb)});
      const area = (kv: ReturnType<typeof memKV>) => ({
        get: async (k: string) => (kv.data.has(k) ? {[k]: kv.data.get(k)} : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) await kv.set(k, v);
        },
        remove: (k: string) => kv.remove(k),
        clear: () => kv.clear(),
      });
      vi.stubGlobal('chrome', {
        runtime: {id: c.ext.runtimeId, getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('message'), onConnect: on('connect'), onStartup: on('startup'), onInstalled: on('installed')},
        tabs: {create: async () => undefined},
        storage: {session: {...area(c.ext.session as ReturnType<typeof memKV>), setAccessLevel: async () => undefined}, local: area(c.ext.local as ReturnType<typeof memKV>)},
        alarms: {create: () => undefined, clear: async () => true, onAlarm: on('alarm')},
        windows: {getAll: async () => [], onRemoved: on('removed'), create: async () => ({id: 1}), get: async () => ({}), remove: async (id: number) => void c.ext.approval.removed.push(id)},
      });
      vi.resetModules();
      try {
        await import('../../index');
        if (fire === 'alarm') listeners.alarm?.({name: AUTOLOCK_ALARM});
        else listeners.startup?.();
        await vi.waitFor(async () => expect(await c.ext.session.get(SESSION_KEY)).toBeUndefined());
        await vi.waitFor(() => expect(c.ext.approval.removed).toContain(100));
        const s = (await c.ext.session.get(DAPP_SESSION_KEY)) as {queue: {state: string; answer: unknown}[]};
        expect([fire, s.queue.map(e => [e.state, e.answer])]).toEqual([fire, [['answered', {error: 'rejected'}]]]);
      } finally {
        vi.unstubAllGlobals();
        vi.resetModules();
      }
    }
  });

  it('a deciding entry is answered rejected by the lock (a restart: nothing left the extension); an answered one is kept as it was', async () => {
    const c = await scene();
    const s = await readDappSession(c.ext);
    const answered = {...s.queue[0]!, requestId: 'B'.repeat(22), state: 'answered' as const, answer: {result: {accounts: ['x']}}, answeredAt: 5};
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: [{...s.queue[0]!, state: 'deciding', decidedBy: runtimeFor(c.ext).instance, decidingAt: c.deps.clock.t}, answered]});
    await lock(c.ext);
    expect((await readDappSession(c.ext)).queue.map(e => [e.state, e.answer])).toEqual([
      ['answered', {error: 'rejected'}],
      ['answered', {result: {accounts: ['x']}}],
    ]);
  });

  it('closing the window fires onWindowRemoved, which may lock again: the second pass finds nothing and does not throw', async () => {
    const c = await scene();
    await lock(c.ext);
    await expect(lock(c.ext)).resolves.toBeUndefined();
    expect(c.page.answersFor(c.requestId)).toHaveLength(1);
  });

  it('the approval popup counts as a window: closing the last browser window while it is open does not lock (review 2 L9)', async () => {
    const c = await scene();
    c.ext.windows = 1;
    await onWindowRemoved(c.ext);
    expect(await getSession(c.ext)).not.toBeNull();
  });
});

describe('the unlock hook (§2.4, D5)', () => {
  async function lockedWithQueuedGrantedConnect() {
    const ext = fakeExt();
    const deps = fakeDeps();
    await ext.local.set(VAULT_KEY, STORED);
    await ext.local.set(GRANTS_KEY, [grant(JUP)]);
    const page = openPage(ext, deps, JUP);
    const r = await page.ask({type: 'page.connect', id: 'c1', silent: false});
    const unknown = openPage(ext, deps, DAPP, {tab: {id: 9}});
    const u = await unknown.ask({type: 'page.connect', id: 'c2', silent: false});
    const unlock = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/unlock.html`};
    return {ext, deps, page, unknown, requestId: String(r?.requestId), other: String(u?.requestId), setKeys: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, unlock, deps)};
  }

  it('locked + persistent grant: queued; vault.setKeys answers it {accounts: [granted]} and sends change [granted]; an ungranted one stays for the window', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    expect((await readDappSession(c.ext)).queue.map(e => e.state)).toEqual(['queued', 'queued']);
    expect(await c.setKeys()).toEqual({ok: true});
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
    expect(c.page.changes()).toEqual([[ACCOUNT.publicKey]]);
    expect(c.unknown.changes()).toEqual([]);
    expect((await readDappSession(c.ext)).queue.find(e => e.requestId === c.other)?.state).toBe('queued');
  });

  it('unlock → lock → unlock: the hook runs again for the second session (a lock clears it)', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    await c.setKeys();
    await lock(c.ext);
    const again = await c.page.ask({type: 'page.connect', id: 'again', silent: false});
    expect(again).toMatchObject({accepted: true});
    await c.setKeys();
    expect(c.page.answersFor(String(again?.requestId))).toEqual([{requestId: again?.requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
  });

  it('the grant re-checked at that moment: an account no longer in the session is not restored', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    await c.ext.local.set(GRANTS_KEY, [grant(JUP, {account: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'})]);
    await c.setKeys();
    expect(c.page.answersFor(c.requestId)).toEqual([]);
  });

  it('the block re-checked at that moment: a restored grant of a blocked host is not restored (review 1 M4)', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    // A block and a grant both kept by a restore (delete wipes both, restore keeps both): the host was blocked while locked.
    await c.ext.local.set(BLOCKED_KEY, [{host: 'jup.ag', blockedAt: 1, imitates: null}]);
    await c.setKeys();
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await readDappSession(c.ext)).queue.find(e => e.requestId === c.requestId)?.state).toBe('queued');
  });

  // Review 1 L6: the flag is now written inside the hook's section. The interleaving the review describes (a lock's whole
  // section between the commit and a flag write after it) cannot be produced here — the lock's section awaits storage
  // first — so no test tells the two placements apart; this one pins the outcome both must keep.
  it('a lock queued while the unlock hook commits: the wallet ends locked and the hook flag cleared', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    const set = c.ext.session.set.bind(c.ext.session);
    let locking: Promise<void> | null = null;
    c.ext.session.set = async (k, v) => {
      await set(k, v);
      // The hook's commit writes the dApp session; a lock asks for the mutex right then and runs as soon as it is free.
      if (k === DAPP_SESSION_KEY && locking === null && (await getSession(c.ext)) !== null) locking = lock(c.ext);
    };
    expect(await c.setKeys()).toEqual({ok: true});
    expect(locking).not.toBeNull();
    await locking;
    expect(await getSession(c.ext)).toBeNull();
    expect(runtimeFor(c.ext).hooked).toBe(false);
  });

  it('if the hook throws, the session stays unlocked and the next queue access runs it again', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    const get = c.ext.local.get.bind(c.ext.local);
    let fail = true;
    c.ext.local.get = async k => {
      if (k === GRANTS_KEY && fail) {
        fail = false;
        throw new Error('storage hiccup');
      }
      return get(k);
    };
    expect(await c.setKeys()).toEqual({ok: true});
    expect(await getSession(c.ext)).not.toBeNull();
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    await c.unknown.ask({type: 'page.connect', id: 's', silent: true});
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
  });
});

describe('an account removed (§2.1, review 2 M9)', () => {
  it('vault.storeEnvelope without account 1: its grants deleted, change [] to their pages, their queued requests rejected', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    await ext.local.set(VAULT_KEY, STORED);
    await setSession(ext, [ACCOUNT, SECOND]);
    await ext.local.set(GRANTS_KEY, [grant(JUP, {account: RECIPIENT}), grant('https://keep.test')]);
    // The session was written directly: run its unlock hook before any page is open.
    await runUnlockHook(ext, deps);
    const gone = openPage(ext, deps, JUP);
    const kept = openPage(ext, deps, 'https://keep.test', {tab: {id: 8}});
    const unlock = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/unlock.html`};
    const next = {...STORED, seed: {iv: B(12, 9), ct: B(48, 9)}, accounts: [STORED.accounts[0]]};
    expect(await handleMessage(ext, {type: 'vault.storeEnvelope', expectedRevision: envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]), envelope: next}, unlock, deps)).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([grant('https://keep.test')]);
    expect([gone.changes(), kept.changes()]).toEqual([[[]], []]);
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/dapp/__tests__/decide.test.ts src/background/dapp/__tests__/lifecycle.test.ts src/background/dapp/__tests__/lockHook.test.ts
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  3 failed (3) · Tests  77 failed | 7 passed (84). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/background/accountsStore.ts`:

````diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -208,14 +208,15 @@ function sameWallet(current: StoredEnvelope, next: StoredEnvelope): boolean {
  * (every name is then new, so every name is cleaned); with anything stored, 'wallet-exists' and
  * nothing is written — onboarding never overwrites a wallet, nor a damaged value in its place. A
  * revision with no v1_vault stored is 'no-wallet'; with a value that is not an envelope (an array, a
- * string, null), 'stored-invalid'.
+ * string, null), 'stored-invalid'. B1c: `onDropped` hears the public keys of the accounts a stored change removed.
  */
-export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelope: unknown): Promise<StoreResult> {
+export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelope: unknown, onDropped?: (publicKeys: string[]) => void): Promise<StoreResult> {
   const first = expectedRevision === null;
   if (!first && !(isStr(expectedRevision) && REVISION.test(expectedRevision))) return 'malformed';
   const next = envelopeShape(envelope);
   if (next === null) return 'malformed';
-  return serial(async () => {
+  let droppedKeys: string[] = [];
+  const out = await serial(async (): Promise<StoreResult> => {
     const stored = await ext.local.get(VAULT_KEY);
     const names = new Map<number, string>();
     if (first) {
@@ -236,6 +237,7 @@ export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelop
       const dropped = new Set(current.accounts.filter(a => !kept.has(a.index)).map(a => a.publicKey));
       if (dropped.size > 0 && (await readPending(ext)).some(r => isOpen(r) && dropped.has(r.account))) return 'send-open';
       for (const a of current.accounts) names.set(a.index, a.name);
+      droppedKeys = [...dropped];
     }
     const accounts: AccountView[] = [];
     for (const a of next.accounts) {
@@ -253,6 +255,9 @@ export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelop
     await ext.local.set(VAULT_KEY, {...next, accounts});
     return 'stored';
   });
+  // B1c §2.1: the accounts this change removed, for their dApp grants (messages.ts).
+  if (out === 'stored' && droppedKeys.length > 0) onDropped?.(droppedKeys);
+  return out;
 }
 
 /**
````

Modify `extension/src/background/autolock.ts`:

````diff
diff --git a/extension/src/background/autolock.ts b/extension/src/background/autolock.ts
--- a/extension/src/background/autolock.ts
+++ b/extension/src/background/autolock.ts
@@ -1,6 +1,7 @@
 import type {Ext} from '../ext';
-import {clearSession} from './session';
+import {sessionMutex} from './session';
 import {DEFAULT_SETTINGS, readSettings} from './settings';
+import {afterLock, lockInSection} from './dapp/lockHook';
 
 export const AUTOLOCK_ALARM = 'autolock';
 export const DEFAULT_AUTOLOCK_MINUTES = DEFAULT_SETTINGS.autoLockMinutes;
@@ -14,9 +15,16 @@ export async function armAutolock(ext: Ext): Promise<void> {
   await ext.alarms.create(AUTOLOCK_ALARM, {delayInMinutes: await minutes(ext)});
 }
 
-export async function lock(ext: Ext): Promise<void> {
-  await clearSession(ext);
+/**
+ * The one lock, and the dApp provider's lock hook (B1c §2.4): the session cleared, the dApp queue answered and written
+ * back, all in one sessionMutex section (dapp/lockHook.ts); then the alarm cleared, the approval window closed and the
+ * pages told. Every caller calls this, from outside any sessionMutex section. A second lock right after (closing the
+ * window fires onWindowRemoved, which may lock again) finds nothing to do and does not throw.
+ */
+export async function lock(ext: Ext, now: () => number = Date.now): Promise<void> {
+  const out = await sessionMutex(() => lockInSection(ext, now()));
   await ext.alarms.clear(AUTOLOCK_ALARM);
+  await afterLock(ext, out);
 }
 
 /** Chrome can keep running with no windows, so session storage alone is not "browser closed". */
````

Modify `extension/src/background/dapp/grantsApi.ts`:

````diff
diff --git a/extension/src/background/dapp/grantsApi.ts b/extension/src/background/dapp/grantsApi.ts
--- a/extension/src/background/dapp/grantsApi.ts
+++ b/extension/src/background/dapp/grantsApi.ts
@@ -117,3 +117,19 @@ export async function unblock(ext: Ext, deps: Pick<WalletDeps, 'now'>, host: unk
     return {ok: true as const};
   });
 }
+
+/**
+ * An account removed from the wallet (B1b E13; spec §2.1, review 2 M9): its grants are deleted (both scopes), those
+ * origins' queued requests answered `rejected`, and `change {accounts: []}` sent to them.
+ */
+export async function dropAccountGrants(ext: Ext, deps: Pick<WalletDeps, 'now'>, publicKeys: readonly string[]): Promise<void> {
+  const gone = new Set(publicKeys);
+  await queueAccess(ext, deps, (tx, fx) => {
+    for (const g of [...tx.s.grants, ...tx.grants]) {
+      if (!gone.has(g.account)) continue;
+      dropGrant(tx, g.origin);
+      fx.changes.set(g.origin, []);
+      rejectQueued(tx, fx, e => e.origin === g.origin);
+    }
+  });
+}
````

Create `extension/src/background/dapp/lockHook.ts`:

````ts
import type {Ext} from '../../ext';
import {GRANTS_KEY, MAX_GRANTS, grantsOf} from './grants';
import {deliver, liveOrigins, runtimeFor, sendChange} from './ports';
import {DAPP_SESSION_KEY, EMPTY_SESSION, readDappSession, type Entry} from './store';

/**
 * The lock hook (spec §2.4, review H3, review 2 M6). autolock.ts's lock() IS the hook: every lock — the auto-lock
 * alarm, vault.lock (and the vault page's lockOnMismatch), onStartup, onWindowRemoved, forgetWallet, vault.setKeys's
 * failure path — runs these steps, the first three in ONE sessionMutex section:
 *  1. read the queue, the recorded window and which open ports' origins hold a grant;
 *  2. clear the session (keys, session grants, queue, undo buffer);
 *  3. write back the answered entries plus every formerly open entry answered `rejected` (a `deciding` one as a
 *     restart, §1.5 — nothing has left the extension), so a relay's resume still finds them;
 * then, outside it: 4. close the approval window (errors ignored); 5. deliver the answers and send `change []` to the
 * ports of origins that held a grant — and only to those (review M3: an ungranted page learns nothing of lock timing).
 * `inSection` runs inside the caller's sessionMutex section; it never takes a mutex (sessionMutex is not re-entrant).
 */
export interface LockOutcome {
  windowId: number | null;
  answered: Entry[];
  notify: string[];
}

export async function lockInSection(ext: Ext, now: number): Promise<LockOutcome> {
  const s = await readDappSession(ext);
  const persistent = grantsOf(await ext.local.get(GRANTS_KEY), 'persistent', MAX_GRANTS);
  const granted = new Set([...s.grants, ...persistent].map(g => g.origin));
  const notify = [...liveOrigins(ext)].filter(o => granted.has(o));
  await ext.session.clear();
  // The next unlock runs the unlock hook again (§2.4).
  runtimeFor(ext).hooked = false;
  const answered: Entry[] = [];
  const kept = s.queue.map(e => {
    if (e.state === 'answered') return e;
    const done: Entry = {...e, state: 'answered', answer: {error: 'rejected'}, answeredAt: now};
    answered.push(done);
    return done;
  });
  if (kept.length > 0) await ext.session.set(DAPP_SESSION_KEY, {...EMPTY_SESSION, queue: kept});
  return {windowId: s.window?.id ?? null, answered, notify};
}

export async function afterLock(ext: Ext, o: LockOutcome): Promise<void> {
  if (o.windowId !== null) await ext.dappWindows.remove(o.windowId).catch(() => undefined);
  deliver(ext, o.answered);
  sendChange(ext, new Map(o.notify.map(origin => [origin, []])));
}
````

Modify `extension/src/background/dapp/ports.ts`:

````diff
diff --git a/extension/src/background/dapp/ports.ts b/extension/src/background/dapp/ports.ts
--- a/extension/src/background/dapp/ports.ts
+++ b/extension/src/background/dapp/ports.ts
@@ -71,6 +71,13 @@ export interface LivePort extends PageOrigin {
 export interface Runtime {
   instance: string;
   ports: Set<LivePort>;
+  /**
+   * §2.4: the unlock hook ran for the current unlocked session in this instance. In memory, not in storage.session (a
+   * lock leaves nothing behind there but the answered queue): a lock clears it; a worker restart runs the hook again at
+   * its first queue access, which is harmless — it answers only what is still queued and repeats a `change` the pages
+   * already have.
+   */
+  hooked: boolean;
 }
 
 const runtimes = new WeakMap<Pick<Ext, 'runtimeId'>, Runtime>();
@@ -83,7 +90,7 @@ function randomHex(n: number): string {
 export function runtimeFor(ext: Pick<Ext, 'runtimeId'>): Runtime {
   let r = runtimes.get(ext);
   if (r === undefined) {
-    r = {instance: randomHex(16), ports: new Set()};
+    r = {instance: randomHex(16), ports: new Set(), hooked: false};
     runtimes.set(ext, r);
   }
   return r;
````

Modify `extension/src/background/dapp/queue.ts`:

````diff
diff --git a/extension/src/background/dapp/queue.ts b/extension/src/background/dapp/queue.ts
--- a/extension/src/background/dapp/queue.ts
+++ b/extension/src/background/dapp/queue.ts
@@ -1,10 +1,11 @@
 import {base64urlnopad} from '@scure/base';
 import type {Ext} from '../../ext';
 import type {WalletDeps} from '../deps';
-import {deliver, runtimeFor, sendChange, type PageOrigin} from './ports';
+import {deliver, runtimeFor, sendChange, type PageOrigin, type Runtime} from './ports';
 import {withRecent} from './grants';
 import {withRejection} from './limits';
 import {dappSection, grantIn, putGrant, type Answer, type Entry, type Tx} from './store';
+import {unlockWork} from './unlockHook';
 
 /**
  * The request queue (spec §1.5, §2.3; C3, C4, C9, C17): one FIFO queue across origins in storage.session, decided one
@@ -68,13 +69,19 @@ export function rejectQueued(tx: Tx, fx: Effects, match: (e: Entry) => boolean,
 }
 
 /**
- * The housekeeping of every access: a `queued` entry older than five minutes is answered `timeout` (C4, counted from
+ * The housekeeping of every access: the unlock hook when it has not run for this session in this instance (unlockHook.ts;
+ * true when it ran — the caller marks it done inside the section, and clears it again if the commit fails); a `queued`
+ * or `deciding` entry older than five minutes is answered `timeout` (C4, counted from
  * arrivedAt by the background's clock — `queued` or `deciding`); a `deciding` entry another instance wrote is a restart
  * (C17, §1.5 step 2 — nothing left the extension: answered `rejected`), and so is one of this instance still `deciding`
  * DECIDING_TTL_MS after it was written (review 1 M1); an answered entry nobody acked is dropped ten minutes after its
  * answer; an expired undo record is dropped.
  */
-export function sweep(tx: Tx, fx: Effects, instance: string): void {
+export function sweep(tx: Tx, fx: Effects, rt: Pick<Runtime, 'instance' | 'hooked'>): boolean {
+  // §2.4: the unlock hook, on the first access of an unlocked session (again if it threw last time).
+  const hook = tx.session !== null && !rt.hooked;
+  if (hook) unlockWork(tx, fx.changes, (e, a) => answer(fx, e, a, tx.now));
+  const instance = rt.instance;
   for (const e of tx.s.queue) {
     // C4 "queued or shown": five minutes from arrivedAt, whatever the open state (review 1 M1).
     if (isOpenEntry(e) && tx.now - e.arrivedAt >= REQUEST_TTL_MS) answer(fx, e, {error: 'timeout'}, tx.now);
@@ -83,6 +90,7 @@ export function sweep(tx: Tx, fx: Effects, instance: string): void {
   }
   tx.s.queue = tx.s.queue.filter(e => e.state !== 'answered' || e.answeredAt === null || tx.now - e.answeredAt < ANSWER_TTL_MS);
   tx.s.undo = tx.s.undo.filter(u => u.expiresAt > tx.now);
+  return hook;
 }
 
 /**
@@ -104,16 +112,37 @@ async function tick(ext: Ext, queued: boolean): Promise<void> {
 /** One queue access (see the header). `fn` runs inside the section, after the sweep. */
 export async function queueAccess<T>(ext: Ext, deps: Pick<WalletDeps, 'now'>, fn: (tx: Tx, fx: Effects) => T | Promise<T>): Promise<T> {
   const fx: Effects = {answered: [], changes: new Map()};
-  const instance = runtimeFor(ext).instance;
+  const rt = runtimeFor(ext);
   let queued = false;
-  const out = await dappSection(ext, deps.now(), async tx => {
-    sweep(tx, fx, instance);
-    const r = await fn(tx, fx);
-    queued = tx.s.queue.length > 0;
-    return r;
-  });
+  let hooked = false;
+  let out: T;
+  try {
+    out = await dappSection(ext, deps.now(), async tx => {
+      hooked = sweep(tx, fx, rt);
+      const r = await fn(tx, fx);
+      queued = tx.s.queue.length > 0;
+      // Review 1 L6: inside the section (under sessionMutex), so a lock — which clears the flag in its own section —
+      // can never run between the hook's commit and this write.
+      if (hooked) rt.hooked = true;
+      return r;
+    });
+  } catch (err) {
+    // The commit failed (or fn threw): the hook did not happen — run it again at the next access. Clearing is the
+    // safe direction even if a lock ran meanwhile (a locked session never runs the hook).
+    if (hooked) rt.hooked = false;
+    throw err;
+  }
   deliver(ext, fx.answered);
   sendChange(ext, fx.changes);
   await tick(ext, queued).catch(e => console.warn('dApp queue: the expiry tick was not armed', e));
   return out;
 }
+
+
+/**
+ * The unlock hook's call from vault.setKeys (§2.4): one queue access — its sweep runs the hook (unlockHook.ts), then the
+ * answers are delivered and the `change` events sent.
+ */
+export async function runUnlockHook(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<void> {
+  await queueAccess(ext, deps, () => undefined);
+}
````

Create `extension/src/background/dapp/unlockHook.ts`:

````ts
import {isBlocked} from './blocked';
import {putGrant, type Answer, type Entry, type Tx} from './store';

/**
 * The unlock hook (spec §2.4, review 2 M7). Run by the first queue access of an unlocked session in this background
 * instance (ports.ts Runtime.hooked, which the lock clears) — vault.setKeys makes that access right after setSessionIf
 * succeeded and the auto-lock is armed (messages.ts), and if it throws there the session stays unlocked and the next
 * queue access runs it again:
 *  1. each `queued` connect of an origin holding a PERSISTENT grant is answered `{accounts: [granted]}` — the grant,
 *     the account (still in the session) and the block re-checked at that moment (D5: restored without #47);
 *  2. `change {accounts: [granted]}` to the open ports of persistent-grant origins;
 *  3. the rest is left for the window, which sees the unlock on its next poll (§2.3).
 * `answer` is queue.ts's (passed in, so this module needs nothing from the queue).
 */
export function unlockWork(tx: Tx, changes: Map<string, string[]>, answer: (e: Entry, a: Answer) => void): void {
  const session = tx.session;
  if (session === null) return;
  const usable = (account: string) => session.some(a => a.publicKey === account);
  for (const e of tx.s.queue) {
    if (e.state !== 'queued' || e.type !== 'connect') continue;
    const g = tx.grants.find(x => x.origin === e.origin);
    if (g === undefined || !usable(g.account) || isBlocked(tx.blocked, e.host)) continue;
    putGrant(tx, {...g, lastUsedAt: tx.now});
    answer(e, {result: {accounts: [g.account]}});
  }
  for (const g of tx.grants) if (usable(g.account)) changes.set(g.origin, [g.account]);
}
````

Modify `extension/src/background/messages.ts`:

````diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -13,6 +13,8 @@ import {startPoller} from './pending';
 import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
 import {PAGE_TYPES} from './dapp/pageApi';
 import {decide, decideRequestOf, pending} from './dapp/decide';
+import {runUnlockHook} from './dapp/queue';
+import {dropAccountGrants} from './dapp/grantsApi';
 import {listBlocked, listGrants, revokeAll, revokeGrant, undoRevoke, unblock} from './dapp/grantsApi';
 
 /** What the browser reports about a message's origin (runtime.MessageSender). */
@@ -176,6 +178,8 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
         await lock(ext);
         throw e;
       }
+      // B1c §2.4: the unlock hook. If it throws, the session stays unlocked and the next queue access runs it again.
+      await runUnlockHook(ext, deps ?? {now: Date.now}).catch(e => console.warn('dApp unlock hook failed; the next queue access runs it again', e));
       return {ok: true};
     }
     case 'vault.lock':
@@ -297,7 +301,10 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       return deps === undefined ? {ok: false, error: 'unavailable'} : unblock(ext, deps, (msg as {host?: unknown}).host);
     case 'vault.storeEnvelope': {
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
-      const r = await storeEnvelope(ext, expectedRevision, envelope);
+      const dropped: string[] = [];
+      const r = await storeEnvelope(ext, expectedRevision, envelope, keys => void dropped.push(...keys));
+      // B1c §2.1 (review 2 M9): a removed account's dApp grants go with it.
+      if (r === 'stored' && dropped.length > 0) await dropAccountGrants(ext, deps ?? {now: Date.now}, dropped).catch(e => console.warn('dApp grants of a removed account not removed', e));
       return r === 'stored' ? {ok: true} : {ok: false, error: r};
     }
     default:
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run src/background/dapp/__tests__/decide.test.ts src/background/dapp/__tests__/lifecycle.test.ts src/background/dapp/__tests__/lockHook.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  3 passed (3) · Tests  84 passed (84); tsc clean; whole suite Test Files  145 passed (145) · Tests  2934 passed (2934); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M5a** — onStartup bypasses the hook (spec mutation "one caller bypasses the hook") — `extension/src/background/index.ts`:

  ```diff
  - api.runtime.onStartup.addListener(() => {
  -   void lock(ext);
  - });
  + api.runtime.onStartup.addListener(() => {
  +   void ext.session.clear();
  + });
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- **M5b** — the lock hook does not answer queued requests — `extension/src/background/dapp/lockHook.ts`:

  ```diff
  -     if (e.state === 'answered') return e;
  -     const done
  +     if (e.state !== 'deciding') return e;
  +     const done
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  7 failed | 9 passed (16)).

- **M5c** — the lock hook leaves the window open — `extension/src/background/dapp/lockHook.ts`:

  ```diff
  -   if (o.windowId !== null) await ext.dappWindows.remove(o.windowId).catch(() => undefined);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  6 failed | 10 passed (16)).

- **M5d** — change [] to every open port, granted or not (review M3) — `extension/src/background/dapp/lockHook.ts`:

  ```diff
  -   const notify = [...liveOrigins(ext)].filter(o => granted.has(o));
  +   const notify = [...liveOrigins(ext)];
  +   void granted;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  5 failed | 11 passed (16)).

- **M5e** — vault.setKeys without the unlock hook (spec mutation) — `extension/src/background/messages.ts`:

  ```diff
  -       await runUnlockHook(ext, deps ?? {now: Date.now}).catch(e => console.warn('dApp unlock hook failed; the next queue access runs it again', e));
  +       void runUnlockHook;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  4 failed | 12 passed (16)).

- **M5f** — the unlock hook sends no change — `extension/src/background/dapp/unlockHook.ts`:

  ```diff
  -   for (const g of tx.grants) if (usable(g.account)) changes.set(g.origin, [g.account]);
  +   void changes;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- **M5g** — the unlock hook restores a grant whose account left the session — `extension/src/background/dapp/unlockHook.ts`:

  ```diff
  - if (g === undefined || !usable(g.account) || isBlocked(tx.blocked, e.host)) continue;
  + if (g === undefined || isBlocked(tx.blocked, e.host)) continue;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- **M5h** — a lock does not reset the hook (a second unlock runs nothing) — `extension/src/background/dapp/lockHook.ts`:

  ```diff
  -   runtimeFor(ext).hooked = false;
  +   void runtimeFor;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 14 passed (16)).

- **M5i** — an account removed keeps its grants (review 2 M9) — `extension/src/background/accountsStore.ts`:

  ```diff
  -   if (out === 'stored' && droppedKeys.length > 0) onDropped?.(droppedKeys);
  +   if (out === 'stored' && droppedKeys.length > 0 && false) onDropped?.(droppedKeys);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- **M5j** — the lock keeps the undo buffer (§2.7's "locked" refusal) — `extension/src/background/dapp/lockHook.ts`:

  ```diff
  -   if (kept.length > 0) await ext.session.set(DAPP_SESSION_KEY, {...EMPTY_SESSION, queue: kept});
  +   if (kept.length > 0 || s.undo.length > 0) await ext.session.set(DAPP_SESSION_KEY, {...EMPTY_SESSION, queue: kept, undo: s.undo});
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M5k** — the unlock hook restores a grant of a blocked host — `extension/src/background/dapp/unlockHook.ts`:

  ```diff
  -  || isBlocked(tx.blocked, e.host)) continue;
  +  || (isBlocked(tx.blocked, e.host) && false)) continue;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/accountsStore.ts extension/src/background/autolock.ts extension/src/background/dapp/__tests__/decide.test.ts extension/src/background/dapp/__tests__/lifecycle.test.ts extension/src/background/dapp/__tests__/lockHook.test.ts extension/src/background/dapp/grantsApi.ts extension/src/background/dapp/lockHook.ts extension/src/background/dapp/ports.ts extension/src/background/dapp/queue.ts extension/src/background/dapp/unlockHook.ts extension/src/background/messages.ts
git commit -F - <<'MSG'
feat(extension): B1c lock hook (lock() rewritten, every caller), unlock hook, an account removed

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 6: `signMessage`: rules 1–6 in order, each refusal by its reason; SIWS (the address line, the domain authority, Q20); the keywords and the homoglyph marks; the signature through `deciding`

**Spec:** §3.2 (steps 1–7), §1.4 (`page.signMessage`), §2.3 ("grant still held", "signMessage" rows), C17, D9, review M5, review 2 L5, L6, M10.2; §6.1 "signMessage"; Review Focus 5; Scope R20; plan review 1 M2, M3, M4

**Files:**
- Test: `extension/src/background/dapp/__tests__/decide.test.ts`
- Test: `extension/src/background/dapp/__tests__/lockHook.test.ts`
- Test: `extension/src/background/dapp/__tests__/signMessage.test.ts` (new)
- Modify: `extension/src/background/dapp/decide.ts`
- Modify: `extension/src/background/dapp/pageApi.ts`
- Create: `extension/src/background/dapp/signMessage.ts`

**Interfaces:**
- Consumes: Tasks 2–5; `@solana/web3.js` `Message`, `Transaction`, `VersionedTransaction`, `VersionedMessage` (deserializers only); `ed25519` (`@noble/curves`); `CONFUSABLES`.
- Produces (as exported):
  - `signMessage.ts`: `MAX_MESSAGE_BYTES = 4096`, `type MessageRefusal = 'too-long' | 'transaction' | 'offchain' | 'utf8' | 'control' | 'format'`, `checkMessage(bytes)`, `authorityOf(origin)`, `type SiwsCheck`, `checkSiws(text, origin, account)`, `KEYWORDS`, `keywordIn(text)`, `homoglyphRanges(text)`, `signRequestOf(msg)`, `finishSign(ext, deps, requestId, instance)`.
  - `decide.ts`: `interface SignDetail {account; text; chars; keyword; marks; siwsMismatch}`, `RequestView.sign`, `DecideError` gains `'siws-mismatch'`.
  - `pageApi.ts`: `page.signMessage`.

The page's bytes are checked in the spec's order and every refusal test asserts its **reason** (`checkMessage` returns it), so a later rule can never mask an earlier one (review M5): more than 4 KiB (UTF-8 bytes, not characters); bytes that deserialize as a legacy Message or Transaction, a VersionedTransaction or a VersionedMessage — the required artifact is a printable, valid-UTF-8 legacy Message of 3 205 bytes that deserializes, refused *because* it deserializes (spec mutation M6a); the off-chain prefix (checked before UTF-8, so `\xff` reads as `offchain`); invalid UTF-8 (fatal, `ignoreBOM` so a BOM stays visible to the next rule); a control character other than `\n`, `\t` and a `\r` right before `\n`; any `\p{Cf}`. Rule 1 (`unauthorized` unless the origin holds a grant for exactly this account, unlocked) runs before them. A SIWS first line makes the second line the account (else `invalid-request`, no window) and the domain this origin's authority (`host`, or `host:port` with an explicit port); a mismatch is queued and #46 shows Q20 with only [Reject] — and the background refuses Sign too (R20). The keywords are whole words (maximal runs of ASCII letters), case-insensitive; the view carries the ranges to `<mark>` (the keyword's occurrences, and for a lookalike origin every non-ASCII character `skel` maps to Latin). Sign: `deciding` → read the granted account's key → ed25519 over the exact bytes → `answered {signature, signedMessage}` (base64) in a section that confirms the entry is still this instance's `deciding` one and its account still in the session — a lock, a restart or the account's removal in between leaves only `rejected` (each tested). A blocked or cooling-down host's sign request is rejected with no entry and no window (review 1 M2). Now that a granted origin can have a queued request, revoke all and an account's removal are tested to reject it (review 1 M3).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/dapp/__tests__/decide.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/decide.test.ts b/extension/src/background/dapp/__tests__/decide.test.ts
--- a/extension/src/background/dapp/__tests__/decide.test.ts
+++ b/extension/src/background/dapp/__tests__/decide.test.ts
@@ -81,6 +81,7 @@ describe('dapp.pending (§2.3, §4.3)', () => {
           selected: 1,
           cap: false,
         },
+        sign: null,
       },
     });
     // The window now shows it: closing the window rejects this one.
@@ -382,10 +383,22 @@ describe('#49’s messages: list, revoke + undo, revoke all, blocked, unblock (
     await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'});
     const a = openPage(ext, deps, JUP, {tab: {id: 2}});
     const b = openPage(ext, deps, DAPP, {tab: {id: 3}});
+    // Review 1 M3: a queued request of each granted origin (signMessage — the granted origins' only queued kind) — and
+    // a queued connect of an ungranted origin, left as it is (positive control).
+    const hello = 'aGVsbG8=';
+    const ra = await a.ask({type: 'page.signMessage', id: 'sa', account: ACCOUNT.publicKey, message: hello});
+    const rb = await b.ask({type: 'page.signMessage', id: 'sb', account: ACCOUNT.publicKey, message: hello});
+    const {requestId: ungranted} = await request(ext, deps, 'https://other.test', 4);
+    expect([ra?.accepted, rb?.accepted]).toEqual([true, true]);
     expect(await ui({type: 'dapp.grants.revokeAll'})).toEqual({ok: true});
     expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
     expect((await readDappSession(ext)).grants).toEqual([]);
     expect([a.changes(), b.changes()]).toEqual([[[]], [[]]]);
+    expect([a.answersFor(String(ra?.requestId)), b.answersFor(String(rb?.requestId))]).toEqual([
+      [{requestId: ra?.requestId, error: 'rejected'}],
+      [{requestId: rb?.requestId, error: 'rejected'}],
+    ]);
+    expect((await readDappSession(ext)).queue.find(e => e.requestId === ungranted)?.state).toBe('queued');
   });
 
   it('unblock removes the block only: the grant the block revoked does not come back — the next connect opens #47 again', async () => {
````

Modify `extension/src/background/dapp/__tests__/lockHook.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/lockHook.test.ts b/extension/src/background/dapp/__tests__/lockHook.test.ts
--- a/extension/src/background/dapp/__tests__/lockHook.test.ts
+++ b/extension/src/background/dapp/__tests__/lockHook.test.ts
@@ -267,10 +267,17 @@ describe('an account removed (§2.1, review 2 M9)', () => {
     await runUnlockHook(ext, deps);
     const gone = openPage(ext, deps, JUP);
     const kept = openPage(ext, deps, 'https://keep.test', {tab: {id: 8}});
+    // Review 1 M3: a queued sign request of each origin — the removed account's is rejected, the kept one waits.
+    const hello = 'aGVsbG8=';
+    const rg = await gone.ask({type: 'page.signMessage', id: 'g', account: RECIPIENT, message: hello});
+    const rk = await kept.ask({type: 'page.signMessage', id: 'k', account: ACCOUNT.publicKey, message: hello});
+    expect([rg?.accepted, rk?.accepted]).toEqual([true, true]);
     const unlock = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/unlock.html`};
     const next = {...STORED, seed: {iv: B(12, 9), ct: B(48, 9)}, accounts: [STORED.accounts[0]]};
     expect(await handleMessage(ext, {type: 'vault.storeEnvelope', expectedRevision: envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]), envelope: next}, unlock, deps)).toEqual({ok: true});
-    expect(await ext.local.get(GRANTS_KEY)).toEqual([grant('https://keep.test')]);
+    expect(((await ext.local.get(GRANTS_KEY)) as Grant[]).map(g => g.origin)).toEqual(['https://keep.test']);
     expect([gone.changes(), kept.changes()]).toEqual([[[]], []]);
+    expect(gone.answersFor(String(rg?.requestId))).toEqual([{requestId: rg?.requestId, error: 'rejected'}]);
+    expect((await readDappSession(ext)).queue.find(e => e.requestId === rk?.requestId)?.state).toBe('queued');
   });
 });
````

Create `extension/src/background/dapp/__tests__/signMessage.test.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {Keypair, SystemProgram, Transaction, TransactionMessage, VersionedTransaction, PublicKey} from '@solana/web3.js';
import {handleMessage} from '../../messages';
import {setSession} from '../../session';
import {lock} from '../../autolock';
import {VAULT_KEY} from '../../accountsStore';
import {GRANTS_KEY, type Grant} from '../grants';
import {runUnlockHook} from '../queue';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {runtimeFor} from '../ports';
import {MAX_MESSAGE_BYTES, checkMessage, checkSiws, homoglyphRanges, keywordIn} from '../signMessage';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT, BLOCKHASH, PUB, RECIPIENT} from '../../__tests__/fixtures';
import {openPage} from './pageHarness';

const enc = (s: string) => new TextEncoder().encode(s);
const DAPP = 'https://dapp.test';
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'session', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});
const siws = (domain: string, address: string, eol = '\n') =>
  [`${domain} wants you to sign in with your Solana account:`, address, '', 'Sign in to the test dApp.', '', `URI: https://${domain}`, 'Version: 1', 'Chain ID: solana:mainnet', 'Nonce: 4f3a92ceb1d8', 'Issued At: 2026-10-10T09:40:23Z'].join(eol);

/**
 * The required artifact (§3.2 rule 2): printable, valid UTF-8, no control or format character — and a legacy Message
 * that deserializes. Header "!!!", 32 printable keys, a printable blockhash, 32 printable instructions (3 205 bytes).
 */
function printableLegacyMessage(): Uint8Array {
  const parts: Uint8Array[] = [enc('!!!'), Uint8Array.of(0x20), new Uint8Array(32 * 32).fill(0x4b), new Uint8Array(32).fill(0x42), Uint8Array.of(0x20)];
  for (let i = 0; i < 32; i++) parts.push(Uint8Array.of(0x21, 0x20), new Uint8Array(32).fill(0x22), Uint8Array.of(0x20), new Uint8Array(32).fill(0x61));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function transactionBytes(): {legacy: Uint8Array; versioned: Uint8Array} {
  const from = new PublicKey(PUB);
  const ix = SystemProgram.transfer({fromPubkey: from, toPubkey: new PublicKey(RECIPIENT), lamports: 1});
  const legacy = new Transaction({feePayer: from, recentBlockhash: BLOCKHASH}).add(ix);
  const message = new TransactionMessage({payerKey: from, recentBlockhash: BLOCKHASH, instructions: [ix]}).compileToV0Message();
  return {legacy: legacy.serialize({requireAllSignatures: false, verifySignatures: false}), versioned: new VersionedTransaction(message).serialize()};
}

// Spec §3.2 rule 2: each refusal asserts its REASON, so a later rule cannot mask an earlier one (review M5).
describe('signMessage rule 2 — the bytes, in order', () => {
  it('positive controls: a plain sentence, a canonical SIWS message, CRLF line ends, a tab', () => {
    expect(checkMessage(enc('Sign in to the test dApp.'))).toEqual({text: 'Sign in to the test dApp.'});
    expect(checkMessage(enc(siws('dapp.test', ACCOUNT.publicKey)))).toHaveProperty('text');
    expect(checkMessage(enc(siws('dapp.test', ACCOUNT.publicKey, '\r\n')))).toHaveProperty('text');
    expect(checkMessage(enc('a\tb\n'))).toHaveProperty('text');
    expect(checkMessage(enc('a'.repeat(MAX_MESSAGE_BYTES)))).toHaveProperty('text');
  });

  it('too-long: more than 4 KiB (before anything else is read)', () => {
    expect(checkMessage(enc('a'.repeat(MAX_MESSAGE_BYTES + 1)))).toEqual({refused: 'too-long'});
  });

  // Review Focus 5: the limit is bytes, not characters — 2 048 two-byte characters fit, one more byte does not.
  it('the 4 KiB limit counts UTF-8 bytes: 2 048 × "\u00e9" (4 096 bytes) passes, one byte more is too-long', () => {
    expect(checkMessage(enc('\u00e9'.repeat(2048)))).toEqual({text: '\u00e9'.repeat(2048)});
    expect(checkMessage(enc(`${'\u00e9'.repeat(2048)}a`))).toEqual({refused: 'too-long'});
  });

  it('transaction: the printable legacy-message artifact is refused BECAUSE it deserializes; so are real transaction bytes', () => {
    const artifact = printableLegacyMessage();
    expect(artifact.length).toBe(3205);
    // It passes every other rule: printable ASCII, valid UTF-8, no control or format character.
    const text = new TextDecoder('utf-8', {fatal: true}).decode(artifact);
    expect(/^[\x20-\x7e]+$/.test(text)).toBe(true);
    expect(checkMessage(artifact)).toEqual({refused: 'transaction'});
    const {legacy, versioned} = transactionBytes();
    expect(checkMessage(legacy)).toEqual({refused: 'transaction'});
    expect(checkMessage(versioned)).toEqual({refused: 'transaction'});
  });

  it('offchain: the \\xffsolana offchain prefix — refused as offchain, not as invalid UTF-8 (the order)', () => {
    expect(checkMessage(Uint8Array.from([0xff, ...enc('solana offchain message')]))).toEqual({refused: 'offchain'});
  });

  it('utf8: not valid UTF-8 (fatal decoding) — D9: no hex preview', () => {
    expect(checkMessage(Uint8Array.of(0x68, 0xc3, 0x28))).toEqual({refused: 'utf8'});
  });

  it('control: a control character other than \\n, \\t and \\r before \\n — a lone \\r is refused', () => {
    expect(checkMessage(enc('a\u0007b'))).toEqual({refused: 'control'});
    expect(checkMessage(enc('a\rb'))).toEqual({refused: 'control'});
    expect(checkMessage(enc('a\u0085b'))).toEqual({refused: 'control'});
  });

  it('format: any \\p{Cf} — a zero-width joiner inside a keyword, a BOM, a soft hyphen, a bidi override (review 2 L6)', () => {
    for (const s of ['appr\u200Dove', '\uFEFFhello', 'per\u00ADmit', 'abc\u202Edef']) expect([s, checkMessage(enc(s))]).toEqual([s, {refused: 'format'}]);
  });
});

describe('signMessage rule 3 — Sign-In-With-Solana', () => {
  it('the second line must be the account; the domain must be the origin’s authority — host, or host:port with a port', () => {
    expect(checkSiws(siws('dapp.test', ACCOUNT.publicKey), DAPP, ACCOUNT.publicKey)).toEqual({siws: true, domain: 'dapp.test', addressOk: true, domainOk: true});
    expect(checkSiws(siws('dapp.test', ACCOUNT.publicKey, '\r\n'), DAPP, ACCOUNT.publicKey)).toEqual({siws: true, domain: 'dapp.test', addressOk: true, domainOk: true});
    expect(checkSiws(siws('dapp.test', RECIPIENT), DAPP, ACCOUNT.publicKey)).toMatchObject({addressOk: false});
    expect(checkSiws(siws('jup.ag', ACCOUNT.publicKey), 'https://www.jup.ag', ACCOUNT.publicKey)).toMatchObject({domain: 'jup.ag', domainOk: false});
    expect(checkSiws(siws('dapp.test:8443', ACCOUNT.publicKey), 'https://dapp.test:8443', ACCOUNT.publicKey)).toMatchObject({domainOk: true});
    expect(checkSiws(siws('dapp.test', ACCOUNT.publicKey), 'https://dapp.test:8443', ACCOUNT.publicKey)).toMatchObject({domainOk: false});
    expect(checkSiws('Just a sentence.', DAPP, ACCOUNT.publicKey)).toEqual({siws: false});
  });
});

describe('signMessage rule 6 — structured-approval keywords; step 5 — homoglyph marks', () => {
  it('fires on "approve", "Permit", "spending" as whole words; not on "approved" or "transference"', () => {
    expect(keywordIn('jup.ag asks you to approve the terms')?.word).toBe('approve');
    // A word is a maximal run of ASCII letters: "Permit2" holds the word "Permit".
    expect(keywordIn('Permit2 signature')?.word).toBe('permit');
    expect(keywordIn('A Permit for X')?.word).toBe('permit');
    expect(keywordIn('your spending limit')?.word).toBe('spending');
    expect(keywordIn('You approved this. A transference.')).toBeNull();
    expect(keywordIn('approve, then approve again')?.ranges).toEqual([
      {start: 0, end: 7},
      {start: 14, end: 21},
    ]);
    // The stated limit: a Cyrillic homoglyph inside the word is not detected.
    expect(keywordIn('\u0430pprove')).toBeNull();
  });

  it('marks every character outside ASCII that skel maps to Latin', () => {
    expect(homoglyphRanges('Domain: ph\u0430ntom.app')).toEqual([{start: 10, end: 11}]);
    expect(homoglyphRanges('plain ascii')).toEqual([]);
  });
});

async function setup(o: {grant?: Grant | null} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
  await setSession(ext, [ACCOUNT]);
  await runUnlockHook(ext, deps);
  if (o.grant !== null) await ext.local.set(GRANTS_KEY, [grant(DAPP, {scope: 'persistent', ...o.grant})]);
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const page = openPage(ext, deps, DAPP);
  const sign = (id: string, message: Uint8Array | string, account = ACCOUNT.publicKey) =>
    page.ask({type: 'page.signMessage', id, account, message: typeof message === 'string' ? base64.encode(enc(message)) : base64.encode(message)});
  const decide = (m: Record<string, unknown>) => handleMessage(ext, {type: 'dapp.decide', ...m}, approve, deps);
  const pend = async () => ((await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)) as {data: {state: string; request: {sign: Record<string, unknown> | null}}}).data;
  return {ext, deps, page, sign, decide, pend};
}

describe('page.signMessage → #46 → the signature (§3.2 steps 1, 4, 7)', () => {
  it('rule 1: unauthorized without a grant, for another account than the granted one, and while locked', async () => {
    const none = await setup({grant: null});
    expect(await none.sign('s1', 'hello')).toEqual({id: 's1', error: 'unauthorized'});
    const c = await setup();
    expect(await c.sign('s2', 'hello', RECIPIENT)).toEqual({id: 's2', error: 'unauthorized'});
    await lock(c.ext);
    expect(await c.sign('s3', 'hello')).toEqual({id: 's3', error: 'unauthorized'});
    expect(c.ext.approval.created).toEqual([]);
  });

  it('rule 2 and 3 refusals open no window: a transaction as a message, SIWS for another address, malformed base64', async () => {
    const c = await setup();
    expect(await c.sign('t', printableLegacyMessage())).toEqual({id: 't', error: 'invalid-request'});
    expect(await c.sign('a', siws('dapp.test', RECIPIENT))).toEqual({id: 'a', error: 'invalid-request'});
    expect(await c.page.ask({type: 'page.signMessage', id: 'b', account: ACCOUNT.publicKey, message: '%%%'})).toEqual({id: 'b', error: 'invalid-request'});
    expect(c.ext.approval.created).toEqual([]);
    expect((await readDappSession(c.ext)).queue).toEqual([]);
  });

  it('a SIWS message for another domain: queued, #46 says which (Q20), and Sign is refused in the background — only Reject', async () => {
    const c = await setup();
    const r = await c.sign('m', siws('jup.ag', ACCOUNT.publicKey));
    expect(r).toMatchObject({accepted: true});
    expect((await c.pend()).request.sign).toMatchObject({siwsMismatch: 'jup.ag'});
    expect(await c.decide({requestId: r?.requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'siws-mismatch'});
    expect(await c.decide({requestId: r?.requestId, decision: 'reject'})).toEqual({ok: true});
  });

  it('#46’s view: the text as text, its length in characters, the keyword and its marks, the account', async () => {
    const c = await setup();
    await c.sign('k', 'jup.ag asks you to approve the following terms.');
    expect((await c.pend()).request.sign).toEqual({
      account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
      text: 'jup.ag asks you to approve the following terms.',
      chars: 47,
      keyword: 'approve',
      marks: [{start: 19, end: 26}],
      siwsMismatch: null,
    });
  });

  it('Sign: an ed25519 signature over the exact bytes, verifiable; recorded on the grant; exactly one answer', async () => {
    const c = await setup();
    const text = siws('dapp.test', ACCOUNT.publicKey);
    const r = await c.sign('s', text);
    const requestId = String(r?.requestId);
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    const answers = c.page.answersFor(requestId);
    expect(answers).toHaveLength(1);
    const {signature, signedMessage} = answers[0]?.result as {signature: string; signedMessage: string};
    expect(signedMessage).toBe(base64.encode(enc(text)));
    expect(ed25519.verify(base64.decode(signature), enc(text), base58.decode(ACCOUNT.publicKey))).toBe(true);
    expect(((await c.ext.local.get(GRANTS_KEY)) as Grant[])[0]?.recent).toEqual([{type: 'signMessage', at: c.deps.clock.t, outcome: 'approved'}]);
  });

  it('two decides racing for one request: one signature (the deciding state, C17)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    const both = await Promise.all([
      c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey}),
      c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey}),
    ]);
    expect(both).toEqual([{ok: true}, {ok: false, error: 'not-head'}]);
    expect(c.page.answersFor(requestId)).toHaveLength(1);
  });

  it('a worker restart between deciding and answered: rejected — nothing left the extension, no signature, never re-signed', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}}))});
    expect(runtimeFor(c.ext).instance).not.toBe('the-dead-instance');
    expect(await c.page.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, error: 'rejected'}]});
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'not-head'});
    expect(c.page.answersFor(requestId).filter(a => 'result' in a)).toEqual([]);
  });

  it('a lock between deciding and the signature: the page gets rejected only — the signature is never delivered', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    // The decision arms the auto-lock between the deciding section and the signing: a lock lands right there.
    c.ext.alarms.create = () => lock(c.ext);
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('a lock and an unlock while the key is read: the second section sees an unlocked wallet, and still delivers nothing (M6j)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    // The lock above answers before finishSign's first section. This one lands after that section, during the key read
    // (the read outside any section), and the user unlocks again before the second section: the entry is answered
    // `rejected` by the lock, the session is back, and only the deciding check keeps the signature in.
    const get = c.ext.session.get;
    let fired = false;
    c.ext.session.get = async (k: string) => {
      const inFinishSign = (new Error().stack ?? '').split('\n')[3]?.includes('finishSign') === true;
      const v = await get(k);
      if (!fired && k === 'v1_session' && inFinishSign) {
        fired = true;
        await lock(c.ext);
        await setSession(c.ext, [ACCOUNT]);
      }
      return v;
    };
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(fired).toBe(true);
    expect(await c.ext.session.get('v1_session')).toBeDefined();
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('an account removed while its key is read: the signature computed is dropped, the page gets rejected (review 1 M4)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    const get = c.ext.session.get;
    let fired = false;
    c.ext.session.get = async (k: string) => {
      const inFinishSign = (new Error().stack ?? '').split('\n')[3]?.includes('finishSign') === true;
      const v = await get(k);
      if (!fired && k === 'v1_session' && inFinishSign) {
        fired = true;
        // The key is read; the account leaves the session before the answer's section (vault.storeEnvelope's removal).
        await setSession(c.ext, [{index: 1, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey}]);
      }
      return v;
    };
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(fired).toBe(true);
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('a host in cooldown (three rejections in ten minutes): the next sign request is rejected with no queue entry and no window (review 1 M2, C14)', async () => {
    const c = await setup();
    for (let i = 0; i < 3; i++) {
      const r = await c.sign(`r${i}`, `hello ${i}`);
      // Positive control: each of the three was queued (the grant and the checks hold).
      expect(r).toMatchObject({accepted: true});
      expect(await c.decide({requestId: String(r?.requestId), decision: 'reject'})).toEqual({ok: true});
    }
    const windowsBefore = c.ext.approval.created.length;
    expect(await c.sign('r3', 'hello 3')).toEqual({id: 'r3', error: 'rejected'});
    expect((await readDappSession(c.ext)).queue.filter(e => e.state !== 'answered')).toEqual([]);
    expect(c.ext.approval.created.length).toBe(windowsBefore);
  });

  it('decide rows for a sign request: the grant no longer held, another account (review 2 M9)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const requestId = String(r?.requestId);
    expect(await c.decide({requestId, decision: 'approve', account: RECIPIENT})).toEqual({ok: false, error: 'unknown-account'});
    await setSession(c.ext, [ACCOUNT, {index: 1, publicKey: Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey.toBase58(), secretKey: ACCOUNT.secretKey}]);
    const other = Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey.toBase58();
    expect(await c.decide({requestId, decision: 'approve', account: other})).toEqual({ok: false, error: 'account'});
    await c.ext.local.set(GRANTS_KEY, []);
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'no-grant'});
  });

  it('a revoke answers the origin’s queued sign request rejected (review 2 M9)', async () => {
    const c = await setup();
    const r = await c.sign('s', 'hello');
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    await handleMessage(c.ext, {type: 'dapp.grants.revoke', origin: DAPP}, popup, c.deps);
    expect(c.page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/dapp/__tests__/decide.test.ts src/background/dapp/__tests__/lockHook.test.ts src/background/dapp/__tests__/signMessage.test.ts
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  3 failed (3) · Tests  3 failed | 44 passed (47). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/background/dapp/decide.ts`:

````diff
diff --git a/extension/src/background/dapp/decide.ts b/extension/src/background/dapp/decide.ts
--- a/extension/src/background/dapp/decide.ts
+++ b/extension/src/background/dapp/decide.ts
@@ -12,6 +12,8 @@ import {inCooldown, rejectionsOf, REJECTIONS_FOR_COOLDOWN} from './limits';
 import {runtimeFor} from './ports';
 import {answer, headOf, isOpenEntry, queueAccess, rejectQueued, userRejected, type Effects} from './queue';
 import {dropGrant, grantIn, putGrant, type Decision, type Entry, type Tx} from './store';
+import {base64} from '@scure/base';
+import {checkMessage, checkSiws, finishSign, homoglyphRanges, keywordIn} from './signMessage';
 
 /**
  * The approval window's two messages (spec §1.4, §2.3, C13, C17): `dapp.pending` — what the window shows — and
@@ -59,6 +61,20 @@ export interface ConnectDetail {
   cap: boolean;
 }
 
+/** #46's details (§3.2 steps 4–6): the granted account, the text as text, its length, the keyword alert, the marks, a SIWS mismatch. */
+export interface SignDetail {
+  account: AccountChoice;
+  text: string;
+  /** Characters (code points), for "Message · UTF-8 (<n> chars)". */
+  chars: number;
+  /** The first structured-approval keyword (rule 6), or null. */
+  keyword: string | null;
+  /** UTF-16 ranges of `text` to <mark>: the keyword's occurrences, and — for a lookalike origin — every homoglyph. */
+  marks: {start: number; end: number}[];
+  /** Rule 3: the domain a SIWS message names when it is not this site's (Q20: no Sign), else null. */
+  siwsMismatch: string | null;
+}
+
 export interface RequestView {
   requestId: string;
   type: Entry['type'];
@@ -69,6 +85,7 @@ export interface RequestView {
   offerBlock: boolean;
   /** Null while locked: the locked screen shows the origin card only (D11). */
   connect: ConnectDetail | null;
+  sign: SignDetail | null;
 }
 
 export type PendingView =
@@ -84,21 +101,37 @@ async function choices(ext: Ext, tx: Tx): Promise<{accounts: AccountChoice[]; se
   return {accounts: accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})), selected};
 }
 
+function signDetail(e: Entry, site: SiteView, account: AccountChoice): SignDetail | null {
+  if (e.message === null || e.account === null) return null;
+  const checked = checkMessage(base64.decode(e.message));
+  if ('refused' in checked) return null;
+  const text = checked.text;
+  const keyword = keywordIn(text);
+  const siws = checkSiws(text, e.origin, e.account);
+  const marks = [...(keyword?.ranges ?? []), ...(site.kind === 'lookalike' ? homoglyphRanges(text) : [])].sort((a, b) => a.start - b.start);
+  return {account, text, chars: [...text].length, keyword: keyword?.word ?? null, marks, siwsMismatch: siws.siws && !siws.domainOk ? siws.domain : null};
+}
+
 async function viewOf(ext: Ext, tx: Tx, e: Entry): Promise<RequestView> {
   const unlocked = tx.session !== null;
+  const site = siteView(e.host);
   let connect: ConnectDetail | null = null;
-  if (unlocked && e.type === 'connect') {
+  let sign: SignDetail | null = null;
+  if (unlocked) {
     const c = await choices(ext, tx);
-    connect = {...c, cap: grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS};
+    if (e.type === 'connect') connect = {...c, cap: grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS};
+    const named = c.accounts.find(a => a.publicKey === e.account);
+    if (e.type === 'signMessage' && named !== undefined) sign = signDetail(e, site, named);
   }
   return {
     requestId: e.requestId,
     type: e.type,
     origin: e.origin,
     host: e.host,
-    site: siteView(e.host),
+    site,
     offerBlock: rejectionsOf(tx.limits, e.host, e.tabId) >= REJECTIONS_FOR_COOLDOWN - 1,
     connect,
+    sign,
   };
 }
 
@@ -120,7 +153,7 @@ export async function pending(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<
   });
 }
 
-export type DecideError = 'malformed' | 'not-head' | 'expired' | 'locked' | 'unknown-account' | 'scope' | 'blocked' | 'cap' | 'no-grant' | 'account';
+export type DecideError = 'malformed' | 'not-head' | 'expired' | 'locked' | 'unknown-account' | 'scope' | 'blocked' | 'cap' | 'no-grant' | 'account' | 'siws-mismatch';
 export interface DecideRequest {
   requestId: string;
   decision: Decision;
@@ -176,6 +209,13 @@ function approvalRefused(tx: Tx, e: Entry, d: DecideRequest): DecideError | null
     // review 2 M9: the grant must still be held for the request's account.
     if (grantIn(tx, e.origin)?.account !== e.account) return 'no-grant';
     if (d.account !== e.account) return 'account';
+    // §3.2 rule 3: a sign-in message for another domain has no Sign (C13: the window's missing button is not the check).
+    if (e.message !== null) {
+      const checked = checkMessage(base64.decode(e.message));
+      if (!('text' in checked)) return 'malformed';
+      const siws = checkSiws(checked.text, e.origin, e.account ?? '');
+      if (siws.siws && !siws.domainOk) return 'siws-mismatch';
+    }
   }
   return null;
 }
@@ -230,6 +270,6 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
   if (typeof out === 'string' && out !== 'done') return {ok: false, error: out};
   // §2.2: a decision in the window is a user action — it arms the auto-lock timer (page requests never do).
   if ((await getSession(ext)) !== null) await armAutolock(ext).catch(e => console.warn('dApp decide: the idle timer was not re-armed', e));
-  if (typeof out === 'object') await finishConnect(ext, deps, d.requestId, instance);
+  if (typeof out === 'object') await (out.approved === 'connect' ? finishConnect : finishSign)(ext, deps, d.requestId, instance);
   return {ok: true};
 }
````

Modify `extension/src/background/dapp/pageApi.ts`:

````diff
diff --git a/extension/src/background/dapp/pageApi.ts b/extension/src/background/dapp/pageApi.ts
--- a/extension/src/background/dapp/pageApi.ts
+++ b/extension/src/background/dapp/pageApi.ts
@@ -5,6 +5,7 @@ import {inCooldown} from './limits';
 import {PAGE_PORT, owns, pageOrigin, runtimeFor, type LivePort, type PortLike} from './ports';
 import {MAX_OPEN, documentChanged, isOpenEntry, newRequestId, queueAccess, rejectQueued} from './queue';
 import {dropGrant, grantIn, putGrant, type Entry, type ErrorCode, type Tx} from './store';
+import {checkMessage, checkSiws, signRequestOf} from './signMessage';
 import {ensureWindow} from './window';
 
 /**
@@ -112,6 +113,37 @@ async function connect(ext: Ext, deps: WalletDeps, live: LivePort, id: string, s
   });
 }
 
+/**
+ * page.signMessage (§3.2): the checks in the spec's order — each refusal before any window — then queued. A SIWS
+ * message naming another domain is queued too (#46 shows Q20 and only [Reject]); one naming another address is not.
+ */
+async function signMessage(ext: Ext, deps: WalletDeps, live: LivePort, id: string, m: Record<string, unknown>): Promise<Reply> {
+  const req = signRequestOf(m);
+  return queueAccess(ext, deps, (tx, fx): Reply => {
+    documentChanged(tx, fx, live);
+    const again = resent(tx, live, id);
+    if (again !== null) {
+      if (again.state === 'answered') fx.answered.push(again);
+      return {id, accepted: true, requestId: again.requestId};
+    }
+    if (req === null) return {id, error: 'invalid-request'};
+    // 1. Only the granted account of a granted origin, while unlocked (§2.2: a sign request while locked is unauthorized).
+    if (grantedAccount(tx, live.origin) !== req.account) return {id, error: 'unauthorized'};
+    // 2.
+    const checked = checkMessage(req.bytes);
+    if ('refused' in checked) return {id, error: 'invalid-request'};
+    // 3.
+    const siws = checkSiws(checked.text, live.origin, req.account);
+    if (siws.siws && !siws.addressOk) return {id, error: 'invalid-request'};
+    if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {id, error: 'rejected'};
+    const refused = admit(tx, live);
+    if (refused !== null) return {id, error: refused};
+    touch(tx, live.origin);
+    const message = typeof m.message === 'string' ? m.message : '';
+    return {id, accepted: true, requestId: enqueue(tx, deps, live, id, {type: 'signMessage', account: req.account, message}).requestId};
+  });
+}
+
 /** C2: a dApp's disconnect removes its grant, whichever the scope; its queued requests are answered `rejected`. */
 async function disconnect(ext: Ext, deps: WalletDeps, live: LivePort, id: string): Promise<Reply> {
   return queueAccess(ext, deps, (tx, fx): Reply => {
@@ -168,6 +200,13 @@ export async function onPageMessage(ext: Ext, deps: WalletDeps, live: LivePort,
       if ('accepted' in r) await ensureWindow(ext, deps);
       return;
     }
+    case 'page.signMessage': {
+      if (id === null) return invalid();
+      const r = await signMessage(ext, deps, live, id, m);
+      reply(live, r);
+      if ('accepted' in r) await ensureWindow(ext, deps);
+      return;
+    }
     case 'page.disconnect':
       if (id === null) return invalid();
       reply(live, await disconnect(ext, deps, live, id));
````

Create `extension/src/background/dapp/signMessage.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {Message, Transaction, VersionedMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {getSession} from '../session';
import {CONFUSABLES} from './confusables';
import {withRecent} from './grants';
import {answer, queueAccess} from './queue';
import {grantIn, putGrant} from './store';

/**
 * `signMessage` (spec §3.2; D9, review M5, review 2 L5, L6, M10.2). The page's bytes are checked in this order, and
 * each refusal names its reason (a later rule never masks an earlier one):
 *  1. `unauthorized` unless the origin holds a grant for exactly this account (pageApi.ts);
 *  2. `invalid-request`, no window: more than 4 KiB; bytes that deserialize as a legacy Message or Transaction, a
 *     VersionedTransaction or a VersionedMessage; the off-chain prefix `\xffsolana offchain`; not valid UTF-8; a
 *     control character other than \n, \t, and a \r directly before \n; any format character (\p{Cf});
 *  3. Sign-In-With-Solana: the second line must be the account (else `invalid-request`, no window), and the domain
 *     must be this origin's authority — a mismatch opens #46 with Q20 and no Sign (siwsMismatch);
 *  4. otherwise queued; the window shows #46.
 */
export const MAX_MESSAGE_BYTES = 4096;
/** The largest base64 a 4 KiB message can be (the page cannot make us decode more). */
const MAX_BASE64 = Math.ceil(MAX_MESSAGE_BYTES / 3) * 4;
const OFFCHAIN = Uint8Array.from([0xff, ...new TextEncoder().encode('solana offchain')]);

export type MessageRefusal = 'too-long' | 'transaction' | 'offchain' | 'utf8' | 'control' | 'format';

function deserializes(bytes: Uint8Array): boolean {
  const tries: (() => unknown)[] = [
    () => Message.from(bytes),
    () => Transaction.from(bytes),
    () => VersionedTransaction.deserialize(bytes),
    () => VersionedMessage.deserialize(bytes),
  ];
  return tries.some(t => {
    try {
      t();
      return true;
    } catch {
      return false;
    }
  });
}

/** Rule 2, in its order: the first reason the bytes are refused, or the decoded text. */
export function checkMessage(bytes: Uint8Array): {refused: MessageRefusal} | {text: string} {
  if (bytes.length > MAX_MESSAGE_BYTES) return {refused: 'too-long'};
  if (deserializes(bytes)) return {refused: 'transaction'};
  if (bytes.length >= OFFCHAIN.length && OFFCHAIN.every((b, i) => bytes[i] === b)) return {refused: 'offchain'};
  let text: string;
  try {
    // ignoreBOM: a leading U+FEFF stays in the text, where the format rule below sees it.
    text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  } catch {
    return {refused: 'utf8'};
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]|\r(?!\n)/.test(text)) return {refused: 'control'};
  if (/\p{Cf}/u.test(text)) return {refused: 'format'};
  return {text};
}

/** The SIWS first line (§3.2 rule 3). */
const SIWS_HEAD = /^(.+) wants you to sign in with your Solana account:$/;
const lines = (text: string): string[] => text.split('\n').map(l => l.replace(/\r$/, ''));

/** The authority a SIWS message must name for this origin: the host, or host:port with an explicit port (review 2 L5). */
export function authorityOf(origin: string): string {
  const u = new URL(origin);
  return u.port === '' ? u.hostname : `${u.hostname}:${u.port}`;
}

export type SiwsCheck = {siws: false} | {siws: true; domain: string; addressOk: boolean; domainOk: boolean};

export function checkSiws(text: string, origin: string, account: string): SiwsCheck {
  const [first, second] = lines(text);
  const m = SIWS_HEAD.exec(first ?? '');
  if (m === null) return {siws: false};
  const domain = m[1] ?? '';
  return {siws: true, domain, addressOk: second === account, domainOk: domain === authorityOf(origin)};
}

/** Rule 6's words: the design's six and four of ours, as whole words (maximal runs of ASCII letters), case-insensitive. */
export const KEYWORDS = ['approve', 'approval', 'permit', 'allowance', 'authorize', 'authorise', 'spending', 'spend', 'delegate', 'transfer', 'withdraw'];

/** The first keyword in text order, and every occurrence of it (UTF-16 ranges) — or null. */
export function keywordIn(text: string): {word: string; ranges: {start: number; end: number}[]} | null {
  let word: string | null = null;
  const ranges: {start: number; end: number}[] = [];
  for (const m of text.matchAll(/[A-Za-z]+/g)) {
    const w = m[0].toLowerCase();
    if (word === null && KEYWORDS.includes(w)) word = w;
    if (word !== null && w === word) ranges.push({start: m.index, end: m.index + m[0].length});
  }
  return word === null ? null : {word, ranges};
}

/** §3.2 step 5: every character outside ASCII that skel maps to Latin (the lookalike state marks it). */
export function homoglyphRanges(text: string): {start: number; end: number}[] {
  const out: {start: number; end: number}[] = [];
  let at = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '');
    if (cp >= 0x80 && (CONFUSABLES.has(cp) || (base !== ch && /^[A-Za-z0-9]$/.test(base)))) out.push({start: at, end: at + ch.length});
    at += ch.length;
  }
  return out;
}

const ACCOUNT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isAccount = (x: unknown): x is string => {
  if (typeof x !== 'string' || !ACCOUNT.test(x)) return false;
  try {
    return base58.decode(x).length === 32;
  } catch {
    return false;
  }
};

/** The page message, decoded: the account and the message bytes — null when either is not even that. */
export function signRequestOf(msg: Record<string, unknown>): {account: string; bytes: Uint8Array} | null {
  const {account, message} = msg;
  if (!isAccount(account) || typeof message !== 'string' || message.length > MAX_BASE64 + 4) return null;
  try {
    return {account, bytes: base64.decode(message)};
  } catch {
    return null;
  }
}

/**
 * §3.2 step 7: the signature. Runs after the `deciding` section (decide.ts): reads the granted account's key, signs the
 * exact bytes with ed25519, and writes the answer in a section that first confirms the entry is still this instance's
 * `deciding` one — a lock or a restart in between answered it `rejected`, and then the signature is dropped here,
 * never delivered.
 */
export async function finishSign(ext: Ext, deps: Pick<WalletDeps, 'now'>, requestId: string, instance: string): Promise<void> {
  const work = await queueAccess(ext, deps, tx => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.account === null || e.message === null) return null;
    return {account: e.account, message: e.message};
  });
  if (work === null) return;
  const key = (await getSession(ext))?.find(a => a.publicKey === work.account);
  let signature: string | null = null;
  if (key !== undefined) {
    const sk = base64.decode(key.secretKey);
    try {
      signature = base64.encode(ed25519.sign(base64.decode(work.message), sk.subarray(0, 32)));
    } finally {
      sk.fill(0);
    }
  }
  await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return;
    // A lock answered the entry before this section (the check above). An account removed while its key was read is
    // still a signature computed — dropped here, never delivered (review 1 M4); `tx.session === null` is the narrowing.
    if (signature === null || tx.session === null || !tx.session.some(a => a.publicKey === work.account)) {
      answer(fx, e, {error: 'rejected'}, tx.now);
      return;
    }
    const g = grantIn(tx, e.origin);
    if (g !== null) putGrant(tx, withRecent(g, 'signMessage', tx.now, 'approved'));
    answer(fx, e, {result: {signature, signedMessage: work.message}}, tx.now);
  });
}
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run src/background/dapp/__tests__/decide.test.ts src/background/dapp/__tests__/lockHook.test.ts src/background/dapp/__tests__/signMessage.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  3 passed (3) · Tests  71 passed (71); tsc clean; whole suite Test Files  146 passed (146) · Tests  2958 passed (2958); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M6k** — a sign request decided after its grant ended ("grant still held" row) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -     if (grantIn(tx, e.origin)?.account !== e.account) return 'no-grant';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6l** — a sign request approved for another account ("signMessage" row) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -     if (d.account !== e.account) return 'account';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6m** — no deciding state (C17, spec mutation) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -     e.state = 'deciding';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  4 failed | 20 passed (24)).

- **M6n** — revoke leaves the queue (spec mutation) — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -     fx.changes.set(origin, []);
  -     rejectQueued(tx, fx, e => e.origin === origin);
  -     const token
  +     fx.changes.set(origin, []);
  +     const token
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6q** — revoke all leaves the origins' queued requests — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -     rejectQueued(tx, fx, e => origins.has(e.origin));
  +     rejectQueued(tx, fx, e => origins.has(e.origin) && false);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/decide.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M6r** — an account removed leaves its origins' queued requests — `extension/src/background/dapp/grantsApi.ts`:

  ```diff
  -       rejectQueued(tx, fx, e => e.origin === g.origin);
  +       rejectQueued(tx, fx, e => e.origin === g.origin && false);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/lockHook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- **M6a** — no deserialization check (spec mutation: the artifact test red, the others unchanged) — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  -   if (deserializes(bytes)) return {refused: 'transaction'};
  +   if (deserializes(bytes) && false) return {refused: 'transaction'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 22 passed (24)).

- **M6b** — the off-chain prefix checked after UTF-8 (its reason masked) — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  -   if (bytes.length >= OFFCHAIN.length && OFFCHAIN.every((b, i) => bytes[i] === b)) return {refused: 'offchain'};
  -   let text: string;
  +   if (bytes.length >= OFFCHAIN.length && OFFCHAIN.every((b, i) => bytes[i] === b) && false) return {refused: 'offchain'};
  +   let text: string;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6c** — a BOM swallowed by the decoder (never reaches the format rule) — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  - {fatal: true, ignoreBOM: true}
  + {fatal: true}
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6d** — a lone \r accepted — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  - \u001F\u007F-\u009F]|\r(?!\n)/
  + \u001F\u007F-\u009F]/
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6e** — format characters accepted (review 2 L6) — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  -   if (/\p{Cf}/u.test(text)) return {refused: 'format'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6f** — a SIWS message for another address queued — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  -     if (siws.siws && !siws.addressOk) return {id, error: 'invalid-request'};
  +     if (siws.siws && !siws.addressOk && false) return {id, error: 'invalid-request'};
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6g** — the SIWS authority ignores the port (review 2 L5) — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  -   return u.port === '' ? u.hostname : `${u.hostname}:${u.port}`;
  +   return u.hostname;
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6h** — keywords matched inside words — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  -   for (const m of text.matchAll(/[A-Za-z]+/g)) {
  +   for (const m of text.matchAll(/[A-Za-z]+?/g)) {
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 22 passed (24)).

- **M6i** — a SIWS mismatch approvable in the background (R20) — `extension/src/background/dapp/decide.ts`:

  ```diff
  -       if (siws.siws && !siws.domainOk) return 'siws-mismatch';
  +       if (siws.siws && !siws.domainOk && false) return 'siws-mismatch';
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6j** — the signature delivered although a lock answered the entry meanwhile — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  -     if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return;
  -     // A lock answered
  +     if (e === undefined) return;
  +     // A lock answered
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6o** — a blocked or cooling-down host's sign request is queued — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  -     if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {id, error: 'rejected'};
  -     const refused = admit(tx, live);
  +     if ((isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) && false) return {id, error: 'rejected'};
  +     const refused = admit(tx, live);
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- **M6p** — the signature delivered for an account removed while its key was read — `extension/src/background/dapp/signMessage.ts`:

  ```diff
  -  || tx.session === null || !tx.session.some(a => a.publicKey === work.account)) {
  +  || tx.session === null) {
  ```
  `timeout 300 npx vitest run src/background/dapp/__tests__/signMessage.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 23 passed (24)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/dapp/__tests__/decide.test.ts extension/src/background/dapp/__tests__/lockHook.test.ts extension/src/background/dapp/__tests__/signMessage.test.ts extension/src/background/dapp/decide.ts extension/src/background/dapp/pageApi.ts extension/src/background/dapp/signMessage.ts
git commit -F - <<'MSG'
feat(extension): B1c signMessage — rules 1–6 by reason, SIWS, keywords, the signature through deciding

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 7: The page bundles and the gates: the provider (Wallet Standard, plan 1's four features), the relay, the content-script build, the manifest's `<all_urls>` content scripts, the permissions pin, the page-bundle and dev-origin gate, the relay's port-listener allowance; the new dependencies

**Spec:** §1.1, §1.2, §1.7, §6.2 (permissions, page-bundle, vault-isolation, dev-origin, CSP), §6.1 "Relay", D6, D10, C9, C16, review L4, L5, L13, review 2 M1, M5, M8; Scope R6, R32; plan review 1 L10; Scope R37

**Files:**
- Test: `extension/manifest/__tests__/source.test.mjs`
- Modify: `extension/manifest/source.mjs`
- Modify: `extension/package-lock.json` (npm 11.6.2 writes it — Step 3)
- Modify: `extension/package.json`
- Test: `extension/scripts/__tests__/check-page-bundles.test.mjs` (new)
- Test: `extension/scripts/__tests__/check-permissions.test.mjs`
- Test: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Modify: `extension/scripts/build.mjs`
- Create: `extension/scripts/check-page-bundles.mjs`
- Modify: `extension/scripts/check-permissions.mjs`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Test: `extension/src/provider/__tests__/provider.test.ts` (new)
- Create: `extension/src/provider/bridge.ts`
- Create: `extension/src/provider/codec.ts`
- Create: `extension/src/provider/icon.ts` (generated — Step 3)
- Create: `extension/src/provider/index.ts`
- Create: `extension/src/provider/protocol.ts`
- Create: `extension/src/provider/wallet.ts`
- Test: `extension/src/relay/__tests__/relay.test.ts` (new)
- Create: `extension/src/relay/index.ts`
- Create: `extension/src/relay/protocol.ts`
- Create: `extension/src/relay/relay.ts`
- Create: `extension/vite.content.config.ts`

**Interfaces:**
- Consumes: Task 3's `PAGE_TYPES`, `PAGE_PORT` (pinned by a test, never imported by the page bundles).
- Produces (as exported):
  - `src/provider/`: `protocol.ts` (`FROM_PROVIDER`, `FROM_RELAY`, `METHOD_TYPES`, `ERROR_CODES`), `codec.ts` (`toBase64`, `fromBase64`, `addressBytes`), `bridge.ts` (`ERROR_TEXT`, `NocturaError`, `interface Bridge`, `createBridge(win)`), `icon.ts` (generated: `ICON`), `wallet.ts` (`CHAINS`, `NocturaWallet`), `index.ts` (the entry).
  - `src/relay/`: `protocol.ts` (`FROM_PROVIDER`, `FROM_RELAY`, `PAGE_PORT`, `METHOD_TYPES`), `relay.ts` (`BACKOFF_MS`, `PING_MS`, `interface PortLike`, `interface RelayEnv`, `startRelay(env)`), `index.ts` (the entry).
  - `manifest/source.mjs`: `CONTENT_SCRIPTS {reason, entries}`; `scripts/check-permissions.mjs`: `REQUIRED_CONTENT_SCRIPTS`, `contentScriptViolations`; `scripts/check-page-bundles.mjs`: `CONTENT`, `pageBundleViolations`, `classicScriptViolations`, `devOriginViolations`; `vite.content.config.ts`.

The two content scripts, each its own classic script (an IIFE — a content script cannot be an ES module), built after the main build into the same output by `vite.content.config.ts` (`NOCTURA_CONTENT=provider|relay`), each writing its module map next to the output for the page-bundle gate. **The provider** (MAIN world) registers one wallet "Noctura" with `registerWallet` — the owner's mark as its icon (`web/public/noc-mark.png` as a data URL, generated), `solana:mainnet`, and exactly `standard:connect`, `standard:disconnect`, `standard:events` and `solana:signMessage` (D10; a test pins the list). It posts `{source: 'noctura-provider', id, type, payload}` to `location.origin`, accepts only `source: 'noctura-relay'` messages from its own window, turns codes into `NocturaError` (4001, 4100 or the stable string, a fixed English message), and keeps only the accounts the background sent (a change, and only a change, is announced). **The relay** (isolated world) forwards exactly the five method types (the relay's own `type` and `id` win over the page's payload), drops `page.resume` / `ack` / `ping` from the page, opens its port lazily on the document's first request and never while prerendering, reconnects (0.5 s, 1 s, 2 s, then on `visibilitychange`) re-sending what was not yet accepted and resuming what it awaits, pings every 20 s while it waits, posts answers and `change` events to the page and acks each answer. **The gates:** the permissions gate pins both entries (matches, world, run_at, all_frames — in place of B1b's "no content_scripts"); `check-page-bundles.mjs` (in `npm run gates`) refuses any module outside `src/provider` + `@wallet-standard` (provider) or `src/relay` (relay), an ES-module content script, a copy that differs between the three outputs, and a `background.js` naming `localhost` or `127.0.0.1` (the dev-origin gate, R6); the vault-isolation gate lets `src/relay` name `onMessage` in exactly its two port spellings. No new permission; CSP unchanged.

The dependencies, exact versions, with npm 11.6.2 (the lockfile writer CI pins): `@wallet-standard/wallet@1.1.1` and `@wallet-standard/base@1.1.1` (Apache-2.0; `base` for its types, `wallet` pulls it anyway) and, for E2E only, `@wallet-standard/app@1.1.1` (Apache-2.0). `npm audit` reports the same four moderate advisories as `main` and nothing new (R32).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/manifest/__tests__/source.test.mjs`:

````diff
diff --git a/extension/manifest/__tests__/source.test.mjs b/extension/manifest/__tests__/source.test.mjs
--- a/extension/manifest/__tests__/source.test.mjs
+++ b/extension/manifest/__tests__/source.test.mjs
@@ -1,4 +1,4 @@
-import {render, PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP} from '../source.mjs';
+import {render, PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP, CONTENT_SCRIPTS} from '../source.mjs';
 
 describe('manifest source', () => {
   it('asks for exactly storage and alarms, each with a reason', () => {
@@ -43,10 +43,21 @@ describe('manifest source', () => {
     expect(m.browser_specific_settings.gecko.data_collection_permissions.required.length).toBeGreaterThan(0);
   });
 
-  it('gives both browsers the same permissions, hosts, CSP and pages', () => {
+  // B1c §1.7: the provider (MAIN) and the relay (ISOLATED), every page, top frame only, at document_start — with the reason.
+  it('declares exactly the two B1c content scripts, with the reason a reviewer is owed', () => {
+    expect(render('chrome').content_scripts).toEqual([
+      {matches: ['<all_urls>'], js: ['provider.js'], run_at: 'document_start', all_frames: false, world: 'MAIN'},
+      {matches: ['<all_urls>'], js: ['relay.js'], run_at: 'document_start', all_frames: false, world: 'ISOLATED'},
+    ]);
+    expect(CONTENT_SCRIPTS.reason).toBe(
+      'Sites find the wallet through Wallet Standard, which must be present on every page; the scripts read nothing from the page and send nothing unless the site asks the wallet.',
+    );
+  });
+
+  it('gives both browsers the same permissions, hosts, CSP, pages and content scripts', () => {
     const c = render('chrome');
     const f = render('firefox');
-    for (const k of ['permissions', 'host_permissions', 'content_security_policy', 'action', 'name', 'version']) {
+    for (const k of ['permissions', 'host_permissions', 'content_security_policy', 'action', 'name', 'version', 'content_scripts']) {
       expect(f[k]).toEqual(c[k]);
     }
   });
````

Create `extension/scripts/__tests__/check-page-bundles.test.mjs`:

````js
import {CONTENT, classicScriptViolations, devOriginViolations, pageBundleViolations} from '../check-page-bundles.mjs';

const map = (file, ids) => ({chunks: {[file]: ids}});
const PROVIDER = ['node_modules/@wallet-standard/wallet/lib/esm/register.js', 'src/provider/index.ts', 'src/provider/wallet.ts'];

// B1c §6.2: the page-bundle gate and the dev-origin gate, each with its positive control.
describe('page-bundle gate', () => {
  it('accepts the provider with its own sources and @wallet-standard, and the relay with its own sources only', () => {
    expect(CONTENT.provider.packages).toEqual(['@wallet-standard/wallet', '@wallet-standard/base']);
    expect(pageBundleViolations('provider', map('provider.js', PROVIDER))).toEqual([]);
    expect(pageBundleViolations('relay', map('relay.js', ['src/relay/index.ts', 'src/relay/relay.ts']))).toEqual([]);
  });

  it('refuses any module of the background, the vault, the vault page, the popup, the approval window, core/ or web/', () => {
    for (const bad of ['src/background/dapp/classify.ts', 'src/vault/envelope.ts', 'src/unlock/main.ts', 'src/app/engine.ts', 'src/approve/main.tsx', '../core/solana/rpc.ts', '../web/src/ui/Icon.tsx', 'src/relay/protocol.ts']) {
      expect([bad, pageBundleViolations('provider', map('provider.js', [...PROVIDER, bad])).length]).toEqual([bad, 1]);
    }
  });

  it('refuses another package, a package nested inside an allowed one, and @wallet-standard in the relay', () => {
    expect(pageBundleViolations('provider', map('provider.js', [...PROVIDER, 'node_modules/@solana/web3.js/lib/index.browser.esm.js']))).toHaveLength(1);
    expect(pageBundleViolations('provider', map('provider.js', [...PROVIDER, 'node_modules/@wallet-standard/wallet/node_modules/x/index.js']))).toHaveLength(1);
    expect(pageBundleViolations('relay', map('relay.js', ['src/relay/index.ts', 'node_modules/@wallet-standard/base/lib/esm/index.js']))).toHaveLength(1);
  });

  it('is INCONCLUSIVE without a map or without the entry, and refuses a second chunk', () => {
    expect(pageBundleViolations('relay', undefined)[0]).toMatch(/^INCONCLUSIVE/);
    expect(pageBundleViolations('relay', map('relay.js', ['src/relay/relay.ts']))[0]).toMatch(/^INCONCLUSIVE/);
    expect(pageBundleViolations('relay', {chunks: {'relay.js': ['src/relay/index.ts'], 'other.js': []}})).toHaveLength(1);
  });

  it('a content script must be a classic script', () => {
    expect(classicScriptViolations('relay', '(function(){var e=1})();')).toEqual([]);
    expect(classicScriptViolations('relay', 'import{a as b}from"./x.js";b();')).toHaveLength(1);
    expect(classicScriptViolations('relay', 'var a=1;export{a};')).toHaveLength(1);
  });
});

describe('dev-origin gate (§1.3, §6.2)', () => {
  it('a store build’s background names neither localhost nor 127.0.0.1', () => {
    expect(devOriginViolations('const ok = "https:";')).toEqual([]);
    expect(devOriginViolations('if(o==="http://localhost")ok()')).toHaveLength(1);
    expect(devOriginViolations('a="http://127.0.0.1:8080"')).toHaveLength(1);
    expect(devOriginViolations(undefined)[0]).toMatch(/^INCONCLUSIVE/);
  });
});
````

Modify `extension/scripts/__tests__/check-permissions.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-permissions.test.mjs b/extension/scripts/__tests__/check-permissions.test.mjs
--- a/extension/scripts/__tests__/check-permissions.test.mjs
+++ b/extension/scripts/__tests__/check-permissions.test.mjs
@@ -1,4 +1,4 @@
-import {REQUIRED_CONNECT_SRC, REQUIRED_CSP, comparePermissions, connectSrcViolations, cspViolations} from '../check-permissions.mjs';
+import {REQUIRED_CONNECT_SRC, REQUIRED_CONTENT_SCRIPTS, REQUIRED_CSP, comparePermissions, connectSrcViolations, contentScriptViolations, cspViolations} from '../check-permissions.mjs';
 import {EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION, render} from '../../manifest/source.mjs';
 
 describe('permissions gate', () => {
@@ -19,6 +19,30 @@ describe('permissions gate', () => {
     expect(comparePermissions(m, 'firefox')[0]).toMatch(/^host_permissions differ/);
   });
 
+  // B1c §6.2 (review L4): both content-script entries pinned in place of B1b's "no content_scripts" line.
+  it('pins the two content scripts — matches, world, run_at, all_frames — and refuses any change, extra or missing entry', () => {
+    expect(REQUIRED_CONTENT_SCRIPTS).toEqual([
+      {matches: ['<all_urls>'], js: ['provider.js'], run_at: 'document_start', all_frames: false, world: 'MAIN'},
+      {matches: ['<all_urls>'], js: ['relay.js'], run_at: 'document_start', all_frames: false, world: 'ISOLATED'},
+    ]);
+    const changed = [
+      m => (m.content_scripts[0].all_frames = true),
+      m => (m.content_scripts[1].world = 'MAIN'),
+      m => (m.content_scripts[0].run_at = 'document_idle'),
+      m => (m.content_scripts[1].matches = ['<all_urls>', 'file:///*']),
+      m => m.content_scripts.push({matches: ['<all_urls>'], js: ['x.js']}),
+      m => m.content_scripts.pop(),
+      m => (m.content_scripts[0].match_about_blank = true),
+      m => delete m.content_scripts,
+    ];
+    for (const change of changed) {
+      const m = render('chrome');
+      change(m);
+      expect(comparePermissions(m, 'chrome').some(p => p.startsWith('content_scripts'))).toBe(true);
+    }
+    expect(contentScriptViolations(render('firefox').content_scripts)).toEqual([]);
+  });
+
   it('refuses a loosened CSP', () => {
     const m = render('chrome');
     m.content_security_policy = {extension_pages: "script-src 'self' 'unsafe-eval'"};
````

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -398,6 +398,18 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
     expect(sourceViolations([f('src/app/screens/Contacts.tsx', "const k = 'v1_contacts';")])).toEqual([OWNED('src/app/screens/Contacts.tsx', 'v1_contacts')]);
     expect(sourceViolations([f('src/unlock/main.ts', '// v1_contacts')])).toEqual([OWNED('src/unlock/main.ts', 'v1_contacts')]);
   });
+  // B1c §1.2: the relay may listen on the port it connected — and in no other way; nobody else may.
+  it('lets the relay listen on its own port only: p.onMessage and its PortLike member; runtime.onMessage and onConnect stay refused', () => {
+    const LISTENS = path => `${path}: listens for runtime messages outside the background`;
+    const member = 'export interface PortLike {\n  onMessage: {addListener(cb: (m: unknown) => void): void};\n}';
+    expect(sourceViolations([f('src/relay/relay.ts', `${member}\np.onMessage.addListener(onPortMessage);`)])).toEqual([]);
+    expect(sourceViolations([f('src/relay/relay.ts', 'chrome.runtime.onMessage.addListener(x);')])).toEqual([LISTENS('src/relay/relay.ts')]);
+    expect(sourceViolations([f('src/relay/relay.ts', 'chrome.runtime.onConnect.addListener(x);')])).toEqual([LISTENS('src/relay/relay.ts')]);
+    expect(sourceViolations([f('src/relay/relay.ts', 'port.onMessageExternal.addListener(x);')])).toEqual([LISTENS('src/relay/relay.ts')]);
+    expect(sourceViolations([f('src/app/x.ts', 'p.onMessage.addListener(x);')])).toEqual([LISTENS('src/app/x.ts')]);
+    expect(sourceViolations([f('src/approve/x.ts', 'p.onMessage.addListener(x);')])).toEqual([LISTENS('src/approve/x.ts')]);
+  });
+
   // B1c (spec §2.1, review 1 L4): the dApp grants, blocked sites and limits are the background's — the approval window,
   // the popup and the vault page reach them only through dapp.* messages.
   it('lets only the background name the three dApp keys (v1_dapp_grants, v1_dapp_blocked, v1_dapp_limits)', () => {
````

Create `extension/src/provider/__tests__/provider.test.ts`:

````ts
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {createBridge, NocturaError} from '../bridge';
import {addressBytes} from '../codec';
import {ICON} from '../icon';
import {NocturaWallet} from '../wallet';

const ORIGIN = 'https://dapp.test';
const A = base58.encode(ed25519.getPublicKey(new Uint8Array(32).fill(1)));
const B = base58.encode(ed25519.getPublicKey(new Uint8Array(32).fill(2)));

/** A window as the provider sees it: an EventTarget with location.origin, crypto and postMessage (recorded). */
function fakeWindow() {
  const target = new EventTarget();
  const posted: {m: Record<string, unknown>; to: string}[] = [];
  const win = Object.assign(target, {
    location: {origin: ORIGIN},
    crypto: globalThis.crypto,
    postMessage: (m: Record<string, unknown>, to: string) => void posted.push({m, to}),
  });
  /** A message event as the browser dispatches one (window.postMessage from this window: source = window). */
  const dispatch = (data: unknown, o: {source?: unknown; origin?: string} = {}) =>
    target.dispatchEvent(Object.assign(new Event('message'), {data, origin: o.origin ?? ORIGIN, source: 'source' in o ? o.source : win}));
  return {win: win as unknown as Window, posted, dispatch};
}

/** The relay's answer to the last request the provider posted. */
const answerLast = (w: ReturnType<typeof fakeWindow>, body: Record<string, unknown>) => {
  const last = w.posted[w.posted.length - 1]?.m;
  w.dispatch({source: 'noctura-relay', id: last?.id, ...body});
};
const flush = () => new Promise(r => setTimeout(r, 0));

// Spec §1.1, D6, D10 — the MAIN-world provider: one wallet "Noctura", only plan 1's features, no state but the accounts.
describe('the Noctura wallet (Wallet Standard)', () => {
  it('name, version, chains solana:mainnet only, and exactly plan 1’s four features (D10)', () => {
    const wallet = new NocturaWallet(createBridge(fakeWindow().win));
    expect([wallet.name, wallet.version, wallet.chains]).toEqual(['Noctura', '1.0.0', ['solana:mainnet']]);
    expect(Object.fromEntries(Object.entries(wallet.features).map(([k, v]) => [k, v.version]))).toEqual({
      'standard:connect': '1.0.0',
      'standard:disconnect': '1.0.0',
      'standard:events': '1.0.0',
      'solana:signMessage': '1.1.0',
    });
    expect(wallet.accounts).toEqual([]);
  });

  it('the icon is the owner’s mark, web/public/noc-mark.png, as a data URL (generated, never edited)', () => {
    expect(ICON.startsWith('data:image/png;base64,')).toBe(true);
    const png = readFileSync(join(__dirname, '..', '..', '..', '..', 'web', 'public', 'noc-mark.png'));
    expect(Buffer.from(base64.decode(ICON.slice('data:image/png;base64,'.length))).equals(png)).toBe(true);
  });

  it('connect posts page.connect to this origin only, and takes the accounts the background sent; one change event', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const changes: unknown[] = [];
    wallet.features['standard:events'].on('change', p => void changes.push(p.accounts?.map(a => a.address)));
    const pending = wallet.features['standard:connect'].connect();
    expect(w.posted).toEqual([{m: {source: 'noctura-provider', id: expect.stringMatching(/^[0-9a-f]{24}$/), type: 'page.connect', payload: {silent: false}}, to: ORIGIN}]);
    answerLast(w, {result: {accounts: [A]}});
    const r = await pending;
    expect(r.accounts.map(a => a.address)).toEqual([A]);
    expect(Array.from(r.accounts[0]?.publicKey ?? [])).toEqual(Array.from(base58.decode(A)));
    expect(r.accounts[0]?.features).toEqual(['solana:signMessage']);
    expect(changes).toEqual([[A]]);
    // A silent connect says so.
    void wallet.features['standard:connect'].connect({silent: true});
    expect(w.posted[1]?.m.payload).toEqual({silent: true});
  });

  it('ignores a message from another window, another origin, or with another source tag', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const pending = wallet.features['standard:connect'].connect();
    const id = w.posted[0]?.m.id;
    w.dispatch({source: 'noctura-relay', id, result: {accounts: [B]}}, {source: {}});
    w.dispatch({source: 'noctura-relay', id, result: {accounts: [B]}}, {origin: 'https://evil.test'});
    w.dispatch({source: 'noctura-provider', id, result: {accounts: [B]}});
    await flush();
    expect(wallet.accounts).toEqual([]);
    w.dispatch({source: 'noctura-relay', id, result: {accounts: [A]}});
    expect((await pending).accounts.map(a => a.address)).toEqual([A]);
  });

  it('a refusal becomes an Error with a stable code and a fixed English message (C10); an unknown code is invalid-request', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const one = wallet.features['standard:connect'].connect();
    answerLast(w, {error: 'rejected'});
    await expect(one).rejects.toMatchObject({name: 'NocturaError', code: 4001, message: 'The user rejected the request.'});
    const two = wallet.features['standard:connect'].connect();
    answerLast(w, {error: 'Internal: stack trace …'});
    await expect(two).rejects.toMatchObject({code: 'invalid-request'});
    expect(new NocturaError('unauthorized').code).toBe(4100);
  });

  it('signMessage: refused for an account it was not given (no message posted); for the connected one, the bytes come back', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const c = wallet.features['standard:connect'].connect();
    answerLast(w, {result: {accounts: [A]}});
    const [account] = (await c).accounts;
    const stranger = {...account!, address: B, publicKey: base58.decode(B)};
    await expect(wallet.features['solana:signMessage'].signMessage({account: stranger, message: new Uint8Array([1])})).rejects.toMatchObject({code: 4100});
    expect(w.posted).toHaveLength(1);
    const message = new TextEncoder().encode('Sign in to the test dApp.');
    const sig = new Uint8Array(64).fill(7);
    const s = wallet.features['solana:signMessage'].signMessage({account: account!, message});
    expect(w.posted[1]?.m).toMatchObject({type: 'page.signMessage', payload: {account: A, message: base64.encode(message)}});
    answerLast(w, {result: {signature: base64.encode(sig), signedMessage: base64.encode(message)}});
    expect(await s).toEqual([{signedMessage: message, signature: sig, signatureType: 'ed25519'}]);
  });

  it('a change event from the background updates the accounts; the same accounts again announce nothing; off() stops the listener', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    const seen: string[][] = [];
    const off = wallet.features['standard:events'].on('change', p => void seen.push((p.accounts ?? []).map(a => a.address)));
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: [A]});
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: [A]});
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: []});
    off();
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: [B]});
    expect(seen).toEqual([[A], []]);
    expect(wallet.accounts.map(a => a.address)).toEqual([B]);
    expect(wallet.features['standard:events'].on('other' as 'change', () => undefined)()).toBeUndefined();
  });

  it('disconnect asks the background (C2: it removes the grant), then clears the accounts', async () => {
    const w = fakeWindow();
    const wallet = new NocturaWallet(createBridge(w.win));
    w.dispatch({source: 'noctura-relay', event: 'change', accounts: [A]});
    const d = wallet.features['standard:disconnect'].disconnect();
    expect(w.posted[0]?.m).toMatchObject({type: 'page.disconnect', payload: {}});
    answerLast(w, {result: {}});
    await d;
    expect(wallet.accounts).toEqual([]);
  });

  it('addressBytes: 32 bytes for an address, null for anything else', () => {
    expect(Array.from(addressBytes(A) ?? [])).toEqual(Array.from(base58.decode(A)));
    expect(addressBytes('11111111111111111111111111111111')).toEqual(new Uint8Array(32));
    for (const bad of ['', 'not an address', A.slice(0, 20), `${A}0`]) expect(addressBytes(bad)).toBeNull();
  });
});
````

Create `extension/src/relay/__tests__/relay.test.ts`:

````ts
import {BACKOFF_MS, PING_MS, startRelay, type PortLike} from '../relay';
import * as relayProtocol from '../protocol';
import * as providerProtocol from '../../provider/protocol';
import {PAGE_TYPES} from '../../background/dapp/pageApi';
import {PAGE_PORT} from '../../background/dapp/ports';

const ORIGIN = 'https://dapp.test';

interface FakePort extends PortLike {
  name: string;
  sent: Record<string, unknown>[];
  /** The background posting to the relay. */
  push(m: unknown): void;
  /** The background side going away (a worker stop). */
  drop(): void;
}

function harness(o: {prerendering?: boolean} = {}) {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {prerendering: o.prerendering ?? false, visibilityState: 'visible'});
  const toPage: Record<string, unknown>[] = [];
  Object.assign(win, {location: {origin: ORIGIN}, postMessage: (m: Record<string, unknown>, to: string) => void (to === ORIGIN && toPage.push(m))});
  const ports: FakePort[] = [];
  const connect = (name: string): FakePort => {
    const onMessage: ((m: unknown) => void)[] = [];
    const onDisconnect: (() => void)[] = [];
    const p: FakePort = {
      name,
      sent: [],
      postMessage: m => void p.sent.push(m as Record<string, unknown>),
      disconnect: () => undefined,
      onMessage: {addListener: cb => void onMessage.push(cb)},
      onDisconnect: {addListener: cb => void onDisconnect.push(cb)},
      push: m => onMessage.forEach(cb => cb(m)),
      drop: () => onDisconnect.forEach(cb => cb()),
    };
    ports.push(p);
    return p;
  };
  startRelay({
    win: win as unknown as Window,
    doc: doc as unknown as Document,
    connect,
    setTimeout: (f, ms) => setTimeout(f, ms),
    setInterval: (f, ms) => setInterval(f, ms),
    clearInterval: id => clearInterval(id as ReturnType<typeof setInterval>),
  });
  const fromPage = (data: unknown, source: unknown = win) => win.dispatchEvent(Object.assign(new Event('message'), {data, origin: ORIGIN, source}));
  const ask = (type: string, id: string, payload: Record<string, unknown> = {}) => fromPage({source: 'noctura-provider', id, type, payload});
  return {win, doc, toPage, ports, fromPage, ask};
}

// Spec §1.2 (review 1 H1, L7; review 2 M1, M5, M8; C9, C16) and §6.1 "Relay".
describe('the relay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('no port at load — the first request of the document opens one, named noctura-page, and forwards it with its id', () => {
    const h = harness();
    expect(h.ports).toEqual([]);
    h.ask('page.connect', 'r1', {silent: false});
    expect(h.ports.map(p => p.name)).toEqual(['noctura-page']);
    expect(h.ports[0]?.sent).toEqual([{silent: false, type: 'page.connect', id: 'r1'}]);
  });

  it('forwards only the five method types — resume, ack and ping from the page are dropped; so is another window’s message', () => {
    const h = harness();
    for (const type of ['page.resume', 'page.ack', 'page.ping', 'vault.lock', 'dapp.decide', 'page.unknown']) h.ask(type, 'x');
    h.fromPage({source: 'noctura-provider', id: 'y', type: 'page.connect', payload: {}}, {});
    h.fromPage({source: 'someone-else', id: 'z', type: 'page.connect', payload: {}});
    h.ask('page.connect', 'bad id!');
    expect(h.ports).toEqual([]);
    for (const [i, type] of ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction'].entries()) h.ask(type, `m${i}`);
    expect(h.ports[0]?.sent.map(m => m.type)).toEqual(['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction']);
  });

  it('a page cannot add fields the relay owns: its own type and id win over the payload', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {type: 'page.ack', id: 'forged', requestId: 'x'});
    expect(h.ports[0]?.sent[0]).toMatchObject({type: 'page.connect', id: 'r1'});
  });

  it('never connects while the document is prerendering — it waits for prerenderingchange (C16)', () => {
    const h = harness({prerendering: true});
    h.ask('page.connect', 'r1', {silent: true});
    expect(h.ports).toEqual([]);
    (h.doc as unknown as {prerendering: boolean}).prerendering = false;
    h.doc.dispatchEvent(new Event('prerenderingchange'));
    expect(h.ports[0]?.sent).toEqual([{silent: true, type: 'page.connect', id: 'r1'}]);
  });

  it('an immediate answer and a late answer reach the page under the page’s id; the late one is acked', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {silent: true});
    h.ports[0]?.push({id: 'r1', result: {accounts: []}});
    h.ask('page.connect', 'r2', {silent: false});
    h.ports[0]?.push({id: 'r2', accepted: true, requestId: 'Q'.repeat(22)});
    h.ports[0]?.push({requestId: 'Q'.repeat(22), result: {accounts: ['A']}});
    expect(h.toPage).toEqual([
      {source: 'noctura-relay', id: 'r1', result: {accounts: []}},
      {source: 'noctura-relay', id: 'r2', result: {accounts: ['A']}},
    ]);
    expect(h.ports[0]?.sent.at(-1)).toEqual({type: 'page.ack', requestId: 'Q'.repeat(22)});
  });

  it('change events go to the page', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {silent: true});
    h.ports[0]?.push({event: 'change', accounts: []});
    expect(h.toPage).toEqual([{source: 'noctura-relay', event: 'change', accounts: []}]);
  });

  it('a lost port: reconnect after 0.5 s, re-send what was not accepted, resume what is awaited; then 1 s, 2 s, then on visibilitychange', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {silent: false});
    h.ports[0]?.push({id: 'r1', accepted: true, requestId: 'R'.repeat(22)});
    h.ask('page.signMessage', 'r2', {account: 'A', message: 'aGk='});
    h.ports[0]?.drop();
    vi.advanceTimersByTime(BACKOFF_MS[0]! - 1);
    expect(h.ports).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(h.ports).toHaveLength(2);
    expect(h.ports[1]?.sent).toEqual([
      {account: 'A', message: 'aGk=', type: 'page.signMessage', id: 'r2'},
      {type: 'page.resume', requestIds: ['R'.repeat(22)]},
    ]);
    h.ports[1]?.drop();
    vi.advanceTimersByTime(BACKOFF_MS[1]!);
    expect(h.ports).toHaveLength(3);
    h.ports[2]?.drop();
    vi.advanceTimersByTime(BACKOFF_MS[2]!);
    expect(h.ports).toHaveLength(4);
    h.ports[3]?.drop();
    vi.advanceTimersByTime(60_000);
    expect(h.ports).toHaveLength(4);
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(h.ports).toHaveLength(5);
    // The resumed answer reaches the page once.
    h.ports[4]?.push({resume: [{requestId: 'R'.repeat(22), result: {accounts: ['A']}}]});
    h.ports[4]?.push({resume: [{requestId: 'R'.repeat(22), result: {accounts: ['A']}}]});
    expect(h.toPage.filter(m => m.id === 'r1')).toEqual([{source: 'noctura-relay', id: 'r1', result: {accounts: ['A']}}]);
  });

  it('pings every 20 s while it awaits a result, and stops when nothing is awaited', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {silent: false});
    h.ports[0]?.push({id: 'r1', accepted: true, requestId: 'S'.repeat(22)});
    vi.advanceTimersByTime(PING_MS * 2);
    expect(h.ports[0]?.sent.filter(m => m.type === 'page.ping')).toHaveLength(2);
    h.ports[0]?.push({requestId: 'S'.repeat(22), error: 'rejected'});
    vi.advanceTimersByTime(PING_MS * 3);
    expect(h.ports[0]?.sent.filter(m => m.type === 'page.ping')).toHaveLength(2);
  });

  it('the protocol copies agree: provider ↔ relay, and the relay ↔ the background’s page partition and port name', () => {
    expect(relayProtocol.METHOD_TYPES).toEqual(providerProtocol.METHOD_TYPES);
    expect([relayProtocol.FROM_PROVIDER, relayProtocol.FROM_RELAY]).toEqual([providerProtocol.FROM_PROVIDER, providerProtocol.FROM_RELAY]);
    expect(relayProtocol.PAGE_PORT).toBe(PAGE_PORT);
    // Plan 1's background serves the three method types it implements plus the relay's own three; B1c-2 adds the rest.
    expect([...PAGE_TYPES].sort()).toEqual(['page.ack', 'page.connect', 'page.disconnect', 'page.ping', 'page.resume', 'page.signMessage']);
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run manifest/__tests__/source.test.mjs scripts/__tests__/check-page-bundles.test.mjs scripts/__tests__/check-permissions.test.mjs scripts/__tests__/check-vault-isolation.test.mjs src/provider/__tests__/provider.test.ts src/relay/__tests__/relay.test.ts
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  6 failed (6) · Tests  3 failed | 451 passed (454). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

The dependencies (exact versions, npm 11.6.2 writes `package-lock.json`; never edit it by hand):

```bash
cd extension
npx -y npm@11.6.2 install --save-exact @wallet-standard/wallet@1.1.1 @wallet-standard/base@1.1.1
npx -y npm@11.6.2 install --save-dev --save-exact @wallet-standard/app@1.1.1
npx -y npm@11.6.2 audit   # the same 4 moderate advisories as main (web3.js → jayson); none from @wallet-standard (R32)
```

Generate `extension/src/provider/icon.ts` (save outside the repository, run from the repository root; `provider.test.ts` checks the data URL decodes to exactly `web/public/noc-mark.png`):

````js
// One-off (B1c-1 Task 7): writes extension/src/provider/icon.ts from web/public/noc-mark.png (the owner's mark, 96 px).
// Run from the repository root. icon.test.ts checks the data URL decodes to exactly that file.
import {readFileSync, writeFileSync} from 'node:fs';

const b64 = readFileSync('web/public/noc-mark.png').toString('base64');
const lines = b64.match(/.{1,100}/g);
writeFileSync(
  'extension/src/provider/icon.ts',
  `/**
 * GENERATED — never edit by hand (B1c-1 Task 7's one-off script): the Noctura mark, web/public/noc-mark.png (the
 * owner's logo, 96 × 96 PNG), as the data URL Wallet Standard requires for a wallet's icon (spec §1.1). No fetch:
 * the provider runs in the page and loads nothing. src/provider/__tests__/icon.test.ts checks it is that file.
 */
export const ICON = \`data:image/png;base64,\${[
${lines.map(l => `  '${l}',`).join('\n')}
].join('')}\` as const;
`,
);
````

```bash
node /path/outside/the/repo/gen-icon.mjs
```

Modify `extension/manifest/source.mjs`:

````diff
diff --git a/extension/manifest/source.mjs b/extension/manifest/source.mjs
--- a/extension/manifest/source.mjs
+++ b/extension/manifest/source.mjs
@@ -13,6 +13,19 @@ export const HOST_PERMISSIONS = [
   {value: 'https://wallet.noc-tura.io/*', reason: 'The passkey relying-party ID: an extension may claim an RP ID only for a host it has permission for.'},
 ];
 
+// B1c §1.7: the two content scripts — the MAIN-world provider and the isolated-world relay — on every page, top frame
+// only, at document_start. No new permission: content scripts declared here need none beyond their match pattern, and
+// windows.create / runtime.connect need none either (no `tabs`, no `webNavigation`). check-permissions.mjs pins both
+// entries independently of this list.
+export const CONTENT_SCRIPTS = {
+  reason:
+    'Sites find the wallet through Wallet Standard, which must be present on every page; the scripts read nothing from the page and send nothing unless the site asks the wallet.',
+  entries: [
+    {matches: ['<all_urls>'], js: ['provider.js'], run_at: 'document_start', all_frames: false, world: 'MAIN'},
+    {matches: ['<all_urls>'], js: ['relay.js'], run_at: 'document_start', all_frames: false, world: 'ISOLATED'},
+  ],
+};
+
 // connect-src is the one runtime backstop for extension/scripts/check-rpc-methods.mjs's text-based
 // checks: even a bypass that check misses cannot reach the network from an extension page or the
 // background, because Chrome/Firefox enforce this at the fetch/XHR/WebSocket layer regardless of
@@ -54,6 +67,7 @@ function base() {
     host_permissions: HOST_PERMISSIONS.map(p => p.value),
     content_security_policy: {extension_pages: EXTENSION_CSP},
     action: {default_popup: 'popup.html', default_title: 'Noctura'},
+    content_scripts: CONTENT_SCRIPTS.entries.map(e => ({...e, matches: [...e.matches], js: [...e.js]})),
   };
 }
 
````

Modify `extension/package.json`:

````diff
diff --git a/extension/package.json b/extension/package.json
--- a/extension/package.json
+++ b/extension/package.json
@@ -11,7 +11,7 @@
     "e2e": "playwright test",
     "csp": "node scripts/check-csp.mjs dist/app",
     "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox",
-    "gates": "node scripts/check-permissions.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs",
+    "gates": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs",
     "reproducible": "node scripts/verify-reproducible.mjs",
     "verify": "rm -rf dist && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
   },
@@ -21,6 +21,8 @@
     "@scure/base": "^2.0.0",
     "@scure/bip39": "^2.0.1",
     "@solana/web3.js": "^1.99.0",
+    "@wallet-standard/base": "1.1.1",
+    "@wallet-standard/wallet": "1.1.1",
     "buffer": "^6.0.3",
     "micro-key-producer": "^0.8.5",
     "qrcode-generator": "2.0.4",
@@ -35,6 +37,7 @@
     "@types/react": "^18.3.31",
     "@types/react-dom": "^18.3.7",
     "@vitejs/plugin-react": "^6.1.1",
+    "@wallet-standard/app": "1.1.1",
     "happy-dom": "^20.14.5",
     "typescript": "^5.5.0",
     "vite": "^8.3.0",
````

Modify `extension/scripts/build.mjs`:

````diff
diff --git a/extension/scripts/build.mjs b/extension/scripts/build.mjs
--- a/extension/scripts/build.mjs
+++ b/extension/scripts/build.mjs
@@ -13,6 +13,10 @@ const outRoot = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'dist');
 const app = join(outRoot, 'app');
 
 execFileSync('npx', ['vite', 'build', '--outDir', app, '--emptyOutDir'], {cwd: ROOT, stdio: 'inherit'});
+// B1c §1.7: the two content scripts, each a classic script, into the same directory (vite.content.config.ts).
+for (const content of ['provider', 'relay']) {
+  execFileSync('npx', ['vite', 'build', '--config', 'vite.content.config.ts', '--outDir', app], {cwd: ROOT, stdio: 'inherit', env: {...process.env, NOCTURA_CONTENT: content}});
+}
 
 for (const browser of ['chrome', 'firefox']) {
   const dir = join(outRoot, browser);
````

Create `extension/scripts/check-page-bundles.mjs`:

````js
#!/usr/bin/env node
// B1c §6.2: the page-bundle gate. The two content scripts run in every web page (manifest/source.mjs CONTENT_SCRIPTS):
// the provider in the page's own world, the relay beside it. What the bundler put into each is read from the module
// maps the content builds write (vite.content.config.ts → dist/app.<name>.modules.json): each may carry only its own
// sources and — the provider only — @wallet-standard/*. Any module of src/background, src/vault, src/unlock, src/app,
// src/approve, core/ or web/ fails, as does any other package. Each is a classic script (a content script cannot be an
// ES module) and is the same file in dist/app, dist/chrome and dist/firefox.
//
// The dev-origin gate (§1.3, §6.2) lives here too: a store build's background.js accepts no http://localhost or
// http://127.0.0.1 page (plan 1 builds no development variant at all — a controller ruling; E2E serves its test dApp
// on https through ctx.route).
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CONTENT = {
  provider: {own: 'src/provider/', packages: ['@wallet-standard/wallet', '@wallet-standard/base']},
  relay: {own: 'src/relay/', packages: []},
};

/** Every module of the named content script's map that it may not carry; INCONCLUSIVE without a map or its entry. */
export function pageBundleViolations(name, modules) {
  const rule = CONTENT[name];
  const file = `${name}.js`;
  const ids = modules?.chunks?.[file];
  if (!Array.isArray(ids)) return [`INCONCLUSIVE: no module map for ${file} (dist/app.${name}.modules.json) — the content build must write one`];
  const out = [];
  if (Object.keys(modules.chunks).length !== 1) out.push(`${file}: the build made more than one chunk (${Object.keys(modules.chunks).join(', ')}) — a content script is one classic script`);
  if (!ids.includes(`${rule.own}index.ts`)) out.push(`INCONCLUSIVE: ${file}'s map does not carry ${rule.own}index.ts — it does not describe the ${name}`);
  for (const id of ids) {
    const path = String(id).replace(/[?#].*$/, '');
    if (path.startsWith(rule.own) && !path.includes('/__tests__/')) continue;
    const pkg = /^node_modules\/((?:@[^/]+\/)?[^/]+)\/(.+)$/.exec(path);
    if (pkg !== null && rule.packages.includes(pkg[1]) && !pkg[2].split('/').includes('node_modules')) continue;
    out.push(`${file} carries ${JSON.stringify(id)} — a content script may carry only ${rule.own} and ${rule.packages.length > 0 ? rule.packages.join(', ') : 'no package'}`);
  }
  return out;
}

/**
 * A content script must be a classic script: no top-level import or export statement. The pattern is textual: a
 * minified `}import(` (a dynamic import) would match too — none is built today; a hit means "look", then fix the
 * bundle or the pattern, never silence the gate (review 1 L10).
 */
export function classicScriptViolations(name, text) {
  if (typeof text !== 'string') return [`${name}.js is missing`];
  return /(^|[;}\n])\s*(import\s*[{*\w"'`]|export\s*[{*\w])/.test(text) ? [`${name}.js is an ES module — a content script must be a classic script`] : [];
}

/** §6.2: the store build's background accepts no development origin. */
export function devOriginViolations(backgroundJs) {
  if (typeof backgroundJs !== 'string' || backgroundJs.length === 0) return ['INCONCLUSIVE: background.js is missing'];
  return ['localhost', '127.0.0.1'].filter(h => backgroundJs.includes(h)).map(h => `background.js names ${h} — a store build accepts no development origin`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : undefined);
  const problems = [];
  for (const name of Object.keys(CONTENT)) {
    const map = read(join(ROOT, 'dist', `app.${name}.modules.json`));
    problems.push(...pageBundleViolations(name, map === undefined ? undefined : JSON.parse(map)));
    const app = read(join(ROOT, 'dist', 'app', `${name}.js`));
    problems.push(...classicScriptViolations(name, app));
    for (const browser of ['chrome', 'firefox']) {
      if (read(join(ROOT, 'dist', browser, `${name}.js`)) !== app) problems.push(`dist/${browser}/${name}.js differs from dist/app/${name}.js`);
    }
  }
  for (const d of ['app', 'chrome', 'firefox']) problems.push(...devOriginViolations(read(join(ROOT, 'dist', d, 'background.js'))).map(p => `dist/${d}: ${p}`));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('page bundles ok: provider.js carries only src/provider and @wallet-standard, relay.js only src/relay; both classic scripts; background.js accepts no development origin');
}
````

Modify `extension/scripts/check-permissions.mjs`:

````diff
diff --git a/extension/scripts/check-permissions.mjs b/extension/scripts/check-permissions.mjs
--- a/extension/scripts/check-permissions.mjs
+++ b/extension/scripts/check-permissions.mjs
@@ -68,6 +68,21 @@ export function cspViolations(csp) {
   return out;
 }
 
+// B1c §1.7, §6.2 (review L4): the two content scripts, pinned here independently of source.mjs — the matches, the
+// world, run_at and all_frames of each, in this order, and nothing else. `<all_urls>` reaches every page, so a widened
+// entry (all frames, a third script, the isolated relay moved into the page's world) is a decision, never an edit.
+export const REQUIRED_CONTENT_SCRIPTS = [
+  {matches: ['<all_urls>'], js: ['provider.js'], run_at: 'document_start', all_frames: false, world: 'MAIN'},
+  {matches: ['<all_urls>'], js: ['relay.js'], run_at: 'document_start', all_frames: false, world: 'ISOLATED'},
+];
+
+/** Every way a manifest's content_scripts differ from REQUIRED_CONTENT_SCRIPTS (key order ignored, nothing extra allowed). */
+export function contentScriptViolations(scripts) {
+  const norm = x => JSON.stringify(x, Object.keys(x ?? {}).sort());
+  if (!Array.isArray(scripts) || scripts.length !== REQUIRED_CONTENT_SCRIPTS.length) return [`content_scripts must be exactly the provider and the relay, got ${JSON.stringify(scripts)}`];
+  return scripts.flatMap((got, i) => (norm(got) === norm(REQUIRED_CONTENT_SCRIPTS[i]) ? [] : [`content_scripts[${i}] is ${JSON.stringify(got)}, want ${JSON.stringify(REQUIRED_CONTENT_SCRIPTS[i])}`]));
+}
+
 export function comparePermissions(manifest, browser) {
   const problems = [];
   const want = PERMISSIONS.map(p => p.value).join(',');
@@ -80,7 +95,7 @@ export function comparePermissions(manifest, browser) {
     problems.push(`CSP differs: ${manifest.content_security_policy?.extension_pages}`);
   }
   problems.push(...cspViolations(manifest.content_security_policy?.extension_pages));
-  if (manifest.content_scripts !== undefined) problems.push('content_scripts present (not before B1c)');
+  problems.push(...contentScriptViolations(manifest.content_scripts));
   if (browser === 'chrome' && manifest.minimum_chrome_version !== MIN_CHROME_VERSION) {
     problems.push(`chrome: minimum_chrome_version differs: ${manifest.minimum_chrome_version}`);
   }
````

Modify `extension/scripts/check-vault-isolation.mjs`:

````diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -84,6 +84,13 @@ const TOUCHES_STORAGE = /(?:\?\.|\.)\s*storage\b|\[\s*['"`]storage['"`]\s*\]|[{,
 // lowercase `onmessage` and `sendMessage` are different identifiers.
 const LISTENS_RUNTIME = /\bon(?:Message|Connect)(?:External)?\b/;
 const LISTEN_ALLOWED = /^src\/background\//;
+// B1c §1.2: the relay holds its own runtime.connect port — a port's listener hears only what is posted on THAT port,
+// never a runtime.sendMessage broadcast (how vault.setKeys travels). So src/relay may name onMessage in exactly two
+// spellings: its PortLike member and the listener on the port it connected (`p.onMessage.addListener(`). Everything
+// else — runtime.onMessage, onConnect, the External variants, any other spelling — stays refused there too.
+const PORT_LISTEN_ALLOWED = /^src\/relay\//;
+const PORT_LISTENER_SPELLINGS = [/^ {2}onMessage: \{addListener\(cb: \(m: unknown\) => void\): void\};$/gm, /\bp\.onMessage\.addListener\(/g];
+const withoutPortListeners = text => PORT_LISTENER_SPELLINGS.reduce((t, re) => t.replace(re, ' '), text);
 // storage.local keys only the background writes (plan B1b-1): no other file may even name them —
 // a popup writing v1_settings could undo a re-authenticated setting without re-authenticating.
 // B1b-2a E4 adds the two caches: a popup writing one could show a balance the chain never had.
@@ -644,7 +651,8 @@ export function sourceViolations(files) {
     if (!LOCAL_READER_ALLOWED.test(path) && values.some(r => namesLocalReader(path, r.spec))) {
       out.push(`${path}: imports ${LOCAL_READER}, the vault page's storage reader`);
     }
-    if (!LISTEN_ALLOWED.test(path) && LISTENS_RUNTIME.test(text)) out.push(`${path}: listens for runtime messages outside the background`);
+    const listenText = PORT_LISTEN_ALLOWED.test(path) ? withoutPortListeners(text) : text;
+    if (!LISTEN_ALLOWED.test(path) && LISTENS_RUNTIME.test(listenText)) out.push(`${path}: listens for runtime messages outside the background`);
     if (UNLOCK_ALLOWED.test(path)) {
       if (SETS_MARKUP.test(text)) out.push(`${path}: writes markup — the vault page sets text only (textContent)`);
       for (const [re, what] of MARKUP_EVASIONS) if (re.test(text)) out.push(`${path}: ${what} — the vault page sets text only (textContent)`);
````

Create `extension/src/provider/bridge.ts`:

````ts
import {ERROR_CODES, FROM_PROVIDER, FROM_RELAY, type ErrorCode, type MethodType} from './protocol';

/**
 * The provider's side of the window channel (spec §1.1): each method posts `{source: 'noctura-provider', id, type,
 * payload}` with targetOrigin = location.origin and awaits the relay's `{source: 'noctura-relay', id, result | error}`;
 * `change` events come the same way. The provider holds no state of its own beyond what the background last sent, no
 * key and no trust: every script on the page has the page's authority over it (§1.1, stated).
 */
export const ERROR_TEXT: Record<ErrorCode, {code: number | ErrorCode; message: string}> = {
  rejected: {code: 4001, message: 'The user rejected the request.'},
  unauthorized: {code: 4100, message: 'The requested account or method has not been authorized by the user.'},
  'request-pending': {code: 'request-pending', message: 'A request from this site is already waiting for the user.'},
  busy: {code: 'busy', message: 'The wallet is busy with other requests. Try again later.'},
  timeout: {code: 'timeout', message: 'The request timed out.'},
  'invalid-request': {code: 'invalid-request', message: 'The request is not valid.'},
};

/** What a page sees for a refusal: a fixed English message and a stable code, never internal text (C10). */
export class NocturaError extends Error {
  readonly code: number | ErrorCode;
  constructor(code: ErrorCode) {
    super(ERROR_TEXT[code].message);
    this.name = 'NocturaError';
    this.code = ERROR_TEXT[code].code;
  }
}

type Waiter = {resolve: (r: Record<string, unknown>) => void; reject: (e: Error) => void};
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export interface Bridge {
  request(type: MethodType, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  onChange(listener: (accounts: string[]) => void): void;
}

export function createBridge(win: Window): Bridge {
  const waiting = new Map<string, Waiter>();
  const listeners = new Set<(accounts: string[]) => void>();
  win.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== win || e.origin !== win.location.origin) return;
    const d: unknown = e.data;
    if (!isObj(d) || d.source !== FROM_RELAY) return;
    if (d.event === 'change' && Array.isArray(d.accounts)) {
      const accounts = (d.accounts as unknown[]).filter((a): a is string => typeof a === 'string');
      for (const l of listeners) l(accounts);
      return;
    }
    if (typeof d.id !== 'string') return;
    const w = waiting.get(d.id);
    if (w === undefined) return;
    waiting.delete(d.id);
    if (typeof d.error === 'string') w.reject(new NocturaError((ERROR_CODES as readonly string[]).includes(d.error) ? (d.error as ErrorCode) : 'invalid-request'));
    else if (isObj(d.result)) w.resolve(d.result);
    else w.reject(new NocturaError('invalid-request'));
  });
  const newId = (): string => Array.from(win.crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  return {
    request(type, payload) {
      const id = newId();
      return new Promise((resolve, reject) => {
        waiting.set(id, {resolve, reject});
        win.postMessage({source: FROM_PROVIDER, id, type, payload}, win.location.origin);
      });
    },
    onChange(listener) {
      listeners.add(listener);
    },
  };
}
````

Create `extension/src/provider/codec.ts`:

````ts
/** Bytes ↔ base64 and base58 → bytes, without a dependency (the provider carries only @wallet-standard, §1.1). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** A Solana address's 32 bytes, or null for anything that is not one. */
export function addressBytes(address: string): Uint8Array | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return null;
  let n = 0n;
  for (const c of address) n = n * 58n + BigInt(ALPHABET.indexOf(c));
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of address) {
    if (c !== '1') break;
    bytes.unshift(0);
  }
  return bytes.length === 32 ? Uint8Array.from(bytes) : null;
}
````

Create `extension/src/provider/index.ts`:

````ts
import {registerWallet} from '@wallet-standard/wallet';
import {createBridge} from './bridge';
import {NocturaWallet} from './wallet';

/**
 * The MAIN-world content script (spec §1.1): registers the one wallet "Noctura" on every page, at document_start, top
 * frame only (the manifest). It reads nothing from the page and sends nothing unless the site asks the wallet.
 */
registerWallet(new NocturaWallet(createBridge(window)));
````

Create `extension/src/provider/protocol.ts`:

````ts
/**
 * The provider ↔ relay window-message protocol (spec §1.1, §1.2). Copied — not imported — in src/relay/protocol.ts:
 * each content-script bundle carries only its own sources (the page-bundle gate); src/relay/__tests__ pins the two
 * copies and the background's page types together.
 */
export const FROM_PROVIDER = 'noctura-provider';
export const FROM_RELAY = 'noctura-relay';
/** The five method types the relay forwards from a page (§1.2). Plan 1 sends three of them. */
export const METHOD_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction'] as const;
export type MethodType = (typeof METHOD_TYPES)[number];
/** The stable codes a page can get (§1.6, C10). */
export const ERROR_CODES = ['rejected', 'unauthorized', 'request-pending', 'busy', 'timeout', 'invalid-request'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
````

Create `extension/src/provider/wallet.ts`:

````ts
import {ReadonlyWalletAccount} from '@wallet-standard/wallet';
import type {IdentifierString, Wallet, WalletAccount} from '@wallet-standard/base';
import {NocturaError, type Bridge} from './bridge';
import {addressBytes, fromBase64, toBase64} from './codec';
import {ICON} from './icon';

/**
 * The one Wallet Standard wallet "Noctura" (spec §1.1, §3; D6). Plan 1 advertises only what it implements —
 * `standard:connect`, `standard:disconnect`, `standard:events` and `solana:signMessage` (header, D10); B1c-2 adds the
 * two transaction features. `solana:mainnet` only. The accounts are the ones the background last sent (Wallet Standard
 * needs them synchronously); the background decides everything.
 */
export const CHAINS = ['solana:mainnet'] as const;
const ACCOUNT_FEATURES = ['solana:signMessage'] as const;

type ChangeListener = (properties: {accounts?: readonly WalletAccount[]}) => void;
interface SignMessageInput {
  account: WalletAccount;
  message: Uint8Array;
}
interface SignMessageOutput {
  signedMessage: Uint8Array;
  signature: Uint8Array;
  signatureType: 'ed25519';
}

export class NocturaWallet implements Wallet {
  readonly version = '1.0.0' as const;
  readonly name = 'Noctura';
  readonly icon = ICON;
  readonly chains: IdentifierString[] = [...CHAINS];
  #accounts: ReadonlyWalletAccount[] = [];
  readonly #listeners = new Set<ChangeListener>();
  readonly #bridge: Bridge;

  constructor(bridge: Bridge) {
    this.#bridge = bridge;
    bridge.onChange(accounts => this.#set(accounts));
  }

  get accounts(): readonly WalletAccount[] {
    return this.#accounts.slice();
  }

  get features() {
    return {
      'standard:connect': {version: '1.0.0' as const, connect: this.#connect},
      'standard:disconnect': {version: '1.0.0' as const, disconnect: this.#disconnect},
      'standard:events': {version: '1.0.0' as const, on: this.#on},
      'solana:signMessage': {version: '1.1.0' as const, signMessage: this.#signMessage},
    };
  }

  /** The accounts the background sent; a change (and only a change) is announced. */
  #set(addresses: readonly string[]): void {
    const next: ReadonlyWalletAccount[] = [];
    for (const address of addresses) {
      const publicKey = addressBytes(address);
      if (publicKey !== null) next.push(new ReadonlyWalletAccount({address, publicKey, chains: [...CHAINS], features: [...ACCOUNT_FEATURES]}));
    }
    if (next.length === this.#accounts.length && next.every((a, i) => a.address === this.#accounts[i]?.address)) return;
    this.#accounts = next;
    for (const l of this.#listeners) l({accounts: this.accounts});
  }

  #connect = async (input?: {silent?: boolean}): Promise<{accounts: readonly WalletAccount[]}> => {
    const r = await this.#bridge.request('page.connect', {silent: input?.silent === true});
    const accounts = Array.isArray(r.accounts) ? (r.accounts as unknown[]).filter((a): a is string => typeof a === 'string') : [];
    this.#set(accounts);
    return {accounts: this.accounts};
  };

  #disconnect = async (): Promise<void> => {
    await this.#bridge.request('page.disconnect', {});
    this.#set([]);
  };

  #on = (event: string, listener: ChangeListener): (() => void) => {
    if (event !== 'change') return () => undefined;
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #signMessage = async (...inputs: SignMessageInput[]): Promise<SignMessageOutput[]> => {
    const out: SignMessageOutput[] = [];
    for (const input of inputs) {
      if (!this.#accounts.some(a => a.address === input.account.address)) throw new NocturaError('unauthorized');
      const r = await this.#bridge.request('page.signMessage', {account: input.account.address, message: toBase64(input.message)});
      if (typeof r.signature !== 'string' || typeof r.signedMessage !== 'string') throw new NocturaError('invalid-request');
      out.push({signedMessage: fromBase64(r.signedMessage), signature: fromBase64(r.signature), signatureType: 'ed25519'});
    }
    return out;
  };
}
````

Create `extension/src/relay/index.ts`:

````ts
import {startRelay, type PortLike} from './relay';

/** The isolated-world content script (spec §1.2): top frame only, at document_start (the manifest). */
interface RuntimeLike {
  runtime: {connect(o: {name: string}): PortLike};
}
const g = globalThis as unknown as {browser?: RuntimeLike; chrome?: RuntimeLike};
const api = (g.browser ?? g.chrome) as RuntimeLike;

startRelay({
  win: window,
  doc: document,
  connect: name => api.runtime.connect({name}),
  setTimeout: (f, ms) => window.setTimeout(f, ms),
  setInterval: (f, ms) => window.setInterval(f, ms),
  clearInterval: id => window.clearInterval(id as number),
});
````

Create `extension/src/relay/protocol.ts`:

````ts
/**
 * The provider ↔ relay window-message protocol and the relay ↔ background port (spec §1.2, §1.4). Copied — not
 * imported — from src/provider/protocol.ts: each content-script bundle carries only its own sources (the page-bundle
 * gate); src/relay/__tests__/relay.test.ts pins the two copies and the background's page types together.
 */
export const FROM_PROVIDER = 'noctura-provider';
export const FROM_RELAY = 'noctura-relay';
export const PAGE_PORT = 'noctura-page';
/** The five method types the relay forwards from a page — and only these (§1.2). */
export const METHOD_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction'] as const;
````

Create `extension/src/relay/relay.ts`:

````ts
import {FROM_PROVIDER, FROM_RELAY, METHOD_TYPES, PAGE_PORT} from './protocol';

/**
 * The relay (spec §1.2; review 1 H1, L7, review 2 M1, M5, M8; C9, C16): the isolated-world content script between the
 * page and the background. It decides nothing and adds nothing but the request id it received:
 *  - it accepts a window message only from this window (`event.source === window`), with `source: 'noctura-provider'`
 *    and one of the five method types; it originates `page.resume`, `page.ack` and `page.ping` itself — the same
 *    types from the page are dropped;
 *  - it opens its port lazily, on the document's first request — never at load, never while `document.prerendering`
 *    (it waits for `prerenderingchange`) — and, once the document has asked, keeps one: on `onDisconnect` it reconnects
 *    (0.5 s, 1 s, 2 s, then on `visibilitychange`), re-sends what was not yet accepted (the same id: the same request)
 *    and sends `page.resume` for every request it still awaits;
 *  - while it awaits a result it sends `page.ping` every 20 s (Chrome: a port message keeps the worker alive);
 *  - it posts answers and `change` events to the page (targetOrigin = location.origin) and acks each answer.
 */
export const BACKOFF_MS = [500, 1000, 2000];
export const PING_MS = 20_000;
const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** The background answers at most 16 ids per resume. */
const RESUME_BATCH = 16;

export interface PortLike {
  postMessage(m: unknown): void;
  disconnect(): void;
  onMessage: {addListener(cb: (m: unknown) => void): void};
  onDisconnect: {addListener(cb: () => void): void};
}

export interface RelayEnv {
  win: Window;
  doc: Document;
  connect(name: string): PortLike;
  setTimeout(f: () => void, ms: number): unknown;
  setInterval(f: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function startRelay(env: RelayEnv): void {
  const {win, doc} = env;
  let port: PortLike | null = null;
  let asked = false;
  let failures = 0;
  let pinger: unknown = null;
  /** Requests sent but not yet accepted (or answered at once), by the page's id: re-sent after a reconnect. */
  const unaccepted = new Map<string, Record<string, unknown>>();
  /** Accepted requests whose answer has not come: requestId → the page's id. */
  const awaited = new Map<string, string>();

  const toPage = (m: Record<string, unknown>) => win.postMessage({source: FROM_RELAY, ...m}, win.location.origin);
  const send = (m: Record<string, unknown>) => {
    try {
      port?.postMessage(m);
    } catch {
      // The port died: onDisconnect reconnects.
    }
  };

  const keepAlive = () => {
    const busy = unaccepted.size + awaited.size > 0;
    if (busy && pinger === null) pinger = env.setInterval(() => send({type: 'page.ping'}), PING_MS);
    if (!busy && pinger !== null) {
      env.clearInterval(pinger);
      pinger = null;
    }
  };

  const answer = (pageId: string, m: Record<string, unknown>) => {
    unaccepted.delete(pageId);
    if ('error' in m) toPage({id: pageId, error: m.error});
    else toPage({id: pageId, result: m.result});
  };

  const onPortMessage = (m: unknown) => {
    if (!isObj(m)) return;
    // The background answered: this connection works, the backoff starts over.
    failures = 0;
    if (m.event === 'change' && Array.isArray(m.accounts)) {
      toPage({event: 'change', accounts: m.accounts});
      return;
    }
    if (Array.isArray(m.resume)) {
      for (const r of m.resume as unknown[]) if (isObj(r)) onPortMessage(r.unknown === true ? {requestId: r.requestId, error: 'timeout'} : r.pending === true ? null : r);
      return;
    }
    if (typeof m.id === 'string') {
      if (m.accepted === true && typeof m.requestId === 'string') {
        unaccepted.delete(m.id);
        awaited.set(m.requestId, m.id);
      } else if ('result' in m || 'error' in m) {
        answer(m.id, m);
      }
      keepAlive();
      return;
    }
    if (typeof m.requestId === 'string' && ('result' in m || 'error' in m)) {
      const pageId = awaited.get(m.requestId);
      if (pageId === undefined) return;
      awaited.delete(m.requestId);
      answer(pageId, m);
      send({type: 'page.ack', requestId: m.requestId});
      keepAlive();
    }
  };

  const open = () => {
    if (port !== null) return;
    // Document.prerendering (Chrome 108+; absent elsewhere, where a page is never prerendered).
    if ((doc as Document & {prerendering?: boolean}).prerendering === true) return;
    const p = env.connect(PAGE_PORT);
    port = p;
    p.onMessage.addListener(onPortMessage);
    p.onDisconnect.addListener(() => {
      if (port !== p) return;
      port = null;
      const delay = BACKOFF_MS[failures];
      failures += 1;
      if (delay !== undefined) env.setTimeout(reopen, delay);
    });
    for (const m of unaccepted.values()) send(m);
    const ids = [...awaited.keys()];
    for (let i = 0; i < ids.length; i += RESUME_BATCH) send({type: 'page.resume', requestIds: ids.slice(i, i + RESUME_BATCH)});
  };
  const reopen = () => {
    if (port === null && asked) open();
  };

  win.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== win) return;
    const d: unknown = e.data;
    if (!isObj(d) || d.source !== FROM_PROVIDER || typeof d.type !== 'string' || typeof d.id !== 'string' || !PAGE_ID.test(d.id)) return;
    if (!(METHOD_TYPES as readonly string[]).includes(d.type)) return;
    const payload = isObj(d.payload) ? d.payload : {};
    const m = {...payload, type: d.type, id: d.id};
    asked = true;
    unaccepted.set(d.id, m);
    keepAlive();
    if (port === null) open();
    else send(m);
  });
  // §1.2: never before the page is shown.
  doc.addEventListener('prerenderingchange', () => {
    if (asked) open();
  });
  // After the backoff: the next time the page is looked at.
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') {
      failures = 0;
      reopen();
    }
  });
}
````

Create `extension/vite.content.config.ts`:

````ts
import {defineConfig, type Plugin} from 'vite';
import {writeFileSync} from 'node:fs';
import {relative, resolve, sep} from 'node:path';

/**
 * B1c §1.7: the two content scripts, built one at a time as classic scripts (an IIFE — a content script cannot be an
 * ES module) into the main build's output directory: `NOCTURA_CONTENT=provider` → provider.js (MAIN world),
 * `NOCTURA_CONTENT=relay` → relay.js (isolated world). Each build writes what it carries next to the output
 * (`dist/app.<name>.modules.json`), for the page-bundle gate (scripts/check-page-bundles.mjs): a content script runs in
 * every page, so it may carry only its own sources and @wallet-standard.
 */
const NAME = process.env.NOCTURA_CONTENT;
if (NAME !== 'provider' && NAME !== 'relay') throw new Error('NOCTURA_CONTENT must be provider or relay');

const moduleId = (id: string) => (id.startsWith('\0') ? id : relative(__dirname, id).split(sep).join('/'));
function contentModules(name: string): Plugin {
  const chunks = new Map<string, string[]>();
  return {
    name: 'noctura:content-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) if (file.type === 'chunk') chunks.set(file.fileName, file.moduleIds.map(moduleId).sort());
    },
    writeBundle(options) {
      if (options.dir === undefined) return;
      writeFileSync(`${options.dir}.${name}.modules.json`, `${JSON.stringify({chunks: Object.fromEntries([...chunks].sort(([a], [b]) => a.localeCompare(b)))}, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [contentModules(NAME)],
  build: {
    outDir: 'dist/app',
    emptyOutDir: false,
    target: 'es2022',
    modulePreload: false,
    copyPublicDir: false,
    lib: {entry: resolve(__dirname, `src/${NAME}/index.ts`), formats: ['iife'], name: `noctura_${NAME}`, fileName: () => `${NAME}.js`},
  },
});
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run manifest/__tests__/source.test.mjs scripts/__tests__/check-page-bundles.test.mjs scripts/__tests__/check-permissions.test.mjs scripts/__tests__/check-vault-isolation.test.mjs src/provider/__tests__/provider.test.ts src/relay/__tests__/relay.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  6 passed (6) · Tests  478 passed (478); tsc clean; whole suite Test Files  149 passed (149) · Tests  2985 passed (2985); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M7a** — the relay forwards page.ack from the page (review 2 M1) — `extension/src/relay/protocol.ts`:

  ```diff
  - 'page.signAndSendTransaction'] as const;
  + 'page.signAndSendTransaction', 'page.ack'] as const;
  ```
  `timeout 300 npx vitest run src/relay` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 7 passed (9)).

- **M7b** — the relay opens its port at load (review 2 M8) — `extension/src/relay/relay.ts`:

  ```diff
  -   win.addEventListener('message', (e: MessageEvent) => {
  -     if (e.source !== win) return;
  +   open();
  +   win.addEventListener('message', (e: MessageEvent) => {
  +     if (e.source !== win) return;
  ```
  `timeout 300 npx vitest run src/relay` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 7 passed (9)).

- **M7c** — the relay connects while prerendering (C16) — `extension/src/relay/relay.ts`:

  ```diff
  -     if ((doc as Document & {prerendering?: boolean}).prerendering === true) return;
  ```
  `timeout 300 npx vitest run src/relay` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 8 passed (9)).

- **M7d** — no page.resume after a reconnect (review 1 H1) — `extension/src/relay/relay.ts`:

  ```diff
  -     for (let i = 0; i < ids.length; i += RESUME_BATCH) send({type: 'page.resume', requestIds: ids.slice(i, i + RESUME_BATCH)});
  +     void [ids, RESUME_BATCH];
  ```
  `timeout 300 npx vitest run src/relay` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 8 passed (9)).

- **M7e** — no page.ack for an answer — `extension/src/relay/relay.ts`:

  ```diff
  -       send({type: 'page.ack', requestId: m.requestId});
  ```
  `timeout 300 npx vitest run src/relay` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 8 passed (9)).

- **M7f** — the provider accepts a message from another window — `extension/src/provider/bridge.ts`:

  ```diff
  -     if (e.source !== win || e.origin !== win.location.origin) return;
  +     if (e.origin !== win.location.origin) return;
  ```
  `timeout 300 npx vitest run src/provider` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 8 passed (9)).

- **M7g** — the provider advertises a transaction feature (D10) — `extension/src/provider/wallet.ts`:

  ```diff
  -       'solana:signMessage': {version: '1.1.0' as const, signMessage: this.#signMessage},
  +       'solana:signMessage': {version: '1.1.0' as const, signMessage: this.#signMessage},
  +       'solana:signTransaction': {version: '1.0.0' as const, signTransaction: this.#signMessage},
  ```
  `timeout 300 npx vitest run src/provider` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 8 passed (9)).

- **M7h** — the permissions pin compares only the script names — `extension/scripts/check-permissions.mjs`:

  ```diff
  -   return scripts.flatMap((got, i) => (norm(got) === norm(REQUIRED_CONTENT_SCRIPTS[i]) ? [] :
  +   return scripts.flatMap((got, i) => (norm(got.js) === norm(REQUIRED_CONTENT_SCRIPTS[i].js) ? [] :
  ```
  `timeout 300 npx vitest run scripts/__tests__/check-permissions.test.mjs` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 28 passed (29)).

- **M7i** — the page-bundle gate allows any src/ module — `extension/scripts/check-page-bundles.mjs`:

  ```diff
  -     if (path.startsWith(rule.own) && !path.includes('/__tests__/')) continue;
  +     if (path.startsWith('src/')) continue;
  ```
  `timeout 300 npx vitest run scripts/__tests__/check-page-bundles.test.mjs` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 5 passed (6)).

- **M7j** — the relay's listener allowance widened to any onMessage — `extension/scripts/check-vault-isolation.mjs`:

  ```diff
  - const PORT_LISTENER_SPELLINGS = [/^ {2}onMessage: \{addListener\(cb: \(m: unknown\) => void\): void\};$/gm, /\bp\.onMessage\.addListener\(/g];
  + const PORT_LISTENER_SPELLINGS = [/\bonMessage\b/g];
  ```
  `timeout 300 npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 416 passed (417)).

- **M7k** — the dev-origin gate lets localhost through — `extension/scripts/check-page-bundles.mjs`:

  ```diff
  -   return ['localhost', '127.0.0.1'].filter(
  +   return ['127.0.0.1'].filter(
  ```
  `timeout 300 npx vitest run scripts/__tests__/check-page-bundles.test.mjs` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 5 passed (6)).

- [ ] **Step 6: Commit.**

```bash
git add extension/manifest/__tests__/source.test.mjs extension/manifest/source.mjs extension/package-lock.json extension/package.json extension/scripts/__tests__/check-page-bundles.test.mjs extension/scripts/__tests__/check-permissions.test.mjs extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/build.mjs extension/scripts/check-page-bundles.mjs extension/scripts/check-permissions.mjs extension/scripts/check-vault-isolation.mjs extension/src/provider/__tests__/provider.test.ts extension/src/provider/bridge.ts extension/src/provider/codec.ts extension/src/provider/icon.ts extension/src/provider/index.ts extension/src/provider/protocol.ts extension/src/provider/wallet.ts extension/src/relay/__tests__/relay.test.ts extension/src/relay/index.ts extension/src/relay/protocol.ts extension/src/relay/relay.ts extension/vite.content.config.ts
git commit -F - <<'MSG'
feat(extension): B1c provider + relay content scripts, <all_urls> manifest, page-bundle and dev-origin gates

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 8: The approval window (`approve.html`): the client, polling, the locked screen (D11), the in-progress state, Q12 / Q24 / Q17, C15 — and #47 in every state (47a, 47b, the lookalike with its 2-second confirm, the cap); the design's #46–#49 classes extracted; the gates know `src/approve`

**Spec:** §3.1 (all), §4.3 (all), §2.3 (polling), §1.7 (the entry, the isolation fixtures), C5, C12, C13, C15, D11, review 1 M12, review 2 M3, L8; §6.1 "Screens" (#47, C15, the locked window); §6.2 vault-isolation (`src/approve`); Review Focus 2; Scope R14–R18, R28, R33–R35; plan review 1 L1, L4, L5; Scope R33, R35

**Files:**
- Create: `extension/approve.html`
- Test: `extension/scripts/__tests__/check-classes.test.mjs`
- Test: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Modify: `extension/scripts/check-classes.mjs`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Test: `extension/src/__tests__/designExt2b.test.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/ui/Sheet.tsx`
- Create: `extension/src/approve/Approve.tsx`
- Create: `extension/src/approve/Connect.tsx`
- Create: `extension/src/approve/Locked.tsx`
- Test: `extension/src/approve/__tests__/connect.test.tsx` (new)
- Test: `extension/src/approve/__tests__/locked.test.tsx` (new)
- Test: `extension/src/approve/__tests__/windowHarness.tsx` (new)
- Create: `extension/src/approve/client.ts`
- Create: `extension/src/approve/main.tsx`
- Create: `extension/src/approve/strings.ts`
- Create: `extension/src/approve/ui.tsx`
- Create: `extension/src/approve/useArmed.ts`
- Modify: `extension/src/styles/design-ext.css` (generated — Step 3)
- Modify: `extension/vite.config.ts`

**Interfaces:**
- Consumes: Task 4's `dapp.pending` / `dapp.decide` (over `runtime.sendMessage`, `src/ui/send.ts`); `LockedButton`, `Sheet`, `ExtIcon`, `shortAddress` from `src/app`; the design-ext extraction script of B1b-2b plan 2 Task 5.
- Produces (as exported):
  - `approve.html` → `src/approve/main.tsx`.
  - `src/approve/client.ts`: the view types (`Site`, `IdnDetail`, `AccountChoice`, `ConnectDetail`, `SignDetail`, `RequestView`, `PendingView`, `Decision`, `DecideReply`), `pendingOf(x)`, `type Transport`, `interface ApproveClient {pending(); decide(requestId, d)}`, `createClient(transport?)`.
  - `src/approve/useArmed.ts`: `ARM_MS = 500`, `useArmed(state, ms?)`.
  - `src/approve/ui.tsx`: `WindowTop`, `OriginCard`, `LookalikeBanner`, `ConfirmButton`, `CONFIRM_DELAY_MS = 2_000`, `RiskConfirm`, `BudgetNotice`, `Waiting`, `BlockSite`, `Spinner`.
  - `src/approve/strings.ts`: `WINDOW_TEXT`, `CONNECT_TEXT`.
  - `src/approve/ui.tsx`: `siteLabel(origin, host)` (rev 2); `src/app/ui/Sheet.tsx`: `focusControl?: boolean` (default true).
  - `src/approve/Locked.tsx`: `Locked`; `src/approve/Connect.tsx`: `Connect`; `src/approve/Approve.tsx`: `POLL_MS = 1_000`, `Approve({client, close})`.
  - `windowHarness.tsx` (tests): `SECOND`, `ENV`, `openWindow(o?)` → `{ext, deps, client, closed, sent, connect, show, unlock}`.

`approve.html` is the popup's React shell on the popup's three sheets (design-system, design-ext, app.css); it holds no state and no listener and touches no storage (the vault-isolation gate's general rules now cover `src/approve`, and `ENTRIES` binds the page to its entry). It asks `dapp.pending` on mount, on `focus` and `visibilitychange`, after each decision, and every second while it shows anything (§2.3; review 1 L1, R33 — so an expiry reaches it too) — only the newest answer counts, nothing is set after unmount, `none` closes the window. Locked (D11): the lock tile, the wordmark, Q22, Q23, the request's origin card and [Reject] — no input of any kind, no link. #47: 47a (one gate, both scopes, the account picker, Q02 / Q03), 47b (two gates in order — R14 —, "Until I revoke" disabled with the design's warning, Q19, Q18 for an `xn--` host), the lookalike (the flipped bar, Q05 or rule a's sentence, the 2-second confirm, then 47b's gates — R15) and the cap (R16). The origin card shows the host, with the port when the origin has one (review 1 L5, R35). Connect is `.btn-secondary` with `aria-disabled` until every gate clears — a tap shakes the unmet gate and shows the hint — then `.btn-primary`; C15: no CTA focused at open, the confirming CTAs held 500 ms after focus and after each state change (the request, both acks, the scope, the account, the confirm), Enter's default prevented on them, Reject never held; the 2-second confirm opens with the focus on its panel, no control (B1b's `Sheet` gains `focusControl`), and "I understand the risk" is held again whenever the window regains focus (review 1 L4). The design's #46/#47/#49 classes are extracted into `design-ext.css` (generated, re-pinned); `app.css` turns the mockups' inline styles into classes.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-classes.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-classes.test.mjs b/extension/scripts/__tests__/check-classes.test.mjs
--- a/extension/scripts/__tests__/check-classes.test.mjs
+++ b/extension/scripts/__tests__/check-classes.test.mjs
@@ -56,12 +56,13 @@ describe('the class gate: the app', () => {
     expect(classViolations(files, new Set(['banner', 'info', 'warning']))).toEqual(['src/app/ui/Banner.tsx: class "danger" (a value of ${tone}) is defined in no stylesheet']);
   });
 
-  it('reads every .tsx under src/app/ except the tests', () => {
+  it('reads every .tsx under src/app/ and src/approve/ (B1c: the approval window loads the same sheets) except the tests', () => {
     const files = listScreens(ROOT);
     expect(files).toContain('src/app/screens/Activity.tsx');
     expect(files).toContain('src/app/ui/Sheet.tsx');
+    expect(files).toContain('src/approve/Connect.tsx');
     expect(files.some(f => f.includes('__tests__'))).toBe(false);
-    expect(files.every(f => f.startsWith('src/app/') && f.endsWith('.tsx'))).toBe(true);
+    expect(files.every(f => (f.startsWith('src/app/') || f.startsWith('src/approve/')) && f.endsWith('.tsx'))).toBe(true);
   });
 
   it('the real app: every class it names is defined by design-system.css, design-ext.css or app.css', () => {
````

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -3,6 +3,7 @@ import {tmpdir} from 'node:os';
 import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {
+  ENTRIES,
   bundleViolations, htmlViolations, listSourceFiles, manifestViolations, nonVaultModuleViolations, bundledWebAuthnViolations, sourceViolations, vaultPageModuleViolations, vaultPageViolations, webAuthnViolations,
   BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, REACT_MARKER, VAULT_MARKER, WEBAUTHN_MARKER, WORDLIST_MARKER,
 } from '../check-vault-isolation.mjs';
@@ -398,6 +399,18 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
     expect(sourceViolations([f('src/app/screens/Contacts.tsx', "const k = 'v1_contacts';")])).toEqual([OWNED('src/app/screens/Contacts.tsx', 'v1_contacts')]);
     expect(sourceViolations([f('src/unlock/main.ts', '// v1_contacts')])).toEqual([OWNED('src/unlock/main.ts', 'v1_contacts')]);
   });
+  // B1c §1.7 (review L13): src/approve is held like src/app — no storage, no runtime listener, no ext.ts — and its page
+  // may load only its own entry.
+  it('holds src/approve like src/app: no storage, no runtime listener, no ext.ts; approve.html loads only src/approve/main.tsx', () => {
+    expect(ENTRIES['approve.html']).toBe('src/approve/main.tsx');
+    expect(sourceViolations([f('src/approve/Approve.tsx', 'chrome.storage.local.get("x");')])).toEqual(['src/approve/Approve.tsx: touches storage outside src/ext.ts and the background']);
+    expect(sourceViolations([f('src/approve/Approve.tsx', 'chrome.runtime.onMessage.addListener(x);')])).toEqual(['src/approve/Approve.tsx: listens for runtime messages outside the background']);
+    expect(sourceViolations([f('src/approve/Approve.tsx', "import {browserExt} from '../ext';")])).toEqual(['src/approve/Approve.tsx: imports src/ext.ts (storage.session) outside the background']);
+    expect(sourceViolations([f('src/approve/Approve.tsx', "import {send} from '../ui/send';")])).toEqual([]);
+    expect(htmlViolations([{path: 'approve.html', text: '<script type="module" src="./src/approve/main.tsx"></script>'}])).toEqual([]);
+    expect(htmlViolations([{path: 'approve.html', text: '<script type="module" src="./src/app/popup.tsx"></script>'}])).toEqual(['approve.html: loads ./src/app/popup.tsx — only src/approve/main.tsx may be its entry']);
+  });
+
   // B1c §1.2: the relay may listen on the port it connected — and in no other way; nobody else may.
   it('lets the relay listen on its own port only: p.onMessage and its PortLike member; runtime.onMessage and onConnect stay refused', () => {
     const LISTENS = path => `${path}: listens for runtime messages outside the background`;
````

Modify `extension/src/__tests__/designExt2b.test.ts`:

````diff
diff --git a/extension/src/__tests__/designExt2b.test.ts b/extension/src/__tests__/designExt2b.test.ts
--- a/extension/src/__tests__/designExt2b.test.ts
+++ b/extension/src/__tests__/designExt2b.test.ts
@@ -21,7 +21,14 @@ describe('design-ext.css (B1b-2b plan 1)', () => {
     }
   });
 
+  // B1c plan 1 re-ran the extraction with #46's, #47's and #49's classes added (ix:3786-3950, 4067-4084), and re-pins the hash.
+  it('carries #46’s, #47’s and #49’s classes (B1c plan 1)', () => {
+    for (const sel of ['.s9-origin-card .badge.verified', '.s9-msg-preview mark', '.s9-domain-warn .body code', '.s9-struct-alert .head', '.s9-perm-row .badge', '.s9-scope-row.sel .radio::after', '.s9-flag-banner .ack.is-acked .box', '.s9-ack-row.is-acked .lbl', '.s9-gate-status.is-ready .dot', '.s10-app-row .verified-dot', '.s10-undo-toast .undo-btn', '.s10-sheet .head-row .name', '.s10-skel-row .ico', '.s10-empty .ill']) {
+      expect(CSS).toContain(`${sel} `);
+    }
+  });
+
   it('is the extraction output, byte for byte (the hash the plan pins)', () => {
-    expect(createHash('sha256').update(CSS).digest('hex')).toBe('3092abb5608035c82f58c9097cdd23bc8b49f8d77f12c1622d8a304414caa4d7');
+    expect(createHash('sha256').update(CSS).digest('hex')).toBe('b01d1aa0273497f2510a43e614f700baad277384cb6d3b65f554fdfed3070b11');
   });
 });
````

Create `extension/src/approve/__tests__/connect.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {GRANTS_KEY, MAX_GRANTS, type Grant} from '../../background/dapp/grants';
import {BLOCKED_KEY} from '../../background/dapp/blocked';
import {LIMITS_KEY} from '../../background/dapp/limits';
import {readDappSession} from '../../background/dapp/store';
import {REQUEST_TTL_MS} from '../../background/dapp/queue';
import {SETTINGS_KEY} from '../../background/settings';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {ARM_MS} from '../useArmed';
import {CONFIRM_DELAY_MS} from '../ui';
import {pendingOf} from '../client';
import {SECOND, openWindow} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const cta = (name: string | RegExp) => screen.getByRole('button', {name});
const armedAfter = () => new Promise(r => setTimeout(r, ARM_MS + 50));
afterEach(() => cleanup());

// Spec §3.1 (#47, index.html ix:17686-18261), §4.3 and C12, C15 — the approval window against the real background.
describe('#47 47a — a verified origin', () => {
  it('47a-initial: every drawn string, the account picker (Q01, the active account chosen), Connect locked as .btn-secondary', async () => {
    const w = await openWindow();
    await w.ext.local.set(SETTINGS_KEY, {selectedAccount: 1});
    await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Connect to Jupiter?');
    expect(text('.top-bar .title')).toBe('Connection request');
    expect(document.querySelector('.top-bar .title')?.className).toBe('title noc-overline app-dim');
    expect(screen.getByText('Connecting lets the dApp see your public address. It does not move funds. Every transaction will still ask for your approval.')).toBeTruthy();
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['Jupiter', 'jup.ag', 'Verified']);
    expect(text('.s9-origin-card .ico')).toBe('J');
    const perms = document.querySelector('.s9-perm-card') as HTMLElement;
    expect(within(perms).getByText('Jupiter will be able to')).toBeTruthy();
    expect([...perms.querySelectorAll('.s9-perm-row')].map(r => [r.querySelector('.pri')?.textContent, r.querySelector('.sec')?.textContent, r.querySelector('.badge')?.textContent])).toEqual([
      ['See your public address', `${SECOND.publicKey.slice(0, 4)}…${SECOND.publicKey.slice(-4)} — never your seed or private key`, 'AUTOMATIC'],
      ['Request transaction signatures', 'You will approve each transaction individually', 'WITH PROMPT'],
      ['Request message signatures', 'You will approve each signature individually', 'WITH PROMPT'],
    ]);
    const ack = screen.getByRole('checkbox', {name: /I've read these permissions/});
    expect(ack.textContent).toBe("I've read these permissionsTap to acknowledge · gates the Connect button");
    const picker = screen.getByRole('combobox') as HTMLSelectElement;
    expect([...picker.options].map(o => o.textContent)).toEqual([`Main · ${ACCOUNT.publicKey.slice(0, 4)}…${ACCOUNT.publicKey.slice(-4)}`, `Savings · ${SECOND.publicKey.slice(0, 4)}…${SECOND.publicKey.slice(-4)}`]);
    expect(picker.value).toBe('1');
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Stay connected')).toBeTruthy();
    const [session, persistent] = screen.getAllByRole('radio');
    expect([session?.textContent, session?.getAttribute('aria-checked'), persistent?.textContent, persistent?.getAttribute('aria-checked')]).toEqual([
      'For this session onlyDisconnects when the wallet locks or the browser closes',
      'true',
      'Until I revokeSaved in Settings → Connected dApps · revoke any time',
      'false',
    ]);
    expect(text('.s9-gate-status')).toBe('0 of 1 acknowledgments');
    const connect = cta('Connect');
    expect([connect.className, connect.getAttribute('aria-disabled'), connect.getAttribute('title')]).toEqual(['btn btn-secondary app-cta-wide', 'true', 'Read the permissions above before connecting']);
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('a tap on the locked Connect does nothing, shakes the unmet gate and says why', async () => {
    const w = await openWindow();
    const {requestId} = await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Connect to Jupiter?');
    fireEvent.click(cta('Connect'));
    expect(screen.getByText('Read the permissions above before connecting')).toBeTruthy();
    expect(screen.getByRole('checkbox').className).toBe('s9-ack-row app-shake');
    fireEvent.click(cta('Connect'));
    expect(screen.getByRole('checkbox').className).toBe('s9-ack-row app-shake-again');
    expect((await readDappSession(w.ext)).queue.find(e => e.requestId === requestId)?.state).toBe('queued');
    expect(w.sent.filter(m => (m as {type: string}).type === 'dapp.decide')).toEqual([]);
  });

  it('47a-acknowledged: "Permissions acknowledged", "Ready to connect", Connect promoted — held 500 ms (C15), then a session grant; the window closes', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Connect to Jupiter?');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox').textContent).toBe('Permissions acknowledgedConnect is now enabled');
    expect(document.querySelector('.s9-gate-status')?.className).toBe('s9-gate-status is-ready');
    expect(text('.s9-gate-status')).toBe('Ready to connect');
    const connect = cta('Connect');
    expect([connect.className, (connect as HTMLButtonElement).disabled]).toEqual(['btn btn-primary app-cta-wide', true]);
    await armedAfter();
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(cta('Connect'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
    expect((await readDappSession(w.ext)).grants.map(g => [g.origin, g.scope])).toEqual([['https://jup.ag', 'session']]);
  });

  it('"Until I revoke" and another account: a persistent grant for that account', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Connect to Jupiter?');
    fireEvent.change(screen.getByRole('combobox'), {target: {value: '1'}});
    expect(document.querySelector('.s9-perm-row .sec')?.textContent).toBe(`${SECOND.publicKey.slice(0, 4)}…${SECOND.publicKey.slice(-4)} — never your seed or private key`);
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.click(screen.getByRole('checkbox'));
    await armedAfter();
    fireEvent.click(cta('Connect'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[]).map(g => [g.origin, g.account, g.scope])).toEqual([['https://jup.ag', SECOND.publicKey, 'persistent']]);
  });
});

describe('#47 47b — an unknown origin: two gates, in order; session only (C12)', () => {
  it('47b-initial → domain-acked → fully-acked, every string; Connect for this session; a session grant', async () => {
    const w = await openWindow();
    await w.connect('https://solana-mint-hub.xyz');
    w.show();
    await screen.findByText('Connect to this app?');
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Unknown origin', 'title noc-overline noc-warning']);
    expect(screen.getByText("We don't recognize this domain. That doesn't always mean it's bad — but proceed with care.")).toBeTruthy();
    expect([text('.s9-origin-card .ico'), text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['?', 'solana-mint-hub', 'solana-mint-hub.xyz', 'Unknown']);
    expect(text('.s9-flag-banner.warn .head')).toBe("This domain isn't on the verified list");
    expect(document.querySelector('.s9-flag-banner.warn .body')).toBeNull();
    const [domain, perms] = screen.getAllByRole('checkbox');
    expect(domain?.textContent).toBe('I understand this domain is not on the verified list');
    expect(perms?.textContent).toBe("I've read these permissionsTap to acknowledge · second gate for unknown domain");
    expect(text('.s9-perm-card .noc-overline')).toBe('If you connect, the dApp can');
    expect(document.querySelectorAll('.s9-perm-row')).toHaveLength(3);
    expect(document.querySelector('.s9-perm-row .sec')?.textContent).toBe(`${SECOND.publicKey.slice(0, 4)}…${SECOND.publicKey.slice(-4)} · cannot see your seed or private key`.replace(SECOND.publicKey.slice(0, 4), ACCOUNT.publicKey.slice(0, 4)).replace(SECOND.publicKey.slice(-4), ACCOUNT.publicKey.slice(-4)));
    expect([text('.s9-scope-card .noc-overline'), document.querySelector('.s9-scope-card .noc-overline')?.className]).toEqual(['Recommended for unknown', 'noc-overline noc-warning app-card-overline']);
    const [session, persistent] = screen.getAllByRole('radio') as HTMLButtonElement[];
    expect(session?.textContent).toBe('For this session onlyConnection ends when the wallet locks · safest option for unknown domains');
    expect([persistent?.textContent, persistent?.disabled, persistent?.className]).toEqual(['Until I revokeDiscouraged for unknown domains — re-grant per session instead', true, 's9-scope-row app-scope-off']);
    expect(text('.s9-gate-status')).toBe('0 of 2 acknowledgments');
    expect(cta('Connect for this session').getAttribute('title')).toBe('Acknowledge both gates to connect');
    // The permissions ack is the second gate: tapped first, it shakes the domain ack and stays unticked.
    fireEvent.click(perms!);
    expect([perms?.getAttribute('aria-checked'), domain?.className]).toEqual(['false', 'ack app-shake']);
    fireEvent.click(domain!);
    expect(screen.getAllByRole('checkbox')[0]?.textContent).toBe('Acknowledged — new domain');
    expect(screen.getAllByRole('checkbox')[1]?.textContent).toBe("I've read these permissionsFinal gate — tap to enable Connect");
    expect([text('.s9-gate-status'), document.querySelector('.s9-gate-status')?.className]).toEqual(['1 of 2 acknowledgments', 's9-gate-status app-gate-partial']);
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    expect(screen.getAllByRole('checkbox')[1]?.textContent).toBe('Permissions acknowledgedConnect is now enabled · session-only scope');
    expect(text('.app-approve-lede')).toBe('Both gates cleared. Connect is enabled for this session only — the persisted-scope path stays locked out for unknown domains.');
    expect(document.querySelector('.app-approve-lede i')?.textContent).toBe('for this session only');
    expect(text('.s9-gate-status')).toBe('Ready to connect · for this session');
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    await armedAfter();
    fireEvent.click(cta('Connect for this session'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect((await readDappSession(w.ext)).grants.map(g => [g.origin, g.scope])).toEqual([['https://solana-mint-hub.xyz', 'session']]);
  });

  it('an unknown xn-- host gets Q18', async () => {
    const w = await openWindow();
    await w.connect('https://xn--bcher-kva.example');
    w.show();
    expect(await screen.findByText('This address uses international characters: xn--bcher-kva.example')).toBeTruthy();
  });
});

describe('#47 lookalike — the flipped bar, the 2-second confirm, 47b’s gates under the lookalike chrome', () => {
  it('rules b–d: "Suspicious origin", the host’s own label (never the brand), Q05; Reject and report blocks it', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://tensr.trade');
    w.show();
    await screen.findByText('Connect to this app?');
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Suspicious origin', 'title noc-overline noc-danger']);
    expect(text('.app-approve-lede')).toBe('Connecting lets the dApp see your public address.');
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['tensr', 'tensr.trade', 'Lookalike']);
    expect(document.body.textContent).not.toContain('Tensor');
    expect(text('.s9-domain-warn .body')).toBe('This domain is not tensor.tradeIt looks like tensor.trade but is a different site.');
    expect(document.querySelector('.s9-ack-row')).toBeNull();
    const report = cta('Reject and report');
    expect(report.className).toBe('btn btn-primary app-btn-danger');
    expect(cta('Connect anyway (not recommended)').className).toBe('btn btn-tertiary noc-body-sm app-dim');
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    fireEvent.click(report);
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(await w.ext.local.get(BLOCKED_KEY)).toEqual([{host: 'tensr.trade', blockedAt: w.deps.clock.t, imitates: 'tensor.trade'}]);
  });

  it('rule a: the IDN sentence names the character, its script and code point, the Latin one and the Punycode form', async () => {
    const w = await openWindow();
    await w.connect('https://xn--phntom-4nf.app');
    w.show();
    await screen.findByText('Connect to this app?');
    expect(text('.s9-domain-warn .body')).toBe('This domain is not phantom.appThe "\u0430" in this URL is a Cyrillic letter (U+0430), not a Latin "a" (U+0061). The Punycode form is xn--phntom-4nf.app.');
    expect([...document.querySelectorAll('.s9-domain-warn code')].map(c => c.textContent)).toEqual(['\u0430', 'xn--phntom-4nf.app']);
    expect(text('.s9-origin-card .name')).toBe('xn--phntom-4nf');
  });

  it('Connect anyway → the confirm (I understand the risk held 2 s; Cancel goes back) → 47b’s two gates, session only', async () => {
    const w = await openWindow();
    await w.connect('https://tensr.trade');
    w.show();
    await screen.findByText('Connect to this app?');
    await armedAfter();
    fireEvent.click(cta('Connect anyway (not recommended)'));
    const sheet = await screen.findByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'});
    expect((within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(sheet).getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await armedAfter();
    fireEvent.click(cta('Connect anyway (not recommended)'));
    const again = await screen.findByRole('dialog');
    await new Promise(r => setTimeout(r, CONFIRM_DELAY_MS + 50));
    fireEvent.click(within(again).getByRole('button', {name: 'I understand the risk'}));
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    expect(text('.top-bar .title')).toBe('Suspicious origin');
    expect(document.querySelector('.s9-domain-warn')).not.toBeNull();
    expect(text('.s9-flag-banner.warn .head')).toBe("This domain isn't on the verified list");
    expect((screen.getAllByRole('radio')[1] as HTMLButtonElement).disabled).toBe(true);
    expect(cta('Connect for this session')).toBeTruthy();
  });
});

describe('#47 — the cap, the cooldown offer, the window chrome (§2.1, C14, Q12, Q16, Q17, Q24)', () => {
  it('cap: 200 persistent grants — Q16 and only [Reject]', async () => {
    const w = await openWindow();
    await w.ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => ({origin: `https://s${i}.test`, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []})));
    await w.connect('https://jup.ag');
    w.show();
    expect(await screen.findByText('You have 200 connected apps. Revoke one in Settings first.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: /Connect/})).toBeNull();
    expect(document.querySelectorAll('.sticky-bar button')).toHaveLength(1);
    expect(cta('Reject')).toBeTruthy();
  });

  it('the third request from a host offers [Block this site] (Q17)', async () => {
    const w = await openWindow();
    await w.ext.local.set(LIMITS_KEY, {rejections: [{key: 'host:dapp.test', at: w.deps.clock.t}, {key: 'host:dapp.test', at: w.deps.clock.t}], cooldowns: [], windows: [], notice: false});
    await w.connect('https://dapp.test');
    w.show();
    fireEvent.click(await screen.findByRole('button', {name: 'Block this site'}));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(((await w.ext.local.get(BLOCKED_KEY)) as {host: string}[]).map(b => b.host)).toEqual(['dapp.test']);
  });

  it('"1 more request waiting" / "2 more requests waiting" (Q12); the budget notice once (Q24)', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    await w.connect('https://a.test');
    await w.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: [], notice: true});
    w.show();
    expect(await screen.findByText('1 more request waiting')).toBeTruthy();
    expect(screen.getByText('Too many requests from sites in the last few minutes — some were declined without asking you.')).toBeTruthy();
    await w.connect('https://b.test');
    expect(await screen.findByText('2 more requests waiting', {}, {timeout: 2500})).toBeTruthy();
    expect(screen.queryByText(/Too many requests/)).toBeNull();
  });

  // Review Focus 2: the popup revokes (or the page disconnects) while the window shows that origin's request.
  it('a request answered elsewhere while shown (the page disconnected): Connect is refused as not-head, the window moves on and closes', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Connect to Jupiter?');
    await page.ask({type: 'page.disconnect', id: 'd1'});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    fireEvent.click(screen.getByRole('checkbox'));
    await armedAfter();
    fireEvent.click(cta('Connect'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect((await readDappSession(w.ext)).grants).toEqual([]);
  });

  it('✕ is Reject; closing on the last request closes the window; the next head follows a decision', async () => {
    const w = await openWindow();
    const first = await w.connect('https://jup.ag');
    const second = await w.connect('https://a.test');
    w.show();
    await screen.findByText('Connect to Jupiter?');
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    await screen.findByText('Connect to this app?');
    expect(first.page.answersFor(first.requestId)).toEqual([{requestId: first.requestId, error: 'rejected'}]);
    fireEvent.click(cta('Reject'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(second.page.answersFor(second.requestId)).toEqual([{requestId: second.requestId, error: 'rejected'}]);
  });
});

describe('C15 — no CTA focused, held 500 ms after focus and each state change, Enter never confirms; Reject never held', () => {
  it('at mount nothing is focused; Reject is enabled at once; Connect waits 500 ms after the ack, and again after the window regains focus', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Connect to Jupiter?');
    expect(document.activeElement).toBe(document.body);
    expect((cta('Reject') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(true);
    await armedAfter();
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(false);
    act(() => void window.dispatchEvent(new Event('focus')));
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(true);
    await armedAfter();
    // A scope change is a state change too.
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(true);
    await armedAfter();
    // Enter on the focused Connect: its default action (the click) is prevented.
    cta('Connect').focus();
    expect(fireEvent.keyDown(cta('Connect'), {key: 'Enter'})).toBe(false);
    expect(fireEvent.keyDown(cta('Reject'), {key: 'Enter'})).toBe(true);
  });
});

describe('review 1: the confirm sheet (L4), the port on the card (L5), an expiry on screen (L1)', () => {
  it('the 2-second confirm opens with no control focused, and "I understand the risk" is held again after the window regains focus', async () => {
    const w = await openWindow();
    await w.connect('https://tensr.trade');
    w.show();
    await screen.findByText('Connect to this app?');
    await armedAfter();
    fireEvent.click(cta('Connect anyway (not recommended)'));
    const sheet = await screen.findByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'});
    expect(document.activeElement).toBe(sheet);
    await new Promise(r => setTimeout(r, CONFIRM_DELAY_MS + 50));
    const understand = () => within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement;
    expect(understand().disabled).toBe(false);
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(understand().disabled).toBe(true);
    await armedAfter();
    expect(understand().disabled).toBe(false);
  });

  it('an origin with an explicit port shows host:port on the card; one without shows the host', async () => {
    const w = await openWindow();
    await w.connect('https://dapp.test:8443');
    w.show();
    await screen.findByText('Connect to this app?');
    expect(text('.s9-origin-card .dom')).toBe('dapp.test:8443');
    cleanup();
    const v = await openWindow();
    await v.connect('https://dapp.test');
    v.show();
    await screen.findByText('Connect to this app?');
    expect(text('.s9-origin-card .dom')).toBe('dapp.test');
  });

  it('a single shown request that expires: the window learns it within two seconds and closes (nothing else waiting)', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Connect to Jupiter?');
    w.deps.clock.t += REQUEST_TTL_MS;
    await waitFor(() => expect(w.closed.n).toBe(1), {timeout: 2_000});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'timeout'}]);
  });
});

describe('the in-progress state and the client’s shape check', () => {
  it('a deciding head: "Connecting…" with the ring, every CTA and ✕ disabled, the origin card at .55', async () => {
    const w = await openWindow();
    const {requestId} = await w.connect('https://jup.ag');
    const s = await readDappSession(w.ext);
    const {DAPP_SESSION_KEY} = await import('../../background/dapp/store');
    const {runtimeFor} = await import('../../background/dapp/ports');
    await w.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.requestId === requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(w.ext).instance, decidingAt: w.deps.clock.t} : e))});
    w.show();
    const busy = await screen.findByRole('button', {name: 'Connecting…'});
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(busy.querySelector('.app-ring-spinner')).not.toBeNull();
    expect((cta('Reject') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Close'}) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.app-origin-slot')?.className).toBe('app-origin-slot app-busy-dim');
  });

  it('pendingOf: a reply of any other shape is null (the window asks again)', () => {
    expect(pendingOf({state: 'none'})).toEqual({state: 'none'});
    expect(pendingOf({state: 'request', waiting: 0, windowNotice: false, request: {requestId: 'x'}})).toBeNull();
    expect(pendingOf({state: 'weird'})).toBeNull();
    expect(pendingOf(null)).toBeNull();
  });
});
````

Create `extension/src/approve/__tests__/locked.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {openWindow} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
/** §2.3's second, and the two E2E B1c-19 allows — a literal: a deadline derived from POLL_MS would widen with a slower poll. */
const WITHIN_MS = 2_000;
afterEach(() => cleanup());

// Spec §4.3 and D11 (review M2): no password field in a window a site triggered; the request waits in the queue and the
// window switches to it when the unlock lands (it polls every second — E2E 19 allows two).
describe('the locked window (D11)', () => {
  it('Noctura mark, Q22, Q23, the request’s origin card and [Reject] — no input of any kind, no link', async () => {
    const w = await openWindow({unlocked: false});
    await w.connect('https://dapp.test');
    w.show();
    expect(await screen.findByText('Noctura is locked')).toBeTruthy();
    expect(screen.getByText("Click the Noctura icon in your browser's toolbar and unlock. This request will wait here.")).toBeTruthy();
    expect(document.querySelector('.s7-wordmark')?.textContent).toBe('noctura.');
    expect(document.querySelector('.s9-origin-card .dom')?.textContent).toBe('dapp.test');
    expect(document.querySelectorAll('input, select, textarea, a')).toHaveLength(0);
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['Reject']);
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('the unlock lands: within a poll the window shows #47 for the request', async () => {
    const w = await openWindow({unlocked: false});
    await w.connect('https://dapp.test');
    w.show();
    await screen.findByText('Noctura is locked');
    expect(await w.unlock()).toEqual({ok: true});
    expect(await screen.findByText('Connect to this app?', {}, {timeout: WITHIN_MS})).toBeTruthy();
  });

  it('a persistent grant: the unlock answers the request itself, and the window closes', async () => {
    const w = await openWindow({unlocked: false});
    await w.ext.local.set(GRANTS_KEY, [{origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const {page, requestId} = await w.connect('https://jup.ag');
    w.show();
    await screen.findByText('Noctura is locked');
    await w.unlock();
    await waitFor(() => expect(w.closed.n).toBe(1), {timeout: WITHIN_MS});
    expect(page.answersFor(requestId)).toEqual([{requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
  });

  it('[Reject] while locked rejects the request', async () => {
    const w = await openWindow({unlocked: false});
    const {page, requestId} = await w.connect('https://dapp.test');
    w.show();
    fireEvent.click(await screen.findByRole('button', {name: 'Reject'}));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });
});
````

Create `extension/src/approve/__tests__/windowHarness.tsx`:

````tsx
import {render} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {Approve} from '../Approve';
import {createClient, type ApproveClient} from '../client';
import {handleMessage} from '../../background/messages';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {runUnlockHook} from '../../background/dapp/queue';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {openPage, type Page} from '../../background/dapp/__tests__/pageHarness';

/** A second real keypair (32 × 0x02): vault.setKeys checks every key. */
const SEED2 = new Uint8Array(32).fill(2);
const PUB2 = ed25519.getPublicKey(SEED2);
export const SECOND = {index: 1, publicKey: base58.encode(PUB2), secretKey: base64.encode(new Uint8Array([...SEED2, ...PUB2]))};
export const ENV = {
  v: 1,
  scheme: 'slip10',
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: SECOND.publicKey},
  ],
};

/**
 * The approval window against the REAL background (handleMessage with approve.html as the sender, the fake chrome.*),
 * and pages that ask it through the real page partition (pageHarness). `closed` counts window.close().
 */
export async function openWindow(o: {unlocked?: boolean} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, ENV);
  if (o.unlocked !== false) {
    await setSession(ext, [ACCOUNT, SECOND]);
    await runUnlockHook(ext, deps);
  }
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const sent: unknown[] = [];
  const client: ApproveClient = createClient(m => {
    sent.push(m);
    return handleMessage(ext, m, approve, deps);
  });
  const closed = {n: 0};
  let tab = 10;
  /** A page on its own tab that asks to connect; the request's id and the page. */
  const connect = async (origin: string): Promise<{page: Page; requestId: string}> => {
    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
    const r = await page.ask({type: 'page.connect', id: `c${tab}`, silent: false});
    return {page, requestId: String(r?.requestId)};
  };
  const show = () =>
    render(
      <div className="app app-window">
        <Approve client={client} close={() => void (closed.n += 1)} />
      </div>,
    );
  return {ext, deps, client, closed, sent, connect, show, unlock: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, {...approve, url: `${ext.extensionOrigin}/unlock.html`}, deps)};
}
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run scripts/__tests__/check-classes.test.mjs scripts/__tests__/check-vault-isolation.test.mjs src/__tests__/designExt2b.test.ts src/approve/__tests__/connect.test.tsx src/approve/__tests__/locked.test.tsx
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  5 failed (5) · Tests  4 failed | 428 passed (432). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Regenerate `extension/src/styles/design-ext.css` — never edit it by hand. Save this one-off script **outside the repository** (B1b-2b plan 2 Task 5's extraction script with one line of prefixes added — the line marked "B1c plan 1") and run it from the repository root. Before adding the line, the script must reproduce the current file (`sha256sum extension/src/styles/design-ext.css` = `3092abb5608035c82f58c9097cdd23bc8b49f8d77f12c1622d8a304414caa4d7`); a different hash means `/home/user/Downloads/index.html` changed — stop and ask the controller. With the line, the output is 1 895 lines, 124 more, and its hash is `b01d1aa0273497f2510a43e614f700baad277384cb6d3b65f554fdfed3070b11` (pinned by `designExt2b.test.ts`, re-pinned in this task). The resulting diff is in the blocks below, for review.

````js
// One-off (B1c plan 1: B1b-2b plan 2's script with the B1c prefixes added): copy the design classes web/'s design-system.css lacks out of the owner's design file,
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
  // B1b-2b plan 2: #15 address book (ix:1412-1490). The contact sheet is #43's .s8-sheet, already extracted.
  '.s-abook',
  // B1c plan 1: #46 and #47 (ix:3786-3830, 3847-3855, 4067-4084) and #49 (ix:3882-3950).
  '.s9-origin-card', '.s9-msg-card', '.s9-msg-preview', '.s9-disclaimer', '.s9-domain-warn', '.s9-struct-alert', '.s9-perm-card', '.s9-perm-row',
  '.s9-scope-card', '.s9-scope-row', '.s9-flag-banner', '.s9-ack-row', '.s9-gate-status', '.s10-',
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
node /path/outside/the/repo/extract-design-css-b1c.mjs
sha256sum extension/src/styles/design-ext.css   # b01d1aa0…3070b11
```

Create `extension/approve.html`:

````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Noctura</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/approve/main.tsx"></script>
  </body>
</html>
````

Modify `extension/scripts/check-classes.mjs`:

````diff
diff --git a/extension/scripts/check-classes.mjs b/extension/scripts/check-classes.mjs
--- a/extension/scripts/check-classes.mjs
+++ b/extension/scripts/check-classes.mjs
@@ -152,11 +152,13 @@ function walk(root, dir, out) {
   }
 }
 
-/** Every .tsx under src/app/ except the tests, relative to the package. */
+/** Every .tsx under src/app/ and src/approve/ (B1c: the approval window loads the same three sheets) except the tests. */
 export function listScreens(root = ROOT) {
   const out = [];
-  const dir = join(root, 'src', 'app');
-  if (existsSync(dir)) walk(root, dir, out);
+  for (const d of ['app', 'approve']) {
+    const dir = join(root, 'src', d);
+    if (existsSync(dir)) walk(root, dir, out);
+  }
   return out.sort();
 }
 
@@ -275,5 +277,5 @@ if (import.meta.url === `file://${process.argv[1]}`) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log(`classes ok: every class in ${files.length} src/app files is defined by ${SHEETS.join(', ')}; every class in ${vaultFiles.length} vault-page files by ${VAULT_SHEETS.join(', ')}`);
+  console.log(`classes ok: every class in ${files.length} src/app and src/approve files is defined by ${SHEETS.join(', ')}; every class in ${vaultFiles.length} vault-page files by ${VAULT_SHEETS.join(', ')}`);
 }
````

Modify `extension/scripts/check-vault-isolation.mjs`:

````diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -44,7 +44,7 @@ const VAULT_ALLOWED = /^src\/(unlock|vault)\//;
 // they are vault code too, and only the vault page itself may import them.
 const UNLOCK_ALLOWED = /^src\/unlock\//;
 // The one entry each HTML page at the package root may load.
-export const ENTRIES = {'popup.html': 'src/app/popup.tsx', 'wallet.html': 'src/app/tab.tsx', 'unlock.html': 'src/unlock/main.ts'};
+export const ENTRIES = {'popup.html': 'src/app/popup.tsx', 'wallet.html': 'src/app/tab.tsx', 'unlock.html': 'src/unlock/main.ts', 'approve.html': 'src/approve/main.tsx'};
 // node_modules/, dist/, e2e/ and scripts/ are skipped only at the package ROOT — a nested
 // src/popup/scripts/ is ordinary source a page can bundle, not this package's own tooling.
 // __tests__/ is skipped at any depth (never bundled, wherever it sits). See the header.
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1418,3 +1418,216 @@ a.btn {
   font: inherit;
   cursor: pointer;
 }
+
+/* B1c plan 1: the approval window (approve.html, spec §4.3) — #46 and #47's inline styles as classes. */
+/* The window is 412 × 720 outside (§2.3); the app fills what is inside it, never a horizontal scroll. */
+html:has(.app-window),
+body:has(.app-window) {
+  height: 100%;
+  overflow: hidden;
+}
+.app.app-window {
+  width: 100%;
+  height: 100vh;
+}
+.app-approve {
+  min-height: 0;
+}
+/* The body scrolls, the sticky bar stays (§9: the design frame is 916 px high, the window 720). */
+.app-approve-scroll {
+  flex: 1 1 auto;
+  min-height: 0;
+  overflow-y: auto;
+  padding-top: var(--space-2);
+  padding-bottom: var(--space-4);
+  display: flex;
+  flex-direction: column;
+}
+.app-approve-title {
+  margin: 0 0 var(--space-2);
+}
+.app-approve-lede {
+  margin: 0 0 var(--space-5);
+}
+/* The origin card: --space-3 above a banner, --space-4 above the cards (ix:17716, 17803). */
+.app-origin-slot {
+  margin-bottom: var(--space-3);
+}
+.app-origin-slot:has(+ .s9-perm-card),
+.app-origin-slot:has(+ .s9-msg-card) {
+  margin-bottom: var(--space-4);
+}
+.app-approve-scroll > .s9-flag-banner,
+.app-approve-scroll > .s9-domain-warn,
+.app-approve-scroll > .s9-struct-alert,
+.app-approve-scroll > .s9-perm-card,
+.app-approve-scroll > .s9-msg-card,
+.app-approve-notice {
+  margin-bottom: var(--space-4);
+}
+.app-card-overline {
+  margin-bottom: 4px;
+}
+/* The origin card's border by tier (47b: --warning 32 %; lookalike: --danger 40 %, ix:17507) and its initials tile (C6). */
+.s9-origin-card.app-origin-unknown {
+  border: 1px solid color-mix(in oklab, var(--warning) 32%, transparent);
+}
+.s9-origin-card.app-origin-lookalike {
+  border: 1px solid color-mix(in oklab, var(--danger) 40%, transparent);
+}
+.s9-origin-card .ico.app-ico-verified {
+  background: linear-gradient(135deg, var(--accent), var(--accent-shielded));
+}
+.s9-origin-card .ico.app-ico-unknown {
+  background: var(--bg-surface-3);
+  color: var(--fg-secondary);
+}
+.s9-origin-card .ico.app-ico-lookalike {
+  background: color-mix(in oklab, var(--danger) 24%, var(--bg-surface-3));
+  color: var(--danger);
+}
+.app-origin-text {
+  min-width: 0;
+}
+/* The in-progress state (#46 ix:17617-17640): the origin card at .55, the message at .7. */
+.app-busy-dim {
+  opacity: 0.55;
+}
+.app-busy-dim-msg {
+  opacity: 0.7;
+}
+/* The design's rows and toggles are buttons here: the UA's button look reset, the design's own borders kept. */
+.app-approve button.s9-ack-row {
+  width: 100%;
+  font: inherit;
+  color: inherit;
+  text-align: start;
+  background: transparent;
+  border: 0;
+  border-top: 1px solid var(--border);
+}
+.app-approve button.s9-scope-row {
+  width: 100%;
+  font: inherit;
+  color: inherit;
+  text-align: start;
+  background: transparent;
+  border: 0;
+}
+.app-approve .s9-flag-banner button.ack {
+  font: inherit;
+  color: inherit;
+  text-align: start;
+  border: 0;
+}
+.s9-scope-row .pri,
+.s9-scope-row .sec {
+  display: block;
+}
+/* 47b: "Until I revoke" at .55 and refused (ix:17907). */
+.app-approve button.s9-scope-row.app-scope-off {
+  opacity: 0.55;
+  cursor: not-allowed;
+}
+/* 47b's "1 of 2 acknowledgments": the amber dot (ix:18252). */
+.s9-gate-status.app-gate-partial .dot {
+  background: var(--warning);
+}
+/* A tap on the locked Connect shakes the unmet gate (#47 E); two names, so a second tap shakes again. */
+.app-shake {
+  animation: shake 320ms cubic-bezier(0.2, 0, 0, 1);
+}
+.app-shake-again {
+  animation: app-shake-again 320ms cubic-bezier(0.2, 0, 0, 1);
+}
+@keyframes app-shake-again {
+  0%,
+  100% {
+    transform: translateX(0);
+  }
+  20% {
+    transform: translateX(-6px);
+  }
+  40% {
+    transform: translateX(6px);
+  }
+  60% {
+    transform: translateX(-4px);
+  }
+  80% {
+    transform: translateX(4px);
+  }
+}
+@media (prefers-reduced-motion: reduce) {
+  .app-shake,
+  .app-shake-again,
+  .app-ring-spinner {
+    animation: none;
+  }
+}
+/* C15: the confirming CTA's Enter guard wraps it without a box of its own. */
+.app-confirm-wrap {
+  display: contents;
+}
+/* "Reject and report" / "I understand the risk": --danger, as #46's lookalike draws its primary (ix:17543). */
+.btn.app-btn-danger {
+  background: var(--danger);
+  color: var(--danger-on);
+}
+/* The sticky bar's 1 : 1.4 (ix:17554). */
+.sticky-bar.row .btn.app-cta-wide {
+  flex: 1.4;
+}
+.app-approve-hint,
+.app-approve-waiting {
+  margin: 0;
+  padding: 0 var(--space-4) var(--space-2);
+  text-align: center;
+}
+.app-approve-block {
+  display: flex;
+  justify-content: center;
+  padding: 0 var(--space-5) var(--space-2);
+}
+/* #46's ring spinner (ix:17635), as a class. */
+.app-ring-spinner {
+  display: inline-block;
+  width: 18px;
+  height: 18px;
+  border-radius: 50%;
+  border: 2.5px solid color-mix(in oklab, var(--bg-base) 30%, transparent);
+  border-top-color: var(--bg-base);
+  animation: spin var(--dur-spin) linear infinite;
+}
+/* Q01: the account picker, a card like the scope card, above "Stay connected". */
+.app-approve-account {
+  display: flex;
+  flex-direction: column;
+  gap: 4px;
+  padding: var(--space-4);
+  margin-bottom: var(--space-3);
+  background: var(--bg-surface-1);
+  border-radius: var(--radius-lg);
+}
+.app-approve-account select {
+  min-height: var(--touch-target-min);
+  padding: 0 var(--space-3);
+  font: inherit;
+  color: var(--fg-primary);
+  background: var(--bg-surface-3);
+  border: 0;
+  border-radius: var(--radius-md);
+}
+/* The 2-second confirm's two actions, inside the sheet. */
+.sticky-bar.app-risk-actions {
+  border-top: 0;
+  padding: var(--space-4) 0 0;
+}
+/* D11's locked window: the mark, the two lines and the origin card, centred. */
+.app-approve-locked .app-approve-scroll {
+  justify-content: center;
+}
+.app-approve-locked .app-origin-slot {
+  width: 100%;
+  margin-top: var(--space-4);
+}
````

Modify `extension/src/app/ui/Sheet.tsx`:

````diff
diff --git a/extension/src/app/ui/Sheet.tsx b/extension/src/app/ui/Sheet.tsx
--- a/extension/src/app/ui/Sheet.tsx
+++ b/extension/src/app/ui/Sheet.tsx
@@ -6,7 +6,8 @@ import {ExtIcon} from './ExtIcon';
  * close button. Esc, the backdrop and the grabber close it; Tab stays inside it while it is open
  * (focus trap), and focus returns to where it was when it closes. It opens with the focus on the
  * element marked `data-autofocus` when its content has one (B1b-2b's contact sheet: the name field) —
- * React's own autoFocus would run before this effect and be overridden — else on its first control.
+ * React's own autoFocus would run before this effect and be overridden — else on its first control; `focusControl`
+ * false (the approval window's 2-second confirm, C15: no control focused when it opens) puts it on the panel itself.
  * `tall`: the panel may take the popup's height but 48 px (the contact sheet: a full address, its warnings, a field and
  * three buttons do not fit the design's 70 % at 412 × 600, and a scrolled panel hid the address it saves).
  *
@@ -15,14 +16,17 @@ import {ExtIcon} from './ExtIcon';
  * clock (#20 every second) — an effect keyed on `onClose` re-ran each time, pulled the focus back to `data-autofocus` and
  * so typed the rest of a name into #15's address field.
  */
-export function Sheet({title, onClose, children, tall = false}: {title: string; onClose: () => void; children: ReactNode; tall?: boolean}) {
+export function Sheet({title, onClose, children, tall = false, focusControl = true}: {title: string; onClose: () => void; children: ReactNode; tall?: boolean; focusControl?: boolean}) {
   const panel = useRef<HTMLDivElement>(null);
   const close = useRef(onClose);
   close.current = onClose;
+  // Read once, on mount, like everything the effect below uses.
+  const focusFirst = useRef(focusControl);
   useEffect(() => {
     const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
     const focusables = (): HTMLElement[] => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]') ?? []);
-    (panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
+    if (focusFirst.current) (panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
+    else panel.current?.focus();
     const onKey = (e: KeyboardEvent) => {
       if (e.key === 'Escape') {
         e.preventDefault();
````

Create `extension/src/approve/Approve.tsx`:

````tsx
import {useCallback, useEffect, useRef, useState} from 'react';
import type {ApproveClient, Decision, PendingView} from './client';
import {Connect} from './Connect';
import {Locked} from './Locked';

/** §2.3 (review 2 M3, review 1 L1): the window polls this often while it shows anything — so an unlock, an expiry or a new head reaches it. */
export const POLL_MS = 1_000;

/**
 * approve.html's one component (spec §2.3, §4.3; C5, C13, D11). The window holds no state and no listener: it asks
 * `dapp.pending` on mount, on focus and visibilitychange, after each decision, and every POLL_MS while it shows a
 * request (review 1 L1, R33: one read a second, and the window exists only while something is pending) — so an unlock,
 * an expiry or a new head reaches it within a second. `none` closes the window. A decision runs through `dapp.decide`; the background validates it as if this page
 * were untrusted (C13), and the window then asks again. Only the newest answer counts (a slower, older one sets
 * nothing), and nothing is set after the window unmounts.
 */
export function Approve({client, close}: {client: ApproveClient; close: () => void}) {
  const [view, setView] = useState<PendingView | null>(null);
  const [busy, setBusy] = useState(false);
  const reads = useRef(0);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const n = ++reads.current;
    const v = await client.pending();
    if (!alive.current || n !== reads.current || v === null) return;
    if (v.state === 'none') {
      close();
      return;
    }
    setView(v);
  }, [client, close]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const again = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      alive.current = false;
      window.removeEventListener('focus', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, [refresh]);

  const polling = view !== null && view.state !== 'none';
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [polling, refresh]);

  const request = view !== null && view.state !== 'none' ? view.request : null;
  const decide = useCallback(
    async (d: Decision) => {
      if (request === null) return;
      setBusy(d.decision === 'approve');
      try {
        await client.decide(request.requestId, d);
      } finally {
        if (alive.current) setBusy(false);
        await refresh();
      }
    },
    [client, request, refresh],
  );

  if (view === null || view.state === 'none' || request === null) return <div className="screen app-approve" aria-busy="true" />;
  if (view.state === 'locked') return <Locked request={request} waiting={view.waiting} onReject={() => decide({decision: 'reject'})} />;
  const inProgress = busy || view.state === 'deciding';
  // A new head is a new screen: its gates, scope and account start over (keyed by request).
  return <Connect key={request.requestId} request={request} waiting={view.waiting} notice={view.windowNotice} busy={inProgress} onDecide={decide} />;
}
````

Create `extension/src/approve/Connect.tsx`:

````tsx
import {useState} from 'react';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import {shortAddress} from '../app/format';
import type {Decision, RequestView} from './client';
import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop} from './ui';
import {useArmed} from './useArmed';
import {CONNECT_TEXT, WINDOW_TEXT} from './strings';

/**
 * #47 dapp-connect (spec §3.1; index.html ix:17686-18261), every state the spec builds:
 *  - 47a verified: one gate (the permissions ack), "Stay connected" with both scopes;
 *  - 47b unknown: two gates in order — the domain ack in the banner, then the permissions ack — and "Until I revoke"
 *    disabled (C12; the background refuses it too); Q18 for an `xn--` host;
 *  - lookalike: "Suspicious origin", the lookalike banner, the sticky bar flipped — [Reject and report] primary,
 *    "Connect anyway (not recommended)" tertiary → the 2-second confirm → 47b's two gates under the lookalike chrome;
 *  - cap (Q16): only [Reject];
 *  - in progress: "Connecting…", every CTA and ✕ disabled.
 * Connect is `.btn-secondary` (aria-disabled) until every gate clears, then `.btn-primary`; a tap on the locked one
 * shakes the unmet gate and says why. C15 holds the confirming CTAs; Reject is never held. The account picker (Q01)
 * offers the wallet's unlocked accounts, the active one chosen (C1: only a default).
 */
export function Connect({
  request,
  waiting,
  notice,
  busy,
  onDecide,
}: {
  request: RequestView;
  waiting: number;
  notice: boolean;
  busy: boolean;
  onDecide: (d: Decision) => Promise<unknown>;
}) {
  const detail = request.connect;
  const kind = request.site.kind;
  const [scope, setScope] = useState<'session' | 'persistent'>('session');
  const [account, setAccount] = useState<number>(detail?.selected ?? 0);
  const [permsAck, setPermsAck] = useState(false);
  const [domainAck, setDomainAck] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** A lookalike's "Connect anyway" passed the 2-second confirm: 47b's gates under the lookalike chrome. */
  const [anyway, setAnyway] = useState(false);
  const [hint, setHint] = useState(false);
  /** Which gate shakes, and a counter so a second tap shakes again. */
  const [shake, setShake] = useState<{gate: 'perms' | 'domain'; n: number} | null>(null);
  const armed = useArmed([request.requestId, permsAck, domainAck, scope, account, confirming, anyway].join('|'));

  const chosen = detail?.accounts.find(a => a.index === account) ?? detail?.accounts[0];
  const verified = kind === 'verified';
  /** 47b's gates: an unknown origin, or a lookalike past the confirm. */
  const twoGates = kind === 'unknown' || (kind === 'lookalike' && anyway);
  const preConfirm = kind === 'lookalike' && !anyway;
  const cap = detail?.cap === true;
  const gatesOk = permsAck && (!twoGates || domainAck);
  const disabled = busy;
  const reject = () => onDecide({decision: 'reject'});
  const report = () => onDecide({decision: 'report'});
  const connect = async () => {
    if (chosen === undefined) return;
    await onDecide({decision: 'approve', account: chosen.publicKey, scope: twoGates ? 'session' : scope});
  };
  const lockedTap = () => {
    setHint(true);
    setShake(s => ({gate: twoGates && !domainAck ? 'domain' : 'perms', n: (s?.n ?? 0) + 1}));
  };
  const togglePerms = () => {
    // 47b's gates are in order: the permissions ack is the second ("second gate for unknown domain").
    if (twoGates && !domainAck) {
      setShake(s => ({gate: 'domain', n: (s?.n ?? 0) + 1}));
      return;
    }
    setPermsAck(a => !a);
    setHint(false);
  };
  // Odd and even taps use the two animation names, so every tap shakes.
  const permsShake = shake !== null && shake.gate === 'perms' ? (shake.n % 2 === 1 ? 1 : 2) : 0;
  const domainShake = shake !== null && shake.gate === 'domain' ? (shake.n % 2 === 1 ? 1 : 2) : 0;

  const overline = kind === 'verified' ? CONNECT_TEXT.overline.verified : kind === 'unknown' ? CONNECT_TEXT.overline.unknown : CONNECT_TEXT.overline.lookalike;
  const title = verified ? CONNECT_TEXT.title(request.site.name) : CONNECT_TEXT.titleUnknown;
  const short = chosen === undefined ? '' : shortAddress(chosen.publicKey);
  const gateText = twoGates
    ? gatesOk
      ? CONNECT_TEXT.readySession
      : CONNECT_TEXT.gate((domainAck ? 1 : 0) + (permsAck ? 1 : 0), 2)
    : gatesOk
      ? CONNECT_TEXT.ready
      : CONNECT_TEXT.gate(0, 1);
  const partial = twoGates && !gatesOk && (domainAck || permsAck);

  const perms = (
    <div className="s9-perm-card">
      <span className="noc-overline app-dim app-card-overline">{verified ? CONNECT_TEXT.permsVerified(request.site.name) : CONNECT_TEXT.permsUnknown}</span>
      <div className="s9-perm-row">
        <div className="check">
          <ExtIcon name="check" size={12} />
        </div>
        <div>
          <div className="pri">{CONNECT_TEXT.seeAddress}</div>
          <div className="sec">{verified ? CONNECT_TEXT.seeAddressSec(short) : CONNECT_TEXT.seeAddressSecUnknown(short)}</div>
        </div>
        <span className="badge">{CONNECT_TEXT.automatic}</span>
      </div>
      <div className="s9-perm-row">
        <div className="check">
          <ExtIcon name="check" size={12} />
        </div>
        <div>
          <div className="pri">{CONNECT_TEXT.signTx}</div>
          <div className="sec">{CONNECT_TEXT.signTxSec}</div>
        </div>
        <span className="badge">{CONNECT_TEXT.withPrompt}</span>
      </div>
      <div className="s9-perm-row">
        <div className="check">
          <ExtIcon name="check" size={12} />
        </div>
        <div>
          <div className="pri">{CONNECT_TEXT.signMsg}</div>
          <div className="sec">{CONNECT_TEXT.signMsgSec}</div>
        </div>
        <span className="badge">{CONNECT_TEXT.withPrompt}</span>
      </div>
      {preConfirm || cap ? null : (
        <button
          type="button"
          role="checkbox"
          aria-checked={permsAck}
          className={permsAck ? 's9-ack-row is-acked' : permsShake === 1 ? 's9-ack-row app-shake' : permsShake === 2 ? 's9-ack-row app-shake-again' : 's9-ack-row'}
          disabled={disabled}
          onClick={togglePerms}
        >
          <span className="box">
            <ExtIcon name="check" size={11} />
          </span>
          <span className="lbl">
            {permsAck ? CONNECT_TEXT.acked : CONNECT_TEXT.ack}
            <small>{permsAck ? (twoGates ? CONNECT_TEXT.ackedSecUnknown : CONNECT_TEXT.ackedSec) : !twoGates ? CONNECT_TEXT.ackSec : domainAck ? CONNECT_TEXT.ackSecFinal : CONNECT_TEXT.ackSecUnknown}</small>
          </span>
        </button>
      )}
    </div>
  );

  return (
    <div className="screen app-approve">
      <WindowTop overline={overline} tone={kind === 'verified' ? 'neutral' : kind === 'unknown' ? 'warning' : 'danger'} onClose={reject} disabled={disabled} />
      <div className="scroll-area app-approve-scroll">
        {notice ? <BudgetNotice /> : null}
        <h1 className="noc-h1 app-approve-title">{title}</h1>
        <p className="noc-body-sm app-muted app-approve-lede">
          {kind === 'lookalike'
            ? CONNECT_TEXT.ledeShort
            : kind === 'unknown'
              ? gatesOk
                ? [CONNECT_TEXT.ledeUnknownDone[0], <i key="i">{CONNECT_TEXT.ledeUnknownDone[1]}</i>, CONNECT_TEXT.ledeUnknownDone[2]]
                : CONNECT_TEXT.ledeUnknown
              : CONNECT_TEXT.lede}
        </p>
        <div className={busy ? 'app-origin-slot app-busy-dim' : 'app-origin-slot'}>
          <OriginCard site={request.site} origin={request.origin} host={request.host} />
        </div>
        {kind === 'lookalike' ? <LookalikeBanner site={request.site} host={request.host} /> : null}
        {cap ? (
          <div className="s9-flag-banner danger" role="alert">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{CONNECT_TEXT.cap}</p>
            </div>
          </div>
        ) : null}
        {twoGates && !cap ? (
          <div className="s9-flag-banner warn">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{CONNECT_TEXT.notListed}</p>
              {request.site.international && kind === 'unknown' ? <p className="body">{CONNECT_TEXT.international(request.host)}</p> : null}
              <button
                type="button"
                role="checkbox"
                aria-checked={domainAck}
                className={domainAck ? 'ack is-acked' : domainShake === 1 ? 'ack app-shake' : domainShake === 2 ? 'ack app-shake-again' : 'ack'}
                disabled={disabled}
                onClick={() => {
                  setDomainAck(a => !a);
                  if (domainAck) setPermsAck(false);
                  setHint(false);
                }}
              >
                <span className="box">
                  <ExtIcon name="check" size={10} />
                </span>
                <span className="ack-lbl">{domainAck ? CONNECT_TEXT.domainAcked : CONNECT_TEXT.domainAck}</span>
              </button>
            </div>
          </div>
        ) : null}
        {perms}
        {cap || preConfirm || detail === null ? null : (
          <>
            <label className="app-approve-account">
              <span className="noc-overline app-dim">{CONNECT_TEXT.account}</span>
              <select value={account} disabled={disabled} onChange={e => setAccount(Number(e.target.value))}>
                {detail.accounts.map(a => (
                  <option key={a.index} value={a.index}>
                    {`${a.name} · ${shortAddress(a.publicKey)}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="s9-scope-card" role="radiogroup" aria-label={twoGates ? CONNECT_TEXT.recommended : CONNECT_TEXT.stay}>
              <span className={twoGates ? 'noc-overline noc-warning app-card-overline' : 'noc-overline app-dim app-card-overline'}>{twoGates ? CONNECT_TEXT.recommended : CONNECT_TEXT.stay}</span>
              <button type="button" role="radio" aria-checked={twoGates || scope === 'session'} className={twoGates || scope === 'session' ? 's9-scope-row sel' : 's9-scope-row'} disabled={disabled} onClick={() => setScope('session')}>
                <span className="radio" />
                <span>
                  <span className="pri">{CONNECT_TEXT.session}</span>
                  <span className="sec">{twoGates ? CONNECT_TEXT.sessionSecUnknown : CONNECT_TEXT.sessionSec}</span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!twoGates && scope === 'persistent'}
                className={twoGates ? 's9-scope-row app-scope-off' : scope === 'persistent' ? 's9-scope-row sel' : 's9-scope-row'}
                disabled={disabled || twoGates}
                onClick={() => setScope('persistent')}
              >
                <span className="radio" />
                <span>
                  <span className="pri">{CONNECT_TEXT.persistent}</span>
                  <span className={twoGates ? 'sec noc-warning' : 'sec'}>{twoGates ? CONNECT_TEXT.persistentSecUnknown : CONNECT_TEXT.persistentSec}</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
      {request.offerBlock && !busy ? <BlockSite onBlock={() => onDecide({decision: 'block'})} /> : null}
      <Waiting n={waiting} />
      {cap || preConfirm ? null : (
        <div className={gatesOk ? 's9-gate-status is-ready' : partial ? 's9-gate-status app-gate-partial' : 's9-gate-status'} role="status" aria-live="polite">
          <span className="dot" />
          {gateText}
        </div>
      )}
      {hint && !gatesOk ? (
        <p className="field-msg noc-warning app-approve-hint" role="status">
          {twoGates ? CONNECT_TEXT.hintUnknown : CONNECT_TEXT.hint}
        </p>
      ) : null}
      {cap ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-secondary" onPress={reject}>
            {WINDOW_TEXT.reject}
          </LockedButton>
        </div>
      ) : preConfirm ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-primary app-btn-danger" onPress={report} disabled={disabled}>
            <ExtIcon name="close" size={18} />
            {WINDOW_TEXT.rejectAndReport}
          </LockedButton>
          <ConfirmButton armed={armed && !disabled} className="btn btn-tertiary noc-body-sm app-dim" onPress={() => setConfirming(true)}>
            {CONNECT_TEXT.connectAnyway}
          </ConfirmButton>
        </div>
      ) : (
        <div className="sticky-bar row">
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={disabled}>
            {WINDOW_TEXT.reject}
          </LockedButton>
          {busy ? (
            <button type="button" className="btn btn-primary app-cta-wide" disabled>
              <Spinner />
              {CONNECT_TEXT.connecting}
            </button>
          ) : gatesOk ? (
            <ConfirmButton armed={armed} className="btn btn-primary app-cta-wide" onPress={connect}>
              {kind === 'verified' ? <ExtIcon name="link" size={18} /> : null}
              {twoGates ? CONNECT_TEXT.connectSession : CONNECT_TEXT.connect}
            </ConfirmButton>
          ) : (
            <button type="button" className="btn btn-secondary app-cta-wide" aria-disabled="true" title={twoGates ? CONNECT_TEXT.hintUnknown : CONNECT_TEXT.hint} onClick={lockedTap}>
              {kind === 'verified' ? <ExtIcon name="link" size={18} /> : null}
              {twoGates ? CONNECT_TEXT.connectSession : CONNECT_TEXT.connect}
            </button>
          )}
        </div>
      )}
      {confirming ? (
        <RiskConfirm
          onCancel={() => setConfirming(false)}
          onProceed={() => {
            setConfirming(false);
            setAnyway(true);
          }}
        />
      ) : null}
    </div>
  );
}
````

Create `extension/src/approve/Locked.tsx`:

````tsx
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import type {RequestView} from './client';
import {OriginCard, Waiting} from './ui';
import {WINDOW_TEXT} from './strings';

/**
 * The locked window (spec §4.3, D11): the Noctura mark, Q22, Q23, the request's origin card, and [Reject]. No password
 * field and no link into the vault page — the user learns one rule: the password is typed only after clicking the
 * Noctura icon. The window polls every second; when the unlock lands it shows the request.
 */
export function Locked({request, waiting, onReject}: {request: RequestView; waiting: number; onReject: () => Promise<unknown>}) {
  return (
    <div className="screen app-approve app-approve-locked">
      <div className="scroll-area app-approve-scroll app-center">
        <div className="app-lock-tile" aria-hidden="true">
          <ExtIcon name="lock" size={28} />
        </div>
        <h2 className="s7-wordmark">
          noctura<span className="dot">.</span>
        </h2>
        <h1 className="noc-h1">{WINDOW_TEXT.lockedTitle}</h1>
        <p className="noc-body app-muted">{WINDOW_TEXT.lockedBody}</p>
        <div className="app-origin-slot">
          <OriginCard site={request.site} origin={request.origin} host={request.host} />
        </div>
      </div>
      <Waiting n={waiting} />
      <div className="sticky-bar">
        <LockedButton className="btn btn-secondary" onPress={onReject}>
          {WINDOW_TEXT.reject}
        </LockedButton>
      </div>
    </div>
  );
}
````

Create `extension/src/approve/client.ts`:

````ts
import {send as runtimeSend} from '../ui/send';

/**
 * The approval window's one way to the background (spec §1.4, §2.3, §4.3): `dapp.pending` and `dapp.decide`, nothing
 * else. Every reply is shape-checked before a screen sees it (as the popup's engine.ts does); a reply of any other
 * shape is null — the window keeps what it shows and asks again on its next poll. The window holds no state and no
 * listener (C5, C13): what it shows always comes from here.
 */
export type SiteKind = 'verified' | 'unknown' | 'lookalike';
export interface IdnDetail {
  char: string;
  codePoint: string;
  script: string | null;
  latin: string;
  latinCodePoint: string;
}
export interface Site {
  kind: SiteKind;
  name: string;
  imitates: string | null;
  rule: 'idn' | 'edit' | 'embedded' | 'swap' | null;
  idn: IdnDetail | null;
  international: boolean;
}
export interface AccountChoice {
  index: number;
  name: string;
  publicKey: string;
}
export interface ConnectDetail {
  accounts: AccountChoice[];
  selected: number;
  cap: boolean;
}
export interface SignDetail {
  account: AccountChoice;
  text: string;
  chars: number;
  keyword: string | null;
  marks: {start: number; end: number}[];
  siwsMismatch: string | null;
}
export interface RequestView {
  requestId: string;
  type: 'connect' | 'signMessage';
  origin: string;
  host: string;
  site: Site;
  offerBlock: boolean;
  connect: ConnectDetail | null;
  sign: SignDetail | null;
}
export type PendingView = {state: 'none'} | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};
export type Decision = {decision: 'reject' | 'report' | 'block'} | {decision: 'approve'; account: string; scope?: 'session' | 'persistent'};
export type DecideReply = {ok: true} | {ok: false; error: string};

type J = Record<string, unknown>;
const obj = (x: unknown): J | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as J) : undefined);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isBool = (x: unknown): x is boolean => typeof x === 'boolean';
const nullOr = <T,>(x: unknown, f: (v: unknown) => T | undefined): T | null | undefined => (x === null ? null : f(x));

function idnOf(x: unknown): IdnDetail | undefined {
  const o = obj(x);
  if (o === undefined || !isStr(o.char) || !isStr(o.codePoint) || !(o.script === null || isStr(o.script)) || !isStr(o.latin) || !isStr(o.latinCodePoint)) return undefined;
  return {char: o.char, codePoint: o.codePoint, script: o.script, latin: o.latin, latinCodePoint: o.latinCodePoint};
}

function siteOf(x: unknown): Site | undefined {
  const o = obj(x);
  if (o === undefined || (o.kind !== 'verified' && o.kind !== 'unknown' && o.kind !== 'lookalike') || !isStr(o.name) || !isBool(o.international)) return undefined;
  const imitates = nullOr(o.imitates, v => (isStr(v) ? v : undefined));
  const rule = nullOr(o.rule, v => (v === 'idn' || v === 'edit' || v === 'embedded' || v === 'swap' ? v : undefined));
  const idn = nullOr(o.idn, idnOf);
  if (imitates === undefined || rule === undefined || idn === undefined) return undefined;
  return {kind: o.kind, name: o.name, imitates, rule, idn, international: o.international};
}

function accountOf(x: unknown): AccountChoice | undefined {
  const o = obj(x);
  return o !== undefined && isInt(o.index) && isStr(o.name) && isStr(o.publicKey) ? {index: o.index, name: o.name, publicKey: o.publicKey} : undefined;
}

function connectOf(x: unknown): ConnectDetail | undefined {
  const o = obj(x);
  if (o === undefined || !Array.isArray(o.accounts) || !isInt(o.selected) || !isBool(o.cap)) return undefined;
  const accounts = (o.accounts as unknown[]).map(accountOf);
  if (accounts.some(a => a === undefined)) return undefined;
  return {accounts: accounts as AccountChoice[], selected: o.selected, cap: o.cap};
}

function signOf(x: unknown): SignDetail | undefined {
  const o = obj(x);
  const account = accountOf(o?.account);
  if (o === undefined || account === undefined || !isStr(o.text) || !isInt(o.chars) || !(o.keyword === null || isStr(o.keyword)) || !Array.isArray(o.marks)) return undefined;
  const marks: {start: number; end: number}[] = [];
  for (const m of o.marks as unknown[]) {
    const r = obj(m);
    if (r === undefined || !isInt(r.start) || !isInt(r.end) || r.end <= r.start || r.end > o.text.length) return undefined;
    marks.push({start: r.start, end: r.end});
  }
  if (!(o.siwsMismatch === null || isStr(o.siwsMismatch))) return undefined;
  return {account, text: o.text, chars: o.chars, keyword: o.keyword, marks, siwsMismatch: o.siwsMismatch};
}

function requestOf(x: unknown): RequestView | undefined {
  const o = obj(x);
  const site = siteOf(o?.site);
  if (o === undefined || site === undefined || !isStr(o.requestId) || (o.type !== 'connect' && o.type !== 'signMessage') || !isStr(o.origin) || !isStr(o.host) || !isBool(o.offerBlock)) return undefined;
  const connect = nullOr(o.connect, connectOf);
  const sign = nullOr(o.sign, signOf);
  if (connect === undefined || sign === undefined) return undefined;
  return {requestId: o.requestId, type: o.type, origin: o.origin, host: o.host, site, offerBlock: o.offerBlock, connect, sign};
}

export function pendingOf(x: unknown): PendingView | null {
  const o = obj(x);
  if (o === undefined) return null;
  if (o.state === 'none') return {state: 'none'};
  if (o.state !== 'locked' && o.state !== 'deciding' && o.state !== 'request') return null;
  const request = requestOf(o.request);
  if (request === undefined || !isInt(o.waiting) || !isBool(o.windowNotice)) return null;
  return {state: o.state, request, waiting: o.waiting, windowNotice: o.windowNotice};
}

export type Transport = (m: unknown) => Promise<unknown>;

export interface ApproveClient {
  pending(): Promise<PendingView | null>;
  decide(requestId: string, d: Decision): Promise<DecideReply | null>;
}

export function createClient(transport: Transport = runtimeSend): ApproveClient {
  const ask = async (m: unknown): Promise<J | undefined> => {
    try {
      return obj(await transport(m));
    } catch {
      // The service worker was restarting: the next poll asks again.
      return undefined;
    }
  };
  return {
    async pending() {
      const r = await ask({type: 'dapp.pending'});
      return r?.ok === true ? pendingOf(r.data) : null;
    },
    async decide(requestId, d) {
      const r = await ask({type: 'dapp.decide', requestId, ...d});
      if (r?.ok === true) return {ok: true};
      return r?.ok === false && isStr(r.error) ? {ok: false, error: r.error} : null;
    },
  };
}
````

Create `extension/src/approve/main.tsx`:

````tsx
import '../../../web/src/styles/design-system.css';
import '../styles/design-ext.css';
import '../app/app.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Approve} from './Approve';
import {createClient} from './client';

/** approve.html (spec §1.7, §4.3): the approval window — the popup's React shell and styles, its own page. */
const root = document.getElementById('root');
if (root === null) throw new Error('no #root element');
const client = createClient();
const close = () => window.close();
createRoot(root).render(
  <StrictMode>
    <div className="app app-window">
      <Approve client={client} close={close} />
    </div>
  </StrictMode>,
);
````

Create `extension/src/approve/strings.ts`:

````ts
/**
 * Every string the approval window shows (spec §3.1, §3.2, §4.3, §10): the design's own (index.html #46 ix:17442-17686,
 * #47 ix:17686-18261), as the spec quotes them, and the owner-confirmed Q01–Q24. Nothing else is shown.
 */
export const WINDOW_TEXT = {
  close: 'Close',
  reject: 'Reject',
  rejectAndReport: 'Reject and report',
  /** Q17. */
  blockSite: 'Block this site',
  /** Q12. */
  waiting: (n: number): string => (n === 1 ? '1 more request waiting' : `${n} more requests waiting`),
  /** Q24. */
  budgetNotice: 'Too many requests from sites in the last few minutes — some were declined without asking you.',
  badge: {verified: 'Verified', unknown: 'Unknown', lookalike: 'Lookalike'},
  /** The lookalike banner (§3.1): its head, rule a's line, rule b–d's line (Q05). */
  notThis: (domain: string): string => `This domain is not ${domain}`,
  idnLead: 'The "',
  idnIs: (script: string | null, codePoint: string): string => `" in this URL is ${script === null ? 'a non-Latin' : /^[AEIOU]/.test(script) ? `an ${script}` : `a ${script}`} letter (${codePoint}), not a Latin "`,
  idnNot: (latinCodePoint: string): string => `" (${latinCodePoint}). The Punycode form is `,
  looksLike: (domain: string): string => `It looks like ${domain} but is a different site.`,
  /** The design's 2-second confirm (#46 E, review M10.1). */
  confirmTitle: 'We strongly recommend rejecting. Continue?',
  cancel: 'Cancel',
  understand: 'I understand the risk',
  /** Q22, Q23: the locked window (D11) — no password field, no link into the vault page. */
  lockedTitle: 'Noctura is locked',
  lockedBody: "Click the Noctura icon in your browser's toolbar and unlock. This request will wait here.",
} as const;

export const CONNECT_TEXT = {
  overline: {verified: 'Connection request', unknown: 'Unknown origin', lookalike: 'Suspicious origin'},
  title: (name: string): string => `Connect to ${name}?`,
  titleUnknown: 'Connect to this app?',
  lede: 'Connecting lets the dApp see your public address. It does not move funds. Every transaction will still ask for your approval.',
  /** The lookalike state's short lede: the first sentence, as #46's lookalike state shortens its own. */
  ledeShort: 'Connecting lets the dApp see your public address.',
  ledeUnknown: "We don't recognize this domain. That doesn't always mean it's bad — but proceed with care.",
  ledeUnknownDone: ['Both gates cleared. Connect is enabled ', 'for this session only', ' — the persisted-scope path stays locked out for unknown domains.'],
  permsVerified: (name: string): string => `${name} will be able to`,
  permsUnknown: 'If you connect, the dApp can',
  seeAddress: 'See your public address',
  seeAddressSec: (short: string): string => `${short} — never your seed or private key`,
  seeAddressSecUnknown: (short: string): string => `${short} · cannot see your seed or private key`,
  signTx: 'Request transaction signatures',
  signTxSec: 'You will approve each transaction individually',
  signMsg: 'Request message signatures',
  signMsgSec: 'You will approve each signature individually',
  automatic: 'AUTOMATIC',
  withPrompt: 'WITH PROMPT',
  ack: "I've read these permissions",
  ackSec: 'Tap to acknowledge · gates the Connect button',
  ackSecUnknown: 'Tap to acknowledge · second gate for unknown domain',
  ackSecFinal: 'Final gate — tap to enable Connect',
  acked: 'Permissions acknowledged',
  ackedSec: 'Connect is now enabled',
  ackedSecUnknown: 'Connect is now enabled · session-only scope',
  notListed: "This domain isn't on the verified list",
  /** Q04. */
  domainAck: 'I understand this domain is not on the verified list',
  domainAcked: 'Acknowledged — new domain',
  /** Q18. */
  international: (host: string): string => `This address uses international characters: ${host}`,
  /** Q01. */
  account: 'Account',
  stay: 'Stay connected',
  recommended: 'Recommended for unknown',
  session: 'For this session only',
  /** Q02. */
  sessionSec: 'Disconnects when the wallet locks or the browser closes',
  /** Q19. */
  sessionSecUnknown: 'Connection ends when the wallet locks · safest option for unknown domains',
  persistent: 'Until I revoke',
  /** Q03. */
  persistentSec: 'Saved in Settings → Connected dApps · revoke any time',
  persistentSecUnknown: 'Discouraged for unknown domains — re-grant per session instead',
  gate: (done: number, of: number): string => `${done} of ${of} acknowledgments`,
  ready: 'Ready to connect',
  readySession: 'Ready to connect · for this session',
  connect: 'Connect',
  connectSession: 'Connect for this session',
  connecting: 'Connecting…',
  hint: 'Read the permissions above before connecting',
  hintUnknown: 'Acknowledge both gates to connect',
  /** Q06. */
  connectAnyway: 'Connect anyway (not recommended)',
  /** Q16. */
  cap: 'You have 200 connected apps. Revoke one in Settings first.',
} as const;
````

Create `extension/src/approve/ui.tsx`:

````tsx
import {useEffect, useState, type ReactNode} from 'react';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import {Sheet} from '../app/ui/Sheet';
import type {Site} from './client';
import {WINDOW_TEXT} from './strings';
import {useArmed} from './useArmed';

/**
 * The approval window's shared pieces (spec §3.1, §3.2, §4.3): the top bar (✕ = Reject), the origin card, the lookalike
 * banner, a confirming CTA (C15), the 2-second confirm, and the queue's two lines (Q12, Q24). All on the design's own
 * classes (#46, #47: `.s9-origin-card`, `.s9-domain-warn`, `.top-bar`, `.sticky-bar`).
 */

/** The top bar: ✕ is Reject (C4); its overline names the state, coloured by tier (`--fg-tertiary` → `--warning` → `--danger`). */
export function WindowTop({overline, tone, onClose, disabled}: {overline: string; tone: 'neutral' | 'warning' | 'danger'; onClose: () => void; disabled: boolean}) {
  return (
    <div className="top-bar">
      <LockedButton className="icon-btn" label={WINDOW_TEXT.close} onPress={onClose} disabled={disabled}>
        <ExtIcon name="close" size={22} />
      </LockedButton>
      <span className={tone === 'danger' ? 'title noc-overline noc-danger' : tone === 'warning' ? 'title noc-overline noc-warning' : 'title noc-overline app-dim'}>{overline}</span>
      <span />
    </div>
  );
}

/**
 * What the origin card shows (§2.5 Display, review 1 L5, R35): the host, with the port when the origin has an explicit
 * one — `https://dapp.test` and `https://dapp.test:8443` are two grants (C8) and must not look alike.
 */
export function siteLabel(origin: string, host: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return host;
  }
}

/** The name's first character (C6: no favicon — the domain's initial; "?" for an unknown origin, as 47b draws it). */
const initial = (name: string): string => (Array.from(name)[0] ?? '?').toUpperCase();

/**
 * The origin card (§2.5 Display, C7): the name the background chose (the list's for a verified host, else the host's
 * second-level label — never the imitated brand's), and the host exactly as the browser reports it, in mono.
 */
export function OriginCard({site, origin, host}: {site: Site; origin: string; host: string}) {
  return (
    <div className={site.kind === 'verified' ? 's9-origin-card' : site.kind === 'unknown' ? 's9-origin-card app-origin-unknown' : 's9-origin-card app-origin-lookalike'}>
      <div className={site.kind === 'verified' ? 'ico app-ico-verified' : site.kind === 'unknown' ? 'ico app-ico-unknown' : 'ico app-ico-lookalike'} aria-hidden="true">
        {site.kind === 'unknown' ? '?' : initial(site.name)}
      </div>
      <div className="app-origin-text">
        <div className="name">{site.name}</div>
        <div className="dom">{siteLabel(origin, host)}</div>
      </div>
      <div className={site.kind === 'verified' ? 'badge verified' : site.kind === 'unknown' ? 'badge unknown' : 'badge danger'}>
        <ExtIcon name={site.kind === 'verified' ? 'shield-check' : 'alert-triangle'} size={12} />
        {site.kind === 'verified' ? WINDOW_TEXT.badge.verified : site.kind === 'unknown' ? WINDOW_TEXT.badge.unknown : WINDOW_TEXT.badge.lookalike}
      </div>
    </div>
  );
}

/**
 * The lookalike banner (§3.1): "This domain is not <listed domain>", then rule a's sentence — the character, its script
 * and code point, the Latin one it imitates, and the Punycode form — or Q05 for rules b–d. The decoded Unicode appears
 * here only (§2.5 Display: the background stripped every format character from it).
 */
export function LookalikeBanner({site, host}: {site: Site; host: string}) {
  const idn = site.rule === 'idn' ? site.idn : null;
  return (
    <div className="s9-domain-warn" role="alert">
      <ExtIcon name="alert-triangle" size={20} />
      <div className="body">
        <b>{WINDOW_TEXT.notThis(site.imitates ?? '')}</b>
        <br />
        {idn !== null ? (
          <>
            {WINDOW_TEXT.idnLead}
            <code>{idn.char}</code>
            {WINDOW_TEXT.idnIs(idn.script, idn.codePoint)}
            {idn.latin}
            {WINDOW_TEXT.idnNot(idn.latinCodePoint)}
            <code className="noc-danger">{host}</code>.
          </>
        ) : (
          WINDOW_TEXT.looksLike(site.imitates ?? '')
        )}
      </div>
    </div>
  );
}

/**
 * A confirming CTA (C15, rule 6): a LockedButton held until `armed`, and Enter never confirms — the key's default action
 * (a click) is prevented while focus is on it. Reject does not use this: it is never held.
 */
export function ConfirmButton({armed, onPress, className, children}: {armed: boolean; onPress: () => Promise<unknown> | void; className: string; children: ReactNode}) {
  return (
    <span
      className="app-confirm-wrap"
      onKeyDownCapture={e => {
        if (e.key === 'Enter') e.preventDefault();
      }}
    >
      <LockedButton className={className} disabled={!armed} onPress={onPress}>
        {children}
      </LockedButton>
    </span>
  );
}

/** The design's 2-second confirm (#46 E; §3.1, §3.2 step 5): only "I understand the risk" proceeds, enabled after 2 s. */
export const CONFIRM_DELAY_MS = 2_000;
export function RiskConfirm({onCancel, onProceed, delay = CONFIRM_DELAY_MS}: {onCancel: () => void; onProceed: () => Promise<unknown> | void; delay?: number}) {
  const [ready, setReady] = useState(false);
  // C15 inside the sheet too (review 1 L4): held 500 ms again whenever the window regains focus.
  const armed = useArmed('risk-confirm');
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <Sheet title={WINDOW_TEXT.confirmTitle} onClose={onCancel} focusControl={false}>
      <div className="sticky-bar row app-risk-actions">
        <LockedButton className="btn btn-secondary" onPress={onCancel}>
          {WINDOW_TEXT.cancel}
        </LockedButton>
        <ConfirmButton armed={ready && armed} className="btn btn-primary app-btn-danger" onPress={onProceed}>
          {WINDOW_TEXT.understand}
        </ConfirmButton>
      </div>
    </Sheet>
  );
}

/** Q24, once, above the request; Q12 above the sticky bar while more wait. */
export function BudgetNotice() {
  return (
    <div className="banner warning app-approve-notice" role="status">
      <ExtIcon name="alert-triangle" size={18} />
      <span className="banner-line">{WINDOW_TEXT.budgetNotice}</span>
    </div>
  );
}
export function Waiting({n}: {n: number}) {
  return n > 0 ? <p className="noc-caption app-dim app-approve-waiting">{WINDOW_TEXT.waiting(n)}</p> : null;
}

/** C14's third request: [Block this site] (Q17) above the sticky bar. */
export function BlockSite({onBlock}: {onBlock: () => Promise<unknown>}) {
  return (
    <div className="app-approve-block">
      <LockedButton className="btn btn-tertiary noc-danger" onPress={onBlock}>
        {WINDOW_TEXT.blockSite}
      </LockedButton>
    </div>
  );
}

/** The ring spinner of the design's in-progress state (#46 "signing-in-progress"). */
export const Spinner = () => <span className="app-ring-spinner" aria-hidden="true" />;
````

Create `extension/src/approve/useArmed.ts`:

````ts
import {useEffect, useState} from 'react';

/** C15: a confirming CTA is held this long after the window gains focus and after each state change. */
export const ARM_MS = 500;

/**
 * C15 (review 1 M12, review 2 L8): false for ARM_MS after mount, after every change of `state` (an ack toggled, the
 * scope, the account, the 2-second confirm opening, the head request changing — the caller folds them into one key)
 * and after the window gains focus; then true. Reject never uses it. A page cannot time a click onto a window it
 * caused.
 */
export function useArmed(state: string, ms: number = ARM_MS): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hold = () => {
      setArmed(false);
      clearTimeout(timer);
      timer = setTimeout(() => setArmed(true), ms);
    };
    hold();
    window.addEventListener('focus', hold);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', hold);
    };
  }, [state, ms]);
  return armed;
}
````

Modify `extension/src/styles/design-ext.css`:

````diff
diff --git a/extension/src/styles/design-ext.css b/extension/src/styles/design-ext.css
--- a/extension/src/styles/design-ext.css
+++ b/extension/src/styles/design-ext.css
@@ -1677,6 +1677,116 @@
 .s9-toast-cancelled { position: absolute; left: 50%; bottom: calc(var(--space-7) + 24px); transform: translateX(-50%); display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--bg-surface-2); border-radius: var(--radius-pill); box-shadow: 0 8px 24px rgba(0,0,0,0.4); border: 1px solid var(--bg-surface-3); white-space: nowrap; }
 .s9-toast-cancelled svg { color: var(--fg-secondary); }
 .s9-toast-cancelled .body { font-size: 13px; line-height: 18px; color: var(--fg-primary); }
+.s9-origin-card { background: var(--bg-surface-1); border-radius: var(--radius-lg); padding: var(--space-4); display: grid; grid-template-columns: 40px 1fr auto; gap: var(--space-3); align-items: center; }
+.s9-origin-card .ico { width: 40px; height: 40px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; }
+.s9-origin-card .name { font-size: 15px; line-height: 20px; font-weight: 600; color: var(--fg-primary); }
+.s9-origin-card .dom { font-family: var(--font-mono); font-size: 12px; line-height: 16px; color: var(--fg-secondary); margin-top: 2px; word-break: break-all; }
+.s9-origin-card .badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
+.s9-origin-card .badge.verified { background: color-mix(in oklab, var(--success) 16%, var(--bg-surface-2)); color: var(--success); }
+.s9-origin-card .badge.unknown  { background: color-mix(in oklab, var(--warning) 16%, var(--bg-surface-2)); color: var(--warning); }
+.s9-origin-card .badge.danger   { background: color-mix(in oklab, var(--danger) 16%, var(--bg-surface-2)); color: var(--danger); }
+.s9-msg-card { background: var(--bg-surface-1); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
+.s9-msg-card .label { font-size: 11px; line-height: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-tertiary); }
+.s9-msg-preview { max-height: 240px; overflow: auto; padding: var(--space-3); background: var(--bg-surface-3); border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 12px; line-height: 18px; color: var(--fg-secondary); white-space: pre-wrap; word-break: break-word; font-variant-numeric: tabular-nums slashed-zero; }
+.s9-msg-preview mark { background: color-mix(in oklab, var(--warning) 22%, transparent); color: var(--warning); padding: 1px 3px; border-radius: 3px; }
+.s9-disclaimer { display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-3); background: color-mix(in oklab, var(--info) 8%, var(--bg-surface-1)); border-radius: var(--radius-md); border-left: 3px solid var(--info); }
+.s9-disclaimer svg { color: var(--info); flex-shrink: 0; margin-top: 1px; }
+.s9-disclaimer p { margin: 0; font-size: 12px; line-height: 16px; color: var(--fg-primary); }
+.s9-domain-warn { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-4); background: color-mix(in oklab, var(--danger) 12%, var(--bg-surface-1)); border-radius: var(--radius-md); border: 1px solid color-mix(in oklab, var(--danger) 40%, transparent); }
+.s9-domain-warn svg { color: var(--danger); flex-shrink: 0; margin-top: 2px; }
+.s9-domain-warn .body { font-size: 13px; line-height: 18px; color: var(--fg-primary); }
+.s9-domain-warn .body b { color: var(--danger); }
+.s9-domain-warn .body code { font-family: var(--font-mono); font-size: 12px; }
+.s9-struct-alert { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-4); background: color-mix(in oklab, var(--warning) 10%, var(--bg-surface-1)); border-radius: var(--radius-md); border-left: 3px solid var(--warning); }
+.s9-struct-alert svg { color: var(--warning); flex-shrink: 0; margin-top: 2px; }
+.s9-struct-alert .head { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--fg-primary); margin: 0; }
+.s9-struct-alert .body { font-size: 12px; line-height: 16px; color: var(--fg-secondary); margin: 4px 0 0; }
+.s9-perm-card { background: var(--bg-surface-1); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
+.s9-perm-row { display: grid; grid-template-columns: 20px 1fr auto; gap: var(--space-3); align-items: center; min-height: 44px; }
+.s9-perm-row .check { width: 20px; height: 20px; border-radius: 50%; background: color-mix(in oklab, var(--success) 18%, transparent); color: var(--success); display: flex; align-items: center; justify-content: center; }
+.s9-perm-row .pri { font-size: 14px; line-height: 18px; color: var(--fg-primary); }
+.s9-perm-row .sec { font-size: 12px; line-height: 16px; color: var(--fg-tertiary); margin-top: 2px; }
+.s9-perm-row .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: color-mix(in oklab, var(--info) 14%, transparent); color: var(--info); font-weight: 600; letter-spacing: 0.04em; }
+.s9-scope-card { background: var(--bg-surface-1); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
+.s9-scope-row { display: grid; grid-template-columns: 20px 1fr; gap: var(--space-3); align-items: flex-start; padding: var(--space-2) 0; min-height: 44px; cursor: pointer; }
+.s9-scope-row .radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--fg-tertiary); flex-shrink: 0; margin-top: 2px; position: relative; }
+.s9-scope-row.sel .radio { border-color: var(--accent); }
+.s9-scope-row.sel .radio::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--accent); }
+.s9-scope-row .pri { font-size: 14px; line-height: 18px; font-weight: 500; color: var(--fg-primary); }
+.s9-scope-row .sec { font-size: 12px; line-height: 16px; color: var(--fg-tertiary); margin-top: 2px; }
+.s9-flag-banner { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); display: flex; gap: var(--space-3); align-items: flex-start; }
+.s9-flag-banner.warn { background: color-mix(in oklab, var(--warning) 12%, var(--bg-surface-1)); border-left: 3px solid var(--warning); }
+.s9-flag-banner.warn svg { color: var(--warning); flex-shrink: 0; margin-top: 1px; }
+.s9-flag-banner.danger { background: color-mix(in oklab, var(--danger) 14%, var(--bg-surface-1)); border: 1px solid color-mix(in oklab, var(--danger) 40%, transparent); }
+.s9-flag-banner.danger svg { color: var(--danger); flex-shrink: 0; margin-top: 1px; }
+.s9-flag-banner .head { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--fg-primary); margin: 0; }
+.s9-flag-banner.danger .head { color: var(--danger); }
+.s9-flag-banner .body { font-size: 12px; line-height: 16px; color: var(--fg-secondary); margin: 4px 0 0; }
+.s9-flag-banner .meta { font-family: var(--font-mono); font-size: 11px; color: var(--fg-tertiary); margin-top: 4px; word-break: break-all; }
+.s10-app-row { display: grid; grid-template-columns: 40px 1fr auto; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-4); min-height: 64px; background: var(--bg-surface-1); border-radius: var(--radius-lg); }
+.s10-app-row + .s10-app-row { margin-top: var(--space-2); }
+.s10-app-row .ico { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--bg-base); font-variant-numeric: tabular-nums; }
+.s10-app-row .ico.tensor { background: linear-gradient(135deg, oklch(72% 0.18 295), oklch(65% 0.16 320)); }
+.s10-app-row .ico.jup    { background: linear-gradient(135deg, oklch(78% 0.16 60),  oklch(70% 0.14 30)); }
+.s10-app-row .ico.magic  { background: linear-gradient(135deg, oklch(76% 0.18 340), oklch(68% 0.16 10)); }
+.s10-app-row .ico.drift  { background: linear-gradient(135deg, oklch(80% 0.14 180), oklch(72% 0.16 220)); }
+.s10-app-row .ico.kamino { background: linear-gradient(135deg, oklch(72% 0.16 200), oklch(64% 0.14 240)); }
+.s10-app-row .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
+.s10-app-row .name-row { display: flex; align-items: center; gap: var(--space-2); }
+.s10-app-row .name { font-size: 15px; line-height: 22px; font-weight: 500; color: var(--fg-primary); }
+.s10-app-row .verified-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); flex-shrink: 0; }
+.s10-app-row .domain { font-family: var(--font-mono); font-size: 12px; line-height: 16px; color: var(--fg-secondary); font-variant-numeric: tabular-nums slashed-zero; }
+.s10-app-row .meta { font-size: 11px; line-height: 14px; color: var(--fg-tertiary); display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: 2px; }
+.s10-app-row .meta .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 500; letter-spacing: 0.04em; }
+.s10-app-row .meta .badge[data-mode="shielded"] { background: color-mix(in oklab, var(--accent-shielded) 14%, transparent); color: var(--accent-shielded); border: 1px solid color-mix(in oklab, var(--accent-shielded) 32%, transparent); }
+.s10-app-row .meta .badge[data-mode="shielded"] svg { color: var(--accent-shielded); }
+.s10-app-row .meta .meta-pill-warn { color: var(--warning); display: inline-flex; align-items: center; gap: 4px; }
+.s10-app-row .revoke { padding: 0 var(--space-3); min-width: 64px; min-height: 44px; font-size: 13px; line-height: 18px; font-weight: 500; color: var(--danger); background: transparent; border: 0; }
+.s10-app-row .revoke:hover { background: color-mix(in oklab, var(--danger) 8%, transparent); border-radius: var(--radius-sm); }
+.s10-summary-bar { display: flex; justify-content: space-between; align-items: baseline; padding: 0 var(--space-1) var(--space-3); }
+.s10-summary-bar .count { font-size: 13px; color: var(--fg-secondary); font-variant-numeric: tabular-nums; }
+.s10-summary-bar .count b { color: var(--fg-primary); font-weight: 600; }
+.s10-summary-bar .sort { font-size: 12px; color: var(--fg-tertiary); display: inline-flex; align-items: center; gap: 4px; }
+.s10-empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding: var(--space-8) var(--space-5); text-align: center; }
+.s10-empty .ill { width: 132px; height: 132px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--accent) 18%, transparent), color-mix(in oklab, var(--bg-surface-1) 90%, transparent) 70%); display: flex; align-items: center; justify-content: center; border: 1px dashed color-mix(in oklab, var(--accent) 28%, transparent); }
+.s10-empty .ill svg { color: var(--accent); }
+.s10-empty .head { font-size: 20px; line-height: 26px; font-weight: 600; color: var(--fg-primary); margin: 0; }
+.s10-empty .sub { font-size: 14px; line-height: 20px; color: var(--fg-secondary); margin: 0; max-width: 280px; }
+.s10-sheet-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); }
+.s10-sheet { position: absolute; left: 0; right: 0; bottom: 0; background: var(--bg-surface-2); border-radius: var(--radius-xl) var(--radius-xl) 0 0; padding: var(--space-3) var(--space-5) calc(var(--space-4) + 24px); display: flex; flex-direction: column; gap: var(--space-4); max-height: 70%; overflow: hidden; }
+.s10-sheet .grabber { width: 40px; height: 4px; border-radius: 2px; background: var(--fg-disabled); margin: 0 auto; }
+.s10-sheet .head-row { display: flex; align-items: center; gap: var(--space-3); padding-top: var(--space-2); }
+.s10-sheet .head-row .ico { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--bg-base); }
+.s10-sheet .head-row .body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
+.s10-sheet .head-row .name { font-size: 17px; line-height: 22px; font-weight: 600; color: var(--fg-primary); display: flex; align-items: center; gap: var(--space-2); }
+.s10-sheet .head-row .domain { font-family: var(--font-mono); font-size: 13px; line-height: 18px; color: var(--fg-secondary); font-variant-numeric: tabular-nums slashed-zero; }
+.s10-sheet .group-label { font-size: 11px; line-height: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-tertiary); }
+.s10-perm-row { display: grid; grid-template-columns: 18px 1fr auto; gap: var(--space-3); align-items: center; padding: var(--space-3) 0; min-height: 44px; border-bottom: 1px solid color-mix(in oklab, var(--fg-disabled) 60%, transparent); }
+.s10-perm-row:last-child { border-bottom: 0; }
+.s10-perm-row .check { color: var(--success); }
+.s10-perm-row .pri { font-size: 14px; line-height: 18px; color: var(--fg-primary); }
+.s10-perm-row .sub { font-size: 11px; line-height: 14px; color: var(--fg-tertiary); margin-top: 2px; }
+.s10-perm-row .ts { font-size: 11px; line-height: 14px; color: var(--fg-tertiary); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
+.s10-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); padding: var(--space-3) 0; }
+.s10-meta-grid .cell { display: flex; flex-direction: column; gap: 2px; }
+.s10-meta-grid .k { font-size: 11px; line-height: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-tertiary); }
+.s10-meta-grid .v { font-size: 13px; line-height: 18px; color: var(--fg-primary); font-variant-numeric: tabular-nums; }
+.s10-meta-grid .v.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums slashed-zero; }
+.s10-history { display: flex; flex-direction: column; gap: var(--space-1); }
+.s10-history .row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; gap: var(--space-3); border-bottom: 1px solid color-mix(in oklab, var(--fg-disabled) 60%, transparent); }
+.s10-history .row:last-child { border-bottom: 0; }
+.s10-history .row .op { font-size: 13px; line-height: 18px; color: var(--fg-primary); }
+.s10-history .row .op .mono { font-family: var(--font-mono); font-size: 12px; color: var(--fg-secondary); font-variant-numeric: tabular-nums slashed-zero; }
+.s10-history .row .when { font-size: 12px; line-height: 16px; color: var(--fg-tertiary); font-variant-numeric: tabular-nums; }
+.s10-undo-toast { position: absolute; left: 50%; bottom: calc(var(--space-7) + 88px); transform: translateX(-50%); display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--bg-surface-2); border-radius: var(--radius-pill); box-shadow: 0 8px 24px rgba(0,0,0,0.4); border: 1px solid var(--bg-surface-3); white-space: nowrap; }
+.s10-undo-toast svg { color: var(--fg-secondary); }
+.s10-undo-toast .body { font-size: 13px; line-height: 18px; color: var(--fg-primary); }
+.s10-undo-toast .timer { color: var(--fg-secondary); font-variant-numeric: tabular-nums; }
+.s10-undo-toast .undo-btn { color: var(--accent); font-size: 13px; font-weight: 600; padding: 4px 8px; min-height: 32px; background: transparent; border: 0; }
+.s10-skel-row { display: grid; grid-template-columns: 40px 1fr 64px; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-4); min-height: 64px; background: var(--bg-surface-1); border-radius: var(--radius-lg); }
+.s10-skel-row + .s10-skel-row { margin-top: var(--space-2); }
+.s10-skel-row .ico { width: 40px; height: 40px; border-radius: 12px; background: var(--bg-surface-3); }
+.s10-skel-row .body { display: flex; flex-direction: column; gap: var(--space-2); }
 .s-stuck { padding: 0 var(--space-4) var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); flex: 1 1 auto; overflow-y: auto; }
 .s-stuck::-webkit-scrollbar { width: 0; }
 .s-stuck .pending-counter { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-5) var(--space-4) var(--space-3); }
@@ -1728,6 +1838,20 @@
 .s-stuck .progress-state .meta-grid .k { font: 600 10px/14px var(--font-body); letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-tertiary); }
 .s-stuck .progress-state .meta-grid .v { font: 500 12px/16px var(--font-body); color: var(--fg-primary); text-align: right; font-variant-numeric: tabular-nums; }
 .s-stuck .progress-state .meta-grid .v.mono { font-family: var(--font-mono); }
+.s9-ack-row { display: grid; grid-template-columns: 20px 1fr; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-2); margin-top: var(--space-3); min-height: var(--touch-target-min); border-top: 1px solid var(--border); cursor: pointer; }
+.s9-ack-row .box { width: 20px; height: 20px; border-radius: 4px; border: 2px solid var(--fg-tertiary); display: flex; align-items: center; justify-content: center; color: transparent; transition: all 120ms var(--ease-standard); }
+.s9-ack-row.is-acked .box { background: var(--accent); border-color: var(--accent); color: var(--bg-base); }
+.s9-ack-row .lbl { font: 400 13px/18px var(--font-body); color: var(--fg-primary); }
+.s9-ack-row.is-acked .lbl { color: var(--fg-secondary); }
+.s9-ack-row .lbl small { display: block; font: 400 11px/15px var(--font-body); color: var(--fg-tertiary); margin-top: 2px; }
+.s9-flag-banner .ack { display: inline-flex; align-items: center; gap: 8px; margin-top: var(--space-3); padding: 8px 10px; background: color-mix(in oklab, var(--warning) 10%, var(--bg-surface-2)); border-radius: var(--radius-pill); cursor: pointer; min-height: 36px; }
+.s9-flag-banner .ack .box { width: 16px; height: 16px; border-radius: 3px; border: 1.5px solid var(--warning); display: flex; align-items: center; justify-content: center; color: transparent; flex-shrink: 0; transition: all 120ms var(--ease-standard); }
+.s9-flag-banner .ack.is-acked .box { background: var(--warning); color: var(--bg-base); }
+.s9-flag-banner .ack .ack-lbl { font: 500 11px/14px var(--font-body); color: var(--fg-primary); letter-spacing: 0.02em; }
+.s9-gate-status { display: flex; gap: 8px; align-items: center; padding: 0 var(--space-4) var(--space-2); font: 500 11px/14px var(--font-body); color: var(--fg-tertiary); letter-spacing: 0.04em; text-transform: uppercase; }
+.s9-gate-status .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--fg-disabled); }
+.s9-gate-status.is-ready { color: var(--accent); }
+.s9-gate-status.is-ready .dot { background: var(--accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 24%, transparent); }
 .tx-row .meta .origin-badge { margin-inline-start: 4px; }
 .s-conf .headline {
   display: block;
````

Modify `extension/vite.config.ts`:

````diff
diff --git a/extension/vite.config.ts b/extension/vite.config.ts
--- a/extension/vite.config.ts
+++ b/extension/vite.config.ts
@@ -89,6 +89,8 @@ export default defineConfig({
         popup: resolve(__dirname, 'popup.html'),
         wallet: resolve(__dirname, 'wallet.html'),
         unlock: resolve(__dirname, 'unlock.html'),
+        // B1c §1.7: the approval window.
+        approve: resolve(__dirname, 'approve.html'),
       },
       output: {
         // The manifest names background.js; a hash there would change the manifest.
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run scripts/__tests__/check-classes.test.mjs scripts/__tests__/check-vault-isolation.test.mjs src/__tests__/designExt2b.test.ts src/approve/__tests__/connect.test.tsx src/approve/__tests__/locked.test.tsx
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  5 passed (5) · Tests  456 passed (456); tsc clean; whole suite Test Files  151 passed (151) · Tests  3011 passed (3011); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M8a** — C15: the CTA enabled at mount (spec mutation) — `extension/src/approve/useArmed.ts`:

  ```diff
  -     hold();
  -     window.addEventListener('focus', hold);
  +     setArmed(true);
  +     window.addEventListener('focus', hold);
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 18 passed (20)).

- **M8b** — Enter confirms (C15) — `extension/src/approve/ui.tsx`:

  ```diff
  -         if (e.key === 'Enter') e.preventDefault();
  +         void e;
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 19 passed (20)).

- **M8c** — 47b's "Until I revoke" selectable (C12 in the window) — `extension/src/approve/Connect.tsx`:

  ```diff
  -                 disabled={disabled || twoGates}
  +                 disabled={disabled}
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 18 passed (20)).

- **M8d** — 47b's gates in any order (R14) — `extension/src/approve/Connect.tsx`:

  ```diff
  -     if (twoGates && !domainAck) {
  -       setShake
  +     if (false) {
  +       setShake
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 19 passed (20)).

- **M8e** — no polling on the locked screen (D11: the unlock never reaches the window) — `extension/src/approve/Approve.tsx`:

  ```diff
  -   const polling = view !== null && view.state !== 'none';
  +   const polling = view !== null && view.state !== 'none' && view.state !== 'locked';
  ```
  `timeout 300 npx vitest run src/approve/__tests__/locked.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 2 passed (4)).

- **M8f** — the window never closes on none — `extension/src/approve/Approve.tsx`:

  ```diff
  -     if (v.state === 'none') {
  -       close();
  -       return;
  -     }
  +     if (v.state === 'none') return;
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  8 failed | 12 passed (20)).

- **M8g** — the lookalike bar not flipped — `extension/src/approve/Connect.tsx`:

  ```diff
  -   const preConfirm = kind === 'lookalike' && !anyway;
  +   const preConfirm = false;
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  3 failed | 17 passed (20)).

- **M8h** — no poll after a decision (the next head never shows) — `extension/src/approve/Approve.tsx`:

  ```diff
  -         if (alive.current) setBusy(false);
  -         await refresh();
  +         if (alive.current) setBusy(false);
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  3 failed | 17 passed (20)).

- **M8i** — the window polls every 5 s (the locked window's two seconds after the unlock lands) — `extension/src/approve/Approve.tsx`:

  ```diff
  - export const POLL_MS = 1_000;
  + export const POLL_MS = 5_000;
  ```
  `timeout 300 npx vitest run src/approve/__tests__/locked.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 2 passed (4)).

- **M8j** — the window polls only while locked, deciding or with more waiting (an expiry never reaches it) — `extension/src/approve/Approve.tsx`:

  ```diff
  -   const polling = view !== null && view.state !== 'none';
  +   const polling = view !== null && view.state !== 'none' && (view.state === 'locked' || view.state === 'deciding' || view.waiting > 0);
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 19 passed (20)).

- **M8k** — the confirm sheet focuses its first control — `extension/src/approve/ui.tsx`:

  ```diff
  -  onClose={onCancel} focusControl={false}>
  +  onClose={onCancel}>
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 19 passed (20)).

- **M8l** — "I understand the risk" not held again when the window regains focus — `extension/src/approve/ui.tsx`:

  ```diff
  - armed={ready && armed}
  + armed={ready && (armed || true)}
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 19 passed (20)).

- **M8m** — the origin card drops the port — `extension/src/approve/ui.tsx`:

  ```diff
  - <div className="dom">{siteLabel(origin, host)}</div>
  + <div className="dom">{siteLabel(origin.replace(/:\d+$/, ''), host)}</div>
  ```
  `timeout 300 npx vitest run src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 19 passed (20)).

- [ ] **Step 6: Commit.**

```bash
git add extension/approve.html extension/scripts/__tests__/check-classes.test.mjs extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/check-classes.mjs extension/scripts/check-vault-isolation.mjs extension/src/__tests__/designExt2b.test.ts extension/src/app/app.css extension/src/app/ui/Sheet.tsx extension/src/approve/Approve.tsx extension/src/approve/Connect.tsx extension/src/approve/Locked.tsx extension/src/approve/__tests__/connect.test.tsx extension/src/approve/__tests__/locked.test.tsx extension/src/approve/__tests__/windowHarness.tsx extension/src/approve/client.ts extension/src/approve/main.tsx extension/src/approve/strings.ts extension/src/approve/ui.tsx extension/src/approve/useArmed.ts extension/src/styles/design-ext.css extension/vite.config.ts
git commit -F - <<'MSG'
feat(extension): B1c approval window — polling, locked screen, C15, #47 in every state

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 9: #46 sign-message in every state: verified / unknown, the keyword alert, the lookalike with its 2-second confirm, the SIWS mismatch (Q20), signing

**Spec:** §3.2 steps 4–7, §4.3 (`deciding` → "Signing…"), C15, review M10.1, review 2 M10.1, M10.2; §6.1 "Screens" (#46); Scope R19; plan review 1 L5

**Files:**
- Modify: `extension/src/approve/Approve.tsx`
- Create: `extension/src/approve/Sign.tsx`
- Test: `extension/src/approve/__tests__/sign.test.tsx` (new)
- Test: `extension/src/approve/__tests__/windowHarness.tsx`
- Modify: `extension/src/approve/strings.ts`

**Interfaces:**
- Consumes: Task 6's `SignDetail` (through `dapp.pending`); Task 8's window pieces.
- Produces (as exported):
  - `src/approve/Sign.tsx`: `Sign({request, waiting, notice, busy, onDecide})`.
  - `strings.ts`: `SIGN_TEXT`.
  - `Approve.tsx`: routes a `signMessage` head to `Sign`.
  - `windowHarness.tsx`: `openWindow().sign(origin, message)` (a persistent grant, then the request).

#46 on the design's own classes: the origin card; "Message · UTF-8 (n chars)" (characters, not bytes), "Message preview" for a lookalike, "Message · with structured-approval flag" when a keyword fired; the message as text in mono, scrollable, with the background's ranges in `<mark>`; the disclaimer naming the site by C7's name; [Reject] + [Sign] with the key glyph. The keyword alert is the design's head and body with the word in mono `--warning`. A lookalike flips the bar ([Reject and report], "Sign anyway (not recommended)" → the 2-second confirm, where only "I understand the risk" signs). A SIWS mismatch shows Q20 in the danger banner and only [Reject]. Signing: the overline "Signing", "Signing…" with the ring, the origin card at .55 and the message at .7, no lede and no disclaimer (as drawn), every CTA and ✕ disabled.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/approve/__tests__/sign.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {DAPP_SESSION_KEY, readDappSession} from '../../background/dapp/store';
import {runtimeFor} from '../../background/dapp/ports';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {ARM_MS} from '../useArmed';
import {CONFIRM_DELAY_MS} from '../ui';
import {openWindow} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const cta = (name: string | RegExp) => screen.getByRole('button', {name});
const armedAfter = () => new Promise(r => setTimeout(r, ARM_MS + 50));
const siws = (domain: string) =>
  [`${domain} wants you to sign in with your Solana account:`, ACCOUNT.publicKey, '', 'Sign in to Jupiter.', '', `URI: https://${domain}`, 'Version: 1', 'Chain ID: solana:mainnet', 'Nonce: 4f3a92ceb1d8', 'Issued At: 2026-10-10T09:40:23Z'].join('\n');
afterEach(() => cleanup());

// Spec §3.2 steps 4–7 (#46, index.html ix:17442-17686) and C15, against the real background.
describe('#46 sign-message', () => {
  it('idle · verified: every drawn string, the message as text in mono; Sign held 500 ms, then an ed25519 signature over the exact bytes', async () => {
    const w = await openWindow();
    const message = siws('jup.ag');
    const {page, requestId} = await w.sign('https://jup.ag', message);
    w.show();
    await screen.findByText('Sign this message?');
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Signature request', 'title noc-overline app-dim']);
    expect(text('.app-approve-lede')).toBe('A signature proves you control this wallet. It does not move funds and does not broadcast a transaction.');
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['Jupiter', 'jup.ag', 'Verified']);
    expect(text('.s9-msg-card .label')).toBe(`Message · UTF-8 (${[...message].length} chars)`);
    expect(text('.s9-msg-preview')).toBe(message);
    expect(document.querySelector('.s9-msg-preview mark')).toBeNull();
    expect(text('.s9-disclaimer p')).toBe("This won't broadcast or move funds. Jupiter will use the signature only to verify you own this wallet.");
    expect(document.querySelector('.s9-struct-alert')).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    const sign = cta('Sign');
    expect([sign.className, (sign as HTMLButtonElement).disabled, sign.querySelector('svg') !== null]).toEqual(['btn btn-primary app-cta-wide', true, true]);
    await armedAfter();
    fireEvent.click(cta('Sign'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    const [answer] = page.answersFor(requestId);
    const {signature, signedMessage} = answer?.result as {signature: string; signedMessage: string};
    expect(signedMessage).toBe(base64.encode(new TextEncoder().encode(message)));
    expect(ed25519.verify(base64.decode(signature), new TextEncoder().encode(message), base58.decode(ACCOUNT.publicKey))).toBe(true);
  });

  it('a structured-approval keyword: the design’s alert, the word marked, the label with the flag (rule 6)', async () => {
    const w = await openWindow();
    await w.sign('https://jup.ag', 'jup.ag asks you to approve the following terms.');
    w.show();
    await screen.findByText('This message includes an authorization');
    expect(text('.s9-struct-alert .body')).toBe("Detected keyword: approve. Even though signing won't broadcast, the dApp may use this signature off-chain to authorize a future action. Read the full message before signing.");
    expect(text('.s9-struct-alert code')).toBe('approve');
    expect(text('.s9-msg-card .label')).toBe('Message · with structured-approval flag');
    expect([...document.querySelectorAll('.s9-msg-preview mark')].map(m => m.textContent)).toEqual(['approve']);
    expect(text('.s9-msg-preview')).toBe('jup.ag asks you to approve the following terms.');
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('an unknown origin: the Unknown card, and the disclaimer names its own label', async () => {
    const w = await openWindow();
    await w.sign('https://dapp.test', 'Sign in to the test dApp.');
    w.show();
    await screen.findByText('Sign this message?');
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .badge')]).toEqual(['dapp', 'Unknown']);
    expect(text('.s9-disclaimer p')).toBe("This won't broadcast or move funds. dapp will use the signature only to verify you own this wallet.");
  });

  it('lookalike: "Suspicious origin", the short lede, the banner, "Message preview" with the homoglyph marked; Sign anyway → 2 s → I understand the risk signs', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.sign('https://tensr.trade', 'Welcome back!\nDomain: ph\u0430ntom.app');
    w.show();
    await screen.findByText('Sign this message?');
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Suspicious origin', 'title noc-overline noc-danger']);
    expect(text('.app-approve-lede')).toBe('A signature proves you control this wallet.');
    expect(text('.s9-domain-warn .body')).toBe('This domain is not tensor.tradeIt looks like tensor.trade but is a different site.');
    expect(text('.s9-msg-card .label')).toBe('Message preview');
    expect([...document.querySelectorAll('.s9-msg-preview mark')].map(m => m.textContent)).toEqual(['\u0430']);
    expect(cta('Reject and report').className).toBe('btn btn-primary app-btn-danger');
    expect(screen.queryByRole('button', {name: 'Sign'})).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    await armedAfter();
    fireEvent.click(cta('Sign anyway (not recommended)'));
    const sheet = await screen.findByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'});
    const understand = within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement;
    expect(understand.disabled).toBe(true);
    await new Promise(r => setTimeout(r, CONFIRM_DELAY_MS + 50));
    fireEvent.click(within(sheet).getByRole('button', {name: 'I understand the risk'}));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)[0]).toHaveProperty('result');
  });

  it('a sign-in message for another domain: Q20 and no Sign — only [Reject] (rule 3)', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.sign('https://dapp.test', siws('jup.ag'));
    w.show();
    expect(await screen.findByText('This sign-in message names jup.ag, not this site (dapp.test).')).toBeTruthy();
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
    fireEvent.click(cta('Reject'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('signing-in-progress: "Signing", "Signing…" with the ring, the card at .55 and the message at .7, every CTA and ✕ disabled', async () => {
    const w = await openWindow();
    const {requestId} = await w.sign('https://jup.ag', 'jup.ag asks you to approve the following terms.');
    const s = await readDappSession(w.ext);
    await w.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.requestId === requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(w.ext).instance, decidingAt: w.deps.clock.t} : e))});
    w.show();
    const busy = await screen.findByRole('button', {name: 'Signing…'});
    expect(text('.top-bar .title')).toBe('Signing');
    expect([(busy as HTMLButtonElement).disabled, busy.querySelector('.app-ring-spinner') !== null]).toEqual([true, true]);
    expect((cta('Reject') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Close'}) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.app-origin-slot')?.className).toBe('app-origin-slot app-busy-dim');
    expect(document.querySelector('.s9-msg-card')?.className).toBe('s9-msg-card app-busy-dim-msg');
    expect(document.querySelector('.app-approve-lede')).toBeNull();
    expect(document.querySelector('.s9-disclaimer')).toBeNull();
    expect(document.querySelector('.s9-struct-alert')).not.toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('✕ and [Reject] reject; the window moves on', async () => {
    const w = await openWindow();
    const a = await w.sign('https://jup.ag', 'one');
    const b = await w.sign('https://dapp.test', 'two');
    w.show();
    await screen.findByText('Sign this message?');
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    await waitFor(() => expect(text('.s9-msg-preview')).toBe('two'));
    fireEvent.click(cta('Reject'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect([a.page.answersFor(a.requestId), b.page.answersFor(b.requestId)]).toEqual([[{requestId: a.requestId, error: 'rejected'}], [{requestId: b.requestId, error: 'rejected'}]]);
  });
});
````

Modify `extension/src/approve/__tests__/windowHarness.tsx`:

````diff
diff --git a/extension/src/approve/__tests__/windowHarness.tsx b/extension/src/approve/__tests__/windowHarness.tsx
--- a/extension/src/approve/__tests__/windowHarness.tsx
+++ b/extension/src/approve/__tests__/windowHarness.tsx
@@ -1,6 +1,7 @@
 import {render} from '@testing-library/react';
 import {ed25519} from '@noble/curves/ed25519.js';
 import {base58, base64} from '@scure/base';
+import {GRANTS_KEY} from '../../background/dapp/grants';
 import {Approve} from '../Approve';
 import {createClient, type ApproveClient} from '../client';
 import {handleMessage} from '../../background/messages';
@@ -51,11 +52,20 @@ export async function openWindow(o: {unlocked?: boolean} = {}) {
     const r = await page.ask({type: 'page.connect', id: `c${tab}`, silent: false});
     return {page, requestId: String(r?.requestId)};
   };
+  /** A page holding a session-free persistent grant for ACCOUNT that asks to sign `message` (UTF-8). */
+  const sign = async (origin: string, message: string): Promise<{page: Page; requestId: string}> => {
+    const grants = ((await ext.local.get(GRANTS_KEY)) as unknown[] | undefined) ?? [];
+    await ext.local.set(GRANTS_KEY, [...grants, {origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
+    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
+    const r = await page.ask({type: 'page.signMessage', id: `s${tab}`, account: ACCOUNT.publicKey, message: base64.encode(new TextEncoder().encode(message))});
+    if (r?.accepted !== true) throw new Error(`sign request not queued: ${JSON.stringify(r)}`);
+    return {page, requestId: String(r.requestId)};
+  };
   const show = () =>
     render(
       <div className="app app-window">
         <Approve client={client} close={() => void (closed.n += 1)} />
       </div>,
     );
-  return {ext, deps, client, closed, sent, connect, show, unlock: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, {...approve, url: `${ext.extensionOrigin}/unlock.html`}, deps)};
+  return {ext, deps, client, closed, sent, connect, sign, show, unlock: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, {...approve, url: `${ext.extensionOrigin}/unlock.html`}, deps)};
 }
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/approve/__tests__/sign.test.tsx
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  1 failed (1) · Tests  7 failed (7). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/approve/Approve.tsx`:

````diff
diff --git a/extension/src/approve/Approve.tsx b/extension/src/approve/Approve.tsx
--- a/extension/src/approve/Approve.tsx
+++ b/extension/src/approve/Approve.tsx
@@ -2,6 +2,7 @@ import {useCallback, useEffect, useRef, useState} from 'react';
 import type {ApproveClient, Decision, PendingView} from './client';
 import {Connect} from './Connect';
 import {Locked} from './Locked';
+import {Sign} from './Sign';
 
 /** §2.3 (review 2 M3, review 1 L1): the window polls this often while it shows anything — so an unlock, an expiry or a new head reaches it. */
 export const POLL_MS = 1_000;
@@ -71,6 +72,7 @@ export function Approve({client, close}: {client: ApproveClient; close: () => vo
   if (view === null || view.state === 'none' || request === null) return <div className="screen app-approve" aria-busy="true" />;
   if (view.state === 'locked') return <Locked request={request} waiting={view.waiting} onReject={() => decide({decision: 'reject'})} />;
   const inProgress = busy || view.state === 'deciding';
-  // A new head is a new screen: its gates, scope and account start over (keyed by request).
+  // A new head is a new screen: its gates, scope, account and confirm start over (keyed by request).
+  if (request.type === 'signMessage') return <Sign key={request.requestId} request={request} waiting={view.waiting} notice={view.windowNotice} busy={inProgress} onDecide={decide} />;
   return <Connect key={request.requestId} request={request} waiting={view.waiting} notice={view.windowNotice} busy={inProgress} onDecide={decide} />;
 }
````

Create `extension/src/approve/Sign.tsx`:

````tsx
import {useState, type ReactNode} from 'react';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import type {Decision, RequestView} from './client';
import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop} from './ui';
import {useArmed} from './useArmed';
import {SIGN_TEXT, WINDOW_TEXT} from './strings';

/** The message as text, with the background's ranges <mark>ed (rule 6's keyword; a lookalike's homoglyphs). */
function preview(text: string, marks: readonly {start: number; end: number}[]): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const [i, m] of marks.entries()) {
    if (m.start < at) continue;
    if (m.start > at) out.push(text.slice(at, m.start));
    out.push(<mark key={i}>{text.slice(m.start, m.end)}</mark>);
    at = m.end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/**
 * #46 sign-message (spec §3.2 steps 4–7; index.html ix:17442-17686), every state the spec builds:
 *  - idle: "Signature request", the origin card (verified / unknown), "Message · UTF-8 (n chars)", the message as text in
 *    mono (scrollable), the disclaimer, [Reject] + [Sign];
 *  - the structured-approval alert when a keyword fired (rule 6): the design's head and body, the word marked, the label
 *    "Message · with structured-approval flag";
 *  - lookalike: "Suspicious origin", the short lede, the banner, "Message preview" with every homoglyph marked, [Reject
 *    and report] primary and "Sign anyway (not recommended)" → the 2-second confirm — only "I understand the risk" signs;
 *  - a sign-in message for another domain (rule 3): the red banner Q20 and no Sign — only [Reject];
 *  - signing: "Signing", "Signing…" with the ring, the origin card at .55 and the message at .7, every CTA and ✕ off.
 * C15 holds Sign, Sign anyway and I understand the risk; Reject is never held.
 */
export function Sign({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
  const detail = request.sign;
  const lookalike = request.site.kind === 'lookalike';
  const [confirming, setConfirming] = useState(false);
  const armed = useArmed([request.requestId, confirming].join('|'));
  if (detail === null) return null;
  const mismatch = detail.siwsMismatch;
  const sign = () => onDecide({decision: 'approve', account: detail.account.publicKey});
  const reject = () => onDecide({decision: 'reject'});
  const label = lookalike ? SIGN_TEXT.labelLookalike : detail.keyword !== null ? SIGN_TEXT.labelKeyword : SIGN_TEXT.label(detail.chars);
  return (
    <div className="screen app-approve">
      <WindowTop overline={busy ? SIGN_TEXT.overlineSigning : lookalike ? SIGN_TEXT.overlineLookalike : SIGN_TEXT.overline} tone={busy ? 'neutral' : lookalike ? 'danger' : 'neutral'} onClose={reject} disabled={busy} />
      <div className="scroll-area app-approve-scroll">
        {notice ? <BudgetNotice /> : null}
        <h1 className="noc-h1 app-approve-title">{SIGN_TEXT.title}</h1>
        {busy ? null : <p className="noc-body-sm app-muted app-approve-lede">{lookalike ? SIGN_TEXT.ledeShort : SIGN_TEXT.lede}</p>}
        <div className={busy ? 'app-origin-slot app-busy-dim' : 'app-origin-slot'}>
          <OriginCard site={request.site} origin={request.origin} host={request.host} />
        </div>
        {lookalike ? <LookalikeBanner site={request.site} host={request.host} /> : null}
        {mismatch !== null ? (
          <div className="s9-domain-warn" role="alert">
            <ExtIcon name="alert-triangle" size={20} />
            <div className="body">{SIGN_TEXT.siwsMismatch(mismatch, request.host)}</div>
          </div>
        ) : null}
        {detail.keyword !== null ? (
          <div className="s9-struct-alert" role="alert">
            <ExtIcon name="alert-triangle" size={20} />
            <div>
              <p className="head">{SIGN_TEXT.alertHead}</p>
              <p className="body">
                {SIGN_TEXT.alertLead}
                <code className="noc-mono noc-warning">{detail.keyword}</code>
                {SIGN_TEXT.alertTail}
              </p>
            </div>
          </div>
        ) : null}
        <div className={busy ? 's9-msg-card app-busy-dim-msg' : 's9-msg-card'}>
          <span className="label">{label}</span>
          <div className="s9-msg-preview" tabIndex={0}>
            {preview(detail.text, detail.marks)}
          </div>
        </div>
        {busy ? null : (
          <div className="s9-disclaimer">
            <ExtIcon name="info" size={16} />
            <p>{SIGN_TEXT.disclaimer(request.site.name)}</p>
          </div>
        )}
      </div>
      {request.offerBlock && !busy ? <BlockSite onBlock={() => onDecide({decision: 'block'})} /> : null}
      <Waiting n={waiting} />
      {mismatch !== null ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-secondary" onPress={reject}>
            {WINDOW_TEXT.reject}
          </LockedButton>
        </div>
      ) : lookalike && !busy ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-primary app-btn-danger" onPress={() => onDecide({decision: 'report'})}>
            <ExtIcon name="close" size={18} />
            {WINDOW_TEXT.rejectAndReport}
          </LockedButton>
          <ConfirmButton armed={armed} className="btn btn-tertiary noc-body-sm app-dim" onPress={() => setConfirming(true)}>
            {SIGN_TEXT.signAnyway}
          </ConfirmButton>
        </div>
      ) : (
        <div className="sticky-bar row">
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={busy}>
            {WINDOW_TEXT.reject}
          </LockedButton>
          {busy ? (
            <button type="button" className="btn btn-primary app-cta-wide" disabled>
              <Spinner />
              {SIGN_TEXT.signing}
            </button>
          ) : (
            <ConfirmButton armed={armed} className="btn btn-primary app-cta-wide" onPress={sign}>
              <ExtIcon name="key" size={18} />
              {SIGN_TEXT.sign}
            </ConfirmButton>
          )}
        </div>
      )}
      {confirming ? (
        <RiskConfirm
          onCancel={() => setConfirming(false)}
          onProceed={async () => {
            setConfirming(false);
            await sign();
          }}
        />
      ) : null}
    </div>
  );
}
````

Modify `extension/src/approve/strings.ts`:

````diff
diff --git a/extension/src/approve/strings.ts b/extension/src/approve/strings.ts
--- a/extension/src/approve/strings.ts
+++ b/extension/src/approve/strings.ts
@@ -87,3 +87,24 @@ export const CONNECT_TEXT = {
   /** Q16. */
   cap: 'You have 200 connected apps. Revoke one in Settings first.',
 } as const;
+
+export const SIGN_TEXT = {
+  overline: 'Signature request',
+  overlineLookalike: 'Suspicious origin',
+  overlineSigning: 'Signing',
+  title: 'Sign this message?',
+  lede: 'A signature proves you control this wallet. It does not move funds and does not broadcast a transaction.',
+  ledeShort: 'A signature proves you control this wallet.',
+  label: (chars: number): string => `Message · UTF-8 (${chars} chars)`,
+  labelLookalike: 'Message preview',
+  labelKeyword: 'Message · with structured-approval flag',
+  disclaimer: (name: string): string => `This won't broadcast or move funds. ${name} will use the signature only to verify you own this wallet.`,
+  alertHead: 'This message includes an authorization',
+  alertLead: 'Detected keyword: ',
+  alertTail: ". Even though signing won't broadcast, the dApp may use this signature off-chain to authorize a future action. Read the full message before signing.",
+  /** Q20. */
+  siwsMismatch: (domain: string, host: string): string => `This sign-in message names ${domain}, not this site (${host}).`,
+  sign: 'Sign',
+  signing: 'Signing…',
+  signAnyway: 'Sign anyway (not recommended)',
+} as const;
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run src/approve/__tests__/sign.test.tsx
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  1 passed (1) · Tests  7 passed (7); tsc clean; whole suite Test Files  152 passed (152) · Tests  3018 passed (3018); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M9a** — the marks not drawn — `extension/src/approve/Sign.tsx`:

  ```diff
  -             {preview(detail.text, detail.marks)}
  +             {detail.text}{void preview}
  ```
  `timeout 300 npx vitest run src/approve/__tests__/sign.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 5 passed (7)).

- **M9b** — Sign offered on a SIWS mismatch — `extension/src/approve/Sign.tsx`:

  ```diff
  -       {mismatch !== null ? (
  -         <div className="sticky-bar">
  +       {false ? (
  +         <div className="sticky-bar">
  ```
  `timeout 300 npx vitest run src/approve/__tests__/sign.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 6 passed (7)).

- **M9c** — Sign anyway signs without the confirm — `extension/src/approve/Sign.tsx`:

  ```diff
  - onPress={() => setConfirming(true)}>
  + onPress={sign}>
  ```
  `timeout 300 npx vitest run src/approve/__tests__/sign.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 6 passed (7)).

- **M9d** — I understand the risk enabled at once — `extension/src/approve/ui.tsx`:

  ```diff
  - export const CONFIRM_DELAY_MS = 2_000;
  + export const CONFIRM_DELAY_MS = 0;
  ```
  `timeout 300 npx vitest run src/approve/__tests__/sign.test.tsx src/approve/__tests__/connect.test.tsx` — Expected: **red** (dry run: red, Test Files  2 failed (2) · Tests  3 failed | 24 passed (27)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/approve/Approve.tsx extension/src/approve/Sign.tsx extension/src/approve/__tests__/sign.test.tsx extension/src/approve/__tests__/windowHarness.tsx extension/src/approve/strings.ts
git commit -F - <<'MSG'
feat(extension): B1c #46 sign-message in every state

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 10: #49 connected apps in every state (populated, sort, the detail sheet, revoke with the undo toast, hold to disconnect all, blocked sites, empty, skeleton, failed); #31's Connected dApps row (Q07); #37's bullet (Q08)

**Spec:** §4.1, §4.2, §4.4 (all), §2.7 (the popup holds only the token), §9 (#49 rows), D1, D3, D9, C6, C7; §6.1 "Screens" (#49); Scope R21–R27; plan review 1 L5; Scope R35

**Files:**
- Test: `extension/e2e/visual-contacts.spec.ts`
- Test: `extension/e2e/visual.spec.ts`
- Modify: `extension/src/app/App.tsx`
- Test: `extension/src/app/__tests__/ConnectedApps.test.tsx` (new)
- Test: `extension/src/app/__tests__/DeleteWallet.test.tsx`
- Test: `extension/src/app/__tests__/Settings.test.tsx`
- Test: `extension/src/app/__tests__/Switcher.test.tsx`
- Test: `extension/src/app/__tests__/router.test.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/engine.ts`
- Modify: `extension/src/app/router.ts`
- Create: `extension/src/app/screens/ConnectedApps.tsx`
- Modify: `extension/src/app/screens/DeleteWallet.tsx`
- Modify: `extension/src/app/screens/Settings.tsx`
- Modify: `extension/src/app/ui/ExtIcon.tsx`
- Modify: `extension/src/app/ui/HoldButton.tsx`

**Interfaces:**
- Consumes: Task 4's `dapp.grants.*` / `dapp.blocked.*`; B1b's `renderInWallet`, `whenText`, `ago`, `LockedButton`, `HoldButton`, `useEscape`, `useNow`, `ListRow`.
- Produces (as exported):
  - `engine.ts`: `interface DappInteraction`, `interface DappGrant`, `interface DappBlocked`, `type DappUndoError`; `Engine.dappGrants()`, `dappRevoke(origin)`, `dappUndo(token)`, `dappRevokeAll()`, `dappBlocked()`, `dappUnblock(host)`.
  - `router.ts`: `{screen: 'connected'}` (bare).
  - `screens/ConnectedApps.tsx`: `CONNECTED_TEXT`, `DISCONNECT_ALL_MS = 600`, `UNDO_MS = 5_000`, `isoDay(at)`, `siteLabel(origin, host)` (rev 2), `initialsOf(name)`, `TILES`, `tileOf(host)`, `ConnectedApps({onBack, clock?})`.
  - `HoldButton`: `heldLabel?`, `decimals?`; `ExtIcon`: `plug`, `sort`, `unlink`.
  - `Settings`: `onConnected` prop; `SETTINGS_TEXT.connectedDapps`, `connectedCount(n)`.
  - `DeleteWallet`: `DELETE_TEXT.bulletErased` with Q08.

#49 on the design's `.s10-*` classes: the top bar with `.noc-h1-compact` and the Sort button; "<n> active sessions" and the sort caption; each row — the initials tile (C6, a gradient from the host), C7's name with the verified dot for a known-list domain (§9), the domain in mono, "Connected <YYYY-MM-DD> · last used <when>" (B1b's `whenText`), the "This session" pill (Q10) — and [Revoke]: the row leaves at once, the design's toast "<name> revoked · undo · <s> s · UNDO" for five seconds, single-shot (the background holds the record, §2.7). A row tap opens 49c's sheet (permissions with the grant date, the session cells, the last three interactions, [Revoke this connection] — no hold). "Hold to disconnect all · <n> sessions" is #49's own 600 ms hold (rows at .55, per-row Revoke off, "Hold to revoke all", the helper, the count to two places); no undo. Blocked sites (D3, Q13) sit below the list with [Unblock]; empty is "No connected apps" + Q14 with the disabled "Disconnect all" and no Browse button (D1); the skeleton is 49e's five rows; a failed read is Q15 with [Try again]. Every read checks it is the newest and the screen is mounted; the list re-reads on focus. #31 gains "Connected dApps" (`#i-plug`) above Address book with Q07's meta (empty when none or refused); #37's bullet gains Q08 (R31). B1b's E2E that pin #31's rows and #37's bullet are updated with it.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/visual-contacts.spec.ts`:

````diff
diff --git a/extension/e2e/visual-contacts.spec.ts b/extension/e2e/visual-contacts.spec.ts
--- a/extension/e2e/visual-contacts.spec.ts
+++ b/extension/e2e/visual-contacts.spec.ts
@@ -273,7 +273,7 @@ test('visual: #31’s Address book row, #15’s states and the contact sheet (41
     // #37 · the plan-2 bullet: the address book is erased with the rest.
     await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
     const bullet = p.locator('.app-delete-bullets li').nth(1);
-    await expect(bullet).toHaveText('Local settings, cached balances, your address book and the list of addresses you have sent to are erased and not recoverable.');
+    await expect(bullet).toHaveText('Local settings, cached balances, your address book, the list of addresses you have sent to, and dApp connections and blocked sites are erased and not recoverable.');
     await pop(p, '37a-bullet-address-book', bullet);
     await p.close();
 
````

Modify `extension/e2e/visual.spec.ts`:

````diff
diff --git a/extension/e2e/visual.spec.ts b/extension/e2e/visual.spec.ts
--- a/extension/e2e/visual.spec.ts
+++ b/extension/e2e/visual.spec.ts
@@ -95,7 +95,7 @@ test('visual: the plan-1 screens and states at 412 × 600', async () => {
     await p.getByRole('button', {name: 'Settings'}).click();
     // B1b-2b plan 1 (#31 in full) and plan 2 (Connections › Address book): the rows of every group; visual-settings.spec.ts
     // and visual-contacts.spec.ts shoot their states.
-    await expect(p.locator('.s7-row .s7-title')).toHaveText(['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Address book', 'Delete wallet', 'About Noctura']);
+    await expect(p.locator('.s7-row .s7-title')).toHaveText(['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura']);
     await shot(p, '31-settings-minimal');
     await p.getByText('About Noctura').click();
     await expect(p.getByText('Solana wallet for your browser — your keys stay on this device.')).toBeVisible();
````

Create `extension/src/app/__tests__/ConnectedApps.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {ConnectedApps, initialsOf, isoDay, tileOf} from '../screens/ConnectedApps';
import {renderInWallet} from './harness';
import type {HoldClock} from '../ui/HoldButton';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {GRANTS_KEY, type Grant} from '../../background/dapp/grants';
import {BLOCKED_KEY} from '../../background/dapp/blocked';
import {DAPP_SESSION_KEY, EMPTY_SESSION} from '../../background/dapp/store';
import {ACCOUNT} from '../../background/__tests__/fixtures';

// B1c §4.4 (#49, index.html ix:18705-19100; D1, D3, D9, C6, C7) against the real background.
const SELECTORS = selectorsOf(UI_SHEETS);
const DAY = 86_400_000;
const NOW = new Date(new Date().setHours(12, 0, 0, 0)).getTime();
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: NOW - 30 * DAY, lastUsedAt: NOW, recent: [], ...over});
const GRANTS = [
  grant('https://tensor.trade', {connectedAt: NOW - 40 * DAY, lastUsedAt: NOW - 2 * DAY, recent: [{type: 'signMessage', at: NOW - 2 * DAY, outcome: 'approved'}, {type: 'connect', at: NOW - 40 * DAY, outcome: 'approved'}]}),
  grant('https://jup.ag', {lastUsedAt: NOW}),
];
async function seed(ext: {local: {set(k: string, v: unknown): Promise<void>}; session: {set(k: string, v: unknown): Promise<void>}}, o: {session?: boolean; blocked?: boolean} = {}) {
  await ext.local.set(GRANTS_KEY, GRANTS);
  if (o.session === true) await ext.session.set(DAPP_SESSION_KEY, {...EMPTY_SESSION, grants: [grant('https://solana-mint-hub.xyz', {scope: 'session', lastUsedAt: NOW - DAY})]});
  if (o.blocked === true) await ext.local.set(BLOCKED_KEY, [{host: 'tensr.trade', blockedAt: NOW - DAY, imitates: 'tensor.trade'}]);
}
function manualClock() {
  let t = 0;
  const jobs = new Set<() => void>();
  const clock: HoldClock = {now: () => t, every: (_ms, f) => (jobs.add(f), () => void jobs.delete(f))};
  return {clock, advance: (ms: number) => act(() => {
    for (let step = 0; step < ms; step += 30) {
      t += 30;
      for (const f of [...jobs]) f();
    }
  })};
}
const rows = () => [...document.querySelectorAll('.s10-app-row')].filter(r => r.querySelector('.name') !== null) as HTMLElement[];
const show = (o: {session?: boolean; blocked?: boolean; empty?: boolean} = {}, clock = manualClock().clock, now: () => number = () => NOW) =>
  renderInWallet(<ConnectedApps onBack={() => undefined} clock={clock} />, {now, before: async ext => (o.empty === true ? undefined : seed(ext, o))});

describe('#49 connected apps — populated, sort, detail sheet', () => {
  it('49a: "<n> active sessions", the rows — initials tile, name, verified dot (known list only), domain, Connected <date> · last used <when>, the "This session" pill — newest use first', async () => {
    await show({session: true});
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.getByText('Connected apps', {selector: '.top-bar .title.noc-h1-compact'})).toBeTruthy();
    expect(document.querySelector('.s10-summary-bar .count')?.textContent).toBe('3 active sessions');
    expect(document.querySelector('.s10-summary-bar .sort')?.textContent).toBe('Sorted by last used');
    expect(rows().map(r => [r.querySelector('.ico')?.textContent, r.querySelector('.name')?.textContent, r.querySelector('.verified-dot') !== null, r.querySelector('.domain')?.textContent])).toEqual([
      ['JU', 'Jupiter', true, 'jup.ag'],
      ['SM', 'solana-mint-hub', false, 'solana-mint-hub.xyz'],
      ['TE', 'Tensor', true, 'tensor.trade'],
    ]);
    expect(rows()[0]?.querySelector('.meta')?.textContent).toBe(`Connected ${isoDay(NOW - 30 * DAY)} · last used today`);
    expect(rows()[1]?.querySelector('.meta')?.textContent).toBe(`Connected ${isoDay(NOW - 30 * DAY)} · last used yesterdayThis session`);
    expect(rows()[1]?.querySelector('.badge.app-session-pill')?.textContent).toBe('This session');
    expect(rows()[0]?.querySelector('.ico')?.className).toBe(`ico ${tileOf('jup.ag')}`);
    expect(screen.getAllByRole('button', {name: 'Revoke'})).toHaveLength(3);
    expect(document.querySelector('.sticky-bar .btn')?.textContent).toBe('Hold to disconnect all · 3 sessions');
    expect(unstyledClasses(document.querySelector('.app-connected')!, SELECTORS)).toEqual([]);
  });

  it('the Sort button toggles "Sorted by name" and the order', async () => {
    // Tensor used last, so the two orders differ (with GRANTS above they coincide, and a Sort that sorts nothing passes).
    const twoOrders = [grant('https://jup.ag', {lastUsedAt: NOW - 2 * DAY}), grant('https://tensor.trade', {lastUsedAt: NOW})];
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {now: () => NOW, before: async ext => ext.local.set(GRANTS_KEY, twoOrders)});
    await waitFor(() => expect(rows()).toHaveLength(2));
    const names = () => rows().map(r => r.querySelector('.name')?.textContent);
    expect(names()).toEqual(['Tensor', 'Jupiter']);
    fireEvent.click(screen.getByRole('button', {name: 'Sort'}));
    expect(document.querySelector('.s10-summary-bar .sort')?.textContent).toBe('Sorted by name');
    expect(names()).toEqual(['Jupiter', 'Tensor']);
    fireEvent.click(screen.getByRole('button', {name: 'Sort'}));
    expect(document.querySelector('.s10-summary-bar .sort')?.textContent).toBe('Sorted by last used');
    expect(names()).toEqual(['Tensor', 'Jupiter']);
  });

  it('an origin with an explicit port: the row and the sheet show host:port (review 1 L5); one without, the host', async () => {
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {now: () => NOW, before: async ext => ext.local.set(GRANTS_KEY, [grant('https://dapp.test:8443'), grant('https://jup.ag', {lastUsedAt: NOW - DAY})])});
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows().map(r => r.querySelector('.domain')?.textContent)).toEqual(['dapp.test:8443', 'jup.ag']);
    fireEvent.click(rows()[0]!.querySelector('.app-row-open')!);
    expect((await screen.findByRole('dialog')).querySelector('.domain')?.textContent).toBe('dapp.test:8443');
  });

  it('49c: a row tap opens the detail sheet — permissions with the grant date, the session cells, the last interactions', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[1]!);
    const sheet = await screen.findByRole('dialog', {name: 'Tensor'});
    expect(within(sheet).getByText('tensor.trade')).toBeTruthy();
    expect(sheet.querySelector('.app-verified-dot')).not.toBeNull();
    expect([...sheet.querySelectorAll('.group-label')].map(e => e.textContent)).toEqual(['Permissions', 'Session', 'Last 3 interactions']);
    expect([...sheet.querySelectorAll('.s10-perm-row')].map(r => [r.querySelector('.pri')?.textContent, r.querySelector('.sub')?.textContent, r.querySelector('.ts')?.textContent])).toEqual([
      ['Read public keys', 'Granted at connect — view-only', isoDay(NOW - 40 * DAY)],
      ['Sign transactions (with prompt)', 'Each request asks before signing', isoDay(NOW - 40 * DAY)],
      ['Sign messages (with prompt)', 'Each request asks before signing', isoDay(NOW - 40 * DAY)],
    ]);
    expect([...sheet.querySelectorAll('.s10-meta-grid .cell')].map(c => [c.querySelector('.k')?.textContent, c.querySelector('.v')?.textContent])).toEqual([
      ['Connected', isoDay(NOW - 40 * DAY)],
      ['Last used', '2 days ago'],
      ['Scope', 'Until revoked'],
    ]);
    expect([...sheet.querySelectorAll('.s10-history .row')].map(r => [r.querySelector('.op')?.textContent, r.querySelector('.when')?.textContent])).toEqual([
      ['Sign message (approved)', '2 d ago'],
      ['Connect (approved)', '40 d ago'],
    ]);
    expect(unstyledClasses(sheet, SELECTORS)).toEqual([]);
    fireEvent.click(within(sheet).getByRole('button', {name: 'Close'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('[Revoke this connection] in the sheet revokes (no hold, rule 6) and shows the undo toast', async () => {
    const w = await show();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[0]!);
    fireEvent.click(await screen.findByRole('button', {name: 'Revoke this connection'}));
    await waitFor(() => expect(screen.getByText('Jupiter revoked')).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[]).map(g => g.origin)).toEqual(['https://tensor.trade']);
  });
});

describe('#49 revoke and undo (§2.7, 49e)', () => {
  it('Revoke: the row leaves at once, the toast says "<name> revoked · undo · 5 s"; UNDO restores exactly that grant, single-shot', async () => {
    const w = await show();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rows()[0]!).getByRole('button', {name: 'Revoke'}));
    expect(rows().map(r => r.querySelector('.name')?.textContent)).toEqual(['Tensor']);
    const toast = await screen.findByRole('status');
    expect([toast.querySelector('.body')?.textContent, toast.querySelector('.timer')?.textContent, toast.querySelector('.undo-btn')?.textContent]).toEqual(['Jupiter revoked', 'undo · 5 s', 'UNDO']);
    expect(unstyledClasses(toast, SELECTORS)).toEqual([]);
    fireEvent.click(within(toast).getByRole('button', {name: 'UNDO'}));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByText('Jupiter revoked')).toBeNull();
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[]).map(g => g.origin).sort()).toEqual(['https://jup.ag', 'https://tensor.trade']);
  });

  it('the countdown runs on the clock and the toast goes after five seconds (the grant stays revoked)', async () => {
    let t = NOW;
    await show({}, manualClock().clock, () => t);
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rows()[0]!).getByRole('button', {name: 'Revoke'}));
    await screen.findByText('undo · 5 s');
    t += 2_100;
    expect(await screen.findByText('undo · 3 s', {}, {timeout: 1_500})).toBeTruthy();
    t += 3_000;
    await waitFor(() => expect(screen.queryByText('Jupiter revoked')).toBeNull(), {timeout: 1_500});
    expect(rows().map(r => r.querySelector('.name')?.textContent)).toEqual(['Tensor']);
  });
});

describe('#49 disconnect all (49d) — the 600 ms hold', () => {
  it('while held: rows at .55, per-row Revoke off, "Hold to revoke all", the helper, the count in two places; released early nothing happens; held 600 ms every grant goes', async () => {
    const c = manualClock();
    const w = await show({session: true}, c.clock);
    await waitFor(() => expect(rows()).toHaveLength(3));
    const hold = document.querySelector('.sticky-bar .btn') as HTMLButtonElement;
    fireEvent.pointerDown(hold, {button: 0});
    c.advance(360);
    expect(rows().every(r => r.className === 's10-app-row app-row-dim')).toBe(true);
    expect(screen.getAllByRole('button', {name: 'Revoke'}).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    expect([document.querySelector('.s10-summary-bar .sort')?.textContent, document.querySelector('.s10-summary-bar .sort')?.className]).toEqual(['Hold to revoke all', 'sort app-hold-note']);
    expect(screen.getByText('All 3 sessions will be wiped · release the button to cancel')).toBeTruthy();
    expect(hold.textContent).toBe('Hold to disconnect all · 0.24 s');
    fireEvent.pointerUp(hold);
    expect(hold.textContent).toBe('Hold to disconnect all · 3 sessions');
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[])).toHaveLength(2);
    fireEvent.pointerDown(hold, {button: 0});
    c.advance(630);
    await screen.findByText('No connected apps');
    expect(await w.ext.local.get(GRANTS_KEY)).toEqual([]);
  });
});

describe('#49 empty, blocked sites, loading, failure', () => {
  it('49b empty: "No connected apps", Q14 — no Browse button (D1) — and Disconnect all disabled', async () => {
    await show({empty: true});
    expect(await screen.findByText('No connected apps')).toBeTruthy();
    expect(screen.getByText('When you connect a site, it appears here.')).toBeTruthy();
    expect(screen.queryByText(/Browse/)).toBeNull();
    const all = screen.getByRole('button', {name: 'Disconnect all'}) as HTMLButtonElement;
    expect([all.disabled, all.className]).toEqual([true, 'btn btn-primary app-delete-gated']);
    expect(screen.queryByRole('button', {name: 'Sort'})).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-connected')!, SELECTORS)).toEqual([]);
  });

  it('blocked sites (D3, Q13): the host in mono, "Blocked <date>", "Looked like <domain>", [Unblock] — which removes only the block', async () => {
    const w = await show({blocked: true});
    expect(await screen.findByText('Blocked sites')).toBeTruthy();
    const row = screen.getByText('tensr.trade').closest('.s10-app-row') as HTMLElement;
    expect(row.querySelector('.meta')?.textContent).toBe(`Blocked ${isoDay(NOW - DAY)}Looked like tensor.trade`);
    fireEvent.click(within(row).getByRole('button', {name: 'Unblock'}));
    await waitFor(() => expect(screen.queryByText('Blocked sites')).toBeNull());
    expect(await w.ext.local.get(BLOCKED_KEY)).toEqual([]);
  });

  it('the skeleton while it reads (49e: five rows), then the list', async () => {
    let release = () => undefined as void;
    const held = new Promise<void>(r => (release = r));
    renderInWallet(<ConnectedApps onBack={() => undefined} />, {now: () => NOW, before: ext => seed(ext), gate: m => ((m as {type: string}).type === 'dapp.grants.list' ? held : undefined)});
    await waitFor(() => expect(document.querySelectorAll('.s10-skel-row')).toHaveLength(5));
    expect(unstyledClasses(document.querySelector('.app-connected')!, SELECTORS)).toEqual([]);
    release();
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it('a failed read: Q15 and Try again', async () => {
    renderInWallet(<ConnectedApps onBack={() => undefined} />, {now: () => NOW, gate: m => ((m as {type: string}).type === 'dapp.grants.list' ? Promise.reject(new Error('down')) : undefined)});
    expect(await screen.findByText('Could not load your connections. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Try again'})).toBeTruthy();
  });

  it('initials (C6) and the tile gradient are the host’s, deterministic', () => {
    expect([initialsOf('Magic Eden'), initialsOf('Tensor'), initialsOf('solana-mint-hub'), initialsOf('x')]).toEqual(['ME', 'TE', 'SM', 'X']);
    expect(tileOf('jup.ag')).toBe(tileOf('jup.ag'));
  });
});
````

Modify `extension/src/app/__tests__/DeleteWallet.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/DeleteWallet.test.tsx b/extension/src/app/__tests__/DeleteWallet.test.tsx
--- a/extension/src/app/__tests__/DeleteWallet.test.tsx
+++ b/extension/src/app/__tests__/DeleteWallet.test.tsx
@@ -98,7 +98,7 @@ function hold(type: string, match: (m: Record<string, unknown>) => boolean = ()
 }
 
 describe('#37 delete wallet', () => {
-  it('37a idle: the adapted copy, the two bullets (no staking, no dApps, no backup file), the typed field, the CTA greyed and disabled', async () => {
+  it('37a idle: the adapted copy, the two bullets (no staking, no backup file; dApp connections from B1c), the typed field, the CTA greyed and disabled', async () => {
     await shown();
     expect(screen.getByText('Delete wallet', {selector: '.top-bar .title'})).toBeTruthy();
     expect(document.querySelector('.app-delete-card .noc-body')?.textContent).toBe('This removes all encrypted keys and local data from this browser.');
@@ -106,10 +106,10 @@ describe('#37 delete wallet', () => {
     const bullets = [...document.querySelectorAll('.app-delete-bullets li')].map(li => li.textContent);
     expect(bullets).toEqual([
       "Your assets won't be lost on-chain — but you'll need your recovery phrase to access them again.",
-      // Plan 2 (spec §5): the address book is erased with the rest (D20).
-      'Local settings, cached balances, your address book and the list of addresses you have sent to are erased and not recoverable.',
+      // Plan 2 (spec §5): the address book is erased with the rest (D20); B1c §4.2 (Q08): and the dApp connections.
+      'Local settings, cached balances, your address book, the list of addresses you have sent to, and dApp connections and blocked sites are erased and not recoverable.',
     ]);
-    expect(document.body.textContent).not.toMatch(/staking|dApp|backup file|seed phrase/);
+    expect(document.body.textContent).not.toMatch(/staking|backup file|seed phrase/);
     expect(document.querySelector('.app-delete-eyebrow')?.textContent).toBe('Type DELETE to confirm');
     expect(field().getAttribute('autocapitalize')).toBe('characters');
     expect(field().getAttribute('autocomplete')).toBe('off');
````

Modify `extension/src/app/__tests__/Settings.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Settings.test.tsx b/extension/src/app/__tests__/Settings.test.tsx
--- a/extension/src/app/__tests__/Settings.test.tsx
+++ b/extension/src/app/__tests__/Settings.test.tsx
@@ -10,6 +10,8 @@ import {join} from 'node:path';
 import {PASSWORD_TOAST_KEY, readPref} from '../prefs';
 import {SETTINGS_KEY} from '../../background/settings';
 import {CONTACTS_KEY} from '../../background/contacts';
+import {GRANTS_KEY} from '../../background/dapp/grants';
+import {ACCOUNT} from '../../background/__tests__/fixtures';
 import {base58, base64} from '@scure/base';
 import {Settings} from '../screens/Settings';
 import {WalletProvider} from '../WalletContext';
@@ -31,14 +33,14 @@ async function openSettings(o: Parameters<typeof renderApp>[0] = {}) {
 }
 
 describe('Settings (#31, B1b-2b §4.1)', () => {
-  it('the groups and rows the extension has (D22): Account › Profile; Security › Security center, Passkey, Change password, Recovery phrase, Lock now; Connections › Address book (plan 2); Advanced › Delete wallet; About', async () => {
+  it('the groups and rows the extension has (D22): Account › Profile; Security › Security center, Passkey, Change password, Recovery phrase, Lock now; Connections › Connected dApps (B1c), Address book (plan 2); Advanced › Delete wallet; About', async () => {
     await openSettings();
     expect(screen.getAllByText(/^(Account|Security|Connections|Advanced|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'Connections', 'Advanced', 'About']);
     expect([...document.querySelectorAll('.s7-row .s7-title')].map(e => e.textContent)).toEqual([
-      'Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Address book', 'Delete wallet', 'About Noctura',
+      'Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura',
     ]);
     expect(screen.getByText('v0.1.0')).toBeTruthy();
-    for (const gone of ['Currency', 'Notifications', 'Material You accent', 'RPC endpoint', 'Connected dApps', 'Air-gap signing', 'Export transaction history', 'Diagnostics', 'Backup & restore', 'Biometric unlock', 'Change PIN', 'Accounts']) {
+    for (const gone of ['Currency', 'Notifications', 'Material You accent', 'RPC endpoint', 'Air-gap signing', 'Export transaction history', 'Diagnostics', 'Backup & restore', 'Biometric unlock', 'Change PIN', 'Accounts']) {
       expect(screen.queryByText(gone)).toBeNull();
     }
     expect(document.querySelector('.s7-row.danger .s7-title')?.textContent).toBe('Delete wallet');
@@ -102,7 +104,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, settings)});
     const {unmount} = render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} toastMs={400} decorateMs={800} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} toastMs={400} decorateMs={800} />
       </WalletProvider>,
     );
     expect(await screen.findByText('Password updated')).toBeTruthy();
@@ -116,7 +118,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     unmount();
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -129,7 +131,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() - 11 * 60_000})});
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -225,7 +227,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
   async function rows() {
     localStorage.clear();
     const w = await setupWallet();
-    const calls = {profile: 0, security: 0, passkey: 0, del: 0, about: 0, contacts: 0};
+    const calls = {profile: 0, security: 0, passkey: 0, del: 0, about: 0, contacts: 0, connected: 0};
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
         <Settings
@@ -235,6 +237,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
           onDelete={() => void calls.del++}
           onAbout={() => void calls.about++}
           onContacts={() => void calls.contacts++}
+          onConnected={() => void calls.connected++}
         />
       </WalletProvider>,
     );
@@ -248,10 +251,26 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     fireEvent.click(button);
   };
 
-  it('rule 6: Profile, Security center, Passkey, Address book, Delete wallet and About each fire once for two taps inside 500 ms', async () => {
+  it('rule 6: Profile, Security center, Passkey, Connected dApps, Address book, Delete wallet and About each fire once for two taps inside 500 ms', async () => {
     const {calls} = await rows();
-    for (const t of ['Profile', 'Security center', 'Passkey', 'Address book', 'Delete wallet', 'About Noctura']) twice(t);
-    expect(calls).toEqual({profile: 1, security: 1, passkey: 1, del: 1, about: 1, contacts: 1});
+    for (const t of ['Profile', 'Security center', 'Passkey', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura']) twice(t);
+    expect(calls).toEqual({profile: 1, security: 1, passkey: 1, del: 1, about: 1, contacts: 1, connected: 1});
+  });
+
+  // B1c §4.1 (Q07, review L12): the Connected dApps meta counts the grants dapp.grants.list answers; empty when none.
+  it.each([
+    [0, ''],
+    [1, '1 connected'],
+    [3, '3 connected'],
+  ])('Connected dApps meta with %i grants: "%s" — the #i-plug glyph', async (n, text) => {
+    await openSettings({
+      before: async ext => {
+        await ext.local.set(GRANTS_KEY, Array.from({length: n}, (_, i) => ({origin: `https://s${i}.test`, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []})));
+      },
+    });
+    const row = () => screen.getByText('Connected dApps', {selector: '.s7-title'}).parentElement;
+    await waitFor(() => expect(row()?.querySelector('.s7-meta')?.textContent).toBe(text));
+    expect(row()?.querySelector('.s7-glyph svg path')?.getAttribute('d')).toBe('M12 22v-5');
   });
 
   // Plan 2 (§4.1, ix:13552): the Address book row's meta is the book's size; a refused read leaves it empty.
@@ -302,7 +321,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     };
     const {unmount} = render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -353,7 +372,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() + 60_000})});
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
       </WalletProvider>,
     );
     await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).toBe('3 to do'));
@@ -369,7 +388,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const engine = {...w.engine, state: () => new Promise<never>(() => undefined)};
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
       </WalletProvider>,
     );
     await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).not.toBe(''));
@@ -387,7 +406,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const engine = {...w.engine, settings: () => (reads++, w.engine.settings())};
     const r = render(
       <WalletProvider engine={engine} platform={w.platform} surface={surface}>
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
       </WalletProvider>,
     );
     const meta = (t: string) => screen.getByText(t, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
@@ -438,7 +457,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     };
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="tab">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
       </WalletProvider>,
     );
     const meta = () => screen.getByText('Recovery phrase', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
````

Modify `extension/src/app/__tests__/Switcher.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Switcher.test.tsx b/extension/src/app/__tests__/Switcher.test.tsx
--- a/extension/src/app/__tests__/Switcher.test.tsx
+++ b/extension/src/app/__tests__/Switcher.test.tsx
@@ -36,6 +36,12 @@ function stubEngine(accounts: Account[], selected: number): Engine {
     contacts: async () => ({ok: true, data: {contacts: [], max: 200}}),
     contactSet: async () => ({ok: false, error: 'failed'}),
     contactRemove: async () => ({ok: false, error: 'failed'}),
+    dappGrants: async () => ({ok: true, data: []}),
+    dappRevoke: async () => ({ok: false, error: 'failed'}),
+    dappUndo: async () => ({ok: false, error: 'failed'}),
+    dappRevokeAll: async () => ({ok: false, error: 'failed'}),
+    dappBlocked: async () => ({ok: true, data: []}),
+    dappUnblock: async () => ({ok: false, error: 'failed'}),
     lock: async () => ({ok: true, data: null}),
     ping: async () => ({ok: true, data: null}),
   };
````

Modify `extension/src/app/__tests__/router.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/router.test.ts b/extension/src/app/__tests__/router.test.ts
--- a/extension/src/app/__tests__/router.test.ts
+++ b/extension/src/app/__tests__/router.test.ts
@@ -18,7 +18,7 @@ describe('the router', () => {
   });
 
   it('the pushable screens are a closed list; the hand-over screens are first routes only; the flow screens own their Esc', () => {
-    expect([...SCREENS].sort()).toEqual(['about', 'accounts', 'confirm', 'contacts', 'delete', 'passkey', 'receive', 'review', 'security', 'send', 'status', 'tab', 'tx']);
+    expect([...SCREENS].sort()).toEqual(['about', 'accounts', 'confirm', 'connected', 'contacts', 'delete', 'passkey', 'receive', 'review', 'security', 'send', 'status', 'tab', 'tx']);
     expect([...TAB_ONLY].sort()).toEqual(['created', 'imported', 'resume']);
     expect([...FLOW].sort()).toEqual(['confirm', 'resume', 'review', 'send', 'status']);
     for (const route of [{screen: 'created'}, {screen: 'imported'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
@@ -29,8 +29,8 @@ describe('the router', () => {
     expect(routeReducer(HOME, {type: 'push', route: forged})).toBe(HOME);
   });
 
-  it('B1b-2b §1.4: security, accounts, passkey and delete carry exactly their name — any other key refuses the route', () => {
-    for (const screen of ['security', 'accounts', 'passkey', 'delete'] as const) {
+  it('B1b-2b §1.4 (and B1c §4.4’s connected): security, accounts, passkey, delete and connected carry exactly their name — any other key refuses the route', () => {
+    for (const screen of ['security', 'accounts', 'passkey', 'delete', 'connected'] as const) {
       expect(routeReducer(HOME, {type: 'push', route: {screen}})).toEqual([...HOME, {screen}]);
       for (const extra of [{challengeId: 'ab'.repeat(16)}, {index: 1}, {address: ADDR}]) {
         expect(routeReducer(HOME, {type: 'push', route: {screen, ...extra} as unknown as Route})).toBe(HOME);
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/ConnectedApps.test.tsx src/app/__tests__/DeleteWallet.test.tsx src/app/__tests__/Settings.test.tsx src/app/__tests__/Switcher.test.tsx src/app/__tests__/router.test.ts
```
Expected (dry run, these test files on the previous task's tree): **red** — Test Files  4 failed | 1 passed (5) · Tests  8 failed | 105 passed (113). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/App.tsx`:

````diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -20,6 +20,7 @@ import {AccountsManager} from './screens/AccountsManager';
 import {DeleteWallet} from './screens/DeleteWallet';
 import {Security} from './screens/Security';
 import {Contacts} from './screens/Contacts';
+import {ConnectedApps} from './screens/ConnectedApps';
 import {Created} from './screens/Created';
 import {Imported} from './screens/Imported';
 import {Send} from './screens/Send';
@@ -212,6 +213,7 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
           onDelete={() => go({type: 'push', route: {screen: 'delete'}})}
           onAbout={() => go({type: 'push', route: {screen: 'about'}})}
           onContacts={() => go({type: 'push', route: {screen: 'contacts', pick: false}})}
+          onConnected={() => go({type: 'push', route: {screen: 'connected'}})}
         />
       );
     }
@@ -305,6 +307,8 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
     screen = <AccountsManager onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'passkey') {
     screen = <Passkey onBack={() => go({type: 'pop'})} />;
+  } else if (route.screen === 'connected') {
+    screen = <ConnectedApps onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'contacts') {
     screen = <Contacts pick={route.pick} onBack={() => go({type: 'pop'})} onPick={pickRecipient} />;
   } else {
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1631,3 +1631,142 @@ body:has(.app-window) {
   width: 100%;
   margin-top: var(--space-4);
 }
+
+/* B1c plan 1: #49 connected apps (spec §4.4) — index.html #s49's inline styles, as classes. The screen is the
+   design's `.screen`, positioned for its sheet and toast. */
+.app-connected {
+  position: relative;
+}
+.app-connected-body {
+  padding-top: var(--space-3);
+  padding-bottom: var(--space-7);
+}
+.app-top-spacer {
+  width: 22px;
+}
+/* A row is one tap target (ix:18970, "entire row tap → opens detail sheet"); its body is the button a keyboard reaches. */
+.s10-app-row {
+  cursor: pointer;
+}
+.s10-app-row button.body.app-row-open {
+  font: inherit;
+  color: inherit;
+  text-align: start;
+  background: transparent;
+  border: 0;
+  padding: 0;
+  cursor: pointer;
+}
+.app-row-action {
+  display: contents;
+}
+/* 49d: every row at .55 while the hold runs; the per-row Revoke at .45 and off (ix:18886). */
+.s10-app-row.app-row-dim {
+  opacity: 0.55;
+}
+.s10-app-row .revoke:disabled {
+  opacity: 0.45;
+}
+.s10-summary-bar .sort.app-hold-note {
+  color: var(--danger);
+  font-weight: 600;
+}
+.app-hold-helper {
+  margin-top: var(--space-5);
+  text-align: center;
+}
+/* Q10: the "This session" pill — the row's meta badge, in the neutral tint (the SHIELDED variant is B2). */
+.s10-app-row .meta .badge.app-session-pill {
+  background: color-mix(in oklab, var(--fg-tertiary) 14%, transparent);
+  color: var(--fg-secondary);
+}
+/* D3: a blocked site's tile, and [Unblock] in --accent (an undo, not a destructive action). */
+.s10-app-row .ico.app-tile-blocked {
+  background: var(--bg-surface-3);
+  color: var(--fg-secondary);
+}
+.s10-app-row .revoke.app-unblock {
+  color: var(--accent);
+}
+.app-connected-failed {
+  margin: var(--space-4) 0;
+}
+/* 49e's skeleton rows (ix:19015-19019): the drawn line widths and heights. */
+.s10-skel-row .skel-line {
+  height: 14px;
+}
+.s10-skel-row .skel-line.app-w60 {
+  width: 60%;
+}
+.s10-skel-row .skel-line.app-w70 {
+  width: 70%;
+}
+.s10-skel-row .skel-line.app-w52 {
+  width: 52%;
+}
+.s10-skel-row .skel-line.app-w64 {
+  width: 64%;
+}
+.s10-skel-row .skel-line.app-w58 {
+  width: 58%;
+}
+.s10-skel-row .skel-line.app-skel-sub {
+  width: 72%;
+  height: 10px;
+}
+.s10-skel-row .skel-line.app-skel-meta {
+  width: 56px;
+}
+/* 49c's sheet: its head tile in the row's gradient, the verified dot beside the name (ix:18866), the scrolling body
+   (ix:18872: max 360 px, --space-4 between groups), its group labels, and the destructive CTA (ix:18899). */
+.s10-sheet .head-row .ico.app-tile-tensor {
+  background: linear-gradient(135deg, oklch(72% 0.18 295), oklch(65% 0.16 320));
+}
+.s10-sheet .head-row .ico.app-tile-jup {
+  background: linear-gradient(135deg, oklch(78% 0.16 60), oklch(70% 0.14 30));
+}
+.s10-sheet .head-row .ico.app-tile-magic {
+  background: linear-gradient(135deg, oklch(76% 0.18 340), oklch(68% 0.16 10));
+}
+.s10-sheet .head-row .ico.app-tile-drift {
+  background: linear-gradient(135deg, oklch(80% 0.14 180), oklch(72% 0.16 220));
+}
+.s10-sheet .head-row .ico.app-tile-kamino {
+  background: linear-gradient(135deg, oklch(72% 0.16 200), oklch(64% 0.14 240));
+}
+.app-verified-dot {
+  width: 8px;
+  height: 8px;
+  border-radius: 50%;
+  background: var(--success);
+  display: inline-block;
+  margin-left: 2px;
+}
+.app-grant-sheet-body {
+  overflow-y: auto;
+  max-height: 360px;
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-4);
+}
+.s10-sheet .group-label.app-group-label {
+  margin: 0 0 var(--space-2);
+}
+.app-light {
+  font-weight: 400;
+}
+.btn.app-revoke-one {
+  background: color-mix(in oklab, var(--danger) 14%, var(--bg-surface-2));
+  color: var(--danger);
+  border: 1px solid color-mix(in oklab, var(--danger) 36%, transparent);
+}
+.s10-sheet,
+.s10-sheet-overlay {
+  z-index: 10;
+}
+.s10-undo-toast {
+  z-index: 5;
+}
+.s10-undo-toast .undo-btn {
+  cursor: pointer;
+}
````

Modify `extension/src/app/engine.ts`:

````diff
diff --git a/extension/src/app/engine.ts b/extension/src/app/engine.ts
--- a/extension/src/app/engine.ts
+++ b/extension/src/app/engine.ts
@@ -149,6 +149,31 @@ export interface ContactList {
   max: number;
 }
 
+/** B1c §4.4: one grant as #49 shows it (dapp.grants.list) — the name the background chose (C7), never the page's. */
+export interface DappInteraction {
+  type: 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction';
+  at: number;
+  outcome: 'approved' | 'rejected';
+}
+export interface DappGrant {
+  origin: string;
+  host: string;
+  name: string;
+  /** On the known list (#49's dot, spec §9). */
+  verified: boolean;
+  account: string;
+  scope: 'session' | 'persistent';
+  connectedAt: number;
+  lastUsedAt: number;
+  recent: DappInteraction[];
+}
+export interface DappBlocked {
+  host: string;
+  blockedAt: number;
+  imitates: string | null;
+}
+export type DappUndoError = 'malformed' | 'locked' | 'unknown-token' | 'blocked' | 'granted' | 'unknown-account' | 'cap' | 'scope';
+
 type Network = 'unreachable' | 'coordinator-refused';
 type SendRefusal =
   | 'locked'
@@ -194,6 +219,14 @@ export interface Engine {
   contactSet(address: string, name: string): Promise<Reply<{created: boolean}, 'malformed' | 'duplicate-name' | 'full' | 'locked'>>;
   /** contacts.remove: ok also when the address was not saved. */
   contactRemove(address: string): Promise<Reply<null, 'malformed' | 'locked'>>;
+  /** B1c §1.4, §2.7, §4.4: #49's grants (both scopes), refused while locked. */
+  dappGrants(): Promise<Reply<DappGrant[], 'locked'>>;
+  /** Revokes at once; the background keeps the record five seconds behind the token (the popup holds only the token). */
+  dappRevoke(origin: string): Promise<Reply<{undoToken: string}, 'malformed' | 'locked' | 'unknown-origin'>>;
+  dappUndo(undoToken: string): Promise<Reply<null, DappUndoError>>;
+  dappRevokeAll(): Promise<Reply<null, 'locked'>>;
+  dappBlocked(): Promise<Reply<DappBlocked[], 'locked'>>;
+  dappUnblock(host: string): Promise<Reply<null, 'malformed' | 'locked'>>;
   lock(): Promise<Reply<null, never>>;
   ping(): Promise<Reply<null, never>>;
 }
@@ -469,6 +502,28 @@ function createdOf(x: unknown): {created: boolean} | undefined {
 
 const nothing = (x: unknown): null | undefined => (x === undefined ? null : undefined);
 
+const ORIGIN = /^https:\/\/[^\s/?#@]+$/;
+function interactionOf(x: unknown): DappInteraction | undefined {
+  const o = obj(x);
+  const type = oneOf(o?.type, ['connect', 'signMessage', 'signTransaction', 'signAndSendTransaction'] as const);
+  const outcome = oneOf(o?.outcome, ['approved', 'rejected'] as const);
+  return o !== undefined && type !== undefined && outcome !== undefined && isTime(o.at) ? {type, at: o.at, outcome} : undefined;
+}
+function dappGrantOf(x: unknown): DappGrant | undefined {
+  const o = obj(x);
+  const scope = oneOf(o?.scope, ['session', 'persistent'] as const);
+  const recent = all(o?.recent, interactionOf);
+  if (o === undefined || scope === undefined || recent === undefined) return undefined;
+  if (typeof o.origin !== 'string' || !ORIGIN.test(o.origin) || typeof o.host !== 'string' || o.host === '' || typeof o.name !== 'string' || o.name === '') return undefined;
+  if (typeof o.verified !== 'boolean' || !isAddress(o.account) || !isTime(o.connectedAt) || !isTime(o.lastUsedAt)) return undefined;
+  return {origin: o.origin, host: o.host, name: o.name, verified: o.verified, account: o.account, scope, connectedAt: o.connectedAt, lastUsedAt: o.lastUsedAt, recent};
+}
+function dappBlockedOf(x: unknown): DappBlocked | undefined {
+  const o = obj(x);
+  if (o === undefined || typeof o.host !== 'string' || o.host === '' || !isTime(o.blockedAt) || !(o.imitates === null || typeof o.imitates === 'string')) return undefined;
+  return {host: o.host, blockedAt: o.blockedAt, imitates: o.imitates};
+}
+
 // ── The transport ─────────────────────────────────────────────────────────────────────────────
 
 export type Transport = (message: unknown) => Promise<unknown>;
@@ -539,6 +594,12 @@ export function createEngine(transport: Transport = runtimeSend, sleep: (ms: num
     contacts: () => call({type: 'contacts.list'}, ['locked'], contactListOf),
     contactSet: (address, name) => call({type: 'contacts.set', address, name}, ['malformed', 'duplicate-name', 'full', 'locked'], createdOf),
     contactRemove: address => call({type: 'contacts.remove', address}, ['malformed', 'locked'], nothing),
+    dappGrants: () => call({type: 'dapp.grants.list'}, ['locked'], d => all(obj(d)?.grants, dappGrantOf)),
+    dappRevoke: origin => call({type: 'dapp.grants.revoke', origin}, ['malformed', 'locked', 'unknown-origin'], d => (typeof obj(d)?.undoToken === 'string' ? {undoToken: obj(d)?.undoToken as string} : undefined)),
+    dappUndo: undoToken => call({type: 'dapp.grants.undo', undoToken}, ['malformed', 'locked', 'unknown-token', 'blocked', 'granted', 'unknown-account', 'cap', 'scope'], nothing),
+    dappRevokeAll: () => call({type: 'dapp.grants.revokeAll'}, ['locked'], nothing),
+    dappBlocked: () => call({type: 'dapp.blocked.list'}, ['locked'], d => all(obj(d)?.blocked, dappBlockedOf)),
+    dappUnblock: host => call({type: 'dapp.blocked.remove', host}, ['malformed', 'locked'], nothing),
     lock: () => call({type: 'vault.lock'}, [], nothing),
     ping: () => call({type: 'activity.ping'}, [], nothing),
   };
````

Modify `extension/src/app/router.ts`:

````diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -31,6 +31,8 @@ export type Route =
    * through the `send` route's own draft (a reset, review M4), never through a key of this route.
    */
   | {screen: 'contacts'; pick: boolean}
+  /** B1c §4.4: #49 connected apps, from #31's Connected dApps row — no data. */
+  | {screen: 'connected'}
   | {screen: 'send'; draft: Draft | null; notice: 'start-again' | null}
   | {screen: 'review'; account: string; intent: Intent; notice: 'confirmation-expired' | null}
   | {screen: 'confirm'; account: string; entry: 'flow'; preparedId: string}
@@ -41,9 +43,9 @@ export type Route =
   | {screen: 'resume'; account: string};
 export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};
 
-export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status', 'security', 'accounts', 'passkey', 'delete', 'contacts']);
+export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status', 'security', 'accounts', 'passkey', 'delete', 'contacts', 'connected']);
 /** B1b-2b: the settings screens carry nothing but their name — no secret, no challenge, no address to act on. */
-const BARE: ReadonlySet<string> = new Set<Route['screen']>(['security', 'accounts', 'passkey', 'delete']);
+const BARE: ReadonlySet<string> = new Set<Route['screen']>(['security', 'accounts', 'passkey', 'delete', 'connected']);
 /** The send flow's screens: each handles Esc itself (#19 discards first, #20 keeps, #21 has no back while open). */
 export const FLOW: ReadonlySet<string> = new Set<Route['screen']>(['send', 'review', 'confirm', 'status', 'resume']);
 /** The UI tab's hand-over screens: a first route from `location.hash`, never pushed. */
````

Create `extension/src/app/screens/ConnectedApps.tsx`:

````tsx
import {useCallback, useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {useNow} from '../useNow';
import {ago} from '../format';
import {whenText} from '../addressBook';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {HoldButton, type HoldClock, realClock} from '../ui/HoldButton';
import {useEscape} from '../ui/useEscape';
import type {DappBlocked, DappGrant, DappInteraction} from '../engine';

/** #49's copy (B1c §4.4): the design's strings (ix:18705-19100) as the spec quotes them, Q10, Q13–Q15 and 2a's "Try again". */
export const CONNECTED_TEXT = {
  title: 'Connected apps',
  sort: 'Sort',
  sessions: (n: number): [string, string] => [String(n), n === 1 ? ' active session' : ' active sessions'],
  sortedLastUsed: 'Sorted by last used',
  sortedName: 'Sorted by name',
  holdingNote: 'Hold to revoke all',
  meta: (date: string, when: string): string => `Connected ${date} · last used ${when}`,
  /** Q10. */
  sessionPill: 'This session',
  revoke: 'Revoke',
  revoked: (name: string): string => `${name} revoked`,
  undoIn: (s: number): string => `undo · ${s} s`,
  undo: 'UNDO',
  close: 'Close',
  permissions: 'Permissions',
  readKeys: 'Read public keys',
  readKeysSub: 'Granted at connect — view-only',
  signTx: 'Sign transactions',
  signMsg: 'Sign messages',
  withPrompt: '(with prompt)',
  promptSub: 'Each request asks before signing',
  session: 'Session',
  connectedK: 'Connected',
  lastUsedK: 'Last used',
  scopeK: 'Scope',
  untilRevoked: 'Until revoked',
  thisSessionOnly: 'This session only',
  last3: 'Last 3 interactions',
  interaction: {connect: 'Connect', signMessage: 'Sign message', signTransaction: 'Sign transaction', signAndSendTransaction: 'Sign and send transaction'} as Record<DappInteraction['type'], string>,
  outcome: {approved: '(approved)', rejected: '(rejected)'} as Record<DappInteraction['outcome'], string>,
  revokeThis: 'Revoke this connection',
  hold: (n: number): string => `Hold to disconnect all · ${n} ${n === 1 ? 'session' : 'sessions'}`,
  holdHeld: 'Hold to disconnect all',
  holdHelper: (n: number): string => `All ${n} ${n === 1 ? 'session' : 'sessions'} will be wiped · release the button to cancel`,
  disconnectAll: 'Disconnect all',
  emptyTitle: 'No connected apps',
  /** Q14. */
  emptyBody: 'When you connect a site, it appears here.',
  /** Q13. */
  blocked: 'Blocked sites',
  blockedOn: (date: string): string => `Blocked ${date}`,
  lookedLike: (domain: string): string => `Looked like ${domain}`,
  unblock: 'Unblock',
  /** Q15. */
  failed: 'Could not load your connections. Try again.',
  tryAgain: 'Try again',
} as const;

/** #49d: the hold is #49's own 600 ms (§9; #37's is 1 s). */
export const DISCONNECT_ALL_MS = 600;
/** §2.7: the undo window. */
export const UNDO_MS = 5_000;

/** The date as #49 writes it: YYYY-MM-DD, local (UTC stored — cardinal rule 3). */
export function isoDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** C6: the domain's initials — the name's first two words' first letters, or a one-word name's first two letters. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s.-]+/).filter(w => w !== '');
  const two = words.length >= 2 ? `${Array.from(words[0] ?? '')[0] ?? ''}${Array.from(words[1] ?? '')[0] ?? ''}` : Array.from(words[0] ?? '?').slice(0, 2).join('');
  return two.toUpperCase();
}

/** The design's five row gradients (ix:3885-3889), chosen from the host so a site keeps its colour. */
export const TILES = ['tensor', 'jup', 'magic', 'drift', 'kamino'] as const;
export function tileOf(host: string): (typeof TILES)[number] {
  let sum = 0;
  for (let i = 0; i < host.length; i++) sum += host.charCodeAt(i);
  return TILES[sum % TILES.length] ?? 'tensor';
}

type Sort = 'used' | 'name';

/** The host, with the port when the origin has an explicit one (review 1 L5, R35): two ports are two grants (C8). */
export function siteLabel(origin: string, host: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return host;
  }
}
type List = {grants: DappGrant[]; blocked: DappBlocked[]};

/** 49c: the row's detail sheet — permissions, session, the last three interactions, [Revoke this connection]. */
function GrantSheet({grant, now, onClose, onRevoke}: {grant: DappGrant; now: number; onClose: () => void; onRevoke: () => Promise<void>}) {
  const panel = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => before?.focus();
  }, []);
  const day = isoDay(grant.connectedAt);
  const tile = tileOf(grant.host);
  return (
    <>
      <div className="s10-sheet-overlay" data-testid="sheet-backdrop" onClick={onClose} />
      <div className="s10-sheet" role="dialog" aria-modal="true" aria-label={grant.name} ref={panel}>
        <div className="grabber" />
        <div className="head-row">
          <div className={tile === 'tensor' ? 'ico app-tile-tensor' : tile === 'jup' ? 'ico app-tile-jup' : tile === 'magic' ? 'ico app-tile-magic' : tile === 'drift' ? 'ico app-tile-drift' : 'ico app-tile-kamino'} aria-hidden="true">
            {initialsOf(grant.name)}
          </div>
          <div className="body">
            <div className="name">
              {grant.name}
              {grant.verified ? <span className="app-verified-dot" /> : null}
            </div>
            <div className="domain">{siteLabel(grant.origin, grant.host)}</div>
          </div>
          <button type="button" className="icon-btn" aria-label={CONNECTED_TEXT.close} onClick={onClose}>
            <ExtIcon name="close" size={20} />
          </button>
        </div>
        <div className="app-grant-sheet-body">
          <div>
            <p className="group-label app-group-label">{CONNECTED_TEXT.permissions}</p>
            <div className="s10-perm-row">
              <span className="check">
                <ExtIcon name="check" size={18} />
              </span>
              <div>
                <div className="pri">{CONNECTED_TEXT.readKeys}</div>
                <div className="sub">{CONNECTED_TEXT.readKeysSub}</div>
              </div>
              <span className="ts">{day}</span>
            </div>
            <div className="s10-perm-row">
              <span className="check">
                <ExtIcon name="check" size={18} />
              </span>
              <div>
                <div className="pri">
                  {CONNECTED_TEXT.signTx} <span className="app-dim app-light">{CONNECTED_TEXT.withPrompt}</span>
                </div>
                <div className="sub">{CONNECTED_TEXT.promptSub}</div>
              </div>
              <span className="ts">{day}</span>
            </div>
            <div className="s10-perm-row">
              <span className="check">
                <ExtIcon name="check" size={18} />
              </span>
              <div>
                <div className="pri">
                  {CONNECTED_TEXT.signMsg} <span className="app-dim app-light">{CONNECTED_TEXT.withPrompt}</span>
                </div>
                <div className="sub">{CONNECTED_TEXT.promptSub}</div>
              </div>
              <span className="ts">{day}</span>
            </div>
          </div>
          <div>
            <p className="group-label app-group-label">{CONNECTED_TEXT.session}</p>
            <div className="s10-meta-grid">
              <div className="cell">
                <span className="k">{CONNECTED_TEXT.connectedK}</span>
                <span className="v">{day}</span>
              </div>
              <div className="cell">
                <span className="k">{CONNECTED_TEXT.lastUsedK}</span>
                <span className="v">{whenText(grant.lastUsedAt, now)}</span>
              </div>
              <div className="cell">
                <span className="k">{CONNECTED_TEXT.scopeK}</span>
                <span className="v">{grant.scope === 'persistent' ? CONNECTED_TEXT.untilRevoked : CONNECTED_TEXT.thisSessionOnly}</span>
              </div>
            </div>
          </div>
          {grant.recent.length > 0 ? (
            <div>
              <p className="group-label app-group-label">{CONNECTED_TEXT.last3}</p>
              <div className="s10-history">
                {grant.recent.map(r => (
                  <div className="row" key={`${r.at}-${r.type}`}>
                    <span className="op">
                      {CONNECTED_TEXT.interaction[r.type]} <span className="noc-caption app-dim">{CONNECTED_TEXT.outcome[r.outcome]}</span>
                    </span>
                    <span className="when">{ago(r.at, now)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <LockedButton className="btn btn-primary app-revoke-one" onPress={onRevoke}>
          <ExtIcon name="trash" size={18} />
          {CONNECTED_TEXT.revokeThis}
        </LockedButton>
      </div>
    </>
  );
}

/**
 * #49 connected apps (spec §4.4; index.html ix:18705-19100; D1, D3, D9, C6, C7): every grant (persistent, and the
 * session's while unlocked) with its initials tile, name, verified dot, domain, "Connected <date> · last used <when>" and
 * the "This session" pill; Revoke with no confirmation — the row leaves and the design's 5-second, single-shot undo
 * toast appears (the background holds the record behind a token, §2.7); a row tap opens 49c's detail sheet; "Hold to
 * disconnect all" (49d, 600 ms: rows dim, per-row Revoke off, no undo); the sort button; the blocked sites with Unblock
 * (D3); empty (Q14, no Browse button — D1), skeleton, failed (Q15). Re-read on focus (no pull-to-refresh). Every read
 * and every action checks it is still the newest and still mounted before it sets anything.
 */
export function ConnectedApps({onBack, clock = realClock}: {onBack: () => void; clock?: HoldClock}) {
  const m = useWallet();
  const {engine, reload} = m;
  const now = useNow(1_000, m.now);
  const [list, setList] = useState<List | 'failed' | null>(null);
  const [sort, setSort] = useState<Sort>('used');
  const [open, setOpen] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  /** Revoked here and not yet re-read: hidden at once (the design's optimistic remove). */
  const [gone, setGone] = useState<string[]>([]);
  const [toast, setToast] = useState<{name: string; token: string; until: number} | null>(null);
  const reads = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const n = ++reads.current;
    const [g, b] = await Promise.all([engine.dappGrants(), engine.dappBlocked()]);
    if (!alive.current || n !== reads.current) return;
    if ((!g.ok && g.error === 'locked') || (!b.ok && b.error === 'locked')) return void reload();
    if (!g.ok || !b.ok) return setList('failed');
    setGone([]);
    setList({grants: g.data, blocked: b.data});
  }, [engine, reload]);
  useEffect(() => {
    void load();
    const again = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', again);
    return () => window.removeEventListener('focus', again);
  }, [load]);

  // The toast lives five seconds; the countdown is whole seconds left.
  useEffect(() => {
    if (toast !== null && now >= toast.until) setToast(null);
  }, [now, toast]);

  const revoke = async (g: DappGrant) => {
    setGone(x => [...x, g.origin]);
    setOpen(null);
    const r = await engine.dappRevoke(g.origin);
    if (!alive.current) return;
    if (r.ok) setToast({name: g.name, token: r.data.undoToken, until: m.now() + UNDO_MS});
    await load();
  };
  const undo = async () => {
    if (toast === null) return;
    const token = toast.token;
    setToast(null);
    await engine.dappUndo(token);
    if (alive.current) await load();
  };
  const unblock = async (host: string) => {
    await engine.dappUnblock(host);
    if (alive.current) await load();
  };
  const disconnectAll = async () => {
    await engine.dappRevokeAll();
    if (alive.current) await load();
  };

  const top = (sorting: boolean) => (
    <div className="top-bar">
      <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
        <ExtIcon name="back" size={22} />
      </button>
      <h1 className="title noc-h1-compact">{CONNECTED_TEXT.title}</h1>
      {sorting ? (
        <button type="button" className="icon-btn" aria-label={CONNECTED_TEXT.sort} onClick={() => setSort(s => (s === 'used' ? 'name' : 'used'))}>
          <ExtIcon name="sort" size={22} />
        </button>
      ) : (
        <span className="app-top-spacer" />
      )}
    </div>
  );

  if (list === null) {
    return (
      <div className="screen app-connected" aria-busy="true">
        {top(false)}
        <div className="scroll-area app-connected-body">
          {[60, 70, 52, 64, 58].map(w => (
            <div className="s10-skel-row" key={w}>
              <div className="ico" />
              <div className="body">
                <div className={w === 60 ? 'skel-line app-w60' : w === 70 ? 'skel-line app-w70' : w === 52 ? 'skel-line app-w52' : w === 64 ? 'skel-line app-w64' : 'skel-line app-w58'} />
                <div className="skel-line app-skel-sub" />
              </div>
              <div className="skel-line app-skel-meta" />
            </div>
          ))}
        </div>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary app-delete-gated" disabled>
            <ExtIcon name="trash" size={18} />
            {CONNECTED_TEXT.disconnectAll}
          </button>
        </div>
      </div>
    );
  }
  if (list === 'failed') {
    return (
      <div className="screen app-connected">
        {top(false)}
        <div className="scroll-area app-connected-body">
          <p className="noc-body app-muted app-connected-failed">{CONNECTED_TEXT.failed}</p>
          <LockedButton className="btn btn-secondary" onPress={load}>
            {CONNECTED_TEXT.tryAgain}
          </LockedButton>
        </div>
      </div>
    );
  }

  const grants = list.grants.filter(g => !gone.includes(g.origin));
  const shown = [...grants].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) || a.host.localeCompare(b.host) : b.lastUsedAt - a.lastUsedAt));
  const openGrant = shown.find(g => g.origin === open) ?? null;
  const blocked = list.blocked.length === 0 ? null : (
    <>
      <p className="s7-group-label">{CONNECTED_TEXT.blocked}</p>
      {list.blocked.map(b => (
        <div className="s10-app-row" key={b.host}>
          <div className="ico app-tile-blocked" aria-hidden="true">
            {initialsOf(b.host.split('.').slice(-2, -1)[0] ?? b.host)}
          </div>
          <div className="body">
            <span className="domain">{b.host}</span>
            <div className="meta">
              <span>{CONNECTED_TEXT.blockedOn(isoDay(b.blockedAt))}</span>
              {b.imitates === null ? null : <span className="noc-warning">{CONNECTED_TEXT.lookedLike(b.imitates)}</span>}
            </div>
          </div>
          <LockedButton className="revoke app-unblock" onPress={() => unblock(b.host)}>
            {CONNECTED_TEXT.unblock}
          </LockedButton>
        </div>
      ))}
    </>
  );

  if (shown.length === 0) {
    return (
      <>
        <div className="screen app-connected">
          {top(false)}
          <div className="scroll-area app-connected-body">
            <div className="s10-empty">
              <div className="ill">
                <ExtIcon name="unlink" size={56} />
              </div>
              <h2 className="head">{CONNECTED_TEXT.emptyTitle}</h2>
              <p className="sub">{CONNECTED_TEXT.emptyBody}</p>
            </div>
            {blocked}
          </div>
          <div className="sticky-bar">
            <button type="button" className="btn btn-primary app-delete-gated" disabled>
              <ExtIcon name="trash" size={18} />
              {CONNECTED_TEXT.disconnectAll}
            </button>
          </div>
        </div>
        {toast === null ? null : <UndoToast toast={toast} now={now} onUndo={undo} />}
      </>
    );
  }

  const [count, label] = CONNECTED_TEXT.sessions(shown.length);
  return (
    <>
      <div className="screen app-connected">
        {top(true)}
        <div className="scroll-area app-connected-body">
          <div className="s10-summary-bar">
            <span className="count">
              <b>{count}</b>
              {label}
            </span>
            <span className={holding ? 'sort app-hold-note' : 'sort'}>{holding ? CONNECTED_TEXT.holdingNote : sort === 'used' ? CONNECTED_TEXT.sortedLastUsed : CONNECTED_TEXT.sortedName}</span>
          </div>
          {shown.map(g => {
            const tile = tileOf(g.host);
            return (
              <div className={holding ? 's10-app-row app-row-dim' : 's10-app-row'} key={g.origin} onClick={() => setOpen(g.origin)}>
                <div className={tile === 'tensor' ? 'ico tensor' : tile === 'jup' ? 'ico jup' : tile === 'magic' ? 'ico magic' : tile === 'drift' ? 'ico drift' : 'ico kamino'} aria-hidden="true">
                  {initialsOf(g.name)}
                </div>
                <button type="button" className="body app-row-open" onClick={() => setOpen(g.origin)}>
                  <span className="name-row">
                    <span className="name">{g.name}</span>
                    {g.verified ? <span className="verified-dot" /> : null}
                  </span>
                  <span className="domain">{siteLabel(g.origin, g.host)}</span>
                  <span className="meta">
                    <span>{CONNECTED_TEXT.meta(isoDay(g.connectedAt), whenText(g.lastUsedAt, now))}</span>
                    {g.scope === 'session' ? <span className="badge app-session-pill">{CONNECTED_TEXT.sessionPill}</span> : null}
                  </span>
                </button>
                <span
                  className="app-row-action"
                  onClick={e => {
                    e.stopPropagation();
                  }}
                >
                  <LockedButton className="revoke" disabled={holding} onPress={() => revoke(g)}>
                    {CONNECTED_TEXT.revoke}
                  </LockedButton>
                </span>
              </div>
            );
          })}
          {holding ? <p className="noc-caption noc-danger app-hold-helper">{CONNECTED_TEXT.holdHelper(shown.length)}</p> : null}
          {blocked}
        </div>
        <div className="sticky-bar">
          <HoldButton label={CONNECTED_TEXT.hold(shown.length)} heldLabel={CONNECTED_TEXT.holdHeld} decimals={2} holdMs={DISCONNECT_ALL_MS} disabled={false} onPressing={setHolding} onHeld={() => void disconnectAll()} clock={clock} />
        </div>
      </div>
      {toast === null ? null : <UndoToast toast={toast} now={now} onUndo={undo} />}
      {openGrant === null ? null : <GrantSheet grant={openGrant} now={now} onClose={() => setOpen(null)} onRevoke={() => revoke(openGrant)} />}
    </>
  );
}

/** 49e's undo toast: "<name> revoked", "undo · <s> s", [UNDO] — single-shot, five seconds. */
function UndoToast({toast, now, onUndo}: {toast: {name: string; until: number}; now: number; onUndo: () => Promise<void>}) {
  const left = Math.max(1, Math.ceil((toast.until - now) / 1000));
  return (
    <div className="s10-undo-toast" role="status" aria-live="polite">
      <ExtIcon name="trash" size={18} />
      <span className="body">{CONNECTED_TEXT.revoked(toast.name)}</span>
      <span className="timer noc-body-sm noc-numeral">{CONNECTED_TEXT.undoIn(left)}</span>
      <LockedButton className="undo-btn" onPress={onUndo}>
        {CONNECTED_TEXT.undo}
      </LockedButton>
    </div>
  );
}
````

Modify `extension/src/app/screens/DeleteWallet.tsx`:

````diff
diff --git a/extension/src/app/screens/DeleteWallet.tsx b/extension/src/app/screens/DeleteWallet.tsx
--- a/extension/src/app/screens/DeleteWallet.tsx
+++ b/extension/src/app/screens/DeleteWallet.tsx
@@ -18,8 +18,8 @@ export const DELETE_TEXT = {
   /** ix:14973 → adapted ("device" → "browser"); the bold parts at 1 and 3. */
   body: ['This removes ', 'all encrypted keys', ' and ', 'local data', ' from this browser.'],
   bulletAssets: ["Your assets won't be lost on-chain — but you'll need your ", 'recovery phrase', ' to access them again.'],
-  /** ix:14981 → adapted, plan 2's wording (spec §5): the address book is wiped with the rest (D20). */
-  bulletErased: ['Local settings, cached balances, your address book and the list of addresses you have sent to are ', 'erased', ' and not recoverable.'],
+  /** ix:14981 → adapted, plan 2's wording (spec §5) with B1c's Q08 where the design reserves it ("dApp connections"). */
+  bulletErased: ['Local settings, cached balances, your address book, the list of addresses you have sent to, and dApp connections and blocked sites are ', 'erased', ' and not recoverable.'],
   holdBody: 'Hold the red button below — release to cancel, hold for the full second to delete.',
   firstAccount: "This wallet's first account",
   typeLead: 'Type ',
````

Modify `extension/src/app/screens/Settings.tsx`:

````diff
diff --git a/extension/src/app/screens/Settings.tsx b/extension/src/app/screens/Settings.tsx
--- a/extension/src/app/screens/Settings.tsx
+++ b/extension/src/app/screens/Settings.tsx
@@ -31,8 +31,11 @@ export const SETTINGS_TEXT = {
   verified: 'Verified',
   lockNow: 'Lock now',
   lockFailed: 'Could not lock the wallet. Try again.',
-  /** ix:13550: the group the address book row sits in (plan 2; Connected dApps and Air-gap omitted, D22). */
+  /** ix:13550: the group (plan 2); B1c adds Connected dApps above Address book (ix:13552); Air-gap omitted (D22). */
   connections: 'Connections',
+  connectedDapps: 'Connected dApps',
+  /** Q07. */
+  connectedCount: (n: number): string => `${n} connected`,
   addressBook: 'Address book',
   advanced: 'Advanced',
   // Named deleteTitle: the source gate in the unlock tests allows the engine call's name in two files only.
@@ -53,7 +56,8 @@ export const PASSWORD_TOAST_WINDOW_MS = 10 * 60_000;
  * the "Password updated" toast (1.8 s) and the row's "Just updated" decoration (5 s), once per change (a UI pref keeps
  * the timestamp shown; a future stamp shows nothing). The tab reads the facts again when shown again. Every row that opens a page is a LockedButton (rule 6). The rows #31 draws and the extension does
  * not have are omitted (D22; the spec's Differs list). Plan 2: Connections › Address book (ix:13552), meta "N contacts"
- * from contacts.list — a refusal leaves the meta empty; the row still opens #15.
+ * from contacts.list — a refusal leaves the meta empty; the row still opens #15. B1c §4.1: Connections › Connected dApps
+ * above it (#i-plug), meta "<n> connected" (Q07) from dapp.grants.list — empty when none or refused; → #49.
  */
 export function Settings({
   onProfile,
@@ -62,6 +66,7 @@ export function Settings({
   onDelete,
   onAbout,
   onContacts,
+  onConnected,
   toastMs = 1_800,
   decorateMs = 5_000,
 }: {
@@ -72,6 +77,8 @@ export function Settings({
   onAbout: () => void;
   /** Plan 2: Connections › Address book → #15 (standalone). */
   onContacts: () => void;
+  /** B1c §4.1: Connections › Connected dApps → #49. */
+  onConnected: () => void;
   toastMs?: number;
   decorateMs?: number;
 }) {
@@ -82,6 +89,8 @@ export function Settings({
   const [decorated, setDecorated] = useState(false);
   /** The book's size for the Address book meta; null until read, or when the read was refused (no meta then). */
   const [contacts, setContacts] = useState<number | null>(null);
+  /** B1c §4.1 (review L12): the grants for Connected dApps' meta (persistent, and the session's while unlocked); null: none shown. */
+  const [grants, setGrants] = useState<number | null>(null);
   const passkey = m.wallet?.passkey === true;
 
   useEffect(() => {
@@ -90,7 +99,12 @@ export function Settings({
     let reads = 0;
     const timers: ReturnType<typeof setTimeout>[] = [];
     let contactReads = 0;
+    let grantReads = 0;
     const read = () => {
+      const g = ++grantReads;
+      void m.engine.dappGrants().then(r => {
+        if (alive && g === grantReads) setGrants(r.ok ? r.data.length : null);
+      });
       const c = ++contactReads;
       void m.engine.contacts().then(r => {
         if (alive && c === contactReads) setContacts(r.ok ? r.data.contacts.length : null);
@@ -220,6 +234,8 @@ export function Settings({
         ) : null}
         <div className="s7-group-label">{SETTINGS_TEXT.connections}</div>
         <div className="s7-list">
+          {/* Q07 when some are connected; empty when none (review L12) or when the read was refused. */}
+          <ListRow icon="plug" title={SETTINGS_TEXT.connectedDapps} meta={grants === null || grants === 0 ? '' : SETTINGS_TEXT.connectedCount(grants)} onPress={onConnected} />
           <ListRow icon="link" title={SETTINGS_TEXT.addressBook} meta={contacts === null ? '' : contactsCount(contacts)} onPress={onContacts} />
         </div>
         <div className="s7-group-label">{SETTINGS_TEXT.advanced}</div>
````

Modify `extension/src/app/ui/ExtIcon.tsx`:

````diff
diff --git a/extension/src/app/ui/ExtIcon.tsx b/extension/src/app/ui/ExtIcon.tsx
--- a/extension/src/app/ui/ExtIcon.tsx
+++ b/extension/src/app/ui/ExtIcon.tsx
@@ -54,9 +54,36 @@ export type ExtIconName =
   | 'users'
   | 'link'
   | 'book'
-  | 'bookmark';
+  | 'bookmark'
+  // B1c plan 1: #31's Connected dApps row (#i-plug), #49's sort button and empty state (inline in the mockup, ix:18718, 18801).
+  | 'plug'
+  | 'sort'
+  | 'unlink';
 
 const PATHS: Record<ExtIconName, ReactNode> = {
+  // B1c plan 1, from the design: #i-plug (the sprite), #49's sort lines (ix:18718) and its chain-broken glyph (ix:18801).
+  plug: (
+    <>
+      <path d="M12 22v-5" />
+      <path d="M9 7V2" />
+      <path d="M15 7V2" />
+      <path d="M6 13V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4Z" />
+    </>
+  ),
+  sort: (
+    <>
+      <line x1="4" y1="6" x2="20" y2="6" />
+      <line x1="6" y1="12" x2="18" y2="12" />
+      <line x1="9" y1="18" x2="15" y2="18" />
+    </>
+  ),
+  unlink: (
+    <>
+      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
+      <path d="M15 7h2a5 5 0 0 1 4.6 7" />
+      <line x1="3" y1="3" x2="21" y2="21" />
+    </>
+  ),
   // B1b-2b plan 2, from the design's sprite: #i-search, #i-users, #i-link, #i-book, #i-bookmark.
   search: (
     <>
````

Modify `extension/src/app/ui/HoldButton.tsx`:

````diff
diff --git a/extension/src/app/ui/HoldButton.tsx b/extension/src/app/ui/HoldButton.tsx
--- a/extension/src/app/ui/HoldButton.tsx
+++ b/extension/src/app/ui/HoldButton.tsx
@@ -28,6 +28,8 @@ export const HOLD_TICK_MS = 30;
  */
 export function HoldButton({
   label,
+  heldLabel = label,
+  decimals = 1,
   holdMs,
   disabled,
   onHeld,
@@ -35,6 +37,10 @@ export function HoldButton({
   clock = realClock,
 }: {
   label: string;
+  /** B1c (#49d, ix:18902): the words before the count while held, when they differ from the rest label. */
+  heldLabel?: string;
+  /** Places of the count: #37 draws one ("0.4 s"), #49 two ("0.24 s"). */
+  decimals?: number;
   holdMs: number;
   disabled: boolean;
   onHeld: () => void;
@@ -131,8 +137,8 @@ export function HoldButton({
         <ExtIcon name="trash" size={18} />
         {/* One run beside the icon (ix:15089): the label's flex gap is for the icon, never between the words and the count. */}
         <span>
-          {left === null ? label : `${label} · `}
-          {left === null ? null : <span className="noc-numeral">{`${left.toFixed(1)} s`}</span>}
+          {left === null ? label : `${heldLabel} · `}
+          {left === null ? null : <span className="noc-numeral">{`${left.toFixed(decimals)} s`}</span>}
         </span>
       </span>
     </button>
````

- [ ] **Step 4: Run them green, then the whole suite, the build and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/ConnectedApps.test.tsx src/app/__tests__/DeleteWallet.test.tsx src/app/__tests__/Settings.test.tsx src/app/__tests__/Switcher.test.tsx src/app/__tests__/router.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  5 passed (5) · Tests  126 passed (126); tsc clean; whole suite Test Files  153 passed (153) · Tests  3034 passed (3034); the build and every gate green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. The dry run ran every mutation below on the end state of the whole plan; the anchors are unique there.

- **M10a** — the undo toast not single-shot — `extension/src/app/screens/ConnectedApps.tsx`:

  ```diff
  -     const token = toast.token;
  -     setToast(null);
  +     const token = toast.token;
  ```
  `timeout 300 npx vitest run src/app/__tests__/ConnectedApps.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 12 passed (13)).

- **M10b** — #49's hold at #37's 1 s — `extension/src/app/screens/ConnectedApps.tsx`:

  ```diff
  - export const DISCONNECT_ALL_MS = 600;
  + export const DISCONNECT_ALL_MS = 1_000;
  ```
  `timeout 300 npx vitest run src/app/__tests__/ConnectedApps.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 12 passed (13)).

- **M10c** — rows not dimmed while held — `extension/src/app/screens/ConnectedApps.tsx`:

  ```diff
  - <div className={holding ? 's10-app-row app-row-dim' : 's10-app-row'}
  + <div className={holding ? 's10-app-row' : 's10-app-row'}
  ```
  `timeout 300 npx vitest run src/app/__tests__/ConnectedApps.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 12 passed (13)).

- **M10d** — #31's meta "0 connected" (review L12) — `extension/src/app/screens/Settings.tsx`:

  ```diff
  - meta={grants === null || grants === 0 ? '' : SETTINGS_TEXT.connectedCount(grants)}
  + meta={grants === null ? '' : SETTINGS_TEXT.connectedCount(grants)}
  ```
  `timeout 300 npx vitest run src/app/__tests__/Settings.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 31 passed (32)).

- **M10e** — the Sort button sorts nothing — `extension/src/app/screens/ConnectedApps.tsx`:

  ```diff
  - (sort === 'name' ? a.name.localeCompare(b.name) || a.host.localeCompare(b.host) : b.lastUsedAt - a.lastUsedAt)
  + (b.lastUsedAt - a.lastUsedAt)
  ```
  `timeout 300 npx vitest run src/app/__tests__/ConnectedApps.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 12 passed (13)).

- **M10f** — the hold completes without revoking — `extension/src/app/screens/ConnectedApps.tsx`:

  ```diff
  -   const disconnectAll = async () => {
  -     await engine.dappRevokeAll();
  +   const disconnectAll = async () => {
  ```
  `timeout 300 npx vitest run src/app/__tests__/ConnectedApps.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 12 passed (13)).

- **M10g** — #49's row drops the port — `extension/src/app/screens/ConnectedApps.tsx`:

  ```diff
  - <span className="domain">{siteLabel(g.origin, g.host)}</span>
  + <span className="domain">{g.host}</span>
  ```
  `timeout 300 npx vitest run src/app/__tests__/ConnectedApps.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 12 passed (13)).

- [ ] **Step 6: Commit.**

```bash
git add extension/e2e/visual-contacts.spec.ts extension/e2e/visual.spec.ts extension/src/app/App.tsx extension/src/app/__tests__/ConnectedApps.test.tsx extension/src/app/__tests__/DeleteWallet.test.tsx extension/src/app/__tests__/Settings.test.tsx extension/src/app/__tests__/Switcher.test.tsx extension/src/app/__tests__/router.test.ts extension/src/app/app.css extension/src/app/engine.ts extension/src/app/router.ts extension/src/app/screens/ConnectedApps.tsx extension/src/app/screens/DeleteWallet.tsx extension/src/app/screens/Settings.tsx extension/src/app/ui/ExtIcon.tsx extension/src/app/ui/HoldButton.tsx
git commit -F - <<'MSG'
feat(extension): B1c #49 connected apps, #31 Connected dApps row, #37 bullet

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 11: E2E B1c-19 … B1c-24 with a real test dApp (`@wallet-standard/app`'s `getWallets()`), contained; spec 15 wipes the dApp keys

**Spec:** §6.3 (19–24), §6.1 (C11's wipe through spec 15), §2.2, §2.6, §2.7, §3.2, §4.3, D11, C15, C16; Scope R29, R30; plan review 1 L9; Scope R39

**Files:**
- Test: `extension/e2e/dapp.spec.ts` (new)
- Test: `extension/e2e/dappPage.ts` (new)
- Test: `extension/e2e/fixtures/dapp/page.ts` (new)
- Test: `extension/e2e/launch.ts`
- Test: `extension/e2e/popupHarness.ts`
- Test: `extension/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: every task; the built extension (`node scripts/build.mjs`).
- Produces:
  - `e2e/fixtures/dapp/page.ts`: the test dApp's script (`window.dapp`).
  - `e2e/dappPage.ts`: `DAPP_HOSTS`, `serveDapp(ctx)`, `openDapp(ctx, origin, path?)`, `names`, `features`, `changes`, `relayed`, `connect`, `disconnect`, `sign`, `approvalWindow(ctx, act)`, `windowClosed(win)`, `noWindow(ctx, act)`.
  - `e2e/launch.ts`: `launchContained(prefix, {hosts?})`; `e2e/popupHarness.ts`: `launchPopup(prefix, {hosts?})`.

A test dApp served through `ctx.route` at `https://dapp.test` (unknown), `https://jup.ag` (verified), `https://tensr.trade` (lookalike, rule b), `https://xn--phntom-4nf.app` (rule a) and `https://xn--bcher-kva.example` (an unknown IDN) — every one also unresolvable in the browser's resolver map, so a request the route misses fails locally; the route counts what it served and anything it does not serve. Its script is built once from `e2e/fixtures/dapp/page.ts` with the real `@wallet-standard/app`, and drives "Noctura" only through its standard features. B1c-19 connect (#47b's gates, a verified "Until I revoke" connect, Enter not confirming, reload, lock → `change []`, the locked window with no input → unlock from the toolbar popup → #47 within 2 s), B1c-20 signMessage (a SIWS message verified with ed25519; a 3 205-byte printable legacy Message refused with no window), B1c-21 lookalike (Reject and report → blocked with no window → #49 Unblock → #47 again), B1c-22 revoke (Undo; then `change []` and disconnected), B1c-23 iframe (no injection below the top frame), B1c-24 restart (#46 shown → the worker's CDP target closed → Sign → one signature from another worker). Spec 15's delete now wipes the three dApp keys too.

- [ ] **Step 1: Write the harness and the specs.**

Create `extension/e2e/dapp.spec.ts`:

````ts
import {test, expect, type Page} from '@playwright/test';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {DAPP_HOSTS, approvalWindow, changes, connect, features, names, noWindow, openDapp, relayed, serveDapp, sign, windowClosed, type DappServer} from './dappPage';

// Spec B1c §6.3: E2E B1c-19 … B1c-24 against the real extension — the MAIN-world provider, the relay, the background
// and the approval window — with a real test dApp (e2e/fixtures/dapp/page.ts: @wallet-standard/app's getWallets()) served
// through ctx.route at https://dapp.test, https://jup.ag (a verified host), https://tensr.trade (a lookalike) and an xn--
// host. Titles carry "B1c-NN · " (B1b's spec 19 already owns "19 · "): run one with -g 'B1c-19 · '. Every spec ends
// contained: the coordinator route saw the popup's reads, nothing unexpected, Solscan and noc-tura.io untouched, the dApp
// route served only its own paths. Chromium only: Firefox's port.sender.origin for a content-script port — which the
// whole PAGE partition keys on — is a line of B1e's manual Firefox run (review 1 L9), not exercised here.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>; getContexts(filter: object): Promise<{contextId: string}[]>};
  storage: {local: {set(o: object): Promise<void>}};
};

const ACCOUNT = E2E_ACCOUNTS[0];
const DAPP = 'https://dapp.test';
const JUP = 'https://jup.ag';
const siws = (domain: string) => [`${domain} wants you to sign in with your Solana account:`, ACCOUNT, '', 'Sign in to the test dApp.', '', `URI: https://${domain}`, 'Version: 1', 'Chain ID: solana:mainnet', 'Nonce: 4f3a92ceb1d8', 'Issued At: 2026-10-10T09:40:23Z'].join('\n');

/** The browser, the real wallet (makeEnvelope, unlocked through the vault page), and the dApp's route. */
async function scene(prefix: string): Promise<{h: Harness; server: DappServer}> {
  const h = await launchPopup(prefix, {hosts: DAPP_HOSTS});
  const server = await serveDapp(h.ctx);
  await h.sw.evaluate(env => chrome.storage.local.set({v1_vault: env}), await makeEnvelope());
  const vault = await h.ctx.newPage();
  await unlockWith(vault, h.id, E2E_PASSWORD);
  await vault.close();
  return {h, server};
}
function done(h: Harness, server: DappServer): void {
  contained(h);
  expect(server.unexpected).toEqual([]);
}
/** The popup on #11 (its reads are what contained() counts), then a message from it. */
async function popup(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
const lockWallet = async (p: Page) => p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
/** #47b's two gates, then "Connect for this session" (held 500 ms by C15: Playwright waits for it to be enabled). */
async function connectUnknown(win: Page): Promise<void> {
  await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
  await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
  await win.getByRole('button', {name: 'Connect for this session'}).click();
}

test('B1c-19 · connect: Noctura found → #47b → both gates → the account; persistent survives a reload, session not a lock; lock → change []; locked → the locked window (no password) → unlock from the toolbar → #47', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene('noctura-e2e-dapp-connect-');
  try {
    const p = await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    expect(await names(page)).toContain('Noctura');
    // D10: plan 1 advertises exactly what it implements.
    expect(await features(page)).toEqual(['solana:signMessage', 'standard:connect', 'standard:disconnect', 'standard:events']);
    // A silent connect never opens a window.
    expect(await connect(page, true)).toEqual({ok: true, value: []});
    let pending!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (pending = connect(page)));
    await expect(win.getByText('Connect to this app?')).toBeVisible();
    await expect(win.locator('.s9-origin-card .dom')).toHaveText('dapp.test');
    // C15: nothing focused when the window opens; Enter on a focused Connect never confirms.
    expect(await win.evaluate(() => document.activeElement === document.body)).toBe(true);
    await connectUnknown(win);
    expect(await pending).toEqual({ok: true, value: [ACCOUNT]});
    await windowClosed(win);

    // A verified origin, "Until I revoke".
    const jup = await openDapp(h.ctx, JUP);
    let pj!: Promise<unknown>;
    const win2 = await approvalWindow(h.ctx, () => (pj = connect(jup)));
    await expect(win2.getByText('Connect to Jupiter?')).toBeVisible();
    await win2.getByRole('checkbox').click();
    await win2.getByRole('radio', {name: /Until I revoke/}).click();
    const connectBtn = win2.getByRole('button', {name: 'Connect', exact: true});
    await expect(connectBtn).toBeEnabled();
    await connectBtn.focus();
    await win2.keyboard.press('Enter');
    await win2.waitForTimeout(700);
    expect(await win2.isClosed()).toBe(false);
    await connectBtn.click();
    expect(await pj).toEqual({ok: true, value: [ACCOUNT]});

    // Reload: both silent connects answer.
    await page.reload();
    await jup.reload();
    expect(await connect(page, true)).toEqual({ok: true, value: [ACCOUNT]});
    expect(await connect(jup, true)).toEqual({ok: true, value: [ACCOUNT]});

    // Lock: change [] to both granted pages; afterwards the session grant is gone, the persistent one only hidden (D5).
    await lockWallet(p);
    await expect.poll(() => changes(page)).toContainEqual([]);
    await expect.poll(() => changes(jup)).toContainEqual([]);
    expect(await connect(jup, true)).toEqual({ok: true, value: []});

    // Locked + an explicit connect: the window's locked screen, no password field; unlock from the toolbar → #47.
    let pl!: Promise<unknown>;
    const locked = await approvalWindow(h.ctx, () => (pl = connect(page)));
    await expect(locked.getByText('Noctura is locked')).toBeVisible();
    await expect(locked.getByText("Click the Noctura icon in your browser's toolbar and unlock. This request will wait here.")).toBeVisible();
    await expect(locked.locator('input, select, textarea')).toHaveCount(0);
    const toolbar = await h.openPopup();
    const [tab] = await Promise.all([h.ctx.waitForEvent('page'), toolbar.getByRole('button', {name: 'Unlock'}).click()]);
    await tab.locator('#unl-password').fill(E2E_PASSWORD);
    await tab.locator('#unl-submit').click();
    // §2.3: the window polls every second (E2E allows two after the unlock lands).
    await expect(tab.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
    await expect(locked.getByText('Connect to this app?')).toBeVisible({timeout: 2_000});
    // The persistent grant is back without #47 (the unlock hook's change).
    await expect.poll(() => changes(jup)).toContainEqual([ACCOUNT]);
    await connectUnknown(locked);
    expect(await pl).toEqual({ok: true, value: [ACCOUNT]});
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-20 · signMessage: a SIWS message signed and verified with ed25519; a transaction’s bytes as a message refused with no window', async () => {
  test.setTimeout(180_000);
  const {h, server} = await scene('noctura-e2e-dapp-sign-');
  try {
    await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    const win = await approvalWindow(h.ctx, () => connect(page));
    await connectUnknown(win);
    await expect.poll(() => page.evaluate(() => (window as unknown as {dapp: {accounts(): string[]}}).dapp.accounts())).toEqual([ACCOUNT]);
    const message = siws('dapp.test');
    let pending!: Promise<unknown>;
    const w46 = await approvalWindow(h.ctx, () => (pending = sign(page, message)));
    await expect(w46.getByText('Sign this message?')).toBeVisible();
    await expect(w46.locator('.s9-msg-preview')).toHaveText(message);
    await w46.getByRole('button', {name: 'Sign', exact: true}).click();
    const r = (await pending) as {ok: true; value: {signature: string; signedMessage: string}};
    expect(r.ok).toBe(true);
    expect(base64.decode(r.value.signedMessage)).toEqual(new TextEncoder().encode(message));
    expect(ed25519.verify(base64.decode(r.value.signature), new TextEncoder().encode(message), base58.decode(ACCOUNT))).toBe(true);

    // A printable legacy Message (3 205 bytes that deserialize): refused before any window (§3.2 rule 2).
    const parts = [new TextEncoder().encode('!!!'), Uint8Array.of(0x20), new Uint8Array(1024).fill(0x4b), new Uint8Array(32).fill(0x42), Uint8Array.of(0x20)];
    for (let i = 0; i < 32; i++) parts.push(Uint8Array.of(0x21, 0x20), new Uint8Array(32).fill(0x22), Uint8Array.of(0x20), new Uint8Array(32).fill(0x61));
    const tx = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
    let at = 0;
    for (const x of parts) {
      tx.set(x, at);
      at += x.length;
    }
    await windowClosed(w46);
    expect(await noWindow(h.ctx, () => sign(page, base64.encode(tx), {base64: true}))).toEqual({ok: false, code: 'invalid-request', message: 'The request is not valid.'});
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-21 · lookalike: tensr.trade → "Reject and report" → the next connect is rejected with no window → #49 Unblock → #47 again', async () => {
  test.setTimeout(180_000);
  const {h, server} = await scene('noctura-e2e-dapp-lookalike-');
  try {
    const p = await popup(h);
    const page = await openDapp(h.ctx, 'https://tensr.trade');
    let pending!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (pending = connect(page)));
    await expect(win.locator('.top-bar .title')).toHaveText('Suspicious origin');
    await expect(win.locator('.s9-domain-warn .body')).toHaveText('This domain is not tensor.tradeIt looks like tensor.trade but is a different site.');
    await expect(win.locator('.s9-origin-card .name')).toHaveText('tensr');
    await win.getByRole('button', {name: 'Reject and report'}).click();
    expect(await pending).toEqual({ok: false, code: 4001, message: 'The user rejected the request.'});
    // Blocked: answered at once, no window.
    await windowClosed(win);
    expect(await noWindow(h.ctx, () => connect(page))).toEqual({ok: false, code: 4001, message: 'The user rejected the request.'});
    // #31 → #49 → Blocked sites → Unblock.
    await p.getByRole('button', {name: 'Settings'}).click();
    await p.locator('.s7-title', {hasText: 'Connected dApps'}).click();
    await expect(p.getByText('Blocked sites')).toBeVisible();
    const row = p.locator('.s10-app-row', {hasText: 'tensr.trade'});
    await expect(row.locator('.meta')).toContainText('Looked like tensor.trade');
    await row.getByRole('button', {name: 'Unblock'}).click();
    await expect(p.getByText('Blocked sites')).toHaveCount(0);
    let last!: Promise<unknown>;
    const again = await approvalWindow(h.ctx, () => (last = connect(page)));
    await expect(again.locator('.top-bar .title')).toHaveText('Suspicious origin');
    await again.getByRole('button', {name: 'Close'}).click();
    expect(await last).toEqual({ok: false, code: 4001, message: 'The user rejected the request.'});
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-22 · revoke: Revoke → UNDO → still connected; Revoke → five seconds → the page has change [] and stays disconnected', async () => {
  test.setTimeout(180_000);
  const {h, server} = await scene('noctura-e2e-dapp-revoke-');
  try {
    const p = await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    const win = await approvalWindow(h.ctx, () => connect(page));
    await connectUnknown(win);
    await expect.poll(() => connect(page, true)).toEqual({ok: true, value: [ACCOUNT]});
    await p.getByRole('button', {name: 'Settings'}).click();
    await expect(p.locator('.s7-row', {hasText: 'Connected dApps'}).locator('.s7-meta')).toHaveText('1 connected');
    await p.locator('.s7-title', {hasText: 'Connected dApps'}).click();
    const row = p.locator('.s10-app-row', {hasText: 'dapp.test'});
    await row.getByRole('button', {name: 'Revoke'}).click();
    await expect(p.getByText('dapp revoked')).toBeVisible();
    await expect.poll(() => changes(page)).toEqual([[ACCOUNT], []]);
    await p.getByRole('button', {name: 'UNDO'}).click();
    await expect(row).toBeVisible();
    await expect.poll(() => changes(page)).toEqual([[ACCOUNT], [], [ACCOUNT]]);
    expect(await connect(page, true)).toEqual({ok: true, value: [ACCOUNT]});
    await row.getByRole('button', {name: 'Revoke'}).click();
    await expect.poll(() => changes(page)).toEqual([[ACCOUNT], [], [ACCOUNT], []]);
    await expect(p.getByText('dapp revoked')).toBeHidden({timeout: 7_000});
    expect(await connect(page, true)).toEqual({ok: true, value: []});
    await expect(p.getByText('No connected apps')).toBeVisible();
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-23 · iframe: the page in an iframe sees no Noctura (no injection, all_frames false); the top frame does', async () => {
  test.setTimeout(120_000);
  const {h, server} = await scene('noctura-e2e-dapp-iframe-');
  try {
    await popup(h);
    const page = await openDapp(h.ctx, DAPP, '/framed.html');
    const inner = page.frames().find(f => f.url().endsWith('/inner.html'));
    expect(inner).toBeDefined();
    await inner!.waitForFunction(() => typeof (window as unknown as {dapp?: unknown}).dapp === 'object');
    expect(await names(page)).toEqual(['Noctura']);
    expect(await inner!.evaluate(() => (window as unknown as {dapp: {names(): string[]}}).dapp.names())).toEqual([]);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-24 · restart: #46 shown → the service worker is stopped (CDP) → Sign → the page gets exactly one signature', async () => {
  test.setTimeout(180_000);
  const {h, server} = await scene('noctura-e2e-dapp-restart-');
  try {
    const p = await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    const win = await approvalWindow(h.ctx, () => connect(page));
    await connectUnknown(win);
    await expect.poll(() => connect(page, true)).toEqual({ok: true, value: [ACCOUNT]});
    let pending!: Promise<unknown>;
    const w46 = await approvalWindow(h.ctx, () => (pending = sign(page, 'Sign in to the test dApp.')));
    await expect(w46.getByText('Sign this message?')).toBeVisible();
    // The worker's identity, as the extension itself reports it (runtime.getContexts, Chrome 116+).
    const workers = () => p.evaluate(() => chrome.runtime.getContexts({contextTypes: ['BACKGROUND']}).then(c => c.map(x => x.contextId)));
    const [before] = await workers();
    expect(before).toBeDefined();
    // review 2 L11: stop the worker by closing its CDP target (ServiceWorker.stopAllWorkers from a page session left it
    // running in the dry run), from a plain tab's session.
    const tab = await h.ctx.newPage();
    const cdp = await h.ctx.newCDPSession(tab);
    const target = (await cdp.send('Target.getTargets')).targetInfos.find(t => t.type === 'service_worker');
    expect(await cdp.send('Target.closeTarget', {targetId: target!.targetId})).toEqual({success: true});
    // Positive control: no background context runs now.
    await expect.poll(workers).toEqual([]);
    await w46.getByRole('button', {name: 'Sign', exact: true}).click();
    const r = (await pending) as {ok: boolean; value: {signature: string}};
    expect(r.ok).toBe(true);
    expect(ed25519.verify(base64.decode(r.value.signature), new TextEncoder().encode('Sign in to the test dApp.'), base58.decode(ACCOUNT))).toBe(true);
    // Another worker answered it, and the page heard exactly one signature.
    const after = await workers();
    expect(after).toHaveLength(1);
    expect(after).not.toContain(before);
    await page.waitForTimeout(2_000);
    const answers = ((await relayed(page)) as {result?: {signature?: string}}[]).filter(m => typeof m.result?.signature === 'string');
    expect(answers).toHaveLength(1);
    done(h, server);
  } finally {
    await h.close();
  }
});
````

Create `extension/e2e/dappPage.ts`:

````ts
import {expect, type BrowserContext, type Page, type Route} from '@playwright/test';
import {build, type Rollup} from 'vite';
import {fileURLToPath} from 'node:url';

/**
 * B1c §6.3: the test dApp, served through ctx.route — never from the network. Its script (e2e/fixtures/dapp/page.ts,
 * with the real @wallet-standard/app) is built once into a classic script. Every host it is served at is contained
 * twice: the route answers it, and launchContained's resolver map (DAPP_HOSTS) makes it unresolvable inside the browser,
 * so a request the route misses fails locally. `hits` counts what the route served; `unexpected` any path it does not
 * serve (asserted empty).
 */
export const DAPP_HOSTS = ['dapp.test', 'jup.ag', 'tensr.trade', 'xn--phntom-4nf.app', 'xn--bcher-kva.example'] as const;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let script: string | null = null;
async function dappScript(): Promise<string> {
  if (script !== null) return script;
  const out = (await build({
    configFile: false,
    logLevel: 'silent',
    root: ROOT,
    publicDir: false,
    build: {write: false, minify: false, lib: {entry: 'e2e/fixtures/dapp/page.ts', formats: ['iife'], name: 'testDapp', fileName: () => 'dapp.js'}},
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const first = Array.isArray(out) ? out[0] : out;
  const chunk = first?.output.find(o => o.type === 'chunk');
  if (chunk === undefined || chunk.type !== 'chunk') throw new Error('the test dApp did not build');
  script = chunk.code;
  return script;
}

const PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test dApp</title></head><body><h1>Test dApp</h1><script src="/dapp.js"></script></body></html>';
/** E2E 23: the dApp's page inside an iframe of its own origin. */
const FRAMED = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Framed</title></head><body><script src="/dapp.js"></script><iframe src="/inner.html" title="inner"></iframe></body></html>';

export interface DappServer {
  hits: string[];
  unexpected: string[];
}

export async function serveDapp(ctx: BrowserContext): Promise<DappServer> {
  const js = await dappScript();
  const server: DappServer = {hits: [], unexpected: []};
  for (const host of DAPP_HOSTS) {
    await ctx.route(new RegExp(`^https://${host.replace(/\./g, '\\.')}(:\\d+)?/`), (route: Route) => {
      const url = new URL(route.request().url());
      server.hits.push(url.href);
      if (url.pathname === '/dapp.js') return route.fulfill({status: 200, contentType: 'text/javascript', body: js});
      if (url.pathname === '/' || url.pathname === '/inner.html') return route.fulfill({status: 200, contentType: 'text/html', body: PAGE});
      if (url.pathname === '/framed.html') return route.fulfill({status: 200, contentType: 'text/html', body: FRAMED});
      server.unexpected.push(url.href);
      return route.abort();
    });
  }
  return server;
}

type Result = {ok: true; value: unknown} | {ok: false; code: unknown; message: string};
declare const dapp: {
  names(): string[];
  features(): string[];
  accounts(): string[];
  changes(): string[][];
  relayed(): unknown[];
  connect(silent: boolean): Promise<Result>;
  disconnect(): Promise<Result>;
  sign(text: string, o?: {base64?: boolean}): Promise<Result>;
};

/** A dApp tab at `origin`, its Wallet Standard registry ready (Noctura found, or not). */
export async function openDapp(ctx: BrowserContext, origin: string, path = '/'): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(() => typeof (window as unknown as {dapp?: unknown}).dapp === 'object');
  return page;
}

export const names = (p: Page) => p.evaluate(() => dapp.names());
export const features = (p: Page) => p.evaluate(() => dapp.features());
export const changes = (p: Page) => p.evaluate(() => dapp.changes());
export const relayed = (p: Page) => p.evaluate(() => dapp.relayed());
export const connect = (p: Page, silent = false) => p.evaluate(s => dapp.connect(s), silent);
export const disconnect = (p: Page) => p.evaluate(() => dapp.disconnect());
export const sign = (p: Page, text: string, o: {base64?: boolean} = {}) => p.evaluate(({t, b}) => dapp.sign(t, {base64: b}), {t: text, b: o.base64 === true});

/**
 * The approval window `act` causes (windows.create → a new page of approve.html). What `act` returns is NOT awaited: a
 * request's promise settles only once the window decides it (the dry run's first form awaited it and deadlocked).
 */
export async function approvalWindow(ctx: BrowserContext, act: () => unknown): Promise<Page> {
  const opened = ctx.waitForEvent('page', p => p.url().endsWith('/approve.html'));
  const result = act();
  if (result instanceof Promise) result.catch(() => undefined);
  const win = await opened;
  await win.waitForLoadState('domcontentloaded');
  return win;
}

/** The window closed itself (`none`, §4.3) — polled: it may have closed before anyone listened for it. */
export async function windowClosed(win: Page): Promise<void> {
  await expect.poll(() => win.isClosed(), {timeout: 10_000}).toBe(true);
}

/** `act` opens no window at all (§1.6, §2.6: answered at once): no new page appears while it runs and for a second after. */
export async function noWindow<T>(ctx: BrowserContext, act: () => Promise<T>): Promise<T> {
  const opened: string[] = [];
  const seen = (p: Page) => void opened.push(p.url());
  ctx.on('page', seen);
  try {
    const out = await act();
    await new Promise(r => setTimeout(r, 1_000));
    expect(opened).toEqual([]);
    return out;
  } finally {
    ctx.off('page', seen);
  }
}
````

Create `extension/e2e/fixtures/dapp/page.ts`:

````ts
import {getWallets} from '@wallet-standard/app';
import type {Wallet, WalletAccount} from '@wallet-standard/base';

/**
 * The test dApp (B1c §6.3): the script of the page E2E serves at https://dapp.test (and the other fixture hosts) through
 * ctx.route. It finds wallets the way a real dApp does — `@wallet-standard/app`'s getWallets() — and drives "Noctura"
 * through its standard features only. Built into one classic script by e2e/dappPage.ts; never part of the extension.
 */
type Result = {ok: true; value: unknown} | {ok: false; code: unknown; message: string};
interface Connect {
  connect(input?: {silent?: boolean}): Promise<{accounts: readonly WalletAccount[]}>;
}
interface Disconnect {
  disconnect(): Promise<void>;
}
interface Events {
  on(event: 'change', listener: (p: {accounts?: readonly WalletAccount[]}) => void): () => void;
}
interface SignMessage {
  signMessage(...inputs: {account: WalletAccount; message: Uint8Array}[]): Promise<{signature: Uint8Array; signedMessage: Uint8Array}[]>;
}

const wallets = getWallets();
const changes: string[][] = [];
/** Every message the relay posted to this window (source noctura-relay): E2E 24 counts the answers. */
const relayed: unknown[] = [];
window.addEventListener('message', e => {
  const d = e.data as {source?: unknown} | null;
  if (e.source === window && d !== null && typeof d === 'object' && d.source === 'noctura-relay') relayed.push(d);
});
let listening = false;

function noctura(): Wallet {
  const w = wallets.get().find(x => x.name === 'Noctura');
  if (w === undefined) throw new Error('no Noctura wallet');
  if (!listening) {
    listening = true;
    (w.features['standard:events'] as Events).on('change', p => void changes.push((p.accounts ?? []).map(a => a.address)));
  }
  return w;
}

async function run(f: () => Promise<unknown>): Promise<Result> {
  try {
    return {ok: true, value: await f()};
  } catch (e) {
    const err = e as {code?: unknown; message?: unknown};
    return {ok: false, code: err.code, message: String(err.message)};
  }
}

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const dapp = {
  names: (): string[] => wallets.get().map(w => w.name),
  features: (): string[] => Object.keys(noctura().features).sort(),
  accounts: (): string[] => noctura().accounts.map(a => a.address),
  changes: (): string[][] => changes,
  relayed: (): unknown[] => relayed,
  connect: (silent: boolean): Promise<Result> => run(async () => (await (noctura().features['standard:connect'] as Connect).connect({silent})).accounts.map(a => a.address)),
  disconnect: (): Promise<Result> => run(() => (noctura().features['standard:disconnect'] as Disconnect).disconnect()),
  /** Signs the UTF-8 text (or, with `base64`, these exact bytes) with the first account; answers both as base64. */
  sign: (text: string, o: {base64?: boolean} = {}): Promise<Result> =>
    run(async () => {
      const w = noctura();
      const account = w.accounts[0];
      if (account === undefined) throw new Error('not connected');
      const message = o.base64 === true ? unb64(text) : new TextEncoder().encode(text);
      const [out] = await (w.features['solana:signMessage'] as SignMessage).signMessage({account, message});
      return {signature: b64(out?.signature ?? new Uint8Array()), signedMessage: b64(out?.signedMessage ?? new Uint8Array())};
    }),
};
(window as unknown as {dapp: typeof dapp}).dapp = dapp;
````

Modify `extension/e2e/launch.ts`:

````diff
diff --git a/extension/e2e/launch.ts b/extension/e2e/launch.ts
--- a/extension/e2e/launch.ts
+++ b/extension/e2e/launch.ts
@@ -50,16 +50,21 @@ export async function containNocTura(ctx: BrowserContext): Promise<{hits: string
   return {hits};
 }
 
-/** Chromium with the built extension loaded and noc-tura.io and solscan.io unresolvable, in a fresh profile. */
-export async function launchContained(profilePrefix: string): Promise<{ctx: BrowserContext; profile: string}> {
+/**
+ * Chromium with the built extension loaded and noc-tura.io and solscan.io unresolvable, in a fresh profile. B1c: `hosts`
+ * adds more names to the same resolver map (the test dApp's hosts, e2e/dappPage.ts DAPP_HOSTS) — each answered by a
+ * route, and unresolvable should a request slip past it.
+ */
+export async function launchContained(profilePrefix: string, o: {hosts?: readonly string[]} = {}): Promise<{ctx: BrowserContext; profile: string}> {
   const profile = mkdtempSync(join(tmpdir(), profilePrefix));
+  const extra = (o.hosts ?? []).map(h => `, MAP ${h} ~NOTFOUND`).join('');
   const ctx = await chromium.launchPersistentContext(profile, {
     // The default headless browser is chrome-headless-shell, which does not load extensions
     // (the service worker never starts). channel 'chromium' is Playwright's full Chromium build
     // in new headless mode, which does.
     channel: 'chromium',
     headless: true,
-    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, HOST_RESOLVER_RULES],
+    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `${HOST_RESOLVER_RULES}${extra}`],
   });
   return {ctx, profile};
 }
````

Modify `extension/e2e/popupHarness.ts`:

````diff
diff --git a/extension/e2e/popupHarness.ts b/extension/e2e/popupHarness.ts
--- a/extension/e2e/popupHarness.ts
+++ b/extension/e2e/popupHarness.ts
@@ -53,8 +53,8 @@ export interface Harness {
 }
 
 /** The contained browser (noc-tura.io and solscan.io unresolvable, both routed), the fake, a popup opener at 412 × 600. */
-export async function launchPopup(prefix: string): Promise<Harness> {
-  const {ctx, profile} = await launchContained(prefix);
+export async function launchPopup(prefix: string, o: {hosts?: readonly string[]} = {}): Promise<Harness> {
+  const {ctx, profile} = await launchContained(prefix, o);
   // First, so the fake's own route (registered after it, so run before it) answers api.noc-tura.io.
   const nocTura = await containNocTura(ctx);
   const fake = await installFakeCoordinator(ctx);
````

Modify `extension/e2e/settings.spec.ts`:

````diff
diff --git a/extension/e2e/settings.spec.ts b/extension/e2e/settings.spec.ts
--- a/extension/e2e/settings.spec.ts
+++ b/extension/e2e/settings.spec.ts
@@ -20,8 +20,8 @@ const OTHER = 'legal winner thank year wave sausage worth useful legal winner th
 /** OTHER's SLIP-0010 account 0 (derived once with src/vault/accounts.ts). */
 const OTHER_ACCOUNT = 'BLeUXTx9thHGT7VJUtF9vHEmfMDgW1nnKZ9UVer2CoLX';
 const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
-/** What spec 15's delete wipes (spec §8.3), with plan 2's address book (E17, D20). */
-const WIPED = ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_contacts', 'v1_balance_cache', 'v1_price_cache'] as const;
+/** What spec 15's delete wipes (spec §8.3), with plan 2's address book (E17, D20) and B1c's dApp grants, blocks and limits (C11, C14). */
+const WIPED = ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_contacts', 'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits', 'v1_balance_cache', 'v1_price_cache'] as const;
 
 const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
 const envOf = async (sw: Worker) => (await local(sw, 'v1_vault')) as Env | undefined;
@@ -419,6 +419,14 @@ test('15 · delete a funded wallet: #37 says so and names the lowest index (not
     await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
     expect(await msg(ui, {type: 'contacts.set', address: RECIPIENT, name: 'Marko'})).toEqual({ok: true, data: {created: true}});
     await ui.close();
+    // B1c: a grant, a block and a cooldown, as the background stores them (the dApp flow itself is dapp.spec.ts's).
+    await h.sw.evaluate(a =>
+      chrome.storage.local.set({
+        v1_dapp_grants: [{origin: 'https://jup.ag', account: a, scope: 'persistent', connectedAt: Date.now(), lastUsedAt: Date.now(), recent: []}],
+        v1_dapp_blocked: [{host: 'tensr.trade', blockedAt: Date.now(), imitates: 'tensor.trade'}],
+        v1_dapp_limits: {rejections: [], cooldowns: [{key: 'host:tensr.trade', until: Date.now() + 600_000}], windows: [], notice: false},
+      }),
+    E2E_ACCOUNTS[0]);
     for (const key of WIPED) await expect.poll(() => local(h.sw, key), {message: key, timeout: 30_000}).toBeDefined();
     const before = JSON.stringify(await envOf(h.sw));
     await tab.locator('#dl-password').fill('not the password at all');
````

- [ ] **Step 2: Build, then run the new specs and spec 15 — in a normal launch and under `unshare -rn`.**

```bash
cd extension
node scripts/build.mjs
npx playwright test e2e/dapp.spec.ts
npx playwright test e2e/settings.spec.ts -g '15 · '
unshare -rn npx playwright test e2e/dapp.spec.ts
```
Expected (dry run): `dapp.spec.ts` 6 passed (6) in both launches (about 70 s); spec 15 passed (the three dApp keys exist before the delete and are gone after). These specs add no behaviour: they are made failable by the mutations below and by the unit tests' mutations.

- [ ] **Step 3: Mutations (each needs the build; `timeout 600` for build + spec).**

- **M11a** — the provider in every frame (E2E B1c-23 red; the permissions gate would also refuse it) — `extension/manifest/source.mjs`:

  ```diff
  - js: ['provider.js'], run_at: 'document_start', all_frames: false, world: 'MAIN'
  + js: ['provider.js'], run_at: 'document_start', all_frames: true, world: 'MAIN'
  ```
  `timeout 300 node scripts/build.mjs > /dev/null 2>&1 && npx playwright test e2e/dapp.spec.ts -g 'B1c-23'` — Expected: **red** (dry run: red, 1 failed).

- **M11b** — a blocked host still queues (E2E B1c-21's no-window check) — `extension/src/background/dapp/pageApi.ts`:

  ```diff
  -     if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {id, error: 'rejected'};
  -     if (account !== null) {
  +     if (account !== null) {
  ```
  `timeout 300 node scripts/build.mjs > /dev/null 2>&1 && npx playwright test e2e/dapp.spec.ts -g 'B1c-21'` — Expected: **red** (dry run: red, 1 failed).


- [ ] **Commit.**

```bash
git add extension/e2e/dapp.spec.ts extension/e2e/dappPage.ts extension/e2e/fixtures/dapp/page.ts extension/e2e/launch.ts extension/e2e/popupHarness.ts extension/e2e/settings.spec.ts
git commit -F - <<'MSG'
test(extension): B1c E2E 19–24 with a real test dApp; spec 15 wipes the dApp keys

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 12: The visual pass (§6.4): every B1c-1 state at its own size, for the opus-tier review against index.html

**Spec:** §6.4 (B1c-1's states), §4.3, §3.1, §3.2, §4.4

**Files:**
- Test: `extension/e2e/visual-dapp.spec.ts` (new)

**Interfaces:**
- Consumes: Task 11's `dappPage.ts`; B1b's `shot` (`visualTab.ts`), `launchPopup`, `seedUnlockedWallet`.
- Produces:
  `e2e/visual-dapp.spec.ts` (three tests; 37 shots into `test-results/visual/`).

Shots, not a pixel diff: the opus-tier review compares them with index.html (#46 ix:17442-17686, #47 ix:17686-18261, #49 ix:18705-19100, #31 ix:13552) and records each finding fixed or declared in the spec's §9. The approval window is shot at its own 412 × 720; #49 and #31 in the popup at 412 × 600. Every state asserts its own copy before its shot; a held CTA is awaited enabled (C15's 500 ms); the in-progress states hold `dapp.decide` (an init script on `approve.html` only); #49's hold frame runs on the page's paused clock; the window budget and the cooldown are reset between states (the pass opens more windows than C14 allows a site). #47: 47a-initial, the locked tap, 47a-acknowledged, connecting; 47b-initial, domain-acked, fully-acked, international; lookalike, its confirm, its gates; rule a; the cap; the queue lines (Q12 + Q24); Block this site (Q17); the locked window. #46: verified (SIWS), unknown, keyword, signing, lookalike, its confirm, SIWS mismatch. #49: #31's row, populated, sorted by name, detail, blocked section, hold, undo toast, empty.

- [ ] **Step 1: Write the harness and the specs.**

Create `extension/e2e/visual-dapp.spec.ts`:

````ts
import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {contained, launchPopup, seedUnlockedWallet, MAIN, type Harness} from './popupHarness';
import {DAPP_HOSTS, approvalWindow, connect, openDapp, serveDapp, sign, type DappServer} from './dappPage';
import {shot} from './visualTab';

// Spec B1c §6.4: every B1c-1 state the real extension can be put in, saved for the opus-tier review against index.html
// (#46 ix:17442-17686, #47 ix:17686-18261, #49 ix:18705-19100, #31 ix:13552) — not a pixel diff. The approval window at
// 412 × 720 (its windows.create size), #49 in the popup at 412 × 600. Every state asserts its own copy before its shot.
// The window budget and the cooldown are reset between states (`fresh`): the pass opens more windows than C14 allows in
// ten minutes, by design of the pass, not of a user.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>}; session: {set(o: object): Promise<void>}};
};
const DAY = 86_400_000;
const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);
const fresh = (sw: Worker, notice = false) => set(sw, {v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice}});
const siws = (domain: string) => [`${domain} wants you to sign in with your Solana account:`, MAIN.publicKey, '', 'Sign in to the test dApp.', '', `URI: https://${domain}`, 'Version: 1', 'Chain ID: solana:mainnet', 'Nonce: 4f3a92ceb1d8', 'Issued At: 2026-10-10T09:40:23Z'].join('\n');
const grant = (origin: string, o: {scope?: string; lastUsedAt?: number; connectedAt?: number; recent?: object[]} = {}) => ({
  origin,
  account: MAIN.publicKey,
  scope: o.scope ?? 'persistent',
  connectedAt: o.connectedAt ?? Date.now() - 30 * DAY,
  lastUsedAt: o.lastUsedAt ?? Date.now(),
  recent: o.recent ?? [],
});

/** A window state: its own copy first, then the shot (the pointer off the column; `ready`, a held CTA, awaited enabled). */
async function still(win: Page, name: string, visible: Locator, ready?: Locator): Promise<void> {
  await expect(visible).toBeVisible();
  await win.mouse.move(0, 0);
  await shot(win, name, {fullPage: false, ...(ready === undefined ? {} : {ready})});
}
/** The approval window for a request `ask` makes, at its 412 × 720; `hold` keeps every dapp.decide unanswered until released. */
async function windowFor(h: Harness, ask: () => unknown): Promise<Page> {
  const win = await approvalWindow(h.ctx, ask);
  await win.setViewportSize({width: 412, height: 720});
  return win;
}
/** Answers the window's request (✕ = Reject) and waits for the window to close itself. */
async function dismiss(win: Page): Promise<void> {
  const closed = win.waitForEvent('close');
  await win.getByRole('button', {name: 'Close'}).click();
  await closed;
}

async function scene(): Promise<{h: Harness; server: DappServer}> {
  const h = await launchPopup('noctura-e2e-visual-dapp-', {hosts: DAPP_HOSTS});
  const server = await serveDapp(h.ctx);
  await seedUnlockedWallet(h.sw);
  // A decision held open: approve.html's sendMessage for dapp.decide waits while window.__holdDecide is set (the
  // in-progress states "Connecting…" and "Signing…").
  await h.ctx.addInitScript(() => {
    if (location.pathname !== '/approve.html') return;
    const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
    const send = rt.sendMessage.bind(rt);
    const w = window as unknown as {__holdDecide?: boolean};
    rt.sendMessage = (m: unknown) => ((m as {type?: string}).type === 'dapp.decide' && w.__holdDecide === true ? new Promise(() => undefined) : send(m));
  });
  return {h, server};
}

test('visual · #47: 47a ×3, 47b ×4, lookalike (and its confirm), cap, connecting; the locked window; the queue lines (Q12, Q24)', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene();
  try {
    // A popup read keeps contained() honest (the coordinator route saw the popup's balance reads).
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});

    // 47a — verified (jup.ag).
    const jup = await openDapp(h.ctx, 'https://jup.ag');
    await fresh(h.sw);
    let win = await windowFor(h, () => connect(jup));
    await still(win, '47a-initial', win.getByText('0 of 1 acknowledgments'), win.getByRole('button', {name: 'Reject'}));
    // aria-disabled, not disabled (#47 E: the tap shakes the unmet gate): Playwright's actionability check would wait for it.
    await win.getByRole('button', {name: 'Connect', exact: true}).click({force: true});
    await still(win, '47a-locked-tap', win.getByText('Read the permissions above before connecting'));
    await win.getByRole('checkbox').click();
    await still(win, '47a-acknowledged', win.getByText('Ready to connect'), win.getByRole('button', {name: 'Connect', exact: true}));
    await win.getByRole('radio', {name: /Until I revoke/}).click();
    await win.evaluate(() => void ((window as unknown as {__holdDecide: boolean}).__holdDecide = true));
    await win.getByRole('button', {name: 'Connect', exact: true}).click();
    await still(win, '47-connecting', win.getByRole('button', {name: 'Connecting…'}));
    await win.close();

    // 47b — unknown (dapp.test), then an international (xn--) unknown host for Q18.
    const dapp = await openDapp(h.ctx, 'https://dapp.test');
    await fresh(h.sw);
    win = await windowFor(h, () => connect(dapp));
    await still(win, '47b-initial', win.getByText('0 of 2 acknowledgments'), win.getByRole('button', {name: 'Reject'}));
    await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
    await still(win, '47b-domain-acked', win.getByText('1 of 2 acknowledgments'));
    await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
    await still(win, '47b-fully-acked', win.getByText('Ready to connect · for this session'), win.getByRole('button', {name: 'Connect for this session'}));
    await dismiss(win);
    const idn = await openDapp(h.ctx, 'https://xn--bcher-kva.example');
    await fresh(h.sw);
    win = await windowFor(h, () => connect(idn));
    await still(win, '47b-international', win.getByText('This address uses international characters: xn--bcher-kva.example'));
    await dismiss(win);

    // Lookalike — rule b (tensr.trade) with its confirm and its gates; rule a (the Cyrillic phantom).
    const tensr = await openDapp(h.ctx, 'https://tensr.trade');
    await fresh(h.sw);
    win = await windowFor(h, () => connect(tensr));
    await still(win, '47-lookalike', win.getByText('It looks like tensor.trade but is a different site.'), win.getByRole('button', {name: 'Connect anyway (not recommended)'}));
    await win.getByRole('button', {name: 'Connect anyway (not recommended)'}).click();
    await still(win, '47-lookalike-confirm', win.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    await win.getByRole('button', {name: 'I understand the risk'}).click();
    await still(win, '47-lookalike-gates', win.getByText('0 of 2 acknowledgments'));
    await dismiss(win);
    const phantom = await openDapp(h.ctx, 'https://xn--phntom-4nf.app');
    await fresh(h.sw);
    win = await windowFor(h, () => connect(phantom));
    await still(win, '47-lookalike-idn', win.getByText('The Punycode form is', {exact: false}));
    await dismiss(win);

    // Cap (Q16): 200 persistent grants.
    await set(h.sw, {v1_dapp_grants: Array.from({length: 200}, (_, i) => grant(`https://s${i}.test`))});
    await fresh(h.sw);
    win = await windowFor(h, () => connect(dapp));
    await still(win, '47-cap', win.getByText('You have 200 connected apps. Revoke one in Settings first.'));
    await dismiss(win);
    await set(h.sw, {v1_dapp_grants: []});

    // The queue: two waiting behind the head (Q12) and the budget notice (Q24); the third request's Block this site (Q17).
    await fresh(h.sw, true);
    win = await windowFor(h, () => connect(dapp));
    connect(jup).catch(() => undefined);
    connect(tensr).catch(() => undefined);
    // The window asks again on focus (§2.3): the two that arrived after its first read now show.
    await expect.poll(async () => {
      await win.evaluate(() => void window.dispatchEvent(new Event('focus')));
      return win.getByText('2 more requests waiting').count();
    }).toBe(1);
    await still(win, '47-queue-and-notice', win.getByText('2 more requests waiting'));
    for (let i = 0; i < 3; i++) await win.getByRole('button', {name: 'Close'}).click();
    await win.waitForEvent('close');
    await set(h.sw, {v1_dapp_limits: {rejections: [{key: 'host:dapp.test', at: Date.now()}, {key: 'host:dapp.test', at: Date.now()}], cooldowns: [], windows: [], notice: false}});
    win = await windowFor(h, () => connect(dapp));
    await still(win, '47-block-this-site', win.getByRole('button', {name: 'Block this site'}));
    await dismiss(win);

    // The locked window (D11).
    await fresh(h.sw);
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    win = await windowFor(h, () => connect(dapp));
    await still(win, 'window-locked', win.getByText('Noctura is locked'), win.getByRole('button', {name: 'Reject'}));
    await win.getByRole('button', {name: 'Reject'}).click();
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});

test('visual · #46: verified (SIWS), unknown, keyword alert, lookalike and its confirm, SIWS mismatch, signing', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene();
  try {
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await set(h.sw, {v1_dapp_grants: ['https://jup.ag', 'https://dapp.test', 'https://tensr.trade'].map(o => grant(o))});
    const jup = await openDapp(h.ctx, 'https://jup.ag');
    const dapp = await openDapp(h.ctx, 'https://dapp.test');
    const tensr = await openDapp(h.ctx, 'https://tensr.trade');
    for (const pg of [jup, dapp, tensr]) await connect(pg, true);

    await fresh(h.sw);
    let win = await windowFor(h, () => sign(jup, siws('jup.ag')));
    await still(win, '46-verified', win.getByText('Message · UTF-8', {exact: false}), win.getByRole('button', {name: 'Sign', exact: true}));
    await dismiss(win);
    await fresh(h.sw);
    win = await windowFor(h, () => sign(dapp, 'Sign in to the test dApp.'));
    await still(win, '46-unknown', win.getByText("This won't broadcast or move funds. dapp will use the signature only to verify you own this wallet."));
    await dismiss(win);
    await fresh(h.sw);
    win = await windowFor(h, () => sign(jup, "jup.ag asks you to approve the following terms:\n\nBy signing, you agree to Jupiter's terms of service and authorize the routing of swaps through any of the verified AMMs in the registry as of this signature timestamp."));
    await still(win, '46-keyword', win.getByText('This message includes an authorization'), win.getByRole('button', {name: 'Sign', exact: true}));
    await win.evaluate(() => void ((window as unknown as {__holdDecide: boolean}).__holdDecide = true));
    await win.getByRole('button', {name: 'Sign', exact: true}).click();
    await still(win, '46-signing', win.getByRole('button', {name: 'Signing…'}));
    await win.close();
    await fresh(h.sw);
    win = await windowFor(h, () => sign(tensr, 'Welcome back!\n\nClick sign to confirm ownership of your wallet and continue.\n\nDomain: ph\u0430ntom.app'));
    await still(win, '46-lookalike', win.getByText('Message preview'), win.getByRole('button', {name: 'Sign anyway (not recommended)'}));
    await win.getByRole('button', {name: 'Sign anyway (not recommended)'}).click();
    await still(win, '46-lookalike-confirm', win.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    await win.getByRole('button', {name: 'Cancel'}).click();
    await dismiss(win);
    await fresh(h.sw);
    win = await windowFor(h, () => sign(dapp, siws('jup.ag')));
    await still(win, '46-siws-mismatch', win.getByText('This sign-in message names jup.ag, not this site (dapp.test).'));
    await dismiss(win);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});

test('visual · #49 and #31: populated, sorted by name, detail, hold, undo toast, blocked section, empty; #31’s Connected dApps row', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene();
  try {
    const now = Date.now();
    await set(h.sw, {
      v1_dapp_grants: [
        grant('https://tensor.trade', {lastUsedAt: now - 5 * 3_600_000, connectedAt: now - 40 * DAY, recent: [{type: 'signMessage', at: now - 5 * 3_600_000, outcome: 'approved'}, {type: 'signMessage', at: now - 2 * DAY, outcome: 'rejected'}, {type: 'connect', at: now - 40 * DAY, outcome: 'approved'}]}),
        grant('https://jup.ag', {lastUsedAt: now - 18 * 3_600_000, connectedAt: now - 60 * DAY}),
        grant('https://magiceden.io', {lastUsedAt: now - 3 * DAY, connectedAt: now - 80 * DAY}),
      ],
      v1_dapp_blocked: [{host: 'tensr.trade', blockedAt: now - DAY, imitates: 'tensor.trade'}],
    });
    await h.sw.evaluate(g => chrome.storage.session.set({v1_dapp_session: {queue: [], grants: [g], window: null, opening: null, undo: []}}), grant('https://drift.trade', {scope: 'session', lastUsedAt: now - 30 * DAY, connectedAt: now - 30 * DAY}));
    const p = await h.openPopup({clock: true});
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Settings'}).click();
    const row = p.locator('.s7-row', {hasText: 'Connected dApps'});
    await expect(row.locator('.s7-meta')).toHaveText('4 connected');
    await row.scrollIntoViewIfNeeded();
    await still(p, '31-connected-dapps', row);
    await row.click();
    await still(p, '49a-populated', p.getByText('4 active sessions'), p.getByRole('button', {name: 'Revoke'}).first());
    await p.getByRole('button', {name: 'Sort'}).click();
    await still(p, '49a-sorted-by-name', p.getByText('Sorted by name'));
    await p.getByRole('button', {name: 'Sort'}).click();
    await p.locator('.s10-app-row', {hasText: 'tensor.trade'}).locator('.name').click();
    await still(p, '49c-detail', p.getByRole('dialog', {name: 'Tensor'}));
    await p.getByRole('dialog').getByRole('button', {name: 'Close'}).click();
    const blocked = p.getByText('Blocked sites');
    await blocked.scrollIntoViewIfNeeded();
    await still(p, '49-blocked-section', blocked);
    // 49d: a mid-hold frame (~60 %) on the page's paused clock.
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('.app-hold').hover();
    await p.mouse.down();
    await p.clock.runFor(360);
    await expect(p.locator('.app-hold')).toHaveText('Hold to disconnect all · 0.24 s');
    await shot(p, '49d-hold', {fullPage: false});
    await p.mouse.move(0, 0);
    await p.mouse.up();
    await p.clock.resume();
    // 49e: the undo toast.
    await p.locator('.s10-app-row', {hasText: 'magiceden.io'}).getByRole('button', {name: 'Revoke'}).click();
    await still(p, '49e-undo-toast', p.getByText('Magic Eden revoked'));
    // 49b: empty (the blocked section stays below it).
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'dapp.grants.revokeAll'}));
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-title', {hasText: 'Connected dApps'}).click();
    await still(p, '49b-empty', p.getByText('No connected apps'));
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});
````

- [ ] **Step 2: Run it; read the shots.**

```bash
cd extension
node scripts/build.mjs
npx playwright test e2e/visual-dapp.spec.ts
ls test-results/visual | wc -l   # 37
```
Expected (dry run): 3 passed (3), 37 shots, in a normal launch and under `unshare -rn`. The opus-tier review of the shots is in "Before the PR".


- [ ] **Commit.**

```bash
git add extension/e2e/visual-dapp.spec.ts
git commit -F - <<'MSG'
test(extension): B1c visual pass — #46, #47, the locked window, #49, #31

Co-Authored-By: <the executing model's own line>
MSG
```

## Dry-run record (each finding fixed in the code above)

The end state was built task by task in a scratch git repository outside the checkout (a `git archive` of `feat/extension-b1c-plan1` at adbddc9 — `main` plus the spec commits), one commit per task; the plan's code blocks are generated from those commits (new files in full, changes as the commit's own diff), and applying them in order to that tree reproduces the end state byte for byte. **Revision 2** rebuilt that repository in a fresh scratch directory: each task's commit is rev 1's tree plus every review-1 change of that task and the ones before it, so a change lands in the task that owns its file and every later task carries it. Every number below is rev 2's. Then:

- **Per-task replay** (each task's tree from `git archive`, `extension/node_modules` copied — a linked one makes Vite resolve modules outside the package and the gates' module maps fail): each task's unit-test files on its predecessor's tree, then on its own tree, with `tsc`, the whole suite, `node scripts/build.mjs` and `npm run gates` at every task. Red for every task 1–10 (Tasks 11–12 add E2E specs over built behaviour, made failable by their mutations); `tsc` clean, own tests green, whole suite green, the build and every gate green at every task. The starting tree: Test Files  138 passed (138) · Tests  2821 passed (2821). The end state: Test Files  153 passed (153) · Tests  3034 passed (3034).

| task | own tests on the previous tree | own tests | whole suite |
|---|---|---|---|
| 1 | red: Test Files  3 failed (3) · Tests  no tests | Test Files  3 passed (3) · Tests  17 passed (17) | Test Files  141 passed (141) · Tests  2838 passed (2838) |
| 2 | red: Test Files  3 failed (3) · Tests  1 failed \| 414 passed (415) | Test Files  3 passed (3) · Tests  456 passed (456) | Test Files  142 passed (142) · Tests  2850 passed (2850) |
| 3 | red: Test Files  2 failed (2) · Tests  2 failed \| 3 passed (5) | Test Files  2 passed (2) · Tests  42 passed (42) | Test Files  143 passed (143) · Tests  2887 passed (2887) |
| 4 | red: Test Files  2 failed (2) · Tests  1 failed \| 27 passed (28) | Test Files  2 passed (2) · Tests  59 passed (59) | Test Files  144 passed (144) · Tests  2918 passed (2918) |
| 5 | red: Test Files  3 failed (3) · Tests  77 failed \| 7 passed (84) | Test Files  3 passed (3) · Tests  84 passed (84) | Test Files  145 passed (145) · Tests  2934 passed (2934) |
| 6 | red: Test Files  3 failed (3) · Tests  3 failed \| 44 passed (47) | Test Files  3 passed (3) · Tests  71 passed (71) | Test Files  146 passed (146) · Tests  2958 passed (2958) |
| 7 | red: Test Files  6 failed (6) · Tests  3 failed \| 451 passed (454) | Test Files  6 passed (6) · Tests  478 passed (478) | Test Files  149 passed (149) · Tests  2985 passed (2985) |
| 8 | red: Test Files  5 failed (5) · Tests  4 failed \| 428 passed (432) | Test Files  5 passed (5) · Tests  456 passed (456) | Test Files  151 passed (151) · Tests  3011 passed (3011) |
| 9 | red: Test Files  1 failed (1) · Tests  7 failed (7) | Test Files  1 passed (1) · Tests  7 passed (7) | Test Files  152 passed (152) · Tests  3018 passed (3018) |
| 10 | red: Test Files  4 failed \| 1 passed (5) · Tests  8 failed \| 105 passed (113) | Test Files  5 passed (5) · Tests  126 passed (126) | Test Files  153 passed (153) · Tests  3034 passed (3034) |
| 11 | — | — | Test Files  153 passed (153) · Tests  3034 passed (3034) |
| 12 | — | — | Test Files  153 passed (153) · Tests  3034 passed (3034) |

- **Extension `npm run verify`** on the end state (build, vitest, CSP, secrets, every gate incl. the new page-bundle gate, reproducible): green — 153 files, 3034 tests (rev 1: 3020); chrome 25 files `sha256:9c5a7156…be972c18e`, firefox 25 files `sha256:31a0661d…aa93f91de`.
- **E2E, contained, normal launch:** 58 passed (58) — B1b's 49 (incl. spec 15 with the three dApp keys) plus `dapp.spec.ts` 6 and `visual-dapp.spec.ts` 3. **Under `unshare -rn`:** 58 passed (58), the same specs with no network namespace route out.
- **Root and web:** untouched by every task (rev 1 and rev 2); on rev 2's end state the root `npx tsc --noEmit` is clean, the root `npx jest` passes (180 suites, 1234 tests, 1 skipped as on `main`), web `npm run verify` is green (43 files, 548 tests; 1 file, 3 tests). Not done in the dry run: the CI reproduction on Node 22.12 with only `web/` and `extension/` installed — it stays in "Before the PR".
- **Mutations:** every named mutation above was run alone in a fresh `git archive` copy of the end state (`node_modules` linked), `tsc` first, unit mutations under `timeout 300`, the E2E ones (`M11a`, `M11b`) with the build under `timeout 600`: **122 of 122 red**. Rev 1's first full run had twenty that did not compile (item 14) and three that stayed green (item 13); every one is red in its final form above. Rev 2 adds seventeen (M3s–M3u, M4v–M4x, M4z, M5k, M6o–M6r, M8j–M8m, M10g) and re-anchors four whose lines it changed (M3m, M3n, M6j, M8e); the whole set was re-run on rev 2's end state.

What the dry run caught:

1. **The unlock hook's flag broke B1b's "only signing keys" E2E (Task 5).** The first form stored `hooked: true` in `v1_dapp_session` at every unlock; `unlock.spec.ts` asserts the unlocked session holds `v1_session` alone. The flag now lives in the background's memory (R10); mutation M5h pins that a lock resets it.
2. **The spec's lookalike example is not a lookalike (Task 1).** `xn--phntom-4nf.app` is the "phantom" with a Cyrillic a (U+0430); the mockup's `xn--phntom-ezv.app` decodes to a Tibetan letter and classifies unknown (R2) — pinned both ways.
3. **Confusables maps the ASCII `m` to `rn` (Task 1)**, so a skeleton compared with a raw listed domain misses every domain with an `m` (R1, M1b).
4. **`ServiceWorker.stopAllWorkers` did not stop the extension's worker (Task 11).** B1c-24's first form "passed" without a restart; `runtime.getContexts` showed the same worker before and after. Closing the worker's CDP target stops it; the spec now proves it (no background context while stopped, another one after) — R30.
5. **The E2E harness deadlocked on its own request (Task 11).** `approvalWindow` awaited what `act` returned — the request's promise, which settles only once the window decides. It ignores it now (and catches it, so a request left open at teardown is no unhandled rejection). The window's own `close()` can precede a listener: closing is polled (`windowClosed`), and "no window" is a `page`-event listener (`noWindow`), not a page count (the previous window's close changed the count).
6. **The class gate reads a string argument as a class (Task 8):** `shakeClass('perms')` inside a `className` expression flagged "perms". The shake state is precomputed as numbers.
7. **`.s-secintro` styles nothing outside the vault page (Task 8):** `unstyledClasses` refused it on the window's screens (R28).
8. **Playwright will not click an `aria-disabled` button (Task 12):** #47's locked Connect is `aria-disabled` by design (the tap shakes the gate); the visual pass clicks it with `force: true`, as a person can.
9. **The window does not poll with nothing waiting (Task 12):** two requests arriving after its first read showed only on the next poll trigger (R33); the visual pass triggers focus, as a user returning to the window does. (Rev 2: the window now polls whenever it shows a request — R33 — so this limit is gone; the focus trigger stays, harmless.)
10. **A fake second keypair (Task 5):** `vault.setKeys` refuses a secret key that does not derive its address; the hook tests use a real second keypair (32 × 0x02).
11. **"Permit2" holds the word "Permit" (Task 6):** a word is a maximal run of ASCII letters (§3.2 step 6); the test was wrong, the rule right.
12. **The writing tool turned `\u` escapes into the characters (Tasks 1, 6, 8, 9):** `classify.ts`'s format-character class held literal bidi characters in the first draft. Every added file was re-escaped; the Global Constraints' `grep` over the added files is empty.
13. **Three tests passed their own mutation (Tasks 6, 8, 10).** M6j: the lock test locks before `finishSign`'s first section, so the second section's deciding check never ran — a new test locks and unlocks during the key read, between the sections. M10e: the sort test's grants were in the same order by name and by last use — it now uses two that differ, both ways. The window's poll (first named M11b on E2E B1c-19, green there because the unlock took long enough for a 5 s poll to land inside the wait): the unit test's deadline was `POLL_MS * 2`, which a slower poll widens — it is the literal two seconds now, and the mutation is Task 8's M8i.
14. **Twenty mutations did not compile (Tasks 1–7, 9).** Deleting a check left its import or constant unused (`noUnusedLocals`), and deleting the locked check left `tx.session` possibly null — `tsc` refused the mutant before any test ran. Each now neutralises the check in place (`&& false`, `void name`, `'$&'`, a different error code), so the mutant compiles and the test is what turns red.
15. **Rev 2 — the unlock flag's interleaving cannot be produced (review 1 L6).** The flag is now written inside the hook's section and cleared if the commit fails. A mutation moving it back after the section stays green: the lock's section awaits storage before it clears the flag, so no test can put the whole lock between the commit and a write right after it — the review could not provoke it either. The test pins the outcome both placements keep, says so in a comment, and no mutation is named for it (a check is a check only if a mutation proves it).
16. **Rev 2 — block's queue rejection is unreachable through the page path (review 1 M3).** C3 admits one open request per host, and the head is the one being blocked; the review's "a second request from another tab" is `request-pending`. The test seeds the second entry (another port of the host) and proves the page path refuses it first (positive control); M4x is red on it.
17. **Rev 2 — two re-check halves are narrowing, not tests (review 1 M4).** In `finishConnect` and `finishSign`, `tx.session === null` cannot be reached: a lock answers a `deciding` entry before either section runs (the lock tests). Both stay as the type's narrowing and are stated so in the code; the halves a test can reach — the account removed meanwhile (connect and sign) and the host blocked meanwhile (connect) — have their tests and mutations (M4v, M4w, M6p).
18. **Not caused by this plan:** `npm audit` is not clean on `main` (R32). The dry run's own `pkill -f replay.py` killed the shell that ran it — the standing rule (kill by PID) exists for exactly this.

## Before the PR (the standing rules)

- [ ] Reproduce CI with **only** `web/` and `extension/` installed, on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`), npm 11.6.2: `npm ci --ignore-scripts` in both, `npm run verify` in both, `npm run e2e` in `extension/` — in a normal launch and under `unshare -rn`.
- [ ] No task touches the repository root's `src/`, `core/` or `web/`; run the root `npx tsc --noEmit` and `npx jest` anyway, and web's `npm run verify`.
- [ ] `node scripts/check-no-tge-date.mjs` from the repository root — this plan and every file it adds are clean.
- [ ] The opus-tier visual review of Task 12's 37 shots against index.html (#46 ix:17442-17686, #47 ix:17686-18261, #49 ix:18705-19100 with its DS class map, #31 ix:13552), then an independent opus review of that review; each finding fixed or declared in the spec's §9; the result in the PR description.
- [ ] The owner has read Scope §3 (R1–R39) — in particular the copy checks R5, R21, R24, R31 (still pending), the icon ruling R37 and the spec fix R2 (now in spec rev 3.1) — and the Fable 5.1 review of this plan is applied (rev 2; owner rule).
- [ ] The PR says loudly: B1c-1 is a merge-to-`main` milestone, not a release (D10); no store build carries B1c until B1c-2 and B1c-3 are merged; the `<all_urls>` update consequences are B1e gates (§6.5).

## Self-review

- **Spec coverage.** §1.1 (Task 7: one wallet, plan 1's four features, the icon, targetOrigin; the stated limits in Scope §4); §1.2 (Task 7: the five types, lazy port, prerender, reconnect + resume, ping, ack; `page.*` from the page dropped — M7a); §1.3 (Task 3: the origin rule for ports, partitions, keyed from `port.sender`; R6 for dev builds); §1.4 (Tasks 3, 4, 6: every page and privileged message; events only to granted origins — M5d); §1.5 (Tasks 3, 4, 6: queue entry, `deciding` before any effect, the restart rule, delivery, resume, ack, ten-minute cleanup, five minutes from `arrivedAt` for `queued` and `deciding`, the 30-second deadline of a dead effect — R38); §1.6 (Tasks 3, 7: the six codes, fixed English messages); §1.7 (Task 7: content scripts, the reason, no new permission, CSP unchanged; Task 8: `approve.html`, `src/approve` in the isolation gate); §2.1 (Tasks 2, 4, 5: grants, cap, `recent`, an account removed, the keys); §2.2 (Tasks 3, 5: every row — B1c-19 too); §2.3 (Tasks 3, 4, 8: opening, polling, `documentId`, `onRemoved`, next head, Q12, expiry, every `dapp.decide` row, cooldown and budget, revoke / disconnect / block / removal reject the queue); §2.4 (Task 5: both hooks, every caller, the second pass, the popup counts as a window); §2.5 (Task 1: list, rules, Q18, Display); §2.6 (Tasks 2, 4: by host, revoke on block, no window, unblock keeps nothing); §2.7 (Task 4: token, single-shot, every refusal); §3.1 (Task 8: 47a, 47b, lookalike, cap, outcomes, C15); §3.2 (Tasks 6, 9: rules 1–7, every state); §4.1–§4.4 (Tasks 8, 10); §5 (every row has a test — the closed tab and timing are §7's accepted limits); §6.1 (every item, with its mutation); §6.2 (Task 7: permissions pin, page-bundle gate, isolation fixtures, dev-origin gate; CSP gate unchanged); §6.3 19–24 (Task 11); §6.4 (Task 12, B1c-1's states); §7 and §9 (Scope §3 adds R1–R39).
- **Rule 6 and C15.** Every confirming, rejecting, revoking, blocking and opening control is a `LockedButton`; the confirming ones also go through `ConfirmButton` (held 500 ms, Enter prevented — M8a, M8b, and Enter in a real browser in B1c-19). Ack rows, scope rows, the account picker, the Sort button and the sheet's close are toggles or idempotent, not LockedButtons (a second tap is indistinguishable or undoes the first).
- **Generation checks.** The window (`reads` + `alive`, M8h), #49 (`reads` + `alive` after every read and action), #31's count; in the background, every effect section re-checks its entry is still this instance's `deciding` one (M6j; the connect lock test), the account still in the session (M4w, M6p) and, for a connect, the host not blocked (M4v); the unlock hook re-checks grant, account and block (M5k).
- **Placeholders.** None: every step has its code (new files in full, changes as exact diffs, three generated files with their scripts and pinned hashes), its command and the dry run's expected output.
- **Type consistency.** The Interfaces blocks are the exports as they compile; the replay compiled and tested every task on its own predecessor.
- **Copy.** Every visible string is the spec's (§3, §4, Q01–Q24) or the design's own as the spec quotes it, except the rulings flagged for the owner: R5 ("a non-Latin letter"), R21 (singulars), R24 (the history row words), R31 (#37's sentence).

## Execution handoff

Plan complete. Execute with superpowers:subagent-driven-development (a fresh implementer per task, the two-stage review between tasks; Tasks 3–6 — the partition, the lifecycle, the decide table, the hooks and the signature — reviewed as the security core; Task 12's shots reviewed by an opus-tier reviewer), or superpowers:executing-plans in one session with checkpoints. Every plan goes to a Fable 5.1 review before execution (owner rule).

## Review 1 (Fable 5.1) — how each finding was applied

Review: `.superpowers/sdd/b1c-plan1-review-1.md` (rev 1 at 5182fa0; verdict "approve after fixes", no High). Every finding applied; the tasks below were re-replayed and every mutation re-run (Dry-run record).

| finding | what changed | where it landed |
|---|---|---|
| **M1** a `deciding` entry never expires | `Entry.decidingAt` (written with `deciding`); the sweep answers a `deciding` entry `timeout` five minutes after `arrivedAt` (C4 "queued or shown") and `rejected` 30 s after `decidingAt` when it is this instance's (`DECIDING_TTL_MS`) | Task 2 `store.ts`; Task 3 `queue.ts` `sweep` + two `lifecycle.test.ts` tests ("a deciding entry that never answers"); Task 4 `decide.ts`; Scope R38; mutations M3s, M3t |
| **M2** sign request from a cooling-down host untested | a test: three rejected sign requests, the fourth `rejected` with no entry and no window (positive control: the three were queued) | Task 6 `signMessage.test.ts`; M6o |
| **M3** block / revoke all / account removal leave the queue | tests with a queued request of each kind: block (seeded — the page path cannot queue a second request of one host, item 16), revoke all (two origins' sign requests; an ungranted origin's connect left queued), account removal (the removed account's origin rejected, the kept one queued) | block: Task 4 `decide.test.ts` (M4x); revoke all and account removal need a queued sign request, so their tests land in Task 6 (`decide.test.ts` M6q, `lockHook.test.ts` M6r) |
| **M4** the effect sections' re-checks untested | `finishConnect`: tests for a block and an account removal between the sections; `finishSign`: the account re-check added (an account removed while its key is read) and tested; `unlockWork`: a test for a restored block; the unreachable `tx.session === null` halves stated as narrowing (item 17) | Task 4 (M4v, M4w); Task 6 `signMessage.ts` + test (M6p); Task 5 (M5k) |
| **M5** icon PNG, spec says SVG | kept, with its reason — the owner's mark exists only as a raster | Scope R37 (for the owner) |
| **L1** / **R33** an expiry does not reach the window | the window polls every second while it shows anything; a test: a single shown request expires and the window closes within two seconds | Task 8 `Approve.tsx` + `connect.test.tsx`; R33 rewritten; Review Focus 2; M8j (M8e re-anchored) |
| **L2** report / block accepted while locked | refused while locked (`locked`), as every write of the user's lists; [Reject] still accepted | Task 4 `decide.ts` + the "unlocked" row's test; R8; M4z |
| **L3** `lastUsedAt` written on every request | at most once a minute per grant (`LAST_USED_STEP_MS`); a test with a loop of silent connects | Task 3 `pageApi.ts` + `lifecycle.test.ts`; R36; M3u |
| **L4** the confirm sheet focuses a control; not re-held on focus | `Sheet` gains `focusControl` (false: the panel takes the focus); `RiskConfirm` uses `useArmed`; a test for both | Task 8 `Sheet.tsx`, `ui.tsx`, `connect.test.tsx`; M8k, M8l |
| **L5** the port dropped from the card and #49 | `siteLabel(origin, host)`: `host:port` when the origin has an explicit port | Task 8 `ui.tsx` (+ Task 9's `Sign.tsx` call) + test (M8m); Task 10 `ConnectedApps.tsx` + test (M10g); R35 |
| **L6** the unlock flag set outside the section | set inside the section, cleared if the commit fails; the interleaving cannot be produced, so the test pins the outcome and no mutation is claimed | Task 5 `queue.ts`, `lockHook.test.ts`; item 15 |
| **L7** spec text vs R2, R9 | spec rev 3.1: §2.5 and §6.1's IDN example is `xn--phntom-4nf.app` (the design's `xn--phntom-ezv.app` decodes to a Tibetan letter); §1.4's `dapp.blocked.remove {host}` | `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (this commit) |
| **L8** linked vs copied `node_modules` | stated: linked for unit and E2E mutations; copied for anything that runs the gates or reads module maps | Global Constraints (Mutations) |
| **L9** Firefox `port.sender.origin` | a line of B1e's manual Firefox run; the E2E spec's header says it exercises Chromium only | Scope R39; Task 11 `dapp.spec.ts` header |
| **L10** nits | why `settle()` takes 20 turns (Task 3 `pageHarness.ts`); the classic-script pattern's `}import(` limit — a hit means look (Task 7 `check-page-bundles.mjs`); B1c-24's `contextId` check holds on the floor Chrome 122 and R30's positive control is kept as written (Task 11, unchanged) | as listed |
| the ruling table | R1–R32, R34 accepted as written; R33, R35, R36 changed as above; R37–R39 added | Scope §3 |
