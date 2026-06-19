import {RPC_ENDPOINT, API_BASE, API_ORIGIN} from '../../constants/programs';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {pinnedFetch} from '../sslPinning/pinnedFetch';

export interface TokenMeta {
  name: string;
  symbol: string;
  logoUri?: string; // absolute URL (backend img proxy) or Helius cdn_uri; undefined when unknown
}

interface DasAsset {
  id: string;
  content?: {
    metadata?: {name?: string; symbol?: string};
    files?: Array<{uri?: string; cdn_uri?: string}>;
  };
}

interface BackendMeta {
  name?: string;
  symbol?: string;
  image?: string; // relative proxy path: /api/v1/wallet/img?url=...
}

/**
 * Backend proxy (SSL-pinned): Helius DAS with the key server-side, and image
 * URLs rewritten through the SSRF-safe img proxy (so logos work for ANY token,
 * not just Helius-CDN ones). `logoUri` is the ABSOLUTE proxy URL. Throws on failure.
 */
export async function fetchTokenMetadataFromBackend(mints: string[]): Promise<Record<string, TokenMeta>> {
  const res = await pinnedFetch(`${API_BASE}/wallet/tokens/metadata`, {
    method: 'POST',
    body: JSON.stringify({mints}),
  });
  if (res.status !== 200) {
    throw new Error(`backend metadata HTTP ${res.status}`);
  }
  const body = (await res.json()) as {success?: boolean; data?: Record<string, BackendMeta>};
  if (!body.success || !body.data) {
    throw new Error('backend metadata unsuccessful');
  }
  const out: Record<string, TokenMeta> = {};
  for (const [mint, m] of Object.entries(body.data)) {
    out[mint] = {
      name: m.name ?? '',
      symbol: m.symbol ?? '',
      logoUri: m.image ? `${API_ORIGIN}${m.image}` : undefined,
    };
  }
  return out;
}

/**
 * Direct Helius DAS fallback (getAssetBatch on the RPC the app already uses for
 * balances — no new party). `logoUri` is ONLY the Helius cdn_uri; we never fall
 * back to the raw image host. Throws on transport/HTTP error.
 */
export async function fetchTokenMetadataDirect(mints: string[]): Promise<Record<string, TokenMeta>> {
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

/**
 * Resolve token name/symbol/logo for the given mints. Backend-first (logos for
 * any token via the SSRF proxy); on any backend failure, falls back to direct
 * Helius DAS. Throws only when both fail; the caller keeps its cache.
 */
export async function fetchTokenMetadata(mints: string[]): Promise<Record<string, TokenMeta>> {
  if (mints.length === 0) return {};
  try {
    return await fetchTokenMetadataFromBackend(mints);
  } catch (err) {
    if (__DEV__) {
      console.debug('[tokenMetadata] backend failed, falling back to direct Helius DAS', err);
    }
    return fetchTokenMetadataDirect(mints);
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
