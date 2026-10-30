# Noctura Extension B1e — the first Chrome Web Store release

**Status:** draft rev 2, 2026-10-30. Rev 1 (70e691d): the owner approved the design in conversation section by section
(2026-10-30: the release target, the presale decision, the hardening scope, where the legal pages live, D10, D31, then
the four design sections). Rev 2 applies Fable review 1 (`.superpowers/sdd/b1e-spec-review-1.md`: C1, C2, I1–I9 and
the twelve Minors) and the owner's answers to its six questions (`.superpowers/sdd/b1e-owner-decisions.md`, E9–E14).
Parent specs: B1 (`2026-09-27-extension-b1-design.md` §5 "Build, gates, release" and its release gates), B1b-2b (D10,
D31), B1c §6.5, B1d §6.5 and §7. Binding design: `/home/user/Downloads/index.html` (+ `screen.md`) — it contains the
TGE date; nothing is copied from it.

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
  page the gates admit by name, with defined inputs (I9); an LGPL finding (R7, §11 Q1).
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

**Spec rulings (rev 2).** Decisions the review asked the spec to take that need no owner: each is the most secure
default, with its reason where it is applied. The owner may overturn any.

| # | Ruling | Where |
|---|---|---|
| R1 | Phrase: **set when none is set** needs an unlocked session and no proof; **change** and **remove** need #10's proof | §1.3 |
| R2 | The phrase reaches pages only as a field of `wallet.state`, `vault.status` and `dapp.pending`; its key is background-owned (no page may name it) | §1.4 |
| R3 | `vault.setKeys` binds the keys through `envelopeShape`, not only `readWalletView`: no session is created over an envelope the background calls `stored-invalid` | §2.5 |
| R4 | "Save the damaged data" is offered on **both** damaged states (unreadable and refused); removal only on unreadable | §2.3 |
| R5 | One version source: `extension/package.json` `version` (first: `1.0.0`); `manifest/source.mjs` reads it | §5.2 |
| R6 | The store zip is a **hand-written STORE (uncompressed) zip**, no dependency | §5.4 |
| R7 | `licenses.html` refuses any licence outside an allowlist; `rpc-websockets` (LGPL-3.0-only, bundled today) is **stubbed out** of the package — no code path constructs a web3.js `Connection` | §4.2, §11 Q1 |
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
  (`Tx.tsx`);
- #10 re-authentication (`src/unlock/screens/reauth.ts`).

**No phrase set:** nothing shows; the extension behaves as today. **A read that fails** (no answer, an error) while a
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
`vault.reauthOk` applies it from the value bound at issue — as it applies a `settings` challenge through
`applySettingsChallenge` (`walletApi.ts:261`) — and the stored value is re-compared at apply time, under the mutex
(the last confirmed proof wins, as review M6 ruled for settings). #10's "what this is for" line says "Change the
anti-phishing phrase" or "Remove the anti-phishing phrase" — never the new value (the phrase line on #10 shows the
current one; two phrases on one screen invite confusion).

