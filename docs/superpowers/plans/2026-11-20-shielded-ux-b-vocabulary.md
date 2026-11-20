# Shielded UX, part B: one vocabulary, simpler screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One word pair (Public / Private) in every user-visible string, one balance line per #16 tab, technical rows behind a collapsed "Details ▾", a compact destination row, and an import that never silently picks an empty account — without the wallet claiming more privacy than it delivers.

**Architecture:** A copy module (`src/copy/modes.ts`) holds every §2 term; three presentational components under `src/components/private/` (`DetailsDisclosure`, `DestinationRow`, `AmountLimitHint`) carry the new layout; the screens import both. A source scanner (`src/copy/__testing__/copyScan.ts`, the TypeScript compiler API) reads what each screen *says* and holds the banned words out of `src/screens/**` and `src/components/**`, with a per-file ratchet that the copy tasks shrink to zero. M1c's flow, reconciliation and verifier modules are not touched; only strings, layout and the import's account choice change. The Android dialog's strings change in their resource; the Kotlin code does not.

**Tech Stack:** React Native 0.84 (TypeScript strict, NativeWind v4), Jest + @testing-library/react-native, `typescript` 6.0.2 (already a devDependency) for the source scan, Kotlin JVM unit tests (`:app:testDebugUnitTest`).

**Spec:** `docs/superpowers/specs/2026-11-20-shielded-ux-b-vocabulary-design.md` (owner-approved 2026-11-20). Executors read the spec and this plan together; where they differ, the "Spec ambiguities and their resolutions" section below says which reading this plan takes and why.

