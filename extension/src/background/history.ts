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

export interface History {
  page(owner: string, before?: string): Promise<HistoryView[]>;
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

  async function page(owner: string, before?: string): Promise<HistoryView[]> {
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
    return out;
  }

  // One page at a time, so two popups cannot double the getTransaction rate.
  return {page: (owner, before) => serial(() => page(owner, before))};
}
