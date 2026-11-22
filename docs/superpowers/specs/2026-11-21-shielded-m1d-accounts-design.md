# M1d — multi-account, the account switcher and the combined total (UX part C) (design)

- **Date:** 2026-11-21
- **Status:** approved by the owner in chat, section by section (decisions D1–D6 below, approach 1, design parts 1–5).
- **Base:** branch `feat/shielded-m1d-accounts` from `main` 31afb4e (part B merged, PR #125).
- **Related:** spec `2026-11-08-shielded-a0-m1-design.md` (rev 3.4) §10 (minimal multi-account), §11 (#17 copy R11),
  §16 (M1d row and checkpoint); part B spec `2026-11-20-shielded-ux-b-vocabulary-design.md` (part C deferred to here);
  memory `project_shielded_ux_simplification.md`, `project_shielded_privacy_guarantee.md`.

## 1. Purpose

A Make public to "A new account (recommended)" lands on a fresh account of the same seed (`fresh-exit` in the
encrypted registry, M1c). Today the app shows no account but the main one, so the user cannot find those funds. M1d makes
every account of the wallet visible with its balances, lets the user choose the account that Send, Receive and the
public balance use, warns before a Send links two of the user's accounts, and adds the one combined line
"Public X · Private Y" (UX part C).

**Success criteria:**
- every `main` and `fresh-exit` account is listed with its balances; a `fresh-pending` reservation never is;
- Send, Receive, history and the dashboard's public balance follow the selected account; nothing else moves off main;
- a Send between two accounts of the seed where either is `fresh-exit` shows the linking warning and needs a second tap;
- the dashboard shows "Public X · Private Y" in both modes without ever summing or inventing a value;
- #17 carries the who-sees-what copy (R11);
- the privacy-claims guard and the banned-word scan stay green with unchanged regexes;
- the M1d on-phone checkpoint of the M1 spec §16 passes.

**Out of scope:** adding, naming, renaming, hiding, reordering or removing accounts; importing a private key; deposits
from a non-main account; Swap / presale / referral from a non-main account; any change to M1c's unshield flow,
verification or reconciliation; private send (M2).

## 2. Owner decisions (2026-11-21)

| # | Question | Decision |
|---|---|---|
| D1 | Which actions follow the selected account | **A:** Send, Receive, transaction history and the dashboard's public balance. Make private (deposit), Swap, presale and referral stay on the main account. |
| D2 | What "Public X" means | **A:** the selected account's public balance. |
| D3 | Where the combined line sits | ~~**A:** one thin line directly under the Public \| Private toggle, in both modes; the big figure below is unchanged.~~ **2026-11-22 owner (phone pass): replaced** by a Public \| Private split row inside the balance card, both modes; see the §4.5 addendum. |
| D4 | Units | **A:** USD where a price is known, otherwise the token amount; the two sides are never summed. |
| D5 | How the switcher opens | **A:** the avatar (top-left of #11) opens a bottom sheet; the avatar shows the selected account's number; Profile stays on its tab. |
| D6 | Adding accounts by hand | **A:** no. Accounts come only from the main account and fresh exits. |
| Approach | Where "selected" lives | **1:** a new `selectedAccount` module; `walletStore.publicKey` stays the main account forever. |

## 3. Data

### 3.1 The account list

- Source: the encrypted registry `v1_accounts` (`src/modules/shielded/a0/accountRegistry.ts`, M1c), read with
  `loadA0AccountRegistry()` (no seed needed). Listed: the `main` entry and every `fresh-exit` entry. Never listed:
  `fresh-pending`.
- A wallet without a registry yet (no unshield ever) lists exactly its main account, built from
  `walletStore.publicKey` and `loadTransparentScheme()`.
- Label: `slip10:N` → "Account N+1" (the extension's rule, `extension/src/unlock/accountsFlow.ts`); `cli` → "Account 1".
  Tag: "main" for the main entry, "exit" for `fresh-exit`; an entry with `linked: true` also shows "linked".
- Order: main first, then `fresh-exit` by ascending index.
- A registry read failure (`E_A0_STORE_LOCKED` / `E_A0_ACCOUNTS_CORRUPT`) lists the main account only and shows one line
  "Other accounts can't be read right now." — never an empty list, never a crash.

### 3.2 The selected account

- New module `src/modules/accounts/selectedAccount.ts`; the selection is stored in the **encrypted** MMKV (a list or
  choice of one's own accounts is itself a link — M1 spec I6) under a new `v1_` key, as the scheme string only
  (`slip10:3`).
- Default: the main account. If the stored scheme is not a listed account (wiped, restored, corrupt), the selection
  falls back to main silently and the stored value is rewritten.
- `useSelectedAccount()` returns `{scheme, address, label, role, isMain}`; changes are observable (Zustand store,
  in-memory, hydrated from MMKV).
- `walletStore.publicKey` is never changed by a selection; every main-only consumer keeps reading it.

### 3.3 Signing from the selected account

- A Send from a non-main account derives its key from its scheme by the existing path (`retrieveSeed` →
  `mnemonicToSeed` → `deriveTransparentKeypair(seed, scheme)`), passes the scheme explicitly to
  `submitTransparentTransfer` (today it calls `loadTransparentScheme()`), and zero-fills the secret after signing.
- The scheme is captured when Send opens and carried through #19 → #20 → #21; a later selection change does not move an
  in-flight Send.
- Before signing, the derived public key must equal the account's registry address; a mismatch refuses the Send with a
  code, nothing signed.

### 3.4 Balances

- The selected account's public balances use the existing address-keyed queries (`useSolanaQueries`) and the dashboard's
  sync, keyed on the selected address instead of `walletStore.publicKey` (the dashboard only; `forceSync` keeps writing
  the main account's slot for main-only consumers, or is split — the plan decides, provided main-only screens keep the
  main account's values).
- The sheet loads balances when it opens, at most 10 accounts concurrently (the extension's `FRESH_ROWS`); a row not yet
  loaded reads "not checked yet"; a failed row reads "Balance unavailable".
- The private balance stays one per wallet (`useA0Shielded`), unchanged.

## 4. Screens

### 4.1 Avatar and the Accounts sheet (#11)

- The avatar shows the selected account's number ("1", "3"), accessibility label "Account 3, switch account". It opens
  the Accounts bottom sheet (it no longer navigates to Profile; Profile stays on its tab).
- Sheet title "Accounts". Each row: label, tag(s), short address (first 6 … last 6), balances ("0.02 SOL · 8.99 TEST",
  USD where priced), a check on the selected row. Tapping a row selects it, closes the sheet and refreshes the
  dashboard. Rows are `accessibilityRole="radio"` inside a radiogroup with `checked` state.
- Footer (slip10 wallets only): "New accounts appear here when you make funds public to “A new account”."
- No "Add account", no rename, no remove.
- A `cli` wallet lists its one account and no footer.
- The avatar and sheet work the same in Private mode; the private balance does not change with the selection.

### 4.2 Screens that follow the selection (D1)

- **Dashboard, Public mode:** the big balance, the token list and the refresh use the selected account.
- **Send (#12) → #19 → #20 → #21:** sends from the selected account; #19 and #20 show "From: Account 3 · Ab12cd…ef34"
  (the main account reads "From: Account 1 (main) · …").
- **Receive:** the selected account's address and QR, labelled with the account's name.
- **Transaction history:** the selected account's.

### 4.3 Screens that stay on main (D1)

- **Make private:** unchanged (it already says "Your main account signs this deposit").
- **Swap, presale buy, referral:** a line "From: Account 1 (main)" / "Uses your main account" whenever the selected
  account is not main, so the user is never surprised.
- **Make public:** the destination choice is unchanged ("My main account" is still main).
- **Now public (#21):** Details gains "Received by: Account N · Ab12cd…ef34" when the destination was a fresh account
  (the exit's registry entry), so the user can find it in the sheet.

### 4.4 The linking warning (M1 spec §10, C2)

- Condition: the Send's source and its recipient are both accounts of this seed (registry addresses, plus main), they
  differ, and at least one is `fresh-exit`. Recognised locally from the registry; no network request.
- Shown on Send as soon as the recipient is recognised, before #19: warning tone, title "Sending between your own
  accounts links them on chain.", body "Anyone can see that these two accounts belong to the same person."
- The Continue button needs a second tap: the first tap only acknowledges ("Tap again to send anyway"); the second goes
  to #19. Changing the recipient or amount resets the acknowledgement.
- The wallet offers no "fund this account" shortcut anywhere.

### 4.5 The combined line (UX part C; D2–D4)

- One line directly under the Public | Private toggle, both modes: "Public {X} · Private {Y}".
- X = the selected account's public value; Y = the wallet's private balance.
- Each side in USD when every asset on that side has a known price, otherwise as the token amounts of that side (the
  largest first, at most two, then "+N"); the two sides are never summed. Devnet example: "Public $12.40 · Private 1.0038
  TEST".
- Unknown value (not loaded, failed, private restore not ready): "—" for that side, never 0.
- Hidden balances (the eye toggle): "Public ••• · Private •••".
- **2026-11-22 owner: D3 replaced — the split row inside the balance card, see plan 2026-11-22-shielded-m1d-phone-pass-fixes.**
  The line under the toggle is gone. At the bottom of the hero card (both modes, only where private balances exist): a
  divider, then two equal columns, Public and Private, each a dot + the mode word + its value lines (USD as one line;
  otherwise one line per asset, largest first, at most two, then "+N more"; "—" unknown and "•••" hidden, one line
  each). A tap on the other column switches the mode; a tap on the active one does nothing. The Accounts sheet's rows
  keep the one-string form with "+N". Everything else above stands (D2, D4, never summed).

### 4.6 #17 explainer — who sees what (R11)

Adds the M1 spec's R11 paragraph in plain words without softening any claim: the relayer sees the request (destination,
amount, time and the network address it came from), the proof does not tell it which deposit is spent but amounts and
timing can hint at it; the RPC provider sees every request the app makes, including the balances of all your accounts;
on chain, amounts and timing are public. The plan may shorten it, never widen a claim.

## 5. The owner's design files

Per the owner's standing guidance (2026-11-21: improve the design as we build), with a dated backup of
`/home/user/Downloads/index.html` and `screen.md` first: add the Accounts sheet (default, cli, registry-unreadable), the
numbered avatar, the combined line on #11 (both modes, hidden, unknown), the linking warning on #12, "From: Account N"
on #19/#20, "Received by" on #21, the "Uses your main account" lines, and #17's who-sees-what paragraph. Tell the owner
per screen what changed.

## 6. Testing and gates

- Test-first in every task; each changed existing row says why.
- Unit: the account list (main only, fresh-exits, pending hidden, cli, corrupt registry), labels and order; selection
  default, persistence, fallback; the linking-warning predicate (every source/recipient role pair, a foreign address,
  same address); the combined-line formatter (USD, token fallback, "+N", unknown, hidden); the signer-address check.
- Screen: the sheet (rows, check, select, footer, cli, a11y); Send/Receive/history following the selection; the main-only
  lines; the second-tap gate and its reset; #21 "Received by"; #17 copy.
- The privacy-claims guard covers every new file (it already walks all of `src/screens` and `src/components`; any new
  copy outside them is added to `EXTRA_COPY`); the banned-word scan stays at zero; regexes unchanged.
- Gates with real exit codes: `npx jest` alone, `npx tsc --noEmit`, `npm run lint:ci` (no new warnings),
  `node scripts/check-no-tge-date.mjs`, the Kotlin JVM job (unchanged code).
- **On-phone checkpoint (M1 spec §16 M1d):** switch to the fresh account and send from it to a devnet address outside this
  seed, paying only from the granted SOL; the desk script asserts the fresh account's history is exactly {the relayed
  unshield, this send} and that no transaction connects it to another account of the seed; a send from it to the main
  account shows the linking warning and is cancelled, not sent; the owner's visual pass of the sheet, #11, #12 with the
  warning, #19/#20, #21 and #17.
