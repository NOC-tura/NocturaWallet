# Geo-gate on Presale Buy (#3) — Design

**Status:** Approved (brainstorming). **Date:** 2026-06-23. **Repo:** NocturaWallet. **Branch:** `feat/geo-gate`.

## Context

Cycle #3 = MiCA jurisdiction gating for the presale **buy** flow + the geo-blocked screen **#50**. The `geoFenceModule` (`GeoFenceManager`) already exists with full classification (bundled restricted list, VPN flag, fail-open, `setKycCountry()` override) but is **wired nowhere** and only ever considered shielded (`transparentAllowed` always true). The presale "Not available in your region?" link is a placeholder `Alert`. There is no geo-blocked screen yet.

**Policy (user decision, OFAC-only):** block presale buy only for `sanctioned` countries (CU/IR/KP/SY/RU). `restricted` (CN/MM/BY/VE/ZW) and VPN → **warn** (buy allowed). This maps exactly to the existing `checkJurisdiction()` result: `action === 'block'` ⇔ sanctioned. So no classification change is needed.

**⚠️ Dependency / fail-open:** automatic IP detection needs the backend `GET /api/v1/geo/check`, which is **not live yet** (separate ICO-Claude work). Until it is, `checkJurisdiction()` (with no KYC override) fails-open → `warn` → buy allowed; sanctioned users are NOT auto-blocked by IP. The mechanism, #50 screen, and link are still correct and harmless; auto-blocking activates with zero further wallet work once `geo/check` ships. Decision: build + merge now (fail-open), verify the block path via tests + `setKycCountry` now, verify real IP blocking once `geo/check` is live.

## A. Eligibility logic — `src/modules/geoFence/geoFenceModule.ts`

- **Path fix:** `${API_BASE}/v1/geo/check` → `${API_BASE}/geo/check` and `${API_BASE}/v1/geo/restricted-list` → `${API_BASE}/geo/restricted-list` (API_BASE already ends in `/api/v1`; the extra `/v1` was a latent double-prefix bug). No other behavior change.
- **Add** `export function isPresaleBlocked(r: JurisdictionResult): boolean { return r.action === 'block'; }` — the presale policy (OFAC-only) expressed against the existing result. (Keeps the policy in one named place; future tweaks live here.)
- `checkJurisdiction()` unchanged otherwise.

## B. Region display helper — `src/modules/geoFence/regionDisplay.ts` (new)

`regionDisplay(countryCode: string): {label: string; isEu: boolean}` — for the #50 "detected region" line (design shows "Slovenia · EU"). Bundle a modest `COUNTRY_NAMES` map (the restricted-list countries + EU member states + a few common ones) and an `EU_MEMBERS` set (27 ISO codes). Unknown/`UNKNOWN` code → `{label: code, isEu: false}` (fallback to the raw code). ⚠️ *Simplified vs a full ISO-3166 name table — flagged; names cover the compliance-relevant + EU set, else the code shows.*

## C. Geo-blocked screen #50 — `src/screens/compliance/GeoBlockedScreen.tsx` (new)

Per `screen.md` #50 + `index.html` #50. Design system (NativeWind + `Text` variants). Props: `{countryCode?: string; onDismiss: () => void; onClose: () => void}`.
- Header: X (→ `onClose`, dashboard) + title.
- Hero copy: honest — what's limited + **detected region** via `regionDisplay` ("Slovenia · EU" / code fallback), with the coarse-geo disclosure "Based on your network — no GPS, no device location."
- **3 reason rows:** Token swaps (EU MiCA) · NOC presale (geofence) · Fiat on-ramp (licensing).
- **"What still works":** Send · Receive · Stake.
- Sticky **[Got it]** → `onDismiss` (back to trigger screen).
- Registered in the navigator as route `GeoBlocked` (DashboardStack, where presale lives) with optional `{countryCode}` param.

## D. Presale wiring — `src/screens/PresaleScreen.tsx` (`PresaleActive`) + `src/hooks/useJurisdiction.ts` (new)

- `useJurisdiction()` — TanStack Query `['jurisdiction']`, `queryFn: () => geoFenceManager.checkJurisdiction()`, `staleTime: 5min`. Returns `{result, isLoading}`.
- In `PresaleActive`:
  - `const blocked = result ? isPresaleBlocked(result) : false;`
  - Buy button: disabled when `blocked` (combined with the existing `gate.enabled`). When `blocked`, tapping the (disabled-styled) CTA or a small notice routes to `GeoBlocked`. Simplest: if `blocked`, the sticky CTA becomes a "Not available in your region" button → `navigate('GeoBlocked', {countryCode})`.
  - `warn` (restricted/VPN): buy stays enabled; show a discreet inline caption ("Limited availability in your region — purchases still settle on-chain.").
  - Rewire the existing **"Not available in your region?"** link from the `Alert` to `navigation.navigate('GeoBlocked', {countryCode: result?.countryCode})` (always available, informational).

## E. Testing

- `geoFenceModule`: existing tests stay green; add assertions that the fetch URL is `…/geo/check` (not `/v1/geo/check`); `isPresaleBlocked` returns true only for `action:'block'`.
- A KYC-override integration test: `setKycCountry('KP')` → `checkJurisdiction()` → `action:'block'` → `isPresaleBlocked` true (proves the block path without `geo/check`). `setKycCountry('SI')` → not blocked.
- `regionDisplay`: 'SI' → "Slovenia" + isEu true; 'KP' → "North Korea"; unknown 'ZZ' → label 'ZZ', isEu false.
- `GeoBlockedScreen`: renders the 3 reason rows, "what still works", the detected-region label, [Got it] calls `onDismiss`.
- PresaleActive (extend existing test): when `useJurisdiction` resolves `action:'block'`, the buy CTA is replaced/disabled and routes to GeoBlocked; when `allow`, buy works as before.

## F. On-device (mainnet)

- Presale #23 → tap "Not available in your region?" → **#50** opens, shows detected region (currently fail-open → likely `UNKNOWN`/code, since `geo/check` is 404), the 3 reason rows + what-works + disclosure; [Got it] returns; X → dashboard.
- Buy still works (fail-open) for the user (SI, non-sanctioned).
- ⚠️ Real IP-based blocking is verified later once `geo/check` is live; the block logic itself is proven by the KYC-override unit test now.

## Out of scope (flagged)
- Automatic IP detection depends on backend `geo/check` (separate). 
- Gating other actions (swap/fiat) — #50 lists them as reasons but only presale is wired this cycle.
- A full ISO-3166 country-name table (bundled subset only).
- A UI to set KYC country (override is test-only for now).
