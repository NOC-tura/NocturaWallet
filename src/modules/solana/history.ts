/**
 * History spec (2026-11-26) §3: one account's history as #26 shows it — the session's signatures
 * (`historySession.ts`), their parsed transactions (`historyReads.ts`, cached per signature) and the
 * classifier (`activity.ts`), put together. No React here: the hook (`useActivityHistory`) calls
 * `loadHistory` and keeps the answer in the query cache.
 *
 * §3.4: a signature whose transaction is not readable yet STILL has a row (`activity: null` — the
 * "partial" row: date and status from the signature list, "Transaction", "—"). It is never dropped,
 * and every load re-tries every row that is still unparsed.
 *
 * TWO READS PER LOAD (plan review r1 I5): the signatures this load ADDED are one read, and the rows
 * loaded before that are still unparsed are another. web3.js fails a whole batch for one refused
 * item, so a signature the node will not serve (a transaction of a version above 1, or one an old
 * node refuses) would otherwise sit in the batch of every later page and turn each into 20 single
 * reads. Apart, it costs its own two calls per load and touches no new page. When the first read
 * ran out of time the second is not started (plan review r2 n2): the node is not answering, and the
 * older rows keep what the cache already holds.
 */
import type {Connection} from '@solana/web3.js';
import type {QueryClient} from '@tanstack/react-query';
import {classifyActivity} from './activity';
import type {ActivityContext, ActivityRow} from './activity';
import {HISTORY_READ_TIMEOUT_MS, cachedParsedTransactions, getSignaturePage, listHistorySources, readParsedTransactionsTimed} from './historyReads';
import {historySession} from './historySession';
import type {SignatureItem} from './historySession';

export interface HistoryRow {
  /** from the signature list: always present */
  item: SignatureItem;
  /** null while the transaction could not be read (§3.4) */
  activity: ActivityRow | null;
}

export interface HistorySnapshot {
  /** changes when the session restarted from the head */
  sessionId: number;
  rows: HistoryRow[];
  /** §3.2: every source is exhausted and every buffer is empty */
  endReached: boolean;
  /** token accounts read, of those the wallet owns (the footer when read < total) */
  coverage: {read: number; total: number};
}

export interface HistoryEnv {
  connection: Connection;
  client: QueryClient;
  cluster: string;
  /** the classifier's constants for this account's token accounts (`activityContext`) */
  context: (ownTokenAccounts: ReadonlySet<string>) => ActivityContext;
  /** the limit of each chain call; HISTORY_READ_TIMEOUT_MS when absent (tests hand in a short one) */
  timeoutMs?: number;
  /**
   * false once the wallet this load began for is gone (`historyLiveness()`, ended by `onSecureMmkvReset`): the
   * load then reads no further transaction, caches nothing more and fails (final review 5)
   */
  live: () => boolean;
}

/** thrown by a load whose wallet was wiped or replaced while it ran (final review 5) */
export class StaleHistoryError extends Error {
  constructor() {
    super('the wallet this history load started for is gone');
    this.name = 'StaleHistoryError';
  }
}

/**
 * 'head': the first page, or — once a page is loaded — the §3.4 refresh. 'older': the next page.
 * Throws when a signature list (or the source list) cannot be read or does not answer in time; a
 * transaction that cannot be read is a partial row, never an error. Throws StaleHistoryError when the
 * wallet went while it ran (`env.live()`): nothing it read after that is cached.
 */
export async function loadHistory(account: string, step: 'head' | 'older', env: HistoryEnv): Promise<HistorySnapshot> {
  const timeoutMs = env.timeoutMs ?? HISTORY_READ_TIMEOUT_MS;
  const session = historySession(env.cluster, account, {
    listSources: () => listHistorySources(env.connection, env.cluster, account, timeoutMs),
    fetchSignatures: (source, before, limit) => getSignaturePage(env.connection, env.cluster, source, before, limit, timeoutMs),
  });
  const idBefore = session.id;
  const loadedBefore = new Set(session.items.map(x => x.signature));
  if (step === 'older' || session.pagesLoaded === 0) {
    await session.loadNextPage();
  } else {
    await session.refresh();
  }
  const items = [...session.items];
  // a restart replaced every row: all of them are this load's
  const isNew = (signature: string): boolean => session.id !== idBefore || !loadedBefore.has(signature);
  const added = items.map(x => x.signature).filter(isNew);
  const loaded = items.map(x => x.signature).filter(s => !isNew(s));
  const alive = (): void => {
    if (!env.live()) {
      throw new StaleHistoryError();
    }
  };
  // only the uncached ones are read — this load's rows first, then (apart) every older row still unparsed
  const first = await readParsedTransactionsTimed(env.connection, env.client, env.cluster, added, timeoutMs, env.live);
  alive();
  const raws = first.transactions;
  // a node that ran out of time on this load's rows is not asked again for the older ones: the cache alone
  const older = first.timedOut
    ? cachedParsedTransactions(env.client, env.cluster, loaded)
    : (await readParsedTransactionsTimed(env.connection, env.client, env.cluster, loaded, timeoutMs, env.live)).transactions;
  alive();
  for (const [signature, raw] of older) {
    raws.set(signature, raw);
  }
  const ctx = env.context(session.tokenAccountSources);
  return {
    sessionId: session.id,
    rows: items.map(item => {
      const raw = raws.get(item.signature);
      return {
        item,
        // the signature list is the authority for the signature, the slot and the time
        activity:
          raw === undefined
            ? null
            : {...classifyActivity(raw, account, item.status, ctx), signature: item.signature, slot: item.slot, blockTime: item.blockTime ?? raw.blockTime ?? null},
      };
    }),
    endReached: session.endReached,
    coverage: session.coverage,
  };
}
