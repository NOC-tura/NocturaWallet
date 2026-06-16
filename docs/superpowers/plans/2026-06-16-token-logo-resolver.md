# Token Logo & Metadata Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real logos + real names for held SPL tokens (beyond the 4 hardcoded ones), resolved privately via Helius DAS (Helius-CDN images only).

**Architecture:** A `tokenMetadata` module fetches name/symbol/cdn_uri per held mint from Helius DAS `getAssetBatch` (cached in MMKV). `forceSync` loads the Jupiter verified list (so non-core tokens show) + resolves metadata, and `buildDisplayTokens` enriches each token with it. `TokenLogo` renders the Helius-CDN image when present (letter fallback otherwise). The duplicate `TokenLogo` in SendScreen is removed.

**Tech Stack:** TypeScript strict, React Native 0.84.1, Helius DAS API, MMKV, Jest.

**Spec:** `docs/superpowers/specs/2026-06-16-token-logo-resolver-design.md`
**Branch:** `feat/token-logos` (stacked on `feat/swap` / PR #20; rebase onto origin/main after #20 merges).

---

## File Structure

- `src/modules/tokens/tokenMetadata.ts` — NEW: `fetchTokenMetadata`, `loadCachedMetadata`, `saveCachedMetadata`, `TokenMeta`.
- `src/constants/mmkvKeys.ts` — MODIFY: add `TOKEN_METADATA_CACHE`.
- `src/modules/tokens/tokenModule.ts` — MODIFY: `buildDisplayTokens` accepts an optional `meta` map and enriches name/symbol/logoUri.
- `src/modules/backgroundSync/backgroundSyncModule.ts` — MODIFY: load verified list + resolve metadata + pass to `buildDisplayTokens`.
- `src/components/TokenLogo.tsx` — MODIFY: optional `logoUri` prop → remote Image with letter fallback.
- `src/screens/dashboard/DashboardScreen.tsx`, `src/components/TokenPickerSheet.tsx`, `src/screens/transparent/TokenDetailScreen.tsx`, `src/screens/transparent/SendScreen.tsx` — MODIFY: thread `logoUri`; remove SendScreen's local `TokenLogo`.

---

## Task 1: tokenMetadata module (Helius DAS)

**Files:**
- Create: `src/modules/tokens/tokenMetadata.ts`
- Modify: `src/constants/mmkvKeys.ts`
- Test: `src/modules/tokens/__tests__/tokenMetadata.test.ts`

- [ ] **Step 1: Add the MMKV cache key**

In `src/constants/mmkvKeys.ts`, add to the keys object (near the other token/public keys): `TOKEN_METADATA_CACHE: 'v1_token.metadataCache'`.

- [ ] **Step 2: Write the failing test**

Create `src/modules/tokens/__tests__/tokenMetadata.test.ts`:
```ts
import {fetchTokenMetadata} from '../tokenMetadata';

afterEach(() => {(global.fetch as jest.Mock | undefined)?.mockReset?.();});

const dasResponse = (assets: unknown[]) => ({
  ok: true, status: 200,
  json: async () => ({jsonrpc: '2.0', id: 'meta', result: assets}),
});

describe('fetchTokenMetadata', () => {
  it('maps getAssetBatch assets to name/symbol/cdn_uri', async () => {
    global.fetch = jest.fn(async () =>
      dasResponse([
        {
          id: 'MINT_A',
          content: {
            metadata: {name: 'Bonk', symbol: 'BONK'},
            files: [{uri: 'https://x/y.png', cdn_uri: 'https://cdn.helius-rpc.com/img'}],
          },
        },
        null, // an unresolved id
      ]),
    ) as unknown as typeof fetch;
    const r = await fetchTokenMetadata(['MINT_A', 'MINT_B']);
    expect(r.MINT_A).toEqual({name: 'Bonk', symbol: 'BONK', logoUri: 'https://cdn.helius-rpc.com/img'});
    expect(r.MINT_B).toBeUndefined();
  });

  it('leaves logoUri undefined when there is no cdn_uri (no arbitrary-host fallback)', async () => {
    global.fetch = jest.fn(async () =>
      dasResponse([
        {id: 'MINT_C', content: {metadata: {name: 'Foo', symbol: 'FOO'}, files: [{uri: 'https://x/y.png'}]}},
      ]),
    ) as unknown as typeof fetch;
    const r = await fetchTokenMetadata(['MINT_C']);
    expect(r.MINT_C).toEqual({name: 'Foo', symbol: 'FOO', logoUri: undefined});
  });

  it('returns {} for an empty mint list without calling fetch', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    expect(await fetchTokenMetadata([])).toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws on a non-200 response', async () => {
    global.fetch = jest.fn(async () => ({ok: false, status: 500, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchTokenMetadata(['MINT_A'])).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx jest --testPathPattern=tokenMetadata`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/modules/tokens/tokenMetadata.ts`:
```ts
import {RPC_ENDPOINT} from '../../constants/programs';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

export interface TokenMeta {
  name: string;
  symbol: string;
  logoUri?: string; // ONLY the Helius cdn_uri (private); undefined when uncached
}

interface DasAsset {
  id: string;
  content?: {
    metadata?: {name?: string; symbol?: string};
    files?: Array<{uri?: string; cdn_uri?: string}>;
  };
}

/**
 * Resolve token name/symbol/logo for the given mints via Helius DAS
 * getAssetBatch on the RPC the app already uses (Helius already sees the
 * holdings — no new party). `logoUri` is ONLY the Helius cdn_uri; we never fall
 * back to the raw image host (that would leak the user's IP to an arbitrary
 * CDN). Throws on transport/HTTP error; the caller keeps its cache.
 */
export async function fetchTokenMetadata(mints: string[]): Promise<Record<string, TokenMeta>> {
  if (mints.length === 0) return {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({jsonrpc: '2.0', id: 'meta', method: 'getAssetBatch', params: {ids: mints}}),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`DAS getAssetBatch HTTP ${res.status}`);
    const body = (await res.json()) as {result?: Array<DasAsset | null>};
    const out: Record<string, TokenMeta> = {};
    for (const a of body.result ?? []) {
      if (!a) continue;
      out[a.id] = {
        name: a.content?.metadata?.name ?? '',
        symbol: a.content?.metadata?.symbol ?? '',
        logoUri: a.content?.files?.[0]?.cdn_uri,
      };
    }
    return out;
  } finally {
    clearTimeout(timeout);
  }
}

