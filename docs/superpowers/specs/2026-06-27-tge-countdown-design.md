# TGE Countdown (Cycle C — TGE part) — Design

**Status:** Approved (brainstorming). **Date:** 2026-06-27. **Repo:** NocturaWallet. **Branch:** `feat/tge-countdown`.

## Context

Cycle C is the post-TGE claim. The **claim transaction is untestable until TGE** (`config.tge_timestamp` = **2027-01-18**, ~7 months out; the program rejects `claim_presale_allocation` before then), so it's deferred to a near-TGE cycle. This cycle ships only the **testable TGE-aware piece**: read the real on-chain TGE timestamp and show a soft **countdown** on the #23 allocation card (replacing the static "Claimable after TGE"). Decision: **countdown only, no hard date** (consistent with the C1 "no fixed date" preference).

**Verified on-chain:** `config` PDA = `["config", ADMIN]`; `Config.tge_timestamp` is an `i64` LE at **byte offset 201** (8 disc + admin/sale/usdt/usdc 4×32 + 4×u64 prices/ratios + current_stage u8 + stage_tokens_sold/tokens_sold/total_usd_raised_cents 3×u64 + presale_start_time i64 @193 → tge_timestamp @201). Value = 1800230400 = 2027-01-18. `derivePresalePdas(user).config` already derives the (user-independent) config PDA.

## A. Read the TGE timestamp — `src/modules/presale/presaleBuyModule.ts`

`fetchTgeTimestamp(): Promise<number | null>` — `getConnection().getAccountInfo(derivePresalePdas(PublicKey.default).config)`; if null or `data.length < 209` → null; else decode the `i64` LE at offset 201 (signed; but TGE is positive so an unsigned read is fine) → return unix **seconds** (number). Catch/short → null. (`config` is user-independent, so any pubkey works for the derive.)

## B. Countdown helper — `src/modules/presale/tgeCountdown.ts` (new)

`tgeCountdownDisplay(tgeSeconds: number | null, nowSeconds: number): string` — pure, friendly relative string, **no hard date**:
- `tgeSeconds == null` or not finite → `''`.
- `diff = tgeSeconds - nowSeconds`; `diff <= 0` → `'now'`.
- `days = diff / 86400`:
  - `>= 60` → `` `in ~${Math.round(days / 30)} months` `` (204 days → "in ~7 months").
  - `>= 14` → `` `in ~${Math.round(days / 7)} weeks` ``.
  - `>= 2` → `` `in ${Math.round(days)} days` ``.
  - `>= 1` → `'tomorrow'`.
  - else → `'today'`.

## C. Store — `src/store/zustand/presaleStore.ts`

Add `tgeTimestamp: number | null` (default `null`) + `setTgeTimestamp(t: number | null)`. (Persisted like the other fields.)

## D. Sync — `src/hooks/usePresaleSync.ts`

Add a query `['tgeTimestamp']` → `fetchTgeTimestamp()` (`staleTime: 60 * 60_000` — it ~never changes; `retry: 1`), and an effect writing `setTgeTimestamp(data)` when defined.

## E. #23 allocation card — `src/screens/PresaleScreen.tsx` (`PresaleActive`)

Replace the static `Claimable after TGE` (line ~471) caption:
- `const tgeTimestamp = usePresaleStore(s => s.tgeTimestamp);`
- `const countdown = tgeCountdownDisplay(tgeTimestamp, Date.now() / 1000);`
- Copy: `countdown ? \`Claimable ${countdown}\` : 'Claimable after TGE'` → e.g. "Claimable in ~7 months"; `'now'` → "Claimable now"; null (not yet loaded) → falls back to "Claimable after TGE".

## Out of scope (deferred to the near-TGE claim cycle)
- The `claim_presale_allocation` tx (disc `[100,176,47,202,135,93,149,105]`; accounts config/user_allocation/ico_ata_for_ico_program/ico_ata_for_user/ico_mint/user(signer)/token_program) + the gasless path (coordinator `claim/fee-payer` is live → `{feePayer, gasless:true}`, `claim/submit`).
- The `tgeStatus` flip to `claimable` + the `#23` claim/done states + the `PresaleBanner` claim CTA. These ship TOGETHER with the claim tx (so the claimable state never shows a non-functional claim button). `tgeStatus` stays `pre_tge` this cycle.

## Testing
- `tgeCountdownDisplay`: null→''; diff 204d→"in ~7 months"; 21d→"in ~3 weeks"; 5d→"in 5 days"; 1.5d→"tomorrow"; 0.5d→"today"; past→"now".
- `fetchTgeTimestamp`: crafted ≥209-byte buffer with 1800230400 @201 → 1800230400; short/null → null. (Mirror `fetchOnChainAllocation`'s connection-mock test pattern.)

## On-device
- #23 allocation card shows **"Claimable in ~7 months"** (instead of "Claimable after TGE"). Verifiable now (the read + countdown are live; only the claim action is deferred).