**Onboarding.** A skippable last step: "Set an anti-phishing phrase", with one sentence on why. It runs **after
`commitWallet`** (`onboarding.ts:148`), never before: the first write, `storeEnvelope(null, …)`, calls
`removeWalletData` (`accountsStore.ts:258-262`), which removes every `WALLET_DATA_KEYS` key — a phrase written before
the commit would be wiped by it. Placement:
- create: after #6 passkey's `done` (`createRun.ts:129`), before `wallet.html#/created` — not before #6, which would
  hold the typed password longer (#6 holds it, §3.5 of B1b-2a);
- import: after `created`, before `wallet.html#/imported` (`importRun.ts:62`);
- `created-locked` (the keys did not reach the background): the step is skipped — `set` would answer `locked`; #35
  offers it.

**Settings → Security (#35):** a row "Anti-phishing phrase · On / Off"; set, change, remove.

### 1.4 Storage and reads (I2, R2)

- **Key** `v1_phishing_phrase` in `storage.local`, plain text: added to `WALLET_DATA_KEYS` (`accountsStore.ts:52` —
  wiped by a delete and by a first write, kept by #39's restore, which replaces the envelope without
  `removeWalletData`) and to `BACKGROUND_OWNED_KEYS` (`check-vault-isolation.mjs:103`): no file outside
  `src/background/` may even name it, so no page can write it around the proof. A plain `ext.local.remove` (not in
  `LOCKED_DATA_KEYS`): a `settings.phrase` write racing a delete's cleanup can leave it behind, and the next first
  write's `removeWalletData` is the backstop — the same accepted race as `v1_settings` (`forgetWallet` step 7 comment).
- Not encrypted, on purpose: it must show before unlock, and it is no secret from the user's own machine, only from
  websites.
- **Reads ride on existing answers; no new read type:**
  - `wallet.state` gains `phrase: string | null` — the popup and the UI tab (answered locked or unlocked:
    `walletState`, `walletApi.ts:117`);
  - `vault.status` gains `phrase` — the vault page's #9 and #10 (`vault.status` is already sent by `reauthFlow.ts`;
    the unlock screen adds one call in its `reading` phase);
  - `dapp.pending`'s answer gains a top-level `phrase` in every state (`pending()`, `dapp/decide.ts:159`) — the
    approval window, whose inclusive list (`dapp.pending`, `dapp.decide`) is unchanged.

### 1.5 Rules (Minors 1, 2)

- NFC-normalised, then trimmed; **3–32 UTF-16 code units** (as `cleanName` counts, `envelopeRules.ts:46`); no
  character of `FORBIDDEN_IN_NAME` (`envelopeRules.ts:43`: controls, format characters, line and paragraph
  separators, bidi embeddings / overrides / isolates, zero-width joiners, the combining grapheme joiner, variation
  selectors) — so a bidi override cannot restyle the line. This also refuses emoji written with a ZWJ or a variation
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
   - `passkey` is present and is not an object, or its `credentialId` is not strict base64 of at least 1 byte, or its
     `prfSalt` not of exactly 32, or its `wrapped` not of exactly 40;
   - `accounts` is not an array, or an entry is not an object with a safe integer `index` ≥ 0, a string `name` and a
     string `publicKey`.

Everything else is **readable**: unknown extra fields; an unknown `scheme` **string**; a KDF cost outside today's
bounds; an empty account list, more than 100 accounts, duplicate indexes, an empty `publicKey`, a `cli` wallet with
two accounts (all policy, `accountsPolicyOk`); any `v ≥ 2`. The byte lengths are v1's algorithms (Argon2id salt,
AES-GCM IV and tag, AES-KW of a 32-byte key, the PRF salt), fixed by `v: 1` itself — a format that changes them must
change `v`, which this predicate then refuses to judge.

**Partition, as a test:** for every value the predicate calls unreadable, `envelopeShape` returns `null` and
`storedVault` answers `damaged` (every U-clause is one of their checks) — so the four readings never overlap.

**Out of the predicate, said loudly:** a vault that is readable and accepted, whose password unwraps the data key but
whose seed ciphertext then fails AES-GCM (`unlockFlow.ts` answers `damaged` after the unwrap), is neither unreadable
nor refused — it reads as a **wallet**. B1e does not change its path: #9 shows today's damaged notice and help
(`COMMON.damagedHelp`, `strings.ts:17`: remove Noctura, reinstall, import the phrase). Offering #37's proof-gated
delete from that notice is §11 Q2.

### 2.2 The screens (E9, E11, Minors 5, 6)

Both entry points that show the damaged notice today get the new states: #9 (`screens/unlock.ts`, its `damaged`
phase) and #1 welcome (`screens/welcome.ts:95`). The page decides which with `storedVault` and `unreadableV1` on its
own read of `v1_vault` (`readLocal`); the background re-judges at removal (§2.4).

**Refused by this version** — "This version of Noctura can't open this wallet's data." + "Update Noctura (in Chrome:
Extensions → Update). If it is up to date, the data may have been changed. Nothing was removed." + today's
`damagedHelp` as the last resort. Buttons: **Save the damaged data** (§2.3). No removal.

