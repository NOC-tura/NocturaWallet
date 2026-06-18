# Wallet → Backend Proxy Wiring (Cycle 2) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-18
**Repo:** NocturaWallet (RN app).
**Branch:** `feat/backend-wiring`.

## Context

Cycle 1 (separate ICO/coordinator repo, merged + LIVE on `https://api.noc-tura.io/api/v1/wallet/...`) added backend proxy endpoints: `prices`, `chart`, `tokens/metadata` (Helius DAS, server-side key), and an SSRF-hardened `img` proxy. This cycle wires the wallet to call those instead of CoinGecko/Helius directly — for privacy (hide user IP from CoinGecko; logos for any token via the SSRF proxy instead of arbitrary CDNs) and shared rate-limit/scale.

**Decisions (from brainstorming):**
- **Backend-first + fallback to direct.** Each module tries the backend first; on any failure it falls back to the existing direct CoinGecko/Helius call (already implemented + tested). Maximizes availability; captures the privacy win in the common case.
- **Transport = `pinnedFetch` (real SSL pinning, done THIS cycle).** The installed `react-native-ssl-pinning@1.6.0` supports SPKI public-key pinning via `pkPinning: true`; current `pinnedFetch` does NOT set it and `SSL_PINS` hold placeholders → it would fail today. Fix it for real (also fixes the latent relayer/geo callers).
- **Helius key not fully removed:** the wallet still uses Helius RPC directly for balances (`RPC_ENDPOINT`), so the DAS-proxy's main wins here are (a) image proxying for any host and (b) consistency; the key removal is a larger future cycle (proxy all RPC). Not in scope.

## A. SSL pinning fix — `src/modules/sslPinning/pinnedFetch.ts`

- Add `pkPinning: true` to the `SSLPinning.fetch` options object.
- `SSL_PINS` format becomes `sha256/<base64-SPKI>=` (OkHttp `CertificatePinner` on Android, AFNetworking on iOS; the lib matches ANY cert in the chain against the pins).
- **Pins (user-provided, real values):** pin **(1) the leaf SPKI** AND **(2) the Let's Encrypt intermediate SPKI** as backup. Pinning the intermediate too means a leaf renewal with a *new* key still validates (the chain still contains the pinned intermediate) → the app is not bricked by certbot rotation. Server should also renew with `certbot … --reuse-key` so the leaf pin stays stable as the primary.
- Extraction commands (the assistant provides; the user runs and pastes the two `sha256/…=` values into `SSL_PINS`):
  ```bash
  # leaf
  openssl s_client -servername api.noc-tura.io -connect api.noc-tura.io:443 </dev/null 2>/dev/null \
    | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der \
    | openssl dgst -sha256 -binary | openssl enc -base64
  # intermediate (Let's Encrypt R10/R11/E5…): grab the 2nd cert in the chain, same pipeline
  ```
- Behavior: pin mismatch → `SSLPinningError (E032)` (existing) → callers treat as a backend failure → fallback. No crash.
- This is foundational and lands first; the data modules depend on a working `pinnedFetch`.

## B. API base + origin — `src/constants/programs.ts` + `.env*`

- `.env.production`: `API_BASE=https://api.noc-tura.io/api/v1`
- `.env.development`: `API_BASE=http://localhost:3001/api/v1`
- `.env.example`: `API_BASE=http://localhost:3001/api/v1`
- Add `export const API_ORIGIN` in `programs.ts` (e.g. `https://api.noc-tura.io`) — used to turn the backend's relative `image` path (`/api/v1/wallet/img?url=…`) into an absolute URL for `<Image>`. Compute it GUARDED so a missing/blank `API_BASE` can't throw at import time: `const API_ORIGIN = (() => { try { return new URL(API_BASE).origin; } catch { return ''; } })();`. (`new URL` is available via the `react-native-url-polyfill/auto` bootstrap.) When empty, `tokenMetadata` simply leaves `logoUri` undefined (letter fallback) — no crash.
- The 10 existing `${API_BASE}/v1/…` double-`/v1` call sites (relayer/analytics/shielded/geo/version-check/tokens-flagged) are a SEPARATE latent bug — NOT touched this cycle.

## C. Prices — `src/modules/prices/priceModule.ts`

