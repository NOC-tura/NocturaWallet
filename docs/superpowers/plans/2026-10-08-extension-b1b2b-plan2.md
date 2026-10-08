# Noctura Extension B1b-2b · Plan 2 — the address book (E17, #15, the contact sheet, the hooks on #12, #20, #27, #31, #37) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 2 (2026-10-08):** Fable 5.1 review 1 applied — H1, M2, M3, L1–L10; M1 is an owner decision, pending (Scope 3.10). Where each landed: "Review 1" at the end. The dry run was re-run for every changed task and the full end state (Dry-run record).

**Goal:** Build spec §12's plan 2 of B1b-2b ("address book"): the engine extension E17 (`v1_contacts`, `contacts.list` / `contacts.set` / `contacts.remove`, the contact label) with C12, C18 and C19; #15 address book in its three design states and the extension's (search · no result, pick, full, load failed); the contact sheet (an `.s8-sheet` like #43); the hooks — #12's contact icon and the pick hand-back, #20's "Save as" row, #27's [Save] / [Save sender], #31's Connections › Address book, #37's plan-2 bullet, and the "From your address book: <name>" label on #12, #20 and #27; E2E spec 19 with its negative control; the visual pass of every plan-2 state.

**Architecture:** The background (`src/background/`) stays the only writer of `storage.local`: one new background-owned key, `v1_contacts`, behind its own mutex, three privileged messages refused while locked, wiped by a delete and kept by a restore through plan 1's single `WALLET_DATA_KEYS` list. **A contact is a label, never trust (D19):** "known" stays E6's one rule — now `recipientFacts`, which reads no contact — so the first-send re-authentication fires for a saved address exactly as before; the address book adds warnings instead (never sent, only sent to you, dust) and a full address in every place an address is chosen. The popup (React 18, `src/app/`) gets one screen (`Contacts.tsx`), one shared sheet (`ContactSheet.tsx`) and hooks in four existing screens; it never names the storage key and reaches the book only through `engine.contacts*`. The vault page is untouched (it renders no contact name, C12).

**Tech Stack:** TypeScript 5 strict, React 18, Vite, Vitest + happy-dom + Testing Library, Playwright (contained: `ctx.route` + `--host-resolver-rules`).

**Spec:** `docs/superpowers/specs/2026-10-05-extension-b1b2b-settings-security-design.md` (rev 3 + D24–D33; O01–O91 owner-confirmed) — §1.4 (the `contacts` route and the pick hand-back), §1.5 (partition, `BACKGROUND_OWNED_KEYS`), §1.6 (`.s-abook`), §2 E17, §5 (the plan-2 bullet), §6.1–§6.3, §7, §8.1 (E17, Partition), §8.2, §8.3 spec 19 (and spec 15's `v1_contacts`), §8.4, §11 items 2 and 20, §12 O67–O88; D18–D21, C12, C18, C19. Plan 1 (merged, PR #107, f183069): `docs/superpowers/plans/2026-10-05-extension-b1b2b-plan1.md`, its Scope §2 (the seams plan 2 uses). Design (binding): `/home/user/Downloads/index.html` + `screen.md` — #15 (ix:7372-7552), #12 (ix:6640-6700), #20 (ix:9343-9350), #27 (ix:12143, 12272, 12350), #31 (ix:13552), #37 (ix:14981); the contact sheet is undrawn ("placeholder per spec", ix:7532; D20).

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

- **Mutations:** `git archive HEAD | tar -x -C "$(mktemp -d <scratch>/mut.XXXXXX)"`, `node_modules` linked FROM the copy (or copied with `cp -a`), every run under `timeout 300`. A mutation that does not compile (`tsc`) or does not build is INVALID, not red. Never `git worktree`, never the repository's own files or its `node_modules`, never `pkill` with a pattern that can match your own shell (the dry run's own `pgrep -f <scratch path>` matched the shell that ran it — kill by task id or exact PID only).
- **Rule 6:** every save/delete/open control is a `LockedButton` (popup). Tests lift `disabled` before the second click (happy-dom drops clicks on disabled buttons); where a second press is indistinguishable from the first (opening a sheet that is already open), the lock itself is asserted (`disabled` + `is-busy` on the tap).
- **Every async path checks its generation / `alive` after each await** (unmount, account switch, lock): the sheet's save, delete and `recipientInfo`; #15's list read; #20's and #27's book reads — each pinned by a test that makes the late answer observable (a late `locked` would call `reload()`; the test counts the `wallet.state` read it would cause).
- **`extension/src/styles/design-ext.css` is generated only** (Task 5 regenerates it with the extraction script and re-pins the hash); `src/app/app.css` is hand-written.
- **Address poisoning is this plan's threat model:** every path that can put an address into the book or take one out of it shows the full address in groups of four and says what the wallet knows about it (Scope §4).
- **E2E is deterministic in a normal launch AND under `unshare -rn`.** The popup starts offline under `unshare`: a spec that needs #11's numbers waits for them before it navigates. Playwright selects by `-g '(^|\s)NN · '` (the title path includes the file name).
- **Visual pass:** every state asserts its own copy before its shot; a popup state `toBeInViewport` clear of the pinned bars, a sheet state inside the sheet's panel. happy-dom lacks `:focus-within` and `color-mix`: computed style is asserted in Chromium.
- **Copy:** only O01–O91, 2a's approved strings and the design's own strings (the spec quotes each); anything else is flagged (Scope 3.1).
- CLAUDE.md: the design is binding — every scope-down is stated (Scope 3); TypeScript strict, no `any`, no `@ts-ignore`; no placeholders; BigInt base units (C18); UTC in data, local only at the UI ("when"). Prettier style of the surrounding code: single quotes, trailing commas, no spaces inside braces, no parens around a single arrow parameter.

## Scope — what plan 2 builds, how it uses plan 1's seams, every departure, and where the trust boundary sits

### 1. Plan 2 builds

- **Engine (Tasks 1–2):** C19's `cleanName` (contacts and accounts); E17 — `src/background/contacts.ts`, `contacts.*` (privileged, refused while locked), `recipientFacts` (E6's one rule, read once), the `contact` label with precedence own > treasury > contact, `v1_contacts` in `WALLET_DATA_KEYS` (wiped on delete and on a first write, kept on restore) and in `BACKGROUND_OWNED_KEYS`; #37's plan-2 bullet.
- **UI client (Task 3):** `engine.contacts` / `contactSet` / `contactRemove` (a missing `known` reads `false`), the `contact` label, the `contacts` route (`pick` only), `addressBook.ts` (C18 in base units, "when", search, avatar, the counts).
- **The contact sheet (Task 4)**, **#15 (Task 5)** with #31's row and the regenerated design-ext, **the hooks (Tasks 6–8)**: #12 (icon, hand-back, label), #20 (label, Save as), #27 (Save / Save sender, labels).
- **E2E (Task 9):** spec 19 ×2 (the positive run and the negative control); spec 15 asserts `v1_contacts` is wiped. **Visual pass (Task 10).**

### 2. Plan 1's seams, used as plan 1 laid them

- **The wipe list.** Plan 1 made `WALLET_DATA_KEYS` (`accountsStore.ts`) the one list a delete and a first write remove, and said "plan 2 adds v1_contacts (E17) here". Task 2 adds `CONTACTS_KEY` to it and changes nothing else in `forgetWallet` or `storeEnvelope`: a delete (no replacement) and a first write wipe the book; a restore keeps it (D20). Spec 15's `WIPED` list gains `'v1_contacts'` (Task 9).
- **#37's bullet** (`DELETE_TEXT.bulletErased`) switches to §5's plan-2 wording in the task that adds the wipe (Task 2).
- **`settingsMutex` is not used:** contacts have their own key and their own mutex (plan 1 Scope §2). Lock order: the contacts mutex, then `sessionMutex`; nothing takes them the other way round.
- **C19** widens `FORBIDDEN_IN_NAME` for contacts and account names together (Task 1).
- **The design-ext pin** (`designExt2b.test.ts`) is re-run and re-pinned in the task that regenerates the file (Task 5) — a red pin there is expected.

### 3. Departures (each loud; each is in the spec's Differs or §11 unless marked NEW)

1. **NEW — copy not in O01–O91: "1 contact"** — #31's Address book meta for one contact. The design draws "7 contacts" (ix:13552) and §4.1 says "N contacts"; "1 contacts" is wrong English, so the plan uses the singular, as plan 1 did for "1 outstanding task." (then confirmed as O89). **Flagged for the controller / owner.** (#15's "1 result for "q"" is the spec's own adapted singular, §6.1.)
2. **NEW — the contact sheet is `tall`:** its panel may take the popup's height but 48 px, not the design's 70 % (`.s8-sheet { max-height: 70% }`). At 70 % the dry run's visual pass found the body scrolled and the focused name field pushed **the address being saved** out of view in the dust state — a poisoning-relevant layout bug. Task 10 asserts the address, the dust banner and "Save anyway" are all in view on open.
3. **NEW — the sheet's actions are Cancel | Save side by side** (the design's `.sticky-bar.row` pattern), with "Delete contact" below on the edit sheet and Keep | Delete in its confirm. Stacked, the dust state still ran past the panel. The sheet is undrawn (D20); #43 has no action row to copy.
4. **NEW — the delete confirm also shows the contact's name and address** under "Delete this contact?" (O82) — what is about to go; no new copy.
5. **NEW — #27's received "From" row gets the full label** (own > treasury > contact), not only the contact label: §6.3 says the To/From label "adds the contact label"; giving the received From row the own/treasury labels too keeps one rule on both rows. 2a's received From row had no label.
6. **NEW — Esc over an open sheet closes only the sheet.** App's Esc handler popped the pushed screen under any sheet (a double action). It now leaves Esc to an open modal dialog — on #15, and also on plan 1's accounts manager remove sheet, which had the same double action (pinned on that surface too, review M3). #20's own Esc is paused while its contact sheet is open.
7. **NEW — the shared `Sheet` opens on `data-autofocus`** when its content marks an element (the contact sheet's name, or the address field when empty); React's `autoFocus` ran before the Sheet's own focus effect and was overridden. Sheets without the marker focus their first control as before.
8. **Rule 6 where a second press is invisible:** #20's Add, #27's Save, #15's `+` and every add button are LockedButtons; for Add and Save the lock itself is asserted. #15's `+` / add buttons (each opens the one sheet) and #20's **Skip** (it hides its own row on the tap) have no test of their own — no test can tell a lock from none there. **#15's rows are plain buttons** (review L9): a double tap on a standalone row opens the same edit sheet, on a pick row runs the same `reset` — idempotent, so not LockedButtons.
9. **NEW — #15's `+` is disabled while the list loads or failed to load** (and when full, as specified): an add with an unknown count could not say "full" before the save.
10. **Owner decision pending (review M1) — the never-sent line on #27a under a "SENT" record.** `known` is `v1_known_recipients`, written only by a send this extension confirmed, so a send made by another wallet with the same seed (or before B1b-1's list existed) opens #27a's sheet with "You have never sent to this address." under a SENT transaction. **The line stays (fail closed):** a SENT row not in that list is another wallet's send **or a history row the coordinator served that this extension never produced** — a fabricated or replayed SENT row must never make the sheet look reassuring, so the history never feeds `known` under any variant. What the owner is asked is only the **wording** for that case (e.g. "This extension has never sent to this address.", true in both cases) — new copy, an owner string. Until the answer, O72 is built as written; if a new string is approved before Task 4 starts, it replaces O72 in `CONTACT_TEXT.neverSent` and in #15's pick rows.
11. **Spec items built as written, declared in §6's Differs:** no pull-to-refresh (the list is local); the standalone row tap opens the edit sheet, not a filtered #27 (D21); no swipe actions, long-press menu or undo toast; persistence key `v1_contacts`, not `v1_address_book`; pick-mode rows show the full address and O72, not the drawn truncation and date; #10 and #19 show no contact label; #26's swipe and #40's long-press "Save to address book" are not built; #20's first-time check stays known-recipients only (D19); #39's copy does not gain "…and saved address-book entries" (a restore keeps contacts); #12's Scan QR stays omitted (2a-D13); `[Save sender]` is offered for every received transfer, with the warnings.
12. **Owner notes, no change (review L4, L10).** C19's `\p{Cf}` refuses ZWJ, ZWNJ and VS16, so "Bistro ❤️", a ZWJ emoji family and Persian or Indic names that need U+200C get 2a's name line, which does not say why — a second line would be new copy (L4). #20 and #27 choose add or edit from the book read at mount; an Add tapped after the same address was saved in another window renames that contact (`contacts.set` renames in place) — two windows, seconds apart, a label never trust; recorded so it is not mistaken for a hole (L10).
13. **Not shot** in the visual pass (fault injection only; asserted by the component tests): #15 `load failed` (O74), the sheet's `failed` line.

### 4. The trust boundary — no address becomes "known"; where every address enters or leaves the book

Contacts are not secrets; they are background-owned (`v1_contacts` in `BACKGROUND_OWNED_KEYS`: no popup, tab or vault-page file may name the key), refused while locked (C12), and never reach the vault page (#10 renders closed-alphabet fields only). **No path makes a saved address "known":** `known` is `recipientFacts` (own accounts + `v1_known_recipients`, written only by a confirmed send) — it reads no contact; the parity test and mutation M2a / M9a (a contact made known) hold it, in units and in the real extension.

| path | the address comes from | what the user sees before it is saved / used |
|---|---|---|
| #15 `+` / "Add first contact" / "Add new contact "q"" (Task 5) | typed or pasted | O86 while it is not an address; once valid, the full address in groups of four and O72 unless `recipientInfo` answers `known: true` (shown until it answers) |
| #20 "Save as" → Add (Task 7) | the prepared send's recipient (always first-time) | the full address, O72 |
| #27a [Save] (Task 8) | the decoded history's counter-party | the full address, O72 unless known (see Scope 3.10) |
| #27c [Save sender] (Task 8) | the decoded sender | the full address, O77 unless known; below C18's floor (or undecodable) the danger banner O78 and "Save anyway" |
| #15 pick → #12 (Tasks 5–6) | a saved contact | the pick row: the full address in groups of four and O72 unless known; #12 then runs as for a paste — "Never sent here before", state 6's banner and groups, and the first-send re-authentication on #10 |
| the label on #12 / #20 / #27 (Tasks 6–8) | exact address match only | always prefixed "From your address book:", never above own or treasury; never replaces "Never sent here before" |

Names are user text: `cleanName` refuses every control and format character (C19), two contacts may not share a name after NFKC + case-folding (C19; cross-script look-alikes are the stated, test-pinned limit), React renders them escaped, and the vault page never shows one.

## How to read the steps

- A **new file** is given in full. A **changed file** is a unified diff against the file as the previous task left it; save the block and apply it with `git apply --recount` from the repository root (or by hand — every hunk is exact). `app.css`, `App.tsx`, `addressBook.ts`, `engine.ts` and several test files grow task by task, so their diffs apply in task order.
- Commands run from `extension/` unless they start with `cd`. "Whole suite" is `npx tsc --noEmit && npx vitest run`. The expected totals are the dry run's task-by-task replay: each task's own test files run on its predecessor's tree (red) and then on its own tree (green), with tsc, the whole suite, `node scripts/build.mjs` and `npm run gates` at every task. A reviewer-added test raises the totals; that is not a defect.
- Component tests drive each popup screen against the REAL background (`renderInWallet` / `setupWallet` / `renderApp`: `handleMessage` over the in-memory `fakeExt`); each screen test asserts `unstyledClasses(…)` is empty.
- No task touches the repository root's `src/` or `core/`, nor `web/`. The dry run ran the root `tsc` + `jest` and web's `npm run verify` anyway (Dry-run record).

## Tasks

### Task 1: C19: `cleanName` refuses every control and format character — for contact names and account names

**Spec:** §2 E17 (names), C19 (review L5, L8), §10 (`FORBIDDEN_IN_NAME`), §8.1 E17's C19 and rev-3 items

**Files:**
- Modify: `extension/src/background/__tests__/accountsStore.test.ts`
- Modify: `extension/src/shared/__tests__/envelopeRules.test.ts`
- Modify: `extension/src/shared/envelopeRules.ts`

**Interfaces:**
- Consumes: `cleanName` (`src/shared/envelopeRules.ts`), `renameAccount` and `storeEnvelope` (`src/background/accountsStore.ts`) — unchanged signatures.
- Produces (as exported): No new export. `FORBIDDEN_IN_NAME` (module-private) becomes `/[\p{Cc}\p{Cf}\u034F\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069]/u` (spec §10, verbatim).

Plan 1 kept 2a's hand list of controls (Scope §2: "plan 2 widens `FORBIDDEN_IN_NAME` for contacts and account names together"). C19 replaces it with Unicode categories under the `u` flag — every control (Cc) and format (Cf) character: the soft hyphen, the zero-width spaces and joiners, the BOM, U+061C, U+180E, the tag characters — plus the two invisible marks of category Mn the categories miss (U+034F and the variation selectors). "Mo\u200Bm" renders as "Mom" and may not be a name. The rule is shared: the vault page's `reencryptForAccounts` and the background's `renameAccount`/`storeEnvelope` call the same `cleanName`, so an account rename takes the rule too, and a stored name that predates it is still carried (`storeEnvelope` keeps stored names; `reencrypt.ts:37` keeps an unchanged one). The stated limit is pinned as a test so changing it is a decision: names are not otherwise normalised, so a cross-script look-alike ("Вinance" with a Cyrillic В) passes (rev 3, review L4). A leading or trailing U+FEFF is whitespace to `trim()` and is trimmed, not refused — the tests put each character inside the name.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/accountsStore.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/accountsStore.test.ts b/extension/src/background/__tests__/accountsStore.test.ts
index e140eca..f7b517d 100644
--- a/extension/src/background/__tests__/accountsStore.test.ts
+++ b/extension/src/background/__tests__/accountsStore.test.ts
@@ -58,6 +58,27 @@ describe('accountsStore', () => {
     expect(((await ext.local.get(VAULT_KEY)) as typeof ENV).accounts[1]?.name).toBe('Savings');
   });
 
+  // B1b-2b C19: an account name takes the contacts' rule — a zero-width or format character is refused.
+  it('C19: a rename carrying a format character (U+200B, U+00AD, U+FEFF) is malformed, nothing written', async () => {
+    const ext = fakeExt();
+    await ext.local.set(VAULT_KEY, ENV);
+    for (const bad of ['Sa\u200Bvings', 'Sa\u00ADvings', 'Sa\uFEFFvings']) {
+      expect(await renameAccount(ext, 1, bad)).toBe('malformed');
+      expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
+    }
+  });
+
+  // …and a stored name that predates the rule is carried, never refused: storeEnvelope keeps the stored name of every
+  // account present in both envelopes (spec C19).
+  it('C19: a stored name that predates the rule is kept by an account change', async () => {
+    const old = {...ENV, accounts: [{...ENV.accounts[0]!, name: 'Mo\u200Bm'}, ENV.accounts[1]!]};
+    const ext = fakeExt();
+    await ext.local.set(VAULT_KEY, old);
+    const next = {...old, seed: {iv: B(12, 21), ct: B(48, 22)}, accounts: [...old.accounts, {index: 2, name: 'Account 3', publicKey: K2}]};
+    expect(await storeEnvelope(ext, envelopeRevision(old as Parameters<typeof envelopeRevision>[0]), next)).toBe('stored');
+    expect(((await ext.local.get(VAULT_KEY)) as typeof ENV).accounts.map(a => a.name)).toEqual(['Mo\u200Bm', 'Account 2', 'Account 3']);
+  });
+
   it('refuses an unknown index and a missing wallet', async () => {
     const ext = fakeExt();
     expect(await renameAccount(ext, 0, 'x')).toBe('unknown-account');
````

Modify `extension/src/shared/__tests__/envelopeRules.test.ts`:

````diff
diff --git a/extension/src/shared/__tests__/envelopeRules.test.ts b/extension/src/shared/__tests__/envelopeRules.test.ts
index 42dc24b..e756bb2 100644
--- a/extension/src/shared/__tests__/envelopeRules.test.ts
+++ b/extension/src/shared/__tests__/envelopeRules.test.ts
@@ -19,4 +19,25 @@ describe('envelope rules shared by the vault page and the background', () => {
     expect(cleanName('x'.repeat(MAX_NAME_LENGTH))).toBe('x'.repeat(MAX_NAME_LENGTH));
     for (const bad of ['', '   ', 'x'.repeat(MAX_NAME_LENGTH + 1), 'a\nb', 'a\u202eb', 'a\u2066b', 3]) expect(cleanName(bad)).toBeNull();
   });
+
+  // B1b-2b C19 (review L8, rev 3 L5): every control and format character by Unicode category, and the two invisible Mn
+  // marks named beside them — each inside a name (a leading or trailing U+FEFF is whitespace to trim()).
+  it('C19: refuses every format character and the invisible marks — "Mo\u200Bm" is not "Mom"', () => {
+    const FORMAT = [0x00ad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff, 0x061c, 0x180e, 0x034f, 0xfe00, 0xfe0f, 0xe0041];
+    for (const cp of FORMAT) expect([cp.toString(16), cleanName(`Mo${String.fromCodePoint(cp)}m`)]).toEqual([cp.toString(16), null]);
+    // C0, DEL and C1 controls by category too.
+    for (const cp of [0x00, 0x1f, 0x7f, 0x80, 0x9f]) expect(cleanName(`a${String.fromCodePoint(cp)}b`)).toBeNull();
+    expect(cleanName('Mom')).toBe('Mom');
+  });
+
+  it('C19: accepts ordinary text in any script, punctuation and emoji — names are not otherwise normalised', () => {
+    for (const ok of ['Marko · Mom', 'Bistro Ljubljana', 'Žiga', 'Μαρία', 'Иван', '李雷', 'café', 'Cold storage 🔒', "O'Brien-Smith"]) expect(cleanName(ok)).toBe(ok);
+  });
+
+  // Rev 3, review L4: the stated limit, pinned — a cross-script look-alike is a different, accepted name. Changing this is a
+  // decision (spec C19), not an accident.
+  it('C19 limit: "Вinance" (Cyrillic В) is accepted beside "Binance" — confusables are not caught here', () => {
+    expect(cleanName('\u0412inance')).toBe('\u0412inance');
+    expect('\u0412inance'.normalize('NFKC')).not.toBe('Binance');
+  });
 });
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/background/__tests__/accountsStore.test.ts src/shared/__tests__/envelopeRules.test.ts
```
Expected (dry run, these test files on the branch's starting tree (f183069)): **red** — Test Files  2 failed (2) · Tests  2 failed | 32 passed (34). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/shared/envelopeRules.ts`:

````diff
diff --git a/extension/src/shared/envelopeRules.ts b/extension/src/shared/envelopeRules.ts
index 5b9814b..b3bf866 100644
--- a/extension/src/shared/envelopeRules.ts
+++ b/extension/src/shared/envelopeRules.ts
@@ -33,11 +33,15 @@ export function b64Length(x: unknown): number | null {
   }
 }
 
-// C0 and C1 controls, and the bidi embedding/override/isolate characters that can make an
-// account name read as something else.
-const FORBIDDEN_IN_NAME = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
+// B1b-2b C19 (review L5, L8): every Unicode control (Cc) and format (Cf) character, by category under the `u` flag —
+// the C0/C1 controls, the soft hyphen U+00AD, the zero-width spaces and joiners U+200B–U+200F, U+2060–U+2064, the BOM
+// U+FEFF, U+061C, U+180E, the tag characters — the bidi embeddings, overrides and isolates (Cf too, named for the
+// reader), and two invisible marks of category Mn: the combining grapheme joiner U+034F and the variation selectors
+// U+FE00–U+FE0F. "Mo\u200Bm" renders as "Mom"; a name may not. For contact names and account names alike. Names are not
+// otherwise normalised: cross-script look-alikes ("Вinance" with a Cyrillic В) pass — C19's stated limit.
+const FORBIDDEN_IN_NAME = /[\p{Cc}\p{Cf}\u034F\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069]/u;
 
-/** An account name as stored: trimmed, 1..MAX_NAME_LENGTH, no controls or bidi overrides. Null otherwise. */
+/** A name as stored (an account's, a contact's): trimmed, 1..MAX_NAME_LENGTH, no control or format character (C19). Null otherwise. */
 export function cleanName(x: unknown): string | null {
   if (typeof x !== 'string') return null;
   const name = x.trim();
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/background/__tests__/accountsStore.test.ts src/shared/__tests__/envelopeRules.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  2 passed (2) · Tests  34 passed (34); tsc clean; whole suite Test Files  133 passed (133) · Tests  2588 passed (2588); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red.

- **M1a** — the format-character category dropped from FORBIDDEN_IN_NAME (C19, spec mutation "drop the format-character range") — `extension/src/shared/envelopeRules.ts`:

  ```diff
  - const FORBIDDEN_IN_NAME = /[\p{Cc}\p{Cf}\u034F\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069]/u;
  + const FORBIDDEN_IN_NAME = /[\p{Cc}\u034F\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069]/u;
  ```
  `timeout 300 npx vitest run src/shared/__tests__/envelopeRules.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 5 passed (6)).

- **M1b** — the two invisible Mn marks (U+034F, U+FE00–U+FE0F) dropped — `extension/src/shared/envelopeRules.ts`:

  ```diff
  - const FORBIDDEN_IN_NAME = /[\p{Cc}\p{Cf}\u034F\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069]/u;
  + const FORBIDDEN_IN_NAME = /[\p{Cc}\p{Cf}\u202A-\u202E\u2066-\u2069]/u;
  ```
  `timeout 300 npx vitest run src/shared/__tests__/envelopeRules.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 5 passed (6)).

- **M1c** — the control category (Cc) dropped — `extension/src/shared/envelopeRules.ts`:

  ```diff
  - const FORBIDDEN_IN_NAME = /[\p{Cc}\p{Cf}\u034F\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069]/u;
  + const FORBIDDEN_IN_NAME = /[\p{Cf}\u034F\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069]/u;
  ```
  `timeout 300 npx vitest run src/shared/__tests__/envelopeRules.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 4 passed (6)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/accountsStore.test.ts extension/src/shared/__tests__/envelopeRules.test.ts extension/src/shared/envelopeRules.ts
git commit -F - <<'MSG'
feat(extension): C19 — cleanName refuses every control and format character (contacts and accounts)

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 2: E17: `v1_contacts` and `contacts.list` / `contacts.set` / `contacts.remove`; the contact label (own > treasury > contact); wiped on delete, kept on restore; the gate owns the key

**Spec:** §2 E17, D18–D20, C12, C19; §1.5 (partition, `BACKGROUND_OWNED_KEYS`); §2 E11 (E5 step 7 with `v1_contacts`); §5 (#37's plan-2 bullet); §8.1 E17 and Partition

**Files:**
- Modify: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Modify: `extension/src/app/__tests__/DeleteWallet.test.tsx`
- Modify: `extension/src/app/screens/DeleteWallet.tsx`
- Create: `extension/src/background/__tests__/contacts.test.ts`
- Modify: `extension/src/background/__tests__/forgetWallet.test.ts`
- Modify: `extension/src/background/__tests__/messages.test.ts`
- Modify: `extension/src/background/__tests__/recipientInfo.test.ts`
- Modify: `extension/src/background/accountsStore.ts`
- Create: `extension/src/background/contacts.ts`
- Modify: `extension/src/background/knownRecipients.ts`
- Modify: `extension/src/background/walletApi.ts`
- Modify: `extension/src/unlock/forgetFlow.ts`

**Interfaces:**
- Consumes: `isAddress` (`src/background/prepare.ts`), `cleanName` (`src/shared/envelopeRules.ts`), `getSession`/`sessionMutex` (`session.ts`), `createMutex` (`mutex.ts`), `readWalletView` and plan 1's `WALLET_DATA_KEYS` (`accountsStore.ts`), `handleWallet`/`WALLET_TYPES` (`walletApi.ts`), `BACKGROUND_OWNED_KEYS` (`scripts/check-vault-isolation.mjs`).
- Produces (as exported):
  - `src/background/contacts.ts` (new): `export const CONTACTS_KEY = 'v1_contacts'`; `export const MAX_CONTACTS = 200`; `export interface Contact {address: string; name: string}`; `export interface ContactView extends Contact {lastSentAt: number | null; known: boolean}`; `export type SetContactResult = {created: boolean} | 'malformed' | 'duplicate-name' | 'full' | 'locked'`; `export const nameKey = (name: string): string`; `export async function readContacts(ext: Ext): Promise<Contact[]>`; `export async function contactFor(ext: Ext, address: string): Promise<Contact | null>`; `export async function listContacts(ext: Ext): Promise<ContactView[] | 'locked'>`; `export async function setContact(ext: Ext, address: unknown, name: unknown): Promise<SetContactResult>`; `export async function removeContact(ext: Ext, address: unknown): Promise<'removed' | 'malformed' | 'locked'>`.
  - `src/background/knownRecipients.ts`: `export interface RecipientFacts {known(recipient: string): boolean; lastSentAt(recipient: string): number | null}`; `export async function recipientFacts(ext: Ext, session: readonly {publicKey: string}[]): Promise<RecipientFacts>` — `isKnownRecipient` and `lastSentAt` keep their signatures and are defined on it.
  - `WALLET_TYPES` gains `'contacts.list'`, `'contacts.set'`, `'contacts.remove'` (privileged, refused from web pages; not vault-page-only). Replies: `contacts.list` → `{contacts: ContactView[], max: 200}`; `contacts.set` → `{created: boolean}`; `contacts.remove` → no data. `wallet.recipientInfo`'s `label` gains `{kind: 'contact', name}`.

The store follows the spec's E17 line by line. `v1_contacts` holds `{address, name}` objects, newest first; a read keeps only entries with a canonical 32-byte base58 address (prepare's `isAddress`) and a name `cleanName` accepts, drops later duplicates of an address and keeps at most 200 — never "repaired" on read. `contacts.set` adds first or renames in place (the position kept; one contact per address, and the address never changes — C12); a name another address already has after NFKC and case-folding is `duplicate-name` (C19; the fold is NFKC then upper- then lower-casing, so "Straße" and "STRASSE" are one name; renaming a contact to its own name is fine); a new address with 200 stored is `full`. All three messages are refused while locked (C12: the book says whom the user pays). One mutex serialises every read-modify-write, and the session check shares one `sessionMutex` section with the write (lock order: the contacts mutex, then `sessionMutex` — nothing takes them the other way round): a lock, and so a delete (which locks first and wipes after), is ordered wholly before the check (`locked`) or wholly after the write (the wipe then removes it).

**A contact is never "known" (D19).** `known` and `lastSentAt` come from one new function, `recipientFacts` — the one E6 rule (an own account, or an address a confirmed send went to) over one read of the list, which `isKnownRecipient` and `lastSentAt` are now defined on. It reads no contact. `contacts.list` asks it once for up to 200 rows (calling `isKnownRecipient` per row would read the 1 000-entry list 200 times), so its `known` IS prepare's `first-send` rule; the parity test saves a contact and asserts neither `recipientInfo.known` nor prepare's `first-send` reason moves. `wallet.recipientInfo` gains the label `{kind: 'contact', name}` with precedence own > treasury > contact — a name can never stand in for "Your account" or the treasury.

**Lifecycle.** Plan 1 left one list for everything a wallet owns (`WALLET_DATA_KEYS`, "plan 2 adds v1_contacts here"): adding `CONTACTS_KEY` makes the delete (E5 step 7) and the first write wipe the book, and a restore (a replacement) keeps it — D20 — with no other change. `BACKGROUND_OWNED_KEYS` gains `v1_contacts` with a fixture (a popup file and a vault-page file naming it are violations). The gate found one: plan 1's `forgetFlow.ts` comment named the key ("plan 2 adds v1_contacts there"); it is reworded. #37's 37a bullet switches to §5's plan-2 wording in this same task, as plan 1's Scope §2 asked.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

````diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index c345771..d0afbe3 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -391,6 +391,13 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
       OWNED('src/app/popup.tsx', 'v1_forbidden_until'),
     ]);
   });
+  // B1b-2b E17: the address book is the background's — a popup file naming v1_contacts is a violation.
+  it('lets only the background name the address book key (v1_contacts)', () => {
+    const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
+    expect(sourceViolations([f('src/background/contacts.ts', "export const CONTACTS_KEY = 'v1_contacts';")])).toEqual([]);
+    expect(sourceViolations([f('src/app/screens/Contacts.tsx', "const k = 'v1_contacts';")])).toEqual([OWNED('src/app/screens/Contacts.tsx', 'v1_contacts')]);
+    expect(sourceViolations([f('src/unlock/main.ts', '// v1_contacts')])).toEqual([OWNED('src/unlock/main.ts', 'v1_contacts')]);
+  });
   // B1b-2a E4: the balance and price caches are the background's too.
   it('lets only the background name the two cache keys', () => {
     const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
````

Modify `extension/src/app/__tests__/DeleteWallet.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/DeleteWallet.test.tsx b/extension/src/app/__tests__/DeleteWallet.test.tsx
index b5f9016..d031700 100644
--- a/extension/src/app/__tests__/DeleteWallet.test.tsx
+++ b/extension/src/app/__tests__/DeleteWallet.test.tsx
@@ -106,7 +106,8 @@ describe('#37 delete wallet', () => {
     const bullets = [...document.querySelectorAll('.app-delete-bullets li')].map(li => li.textContent);
     expect(bullets).toEqual([
       "Your assets won't be lost on-chain — but you'll need your recovery phrase to access them again.",
-      'Local settings, cached balances and the list of addresses you have sent to are erased and not recoverable.',
+      // Plan 2 (spec §5): the address book is erased with the rest (D20).
+      'Local settings, cached balances, your address book and the list of addresses you have sent to are erased and not recoverable.',
     ]);
     expect(document.body.textContent).not.toMatch(/staking|dApp|backup file|seed phrase/);
     expect(document.querySelector('.app-delete-eyebrow')?.textContent).toBe('Type DELETE to confirm');
````

Create `extension/src/background/__tests__/contacts.test.ts`:

````ts
import {base58} from '@scure/base';
import {CONTACTS_KEY, MAX_CONTACTS, nameKey, readContacts} from '../contacts';
import {handleWallet} from '../walletApi';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {addKnownRecipient, isKnownRecipient} from '../knownRecipients';
import {prepareSend} from '../prepare';
import {getSession, setSession} from '../session';
import {lock} from '../autolock';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, sendReader} from './fixtures';

// B1b-2b E17 (D18–D20, C12, C19): the address book — a label, never trust.
const OTHER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const SECOND = {index: 1, publicKey: OTHER, secretKey: ACCOUNT.secretKey};
const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}, {index: 1, name: 'Savings', publicKey: OTHER}]};
/** The n-th distinct, canonical address (32 bytes, the first byte n + 1). */
const addr = (n: number): string => base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? n + 1 : 7)));
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const popup = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const web = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};

async function setup(o: {unlocked?: boolean} = {}) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, ENV);
  if (o.unlocked !== false) await setSession(ext, [ACCOUNT, SECOND]);
  return ext;
}
type Ext = Awaited<ReturnType<typeof setup>>;
const call = (ext: Ext, type: 'contacts.list' | 'contacts.set' | 'contacts.remove', msg: Record<string, unknown> = {}) => handleWallet(ext, fakeDeps(), type, msg);
const list = async (ext: Ext) => ((await call(ext, 'contacts.list')).data as {contacts: {address: string; name: string; lastSentAt: number | null; known: boolean}[]}).contacts;

describe('contacts.set / contacts.list / contacts.remove (E17)', () => {
  it('a new contact goes first; the list carries lastSentAt and known from E6, and max 200', async () => {
    const ext = await setup();
    await addKnownRecipient(ext, addr(2), 1_700_000_000_000);
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'Marko · Mom'})).toEqual({ok: true, data: {created: true}});
    expect(await call(ext, 'contacts.set', {address: addr(2), name: '  Bistro  '})).toEqual({ok: true, data: {created: true}});
    expect(await call(ext, 'contacts.list')).toEqual({
      ok: true,
      data: {
        contacts: [
          {address: addr(2), name: 'Bistro', lastSentAt: 1_700_000_000_000, known: true},
          {address: addr(1), name: 'Marko · Mom', lastSentAt: null, known: false},
        ],
        max: 200,
      },
    });
    // Stored as {address, name} only — nothing else reaches storage.
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: addr(2), name: 'Bistro'}, {address: addr(1), name: 'Marko · Mom'}]);
  });

  it('one contact per address: a set for a saved address renames it in place (its position kept), created false', async () => {
    const ext = await setup();
    for (const n of [1, 2, 3]) await call(ext, 'contacts.set', {address: addr(n), name: `C${n}`});
    expect(await call(ext, 'contacts.set', {address: addr(2), name: 'Renamed'})).toEqual({ok: true, data: {created: false}});
    expect((await list(ext)).map(c => c.name)).toEqual(['C3', 'Renamed', 'C1']);
  });

  it('the 201st address is full and writes nothing; renaming one of the 200 still works', async () => {
    const ext = await setup();
    await ext.local.set(CONTACTS_KEY, Array.from({length: MAX_CONTACTS}, (_, i) => ({address: addr(i), name: `C${i}`})));
    const before = JSON.stringify(await ext.local.get(CONTACTS_KEY));
    expect(await call(ext, 'contacts.set', {address: addr(MAX_CONTACTS), name: 'One more'})).toEqual({ok: false, error: 'full'});
    expect(JSON.stringify(await ext.local.get(CONTACTS_KEY))).toBe(before);
    expect(await call(ext, 'contacts.set', {address: addr(5), name: 'Still fine'})).toEqual({ok: true, data: {created: false}});
  });

  it('malformed: not an address, a name cleanName refuses (C19 included) — nothing written', async () => {
    const ext = await setup();
    for (const [address, name] of [
      ['nope', 'Name'],
      [addr(1).slice(0, -1), 'Name'],
      [42, 'Name'],
      [addr(1), ''],
      [addr(1), '   '],
      [addr(1), 'x'.repeat(33)],
      [addr(1), 'Mo\u200Bm'],
      [addr(1), 'a\u202eb'],
      [addr(1), 7],
    ] as const) {
      expect(await call(ext, 'contacts.set', {address, name})).toEqual({ok: false, error: 'malformed'});
    }
    expect(await call(ext, 'contacts.remove', {address: 'nope'})).toEqual({ok: false, error: 'malformed'});
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
  });

  it('remove: ok whether or not it was saved; nothing written for an absent address', async () => {
    const ext = await setup();
    expect(await call(ext, 'contacts.remove', {address: addr(1)})).toEqual({ok: true});
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
    await call(ext, 'contacts.set', {address: addr(1), name: 'A'});
    await call(ext, 'contacts.set', {address: addr(2), name: 'B'});
    expect(await call(ext, 'contacts.remove', {address: addr(1)})).toEqual({ok: true});
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: addr(2), name: 'B'}]);
  });

  it('C12: all three are refused while locked, and nothing is written', async () => {
    const ext = await setup({unlocked: false});
    await ext.local.set(CONTACTS_KEY, [{address: addr(1), name: 'A'}]);
    expect(await call(ext, 'contacts.list')).toEqual({ok: false, error: 'locked'});
    expect(await call(ext, 'contacts.set', {address: addr(2), name: 'B'})).toEqual({ok: false, error: 'locked'});
    expect(await call(ext, 'contacts.remove', {address: addr(1)})).toEqual({ok: false, error: 'locked'});
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: addr(1), name: 'A'}]);
  });

  it('a lock that lands first wins: a set issued after it is locked, never written after the lock', async () => {
    const ext = await setup();
    await lock(ext);
    expect(await getSession(ext)).toBeNull();
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'A'})).toEqual({ok: false, error: 'locked'});
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
  });

  it('two sets at once both land (one mutex for every read-modify-write)', async () => {
    const ext = await setup();
    await Promise.all([call(ext, 'contacts.set', {address: addr(1), name: 'A'}), call(ext, 'contacts.set', {address: addr(2), name: 'B'})]);
    expect((await list(ext)).map(c => c.name).sort()).toEqual(['A', 'B']);
  });

  it('a read keeps only valid entries: bad address, bad name, a later duplicate of an address, beyond 200 — dropped, never repaired', async () => {
    const ext = await setup();
    for (const junk of ['x', 7, null, {}]) {
      await ext.local.set(CONTACTS_KEY, junk);
      expect(await readContacts(ext)).toEqual([]);
    }
    await ext.local.set(CONTACTS_KEY, [
      {address: addr(1), name: 'A'},
      {address: 'nope', name: 'B'},
      {address: addr(2), name: 'Mo\u200Bm'},
      {address: addr(3), name: 42},
      'string',
      {address: addr(1), name: 'A again'},
      {address: addr(4), name: '  D  '},
    ]);
    expect(await readContacts(ext)).toEqual([{address: addr(1), name: 'A'}, {address: addr(4), name: 'D'}]);
    await ext.local.set(CONTACTS_KEY, Array.from({length: MAX_CONTACTS + 5}, (_, i) => ({address: addr(i), name: `C${i}`})));
    expect(await readContacts(ext)).toHaveLength(MAX_CONTACTS);
    expect((await ext.local.get(CONTACTS_KEY)) as unknown[]).toHaveLength(MAX_CONTACTS + 5);
  });

  it('contacts.* are privileged: refused from a web page, answered from the popup', async () => {
    const ext = await setup();
    for (const m of [{type: 'contacts.list'}, {type: 'contacts.set', address: addr(1), name: 'A'}, {type: 'contacts.remove', address: addr(1)}]) {
      expect(await handleMessage(ext, m, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
    expect(await handleMessage(ext, {type: 'contacts.set', address: addr(1), name: 'A'}, popup, fakeDeps())).toEqual({ok: true, data: {created: true}});
  });
});

describe('C19: two contacts may not share a name (NFKC + case-folding)', () => {
  it('"Binance" then "binance", "BINANCE" or the NFKC-equal fullwidth "Ｂｉｎａｎｃｅ" for another address → duplicate-name', async () => {
    const ext = await setup();
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'Binance'})).toMatchObject({ok: true});
    for (const name of ['binance', 'BINANCE', ' Binance ', 'Ｂｉｎａｎｃｅ']) {
      expect(await call(ext, 'contacts.set', {address: addr(2), name})).toEqual({ok: false, error: 'duplicate-name'});
    }
    expect((await list(ext)).map(c => c.address)).toEqual([addr(1)]);
  });

  it('renaming a contact to its own name, in another case too, is fine', async () => {
    const ext = await setup();
    await call(ext, 'contacts.set', {address: addr(1), name: 'Binance'});
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'Binance'})).toEqual({ok: true, data: {created: false}});
    expect(await call(ext, 'contacts.set', {address: addr(1), name: 'BINANCE'})).toEqual({ok: true, data: {created: false}});
  });

  it('the fold: Straße and STRASSE are one name; nameKey is NFKC then case-folded', () => {
    expect(nameKey('Straße')).toBe(nameKey('STRASSE'));
    expect(nameKey('Ｍｏｍ')).toBe('mom');
  });

  // Rev 3, review L4 — the stated limit, pinned so a change is a decision: a cross-script look-alike is another name.
  it('limit: "Вinance" (Cyrillic В) is accepted beside "Binance" — the full address in pick rows is the defence', async () => {
    const ext = await setup();
    await call(ext, 'contacts.set', {address: addr(1), name: 'Binance'});
    expect(await call(ext, 'contacts.set', {address: addr(2), name: '\u0412inance'})).toEqual({ok: true, data: {created: true}});
  });
});

describe('D19: a contact is a label, never trust', () => {
  it('contacts.list `known` is isKnownRecipient — an own account, a recipient sent to, and a stranger', async () => {
    const ext = await setup();
    await addKnownRecipient(ext, addr(2), 5);
    for (const [n, address] of [[0, OTHER], [1, addr(2)], [2, addr(3)]] as const) await call(ext, 'contacts.set', {address, name: `C${n}`});
    const session = (await getSession(ext)) ?? [];
    for (const c of await list(ext)) expect([c.address, c.known]).toEqual([c.address, await isKnownRecipient(ext, session, c.address)]);
    expect((await list(ext)).map(c => c.known)).toEqual([false, true, true]);
  });

  it('parity: saving a contact never changes recipientInfo.known nor prepare’s first-send reason', async () => {
    for (const [recipient, sentBefore] of [[RECIPIENT, false], [RECIPIENT, true], [OTHER, false], [MAINNET_FEE_TREASURY, false]] as const) {
      const ext = await setup();
      if (sentBefore) await addKnownRecipient(ext, recipient, 5);
      const ask = async () => ((await handleWallet(ext, fakeDeps(), 'wallet.recipientInfo', {account: ACCOUNT.publicKey, recipient})).data as {known: boolean}).known;
      const firstSend = async () => {
        const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {token: 'SOL', recipient, amount: '1000000'});
        return (view.reauth?.reasons ?? []).includes('first-send');
      };
      const before = [await ask(), await firstSend()];
      expect(await call(ext, 'contacts.set', {address: recipient, name: 'Saved'})).toMatchObject({ok: true});
      expect([recipient, await ask(), await firstSend()]).toEqual([recipient, ...before]);
    }
  });
});
````

Modify `extension/src/background/__tests__/forgetWallet.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/forgetWallet.test.ts b/extension/src/background/__tests__/forgetWallet.test.ts
index 5e0ad7f..168a113 100644
--- a/extension/src/background/__tests__/forgetWallet.test.ts
+++ b/extension/src/background/__tests__/forgetWallet.test.ts
@@ -6,6 +6,7 @@ import {PENDING_KEY, readPending, updatePending} from '../pendingStore';
 import {pollOnce} from '../pending';
 import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
 import {SETTINGS_KEY} from '../settings';
+import {CONTACTS_KEY} from '../contacts';
 import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../balanceCache';
 import {FORBIDDEN_UNTIL_KEY} from '../deps';
 import {AUTOLOCK_ALARM} from '../autolock';
@@ -46,6 +47,7 @@ async function setup(reader: SolanaReader = zero()) {
   await setSession(ext, [ACCOUNT]);
   await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
   await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
+  await ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Marko'}]);
   await ext.local.set(BALANCE_CACHE_KEY, {});
   await ext.local.set(PRICE_CACHE_KEY, {});
   await ext.local.set(FORBIDDEN_UNTIL_KEY, 123);
@@ -95,13 +97,15 @@ describe('vault.forgetWallet — the stored wallet', () => {
 });
 
 describe('vault.forgetWallet — a delete (no replacement)', () => {
-  it('locks, removes the vault, the known recipients, the settings and both caches; keeps the 403 cool-down', async () => {
+  it('locks, removes the vault, the known recipients, the settings, the address book and both caches; keeps the 403 cool-down', async () => {
     const {ext, deps} = await setup();
+    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: RECIPIENT, name: 'Marko'}]);
     expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
     expect(await vault(ext)).toBeUndefined();
     expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
     expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
-    for (const key of [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) expect(await ext.local.get(key)).toBeUndefined();
+    // B1b-2b E17 (D20): the address book goes with the wallet.
+    for (const key of [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) expect(await ext.local.get(key)).toBeUndefined();
     expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
   });
 
@@ -121,6 +125,8 @@ describe('vault.forgetWallet — a restore (replacement, C4, D40)', () => {
     expect(await vault(ext)).toEqual(REPLACEMENT);
     expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1}]);
     expect(await ext.local.get(SETTINGS_KEY)).toEqual({autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
+    // B1b-2b E17 (D20): a restore keeps the address book.
+    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: RECIPIENT, name: 'Marko'}]);
     expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
     expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
     expect(await getSession(ext)).toBeNull();
@@ -299,15 +305,18 @@ describe('vault.forgetWallet — the unfunded guard (C6)', () => {
 });
 
 describe('a first write clears what a crashed delete left behind', () => {
-  it('vault.storeEnvelope with expectedRevision null removes leftover known recipients, settings and caches (L1)', async () => {
+  it('vault.storeEnvelope with expectedRevision null removes leftover known recipients, settings, contacts and caches (L1)', async () => {
     const ext = fakeExt();
     await ext.local.set(BALANCE_CACHE_KEY, {});
     await ext.local.set(PRICE_CACHE_KEY, {});
     await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
     await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 60, reauthUsdCents: 100000, selectedAccount: 0});
+    await ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Left behind'}]);
     expect(await storeEnvelope(ext, null, STORED)).toBe('stored');
     expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
     expect(await ext.local.get(SETTINGS_KEY)).toBeUndefined();
+    // B1b-2b E17: a book a crashed delete left behind never reaches the next wallet.
+    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
     expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
     expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
   });
````

Modify `extension/src/background/__tests__/messages.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index f7b8ab7..b3f546b 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -199,6 +199,7 @@ describe('message partitions (B1b-1 types)', () => {
     'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'vault.removePasskey', 'vault.phraseVerified', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
+    'contacts.list', 'contacts.set', 'contacts.remove',
   ];
 
   it('every privileged type is refused from a web page and from another extension', async () => {
````

Modify `extension/src/background/__tests__/recipientInfo.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/recipientInfo.test.ts b/extension/src/background/__tests__/recipientInfo.test.ts
index 318df0d..001bbdc 100644
--- a/extension/src/background/__tests__/recipientInfo.test.ts
+++ b/extension/src/background/__tests__/recipientInfo.test.ts
@@ -58,6 +58,21 @@ describe('wallet.recipientInfo (E6)', () => {
     expect((await ask(await setup(), RECIPIENT)).data).toEqual({known: false, lastSentAt: null, label: null, self: false});
   });
 
+  // B1b-2b E17: a saved contact adds a label — own > treasury > contact — and never touches `known` (D19).
+  it('a contact labels an address {kind: contact, name}; known stays false', async () => {
+    const ext = await setup();
+    await handleWallet(ext, fakeDeps(), 'contacts.set', {address: RECIPIENT, name: 'Marko · Mom'});
+    expect((await ask(ext, RECIPIENT)).data).toEqual({known: false, lastSentAt: null, label: {kind: 'contact', name: 'Marko · Mom'}, self: false});
+  });
+
+  it('precedence own > treasury > contact: a contact saved for an own account or the treasury never replaces their label', async () => {
+    const ext = await setup();
+    await handleWallet(ext, fakeDeps(), 'contacts.set', {address: OTHER, name: 'Not my savings'});
+    await handleWallet(ext, fakeDeps(), 'contacts.set', {address: MAINNET_FEE_TREASURY, name: 'Not the treasury'});
+    expect((await ask(ext, OTHER)).data).toMatchObject({label: {kind: 'own', index: 1, name: 'Savings'}});
+    expect((await ask(ext, MAINNET_FEE_TREASURY)).data).toMatchObject({known: false, label: {kind: 'treasury'}});
+  });
+
   it('refused while locked, and for a malformed address', async () => {
     const ext = fakeExt();
     await ext.local.set(VAULT_KEY, ENV);
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/app/__tests__/DeleteWallet.test.tsx src/background/__tests__/contacts.test.ts src/background/__tests__/forgetWallet.test.ts src/background/__tests__/messages.test.ts src/background/__tests__/recipientInfo.test.ts
```
Expected (dry run, these test files on Task 1's tree): **red** — Test Files  6 failed (6) · Tests  4 failed | 489 passed (493). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/scripts/check-vault-isolation.mjs`:

````diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
index c89d82a..8246d08 100644
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -87,7 +87,8 @@ const LISTEN_ALLOWED = /^src\/background\//;
 // storage.local keys only the background writes (plan B1b-1): no other file may even name them —
 // a popup writing v1_settings could undo a re-authenticated setting without re-authenticating.
 // B1b-2a E4 adds the two caches: a popup writing one could show a balance the chain never had.
-export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache'];
+// B1b-2b E17: the address book (v1_contacts) is the background's too — the popup reaches it only through contacts.*.
+export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache', 'v1_contacts'];
 const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
 // The vault page renders only fixed strings and the user's own words, as text (B1b-2a §1.2 item 3):
 // no file in src/unlock may parse or write markup, so nothing it shows can become an element.
````

Modify `extension/src/app/screens/DeleteWallet.tsx`:

````diff
diff --git a/extension/src/app/screens/DeleteWallet.tsx b/extension/src/app/screens/DeleteWallet.tsx
index c4d3909..3cad142 100644
--- a/extension/src/app/screens/DeleteWallet.tsx
+++ b/extension/src/app/screens/DeleteWallet.tsx
@@ -18,7 +18,8 @@ export const DELETE_TEXT = {
   /** ix:14973 → adapted ("device" → "browser"); the bold parts at 1 and 3. */
   body: ['This removes ', 'all encrypted keys', ' and ', 'local data', ' from this browser.'],
   bulletAssets: ["Your assets won't be lost on-chain — but you'll need your ", 'recovery phrase', ' to access them again.'],
-  bulletErased: ['Local settings, cached balances and the list of addresses you have sent to are ', 'erased', ' and not recoverable.'],
+  /** ix:14981 → adapted, plan 2's wording (spec §5): the address book is wiped with the rest (D20). */
+  bulletErased: ['Local settings, cached balances, your address book and the list of addresses you have sent to are ', 'erased', ' and not recoverable.'],
   holdBody: 'Hold the red button below — release to cancel, hold for the full second to delete.',
   firstAccount: "This wallet's first account",
   typeLead: 'Type ',
````

Modify `extension/src/background/accountsStore.ts`:

````diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index aa8e9d9..14b1a62 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -6,6 +6,7 @@ import {getSession, sessionMutex} from './session';
 import {isOpen, readPending, updatePending} from './pendingStore';
 import {KNOWN_RECIPIENTS_KEY} from './knownRecipients';
 import {SETTINGS_KEY, updateSettings} from './settings';
+import {CONTACTS_KEY} from './contacts';
 import {clearCaches} from './balanceCache';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, accountsPolicyOk, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
@@ -37,10 +38,11 @@ const serial = createMutex();
 
 /**
  * Everything a wallet owns in storage.local besides its envelope and the balance caches — removed together by a
- * delete (vault.forgetWallet without a replacement, E5 step 7 / B1b-2b E11) and by a first write. The one list: plan 2
- * adds v1_contacts (E17) here. `v1_forbidden_until` is not the wallet's (the coordinator's verdict) and is kept.
+ * delete (vault.forgetWallet without a replacement, E5 step 7 / B1b-2b E11) and by a first write. The one list, with
+ * the address book (B1b-2b E17, D20: wiped on delete, kept on restore — a replacement does not come here).
+ * `v1_forbidden_until` is not the wallet's (the coordinator's verdict) and is kept.
  */
-const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY];
+const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY];
 async function removeWalletData(ext: Ext): Promise<void> {
   for (const key of WALLET_DATA_KEYS) await ext.local.remove(key);
 }
````

Create `extension/src/background/contacts.ts`:

````ts
import type {Ext} from '../ext';
import {createMutex} from './mutex';
import {getSession, sessionMutex} from './session';
import {isAddress} from './prepare';
import {recipientFacts} from './knownRecipients';
import {cleanName} from '../shared/envelopeRules';

/**
 * The address book (B1b-2b E17; D18–D20, C12, C19): a name for an address, nothing more — no notes, no import or export
 * (D18). storage.local, written only by the background (scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS). Newest
 * first; one contact per address; the address never changes once saved (delete and add again). Removed by a delete,
 * kept by a restore (D20; accountsStore's WALLET_DATA_KEYS).
 *
 * **A contact is a label, never trust (D19).** Nothing here makes an address "known": knownRecipients' rule reads no
 * contact, so the first-send re-authentication still fires for a saved address — #27c's "Save sender" on a dusting
 * look-alike must not disarm it (spec E17's security argument).
 */
export const CONTACTS_KEY = 'v1_contacts';
export const MAX_CONTACTS = 200;

export interface Contact {
  address: string;
  name: string;
}
/** contacts.list's row: `lastSentAt` and `known` come from E6's one rule (recipientFacts), never from the book. */
export interface ContactView extends Contact {
  lastSentAt: number | null;
  known: boolean;
}
export type SetContactResult = {created: boolean} | 'malformed' | 'duplicate-name' | 'full' | 'locked';

/** One mutex for every read-modify-write of v1_contacts. Lock order: this, then sessionMutex — never the reverse. */
const serial = createMutex();

/**
 * C19: two contacts may not share a name, compared after Unicode NFKC and case-folding. JavaScript has no full case
 * fold; upper- then lower-casing folds what simple lower-casing misses ("Straße" and "STRASSE"). Cross-script look-alikes
 * are NOT folded together ("Вinance" with a Cyrillic В is another name) — the stated limit; a pick row's full address is
 * the defence for addresses.
 */
export const nameKey = (name: string): string => name.normalize('NFKC').toUpperCase().toLowerCase();

/**
 * The stored list, re-validated: an entry is kept only with an address (base58, 32 bytes, canonical — prepare's
 * isAddress) and a name cleanName accepts (as stored: trimmed); a later entry for an address already read is dropped;
 * at most MAX_CONTACTS. Anything else in the key reads as an empty book — never "repaired" on read.
 */
export async function readContacts(ext: Ext): Promise<Contact[]> {
  const v = await ext.local.get(CONTACTS_KEY);
  if (!Array.isArray(v)) return [];
  const out: Contact[] = [];
  const seen = new Set<string>();
  for (const x of v as unknown[]) {
    if (out.length >= MAX_CONTACTS) break;
    if (typeof x !== 'object' || x === null) continue;
    const {address, name} = x as {address?: unknown; name?: unknown};
    const clean = cleanName(name);
    if (!isAddress(address) || clean === null || seen.has(address)) continue;
    seen.add(address);
    out.push({address, name: clean});
  }
  return out;
}

/** The contact saved for this address, or null. For E6's label (wallet.recipientInfo). */
export async function contactFor(ext: Ext, address: string): Promise<Contact | null> {
  return (await readContacts(ext)).find(c => c.address === address) ?? null;
}

/**
 * contacts.list: every contact with E6's facts about it, from one read of the known-recipient list — `known` is the very
 * rule prepareSend's `first-send` reason uses (recipientFacts), so a pick row can say "You have never sent to this
 * address." truthfully. Refused while locked (C12): the list says whom the user pays.
 */
export async function listContacts(ext: Ext): Promise<ContactView[] | 'locked'> {
  const session = await getSession(ext);
  if (session === null) return 'locked';
  const [contacts, facts] = await Promise.all([readContacts(ext), recipientFacts(ext, session)]);
  return contacts.map(c => ({address: c.address, name: c.name, lastSentAt: facts.lastSentAt(c.address), known: facts.known(c.address)}));
}

/**
 * contacts.set (C12): adds a contact first, or renames the one saved for this address in place (its position kept).
 * `malformed` — not an address, or a name cleanName refuses (C19); `duplicate-name` — another address already has this
 * name after NFKC and case-folding (renaming a contact to its own name is fine); `full` — a new address with
 * MAX_CONTACTS stored; `locked`. The session check and the write share one sessionMutex section: a lock — and so a
 * delete, which locks first and removes v1_contacts after — is ordered wholly before the check or wholly after the write.
 */
export async function setContact(ext: Ext, address: unknown, name: unknown): Promise<SetContactResult> {
  const clean = cleanName(name);
  if (!isAddress(address) || clean === null) return 'malformed';
  return serial(() =>
    sessionMutex(async (): Promise<SetContactResult> => {
      if ((await getSession(ext)) === null) return 'locked';
      const list = await readContacts(ext);
      const key = nameKey(clean);
      if (list.some(c => c.address !== address && nameKey(c.name) === key)) return 'duplicate-name';
      const at = list.findIndex(c => c.address === address);
      if (at >= 0) {
        list[at] = {address, name: clean};
        await ext.local.set(CONTACTS_KEY, list);
        return {created: false};
      }
      if (list.length >= MAX_CONTACTS) return 'full';
      await ext.local.set(CONTACTS_KEY, [{address, name: clean}, ...list]);
      return {created: true};
    }),
  );
}

/** contacts.remove: answers ok whether or not the address was saved (nothing is written then). `malformed`, `locked`. */
export async function removeContact(ext: Ext, address: unknown): Promise<'removed' | 'malformed' | 'locked'> {
  if (!isAddress(address)) return 'malformed';
  return serial(() =>
    sessionMutex(async () => {
      if ((await getSession(ext)) === null) return 'locked' as const;
      const list = await readContacts(ext);
      const kept = list.filter(c => c.address !== address);
      if (kept.length !== list.length) await ext.local.set(CONTACTS_KEY, kept);
      return 'removed' as const;
    }),
  );
}
````

Modify `extension/src/background/knownRecipients.ts`:

````diff
diff --git a/extension/src/background/knownRecipients.ts b/extension/src/background/knownRecipients.ts
index 7f8ebcb..8087d9f 100644
--- a/extension/src/background/knownRecipients.ts
+++ b/extension/src/background/knownRecipients.ts
@@ -41,20 +41,40 @@ export async function knownRecipients(ext: Ext): Promise<Set<string>> {
   return new Set((await load(ext)).map(e => e.address));
 }
 
+/** What E6 says about any recipient, from ONE read of the list: the rule for "known" and the last send's time. */
+export interface RecipientFacts {
+  known(recipient: string): boolean;
+  lastSentAt(recipient: string): number | null;
+}
+
+/**
+ * The one rule for "known" (E6): one of the session's accounts, or an address a send has confirmed to — nothing else
+ * (B1b-2b D19: a saved contact is never known; this module reads no contact). isKnownRecipient and lastSentAt are
+ * defined on it, and contacts.list (E17) asks it once for up to 200 contacts, so #15's never-sent warning, #12's hint
+ * and #19/#20's `first-send` reason cannot disagree.
+ */
+export async function recipientFacts(ext: Ext, session: readonly {publicKey: string}[]): Promise<RecipientFacts> {
+  const list = await load(ext);
+  const sent = new Set(list.map(e => e.address));
+  const last = new Map<string, number | null>();
+  for (const e of list) last.set(e.address, e.at);
+  return {
+    known: recipient => session.some(a => a.publicKey === recipient) || sent.has(recipient),
+    lastSentAt: recipient => last.get(recipient) ?? null,
+  };
+}
+
 /** When a send to this address last confirmed; null when never, or when only the B1b-1 format knows it. */
 export async function lastSentAt(ext: Ext, address: string): Promise<number | null> {
-  let at: number | null = null;
-  for (const e of await load(ext)) if (e.address === address) at = e.at;
-  return at;
+  return (await recipientFacts(ext, [])).lastSentAt(address);
 }
 
 /**
- * The one rule for "known" (E6): one of the session's accounts, or an address a send has confirmed
- * to. prepareSend's `first-send` reason and wallet.recipientInfo both call this, so #12's hint and
- * #19/#20's reason cannot disagree.
+ * prepareSend's `first-send` reason and wallet.recipientInfo both call this, so #12's hint and #19/#20's reason cannot
+ * disagree. The rule is recipientFacts'.
  */
 export async function isKnownRecipient(ext: Ext, session: readonly {publicKey: string}[], recipient: string): Promise<boolean> {
-  return session.some(a => a.publicKey === recipient) || (await knownRecipients(ext)).has(recipient);
+  return (await recipientFacts(ext, session)).known(recipient);
 }
 
 export async function addKnownRecipient(ext: Ext, address: string, at: number): Promise<void> {
````

Modify `extension/src/background/walletApi.ts`:

````diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
index 6c27b0e..4fc68cd 100644
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -9,6 +9,7 @@ import {issueChallenge, takeSettingsChallenge} from './reauthChallenges';
 import {digestOf} from './digest';
 import {discardPrepared, isAddress, parseIntent, preparedFor, prepareSend} from './prepare';
 import {isKnownRecipient, lastSentAt} from './knownRecipients';
+import {MAX_CONTACTS, contactFor, listContacts, removeContact, setContact} from './contacts';
 import {MAINNET_FEE_TREASURY} from '../../../core/fees/transferMarkup';
 import {sendPrepared} from './send';
 import {resend, startPoller} from './pending';
@@ -40,6 +41,9 @@ export const WALLET_TYPES = [
   'accounts.order',
   'settings.get',
   'settings.set',
+  'contacts.list',
+  'contacts.set',
+  'contacts.remove',
 ] as const;
 export type WalletType = (typeof WALLET_TYPES)[number];
 export const isWalletType = (t: string): t is WalletType => (WALLET_TYPES as readonly string[]).includes(t);
@@ -183,7 +187,8 @@ async function prices(ext: Ext, deps: WalletDeps): Promise<Result> {
 /**
  * wallet.recipientInfo (E6): what #12 may say about a recipient before anything is prepared. Local
  * only — no network. Refused while locked: it reveals whom this wallet has paid. A hint: prepareSend
- * recomputes everything that decides.
+ * recomputes everything that decides. The label's precedence is own > treasury > contact (B1b-2b E17): a contact's
+ * name never stands in for "Your account" or the treasury. `known` is untouched by contacts (D19).
  */
 async function recipientInfo(ext: Ext, account: unknown, recipient: unknown): Promise<Result> {
   if (!isAddress(account) || !isAddress(recipient)) return MALFORMED;
@@ -191,7 +196,15 @@ async function recipientInfo(ext: Ext, account: unknown, recipient: unknown): Pr
   if (session === null) return {ok: false, error: 'locked'};
   const view = await readWalletView(ext);
   const own = view?.accounts.find(a => a.publicKey === recipient);
-  const label = own !== undefined ? {kind: 'own' as const, index: own.index, name: own.name} : recipient === MAINNET_FEE_TREASURY ? {kind: 'treasury' as const} : null;
+  const contact = own === undefined && recipient !== MAINNET_FEE_TREASURY ? await contactFor(ext, recipient) : null;
+  const label =
+    own !== undefined
+      ? {kind: 'own' as const, index: own.index, name: own.name}
+      : recipient === MAINNET_FEE_TREASURY
+        ? {kind: 'treasury' as const}
+        : contact !== null
+          ? {kind: 'contact' as const, name: contact.name}
+          : null;
   return {
     ok: true,
     data: {known: await isKnownRecipient(ext, session, recipient), lastSentAt: await lastSentAt(ext, recipient), label, self: recipient === account},
@@ -404,6 +417,19 @@ export async function handleWallet(ext: Ext, deps: WalletDeps, type: WalletType,
         return {ok: true, data: await readSettings(ext)};
       case 'settings.set':
         return await setSettings(ext, deps, msg);
+      // B1b-2b E17 (C12): every one refused while locked — the book says whom the user pays.
+      case 'contacts.list': {
+        const contacts = await listContacts(ext);
+        return contacts === 'locked' ? {ok: false, error: 'locked'} : {ok: true, data: {contacts, max: MAX_CONTACTS}};
+      }
+      case 'contacts.set': {
+        const r = await setContact(ext, msg.address, msg.name);
+        return typeof r === 'string' ? {ok: false, error: r} : {ok: true, data: r};
+      }
+      case 'contacts.remove': {
+        const r = await removeContact(ext, msg.address);
+        return r === 'removed' ? {ok: true} : {ok: false, error: r};
+      }
     }
   } catch (e) {
     return failure(e);
````

Modify `extension/src/unlock/forgetFlow.ts`:

````diff
diff --git a/extension/src/unlock/forgetFlow.ts b/extension/src/unlock/forgetFlow.ts
index 59ba038..4c0b46d 100644
--- a/extension/src/unlock/forgetFlow.ts
+++ b/extension/src/unlock/forgetFlow.ts
@@ -174,7 +174,7 @@ export type DeleteOutcome = 'deleted' | 'send-open' | 'busy' | 'unlocked' | 'no-
  * is deleted too (#37 shows the funds first, C13). The proof is proveFactor's (password or passkey, no session, works
  * locked). `funded`, `unreachable` and `coordinator-refused` cannot occur without the guard; if they ever did, they are
  * `failed`. The background's E5 locks, refuses while a send is open (`send-open`, the wallet left locked), and removes the
- * vault, the known recipients, the settings and the caches (plan 2 adds v1_contacts there).
+ * vault, the known recipients, the settings, the address book (B1b-2b E17) and the caches.
  */
 export async function deleteWallet(send: Send, proof: FactorProof): Promise<DeleteOutcome> {
   if (!minted.has(proof) || proof.kind !== 'factor') return 'failed';
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/app/__tests__/DeleteWallet.test.tsx src/background/__tests__/contacts.test.ts src/background/__tests__/forgetWallet.test.ts src/background/__tests__/messages.test.ts src/background/__tests__/recipientInfo.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  6 passed (6) · Tests  538 passed (538); tsc clean; whole suite Test Files  134 passed (134) · Tests  2607 passed (2607); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red.

- **M2a** — isKnownRecipient consults the address book (the spec mutation: a contact made "known") — `extension/src/background/knownRecipients.ts`:

  ```diff
  -   const sent = new Set(list.map(e => e.address));
  +   const sent = new Set([...list.map(e => e.address), ...(((await ext.local.get('v1_contacts')) as {address: string}[] | undefined) ?? []).map(c => c.address)]);
  ```
  `timeout 300 npx vitest run src/background/__tests__/contacts.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  3 failed | 13 passed (16)).

- **M2b** — names compared case-sensitively (the spec mutation) — `extension/src/background/contacts.ts`:

  ```diff
  - export const nameKey = (name: string): string => name.normalize('NFKC').toUpperCase().toLowerCase();
  + export const nameKey = (name: string): string => name.normalize('NFKC');
  ```
  `timeout 300 npx vitest run src/background/__tests__/contacts.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 14 passed (16)).

- **M2c** — NFKC dropped from the name comparison — `extension/src/background/contacts.ts`:

  ```diff
  - export const nameKey = (name: string): string => name.normalize('NFKC').toUpperCase().toLowerCase();
  + export const nameKey = (name: string): string => name.toUpperCase().toLowerCase();
  ```
  `timeout 300 npx vitest run src/background/__tests__/contacts.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 14 passed (16)).

- **M2d** — the delete no longer wipes the address book (WALLET_DATA_KEYS without CONTACTS_KEY) — `extension/src/background/accountsStore.ts`:

  ```diff
  - const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY];
  + const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY].filter(k => k !== CONTACTS_KEY);
  ```
  `timeout 300 npx vitest run src/background/__tests__/forgetWallet.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 27 passed (29)).

- **M2e** — contacts.set no longer refused while locked — `extension/src/background/contacts.ts`:

  ```diff
  -       if ((await getSession(ext)) === null) return 'locked';
  -       const list = await readContacts(ext);
  -       const key
  +       const list = await readContacts(ext);
  +       const key
  ```
  `timeout 300 npx vitest run src/background/__tests__/contacts.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 14 passed (16)).

- **M2f** — the 200 cap dropped — `extension/src/background/contacts.ts`:

  ```diff
  -       if (list.length >= MAX_CONTACTS) return 'full';
  + (deleted)
  ```
  `timeout 300 npx vitest run src/background/__tests__/contacts.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- **M2g** — a rename moves the contact to the front (position not kept) — `extension/src/background/contacts.ts`:

  ```diff
  -         list[at] = {address, name: clean};
  +         list.splice(at, 1), list.unshift({address, name: clean});
  ```
  `timeout 300 npx vitest run src/background/__tests__/contacts.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- **M2h** — label precedence: a contact wins over an own account — `extension/src/background/walletApi.ts`:

  ```diff
  -   const contact = own === undefined && recipient !== MAINNET_FEE_TREASURY ? await contactFor(ext, recipient) : null;
  -   const label =
  -     own !== undefined
  +   const contact = await contactFor(ext, recipient);
  +   const label =
  +     own !== undefined && contact === null
  ```
  `timeout 300 npx vitest run src/background/__tests__/recipientInfo.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 14 passed (15)).

- **M2i** — the gate no longer owns v1_contacts — `extension/scripts/check-vault-isolation.mjs`:

  ```diff
  - 'v1_balance_cache', 'v1_price_cache', 'v1_contacts'];
  + 'v1_balance_cache', 'v1_price_cache'];
  ```
  `timeout 300 npx vitest run scripts/__tests__/check-vault-isolation.test.mjs` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 413 passed (414)).

- **M2j** — a read keeps later duplicates of an address — `extension/src/background/contacts.ts`:

  ```diff
  -     if (!isAddress(address) || clean === null || seen.has(address)) continue;
  +     if (!isAddress(address) || clean === null) continue;
  ```
  `timeout 300 npx vitest run src/background/__tests__/contacts.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- **M2k** — the duplicate check counts the contact itself (a rename to its own name refused) — `extension/src/background/contacts.ts`:

  ```diff
  -       if (list.some(c => c.address !== address && nameKey(c.name) === key)) return 'duplicate-name';
  +       if (list.some(c => nameKey(c.name) === key)) return 'duplicate-name';
  ```
  `timeout 300 npx vitest run src/background/__tests__/contacts.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 15 passed (16)).

- [ ] **Step 6: Commit.**

```bash
git add extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/check-vault-isolation.mjs extension/src/app/__tests__/DeleteWallet.test.tsx extension/src/app/screens/DeleteWallet.tsx extension/src/background/__tests__/contacts.test.ts extension/src/background/__tests__/forgetWallet.test.ts extension/src/background/__tests__/messages.test.ts extension/src/background/__tests__/recipientInfo.test.ts extension/src/background/accountsStore.ts extension/src/background/contacts.ts extension/src/background/knownRecipients.ts extension/src/background/walletApi.ts extension/src/unlock/forgetFlow.ts
git commit -F - <<'MSG'
feat(extension): E17 — v1_contacts and contacts.*; the contact label; wiped on delete, kept on restore

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 3: The UI client: `engine.contacts` / `contactSet` / `contactRemove` (a missing `known` reads false), the contact label, the `contacts` route; the address book's display rules (C18 dust, when, search)

**Spec:** §1.4 (route), §2 E17 (the client's shape check, rev 3 L3), C18 (rev 3 L2), §6.1 (when, search, the singular), §8.1 rev 3

**Files:**
- Modify: `extension/src/app/__tests__/Switcher.test.tsx`
- Create: `extension/src/app/__tests__/addressBook.test.ts`
- Modify: `extension/src/app/__tests__/engine.test.ts`
- Modify: `extension/src/app/__tests__/router.test.ts`
- Create: `extension/src/app/addressBook.ts`
- Modify: `extension/src/app/engine.ts`
- Modify: `extension/src/app/router.ts`

**Interfaces:**
- Consumes: `createEngine`'s `call` and shape helpers (`src/app/engine.ts`), `routeReducer`'s `only()` rule (`src/app/router.ts`).
- Produces (as exported):
  - `src/app/engine.ts`: `export interface Contact {address: string; name: string; lastSentAt: number | null; known: boolean}`; `export interface ContactList {contacts: Contact[]; max: number}`; `Engine` gains `contacts(): Promise<Reply<ContactList, 'locked'>>`, `contactSet(address: string, name: string): Promise<Reply<{created: boolean}, 'malformed' | 'duplicate-name' | 'full' | 'locked'>>`, `contactRemove(address: string): Promise<Reply<null, 'malformed' | 'locked'>>`; `RecipientInfo['label']` gains `{kind: 'contact'; name: string}`.
  - `src/app/router.ts`: `Route` gains `{screen: 'contacts'; pick: boolean}` (exactly those keys); `SCREENS` gains `'contacts'`.
  - `src/app/addressBook.ts` (new): `export const DUST_FLOOR: Readonly<Record<Token, bigint>>`; `export function isDust(token: Token | null, amount: bigint | null): boolean`; `export function whenText(lastSentAt: number | null, now: number): string`; `export const AVATARS`; `export function avatarOf(address: string): (typeof AVATARS)[number]`; `export const initialOf = (name: string): string`; `export function searchContacts(contacts: readonly Contact[], query: string): Contact[]`; `export function markParts(name: string, query: string): [string, string, string] | null`; `export const contactsCount = (n: number): string`; `export const resultsLine = (n: number, query: string): string`. (Task 6 adds `fromBook`.)

Three engine calls with the client's usual shape checks: a reply of any other shape is `failed`. Rev 3 review L3: a contact row's `known` must be a boolean when present, and a **missing** `known` reads as `false` — the never-sent warning shows — never as `true`; any other value is `failed`. The `contacts` route carries `pick` and nothing else (§1.4: no route carries an address; the pick hands the address back through the `send` route's own draft, Task 6).

`addressBook.ts` holds the display rules, pure and unit-tested: C18's floors in base units compared as `bigint` (< 1 000 000 lamports, < 10 000 for USDC/USDT, < 1 000 000 000 for NOC; an amount or a token the decoder could not read is dust — fail closed); #15's "when" in local calendar days and months (O67–O70 and the design's "N days ago" / "last month" / "N months ago" / "never"; a time in the future reads "today"); the five avatar gradients chosen from the address; search by name or address, case-insensitive, with the name's first match split out for `<mark>`; "N results for "q"" with the adapted singular "1 result" (§6.1); and #31's meta "N contacts" — with **"1 contact" for one, a singular the O-list does not have (flagged for the owner, Scope 3.1)**. Switcher.test's stub engine gains the three methods (a type-only change).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/app/__tests__/Switcher.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Switcher.test.tsx b/extension/src/app/__tests__/Switcher.test.tsx
index 901037d..2a10ffb 100644
--- a/extension/src/app/__tests__/Switcher.test.tsx
+++ b/extension/src/app/__tests__/Switcher.test.tsx
@@ -33,6 +33,9 @@ function stubEngine(accounts: Account[], selected: number): Engine {
     settings: async () => ({ok: true, data: {autoLockMinutes: 5, reauthUsdCents: 0, selectedAccount: selected, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null}}),
     settingsSet: async () => ({ok: false, error: 'failed'}),
     order: async () => ({ok: false, error: 'failed'}),
+    contacts: async () => ({ok: true, data: {contacts: [], max: 200}}),
+    contactSet: async () => ({ok: false, error: 'failed'}),
+    contactRemove: async () => ({ok: false, error: 'failed'}),
     lock: async () => ({ok: true, data: null}),
     ping: async () => ({ok: true, data: null}),
   };
````

Create `extension/src/app/__tests__/addressBook.test.ts`:

````ts
import {AVATARS, DUST_FLOOR, avatarOf, contactsCount, initialOf, isDust, markParts, resultsLine, searchContacts, whenText} from '../addressBook';
import type {Contact} from '../engine';

// B1b-2b §6: the address book's display rules. C18's floors are base units compared as bigint (rev 3, review L2).
describe('C18: the dust floor, in base units', () => {
  it('pins the four floors: 0.001 SOL, 0.01 USDC and USDT, 1 NOC', () => {
    expect(DUST_FLOOR).toEqual({SOL: 1_000_000n, USDC: 10_000n, USDT: 10_000n, NOC: 1_000_000_000n});
  });

  it.each([
    ['SOL', 999_999n, true],
    ['SOL', 1_000_000n, false],
    ['USDC', 9_999n, true],
    ['USDC', 10_000n, false],
    ['USDT', 9_999n, true],
    ['USDT', 10_000n, false],
    ['NOC', 999_999_999n, true],
    ['NOC', 1_000_000_000n, false],
    ['SOL', 0n, true],
    ['NOC', 18_446_744_073_709_551_615n, false],
  ] as const)('%s %s → dust %s', (token, amount, dust) => {
    expect(isDust(token, amount)).toBe(dust);
  });

  it('fails closed: an amount or a token the decoder could not read is dust', () => {
    expect(isDust('SOL', null)).toBe(true);
    expect(isDust(null, 5_000_000_000n)).toBe(true);
  });
});

describe('#15 when (ix:7522: relative natural language)', () => {
  // Local wall-clock dates (the rule reads calendar days and months in local time).
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
  const NOW = at(2026, 5, 8, 9);
  it.each([
    [null, 'never'],
    [at(2026, 5, 8, 1), 'today'],
    [at(2026, 5, 9), 'today'],
    [at(2026, 5, 7, 23), 'yesterday'],
    [at(2026, 5, 5), '3 days ago'],
    [at(2026, 4, 26), '12 days ago'],
    [at(2026, 4, 9), '29 days ago'],
    [at(2026, 4, 8), 'last month'],
    [at(2026, 3, 9), 'last month'],
    [at(2026, 3, 8), '2 months ago'],
    [at(2025, 9, 8), '8 months ago'],
    [at(2025, 5, 9), '11 months ago'],
    [at(2025, 5, 8), 'last year'],
    [at(2024, 5, 9), 'last year'],
    [at(2024, 5, 8), '2 years ago'],
  ] as const)('%s → %s', (when, text) => {
    expect(whenText(when, NOW)).toBe(text);
  });
});

describe('#15 rows and search', () => {
  const C = (address: string, name: string): Contact => ({address, name, lastSentAt: null, known: false});
  const MARKO = C('Gabc1111111111111111111111111111111111xyz9', 'Marko · Mom');
  const BISTRO = C('3jkLm22222222222222222222222222222222pT8c', 'Bistro · for Marketing');
  const TINA = C('8qWeR33333333333333333333333333333333fD2x', 'Tina');

  it('search: by name or address, case-insensitive; an empty query is everything', () => {
    expect(searchContacts([MARKO, BISTRO, TINA], 'mark')).toEqual([MARKO, BISTRO]);
    expect(searchContacts([MARKO, BISTRO, TINA], 'FD2X')).toEqual([TINA]);
    expect(searchContacts([MARKO, BISTRO, TINA], '  ')).toEqual([MARKO, BISTRO, TINA]);
    expect(searchContacts([MARKO, BISTRO, TINA], 'zzz')).toEqual([]);
  });

  it('markParts: the first case-insensitive match in the name, or null for an address match', () => {
    expect(markParts('Marko · Mom', 'mark')).toEqual(['', 'Mark', 'o · Mom']);
    expect(markParts('Bistro · for Marketing', 'mark')).toEqual(['Bistro · for ', 'Mark', 'eting']);
    expect(markParts('Tina', 'fd2x')).toBeNull();
    expect(markParts('Tina', '')).toBeNull();
  });

  it('avatar: one of the design’s five gradients, always the same for an address; the initial is one whole character', () => {
    expect(AVATARS).toEqual(['violet', 'mint', 'coral', 'amber', 'blue']);
    expect(avatarOf(MARKO.address)).toBe(avatarOf(MARKO.address));
    expect(new Set([MARKO, BISTRO, TINA].map(c => avatarOf(c.address))).size).toBeGreaterThan(1);
    expect(initialOf('marko')).toBe('M');
    expect(initialOf('😀 Party')).toBe('😀');
  });

  it('counts: "N contacts" / "1 contact"; "N results for "q"" / "1 result for "q""', () => {
    expect(contactsCount(7)).toBe('7 contacts');
    expect(contactsCount(1)).toBe('1 contact');
    expect(contactsCount(0)).toBe('0 contacts');
    expect(resultsLine(2, 'mark')).toBe('2 results for "mark"');
    expect(resultsLine(1, 'mark ')).toBe('1 result for "mark"');
  });
});
````

Modify `extension/src/app/__tests__/engine.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/engine.test.ts b/extension/src/app/__tests__/engine.test.ts
index e04b92c..937eab9 100644
--- a/extension/src/app/__tests__/engine.test.ts
+++ b/extension/src/app/__tests__/engine.test.ts
@@ -50,6 +50,25 @@ describe('the B1b-2b client calls against the real background', () => {
   });
 });
 
+describe('the B1b-2b plan 2 client calls (E17) against the real background', () => {
+  it('contacts, contactSet, contactRemove: typed replies and refusals; recipientInfo carries the contact label', async () => {
+    const {engine} = await wired();
+    expect(await engine.contacts()).toEqual({ok: true, data: {contacts: [], max: 200}});
+    expect(await engine.contactSet(RECIPIENT, 'Marko')).toEqual({ok: true, data: {created: true}});
+    expect(await engine.contactSet(RECIPIENT, 'Marko · Mom')).toEqual({ok: true, data: {created: false}});
+    expect(await engine.contacts()).toEqual({ok: true, data: {contacts: [{address: RECIPIENT, name: 'Marko · Mom', lastSentAt: null, known: false}], max: 200}});
+    expect(await engine.recipientInfo(ACCOUNT.publicKey, RECIPIENT)).toEqual({ok: true, data: {known: false, lastSentAt: null, label: {kind: 'contact', name: 'Marko · Mom'}, self: false}});
+    expect(await engine.contactSet('nope', 'X')).toEqual({ok: false, error: 'malformed'});
+    expect(await engine.contactSet(ACCOUNT.publicKey, 'marko · MOM')).toEqual({ok: false, error: 'duplicate-name'});
+    expect(await engine.contactRemove(RECIPIENT)).toEqual({ok: true, data: null});
+    expect(await engine.contacts()).toEqual({ok: true, data: {contacts: [], max: 200}});
+    const locked = await wired({}, false);
+    expect(await locked.engine.contacts()).toEqual({ok: false, error: 'locked'});
+    expect(await locked.engine.contactSet(RECIPIENT, 'X')).toEqual({ok: false, error: 'locked'});
+    expect(await locked.engine.contactRemove(RECIPIENT)).toEqual({ok: false, error: 'locked'});
+  });
+});
+
 describe('the message client against the real background', () => {
   it('state, settings, ping, lock', async () => {
     const {engine} = await wired();
@@ -161,6 +180,29 @@ describe('shape checks: a reply of the wrong shape is failed', () => {
     }
   });
 
+  // B1b-2b E17, rev 3 review L3: `known` must be a boolean when present, and a MISSING `known` reads as false — the
+  // warning shows — never as true.
+  it('contacts: a missing known is false; any other non-boolean, a bad address, a bad lastSentAt or no max is failed', async () => {
+    const row = {address: acc, name: 'Marko', lastSentAt: null, known: true};
+    expect(await engineAnswering({ok: true, data: {contacts: [row], max: 200}}).contacts()).toEqual({ok: true, data: {contacts: [row], max: 200}});
+    const {known: _k, ...noKnown} = row;
+    expect(await engineAnswering({ok: true, data: {contacts: [noKnown], max: 200}}).contacts()).toEqual({ok: true, data: {contacts: [{...row, known: false}], max: 200}});
+    for (const bad of [{known: 'yes'}, {known: 1}, {known: null}, {address: '0OIl'}, {name: 7}, {lastSentAt: -1}, {lastSentAt: '5'}]) {
+      expect(await engineAnswering({ok: true, data: {contacts: [{...row, ...bad}], max: 200}}).contacts()).toEqual({ok: false, error: 'failed'});
+    }
+    expect(await engineAnswering({ok: true, data: {contacts: [row]}}).contacts()).toEqual({ok: false, error: 'failed'});
+    expect(await engineAnswering({ok: true, data: {created: 'yes'}}).contactSet(acc, 'x')).toEqual({ok: false, error: 'failed'});
+    expect(await engineAnswering({ok: false, error: 'exploded'}).contactSet(acc, 'x')).toEqual({ok: false, error: 'failed'});
+  });
+
+  it('recipientInfo: a contact label needs a string name; an unknown label kind is failed', async () => {
+    const base = {known: false, lastSentAt: null, self: false};
+    expect(await engineAnswering({ok: true, data: {...base, label: {kind: 'contact', name: 'M'}}}).recipientInfo(acc, acc)).toEqual({ok: true, data: {...base, label: {kind: 'contact', name: 'M'}}});
+    for (const label of [{kind: 'contact'}, {kind: 'contact', name: 3}, {kind: 'friend', name: 'M'}]) {
+      expect(await engineAnswering({ok: true, data: {...base, label}}).recipientInfo(acc, acc)).toEqual({ok: false, error: 'failed'});
+    }
+  });
+
   it('prices: zero is not a price (null is)', async () => {
     expect(await engineAnswering({ok: true, data: {sol: 0, usdc: 1, usdt: 1, noc: null, at: 1}}).prices()).toEqual({ok: false, error: 'failed'});
     expect((await engineAnswering({ok: true, data: {sol: null, usdc: 1, usdt: 1, noc: null, at: 1}}).prices()).ok).toBe(true);
````

Modify `extension/src/app/__tests__/router.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/router.test.ts b/extension/src/app/__tests__/router.test.ts
index cad92e8..898da1f 100644
--- a/extension/src/app/__tests__/router.test.ts
+++ b/extension/src/app/__tests__/router.test.ts
@@ -18,7 +18,7 @@ describe('the router', () => {
   });
 
   it('the pushable screens are a closed list; the hand-over screens are first routes only; the flow screens own their Esc', () => {
-    expect([...SCREENS].sort()).toEqual(['about', 'accounts', 'confirm', 'delete', 'passkey', 'receive', 'review', 'security', 'send', 'status', 'tab', 'tx']);
+    expect([...SCREENS].sort()).toEqual(['about', 'accounts', 'confirm', 'contacts', 'delete', 'passkey', 'receive', 'review', 'security', 'send', 'status', 'tab', 'tx']);
     expect([...TAB_ONLY].sort()).toEqual(['created', 'imported', 'resume']);
     expect([...FLOW].sort()).toEqual(['confirm', 'resume', 'review', 'send', 'status']);
     for (const route of [{screen: 'created'}, {screen: 'imported'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
@@ -38,6 +38,15 @@ describe('the router', () => {
     }
   });
 
+  // B1b-2b §1.4, plan 2: #15 carries `pick` and nothing else — never an address, a name or a draft (the pick hands the
+  // address back through the send route's own draft, review M4).
+  it('B1b-2b plan 2: contacts carries exactly {screen, pick: boolean}', () => {
+    for (const pick of [true, false]) expect(routeReducer(HOME, {type: 'push', route: {screen: 'contacts', pick}})).toEqual([...HOME, {screen: 'contacts', pick}]);
+    for (const bad of [{screen: 'contacts'}, {screen: 'contacts', pick: 'yes'}, {screen: 'contacts', pick: true, address: ADDR}, {screen: 'contacts', pick: false, draft: null}]) {
+      expect(routeReducer(HOME, {type: 'push', route: bad as unknown as Route})).toBe(HOME);
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
npx vitest run src/app/__tests__/Switcher.test.tsx src/app/__tests__/addressBook.test.ts src/app/__tests__/engine.test.ts src/app/__tests__/router.test.ts
```
Expected (dry run, these test files on Task 2's tree): **red** — Test Files  3 failed | 1 passed (4) · Tests  5 failed | 64 passed (69). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Create `extension/src/app/addressBook.ts`:

````ts
import type {Contact, Token} from './engine';

/**
 * The address book's display rules (B1b-2b §6): pure functions, no engine. What decides anything — a contact's
 * `known`, its `lastSentAt`, whether a name is taken — comes from the background (E17); these only choose words.
 */

/**
 * C18 (rev 2, review H3; rev 3, review L2): a received amount below these floors is "tiny" — 0.001 SOL, 0.01 USDC or
 * USDT, 1 NOC — in base units, compared as bigint (cardinal rule 2). It only chooses which warning #27c's "Save sender"
 * sheet shows (O78 + "Save anyway"); nothing is refused.
 */
export const DUST_FLOOR: Readonly<Record<Token, bigint>> = {SOL: 1_000_000n, USDC: 10_000n, USDT: 10_000n, NOC: 1_000_000_000n};

/** Dust (C18): below the token's floor — and, failing closed, an amount or a token the decoder could not read (null). */
export function isDust(token: Token | null, amount: bigint | null): boolean {
  if (token === null || amount === null) return true;
  return amount < DUST_FLOOR[token];
}

const dayStart = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * #15's "last sent" (ix:7522: relative natural language, no numerals beyond the count): "today" (O67), "yesterday"
 * (O68), "N days ago" (ix:7398), "last month" (ix:7408), "N months ago" (ix:7413), "last year" (O69), "N years ago"
 * (O70), "never" (ix:7418). Calendar days and months in local time (UTC stored, local only here — cardinal rule 3); a
 * time in the future (a clock set back) reads "today".
 */
export function whenText(lastSentAt: number | null, now: number): string {
  if (lastSentAt === null) return 'never';
  const days = Math.round((dayStart(now) - dayStart(lastSentAt)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  const a = new Date(lastSentAt);
  const n = new Date(now);
  const months = (n.getFullYear() - a.getFullYear()) * 12 + (n.getMonth() - a.getMonth()) - (n.getDate() < a.getDate() ? 1 : 0);
  if (months < 1) return `${days} days ago`;
  if (months === 1) return 'last month';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'last year' : `${years} years ago`;
}

/** The design's five avatar gradients (ix:1440-1444), chosen from the address so a contact keeps its colour. */
export const AVATARS = ['violet', 'mint', 'coral', 'amber', 'blue'] as const;
export function avatarOf(address: string): (typeof AVATARS)[number] {
  let sum = 0;
  for (let i = 0; i < address.length; i++) sum += address.charCodeAt(i);
  return AVATARS[sum % AVATARS.length] ?? 'violet';
}

/** The name's first character, upper-cased (a whole code point: an emoji or an astral letter is not cut in half). */
export const initialOf = (name: string): string => (Array.from(name)[0] ?? '').toUpperCase();

/** #15's search: by name or by address, case-insensitive (§6.1). An empty query matches everything. */
export function searchContacts(contacts: readonly Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...contacts];
  return contacts.filter(c => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q));
}

/**
 * The name split around the first case-insensitive match of the query, for `<mark>` (ix:7483): null when the name does
 * not contain it (an address match), or when lower-casing changed the name's length (no safe index to cut at).
 */
export function markParts(name: string, query: string): [string, string, string] | null {
  const q = query.trim();
  const lower = name.toLowerCase();
  if (q === '' || lower.length !== name.length) return null;
  const at = lower.indexOf(q.toLowerCase());
  if (at < 0) return null;
  return [name.slice(0, at), name.slice(at, at + q.length), name.slice(at + q.length)];
}

/** #31's "Address book" meta: "N contacts" (ix:13552); "1 contact" for one (the singular — for the owner to confirm). */
export const contactsCount = (n: number): string => (n === 1 ? '1 contact' : `${n} contacts`);

/** #15's search overline (ix:7480): "N results for "q"", "1 result for "q"" (→ adapted singular, §6.1). */
export const resultsLine = (n: number, query: string): string => `${n} ${n === 1 ? 'result' : 'results'} for "${query.trim()}"`;
````

Modify `extension/src/app/engine.ts`:

````diff
diff --git a/extension/src/app/engine.ts b/extension/src/app/engine.ts
index 0673c00..da0461b 100644
--- a/extension/src/app/engine.ts
+++ b/extension/src/app/engine.ts
@@ -132,9 +132,22 @@ export type SettingsPatch = {autoLockMinutes?: number; reauthUsdCents?: number};
 export interface RecipientInfo {
   known: boolean;
   lastSentAt: number | null;
-  label: {kind: 'own'; index: number; name: string} | {kind: 'treasury'} | null;
+  /** Precedence own > treasury > contact (B1b-2b E17): the background chooses; a contact's label never says "known". */
+  label: {kind: 'own'; index: number; name: string} | {kind: 'treasury'} | {kind: 'contact'; name: string} | null;
   self: boolean;
 }
+/** B1b-2b E17: a saved contact, with E6's facts about its address (never the book's: a contact is not "known", D19). */
+export interface Contact {
+  address: string;
+  name: string;
+  lastSentAt: number | null;
+  /** The background's `known` (isKnownRecipient). A reply without it reads as false — the never-sent warning shows (rev 3, L3). */
+  known: boolean;
+}
+export interface ContactList {
+  contacts: Contact[];
+  max: number;
+}
 
 type Network = 'unreachable' | 'coordinator-refused';
 type SendRefusal =
@@ -175,6 +188,12 @@ export interface Engine {
   settingsSet(patch: SettingsPatch): Promise<Reply<Settings, 'malformed' | 'locked' | 'reauth-required'>>;
   /** accounts.order (B1b-2b E14): a permutation of the stored indexes; `stale` when the set changed. */
   order(order: number[]): Promise<Reply<null, 'malformed' | 'stale' | 'no-wallet'>>;
+  /** contacts.list (B1b-2b E17): newest first; refused while locked (C12). */
+  contacts(): Promise<Reply<ContactList, 'locked'>>;
+  /** contacts.set: adds (`created: true`) or renames the contact saved for this address (C12, C19). */
+  contactSet(address: string, name: string): Promise<Reply<{created: boolean}, 'malformed' | 'duplicate-name' | 'full' | 'locked'>>;
+  /** contacts.remove: ok also when the address was not saved. */
+  contactRemove(address: string): Promise<Reply<null, 'malformed' | 'locked'>>;
   lock(): Promise<Reply<null, never>>;
   ping(): Promise<Reply<null, never>>;
 }
@@ -414,12 +433,38 @@ function recipientInfoOf(x: unknown): RecipientInfo | undefined {
     const l = obj(o.label);
     if (l?.kind === 'treasury') label = {kind: 'treasury'};
     else if (l?.kind === 'own' && isInt(l.index) && typeof l.name === 'string') label = {kind: 'own', index: l.index, name: l.name};
+    else if (l?.kind === 'contact' && typeof l.name === 'string') label = {kind: 'contact', name: l.name};
     else label = undefined;
   }
   if (lastSentAt === undefined || label === undefined) return undefined;
   return {known: o.known, lastSentAt, label, self: o.self};
 }
 
+/**
+ * A contact row. `known` must be a boolean when present; a MISSING `known` reads as false (rev 3, review L3): the
+ * never-sent warning then shows — a reply can never make an address look sent-to by leaving the field out.
+ */
+function contactOf(x: unknown): Contact | undefined {
+  const o = obj(x);
+  if (o === undefined || !isAddress(o.address) || typeof o.name !== 'string') return undefined;
+  const lastSentAt = o.lastSentAt === null ? null : isTime(o.lastSentAt) ? o.lastSentAt : undefined;
+  const known = o.known === undefined ? false : typeof o.known === 'boolean' ? o.known : undefined;
+  if (lastSentAt === undefined || known === undefined) return undefined;
+  return {address: o.address, name: o.name, lastSentAt, known};
+}
+
+function contactListOf(x: unknown): ContactList | undefined {
+  const o = obj(x);
+  const contacts = all(o?.contacts, contactOf);
+  if (o === undefined || contacts === undefined || !isInt(o.max)) return undefined;
+  return {contacts, max: o.max};
+}
+
+function createdOf(x: unknown): {created: boolean} | undefined {
+  const o = obj(x);
+  return o !== undefined && typeof o.created === 'boolean' ? {created: o.created} : undefined;
+}
+
 const nothing = (x: unknown): null | undefined => (x === undefined ? null : undefined);
 
 // ── The transport ─────────────────────────────────────────────────────────────────────────────
@@ -489,6 +534,9 @@ export function createEngine(transport: Transport = runtimeSend, sleep: (ms: num
     settings: () => call({type: 'settings.get'}, [], settingsOf),
     settingsSet: patch => call({type: 'settings.set', patch}, ['malformed', 'locked', 'reauth-required'], settingsOf),
     order: order => call({type: 'accounts.order', order}, ['malformed', 'stale', 'no-wallet'], nothing),
+    contacts: () => call({type: 'contacts.list'}, ['locked'], contactListOf),
+    contactSet: (address, name) => call({type: 'contacts.set', address, name}, ['malformed', 'duplicate-name', 'full', 'locked'], createdOf),
+    contactRemove: address => call({type: 'contacts.remove', address}, ['malformed', 'locked'], nothing),
     lock: () => call({type: 'vault.lock'}, [], nothing),
     ping: () => call({type: 'activity.ping'}, [], nothing),
   };
````

Modify `extension/src/app/router.ts`:

````diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index 3fbb0dd..9ebd64d 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -26,6 +26,11 @@ export type Route =
   | {screen: 'accounts'}
   | {screen: 'passkey'}
   | {screen: 'delete'}
+  /**
+   * B1b-2b §1.4, plan 2: #15 address book. `pick`: opened from #12's contact icon — a row tap hands the address back
+   * through the `send` route's own draft (a reset, review M4), never through a key of this route.
+   */
+  | {screen: 'contacts'; pick: boolean}
   | {screen: 'send'; draft: Draft | null; notice: 'start-again' | null}
   | {screen: 'review'; account: string; intent: Intent; notice: 'confirmation-expired' | null}
   | {screen: 'confirm'; account: string; entry: 'flow'; preparedId: string}
@@ -36,7 +41,7 @@ export type Route =
   | {screen: 'resume'; account: string};
 export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};
 
-export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status', 'security', 'accounts', 'passkey', 'delete']);
+export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status', 'security', 'accounts', 'passkey', 'delete', 'contacts']);
 /** B1b-2b: the settings screens carry nothing but their name — no secret, no challenge, no address to act on. */
 const BARE: ReadonlySet<string> = new Set<Route['screen']>(['security', 'accounts', 'passkey', 'delete']);
 /** The send flow's screens: each handles Esc itself (#19 discards first, #20 keeps, #21 has no back while open). */
@@ -57,6 +62,7 @@ function isRoute(r: unknown): r is Route {
   if (typeof o.screen !== 'string' || !SCREENS.has(o.screen)) return false;
   if (o.screen === 'tab') return typeof o.tab === 'string' && TABS.has(o.tab);
   if (BARE.has(o.screen)) return only(o, ['screen']);
+  if (o.screen === 'contacts') return only(o, ['screen', 'pick']) && typeof o.pick === 'boolean';
   // #27 carries the account whose history the signature came from: its [Try again] is offered only while that account is selected (fix round 1).
   if (o.screen === 'tx') return only(o, ['screen', 'signature', 'account']) && typeof o.signature === 'string' && o.signature.length > 0 && isAddress(o.account);
   if (o.screen === 'send') return only(o, ['screen', 'draft', 'notice']) && (o.draft === null || isDraft(o.draft)) && (o.notice === null || o.notice === 'start-again');
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/Switcher.test.tsx src/app/__tests__/addressBook.test.ts src/app/__tests__/engine.test.ts src/app/__tests__/router.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  4 passed (4) · Tests  100 passed (100); tsc clean; whole suite Test Files  135 passed (135) · Tests  2642 passed (2642); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red.

- **M3a** — a missing `known` reads as true (rev 3, review L3) — `extension/src/app/engine.ts`:

  ```diff
  -   const known = o.known === undefined ? false : typeof o.known === 'boolean' ? o.known : undefined;
  +   const known = o.known === undefined ? true : typeof o.known === 'boolean' ? o.known : undefined;
  ```
  `timeout 300 npx vitest run src/app/__tests__/engine.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 24 passed (25)).

- **M3b** — the contact label kind not parsed — `extension/src/app/engine.ts`:

  ```diff
  -     else if (l?.kind === 'contact' && typeof l.name === 'string') label = {kind: 'contact', name: l.name};
  + (deleted)
  ```
  `timeout 300 npx vitest run src/app/__tests__/engine.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 23 passed (25)).

- **M3c** — the contacts route accepts any key — `extension/src/app/router.ts`:

  ```diff
  -   if (o.screen === 'contacts') return only(o, ['screen', 'pick']) && typeof o.pick === 'boolean';
  +   if (o.screen === 'contacts') return typeof o.pick === 'boolean';
  ```
  `timeout 300 npx vitest run src/app/__tests__/router.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 32 passed (33)).

- **M3d** — the floor itself counted as dust (C18 boundary) — `extension/src/app/addressBook.ts`:

  ```diff
  -   return amount < DUST_FLOOR[token];
  +   return amount <= DUST_FLOOR[token];
  ```
  `timeout 300 npx vitest run src/app/__tests__/addressBook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  4 failed | 27 passed (31)).

- **M3e** — an undecodable amount is not dust (fail open, rev 3 L2) — `extension/src/app/addressBook.ts`:

  ```diff
  -   if (token === null || amount === null) return true;
  +   if (token === null || amount === null) return false;
  ```
  `timeout 300 npx vitest run src/app/__tests__/addressBook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- **M3f** — months counted without the day of the month — `extension/src/app/addressBook.ts`:

  ```diff
  -  - (n.getDate() < a.getDate() ? 1 : 0);
  + ;
  ```
  `timeout 300 npx vitest run src/app/__tests__/addressBook.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  5 failed | 26 passed (31)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/app/__tests__/Switcher.test.tsx extension/src/app/__tests__/addressBook.test.ts extension/src/app/__tests__/engine.test.ts extension/src/app/__tests__/router.test.ts extension/src/app/addressBook.ts extension/src/app/engine.ts extension/src/app/router.ts
git commit -F - <<'MSG'
feat(extension): the contacts client (missing known reads false), the contacts route, the address book's display rules

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 4: The contact sheet (§6.2): add prefilled / empty, edit, delete confirm; never sent (O72), only sent to you (O77), dust (O78 + Save anyway); every error

**Spec:** §6.2, D20, C12, C18, C19, review H3; §7 (rule 6: the sheet's Save / Delete); §8.2 (the sheet's states)

**Files:**
- Create: `extension/src/app/__tests__/ContactSheet.test.tsx`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/screens/Switcher.tsx`
- Create: `extension/src/app/ui/ContactSheet.tsx`
- Modify: `extension/src/app/ui/Sheet.tsx`

**Interfaces:**
- Consumes: `Sheet` (`src/app/ui/Sheet.tsx`), `LockedButton`, `Banner`, `AddressGroups` (`web/src/ui/AddressGroups.tsx`), `isAddressText` (`src/app/send/rules.ts`), `cleanName`, `isDust`, `engine.recipientInfo` / `contactSet` / `contactRemove`, `SEND_TEXT.pasteRefused` (the plan-3 owner-confirmed paste line).
- Produces (as exported):
  - `src/app/ui/ContactSheet.tsx` (new): `export const CONTACT_TEXT`; `export type ContactSheetMode = {kind: 'add'; address: string | null; name?: string; typed?: string} | {kind: 'edit'; address: string; name: string}`; `export function ContactSheet(props: {mode: ContactSheetMode; received?: {token: Token | null; amount: bigint | null}; onSaved: (contact: {address: string; name: string}) => void; onDeleted?: (address: string) => void; onClose: () => void})`.
  - `src/app/ui/Sheet.tsx`: `Sheet` gains `tall?: boolean`, opens on the element marked `data-autofocus` when its content has one, and runs its focus/key effect once (the latest `onClose` in a ref — review H1).
  - `src/app/screens/Switcher.tsx`: `export const NAME_RULE` — 2a's name rule, used by `RENAME_ERRORS.malformed` and `CONTACT_TEXT.badName` (review L6).

The sheet is where an address enters the book, so it says what is known about it (review H3). Every state shows the **full address in groups of four** (read-only when prefilled; under the field once a typed one is valid). "You have never sent to this address." (O72) shows for any address `wallet.recipientInfo` does not answer `known: true` — **including while it has not answered** (fail closed: silence never reads as known). Opened from #27c's "Save sender" (`received`), the line reads "…— it only sent to you." (O77), and for a transfer below C18's floor — or one whose amount or token could not be decoded — a `.banner.danger` (O78) sits above the name and Save reads "Save anyway" (O79): warned, not refused (the user may know the sender). Errors: a name `cleanName` refuses (checked before anything is sent; 2a's line, which C19's characters fall under), `duplicate-name` (O85), an address that is not one (O86, live, Save disabled), `full` (O87), anything else 2a's "Something went wrong. Try again.". Edit has the "Delete contact" tertiary in `--danger`, and its confirm "Delete this contact?" with [Keep] / [Delete] (O82–O84); the confirm also shows the name and the address it deletes (no new copy). Save and Delete are LockedButtons (rule 6); an answer that lands after the sheet closed calls nothing (`alive`, pinned by a test that hides the sheet while a save is held).

Two changes to the shared `Sheet`, both found by the dry run: it focused its grabber on open, overriding React's `autoFocus` (which runs before the parent's effect) — it now focuses an element marked `data-autofocus` when there is one (the name when prefilled, the address field when empty); and at the design's 70 % the contact sheet's content (address, warnings, field, buttons) did not fit the 412 × 600 popup, so the body scrolled and the focused name field pushed **the address being saved** out of view — `tall` lets this sheet take the popup's height but 48 px, and Cancel / Save sit side by side (the design's `.sticky-bar.row` pattern; stacked, the dust state ran past the panel). Both are declared (Scope 3.2, 3.3); Task 10's visual pass asserts the address, the dust banner and "Save anyway" are all in view on open.

**Review 1 (rev 2).** **H1:** the Sheet's effect was keyed on `onClose`, and every caller passes an inline one while the screen beneath re-renders on its clock (#20 every second, #15 and #27 every 30 s, #15 every 2 s with a send open): each render re-ran the effect, which focused `data-autofocus` again — on #15's add sheet the rest of a name was typed into the **address** field, on #20 a keyboard user could not stay on Save or Cancel. The effect now runs once and reads the latest `onClose` from a ref (as `useEscape` does); tests re-render a ticking parent and assert the caret stays in Name and on Cancel, and that Esc and the backdrop still reach the latest `onClose`; M4h (the `[onClose]` key back) is red. **M2:** the delete confirm swaps the content under the same Sheet (so its opener, for the focus on close, is kept); an effect moves the focus to Keep on entering it and back to "Delete contact" on Keep — it was left on `body`, from where Tab reached the screen behind the modal; M4i. **L1:** `typed` seeds the address input (#15's search query when it is an address, Task 5). **L2:** the typed-mode address groups lose their `aria-label` (the input is labelled; `getByLabel('Address')` stays unique). **L6:** the name rule is 2a's `NAME_RULE`, one literal.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/ContactSheet.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {useState} from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {base58} from '@scure/base';
import {ContactSheet, CONTACT_TEXT, type ContactSheetMode} from '../ui/ContactSheet';
import {renderInWallet} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {CONTACTS_KEY} from '../../background/contacts';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {lock} from '../../background/autolock';
import type {Token} from '../engine';

// B1b-2b §6.2 (D20, C12, C18, C19; review H3): the contact sheet — every state, against the real background.
const SELECTORS = selectorsOf(UI_SHEETS);
const SENDER = 'H4qZoWSv5iyeysmHzYnVfqVBtSfoJTZQJ33YtjAXm2N1';
const OTHER = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const addr = (n: number): string => base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? n + 1 : 7)));
const groupsOf = (a: string) => a.match(/.{1,4}/g) ?? [];
const shownGroups = () => [...document.querySelectorAll('.app-contact-addr .addr-groups > span')].map(s => s.textContent);
const nameField = () => document.getElementById('contact-name') as HTMLInputElement;
const save = () => screen.getByRole('button', {name: /^Save/});

type Over = {mode?: ContactSheetMode; received?: {token: Token | null; amount: bigint | null}; onSaved?: (c: {address: string; name: string}) => void; onDeleted?: (a: string) => void; onClose?: () => void};
function sheet(o: Over = {}) {
  return <ContactSheet mode={o.mode ?? {kind: 'add', address: SENDER}} received={o.received} onSaved={o.onSaved ?? (() => undefined)} onDeleted={o.onDeleted} onClose={o.onClose ?? (() => undefined)} />;
}

describe('the contact sheet: add · prefilled', () => {
  it('title, the full address read-only in groups of four, Name focused, Save and Cancel; never sent → O72', async () => {
    await renderInWallet(sheet());
    expect(screen.getByRole('dialog', {name: 'Add contact'})).toBeTruthy();
    expect(screen.getByText('Address')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(shownGroups()).toEqual(groupsOf(SENDER));
    expect(document.getElementById('contact-address')).toBeNull();
    expect(document.activeElement).toBe(nameField());
    expect(nameField().maxLength).toBe(32);
    expect(await screen.findByText('You have never sent to this address.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Save'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeTruthy();
    expect(screen.queryByText('Delete contact')).toBeNull();
    // The tall panel (the address, its warnings, a field and the buttons fit at 412 × 600; visual pass).
    expect(document.querySelector('.s8-sheet')?.className).toBe('s8-sheet app-sheet-tall');
    expect(unstyledClasses(document.querySelector('.s8-sheet')!, SELECTORS)).toEqual([]);
  });

  // Fail closed (rev 3, L3's spirit): until wallet.recipientInfo answers, the line shows — and from #27c the dust banner
  // and "Save anyway" too. Silence never reads as "known".
  it('fail closed: while recipientInfo has not answered, O72 shows; from #27c, O77, the dust banner and "Save anyway"', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    const hold = {gate: (m: unknown) => ((m as {type: string}).type === 'wallet.recipientInfo' ? held : undefined)};
    await renderInWallet(sheet(), {...hold, before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: SENDER, at: 1}])});
    expect(screen.getByText('You have never sent to this address.')).toBeTruthy();
    release();
    // Known once it answers: the line goes.
    await waitFor(() => expect(screen.queryByText('You have never sent to this address.')).toBeNull());
  });

  it('fail closed from #27c: before the answer, O77, the dust banner and "Save anyway" for a dust transfer', async () => {
    const held = new Promise<void>(() => undefined);
    await renderInWallet(sheet({received: {token: 'USDC', amount: 1n}}), {gate: m => ((m as {type: string}).type === 'wallet.recipientInfo' ? held : undefined)});
    expect(screen.getByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
    expect(document.querySelector('.banner.danger')).not.toBeNull();
    expect(save().textContent).toBe('Save anyway');
  });

  it('an address this wallet sent to: no never-sent line once recipientInfo answers known (positive control)', async () => {
    await renderInWallet(sheet(), {before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: SENDER, at: 1}])});
    await waitFor(() => expect(screen.queryByText('You have never sent to this address.')).toBeNull());
    expect(shownGroups()).toEqual(groupsOf(SENDER));
  });

  it('Save stores the trimmed name and hands the contact back', async () => {
    const onSaved = vi.fn();
    const w = await renderInWallet(sheet({onSaved}));
    fireEvent.change(nameField(), {target: {value: '  Supplier  '}});
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({address: SENDER, name: 'Supplier'}));
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: SENDER, name: 'Supplier'}]);
  });

  it('Cancel and Esc close without saving', async () => {
    const onClose = vi.fn();
    const w = await renderInWallet(sheet({onClose}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(await w.ext.local.get(CONTACTS_KEY)).toBeUndefined();
  });
});

describe('the contact sheet from #27c "Save sender" (review H3, C18)', () => {
  it('only sent to you: O77 in place of O72, no banner, a plain Save', async () => {
    await renderInWallet(sheet({received: {token: 'USDC', amount: 250_000_000n}}));
    expect(await screen.findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
    expect(screen.queryByText('You have never sent to this address.')).toBeNull();
    expect(document.querySelector('.banner.danger')).toBeNull();
    expect(save().textContent).toBe('Save');
  });

  it.each([
    ['USDC', 9_999n],
    ['SOL', 999_999n],
    ['NOC', 999_999_999n],
    ['USDT', null],
    [null, 5_000_000_000n],
  ] as const)('dust (%s %s): the danger banner O78 above Name, O77, and "Save anyway" — saving is not refused', async (token, amount) => {
    const onSaved = vi.fn();
    await renderInWallet(sheet({received: {token, amount}, onSaved}));
    const banner = document.querySelector('.banner.danger');
    expect(banner?.textContent).toBe(CONTACT_TEXT.dust);
    expect(banner?.compareDocumentPosition(nameField()) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(await screen.findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
    expect(save().textContent).toBe('Save anyway');
    fireEvent.change(nameField(), {target: {value: 'Binance'}});
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({address: SENDER, name: 'Binance'}));
    expect(unstyledClasses(document.querySelector('.s8-sheet')!, SELECTORS)).toEqual([]);
  });

  it('the floor itself is not dust: USDC 10 000 base units → no banner, a plain Save', async () => {
    await renderInWallet(sheet({received: {token: 'USDC', amount: 10_000n}}));
    await screen.findByText('You have never sent to this address — it only sent to you.');
    expect(document.querySelector('.banner.danger')).toBeNull();
    expect(save().textContent).toBe('Save');
  });

  it('a sender this wallet has sent to: no line, no banner, even for dust', async () => {
    await renderInWallet(sheet({received: {token: 'USDC', amount: 1n}}), {before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: SENDER, at: 1}])});
    await waitFor(() => expect(document.querySelector('.banner.danger')).toBeNull());
    expect(screen.queryByText(/You have never sent/)).toBeNull();
    expect(save().textContent).toBe('Save');
  });
});

describe('the contact sheet: add · empty (#15’s +)', () => {
  it('an address input with Paste; an invalid address says O86 and Save is disabled; a valid one shows its groups and O72; the name comes pre-filled', async () => {
    await renderInWallet(sheet({mode: {kind: 'add', address: null, name: 'mark'}}));
    const input = document.getElementById('contact-address') as HTMLInputElement;
    expect(input.placeholder).toBe('Solana address');
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('button', {name: 'Paste'})).toBeTruthy();
    expect(nameField().value).toBe('mark');
    fireEvent.change(input, {target: {value: 'not an address'}});
    expect(screen.getByText('That is not a Solana address.')).toBeTruthy();
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    expect(shownGroups()).toEqual([]);
    fireEvent.change(input, {target: {value: ` ${OTHER} `}});
    expect(screen.queryByText('That is not a Solana address.')).toBeNull();
    expect(shownGroups()).toEqual(groupsOf(OTHER));
    expect(await screen.findByText('You have never sent to this address.')).toBeTruthy();
    expect((save() as HTMLButtonElement).disabled).toBe(false);
    expect(unstyledClasses(document.querySelector('.s8-sheet')!, SELECTORS)).toEqual([]);
  });

  it('Paste fills the address on the gesture; a refused clipboard says how to paste instead', async () => {
    await renderInWallet(sheet({mode: {kind: 'add', address: null}}));
    Object.defineProperty(navigator, 'clipboard', {value: {readText: async () => ` ${OTHER}\n`}, configurable: true});
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    await waitFor(() => expect((document.getElementById('contact-address') as HTMLInputElement).value).toBe(OTHER));
    fireEvent.change(document.getElementById('contact-address')!, {target: {value: ''}});
    Object.defineProperty(navigator, 'clipboard', {value: {readText: async () => Promise.reject(new Error('NotAllowedError'))}, configurable: true});
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    expect(await screen.findByText('Paste with Ctrl+V (⌘V on a Mac).')).toBeTruthy();
  });
});

describe('the contact sheet: edit and delete', () => {
  const saved = (ext: {local: {set(k: string, v: unknown): Promise<void>}}) => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}]);

  it('edit: "Edit contact", the address read-only, the name pre-filled, Save renames in place; "Delete contact"', async () => {
    const onSaved = vi.fn();
    const w = await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}, onSaved}), {before: saved});
    expect(screen.getByRole('dialog', {name: 'Edit contact'})).toBeTruthy();
    expect(shownGroups()).toEqual(groupsOf(SENDER));
    expect(nameField().value).toBe('Supplier');
    expect(screen.getByRole('button', {name: 'Delete contact'}).className).toBe('btn btn-tertiary noc-danger');
    fireEvent.change(nameField(), {target: {value: 'Supplier GmbH'}});
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({address: SENDER, name: 'Supplier GmbH'}));
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: SENDER, name: 'Supplier GmbH'}]);
  });

  it('delete confirm: "Delete this contact?" — Keep goes back; Delete removes it and closes', async () => {
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    const w = await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}, onDeleted, onClose}), {before: saved});
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    expect(screen.getByText('Delete this contact?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Keep'}));
    expect(nameField().value).toBe('Supplier');
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    expect(unstyledClasses(document.querySelector('.s8-sheet')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDeleted).toHaveBeenCalledWith(SENDER);
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([]);
  });
});

describe('the contact sheet: errors', () => {
  it('duplicate-name (C19): "binance" beside a saved "Binance" → O85, nothing stored', async () => {
    const onSaved = vi.fn();
    const w = await renderInWallet(sheet({onSaved}), {before: ext => ext.local.set(CONTACTS_KEY, [{address: OTHER, name: 'Binance'}])});
    fireEvent.change(nameField(), {target: {value: 'binance'}});
    fireEvent.click(save());
    expect(await screen.findByText('Another contact already has this name.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: OTHER, name: 'Binance'}]);
  });

  it.each(['', '   ', 'Mo\u200Bm', 'a\u202eb'])('a name cleanName refuses (%j) → 2a’s name line, nothing sent', async bad => {
    const sent: string[] = [];
    await renderInWallet(sheet(), {gate: m => void sent.push((m as {type: string}).type)});
    fireEvent.change(nameField(), {target: {value: bad}});
    fireEvent.click(save());
    expect(await screen.findByText('Names are 1 to 32 characters, without control characters.')).toBeTruthy();
    expect(sent).not.toContain('contacts.set');
  });

  it('full: a new address with 200 saved → O87', async () => {
    await renderInWallet(sheet(), {before: ext => ext.local.set(CONTACTS_KEY, Array.from({length: 200}, (_, i) => ({address: addr(i), name: `C${i}`})))});
    fireEvent.change(nameField(), {target: {value: 'One more'}});
    fireEvent.click(save());
    expect(await screen.findByText('The address book is full (200 contacts). Delete one to add another.')).toBeTruthy();
  });

  it('a failed save says so (2a) and stays open', async () => {
    const onSaved = vi.fn();
    await renderInWallet(sheet({onSaved}), {
      gate: m => {
        if ((m as {type: string}).type === 'contacts.set') throw new Error('worker restarting');
      },
    });
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    fireEvent.click(save());
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', {name: 'Add contact'})).toBeTruthy();
  });

  it('locked mid-save: nothing saved, nothing handed back', async () => {
    const onSaved = vi.fn();
    let ext: Parameters<typeof lock>[0] | null = null;
    await renderInWallet(sheet({onSaved}), {
      before: async e => {
        ext = e;
      },
      gate: async m => {
        if ((m as {type: string}).type === 'contacts.set' && ext !== null) await lock(ext);
      },
    });
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    fireEvent.click(save());
    await waitFor(() => expect(ext).not.toBeNull());
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('the contact sheet: rule 6 and late answers', () => {
  it('rule 6: a second Save inside 500 ms sends nothing more', async () => {
    const sets: unknown[] = [];
    await renderInWallet(sheet(), {gate: m => void ((m as {type: string}).type === 'contacts.set' && sets.push(m))});
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    const button = save();
    fireEvent.click(button);
    (button as HTMLButtonElement).disabled = false;
    fireEvent.click(button);
    await waitFor(() => expect(sets).toHaveLength(1));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(sets).toHaveLength(1);
  });

  it('rule 6: a second Delete inside 500 ms sends nothing more', async () => {
    const removes: unknown[] = [];
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}}), {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}]),
      gate: m => void ((m as {type: string}).type === 'contacts.remove' && removes.push(m)),
    });
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    const del = screen.getByRole('button', {name: 'Delete'});
    fireEvent.click(del);
    (del as HTMLButtonElement).disabled = false;
    fireEvent.click(del);
    await waitFor(() => expect(removes).toHaveLength(1));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(removes).toHaveLength(1);
  });

  it('closed while a save was out: the answer calls nothing', async () => {
    const onSaved = vi.fn();
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            hide
          </button>
          {open ? sheet({onSaved}) : null}
        </>
      );
    }
    await renderInWallet(<Host />, {gate: m => ((m as {type: string}).type === 'contacts.set' ? held : undefined)});
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    fireEvent.click(save());
    fireEvent.click(screen.getByRole('button', {name: 'hide'}));
    release();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(onSaved).not.toHaveBeenCalled();
  });
});

// Review H1: the screen under a sheet re-renders on its clock (#20 every second, #15 and #27 every 30 s) and passes an
// inline onClose. The sheet's focus must survive those renders — never pulled back to data-autofocus — and Esc and the
// backdrop must still reach the latest onClose.
describe('the contact sheet under a re-rendering screen (review H1)', () => {
  function Ticking({mode, onClose}: {mode: ContactSheetMode; onClose: () => void}) {
    const [tick, setTick] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setTick(t => t + 1)}>
          tick {tick}
        </button>
        <ContactSheet mode={mode} onSaved={() => undefined} onClose={() => onClose()} />
      </>
    );
  }
  const tick = (n = 3) => {
    for (let i = 0; i < n; i++) act(() => void (screen.getByText(/^tick /) as HTMLButtonElement).click());
  };

  it('add · empty: the caret stays in Name across renders (never moved back to the address field)', async () => {
    await renderInWallet(<Ticking mode={{kind: 'add', address: null}} onClose={() => undefined} />);
    fireEvent.change(document.getElementById('contact-address')!, {target: {value: OTHER}});
    nameField().focus();
    tick();
    expect(document.activeElement).toBe(nameField());
  });

  it('Cancel keeps the focus across renders', async () => {
    await renderInWallet(<Ticking mode={{kind: 'add', address: SENDER}} onClose={() => undefined} />);
    const cancel = screen.getByRole('button', {name: 'Cancel'});
    cancel.focus();
    tick();
    expect(document.activeElement).toBe(cancel);
  });

  it('after many renders, Esc and the backdrop still call the latest onClose', async () => {
    const onClose = vi.fn();
    await renderInWallet(<Ticking mode={{kind: 'add', address: SENDER}} onClose={onClose} />);
    tick(5);
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

// Review M2: the delete confirm keeps the focus inside the sheet.
describe('the contact sheet: the focus through the delete confirm (review M2)', () => {
  it('"Delete contact" → the focus on Keep; Keep → back on "Delete contact"', async () => {
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}}), {before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}])});
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Keep'}));
    fireEvent.click(screen.getByRole('button', {name: 'Keep'}));
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Delete contact'}));
  });
});

// Review L1 (the sheet half): #15's search query, when it is an address, seeds the address field.
describe('the contact sheet: add · empty seeded with an address (review L1)', () => {
  it('`typed` fills the address input; the name stays empty', async () => {
    await renderInWallet(sheet({mode: {kind: 'add', address: null, typed: OTHER}}));
    expect((document.getElementById('contact-address') as HTMLInputElement).value).toBe(OTHER);
    expect(nameField().value).toBe('');
    expect(shownGroups()).toEqual(groupsOf(OTHER));
  });
});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/ContactSheet.test.tsx
```
Expected (dry run, these test files on Task 3's tree): **red** — Test Files  1 failed (1) · Tests  no tests. (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index ffaa033..c36f8b7 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1214,3 +1214,72 @@ a.btn {
   bottom: calc(80px + var(--space-4));
   z-index: 2;
 }
+
+/*
+ * B1b-2b plan 2 §6.2: the contact sheet (an .s8-sheet like #43, derived — the design leaves add/edit undrawn). The
+ * full address in groups of four on a surface-3 well, the field labels as #12's overlines, the never-sent line in
+ * --warning, the actions stacked full width as the sheet's other buttons.
+ */
+/* The contact sheet may take the popup's height but 48 px (Sheet's `tall`): at the design's 70 % the panel scrolled and
+   the focused name field pushed the address it saves out of view (dry run, visual pass). */
+.s8-sheet.app-sheet-tall {
+  max-height: calc(100% - var(--space-8));
+}
+.app-contact-sheet {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-2);
+  padding-bottom: var(--space-2);
+}
+.app-sheet-label {
+  color: var(--fg-tertiary);
+  margin-top: var(--space-2);
+}
+.app-contact-field {
+  position: relative;
+}
+.app-contact-field .app-input {
+  width: 100%;
+  padding-right: 52px;
+}
+.app-contact-field .icon-btn {
+  position: absolute;
+  top: 50%;
+  right: 0;
+  transform: translateY(-50%);
+  width: var(--touch-target-min);
+  height: var(--touch-target-min);
+  color: var(--fg-secondary);
+}
+.app-contact-sheet > .app-input {
+  width: 100%;
+}
+.app-input.is-error {
+  border-color: var(--danger);
+}
+.app-contact-addr {
+  background: var(--bg-surface-3);
+  border-radius: var(--radius-md);
+  padding: var(--space-3);
+  color: var(--fg-primary);
+  word-break: break-all;
+}
+.app-contact-warn {
+  margin: 0;
+}
+.app-contact-sheet .field-msg,
+.app-contact-question,
+.app-contact-name {
+  margin: 0;
+}
+.app-contact-name {
+  color: var(--fg-primary);
+}
+.app-contact-actions {
+  display: flex;
+  gap: var(--space-3);
+  margin-top: var(--space-3);
+}
+.app-contact-actions .btn {
+  flex: 1;
+}
````

Modify `extension/src/app/screens/Switcher.tsx`:

````diff
diff --git a/extension/src/app/screens/Switcher.tsx b/extension/src/app/screens/Switcher.tsx
index 6a74f20..d5ac0e4 100644
--- a/extension/src/app/screens/Switcher.tsx
+++ b/extension/src/app/screens/Switcher.tsx
@@ -13,8 +13,10 @@ export {FRESH_ROWS} from '../useAccountBalances';
 
 /** The rename refusals (2a §5.2), shared with the B1b-2b accounts manager's inline rename. */
 export const RENAME_FAILED = 'Something went wrong.';
+/** 2a §5.2's name rule (the accounts' rename, and B1b-2b's contact sheet — one literal, so the two cannot drift). */
+export const NAME_RULE = 'Names are 1 to 32 characters, without control characters.';
 export const RENAME_ERRORS: Record<string, string> = {
-  malformed: 'Names are 1 to 32 characters, without control characters.',
+  malformed: NAME_RULE,
   busy: 'The wallet is busy. Try again.',
   'unknown-account': 'That account no longer exists.',
   failed: RENAME_FAILED,
````

Create `extension/src/app/ui/ContactSheet.tsx`:

````tsx
import {useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {isAddressText} from '../send/rules';
import {isDust} from '../addressBook';
import {cleanName} from '../../shared/envelopeRules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {Sheet} from './Sheet';
import {Banner} from './Banner';
import {ExtIcon} from './ExtIcon';
import {LockedButton} from './LockedButton';
import {SEND_TEXT} from '../screens/Send';
import {NAME_RULE} from '../screens/Switcher';
import type {Token} from '../engine';

/** The contact sheet's copy (B1b-2b §6.2): "Add contact" (→ adapted, ix:7388's aria), O72, O75–O87, and 2a's strings. */
export const CONTACT_TEXT = {
  addTitle: 'Add contact',
  editTitle: 'Edit contact',
  address: 'Address',
  name: 'Name',
  placeholder: 'Solana address',
  paste: 'Paste',
  neverSent: 'You have never sent to this address.',
  onlySentToYou: 'You have never sent to this address — it only sent to you.',
  dust: 'Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.',
  save: 'Save',
  saveAnyway: 'Save anyway',
  cancel: 'Cancel',
  deleteContact: 'Delete contact',
  deleteQuestion: 'Delete this contact?',
  delete: 'Delete',
  keep: 'Keep',
  badName: NAME_RULE,
  duplicateName: 'Another contact already has this name.',
  badAddress: 'That is not a Solana address.',
  full: 'The address book is full (200 contacts). Delete one to add another.',
  failed: 'Something went wrong. Try again.',
} as const;

/**
 * What the sheet edits. `add` with an address: prefilled from #20 or #27 — the address read-only, in groups of four.
 * `add` with `null`: #15's `+` and "Add new contact" — the address is an input, seeded with `typed` (#15's search query
 * when it is an address; review L1) and the name with `name` (the query otherwise). `edit`: a saved contact (a #15 row,
 * or #27 when the counter-party is saved) — the address read-only; the address never changes once saved (C12).
 */
export type ContactSheetMode = {kind: 'add'; address: string | null; name?: string; typed?: string} | {kind: 'edit'; address: string; name: string};

/**
 * The contact sheet (B1b-2b §6.2; D20, C12, C18, C19; review H3): an `.s8-sheet` like #43 over #15, #20 and #27. A
 * contact is a label, never trust, so the sheet is where an address enters the book and it says what is known about it:
 * the full address in groups of four; "You have never sent to this address." (O72) for any address `wallet.recipientInfo`
 * does not call known — shown until it answers `known: true` (fail closed); from #27c's "Save sender" (`received`) the
 * line reads "…— it only sent to you." (O77), and for a transfer below C18's floor (or an amount the decoder could not
 * read) a danger banner (O78) and "Save anyway" (O79) — warned, not refused. Errors are the background's (`malformed`,
 * `duplicate-name`, `full`) or the address check's (O86). Rule 6: Save and Delete are LockedButtons. An answer that
 * lands after the sheet closed sets nothing and calls nothing.
 */
export function ContactSheet({
  mode,
  received,
  onSaved,
  onDeleted,
  onClose,
}: {
  mode: ContactSheetMode;
  /** Opened from #27c [Save sender]: what the sender sent (C18 decides dust). */
  received?: {token: Token | null; amount: bigint | null};
  onSaved: (contact: {address: string; name: string}) => void;
  onDeleted?: (address: string) => void;
  onClose: () => void;
}) {
  const m = useWallet();
  const {engine, reload} = m;
  const fixed = mode.address;
  const [typed, setTyped] = useState(mode.kind === 'add' ? (mode.typed ?? '') : '');
  const [name, setName] = useState(mode.name ?? '');
  const [error, setError] = useState<{field: 'address' | 'name' | 'form'; text: string} | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [known, setKnown] = useState<boolean | null>(null);
  const [pasteRefused, setPasteRefused] = useState(false);
  const address = fixed ?? typed.trim();
  const valid = isAddressText(address);
  const account = m.account?.publicKey ?? null;
  /** False once the sheet is gone: a late answer sets nothing and calls no callback. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // E6 for the address on the sheet, each time it is a valid one: whether this wallet ever sent there. Until it answers
  // (or when it cannot), the never-sent line shows — never a silence that reads as "known". A reply for an address the
  // field no longer holds is dropped.
  // Review M2: the confirm swaps the sheet's content under the same Sheet (its opener, for the focus on close, is kept),
  // so the focus is moved here — to Keep on entering it, back to "Delete contact" on Keep — never left on `body`, from
  // where Tab would reach the screen behind the modal.
  const keepRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const confirmedOnce = useRef(false);
  useEffect(() => {
    if (confirming) {
      confirmedOnce.current = true;
      keepRef.current?.focus();
    } else if (confirmedOnce.current) deleteRef.current?.focus();
  }, [confirming]);

  const generation = useRef(0);
  useEffect(() => {
    const mine = ++generation.current;
    setKnown(null);
    if (!valid || account === null) return;
    void engine.recipientInfo(account, address).then(r => {
      if (!alive.current || generation.current !== mine) return;
      if (r.ok) setKnown(r.data.known);
      else if (r.error === 'locked') void reload();
    });
  }, [valid, address, account, engine, reload]);

  const fromSender = received !== undefined && known !== true;
  const dust = fromSender && isDust(received.token, received.amount);

  const save = async () => {
    setError(null);
    if (!valid) return setError({field: 'address', text: CONTACT_TEXT.badAddress});
    if (cleanName(name) === null) return setError({field: 'name', text: CONTACT_TEXT.badName});
    const r = await engine.contactSet(address, name);
    if (!alive.current) return;
    if (r.ok) return onSaved({address, name: cleanName(name) ?? name});
    if (r.error === 'locked') return void reload();
    if (r.error === 'duplicate-name') return setError({field: 'name', text: CONTACT_TEXT.duplicateName});
    if (r.error === 'malformed') return setError({field: 'name', text: CONTACT_TEXT.badName});
    if (r.error === 'full') return setError({field: 'form', text: CONTACT_TEXT.full});
    setError({field: 'form', text: CONTACT_TEXT.failed});
  };

  const remove = async () => {
    if (mode.kind !== 'edit') return;
    setError(null);
    const r = await engine.contactRemove(mode.address);
    if (!alive.current) return;
    if (r.ok) {
      onDeleted?.(mode.address);
      return onClose();
    }
    if (r.error === 'locked') return void reload();
    setError({field: 'form', text: CONTACT_TEXT.failed});
  };

  const paste = async () => {
    setPasteRefused(false);
    try {
      const text = await navigator.clipboard.readText();
      if (alive.current) setTyped(text.trim());
    } catch {
      if (alive.current) setPasteRefused(true);
    }
  };

  const message = (field: 'address' | 'name' | 'form') =>
    error?.field === field ? (
      <p className="field-msg noc-danger" role="alert">
        {error.text}
      </p>
    ) : null;

  if (confirming && mode.kind === 'edit') {
    return (
      <Sheet title={CONTACT_TEXT.editTitle} onClose={onClose} tall>
        <div className="app-contact-sheet">
          <p className="noc-body app-contact-question">{CONTACT_TEXT.deleteQuestion}</p>
          <p className="noc-body-lg app-contact-name">{mode.name}</p>
          <div className="app-contact-addr">
            <AddressGroups address={mode.address} />
          </div>
          {message('form')}
          <div className="app-contact-actions">
            <button type="button" className="btn btn-secondary" ref={keepRef} onClick={() => setConfirming(false)}>
              {CONTACT_TEXT.keep}
            </button>
            <LockedButton className="btn btn-destructive" onPress={remove}>
              {CONTACT_TEXT.delete}
            </LockedButton>
          </div>
        </div>
      </Sheet>
    );
  }

  const warning = !valid || known === true ? null : (
    <p className="noc-caption noc-warning app-contact-warn">{fromSender ? CONTACT_TEXT.onlySentToYou : CONTACT_TEXT.neverSent}</p>
  );
  const invalidTyped = fixed === null && address !== '' && !valid;

  return (
    <Sheet title={mode.kind === 'edit' ? CONTACT_TEXT.editTitle : CONTACT_TEXT.addTitle} onClose={onClose} tall>
      <div className="app-contact-sheet">
        {fixed === null ? (
          <>
            <label className="noc-overline app-sheet-label" htmlFor="contact-address">
              {CONTACT_TEXT.address}
            </label>
            <div className="app-contact-field">
              <input
                id="contact-address"
                className={`app-input noc-mono${invalidTyped ? ' is-error' : ''}`}
                placeholder={CONTACT_TEXT.placeholder}
                autoComplete="off"
                spellCheck={false}
                value={typed}
                data-autofocus=""
                onChange={e => {
                  setTyped(e.target.value);
                  setPasteRefused(false);
                  if (error?.field === 'address') setError(null);
                }}
              />
              {typed === '' ? (
                <button type="button" className="icon-btn" aria-label={CONTACT_TEXT.paste} onClick={() => void paste()}>
                  <ExtIcon name="clip" size={18} />
                </button>
              ) : null}
            </div>
            {invalidTyped && error?.field !== 'address' ? (
              <p className="field-msg noc-danger" role="alert">
                {CONTACT_TEXT.badAddress}
              </p>
            ) : null}
            {message('address')}
            {pasteRefused && typed === '' ? <p className="noc-caption noc-warning">{SEND_TEXT.pasteRefused}</p> : null}
            {valid ? (
              <div className="app-contact-addr">
                <AddressGroups address={address} />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="noc-overline app-sheet-label" id="contact-address-label">
              {CONTACT_TEXT.address}
            </div>
            <div className="app-contact-addr" aria-labelledby="contact-address-label">
              <AddressGroups address={fixed} />
            </div>
          </>
        )}
        {warning}
        {dust && valid ? <Banner tone="danger" title={CONTACT_TEXT.dust} /> : null}
        <label className="noc-overline app-sheet-label" htmlFor="contact-name">
          {CONTACT_TEXT.name}
        </label>
        <input
          id="contact-name"
          className={`app-input${error?.field === 'name' ? ' is-error' : ''}`}
          maxLength={32}
          autoComplete="off"
          value={name}
          {...(fixed === null ? {} : {'data-autofocus': ''})}
          onChange={e => {
            setName(e.target.value);
            if (error?.field === 'name') setError(null);
          }}
        />
        {message('name')}
        {message('form')}
        {/* Cancel and Save side by side (the design's `.sticky-bar.row`): stacked, the dust state ran past the panel. */}
        <div className="app-contact-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {CONTACT_TEXT.cancel}
          </button>
          <LockedButton className="btn btn-primary" disabled={!valid} onPress={save}>
            {dust ? CONTACT_TEXT.saveAnyway : CONTACT_TEXT.save}
          </LockedButton>
        </div>
        {mode.kind === 'edit' ? (
          <button type="button" className="btn btn-tertiary noc-danger" ref={deleteRef} onClick={() => setConfirming(true)}>
            {CONTACT_TEXT.deleteContact}
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}
````

Modify `extension/src/app/ui/Sheet.tsx`:

````diff
diff --git a/extension/src/app/ui/Sheet.tsx b/extension/src/app/ui/Sheet.tsx
index cce4128..435fe62 100644
--- a/extension/src/app/ui/Sheet.tsx
+++ b/extension/src/app/ui/Sheet.tsx
@@ -4,18 +4,29 @@ import {ExtIcon} from './ExtIcon';
 /**
  * The design's bottom sheet (`.s8-sheet`, #43): 70 % of the height at most, a grabber, a title and a
  * close button. Esc, the backdrop and the grabber close it; Tab stays inside it while it is open
- * (focus trap), and focus returns to where it was when it closes.
+ * (focus trap), and focus returns to where it was when it closes. It opens with the focus on the
+ * element marked `data-autofocus` when its content has one (B1b-2b's contact sheet: the name field) —
+ * React's own autoFocus would run before this effect and be overridden — else on its first control.
+ * `tall`: the panel may take the popup's height but 48 px (the contact sheet: a full address, its warnings, a field and
+ * three buttons do not fit the design's 70 % at 412 × 600, and a scrolled panel hid the address it saves).
+ *
+ * The focus and key effect runs once, on mount (B1b-2b plan 2 review H1): the latest `onClose` is held in a ref, as
+ * useEscape holds its handler. Every caller passes an inline `onClose`, and the screen under a sheet re-renders on its
+ * clock (#20 every second) — an effect keyed on `onClose` re-ran each time, pulled the focus back to `data-autofocus` and
+ * so typed the rest of a name into #15's address field.
  */
-export function Sheet({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
+export function Sheet({title, onClose, children, tall = false}: {title: string; onClose: () => void; children: ReactNode; tall?: boolean}) {
   const panel = useRef<HTMLDivElement>(null);
+  const close = useRef(onClose);
+  close.current = onClose;
   useEffect(() => {
     const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
     const focusables = (): HTMLElement[] => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]') ?? []);
-    focusables()[0]?.focus();
+    (panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
     const onKey = (e: KeyboardEvent) => {
       if (e.key === 'Escape') {
         e.preventDefault();
-        onClose();
+        close.current();
         return;
       }
       if (e.key !== 'Tab') return;
@@ -36,11 +47,11 @@ export function Sheet({title, onClose, children}: {title: string; onClose: () =>
       document.removeEventListener('keydown', onKey);
       before?.focus();
     };
-  }, [onClose]);
+  }, []);
   return (
     <div className="app-sheet-layer">
       <div className="s8-sheet-overlay" data-testid="sheet-backdrop" onClick={onClose} />
-      <div className="s8-sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
+      <div className={tall ? 's8-sheet app-sheet-tall' : 's8-sheet'} role="dialog" aria-modal="true" aria-label={title} ref={panel}>
         <button type="button" className="grabber-hit" aria-label="Close" onClick={onClose}>
           <span className="grabber" />
         </button>
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/ContactSheet.test.tsx
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  1 passed (1) · Tests  34 passed (34); tsc clean; whole suite Test Files  136 passed (136) · Tests  2676 passed (2676); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red.

- **M4a** — the never-sent line waits for a `known: false` answer (fail open) — `extension/src/app/ui/ContactSheet.tsx`:

  ```diff
  -   const warning = !valid || known === true ? null : (
  +   const warning = !valid || known !== false ? null : (
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 32 passed (34)).

- **M4b** — "only sent to you" and the dust banner wait for the answer (fail open) — `extension/src/app/ui/ContactSheet.tsx`:

  ```diff
  -   const fromSender = received !== undefined && known !== true;
  +   const fromSender = received !== undefined && known === false;
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  7 failed | 27 passed (34)).

- **M4c** — the alive check after the save dropped — `extension/src/app/ui/ContactSheet.tsx`:

  ```diff
  -     const r = await engine.contactSet(address, name);
  -     if (!alive.current) return;
  +     const r = await engine.contactSet(address, name);
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 33 passed (34)).

- **M4d** — Save without its lock (rule 6) — `extension/src/app/ui/ContactSheet.tsx`:

  ```diff
  -           <LockedButton className="btn btn-primary" disabled={!valid} onPress={save}>
  -             {dust ? CONTACT_TEXT.saveAnyway : CONTACT_TEXT.save}
  -           </LockedButton>
  +           <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => void save()}>
  +             {dust ? CONTACT_TEXT.saveAnyway : CONTACT_TEXT.save}
  +           </button>
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 33 passed (34)).

- **M4e** — the sheet ignores data-autofocus — `extension/src/app/ui/Sheet.tsx`:

  ```diff
  -     (panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
  +     focusables()[0]?.focus();
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 32 passed (34)).

- **M4f** — the name is no longer checked before the message — `extension/src/app/ui/ContactSheet.tsx`:

  ```diff
  -     if (cleanName(name) === null) return setError({field: 'name', text: CONTACT_TEXT.badName});
  + (deleted)
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  4 failed | 30 passed (34)).

- **M4g** — the sheet not tall — `extension/src/app/ui/Sheet.tsx`:

  ```diff
  - <div className={tall ? 's8-sheet app-sheet-tall' : 's8-sheet'}
  + <div className="s8-sheet"
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 33 passed (34)).

- **M4h** — the Sheet's focus effect keyed on onClose again (review H1: it re-runs on every render of the screen beneath) — `extension/src/app/ui/Sheet.tsx`:

  ```diff
  -   }, []);
  +   }, [onClose]);
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 32 passed (34)).

- **M4i** — the delete confirm moves no focus (review M2) — `extension/src/app/ui/ContactSheet.tsx`:

  ```diff
  -       keepRef.current?.focus();
  -     } else if (confirmedOnce.current) deleteRef.current?.focus();
  +       void keepRef;
  +     } else if (confirmedOnce.current) void deleteRef;
  ```
  `timeout 300 npx vitest run src/app/__tests__/ContactSheet.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 33 passed (34)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/app/__tests__/ContactSheet.test.tsx extension/src/app/app.css extension/src/app/screens/Switcher.tsx extension/src/app/ui/ContactSheet.tsx extension/src/app/ui/Sheet.tsx
git commit -F - <<'MSG'
feat(extension): the contact sheet — prefilled, empty, edit, delete; never sent, only sent to you, dust

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 5: #15 address book: populated, empty, search, no result, pick, full, load failed; #31's Connections › Address book; design-ext regenerated with `.s-abook` (hash re-pinned)

**Spec:** §6.1, D18, D21, C12, review H3; §4.1 (Connections › Address book · N contacts); §1.6 (`.s-abook`, ix:1412-1490); plan 1 Scope §2 (the re-pin); §8.2

**Files:**
- Modify: `extension/e2e/visual.spec.ts`
- Modify: `extension/scripts/check-classes.mjs`
- Modify: `extension/src/__tests__/designExt2b.test.ts`
- Modify: `extension/src/app/App.tsx`
- Modify: `extension/src/app/__tests__/App.test.tsx`
- Create: `extension/src/app/__tests__/Contacts.test.tsx`
- Modify: `extension/src/app/__tests__/Settings.test.tsx`
- Create: `extension/src/app/__tests__/addressBookFlow.test.tsx`
- Modify: `extension/src/app/__tests__/router.test.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/router.ts`
- Create: `extension/src/app/screens/Contacts.tsx`
- Modify: `extension/src/app/screens/Settings.tsx`
- Modify: `extension/src/app/ui/ExtIcon.tsx`
- Modify: `extension/src/styles/design-ext.css`

**Interfaces:**
- Consumes: `engine.contacts`, `ContactSheet` (Task 4), `addressBook.ts` (Task 3), `shortAddress` (`src/app/format.ts`), `AddressGroups`, `ListRow`, `routeReducer`; the extraction script of plan 1 Task 8.
- Produces (as exported):
  - `src/app/screens/Contacts.tsx` (new): `export const CONTACTS_TEXT`; `export function Contacts(props: {pick: boolean; onBack: () => void; onPick: (address: string) => void})`.
  - `src/app/screens/Settings.tsx`: `Settings` gains the required prop `onContacts: () => void`; `SETTINGS_TEXT` gains `connections`, `addressBook`.
  - `src/app/router.ts`: `export function pickStack(stack: readonly Route[], address: string): Route[] | null` — the hand-back's stack, null with no `send` route below (review L8).
  - `src/app/App.tsx`: the `contacts` route renders `Contacts`; `pickRecipient(address)` resets to `pickStack`'s stack or pops (the hand-back, tested end to end in Task 6); Esc over an open sheet closes only the sheet.
  - `src/app/ui/ExtIcon.tsx`: `ExtIconName` gains `'search' | 'users' | 'link' | 'book' | 'bookmark'` (the design's sprite, path for path).
  - `src/styles/design-ext.css`: regenerated with `.s-abook` (SHA-256 `3092abb5608035c82f58c9097cdd23bc8b49f8d77f12c1622d8a304414caa4d7`, 1 771 lines).

#15 on the design's own `.s-abook` classes. **Standalone** (from #31): the drawn rows — the avatar gradient chosen from the address and the name's initial, the name, "first 4 … last 4", and when (relative, from the background's `lastSentAt`) — newest first; a row tap opens the edit sheet (D21). **Search**: by name or address, the overline "N results for "q"", the name's match in `<mark>`, "No more matches." and "Add new contact "q" →" (the sheet with the name pre-filled); no match is O71 with the same button. **Empty**: the search disabled, the `#i-users` empty state, "Add first contact", and the adapted hint. **Pick** (from #12, Task 6): the pick is a check, not a shortcut (review H3) — every row shows the **full address in groups of four**, and a contact this wallet never sent to says "You have never sent to this address." (O72) in place of the date; a row tap hands the address back; a contact added here is picked at once. **Full** (200): the `+` and every add disabled, O73. **Load failed**: O74 and `[Try again]`. Rows are buttons (the UA's button look reset in `app.css`); the design's inline styles become classes. The sheet is rendered beside `.s-abook`, not inside (as #43 beside #12).

#31 gains the design's "Connections" group with "Address book" (`#i-link`, ix:13552) and its meta "N contacts" from `contacts.list` (a refused read leaves the meta empty; the row still opens #15). App: the `contacts` route, `pickRecipient` (Task 6 wires its entry and tests it), and **Esc over an open sheet closes only the sheet** — App's Esc handler popped the screen under any sheet; it now leaves Esc to an open `[role="dialog"][aria-modal="true"]` (this also fixes the accounts manager's remove sheet, which had the same double action — declared, Scope 3.6).

2a's `e2e/visual.spec.ts` asserts #31's row list; it gains "Address book" (found by the dry run's full E2E run).

**Review 1 (rev 2).** **M3:** the Esc change is pinned on plan 1's surface too — `App.test.tsx` opens the accounts manager's remove sheet, presses Esc (the sheet closes, the manager stays) and Esc again (#31); M5f runs both files. **L1:** "Add new contact "q" →" with a query that is an address seeds the sheet's address field and leaves the name empty (M5h). **L5:** a saved address that is one of this wallet's accounts says "Your account: <name>" (2a's) in its pick row, not "never" (M5i). **L8:** the hand-back's stack is `pickStack` in `router.ts`, unit-tested; with no `send` route below it is null and App pops, so a pick screen never has dead rows (M5j). **L9:** the rows are plain buttons — declared in Scope 3.8.

**design-ext.css is regenerated, never edited** (plan 1 Scope §2: "plan 2 re-runs the script with its prefixes added and re-pins the hash in the same task — a red pin there is expected, not drift").

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/__tests__/designExt2b.test.ts`:

````diff
diff --git a/extension/src/__tests__/designExt2b.test.ts b/extension/src/__tests__/designExt2b.test.ts
index 7665599..82da755 100644
--- a/extension/src/__tests__/designExt2b.test.ts
+++ b/extension/src/__tests__/designExt2b.test.ts
@@ -14,7 +14,14 @@ describe('design-ext.css (B1b-2b plan 1)', () => {
     expect(CSS).not.toContain('.s7-ring');
   });
 
+  // Plan 2 re-ran the extraction with `.s-abook` (#15, ix:1412-1490) added, and re-pins the hash here (plan 1 Scope §2).
+  it('carries #15’s address-book classes (plan 2)', () => {
+    for (const sel of ['.s-abook .search input', '.s-abook .row .ava.violet', '.s-abook .row .ava.blue', '.s-abook .row mark', '.s-abook .empty .ic']) {
+      expect(CSS).toContain(`${sel} `);
+    }
+  });
+
   it('is the extraction output, byte for byte (the hash the plan pins)', () => {
-    expect(createHash('sha256').update(CSS).digest('hex')).toBe('541733335b0e35945521c490435e6910c1a8e23663954f04a0fc4c7dbec1bd6f');
+    expect(createHash('sha256').update(CSS).digest('hex')).toBe('3092abb5608035c82f58c9097cdd23bc8b49f8d77f12c1622d8a304414caa4d7');
   });
 });
````

Modify `extension/src/app/__tests__/App.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/App.test.tsx b/extension/src/app/__tests__/App.test.tsx
index 1d0e773..e9d02a2 100644
--- a/extension/src/app/__tests__/App.test.tsx
+++ b/extension/src/app/__tests__/App.test.tsx
@@ -169,3 +169,21 @@ describe('navigation (spec §1.6: an in-memory stack; no route acts)', () => {
     }
   });
 });
+
+// B1b-2b plan 2, Scope 3.6 (review M3): Esc over an open sheet closes only the sheet — pinned on plan 1's accounts manager
+// remove sheet too, which had the double action (the sheet closed AND the manager popped to #31).
+describe('Esc over a sheet on a pushed screen (plan 2)', () => {
+  it('the accounts manager’s remove sheet: Esc closes the sheet, the manager stays; Esc again leaves it', async () => {
+    await renderApp();
+    await screen.findByText('TOKENS');
+    fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
+    fireEvent.click(await screen.findByText('Profile', {selector: '.s7-title'}));
+    fireEvent.click(await screen.findByRole('button', {name: 'Remove Savings'}));
+    expect(await screen.findByRole('dialog', {name: 'Remove Savings?'})).toBeTruthy();
+    fireEvent.keyDown(document, {key: 'Escape'});
+    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
+    expect(screen.getByRole('button', {name: 'Remove Savings'})).toBeTruthy();
+    fireEvent.keyDown(document, {key: 'Escape'});
+    expect(await screen.findByRole('heading', {name: 'Settings'})).toBeTruthy();
+  });
+});
````

Create `extension/src/app/__tests__/Contacts.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {base58} from '@scure/base';
import {Contacts} from '../screens/Contacts';
import {avatarOf} from '../addressBook';
import {renderInWallet, type WalletOptions} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {CONTACTS_KEY} from '../../background/contacts';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {lock} from '../../background/autolock';
import {RECIPIENT} from '../../background/__tests__/fixtures';

// B1b-2b §6.1 (D18, D21, C12; review H3): #15 — populated, empty, search, no result, pick, full, load failed.
const SELECTORS = selectorsOf(UI_SHEETS);
const MARKO = 'GabcQwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeYxyz9';
const BISTRO = '3jkLmUeyKhsnLj9SNQcdNhAFaapuTr5DPeR2S1PepT8c';
const TINA = '8qWeRT6vqbDrdEwV1dwQi6AtEcY6CT7Xf3aRt8EXfD2x';
const addr = (n: number): string => base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? n + 1 : 7)));
const DAY = 86_400_000;
async function book(ext: {local: {set(k: string, v: unknown): Promise<void>}}): Promise<void> {
  await ext.local.set(CONTACTS_KEY, [
    {address: MARKO, name: 'Marko · Mom'},
    {address: BISTRO, name: 'Bistro · for Marketing'},
    {address: TINA, name: 'Tina'},
  ]);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: MARKO, at: Date.now() - 3 * DAY}]);
}
const rows = () => [...document.querySelectorAll('.s-abook .row')] as HTMLElement[];
const show = (o: {pick?: boolean; onPick?: (a: string) => void; onBack?: () => void} = {}, w: WalletOptions = {before: book}) =>
  renderInWallet(<Contacts pick={o.pick ?? false} onBack={o.onBack ?? (() => undefined)} onPick={o.onPick ?? (() => undefined)} />, w);

describe('#15 address book — standalone', () => {
  it('populated: the drawn rows — avatar gradient + initial, name, first 4 … last 4, when — newest first; back, "Add contact", search', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.getByText('Address book', {selector: '.top-bar .title.noc-h1'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Back'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Add contact'})).toBeTruthy();
    expect((screen.getByRole('textbox', {name: 'Search contacts'}) as HTMLInputElement).placeholder).toBe('Search contacts');
    const [marko, bistro, tina] = rows();
    expect(marko?.querySelector('.ava')?.className).toBe(`ava ${avatarOf(MARKO)}`);
    expect(marko?.querySelector('.ava')?.textContent).toBe('M');
    expect(marko?.querySelector('.name')?.textContent).toBe('Marko · Mom');
    expect(marko?.querySelector('.addr')?.textContent).toBe('Gabc…xyz9');
    expect(marko?.querySelector('.when')?.textContent).toBe('3 days ago');
    expect(bistro?.querySelector('.when')?.textContent).toBe('never');
    expect(tina?.querySelector('.addr')?.textContent).toBe('8qWe…fD2x');
    // The standalone list keeps the drawn truncation: no full address, no never-sent line.
    expect(document.querySelector('.s-abook .addr-groups')).toBeNull();
    expect(screen.queryByText('You have never sent to this address.')).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
  });

  it('empty: the search disabled, the empty state, "Add first contact" opens the add sheet with an address field', async () => {
    await show({}, {});
    expect(await screen.findByText('No saved contacts yet')).toBeTruthy();
    expect((screen.getByRole('textbox', {name: 'Search contacts'}) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Save aliases for the wallets you send to most often. Each one shows up here with the truncated address and last-sent date.')).toBeTruthy();
    expect(screen.getByText("Or save one from a transaction's details.")).toBeTruthy();
    expect(document.querySelector('.s-abook .empty .ic svg')).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: /Add first contact/}));
    expect(await screen.findByRole('dialog', {name: 'Add contact'})).toBeTruthy();
    expect(document.getElementById('contact-address')).toBeTruthy();
  });

  it('search active: "mark" → "2 results for "mark"", the matches marked, "No more matches.", and "Add new contact "mark" →" opens the sheet with the name', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'mark'}});
    expect(screen.getByText('2 results for "mark"')).toBeTruthy();
    expect(rows().map(r => r.querySelector('.name')?.textContent)).toEqual(['Marko · Mom', 'Bistro · for Marketing']);
    expect([...document.querySelectorAll('.s-abook .row mark')].map(m => m.textContent)).toEqual(['Mark', 'Mark']);
    expect(screen.getByText('No more matches.')).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: 'Add new contact "mark" →'}));
    expect(((await screen.findByRole('dialog', {name: 'Add contact'})).querySelector('#contact-name') as HTMLInputElement).value).toBe('mark');
  });

  it('search by address, case-insensitive; one match says "1 result"; Clear search empties it', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'FD2X'}});
    expect(screen.getByText('1 result for "FD2X"')).toBeTruthy();
    expect(rows().map(r => r.querySelector('.name')?.textContent)).toEqual(['Tina']);
    fireEvent.click(screen.getByRole('button', {name: 'Clear search'}));
    expect(rows()).toHaveLength(3);
    expect(screen.queryByText(/result/)).toBeNull();
  });

  it('search · no result: O71 and the same add button', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'zed'}});
    expect(screen.getByText('No contacts match "zed".')).toBeTruthy();
    expect(screen.queryByText('No more matches.')).toBeNull();
    expect(screen.queryByText(/results? for/)).toBeNull();
    expect(screen.getByRole('button', {name: 'Add new contact "zed" →'})).toBeTruthy();
  });

  // Review L1: an address typed into the search, with no match, seeds the sheet's address field — not the name.
  it('"Add new contact" for an address query: the address field holds it, the name is empty', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: addr(9)}});
    expect(screen.getByText(`No contacts match "${addr(9)}".`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: `Add new contact "${addr(9)}" →`}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    expect((dialog.querySelector('#contact-address') as HTMLInputElement).value).toBe(addr(9));
    expect((dialog.querySelector('#contact-name') as HTMLInputElement).value).toBe('');
  });

  it('D21: a row tap opens the edit sheet; a rename shows in the list; a delete removes the row', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.click(rows()[2]!);
    const dialog = await screen.findByRole('dialog', {name: 'Edit contact'});
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Tina K.'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(rows()[2]?.querySelector('.name')?.textContent).toBe('Tina K.'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(rows()[2]!);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', {name: 'Delete contact'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it('full (200): the +, and "Add new contact", disabled; O73', async () => {
    await show({}, {before: ext => ext.local.set(CONTACTS_KEY, Array.from({length: 200}, (_, i) => ({address: addr(i), name: `C${i}`})))});
    expect(await screen.findByText('The address book is full (200 contacts).')).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Add contact'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'C19'}});
    expect((screen.getByRole('button', {name: 'Add new contact "C19" →'}) as HTMLButtonElement).disabled).toBe(true);
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
  });

  it('load failed: O74 and Try again, which reads again', async () => {
    let fail = true;
    await show({}, {
      before: book,
      gate: m => {
        if ((m as {type: string}).type === 'contacts.list' && fail) throw new Error('worker restarting');
      },
    });
    expect(await screen.findByText('Could not load your contacts. Try again.')).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
    fail = false;
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    await waitFor(() => expect(rows()).toHaveLength(3));
  });

  it('back pops', async () => {
    const onBack = vi.fn();
    await show({onBack});
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // The alive guard, made observable: a `locked` answer would call reload() (a wallet.state read) — after the screen
  // went, it must not.
  it('an answer after the screen went does nothing: a late `locked` reloads nothing', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    let gone = false;
    const after: string[] = [];
    let ext: Parameters<typeof lock>[0] | null = null;
    await show({}, {
      before: async e => {
        ext = e;
        await book(e);
      },
      gate: async m => {
        const type = (m as {type: string}).type;
        if (gone) after.push(type);
        if (type === 'contacts.list') await held;
      },
    });
    expect(document.querySelector('.s-abook[aria-busy="true"]')).toBeTruthy();
    await lock(ext!);
    gone = true;
    cleanup();
    release();
    await act(async () => new Promise(r => setTimeout(r, 30)));
    expect(after).toEqual([]);
  });
});

describe('#15 address book — pick (from #12; review H3)', () => {
  it('every row shows the full address in groups of four; a contact never sent to says O72 in place of the date; one sent to keeps its date', async () => {
    await show({pick: true});
    await waitFor(() => expect(rows()).toHaveLength(3));
    const [marko, bistro] = rows();
    expect([...(marko?.querySelectorAll('.addr .addr-groups > span') ?? [])].map(s => s.textContent)).toEqual(MARKO.match(/.{1,4}/g));
    expect(marko?.querySelector('.when')?.textContent).toBe('3 days ago');
    expect(bistro?.querySelector('.when')?.textContent).toBe('You have never sent to this address.');
    expect(bistro?.querySelector('.when')?.className).toBe('when noc-caption noc-warning');
    expect(screen.queryByText('Gabc…xyz9')).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
  });

  // Review L5: a saved address that is one of this wallet's accounts says "Your account: <name>" in its pick row.
  it('an own account saved as a contact: the pick row says "Your account: Savings", not a date or O72', async () => {
    await show({pick: true}, {before: ext => ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Not my savings'}])});
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]?.querySelector('.when')?.textContent).toBe('Your account: Savings');
  });

  it('a row tap hands the address back (no edit sheet)', async () => {
    const onPick = vi.fn();
    await show({pick: true, onPick});
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.click(rows()[1]!);
    expect(onPick).toHaveBeenCalledWith(BISTRO);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a contact added from pick is picked at once', async () => {
    const onPick = vi.fn();
    await show({pick: true, onPick});
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Add contact'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    fireEvent.change(dialog.querySelector('#contact-address')!, {target: {value: addr(9)}});
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'New one'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(addr(9)));
  });
});
````

Modify `extension/src/app/__tests__/Settings.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Settings.test.tsx b/extension/src/app/__tests__/Settings.test.tsx
index 2aa33de..ee7886d 100644
--- a/extension/src/app/__tests__/Settings.test.tsx
+++ b/extension/src/app/__tests__/Settings.test.tsx
@@ -9,7 +9,8 @@ import {readFileSync} from 'node:fs';
 import {join} from 'node:path';
 import {PASSWORD_TOAST_KEY, readPref} from '../prefs';
 import {SETTINGS_KEY} from '../../background/settings';
-import {base64} from '@scure/base';
+import {CONTACTS_KEY} from '../../background/contacts';
+import {base58, base64} from '@scure/base';
 import {Settings} from '../screens/Settings';
 import {WalletProvider} from '../WalletContext';
 import {ENV} from './harness';
@@ -30,14 +31,14 @@ async function openSettings(o: Parameters<typeof renderApp>[0] = {}) {
 }
 
 describe('Settings (#31, B1b-2b §4.1)', () => {
-  it('the groups and rows the extension has (D22): Account › Profile; Security › Security center, Passkey, Change password, Recovery phrase, Lock now; Advanced › Delete wallet; About', async () => {
+  it('the groups and rows the extension has (D22): Account › Profile; Security › Security center, Passkey, Change password, Recovery phrase, Lock now; Connections › Address book (plan 2); Advanced › Delete wallet; About', async () => {
     await openSettings();
-    expect(screen.getAllByText(/^(Account|Security|Advanced|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'Advanced', 'About']);
+    expect(screen.getAllByText(/^(Account|Security|Connections|Advanced|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'Connections', 'Advanced', 'About']);
     expect([...document.querySelectorAll('.s7-row .s7-title')].map(e => e.textContent)).toEqual([
-      'Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Delete wallet', 'About Noctura',
+      'Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Address book', 'Delete wallet', 'About Noctura',
     ]);
     expect(screen.getByText('v0.1.0')).toBeTruthy();
-    for (const gone of ['Currency', 'Notifications', 'Material You accent', 'RPC endpoint', 'Connected dApps', 'Air-gap signing', 'Export transaction history', 'Diagnostics', 'Backup & restore', 'Biometric unlock', 'Change PIN', 'Address book', 'Accounts']) {
+    for (const gone of ['Currency', 'Notifications', 'Material You accent', 'RPC endpoint', 'Connected dApps', 'Air-gap signing', 'Export transaction history', 'Diagnostics', 'Backup & restore', 'Biometric unlock', 'Change PIN', 'Accounts']) {
       expect(screen.queryByText(gone)).toBeNull();
     }
     expect(document.querySelector('.s7-row.danger .s7-title')?.textContent).toBe('Delete wallet');
@@ -101,7 +102,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, settings)});
     const {unmount} = render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} toastMs={400} decorateMs={800} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} toastMs={400} decorateMs={800} />
       </WalletProvider>,
     );
     expect(await screen.findByText('Password updated')).toBeTruthy();
@@ -115,7 +116,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     unmount();
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -128,7 +129,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() - 11 * 60_000})});
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -224,7 +225,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
   async function rows() {
     localStorage.clear();
     const w = await setupWallet();
-    const calls = {profile: 0, security: 0, passkey: 0, del: 0, about: 0};
+    const calls = {profile: 0, security: 0, passkey: 0, del: 0, about: 0, contacts: 0};
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
         <Settings
@@ -233,6 +234,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
           onPasskey={() => void calls.passkey++}
           onDelete={() => void calls.del++}
           onAbout={() => void calls.about++}
+          onContacts={() => void calls.contacts++}
         />
       </WalletProvider>,
     );
@@ -246,10 +248,41 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     fireEvent.click(button);
   };
 
-  it('rule 6: Profile, Security center, Passkey, Delete wallet and About each fire once for two taps inside 500 ms', async () => {
+  it('rule 6: Profile, Security center, Passkey, Address book, Delete wallet and About each fire once for two taps inside 500 ms', async () => {
     const {calls} = await rows();
-    for (const t of ['Profile', 'Security center', 'Passkey', 'Delete wallet', 'About Noctura']) twice(t);
-    expect(calls).toEqual({profile: 1, security: 1, passkey: 1, del: 1, about: 1});
+    for (const t of ['Profile', 'Security center', 'Passkey', 'Address book', 'Delete wallet', 'About Noctura']) twice(t);
+    expect(calls).toEqual({profile: 1, security: 1, passkey: 1, del: 1, about: 1, contacts: 1});
+  });
+
+  // Plan 2 (§4.1, ix:13552): the Address book row's meta is the book's size; a refused read leaves it empty.
+  it.each([
+    [0, '0 contacts'],
+    [1, '1 contact'],
+    [7, '7 contacts'],
+  ])('Address book meta with %i saved: "%s"', async (n, text) => {
+    await openSettings({
+      before: ext =>
+        ext.local.set(
+          CONTACTS_KEY,
+          Array.from({length: n}, (_, i) => ({address: base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? i + 1 : 7))), name: `C${i}`})),
+        ),
+    });
+    const meta = () => screen.getByText('Address book', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
+    await waitFor(() => expect(meta()?.textContent).toBe(text));
+    expect(meta()?.classList.contains('noc-warning')).toBe(false);
+  });
+
+  it('Address book: a refused contacts.list leaves the meta empty, and the row still opens #15', async () => {
+    await openSettings({
+      gate: m => {
+        if ((m as {type: string}).type === 'contacts.list') throw new Error('worker restarting');
+      },
+    });
+    const row = screen.getByText('Address book', {selector: '.s7-title'});
+    await waitFor(() => expect(screen.getByText('Security center', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta')?.textContent).toBe('3 to do'));
+    expect(row.parentElement?.querySelector('.s7-meta')?.textContent).toBe('');
+    fireEvent.click(row);
+    expect(await screen.findByText('Address book', {selector: '.top-bar .title'})).toBeTruthy();
   });
 
   it('rule 6: Change password and Recovery phrase each open their page once for two taps inside 500 ms', async () => {
@@ -269,7 +302,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     };
     const {unmount} = render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -320,7 +353,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() + 60_000})});
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
       </WalletProvider>,
     );
     await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).toBe('3 to do'));
@@ -336,7 +369,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const engine = {...w.engine, state: () => new Promise<never>(() => undefined)};
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
       </WalletProvider>,
     );
     await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).not.toBe(''));
@@ -354,7 +387,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const engine = {...w.engine, settings: () => (reads++, w.engine.settings())};
     const r = render(
       <WalletProvider engine={engine} platform={w.platform} surface={surface}>
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
       </WalletProvider>,
     );
     const meta = (t: string) => screen.getByText(t, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
@@ -405,7 +438,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     };
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="tab">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
       </WalletProvider>,
     );
     const meta = () => screen.getByText('Recovery phrase', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
````

Create `extension/src/app/__tests__/addressBookFlow.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderApp} from './appHarness';
import {CONTACTS_KEY} from '../../background/contacts';

// B1b-2b plan 2: the address book inside the whole App — #31's row → #15, and Esc over the contact sheet.
const MARKO = 'GabcQwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeYxyz9';
const saved = (ext: {local: {set(k: string, v: unknown): Promise<void>}}) => ext.local.set(CONTACTS_KEY, [{address: MARKO, name: 'Marko · Mom'}]);

async function toBook(o: Parameters<typeof renderApp>[0] = {}) {
  const w = await renderApp(o);
  await screen.findByText('TOKENS');
  fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
  fireEvent.click(await screen.findByText('Address book', {selector: '.s7-title'}));
  await screen.findByText('Address book', {selector: '.top-bar .title'});
  return w;
}

describe('#31 → #15 (plan 2)', () => {
  it('the Address book row opens #15 standalone; Back returns to #31', async () => {
    await toBook({before: saved});
    expect(await screen.findByText('Marko · Mom')).toBeTruthy();
    expect(screen.getByText('Gabc…xyz9')).toBeTruthy();
    expect(document.querySelector('.s-abook .addr-groups')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByRole('heading', {name: 'Settings'})).toBeTruthy();
  });

  it('Esc over the contact sheet closes the sheet only; Esc again leaves #15', async () => {
    await toBook({before: saved});
    fireEvent.click(await screen.findByText('Marko · Mom'));
    expect(await screen.findByRole('dialog', {name: 'Edit contact'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Address book', {selector: '.top-bar .title'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(await screen.findByRole('heading', {name: 'Settings'})).toBeTruthy();
  });

  it('a contact saved on #15 shows up there and in #31’s count', async () => {
    await toBook();
    expect(await screen.findByText('No saved contacts yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Add contact'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    fireEvent.change(dialog.querySelector('#contact-address')!, {target: {value: MARKO}});
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Marko · Mom'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    expect(await screen.findByText('Marko · Mom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    await waitFor(() => expect(screen.getByText('Address book', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta')?.textContent).toBe('1 contact'));
  });
});
````

Modify `extension/src/app/__tests__/router.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/router.test.ts b/extension/src/app/__tests__/router.test.ts
index 898da1f..75ab090 100644
--- a/extension/src/app/__tests__/router.test.ts
+++ b/extension/src/app/__tests__/router.test.ts
@@ -1,5 +1,5 @@
 // @vitest-environment happy-dom
-import {FLOW, SCREENS, TAB_ONLY, firstRoute, routeReducer, type Route} from '../router';
+import {FLOW, SCREENS, TAB_ONLY, firstRoute, pickStack, routeReducer, type Route} from '../router';
 
 const HOME: Route[] = [{screen: 'tab', tab: 'home'}];
 
@@ -47,6 +47,17 @@ describe('the router', () => {
     }
   });
 
+  // §1.4 (review M4) and plan 2 review L8: the pick hands the address back through the send route's own draft; with no
+  // send route below, null (App pops).
+  it('pickStack: the send route under #15 takes the address in its draft, the stack ends there; none below → null', () => {
+    const send: Route = {screen: 'send', draft: {token: 'NOC', recipient: '', amount: '2'}, notice: 'start-again'};
+    expect(pickStack([...HOME, send, {screen: 'contacts', pick: true}], ADDR)).toEqual([...HOME, {screen: 'send', draft: {token: 'NOC', recipient: ADDR, amount: '2'}, notice: null}]);
+    expect(pickStack([...HOME, {screen: 'send', draft: null, notice: null}, {screen: 'contacts', pick: true}], ADDR)).toEqual([...HOME, {screen: 'send', draft: {token: 'SOL', recipient: ADDR, amount: ''}, notice: null}]);
+    expect(pickStack([...HOME, {screen: 'contacts', pick: true}], ADDR)).toBeNull();
+    const back = pickStack([...HOME, send, {screen: 'contacts', pick: true}], ADDR);
+    expect(back === null ? null : routeReducer(HOME, {type: 'reset', routes: back})).toEqual(back);
+  });
+
   it('the flow routes: a draft is the user’s text, an intent an address and a positive u64, a status id 32 hex or null', () => {
     const ok: Route[] = [
       {screen: 'send', draft: null, notice: null},
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/__tests__/designExt2b.test.ts src/app/__tests__/App.test.tsx src/app/__tests__/Contacts.test.tsx src/app/__tests__/Settings.test.tsx src/app/__tests__/addressBookFlow.test.tsx src/app/__tests__/router.test.ts
```
Expected (dry run, these test files on Task 4's tree): **red** — Test Files  6 failed (6) · Tests  13 failed | 71 passed (84). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/e2e/visual.spec.ts`:

````diff
diff --git a/extension/e2e/visual.spec.ts b/extension/e2e/visual.spec.ts
index 4a3c7ce..37f5f69 100644
--- a/extension/e2e/visual.spec.ts
+++ b/extension/e2e/visual.spec.ts
@@ -93,8 +93,9 @@ test('visual: the plan-1 screens and states at 412 × 600', async () => {
     }
 
     await p.getByRole('button', {name: 'Settings'}).click();
-    // B1b-2b plan 1 (#31 in full): the rows of every group; visual-settings.spec.ts shoots its states.
-    await expect(p.locator('.s7-row .s7-title')).toHaveText(['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Delete wallet', 'About Noctura']);
+    // B1b-2b plan 1 (#31 in full) and plan 2 (Connections › Address book): the rows of every group; visual-settings.spec.ts
+    // and visual-contacts.spec.ts shoot their states.
+    await expect(p.locator('.s7-row .s7-title')).toHaveText(['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Address book', 'Delete wallet', 'About Noctura']);
     await shot(p, '31-settings-minimal');
     await p.getByText('About Noctura').click();
     await expect(p.getByText('Solana wallet for your browser — your keys stay on this device.')).toBeVisible();
````

Modify `extension/scripts/check-classes.mjs`:

````diff
diff --git a/extension/scripts/check-classes.mjs b/extension/scripts/check-classes.mjs
index e5fc518..5c5f861 100644
--- a/extension/scripts/check-classes.mjs
+++ b/extension/scripts/check-classes.mjs
@@ -34,6 +34,8 @@ export const DYNAMIC = {
   '${titleClass}': [],
   // Plan 3: #19's check rows (screens/Review.tsx) — PASS rows `ok`, the recipient warnings `warn`.
   '${c.tone}': ['ok', 'warn'],
+  // B1b-2b plan 2: #15's avatar gradient (addressBook.ts AVATARS, ix:1440-1444).
+  '${avatarOf(c.address)}': ['violet', 'mint', 'coral', 'amber', 'blue'],
 };
 
 /** The text of the quoted string that starts at `i` (the quote), and the index after it. */
````

Modify `extension/src/app/App.tsx`:

````diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index 0b2d0ce..82f02df 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -2,7 +2,7 @@ import {useEffect, useLayoutEffect, useReducer, useRef, useState} from 'react';
 import {WalletProvider, useWallet, type Surface} from './WalletContext';
 import {createEngine, type Engine, type HistoryItem, type Intent} from './engine';
 import {browserPlatform, type Platform} from './platform';
-import {FLOW, TAB_ONLY, firstRoute, routeReducer, type Route} from './router';
+import {FLOW, TAB_ONLY, firstRoute, pickStack, routeReducer, type Route} from './router';
 import {draftOf, type Draft} from './send/rules';
 import {TabBar} from './ui/TabBar';
 import {CancelledToast} from './ui/CancelledToast';
@@ -19,6 +19,7 @@ import {Passkey} from './screens/Passkey';
 import {AccountsManager} from './screens/AccountsManager';
 import {DeleteWallet} from './screens/DeleteWallet';
 import {Security} from './screens/Security';
+import {Contacts} from './screens/Contacts';
 import {Created} from './screens/Created';
 import {Imported} from './screens/Imported';
 import {Send} from './screens/Send';
@@ -58,11 +59,13 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
     if (!TAB_ONLY.has(route.screen)) onLeaveHandOver();
   }, [route.screen, onLeaveHandOver]);
 
-  // Esc goes back one step on a pushed screen (a sheet handles its own Esc; a flow screen its own step).
+  // Esc goes back one step on a pushed screen (a sheet handles its own Esc; a flow screen its own step). A sheet open
+  // over a pushed screen (#15's contact sheet, the accounts manager's remove sheet) takes Esc alone: it closes, and the
+  // screen under it stays (plan 2).
   useEffect(() => {
     if (stack.length < 2 || accounts || FLOW.has(route.screen)) return;
     const onKey = (e: KeyboardEvent) => {
-      if (e.key === 'Escape') go({type: 'pop'});
+      if (e.key === 'Escape' && document.querySelector('[role="dialog"][aria-modal="true"]') === null) go({type: 'pop'});
     };
     document.addEventListener('keydown', onKey);
     return () => document.removeEventListener('keydown', onKey);
@@ -130,6 +133,12 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
     if (resumeElsewhere) go({type: 'reset', routes: [HOME]});
   }, [resumeElsewhere]);
 
+  /** #15's pick hand-back (spec §1.4, review M4): router.ts pickStack; with no `send` route below, a plain pop (review L8). */
+  const pickRecipient = (address: string) => {
+    const routes = pickStack(stackRef.current, address);
+    go(routes === null ? {type: 'pop'} : {type: 'reset', routes});
+  };
+
   /** The send flow's ways between its screens (spec §4). #19 always sits on #12 holding the draft, so Cancel returns to it. */
   const toReview = (account: string, intent: Intent, notice: 'confirmation-expired' | null) =>
     go({type: 'reset', routes: [HOME, {screen: 'send', draft: draftOf(intent), notice: null}, {screen: 'review', account, intent, notice}]});
@@ -199,6 +208,7 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
           onPasskey={() => go({type: 'push', route: {screen: 'passkey'}})}
           onDelete={() => go({type: 'push', route: {screen: 'delete'}})}
           onAbout={() => go({type: 'push', route: {screen: 'about'}})}
+          onContacts={() => go({type: 'push', route: {screen: 'contacts', pick: false}})}
         />
       );
     }
@@ -287,6 +297,8 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
     screen = <AccountsManager onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'passkey') {
     screen = <Passkey onBack={() => go({type: 'pop'})} />;
+  } else if (route.screen === 'contacts') {
+    screen = <Contacts pick={route.pick} onBack={() => go({type: 'pop'})} onPick={pickRecipient} />;
   } else {
     screen = <About onBack={() => go({type: 'pop'})} />;
   }
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index c36f8b7..56797b2 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1283,3 +1283,69 @@ a.btn {
 .app-contact-actions .btn {
   flex: 1;
 }
+
+/*
+ * B1b-2b plan 2 §6.1: #15 address book on the design's .s-abook (design-ext.css). The rows are buttons here (a row
+ * opens the edit sheet, or picks), so the UA's button look is reset; the design's inline styles become classes: the
+ * accent "+", the result-count overline, the "No more matches." foot, the empty state's button and hint. Pick-mode rows
+ * carry the full address in groups of four, so they align to the top and the never-sent line wraps in the date's place.
+ */
+.s-abook .top-bar .icon-btn.app-abook-add {
+  color: var(--accent);
+}
+.s-abook .top-bar .icon-btn.app-abook-add:disabled {
+  color: var(--fg-tertiary);
+}
+.s-abook button.row {
+  width: 100%;
+  background: transparent;
+  border: 0;
+  color: inherit;
+  font: inherit;
+  text-align: start;
+  cursor: pointer;
+}
+.s-abook .row .meta > span {
+  display: block;
+}
+.s-abook .row.app-abook-pick {
+  align-items: flex-start;
+}
+.s-abook .row.app-abook-pick .when {
+  max-width: 120px;
+}
+.s-abook .search input:focus {
+  box-shadow: inset 0 0 0 1px var(--accent);
+}
+.s-abook .search:focus-within .ic {
+  color: var(--accent);
+}
+.app-abook-list {
+  display: flex;
+  flex-direction: column;
+}
+.app-abook-count {
+  color: var(--fg-tertiary);
+  padding: var(--space-1) var(--space-3) var(--space-2);
+}
+.app-abook-foot {
+  padding: var(--space-5);
+  text-align: center;
+  color: var(--fg-tertiary);
+}
+.app-abook-foot .btn {
+  margin-top: var(--space-3);
+}
+.s-abook .empty .app-abook-first {
+  width: auto;
+  padding: 0 var(--space-6);
+  margin-top: var(--space-3);
+}
+.s-abook .empty .noc-caption {
+  margin-top: var(--space-2);
+}
+.app-abook-full,
+.app-abook-failed {
+  margin: 0;
+  padding: var(--space-2) var(--space-3);
+}
````

Modify `extension/src/app/router.ts`:

````diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index 9ebd64d..4273fe9 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -91,6 +91,20 @@ export function routeReducer(stack: Route[], action: RouteAction): Route[] {
   }
 }
 
+/**
+ * #15's pick hand-back (spec §1.4, review M4): the address goes into the `send` route's OWN draft — the route under #15
+ * — and the stack ends there, so #12 mounts again holding it and treats it exactly as a paste (isDraft checks it like
+ * any draft). No route gains a key. Null when no `send` route is below (plan 2 review L8): the caller pops instead, so a
+ * pick screen never has dead rows.
+ */
+export function pickStack(stack: readonly Route[], address: string): Route[] | null {
+  const at = stack.map(r => r.screen).lastIndexOf('send');
+  const below = stack[at];
+  if (below?.screen !== 'send') return null;
+  const draft: Draft = {...(below.draft ?? {token: 'SOL', recipient: '', amount: ''}), recipient: address};
+  return [...stack.slice(0, at), {screen: 'send', draft, notice: null}];
+}
+
 /**
  * The first route (spec §1.6). The popup always starts at #11. The tab reads `location.hash`: `#/created`
  * (#7), `#/imported` (#40), `#/send/resume?account=<address>` (the hand-over from #10: #20, which reads the
````

Create `extension/src/app/screens/Contacts.tsx`:

````tsx
import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {useWallet} from '../WalletContext';
import {useNow} from '../useNow';
import {shortAddress} from '../format';
import {avatarOf, initialOf, markParts, resultsLine, searchContacts, whenText} from '../addressBook';
import {isAddressText} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {ContactSheet, type ContactSheetMode} from '../ui/ContactSheet';
import type {Contact, ContactList} from '../engine';

/** #15's copy (B1b-2b §6.1): the design's strings, adapted where marked there, O71–O74 and 2a's "Try again". */
export const CONTACTS_TEXT = {
  title: 'Address book',
  add: 'Add contact',
  search: 'Search contacts',
  clear: 'Clear search',
  emptyTitle: 'No saved contacts yet',
  emptyBody: 'Save aliases for the wallets you send to most often. Each one shows up here with the truncated address and last-sent date.',
  addFirst: 'Add first contact',
  /** ix:7456 → adapted: the screen number is not user copy. */
  emptyHint: "Or save one from a transaction's details.",
  noMore: 'No more matches.',
  addNew: (q: string): string => `Add new contact "${q}" →`,
  noMatch: (q: string): string => `No contacts match "${q}".`,
  neverSent: 'You have never sent to this address.',
  full: 'The address book is full (200 contacts).',
  loadFailed: 'Could not load your contacts. Try again.',
  tryAgain: 'Try again',
} as const;

/** The name with the query's first match in `<mark>` (ix:7483). */
function Name({name, query}: {name: string; query: string}): ReactNode {
  const parts = markParts(name, query);
  if (parts === null) return name;
  return (
    <>
      {parts[0]}
      <mark>{parts[1]}</mark>
      {parts[2]}
    </>
  );
}

/**
 * #15 address book (spec B1b-2b §6.1; D18, D21, C12; review H3). Standalone (from #31): the drawn rows — avatar, name,
 * "first 4 … last 4", when — and a row tap opens the edit sheet (D21). `pick` (from #12's contact icon): the pick is a
 * check, not a shortcut — every row shows the FULL address in groups of four, and a contact this wallet never sent to
 * says "You have never sent to this address." (O72) in place of the date; a row tap hands the address back to #12,
 * which treats it exactly as a paste (App's reset, review M4); a contact saved here is picked at once. Search by name or
 * address; `full` (200) disables every add; `load failed` offers Try again. The list is local: no pull-to-refresh.
 * Rule 6: the `+` and every add button are LockedButtons. An answer that lands after the screen went is dropped.
 */
export function Contacts({pick, onBack, onPick}: {pick: boolean; onBack: () => void; onPick: (address: string) => void}) {
  const m = useWallet();
  const {engine, reload} = m;
  const now = useNow(30_000, m.now);
  const [list, setList] = useState<ContactList | 'failed' | null>(null);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<ContactSheetMode | null>(null);
  /** Only the newest read counts, and none after the screen went. */
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
    const r = await engine.contacts();
    if (!alive.current || n !== reads.current) return;
    if (r.ok) return setList(r.data);
    if (r.error === 'locked') return void reload();
    setList('failed');
  }, [engine, reload]);
  useEffect(() => {
    void load();
  }, [load]);

  const top = (canAdd: boolean) => (
    <div className="top-bar">
      <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
        <ExtIcon name="back" size={22} />
      </button>
      <div className="title noc-h1">{CONTACTS_TEXT.title}</div>
      <LockedButton className="icon-btn app-abook-add" label={CONTACTS_TEXT.add} disabled={!canAdd} onPress={() => setSheet({kind: 'add', address: null})}>
        <ExtIcon name="plus" size={22} />
      </LockedButton>
    </div>
  );

  if (list === null) {
    return (
      <div className="screen s-abook" aria-busy="true">
        {top(false)}
      </div>
    );
  }
  if (list === 'failed') {
    return (
      <div className="screen s-abook">
        {top(false)}
        <div className="scroll">
          <p className="noc-body app-muted app-abook-failed">{CONTACTS_TEXT.loadFailed}</p>
          <LockedButton className="btn btn-secondary" onPress={load}>
            {CONTACTS_TEXT.tryAgain}
          </LockedButton>
        </div>
      </div>
    );
  }

  const full = list.contacts.length >= list.max;
  const empty = list.contacts.length === 0;
  const q = query.trim();
  const shown = searchContacts(list.contacts, q);
  // Review L1: a query that is an address seeds the address field (the name stays empty); any other query is the name.
  const addNew = () => setSheet(isAddressText(q) ? {kind: 'add', address: null, typed: q} : {kind: 'add', address: null, name: q});
  /** Review L5: a saved address that is one of this wallet's accounts says so in a pick row (2a's "Your account: <name>"). */
  const ownName = (address: string): string | null => m.wallet?.accounts.find(a => a.publicKey === address)?.name ?? null;
  const row = (c: Contact) =>
    pick ? (
      <button type="button" key={c.address} className="row app-abook-pick" onClick={() => onPick(c.address)}>
        <span className={`ava ${avatarOf(c.address)}`} aria-hidden="true">
          {initialOf(c.name)}
        </span>
        <span className="meta">
          <span className="name noc-body-lg">
            <Name name={c.name} query={q} />
          </span>
          <span className="addr noc-body-sm noc-mono">
            <AddressGroups address={c.address} />
          </span>
        </span>
        {ownName(c.address) !== null ? (
          <span className="when noc-body-sm">{`Your account: ${ownName(c.address) ?? ''}`}</span>
        ) : c.known ? (
          <span className="when noc-body-sm">{whenText(c.lastSentAt, now)}</span>
        ) : (
          <span className="when noc-caption noc-warning">{CONTACTS_TEXT.neverSent}</span>
        )}
      </button>
    ) : (
      <button type="button" key={c.address} className="row" onClick={() => setSheet({kind: 'edit', address: c.address, name: c.name})}>
        <span className={`ava ${avatarOf(c.address)}`} aria-hidden="true">
          {initialOf(c.name)}
        </span>
        <span className="meta">
          <span className="name noc-body-lg">
            <Name name={c.name} query={q} />
          </span>
          <span className="addr noc-body-sm noc-mono">{shortAddress(c.address)}</span>
        </span>
        <span className="when noc-body-sm">{whenText(c.lastSentAt, now)}</span>
      </button>
    );

  let body: ReactNode;
  if (empty) {
    body = (
      <div className="empty">
        <div className="ic">
          <ExtIcon name="users" size={32} />
        </div>
        <h3 className="noc-h3">{CONTACTS_TEXT.emptyTitle}</h3>
        <p className="noc-body-sm">{CONTACTS_TEXT.emptyBody}</p>
        <LockedButton className="btn btn-primary app-abook-first" onPress={() => setSheet({kind: 'add', address: null})}>
          <ExtIcon name="plus" size={18} />
          &nbsp;{CONTACTS_TEXT.addFirst}
        </LockedButton>
        <span className="noc-caption app-dim">{CONTACTS_TEXT.emptyHint}</span>
      </div>
    );
  } else {
    body = (
      <div className="scroll app-abook-list">
        {full ? <p className="noc-caption app-warning app-abook-full">{CONTACTS_TEXT.full}</p> : null}
        {q === '' ? null : shown.length > 0 ? <div className="noc-overline app-abook-count">{resultsLine(shown.length, q)}</div> : null}
        {shown.map(row)}
        {q === '' ? null : (
          <div className="app-abook-foot">
            <div className="noc-body-sm">{shown.length > 0 ? CONTACTS_TEXT.noMore : CONTACTS_TEXT.noMatch(q)}</div>
            <LockedButton className="btn btn-tertiary" disabled={full} onPress={addNew}>
              {CONTACTS_TEXT.addNew(q)}
            </LockedButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="screen s-abook">
        {top(!full)}
        <div className="search">
          <span className="ic">
            <ExtIcon name="search" size={18} />
          </span>
          <input type="text" placeholder={CONTACTS_TEXT.search} aria-label={CONTACTS_TEXT.search} autoComplete="off" spellCheck={false} disabled={empty} value={query} onChange={e => setQuery(e.target.value)} />
          {query === '' ? null : (
            <button type="button" className="clear" aria-label={CONTACTS_TEXT.clear} onClick={() => setQuery('')}>
              <ExtIcon name="close" size={14} />
            </button>
          )}
        </div>
        {body}
      </div>
      {/* Beside `.s-abook`, not inside: `.s-abook .row` would style the sheet's rows (as #43 beside #12). */}
      {sheet === null ? null : (
        <ContactSheet
          mode={sheet}
          onClose={() => setSheet(null)}
          onSaved={c => {
            setSheet(null);
            // A contact added from #12's pick is the one the user wanted: picked at once (§6.1).
            if (pick && sheet.kind === 'add') return onPick(c.address);
            void load();
          }}
          onDeleted={() => void load()}
        />
      )}
    </>
  );
}
````

Modify `extension/src/app/screens/Settings.tsx`:

````diff
diff --git a/extension/src/app/screens/Settings.tsx b/extension/src/app/screens/Settings.tsx
index 9840731..25ae3c5 100644
--- a/extension/src/app/screens/Settings.tsx
+++ b/extension/src/app/screens/Settings.tsx
@@ -6,6 +6,7 @@ import {ListRow} from '../ui/ListRow';
 import {LockedButton} from '../ui/LockedButton';
 import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
 import {securityTasks} from './Security';
+import {contactsCount} from '../addressBook';
 import type {Settings as StoredSettings} from '../engine';
 
 /** #31's copy (B1b-2b §4.1): the design's strings adapted where marked, 2a's, and O42–O46. */
@@ -30,6 +31,9 @@ export const SETTINGS_TEXT = {
   verified: 'Verified',
   lockNow: 'Lock now',
   lockFailed: 'Could not lock the wallet. Try again.',
+  /** ix:13550: the group the address book row sits in (plan 2; Connected dApps and Air-gap omitted, D22). */
+  connections: 'Connections',
+  addressBook: 'Address book',
   advanced: 'Advanced',
   // Named deleteTitle: the source gate in the unlock tests allows the engine call's name in two files only.
   deleteTitle: 'Delete wallet',
@@ -48,7 +52,8 @@ export const PASSWORD_TOAST_WINDOW_MS = 10 * 60_000;
  * (D22). 36e (C10): within ten minutes of a change the background recorded (`passwordChangedAt`), the first open shows
  * the "Password updated" toast (1.8 s) and the row's "Just updated" decoration (5 s), once per change (a UI pref keeps
  * the timestamp shown; a future stamp shows nothing). The tab reads the facts again when shown again. Every row that opens a page is a LockedButton (rule 6). The rows #31 draws and the extension does
- * not have are omitted (D22; the spec's Differs list).
+ * not have are omitted (D22; the spec's Differs list). Plan 2: Connections › Address book (ix:13552), meta "N contacts"
+ * from contacts.list — a refusal leaves the meta empty; the row still opens #15.
  */
 export function Settings({
   onProfile,
@@ -56,6 +61,7 @@ export function Settings({
   onPasskey,
   onDelete,
   onAbout,
+  onContacts,
   toastMs = 1_800,
   decorateMs = 5_000,
 }: {
@@ -64,6 +70,8 @@ export function Settings({
   onPasskey: () => void;
   onDelete: () => void;
   onAbout: () => void;
+  /** Plan 2: Connections › Address book → #15 (standalone). */
+  onContacts: () => void;
   toastMs?: number;
   decorateMs?: number;
 }) {
@@ -72,6 +80,8 @@ export function Settings({
   const [stored, setStored] = useState<StoredSettings | null>(null);
   const [toast, setToast] = useState(false);
   const [decorated, setDecorated] = useState(false);
+  /** The book's size for the Address book meta; null until read, or when the read was refused (no meta then). */
+  const [contacts, setContacts] = useState<number | null>(null);
   const passkey = m.wallet?.passkey === true;
 
   useEffect(() => {
@@ -79,7 +89,12 @@ export function Settings({
     /** Only the newest read counts: a slower, older answer sets nothing. */
     let reads = 0;
     const timers: ReturnType<typeof setTimeout>[] = [];
+    let contactReads = 0;
     const read = () => {
+      const c = ++contactReads;
+      void m.engine.contacts().then(r => {
+        if (alive && c === contactReads) setContacts(r.ok ? r.data.contacts.length : null);
+      });
       const n = ++reads;
       void m.engine.settings().then(r => {
         // Gone (unmounted, a new engine) or overtaken by a newer read while it read: nothing is set, toasted or remembered.
@@ -203,6 +218,10 @@ export function Settings({
             {SETTINGS_TEXT.lockFailed}
           </p>
         ) : null}
+        <div className="s7-group-label">{SETTINGS_TEXT.connections}</div>
+        <div className="s7-list">
+          <ListRow icon="link" title={SETTINGS_TEXT.addressBook} meta={contacts === null ? '' : contactsCount(contacts)} onPress={onContacts} />
+        </div>
         <div className="s7-group-label">{SETTINGS_TEXT.advanced}</div>
         <div className="s7-list">
           <ListRow icon="trash" title={SETTINGS_TEXT.deleteTitle} onPress={onDelete} danger />
````

Modify `extension/src/app/ui/ExtIcon.tsx`:

````diff
diff --git a/extension/src/app/ui/ExtIcon.tsx b/extension/src/app/ui/ExtIcon.tsx
index 7589ab9..979138d 100644
--- a/extension/src/app/ui/ExtIcon.tsx
+++ b/extension/src/app/ui/ExtIcon.tsx
@@ -48,9 +48,43 @@ export type ExtIconName =
   | 'trash'
   | 'zap'
   | 'arrow-up'
-  | 'arrow-down';
+  | 'arrow-down'
+  // B1b-2b plan 2: #15 (search, users, plus), #31's Address book row (link), #12's contact icon (book), #27's Save (bookmark).
+  | 'search'
+  | 'users'
+  | 'link'
+  | 'book'
+  | 'bookmark';
 
 const PATHS: Record<ExtIconName, ReactNode> = {
+  // B1b-2b plan 2, from the design's sprite: #i-search, #i-users, #i-link, #i-book, #i-bookmark.
+  search: (
+    <>
+      <circle cx="11" cy="11" r="7" />
+      <path d="m21 21-4.35-4.35" />
+    </>
+  ),
+  users: (
+    <>
+      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
+      <circle cx="9" cy="7" r="4" />
+      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
+      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
+    </>
+  ),
+  link: (
+    <>
+      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
+      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
+    </>
+  ),
+  book: (
+    <>
+      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
+      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
+    </>
+  ),
+  bookmark: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
   // B1b-2b plan 1, from the design's sprite (#i-user, #i-key, #i-fingerprint, #i-shield-check, #i-database, #i-trash,
   // #i-zap, #i-arrow-down); `arrow-up` is #i-arrow-down turned, drawn in the same style (the sprite lacks it).
   user: (
````

First regenerate `extension/src/styles/design-ext.css` — never edit it by hand. Save this one-off script **outside the repository** (plan 1 Task 8's extraction script with one line of prefixes added — the line marked "B1b-2b plan 2") and run it from the repository root. Before adding the line, the script must reproduce the current file (`sha256sum extension/src/styles/design-ext.css` = `541733335b0e35945521c490435e6910c1a8e23663954f04a0fc4c7dbec1bd6f`); a different hash means `/home/user/Downloads/index.html` changed — stop and ask the controller. With the line, the output is 1771 lines, 76 more, and its hash is `3092abb5608035c82f58c9097cdd23bc8b49f8d77f12c1622d8a304414caa4d7` (pinned by `designExt2b.test.ts`, re-pinned in this task). The resulting diff follows, for review.

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
  // B1b-2b plan 2: #15 address book (ix:1412-1490). The contact sheet is #43's .s8-sheet, already extracted.
  '.s-abook',
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
node /path/outside/the/repo/extract-design-css-2b2.mjs
sha256sum extension/src/styles/design-ext.css
```

Modify `extension/src/styles/design-ext.css`:

````diff
diff --git a/extension/src/styles/design-ext.css b/extension/src/styles/design-ext.css
index 116096a..0d39ade 100644
--- a/extension/src/styles/design-ext.css
+++ b/extension/src/styles/design-ext.css
@@ -856,6 +856,82 @@
 }
 .copy-toast svg { color: var(--accent); width: 16px; height: 16px; }
 .copy-toast .timer { color: var(--fg-secondary); font-variant-numeric: tabular-nums; }
+.s-abook { display: flex; flex-direction: column; }
+.s-abook .scroll { flex: 1; padding: 0 var(--space-5); }
+.s-abook .search {
+  position: relative;
+  margin: 0 var(--space-5) var(--space-4);
+}
+.s-abook .search input {
+  width: 100%; height: 44px;
+  padding: 0 14px 0 42px;
+  background: var(--bg-surface-3); border: 0; outline: none;
+  border-radius: var(--radius-md);
+  font: 400 15px/22px var(--font-body); color: var(--fg-primary);
+}
+.s-abook .search input::placeholder { color: var(--fg-tertiary); }
+.s-abook .search input.focused { box-shadow: inset 0 0 0 1px var(--accent); }
+.s-abook .search .ic {
+  position: absolute; top: 50%; left: 14px; transform: translateY(-50%);
+  color: var(--fg-tertiary); width: 18px; height: 18px;
+}
+.s-abook .search .clear {
+  position: absolute; top: 50%; right: 6px; transform: translateY(-50%);
+  width: 32px; height: 32px; border: 0; background: var(--bg-surface-2);
+  color: var(--fg-secondary); border-radius: 50%; cursor: pointer;
+  display: inline-flex; align-items: center; justify-content: center;
+}
+.s-abook .row {
+  display: flex; align-items: center; gap: var(--space-3);
+  padding: var(--space-3); border-radius: var(--radius-md);
+  min-height: 64px;
+}
+.s-abook .row .ava {
+  width: 40px; height: 40px; border-radius: 50%;
+  display: inline-flex; align-items: center; justify-content: center;
+  font: 600 13px/1 var(--font-display);
+  flex: 0 0 auto;
+}
+.s-abook .row .ava.violet { background: linear-gradient(135deg, #B084FC, #6E3FBE); color: #fff; }
+.s-abook .row .ava.mint   { background: linear-gradient(135deg, #5BE3C2, #2EAB89); color: #04201A; }
+.s-abook .row .ava.coral  { background: linear-gradient(135deg, #FF8FA3, #B05060); color: #fff; }
+.s-abook .row .ava.amber  { background: linear-gradient(135deg, #F2B53B, #B07A14); color: #1B1300; }
+.s-abook .row .ava.blue   { background: linear-gradient(135deg, #7DA8FF, #3F66B8); color: #fff; }
+.s-abook .row .meta { flex: 1; min-width: 0; }
+.s-abook .row .meta .name { color: var(--fg-primary); }
+.s-abook .row .meta .addr { color: var(--fg-tertiary); }
+.s-abook .row .when { color: var(--fg-tertiary); text-align: end; flex: 0 0 auto; }
+.s-abook .row mark {
+  background: rgba(176,132,252,.18); color: var(--accent);
+  padding: 0 2px; border-radius: 2px;
+}
+.s-abook .empty {
+  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
+  padding: var(--space-8) var(--space-7); text-align: center; gap: var(--space-3);
+}
+.s-abook .empty .ic {
+  width: 64px; height: 64px; border-radius: 50%;
+  background: var(--bg-surface-2); color: var(--fg-tertiary);
+  display: inline-flex; align-items: center; justify-content: center;
+  margin-bottom: var(--space-2);
+}
+.s-abook .empty h3 { color: var(--fg-primary); }
+.s-abook .empty p  { color: var(--fg-secondary); max-width: 240px; }
+.s-abook .pull-md {
+  position: absolute; left: 50%; transform: translateX(-50%);
+  top: 90px; z-index: 5;
+}
+.s-abook .pull-md .ring {
+  width: 32px; height: 32px; border-radius: 50%;
+  background: var(--bg-surface-2);
+  display: inline-flex; align-items: center; justify-content: center;
+  box-shadow: 0 4px 10px rgba(0,0,0,.4);
+}
+.s-abook .pull-md .ring::before {
+  content: ""; width: 18px; height: 18px;
+  border: 2px solid transparent; border-top-color: var(--accent); border-right-color: var(--accent);
+  border-radius: 50%; animation: spin var(--dur-spin) linear infinite;
+}
 @keyframes zk-spin { to { transform: rotate(360deg); } }
 @keyframes zk-pulse { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
 .s-sim { display: flex; flex-direction: column; }
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/__tests__/designExt2b.test.ts src/app/__tests__/App.test.tsx src/app/__tests__/Contacts.test.tsx src/app/__tests__/Settings.test.tsx src/app/__tests__/addressBookFlow.test.tsx src/app/__tests__/router.test.ts
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
npx playwright test e2e/visual.spec.ts
```
Expected (dry run): own tests Test Files  6 passed (6) · Tests  99 passed (99); tsc clean; whole suite Test Files  138 passed (138) · Tests  2701 passed (2701); gates green; `e2e/visual.spec.ts` 1 passed.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red.

- **M5a** — pick rows show the truncation, not the whole address (review H3) — `extension/src/app/screens/Contacts.tsx`:

  ```diff
  -             <AddressGroups address={c.address} />
  +             {c.address.length > 0 ? shortAddress(c.address) : <AddressGroups address={c.address} />}
  ```
  `timeout 300 npx vitest run src/app/__tests__/Contacts.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 14 passed (15)).

- **M5b** — pick rows never say O72 — `extension/src/app/screens/Contacts.tsx`:

  ```diff
  -           <span className="when noc-caption noc-warning">{CONTACTS_TEXT.neverSent}</span>
  +           <span className="when noc-body-sm">{whenText(c.lastSentAt, now)}</span>
  ```
  `timeout 300 npx vitest run src/app/__tests__/Contacts.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 14 passed (15)).

- **M5c** — a standalone row tap picks instead of opening the edit sheet (D21) — `extension/src/app/screens/Contacts.tsx`:

  ```diff
  - onClick={() => setSheet({kind: 'edit', address: c.address, name: c.name})}>
  + onClick={() => onPick(c.address)}>
  ```
  `timeout 300 npx vitest run src/app/__tests__/Contacts.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 14 passed (15)).

- **M5d** — full no longer disables the + — `extension/src/app/screens/Contacts.tsx`:

  ```diff
  -         {top(!full)}
  +         {top(true)}
  ```
  `timeout 300 npx vitest run src/app/__tests__/Contacts.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 14 passed (15)).

- **M5e** — the alive check after the list read dropped — `extension/src/app/screens/Contacts.tsx`:

  ```diff
  -     if (!alive.current || n !== reads.current) return;
  +     if (n !== reads.current) return;
  ```
  `timeout 300 npx vitest run src/app/__tests__/Contacts.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 14 passed (15)).

- **M5f** — Esc pops the screen under an open sheet (on #15 AND on plan 1's accounts manager remove sheet, review M3) — `extension/src/app/App.tsx`:

  ```diff
  -       if (e.key === 'Escape' && document.querySelector('[role="dialog"][aria-modal="true"]') === null) go({type: 'pop'});
  +       if (e.key === 'Escape') go({type: 'pop'});
  ```
  `timeout 300 npx vitest run src/app/__tests__/addressBookFlow.test.tsx src/app/__tests__/App.test.tsx` — Expected: **red** (dry run: red, Test Files  2 failed (2) · Tests  2 failed | 19 passed (21)).

- **M5g** — #31: a refused contacts.list reads "0 contacts" — `extension/src/app/screens/Settings.tsx`:

  ```diff
  - setContacts(r.ok ? r.data.contacts.length : null);
  + setContacts(r.ok ? r.data.contacts.length : 0);
  ```
  `timeout 300 npx vitest run src/app/__tests__/Settings.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 28 passed (29)).

- **M5h** — an address query seeds the name, not the address field (review L1) — `extension/src/app/screens/Contacts.tsx`:

  ```diff
  - setSheet(isAddressText(q) ?
  + setSheet(isAddressText('') ?
  ```
  `timeout 300 npx vitest run src/app/__tests__/Contacts.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 14 passed (15)).

- **M5i** — pick rows lose the own-account label (review L5) — `extension/src/app/screens/Contacts.tsx`:

  ```diff
  -         {ownName(c.address) !== null ? (
  +         {ownName(c.address) === 'nobody' ? (
  ```
  `timeout 300 npx vitest run src/app/__tests__/Contacts.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 14 passed (15)).

- **M5j** — pickStack invents a stack with no send route below (review L8) — `extension/src/app/router.ts`:

  ```diff
  -   if (below?.screen !== 'send') return null;
  +   if (below?.screen !== 'send') return [...stack];
  ```
  `timeout 300 npx vitest run src/app/__tests__/router.test.ts` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 32 passed (33)).

- [ ] **Step 6: Commit.**

```bash
git add extension/e2e/visual.spec.ts extension/scripts/check-classes.mjs extension/src/__tests__/designExt2b.test.ts extension/src/app/App.tsx extension/src/app/__tests__/App.test.tsx extension/src/app/__tests__/Contacts.test.tsx extension/src/app/__tests__/Settings.test.tsx extension/src/app/__tests__/addressBookFlow.test.tsx extension/src/app/__tests__/router.test.ts extension/src/app/app.css extension/src/app/router.ts extension/src/app/screens/Contacts.tsx extension/src/app/screens/Settings.tsx extension/src/app/ui/ExtIcon.tsx extension/src/styles/design-ext.css
git commit -F - <<'MSG'
feat(extension): #15 address book (standalone, search, pick, full, load failed); #31 Connections › Address book; design-ext with .s-abook

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 6: #12: the contact icon → #15 pick → the address back through the send route's draft, handled as a paste; "From your address book: <name>" above 2a's helper

**Spec:** §1.4 (pick hand-back, review M4), §6.3 (#12, the label O88), D19; §8.2 (the hand-back test + mutation)

**Files:**
- Modify: `extension/src/app/App.tsx`
- Modify: `extension/src/app/__tests__/Send.test.tsx`
- Modify: `extension/src/app/__tests__/addressBookFlow.test.tsx`
- Modify: `extension/src/app/__tests__/sendFlow.test.tsx`
- Modify: `extension/src/app/addressBook.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/screens/Send.tsx`

**Interfaces:**
- Consumes: `Send` (`src/app/screens/Send.tsx`), App's `pickRecipient` (Task 5), `routeReducer`'s `reset` and `isDraft`, `engine.recipientInfo` (its contact label, Task 2).
- Produces (as exported):
  - `src/app/screens/Send.tsx`: `Send` gains the required prop `onBook: (draft: Draft) => void`.
  - `src/app/addressBook.ts`: `export const fromBook = (name: string): string` — "From your address book: <name>" (O88), shared by #12, #20 and #27.

In the **empty** recipient field `.input-actions` holds 2a's Paste and the design's "Address book" (`#i-book`, ix:6652; Scan QR stays omitted, 2a-D13), a LockedButton so one tap opens one #15. App keeps what the user typed — the token and the amount — in the `send` route (`replace`), then pushes `{screen: 'contacts', pick: true}`. A pick resets the stack to `[…, {screen: 'send', draft: {...draft, recipient: address}, notice: null}]` (§1.4, review M4): no route gains a key, `isDraft` checks the draft like any other, and #12 mounts again holding the address — **exactly as a paste**: the same validation, the same `wallet.recipientInfo` call, the same state 3 or 6. Back without a pick is a plain `pop` (the draft untouched). The App-level test asserts the picked address reaches #12's field, the amount is kept, `recipientInfo` is called with it, and state 6 shows; mutation M6a (pop without the reset) turns it red.

For a valid address with `label.kind === 'contact'`, a `.noc-caption` "From your address book: <name>" sits **above** 2a's helper, which is unchanged: "Never sent here before" stays for an address never sent to (D19), the "sent before" line for a known one; own > contact (the background's precedence) keeps "Your account: …".

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/app/__tests__/Send.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Send.test.tsx b/extension/src/app/__tests__/Send.test.tsx
index 7d8b036..4e67251 100644
--- a/extension/src/app/__tests__/Send.test.tsx
+++ b/extension/src/app/__tests__/Send.test.tsx
@@ -7,6 +7,7 @@ import {SEND_TEXT, Send} from '../screens/Send';
 import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
 import {REFUSED_TEXT} from '../ui/Banner';
 import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
+import {CONTACTS_KEY} from '../../background/contacts';
 import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
 import {PENDING_KEY} from '../../background/pendingStore';
 import {RpcForbidden} from '../../../../core/solana/rpc';
@@ -18,7 +19,7 @@ import type {Draft} from '../send/rules';
 // Spec §4.2 (#12) and §4.3 (#43, opened from it). The harness wallet: Main (ACCOUNT) sending, Savings
 // (RECIPIENT) its own second account; 62.4821 SOL, 4 200 NOC, 740.21 USDC; SOL $150.
 const SELECTORS = selectorsOf(UI_SHEETS);
-const nav = {onBack: vi.fn(), onReview: vi.fn(), onViewPending: vi.fn()};
+const nav = {onBack: vi.fn(), onReview: vi.fn(), onViewPending: vi.fn(), onBook: vi.fn()};
 const DAY = 86_400_000;
 
 function renderSend(o: WalletOptions & {draft?: Draft | null; notice?: 'start-again' | null} = {}) {
@@ -50,9 +51,11 @@ describe('#12 send', () => {
     ]);
     expect(cta().textContent).toBe('Send SOL');
     expect(cta().disabled).toBe(true);
-    // Removed by decision: priority chips (D15), .sol (D16), scan (D13), the address book (B1b-2b), shielded (D4).
-    for (const gone of [/\.sol/, /Normal|Fast|Instant/, /Scan|Address book|shielded|private/i]) expect(document.body.textContent).not.toMatch(gone);
-    expect(screen.queryByRole('button', {name: /Scan|Address book/})).toBeNull();
+    // Removed by decision: priority chips (D15), .sol (D16), scan (D13), shielded (D4). The empty field's actions are
+    // Paste and — plan 2, ix:6652 — Address book.
+    for (const gone of [/\.sol/, /Normal|Fast|Instant/, /Scan|shielded|private/i]) expect(document.body.textContent).not.toMatch(gone);
+    expect(screen.queryByRole('button', {name: /Scan/})).toBeNull();
+    expect([...document.querySelectorAll('.recipient-row .input-actions button')].map(b => b.getAttribute('aria-label'))).toEqual(['Paste', 'Address book']);
     expect(unstyledClasses(document.querySelector('.s-send')!, SELECTORS)).toEqual([]);
   });
 
@@ -476,3 +479,59 @@ describe('#12 send', () => {
     expect(screen.getByRole('button', {name: 'Token: USDC'})).toBeTruthy();
   });
 });
+
+// B1b-2b plan 2 (§6.3): #12's contact icon and the contact label.
+describe('#12 and the address book', () => {
+  it('the contact icon opens #15 with the draft kept (token and amount; the field is empty); typing hides it', async () => {
+    await renderSend();
+    await loaded();
+    type('Amount', '1.5');
+    fireEvent.click(screen.getByRole('button', {name: 'Address book'}));
+    expect(nav.onBook).toHaveBeenCalledWith({token: 'SOL', recipient: '', amount: '1.5'});
+    type('Recipient', 'x');
+    expect(screen.queryByRole('button', {name: 'Address book'})).toBeNull();
+  });
+
+  it('rule 6: a second tap on the contact icon inside 500 ms opens nothing more', async () => {
+    await renderSend();
+    const book = screen.getByRole('button', {name: 'Address book'}) as HTMLButtonElement;
+    fireEvent.click(book);
+    book.disabled = false;
+    fireEvent.click(book);
+    expect(nav.onBook).toHaveBeenCalledTimes(1);
+  });
+
+  it('a saved contact never sent to: "From your address book: <name>" above 2a’s "Never sent here before", and state 6 stays', async () => {
+    await renderSend({before: async ext => ext.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Supplier'}])});
+    await loaded();
+    type('Recipient', COUNTERPARTY);
+    const label = await screen.findByText('From your address book: Supplier');
+    expect(label.className).toBe('noc-caption app-contact-label');
+    const helper = screen.getByText(SEND_TEXT.neverSent, {exact: false});
+    expect(label.compareDocumentPosition(helper) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
+    expect(screen.getByText(SEND_TEXT.firstTitle)).toBeTruthy();
+    expect(unstyledClasses(document.querySelector('.s-send')!, SELECTORS)).toEqual([]);
+  });
+
+  it('a saved contact sent to before: the label above "Verified · sent before · …"', async () => {
+    await renderSend({
+      before: async ext => {
+        await ext.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Supplier'}]);
+        await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: COUNTERPARTY, at: Date.now()}]);
+      },
+    });
+    await loaded();
+    type('Recipient', COUNTERPARTY);
+    expect(await screen.findByText('From your address book: Supplier')).toBeTruthy();
+    expect(screen.getByText(/Verified · sent before · today/)).toBeTruthy();
+    expect(screen.queryByText(SEND_TEXT.firstTitle)).toBeNull();
+  });
+
+  it('own > contact: an own account saved as a contact reads "Your account: Savings", no contact label', async () => {
+    await renderSend({before: async ext => ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Not my savings'}])});
+    await loaded();
+    type('Recipient', RECIPIENT);
+    expect(await screen.findByText(/Your account: Savings/)).toBeTruthy();
+    expect(screen.queryByText(/From your address book/)).toBeNull();
+  });
+});
````

Modify `extension/src/app/__tests__/addressBookFlow.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/addressBookFlow.test.tsx b/extension/src/app/__tests__/addressBookFlow.test.tsx
index b416b3c..b6fbc80 100644
--- a/extension/src/app/__tests__/addressBookFlow.test.tsx
+++ b/extension/src/app/__tests__/addressBookFlow.test.tsx
@@ -50,3 +50,46 @@ describe('#31 → #15 (plan 2)', () => {
     await waitFor(() => expect(screen.getByText('Address book', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta')?.textContent).toBe('1 contact'));
   });
 });
+
+// Spec §1.4 (review M4): #12 → #15 pick → #12 holding the picked address, exactly as a paste.
+describe('#12 → #15 pick → #12 (the hand-back)', () => {
+  const BINANCE_LOOKALIKE = 'H4qZoWSv5iyeysmHzYnVfqVBtSfoJTZQJ33YtjAXm2N1';
+  async function toPick(asked: unknown[]) {
+    await renderApp({
+      before: async ext => ext.local.set(CONTACTS_KEY, [{address: BINANCE_LOOKALIKE, name: 'Binance'}]),
+      spy: m => void ((m as {type: string}).type === 'wallet.recipientInfo' && asked.push(m)),
+    });
+    fireEvent.click(await screen.findByRole('button', {name: /^Send$/}));
+    fireEvent.change(screen.getByLabelText('Amount'), {target: {value: '0.5'}});
+    fireEvent.click(screen.getByRole('button', {name: 'Address book'}));
+    await screen.findByText('Address book', {selector: '.top-bar .title'});
+  }
+
+  it('the pick row shows the full address and O72; the pick puts the address in #12’s field, keeps the amount, and asks recipientInfo for it', async () => {
+    const asked: unknown[] = [];
+    await toPick(asked);
+    const row = (await screen.findByText('Binance')).closest('button') as HTMLButtonElement;
+    expect([...row.querySelectorAll('.addr-groups > span')].map(s => s.textContent)).toEqual(BINANCE_LOOKALIKE.match(/.{1,4}/g));
+    expect(within(row).getByText('You have never sent to this address.')).toBeTruthy();
+    fireEvent.click(row);
+    await screen.findByText('Send', {selector: '.title'});
+    expect((screen.getByLabelText('Recipient', {exact: true}) as HTMLInputElement).value).toBe(BINANCE_LOOKALIKE);
+    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.5');
+    await waitFor(() => expect(asked).toEqual([expect.objectContaining({type: 'wallet.recipientInfo', recipient: BINANCE_LOOKALIKE})]));
+    // Exactly as a paste of a never-sent address: state 6, and the contact label above it.
+    expect(await screen.findByText('From your address book: Binance')).toBeTruthy();
+    expect(screen.getByText('Never sent here before', {exact: false})).toBeTruthy();
+    expect(screen.getByText('First-time recipient')).toBeTruthy();
+    // The stack is [#11, #12]: Back from #12 is #11, not #15.
+    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
+    expect(await screen.findByText('TOKENS')).toBeTruthy();
+  });
+
+  it('Back from #15 without a pick returns to #12 with the draft untouched', async () => {
+    await toPick([]);
+    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
+    await screen.findByText('Send', {selector: '.title'});
+    expect((screen.getByLabelText('Recipient', {exact: true}) as HTMLInputElement).value).toBe('');
+    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.5');
+  });
+});
````

Modify `extension/src/app/__tests__/sendFlow.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/sendFlow.test.tsx b/extension/src/app/__tests__/sendFlow.test.tsx
index 4765f97..92ad2a0 100644
--- a/extension/src/app/__tests__/sendFlow.test.tsx
+++ b/extension/src/app/__tests__/sendFlow.test.tsx
@@ -483,7 +483,7 @@ describe('fix round 1: the toast, a lock, another account, no account', () => {
     const reviewed: unknown[] = [];
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <Send draft={{token: 'SOL', recipient: COUNTERPARTY, amount: '0.01'}} notice={null} onBack={() => undefined} onReview={(d, i) => void reviewed.push([d, i])} onViewPending={() => undefined} />
+        <Send draft={{token: 'SOL', recipient: COUNTERPARTY, amount: '0.01'}} notice={null} onBack={() => undefined} onReview={(d, i) => void reviewed.push([d, i])} onViewPending={() => undefined} onBook={() => undefined} />
       </WalletProvider>,
     );
     expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/Send.test.tsx src/app/__tests__/addressBookFlow.test.tsx src/app/__tests__/sendFlow.test.tsx
```
Expected (dry run, these test files on Task 5's tree): **red** — Test Files  2 failed | 1 passed (3) · Tests  7 failed | 70 passed (77). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/App.tsx`:

````diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index 82f02df..1a77252 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -241,6 +241,11 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
           if (selected !== null) go({type: 'push', route: {screen: 'review', account: selected, intent, notice: null}});
         }}
         onViewPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
+        onBook={draft => {
+          // The draft is kept in the route under #15 (what the user typed), then #15 opens in pick mode (§1.4, M4).
+          go({type: 'replace', route: {screen: 'send', draft, notice: null}});
+          go({type: 'push', route: {screen: 'contacts', pick: true}});
+        }}
       />
     );
   } else if (route.screen === 'review') {
````

Modify `extension/src/app/addressBook.ts`:

````diff
diff --git a/extension/src/app/addressBook.ts b/extension/src/app/addressBook.ts
index ade085e..fc8307c 100644
--- a/extension/src/app/addressBook.ts
+++ b/extension/src/app/addressBook.ts
@@ -76,6 +76,12 @@ export function markParts(name: string, query: string): [string, string, string]
   return [name.slice(0, at), name.slice(at, at + q.length), name.slice(at + q.length)];
 }
 
+/**
+ * The label wherever a contact names an address (O88) — #12, #20, #27 — with the "From your address book:" prefix, so a
+ * name can never pose as "Your account: …" (spec §6.3, E17). Precedence own > treasury > contact is the caller's.
+ */
+export const fromBook = (name: string): string => `From your address book: ${name}`;
+
 /** #31's "Address book" meta: "N contacts" (ix:13552); "1 contact" for one (the singular — for the owner to confirm). */
 export const contactsCount = (n: number): string => (n === 1 ? '1 contact' : `${n} contacts`);
 
````

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 56797b2..ce1a9ee 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1349,3 +1349,8 @@ a.btn {
   margin: 0;
   padding: var(--space-2) var(--space-3);
 }
+/* Plan 2 §6.3: #12's "From your address book: <name>" (O88), a caption above 2a's helper. */
+.s-send .recipient-row .app-contact-label {
+  color: var(--fg-secondary);
+  margin-top: var(--space-1);
+}
````

Modify `extension/src/app/screens/Send.tsx`:

````diff
diff --git a/extension/src/app/screens/Send.tsx b/extension/src/app/screens/Send.tsx
index 6b26f8a..19f404c 100644
--- a/extension/src/app/screens/Send.tsx
+++ b/extension/src/app/screens/Send.tsx
@@ -23,6 +23,7 @@ import {LockedButton} from '../ui/LockedButton';
 import {useEscape} from '../ui/useEscape';
 import {useNow} from '../useNow';
 import {TokenSheet} from './TokenSheet';
+import {fromBook} from '../addressBook';
 import type {Balances, Intent, Pending, RecipientInfo, Token} from '../engine';
 
 /** The fixed strings #12 shows (spec §4.2); adapted ones are marked there. */
@@ -51,9 +52,12 @@ const balanceKey = (t: Token): keyof Balances => (t === 'SOL' ? 'sol' : t === 'N
 /**
  * #12 send (spec §4.2). Nothing is prepared here: the CTA hands the intent to #19, which prepares. The hints —
  * the recipient's (E6, local only), the predicted re-authentication, MAX — are hints; #19 and #20 show the
- * engine's own answers, which decide. Removed by decision: the priority chips (D15), `.sol` (D16), scan (D13),
- * the address book (B1b-2b) and the shielded variant (D4); the fee-loading state (the fee is known only once #19
- * prepares). Rule 6: the CTA is a LockedButton.
+ * engine's own answers, which decide. Removed by decision: the priority chips (D15), `.sol` (D16), scan (D13)
+ * and the shielded variant (D4); the fee-loading state (the fee is known only once #19 prepares). Rule 6: the CTA is a
+ * LockedButton. B1b-2b plan 2 (§6.3): the empty field's "Address book" icon (ix:6652) opens #15 in pick mode with the
+ * draft kept; a picked address comes back through the route's draft and is handled exactly as a paste. A saved
+ * contact adds "From your address book: <name>" above the helper, which is unchanged — "Never sent here before" stays
+ * for an address never sent to (a contact is not known, D19).
  */
 export function Send({
   draft,
@@ -61,12 +65,15 @@ export function Send({
   onBack,
   onReview,
   onViewPending,
+  onBook,
 }: {
   draft: Draft | null;
   notice: 'start-again' | null;
   onBack: () => void;
   onReview: (draft: Draft, intent: Intent) => void;
   onViewPending: (p: Pending) => void;
+  /** Plan 2: #15 in pick mode, holding what the user typed (the token and the amount; the field is empty). */
+  onBook: (draft: Draft) => void;
 }) {
   const m = useWallet();
   const now = useNow(30_000, m.now);
@@ -201,6 +208,10 @@ export function Send({
     }
   }
 
+  // E17's label for a saved contact (the background's precedence: own > treasury > contact) — above the helper, which
+  // stays what 2a says: "Never sent here before" for an address never sent to (D19).
+  const contactName = valid && !self && info?.label?.kind === 'contact' ? info.label.name : null;
+
   const percent = amount === null ? null : percentOf(amount, balance);
   let available;
   if (predicted && valid && !self) {
@@ -280,9 +291,15 @@ export function Send({
               />
               <div className="input-actions">
                 {recipient === '' ? (
-                  <button type="button" aria-label="Paste" onClick={() => void paste()}>
-                    <ExtIcon name="clip" size={18} />
-                  </button>
+                  <>
+                    <button type="button" aria-label="Paste" onClick={() => void paste()}>
+                      <ExtIcon name="clip" size={18} />
+                    </button>
+                    {/* ix:6652; Scan QR (ix:6651) stays omitted (2a-D13). Rule 6: one #15 per tap. */}
+                    <LockedButton className="" label="Address book" onPress={() => onBook({token, recipient: '', amount: amountText})}>
+                      <ExtIcon name="book" size={18} />
+                    </LockedButton>
+                  </>
                 ) : firstTime ? null : (
                   // Design state 6 draws no field action; state 3 tints Clear --danger.
                   <button type="button" aria-label="Clear recipient" className={invalid ? 'app-danger' : undefined} onClick={() => edit('')}>
@@ -291,6 +308,7 @@ export function Send({
                 )}
               </div>
             </div>
+            {contactName === null ? null : <div className="noc-caption app-contact-label">{fromBook(contactName)}</div>}
             {helper}
             {firstTime ? (
               <div className="app-send-addr noc-mono">
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/Send.test.tsx src/app/__tests__/addressBookFlow.test.tsx src/app/__tests__/sendFlow.test.tsx
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  3 passed (3) · Tests  77 passed (77); tsc clean; whole suite Test Files  138 passed (138) · Tests  2708 passed (2708); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red.

- **M6a** — the pick pops without the reset (the spec mutation, review M4) — `extension/src/app/App.tsx`:

  ```diff
  -     go(routes === null ? {type: 'pop'} : {type: 'reset', routes});
  +     void routes;
  +     go({type: 'pop'});
  ```
  `timeout 300 npx vitest run src/app/__tests__/addressBookFlow.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 4 passed (5)).

- **M6b** — the draft not kept under #15 — `extension/src/app/App.tsx`:

  ```diff
  -           // The draft is kept in the route under #15 (what the user typed), then #15 opens in pick mode (§1.4, M4).
  -           go({type: 'replace', route: {screen: 'send', draft, notice: null}});
  + (deleted)
  ```
  `timeout 300 npx vitest run src/app/__tests__/addressBookFlow.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 3 passed (5)).

- **M6c** — the contact label replaces 2a's helper (D19: "Never sent here before" must stay) — `extension/src/app/screens/Send.tsx`:

  ```diff
  -             {helper}
  -             {firstTime ? (
  +             {contactName === null ? helper : null}
  +             {firstTime ? (
  ```
  `timeout 300 npx vitest run src/app/__tests__/Send.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  2 failed | 29 passed (31)).

- **M6d** — the contact icon without its lock (rule 6) — `extension/src/app/screens/Send.tsx`:

  ```diff
  - <LockedButton className="" label="Address book" onPress={() => onBook({token, recipient: '', amount: amountText})}>
  -                       <ExtIcon name="book" size={18} />
  -                     </LockedButton>
  + <button type="button" aria-label="Address book" onClick={() => onBook({token, recipient: '', amount: amountText})}>
  +                       <ExtIcon name="book" size={18} />
  +                     </button>
  ```
  `timeout 300 npx vitest run src/app/__tests__/Send.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 30 passed (31)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/app/App.tsx extension/src/app/__tests__/Send.test.tsx extension/src/app/__tests__/addressBookFlow.test.tsx extension/src/app/__tests__/sendFlow.test.tsx extension/src/app/addressBook.ts extension/src/app/app.css extension/src/app/screens/Send.tsx
git commit -F - <<'MSG'
feat(extension): #12's contact icon, the pick hand-back as a paste, the address-book label

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 7: #20: the To label (own > treasury > contact) and the first-time state's "Save as — Add to address book? · Add · Skip"

**Spec:** §6.3 (#20, ix:9343-9350, ix:9565), D19, C12; §8.2 (Send never focused with the row present; the row never for a known address); §7 rule 6 (#20's Add/Skip)

**Files:**
- Modify: `extension/src/app/__tests__/Confirm.test.tsx`
- Modify: `extension/src/app/__tests__/sendFlow.test.tsx`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/screens/Confirm.tsx`

**Interfaces:**
- Consumes: `Confirm` (`src/app/screens/Confirm.tsx`) and its generation counter `gen`, `ContactSheet`, `fromBook`, `engine.contacts`, `useEscape`.
- Produces (as exported): `CONFIRM_TEXT` gains `saveAs`, `saveAsAsk`, `saveAsAdd`, `saveAsSkip` (the design's strings). No prop changes.

#20 reads the book once per mount (`contacts.list`; again after a save) behind its generation counter. The "To" row's label is own > treasury > contact. While the reasons carry `first-send` **and** the address is not a contact **and** the book was read, the design's `.detail-row` "Save as" / "Add to address book? · Add · Skip" (ix:9349-9350; Add in `--accent`, Skip in `--fg-tertiary`, two LockedButton text buttons with 48 px targets) shows between To and Network. **Add** opens the contact sheet prefilled (it says the address was never sent to — O72); a save hides the row and the label appears; **Skip** hides the row for this #20. Neither touches Send, its never-focused rule (2a R2-L4) or the first-time banner — "CTA enabled (banner is informational, not a gate)" (ix:9565) holds, and the proof is still asked (D19). Without the book (refused, or not yet answered) no row is offered: Add could otherwise rename a contact it never saw (`contacts.set` renames an existing address). While the sheet is open #20's own Esc is paused (the sheet closes; #20 stays). The sheet renders beside `.s-conf`. The tab's quiet-provider test (`sendFlow.test.tsx`) now lists `contacts.list` among #20's own reads.

Rule 6: Add's lock is pinned (it is disabled and `is-busy` on the tap); a second open would look the same, so the lock itself is the observable. Skip hides its own row on the tap — nothing is left to press twice — and is a LockedButton too (Scope 3.8).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/app/__tests__/Confirm.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Confirm.test.tsx b/extension/src/app/__tests__/Confirm.test.tsx
index 1cdae7d..f410efc 100644
--- a/extension/src/app/__tests__/Confirm.test.tsx
+++ b/extension/src/app/__tests__/Confirm.test.tsx
@@ -13,6 +13,8 @@ import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
 import {CONFIRM_STRIKE_KEY} from '../prefs';
 import {REFUSED_TEXT} from '../ui/Banner';
 import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
+import {CONTACTS_KEY} from '../../background/contacts';
+import {lock} from '../../background/autolock';
 import {PENDING_KEY} from '../../background/pendingStore';
 import {PREPARED_KEY} from '../../background/session';
 import {CHALLENGE_MAX_LIFE_MS, satisfyChallenge} from '../../background/reauthChallenges';
@@ -135,7 +137,8 @@ describe('#20 tx-confirm — what it shows', () => {
     expect(headline.getAttribute('aria-label')).toBe(`Send 0.0100 SOL to recipient address ${COUNTERPARTY.match(/.{1,4}/g)?.join(' ')}`);
     expect(document.querySelector('.high-value-banner')).toBeNull();
     expect(screen.getByRole('button', {name: 'Cancel'})).toBeTruthy();
-    // Removed by decision: priority chips (D15), "Save as / Add to address book" (B1b-2b), typed CONFIRM (D22), DIRECT.
+    // Removed by decision: priority chips (D15), typed CONFIRM (D22), DIRECT. "Save as" (plan 2) is the first-time
+    // state's alone: a known recipient never offers it.
     expect(document.body.textContent).not.toMatch(/Normal|Fast|Instant|Save as|address book|Type CONFIRM|DIRECT|mainnet-beta/);
     expect(screen.queryByText(CONFIRM_TEXT.opensTab)).toBeNull();
     expect(unstyledClasses(document.querySelector('.s-conf')!, SELECTORS)).toEqual([]);
@@ -1179,3 +1182,135 @@ describe('one caller of wallet.send (source backstop over all of src/)', () => {
     expect(confirm).toContain('onPress={tap}');
   });
 });
+
+// B1b-2b plan 2 (§6.3): #20's To label and the first-time state's "Save as" row (ix:9349-9350).
+describe('#20 and the address book', () => {
+  const row = () => document.querySelector('.detail-row.app-save-as');
+  const toLabel = () => [...document.querySelectorAll('.detail-row')].find(r => r.querySelector('.lbl')?.textContent === 'To')?.querySelector('.val .noc-body-sm')?.textContent ?? null;
+
+  it('first-time, not saved: "Save as — Add to address book? · Add · Skip"; the banner stays; Send is not focused', async () => {
+    const w = await renderConfirm({known: false});
+    const send = await sendButton();
+    await waitFor(() => expect(row()).not.toBeNull());
+    expect(row()?.querySelector('.lbl')?.textContent).toBe('Save as');
+    expect(row()?.querySelector('.val')?.textContent).toBe('Add to address book? · Add · Skip');
+    expect(screen.getByRole('button', {name: 'Add'}).className).toBe('app-text-btn noc-accent');
+    expect(screen.getByRole('button', {name: 'Skip'}).className).toBe('app-text-btn app-dim');
+    expect([...document.querySelectorAll('.detail-row .lbl')].map(l => l.textContent)).toEqual(['From', 'To', 'Save as', 'Network']);
+    expect(screen.getByText(CONFIRM_TEXT.firstTitle)).toBeTruthy();
+    expect(document.activeElement).not.toBe(send);
+    expect(send.disabled).toBe(false);
+    expect(unstyledClasses(document.querySelector('.s-conf')!, SELECTORS)).toEqual([]);
+    expect(w.sends()).toBe(0);
+  });
+
+  it('Add: the sheet prefilled (never sent); saved → the row hides and "From your address book: <name>" labels To; nothing sent', async () => {
+    const w = await renderConfirm({known: false});
+    const send = await sendButton();
+    fireEvent.click(await screen.findByRole('button', {name: 'Add'}));
+    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
+    expect([...dialog.querySelectorAll('.app-contact-addr .addr-groups > span')].map(s => s.textContent)).toEqual(COUNTERPARTY.match(/.{1,4}/g));
+    expect(await screen.findByText('You have never sent to this address.')).toBeTruthy();
+    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Supplier'}});
+    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
+    await waitFor(() => expect(toLabel()).toBe('From your address book: Supplier'));
+    expect(row()).toBeNull();
+    expect(screen.queryByRole('dialog')).toBeNull();
+    expect(document.activeElement).not.toBe(send);
+    // A contact is a label, never trust (D19): the first-time banner and the proof stay.
+    expect(screen.getByText(CONFIRM_TEXT.firstTitle)).toBeTruthy();
+    expect(screen.getByText(CONFIRM_TEXT.opensTab)).toBeTruthy();
+    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: COUNTERPARTY, name: 'Supplier'}]);
+    expect(w.sends()).toBe(0);
+  });
+
+  // Rule 6 (spec §7): Add is a LockedButton — it locks on the tap (500 ms, until the action settles). Opening the sheet
+  // twice would look the same, so the lock itself is what is pinned. Skip hides its own row on the tap (nothing to press
+  // twice); it is a LockedButton too.
+  it('rule 6: Add locks on the tap', async () => {
+    await renderConfirm({known: false});
+    const add = (await screen.findByRole('button', {name: 'Add'})) as HTMLButtonElement;
+    fireEvent.click(add);
+    expect(add.disabled).toBe(true);
+    expect(add.className).toBe('app-text-btn noc-accent is-busy');
+  });
+
+  // The generation guard after the book read: a `locked` answer would reload (a wallet.state read) — after #20 went, it
+  // must not.
+  it('a book answer after #20 went does nothing: a late `locked` reloads nothing', async () => {
+    let release: () => void = () => undefined;
+    const held = new Promise<void>(r => {
+      release = r;
+    });
+    let gone = false;
+    const after: string[] = [];
+    const w = await renderConfirm({
+      known: false,
+      gate: async m => {
+        if (gone) after.push(m.type);
+        if (m.type === 'contacts.list') await held;
+      },
+    });
+    await sendButton();
+    await lock(w.ext);
+    gone = true;
+    cleanup();
+    release();
+    await act(async () => new Promise(r => setTimeout(r, 30)));
+    expect(after).toEqual([]);
+  });
+
+  it('Skip hides the row for this #20; nothing is saved', async () => {
+    const w = await renderConfirm({known: false});
+    fireEvent.click(await screen.findByRole('button', {name: 'Skip'}));
+    await waitFor(() => expect(row()).toBeNull());
+    expect(toLabel()).toBeNull();
+    expect(await w.ext.local.get(CONTACTS_KEY)).toBeUndefined();
+  });
+
+  it('Esc with the sheet open closes the sheet only: #20 stays, no back', async () => {
+    await renderConfirm({known: false});
+    fireEvent.click(await screen.findByRole('button', {name: 'Add'}));
+    await screen.findByRole('dialog', {name: 'Add contact'});
+    fireEvent.keyDown(document, {key: 'Escape'});
+    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
+    expect(nav.onBack).not.toHaveBeenCalled();
+    expect(row()).not.toBeNull();
+  });
+
+  it('a first-time recipient already saved: the label, no row — the first-time banner stays (D19)', async () => {
+    await renderConfirm({known: false, before: ext => ext.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Supplier'}])});
+    await sendButton();
+    await waitFor(() => expect(toLabel()).toBe('From your address book: Supplier'));
+    expect(row()).toBeNull();
+    expect(screen.getByText(CONFIRM_TEXT.firstTitle)).toBeTruthy();
+  });
+
+  it('a known recipient: no row, even unsaved', async () => {
+    await renderConfirm();
+    await sendButton();
+    await act(async () => new Promise(r => setTimeout(r, 20)));
+    expect(row()).toBeNull();
+  });
+
+  it('own > contact: an own account saved as a contact keeps "Your account: <name>"', async () => {
+    await renderConfirm({intent: {token: 'SOL', recipient: RECIPIENT, amount: 10_000_000n}, before: ext => ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Not my savings'}])});
+    await sendButton();
+    await act(async () => new Promise(r => setTimeout(r, 20)));
+    expect(toLabel()).toBe('Your account: Savings');
+  });
+
+  it('the book not read (refused): no label, and no row — Add could rename a contact it cannot see', async () => {
+    await renderConfirm({
+      known: false,
+      gate: m => {
+        if (m.type === 'contacts.list') throw new Error('worker restarting');
+      },
+    });
+    await sendButton();
+    await act(async () => new Promise(r => setTimeout(r, 20)));
+    expect(row()).toBeNull();
+    expect(toLabel()).toBeNull();
+    expect(screen.getByText(CONFIRM_TEXT.firstTitle)).toBeTruthy();
+  });
+});
````

Modify `extension/src/app/__tests__/sendFlow.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/sendFlow.test.tsx b/extension/src/app/__tests__/sendFlow.test.tsx
index 92ad2a0..1d040f2 100644
--- a/extension/src/app/__tests__/sendFlow.test.tsx
+++ b/extension/src/app/__tests__/sendFlow.test.tsx
@@ -69,8 +69,9 @@ describe('the UI tab’s resume route is #20 (D38)', () => {
     await sendButton();
     await act(async () => void vi.advanceTimersByTime(10_000));
     expect(w.sends()).toBe(0);
-    // The quiet provider: the state, and what #20 reads itself — no cache, balances or ping on a hand-over route.
-    expect([...new Set(w.sent)].sort()).toEqual(['wallet.pending', 'wallet.preparedFor', 'wallet.prices', 'wallet.state']);
+    // The quiet provider: the state, and what #20 reads itself — no cache, balances or ping on a hand-over route. Plan 2:
+    // #20 reads the address book for its To label.
+    expect([...new Set(w.sent)].sort()).toEqual(['contacts.list', 'wallet.pending', 'wallet.preparedFor', 'wallet.prices', 'wallet.state']);
     fireEvent.click(await sendButton());
     expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
     expect(w.sends()).toBe(1);
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/Confirm.test.tsx src/app/__tests__/sendFlow.test.tsx
```
Expected (dry run, these test files on Task 6's tree): **red** — Test Files  2 failed (2) · Tests  7 failed | 96 passed (103). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index ce1a9ee..19a161b 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1354,3 +1354,21 @@ a.btn {
   color: var(--fg-secondary);
   margin-top: var(--space-1);
 }
+/*
+ * Plan 2 §6.3: #20's "Save as" row (ix:9349-9350) — the value in --fg-tertiary, "Add" in --accent and "Skip" in
+ * --fg-tertiary as two text buttons, each a 48 px target without a button's chrome.
+ */
+.s-conf .detail-row.app-save-as {
+  align-items: center;
+}
+.s-conf .detail-row .val.app-save-as-val {
+  color: var(--fg-tertiary);
+}
+.app-text-btn {
+  background: transparent;
+  border: 0;
+  padding: 0 var(--space-2);
+  min-height: var(--touch-target-min);
+  font: inherit;
+  cursor: pointer;
+}
````

Modify `extension/src/app/screens/Confirm.tsx`:

````diff
diff --git a/extension/src/app/screens/Confirm.tsx b/extension/src/app/screens/Confirm.tsx
index a41b0d7..dd2cede 100644
--- a/extension/src/app/screens/Confirm.tsx
+++ b/extension/src/app/screens/Confirm.tsx
@@ -13,7 +13,9 @@ import {useNow} from '../useNow';
 import {REVIEW_TEXT} from './Review';
 import {CONFIRM_STRIKE_KEY, readPref, writePref} from '../prefs';
 import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
-import type {Intent, Pending, Prices, Resumable} from '../engine';
+import {ContactSheet} from '../ui/ContactSheet';
+import {fromBook} from '../addressBook';
+import type {Contact, Intent, Pending, Prices, Resumable} from '../engine';
 
 /** The fixed strings #20 shows (spec §4.5); adapted ones are marked there. */
 export const CONFIRM_TEXT = {
@@ -45,6 +47,11 @@ export const CONFIRM_TEXT = {
   /** index.html #s20 state 3's warning, kept beside the password line (review fix round 1; confirmed by the owner 2026-10-04): "If you didn't initiate this — cancel now." */
   notYou: "If you didn't initiate this — ",
   cancelNow: 'cancel now',
+  /** B1b-2b plan 2 (ix:9349-9350): the first-time state's "Save as" row. */
+  saveAs: 'Save as',
+  saveAsAsk: 'Add to address book?',
+  saveAsAdd: 'Add',
+  saveAsSkip: 'Skip',
 } as const;
 
 const HEX32 = /^[0-9a-f]{32}$/;
@@ -85,6 +92,13 @@ export type ConfirmProps = ConfirmEntry & {
  * a new tap. Send is never focused (R2-L4). The quote's end re-prepares by itself at most once without user input
  * (C5); after that "Quote expired" and `[Refresh]`, and the refresh is a tap. The stale "Updated with a fresh
  * network quote" banner hides once the quote has expired again (owner, 2026-10-05).
+ *
+ * B1b-2b plan 2 (§6.3): the "To" row's label is own > treasury > contact ("From your address book: <name>", from
+ * contacts.list). While the reasons carry `first-send` and the address is not a contact, the design's "Save as" row
+ * (ix:9349-9350) offers "Add to address book? · Add · Skip": Add opens the contact sheet prefilled (it says the address
+ * was never sent to); a save hides the row and the label appears; Skip hides it for this #20. Neither touches Send, its
+ * focus rule or the first-time banner — the banner is informational, not a gate (ix:9565). The row needs the book read:
+ * without it (refused, or not answered yet) no row is offered, so Add can never rename a contact it could not see.
  */
 export function Confirm(props: ConfirmProps) {
   const {account, entry, onBack, onCancelled, onTrack, onReview, onStartAgain, onSuperseded} = props;
@@ -98,6 +112,11 @@ export function Confirm(props: ConfirmProps) {
   const [ownPrices, setOwnPrices] = useState<Prices | null>(null);
   const [quoteDead, setQuoteDead] = useState(false);
   const [busy, setBusy] = useState(false);
+  /** Plan 2: the address book (contacts.list), for the To label and the Save-as row; null until read or when refused. */
+  const [book, setBook] = useState<Contact[] | null>(null);
+  /** The Save-as row was answered on this #20 (Skip, or a save) — it does not come back. */
+  const [saveAsDone, setSaveAsDone] = useState(false);
+  const [adding, setAdding] = useState(false);
   /** [Cancel]'s discard failed (E7): #20 stays, says so, and is live again — as #19 does (final review M1). */
   const [cancelFailed, setCancelFailed] = useState(false);
   /**
@@ -192,6 +211,18 @@ export function Confirm(props: ConfirmProps) {
     // Read once per mount: the account is this route's.
   }, [account, engine]);
 
+  // Plan 2: the address book, read once per mount (and again after a save) — an answer after the screen went is dropped.
+  const readBook = useCallback(async () => {
+    const g = gen.current;
+    const r = await engine.contacts();
+    if (gen.current !== g) return;
+    if (r.ok) setBook(r.data.contacts);
+    else if (r.error === 'locked') void reload();
+  }, [engine, reload]);
+  useEffect(() => {
+    void readBook();
+  }, [readBook]);
+
   // A send from this account was open when #20 read it: re-read wallet.pending on the provider's 2 s cadence while the
   // block is shown, so a send that settles lifts it without leaving the screen (final review M4). #20's own read — the
   // UI tab's quiet provider reads no pending of its own. An answer for an older read, or after the block lifted or the
@@ -260,7 +291,8 @@ export function Confirm(props: ConfirmProps) {
     left.current = true;
     onBack(view.intent);
   };
-  useEscape(back);
+  // The contact sheet takes Esc itself while it is open (it closes; #20 stays).
+  useEscape(back, !adding);
 
   const cancelling = useRef(false);
   const cancel = async () => {
@@ -422,7 +454,11 @@ export function Confirm(props: ConfirmProps) {
   const fiat = [usd === null ? null : `≈ ${showUsd(usd)} USD`, high && percent !== null ? `${percent} % of your balance` : null].filter((x): x is string => x !== null).join(' · ');
   const from = m.wallet?.accounts.find(a => a.publicKey === account);
   const own = m.wallet?.accounts.find(a => a.publicKey === intent.recipient);
-  const toLabel = own !== undefined ? `Your account: ${own.name}` : intent.recipient === MAINNET_FEE_TREASURY ? 'Noctura treasury' : null;
+  const contact = book?.find(c => c.address === intent.recipient);
+  const toLabel =
+    own !== undefined ? `Your account: ${own.name}` : intent.recipient === MAINNET_FEE_TREASURY ? 'Noctura treasury' : contact !== undefined ? fromBook(contact.name) : null;
+  // ix:9349: offered only for a first-time recipient that is not saved, while the book is known, once per #20.
+  const offerSave = first && book !== null && contact === undefined && !saveAsDone;
   const rows = feeRows(view.fees);
   const solTotal = view.solRequiredLamports;
   const totalUsd = solUsd === null ? null : (Number(solTotal) / 1e9) * solUsd + (token === 'SOL' ? 0 : usd ?? Number.NaN);
@@ -448,107 +484,136 @@ export function Confirm(props: ConfirmProps) {
   const headlineLabel = `${high ? `${CONFIRM_TEXT.highValue}: ` : ''}Send ${amount} ${token} to ${first ? 'first-time ' : ''}recipient address ${(intent.recipient.match(/.{1,4}/g) ?? []).join(' ')}`;
 
   return (
-    <div className="screen s-conf">
-      {top}
-      <div className="scroll">
-        {cancelFailed ? <Banner tone="danger" title={REVIEW_TEXT.leaveFailed} /> : null}
-        {banner}
-        <h1 className="headline" aria-label={headlineLabel}>
-          <span className="amount noc-numeral">Send {amount}</span> <span className="ticker">{token}</span> <span className="to-prefix">to</span>{' '}
-          <span className="recipient noc-mono">
-            <AddressGroups address={intent.recipient} />
-          </span>
-        </h1>
-        <div className={`review-card${high ? ' high-value' : ''}`}>
-          <span className="eyebrow">{high ? CONFIRM_TEXT.highValue : CONFIRM_TEXT.about}</span>
-          <div className="head">
-            <span className="amount noc-numeral">{amount}</span>
-            <span className="ticker">{token}</span>
-          </div>
-          {fiat === '' ? null : <span className="fiat">{fiat}</span>}
-        </div>
-        {high ? (
-          <div className="high-value-banner">
-            <span className="help">
-              {needsProof ? <span>{surface === 'popup' ? CONFIRM_TEXT.reauthLine : CONFIRM_TEXT.reauthLineTab}</span> : null}
-              {needsProof ? ' ' : null}
-              {CONFIRM_TEXT.notYou}
-              <span className="app-danger">{CONFIRM_TEXT.cancelNow}</span>.
+    <>
+      <div className="screen s-conf">
+        {top}
+        <div className="scroll">
+          {cancelFailed ? <Banner tone="danger" title={REVIEW_TEXT.leaveFailed} /> : null}
+          {banner}
+          <h1 className="headline" aria-label={headlineLabel}>
+            <span className="amount noc-numeral">Send {amount}</span> <span className="ticker">{token}</span> <span className="to-prefix">to</span>{' '}
+            <span className="recipient noc-mono">
+              <AddressGroups address={intent.recipient} />
             </span>
-          </div>
-        ) : null}
-        {first ? (
-          <div className="first-time-banner" role="note">
-            <ExtIcon name="alert-triangle" size={18} />
-            <div>
-              <b className="app-block">{CONFIRM_TEXT.firstTitle}</b>
-              <span className="noc-caption app-secondary">{CONFIRM_TEXT.firstLine}</span>
+          </h1>
+          <div className={`review-card${high ? ' high-value' : ''}`}>
+            <span className="eyebrow">{high ? CONFIRM_TEXT.highValue : CONFIRM_TEXT.about}</span>
+            <div className="head">
+              <span className="amount noc-numeral">{amount}</span>
+              <span className="ticker">{token}</span>
             </div>
+            {fiat === '' ? null : <span className="fiat">{fiat}</span>}
           </div>
-        ) : null}
-        <div className="detail-grid">
-          <div className="detail-row">
-            <span className="lbl">From</span>
-            <span className="val app-stack">
-              {from === undefined ? null : <span className="noc-body-sm">{from.name}</span>}
-              <span className="noc-mono">
-                <AddressGroups address={account} />
+          {high ? (
+            <div className="high-value-banner">
+              <span className="help">
+                {needsProof ? <span>{surface === 'popup' ? CONFIRM_TEXT.reauthLine : CONFIRM_TEXT.reauthLineTab}</span> : null}
+                {needsProof ? ' ' : null}
+                {CONFIRM_TEXT.notYou}
+                <span className="app-danger">{CONFIRM_TEXT.cancelNow}</span>.
               </span>
-            </span>
-          </div>
-          <div className="detail-row">
-            <span className="lbl">To</span>
-            <span className="val app-stack">
-              {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
-              <span className="noc-mono">
-                <AddressGroups address={intent.recipient} />
+            </div>
+          ) : null}
+          {first ? (
+            <div className="first-time-banner" role="note">
+              <ExtIcon name="alert-triangle" size={18} />
+              <div>
+                <b className="app-block">{CONFIRM_TEXT.firstTitle}</b>
+                <span className="noc-caption app-secondary">{CONFIRM_TEXT.firstLine}</span>
+              </div>
+            </div>
+          ) : null}
+          <div className="detail-grid">
+            <div className="detail-row">
+              <span className="lbl">From</span>
+              <span className="val app-stack">
+                {from === undefined ? null : <span className="noc-body-sm">{from.name}</span>}
+                <span className="noc-mono">
+                  <AddressGroups address={account} />
+                </span>
               </span>
-            </span>
-          </div>
-          <div className="detail-row">
-            <span className="lbl">Network</span>
-            <span className="val">{CONFIRM_TEXT.network}</span>
+            </div>
+            <div className="detail-row">
+              <span className="lbl">To</span>
+              <span className="val app-stack">
+                {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
+                <span className="noc-mono">
+                  <AddressGroups address={intent.recipient} />
+                </span>
+              </span>
+            </div>
+            {offerSave ? (
+              <div className="detail-row app-save-as">
+                <span className="lbl">{CONFIRM_TEXT.saveAs}</span>
+                <span className="val app-save-as-val">
+                  {CONFIRM_TEXT.saveAsAsk} ·{' '}
+                  <LockedButton className="app-text-btn noc-accent" onPress={() => setAdding(true)}>
+                    {CONFIRM_TEXT.saveAsAdd}
+                  </LockedButton>{' '}
+                  ·{' '}
+                  <LockedButton className="app-text-btn app-dim" onPress={() => setSaveAsDone(true)}>
+                    {CONFIRM_TEXT.saveAsSkip}
+                  </LockedButton>
+                </span>
+              </div>
+            ) : null}
+            <div className="detail-row">
+              <span className="lbl">Network</span>
+              <span className="val">{CONFIRM_TEXT.network}</span>
+            </div>
           </div>
-        </div>
-        <div className="fee-block">
-          <h3>Fees</h3>
-          {rows.map(f => (
-            <div className="fee-row" key={f.label}>
-              <span>{f.label}</span>
-              <span className="val noc-numeral">{f.lamports === null ? '' : `${showLamports(f.lamports)} SOL`}</span>
-              <span className="fiat noc-numeral">{f.lamports === null ? '' : feeUsd(solUsd === null ? null : (Number(f.lamports) / 1e9) * solUsd)}</span>
+          <div className="fee-block">
+            <h3>Fees</h3>
+            {rows.map(f => (
+              <div className="fee-row" key={f.label}>
+                <span>{f.label}</span>
+                <span className="val noc-numeral">{f.lamports === null ? '' : `${showLamports(f.lamports)} SOL`}</span>
+                <span className="fiat noc-numeral">{f.lamports === null ? '' : feeUsd(solUsd === null ? null : (Number(f.lamports) / 1e9) * solUsd)}</span>
+              </div>
+            ))}
+            <div className="fee-row total">
+              <span className="lbl">Total</span>
+              <span className="val noc-numeral">{token === 'SOL' ? `${showLamports(solTotal)} SOL` : `${amount} ${token} + ${showLamports(solTotal)} SOL`}</span>
+              <span className="fiat noc-numeral">{totalUsd === null || Number.isNaN(totalUsd) ? '—' : showUsd(totalUsd)}</span>
             </div>
-          ))}
-          <div className="fee-row total">
-            <span className="lbl">Total</span>
-            <span className="val noc-numeral">{token === 'SOL' ? `${showLamports(solTotal)} SOL` : `${amount} ${token} + ${showLamports(solTotal)} SOL`}</span>
-            <span className="fiat noc-numeral">{totalUsd === null || Number.isNaN(totalUsd) ? '—' : showUsd(totalUsd)}</span>
+          </div>
+          <div className="app-quote noc-caption noc-numeral">
+            {quoteDead ? (
+              <>
+                {CONFIRM_TEXT.quoteExpired}{' '}
+                <LockedButton className="btn btn-tertiary app-btn-inline" onPress={refresh} disabled={refused || inFlight}>
+                  {CONFIRM_TEXT.refresh}
+                </LockedButton>
+              </>
+            ) : (
+              `Quote valid ${seconds} s · slot ${view.simulation.slot.toLocaleString('en-US').replace(/,/g, ' ')}`
+            )}
           </div>
         </div>
-        <div className="app-quote noc-caption noc-numeral">
-          {quoteDead ? (
-            <>
-              {CONFIRM_TEXT.quoteExpired}{' '}
-              <LockedButton className="btn btn-tertiary app-btn-inline" onPress={refresh} disabled={refused || inFlight}>
-                {CONFIRM_TEXT.refresh}
-              </LockedButton>
-            </>
-          ) : (
-            `Quote valid ${seconds} s · slot ${view.simulation.slot.toLocaleString('en-US').replace(/,/g, ' ')}`
-          )}
+        <div className="sticky-bar">
+          <LockedButton className={high ? 'btn btn-destructive' : 'btn btn-primary'} disabled={open !== null || quoteDead || busy || refused} onPress={tap}>
+            <ExtIcon name="send" size={18} />
+            Send {amount} {token}
+          </LockedButton>
+          <button type="button" className="btn btn-tertiary" disabled={inFlight} onClick={() => void cancel()}>
+            {CONFIRM_TEXT.cancel}
+          </button>
+          {open !== null ? <p className="noc-caption app-muted app-center-text">{CONFIRM_TEXT.pending}</p> : null}
+          {open === null && needsProof ? <p className="noc-caption app-muted app-center-text">{surface === 'popup' ? CONFIRM_TEXT.opensTab : CONFIRM_TEXT.opensHere}</p> : null}
         </div>
       </div>
-      <div className="sticky-bar">
-        <LockedButton className={high ? 'btn btn-destructive' : 'btn btn-primary'} disabled={open !== null || quoteDead || busy || refused} onPress={tap}>
-          <ExtIcon name="send" size={18} />
-          Send {amount} {token}
-        </LockedButton>
-        <button type="button" className="btn btn-tertiary" disabled={inFlight} onClick={() => void cancel()}>
-          {CONFIRM_TEXT.cancel}
-        </button>
-        {open !== null ? <p className="noc-caption app-muted app-center-text">{CONFIRM_TEXT.pending}</p> : null}
-        {open === null && needsProof ? <p className="noc-caption app-muted app-center-text">{surface === 'popup' ? CONFIRM_TEXT.opensTab : CONFIRM_TEXT.opensHere}</p> : null}
-      </div>
-    </div>
+      {/* Beside `.s-conf`, not inside (as #43 beside #12): `.s-conf .detail-row` would style the sheet's rows. */}
+      {adding ? (
+        <ContactSheet
+          mode={{kind: 'add', address: intent.recipient}}
+          onClose={() => setAdding(false)}
+          onSaved={() => {
+            setAdding(false);
+            setSaveAsDone(true);
+            void readBook();
+          }}
+        />
+      ) : null}
+    </>
   );
 }
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/Confirm.test.tsx src/app/__tests__/sendFlow.test.tsx
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  2 passed (2) · Tests  103 passed (103); tsc clean; whole suite Test Files  138 passed (138) · Tests  2718 passed (2718); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red.

- **M7a** — Save as offered while the book is unread — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -   const offerSave = first && book !== null && contact === undefined && !saveAsDone;
  +   const offerSave = first && contact === undefined && !saveAsDone;
  ```
  `timeout 300 npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 61 passed (62)).

- **M7b** — Save as offered for a saved address — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -   const offerSave = first && book !== null && contact === undefined && !saveAsDone;
  +   const offerSave = first && book !== null && !saveAsDone;
  ```
  `timeout 300 npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 61 passed (62)).

- **M7c** — #20's Esc not paused while the sheet is open — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -   useEscape(back, !adding);
  +   useEscape(back);
  ```
  `timeout 300 npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 61 passed (62)).

- **M7d** — the generation check after the book read dropped — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -     const r = await engine.contacts();
  -     if (gen.current !== g) return;
  +     const r = await engine.contacts();
  +     void g;
  ```
  `timeout 300 npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 61 passed (62)).

- **M7e** — Add without its lock (rule 6) — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  - <LockedButton className="app-text-btn noc-accent" onPress={() => setAdding(true)}>
  -                     {CONFIRM_TEXT.saveAsAdd}
  -                   </LockedButton>
  + <button type="button" className="app-text-btn noc-accent" onClick={() => setAdding(true)}>
  +                     {CONFIRM_TEXT.saveAsAdd}
  +                   </button>
  ```
  `timeout 300 npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 61 passed (62)).

- **M7f** — label precedence: a contact wins over an own account on #20 — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -     own !== undefined ? `Your account: ${own.name}` : intent.recipient === MAINNET_FEE_TREASURY ? 'Noctura treasury' : contact !== undefined ? fromBook(contact.name) : null;
  +     contact !== undefined ? fromBook(contact.name) : own !== undefined ? `Your account: ${own.name}` : intent.recipient === MAINNET_FEE_TREASURY ? 'Noctura treasury' : null;
  ```
  `timeout 300 npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 61 passed (62)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/app/__tests__/Confirm.test.tsx extension/src/app/__tests__/sendFlow.test.tsx extension/src/app/app.css extension/src/app/screens/Confirm.tsx
git commit -F - <<'MSG'
feat(extension): #20's To label and the first-time Save-as row

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 8: #27: [Save] (27a) / [Save sender] (27c) → the sheet (prefilled, or edit when saved); from a receive, only sent to you and dust; the To / From label

**Spec:** §6.3 (#27, ix:12143, 12272, 12350, 12384), review H3, C18; §7 rule 6 (#27's Save); §8.2

**Files:**
- Modify: `extension/src/app/__tests__/TxDetail.test.tsx`
- Modify: `extension/src/app/screens/TxDetail.tsx`

**Interfaces:**
- Consumes: `TxDetail` (`src/app/screens/TxDetail.tsx`), `ContactSheet`, `fromBook`, `engine.contacts`, the history item's `token` / `amount` / `counterparty`.
- Produces (as exported): No new export or prop.

Beside `[Explorer]` in the design's two-button `.actions-row`: **[Save]** on a send (27a) for the recipient, **[Save sender]** on a receive (27c) for the sender — the `#i-bookmark` glyph, `.btn-secondary`, a LockedButton. It opens the contact sheet prefilled with the counter-party, or the **edit** sheet when it is saved (ix:12384). From a receive the sheet gets `received: {token, amount}`: "…— it only sent to you." for a sender never sent to, and the dust banner with "Save anyway" below C18's floor or for an undecodable amount. The label on the sent "To" row and — new — on the received "From" row is own > treasury > contact (the spec's "The To/From label adds the contact label"; giving the received From row the own/treasury labels too is declared, Scope 3.5). Purchase, other and failed rows get no button (27d draws none); nor does a row without a counter-party, nor any row while the book is unread (a refused read hides the button, so a rename cannot happen blind). The book is read behind an `alive` flag.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/app/__tests__/TxDetail.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/TxDetail.test.tsx b/extension/src/app/__tests__/TxDetail.test.tsx
index a57fc11..3818fad 100644
--- a/extension/src/app/__tests__/TxDetail.test.tsx
+++ b/extension/src/app/__tests__/TxDetail.test.tsx
@@ -1,7 +1,7 @@
 // @vitest-environment happy-dom
-import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
+import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
 import {base58} from '@scure/base';
-import {renderInWallet, setupWallet, walletReader} from './harness';
+import {renderInWallet, setupWallet, walletReader, type WalletOptions} from './harness';
 import {ExplorerLink, TxDetail} from '../screens/TxDetail';
 import {explorerUrl} from '../explorer';
 import {useWallet, WalletProvider} from '../WalletContext';
@@ -11,6 +11,10 @@ import {decodeHistoryEntry} from '../../../../core/solana/history';
 import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
 import type {Engine, HistoryItem} from '../engine';
 import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
+import {CONTACTS_KEY} from '../../background/contacts';
+import {lock} from '../../background/autolock';
+import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
+import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
 import {COUNTERPARTY, otherTx, sentSol, sig} from '../../../e2e/historyFixtures';
 
 // Spec §6.3 (#27) and §6.5 (the one external link).
@@ -51,8 +55,9 @@ describe('#27 tx-detail', () => {
     // The fee line as index.html 12136 draws it (Task 17 fix round 1, C8/C9): grouped, with its dollars.
     expect(await screen.findByText('0.000 005 SOL · $0.0007')).toBeTruthy();
     expect(screen.getByRole('button', {name: 'Copy recipient'})).toBeTruthy();
-    // Absent by decision: Block and Memo (G13), Save (B1b-2b), share (D19).
-    for (const gone of ['Block', 'Memo', 'Save', 'Share']) expect(screen.queryByText(gone)).toBeNull();
+    // Absent by decision: Block and Memo (G13), share (D19). Plan 2: [Save] beside [Explorer] (27a).
+    for (const gone of ['Block', 'Memo', 'Share']) expect(screen.queryByText(gone)).toBeNull();
+    expect(await screen.findByRole('button', {name: 'Save'})).toBeTruthy();
     expect((screen.getByRole('link', {name: 'Explorer'}) as HTMLAnchorElement).getAttribute('href')).toBe(`https://solscan.io/tx/${sig(1)}`);
   });
 
@@ -454,3 +459,142 @@ describe('#27 and the model: a successful search reports itself (m.reached)', ()
     await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('reconnecting'));
   });
 });
+
+// B1b-2b plan 2 (§6.3; review H3): #27's [Save] / [Save sender] and the contact label.
+describe('#27 and the address book', () => {
+  const SELECTORS = selectorsOf(UI_SHEETS);
+  const showWith = async (i: HistoryItem, before?: WalletOptions['before']) => {
+    const w = await renderInWallet(<TxDetail signature={i.signature} account={ACCOUNT.publicKey} item={i} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {before});
+    await screen.findByText('Transaction');
+    return w;
+  };
+  const actions = () => [...document.querySelectorAll('.actions-row > *')].map(e => e.textContent);
+  const sendTo = item({counterparty: COUNTERPARTY});
+  const receivedFrom = (over: Partial<HistoryItem> = {}) => item({kind: 'received', token: 'USDC', amount: 250_000_000n, counterparty: COUNTERPARTY, ...over});
+
+  it('27a: [Explorer] then [Save] (the bookmark icon); Save opens the add sheet prefilled with the recipient', async () => {
+    await showWith(sendTo);
+    await screen.findByRole('button', {name: 'Save'});
+    expect(actions()).toEqual(['Explorer', 'Save']);
+    expect(screen.getByRole('button', {name: 'Save'}).className).toBe('btn btn-secondary');
+    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
+    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
+    expect([...dialog.querySelectorAll('.app-contact-addr .addr-groups > span')].map(x => x.textContent)).toEqual(COUNTERPARTY.match(/.{1,4}/g));
+    expect(unstyledClasses(document.querySelector('.s-txd')!, SELECTORS)).toEqual([]);
+  });
+
+  // Rule 6 (spec §7): #27's Save is a LockedButton — the lock is what is pinned (a second open looks the same).
+  it('rule 6: Save locks on the tap', async () => {
+    await showWith(sendTo);
+    const save = (await screen.findByRole('button', {name: 'Save'})) as HTMLButtonElement;
+    fireEvent.click(save);
+    expect(save.disabled).toBe(true);
+    expect(save.className).toBe('btn btn-secondary is-busy');
+  });
+
+  // The alive guard after the book read: a late `locked` must not reload after #27 went.
+  it('a book answer after #27 went does nothing: a late `locked` reloads nothing', async () => {
+    let release: () => void = () => undefined;
+    const held = new Promise<void>(r => {
+      release = r;
+    });
+    let gone = false;
+    const after: string[] = [];
+    let ext: Parameters<typeof lock>[0] | null = null;
+    await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
+      before: async e => {
+        ext = e;
+      },
+      gate: async m => {
+        const type = (m as {type: string}).type;
+        if (gone) after.push(type);
+        if (type === 'contacts.list') await held;
+      },
+    });
+    await screen.findByText('Transaction');
+    await lock(ext!);
+    gone = true;
+    cleanup();
+    release();
+    await act(async () => new Promise(r => setTimeout(r, 30)));
+    expect(after).toEqual([]);
+  });
+
+  it('saved: the To label reads "From your address book: <name>", and Save opens the edit sheet', async () => {
+    const w = await showWith(sendTo);
+    fireEvent.click(await screen.findByRole('button', {name: 'Save'}));
+    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
+    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Supplier'}});
+    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
+    expect(await screen.findByText('From your address book: Supplier')).toBeTruthy();
+    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: COUNTERPARTY, name: 'Supplier'}]);
+    // Its 500 ms lock (rule 6) ends first.
+    const save = screen.getByRole('button', {name: 'Save'}) as HTMLButtonElement;
+    await waitFor(() => expect(save.disabled).toBe(false));
+    fireEvent.click(save);
+    const edit = await screen.findByRole('dialog', {name: 'Edit contact'});
+    expect((edit.querySelector('#contact-name') as HTMLInputElement).value).toBe('Supplier');
+  });
+
+  it('27c: [Save sender]; a sender never sent to → O77, no dust banner for 250 USDC; the From label once saved', async () => {
+    await showWith(receivedFrom());
+    fireEvent.click(await screen.findByRole('button', {name: 'Save sender'}));
+    expect(await screen.findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
+    expect(document.querySelector('.banner.danger')).toBeNull();
+    fireEvent.change(document.getElementById('contact-name')!, {target: {value: 'Client'}});
+    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
+    const from = (await screen.findByText('From your address book: Client')).closest('.detail-row');
+    expect(from?.querySelector('.lbl')?.textContent).toBe('From');
+  });
+
+  it.each([
+    ['0.009999 USDC', {token: 'USDC' as const, amount: 9_999n}],
+    ['0.000999999 SOL', {token: 'SOL' as const, amount: 999_999n}],
+    ['an undecodable amount', {amount: null}],
+  ])('27c dust (%s): the danger banner, O77 and "Save anyway"', async (_, over) => {
+    await showWith(receivedFrom(over));
+    fireEvent.click(await screen.findByRole('button', {name: 'Save sender'}));
+    await screen.findByRole('dialog', {name: 'Add contact'});
+    expect(document.querySelector('.banner.danger')?.textContent).toBe('Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.');
+    expect(await screen.findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
+    expect(screen.getByRole('button', {name: 'Save anyway'})).toBeTruthy();
+  });
+
+  it('27c from a sender this wallet has paid: no warning', async () => {
+    await showWith(receivedFrom({amount: 1n}), ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: COUNTERPARTY, at: 1}]));
+    fireEvent.click(await screen.findByRole('button', {name: 'Save sender'}));
+    await screen.findByRole('dialog', {name: 'Add contact'});
+    await waitFor(() => expect(screen.queryByText(/You have never sent/)).toBeNull());
+    expect(document.querySelector('.banner.danger')).toBeNull();
+  });
+
+  it('no button on a purchase, an other, a failed transaction, or a row with no counter-party', async () => {
+    for (const i of [item({kind: 'purchase', counterparty: null}), item({kind: 'other', counterparty: COUNTERPARTY}), item({failed: true, counterparty: COUNTERPARTY}), item({counterparty: null})]) {
+      cleanup();
+      await showWith(i);
+      await act(async () => new Promise(r => setTimeout(r, 20)));
+      expect(screen.queryByRole('button', {name: /^Save/})).toBeNull();
+    }
+  });
+
+  it('the book unread (refused): no Save button, no contact label', async () => {
+    const w = await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
+      before: ext => ext.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Supplier'}]),
+      gate: m => {
+        if ((m as {type: string}).type === 'contacts.list') throw new Error('worker restarting');
+      },
+    });
+    await waitFor(() => expect(document.body.textContent).toContain(ACCOUNT.publicKey));
+    await act(async () => new Promise(r => setTimeout(r, 20)));
+    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
+    expect(screen.queryByText(/From your address book/)).toBeNull();
+    expect(w).toBeTruthy();
+  });
+
+  it('own > contact: an own account saved as a contact keeps "Your account: Savings"', async () => {
+    await showWith(item({}), ext => ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Not my savings'}]));
+    await screen.findByRole('button', {name: 'Save'});
+    expect(screen.getByText('Your account: Savings')).toBeTruthy();
+    expect(screen.queryByText(/From your address book/)).toBeNull();
+  });
+});
````

- [ ] **Step 2: Run them against the tree the previous task left — they must fail.**

```bash
cd extension
npx vitest run src/app/__tests__/TxDetail.test.tsx
```
Expected (dry run, these test files on Task 7's tree): **red** — Test Files  1 failed (1) · Tests  10 failed | 29 passed (39). (A file that imports a module this task creates fails to load: that counts as red.)

- [ ] **Step 3: Implement.**

Modify `extension/src/app/screens/TxDetail.tsx`:

````diff
diff --git a/extension/src/app/screens/TxDetail.tsx b/extension/src/app/screens/TxDetail.tsx
index 9f1dc05..ba77459 100644
--- a/extension/src/app/screens/TxDetail.tsx
+++ b/extension/src/app/screens/TxDetail.tsx
@@ -1,4 +1,4 @@
-import {useEffect, useState, type ReactNode} from 'react';
+import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
 import {useWallet} from '../WalletContext';
 import {TOKEN_INFO, ago, feeUsd, fullDate, showAmount, showFee, showUsd} from '../format';
 import {explorerUrl} from '../explorer';
@@ -10,7 +10,9 @@ import {useCopy} from '../ui/useCopy';
 import {useNow} from '../useNow';
 import {Banner, RefusedBanner} from '../ui/Banner';
 import {LockedButton} from '../ui/LockedButton';
-import type {HistoryItem, Intent} from '../engine';
+import {ContactSheet, type ContactSheetMode} from '../ui/ContactSheet';
+import {fromBook} from '../addressBook';
+import type {Contact, HistoryItem, Intent} from '../engine';
 import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
 
 /** At most this many history pages are read to find a signature the list has not loaded. */
@@ -67,10 +69,16 @@ export function ExplorerLink({signature, label = 'Explorer', icon = true, classN
 
 /**
  * #27 tx-detail (spec §6.3), from the #26 row (or, when only the signature is known, the first
- * FIND_PAGES history pages). No Block or Memo rows (not in HistoryView, G13), no Save (address book,
- * B1b-2b), no share (D19); fiat is today's price and says "now". A failed send offers [Try again] → #19
- * with what it tried to send, when the decoder knows the recipient and the amount (plan 3, owner question 1,
- * option A): #19 prepares it afresh and #20 shows the whole address before one tap sends.
+ * FIND_PAGES history pages). No Block or Memo rows (not in HistoryView, G13), no share (D19); fiat is
+ * today's price and says "now". A failed send offers [Try again] → #19 with what it tried to send, when
+ * the decoder knows the recipient and the amount (plan 3, owner question 1, option A): #19 prepares it
+ * afresh and #20 shows the whole address before one tap sends.
+ *
+ * B1b-2b plan 2 (§6.3): beside [Explorer], [Save] on a send (27a, ix:12143) and [Save sender] on a receive (27c,
+ * ix:12272) open the contact sheet for the counter-party — prefilled, or the edit sheet when it is saved (ix:12384).
+ * From a receive the sheet warns: "…— it only sent to you." for a sender never sent to, and the dust banner with
+ * "Save anyway" below C18's floor (review H3). The To / From label is own > treasury > contact. Purchase, other and
+ * failed rows get no button; nor does any row while the book is unread (a refused read hides it).
  */
 export function TxDetail({
   signature,
@@ -104,6 +112,26 @@ export function TxDetail({
    * banner instead, with the explorer link kept (the signature is already known).
    */
   const [searchError, setSearchError] = useState<string | null>(null);
+  /** Plan 2: the address book (labels, and whether the counter-party is saved); null until read, or refused. */
+  const [book, setBook] = useState<Contact[] | null>(null);
+  const [sheet, setSheet] = useState<ContactSheetMode | null>(null);
+  const alive = useRef(true);
+  useEffect(() => {
+    alive.current = true;
+    return () => {
+      alive.current = false;
+    };
+  }, []);
+  const {engine, reload} = m;
+  const readBook = useCallback(async () => {
+    const r = await engine.contacts();
+    if (!alive.current) return;
+    if (r.ok) setBook(r.data.contacts);
+    else if (r.error === 'locked') void reload();
+  }, [engine, reload]);
+  useEffect(() => {
+    void readBook();
+  }, [readBook]);
 
   /**
    * The by-signature search. Unreachable in plan 1 (final review M4): App opens #27 only from an
@@ -192,11 +220,15 @@ export function TxDetail({
   const accounts = m.wallet?.accounts ?? [];
   /** The owner's own entry (its name on the From row), when it is one of this wallet's accounts. */
   const ownerAccount = accounts.find(a => a.publicKey === owner);
+  const savedAs = (address: string | null): Contact | undefined => (address === null ? undefined : book?.find(c => c.address === address));
+  /** own > treasury > contact (E17): a contact's name never stands in for "Your account" or the treasury. */
   const labelOf = (address: string | null): string | null => {
     if (address === null) return null;
     const own = accounts.find(a => a.publicKey === address);
     if (own !== undefined) return `Your account: ${own.name}`;
-    return address === MAINNET_FEE_TREASURY ? 'Noctura treasury' : null;
+    if (address === MAINNET_FEE_TREASURY) return 'Noctura treasury';
+    const contact = savedAs(address);
+    return contact === undefined ? null : fromBook(contact.name);
   };
   const price = item.token === null ? null : item.token === 'NOC' ? null : m.prices?.[item.token === 'SOL' ? 'sol' : item.token === 'USDC' ? 'usdc' : 'usdt'] ?? null;
   const fiat = item.amount === null || item.token === null || price === null ? null : (Number(item.amount) / 10 ** TOKEN_INFO[item.token].decimals) * price;
@@ -287,56 +319,86 @@ export function TxDetail({
   const sent = item.kind === 'sent';
   const token = item.token ?? 'SOL';
   const toLabel = labelOf(item.counterparty);
+  const counterparty = item.counterparty;
+  const saved = savedAs(counterparty);
+  const open = () => {
+    if (counterparty === null) return;
+    setSheet(saved === undefined ? {kind: 'add', address: counterparty} : {kind: 'edit', address: counterparty, name: saved.name});
+  };
   return (
-    <div className="screen s-txd">
-      {top}
-      <div className="scroll">
-        <div className="amount-card">
-          <div className="eyebrow noc-overline">{sent ? 'SENT' : 'RECEIVED'}</div>
-          <div className={`amt noc-balance-lg noc-numeral${sent ? '' : ' app-amt-in'}`}>
-            {sent ? MINUS : '+'}
-            {item.amount === null ? '—' : showAmount(token, item.amount)} {token}
+    <>
+      <div className="screen s-txd">
+        {top}
+        <div className="scroll">
+          <div className="amount-card">
+            <div className="eyebrow noc-overline">{sent ? 'SENT' : 'RECEIVED'}</div>
+            <div className={`amt noc-balance-lg noc-numeral${sent ? '' : ' app-amt-in'}`}>
+              {sent ? MINUS : '+'}
+              {item.amount === null ? '—' : showAmount(token, item.amount)} {token}
+            </div>
+            {fiat === null ? null : <div className="fiat noc-body noc-numeral">≈ {showUsd(fiat)} now</div>}
+            {/* 27c carries the age ("Confirmed · 8h ago"); 27a does not. */}
+            <StatusPill text={!sent && item.blockTime !== null ? `Confirmed · ${ago(item.blockTime * 1000, now)}` : 'Confirmed'} />
+          </div>
+          <div className="detail-card">
+            <Row label="Type">
+              <span className="noc-body">{token === 'SOL' ? 'Transfer' : `${token} transfer`}</span>
+            </Row>
+            {sent ? (
+              <>
+                <Row label="From">
+                  <span className="noc-body-sm">{ownerAccount?.name}</span>
+                  <Address address={owner} label="Copy sender" />
+                </Row>
+                <Row label="To">
+                  {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
+                  {item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy recipient" />}
+                </Row>
+              </>
+            ) : (
+              <>
+                <Row label="From">
+                  {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
+                  {item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy sender" />}
+                </Row>
+                <Row label="To">
+                  <span className="noc-body-sm noc-accent">Your wallet</span>
+                  <Address address={owner} label="Copy recipient" />
+                </Row>
+              </>
+            )}
+            <Row label="Hash">{hash}</Row>
+            <Row label="Network fee">
+              <span className="noc-body noc-numeral">{sent ? `${fee} · ${feeFiat}` : 'Paid by sender'}</span>
+            </Row>
+            <Row label="Date">
+              <span className="noc-body">{date}</span>
+            </Row>
+          </div>
+          <div className="actions-row">
+            <ExplorerLink signature={item.signature} />
+            {book === null || counterparty === null ? null : (
+              <LockedButton className="btn btn-secondary" onPress={open}>
+                <ExtIcon name="bookmark" size={16} />
+                {sent ? 'Save' : 'Save sender'}
+              </LockedButton>
+            )}
           </div>
-          {fiat === null ? null : <div className="fiat noc-body noc-numeral">≈ {showUsd(fiat)} now</div>}
-          {/* 27c carries the age ("Confirmed · 8h ago"); 27a does not. */}
-          <StatusPill text={!sent && item.blockTime !== null ? `Confirmed · ${ago(item.blockTime * 1000, now)}` : 'Confirmed'} />
-        </div>
-        <div className="detail-card">
-          <Row label="Type">
-            <span className="noc-body">{token === 'SOL' ? 'Transfer' : `${token} transfer`}</span>
-          </Row>
-          {sent ? (
-            <>
-              <Row label="From">
-                <span className="noc-body-sm">{ownerAccount?.name}</span>
-                <Address address={owner} label="Copy sender" />
-              </Row>
-              <Row label="To">
-                {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
-                {item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy recipient" />}
-              </Row>
-            </>
-          ) : (
-            <>
-              <Row label="From">{item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy sender" />}</Row>
-              <Row label="To">
-                <span className="noc-body-sm noc-accent">Your wallet</span>
-                <Address address={owner} label="Copy recipient" />
-              </Row>
-            </>
-          )}
-          <Row label="Hash">{hash}</Row>
-          <Row label="Network fee">
-            <span className="noc-body noc-numeral">{sent ? `${fee} · ${feeFiat}` : 'Paid by sender'}</span>
-          </Row>
-          <Row label="Date">
-            <span className="noc-body">{date}</span>
-          </Row>
-        </div>
-        <div className="actions-row">
-          <ExplorerLink signature={item.signature} />
         </div>
       </div>
-    </div>
+      {/* Beside `.s-txd`, not inside (as #43 beside #12). */}
+      {sheet === null ? null : (
+        <ContactSheet
+          mode={sheet}
+          received={sent ? undefined : {token: item.token, amount: item.amount}}
+          onClose={() => setSheet(null)}
+          onSaved={() => {
+            setSheet(null);
+            void readBook();
+          }}
+          onDeleted={() => void readBook()}
+        />
+      )}
+    </>
   );
 }
````

- [ ] **Step 4: Run them green, then the whole suite and the gates.**

```bash
cd extension
npx vitest run src/app/__tests__/TxDetail.test.tsx
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
```
Expected (dry run): own tests Test Files  1 passed (1) · Tests  39 passed (39); tsc clean; whole suite Test Files  138 passed (138) · Tests  2730 passed (2730); gates green.

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red.

- **M8a** — #27c opens the sheet without what the sender sent (no O77, no dust) — `extension/src/app/screens/TxDetail.tsx`:

  ```diff
  - received={sent ? undefined : {token: item.token, amount: item.amount}}
  + received={undefined}
  ```
  `timeout 300 npx vitest run src/app/__tests__/TxDetail.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  4 failed | 35 passed (39)).

- **M8b** — Save offered while the book is unread — `extension/src/app/screens/TxDetail.tsx`:

  ```diff
  - {book === null || counterparty === null ? null : (
  + {counterparty === null ? null : (
  ```
  `timeout 300 npx vitest run src/app/__tests__/TxDetail.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 38 passed (39)).

- **M8c** — the alive check after the book read dropped — `extension/src/app/screens/TxDetail.tsx`:

  ```diff
  -     const r = await engine.contacts();
  -     if (!alive.current) return;
  +     const r = await engine.contacts();
  ```
  `timeout 300 npx vitest run src/app/__tests__/TxDetail.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 38 passed (39)).

- **M8d** — Save without its lock (rule 6) — `extension/src/app/screens/TxDetail.tsx`:

  ```diff
  -               <LockedButton className="btn btn-secondary" onPress={open}>
  -                 <ExtIcon name="bookmark" size={16} />
  -                 {sent ? 'Save' : 'Save sender'}
  -               </LockedButton>
  +               <button type="button" className="btn btn-secondary" onClick={open}>
  +                 <ExtIcon name="bookmark" size={16} />
  +                 {sent ? 'Save' : 'Save sender'}
  +               </button>
  ```
  `timeout 300 npx vitest run src/app/__tests__/TxDetail.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 38 passed (39)).

- **M8e** — the received From row loses its label — `extension/src/app/screens/TxDetail.tsx`:

  ```diff
  -                 <Row label="From">
  -                   {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
  +                 <Row label="From">
  ```
  `timeout 300 npx vitest run src/app/__tests__/TxDetail.test.tsx` — Expected: **red** (dry run: red, Test Files  1 failed (1) · Tests  1 failed | 38 passed (39)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/app/__tests__/TxDetail.test.tsx extension/src/app/screens/TxDetail.tsx
git commit -F - <<'MSG'
feat(extension): #27's Save / Save sender and the contact label

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 9: E2E spec 19 (a contact is a label, not trust) with its negative control; spec 15 asserts the delete wipes `v1_contacts`

**Spec:** §8.3 spec 19 (and its rev 2 negative control), spec 15 (plan 2: `v1_contacts`); the pinned harness rules (containment, `unshare -rn`)

**Files:**
- Create: `extension/e2e/contacts.spec.ts`
- Modify: `extension/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `launchPopup`, `contained` (`e2e/popupHarness.ts`), `realWallet`, `ACCOUNT`, `RECIPIENT` (`e2e/sendHelpers.ts`), `receivedUsdc`, `sig`, `COUNTERPARTY` (`e2e/historyFixtures.ts`), `E2E_ACCOUNTS` (`e2e/makeEnvelope.ts`). Nothing from `core/`.
- Produces (as exported): `e2e/contacts.spec.ts` (new); `e2e/settings.spec.ts`'s `WIPED` gains `'v1_contacts'`.

**19 · the positive run.** A real wallet (the makeEnvelope envelope, unlocked through the vault page, so #10 can prove the password) with a received 250 USDC in the fake's history → #26 → #27c → [Save sender] → the sheet: the full address, O77, no dust banner → "Client" → Save → the From label. #12 with that address: "From your address book: Client" **and** "Never sent here before" and the first-time banner (D19) → #19 → #20: the first-time banner, the To label, no "Save as" (it is saved) → [Send] → the #10 tab lists "Re-auth required for the first send to a new address." and shows no contact name (C12). Nothing is broadcast.

**19 · the negative control (rev 2, review H3).** The poisoning picture: RECIPIENT is known (this wallet has paid it), and a **dust** transfer (0.005 USDC, under C18's 0.01) arrives from a look-alike — the same length, the same first four and last four characters, a different middle (the number plus 58^20, computed in the spec, guarded against overflowing 32 bytes — review L7 — and asserted) → [Save sender] → the dust banner (O78), O77 and "Save anyway" → saved as "Binance" → #31 › Address book › `+` → another address named "binance" → O85 → #12 → the contact icon → the pick row for "Binance" shows the whole address in groups of four and O72 → picked → #12 holds it with "Never sent here before", the label and state 6's groups. Both runs end with `contained(h)`.

Spec 15's delete now also proves `v1_contacts` is removed — saved first through `contacts.set` from a wallet tab (the popup closed itself when it opened the delete tab), so the removal is not vacuous (plan 1 Task 19's I1 lesson).

- [ ] **Step 1: Write the specs.**

Create `extension/e2e/contacts.spec.ts`:

````ts
import {test, expect, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import {contained, launchPopup, type Harness} from './popupHarness';
import {ACCOUNT, RECIPIENT, realWallet} from './sendHelpers';
import {COUNTERPARTY, receivedUsdc, sig} from './historyFixtures';
import {E2E_ACCOUNTS} from './makeEnvelope';

// Spec B1b-2b §8.3, plan 2: spec 19 — a contact is a label, never trust (D19), against the real extension and the
// contained fake coordinator. Both runs read history and balances from the fake, so each ends with contained(h).
// The negative control (rev 2, review H3) is the address-poisoning picture: a dust transfer from a look-alike of an
// address this wallet has paid, saved as "Binance" — the sheet warns, a second "binance" is refused, and the pick row
// shows the whole address and "You have never sent to this address."; #12 still says "Never sent here before".

/**
 * A look-alike of `address`: the same length, the same first four and last four characters, a different middle — the
 * number plus 58^20 changes base58 digits in the middle only. Poisoning works on exactly this truncation.
 */
function lookalike(address: string): string {
  const bytes = base58.decode(address);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  n += 58n ** 20n;
  // Still 32 bytes (review L7): the encoding below would silently drop an overflow.
  if (n >= 2n ** 256n) throw new Error('look-alike overflows 32 bytes');
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return base58.encode(out);
}
const groupsOf = (a: string) => a.match(/.{1,4}/g) ?? [];

/** The popup on #11, its first balance read answered (under `unshare -rn` it starts offline). */
async function popup(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
/** #26 → the received row → #27c → [Save sender] → the sheet. */
async function saveSender(p: Page): Promise<void> {
  await p.getByRole('button', {name: 'Activity'}).click();
  await p.getByText('Received USDC').click();
  await expect(p.getByText('RECEIVED', {exact: true})).toBeVisible();
  await p.getByRole('button', {name: 'Save sender'}).click();
  await expect(p.getByRole('dialog', {name: 'Add contact'})).toBeVisible();
}

test('19 · a contact is a label, not trust: saved from #27c, #12 says "From your address book" AND "Never sent here before"; #20’s first-time banner; #10 asks the first-send re-auth', async () => {
  test.setTimeout(180_000);
  const h = await launchPopup('noctura-e2e-contacts-');
  try {
    await realWallet(h);
    h.fake.accountKinds.set(COUNTERPARTY, 'wallet');
    h.fake.history.set(ACCOUNT, [{signature: sig(41), tx: receivedUsdc(ACCOUNT, COUNTERPARTY, 250_000_000, Math.floor(Date.now() / 1000) - 120)}]);
    const p = await popup(h);
    await saveSender(p);
    const sheet = p.getByRole('dialog', {name: 'Add contact'});
    expect(await sheet.locator('.app-contact-addr .addr-groups > span').allTextContents()).toEqual(groupsOf(COUNTERPARTY));
    await expect(sheet.getByText('You have never sent to this address — it only sent to you.')).toBeVisible();
    await expect(sheet.locator('.banner.danger')).toHaveCount(0);
    await sheet.getByLabel('Name').fill('Client');
    await sheet.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(p.getByRole('dialog')).toHaveCount(0);
    await expect(p.getByText('From your address book: Client')).toBeVisible();

    // #12 with that address: the label above 2a's helper, which still says never sent (D19), and design state 6.
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByRole('button', {name: 'Home'}).click();
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByLabel('Recipient', {exact: true}).fill(COUNTERPARTY);
    await expect(p.locator('.recipient-row .app-contact-label')).toHaveText('From your address book: Client');
    await expect(p.locator('.recipient-row .helper.warn')).toHaveText('Never sent here before');
    await expect(p.locator('.banner.warning .banner-title')).toHaveText('First-time recipient');
    await p.getByLabel('Amount').fill('0.01');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Continue to confirm'}).click();
    // #20: the first-time banner stays; the To row carries the label; no "Save as" for a saved address.
    await expect(p.getByText("You've never sent to this address")).toBeVisible();
    await expect(p.locator('.detail-row', {hasText: 'From your address book: Client'})).toBeVisible();
    await expect(p.getByText('Save as')).toHaveCount(0);
    const opened = h.ctx.waitForEvent('page');
    await p.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    const tab = await opened;
    await tab.waitForURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    await expect(tab.locator('#ra-about')).toHaveText('You are about to send', {timeout: 30_000});
    await expect(tab.locator('#ra-reasons p').first()).toHaveText('Re-auth required for the first send to a new address.');
    // #10 renders closed-alphabet fields only: never a contact name (C12).
    await expect(tab.getByText('Client')).toHaveCount(0);
    expect(h.fake.broadcasts).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('19 · negative control: a dust transfer from a look-alike of a paid address — dust banner, "only sent to you", Save anyway; a second "binance" refused; the pick row shows the whole address and O72; #12 still "Never sent here before"', async () => {
  test.setTimeout(180_000);
  const h = await launchPopup('noctura-e2e-contacts-dust-');
  try {
    // RECIPIENT is known: this wallet has sent to it. The poisoner's address truncates identically.
    await realWallet(h, {known: true});
    const fake = lookalike(RECIPIENT);
    expect(fake).not.toBe(RECIPIENT);
    expect([fake.length, fake.slice(0, 4), fake.slice(-4)]).toEqual([RECIPIENT.length, RECIPIENT.slice(0, 4), RECIPIENT.slice(-4)]);
    // 0.005 USDC: below C18's 0.01 floor (5 000 < 10 000 base units).
    h.fake.history.set(ACCOUNT, [{signature: sig(42), tx: receivedUsdc(ACCOUNT, fake, 5_000, Math.floor(Date.now() / 1000) - 60)}]);
    const p = await popup(h);
    await saveSender(p);
    const sheet = p.getByRole('dialog', {name: 'Add contact'});
    expect(await sheet.locator('.app-contact-addr .addr-groups > span').allTextContents()).toEqual(groupsOf(fake));
    await expect(sheet.locator('.banner.danger')).toHaveText('Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.');
    await expect(sheet.getByText('You have never sent to this address — it only sent to you.')).toBeVisible();
    await sheet.getByLabel('Name').fill('Binance');
    await sheet.getByRole('button', {name: 'Save anyway'}).click();
    await expect(p.getByRole('dialog')).toHaveCount(0);

    // C19: another address may not be called "binance".
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByRole('button', {name: 'Settings'}).click();
    await p.locator('.s7-title', {hasText: 'Address book'}).click();
    await expect(p.getByText('Binance', {exact: true})).toBeVisible();
    await p.getByRole('button', {name: 'Add contact'}).click();
    const add = p.getByRole('dialog', {name: 'Add contact'});
    await add.getByLabel('Address').fill(E2E_ACCOUNTS[2]);
    await add.getByLabel('Name').fill('binance');
    await add.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(add.getByText('Another contact already has this name.')).toBeVisible();
    await add.getByRole('button', {name: 'Cancel'}).click();

    // #12 → the book (pick): the whole address in groups of four and O72 — then picked, #12 runs as for a paste.
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByRole('button', {name: 'Home'}).click();
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByRole('button', {name: 'Address book'}).click();
    const row = p.locator('.s-abook .row', {hasText: 'Binance'});
    await expect(row.locator('.addr .addr-groups > span')).toHaveText(groupsOf(fake));
    await expect(row.locator('.when')).toHaveText('You have never sent to this address.');
    await row.click();
    await expect(p.getByLabel('Recipient', {exact: true})).toHaveValue(fake);
    await expect(p.locator('.recipient-row .helper.warn')).toHaveText('Never sent here before');
    await expect(p.locator('.recipient-row .app-contact-label')).toHaveText('From your address book: Binance');
    await expect(p.locator('.banner.warning .banner-title')).toHaveText('First-time recipient');
    expect(await p.locator('.app-send-addr .addr-groups > span').allTextContents()).toEqual(groupsOf(fake));
    contained(h);
  } finally {
    await h.close();
  }
});
````

Modify `extension/e2e/settings.spec.ts`:

````diff
diff --git a/extension/e2e/settings.spec.ts b/extension/e2e/settings.spec.ts
index e8e8355..22d4adc 100644
--- a/extension/e2e/settings.spec.ts
+++ b/extension/e2e/settings.spec.ts
@@ -20,8 +20,8 @@ const OTHER = 'legal winner thank year wave sausage worth useful legal winner th
 /** OTHER's SLIP-0010 account 0 (derived once with src/vault/accounts.ts). */
 const OTHER_ACCOUNT = 'BLeUXTx9thHGT7VJUtF9vHEmfMDgW1nnKZ9UVer2CoLX';
 const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
-/** What spec 15's delete wipes (spec §8.3; plan 2 adds v1_contacts). */
-const WIPED = ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_balance_cache', 'v1_price_cache'] as const;
+/** What spec 15's delete wipes (spec §8.3), with plan 2's address book (E17, D20). */
+const WIPED = ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_contacts', 'v1_balance_cache', 'v1_price_cache'] as const;
 
 const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
 const envOf = async (sw: Worker) => (await local(sw, 'v1_vault')) as Env | undefined;
@@ -413,6 +413,12 @@ test('15 · delete a funded wallet: #37 says so and names the lowest index (not
     // Fix round 1 (review I1): every key the wipe must remove exists first, so each toBeUndefined() below proves a
     // removal. The known recipients are written as the background writes them after a confirmed send ({address, at}).
     await h.sw.evaluate(r => chrome.storage.local.set({v1_known_recipients: [{address: r, at: Date.now()}]}), RECIPIENT);
+    // Plan 2: a contact, saved the way the UI saves one (contacts.set from the wallet tab; the wallet is unlocked — the
+    // popup closed itself when it opened the delete tab).
+    const ui = await h.ctx.newPage();
+    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
+    expect(await msg(ui, {type: 'contacts.set', address: RECIPIENT, name: 'Marko'})).toEqual({ok: true, data: {created: true}});
+    await ui.close();
     for (const key of WIPED) await expect.poll(() => local(h.sw, key), {message: key, timeout: 30_000}).toBeDefined();
     const before = JSON.stringify(await envOf(h.sw));
     await tab.locator('#dl-password').fill('not the password at all');
````

The behaviour these specs drive was built in Tasks 1–8, so on Task 8's tree they pass; what makes them failable is shown by the named mutations below (each turns its spec red on a real build).


- [ ] **Step 2: Run the whole suite and the gates.**

```bash
cd extension
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
npx playwright test e2e/contacts.spec.ts e2e/settings.spec.ts
```
Expected (dry run): tsc clean; whole suite Test Files  138 passed (138) · Tests  2730 passed (2730); gates green; Playwright 2 passed (spec 19 ×2) and, with `-g '(^|\s)15 · '`, spec 15's four runs 4 passed — normal launch and under `unshare -rn`.

- [ ] **Step 3: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. An E2E mutation is built (`node scripts/build.mjs`) before Playwright runs; a failed build is INVALID — Playwright would otherwise run the stale `dist` green.

- **M9a** — the negative control: a saved contact made "known" (the first-send re-auth disarmed) — `extension/src/background/knownRecipients.ts`:

  ```diff
  -   const sent = new Set(list.map(e => e.address));
  +   const sent = new Set([...list.map(e => e.address), ...(((await ext.local.get('v1_contacts')) as {address: string}[] | undefined) ?? []).map(c => c.address)]);
  ```
  `node scripts/build.mjs && timeout 300 npx playwright test e2e/contacts.spec.ts -g '(^|\s)19 · '` — Expected: **red** (dry run: red, Error: expect(locator).toHaveText(expected) failed · Error: expect(locator).toHaveText(expected) failed · 2 failed).

- **M9b** — the duplicate-name refusal dropped — `extension/src/background/contacts.ts`:

  ```diff
  -       if (list.some(c => c.address !== address && nameKey(c.name) === key)) return 'duplicate-name';
  +       void key;
  ```
  `node scripts/build.mjs && timeout 300 npx playwright test e2e/contacts.spec.ts -g '(^|\s)19 · negative'` — Expected: **red** (dry run: red, Error: expect(locator).toBeVisible() failed · 1 failed).

- **M9c** — the delete leaves v1_contacts — `extension/src/background/accountsStore.ts`:

  ```diff
  - const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY];
  + const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY].filter(k => k !== CONTACTS_KEY);
  ```
  `node scripts/build.mjs && timeout 300 npx playwright test e2e/settings.spec.ts -g '(^|\s)15 · delete a funded'` — Expected: **red** (dry run: red, 1 failed).

- [ ] **Step 4: Commit.**

```bash
git add extension/e2e/contacts.spec.ts extension/e2e/settings.spec.ts
git commit -F - <<'MSG'
test(extension): E2E spec 19 — a contact is a label, not trust (with the dust look-alike control); spec 15 wipes v1_contacts

Co-Authored-By: <the executing model's own line>
MSG
```


### Task 10: The visual pass (§8.4): every plan-2 state in the popup at 412 × 600

**Spec:** §8.4 (`e2e/visual-contacts.spec.ts`), the DS class maps (#15 ix:7507-7516), §6 Differs

**Files:**
- Create: `extension/e2e/visual-contacts.spec.ts`

**Interfaces:**
- Consumes: `shot` (`e2e/visualTab.ts`), `launchPopup`, `seedUnlockedWallet`, `contained`, `realWallet`, the history fixtures.
- Produces (as exported): `e2e/visual-contacts.spec.ts` (new): 27 shots under `test-results/visual/` (a CI artifact).

Two specs shoot every state the real extension can be put in, each asserting its own copy first: a screen state must be in the viewport and clear of the pinned bars (`pop`, plan 1's helper, which now scrolls a below-the-fold element in first), a sheet state inside the sheet's panel (`sheetShot`). **#15 and the sheet:** 15-empty; sheet-add-empty, sheet-bad-address (O86), sheet-bad-name (2a's line for "Mo\u200Bm"), sheet-add-typed-never-sent; 15-populated (the design's seven rows, their dates from local activity), 15-search-active, 15-search-no-result (O71); sheet-edit, sheet-duplicate-name (O85), sheet-delete-confirm; 31-connections-address-book ("7 contacts"); 37a-bullet-address-book; 15-full (O73). **The hooks:** 12-idle-contact-icon, 15-pick, 12-picked-contact; 20-first-time-save-as, sheet-add-prefilled-never-sent, 20-saved-label; 27a-save, 27c-save-sender, sheet-only-sent-to-you, 27c-from-label, sheet-dust and sheet-dust-save-anyway (the address and "Save anyway" wholly in view on open, the banner at 95 % — the dry run's tall-sheet finding; review L3: the fonts are the bundled Geist faces the fonts gate pins, and the 95 % keeps one wrapped banner line under a fallback font from failing a product that is right), sheet-full (O87, from #27c with 200 saved).

**Not shot** (fault injection only; the component tests assert them): #15 `load failed` (O74) and the sheet's `failed` line. **Reviewed against #43** (the design leaves the sheet undrawn, D20). The opus-tier review of the 27 shots against `index.html` (§8.4's checklist: tokens, type tiers, order, every string, Differs, ≥ 48 px, dark theme) is the execution's (Before the PR).

- [ ] **Step 1: Write the spec.**

Create `extension/e2e/visual-contacts.spec.ts`:

````ts
import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
import {ACCOUNT, RECIPIENT, realWallet} from './sendHelpers';
import {COUNTERPARTY, receivedUsdc, sentSol, sig} from './historyFixtures';
import {shot} from './visualTab';

// Spec B1b-2b §8.4, plan 2: every state of §6 the real extension can be put in, in the popup at 412 × 600, saved for
// the opus-tier review against index.html (#15 ix:7372-7552, its DS class map ix:7507-7516; #12 ix:6640-6700; #20
// ix:9343-9350; #27 ix:12143, 12272, 12350; #31 ix:13552; #37 ix:14981) with §8.4's checklist. Not a pixel diff. Every
// state asserts its own copy first; a screen state must be in the viewport and clear of the pinned bars (`pop`), a
// sheet state inside the sheet's panel (`sheetShot`). The contact sheet is undrawn (D20): its shots are reviewed
// against #43's sheet. Not shot (fault injection only, covered by the component tests): #15 `load failed` (O74), the
// sheet's `failed` line.
declare const chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}; storage: {local: {set(o: object): Promise<void>}}};
const DAY = 86_400_000;
/** The n-th distinct, canonical address (32 bytes, the first byte n + 1). */
const addr = (n: number): string => base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? n + 1 : 9)));
const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);

/** A popup shot clear of the pinned bars (B1b-2a plan 3's `seen()`, after visual-settings.spec.ts's `pop`). */
async function pop(page: Page, name: string, visible: Locator): Promise<void> {
  const bars = page.locator('main.app-content > .screen > .top-bar, main.app-content > .screen > .sticky-bar, nav.app-tab-bar');
  const under = async (): Promise<string | null> => {
    const box = await visible.boundingBox();
    if (box === null) return 'no box';
    const el = await visible.elementHandle();
    for (const bar of await bars.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  // Below the fold (#31's Connections, #27's actions row) it is scrolled to first, as a person would; under a bar, to the middle.
  await visible.scrollIntoViewIfNeeded();
  if ((await under()) !== null) await visible.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(visible).toBeInViewport();
  expect(await under(), `${name}: the state's element clear of the pinned bars`).toBeNull();
  await shot(page, name, {fullPage: false});
}
/** A sheet shot: the state's element inside the sheet's panel and in the viewport (the panel scrolls its own body). */
async function sheetShot(page: Page, name: string, visible: Locator): Promise<void> {
  await visible.scrollIntoViewIfNeeded();
  await expect(visible).toBeInViewport();
  const panel = await page.locator('.s8-sheet').boundingBox();
  const box = await visible.boundingBox();
  expect(panel, `${name}: a sheet`).not.toBeNull();
  expect(box, `${name}: the element`).not.toBeNull();
  if (panel !== null && box !== null) {
    expect(box.y, `${name}: inside the panel`).toBeGreaterThanOrEqual(panel.y);
    expect(box.y + box.height, `${name}: inside the panel`).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
  }
  await shot(page, name, {fullPage: false});
}
async function popup(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
/** contacts.set as the UI sends it (a wallet tab; the wallet is unlocked). */
async function saveContacts(h: Harness, list: {address: string; name: string}[]): Promise<void> {
  const ui = await h.ctx.newPage();
  await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
  // Oldest first: the book keeps the newest first.
  for (const c of [...list].reverse()) {
    const r = (await ui.evaluate(m => chrome.runtime.sendMessage(m), {type: 'contacts.set', ...c})) as {ok: boolean};
    expect(r.ok, c.name).toBe(true);
  }
  await ui.close();
}
const toBook = async (p: Page) => {
  await p.getByRole('button', {name: 'Settings'}).click();
  await p.locator('.s7-title', {hasText: 'Address book'}).click();
  await expect(p.locator('.s-abook .top-bar .title')).toHaveText('Address book');
};

test('visual: #31’s Address book row, #15’s states and the contact sheet (412 × 600)', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-vis-contacts-');
  try {
    await seedUnlockedWallet(h.sw);
    let p = await popup(h);
    await toBook(p);
    // 15 · empty (ix:7437-7461).
    await expect(p.getByText('No saved contacts yet')).toBeVisible();
    await expect(p.getByText("Or save one from a transaction's details.")).toBeVisible();
    await expect(p.getByRole('textbox', {name: 'Search contacts'})).toBeDisabled();
    await pop(p, '15-empty', p.locator('.s-abook .empty'));
    // The sheet · add · empty, then a typed address that is not one (O86), then a valid one (groups + O72).
    await p.getByRole('button', {name: 'Add first contact'}).click();
    const sheet = p.getByRole('dialog', {name: 'Add contact'});
    await expect(sheet.getByPlaceholder('Solana address')).toBeFocused();
    await sheetShot(p, 'sheet-add-empty', sheet.getByRole('button', {name: 'Save', exact: true}));
    await sheet.getByLabel('Address').fill('7xKX0OIl');
    await expect(sheet.getByText('That is not a Solana address.')).toBeVisible();
    await sheetShot(p, 'sheet-bad-address', sheet.getByText('That is not a Solana address.'));
    await sheet.getByLabel('Address').fill(addr(1));
    await expect(sheet.getByText('You have never sent to this address.')).toBeVisible();
    await expect(sheet.locator('.app-contact-addr .addr-groups > span')).toHaveText(addr(1).match(/.{1,4}/g) ?? []);
    await sheet.getByLabel('Name').fill('Mo\u200Bm');
    await sheet.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(sheet.getByText('Names are 1 to 32 characters, without control characters.')).toBeVisible();
    await sheetShot(p, 'sheet-bad-name', sheet.getByText('Names are 1 to 32 characters, without control characters.'));
    await sheet.getByLabel('Name').fill('Marko · Mom');
    await sheetShot(p, 'sheet-add-typed-never-sent', sheet.getByText('You have never sent to this address.'));
    await sheet.getByRole('button', {name: 'Cancel'}).click();
    await p.close();

    // 15 · populated (ix:7380-7434): the design's seven rows, their dates from local activity.
    const book = [
      {address: addr(1), name: 'Marko · Mom'},
      {address: addr(2), name: 'Aleks · DeFi pool'},
      {address: addr(3), name: 'Luka · Designer'},
      {address: addr(4), name: 'Bistro · for Marketing'},
      {address: addr(5), name: 'Noctura · Cold storage'},
      {address: addr(6), name: 'Tina'},
      {address: addr(7), name: 'Daniel · Co-founder'},
    ];
    await saveContacts(h, book);
    const now = Date.now();
    await set(h.sw, {
      v1_known_recipients: [
        {address: addr(1), at: now - 3 * DAY},
        {address: addr(2), at: now - 12 * DAY},
        {address: addr(3), at: now - 40 * DAY},
        {address: addr(4), at: now - 65 * DAY},
        {address: addr(7), at: now - 245 * DAY},
      ],
    });
    p = await popup(h);
    await toBook(p);
    await expect(p.locator('.s-abook .row')).toHaveCount(7);
    await expect(p.locator('.s-abook .row').first().locator('.when')).toHaveText('3 days ago');
    await expect(p.locator('.s-abook .row').nth(4).locator('.when')).toHaveText('never');
    await pop(p, '15-populated', p.locator('.s-abook .row').first());
    // 15 · search active (ix:7464-7501) and no result (O71).
    await p.getByRole('textbox', {name: 'Search contacts'}).fill('mark');
    await expect(p.getByText('2 results for "mark"')).toBeVisible();
    await expect(p.locator('.s-abook .row mark')).toHaveText(['Mark', 'Mark']);
    await pop(p, '15-search-active', p.getByText('2 results for "mark"'));
    await p.getByRole('textbox', {name: 'Search contacts'}).fill('zed');
    await expect(p.getByText('No contacts match "zed".')).toBeVisible();
    await pop(p, '15-search-no-result', p.getByRole('button', {name: 'Add new contact "zed" →'}));
    await p.getByRole('button', {name: 'Clear search'}).click();
    // The sheet · edit (D21), duplicate-name (O85), delete confirm.
    await p.locator('.s-abook .row', {hasText: 'Tina'}).click();
    const edit = p.getByRole('dialog', {name: 'Edit contact'});
    await expect(edit.getByLabel('Name')).toHaveValue('Tina');
    await expect(edit.getByText('You have never sent to this address.')).toBeVisible();
    await sheetShot(p, 'sheet-edit', edit.getByRole('button', {name: 'Delete contact'}));
    await edit.getByLabel('Name').fill('marko · MOM');
    await edit.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(edit.getByText('Another contact already has this name.')).toBeVisible();
    await sheetShot(p, 'sheet-duplicate-name', edit.getByText('Another contact already has this name.'));
    await edit.getByRole('button', {name: 'Delete contact'}).click();
    await expect(edit.getByText('Delete this contact?')).toBeVisible();
    await sheetShot(p, 'sheet-delete-confirm', edit.getByRole('button', {name: 'Keep'}));
    await edit.getByRole('button', {name: 'Keep'}).click();
    await edit.getByRole('button', {name: 'Cancel'}).click();
    // #31 · Connections › Address book · 7 contacts (ix:13552).
    await p.getByRole('button', {name: 'Back'}).click();
    await expect(p.locator('.s7-row', {hasText: 'Address book'}).locator('.s7-meta')).toHaveText('7 contacts');
    await pop(p, '31-connections-address-book', p.locator('.s7-row', {hasText: 'Address book'}));
    // #37 · the plan-2 bullet: the address book is erased with the rest.
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    const bullet = p.locator('.app-delete-bullets li').nth(1);
    await expect(bullet).toHaveText('Local settings, cached balances, your address book and the list of addresses you have sent to are erased and not recoverable.');
    await pop(p, '37a-bullet-address-book', bullet);
    await p.close();

    // 15 · full (200): every add disabled, O73.
    await saveContacts(h, Array.from({length: 193}, (_, i) => ({address: addr(20 + i), name: `Contact ${i + 1}`})));
    p = await popup(h);
    await toBook(p);
    await expect(p.getByText('The address book is full (200 contacts).')).toBeVisible();
    await expect(p.getByRole('button', {name: 'Add contact'})).toBeDisabled();
    await pop(p, '15-full', p.getByText('The address book is full (200 contacts).'));
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: the hooks — #12’s contact icon, #15 pick, #12 after a pick, #20’s Save as, #27 Save / Save sender, the sheet from #27c (only sent to you, dust, full), the labels', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-vis-contact-hooks-');
  try {
    await realWallet(h);
    const DUSTER = addr(90);
    const t = Math.floor(Date.now() / 1000);
    h.fake.history.set(ACCOUNT, [
      {signature: sig(51), tx: sentSol(ACCOUNT, COUNTERPARTY, 2_480_000_000, t - 60)},
      {signature: sig(52), tx: receivedUsdc(ACCOUNT, addr(91), 250_000_000, t - 120)},
      {signature: sig(53), tx: sentSol(DUSTER, ACCOUNT, 500_000, t - 180)},
    ]);
    await saveContacts(h, [{address: addr(92), name: 'Binance'}]);
    let p = await popup(h);
    // #12 idle: Paste and Address book (ix:6652).
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(p.locator('.recipient-row .input-actions button')).toHaveCount(2);
    await pop(p, '12-idle-contact-icon', p.getByRole('button', {name: 'Address book'}));
    // #15 pick: the whole address and O72.
    await p.getByLabel('Amount').fill('0.01');
    await p.getByRole('button', {name: 'Address book'}).click();
    const row = p.locator('.s-abook .row', {hasText: 'Binance'});
    await expect(row.locator('.when')).toHaveText('You have never sent to this address.');
    await pop(p, '15-pick', row);
    // #12 after the pick: the label above "Never sent here before", state 6.
    await row.click();
    await expect(p.locator('.recipient-row .app-contact-label')).toHaveText('From your address book: Binance');
    await expect(p.locator('.recipient-row .helper.warn')).toHaveText('Never sent here before');
    await pop(p, '12-picked-contact', p.locator('.recipient-row .app-contact-label'));
    await p.close();

    // #20 first-time: the Save-as row (ix:9349-9350) → the sheet prefilled (never sent) → saved, the To label.
    p = await popup(h);
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByLabel('Recipient', {exact: true}).fill(RECIPIENT);
    await p.getByLabel('Amount').fill('0.01');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Continue to confirm'}).click();
    const saveAs = p.locator('.detail-row.app-save-as');
    await expect(saveAs.locator('.val')).toHaveText('Add to address book? · Add · Skip');
    await pop(p, '20-first-time-save-as', saveAs);
    await saveAs.getByRole('button', {name: 'Add'}).click();
    const prefilled = p.getByRole('dialog', {name: 'Add contact'});
    await expect(prefilled.getByText('You have never sent to this address.')).toBeVisible();
    await expect(prefilled.getByLabel('Name')).toBeFocused();
    await sheetShot(p, 'sheet-add-prefilled-never-sent', prefilled.getByText('You have never sent to this address.'));
    await prefilled.getByLabel('Name').fill('Savings jar');
    await prefilled.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(p.locator('.detail-row', {hasText: 'From your address book: Savings jar'})).toBeVisible();
    await expect(saveAs).toHaveCount(0);
    await pop(p, '20-saved-label', p.locator('.detail-row', {hasText: 'From your address book: Savings jar'}));
    // Cancel discards the prepared send (E7): the next popup opens on #11, not on #20's resume.
    await p.getByRole('button', {name: 'Cancel'}).click();
    await expect(p.getByText('Transaction cancelled. No fees charged.')).toBeVisible();
    await p.close();

    // #27a [Save]; #27c [Save sender] → only sent to you; the dust one → the banner and Save anyway; then the label.
    p = await popup(h);
    await p.getByRole('button', {name: 'Activity'}).click();
    await p.getByText('Sent SOL', {exact: true}).click();
    await expect(p.getByRole('button', {name: 'Save'})).toBeVisible();
    await pop(p, '27a-save', p.getByRole('button', {name: 'Save'}));
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByText('Received USDC').click();
    await expect(p.getByRole('button', {name: 'Save sender'})).toBeVisible();
    await pop(p, '27c-save-sender', p.getByRole('button', {name: 'Save sender'}));
    await p.getByRole('button', {name: 'Save sender'}).click();
    const sender = p.getByRole('dialog', {name: 'Add contact'});
    await expect(sender.getByText('You have never sent to this address — it only sent to you.')).toBeVisible();
    await expect(sender.locator('.app-contact-addr')).toBeInViewport({ratio: 1});
    await sheetShot(p, 'sheet-only-sent-to-you', sender.getByText('You have never sent to this address — it only sent to you.'));
    await sender.getByLabel('Name').fill('Client');
    await sender.getByRole('button', {name: 'Save', exact: true}).click();
    const fromRow = p.locator('.detail-row', {hasText: 'From your address book: Client'});
    await expect(fromRow.locator('.lbl')).toHaveText('From');
    await pop(p, '27c-from-label', fromRow);
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByText('Received SOL').click();
    await p.getByRole('button', {name: 'Save sender'}).click();
    const dust = p.getByRole('dialog', {name: 'Add contact'});
    await expect(dust.locator('.banner.danger')).toHaveText('Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.');
    await expect(dust.getByRole('button', {name: 'Save anyway'})).toBeVisible();
    // Opened with the focus in Name, the whole sheet is in view: the address it saves and Save anyway wholly, the banner
    // at 95 % (review L3: one wrapped line under another font must not fail a product that is right).
    for (const part of [dust.locator('.app-contact-addr'), dust.getByRole('button', {name: 'Save anyway'})]) await expect(part).toBeInViewport({ratio: 1});
    await expect(dust.locator('.banner.danger')).toBeInViewport({ratio: 0.95});
    await sheetShot(p, 'sheet-dust', dust.locator('.banner.danger'));
    await sheetShot(p, 'sheet-dust-save-anyway', dust.getByRole('button', {name: 'Save anyway'}));
    await dust.getByRole('button', {name: 'Cancel'}).click();
    await p.close();

    // The book full: a new contact from #27c is refused with O87.
    await saveContacts(h, Array.from({length: 197}, (_, i) => ({address: addr(100 + i), name: `Contact ${i + 1}`})));
    p = await popup(h);
    await p.getByRole('button', {name: 'Activity'}).click();
    await p.getByText('Received SOL').click();
    await p.getByRole('button', {name: 'Save sender'}).click();
    const full = p.getByRole('dialog', {name: 'Add contact'});
    await full.getByLabel('Name').fill('Duster');
    await full.getByRole('button', {name: 'Save anyway'}).click();
    await expect(full.getByText('The address book is full (200 contacts). Delete one to add another.')).toBeVisible();
    await sheetShot(p, 'sheet-full', full.getByText('The address book is full (200 contacts). Delete one to add another.'));
    contained(h);
  } finally {
    await h.close();
  }
});
````

The behaviour these specs drive was built in Tasks 1–8, so on Task 9's tree they pass; what makes them failable is shown by the named mutations below (each turns its spec red on a real build).


- [ ] **Step 2: Run the whole suite and the gates.**

```bash
cd extension
npx tsc --noEmit && npx vitest run
node scripts/build.mjs && npm run gates
npx playwright test e2e/visual-contacts.spec.ts
```
Expected (dry run): tsc clean; whole suite Test Files  138 passed (138) · Tests  2730 passed (2730); gates green; Playwright 2 passed (27 shots under `test-results/visual/`), normal launch and under `unshare -rn`.

- [ ] **Step 3: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` (a unique `mktemp -d` directory) and link `extension/node_modules`, `web/node_modules` and the root `node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`. Each mutation must compile (`npx tsc --noEmit` first): one that does not is INVALID, not red. An E2E mutation is built (`node scripts/build.mjs`) before Playwright runs; a failed build is INVALID — Playwright would otherwise run the stale `dist` green.

- **M10a** — the contact sheet at the design's 70 % (Sheet `tall` not applied) — `extension/src/app/ui/Sheet.tsx`:

  ```diff
  - <div className={tall ? 's8-sheet app-sheet-tall' : 's8-sheet'}
  + <div className="s8-sheet"
  ```
  `node scripts/build.mjs && timeout 300 npx playwright test e2e/visual-contacts.spec.ts -g 'visual: the hooks'` — Expected: **red** (dry run: red, Error: expect(locator).toBeInViewport() failed · 1 failed).

- **M10b** — pick rows show the truncation (the visual pass sees it too) — `extension/src/app/screens/Contacts.tsx`:

  ```diff
  -             <AddressGroups address={c.address} />
  +             {c.address.length > 0 ? shortAddress(c.address) : <AddressGroups address={c.address} />}
  ```
  `node scripts/build.mjs && timeout 300 npx playwright test e2e/contacts.spec.ts -g '(^|\s)19 · negative'` — Expected: **red** (dry run: red, Error: expect(locator).toHaveText(expected) failed · 1 failed).

- [ ] **Step 4: Commit.**

```bash
git add extension/e2e/visual-contacts.spec.ts
git commit -F - <<'MSG'
test(extension): the plan-2 visual pass — #15, the contact sheet, the hooks on #12, #20, #27, #31 and #37

Co-Authored-By: <the executing model's own line>
MSG
```

## Dry-run record (each finding fixed in the code above)

The end state was built task by task in a scratch git repository outside the checkout (a `git archive` of `feat/extension-b1b2b-plan2` at f183069 = `main` after PR #107), one commit per task; the plan's code blocks are generated from those commits. Then:

- **Blocks reproduce the tree.** Applying every block of this document in order (59 blocks: new files written in full, diffs with `git apply --recount`) onto a fresh archive of the starting tree reproduces the dry-run tree byte for byte (`diff -r`: no difference).
- **Per-task replay** (copied `node_modules`): each task's unit test files on its predecessor's tree — red for every task 1–8 (the counts are in each task's Step 2; Tasks 9–10 add E2E specs over built behaviour, made failable by their mutations); at each task `tsc` clean, the task's own tests green, the whole vitest suite green, `node scripts/build.mjs` + `npm run gates` green. Whole suite: 2 588 tests at Task 1 → **Test Files 138 passed (138) · Tests 2730 passed (2730)** at Task 10 (rev 2) (plan 1's merged tree: 133 files, 2 583 tests).
- **E2E, contained, normal launch:** 48 passed (48) — plan 1's 44 plus spec 19 ×2 and the two visual-contacts specs (spec 15's first run asserts `v1_contacts` wiped).
- **E2E under `unshare -rn`:** 48 passed (48).
- **Extension `npm run verify`** (build, vitest 138 files / 2 730 tests, CSP, secrets, every gate, reproducible — chrome `sha256:c339a0de…`, firefox `sha256:5b080f42…`, rev 2) green. **Web `npm run verify`** green (43 files / 548 tests + script tests 3). **Root:** `npx tsc --noEmit` clean; `npx jest` 180 suites passed, 1 skipped; 1 234 tests passed, 1 skipped (no task touches the root, `core/` or `web/`). **TGE gate:** clean over the end state and this plan.
- **CI reproduction on Node 22.12.0 / npm 11.6.2 with ONLY `web/` and `extension/` installed** (`npm ci --ignore-scripts`; no root `node_modules`): web `npm run verify` green (43 files / 548 tests, script tests 3); extension `npm run verify` green (rev 1: 138 files / 2 721 tests, every gate, the same reproducible hashes); `npm run e2e` 48 passed, and under `unshare -rn` 48 passed.
- **Mutations:** every named mutation above was run alone in a fresh `git archive` copy of the end state under `timeout 300`, `tsc` first (the E2E ones also built): **all 59 red** (rev 2: rev 1's 54, with M5b and M6a rewritten for the changed code, plus M4h, M4i, M5h, M5i, M5j). Seven first forms did not compile (an import or a variable left unused, a regex `tsc` rejects without the `u` flag) and were rewritten as the compiling forms shown — INVALID was never counted as red.

**Rev 2 re-run (after review 1):** the whole per-task replay again (Tasks 4 and 5 changed, 9 and 10 changed their specs; every later tree changed with them) — each task's tests red on its predecessor and green on its own tree, tsc, the whole suite and gates at every task; E2E contained 48 passed (48) and under `unshare -rn` 48 passed (48); extension and web `verify`, root `tsc` and `jest`, the TGE gate green; all 59 mutations red in fresh `git archive` copies; the 59 blocks reproduce the end state byte for byte. The Node 22.12 / npm 11.6.2 CI reproduction was not re-run: rev 2 changes no dependency, lockfile or `web/` file.

What the dry run caught:

1. **The contact sheet hid the address it saves (Task 4, found in Task 10's shots).** At the design's 70 % the dust state's content ran past the panel, and the focused name field scrolled the full address out of view — the one thing the poisoning defence needs on screen. Fixed by the `tall` sheet and side-by-side actions (Scope 3.2–3.3); M10a (70 % again) turns the visual spec red at `toBeInViewport`.
2. **The shared `Sheet` stole the initial focus** from React's `autoFocus` (its effect runs after the child's) — `data-autofocus` (Scope 3.7), M4e.
3. **The vault-isolation gate flagged plan 1's own comment** in `src/unlock/forgetFlow.ts` ("plan 2 adds v1_contacts there") the moment `v1_contacts` joined `BACKGROUND_OWNED_KEYS` — reworded in Task 2.
4. **Esc over a sheet popped the screen beneath** (App's handler) — Scope 3.6, M5f; #20's own Esc paused while its sheet is open, M7c.
5. **2a's `visual.spec.ts` and the tab's quiet-provider test listed #31's rows and #20's reads** exactly — both updated (Tasks 5, 7).
6. **The late-answer guards were unobservable** until a test made the answer `locked` after unmount (a reload would then read `wallet.state`) — M4c, M5e, M7d, M8c are red because of it.
7. **The spec's E2E 19 needs a look-alike** of a paid address: four-and-four vanity search is infeasible, so the spec adds 58^20 to the address's number (same length, first four and last four, a different middle) and asserts it.
8. **The writing tool turned `\u200B` into the character itself** in the first drafts of three test files — invisible characters in source; every one is an escape now (`grep` for U+200B–U+200F, U+202A–U+202E, U+2066–U+2069 over the added files is empty).
9. **Not caused by this plan:** the repository root's `node_modules/` holds a self-referencing `node_modules/node_modules` symlink (dated 2026-09-29), as plan 1 recorded; the dry run never wrote to any repository `node_modules`. The scratch directory held files of an older session (`mutations.json` of 2026-10-01); this run's results were kept apart.

## Review 1 (Fable 5.1) — how each finding was applied (rev 2)

Verdict: approve after fixes (Critical 0, High 1, Medium 3, Low 10). Every code change has a test and a named mutation; the dry run was re-run per task and for the full end state.

- **H1** (Task 4) — `Sheet`'s focus/key effect runs once; the latest `onClose` lives in a ref. Tests: a ticking parent re-renders the sheet — the caret stays in Name (add · empty), the focus stays on Cancel, Esc and the backdrop still reach the latest `onClose`. M4h (`[onClose]` again) red.
- **M1** (Scope 3.10) — **owner decision pending**, put to the owner by the controller before Task 4: O72 stays, fail closed; only the wording for the SENT case is asked; the history never feeds `known`.
- **M2** (Task 4) — the delete confirm moves the focus to Keep and back to "Delete contact" (the Sheet stays mounted, so its opener is kept). Test + M4i.
- **M3** (Task 5) — `App.test.tsx` pins Esc on plan 1's accounts manager remove sheet; M5f runs both files.
- **L1** (Tasks 4–5) — an address query seeds the sheet's address field (`typed`), the name empty. Tests in both files; M5h.
- **L2** (Task 4) — the typed-mode groups lose `aria-label="Address"`; `getByLabel('Address')` is unique in every state.
- **L3** (Task 10) — the banner at `ratio: 0.95`, the address and "Save anyway" at 1; the fonts are the bundled Geist faces (`check-fonts.mjs`).
- **L4** (Scope 3.12) — owner note: C19 refuses ZWJ/ZWNJ/VS16 names with 2a's line; any second line is owner copy.
- **L5** (Task 5) — a pick row for an own account says "Your account: <name>". Test + M5i.
- **L6** (Task 4) — `NAME_RULE` exported from `Switcher.tsx`, used by the rename errors and the sheet.
- **L7** (Task 9) — `lookalike()` throws if the sum leaves 32 bytes.
- **L8** (Task 5) — `pickStack` in `router.ts` (unit-tested); with no `send` route below, App pops. M5j.
- **L9** (Scope 3.8) — #15's rows declared as plain (idempotent) buttons.
- **L10** (Scope 3.12) — recorded: add vs edit is chosen from the book read at mount; no change.

## Before the PR (the standing rules)

- [ ] Reproduce CI with **only** `web/` and `extension/` installed, on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`), npm 11.6.2: `npm ci --ignore-scripts` in both, `npm run verify` in both, `npm run e2e` in `extension/` — in a normal launch and under `unshare -rn`.
- [ ] No task touches the repository root's `src/`, `core/` or `web/`; run the root `npx tsc --noEmit` and `npx jest` anyway.
- [ ] `node scripts/check-no-tge-date.mjs` from the repository root — this plan and every file it adds are clean.
- [ ] The opus-tier visual review of Task 10's 27 shots (against index.html #15, #12, #20, #27, #31, #37 and #43 for the undrawn sheet, with §8.4's checklist), then an independent opus review of that review; each finding fixed or declared in the spec's Differs; the result in the PR description.
- [ ] **Before Task 4:** the owner's answer on Scope 3.10 (review M1; the controller has asked). The owner questions in the PR: **"1 contact"** (Scope 3.1); the tall contact sheet and its side-by-side actions (3.2–3.3); the received From row's label (3.5); the L4 note (3.12).

## Self-review

- **Spec coverage.** §1.4 (Task 3 route; Task 6 hand-back + M6a); §1.5 (Task 2: `contacts.*` privileged, partition tests, `BACKGROUND_OWNED_KEYS` + fixture); §1.6 (Task 5, hash re-pinned); E17 store, messages, label, lifecycle, security argument (Task 2; the client's L3 rule, Task 3); §5's bullet (Task 2); §6.1 every state (Task 5; pick, Task 6); §6.2 every state and error (Task 4); §6.3 #12 (Task 6), #20 (Task 7), #27 (Task 8), #31 (Task 5), #37 (Task 2); §7 rule 6 (Tasks 4–8) and the contacts errors; §8.1 E17 incl. C19 rev 3, C18 boundaries, the cross-script pin and the named spec mutations (M1a, M2a, M2b); §8.2 (the pick rows, O77/O78, Save as never for a known address, Send never focused, the hand-back); §8.3 spec 19 ×2 and spec 15's key (Task 9); §8.4 (Task 10). D18 (no notes, no import/export), D19 (parity, M2a/M9a), D20 (wipe/keep, the sheet), D21 (row → edit), C12 (locked, one per address, fixed address, newest first, precedence, no name on #10 — E2E 19 asserts it), C18 (base units, null = dust), C19.
- **Rule 6.** Sheet Save / Delete and #12's contact icon have double-press tests with `disabled` lifted; #20's Add and #27's Save have the lock asserted (a second open is invisible); #15's `+` / add buttons and #20's Skip are LockedButtons without a test of their own, and #15's rows are plain idempotent buttons — opening an open sheet, hiding a hidden row or repeating the same reset cannot be observed (Scope 3.8).
- **Focus.** The Sheet's effect runs once per mount (review H1) — a re-render of the screen beneath never moves the focus; the delete confirm keeps the focus inside the sheet (M2).
- **Generation checks.** The sheet (`alive` after save, delete and paste; `recipientInfo` by generation, keyed on address and account), #15 (`alive` + newest read), #20 (`gen`), #27 (`alive`), #31's count (`alive` + newest read) — the first four pinned by tests whose late answer would be observable.
- **Placeholders.** None: every step has its code (new files in full, changes as exact diffs), its command and the dry run's expected output; the generated CSS has its generator and its hash.
- **Type consistency.** The Interfaces blocks are the exports as they compile; the replay compiled and tested every task on its own predecessor.
- **O-list.** Every visible string is O67–O88, a 2a string ("Cancel", "Paste", "Solana address", "Try again", "Something went wrong. Try again.", the name rule, "Paste with Ctrl+V (⌘V on a Mac).") or a design string the spec quotes (#15's, #20's "Save as · Add to address book? · Add · Skip", #27's "Save" / "Save sender", #31's "Connections" / "Address book" / "N contacts", "Add contact"), plus the spec's adapted ones ("Or save one from a transaction's details.", "1 result for "q"", #37's plan-2 bullet). **One is not: "1 contact"** — flagged (Scope 3.1).

## Execution handoff

Plan complete. Execute with superpowers:subagent-driven-development (a fresh implementer per task, the two-stage review between tasks; Tasks 2 and 4 — the store and the sheet, the trust boundary — reviewed as the security core; Task 10's shots reviewed by an opus-tier reviewer), or superpowers:executing-plans in one session with checkpoints. Every plan goes to a Fable 5.1 review before execution (owner rule).