**Unreadable** — "Wallet data is damaged" + "This browser's copy of your wallet can't be read by any version of
Noctura." + "Your funds are on Solana. After you remove this copy, **only your recovery phrase reaches them**." (O64's
wording, `DeleteWallet.tsx` `fundedTail`) — said **before** the typed word (Minor 6), never "funds are safe".
Buttons: **Save the damaged data**, **Remove damaged wallet**.

**The removal screen** (vault page, plain DOM — the vault page may not carry React, `bundleViolations`):
- the lines above, repeated; "This removes the wallet from this browser only.";
- the address (Minor 5): among `accounts` entries that are objects with a safe integer `index` ≥ 0 and a `publicKey`
  matching `^[1-9A-HJ-NP-Za-km-z]{32,44}$` (the `ADDRESS` shape, `reauthChallenges.ts:155`), the one with the
  **lowest** index, in groups of four (`addressGroups`); none → "The address can't be read". Never `accounts[0]`;
  nothing else of the value is rendered;
- the typed **DELETE** and #37's confirmation rule (§3: the hold, or the checkbox and one click) — E11. No password:
  an unreadable vault cannot be opened.
- Refusals: `send-open` → #37's text (`DELETE_TEXT.sendOpen`, E12); `busy` → "The stored data changed — check it
  again", and the screen re-reads; `not-unreadable` → the screen re-reads and shows the state it now finds (refused
  or a wallet); `unlocked` → "Noctura was unlocked meanwhile — try again".

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
  the copy does not promise one.)
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
     (a refused vault and a wallet both land here); digest ≠ expected → `busy`;
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
  refuses. B1e binds it through `envelopeShape` too: keys over a `stored-invalid` envelope are refused (`malformed`).
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

**Deletable controls:** `null`; `[]`; `"x"`; F0 with `seed.iv` of 11 bytes; F0 without `password`; F0 with
`v: "1"`; F0 with `kdf.m: "65536"`; F0 with an unpadded `kdf.salt` → `forgotten`, `v1_vault` absent, the phrase gone.

**Digest controls (C2):** the right digest of an unreadable value replaced by another unreadable value between the
read and the click → `busy`, nothing removed; a digest of 63 hex → `malformed`; an open send → `send-open`, nothing
removed, the vault still there.

**Invariance — policy tightened, the controls must stay as they are.** A test mocks `../shared/envelopeRules` with
`ENVELOPE_KDF_MIN.m = 131072`, `MAX_ACCOUNTS = 1` and an `accountsPolicyOk` that refuses everything, and asserts
`unreadableV1` gives the same verdict on every control above; a source test asserts `src/shared/unreadable.ts` imports
only `@scure/base`.

**Named mutations of the predicate — each must turn a control RED** (run in the plan's task, the result recorded):
- M-version: U2 changed to "`v !== 1` is unreadable" → F4 deleted → RED;
- M-kdf: U3 applies today's KDF bounds → F2 and F3 deleted → RED;
- M-policy: U3 calls `accountsPolicyOk` → F5, F6, F7 deleted → RED;
- M-scheme: U3 requires `scheme ∈ {slip10, cli}` → F8 deleted → RED;
- M-iv: the `seed.iv` length check dropped → the 11-byte-IV control kept → RED (the negative direction);
- M-digest: step 5's digest re-check dropped → the replaced-value control removes → RED;
- M-lock: step 6's session check dropped → a session written straight into the session store before the click (as a
  disk-fault session would be; R3 keeps `setKeys` from making one) is not refused, the vault is removed → RED.

## 3. #37 without holding (E6, D31) — and §2's removal (E11)

- The hold (1 s, `HOLD_MS`, pointer or Space/Enter held) stays (`HoldButton.tsx`).
- **Added:** a native `<input type="checkbox">` under the button, labelled "I understand this permanently removes this
  wallet from this browser". When it is checked **and** DELETE matches, the button deletes on **one activation** —
  a click, or Space / Enter **on the button** — without a hold.
