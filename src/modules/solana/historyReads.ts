/**
 * History spec (2026-11-26) §3.1, §3.3: the chain reads behind the history (#26), the detail (#27) and
 * the link scan — the source list, one page of signatures, and parsed transactions with their cache.
 *
 * THE CACHE: a landed transaction does not change, so a raw parsed transaction is kept per signature
 * under ['parsedTx', cluster, signature] with `staleTime: Infinity` and `gcTime: 24 h`
 * (`applyParsedTxDefaults`). A null answer (not indexed yet) and a failed read are NOT cached: the
 * signature is simply absent from the result, and the caller shows a partial row or retries.
 *
 * WHICH ANSWER IS WHOSE (plan review r2 C1): an answer is matched to a signature by ITS OWN
 * `transaction.signatures[0]`, never by its position in the batch. JSON-RPC 2.0 lets a node answer a
 * batch in any order — both public endpoints do — and web3.js hands the array over as it arrived.
 * Paired by position, transaction A would be shown, and cached for 24 h, on the row of signature B.
 * So: an answer that carries no signature, one nobody asked for, and a signature that two answers
 * of one batch claim are all dropped — that signature is unread (a partial row, asked for again),
 * never somebody else's transaction. The single read checks its one answer the same way.
 *
 * THE VERSION (owner decision 2026-11-27, spec §3.3): transactions are asked for with
 * `maxSupportedTransactionVersion: 1`, the highest web3.js 1.99 parses. A node that still refuses a
 * signature (a higher version, an old node, a rate limit) fails its batch; the one-at-a-time path
 * then leaves only that signature unread.
 *
 * THE LIMITER KEY (`rpcLimiter` dedupes in flight by key) holds the method and the cluster, plus the
 * owner and the token program for a source-list read, the source and its cursor for a signature
 * read, and a hash of EVERY signature for a batch — a shorter key would hand one page's answer to
 * another (review r2 m2). The source list has its OWN keys (not the dashboard's `getTokenAccounts:`):
 * a history read never joins a read that has no time limit.
 *
 * THE TIME LIMIT (plan review r1 I6): React Native's fetch has none, and the session serialises its
 * reads — one request that never settles would block "Load older" and pull-to-refresh for good.
 * Every chain call here is raced against HISTORY_READ_TIMEOUT_MS INSIDE the limiter's function, so
 * a timeout also frees the limiter's slot and its in-flight key (the retry is a new request, not a
 * join of the hung one). A read that times out is a failed read: nothing is cached, a retry works.
 * That inner limit starts only once a slot is free, and the app's other reads (the dashboard's, the
 * sheet's) have none: ten of them that never settle would hold every slot. So the whole call —
 * the wait for a slot included — is raced again against TWICE the limit (`limitedRead`, final
 * review 2, controller 2026-11-27): the caller always settles, at the latest after 2 × the limit.
 * When the BATCH times out the node is not answering: the same signatures are NOT asked for one at
 * a time (20 more limits in a row); they stay unread until the next load. The one-at-a-time path
 * stops at its first timeout for the same reason. And ONE call of `readParsedTransactions` has one
 * deadline (plan review r2 n2): once its time limit has passed since it began, it starts no further
 * batch and no further single read — a node that answers every request slowly, or with 429s that
 * web3.js itself waits out, cannot hold a load for twenty limits in a row.
 *
 * COST, stated honestly: a batch is one HTTP call carrying N JSON-RPC requests; providers count each.
 * The batch saves round trips, not quota.
 */
import {PublicKey} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import type {QueryClient} from '@tanstack/react-query';
import {sha256} from '@noble/hashes/sha2.js';
import {rpcLimiter} from './rpcLimiter';
import {tokenAccountsOf} from './queries';
import {TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID} from './activity';
import {TimeoutError, withTimeout} from './withTimeout';
import {HISTORY_MAX_SOURCES, HISTORY_PAGE_SIZE} from './historySession';
import type {SignatureItem, SourceList} from './historySession';
import type {RawParsedTx} from './txDetail';
import type {TokenAccount} from './types';

export const PARSED_TX_KEY = 'parsedTx';
export const PARSED_TX_GC_MS = 24 * 60 * 60 * 1000;
/** the limit of ONE chain call of the history, the detail and the link scan (the sync's own default, `treeSync.ts`) */
export const HISTORY_READ_TIMEOUT_MS = 20_000;
export const parsedTxKey = (cluster: string, signature: string): readonly [string, string, string] => [PARSED_TX_KEY, cluster, signature];

/**
 * One chain call of the history (final review 2): the read is limited inside the limiter's function
 * (that frees the slot and the in-flight key), and the whole call, its wait for a slot included, is
 * limited again at twice that — so the caller settles even while every slot is held by a read that
 * never does. An outer timeout leaves the queued request behind; when it runs later, its own inner
 * limit still bounds it.
 */
function limitedRead<T>(key: string, read: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return withTimeout(
    rpcLimiter.execute(key, () => withTimeout(read(), timeoutMs, label)),
    2 * timeoutMs,
    label,
  );
}

