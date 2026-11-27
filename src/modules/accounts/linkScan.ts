/**
 * History spec (2026-11-26) §6: the retroactive "linked" scan. An exit account is LINKED when one
 * transaction holds both it and another wallet of this seed (H4) — whichever way the funds went, and
 * whether or not the transaction succeeded. The tag is written by `markLinked` and is never removed.
 *
 * WHY TOKEN ACCOUNTS: a transfer into an existing token account does not list the owner wallet, so
 * both sides are also matched through the owners named in the token balances, and an exit is scanned
 * through its own address AND every token account it owns (§6.3).
 *
 * THE TAG IS A LOWER BOUND (§9): it reads at most LINK_SCAN_CAP signatures per source per scan, and
 * only the token accounts the exit owns now. A third party can put two wallets of one seed into one
 * transaction (dust); the tag then errs on the warning side.
 *
 * THE RECORD, per exit and source (`LinkScanRecord`): `cursor` is the newest FINALIZED signature fully scanned. A signature that is
 * only confirmed is scanned but never becomes the cursor (it could still be dropped), so it is
 * scanned again. Nothing moves when a transaction could not be read. A scan the CAP stopped keeps the old cursor
 * and records `pending` (where it stopped); the next scan resumes there, so no signature is skipped for good
 * (Task 9 review, controller 2026-11-27).
 *
 * Pure: every read and every write is handed in (`LinkScanDeps`).
 */
import {keyString} from '../solana/txDetail';
import type {RawParsedTx} from '../solana/txDetail';
import type {SignatureItem} from '../solana/historySession';

export const LINK_SCAN_PAGE = 20;
/** §6.3: every scan of a source, first or later, reads at most this many signatures */
export const LINK_SCAN_CAP = 300;

export type LinkScanResult = 'linked' | 'clean' | 'capped' | 'failed';
// 'clean' = every source read through to its cursor or its end; 'capped' = at least one source stopped at
// LINK_SCAN_CAP and has `pending` history left (not a failure, not a finished scan).

/**
 * What is stored per exit and source (Task 10 persists it). `cursor`: the newest finalized signature
 * fully scanned. `pending`: a scan the cap stopped — `newest` is the newest finalized signature read, and
 * becomes the cursor once the gap is read; `resumeBelow` is the oldest signature read so far.
 */
export interface LinkScanRecord {
  cursor?: string;
  pending?: {newest?: string; resumeBelow: string};
}

export interface LinkScanDeps {
  /** the exit wallet and every token account it owns (classic and Token-2022) */
  listSources: (exit: string) => Promise<string[]>;
  /** newest first; `before` undefined reads from the head. The page must be UNFILTERED: a short page ends the scan. */
  fetchSignatures: (source: string, before: string | undefined, limit: number) => Promise<SignatureItem[]>;
  /** a signature absent from the answer could not be read (null from the node, or a failed read) */
  readTransactions: (signatures: string[]) => Promise<Map<string, RawParsedTx>>;
  getRecord: (exit: string, source: string) => LinkScanRecord | undefined;
  setRecord: (exit: string, source: string, record: LinkScanRecord) => void;
  /** the exit and every other seed wallet the link names; the registry tags fresh-exit entries only — never main */
  markLinked: (wallets: string[]) => void;
}

/**
 * §6.2. The OTHER seed wallets this transaction holds, when it also holds the exit (as an account key, or the
 * owner of a token balance); [] otherwise. A wallet counts through its key or through a token account it owns.
 * `meta.err` is not consulted: a failed transaction is public too.
 */
export function linkedSeedWallets(raw: RawParsedTx, exit: string, seedWallets: ReadonlySet<string>): string[] {
  const present = new Set((raw.transaction?.message?.accountKeys ?? []).map(k => keyString(k.pubkey)));
  for (const b of [...(raw.meta?.preTokenBalances ?? []), ...(raw.meta?.postTokenBalances ?? [])]) {
    if (typeof b.owner === 'string' && b.owner !== '') {
      present.add(b.owner);
    }
  }
  if (!present.has(exit)) {
    return [];
  }
  return [...seedWallets].filter(wallet => wallet !== exit && present.has(wallet));
}

export function transactionLinks(raw: RawParsedTx, exit: string, seedWallets: ReadonlySet<string>): boolean {
  return linkedSeedWallets(raw, exit, seedWallets).length > 0;
}

type RangeOutcome =
  | {kind: 'linked'; wallets: string[]}
  | {kind: 'unread' | 'end' | 'cap'; read: number; newestFinalized: string | undefined; oldest: string | undefined};

