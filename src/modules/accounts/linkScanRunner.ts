/**
 * History spec (2026-11-26) §6.4: WHEN the "linked" scan runs, and its wiring to the chain, the
 * encrypted store and the registry. `linkScan.ts` holds the rule and the paging.
 *
 * The Accounts sheet opens → (after `drainLinkQueue`) every fresh-exit account not yet tagged is
 * scanned, one at a time, in the background. The sheet renders at once; a tag appears when found.
 *   - SINGLE-FLIGHT: an open while a scan runs joins it.
 *   - MINIMUM INTERVAL: 60 s per exit, held in memory.
 *   - GENERATION GUARD: `onSecureMmkvReset` (a wipe, an import, a new encrypted instance) bumps a
 *     generation; a tag or a cursor from an older generation is dropped — the wallet it belongs to
 *     is gone (the class of the sync's wallet-change guard, 237752a).
 *   - A failure is silent: nothing is shown, and the next open after the interval tries again.
 *
 * THE RECORDS live in the ENCRYPTED store only (`v1_linkScanCursors`,
 * `{[exit]: {seeds: <digest>, sources: {[source]: LinkScanRecord}}}`): a list of one's own accounts and their
 * token accounts is itself a link. A wipe removes them with the store. A record is valid only for the seed
 * set it was scanned against (`seeds` = sha256 of the sorted addresses): when a wallet joins the seed the
 * exit's records are ignored — it is read from the head again — and replaced on the next write; only the
 * latest set is kept. A stored value that does not decode is no record (re-read), never "read through".
 */
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';
import type {Connection} from '@solana/web3.js';
import type {QueryClient} from '@tanstack/react-query';
import type {MMKV} from 'react-native-mmkv';
import {mmkvSecure, onSecureMmkvReset} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {NETWORK} from '../../constants/programs';
import {getConnection} from '../solana/connection';
import {getSignaturePage, parsedTxKey, readOwnedTokenAccounts, readParsedTransactions} from '../solana/historyReads';
import {markA0AccountsLinked} from '../shielded/a0/accountRegistry';
import type {AccountList} from './accountList';
import {readAccountList, refreshAccounts} from './selectedAccount';
import {scanExitForLinks} from './linkScan';
import type {LinkScanDeps, LinkScanRecord, LinkScanResult} from './linkScan';

export const LINK_SCAN_MIN_INTERVAL_MS = 60_000;
const KEY = MMKV_KEYS.LINK_SCAN_CURSORS;

let generation = 0;
let inFlight: Promise<number> | null = null;
const lastRun = new Map<string, number>();
let hooked = false;

/** Registered on first use, not at import: a screen test that stubs `instances` loads this module too. */
function hook(): void {
  if (hooked) {
    return;
  }
  hooked = true;
  onSecureMmkvReset(() => {
    generation += 1;
    inFlight = null;
    lastRun.clear();
  });
}

/** thrown by a read of a scan whose wallet is gone (review I1) */
export class StaleLinkScanError extends Error {
  constructor() {
    super('the wallet this link scan started for is gone');
    this.name = 'StaleLinkScanError';
  }
}

export interface LinkScanRunnerEnv {
  /** the account list as stored now; null when it cannot be read */
  accounts: () => AccountList | null;
  /** scan one exit; `live()` is false once the wallet was replaced — writes must check it */
  scanExit: (exit: string, seedWallets: ReadonlySet<string>, live: () => boolean) => Promise<LinkScanResult>;
  now: () => number;
  /** a tag was written: the sheet re-reads the list */
  onLinked: () => void;
}