/** The client default `gcTime` (5 min) would collect them: every `parsedTx` entry lives 24 h and never goes stale. */
export function applyParsedTxDefaults(client: QueryClient): void {
  client.setQueryDefaults([PARSED_TX_KEY], {staleTime: Infinity, gcTime: PARSED_TX_GC_MS});
}

/**
 * §3.2: the wallet first, then its token accounts with a balance, then the empty ones (each group by
 * address, so the list is stable); at most HISTORY_MAX_SOURCES in all.
 */
export function orderSources(wallet: string, tokenAccounts: readonly TokenAccount[]): SourceList {
  const byAddress = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const funded = tokenAccounts.filter(a => a.amount !== '0').map(a => a.address).sort(byAddress);
  const empty = tokenAccounts.filter(a => a.amount === '0').map(a => a.address).sort(byAddress);
  const all = [...new Set([...funded, ...empty])].filter(a => a !== wallet);
  return {sources: [wallet, ...all.slice(0, HISTORY_MAX_SOURCES - 1)], tokenAccountsTotal: all.length};
}

/**
 * §3.1: every token account `owner` holds — classic AND Token-2022 — for the history's sources and
 * the link scan's. Either read failing (or timing out) fails the whole: a partial list would hide rows.
 */
export async function readOwnedTokenAccounts(
  connection: Connection,
  cluster: string,
  owner: string,
  timeoutMs: number = HISTORY_READ_TIMEOUT_MS,
): Promise<TokenAccount[]> {
  const key = new PublicKey(owner);
  const read = (program: string): Promise<TokenAccount[]> =>
    limitedRead(`historyTokenAccounts:${cluster}:${owner}:${program}`, () => tokenAccountsOf(connection, key, new PublicKey(program)), timeoutMs, 'history source list');
  const [classic, token2022] = await Promise.all([read(TOKEN_PROGRAM_ID), read(TOKEN_2022_PROGRAM_ID)]);
  return [...classic, ...token2022];
}

/** §3.1: the wallet and every token account it owns. */
export async function listHistorySources(
  connection: Connection,
  cluster: string,
  wallet: string,
  timeoutMs: number = HISTORY_READ_TIMEOUT_MS,
): Promise<SourceList> {
  return orderSources(wallet, await readOwnedTokenAccounts(connection, cluster, wallet, timeoutMs));
}

/** One page of a source's signatures, newest first. */
export async function getSignaturePage(
  connection: Pick<Connection, 'getSignaturesForAddress'>,
  cluster: string,
  source: string,
  before: string | undefined,
  limit: number,
  timeoutMs: number = HISTORY_READ_TIMEOUT_MS,
): Promise<SignatureItem[]> {
  const options: {limit: number; before?: string} = {limit};
  if (before !== undefined) {
    options.before = before;
  }
  const key = `getSignaturesForAddress:${cluster}:${source}:${before ?? 'head'}:${limit}`;
  return limitedRead(key, () => connection.getSignaturesForAddress(new PublicKey(source), options), timeoutMs, 'getSignaturesForAddress').then(signatures =>
    signatures.map(s => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime ?? null,
      status: s.err != null ? ('failed' as const) : s.confirmationStatus === 'finalized' ? ('finalized' as const) : ('confirmed' as const),
      finalized: s.confirmationStatus === 'finalized',
    })),
  );
}

