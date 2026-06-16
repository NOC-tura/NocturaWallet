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
