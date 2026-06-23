# Referral Screen (#24) — Design

**Status:** Approved (brainstorming). **Date:** 2026-06-23. **Repo:** NocturaWallet. **Branch:** `feat/referral-screen`.

## Context

Cycle #4 = "referral". Scope (decided in brainstorming): **A — the read-only #24 "Refer a friend" screen only.** Applying a referrer in the buy flow (part B) is deferred — the on-chain 10% bonus is first-purchase-only and the user's wallet already purchased, so B is unverifiable without a fresh wallet.

A non-functional **stub already exists** at `src/screens/referral/ReferralScreen.tsx` and is registered (unreachable) in `DashboardStack`. This cycle **rewrites that stub to the real design + data** and removes the dead code it relied on.

### Findings that bind this design (from ICO-repo research)
- **Referrer identity = wallet ADDRESS, not a code.** The alphanumeric `referral_links` code table is dead everywhere. The website shares `https://noc-tura.io?ref=<address>`. → The wallet's "invite link" is the address-based URL; the stub's `generateReferralCode` ("NOC-xxxx") is wrong and gets deleted.
- **Real program = PRESALE referral, not staking.** On-chain: flat **10%** one-time to the referrer (from a 12.8M pool); off-chain coordinator records a tiered **10–30%** extra for buys ≥ $100 (admin-allocated later). The `index.html` #24 mockup's "5% of stake rewards / per epoch" does NOT exist. ⚠️ **Flagged divergence** — we map the mockup's structure onto real presale-referral data.
- **Live data source:** `GET /api/v1/referral-stats/<address>` → `{ success, data: { totalReferrals, totalBaseBonusNoc, totalExtraBonusNoc, totalBonusNoc, totalReferredNoc, totalReferredUsd, tierBonusCount } }`. All `data.*` are plain numbers (NOC in display units, USD in dollars), not base units. Aggregates only — **no per-referral list, no names/dates.**

## A. Screen — `src/screens/referral/ReferralScreen.tsx` (rewrite)

Built with the design system (NativeWind classes + `Text` variants + `accent-transparent` violet), mirroring `index.html` #24 structure. Keeps the existing `{onBack?}` prop.

1. **Top bar:** back (`onBack`) + title "Refer a friend".
2. **3 stat cards** (overline label + `balance-md` numeral value + caption):
   - `REFERRALS` → `totalReferrals` · "total joined"
   - `EARNED` → `totalBonusNoc` (NOC, 2dp, accent) · "NOC lifetime"
   - `REFERRED` → `totalReferredUsd` (USD) · "from your invites"  ⚠️ *replaces mockup's "ACTIVE · staking now" (no data source)*
3. **Invite-link card** "YOUR INVITE LINK": label row + "Used {totalReferrals} times"; the link shown truncated/mono; **Copy** button (Clipboard + brief "Copied" confirmation, no auto-clear — a link isn't sensitive); **Share invite link** button → `Share.share({message})` with `https://noc-tura.io?ref=<address>`.
4. **Info banner** (real bonus copy): "Earn **10%** in NOC when someone buys with your link — up to **30%** on larger buys." ⚠️ *replaces mockup's "5% of stake rewards · per epoch".*
5. **Legalese caption:** "Referral payouts are subject to program terms. Self-referrals are detected and rejected." (kept from mockup — accurate).
6. ⚠️ **"Recent rewards" list OMITTED** (no data source). Deferred until a backend referral-list endpoint exists.

### States
- **loading:** while the stats query is pending → stat values show a skeleton/`—`; the link card + banner render immediately (link needs no backend).
- **empty** (`totalReferrals === 0`, the user's current state): stats show `0`/`$0`; link card + banner still shown (encourages sharing).
- **error** (stats fetch fails): stat values show `—`; link card + banner still render. Never blocks.
- **no wallet** (`publicKey == null`): defensive — show nothing actionable / `—` (shouldn't happen in the dashboard flow).

## B. Data — `src/modules/referral/referralModule.ts` (new)

- `interface ReferralStats { totalReferrals; totalBaseBonusNoc; totalExtraBonusNoc; totalBonusNoc; totalReferredNoc; totalReferredUsd; tierBonusCount }` (all `number`).
- `fetchReferralStats(address: string): Promise<ReferralStats>` — `GET /referral-stats/<address>` via the shared coordinator client (pinned→fallback). Throws on `!success`/missing data; coerces each field via `Number(... ?? 0)` so a partial payload can't NaN the UI.
- `buildReferralLink(address: string): string` → `https://noc-tura.io?ref=<address>` (pure).
- Consumed by the screen via a TanStack Query (`['referralStats', address]`, `enabled: address!=null`, staleTime 60s, retry 1).

### Shared coordinator client — `src/modules/backend/coordinatorClient.ts` (new)
Extract the existing private `getCoordinatorJson` from `presaleModule.ts` into a shared module (pinned `GET` → plain-`fetch` fallback to the same URL). `presaleModule` imports it (behavior unchanged); `referralModule` reuses it. Avoids duplicating the fallback logic.

## C. Navigation / entry point

- **Move** the `Referral` screen registration from `DashboardStack` → `SettingsStack` (it's currently unreachable in DashboardStack; the entry lives in Settings/ProfileTab, so same-stack navigation + back→Settings works and matches the design). Update `SettingsStackParamList` (+ remove `Referral` from `DashboardStackParamList`).
- Add a **NavRow "Refer a friend"** in `SettingsScreen` (new "Rewards"/"General" grouping or under an existing section) → `navigation.navigate('Referral')`.

## D. Dead-code cleanup

- Delete `src/utils/generateReferralCode.ts` + `src/utils/__tests__/…` (only the stub used it).
- Remove `MMKV_KEYS.REFERRAL_CODE_MINE` and `REFERRAL_CODE_APPLIED` (only the stub's local "apply code" used them — that flow is removed; applying a referrer is part B / future).
- The stub's local MMKV "apply a code" UI is dropped entirely (did nothing on-chain).

## E. Testing

- `referralModule`: `buildReferralLink` exact string; `fetchReferralStats` parses a success payload, coerces missing fields to 0, throws on `success:false`.
- A pure `referralStatsDisplay(stats)` helper (→ `{referrals, earnedNoc, referredUsd}` strings) unit-tested (zero, populated, fractional NOC).
- Rewrite `ReferralScreen.test.tsx`: renders title + 3 stats from a mocked query; Copy calls Clipboard with the link; Share calls `Share.share` with the `?ref=` URL; empty state renders link card at 0 referrals.

## Out of scope (flagged)
- Part B (apply a referrer in the buy flow + `register_referrer`) — unverifiable on the already-purchased wallet; later cycle with a fresh wallet.
- Recent-rewards list — needs a backend referral-list endpoint (added to the backend contract doc later).
- Tier-bonus "pending/claimable" breakdown UI; on-chain memcmp referral discovery.
