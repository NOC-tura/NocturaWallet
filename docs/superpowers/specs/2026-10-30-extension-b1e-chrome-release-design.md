# Noctura Extension B1e — the first Chrome Web Store release

**Status:** draft rev 1, 2026-10-30. The owner approved the design in conversation section by section (2026-10-30: the
release target, the presale decision, the hardening scope, where the legal pages live, D10, D31, then the four design
sections). Parent specs: B1 (`2026-09-27-extension-b1-design.md` §5 "Build, gates, release" and its release gates),
B1b-2b (D10, D31), B1c §6.5, B1d §6.5. Binding design: `/home/user/Downloads/index.html` (+ `screen.md`) — it contains
the TGE date; nothing is copied from it.

## 0. Scope and decisions

B1e is cut down to **the first release: Chrome Web Store, presale off**. It is one spec with two plans:

| plan | what |
|---|---|
| **B1e-1 — code** | the anti-phishing phrase (§1), the damaged-vault delete path (§2), #37's accessible confirmation (§3), the Terms / Privacy / licences / Help links (§4) |
| **B1e-2 — release** | the release build and its checks, the stable ID, the store material, the privacy policy / terms / help texts for ICO to publish, the owner's submission checklist (§5–§7) |

| # | Owner decision (2026-10-30) | Where |
|---|---|---|
| E1 | The first release is **Chrome Web Store**; Firefox (AMO) is a later step with its own open points (B1c §6.5) | §0, §8 |
| E2 | The store build is **`--no-presale`** (B1d D2). Site purchases are still screened by the region gate (F12, D15) | §5 |
| E3 | Of B1's deferred hardening, only the **anti-phishing phrase** ships now; the drainer list and the DNR spike are later | §1, §8 |
| E4 | Terms, Privacy and Help live on **noc-tura.io**, published by ICO from texts this work writes; the owner (or a lawyer) approves the Terms | §4, §6 |
| E5 | D10: a **damaged vault gets a delete path** behind a typed confirmation | §2 |
| E6 | D31: #37 gets an **accessible alternative to the hold** (a checkbox), the typed word and the proof stay | §3 |
| E7 | One spec, two plans | §0 |
| E8 | The privacy / support contact on every page is **privacy@noc-tura.io** | §6 |

Every element in §1–§3 that `index.html` does not draw is **undrawn and flagged** (§9); it is built from the design
system's existing components and shown to the owner in the visual pass.

## 1. The anti-phishing phrase (E3)

**What it protects against.** A website can draw, inside its own page, a fake "Noctura" window asking for the password
or an approval. The phrase is text the user chose; the real extension knows it, a website cannot read the extension's
storage. A window without the phrase is not the extension's.

**Where it shows** — one line under the screen's header, a shield icon + the phrase as plain text (never HTML):
- the vault page's unlock screen (`src/unlock/screens/unlock.ts`) **before** the password is typed, and the popup's
  locked screen (`src/app/screens/Locked.tsx`);
- every approval window: #46 sign message (`src/approve/Sign.tsx`), #47 connect (`Connect.tsx`), #48 transaction
  (`Tx.tsx`);
- #10 re-authentication (`src/unlock/screens/reauth.ts`).

**How it is set.**
- A skippable last step of onboarding (create and import): "Set an anti-phishing phrase", with one sentence on why.
- Settings → Security (#35): set, change or remove. A change is a settings change, so it needs re-authentication (#10),
  as every settings change does (B1 §3).

**Rules.** 3–32 characters after NFC normalisation and trimming; any printable character; shown as text only. An empty
value means "no phrase".

**Storage.** `storage.local`, plain text, a new key in `WALLET_DATA_KEYS` (`src/background/accountsStore.ts`) — wiped by
a wallet delete, kept by a restore. Not encrypted on purpose: it must show before unlock, and it is not a secret from the
user's own machine, only from websites (which cannot read extension storage). Written only by the background (a new
message in the settings partition, behind the re-authentication proof); every page reads it through the background.

