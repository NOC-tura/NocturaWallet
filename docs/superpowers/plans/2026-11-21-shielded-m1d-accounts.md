# M1d — multi-account, the account switcher and the combined total Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `main` and `fresh-exit` account of the wallet is visible with its balances in an Accounts sheet opened from the dashboard's numbered avatar; Send, Receive, history and the dashboard's public balance follow the selected account (signing from its own scheme, after a signer-address check); a Send between two of the seed's accounts where one is an exit warns and needs a second tap; the dashboard shows one line "Public X · Private Y"; #17 says who sees what — without moving anything else off the main account and without changing M1c's unshield flow.

**Architecture:** A new `src/modules/accounts/` holds the pure account list (`accountList.ts`, built from the encrypted registry `v1_accounts` without the seed), the selection (`selectedAccount.ts`, a Zustand store hydrated from a new ENCRYPTED MMKV key, falling back to main), the public data of a non-main account (`accountSnapshot.ts`, an address-keyed read never written into `walletStore`), the combined-line formatter (`valueLine.ts`), the linking predicate (`linking.ts`) and #21's "Received by" reading (`receivedBy.ts`). Screens read them through `src/hooks/useSelectedAccount.ts`, `src/hooks/useAccountPublicData.ts` and `src/hooks/useAccountRowBalances.ts`; every new string sits in `src/copy/accounts.ts`. `walletStore.publicKey` stays the main account forever and `forceSync` keeps writing the main account's slot, so Swap, presale, referral, Make private and Settings keep the main account's values. A transparent Send captures its source when #12 opens and carries it (`TransferIntent.from`, `TransferIntent.sourceBalances`) through #19 → #20 → #21, where `submitTransparentTransfer` derives the key from that scheme and refuses before signing when the derived address is not the account's.

**Tech Stack:** React Native 0.84 (TypeScript strict, NativeWind v4), Zustand 5, TanStack Query v5, react-native-mmkv (mock in Jest), `@scure/base` (base58), Jest + @testing-library/react-native 13; the desk script in plain Node ESM (`node --test`), reusing `scripts/m1c-checkpoint/chain.mjs` / `lib.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md` (owner-approved 2026-11-21, decisions D1–D6, approach 1). Also binding: `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` §10 (minimal multi-account), §11 (copy R11, the guard), §16 (the M1d row and checkpoint). Executors read the spec and this plan together; where they differ, "Spec ambiguities and their resolutions" below says which reading this plan takes and why.

**Base:** branch `feat/shielded-m1d-accounts` at 1a3ce4d (the spec commit), on `main` 31afb4e (part B merged, PR #125). Not stacked.

## Global Constraints

- Owner decisions (spec §2, verbatim in effect): **D1** Send, Receive, transaction history and the dashboard's public balance follow the selected account; Make private (deposit), Swap, presale and referral stay on the main account. **D2** "Public X" is the selected account's public balance. **D3** one thin line directly under the Public | Private toggle, in both modes; the big figure below is unchanged. **D4** USD where a price is known, otherwise the token amount; the two sides are never summed. **D5** the avatar (top-left of #11) opens a bottom sheet; the avatar shows the selected account's number; Profile stays on its tab. **D6** no adding accounts by hand. **Approach 1:** a new `selectedAccount` module; `walletStore.publicKey` stays the main account forever.
- Listed accounts: the `main` entry and every `fresh-exit` entry of `v1_accounts`; **never** `fresh-pending`. No registry yet → exactly the main account, built from `walletStore.publicKey` and `loadTransparentScheme()`.
- Labels (spec §3.1): `slip10:N` → "Account N+1"; `cli` → "Account 1". Tags: "main", "exit", plus "linked" on an entry with `linked: true`. Order: main first, then `fresh-exit` by ascending index. A registry read failure lists the main account only plus the one line "Other accounts can't be read right now." — never an empty list, never a crash.
- The selection is stored in the **encrypted** MMKV only (`MMKV_KEYS.ACCOUNTS_SELECTED = 'v1_accounts.selected'`), as the scheme string. Default main; a stored scheme that is not listed falls back to main silently and is rewritten.
- Signing (spec §3.3): key from the source's scheme by the existing path (`retrieveSeed` → `mnemonicToSeed` → `deriveTransparentKeypair(seed, scheme)`), the scheme passed explicitly, the secret zero-filled after signing; the derived public key must equal the account's address before signing, else the Send is refused with a code and nothing is signed. The scheme is captured when #12 opens; a later selection change never moves an in-flight Send.
- Out of scope (spec §1): adding / naming / renaming / hiding / reordering / removing accounts; importing a private key; deposits, Swap, presale or referral from a non-main account; ANY change to M1c's unshield flow, verification or reconciliation (`src/modules/shielded/a0/**` is not edited by any task — the registry is only read); private send (M2). No "fund this account" shortcut anywhere.
- Copy: every new user-visible string comes from `src/copy/accounts.ts` (Task 1) or `src/copy/modes.ts`. Banned in user-visible copy (part B, unchanged): "Shield", "Unshield", "Shielded", "Transparent", "Vault" and their forms. Forbidden in any new copy: anything that says or implies anonymous, untraceable, invisible, fully private, "no one can see" (`FORBIDDEN_NEW` in `src/copy/__testing__/copyScan.ts`). #17's R11 paragraph may be shortened, never widened.
- The privacy-claims guard (`src/screens/shielded/__tests__/privacyClaims.test.ts`) and the banned-word scan (`src/copy/__tests__/bannedWords.test.ts`): their regexes are never edited, relaxed or reordered; only `EXTRA_COPY` / `EXTRA` and the positive-control file lists grow (Task 1). The guard reads whole files, comments included: no comment in any new or edited file may contain "unlinkable", "untraceable", "fully anonymous", "won't be linked", "not even Noctura", "onward is private" or "Plonk".
- Each changed row of an existing test gets a trailing comment `// M1d: <why>` (spec §6 "each changed existing row says why"). A row is never deleted to make a task pass; a negative row that would pass vacuously after a change is rewritten so it still bites.
- Cardinal rules (CLAUDE.md): BigInt amounts end to end (USD figures are display floats only, as `computePortfolio` already does), TypeScript strict (no `any`, no `@ts-ignore`), no `// TODO`, every send/sign CTA debounced 500 ms and disabled on tap (keep the existing debounce; the second-tap gate runs inside it).
- Gates, every task, with their real exit codes read (not the tick): `npx jest` (alone, nothing else on the line), `npx tsc --noEmit`, `npm run lint:ci` (no new warning: exactly `✖ 144 problems (0 errors, 144 warnings)` after Tasks 1–2, and `✖ 143 problems (0 errors, 143 warnings)` from Task 3 on — Task 3 deletes a `require` whose `eslint-disable` comment then goes too, measured on a dry run of the plan), `node scripts/check-no-tge-date.mjs`. Task 9 also runs `node --no-warnings --test scripts/m1d-checkpoint/*.test.mjs`. The Kotlin JVM job is unchanged (no Kotlin or Android resource is touched by any task).
- Reviews (owner rule: every plan and every review goes to Fable): each task has one implementer, then a Fable task review, a fix loop and a scoped Fable re-review before the next task starts; a final Fable review of the whole branch after Task 8's owner answer.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, whichever model implements the task (session-mandated attribution; the PR body states who implemented and reviewed each task). One commit per task.

## Review Focus

1. **A registry that belongs to another wallet** (an in-app wipe + import in the same process, before anything re-reads; or a registry whose `main` is not `walletStore.publicKey` / the wallet's scheme). Expected: the sheet lists the main account only with "Other accounts can't be read right now."; the other wallet's accounts are never listed, never selectable, never a Send source. Test: Task 1, "Review Focus 1" (`accountList.test.ts`).
2. **The selection changes while a Send is in flight** (the user opens #12 on Account 4, then — from a second entry or a stale screen — the selection becomes main before #21). Expected: #19/#20/#21 keep Account 4 (#12 captured it); #21 derives from `intent.from.scheme` and refuses with `E_SEND_SIGNER_MISMATCH` (nothing signed, the secret zero-filled) if that key does not derive `intent.from.address`. Test: Task 3, "Review Focus 2" (SendScreen + `sendSigner.test.ts` + TransactionStatusScreen).
3. **A Send to a `fresh-pending` reservation** (an exit in flight — its address is in the registry before it is listed). Expected: the linking warning and the second tap, exactly as for a `fresh-exit` (a pending exit is about to be one; funding it from the main account links them). Test: Task 6, "Review Focus 3" (`linking.test.ts` + SendScreen).
4. **A non-main account whose balances are not loaded yet, or failed.** Expected: never a 0 — the dashboard hero and sub-balances read "—" and the list says "Loading balances…" / "Balance unavailable · pull to refresh"; Send's Available reads "—" and its CTA stays disabled; the combined line's public side reads "—". Tests: Task 2 (dashboard), Task 3 (Send), Task 4 (combined line), each labelled "Review Focus 4".
5. **Wipe + import in the same process.** Expected: the encrypted store's reset hook clears the in-memory selection; the new wallet starts on its own main account; nothing of the old wallet's selection or list is shown. Test: Task 1, "Review Focus 5" (`selectedAccount.test.ts`).

## Spec ambiguities and their resolutions

Each is the smaller or the more secure reading; the owner may overturn any.

- **A1 — "at most 10 accounts concurrently" (§3.4).** A sliding window: rows are read 10 at a time in flight, every row is eventually read while the sheet is open, a row waiting or in flight reads "not checked yet". (The extension reads only its first 10; the spec says "concurrently", which a window honours without leaving rows unread.)
- **A2 — the linking warning's "registry addresses" include a `fresh-pending` reservation** (§4.4 names registry addresses; a pending exit is in the registry). It is treated as exit-like: a Send to it warns. More secure; Review Focus 3.
- **A3 — a registry whose main entry is not this wallet's** (address ≠ `walletStore.publicKey` or scheme ≠ `loadTransparentScheme()`) is treated as unreadable: main only + the line (§3.1's failure rule). Review Focus 1.
- **A4 — "the stored value is rewritten" (§3.2)** only when the registry was READ and the stored scheme is not in it; when the registry is unreadable (locked, corrupt, another wallet's) the fallback to main is in memory only and the stored choice is kept, so a temporary read failure never erases it.
- **A5 — `useSelectedAccount()` returns `WalletAccount | null`**: null only while no wallet is loaded (`walletStore.publicKey` null). The returned object carries the spec's `{scheme, address, label, role, isMain}` plus `number` (the avatar) and `linked` (the tag).
- **A6 — `forceSync` is not split** (§3.4 leaves it to the plan). It keeps writing the main account's slot on every dashboard trigger (mount, foreground, 60 s poll, pull), whatever is selected, so every main-only consumer keeps the main account's values. A non-main selection's public data is a separate address-keyed query (`['accountSnapshot', address]`, `fetchAccountSnapshot`) that is never written into `walletStore`; the dashboard refetches it on the same triggers. **TokenDetail (#28) follows the selection** too: it is opened from the dashboard's token list, which shows the selected account's tokens, so its holding must be that account's (its Swap button still opens the main-only Swap, which says so).
- **A7 — #20 keeps its row layout:** the "From" row's value reads "Account 4 · 3YqEpf…JXT94k" (main: "Account 1 (main) · HAgk14…3DKpqk"); #19 shows the full caption "From: Account 4 · 3YqEpf…JXT94k" under the intent card.
- **A8 — #19's "After" and #20's high-value gate** use the SOURCE's balances, carried in the intent as `sourceBalances` (captured with the source at #12), never the main account's store.
- **A9 — the combined line is rendered only in a build with private balances** (`isShieldedEnabled()`); the production build (no private side at all) shows no "Private —" forever. Where the private view is `unsupported` (no on-device prover), its side reads "—".
- **A10 — the formatter's details (§4.5):** within one side, assets are joined by ", " on the combined line and " · " on a sheet row; the overflow is " +N" after a space; "largest first" = the largest whole-token amount (decimals-normalised BigInt), ties by symbol; a side with no non-zero asset reads "0 SOL" (public) / "0 TEST" (private); the private side is the unspent total only (pending excluded, as the dashboard's hero). Hidden: "Public ••• · Private •••". The spec's devnet example "Public $12.40" cannot occur on devnet (the devnet build resolves no price, `isPricingEnabled()`), so devnet always shows token amounts; the rule, not the example, is implemented.
- **A11 — the public side's assets are the dashboard's holdings:** SOL, NOC and the tokens the dashboard lists (core + verified mints, `TokenManager.buildDisplayTokens`). The devnet TEST token is an unknown mint, so it is not in the public list today (existing rule, unchanged); the M1d checkpoint's send is therefore SOL. Listed for the owner's phone pass.
- **A12 — the main account before its first sync** (`walletStore.lastSyncedAt` null) is "not loaded": its public side reads "—". After a failed later sync the last synced values stand (stale, not unknown), as the dashboard shows them today.
- **A13 — the main-only lines (§4.3):** Swap and #23 presale (the screen with the amount and Buy) read "From: {main label} (main)" — "From: Account 1 (main)" for a `slip10:0` main, "From: Account 4 (main)" for a `slip10:3` main; referral reads "Uses your main account". Only while the selected account is not main. #23's confirmation screen (`PresaleBuyConfirmScreen`) is not changed (it follows #23 directly; one line per flow).
- **A14 — "Received by" (§4.3)** without changing M1c's flow: the run screen reads the reserved scheme from the note store's pending intent at the flow's `onPending(rho)` callback (the settled note drops it), and after a `spent` outcome looks that scheme up in the registry as `fresh-exit`; anything missing → no row (never a guess).
- **A15 — #17's R11 text:** "The relayer that submits your unshield" contains a banned word; it becomes "When you make tokens public, the relayer that sends them sees the request: …". Everything else is R11 verbatim, under the heading "Who sees what", in three paragraphs (relayer, RPC provider, chain).
- **A16 — the signer check:** base58 of the derived 32-byte public key compared with `intent.from.address` before any `Keypair` is built; code `E_SEND_SIGNER_MISMATCH`. A scheme string that does not parse strictly (`parseA0Scheme`) refuses with `E_SEND_SCHEME` before the keychain is asked.
- **A17 — the desk never holds a seed:** the seed's key set is the M1c readout `startup-accounts` (`seedKeys` ∪ its registry), collected with the M1c desk's `collect`; "the fresh account's history" = `getSignaturesForAddress` of the account AND of its TEST token account (a stranger's dust lands on the token account).
- **A18 — the design backups:** `/home/user/Downloads` already holds `*.bak-2026-11-21`, `…b`, `…c`. The backup takes the first free name of `.bak-<today>`, `.bak-<today>b`, `c`, `d`, … and never overwrites one.
- **A19 — the avatar's accessibility label** is "{label}, switch account" ("Account 4, switch account"; main "Account 1, switch account").

## File map

- Create `src/modules/accounts/accountList.ts` (labels, order, short address, the list), `src/modules/accounts/selectedAccount.ts` (store, persistence, fallback), `src/hooks/useSelectedAccount.ts`, `src/copy/accounts.ts`, and their tests `src/modules/accounts/__tests__/{accountList,selectedAccount}.test.ts`, `src/hooks/__tests__/useSelectedAccount.test.tsx`, `src/copy/__tests__/accounts.test.ts`; modify `src/constants/mmkvKeys.ts`, the guard's and the scan's file lists (Task 1).
- Create `src/modules/accounts/accountSnapshot.ts`, `src/hooks/useAccountPublicData.ts` + tests; modify `src/screens/dashboard/DashboardScreen.tsx`, `src/screens/transparent/{TokenDetailScreen,TransactionHistoryScreen,ReceiveScreen}.tsx`, `src/app/Navigator.tsx` (`ReceiveScreenNav`) and their tests, `src/app/__tests__/shieldedRoutes.test.tsx`, `src/screens/dashboard/__tests__/DashboardChainIdentity.test.tsx` (Task 2).
- Modify `src/types/transfer.ts`, `src/modules/solana/sendTransaction.ts`, `src/screens/transparent/{SendScreen,TxSimulateScreen,TxConfirmScreen,TransactionStatusScreen}.tsx` and their tests, `src/modules/solana/__tests__/{submitTransaction,transferRisk}.test.ts`; create `src/modules/solana/__tests__/sendSigner.test.ts` (Task 3).
- Create `src/modules/accounts/valueLine.ts` + test; modify `DashboardScreen.tsx` + test (Task 4).
- Create `src/hooks/useAccountRowBalances.ts`, `src/components/accounts/AccountsSheet.tsx` + tests; modify `DashboardScreen.tsx` (avatar, sheet), `src/app/Navigator.tsx` (no `onProfileTap`) + tests (Task 5).
- Create `src/modules/accounts/linking.ts` + test; modify `SendScreen.tsx` + test (Task 6).
- Create `src/components/accounts/MainAccountLine.tsx`, `src/modules/accounts/receivedBy.ts` + tests; modify `src/screens/transparent/SwapScreen.tsx`, `src/screens/PresaleScreen.tsx`, `src/screens/referral/ReferralScreen.tsx`, `src/screens/shielded/unshield/UnshieldRunScreen.tsx`, `src/screens/shielded/ShieldedExplainerScreen.tsx` and their tests (Task 7).
- Modify (outside the repo, after a dated backup) `/home/user/Downloads/index.html`, `/home/user/Downloads/screen.md` (Task 8).
- Create `scripts/m1d-checkpoint/{lib.mjs,lib.test.mjs,m1d-checkpoint.mjs,README.md}`; modify `.github/workflows/native-prover.yml` (one desk-test step, one paths entry) (Task 9).

Task order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Each later task's Interfaces block repeats the exact names it consumes.

**Shared test fixtures** (the "abandon … about" vector seed of `src/modules/shielded/a0/__tests__/fixtures/a0-account-vectors.json`, on-curve real addresses; the short forms are first 6 … last 6):

| name in tests | scheme | address | short |
|---|---|---|---|
| `MAIN` | `slip10:0` | `HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk` | `HAgk14…3DKpqk` |
| `A1` | `slip10:1` | `Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb` | `Hh8QwF…Y1Hztb` |
| `A2` | `slip10:2` | `7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm` | `7Wktog…TBJ2jm` |
| `A3` | `slip10:3` | `3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k` | `3YqEpf…JXT94k` |
| `CLI` | `cli` | `EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o` | `EHqmfk…HHZy7o` |
| `FOREIGN` | (zoo seed `slip10:0`) | `E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N` | `E48cos…mANV4N` |

---
### Task 1: The account list, labels, the selected account and the M1d copy

**Files:**
- Create: `src/copy/accounts.ts`
- Create: `src/modules/accounts/accountList.ts`
- Create: `src/modules/accounts/selectedAccount.ts`
- Create: `src/hooks/useSelectedAccount.ts`
- Modify: `src/constants/mmkvKeys.ts` (one key, after `ACCOUNTS_REGISTRY`)
- Modify: `src/screens/shielded/__tests__/privacyClaims.test.ts` (`EXTRA_COPY` + its positive-control list; regexes untouched)
- Modify: `src/copy/__tests__/bannedWords.test.ts` (`EXTRA` only)
- Test: `src/copy/__tests__/accounts.test.ts`, `src/modules/accounts/__tests__/accountList.test.ts`, `src/modules/accounts/__tests__/selectedAccount.test.ts`, `src/hooks/__tests__/useSelectedAccount.test.tsx`

**Interfaces:**
- Consumes (existing, unchanged): `loadA0AccountRegistry(options?): readonly A0AccountEntry[] | null` (throws `A0AccountRegistryError` with `code` `E_A0_STORE_LOCKED` / `E_A0_STORE_CHANGED` / `E_A0_ACCOUNTS_CORRUPT`), `parseA0Scheme(s: unknown): TransparentScheme | null`, `A0AccountEntry {scheme: string; role: A0AccountRole; address: string; linked?: true}`, `A0AccountRole = 'main' | 'fresh-pending' | 'fresh-exit'`, `A0AccountRegistryError` — all from `src/modules/shielded/a0/accountRegistry.ts`; `loadTransparentScheme(): TransparentScheme` (`src/modules/keyDerivation/derivationScheme.ts`); `schemeToString`, `TransparentScheme = {kind: 'slip10'; account: number} | {kind: 'cli'}` (`src/modules/keyDerivation/transparent.ts`); `mmkvSecure(): MMKV | null`, `onSecureMmkvReset(hook): () => void` (`src/store/mmkv/instances.ts`); `useWalletStore` (`src/store/zustand/walletStore.ts`); `MODE_PUBLIC`, `MODE_PRIVATE` (`src/copy/modes.ts`).
- Produces (`src/constants/mmkvKeys.ts`): `MMKV_KEYS.ACCOUNTS_SELECTED = 'v1_accounts.selected'` (encrypted instance only).
- Produces (`src/copy/accounts.ts`, every later task imports these exact names): `ACCOUNTS_TITLE = 'Accounts'`, `TAG_MAIN = 'main'`, `TAG_EXIT = 'exit'`, `TAG_LINKED = 'linked'`, `ACCOUNTS_FOOTER = 'New accounts appear here when you make funds public to “A new account”.'`, `ACCOUNTS_UNREADABLE = "Other accounts can't be read right now."`, `ROW_NOT_CHECKED = 'not checked yet'`, `ROW_UNAVAILABLE = 'Balance unavailable'`, `PUBLIC_LOADING = 'Loading balances…'`, `PUBLIC_UNAVAILABLE = 'Balance unavailable · pull to refresh'`, `LINK_WARNING_TITLE = 'Sending between your own accounts links them on chain.'`, `LINK_WARNING_BODY = 'Anyone can see that these two accounts belong to the same person.'`, `LINK_TAP_AGAIN = 'Tap again to send anyway'`, `USES_MAIN_ACCOUNT = 'Uses your main account'`, `RECEIVED_BY = 'Received by'`, `VALUE_UNKNOWN = '—'`, `VALUE_HIDDEN = '•••'`, `WHO_SEES_WHAT = 'Who sees what'`, `WHO_SEES_RELAYER`, `WHO_SEES_RPC`, `WHO_SEES_CHAIN` (texts in Step 3); `avatarA11y(label: string): string`, `accountWithAddress(label: string, short: string, isMain: boolean): string`, `fromLine(label: string, short: string, isMain: boolean): string`, `fromMainLine(mainLabel: string): string`, `combinedLine(pub: string, priv: string): string`.
- Produces (`src/modules/accounts/accountList.ts`): `interface WalletAccount {scheme: string; address: string; label: string; number: number; role: 'main' | 'fresh-exit'; isMain: boolean; linked: boolean}`, `interface SeedAccount {address: string; role: A0AccountRole}`, `interface AccountList {accounts: readonly WalletAccount[]; seed: readonly SeedAccount[]; walletKind: 'slip10' | 'cli'; unreadable: boolean}`, `accountNumber(scheme: TransparentScheme): number`, `accountLabel(scheme: TransparentScheme): string`, `shortAccountAddress(address: string): string`, `buildAccountList(mainAddress: string, mainScheme: TransparentScheme, readRegistry: () => readonly A0AccountEntry[] | null): AccountList`. `accounts[0]` is always the main account.
- Produces (`src/modules/accounts/selectedAccount.ts`): `interface AccountsState {list: AccountList; selected: WalletAccount}`, `useAccountsStore` (Zustand: `{forMain: string | null; state: AccountsState | null}`), `readAccountList(mainAddress: string): AccountList`, `resolveSelection(list: AccountList, stored: string | undefined): {selected: WalletAccount; rewrite: boolean}`, `readAccountsState(mainAddress: string): AccountsState`, `refreshAccounts(mainAddress: string | null): AccountsState | null`, `selectAccount(scheme: string): boolean`, `resetAccountsForTests(): void`.
- Produces (`src/hooks/useSelectedAccount.ts`): `useAccounts(): AccountsState | null`, `useSelectedAccount(): WalletAccount | null`, `useAccountList(): AccountList | null`, `useSelectAccount(): (scheme: string) => boolean`, `useRefreshAccounts(): () => void`. **Every later screen reads accounts only through this hook module**, so a screen test mocks this one module.

- [ ] **Step 1: Write the failing tests — the copy module**

Create `src/copy/__tests__/accounts.test.ts`:

```ts
/**
 * M1d (spec 2026-11-21-shielded-m1d-accounts-design.md §4, M1 spec §10 / §11 R11): the accounts
 * copy, verbatim. Every expected string is the spec's text typed out here, never read back from
 * the module.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as c from '../accounts';
import {bannedStrings, forbiddenClaims, userVisibleStrings} from '../__testing__/copyScan';

const FILE = path.resolve(__dirname, '../accounts.ts');
const SRC = fs.readFileSync(FILE, 'utf8');

describe('src/copy/accounts.ts — the M1d strings', () => {
  it('the sheet, the rows and the public states (spec §3.1, §3.4, §4.1)', () => {
    expect(c.ACCOUNTS_TITLE).toBe('Accounts');
    expect(c.TAG_MAIN).toBe('main');
    expect(c.TAG_EXIT).toBe('exit');
    expect(c.TAG_LINKED).toBe('linked');
    expect(c.ACCOUNTS_FOOTER).toBe('New accounts appear here when you make funds public to “A new account”.');
    expect(c.ACCOUNTS_UNREADABLE).toBe("Other accounts can't be read right now.");
    expect(c.ROW_NOT_CHECKED).toBe('not checked yet');
    expect(c.ROW_UNAVAILABLE).toBe('Balance unavailable');
    expect(c.PUBLIC_LOADING).toBe('Loading balances…');
    expect(c.PUBLIC_UNAVAILABLE).toBe('Balance unavailable · pull to refresh');
  });

  it('the linking warning (spec §4.4, M1 spec §10 C2)', () => {
    expect(c.LINK_WARNING_TITLE).toBe('Sending between your own accounts links them on chain.');
    expect(c.LINK_WARNING_BODY).toBe('Anyone can see that these two accounts belong to the same person.');
    expect(c.LINK_TAP_AGAIN).toBe('Tap again to send anyway');
  });

  it('From, the main-only lines, Received by, the avatar (spec §4.1–§4.3; plan A7, A13, A19)', () => {
    expect(c.fromLine('Account 4', '3YqEpf…JXT94k', false)).toBe('From: Account 4 · 3YqEpf…JXT94k');
    expect(c.fromLine('Account 1', 'HAgk14…3DKpqk', true)).toBe('From: Account 1 (main) · HAgk14…3DKpqk');
    expect(c.accountWithAddress('Account 4', '3YqEpf…JXT94k', false)).toBe('Account 4 · 3YqEpf…JXT94k');
    expect(c.accountWithAddress('Account 1', 'HAgk14…3DKpqk', true)).toBe('Account 1 (main) · HAgk14…3DKpqk');
    expect(c.fromMainLine('Account 1')).toBe('From: Account 1 (main)');
    expect(c.fromMainLine('Account 4')).toBe('From: Account 4 (main)');
    expect(c.USES_MAIN_ACCOUNT).toBe('Uses your main account');
    expect(c.RECEIVED_BY).toBe('Received by');
    expect(c.avatarA11y('Account 3')).toBe('Account 3, switch account');
  });

  it('the combined line (spec §4.5)', () => {
    expect(c.combinedLine('$12.40', '1.0038 TEST')).toBe('Public $12.40 · Private 1.0038 TEST');
    expect(c.VALUE_UNKNOWN).toBe('—');
    expect(c.VALUE_HIDDEN).toBe('•••');
    expect(c.combinedLine(c.VALUE_HIDDEN, c.VALUE_HIDDEN)).toBe('Public ••• · Private •••');
  });

  it('#17 who sees what (M1 spec §11 R11; plan A15: only the banned word is reworded)', () => {
    expect(c.WHO_SEES_WHAT).toBe('Who sees what');
    expect(c.WHO_SEES_RELAYER).toBe(
      'When you make tokens public, the relayer that sends them sees the request: the destination, the amount, the time and the network address it came from. The proof does not tell it which deposit is spent, but amounts and timing can hint at it. Otherwise it sees what anyone sees on chain.',
    );
    expect(c.WHO_SEES_RPC).toBe(
      'The RPC provider the app uses sees every request the app makes, including the balances of all your accounts.',
    );
    expect(c.WHO_SEES_CHAIN).toBe('On chain, amounts and timing are public.');
  });
});

describe('src/copy/accounts.ts — honesty', () => {
  it('the scan reads the module (positive control: it is not empty)', () => {
    expect(userVisibleStrings('src/copy/accounts.ts', SRC).length).toBeGreaterThanOrEqual(20);
  });
  it('no banned word, no forbidden claim', () => {
    expect(bannedStrings('src/copy/accounts.ts', SRC)).toEqual([]);
    expect(forbiddenClaims('src/copy/accounts.ts', SRC)).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing tests — the list, the selection, the hook**

Create `src/modules/accounts/__tests__/accountList.test.ts`:

```ts
/**
 * M1d spec §3.1: the account list from the encrypted registry, without the seed. Pure: the
 * registry read is handed in. Addresses are the repo's vector addresses (real, on-curve).
 */
import {accountLabel, accountNumber, buildAccountList, shortAccountAddress} from '../accountList';
import {A0AccountRegistryError} from '../../shielded/a0/accountRegistry';
import type {A0AccountEntry, A0AccountRole} from '../../shielded/a0/accountRegistry';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'; // slip10:0
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'; // slip10:1
const A2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm'; // slip10:2
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k'; // slip10:3
const CLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const SLIP0 = {kind: 'slip10', account: 0} as const;
const e = (scheme: string, role: A0AccountRole, address: string, linked = false): A0AccountEntry =>
  linked ? {scheme, role, address, linked: true} : {scheme, role, address};
const throwing = (code: 'E_A0_STORE_LOCKED' | 'E_A0_ACCOUNTS_CORRUPT') => () => {
  throw new A0AccountRegistryError(code, 'test');
};

describe('labels (spec §3.1, the extension\'s rule)', () => {
  it('slip10:N → "Account N+1"; cli → "Account 1"', () => {
    expect(accountLabel({kind: 'slip10', account: 0})).toBe('Account 1');
    expect(accountLabel({kind: 'slip10', account: 3})).toBe('Account 4');
    expect(accountLabel({kind: 'cli'})).toBe('Account 1');
    expect(accountNumber({kind: 'slip10', account: 2})).toBe(3);
    expect(accountNumber({kind: 'cli'})).toBe(1);
  });
  it('the short address is first 6 … last 6 (screen.md §0 checksum convention)', () => {
    expect(shortAccountAddress(A3)).toBe('3YqEpf…JXT94k');
    expect(shortAccountAddress('abc')).toBe('abc');
  });
});

describe('the list (spec §3.1)', () => {
  it('no registry yet → exactly the main account, from walletStore.publicKey and the wallet scheme', () => {
    const l = buildAccountList(MAIN, SLIP0, () => null);
    expect(l.accounts).toEqual([
      {scheme: 'slip10:0', address: MAIN, label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false},
    ]);
    expect(l.unreadable).toBe(false);
    expect(l.walletKind).toBe('slip10');
    expect(l.seed).toEqual([{address: MAIN, role: 'main'}]);
  });

  it('main first, then fresh-exit by ascending index; fresh-pending never listed (but in the seed set); linked kept', () => {
    const l = buildAccountList(MAIN, SLIP0, () => [
      e('slip10:0', 'main', MAIN),
      e('slip10:3', 'fresh-exit', A3),
      e('slip10:1', 'fresh-pending', A1),
      e('slip10:2', 'fresh-exit', A2, true),
    ]);
    expect(l.accounts.map(a => a.scheme)).toEqual(['slip10:0', 'slip10:2', 'slip10:3']);
    expect(l.accounts[1]).toEqual({scheme: 'slip10:2', address: A2, label: 'Account 3', number: 3, role: 'fresh-exit', isMain: false, linked: true});
    expect(l.accounts[2]).toEqual({scheme: 'slip10:3', address: A3, label: 'Account 4', number: 4, role: 'fresh-exit', isMain: false, linked: false});
    expect(l.accounts.some(a => a.address === A1)).toBe(false);
    expect(l.seed).toEqual(
      expect.arrayContaining([
        {address: MAIN, role: 'main'},
        {address: A1, role: 'fresh-pending'},
        {address: A2, role: 'fresh-exit'},
        {address: A3, role: 'fresh-exit'},
      ]),
    );
    expect(l.unreadable).toBe(false);
  });

  it.each(['E_A0_STORE_LOCKED', 'E_A0_ACCOUNTS_CORRUPT'] as const)('a read failure (%s) → the main account only and the line, never empty', code => {
    const l = buildAccountList(MAIN, SLIP0, throwing(code));
    expect(l.accounts.map(a => a.scheme)).toEqual(['slip10:0']);
    expect(l.unreadable).toBe(true);
    expect(l.seed).toEqual([{address: MAIN, role: 'main'}]);
  });

  it('Review Focus 1: a registry whose main is not this wallet\'s → unreadable; its exits are never listed', () => {
    const otherWallet = () => [e('slip10:0', 'main', A2), e('slip10:3', 'fresh-exit', A3)];
    const l = buildAccountList(MAIN, SLIP0, otherWallet);
    expect(l.accounts.map(a => a.address)).toEqual([MAIN]);
    expect(l.unreadable).toBe(true);
    expect(l.seed).toEqual([{address: MAIN, role: 'main'}]);
    // the scheme half: the registry's main is slip10:0, the wallet was imported as slip10:3
    const l2 = buildAccountList(A3, {kind: 'slip10', account: 3}, () => [e('slip10:0', 'main', A3)]);
    expect(l2.unreadable).toBe(true);
    // control: the same registry for the wallet it belongs to is read
    expect(buildAccountList(A2, SLIP0, otherWallet).accounts.map(a => a.address)).toEqual([A2, A3]);
  });

  it('a cli wallet lists its one account (S9), with or without a registry', () => {
    const none = buildAccountList(CLI, {kind: 'cli'}, () => null);
    expect(none.accounts.map(a => [a.scheme, a.label])).toEqual([['cli', 'Account 1']]);
    expect(none.walletKind).toBe('cli');
    expect(buildAccountList(CLI, {kind: 'cli'}, () => [e('cli', 'main', CLI)]).accounts).toHaveLength(1);
  });

  it('a slip10:3 main is "Account 4" and stays first, before a lower exit index (never renumbered)', () => {
    const l = buildAccountList(A3, {kind: 'slip10', account: 3}, () => [e('slip10:3', 'main', A3), e('slip10:0', 'fresh-exit', MAIN)]);
    expect(l.accounts.map(a => a.label)).toEqual(['Account 4', 'Account 1']);
    expect(l.accounts[0]!.isMain).toBe(true);
  });
});
```

Create `src/modules/accounts/__tests__/selectedAccount.test.ts`:

```ts
/**
 * M1d spec §3.2: the selected account — encrypted MMKV only, default main, a stored scheme that is
 * not listed falls back to main and is rewritten; walletStore.publicKey never moves. The registry
 * is written as raw records (the M1c format), read by the real registry module.
 */
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {storeTransparentScheme} from '../../keyDerivation/derivationScheme';
import {useWalletStore} from '../../../store/zustand/walletStore';
import {
  readAccountsState,
  refreshAccounts,
  resetAccountsForTests,
  resolveSelection,
  selectAccount,
  useAccountsStore,
} from '../selectedAccount';
import {buildAccountList} from '../accountList';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const REG = 'v1_accounts';
const SEL = 'v1_accounts.selected';
const setRegistry = (accounts: object[]): void => mmkvSecure()!.set(REG, JSON.stringify({schema: 1, accounts}));
const main = {scheme: 'slip10:0', role: 'main', address: MAIN};
const exit3 = {scheme: 'slip10:3', role: 'fresh-exit', address: A3};
const pending1 = {scheme: 'slip10:1', role: 'fresh-pending', address: A1};

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
  resetAccountsForTests();
});

it('the key is v1_accounts.selected (encrypted instance, mmkvKeys.ts [S])', () => {
  expect(MMKV_KEYS.ACCOUNTS_SELECTED).toBe(SEL);
});

it('default: the main account', () => {
  expect(refreshAccounts(MAIN)!.selected).toMatchObject({scheme: 'slip10:0', address: MAIN, isMain: true, label: 'Account 1'});
  expect(mmkvSecure()!.getString(SEL)).toBeUndefined(); // nothing written for a default
});

it('a selection is stored in the ENCRYPTED instance only, as the scheme string', () => {
  setRegistry([main, exit3]);
  refreshAccounts(MAIN);
  const publicBefore = mmkvPublic.getAllKeys().sort();
  expect(selectAccount('slip10:3')).toBe(true);
  expect(mmkvSecure()!.getString(SEL)).toBe('slip10:3');
  expect(mmkvPublic.getAllKeys().sort()).toEqual(publicBefore);
  expect(useAccountsStore.getState().state!.selected).toMatchObject({scheme: 'slip10:3', address: A3, label: 'Account 4', isMain: false});
});

it('persists across a restart (the store forgotten, re-hydrated from MMKV)', () => {
  setRegistry([main, exit3]);
  refreshAccounts(MAIN);
  selectAccount('slip10:3');
  resetAccountsForTests();
  expect(refreshAccounts(MAIN)!.selected.scheme).toBe('slip10:3');
});

it('a stored scheme that is not listed (wiped, restored) → main, silently, and the stored value is rewritten', () => {
  setRegistry([main, exit3]);
  mmkvSecure()!.set(SEL, 'slip10:7');
  expect(refreshAccounts(MAIN)!.selected.scheme).toBe('slip10:0');
  expect(mmkvSecure()!.getString(SEL)).toBe('slip10:0');
});

it('a fresh-pending reservation is never selected, and cannot be selected', () => {
  setRegistry([main, pending1]);
  mmkvSecure()!.set(SEL, 'slip10:1');
  expect(refreshAccounts(MAIN)!.selected.scheme).toBe('slip10:0');
  expect(selectAccount('slip10:1')).toBe(false);
  expect(selectAccount('slip10:9')).toBe(false);
  expect(useAccountsStore.getState().state!.selected.scheme).toBe('slip10:0');
});

it('plan A4: an unreadable registry → main in memory, the stored choice KEPT', () => {
  mmkvSecure()!.set(SEL, 'slip10:3');
  mmkvSecure()!.set(REG, '{');
  const s = refreshAccounts(MAIN)!;
  expect(s.selected.scheme).toBe('slip10:0');
  expect(s.list.unreadable).toBe(true);
  expect(mmkvSecure()!.getString(SEL)).toBe('slip10:3');
});

it('no encrypted instance (locked) → main only, the line; a selection of main writes nothing and does not throw', () => {
  clearAllStores();
  storeTransparentScheme({kind: 'slip10', account: 0});
  const s = refreshAccounts(MAIN)!;
  expect(s.list.unreadable).toBe(true);
  expect(s.list.accounts).toHaveLength(1);
  expect(() => selectAccount('slip10:0')).not.toThrow();
});

it('walletStore.publicKey is never changed by a selection (approach 1)', () => {
  useWalletStore.getState().setPublicKey(MAIN);
  setRegistry([main, exit3]);
  refreshAccounts(MAIN);
  selectAccount('slip10:3');
  expect(useWalletStore.getState().publicKey).toBe(MAIN);
});

it('Review Focus 5: a wipe + import in the same process resets the selection; the new wallet starts on its main', () => {
  setRegistry([main, exit3]);
  refreshAccounts(MAIN);
  selectAccount('slip10:3');
  clearAllStores(); // the in-app wipe
  initSecureMmkv('the-next-wallet'); // the import opens a new encrypted instance → the reset hooks fire
  expect(useAccountsStore.getState().state).toBeNull();
  storeTransparentScheme({kind: 'slip10', account: 0});
  const s = refreshAccounts(FOREIGN)!;
  expect(s.selected).toMatchObject({address: FOREIGN, isMain: true});
  expect(s.list.accounts.map(a => a.address)).toEqual([FOREIGN]);
});

it('no wallet → null and an empty store', () => {
  expect(refreshAccounts(null)).toBeNull();
  expect(useAccountsStore.getState().state).toBeNull();
});

it('resolveSelection / readAccountsState: pure reads, nothing written', () => {
  const list = buildAccountList(MAIN, {kind: 'slip10', account: 0}, () => null);
  expect(resolveSelection(list, undefined)).toEqual({selected: list.accounts[0], rewrite: false});
  expect(resolveSelection(list, 'slip10:5').rewrite).toBe(true);
  mmkvSecure()!.set(SEL, 'slip10:5');
  expect(readAccountsState(MAIN).selected.scheme).toBe('slip10:0');
  expect(mmkvSecure()!.getString(SEL)).toBe('slip10:5'); // a read never rewrites; refreshAccounts does
});
```

Create `src/hooks/__tests__/useSelectedAccount.test.tsx`:

```tsx
/** M1d spec §3.2: useSelectedAccount() — observable, hydrated from MMKV, the main account by default. */
import {act, renderHook} from '@testing-library/react-native';
import {clearAllStores, initSecureMmkv, mmkvSecure} from '../../store/mmkv/instances';
import {storeTransparentScheme} from '../../modules/keyDerivation/derivationScheme';
import {useWalletStore} from '../../store/zustand/walletStore';
import {resetAccountsForTests, selectAccount, useAccountsStore} from '../../modules/accounts/selectedAccount';
import {useAccountList, useRefreshAccounts, useSelectedAccount} from '../useSelectedAccount';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const setRegistry = (accounts: object[]): void => mmkvSecure()!.set('v1_accounts', JSON.stringify({schema: 1, accounts}));

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
  resetAccountsForTests();
  useWalletStore.setState({publicKey: MAIN});
});