/** Scan every scannable exit, one at a time; resolves to the number of accounts newly tagged. Never rejects. */
export function runLinkScans(env: LinkScanRunnerEnv): Promise<number> {
  hook();
  if (inFlight !== null) {
    return inFlight; // an open while a scan runs joins it
  }
  const mine = generation;
  const live = (): boolean => mine === generation;
  const work = async (): Promise<number> => {
    let linked = 0;
    let list: AccountList | null;
    try {
      list = env.accounts();
    } catch {
      return 0;
    }
    if (list === null || list.unreadable) {
      return 0;
    }
    // fresh-exit and not yet tagged only; `accounts` never lists a fresh-pending reservation, and never tags main
    const exits = list.accounts.filter(a => a.role === 'fresh-exit' && !a.linked);
    for (const first of exits) {
      if (!live()) {
        break;
      }
      // review M1: an earlier exit's link may have tagged this one (a link tags every seed wallet it names) —
      // read the list again and skip it; the seed set is the current one too
      let current: AccountList | null;
      try {
        current = env.accounts();
      } catch {
        break;
      }
      if (current === null || current.unreadable) {
        break;
      }
      list = current;
      const exit = list.accounts.find(a => a.address === first.address);
      if (exit === undefined || exit.role !== 'fresh-exit' || exit.linked) {
        continue;
      }
      const now = env.now();
      const last = lastRun.get(exit.address);
      if (last !== undefined && now >= last && now - last < LINK_SCAN_MIN_INTERVAL_MS) {
        continue;
      }
      lastRun.set(exit.address, now);
      // every address of this seed the registry knows (main and fresh-pending included), except the exit
      const seedWallets = new Set(list.seed.map(s => s.address).filter(a => a !== exit.address));
      let result: LinkScanResult;
      try {
        result = await env.scanExit(exit.address, seedWallets, live);
      } catch {
        result = 'failed';
      }
      if (result === 'linked' && live()) {
        linked += 1;
        try {
          env.onLinked();
        } catch {
          // a list that cannot be re-read now is re-read on the next open
        }
      }
    }
    return linked;
  };
  const run: Promise<number> = work()
    .catch(() => 0)
    .finally(() => {
      if (inFlight === run) {
        inFlight = null;
      }
    });
  inFlight = run;
  return run;
}

type StoredExit = {seeds: string; sources: Record<string, unknown>};