function hashOf(signatures: readonly string[]): string {
  const digest = sha256(new TextEncoder().encode(signatures.join(',')));
  return Array.from(digest.subarray(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}

/** Version 1 is the highest web3.js 1.99 parses (spec §3.3, owner decision 2026-11-27). */
const READ_CONFIG = {maxSupportedTransactionVersion: 1} as const;

/** The signature an answer carries itself — the only thing that says which transaction it is. */
function ownSignature(answer: unknown): string | null {
  const first = (answer as RawParsedTx | null | undefined)?.transaction?.signatures?.[0];
  return typeof first === 'string' && first !== '' ? first : null;
}

/**
 * The answers of one batch, each under ITS OWN signature (never its position). Dropped: a null, an
 * answer without a signature, one for a signature that was not asked for, and BOTH answers when two
 * claim the same signature (which of them is right cannot be told).
 */
function matchBySignature(asked: readonly string[], answers: unknown): Map<string, RawParsedTx> {
  const wanted = new Set(asked);
  const own = new Map<string, RawParsedTx>();
  const claimedTwice = new Set<string>();
  for (const answer of Array.isArray(answers) ? (answers as unknown[]) : []) {
    const signature = ownSignature(answer);
    if (signature === null || !wanted.has(signature)) {
      continue;
    }
    if (own.has(signature)) {
      claimedTwice.add(signature);
    } else {
      own.set(signature, answer as RawParsedTx);
    }
  }
  for (const signature of claimedTwice) {
    own.delete(signature);
  }
  return own;
}

/**
 * One batch of at most HISTORY_PAGE_SIZE signatures: the batch call, else one at a time. `read` holds
 * what was read, by signature; a signature absent from it has no answer. A batch that was ANSWERED is
 * final — a signature it did not answer for is unread, not asked for again here. A batch that TIMED
 * OUT is not followed by single reads; the single reads stop at the first one that times out, and
 * none is started once `deadline` (a `Date.now()` value) has passed. `timedOut` reports all three:
 * a node that does not answer in time is not asked twenty more times.
 */
async function readChunk(
  connection: Pick<Connection, 'getParsedTransactions' | 'getParsedTransaction'>,
  cluster: string,
  chunk: string[],
  timeoutMs: number,
  deadline: number,
): Promise<{read: Map<string, RawParsedTx>; timedOut: boolean}> {
  try {
    const answers: unknown = await limitedRead(`getParsedTransactions:${cluster}:${hashOf(chunk)}`, () => connection.getParsedTransactions(chunk, READ_CONFIG), timeoutMs, 'getParsedTransactions');
    return {read: matchBySignature(chunk, answers), timedOut: false};
  } catch (e) {
    if (e instanceof TimeoutError) {
      return {read: new Map(), timedOut: true};
    }
    // refused or failed (one refused item fails the whole batch in web3.js): the same signatures, one at a time
  }
  const read = new Map<string, RawParsedTx>();
  for (const signature of chunk) {
    if (Date.now() >= deadline) {
      return {read, timedOut: true};
    }
    try {
      const tx = await readParsedTransaction(connection, cluster, signature, timeoutMs);
      if (tx !== null) {
        read.set(signature, tx);
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        return {read, timedOut: true};
      }
    }
  }
  return {read, timedOut: false};
}

/**
 * One transaction, uncached: null when the node has not indexed it — or answered with a transaction
 * whose own signature is not the one asked for (never shown as this one). Throws when the read fails
 * or times out.
 */
export async function readParsedTransaction(
  connection: Pick<Connection, 'getParsedTransaction'>,
  cluster: string,
  signature: string,
  timeoutMs: number = HISTORY_READ_TIMEOUT_MS,
): Promise<RawParsedTx | null> {
  const answer: unknown = await limitedRead(`getParsedTransaction:${cluster}:${signature}`, () => connection.getParsedTransaction(signature, READ_CONFIG), timeoutMs, 'getParsedTransaction');
  return ownSignature(answer) === signature ? (answer as RawParsedTx) : null;
}

/** What the cache already holds of `signatures` — no request. */
export function cachedParsedTransactions(client: QueryClient, cluster: string, signatures: readonly string[]): Map<string, RawParsedTx> {
  const out = new Map<string, RawParsedTx>();
  for (const signature of new Set(signatures)) {
    const cached = client.getQueryData<RawParsedTx>(parsedTxKey(cluster, signature));
    if (cached !== undefined) {
      out.set(signature, cached);
    }
  }
  return out;
}

/**
 * §3.3: the parsed transactions of `signatures`, from the cache where it has them. The rest is read
 * in batches of HISTORY_PAGE_SIZE: ONE batch call each; if a batch throws, one at a time. A signature
 * the node answers null for, has no answer of its own for, or whose read fails or times out, is
 * absent from `transactions` and is not cached. `timedOut`: a read got no answer within `timeoutMs`,
 * or the whole call ran past it — no further batch or single read was started, and what is left
 * stays unread until the next call. The time measured against that deadline includes any time a
 * request spent queued for a limiter slot, not only the time the node took.
 */
export async function readParsedTransactionsTimed(
  connection: Pick<Connection, 'getParsedTransactions' | 'getParsedTransaction'>,
  client: QueryClient,
  cluster: string,
  signatures: readonly string[],
  timeoutMs: number = HISTORY_READ_TIMEOUT_MS,
): Promise<{transactions: Map<string, RawParsedTx>; timedOut: boolean}> {
  const deadline = Date.now() + timeoutMs;
  const transactions = cachedParsedTransactions(client, cluster, signatures);
  const missing = [...new Set(signatures)].filter(signature => !transactions.has(signature));
  for (let from = 0; from < missing.length; from += HISTORY_PAGE_SIZE) {
    if (from > 0 && Date.now() >= deadline) {
      return {transactions, timedOut: true};
    }
    const chunk = missing.slice(from, from + HISTORY_PAGE_SIZE);
    const {read, timedOut} = await readChunk(connection, cluster, chunk, timeoutMs, deadline);
    for (const [signature, tx] of read) {
      client.setQueryData(parsedTxKey(cluster, signature), tx);
      transactions.set(signature, tx);
    }
    if (timedOut) {
      return {transactions, timedOut: true};
    }
  }
  // a call that ran past its limit says so, even when no single request timed out (ruling A, plan review r3)
  return {transactions, timedOut: Date.now() >= deadline};
}

/** `readParsedTransactionsTimed` for a caller that only wants the transactions (the link scan). */
export async function readParsedTransactions(
  connection: Pick<Connection, 'getParsedTransactions' | 'getParsedTransaction'>,
  client: QueryClient,
  cluster: string,
  signatures: readonly string[],
  timeoutMs: number = HISTORY_READ_TIMEOUT_MS,
): Promise<Map<string, RawParsedTx>> {
  return (await readParsedTransactionsTimed(connection, client, cluster, signatures, timeoutMs)).transactions;
}
