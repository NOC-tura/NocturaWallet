# Presale Allocation Display (Cycle C1) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-22
**Repo:** NocturaWallet.
**Branch:** `feat/presale-allocation-display`.

## Context

Cycle C is the post-TGE presale claim. **TGE is far in the future (≈2027-01-18)** and `claim_presale_allocation` rejects any claim before `config.tge_timestamp`, so the real claim flow can't be tested on mainnet now and would sit unverified (and risk drifting from the final on-chain reality). Per the brainstorming decision, **C1 ships only the safe, useful pre-TGE piece: show the user their purchased presale allocation in the wallet.** The actual claim instruction + gasless submit + the `#23` `claim`/`done` active states + the `tgeStatus` flip are **deferred** to a later cycle built closer to TGE (when it's testable and the on-chain claim is final).

The user already has a purchased allocation (e.g. the verified 0.35 SOL buy). Cycle A populates `presaleStore.tokensPurchased` and `referralBonusTokens` (summed from the coordinator `/user/:address`). C1 surfaces that.

**Decisions (from brainstorming):**
- Show the allocation **without a fixed TGE date** — copy: "claimable after TGE" (no "Jan 18, 2027"). The user didn't want to commit to a date in the UI.
- Therefore **no TGE-timestamp constant** and **no `tgeStatus` change** — `tgeStatus` stays at its default `'pre_tge'`. (Avoids the risk of a hard-coded date wrongly flipping the UI to "claimable.") The TGE source + status flip + claim land in the deferred cycle.

## A. Allocation display — `src/screens/PresaleScreen.tsx` (`PresaleActive`)

Add a compact, read-only allocation card on the presale active (`#23`) screen, shown ONLY when the user has a presale allocation. Mirror the staking pre-TGE position-card style (`index.html` staking #22 pre-TGE banner: an info-tinted card).

- Read from `usePresaleStore()`: `tokensPurchased`, `referralBonusTokens` (both 9-dec base-unit strings).
- `totalAllocationBase = BigInt(tokensPurchased) + BigInt(referralBonusTokens)`.
- Render only when `totalAllocationBase > 0n`.
- Copy: **"You own {formatTokenAmount(totalAllocationBase, 9)} NOC"** (title) + **"Claimable after TGE"** (subtitle, `var(--info)`/secondary). No date.
- If `referralBonusTokens > 0n`, optionally a caption "includes {formatTokenAmount(referralBonusTokens,9)} NOC referral bonus" — keep if it fits the design cleanly, else omit (YAGNI).
- Placement: below the buy form / above the sticky [Buy NOC] (or wherever it reads cleanly per the `#23` layout — the implementer reads `index.html` #23 + the staking pre-TGE card and matches the visual).
- `NOC_DECIMALS = 9`; use the existing `formatTokenAmount` from `utils/parseTokenAmount`.

## B. No other changes

- `tgeStatus` derivation: NOT in C1 (stays default `'pre_tge'`). The `PresaleBanner` claim branch + `PresaleScreen` `claimable`/`claimed` branches remain as-is (dormant until the deferred cycle wires the flip).
- No TGE constant, no `/stats` change, no on-chain reads.

## C. Error handling / states

- No allocation (`totalAllocationBase === 0n`, or store still loading) → the card is simply not rendered (no empty/placeholder).
- Allocation comes from Cycle A's best-effort `/user` sum; if that under-counts (an unrecorded purchase), the display is slightly low — acceptable (consistent with Cycle A's documented trade-off; on-chain `total_tokens` becomes the source of truth in the deferred claim cycle).

## D. Testing

- A small pure helper for the allocation card's display value/visibility (e.g. `presaleAllocationDisplay({tokensPurchased, referralBonusTokens}) → {show: boolean, nocText: string}`), unit-tested: zero → `show:false`; purchased only; purchased + bonus → summed `nocText`. (Mirrors the `canBuy` extract-and-test pattern, since rendering `PresaleActive` pulls in many deps.)

## Out of scope (deferred to a near-TGE claim cycle)

- The `claim_presale_allocation` instruction + submit (self-paid or gasless via the coordinator `/claim/submit` + `/claim/fee-payer`).
- `tgeStatus` flip (needs a real TGE-timestamp source — on-chain `config.tge_timestamp` or a backend field, since `/stats` doesn't expose it).
- The `#23` `claim` / `done` active states + the `PresaleBanner` claim CTA navigation.
- On-chain `claimed` detection; a fixed TGE date in the UI.