function readAll(store: MMKV): Record<string, unknown> {
  const raw = store.getString(KEY);
  if (raw === undefined) {
    return {};
  }
  try {
    const v: unknown = JSON.parse(raw);
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {}; // a malformed value is no record: the scan starts over and rewrites it
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
// a base58 transaction signature is 64 bytes: 86-88 characters; 64-90 leaves room, and rules out anything else
const SIGNATURE_SHAPE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
const isSignature = (v: unknown): v is string => typeof v === 'string' && SIGNATURE_SHAPE.test(v);

function storedExit(all: Record<string, unknown>, exit: string): StoredExit | undefined {
  const e = all[exit];
  return isObject(e) && typeof e.seeds === 'string' && isObject(e.sources) ? {seeds: e.seeds, sources: e.sources} : undefined;
}

/** Decodes one stored record defensively; anything that does not fit is undefined (= re-read, not "read through"). */
function decodeRecord(v: unknown): LinkScanRecord | undefined {
  if (!isObject(v)) {
    return undefined;
  }
  const record: LinkScanRecord = {};
  if (v.cursor !== undefined) {
    if (!isSignature(v.cursor)) {
      return undefined;
    }
    record.cursor = v.cursor;
  }
  if (v.pending !== undefined) {
    const p = v.pending;
    if (!isObject(p) || !isSignature(p.resumeBelow) || (p.newest !== undefined && !isSignature(p.newest))) {
      return undefined;
    }
    record.pending = p.newest === undefined ? {resumeBelow: p.resumeBelow} : {newest: p.newest as string, resumeBelow: p.resumeBelow};
  }
  return record;
}

/** sha256 over the sorted, newline-joined addresses of the seed set (a set: order never matters). */
export function linkScanSeedDigest(seedWallets: ReadonlySet<string>): string {
  return bytesToHex(sha256(utf8ToBytes([...seedWallets].sort().join('\n'))));
}

/** The record of one exit's source, if it was scanned against THIS seed set (`seedDigest`); undefined otherwise. */
export function readLinkScanRecord(store: MMKV, exit: string, seedDigest: string, source: string): LinkScanRecord | undefined {
  const e = storedExit(readAll(store), exit);
  if (e === undefined || e.seeds !== seedDigest) {
    return undefined;
  }
  return decodeRecord(e.sources[source]);
}

/** Writes one record; an exit stored under another seed set is replaced (only the latest set is kept). */
export function writeLinkScanRecord(store: MMKV, exit: string, seedDigest: string, source: string, record: LinkScanRecord): void {
  const all = readAll(store);
  const e = storedExit(all, exit);
  const sources = e !== undefined && e.seeds === seedDigest ? e.sources : {};
  store.set(KEY, JSON.stringify({...all, [exit]: {seeds: seedDigest, sources: {...sources, [source]: record}}}));
}

/** §6.3: the exit wallet and EVERY token account it owns, classic and Token-2022 (no bound: the cap is per source). */
export async function linkScanSources(connection: Connection, exit: string): Promise<string[]> {
  const owned = await readOwnedTokenAccounts(connection, NETWORK, exit);
  // as history orders them: the wallet, the funded token accounts, then the empty ones (each by address). Nothing is
  // dropped — a token transfer into an exit's account need not name the wallet, so a skipped account could hide a link
  const byAddress = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const funded = owned.filter(a => a.amount !== '0').map(a => a.address).sort(byAddress);
  const empty = owned.filter(a => a.amount === '0').map(a => a.address).sort(byAddress);
  return [...new Set([exit, ...funded, ...empty])];
}

/**
 * The chain reads and the two writes of ONE wallet's scans. `store` is the encrypted instance the
 * scan started with. A write belongs to the wallet the scan started for, so it needs BOTH: the same
 * generation (`live()`) AND `store` still being the open instance — a record written through a stale
 * handle would put the old wallet's account addresses into the store the next wallet opens.
 */
export function linkScanDepsFor(
  store: MMKV,
  connection: Connection,
  client: QueryClient,
  live: () => boolean,
  seedWallets: ReadonlySet<string>,
): LinkScanDeps {
  const digest = linkScanSeedDigest(seedWallets);
  const mayWrite = (): boolean => live() && mmkvSecure() === store;
  // review I1: a scan that outlives its wallet stops READING too. The throw is an unread source -> `failed`, never `clean`
  const alive = (): void => {
    if (!mayWrite()) {
      throw new StaleLinkScanError();
    }
  };
  return {
    listSources: async e => {
      alive();
      const sources = await linkScanSources(connection, e);
      alive();
      return sources;
    },
    fetchSignatures: async (source, before, limit) => {
      alive();
      const page = await getSignaturePage(connection, NETWORK, source, before, limit);
      alive();
      return page;
    },
    readTransactions: async signatures => {
      alive();
      const txs = await readParsedTransactions(connection, client, NETWORK, signatures);
      if (!mayWrite()) {
        // the batch in flight when the wallet went: its entries must not outlive the wipe in the shared cache
        for (const signature of signatures) {
          client.removeQueries({queryKey: parsedTxKey(NETWORK, signature), exact: true});
        }
        throw new StaleLinkScanError();
      }
      return txs;
    },
    getRecord: (e, source) => readLinkScanRecord(store, e, digest, source),
    setRecord: (e, source, record) => {
      if (mayWrite()) {
        writeLinkScanRecord(store, e, digest, source, record);
      }
    },
    // the exit plus every other seed wallet the transaction named; the registry tags fresh-exit entries only, so main is never tagged
    markLinked: wallets => {
      if (mayWrite()) {
        markA0AccountsLinked(wallets, {bound: store});
      }
    },
  };
}

/**
 * The Accounts sheet's call (§6.4). `mainAddress` is walletStore.publicKey; `client` holds the shared
 * `parsedTx` cache. Resolves to the number of accounts newly tagged; the scans never reject, and a failure to even start them is a rejection (never a throw). With the encrypted
 * store closed nothing is read: the registry and the cursors live there.
 */
export function scanLinksForWallet(mainAddress: string | null, client: QueryClient): Promise<number> {
  try {
    const store = mmkvSecure();
    if (!mainAddress || store === null) {
      return Promise.resolve(0);
    }
    const connection = getConnection();
    return runLinkScans({
      accounts: () => readAccountList(mainAddress),
      now: () => Date.now(),
      onLinked: () => {
        refreshAccounts(mainAddress);
      },
      scanExit: (exit, seedWallets, live) => scanExitForLinks(exit, seedWallets, linkScanDepsFor(store, connection, client, live, seedWallets)),
    });
  } catch (e) {
    return Promise.reject(e); // review M3: a failure before any promise exists reaches the caller's .catch, not its stack
  }
}
