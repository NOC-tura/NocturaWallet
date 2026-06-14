# #21 tx-status Broadcast Relocation + Richer States — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-13
**Branch:** `feat/tx-status-broadcast` (stacked on `feat/tx-confirm-safety-gate` / PR #14)

## Goal

Move the transparent broadcast + confirmation wait OUT of the #20 Confirm screen (where it currently sits behind a bare Send-button spinner) and INTO the #21 tx-status screen, and build #21's richer states from the design (`/home/user/Downloads/index.html` §21, `screen.md` §21): **broadcasting → success → failed → stuck**. This is gap #4 of the transparent-path design completion.

## Why (the on-device finding)

A 0.01 SOL send was slow on 2026-06-13. Evidence (systematic-debugging, screenshot `1.jpg`): the wait happened on the **#20 Confirm screen with a spinning Send button** — because `TxConfirmScreen.handleSend` calls `sendTransparentTransfer` (which `signAndSend`s, awaiting WS `confirmTransaction` up to 60 s) and only navigates to #21 AFTER confirmation. The code is unchanged from the merged #13/#14 work — the slowness was environmental (WS confirmation latency + a 0-priority-fee tx under congestion). But the flow has a real UX weakness: the user gets no "Broadcasting…" feedback during the wait, and the WS `confirmTransaction` path is the slow one. This redesign fixes both.

## Approach (approved)

- **Submit → poll** (not send+confirm): #21 submits the tx (returns the signature fast, no confirm wait) then polls `getSignatureStatus` over HTTP (measured ~220 ms, fast) — this avoids the slow WS `confirmTransaction` entirely.
- **In-place stuck/failed** on #21 (the separate #54 stuck-tx / #44 tx-failed screens are deferred).

## Flow

```
#20 [Send] → auth (UnlockSend modal) → on approved: navigate to #21 with the TransferIntent (no broadcast on #20)
#21:  submitting → submitTransparentTransfer(intent) → {signature}
      → broadcasting → poll getSignatureStatus (500 ms) → success | failed | stuck (90 s)
```

## Components & files

### Modified
- `src/modules/solana/sendTransaction.ts` — add `submitTransparentTransfer(params): Promise<{signature: string}>`: retrieve seed (biometric-gated) → derive keypair with the persisted scheme → build instructions (`buildTransferInstructions`/`buildSPLTransferInstructions`) → `connection.sendRawTransaction(signedTx.serialize(), {skipPreflight: true})` → return `{signature}`. Builds + signs a `VersionedTransaction` with a fresh blockhash (mirror `signAndSend`'s build+sign, minus the confirm loop). Zeroize the secret key in `finally`. Reuse the existing `SendTransparentParams` shape. **Remove `sendTransparentTransfer`** (send+confirm) if grep shows it is no longer referenced after #20 stops calling it; otherwise leave it.
- `src/screens/transparent/TransactionStatusScreen.tsx` — rewrite. New prop: `intent: TransferIntent` (replaces `signature/amount/recipient/token`) + `onDashboard` + `onViewDetails?`. State machine `submitting | broadcasting | success | failed | stuck`. On mount: `submitTransparentTransfer(intent)`; on signature → `broadcasting` + start the poll loop (existing `getSignatureStatus` loop). Render the design's states (below). The 90 s stuck timer flips to `stuck` while polling continues in the background; a later confirm still flips to `success`.
- `src/screens/transparent/TxConfirmScreen.tsx` — `handleSend`: keep the debounce + `awaitUserAuth` + `UnlockSend` navigate; on `approved`, navigate to #21 with `{intent}` and STOP (remove `submitTransparentTransfer`/`signAndSend`, the SOL/SPL branch, the post-send "Add to contacts?" Alert — adding is already handled by the #1 first-time inline Add/Skip). `onSent` prop changes to `onBroadcast(intent: TransferIntent)`.
- `src/app/Navigator.tsx` — `TxConfirmScreenNav.onBroadcast` → `navigation.navigate('TransactionStatus', {intent})`; `TransactionStatusScreenNav` reads `route.params.intent`, passes `onDashboard` (→ MainTabs) + `onViewDetails` (→ explorer/`TransactionDetail`).
- `src/types/navigation.d.ts` — `TransactionStatus` param: `{signature; amount; recipient; token}` → `{intent: TransferIntent}`.

## Screen states (#21 — from index.html §21)
- **broadcasting:** spinner ring + "Broadcasting transaction…" + "Submitted to Solana mainnet · waiting for first confirmation" + amount card (`{amount} {token}`) + To (`formatAddress`) + tx-hash row (truncated) + "View on Solscan" + footer "Don't close the app · this usually takes 8–12 s" / "If this fails, your funds stay in your wallet — no fees are charged until the network accepts the transaction." No back button.
- **success:** green tick ring + "Sent successfully" + amount card + meta rows **Tx hash · Slot · Fee paid** (fee paid = base + priority lamports for the chosen tier) + [View details] (→ explorer) + [Done] (→ dashboard).
- **failed:** ✗ ring + "Transaction failed" + mapped reason (`ERROR_CODES`) + [Retry] (re-submit) + [Done].
- **stuck:** warning ring + "Taking longer than usual" + "Network is congested · the tx is in the mempool but hasn't been included yet" + tx-hash + "View on Solscan" + [Done]. (No #54 redirect — in-place.)

## Data flow
`TransferIntent` (already defined) carries recipient/amount/tokenMint/symbol/decimals/priorityLevel/createAta. `submitTransparentTransfer` needs the persisted scheme (`loadTransparentScheme`). Fee-paid display = `formatTokenAmount(BASE_FEE_LAMPORTS + PRIORITY_FEE_LAMPORTS[intent.priorityLevel], 9)` (no fiat — that's gap #2). Slot from the `getSignatureStatus` result (`value.slot`) or `getSignatureStatuses`.

## Error handling
- Submit (sign/send) throws → `failed` with `err.message`.
- Poll sees `value.err` → `failed` with a mapped `ERROR_CODES` message (reuse the existing mapping).
- 90 s without confirmation → `stuck` (NOT a hard failure; the tx may still land — keep polling; a late `confirmed`/`finalized` flips to `success`).
- During `submitting`/`broadcasting`/`stuck`: no back affordance is rendered (predictive-back hardening via native `OnBackInvokedCallback` is deferred — out of scope).

## Testing
- `submitTransparentTransfer` unit test: mock `KeychainManager.retrieveSeed` + `connection.sendRawTransaction` (returns a signature); assert it returns `{signature}` and does NOT call `confirmTransaction`. Use the `abandon…about` seed + cli scheme (deterministic, like the existing `sendTransaction.test`).
- `TransactionStatusScreen` tests: mock `submitTransparentTransfer` + `getConnection().getSignatureStatus`. Assert: broadcasting renders after submit resolves; success renders when status → `confirmed`; failed renders when submit throws; failed renders when status `value.err` is set. (Stuck timer can be a smoke check or fake-timers; keep it light if flaky.)

## Out of scope (deferred — NOT silently dropped, per [[feedback_build_to_index_html_design]])
- Separate **#54 stuck-tx** and **#44 tx-failed** screens (handled in-place on #21 for now).
- iOS **Dynamic Island / Live Activity** (design §G annotation).
- **Shielded #21** variant (gated behind `FEATURES.shielded`).
- **Blockhash-expiry auto-resubmit** (the stuck state covers the never-confirmed case; resubmit-on-expiry is a later robustness add).
- Fiat USD values (gap #2), priority chip strip (gap #3).
