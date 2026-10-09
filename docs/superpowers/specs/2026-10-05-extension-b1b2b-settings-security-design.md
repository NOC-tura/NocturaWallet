# Noctura Extension B1b-2b — settings & security, and the address book

**Status:** **approved rev 3**, 2026-10-05. The owner approved the design (sections 1–3 of
`.superpowers/sdd/b1b2b-approved-design.md`), took decisions D1–D23, and on 2026-10-05 approved this spec with the
controller rulings C1–C20 and confirmed every string in §12 (O01–O88). Each plan gets a Fable 5.1 review before SDD.
On 2026-10-08 the owner answered the plan-1 PR's questions (PR #107) with D24–D33 (table below); D24–D27 and D29 are
built on that PR, the rest accepted as they stand.

**Revision 3** applies every finding of Fable review 2 (`.superpowers/sdd/b1b2b-spec-review-2.md`: H1, M1, M2,
L1–L7; verdict "approve after fixes"), with the coordinator's rulings: H1 keeps rev 2's #36 ruling and bounds it with a
5-minute TTL (C20); "first account" is the lowest `index` on both sides (M1); the delete page compares the revision
before any KDF run (M2). Where each finding landed: §11 "Revision 3" table.

**Revision 2** applies every finding of the Fable 5.1 review `.superpowers/sdd/b1b2b-spec-review-1.md` (H1–H3, M1–M6,
L1–L11; verdict "approve after fixes"), with the coordinator's rulings: **H1 is the owner's decision D23** (reveal and
verify take the password only); M2 is ruled (#36 keeps its fields while the tab is hidden); the rest as the review
recommends. Where each finding landed: §11 "Revision 2" table.

**What this is.** The settings and security screens of the owner's design (`/home/user/Downloads/index.html`,
`/home/user/Downloads/screen.md`), built on the merged B1b-2a extension (`main` at 2c9d88b; PRs #101–#104): full #31
settings, #35 security center, #36 change password, #37 delete wallet, passkey management (#6 "manage"), the designed
reveal-phrase screen and a verify-phrase check, an accounts manager, and, in a second plan, the #15 address book with
its hooks on #12, #20 and #27. It also adds the engine extensions E9–E17 that these screens need.

**One spec, two plans** (owner split):

| plan | content | order |
|---|---|---|
| **B1b-2b-1 — security** | E9–E16; the vault-page modes `password`, `delete`, `passkey`, `reveal`, `verify`, `accounts` (§3); #31, #35, the accounts manager, the passkey screen (§4); #37 (§5); E2E 14–18; the visual pass | engine → vault modes → #31/#35/accounts/passkey → #37 → E2E → visual |
| **B1b-2b-2 — address book** | E17; #15 and the contact sheet; the hooks on #12, #20, #27 and #31's "Address book" row (§6); E2E 19; the visual pass | store + messages → #15 + sheet → hooks → E2E + visual |

Each plan: Fable 5.1 review → SDD → final review → PR. Plan 2 needs plan 1's #31.

**Sources.** Owner decisions `.superpowers/sdd/b1b2b-decisions.md` and the approved design
`.superpowers/sdd/b1b2b-approved-design.md` (binding); the survey `.superpowers/sdd/b1b2b-context.md`; the B1b-2a spec
`docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md` ("2a"); the parent spec
`docs/superpowers/specs/2026-09-27-extension-b1-design.md` rev 5 ("B1"); the merged code under `extension/src` and `core/`.
Paths below are relative to `extension/` unless they start with `core/`, `docs/` or `/home`.

**Numbering.** 2a's decisions and rulings stay in force and are cited with a prefix: **2a-D9**, **2a-C4**. This spec's
owner decisions are **D1–D22** and its controller rulings **C1–C16**, both without a prefix. Engine extensions continue
2a's numbering: 2a has E1–E8, this spec adds **E9–E17**. E2E specs continue 2a's 1–13 with **14–19**.

**How to read the per-screen sections.** As in 2a: every design state is listed with its copy and its `index.html` line
(`ix:NNNN`) or `screen.md` line (`sm:NNN`). Copy in "quotes" is the design's English unchanged unless marked **→ adapted**
(with the decision or engine fact that forces it). Copy the design does not have is marked **controller addition — owner
to confirm (Onn)**; every such string is listed once in §12. Strings that already exist in the merged code and were
confirmed in 2a are marked **(2a)** and are not re-asked. Each screen ends with **Differs, loudly**: everything the design
shows that this spec does not build, with where it goes (CLAUDE.md: never silently omit a design element).

**Never the TGE date.** #35's staking row carries it; the row is out of scope (D4) and the date is written nowhere here
("[TGE date redacted]"). The repo gate `scripts/check-no-tge-date.mjs` and the package gate
`extension/scripts/check-no-tge-date.mjs` enforce it.

---

## Decisions

### Owner decisions (D1–D23, 2026-10-05)

| # | owner decision (substance) | applied here |
|---|---|---|
| Split | One spec, two plans: plan 1 security; plan 2 address book (#15 + hooks) | header, §12 of the approved design |
| D1 | Auto-lock picker **1 / 5 / 15 / 60 min**; no "Never" (declared) | #35 Locks, E9 |
| D2 | App-lock: a static info row **"Locks when the browser closes"** | #35 Locks |
| D3 | No score ring or number; **Outstanding tasks** / **Active protections** rows from real facts | #35 (C15) |
| D4 | #35 backup task becomes **"Write down your recovery phrase"** (→ reveal); air-gap and staking rows omitted (declared) | #35 |
| D5 | Re-auth threshold: a picker card **$50 / $100 / $500 / $1,000** | #35 Locks |
| D6 | A weakening setting is applied **by the background** when #10's Confirm satisfies the settings challenge | E9, #10 settings kind |
| D7 | #31 and #35 live in the popup; **only proofs open a tab** | §1, §4 |
| D8 | #36 in the vault tab, 3 steps (current password → new + meter → confirm); same Argon2id cost, new salt, passkey kept; step 1 **password only** | E10, §3.1 |
| D9 | #37: typed **DELETE** + **hold 1 s** (Space/Enter held) + password/passkey proof in the vault tab; lands on welcome | E11, §5, §3.2 |
| D10 | A damaged (stored-invalid) vault gets **no delete path** in 2b; revisit in B1e | E11, §3.2, §9 |
| D11 | Delete while funded: **allowed**; #37 shows "This wallet holds funds" + the balance; the hold is still required | §5 (C13) |
| D12 | Passkey remove after a **password or passkey** proof; an honest note that the credential stays in the passkey manager | E12, §3.3, §4.4 |
| D13 | Passkey screen derived from #6: off = `[Add a passkey]`; on = "Passkey is on" + `[Replace passkey]` + `[Remove passkey]`; one slot; tip "Your password always works too." | §4.4, §3.3 |
| D14 | Reveal: proof → #3 pre-reveal modal → hold 2 s → 20 s auto-blur "Still looking?"; no copy/select/drag; words not in the DOM while hidden | §3.4 |
| D15 | Seed-verify is built: proof → #4's 3-slot check → a "phrase verified" fact on #35 | E15, §3.5 |
| D16 | Account remove allowed after a proof, with the balance and **"Its funds stay on Solana; add it again to use them"**; Add account can **re-add a removed index**; refused while a send from it is open | E13, §3.6, §4.3 |
| D17 | Reorder: a display order **outside the envelope**, no proof | E14, §4.3 |
| D18 | Address book: name (≤ 32, `cleanName`) + address, **max 200**, no notes, no import/export | E17 |
| D19 | A contact is **not** "known"; it only adds the "from your address book" label | E17, §6.3 |
| D20 | Contact UI: an `.s8-sheet` like #43 (address in groups of four, read-only when prefilled; name; Save; edit = same sheet; delete inside with a confirm). Contacts **kept on restore / import-over, wiped on delete** | E17, §6.2 |
| D21 | #15 standalone row tap → the edit sheet | §6.1 |
| D22 | #31's out-of-scope rows omitted and listed in Differs; the tip is a passkey suggestion, shown only while there is no passkey; **Profile → accounts manager** (meta = the selected account's name) | §4.1 |
| D23 | (owner, 2026-10-05, on review finding H1) **Reveal and verify accept the password only.** The passkey is accepted for the `accounts` mode (add / remove / re-add), the passkey actions (remove), delete's proof and sends (#10) — **never in a flow that renders or tests the recovery phrase** | E16, §1.2, §3.4, §3.5, §8.1 |

### Owner decisions on PR #107 (D24–D33, 2026-10-08)

| # | owner decision (substance) | status | applied here |
|---|---|---|---|
| D24 | Accounts manager row layout OK; **the address/balance line also selects the account** (the whole row) | built | §4.3 |
| D25 | verify-not-recorded (O32): a **neutral hero**, not the green success ring | built | §3.5 |
| D26 | #36 done (and the passkey done states): **the same ring hero as 04r** | built | §3.1, §3.3 |
| D27 | Destructive vault CTAs red: account remove and passkey remove use **the danger style like delete** | built | §3.3, §3.6 |
| D28 | 35b: Auto-lock in the "Encrypted backup" slot, Locks + Danger zone below — OK | accepted | §4.2 (35b's order, Task 20 fix round 1 M5, unchanged) |
| D29 | #37 send-open banner: **bold title + regular body** (no copy change) | built | §5 |
| D30 | A lost #10 reply → a false "Nothing was changed": accepted (rare; #35 shows the stored value) | accepted | §3.7, §4.2 |
| D31 | A screen reader's browse mode cannot hold on #37: accepted, documented — **revisit in B1e** | accepted | §5, §9 |
| D32 | #31 failed settings read: blank metas OK | accepted | §4.1 |
| D33 | Change-password and passkey pages: no C17-style address binding needed | accepted | §3.1, §3.3 |

### Owner decisions on the plan-2 review (D34–D37, 2026-10-08)

| # | owner decision (substance) | status | applied here |
|---|---|---|---|
| D34 | #31's Address book meta for one contact reads **"1 contact"** — confirmed as **O92** | built (plan 2) | §4.1, §12 |
| D35 | Plan 2's departures **approved**: the contact sheet is tall (the popup's height but 48 px) with **Cancel \| Save side by side**; the delete confirm shows the contact's **name and address**; #27's received **From row carries the full label** (own > treasury > contact); **Esc over an open sheet closes only the sheet** (on every pushed screen, the accounts manager's remove sheet included); the sheet opens on **`data-autofocus`** | built (plan 2) | §6.2, §6.3 Differs |
| D36 | **"Known" counts only sends confirmed by this extension.** #27a's sheet keeps O72, fail closed, with its wording unchanged, also under a SENT record from another wallet or from the history — the history never feeds `known` | built (plan 2) | E17, §6.2 |
| D37 | Names with **ZWJ, ZWNJ or VS16** (some emoji, Persian/Indic names) are **refused** by C19 with 2a's name line — accepted | accepted | C19, §6.2 |

**Deviation from the approved design (D23).** The approved design §1.7 reads "accounts and reveal modes also accept the
passkey (carry)". D23 narrows it: the carry lands in `accounts` only. Why (review H1): a passkey that could open
`?mode=reveal` would hand its holder the phrase — permanent, cross-device access that survives removing the passkey
(E12) or changing the password (E10) — which is exactly what D8 (step 1 password-only) and C4 (enrolment
password-only) keep from a passkey holder. `?mode=verify` would be the same leak in slow motion: #4's pool keeps the
correct word fixed while its distractors change each run, so repeated runs recover the phrase statistically. A passkey
can already drain the wallet through sends (B1 §2); D23 keeps it from gaining the phrase.

### Controller rulings (C1–C20) — each for the owner to confirm or overrule

| # | ruling | why |
|---|---|---|
| C1 | `settings.set` no longer accepts `challengeId`: a message carrying one is `malformed`. A weakening always answers `reauth-required`; the only path that applies it is `vault.reauthOk` (E9) | With D6 the background consumes the settings challenge at `vault.reauthOk`, so the re-call path (`walletApi.ts:196-198`) can never succeed again. Dead security code is removed, not left as a second door |
| C2 | Change password is a **new message** `vault.changePassword` with its own rule (`onlyPasswordChanged`, E10). `storeEnvelope`'s `sameWallet` (`accountsStore.ts:166-173`) is **unchanged** and still refuses any password or KDF change. The change requires an unlocked session | The code comment asks a password change to "revisit this rule … rather than route around it" (`accountsStore.ts:163-164`). A separate, narrower rule revisits it without widening the path every account change and passkey enrolment uses |
| C3 | Passkey removal is a **new message** `vault.removePasskey {expectedRevision}`: the page sends no envelope, the background drops the field itself. `storeEnvelope` is tightened: a stored passkey may be **replaced, never dropped**, through it | The narrowest form of "drop the passkey wrap". Today `sameWallet` ignores `passkey`, so any vault-page bug that omitted the field would silently disable the user's passkey |
| C4 | Add and replace are **one** vault operation (`passkey&op=add`); the page chooses the wording from the stored state. Password only (the existing `addPasskey`, `onboarding.ts:215-248`) | The envelope has one slot (`envelope.ts:31`); `addPasskeyWrap` overwrites it (`envelope.ts:279`). D8's reasoning applies: a passkey holder must not be able to enrol their own passkey |
| C5 | Removing an account while a send from it is open is refused **in the background**: `storeEnvelope` answers `send-open` when an index it drops has an open `v1_pending` record | The vault page cannot read `v1_pending` (background-owned, `check-vault-isolation.mjs:90`) and must never be the only guard |
| C6 | `addAccount` takes an **explicit index**: any index not in the envelope, `0 … 2^31 − 1` (SLIP-0010 hardened limit). The add form pre-fills the **lowest free** account number, editable | `addAccount` takes `max(index)+1` (`accountsFlow.ts:105`), so a removed account other than the last can never come back. Lowest-free makes "add it again" the default after a remove |
| C7 | The display order, `phraseVerifiedAt` and `passwordChangedAt` are **fields of `v1_settings`** (already background-owned). `settingsMutex` moves from `walletApi.ts:58` to `settings.ts` as `updateSettings`, and `writeSettings` writes every field | `writeSettings` rebuilds the object from three fields (`settings.ts:38-40`): any field it does not name is erased by the next `accounts.select`. The approved design's list of "new background keys" is read accordingly (§11 item 1) |
| C8 | "Write down your recovery phrase" and "Verify recovery phrase" are **both** outstanding while `phraseVerifiedAt` is null and both done once it is set. The **create** path records `phraseVerifiedAt` once the new wallet is stored and unlocked (it passed #4); import paths do not | The approved engine has one fact, "phrase verified". Nothing records "written down". A just-created wallet passed the same 3-word check as §3.5, so asking again would be false. A pasted phrase proves nothing about a written copy |
| C9 | The reveal flows into the check: reveal's `confirmed` `[Continue]` → the #4 check with the words already in memory (no second proof) | As onboarding (#3 → #4). One proof for both, and the check is where the fact comes from |
| C10 | `passwordChangedAt` is written **by the background** on a successful `vault.changePassword`. #31 shows 36e ("Password updated" toast, "Just updated" row) on its next open within 10 minutes, once per change (UI pref `noctura.ui.v1.passwordToastSeen` = the timestamp shown) | 36e is drawn on #31, which the vault tab cannot render. A hash handed from the tab could be forged by any extension page into a false "Password updated"; a background fact cannot |
| C11 | Every 2b vault mode **except `delete` and `passkey&op=add`** needs an unlocked session and proves with `openProven` (`reauth.ts:30-59`): a mismatch locks. `delete` uses E5's factor proof (works locked, no session comparison, 2a R2-L7). `op=add` uses `addPasskey` as #6 does (password unwrap, no session comparison) | Matches the approved "factor mismatch with the session locks" wherever a session exists, without changing E5 or `addPasskey` |
| C12 | Contacts: refused while locked; one contact per address (`contacts.set` adds or renames); the address is fixed once saved (delete and add again to change it); stored newest first; label precedence **own > treasury > contact**; #10 never shows a contact name | Reveals whom the user pays (as E6). The vault page renders no user-typed text but the phrase (2a §1.2) |
| C13 | #37's "This wallet holds funds" is the **popup's** reading (`wallet.balances` / `wallet.cached` per account). It informs and never gates; the background deletes without the C6 guard | D11: delete is allowed when funded |
| C14 | The remove-account page takes `&index=<digits>` and shows "Account N" plus the address from the stored envelope — **never the name** | Names are user text; the vault page shows only literals, the phrase, and closed-alphabet fields |
| C15 | #35 keeps the design's score card **without** the ring and the number: headline + body only | D3 drops the ring and number; the card's headline still says whether anything is left to do |
| C16 | #31's 2a row "Accounts · N accounts" becomes the design's "Profile" row (D22); the switcher stays reachable from #11's avatar | The design has one account row; 2a's was a stand-in (2a §6.1) |
| C17 | (rev 2, review M1) **`?mode=delete` names the wallet it deletes.** #37 and the delete page both show the stored wallet's **first account address in groups of four** (`.noc-caption` "This wallet's first account" above it). **"First account" is the account with the lowest `index`** on both sides — #37: `min` over `wallet.state.accounts[].index`; the page: `min` over the envelope's accounts — **never the display order** (E14) and never list position (rev 3, review M1). The page reads the envelope at load, shows that address, and keeps the revision it showed. **At the click, before any KDF run** (rev 3, review M2), it re-reads the envelope (`readLocal`), computes `envelopeRevision` and compares: a different revision (another wallet, or any change) → the `changed` notice, nothing proven, nothing sent, **never charged to the backoff**, the new address shown. Only on a match does `proveFactor` run. It re-reads the envelope and mints `proof.revision` from its own read, and (Task 9 fix round 1, review I1) the page compares **that** revision with the shown one again before the send. A mismatch is `changed` too: nothing is sent, nothing is charged, and the proof is dropped. On the passkey path the whole OS prompt lies in that window. Only a change after `proveFactor`'s read (during its KDF, or before the forget lands) is E5's `busy` | A stale tab must not delete a wallet the user never saw on #37. The address is closed-alphabet text (as C14); the revision check makes "the wallet on screen" the only one a proof can delete |
| C18 | (rev 2, review H3) **Dust floor** for #27c's "Save sender" warning: a received amount below **0.001 SOL**, **0.01 USDC / USDT** or **1 NOC** is "tiny". In base units, compared with `BigInt` on the history item's `amount` string (`history.ts:45`; cardinal rule 2): **< 1 000 000** lamports, **< 10 000** (USDC/USDT, 6 dp), **< 1 000 000 000** (NOC, 9 dp). A received row whose `amount` is `null` (undecodable) counts as dust — fail closed (rev 3, review L2) | Fable's suggested floors (SOL, stablecoins); 1 NOC added for the fourth token. The values only choose which warning shows; nothing is refused |
| C19 | (rev 2, review H3, L8) **Contact names:** two contacts may not share a name, compared after Unicode NFKC and case-folding (`contacts.set` → `duplicate-name`); `cleanName` additionally refuses every control and format character by Unicode category: `FORBIDDEN_IN_NAME = /[\p{Cc}\p{Cf}\u202A-\u202E\u2066-\u2069]/u` (rev 3, review L5 — the `u` flag; this covers U+00AD, U+200B–U+200F, U+2060–U+2064, U+FEFF and also U+061C, U+180E and the tag characters, which a hand list missed; U+034F and the variation selectors U+FE00–U+FE0F are category Mn and are refused by an explicit addition `\u034F\uFE00-\uFE0F`) — for account names too. **Limit, stated loudly (rev 3, review L4): the duplicate check does not catch cross-script confusables** — NFKC keeps Cyrillic "В" apart from Latin "B", so "Вinance" and "Binance" are two names. Names are typed by the user, so an attacker never writes one; the defence against a look-alike *address* is the full address in pick rows (§6.1), not the name check | A look-alike "Binance" next to the real one in `pick` is the poisoning picture; "Mo\u200Bm" and "Mom" render the same. A stored account name that predates the rule is kept (`reencrypt.ts:37` keeps an unchanged stored name; `storeEnvelope` carries stored names) |
| C20 | (rev 3, review H1; coordinator ruling) **#36's held data key and fields live at most 5 minutes**, counted from the step-1 proof and **renewed by each keystroke in steps 2–3**. They survive `visibilitychange → hidden` (rev 2's ruling on review-1 M2, kept), but at the deadline they are zeroed and emptied and the page shows `dropped`. The deadline is re-checked on `visibilitychange → visible` and before every step change and every send (step 2's `[Continue]`, step 3's `[Change password]`) — a stale tab never offers a button that would act on an expired proof | Without a bound, a proven #36 tab left hidden while the popup keeps the session alive lets anyone at the keyboard set a password of their own without knowing the old one, then read the phrase (password-only by D23). Five minutes is enough to fetch a password from a manager and short enough that the proof still means "the person here knows the password" |

---

## 1. Architecture (what 2b adds to 2a §1)

### 1.1 Where each screen lives

| screen | surface | entry |
|---|---|---|
| #31 settings (full) | popup, Settings tab root (2a §6.1) | tab bar |
| #35 security center | popup, pushed | #31 "Security center" |
| accounts manager | popup, pushed (derived from the 2a switcher) | #31 "Profile" |
| passkey screen (#6 "manage") | popup, pushed | #31 "Passkey", #35 "Add a passkey" / "Passkey" |
| #37 delete wallet | popup, pushed | #31 "Delete wallet", #35 `[Delete wallet]` |
| #36 change password | vault tab `?mode=password` | #31 / #35 "Change password" |
| #37's proof | vault tab `?mode=delete` | #37 after the hold |
| passkey add / replace / remove | vault tab `?mode=passkey&op=add\|remove` | passkey screen |
| reveal → verify | vault tab `?mode=reveal` | #31 "Recovery phrase", #35 "Write down your recovery phrase" |
| verify | vault tab `?mode=verify` | #35 "Verify recovery phrase" |
| add / remove account | vault tab `?mode=accounts&op=add` / `&op=remove&index=N` | accounts manager |
| #10 settings kind | vault tab `?mode=reauth&challenge=` (2a) | #35 pickers, on a weakening |
| #15 address book (plan 2) | popup, pushed | #31 "Address book"; #12's contact icon (pick mode) |
| contact sheet (plan 2) | popup, `.s8-sheet` over #15, #20, #27 | #15 `+`, row tap, search's add; #20 "Add"; #27 `[Save]` / `[Save sender]` |

The vault tab renders in 2a's 412 px column. Every vault-page string the scripts set is a literal in
`src/unlock/strings.ts`; static copy that never changes may stand in `unlock.html`'s markup, as 2a's does (final docs
pass, ruling F12). Every popup string lives in the screen's own `*_TEXT` table, as in 2a.

### 1.2 Vault-page modes (`src/unlock/mode.ts`, extended; closed enums)

| `?mode=` | params | session | factor | notes |
|---|---|---|---|---|
| `password` | — | required (`not-unlocked` otherwise) | password only (D8) | #36, E10 |
| `delete` | — | not required | password or passkey | E5 factor proof, E11; bound to the wallet shown (C17) |
| `passkey` | `op=add\|remove` (unknown → `add`) | `add`: not required; `remove`: required | `add`: password (C4); `remove`: password or passkey | E12 |
| `reveal` | — | required | **password only (D23)** | §3.4; a passkey factor is refused (E16) |
| `verify` | — | required | **password only (D23)** | §3.5; a passkey factor is refused (E16) |
| `accounts` | `op=add\|remove` (unknown → `add`); `index=^\d{1,10}$` with `op=remove` — the envelope's own (0-based) `index` field; every string shows `index + 1` (L2) | required | password or passkey | §3.6; E16 adds the passkey |
| `reauth&challenge=` | as 2a | as 2a | as 2a | settings kind gains E9's states |

`PageMode` gains `{mode:'password'} | {mode:'delete'} | {mode:'passkey'; op:'add'|'remove'} | {mode:'verify'} |
{mode:'accounts'; op:'add'} | {mode:'accounts'; op:'remove'; index:number}`. An `index` that does not parse, or is above
2^31 − 1, makes the remove page show "There is no account with that number." (ACCOUNTS (2a)) with no action button. **No
parameter starts anything:** every mode shows a proof step first, and `index` only names the account the proof screen
describes (2a §1.2's rule holds).

### 1.3 Pages the popup opens (`src/app/platform.ts`)

`ExtensionPage` (closed list) gains `'unlock.html?mode=password'`, `'unlock.html?mode=delete'`,
`'unlock.html?mode=passkey&op=add'`, `'unlock.html?mode=passkey&op=remove'`, `'unlock.html?mode=reveal'`,
`'unlock.html?mode=verify'`, `'unlock.html?mode=accounts&op=add'`. The remove page is built from data, so it is branded
like `reauthPage` (`platform.ts:22-32`): `removeAccountPage(index: number): RemoveAccountPage | null`, null unless `index`
is a safe integer in `0 … 2^31 − 1`. The 2a entry `'unlock.html?mode=accounts'` is replaced by `…&op=add`.

### 1.4 Popup routes (`src/app/router.ts`)

`Route` gains `{screen:'security'}`, `{screen:'accounts'}`, `{screen:'passkey'}`, `{screen:'delete'}` (plan 1) and
`{screen:'contacts'; pick: boolean}` (plan 2), each with exactly these keys (the reducer's `only()` rule). `SCREENS` gains
the five names. No route carries a secret, a challenge, or an address to act on. The contact sheet is component state,
not a route.

**Pick hand-back (rev 2, review M4).** From #12 the stack is `[tab, {screen:'send', draft, notice}, {screen:'contacts',
pick:true}]`. A pick dispatches `reset([tab, {screen:'send', draft: {...draft, recipient: address}, notice: null}])` — the
`send` route's own `draft` carries the address (it already carries what the user typed, 2a §1.6), so no route gains a new
key and `isDraft` (`send/rules.ts`) validates it as for any draft; the base58 string passes unchanged. #12 then treats a
picked recipient **exactly as a paste**: the same validation, the same `wallet.recipientInfo` call, the same states (3 or
6). Back without a pick is a plain `pop` (the draft untouched). A test asserts the picked address reaches #12's field and
`recipientInfo` is called with it, and a mutation that pops without the reset turns it red.

### 1.5 Message partition and gates

| new message | partition | plan |
|---|---|---|
| `vault.changePassword` | `VAULT_PAGE_ONLY` (`messages.ts:36`) | 1 |
| `vault.removePasskey` | `VAULT_PAGE_ONLY` | 1 |
| `vault.phraseVerified` | `VAULT_PAGE_ONLY` | 1 |
| `accounts.order` | privileged (`WALLET_TYPES`) | 1 |
| `contacts.list`, `contacts.set`, `contacts.remove` | privileged (`WALLET_TYPES`) | 2 |

Changed replies: `wallet.state` (+`passkey`, display order, E12/E14), `settings.get` (+three fields, C7),
`vault.reauthOk` (settings kind, E9), `wallet.recipientInfo` (+`contact` label, E17), `vault.storeEnvelope` (+`send-open`,
C5; passkey drop refused, C3), `settings.set` (C1).

Each new `VAULT_PAGE_ONLY` message gets the partition test 2a §8.1 uses (refused from `/popup.html`, `/wallet.html` and
a web origin; accepted from `/unlock.html`). `BACKGROUND_OWNED_KEYS` (`scripts/check-vault-isolation.mjs:90`) gains
`v1_contacts` (plan 2), with a fixture: a popup file naming it → violation. The CSP, the vault import allowlist, the
stand-alone `strings.ts` rule, the style rules and the module map (2a §1.2) apply unchanged to every new mode.

### 1.6 CSS

`src/styles/design-ext.css` gains, copied from `index.html`'s `<style>` under the same names: `.s7-picker` (ix:3506-3508),
`.s7-tip` (ix:3511-3513), `.s7-score-card` (ix:3564), `.s7-task` (ix:3574-3577), `.s7-stepper` (ix:3580-3584),
`.s7-longpress` (ix:3587-3588), `.s7-toast` (ix:3592), `.s7-row.danger` (ix:3496) and, in plan 2, `.s-abook` (ix:1412-1490).
`.s7-ring` is **not** copied (C15). A ring-less card needs one local modifier, `.s7-score-card.no-ring {grid-template-columns:
1fr}` (declared as a difference). `scripts/check-classes.mjs` keeps failing any class without a rule.

---

## 2. Engine extensions (E9–E17)

All in `src/background/`, `src/unlock/`, `src/vault/`, with vitest beside the 2a tests (fake `Ext`, fake `WalletDeps`). Every
check comes with a **named mutation** that must turn a test red (§8.1). E9–E16 are plan 1; E17 is plan 2.

### E9 — settings applied on `vault.reauthOk` (D6, C1)

- **Store change (`reauthChallenges.ts`).** The settings challenge already stores the exact patch: `about = {kind:
  'settings', autoLockMinutes: number | null, reauthUsdCents: number | null}` is written by `issueChallenge` from the
  values `parsePatch` accepted (`walletApi.ts:195-201`). Nothing new is stored. New export
  `takeSettingsChallenge(ext, now, id): Promise<{autoLockMinutes, reauthUsdCents} | 'unknown-challenge' | 'locked'>`: under
  `sessionMutex`, `live(load())`; no record, or a record whose `about.kind !== 'settings'` → `'unknown-challenge'`;
  `getSession()` null → `'locked'`; otherwise the record is **deleted** and saved, and its patch returned. Single use.
- **Message (`messages.ts`, `vault.reauthOk`).** Unchanged request `{type:'vault.reauthOk', challengeId}`, vault page only.
  After the existing `locked` check, the handler peeks `challengeInfo(ext, now, id)`:
  - `kind:'send'` or `null` → today's path (`satisfyChallenge`, `{ok:true}` / `unknown-challenge`);
  - `kind:'settings'` → `applySettingsChallenge`: inside `updateSettings` (C7; `settingsMutex` is taken **before**
    `sessionMutex`, the existing order, `walletApi.ts:52-58`): `takeSettingsChallenge` → the patch with its nulls removed
    is passed through `parsePatch` again (`isAbout` checks only `isIntOrNull`, `reauthChallenges.ts:72`, so the range
    is re-checked here) → `writeSettings({...current, ...patch})`. Then, outside the mutex, `armAutolock` when the patch
    has `autoLockMinutes` and a session exists (as `walletApi.ts:217`).
  - **Reply:** `{ok:true, data:{applied:'settings'}}`. **Refusals:** `malformed` (id not a string; or the stored patch
    fails `parsePatch` — the challenge is already burned, nothing is written), `locked`, `unknown-challenge` (absent,
    expired, or already applied), `failed` (a storage error; nothing written if it came before the write).
- **`settings.set` (C1).** `msg.challengeId !== undefined` → `malformed`. A weakening while unlocked always issues a
  challenge and answers `reauth-required {challengeId}`; while locked `locked` (as today). Strengthening still writes at
  once, also while locked (`walletApi.ts:191-215`, unchanged; it lowers nothing).
- **Vault page (`reauthFlow.ts`).** `ReauthPageOutcome` gains `'applied'` (`r.ok && r.data.applied === 'settings'`). #10
  shows it (§3.7). A `{ok:true}` **without** `data` (a send description) stays `confirmed`, as today; the existing send test
  keeps asserting it (review §8 (b)).
- **Several live settings challenges: the last confirmed proof wins (rev 2, review M6).** Each settings challenge carries
  its own patch, and each #10 tab describes its own. A later `settings.set` — a strengthening applied at once, or another
  weakening that issues its own challenge — neither re-bases nor revokes an earlier live settings challenge. Whichever
  challenge is **confirmed last** applies its patch over whatever is stored at that moment. Example: pick 60 min (challenge
  A, tab A left open) → reopen the popup and pick 1 min (applied at once) → confirm tab A → auto-lock is 60, which is what
  tab A said ("Auto-lock → 60 minutes"). The popup reads `settings.get` on every open, so #35 always shows the stored value;
  it never claims a pending choice. Test: issue A (weaken), apply B (strengthen), confirm A → `settings.get` shows A's
  value; and the reverse order (confirm A, then strengthen B) → B's value.
- **Security argument.** The patch the background applies is the one it bound at issue, from the values it parsed itself;
  `vault.reauthOk` carries only the id, so no page can change what is applied. The vault page shows that same `about`
  through E3's closed-alphabet renderer before the proof, and applies nothing it cannot describe. The proof is #10's
  (`openProven` against the session, mismatch locks). Applied exactly once: the record is deleted inside the same
  `sessionMutex` section that reads it, so a second `vault.reauthOk` (or a replayed one) finds nothing. Expiry stays
  120 s (`CHALLENGE_TTL_MS`); a settings challenge is never re-based (`rebaseChallenge` refuses a non-send kind,
  `reauthChallenges.ts:144`). A lock clears `v1_reauth`, so nothing is applied after a lock that came first.
- **What is refused, and why.** A send challenge never applies settings (kind check). An expired or reused id →
  `unknown-challenge` → #10 `settings-expired` ("Took too long — try again"). A settings challenge confirmed while the
  wallet locked meanwhile → `locked` → #10 `settings-not-unlocked`. `settings.set` with an id (C1) → `malformed`.

### E10 — change password: `vault.changePassword` (D8, C2)

- **Vault module (`src/vault/envelope.ts`).** New export `rewrapPassword(env, dataKey, password, kdf):
  Promise<{salt: string; wrapped: string}>`: `checkEnvelope(env)`; a fresh 16-byte salt; `kdf(password, salt, {m, t, p}
  of env)` — **the stored cost**, never a new one; `wrap(dataKey, kek)`; then the self-check: `unwrap(wrapped, kek)` must
  equal `dataKey` byte for byte **and** `decryptMnemonic(env, dataKey)` must succeed (as `addPasskeyWrap` proves the key
  first, `envelope.ts:266-275`). Every KEK and copy zeroed in `finally`. Throws on any mismatch.
- **Page flow (`src/unlock/passwordFlow.ts`, new).** `proveCurrent(deps, password)`: `storedVault` → `sessionKeys` (null →
  `not-unlocked`) → `openProven(env, {password, kdf}, session)` (`mismatch` → `lockOnMismatch`; `wrong`, `damaged`,
  `failed`) → on `ok` returns a minted, frozen `{env, revision, dataKey}` held by the screen until step 3 or until it is
  dropped (§3.1 memory rule). `openProven` always returns the phrase too (`reauth.ts:53`): `proveCurrent` **drops
  `proven.mnemonic` at once** (the reference is neither kept nor returned; a JS string cannot be zeroed, so dropping the
  reference is the most it can do — stated in the review list). `isCurrentPassword(env, candidate, kdf)` (rev 2, review
  H2): one Argon2id over the **candidate** with the **stored** salt and cost, then `unwrap(env.password.wrapped, kek)`:
  success → `true` (the candidate is the current password), AES-KW refusal → `false`; the KEK and any unwrapped key are
  zeroed in `finally`. **No secret is retained** for it: the old password is never kept to compare strings. `changePassword(deps, held, newPassword)`: `newPassword.length ≥ 12` (`MIN_PASSWORD_LENGTH`)
  → `rewrapPassword` → `next = {...env, kdf:{...env.kdf, salt}, password:{wrapped}}` → `send({type:'vault.changePassword',
  expectedRevision: held.revision, envelope: next})`. The data key is zeroed on every path.
- **Background (`accountsStore.ts`, new export `changePassword(ext, expectedRevision, envelope)`).** Request
  `{type:'vault.changePassword', expectedRevision: string, envelope: EnvelopeV1}`, vault page only. Inside `serial`:
  1. shape: `REVISION` test and `envelopeShape(envelope)`, else `malformed`;
  2. `getSession(ext)` null → `locked` (C2, C11);
  3. stored absent → `no-wallet`; `envelopeShape(stored)` null → `stored-invalid`; revision differs → `busy`;
  4. `onlyPasswordChanged(current, next)` false → `malformed`. It holds exactly when: `v`, `scheme`, `kdf.alg/m/t/p` equal;
     `kdf.salt` **differs**; `password.wrapped` **differs**; `seed.iv` and `seed.ct` equal; `passkey` both absent or all
     three fields equal; same number of accounts, and at each position the same `index` and `publicKey` (order included);
  5. write `{...next, accounts}` with every stored name carried over (names are outside the revision);
  6. after the write (best effort, never un-doing it): `updateSettings(s => ({...s, passwordChangedAt: deps.now()}))`.
  **Reply** `{ok:true}`. **Refusals** `malformed | locked | no-wallet | stored-invalid | busy | failed`.
- **Security argument.** The AAD does not cover the salt or the wraps (`envelope.ts:83-87`), so a new salt and a new
  password wrap of the **same data key** leave the seed ciphertext valid and the passkey wrap valid (it wraps the same
  key). The background cannot check a password, so the proof runs in the vault page (2a E5's trust boundary); what the
  background can check, it does: the rule admits a write that changes exactly the two fields a password change must
  change and nothing else, so a buggy or hostile page path cannot use this message to swap the seed, the accounts, the
  passkey or the cost. The old password proves knowledge of the factor being replaced (D8: a passkey would let its holder
  take over the password). The page refuses to send a wrap it has not opened itself (`rewrapPassword`'s self-check), so a
  bad wrap cannot brick password unlock. The revision makes a concurrent change `busy`. `storeEnvelope` still refuses any
  password change (C2), so this message is **the only door for a password change that keeps the seed ciphertext, the
  passkey and the cost**. It is not the only door that changes the password: `vault.forgetWallet` with a `replacement`
  (#39's restore, 2a E5) is the other — it replaces the whole envelope (any salt, any wrap, **no passkey**) under a seed
  proof, which the background binds only to the same `{index, publicKey}` set (`accountsStore.ts:251-256, 339`) and cannot
  check itself (rev 2, review M5). **A restore therefore drops the passkey**; #39 already says so ("A passkey is not
  carried over; you can add one again later.", FORGOT step 3 (2a)), and after a restore #31 and #35 show "Passkey · Off"
  and the "Add a passkey" task — declared in §4.1 and §4.2.
- **Refusals and why.** `malformed`: anything beyond salt + wrap changed, the same salt reused, an unchanged wrap, a
  dropped or changed passkey, a reordered or re-keyed account list, another cost. `locked`: the page proved against a
  session that is gone. `busy`: the envelope moved since the proof → the page goes back to step 1 (a fresh proof, never a
  carried one). `stored-invalid`: a damaged vault cannot be changed (D10's spirit).

### E11 — `deleteWallet` (D9, D10, D11)

- **Page (`src/unlock/forgetFlow.ts`).** New export `deleteWallet(send, proof: FactorProof): Promise<'deleted' |
  'send-open' | 'busy' | 'unlocked' | 'no-wallet' | 'damaged' | 'failed'>`: `minted.has(proof) && proof.kind === 'factor'`
  else `failed`; then the module's private `forget(send, {type:'vault.forgetWallet', expectedRevision: proof.revision})` —
  **no `replacement`, no `guard`**. `funded`, `unreachable` and `coordinator-refused` cannot occur without the guard and
  map to `failed`. The proof is `proveFactor` (`forgetFlow.ts:89-111`), unchanged: password or passkey unwraps the stored
  data key, no session comparison, works locked, data key and PRF output zeroed.
- **The boundary moves, on purpose.** The module comment (`forgetFlow.ts:15-23`) says a factor-proven delete without the
  guard is #37's; it becomes this export. The source test keeps every other `src/unlock` file away from
  `vault.forgetWallet`, and a new source test allows `deleteWallet` to be imported **only** by `screens/delete.ts`. The
  harness tripwire (`__tests__/pageHarness.ts:70-74`, "forgetWallet without replacement or guard") stays for every
  harness except the `delete` mode's, which asserts instead that its one forget carries neither field.
- **Background.** E5 unchanged (`accountsStore.ts:319-388`): one `serial` section; lock; `send-open` if a send is open
  (the wallet is left locked); `busy` / `unlocked` re-checks; vault removed; then `v1_known_recipients`, `v1_settings`
  (with C7's new fields), the two caches, and in plan 2 `v1_contacts` (E17). `v1_forbidden_until` kept.
- **Security argument.** The factor proof is what makes the delete the wallet owner's act; the typed DELETE and the hold
  (§5) are friction against a slip, not a security gate, and the page says so by asking for the proof itself. Without the
  guard, a funded wallet can be deleted (D11): the seed still controls the funds, and #37 shows them first (C13).
- **Refusals and why.** `damaged`: `proveFactor` cannot open a stored-invalid vault and E5 refuses it
  (`accountsStore.ts:336-337`); D10 keeps it that way — a proof-less delete would be a new attack surface; the welcome
  page's reinstall advice stays (2a §3.1). `send-open`: deleting would drop the only record watching a send that can
  still land (2a E5's reasoning). `busy` / `unlocked`: 2a E5.

### E12 — passkey state and removal (D12, D13, C3, C4)

- **`wallet.state` gains `passkey: boolean`** — whether the stored envelope has a `passkey` object (`readWalletView`'s
  `WalletView` gains it, `accountsStore.ts:29-54`). `false` without a wallet. Answered while locked: the field sits in
  `storage.local` like the account list. The UI client's `walletStateOf` requires it to be a boolean.
- **`vault.removePasskey {expectedRevision}`** (vault page only). Inside `serial`: `REVISION` test (`malformed`) →
  `getSession` null → `locked` → stored absent `no-wallet` / shape `stored-invalid` / revision `busy` → no `passkey` →
  `no-passkey` → write the envelope **without** `passkey`, every other field and every name as stored. **Reply**
  `{ok:true}`. **Refusals** `malformed | locked | no-wallet | stored-invalid | busy | no-passkey | failed`.
- **`storeEnvelope` tightened (C3).** Non-first write: `current.passkey !== undefined && next.passkey === undefined` →
  `malformed`. Replacing (`addPasskey`) and carrying (`reencryptForAccounts`, `reencrypt.ts:64`) are unaffected.
- **Page (`src/unlock/passkeyFlow.ts`, new).** `removePasskey(deps, factor)`: `storedVault` → `sessionKeys` (null →
  `not-unlocked`) → `openProven` (mismatch locks) → data key zeroed → `send({type:'vault.removePasskey', expectedRevision:
  envelopeRevision(env)})`. `busy` → the whole flow once more with a fresh read and proof (as `withProvenSeed`,
  `accountsFlow.ts:86-98`); a second `busy` → the outcome **`busy`** (rev 2, review L1: §3.3 shows RESTORE `busy` + `[Start
  again]`, the honest line — the wallet changed). Add / replace: the existing `addPasskey` unchanged (C4).
- **Security argument.** Removal only takes a factor away, so either factor may prove it (D12). The page sends no
  envelope, so removal cannot carry any other change. The passkey is outside the AAD (`envelope.ts:83-87`): no
  re-encryption. The authenticator keeps the credential (the extension cannot delete it); the page says so (§3.3).
- **Refusals and why.** `no-passkey`: nothing to remove; nothing written. `locked`: the proof was against a session that
  is gone. `busy`: a concurrent change (e.g. an account added) — re-prove on the fresh envelope. `stored-invalid`:
  damaged vault.

### E13 — accounts: re-add at a chosen index; remove refused while a send is open (D16, C5, C6)

- **Page (`accountsFlow.ts`).** `addAccount(deps, factor, index)` — `index` required: not a safe integer in `0 … 2^31 −
  1` → `bad-index`; already in the envelope → `index-taken`; `cli` → `cli-single`; `≥ MAX_ACCOUNTS` → `too-many-accounts`;
  else the new list is the stored list plus `{index, name: 'Account ' + (index + 1)}`, **appended** (the envelope order;
  the display order is E14's). `reencryptForAccounts` derives the key for that index from the seed (`reencrypt.ts:28-69`),
  so re-adding index N always yields the address index N had. `removeAccount` gains the outcome `send-open`.
  `AccountsOutcome` gains `bad-index | index-taken | send-open`.
- **Background (`storeEnvelope`, C5).** For a non-first write, after `sameWallet`: let `dropped` = the public keys of
  indexes in `current` but not in `next`. If any `readPending(ext)` record `isOpen` with `account ∈ dropped` →
  `send-open`, nothing written. `StoreResult` gains `send-open`.
- **Security argument.** A removed account's key leaves the session (the page's `vault.setKeys` with the re-derived keys,
  or the lock that follows a failure, `accountsFlow.ts:55-66`), so an open send from it would be watched by a poller
  with no keys and could not be re-sent; refusing keeps the in-flight block meaningful. The check reads `v1_pending`
  under its own store (not under `pendingStore`'s mutex): a send that passes its session check in the instant between this
  read and the page's `setKeys` creates a record that is kept and watched without keys — the same harmless window 2a E5
  accepts and states. The index range is the derivation path's hardened limit (`m/44'/501'/{account}'/0'`).
- **A removed account's name is not kept (rev 2, review L3, declared).** Names live in the envelope only; a re-add of
  index N brings back N's **address** and funds (D16) with the default name "Account N+1" — rename it again. Keeping the
  names of removed indexes would put user text in `v1_settings` for accounts that no longer exist; not built. Declared in
  §3.6 and §4.3.
- **Refusals and why.** `send-open` (D16); `index-taken` (re-adding a present account would duplicate an index, which
  `accountsPolicyOk` refuses anyway); `bad-index`; `last-account`, `no-such-account`, `cli-single`, `too-many-accounts`
  (2a, unchanged).

### E14 — display order in `v1_settings` (D17, C7)

- **Store.** `Settings` gains `accountOrder: number[] | null`. `readSettings`: an array of unique safe non-negative
  integers, at most `MAX_ACCOUNTS` long → itself; anything else → `null` (no order; never "repaired"). `writeSettings`
  writes all fields (C7).
- **`accounts.order {order: number[]}`** (privileged). `order` must be a permutation of the stored envelope's index set:
  not an array of safe non-negative integers, or with duplicates → `malformed`; a different set (an account added or
  removed since the manager read it) → `stale`; no wallet → `no-wallet`. Written under `updateSettings`. **Reply**
  `{ok:true}`. Allowed whether locked or not (like `accounts.select`).
- **Read.** `wallet.state.accounts` is returned **in display order**: the indexes of `accountOrder` that exist in the
  envelope, in that order, then any envelope account not in it, in envelope order. The `selected` fallback
  (`walletApi.ts:107-108`) takes the first account of that order. `vault.status` and every key list stay in envelope
  order (the vault page and the session never see the display order).
- **Security argument.** The order never touches the envelope, its AAD or the session; every send, rename and select names
  an account by index or public key, never by position. So a wrong order can mislead only a user who picks by position, and
  every row shows its name and address. No proof (D17); a proof here would cost an Argon2id run per move.
- **Refusals and why.** `malformed`, `stale` (never write an order for a list the user did not see), `no-wallet`.
  **Concurrency (rev 2, review L9):** two popups moving rows at once are last-writer-wins; `stale` covers only a changed
  account set, so one move can be lost. Accepted for a display order (no security meaning); stated, and the manager
  re-reads `wallet.state` after every write.

### E15 — `phraseVerifiedAt` (D15, C7, C8)

- **Store.** `Settings` gains `phraseVerifiedAt: number | null` (a safe integer ≥ 0, else `null`).
- **`vault.phraseVerified {expectedRevision}`** (vault page only). Not a revision → `malformed`; `getSession` null →
  `locked`; v1_vault absent → `no-wallet`, not an envelope → `stored-invalid`; another revision stored → `busy`; else
  write `phraseVerifiedAt: deps.now()` — the checks and the write in one `settingsMutex` → `sessionMutex` section.
  **Reply** `{ok:true}`. **Refusals** `malformed`, `locked`, `no-wallet`, `stored-invalid`, `busy`, `failed`.
- **Bound to the wallet checked (final review m7, a controller ruling).** The sender sends the revision of the envelope
  the phrase was opened from (§3.5's proof; the create run's own stored envelope). A verify tab left in #4 while another
  tab deleted the wallet, created another and unlocked it gets `busy`, and the page shows O32 — no fact lands on a wallet
  whose phrase was never checked. The same wallet changed since the proof (an account added) is `busy` too: a true fact
  refused, never a false one recorded.
- **Senders.** §3.4 / §3.5's check on success; and the create run (C8) once the wallet is stored and `vault.setKeys`
  answered ok (`createRun.ts`, after #5; a refusal there is ignored — the fact is cosmetic).
- **Kept and cleared.** Kept by a change password, a passkey change, an account change and a restore (E5 keeps
  `v1_settings`); cleared by a delete and by a first write (E5 step 7, `accountsStore.ts:221-226`).
- **Security argument.** It is **a fact, not a security guarantee** (approved design §1.6): the background cannot check
  it, and any vault-page code could send it. It gates nothing; it only decides two #35 task rows and one protections row.
  Vault-page-only keeps the popup and web pages from setting it.
- **Refusals.** `locked` (the proof that preceded it was against a session; a locked wallet has no proven page).
- **Migration (rev 2, review L4).** Wallets created before 2b have no `phraseVerifiedAt`, although they passed #4: they
  show both phrase tasks until the user runs §3.5 once. Accepted (no fact to migrate from); declared in §9.

### E16 — the passkey factor: in `accounts`, never where the phrase is shown or tested (carry, narrowed by D23)

**Where the passkey is accepted:** the `accounts` mode (add, remove, re-add), the passkey actions (`passkey&op=remove`),
delete's proof (E5's `proveFactor`, already) and sends (#10, already). **Where it is not (D23):** `reveal` and `verify`,
and any future flow that renders or tests the recovery phrase.

- **Accepted.** The factor type already takes a PRF output (`ReauthFactor`, `reauth.ts:20`; `withProvenSeed` zeroes it).
  The `accounts` mode gains `[Confirm with passkey]` (2a's #10 label) when `passkeyOf(raw)` is set (`stored.ts:40-43`):
  `evaluatePrf` (`passkey.ts:42`) → the factor → the same flow. A PRF evaluation that returns null → "This device cannot
  confirm with a passkey; your password still works." (COMMON (2a)). Passkeys run only in the tab (B1 §2).
- **Refused, at the function boundary, not only in the UI.** `runReveal` (`revealFlow.ts:16`) and the verify flow take
  `{password: string; kdf: Kdf}` — the password member of `ReauthFactor` only — and a run-time guard refuses any argument
  carrying `prfOutput` with the outcome `failed`, zeroing the PRF output, before any envelope is read (a type alone does not
  stop a caller that casts). Neither screen renders a passkey button, even when the envelope has one.
- **Why (D23):** a passkey that opens the phrase gives its holder permanent access that survives removing the passkey and
  changing the password; `verify` would leak it statistically through #4's pool (review H1). D8 and C4 keep a passkey holder
  from taking over the password or enrolling a passkey; D23 keeps them from the phrase.
- No background change: the phrase never reaches the background.

### E17 — the address book: `v1_contacts` and `contacts.*` (plan 2; D18–D20, C12)

- **Store (`src/background/contacts.ts`, new).** `CONTACTS_KEY = 'v1_contacts'`, `MAX_CONTACTS = 200`. Value: an array of
  `{address, name}`, newest first. A read keeps only entries with `isAddress(address)` (base58, 32 bytes, as
  `prepare.ts`) and `cleanName(name) !== null`, drops later duplicates of an address, and keeps at most 200. One mutex for
  every read-modify-write. Background-owned (`BACKGROUND_OWNED_KEYS`).
- **Messages** (privileged; **every one refused while locked** → `locked`, C12):
  - `contacts.list {}` → `{ok:true, data:{contacts: {address, name, lastSentAt: number | null, known: boolean}[], max:
    200}}`. `lastSentAt` from `lastSentAt(ext, address)` (`knownRecipients.ts:45-49`): #15's "last sent" column for free.
    `known` (rev 2, review H3) is `isKnownRecipient(ext, session, address)` — the same function prepare uses — so the
    pick rows and the sheet can say "You have never sent to this address." truthfully. The UI client's shape check
    (`engine.ts`) requires a boolean and reads a **missing** `known` as `false` — the warning shows — never as `true`
    (rev 3, review L3). It is `true` for the wallet's own accounts, whose "own" label wins anyway.
  - `contacts.set {address, name}` → `{ok:true, data:{created: boolean}}`. An existing address is renamed in place (its
    position kept); a new one is put first. Refusals: `malformed` (address or name), `duplicate-name` (rev 2, C19: another
    address already has this name, compared after NFKC and case-folding), `full` (a new address with 200 stored),
    `locked`, `failed`.
  - `contacts.remove {address}` → `{ok:true}` (also when absent). Refusals: `malformed`, `locked`.
- **E6 label.** `wallet.recipientInfo`'s `label` gains `{kind:'contact', name}` with precedence **own > treasury >
  contact** (`walletApi.ts:181`). **`known` is untouched**: it still comes only from `isKnownRecipient`
  (`knownRecipients.ts:56-58`), so the `first-send` reason and #12's prediction ignore contacts (D19).
- **Lifecycle.** E5 step 7 removes `v1_contacts` on a delete (not on a replacement — D20 keeps them on restore); a first
  write removes it with the other leftovers (`accountsStore.ts:221-226`).
- **Security argument.** A contact is a label, never trust: if saving made an address "known", #27c's "Save sender" on a
  dust transfer from a look-alike address would disarm the first-send re-authentication — the address-poisoning case it
  exists for (context §2.8). **That alone does not close poisoning (rev 2, review H3):** a user who saves a dusting
  look-alike as "Binance" and later picks it has made the trust decision themselves, and the first-send re-auth will not
  make them stop. So the address book also: says "You have never sent to this address." on the sheet and on every pick row
  whose contact is not `known`, and "…— it only sent to you." when saving from a received transfer (§6.2, §6.1); warns
  harder when that transfer is dust (C18, §6.3); refuses a second contact with the same name (C19); and shows the **full
  address in groups of four** in pick rows (§6.1), since poisoning works on truncation. Names are user text: `cleanName`
  refuses controls, bidi overrides and (C19, review L8) every Unicode control and format character
  (`envelopeRules.ts:38-46`, extended with `\p{Cc}\p{Cf}` under the `u` flag; names are not otherwise normalised, and
  the duplicate-name check does not catch cross-script confusables — C19's stated limit), the popup renders them through React (escaped), the label always carries the prefix "From
  your address book:" (§6.3) so a name cannot pose as "Your account: …", and the vault page never shows one (#10 renders
  only closed-alphabet fields, 2a E3). Refused while locked because the list says whom the user pays (as E6). No import
  or export, so no new file format (D18).
- **Refusals and why.** `locked`; `malformed` (an address that is not 32 base58 bytes; a name `cleanName` refuses);
  `duplicate-name` (C19: two entries that read the same in `pick` are the look-alike picture); `full` (D18's cap bounds
  storage and the list).

### What the engine does **not** gain

No "Never" auto-lock (D1); no app-lock timer (D2); no security score (D3); no backup age (2a-D17); no record of "written
down" (C8); no proof-less delete (D10); no contact notes, import or export (D18); no "contact is known" (D19); no
`passwordChangedAt` on the vault page (it is the popup's, C10).

---

## 3. Vault-page modes (tab)

Every mode: 2a's `exclusive()` gate with the 500 ms floor on every button (rule 6), the phase guard, the `alive` /
generation check after every `await` (2a's `gen` counter, `screens/reveal.ts`), the field taken out at the click and
handed over in the same turn, `pagehide` and `visibilitychange → hidden` empty every field — **except #36**, which keeps
its fields and held key through `hidden` (§3.1, the M2 ruling). Factors per mode: §1.2 (reveal and verify: password only,
D23). A wrong factor gets 2a's
backoff (`createWrongBackoff`, ≤ 30 s, D11 of 2a) shown as #9/#10's cooldown card with "That did not confirm it. Wait a
moment before trying again." (COMMON (2a)) and the disabled button "Confirm paused" (2a). `damaged` and `no-wallet` are
never charged to it. The top bar's X closes the tab where nothing is held, and asks first where something is (#36).
Common notices, used by several modes: `not-unlocked` "The wallet is locked. Unlock it first, then try again." (ACCOUNTS
(2a)) + `[Unlock]` → `?mode=unlock`; `mismatch-locked` (COMMON (2a)); `damaged` + `damagedHelp` (COMMON (2a)); `no-wallet`
(COMMON (2a)) + `[Set up a wallet]` (2a).

### 3.1 #36 change-pin → change password (`?mode=password`; ix:14695-14943; sm:396-399; D8)

Chrome: `.s-pin` column; top bar title "Change password" **→ adapted** (ix:14713 "Change PIN", 2a-D7); `.s7-stepper`
three segments + "Step N of 3" (ix:14716, `.noc-caption .noc-numeral`).

- **`step-1`** (36a, ix:14705-14735): `.noc-h2` "Enter current password" **→ adapted** (ix:14721); `.noc-body-sm` "Verify
  it's you before changing your password." **→ adapted** (ix:14722); password field (`autocomplete="current-password"`,
  visible label "Password" as 2a §1.2); `[Continue]` (O01). Only the password (D8): no passkey button.
- **`step-1 checking`**: "Checking…" (REAUTH (2a)); field and button disabled.
- **`step-1 wrong`** / **`cooldown`**: "That did not confirm it." / the cooldown card (2a).
- **`step-2`** (36b, ix:14739-14769): "Choose a new password" **→ adapted** (ix:14755); "At least 12 characters. A few
  unrelated words work well." **→ adapted** (ix:14756 "Pick 6 digits you'll remember. Avoid sequences (123456) and
  birthdays."); `autocomplete="new-password"` field with show/hide (2a #5 strings "Show password" / "Hide password");
  the length meter "N of 12 characters" / "Long enough" (2a #5, D7 of 2a); `[Continue]` (O01) enabled at 12.
- **`step-2 checking`** (rev 2, review H2): at `[Continue]`, "Checking…" (REAUTH (2a)) while `isCurrentPassword` runs one
  Argon2id over the new password with the stored salt (seconds, the cost of step 1); field and button disabled. **Never
  charged to the backoff** (rev 3, review L1): a `true` is the expected path to O02, not a wrong attempt; there is no
  cooldown on step 2, and the only cost is the Argon2id run.
- **`step-2 same`**: that unwrap succeeded — the new password is the current one → "That is your current password. Choose a
  new one." (O02). Nothing of either password is kept for the check (E10).
- **`step-3`** (36c, ix:14773-14803): "Confirm new password" **→ adapted** (ix:14789); "Enter the same password again."
  **→ adapted** (ix:14790); `[Change password]` (O03).
- **`step-3 mismatch`** (36d, ix:14807-14838): field `--danger`, 320 ms shake, `.noc-caption` `--danger` "Passwords don't
  match — try again" **→ adapted** (ix:14829 "PINs don't match — try again"; the approved design's wording); field cleared
  after 600 ms (`MISMATCH_CLEAR_MS`, = the design's 320 ms shake + 280 ms); no attempt counter (ix:14837).
- **`changing`** (extension-only): "Updating your password…" (O04) / "Securing your password takes a few seconds." (2a #5
  `creating`) with `.noc-progress`; every button disabled.
- **`done`** (extension-only; 36e is drawn on #31, §4.1): "Password updated." **→ adapted** (ix:14863 "PIN updated");
  "You can close this tab." (O05); when the envelope has a passkey: "Your passkey still works." (O06); `[Close this tab]`
  (2a). **Drawn as 04r's hero (D26):** #4's `.s-confirm .success-state` markup — the 96 px success ring with the check,
  the title as `.noc-h2`, the lines as the body — in place of the stepper and the plain notice (`#cp-done`).
- **`busy`**: "The wallet changed while you were typing. Start again." (RESTORE (2a)) + `[Start again]` (2a) → step 1.
- **`not-unlocked`**, **`mismatch-locked`**, **`damaged`**, **`no-wallet`**: common notices.
- **`failed`**: "Something went wrong. Your password was not changed." (O07).
- **`cancel-confirm`** (ix:14918, back during steps 2–3): "Cancel password change?" **→ adapted** ("Cancel PIN change?");
  `[Keep changing]` (O08) / `[Cancel change]` (O09) → zero the data key, empty the fields, close the tab.
- **`dropped`** (extension-only): the page was left during steps 2–3 (`pagehide`, including a back/forward-cache entry),
  **or the 5-minute TTL ran out** (C20) → the data key is zeroed and the fields emptied; the page shows step 1 with
  "Enter your current password again." (O10). A `vault.changePassword` answered `locked` zeroes the key the same way and
  shows `not-unlocked`.

**Memory (rev 2 ruling on review-1 M2, bounded in rev 3 by C20).** Step 1's proof yields the data key (a `Uint8Array`),
held until step 3 sends, and zeroed **on `pagehide`, on leave (the X, `[Cancel change]`, any navigation), after success,
and at the TTL** — **not** on `visibilitychange → hidden`. **TTL (C20, review-2 H1):** the key and the fields live at
most 5 minutes from the step-1 proof; each keystroke in steps 2–3 renews the deadline. A timer zeroes them at the
deadline, and the deadline is also re-checked on `visible` and before every step change and send, so a timer delayed by
a throttled background tab cannot leave an expired proof usable. #36's fields are **not** emptied on `hidden` either. Reason: changing a password means
switching to a password manager (another tab or window) to generate and store the new one; a page that dropped everything
on `hidden` would send every such user back to step 1, every time. This is a declared exception to 2a's field rule (2a
§3.5, review L7 of 2a), for #36 only; every other 2b mode keeps 2a's rule. The old password string is dropped at step 1's
click and `proven.mnemonic` at once (E10; JS strings cannot be zeroed — stated in the review list). The new password lives
in the two fields and the closure until the message is answered or the page is left. Component tests: "hidden → visible
keeps step 2 and its fields"; "`pagehide` zeroes the held data key" (mutation: zero on `hidden` too → the first red; skip
the zeroing → the second red); **rev 3 (C20):** "held key zeroed and fields emptied at 5 min with no keystroke"
(fake timers; mutation: **no TTL → red**); "a keystroke at 4 min moves the deadline to 9 min"; "`visible` after the
deadline shows `dropped` at once, with no `[Continue]` or `[Change password]` enabled" (mutation: check only in the timer
→ red, with the timer suppressed as a throttled tab would); "`[Change password]` pressed past the deadline sends
nothing".

**Engine:** E10. **Navigation:** #31/#35 "Change password" → this tab; `done` → close.

**No address binding (D33):** unlike `?mode=delete` (C17), this page shows no account address: a password change keeps
the wallet, its keys and its accounts, so there is no "wallet on screen" to bind the proof to.

**Differs, loudly:**
- PIN dots, the numeric IME and auto-advance become password fields with buttons (2a-D7): a password has no "6th digit".
- The weak-PIN check "Pick a less common PIN" (ix:14915) is not built: only the 12-character rule (2a-D7).
- Step 1 failures are charged to the page's own backoff, not to #9's table, and never exit to #9 (ix:14913): the engine
  has no shared counter (2a-D11).
- 36e's "biometric-bound key … re-bound" (ix:14905) does not apply: the passkey wraps the same data key and keeps working.
- FLAG_SECURE, haptics and predictive back dropped (2a-D1); the `cancel-confirm` modal is opened by the X instead.
- 36e itself is shown on #31 in the popup (C10), not as the tab's hand-back.
- **Switching tabs keeps the change going** (M2 ruling): the fields and the held data key survive `hidden`, unlike every
  other vault mode; they go on `pagehide`, on leave, after success, and **after 5 minutes without a keystroke** (C20).

### 3.2 #37's proof (`?mode=delete`; D9, D10, D11)

The design's #37 is a popup screen (§5); this mode is the proof that follows its hold.

- **`idle`**: top bar title "Delete wallet" (ix:14963); `.noc-h2` `--danger` "Delete this wallet?" (ix:14971);
  `.noc-caption` "This wallet's first account" (O11) + the address of the stored account with the lowest `index` (C17) in
  groups of four
  (`addressGroups`, read from the envelope at load; C17) — the same address #37 showed; `.noc-body` "Enter your password
  to delete this wallet from this browser. Your funds stay on Solana; your recovery phrase still controls them." (O12); password field; `[Delete wallet]` (ix:15000) as a `--danger` primary;
  `[Confirm with passkey]` (2a) when the envelope has one; `[Cancel]` (2a) → close the tab.
- **`deleting`**: "Deleting…" (O13); all disabled.
- **`wrong`** / **`cooldown`**: 2a's.
- **`deleted`**: `location.replace('unlock.html?mode=welcome')` → #1 with **no toast** ("the absence of the wallet IS the
  confirmation", ix:15138).
- **`changed`** (rev 2, C17; ordered in rev 3): at the click, **before any KDF run**, the re-read revision differs from
  the one shown → nothing is proven or sent, **never charged to the backoff**; "The wallet
  in this browser changed. Check the address and try again." (O14); the address re-rendered from the new envelope; the
  field emptied; the proof buttons enabled again (a new proof deletes the wallet now shown). No wallet any more → `no-wallet`.
  The same `changed` follows when the proof's own revision (`proveFactor`'s re-read) differs from the shown one (Task 9
  fix round 1, review I1: on the passkey path the OS prompt lies between the click's compare and the proof).
- **`send-open`**: "A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes
  — then try again." (RESTORE (2a)) + "The wallet has been locked. Nothing was deleted." (O15) + `[Unlock]` (2a) →
  `?mode=unlock` (rev 2, review M1: E5 locked the wallet; the user needs a way back in) and `[Close this tab]` (2a).
- **`busy`**: RESTORE `busy` (2a). **`unlocked`**: "The wallet was unlocked while this was running, so nothing was
  deleted. Start again." (RESTORE (2a)).
- **`damaged`**: COMMON `damaged` + `damagedHelp` (2a) — no delete (D10).
- **`no-wallet`**: common notice.
- **`failed`**: "Something went wrong. Nothing was deleted." (O16).
- **`passkey-unavailable`**: COMMON `passkeyUnavailableConfirm` (2a).

**Engine:** the click → `readLocal` + `envelopeRevision` compared with the rendered one (C17; `changed` on a mismatch,
before any Argon2id or PRF run) → `proveFactor` → `deleteWallet` (E11) with `proof.revision`. The page reads the
envelope's public fields only (`readLocal.ts`), before any proof, to render the address of the **lowest `index`**
(review §8 (a); rev 3 M1). `proveFactor` re-reads it and mints `proof.revision` from that read, and the page compares
`proof.revision` with the shown revision again before `deleteWallet`. A mismatch is `changed` (Task 9 fix round 1, review
I1), not `busy`. Only a change after `proveFactor`'s read (during its KDF, or before the forget lands) is E5's `busy`.

**Leaving the page** (Task 9 fix round 1, review I3, the controller's ruling): hiding the tab does **not** cancel a delete
already clicked. The click is the decision, as with #36 while `changing`. The typed password still leaves the field. A
`pagehide` (the page actually left) before the forget is sent **aborts** it. The page bumps a generation counter and
re-checks it after every await before the send, so no forget is sent, the proof is dropped and any PRF output is zeroed.
**[Cancel] during the cooldown** closes the tab even though the backoff's wait holds the page's gate (review M1).

**Differs, loudly:** the design deletes on the hold (ix:15138); here the hold opens this proof (D9). The design's
"atomic … ~200 ms" (ix:15138, 15152) is E5's commit point (the vault write); the cleanup after it is best effort with the
first-write backstop (2a E5).

### 3.3 Passkey add / replace / remove (`?mode=passkey&op=…`; D12, D13, C3, C4)

Chrome: 2a's #6 `.s-bio` column, 56 px key icon, no step counter.

`op=add`, **no passkey stored** (add):
- **`idle`**: `.noc-h1` "Unlock Noctura with a passkey" (2a #6); lede "Adds convenience. Your password always works too —
  keep it safe." (2a #6); "Enter your password to add the passkey." (2a, `unlock.html:235`); password field;
  `[Add a passkey]` (2a); `[Cancel]` (2a).
- **`adding`**: "Waiting for your passkey…" (PASSKEY (2a)).
- **`added`**: "Passkey added." (PASSKEY (2a)) + "You can close this tab." (O05) + `[Close this tab]` (2a). Drawn as
  04r's hero (D26): the ring with the check, the title and the line in `#pm-done`, in place of #6's key tile, title and
  lede.
- **`unsupported`**: PASSKEY `unsupported` (2a). **`failed`**: PASSKEY `failed` (2a). **`wrong`** / **`cooldown`**: 2a's.

`op=add`, **a passkey stored** (replace, C4):
- **`idle`**: `.noc-h1` "Replace your passkey" (O17); lede "The new passkey replaces the one this wallet uses now. The old
  one stays in your passkey manager until you delete it there." (O18); the password line and field as above;
  `[Replace passkey]` (D13); `[Cancel]`.
- **`adding`** as above; **`replaced`**: "Passkey replaced." (O19) + "You can close this tab." (O05), as 04r's hero (D26).
- **`unsupported`**, **`failed`**, **`wrong`**, **`cooldown`**: as add.

`op=remove`:
- **`idle`**: `.noc-h1` "Remove your passkey" (O20); lede "Confirm with your password or with the passkey itself. Your
  password keeps working." (O21); password field; `[Remove passkey]` (D13) as the delete page's danger button
  (`btn btn-destructive`, D27); `[Confirm with passkey]` (2a); `[Cancel]`.
- **`removing`**: "Removing the passkey…" (O22).
- **`removed`**: "Passkey removed." (O23) + "It is still saved in your passkey manager (Google, Apple or your password
  manager). Delete it there if you no longer need it." (O24) + `[Close this tab]`, as 04r's hero (D26). Only these
  three successes get the hero; every other end keeps #6's head and the line under the form.
- **`no-passkey`**: "This wallet has no passkey. Nothing was changed." (O25).
- **`busy`** (E12's outcome after the one automatic retry; review L1): RESTORE `busy` (2a) + `[Start again]` (2a) → `idle`. **`not-unlocked`**, **`mismatch-locked`**,
  **`damaged`**, **`no-wallet`**: common. **`failed`**: "Something went wrong. Nothing was changed." (O26).
- **`passkey-unavailable`**: COMMON `passkeyUnavailableConfirm` (2a).

**Engine:** `addPasskey` (unchanged) for add/replace; E12 for remove.

**No address binding (D33):** as #36, the passkey pages show no account address (no C17 binding): adding, replacing or
removing the passkey changes only the wrap of the same wallet's data key.

**Differs, loudly:** the "manage" variant is referenced but never drawn (ix:13616, 14659, 14663); these states derive
from 2a's #6. The design's enrollment-change disclosure (ix:5427, 13452, 14430) has no passkey analogue and is not shown
(D13). The fingerprint icon is a key icon and the BiometricPrompt is the browser's WebAuthn prompt (2a §3.6).

### 3.4 Reveal phrase (`?mode=reveal`; #3 chrome; ix:4654-5001; sm:90-96; D14, C9)

- **`proof`** (extension-only): top bar `.noc-overline` "Recovery phrase" (2a); `.noc-h1` "Show your recovery phrase"
  (O27); lede "Enter your password first. Nothing is shown until you press and hold." (O28); field; `[Continue]` (O01).
  **Password only (D23):** no passkey button, even when the envelope has a passkey. **`checking`**, **`wrong`**, **`cooldown`**, **`not-unlocked`**,
  **`mismatch-locked`**, **`damaged`**, **`no-wallet`**, **`failed`** ("Something went wrong. Try again.", REVEAL (2a)).
- **`pre-reveal modal`** (ix:4664-4689): "About to show your recovery phrase" (ix:4675); "Move to a private place. Anyone
  who sees these 24 words can spend everything in this wallet, forever." (ix:4676; "24" **→ adapted** to the phrase's
  count, 12 or 24 — import accepts both); callout "We can't recover this for you if someone takes it. Your only copy is
  the one you write by hand." (2a §3.3 adaptation of ix:4679); `[I'm in a safe place — continue]` (ix:4682); `[Cancel — go
  back]` (ix:4683) **or a click on the backdrop** (`.modal-backdrop`, ix:4672; ix:4977 "OR background tap"; rev 2, review
  L6: built, as 2a's #3 does) → the words are dropped and the tab closes; if the browser refuses, "Nothing is shown. You
  can close this tab." (O29).
- **`blurred`** (ix:4694-4751): `.noc-overline` "Recovery phrase" in place of "Onboarding · 2 / 5" **→ adapted**; `.noc-h1`
  "Recovery phrase" (ix:4707); "24 words. Write them down on paper, in order. This is the only backup." (ix:4708, count
  **→ adapted**); the grid, column-major, 2 × 12 (2 × 6 for 12 words), cells holding the stand-in "xxxxxx" (2a); overlay
  "Press and hold to reveal" / "Make sure no one is looking over your shoulder. Hold for 2 seconds. Auto re-blurs after 20
  s for safety." (2a adaptations of ix:4740-4741); `[I've written it down]` disabled (ix:4746).
- **`revealed · countdown`** (ix:4756-4813): the real words (text nodes only); chip "13 s · auto-blur" (`--warning`
  > 5 s; ≤ 5 s "5 s — still memorizing?" `--danger`; 2a); helper "Holding to reveal · Auto-blurs at 20 s for safety.
  Screen readers announce at 10 s and 5 s only." (2a adaptation of ix:4805); CTA enabled.
- **`re-blurred at 20 s`** (ix:4818-4875): "Still looking?" / "Press and hold again to keep viewing. Releasing now is fine
  — your hand is remembering enough." (2a adaptations of ix:4864-4865).
- **`confirmed`** (ix:4880-4933): "Phrase locked in. Tap continue to verify a few words." (ix:4894); stamp "Acknowledged"
  (ix:4924); `[Continue]` → §3.5's check (C9).

**Mechanics** (2a `view/hold.ts`, `HOLD_MS` 2 000, `REVEAL_MS` 20 000): pointer or Space/Enter held; the auto-blur fires
even while held. **No copy, select or drag (D14):** the grid has `user-select: none` (a class, CSP-clean); `copy`, `cut`,
`dragstart`, `selectstart` and `contextmenu` are cancelled **on the grid element** (rev 2, review L5 — not on the
document, so the proof step's password field can still be selected and filled by a password manager), with the listeners
mounted only in `blurred`, `revealed`, `still-looking` and `confirmed`; there is no copy button; the clipboard is never
written. **Out of the DOM:** the words exist as text nodes only in `revealed`; every other
state, `visibilitychange → hidden`, `pagehide`, and leaving the mode replace them with the stand-in (the MutationObserver
and `gen` guard of `screens/reveal.ts` stay). The phrase stays in the closure until the check finishes or the page is left.

**Engine:** `runReveal` (`revealFlow.ts:16-33`), password only (E16, D23).

**Differs, loudly:** the approved design §1.7 let the reveal mode accept the passkey; D23 makes it password-only. The
proof step is not in the design (B1 §2: "only after re-authentication"); the step counter and the
`Onboarding` eyebrow are replaced; "Screenshots disabled" banner and "Screenshots are blocked" removed (2a-D1); 12-word
phrases get a 2 × 6 grid; FLAG_SECURE and haptics dropped; the B1b-1 reveal form (`unlock.html:475-492`, `[Show the
phrase]` / `[Hide]`) is replaced.

### 3.5 Verify phrase (`?mode=verify`, and reveal's continuation; #4; ix:5027-5163; D15, C8, C9)

- **`proof`** (verify mode only; extension-only): `.noc-overline` "Recovery phrase" (2a); `.noc-h1` "Verify your recovery
  phrase" (O30); lede "Enter your password, then pick three words from your written copy." (O31); field; `[Continue]`
  (O01). **Password only (D23):** no passkey button. The proof's outcomes as §3.4.
- **`empty`** (ix:5027-5048): "Confirm phrase" (ix:5027); "Tap the correct word for each position." (ix:5028); three
  slots "Word #N" with "— select —" (ix:5031-5033); a pool of nine (each slot's word + two BIP-39 distractors, 2a §3.4);
  `[Confirm]` disabled (ix:5048).
- **`partial-correct`**: filled slots drawn `.correct`, used pool buttons dimmed (2a §3.4).
- **`wrong-answer`**: "That's not the right word — let's start over." (ix:5116) in `--danger`; "Word #12 was wrong. Slots
  will reset in a moment." (ix:5123, the position filled in); reset after 700 ms (`RESET_MS`).
- **`success`**: 96 px ring; "Recovery phrase verified" **→ adapted** (ix:5162 "Phrase verified"; the approved design's
  wording); "All three words matched." **→ adapted** (ix:5163 drops "Now lock the wallet with a PIN.") + "You can close
  this tab." (O05); `[Close this tab]` (2a). `vault.phraseVerified` (E15) is sent on entering this state.
- **`success-not-recorded`** (extension-only; the message refused): "All three words matched, but this could not be saved.
  Try again later." (O32). **A neutral hero (D25):** the same `.success-state` with the title unchanged, but the ring in
  the design's neutral tint — the secondary surface `--bg-surface-3` with the icon at `--fg-secondary`, as index.html's
  cancelled-state ring (design-ext `.done-cancelled .ring`) — and the info icon (`#i-info`) in place of the check
  (`.success-state.vlt-neutral`); never the green success ring.

**Engine:** `openProven` (proof) and `confirmPlan` (`screens/confirm.ts:34`); E15. In verify mode the phrase is opened for
the check and never rendered; only the 9-word pool is shown, as on #4.

**Differs, loudly:** password only (D23), although the design's #35 → seed-verify names no factor and the passkey would
have been the faster path. "seed-verify" is referenced, never drawn (ix:14661: "derived from #3 chrome with verification
challenge instead of reveal"); this is #4's screen with a proof first. FLAG_SECURE dropped.

### 3.6 Add / remove an account (`?mode=accounts&op=…`; D16, C6, C14, E13, E16)

`op=add`:
- **`idle`**: top bar `.noc-overline` "Accounts" (2a); `.noc-h1` "Add an account" (O33); field label "Account number"
  (O34), a number input pre-filled with the lowest free account number (1-based); helper "Adding a number this wallet had
  before brings back the same address." (O35); `.banner.info` "Accounts after the first one exist only in this extension
  until the phone app supports more than one account." (2a, `unlock.html:275`, second sentence); "Password" field (2a);
  sticky `[Add an account]` (2a); `[Confirm with passkey]` (2a) when stored.
- **`adding`**: "Adding an account…" (ACCOUNTS (2a)).
- **outcomes** (ACCOUNTS.outcome (2a)): `done`, `done-locked`, `done-not-locked`, `wrong`, `mismatch-locked`, `damaged`,
  `not-unlocked`, `no-wallet`, `cli-single`, `too-many-accounts`, `failed`; new: `index-taken` "That account is already in
  this wallet." (O36); `bad-index` "That is not an account number." (O37).

`op=remove&index=N`:
- **`idle`**: `.noc-h1` "Remove Account N?" (O38; the URL's `index` is the envelope's 0-based `index` field and N =
  `index + 1`, so `index=0` → "Remove Account 1?" — a named test, review L2); the address in groups of four (`view/words.ts`
  `addressGroups`, from the stored envelope); "Its funds stay on Solana; add it again to use them." (D16); "Password" field;
  `[Remove the account]` (2a) as the delete page's danger button (`btn btn-destructive`, D27); `[Confirm with passkey]`
  (2a); `[Cancel]` (2a).
- **`removing`**: "Removing the account…" (ACCOUNTS (2a)).
- **outcomes**: as add, plus `last-account`, `no-such-account` (2a), and `send-open` "A transaction from this account is
  still pending. Wait until it confirms or expires — about two minutes — then try again." **→ adapted** (RESTORE `sendOpen`
  (2a), "wallet" → "account").
- **`unknown-index`**: the URL's index is not in the envelope → "There is no account with that number." (ACCOUNTS (2a)),
  no action button.

**Differs, loudly:** no design (context §1.7). The B1b-1 form's "Account number to remove" field (`unlock.html:463-466`) is
replaced by the manager's choice (C14). The remove page shows "Account N", not the name (C14). A re-added account comes
back with its address and funds but the default name "Account N" — its old name is not kept (E13, review L3). The page
reads only public envelope fields (`readLocal.ts`) for the pre-filled number and the address, before the proof.

### 3.7 #10 settings kind (2a §3.10 + E9)

Unchanged: `loading`, `idle` ("You are about to change" + "Auto-lock → N minutes" / "Re-authentication threshold → $N",
REAUTH (2a)), `wrong`, `cooldown`, `undescribable`, `mismatch-locked`, `damaged`, the `[Cancel]` that only closes (2a).
Changed or new for the settings kind:
- **`applied`** (replaces "Confirmed. You can close this tab."): "Confirmed. The change is saved — you can close this
  tab." (O39).
- **`settings-expired`** (`vault.reauthOk` → `unknown-challenge` after a settings description was shown): "Took too long —
  try again" (approved design §3) + "Nothing was changed. Choose the setting again in Security center." (O40).
- **`settings-not-unlocked`** (`locked`): "The wallet locked while you were confirming. Nothing was changed. Unlock it and
  choose the setting again." (O41) + `[Unlock]` (2a).
- **`settings-failed`** (`malformed` / `failed` from the apply): "Something went wrong. Nothing was changed." (O26).

A challenge that is already gone **when the page loads** (`vault.challengeInfo` → `unknown-challenge`) cannot be known to
be a settings one; the page keeps 2a's `expired` line (§11 item 4).

**A lost reply (D30, accepted):** if the background applied the setting but its answer to `vault.reauthOk` never reached
the page, the page shows `settings-failed`'s "Nothing was changed." although the change was saved. Rare (the reply is a
local extension message), and #35 always shows the stored value, so the next open tells the truth.

**Differs, loudly:** none beyond 2a's #10 list; the settings kind has no mockup of its own (2a built it from #10).

---

## 4. Popup screens (plan 1)

All popup buttons that write go through `LockedButton` (rule 6, 2a §7.6). A `locked` reply anywhere switches the popup to
the locked screen (2a §7.1). Pages open with `platform.openPage` and the popup closes itself, as 2a's #20.

### 4.1 #31 settings (ix:13428-13650; sm:355-362; D7, D22, C10, C16)

Rows `.s7-row` 56 px (glyph, `.s7-title`, `.s7-meta`, `.s7-chev`), group labels `.s7-group-label`. Title `.noc-h1`
"Settings" (ix:13447).

- **`default · no passkey`** (from 31a, ix:13438-13486):
  - `.s7-tip` (ix:13450-13453 slot): "**Tip** — add a passkey to unlock with your fingerprint, face or security key. Your
    password always works too." (O42) — shown only while `wallet.state.passkey === false` (D22).
  - "Account": "Profile" (ix:13457) meta = the selected account's name (design "Wallet 1") → accounts manager (C16).
  - "Security": "Security center" (ix:13464) meta "1 to do" / "N to do" in `--warning` (O43; the singular form for the
    owner to confirm too, review L11) or "All done" in `--success` (O44) →
    #35; "Passkey" **→ adapted** (ix:13465 "Biometric unlock") meta "Off" (`--warning`, as #35a ix:14425) → passkey
    screen; "Change password" **→ adapted** (ix:13466 "Change PIN") → `?mode=password`; "Recovery phrase" **→ adapted**
    (ix:13467 "Backup & restore") meta "Not verified" (O45) in `--warning` (the design's "Not set" tint) → `?mode=reveal`;
    "Lock now" (2a, with its failure line "Could not lock the wallet. Try again." (2a)).
  - "Connections" (plan 2): "Address book" (ix:13552) meta "N contacts" → #15.
  - "Advanced": "Delete wallet" `.s7-row.danger` (ix:13560) → #37.
  - "About": "About Noctura" meta "v…" `.noc-mono` (ix:13565, 2a).
- **`default · passkey on`**: no tip; "Passkey" meta "On" (ix:13465); otherwise as above.
- **`phrase verified`**: "Recovery phrase" meta "Verified" (O46), `--fg-secondary`.
- **`36e · password updated`** (ix:14840-14870): on open, when `settings.get.passwordChangedAt` is within 10 minutes and
  differs from the UI pref (C10): the "Change password" row gets the 30 % success border + 6 % success background and meta
  "Just updated" in `--success` (ix:14856); `.s7-toast` "Password updated" **→ adapted** (ix:14863 "PIN updated") for
  1.8 s; the decoration clears after 5 s; the pref is set to that timestamp.
- **`lock failed`**: 2a's line.

**Engine:** `wallet.state` (accounts in display order, `selected`, `passkey`), `settings.get` (`phraseVerifiedAt`,
`passwordChangedAt`), `contacts.list` (plan 2, for the count; a refusal hides the meta). The task count is §4.2's.
**A failed `settings.get` (D32, accepted):** the metas that depend on it ("Security center"'s count, "Recovery phrase")
stay blank; the rows still open their screens.

**Differs, loudly:**
- Omitted rows (D22): "Currency · USD" (2a-D27), "Notifications · 3 muted" (2a-D28), "Material You accent" and 31b's
  Material You card and swatches (Android only), "Hide balances on lock" and "Number formatting" (31b; not planned),
  "RPC endpoint" (#55 not planned), "Priority fee strategy" (2a-D15), "Connected dApps" (B1c), "Air-gap signing" (not
  planned), "Export transaction history · CSV" (not planned), "Diagnostics" (not planned). The "Display" and "Network"
  groups therefore do not appear. 31b as a whole (Material You on) has no extension state.
- "Security center · Score 65" becomes a task count (D3). "Biometric unlock" becomes "Passkey"; "Change PIN" "Change
  password" (2a-D7); "Backup & restore · Not set" becomes "Recovery phrase · Not verified" (2a-D17, D4).
- The tip is a passkey suggestion, not the enrollment-reset disclosure, and is not dismissible (D22).
- No back arrow: Settings is a tab-bar root (2a §6.1). "Lock now" is 2a's addition. "Profile" opens the accounts manager,
  not a profile sub-page (D22).
- Plan 1 has no "Connections" group (the address book is plan 2).
- **A restore drops the passkey (rev 2, review M5).** After #39's restore (E5 with `replacement`) the envelope has no
  passkey, so "Passkey" reads "Off" and the tip reappears. #39 already says so before the restore ("A passkey is not carried
  over; you can add one again later.", FORGOT step 3 (2a)); #31 adds nothing more.

### 4.2 #35 security center (ix:14380-14694; sm:386-394; D1–D5, C8, C15)

Top bar back + `.noc-h1` "Security center" (ix:14398).

**Facts:** `tasks` = [no passkey → "Add a passkey"] + [phrase not verified → "Write down your recovery phrase", "Verify
recovery phrase"] (C8), in that order — the design's (ix:14417-14419: biometric, backup, verify; plan-1 Task 16 fix round
1). All from `wallet.state.passkey` and `settings.get.phraseVerifiedAt`.

- **`tasks outstanding`** (35a, ix:14389-14451):
  - `.s7-score-card.no-ring` (C15): `.noc-h3` "Improve your security" **→ adapted** (ix:14410 "Improve your score");
    `.noc-body-sm` "N outstanding tasks." **→ adapted** (ix:14411; "finishing all takes about 4 minutes" dropped).
  - overline "Outstanding tasks" (ix:14415); `.s7-task` rows with the warning glyph: "Write down your recovery phrase"
    (D4) → `?mode=reveal`; "Verify recovery phrase" **→ adapted** (ix:14419 "Verify recovery seed") → `?mode=verify`; "Add
    a passkey" **→ adapted** (ix:14417 "Set up biometric unlock") → passkey screen.
  - no "Active protections" here: the design draws that section on 35b only (rev 2, review L7 — built faithfully). On
    35a the same facts are on screen anyway: the auto-lock and passkey metas in "Locks", the phrase as the tasks.
  - overline "Locks" (ix:14422, 14513): the Auto-lock row, the app-lock row, the threshold row, "Passkey" (meta "On" `--success` / "Off" `--warning`, ix:14425) →
    passkey screen, "Change password" **→ adapted** (ix:14426) → `?mode=password`.
  - overline "Danger zone" `--danger` (ix:14597) + the danger card (below).
- **`all clear`** (35b, ix:14454-14498): card `.noc-h3` "Looks great" (ix:14475) / "All checks pass." **→ adapted**
  (ix:14476); no "Outstanding tasks"; overline "Active protections" (ix:14485): "Auto-lock" meta "N min" (ix:14424 format),
  "Passkey" **→ adapted** (ix:14488 "Biometric unlock") meta "On" (ix:14488), "Recovery phrase verified" **→ adapted**
  (ix:14489 "Recovery seed verified") meta "Yes" (ix:14489) — every meta `--success` (35b has no task left, so the
  passkey is on and the phrase verified by definition); then Locks; Danger zone.
- **`auto-lock expanded`** (35c, ix:14501-14563): the Auto-lock row (35a: "Auto-lock" meta "5 min", ix:14424) toggles an
  inline card: `.noc-body` "Auto-lock" (ix:14519), `.noc-caption` "When idle, lock the wallet after" (ix:14520),
  `.s7-picker` "1 min" "5 min" "15 min" "60 min" (ix:14524-14526; "Never" ix:14527 **→ adapted** to "60 min", D1); the
  current value `.sel`; caption "A longer time asks for your password in a new tab." (O47).
- **`threshold expanded`** (extension-only, D5): row "Re-authentication threshold" (O48) meta "$100"; card `.noc-body`
  "Re-authentication threshold" (O48), `.noc-caption` "Ask for your password before sends worth more than" (O49),
  `.s7-picker` "$50" "$100" "$500" "$1,000" (D5); caption "A higher amount asks for your password in a new tab." (O50).
- **`app-lock row`** (D2): a static `.s7-row` (no chevron, not a button), glyph `zap` (the design's, ix:14536; Task 16
  ruling), title "Locks when the browser
  closes" (D2) — in the slot of the "App-lock timer" card (ix:14534-14541).
- **`weakening`** (a picker value above the current): `settings.set` → `reauth-required {challengeId}` →
  `openPage(reauthPage(id))`; the popup closes; nothing is applied until #10. On every open #35 shows the **stored**
  value; it never shows a choice still waiting for #10. With several #10 tabs open, the last one confirmed wins (E9,
  review M6).
- **`strengthening`**: `settings.set` → ok → the picker moves and the Locks row's meta updates (and, on the all-clear
  state, the "Active protections" auto-lock meta).
- **`setting failed`** (any other refusal): `.field-msg` `--danger` "Could not save the setting. Try again." (O51); the
  picker keeps the old value.
- **`value not a preset`** (a stored auto-lock of 2–59 other than the presets, or a threshold not among the four): no
  option `.sel`; the row meta shows the stored value ("7 min", "$250").
- **`danger zone`** (35d, ix:14566-14612): card (8 % danger bg, 30 % hairline): `.noc-h3` `--danger` "Delete this wallet"
  (ix:14601); "Removes the encrypted keys and local data from this browser. To restore, you'll need your recovery
  phrase." **→ adapted** (ix:14603: "device" → "browser"; "original seed phrase or a backup file + password" → "recovery
  phrase", 2a-D17); danger-tinted `.btn-secondary` "Delete wallet" (ix:14604) → #37.

**Engine:** `settings.get`, `settings.set` (E9, C1), `wallet.state`.

**Differs, loudly:**
- The score ring, the number and "/ 100" (ix:14400-14407, 14467-14472) are dropped (D3); the card keeps its headline and
  body (C15). 35b's "Recommendations" and "Re-export your backup (last export 47 days ago)" (ix:14480-14482) and "Encrypted
  backup · 47 d ago" (ix:14487) dropped (2a-D17).
- "Export encrypted backup" (ix:14418) becomes "Write down your recovery phrase" (D4).
- "Air-gap signing" rows (ix:14490, 14552-14553, 14591-14592) and the "On-chain activity" staking row with its claimable
  date "[TGE date redacted]" (ix:14433-14439, 14578-14584) are omitted (D4).
- "Never" becomes "60 min" (D1). The "App-lock timer" card (Immediately / 30 s / 2 min) becomes the static row (D2).
- The re-auth threshold row and card are new (D5; no design row).
- The enrollment-reset `.s7-tip` (ix:14430) is not shown (no passkey analogue; D13).
- The design's "changes write to MMKV instantly (no Save button)" (ix:14562) holds for strengthening only; a weakening
  waits for #10 (B1 §1, D6).
- "Biometric unlock" → "Passkey"; "Change PIN" → "Change password"; "Recovery seed verified" → "Recovery phrase verified".
- After #39's restore the "Add a passkey" task returns (a restore drops the passkey, E10/M5); declared, not hidden.
- **35b's order (Task 20 fix round 1, visual review M5):** "Auto-lock" takes the first "Active protections" slot, the
  design's "Encrypted backup · 47 d ago" (ix:14487, dropped with 2a-D17); and 35b continues with Locks and Danger zone after
  Active protections, where the design's 35b frame ends at Active protections (ix:14485-14491) — the same screen as 35a,
  so the locks and the delete stay reachable when every task is done. **Accepted by the owner (D28, 2026-10-08).**
- A weakening's lost #10 reply shows "Nothing was changed." although it was saved (D30, accepted; §3.7); #35's stored
  value is the truth on the next open.

### 4.3 Accounts manager (derived from the 2a switcher; no design; D16, D17, C6, C14)

Pushed screen (not a sheet: it holds reorder and remove). Top bar back + `.noc-h1` "Accounts" (2a switcher title).

- **`list`**: one row per account in display order (E14): avatar initial, name `.noc-body-lg`, `twoGroups` address
  `.noc-mono`, balance "12.4821 SOL · $1,234.56", "cached 2 h ago" / "not checked yet" (2a §5.2, same fresh-read rule:
  first 10 rows); the selected row's check. Row tap → `accounts.select` (2a): **the whole row selects (D24)** — the
  name line is the select button (a `LockedButton`, `aria-pressed`), and a click on the address/balance line presses that
  same button, so it goes through the same lock (rule 6); the line stays the button's `aria-describedby` description and
  is not a second button (the keyboard reaches the select through the button). The row tools below are separate
  buttons: a tap on one never selects. Per row: pencil → inline rename (2a §5.2,
  its three error strings); `[↑]` / `[↓]` icon buttons, aria "Move <name> up" (O52) / "Move <name> down" (O53), disabled
  at the ends; trash icon, aria "Remove <name>" (O54). Bottom: `[Add account]` (2a) → `accounts&op=add`; for `cli`
  disabled with "A Solana CLI wallet has exactly one account." (2a).
- **`reordering`**: a move writes `accounts.order` (LockedButton); the list reorders on `ok`; focus stays on the moved
  row's same button (keyboard reorder: Tab to the button, Enter/Space). `stale` → re-read `wallet.state` and show
  "The accounts changed. Try again." (O55); other refusals "Could not save the order. Try again." (O56).
- **`remove confirm`** (`.s8-sheet`): title "Remove <name>?" (O57); the address in groups of four (`AddressGroups`); balance
  line "Holds 12.4821 SOL · 4,200 NOC · $1,234.56" (O58 for the "Holds" form) / "Holds no funds" (O59) / "Balance not
  checked" (O60); "Its funds stay on Solana; add it again to use them." (D16); `[Continue to remove]` (O61) →
  `removeAccountPage(index)`; "Confirmation opens in a new tab." (2a); `[Cancel]`. O58's amounts use the app's standard
  amount format (`showAmount`, as every other balance: "4,200.00 NOC", not the example's "4,200 NOC"); the line is the
  rows' last read, and a qualifier for a cached-only read is deferred (Task 14 review, fix round 1 ruling).
- **`remove · last account`**: the trash button disabled; caption "The last account cannot be removed." (ACCOUNTS (2a)).
- **`remove · send open`** (`wallet.pending` has an open record for the account): `[Continue to remove]` disabled and "A
  transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try
  again." (§3.6's adapted string). The background refuses anyway (C5).

**Engine:** `wallet.state`, `wallet.cached` / `wallet.balances`, `wallet.pending`, `accounts.select`, `accounts.rename`,
`accounts.order` (E14).

**Differs, loudly:** a re-added account returns with its address and funds but the default name, not its old one (E13,
review L3). No design exists (context §1.7); derived from the 2a switcher (2a-D14) and #43's sheet. Reorder is
buttons, not drag (keyboard-first; a drag handle is not drawn anywhere). The switcher sheet (2a §5.2) stays for quick
switching from #11 and gains the display order only.

### 4.4 Passkey screen (#6 "manage"; ix:5383-5493 derived; D12, D13)

Top bar back + `.noc-h1`-size title "Passkey" **→ adapted** (#31's "Biometric unlock" row, ix:13465). `.s-bio` layout, 56 px
key icon in `--accent` on `--accent-tint`.

- **`off`**: "Unlock Noctura with a passkey" (2a #6); lede "Adds convenience. Your password always works too — keep it
  safe." (2a); rows "Faster unlock", "Password still works", "Where your passkey lives" with 2a's bodies; `.s7-tip` "Your
  password always works too." (D13); `[Add a passkey]` (2a / D13) → `passkey&op=add`; caption "Confirmation opens in a new
  tab." (2a).
- **`on`**: `.noc-h1` "Passkey is on" (D13); lede "You can unlock and confirm with it. A wallet has one passkey: a new one
  replaces this one." (O62); row "Where your passkey lives" (2a); `.s7-tip` "Your password always works too." (D13);
  `[Replace passkey]` (D13) → `passkey&op=add`; `[Remove passkey]` (D13) → `passkey&op=remove`; note "Removing it here does
  not delete it from your passkey manager." (O63); caption "Confirmation opens in a new tab." (2a).

**Engine:** `wallet.state.passkey` (E12).

**Differs, loudly:** the manage variant is not drawn (ix:13616, 14659, 14663); this derives from #6 (D13). #6's "PIN
still wins" and "Resets on enrollment change" rows (ix:5420, 5427) are not shown (2a §3.6). The design toggles from #31
(ix:5480); here the row opens this screen (D13).

---

## 5. #37 delete wallet (popup; ix:14945-15166; sm:401-404; D9, D11, C13)

Top bar back + `.noc-h1` "Delete wallet" (ix:14963). Warning card (36 % danger hairline, 10 % danger bg). Sticky bar:
`[Delete wallet]` / `[Cancel]`.

- **`idle`** (37a, ix:14953-15007): `.noc-h2` `--danger` "Delete this wallet?" (ix:14971); `.noc-body` "This removes **all
  encrypted keys** and **local data** from this browser." **→ adapted** (ix:14973, "device" → "browser"); bullets:
  - "Your assets won't be lost on-chain — but you'll need your **recovery phrase** to access them again." **→ adapted**
    (ix:14977; "seed phrase or a backup file + password", 2a-D17);
  - "Local settings, cached balances and the list of addresses you have sent to are **erased** and not recoverable."
    **→ adapted** (ix:14981; plan 2: "Local settings, cached balances, your address book and the list of addresses you
    have sent to are **erased** and not recoverable."; no dApp connections, B1c);
  - (ix:14985, staking) omitted.
  `.noc-caption` "This wallet's first account" (O11) + the address of the account with the **lowest `index`** — not the
  first in display order (rev 3, review M1) — in groups of four (`AddressGroups`; C17, review M1) —
  the delete tab shows the same address and refuses to delete any other wallet.
  `.noc-overline` "Type **DELETE** to confirm" (ix:14991, DELETE `--danger`, letter-spacing .16em); input placeholder
  "Type DELETE here" (ix:14993), `autocapitalize="characters"`, `autocomplete="off"`, `spellcheck=false`; `.noc-caption`
  "Case-sensitive · must match exactly." (ix:14995); `[Delete wallet]` disabled, greyed at full opacity (ix:15000, 15006);
  `[Cancel]` (ix:15001) → back to the caller with the field wiped.
- **`funded`** (D11, C13; extension-only, any state): above the overline, `.banner.warning` "This wallet holds funds" (D11)
  + one line per token held, summed over the accounts read ("12.4821 SOL", "4,200 NOC", …) + the USD market total (2a
  valuation) + "They stay on Solana. Only your recovery phrase reaches them after this." (O64).
- **`balances unknown`** (a read failed, was skipped, or an account beyond the first 10 has no cache): `.banner.warning`
  "Balances could not all be checked — this wallet may hold funds." (O65). "Skipped" (Task 15 fix round 1, I1): the fresh
  pass read fewer than min(accounts, 10) rows — the 403 cool-down, unreachable or offline — so stale cached rows (even
  zeros) never stand in for a check.
- **`send open`** (`wallet.pending` has an open record): `.banner.warning` with RESTORE `sendOpen` (2a), **drawn as the
  funds banner (D29)**: the string's first sentence "A transaction from this wallet is still pending." as the bold
  `.banner-title`, the rest "Wait until it confirms or expires — about two minutes — then try again." as the regular
  `.banner-line` — the approved string split, no word changed; the typed gate stays usable, `[Delete wallet]` stays
  disabled.
- **`partial`** (37b, ix:15009-15050): the body collapses to "This removes all encrypted keys and local data from this
  browser." (ix:15029, adapted as above); ix:15030 (staking) omitted; input accent ring; helper "**3** of **6** characters
  · keep going" (ix:15038, `.noc-numeral`); CTA disabled. Typed text that is not a prefix of `DELETE` → helper "Type DELETE
  exactly — it is case-sensitive." (O66).
- **`matched · hold`** (37c, ix:15052-15097): body "Hold the red button below — release to cancel, hold for the full
  second to delete." (ix:15072); eyebrow "Confirmation matched" (ix:15076) `--success`; input success-tinted + check; caption
  "Hold the red button to delete · release to cancel" (ix:15083); `.btn-primary.s7-longpress` `--danger` "Hold to delete"
  (ix:15139) at rest, "Hold to delete · 0.4 s" (ix:15089) while held — the seconds left, one decimal, `.noc-numeral`;
  inner fill `scaleX` = share held; `[Cancel]` disabled while pressing (ix:15096, 15150).
- **`released early`** (ix:15139): label back to "Hold to delete", fill reset, stays in this state.
- **`held`**: after 1 s held (D9) → `openPage('unlock.html?mode=delete')`; caption "Confirmation opens in a new tab." (2a)
  under the CTA from the moment the input matches; the popup closes; the field is wiped.

**Mechanics:** pointer down/up/leave, and **Space or Enter held** on the focused CTA (keydown starts, keyup cancels;
repeat events ignored); `blur` cancels. `prefers-reduced-motion`: no fill animation, the label still counts (ix:15148).
**Screen readers (D31, accepted; revisit in B1e):** a screen reader in browse mode sends a single click, not a held key,
so it cannot complete the hold; the user switches to focus mode (Space/Enter then reach the button as held keys).
Documented, not solved here.
Balances: `wallet.cached` for every account, fresh `wallet.balances` for the first 10 (2a §5.2's rule), never a guard.

**Engine:** `wallet.cached`, `wallet.balances`, `wallet.prices`, `wallet.pending`; then §3.2.

**Differs, loudly:**
- The hold is **1 s** (D9), not 600 ms (ix:14949, 15148); the design disagrees with itself ("the full second", "0.4 s" at
  65 %, ix:15072, 15089) and the owner chose the second.
- The hold does not delete: it opens the proof (§3.2, D9). The design's "deletion sequence … success → welcome"
  (ix:15138) happens after the proof.
- The staking bullet and line (ix:14985, 15030) and "dApp connections" (ix:14981) are omitted (no staking, B1c); "backup
  file + password" removed (2a-D17).
- `funded`, `balances unknown` and `send open` are extension-only (D11, E5).
- Haptics, FLAG_SECURE notes and predictive back (ix:15149-15151) dropped (2a-D1); Back/Esc returns to the caller with the
  field wiped (ix:15140-15141).

---

## 6. The address book (plan 2)

### 6.1 #15 address book (ix:7372-7552; sm:186-190; D18, D21, C12)

`.s-abook`. Top bar: back `.icon-btn` (ix:7386); `.title .noc-h1` "Address book" (ix:7387); accent `.icon-btn` aria "Add
contact" (ix:7388, `#i-plus`) → the sheet. `.search` input placeholder "Search contacts" (ix:7393).

- **`populated`** (ix:7380-7434): rows ≥ 64 px: `.ava` (gradient class chosen from the address: violet / mint / coral /
  amber / blue, the name's initial), `.meta` with `.name .noc-body-lg` and `.addr .noc-body-sm .noc-mono` ("Gabc…xyz9":
  first 4 … last 4, as drawn), `.when .noc-body-sm` `--fg-tertiary`. **When** (ix:7522: relative natural language):
  "today" (O67), "yesterday" (O68), "N days ago" (ix:7398), "last month" (ix:7408), "N months ago" (ix:7413), "last year"
  (O69), "N years ago" (O70), "never" (ix:7418), from `lastSentAt`. Order: as stored, newest first (C12). Row tap
  (standalone) → the edit sheet (D21).
- **`empty`** (ix:7437-7461): search disabled (ix:7449); `.empty` `#i-users` icon; `.noc-h3` "No saved contacts yet"
  (ix:7453); `.noc-body-sm` "Save aliases for the wallets you send to most often. Each one shows up here with the truncated
  address and last-sent date." (ix:7454); `.btn-primary` "Add first contact" (ix:7455) → the sheet; `.noc-caption` "Or save
  one from a transaction's details." **→ adapted** (ix:7456 "Or save from a transaction detail · #27": the screen number is
  not user copy).
- **`search active`** (ix:7464-7501): input focused with the query; `.clear` aria "Clear search" (ix:7478); overline "N
  results for "q"" (ix:7480; "1 result for "q"" **→ adapted** singular); matches by name or address, case-insensitive, the
  name's match in `<mark>` (ix:7483, 7488); "No more matches." (ix:7492); `.btn-tertiary` "Add new contact "q" →" (ix:7493)
  → the sheet with the name pre-filled with the query (ix:7533).
  - **Controller ruling (Task 3 fix round 1, M4):** this case-insensitive, substring rule is for a **name** query. When
    the trimmed query is itself address-shaped (passes the same base58 length-32–44 check the client uses for an
    address), the match is instead **exact, case-sensitive equality against the contact's address only** — no
    substring, no case-folding, and the name field is not consulted. A look-alike address that differs only by a
    suffix, or only by case, is not a match. Address poisoning is this plan's threat model (implementer-rules.md); a
    case- or suffix-tolerant match on a full address would let a planted look-alike surface as if it were the
    trusted one.
- **`search · no result`** (extension-only): "No contacts match "q"." (O71) + the same tertiary button.
- **`pick`** (from #12, ix:7530): the same screen, with two differences that make the pick a check, not a shortcut (rev 2,
  review H3): each row shows the **full address in groups of four** (`AddressGroups`, `.noc-mono`) under the name in
  place of the drawn "first 4 … last 4"; and a contact that is not `known` (E17) shows, in place of the `.when` text,
  `.noc-caption` `--warning` "You have never sent to this address." (O72). Row tap → back to #12 with the recipient set
  to the address (the draft's amount and token kept; the hand-back is §1.4's `reset`); #12 then runs exactly as after a
  paste (2a's state 6 warning included). The `+` and "Add new contact" still open the sheet; after a save in pick mode
  the new contact is picked.
- **`full`** (200): the `+`, "Add first contact" and "Add new contact" buttons disabled; caption "The address book is full
  (200 contacts)." (O73).
- **`load failed`**: "Could not load your contacts. Try again." (O74) + `[Try again]` (2a).

**Engine:** `contacts.list` (E17); `recipientInfo` is not needed here.

**Differs, loudly:**
- Pull-to-refresh (ix:7375, 7538) dropped: the list is local (2a-D2's refresh button is for network reads).
- Row tap standalone opens the edit sheet, not "tx-detail (#27) filtered by counter-party" (ix:7531; no such filter, D21).
- Swipe actions (ix:7539), the long-press menu (ix:21661) and the undo toast (ix:19109) are not built (the design scopes
  them to v0.3); edit and delete are in the sheet (D20).
- Persistence key `v1_contacts`, not `v1_address_book` (ix:7525; approved design).
- Pick-mode rows show the full address in groups of four and a never-sent warning, not the drawn truncation and date
  (review H3: poisoning works on truncation). The standalone list keeps the drawn rows.
- The system keyboard mock (ix:7497) is the browser's.
- Pick rows label a **known** own account "Your account: <name>" (2a's; review L5) and a **known** fee treasury "Noctura
  treasury" in the date's place — the precedence own > treasury > contact (E17), exact matches only; the design draws no
  such row. The label never replaces or hides O72 (§6.3, D36; Task 5 fix round 1, I1): a pick row that is not `known`
  says O72 whatever it is.
- **Controller ruling (Task 5 fix round 1, M4):** "never" means only "not known". A `known` contact whose `lastSentAt` is
  null (an own account, or a B1b-1 known-recipient entry stored without a time) shows no `.when` text rather than "never".

### 6.2 Contact sheet (`.s8-sheet` derived from #43 / the 2a switcher; D20, C12)

- **`add · prefilled`** (from #20, #27, #12's pick of an unsaved address is not a path): title "Add contact" **→ adapted**
  (ix:7388 aria label); label "Address" (O75) + the full address in groups of four (`AddressGroups`), read-only; label "Name"
  (O76) + input (`maxlength=32`, autofocus); `[Save]` (ix:12143) LockedButton; `[Cancel]` (2a).
- **`never sent`** (rev 2, review H3; any add or edit state for an address that is not `known` — from
  `wallet.recipientInfo` or `contacts.list`): `.noc-caption` `--warning` under the address "You have never sent to this
  address." (O72).
- **`only sent to you`** (opened from #27c `[Save sender]`, the sender not `known`): the line reads instead "You have never
  sent to this address — it only sent to you." (O77).
- **`dust`** (opened from #27c for a transfer below C18's base-unit floor, or one whose amount is `null`, the sender not
  `known`): `.banner.danger` above the name
  field "Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust
  before saving." (O78) + the O77 line; `[Save]` reads "Save anyway" (O79). Not refused: the user may know the sender.
- **`add · empty`** (from #15's `+`, "Add first contact", "Add new contact"): the address is an input (placeholder "Solana
  address" (2a #12), Paste button aria "Paste" (2a)); once valid it is shown in groups of four under the field; the name
  pre-filled with the search query when there is one.
- **`edit`** (row tap, or #27 when already saved): title "Edit contact" (O80); address read-only; name pre-filled; `[Save]`;
  `.btn-tertiary` `--danger` "Delete contact" (O81).
- **`delete confirm`** (inside the sheet): "Delete this contact?" (O82) + `[Delete]` (O83) / `[Keep]` (O84). Delete →
  `contacts.remove` → the sheet closes.
- **errors** (`.field-msg` `--danger`): name `malformed` "Names are 1 to 32 characters, without control characters." (2a
  §5.2) — the rule now also refuses zero-width and format characters (C19), which the sentence's "control characters"
  covers; `duplicate-name` "Another contact already has this name." (O85); address invalid "That is not a Solana
  address." (O86); `full` "The address book is full (200 contacts). Delete one to add another." (O87); `failed` "Something
  went wrong. Try again." (2a).

**Differs, loudly:** the design leaves add/edit/delete undrawn ("placeholder per spec", ix:7532; sm:190); the sheet is
derived (D20). No notes field (D18). The never-sent, only-sent-to-you and dust states are extension additions (review
H3).
- **Approved by the owner (D35, 2026-10-08):** the sheet is tall — up to the popup's height but 48 px, not #43's 70 %, so
  the address being saved, the warnings and "Save anyway" stay in view (**controller ruling under D35**, Task 10: its
  bottom padding is `--space-4`, not #43's `--space-4` + 24 px gesture-bar allowance, which cut "Save anyway" in the
  longest state; §8.4); its actions are Cancel | Save side by side (the
  design's `.sticky-bar.row`), "Delete contact" below; the delete confirm shows the contact's name and address under
  O82; the sheet opens on the element marked `data-autofocus` (the name, or the empty address field); Esc over the sheet
  closes only the sheet, never the screen under it.
- **Owner decisions (D36, D37):** O72 keeps its wording and stays fail closed wherever `known` is false — "known" counts
  only sends this extension confirmed, so a SENT record from another wallet (or from the history) still shows it; names
  with ZWJ, ZWNJ or VS16 are refused (C19).

### 6.3 Hooks: #12, #20, #27, the label (D19, D20, C12)

**The label.** Everywhere a contact names an address the label is "From your address book: <name>" (O88), the parent
spec's "from your address book" (B1 §3) with the 2a "Your account: <name>" form. Precedence own > treasury > contact (E17).
It never replaces or hides the first-send warning.

- **#12 send** (ix:6640-6700; idle state ix:6692): in the **empty** field `.input-actions` holds "Paste" (2a) and "Address
  book" (ix:6652, `#i-book`) → #15 `pick`. The other states keep 2a's actions. For a valid address with
  `label.kind === 'contact'`, a `.noc-caption` line with the label sits above 2a's helper, which is **unchanged** (state 6's
  "Never sent here before" stays for an unknown address, the "sent before" line for a known one).
- **#20 confirm** (first-time state, ix:9382; rows ix:9343-9350): the "To" row's label line shows the contact label when
  saved. While `reasons` has `first-send` **and** the address is not a contact, a `.detail-row` "Save as" (ix:9349) /
  "Add to address book? · Add · Skip" (ix:9350; "Add" `--accent` and "Skip" as two text buttons) — **Add** → the sheet
  prefilled; saved → the row hides and the label appears; **Skip** → the row hides for this #20. Neither touches Send,
  its focus rule (2a §4.5) or the first-time banner; "CTA enabled (banner is informational, not a gate)" (ix:9565) holds.
- **#27 tx detail**: the `.actions-row` (ix:12350) gets a second `.btn-secondary` beside `[Explorer]`: "Save" (27a sent,
  ix:12143) for the recipient, "Save sender" (27c received, ix:12272) for the sender → the sheet prefilled, or the edit
  sheet when already saved (ix:12384). From a received row the sheet opens in `only sent to you` when the sender is not
  `known`, and in `dust` when the received amount is also below C18's floor (rev 2, review H3). The "To"/"From" label (`TxDetail.tsx:195`) adds the contact label. Purchase and
  "other" rows get no button.
- **#31**: the "Connections" group and "Address book · N contacts" (§4.1).
- **#37**: the plan-2 bullet (§5).

**Engine:** `contacts.list` (#27's labels, #20's "is it a contact"), `contacts.set`, `wallet.recipientInfo` (#12, #20).

**Differs, loudly:**
- #10 (vault page) shows no contact label (C12; closed-alphabet fields only). #19 shows none either (not in the owner's
  hook list).
- #26's trailing swipe "Save to address book" (ix:12066), #27's long-press menu (ix:12390) and #40's long-press (ix:15871)
  are not built (no swipe/long-press surfaces in the popup; the button covers #27).
- #20's "first-time check queries the address-book table" (ix:9973) is not followed: first-time is known recipients only
  (D19).
- #39's "…and saved address-book entries" (ix:15525) is not added to #39's copy: a restore keeps contacts (D20).
- #12's Scan QR (ix:6651) stays omitted (2a-D13).
- `[Save sender]` is offered for every received transfer, as drawn (ix:12272), but the sheet it opens warns for a sender
  never sent to, and warns harder for dust (C18). The design offers it with no warning (review H3).
- **Approved by the owner (D35, 2026-10-08):** #27's received "From" row carries the full label (own > treasury >
  contact), not only the contact label; Esc over any open sheet (the contact sheet on #15, #20, #27; the accounts
  manager's remove sheet) closes only the sheet.

---

## 7. Errors and edge cases

| case | where | copy | source |
|---|---|---|---|
| wrong factor | every vault mode | "That did not confirm it." → cooldown "That did not confirm it. Wait a moment before trying again." + "Confirm paused" | COMMON (2a) |
| `busy` (revision moved) | #36, delete, passkey remove | "The wallet changed while you were typing. Start again." + `[Start again]` | RESTORE (2a) |
| revision moved (accounts) | accounts add / remove | no `busy` outcome: the flow runs once more silently (a fresh read and a fresh proof, `accountsFlow.ts` `withProvenSeed`), and a second move is `failed` "Something went wrong." (Task 12 fix round 1 ruling: §7 corrected to the code) | ACCOUNTS (2a) |
| shown address gone (accounts remove) | accounts remove | the envelope no longer holds the shown address at the URL's index (another wallet, or the account changed): the page re-reads and shows what is there now, "The wallet in this browser changed. Check the address and try again." — checked at the click before any KDF or passkey prompt, and on each read the flow proves against; never charged (Task 12 fix round 1, as C17) | O14 (reused) |
| `send-open` (wallet) | delete | "A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again." + "The wallet has been locked. Nothing was deleted." | RESTORE (2a) + O15 |
| `send-open` (account) | accounts remove, manager | "A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again." | → adapted |
| `unlocked` mid-delete | delete | "The wallet was unlocked while this was running, so nothing was deleted. Start again." | RESTORE (2a) |
| `damaged` | every vault mode | "This wallet's stored data is damaged." + damagedHelp; **no delete** (D10) | COMMON (2a) |
| `not-unlocked` | password, passkey remove, reveal, verify, accounts | "The wallet is locked. Unlock it first, then try again." + `[Unlock]` | ACCOUNTS (2a) |
| `mismatch-locked` | same | "That did not match this wallet, so the wallet has been locked." | COMMON (2a) |
| passkey `unsupported` / `failed` | passkey add | PASSKEY (2a) | 2a |
| passkey not usable to confirm | delete, passkey remove, accounts | "This device cannot confirm with a passkey; your password still works." | COMMON (2a) |
| passkey offered to reveal / verify | reveal, verify | none: no passkey button; a `prfOutput` factor is refused at the function boundary (`failed`, PRF zeroed) | D23, E16 |
| wallet changed under the delete tab | delete | "The wallet in this browser changed. Check the address and try again." | O14, C17 |
| `send-open` after delete's lock | delete | + `[Unlock]` → `?mode=unlock` and `[Close this tab]` | 2a, review M1 |
| duplicate contact name | contact sheet | "Another contact already has this name." | O85, C19 |
| saving a never-sent / dust address | contact sheet, #15 pick | O72 / O77 / O78 + "Save anyway" (O79) | review H3 |
| `no-passkey` | passkey remove | "This wallet has no passkey. Nothing was changed." | O25 |
| settings challenge expired (120 s) | #10 settings | "Took too long — try again" + "Nothing was changed. Choose the setting again in Security center." | approved §3 + O40 |
| settings locked mid-confirm | #10 settings | "The wallet locked while you were confirming. Nothing was changed. Unlock it and choose the setting again." | O41 |
| settings save refused | #35 | "Could not save the setting. Try again." | O51 |
| change failed | #36 | "Something went wrong. Your password was not changed." | O07 |
| delete failed | delete | "Something went wrong. Nothing was deleted." | O16 |
| passkey / settings failed | passkey, #10 | "Something went wrong. Nothing was changed." | O26 |
| phrase fact not saved | verify | "All three words matched, but this could not be saved. Try again later." | O32 |
| order stale / failed | manager | "The accounts changed. Try again." / "Could not save the order. Try again." | O55 / O56 |
| contacts | #15, sheet | O71, O73, O74, O86, O87; name rule (2a §5.2) | §6 |
| `locked` anywhere in the popup | all popup screens | the locked screen (2a §7.1); a typed DELETE, a picker choice or a sheet draft is dropped | 2a |
| `coordinator-refused` / `unreachable` | #37 and manager balance reads only | 2a §7.2's banner / "Balance not checked"; nothing else in 2b reads the network | 2a |

**Rule 6.** `LockedButton` on: every #35 picker option, the manager's ↑/↓, rename Save, `[Continue to remove]`, #37's
`[Delete wallet]` hold (the hold itself is the lock: one open per completed hold), the passkey screen's buttons, every
#31 row that opens a page, the sheet's `[Save]` / `[Delete]`, #20's Add/Skip, #27's Save. Vault modes: `exclusive()` with
the 500 ms floor. A component test per control: a second click inside 500 ms and before the promise settles does nothing
(mutation: remove the lock → red).
**Differs (pre-flight G2):** the "Skip" button, #15's `+` and its add buttons ("Add first contact", "Add new contact") are
LockedButtons whose second press is invisible — the first opens a sheet (or leaves), and a second would open the same one —
so their tests assert the lock itself (`disabled` + `is-busy` on the button right after the press) instead of a re-press.

**Memory.** Every vault mode drops fields on `pagehide` and `visibilitychange → hidden`, except #36, which keeps them
through `hidden` and zeroes its held data key on `pagehide`, on leave, after success and at its 5-minute TTL (C20, §3.1); reveal/verify drop the phrase; the PRF output is zeroed on every path (existing flows). No 2b screen puts a word of
the phrase in the popup, in a URL, in storage or in a message.

---

## 8. Testing

### 8.1 Engine and vault-page units (vitest), with named mutations

Each item: the test, then the mutation that must turn it red.
- **E9:** a weakening via `settings.set` → `reauth-required`; `vault.reauthOk` → `{applied:'settings'}` and `settings.get`
  shows the new value; the alarm re-armed with it; a second `vault.reauthOk` with the same id → `unknown-challenge` and
  nothing written twice; an expired id → `unknown-challenge`; locked → `locked`; a send challenge still goes through
  `satisfyChallenge` and applies no settings; a stored settings `about` out of range → `malformed`, nothing written;
  `settings.set` with `challengeId` → `malformed`. Mutations: "don't delete the record on apply" (replay test red);
  "apply any kind" (send test red); "skip the re-parse" (range test red); "keep the challengeId path" (C1 test red).
  **Ordering (review M6):** issue A (weaken), apply B (strengthen), confirm A → `settings.get` shows A's value; confirm A,
  then strengthen B → B's value; mutation "revoke live settings challenges on `settings.set`" → the first red (the rule is
  last-confirmed-wins, not last-chosen-wins). A `{ok:true}` without `data` on a send description → `confirmed`.
- **E10:** `rewrapPassword` → the new wrap opens with the new password and not the old; seed decrypts; cost unchanged;
  salt fresh. Background: accepted exactly when only salt + wrap change; refused (`malformed`) for each of: same salt, same
  wrap, seed ct changed, iv changed, passkey dropped, passkey changed, accounts reordered, a key changed, an account added,
  cost changed, scheme changed; `busy` on a stale revision; `locked` with no session; names carried over;
  `passwordChangedAt` written after. `storeEnvelope` still refuses a password change. Mutation: delete each clause of
  `onlyPasswordChanged` in turn → its refusal test red (one mutation per clause); "skip the self-check" in
  `rewrapPassword` → the corrupted-wrap test red. **Page (review H2):** `isCurrentPassword` → true for the current
  password, false for another, the KEK zeroed both ways; step 2 with the current password shows `step-2 same` and sends
  nothing; `proveCurrent`'s result holds no `mnemonic` field. Mutation: "skip the step-2 check" → the same-password test
  red (a `vault.changePassword` would be sent). **#36 memory (M2 ruling):** hidden → visible keeps step 2 and its fields;
  `pagehide` zeroes the held data key (mutations named in §3.1).
- **E11:** `deleteWallet` sends one `vault.forgetWallet` with neither `replacement` nor `guard`; refuses an unminted or seed
  proof; maps each refusal; a funded wallet is deleted (no guard); `v1_contacts` removed (plan 2), `v1_forbidden_until`
  kept. Source tests: only `screens/delete.ts` imports `deleteWallet`; no other `src/unlock` file names
  `vault.forgetWallet`. Mutation: "add the guard" → the funded-delete test red; "export `forget`" → the source test red.
  **C17 (review M1):** the delete page renders the first account's address from the envelope; a different revision at
  proof time → `changed`, no `vault.forgetWallet` sent (mutation: "skip the revision compare" → red); after `send-open`
  the `[Unlock]` button opens `?mode=unlock`. **Rev 3:** with the wallet replaced under the tab, the old password typed →
  `changed`, the KDF is never called (a spy on `kdf` counts 0) and the backoff is not charged (mutation: "compare after
  `proveFactor`" → red, the outcome becomes `wrong`); the shown address is the lowest `index`'s when the display order
  puts another account first (mutation: "first in display / list order" → red).
- **E12:** `wallet.state.passkey` true/false/false-without-wallet; `vault.removePasskey` removes only `passkey` (every
  other byte identical), refusals `no-passkey`, `busy`, `locked`, `stored-invalid`; partition test. `storeEnvelope`
  refuses a dropped passkey and accepts a replaced one. Page: removal by password and by PRF; mismatch locks; one retry on
  `busy`. Mutations: "write the page's envelope" (other-field test red); "allow drop in storeEnvelope" (C3 test red).
- **E13:** re-add of a removed middle index yields the same public key as before; `index-taken`, `bad-index`; the lowest
  free number pre-filled; `storeEnvelope` → `send-open` when a dropped index has a pending/stuck record, accepted once it
  is closed; an add while a send is open is fine. Mutation: "check pending only for the selected account" → red; "max+1"
  → the re-add test red.
- **E14:** `accounts.order` permutation accepted; duplicates / unknown index / missing index → `malformed` / `stale`;
  `wallet.state` returns that order; a later `accounts.select` and `settings.set` keep `accountOrder`,
  `phraseVerifiedAt` and `passwordChangedAt` (C7). Mutation: `writeSettings` writing three fields → the "select keeps the
  order" test red.
- **E15:** `vault.phraseVerified` sets the time; refused while locked and from the popup; kept by a restore, cleared by a
  delete and a first write; the create run sends it after `setKeys`; a revision other than the stored one is `busy` and
  records nothing (m7: a wallet replaced while #4 was open → O32). Mutation: the revision compare removed → red.
- **E16 (D23):** the accounts flows accept a PRF factor; the PRF output is zeroed on every path. **`runReveal` and the
  verify flow refuse a `{prfOutput}` argument** (cast past the type) with `failed`, read no envelope, decrypt nothing and
  zero the PRF output; their screens render no passkey button with a passkey stored. Mutations: "accept any
  `ReauthFactor` in `runReveal`" → the reveal refusal test red; the same for the verify flow; "render the passkey button
  when stored" → the component test red.
- **E17 (plan 2):** list/set/remove; rename keeps position; 201st → `full`; invalid entries dropped on read; locked →
  `locked` for all three; `recipientInfo` label precedence own > treasury > contact; **parity:** for a table of cases,
  saving a contact never changes `recipientInfo.known` nor prepare's `first-send` reason (mutation: `isKnownRecipient`
  consulting contacts → red); delete wipes, restore keeps, first write wipes; gate fixture for `v1_contacts`. **Review
  H3 / C19:** a second contact named "Binance" for another address → `duplicate-name`, also as "binance" and as the NFKC
  equivalent; renaming a contact to its own name is fine; `cleanName` refuses each of U+00AD, U+200B–U+200F, U+2060–U+2064,
  U+FEFF (and an account rename with one → `malformed`); `contacts.list` carries `known` equal to `isKnownRecipient`.
  Mutations: "compare names case-sensitively" → the "binance" test red; "drop the format-character range" → its test red.
  **Rev 3:** `cleanName` also refuses U+061C, U+180E, U+034F, U+FE0F and a tag character U+E0041 (L5); C18 in base units:
  999 999 lamports → dust, 1 000 000 → not; 9 999 / 10 000 for USDC; 999 999 999 / 1 000 000 000 for NOC; `amount: null`
  → dust (L2); the client reads a missing `known` as `false` (L3). Cross-script "Вinance" vs "Binance" is **accepted** —
  a test pins the stated limit so a future change is a decision, not an accident (L4).
- **Partition** (2a §8.1 form): `vault.changePassword`, `vault.removePasskey`, `vault.phraseVerified` refused from
  `/popup.html`, `/wallet.html` and a web origin; `accounts.order`, `contacts.*` refused from a web origin.

### 8.2 Components (happy-dom)

One test per state of §§3–6 asserting the exact strings (adapted ones in their adapted form), the elements present and
deliberately absent (no score number, no "Never", no Material You, no "Scan QR", no copy button on reveal, no contact
label on #10), and navigation targets. Negative controls: #37's CTA disabled for "DELET", "delete", "DELETE " and before
1 s; a 0.9 s hold opens nothing; Cancel disabled while held; the reveal grid holds no phrase word outside `revealed`; a
`copy` event during `revealed` leaves the clipboard untouched; #20's Send is never focused on mount with the Save-as row
present (2a R2-L4); the Save-as row never appears for a known address; every `LockedButton` above with its lock removed →
red. **Rev 2:** reveal/verify proofs render no passkey button with a passkey stored (D23); the reveal grid's listeners
cancel `selectstart` on the grid and not on the proof field (L5); a backdrop click on the pre-reveal modal closes as
`[Cancel — go back]` (L6); the pick rows show the full address and, for a contact not `known`, O72 (H3); the sheet from a
received non-`known` sender shows O77, and for dust O78 and "Save anyway" (H3); #35's tasks-outstanding state has no
"Active protections" (L7); `index=0` → "Remove Account 1?" (L2); #37 and the delete page show the same first-account
address (C17); the pick hand-back puts the address in #12's field and calls `recipientInfo` (M4).

### 8.3 End to end (Playwright, real extension, contained fake coordinator — 2a §8.5's harness)

Each spec runs in a normal launch **and under `unshare -rn`** (no network namespace), asserts `fake.unexpected` empty,
`hits > 0` where it reads, and the Solscan counter 0.

**Pinned recipes (rev 2, review M3).**
- *Passkey (spec 14).* `const cdp = await ctx.newCDPSession(unlockTab)`; `WebAuthn.enable`; `WebAuthn.addVirtualAuthenticator
  {options: {protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified:
  true, hasPrf: true}}` **before** the first `create()` (PRF is CTAP2-only; `userVerification: 'required'`,
  `passkey.ts:45-53`, needs both UV flags). Plan 1's first E2E task asserts that the pinned Chromium accepts `hasPrf` and
  that a `create()` + `get()` with RP ID `wallet.noc-tura.io` returns PRF output in the contained browser; if it cannot,
  spec 14's passkey step fails (never skips) and the plan reports it.
- *Clipboard (spec 16).* The OS clipboard is not read. In `revealed` the test dispatches Ctrl+C and asserts (a) the `copy`
  event on the grid was `defaultPrevented` (a page-side probe records it) and (b) where `navigator.clipboard.readText()`
  is available **in the unlock tab** (after a sentinel was written there before the reveal), it still returns the
  sentinel; where it is not available, (a) alone plus the manifest check that `clipboardWrite` is absent
  (`check-permissions.mjs`). No `grantPermissions(['clipboard-read'])` for the extension origin.
- *Replays (spec 17, review L10).* A second `vault.reauthOk` is sent **from the `unlock.html` tab's context**
  (`unlockTab.evaluate(() => chrome.runtime.sendMessage({type: 'vault.reauthOk', challengeId}))`) — `VAULT_PAGE_ONLY`
  (`messages.ts:103`) refuses it from any other page, which would prove nothing.
14. **Change password:** a wallet with a passkey (a CDP virtual authenticator with `hasPrf: true`) → #31 → Change password
    → tab: wrong current → error → right → new + meter → the current password again → `step-2 same` → a new one →
    mismatch → confirm → `done` (the tab hidden and shown again between steps 2 and 3 keeps the step, M2); the stored envelope's `seed`,
    `accounts` and `passkey` are byte-identical and `kdf.salt` / `password.wrapped` changed; #31 shows "Just updated" and
    the toast once; lock → the old password fails, the new one unlocks, the passkey unlocks.
15. **Delete a funded wallet:** the fake credits account 0 → a wallet with two accounts, and in the manager account 2
    moved to the top (E14; rev 3, review M1) → #31 → Delete wallet → #37 shows "This wallet holds funds", the balance and
    the address of the **lowest index** (account 1, not the top row) → "DEL" → "3 of 6 characters · keep going" → "DELETE" → Space held 1 s →
    tab shows the same address → wrong password (envelope unchanged) → right password → `?mode=welcome`; `storage.local` holds no `v1_vault`, `v1_settings`,
    `v1_known_recipients`, caches (plan 2: `v1_contacts`). Second run: a send open (fake `expire` mode) → `send-open`,
    vault intact, wallet locked, `[Unlock]` opens `?mode=unlock` (M1). Third run (C17): with the delete tab open, an
    account is added through `?mode=accounts` (same wallet, new revision) → the proof shows `changed`, nothing deleted.
    **Fourth run (rev 3, review L7 — the hard case):** with the delete tab open on an unfunded wallet A, A is replaced by
    wallet B through `?mode=import&source=retry` in another tab → the old tab, given A's password, shows `changed` with
    B's lowest-index address; no `wrong`, no cooldown card; B's envelope byte-identical afterwards.
16. **Reveal:** #31 → Recovery phrase → proof → modal → hold 2 s → the words equal the fixture → 20 s → "Still looking?"
    and no fixture word in the DOM; Ctrl+C during `revealed` is cancelled and leaves the clipboard as it was (the
    clipboard recipe above); → `confirmed` → `[Continue]` → check → success → #35 has no phrase tasks and shows
    "Recovery phrase verified · Yes".
17. **Weakened auto-lock applied once:** #35 → Auto-lock 15 → tab #10 "Auto-lock → 15 minutes" → confirm → `applied`;
    `settings.get` = 15 and the alarm delay 15; replaying `vault.reauthOk` with the same id → `unknown-challenge` and the
    value unchanged (the replay sent from the unlock tab, L10); strengthening to 1 min applies with no tab.
18. **Account remove → re-add:** three accounts → manager → remove account 2 (balance and D16 line shown) → tab proof →
    list shows 1 and 3 → Add account → number pre-filled 2 → the same address as before. Second run: a send open from
    account 2 → `send-open`, envelope unchanged.
19. **(plan 2) Contact is a label, not trust:** a received transfer in the fake history → #27c `[Save sender]` → sheet →
    name → Save → #12 with that address shows "From your address book: <name>" **and** "Never sent here before" → #19 →
    #20 first-time banner → `[Send]` → #10 lists "Re-auth required for the first send to a new address."
    **Negative control (rev 2, review H3):** a received **dust** transfer (below C18's floor) from a look-alike of a
    known address → #27c `[Save sender]` → the sheet shows the dust banner (O78), "…— it only sent to you." (O77) and
    "Save anyway" (O79) → save as "Binance" → a second contact named "binance" for another address is refused
    (`duplicate-name`) → #12 → the book → the pick row for "Binance" shows the full address in groups of four and "You
    have never sent to this address." (O72) → picked → #12 shows state 6's "Never sent here before".
If the pinned Chromium's virtual authenticator cannot produce PRF output, spec 14's passkey step **fails** (it is not
skipped) and the plan reports it (§11 item 9).

### 8.4 Visual pass

`e2e/visual-settings.spec.ts` (plan 1) and `e2e/visual-contacts.spec.ts` (plan 2) shoot every state of §§3–6 at 412 × 600
(popup) and in the 412 px column (tab). An Opus reviewer compares each with its `index.html` frame, then an independent
Opus review checks the first. Per state (2a §8.6's list, plus 2b's):
1. tokens as the DS class map names them (#31 ix:13578-13590, #35 ix:14617-14632, #36 ix:14875-14884, #37
   ix:15102-15112, #15 ix:7507-7516);
2. type tiers; 3. order and grouping; 4. every string is the design's or listed here as adapted/added;
5. every omitted element is on the screen's Differs list; 6. ≥ 48 px controls, no horizontal scroll, sticky bars clear;
7. dark theme only;
8. picker options 32 px visual / 48 px hit (ix:14647); #37's CTA 56 px and the input 48 px (ix:15127);
9. the `--danger` / `--warning` / `--success` metas on #31/#35 exactly where the design tints them;
10. #37's fill and countdown at a mid-hold frame (the test holds and screenshots at ~60 %).
Findings go in the PR; screenshots are CI artifacts.

**Differs, loudly (plan 1's visual pass, Task 20):**
- **The new modes' common states are shared with 2a's pages** (pre-flight F4): `cooldown` (the #9/#10 cooldown card with
  "Confirm paused"), `busy` ("The wallet changed while you were typing. Start again." + `[Start again]`), `not-unlocked`
  ("The wallet is locked. Unlock it first, then try again." + `[Unlock]`) and `mismatch-locked` reuse 2a's markup and
  strings unchanged in every new mode. Shot: `cooldown` once per surface style here (`36-cooldown`) and in 2a's
  `visual-vault.spec.ts` (`09-cooldown`, `10-cooldown`, `10-cooldown-mid`); `not-unlocked` once here
  (`accounts-not-unlocked`); `damaged` and `no-wallet` here (`delete-damaged`, `delete-no-wallet`) and in 2a (`09-damaged`,
  `09-no-wallet`). **Not shot anywhere:** `busy` and `mismatch-locked` — each needs another page to change or swap the
  wallet inside a running proof (a race the E2E cannot hold deterministically); the screen and flow tests assert them
  (`changePasswordScreen`, `deleteScreen`, `passkeyManageScreen`, `accountsScreen`, `revealFlow`, `passwordFlow`). Not shot per mode: the shared states in the other modes (same markup, same strings). #10's own
  `settings-not-unlocked` (O41) is shot (`10-settings-not-unlocked`).
- **Not shot: states reachable only by fault injection** — #35 `setting failed` (O51) and its failed settings read
  ("Something went wrong. Try again." with the top bar), #36 `failed` (O07), the delete page's `failed` (O16), the passkey
  page's `failed` (O26), #10 `settings-failed` (O26), `passkey-unavailable`. Covered by the component tests.
- **Fixed in the pass:** #37's empty DELETE field had no focus indicator (design-ext's `.s7-pw input {outline: 0}`): the
  focused field now takes 37b's accent ring (app.css `.s7-pw:focus-within`); every action bar's line takes the design's
  `margin: 0` (index.html:98, ix:15083) — on #6 manage, #37 and, widened in fix round 0b, 2a's #20, #54, #7 and #40 — the
  UA's paragraph margins made #6 `on`'s bar 261 px of the popup's 600 and hid the lede under it (213 px now); #37's
  countdown is one run beside the icon ("Hold to delete · 0.4 s", ix:15089) — the label's icon gap had set the count 8 px
  apart. Fix round 0b also gave the delete page and the passkey page the top-bar X of spec §3's general rule (the passkey
  page #6's top bar, overline "Passkey", so its hero sits under a bar as #6's does), and the passkey remove page's field
  the vault pages' visible "Password" label.
- **The accounts manager's rows — a question for the owner** (no design, §4.3): five 48 px tools (check, rename, up,
  down, remove) leave the name column about 90 px. Fix round 0b moved the address and balance lines out of that column onto
  their own full-width line under the name and tools (still the select button's description, `aria-describedby`), so
  neither wraps; the name stays beside the tools. Whether this is the layout the owner wants for a screen the design never
  drew is asked at PR time.
- **Keyboard focus can land under the sticky bar** on #37 (412 × 600): the browser scrolls a focused field into the
  content region, which runs under the pinned action bar. The visual pass scrolls each state's element clear of the bars
  first, as a person would (B1b-2a plan 3's `seen()`).
- The 36e toast on the wide tab surface (wallet.html, 1280 × 800): centred on the 412 px column (`left: 50%` of the
  viewport, the column centred), `--space-4` above the tab bar — shot as `36e-password-updated-tab-1280`.
- **`unlock.css`'s `.icon-btn:disabled` also dims 2a's vault buttons** (T20a): the rule added for the new pages' disabled
  top-bar X matches every `.icon-btn` on the vault page, so 2a's icon buttons draw dimmed while disabled too (inside the
  busy gate). It is the popup's rule; 2a's shots are taken with `ready` (enabled) and are unaffected.

**Differs, loudly (plan 2's visual pass, Task 10; `e2e/visual-contacts.spec.ts`, 32 shots after fix round 1):**
- **Fixed in the pass** (app.css, each pinned by a Chromium computed-style or viewport assertion in the visual spec):
  #15 empty — the UA's `h3`/`p` margins (17 px) set the heading and its line apart (the design resets every margin,
  index.html:98), now `margin: 0`; the "+" in "Add first contact" took web's `.empty svg` `--fg-tertiary` and drew grey,
  now the button's ink (ix:7455). #15 pick — O72 drew `--fg-tertiary`: the design's `.s-abook .row .when` out-ranked
  `.noc-warning`; now `--warning` as §6.1 says. The contact sheet (tall) — #43's panel keeps 24 px under its content for
  the phone's gesture bar, which the popup has not; in the sheet's longest state (dust + O87, from #27c with the book
  full) those 24 px cut "Save anyway" to 68 % of its height. The tall sheet's bottom padding is `--space-4`, so D35's
  "Save anyway stays in view" holds in that state too — a **controller ruling under D35** (not an open owner question).
  Fix round 0b: #15's search for a full address — the overline's uppercase drew the address case-folded (the very
  difference the exact search refuses to ignore) and both it and "Add new contact "<address>" →" ran past the column; an
  address query's overline now keeps its case and wraps (`.app-abook-count-addr`); the foot — O71's "No contacts match
  "<address>"." and the add button — wraps (fix round 1, I1: `.app-content` hides overflow, so the address's end was cut).
- **Asserted, unchanged:** `.s-abook .search:focus-within .ic` takes `--accent` (pre-flight G4); `.app-contact-delete`
  is `display: contents` and "Delete contact" spans the Cancel | Save row (Task 4 carry); the dust state's address and
  "Save anyway" wholly in view on open, the banner at 95 % (D35).
- **Fixed in fix round 0b (controller ruling, C1): the focus under a request that is out** (Task 7 carry). Measured in
  Chromium, a focused Cancel, Keep or Save disabled by the request gave the focus to `<body>`; after Keep, Tab then left
  the modal for #15's Back. `Sheet` now holds the focus on its panel (`tabindex="-1"`, drawn without a ring and with its
  own corners) while the control is disabled and gives it back when the control is enabled again (a failed answer);
  Tab from the panel or from outside enters the sheet at its first control. This applies to every `Sheet`, and it is
  **intended** there too: a `LockedButton` disables itself for at least 500 ms on every press (rule 6), and the
  switcher's rename Save and the accounts manager's remove-sheet Continue are LockedButtons inside sheets — so during
  their lock the panel now holds the focus and hands it back when the button is enabled again (before, Chromium dropped it
  to `<body>`, outside the modal). #43 (TokenSheet) has no LockedButton. Pinned by `ui.test`, `ContactSheet.test` and the
  visual spec. (Fix round 1, M1: rev 0b said none of these sheets disables a focused control — wrong.)
- **For the owner (not changed): the sheet's Cancel and Keep** are `.btn-secondary` (`--bg-surface-2`) on the sheet's own
  `--bg-surface-2`, so they draw as text without a container — as the accounts manager's remove sheet (plan 1) does. The
  nearest drawn precedent does the same: #3's pre-reveal modal (ix:4670-4685) puts `.btn-secondary` "Cancel — go back"
  (ix:4683) on `.modal-card`, `--bg-surface-2` (index.html:583-593), with no container; the design draws no secondary
  button on an `.s8-sheet`.
- **Shot in fix round 0b (poisoning):** an exact full-address search beside a planted case look-alike (one row;
  `15-search-exact-address`), an address not in the book (O71's line and the add button wrap inside the column, fix
  round 1, I1; `15-search-address-no-result`), a known contact with no date (no date text; `15-known-no-date`), #15 pick for a never-sent
  treasury address (O72, not "Noctura treasury"; `15-pick-treasury-never-sent`) and for an own account ("Your account:
  Savings"; `15-pick-own-account`). **Covered by unit tests only, not shot:** #12's MAX helper carried through a pick
  and the account switch that ends the flow (Task 6; `Send`/`App` tests).
- **Not shot** (fault injection only; the component tests assert them): #15 `load failed` (O74), the sheet's `failed`
  line; and the transient "request out" states (the sheet's disabled Cancel/Keep), which the spec holds and asserts but
  does not shoot.

---

## 9. Out of scope

- **Not in B1b-2b by decision:** "Never" auto-lock (D1); the app-lock timer (D2); a security score (D3); backup file,
  export and its rows (2a-D17, D4); staking and air-gap rows, the claimable date (D4); a delete path for a damaged vault
  (D10 → B1e); contact notes, import/export (D18); contact = known (D19); Currency, Notifications, Material You, Hide
  balances on lock, Number formatting, RPC, Priority fee, Connected dApps, Air-gap, CSV export, Diagnostics (D22);
  swipe/long-press menus and the undo toast (#15, #26, #27, #40); the passkey in reveal and verify (D23); keeping the
  names of removed accounts (E13, review L3).
- **Accepted limits (rev 2):** wallets created before 2b show both phrase tasks until verified once — there is no fact to
  migrate from (E15, review L4); `accounts.order` is last-writer-wins between two popups (E14, review L9).
- **Accepted limits (owner, 2026-10-08):** a lost #10 reply shows a false "Nothing was changed." (D30); a screen reader's
  browse mode cannot hold #37's button (D31 → revisit in B1e); #31's metas stay blank when `settings.get` fails (D32).
- **Later tracks:** B1c (connected dApps on #31, #37's "dApp connections"); B1d (presale); B1e (privacy policy, damaged-vault
  repair); B2 (shielded variants).
- **Deferred carries, unchanged:** unbounded challenge issuance by privileged pages (the settings pickers are a second
  issuer; still 120 s expiry, still minor); `coordinator-refused` merging live 403 and cool-down; the
  `generateMnemonic`-only import marker.

---

## 10. Where things live (new or changed)

- **Background:** `messages.ts` (`vault.changePassword`, `vault.removePasskey`, `vault.phraseVerified`, `VAULT_PAGE_ONLY`,
  E9's branch); `walletApi.ts` (`wallet.state` +passkey/order, `settings.set` C1, `accounts.order`, `contacts.*`,
  `recipientInfo` label); `settings.ts` (`updateSettings`, the three fields, `writeSettings`); `reauthChallenges.ts`
  (`takeSettingsChallenge`); `accountsStore.ts` (`changePassword`, `onlyPasswordChanged`, `removePasskey`, C3, C5,
  `WalletView.passkey`, E5 step 7 + first write remove `v1_contacts`); `contacts.ts` (new, plan 2).
- **Vault module:** `src/vault/envelope.ts` (`rewrapPassword`, and `isCurrentPassword` beside it — or in `passwordFlow.ts`
  over `unlockWithPassword`; either way it keeps no secret).
- **Shared:** `src/shared/envelopeRules.ts` (`FORBIDDEN_IN_NAME` becomes `/[\p{Cc}\p{Cf}\u034F\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069]/u`, C19).
- **Vault page:** `mode.ts`, `modes.ts`, `strings.ts`; `passwordFlow.ts`, `passkeyFlow.ts` (new); `forgetFlow.ts`
  (`deleteWallet`); `accountsFlow.ts` (index, `send-open`); `reauthFlow.ts` (`applied`); `screens/password.ts` reuse +
  `screens/changePassword.ts`, `screens/delete.ts`, `screens/passkeyManage.ts`, `screens/reveal.ts` (rewritten on
  `seed.ts`'s mechanics), `screens/verify.ts`, `screens/accounts.ts` (rewritten), `screens/reauth.ts` (settings states),
  `screens/createRun.ts` (C8); `unlock.html` sections.
- **UI:** `platform.ts`, `router.ts`, `engine.ts` (`settingsSet`, `order`, `contacts*`, shape checks), `App.tsx`;
  `screens/Settings.tsx` (full #31), `Security.tsx`, `AccountsManager.tsx`, `Passkey.tsx`, `DeleteWallet.tsx`,
  `Contacts.tsx`, `ui/ContactSheet.tsx`, `ui/Picker.tsx`, `ui/HoldButton.tsx`; hooks in `Send.tsx`, `Confirm.tsx`,
  `TxDetail.tsx`; `prefs.ts` (`passwordToastSeen`).
- **CSS / gates:** `src/styles/design-ext.css` (§1.6); `scripts/check-vault-isolation.mjs` (`v1_contacts`) + fixture.
- **E2E:** `e2e/settings.spec.ts` (14–18), `e2e/contacts.spec.ts` (19), the two visual specs; `e2e/launch.ts` virtual
  authenticator helper.

---

## 11. Contradictions found (flagged, not silently resolved)

1. **Approved design §3 vs §1.5 — where the display order and `phraseVerifiedAt` live.** §3 lists "new background keys
   (v1_contacts, display order, phraseVerifiedAt) in BACKGROUND_OWNED_KEYS"; §1.5 puts the display order "in v1_settings".
   **Built:** both are fields of `v1_settings` (already background-owned), so the gate's protection is the same; only
   `v1_contacts` is a new key (C7). The owner may prefer separate keys; nothing else changes.
2. **`v1_address_book` (design ix:7525) vs `v1_contacts` (approved design).** The approved design wins.
3. **#37 hold length** (design 600 ms, ix:14949/15148, vs "the full second" and "0.4 s" at 65 %, ix:15072/15089). D9: 1 s.
4. **#10's `expired` for a settings challenge that is gone before the page loads.** The approved copy "Took too long — try
   again" needs the kind, and `vault.challengeInfo` returns nothing for an unknown id. **Built:** the approved copy where
   the kind is known (the proof outlived the challenge); 2a's send-worded `expired` line otherwise. The window is a tab
   that loads more than 120 s after the tap. The owner may want a kind-neutral line instead.
5. **"Recovery phrase verified" (approved §2) vs #4's "Phrase verified" (ix:5162).** The approved design wins; adapted.
6. **The approved design's "every vault write proves a factor first" vs D17 (reorder, no proof).** No conflict in fact:
   the order is not a vault write (`v1_settings`, E14). Noted so nobody adds a proof.
7. **The approved design's "factor mismatch with the session locks" vs E5's factor proof and `addPasskey`.** Neither
   compares with the session (2a R2-L7, `onboarding.ts:193-206`), so neither can detect a mismatch. **Built:** both stay as they
   are (C11); every other 2b mode compares and locks.
8. **"Write down your recovery phrase" has no completion fact** in the approved engine list (only `phraseVerifiedAt`).
   **Built:** C8 (both phrase tasks follow the one fact; the create path records it). The owner may prefer a separate
   "revealed" fact.
9. **E2E spec 14 ("passkey still works") needs a PRF-capable virtual authenticator**, which the harness does not have yet
   (no `WebAuthn.addVirtualAuthenticator` in `e2e/`). Unverified whether the pinned Chromium supports `hasPrf` for an
   extension origin with RP ID `wallet.noc-tura.io` in the contained browser. Plan 1's first E2E task must check it; the
   spec fails rather than skips. Rev 2 pins the recipe (§8.3, review M3); the support itself is still unverified — **the
   one finding-adjacent item this revision cannot close on paper**.
10. **36e on #31 vs the vault tab.** The approved design puts "Password updated" / "Just updated" on #31; nothing in the
    approved engine list carries that across the tab. **Built:** C10 (`passwordChangedAt`, a background fact) — a field the
    approved list does not name.
11. **#39's design text** says a restore wipes "saved address-book entries" (ix:15525); D20 keeps contacts on restore. D20
    wins; #39's merged copy already does not mention the address book (2a §3.11), so it stays true.
12. **2a's #10 settings confirmation** ("Confirmed. You can close this tab.", owner-confirmed in 2a) vs D6's "says it was
    applied". Replaced by O39.
13. **`isAbout` checks a settings `about` only for `isIntOrNull`** (`reauthChallenges.ts:72`), not the 1–60 / 100–100 000
    ranges `parsePatch` enforces. Not a live hole (only the background writes `storage.session`), but E9 re-checks the range
    before applying rather than trusting the stored record.
14. **(rev 2, review H1) Approved design §1.7 vs D8/C4.** §1.7 carried the passkey into the reveal mode; D8 and C4 keep a
    passkey holder from the password and from enrolment on the ground that the passkey must not take over the wallet — and
    the phrase is more than either. **Resolved by the owner: D23** — reveal and verify are password-only; the carry lands
    in `accounts` only. A deviation from the approved design, recorded in the decision table.
15. **(rev 2, review H2) #36 `step-2 same` vs #36's memory rule.** The state needed the old password after the spec dropped
    it. **Resolved:** `isCurrentPassword` — one Argon2id unwrap with the stored salt, no secret kept (E10, §3.1).
16. **(rev 2, review M5) "The only door" for a password change.** Not true of the background: `vault.forgetWallet` +
    `replacement` (#39) also replaces the password wrap, and drops the passkey. **Resolved:** E10's argument reworded; the
    passkey loss after a restore declared on #31 and #35.
17. **(rev 2, review M2) 2a's field rule vs #36.** 2a empties vault-page fields on `hidden`; #36 would send every
    password-manager user back to step 1. **Ruled:** #36 keeps its fields and held key through `hidden` and drops them on
    `pagehide`, on leave and after success; every other mode keeps 2a's rule. **Bounded in rev 3 (review-2 H1, C20):** the
    unbounded version let a hidden, proven tab outlive the user's attention for as long as the popup kept the session
    alive; the key and fields now live at most 5 minutes, renewed by keystrokes in steps 2–3, re-checked on `visible`
    and before every step and send.
18. **(rev 3, review-2 M1) "First account" read in two orders.** #37 reads `wallet.state` (display order, E14), the page
    reads the envelope (stored order). **Resolved:** the lowest `index` on both sides, never position (C17).
19. **(rev 3, review-2 M2) C17's compare vs the KDF.** Compared after `proveFactor`, a replaced wallet would answer
    `wrong` (charged to the backoff) and `changed` would be unreachable in the case it exists for. **Resolved:** the
    revision is compared at the click, before any KDF run; `changed` is never charged (C17).
20. **(rev 3, review-2 L4) The duplicate-name check vs confusables.** NFKC + case-folding does not merge cross-script
    look-alikes. **Accepted and stated** in C19; the full address in pick rows is the defence for addresses.

### Revision 3 — where each review-2 finding landed

| finding | resolution |
|---|---|
| H1 #36 hidden tab unbounded | C20: 5-minute TTL from the step-1 proof, renewed by each keystroke in steps 2–3; zeroed + `dropped` at the deadline, re-checked on `visible` and before every step and send; tests named, mutation "no TTL → red" (§3.1, §7, §11 item 17) |
| M1 "first account" in two orders | C17: lowest `index` on both sides, never display order (§3.2, §5); E2E 15 reorders before the address assertion; unit mutation |
| M2 compare before the KDF | C17 and §3.2: re-read + `envelopeRevision` at the click before any Argon2id/PRF run; `changed` never charged to the backoff; kdf-spy test + mutation |
| L1 step-2 check and the backoff | §3.1: never charged, no cooldown on step 2 |
| L2 C18 base units, `null` | C18 floors as base-unit integers compared with `BigInt`; `amount: null` → dust (fail closed); boundary tests |
| L3 `known` shape | E17: the client requires a boolean and reads a missing field as `false` |
| L4 confusables | C19 states the cross-script limit loudly; a test pins it |
| L5 hand list vs categories | C19, §10: `\p{Cc}\p{Cf}` with the `u` flag (+ U+034F, U+FE00–U+FE0F, category Mn) |
| L6 stale "Active protections" sentences | §4.2: Locks row metas spelled out; `strengthening` updates the Locks meta |
| L7 E2E 15 hard case | Fourth run: the wallet replaced under the tab → `changed` with the new address, no `wrong`, no cooldown |

### Revision 2 — where each review finding landed

| finding | resolution |
|---|---|
| H1 passkey reveals the seed | Owner: **D23** — reveal and verify password-only; E16 narrowed to `accounts` (+ passkey remove, delete, sends); §1.2, §3.4, §3.5 lose the passkey button; function-boundary refusal + mutations (§8.1); §11 item 14 |
| H2 `step-2 same` unbuildable | `isCurrentPassword` (one Argon2id unwrap, stored salt, nothing kept) + `step-2 checking`; `proveCurrent` drops `proven.mnemonic`; mutation "skip the step-2 check" (E10, §3.1, §8.1) |
| H3 poisoning via Save sender | All five mitigations: never-sent line on the sheet (O72) and on pick rows; "only sent to you" (O77) and the dust banner + "Save anyway" (O78, O79; floor C18); duplicate names refused (C19, O85); full address in pick rows; E2E 19 negative control |
| M1 delete binds no wallet | C17: #37 and the delete page show the first account's address; the page re-checks the revision at proof time (`changed`, O14); `[Unlock]` + `[Close this tab]` after `send-open` |
| M2 #36 drops on hidden | Ruling: keep through `hidden`, drop on `pagehide` / leave / success; declared in §3.1 Differs and §7; component tests named |
| M3 E2E recipes | §8.3 pinned recipes: CTAP2 virtual authenticator with UV + PRF; clipboard via `defaultPrevented` + in-tab sentinel, no OS clipboard; replay from the unlock tab |
| M4 pick hand-back | §1.4: `reset` with the address in the `send` route's `draft`; #12 treats it as a paste; test + mutation |
| M5 "only door" | E10 reworded; restore named as the other door; passkey loss after restore declared (§4.1, §4.2) |
| M6 concurrent settings challenges | E9: last confirmed proof wins, no revocation; #35 always shows the stored value; tests both orders + mutation |
| L1 passkey remove `busy` | E12 and §3.3 agree: `busy` + `[Start again]` after the one retry |
| L2 0-based index | §1.2 and §3.6: `index` is the envelope's field, the title shows `index + 1`; test `index=0` → "Remove Account 1?" |
| L3 lost name on re-add | Declared (E13, §3.6, §4.3, §9) |
| L4 migration | Declared (E15, §9) |
| L5 document-wide `selectstart` | Listeners scoped to the grid, mounted only in the grid states (§3.4) |
| L6 pre-reveal backdrop | Built: backdrop click = `[Cancel — go back]` (§3.4) |
| L7 Active protections on 35a | Built faithfully: shown on the all-clear state only (35b), as drawn (§4.2) |
| L8 homoglyph claim | C19: `cleanName` refuses zero-width and format characters; the claim narrowed ("not otherwise normalised") |
| L9 order last-writer-wins | Stated (E14, §9) |
| L10 replay context | §8.3: replay sent from the `unlock.html` tab |
| L11 "1 to do" | O43 now lists "1 to do" / "N to do" for the owner |
| Review §8 (a), (b) | Delete and accounts pages read public fields via `readLocal.ts` before the proof; `{ok:true}` without `data` stays `confirmed` (E9) |

---

## 12. Owner copy to confirm (every controller addition; renumbered in rev 2)

Numbered in order of first appearance. Rev 2 added seven strings (review H3 and M1) and dropped one ("Not yet", no
longer used: "Active protections" shows only on the all-clear state, review L7).

| id | string | where |
|---|---|---|
| O01 | "Continue" (the word exists in 2a's strings; listed for its new uses) | #36 steps 1–2, reveal and verify proof |
| O02 | "That is your current password. Choose a new one." | #36 step 2 |
| O03 | "Change password" (button) | #36 step 3 |
| O04 | "Updating your password…" | #36 `changing` |
| O05 | "You can close this tab." | #36, passkey, verify success |
| O06 | "Your passkey still works." | #36 `done` |
| O07 | "Something went wrong. Your password was not changed." | #36 |
| O08 | "Keep changing" | #36 cancel modal |
| O09 | "Cancel change" | #36 cancel modal |
| O10 | "Enter your current password again." | #36 `dropped` |
| O11 | "This wallet's first account" | #37 and delete mode (C17) |
| O12 | "Enter your password to delete this wallet from this browser. Your funds stay on Solana; your recovery phrase still controls them." | delete mode |
| O13 | "Deleting…" | delete mode |
| O14 | "The wallet in this browser changed. Check the address and try again." | delete mode `changed` (C17) |
| O15 | "The wallet has been locked. Nothing was deleted." | delete `send-open` |
| O16 | "Something went wrong. Nothing was deleted." | delete `failed` |
| O17 | "Replace your passkey" | passkey replace |
| O18 | "The new passkey replaces the one this wallet uses now. The old one stays in your passkey manager until you delete it there." | passkey replace |
| O19 | "Passkey replaced." | passkey replace |
| O20 | "Remove your passkey" | passkey remove |
| O21 | "Confirm with your password or with the passkey itself. Your password keeps working." | passkey remove |
| O22 | "Removing the passkey…" | passkey remove |
| O23 | "Passkey removed." | passkey remove |
| O24 | "It is still saved in your passkey manager (Google, Apple or your password manager). Delete it there if you no longer need it." | passkey remove |
| O25 | "This wallet has no passkey. Nothing was changed." | passkey remove |
| O26 | "Something went wrong. Nothing was changed." | passkey, #10 settings |
| O27 | "Show your recovery phrase" | reveal proof |
| O28 | "Enter your password first. Nothing is shown until you press and hold." | reveal proof |
| O29 | "Nothing is shown. You can close this tab." | reveal cancel |
| O30 | "Verify your recovery phrase" | verify proof |
| O31 | "Enter your password, then pick three words from your written copy." | verify proof |
| O32 | "All three words matched, but this could not be saved. Try again later." | verify |
| O33 | "Add an account" (title) | accounts add |
| O34 | "Account number" | accounts add |
| O35 | "Adding a number this wallet had before brings back the same address." | accounts add |
| O36 | "That account is already in this wallet." | accounts add |
| O37 | "That is not an account number." | accounts add |
| O38 | "Remove Account N?" | accounts remove |
| O39 | "Confirmed. The change is saved — you can close this tab." | #10 settings `applied` |
| O40 | "Nothing was changed. Choose the setting again in Security center." | #10 settings expired |
| O41 | "The wallet locked while you were confirming. Nothing was changed. Unlock it and choose the setting again." | #10 settings |
| O42 | "**Tip** — add a passkey to unlock with your fingerprint, face or security key. Your password always works too." | #31 tip |
| O43 | "1 to do" / "N to do" (the singular form too, review L11) | #31 Security center meta |
| O44 | "All done" | #31 Security center meta |
| O45 | "Not verified" | #31 Recovery phrase meta |
| O46 | "Verified" | #31 Recovery phrase meta |
| O47 | "A longer time asks for your password in a new tab." | #35 auto-lock card |
| O48 | "Re-authentication threshold" | #35 row + card title |
| O49 | "Ask for your password before sends worth more than" | #35 threshold card |
| O50 | "A higher amount asks for your password in a new tab." | #35 threshold card |
| O51 | "Could not save the setting. Try again." | #35 |
| O52 | "Move <name> up" (aria) | manager |
| O53 | "Move <name> down" (aria) | manager |
| O54 | "Remove <name>" (aria) | manager |
| O55 | "The accounts changed. Try again." | manager |
| O56 | "Could not save the order. Try again." | manager |
| O57 | "Remove <name>?" | manager sheet |
| O58 | "Holds <amounts> · <USD>" | manager sheet |
| O59 | "Holds no funds" | manager sheet |
| O60 | "Balance not checked" | manager sheet |
| O61 | "Continue to remove" | manager sheet |
| O62 | "You can unlock and confirm with it. A wallet has one passkey: a new one replaces this one." | passkey screen `on` |
| O63 | "Removing it here does not delete it from your passkey manager." | passkey screen `on` |
| O64 | "They stay on Solana. Only your recovery phrase reaches them after this." | #37 `funded` |
| O65 | "Balances could not all be checked — this wallet may hold funds." | #37 |
| O66 | "Type DELETE exactly — it is case-sensitive." | #37 `partial` |
| O67 | "today" | #15 when |
| O68 | "yesterday" | #15 when |
| O69 | "last year" | #15 when |
| O70 | "N years ago" | #15 when |
| O71 | "No contacts match "q"." | #15 search |
| O72 | "You have never sent to this address." | contact sheet; #15 pick rows |
| O73 | "The address book is full (200 contacts)." | #15 `full` |
| O74 | "Could not load your contacts. Try again." | #15 |
| O75 | "Address" (label) | contact sheet |
| O76 | "Name" (label) | contact sheet |
| O77 | "You have never sent to this address — it only sent to you." | contact sheet from #27c |
| O78 | "Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving." | contact sheet, dust (C18) |
| O79 | "Save anyway" | contact sheet, dust |
| O80 | "Edit contact" | contact sheet |
| O81 | "Delete contact" | contact sheet |
| O82 | "Delete this contact?" | contact sheet |
| O83 | "Delete" | contact sheet |
| O84 | "Keep" | contact sheet |
| O85 | "Another contact already has this name." | contact sheet (C19) |
| O86 | "That is not a Solana address." | contact sheet |
| O87 | "The address book is full (200 contacts). Delete one to add another." | contact sheet |
| O88 | "From your address book: <name>" | #12, #20, #27 label |
| O89 | "1 outstanding task." (owner, 2026-10-05, plan-1 review) | #35 card, the singular of "N outstanding tasks." |
| O90 | "Close" (aria) (owner, 2026-10-05, plan-1 review) | the vault page's ✕ on #36 (`cp-x`) and the reveal/verify proof (`pp-x`) |
| O91 | "Updating your password" (aria, on the progress element) (owner, 2026-10-05, plan-1 review) | #36 `changing` |
| O92 | "1 contact" (owner, 2026-10-08, plan-2 review) | #31 Address book meta, the singular of "N contacts" (D34) |

**92 strings** (O01–O66 plan 1; O67–O88 plan 2; O89–O91 plan 1, added by the owner on 2026-10-05 after the plan-1 review; O92 plan 2, added by the owner on 2026-10-08 after the plan-2 review). Adapted design strings (marked **→ adapted** in §§3–6) are
not repeated here; the owner sees them in each screen's section.

---

## 13. Self-review

- **States covered: 150** (rev 2; every state named in §§3–6, outcome states included): #36 19 (+`step-2 checking`);
  #37's proof 13 (+`changed`); passkey mode 25 (add 7, replace 7, remove 11); reveal 14; verify 6; accounts mode 21 (add
  idle and adding, 13 outcomes; remove idle and removing, 3 more outcomes; unknown-index); #10 settings kind 4 new; #31 5;
  #35 10; accounts manager 5; passkey screen 2; #37 8; #15 7; contact sheet 7 (+`never sent`, `only sent to you`,
  `dust`); hooks 4 (#12 icon, the label, #20 "Save as", #27 Save / Save sender).
  **Design frames:** all 28 drawn states the survey counts, plus #4's four, are built or declared — #31 31a/31c built, 31b declared (§4.1);
  #35 35a–35d (ring, staking and air-gap parts declared); #36 36a–36e; #37 37a–37c; #6 (manage derived); #3's five; #4's
  four (§3.5); #15's three; #12 idle, #20 first-time, #27a, #27c — plus the undrawn #6 manage, seed-verify and contact sheet.
- **Placeholders:** none; every state has copy, an engine source and a destination.
- **Engine claims checked against code:** every file:line above was read on `main` 2c9d88b.
- **Ambiguity left for the owner:** C1–C20, §11 items 1, 4, 8, 9, 10, and §12 (88 strings).
- **Rev 3 checks.** Every review-2 finding is in §11's "Revision 3" table and in the section it names. No new owner copy:
  the TTL reuses `dropped`'s O10, and `changed` keeps O14. States unchanged at 150 (the TTL is a new way into `dropped`,
  not a new state).
- **Rev 2 checks.** Every finding of review 1 is in §11's "Revision 2" table. D23 removed the passkey from every place
  that rendered or tested the phrase: §1.2 rows, §3.4, §3.5, E16, §7's passkey row, §8.1/§8.2 (grep for "Confirm with
  passkey" now hits only delete, passkey remove and accounts). The one open item is §11 item 9: whether the pinned
  Chromium's virtual authenticator yields PRF output — a fact only plan 1's first E2E task can establish.