/** Warm-start cache of resolved metadata (public MMKV — non-sensitive). */
export function loadCachedMetadata(): Record<string, TokenMeta> {
  try {
    const s = mmkvPublic.getString(MMKV_KEYS.TOKEN_METADATA_CACHE);
    return s ? (JSON.parse(s) as Record<string, TokenMeta>) : {};
  } catch {
    return {};
  }
}

export function saveCachedMetadata(map: Record<string, TokenMeta>): void {
  try {
    mmkvPublic.set(MMKV_KEYS.TOKEN_METADATA_CACHE, JSON.stringify(map));
  } catch {
    // cache write is best-effort
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx jest --testPathPattern=tokenMetadata && npx tsc --noEmit`
Expected: PASS (4 tests); tsc 0.

- [ ] **Step 6: Commit**

```bash
git add src/modules/tokens/tokenMetadata.ts src/modules/tokens/__tests__/tokenMetadata.test.ts src/constants/mmkvKeys.ts
git commit -m "feat(tokens): Helius DAS metadata resolver (name/symbol/cdn_uri logo)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: buildDisplayTokens enriches from resolved metadata

**Files:**
- Modify: `src/modules/tokens/tokenModule.ts`
- Test: `src/modules/tokens/__tests__/tokenModule.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/modules/tokens/__tests__/tokenModule.test.ts` (inside the existing `buildDisplayTokens` describe, or a new one). Note: a non-core token only passes the filter if it is verified — the test primes the verified cache via the existing test helper if one exists; if not, test the enrichment for a CORE token's logoUri staying undefined and a verified mint's metadata applied by stubbing `classifyToken`. Simplest reliable test — verify the `meta` is applied to a token that passes the filter by using a core mint for visibility and asserting non-core enrichment via a verified mint mocked through `tm.classifyToken`:
```ts
import {TokenManager} from '../tokenModule';

describe('buildDisplayTokens enrichment', () => {
  it('applies resolved name/symbol/logoUri to a non-core (verified) token', () => {
    const tm = new TokenManager();
    const VERIFIED = 'VerifiedMint1111111111111111111111111111111';
    jest.spyOn(tm, 'classifyToken').mockImplementation(m => (m === VERIFIED ? 'verified' : 'unknown'));
    const result = tm.buildDisplayTokens(
      [{mint: VERIFIED, amount: '5', decimals: 5}],
      {[VERIFIED]: {name: 'Bonk', symbol: 'BONK', logoUri: 'https://cdn.helius-rpc.com/b'}},
    );
    const t = result.find(x => x.mint === VERIFIED);
    expect(t).toMatchObject({symbol: 'BONK', name: 'Bonk', logoUri: 'https://cdn.helius-rpc.com/b', decimals: 5});
  });

  it('keeps core tokens on bundled assets (no logoUri) even if meta provided', () => {
    const tm = new TokenManager();
    const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const r = tm.buildDisplayTokens(
      [{mint: USDC, amount: '1000000', decimals: 6}],
      {[USDC]: {name: 'X', symbol: 'X', logoUri: 'https://cdn/x'}},
    );
    const t = r.find(x => x.mint === USDC);
    expect(t).toMatchObject({symbol: 'USDC', name: 'USD Coin'});
    expect(t?.logoUri).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest --testPathPattern=tokenModule -t "buildDisplayTokens enrichment"`
Expected: FAIL — `buildDisplayTokens` doesn't accept a second arg / doesn't set `logoUri`.

- [ ] **Step 3: Implement**

In `src/modules/tokens/tokenModule.ts`, change `buildDisplayTokens` to accept an optional metadata map and use it:
```ts
  buildDisplayTokens(
    accounts: {mint: string; amount: string; decimals: number}[],
    meta: Record<string, {name?: string; symbol?: string; logoUri?: string}> = {},
  ): TokenMetadata[] {
    const result: TokenMetadata[] = [];
    for (const acc of accounts) {
      if (acc.amount === '0') continue; // not held
      const trust = this.classifyToken(acc.mint);
      if (trust === 'unknown') continue; // core + verified only
      const core = CORE_TOKENS.find(t => t.mint === acc.mint);
      const m = meta[acc.mint];
      result.push({
        mint: acc.mint,
        symbol: core?.symbol ?? m?.symbol ?? `${acc.mint.slice(0, 4)}…${acc.mint.slice(-4)}`,
        name: core?.name ?? m?.name ?? 'Unknown token',
        decimals: core?.decimals ?? acc.decimals,
        // Core tokens render from bundled assets; only non-core carry a logoUri.
        logoUri: core ? undefined : m?.logoUri,
        trust,
      });
    }
    return result;
  }
```
(`TokenMetadata` already has an optional `logoUri` field — no type change needed.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest --testPathPattern=tokenModule && npx tsc --noEmit`
Expected: PASS (existing + new); tsc 0.

- [ ] **Step 5: Commit**

```bash
git add src/modules/tokens/tokenModule.ts src/modules/tokens/__tests__/tokenModule.test.ts
git commit -m "feat(tokens): buildDisplayTokens enriches name/symbol/logoUri from resolved meta

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire verified list + metadata into forceSync

**Files:**
- Modify: `src/modules/backgroundSync/backgroundSyncModule.ts`

No new automated test (integration; the pieces are unit-tested). Verify via tsc + the existing backgroundSync test + on-device.

- [ ] **Step 1: Add imports**

In `src/modules/backgroundSync/backgroundSyncModule.ts`, add:
```ts
import {fetchTokenMetadata, loadCachedMetadata, saveCachedMetadata} from '../tokens/tokenMetadata';
```
(`tokenManager` is already an instance; `NOC_MINT` is already imported.)

- [ ] **Step 2: Replace the setTokens block**

Find the existing block:
```ts
    if (tokenAccounts.status === 'fulfilled') {
      useWalletStore
        .getState()
        .setTokens(tokenManager.buildDisplayTokens(tokenAccounts.value));
    }
```
Replace it with:
```ts
    if (tokenAccounts.status === 'fulfilled') {
      // Load the Jupiter verified list so verified (non-core) held tokens pass
      // buildDisplayTokens' trust filter. Best-effort — it caches internally.
      try {
        await tokenManager.fetchVerifiedList();
      } catch {
        // verified list unavailable — only core tokens will show this sync
      }

      // Resolve name/symbol/logo for held non-core mints via Helius DAS, warm-
      // starting from the MMKV cache so a failed/slow fetch still shows logos.
      const heldMints = tokenAccounts.value
        .filter(t => t.amount !== '0' && t.mint !== NOC_MINT)
        .map(t => t.mint);
      let meta = loadCachedMetadata();
      try {
        const resolved = await fetchTokenMetadata(heldMints);
        meta = {...meta, ...resolved};
        saveCachedMetadata(meta);
      } catch {
        // DAS unavailable — keep the cached metadata
      }

      useWalletStore
        .getState()
        .setTokens(tokenManager.buildDisplayTokens(tokenAccounts.value, meta));
    }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint src/modules/backgroundSync/backgroundSyncModule.ts && npx jest --testPathPattern=backgroundSync`
Expected: tsc 0; no eslint errors; tests pass. (If the backgroundSync test mocks the connection/store, the new `fetchTokenMetadata`/`fetchVerifiedList` calls are awaited but wrapped in try/catch — confirm the test still passes; if it asserts call counts on a mocked store, the extra awaits are harmless. Update the test only if it breaks, and explain.)

- [ ] **Step 4: Commit**

```bash
git add src/modules/backgroundSync/backgroundSyncModule.ts
git commit -m "feat(tokens): resolve verified-list + DAS metadata in forceSync

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: TokenLogo renders the resolved logo

**Files:**
- Modify: `src/components/TokenLogo.tsx`
- Test: `src/components/__tests__/TokenLogo.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/TokenLogo.test.tsx`:
```tsx
import React from 'react';
import {Image} from 'react-native';
import {render} from '@testing-library/react-native';
import {TokenLogo} from '../TokenLogo';

describe('TokenLogo', () => {
  it('renders a remote Image when a non-core logoUri is given', () => {
    const {UNSAFE_getAllByType} = render(
      <TokenLogo symbol="BONK" isNoc={false} logoUri="https://cdn.helius-rpc.com/b" />,
    );
    const imgs = UNSAFE_getAllByType(Image);
    expect(imgs.some(i => JSON.stringify(i.props.source).includes('cdn.helius-rpc.com'))).toBe(true);
  });

  it('falls back to a letter when no logoUri and not a core token', () => {
    const {getByText} = render(<TokenLogo symbol="WIF" isNoc={false} />);
    expect(getByText('W')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest --testPathPattern=TokenLogo`
Expected: FAIL — `logoUri` not supported / remote Image not rendered.

- [ ] **Step 3: Implement**

In `src/components/TokenLogo.tsx`:
- Change the props interface to `export interface TokenLogoProps {symbol: string; isNoc: boolean; logoUri?: string;}`.
- At the TOP of the component (before the `if (symbol === 'SOL')` returns — hooks must be unconditional), add `const [failed, setFailed] = React.useState(false);` (import React's `useState` or use `React.useState`).
- Keep the four core branches (SOL/NOC/USDC/USDT) exactly as-is.
- BEFORE the final letter-fallback `return`, add:
```tsx
  if (logoUri && !failed) {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={{uri: logoUri}}
          style={{width: 40, height: 40}}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`${symbol} logo`}
        />
      </View>
    );
  }
```
(The function signature changes to `export function TokenLogo({symbol, isNoc, logoUri}: TokenLogoProps)`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest --testPathPattern=TokenLogo && npx tsc --noEmit && npx eslint src/components/TokenLogo.tsx`
Expected: PASS; tsc 0; no eslint errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/TokenLogo.tsx src/components/__tests__/TokenLogo.test.tsx
git commit -m "feat(ui): TokenLogo renders resolved logoUri (Helius CDN) with letter fallback

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Thread logoUri to render sites + remove SendScreen's duplicate TokenLogo

**Files:**
- Modify: `src/components/TokenPickerSheet.tsx`, `src/screens/dashboard/DashboardScreen.tsx`, `src/screens/transparent/TokenDetailScreen.tsx`, `src/screens/transparent/SendScreen.tsx`

- [ ] **Step 1: TokenPickerSheet — carry logoUri**

In `src/components/TokenPickerSheet.tsx`:
- Add `logoUri?: string;` to the `PickerToken` interface.
- In the row, pass it: `<TokenLogo symbol={t.symbol} isNoc={t.mint === NOC_MINT} logoUri={t.logoUri} />`.

- [ ] **Step 2: Dashboard — pass token.logoUri**

In `src/screens/dashboard/DashboardScreen.tsx`:
- `TokenListRow` props: add `logoUri?: string;`. In its render, `<TokenLogo symbol={symbol} isNoc={isNoc} logoUri={logoUri} />`.
- In the FlatList `renderItem`, pass `logoUri={token.logoUri}` (the store `displayTokens` are `TokenMetadata` which now carry `logoUri`).

- [ ] **Step 3: TokenDetailScreen — pass logoUri**

In `src/screens/transparent/TokenDetailScreen.tsx`, the `meta` is resolved from `CORE_TOKENS`/`tokens.find(...)`. Pass the store token's logoUri to the hero logo: find the matching store token (`tokens.find(t => t.mint === mint)?.logoUri`) and pass `logoUri={...}` to `<TokenLogo ... />`. (Core tokens have no logoUri → bundled; that's fine.)

- [ ] **Step 4: SendScreen — remove the duplicate TokenLogo + use the shared one + thread logoUri**

In `src/screens/transparent/SendScreen.tsx`:
- Delete the local `function TokenLogo({symbol, mint}: ...)` (≈ line 651).
- Import the shared one: `import {TokenLogo} from '../../components/TokenLogo';`.
- Add `logoUri` to `TokenInfo` (optional: `logoUri?: string;`) and populate it in `availableTokens` from the store token metadata (`name: t.name, logoUri: t.logoUri` for the `storeTokens.map`; core entries omit it).
- At the chip render site, change to `<TokenLogo symbol={selectedToken.symbol} isNoc={selectedToken.mint === NOC_MINT} logoUri={selectedToken.logoUri} />`.
- Pass `logoUri` into the picker's tokens too (the `availableTokens` already become `PickerToken`-shaped with the new `logoUri`).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx eslint src/components/TokenPickerSheet.tsx src/screens/dashboard/DashboardScreen.tsx src/screens/transparent/TokenDetailScreen.tsx src/screens/transparent/SendScreen.tsx && npx jest --testPathPattern="dashboard|TokenDetail|SendScreen|TokenPicker|transparent"`
Expected: tsc 0; no eslint errors; tests pass. Confirm SendScreen no longer defines a local `TokenLogo` (grep: only the import remains).

- [ ] **Step 6: Commit**

```bash
git add src/components/TokenPickerSheet.tsx src/screens/dashboard/DashboardScreen.tsx src/screens/transparent/TokenDetailScreen.tsx src/screens/transparent/SendScreen.tsx
git commit -m "feat(ui): thread resolved logoUri to dashboard/picker/detail/send; drop SendScreen's duplicate TokenLogo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Full verification + on-device

**Files:** none.

- [ ] **Step 1: Full suite + tsc + lint**

Run: `npx jest && npx tsc --noEmit && npx eslint .`
Expected: all pass; tsc 0; no NEW eslint errors (pre-existing `e2e/helpers.ts` error + inline-style warnings unrelated).

- [ ] **Step 2: Mainnet APK build**

Swap `.env` to mainnet with the user's Helius + CoinGecko keys, `cd android && ./gradlew assembleRelease`, revert `.env`, copy the APK to `/home/user/Downloads/`.

- [ ] **Step 3: On-device verification**

- A held verified non-core token (e.g. USDT already shows bundled; hold a BONK/JUP-class token to test DAS) shows its real Helius-CDN logo + real name on the dashboard, in Send, and in the token picker — not a letter / "Unknown token".
- Core tokens (SOL/NOC/USDC/USDT) still show their bundled logos.
- Airplane mode after a sync → cached logos still render.
- A token with no Helius cdn_uri → letter avatar (no crash, no arbitrary-host fetch).

If anything misbehaves, STOP and use `superpowers:systematic-debugging`.

---

## Self-Review

**1. Spec coverage:**
- DAS metadata module (cdn_uri only, cache) → Task 1. ✓
- Verified-list enabler (C-pre) → Task 3 (`fetchVerifiedList`). ✓
- forceSync integration (resolve + enrich) → Tasks 2 (buildDisplayTokens meta), 3 (wiring). ✓
- TokenLogo logoUri + fallback → Task 4. ✓
- SendScreen duplicate removal + render-site threading → Task 5. ✓
- Error handling (DAS fail → cache/letters; image onError → letter; no arbitrary host) → Tasks 1, 3, 4. ✓
- Tests: tokenMetadata, buildDisplayTokens enrichment, TokenLogo → Tasks 1, 2, 4. ✓
- Out of scope (backend proxy, arbitrary search, skeletons, links.image fallback) → not implemented. ✓

**2. Placeholder scan:** Full code for the module + buildDisplayTokens + TokenLogo; precise edits for the wiring; commands have expected output. No TBD/TODO.

**3. Type consistency:** `TokenMeta {name, symbol, logoUri?}` (Task 1) consumed by `buildDisplayTokens(accounts, meta)` (Task 2) and forceSync (Task 3). `TokenMetadata.logoUri` (existing store field) flows to `displayTokens` → `TokenListRow`/`PickerToken.logoUri` (Task 5) → `TokenLogo.logoUri` (Task 4). `PickerToken` gains `logoUri?` (Task 5). `fetchTokenMetadata(mints): Record<string, TokenMeta>` consistent across Tasks 1 & 3. ✓
