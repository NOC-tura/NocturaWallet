# Token Logo & Metadata Resolver — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-16
**Branch:** `feat/token-logos` — STACKS on `feat/swap` (PR #20, unmerged): touches `TokenLogo` (the USDT change is on #20) and the dashboard token-metadata path. Rebase `--onto origin/main` after #20 merges.

## Goal

Show the real logo (and real name/symbol) for ANY held SPL token, not just the four hardcoded ones (SOL/NOC/USDC/USDT). Today `TokenLogo` falls back to a first-letter avatar for everything else, and `buildDisplayTokens` labels non-core tokens "Unknown token" + a shortened mint.

**Privacy (core value):** resolve metadata via **Helius DAS** (`getAssetBatch`) on the Helius RPC the app already uses — Helius already sees the user's holdings (via `getTokenAccounts`), so this adds no new party. Use the Helius-hosted **`cdn_uri`** image (e.g. `https://cdn.helius-rpc.com/...`) so loading the logo also hits only Helius — no arbitrary CDN/IPFS host ever sees the user's IP. Tokens with no `cdn_uri` keep the letter avatar (no leak).

## A. Metadata module — `src/modules/tokens/tokenMetadata.ts`

```ts
export interface TokenMeta {name: string; symbol: string; logoUri?: string} // logoUri = Helius cdn_uri only

// Helius DAS getAssetBatch over the held mints. Returns a mint→TokenMeta map
// for the mints that resolved; missing/failed mints are simply absent.
export async function fetchTokenMetadata(mints: string[]): Promise<Record<string, TokenMeta>>;
```
- POST the Helius RPC (`RPC_ENDPOINT` from constants) `{method: 'getAssetBatch', params: {ids: mints}}` (DAS supports up to 1000 ids; the app holds a handful). Plain JSON POST through the existing connection's endpoint URL (reuse `RPC_ENDPOINT`), ~8s timeout.
- For each returned asset: `name = content.metadata.name`, `symbol = content.metadata.symbol`, `logoUri = content.files?.[0]?.cdn_uri` (ONLY the Helius cdn_uri — if absent, leave `logoUri` undefined; do NOT fall back to `content.links.image`, which is an arbitrary host).
- Throws on transport/HTTP error; the caller keeps the cache and degrades to letters. Skip `'native'` (SOL) — it has no DAS asset; it's hardcoded.

## B. Cache — MMKV

- Persist resolved metadata so we don't re-fetch every sync (logos rarely change). Store a JSON map `{[mint]: TokenMeta}` under a new key `MMKV_KEYS.TOKEN_METADATA_CACHE` in the **public** MMKV (non-sensitive). A small helper in the module: `loadCachedMetadata()` / `saveCachedMetadata(map)`. No TTL needed (refreshed each sync, merged over the cache); the cache is just the warm-start value.

## C-pre. Enabler — load the Jupiter verified list (so non-core tokens show at all)

**Discovery:** `TokenManager.fetchVerifiedList()` exists but is **never called**, so `_verifiedMints` is always null → `classifyToken` returns `'unknown'` for every non-core mint → `buildDisplayTokens` filters them out. Result: today ONLY core tokens (SOL/NOC/USDC/USDT) ever appear on the dashboard. Without fixing this, the logo resolver has nothing non-core to enrich (core tokens already have bundled logos) and the whole feature is invisible.

So this cycle also wires the verified list: in `forceSync`, call `await tokenManager.fetchVerifiedList()` (best-effort, try/catch — it already caches to MMKV internally) BEFORE `buildDisplayTokens`, so verified held tokens (BONK, JUP, …) pass the trust filter and then get DAS name/logo. This realizes the "core + verified" visibility the dashboard-prices cycle intended but never enabled. Unknown-trust tokens stay hidden (scam-airdrop safety — unchanged).

## C. Integration — `backgroundSyncModule.forceSync`

After the successful `getTokenAccounts`, resolve logos for the held mints and merge them into the metadata the dashboard renders:
- Collect held mints (`tokenAccounts.value.map(t => t.mint)`), excluding NOC (hardcoded) and SOL.
- `const resolved = await fetchTokenMetadata(mints)` (wrapped in try/catch → on failure use `loadCachedMetadata()`); merge `{...cache, ...resolved}` and `saveCachedMetadata`.
- When building the display tokens (`tokenManager.buildDisplayTokens(tokenAccounts.value)`), enrich each token: if `resolved[mint]` exists, use its `name`/`symbol`/`logoUri` (a real name beats "Unknown token"). Core tokens (`CORE_TOKENS`) keep their bundled name/symbol; `logoUri` from DAS is attached to non-core tokens only (core tokens render from bundled assets — see D).
- Store via `setTokens` (the existing path). `TokenMetadata.logoUri` (already a field on the store type) now carries the cdn_uri.
- This stays resilient: a DAS failure leaves names/logos as-is (cache or letters); balances/prices are unaffected.

## D. `TokenLogo` — `src/components/TokenLogo.tsx`

Add an optional `logoUri?: string` prop. Resolution order:
1. **Core hardcoded** (bundled assets, instant + offline): `symbol === 'SOL'` → Solana, `isNoc` → NOC, `symbol === 'USDC'` → USDC, `symbol === 'USDT'` → USDT (unchanged).
2. else **`logoUri`** present → `<Image source={{uri: logoUri}}>` inside the same round chip, with an `onError` that flips to the letter fallback (a small `useState` `failed` flag).
3. else **first-letter avatar** (unchanged).

Keep the `{symbol, isNoc}` props and add `logoUri?`. Callers that have a logoUri (dashboard rows, picker, token-detail) pass it; others omit it (letter fallback as today).

## E. Cleanup — remove the duplicate TokenLogo in SendScreen

`SendScreen.tsx` has its OWN local `TokenLogo({symbol, mint})` (≈ line 651) — a leftover from before the shared component. Delete it and use the shared `src/components/TokenLogo.tsx` (import it; pass `isNoc={mint === NOC_MINT}` + `logoUri` from the selected token's metadata if available). This removes the duplication and gives Send the same real logos.

## F. Wiring the logoUri to the render sites

The store `tokens: TokenMetadata[]` now carry `logoUri`. Pass it to `TokenLogo`:
- **Dashboard `TokenListRow`**: it already maps over `displayTokens`; pass `logoUri={token.logoUri}`.
- **TokenPickerSheet**: extend `PickerToken` with `logoUri?: string`; the dashboard/swap/send callers populate it from the token metadata; the row passes `logoUri` to `TokenLogo`. (Swap's `SWAP_TOKENS` are core → no logoUri needed; Send/dashboard held tokens carry it.)
- **TokenDetailScreen**: pass `logoUri` from the resolved meta when available.
(Core tokens render from bundled assets regardless, so passing `logoUri` for them is harmless.)

## Error handling / states

- DAS unreachable / HTTP error → keep the MMKV cache; uncached tokens show letters. Never throws into the sync (try/catch).
- `cdn_uri` absent for a token → letter avatar (private; no fallback to arbitrary hosts).
- Remote `Image` fails to load → `onError` → letter avatar.
- Brand-new held token (first sync, not cached, DAS slow) → letter until the next sync resolves it.

## Testing

- `tokenMetadata.test.ts`: mock `fetch` returning a `getAssetBatch` shape → maps to `{name, symbol, logoUri: cdn_uri}`; an asset with no `files[].cdn_uri` → `logoUri` undefined; non-200 → throws; missing asset → absent from the map.
- `TokenLogo.test.tsx`: `symbol='USDC'` → bundled image (no remote); a non-core symbol with `logoUri` → renders an `Image` with that uri; without `logoUri` → letter. (Simulate `onError` → letter.)
- On-device (mainnet): a held non-core token (e.g. USDT already, plus any other SPL the user holds) shows its real Helius-CDN logo on the dashboard, in Send, and in the picker; an unknown/uncached token shows a letter; airplane mode → cached logos still show.

## Out of scope (stated, not silently dropped)

- A Noctura backend image-proxy — not needed (Helius `cdn_uri` already routes images through Helius, no new party). Could later cover the rare non-cdn tokens.
- Arbitrary-mint search/import (§43 search).
- Logo loading skeletons/animations.
- Falling back to the original (`content.links.image`) host — intentionally NOT done, to avoid leaking the IP to arbitrary CDNs.
