# #20 tx-confirm Safety Gate (high-value typed-confirm + first-time + checksum) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-12
**Branch:** `feat/tx-confirm-safety-gate`

## Goal

Bring `TxConfirmScreen` (#20) up to the design (`/home/user/Downloads/index.html` §20, `screen.md` §20) for the safety-critical pieces it currently omits: a **high-value typed-confirm gate**, an inline **"Add to address book?"** prompt on first-time recipients, and **first-6/last-6 checksum highlighting** of the recipient address. This is gap #1 of the transparent-path design completion. Fiat values (#2), priority chip strip (#3), and #21 richer status (#4) are separate later cycles. Shielded variants stay deferred ([[feedback_build_to_index_html_design]]).

## Background / current state

`TxConfirmScreen.tsx` currently renders: headline "Send {amount} {symbol} to {formatAddress}", detail rows (Network/Fee/Priority/From/To), an informational first-time-recipient callout, and `[Send]`/`[Cancel]`. The broadcast path (auth → `sendTransparentTransfer` → `onSent` → #21) works and is on-device verified — **it must not change**. This adds a gating layer in front of it.

## Design rules (from index.html §20 / screen.md)

- **High-value threshold:** a transfer is high-value when `amount > 5% of the sent token's balance` OR (token is SOL AND `amount > 5 SOL`). Per-token: SOL uses `solBalance`; SPL uses `tokenBalances[tokenMint]`.
- **High-value gate:** red 1px border on the review card + a "High-value transfer" warning banner showing `{percent}% of your balance` + a typed-confirm `TextInput`. The `[Send]` CTA is DISABLED until the input is exactly `CONFIRM` (case-sensitive equality, no whitespace tolerance — pasted text with leading/trailing space stays disabled). `autoCapitalize="characters"`, `autoCorrect={false}`.
- **First-time recipient:** informational only (NOT a gate — CTA stays enabled). Keep the existing banner; add an inline "Add to address book? · Add · Skip" row. Add → `addressBook.addContact(...)`; Skip dismisses the prompt.
- **Checksum highlight:** render the recipient (in the headline and the To detail-row) with the first 6 and last 6 characters in the accent color (the `.ck` convention), the middle elided.

## Components & files

### New
- `src/modules/solana/transferRisk.ts` — pure risk/format helpers (testable, no RN/UI):
  ```ts
  import {parseTokenAmount} from '../../utils/parseTokenAmount';
  import type {TransferIntent} from '../../types/transfer';

  const SOL_HIGH_VALUE_LAMPORTS = 5_000_000_000n; // 5 SOL
  const HIGH_VALUE_PERCENT = 5n;                   // > 5% of balance

  export interface HighValueResult {
    highValue: boolean;
    percentOfBalance: number; // rounded for display; 0 when balance unknown/zero
  }

  /** balances: SOL in lamports + SPL token balances keyed by mint (smallest unit). */
  export function isHighValueTransfer(
    intent: TransferIntent,
    balances: {solBalance: bigint; tokenBalances: Record<string, bigint>},
  ): HighValueResult {
    const amount = parseTokenAmount(intent.amount, intent.decimals);
    const isSol = intent.tokenMint === 'native';
    const balance = isSol ? balances.solBalance : (balances.tokenBalances[intent.tokenMint] ?? 0n);
    const overPercent = balance > 0n && amount * 100n > balance * HIGH_VALUE_PERCENT;
    const overAbsolute = isSol && amount > SOL_HIGH_VALUE_LAMPORTS;
    const percentOfBalance = balance > 0n ? Number((amount * 100n) / balance) : 0;
    return {highValue: overPercent || overAbsolute, percentOfBalance};
  }

  /** First-6 / last-6 of a base58 address for accent highlighting. */
  export function formatChecksumParts(address: string): {head: string; tail: string} {
    if (address.length <= 12) return {head: address, tail: ''};
    return {head: address.slice(0, 6), tail: address.slice(-6)};
  }

  export const TYPED_CONFIRM_SENTINEL = 'CONFIRM';
  ```

### Modified
- `src/screens/transparent/TxConfirmScreen.tsx`:
  - Read `solBalance` + `tokenBalances` from `useWalletStore` (verify field names/types; `solBalance` is a string-encoded bigint per the store — coerce with `BigInt(...)`/guard, mirroring how TxSimulateScreen handled it; `tokenBalances` keyed by mint).
  - Compute `{highValue, percentOfBalance}` via `isHighValueTransfer`.
  - State: `typedConfirm: string` (TextInput), `firstTimePromptDismissed: boolean`.
  - Render a `ChecksumAddress` inline sub-component (head accent + "…" + tail accent) used in the headline and To row.
  - First-time block (when `addressBook.findByAddress` is null and not dismissed): existing banner + inline `[Add]`/`[Skip]`.
  - High-value block (when `highValue`): red-border style on the card + warning banner with `{percentOfBalance}% of your balance` + the typed-confirm `TextInput`.
  - `[Send]` `disabled` = `sending || (highValue && typedConfirm !== TYPED_CONFIRM_SENTINEL)`. Everything else (debounce, broadcast) unchanged.

## Data flow
`TransferIntent` (from #19) already carries `recipient/amount/tokenMint/decimals`. Balances come from the wallet store (already populated for the dashboard). No new RPC calls. No fiat (that's #2).

## Error handling
- `addressBook.findByAddress` / `addContact` wrapped in try/catch (already the pattern) — on failure, treat as first-time (cautious) and make Add a no-op that still dismisses.
- Missing/zero balance → `percentOfBalance = 0`, `overPercent = false`; the absolute SOL clause still applies. A high-value gate never blocks incorrectly on unknown balance (fails open to non-gated for the % clause, but the 5-SOL absolute clause still protects large SOL sends).

## Testing
- `transferRisk.test.ts`: SOL >5% of balance → highValue; SOL >5 SOL absolute (even if <5% of a huge balance) → highValue; SPL >5% of token balance → highValue; below both → not; `solBalance = 0n` → not highValue via % but absolute clause still applies for SOL; `formatChecksumParts` head/tail + short-address passthrough.
- `TxConfirmScreen.test.tsx` (extend existing): a high-value intent renders the typed-confirm input and the Send button is disabled; typing `CONFIRM` enables it; a normal-value intent shows no gate; a first-time recipient shows the inline Add/Skip.

## Out of scope (YAGNI / later cycles)
- Fiat USD values (#2), priority chip strip (#3), #21 richer status / stuck-watcher (#4), #19 richer failed-state, all shielded variants.
- Quote-valid countdown (belongs with the fiat/quote work in #2).