- **Enter does not confirm (Minor 7, B1's rule):** Enter in the DELETE field activates nothing — neither the hold nor
  the checkbox path. Test.
- **Checkbox state (Minor 8):** unchecked on every entry to the screen; cleared whenever the typed word stops
  matching; never remembered.
- On #37 the typed **DELETE** and the password / passkey proof in the vault tab stay required; the checkbox only
  trades the hold. On §2's removal (no proof exists) the typed word + (hold or checkbox and one activation) **is** the
  gate (E11); the vault page builds both in plain DOM, with the same rules.
- Tests: hold works; checkbox + one click works; checkbox + Space / Enter on the button works; neither → nothing;
  Enter in the field → nothing; the checkbox clears when the word changes; the checkbox and the button have their
  roles and labels (screen-reader operable); the typed word (and on #37 the proof) is still required in every path.

## 4. Links: Terms, Privacy, licences, Help (E4)

### 4.1 In the extension

- **#1 welcome** (`src/unlock/screens/welcome.ts`): under the buttons, as drawn, "By continuing you agree to the
  **Terms** and **Privacy Policy**" — both links.
- **#38 About** (`src/app/screens/About.tsx`): the rows Terms, Privacy, Open-source licences, Help, as drawn.
- Terms, Privacy and Help open in a new tab: `https://noc-tura.io/extension/terms`, `/extension/privacy`,
  `/extension/help`, as `<a target="_blank" rel="noopener noreferrer">` — the pattern of the explorer link
  (`TxDetail.tsx:65`). Links the browser opens, never a fetch: CSP `connect-src` stays exactly
  `https://api.noc-tura.io` (`check-permissions.mjs` `REQUIRED_CONNECT_SRC`).
- **Open-source licences** open `licenses.html` inside the package (§4.2), in a new tab; no network.

### 4.2 `licenses.html` (I9, R7)

**A static root page.** Generated by `scripts/build.mjs` after the Vite builds, written to `<outRoot>/app/licenses.html`
before the per-browser copies, so `chrome/` and `firefox/` carry the same file. It has **no `<script>`, no `<style>`,
no `style` attribute and no `<link>`** — plain HTML (`<meta charset="utf-8">`, a title, headings, `<pre>` blocks), so
under the CSP it can load nothing and run nothing. The gates are taught it **by name**:
- `check-vault-isolation.mjs`: a new `STATIC_PAGES = ['licenses.html']`; every `.html` at a package root must be a key
  of `ENTRIES` or a member of `STATIC_PAGES` (an unknown page fails); a static page with a `<script>`, `<style>`, a
  `style` attribute or a `<link>` fails. `bundleViolations` already treats every built `.html` as a page whose
  scripts it follows (none here).
- `check-csp.mjs` reads every `.html` under the package (`checkHtml`): it covers the file unchanged.
- `check-page-bundles.mjs` covers the two content scripts only; it is unaffected (no change).
- Mutations: a `<script src="x.js">` in the generated file → fails; a `<style>` → fails; a second, unknown
  `extra.html` in the package → fails.

**Inputs (defined).**
1. **Module ids** from the build's module maps — `dist*/app.modules.json` (pages, background, the KDF worker),
   `dist*/app.provider.modules.json`, `dist*/app.relay.modules.json` (`vite.config.ts` `chunkModules`; ids
   package-relative, `moduleId`). Skipped: ids starting with `\0` (virtual) and `__vite-browser-external`.
2. **Ours:** ids under `src/`, the root `.html` entries, `../core/`, `../web/` → one entry "Noctura" under the
   repository's `LICENSE` (Business Source License 1.1).
3. **Packages:** for an id under `node_modules/`, the **nearest `package.json` with a `name`** walking up from the
   module's directory — so a nested copy (`@solana/web3.js/node_modules/@noble/hashes` 1.8.0 beside the top-level
   2.4.0) is its own entry. Entry = name, version, `license` field, licence text.
4. **Licence text:** the package directory's `LICENSE*`, `LICENCE*` or `COPYING*` files (all of them, sorted by name —
   `borsh` ships `LICENSE-APACHE` and `LICENSE-MIT.txt`), CRLF folded to LF. No such file → the SPDX id from
   `package.json` `license`, with that licence's standard text from a committed table
   (`extension/release/licence-texts/<SPDX>.txt`) headed by the package's `author` field; neither → **the build
   fails** (no silent "unknown"). Probe: `bs58` 4.0.1 (twice) and `qrcode-generator` 2.0.4 ship no licence file and
   say MIT; `text-encoding-utf-8` has a `LICENSE.md` and no `license` field (the file wins).