/** Reads one source from `start` (exclusive; undefined = the head) down to `stopAt` (matched by value) or the end, at most `budget` signatures. */
async function readRange(
  exit: string,
  source: string,
  seedWallets: ReadonlySet<string>,
  deps: LinkScanDeps,
  start: string | undefined,
  stopAt: string | undefined,
  budget: number,
): Promise<RangeOutcome> {
  let before = start;
  let read = 0;
  let newestFinalized: string | undefined;
  let oldest: string | undefined;
  let unread = false;
  for (;;) {
    const page = await deps.fetchSignatures(source, before, LINK_SCAN_PAGE);
    // the cursor is matched by value (not `until`): everything above it is new
    const at = stopAt === undefined ? -1 : page.findIndex(x => x.signature === stopAt);
    const fresh = (at >= 0 ? page.slice(0, at) : page).slice(0, budget - read);
    if (fresh.length > 0) {
      const txs = await deps.readTransactions(fresh.map(x => x.signature));
      for (const item of fresh) {
        const raw = txs.get(item.signature);
        if (raw === undefined) {
          unread = true; // keep looking for a link, but nothing of this source will move
        } else {
          const wallets = linkedSeedWallets(raw, exit, seedWallets);
          if (wallets.length > 0) {
            return {kind: 'linked', wallets};
          }
        }
      }
      newestFinalized = newestFinalized ?? fresh.find(x => x.finalized)?.signature;
      oldest = fresh[fresh.length - 1]!.signature;
      read += fresh.length;
    }
    const ended = at >= 0 || page.length < LINK_SCAN_PAGE;
    if (ended || read >= budget) {
      return {kind: unread ? 'unread' : ended ? 'end' : 'cap', read, newestFinalized, oldest};
    }
    before = page[page.length - 1]!.signature;
  }
}

type SourceOutcome = {kind: 'linked'; wallets: string[]} | {kind: 'clean' | 'capped' | 'failed'};

async function scanSource(exit: string, source: string, seedWallets: ReadonlySet<string>, deps: LinkScanDeps): Promise<SourceOutcome> {
  let record: LinkScanRecord = deps.getRecord(exit, source) ?? {};
  let budget = LINK_SCAN_CAP;
  if (record.pending !== undefined) {
    // 1. the gap an earlier capped scan left: from where it stopped, down to the old cursor (or the end)
    const gap = await readRange(exit, source, seedWallets, deps, record.pending.resumeBelow, record.cursor, budget);
    if (gap.kind === 'linked') {
      return gap;
    }
    if (gap.kind === 'unread') {
      return {kind: 'failed'};
    }
    if (gap.kind === 'cap') {
      const resumeBelow = gap.oldest ?? record.pending.resumeBelow;
      deps.setRecord(exit, source, {cursor: record.cursor, pending: {newest: record.pending.newest, resumeBelow}});
      return {kind: 'capped'};
    }
    record = {cursor: record.pending.newest ?? record.cursor};
    deps.setRecord(exit, source, record);
    budget -= gap.read;
    if (budget <= 0) {
      return {kind: 'capped'}; // the head above the promoted cursor is read by the next scan
    }
  }
  // 2. the head, down to the cursor
  const head = await readRange(exit, source, seedWallets, deps, undefined, record.cursor, budget);
  if (head.kind === 'linked') {
    return head;
  }
  if (head.kind === 'unread') {
    return {kind: 'failed'};
  }
  if (head.kind === 'cap') {
    // the old cursor stays: what lies between this scan's oldest signature and it is still to be read
    deps.setRecord(exit, source, {cursor: record.cursor, pending: {newest: head.newestFinalized, resumeBelow: head.oldest!}});
    return {kind: 'capped'};
  }
  if (head.newestFinalized !== undefined) {
    deps.setRecord(exit, source, {cursor: head.newestFinalized});
  }
  return {kind: 'clean'};
}

/**
 * §6.3: scan one exit. A link → `markLinked([exit, ...the other seed wallets it names])` and 'linked' (no cursor
 * is needed after a link). A source that fails does not stop the others — a link may still be found there — but
 * the result is then 'failed' and that source's record stays where it was. A source the cap stopped makes the
 * result 'capped' (unless one failed). Never throws.
 */
export async function scanExitForLinks(exit: string, seedWallets: ReadonlySet<string>, deps: LinkScanDeps): Promise<LinkScanResult> {
  let sources: string[];
  try {
    sources = await deps.listSources(exit);
  } catch {
    return 'failed';
  }
  let failed = false;
  let capped = false;
  for (const source of sources) {
    let outcome: SourceOutcome;
    try {
      outcome = await scanSource(exit, source, seedWallets, deps);
    } catch {
      outcome = {kind: 'failed'};
    }
    if (outcome.kind === 'linked') {
      try {
        deps.markLinked([exit, ...outcome.wallets]);
      } catch {
        return 'failed'; // the registry could not be written: the next scan finds the link again
      }
      return 'linked';
    }
    if (outcome.kind === 'failed') {
      failed = true;
    } else if (outcome.kind === 'capped') {
      capped = true;
    }
  }
  return failed ? 'failed' : capped ? 'capped' : 'clean';
}
