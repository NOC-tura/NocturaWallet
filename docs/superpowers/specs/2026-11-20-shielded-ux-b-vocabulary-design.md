# Shielded UX, part B: one vocabulary, simpler screens (design)

- **Date:** 2026-11-20
- **Status:** approved by the owner in chat, section by section.
- **Base:** branch `feat/shielded-ux-b-vocabulary`, stacked on part A (`feat/shielded-ux-a-quick-fixes`, PR #124).
  - Retarget the branch to `main` once #124 merges. Never merge the two back to back without retargeting (lesson of PR #97).
- **Related:** part A (PR #124), M1c (PR #123), spec `2026-11-08-shielded-a0-m1-design.md` (rev 3.4), memory `project_shielded_ux_simplification.md`.

## 1. Purpose

The owner looked at the wallet as an ordinary user would. Its four overlapping word pairs, two equal balances and technical terms make it hard to understand.

The goal of part B is that a user who has never heard of notes, pools or relayers can:
- tell the public and the private side apart;
- move funds between them;
- understand every result screen.

All of this must happen without the wallet claiming more privacy than it delivers.

Success criteria:
- one word pair throughout the user interface;
- one balance line per #16 tab;
- no technical term visible by default;
- the import never silently picks an empty account when a funded one exists;
- the privacy-claims guard stays as strict as before and is green.

**Out of scope:**
- one combined total "Public X · Private Y" (part C, with M1d's account switcher);
- private send to another person's private address (M2);
- any change to M1c's flow, verification or reconciliation logic;
- any rename of code identifiers, tests, readout fields or the desk.

## 2. Vocabulary (decision B-1: option A, "Public / Private")

Only user-visible copy changes. Every term comes from one module, `src/copy/modes.ts`.

| Today | New |
|---|---|
| Dashboard toggle "Transparent / Shielded" | **Public / Private** |
| Actions and CTAs "Shield" / "Unshield" / "Unshield TEST" | **Make private / Make public**; CTA "Make {amount} {sym} public" / "Make {amount} {sym} private" (disabled CTA: "Make {sym} public" / "Make {sym} private") |
| #16 title "Shield / Unshield" | **Private ⇄ Public** |
| "Shielded balance", "Vault balance", "SHIELDED · VAULT BALANCE" | **Private balance**; **Public balance** on the Make private tab |
| "SHIELDED ASSETS", "· shielded" | **PRIVATE ASSETS**, "· private" |
| "Unshielding…" / "Unshielded" / header "SHIELDED Unshield" | **Making public…** / **Now public** / header "PRIVATE · Make public" |
| Deposit run "Shielding…" / "Shielded" | **Making private…** / **Now private** |
| "Shielded vault" info card | **Private balance** card; it keeps "Deposits are public on chain." |
| Native dialog title "Confirm unshield"; prompt "Approve this unshield" | **Confirm making public**; **Approve making this public** (subtitle: "Confirm it is you to authorize this one transfer to public") |

The words "Shield", "Unshield", "Shielded", "Transparent" and "Vault" disappear from user-visible copy. They may stay in code identifiers, comments, test names and readout fields.

**Honesty (binding).** "Private" promises more than "Shielded". Memory `project_shielded_privacy_guarantee.md` records two facts: a deposit is public and signed by the main account, and an exit to the main account is linkable to that deposit. Therefore:
- **Kept as is:**
  - every honest sentence: the deposit "Your main account signs this deposit … public on chain …", the relayed "… so no key of yours signs it. Amounts and timing are public.", the main-account warning that the exit is linkable, and the "another address" warning;
  - the Private balance card's "Deposits are public on chain.";
  - the privacy-claims guard's regexes, unchanged and not relaxed.
- **Widened:** the guard's scope, which now also covers `src/copy/modes.ts` and every changed file.
- **Forbidden:** no new copy may say or imply anonymous, untraceable, invisible, fully private, or "no one can see". A row checks the new module against the guard.

## 3. Shared components (pattern 1: one vocabulary module plus shared components)

All four live under `src/components/private/`, except the copy module.

1. **`src/copy/modes.ts`** holds every term in §2 as named constants and small formatters (`makePublicCta(amount, sym)` and the like). The screens import from it. Two tests:
   - the module passes the privacy guard;
   - a scan finds none of the banned words (§2) in any user-visible string of `src/screens/**` or `src/components/**`. The test has a positive control: a fixture containing "Unshield" is caught.
2. **`DetailsDisclosure`**:
   - a "Details ▾" row at the bottom of a card that toggles to "▴";
   - collapsed by default, with no persisted state (each mount starts collapsed);
   - accessibility: `accessibilityRole="button"`, `accessibilityState={{expanded}}`, label "Details";
   - tests: collapsed hides the children, a press shows them, the accessibility state is correct.
3. **`DestinationRow`**:
   - collapsed: "To: {selected} · Change". The fresh account shows "(recommended)".
   - "Change" expands the three options with one-line descriptions.
   - When main or another address is selected, its warning shows directly below the row, always visible and never inside Details.
   - When the fresh account is unavailable (a cli wallet, S9; no grant, S11): nothing is preselected (M1c's S11 ruling stays), the collapsed row reads "To: Choose a destination · Change", a one-line reason is shown, and the CTA stays disabled until the user picks. *(Amended 2026-11-20 by owner decision after the plan's Fable review; it replaces "main is preselected".)*
   - It replaces the three big cards in `UnshieldSide.tsx`.
   - The selection logic and its refusal rules (own-address refusal, ruling 4's fresh preselection) stay as M1c built them.
4. **`AmountLimitHint`**:
   - renders nothing while the amount is ≤ max;
   - when the amount is > max, it shows "You can make up to {max} {sym} public at once." in the danger tone, and the CTA is disabled;
   - MAX fills exactly the max;
   - the note explanation ("one note at a time; combining comes later") moves into #16's Details.

## 4. Screens

- **Dashboard:**
  - the toggle reads Public | Private;
  - Private mode shows:
    - the "PRIVATE BALANCE" card with its amount, "Anonymity set" moved into its Details;
    - two actions, Make private and Make public (Make public keeps part A's gate);
    - "PRIVATE ASSETS";
    - the pending caption "{x} pending · not confirmed yet" with Check again, and the decided captions;
  - Public mode: only the toggle's label changes.
- **#16 "Private ⇄ Public":** *(Amended 2026-11-21 by owner decision after the phone pass: two separate screens with no tabs; the dashboard button fixes the direction, the title is the action "Make private" / "Make public", the other direction is reached by going back. The bullets below apply to each screen.)*
  - ~~tabs Make private / Make public~~ (superseded, see the amendment);
  - one balance line: Public balance on Make private, Private balance on Make public (decision B-2);
  - the amount with MAX and `AmountLimitHint` (decision B-4);
  - Make public:
    - `DestinationRow` (decision B-5);
    - the fee card shows "Relayer fee" and "Destination receives"; the Network fee row ("paid by the relayer"), the ZK proof fee row and the note explanation go into Details (decision B-3);
    - the honest relayed sentence stays visible;
  - Make private: the fee card keeps the visible "You'll make private" total; its Network fee, ZK proof fee and Deposit record rent rows go into Details;
  - CTAs as in §2.
- **#18 (stages):** title "Making public…" / "Making private…"; the stages keep their measured times, never a percentage; stage labels in plain words.
- **#21 (result), unshield:**
  - "Now public" with the check, and "The destination received {x} {sym}.";
  - "Your change, {y} {sym}, stays private.";
  - Copy signature and Done;
  - TX HASH (with copy) and "Change #{n} in the pool" go into Details;
  - every honest outcome is unchanged in meaning: pending reads "Not confirmed yet", the not-sent result reads "Not sent", a verifier refusal is shown loudly, the decided captions stay;
  - the copy uses only the new terms.
- **Deposit #19–#21:** the same word swap ("Now private"); "Your deposit is public on chain" and the explorer stay.
- **Import, smart account choice (decision B-6):** on `SelectAccountScreen`:
  - exactly one funded candidate: "We found your wallet", its address and balance, Continue, and a small "Use a different account" that reveals the full list;
  - more than one funded: a list of the funded ones only, plus "Use a different account";
  - none funded and the balances resolved: standard account 0 is preselected with "No funds found yet. You can receive to this address." and the same link;
  - the balance RPC failed: today's warning plus the full list. It never silently auto-picks.
  - The detection itself (`detectFundedAccounts`) is unchanged.
- **Native confirmation (Kotlin):** the strings change as in §2, the layout keeps part A's styling, and security behaviour is unchanged. `A0ConfirmWindowTest` must pass on the phone again.

## 5. The owner's design files (decision B-7: update them)

- First, copy `/home/user/Downloads/index.html` → `index.html.bak-2026-11-20` and `screen.md` → `screen.md.bak-2026-11-20`.
- Update both files:
  - the vocabulary;
  - #16, #18, #19–#21 and the Private dashboard;
  - the import's smart choice;
  - the three new components and the native dialog (until now undrawn), drawn in the existing design-system classes.
- Colours and the other screens stay untouched.
- The owner sees the diff and approves it before anything else proceeds. This step changes files outside the repo, so it waits for that approval.

## 6. Testing

- Test-first in every step: a red row before the green one.
- The privacy-claims guard reads `src/copy/modes.ts` and every changed screen or component, and its regexes are unchanged. The banned-word scan of §3.1 runs with its positive control.
- M1c's flow, reconcile and verifier suites stay green with their assertions unchanged. Only screen-copy rows change, and each changed row says why.
- Kotlin JVM tests stay green; the dialog test asserts the new strings. `A0ConfirmWindowTest` passes on the phone.
- Gates, with real exit codes: `npx jest` alone, `npx tsc --noEmit`, `npm run lint:ci` (no new warnings), `node scripts/check-no-tge-date.mjs`, the Kotlin JVM job.
- The owner's on-phone visual pass of every changed screen closes part B.

## 7. Steps (for the plan)

1. The vocabulary module and the guard and banned-word tests.
2. The three components.
3. #16.
4. #18–#21 (unshield and deposit), the dashboard and the Kotlin strings.
5. The import's smart account choice.
6. The design files (backup, update, owner approval).

Each step gets an implementer and a Fable review. Then come a final Fable review, an APK, and the owner's phone pass.