5. **Non-module assets:** the two Geist fonts in `public/fonts/` (copied as files, never modules) — an entry from a
   committed `extension/public/fonts/LICENSE.txt` taken from the Geist release the files came from; any file under
   `fonts/` in the package without an entry fails the build.
6. **Allowlist (R7):** a licence outside {MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, OFL-1.1, and ours}
   fails the build. Today that refuses **`rpc-websockets` 9.3.9, LGPL-3.0-only**, bundled into `background.js`
   by `@solana/web3.js` (probe). No code here constructs a web3.js `Connection` (the extension's RPC is
   `core/solana/rpc.ts`; `grep 'new Connection'` over `extension/src` and `core` finds none), so B1e-1 resolves
   `rpc-websockets` to a local stub module (one class with the members web3.js's top level reads, throwing if ever
   constructed), and a gate asserts no `node_modules/rpc-websockets/` id is in any module map. If the stub cannot be
   made to hold, shipping LGPL code is §11 Q1 — never a quiet allowlist edit.
7. **Order and determinism:** "Noctura" first, then entries sorted by name, then version (C collation); texts
   HTML-escaped; no date, no absolute path. Determinism follows from the lockfile; `verify-reproducible.mjs` covers the
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
packages. It reads every `.js`, `.html`, `.css` and `.json` file and extracts every match of
`\b(?:https?|wss?|ftp)://[^\s"'`<>)\\;]*`. Each match must equal, **as a whole string**, one entry of:
- **Coordinator:** `https://api.noc-tura.io/*` and `https://api.noc-tura.io` (in `manifest.json` only);
  `https://api.noc-tura.io/api/v1` and `https://api.noc-tura.io/api/v1/rpc` (in `background.js` only) — a page
  naming the coordinator fails (pages reach it only through the background);
- **RP ID host:** `https://wallet.noc-tura.io/*` (in `manifest.json` only);
- **Navigable links (each must also be PRESENT):** `https://solscan.io/tx/`, `https://noc-tura.io/extension/terms`,
  `https://noc-tura.io/extension/privacy`, `https://noc-tura.io/extension/help`;
- **Inert library strings**, each with its package and reason in the gate: the React error decoder, the `uuid`
  message, the five W3C namespaces. Inert means never fetched — `connect-src` admits only the coordinator — and never
  navigated: no `href`, `window.open` or `openPage` is built from them (they are message text and namespace ids).

Anything else fails, naming the file. Zero matches in a package → `INCONCLUSIVE` (the extraction broke).

**Controls.** Positive: both real packages pass. Negative, each on a copy: a planted `https://evil.example/` in a page
chunk → fails; `https://noc-tura.io/extension/privacy` removed → fails (presence); `https://api.noc-tura.io/api/v1`
planted in a page chunk → fails; one inert entry changed by one character → the real package fails; a planted
`wss://evil.example` → fails. A library update that changes an inert string fails the gate until a reviewer adds the
new string with its reason.

### 4.4 Tests

The four rows on #38 and the two links on #1 (href, `target`, `rel`); `licenses.html` generated, deterministic (two
builds, one hash), containing every package of the module maps and no other; the allowlist failure on a planted
LGPL package; the gates and mutations above.

## 5. The release build (E2)

### 5.1 `npm run release:chrome`

1. `npm run verify` (clean; it builds both variants, runs the tests, the CSP, secrets and every gate including
   `check-no-presale.mjs` and §4.3, and `verify-reproducible.mjs`: four builds in temp dirs, one file digest each).
2. **A third witness (R10, Minor 12):** `node scripts/build.mjs <tmp> --no-presale`; its `chrome/` file digest
   (`web/scripts/build-manifest.mjs`) must equal that of `verify`'s `dist-nopresale/chrome`. The release packs
   `verify`'s `dist-nopresale/chrome` itself — no fifth build is packed.