it('the first render already returns the main account; the store is then hydrated', () => {
  const {result} = renderHook(() => useSelectedAccount());
  expect(result.current).toMatchObject({scheme: 'slip10:0', address: MAIN, label: 'Account 1', role: 'main', isMain: true});
  expect(useAccountsStore.getState().forMain).toBe(MAIN);
});

it('a selection is observable (spec §3.2 "changes are observable")', () => {
  setRegistry([{scheme: 'slip10:0', role: 'main', address: MAIN}, {scheme: 'slip10:3', role: 'fresh-exit', address: A3}]);
  const {result} = renderHook(() => useSelectedAccount());
  act(() => {
    selectAccount('slip10:3');
  });
  expect(result.current).toMatchObject({scheme: 'slip10:3', label: 'Account 4', number: 4, isMain: false});
});

it('useRefreshAccounts re-reads the registry: an exit that landed appears in the list', () => {
  const {result} = renderHook(() => ({list: useAccountList(), refresh: useRefreshAccounts()}));
  expect(result.current.list!.accounts).toHaveLength(1);
  setRegistry([{scheme: 'slip10:0', role: 'main', address: MAIN}, {scheme: 'slip10:3', role: 'fresh-exit', address: A3}]);
  act(() => result.current.refresh());
  expect(result.current.list!.accounts.map(a => a.label)).toEqual(['Account 1', 'Account 4']);
});