**Revision 2 (2026-11-20):** after Fable plan review 1 (`.superpowers/sdd/2026-11-20-shielded-ux-b-plan-review.md`: 0 Critical, 7 Important, 9 Minor) and two owner decisions of 2026-11-20 — A1: when the fresh account is unavailable NOTHING is preselected (M1c's S11 stays; spec §3.3 amended in the same commit); A10: "Amounts and parties stay private on-chain." is deleted from Receive's M2 branch. The section "Review 1 resolutions" at the end lists each finding and what changed.

**Base:** branch `feat/shielded-ux-b-vocabulary`, stacked on part A (`feat/shielded-ux-a-quick-fixes`, PR #124). Retarget to `main` once #124 merges; never merge the two back to back without retargeting (lesson of PR #97).

## Global Constraints

- Vocabulary (spec §2, decision B-1, verbatim): dashboard toggle **Public / Private**; actions **Make private / Make public**; CTA "Make {amount} {sym} public" / "Make {amount} {sym} private", disabled CTA "Make {sym} public" / "Make {sym} private"; #16 title **Private ⇄ Public**; **Private balance**, and **Public balance** on the Make private tab; **PRIVATE ASSETS**, "· private"; **Making public…** / **Now public** / header "PRIVATE · Make public"; **Making private…** / **Now private**; the info card is the **Private balance** card and keeps "Deposits are public on chain."; native dialog **Confirm making public**, prompt **Approve making this public**, subtitle "Confirm it is you to authorize this one transfer to public".
- Banned in user-visible copy (spec §2): "Shield", "Unshield", "Shielded", "Transparent", "Vault" (and their -ing / -s forms, any case). They MAY stay in code identifiers, comments, test names, test ids, class names, readout fields and the desk.
- Every §2 term is imported from `src/copy/modes.ts`. A sentence that only *uses* a term may stay in its screen, but must not contain a banned word.
- Honesty (binding, spec §2): keep verbatim the deposit sentence "Your main account signs this deposit. The amount, the time and your address are public on chain, and a later withdrawal to this wallet can be linked to it.", the relayed sentence "The relayer pays for and submits this transaction, so no key of yours signs it. Amounts and timing are public.", the main-account warning "This links your exit to your deposit: your main account made the deposit.", the "another address" warning (one word swapped: "shielded balance" → "private balance"), and "Deposits are public on chain.".
- Forbidden in any new copy (spec §2): anything that says or implies anonymous, untraceable, invisible, fully private, or "no one can see". `copyScan.ts` `FORBIDDEN_NEW` checks every user-visible string in scope.
- The privacy-claims guard (`src/screens/shielded/__tests__/privacyClaims.test.ts`): its `UNSUPPORTED` regexes are never edited, relaxed or reordered. Only `EXTRA_COPY`, the positive-control file lists and the native resource's positive-control strings change. The guard reads whole files, comments included: no comment in a file in its scope may contain one of its phrases (e.g. "unlinkable").
- Out of scope (spec §1): the combined total "Public X · Private Y" (part C); private send to another person (M2); any change to M1c's flow / verification / reconciliation logic (`src/modules/shielded/a0/{unshieldFlow,landedVerifier,unshieldReconcile*,relayerClient,noteStore,...}.ts` untouched, except the three caption strings in `unshieldCheck.ts`, which are screen copy); any rename of code identifiers, test ids, tests, readout fields or the desk.
- M1c's flow, reconcile and verifier suites (`src/modules/shielded/a0/__tests__/**`) keep every assertion unchanged. Only screen-copy rows change, and each changed row gets a trailing comment `// part B: <old> → <new>` (spec §6 "each changed row says why"). A negative row that names an old word (`queryByText(/Unshielded|CONFIRMED/)`) is rewritten to the new word, never deleted — left alone it would pass vacuously.
- Cardinal rules (CLAUDE.md): BigInt amounts end to end, TypeScript strict (no `any`, no `@ts-ignore`), no `// TODO`, every send/sign CTA debounced 500 ms and disabled on tap (unchanged logic — keep it).
- Gates, every task, with their real exit codes read (not the tick): `npx jest` (alone, nothing else on the line), `npx tsc --noEmit`, `npm run lint:ci` (exactly `✖ 144 problems (0 errors, 144 warnings)` — no new warnings), `node scripts/check-no-tge-date.mjs`. When a Kotlin file or an Android resource changes (Task 6), also the Kotlin JVM job of `.github/workflows/android-jvm.yml` (command in Task 6).
- Reviews (spec §7, owner rule: every review goes to Fable): each task has one implementer, then a Fable task review, a fix loop, and a scoped Fable re-review of the fixes, before the next task starts; after Task 8's owner approval, a final Fable review of the whole branch. See "Execution notes".
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, whichever model implements the task. This is the session-mandated attribution (controller ruling, as on PRs #123 / #124); the PR body states which model implemented which task. One commit per task.

## Review Focus

1. **The fresh account is unavailable (cli wallet S9, no grant S11) → nothing is preselected (owner decision A1).** The collapsed row reads "To: Choose a destination · Change", the one-line reason is visible, and the CTA stays disabled until the person picks; picking "My main account" shows the link warning at once, and only a tap hands over `{kind: 'main'}`. Test: Task 3, "Review Focus 1" (M1c's S11 row, its assertions kept, and the S9 row).
2. **A blocking condition is never hidden behind Details.** The SOL-short warning, "no private note can pay the relayer fee", the refused quote, the over-the-limit hint and the honest sentences stay visible with Details collapsed. Test: Task 3, "Review Focus 2".
3. **The amount boundary on Make public.** MAX fills exactly the max; exactly the max → no hint and the CTA enabled; one base unit more → the hint and the CTA disabled (BigInt, not float). Test: Task 3, "Review Focus 3" (plus Task 2's component rows).
4. **Import retry after a failed balance RPC.** The warning and the full list first; a Retry that then finds one funded account shows "We found your wallet" (the "Use a different account" state is reset), and a wallet whose only funded account is the CLI scheme is offered that account. Test: Task 7, "Review Focus 4".
5. **The hidden-balance dashboard.** With balances hidden, the Private balance card shows no Details toggle and no anonymity number (the eye hides it as it hides the balance). Test: Task 5, "Review Focus 5".

## Spec ambiguities and their resolutions

These are the readings this plan takes. Each is the smaller or the more secure change; the owner may overturn any.

- **A1 — OWNER DECISION 2026-11-20: nothing is preselected when the fresh account is unavailable.** Spec §3.3 said "main is preselected" while also keeping M1c's selection logic, and M1c's S11 says "no option is preselected". The owner kept M1c's ruling; spec §3.3 is amended in the plan's commit. `a0UnshieldDestinationOffer` and `UnshieldSide`'s preselection effect stay as M1c built them (fresh when granted, otherwise `null`). `DestinationRow` collapsed shows "To: Choose a destination · Change" (`DESTINATION_NONE` in `modes.ts`), the unavailable reason shows, and the CTA is disabled until a pick. M1c's S11 screen row keeps its assertions (it only gains the "open Change" step, since the options now sit behind it).
- **A2 — "Your deposit is public on chain" "stays" (spec §4, deposit #19–#21), but no screen shows that sentence today.** Resolution: Task 4 adds it on the deposit #21 card only when the deposit landed (`done` with `unspent`), testID `shield-status-public` — never while it runs, when it is pending, or in the `dropped` outcome ("yours did not land"), where it would be false (review I-2).
- **A3 — the banned-word scan covers ALL of `src/screens/**` and `src/components/**` (spec §3.1), which includes screens §4 does not list:** #15 explainer, Receive (shielded payment code), Send's shielded-address error, History's "Shielded" filter, the shielded #19 of the old transfer (`TxSimulateScreen`), onboarding Success, Portfolio. Resolution: Task 5 swaps the word in each (no layout change). Files outside `src/screens` / `src/components` whose strings reach the user are added to the scan: `src/modules/shielded/a0/unshieldCheck.ts` (the "Check again" captions) and `src/hooks/useA0Shielded.ts` (one message), swapped in Task 4; `src/app/Navigator.tsx` (`recipient: 'Shielded pool'`, printed whole on #10 UnlockSend in every deposit — review I-3), swapped in Task 4 to `'Pool'`; `src/constants/errors.ts` (E013, E050, E062, E110) and `src/modules/geoFence/geoFenceModule.ts` (two messages), swapped in Task 5. `TxSimulateScreen`'s "Private simulation passed" and `SendScreen`'s "Use a private transfer for private addresses" are bare word swaps on paths hidden until M2: M2 rewrites them (review M-9).
- **A4 — "one-line reason" for the unavailable fresh account (spec §3.3).** M1c's §11 reasons are one or two sentences and tested verbatim. Resolution: shown as one caption under the collapsed row (not truncated), text unchanged (it contains no banned word); hidden while the options are open, where the fresh option's own description already says it (review M-5).
- **A5 — AmountLimitHint's text is Make-public specific ("make up to … public at once").** Resolution: the component takes its message; Make public passes `makePublicLimit(max, sym)`, Make private keeps today's "Insufficient balance · max {max} {sym}" through the same component.
- **A6 — "no technical term visible by default" vs the many sentences that say "note", "pool", "relayer".** The spec bans five words, not these. Resolution: those words stay where §2/§4 do not move them; the pool-size row on Make private ("Notes in the pool after this deposit") moves into Details with the fee rows (it is the deposit's anonymity measure, like the dashboard's, which §4 moves into Details); "Relayer fee" stays visible (§4 says so).
- **A7 — #18 "stage labels in plain words": the spec gives no strings.** Resolution (Task 4): unshield rows `Check the pool` / `Relayer fee` / `Your approval` / `Make the proof`; deposit rows `Prepare` / `Make the proof` / `Check the proof` / `Ready`; "Groth16" and "witness" leave the visible copy; every row keeps its measured time.
- **A8 — #21 unshield sub "The destination received {x} {sym}." drops today's "Landed on Solana devnet and verified ·".** Resolution: the spec's sentence verbatim; the CONFIRMED badge stays and says the same. The "Checked again: … verified …" subs of a decided outcome keep their wording (they are the decided captions §4 keeps).
- **A9 — `scripts/m1c-checkpoint/README.md` quotes the old captions** ("Not sent · your note is back in your shielded balance.", the dialog's fee line). The spec forbids renaming the desk. Resolution: the README is not edited; the owner's phone pass reads the new words (listed in Task 6's notes).
- **A10 — OWNER DECISION 2026-11-20: delete "Amounts and parties stay private on-chain." from `ReceiveScreen`'s shielded (M2) branch** — a deletion, not a rewording (M2 writes its own copy). Done in Task 1, because Task 1's forbidden-phrase row (which now includes `/stays? private on-?chain/i`, review I-5 / M-2) would otherwise be red on that file.
- **A11 — "Private pool" (review M-4).** The pool is a public account and the native dialog labels it "Pool". Resolution: #20 says "Pool · 8VMe…", #19 "→ the pool", #10's recipient "Pool". Listed for the owner's phone pass (reversible).

## File map

- Create `src/copy/modes.ts` — every §2 term and its formatters (Task 1).
- Create `src/copy/__testing__/copyScan.ts` — the source scanner: user-visible strings, banned words, forbidden phrases (Task 1).
- Create `src/copy/__tests__/modes.test.ts`, `src/copy/__tests__/bannedWords.test.ts` (Task 1; the ratchet shrinks in Tasks 3–5).
- Create `src/components/private/{DetailsDisclosure,DestinationRow,AmountLimitHint}.tsx`, `src/components/private/index.ts`, `src/components/private/__tests__/{DetailsDisclosure,DestinationRow,AmountLimitHint}.test.tsx` (Task 2).
- Modify `src/screens/shielded/{ShieldUnshieldScreen,shieldedParts}.tsx`, `src/screens/shielded/unshield/{UnshieldSide.tsx,unshieldCopy.ts}` and their tests (Task 3).
- Modify `src/screens/shielded/unshield/UnshieldRunScreen.tsx`, `src/screens/shielded/{ZkProofScreen,ShieldSimulateScreen,ShieldConfirmScreen,ShieldStatusScreen}.tsx`, `unshieldCopy.ts` (refusal sentences), `src/modules/shielded/a0/unshieldCheck.ts` (captions), `src/hooks/useA0Shielded.ts` (one message) and their tests (Task 4).
- Modify `src/screens/dashboard/DashboardScreen.tsx`, `src/screens/shielded/ShieldedExplainerScreen.tsx`, `src/screens/transparent/{ReceiveScreen,SendScreen,TransactionHistoryScreen,TxSimulateScreen}.tsx`, `src/screens/onboarding/SuccessScreen.tsx`, `src/screens/portfolio/PortfolioScreen.tsx` and their tests (Task 5).
- Modify `android/app/src/main/res/values/a0_confirm_strings.xml`, `android/app/src/test/java/com/nocturawallet/prover/A0ConfirmTextTest.kt`; create `src/copy/__tests__/nativeStrings.test.ts` (Task 6).
- Modify `src/screens/onboarding/SelectAccountScreen.tsx`; create `src/screens/onboarding/__tests__/SelectAccountScreen.test.tsx` (Task 7).
- Modify (outside the repo, after backups, behind the owner's approval) `/home/user/Downloads/index.html`, `/home/user/Downloads/screen.md` (Task 8).
- Modify `src/screens/shielded/__tests__/privacyClaims.test.ts` — scope only (Tasks 1, 2, 4, 5, 6, 7).
- Modify `src/screens/transparent/ReceiveScreen.tsx` + its test (Task 1: the A10 deletion; Task 5: the word swap), `src/app/Navigator.tsx` (Task 4), `src/constants/errors.ts`, `src/modules/geoFence/geoFenceModule.ts` (Task 5).
- Modify `docs/superpowers/specs/2026-11-20-shielded-ux-b-vocabulary-design.md` §3.3 (owner decision A1 — done in this plan's revision commit, not by a task).

Task order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Spec §7 step 4 is split into Tasks 4 (the run screens), 5 (dashboard and remaining screens) and 6 (Kotlin strings): a reviewer can reject the Kotlin resource change, or the out-of-§4 screens, without rejecting the run screens.

---

### Task 1: The vocabulary module, the scanner, the banned-word ratchet

**Files:**
- Create: `src/copy/modes.ts`
- Create: `src/copy/__testing__/copyScan.ts`
- Create: `src/copy/__tests__/modes.test.ts`
- Create: `src/copy/__tests__/bannedWords.test.ts`
- Modify: `src/screens/shielded/__tests__/privacyClaims.test.ts` (the `EXTRA_COPY` list and the positive control; regexes untouched)
- Modify: `src/screens/transparent/ReceiveScreen.tsx` (owner decision A10: one sentence deleted), `src/screens/transparent/__tests__/ReceiveScreen.test.tsx` (one row)

**Interfaces:**
- Consumes: nothing.
- Produces (`src/copy/modes.ts`, every later task imports these exact names):
  - `MODE_PUBLIC = 'Public'`, `MODE_PRIVATE = 'Private'`, `MAKE_PRIVATE = 'Make private'`, `MAKE_PUBLIC = 'Make public'`, `PRIVATE_PUBLIC_TITLE = 'Private ⇄ Public'`, `PRIVATE_BALANCE = 'Private balance'`, `PUBLIC_BALANCE = 'Public balance'`, `PRIVATE_ASSETS = 'Private assets'`, `PRIVATE_SUFFIX = ' · private'`, `PRIVATE_MARK = 'Private'`, `MAKING_PUBLIC = 'Making public…'`, `NOW_PUBLIC = 'Now public'`, `MAKING_PRIVATE = 'Making private…'`, `NOW_PRIVATE = 'Now private'`, `PRIVATE_CARD_BODY`, `NATIVE_CONFIRM_TITLE`, `NATIVE_FEE_LINE`, `NATIVE_PROMPT_TITLE`, `NATIVE_PROMPT_SUBTITLE`, `DETAILS = 'Details'`, `DESTINATION_FRESH = 'A new account'`, `DESTINATION_MAIN = 'My main account'`, `DESTINATION_EXTERNAL = 'Another address'`, `DESTINATION_EXTERNAL_SUB = 'A wallet address outside this wallet'`, `RECOMMENDED = ' (recommended)'`, `CHANGE = 'Change'`, `DESTINATION_NONE = 'Choose a destination'` (owner decision A1);
  - `makePublicCta(amount: string, sym: string): string`, `makePrivateCta(amount: string, sym: string): string`, `makePublicCtaIdle(sym: string): string`, `makePrivateCtaIdle(sym: string): string`, `makePublicLimit(max: string, sym: string): string`, `destinationSummary(name: string | null): string` (`null` → "To: Choose a destination").
- Produces (`src/copy/__testing__/copyScan.ts`): `BANNED_WORDS: RegExp`, `FORBIDDEN_NEW: readonly RegExp[]`, `interface VisibleString {line: number; text: string}`, `userVisibleStrings(fileName: string, source: string): VisibleString[]`, `bannedStrings(fileName: string, source: string): VisibleString[]`, `forbiddenClaims(fileName: string, source: string): string[]`, `walkSources(dir: string): string[]`.
- Produces (`bannedWords.test.ts`): the ratchet `NOT_YET_SWAPPED: Record<string, number>` — Tasks 3, 4 and 5 edit its lines.

- [ ] **Step 1: Write the failing tests**

Create `src/copy/__tests__/modes.test.ts`:

```ts
/**
 * Shielded UX part B, spec §2 (decision B-1): the one vocabulary, verbatim, and its honesty rows.
 * Every expected string is the spec's text typed out here, never read back from the module.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as modes from '../modes';
import {bannedStrings, forbiddenClaims, userVisibleStrings} from '../__testing__/copyScan';

const FILE = path.resolve(__dirname, '../modes.ts');
const SRC = fs.readFileSync(FILE, 'utf8');

describe('src/copy/modes.ts — the §2 table', () => {
  it('the terms, verbatim', () => {
    expect(modes.MODE_PUBLIC).toBe('Public');
    expect(modes.MODE_PRIVATE).toBe('Private');
    expect(modes.MAKE_PRIVATE).toBe('Make private');
    expect(modes.MAKE_PUBLIC).toBe('Make public');
    expect(modes.PRIVATE_PUBLIC_TITLE).toBe('Private ⇄ Public');
    expect(modes.PRIVATE_BALANCE).toBe('Private balance');
    expect(modes.PUBLIC_BALANCE).toBe('Public balance');
    expect(modes.PRIVATE_ASSETS).toBe('Private assets'); // the overline variant renders "PRIVATE ASSETS"
    expect(modes.PRIVATE_SUFFIX).toBe(' · private');
    expect(modes.PRIVATE_MARK).toBe('Private'); // the overline renders "PRIVATE"
    expect(modes.MAKING_PUBLIC).toBe('Making public…');
    expect(modes.NOW_PUBLIC).toBe('Now public');
    expect(modes.MAKING_PRIVATE).toBe('Making private…');
    expect(modes.NOW_PRIVATE).toBe('Now private');
    expect(modes.NATIVE_CONFIRM_TITLE).toBe('Confirm making public');
    expect(modes.NATIVE_PROMPT_TITLE).toBe('Approve making this public');
    expect(modes.NATIVE_PROMPT_SUBTITLE).toBe('Confirm it is you to authorize this one transfer to public');
    expect(modes.NATIVE_FEE_LINE).toBe('Relayer fee %1$s %2$s, taken from your private balance');
    expect(modes.DETAILS).toBe('Details');
    expect(modes.DESTINATION_FRESH).toBe('A new account');
    expect(modes.DESTINATION_MAIN).toBe('My main account');
    expect(modes.DESTINATION_EXTERNAL).toBe('Another address');
    expect(modes.DESTINATION_EXTERNAL_SUB).toBe('A wallet address outside this wallet');
    expect(modes.RECOMMENDED).toBe(' (recommended)');
    expect(modes.CHANGE).toBe('Change');
    expect(modes.DESTINATION_NONE).toBe('Choose a destination'); // owner decision A1
  });

  it('the CTAs: with an amount, and the disabled form without one', () => {
    expect(modes.makePublicCta('1.25', 'TEST')).toBe('Make 1.25 TEST public');
    expect(modes.makePrivateCta('1.25', 'TEST')).toBe('Make 1.25 TEST private');
    expect(modes.makePublicCtaIdle('TEST')).toBe('Make TEST public');
    expect(modes.makePrivateCtaIdle('TEST')).toBe('Make TEST private');
  });

  it('AmountLimitHint and DestinationRow lines (spec §3.3, §3.4)', () => {
    expect(modes.makePublicLimit('1.99999', 'TEST')).toBe('You can make up to 1.99999 TEST public at once.');
    expect(modes.destinationSummary('A new account (recommended)')).toBe('To: A new account (recommended)');
    expect(modes.destinationSummary(null)).toBe('To: Choose a destination'); // owner decision A1: nothing preselected
  });

  it('the Private balance card keeps the honest sentence (spec §2 "Kept as is")', () => {
    expect(modes.PRIVATE_CARD_BODY).toBe('Make private moves tokens in with a proof made on this device. Deposits are public on chain.');
  });
});

describe('src/copy/modes.ts — honesty', () => {
  it('the scan reads the module (positive control: it is not empty)', () => {
    expect(userVisibleStrings('src/copy/modes.ts', SRC).length).toBeGreaterThanOrEqual(25);
  });

  it('no string of the module carries a banned word', () => {
    expect(bannedStrings('src/copy/modes.ts', SRC)).toEqual([]);
  });

  it('spec §2 "Forbidden": nothing the module says implies anonymous, untraceable, invisible, fully private, no one can see', () => {
    expect(forbiddenClaims('src/copy/modes.ts', SRC)).toEqual([]);
  });

  it('negative controls: each forbidden phrase is caught in a string; an honest one and a comment are not', () => {
    expect(forbiddenClaims('f.ts', "const a = 'Your transfer is anonymous';")).toEqual(['anonymous']);
    expect(forbiddenClaims('f.ts', "const a = 'Untraceable by design';")).toEqual(['untraceable']);
    expect(forbiddenClaims('f.ts', "const a = 'Invisible on chain';")).toEqual(['invisible']);
    expect(forbiddenClaims('f.ts', "const a = 'It is fully private';")).toEqual(['fully private']);
    expect(forbiddenClaims('f.ts', "const a = 'No one can see it';")).toEqual(['no one can see']);
    // review M-2 / I-5: what IMPLIES it, too
    expect(forbiddenClaims('f.ts', 'const a = "It can\'t be traced";')).toHaveLength(1);
    expect(forbiddenClaims('f.ts', "const a = 'It cannot be traced';")).toHaveLength(1);
    expect(forbiddenClaims('f.ts', "const a = 'Hidden from everyone';")).toEqual(['hidden from everyone']);
    expect(forbiddenClaims('f.ts', "const a = 'Amounts and parties stay private on-chain.';")).toEqual(['stays? private on-?chain']);
    expect(forbiddenClaims('f.ts', "// anonymous, in a comment\nconst a = 'Deposits are public on chain.';")).toEqual([]);
  });
});
```

Create `src/copy/__tests__/bannedWords.test.ts`:

```ts
/**
 * Shielded UX part B, spec §3.1 / §6: none of the banned words (Shield, Unshield, Shielded,
 * Transparent, Vault) in any user-visible string of src/screens/** or src/components/**, plus the
 * module copy those screens render. Read from the sources with the TypeScript compiler
 * (`copyScan.ts`), so a test id, a class name, a comparison or a comment is not copy.
 */
import * as fs from 'fs';
import * as path from 'path';
import {bannedStrings, forbiddenClaims, walkSources} from '../__testing__/copyScan';

const ROOT = path.resolve(__dirname, '../../..');

/** Files outside src/screens and src/components whose strings reach the user as they are (plan A3, review I-3). */
const EXTRA = [
  'src/modules/shielded/a0/unshieldCheck.ts',
  'src/hooks/useA0Shielded.ts',
  'src/app/Navigator.tsx',
  'src/constants/errors.ts',
  'src/modules/geoFence/geoFenceModule.ts',
];

function sources(): Array<{file: string; text: string}> {
  return [
    ...walkSources(path.join(ROOT, 'src/screens')),
    ...walkSources(path.join(ROOT, 'src/components')),
    ...EXTRA.map(f => path.join(ROOT, f)),
  ].map(p => ({file: path.relative(ROOT, p), text: fs.readFileSync(p, 'utf8')}));
}

/**
 * THE RATCHET (part B, Tasks 1 → 5): each file not yet swapped and its EXACT number of banned
 * strings on the day Task 1 landed. The task that swaps a file deletes its line here in the same
 * commit (Task 3: #16; Task 4: the run screens; Task 5: the rest, and the map with it). Exact, not
 * "at most": a file that gains a banned string fails, and a swapped file whose line was left fails.
 */
const NOT_YET_SWAPPED: Record<string, number> = {
  'src/screens/dashboard/DashboardScreen.tsx': 15,
  'src/screens/onboarding/SuccessScreen.tsx': 1,
  'src/screens/portfolio/PortfolioScreen.tsx': 1,
  'src/screens/shielded/ShieldConfirmScreen.tsx': 7,
  'src/screens/shielded/ShieldSimulateScreen.tsx': 7,
  'src/screens/shielded/ShieldStatusScreen.tsx': 10,
  'src/screens/shielded/ShieldUnshieldScreen.tsx': 11,
  'src/screens/shielded/ShieldedExplainerScreen.tsx': 4,
  'src/screens/shielded/ZkProofScreen.tsx': 1,
  'src/screens/shielded/unshield/UnshieldRunScreen.tsx': 18,
  'src/screens/shielded/unshield/UnshieldSide.tsx': 7,
  'src/screens/shielded/unshield/unshieldCopy.ts': 8,
  'src/screens/transparent/ReceiveScreen.tsx': 11,
  'src/screens/transparent/SendScreen.tsx': 1,
  'src/screens/transparent/TransactionHistoryScreen.tsx': 1,
  'src/screens/transparent/TxSimulateScreen.tsx': 3,
  'src/modules/shielded/a0/unshieldCheck.ts': 3,
  'src/hooks/useA0Shielded.ts': 1,
  'src/app/Navigator.tsx': 1,
  'src/constants/errors.ts': 4,
  'src/modules/geoFence/geoFenceModule.ts': 2,
};

const FIXTURE = [
  "import {X} from './ShieldStatusScreen';",
  '// Shielded mode, a comment',
  "const on = mode === 'shielded';",
  "const k = {kind: 'shield'};",
  'const uri = `noctura+shielded:${on}`;',
  'export const C = () => (',
  '  <Text testID="shielded-line" className="text-accent-shielded">Unshield</Text>',
  ');',
].join('\n');

describe('the banned words (spec §2) are out of every user-visible string', () => {
  it('positive control: "Unshield" in JSX text is caught, and only it', () => {
    expect(bannedStrings('fixture.tsx', FIXTURE).map(s => s.text)).toEqual(['Unshield']);
    expect(bannedStrings('fixture.tsx', FIXTURE.replace('>Unshield<', '>Make public<'))).toEqual([]);
  });

  it.each(['Shield', 'Unshield', 'Shielded', 'Transparent', 'Vault', 'shielding', 'vault balance'])(
    'positive control: "%s" in an accessibility label is copy, and caught',
    w => {
      expect(bannedStrings('f.tsx', `const a = <Text accessibilityLabel="${w} TEST" />;`)).toHaveLength(1);
    },
  );

  it('review M-1: JSX text is copy even as a lower-case fragment between expressions', () => {
    expect(bannedStrings('f.tsx', 'const C = () => <Text>Move into the {x} vault</Text>;').map(s => s.text)).toEqual(['vault']);
  });

  it('negative controls: a test id, a class name, a comparison, an object value token, an import, a comment, a URI scheme are not copy', () => {
    const only = FIXTURE.replace('>Unshield<', '><');
    expect(bannedStrings('fixture.tsx', only)).toEqual([]);
  });

  it('the scan reads every screen and component (positive control)', () => {
    const files = sources().map(s => s.file);
    expect(files.length).toBeGreaterThanOrEqual(70);
    expect(files).toEqual(
      expect.arrayContaining([
        'src/screens/dashboard/DashboardScreen.tsx',
        'src/screens/shielded/ShieldUnshieldScreen.tsx',
        'src/screens/shielded/unshield/UnshieldRunScreen.tsx',
        'src/screens/onboarding/SelectAccountScreen.tsx',
        'src/components/CheckAgainLink.tsx',
        'src/modules/shielded/a0/unshieldCheck.ts',
        'src/app/Navigator.tsx',
        'src/constants/errors.ts',
      ]),
    );
    expect(files.some(f => f.includes('__tests__'))).toBe(false);
  });

  it('every ratchet line names a file in scope (a stale line fails)', () => {
    const files = new Set(sources().map(s => s.file));
    for (const f of Object.keys(NOT_YET_SWAPPED)) {
      expect(files.has(f)).toBe(true);
    }
  });

  it.each(sources().map(s => [s.file, s.text] as const))('%s: exactly its ratchet count of banned strings', (file, text) => {
    const hits = bannedStrings(file, text).map(s => `${s.line}: ${s.text}`);
    expect(hits).toHaveLength(NOT_YET_SWAPPED[file] ?? 0);
  });

  it.each(sources().map(s => [s.file, s.text] as const))('%s: no forbidden phrase (spec §2)', (file, text) => {
    expect(forbiddenClaims(file, text)).toEqual([]);
  });
});
```

Modify the guard `src/screens/shielded/__tests__/privacyClaims.test.ts` — the `EXTRA_COPY` list gains the module, and the M1c positive control names it (the `UNSUPPORTED` list above it is not touched):

```ts
const EXTRA_COPY = [
  path.join(ROOT, 'src/components/CheckAgainLink.tsx'),
  // Shielded UX part A: the dashboard carries shielded copy too (its "Make public" action, the
  // "pending · not confirmed yet" caption, the shielded asset lines).
  path.join(ROOT, 'src/screens/dashboard/DashboardScreen.tsx'),
  // Shielded UX part B (spec §2 "Widened"): the one vocabulary module.
  path.join(ROOT, 'src/copy/modes.ts'),
];
```

and in `it('M1c: the scope reaches the new unshield directory and the M1 copy outside it (positive control)', …)` add `'src/copy/modes.ts',` to the `expect.arrayContaining([...])` list and, after the `copy` assertion, append:

```ts
    // part B: the vocabulary module is read as text; its honest sentence is in what the guard sees
    const vocab = screenSources().find(s => s.file === 'src/copy/modes.ts')!;
    expect(vocab.text).toContain('Deposits are public on chain.');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/copy src/screens/shielded/__tests__/privacyClaims.test.ts`
Expected: FAIL — `Cannot find module '../modes'` and `Cannot find module '../__testing__/copyScan'`; the guard fails with `ENOENT … src/copy/modes.ts`.

- [ ] **Step 3: Write the scanner**

Create `src/copy/__testing__/copyScan.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Shielded UX part B (spec §3.1, §6): what a screen SAYS, read from its source. Used by
 * `src/copy/__tests__/*.test.ts`; not a test itself (Jest runs every file under `__tests__`, so
 * this lives in `__testing__`, like `modules/shielded/a0/__testing__`). Never imported by the app.
 *
 * A user-visible string is a string literal, a template literal (its fixed parts) or JSX text,
 * EXCEPT where the code uses it as a token rather than as copy:
 *   - import / export specifiers and anything in a type position;
 *   - the JSX attributes in NON_COPY_ATTRIBUTES (test ids, class names, colours, enum props);
 *   - arguments of cn / clsx / require / console.* / jest.*;
 *   - an operand of === / !==, a `case` label, an object key;
 *   - a lower-case token with no space (`'shielded'`, `'transparent'`, `'slip10:0'`).
 * Comments are never strings. accessibilityLabel IS copy (a screen reader says it).
 */

/** spec §2: the words that disappear from user-visible copy. A word glued to `-`, `+`, `/` or a letter is a token (`accent-shielded`, `noctura+shielded:`). */
export const BANNED_WORDS = /(?<![\w+/-])(?:un)?shield(?:ed|ing|s)?(?![\w-])|(?<![\w+/-])(?:transparent|vaults?)(?![\w-])/i;

/** spec §2 "Forbidden": no new copy may say or imply these (the last three: what implies it — review M-2 / I-5). */
export const FORBIDDEN_NEW: readonly RegExp[] = [
  /anonymous/i,
  /untraceable/i,
  /invisible/i,
  /fully private/i,
  /no one can see/i,
  /can(?:'|no)?t be traced/i,
  /hidden from everyone/i,
  /stays? private on-?chain/i,
];

const MACHINE_TOKEN = /^[a-z0-9_.:/#@-]*$/;
const NON_COPY_ATTRIBUTES = new Set([
  'testID',
  'nativeID',
  'key',
  'className',
  'contentContainerClassName',
  'color',
  'fill',
  'stroke',
  'placeholderTextColor',
  'variant',
  'tone',
  'mode',
  'kind',
  'name',
]);
const NON_COPY_CALLS = /^(cn|clsx|require|console\.\w+|jest\.\w+)$/;

export interface VisibleString {
  line: number;
  text: string;
}

export function userVisibleStrings(fileName: string, source: string): VisibleString[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: VisibleString[] = [];
  const notCopy = (node: ts.Node): boolean => {
    for (let p: ts.Node | undefined = node.parent; p !== undefined; p = p.parent) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isTypeNode(p)) return true;
      if (ts.isJsxAttribute(p)) return NON_COPY_ATTRIBUTES.has(p.name.getText(sf));
      if (ts.isCallExpression(p) && NON_COPY_CALLS.test(p.expression.getText(sf))) return true;
      if (
        ts.isBinaryExpression(p) &&
        (p.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          p.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
      ) {
        return true;
      }
      if (ts.isCaseClause(p)) return true;
      if (ts.isPropertyAssignment(p) && p.name === node) return true;
      if (ts.isStatement(p)) return false;
    }
    return false;
  };
  const visit = (node: ts.Node): void => {
    let text: string | null = null;
    let jsx = false;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      text = node.text;
    } else if (ts.isTemplateExpression(node)) {
      text = [node.head.text, ...node.templateSpans.map(s => s.literal.text)].join(' ');
    } else if (ts.isJsxText(node)) {
      text = node.text.trim();
      jsx = true;
    }
    // JSX text is always copy (a lower-case fragment like "vault" between two expressions too)
    if (text !== null && text !== '' && (jsx || !MACHINE_TOKEN.test(text)) && !notCopy(node)) {
      out.push({line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text});
    }
    if (ts.isTemplateExpression(node)) {
      node.templateSpans.forEach(s => visit(s.expression));
    } else {
      ts.forEachChild(node, visit);
    }
  };
  visit(sf);
  return out;
}

/** The banned strings of one source file. */
export function bannedStrings(fileName: string, source: string): VisibleString[] {
  return userVisibleStrings(fileName, source).filter(s => BANNED_WORDS.test(s.text));
}

/** spec §2 "Forbidden", over the user-visible strings only (a comment may name what it forbids). */
export function forbiddenClaims(fileName: string, source: string): string[] {
  const said = userVisibleStrings(fileName, source).map(s => s.text).join('\n');
  return FORBIDDEN_NEW.filter(re => re.test(said)).map(re => re.source);
}

/** Every `.ts` / `.tsx` under `dir`, outside `__tests__` and `__testing__`. */
export function walkSources(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === '__testing__' ? [] : walkSources(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}
```

(The planner ran this exact scanner, compiled `--strict`, over the branch at 402323e plus the three EXTRA files of review I-3: 82 files, exactly the 21 counts in the ratchet above, the fixture rows as written; `forbiddenClaims` is 0 everywhere except `ReceiveScreen.tsx` (`stays? private on-?chain`), which Step 4b removes.)

- [ ] **Step 4: Write the vocabulary module**

Create `src/copy/modes.ts`. Its comments must not contain any phrase of the privacy-claims guard (the guard reads comments too):

```ts
/**
 * Shielded UX part B (spec docs/superpowers/specs/2026-11-20-shielded-ux-b-vocabulary-design.md
 * §2, decision B-1 "Public / Private"): every user-visible TERM of the two sides, in one place.
 * The screens import these. A sentence that only uses a term may stay in its screen, but never
 * with one of the words §2 removes (`src/copy/__tests__/bannedWords.test.ts`).
 *
 * Honesty (spec §2; memory project_shielded_privacy_guarantee): "Private" promises more than the
 * old word did — a deposit is public and signed by the main account, and an exit to the main
 * account is linkable to it. Nothing here may promise more (`FORBIDDEN_NEW` in
 * `src/copy/__testing__/copyScan.ts`), and the privacy-claims guard reads this file.
 *
 * Amounts arrive already formatted (`displayAmount`): this module holds words, never arithmetic.
 * Overline text is upper-cased by the `overline` variant, so terms are written in sentence case.
 */

/** The dashboard's mode toggle (§2 row 1). */
export const MODE_PUBLIC = 'Public';
export const MODE_PRIVATE = 'Private';

/** The two actions: #16's tabs and the dashboard's quick actions (§2 row 2). */
export const MAKE_PRIVATE = 'Make private';
export const MAKE_PUBLIC = 'Make public';

/** #16's title (§2 row 3). */
export const PRIVATE_PUBLIC_TITLE = 'Private ⇄ Public';

/** The balances (§2 row 4): "Public balance" is the Make private tab's one line (decision B-2). */
export const PRIVATE_BALANCE = 'Private balance';
export const PUBLIC_BALANCE = 'Public balance';

/** The dashboard's asset section ("PRIVATE ASSETS" on screen) and row suffix (§2 row 5). */
export const PRIVATE_ASSETS = 'Private assets';
export const PRIVATE_SUFFIX = ' · private';

/** The mode mark in the #18 / #21 headers ("PRIVATE · Make public", §2 row 6). */
export const PRIVATE_MARK = 'Private';

/** The run that makes a balance public (§2 row 6). */
export const MAKING_PUBLIC = 'Making public…';
export const NOW_PUBLIC = 'Now public';

/** The deposit run (§2 row 7). */
export const MAKING_PRIVATE = 'Making private…';
export const NOW_PRIVATE = 'Now private';

/** The dashboard's Private balance card (§2 row 8): it keeps "Deposits are public on chain." */
export const PRIVATE_CARD_BODY = 'Make private moves tokens in with a proof made on this device. Deposits are public on chain.';

/**
 * The native confirmation (§2 row 9). Android cannot import this module: the resource
 * `android/app/src/main/res/values/a0_confirm_strings.xml` holds the same words, and
 * `src/copy/__tests__/nativeStrings.test.ts` (Task 6) holds the two equal.
 */
export const NATIVE_CONFIRM_TITLE = 'Confirm making public';
export const NATIVE_FEE_LINE = 'Relayer fee %1$s %2$s, taken from your private balance';
export const NATIVE_PROMPT_TITLE = 'Approve making this public';
export const NATIVE_PROMPT_SUBTITLE = 'Confirm it is you to authorize this one transfer to public';

/** `DetailsDisclosure`'s label (spec §3.2). */
export const DETAILS = 'Details';

/** `DestinationRow` (spec §3.3). */
export const DESTINATION_FRESH = 'A new account';
export const DESTINATION_MAIN = 'My main account';
export const DESTINATION_EXTERNAL = 'Another address';
export const DESTINATION_EXTERNAL_SUB = 'A wallet address outside this wallet';
export const RECOMMENDED = ' (recommended)';
export const CHANGE = 'Change';
/** Nothing chosen yet (owner decision A1, 2026-11-20): no quote yet, or the fresh account is not offered (S9 / S11). */
export const DESTINATION_NONE = 'Choose a destination';

/** "To: {selected}" — the collapsed destination row; "To: Choose a destination" while nothing is chosen. */
export function destinationSummary(name: string | null): string {
  return `To: ${name ?? DESTINATION_NONE}`;
}

/** The CTAs (§2 row 2), with an amount. */
export function makePublicCta(amount: string, sym: string): string {
  return `Make ${amount} ${sym} public`;
}

export function makePrivateCta(amount: string, sym: string): string {
  return `Make ${amount} ${sym} private`;
}

/** The disabled CTAs (§2 row 2), without an amount. */
export function makePublicCtaIdle(sym: string): string {
  return `Make ${sym} public`;
}

export function makePrivateCtaIdle(sym: string): string {
  return `Make ${sym} private`;
}

/** `AmountLimitHint` on Make public (spec §3.4). */
export function makePublicLimit(max: string, sym: string): string {
  return `You can make up to ${max} ${sym} public at once.`;
}
```

- [ ] **Step 4b: Owner decision A10 — delete the Receive overclaim**

In `src/screens/transparent/__tests__/ReceiveScreen.test.tsx`, inside `describe('shielded variant (#13.shielded)', …)`, add:

```tsx
    it('owner decision A10 (2026-11-20): the M2 banner makes no "stay private on-chain" claim', () => {
      const {queryByText} = renderScreen({address: NOC, shielded: true});
      expect(queryByText(/stay private on-chain/)).toBeNull();
      expect(queryByText(/must support Noctura/)).toBeTruthy(); // positive control: the banner is rendered
    });
```

Run `npx jest src/screens/transparent/__tests__/ReceiveScreen.test.tsx` — expected FAIL on that row. Then in `src/screens/transparent/ReceiveScreen.tsx` delete the second sentence of the shielded banner, so its JSX text is only:

```tsx
            <Text variant="caption" className="flex-1 text-shield-300">
              The sender's wallet must support Noctura shielded payment codes.
            </Text>
```

(a deletion, not a rewording; the banned word in the first sentence is Task 5's — the ratchet's count for this file stays 11 because both sentences were one JSX text). Rerun: PASS.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/copy src/screens/shielded/__tests__/privacyClaims.test.ts src/screens/transparent/__tests__/ReceiveScreen.test.tsx`
Expected: PASS. The ratchet rows pass because every listed file still has exactly its count; the forbidden-phrase rows are empty in every file.

- [ ] **Step 6: Prove the ratchet is a check (mutation, then revert)**

Temporarily change `'src/screens/portfolio/PortfolioScreen.tsx': 1,` to `0`; run `npx jest src/copy/__tests__/bannedWords.test.ts`; expected FAIL on `src/screens/portfolio/PortfolioScreen.tsx: exactly its ratchet count` with the hit `28: Holdings breakdown, allocation by token, and shielded/transparent split. Coming soon.`. Revert to `1`. Then temporarily change `BANNED_WORDS`'s `(?:un)?` to `(?:xx)?`; expected FAIL on the positive control "Unshield". Revert.

- [ ] **Step 7: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: jest all green (the new suites included); tsc exit 0; lint `✖ 144 problems (0 errors, 144 warnings)`; the TGE check exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/copy src/screens/shielded/__tests__/privacyClaims.test.ts src/screens/transparent/ReceiveScreen.tsx src/screens/transparent/__tests__/ReceiveScreen.test.tsx
git commit -m "feat(shielded-ux-b): the one vocabulary (src/copy/modes.ts), the source scanner and the banned-word ratchet (part B Task 1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The three components

**Files:**
- Create: `src/components/private/DetailsDisclosure.tsx`
- Create: `src/components/private/DestinationRow.tsx`
- Create: `src/components/private/AmountLimitHint.tsx`
- Create: `src/components/private/index.ts`
- Test: `src/components/private/__tests__/DetailsDisclosure.test.tsx`, `DestinationRow.test.tsx`, `AmountLimitHint.test.tsx`
- Modify: `src/screens/shielded/__tests__/privacyClaims.test.ts` (scope: the new directory)

**Interfaces:**
- Consumes (Task 1): `DETAILS`, `CHANGE`, `RECOMMENDED`, `DESTINATION_NONE` (through `destinationSummary`), `DESTINATION_FRESH`, `DESTINATION_MAIN`, `DESTINATION_EXTERNAL`, `DESTINATION_EXTERNAL_SUB`, `destinationSummary` from `src/copy/modes.ts`.
- Produces (`src/components/private/index.ts`):
  - `DetailsDisclosure({testID, children}: {testID: string; children: React.ReactNode})` — test ids `${testID}` (wrapper), `${testID}-toggle` (the "Details ▾/▴" button), `${testID}-body` (only when open);
  - `type DestinationChoice = 'fresh' | 'main' | 'external'`; `interface DestinationRowProps {testID: string; choice: DestinationChoice | null; onChoose: (c: DestinationChoice) => void; disabled: boolean; fresh: {available: boolean; sub: string}; mainSub: string; mainMono: boolean; freshReason: string | null; warning: {testID: string; text: string} | null; children?: React.ReactNode}`; `DestinationRow(props)` — test ids `${testID}` (card), `${testID}-summary` (its children: the "To: …" string), `${testID}-change`, `${testID}-fresh-reason`, `${testID}-options` (open only), `${testID}-fresh` / `-main` / `-external` (options, `accessibilityRole="radio"`, `accessibilityState={{selected, disabled}}`), `${testID}-fresh-sub` / `-main-sub` / `-external-sub`;
  - `overLimit(amount: bigint | null, max: bigint): boolean`; `AmountLimitHint({amount, max, message, testID}: {amount: bigint | null; max: bigint; message: string; testID: string})` — the message Text carries `testID`, its row `${testID}-row`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/private/__tests__/DetailsDisclosure.test.tsx`:

```tsx
/** spec §3.2: "Details ▾", collapsed by default, no persisted state, a button with its expanded state. */
import React from 'react';
import {Text} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {DetailsDisclosure} from '../DetailsDisclosure';

const panel = () => (
  <DetailsDisclosure testID="d">
    <Text>Network fee</Text>
  </DetailsDisclosure>
);

describe('DetailsDisclosure', () => {
  it('collapsed by default: the children are not rendered; "Details ▾"', () => {
    const r = render(panel());
    expect(r.queryByText('Network fee')).toBeNull();
    expect(r.queryByTestId('d-body')).toBeNull();
    expect(r.getByText('Details ▾')).toBeTruthy();
  });

  it('a press shows the children and turns the arrow; a second press hides them', () => {
    const r = render(panel());
    fireEvent.press(r.getByTestId('d-toggle'));
    expect(r.getByText('Network fee')).toBeTruthy();
    expect(r.getByText('Details ▴')).toBeTruthy();
    fireEvent.press(r.getByTestId('d-toggle'));
    expect(r.queryByText('Network fee')).toBeNull();
  });

  it('accessibility: a button labelled "Details" whose expanded state follows the panel', () => {
    const r = render(panel());
    const t = r.getByTestId('d-toggle');
    expect(t.props.accessibilityRole).toBe('button');
    expect(t.props.accessibilityLabel).toBe('Details');
    expect(t.props.accessibilityState).toMatchObject({expanded: false});
    fireEvent.press(t);
    expect(r.getByTestId('d-toggle').props.accessibilityState).toMatchObject({expanded: true});
  });

  it('no persisted state: a new mount starts collapsed even after one was opened', () => {
    const first = render(panel());
    fireEvent.press(first.getByTestId('d-toggle'));
    expect(first.getByText('Network fee')).toBeTruthy();
    first.unmount();
    expect(render(panel()).queryByText('Network fee')).toBeNull();
  });
});
```

Create `src/components/private/__tests__/DestinationRow.test.tsx`:

```tsx
/** spec §3.3: "To: {selected} · Change"; three options with one-line descriptions; the warning always visible. */
import React from 'react';
import {Text} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {DestinationRow} from '../DestinationRow';
import type {DestinationRowProps} from '../DestinationRow';

const REASON =
  'A new account is not available yet: the relayer cannot send it SOL for its own fees, and funding it from your other accounts would link them.';

function props(over: Partial<DestinationRowProps> = {}): DestinationRowProps {
  return {
    testID: 'dest',
    choice: 'fresh',
    onChoose: jest.fn(),
    disabled: false,
    fresh: {available: true, sub: 'A new account of this wallet receives it.'},
    mainSub: 'AbCdEf…uVwXyZ',
    mainMono: true,
    freshReason: null,
    warning: null,
    ...over,
  };
}
const summary = (r: ReturnType<typeof render>) => r.getByTestId('dest-summary').props.children;

describe('DestinationRow', () => {
  it('collapsed: "To: A new account (recommended)" and Change; the options are not rendered', () => {
    const r = render(<DestinationRow {...props()} />);
    expect(summary(r)).toBe('To: A new account (recommended)');
    expect(r.getByText('Change')).toBeTruthy();
    expect(r.queryByTestId('dest-options')).toBeNull();
    expect(r.getByTestId('dest-change').props.accessibilityState).toMatchObject({expanded: false, disabled: false});
  });

  it('the summary names the selected destination; nothing chosen yet → "To: Choose a destination"', () => {
    const r = render(<DestinationRow {...props({choice: 'main'})} />);
    expect(summary(r)).toBe('To: My main account');
    r.rerender(<DestinationRow {...props({choice: 'external'})} />);
    expect(summary(r)).toBe('To: Another address');
    r.rerender(<DestinationRow {...props({choice: null})} />);
    expect(summary(r)).toBe('To: Choose a destination'); // owner decision A1
  });

  it('Change opens the three options with their one-line descriptions; a pick calls onChoose and collapses', () => {
    const p = props();
    const r = render(<DestinationRow {...p} />);
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.getByTestId('dest-change').props.accessibilityState).toMatchObject({expanded: true});
    expect(r.getByTestId('dest-fresh-sub').props.children).toBe('A new account of this wallet receives it.');
    expect(r.getByTestId('dest-main-sub').props.children).toBe('AbCdEf…uVwXyZ');
    expect(r.getByTestId('dest-external-sub').props.children).toBe('A wallet address outside this wallet');
    expect(r.getByTestId('dest-fresh').props.accessibilityState).toMatchObject({selected: true});
    fireEvent.press(r.getByTestId('dest-main'));
    expect(p.onChoose).toHaveBeenCalledWith('main');
    expect(r.queryByTestId('dest-options')).toBeNull();
  });

  it('an unavailable fresh account: its reason shows under the COLLAPSED row (once — not repeated while open); its option is disabled and a tap chooses nothing', () => {
    const p = props({choice: null, fresh: {available: false, sub: REASON}, freshReason: REASON});
    const r = render(<DestinationRow {...p} />);
    expect(summary(r)).toBe('To: Choose a destination');
    expect(r.getByTestId('dest-fresh-reason').props.children).toBe(REASON);
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.queryByTestId('dest-fresh-reason')).toBeNull(); // review M-5: the option's own sub says it
    expect(r.getAllByText(REASON)).toHaveLength(1);
    expect(r.getByTestId('dest-fresh').props.accessibilityState).toMatchObject({disabled: true, selected: false});
    fireEvent.press(r.getByTestId('dest-fresh'));
    expect(p.onChoose).not.toHaveBeenCalled();
  });

  it('disabled (no quote yet): Change does nothing', () => {
    const r = render(<DestinationRow {...props({disabled: true, choice: null})} />);
    expect(r.getByTestId('dest-change').props.accessibilityState).toMatchObject({disabled: true});
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.queryByTestId('dest-options')).toBeNull();
  });

  it('the warning is always visible, collapsed and open — never behind Change', () => {
    const w = {testID: 'dest-warning-main', text: 'This links your exit to your deposit: your main account made the deposit.'};
    const r = render(<DestinationRow {...props({choice: 'main', warning: w})} />);
    expect(r.getByTestId('dest-warning-main').props.children).toBe(w.text);
    fireEvent.press(r.getByTestId('dest-change'));
    expect(r.getByTestId('dest-warning-main')).toBeTruthy();
  });

  it('children render below the row (the address input lives there)', () => {
    const r = render(
      <DestinationRow {...props({choice: 'external'})}>
        <Text>address input</Text>
      </DestinationRow>,
    );
    expect(r.getByText('address input')).toBeTruthy();
  });
});
```

Create `src/components/private/__tests__/AmountLimitHint.test.tsx`:

```tsx
/** spec §3.4: nothing while the amount is ≤ max; above it the line in the danger tone. BigInt boundary. */
import React from 'react';
import {render} from '@testing-library/react-native';
import {AmountLimitHint, overLimit} from '../AmountLimitHint';

const MSG = 'You can make up to 1.99999 TEST public at once.';

describe('AmountLimitHint', () => {
  it.each([
    ['no amount', null],
    ['below the max', 1_999_989_999n],
    ['exactly the max', 1_999_990_000n],
  ])('%s → renders nothing', (_n, amount) => {
    const r = render(<AmountLimitHint amount={amount} max={1_999_990_000n} message={MSG} testID="hint" />);
    expect(r.toJSON()).toBeNull();
  });

  it('one base unit over the max → the message, danger tone', () => {
    const r = render(<AmountLimitHint amount={1_999_990_001n} max={1_999_990_000n} message={MSG} testID="hint" />);
    expect(r.getByTestId('hint').props.children).toBe(MSG);
    expect(r.getByTestId('hint').props.className).toMatch(/(^|\s)text-danger(\s|$)/);
    expect(r.getByTestId('hint-row')).toBeTruthy();
  });

  it('a zero max: any amount is over it', () => {
    expect(overLimit(1n, 0n)).toBe(true);
    expect(overLimit(0n, 0n)).toBe(false);
    expect(overLimit(null, 0n)).toBe(false);
  });
});
```

Modify `src/screens/shielded/__tests__/privacyClaims.test.ts` — the new directory joins the scope. Replace `function screenSources()` with:

```ts
/** Shielded UX part B (spec §2 "Widened"): the shared components of the private side. */
const PRIVATE_COMPONENTS = path.join(ROOT, 'src/components/private');

function screenSources(): Array<{file: string; text: string}> {
  return [...walk(SCREENS), ...walk(PRIVATE_COMPONENTS), ...EXTRA_COPY].map(p => ({
    file: path.relative(ROOT, p),
    text: fs.readFileSync(p, 'utf8'),
  }));
}
```

and add `'src/components/private/DestinationRow.tsx',` to the positive control's `expect.arrayContaining([...])` list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/components/private src/screens/shielded/__tests__/privacyClaims.test.ts`
Expected: FAIL — `Cannot find module '../DetailsDisclosure'` (and the other two); the guard fails with `ENOENT … src/components/private`.

- [ ] **Step 3: Write the components**

Create `src/components/private/DetailsDisclosure.tsx`:

```tsx
import React, {useState} from 'react';
import {Pressable, View} from 'react-native';
import {Text} from '../ui';
import {DETAILS} from '../../copy/modes';

/**
 * "Details ▾" (Shielded UX part B, spec §3.2): the technical rows of a card, collapsed by default.
 * No persisted state — each mount starts collapsed. It never holds a warning or a blocking
 * condition (plan Review Focus 2): those stay outside it, always visible.
 */
export function DetailsDisclosure({testID, children}: {testID: string; children: React.ReactNode}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View testID={testID}>
      <Pressable
        testID={`${testID}-toggle`}
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        accessibilityLabel={DETAILS}
        accessibilityState={{expanded}}
        hitSlop={8}
        className="flex-row items-center min-h-touch-min mt-1">
        <Text variant="body-sm" className="text-fg-secondary">
          {`${DETAILS} ${expanded ? '▴' : '▾'}`}
        </Text>
      </Pressable>
      {expanded ? <View testID={`${testID}-body`}>{children}</View> : null}
    </View>
  );
}
```

Create `src/components/private/DestinationRow.tsx` (the option row is M1c's `DestinationRow` from `UnshieldSide.tsx`, moved here unchanged and renamed `OptionRow`):

```tsx
import React, {useState} from 'react';
import {Pressable, View} from 'react-native';
import {Check, Send, UserPlus, Wallet} from 'lucide-react-native';
import {Text} from '../ui';
import {cn} from '../../utils/cn';
import {
  CHANGE,
  DESTINATION_EXTERNAL,
  DESTINATION_EXTERNAL_SUB,
  DESTINATION_FRESH,
  DESTINATION_MAIN,
  RECOMMENDED,
  destinationSummary,
} from '../../copy/modes';

/**
 * The destination of Make public (Shielded UX part B, spec §3.3, decision B-5), replacing the three
 * cards of M1c's #16. Collapsed: "To: {selected} · Change" ("To: Choose a destination" while
 * nothing is chosen — owner decision A1). Change opens the three options with their one-line
 * descriptions; a pick closes them. The selected destination's warning (main / another address)
 * shows under the row whether it is open or not — never behind Change, never inside Details; the
 * fresh account's unavailable reason shows under the collapsed row (open, the option says it).
 *
 * Presentational: WHICH destinations are offered, what is preselected and every refusal rule stay
 * with M1c's code in `UnshieldSide.tsx` (`a0UnshieldDestinationOffer`, `externalOwnerProblem`).
 */

export type DestinationChoice = 'fresh' | 'main' | 'external';

export interface DestinationRowProps {
  testID: string;
  choice: DestinationChoice | null;
  onChoose: (c: DestinationChoice) => void;
  /** no quote yet: nothing can be chosen */
  disabled: boolean;
  /** the fresh account: whether it is offered, and its one-line description (or its unavailable reason) */
  fresh: {available: boolean; sub: string};
  mainSub: string;
  mainMono: boolean;
  /** the reason shown under the COLLAPSED row while the fresh account is unavailable (S9 / S11) */
  freshReason: string | null;
  /** the chosen destination's warning, always visible under the row */
  warning: {testID: string; text: string} | null;
  /** below the row (the "Another address" input) */
  children?: React.ReactNode;
}

function nameOf(choice: DestinationChoice | null): string | null {
  switch (choice) {
    case 'fresh':
      return `${DESTINATION_FRESH}${RECOMMENDED}`;
    case 'main':
      return DESTINATION_MAIN;
    case 'external':
      return DESTINATION_EXTERNAL;
    case null:
      return null;
  }
}

export function DestinationRow({
  testID,
  choice,
  onChoose,
  disabled,
  fresh,
  mainSub,
  mainMono,
  freshReason,
  warning,
  children,
}: DestinationRowProps) {
  const [open, setOpen] = useState(false);
  const pick = (c: DestinationChoice) => {
    onChoose(c);
    setOpen(false);
  };
  return (
    <View className="rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4" testID={testID}>
      <View className="flex-row items-center justify-between gap-3 min-h-touch-min">
        <Text variant="body-sm" className="flex-1 font-geist-semibold text-fg-primary" testID={`${testID}-summary`}>
          {destinationSummary(nameOf(choice))}
        </Text>
        <Pressable
          testID={`${testID}-change`}
          onPress={disabled ? undefined : () => setOpen(o => !o)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={CHANGE}
          accessibilityState={{disabled, expanded: open}}
          hitSlop={8}>
          <Text variant="body-sm" className={cn('font-geist-semibold', disabled ? 'text-fg-disabled' : 'text-accent-shielded')}>
            {CHANGE}
          </Text>
        </Pressable>
      </View>
      {freshReason !== null && !open ? (
        <Text variant="caption" className="text-fg-tertiary mt-1" testID={`${testID}-fresh-reason`}>
          {freshReason}
        </Text>
      ) : null}
      {warning ? (
        <Text variant="caption" className="text-warning mt-2" testID={warning.testID}>
          {warning.text}
        </Text>
      ) : null}
      {open ? (
        <View className="mt-3" testID={`${testID}-options`}>
          <OptionRow
            testID={`${testID}-fresh`}
            Icon={UserPlus}
            title={DESTINATION_FRESH}
            sub={fresh.sub}
            selected={choice === 'fresh'}
            disabled={disabled || !fresh.available}
            onPress={() => pick('fresh')}
          />
          <OptionRow
            testID={`${testID}-main`}
            Icon={Wallet}
            title={DESTINATION_MAIN}
            sub={mainSub}
            mono={mainMono}
            selected={choice === 'main'}
            disabled={disabled}
            onPress={() => pick('main')}
          />
          <OptionRow
            testID={`${testID}-external`}
            Icon={Send}
            title={DESTINATION_EXTERNAL}
            sub={DESTINATION_EXTERNAL_SUB}
            selected={choice === 'external'}
            disabled={disabled}
            onPress={() => pick('external')}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function OptionRow({
  testID,
  Icon,
  title,
  sub,
  mono,
  selected,
  disabled,
  onPress,
}: {
  testID: string;
  Icon: typeof Wallet;
  title: string;
  sub: string;
  mono?: boolean;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{selected, disabled}}
      className={cn(
        'flex-row items-start gap-3 p-3 rounded-md mb-2 min-h-touch-min border',
        selected ? 'border-accent-shielded bg-[rgba(91,227,194,0.08)]' : 'border-bg-surface-3',
        disabled && 'opacity-60',
      )}>
      <View className="w-8 h-8 rounded-pill items-center justify-center bg-bg-surface-2">
        <Icon size={16} color={disabled ? '#6E727A' : '#A8ACB5'} strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text variant="body-sm" className={cn('font-geist-semibold', disabled ? 'text-fg-disabled' : 'text-fg-primary')}>
          {title}
        </Text>
        <Text variant="caption" className={cn('text-fg-tertiary mt-0.5', mono && 'font-geist-mono')} testID={`${testID}-sub`}>
          {sub}
        </Text>
      </View>
      <View
        className={cn(
          'w-5 h-5 rounded-full items-center justify-center border mt-1',
          selected ? 'border-accent-shielded bg-accent-shielded' : 'border-fg-tertiary',
        )}>
        {selected ? <Check size={12} color="#0A0A0A" strokeWidth={2.5} /> : null}
      </View>
    </Pressable>
  );
}
```

Create `src/components/private/AmountLimitHint.tsx`:

```tsx
import React from 'react';
import {View} from 'react-native';
import {AlertTriangle} from 'lucide-react-native';
import {Text} from '../ui';

/** spec §3.4: over the limit only with an amount above `max` (MAX itself, exactly `max`, is allowed). BigInt. */
export function overLimit(amount: bigint | null, max: bigint): boolean {
  return amount !== null && amount > max;
}

/**
 * Nothing while the amount is at most `max`; above it, `message` in the danger tone (Shielded UX
 * part B, spec §3.4, decision B-4). The caller disables its CTA with `overLimit` — one rule, one
 * function. The message is the caller's (spec ambiguity A5): Make public passes `makePublicLimit`.
 */
export function AmountLimitHint({
  amount,
  max,
  message,
  testID,
}: {
  amount: bigint | null;
  max: bigint;
  message: string;
  testID: string;
}) {
  if (!overLimit(amount, max)) {
    return null;
  }
  return (
    <View className="flex-row items-center gap-2" testID={`${testID}-row`}>
      <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
      <Text variant="caption" className="text-danger" testID={testID}>
        {message}
      </Text>
    </View>
  );
}
```

Create `src/components/private/index.ts`:

```ts
export {DetailsDisclosure} from './DetailsDisclosure';
export {DestinationRow} from './DestinationRow';
export type {DestinationChoice, DestinationRowProps} from './DestinationRow';
export {AmountLimitHint, overLimit} from './AmountLimitHint';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/components/private src/copy src/screens/shielded/__tests__/privacyClaims.test.ts`
Expected: PASS (the new component files have no banned string, so the ratchet needs no line for them).

- [ ] **Step 5: Mutations (each must go red, then revert)**

1. `DetailsDisclosure`: `useState(false)` → `useState(true)` → the "collapsed by default" and "no persisted state" rows fail.
2. `AmountLimitHint.overLimit`: `amount > max` → `amount >= max` → the "exactly the max" row fails.
3. `DestinationRow`: move the `{warning ? … : null}` block inside `{open ? … : null}` → "the warning is always visible" fails.
4. `DestinationRow`: `disabled={disabled || !fresh.available}` → `disabled={disabled}` → the unavailable-fresh row fails.

- [ ] **Step 6: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: jest green; tsc 0; lint `✖ 144 problems (0 errors, 144 warnings)`; TGE check 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/private src/screens/shielded/__tests__/privacyClaims.test.ts
git commit -m "feat(shielded-ux-b): DetailsDisclosure, DestinationRow, AmountLimitHint (part B Task 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: #16 "Private ⇄ Public"

**Files:**
- Modify: `src/screens/shielded/ShieldUnshieldScreen.tsx` (whole file replaced below)
- Modify: `src/screens/shielded/shieldedParts.tsx` (add `BalanceRow`)
- Modify: `src/screens/shielded/unshield/UnshieldSide.tsx` (imports, render body — its preselection stays M1c's; M1c's internal `DestinationRow` removed — it now lives in `src/components/private/DestinationRow.tsx` as `OptionRow`)
- Modify: `src/screens/shielded/unshield/unshieldCopy.ts` (three #16 strings)
- Modify: `src/copy/__tests__/bannedWords.test.ts` (ratchet: three lines)
- Test: `src/screens/shielded/__tests__/ShieldUnshieldScreen.test.tsx`, `src/screens/shielded/unshield/__tests__/UnshieldSide.test.tsx`, `src/screens/shielded/__tests__/shieldedParts.test.tsx`

**Interfaces:**
- Consumes (Task 1): `MAKE_PRIVATE`, `MAKE_PUBLIC`, `PRIVATE_PUBLIC_TITLE`, `PRIVATE_BALANCE`, `PUBLIC_BALANCE`, `makePrivateCta`, `makePrivateCtaIdle`, `makePublicCta`, `makePublicCtaIdle`, `makePublicLimit`. (Task 2): `DetailsDisclosure`, `DestinationRow`, `AmountLimitHint`, `overLimit` from `src/components/private`.
- Produces: `BalanceRow({label, value, testID}: {label: string; value: string; testID: string})` in `src/screens/shielded/shieldedParts.tsx` (test ids `${testID}`, `${testID}-value`). Test ids on #16 that later tasks and the phone pass rely on: `shield-balance`, `shield-details`, `shield-over-max`, `unshield-vault` (now a `BalanceRow`; its value is `unshield-vault-value`), `unshield-details`, `unshield-dest` (+ `-summary`, `-change`, `-fresh`, `-main`, `-external`, `-fresh-reason`), `unshield-over-max`, `unshield-warning-main`, `unshield-warning-external`. Unchanged: `shield-cta`, `unshield-cta`, `shield-net`, `unshield-net`, `pool-notes`, `unshield-one-note`, `unshield-amount-line`, `unshield-relayed`, `unshield-no-note`, `shielded-line-pending`, `shielded-check-again`, `shielded-check-caption`, `shielded-refusal`, `shielded-retry`.

What changes on #16 (spec §4):
- the title is "Private ⇄ Public", the tabs come from the module;
- ONE balance line per tab (decision B-2): "Public balance" on Make private (was "Available"), "Private balance" on Make public (was "Vault balance"). The old "Shielded balance" line above the card is gone; what stays of it is the STATUS: the startup banners, the refusal, "X pending", its caption and "Check again";
- Make private: the fee card shows "You'll make private" and its total; Network fee, ZK proof fee, Deposit record rent and the pool-size row move into `DetailsDisclosure` (testID `shield-details`) — spec ambiguity A6 for the pool-size row;
- Make public: `DestinationRow` replaces the three cards (preselection unchanged from M1c: fresh when offered, otherwise nothing — "To: Choose a destination", owner decision A1); the fee card shows "Relayer fee" and "Destination receives" and the amount line; Network fee, ZK proof fee and the one-note explanation move into `DetailsDisclosure` (testID `unshield-details`); `AmountLimitHint` replaces "Max per unshield: …"; the withdraw banner keeps its title and the relayed sentence (the two destination warnings moved under the destination row);
- CTAs and their accessibility labels from the module.

- [ ] **Step 1: Write the failing tests — `shieldedParts.test.tsx`**

Append to `src/screens/shielded/__tests__/shieldedParts.test.tsx` (inside the file's top-level `describe`, or as a new `describe` after it):

```tsx
describe('BalanceRow (part B, decision B-2: #16\'s one balance line)', () => {
  it('UX-A 1 kept: label and value are separate elements in a row WITH A GAP; the value takes the rest, right-aligned; the label never shrinks', () => {
    const r = render(<BalanceRow label="Public balance" value="0.00498 TEST" testID="row" />);
    const row = r.getByTestId('row');
    expect(row.props.className).toMatch(/(^|\s)gap-\d/);
    const label = within(row).getByText('Public balance');
    const value = r.getByTestId('row-value');
    expect(value.props.children).toBe('0.00498 TEST');
    expect(value.props.className).toMatch(/(^|\s)flex-1(\s|$)/);
    expect(value.props.className).toMatch(/(^|\s)text-right(\s|$)/);
    expect(label.props.className).toMatch(/(^|\s)shrink-0(\s|$)/);
  });
});
```

and change its two imports to `import {render, within} from '@testing-library/react-native';` and `import {BalanceRow, ProofHeroRing, StageRow, shortSignature} from '../shieldedParts';`.

- [ ] **Step 2: Write the failing tests — `ShieldUnshieldScreen.test.tsx` (the Make private side)**

Replace the first test of `describe('#16 shield side — the design', …)` with:

```tsx
  it('idle: title, the "Make private" tab, ONE balance line ("Public balance" from the pool mint), MAX, "You\'ll make private", the fee rows behind Details, the disabled CTA', async () => {
    const r = screen();
    await waitFor(() => expect(mockPoolCount).toHaveBeenCalled());
    expect(r.getByText('Private ⇄ Public')).toBeTruthy(); // part B: "Shield / Unshield" → "Private ⇄ Public"
    expect(r.getByText('Make private')).toBeTruthy();
    expect(r.getByText('Public balance')).toBeTruthy(); // part B: "Available" → "Public balance"
    expect(r.getByTestId('shield-balance-value').props.children).toBe('2 TEST');
    expect(r.queryByText('Private balance')).toBeNull(); // decision B-2: one balance line per tab
    expect(r.getByLabelText('Max')).toBeTruthy();
    expect(r.getByText("You'll make private")).toBeTruthy(); // part B: "You'll shield" → "You'll make private"
    expect(r.queryByText('Network fee')).toBeNull(); // decision B-3: behind Details
    fireEvent.press(r.getByTestId('shield-details-toggle'));
    expect(r.getByText('Network fee')).toBeTruthy();
    expect(r.getByText('ZK proof fee')).toBeTruthy();
    expect(r.getByText('Deposit record rent')).toBeTruthy();
    expect(ctaDisabled(r)).toBe(true);
    expect(r.getByText('Make TEST private')).toBeTruthy(); // part B: "Shield TEST" → "Make TEST private"
    expect(r.getByTestId('shield-cta').props.accessibilityLabel).toBe('Make TEST private');
  });
```

In the second test (`amount entered: …`), open Details before the fee values and the pool count, and swap the CTA text:

```tsx
  it('amount entered: the fees are the A0 deposit costs (SOL, behind Details), "You\'ll make private" is the exact amount, the pool count is the chain number + 1', async () => {
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1.25');
    await waitFor(() => expect(mockPoolCount).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.press(r.getByTestId('shield-details-toggle'));
    await waitFor(() => expect(r.getByTestId('pool-notes')).toBeTruthy());
    expect(r.getByText('0.000005 SOL')).toBeTruthy();
    expect(r.getByText('None · made on this device')).toBeTruthy();
    expect(r.getByText('≈ 0.00069596 SOL')).toBeTruthy();
    expect(r.getByTestId('shield-net').props.children).toBe('1.25 TEST');
    expect(r.getByTestId('pool-notes').props.children).toBe('18');
    expect(r.getByText('Make 1.25 TEST private')).toBeTruthy(); // part B: "Shield 1.25 TEST" → "Make 1.25 TEST private"
    expect(r.queryByText(/USD/)).toBeNull(); // no price exists for the devnet test token
  });
```

In `insufficient: red helper with the max, CTA disabled`, after the existing `getByText('Insufficient balance · max 2 TEST')` line add `expect(r.getByTestId('shield-over-max').props.children).toBe('Insufficient balance · max 2 TEST'); // part B: through AmountLimitHint (A5)`.

Add, at the end of that `describe`:

```tsx
  it('Review Focus 2: the SOL-short warning and the honest deposit sentence stay visible with Details collapsed', () => {
    mockBalances = {tokenBalances: {[A0.mint]: '2000000000'}, solBalance: '700959'};
    const r = screen();
    expect(r.getByText(/Your main account signs this deposit\. The amount, the time and your address are public on chain/)).toBeTruthy();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1');
    expect(r.queryByTestId('shield-details-body')).toBeNull();
    expect(r.getByText(/Not enough SOL: this deposit needs about 0.00070096 SOL/)).toBeTruthy();
  });
```

Replace the three balance-line rows of `describe('#16 — gated on the A0 startup step', …)` (`ready: the shielded balance line with the pending sum`, `UX-A 1: the label and the value …`, `UX-A 1: "X pending" is its own Text …`) with:

```tsx
  it('ready: no private balance on the Make private tab (decision B-2), the pending sum is said', () => {
    mockView = {kind: 'ready', unspent: 1_500_000_000n, pending: 250_000_000n, notes: 2};
    const r = screen();
    expect(r.queryByText('Private balance')).toBeNull(); // part B: the "Shielded balance" line left this tab
    expect(r.queryByText('1.5 TEST')).toBeNull();
    expect(r.getByTestId('shielded-line-pending').props.children).toBe('0.25 TEST pending');
  });

  it('UX-A 1 kept: the one balance line is a BalanceRow (gap, the value right-aligned); "X pending" is its own Text outside it', () => {
    mockView = {kind: 'ready', unspent: 4_980_000n, pending: 1_000_000n, notes: 2};
    const r = screen();
    const row = r.getByTestId('shield-balance');
    expect(row.props.className).toMatch(/(^|\s)gap-\d/);
    expect(within(row).queryByTestId('shielded-line-pending')).toBeNull(); // not inside the row
    expect(r.getByTestId('shielded-line-pending').props.children).toBe('0.001 TEST pending');
  });

  it('ready, nothing pending, no note, no refusal: no status line at all', () => {
    const r = screen();
    expect(r.queryByTestId('shielded-line-pending')).toBeNull();
    expect(r.queryByTestId('shielded-check-caption')).toBeNull();
    expect(r.queryByTestId('shielded-refusal')).toBeNull();
  });
```

In the `it.each([...])('%s: a stated state, no balance figure, …')` table replace `/Restoring your shielded notes from the chain/` with `/Restoring your private balance from the chain/` (`// part B`); `/needs the on-device prover/` stays as it is (the new sentence is "Your private balance needs the on-device prover …"). In its body replace `expect(r.queryByText(/Shielded balance/)).toBeNull();` with `expect(r.queryByTestId('shielded-line-pending')).toBeNull(); // part B (review I-4): no figure of the private side in a non-ready state — a "Private balance" negative would be vacuous on this tab`.

In `it('re-review N-2: the last pending item decided → …')` (lines 267, 269, in `describe('#16 — gated on the A0 startup step', …)`) feed and expect the new caption: `'Not sent · your note is back in your private balance.'` (`// part B: the fixture follows the caption Task 4 ships`).

- [ ] **Step 3: Write the failing tests — `UnshieldSide.test.tsx` (the Make public side)**

Add helpers after `const text = …`:

```tsx
/** part B (spec §3.3): the options live behind "Change"; a pick closes them. */
const openDest = (r: R) => fireEvent.press(r.getByTestId('unshield-dest-change'));
const pick = (r: R, which: 'fresh' | 'main' | 'external') => {
  openDest(r);
  fireEvent.press(r.getByTestId(`unshield-dest-${which}`));
};
const summary = (r: R) => text(r, 'unshield-dest-summary');
```

Replace the bodies of three rows of `describe('#16 unshield — the design (states 2 and 5) and the A0 lines', …)`:

```tsx
  it('idle: ONE balance line ("Private balance"), the relayed copy, the relayer fee visible, the rest and the one-note limit behind Details, CTA "Make TEST public" disabled', async () => {
    const r = await screen();
    expect(r.getByText('Private balance')).toBeTruthy(); // part B: "Vault balance" → "Private balance"
    expect(text(r, 'unshield-vault-value')).toBe('2.5 TEST');
    expect(r.queryByText('Public balance')).toBeNull(); // decision B-2
    expect(text(r, 'unshield-relayed')).toBe(
      'The relayer pays for and submits this transaction, so no key of yours signs it. Amounts and timing are public.',
    );
    expect(r.getByText('Privacy decreases on public withdraw')).toBeTruthy();
    expect(r.getByText('Relayer fee')).toBeTruthy();
    expect(r.queryByText('ZK proof fee')).toBeNull(); // decision B-3: behind Details
    expect(r.queryByTestId('unshield-one-note')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-details-toggle'));
    expect(r.getByText('ZK proof fee')).toBeTruthy();
    expect(r.getByText('Network fee')).toBeTruthy();
    expect(text(r, 'unshield-one-note')).toBe(
      'You can make up to 1.99999 TEST public from one note at a time; combining notes comes in a later version.',
    ); // part B: "You can unshield up to" → "You can make up to … public"
    expect(r.getByText('Make TEST public')).toBeTruthy(); // part B: "Unshield TEST" → "Make TEST public"
    expect(r.getByTestId('unshield-cta').props.accessibilityLabel).toBe('Make TEST public');
    expect(disabled(r, 'unshield-cta')).toBe(true);
  });

  it('amount entered: the relayer fee (token), the exact amount line; the network fee paid by the relayer behind Details', async () => {
    const r = await screen();
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.25');
    expect(r.getByText('0.00001 TEST')).toBeTruthy();
    expect(text(r, 'unshield-net')).toBe('1.25 TEST');
    expect(text(r, 'unshield-amount-line')).toBe(
      'The destination receives exactly 1.25 TEST. The relayer fee of 0.00001 TEST comes out of your private balance.',
    ); // part B: "shielded balance" → "private balance"
    fireEvent.press(r.getByTestId('unshield-details-toggle'));
    expect(r.getByText('Paid by the relayer')).toBeTruthy();
    expect(r.getByText('None · made on this device')).toBeTruthy();
    expect(r.getByText('Make 1.25 TEST public')).toBeTruthy(); // part B: "Unshield 1.25 TEST" → "Make 1.25 TEST public"
    expect(disabled(r, 'unshield-cta')).toBe(false); // the fresh account is preselected
  });

  it('Review Focus 3: MAX = the largest note minus the fee, exact; exactly MAX → no hint, enabled; one base unit more → the hint, CTA disabled', async () => {
    const r = await screen();
    fireEvent.press(r.getByLabelText('Max'));
    expect(r.getByTestId('unshield-amount-input').props.value).toBe('1.99999');
    expect(r.queryByTestId('unshield-over-max')).toBeNull();
    expect(disabled(r, 'unshield-cta')).toBe(false);
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.999990001');
    expect(text(r, 'unshield-over-max')).toBe('You can make up to 1.99999 TEST public at once.'); // part B: AmountLimitHint
    expect(r.queryByTestId('unshield-details-body')).toBeNull(); // Review Focus 2: the hint is visible with Details collapsed
    expect(disabled(r, 'unshield-cta')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).not.toHaveBeenCalled();
  });
```

In `no note can pay the fee → said, …` replace the expected text with `'No private note can pay the relayer fee of 0.00001 TEST.'` (`// part B`). Add after it:

```tsx
  it('Review Focus 2: a refused quote, "no private note can pay" and the relayed sentence are all visible with Details collapsed', async () => {
    mockNotes = [note(10_000n, 1)];
    mockQuote.mockRejectedValueOnce(Object.assign(new Error('E_A0_QUOTE_FEE_PAYER: x'), {code: 'E_A0_QUOTE_FEE_PAYER'}));
    const r = await screen();
    expect(r.queryByTestId('unshield-details-body')).toBeNull();
    expect(r.getByText(/The relayer's quote was refused · E_A0_QUOTE_FEE_PAYER/)).toBeTruthy();
    expect(r.getByTestId('unshield-relayed')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('unshield-quote-retry'));
    });
    expect(text(r, 'unshield-no-note')).toBe('No private note can pay the relayer fee of 0.00001 TEST.');
    expect(r.queryByTestId('unshield-details-body')).toBeNull();
  });

  it.each([
    ['running', {kind: 'running'} as A0ShieldedView],
    ['idle', {kind: 'idle'} as A0ShieldedView],
    ['error', {kind: 'error', code: 'E_A0_SYNC_RPC', message: 'x'} as A0ShieldedView],
    ['unsupported', {kind: 'unsupported'} as A0ShieldedView],
  ])('review I-4: startup %s → the one balance line says "—", never a figure', async (_n, view) => {
    mockView = view;
    const r = await screen();
    expect(text(r, 'unshield-vault-value')).toBe('—');
  });
```

Replace the whole `describe('#16 unshield — the destination choice (undrawn; spec §11, S3 / S9 / S11, ruling 4)', …)` with:

```tsx
describe('#16 unshield — the destination row (part B, spec §3.3; M1c S3 / S9 / S11, ruling 4)', () => {
  it('a granting quote: collapsed "To: A new account (recommended) · Change"; the fresh account PRESELECTED with the §11 default and the grant in SOL', async () => {
    const r = await screen();
    expect(summary(r)).toBe('To: A new account (recommended)');
    expect(r.queryByTestId('unshield-dest-options')).toBeNull();
    openDest(r);
    expect(selected(r, 'unshield-dest-fresh')).toBe(true);
    expect(selected(r, 'unshield-dest-main')).toBe(false);
    expect(text(r, 'unshield-dest-fresh-sub')).toBe(
      'A new account of this wallet receives it. The relayer also sends it 0.003 SOL so it can pay for its own transactions.',
    );
  });

  it('Review Focus 1 / S11 (M1c\'s row, its assertions kept; owner decision A1): a quote WITHOUT a grant → "To: Choose a destination", the reason visible, fresh disabled, NOTHING preselected, the CTA disabled until a choice; main → its warning, then {kind: "main"} only on a tap', async () => {
    mockQuote.mockResolvedValue(quote({gasGrantLamports: null, grantFloorLamports: null}));
    const r = await screen();
    expect(summary(r)).toBe('To: Choose a destination'); // part B: the collapsed row (owner decision A1)
    expect(text(r, 'unshield-dest-fresh-reason')).toBe(
      'A new account is not available yet: the relayer cannot send it SOL for its own fees, and funding it from your other accounts would link them.',
    );
    openDest(r); // part B: the options sit behind Change
    expect(disabled(r, 'unshield-dest-fresh')).toBe(true);
    expect(text(r, 'unshield-dest-fresh-sub')).toBe(
      'A new account is not available yet: the relayer cannot send it SOL for its own fees, and funding it from your other accounts would link them.',
    );
    for (const id of ['unshield-dest-fresh', 'unshield-dest-main', 'unshield-dest-external']) {
      expect(selected(r, id)).toBe(false);
    }
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    expect(disabled(r, 'unshield-cta')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-dest-fresh')); // a tap on the disabled row selects nothing
    expect(selected(r, 'unshield-dest-fresh')).toBe(false);
    expect(r.queryByTestId('unshield-warning-main')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-dest-main'));
    expect(disabled(r, 'unshield-cta')).toBe(false);
    expect(text(r, 'unshield-warning-main')).toBe('This links your exit to your deposit: your main account made the deposit.');
    expect(onUnshield).not.toHaveBeenCalled(); // never sent without the tap
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'main'}, amount: '1000000000'});
  });

  it('S9 / Review Focus 1 (M1c\'s row, its assertions kept): a cli wallet → fresh disabled with the cli reason and not selected, nothing preselected, even when the quote grants', async () => {
    mockScheme = {kind: 'cli'};
    const r = await screen();
    expect(summary(r)).toBe('To: Choose a destination');
    expect(text(r, 'unshield-dest-fresh-reason')).toBe(
      'This wallet uses the Solana CLI key scheme, which has a single account, so no new account can be created for this exit.',
    );
    openDest(r);
    expect(disabled(r, 'unshield-dest-fresh')).toBe(true);
    expect(selected(r, 'unshield-dest-fresh')).toBe(false);
    expect(text(r, 'unshield-dest-fresh-sub')).toBe(
      'This wallet uses the Solana CLI key scheme, which has a single account, so no new account can be created for this exit.',
    );
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    expect(disabled(r, 'unshield-cta')).toBe(true);
  });

  it('"My main account" → the link warning (§11 verbatim) under the row and the main address in its option; the request carries {kind: "main"}', async () => {
    const r = await screen();
    expect(r.queryByTestId('unshield-warning-main')).toBeNull();
    pick(r, 'main');
    expect(summary(r)).toBe('To: My main account');
    expect(text(r, 'unshield-warning-main')).toBe('This links your exit to your deposit: your main account made the deposit.');
    openDest(r);
    expect(text(r, 'unshield-dest-main-sub')).toBe(`${MAIN.slice(0, 6)}…${MAIN.slice(-6)}`);
    fireEvent.press(r.getByTestId('unshield-dest-main'));
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '0.5');
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'main'}, amount: '500000000'});
  });

  it('UX-A 2: the "Another address" input shows the WHOLE address — multiline (2 lines), monospace; Enter submits instead of breaking the line', async () => {
    const r = await screen();
    pick(r, 'external');
    const input = r.getByTestId('unshield-external-input');
    expect(input.props.multiline).toBe(true);
    expect(input.props.numberOfLines).toBe(2);
    expect(input.props.className).toMatch(/(^|\s)font-geist-mono(\s|$)/);
    expect(input.props.submitBehavior).toBe('blurAndSubmit');
    fireEvent.changeText(input, OTHER);
    expect(r.getByTestId('unshield-external-input').props.value).toBe(OTHER);
  });

  it('"Another address" → the payment warning (one word swapped) under the row, the input; a valid wallet address → {kind: "external", owner}', async () => {
    const r = await screen();
    pick(r, 'external');
    expect(summary(r)).toBe('To: Another address');
    expect(text(r, 'unshield-warning-external')).toBe('This is a payment from your private balance. The recipient sees the amount.'); // part B: "shielded balance" → "private balance"
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.000000001');
    expect(disabled(r, 'unshield-cta')).toBe(true); // no address yet
    fireEvent.changeText(r.getByTestId('unshield-external-input'), `  ${OTHER} `);
    expect(r.queryByTestId('unshield-external-problem')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'external', owner: OTHER}, amount: '1000000001'});
  });

  it.each([
    ['not base58', 'not-an-address', 'Not a Solana address.'],
    ['off the curve (a PDA)', OFF_CURVE, 'Not a wallet address (a program or token account cannot receive here).'],
    ['the main account', MAIN, 'This is your main account: choose "My main account" instead.'],
  ])('"Another address" refuses %s: the helper, CTA disabled', async (_n, addr, helper) => {
    const r = await screen();
    pick(r, 'external');
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    fireEvent.changeText(r.getByTestId('unshield-external-input'), addr);
    expect(text(r, 'unshield-external-problem')).toBe(helper);
    expect(disabled(r, 'unshield-cta')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).not.toHaveBeenCalled();
  });

  it('the preselection happens once: the user\'s own pick survives every later render (and a quote that arrives after a Retry still preselects)', async () => {
    mockQuote.mockRejectedValueOnce(Object.assign(new Error('E_A0_QUOTE_UNAVAILABLE: no answer'), {code: 'E_A0_QUOTE_UNAVAILABLE'}));
    const r = await screen();
    expect(summary(r)).toBe('To: Choose a destination'); // no quote, no offer
    expect(disabled(r, 'unshield-dest-change')).toBe(true);
    await act(async () => {
      fireEvent.press(r.getByTestId('unshield-quote-retry'));
    });
    expect(summary(r)).toBe('To: A new account (recommended)');
    pick(r, 'main');
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1'); // re-renders
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.5');
    expect(summary(r)).toBe('To: My main account');
  });
});
```

In `describe('#16 unshield — the quote', …)` → `refused → its code, …`: replace `expect(disabled(r, 'unshield-dest-main')).toBe(true);` with `expect(disabled(r, 'unshield-dest-change')).toBe(true); // part B: the options sit behind Change, disabled without a quote`.

In `describe('#16 unshield — the CTA …')` → the `it.each` over the startup states: replace `expect(selected(r, 'unshield-dest-fresh')).toBe(true);` with `expect(summary(r)).toBe('To: A new account (recommended)'); // part B: read from the collapsed row`.

In `describe('#16 — the direction tabs …')` → the first row: after `expect(r.getByText('Make public')).toBeTruthy();` add `expect(r.getByText('Private ⇄ Public')).toBeTruthy(); // part B`.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx jest src/screens/shielded/__tests__/ShieldUnshieldScreen.test.tsx src/screens/shielded/unshield/__tests__/UnshieldSide.test.tsx src/screens/shielded/__tests__/shieldedParts.test.tsx`
Expected: FAIL — `BalanceRow` is not exported; "Private ⇄ Public" not found; `shield-details-toggle` / `unshield-dest-change` not found.

- [ ] **Step 5: Add `BalanceRow` to `shieldedParts.tsx`**

Append to `src/screens/shielded/shieldedParts.tsx`:

```tsx
/**
 * #16's one balance line (Shielded UX part B, decision B-2): "Public balance" on Make private,
 * "Private balance" on Make public. UX-A 1's layout: the label keeps its width, the value takes the
 * rest of the row, right-aligned, and wraps rather than running into the label.
 */
export function BalanceRow({label, value, testID}: {label: string; value: string; testID: string}) {
  return (
    <View className="flex-row items-start justify-between gap-3 mb-3" testID={testID}>
      <Text variant="body-sm" className="text-fg-secondary shrink-0">
        {label}
      </Text>
      <Text variant="body-sm" numeral className="flex-1 text-right font-geist-semibold text-fg-primary" testID={`${testID}-value`}>
        {value}
      </Text>
    </View>
  );
}
```

- [ ] **Step 6: Replace `src/screens/shielded/ShieldUnshieldScreen.tsx`**

Write the whole file:

```tsx
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, TextInput, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ShieldCheck, AlertTriangle, Shield, RefreshCw, Eye} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {AmountLimitHint, DetailsDisclosure, overLimit} from '../../components/private';
import {useWalletStore} from '../../store/zustand/walletStore';
import {cn} from '../../utils/cn';
import {parseTokenAmount, formatTokenAmount, groupInteger} from '../../utils/parseTokenAmount';
import {
  A0_TOKEN,
  A0_DEPOSIT_FEE_LAMPORTS,
  A0_RHO_MARKER_RENT_LAMPORTS,
  SOL_DECIMALS,
  displayAmount,
} from '../../modules/shielded/a0/screenSupport';
import {readA0PoolNoteCount} from '../../modules/shielded/a0/poolSize';
import {getConnection} from '../../modules/solana/connection';
import {useA0Shielded, retryA0Startup} from '../../hooks/useA0Shielded';
import type {A0CheckAgain, A0ShieldedView} from '../../hooks/useA0Shielded';
import {CheckAgainLink} from '../../components/CheckAgainLink';
import {UnshieldSide} from './unshield/UnshieldSide';
import {a0RefusalLoudText} from './unshield/unshieldCopy';
import {BalanceRow} from './shieldedParts';
import {
  MAKE_PRIVATE,
  MAKE_PUBLIC,
  PRIVATE_PUBLIC_TITLE,
  PUBLIC_BALANCE,
  makePrivateCta,
  makePrivateCtaIdle,
} from '../../copy/modes';
import type {A0VerifyRefusal} from '../../modules/shielded/a0/landedVerifier';
import type {A0UnshieldDestination} from '../../modules/shielded/a0/unshieldFlow';

/**
 * #16 "Private ⇄ Public" — mirror /home/user/Downloads/index.html §s16 (+ screen.md #16): both
 * sides on the A0 pool (spec §5 step 1, §6 steps 1–2, §11).
 *
 * Shielded UX part B (spec 2026-11-20 §4): one vocabulary (`src/copy/modes.ts`); ONE balance line
 * per tab (decision B-2) — "Public balance" here, "Private balance" on Make public — so the old
 * private balance line above the card is now only the STATUS (the startup states, a refusal, the
 * pending sum and "Check again"); the technical fee rows and the pool-size row behind "Details ▾"
 * (decision B-3); the limit through `AmountLimitHint` (decision B-4).
 *
 * THE MAKE PUBLIC SIDE (M1c Task 8): the "Make public" tab and `./unshield/UnshieldSide.tsx`. The
 * route exists only in the devnet build and no deep link opens this side: `noctura://deposit`
 * opens "Make private" whatever its query says (`deepLinkConfig` pins `direction`; the Navigator
 * honours `initialDirection: 'public'` only on a route in-app navigation created — fix round 1,
 * I-1). The direction tabs flip the sub-region and push no route (the design).
 *
 * THE FEES ARE WHAT THE A0 DEPOSIT COSTS: the network fee (one signature, 0.000005 SOL), the ZK
 * proof fee — none: the proof is made on this device — and the rent of the deposit's rho marker
 * account. All three are SOL; the token amount moves exactly ("You'll make private" = the amount).
 *
 * Deviations from the design, said loudly: no USD lines (the devnet test token has no price); the
 * pool-size line is the pool's note count read from the chain, a number without the 5-bar meter
 * (spec I4: a measure, not a yes/no), now inside Details; the token chip is the pool's single
 * token, not a selector. The amount is BigInt end to end (cardinal rule 2).
 */

interface ShieldUnshieldScreenProps {
  onBack: () => void;
  /** CTA → #18 with the amount in base units */
  onShield: (amountBaseUnits: string) => void;
  /** the Make public CTA → its run (#18 → #21), the amount in base units */
  onUnshield?: (request: {destination: A0UnshieldDestination; amount: string}) => void;
  /** which side opens (default "Make private") */
  initialDirection?: 'private' | 'public';
  /** changes each time the screen regains focus (the Make public CTA's tap-disable ends there) */
  focusKey?: number;
}

type Direction = 'private' | 'public';

const SOL_NEEDED = A0_DEPOSIT_FEE_LAMPORTS + A0_RHO_MARKER_RENT_LAMPORTS;

function safeBigInt(v: string | undefined): bigint {
  try {
    return v ? BigInt(v) : 0n;
  } catch {
    return 0n;
  }
}

type Parsed = {kind: 'empty'} | {kind: 'invalid'} | {kind: 'ok'; units: bigint};

function parseAmount(text: string): Parsed {
  if (text.trim() === '') return {kind: 'empty'};
  try {
    const units = parseTokenAmount(text, A0_TOKEN.decimals);
    return units > 0n ? {kind: 'ok', units} : {kind: 'invalid'};
  } catch {
    return {kind: 'invalid'};
  }
}

export function ShieldUnshieldScreen({onBack, onShield, onUnshield, initialDirection, focusKey}: ShieldUnshieldScreenProps) {
  const {tokenBalances, solBalance} = useWalletStore();
  const [direction, setDirection] = useState<Direction>(initialDirection === 'public' ? 'public' : 'private');
  const {view, checkAgain, refusal} = useA0Shielded();
  const [amount, setAmount] = useState('');
  const [poolNotes, setPoolNotes] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const lastTapRef = useRef(0);

  const available = safeBigInt(tokenBalances[A0_TOKEN.mint]);
  const sol = safeBigInt(solBalance);

  useEffect(() => {
    let alive = true;
    readA0PoolNoteCount(getConnection())
      .then(r => {
        if (alive && r.status === 'ok') setPoolNotes(r.count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const parsed = parseAmount(amount);
  const hasAmount = parsed.kind === 'ok';
  const units = parsed.kind === 'ok' ? parsed.units : 0n;
  const insufficient = overLimit(hasAmount ? units : null, available);
  const solShort = sol < SOL_NEEDED;
  const ready = view.kind === 'ready';
  const canSubmit = ready && hasAmount && !insufficient && !solShort;

  const handleMax = useCallback(() => {
    if (available <= 0n) return;
    setAmount(formatTokenAmount(available, A0_TOKEN.decimals));
  }, [available]);

  const handleSubmit = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return; // cardinal rule 6
    lastTapRef.current = now;
    if (!canSubmit) return;
    onShield(units.toString());
  }, [canSubmit, onShield, units]);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryError(null);
    const s = await retryA0Startup();
    // final review M-4: the code and a fixed sentence; the raw message only without a code
    if (s.phase === 'error') setRetryError(s.code ? `${s.code} · Retry again in a moment.` : s.message);
    setRetrying(false);
  }, [retrying]);

  const sym = A0_TOKEN.symbol;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <Text variant="h2" className="ml-1 flex-1">
          {PRIVATE_PUBLIC_TITLE}
        </Text>
        <Text variant="caption" className="text-fg-tertiary">
          {sym}
        </Text>
      </View>

      {/* Direction tabs (the design): they flip the sub-region, no route is pushed */}
      <View className="px-5 mb-4">
        <View className="flex-row bg-bg-surface-2 rounded-pill p-1">
          <DirTab label={MAKE_PRIVATE} Icon={ShieldCheck} active={direction === 'private'} onPress={() => setDirection('private')} />
          <DirTab label={MAKE_PUBLIC} Icon={Eye} active={direction === 'public'} onPress={() => setDirection('public')} />
        </View>
      </View>

      {direction === 'public' ? (
        <UnshieldSide
          view={view}
          focusKey={focusKey}
          onUnshield={r => onUnshield?.(r)}
          shieldedLine={
            <ShieldedLine view={view} retrying={retrying} retryError={retryError} onRetry={handleRetry} checkAgain={checkAgain} refusal={refusal} />
          }
        />
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-6"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ShieldedLine view={view} retrying={retrying} retryError={retryError} onRetry={handleRetry} checkAgain={checkAgain} refusal={refusal} />

            {/* Amount card — its one balance line is the PUBLIC balance (decision B-2) */}
            <View
              className={cn(
                'rounded-lg bg-bg-surface-1 border p-5 mb-4',
                insufficient ? 'border-danger' : 'border-bg-surface-3',
              )}>
              <BalanceRow label={PUBLIC_BALANCE} value={`${displayAmount(available, A0_TOKEN.decimals)} ${sym}`} testID="shield-balance" />
              {/* UX-A 3 (the design's .amount-line: baseline, gap 8, centred): the input is sized to
                  its content — no min width — so the symbol sits right after the figure */}
              <View className="flex-row items-baseline justify-center gap-2 mb-3" testID="shield-amount-row">
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor="#6E727A"
                  keyboardType="decimal-pad"
                  accessibilityLabel="Amount"
                  testID="shield-amount-input"
                  className={cn('font-geist text-balance-xl shrink p-0', insufficient ? 'text-danger' : 'text-fg-primary')}
                />
                <Text
                  variant="h2"
                  className={cn(insufficient ? 'text-danger' : 'text-fg-secondary')}
                  testID="shield-amount-symbol">
                  {sym}
                </Text>
              </View>
              <View className="items-center">
                {insufficient ? (
                  <AmountLimitHint
                    amount={hasAmount ? units : null}
                    max={available}
                    message={`Insufficient balance · max ${displayAmount(available, A0_TOKEN.decimals)} ${sym}`}
                    testID="shield-over-max"
                  />
                ) : parsed.kind === 'invalid' ? (
                  <Text variant="caption" className="text-danger">
                    {`Enter an amount of ${sym} (up to ${A0_TOKEN.decimals} decimals)`}
                  </Text>
                ) : hasAmount ? null : (
                  <Pressable
                    onPress={handleMax}
                    accessibilityRole="button"
                    accessibilityLabel="Max"
                    disabled={available <= 0n}
                    className={cn(
                      'px-3 py-1.5 rounded-pill',
                      available > 0n ? 'bg-[rgba(91,227,194,0.16)] active:opacity-80' : 'bg-bg-surface-3',
                    )}>
                    <Text
                      variant="overline"
                      className={available > 0n ? 'text-accent-shielded' : 'text-fg-disabled'}>
                      MAX
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Fees card — the total visible; the rows behind Details (decision B-3) */}
            <View
              className={cn(
                'rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4',
                insufficient && 'opacity-50',
              )}>
              <Text variant="overline" className="mb-3">
                Fees
              </Text>
              <View className="flex-row items-center justify-between">
                <Text variant="body-sm" className="text-fg-secondary">
                  You'll make private
                </Text>
                <Text variant="balance-md" numeral className="text-fg-primary" testID="shield-net">
                  {`${hasAmount && !insufficient ? displayAmount(units, A0_TOKEN.decimals) : '—'} ${sym}`}
                </Text>
              </View>
              <DetailsDisclosure testID="shield-details">
                <View className="h-px bg-bg-surface-3 my-3" />
                <FeeRow
                  label="Network fee"
                  value={hasAmount ? `${formatTokenAmount(A0_DEPOSIT_FEE_LAMPORTS, SOL_DECIMALS)} SOL` : '—'}
                />
                <FeeRow label="ZK proof fee" value={hasAmount ? 'None · made on this device' : '—'} zk />
                <FeeRow
                  label="Deposit record rent"
                  value={hasAmount ? `≈ ${formatTokenAmount(A0_RHO_MARKER_RENT_LAMPORTS, SOL_DECIMALS)} SOL` : '—'}
                />
                {/* The pool's size — a number, never a yes/no (spec I4); a technical row (ambiguity A6) */}
                {hasAmount && !insufficient && poolNotes !== null ? (
                  <View className="flex-row items-center justify-between mt-1">
                    <Text variant="body-sm" className="text-fg-secondary">
                      Notes in the pool after this deposit
                    </Text>
                    <Text variant="body-sm" numeral className="text-accent-shielded font-geist-semibold" testID="pool-notes">
                      {groupInteger(String(poolNotes + 1))}
                    </Text>
                  </View>
                ) : null}
              </DetailsDisclosure>
            </View>

            {solShort ? (
              <View className="rounded-md bg-bg-surface-2 border-l-2 border-l-warning p-4 mb-4 flex-row gap-3">
                <AlertTriangle size={16} color="#F2B53B" strokeWidth={1.75} />
                <Text variant="caption" className="flex-1 text-fg-secondary">
                  {`Not enough SOL: this deposit needs about ${formatTokenAmount(SOL_NEEDED, SOL_DECIMALS)} SOL for the network fee and the deposit record.`}
                </Text>
              </View>
            ) : null}

            {!hasAmount ? (
              <Text variant="caption" className="text-fg-tertiary text-center px-2 mt-1">
                Your main account signs this deposit. The amount, the time and your address are public on chain, and a later withdrawal to this wallet can be linked to it.
              </Text>
            ) : null}
          </ScrollView>

          {/* Sticky CTA */}
          <View className="px-6 pb-8 pt-2 border-t border-bg-surface-2 bg-bg-base">
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{disabled: !canSubmit}}
              testID="shield-cta"
              accessibilityLabel={makePrivateCtaIdle(sym)}
              className={cn(
                'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
                canSubmit ? 'bg-accent-shielded active:opacity-90' : 'bg-bg-surface-3',
              )}>
              <Shield
                size={18}
                color={canSubmit ? '#0A0A0A' : '#6E727A'}
                strokeWidth={2}
                fill={canSubmit ? '#0A0A0A' : 'transparent'}
              />
              <Text
                variant="body-lg"
                className={cn('font-geist-semibold', canSubmit ? 'text-bg-base' : 'text-fg-disabled')}>
                {canSubmit ? makePrivateCta(displayAmount(units, A0_TOKEN.decimals), sym) : makePrivateCtaIdle(sym)}
              </Text>
            </Pressable>
          </View>
        </>
      )}

    </SafeAreaView>
  );
}

// ── Direction tab (the design's two-tab pill) ─────────────────────────────────

function DirTab({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: typeof ShieldCheck;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{selected: active}}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-2 py-2 rounded-pill min-h-touch-min',
        active && 'bg-accent-shielded',
      )}>
      <Icon size={16} color={active ? '#0A0A0A' : '#A8ACB5'} strokeWidth={1.75} />
      <Text variant="body-sm" className={cn('font-geist-semibold', active ? 'text-bg-base' : 'text-fg-secondary')}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── The private side's STATUS (undrawn: the A0 startup states, a refusal, the pending sum) ─────

function ShieldedLine({
  view,
  retrying,
  retryError,
  onRetry,
  checkAgain,
  refusal,
}: {
  view: A0ShieldedView;
  retrying: boolean;
  retryError: string | null;
  onRetry: () => void;
  checkAgain: A0CheckAgain;
  /** final review I-1: a verifier refusal of a landed unshield found this session (undrawn) */
  refusal?: A0VerifyRefusal | null;
}) {
  const sym = A0_TOKEN.symbol;
  if (view.kind === 'ready') {
    // part B, decision B-2: the balance figure is each tab's BalanceRow; this is only the status
    if (!refusal && view.pending === 0n && !checkAgain.note) {
      return null;
    }
    return (
      <View className="px-1 mb-3">
        {refusal ? (
          <Banner tone="danger" testID="shielded-refusal">
            {a0RefusalLoudText(refusal)}
          </Banner>
        ) : null}
        {view.pending > 0n ? (
          <Text variant="caption" numeral className="text-fg-secondary" testID="shielded-line-pending">
            {`${displayAmount(view.pending, A0_TOKEN.decimals)} ${sym} pending`}
          </Text>
        ) : null}
        {view.pending > 0n ? (
          <View className="flex-row items-center justify-between mt-1">
            <Text variant="caption" className="text-warning flex-1">
              {checkAgain.note ?? 'Pending · not confirmed yet'}
            </Text>
            <CheckAgainLink checkAgain={checkAgain} testID="shielded-check-again" />
          </View>
        ) : checkAgain.note ? (
          // re-review N-2: the last pending item was decided — the check's caption stays, without the link
          <Text variant="caption" className="text-fg-tertiary mt-1" testID="shielded-check-caption">
            {checkAgain.note}
          </Text>
        ) : null}
      </View>
    );
  }
  if (view.kind === 'running') {
    return (
      <Banner tone="info" testID="shielded-line">
        Restoring your private balance from the chain. Make private is available when it finishes.
      </Banner>
    );
  }
  if (view.kind === 'unsupported') {
    return (
      <Banner tone="warn" testID="shielded-line">
        Your private balance needs the on-device prover, which this device does not have (64-bit ARM phones only).
      </Banner>
    );
  }
  const head =
    view.kind === 'error'
      ? `Your private balance could not be restored · ${view.code ?? 'error'}`
      : 'Your private balance is not loaded yet.';
  return (
    <Banner tone={view.kind === 'error' ? 'danger' : 'warn'} testID="shielded-line">
      {head}
      {view.kind === 'error' && view.code === null ? `\n${view.message}` : ''}
      {retryError ? `\n${retryError}` : ''}
      {'\n'}
      <Text
        variant="body-sm"
        className="text-accent-shielded font-geist-semibold"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry restoring your private balance"
        testID="shielded-retry">
        {retrying ? 'Retrying…' : 'Retry'}
      </Text>
    </Banner>
  );
}

function Banner({
  tone,
  children,
  testID,
}: {
  tone: 'info' | 'warn' | 'danger';
  children: React.ReactNode;
  testID?: string;
}) {
  const border = tone === 'danger' ? 'border-l-danger' : tone === 'warn' ? 'border-l-warning' : 'border-l-accent-shielded';
  const Icon = tone === 'info' ? RefreshCw : AlertTriangle;
  const color = tone === 'danger' ? '#FF5C6A' : tone === 'warn' ? '#F2B53B' : '#5BE3C2';
  return (
    <View className={cn('rounded-md bg-bg-surface-2 border-l-2 p-4 mb-4 flex-row gap-3', border)} testID={testID}>
      <Icon size={16} color={color} strokeWidth={1.75} />
      <Text variant="caption" className="flex-1 text-fg-secondary">
        {children}
      </Text>
    </View>
  );
}

// ── Fee row ─────────────────────────────────────────────────────────────────

function FeeRow({label, value, zk}: {label: string; value: string; zk?: boolean}) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center gap-2 flex-1">
        {zk ? (
          <View className="w-5 h-5 rounded-pill items-center justify-center bg-[rgba(91,227,194,0.16)]">
            <Shield size={12} color="#5BE3C2" strokeWidth={2} />
          </View>
        ) : null}
        <Text variant="body-sm" className={cn(zk ? 'text-accent-shielded' : 'text-fg-secondary')}>
          {label}
        </Text>
      </View>
      <Text variant="body-sm" numeral className="text-fg-primary">
        {value}
      </Text>
    </View>
  );
}
```

- [ ] **Step 7: Change the three #16 strings in `unshieldCopy.ts`**

In `src/screens/shielded/unshield/unshieldCopy.ts`:

```ts
/** "Another address" (§11; part B swaps one word: the honest meaning is unchanged). */
export const A0_EXTERNAL_WARNING = 'This is a payment from your private balance. The recipient sees the amount.';

/** The amount line (§11; the token's symbol for "NOC"; part B: one word swapped). */
export function a0AmountLine(amount: bigint, fee: bigint, decimals: number, symbol: string): string {
  return `The destination receives exactly ${displayAmount(amount, decimals)} ${symbol}. The relayer fee of ${displayAmount(fee, decimals)} ${symbol} comes out of your private balance.`;
}

/** The one-note limit (§11; part B: in #16's Details, the new vocabulary). */
export function a0OneNoteLimit(max: bigint, decimals: number, symbol: string): string {
  return `You can make up to ${displayAmount(max, decimals)} ${symbol} public from one note at a time; combining notes comes in a later version.`;
}
```

- [ ] **Step 8: Rewrite the Make public side in `UnshieldSide.tsx`**

8a. Replace the import block (lines 1–27) with:

```tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View, Pressable, TextInput, ScrollView} from 'react-native';
import {PublicKey} from '@solana/web3.js';
import {AlertTriangle, RefreshCw, Shield} from 'lucide-react-native';
import {Text} from '../../../components/ui';
import {AmountLimitHint, DestinationRow, DetailsDisclosure, overLimit} from '../../../components/private';
import {cn} from '../../../utils/cn';
import {parseTokenAmount, formatTokenAmount} from '../../../utils/parseTokenAmount';
import {A0_TOKEN, a0ErrorText, displayAmount} from '../../../modules/shielded/a0/screenSupport';
import {fetchA0RelayerQuote} from '../../../modules/shielded/a0/relayerClient';
import type {A0RelayerQuote} from '../../../modules/shielded/a0/relayerClient';
import {a0UnshieldDestinationOffer, a0UnshieldSource} from '../../../modules/shielded/a0/unshieldFlow';
import type {A0UnshieldDestination, A0UnshieldSource} from '../../../modules/shielded/a0/unshieldFlow';
import {loadA0NoteStore} from '../../../modules/shielded/a0/noteStore';
import {loadTransparentScheme} from '../../../modules/keyDerivation/derivationScheme';
import type {TransparentScheme} from '../../../modules/keyDerivation/transparent';
import {getConnection} from '../../../modules/solana/connection';
import {useWalletStore} from '../../../store/zustand/walletStore';
import type {A0ShieldedView} from '../../../hooks/useA0Shielded';
import {BalanceRow} from '../shieldedParts';
import {PRIVATE_BALANCE, makePublicCta, makePublicCtaIdle, makePublicLimit} from '../../../copy/modes';
import {
  A0_EXTERNAL_WARNING,
  A0_FRESH_UNAVAILABLE_COPY,
  A0_MAIN_ACCOUNT_WARNING,
  A0_RELAYED_COPY,
  a0AmountLine,
  a0FreshDefaultCopy,
  a0OneNoteLimit,
} from './unshieldCopy';
```

8b. In the file's doc comment, after the paragraph that ends "… the one-note limit line and the amount line.", add:

```
 *
 * Shielded UX part B (spec 2026-11-20 §3–§4): one balance line ("Private balance", decision B-2);
 * `DestinationRow` replaces the three cards (decision B-5) — when the fresh account is not offered
 * (S9 cli, S11 no grant) NOTHING is preselected, as M1c ruled ("To: Choose a destination"; owner
 * decision 2026-11-20, plan A1), and a chosen destination's warning shows under the row; the network fee, the ZK proof fee and the one-note explanation behind
 * "Details ▾" (decision B-3); `AmountLimitHint` above the max (decision B-4).
```

8c. Replace `export type UnshieldChoice = 'fresh' | 'main' | 'external';` with:

```tsx
export type UnshieldChoice = DestinationChoice;
```

and add `import type {DestinationChoice} from '../../../components/private';` to the imports.

8d. The preselection effect stays M1c's, unchanged (owner decision A1) — shown here so the reviewer can check nothing moved:

```tsx
  // S11 / controller ruling 4: the fresh account is preselected when the quote grants SOL; the
  // preselection happens once (a later re-fetch never overrides the user's own pick).
  useEffect(() => {
    if (offer && !preselectedRef.current) {
      preselectedRef.current = true;
      if (offer.preselected !== null) setChoice(offer.preselected);
    }
  }, [offer]);
```

8e. Replace `const overMax = hasAmount && source !== null && units > max;` with:

```tsx
  const overMax = overLimit(hasAmount && source !== null ? units : null, max);
```

8f. Replace everything from `return (` in `UnshieldSide` to the end of the file (the render body, M1c's internal `DestinationRow`, `Note`, `FeeRow`) with:

```tsx
  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {shieldedLine}

        {quote.kind === 'loading' ? (
          <Note tone="info" testID="unshield-quote">
            Asking the relayer for its fee…
          </Note>
        ) : quote.kind === 'error' ? (
          <Note tone="danger" testID="unshield-quote">
            {`The relayer's quote was refused · ${quote.code ?? 'error'}\n${quote.code ? 'Ask the relayer again in a moment.' : quote.message}\n`}
            <Text
              variant="body-sm"
              className="text-accent-shielded font-geist-semibold"
              onPress={() => setAttempt(a => a + 1)}
              accessibilityRole="button"
              accessibilityLabel="Ask the relayer again"
              testID="unshield-quote-retry"
            >
              Retry
            </Text>
          </Note>
        ) : null}
        {notesError ? (
          <Note tone="danger" testID="unshield-notes-error">
            {`Your private balance could not be read · ${notesError}`}
          </Note>
        ) : null}

        {/* Amount card — its one balance line is the PRIVATE balance (decision B-2) */}
        <View
          className={cn(
            'rounded-lg bg-bg-surface-1 border p-5 mb-4',
            overMax ? 'border-danger' : 'border-bg-surface-3',
          )}
        >
          <BalanceRow
            label={PRIVATE_BALANCE}
            value={vault === null ? '—' : `${displayAmount(vault, A0_TOKEN.decimals)} ${sym}`}
            testID="unshield-vault"
          />
          {/* UX-A 3 (the design's .amount-line: baseline, gap 8, centred): the input is sized to its
              content — no min width — so the symbol sits right after the figure */}
          <View className="flex-row items-baseline justify-center gap-2 mb-3" testID="unshield-amount-row">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#6E727A"
              keyboardType="decimal-pad"
              accessibilityLabel="Amount"
              testID="unshield-amount-input"
              className={cn('font-geist text-balance-xl shrink p-0', overMax ? 'text-danger' : 'text-fg-primary')}
            />
            <Text variant="h2" className={cn(overMax ? 'text-danger' : 'text-fg-secondary')} testID="unshield-amount-symbol">
              {sym}
            </Text>
          </View>
          <View className="items-center">
            {overMax ? (
              <AmountLimitHint
                amount={hasAmount && source !== null ? units : null}
                max={max}
                message={makePublicLimit(displayAmount(max, A0_TOKEN.decimals), sym)}
                testID="unshield-over-max"
              />
            ) : parsed.kind === 'invalid' ? (
              <Text variant="caption" className="text-danger">
                {`Enter an amount of ${sym} (up to ${A0_TOKEN.decimals} decimals)`}
              </Text>
            ) : hasAmount ? null : (
              <Pressable
                onPress={handleMax}
                accessibilityRole="button"
                accessibilityLabel="Max"
                disabled={max <= 0n}
                className={cn(
                  'px-3 py-1.5 rounded-pill',
                  max > 0n ? 'bg-accent-transparent-tint active:opacity-80' : 'bg-bg-surface-3',
                )}
              >
                <Text variant="overline" className={max > 0n ? 'text-accent-transparent' : 'text-fg-disabled'}>
                  MAX
                </Text>
              </Pressable>
            )}
          </View>
          {source === null && ready && q !== null && notesError === null ? (
            <Text variant="caption" className="text-warning text-center mt-3" testID="unshield-no-note">
              {`No private note can pay the relayer fee of ${displayAmount(q.fee, A0_TOKEN.decimals)} ${sym}.`}
            </Text>
          ) : null}
        </View>

        {/* The destination (decision B-5): "To: … · Change"; the warnings under it, always visible */}
        <DestinationRow
          testID="unshield-dest"
          choice={choice}
          onChoose={setChoice}
          disabled={q === null}
          fresh={{
            available: offer !== null && offer.fresh.available,
            sub:
              offer === null
                ? '—'
                : offer.fresh.available
                  ? a0FreshDefaultCopy(offer.fresh.grantLamports)
                  : A0_FRESH_UNAVAILABLE_COPY[offer.fresh.reason],
          }}
          mainSub={mainAddress ? shortAddress(mainAddress) : 'Your main account'}
          mainMono={mainAddress !== null}
          freshReason={offer !== null && !offer.fresh.available ? A0_FRESH_UNAVAILABLE_COPY[offer.fresh.reason] : null}
          warning={
            choice === 'main'
              ? {testID: 'unshield-warning-main', text: A0_MAIN_ACCOUNT_WARNING}
              : choice === 'external'
                ? {testID: 'unshield-warning-external', text: A0_EXTERNAL_WARNING}
                : null
          }
        >
          {choice === 'external' ? (
            <View className="mt-2">
              {/* UX-A 2: the WHOLE address is visible — two wrapped monospace lines (a single-line input
                  scrolls its start out of view); Enter submits, it never puts a line break in it */}
              <TextInput
                value={external}
                onChangeText={setExternal}
                placeholder="Recipient address"
                placeholderTextColor="#6E727A"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={2}
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
                textAlignVertical="top"
                accessibilityLabel="Recipient address"
                testID="unshield-external-input"
                className={cn(
                  'font-geist-mono text-body-sm text-fg-primary rounded-md bg-bg-surface-2 border px-3 py-3 min-h-touch-min',
                  extProblem ? 'border-danger' : 'border-bg-surface-3',
                )}
              />
              {extProblem ? (
                <Text variant="caption" className="text-danger mt-1" testID="unshield-external-problem">
                  {extProblem}
                </Text>
              ) : null}
            </View>
          ) : null}
        </DestinationRow>

        {/* Fees card — the relayer fee and what the destination receives visible; the rest behind Details */}
        <View className={cn('rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4', overMax && 'opacity-50')}>
          <Text variant="overline" className="mb-3">
            Fees
          </Text>
          <FeeRow
            label="Relayer fee"
            value={hasAmount && fee !== null ? `${displayAmount(fee, A0_TOKEN.decimals)} ${sym}` : '—'}
          />
          <View className="h-px bg-bg-surface-3 my-3" />
          <View className="flex-row items-center justify-between">
            <Text variant="body-sm" className="text-fg-secondary">
              Destination receives
            </Text>
            <Text variant="balance-md" numeral className="text-fg-primary" testID="unshield-net">
              {`${hasAmount && !overMax ? displayAmount(units, A0_TOKEN.decimals) : '—'} ${sym}`}
            </Text>
          </View>
          {hasAmount && !overMax && fee !== null ? (
            <Text variant="caption" className="text-fg-tertiary mt-3" testID="unshield-amount-line">
              {a0AmountLine(units, fee, A0_TOKEN.decimals, sym)}
            </Text>
          ) : null}
          <DetailsDisclosure testID="unshield-details">
            <View className="h-px bg-bg-surface-3 my-3" />
            <FeeRow label="Network fee" value={hasAmount ? 'Paid by the relayer' : '—'} />
            <FeeRow label="ZK proof fee" value={hasAmount ? 'None · made on this device' : '—'} zk />
            {source !== null ? (
              <Text variant="caption" className="text-fg-tertiary mt-1" testID="unshield-one-note">
                {a0OneNoteLimit(max, A0_TOKEN.decimals, sym)}
              </Text>
            ) : null}
          </DetailsDisclosure>
        </View>

        {/* The design's withdraw banner: the relayed sentence (the destination warnings sit under the row) */}
        <View
          className="rounded-md bg-bg-surface-2 border-l-2 border-l-warning p-4 mb-4 flex-row gap-3"
          testID="unshield-warning"
        >
          <AlertTriangle size={16} color="#F2B53B" strokeWidth={1.75} />
          <View className="flex-1 gap-1">
            <Text variant="body-sm" className="font-geist-semibold text-fg-primary">
              Privacy decreases on public withdraw
            </Text>
            <Text variant="caption" className="text-fg-secondary" testID="unshield-relayed">
              {A0_RELAYED_COPY}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 pb-8 pt-2 border-t border-bg-surface-2 bg-bg-base">
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{disabled: !canSubmit}}
          testID="unshield-cta"
          accessibilityLabel={makePublicCtaIdle(sym)}
          className={cn(
            'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
            canSubmit ? 'bg-accent-shielded active:opacity-90' : 'bg-bg-surface-3',
          )}
        >
          <Text
            variant="body-lg"
            className={cn('font-geist-semibold', canSubmit ? 'text-bg-base' : 'text-fg-disabled')}
          >
            {hasAmount && !overMax ? makePublicCta(displayAmount(units, A0_TOKEN.decimals), sym) : makePublicCtaIdle(sym)}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function Note({tone, children, testID}: {tone: 'info' | 'danger'; children: React.ReactNode; testID?: string}) {
  const Icon = tone === 'info' ? RefreshCw : AlertTriangle;
  return (
    <View
      className={cn(
        'rounded-md bg-bg-surface-2 border-l-2 p-4 mb-4 flex-row gap-3',
        tone === 'danger' ? 'border-l-danger' : 'border-l-accent-shielded',
      )}
      testID={testID}
    >
      <Icon size={16} color={tone === 'danger' ? '#FF5C6A' : '#5BE3C2'} strokeWidth={1.75} />
      <Text variant="caption" className="flex-1 text-fg-secondary">
        {children}
      </Text>
    </View>
  );
}

function FeeRow({label, value, zk}: {label: string; value: string; zk?: boolean}) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center gap-2 flex-1">
        {zk ? (
          <View className="w-5 h-5 rounded-pill items-center justify-center bg-[rgba(91,227,194,0.16)]">
            <Shield size={12} color="#5BE3C2" strokeWidth={2} />
          </View>
        ) : null}
        <Text variant="body-sm" className={cn(zk ? 'text-accent-shielded' : 'text-fg-secondary')}>
          {label}
        </Text>
      </View>
      <Text variant="body-sm" numeral className="text-fg-primary">
        {value}
      </Text>
    </View>
  );
}
```

(`destinationValid`, `canSubmit`, `handleMax`, `handleSubmit`, the M-9 `useMemo` and `externalOwnerProblem` are unchanged. `handleSubmit` still builds `{kind: 'external', owner: external.trim()}` / `{kind: choice}` — the refusal rules stay M1c's.)

- [ ] **Step 9: Shrink the ratchet**

In `src/copy/__tests__/bannedWords.test.ts` delete the lines `'src/screens/shielded/ShieldUnshieldScreen.tsx': 11,` and `'src/screens/shielded/unshield/UnshieldSide.tsx': 7,`, and change `'src/screens/shielded/unshield/unshieldCopy.ts': 8,` to `'src/screens/shielded/unshield/unshieldCopy.ts': 5,` (the refusal sentences are Task 4's).

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx jest src/screens/shielded src/copy src/components/private`
Expected: PASS. If the ratchet row for a #16 file fails, its hit list names the string still carrying a banned word: fix the string, never the count.

- [ ] **Step 11: Mutations (each must go red, then revert)**

1. `UnshieldSide` preselection `if (offer.preselected !== null) setChoice(offer.preselected)` → `setChoice(offer.preselected ?? 'main')` → "Review Focus 1 / S11" and "S9" fail (the owner's A1 is held by a test).
2. Move `<FeeRow label="Relayer fee" …/>` inside `DetailsDisclosure` → "idle: … the relayer fee visible" fails.
3. Move the `unshield-no-note` Text inside `DetailsDisclosure` → "Review Focus 2" fails.
4. `ShieldedLine`'s early `return null` condition dropped (always render the wrapper) — must stay green (no test depends on an empty wrapper); then render a `BalanceRow` for `PRIVATE_BALANCE` inside it → "decision B-2" rows fail.

- [ ] **Step 12: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: jest green; tsc 0; lint `✖ 144 problems (0 errors, 144 warnings)`; TGE check 0. The M1c module suites (`src/modules/shielded/a0/__tests__/**`) are green and unedited: `git diff --stat -- src/modules` prints nothing.

- [ ] **Step 13: Commit**

```bash
git add src/screens/shielded src/copy/__tests__/bannedWords.test.ts
git commit -m "feat(shielded-ux-b): #16 Private ⇄ Public — one balance line per tab, Details, the destination row, the limit hint (part B Task 3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: #18–#21 for both runs (Make public and the deposit), and the captions they show

**Files:**
- Modify: `src/screens/shielded/unshield/UnshieldRunScreen.tsx`
- Modify: `src/screens/shielded/unshield/unshieldCopy.ts` (the refusal sentences)
- Modify: `src/screens/shielded/ZkProofScreen.tsx` (deposit #18), `ShieldSimulateScreen.tsx` (#19), `ShieldConfirmScreen.tsx` (#20), `ShieldStatusScreen.tsx` (#21)
- Modify: `src/modules/shielded/a0/unshieldCheck.ts` (`a0CheckCaption`'s three strings only), `src/hooks/useA0Shielded.ts` (one message)
- Modify: `src/app/Navigator.tsx` (one string: #10 UnlockSend's recipient on the deposit path, review I-3)
- Modify: `src/copy/__tests__/bannedWords.test.ts` (ratchet), `src/screens/shielded/__tests__/privacyClaims.test.ts` (scope)
- Test: `src/screens/shielded/unshield/__tests__/UnshieldRunScreen.test.tsx`, `UnshieldRunScreen.flow.test.tsx`, `src/screens/shielded/__tests__/ZkProofScreen.test.tsx`, `ShieldTxFlow.test.tsx`, `src/hooks/__tests__/useA0Shielded.test.tsx`

**Interfaces:**
- Consumes (Task 1): `PRIVATE_MARK`, `MAKE_PUBLIC`, `MAKE_PRIVATE`, `MAKING_PUBLIC`, `NOW_PUBLIC`, `MAKING_PRIVATE`, `NOW_PRIVATE`, `makePrivateCta`. (Task 2): `DetailsDisclosure`.
- Produces: new test ids `unshield-proof-title` (#18 unshield title), `unshield-status-header` (#21 unshield header), `unshield-details` (+ `-toggle`, `-body`), `zk-title` (deposit #18 title), `shield-status-public` (deposit #21's "Your deposit is public on chain."). `a0CheckCaption` keeps its signature; only its strings change.

The string swaps, all of them (old → new). Every one is a visible-copy change; none touches a flow decision:

| File | Old | New |
|---|---|---|
| `UnshieldRunScreen.tsx` `ROW_TITLE` | `sync: 'Sync the pool'`, `quote: 'Relayer quote'`, `proof: 'Prove'` | `sync: 'Check the pool'`, `quote: 'Relayer fee'`, `proof: 'Make the proof'` (A7) |
| `UnshieldRunScreen.tsx` `ROW_ACTIVE` | `sync: "verifying the pool's tree from the chain"`, `proof: 'running the Groth16 prover on this device'` | `sync: 'checking the pool on the chain'`, `proof: 'making the proof on this device'` |
| `proofHero` | `'Preparing unshield'`, `'Syncing the pool'`, `"Verifying the pool's tree from the chain and your note's place in it."`, `'Proving'`, `` `Running the Groth16 prover on this device.${again}` `` | `'Preparing'`, `'Checking the pool'`, `"Checking the pool on the chain and your note's place in it."`, `'Making the proof'`, `` `Making the proof on this device.${again}` `` |
| `handleBack` Alert title | `'Unshield in progress'` | `MAKING_PUBLIC` |
| #18 header | overline `SHIELDED` | overline `{PRIVATE_MARK}` + title `{MAKING_PUBLIC}` (`unshield-proof-title`) |
| #18 hero caption | `` `Unshield ${amountText}` `` | `amountText` |
| #21 header | overline `Shielded`, h2 `running ? 'Unshielding…' : 'Unshield'` | overline `{PRIVATE_MARK}`, `·`, h2 `running ? MAKING_PUBLIC : MAKE_PUBLIC` (`unshield-status-header`) — "PRIVATE · Make public" |
| `statusView` spent | title `'Unshielded'`, sub `` `Landed on Solana devnet and verified · the destination received ${amountText}.` `` | title `NOW_PUBLIC`, sub `` `The destination received ${amountText}.` `` (A8) |
| `statusView` spent change line | `` `Your change, ${…}, stays shielded.` `` | `` `Your change, ${…}, stays private.` `` |
| `statusView` E_A0_STORE_CHANGED | `while this unshield was in flight` | `while this transfer to public was in flight` |
| `statusView` landed-unverified sub | `for this unshield that does not match` | `for this transfer to public that does not match` |
| `statusView` not-sent | `Nothing left your shielded balance.` | `Nothing left your private balance.` |
| `decidedView` settled (both) | title `'Unshielded'` | title `NOW_PUBLIC` (subs unchanged) |
| `decidedView` reverted | `Your note is back in your shielded balance.` | `Your note is back in your private balance.` |
| `decidedView` unverified | `for this unshield that does not match` | `for this transfer to public that does not match` |
| "Back to unshield" (label + text) | `Back to unshield` | `` `Back to ${MAKE_PUBLIC}` `` → "Back to Make public" |
| `unshieldCopy.ts` | `E_A0_VERIFY_PROGRAMS: 'it calls a program outside the relayed unshield'` | `'it calls a program outside the relayed exit'` |
| `unshieldCopy.ts` | `E_A0_UNSHIELD_BUSY: 'Another unshield is still running on this device.'` | `'Another transfer to public is still running on this device.'` |
| `unshieldCopy.ts` | `E_A0_UNSHIELD_NOT_READY: 'Your shielded notes are not restored yet.'` | `'Your private balance is not restored yet.'` |
| `unshieldCopy.ts` | `E_A0_UNSHIELD_NO_NOTE: 'No shielded note can pay the relayer fee.'` | `'No private note can pay the relayer fee.'` |
| `unshieldCopy.ts` | `A0_STOPPED_ON_DEVICE = 'The unshield stopped on this device.'` | `'The transfer to public stopped on this device.'` |
| `unshieldCheck.ts` `a0CheckCaption` | `'Confirmed · unshielded.'`, `'Settled from the chain · unshielded.'`, `'Not sent · your note is back in your shielded balance.'` | `'Confirmed · now public.'`, `'Settled from the chain · now public.'`, `'Not sent · your note is back in your private balance.'` |
| `useA0Shielded.ts` `checkA0PendingAgain` | `'Shielding is not available on this device.'` | `'Private balances are not available on this device.'` |
| `ZkProofScreen.tsx` `TITLES` | `{1: 'Build witness', 2: 'Prove', 3: 'Verify locally', 4: 'Ready'}` | `{1: 'Prepare', 2: 'Make the proof', 3: 'Check the proof', 4: 'Ready'}` (A7) |
| `ZkProofScreen.tsx` `SUBSTEP.proving` | `'running the Groth16 prover'` | `'making the proof'` |
| `ZkProofScreen.tsx` `heroOf` running | labels `'Building witness'` / `'Proving'` / `'Verifying'`; row-2 sub `'Running the Groth16 prover on this device.'` | `'Preparing'` / `'Making the proof'` / `'Checking the proof'`; `'Making the proof on this device.'` |
| `ZkProofScreen.tsx` header | overline `SHIELDED` | overline `{PRIVATE_MARK}` + title `{MAKING_PRIVATE}` (`zk-title`) |
| `ShieldSimulateScreen.tsx` | overline `Shielded`; `shielded pool`; `'This deposit is no longer prepared. Go back and start the shield again.'`; `DeltaRow label="Shielding"`; `Simulating shield deposit`; `` `Shield simulation passed · ${…} CU` `` / `'Shield simulation passed'` | `{PRIVATE_MARK}`; `the pool` (A11); `'This deposit is no longer prepared. Go back and start again.'`; `label="Making private"`; `Simulating the deposit`; `` `Simulation passed · ${…} CU` `` / `'Simulation passed'` |
| `ShieldConfirmScreen.tsx` | overline `Shielded`; headline, a11y label and CTA `` `Shield ${amount}` ``; `You are about to shield`; `'This deposit is no longer prepared. Go back and start the shield again.'`; `` `Shielded pool · ${…}` `` | `{PRIVATE_MARK}`; `makePrivateCta(figure, intent.tokenSymbol)` (×3); `You are about to make this private`; `'This deposit is no longer prepared. Go back and start again.'`; `` `Pool · ${…}` `` (A11) |
| `src/app/Navigator.tsx` (`ShieldConfirmScreenNav`) | `recipient: 'Shielded pool'` (shown whole on #10 UnlockSend) | `recipient: 'Pool'` (A11) |
| `ShieldStatusScreen.tsx` | Alert `'Shield in progress'`; overline `Shielded` (×2); h2 `running ? 'Shielding…' : 'Shield'`; `` `Shielded balance now ${…}` ``; `viewOf` running title `'Shielding…'`; missing `'… Start the shield again.'`; unspent title `'Shielded'`; dropped title `'Not shielded'` | `MAKING_PRIVATE`; `{PRIVATE_MARK}` (×2); `running ? MAKING_PRIVATE : MAKE_PRIVATE`; `` `Private balance now ${…}` ``; `MAKING_PRIVATE`; `'… Start again from Make private.'`; `NOW_PRIVATE`; `'Not made private'` |

- [ ] **Step 1: Write the failing tests — the unshield run**

In `src/screens/shielded/unshield/__tests__/UnshieldRunScreen.test.tsx` change these rows (each with `// part B: <old> → <new>` at the end of the line):

- line 134: `'E_KEYCHAIN_CANCELLED · The transfer to public stopped on this device. Nothing was sent.'`
- line 143: `toBe('Checking the pool')`
- line 153: `toBe('making the proof on this device · 0.0 s')`
- line 208: `toHaveBeenCalledWith('Making public…', expect.stringMatching(/Leaving does not stop it/))`
- line 277: `expect(title(r)).toBe('Now public');`; line 278: `expect(sub(r)).toBe('The destination received 1.25 TEST.');`; line 281: `'Your change, 0.74999 TEST, stays private.'`
- lines 283–284 (the change position and the tx hash) become, in this order:

```tsx
    expect(r.queryByText('#42 in the pool')).toBeNull(); // part B (spec §4): behind Details
    expect(r.queryByText('4Hq7Mb…5e6f')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-details-toggle'));
    expect(r.getByText('#42 in the pool')).toBeTruthy();
    expect(r.getByText('4Hq7Mb…5e6f')).toBeTruthy();
```

- line 412: `expect(r.queryByTestId('unshield-details')).toBeNull(); // part B: no signature → no Details (was: no "Tx hash" row)`
- the `it('not-sent → … "Back to unshield" …')` title → `"Back to Make public"`; line 420: `'The relayer did not send it (budget_exceeded). Nothing left your private balance.'`; after line 422 add `expect(r.getByText('Back to Make public')).toBeTruthy(); // part B: "Back to unshield" → "Back to Make public"` (the button is pressed by its test id, unchanged).
- line 437: `'E_A0_UNSHIELD_BUSY · Another transfer to public is still running on this device. Nothing was sent.'`
- lines 500, 578: `'… · The transfer to public stopped on this device. Nothing was sent.'`
- lines 623, 629, 658, 663, 676, 697, 708: `'Confirmed · now public.'`; line 715: `'Settled from the chain · now public.'`; lines 634, 639, 655, 666: `'Not sent · your note is back in your private balance.'`; line 636: `'Checked again: it did not land in time, so it can no longer land. Your note is back in your private balance.'`
- lines 624, 654, 656, 698, 709, 716, 728: `expect(title(r)).toBe('Now public');`
- line 665: `expect(r.queryByText(/Now public|CONFIRMED/)).toBeNull(); // part B: the negative row follows the new word`
- every other row that types `'… for this unshield that does not match …'` → `'… for this transfer to public that does not match …'`.

Then add, after `describe('#18 for the unshield — …')`:

```tsx
describe('part B: the headers say "PRIVATE · Make public" and the run titles use the new words', () => {
  it('#18: "Private" and "Making public…"; the hero caption is the amount, no old word', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'sync');
    expect(r.getByTestId('unshield-proof-title').props.children).toBe('Making public…');
    expect(r.getByText('Private')).toBeTruthy();
    expect(r.getByText('1.25 TEST')).toBeTruthy();
    expect(r.queryByText(/Unshield|SHIELDED/)).toBeNull();
  });

  it('#21: "Private · Making public…" while it runs, "Private · Make public" after', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'sync');
    await step(ctl, 'quote', 10);
    await step(ctl, 'approval', 10);
    await step(ctl, 'proof', 10);
    await step(ctl, 'submit', 10);
    expect(r.getByTestId('unshield-status-header').props.children).toBe('Making public…');
    await act(async () =>
      ctl.resolve({status: 'spent', signature: SIG, changeLeafIndex: 1, changeAmount: 1n, grantLamports: null, destinationWithoutSol: false}),
    );
    expect(r.getByTestId('unshield-status-header').props.children).toBe('Make public');
    expect(r.queryByText(/Unshield/)).toBeNull();
  });
});
```

In `UnshieldRunScreen.flow.test.tsx` line 73: `expect(title(r)).toBe('Now public'); // part B: "Unshielded" → "Now public"`.

In `src/hooks/__tests__/useA0Shielded.test.tsx` lines 311, 344, 345: the captions `'Settled from the chain · now public.'`, `'Confirmed · now public.'`, `'Not sent · your note is back in your private balance.'` (`// part B`). (No row there asserts the unavailable message; the banned-word scan holds it.)

- [ ] **Step 2: Write the failing tests — the deposit run**

In `src/screens/shielded/__tests__/ZkProofScreen.test.tsx`: `'Build witness: …'` → `'Prepare: …'` (lines 120, 131, 144, 222, 240, 253), `'Prove: …'` → `'Make the proof: …'` (lines 122, 132, 138, 146, 242), `'Verify locally: active'` → `'Check the proof: active'` (151), hero `'Building witness'` → `'Preparing'` (119, 139), `'Proving'` → `'Making the proof'` (143), `'Verifying'` → `'Checking the proof'` (149) — each with `// part B`. `'Ready: done'`, `'Preparing proof'`, `'Proof ready'`, `'Proof failed'` are unchanged. Add:

```tsx
  it('part B: the header says "Private" and "Making private…"; no old word on #18, in any stage', async () => {
    const ctl = controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    expect(r.getByTestId('zk-title').props.children).toBe('Making private…');
    expect(r.getByText('Private')).toBeTruthy();
    await flush();
    for (const s of ['checking', 'proving', 'verifying'] as const) {
      await stage(ctl, s, 100);
      expect(r.queryByText(/SHIELDED|Groth16|witness/)).toBeNull();
    }
  });
```

(Put it at the end of `describe('#18 — the real stage sequence', …)`; `controlledPrepare`, `flush`, `stage`, `AMOUNT`, `onReady`, `onCancel` are the file's own.)

In `src/screens/shielded/__tests__/ShieldTxFlow.test.tsx`:
- line 85: `'Simulating the deposit'`; 86: `'Simulation passed · 142,287 CU'`; 117: `'Simulation passed'`;
- line 145: `'Make 2.5 TEST private'`; 146: `'You are about to make this private'`; 150: `/^Pool · 8VMe…/` (A11);
- line 224: `expect(title(r)).toBe('Now private');`; 228: `'Private balance now 4 TEST'`; 291: `'Not made private'`; the test title on line 285 `"Not shielded"` → `"Not made private"`; line 282 `queryByText(/fail|Not shielded/i)` → `queryByText(/fail|Not made private/i)` (`// part B (review I-4): the negative row follows the new word`);
- after line 228 add:

```tsx
    expect(r.getByTestId('shield-status-public').props.children).toBe('Your deposit is public on chain.'); // part B (spec §4, A2)
    expect(r.getByTestId('shield-status-details')).toBeTruthy(); // the explorer stays (a deposit is public by design)
```

- in the "Not sent" refusal row (line ~304, `E_A0_DEPOSIT_SIGNER`), add `expect(r.queryByTestId('shield-status-public')).toBeNull(); // nothing was broadcast: the line is not said`;
- review I-2 — the line is said only when the deposit LANDED. In the first row, after `await act(async () => ctl.stage('confirming', SIG));` (line ~220, a signature exists, still running) add `expect(r.queryByTestId('shield-status-public')).toBeNull(); // running: not landed yet`; in the `dropped` row (line ~291) add `expect(r.queryByTestId('shield-status-public')).toBeNull(); // "yours did not land": the line would be false`; in the pending row with a foreign signature (line ~281) add the same `toBeNull()` with `// pending: not landed`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/screens/shielded src/hooks/__tests__/useA0Shielded.test.tsx`
Expected: FAIL on every changed row (the old strings are still in the code) and on the missing test ids `unshield-proof-title`, `unshield-status-header`, `unshield-details-toggle`, `zk-title`, `shield-status-public`.

- [ ] **Step 4: Implement the unshield run**

In `src/screens/shielded/unshield/UnshieldRunScreen.tsx`:

4a. Imports — add:

```tsx
import {DetailsDisclosure} from '../../../components/private';
import {MAKE_PUBLIC, MAKING_PUBLIC, NOW_PUBLIC, PRIVATE_MARK} from '../../../copy/modes';
```

4b. Replace `ROW_TITLE` and `ROW_ACTIVE`:

```tsx
/** part B (spec §4 "#18 … stage labels in plain words"; plan A7) — each row keeps its measured time */
const ROW_TITLE: Record<A0UnshieldStage, string> = {
  sync: 'Check the pool',
  quote: 'Relayer fee',
  approval: 'Your approval',
  proof: 'Make the proof',
  submit: 'Submit',
  confirm: 'Confirm',
};

const ROW_ACTIVE: Record<A0UnshieldStage, string> = {
  sync: 'checking the pool on the chain',
  quote: 'asking the relayer for its fee',
  approval: 'waiting for you in the confirmation dialog',
  proof: 'making the proof on this device',
  submit: 'the relayer is submitting it',
  confirm: 'reading it back from the chain',
};
```

4c. In `handleBack`, `Alert.alert('Unshield in progress', …)` → `Alert.alert(MAKING_PUBLIC, …)` (the body is unchanged).

4d. In the #18 layout replace the centre of the top bar and the hero caption:

```tsx
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
            <Text variant="overline" className="text-accent-shielded">
              {PRIVATE_MARK}
            </Text>
            <Text variant="body-sm" className="font-geist-semibold text-fg-primary" testID="unshield-proof-title">
              {MAKING_PUBLIC}
            </Text>
          </View>
```

```tsx
            <Text variant="caption" numeral className="mt-2 text-fg-tertiary">
              {amountText}
            </Text>
```

4e. Replace the #21 header row:

```tsx
      <View className="flex-row items-center px-4 py-3 gap-2">
        <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
        <Text variant="overline" className="text-accent-shielded">
          {PRIVATE_MARK}
        </Text>
        <Text variant="overline" className="text-fg-tertiary">
          ·
        </Text>
        <Text variant="h2" className="flex-1" testID="unshield-status-header">
          {running ? MAKING_PUBLIC : MAKE_PUBLIC}
        </Text>
        {view.badge ? (
          <Text
            variant="overline"
            testID="unshield-status-badge"
            className={view.tone === 'ok' ? 'text-accent-shielded' : view.tone === 'bad' ? 'text-danger' : 'text-warning'}>
            {view.badge}
          </Text>
        ) : null}
      </View>
```

4f. Replace the signature block with Details (spec §4: TX HASH and "Change #{n} in the pool" behind Details; "Copy signature" stays visible below):

```tsx
        {signature ? (
          <View className="w-full bg-bg-surface-1 rounded-lg px-5 mt-3">
            <DetailsDisclosure testID="unshield-details">
              <MetaRow label="Tx hash" value={shortSignature(signature)} onCopy={copySig} />
              {phase.kind === 'done' && phase.outcome.status === 'spent' ? (
                <MetaRow label="Change" value={`#${phase.outcome.changeLeafIndex} in the pool`} />
              ) : null}
            </DetailsDisclosure>
          </View>
        ) : null}
```

4g. "Back to unshield": `accessibilityLabel={`Back to ${MAKE_PUBLIC}`}` and the Text child `{`Back to ${MAKE_PUBLIC}`}`.

4h. `proofHero`:

```tsx
function proofHero(stage: A0UnshieldStage | null, round: number): {label: string; sub: string} {
  const again =
    round > 1 ? ` The relayer's terms changed or the pool moved on, so this is a new confirmation (${round} of 3).` : '';
  switch (stage) {
    case null:
      return {label: 'Preparing', sub: 'Unlock with your fingerprint or passcode. The proof is generated on this device.'};
    case 'sync':
      return {label: 'Checking the pool', sub: "Checking the pool on the chain and your note's place in it."};
    case 'quote':
      return {label: 'Asking the relayer', sub: 'The relayer pays for and submits the transaction; it states its fee first.'};
    case 'approval':
      return {
        label: 'Approve in the dialog',
        sub: `Check the destination and the amounts the dialog shows, then confirm it is you.${again}`,
      };
    default:
      return {label: 'Making the proof', sub: `Making the proof on this device.${again}`};
  }
}
```

4i. In `statusView` and `decidedView`, apply the table's rows for this file exactly (titles through `NOW_PUBLIC`; the sentences as listed). The spent case becomes:

```tsx
          lines.push({id: 'change', text: `Your change, ${displayAmount(o.changeAmount, A0_TOKEN.decimals)} ${A0_TOKEN.symbol}, stays private.`});
          return {
            ...base,
            title: NOW_PUBLIC,
            sub: `The destination received ${amountText}.`,
            tone: 'ok',
            badge: 'CONFIRMED',
            lines,
          };
```

4j. In the file's doc comment: "spent → "Unshielded"" → "spent → "Now public"", and add one line under DEPARTURES: `part B (spec 2026-11-20 §4): the header "PRIVATE · Make public"; the tx hash and the change position behind "Details ▾"; the stage labels in plain words (plan A7).`

- [ ] **Step 5: Implement the copy and module captions**

Apply the `unshieldCopy.ts`, `unshieldCheck.ts` and `useA0Shielded.ts` rows of the table exactly (string literals only; no signature, type or control-flow change). `a0CheckCaption` becomes:

```ts
export function a0CheckCaption(d: A0UnshieldCheck): string {
  switch (d.kind) {
    case 'unverified':
      return 'Checked just now · it landed, but failed verification.';
    case 'pending':
      return 'Still not confirmed · checked just now.';
    case 'settled':
      return d.verified ? 'Confirmed · now public.' : 'Settled from the chain · now public.';
    case 'reverted':
      return 'Not sent · your note is back in your private balance.';
  }
}
```

- [ ] **Step 6: Implement the deposit run**

6a. `ZkProofScreen.tsx`: add `import {MAKING_PRIVATE, PRIVATE_MARK} from '../../copy/modes';`; `TITLES`, `SUBSTEP.proving` and `heroOf`'s running branch per the table:

```tsx
const TITLES: Record<Row, string> = {1: 'Prepare', 2: 'Make the proof', 3: 'Check the proof', 4: 'Ready'};
```

```tsx
    case 'running': {
      const row = ROW_OF[phase.stage];
      const label = row === 1 ? 'Preparing' : row === 2 ? 'Making the proof' : 'Checking the proof';
      const sub =
        row === 2
          ? 'Making the proof on this device.'
          : row === 3
            ? "Checking the proof's public inputs against this deposit."
            : `Building the deposit: ${SUBSTEP[phase.stage]}.`;
      return {label, sub};
    }
```

and the header centre:

```tsx
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
          <Text variant="overline" className="text-accent-shielded">
            {PRIVATE_MARK}
          </Text>
          <Text variant="body-sm" className="font-geist-semibold text-fg-primary" testID="zk-title">
            {MAKING_PRIVATE}
          </Text>
        </View>
```

6b. `ShieldSimulateScreen.tsx`: add `import {PRIVATE_MARK} from '../../copy/modes';`; the overline child `{PRIVATE_MARK}`; the table's other four rows as literals (`the pool`, `Go back and start again.`, `label="Making private"`, `Simulating the deposit`, `Simulation passed`).

6c. `ShieldConfirmScreen.tsx`: add `import {PRIVATE_MARK, makePrivateCta} from '../../copy/modes';`; after `const amount = …` add `const figure = displayAmount(BigInt(intent.amount), intent.decimals);` and `const headline = makePrivateCta(figure, intent.tokenSymbol);`; use `{headline}` for the h1, the CTA's text and its `accessibilityLabel`; the overline `{PRIVATE_MARK}`; `You are about to make this private`; `` {`Pool · ${A0.pool.slice(0, 4)}…${A0.pool.slice(-4)}`} ``; the missing line `This deposit is no longer prepared. Go back and start again.`.

6d. `ShieldStatusScreen.tsx`: add `import {MAKE_PRIVATE, MAKING_PRIVATE, NOW_PRIVATE, PRIVATE_MARK} from '../../copy/modes';`; apply the table's rows; and in the amount card, after the `shield-status-balance` line, add (spec §4 "Your deposit is public on chain … stay"; plan A2 — only when the deposit LANDED, review I-2: never while it runs, when it is pending, or `dropped`):

```tsx
          {phase.kind === 'done' && phase.outcome.status === 'unspent' ? (
            <Text variant="caption" className="text-fg-tertiary text-center" testID="shield-status-public">
              Your deposit is public on chain.
            </Text>
          ) : null}
```

- [ ] **Step 7: Widen the guard and shrink the ratchet**

6e. `src/app/Navigator.tsx`: in `ShieldConfirmScreenNav`, `recipient: 'Shielded pool',` → `recipient: 'Pool',` (the #10 UnlockSend re-auth prints it whole; A11).

In `privacyClaims.test.ts` add to `EXTRA_COPY` (comment: `// part B: copy a screen shows as it is (the "Check again" captions, the unavailable message, #10's recipient)`):

```ts
  path.join(ROOT, 'src/modules/shielded/a0/unshieldCheck.ts'),
  path.join(ROOT, 'src/hooks/useA0Shielded.ts'),
  path.join(ROOT, 'src/app/Navigator.tsx'),
```

and add the three paths to the positive control's `expect.arrayContaining([...])`.

In `bannedWords.test.ts` delete the lines for `ShieldConfirmScreen.tsx`, `ShieldSimulateScreen.tsx`, `ShieldStatusScreen.tsx`, `ZkProofScreen.tsx`, `unshield/UnshieldRunScreen.tsx`, `unshield/unshieldCopy.ts`, `src/modules/shielded/a0/unshieldCheck.ts`, `src/hooks/useA0Shielded.ts`, `src/app/Navigator.tsx`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest src/screens/shielded src/hooks src/copy src/modules/shielded`
Expected: PASS, including every M1c module suite with no edit (`git diff --stat -- src/modules/shielded/a0/__tests__` prints nothing; `git diff -- src/modules` shows only `unshieldCheck.ts`'s three string lines).

- [ ] **Step 9: Mutations (each must go red, then revert)**

1. `statusView` spent `title: NOW_PUBLIC` → `title: 'Unshielded'` → the ratchet row for `UnshieldRunScreen.tsx` (exactly 0) and the spent row fail.
2. Move the `MetaRow label="Tx hash"` out of `DetailsDisclosure` → the spent row's `queryByText('4Hq7Mb…5e6f')).toBeNull()` fails.
3. `ShieldStatusScreen`: render `shield-status-public` for every phase with a signature (`{signature ? … : null}`) → the running, pending and `dropped` rows fail (review I-2).
4. `a0CheckCaption` reverted → `'…shielded balance.'` → the `useA0Shielded` caption row and the ratchet for `unshieldCheck.ts` fail.

- [ ] **Step 10: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: jest green; tsc 0; lint `✖ 144 problems (0 errors, 144 warnings)`; TGE check 0.

- [ ] **Step 11: Commit**

```bash
git add src/screens/shielded src/modules/shielded/a0/unshieldCheck.ts src/hooks/useA0Shielded.ts src/hooks/__tests__/useA0Shielded.test.tsx src/app/Navigator.tsx src/copy/__tests__/bannedWords.test.ts
git commit -m "feat(shielded-ux-b): #18–#21 for both runs in the new words — headers, plain stage labels, Details on the result, the deposit's public line (part B Task 4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: The dashboard, the #15 explainer and every other screen; the ratchet reaches zero

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx`
- Modify: `src/screens/shielded/ShieldedExplainerScreen.tsx`
- Modify: `src/screens/transparent/ReceiveScreen.tsx`, `SendScreen.tsx`, `TransactionHistoryScreen.tsx`, `TxSimulateScreen.tsx`; `src/screens/onboarding/SuccessScreen.tsx`; `src/screens/portfolio/PortfolioScreen.tsx` (spec ambiguity A3: copy only)
- Modify: `src/constants/errors.ts` (four `action` strings), `src/modules/geoFence/geoFenceModule.ts` (two `message` strings) — review I-3
- Modify: `src/copy/__tests__/bannedWords.test.ts` (the ratchet is deleted), `src/screens/shielded/__tests__/privacyClaims.test.ts` (scope)
- Test: `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`, `src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx`, `src/screens/transparent/__tests__/ReceiveScreen.test.tsx`, `src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx`

**Interfaces:**
- Consumes (Task 1): `MODE_PUBLIC`, `MODE_PRIVATE`, `MAKE_PRIVATE`, `MAKE_PUBLIC`, `PRIVATE_BALANCE`, `PRIVATE_ASSETS`, `PRIVATE_SUFFIX`, `PRIVATE_CARD_BODY`, `PRIVATE_MARK`. (Task 2): `DetailsDisclosure`.
- Produces: dashboard test id `dashboard-details` (+ `-toggle`, `-body`) around the anonymity line. `ModeButton`'s props are unchanged (its own test passes its label as a prop and needs no edit).

The dashboard (spec §4): the toggle reads Public | Private; Private mode shows the "PRIVATE BALANCE" card with "Anonymity set" in its Details; the two actions Make private and Make public (part A's `onMakePublic` gate unchanged); "PRIVATE ASSETS"; the pending caption and the decided captions unchanged; the Private balance card keeps "Deposits are public on chain.". Public mode: only the toggle's label changes.

- [ ] **Step 1: Write the failing tests — the dashboard**

In `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`:

1a. Make the hidden-balance setting controllable. Replace the `publicSettingsStore` mock with:

```tsx
const mockHide = {current: false};
jest.mock('../../../store/zustand/publicSettingsStore', () => ({
  usePublicSettingsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({hideBalances: mockHide.current, setHideBalances: jest.fn()}),
}));
```

and add `mockHide.current = false;` to the top-level `beforeEach`.

1b. Change these rows (`// part B: <old> → <new>`): every `'Nothing shielded yet'` → `'Nothing private yet'` (the positive row on line 183 AND the negative rows on lines 171, 290, 321 — a negative row left on the old word passes vacuously); line 188 `'Tap Shield to make a token private'` → `'Tap Make private to move a token in'`; line 240 `'0.2 · shielded'` → `'0.2 · private'` (and its test title); line 302 `getByText('Shield')` → `getByText('Make private')`; in `describe('UX-A 7: …')` `labels.indexOf('Shield')` → `labels.indexOf('Make private')` and `getByLabelText('Shield')` → `getByLabelText('Make private')`; lines 225 and 227 feed and expect the new caption `'Not sent · your note is back in your private balance.'` (the fixture follows the caption Task 4 ships). Line 315's `/needs the on-device prover/` stays as it is: Step 5h's sentence is "Your private balance needs the on-device prover …" (review I-4).

1c. Replace `it('shows the anonymity set line: the A0 pool note count', …)` with:

```tsx
  it('the anonymity set (the A0 pool note count) is behind the card\'s Details (spec §4)', async () => {
    mockPoolCount.mockResolvedValue({status: 'ok', count: 42});
    const {getByText, queryByText, getByTestId} = await renderDashboard();
    expect(queryByText('Anonymity set · 42')).toBeNull(); // part B: collapsed by default
    fireEvent.press(getByTestId('dashboard-details-toggle'));
    expect(getByText('Anonymity set · 42')).toBeTruthy();
  });
```

1d. Add a new `describe` at the end of the file:

```tsx
describe('part B: the one vocabulary on the dashboard (spec §2, §4)', () => {
  it('the toggle reads Public | Private (both modes); no old word', async () => {
    for (const m of ['transparent', 'shielded'] as const) {
      mockMode.current = m;
      const r = await renderDashboard();
      expect(r.getByText('Public')).toBeTruthy();
      expect(r.getByText('Private')).toBeTruthy();
      expect(r.queryByText(/^(Transparent|Shielded)$/)).toBeNull();
      r.unmount();
    }
  });

  it('Private mode: the "Private balance" card, "Private assets", the two actions, the Private balance card\'s honest sentence', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 0n, notes: 1};
    const r = await renderDashboard({onShield: jest.fn(), onMakePublic: jest.fn()});
    expect(r.getAllByText('Private balance').length).toBe(2); // the hero overline and the info card's title
    expect(r.getByText('Private assets')).toBeTruthy(); // the overline renders "PRIVATE ASSETS"
    expect(r.getByLabelText('Make private')).toBeTruthy();
    expect(r.getByLabelText('Make public')).toBeTruthy();
    expect(r.getByText('Make private moves tokens in with a proof made on this device. Deposits are public on chain.')).toBeTruthy();
    expect(r.queryByText(/vault/i)).toBeNull();
  });

  it('Public mode: only the toggle changed — "Total balance", Send, Receive, Swap, "Tokens"', async () => {
    mockMode.current = 'transparent';
    const r = await renderDashboard({onReceive: jest.fn()});
    expect(r.getByText('Total balance')).toBeTruthy();
    expect(r.getByText('Send')).toBeTruthy();
    expect(r.getByText('Receive')).toBeTruthy();
    expect(r.getByLabelText('Swap')).toBeTruthy();
    expect(r.getByText('Tokens')).toBeTruthy();
  });

  it('Review Focus 5: balances hidden → no Details toggle and no anonymity number on the Private balance card', async () => {
    mockMode.current = 'shielded';
    mockHide.current = true;
    mockPoolCount.mockResolvedValue({status: 'ok', count: 42});
    const r = await renderDashboard();
    expect(r.getByText('Tap eye to reveal')).toBeTruthy(); // positive control: the hidden state
    expect(r.queryByTestId('dashboard-details-toggle')).toBeNull();
    expect(r.queryByText(/Anonymity set/)).toBeNull();
  });

  it('the pending caption is unchanged: "{x} pending · not confirmed yet" with Check again', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 50_000_000n, notes: 1};
    const r = await renderDashboard();
    expect(r.getByText('0.05 pending · not confirmed yet')).toBeTruthy();
    expect(r.getByTestId('dashboard-check-again')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Write the failing tests — the other screens**

- `ShieldedExplainerScreen.test.tsx` line 32: `getByText('Move into your private balance')` (`// part B`).
- `ReceiveScreen.test.tsx`: line 49 `'Public · address'`; line 87 `'Private · payment code'`; line 88 `'Private payment code'`; line 112 `title: 'My Noctura private payment code'`; line 119 `'No private address'` (each `// part B`).
- `TransactionHistoryScreen.test.tsx` line 60: `getByText('Private')`, and its test title `(All/Sent/Received/Private/Staking)`.

- [ ] **Step 3: Delete the ratchet**

In `src/copy/__tests__/bannedWords.test.ts`: delete `NOT_YET_SWAPPED` and its doc comment; delete the row `every ratchet line names a file in scope (a stale line fails)`; replace the per-file row with:

```tsx
  it.each(sources().map(s => [s.file, s.text] as const))('%s: no banned word in any user-visible string', (file, text) => {
    expect(bannedStrings(file, text).map(s => `${s.line}: ${s.text}`)).toEqual([]);
  });
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx jest src/screens/dashboard src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx src/screens/transparent src/copy`
Expected: FAIL — the dashboard still says "Transparent / Shielded", the explainer "Move into the vault", Receive "Transparent · public address"; the banned-word rows list each remaining hit by line.

- [ ] **Step 5: Implement the dashboard**

In `src/screens/dashboard/DashboardScreen.tsx`:

5a. Imports — add:

```tsx
import {DetailsDisclosure} from '../../components/private';
import {
  MAKE_PRIVATE,
  MAKE_PUBLIC,
  MODE_PRIVATE,
  MODE_PUBLIC,
  PRIVATE_ASSETS,
  PRIVATE_BALANCE,
  PRIVATE_CARD_BODY,
  PRIVATE_SUFFIX,
} from '../../copy/modes';
```

5b. The toggle: `label="Transparent"` → `label={MODE_PUBLIC}`; `label="Shielded"` → `label={MODE_PRIVATE}` (the `mode`, `withShieldIcon` and `comingSoon` props unchanged — a build without the private side shows "Private · soon").

5c. The hero overline: `{isShielded ? 'Shielded · vault balance' : 'Total balance'}` → `{isShielded ? PRIVATE_BALANCE : 'Total balance'}`.

5d. The anonymity line moves into the card's Details (the `hidden` branch above it is unchanged, so a hidden balance shows no Details — Review Focus 5):

```tsx
          ) : isShielded ? (
            anonymitySet != null ? (
              <DetailsDisclosure testID="dashboard-details">
                <View className="flex-row items-center gap-2 mb-3">
                  <Shield size={14} color="#5BE3C2" strokeWidth={1.75} />
                  <Text variant="body-sm" numeral className="text-accent-shielded">
                    {`Anonymity set · ${anonymitySet.toLocaleString()}`}
                  </Text>
                </View>
              </DetailsDisclosure>
            ) : null
          ) : (
```

5e. Quick actions: `label="Shield"` → `label={MAKE_PRIVATE}`; `label="Make public"` → `label={MAKE_PUBLIC}`; the comment above it: `"Make public" next to Make private`.

5f. Section header: `{isShielded ? 'Shielded assets' : 'Tokens'}` → `{isShielded ? PRIVATE_ASSETS : 'Tokens'}`.

5g. `TokenListRow`: `{isShielded ? ' · shielded' : ''}` → `{isShielded ? PRIVATE_SUFFIX : ''}`.

5h. `ShieldedAssetsBody`:

```tsx
    const text =
      view.kind === 'running'
        ? 'Your private balance is being restored from the chain.'
        : view.kind === 'error'
          ? `Your private balance could not be restored (${view.code ?? 'error'}). Open Make private to retry.`
          : view.kind === 'idle'
            ? 'Your private balance is not loaded yet. Open Make private to load it.'
            : 'Your private balance needs the on-device prover, which this device does not have.';
```

the empty state `Nothing shielded yet` → `Nothing private yet`, `Tap Shield to make a token private` → `Tap Make private to move a token in`; and the amount `` `${displayAmount(view.unspent, A0_TOKEN.decimals)} · shielded` `` → `` `${displayAmount(view.unspent, A0_TOKEN.decimals)}${PRIVATE_SUFFIX}` ``.

5i. `DashboardFooter`'s Private card: `Shielded vault` → `{PRIVATE_BALANCE}`; its body → `{PRIVATE_CARD_BODY}`.

- [ ] **Step 6: Implement the other screens (copy only)**

- `ShieldedExplainerScreen.tsx`: add `import {PRIVATE_MARK} from '../../copy/modes';`; the overline `SHIELDED` → `{PRIVATE_MARK}`; `Shielded mode moves SOL into a ZK pool.` → `Private mode moves SOL into a ZK pool.` (the rest of that paragraph unchanged); `title="Move into the vault"` → `title="Move into your private balance"`; `For every shielded action,` → `For every private action,`.
- `ReceiveScreen.tsx`: `'My Noctura shielded payment code'` → `'My Noctura private payment code'`; `'No shielded address'` → `'No private address'`; `"Your shielded address isn't ready yet. Open the Shielded tab to unlock private mode, then try again."` → `"Your private address isn't ready yet. Open the Private tab to unlock private mode, then try again."`; `'Shielded · payment request'` → `'Private · payment request'`; `'Shielded · payment code'` → `'Private · payment code'`; `'Transparent · pay request'` → `'Public · pay request'`; `'Transparent · public address'` → `'Public · address'`; `'Copy shielded payment code'` → `'Copy private payment code'`; `'Shielded payment code'` → `'Private payment code'`; `receive shielded transfers` → `receive private transfers`; `Noctura shielded payment codes.` → `Noctura private payment codes.` (its second sentence was already deleted in Task 1 — owner decision A10). In the file's doc comment, `an unlinkable per-request blob` → `a fresh per-request blob` (the guard reads comments; this file joins its scope in Step 7).
- `SendScreen.tsx`: `'Use Shielded Transfer for private addresses'` → `'Use a private transfer for private addresses'`.
- `TransactionHistoryScreen.tsx`: in the `FilterTab` type and in `FILTER_TABS`, `'Shielded'` → `'Private'` (the filter's comment "Shielded and Staking: not yet distinguishable …" may stay).
- `TxSimulateScreen.tsx`: `'Simulating shielded transfer'` → `'Simulating the private transfer'`; `'Shielded simulation passed'` → `'Private simulation passed'`; the overline `Shielded` → `Private`.
- `SuccessScreen.tsx`: `"Try a shielded send (privacy by design)"` → `"Try making a token private"` (the dropped parenthesis was a claim — the safe direction).
- `PortfolioScreen.tsx`: the two-line JSX text → `Holdings breakdown, allocation by token, and the public / private split. Coming soon.`
- `src/constants/errors.ts` (review I-3): E013 `'You need NOC tokens for shielded transactions'` → `'You need NOC tokens for private transactions'`; E050 `'Transparent mode is fully functional'` → `'Public mode is fully functional'`; E062 `'… Shielded history is not available.'` → `'… Private history is not available.'`; E110 `'Shielded addresses start with noc1. Check and try again.'` → `'Private addresses start with noc1. Check and try again.'`. Keys and codes unchanged.
- `src/modules/geoFence/geoFenceModule.ts` (review I-3): `'VPN or proxy detected. Shielded features may be limited.'` → `'VPN or proxy detected. Private features may be limited.'`; `'Jurisdiction check unavailable. Shielded features temporarily limited.'` → `'Jurisdiction check unavailable. Private features temporarily limited.'`. The `transparentAllowed` field names stay (identifiers).

- [ ] **Step 7: Widen the guard**

In `privacyClaims.test.ts` add to `EXTRA_COPY` (comment `// part B: every file that changed copy`):

```ts
  path.join(ROOT, 'src/screens/transparent/ReceiveScreen.tsx'),
  path.join(ROOT, 'src/screens/transparent/SendScreen.tsx'),
  path.join(ROOT, 'src/screens/transparent/TransactionHistoryScreen.tsx'),
  path.join(ROOT, 'src/screens/transparent/TxSimulateScreen.tsx'),
  path.join(ROOT, 'src/screens/onboarding/SuccessScreen.tsx'),
  path.join(ROOT, 'src/screens/portfolio/PortfolioScreen.tsx'),
  path.join(ROOT, 'src/constants/errors.ts'),
  path.join(ROOT, 'src/modules/geoFence/geoFenceModule.ts'),
```

and `'src/screens/transparent/ReceiveScreen.tsx'` to the positive control's list.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest src/screens src/copy src/components`
Expected: PASS; the banned-word scan reports `[]` for every file.

- [ ] **Step 9: Mutations (each must go red, then revert)**

1. Dashboard `label={MODE_PRIVATE}` → `label="Shielded"` → the scan row for `DashboardScreen.tsx` and "the toggle reads Public | Private" fail.
2. Move `DetailsDisclosure` above the `hidden ?` branch so it renders when hidden → Review Focus 5 fails.
3. `ReceiveScreen` comment back to `an unlinkable per-request blob` → the guard's row for `ReceiveScreen.tsx` fails (`['unlinkable']`).

- [ ] **Step 10: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: jest green; tsc 0; lint `✖ 144 problems (0 errors, 144 warnings)`; TGE check 0.

- [ ] **Step 11: Commit**

```bash
git add src/screens src/constants/errors.ts src/modules/geoFence/geoFenceModule.ts src/copy/__tests__/bannedWords.test.ts
git commit -m "feat(shielded-ux-b): the dashboard and every remaining screen in the one vocabulary; the banned-word scan reaches zero (part B Task 5)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The native confirmation's strings (Kotlin resource)

**Files:**
- Modify: `android/app/src/main/res/values/a0_confirm_strings.xml`
- Modify: `android/app/src/test/java/com/nocturawallet/prover/A0ConfirmTextTest.kt`
- Create: `src/copy/__tests__/nativeStrings.test.ts`
- Modify: `src/screens/shielded/__tests__/privacyClaims.test.ts` (the native resource's positive-control strings only)

**Interfaces:**
- Consumes (Task 1): `NATIVE_CONFIRM_TITLE`, `NATIVE_FEE_LINE`, `NATIVE_PROMPT_TITLE`, `NATIVE_PROMPT_SUBTITLE`; `BANNED_WORDS` from `copyScan.ts`.
- Produces: the resource values `a0_confirm_title = "Confirm making public"`, `a0_confirm_fee_line = "Relayer fee %1$s %2$s, taken from your private balance"`, `a0_prompt_title = "Approve making this public"`, `a0_prompt_subtitle = "Confirm it is you to authorize this one transfer to public"`. String NAMES are unchanged (`A0ConfirmController.kt` reads them by name; `theResourceHasEveryStringTheCodeNames` holds the set equal). No Kotlin source changes; security behaviour is unchanged (spec §4).

- [ ] **Step 1: Write the failing tests**

Create `src/copy/__tests__/nativeStrings.test.ts`:

```ts
/**
 * Shielded UX part B (spec §2 row 9, §4 "Native confirmation"): the Android dialog cannot import
 * src/copy/modes.ts, so this holds its resource equal to the module, and free of the banned words.
 */
import * as fs from 'fs';
import * as path from 'path';
import {NATIVE_CONFIRM_TITLE, NATIVE_FEE_LINE, NATIVE_PROMPT_SUBTITLE, NATIVE_PROMPT_TITLE} from '../modes';
import {BANNED_WORDS} from '../__testing__/copyScan';

const XML = fs.readFileSync(path.resolve(__dirname, '../../../android/app/src/main/res/values/a0_confirm_strings.xml'), 'utf8');

function value(name: string): string {
  const m = new RegExp(`<string name="${name}">([^<]*)</string>`).exec(XML);
  if (m === null) throw new Error(`no string ${name}`);
  return m[1]!;
}

describe('the native confirmation resource speaks the one vocabulary', () => {
  it('the four strings equal the module', () => {
    expect(value('a0_confirm_title')).toBe(NATIVE_CONFIRM_TITLE);
    expect(value('a0_confirm_fee_line')).toBe(NATIVE_FEE_LINE);
    expect(value('a0_prompt_title')).toBe(NATIVE_PROMPT_TITLE);
    expect(value('a0_prompt_subtitle')).toBe(NATIVE_PROMPT_SUBTITLE);
  });

  it('no string value carries a banned word (positive control: the scan sees ten strings)', () => {
    const values = [...XML.matchAll(/<string name="[^"]+">([^<]*)<\/string>/g)].map(m => m[1]!);
    expect(values.length).toBe(10);
    expect(values.filter(v => BANNED_WORDS.test(v))).toEqual([]);
  });
});
```

In `A0ConfirmTextTest.kt`: the three `assertEquals("Relayer fee 0.00001 … , taken from your shielded balance", t.feeLine)` rows become `taken from your private balance` (NOC, TEST, NOC), the class comment's `"taken from your shielded balance" (I7)` becomes `"taken from your private balance" (I7; part B wording)`, and add the test:

```kotlin
    @Test
    fun theDialogSpeaksTheOneVocabulary() {
        // Shielded UX part B (spec 2026-11-20 §2 row 9): the four user-facing strings, verbatim
        assertEquals("Confirm making public", strings.getValue("a0_confirm_title"))
        assertEquals("Relayer fee %1\$s %2\$s, taken from your private balance", strings.getValue("a0_confirm_fee_line"))
        assertEquals("Approve making this public", strings.getValue("a0_prompt_title"))
        assertEquals("Confirm it is you to authorize this one transfer to public", strings.getValue("a0_prompt_subtitle"))
        // none of the words part B removed, in any string of the resource (positive control: all ten are read)
        assertEquals(10, strings.size)
        val banned = Regex("(?i)(?<![\\w+/-])(un)?shield(ed|ing|s)?(?![\\w-])|(?<![\\w+/-])(transparent|vaults?)(?![\\w-])")
        for ((name, v) in strings) assertTrue("banned word in $name: '$v'", !banned.containsMatchIn(v))
    }
```

In `privacyClaims.test.ts` → `it('the native confirmation strings resource carries none of them', …)`: `expect(xml).toContain('taken from your shielded balance');` → `expect(xml).toContain('taken from your private balance'); // part B: the wording, not the guard, changed`; and `xml.replace('Confirm unshield', 'Confirm your unlinkable unshield')` → `xml.replace('Confirm making public', 'Confirm your unlinkable exit')`. The `UNSUPPORTED` list and `unsupportedClaims` stay as they are.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/copy/__tests__/nativeStrings.test.ts src/screens/shielded/__tests__/privacyClaims.test.ts`
Expected: FAIL — `a0_confirm_title` is `Confirm unshield`; the guard's positive control no longer finds `taken from your private balance`, and its planted replace finds no `Confirm making public` (`expect(planted).not.toBe(xml)` fails — the control proves it is a control).

Run the Kotlin test (Step 5's command) — expected: `A0ConfirmTextTest` fails on the three fee lines and `theDialogSpeaksTheOneVocabulary`.

- [ ] **Step 3: Change the resource**

In `android/app/src/main/res/values/a0_confirm_strings.xml` replace the four values (names, order and the other six strings unchanged), and add one line to the header comment: `Shielded UX part B (spec 2026-11-20 §2 row 9): the user-facing words are "making public" / "private balance"; src/copy/__tests__/nativeStrings.test.ts holds them equal to src/copy/modes.ts.`

```xml
    <string name="a0_confirm_title">Confirm making public</string>
    <string name="a0_confirm_fee_line">Relayer fee %1$s %2$s, taken from your private balance</string>
    <string name="a0_prompt_title">Approve making this public</string>
    <string name="a0_prompt_subtitle">Confirm it is you to authorize this one transfer to public</string>
```

- [ ] **Step 4: Run the Jest tests to verify they pass**

Run: `npx jest src/copy src/screens/shielded/__tests__/privacyClaims.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the Kotlin JVM job (as CI runs it)**

```bash
cd android && CLASSES="com.nocturawallet.prover.A0ConfirmMachineTest com.nocturawallet.prover.A0AuthenticatorsTest com.nocturawallet.prover.A0ConfirmTextTest com.nocturawallet.prover.ReactSurfaceTest com.nocturawallet.prover.A0AbiTest com.nocturawallet.prover.A0ResultTest com.nocturawallet.prover.A0SeedTest com.nocturawallet.prover.M1aCheckpointDeviceFailuresTest" && \
  args=(); for c in $CLASSES; do args+=(--tests "$c"); done && \
  ./gradlew :app:testDebugUnitTest "${args[@]}" --console=plain --max-workers=2 \
    -Pkotlin.compiler.execution.strategy=in-process -PreactNativeArchitectures=arm64-v8a; echo "gradle=$?"; cd .. && \
  node --no-warnings --test scripts/android-jvm/check-reports.test.mjs && \
  node scripts/android-jvm/check-reports.mjs android/app/build/test-results/testDebugUnitTest $CLASSES; echo "check=$?"
```

Expected: `gradle=0`; `check-reports.mjs` prints every named class with ≥ 1 test, 0 failures / errors / skipped, and `check=0`. `A0ConfirmTextTest` now runs 8 tests (7 + 1).

- [ ] **Step 6: Mutation (must go red, then revert)**

Set `a0_prompt_title` back to `Approve this unshield` → `nativeStrings.test.ts` (both rows) and `theDialogSpeaksTheOneVocabulary` fail. Revert.

- [ ] **Step 7: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: jest green; tsc 0; lint `✖ 144 problems (0 errors, 144 warnings)`; TGE check 0. (The Kotlin job of Step 5 is this task's fifth gate.)

- [ ] **Step 8: Commit**

```bash
git add android/app/src/main/res/values/a0_confirm_strings.xml android/app/src/test/java/com/nocturawallet/prover/A0ConfirmTextTest.kt src/copy/__tests__/nativeStrings.test.ts src/screens/shielded/__tests__/privacyClaims.test.ts
git commit -m "feat(shielded-ux-b): the native confirmation in the one vocabulary — Confirm making public, private balance (part B Task 6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**What only the phone proves (the final phone pass, after the APK):** `A0ConfirmWindowTest` passes again on the phone (spec §4) — install the devnet APK and its test APK (`assembleReleaseAndroidTest`, which needs `NOCTURA_A0_KEYS_DIR`, M1a's rule), then:

```bash
adb shell am instrument -w -r -e class com.nocturawallet.prover.A0ConfirmWindowTest \
  com.nocturawallet.devnet.test/androidx.test.runner.AndroidJUnitRunner
```

and, by eye: the dialog's title "Confirm making public", the fee line "… taken from your private balance", the BiometricPrompt "Approve making this public" / "Confirm it is you to authorize this one transfer to public", part A's layout unchanged. `scripts/m1c-checkpoint/README.md` still quotes the old words (plan A9); the phone pass reads the new ones.

---
### Task 7: The import's smart account choice (decision B-6)

**Files:**
- Modify: `src/screens/onboarding/SelectAccountScreen.tsx` (whole file replaced below)
- Create: `src/screens/onboarding/__tests__/SelectAccountScreen.test.tsx`
- Modify: `src/screens/shielded/__tests__/privacyClaims.test.ts` (scope)
- Unchanged (spec §4): `src/modules/keyDerivation/accountDetection.ts` and its test.

**Interfaces:**
- Consumes: `detectFundedAccounts(seed: Uint8Array): Promise<DetectionResult>` and `AccountCandidate {scheme; address; lamports: bigint; nocAmount: bigint; funded: boolean}` (unchanged; funded candidates sorted first); `schemeLabel`, `schemeToString`, `DEFAULT_TRANSPARENT_SCHEME` from `src/modules/keyDerivation/transparent`.
- Produces: `type AccountChoiceView = 'loading' | 'one' | 'funded' | 'none' | 'all'`; `accountChoiceView(loading: boolean, detectFailed: boolean, showAll: boolean, candidates: readonly AccountCandidate[]): AccountChoiceView` (pure, exported); test ids `select-account-found`, `select-account-found-address`, `select-account-found-balance`, `select-account-none`, `select-account-none-address`, `select-account-different`, and the unchanged `account-candidate-<scheme>`, `select-account-retry`, `select-account-continue`. `SelectAccountScreen`'s props are unchanged.

The four cases (spec §4, decision B-6), and what Continue picks in each:

| Balances | Shown | Preselected (Continue picks it) |
|---|---|---|
| resolved, exactly one funded | "We found your wallet", its address and balance, Continue, "Use a different account" (reveals the full list) | that account |
| resolved, more than one funded | the funded ones only, plus "Use a different account" | the first funded (detection order) |
| resolved, none funded | "No funds found yet. You can receive to this address." with standard account 0's address, and the same link | standard account 0 |
| the balance RPC failed (or detection threw) | today's warning + Retry, and the full list | standard account 0 |

It never picks silently: every case shows the account Continue will use before the tap.

- [ ] **Step 1: Write the failing tests**

Create `src/screens/onboarding/__tests__/SelectAccountScreen.test.tsx`:

```tsx
/**
 * Shielded UX part B, decision B-6 (spec §4 "Import, smart account choice"): one funded account →
 * "We found your wallet"; several → the funded ones; none → standard account 0 with "No funds found
 * yet"; the balance RPC failed → the warning and the full list. Never a silent pick. The detection
 * (`detectFundedAccounts`) is stubbed: its own suite proves it.
 */
import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import type {AccountCandidate, DetectionResult} from '../../../modules/keyDerivation/accountDetection';
import type {TransparentScheme} from '../../../modules/keyDerivation/transparent';

jest.mock('../../../modules/screenSecurity/screenSecurityModule', () => ({
  ScreenSecurityManager: class {
    enableSecureScreen() {
      return Promise.resolve();
    }
    disableSecureScreen() {
      return Promise.resolve();
    }
  },
}));
jest.mock('../../../modules/keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: () => Promise.resolve(new Uint8Array(64).fill(7)),
}));
const mockDetect = jest.fn<Promise<DetectionResult>, [Uint8Array]>();
jest.mock('../../../modules/keyDerivation/accountDetection', () => ({
  detectFundedAccounts: (seed: Uint8Array) => mockDetect(seed),
}));

import {SelectAccountScreen, accountChoiceView} from '../SelectAccountScreen';

const S = (account: number): TransparentScheme => ({kind: 'slip10', account});
const CLI: TransparentScheme = {kind: 'cli'};
const addr = (tag: string) => `${tag}${'x'.repeat(44 - tag.length)}`;
function cand(scheme: TransparentScheme, tag: string, lamports = 0n, nocAmount = 0n): AccountCandidate {
  return {scheme, address: addr(tag), lamports, nocAmount, funded: lamports > 0n || nocAmount > 0n};
}
/** detection's order: funded first, then the rest in derivation order */
function all(funded: AccountCandidate[]): AccountCandidate[] {
  const rest = [S(0), S(1), S(2), S(3), S(4), CLI]
    .filter(s => !funded.some(f => JSON.stringify(f.scheme) === JSON.stringify(s)))
    .map((s, i) => cand(s, `Empty${i}`));
  return [...funded, ...rest];
}

const onSelect = jest.fn();
beforeEach(() => {
  mockDetect.mockReset();
  onSelect.mockReset();
});

async function screen() {
  const r = render(<SelectAccountScreen mnemonic="abandon abandon" onSelect={onSelect} />);
  await waitFor(() => expect(r.queryByText('Looking for your accounts…')).toBeNull());
  return r;
}
type R = Awaited<ReturnType<typeof screen>>;
const ids = (r: R) => r.queryAllByTestId(/^account-candidate-/).map(e => e.props.testID as string);

describe('the import\'s account choice (decision B-6)', () => {
  it('exactly one funded: "We found your wallet", its address and balance; no list; Continue picks it — not before the tap', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(S(2), 'Funded2', 1_500_000_000n, 25_000_000_000n)]), balancesResolved: true});
    const r = await screen();
    expect(r.getByText('We found your wallet')).toBeTruthy();
    expect(r.getByTestId('select-account-found-address').props.children).toBe('Funded...xxxx');
    expect(r.getByTestId('select-account-found-balance').props.children).toBe('1.5 SOL · 25 NOC');
    expect(ids(r)).toEqual([]);
    expect(onSelect).not.toHaveBeenCalled(); // never a silent pick
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(2));
  });

  it('one funded → "Use a different account" reveals all six; a pick there is what Continue uses', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(S(2), 'Funded2', 1n)]), balancesResolved: true});
    const r = await screen();
    fireEvent.press(r.getByTestId('select-account-different'));
    expect(ids(r)).toHaveLength(6);
    expect(r.queryByText('We found your wallet')).toBeNull();
    fireEvent.press(r.getByTestId('account-candidate-slip10:0'));
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(0));
  });

  it('several funded: only the funded ones are listed, the first preselected; the link reveals the rest', async () => {
    mockDetect.mockResolvedValue({
      candidates: all([cand(S(1), 'Funded1', 2n), cand(CLI, 'FundedC', 0n, 3n)]),
      balancesResolved: true,
    });
    const r = await screen();
    expect(ids(r)).toEqual(['account-candidate-slip10:1', 'account-candidate-cli']);
    expect(r.queryByText('We found your wallet')).toBeNull();
    fireEvent.press(r.getByTestId('select-account-different'));
    expect(ids(r)).toHaveLength(6);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(1));
  });

  it('none funded (balances resolved): standard account 0 with "No funds found yet …" and its address; Continue picks account 0; the link reveals all', async () => {
    mockDetect.mockResolvedValue({candidates: all([]), balancesResolved: true});
    const r = await screen();
    expect(r.getByText('No funds found yet. You can receive to this address.')).toBeTruthy();
    expect(r.getByTestId('select-account-none-address').props.children).toBe('Empty0...xxxx');
    expect(r.queryByText('We found your wallet')).toBeNull();
    expect(ids(r)).toEqual([]);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(0));
    fireEvent.press(r.getByTestId('select-account-different'));
    expect(ids(r)).toHaveLength(6);
  });

  it('the balance RPC failed: today\'s warning, Retry, the FULL list; neither smart view', async () => {
    mockDetect.mockResolvedValue({candidates: all([]), balancesResolved: false});
    const r = await screen();
    expect(r.getByText(/Couldn't check balances right now/)).toBeTruthy();
    expect(r.getByTestId('select-account-retry')).toBeTruthy();
    expect(ids(r)).toHaveLength(6);
    expect(r.queryByText('We found your wallet')).toBeNull();
    expect(r.queryByText(/No funds found yet/)).toBeNull();
    expect(r.queryByTestId('select-account-different')).toBeNull();
  });

  it('Review Focus 4: a Retry after a failed RPC that now finds ONE funded account shows "We found your wallet" (the full-list state is reset)', async () => {
    mockDetect.mockResolvedValueOnce({candidates: all([]), balancesResolved: false});
    mockDetect.mockResolvedValueOnce({candidates: all([cand(S(3), 'Funded3', 9n)]), balancesResolved: true});
    const r = await screen();
    fireEvent.press(r.getByTestId('select-account-retry'));
    await waitFor(() => expect(r.getByText('We found your wallet')).toBeTruthy());
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(3));
  });

  it('Review Focus 4: a wallet whose only funded account is the CLI scheme is offered that account', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(CLI, 'FundedC', 5n)]), balancesResolved: true});
    const r = await screen();
    expect(r.getByText('We found your wallet')).toBeTruthy();
    expect(r.getByText('Solana CLI (solana-keygen)')).toBeTruthy();
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(CLI);
  });

  it('detection threw: the warning, standard account 0 for Continue', async () => {
    mockDetect.mockRejectedValue(new Error('boom'));
    const r = await screen();
    expect(r.getByText(/Couldn't check balances right now/)).toBeTruthy();
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(0));
  });
});

describe('accountChoiceView (pure)', () => {
  const one = [cand(S(0), 'A', 1n), cand(S(1), 'B')];
  it.each([
    ['loading wins', true, false, false, one, 'loading'],
    ['a failed RPC shows all', false, true, false, one, 'all'],
    ['"Use a different account" shows all', false, false, true, one, 'all'],
    ['one funded', false, false, false, one, 'one'],
    ['two funded', false, false, false, [cand(S(0), 'A', 1n), cand(S(1), 'B', 1n)], 'funded'],
    ['none funded', false, false, false, [cand(S(0), 'A')], 'none'],
  ] as const)('%s', (_n, loading, failed, showAll, c, expected) => {
    expect(accountChoiceView(loading, failed, showAll, c)).toBe(expected);
  });
});
```

In `privacyClaims.test.ts` add `path.join(ROOT, 'src/screens/onboarding/SelectAccountScreen.tsx'),` to `EXTRA_COPY` (comment `// part B: the import's account choice is new copy`) and to the positive control's list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/screens/onboarding/__tests__/SelectAccountScreen.test.tsx src/screens/shielded/__tests__/privacyClaims.test.ts`
Expected: FAIL — `accountChoiceView` is not exported; "We found your wallet" not found.

- [ ] **Step 3: Replace `src/screens/onboarding/SelectAccountScreen.tsx`**

```tsx
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Check, Wallet} from 'lucide-react-native';
import {Text, Button, Card} from '../../components/ui';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {
  detectFundedAccounts,
  type AccountCandidate,
} from '../../modules/keyDerivation/accountDetection';
import {
  schemeLabel,
  schemeToString,
  DEFAULT_TRANSPARENT_SCHEME,
  type TransparentScheme,
} from '../../modules/keyDerivation/transparent';
import {zeroize} from '../../modules/session/zeroize';
import {formatAddress} from '../../utils/formatAddress';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {cn} from '../../utils/cn';

/**
 * Import account picker. After the seed is validated, derive candidate
 * addresses (SLIP-0010 accounts 0-4 + the solana-keygen "cli" scheme), query
 * on-chain SOL + NOC balances, and let the user confirm the account to use.
 *
 * Shielded UX part B, decision B-6 (spec 2026-11-20 §4) — the smart choice:
 *   - exactly one funded → "We found your wallet", its address and balance,
 *     Continue, and "Use a different account" (the full list);
 *   - more than one funded → the funded ones only, plus the same link;
 *   - none funded (balances resolved) → standard account 0, "No funds found
 *     yet. You can receive to this address.", and the link;
 *   - the balance RPC failed → the warning + Retry and the full list.
 * It never picks silently: the account Continue uses is on screen before the
 * tap. The detection itself (`detectFundedAccounts`) is unchanged.
 *
 * Shown ONLY in the import flow. The create flow never visits this screen, so
 * new wallets keep the default standard scheme (SLIP-0010 account 0).
 *
 * FLAG_SECURE is enabled because candidate addresses are derived from the seed
 * held in memory while this screen is mounted.
 */
interface SelectAccountScreenProps {
  mnemonic: string;
  onSelect: (scheme: TransparentScheme) => void;
  onBack?: () => void;
}

export type AccountChoiceView = 'loading' | 'one' | 'funded' | 'none' | 'all';

/** decision B-6: which view the account choice shows. Pure. */
export function accountChoiceView(
  loading: boolean,
  detectFailed: boolean,
  showAll: boolean,
  candidates: readonly AccountCandidate[],
): AccountChoiceView {
  if (loading) return 'loading';
  if (detectFailed || showAll) return 'all';
  const funded = candidates.filter(c => c.funded).length;
  return funded === 1 ? 'one' : funded > 1 ? 'funded' : 'none';
}

const securityManager = new ScreenSecurityManager();
const SOL_DECIMALS = 9;
const NOC_DECIMALS = 9;

function balanceText(c: AccountCandidate): string {
  const noc = c.nocAmount > 0n ? ` · ${formatTokenAmount(c.nocAmount, NOC_DECIMALS)} NOC` : '';
  return `${formatTokenAmount(c.lamports, SOL_DECIMALS)} SOL${noc}`;
}

export function SelectAccountScreen({
  mnemonic,
  onSelect,
  onBack,
}: SelectAccountScreenProps) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<AccountCandidate[]>([]);
  const [detectFailed, setDetectFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(
    schemeToString(DEFAULT_TRANSPARENT_SCHEME),
  );
  const selectedSchemeRef = useRef<TransparentScheme>(DEFAULT_TRANSPARENT_SCHEME);

  useEffect(() => {
    void securityManager.enableSecureScreen();
    return () => {
      void securityManager.disableSecureScreen();
    };
  }, []);

  const runDetection = useCallback(async () => {
    if (!mnemonic) {
      setDetectFailed(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setDetectFailed(false);
    setShowAll(false); // Review Focus 4: a Retry starts from the smart view again
    let seed: Uint8Array | undefined;
    try {
      seed = await mnemonicToSeed(mnemonic);
      const found = await detectFundedAccounts(seed);
      setCandidates(found.candidates);
      // A failed balance RPC still returns the (locally-derived) addresses; flag
      // it so the user sees the warning + retry rather than a silent wrong pick.
      setDetectFailed(!found.balancesResolved);
      // Pre-select the first funded candidate, else standard account 0.
      const preferred =
        found.candidates.find(c => c.funded)?.scheme ??
        DEFAULT_TRANSPARENT_SCHEME;
      selectedSchemeRef.current = preferred;
      setSelectedKey(schemeToString(preferred));
    } catch {
      setDetectFailed(true);
    } finally {
      // Zeroize the seed on EVERY path (success or throw) — it's sensitive.
      if (seed) {
        zeroize(seed);
      }
      setLoading(false);
    }
  }, [mnemonic]);

  useEffect(() => {
    void runDetection();
  }, [runDetection]);

  const handlePick = useCallback((scheme: TransparentScheme) => {
    selectedSchemeRef.current = scheme;
    setSelectedKey(schemeToString(scheme));
  }, []);

  const handleContinue = useCallback(() => {
    onSelect(selectedSchemeRef.current);
  }, [onSelect]);

  const view = accountChoiceView(loading, detectFailed, showAll, candidates);
  const funded = candidates.filter(c => c.funded);
  const standard =
    candidates.find(c => schemeToString(c.scheme) === schemeToString(DEFAULT_TRANSPARENT_SCHEME)) ?? null;
  const listed = view === 'funded' ? funded : candidates;
  const different = (
    <Pressable
      onPress={() => setShowAll(true)}
      accessibilityRole="button"
      accessibilityLabel="Use a different account"
      testID="select-account-different"
      hitSlop={8}
      className="min-h-touch-min justify-center">
      <Text variant="body-sm" className="text-accent-transparent font-geist-semibold">
        Use a different account
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-12 h-12 items-center justify-center -ml-2">
            <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
        ) : (
          <View className="w-12 h-12" />
        )}
        <Text variant="h2" className="ml-1 flex-1">
          Choose account
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="flex-grow pb-4"
        showsVerticalScrollIndicator={false}>
        {view === 'loading' ? (
          <View className="px-5 py-10 items-center gap-3">
            <ActivityIndicator size="small" color="#B084FC" />
            <Text variant="body-sm" className="text-fg-tertiary">
              Looking for your accounts…
            </Text>
          </View>
        ) : view === 'one' ? (
          <View className="px-5 gap-3" testID="select-account-found">
            <Text variant="h2">We found your wallet</Text>
            <Card padding="p-4">
              <Text variant="body" className="text-fg-primary">
                {schemeLabel(funded[0]!.scheme)}
              </Text>
              <Text variant="caption" mono className="text-fg-tertiary mt-0.5" testID="select-account-found-address">
                {formatAddress(funded[0]!.address)}
              </Text>
              <Text variant="caption" className="text-fg-secondary mt-1" testID="select-account-found-balance">
                {balanceText(funded[0]!)}
              </Text>
            </Card>
            {different}
          </View>
        ) : view === 'none' ? (
          <View className="px-5 gap-3" testID="select-account-none">
            <Text variant="body" className="text-fg-primary">
              No funds found yet. You can receive to this address.
            </Text>
            {standard ? (
              <Card padding="p-4">
                <Text variant="body" className="text-fg-primary">
                  {schemeLabel(standard.scheme)}
                </Text>
                <Text variant="caption" mono className="text-fg-tertiary mt-0.5" testID="select-account-none-address">
                  {formatAddress(standard.address)}
                </Text>
              </Card>
            ) : null}
            {different}
          </View>
        ) : (
          <>
            <View className="px-5 mb-4">
              <Text variant="body" className="text-fg-secondary">
                We checked this recovery phrase for on-chain balances. Pick the
                account you want to use.
              </Text>
            </View>
            <View className="px-5 gap-2">
              {detectFailed ? (
                <View className="mb-2 p-4 rounded-md bg-bg-surface-2 border-l-2 border-l-warning gap-3">
                  <Text variant="body-sm" className="text-fg-primary">
                    Couldn't check balances right now. You can continue with the
                    standard account and switch later.
                  </Text>
                  <Button
                    label="Try again"
                    variant="secondary"
                    onPress={() => void runDetection()}
                    testID="select-account-retry"
                  />
                </View>
              ) : null}

              {listed.map(c => (
                <CandidateCard
                  key={schemeToString(c.scheme)}
                  candidate={c}
                  selected={schemeToString(c.scheme) === selectedKey}
                  balanceKnown={!detectFailed}
                  onPick={handlePick}
                />
              ))}
              {view === 'funded' ? different : null}
            </View>
          </>
        )}

        <View className="flex-1" />
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 pb-8 pt-2">
        <Button
          label="Continue"
          variant="primary"
          onPress={handleContinue}
          disabled={loading}
          testID="select-account-continue"
        />
      </View>
    </SafeAreaView>
  );
}

function CandidateCard({
  candidate: c,
  selected,
  balanceKnown,
  onPick,
}: {
  candidate: AccountCandidate;
  selected: boolean;
  balanceKnown: boolean;
  onPick: (scheme: TransparentScheme) => void;
}) {
  const key = schemeToString(c.scheme);
  return (
    <Pressable
      onPress={() => onPick(c.scheme)}
      accessibilityRole="button"
      testID={`account-candidate-${key}`}>
      <Card padding="p-4">
        <View className="flex-row items-center gap-3">
          <View
            className={cn(
              'w-10 h-10 rounded-full items-center justify-center',
              selected ? 'bg-[rgba(176,132,252,0.18)]' : 'bg-bg-surface-2',
            )}>
            {selected ? (
              <Check size={20} color="#B084FC" strokeWidth={2.25} />
            ) : (
              <Wallet size={18} color="#A8ACB5" strokeWidth={1.75} />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text variant="body" className="text-fg-primary">
                {schemeLabel(c.scheme)}
              </Text>
              {c.funded ? (
                <View className="px-2 py-0.5 rounded-pill bg-[rgba(63,214,139,0.16)]">
                  <Text variant="caption" className="text-success">
                    Funded
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" mono className="text-fg-tertiary mt-0.5">
              {formatAddress(c.address)}
            </Text>
            {balanceKnown ? (
              <Text variant="caption" className="text-fg-secondary mt-1">
                {balanceText(c)}
              </Text>
            ) : (
              <Text variant="caption" className="text-fg-tertiary mt-1">
                Balance unavailable
              </Text>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/screens/onboarding src/modules/keyDerivation src/copy src/screens/shielded/__tests__/privacyClaims.test.ts`
Expected: PASS (`accountDetection.test.ts` unedited and green).

- [ ] **Step 5: Mutations (each must go red, then revert)**

1. `accountChoiceView`: `funded === 1 ? 'one'` → `funded >= 1 ? 'one'` → the "several funded" row fails.
2. Remove `setShowAll(false)` from `runDetection` and make the failed view set `showAll` true → Review Focus 4's retry row fails. (Revert both.)
3. `listed = view === 'funded' ? funded : candidates` → `listed = candidates` → "only the funded ones are listed" fails.

- [ ] **Step 6: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: jest green; tsc 0; lint `✖ 144 problems (0 errors, 144 warnings)` — if the `funded[0]!` non-null assertions raise a new warning under the project's rules, bind `const first = funded[0];` above the JSX and render the `'one'` branch only when `view === 'one' && first !== undefined`; TGE check 0.

- [ ] **Step 7: Commit**

```bash
git add src/screens/onboarding src/screens/shielded/__tests__/privacyClaims.test.ts
git commit -m "feat(onboarding): the import's smart account choice — we found your wallet, funded only, none funded, RPC failed (part B Task 7, decision B-6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: The owner's design files (decision B-7) — edit COPIES, show the diff, install only after the owner approves

**Files (outside the repo — nothing in the repo changes in this task):**
- Read only until approval: `/home/user/Downloads/index.html`, `/home/user/Downloads/screen.md` (the originals stay untouched while the approval is pending — every other session reads them as the binding design, CLAUDE.md)
- Create (work dir): `$W/index.html`, `$W/screen.md` (the copies being edited), `$W/stage1/` (the copies after the word swaps), `$W/design-b.1-words.index.diff`, `$W/design-b.1-words.screen.diff`, `$W/design-b.2-phones.index.diff`, `$W/design-b.2-phones.screen.diff`
- Create only after approval: `/home/user/Downloads/index.html.bak-2026-11-20`, `/home/user/Downloads/screen.md.bak-2026-11-20`; then the approved copies replace the originals.

**Interfaces:**
- Consumes: the strings of Tasks 1–7 exactly as merged on this branch (the design must say what the code says); test ids are not drawn.
- Produces: an updated design for #8, #11, #16, #17, #18, #19, #20, #21 and the native dialog, in the existing design-system classes; colours and every other screen untouched.

**THE GATE (spec §5, binding; review I-6):** the implementer edits copies, produces the diffs, hands their absolute paths back to the controller, and stops. The controller shows them to the owner. Only the owner's own message in chat is an approval — no agent's message (the implementer's, a reviewer's, the controller's) counts as one. Until the owner approves, the originals in `Downloads` are not touched, and nothing else on the branch proceeds (no final review, no APK, no phone pass). On a rejection or change request, the copies are edited and the diffs shown again; the originals were never changed, so nothing needs restoring. There is no repo commit for these files at any point; the approval is recorded in the PR description.

- [ ] **Step 1: Make the work copies**

```bash
W=$(mktemp -d -t design-b-XXXXXX)   # or the executing session's scratchpad directory
cp -p /home/user/Downloads/index.html /home/user/Downloads/screen.md "$W/"
sha256sum /home/user/Downloads/index.html "$W/index.html" /home/user/Downloads/screen.md "$W/screen.md"
echo "$W"
```

Expected: each pair prints the same hash. Every later command in this task works in `$W`.

- [ ] **Step 2: The check, with its positive control, BEFORE editing**

The check is case-insensitive and computes its section ranges from the `id="sN"` anchors at run time (the edits insert phones, so fixed line numbers go stale):

```bash
cat > "$W/check.sh" <<'EOF'
#!/usr/bin/env bash
# usage: check.sh <index.html>  — prints every visible banned word inside the part B sections
f="$1"
awk '
  /<section/ { on = 0 }                     # any section ends the previous range (some use id="screen-NN")
  /<section[^>]* id="s[0-9]+"/ { match($0, /id="s[0-9]+"/); id = substr($0, RSTART + 4, RLENGTH - 5); on = (id == "s8" || id == "s11" || id == "s16" || id == "s17" || id == "s18" || id == "s19" || id == "s20" || id == "s21") }
  on {
    line = $0
    gsub(/<[^>]*>/, " ", line)            # drop tags: class names, ids, data-mode, href are not visible text
    if (tolower(line) ~ /(^|[^a-z0-9+\/-])(un)?shield(ed|ing|s)?([^a-z0-9-]|$)|(^|[^a-z0-9+\/-])(transparent|vaults?)([^a-z0-9-]|$)/) print FILENAME ":" NR ": " line
  }
' "$f"
EOF
chmod +x "$W/check.sh"
"$W/check.sh" /home/user/Downloads/index.html | wc -l
"$W/check.sh" /home/user/Downloads/index.html | grep -ci 'SHIELDED · vault balance'
```

Expected (positive control): the first count is well above 0 on the untouched original, and the second is ≥ 1 — the check sees the upper-case "SHIELDED · vault balance" that a case-sensitive grep missed. If either is 0, the check is broken: fix it before editing. (CSS rules inside `<style>` sit before the first `<section>`, so they are outside the ranges.)

- [ ] **Step 3: Read before editing**

Read, in `$W/index.html`, the sections `id="s8"`, `id="s11"`, `id="s16"`, `id="s17"`, `id="s18"`, `id="s19"`, `id="s20"`, `id="s21"` (find each with `grep -n 'id="s<N>"'`) — each one's phones (`.phone-wrap > .phone > .screen`), its `.state-label`s and its tables (B) DS class map, (C) States rendered, (D) Global rules, (E) Navigation exits, (F) Android-specific; and the CSS blocks `.s-dash`, `.s-shield`, `.s-zk`, `.s-stat`, `.s-import`. In `$W/screen.md`, §0 (Global rules) and the entries `8 · import`, `11 · dashboard`, `16 · shield-unshield`, `17 · shielded-explainer`, `18 · zk-proof`, `19`, `20`, `21`. List every state each one draws before changing any.

- [ ] **Step 4: Stage 1 — word swaps in the existing phones and text only (review M-8: the owner reviews this diff alone)**

In `$W/index.html` (existing classes and tokens only; no new colour, no other screen; CSS class names such as `.s-shield`, `data-mode="shielded"`, `--accent-shielded`, `.amount-card.shielded` are identifiers and are NOT renamed):

- **§s11 dashboard:** `.mode-toggle` "Transparent" → "Public", "Shielded" → "Private" in every phone; the shielded phone's hero `.noc-overline` "SHIELDED · vault balance" → "PRIVATE BALANCE"; `.section-h` "SHIELDED ASSETS" → "PRIVATE ASSETS"; the rows' "· shielded" → "· private"; the `.presale`-styled card "Privacy is on / Sends from this view use ZK proofs" → "Private balance / Make private moves tokens in with a proof made on this device. Deposits are public on chain."; state labels "Loaded · transparent" / "Loaded · shielded" → "Loaded · public" / "Loaded · private".
- **§s16:** `.top-bar .title` "Shield / Unshield" → "Private ⇄ Public" in every phone; the lede's "transparent and shielded vault" → "your public and private balances"; "Available" → "Public balance"; "Vault balance" → "Private balance"; "You'll shield" → "You'll make private"; "You'll receive" → "Destination receives"; sticky CTAs "Shield SOL" → "Make SOL private", "Unshield SOL" → "Make SOL public", "Shield 2.48 SOL"-style labels → "Make 2.48 SOL private"; the Make public `.banner.warning` keeps its title and its body becomes "The relayer pays for and submits this transaction, so no key of yours signs it. Amounts and timing are public.".
- **§s17:** "Shielded intro" → "Private intro"; overline "SHIELDED" → "PRIVATE"; "Move into vault" → "Move into your private balance"; "Shielded mode moves …" → "Private mode moves …".
- **§s18:** header "SHIELDED" → "PRIVATE" with the title "Making private…"; stages "Building witness / Proving / Verifying / Ready" → "Prepare / Make the proof / Check the proof / Ready" with measured times, never a percentage; hero labels "Building witness" → "Preparing", "Proving" → "Making the proof", "Verifying" → "Checking the proof". State 7 (hosted-prover sheet) is left as drawn.
- **§s19 / §s20 (shielded variants):** "SHIELDED Review" / "SHIELDED Confirm" → "PRIVATE Review" / "PRIVATE Confirm"; "Shield 2.48 SOL" → "Make 2.48 SOL private"; "You are about to send privately" → "You are about to make this private"; "Shielded pool" → "Pool" / "the pool" (A11).
- **§s21:** state 4 "success · shielded": `Shielded … Sent` → `Private … Make private`, `.amount-card.shielded .eyebrow` "SHIELDED" → "PRIVATE", title "Now private", and the caption "Your deposit is public on chain." under the amount; "View details" stays.

In `$W/screen.md`: §0 — after "Mode awareness" add "Vocabulary (part B, 2026-11-20): user-visible copy says only Public / Private (Make private, Make public, Private balance, Public balance, Now public, Now private …); `data-mode="shielded"` and the `shielded` CSS names stay as identifiers." and "vsak Shielded screen" → "vsak Private screen"; `11`: "Mode toggle: Transparent ↔ Shielded" → "Mode toggle: Public ↔ Private"; `16`: the title → "Private ⇄ Public (Private)" (the key stays), "premikanje funds-ov med transparent in shielded vault" → "premikanje sredstev med javnim in zasebnim stanjem", "[Shield SOL] / [Unshield SOL]" → "[Make SOL private] / [Make SOL public]"; `17`: "Shielded intro" → "Private intro", "Move into vault" → "Move into your private balance"; `18`: the four stage names; `19`–`21`: the private variants' words.

Then snapshot and diff stage 1:

```bash
mkdir -p "$W/stage1" && cp -p "$W/index.html" "$W/screen.md" "$W/stage1/"
diff -u /home/user/Downloads/index.html "$W/index.html" > "$W/design-b.1-words.index.diff"; echo "exit=$?"
diff -u /home/user/Downloads/screen.md "$W/screen.md" > "$W/design-b.1-words.screen.diff"; echo "exit=$?"
```

Expected: both exits 1 (the copies differ from the originals).

- [ ] **Step 5: Stage 2 — the new phones and states (the second diff)**

In `$W/index.html`, using the existing classes of each section:

- **§s11:** in the "Loaded · private" phone: the `.change` "Anonymity set · 1,284" → a collapsed "Details ▾" row (a `<button>` styled like `.see-all`, `noc-body-sm`, `color:var(--fg-secondary)`); the `.sub-balance` row removed; `.quick` → "Make private" (`#i-shield-lock`), "Make public" (`#i-eye-on`), "Buy" (Send / Receive removed, as in the code until M2). New phone "Loaded · private · pending + Check again": "0.25 pending · not confirmed yet" (`color:var(--warning)`) and "Check again" (`color:var(--accent)`). Update (B) and (C).
- **§s16:** in each `.fee-card` the Network fee / ZK proof fee `.fee-row`s move under a collapsed "Details ▾" row (Make public keeps a visible "Relayer fee" row). New phones: **6 · Make public · destination collapsed** ("To: A new account (recommended) · Change"); **7 · destination open** (the three options with their one-line descriptions, radio circles, the first selected); **8 · fresh unavailable · nothing chosen** ("To: Choose a destination · Change", the reason "A new account is not available yet: …" under it, CTA disabled — owner decision A1); **9 · main account chosen** ("To: My main account", the warning "This links your exit to your deposit: your main account made the deposit." in `color:var(--warning)` under the row); **10 · over the limit** (amount in `--danger`, `.helper.error` "You can make up to 1.99999 SOL public at once.", CTA disabled); **11 · Details open** (Network fee "Paid by the relayer", ZK proof fee "None · made on this device", "You can make up to … public from one note at a time; combining notes comes in a later version."). Update (B) with DetailsDisclosure, DestinationRow, AmountLimitHint mapped to the classes used, and (C) "States rendered (11 of 11)".
- **§s18:** new phones **8 · Make public · stages** (header "PRIVATE · Making public…", rows "Check the pool / Relayer fee / Your approval / Make the proof" with measured metas) and **9 · native confirmation** (the dialog over the dimmed #18: "Confirm making public", "Destination (wallet address)" with the full mono address, "Token account", "Destination receives exactly 1.25 TEST (1250000000 base units)", "Relayer fee 0.00001 TEST, taken from your private balance", "Pool", Cancel / Approve; and the BiometricPrompt sheet "Approve making this public" / "Confirm it is you to authorize this one transfer to public", labelled "platform dialog · undrawn until now").
- **§s21:** new phones **5 · Now public** (check ring, "Now public", "The destination received 1.25 TEST.", "Your change, 0.74999 TEST, stays private.", collapsed "Details ▾", "Copy signature" + "Done", header "PRIVATE · Make public", badge "CONFIRMED") and **6 · Now public · Details open** (`.meta-grid`: "Tx hash" mono with copy, "Change" "#42 in the pool"). Update (B)/(C).
- **§s8 import:** four new phones in `.screen.s-import`: **account choice · one funded** ("We found your wallet", a card "Standard (Phantom/Solflare)", mono address, "1.5 SOL · 25 NOC", "Use a different account", Continue); **several funded** (two cards with "Funded" pills, the link); **none funded** ("No funds found yet. You can receive to this address." and account 0's card, the link); **balance check failed** ("Couldn't check balances right now. You can continue with the standard account and switch later.", "Try again", six cards "Balance unavailable"). Update (C) and (E) (import → choose account → import-success).

In `$W/screen.md`: `8` — "Account choice (decision B-6)" with its four cases (Task 7's table); `11` — Private mode's actions, "PRIVATE BALANCE" with "Anonymity set" in Details, "PRIVATE ASSETS", the pending caption with Check again, the Private balance card; `16` — one balance line per tab, Details ▾, DestinationRow (including "To: Choose a destination" when the fresh account is unavailable), AmountLimitHint, the CTAs "Make {amount} {sym} private / public"; `18` — the title "Making private…" / "Making public…", "never a percentage", the native dialog; `21` — the Make public result (Now public, the change line, Copy signature, Details with Tx hash and Change).

- [ ] **Step 6: Check and diff stage 2; hand over and STOP**

```bash
"$W/check.sh" "$W/index.html"; echo "check lines: $("$W/check.sh" "$W/index.html" | wc -l)"
grep -niE '\b(un)?shield(ed|ing)?\b|\btransparent\b|\bvault' "$W/screen.md" | grep -vE 'data-mode|shield-unshield|shielded-explainer|`[^`]*shield[^`]*`' ; echo "screen.md residue above (should be none)"
diff -u "$W/stage1/index.html" "$W/index.html" > "$W/design-b.2-phones.index.diff"; echo "exit=$?"
diff -u "$W/stage1/screen.md" "$W/screen.md" > "$W/design-b.2-phones.screen.diff"; echo "exit=$?"
wc -l "$W"/design-b.*.diff
```

Expected: `check lines: 0` (Step 2 proved the same check prints lines on the original); no `screen.md` residue (the screen keys `shield-unshield`, `shielded-explainer` and back-ticked identifiers are excluded on purpose); both `diff` exits 1. The implementer's report to the controller: the four diff paths (full absolute paths), a per-section summary of what changed in stage 1 and which phones stage 2 added, and the install command of Step 7. Then STOP. The controller shows the diffs to the owner and waits for the owner's own answer.

- [ ] **Step 7: Only after the owner's approval in chat — back up, then install**

```bash
cd /home/user/Downloads
test ! -e index.html.bak-2026-11-20 && test ! -e screen.md.bak-2026-11-20   # never overwrite an earlier backup
cp -p index.html index.html.bak-2026-11-20 && cp -p screen.md screen.md.bak-2026-11-20
sha256sum index.html index.html.bak-2026-11-20 screen.md screen.md.bak-2026-11-20
cp -p "$W/index.html" index.html
cp -p "$W/screen.md" screen.md
sha256sum index.html "$W/index.html" screen.md "$W/screen.md"
```

Expected: the `test` line exits 0 (if a backup already exists, STOP and ask the owner); the first `sha256sum` shows each original equal to its backup; the last shows each installed file equal to its approved copy. If the install itself goes wrong: `cp -p index.html.bak-2026-11-20 index.html && cp -p screen.md.bak-2026-11-20 screen.md`, and compare hashes again.

- [ ] **Step 8: Record**

The PR description gets: "design files updated 2026-11-20, approved by the owner on <the date of the owner's message>", the four diffs' `wc -l`, and the backup names. The backups stay (the owner deletes them). Then the branch proceeds: the final Fable review, the APK, the owner's phone pass (see "Closing").

---

## Execution notes (review I-7)

- **Per task:** one implementer (a fresh subagent, superpowers:subagent-driven-development) → a Fable task review of that task's diff against this plan and the spec → a fix loop by the implementer → a scoped Fable re-review of the fixes only → the next task. A task is not "done" until its re-review passes. Task 8's review happens on the diffs before they go to the owner.
- **After Task 8's owner approval:** a final Fable review of the whole branch (`main…HEAD`, or the part A base while #124 is open), then its fix loop and re-review.
- **Attribution:** every commit carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` whatever model implemented the task — the session-mandated attribution (controller ruling, as on PRs #123 / #124). The PR body states which model implemented and which reviewed each task.
- **Approvals:** only the owner's own chat message approves anything (Task 8's diffs, A1-type decisions). A subagent's or reviewer's message never does.

## Closing (review M-7) — the owner's phone pass and what it must look at

- The screens: #16 both tabs (one balance line; Details on each fee card; the destination row collapsed / open; the S11 / S9 case "To: Choose a destination" with its reason and the CTA disabled until a pick — owner decision A1; the over-the-limit hint), #18 both runs (the new titles and stage labels, A7), #21 both runs (Now public with Details; Now private with "Your deposit is public on chain." only when landed, A2), #19 / #20 ("Pool", A11), #10's recipient "Pool", the dashboard in both modes (the toggle, the Private balance card with Details, the actions, Private assets, the pending caption), #15, the import's four account-choice cases (decision B-6).
- The native dialog: "Confirm making public", "… taken from your private balance", the BiometricPrompt "Approve making this public" / "Confirm it is you to authorize this one transfer to public", part A's layout unchanged; `A0ConfirmWindowTest` on the phone (Task 6's `am instrument` line).
- Technical words still visible by default, for the owner to judge (review M-6; the spec bans five words, not these): the deposit #21 sub "your note is at position #N in the pool", "No private note can pay the relayer fee", "ZK proof fee" (inside Details), "Relayer fee", "Notes in the pool after this deposit" (inside Details).
- `scripts/m1c-checkpoint/README.md` quotes the old words (A9).
- Before merging: retarget the branch to `main` once #124 merges; never merge the two back to back without retargeting (PR #97).

## Review 1 resolutions (Fable plan review 1, 2026-11-20)

- **I-1 (A1):** owner decision — nothing preselected; "To: Choose a destination · Change" (`DESTINATION_NONE`); CTA disabled until a pick; M1c's S11 / S9 rows keep their assertions (they gain only the "open Change" step); spec §3.3 amended in the revision commit; the mutation holds it. The reviewer's "options start expanded" was not adopted: the owner specified the collapsed row.
- **I-2:** the deposit's "Your deposit is public on chain." only for `done` + `unspent`; three new negative rows (running, pending, dropped); mutation 3 targets the signature condition.
- **I-3:** `Navigator.tsx` ("Pool", Task 4), `errors.ts` and `geoFenceModule.ts` (Task 5) added to the scan's EXTRA (ratchet 1 / 4 / 2) and to the guard's scope; counts re-measured (82 files).
- **I-4:** "Your private balance needs the on-device prover …" in both screens (the two `/needs …/` rows pass unedited); `ShieldTxFlow.test.tsx:282` → `/fail|Not made private/i`; `ShieldUnshieldScreen.test.tsx:235` asserts no pending figure, and a new Make public row asserts `unshield-vault-value` is "—" in every non-ready state; the stale caption fixtures (`DashboardScreen.test.tsx:225,227`, `ShieldUnshieldScreen.test.tsx:267,269`) follow the new caption.
- **I-5 / A10:** owner decision — the sentence is deleted (Task 1 Step 4b, with a ReceiveScreen row and its positive control); `FORBIDDEN_NEW` gains `/stays? private on-?chain/i`.
- **I-6:** Task 8 rewritten — copies in a work dir, a case-insensitive check with section ranges from the anchors and a positive control on the original, the implementer hands the diffs to the controller, only the owner's message approves, backups and install only after approval.
- **I-7:** "Execution notes" (per-task Fable review, fix loop, scoped re-review, final whole-branch review) and the attribution ruling noted; the trailer is unchanged by controller ruling.
- **M-1:** accepted for JSX text (never filtered as a machine token; fixture row added; counts unchanged). Declined for "Re-shield": the `-` look-behind is what keeps `accent-shielded` / `border-accent-transparent` out of the scan in class strings outside `className` (e.g. `Card.tsx`); no hyphenated banned word exists in the copy today, and the design-file check covers the design.
- **M-2:** accepted — `/can(?:'|no)?t be traced/i`, `/hidden from everyone/i`, `/stays? private on-?chain/i` with fixture rows.
- **M-3:** accepted — the Review Focus 2 row's title no longer claims the hint; the Review Focus 3 row asserts Details collapsed while the hint shows.
- **M-4:** accepted as A11 ("Pool" on #20 and #10, "the pool" on #19), listed for the owner's phone pass (reversible).
- **M-5:** accepted — the reason is hidden while the options are open; the component test counts it once.
- **M-6:** accepted as a list in "Closing".
- **M-7:** accepted — "Closing".
- **M-8:** accepted — two diffs (word swaps, then new phones).
- **M-9:** accepted — noted in A3 as M2 copy to rewrite.

## Self-review (done by the planner against the spec, 2026-11-20)

**1. Spec coverage.**
- §1 success criteria: one word pair → Tasks 1, 3–6 and the scan reaching zero in Task 5; one balance line per #16 tab → Task 3; no technical term by default → Details in Tasks 3–5 (A6 for the words the spec does not ban); the import never silently picks → Task 7; the guard as strict and green → every task (regexes untouched; scope widened in Tasks 1, 2, 4, 5, 7; the native positive control's strings in Task 6).
- §2 table: every row → Task 1 constants, used in Tasks 3 (rows 2, 3, 4), 4 (rows 6, 7), 5 (rows 1, 4, 5, 8), 6 (row 9). Honesty "kept as is" → the Global Constraints line and the rows that assert each sentence verbatim (Tasks 3, 5). "Widened" → the guard's scope. "Forbidden" → `FORBIDDEN_NEW` over every user-visible string in scope (Task 1).
- §3.1 module + two tests (guard row, banned-word scan with a positive control) → Task 1. §3.2–§3.4 → Task 2, wired in Tasks 3–5. §3.3 as amended (owner decision A1: nothing preselected when the fresh account is unavailable) → Task 3. §3.4 "the note explanation moves into #16's Details" → Task 3.
- §4 dashboard → Task 5; #16 → Task 3; #18 → Task 4 (A7); #21 unshield → Task 4 (A8); deposit #19–#21 → Task 4 (A2); import → Task 7; native confirmation → Task 6 (+ the phone run in its notes).
- §5 → Task 8 with the gate (copies first, the originals replaced only after the owner's approval). §6 → every task's TDD steps, mutations and gates; "each changed row says why" → the `// part B` comments. §7 steps 1–6 → Tasks 1, 2, 3, 4+5+6, 7, 8.

**2. Placeholder scan.** No "TBD", no "TODO", no "similar to Task N"; every code step carries its code; every test step carries its test code. The only bracketed value is `<date>` in Task 8's PR record, which the owner's approval supplies.

**3. Type consistency.** `DestinationChoice` (Task 2) = `UnshieldChoice` (Task 3, aliased); `overLimit(amount: bigint | null, max: bigint)` is called with `hasAmount ? units : null` (Make private) and `hasAmount && source !== null ? units : null` (Make public), the same expression the hint receives; `BalanceRow` (Task 3) is used with `testID="shield-balance"` / `"unshield-vault"`, and the tests read `-value`; `makePublicLimit(max: string, sym)` receives `displayAmount(max, …)`; `a0CheckCaption`'s signature is unchanged; `accountChoiceView`'s parameter order (`loading, detectFailed, showAll, candidates`) matches its call and its table test.

**4. Review Focus.** Five lines, each with its test in the owning task: 1 → Task 3 (M1c's S11 and S9 rows, assertions kept), 2 → Task 3 (one row per side, plus the hint in the Review Focus 3 row), 3 → Task 3 (+ Task 2's component rows), 4 → Task 7 (two rows), 5 → Task 5.

**Verified by running, not by reading:** `copyScan.ts` as written (revision 2) compiled with `tsc --strict` and run over this branch (402323e) plus its EXTRA files gives 82 files and exactly the ratchet's 21 counts; its fixture rows give the expected results; `forbiddenClaims` is 0 in every file in scope except ReceiveScreen's A10 sentence, which Task 1 deletes; `npm run lint:ci` is 144 warnings on the base.

