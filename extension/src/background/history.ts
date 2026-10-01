import type {WalletDeps} from './deps';
import {createMutex} from './mutex';
import {decodeHistoryEntry, type HistoryEntry, type HistoryKind} from '../../../core/solana/history';
import type {WalletToken} from '../../../core/solana/balances';

export const HISTORY_PAGE_SIZE = 10;
/** At most 2 getTransaction per second (spec §4), well inside the proxy's 240 requests a minute. */
export const TX_MIN_INTERVAL_MS = 500;
export const MAX_CACHED = 500;

export interface HistoryView {
  signature: string;
  blockTime: number | null;
  kind: HistoryKind;
  token: WalletToken | null;
  mint: string | null;
  amount: string | null;
  counterparty: string | null;
  feeLamports: string;
  failed: boolean;
}

/**
 * `next` is the LAST signature of the getSignaturesForAddress page when that page had
 * HISTORY_PAGE_SIZE entries, else null (review fix round 1, #1). It is deliberately NOT derived from
 * `items`: a signature not yet indexed (getTransaction answers null) is skipped from `items` without
 * shrinking the page, so a full signature page with one unindexed entry must still offer "Load more"
 * and must still resume from the RPC page's real end — not from the last row that happened to decode.
 */
export interface HistoryPage {
  items: HistoryView[];
  next: string | null;
}

export interface History {
  page(owner: string, before?: string): Promise<HistoryPage>;
}

const toView = (e: HistoryEntry): HistoryView => ({
  signature: e.signature,
  blockTime: e.blockTime,
  kind: e.kind,
  token: e.token,
  mint: e.mint,
  amount: e.amount === null ? null : e.amount.toString(),
  counterparty: e.counterparty,
  feeLamports: e.feeLamports.toString(),
  failed: e.failed,
});

export function createHistory(deps: Pick<WalletDeps, 'reader' | 'now' | 'sleep'>): History {
  const cache = new Map<string, HistoryEntry>();
  const serial = createMutex();
  let lastFetch = Number.NEGATIVE_INFINITY;

  async function paced(signature: string): Promise<unknown> {
    const wait = lastFetch + TX_MIN_INTERVAL_MS - deps.now();
    if (wait > 0) await deps.sleep(wait);
    lastFetch = deps.now();
    return deps.reader.getTransaction(signature);
  }

  async function page(owner: string, before?: string): Promise<HistoryPage> {
    const opts = before === undefined ? {limit: HISTORY_PAGE_SIZE} : {limit: HISTORY_PAGE_SIZE, before};
    const signatures = await deps.reader.getSignaturesForAddress(owner, opts);
    const out: HistoryView[] = [];
    for (const s of signatures) {
      const key = `${owner}:${s.signature}`;
      let entry = cache.get(key);
      if (entry === undefined) {
        const tx = await paced(s.signature);
        if (tx === null || tx === undefined) continue; // not indexed yet: not cached, asked again next time
        entry = decodeHistoryEntry(owner, s.signature, tx);
        cache.set(key, entry);
        if (cache.size > MAX_CACHED) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
      }
      out.push(toView(entry));
    }
    // The RPC page's own last signature, not out's — see the HistoryPage doc comment.
    const next = signatures.length === HISTORY_PAGE_SIZE ? (signatures[signatures.length - 1]?.signature ?? null) : null;
    return {items: out, next};
  }

  // One page at a time, so two popups cannot double the getTransaction rate.
  return {page: (owner, before) => serial(() => page(owner, before))};
}