- Rename the current CoinGecko implementation to `fetchPricesDirect()` (unchanged logic/return).
- Add `fetchPricesFromBackend()`: `pinnedFetch(\`${API_BASE}/wallet/prices?ids=solana,usd-coin\`)`, parse `{success, data:{solana, "usd-coin"}}` into the same `Record<string, TokenPrice>` shape (`native`, `[USDC_MINT]`). Throws on non-200 / `success:false` / missing fields.
- `fetchPrices()` = backend-first wrapper: `try { return await fetchPricesFromBackend(); } catch { return await fetchPricesDirect(); }` (log the backend failure at debug). The `usePrices` hook keeps calling `fetchPrices` unchanged.
- Preserve current scope: SOL + USDC only (no USDT pricing this cycle).

## D. Chart — `src/modules/prices/priceHistory.ts`

- Rename current impl to `fetchPriceHistoryDirect(coingeckoId, tf)` (unchanged).
- Add `fetchPriceHistoryFromBackend(coingeckoId, tf)`: `pinnedFetch(\`${API_BASE}/wallet/chart?id=${coingeckoId}&days=${TIMEFRAME_DAYS[tf]}\`)`, parse `{success, data:{prices:[[ms,usd],…]}}` → `{prices: number[]}` (map `p[1]`). Throws on non-200/`success:false`/bad shape.
- `fetchPriceHistory()` = backend-first wrapper → fallback to direct. `usePriceHistory` unchanged. `coingeckoIdForMint`/`changeOverSeries`/`TIMEFRAME_DAYS` unchanged.

## E. Token metadata — `src/modules/tokens/tokenMetadata.ts`

- Rename current Helius-DAS impl to `fetchTokenMetadataDirect(mints)` (unchanged; `logoUri = cdn_uri` only).
- Add `fetchTokenMetadataFromBackend(mints)`: `pinnedFetch(\`${API_BASE}/wallet/tokens/metadata\`, {method:'POST', body: JSON.stringify({mints})})`, parse `{success, data:{[mint]:{name,symbol,image?}}}` → `Record<string, TokenMeta>` where `logoUri = image ? API_ORIGIN + image : undefined` (absolute proxy URL; works for ANY token). Throws on non-200/`success:false`.
- `fetchTokenMetadata()` = backend-first wrapper → fallback to direct. `loadCachedMetadata`/`saveCachedMetadata` unchanged; `backgroundSyncModule` caller unchanged.
- Net effect: non-core tokens get real logos via the SSRF proxy (not limited to Helius cdn_uri).

## F. TokenLogo — `src/components/TokenLogo.tsx`

- No code change required: it already renders `logoUri` via `<Image source={{uri}}>` with an `onError` letter fallback. The `logoUri` now carries the backend proxy URL (absolute). (Core SOL/NOC/USDC/USDT still render bundled assets.) Image requests are NOT SSL-pinned (RN `<Image>` loader) — acceptable: public image, our host, `onError` → letter.

## G. Error handling / states

- Backend failure (non-200, timeout, `SSLPinningError`, parse) → caught by the wrapper → direct fallback.
- Both fail → existing degradation: prices keep last TanStack cache; metadata keeps MMKV cache (`loadCachedMetadata`); chart shows its error state; logo → letter avatar.
- Never crash the sync/render path; all wrappers are try/catch.

## H. Testing

- `priceModule.test.ts`: backend success → mapped shape; backend fail → direct CoinGecko used (mock `pinnedFetch` reject + `global.fetch` resolve); both fail → throws. Verify `pinnedFetch` called with the `/wallet/prices` URL.
- `priceHistory.test.ts`: same three paths for `/wallet/chart`; days mapping per timeframe.
- `tokenMetadata.test.ts`: backend success → `logoUri = API_ORIGIN + image`; image absent → `logoUri` undefined; backend fail → direct DAS fallback (`logoUri = cdn_uri`); both fail → throws.
- `pinnedFetch`: a small test asserting `pkPinning: true` and the `sha256/` pin format are passed to `SSLPinning.fetch` (mock the lib). (No real network.)
- Mock `pinnedFetch` by mocking `../sslPinning/pinnedFetch`; mock `global.fetch` for the direct path.

## I. On-device verification (mainnet)

APK build → verify: dashboard SOL/USDC USD + 24h% load (via backend); TokenDetail chart loads across timeframes; a held non-core token shows its real logo (through the proxy); airplane mode → cached prices/logos still show, letters for uncached; (optional) temporarily break the pin to confirm fallback still serves data.

## Out of scope (stated)

- USDT pricing on the dashboard (kept SOL+USDC parity).
- Removing Helius RPC / proxying all RPC (key stays in app for balances) — future cycle.
- Fixing the 10 double-`/v1` latent call sites.
- Pinning the `<Image>` logo loads.