3. The live check (§6.5).
4. The zip (§5.4), written twice; the two sha256 must be equal.
5. `extension/release/notes-<version>.md`: version, the zip's sha256, the package's file digest, the commit.

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
| P12 | "If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it." | the WebAuthn ceremony is the browser's; no route carries it |
| P13 | "The sites you connected, your address book and your anti-phishing phrase are stored only in this browser." | `v1_dapp_grants`, `v1_contacts`, `v1_phishing_phrase`; no route carries them |
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
  (the two states of §2, saving the data); why a transaction is blocked; what the coordinator sees (P1–P8); the
  contact.
- **Store listing** — name, short description (≤ 132 characters), detailed description, category (the owner picks at
  submission), the single-purpose statement ("A Solana wallet: hold, send and receive SOL and tokens, and approve
  requests from Solana sites."), a justification for each permission taken from `manifest/source.mjs`'s reasons
  (`PERMISSIONS`, `HOST_PERMISSIONS`, `CONTENT_SCRIPTS.reason`), "remote code: none", and §6.3's answers. **No
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
3. Upload the zip, paste the listing and §6.3's answers, add the screenshots. Submitting for store review **with
   publishing deferred** (the owner publishes manually after approval) may happen now (E14).
4. **The independent external security review (B1 release gate 2; vendor and cost are the owner's) is done before
   step 6 — before the Unlisted listing, i.e. before any distribution (E14).** Its findings are fixed or accepted in
   writing first.
5. Install the uploaded zip unpacked once in a clean profile: record the install warning (§5.5) and the version on #38.
6. Visibility: **Unlisted** for a few days with known testers, then **Public** (recommended); the owner decides at
   submission.
7. After the store assigns the ID: record the ID and its public key in `extension/release/store-key.json` (§5.3) in a
   follow-up commit, with the "no existing users" evidence of §5.5.

## 8. Out of scope (later steps)

Firefox / AMO (B1c §6.5's checks, `gecko.id`, the per-install identifier in its privacy text, and the AMO
`data_collection_permissions` taxonomy check — **never** added to the Chrome manifest "for completeness", Minor 11);
the drainer / phishing list; the DNR spike; presale in a store build (B1d §6.5: then the disclosures list presale and
the external review covers §3.3 and §3.6); hardware wallets; a second simulation source; a delete path for a vault
whose seed fails to decrypt after a correct password (§2.1, §11 Q2).

## 9. Undrawn elements (flagged)

The anti-phishing phrase line (and R9's "could not be read" line), its onboarding step and its Security row; the two
damaged states, "Save the damaged data" and the removal screen; #37's checkbox (and the same on the removal screen);
`licenses.html`; the screenshot backdrop. Each is built from the design system's existing components (B1b's banner,
input and row styles; `licenses.html` has no stylesheet at all) and shown to the owner in the visual pass of B1e-1
(B1e-2 for the backdrop).

## 10. Tests and gates (both plans)

Unit tests for every rule above with positive and negative controls and named mutations (§1.6, §2.6, §3, §4.2–§4.4,
§5.2–§5.4, §6.5); the vault-isolation (with `STATIC_PAGES` and the built-content-script `storage` rule), CSP,
permissions (version, `key`), classes, no-presale, links and reproducible gates green; E2E for the phrase on the six
screens, both damaged states (removal of an unreadable vault, its refusal for F0, the save download), #37's checkbox
path, the links and `licenses.html`; every E2E normally and under `unshare -rn`; a visual pass of the undrawn elements
at the popup's 412 × 600 and the window's real size. No test contacts `*.noc-tura.io`; only the release script's live
check does.

## 11. Open questions for the owner

1. **Q1 — LGPL code (R7).** `rpc-websockets` 9.3.9 (LGPL-3.0-only) is bundled into `background.js` today via
   `@solana/web3.js`. The ruling stubs it out (unused). If the stub cannot hold, is shipping LGPL-3.0 code acceptable,
   with its licence in `licenses.html` and the public repository as the source route? That is a legal call, not the
   plan's.
2. **Q2 — the decrypt-damaged vault.** A vault that is well formed and whose password unwraps the key, but whose seed
   then fails AES-GCM, keeps today's help (uninstall, reinstall, import). Offer #37's proof-gated delete from #9's
   damaged notice in a later step, or leave it?

Not the owner's, but blocking: ICO's §6.2 answers and P1.

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
