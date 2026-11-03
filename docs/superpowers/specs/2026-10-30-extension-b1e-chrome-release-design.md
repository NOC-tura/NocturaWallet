# Noctura Extension B1e — the first Chrome Web Store release

**Status:** rev 2.6, 2026-11-03 — the owner-facing departures the B1e-1 fix rounds of Tasks 2, 3 and 5
made after rev 2.5 (the final review's Important 1, `.superpowers/sdd/2026-11-02-extension-b1e-plan1/final-review.md`)
and the changes of the final fix wave (its Minors 1, 3, 5, 6, the ledger's four fix-now rows, the controller's rulings),
each one line under "Rev 2.6", the passages they name edited to match. Rev 2.5, 2026-11-03 — the B1e-1 plan's Task 4
review (I1, the controller's ruling: the mark cap counts nonspacing / enclosing marks only), under "Rev 2.5". Rev 2.4, 2026-11-02 — the B1e-1 plan's Fable review 2 (`.superpowers/sdd/b1e1-plan-review-2.md`: N1, N4)
and the controller's rulings on its owner questions, under "Rev 2.4". Rev 2.3, 2026-11-02 — the B1e-1 plan's Fable review 1 (`.superpowers/sdd/b1e1-plan-review-1.md`: I1 and
its Minors) and the owner's answers E19–E22, each one line under "Rev 2.3", the passages they name edited to match.
Rev 2.2, 2026-11-02 — text only: the departures the B1e-1 plan's dry run made from rev 2.1 (each one line
under "Rev 2.2", the passages they name edited to match); no owner decision changed. Rev 2.1, 2026-10-30. Rev 1 (70e691d): the owner approved the design in conversation section by section
(2026-10-30: the release target, the presale decision, the hardening scope, where the legal pages live, D10, D31, then
the four design sections). Rev 2 applies Fable review 1 (`.superpowers/sdd/b1e-spec-review-1.md`: C1, C2, I1–I9 and
the twelve Minors) and the owner's answers to its six questions (`.superpowers/sdd/b1e-owner-decisions.md`, E9–E14).
Rev 2.1 (on 43c4589) applies Fable review 2 (`.superpowers/sdd/b1e-spec-review-2.md`: N1–N4 and its nine Minors) and
the owner's answers E15–E18.
Parent specs: B1 (`2026-09-27-extension-b1-design.md` §5 "Build, gates, release" and its release gates), B1b-2b (D10,
D31), B1c §6.5, B1d §6.5 and §7. Binding design: `/home/user/Downloads/index.html` (+ `screen.md`) — it contains the
TGE date; nothing is copied from it.

**Rev 2.6** (the B1e-1 final review and its fix wave, 2026-11-03; every line is a departure from rev 2.5's text, ruled
by the controller and recorded in the plan's ledger — the passages named are edited to match):
- §2.2 (Task 2's ruling): the removal's `no-wallet` outcome shows "No wallet on this browser yet." with [Set up a wallet].
- §3 (Task 3 fix round 1, I1): a refusal notice on the removal resets the confirmation — the box unchecked, the hold
  released — so no notice keeps a checked box standing.
- §3 (Task 3 fix round 1, M2): #37's checkbox is disabled while a send is open.
- §3 (Task 3 fix round 1, M1): checking the box while a hold is in progress ends the hold; the button then waits for
  its one activation (the vault page already did).
- §1.4 (Task 5 fix round 1, Minor 1, a controller ruling): `dapp.pending` answers `phrase: null` when no envelope is
  stored — the accepted apply-vs-delete race can leave a phrase behind with no wallet, and a no-wallet state draws no line.
- §1.4 (the final review's Minor 1, a controller ruling): one reading of "a wallet is stored" on the phrase path —
  `wallet.state`'s `phrase` and `dapp.pending`'s are null unless the stored vault is a wallet this version accepts
  (`envelopeShape`); a vault this version refuses (§2.1) shows no phrase on the popup either, as no approval window
  draws one and #9 shows the update screen without one. `wallet.state`'s `hasWallet` (the popup's routing) is unchanged.
- §1.3 (Task 5 fix round 1, Minor 2): #10 reads the phrase again once a change or a removal is applied, so its line
  shows what is now stored.
- §1.2 (Task 5 fix round 1, Minor 4): the phrase is its own bidi run (`dir="auto"`) on every surface — an RTL phrase
  keeps its own order whatever the line's direction.
- §4.3 (the ledger's T6 M1): the gate matches the scheme in any case (`HTTPS://…` is navigated like `https://…`); the
  table compare stays exact, so an upper-case string fails.
- §4.3 (the ledger's T6 M2): the gate also reads `.mjs` and `.txt` files; `fonts/LICENSE.txt` (the Geist fonts' OFL
  text, which names its licence's home page) is skipped by its exact path, beside `licenses.html`.
- §4.2 (the ledger's T6 M3): the stub's test checks its export list exactly (`CommonClient`, `WebSocket`, no other).
- §9 (the final review's Minor 5, ledger T7 D1–D3, a controller ruling — the design system's gutter and spacing are
  binding): in the approval window the phrase line spans the body's 20 px content gutter — under the top bar on #46,
  #47, #48 (F12 too), and on the locked window first in the body, 20 px from the window top; on onboarding's step the
  helper and the help are the design system's --space-2 apart and a refused write's line sits directly under the field;
  #35's card keeps its own --space-3 between the field, the helper, the actions and the help.
- §2.3 (the final review's Minor 6, ledger T2 M1, a controller ruling): on the damaged states the save note sits
  directly under Save (in the bar, with Save, above Remove), as it does on the removal.

**Rev 2.5** (the B1e-1 plan's Task 4 review, I1, the controller's ruling, 2026-11-03; §1.5 edited to match):
- §1.5 (I1): the cap counts only nonspacing / enclosing marks (Mn, Me) — the ones that stack over or under a letter;
  spacing marks (Mc) advance like letters, are not counted and break a run. Ordinary Burmese (four Mn / Mc marks on one
  consonant) is accepted; four nonspacing or enclosing marks in a row are still refused.

**Rev 2.4** (the B1e-1 plan's review 2 and the controller's rulings on its owner questions, 2026-11-02):
- §1.5 (N1): the combining-mark cap is counted after canonical decomposition (NFD), so a precomposed letter's own
  marks count (`a` + four graves, `ǘ` or `ậ` + three marks are refused; Vietnamese, polytonic Greek, pointed Hebrew,
  Tibetan, Thai, Arabic harakat and Hangul are accepted).
- §1.5 (N4, ruled): the cap stays three; its scope limit is stated — it refuses cantillated Hebrew, Vedic Devanagari
  and Quranic-annotated Arabic (four marks on one letter). A long phrase wraps and is never cut (N3, ruled, as
  designed). No migration: no phrase stored before this rule exists outside development profiles.

**Rev 2.3** (the B1e-1 plan's review 1 and the owner's E19–E22, 2026-11-02; the passages named are edited to match):
- §1.5 (I1, E21): a phrase that renders blank or draws out of its line is refused — every Default_Ignorable code point
  (the Hangul fillers U+115F, U+1160, U+3164, U+FFA0 and U+17B4 / U+17B5 among them), the Braille blank U+2800, the
  replacement characters U+FFFC / U+FFFD, and more than three combining marks in a row; a phrase must hold at least one
  letter, number, symbol or punctuation character. Rev 2.2's "printable" line was not the whole rule.
- §1.3 (E20): onboarding's step stays count-less; its overline is "Optional", not "Onboarding".
- §2.2 (E19): the refused state's heading is "Update Noctura to open this wallet"; "This version of Noctura can't open
  this wallet's data." is its first body line.
- §0: E19–E22 added to the owner decisions.
- §4.2 (review M1): the `rpc-websockets` gate calls a map without a `chunks` section INCONCLUSIVE (it passed vacuously).
- §4.2 (review M6): `licence-ids.json` classifies only a package with no `license` field; a present field outside the
  allowlist (an SPDX expression, a `{type}` object) fails, and the failure says the table cannot override it.
- §4.3 (review M4, the controller's ruling on Q6): the link gate is a review aid, not a security boundary.
- §4.3 (review M5): the gate reads `.svg` files too.
- §10 (review M7): `presaleBuilds.test.mjs` builds with `NODE_ENV` removed — it is the only test that runs
  `build.mjs`, and `verify` and CI run it with no `NODE_ENV`, so it now checks the build that ships.

**Rev 2.2** (the B1e-1 plan, 2026-11-02; every line is a departure of the built code from rev 2.1's text, ruled in the
plan and recorded in its ledger — the passages named are edited to match):
- §1.2: R9's line also covers a `phrase` field that is missing or not a phrase the background would store — the screen
  re-judges it with `cleanPhrase` and never refuses the rest of the view.
- §1.2: the line is also on the approval window's locked state and #48's origin-mismatch notice (every window state,
  through the window's top), and it carries a screen-reader label "Anti-phishing phrase: " before the phrase.
- §1.2: #9 and #10 read the phrase only once the stored vault is a wallet; the no-wallet and damaged states have no
  password field and show no line.
- §1.3: `vault.challengeInfo` describes a phrase challenge as `{kind: 'phrase', action: 'change' | 'remove'}` — the
  bound value never reaches #10; change and remove while locked answer `locked`; `unchanged` is answered first.
- §1.3: #10's end states for a phrase challenge are the settings kind's; #35's card never shows the stored phrase; the
  onboarding step answers any refusal with the common "try again" line and keeps [Skip].
- §1.4: a stored value that is not exactly a clean phrase reads as none.
- §1.5: "printable" also refuses lone surrogates, private-use and unassigned code points (Cs, Co, Cn); look-alike
  letters of another script are accepted.
- §2.1 + §2.4: both readings ask the opener first — a value either opener accepts is a wallet; only a refused value is
  split into unreadable / refused (the partition test keeps the order invisible today).
- §2.2: the removal is its own vault-page mode, `unlock.html?mode=remove-damaged`, which reads, judges and shows the
  value itself (no URL parameter); #9 and #1 show one shared damaged screen.
- §2.2: `busy` and the page's own digest compare are one outcome ("The stored data changed — check it again");
  `send-open` shows #37's line with [Start again] and [Close this tab], no [Unlock]; a wallet found says "A wallet
  already exists in this browser. Nothing was changed."; the address carries #37's caption "This wallet's first account".
- §2.5: `vault.setKeys` answers `unknown-account` (as before) when no vault is stored, `malformed` for an unreadable or
  refused one.
- §2.6: M-lock's session is written inside the lock's own session section (the one step 6 must see); a session present
  before the click is locked by step 3 and has its own control and mutation (M-lock-first). Both fixtures are pinned by
  sha256; the 458dfcd vault is §2.1's out-of-predicate case (its seed fails AES-GCM).
- §3: the checkbox is directly **above** the button (in the DOM, on screen and in tab order) on #37 and on the removal,
  shown only while DELETE matches; the button's name follows it ("Hold to delete" / "Delete wallet" / "Remove damaged
  wallet") and the hold's instructions hide while it is checked; Space toggles it, Enter on it does nothing (native).
- §4.1: #1's line stays **above** the buttons, where the design draws it; every link row carries a screen-reader suffix
  " (opens in a new tab)"; #38's "142 packages" count is not built (the popup cannot know it).
- §4.2: the static-page rule adds a tag and attribute allowlist; the licence gate also requires each package's
  `licenses.html` to equal the page its maps give; a missing page is INCONCLUSIVE.
- §4.2: the `rpc-websockets` gate is stricter — the package in no chunk of any map, and the stub rendering 0 bytes.
- §4.2: a package without a licence file is headed "Author: …" or "The package names no author."; the fonts' entry
  pins both faces to geist 1.7.2 by sha256 and `fonts/LICENSE.txt` ships in every package; licence lines are wrapped
  at 100 columns (a window narrowed to 412 px still scrolls sideways — accepted).
- §4.3: one presale-build-only row, `https://noc-tura.io?ref=${}` (#24's invite link; an interpolation folds to `${}`),
  refused in the store build; each row is allowed only in the files it is found in.
- §5.6: B1e-1's test pins `RP_ID` to `HOST_PERMISSIONS`; the `rp-id.json` half lands with B1e-2's gate.
- §10: R9's E2E strips the field inside the page (the real background always sends a valid one); the visual pass
  runs on the store build at 412 × 600 (popup), 412 × 916 (vault page) and 412 × 720 (approval window).

**Rev 2.1** (review 2; §12 maps each finding):
- §4.3 + §4.2 (N1): the link gate skips `licenses.html` by name; the static-page rule there now refuses `<a`, `href=`,
  `<script`, `<link`, `<style`, `style=`, `on…=`, `<iframe`, `<form`, with mutations.
- §4.2 (N2, E15): `Unlicense` joins the allowlist; a committed `name@version → SPDX` table classifies packages without
  a `license` field; an unclassified package fails the build.
- §4.2 + R7 (N3, E16): the licence page and its gate take only modules with rendered code (`renderedLength > 0`,
  recorded by `chunkModules`); `rpc-websockets` renders 0 bytes today — no LGPL code ships; the alias stub stays as a
  precaution (`CommonClient` class, `WebSocket` function); web3.js is 1.99.0.
- §6.1 P12/P13, §6.4, §5.6, §7 (N4, E17): nothing is served at `wallet.noc-tura.io`; passkeys show under that name;
  1.0.0 freezes the RP ID (a pre-upload gate records it); a test pins `RP_ID` to `HOST_PERMISSIONS`.
- §0 (E18): R1 and R4 are owner decisions now.
- Minors 1–9 of review 2: §2.1, §2.2, §2.6, §1.3, §4.2, §7. The decrypt-damaged delete is §8 (former §11 Q2).

**Rev 2** (every change traces to a finding or an owner decision; §12 is the table):
- §2 rewritten: a FROZEN structural predicate for "unreadable" (§2.1, E9, C1) beside a second state, "refused by this
  version" (not deletable; "update the extension"); a new vault-page-only message `vault.forgetDamaged` bound to the
  sha256 of the raw stored JSON (§2.4, C2); "Save the damaged data" (§2.3, E10); #37's confirmation (E11); an open
  send refuses (E12); sessions over an envelope the background refuses (§2.5); a committed-fixture control and named
  mutations (§2.6).
- §1: the phrase rides on three existing answers (`wallet.state`, `vault.status`, `dapp.pending`), never a new read
  type (I2); set-when-none needs no proof, change and remove do (I6, R1); the onboarding step runs after
  `commitWallet` (I6); a built-content-script `storage` gate (I2); Minors 1–4.
- §4: the link gate rewritten to be true of the real package (I1, probe in §4.3); `licenses.html` as a static root
  page the gates admit by name, with defined inputs (I9); an LGPL finding (R7, §11 Q1) — wrong, corrected in rev 2.1
  (N3: no LGPL code ships).
- §5: one version source (`extension/package.json`), the `key` render option and its gate, a hand-written STORE zip
  (I8); the release script reuses `verify`'s package with a third digest witness (Minor 12).
- §6: the privacy text re-derived from the code's real network calls as exact sentences (I3, I7); retention a
  release-blocking ICO dependency with the question to ask (I4); the CWS data-usage answers (I5, E13).
- §7: the external review gates Unlisted (E14). §0: E9–E14 and the spec rulings R1–R10.

## 0. Scope and decisions

B1e is cut down to **the first release: Chrome Web Store, presale off**. It is one spec with two plans:

| plan | what |
|---|---|
| **B1e-1 — code** | the anti-phishing phrase (§1), the damaged-vault paths (§2), #37's accessible confirmation (§3), the Terms / Privacy / licences / Help links and `licenses.html` (§4), the gates of §4.3 and §1.6 |
| **B1e-2 — release** | the release build and its checks, the version and the stable ID, the zip (§5); the store material, the privacy policy / terms / help texts for ICO to publish, the live check (§6); the owner's submission checklist (§7) |

| # | Owner decision (2026-10-30) | Where |
|---|---|---|
| E1 | The first release is **Chrome Web Store**; Firefox (AMO) is a later step with its own open points (B1c §6.5) | §0, §8 |
| E2 | The store build is **`--no-presale`** (B1d D2). Site purchases are still screened by the region gate (F12, D15) | §5, §6.1 |
| E3 | Of B1's deferred hardening, only the **anti-phishing phrase** ships now; the drainer list and the DNR spike are later | §1, §8 |
| E4 | Terms, Privacy and Help live on **noc-tura.io**, published by ICO from texts this work writes; the owner (or a lawyer) approves the Terms | §4, §6 |
| E5 | D10: a **damaged vault gets a delete path** behind a typed confirmation | §2 |
| E6 | D31: #37 gets an **accessible alternative to the hold** (a checkbox), the typed word and the proof stay | §3 |
| E7 | One spec, two plans | §0 |
| E8 | The privacy / support contact on every page is **privacy@noc-tura.io** | §6 |
| E9 | **Two states, not one predicate** (review Q1, C1): only a vault that is truly **unreadable** — by a frozen structural predicate — is deletable without a password; a vault **refused by this version** (a newer envelope version, a stricter KDF or account policy) is **not** deletable, and the screen says "update the extension" | §2.1, §2.2 |
| E10 | Before removing a damaged vault, offer **"Save the damaged data"**: a download of the raw stored JSON through `<a download>` on the vault page, no new permission. In this release | §2.3 |
| E11 | The damaged-vault removal uses **the same confirmation as #37**: typed DELETE + (the hold, or the checkbox and one click) | §2.2, §3 |
| E12 | A damaged vault with an **open send** (`v1_pending`) is refused until the send settles, as E5 / #37 today | §2.4 |
| E13 | The CWS data-usage form ticks **"Website content"** (the site hands the transaction bytes, which go to the coordinator's simulation) | §6.3 |
| E14 | The **independent external security review is done before the Unlisted listing** (before any distribution); uploading the zip for store review without publishing may happen earlier | §7 |
| E15 | **`Unlicense` joins the licence allowlist**; a committed `name@version → SPDX` table classifies packages without a `license` field; an unknown package fails the build (review 2 N2) | §4.2 |
| E16 | Keep the **`rpc-websockets` alias stub** as a precaution **and** the licence page / gate on **modules with rendered code** (`renderedLength > 0`) (N3) | §4.2 |
| E17 | The passkey **RP ID stays `wallet.noc-tura.io`**; 1.0.0 freezes it for every enrolled passkey (a pre-upload gate records it); a test pins `RP_ID` to `HOST_PERMISSIONS` (N4) | §5.6, §6, §7 |
| E18 | **Confirmed: R1** (the first phrase is set while unlocked without a password re-check; change / remove behind #10) **and R4** ("Save the damaged data" on both damaged states) — owner decisions now, no longer spec rulings | §1.3, §2.3 |
| E19 | (2026-11-02, plan review 1) The **refused-by-this-version** screen gets the short heading "Update Noctura to open this wallet"; the sentence it had becomes the first body line | §2.2 |
| E20 | (2026-11-02) Onboarding's phrase step stays **count-less**; its overline is **"Optional"**, not "Onboarding" | §1.3 |
| E21 | (2026-11-02) Phrases that **render blank or draw out of their line are refused**: Default_Ignorable code points, U+2800 and the other blank-rendering characters (the Hangul fillers U+115F / U+1160 / U+3164 / U+FFA0, U+17B4 / U+17B5), stacked combining marks beyond a cap; a phrase holds at least one visible non-mark L / N / S / P character | §1.5 |
| E22 | (2026-11-02) Keep #37's taller bar with the checkbox, and #35's plain-tone "Off" for the phrase | §3, §1.3 |

**Spec rulings (rev 2).** Decisions the review asked the spec to take that need no owner: each is the most secure
default, with its reason where it is applied. The owner may overturn any. **R1 and R4 are confirmed by the owner
(E18)**; R7's licence allowlist is the owner's list (E15).

| # | Ruling | Where |
|---|---|---|
| R1 | Phrase: **set when none is set** needs an unlocked session and no proof; **change** and **remove** need #10's proof — **owner-confirmed, E18** | §1.3 |
| R2 | The phrase reaches pages only as a field of `wallet.state`, `vault.status` and `dapp.pending`; its key is background-owned (no page may name it) | §1.4 |
| R3 | `vault.setKeys` binds the keys through `envelopeShape`, not only `readWalletView`: no session is created over an envelope the background calls `stored-invalid` | §2.5 |
| R4 | "Save the damaged data" is offered on **both** damaged states (unreadable and refused); removal only on unreadable — **owner-confirmed, E18** | §2.3 |
| R5 | One version source: `extension/package.json` `version` (first: `1.0.0`); `manifest/source.mjs` reads it | §5.2 |
| R6 | The store zip is a **hand-written STORE (uncompressed) zip**, no dependency | §5.4 |
| R7 | `licenses.html` lists only packages with rendered code and refuses any licence outside the owner's allowlist (E15); `rpc-websockets` (LGPL-3.0-only) is in the dependency graph but renders **0 bytes** — no LGPL code ships — and is aliased to a stub **as a precaution** against a future web3.js whose tree-shaking keeps it (E16) | §4.2 |
| R8 | The link gate matches **whole URL strings exactly**, scheme `http`, `https`, `ws`, `wss` and `ftp` included | §4.3 |
| R9 | A phrase read that fails shows a visible "could not be read" line, never silence | §1.2 |
| R10 | The release script packs `verify`'s own `dist-nopresale/chrome`, after a third build matches its digest | §5.3 |

Every element in §1–§4 that `index.html` does not draw is **undrawn and flagged** (§9); it is built from the design
system's existing components and shown to the owner in the visual pass.

## 1. The anti-phishing phrase (E3)

### 1.1 What it protects against

A website can draw, inside its own page, a fake "Noctura" window asking for the password or an approval. The phrase
is text the user chose; the real extension shows it, a website cannot read it: the page's own world has no extension
API, our content scripts never touch storage (§1.6 gate) and the background answers the reads below only to this
extension's own pages (`messages.ts:177`, `isOwnPage`). A window without the phrase is not the extension's.

What it does not protect against, said in the help text (Minor 3): **a site asking you to type or "confirm" your
phrase** — never type it into a website; and **anyone who uses this browser profile** can see it (it is shown before
unlock by design).

### 1.2 Where it shows

One line under the screen's header: a shield icon + the phrase as plain text (`textContent` on the vault page —
`SETS_MARKUP` already forbids markup there; a React text child elsewhere — never HTML):
- the vault page's unlock screen (`src/unlock/screens/unlock.ts`) **before** the password is typed, read in its
  `reading` phase, and the popup's locked screen (`src/app/screens/Locked.tsx`);
- every approval window: #46 sign message (`src/approve/Sign.tsx`), #47 connect (`Connect.tsx`), #48 transaction
  (`Tx.tsx`) — and the window's locked state and #48's origin-mismatch notice (rev 2.2);
- #10 re-authentication (`src/unlock/screens/reauth.ts`).

On the vault page the line shows only once the stored vault is a wallet: the no-wallet and damaged states have no
password field and no line. On the popup and in every approval window it shows only when the stored vault is a wallet
this version accepts (rev 2.6, §1.4). Every line starts with a screen-reader label "Anti-phishing phrase: " (rev 2.2),
and the phrase is its own bidi run (`dir="auto"`, rev 2.6). In the approval window the line spans the body's 20 px
content gutter, under the top bar on every request screen and, on the locked window (no top bar), first in the body
20 px from the window top (rev 2.6).

**No phrase set:** nothing shows; the extension behaves as today. **A read that fails** (no answer, an error, a
`phrase` field missing or not exactly a phrase the background would store — the screen re-judges it with `cleanPhrase`;
rev 2.2) while a
phrase may be set: the line says "Anti-phishing phrase could not be read — don't type your password until it shows"
(R9: silence would look exactly like a phishing window and like "no phrase"; the failure is rare — the background
answers these reads locked or unlocked).

### 1.3 How it is set (I6, R1)

The premise of rev 1 ("every settings change needs re-authentication") was wrong. B1 §1 (line 126, the message partitions — rev 1 and the review cited it as §3) requires #10 only
for `settings.*` **that weaken protection**, and the code does exactly that: `setSettings` (`walletApi.ts:221`) asks
`weakens(current, patch)` (`settings.ts`) and writes a strengthening at once. So the phrase's operations are judged
one by one:

| operation | proof | reason |
|---|---|---|
| **set** (no phrase stored) | none; an **unlocked session** required | adds a protection. The session requirement costs nothing (onboarding's step runs while the new wallet's keys are in the session; #35 is reached unlocked) and keeps someone at a **locked** profile from planting a phrase they know — a phrase the attacker knows is worse than none, because their fake window can then show it |
| **change** | #10 | someone at an unlocked popup could swap in a phrase they know; the change is a weakening of the same kind |
| **remove** | #10 | strips a protection |
| the same value again | none | `unchanged`, nothing written |

**The message.** A new privileged type **`settings.phrase {phrase: string | null}`** (in `WALLET_TYPES`, so the
approval window can never send it — `APPROVE_PAGE_ALLOWED` is inclusive, `messages.ts:94`). Under `settingsMutex`: the
value is cleaned (§1.5); stored none + a value + a session → written, `set`; stored none + no session → `locked`;
equal to the stored value → `unchanged`; otherwise a challenge of a new shared kind **`phrase`**
(`{kind: 'phrase', phrase: string | null}`, exactly two keys, added to `isAbout`, `reauthChallenges.ts`) is issued and
the answer is `reauth-required {challengeId}`, exactly as `setSettings` does it (the lock-race handling included).
`unchanged` is answered first; a change or a removal while locked answers `locked`. `vault.challengeInfo` describes a
phrase challenge to #10 as `{kind: 'phrase', action: 'change' | 'remove'}` — the bound value never leaves the
background (rev 2.2).
`vault.reauthOk` applies it from the value bound at issue — as it applies a `settings` challenge through
`applySettingsChallenge` (`walletApi.ts:261`) — and the stored value is re-compared at apply time, under the mutex
(the last confirmed proof wins, as review M6 ruled for settings). #10's "what this is for" line says "Change the
anti-phishing phrase" or "Remove the anti-phishing phrase" — never the new value (the phrase line on #10 shows the
current one; two phrases on one screen invite confusion). #10's end states are the settings kind's (rev 2.2); once a
change or a removal is applied #10 reads the phrase again, so its line shows what is now stored (rev 2.6).

**Onboarding.** A skippable last step: "Set an anti-phishing phrase", with one sentence on why. It runs **after
`commitWallet`** (`onboarding.ts:148`), never before: the first write, `storeEnvelope(null, …)`, calls
`removeWalletData` (defined at `accountsStore.ts:57`; its call in the first write at `:260`), which removes every `WALLET_DATA_KEYS` key — a phrase written before
the commit would be wiped by it. Placement:
- create: after #6 passkey's `done` (`createRun.ts:129`), before `wallet.html#/created` — not before #6, which would
  hold the typed password longer (#6 holds it, §3.5 of B1b-2a). The step has no count of its own after #6's "5 / 5";
  its overline is "Optional" (E20, rev 2.3);
- import: after `created`, before `wallet.html#/imported` (`importRun.ts:62`);
- `created-locked` (the keys did not reach the background): the step is skipped — `set` would answer `locked`; #35
  offers it.

**Settings → Security (#35):** a row "Anti-phishing phrase · On / Off"; set, change, remove. Its card never shows the
stored phrase; the onboarding step answers a refusal with the common "try again" line and keeps [Skip] (rev 2.2) — the
line directly under the field, then the helper and the help, each the design system's --space-2 apart (rev 2.6).

### 1.4 Storage and reads (I2, R2)

- **Key** `v1_phishing_phrase` in `storage.local`, plain text: added to `WALLET_DATA_KEYS` (`accountsStore.ts:52` —
  wiped by a delete and by a first write, kept by #39's restore, which replaces the envelope without
  `removeWalletData`) and to `BACKGROUND_OWNED_KEYS` (`check-vault-isolation.mjs:103`): no file outside
  `src/background/` may even name it, so no page can write it around the proof. A plain `ext.local.remove` (not in
  `LOCKED_DATA_KEYS`): a `settings.phrase` write racing a delete's cleanup can leave it behind, and the next first
  write's `removeWalletData` is the backstop — the same accepted race as `v1_settings` (`forgetWallet` step 7 comment).
- A stored value that is not exactly a clean phrase (§1.5) reads as none (rev 2.2): only the background writes the key.
- Not encrypted, on purpose: it must show before unlock, and it is no secret from the user's own machine, only from
  websites.
- **Reads ride on existing answers; no new read type:**
  - `wallet.state` gains `phrase: string | null` — the popup and the UI tab (answered locked or unlocked:
    `walletState`, `walletApi.ts:117`); null unless the stored vault is a wallet this version accepts (`envelopeShape`)
    — the same reading as `dapp.pending`'s (rev 2.6; `hasWallet` keeps its own, wider reading for the popup's routing);
  - `vault.status` gains `phrase` — the vault page's #9 and #10 (`vault.status` is already sent by `reauthFlow.ts`;
    the unlock screen adds one call in its `reading` phase);
  - `dapp.pending`'s answer gains a top-level `phrase` in every state (`pending()`, `dapp/decide.ts:159`) — the
    approval window, whose inclusive list (`dapp.pending`, `dapp.decide`) is unchanged; `null` when no envelope is
    stored or the stored one is not a wallet this version accepts (rev 2.6: the accepted apply-vs-delete race can leave a
    phrase behind with no wallet, and a refused vault is no wallet either).

### 1.5 Rules (Minors 1, 2)

- NFC-normalised, then trimmed; **3–32 UTF-16 code units** (as `cleanName` counts, `envelopeRules.ts:46`); no
  character of `FORBIDDEN_IN_NAME` (`envelopeRules.ts:43`: controls, format characters, line and paragraph
  separators, bidi embeddings / overrides / isolates, zero-width joiners, the combining grapheme joiner, variation
  selectors) — so a bidi override cannot restyle the line — and, for "printable", no lone surrogate, private-use or
  unassigned code point (Cs, Co, Cn; rev 2.2). **Nothing that renders blank or draws out of its line (E21, rev 2.3):**
  no Default_Ignorable code point (among them the Hangul fillers U+115F, U+1160, U+3164, U+FFA0 and the Khmer U+17B4,
  U+17B5), no Braille blank U+2800, no U+FFFC / U+FFFD (they stand for a character that could not be shown), at most
  **three nonspacing / enclosing marks (Mn, Me) in a row**, counted after canonical decomposition (NFD) so a
  precomposed letter's own marks count (`PHRASE_MAX_MARKS`: Thai needs two, pointed Hebrew, Tibetan stacks and
  polytonic Greek three; a fourth only builds a tower over the header above the line — rev 2.4; spacing marks (Mc)
  advance like letters, stack nothing and are not counted, so Burmese with four Mn / Mc marks on one consonant is
  accepted — rev 2.5; the scope limit, ruled: the cap refuses liturgical text with four nonspacing marks on one
  letter — cantillated Hebrew, Vedic Devanagari, Quranic-annotated Arabic), and at least one letter, number, symbol or punctuation
  character — so no phrase shows as an empty or broken banner a phishing page could copy. Look-alike letters of another script are accepted. This also refuses emoji written with a ZWJ or a variation
  selector (family emoji, ❤️ with VS16) — accepted, and the input's helper says "letters, numbers, symbols and simple
  emoji". The cleaner is `cleanPhrase` in `src/shared/envelopeRules.ts`, beside `cleanName`, sharing the regex.
- `null` (or an empty string after trimming) means "remove".
- **Never echoed:** every refusal of `settings.phrase` is a fixed code (`malformed`, `locked`, …) with no `data`
  carrying the value; the background never logs it.

### 1.6 Tests and gates

- The phrase on all six screens, in both builds; nothing when unset; R9's line when the read fails.
- `settings.phrase`: set without proof (unlocked), `locked` when locked with none stored, `unchanged`,
  change → `reauth-required` → applied by `vault.reauthOk`, remove → the same; a challenge applied after another
  change landed applies its own bound value; refusals carry no value (a test asserts the answer's JSON contains no
  character of the tried value).
- **Sender partition (Minor 4, replacing rev 1's vacuous "provider's world" test):** `wallet.state`, `vault.status`
  and `settings.phrase` from a sender whose `origin` is not the extension's → `forbidden`; `settings.phrase`,
  `wallet.state` and `vault.status` from `/approve.html` → `forbidden`; `dapp.pending` from `/approve.html` carries the
  phrase.
- Onboarding: the phrase **survives** the first write (set after `commitWallet`, then read back) — and a mutation
  that moves the step before `commitWallet` turns it RED.
- Wiped by #37's delete and by §2's removal, kept by #39's restore; a phrase `<b>x</b>` renders as text.
- **Gate (I2), `check-vault-isolation.mjs`:** the source rule already refuses `storage` in `src/relay` and
  `src/provider` (`TOUCHES_STORAGE`, line 654, outside `src/background` and `src/ext.ts`). New: the **built**
  `relay.js` and `provider.js` (each package: `dist*/{app,chrome,firefox}`) contain no `storage` reference
  (`.storage`, `['storage']`, a `storage` destructuring key). Today both have none (probe, §4.3: `relay.js` reaches
  only `runtime.connect`, `provider.js` no `runtime`). Mutation: a planted `chrome.storage.local.get` in
  `src/relay/index.ts` behind a source-rule exemption → the built rule fails.
- `v1_phishing_phrase` named in any file outside `src/background/` fails the existing `BACKGROUND_OWNED_KEYS` rule
  (mutation: name it in `src/unlock/screens/unlock.ts`).

## 2. Damaged vaults (E5, E9–E12, D10)

### 2.1 Three readings of `v1_vault` and the frozen predicate (C1, E9)

Today "damaged" is one bucket, and it is **policy**: the background's `envelopeShape` (`accountsStore.ts:151-184`)
refuses `v !== 1`, a KDF outside `ENVELOPE_KDF_MIN`/`MAX` (`envelopeRules.ts:17-18`), more than `MAX_ACCOUNTS`
accounts and anything `accountsPolicyOk` refuses; the vault page's `storedVault` (`stored.ts:22`) =
`checkEnvelope` (`envelope.ts:130`, the same version literal and `checkKdfParams` bounds) + `accountsPolicyOk`. A
wallet whose password opens it perfectly becomes "damaged" the day a release raises `PRODUCTION_KDF`, bumps `v` or
lowers a cap. A password-less delete keyed on that bucket would be offered to every such user. So B1e splits it:

| reading | when | deletable without a password? |
|---|---|---|
| **none** | `v1_vault` absent (`undefined`) | — (no wallet) |
| **unreadable** | `unreadableV1(raw)` is true (below) | **yes**, §2.4 |
| **refused by this version** | `envelopeShape(raw) === null` (background) / `storedVault(raw).kind === 'damaged'` (page), and **not** unreadable | **no** — "update the extension" |
| **wallet** | both sides accept it | — (#37 deletes it, with the proof) |

**The frozen predicate** lives in its own module, **`src/shared/unreadable.ts`**, exporting
`unreadableV1(raw: unknown): boolean`. It may import only `@scure/base` (for strict base64) — a source test pins its
import list to exactly that, so it can never reach `envelopeRules.ts` (`ENVELOPE_KDF_MIN/MAX`, `ENVELOPE_BYTES`,
`MAX_ACCOUNTS`, `accountsPolicyOk`) or `src/vault/envelope.ts` (`PRODUCTION_KDF`, `KDF_CAP`, the version literal).
Its constants are its own, named `FROZEN_*`, and its header says: *frozen at B1e rev 2; never edited — a later
envelope format gets its own rule in a new module; tightening the opener's policy never touches this file.*

`unreadableV1(raw)` is **false** for `undefined`, and **true** exactly when one of these holds:

1. **U1 — not an object:** `raw` is `null`, an array, a string, a number or a boolean.
2. **U2 — no version:** `raw.v` is not a safe integer ≥ 1 (missing, `"1"`, `1.5`, `0`, `-1`).
3. **U3 — a broken v1 structure** (only when `raw.v === 1`; for `v ≥ 2` this version cannot judge the structure, so the
   answer is false — refused, never deletable):
   - `scheme` is not a string;
   - `kdf` is not an object, or `kdf.alg !== 'argon2id'`, or any of `kdf.m`, `kdf.t`, `kdf.p` is not a safe integer
     (**any** value — no bounds), or `kdf.salt` is not strict padded base64 of exactly 16 bytes;
   - `seed` is not an object, or `seed.iv` is not strict base64 of exactly 12 bytes, or `seed.ct` not strict base64
     of at least 17 bytes;
   - `password` is not an object, or `password.wrapped` is not strict base64 of exactly 40 bytes;
   - `passkey` is present — `raw.passkey !== undefined`, as `checkEnvelope` and `envelopeShape` read it; so
     `passkey: null` is present and unreadable — and is not an object, or its `credentialId` is not strict base64 of at least 1 byte, or its
     `prfSalt` not of exactly 32, or its `wrapped` not of exactly 40;
   - `accounts` is not an array, or an entry is not an object with a safe integer `index` ≥ 0, a string `name` and a
     string `publicKey`.

Everything else is **readable**: unknown extra fields; an unknown `scheme` **string**; a KDF cost outside today's
bounds; an empty account list, more than 100 accounts, duplicate indexes, an empty `publicKey`, a `cli` wallet with
two accounts (all policy, `accountsPolicyOk`); any `v ≥ 2`. The byte lengths are v1's algorithms (Argon2id salt,
AES-GCM IV and tag, AES-KW of a 32-byte key, the PRF salt), fixed by `v: 1` itself — a format that changes them must
change `v`, which this predicate then refuses to judge.

**Partition, as a test:** for every value the predicate calls unreadable, `envelopeShape` returns `null` and
`storedVault` answers `damaged` (every U-clause is one of their checks) — so the four readings never overlap. Both
readings ask the opener first (rev 2.2): a value `envelopeShape` / `storedVault` accepts is a **wallet**, and only a
refused value is split into unreadable and refused — the partition test keeps that order invisible today, and if the
predicate and an opener ever disagreed, a value an opener can open would never be offered for a password-less removal.

**Out of the predicate, said loudly:** a vault that is readable and accepted, whose password unwraps the data key but
whose seed ciphertext then fails AES-GCM (`unlockFlow.ts` answers `damaged` after the unwrap), is neither unreadable
nor refused — it reads as a **wallet**. B1e does not change its path: #9 shows today's damaged notice and help
(`COMMON.damagedHelp`, `strings.ts:17`: remove Noctura, reinstall, import the phrase). Offering #37's proof-gated
delete from that notice is §11 Q2.

### 2.2 The screens (E9, E11, Minors 5, 6)

Both entry points that show the damaged notice today get the new states: #9 (`screens/unlock.ts`, its `damaged`
phase) and #1 welcome (`screens/welcome.ts:95`). The page decides which with `storedVault` and `unreadableV1` on its
own read of `v1_vault` (`readLocal`); the background re-judges at removal (§2.4).

**Refused by this version** — the heading "Update Noctura to open this wallet" (E19, rev 2.3), then "This version of
Noctura can't open this wallet's data." as the first body line + "Update Noctura (in Chrome:
Extensions → Update). If it is up to date, the data may have been changed. Nothing was removed." + today's
`damagedHelp` as the last resort. Buttons: **Save the damaged data** (§2.3). No removal.

**Unreadable** — "Wallet data is damaged" + "This browser's copy of your wallet can't be read by this or any later
version of Noctura." (true by construction: a later format gets a new `v`, which §2.1 never deletes; it is not a
promise about repair tools) + "Your funds are on Solana. After you remove this copy, **only your recovery phrase reaches them**." (O64's
wording, `DeleteWallet.tsx` `fundedTail`) — said **before** the typed word (Minor 6), never "funds are safe".
Buttons: **Save the damaged data**, **Remove damaged wallet**.

#9 and #1 show one shared damaged screen for both states (rev 2.2).

**The removal screen** (vault page, plain DOM — the vault page may not carry React, `bundleViolations`): its own mode,
`unlock.html?mode=remove-damaged`, reached from [Remove damaged wallet]; it reads, judges and shows the value itself and
takes no URL parameter, so the digest it sends is that of the value it showed (rev 2.2):
- the lines above, repeated; "This removes the wallet from this browser only.";
- the address (Minor 5): among `accounts` entries that are objects with a safe integer `index` ≥ 0 and a `publicKey`
  matching `^[1-9A-HJ-NP-Za-km-z]{32,44}$` (the `ADDRESS` shape, `reauthChallenges.ts:155`), the one with the
  **lowest** index, in groups of four (`addressGroups`), under #37's caption "This wallet's first account" (rev 2.2);
  none → "The address can't be read". Never `accounts[0]`;
  nothing else of the value is rendered;
- the typed **DELETE** and #37's confirmation rule (§3: the hold, or the checkbox and one click) — E11. No password:
  an unreadable vault cannot be opened.
- Refusals: `send-open` → #37's text (`DELETE_TEXT.sendOpen`, E12) with [Start again] and [Close this tab] — no
  [Unlock]: an unreadable vault cannot be unlocked (rev 2.2); `busy` → "The stored data changed — check it
  again", and the screen re-reads — the page's own digest compare at the click is the same outcome (rev 2.2);
  `not-unreadable` → the screen re-reads and shows the state it now finds (refused, or a wallet: "A wallet already
  exists in this browser. Nothing was changed."); `unlocked` → "Noctura was unlocked meanwhile — try again";
  `no-wallet` → "No wallet on this browser yet." with [Set up a wallet] (rev 2.6). Every notice resets the
  confirmation (§3, rev 2.6).

### 2.3 Save the damaged data (E10, R4)

- A button on both damaged states and on the removal screen, **before** "Remove". Saving is offered, never required.
- An `<a download="noctura-damaged-wallet-<first 8 hex of the digest>.json">` whose `href` is
  `data:application/json;charset=utf-8,` + `encodeURIComponent(text)`, where `text = JSON.stringify(raw)` from the
  page's read — **the exact bytes §2.4's digest hashes**, so a helper can check a saved file against a reported
  digest. No new permission (`<a download>` needs none; `downloads` stays out of `PERMISSIONS`). No
  `URL.createObjectURL` and no `text/html`: the vault-isolation gate refuses both on the vault page
  (`MARKUP_EVASIONS`), and a `data:application/json` URL passes it.
- Copy: "This file is your wallet's data exactly as this browser holds it. If it contains your encrypted wallet,
  anyone with the file and your password could try to open it — keep it private." (It may hold no ciphertext at all;
  the copy does not promise one.) It sits directly under Save on every screen that offers it — on the damaged states
  in the bar, between Save and Remove (rev 2.6).
- Test: E2E clicks it and reads Playwright's download: the file's bytes are `JSON.stringify` of the stored value and
  their sha256 is the digest the page sent; R4: the button exists on the refused state, the removal button does not.

### 2.4 `vault.forgetDamaged` (C2, E12)

`envelopeRevision` (`envelopeRevision.ts`) needs a shape-checked envelope; an unreadable value has none, and E5's
`REVISION` check (`accountsStore.ts:131`) cannot carry anything else. So:

- **The token:** `digest = sha256(utf8(JSON.stringify(raw)))`, lowercase hex, of the raw value `storage.local.get`
  returns (key order as stored, the same on every read). `undefined` is `no-wallet` (never damaged, as `forgetWallet`
  rules at its step 1). If the browser ever returned another key order, the two digests differ and the answer is
  `busy`: it fails closed.
- **A new type, `vault.forgetDamaged {expectedDigest}`**, added to `PRIVILEGED` and `VAULT_PAGE_ONLY`
  (`messages.ts:41`, `:76`) — **never** a flag on `vault.forgetWallet`, so `forgetFlow.ts`'s boundary ("nothing else
  may send vault.forgetWallet", its source test) stays whole. The page's builder lives in `src/unlock/damagedFlow.ts`,
  imported only by the removal screen (`src/unlock/screens/removeDamaged.ts`); a source test holds it there, as
  `deleteWallet.test.ts` holds `deleteWallet` to `screens/delete.ts`.
- **The page's judgement never decides.** At the click, before sending, the page re-reads and compares its digest with
  the one shown (a mismatch: re-read, nothing sent — as #37's C17 compare, `delete.ts`). The background then runs
  `forgetDamaged(ext, {expectedDigest})` in `accountsStore.ts`, in E5's order (`forgetWallet`,
  `accountsStore.ts:472-538`):
  1. `expectedDigest` not 64 lowercase hex → `malformed`;
  2. inside `serial`: read `v1_vault`; `undefined` → `no-wallet`; **`unreadableV1(raw)` false → `not-unreadable`**
     (a refused vault and a wallet both land here; judged opener first, as §2.1's readings — rev 2.2); digest ≠
     expected → `busy`;
  3. `lock(ext)`;
  4. check-and-clear `v1_pending` in ONE `updatePending`: an open record → `send-open` (E12; nothing removed, the
     wallet stays locked, as E5);
  5. re-read: still unreadable **and** the same digest, else `busy`;
  6. under `sessionMutex`: a session present → `unlocked`; otherwise remove `v1_vault`;
  7. best effort, never undoing step 6: `removeWalletData` (the phrase with it) + `clearCaches`.
  The predicate is the safety; the digest only **narrows** (it binds the removal to the value the user saw — a damaged
  value replaced by another damaged value is `busy`).
- **After:** as #37's delete — the welcome page, which shows onboarding (no wallet).

**Who could abuse it.** Only code running as this extension's vault page, which needs someone with access to the
browser profile — who can also uninstall the extension. It can remove only a value no version of Noctura can read.

### 2.5 Sessions over an envelope the background refuses (C1)

- **R3:** `vault.setKeys` (`messages.ts:184`) binds the keys through `readWalletView` (`accountsStore.ts:77`), which
  checks only the scheme and the account shape, so today a session could be created over an envelope `envelopeShape`
  refuses. B1e binds it through `envelopeShape` too: keys over a `stored-invalid` envelope are refused (`malformed`);
with no vault stored the answer stays `unknown-account`, as before (rev 2.2).
  Every flow that sends `setKeys` has already stored or read an envelope both sides accept (onboarding, #39, add
  account, unlock — the comment at `messages.ts:186-193`), so no legitimate path changes. Test: a stored envelope with
  `kdf.m = 32768` (refused) and a valid key set → `setKeys` refused; mutation: the old `readWalletView`-only binding →
  RED.
- A session that already exists when the stored value becomes unreadable (written by nothing in this extension — a
  disk or profile fault): `forgetDamaged` locks first (step 3) and refuses to remove while a session is back (step 6).
- A session that exists over a **refused** value is left alone: nothing is removed, and the keys were derived from a
  vault both sides accepted when it was unlocked.

### 2.6 Controls and named mutations (C1, C2)

**Positive controls — the fixture, read as a FILE, never rebuilt by the encoder.**
`src/vault/__tests__/fixtures/envelope-v1.json` is a real wallet (`envelopeKat.test.ts` opens it with its password);
it carries a passkey. Every variant below is `JSON.parse` of that file, then one edit:

| control | value stored | `vault.forgetDamaged` with its true digest |
|---|---|---|
| F0 | the fixture verbatim | `not-unreadable`, `v1_vault` unchanged |
| F1 | F0 without `passkey` | `not-unreadable` |
| F2 | F0, `kdf.m = 32768` (below today's floor) | `not-unreadable` |
| F3 | F0, `kdf.m = 2147483648` (above the cap) | `not-unreadable` |
| F4 | F0, `v: 2` | `not-unreadable` |
| F5 | F0 with 101 accounts (distinct indexes) | `not-unreadable` |
| F6 | F0, `scheme: 'cli'`, two accounts | `not-unreadable` |
| F7 | F0, `accounts: []` | `not-unreadable` |
| F8 | F0, `scheme: 'bip44'` | `not-unreadable` |
| F9 | F0 plus an unknown field | `not-unreadable` |

**Positive controls — breadth, from the encoder (review 2 Minor 4).** Beside the file-read fixture (the control
against a symmetric change of encoder and predicate), the test generates with the real encoder and asserts each
readable, refused by neither opener, and `not-unreadable`: a `cli` wallet; 100 accounts; the output of
`rewrapPassword`; the output of `reencryptForAccounts` (an account added); `addPasskeyWrap` with a 1-byte and a 64-byte
credential ID; odd names (`''`, an emoji sequence, a bidi override, 5 000 characters). And one more fixture committed
verbatim: the output of the **first encoder, at 458dfcd** (the oldest vault a developer profile could hold),
`src/vault/__tests__/fixtures/envelope-v1-458dfcd.json`, with and without a passkey. Both fixtures are pinned by
sha256 (a swapped fixture is not a control); the 458dfcd vault is readable, but its seed fails AES-GCM (that encoder
sealed it without the header's additional data) — §2.1's out-of-predicate case (rev 2.2).

**Deletable controls — at least one per clause of U1–U3 (review 2 Minor 1),** each `→ forgotten`, `v1_vault` absent,
the phrase gone: U1 `null`, `[]`, `"x"`; U2 no `v`, `v: "1"`, `v: 0`, `v: 1.5`; U3 `scheme: 1`; `kdf.alg: 'scrypt'`;
`kdf.m: "65536"`; an unpadded `kdf.salt`; `seed.iv` of 11 bytes; `seed.ct` of 16 bytes; no `password`;
`password.wrapped` of 39 bytes; `passkey: null`; an empty `credentialId`; `prfSalt` of 31 bytes; `accounts: {}`;
`index: -1`; `index: '0'`; `name: 1`; an account without `publicKey`. **The partition test enumerates every one of
them**: each is also `envelopeShape === null` and `storedVault` `damaged` — so a future opener that loosened a v1 clause
without bumping `v` (say, `alg: 'scrypt'` under `v: 1`) fails it.

**Digest controls (C2):** the right digest of an unreadable value replaced by another unreadable value between the
read and the click → `busy`, nothing removed; a digest of 63 hex → `malformed`; an open send → `send-open`, nothing
removed, the vault still there.

**Invariance — policy tightened, the controls must stay as they are.** A test mocks `../shared/envelopeRules` with
`ENVELOPE_KDF_MIN.m = 131072`, `MAX_ACCOUNTS = 1` and an `accountsPolicyOk` that refuses everything, and asserts
`unreadableV1` gives the same verdict on every control above. **Its own positive control (review 2 Minor 2):** under
the same mock, `envelopeShape` now refuses F0 (`m` 65536 < 131072) — proving the mock took, so the invariance means
something. A source test asserts `src/shared/unreadable.ts` imports
only `@scure/base`.

**Named mutations of the predicate — each must turn a control RED** (run in the plan's task, the result recorded):
- M-version: U2 changed to "`v !== 1` is unreadable" → F4 deleted → RED;
- M-kdf: U3 applies today's KDF bounds → F2 and F3 deleted → RED;
- M-policy: U3 calls `accountsPolicyOk` → F5, F6, F7 deleted → RED;
- M-scheme: U3 requires `scheme ∈ {slip10, cli}` → F8 deleted → RED;
- M-iv: the `seed.iv` length check dropped → the 11-byte-IV control kept → RED (the negative direction);
- M-digest: step 5's digest re-check dropped → the replaced-value control removes → RED;
- M-lock: step 6's session check dropped → a session written straight into the session store (as a disk-fault
  session would be; R3 keeps `setKeys` from making one) inside the lock's own session section — after step 3, the one
  step 6 must see — is not refused, the vault is removed → RED. A session present **before** the click is locked by
  step 3; it has its own control and mutation (M-lock-first: step 3 dropped → RED) (rev 2.2).

## 3. #37 without holding (E6, D31) — and §2's removal (E11)

- The hold (1 s, `HOLD_MS`, pointer or Space/Enter held) stays (`HoldButton.tsx`).
- **Added:** a native `<input type="checkbox">` directly **above** the button — before it in the DOM, on screen and in
  tab order, so a screen-reader or keyboard user meets the box before the action it unlocks (rev 2.2; D31) — labelled
  "I understand this permanently removes this wallet from this browser", shown only while DELETE matches. When it is
  checked **and** DELETE matches, the button deletes on **one activation** — a click, or Space / Enter **on the
  button** — without a hold. The button's name follows the box ("Hold to delete"; checked: "Delete wallet" on #37,
  "Remove damaged wallet" on the removal), and the hold's instructions are hidden while it is checked. On the box,
  Space toggles it and Enter does nothing (native behaviour, rev 2.2).
- **Enter does not confirm (Minor 7, B1's rule):** Enter in the DELETE field activates nothing — neither the hold nor
  the checkbox path. Test.
- **Checkbox state (Minor 8):** unchecked on every entry to the screen; cleared whenever the typed word stops
  matching; never remembered. Rev 2.6: a refusal notice on the removal resets the confirmation (the box unchecked, a
  hold released); #37's box is disabled while a send is open; checking the box while a hold is in progress ends the
  hold, and the button then waits for its one activation.
- On #37 the typed **DELETE** and the password / passkey proof in the vault tab stay required; the checkbox only
  trades the hold. On §2's removal (no proof exists) the typed word + (hold or checkbox and one activation) **is** the
  gate (E11); the vault page builds both in plain DOM, with the same rules.
- Tests: hold works; checkbox + one click works; checkbox + Space / Enter on the button works; neither → nothing;
  Enter in the field → nothing; the checkbox clears when the word changes; the checkbox and the button have their
  roles and labels (screen-reader operable); the typed word (and on #37 the proof) is still required in every path.

## 4. Links: Terms, Privacy, licences, Help (E4)

### 4.1 In the extension

- **#1 welcome** (`src/unlock/screens/welcome.ts`): above the buttons, as drawn (rev 2.2: rev 2.1 said "under"; the
  design draws the line before the bar, where it is today), "By continuing you agree to the **Terms** and **Privacy
  Policy**" — both links.
- **#38 About** (`src/app/screens/About.tsx`): the rows Terms, Privacy, Open-source licences, Help, as drawn — spelled
  as the design spells them; the design's package count on the licences row is not built (the popup cannot know it:
  the page is generated after the popup is bundled) (rev 2.2). Every link row's name ends with a screen-reader suffix
  " (opens in a new tab)" (rev 2.2).
- Terms, Privacy and Help open in a new tab: `https://noc-tura.io/extension/terms`, `/extension/privacy`,
  `/extension/help`, as `<a target="_blank" rel="noopener noreferrer">` — the pattern of the explorer link
  (`TxDetail.tsx:65`). Links the browser opens, never a fetch: CSP `connect-src` stays exactly
  `https://api.noc-tura.io` (`check-permissions.mjs` `REQUIRED_CONNECT_SRC`).
- **Open-source licences** open `licenses.html` inside the package (§4.2), in a new tab; no network.

### 4.2 `licenses.html` (I9, R7, N1–N3, E15, E16)

**A static root page.** Generated by `scripts/build.mjs` after the Vite builds, written to `<outRoot>/app/licenses.html`
before the per-browser copies, so `chrome/` and `firefox/` carry the same file. Plain HTML (`<meta charset="utf-8">`,
a title, headings, `<pre>` blocks of HTML-escaped licence text), so under the CSP it can load nothing, run nothing and
link nowhere. The licence texts contain URLs (review 2 probe: `http://www.apache.org/licenses/…`,
`https://paulmillr.com`, `https://ianstormtaylor.com`, `https://encoding.spec.whatwg.org/`, `http://unlicense.org/`,
and the OFL's own) — as **escaped text**, never navigable. The gates are taught it **by name**:
- `check-vault-isolation.mjs`: a new `STATIC_PAGES = ['licenses.html']`; every `.html` at a package root must be a key
  of `ENTRIES` or a member of `STATIC_PAGES` (an unknown page fails — today `bundleViolations`, line 896, follows the
  scripts of every root `.html` and refuses nothing for a script-less unknown page). **The static-page rule (N1):** the
  file contains none of `<a`, `href=`, `<script`, `<link`, `<style`, `style=`, an `on…=` attribute, `<iframe`,
  `<form` (case-insensitive, over the raw file) — and, rev 2.2, uses only the tags and attributes the generator emits
  (`html[lang]`, `head`, `meta[charset=utf-8]`, `title`, `body`, `h1`, `h2`, `p`, `pre`), so a `<meta http-equiv>`,
  `<img>`, `<base>` or `<svg>` fails too; a missing `licenses.html` is INCONCLUSIVE, and the licence gate requires each
  package's page to equal the page its maps give. Every `<` inside a licence text is escaped to `&lt;` by the
  generator, so none of these can come from a licence.
- `check-links.mjs` (§4.3) **skips `licenses.html` by name**; the static-page rule is what holds there instead.
- `check-csp.mjs` reads every `.html` under the package (`checkHtml`): it covers the file unchanged.
- `check-page-bundles.mjs` covers the two content scripts only; it is unaffected.
- Mutations: a `<script src="x.js">` in the generated file → fails; a `<style>` → fails; an
  `<a href="https://evil.example/">` → the static-page rule fails; the link gate run **without** its skip over the real
  `licenses.html` → fails (proving the skip is the only reason it passes); a second, unknown `extra.html` in the
  package → fails.

**Inputs (defined).**
1. **Modules with rendered code (N3, E16).** The maps' `chunks` section (the `css` section names only our
   stylesheets) records Rollup's `moduleIds` — every module a chunk was composed from, **tree-shaken ones included**.
   So `chunkModules` (`vite.config.ts`) gains a `rendered` section: chunk → module id → `renderedLength` (from
   `chunk.modules[id].renderedLength`), written into `dist*/app.modules.json`, `dist*/app.provider.modules.json` and
   `dist*/app.relay.modules.json`. The licence page and the allowlist take **only modules with `renderedLength > 0`**
   in some chunk; a map without the `rendered` section → the build fails (INCONCLUSIVE). Skipped: ids starting with
   `\0` (virtual) and `__vite-browser-external`.
2. **Ours:** ids under `src/`, the root `.html` entries, `../core/`, `../web/` → one entry "Noctura" under the
   repository's `LICENSE` (Business Source License 1.1).
3. **Packages:** for an id under `node_modules/`, the **nearest `package.json` with a `name`** walking up from the
   module's directory — so a nested copy (`@solana/web3.js/node_modules/@noble/hashes` 1.8.0 beside the top-level
   2.4.0) is its own entry. Entry = name, version, SPDX id (item 4), licence text. **Copies with the same name,
   version and licence text are one entry** (the review-1 probe saw `bs58@4.0.1` and `base-x@3.0.11` twice each, via
   `@solana/web3.js` and `borsh`); a same name and version with a different text are two (Minor 6). Versions are read
   from each `package.json`, never from memory notes: the extension's `@solana/web3.js` is **1.99.0** (its
   `package.json`), not the 1.95.8 recorded for the mobile app (Minor 9).
4. **Licence text:** the package directory's `LICENSE*`, `LICENCE*` or `COPYING*` files (all of them, sorted by name —
   `borsh` ships `LICENSE-APACHE` and `LICENSE-MIT.txt`), CRLF folded to LF. No such file → the SPDX id from
   `package.json` `license`, with that licence's standard text from a committed table
   (`extension/release/licence-texts/<SPDX>.txt`) headed by the package's `author` field ("Author: …", or "The package
   names no author." — rev 2.2), never an invented copyright holder; neither → **the build
   fails** (no silent "unknown"). Probe: `bs58` 4.0.1 (twice) and `qrcode-generator` 2.0.4 ship no licence file and
   say MIT. **The SPDX id (N2, E15):** the `license` field when present; otherwise the committed table
   `extension/release/licence-ids.json` (`name@version → SPDX`), consulted for every package with rendered code and no
   `license` field; **a package in neither → the build fails**. The table never overrides a `license` field the
   package has: a field outside the allowlist (an SPDX expression such as `MIT OR Apache-2.0`, a `{type}` object) fails
   the build, and the failure says so — admitting it is an owner decision (rev 2.3). Today the table has one row:
   `text-encoding-utf-8@1.0.2 → Unlicense` (8 526 rendered bytes in `background.js`, web3.js's TextEncoder polyfill;
   its `LICENSE.md` is the Unlicense dedication). Controls: the row removed → fails; the row set to `LGPL-3.0-only` →
   fails (item 6).
5. **Non-module assets:** the two Geist fonts in `public/fonts/` (copied as files, never modules) — an entry from a
   committed `extension/public/fonts/LICENSE.txt` taken from the Geist release the files came from; any file under
   `fonts/` in the package without an entry fails the build. Rev 2.2: the entry pins both faces to geist 1.7.2 by
   sha256 (a changed face fails the build until its entry is revisited), and `fonts/LICENSE.txt` ships in every package
   beside the faces (OFL 1.1 asks for it).
6. **Allowlist (R7, the owner's list, E15):** a rendered package whose SPDX id is outside {MIT, ISC, BSD-2-Clause,
   BSD-3-Clause, Apache-2.0, 0BSD, OFL-1.1, Unlicense, and ours} fails the build; adding to the list is an owner
   decision, never a plan edit. **`rpc-websockets` (N3, E16):** 9.3.9, LGPL-3.0-only, is in the dependency graph
   (`@solana/web3.js` 1.99.0's browser build does `import {CommonClient, WebSocket} from 'rpc-websockets'` and
   `class RpcWebSocketClient extends CommonClient` at top level, `lib/index.browser.esm.js:12`), but its rendered
   length is **0** — `Connection` and the WebSocket path are tree-shaken; no LGPL code ships today (rev 2 said
   otherwise; it read the ids, not the rendered code). Kept anyway, **as a precaution**:
   - a gate: no module under `node_modules/rpc-websockets/` is in any chunk of any map (with the alias the package
     never enters the graph), and the stub renders 0 bytes (mutation: a `new Connection(...)` planted in the
     background → the stub renders code → fails) — stricter than "rendered 0", which the stub would pass (rev 2.2); a
     map without its `chunks` or `rendered` section is INCONCLUSIVE, never a pass (rev 2.3);
   - an alias of the bare specifier `rpc-websockets` to a local stub with exactly two named exports (its test checks the
     export list exactly, rev 2.6) — `CommonClient`, a
     class (an `extends` of a non-constructor would throw at module evaluation), and `WebSocket`, a function — each
     throwing if ever constructed or called. Only `Connection`'s constructor makes a `RpcWebSocketClient`, and no file
     the extension bundles constructs a `Connection` (`new Connection` exists only in `web/src/lib/solana.ts`, which
     the extension never bundles: of `web/` it ships `ui/` and `styles/`, `check-no-presale.mjs` `WEB_ALLOWED`). A
     test imports `@solana/web3.js` under the alias and uses what the extension uses (`PublicKey`,
     `VersionedTransaction`, `TransactionMessage`, `SystemProgram`) without a throw.
7. **Order and determinism:** "Noctura" first, then entries sorted by name, then version (C collation); texts
   HTML-escaped; lines over 100 columns wrapped at word boundaries, so a tab does not scroll sideways (rev 2.2; a
   window narrowed to 412 px still does — the page may carry no stylesheet); no date, no absolute path. Determinism follows from the lockfile; `verify-reproducible.mjs` covers the
   file with the rest of the package. The package carries no licence notice today (the minifier drops `@license`
   comments — probe: none in any built file); this page is where the notices MIT and Apache-2.0 ask for live.

### 4.3 The link gate (I1, R8)

**The probe** (`node scripts/build.mjs --no-presale` in a scratch copy of `extension/`, `core/` and `web/` at 70e691d;
every `(https?|wss?|ftp)://…` literal in `dist-nopresale/chrome`, with the file it is in). The package today carries
exactly these URL strings, and no `ws://`, `wss://` or `ftp://`:

| URL string | file | kind |
|---|---|---|
| `https://api.noc-tura.io/*` | `manifest.json` | host permission |
| `https://wallet.noc-tura.io/*` | `manifest.json` | host permission (passkey RP ID) |
| `https://api.noc-tura.io` (CSP `connect-src`, followed by `;`) | `manifest.json` | CSP |
| `https://api.noc-tura.io/api/v1` | `background.js` | coordinator base (`API_BASE`) |
| `https://api.noc-tura.io/api/v1/rpc` | `background.js` | coordinator RPC endpoint |
| `https://solscan.io/tx/` | `assets/mount-*.js` (popup / tab) | explorer link prefix (`explorer.ts`) |
| `https://reactjs.org/docs/error-decoder.html?invariant=` | `assets/addressBook-*.js` | inert: React 18 production error text |
| `https://github.com/uuidjs/uuid#getrandomvalues-not-supported` | `background.js` | inert: `uuid` 8.3.2 error text |
| `http://www.w3.org/1999/xhtml`, `http://www.w3.org/2000/svg`, `http://www.w3.org/1999/xlink`, `http://www.w3.org/XML/1998/namespace`, `http://www.w3.org/1998/Math/MathML` | `assets/addressBook-*.js` (all five), `assets/mount-*.js` (`svg`) | inert: XML namespace identifiers (React DOM) |

Coordinator routes the `--no-presale` `background.js` names (relevant to §6): `/rpc`, `/tx/broadcast`,
`/wallet/prices`, `/stats`, `/geo/check`, `/geo/restricted-list`. It names no `/solana/purchase` and no
`/referral-stats` (B1d's record and referral routes are presale-only).

**The rule.** A new `scripts/check-links.mjs`, run in `gates:build` for both builds' `chrome/` and `firefox/`
packages. It reads every `.js`, `.mjs`, `.html`, `.css`, `.json`, `.svg` and `.txt` file (rev 2.3: an SVG document can
carry `<a xlink:href>`; none ships today; rev 2.6: `.mjs` and `.txt`) **except `licenses.html` and `fonts/LICENSE.txt`,
skipped by their exact paths** (N1: the licence texts carry URLs as escaped text; §4.2's static-page rule holds there;
rev 2.6: `fonts/LICENSE.txt` is the Geist fonts' OFL text, which names its licence's home page, and no page) and
extracts every match of `\b(?:https?|wss?|ftp)://[^\s"'`<>)\\;]*`, the scheme in any case (rev 2.6: a browser navigates
`HTTPS://…` as `https://…`). Each match must equal, **as a whole string**, one entry of:
- **Coordinator:** `https://api.noc-tura.io/*` and `https://api.noc-tura.io` (in `manifest.json` only);
  `https://api.noc-tura.io/api/v1` and `https://api.noc-tura.io/api/v1/rpc` (in `background.js` only) — a page
  naming the coordinator fails (pages reach it only through the background);
- **RP ID host:** `https://wallet.noc-tura.io/*` (in `manifest.json` only);
- **Navigable links (each must also be PRESENT):** `https://solscan.io/tx/`, `https://noc-tura.io/extension/terms`,
  `https://noc-tura.io/extension/privacy`, `https://noc-tura.io/extension/help`;
- **Inert library strings**, each with its package and reason in the gate: the React error decoder, the `uuid`
  message, the five W3C namespaces. Inert means never fetched — `connect-src` admits only the coordinator — and never
  navigated: no `href`, `window.open` or `openPage` is built from them (they are message text and namespace ids);
- **Presale build only (rev 2.2):** `https://noc-tura.io?ref=${}` — #24's invite link (`core/referral`), absent from
  the probe above, which built only `--no-presale`; a template interpolation inside a match folds to `${}`, so a
  minifier's renaming is one string while `…/terms${x}` still fails. The store build refuses it.

Each row is allowed only in the files the table names (rev 2.2): the coordinator and the RP host as above, the four
navigable links in a page file (`.js` / `.html`), the inert strings and the referral link in `.js` only.

Anything else fails, naming the file. Zero matches in a package → `INCONCLUSIVE` (the extraction broke).

**Controls.** Positive: both real packages pass. Negative, each on a copy: a planted `https://evil.example/` in a page
chunk → fails; `https://noc-tura.io/extension/privacy` removed → fails (presence); `https://api.noc-tura.io/api/v1`
planted in a page chunk → fails; one inert entry changed by one character → the real package fails; a planted
`wss://evil.example` → fails; rev 2.6: a planted `HTTPS://evil.example/` or an upper-case `HTTPS://` navigable link
→ fails; a URL in an `.mjs` or a `.txt` file → fails; `fonts/LICENSE.txt` unskipped → fails (the skip is the only
reason it passes). A library update that changes an inert string fails the gate until a reviewer adds the
new string with its reason.

**What the gate is (rev 2.3, the controller's ruling on review Q6 / M4).** A review aid, **not a security boundary**: a
URL never written whole — split from its scheme, scheme-relative (`//host`), or encoded — passes it (a test pins that
limit). The runtime boundary for fetches is CSP `connect-src` (`npm run csp`); navigation is bounded by every link the
user is given being a whole string from `src/shared/links.ts`, and by review.

### 4.4 Tests

The four rows on #38 and the two links on #1 (href, `target`, `rel`); `licenses.html` generated, deterministic (two
builds, one hash), containing **every package with rendered code and no other** (a package whose modules are all
rendered 0 is absent); the allowlist failure on a planted rendered LGPL package; the `licence-ids.json` controls; the
gates and mutations above.

## 5. The release build (E2)

### 5.1 `npm run release:chrome`

1. `npm run verify` (clean; it builds both variants, runs the tests, the CSP, secrets and every gate including
   `check-no-presale.mjs` and §4.3, and `verify-reproducible.mjs`: four builds in temp dirs, one file digest each).
2. **A third witness (R10, Minor 12):** `node scripts/build.mjs <tmp> --no-presale`; its `chrome/` file digest
   (`web/scripts/build-manifest.mjs`) must equal that of `verify`'s `dist-nopresale/chrome`. The release packs
   `verify`'s `dist-nopresale/chrome` itself — no fifth build is packed.
3. The RP-ID record (§5.6, E17): `extension/release/rp-id.json` present and equal to `RP_ID`, else no pack.
4. The live check (§6.5).
5. The zip (§5.4), written twice; the two sha256 must be equal.
6. `extension/release/notes-<version>.md`: version, the zip's sha256, the package's file digest, the commit.

### 5.2 Version (I8, R5)

`extension/package.json` has no `version` field today, and `manifest/source.mjs` hardcodes `VERSION = '0.1.0'`.
**One source:** `package.json` gains `"version": "1.0.0"`; `source.mjs` reads it (`readFileSync` of
`../package.json` relative to its own `import.meta.url`) and the constant goes. `check-permissions.mjs` asserts every
built manifest's `version` equals `package.json`'s and matches `^\d+\.\d+\.\d+$` (mutation: a hand-edited
`dist*/chrome/manifest.json` version → fails). #38 shows it through `runtime.getManifest().version`
(`platform.ts:80`), so the screen, the manifest and the zip's notes agree by construction.

### 5.3 The stable ID and `key` (I8)

- The Chrome Web Store assigns the ID at the first upload. Its public key is then recorded in
  `extension/release/store-key.json` (`{id, key}`) in a follow-up commit (§7 step 7).
- `render(browser, {key})` in `source.mjs` gains an optional `key`; `scripts/build.mjs` passes it only with
  `--dev-key`, which reads `store-key.json` and refuses when the file is absent. `verify`, the E2E builds and the
  release never pass it.
- `check-permissions.mjs`: a manifest in `dist/` or `dist-nopresale/` with a `key` fails; a `--dev-key` build's `key`
  equals the recorded one. Mutation: `render` adding `key` by default → fails.
- Development note (in the checklist): an unpacked install carrying the store's key **has the store's ID**, so it and
  the store install cannot coexist in one Chrome profile.
- Whether the store accepts an uploaded package that carries a matching `key` is not needed: the store package never
  carries one.

### 5.4 The zip (I8, R6)

**Recommendation: a hand-written STORE (uncompressed) zip, no dependency** (`scripts/zip-store.mjs`, about a hundred
lines). Reason: a deflated zip's bytes depend on the zlib build, so a reviewer on another Node could not reproduce its
sha256; STORE has no compressor, so "two builds, one zip, one sha256" holds on any machine. The package is 1.5 MB in
26 files (probe), so the size cost is irrelevant to the store. A dependency (`archiver`, `yazl`) would add supply-chain
surface to the release path and still deflate.

The format, fixed: entries = every file of the package, paths relative with `/`, **sorted (C collation)**, no
directory entries; local header + data per entry, then the central directory and the end record; version 20, flags
0 (no data descriptor; every path must be ASCII — a non-ASCII path fails the script), method 0, DOS time 0 and date
`0x0021` (1980-01-01 00:00), CRC-32 by `zlib.crc32` (Node ≥ 22.2; the package requires ≥ 22.12), sizes in the headers,
external attributes 0, no extra field, no comment, no zip64 (more than 65 535 entries or 4 GiB fails). Tests: an
independent reader written in the test parses the zip and compares each entry's bytes and CRC with the package;
two runs give one sha256; a changed file changes it; a non-ASCII path is refused.

The published hash is the zip's sha256; the package's file digest stays as the inner check.

### 5.5 `<all_urls>` and the first release (Minor 10)

The B1c §6.5 update gate (an update adding `<all_urls>` content scripts disables the extension for existing users)
does not apply to version 1.0.0: it carries `<all_urls>` from its first store version, and **there are no existing
users** — evidence, recorded in the checklist: no git tag, no `*.zip` or `*.crx` in any commit of any branch
(`git log --all -- '*.zip' '*.crx'`: none), no `extension/release/` before B1e, no sideload note for the extension
(only the Android APK was sideloaded); the owner's unpacked installs and the E2E profiles are not users. The install
warning is Chrome's all-sites warning ("Read and change all your data on all websites"); the two `host_permissions`
are covered by it, and `storage` and `alarms` carry no warning — observed and recorded at the first install of the
zip (§7 step 5). The gate applies to every later update that adds a permission.

### 5.6 The passkey RP ID is frozen by 1.0.0 (N4, E17)

`RP_ID = 'wallet.noc-tura.io'` (`src/vault/passkey.ts:8`), claimed through the host permission
`https://wallet.noc-tura.io/*` (`manifest/source.mjs` `HOST_PERMISSIONS`: "an extension may claim an RP ID only for a
host it has permission for"). B1 §2 recorded the choice: nothing is served at that host, and the name is reserved for
this product. Nothing in the extension connects to it: `connect-src` admits only `https://api.noc-tura.io`
(`REQUIRED_CONNECT_SRC`), and §4.3's gate allows its URL only in `manifest.json`.

- **Frozen.** The first passkey a store user enrols is bound to this RP ID for good; changing it later orphans every
  enrolled passkey. **Pre-upload gate:** `release:chrome` refuses to pack unless `extension/release/rp-id.json` exists
  and records `{rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'}`, and its `rpId` equals `RP_ID`;
  §7 step 3 restates it.
- **Pinned (test + mutation).** A new test (`src/vault/__tests__/rpId.test.ts`) asserts
  `` `https://${RP_ID}/*` `` is a `HOST_PERMISSIONS` value (B1e-1) and `RP_ID` equals `rp-id.json`'s (B1e-2, beside the
  pre-upload gate the owner's confirmation fills — rev 2.2). Mutation: the entry
  removed from `HOST_PERMISSIONS` → RED (a later "tidy" of a seemingly unused host permission would otherwise silently
  break every passkey). Today only the origin derivation is tested (`ext.test.ts`).

## 6. Texts for the store and for noc-tura.io (B1e-2)

Written as files in the repo (`extension/release/`), each claim traceable to the code or a test that proves it.

### 6.1 The privacy policy (I3)

For `https://noc-tura.io/extension/privacy`, written as `extension/release/privacy.md`. Its **required sentences** are
exported verbatim by `extension/release/privacySentences.mjs` (the one list the unit test and the live check both
read, §6.5). Re-derived from the `--no-presale` build's real network calls: `connect-src` admits one host
(`REQUIRED_CONNECT_SRC`); the routes it reaches are §4.3's list; their call sites are named below.

| # | sentence | source |
|---|---|---|
| P1 | "The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator." | `EXTENSION_CSP` `connect-src`; `deps.ts` `browserDeps` |
| P2 | "Every request to the coordinator carries your IP address and the standard headers your browser sends." | every route, `deps.ts` |
| P3 | "The coordinator receives the public address of every account in your wallet, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing." | `wallet.balances` (`walletApi.ts:336`) per account — the popup's rows (`useAccountBalances`, `FRESH_ROWS`), #37's reading of all accounts; history (`getSignaturesForAddress`) |
| P4 | "When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds." | `wallet.probeBalances`, `MAX_PROBE = 6` (`walletApi.ts:53`), `probeCandidates` (`onboarding.ts`) |
| P5 | "Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it." | `prepare.ts:370`; `dapp/simulate.ts:304`; `SIM_REFRESH_MS` (`signTx.ts:39`) |
| P6 | "Every transaction the wallet submits is sent to the coordinator, which broadcasts it to Solana: your own sends, and the transactions a site asks the wallet to sign and send. A transaction a site asks only to sign is returned to that site." | `/tx/broadcast` (`core/solana/broadcast.ts`); `finishSend` vs `finishSignTx` (`signTx.ts`) |
| P7 | "The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data." | `PRICE_PATH` (`core/portfolio/prices.ts`); `/stats` (`deps.ts` `stagePrice`; callers `prepare.ts:180`, `walletApi.ts:171`, `dapp/simulate.ts:226`) |
| P8 | "Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The list of restricted countries is read at most once every 10 minutes." | `carriesPurchase` / `runSimulation` (`signTx.ts:106`), `decide.ts:341`; `GEO_LIST_CACHE_MS` (`geo/gate.ts`); the other caller, `presale/buy.ts`, is not in the store build (`check-no-presale.mjs` rule 1: nothing under `src/background/presale/`) |
| P9 | "When you open a transaction in the Solscan explorer, Solscan receives that transaction's signature, your IP address and your browser's standard headers; no referrer is sent." | `explorer.ts`; `rel="noopener noreferrer"` (`TxDetail.tsx:65`) |
| P10 | "Messages a site asks you to sign are signed on this device and are not sent anywhere by the wallet." | `dapp/signMessage.ts` (no network dependency) |
| P11 | "Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension." | vault isolation gate; routes above |
| P12 | "If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it. In your passkey manager the passkey is listed under the name wallet.noc-tura.io." | the WebAuthn ceremony is the browser's; no route carries it; `RP_ID` (`passkey.ts:8`) |
| P13 | "The sites you connected, your address book and your anti-phishing phrase are stored only in this browser. Nothing is served at wallet.noc-tura.io and the extension never connects to it; the name exists only so that passkeys are bound to a name no website can use." | `v1_dapp_grants`, `v1_contacts`, `v1_phishing_phrase`; no route carries them; `connect-src` (§5.6) |
| P14 | "The extension reads nothing from the pages you visit; a site's own requests to the wallet are the only page data it handles." | `CONTENT_SCRIPTS.reason` (`source.mjs`); `src/provider`, `src/relay` |
| P15 | "The extension sends no analytics, telemetry or crash reports." | §4.3's route list |
| P16 | "Questions about privacy: privacy@noc-tura.io." | E8 |

Removed from B1 §5's list for Chrome: the **per-install identifier** — it is Firefox's (`moz-extension://<uuid>`);
Chrome sends `chrome-extension://<id>` with the store's ID, the same for every user. The Firefox policy (§8) adds it
back.

The policy's "what the coordinator keeps, for how long, and who else receives it" section is §6.2's answer, as
sentences R1… added to `privacySentences.mjs` when ICO answers.

### 6.2 Retention — a release-blocking dependency on ICO (I4)

**Precondition P-R (owner: ICO Claude; blocks: B1e-2's live check, so the release).** No text here can be written
until ICO answers. The question, exactly:

> For each route the Noctura browser extension calls — `POST /api/v1/rpc`, `POST /api/v1/tx/broadcast`,
> `GET /api/v1/wallet/prices`, `GET /api/v1/stats`, `GET /api/v1/geo/check`, `GET /api/v1/geo/restricted-list` —
> please state: (1) what is recorded about a request — the IP address, the path, the request body (wallet addresses,
> transaction bytes, signed transactions), headers (`Origin`, `User-Agent`); (2) where — the nginx access log, the
> application log, PostgreSQL, CrowdSec's local decisions, CrowdSec's central API (does the bouncer share offending IPs
> with CrowdSec's network?); (3) for how long each is kept, and whether deletion is automatic; (4) who receives any
> of it outside the coordinator — the upstream Solana RPC provider (does it receive the client's IP, or only the
> request?), the price source behind `/wallet/prices`, the GeoLite2 lookup (local database or a remote service?);
> (5) whether any of it is sold or used for anything but answering the request; (6) a contact for deletion requests.
> Answer in sentences we can publish verbatim, each true of production today.

Done when: the answers are recorded in `extension/release/ico-retention.md` with the date and ICO's commit, and turned
into sentences R1… of §6.1. **Also inherited** (B1d §6.5, §7): P1 — the automatic OFAC refresh of
`/geo/restricted-list` — because F12 runs in the store build and fails closed on a stale list; ICO confirms it before
the release. P2a and P2b do not apply: the store build names no `/solana/purchase` (§4.3).

### 6.3 The Chrome Web Store data-usage form (I5, E13)

| CWS category | answer | why (code) |
|---|---|---|
| Personally identifiable information | **No** | nothing names a person; addresses are disclosed under Financial |
| Health information | **No** | — |
| Financial and payment information | **Yes** | wallet addresses, transaction contents (simulation), signed transactions (broadcast): P3–P6 |
| Authentication information | **No** | password, seed and keys stay in the vault page / session (vault isolation); the passkey ceremony is the browser's (P11, P12) |
| Personal communications | **No** | messages to sign are signed locally (P10) |
| Location | **Yes** | the IP address with every request (P2); a country derived from it for a site's presale purchase (P8) |
| Web history | **No** | connected-site hostnames stay in `v1_dapp_grants` (P13) |
| User activity | **No** | no clicks, keystrokes or analytics leave (P15) |
| Website content | **Yes** (E13) | the transaction bytes a site hands the wallet go to simulation, and to broadcast for sign-and-send (P5, P6) |

Certifications: the data is not sold to third parties; not used or transferred for purposes unrelated to the single
purpose; not used to determine creditworthiness or for lending — each ticked **only after §6.2's answer confirms it
for the coordinator**. "Remote code: none" — CSP `script-src 'self'`, no `wasm-unsafe-eval` (`EXTENSION_CSP`,
pinned by `check-permissions.mjs` `REQUIRED_CSP`). Privacy policy URL: `https://noc-tura.io/extension/privacy`.

`data_collection_permissions` is AMO-only (`browser_specific_settings.gecko`); the Chrome manifest carries none
(Minor 11, §8).

### 6.4 Terms, Help, listing, screenshots

- **Terms** — a **draft for the owner's lawyer**, not legal text: non-custodial software, the user holds the keys and
  the responsibility, no financial advice, no warranty, the BSL 1.1 licence, the contact.
- **Help** — a short FAQ: the recovery phrase; the anti-phishing phrase (§1.1's two limits, Minor 3); a damaged wallet
  (the two states of §2, saving the data); why a passkey shows as "wallet.noc-tura.io" (P12, P13); why a transaction
  is blocked; what the coordinator sees (P1–P8); the
  contact.
- **Store listing** — name, short description (≤ 132 characters), detailed description, category (the owner picks at
  submission), the single-purpose statement ("A Solana wallet: hold, send and receive SOL and tokens, and approve
  requests from Solana sites."), a justification for each permission taken from `manifest/source.mjs`'s reasons
  (`PERMISSIONS`, `HOST_PERMISSIONS`, `CONTENT_SCRIPTS.reason`) — for `https://wallet.noc-tura.io/*` it adds, per
  E17: "No page is served at this host and the extension never connects to it (its content security policy allows
  connections to one other host only). The permission exists only so the passkey is bound to a name no website can
  use; passkeys appear under this name in the user's passkey manager." — "remote code: none", and §6.3's answers. **No
  presale, no TGE date, no privacy claim the build does not keep** (memory "shielded privacy guarantee": the extension
  is transparent; nothing says "private" or "anonymous").
- **Screenshots (Minor 9)** — five at 1280 × 800, by Playwright from the real `--no-presale` extension, contained (no
  network, the coordinator stubbed as the E2E suite does). The UI tab (`wallet.html`) is captured at a 1280 × 800
  viewport; the popup (412 × 600) and the approval window are captured at their real size and **composed 1 : 1,
  unscaled**, centred on a 1280 × 800 page of the design background (`extension/release/screenshots/backdrop.html`,
  undrawn, §9). The TGE-date check runs on each captured state's **text** (`document.body.innerText` against
  `forms()` of `scripts/check-no-tge-date.mjs`), not on the pixels.

### 6.5 The live check (I7)

Part of `release:chrome` only — never in `verify`, CI, a test, or under `unshare -rn`.
- Three `GET`s, one at a time, `redirect: 'manual'`: `https://noc-tura.io/extension/{privacy,terms,help}` must each
  answer **200** (a redirect fails). Three requests to `noc-tura.io` (not `api.`) cannot reach CrowdSec's
  `http-probing` threshold (B1 §5: 10 distinct 4xx paths in 10 s).
- The privacy page must contain **every sentence of `privacySentences.mjs`** (P1–P16, then R…), compared after:
  removing tags, decoding HTML entities (named and numeric), NFC, folding `’` to `'` and `“ ”` to `"`, and folding
  every whitespace run (NBSP included) to one space; a substring test per sentence, case-sensitive. Terms and Help
  must each contain their page title and "privacy@noc-tura.io".
- **Controls (unit tests of the comparison, offline, fixture HTML):** all sentences → pass; one sentence with one
  word changed → fail naming that sentence; one sentence missing → fail; a sentence split by `<b>…</b>` and a line
  break → pass; a 301 → fail; a 404 → fail. And `privacy.md` contains every sentence verbatim (offline test).

## 7. The owner's submission checklist (B1e-2 writes it)

1. Developer account (5 USD fee, 2-step verification, a verified contact e-mail, the EU trader / non-trader
   declaration).
2. ICO's §6.2 answers recorded; P1 (OFAC refresh) confirmed; the privacy policy, Terms (approved by the owner or a
   lawyer) and Help published by ICO; `release:chrome`'s live check passes.
3. Before upload: `extension/release/rp-id.json` records the owner's confirmation of the RP ID (E17, §5.6) —
   `release:chrome` refuses to pack without it. Upload the zip, paste the listing and §6.3's answers, add the
   screenshots. Submitting for store review **with
   publishing deferred** (the owner publishes manually after approval) may happen now (E14).
4. **The independent external security review (B1 release gate 2; vendor and cost are the owner's) is done before
   step 6 — before the Unlisted listing, i.e. before any distribution (E14).** Its findings are fixed or accepted in
   writing first.
5. Record the permission strings and the version (review 2 Minor 5): an **unpacked** load of the zip's contents in a
   clean profile shows no install dialog, so record the strings from chrome://extensions → Details → Permissions and
   the version on #38; the install dialog itself ("Read and change all your data on all websites") is recorded by a
   tester at the first Unlisted install (step 6).
6. Visibility: **Unlisted** for a few days with known testers, then **Public** (recommended); the owner decides at
   submission.
7. After the store assigns the ID: record the ID and its public key in `extension/release/store-key.json` (§5.3) in a
   follow-up commit, with the "no existing users" evidence of §5.5.

## 8. Out of scope (later steps)

Firefox / AMO (B1c §6.5's checks, `gecko.id`, the per-install identifier in its privacy text, and the AMO
`data_collection_permissions` taxonomy check — **never** added to the Chrome manifest "for completeness", Minor 11);
the drainer / phishing list; the DNR spike; presale in a store build (B1d §6.5: then the disclosures list presale and
the external review covers §3.3 and §3.6); hardware wallets; a second simulation source; **a password-gated delete for a vault that opens but whose seed fails
to decrypt** (well formed, accepted by both openers, the password unwraps the data key, AES-GCM then fails —
`unlockFlow.ts` answers `damaged`): a later step may offer #37's proof-gated delete from #9's damaged notice; until
then today's help stays (uninstall, reinstall, import the phrase) — §2.1.

## 9. Undrawn elements (flagged)

The anti-phishing phrase line (and R9's "could not be read" line), its onboarding step and its Security row; the two
damaged states, "Save the damaged data" and the removal screen; #37's checkbox (and the same on the removal screen);
`licenses.html`; the screenshot backdrop. Each is built from the design system's existing components (B1b's banner,
input and row styles; `licenses.html` has no stylesheet at all) and shown to the owner in the visual pass of B1e-1
(B1e-2 for the backdrop). Rev 2.6: the design system's gutter and spacing are binding on them, and the visual pass
asserts the geometry — the window's phrase line at the body's 20 px content gutter (and 20 px from the locked window's
top), the step's field / refused line / helper / help --space-2 apart, #35's card's own --space-3, and the save note
directly under Save.

## 10. Tests and gates (both plans)

Unit tests for every rule above with positive and negative controls and named mutations (§1.6, §2.6, §3, §4.2–§4.4,
§5.2–§5.4, §6.5); the vault-isolation (with `STATIC_PAGES` and the built-content-script `storage` rule), CSP,
permissions (version, `key`), the `RP_ID` pin (§5.6), the licence page's rendered-code and allowlist rules (§4.2), classes, no-presale, links and reproducible gates green; E2E for the phrase on the six
screens, both damaged states (removal of an unreadable vault, its refusal for F0, the save download), #37's checkbox
path, the links and `licenses.html`; every E2E normally and under `unshare -rn`; a visual pass of the undrawn elements
at the popup's 412 × 600 and the window's real size — rev 2.2: in the store build, the popup at 412 × 600, the vault
page at 412 × 916 and the approval window at 412 × 720. R9's E2E strips the `phrase` field inside the page: the real
background always sends a valid one (rev 2.2). `scripts/__tests__/presaleBuilds.test.mjs` runs `build.mjs` with
`NODE_ENV` removed (rev 2.3, review M7): it is the only test that runs the build, and `verify` and CI run it with no
`NODE_ENV`, so the test checks the production build that ships — nothing else changes. No test contacts
`*.noc-tura.io`; only the release script's live check does.

## 11. Open questions for the owner

None open after E15–E22. Rev 2's Q1 (LGPL) dissolved: no LGPL code ships (N3, E16). Rev 2's Q2 (the decrypt-damaged
vault) is a later step in §8.

Not the owner's, but blocking the release: ICO's §6.2 answers and P1.

## 12. Review 1 — where each finding went

| finding | rev 2 |
|---|---|
| C1 | §2.1 frozen predicate + two states (E9); §2.4 E5's order; §2.5 sessions (R3); §2.6 fixture controls, invariance test, named mutations |
| C2 | §2.4 the digest token, `vault.forgetDamaged`, the background re-judges, the digest only narrows; §2.6 digest controls |
| I1 | §4.3 probe, exact-string rule, inert allowlist with reasons, controls |
| I2 | §1.4 three existing answers, background-owned key; §1.6 built `relay.js` / `provider.js` gate |
| I3 | §6.1 P1–P16 from the code; per-install identifier dropped for Chrome |
| I4 | §6.2 P-R with the exact question; P1 inherited |
| I5 | §6.3 the form, Location yes, Website content yes (E13) |
| I6 | §1.3 table (R1) and the post-commit onboarding step |
| I7 | §6.5 exact sentences, normalisation, negative controls |
| I8 | §5.2 version (R5), §5.3 `key`, §5.4 STORE zip (R6) |
| I9 | §4.2 static page, gates by name, defined inputs |
| Minor 1–4 | §1.5, §1.5, §1.1 + §6.4, §1.6 |
| Minor 5–6 | §2.2 |
| Minor 7–8 | §3 |
| Minor 9 | §6.4 |
| Minor 10 | §5.5, §7 step 5 and 7 |
| Minor 11 | §6.3, §8 |
| Minor 12 | §5.1 (R10) |
| Q1–Q6 | E9–E14 |

**Review 2 — where each finding went (rev 2.1)**

| finding | rev 2.1 |
|---|---|
| N1 | §4.3 the skip by name; §4.2 the static-page rule and its mutations |
| N2 | §4.2 item 4 (the `licence-ids.json` table), item 6 (`Unlicense`, E15), controls |
| N3 | §4.2 items 1 and 6 (rendered code, the rendered-0 gate, the stub as a precaution, E16); R7 reworded; web3.js 1.99.0 |
| N4 | §5.6 (frozen, pre-upload gate, pin test + mutation, E17); §6.1 P12/P13; §6.4 justification and Help; §7 step 3 |
| Minor 1 | §2.6 deletable controls, one per clause; the partition test enumerates them |
| Minor 2 | §2.6 the invariance test's own positive control |
| Minor 3 | §2.1 "present" = `!== undefined`; `passkey: null` unreadable |
| Minor 4 | §2.6 encoder-generated breadth + the 458dfcd fixture |
| Minor 5 | §7 step 5 |
| Minor 6 | §4.2 items 1, 3 and §4.4 |
| Minor 7 | §1.3 citation |
| Minor 8 | §2.2 copy |
| Minor 9 | §4.2 item 3 (web3.js 1.99.0) |
| Owner Q1–Q4 | E15, E16, E17, E18 |
