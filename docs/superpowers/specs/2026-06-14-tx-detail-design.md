# #27 tx-detail (real on-chain data + index.html §27 design) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-14
**Branch:** `feat/tx-detail` (stacked on `feat/tx-status-broadcast` / PR #15 — both touch `queries.ts`)

## Goal

Make `TransactionDetailScreen` (#27, reached via #21 "View details") show the REAL transaction (fetched from chain) and match the user's design (`/home/user/Downloads/index.html` §27 `.s-txd`, `screen.md` §27). Today it looks the tx up in the (empty) local history → From/To blank, Fee "0 lamports", date = now, and it uses the old hand-rolled `StyleSheet`.

## Why

On-device: "View details" opened a stub — `transactions.find(t => t.signature === signature)` over `useTransactionHistory` (which doesn't contain a just-sent tx) returns null, so the screen renders placeholders. It is also the old visual (hardcoded hex `StyleSheet`), not the DS / §27. Per CLAUDE.md "Design — Source of Truth", build it to `index.html` §27.

## Data — fetch the tx directly

New `getTransactionDetail(connection, signature)` in `src/modules/solana/queries.ts` → `connection.getParsedTransaction(signature, {maxSupportedTransactionVersion: 0})` → parse into:
```ts
export interface TxDetail {
  signature: string;
  status: 'confirmed' | 'finalized' | 'failed';
  type: string;            // 'Send' (SOL/SPL transfer) | 'Transaction' (other)
  from: string;            // fee payer (accountKeys[0])
  to: string | null;       // first transfer destination that is NOT the fee treasury
  amount: string | null;   // human, from that transfer's lamports/amount
  tokenSymbol: string;     // 'SOL' | 'NOC' | '' 
  feeLamports: bigint;     // meta.fee
  slot: number;            // tx.slot
  blockTime: number | null;// tx.blockTime (unix seconds, UTC)
  memo: string | null;     // Memo-program instruction data, if present
}
```
Parsing (robust, best-effort):
- `feeLamports = BigInt(meta.fee)`, `slot = tx.slot`, `blockTime = tx.blockTime ?? null`, `status = meta.err ? 'failed' : (the confirmation status; default 'confirmed')`.
- `from = message.accountKeys[0].pubkey` (the fee payer / signer).
- Walk parsed instructions for the FIRST `system`/`transfer` (or `spl-token`/`transferChecked`) whose `info.destination`/`info.recipient` is NOT `NOCTURA_FEE_TREASURY` → set `to` + `amount` (`info.lamports` → SOL via `formatTokenAmount(.., 9)`, or `info.tokenAmount.uiAmountString` for SPL) + `tokenSymbol` (`'SOL'` for system, `'NOC'` when mint === `NOC_MINT` else `''`). `type = 'Send'` if found, else `'Transaction'`.
- `memo` = the `spl-memo` instruction's parsed string, if any.
- On any parse gap, leave the field null/'' (never throw); the row shows '—'.

Returns `null` if `getParsedTransaction` returns null (tx not yet visible) — the screen retries via React Query.

## Screen — `TransactionDetailScreen` rewrite (NativeWind + components/ui, §27 `.s-txd`)
Props stay `{signature: string; onBack?: () => void}`. Replace the history-lookup + `StyleSheet` with:
- A query: `useTransactionDetail(signature)` hook (in `src/hooks/useSolanaQueries.ts`, mirroring the existing hooks) wrapping `getTransactionDetail`, with `refetchInterval` ~4 s until it resolves non-null (handles "just sent, not indexed yet").
- **States:** loading (centered spinner + "Loading transaction…"), error/not-found ("Couldn't load this transaction" + [View on explorer] + [Back]), ready.
- **Ready layout** (`SafeAreaView bg-bg-base`, top bar with back + "Transaction"):
  - **Amount card** (`bg-bg-surface-1 rounded-2xl p-6 items-center`, subtle accent radial tint): eyebrow ("Sent" / "Transaction"), amount (`{amount} {tokenSymbol}`, large `text-fg-primary`), then a **status pill** (success-tinted "Confirmed"/"Finalized" with Check, or danger-tinted "Failed" with X). (Fiat line deferred — gap #2.)
  - **Detail card** (`bg-bg-surface-1 rounded-lg px-5`): rows (`flex-row justify-between py-3 border-b border-bg-surface-2`, last no border): **Type**, **Status**, **From** (mono + checksum first6/last6 accent), **To** (mono + checksum), **Hash** (mono truncated + a Copy button), **Block** (slot, numeral), **Network fee** (`{formatTokenAmount(feeLamports, 9)} SOL`), **Memo** (only when present). Missing values render '—'.
  - **Actions** (sticky): `[View on explorer]` (secondary → `Linking.openURL(getExplorerUrl(signature))`) + `[Save to address book]` (primary → `addressBook.addContact({name: formatAddress(to), address: to, addressType:'transparent', lastUsedAt: Date.now()})`, shown only when `to` exists and is not already a contact).
- Checksum highlight reuses `formatChecksumParts` from `src/modules/solana/transferRisk.ts` (built for #20).
- Copy uses `@react-native-clipboard/clipboard` + 30 s auto-clear (the project pattern).

## Components & files
- `src/modules/solana/queries.ts` — ADD `getTransactionDetail` + `TxDetail`.
- `src/hooks/useSolanaQueries.ts` — ADD `useTransactionDetail(signature)`.
- `src/screens/transparent/TransactionDetailScreen.tsx` — REWRITE (data + DS render). Drop the old `StyleSheet`/history-lookup.

## Error handling
- `getParsedTransaction` null → query returns null → screen shows loading then (after a few retries / a max wait) the not-found state with explorer fallback.
- Parse never throws (best-effort; missing → '—').
- `addContact` wrapped in try/catch; dedupe via `addressBook.findByAddress`.

## Testing
- `queries.test.ts`: `getTransactionDetail` parses a mocked `getParsedTransaction` (a SOL transfer with a recipient + a fee-markup transfer) → `to`/`amount` are the recipient (NOT the fee treasury), `feeLamports`/`slot`/`status` correct; a tx with `meta.err` → `status: 'failed'`; `getParsedTransaction` null → returns null.
- `TransactionDetailScreen.test.tsx`: mock the hook to return a `TxDetail` → renders amount, the From/To/Hash/Block/Network-fee rows, and the status pill; mock loading → spinner; mock null → not-found state.

## Out of scope (deferred — not silently dropped)
- Fiat `≈ $USD` in the amount card (gap #2 — no price feed yet).
- Shielded variant (mode accent + ShieldGlyph, gated behind `FEATURES.shielded`).
- Rich parsing of arbitrary non-transfer txs (swaps, program calls) — those show Type "Transaction" + status/hash/fee/block only.
- #28 token-detail, #44 tx-failed, #54 stuck-tx (separate screens).