**No phrase set:** nothing shows, the extension behaves as today. Recommended, never required.

**Tests.** The phrase on all six screens; nothing when unset; both builds; set / change / remove each need the proof; a
website-context script cannot read it (the provider's world has no access); the key is wiped by delete and kept by
restore; a phrase with `<b>` renders as text.

## 2. Removing a damaged vault (E5, D10)

**Where.** When the stored vault is invalid (`stored-invalid`; `accountsFlow.ts` already names it `damaged`), the unlock
screen shows a "Wallet data is damaged" state: what happened, that funds are safe on chain, and a **"Remove damaged
wallet"** button.

**The removal screen.**
- Says that the wallet is recovered only with its recovery (seed) phrase, and that this removes the wallet from this
  browser only.
- Shows the first account address in groups of four if it can still be read from the damaged data, otherwise "The
  address can't be read".
- Asks for the typed word **DELETE** and the same confirmation rule as #37 (§3: hold, or the checkbox and one click).
- Asks for **no password**: a damaged vault cannot be opened.

**The rule that makes it safe.** The background deletes **only if the stored vault is still invalid at the moment of
deletion**, read again inside the vault's own section and bound to the storage revision the screen saw. A valid vault —
restored, replaced or written in between — is never deleted by this path; the answer is a refusal and the screen
re-reads. Tests prove both the positive case and this negative one, each with a named mutation.

**After.** The same as #37's delete: the wallet data keys are wiped (the phrase with them) and the extension shows
onboarding ("Import wallet").

**Who could abuse it.** Only someone with access to the browser profile; such a person can also uninstall the extension.
No new capability.

## 3. #37 without holding (E6, D31)

- The hold (1 s, pointer or Space/Enter) stays.
- **Added:** a native checkbox under the button, "I understand this permanently removes this wallet from this browser".
  When it is checked, the button deletes on one activation, without a hold.
- The typed **DELETE** and the password / passkey proof in the vault tab stay required.
- The same rule on §2's removal screen.
- Tests: hold works; checkbox + one click works; neither → nothing; the checkbox and button have their roles and
  labels (screen-reader operable); the typed word and the proof are still required in every path.

## 4. Links: Terms, Privacy, licences, Help (E4)

**In the extension.**
- **#1 welcome** (`src/unlock/screens/welcome.ts`): under the buttons, as drawn, "By continuing you agree to the
  **Terms** and **Privacy Policy**" — both links.
- **#38 About** (`src/app/screens/About.tsx`): the rows Terms, Privacy, Open-source licences, Help, as drawn.
- Terms, Privacy and Help open in a new tab: `https://noc-tura.io/extension/terms`, `/extension/privacy`,
  `/extension/help`. They are links the browser opens, never a fetch of the extension (CSP `connect-src` unchanged).
- **Open-source licences** are **inside the package**: `licenses.html`, generated at build time from the packages that
  actually ship (the bundles' module maps), deterministic so the reproducible-build gate still holds; shown without
  network.

**Gate.** A new check over the built package: every `https://` URL that is not `connect-src` is one of exactly
`https://solscan.io/tx/`, `https://noc-tura.io/extension/terms`, `/extension/privacy`, `/extension/help` (and the
three are present). Positive and negative controls, as every gate here.

## 5. The release build (E2)

- `npm run release:chrome`: a clean `--no-presale` Chrome build; the version from `extension/package.json` (the first
  is **1.0.0**); a deterministic zip; its sha256 printed and written to the release notes.
- **Before it packs**, it runs and requires green: `npm run verify` (which already includes the reproducible-build
  gate: two builds, one hash, and `check-no-presale.mjs`), the new link gate (§4), and a live check that the three
  noc-tura.io pages answer 200 and the privacy page contains every item of §6 (read-only GETs; the release script only,
  never a test).
- **Stable ID.** The Chrome Web Store assigns the ID at the first upload. Its public key then goes into the manifest's
  `key` **for development builds only**, so development uses the store's ID; the store build omits `key`. How the store
  treats `key` is checked before the first submission (B1 §5) and the result is recorded in this spec.
- **The `<all_urls>` update gate (B1c §6.5) does not apply to the first release:** the first store version carries
  `<all_urls>` from the start, so there are no existing users to be disabled; the warning shows at install. The gate
  applies to every later update that adds a permission.

## 6. Texts for the store and for noc-tura.io (B1e-2)

Written as files in the repo (`extension/release/`), each claim traceable to the code or a test that proves it.

- **Privacy policy** (for `noc-tura.io/extension/privacy`), from B1 §5's list, made exact for the `--no-presale` build:
  what goes to the coordinator (the IP address; public addresses for balances and history; the **contents of every
  transaction before signing**, for simulation; every signed transaction, for broadcast; the jurisdiction check), what
  goes to the passkey provider if passkeys sync, what never leaves (seed, private keys, browsing data, analytics, the
  anti-phishing phrase), what is kept and for how long on the coordinator (from ICO), and the contact
  **privacy@noc-tura.io**.
- **Terms** — a **draft for the owner's lawyer**, not legal text: non-custodial software, the user holds the keys and the
  responsibility, no financial advice, no warranty, the BSL 1.1 licence, the contact.
- **Help** — a short FAQ (recovery phrase, the anti-phishing phrase, a damaged wallet, why a transaction is blocked,
  what the coordinator sees) and the contact.
- **Store listing** — name, short description (≤ 132 characters), detailed description, category, the single-purpose
  statement, a justification for each permission taken from the reasons in `manifest/source.mjs`, "remote code: none",
  and the answers to the store's data-usage form, consistent with the privacy policy. **No presale, no TGE date, no
  privacy claim the build does not keep** (memory "shielded privacy guarantee": the extension is transparent).
- **Screenshots** — five at 1280 × 800, taken by Playwright from the real `--no-presale` extension, contained (no
  network), checked for no date of the TGE.

## 7. The owner's submission checklist (B1e-2 writes it)

1. Developer account (5 USD fee, 2-step verification, a verified contact e-mail, the EU trader / non-trader
   declaration).
2. The independent external security review (B1 release gate 2; vendor and cost are the owner's) — before the listing
   goes public.
3. ICO publishes the three pages; the release script's live check passes.
4. Upload the zip, paste the listing and the form answers, add the screenshots.
5. Visibility: **Unlisted** first for a few days with known testers, then **Public** (recommended); the owner decides
   at submission.
6. After the store assigns the ID: record it and its public key (§5) in a follow-up commit.

## 8. Out of scope (later steps)

Firefox / AMO (B1c §6.5's checks, `gecko.id`, the per-install identifier disclosure); the drainer / phishing list; the
DNR spike; presale in a store build (B1d §6.5: then the disclosures list presale and the external review covers §3.3
and §3.6); hardware wallets; a second simulation source.

## 9. Undrawn elements (flagged)

The anti-phishing phrase line, its onboarding step and its Security row; the damaged-vault state and removal screen;
#37's checkbox. Each is built from the design system's existing components (B1b's banner, input and row styles) and
shown to the owner in the visual pass of B1e-1.

## 10. Tests and gates (both plans)

Unit tests for every rule above with positive and negative controls and named mutations; the vault-isolation,
CSP, permissions, classes, no-presale and reproducible gates stay green; E2E for the phrase on the six screens, the
damaged-vault removal (and its refusal for a valid vault), #37's checkbox path, the links; every E2E normally and under
`unshare -rn`; a visual pass of the undrawn elements at the popup's 412 × 600 and the window's real size. No test
contacts `*.noc-tura.io`; only the release script's live check does.