it('no wallet loaded → null (plan A5)', () => {
  useWalletStore.setState({publicKey: null});
  const {result} = renderHook(() => useSelectedAccount());
  expect(result.current).toBeNull();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/copy/__tests__/accounts.test.ts src/modules/accounts src/hooks/__tests__/useSelectedAccount.test.tsx`
Expected: FAIL — `Cannot find module '../accounts'`, `'../accountList'`, `'../selectedAccount'`, `'../useSelectedAccount'`.

- [ ] **Step 4: Add the MMKV key**

In `src/constants/mmkvKeys.ts`, directly after the `ACCOUNTS_REGISTRY: 'v1_accounts',` line, add:

```ts
  /** M1d: the selected account's scheme (`slip10:n` | `cli`). A choice among one's own accounts is itself a link (M1 spec I6): ENCRYPTED instance only. */
  ACCOUNTS_SELECTED: 'v1_accounts.selected',
```

- [ ] **Step 5: Write the copy module**

Create `src/copy/accounts.ts`:

```ts
/**
 * M1d (spec docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md §4; M1 spec §10,
 * §11 R11): every user-visible string of the accounts surfaces — the Accounts sheet and the
 * avatar, "From:" on #19/#20, the linking warning on #12, the main-only lines, #21's "Received by",
 * the combined line and #17's "Who sees what". The screens import these.
 *
 * Honesty: nothing here may promise more than the wallet delivers (copyScan FORBIDDEN_NEW; the
 * privacy-claims guard reads this file). The linking warning says what the chain shows; the R11
 * paragraph names everyone who sees a request.
 */
import {MODE_PRIVATE, MODE_PUBLIC} from './modes';

/** The Accounts sheet (§4.1) */
export const ACCOUNTS_TITLE = 'Accounts';
export const TAG_MAIN = 'main';
export const TAG_EXIT = 'exit';
export const TAG_LINKED = 'linked';
/** slip10 wallets only (a cli wallet has one account, S9) */
export const ACCOUNTS_FOOTER = 'New accounts appear here when you make funds public to “A new account”.';
/** §3.1: the registry could not be read — the main account only, and this one line */
export const ACCOUNTS_UNREADABLE = "Other accounts can't be read right now.";
/** §3.4: a row whose balances were not read yet, or failed */
export const ROW_NOT_CHECKED = 'not checked yet';
export const ROW_UNAVAILABLE = 'Balance unavailable';
/** The dashboard's public token list while a non-main account's balances load or failed (Review Focus 4) */
export const PUBLIC_LOADING = 'Loading balances…';
export const PUBLIC_UNAVAILABLE = 'Balance unavailable · pull to refresh';

/** The linking warning on #12 (§4.4, M1 spec §10 C2) and its second tap */
export const LINK_WARNING_TITLE = 'Sending between your own accounts links them on chain.';
export const LINK_WARNING_BODY = 'Anyone can see that these two accounts belong to the same person.';
export const LINK_TAP_AGAIN = 'Tap again to send anyway';

/** Swap, presale and referral stay on the main account (§4.3, D1) */
export const USES_MAIN_ACCOUNT = 'Uses your main account';
/** #21 Now public, Details (§4.3) */
export const RECEIVED_BY = 'Received by';

/** The combined line (§4.5): an unknown side, and a hidden one */
export const VALUE_UNKNOWN = '—';
export const VALUE_HIDDEN = '•••';

/** #17 (M1 spec §11 R11; plan A15: "unshield" reworded, nothing widened) */
export const WHO_SEES_WHAT = 'Who sees what';
export const WHO_SEES_RELAYER =
  'When you make tokens public, the relayer that sends them sees the request: the destination, the amount, the time and the network address it came from. The proof does not tell it which deposit is spent, but amounts and timing can hint at it. Otherwise it sees what anyone sees on chain.';
export const WHO_SEES_RPC =
  'The RPC provider the app uses sees every request the app makes, including the balances of all your accounts.';
export const WHO_SEES_CHAIN = 'On chain, amounts and timing are public.';

/** The avatar's accessibility label (plan A19) */
export function avatarA11y(label: string): string {
  return `${label}, switch account`;
}

/** "Account 4 · 3YqEpf…JXT94k" / "Account 1 (main) · HAgk14…3DKpqk" — #20's From row, #21's Received by */
export function accountWithAddress(label: string, short: string, isMain: boolean): string {
  return `${label}${isMain ? ' (main)' : ''} · ${short}`;
}

/** #19's caption (§4.2) */
export function fromLine(label: string, short: string, isMain: boolean): string {
  return `From: ${accountWithAddress(label, short, isMain)}`;
}

/** Swap and presale while another account is selected (§4.3; plan A13: the main's own label) */
export function fromMainLine(mainLabel: string): string {
  return `From: ${mainLabel} (main)`;
}

/** "Public X · Private Y" — the two sides already formatted, never summed (§4.5, D4) */
export function combinedLine(pub: string, priv: string): string {
  return `${MODE_PUBLIC} ${pub} · ${MODE_PRIVATE} ${priv}`;
}
```

- [ ] **Step 6: Write the account list**

Create `src/modules/accounts/accountList.ts`:

```ts
/**
 * M1d spec §3.1 (M1 spec §10): the accounts of this wallet the app shows — the registry's `main`
 * entry and every `fresh-exit`, read WITHOUT the seed (`loadA0AccountRegistry`, the stored
 * addresses). A `fresh-pending` reservation is never listed, but it is in `seed` (every address of
 * this seed the registry knows), which the linking warning reads (plan A2).
 *
 * Fail closed: any registry read failure, and a registry whose main is not this wallet's (plan A3),
 * lists the main account only with `unreadable: true` — never an empty list, never another
 * wallet's accounts. Pure: the registry read is handed in.
 */
import {schemeToString} from '../keyDerivation/transparent';
import type {TransparentScheme} from '../keyDerivation/transparent';
import {parseA0Scheme} from '../shielded/a0/accountRegistry';
import type {A0AccountEntry, A0AccountRole} from '../shielded/a0/accountRegistry';

export interface WalletAccount {
  /** `slip10:n` | `cli` */
  scheme: string;
  /** base58; for the main account, walletStore.publicKey */
  address: string;
  /** "Account N+1" */
  label: string;
  /** N+1 — the avatar shows it */
  number: number;
  role: 'main' | 'fresh-exit';
  isMain: boolean;
  /** a fresh exit a key of this seed signed (M1c Task 7): the sheet tags it "linked" */
  linked: boolean;
}

export interface SeedAccount {
  address: string;
  role: A0AccountRole;
}

export interface AccountList {
  /** the main account first, then every fresh-exit by ascending index */
  accounts: readonly WalletAccount[];
  /** every address of this seed the registry knows (fresh-pending included) — for the linking warning */
  seed: readonly SeedAccount[];
  walletKind: 'slip10' | 'cli';
  /** the registry could not be read (or is not this wallet's): main only, and the sheet says so */
  unreadable: boolean;
}

export function accountNumber(scheme: TransparentScheme): number {
  return scheme.kind === 'cli' ? 1 : scheme.account + 1;
}

/** The extension's rule (`addAccount` names it `Account ${index + 1}`): slip10:N → "Account N+1", cli → "Account 1". */
export function accountLabel(scheme: TransparentScheme): string {
  return `Account ${accountNumber(scheme)}`;
}

/** first 6 … last 6 (screen.md §0, the checksum convention) */
export function shortAccountAddress(address: string): string {
  return address.length <= 13 ? address : `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function buildAccountList(
  mainAddress: string,
  mainScheme: TransparentScheme,
  readRegistry: () => readonly A0AccountEntry[] | null,
): AccountList {
  const main: WalletAccount = {
    scheme: schemeToString(mainScheme),
    address: mainAddress,
    label: accountLabel(mainScheme),
    number: accountNumber(mainScheme),
    role: 'main',
    isMain: true,
    linked: false,
  };
  const walletKind = mainScheme.kind;
  const mainOnly = (unreadable: boolean): AccountList => ({
    accounts: [main],
    seed: [{address: mainAddress, role: 'main'}],
    walletKind,
    unreadable,
  });
  let entries: readonly A0AccountEntry[] | null;
  try {
    entries = readRegistry();
  } catch {
    return mainOnly(true);
  }
  if (entries === null) {
    return mainOnly(false);
  }
  const registryMain = entries.find(x => x.role === 'main');
  if (!registryMain || registryMain.scheme !== main.scheme || registryMain.address !== mainAddress) {
    return mainOnly(true);
  }
  const exits: {index: number; account: WalletAccount}[] = [];
  for (const x of entries) {
    if (x.role !== 'fresh-exit') {
      continue;
    }
    const s = parseA0Scheme(x.scheme);
    if (s === null || s.kind !== 'slip10') {
      continue;
    }
    exits.push({
      index: s.account,
      account: {
        scheme: x.scheme,
        address: x.address,
        label: accountLabel(s),
        number: accountNumber(s),
        role: 'fresh-exit',
        isMain: false,
        linked: x.linked === true,
      },
    });
  }
  exits.sort((a, b) => a.index - b.index);
  return {
    accounts: [main, ...exits.map(x => x.account)],
    seed: entries.map(x => ({address: x.address, role: x.role})),
    walletKind,
    unreadable: false,
  };
}
```

- [ ] **Step 7: Write the selection**

Create `src/modules/accounts/selectedAccount.ts`:

```ts
/**
 * M1d spec §3.2: the selected account. Stored in the ENCRYPTED MMKV only (a choice among one's own
 * accounts is itself a link, M1 spec I6) as the scheme string; held in memory in a Zustand store,
 * hydrated by `refreshAccounts`. Default main; a stored scheme that is not listed falls back to
 * main silently and is rewritten — only when the registry was read (plan A4).
 *
 * walletStore.publicKey is NEVER changed here (approach 1): every main-only consumer keeps reading
 * it. A wipe + import replaces the encrypted instance; its reset hook clears this store (Review
 * Focus 5), so the next read starts from the new wallet.
 */
import {create} from 'zustand';
import {mmkvSecure, onSecureMmkvReset} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {loadTransparentScheme} from '../keyDerivation/derivationScheme';
import {loadA0AccountRegistry} from '../shielded/a0/accountRegistry';
import {buildAccountList} from './accountList';
import type {AccountList, WalletAccount} from './accountList';

export interface AccountsState {
  list: AccountList;
  selected: WalletAccount;
}

interface AccountsStore {
  /** the main address the state was read for (walletStore.publicKey then) */
  forMain: string | null;
  state: AccountsState | null;
}

export const useAccountsStore = create<AccountsStore>()(() => ({forMain: null, state: null}));

const KEY = MMKV_KEYS.ACCOUNTS_SELECTED;

export function readAccountList(mainAddress: string): AccountList {
  return buildAccountList(mainAddress, loadTransparentScheme(), () => loadA0AccountRegistry());
}

export function resolveSelection(list: AccountList, stored: string | undefined): {selected: WalletAccount; rewrite: boolean} {
  const main = list.accounts[0]!;
  if (stored === undefined) {
    return {selected: main, rewrite: false};
  }
  const hit = list.accounts.find(a => a.scheme === stored);
  if (hit) {
    return {selected: hit, rewrite: false};
  }
  return {selected: main, rewrite: !list.unreadable};
}

/** The stored choice; with no encrypted instance, the in-memory one (it cannot be stored now). */
function storedSelection(): string | undefined {
  const store = mmkvSecure();
  if (store) {
    return store.getString(KEY);
  }
  return useAccountsStore.getState().state?.selected.scheme;
}

/** The list and the selection as stored now — a read only, nothing written. */
export function readAccountsState(mainAddress: string): AccountsState {
  const list = readAccountList(mainAddress);
  return {list, selected: resolveSelection(list, storedSelection()).selected};
}

let resetHooked = false;
function hookReset(): void {
  if (resetHooked) {
    return;
  }
  resetHooked = true;
  onSecureMmkvReset(() => useAccountsStore.setState({forMain: null, state: null}));
}

/** Re-read the list and the stored selection into the store (the dashboard's focus, the sheet's open). */
export function refreshAccounts(mainAddress: string | null): AccountsState | null {
  hookReset();
  if (!mainAddress) {
    useAccountsStore.setState({forMain: null, state: null});
    return null;
  }
  const list = readAccountList(mainAddress);
  const {selected, rewrite} = resolveSelection(list, storedSelection());
  if (rewrite) {
    mmkvSecure()?.set(KEY, selected.scheme);
  }
  const state: AccountsState = {list, selected};
  useAccountsStore.setState({forMain: mainAddress, state});
  return state;
}

/** Select a LISTED account (never a fresh-pending one): stored (encrypted), then observable. */
export function selectAccount(scheme: string): boolean {
  const {forMain, state} = useAccountsStore.getState();
  if (!state) {
    return false;
  }
  const hit = state.list.accounts.find(a => a.scheme === scheme);
  if (!hit) {
    return false;
  }
  mmkvSecure()?.set(KEY, hit.scheme);
  useAccountsStore.setState({forMain, state: {list: state.list, selected: hit}});
  return true;
}

/** TEST-ONLY: forget the in-memory state (a "restart"). */
export function resetAccountsForTests(): void {
  useAccountsStore.setState({forMain: null, state: null});
}
```

- [ ] **Step 8: Write the hook**

Create `src/hooks/useSelectedAccount.ts`:

```ts
/**
 * M1d spec §3.2: the selected account and the account list, observable. Before the store is
 * hydrated for this wallet the hook computes the same answer from storage (a read, nothing
 * written) and hydrates in an effect, so the first render already has the right account.
 * Screens read accounts ONLY through this module (one mock in a screen test).
 */
import {useCallback, useEffect, useMemo} from 'react';
import {useWalletStore} from '../store/zustand/walletStore';
import {readAccountsState, refreshAccounts, selectAccount, useAccountsStore} from '../modules/accounts/selectedAccount';
import type {AccountsState} from '../modules/accounts/selectedAccount';
import type {AccountList, WalletAccount} from '../modules/accounts/accountList';

export function useAccounts(): AccountsState | null {
  const mainAddress = useWalletStore(s => s.publicKey) ?? null;
  const forMain = useAccountsStore(s => s.forMain);
  const state = useAccountsStore(s => s.state);
  const hydrated = mainAddress !== null && forMain === mainAddress && state !== null;
  const view = useMemo(
    () => (hydrated ? state : mainAddress !== null ? readAccountsState(mainAddress) : null),
    [hydrated, state, mainAddress],
  );
  useEffect(() => {
    if (mainAddress !== null && !hydrated) {
      refreshAccounts(mainAddress);
    }
  }, [mainAddress, hydrated]);
  return view;
}

export function useSelectedAccount(): WalletAccount | null {
  return useAccounts()?.selected ?? null;
}

export function useAccountList(): AccountList | null {
  return useAccounts()?.list ?? null;
}

export function useSelectAccount(): (scheme: string) => boolean {
  return selectAccount;
}

export function useRefreshAccounts(): () => void {
  const mainAddress = useWalletStore(s => s.publicKey) ?? null;
  return useCallback(() => {
    refreshAccounts(mainAddress);
  }, [mainAddress]);
}
```

- [ ] **Step 9: Widen the guard and the scan (file lists only)**

In `src/screens/shielded/__tests__/privacyClaims.test.ts`, append to the `EXTRA_COPY` array (before its closing `];`):

```ts
  // M1d: the accounts copy and the account labels ("Account N") — outside src/screens and src/components
  path.join(ROOT, 'src/copy/accounts.ts'),
  path.join(ROOT, 'src/modules/accounts/accountList.ts'),
```

and in the same file's positive-control `expect.arrayContaining([...])` list (the one ending with `'src/screens/onboarding/SelectAccountScreen.tsx',`) add after that line:

```ts
        // M1d: the accounts copy module and the label module are in scope
        'src/copy/accounts.ts',
        'src/modules/accounts/accountList.ts',
```

In `src/copy/__tests__/bannedWords.test.ts`, append to `EXTRA` (before `];`):

```ts
  // M1d: the accounts copy and the account labels
  'src/copy/accounts.ts',
  'src/modules/accounts/accountList.ts',
```

No regex, no other row of either file changes.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx jest src/copy src/modules/accounts src/hooks/__tests__/useSelectedAccount.test.tsx src/screens/shielded/__tests__/privacyClaims.test.ts src/modules/shielded/a0/__tests__/accountRegistry.test.ts`
Expected: PASS (the registry's own suite is unchanged and green — nothing in `src/modules/shielded/a0/` was edited).

- [ ] **Step 11: Mutations (each must go red, then revert)**

1. In `buildAccountList`, delete `|| registryMain.address !== mainAddress` → `accountList.test.ts` "Review Focus 1" FAILS. Revert.
2. In `resolveSelection`, change `rewrite: !list.unreadable` to `rewrite: true` → "plan A4" FAILS. Revert.
3. In `hookReset`, comment out the `onSecureMmkvReset(...)` line → "Review Focus 5" FAILS. Revert.
4. In `buildAccountList`, change `if (x.role !== 'fresh-exit')` to `if (x.role === 'main')` → the "fresh-pending never listed" row FAILS. Revert.

- [ ] **Step 12: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: jest all green; tsc exit 0; lint `✖ 144 problems (0 errors, 144 warnings)`; the TGE check exit 0.

- [ ] **Step 13: Commit**

```bash
git add src/copy/accounts.ts src/copy/__tests__/accounts.test.ts src/copy/__tests__/bannedWords.test.ts \
  src/modules/accounts src/hooks/useSelectedAccount.ts src/hooks/__tests__/useSelectedAccount.test.tsx \
  src/constants/mmkvKeys.ts src/screens/shielded/__tests__/privacyClaims.test.ts
git commit -m "feat(m1d): the account list, the selected account (encrypted) and the M1d copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Public data follows the selection — the dashboard's Public mode, TokenDetail, Receive, history

**Files:**
- Create: `src/modules/accounts/accountSnapshot.ts`
- Create: `src/hooks/useAccountPublicData.ts`
- Modify: `src/screens/dashboard/DashboardScreen.tsx` (Public mode's data source, the focus refresh, the not-loaded states)
- Modify: `src/screens/transparent/TokenDetailScreen.tsx` (its holding follows the selection, plan A6)
- Modify: `src/screens/transparent/TransactionHistoryScreen.tsx` (the selected account's history and its name)
- Modify: `src/screens/transparent/ReceiveScreen.tsx` (an `accountLabel` prop), `src/app/Navigator.tsx` (`ReceiveScreenNav` only)
- Test: `src/modules/accounts/__tests__/accountSnapshot.test.ts`, `src/hooks/__tests__/useAccountPublicData.test.tsx` (create); `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`, `src/screens/dashboard/__tests__/DashboardChainIdentity.test.tsx`, `src/screens/transparent/__tests__/{TokenDetailScreen,TransactionHistoryScreen,ReceiveScreen}.test.tsx`, `src/app/__tests__/shieldedRoutes.test.tsx` (modify)

**Interfaces:**
- Consumes (Task 1): `useSelectedAccount(): WalletAccount | null`, `useRefreshAccounts(): () => void`, `useAccountList(): AccountList | null`, `useSelectAccount()`, `useAccounts()` from `src/hooks/useSelectedAccount.ts`; `WalletAccount {scheme; address; label; number; role: 'main' | 'fresh-exit'; isMain; linked}` from `src/modules/accounts/accountList.ts`; `PUBLIC_LOADING = 'Loading balances…'`, `PUBLIC_UNAVAILABLE = 'Balance unavailable · pull to refresh'`, `VALUE_UNKNOWN = '—'` from `src/copy/accounts.ts`.
- Consumes (existing): `getBalance(connection, pk): Promise<bigint>`, `getTokenAccounts(connection, pk): Promise<TokenAccount[]>` (`src/modules/solana/queries.ts`); `sumTokenBalancesByMint(accounts): Record<string, string>` (`src/modules/solana/tokenBalances.ts`); `TokenManager` (`fetchVerifiedList`, `buildDisplayTokens`), `fetchTokenMetadata`, `loadCachedMetadata`, `saveCachedMetadata`; `forceSync()` (unchanged).
- Produces (`src/modules/accounts/accountSnapshot.ts`): `interface AccountSnapshot {solBalance: string; nocBalance: string; tokenBalances: Record<string, string>; tokens: TokenMetadata[]}`, `fetchAccountSnapshot(address: string): Promise<AccountSnapshot>` (rejects when either read fails — never a partial snapshot).
- Produces (`src/hooks/useAccountPublicData.ts`): `interface PublicBalances {solBalance: string; nocBalance: string; tokenBalances: Record<string, string>; tokens: TokenMetadata[]}`, `type AccountPublicData = {status: 'loading'} | {status: 'error'} | ({status: 'ready'; syncedAt: number | null} & PublicBalances)`, `NO_PUBLIC_DATA: PublicBalances`, `ACCOUNT_SNAPSHOT_KEY = 'accountSnapshot'`, `useAccountPublicData(account: {address: string; isMain: boolean} | null): {data: AccountPublicData; refetch: () => void}`. Main → `walletStore`'s values (`syncedAt` = `lastSyncedAt ?? null`), no request; another account → the query `['accountSnapshot', address]`.
- Produces (`ReceiveScreen`): optional prop `accountLabel?: string` (testID `receive-account-label`). Dashboard testIDs: `dashboard-public-balance`, `dashboard-sub-sol`, `dashboard-sub-noc`, `dashboard-public-empty`. History testID `history-account-label`.

**Decision (spec §3.4, plan A6), stated in the code comments:** `forceSync` is NOT split. The dashboard runs it on every trigger whatever is selected, so the main account's slot in `walletStore` stays fresh for every main-only screen; a non-main selection is read by its own address-keyed query and never written into `walletStore`.

- [ ] **Step 1: Write the failing tests — the snapshot and the hook**

Create `src/modules/accounts/__tests__/accountSnapshot.test.ts`:

```ts
/** M1d spec §3.4: a non-main account's public data — read by address, never written into walletStore. */
const mockGetBalance = jest.fn<Promise<bigint>, [unknown, {toBase58(): string}]>();
const mockGetTokenAccounts = jest.fn();
jest.mock('../../solana/connection', () => ({getConnection: () => ({})}));
jest.mock('../../solana/queries', () => ({
  getBalance: (c: unknown, pk: {toBase58(): string}) => mockGetBalance(c, pk),
  getTokenAccounts: (c: unknown, pk: unknown) => mockGetTokenAccounts(c, pk),
}));
jest.mock('../../tokens/tokenModule', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({
    fetchVerifiedList: jest.fn().mockResolvedValue([]),
    buildDisplayTokens: (accs: {mint: string; amount: string; decimals: number}[]) =>
      accs.filter(a => a.amount !== '0').map(a => ({mint: a.mint, symbol: a.mint.slice(0, 4), name: 'T', decimals: a.decimals, trust: 'core'})),
  })),
}));
jest.mock('../../tokens/tokenMetadata', () => ({
  fetchTokenMetadata: jest.fn().mockResolvedValue({}),
  loadCachedMetadata: () => ({}),
  saveCachedMetadata: jest.fn(),
}));

import {fetchAccountSnapshot} from '../accountSnapshot';
import {useWalletStore} from '../../../store/zustand/walletStore';
import {NOC_MINT} from '../../../constants/programs';

const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

beforeEach(() => {
  mockGetBalance.mockReset().mockResolvedValue(3_000_000n);
  mockGetTokenAccounts.mockReset().mockResolvedValue([
    {mint: USDC, owner: A3, amount: '1000000', decimals: 6, address: 'x1'},
    {mint: USDC, owner: A3, amount: '2500000', decimals: 6, address: 'x2'},
  ]);
});

it('reads the named address; sums a mint across token accounts; no NOC → "0"', async () => {
  const s = await fetchAccountSnapshot(A3);
  expect(mockGetBalance.mock.calls[0]![1].toBase58()).toBe(A3);
  expect(s.solBalance).toBe('3000000');
  expect(s.tokenBalances).toEqual({[USDC]: '3500000'});
  expect(s.nocBalance).toBe('0');
  expect(s.tokens.map(t => t.mint)).toEqual([USDC, USDC]);
});

it('NOC held → nocBalance is its sum', async () => {
  mockGetTokenAccounts.mockResolvedValue([{mint: NOC_MINT, owner: A3, amount: '5', decimals: 9, address: 'n'}]);
  expect((await fetchAccountSnapshot(A3)).nocBalance).toBe('5');
});

it('Review Focus 4: a failed read rejects — never a snapshot of zeros', async () => {
  mockGetBalance.mockRejectedValue(new Error('429'));
  await expect(fetchAccountSnapshot(A3)).rejects.toThrow('429');
  mockGetBalance.mockResolvedValue(1n);
  mockGetTokenAccounts.mockRejectedValue(new Error('timeout'));
  await expect(fetchAccountSnapshot(A3)).rejects.toThrow('timeout');
});

it('never writes walletStore (the main account\'s slot)', async () => {
  useWalletStore.setState({solBalance: '42', tokenBalances: {}, lastSyncedAt: null});
  await fetchAccountSnapshot(A3);
  expect(useWalletStore.getState().solBalance).toBe('42');
  expect(useWalletStore.getState().lastSyncedAt).toBeNull();
});
```

Create `src/hooks/__tests__/useAccountPublicData.test.tsx`:

```tsx
/** M1d spec §3.4: the selected account's public data — main from walletStore, any other by address. */
import React from 'react';
import {renderHook, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useWalletStore} from '../../store/zustand/walletStore';

const mockFetch = jest.fn();
jest.mock('../../modules/accounts/accountSnapshot', () => ({fetchAccountSnapshot: (a: string) => mockFetch(a)}));

import {NO_PUBLIC_DATA, useAccountPublicData} from '../useAccountPublicData';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const SNAP = {solBalance: '3000000', nocBalance: '0', tokenBalances: {}, tokens: []};

function wrapper({children}: {children: React.ReactNode}) {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockFetch.mockReset();
  useWalletStore.setState({publicKey: MAIN, solBalance: '1000000000', nocBalance: '7', tokenBalances: {}, tokens: [], lastSyncedAt: 123});
});

it('main → walletStore\'s values, ready, no request (forceSync owns that slot)', () => {
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'ready', solBalance: '1000000000', nocBalance: '7', tokenBalances: {}, tokens: [], syncedAt: 123});
  expect(mockFetch).not.toHaveBeenCalled();
});

it('plan A12: main never synced → syncedAt null', () => {
  useWalletStore.setState({lastSyncedAt: null});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toMatchObject({status: 'ready', syncedAt: null});
});

it('another account → loading, then its own snapshot (by its address)', async () => {
  mockFetch.mockResolvedValue(SNAP);
  const {result} = renderHook(() => useAccountPublicData({address: A3, isMain: false}), {wrapper});
  expect(result.current.data).toEqual({status: 'loading'});
  await waitFor(() => expect(result.current.data.status).toBe('ready'));
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '3000000'});
  expect(mockFetch).toHaveBeenCalledWith(A3);
});

it('Review Focus 4: a failed read → error, never zeros', async () => {
  mockFetch.mockRejectedValue(new Error('429'));
  const {result} = renderHook(() => useAccountPublicData({address: A3, isMain: false}), {wrapper});
  await waitFor(() => expect(result.current.data).toEqual({status: 'error'}));
});

it('no account → loading; NO_PUBLIC_DATA is all zeros (shown only behind a not-ready state)', () => {
  const {result} = renderHook(() => useAccountPublicData(null), {wrapper});
  expect(result.current.data).toEqual({status: 'loading'});
  expect(NO_PUBLIC_DATA).toEqual({solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []});
});
```

- [ ] **Step 2: Write the failing tests — the screens**

In `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`, add after the `jest.mock('../../../modules/solana/connection', …)` line:

```tsx
// ── M1d: the selected account and its public data (spec §3.4) ────────────────
import type {WalletAccount} from '../../../modules/accounts/accountList';
import type {AccountPublicData} from '../../../hooks/useAccountPublicData';
const MAIN_ACCOUNT: WalletAccount = {scheme: 'slip10:0', address: 'AbCdEfAbCdEf', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false};
const EXIT_ACCOUNT: WalletAccount = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', number: 4, role: 'fresh-exit', isMain: false, linked: false};
const mockSelected: {current: WalletAccount | null} = {current: MAIN_ACCOUNT};
const mockRefreshAccounts = jest.fn();
const mockSelect = jest.fn(() => true);
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockSelected.current,
  useAccountList: () => (mockSelected.current ? {accounts: [mockSelected.current], seed: [], walletKind: 'slip10', unreadable: false} : null),
  useAccounts: () => null,
  useSelectAccount: () => mockSelect,
  useRefreshAccounts: () => mockRefreshAccounts,
}));
const READY_MAIN: AccountPublicData = {status: 'ready', solBalance: '1000000000', nocBalance: '2000000000', tokens: [], tokenBalances: {}, syncedAt: 1};
const mockPublic: {current: AccountPublicData} = {current: READY_MAIN};
const mockPublicArgs: unknown[] = [];
const mockRefetchPublic = jest.fn();
jest.mock('../../../hooks/useAccountPublicData', () => ({
  NO_PUBLIC_DATA: {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []},
  ACCOUNT_SNAPSHOT_KEY: 'accountSnapshot',
  useAccountPublicData: (a: unknown) => {
    mockPublicArgs.push(a);
    return {data: mockPublic.current, refetch: mockRefetchPublic};
  },
}));
```

(Imports placed inside the mock section are hoisted by Babel like any import; `import type` is erased.) In the existing `beforeEach` add, after `mockHide.current = false;`:

```tsx
  mockSelected.current = MAIN_ACCOUNT; // M1d: the main account selected unless a row says otherwise
  mockPublic.current = READY_MAIN; // M1d: the same values the walletStore mock holds
  mockPublicArgs.length = 0;
```

Append this `describe` at the end of the file:

```tsx
describe('M1d — Public mode follows the selected account (spec §3.4, D1/D2)', () => {
  it('the public data is asked for the SELECTED account', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    await renderDashboard();
    expect(mockPublicArgs[mockPublicArgs.length - 1]).toEqual(EXIT_ACCOUNT);
  });

  it('Review Focus 4: loading → "—" hero and sub-balances, "Loading balances…", no token row', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    mockPublic.current = {status: 'loading'};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-sub-noc')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-public-empty')).toHaveTextContent('Loading balances…');
    expect(r.queryByText('$150')).toBeNull();
    expect(r.queryByText(/· 24h/)).toBeNull();
  });

  it('Review Focus 4: failed → "Balance unavailable · pull to refresh"', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    mockPublic.current = {status: 'error'};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-empty')).toHaveTextContent('Balance unavailable · pull to refresh');
  });

  it('control: ready → the figures show (the same mocks as the other rows)', async () => {
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('$150.00');
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('1');
  });

  it('plan A6: forceSync still runs with another account selected (the main slot stays fresh for main-only screens)', async () => {
    const {forceSync} = jest.requireMock('../../../modules/backgroundSync/backgroundSyncModule') as {forceSync: jest.Mock};
    mockSelected.current = EXIT_ACCOUNT;
    await renderDashboard();
    expect(forceSync).toHaveBeenCalled();
    expect(mockRefetchPublic).toHaveBeenCalled(); // and the selected account's own data is refreshed with it
  });

  it('the account list is re-read on focus (an exit that landed appears)', async () => {
    await renderDashboard();
    expect(mockRefreshAccounts).toHaveBeenCalled();
  });
});
```

`toHaveTextContent` comes from `@testing-library/react-native` 13's built-in matchers (no extra setup). If the suite reports it unknown, use `expect(getByTestId(x).props.children)…` on the inner `Text` instead — do not add a dependency.

In `src/screens/dashboard/__tests__/DashboardChainIdentity.test.tsx`, add after its `jest.mock('../../../modules/solana/connection', …)` line:

```tsx
// M1d: the dashboard reads the selected account (main here) and its public data — the walletStore mock's values
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => ({scheme: 'slip10:0', address: 'AbCdEfAbCdEf', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false}),
  useAccountList: () => null,
  useAccounts: () => null,
  useSelectAccount: () => () => true,
  useRefreshAccounts: () => () => undefined,
}));
jest.mock('../../../hooks/useAccountPublicData', () => {
  const store = jest.requireMock('../../../store/zustand/walletStore') as {useWalletStore: () => Record<string, unknown>};
  return {
    NO_PUBLIC_DATA: {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []},
    useAccountPublicData: () => ({data: {status: 'ready', syncedAt: 1, ...store.useWalletStore()}, refetch: () => undefined}),
  };
});
```

In `src/screens/transparent/__tests__/TokenDetailScreen.test.tsx`, add after its walletStore mock:

```tsx
// M1d (plan A6): the holding follows the selected account
const mockTdSelected: {current: {address: string; isMain: boolean; label: string} | null} = {current: {address: 'MAIN', isMain: true, label: 'Account 1'}};
const mockTdPublic: {current: Record<string, unknown>} = {current: {status: 'ready', syncedAt: 1, solBalance: '2000000000', nocBalance: '0', tokenBalances: {}, tokens: []}};
jest.mock('../../../hooks/useSelectedAccount', () => ({useSelectedAccount: () => mockTdSelected.current}));
jest.mock('../../../hooks/useAccountPublicData', () => ({
  NO_PUBLIC_DATA: {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []},
  useAccountPublicData: () => ({data: mockTdPublic.current, refetch: () => undefined}),
}));
```

and append:

```tsx
describe('M1d — the holding is the selected account\'s (plan A6)', () => {
  const screen = () =>
    render(withSafeArea(<TokenDetailScreen mint="native" onBack={() => {}} onSend={jest.fn()} onReceive={() => {}} onSwap={jest.fn()} />));
  afterEach(() => {
    mockTdSelected.current = {address: 'MAIN', isMain: true, label: 'Account 1'};
    mockTdPublic.current = {status: 'ready', syncedAt: 1, solBalance: '2000000000', nocBalance: '0', tokenBalances: {}, tokens: []};
  });
  it('another account selected → its SOL, not the main account\'s', () => {
    mockTdSelected.current = {address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', isMain: false, label: 'Account 4'};
    mockTdPublic.current = {status: 'ready', syncedAt: 1, solBalance: '3000000', nocBalance: '0', tokenBalances: {}, tokens: []};
    expect(screen().getByText('0.003 SOL')).toBeTruthy();
  });
  it('Review Focus 4: not loaded → "— SOL", never 0', () => {
    mockTdPublic.current = {status: 'loading'};
    const r = screen();
    expect(r.getByText('— SOL')).toBeTruthy();
    expect(r.queryByText('0 SOL')).toBeNull();
  });
});
```

In `src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx`, add after its walletStore mock:

```tsx
// M1d (spec §4.2): the history is the SELECTED account's
const mockHistSelected: {current: {address: string; label: string} | null} = {current: {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'}};
jest.mock('../../../hooks/useSelectedAccount', () => ({useSelectedAccount: () => mockHistSelected.current}));
```

and append inside its `describe`:

```tsx
  it('M1d: asks the history of the selected account and names it', () => {
    const {useTransactionHistory} = jest.requireMock('../../../hooks/useSolanaQueries') as {useTransactionHistory: jest.Mock};
    mockHistSelected.current = {address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4'};
    const {getByTestId} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(useTransactionHistory).toHaveBeenLastCalledWith('3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k');
    expect(getByTestId('history-account-label')).toHaveTextContent('Account 4');
    mockHistSelected.current = {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'};
  });
```

In `src/screens/transparent/__tests__/ReceiveScreen.test.tsx`, append inside the top-level `describe('ReceiveScreen', …)`:

```tsx
  it('M1d: the account\'s name is shown with its address (spec §4.2); none without one', () => {
    expect(renderScreen({address: MOCK_ADDRESS, accountLabel: 'Account 4'}).getByTestId('receive-account-label')).toHaveTextContent('Account 4');
    expect(renderScreen({address: MOCK_ADDRESS}).queryByTestId('receive-account-label')).toBeNull();
  });
```

In `src/app/__tests__/shieldedRoutes.test.tsx`, add after the `ReceiveScreen` mock block:

```tsx
// M1d: the route reads the selected account (null = not known yet → the stored main key, as before)
const mockRouteSelected: {current: {address: string; label: string} | null} = {current: null};
jest.mock('../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockRouteSelected.current,
  useAccountList: () => null,
  useAccounts: () => null,
  useSelectAccount: () => () => true,
  useRefreshAccounts: () => () => undefined,
}));
```

change the recorder's prop type in the existing mock from `{address: string; shielded?: boolean}` to `{address: string; shielded?: boolean; accountLabel?: string}` in both places (`// M1d: the route now passes the account's name`), and append inside `describe('#13 Receive: …')`:

```tsx
  it('M1d (spec §4.2): ReceiveModal shows the SELECTED account\'s address and name', () => {
    mockRouteSelected.current = {address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4'};
    const {ref} = routeNames({shielded: true});
    mockReceiveProps.length = 0;
    act(() => {
      (ref.navigate as (n: string, p?: object) => void)('ReceiveModal');
    });
    expect(mockReceiveProps.length).toBeGreaterThan(0);
    const last = mockReceiveProps[mockReceiveProps.length - 1]!;
    expect(last.address).toBe('3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k');
    expect(last.accountLabel).toBe('Account 4');
    mockRouteSelected.current = null;
  });
```

(`routeNames(f)` is the file's existing helper: it renders the real `RootNavigator` under the flags and returns `{names, ref, r}`.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/modules/accounts/__tests__/accountSnapshot.test.ts src/hooks/__tests__/useAccountPublicData.test.tsx src/screens/dashboard src/screens/transparent/__tests__/TokenDetailScreen.test.tsx src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx src/screens/transparent/__tests__/ReceiveScreen.test.tsx src/app/__tests__/shieldedRoutes.test.tsx`
Expected: FAIL — the two new modules are missing; the dashboard has no `dashboard-public-balance`; TokenDetail shows the main SOL; no `history-account-label`; no `receive-account-label`; the route passes no `accountLabel`.

- [ ] **Step 4: Write the snapshot**

Create `src/modules/accounts/accountSnapshot.ts`:

```ts
/**
 * M1d spec §3.4 (plan A6): the public data of an account that is NOT the main one — its SOL, its
 * token sums per mint and the dashboard's display tokens, read by address. Never written into
 * walletStore: that slot is the main account's (forceSync, unchanged), which every main-only
 * screen reads. Both reads must succeed: a failure rejects (the screens show "—", never a 0).
 * The display-token rule is forceSync's (core + verified mints; metadata best-effort).
 */
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {getBalance, getTokenAccounts} from '../solana/queries';
import {sumTokenBalancesByMint} from '../solana/tokenBalances';
import {NOC_MINT} from '../../constants/programs';
import {TokenManager} from '../tokens/tokenModule';
import {fetchTokenMetadata, loadCachedMetadata, saveCachedMetadata} from '../tokens/tokenMetadata';
import type {TokenMetadata} from '../../store/zustand/walletStore';

const tokenManager = new TokenManager();

export interface AccountSnapshot {
  solBalance: string;
  nocBalance: string;
  tokenBalances: Record<string, string>;
  tokens: TokenMetadata[];
}

export async function fetchAccountSnapshot(address: string): Promise<AccountSnapshot> {
  const connection = getConnection();
  const pk = new PublicKey(address);
  const [lamports, accounts] = await Promise.all([getBalance(connection, pk), getTokenAccounts(connection, pk)]);
  const tokenBalances = sumTokenBalancesByMint(accounts);
  try {
    await tokenManager.fetchVerifiedList();
  } catch {
    // the verified list is unavailable: core tokens only, as forceSync
  }
  const held = accounts.filter(t => t.amount !== '0' && t.mint !== NOC_MINT).map(t => t.mint);
  let meta = loadCachedMetadata();
  try {
    const resolved = await fetchTokenMetadata(held);
    meta = {...meta, ...resolved};
    saveCachedMetadata(meta);
  } catch {
    // metadata unavailable: keep the cached names and logos
  }
  return {
    solBalance: lamports.toString(),
    nocBalance: tokenBalances[NOC_MINT] ?? '0',
    tokenBalances,
    tokens: tokenManager.buildDisplayTokens(accounts, meta),
  };
}
```

- [ ] **Step 5: Write the hook**

Create `src/hooks/useAccountPublicData.ts`:

```ts
/**
 * M1d spec §3.4: the selected account's public balances. The MAIN account's are walletStore's (the
 * slot forceSync writes — no request here); any other account's come from the address-keyed query
 * `['accountSnapshot', address]` (the Accounts sheet shares it). Never a 0 for an unknown value:
 * `loading` / `error` are states, and NO_PUBLIC_DATA is only ever read behind a not-ready gate.
 */
import {useQuery} from '@tanstack/react-query';
import {useWalletStore} from '../store/zustand/walletStore';
import type {TokenMetadata} from '../store/zustand/walletStore';
import {fetchAccountSnapshot} from '../modules/accounts/accountSnapshot';

export interface PublicBalances {
  solBalance: string;
  nocBalance: string;
  tokenBalances: Record<string, string>;
  tokens: TokenMetadata[];
}

export type AccountPublicData =
  | {status: 'loading'}
  | {status: 'error'}
  | ({status: 'ready'; syncedAt: number | null} & PublicBalances);

export const NO_PUBLIC_DATA: PublicBalances = {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []};

export const ACCOUNT_SNAPSHOT_KEY = 'accountSnapshot';

export function useAccountPublicData(account: {address: string; isMain: boolean} | null): {
  data: AccountPublicData;
  refetch: () => void;
} {
  const wallet = useWalletStore();
  const other = account !== null && !account.isMain ? account.address : null;
  const q = useQuery({
    queryKey: [ACCOUNT_SNAPSHOT_KEY, other],
    queryFn: () => fetchAccountSnapshot(other ?? ''),
    enabled: other !== null,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
  });
  const refetch = (): void => {
    if (other !== null) {
      q.refetch().catch(() => undefined);
    }
  };
  if (account === null) {
    return {data: {status: 'loading'}, refetch};
  }
  if (account.isMain) {
    return {
      data: {
        status: 'ready',
        solBalance: wallet.solBalance,
        nocBalance: wallet.nocBalance,
        tokenBalances: wallet.tokenBalances,
        tokens: wallet.tokens,
        syncedAt: wallet.lastSyncedAt ?? null,
      },
      refetch,
    };
  }
  if (q.data) {
    return {data: {status: 'ready', ...q.data, syncedAt: q.dataUpdatedAt}, refetch};
  }
  return {data: q.isError ? {status: 'error'} : {status: 'loading'}, refetch};
}
```

- [ ] **Step 6: The dashboard's Public mode**

In `src/screens/dashboard/DashboardScreen.tsx`:

(a) Imports — keep `useWalletStore` (it still gives the main `publicKey`) and add below the existing imports:

```ts
import {useRefreshAccounts, useSelectedAccount} from '../../hooks/useSelectedAccount';
import {NO_PUBLIC_DATA, useAccountPublicData} from '../../hooks/useAccountPublicData';
import {PUBLIC_LOADING, PUBLIC_UNAVAILABLE, VALUE_UNKNOWN} from '../../copy/accounts';
```

(b) Replace

```ts
  const {publicKey, solBalance, nocBalance, tokens, tokenBalances} =
    useWalletStore();
```

with

```ts
  // M1d (spec §3.4, D1/D2, plan A6): walletStore.publicKey stays the MAIN account and forceSync keeps
  // writing its slot (every main-only screen reads it); Public mode shows the SELECTED account's data.
  const {publicKey} = useWalletStore();
  const selected = useSelectedAccount();
  const refreshAccountList = useRefreshAccounts();
  const {data: publicData, refetch: refetchPublic} = useAccountPublicData(selected);
  const publicReady = publicData.status === 'ready';
  const {solBalance, nocBalance, tokens, tokenBalances} = publicData.status === 'ready' ? publicData : NO_PUBLIC_DATA;
```

(c) Directly above `const runSync = useCallback(async (opts: {showErrors: boolean}) => {` add:

```ts
  // M1d: the selected account's own data refreshes on every sync trigger too (a no-op for main)
  const refetchPublicRef = useRef(refetchPublic);
  refetchPublicRef.current = refetchPublic;
```

and inside `runSync`, as the first line of its `try {` block (before `const result = await forceSync();`):

```ts
      refetchPublicRef.current();
```

(d) Directly after the `handleRefresh` `useCallback` block add:

```ts
  // M1d: re-read the account list on focus — an exit that landed since appears, a wiped selection falls back
  useFocusEffect(
    useCallback(() => {
      refreshAccountList();
    }, [refreshAccountList]),
  );
```

(e) Replace `const change24h = portfolio.change24hPct; // number | null (transparent only)` with

```ts
  const change24h = publicReady ? portfolio.change24hPct : null; // number | null (transparent only); M1d: none before the data is known
```

(f) Replace `data={isShielded ? ([] as typeof displayTokens) : displayTokens}` with `data={isShielded || !publicReady ? ([] as typeof displayTokens) : displayTokens}`.

(g) In `ListEmptyComponent`, replace the public branch

```tsx
            <View className="px-5 py-8">
              <Text variant="body-sm" className="text-fg-tertiary text-center">
                No tokens yet · pull to refresh
              </Text>
            </View>
```

with

```tsx
            <View className="px-5 py-8">
              <Text variant="body-sm" className="text-fg-tertiary text-center" testID="dashboard-public-empty">
                {publicData.status === 'loading'
                  ? PUBLIC_LOADING
                  : publicData.status === 'error'
                    ? PUBLIC_UNAVAILABLE
                    : 'No tokens yet · pull to refresh'}
              </Text>
            </View>
```

(h) Pass `publicReady={publicReady}` to `<DashboardHeader …>` (after `havePrices={havePrices}`); in `interface DashboardHeaderProps` add after `havePrices: boolean;`:

```ts
  /** M1d (Review Focus 4): the selected account's public data is known — every public figure waits for it */
  publicReady: boolean;
```

and add `publicReady,` to `DashboardHeader`'s destructuring after `havePrices,`.

(i) In `DashboardHeader`, replace

```tsx
            <View className="flex-row items-baseline mb-2">
              {havePrices ? (
```

with

```tsx
            <View className="flex-row items-baseline mb-2" testID="dashboard-public-balance">
              {havePrices && publicReady ? (
```

(j) Replace the two `SubBalanceCell` amounts:

```tsx
                amount={hidden ? '••••' : formatBalanceForDisplay(solBalance, SOL_DECIMALS)}
                ticker="SOL"
```

with

```tsx
                amount={hidden ? '••••' : publicReady ? formatBalanceForDisplay(solBalance, SOL_DECIMALS) : VALUE_UNKNOWN}
                ticker="SOL"
                testID="dashboard-sub-sol"
```

and

```tsx
                amount={hidden ? '••••' : formatBalanceForDisplay(nocBalance, NOC_DECIMALS)}
                ticker="NOC"
```

with

```tsx
                amount={hidden ? '••••' : publicReady ? formatBalanceForDisplay(nocBalance, NOC_DECIMALS) : VALUE_UNKNOWN}
                ticker="NOC"
                testID="dashboard-sub-noc"
```

(k) `SubBalanceCell` takes the test id: add `testID,` to its destructuring, `testID?: string;` to its prop type, and `testID={testID}` on its FIRST `<Text …>` (the amount).

- [ ] **Step 7: TokenDetail, history, Receive**

In `src/screens/transparent/TokenDetailScreen.tsx`: delete the line `import {useWalletStore} from '../../store/zustand/walletStore';`; add

```ts
import {useSelectedAccount} from '../../hooks/useSelectedAccount';
import {NO_PUBLIC_DATA, useAccountPublicData} from '../../hooks/useAccountPublicData';
import {VALUE_UNKNOWN} from '../../copy/accounts';
```

replace `const {solBalance, nocBalance, tokenBalances, tokens} = useWalletStore();` with

```ts
  // M1d (plan A6): opened from the dashboard's list of the SELECTED account — its holding is that account's
  const {data: publicData} = useAccountPublicData(useSelectedAccount());
  const publicReady = publicData.status === 'ready';
  const {solBalance, nocBalance, tokenBalances, tokens} = publicData.status === 'ready' ? publicData : NO_PUBLIC_DATA;
```

replace `{`${formatBalanceForDisplay(balanceRaw, meta.decimals)} ${meta.symbol}`}` with `{`${publicReady ? formatBalanceForDisplay(balanceRaw, meta.decimals) : VALUE_UNKNOWN} ${meta.symbol}`}`, and in the line below it replace `{fiat != null ? formatUsdString(fiat) : '—'}` with `{fiat != null && publicReady ? formatUsdString(fiat) : '—'}`.

In `src/screens/transparent/TransactionHistoryScreen.tsx`: add `import {useSelectedAccount} from '../../hooks/useSelectedAccount';`; replace `const publicKey = useWalletStore(s => s.publicKey);` with

```ts
  // M1d (spec §4.2, D1): the SELECTED account's history
  const selected = useSelectedAccount();
  const publicKey = selected?.address ?? null;
```

replace `<Text style={styles.title}>Transaction History</Text>` with

```tsx
        <View>
          <Text style={styles.title}>Transaction History</Text>
          {selected ? (
            <Text style={styles.accountLabel} testID="history-account-label">
              {selected.label}
            </Text>
          ) : null}
        </View>
```

and add to `styles` after `title: …,`: `accountLabel: {color: '#A8ACB5', fontSize: 13, marginTop: 2},`.

In `src/screens/transparent/ReceiveScreen.tsx`: add to `ReceiveScreenProps` after `address: string;`:

```ts
  /** M1d (spec §4.2): the account this address belongs to ("Account 4") — shown with it */
  accountLabel?: string;
```

change the signature to `export function ReceiveScreen({address, accountLabel, shielded = false, onBack}: ReceiveScreenProps) {`, and directly after the mode strip `</Text>` (the overline ending `'Public · address'}`) add:

```tsx
        {accountLabel && !shielded ? (
          <Text variant="body-sm" className="text-fg-secondary -mt-2 mb-3" testID="receive-account-label">
            {accountLabel}
          </Text>
        ) : null}
```

In `src/app/Navigator.tsx`: add `import {useSelectedAccount} from '../hooks/useSelectedAccount';` and replace the body of `ReceiveScreenNav` with:

```tsx
function ReceiveScreenNav() {
  const publicKey = useWalletStore().publicKey;
  const selected = useSelectedAccount();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {mmkvPublic} = require('../store/mmkv/instances');
  const {MMKV_KEYS} = require('../constants/mmkvKeys');
  // M1d (spec §4.2, D1): the SELECTED account's address and its name. Before any account is known
  // (a cold launch into a Receive deep link) the main key, from walletStore or mmkvPublic, as before.
  const address = selected?.address ?? publicKey ?? mmkvPublic.getString(MMKV_KEYS.WALLET_PUBLIC_KEY) ?? '';
  return <ReceiveScreen address={address} accountLabel={selected?.label} onBack={() => navigation.goBack()} />;
}
```

(keep the comment block above the function as it is).

- [ ] **Step 8: Run the tests to verify they pass**

Run the Step 3 command. Expected: PASS, every existing row of the touched suites included.

- [ ] **Step 9: Mutations (each must go red, then revert)**

1. In `useAccountPublicData`, return `{status: 'ready', ...NO_PUBLIC_DATA, syncedAt: null}` instead of the error state → `useAccountPublicData.test.tsx` "Review Focus 4" FAILS. Revert.
2. In the dashboard, change `havePrices && publicReady ? (` back to `havePrices ? (` → the dashboard "Review Focus 4: loading" row FAILS. Revert.
3. In `ReceiveScreenNav`, change `selected?.address ?? publicKey` to `publicKey ?? selected?.address` → the route row FAILS. Revert.

- [ ] **Step 10: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: all green; tsc 0; `✖ 144 problems (0 errors, 144 warnings)`; TGE check 0.

- [ ] **Step 11: Commit**

```bash
git add src/modules/accounts/accountSnapshot.ts src/modules/accounts/__tests__/accountSnapshot.test.ts \
  src/hooks/useAccountPublicData.ts src/hooks/__tests__/useAccountPublicData.test.tsx \
  src/screens/dashboard src/screens/transparent/TokenDetailScreen.tsx src/screens/transparent/TransactionHistoryScreen.tsx \
  src/screens/transparent/ReceiveScreen.tsx src/screens/transparent/__tests__ src/app/Navigator.tsx src/app/__tests__/shieldedRoutes.test.tsx
git commit -m "feat(m1d): the dashboard's public balance, TokenDetail, Receive and history follow the selected account

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Signing from the selected account — the source carried #12 → #19 → #20 → #21, the signer-address check

**Files:**
- Modify: `src/types/transfer.ts` (`SendSource`, `SourceBalances`, two fields on `TransferIntent`)
- Modify: `src/modules/solana/sendTransaction.ts` (`expectedSigner`, `SendSignerMismatchError`)
- Modify: `src/screens/transparent/SendScreen.tsx` (the captured source, its balances, the intent)
- Modify: `src/screens/transparent/TxSimulateScreen.tsx` (sender = the source, "After" from its balances, the From caption)
- Modify: `src/screens/transparent/TxConfirmScreen.tsx` (the From row, the high-value gate on the source's balances)
- Modify: `src/screens/transparent/TransactionStatusScreen.tsx` (the scheme and the expected signer from the intent)
- Test: create `src/modules/solana/__tests__/sendSigner.test.ts`; modify `src/modules/solana/__tests__/{submitTransaction,transferRisk}.test.ts`, `src/screens/transparent/__tests__/{SendScreen,TxSimulateScreen,TxConfirmScreen,TransactionStatusScreen}.test.tsx`

**Interfaces:**
- Consumes (Task 1): `useSelectedAccount(): WalletAccount | null`, `useAccountList(): AccountList | null` (`src/hooks/useSelectedAccount.ts`); `shortAccountAddress(address: string): string` (`src/modules/accounts/accountList.ts`); `fromLine(label, short, isMain)`, `accountWithAddress(label, short, isMain)`, `VALUE_UNKNOWN` (`src/copy/accounts.ts`).
- Consumes (Task 2): `useAccountPublicData(account: {address: string; isMain: boolean} | null): {data: AccountPublicData; refetch: () => void}`, `NO_PUBLIC_DATA: PublicBalances` (`src/hooks/useAccountPublicData.ts`); `AccountPublicData` is `{status: 'loading'} | {status: 'error'} | ({status: 'ready'; syncedAt: number | null} & {solBalance: string; nocBalance: string; tokenBalances: Record<string, string>; tokens: TokenMetadata[]})`.
- Consumes (existing): `parseA0Scheme(s: unknown): TransparentScheme | null` (`src/modules/shielded/a0/accountRegistry.ts`, read-only use).
- Produces (`src/types/transfer.ts`): `interface SendSource {scheme: string; address: string; label: string; isMain: boolean}`, `interface SourceBalances {solBalance: string; tokenBalances: Record<string, string>}`, `TransferIntent.from: SendSource`, `TransferIntent.sourceBalances: SourceBalances`.
- Produces (`src/modules/solana/sendTransaction.ts`): `SendTransparentParams` gains `expectedSigner: string` (both variants); `class SendSignerMismatchError extends Error {readonly code: 'E_SEND_SIGNER_MISMATCH'}`; message `E_SEND_SIGNER_MISMATCH: this account's key does not derive <address>; nothing was signed.` An unparsable scheme on #21: `E_SEND_SCHEME: <scheme> is not an account this wallet can sign for; nothing was signed.`
- Produces testIDs: `send-available` (#12's Available figure), `tx-simulate-from` (#19), `tx-confirm-from` (#20's From value).

- [ ] **Step 1: Write the failing tests — the signer check**

Create `src/modules/solana/__tests__/sendSigner.test.ts`:

```ts
/**
 * M1d spec §3.3 (plan A16): a Send signs from the scheme it names, and only when that key derives
 * the account's address. The addresses are the repo's offline vectors
 * (src/modules/shielded/a0/__tests__/fixtures/a0-account-vectors.json, "abandon … about"), not
 * computed by the code under test.
 */
import {PublicKey} from '@solana/web3.js';
import {SendSignerMismatchError, submitTransparentTransfer} from '../sendTransaction';
import {KeychainManager} from '../../keychain/keychainModule';

const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'; // slip10:0
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'; // slip10:1

const mockSendRaw = jest.fn(async () => 'SIG');
const mockBlockhash = jest.fn(async () => ({blockhash: 'bh', lastValidBlockHeight: 1}));
jest.mock('../connection', () => ({
  getConnection: () => ({getLatestBlockhash: mockBlockhash, sendRawTransaction: mockSendRaw}),
}));
const mockZeroized: Uint8Array[] = [];
jest.mock('../../session/zeroize', () => ({
  zeroize: (d: Uint8Array | null | undefined) => {
    if (d) {
      mockZeroized.push(d);
      d.fill(0);
    }
  },
}));

const sol = (account: number, expectedSigner: string) => ({
  kind: 'sol' as const,
  recipient: new PublicKey(MAIN),
  lamports: 1_000n,
  priorityFee: 0,
  scheme: {kind: 'slip10' as const, account},
  expectedSigner,
});

beforeEach(() => {
  mockSendRaw.mockClear();
  mockBlockhash.mockClear();
  mockZeroized.length = 0;
  jest.spyOn(KeychainManager.prototype, 'retrieveSeed').mockResolvedValue(ABANDON);
});
afterEach(() => jest.restoreAllMocks());

it('signs from the named scheme when its key derives the account\'s address (slip10:1 → Hh8Q…)', async () => {
  await expect(submitTransparentTransfer(sol(1, A1))).resolves.toEqual({signature: 'SIG', lastValidBlockHeight: 1});
  expect(mockSendRaw).toHaveBeenCalledTimes(1);
});

it('Review Focus 2: a key that does not derive the address → E_SEND_SIGNER_MISMATCH; nothing built, signed or sent', async () => {
  const run = submitTransparentTransfer(sol(1, MAIN));
  await expect(run).rejects.toBeInstanceOf(SendSignerMismatchError);
  await expect(submitTransparentTransfer(sol(1, MAIN))).rejects.toMatchObject({code: 'E_SEND_SIGNER_MISMATCH'});
  expect(mockBlockhash).not.toHaveBeenCalled();
  expect(mockSendRaw).not.toHaveBeenCalled();
});

it('the seed and the secret key are both zero-filled, on the refusal as on the send', async () => {
  await expect(submitTransparentTransfer(sol(1, MAIN))).rejects.toBeInstanceOf(SendSignerMismatchError);
  expect(mockZeroized.filter(d => d.length === 64)).toHaveLength(2); // the 64-byte seed and the 64-byte secret
  mockZeroized.length = 0;
  await submitTransparentTransfer(sol(1, A1));
  expect(mockZeroized.filter(d => d.length === 64)).toHaveLength(2);
});
```

In `src/modules/solana/__tests__/submitTransaction.test.ts`, in the existing call add after `scheme: {kind: 'cli'},`:

```ts
      expectedSigner: 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o', // M1d: the cli key of "abandon … about" (the vector file) — the signer check needs the account's address
```

In `src/modules/solana/__tests__/transferRisk.test.ts`, add to `base` after `createAta: false,`:

```ts
  from: {scheme: 'slip10:0', address: 'GabcDEF123456789xxxxxxxxxxxxxxxxxxxxxxQMr9', label: 'Account 1', isMain: true}, // M1d: the intent carries its source (unused by isHighValueTransfer)
  sourceBalances: {solBalance: '0', tokenBalances: {}}, // M1d: the source's balances travel too (the rows pass their own)
```

- [ ] **Step 2: Write the failing tests — the four screens**

In `src/screens/transparent/__tests__/SendScreen.test.tsx`, add after the walletStore mock:

```tsx
// M1d (spec §3.3): #12 sends from the account selected when it opened, with that account's balances
const MAIN_SRC = {scheme: 'slip10:0', address: 'So11111111111111111111111111111111111111112', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false};
const A3_SRC = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', number: 4, role: 'fresh-exit', isMain: false, linked: false};
const READY_1_SOL = {status: 'ready', syncedAt: 1, solBalance: '1000000000', nocBalance: '0', tokens: [], tokenBalances: {}};
const mockSendSelected: {current: unknown} = {current: MAIN_SRC};
const mockSendList: {current: unknown} = {current: null};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockSendSelected.current,
  useAccountList: () => mockSendList.current,
}));
const mockSendPublic: {current: unknown} = {current: READY_1_SOL};
jest.mock('../../../hooks/useAccountPublicData', () => ({
  NO_PUBLIC_DATA: {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []},
  useAccountPublicData: () => ({data: mockSendPublic.current, refetch: () => undefined}),
}));
```

(The existing rows keep their assertions: the 1 SOL balance they relied on now comes from `READY_1_SOL`, the same figure as the walletStore mock.) Append:

```tsx
describe('M1d — #12 sends from the account selected when it opened (spec §3.3)', () => {
  const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
  beforeEach(() => {
    mockSendSelected.current = MAIN_SRC;
    mockSendList.current = null;
    mockSendPublic.current = READY_1_SOL;
  });
  const fill = (r: ReturnType<typeof render>) => {
    fireEvent.changeText(r.getByTestId('recipient-input'), FOREIGN);
    fireEvent.changeText(r.getByTestId('amount-input'), '0.001');
  };

  it('the intent carries the source (scheme, address, label, main) and the source\'s balances', () => {
    mockSendSelected.current = A3_SRC;
    mockSendPublic.current = {status: 'ready', syncedAt: 1, solBalance: '3000000', nocBalance: '0', tokens: [], tokenBalances: {}};
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    fill(r);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: FOREIGN,
        from: {scheme: 'slip10:3', address: A3_SRC.address, label: 'Account 4', isMain: false},
        sourceBalances: {solBalance: '3000000', tokenBalances: {}},
      }),
    );
  });

  it('Review Focus 2: a selection change after #12 opened does not move the Send', () => {
    mockSendSelected.current = A3_SRC;
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    mockSendSelected.current = MAIN_SRC;
    r.rerender(<SendScreen onReview={onReview} />);
    fill(r);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview.mock.calls[0]![0].from.scheme).toBe('slip10:3');
  });

  it('Review Focus 4: the source\'s data not loaded → Available "—", the CTA disabled', () => {
    mockSendPublic.current = {status: 'loading'};
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.getByTestId('send-available')).toHaveTextContent('— SOL');
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('no account known (no wallet) → the CTA disabled', () => {
    mockSendSelected.current = null;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });
});
```

In `src/screens/transparent/__tests__/TxSimulateScreen.test.tsx`, add to `intent` after `createAta: false,`:

```ts
  from: {scheme: 'slip10:0', address: 'GabcDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF', label: 'Account 1', isMain: true}, // M1d: the sender is the intent's source (was the walletStore mock's publicKey)
  sourceBalances: {solBalance: '1000000000', tokenBalances: {}}, // M1d: "After" from the source's balances (was the walletStore mock's)
```

and append:

```tsx
it('M1d (spec §3.3, §4.2, plan A8): the SOURCE is the sender, its balance gives "After", #19 says "From: Account 4 · …"', async () => {
  const {buildTransferTx} = require('../../../modules/solana/transactionBuilder') as {buildTransferTx: jest.Mock};
  buildTransferTx.mockClear();
  const from = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', isMain: false};
  const r = render(
    withSafeArea(
      <TxSimulateScreen intent={{...intent, from, sourceBalances: {solBalance: '3000000', tokenBalances: {}}}} onContinue={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  expect(r.getByTestId('tx-simulate-from')).toHaveTextContent('From: Account 4 · 3YqEpf…JXT94k');
  await waitFor(() => expect(buildTransferTx).toHaveBeenCalled());
  expect((buildTransferTx.mock.calls[0]![0] as {sender: {toBase58(): string}}).sender.toBase58()).toBe(from.address);
  // 3,000,000 − 1,000,000 sent − 5,000 base fee − 0 priority = 1,995,000 lamports
  await waitFor(() => expect(r.getByText('0.001995 SOL')).toBeTruthy());
});

it('M1d: the main account reads "From: Account 1 (main) · …"', () => {
  const r = render(withSafeArea(<TxSimulateScreen intent={intent} onContinue={jest.fn()} onCancel={jest.fn()} />));
  expect(r.getByTestId('tx-simulate-from')).toHaveTextContent('From: Account 1 (main) · GabcDE…ABCDEF');
});
```

In `src/screens/transparent/__tests__/TxConfirmScreen.test.tsx`:

- delete the `jest.mock('../../../store/zustand/walletStore', …)` block, the line `import {useWalletStore} from '../../../store/zustand/walletStore';` and the line `const mockUseWalletStore = jest.mocked(useWalletStore);` (add one comment where the mock was: `// M1d (plan A8): #20 reads the source's balances from the intent, no longer walletStore`);
- add to `intent` after `createAta: false,`:

```ts
  from: {scheme: 'slip10:0', address: 'So11111111111111111111111111111111111111112', label: 'Account 1', isMain: true}, // M1d: #20's From row is the intent's source
  sourceBalances: {solBalance: '10000000000', tokenBalances: {}}, // M1d (plan A8): the source's balances (were the walletStore mock's 10 SOL)
```

- in the rows "shows high-value card and disables send when amount > 5% of balance" and "enables send after typing CONFIRM in the typed-confirm input", delete the `mockUseWalletStore.mockReturnValue({…});` call and change `const highValueIntent = {...intent, amount: '0.5'};` to

```ts
  const highValueIntent = {...intent, amount: '0.5', sourceBalances: {solBalance: '1000000000', tokenBalances: {}}}; // M1d (plan A8): 1 SOL on the SOURCE (was set on the walletStore mock)
```

- in "does not show high-value card for a small transfer", delete its `mockUseWalletStore.mockReturnValue({…});` call (`// M1d (plan A8): the intent's 10 SOL source balance is the default`);
- append:

```tsx
it('M1d (plan A7): the From row names the source account — "Account 4 · 3YqEpf…JXT94k"; main "Account 1 (main) · …"', () => {
  const from = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', isMain: false};
  const r = render(withSafeArea(<TxConfirmScreen intent={{...intent, from}} onBroadcast={jest.fn()} onCancel={jest.fn()} />));
  expect(r.getByTestId('tx-confirm-from')).toHaveTextContent('Account 4 · 3YqEpf…JXT94k');
  const m = render(withSafeArea(<TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />));
  expect(m.getByTestId('tx-confirm-from')).toHaveTextContent('Account 1 (main) · So1111…111112');
});

it('M1d (plan A8): the high-value gate reads the SOURCE\'s balance (0.5 SOL of a 0.6 SOL source)', () => {
  const r = render(
    withSafeArea(
      <TxConfirmScreen intent={{...intent, amount: '0.5', sourceBalances: {solBalance: '600000000', tokenBalances: {}}}} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  expect(r.getByTestId('tx-confirm-highvalue')).toBeTruthy();
});
```

In `src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx`, add to `intent` after `createAta: false,`:

```ts
  from: {scheme: 'slip10:0', address: 'So11111111111111111111111111111111111111112', label: 'Account 1', isMain: true}, // M1d: #21 signs from the intent's source (was loadTransparentScheme())
  sourceBalances: {solBalance: '1000000000', tokenBalances: {}}, // M1d: part of the intent (unused by #21)
```

and append:

```tsx
describe('M1d — #21 signs from the intent\'s source (spec §3.3)', () => {
  const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
  const render21 = (i: typeof intent) =>
    render(withSafeArea(<TransactionStatusScreen intent={i} onDashboard={jest.fn()} onViewDetails={jest.fn()} />));

  it('the scheme parsed from the intent and the expected signer = the source address', async () => {
    mockSubmit.mockResolvedValueOnce({signature: 'S', lastValidBlockHeight: 1000});
    render21({...intent, from: {scheme: 'slip10:3', address: A3, label: 'Account 4', isMain: false}});
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({scheme: {kind: 'slip10', account: 3}, expectedSigner: A3}));
  });

  it('Review Focus 2: the signer refusal is shown with its code (nothing was signed)', async () => {
    mockSubmit.mockRejectedValueOnce(new Error(`E_SEND_SIGNER_MISMATCH: this account's key does not derive ${A3}; nothing was signed.`));
    const r = render21({...intent, from: {scheme: 'slip10:3', address: A3, label: 'Account 4', isMain: false}});
    await waitFor(() => expect(r.getByText(/E_SEND_SIGNER_MISMATCH/)).toBeTruthy());
    expect(r.getByText('Transaction failed')).toBeTruthy();
  });

  it('plan A16: a scheme that does not parse strictly → E_SEND_SCHEME, the keychain never asked', async () => {
    const r = render21({...intent, from: {scheme: 'slip10:01', address: A3, label: 'Account 2', isMain: false}});
    await waitFor(() => expect(r.getByText(/E_SEND_SCHEME/)).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/modules/solana src/screens/transparent`
Expected: FAIL — `SendSignerMismatchError` is not exported; `expectedSigner` unknown; #12's intent has no `from`; no `tx-simulate-from` / `tx-confirm-from`; #21 calls with `loadTransparentScheme()`'s scheme and no `expectedSigner`. (`npx tsc --noEmit` also fails on the new intent fields until Step 4.)

- [ ] **Step 4: The intent type**

Replace `src/types/transfer.ts` with:

```ts
/**
 * M1d (spec §3.3): the account a transparent Send signs from — captured when #12 opens and carried
 * #19 → #20 → #21; a later selection change never moves it.
 */
export interface SendSource {
  /** `slip10:n` | `cli` — #21 parses it strictly and derives the signer from it */
  scheme: string;
  /** the account's address — #21 refuses a key that derives anything else (E_SEND_SIGNER_MISMATCH) */
  address: string;
  /** "Account 4" */
  label: string;
  isMain: boolean;
}

/** M1d (plan A8): the source's public balances when #12 handed over (base units) — #19's "After", #20's high-value gate. */
export interface SourceBalances {
  solBalance: string;
  tokenBalances: Record<string, string>;
}

/** A pending transfer carried across the #19→#20 confirm chain. */
export interface TransferIntent {
  mode: 'transparent' | 'shielded';
  recipient: string; // base58
  amount: string; // human string, e.g. "0.001"
  tokenMint: string; // 'native' for SOL, else mint base58
  tokenSymbol: string; // 'SOL' | 'NOC' | …
  decimals: number;
  priorityLevel: 'normal' | 'fast' | 'urgent';
  createAta: boolean;
  from: SendSource;
  sourceBalances: SourceBalances;
}
```

- [ ] **Step 5: The signer check**

In `src/modules/solana/sendTransaction.ts`:

(a) add `import {base58} from '@scure/base';` after the `@solana/web3.js` import;

(b) in BOTH variants of `SendTransparentParams`, after `scheme: TransparentScheme;` add:

```ts
      /** M1d (spec §3.3): the account's address — the key derived from `scheme` must be it, or nothing is signed */
      expectedSigner: string;
```

(c) after the `const keychainManager = new KeychainManager();` line add:

```ts
/** M1d (spec §3.3, plan A16): the derived key is not the account's — refused before any key object, build or signature. */
export class SendSignerMismatchError extends Error {
  readonly code = 'E_SEND_SIGNER_MISMATCH' as const;
  constructor(expected: string) {
    super(`E_SEND_SIGNER_MISMATCH: this account's key does not derive ${expected}; nothing was signed.`);
    this.name = 'SendSignerMismatchError';
  }
}
```

(d) replace

```ts
  const {secretKey} = deriveTransparentKeypair(seed, params.scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
```

with

```ts
  const {publicKey, secretKey} = deriveTransparentKeypair(seed, params.scheme);
  zeroize(seed);
  try {
    // M1d (spec §3.3): the key must derive the account's own address before anything is built or signed
    if (base58.encode(publicKey) !== params.expectedSigner) {
      throw new SendSignerMismatchError(params.expectedSigner);
    }
    const signer = Keypair.fromSecretKey(secretKey);
```

and update the function's doc comment's first sentence to: `Retrieve the seed (biometric / passcode gated), derive the signer with the given scheme, refuse unless it is \`expectedSigner\` (M1d), build the transfer instructions, sign, and broadcast via sendRawTransaction.`

- [ ] **Step 6: #12 — the captured source**

In `src/screens/transparent/SendScreen.tsx`:

(a) delete `import {useWalletStore} from '../../store/zustand/walletStore';` and add:

```ts
import {useSelectedAccount} from '../../hooks/useSelectedAccount';
import {NO_PUBLIC_DATA, useAccountPublicData} from '../../hooks/useAccountPublicData';
import {VALUE_UNKNOWN} from '../../copy/accounts';
```

(b) replace `const {solBalance, nocBalance, tokens: storeTokens, tokenBalances} = useWalletStore();` with:

```ts
  // M1d (spec §3.3, Review Focus 2): the source is the account selected when #12 OPENS — captured
  // once; a later selection change never moves this Send. Its balances are that account's own.
  const liveSelected = useSelectedAccount();
  const [source] = useState(liveSelected);
  const {data: publicData} = useAccountPublicData(source);
  const publicReady = publicData.status === 'ready';
  const {solBalance, nocBalance, tokens: storeTokens, tokenBalances} = publicData.status === 'ready' ? publicData : NO_PUBLIC_DATA;
```

(c) in `canReview`'s `useMemo`, make the first line `if (source === null || !publicReady) return false;` and add `source, publicReady` to its dependency array;

(d) replace `handleReview` with:

```ts
  const handleReview = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canReview || source === null) return;
    onReview({
      mode: 'transparent',
      recipient,
      amount,
      tokenMint: selectedMint,
      tokenSymbol: selectedToken.symbol,
      decimals: selectedToken.decimals,
      priorityLevel,
      createAta: selectedMint !== SOL_MINT,
      from: {scheme: source.scheme, address: source.address, label: source.label, isMain: source.isMain},
      sourceBalances: {solBalance, tokenBalances},
    });
  }, [canReview, source, recipient, amount, selectedMint, selectedToken.symbol, selectedToken.decimals, priorityLevel, onReview, solBalance, tokenBalances]);
```

(e) replace

```tsx
                <Text variant="body-sm" numeral className="font-geist-semibold text-fg-primary">
                  {formatTokenAmount(selectedBalance, selectedToken.decimals)} {selectedToken.symbol}
                </Text>
```

with

```tsx
                <Text variant="body-sm" numeral className="font-geist-semibold text-fg-primary" testID="send-available">
                  {publicReady ? formatTokenAmount(selectedBalance, selectedToken.decimals) : VALUE_UNKNOWN} {selectedToken.symbol}
                </Text>
```

- [ ] **Step 7: #19, #20, #21**

`src/screens/transparent/TxSimulateScreen.tsx`: delete `import {useWalletStore} from '../../store/zustand/walletStore';`, add

```ts
import {fromLine} from '../../copy/accounts';
import {shortAccountAddress} from '../../modules/accounts/accountList';
```

replace `const {publicKey, solBalance} = useWalletStore();` with

```ts
  // M1d (spec §3.3, plan A8): the sender and its balance are the intent's source, captured at #12
  const publicKey = intent.from.address;
  const solBalance = intent.sourceBalances.solBalance;
```

and in the intent card, directly after the closing `</View>` of the `flex-row items-center gap-2 flex-wrap` row (the amount → address row), add:

```tsx
          <Text variant="caption" className="text-fg-tertiary mt-2" testID="tx-simulate-from">
            {fromLine(intent.from.label, shortAccountAddress(intent.from.address), intent.from.isMain)}
          </Text>
```

`src/screens/transparent/TxConfirmScreen.tsx`: delete `import {useWalletStore} from '../../store/zustand/walletStore';`, add

```ts
import {accountWithAddress} from '../../copy/accounts';
import {shortAccountAddress} from '../../modules/accounts/accountList';
```

replace `const {publicKey, solBalance, tokenBalances} = useWalletStore();` with

```ts
  // M1d (plan A8): the high-value gate reads the SOURCE's balances, carried from #12
  const {solBalance, tokenBalances} = intent.sourceBalances;
```

replace `<DetailRow label="From" value={formatAddress(publicKey ?? '')} />` with

```tsx
          <DetailRow
            label="From"
            value={accountWithAddress(intent.from.label, shortAccountAddress(intent.from.address), intent.from.isMain)}
            testID="tx-confirm-from"
          />
```

and change `DetailRow` to take the test id:

```tsx
function DetailRow({label, value, testID}: {label: string; value: string; testID?: string}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body-sm" className="text-fg-secondary">
        {label}
      </Text>
      <Text variant="body-sm" className="text-fg-primary font-geist-medium" testID={testID}>
        {value}
      </Text>
    </View>
  );
}
```

`src/screens/transparent/TransactionStatusScreen.tsx`:

(a) add `import {parseA0Scheme} from '../../modules/shielded/a0/accountRegistry';`;

(b) delete the lazy `loadTransparentScheme` declaration (the three lines `let loadTransparentScheme: … = null;`) and its `require` line plus the eslint comment above it inside the `try {` block;

(c) in `run`, change the guard to

```ts
      if (
        !submitTransparentTransfer ||
        !getConnection ||
        !findLandedSignature
      ) {
        return;
      }
```

and replace `const scheme = loadTransparentScheme();` with

```ts
      // M1d (spec §3.3, plan A16): the source's scheme, parsed strictly — never the wallet default
      const scheme = parseA0Scheme(intent.from.scheme);
      if (scheme === null) {
        setErrorMessage(`E_SEND_SCHEME: ${intent.from.scheme} is not an account this wallet can sign for; nothing was signed.`);
        setStage('failed');
        return;
      }
```

(d) in `buildParams`, add `expectedSigner: intent.from.address,` after `scheme,` in BOTH branches.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest src/modules/solana src/screens/transparent`
Expected: PASS, every existing row included.

- [ ] **Step 9: Mutations (each must go red, then revert)**

1. In `sendTransaction.ts`, change `!==` in the signer check to `===` → `sendSigner.test.ts` FAILS on both rows. Revert.
2. Move the signer check below `const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();` → "nothing built, signed or sent" FAILS (`mockBlockhash` called). Revert.
3. In `SendScreen`, replace `const [source] = useState(liveSelected);` with `const source = liveSelected;` → "Review Focus 2: a selection change after #12 opened" FAILS. Revert.
4. In `TransactionStatusScreen`, change `expectedSigner: intent.from.address` to `expectedSigner: ''` in the SOL branch → the #21 "expected signer" row FAILS. Revert.

- [ ] **Step 10: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: all green; tsc 0; `✖ 143 problems (0 errors, 143 warnings)` (Task 3 removed one: the unused `eslint-disable` above the deleted `loadTransparentScheme` require in TransactionStatusScreen); TGE check 0.

- [ ] **Step 11: Commit**

```bash
git add src/types/transfer.ts src/modules/solana/sendTransaction.ts src/modules/solana/__tests__ \
  src/screens/transparent/SendScreen.tsx src/screens/transparent/TxSimulateScreen.tsx src/screens/transparent/TxConfirmScreen.tsx \
  src/screens/transparent/TransactionStatusScreen.tsx src/screens/transparent/__tests__
git commit -m "feat(m1d): Send signs from the selected account — the source carried #12 to #21, the signer-address check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The combined line "Public X · Private Y" (UX part C)

**Files:**
- Create: `src/modules/accounts/valueLine.ts`
- Modify: `src/screens/dashboard/DashboardScreen.tsx` (the line under the toggle)
- Test: create `src/modules/accounts/__tests__/valueLine.test.ts`; modify `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`

**Interfaces:**
- Consumes (Task 1): `combinedLine(pub: string, priv: string): string`, `VALUE_UNKNOWN = '—'`, `VALUE_HIDDEN = '•••'` (`src/copy/accounts.ts`).
- Consumes (Task 2): `AccountPublicData` (`src/hooks/useAccountPublicData.ts`: `{status: 'loading'} | {status: 'error'} | ({status: 'ready'; syncedAt: number | null} & {solBalance: string; nocBalance: string; tokenBalances: Record<string, string>; tokens: TokenMetadata[]})`); the dashboard's `publicData` (from Task 2's `useAccountPublicData(selected)`).
- Consumes (existing): `A0ShieldedView` (`src/hooks/useA0Shielded.ts`: `unsupported | idle | running | error | {kind: 'ready'; unspent: bigint; pending: bigint; notes: number}`), `A0_TOKEN {mint, symbol: 'TEST', name, decimals}` (`src/modules/shielded/a0/screenSupport.ts`, read only), `TokenPrice {usd: number; change24h: number | null}`, `formatBalanceForDisplay(raw: string, decimals: number, maxDisplayDecimals = 4)`, `formatUsdString(n: number)`, `NOC_MINT`, `NOC_DECIMALS`.
- Produces (`src/modules/accounts/valueLine.ts`): `interface SideAsset {mint: string; symbol: string; amountRaw: bigint; decimals: number}`, `type SideValue = {kind: 'unknown'} | {kind: 'known'; assets: readonly SideAsset[]; zeroSymbol: string}`, `LISTED_ASSETS = 2`, `publicSide(data: AccountPublicData): SideValue`, `privateSide(view: A0ShieldedView): SideValue`, `formatSide(side: SideValue, prices: Record<string, TokenPrice> | null, sep: string): string`, `combinedValueLine(pub: SideValue, priv: SideValue, prices: Record<string, TokenPrice> | null, hidden: boolean): string`. Task 5's sheet rows call `publicSide` + `formatSide(…, ' · ')`.
- Produces testID `dashboard-combined-line`.

Rules (spec §4.5, D2–D4, plan A9–A12): each side in USD only when `prices` is not null AND every non-zero asset of that side has a price; otherwise its token amounts — the largest whole-token amount first (decimals-normalised BigInt, ties by symbol), at most two, then " +N"; the sides are never summed; an unknown side (not loaded, failed, main never synced, a malformed amount, a private view not `ready`) is "—", never 0; a side with no non-zero asset is "0 SOL" / "0 TEST"; hidden balances → "Public ••• · Private •••"; the private side is the unspent total (pending excluded, as the hero).

- [ ] **Step 1: Write the failing tests — the formatter**

Create `src/modules/accounts/__tests__/valueLine.test.ts`:

```ts
/** M1d spec §4.5 (D2–D4; plan A9–A12): the combined line's formatter. BigInt amounts; USD is display only. */
import {combinedValueLine, formatSide, LISTED_ASSETS, privateSide, publicSide} from '../valueLine';
import type {SideAsset, SideValue} from '../valueLine';
import {NOC_MINT} from '../../../constants/programs';
import {A0_TOKEN} from '../../shielded/a0/screenSupport';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const sol = (raw: bigint): SideAsset => ({mint: 'native', symbol: 'SOL', amountRaw: raw, decimals: 9});
const tst = (raw: bigint): SideAsset => ({mint: A0_TOKEN.mint, symbol: 'TEST', amountRaw: raw, decimals: 9});
const known = (assets: SideAsset[], zeroSymbol = 'SOL'): SideValue => ({kind: 'known', assets, zeroSymbol});
const PRICES = {native: {usd: 150, change24h: null}, [NOC_MINT]: {usd: 0.5, change24h: null}};

describe('formatSide', () => {
  it('unknown → "—", never 0', () => {
    expect(formatSide({kind: 'unknown'}, PRICES, ', ')).toBe('—');
  });

  it('every held asset priced → one USD figure for the side', () => {
    const s = known([sol(1_000_000_000n), {mint: NOC_MINT, symbol: 'NOC', amountRaw: 2_000_000_000n, decimals: 9}]);
    expect(formatSide(s, PRICES, ', ')).toBe('$151.00');
  });

  it('one held asset unpriced → the token amounts, largest first, at most two (the side is never half USD)', () => {
    const s = known([sol(20_000_000n), tst(8_990_000_000n)]);
    expect(formatSide(s, PRICES, ', ')).toBe('8.99 TEST, 0.02 SOL');
    expect(formatSide(s, PRICES, ' · ')).toBe('8.99 TEST · 0.02 SOL'); // a sheet row's separator
  });

  it('no prices at all (the devnet build) → the token amounts', () => {
    expect(formatSide(known([sol(1_000_000_000n)]), null, ', ')).toBe('1 SOL');
  });

  it('more than two held assets → two, then "+N"', () => {
    expect(LISTED_ASSETS).toBe(2);
    const s = known([
      sol(1_000_000_000n),
      tst(3_000_000_000n),
      {mint: USDC, symbol: 'USDC', amountRaw: 2_000_000n, decimals: 6},
      {mint: NOC_MINT, symbol: 'NOC', amountRaw: 500_000_000n, decimals: 9},
    ]);
    expect(formatSide(s, null, ', ')).toBe('3 TEST, 2 USDC +2');
  });

  it('"largest" is decimals-normalised: 5 USDC (6 decimals) before 0.5 SOL (9 decimals); a tie by symbol', () => {
    expect(formatSide(known([sol(500_000_000n), {mint: USDC, symbol: 'USDC', amountRaw: 5_000_000n, decimals: 6}]), null, ', ')).toBe('5 USDC, 0.5 SOL');
    expect(formatSide(known([tst(1_000_000_000n), sol(1_000_000_000n)]), null, ', ')).toBe('1 SOL, 1 TEST');
  });

  it('nothing held → "0 {zeroSymbol}" (a known zero, not an unknown)', () => {
    expect(formatSide(known([sol(0n)]), PRICES, ', ')).toBe('0 SOL');
    expect(formatSide(known([tst(0n)], 'TEST'), null, ', ')).toBe('0 TEST');
  });

  it('a zero, unpriced asset does not stop the USD form', () => {
    expect(formatSide(known([sol(1_000_000_000n), tst(0n)]), PRICES, ', ')).toBe('$150.00');
  });
});

describe('the sides', () => {
  const ready = {status: 'ready' as const, syncedAt: 1, solBalance: '20000000', nocBalance: '0', tokenBalances: {}, tokens: []};

  it('publicSide: loading / error / never synced (plan A12) / a malformed amount → unknown', () => {
    expect(publicSide({status: 'loading'})).toEqual({kind: 'unknown'});
    expect(publicSide({status: 'error'})).toEqual({kind: 'unknown'});
    expect(publicSide({...ready, syncedAt: null})).toEqual({kind: 'unknown'});
    expect(publicSide({...ready, solBalance: '1.5'})).toEqual({kind: 'unknown'});
  });

  it('publicSide: SOL, NOC and the listed tokens (plan A11)', () => {
    const s = publicSide({
      ...ready,
      tokenBalances: {[USDC]: '2000000'},
      tokens: [{mint: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}],
    });
    expect(s).toEqual(
      known([
        sol(20_000_000n),
        {mint: NOC_MINT, symbol: 'NOC', amountRaw: 0n, decimals: 9},
        {mint: USDC, symbol: 'USDC', amountRaw: 2_000_000n, decimals: 6},
      ]),
    );
  });

  it('privateSide: only a ready view is known; the unspent total, pending excluded', () => {
    for (const v of [{kind: 'unsupported'}, {kind: 'idle'}, {kind: 'running'}, {kind: 'error', code: 'E_X', message: 'm'}] as const) {
      expect(privateSide(v)).toEqual({kind: 'unknown'});
    }
    expect(privateSide({kind: 'ready', unspent: 1_003_800_000n, pending: 5n, notes: 1})).toEqual(known([tst(1_003_800_000n)], 'TEST'));
    expect(formatSide(privateSide({kind: 'ready', unspent: 0n, pending: 250_000_000n, notes: 0}), null, ', ')).toBe('0 TEST');
  });
});

describe('combinedValueLine (spec §4.5)', () => {
  it('"Public X · Private Y", the two sides never summed', () => {
    const pub = known([sol(1_000_000_000n)]);
    const priv = privateSide({kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1});
    expect(combinedValueLine(pub, priv, PRICES, false)).toBe('Public $150.00 · Private 1.0038 TEST');
    expect(combinedValueLine(known([sol(20_000_000n), tst(8_990_000_000n)]), priv, null, false)).toBe('Public 8.99 TEST, 0.02 SOL · Private 1.0038 TEST');
  });
  it('an unknown side is "—" on its own side only', () => {
    expect(combinedValueLine({kind: 'unknown'}, known([tst(0n)], 'TEST'), null, false)).toBe('Public — · Private 0 TEST');
    expect(combinedValueLine(known([sol(1_000_000_000n)]), {kind: 'unknown'}, null, false)).toBe('Public 1 SOL · Private —');
  });
  it('hidden balances → "Public ••• · Private •••" whatever is known', () => {
    expect(combinedValueLine(known([sol(1n)]), {kind: 'unknown'}, PRICES, true)).toBe('Public ••• · Private •••');
  });
});
```

- [ ] **Step 2: Write the failing tests — the dashboard**

In `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`, replace the features mock

```tsx
jest.mock('../../../constants/features', () => ({
  isShieldedEnabled: () => true,
}));
```

with

```tsx
// M1d (plan A9): switchable — the combined line exists only in a build with private balances
const mockFeatures = {shielded: true};
jest.mock('../../../constants/features', () => ({
  isShieldedEnabled: () => mockFeatures.shielded,
}));
```

add `mockFeatures.shielded = true; // M1d: the shielded build unless a row says otherwise` to the top-level `beforeEach`, and append:

```tsx
describe('M1d — the combined line under the toggle (spec §4.5, D2–D4)', () => {
  // the mocks: public 1 SOL (priced $150) + 2 NOC (unpriced here) → token form; private 0 TEST
  it('Public mode: "Public 2 NOC, 1 SOL · Private 0 TEST"; the big figure below is unchanged', async () => {
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-combined-line')).toHaveTextContent('Public 2 NOC, 1 SOL · Private 0 TEST');
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('$150.00');
  });

  it('Private mode: the same line (both modes, D3)', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-combined-line')).toHaveTextContent('Public 2 NOC, 1 SOL · Private 1.0038 TEST');
  });

  it('Review Focus 4: the selected account not loaded → "Public — · …"; the private restore not ready → "… · Private —"', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    mockPublic.current = {status: 'loading'};
    expect((await renderDashboard()).getByTestId('dashboard-combined-line')).toHaveTextContent('Public — · Private 0 TEST');
    mockPublic.current = READY_MAIN;
    mockView.current = {kind: 'running'};
    expect((await renderDashboard()).getByTestId('dashboard-combined-line')).toHaveTextContent('Public 2 NOC, 1 SOL · Private —');
  });

  it('hidden balances → "Public ••• · Private •••"', async () => {
    mockHide.current = true;
    expect((await renderDashboard()).getByTestId('dashboard-combined-line')).toHaveTextContent('Public ••• · Private •••');
  });

  it('plan A9: a build without private balances shows no line', async () => {
    mockFeatures.shielded = false;
    expect((await renderDashboard()).queryByTestId('dashboard-combined-line')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/modules/accounts/__tests__/valueLine.test.ts src/screens/dashboard/__tests__/DashboardScreen.test.tsx`
Expected: FAIL — `Cannot find module '../valueLine'`; no `dashboard-combined-line`.

- [ ] **Step 4: Write the formatter**

Create `src/modules/accounts/valueLine.ts`:

```ts
/**
 * M1d spec §4.5 (UX part C; D2–D4; plan A9–A12): "Public X · Private Y". X is the selected
 * account's public value, Y the wallet's private balance (the unspent total, as the dashboard's
 * hero). Each side is USD only when every non-zero asset of THAT side has a price; otherwise its
 * token amounts. The two sides are never summed, and an unknown side is "—", never 0.
 * Amounts stay BigInt; the USD figure is a display float only (as computePortfolio).
 */
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';
import {formatUsdString} from '../../utils/formatUsd';
import {NOC_DECIMALS, NOC_MINT} from '../../constants/programs';
import {A0_TOKEN} from '../shielded/a0/screenSupport';
import {VALUE_HIDDEN, VALUE_UNKNOWN, combinedLine} from '../../copy/accounts';
import type {TokenPrice} from '../prices/priceModule';
import type {AccountPublicData} from '../../hooks/useAccountPublicData';
import type {A0ShieldedView} from '../../hooks/useA0Shielded';

export interface SideAsset {
  /** 'native' for SOL, else the mint */
  mint: string;
  symbol: string;
  amountRaw: bigint;
  decimals: number;
}

export type SideValue = {kind: 'unknown'} | {kind: 'known'; assets: readonly SideAsset[]; zeroSymbol: string};

/** At most this many token amounts per side, then "+N" */
export const LISTED_ASSETS = 2;

const DIGITS = /^\d+$/;
const NORMALISED_DECIMALS = 18;

/** The public side: SOL, NOC and the account's listed tokens (the dashboard's holdings, plan A11). */
export function publicSide(data: AccountPublicData): SideValue {
  if (data.status !== 'ready' || data.syncedAt === null) {
    return {kind: 'unknown'};
  }
  const raw: {mint: string; symbol: string; amount: string; decimals: number}[] = [
    {mint: 'native', symbol: 'SOL', amount: data.solBalance, decimals: 9},
    {mint: NOC_MINT, symbol: 'NOC', amount: data.tokenBalances[NOC_MINT] ?? data.nocBalance, decimals: NOC_DECIMALS},
    ...data.tokens
      .filter(t => t.mint !== NOC_MINT && t.mint !== 'native')
      .map(t => ({mint: t.mint, symbol: t.symbol, amount: data.tokenBalances[t.mint] ?? '0', decimals: t.decimals})),
  ];
  const assets: SideAsset[] = [];
  for (const r of raw) {
    if (!DIGITS.test(r.amount)) {
      return {kind: 'unknown'}; // a malformed amount is not a value: never shown as one
    }
    assets.push({mint: r.mint, symbol: r.symbol, amountRaw: BigInt(r.amount), decimals: r.decimals});
  }
  return {kind: 'known', assets, zeroSymbol: 'SOL'};
}

/** The private side: the unspent total once the restore is ready; any other state is unknown. */
export function privateSide(view: A0ShieldedView): SideValue {
  if (view.kind !== 'ready') {
    return {kind: 'unknown'};
  }
  return {
    kind: 'known',
    assets: [{mint: A0_TOKEN.mint, symbol: A0_TOKEN.symbol, amountRaw: view.unspent, decimals: A0_TOKEN.decimals}],
    zeroSymbol: A0_TOKEN.symbol,
  };
}

function normalised(a: SideAsset): bigint {
  return a.decimals >= NORMALISED_DECIMALS
    ? a.amountRaw / 10n ** BigInt(a.decimals - NORMALISED_DECIMALS)
    : a.amountRaw * 10n ** BigInt(NORMALISED_DECIMALS - a.decimals);
}

export function formatSide(side: SideValue, prices: Record<string, TokenPrice> | null, sep: string): string {
  if (side.kind === 'unknown') {
    return VALUE_UNKNOWN;
  }
  const held = side.assets.filter(a => a.amountRaw > 0n);
  if (held.length === 0) {
    return `0 ${side.zeroSymbol}`;
  }
  if (prices !== null && held.every(a => prices[a.mint] !== undefined)) {
    let usd = 0;
    for (const a of held) {
      usd += (Number(a.amountRaw) / 10 ** a.decimals) * prices[a.mint]!.usd;
    }
    return formatUsdString(usd);
  }
  const sorted = [...held].sort((x, y) => {
    const d = normalised(y) - normalised(x);
    if (d !== 0n) {
      return d > 0n ? 1 : -1;
    }
    return x.symbol < y.symbol ? -1 : x.symbol > y.symbol ? 1 : 0;
  });
  const shown = sorted
    .slice(0, LISTED_ASSETS)
    .map(a => `${formatBalanceForDisplay(a.amountRaw.toString(), a.decimals)} ${a.symbol}`)
    .join(sep);
  const more = sorted.length - LISTED_ASSETS;
  return more > 0 ? `${shown} +${more}` : shown;
}

export function combinedValueLine(
  pub: SideValue,
  priv: SideValue,
  prices: Record<string, TokenPrice> | null,
  hidden: boolean,
): string {
  if (hidden) {
    return combinedLine(VALUE_HIDDEN, VALUE_HIDDEN);
  }
  return combinedLine(formatSide(pub, prices, ', '), formatSide(priv, prices, ', '));
}
```

- [ ] **Step 5: Place the line on the dashboard**

In `src/screens/dashboard/DashboardScreen.tsx`:

(a) add `import {combinedValueLine, privateSide, publicSide} from '../../modules/accounts/valueLine';`;

(b) directly above `const isShielded = mode === 'shielded';` (in `DashboardScreen`, after the anonymity-set block) add:

```ts
  // M1d (spec §4.5, D2–D4, plan A9): "Public X · Private Y" — the selected account's public value and
  // the wallet's private balance, never summed, "—" for an unknown side; only where private balances exist
  const combined = isShieldedEnabled()
    ? combinedValueLine(publicSide(publicData), privateSide(a0View), havePrices ? prices : null, hideBalances)
    : null;
```

(c) pass `combined={combined}` to `<DashboardHeader …>` (after `publicReady={publicReady}`), add to `DashboardHeaderProps` after `publicReady: boolean;`:

```ts
  /** M1d (spec §4.5): the combined line, or null where the build has no private balances */
  combined: string | null;
```

and `combined,` to `DashboardHeader`'s destructuring after `publicReady,`;

(d) in `DashboardHeader`, directly before the `{/* Balance hero card */}` comment, add:

```tsx
      {/* M1d (spec §4.5, D3): one thin line directly under the toggle, in both modes; the big figure below is unchanged */}
      {combined !== null ? (
        <View className="px-5 -mt-2 mb-3">
          <Text variant="body-sm" numeral className="text-fg-secondary text-center" testID="dashboard-combined-line">
            {combined}
          </Text>
        </View>
      ) : null}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run the Step 3 command, then `npx jest src/screens/dashboard`. Expected: PASS (`DashboardChainIdentity.test.tsx` included: on devnet the line is in token form, so its "no `$` figure" row still holds).

- [ ] **Step 7: Mutations (each must go red, then revert)**

1. In `formatSide`, change `held.every(` to `held.some(` → "one held asset unpriced → the token amounts" FAILS. Revert.
2. In `formatSide`, return `'0'` instead of `VALUE_UNKNOWN` → "unknown → —" and the dashboard "Review Focus 4" row FAIL. Revert.
3. In `privateSide`, use `view.unspent + view.pending` → "pending excluded" FAILS. Revert.
4. In `combinedValueLine`, drop the `hidden` branch → "hidden balances" FAILS. Revert.

- [ ] **Step 8: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: all green; tsc 0; `✖ 143 problems (0 errors, 143 warnings)`; TGE check 0.

- [ ] **Step 9: Commit**

```bash
git add src/modules/accounts/valueLine.ts src/modules/accounts/__tests__/valueLine.test.ts \
  src/screens/dashboard/DashboardScreen.tsx src/screens/dashboard/__tests__/DashboardScreen.test.tsx
git commit -m "feat(m1d): the combined line \"Public X · Private Y\" under the toggle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The Accounts sheet and the numbered avatar (#11)

**Files:**
- Create: `src/hooks/useAccountRowBalances.ts`
- Create: `src/components/accounts/AccountsSheet.tsx`
- Modify: `src/screens/dashboard/DashboardScreen.tsx` (the avatar opens the sheet; `onProfileTap` removed)
- Modify: `src/app/Navigator.tsx` (`DashboardScreenNav` passes no `onProfileTap`)
- Test: create `src/hooks/__tests__/useAccountRowBalances.test.tsx`, `src/components/accounts/__tests__/AccountsSheet.test.tsx`; modify `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`, `src/app/__tests__/shieldedRoutes.test.tsx`

**Interfaces:**
- Consumes (Task 1): `AccountList {accounts: readonly WalletAccount[]; seed; walletKind: 'slip10' | 'cli'; unreadable: boolean}`, `WalletAccount {scheme; address; label; number; role; isMain; linked}`, `shortAccountAddress(address)` (`src/modules/accounts/accountList.ts`); `useSelectedAccount()`, `useAccountList()`, `useSelectAccount(): (scheme: string) => boolean`, `useRefreshAccounts(): () => void` (`src/hooks/useSelectedAccount.ts`); `ACCOUNTS_TITLE`, `ACCOUNTS_FOOTER`, `ACCOUNTS_UNREADABLE`, `ROW_NOT_CHECKED`, `ROW_UNAVAILABLE`, `TAG_MAIN`, `TAG_EXIT`, `TAG_LINKED`, `avatarA11y(label)` (`src/copy/accounts.ts`).
- Consumes (Task 2): `fetchAccountSnapshot(address): Promise<AccountSnapshot>`, `AccountSnapshot {solBalance; nocBalance; tokenBalances; tokens}` (`src/modules/accounts/accountSnapshot.ts`); `ACCOUNT_SNAPSHOT_KEY = 'accountSnapshot'` (`src/hooks/useAccountPublicData.ts` — the sheet shares the dashboard's query key).
- Consumes (Task 4): `publicSide(data: AccountPublicData): SideValue`, `formatSide(side, prices | null, sep: string): string` (`src/modules/accounts/valueLine.ts`).
- Consumes (existing): `useResolvedPrices(): {prices: Record<string, TokenPrice>; havePrices: boolean}`.
- Produces (`src/hooks/useAccountRowBalances.ts`): `ROW_WINDOW = 10`, `type RowBalance = {state: 'not-checked'} | {state: 'failed'} | {state: 'ready'; data: AccountSnapshot; at: number}`, `useAccountRowBalances(addresses: readonly string[], active: boolean): Record<string, RowBalance>`.
- Produces (`src/components/accounts/AccountsSheet.tsx`): `interface AccountsSheetProps {visible: boolean; list: AccountList; selectedScheme: string; onSelect: (scheme: string) => void; onClose: () => void}`, `AccountsSheet(props)`, `tagsOf(a: WalletAccount): string[]`, `rowBalanceText(row: RowBalance | undefined, prices: Record<string, TokenPrice> | null): string`. TestIDs: `accounts-sheet`, `accounts-radiogroup`, `accounts-unreadable`, `accounts-footer`, `accounts-row-<scheme>`, `accounts-row-<scheme>-address`, `accounts-row-<scheme>-balance`, `accounts-row-<scheme>-check`, `accounts-row-<scheme>-tag-<tag>`.
- Produces (#11): testID `dashboard-avatar` (text = the selected account's number; label `avatarA11y(label)`); `DashboardScreenProps` loses `onProfileTap`.

Spec §4.1 in full: the avatar shows the selected account's number and opens the sheet (never Profile — Profile stays on its tab); title "Accounts"; each row: label, tag(s), short address, balances (USD where every held asset is priced, else the token amounts), a check on the selected row; rows are radios in a radiogroup with `checked`; tap selects, closes, refreshes; the footer for slip10 wallets only; no Add / rename / remove; a cli wallet lists one row and no footer; the same in Private mode, where the private balance does not change with the selection. Balances (§3.4, plan A1): read when the sheet opens, at most 10 in flight, a row waiting reads "not checked yet", a failed row "Balance unavailable".

- [ ] **Step 1: Write the failing tests — the row balances**

Create `src/hooks/__tests__/useAccountRowBalances.test.tsx`:

```tsx
/** M1d spec §3.4 (plan A1): the sheet's balances — read when it opens, at most 10 in flight, every row eventually. */
import React from 'react';
import {act, renderHook, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const mockFetch = jest.fn();
jest.mock('../../modules/accounts/accountSnapshot', () => ({fetchAccountSnapshot: (a: string) => mockFetch(a)}));

import {ROW_WINDOW, useAccountRowBalances} from '../useAccountRowBalances';

const SNAP = {solBalance: '20000000', nocBalance: '0', tokenBalances: {}, tokens: []};
const pending: Record<string, {resolve: (v: unknown) => void; reject: (e: unknown) => void}> = {};
let qc: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  for (const k of Object.keys(pending)) delete pending[k];
  mockFetch.mockReset().mockImplementation(
    (a: string) =>
      new Promise((resolve, reject) => {
        pending[a] = {resolve, reject};
      }),
  );
});

it('a closed sheet asks nothing', () => {
  renderHook(() => useAccountRowBalances(['acc0'], false), {wrapper});
  expect(mockFetch).not.toHaveBeenCalled();
});

it('at most 10 in flight; each settled row lets the next start; waiting rows read not-checked; a failure is "failed"', async () => {
  expect(ROW_WINDOW).toBe(10);
  const addrs = Array.from({length: 12}, (_, i) => `acc${i}`);
  const {result} = renderHook(() => useAccountRowBalances(addrs, true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
  expect(result.current.acc0).toEqual({state: 'not-checked'}); // in flight
  expect(result.current.acc10).toEqual({state: 'not-checked'}); // waiting
  await act(async () => {
    pending.acc0!.resolve(SNAP);
  });
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(11));
  expect(result.current.acc0).toMatchObject({state: 'ready', data: SNAP});
  await act(async () => {
    pending.acc1!.reject(new Error('429'));
  });
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(12));
  expect(result.current.acc1).toEqual({state: 'failed'});
  expect(mockFetch.mock.calls.map(c => c[0])).toEqual(addrs); // every row, in order, once
});
```

- [ ] **Step 2: Write the failing tests — the sheet**

Create `src/components/accounts/__tests__/AccountsSheet.test.tsx`:

```tsx
/** M1d spec §4.1: the Accounts sheet. The row balances and the prices are controlled here. */
import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import type {AccountList, WalletAccount} from '../../../modules/accounts/accountList';
import type {RowBalance} from '../../../hooks/useAccountRowBalances';

const mockRows: {current: Record<string, RowBalance>} = {current: {}};
const mockRowArgs: Array<{addresses: readonly string[]; active: boolean}> = [];
jest.mock('../../../hooks/useAccountRowBalances', () => ({
  ROW_WINDOW: 10,
  useAccountRowBalances: (addresses: readonly string[], active: boolean) => {
    mockRowArgs.push({addresses, active});
    return mockRows.current;
  },
}));
const mockPrices: {current: {prices: Record<string, {usd: number; change24h: null}>; havePrices: boolean}} = {current: {prices: {}, havePrices: false}};
jest.mock('../../../hooks/useResolvedPrices', () => ({useResolvedPrices: () => mockPrices.current}));

import {AccountsSheet} from '../AccountsSheet';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const acc = (scheme: string, address: string, n: number, role: 'main' | 'fresh-exit', linked = false): WalletAccount => ({
  scheme, address, label: `Account ${n}`, number: n, role, isMain: role === 'main', linked,
});
const LIST: AccountList = {
  accounts: [acc('slip10:0', MAIN, 1, 'main'), acc('slip10:2', A2, 3, 'fresh-exit', true), acc('slip10:3', A3, 4, 'fresh-exit')],
  seed: [],
  walletKind: 'slip10',
  unreadable: false,
};
const sheet = (over: Partial<React.ComponentProps<typeof AccountsSheet>> = {}) => {
  const onSelect = jest.fn();
  const r = render(<AccountsSheet visible list={LIST} selectedScheme="slip10:3" onSelect={onSelect} onClose={jest.fn()} {...over} />);
  return {r, onSelect};
};

beforeEach(() => {
  mockRows.current = {};
  mockRowArgs.length = 0;
  mockPrices.current = {prices: {}, havePrices: false};
});

it('title "Accounts"; rows in order with label, tags and the short address', () => {
  const {r} = sheet();
  expect(r.getByText('Accounts')).toBeTruthy();
  expect(r.getAllByRole('radio').map(x => x.props.testID)).toEqual(['accounts-row-slip10:0', 'accounts-row-slip10:2', 'accounts-row-slip10:3']);
  expect(r.getByTestId('accounts-row-slip10:0-tag-main')).toBeTruthy();
  expect(r.getByTestId('accounts-row-slip10:2-tag-exit')).toBeTruthy();
  expect(r.getByTestId('accounts-row-slip10:2-tag-linked')).toBeTruthy();
  expect(r.queryByTestId('accounts-row-slip10:3-tag-linked')).toBeNull();
  expect(r.getByTestId('accounts-row-slip10:3-address')).toHaveTextContent('3YqEpf…JXT94k');
  expect(r.getByText('Account 4')).toBeTruthy();
});

it('the selected row carries the check and checked state; the rows sit in a radiogroup', () => {
  const {r} = sheet();
  expect(r.getByTestId('accounts-row-slip10:3-check')).toBeTruthy();
  expect(r.queryByTestId('accounts-row-slip10:0-check')).toBeNull();
  expect(r.getByTestId('accounts-row-slip10:3').props.accessibilityState).toEqual({checked: true});
  expect(r.getByTestId('accounts-row-slip10:0').props.accessibilityState).toEqual({checked: false});
  // the group is a plain View (not an accessibility element itself, so each radio stays focusable): read its role
  expect(r.getByTestId('accounts-radiogroup').props.accessibilityRole).toBe('radiogroup');
});

it('a tap selects that row', () => {
  const {r, onSelect} = sheet();
  fireEvent.press(r.getByTestId('accounts-row-slip10:0'));
  expect(onSelect).toHaveBeenCalledWith('slip10:0');
});

it('balances: read for every listed address while open; not checked yet / Balance unavailable / the token amounts', () => {
  mockRows.current = {
    [MAIN]: {state: 'ready', at: 1, data: {solBalance: '20000000', nocBalance: '0', tokenBalances: {[USDC]: '8990000'}, tokens: [{mint: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}]}},
    [A2]: {state: 'failed'},
  };
  const {r} = sheet();
  expect(mockRowArgs[mockRowArgs.length - 1]).toEqual({addresses: [MAIN, A2, A3], active: true});
  expect(r.getByTestId('accounts-row-slip10:0-balance')).toHaveTextContent('8.99 USDC · 0.02 SOL');
  expect(r.getByTestId('accounts-row-slip10:2-balance')).toHaveTextContent('Balance unavailable');
  expect(r.getByTestId('accounts-row-slip10:3-balance')).toHaveTextContent('not checked yet');
});

it('USD where every held asset is priced', () => {
  mockPrices.current = {prices: {native: {usd: 150, change24h: null}}, havePrices: true};
  mockRows.current = {[MAIN]: {state: 'ready', at: 1, data: {solBalance: '20000000', nocBalance: '0', tokenBalances: {}, tokens: []}}};
  expect(sheet().r.getByTestId('accounts-row-slip10:0-balance')).toHaveTextContent('$3.00');
});

it('the footer for a slip10 wallet; a cli wallet lists its one account and no footer', () => {
  expect(sheet().r.getByTestId('accounts-footer')).toHaveTextContent('New accounts appear here when you make funds public to “A new account”.');
  const cli: AccountList = {accounts: [acc('cli', MAIN, 1, 'main')], seed: [], walletKind: 'cli', unreadable: false};
  const {r} = sheet({list: cli, selectedScheme: 'cli'});
  expect(r.getAllByRole('radio')).toHaveLength(1);
  expect(r.queryByTestId('accounts-footer')).toBeNull();
});

it('an unreadable registry: the main row and the line, never an empty sheet', () => {
  const l: AccountList = {accounts: [LIST.accounts[0]!], seed: [], walletKind: 'slip10', unreadable: true};
  const {r} = sheet({list: l, selectedScheme: 'slip10:0'});
  expect(r.getByTestId('accounts-unreadable')).toHaveTextContent("Other accounts can't be read right now.");
  expect(r.getAllByRole('radio')).toHaveLength(1);
});

it('D6: no Add, no rename, no remove', () => {
  const {r} = sheet();
  expect(r.queryByText(/add account|rename|remove|delete/i)).toBeNull();
});

it('a closed sheet asks no balance', () => {
  sheet({visible: false});
  expect(mockRowArgs[mockRowArgs.length - 1]!.active).toBe(false);
});
```

- [ ] **Step 3: Write the failing tests — the avatar on #11**

In `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`, add after the `useAccountPublicData` mock block:

```tsx
// M1d (spec §4.1): the Accounts sheet, stubbed — records its props, renders a marker
const mockSheetProps: Array<Record<string, unknown>> = [];
jest.mock('../../../components/accounts/AccountsSheet', () => ({
  AccountsSheet: (p: Record<string, unknown>) => {
    mockSheetProps.push(p);
    const {Text: RNText} = require('react-native');
    return require('react').createElement(RNText, {testID: 'mock-accounts-sheet'}, 'sheet');
  },
}));
```

add `mockSheetProps.length = 0;` to the top-level `beforeEach`, and append:

```tsx
describe('M1d — the numbered avatar opens the Accounts sheet (spec §4.1, D5)', () => {
  it('the avatar shows the selected account\'s number and says what it does', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-avatar')).toHaveTextContent('4');
    expect(r.getByTestId('dashboard-avatar').props.accessibilityLabel).toBe('Account 4, switch account');
    mockSelected.current = MAIN_ACCOUNT;
    expect((await renderDashboard()).getByTestId('dashboard-avatar')).toHaveTextContent('1');
  });

  it('a tap opens the sheet (re-reading the list) with the selection checked — never Profile', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    expect(r.queryByTestId('mock-accounts-sheet')).toBeNull();
    mockRefreshAccounts.mockClear();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(r.getByTestId('mock-accounts-sheet')).toBeTruthy();
    expect(mockRefreshAccounts).toHaveBeenCalled();
    expect(mockSheetProps[mockSheetProps.length - 1]).toMatchObject({visible: true, selectedScheme: 'slip10:3'});
  });

  it('selecting a row selects it, closes the sheet and refreshes the dashboard', async () => {
    const {forceSync} = jest.requireMock('../../../modules/backgroundSync/backgroundSyncModule') as {forceSync: jest.Mock};
    const r = await renderDashboard();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    forceSync.mockClear();
    await act(async () => {
      (mockSheetProps[mockSheetProps.length - 1]!.onSelect as (s: string) => void)('slip10:3');
    });
    expect(mockSelect).toHaveBeenCalledWith('slip10:3');
    expect(r.queryByTestId('mock-accounts-sheet')).toBeNull();
    expect(forceSync).toHaveBeenCalled();
  });

  it('Private mode: the same avatar and sheet; the private balance does not depend on the selection', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 0n, notes: 1};
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-avatar')).toHaveTextContent('4');
    expect(r.getByTestId('dashboard-shielded-balance')).toHaveTextContent('0.2 TEST');
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(r.getByTestId('mock-accounts-sheet')).toBeTruthy();
    expect(r.getByTestId('dashboard-shielded-balance')).toHaveTextContent('0.2 TEST'); // unchanged by the sheet
  });
});
```

In `src/app/__tests__/shieldedRoutes.test.tsx`, append inside the `describe('UX-A 7: …')` that holds the "shielded build: onMakePublic navigates…" row (after that row's closing `});`):

```tsx
  it('M1d (D5): the dashboard is handed no Profile navigation — the avatar opens the Accounts sheet', async () => {
    mockDashboardProps.length = 0;
    const {ref} = routeNames({shielded: true});
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('MainTabs');
    });
    expect(mockDashboardProps.length).toBeGreaterThan(0);
    for (const p of mockDashboardProps) {
      expect('onProfileTap' in (p as Record<string, unknown>)).toBe(false);
    }
  });
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx jest src/hooks/__tests__/useAccountRowBalances.test.tsx src/components/accounts src/screens/dashboard src/app/__tests__/shieldedRoutes.test.tsx`
Expected: FAIL — the two new modules are missing; no `dashboard-avatar`; the Navigator still passes `onProfileTap`.

- [ ] **Step 5: Write the row balances**

Create `src/hooks/useAccountRowBalances.ts`:

```ts
/**
 * M1d spec §3.4 (plan A1): the Accounts sheet's balances — read while the sheet is open, at most
 * ROW_WINDOW (the extension's FRESH_ROWS) in flight: each settled row lets the next one start, so
 * every row is read. A row in flight or waiting is "not checked yet", a failed one "Balance
 * unavailable". The query key is the dashboard's (`['accountSnapshot', address]`), so a row and
 * the dashboard share one read.
 */
import {useEffect, useState} from 'react';
import {useQueries} from '@tanstack/react-query';
import {fetchAccountSnapshot} from '../modules/accounts/accountSnapshot';
import type {AccountSnapshot} from '../modules/accounts/accountSnapshot';
import {ACCOUNT_SNAPSHOT_KEY} from './useAccountPublicData';

export const ROW_WINDOW = 10;

export type RowBalance = {state: 'not-checked'} | {state: 'failed'} | {state: 'ready'; data: AccountSnapshot; at: number};

export function useAccountRowBalances(addresses: readonly string[], active: boolean): Record<string, RowBalance> {
  const [released, setReleased] = useState(ROW_WINDOW);
  const results = useQueries({
    queries: addresses.map((address, i) => ({
      queryKey: [ACCOUNT_SNAPSHOT_KEY, address],
      queryFn: () => fetchAccountSnapshot(address),
      enabled: active && i < released,
      staleTime: 10_000,
      gcTime: 5 * 60_000,
    })),
  });
  const settled = results.slice(0, released).filter(r => r.isSuccess || r.isError).length;
  useEffect(() => {
    const next = Math.min(addresses.length, settled + ROW_WINDOW);
    if (next > released) {
      setReleased(next);
    }
  }, [settled, addresses.length, released]);
  const rows: Record<string, RowBalance> = {};
  addresses.forEach((address, i) => {
    const r = results[i];
    if (r?.data) {
      rows[address] = {state: 'ready', data: r.data, at: r.dataUpdatedAt};
    } else if (r?.isError) {
      rows[address] = {state: 'failed'};
    } else {
      rows[address] = {state: 'not-checked'};
    }
  });
  return rows;
}
```

- [ ] **Step 6: Write the sheet**

Create `src/components/accounts/AccountsSheet.tsx`:

```tsx
/**
 * M1d spec §4.1 — the Accounts sheet (undrawn until M1d; built from the design system, the
 * TokenPickerSheet's bottom-sheet pattern). Lists the main account and every fresh exit with its
 * tags, short address and balances; the selected row has the check. No Add, no rename, no remove
 * (D6). Rows are radios in a radiogroup.
 */
import React from 'react';
import {Modal, Pressable, ScrollView, View} from 'react-native';
import {Check} from 'lucide-react-native';
import {Text} from '../ui';
import {cn} from '../../utils/cn';
import {useAccountRowBalances} from '../../hooks/useAccountRowBalances';
import type {RowBalance} from '../../hooks/useAccountRowBalances';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {shortAccountAddress} from '../../modules/accounts/accountList';
import type {AccountList, WalletAccount} from '../../modules/accounts/accountList';
import {formatSide, publicSide} from '../../modules/accounts/valueLine';
import type {TokenPrice} from '../../modules/prices/priceModule';
import {
  ACCOUNTS_FOOTER,
  ACCOUNTS_TITLE,
  ACCOUNTS_UNREADABLE,
  ROW_NOT_CHECKED,
  ROW_UNAVAILABLE,
  TAG_EXIT,
  TAG_LINKED,
  TAG_MAIN,
} from '../../copy/accounts';

export interface AccountsSheetProps {
  visible: boolean;
  list: AccountList;
  selectedScheme: string;
  onSelect: (scheme: string) => void;
  onClose: () => void;
}

export function tagsOf(a: WalletAccount): string[] {
  const tags = [a.isMain ? TAG_MAIN : TAG_EXIT];
  if (a.linked) {
    tags.push(TAG_LINKED);
  }
  return tags;
}

/** One row's balances: the dashboard's public-side rule, assets joined by " · " (plan A10). */
export function rowBalanceText(row: RowBalance | undefined, prices: Record<string, TokenPrice> | null): string {
  if (!row || row.state === 'not-checked') {
    return ROW_NOT_CHECKED;
  }
  if (row.state === 'failed') {
    return ROW_UNAVAILABLE;
  }
  return formatSide(publicSide({status: 'ready', ...row.data, syncedAt: row.at}), prices, ' · ');
}

export function AccountsSheet({visible, list, selectedScheme, onSelect, onClose}: AccountsSheetProps) {
  const rows = useAccountRowBalances(
    list.accounts.map(a => a.address),
    visible,
  );
  const {prices, havePrices} = useResolvedPrices();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose} accessibilityLabel="Close accounts">
        {/* Inner press stops the backdrop tap from closing when tapping the sheet. */}
        <Pressable onPress={() => {}} className="bg-bg-surface-1 rounded-t-2xl pt-2 pb-8" testID="accounts-sheet">
          <View className="items-center py-2">
            <View className="w-10 h-1 rounded-pill bg-fg-tertiary" />
          </View>
          <Text variant="overline" className="text-fg-secondary px-5 pt-1 pb-2">
            {ACCOUNTS_TITLE}
          </Text>
          {list.unreadable ? (
            <Text variant="body-sm" className="text-warning px-5 pb-2" testID="accounts-unreadable">
              {ACCOUNTS_UNREADABLE}
            </Text>
          ) : null}
          <ScrollView className="max-h-96">
            <View accessibilityRole="radiogroup" testID="accounts-radiogroup">
              {list.accounts.map(a => {
                const checked = a.scheme === selectedScheme;
                const tags = tagsOf(a);
                return (
                  <Pressable
                    key={a.scheme}
                    onPress={() => onSelect(a.scheme)}
                    accessibilityRole="radio"
                    accessibilityState={{checked}}
                    accessibilityLabel={`${a.label}, ${tags.join(', ')}`}
                    testID={`accounts-row-${a.scheme}`}
                    className="flex-row items-center px-5 py-3 min-h-touch-rec active:bg-bg-surface-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text variant="body-lg" className="text-fg-primary">
                          {a.label}
                        </Text>
                        {tags.map(t => (
                          <View
                            key={t}
                            testID={`accounts-row-${a.scheme}-tag-${t}`}
                            className={cn(
                              'px-2 py-0.5 rounded-pill',
                              t === TAG_LINKED ? 'bg-[rgba(242,181,59,0.16)]' : 'bg-bg-surface-3',
                            )}>
                            <Text variant="caption" className={t === TAG_LINKED ? 'text-warning' : 'text-fg-secondary'}>
                              {t}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text variant="caption" mono className="text-fg-tertiary mt-0.5" testID={`accounts-row-${a.scheme}-address`}>
                        {shortAccountAddress(a.address)}
                      </Text>
                      <Text variant="body-sm" numeral className="text-fg-secondary mt-0.5" testID={`accounts-row-${a.scheme}-balance`}>
                        {rowBalanceText(rows[a.address], havePrices ? prices : null)}
                      </Text>
                    </View>
                    {checked ? (
                      <View testID={`accounts-row-${a.scheme}-check`}>
                        <Check size={18} color="#B084FC" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          {list.walletKind === 'slip10' ? (
            <Text variant="caption" className="text-fg-tertiary px-5 pt-3" testID="accounts-footer">
              {ACCOUNTS_FOOTER}
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 7: The avatar on #11, and no Profile navigation**

In `src/screens/dashboard/DashboardScreen.tsx`:

(a) change the Task 2 import to `import {useAccountList, useRefreshAccounts, useSelectAccount, useSelectedAccount} from '../../hooks/useSelectedAccount';`, change the copy import to `import {PUBLIC_LOADING, PUBLIC_UNAVAILABLE, VALUE_UNKNOWN, avatarA11y} from '../../copy/accounts';`, and add `import {AccountsSheet} from '../../components/accounts/AccountsSheet';`;

(b) delete `onProfileTap?: () => void;` from `DashboardScreenProps` and `onProfileTap,` from `DashboardScreen`'s destructuring;

(c) directly after `const handleRefresh = useCallback(…);` (before Task 2's focus effect) add:

```ts
  // M1d (spec §4.1, D5): the avatar opens the Accounts sheet — never Profile (it stays on its tab)
  const accountList = useAccountList();
  const selectAccountScheme = useSelectAccount();
  const [sheetOpen, setSheetOpen] = useState(false);
  const openAccounts = useCallback(() => {
    refreshAccountList();
    setSheetOpen(true);
  }, [refreshAccountList]);
  const handleSelectAccount = useCallback(
    (scheme: string) => {
      selectAccountScheme(scheme);
      setSheetOpen(false);
      runSync({showErrors: false});
    },
    [selectAccountScheme, runSync],
  );
```

(d) replace `const avatarInitial = getAddressInitial(publicKey);` with

```ts
  const avatarText = selected ? String(selected.number) : getAddressInitial(publicKey);
  const avatarLabel = selected ? avatarA11y(selected.label) : 'Accounts';
```

(e) in the `<DashboardHeader …>` props replace `avatarInitial={avatarInitial}` with `avatarText={avatarText}` + `avatarLabel={avatarLabel}` + `onAvatarPress={openAccounts}`, and delete `onProfileTap={onProfileTap}`;

(f) in `DashboardHeaderProps` replace `avatarInitial: string;` with

```ts
  /** M1d: the selected account's number ("4") */
  avatarText: string;
  /** M1d: "Account 4, switch account" */
  avatarLabel: string;
  onAvatarPress: () => void;
```

delete `onProfileTap?: () => void;`, and in `DashboardHeader`'s destructuring replace `avatarInitial,` with `avatarText, avatarLabel, onAvatarPress,` and delete `onProfileTap,`;

(g) replace the avatar `Pressable`'s opening props

```tsx
        <Pressable
          onPress={onProfileTap}
          accessibilityRole="button"
          accessibilityLabel="Profile"
```

with

```tsx
        <Pressable
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel={avatarLabel}
          testID="dashboard-avatar"
```

and its text `{avatarInitial}` with `{avatarText}`;

(h) directly before the closing `</SafeAreaView>` of `DashboardScreen`, add:

```tsx
      {sheetOpen && accountList && selected ? (
        <AccountsSheet
          visible
          list={accountList}
          selectedScheme={selected.scheme}
          onSelect={handleSelectAccount}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
```

In `src/app/Navigator.tsx`, in `DashboardScreenNav`: delete the line `onProfileTap={() => tabNav.getParent()?.navigate('ProfileTab' as never)}` and the now unused `const tabNav = useNavigation();`.

- [ ] **Step 8: Run the tests to verify they pass**

Run the Step 4 command. Expected: PASS.

- [ ] **Step 9: Mutations (each must go red, then revert)**

1. In `useAccountRowBalances`, change `settled + ROW_WINDOW` to `ROW_WINDOW` → the window row FAILS (stops at 10 calls). Revert.
2. In the same hook, replace `i < released` by `true` → the row FAILS (12 at once). Revert.
3. In `AccountsSheet`, drop the `list.walletKind === 'slip10' ?` condition (always show the footer) → the cli row FAILS. Revert.
4. In `handleSelectAccount`, delete `setSheetOpen(false);` → the "closes the sheet" row FAILS. Revert.

- [ ] **Step 10: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: all green; tsc 0; `✖ 143 problems (0 errors, 143 warnings)`; TGE check 0.

- [ ] **Step 11: Commit**

```bash
git add src/hooks/useAccountRowBalances.ts src/hooks/__tests__/useAccountRowBalances.test.tsx src/components/accounts \
  src/screens/dashboard src/app/Navigator.tsx src/app/__tests__/shieldedRoutes.test.tsx
git commit -m "feat(m1d): the Accounts sheet and the numbered avatar on #11

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The linking warning on Send, with the second tap

**Files:**
- Create: `src/modules/accounts/linking.ts`
- Modify: `src/screens/transparent/SendScreen.tsx`
- Test: create `src/modules/accounts/__tests__/linking.test.ts`; modify `src/screens/transparent/__tests__/SendScreen.test.tsx`

**Interfaces:**
- Consumes (Task 1): `SeedAccount {address: string; role: A0AccountRole}`, `AccountList.seed` (`src/modules/accounts/accountList.ts`); `useAccountList(): AccountList | null` (`src/hooks/useSelectedAccount.ts`); `LINK_WARNING_TITLE`, `LINK_WARNING_BODY`, `LINK_TAP_AGAIN` (`src/copy/accounts.ts`).
- Consumes (Task 3): SendScreen's captured `source: WalletAccount | null` (the `useState(liveSelected)` value) and its `handleReview` (debounced 500 ms, `canReview` gate); the SendScreen test file's mocks `mockSendSelected`, `mockSendList`, `mockSendPublic`, `MAIN_SRC`, `A3_SRC`, `READY_1_SOL`.
- Produces (`src/modules/accounts/linking.ts`): `linkingWarningApplies(seed: readonly SeedAccount[], source: string, recipient: string | null): boolean`. Produces testID `send-link-warning`.

Spec §4.4 / M1 spec §10 C2: the condition is "the Send's source and its recipient are both accounts of this seed (registry addresses, plus main), they differ, and at least one is `fresh-exit`" — a `fresh-pending` reservation counts as an exit (plan A2). Recognised locally from the registry; no network request. Shown on #12 as soon as the recipient is recognised, before #19, warning tone, title "Sending between your own accounts links them on chain.", body "Anyone can see that these two accounts belong to the same person." The first tap on the CTA only acknowledges (the CTA then reads "Tap again to send anyway"); the second goes to #19. Changing the recipient or the amount resets the acknowledgement (the token picker and MAX change the amount, so they reset it too). No "fund this account" shortcut anywhere. **Stated limit:** with an unreadable registry the seed set is the main account only, so no pair can be recognised; the sheet says the registry is unreadable (spec §3.1).

- [ ] **Step 1: Write the failing tests — the predicate**

Create `src/modules/accounts/__tests__/linking.test.ts`:

```ts
/** M1d spec §4.4 (M1 spec §10 C2; plan A2): every source/recipient role pair, a foreign address, the same address. */
import {linkingWarningApplies} from '../linking';
import type {SeedAccount} from '../accountList';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const A2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const CLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const SEED: SeedAccount[] = [
  {address: MAIN, role: 'main'},
  {address: A3, role: 'fresh-exit'},
  {address: A2, role: 'fresh-exit'},
  {address: A1, role: 'fresh-pending'},
];

it.each<[string, string, string | null, boolean]>([
  ['main → exit', MAIN, A3, true],
  ['exit → main', A3, MAIN, true],
  ['exit → another exit', A3, A2, true],
  ['Review Focus 3: main → a fresh-pending reservation', MAIN, A1, true],
  ['exit → a fresh-pending reservation', A3, A1, true],
  ['main → a foreign address', MAIN, FOREIGN, false],
  ['exit → a foreign address', A3, FOREIGN, false],
  ['main → itself', MAIN, MAIN, false],
  ['exit → itself', A3, A3, false],
  ['no recipient recognised yet', A3, null, false],
  ['a source outside the seed (never a Send source)', FOREIGN, A3, false],
])('%s → %s', (_name, source, recipient, expected) => {
  expect(linkingWarningApplies(SEED, source, recipient)).toBe(expected);
});

it('no exit in the seed: main → anything is never a warning (a wallet that never made public to a new account)', () => {
  expect(linkingWarningApplies([{address: MAIN, role: 'main'}], MAIN, FOREIGN)).toBe(false);
});

it('a cli wallet has one account (S9): never a warning', () => {
  expect(linkingWarningApplies([{address: CLI, role: 'main'}], CLI, MAIN)).toBe(false);
});

it('stated limit (spec §3.1): an unreadable registry knows only the main account — nothing can be recognised', () => {
  expect(linkingWarningApplies([{address: MAIN, role: 'main'}], MAIN, A3)).toBe(false);
});
```

- [ ] **Step 2: Write the failing tests — #12**

Append to `src/screens/transparent/__tests__/SendScreen.test.tsx`:

```tsx
describe('M1d — the linking warning and its second tap (spec §4.4)', () => {
  const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
  const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
  const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
  const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
  const SEED_LIST = {
    accounts: [],
    seed: [
      {address: MAIN, role: 'main'},
      {address: A3, role: 'fresh-exit'},
      {address: A1, role: 'fresh-pending'},
    ],
    walletKind: 'slip10',
    unreadable: false,
  };
  let now = 1_000_000;
  beforeEach(() => {
    mockSendSelected.current = A3_SRC; // the exit account is the source
    mockSendList.current = SEED_LIST;
    mockSendPublic.current = READY_1_SOL;
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());
  const setup = (recipient: string) => {
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    fireEvent.changeText(r.getByTestId('recipient-input'), recipient);
    fireEvent.changeText(r.getByTestId('amount-input'), '0.001');
    return {r, onReview};
  };
  /** one tap, past the 500 ms debounce */
  const tap = (r: ReturnType<typeof render>) => {
    now += 600;
    fireEvent.press(r.getByTestId('review-button'));
  };

  it('exit → main: the warning before #19; the first tap only acknowledges, the second goes on', () => {
    const {r, onReview} = setup(MAIN);
    const w = r.getByTestId('send-link-warning');
    expect(w).toHaveTextContent('Sending between your own accounts links them on chain.Anyone can see that these two accounts belong to the same person.');
    tap(r);
    expect(onReview).not.toHaveBeenCalled();
    expect(r.getByText('Tap again to send anyway')).toBeTruthy();
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onReview.mock.calls[0]![0]).toMatchObject({recipient: MAIN, from: {address: A3}});
  });

  it('the debounce still holds: a second tap within 500 ms is not the second tap', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    now += 100;
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview).not.toHaveBeenCalled();
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('changing the amount resets the acknowledgement', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    fireEvent.changeText(r.getByTestId('amount-input'), '0.002');
    expect(r.queryByText('Tap again to send anyway')).toBeNull();
    tap(r);
    expect(onReview).not.toHaveBeenCalled(); // acknowledged again, not sent
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('changing the recipient resets the acknowledgement', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    fireEvent.changeText(r.getByTestId('recipient-input'), A1);
    expect(r.queryByText('Tap again to send anyway')).toBeNull();
    tap(r);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('Review Focus 3: main → a fresh-pending reservation warns too', () => {
    mockSendSelected.current = {...MAIN_SRC, address: MAIN};
    const {r} = setup(A1);
    expect(r.getByTestId('send-link-warning')).toBeTruthy();
  });

  it('a foreign recipient: no warning, one tap reviews', () => {
    const {r, onReview} = setup(FOREIGN);
    expect(r.queryByTestId('send-link-warning')).toBeNull();
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('control: no registry known (list null) → no warning', () => {
    mockSendList.current = null;
    const {r} = setup(MAIN);
    expect(r.queryByTestId('send-link-warning')).toBeNull();
  });

  it('no "fund this account" shortcut anywhere on #12', () => {
    const {r} = setup(MAIN);
    expect(r.queryByText(/fund this account|fund account/i)).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/modules/accounts/__tests__/linking.test.ts src/screens/transparent/__tests__/SendScreen.test.tsx`
Expected: FAIL — `Cannot find module '../linking'`; no `send-link-warning`; the first tap already reviews.

- [ ] **Step 4: Write the predicate**

Create `src/modules/accounts/linking.ts`:

```ts
/**
 * M1d spec §4.4 (M1 spec §10 C2): a Send between two accounts of this seed where either is a fresh
 * exit puts both on one transaction — the chain then shows they belong together. Recognised
 * locally from the registry's addresses (plus main); no request. A `fresh-pending` reservation is
 * an exit in flight and counts as one (plan A2).
 */
import type {SeedAccount} from './accountList';

const EXIT_LIKE: ReadonlySet<string> = new Set(['fresh-exit', 'fresh-pending']);

export function linkingWarningApplies(seed: readonly SeedAccount[], source: string, recipient: string | null): boolean {
  if (recipient === null || recipient === source) {
    return false;
  }
  const s = seed.find(a => a.address === source);
  const r = seed.find(a => a.address === recipient);
  if (!s || !r) {
    return false;
  }
  return EXIT_LIKE.has(s.role) || EXIT_LIKE.has(r.role);
}
```

- [ ] **Step 5: The warning and the gate on #12**

In `src/screens/transparent/SendScreen.tsx`:

(a) change `import {useSelectedAccount} from '../../hooks/useSelectedAccount';` to `import {useAccountList, useSelectedAccount} from '../../hooks/useSelectedAccount';`, change `import {VALUE_UNKNOWN} from '../../copy/accounts';` to `import {LINK_TAP_AGAIN, LINK_WARNING_BODY, LINK_WARNING_TITLE, VALUE_UNKNOWN} from '../../copy/accounts';`, and add `import {linkingWarningApplies} from '../../modules/accounts/linking';`;

(b) directly after the `selectedBalance` `useMemo` add:

```ts
  // M1d (spec §4.4, M1 spec §10 C2): both ends accounts of this seed, different, one an exit (or a
  // pending exit, plan A2) → the warning, and the CTA needs a second tap. Local only, no request.
  const accountList = useAccountList();
  const [linkAck, setLinkAck] = useState(false);
  const recipientAddress = useMemo(() => {
    if (!recipient.trim()) return null;
    const v = validateRecipientInput(recipient);
    return v.type === 'solana' || v.type === 'solana_pay' ? (v.address ?? null) : null;
  }, [recipient]);
  const linkWarn =
    source !== null && accountList !== null && linkingWarningApplies(accountList.seed, source.address, recipientAddress);
  const handleAmountChange = useCallback((text: string) => {
    setAmount(text);
    setLinkAck(false);
  }, []);
```

(c) reset the acknowledgement where the recipient or the amount changes: add `setLinkAck(false);` as the first statement of `handleMaxAmount`, `handleRecipientChange`, `handleSelectSuggestion` and `handleClearRecipient`; inside `handleRecipientBlur`'s `if (result.type === 'solana_pay' && result.address) {` block, as its first statement; and in the `TokenPickerSheet`'s `onSelect` after `setAmount('');`;

(d) replace `onChangeText={setAmount}` on the amount `TextInput` with `onChangeText={handleAmountChange}`;

(e) in `handleReview`, directly after `if (!canReview || source === null) return;` add:

```ts
    // M1d (spec §4.4): the first tap only acknowledges the warning; the second one goes on to #19
    if (linkWarn && !linkAck) {
      setLinkAck(true);
      return;
    }
```

and add `linkWarn, linkAck` to its dependency array;

(f) directly before the `{/* Amount */}` comment (right after the recipient section), add:

```tsx
          {linkWarn ? (
            <View
              className="rounded-md p-4 mb-4 bg-[rgba(242,181,59,0.10)] border-l-2 border-l-warning"
              testID="send-link-warning">
              <View className="flex-row items-center gap-2 mb-1">
                <AlertTriangle size={14} color="#F2B53B" strokeWidth={2} />
                <Text variant="body-sm" className="font-geist-semibold text-warning flex-1">
                  {LINK_WARNING_TITLE}
                </Text>
              </View>
              <Text variant="body-sm" className="text-fg-secondary">
                {LINK_WARNING_BODY}
              </Text>
            </View>
          ) : null}
```

(g) in the sticky CTA, replace `accessibilityLabel={`Send ${selectedToken.symbol}`}` with `accessibilityLabel={linkWarn && linkAck ? LINK_TAP_AGAIN : `Send ${selectedToken.symbol}`}` and the label expression

```tsx
              {amount.trim() && canReview
                ? `Send ${amount} ${selectedToken.symbol}`
                : `Send ${selectedToken.symbol}`}
```

with

```tsx
              {linkWarn && linkAck
                ? LINK_TAP_AGAIN
                : amount.trim() && canReview
                  ? `Send ${amount} ${selectedToken.symbol}`
                  : `Send ${selectedToken.symbol}`}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run the Step 3 command. Expected: PASS (every earlier SendScreen row included: with `mockSendList.current = null` they see no warning).

- [ ] **Step 7: Mutations (each must go red, then revert)**

1. In `linking.ts`, change `EXIT_LIKE` to `new Set(['fresh-exit'])` → "Review Focus 3" (both files) FAILS. Revert.
2. Delete `recipient === source ||` → "main → itself" / "exit → itself" FAIL. Revert.
3. In `handleAmountChange`, delete `setLinkAck(false);` → "changing the amount resets" FAILS. Revert.
4. In `handleReview`, move the linking block ABOVE the debounce lines → "the debounce still holds" FAILS. Revert.

- [ ] **Step 8: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: all green; tsc 0; `✖ 143 problems (0 errors, 143 warnings)`; TGE check 0.

- [ ] **Step 9: Commit**

```bash
git add src/modules/accounts/linking.ts src/modules/accounts/__tests__/linking.test.ts \
  src/screens/transparent/SendScreen.tsx src/screens/transparent/__tests__/SendScreen.test.tsx
git commit -m "feat(m1d): the linking warning on Send and its second tap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The main-only lines, #21 "Received by", #17 "Who sees what"

**Files:**
- Create: `src/components/accounts/MainAccountLine.tsx`
- Create: `src/modules/accounts/receivedBy.ts`
- Modify: `src/screens/transparent/SwapScreen.tsx`, `src/screens/PresaleScreen.tsx` (in `PresaleActive`), `src/screens/referral/ReferralScreen.tsx` (one line each)
- Modify: `src/screens/shielded/unshield/UnshieldRunScreen.tsx` (Details: "Received by")
- Modify: `src/screens/shielded/ShieldedExplainerScreen.tsx` (the R11 section)
- Test: create `src/components/accounts/__tests__/MainAccountLine.test.tsx`, `src/modules/accounts/__tests__/receivedBy.test.ts`; modify `src/screens/transparent/__tests__/SwapScreen.test.tsx`, `src/screens/__tests__/PresaleActive.test.tsx`, `src/screens/referral/__tests__/ReferralScreen.test.tsx`, `src/screens/shielded/unshield/__tests__/UnshieldRunScreen.test.tsx`, `src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx`

**Interfaces:**
- Consumes (Task 1): `useSelectedAccount(): WalletAccount | null`, `useAccountList(): AccountList | null` (`src/hooks/useSelectedAccount.ts`); `accountLabel(scheme: TransparentScheme)`, `shortAccountAddress(address)` (`src/modules/accounts/accountList.ts`); `fromMainLine(mainLabel)`, `USES_MAIN_ACCOUNT`, `RECEIVED_BY`, `accountWithAddress(label, short, isMain)`, `WHO_SEES_WHAT`, `WHO_SEES_RELAYER`, `WHO_SEES_RPC`, `WHO_SEES_CHAIN` (`src/copy/accounts.ts`).
- Consumes (existing, read only — no M1c flow file is edited): `loadA0NoteStore(): {notes: A0Note[]; …}` where a pending unshield's note carries `rho: string` and `unshield?: {destination: 'fresh' | 'main' | 'external'; scheme?: string; …}` (`src/modules/shielded/a0/noteStore.ts`); `loadA0AccountRegistry()`, `parseA0Scheme()` (`accountRegistry.ts`); the run screen's `unshieldA0(..., {onStage, holdMs, onPending})` call, whose `onPending(rho)` fires right after the pending intent (with the reserved scheme) is written.
- Produces: `MainAccountLine({variant: 'from' | 'uses'; testID: string})` (renders nothing while the selected account is main); `pendingFreshSchemeOf(rho: string): string | null`, `freshExitAccountOf(scheme: string | null): {label: string; address: string} | null` (`src/modules/accounts/receivedBy.ts`). TestIDs: `swap-main-account`, `presale-main-account`, `referral-main-account`, `explainer-who-sees-what`.

- [ ] **Step 1: Write the failing tests — the line and the screens that stay on main**

Create `src/components/accounts/__tests__/MainAccountLine.test.tsx`:

```tsx
/** M1d spec §4.3 (D1; plan A13): Swap, presale and referral stay on main — said whenever another account is selected. */
import React from 'react';
import {render} from '@testing-library/react-native';

type Acc = {scheme: string; address: string; label: string; isMain: boolean};
const MAIN: Acc = {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true};
const A3: Acc = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', isMain: false};
const mockMla: {selected: Acc | null; main: Acc} = {selected: MAIN, main: MAIN};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockMla.selected,
  useAccountList: () => ({accounts: [mockMla.main], seed: [], walletKind: 'slip10', unreadable: false}),
}));

import {MainAccountLine} from '../MainAccountLine';

beforeEach(() => {
  mockMla.selected = MAIN;
  mockMla.main = MAIN;
});

it('the main account selected → nothing', () => {
  expect(render(<MainAccountLine variant="from" testID="x" />).queryByTestId('x')).toBeNull();
});

it('another account selected → "From: Account 1 (main)" / "Uses your main account"', () => {
  mockMla.selected = A3;
  expect(render(<MainAccountLine variant="from" testID="x" />).getByTestId('x')).toHaveTextContent('From: Account 1 (main)');
  expect(render(<MainAccountLine variant="uses" testID="y" />).getByTestId('y')).toHaveTextContent('Uses your main account');
});

it('plan A13: the main account\'s own label — a slip10:3 main is "Account 4"', () => {
  mockMla.main = {...A3, isMain: true};
  mockMla.selected = {scheme: 'slip10:0', address: MAIN.address, label: 'Account 1', isMain: false};
  expect(render(<MainAccountLine variant="from" testID="x" />).getByTestId('x')).toHaveTextContent('From: Account 4 (main)');
});

it('no wallet → nothing', () => {
  mockMla.selected = null;
  expect(render(<MainAccountLine variant="uses" testID="x" />).queryByTestId('x')).toBeNull();
});
```

In each of `src/screens/transparent/__tests__/SwapScreen.test.tsx`, `src/screens/__tests__/PresaleActive.test.tsx` and `src/screens/referral/__tests__/ReferralScreen.test.tsx`, add next to the walletStore mock the block below. **Path:** it is written for Swap and Referral (`'../../../hooks/useSelectedAccount'`); in `PresaleActive.test.tsx` (one level higher) the `jest.mock` path is `'../../hooks/useSelectedAccount'`.

```tsx
// M1d (spec §4.3): this screen stays on the main account and says so while another account is selected
const mockLineSelected: {current: {scheme: string; address: string; label: string; isMain: boolean}} = {
  current: {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true},
};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockLineSelected.current,
  useAccountList: () => ({
    accounts: [{scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true}],
    seed: [],
    walletKind: 'slip10',
    unreadable: false,
  }),
}));
const LINE_EXIT = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', isMain: false};
const LINE_MAIN = {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true};
```

Then append, in `SwapScreen.test.tsx` (inside `describe('SwapScreen', …)`):

```tsx
  it('M1d: another account selected → "From: Account 1 (main)"; main selected → no line', () => {
    mockLineSelected.current = LINE_EXIT;
    expect(render(withSafeArea(<SwapScreen onBack={() => {}} onDone={() => {}} />)).getByTestId('swap-main-account')).toHaveTextContent('From: Account 1 (main)');
    mockLineSelected.current = LINE_MAIN;
    expect(render(withSafeArea(<SwapScreen onBack={() => {}} onDone={() => {}} />)).queryByTestId('swap-main-account')).toBeNull();
  });
```

in `PresaleActive.test.tsx` (at the end, using the file's `renderActive()` helper; set `mockCheckJurisdiction.mockResolvedValue` exactly as the file's first allowed-region row does before rendering):

```tsx
it('M1d: another account selected → "From: Account 1 (main)" above Buy; main selected → no line', async () => {
  mockCheckJurisdiction.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true}); // the file's allowed-region shape
  mockLineSelected.current = LINE_EXIT;
  const r = renderActive();
  expect(await r.findByTestId('presale-main-account')).toHaveTextContent('From: Account 1 (main)');
  r.unmount();
  mockLineSelected.current = LINE_MAIN;
  expect(renderActive().queryByTestId('presale-main-account')).toBeNull();
});
```

and in `ReferralScreen.test.tsx` (inside `describe('ReferralScreen', …)`, using `renderScreen()`):

```tsx
  it('M1d: another account selected → "Uses your main account"; main selected → no line', () => {
    mockLineSelected.current = LINE_EXIT;
    expect(renderScreen().getByTestId('referral-main-account')).toHaveTextContent('Uses your main account');
    mockLineSelected.current = LINE_MAIN;
    expect(renderScreen().queryByTestId('referral-main-account')).toBeNull();
  });
```

- [ ] **Step 2: Write the failing tests — "Received by" and #17**

Create `src/modules/accounts/__tests__/receivedBy.test.ts`:

```ts
/** M1d spec §4.3 (plan A14): where a fresh exit landed — read from storage only, never a guess. */
const mockNotes: {current: unknown[]; throws: boolean} = {current: [], throws: false};
jest.mock('../../shielded/a0/noteStore', () => ({
  loadA0NoteStore: () => {
    if (mockNotes.throws) throw new Error('E_A0_STORE_LOCKED');
    return {notes: mockNotes.current, nextDepositIndex: 0n};
  },
}));
const mockRegistry: {current: unknown[] | null; throws: boolean} = {current: null, throws: false};
jest.mock('../../shielded/a0/accountRegistry', () => ({
  ...jest.requireActual('../../shielded/a0/accountRegistry'),
  loadA0AccountRegistry: () => {
    if (mockRegistry.throws) throw new Error('E_A0_ACCOUNTS_CORRUPT');
    return mockRegistry.current;
  },
}));

import {freshExitAccountOf, pendingFreshSchemeOf} from '../receivedBy';

const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';

beforeEach(() => {
  mockNotes.current = [];
  mockNotes.throws = false;
  mockRegistry.current = null;
  mockRegistry.throws = false;
});

it('pendingFreshSchemeOf: the reserved scheme of THIS rho\'s pending fresh exit', () => {
  mockNotes.current = [
    {rho: 'r1', status: 'pending', unshield: {destination: 'fresh', scheme: 'slip10:3'}},
    {rho: 'r2', status: 'pending', unshield: {destination: 'main'}},
  ];
  expect(pendingFreshSchemeOf('r1')).toBe('slip10:3');
  expect(pendingFreshSchemeOf('r2')).toBeNull(); // not a fresh exit
  expect(pendingFreshSchemeOf('r9')).toBeNull(); // no such note
  mockNotes.throws = true;
  expect(pendingFreshSchemeOf('r1')).toBeNull(); // a store that cannot be read is no answer
});

it('freshExitAccountOf: only a fresh-exit entry of that scheme; its label and stored address', () => {
  mockRegistry.current = [
    {scheme: 'slip10:0', role: 'main', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'},
    {scheme: 'slip10:3', role: 'fresh-exit', address: A3},
    {scheme: 'slip10:4', role: 'fresh-pending', address: 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'},
  ];
  expect(freshExitAccountOf('slip10:3')).toEqual({label: 'Account 4', address: A3});
  expect(freshExitAccountOf('slip10:4')).toBeNull(); // not landed (yet)
  expect(freshExitAccountOf('slip10:7')).toBeNull();
  expect(freshExitAccountOf(null)).toBeNull();
  mockRegistry.throws = true;
  expect(freshExitAccountOf('slip10:3')).toBeNull();
});
```

In `src/screens/shielded/unshield/__tests__/UnshieldRunScreen.test.tsx`, add after the `useA0Shielded` mock block:

```tsx
// M1d (spec §4.3, plan A14): "Received by" — the pending intent's scheme at onPending, then the registry's fresh-exit
const mockPendingScheme = jest.fn<string | null, [string]>(() => null);
const mockFreshExit = jest.fn<{label: string; address: string} | null, [string | null]>(() => null);
jest.mock('../../../../modules/accounts/receivedBy', () => ({
  pendingFreshSchemeOf: (rho: string) => mockPendingScheme(rho),
  freshExitAccountOf: (s: string | null) => mockFreshExit(s),
}));
```

add `mockPendingScheme.mockReset().mockReturnValue(null); mockFreshExit.mockReset().mockReturnValue(null);` to its `beforeEach`, and append:

```tsx
describe('M1d — #21 Now public names the new account it landed on (spec §4.3)', () => {
  const SPENT = {status: 'spent' as const, signature: SIG, changeLeafIndex: 42, changeAmount: 749_990_000n, grantLamports: 3_000_000n, destinationWithoutSol: false};
  const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';

  it('a fresh exit that landed → Details: "Received by · Account 4 · 3YqEpf…JXT94k"', async () => {
    mockPendingScheme.mockReturnValue('slip10:3');
    mockFreshExit.mockReturnValue({label: 'Account 4', address: A3});
    const {r, ctl} = await run();
    act(() => ctl.pending('rho-1'));
    await act(async () => ctl.resolve(SPENT));
    expect(mockPendingScheme).toHaveBeenCalledWith('rho-1');
    fireEvent.press(r.getByTestId('unshield-details-toggle'));
    expect(r.getByText('Received by')).toBeTruthy();
    expect(r.getByText('Account 4 · 3YqEpf…JXT94k')).toBeTruthy();
    expect(mockFreshExit).toHaveBeenCalledWith('slip10:3');
  });

  it.each<[string, UnshieldRunRequest['destination']]>([
    ['the main account', {kind: 'main'}],
    ['another address', {kind: 'external', owner: 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N'}],
  ])('to %s → no "Received by" (and the note store is not asked)', async (_n, destination) => {
    mockPendingScheme.mockReturnValue('slip10:3');
    mockFreshExit.mockReturnValue({label: 'Account 4', address: A3});
    const {r, ctl} = await run({destination, amount: '1250000000'});
    act(() => ctl.pending('rho-2'));
    await act(async () => ctl.resolve(SPENT));
    fireEvent.press(r.getByTestId('unshield-details-toggle'));
    expect(r.queryByText('Received by')).toBeNull();
    expect(mockPendingScheme).not.toHaveBeenCalled();
  });

  it('the registry does not (yet) hold it as fresh-exit → no row, never a guess', async () => {
    mockPendingScheme.mockReturnValue('slip10:3');
    mockFreshExit.mockReturnValue(null);
    const {r, ctl} = await run();
    act(() => ctl.pending('rho-3'));
    await act(async () => ctl.resolve(SPENT));
    fireEvent.press(r.getByTestId('unshield-details-toggle'));
    expect(r.queryByText('Received by')).toBeNull();
  });

  it('a pending outcome (not landed) → no row', async () => {
    mockPendingScheme.mockReturnValue('slip10:3');
    mockFreshExit.mockReturnValue({label: 'Account 4', address: A3});
    const {r, ctl} = await run();
    act(() => ctl.pending('rho-4'));
    await act(async () => ctl.resolve({status: 'pending', signature: SIG, reason: 'unconfirmed'}));
    expect(r.queryByText('Received by')).toBeNull();
  });
});
```

(`run(request?)` and `ctl.pending` / `ctl.resolve` are the file's own helpers; the pending outcome is the shape the file's existing pending rows resolve.)

In `src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx`, append inside `describe('ShieldedExplainerScreen', …)`:

```tsx
  it('M1d (M1 spec §11 R11): who sees what — the relayer, the RPC provider, the chain — in plain words', () => {
    const r = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    const block = r.getByTestId('explainer-who-sees-what');
    expect(block).toBeTruthy();
    expect(r.getByText('Who sees what')).toBeTruthy();
    expect(
      r.getByText(
        'When you make tokens public, the relayer that sends them sees the request: the destination, the amount, the time and the network address it came from. The proof does not tell it which deposit is spent, but amounts and timing can hint at it. Otherwise it sees what anyone sees on chain.',
      ),
    ).toBeTruthy();
    expect(r.getByText('The RPC provider the app uses sees every request the app makes, including the balances of all your accounts.')).toBeTruthy();
    expect(r.getByText('On chain, amounts and timing are public.')).toBeTruthy();
  });
```

(The file's existing negative row — no "SOL", no "recipient", no overclaim — reads the whole screen and must stay green with the new text: it is the check that the R11 paragraph widened nothing.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/components/accounts src/modules/accounts/__tests__/receivedBy.test.ts src/screens/transparent/__tests__/SwapScreen.test.tsx src/screens/__tests__/PresaleActive.test.tsx src/screens/referral src/screens/shielded`
Expected: FAIL — `MainAccountLine` and `receivedBy` missing; no `swap-main-account` / `presale-main-account` / `referral-main-account`; no "Received by"; no `explainer-who-sees-what`.

- [ ] **Step 4: Write the line and the reading**

Create `src/components/accounts/MainAccountLine.tsx`:

```tsx
/**
 * M1d spec §4.3 (D1; plan A13): Swap, presale and referral stay on the main account. While another
 * account is selected, this line says so, so the user is never surprised; with main selected it
 * renders nothing. The main account's own label ("Account 4" for a slip10:3 main).
 */
import React from 'react';
import {Text} from '../ui';
import {useAccountList, useSelectedAccount} from '../../hooks/useSelectedAccount';
import {USES_MAIN_ACCOUNT, fromMainLine} from '../../copy/accounts';

export function MainAccountLine({variant, testID}: {variant: 'from' | 'uses'; testID: string}) {
  const selected = useSelectedAccount();
  const list = useAccountList();
  const main = list?.accounts[0];
  if (selected === null || selected.isMain || main === undefined) {
    return null;
  }
  return (
    <Text variant="caption" className="text-fg-secondary" testID={testID}>
      {variant === 'from' ? fromMainLine(main.label) : USES_MAIN_ACCOUNT}
    </Text>
  );
}
```

Create `src/modules/accounts/receivedBy.ts`:

```ts
/**
 * M1d spec §4.3 (plan A14): #21 Now public names the new account a fresh exit landed on, so the
 * user can find it in the Accounts sheet. Read-only, with no change to M1c's flow: the reserved
 * scheme is on the note's PENDING intent (written right before the flow's `onPending(rho)`; the
 * settled note drops it), and the account is the registry's `fresh-exit` entry of that scheme.
 * Anything missing or unreadable → null, never a guess.
 */
import {loadA0NoteStore} from '../shielded/a0/noteStore';
import {loadA0AccountRegistry, parseA0Scheme} from '../shielded/a0/accountRegistry';
import {accountLabel} from './accountList';

export function pendingFreshSchemeOf(rho: string): string | null {
  try {
    const note = loadA0NoteStore().notes.find(n => n.rho === rho);
    return note?.unshield?.destination === 'fresh' ? note.unshield.scheme ?? null : null;
  } catch {
    return null;
  }
}

export function freshExitAccountOf(scheme: string | null): {label: string; address: string} | null {
  if (scheme === null) {
    return null;
  }
  const parsed = parseA0Scheme(scheme);
  if (parsed === null) {
    return null;
  }
  try {
    const entry = (loadA0AccountRegistry() ?? []).find(e => e.scheme === scheme && e.role === 'fresh-exit');
    return entry ? {label: accountLabel(parsed), address: entry.address} : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: The three main-only screens**

- `src/screens/transparent/SwapScreen.tsx`: add `import {MainAccountLine} from '../../components/accounts/MainAccountLine';` and, as the first child inside the `<ScrollView …>` (directly before `{/* ── From card ── */}`), add:

```tsx
          {/* M1d (spec §4.3, D1): Swap stays on the main account */}
          <View className="mb-2">
            <MainAccountLine variant="from" testID="swap-main-account" />
          </View>
```

- `src/screens/PresaleScreen.tsx`: add `import {MainAccountLine} from '../components/accounts/MainAccountLine';` and, in `PresaleActive`'s sticky bar, directly after `<View className="px-5 pt-3 pb-4 border-t border-bg-surface-3 bg-bg-base">`, add:

```tsx
          {/* M1d (spec §4.3, D1): the presale buy stays on the main account */}
          <View className="items-center mb-2">
            <MainAccountLine variant="from" testID="presale-main-account" />
          </View>
```

- `src/screens/referral/ReferralScreen.tsx`: add `import {MainAccountLine} from '../../components/accounts/MainAccountLine';` and, as the first child inside the `<ScrollView …>` (directly before `{/* 3-stat hero */}`), add:

```tsx
        {/* M1d (spec §4.3, D1): the referral link is the main account's */}
        <View className="mb-3">
          <MainAccountLine variant="uses" testID="referral-main-account" />
        </View>
```

(`View` is already imported in all three files.)

- [ ] **Step 6: #21 "Received by"**

In `src/screens/shielded/unshield/UnshieldRunScreen.tsx`:

(a) add

```ts
import {freshExitAccountOf, pendingFreshSchemeOf} from '../../../modules/accounts/receivedBy';
import {shortAccountAddress} from '../../../modules/accounts/accountList';
import {RECEIVED_BY, accountWithAddress} from '../../../copy/accounts';
```

(b) after the `const [balanceAfter, setBalanceAfter] = useState<bigint | null>(null);` line add:

```ts
  /** M1d (spec §4.3, plan A14): the scheme reserved for THIS run's fresh exit, read at onPending */
  const [freshScheme, setFreshScheme] = useState<string | null>(null);
```

(c) in the `unshieldA0(…)` call replace `{onStage, holdMs: () => takeA0SubmitHold(), onPending: setOwnRho},` with

```ts
          {
            onStage,
            holdMs: () => takeA0SubmitHold(),
            onPending: rho => {
              setOwnRho(rho);
              // M1d: the pending intent holds the reserved scheme now; the settled note will not
              if (request.destination.kind === 'fresh') setFreshScheme(pendingFreshSchemeOf(rho));
            },
          },
```

(d) directly after `const amountText = …;` add:

```ts
  // M1d (spec §4.3): where a fresh exit landed — the registry's fresh-exit entry, so the sheet can show it
  const receivedBy =
    phase.kind === 'done' && phase.outcome.status === 'spent' && request.destination.kind === 'fresh'
      ? freshExitAccountOf(freshScheme)
      : null;
```

(e) in the Details, directly after the `<MetaRow label={LEFT_IN_THIS_NOTE} … />` line add:

```tsx
                  {receivedBy ? (
                    <MetaRow
                      label={RECEIVED_BY}
                      value={accountWithAddress(receivedBy.label, shortAccountAddress(receivedBy.address), false)}
                    />
                  ) : null}
```

- [ ] **Step 7: #17 "Who sees what"**

In `src/screens/shielded/ShieldedExplainerScreen.tsx`: add `import {WHO_SEES_CHAIN, WHO_SEES_RELAYER, WHO_SEES_RPC, WHO_SEES_WHAT} from '../../copy/accounts';` and, inside the `ScrollView` directly after the third `<ExplainerStep … />`, add:

```tsx
        {/* M1d (M1 spec §11 R11): who sees what — every party that sees a request, nothing softened */}
        <View className="mt-2 mb-2" testID="explainer-who-sees-what">
          <Text variant="h3" className="mb-2">
            {WHO_SEES_WHAT}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary mb-2">
            {WHO_SEES_RELAYER}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary mb-2">
            {WHO_SEES_RPC}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary">
            {WHO_SEES_CHAIN}
          </Text>
        </View>
```

(`View` and `Text` are already imported there.)

- [ ] **Step 8: Run the tests to verify they pass**

Run the Step 3 command, then `npx jest src/copy src/screens/shielded/__tests__/privacyClaims.test.ts`. Expected: PASS — the guard and the banned-word scan read the edited screens (all under `src/screens` / `src/components`) with unchanged regexes.

- [ ] **Step 9: Mutations (each must go red, then revert)**

1. In `MainAccountLine`, drop `selected.isMain ||` → the "main selected → nothing" rows FAIL (component and the three screens). Revert.
2. In `receivedBy.ts`, drop `&& e.role === 'fresh-exit'` → "not landed (yet)" FAILS. Revert.
3. In `UnshieldRunScreen`, drop `&& request.destination.kind === 'fresh'` from `receivedBy` → the two "to the main account / another address" rows FAIL (the mocks would name Account 4). Revert. Then remove the `if (request.destination.kind === 'fresh')` guard in `onPending` → "the note store is not asked" FAILS. Revert.
4. In `copy/accounts.ts`, change `WHO_SEES_RPC`'s "balances of all your accounts" to "balances" → `accounts.test.ts` and the explainer row FAIL. Revert.

- [ ] **Step 10: Run the gates**

```bash
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: all green; tsc 0; `✖ 143 problems (0 errors, 143 warnings)`; TGE check 0.

- [ ] **Step 11: Commit**

```bash
git add src/components/accounts src/modules/accounts/receivedBy.ts src/modules/accounts/__tests__/receivedBy.test.ts \
  src/screens/transparent/SwapScreen.tsx src/screens/PresaleScreen.tsx src/screens/referral src/screens/__tests__/PresaleActive.test.tsx \
  src/screens/transparent/__tests__/SwapScreen.test.tsx src/screens/shielded
git commit -m "feat(m1d): main-only lines on Swap/presale/referral, #21 Received by, #17 who sees what

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The owner's design files — dated backup, edit, tell the owner per screen

**Files (outside the repo — nothing in the repo changes in this task, no commit):**
- Create first: `/home/user/Downloads/index.html.bak-<name>`, `/home/user/Downloads/screen.md.bak-<name>` (plan A18: the first free of `bak-YYYY-MM-DD`, `bak-YYYY-MM-DDb`, `c`, `d`, … — `bak-2026-11-21`, `b` and `c` already exist and are never overwritten)
- Modify: `/home/user/Downloads/index.html`, `/home/user/Downloads/screen.md`
- Create (the session's scratchpad directory `$W`): `$W/design-m1d.index.diff`, `$W/design-m1d.screen.diff`, `$W/check-m1d.sh`

**Interfaces:**
- Consumes: the strings of Tasks 1–7 exactly as merged on this branch (the design says what the code says): `src/copy/accounts.ts` (every constant and formatter), the testIDs are not drawn. Facts to draw: the avatar shows the selected account's NUMBER; the Accounts sheet (title, rows with label / tags / short address first 6 … last 6 / balances / check, footer for slip10, the cli case, the unreadable line); the combined line under the toggle (both modes, hidden, unknown); the linking warning on #12 and "Tap again to send anyway"; "From: Account 4 · 3YqEpf…JXT94k" on #19 and the #20 From row "Account 4 · 3YqEpf…JXT94k"; #21 Now public Details "Received by · Account 4 · 3YqEpf…JXT94k"; "From: Account 1 (main)" on #23 presale above Buy and "Uses your main account" on #24 referral; #17's "Who sees what".
- Produces: the updated design (spec §5) and a per-screen summary for the owner. Existing design-system classes and tokens only; no new colour; no other screen touched.

**The process (spec §5; owner's standing guidance 2026-11-21 "improve the design as we build"):** back up first, edit in place, hand the diffs and the per-screen summary to the controller, and STOP. The controller shows them to the owner and handles the approval; only the owner's own message approves. On a change request, edit again and re-diff against the same backup; on a rejection, restore with `cp -p <backup> <original>` (Step 6). The backups stay (the owner deletes them).

- [ ] **Step 1: The dated backup (never overwriting one)**

```bash
cd /home/user/Downloads
d=$(date +%F)
n=""
for suf in "" b c d e f g h i j; do
  if [ ! -e "index.html.bak-$d$suf" ] && [ ! -e "screen.md.bak-$d$suf" ]; then n="bak-$d$suf"; break; fi
done
[ -n "$n" ] || { echo "STOP: no free backup name for $d"; exit 3; }
cp -p index.html "index.html.$n" && cp -p screen.md "screen.md.$n"
sha256sum index.html "index.html.$n" screen.md "screen.md.$n"
echo "BACKUP NAME: $n"
```

Expected: each original's hash equals its backup's; note the printed name (`$n`) — every later step uses it.

- [ ] **Step 2: The check, with its positive control, BEFORE editing**

```bash
W=<the session's scratchpad directory>
cat > "$W/check-m1d.sh" <<'EOF'
#!/usr/bin/env bash
# usage: check-m1d.sh <index.html> <screen.md> — prints MISSING for every M1d string the design must carry
i="$1"; s="$2"; miss=0
need() { grep -qF -- "$2" "$1" || { echo "MISSING in $(basename "$1"): $2"; miss=1; }; }
for t in 'switch account' 'Accounts' "Other accounts can't be read right now." \
         'New accounts appear here when you make funds public to “A new account”.' \
         'Sending between your own accounts links them on chain.' \
         'Anyone can see that these two accounts belong to the same person.' \
         'Tap again to send anyway' 'From: Account 4 · 3YqEpf…JXT94k' 'Account 4 · 3YqEpf…JXT94k' \
         'Received by' 'From: Account 1 (main)' 'Uses your main account' 'Who sees what' \
         'The RPC provider the app uses sees every request the app makes, including the balances of all your accounts.' \
         'Public ••• · Private •••' 'not checked yet' 'Balance unavailable'; do need "$i" "$t"; done
for t in 'Accounts sheet' 'Public X · Private Y' 'linking warning' 'Received by' 'Uses your main account' 'Who sees what'; do need "$s" "$t"; done
exit $miss
EOF
chmod +x "$W/check-m1d.sh"
"$W/check-m1d.sh" "/home/user/Downloads/index.html.$n" "/home/user/Downloads/screen.md.$n" | wc -l
```

Expected (positive control): a count well above 0 on the untouched backup — the check can fail. If it is 0, the check is broken: fix it before editing.

- [ ] **Step 3: Read before editing**

In `index.html` read the sections `id="s11"`, `id="s12"`, `id="s17"`, `id="s19"`, `id="s20"`, `id="s21"`, `id="screen-23"`, `id="screen-24"` (find each with `grep -n 'id="<id>"' /home/user/Downloads/index.html`) — their phones (`.phone-wrap > .phone > .screen`), `.state-label`s and their tables (B) DS class map, (C) States rendered, (D) Global rules, (E) Navigation exits, (F) Android-specific — and the bottom-sheet pattern of `id="s43"` (token-selector: `.s8-sheet-overlay`, `.s8-sheet`, `.grabber`, `.head`, `.list`, `.row`) and the `.banner.warning` rule. In `screen.md` read §0 and the entries `11 · dashboard`, `12 · send`, `17 · shielded-explainer`, `19 · tx-simulate`, `20 · tx-confirm`, `21 · tx-status`, `23 · presale`, `24 · referral`. List every state each one already draws before changing any.

- [ ] **Step 4: Edit `index.html` (existing classes and tokens only)**

- **§s11 dashboard:**
  - every phone's `.top .avatar`: the letter "M" → the account's number "1", with `aria-label="Account 1, switch account"`;
  - in the "Loaded · public" and "Loaded · private" phones, directly under `.mode-toggle`: `<div class="noc-body-sm noc-numeral" style="text-align:center;color:var(--fg-secondary);margin:calc(-1 * var(--space-2)) var(--space-5) var(--space-3)">Public $14,881.19 · Private <the private phone's own hero figure and token></div>` (the public phone's figure is its hero total; the big figure below stays as drawn — D3);
  - new phone **"Accounts sheet · default"**: the "Loaded · public" phone dimmed by `.s8-sheet-overlay` and an `.s8-sheet` with `.grabber`, `.head` "Accounts", a `.list` of three `.row`s — "Account 1" + a `main` pill, `HAgk14…3DKpqk` in `noc-mono`, "$14,881.19"; "Account 4" + an `exit` pill, `3YqEpf…JXT94k`, "0.003 SOL", the check (`#i-check`, `color:var(--accent)`) on this row (selected); "Account 6" + `exit` and `linked` pills (`linked` in `color:var(--warning)`), its short address, "not checked yet"; below the list the footer `noc-caption` "New accounts appear here when you make funds public to “A new account”.";
  - new phone **"Accounts sheet · cli wallet"**: one row "Account 1" + `main`, no footer;
  - new phone **"Accounts sheet · registry unreadable"**: the line "Other accounts can't be read right now." (`noc-body-sm`, `color:var(--warning)`) above the one main row; and in the default phone one more row state: "Balance unavailable";
  - new phone **"Loaded · public · Account 4 selected"**: avatar "4" (`aria-label="Account 4, switch account"`), hero = that account's figure, sub-balance "0.003 SOL · 0 NOC", the combined line "Public 0.003 SOL · Private <figure>";
  - new phone **"Combined line · hidden"**: the eye-off state with "Public ••• · Private •••" under the toggle; and **"Combined line · unknown"**: "Public — · Private <figure>" (a non-main account still loading);
  - (B): the Accounts sheet ↔ `.s8-sheet` / `.row` + pills; the combined line ↔ `noc-body-sm noc-numeral`; (C): the new states counted; (E): "avatar → Accounts sheet (Profile stays on its tab)".
- **§s12 send:** new phone **"Own account · linking warning"**: recipient = the main account's address (mono, valid), directly under the recipient field a `.banner.warning` with the bold title "Sending between your own accounts links them on chain." and the body "Anyone can see that these two accounts belong to the same person."; the sticky CTA reading "Tap again to send anyway" (state label "after the first tap"); update (C).
- **§s19:** in the transparent ready phone's intent card, a `noc-caption` line under the amount → address: "From: Account 4 · 3YqEpf…JXT94k"; one more state label note "main: From: Account 1 (main) · HAgk14…3DKpqk".
- **§s20:** the transparent phone's `From` detail row value → "Account 4 · 3YqEpf…JXT94k" (first-6/last-6 highlighted in `--accent`, §0's checksum rule).
- **§s21:** in the "Now public · Details open" phone's `.meta-grid`, a row "Received by" · "Account 4 · 3YqEpf…JXT94k" (mono).
- **§screen-23 presale:** in one phone, above the sticky Buy CTA, a `noc-caption` "From: Account 1 (main)" (state label "another account selected").
- **§screen-24 referral:** in one phone, at the top of the content, a `noc-caption` "Uses your main account" (state label "another account selected").
- **§s17:** after step 3, an `h3`-styled heading "Who sees what" and three `noc-body-sm` paragraphs in `color:var(--fg-secondary)`, verbatim: "When you make tokens public, the relayer that sends them sees the request: the destination, the amount, the time and the network address it came from. The proof does not tell it which deposit is spent, but amounts and timing can hint at it. Otherwise it sees what anyone sees on chain." / "The RPC provider the app uses sees every request the app makes, including the balances of all your accounts." / "On chain, amounts and timing are public."

Swap has no phone in `index.html`; its line ("From: Account 1 (main)" while another account is selected) is recorded in `screen.md` §0 (Step 5).

- [ ] **Step 5: Edit `screen.md`**

- **§0**, after the Vocabulary line: "Accounts (M1d, 2026-11-21): the avatar on #11 shows the selected account's number and opens the Accounts sheet (Profile stays on its tab). Send (#12 → #19 → #21), Receive (#13), the history and the dashboard's public balance follow the selected account; Make private, Swap, presale and referral stay on the main account and say "From: Account 1 (main)" / "Uses your main account" whenever another account is selected. No adding, renaming or removing accounts."
- **`11`**: "Accounts sheet: …" (title, rows, tags main / exit / linked, short address first 6 … last 6, balances — USD where every asset is priced, else the token amounts; "not checked yet", "Balance unavailable"; the check; the footer for slip10 wallets; a cli wallet one row; "Other accounts can't be read right now."), and "Public X · Private Y: one thin line under the toggle in both modes; never summed; "—" for an unknown side; "Public ••• · Private •••" when hidden".
- **`12`**: "linking warning: a Send between two of the wallet's accounts where one is a new account (exit) shows a warning under the recipient; the CTA needs a second tap ("Tap again to send anyway"); changing the recipient or the amount resets it".
- **`17`**: "Who sees what: the relayer, the RPC provider, the chain (R11)".
- **`19`**, **`20`**: "From: Account N · first6…last6" / the From row.
- **`21`**: "Now public: Details "Received by · Account N · first6…last6" when the destination was a new account".
- **`23`**, **`24`**: "From: Account 1 (main)" / "Uses your main account" while another account is selected.

- [ ] **Step 6: Check, diff, hand over and STOP**

```bash
"$W/check-m1d.sh" /home/user/Downloads/index.html /home/user/Downloads/screen.md; echo "check exit=$?"
diff -u "/home/user/Downloads/index.html.$n" /home/user/Downloads/index.html > "$W/design-m1d.index.diff"; echo "diff exit=$?"
diff -u "/home/user/Downloads/screen.md.$n" /home/user/Downloads/screen.md > "$W/design-m1d.screen.diff"; echo "diff exit=$?"
grep '^+' "$W/design-m1d.index.diff" "$W/design-m1d.screen.diff" | sed 's/<[^>]*>/ /g' \
  | grep -inE 'unlinkable|untraceable|anonymous|invisible|fully private|no one can see' ; echo "overclaim lines above (must be none)"
grep '^+' "$W/design-m1d.index.diff" | sed 's/<[^>]*>/ /g' \
  | grep -inE '(^|[^a-z0-9+/-])(un)?shield(ed|ing|s)?([^a-z0-9-]|$)|(^|[^a-z0-9+/-])(transparent|vaults?)([^a-z0-9-]|$)' ; echo "banned-word lines above (must be none)"
wc -l "$W"/design-m1d.*.diff
```

Expected: `check exit=0` (Step 2 proved the same check fails on the backup); both diff exits 1; no overclaim and no banned-word line in the added visible text. The report to the controller: the backup name, the two diff paths (full absolute paths), and a per-screen summary — §s11 (avatar number, the combined line in both modes, six new phones: sheet default / cli / unreadable, Account 4 selected, hidden, unknown), §s12 (the warning phone), §s19 / §s20 (From), §s21 (Received by), §screen-23 / §screen-24 (the main-only lines), §s17 (Who sees what), `screen.md` §0 / 11 / 12 / 17 / 19 / 20 / 21 / 23 / 24. Then STOP. If the owner rejects: `cd /home/user/Downloads && cp -p "index.html.$n" index.html && cp -p "screen.md.$n" screen.md && sha256sum index.html "index.html.$n" screen.md "screen.md.$n"` (each pair equal again).

- [ ] **Step 7: Record**

The PR description gets: "design files updated <date>, backup `<n>`, owner's answer <date of the owner's message>", and the two diffs' `wc -l`.

---

### Task 9: The desk checkpoint script for the M1d on-phone checkpoint

**Files:**
- Create: `scripts/m1d-checkpoint/lib.mjs` (pure: the readout readers, the transaction reading, the judge)
- Create: `scripts/m1d-checkpoint/lib.test.mjs` (`node --test`, no network, no device)
- Create: `scripts/m1d-checkpoint/m1d-checkpoint.mjs` (the I/O: devnet RPC, genesis-checked)
- Create: `scripts/m1d-checkpoint/README.md` (the owner's checklist)
- Modify: `.github/workflows/native-prover.yml` (one desk-test step after the M1c one; `scripts/m1d-checkpoint/**` in both `paths` lists)

**Interfaces:**
- Consumes (existing, unchanged): `ataOf(owner: string, mint = A0.mint): string`, `RELAYER_FEE_PAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe'` (`scripts/m1c-checkpoint/chain.mjs`); `DEVNET.genesisHash = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'` (`scripts/m1c-checkpoint/lib.mjs` re-exports M1b's `DEVNET`); M1c's readout record `OUT/readouts.jsonl` — one JSON per line `{seenAt, readout}`, where `readout.event === 'startup-accounts'` carries `accounts: [{address, role, linked}] | null` and `seedKeys: string[] | null`, and `readout.event === 'unshield-outcome'` carries `owner`, `status`, `signature` (written by `node scripts/m1c-checkpoint/m1c-checkpoint.mjs collect --out DIR`).
- Produces (`lib.mjs`): `seedFromReadouts(lines): {seedKeys: string[]; main: string; registry: object[]} | null`, `freshUnshieldOf(lines, fresh: string): string | null`, `txKeys(result): {signature, keys, signers, feePayer, ok, pre, post} | null`, `judgeM1d({fresh, external, unshieldSig, sendSig, seed, history: {owner: {signature}[]; ata: {signature}[]}, txs: {unshield, send}}): {lines: {id, text, pass, detail}[]; pass: boolean}` — lines `M1d.D0` … `M1d.D6`.
- Produces (`m1d-checkpoint.mjs`): `verify --fresh ADDR --send SIG --external ADDR [--unshield SIG] [--readouts FILE] [--rpc URL] [--out DIR]` → prints PASS / FAIL per line, writes `OUT/verify.json`, exit 0 only if every line passed (default OUT `build/m1d-checkpoint`).

M1 spec §16 M1d, line by line: "switch to the fresh account and send from it to a devnet address outside this seed, paying only from the granted SOL" (D0, D3, D4); "the desk script asserts the fresh account's history is exactly {the relayed unshield, this send}" (D1, D2) "and that no transaction connects it to another account of the seed" (D5); "the linking warning appears when a send from it to the main account is started (and is cancelled, not sent)" (D6 on chain; the warning itself on the phone, the owner's line); "the owner's visual pass" (README). The desk never holds a seed (plan A17): the seed's keys are the app's own `startup-accounts` readout.

- [ ] **Step 1: Write the failing tests**

Create `scripts/m1d-checkpoint/lib.test.mjs`:

```js
/**
 * The M1d desk's judge (spec 2026-11-08 §16 M1d): every line on synthetic devnet answers built
 * from the repo's vector addresses (real base58, so ataOf derives real token accounts), each line
 * shown to FAIL on a one-field mutation, and the two readout readers. No network, no device:
 * node --no-warnings --test scripts/m1d-checkpoint/*.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ataOf, RELAYER_FEE_PAYER } from '../m1c-checkpoint/chain.mjs';
import { freshUnshieldOf, judgeM1d, seedFromReadouts, txKeys } from './lib.mjs';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const FRESH = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const CLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const EXT = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const POOL = '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT';
const SYS = '11111111111111111111111111111111';
const U_SIG = 'U'.repeat(87) + '1';
const S_SIG = 'S'.repeat(87) + '1';
const SEED = { seedKeys: [MAIN, FRESH, CLI], main: MAIN, registry: [] };

const tx = ({ sig, keys, signers, pre, post, err = null }) => ({
  slot: 1,
  transaction: { signatures: [sig], message: { accountKeys: keys, header: { numRequiredSignatures: signers } } },
  meta: { err, preBalances: pre, postBalances: post, loadedAddresses: { writable: [], readonly: [] } },
});
const UNSHIELD = () =>
  tx({ sig: U_SIG, keys: [RELAYER_FEE_PAYER, POOL, ataOf(FRESH), FRESH, SYS], signers: 1, pre: [9_000_000, 1, 0, 0, 1], post: [3_960_000, 1, 2_039_280, 3_000_000, 1] });
const SEND = () => tx({ sig: S_SIG, keys: [FRESH, EXT, SYS], signers: 1, pre: [3_000_000, 5, 1], post: [1_995_000, 1_000_005, 1] });
const base = () => ({
  fresh: FRESH,
  external: EXT,
  unshieldSig: U_SIG,
  sendSig: S_SIG,
  seed: SEED,
  history: { owner: [{ signature: S_SIG }, { signature: U_SIG }], ata: [{ signature: U_SIG }] },
  txs: { unshield: UNSHIELD(), send: SEND() },
});
const failing = r => r.lines.filter(l => !l.pass).map(l => l.id);

test('positive control: the honest checkpoint passes every line, D0 … D6', () => {
  const r = judgeM1d(base());
  assert.deepEqual(r.lines.map(l => l.id), ['M1d.D0', 'M1d.D1', 'M1d.D2', 'M1d.D3', 'M1d.D4', 'M1d.D5', 'M1d.D6']);
  assert.deepEqual(failing(r), []);
  assert.equal(r.pass, true);
});

test('D0: a recipient inside the seed, or the fresh account outside it, fails', () => {
  assert.deepEqual(failing(judgeM1d({ ...base(), external: CLI })).includes('M1d.D0'), true);
  assert.deepEqual(failing(judgeM1d({ ...base(), fresh: EXT })).includes('M1d.D0'), true);
});

test('D1: a third transaction in the history, or the send missing from it, fails', () => {
  const extra = base();
  extra.history.ata.push({ signature: 'X'.repeat(88) });
  assert.ok(failing(judgeM1d(extra)).includes('M1d.D1'));
  const missing = base();
  missing.history.owner = [{ signature: U_SIG }];
  assert.ok(failing(judgeM1d(missing)).includes('M1d.D1'));
});

test('D2: the unshield signed by a key of this seed, or funding a non-empty account, fails', () => {
  const signed = base();
  signed.txs.unshield = tx({ sig: U_SIG, keys: [RELAYER_FEE_PAYER, FRESH, POOL, ataOf(FRESH), SYS], signers: 2, pre: [9, 0, 1, 0, 1], post: [3, 3_000_000, 1, 2, 1] });
  assert.ok(failing(judgeM1d(signed)).includes('M1d.D2'));
  const funded = base();
  funded.txs.unshield.meta.preBalances[3] = 5;
  assert.ok(failing(judgeM1d(funded)).includes('M1d.D2'));
});

test('D3: a send paid by the main account, or a failed send, fails', () => {
  const paid = base();
  paid.txs.send = tx({ sig: S_SIG, keys: [MAIN, FRESH, EXT, SYS], signers: 2, pre: [5, 3_000_000, 5, 1], post: [0, 1_000_000, 1_000_005, 1] });
  const ids = failing(judgeM1d(paid));
  assert.ok(ids.includes('M1d.D3') && ids.includes('M1d.D5') && ids.includes('M1d.D6'));
  const failed = base();
  failed.txs.send.meta.err = { InstructionError: [0, 'Custom'] };
  assert.ok(failing(judgeM1d(failed)).includes('M1d.D3'));
});

test('D4: SOL from anywhere but the grant (a balance at the send that is not what the unshield left) fails', () => {
  const topped = base();
  topped.txs.send.meta.preBalances[0] = 4_000_000;
  assert.ok(failing(judgeM1d(topped)).includes('M1d.D4'));
});

test('D5 / D6: another seed key or its token account in either transaction fails; the main account fails D6 too', () => {
  const cli = base();
  cli.txs.send.transaction.message.accountKeys.push(CLI);
  cli.txs.send.meta.preBalances.push(1);
  cli.txs.send.meta.postBalances.push(1);
  const c = failing(judgeM1d(cli));
  assert.ok(c.includes('M1d.D5') && !c.includes('M1d.D6'));
  const mainAta = base();
  mainAta.txs.unshield.transaction.message.accountKeys.push(ataOf(MAIN));
  mainAta.txs.unshield.meta.preBalances.push(0);
  mainAta.txs.unshield.meta.postBalances.push(0);
  const m = failing(judgeM1d(mainAta));
  assert.ok(m.includes('M1d.D5') && m.includes('M1d.D6'));
});

test('a transaction that was not read never passes a line', () => {
  const unread = base();
  unread.txs.send = null;
  const ids = failing(judgeM1d(unread));
  for (const id of ['M1d.D3', 'M1d.D4', 'M1d.D5', 'M1d.D6']) assert.ok(ids.includes(id), id);
});

test('txKeys: static keys then loaded addresses; the first numRequiredSignatures are the signers', () => {
  const t = tx({ sig: S_SIG, keys: [FRESH, EXT], signers: 1, pre: [1, 2, 3], post: [1, 2, 3] });
  t.meta.loadedAddresses = { writable: [SYS], readonly: [] };
  const k = txKeys(t);
  assert.deepEqual(k.keys, [FRESH, EXT, SYS]);
  assert.deepEqual(k.signers, [FRESH]);
  assert.equal(k.feePayer, FRESH);
  assert.equal(txKeys(null), null);
});

test('seedFromReadouts: the LAST startup-accounts line with keys; its registry joined; null without one', () => {
  const line = (seq, seedKeys, accounts) => ({ seenAt: 't', readout: { event: 'startup-accounts', session: 's', seq, seedKeys, accounts } });
  const lines = [
    line(1, [MAIN], [{ address: MAIN, role: 'main', linked: false }]),
    line(2, [MAIN, CLI], [{ address: MAIN, role: 'main', linked: false }, { address: FRESH, role: 'fresh-exit', linked: false }]),
    line(3, null, null),
  ];
  const s = seedFromReadouts(lines);
  assert.equal(s.main, MAIN);
  assert.deepEqual([...s.seedKeys].sort(), [CLI, FRESH, MAIN].sort());
  assert.equal(seedFromReadouts([line(1, null, null)]), null);
  assert.equal(seedFromReadouts([]), null);
});

test('freshUnshieldOf: the one spent unshield to the fresh account; none or two different → null', () => {
  const out = (owner, signature, status = 'spent') => ({ seenAt: 't', readout: { event: 'unshield-outcome', owner, signature, status } });
  assert.equal(freshUnshieldOf([out(FRESH, U_SIG), out(MAIN, S_SIG)], FRESH), U_SIG);
  assert.equal(freshUnshieldOf([out(FRESH, U_SIG), out(FRESH, U_SIG)], FRESH), U_SIG);
  assert.equal(freshUnshieldOf([out(FRESH, U_SIG), out(FRESH, S_SIG)], FRESH), null);
  assert.equal(freshUnshieldOf([out(FRESH, U_SIG, 'pending')], FRESH), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --no-warnings --test scripts/m1d-checkpoint/*.test.mjs`
Expected: FAIL — `Cannot find module …/scripts/m1d-checkpoint/lib.mjs`.

- [ ] **Step 3: Write the judge**

Create `scripts/m1d-checkpoint/lib.mjs`:

```js
/**
 * The M1d checkpoint desk, its pure part (spec 2026-11-08-shielded-a0-m1-design.md §16 "M1d";
 * spec 2026-11-21-shielded-m1d-accounts-design.md §6). m1d-checkpoint.mjs does the I/O.
 *
 * THE DESK NEVER HOLDS A SEED (plan A17). "Another account of the seed" is the set the app itself
 * read out at its last start (M1c's `startup-accounts` readout: the registry's addresses, the cli
 * key and slip10:0 — `seedKeys` — joined with that line's registry), collected by the M1c desk.
 * "The fresh account's history" is the signature list of the account AND of its TEST token account
 * (a stranger's dust lands on the token account). Transactions are read with
 * `getTransaction(sig, {encoding: 'json', maxSupportedTransactionVersion: 0})`: the account keys
 * are the message's static keys followed by the loaded addresses (meta.loadedAddresses), the
 * signers the first numRequiredSignatures of the static keys, and pre/postBalances follow the keys.
 * A value that was not read never passes a line.
 */
import { ataOf, RELAYER_FEE_PAYER } from '../m1c-checkpoint/chain.mjs';

/** The seed's key set from the LAST `startup-accounts` readout that carries one. */
export function seedFromReadouts(lines) {
  const starts = lines
    .map(l => l && l.readout)
    .filter(r => r && r.event === 'startup-accounts' && Array.isArray(r.seedKeys) && Array.isArray(r.accounts));
  if (starts.length === 0) {
    return null;
  }
  const last = starts[starts.length - 1];
  const main = last.accounts.find(a => a.role === 'main');
  if (!main) {
    return null;
  }
  return { seedKeys: [...new Set([...last.seedKeys, ...last.accounts.map(a => a.address)])], main: main.address, registry: last.accounts };
}

/** The signature of THE spent unshield to `fresh` the readouts name (one distinct signature), else null. */
export function freshUnshieldOf(lines, fresh) {
  const sigs = lines
    .map(l => l && l.readout)
    .filter(r => r && r.event === 'unshield-outcome' && r.status === 'spent' && r.owner === fresh)
    .map(r => r.signature);
  const distinct = [...new Set(sigs)];
  return distinct.length === 1 ? distinct[0] : null;
}

/** A `getTransaction` (json) result as keys, signers, fee payer, status and balances; null for none. */
export function txKeys(result) {
  if (!result || !result.transaction || !result.transaction.message) {
    return null;
  }
  const msg = result.transaction.message;
  const statics = msg.accountKeys.map(k => (typeof k === 'string' ? k : k.pubkey));
  const loaded = (result.meta && result.meta.loadedAddresses) || { writable: [], readonly: [] };
  const keys = [...statics, ...loaded.writable, ...loaded.readonly];
  return {
    signature: result.transaction.signatures[0],
    keys,
    signers: statics.slice(0, msg.header.numRequiredSignatures),
    feePayer: statics[0],
    ok: result.meta !== null && typeof result.meta === 'object' && result.meta.err === null,
    pre: (result.meta && result.meta.preBalances) || [],
    post: (result.meta && result.meta.postBalances) || [],
  };
}

/** Every §16 M1d desk line; `pass` only when every line passed. */
export function judgeM1d({ fresh, external, unshieldSig, sendSig, seed, history, txs }) {
  const lines = [];
  const line = (id, text, pass, detail) => lines.push({ id, text, pass: Boolean(pass), detail });
  const u = txKeys(txs.unshield);
  const s = txKeys(txs.send);
  const others = seed.seedKeys.filter(k => k !== fresh);
  const forbidden = new Set([...others, ...others.map(k => ataOf(k))]);

  line(
    'M1d.D0',
    'the inputs: the fresh account is a key of this seed and not its main; the recipient is outside the seed; two signatures',
    seed.seedKeys.includes(fresh) && fresh !== seed.main && !seed.seedKeys.includes(external) && unshieldSig !== sendSig,
    `fresh ${fresh} (${seed.seedKeys.includes(fresh) ? 'in' : 'NOT in'} the seed set), main ${seed.main}, recipient ${external} (${seed.seedKeys.includes(external) ? 'IN the seed set' : 'outside'})`,
  );

  const listed = [...new Set([...history.owner, ...history.ata].map(x => x.signature))].sort();
  const expected = [unshieldSig, sendSig].sort();
  line(
    'M1d.D1',
    "the fresh account's history (the account and its TEST token account) is exactly {the relayed unshield, this send}",
    listed.length === 2 && listed[0] === expected[0] && listed[1] === expected[1],
    `listed: ${listed.join(', ') || '(none)'}`,
  );

  const iu = u ? u.keys.indexOf(fresh) : -1;
  line(
    'M1d.D2',
    'the unshield: landed, signed by the relayer fee payer only, funding the fresh account from 0 lamports',
    u !== null && u.ok && u.signature === unshieldSig && u.signers.length === 1 && u.signers[0] === RELAYER_FEE_PAYER && iu >= 0 && u.pre[iu] === 0,
    u ? `signers ${u.signers.join(',')}; the fresh account ${u.pre[iu]} → ${u.post[iu]} lamports` : 'not read',
  );

  const is = s ? s.keys.indexOf(fresh) : -1;
  line(
    'M1d.D3',
    'the send: landed, the fresh account its only signer and its fee payer, the recipient in it',
    s !== null && s.ok && s.signature === sendSig && s.signers.length === 1 && s.signers[0] === fresh && s.feePayer === fresh && s.keys.includes(external),
    s ? `signers ${s.signers.join(',')}; fee payer ${s.feePayer}` : 'not read',
  );

  line(
    'M1d.D4',
    'paid only from the granted SOL: at the send the fresh account held exactly what the unshield left it',
    u !== null && s !== null && iu >= 0 && is >= 0 && s.pre[is] === u.post[iu] && s.pre[is] > 0,
    u && s ? `after the unshield ${u.post[iu]}, before the send ${s.pre[is]} lamports` : 'not read',
  );

  const read = [u, s].filter(t => t !== null);
  const touching = read.flatMap(t => t.keys.filter(k => forbidden.has(k)).map(k => `${t.signature.slice(0, 8)}…: ${k}`));
  line(
    'M1d.D5',
    'nothing connects it to another account of this seed: no other seed key, nor its TEST token account, in either transaction',
    u !== null && s !== null && touching.length === 0,
    touching.length ? touching.join('; ') : `checked ${others.length} seed keys and their token accounts`,
  );

  const mainAta = ataOf(seed.main);
  const mainHit = read.some(t => t.keys.includes(seed.main) || t.keys.includes(mainAta));
  line(
    'M1d.D6',
    'the send to the main account was cancelled, not sent: nothing in the fresh account\'s history names the main account',
    u !== null && s !== null && !mainHit && listed.length === 2,
    mainHit ? 'the main account (or its token account) appears' : 'the main account appears in neither transaction',
  );
  return { lines, pass: lines.every(l => l.pass) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --no-warnings --test scripts/m1d-checkpoint/*.test.mjs`
Expected: PASS (all 11 tests).

- [ ] **Step 5: Mutations (each must go red, then revert)**

1. In `judgeM1d` D1, change `listed.length === 2 &&` to `listed.length >= 2 &&` and drop the two equalities → "D1: a third transaction" FAILS. Revert.
2. In D5, build `forbidden` from `others` only (no token accounts) → the `mainAta` case's D5 expectation FAILS. Revert.
3. In D2, drop `&& u.pre[iu] === 0` → "funding a non-empty account" FAILS. Revert.

- [ ] **Step 6: Write the CLI**

Create `scripts/m1d-checkpoint/m1d-checkpoint.mjs`:

```js
#!/usr/bin/env node
/**
 * The M1d checkpoint, desk side (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1d").
 * README.md next to this file is the owner's checklist; the owner drives the app by hand, the M1c
 * desk installs and collects the readouts, this script judges the chain:
 *
 *   verify --fresh ADDR --send SIG --external ADDR [--unshield SIG] [--readouts FILE] [--rpc URL] [--out DIR]
 *       reads the fresh account's and its TEST token account's signature lists and the two
 *       transactions from DEVNET (genesis-checked), judges M1d.D0–D6 (lib.mjs), prints PASS / FAIL per
 *       line, writes OUT/verify.json; exit 0 only if every line passed. The seed's keys come from the
 *       last `startup-accounts` readout in FILE (default OUT/readouts.jsonl); the unshield signature
 *       from its one spent `unshield-outcome` to ADDR, unless --unshield names it.
 *   common: --out DIR (default build/m1d-checkpoint)
 *
 * Never signs or sends anything; never holds a seed; never contacts *.noc-tura.io, solscan.io or
 * mainnet — devnet only, every answer after the genesis check.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ataOf } from '../m1c-checkpoint/chain.mjs';
import { DEVNET } from '../m1c-checkpoint/lib.mjs';
import * as L from './lib.mjs';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '../..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const OUT = resolve(opt('out', join(ROOT, 'build/m1d-checkpoint')));
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const die = msg => {
  console.error(`STOP: ${msg}`);
  process.exit(3);
};
const sleep = s => spawnSync('sleep', [String(s)]);

function rpcRefusal(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return `not a URL: ${url}`;
  }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:') {
    return `the RPC must be https: ${u.origin}`;
  }
  if (h === 'noc-tura.io' || h.endsWith('.noc-tura.io') || h === 'solscan.io' || h.endsWith('.solscan.io') || h.includes('mainnet')) {
    return `refusing ${h}: the desk reads devnet only, never noc-tura.io, solscan.io or mainnet`;
  }
  return null;
}

/** The genesis hash first (devnet's, or STOP), then each call as its own request, up to 5 tries on a 429. */
async function devnet(url, calls) {
  const why = rpcRefusal(url);
  if (why) {
    die(why);
  }
  const one = async (method, params) => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }),
      });
      const body = res.status === 429 ? null : res.ok ? await res.json() : die(`RPC ${new URL(url).hostname} answered HTTP ${res.status} to ${method}`);
      if (body && body.error?.code !== 429) {
        if (body.error) {
          die(`${method}: ${JSON.stringify(body.error)}`);
        }
        return body.result;
      }
      if (attempt >= 5) {
        die(`RPC ${new URL(url).hostname}: ${method} rate-limited (429) 5 times — wait a minute and run again`);
      }
      sleep(2);
    }
  };
  const genesis = await one('getGenesisHash');
  if (genesis !== DEVNET.genesisHash) {
    die(`the RPC is not devnet (genesis ${genesis})`);
  }
  const out = [];
  for (const c of calls) {
    out.push(await one(c.method, c.params));
  }
  return out;
}

async function verify() {
  const fresh = opt('fresh');
  const send = opt('send');
  const external = opt('external');
  if (!fresh || !send || !external) {
    die('usage: verify --fresh ADDR --send SIG --external ADDR [--unshield SIG] [--readouts FILE] [--rpc URL] [--out DIR]');
  }
  const file = resolve(opt('readouts', join(OUT, 'readouts.jsonl')));
  if (!existsSync(file)) {
    die(`no readouts at ${file} — collect them first (README step 3)`);
  }
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const seed = L.seedFromReadouts(lines);
  if (!seed) {
    die(`no startup-accounts readout with the seed's keys in ${file} — restart the devnet app, then collect (README step 3)`);
  }
  const unshield = opt('unshield') ?? L.freshUnshieldOf(lines, fresh);
  if (!unshield) {
    die(`no single spent unshield to ${fresh} in ${file} — pass --unshield SIG (the Tx hash on that unshield's #21)`);
  }
  const url = opt('rpc', DEFAULT_RPC);
  const TX = { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' };
  const LIST = { limit: 1000, commitment: 'confirmed' };
  const [owner, ata, u, s] = await devnet(url, [
    { method: 'getSignaturesForAddress', params: [fresh, LIST] },
    { method: 'getSignaturesForAddress', params: [ataOf(fresh), LIST] },
    { method: 'getTransaction', params: [unshield, TX] },
    { method: 'getTransaction', params: [send, TX] },
  ]);
  const r = L.judgeM1d({ fresh, external, unshieldSig: unshield, sendSig: send, seed, history: { owner, ata }, txs: { unshield: u, send: s } });
  for (const l of r.lines) {
    console.log(`${l.pass ? 'PASS' : 'FAIL'} ${l.id} ${l.text}\n       ${l.detail}`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, 'verify.json'),
    JSON.stringify({ at: new Date().toISOString(), rpcHost: new URL(url).hostname, fresh, external, unshield, send, ...r }, null, 2) + '\n',
  );
  console.log(r.pass ? 'M1d desk: every line PASSED' : 'M1d desk: FAILED (see the FAIL lines; README "Reading a FAIL")');
  process.exit(r.pass ? 0 : 1);
}

if (cmd === 'verify') {
  await verify();
} else {
  console.error('usage: node scripts/m1d-checkpoint/m1d-checkpoint.mjs verify --fresh ADDR --send SIG --external ADDR [--unshield SIG] [--readouts FILE] [--rpc URL] [--out DIR]');
  process.exit(2);
}
```

Run: `node scripts/m1d-checkpoint/m1d-checkpoint.mjs; echo "exit=$?"` → the usage line, `exit=2`. And `node scripts/m1d-checkpoint/m1d-checkpoint.mjs verify --fresh x --send y --external z --out "$(mktemp -d)"; echo "exit=$?"` → `STOP: no readouts at …`, `exit=3` (nothing contacted).

- [ ] **Step 7: Write the owner's checklist**

Create `scripts/m1d-checkpoint/README.md`:

````markdown
# M1d checkpoint — the owner's checklist

Spec: `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` §16 "Checkpoints · M1d":

> switch to the fresh account and send from it to a devnet address outside this seed, paying only from the granted
> SOL. The desk script asserts the fresh account's history is exactly {the relayed unshield, this send} and that no
> transaction connects it to another account of the seed. The linking warning appears when a send from it to the main
> account is started (and is cancelled, not sent). The owner's visual pass of the account switcher, #11 and #17.

and `docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md` §6 (the visual pass also covers #12 with the
warning, #19/#20, #21). **The phone reports, the chain decides.** The desk never holds a seed and never signs: "another
account of the seed" is the key set the app itself read out at its start (M1c's `startup-accounts` readout).

## Before you start

- [ ] M1c's second checkpoint passed: a **fresh account** exists (an unshield to "A new account" landed, with the
      relayer's SOL grant), and **nothing else** was ever done with it. Its address is in the Accounts sheet
      ("Account N · exit"); its unshield's signature is on that unshield's #21 (Details → Tx hash) and in
      `build/m1c-checkpoint/readouts.jsonl`.
- [ ] A devnet **address outside this seed** — the M1c "Another address" (it already holds devnet SOL). Never an
      address of this phrase.
- [ ] The phone reachable over adb, unlocked, screen on (M1c README "Before you start").

## 1. Build the APKs (one commit)

```bash
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 scripts/m1c-checkpoint/build-apks.sh build/m1d-checkpoint/apks
node scripts/m1c-checkpoint/m1c-checkpoint.mjs check-apks --apks build/m1d-checkpoint/apks --out build/m1d-checkpoint
```

## 2. Install the devnet app (its data kept)

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs install --apks build/m1d-checkpoint/apks --out build/m1d-checkpoint
```

## 3. Start, unlock, collect the seed's keys

Open the devnet app and unlock it (the start writes the `startup-accounts` readout). Then:

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs collect --out build/m1d-checkpoint
```

`build/m1d-checkpoint/readouts.jsonl` now holds the seed's keys. (If the fresh account's unshield is not in this
file — it ran in the M1c session — `verify` takes it with `--unshield SIG`.)

## 4. The sheet and the switch (on the phone)

- [ ] Tap the avatar (top left of #11): **Accounts** opens. "Account 1 · main" first, then your fresh account
      "Account N · exit" with its short address and balance; no "pending" account; the footer "New accounts appear
      here when you make funds public to “A new account”."; no Add / rename / remove.
- [ ] Tap the fresh account: the sheet closes, the avatar shows **N**, Public mode shows that account's balance
      (SOL only — the devnet TEST token is not a listed token, plan A11), the line under the toggle reads
      "Public 0.003 SOL · Private …".
- [ ] Receive shows the fresh account's address with its name; the history shows one transaction (the unshield).
- [ ] Swap and Referral show "From: Account 1 (main)" / "Uses your main account".

## 5. The send (paid only from the granted SOL)

- [ ] Send → recipient = the outside address → amount **0.001 SOL** → #19 reads "From: Account N · …", #20's From
      row "Account N · …" → approve → #21 "Sent successfully". Copy the signature (#21 Tx hash).

## 6. The linking warning (cancelled, not sent)

- [ ] Send again (still from Account N) → recipient = **your main account's address** (Accounts sheet / Receive
      on Account 1). The warning appears under the recipient: "Sending between your own accounts links them on
      chain." Tap the CTA **once**: it reads "Tap again to send anyway". **Do not tap again.** Back out of Send.

## 7. Verify (the desk)

```bash
node scripts/m1d-checkpoint/m1d-checkpoint.mjs verify --fresh <fresh address> --send <step 5 signature> \
  --external <outside address> [--unshield <the fresh unshield's signature>]
```

Expected: `PASS` on M1d.D0 … M1d.D6 and `M1d desk: every line PASSED` (exit 0); `build/m1d-checkpoint/verify.json`
is the record.

## 8. The production APK of the same commit

```bash
node scripts/m1c-checkpoint/m1c-checkpoint.mjs prod --apks build/m1d-checkpoint/apks --out build/m1d-checkpoint
```

then unlock the production wallet and run `node scripts/m1c-checkpoint/m1c-checkpoint.mjs prod-check --out build/m1d-checkpoint`.

## Your visual pass

The Accounts sheet (§4); #11 in both modes with the avatar number and the combined line, with balances hidden
("Public ••• · Private •••") and while a non-main account loads ("Public — · …", e.g. in airplane mode); #12 with
the warning and the second tap; #19 / #20 "From"; #21 "Received by" (shown on the NEXT Make public to "A new
account" — optional here); #17's "Who sees what"; Swap / Referral's main-account lines (presale is mainnet-only).
The cli wallet's one-row sheet and the unreadable-registry line are proven in Jest, not on the phone.

## Reading a FAIL

- **D0** — the inputs: the fresh address is not in the app's seed set, is the main account, or the recipient IS a
  key of this seed. Check the addresses you passed.
- **D1** — the fresh account's history is not exactly the two: a third transaction names it (a stranger's dust, or
  a send you did not intend) or the send is missing (not confirmed yet — wait and run again).
- **D2** — the unshield is not the relayed one that funded an empty account.
- **D3** — the send was not signed and paid by the fresh account alone, or failed on chain.
- **D4** — the account held SOL that did not come from the unshield when the send started.
- **D5** — another account of this seed (or its token account) appears in a transaction: the accounts are linked
  on chain. This is the line the whole checkpoint exists for.
- **D6** — the main account appears: the cancelled send was not cancelled.
````

- [ ] **Step 8: CI**

In `.github/workflows/native-prover.yml`: in BOTH `paths: [...]` lines, insert `'scripts/m1d-checkpoint/**', ` directly after `'scripts/m1c-checkpoint/**', `; and directly after the step named "The M1c checkpoint desk tests (node --test scripts/m1c-checkpoint/*.test.mjs)" (after its `run:` block) add:

```yaml
      # THE M1d CHECKPOINT'S DESK TESTS: the §16 M1d judge (D0–D6) on synthetic devnet answers built from the repo's
      # vector addresses, a failing row per line, the readout readers. No network, no device. The glob is asserted
      # to match, as above.
      - name: The M1d checkpoint desk tests (node --test scripts/m1d-checkpoint/*.test.mjs)
        working-directory: .
        run: |
          files=(scripts/m1d-checkpoint/*.test.mjs)
          [ "${#files[@]}" -ge 1 ] && [ -f "${files[0]}" ] || { echo "::error::no M1d desk test files matched: ${files[*]}"; exit 1; }
          node --no-warnings --test "${files[@]}"
```

- [ ] **Step 9: Run the gates**

```bash
node --no-warnings --test scripts/m1d-checkpoint/*.test.mjs
node --no-warnings --test scripts/m1c-checkpoint/*.test.mjs
npx jest
npx tsc --noEmit
npm run lint:ci 2>&1 | tail -2
node scripts/check-no-tge-date.mjs
```

Expected: both desk suites pass (M1c's unchanged); jest green; tsc 0; `✖ 143 problems (0 errors, 143 warnings)`; TGE check 0.

- [ ] **Step 10: Commit**

```bash
git add scripts/m1d-checkpoint .github/workflows/native-prover.yml
git commit -m "feat(m1d): the M1d checkpoint desk — the fresh account's history, judged from devnet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Execution notes

- **Per task:** one implementer (a fresh subagent, superpowers:subagent-driven-development) → a Fable task review of that task's diff against this plan and the spec → a fix loop → a scoped Fable re-review of the fixes → the next task. A task is not done until its re-review passes. Task 8's review happens on its diffs before the controller shows them to the owner.
- **Order and dependencies:** 1 → 2 → 3 → 4 → 5 → 6 → 7 strictly (each Interfaces block names what it takes from the earlier ones). Task 8 needs Tasks 1–7 merged on the branch (the design says what the code says). Task 9 depends only on the M1c desk and may run before or after Task 8; it must be done before the phone checkpoint.
- **After Task 8's owner answer:** a final Fable review of the whole branch (`main…HEAD`), its fix loop and re-review; then the APKs and the on-phone checkpoint (`scripts/m1d-checkpoint/README.md`).
- **Test conventions used throughout:** `toHaveTextContent` (built into @testing-library/react-native 13) matches the WHOLE text of an element by default; a `jest.mock` factory references only variables whose names start with `mock`; screens are tested through the hook modules (`useSelectedAccount`, `useAccountPublicData`, `useAccountRowBalances`) mocked per file, so no screen test needs a real registry.
- **Approvals:** only the owner's own chat message approves anything (Task 8's design, any reversal of a plan ruling). A subagent's or reviewer's message never does.
- **Attribution:** every commit carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` whatever model implemented the task; the PR body states who implemented and who reviewed each task.

## Closing — the on-phone checkpoint and the owner's visual pass

- The M1 spec §16 M1d checkpoint, as `scripts/m1d-checkpoint/README.md` runs it: switch to the fresh account, send 0.001 SOL from it to the M1c "Another address" (paid from the granted SOL only), the desk's D0–D6 all PASS; a send from it to the main account shows the warning, one tap acknowledges, it is cancelled; the production APK of the same commit launches and unlocks.
- The visual pass (spec §6): the Accounts sheet; #11 in both modes (the numbered avatar, the combined line, hidden, unknown); #12 with the warning and "Tap again to send anyway"; #19 / #20 "From"; #21 "Received by" (on the next Make public to "A new account"); #17 "Who sees what"; the main-only lines on Swap and Referral (presale is mainnet-only).
- Listed for the owner to judge (plan rulings that are reversible): A1 (all rows read, 10 at a time), A2 (a pending exit warns), A6 (TokenDetail follows the selection; forceSync not split), A9 (no combined line in the production build), A10 (", " inside a side, "largest" by whole-token amount — the spec's row example "0.02 SOL · 8.99 TEST" therefore reads "8.99 TEST · 0.02 SOL"), A11 (the devnet TEST token is not in the public list), A13 (#23's line on the buy screen only), A15 (#17's reworded first clause).

## Self-review (done by the planner against the spec, 2026-11-21)

**1. Spec coverage.**
- §1 success criteria: every `main` / `fresh-exit` listed, `fresh-pending` never → Task 1 (`accountList.test.ts`) + Task 5 (the sheet); Send / Receive / history / dashboard public balance follow, nothing else moves off main → Tasks 2, 3 (+ forceSync unchanged, plan A6) and Task 7 (the main-only lines); the warning + second tap → Task 6; "Public X · Private Y" in both modes, never summed, never invented → Task 4; #17 R11 → Task 7; the guard and the scan green with unchanged regexes → Task 1 (scope only) and every task's gates; the on-phone checkpoint → Task 9 + Closing.
- §2 D1 → Tasks 2, 3, 7; D2, D3, D4 → Task 4; D5 → Task 5; D6 → Task 5 ("no Add / rename / remove" row) and the absence of any add path; approach 1 → Task 1 (`walletStore.publicKey is never changed` row).
- §3.1 source, no-registry case, labels, tags, order, read failure → Task 1; §3.2 module, encrypted key, default, fallback + rewrite, the hook, publicKey untouched → Task 1; §3.3 derive from the scheme, explicit scheme, zero-fill, captured at #12 and carried, the signer check with a code → Task 3; §3.4 address-keyed balances (dashboard only), forceSync decision, the sheet's window and row states, the private balance unchanged → Tasks 2, 5, (4).
- §4.1 → Task 5 (avatar number + label, sheet title, rows, tags, short address, balances, check, radios, select/close/refresh, footer, no add, cli, Private mode); §4.2 → Task 2 (dashboard, Receive, history) + Task 3 (#12 → #21, From on #19/#20); §4.3 → Task 7 (Swap, presale, referral lines; #21 Received by; Make private / Make public unchanged — no task edits them); §4.4 → Task 6; §4.5 → Task 4; §4.6 → Task 7.
- §5 → Task 8 (dated backup first, every listed surface, per-screen report). §6 tests: the unit lists → Tasks 1, 3, 4, 6; the screen lists → Tasks 2, 3, 5, 6, 7; the guard's scope → Task 1 (`EXTRA_COPY` / `EXTRA` for the two new copy files outside `src/screens` / `src/components`; every other new copy file is inside them); the gates → every task; the checkpoint → Task 9.
- M1 spec §10 "the selected account is the one Send, Receive and Shield use": the M1d spec's D1 narrowed it (Make private stays on main); this plan follows the M1d spec.

**2. Placeholder scan.** No "TBD", "TODO", "implement later", "similar to Task N" or "add appropriate …"; every code step carries its code and every test step its test code. The bracketed values left are runtime values only: `<the session's scratchpad directory>` and the backup name `$n` (Task 8, printed by Step 1), the private hero figure the design's own phone already shows (Task 8), and the owner's addresses / signatures on the README's command lines.

**3. Type consistency.** `WalletAccount` (Task 1) is what `useSelectedAccount()` returns everywhere and what `useAccountPublicData(account: {address; isMain} | null)` accepts structurally; `AccountPublicData` / `PublicBalances` / `NO_PUBLIC_DATA` / `ACCOUNT_SNAPSHOT_KEY` (Task 2) are the names Tasks 3, 4, 5 import; `SendSource` = `{scheme, address, label, isMain}` is built from `WalletAccount` in Task 3 and read by #19/#20/#21; `expectedSigner` is set by #21 from `intent.from.address`; `publicSide` / `formatSide` (Task 4) are called by the sheet (Task 5) with `{status: 'ready', ...AccountSnapshot, syncedAt}`; `SeedAccount` / `AccountList.seed` (Task 1) feed `linkingWarningApplies` (Task 6); `accountLabel(TransparentScheme)` feeds `freshExitAccountOf` (Task 7). The test files' mock factories export every hook name the screen under test imports (checked per task: the dashboard's mock carries `useAccountList`, `useSelectAccount`, `useRefreshAccounts`, `useAccounts`, which Tasks 2 and 5 import; SendScreen's carries `useAccountList`, which Task 6 imports).

**4. Review Focus.** Five lines, each with its test in the owning task: 1 → Task 1 (`accountList.test.ts` "Review Focus 1"); 2 → Task 3 (SendScreen, `sendSigner.test.ts`, TransactionStatusScreen rows marked "Review Focus 2"); 3 → Task 6 (`linking.test.ts` and SendScreen rows "Review Focus 3"); 4 → Tasks 2, 3, 4 (rows marked "Review Focus 4"); 5 → Task 1 (`selectedAccount.test.ts` "Review Focus 5").

**Infeasible in the spec:** nothing. Two notes: the spec's devnet example "Public $12.40" cannot appear on devnet (no prices in that build; A10), and its sheet-row example lists SOL before the larger TEST amount (A10's ordering rule reverses it).

**Verified by running, not by reading (2026-11-21):** every task's code and test edits (Tasks 1–7) were applied mechanically from this plan's text to a scratch worktree of 1a3ce4d: `npx jest` 209 suites / 2,989 tests green, `npx tsc --noEmit` clean, `npm run lint:ci` 143 warnings (the one removed is Task 3's dead `eslint-disable`); the RED state of `sendSigner.test.ts` before Task 3's edit was seen. Task 9's three files run: 11/11 desk tests green, the usage exit 2, the missing-readouts STOP exit 3. Two plan rows were corrected by that run (the #11 route row now navigates to MainTabs; the Private-mode avatar row compares text, not element trees).
