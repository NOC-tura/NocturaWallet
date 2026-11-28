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
 * becomes the cursor once the gap is read (optional in the type: only a record decoded from storage can lack it; the
 * scan always writes it); `resumeBelow` is the oldest signature read so far.
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
  | {kind: 'end' | 'cap'; unread: boolean; read: number; newestFinalized: string | undefined; oldest: SignatureItem | undefined};

/**
 * Reads one source from `start` (exclusive; undefined = the head) down to `stopAt` (matched by value) or the end,
 * at most `budget` signatures. A page the budget trimmed is NEVER an end (Task 9 re-review). Unread transactions
 * do not stop the walk: a link may still lie below them.
 */
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
  let oldest: SignatureItem | undefined;
  let unread = false;
  for (;;) {
    const page = await deps.fetchSignatures(source, before, LINK_SCAN_PAGE);
    // the stop is matched by value (not `until`): everything above it is new
    const at = stopAt === undefined ? -1 : page.findIndex(x => x.signature === stopAt);
    const upTo = at >= 0 ? page.slice(0, at) : page;
    const fresh = upTo.slice(0, Math.max(0, budget - read));
    const trimmed = fresh.length < upTo.length;
    if (fresh.length > 0) {
      const txs = await deps.readTransactions(fresh.map(x => x.signature));
      for (const item of fresh) {
        const raw = txs.get(item.signature);
        if (raw === undefined) {
          unread = true;
        } else {
          const wallets = linkedSeedWallets(raw, exit, seedWallets);
          if (wallets.length > 0) {
            return {kind: 'linked', wallets};
          }
        }
      }
      newestFinalized = newestFinalized ?? fresh.find(x => x.finalized)?.signature;
      oldest = fresh[fresh.length - 1]!;
      read += fresh.length;
    }
    const ended = !trimmed && (at >= 0 || page.length < LINK_SCAN_PAGE);
    if (ended) {
      return {kind: 'end', unread, read, newestFinalized, oldest};
    }
    if (read >= budget) {
      return {kind: 'cap', unread, read, newestFinalized, oldest};
    }
    before = page[page.length - 1]!.signature;
  }
}

type SourceOutcome = {kind: 'linked'; wallets: string[]} | {kind: 'clean' | 'capped' | 'failed'};

/**
 * Principle: RE-READING is always safe, SKIPPING never is (Task 9 re-review, controller 2026-11-27). The budget
 * (LINK_SCAN_CAP) is shared by two passes. The HEAD pass always comes first: from the top down to
 * `pending.newest ?? cursor`. Then, if a gap is pending, the GAP pass: from `pending.resumeBelow` down to the old cursor.
 * Anything unread → 'failed' and the record does not move (a link found in either pass still wins).
 */
async function scanSource(exit: string, source: string, seedWallets: ReadonlySet<string>, deps: LinkScanDeps): Promise<SourceOutcome> {
  const record: LinkScanRecord = deps.getRecord(exit, source) ?? {};
  const pending = record.pending;
  const head = await readRange(exit, source, seedWallets, deps, undefined, pending?.newest ?? record.cursor, LINK_SCAN_CAP);
  if (head.kind === 'linked') {
    return head;
  }
  if (head.kind === 'cap') {
    if (head.unread) {
      return {kind: 'failed'};
    }
    // the old cursor stays; what lies below the oldest signature read is still to be read. Only a finalized
    // signature is stored as a resume point (a dropped one would read as an empty page, i.e. an end).
    if (head.newestFinalized !== undefined && head.oldest !== undefined && head.oldest.finalized) {
      deps.setRecord(exit, source, {cursor: record.cursor, pending: {newest: head.newestFinalized, resumeBelow: head.oldest.signature}});
    }
    return {kind: 'capped'};
  }
  if (pending === undefined) {
    if (head.unread) {
      return {kind: 'failed'};
    }
    if (head.newestFinalized !== undefined) {
      deps.setRecord(exit, source, {cursor: head.newestFinalized});
    }
    return {kind: 'clean'};
  }
  const newest = head.newestFinalized ?? pending.newest;
  const gap = await readRange(exit, source, seedWallets, deps, pending.resumeBelow, record.cursor, LINK_SCAN_CAP - head.read);
  if (gap.kind === 'linked') {
    return gap;
  }
  if (head.unread || gap.unread) {
    return {kind: 'failed'};
  }
  if (gap.kind === 'end') {
    deps.setRecord(exit, source, {cursor: newest ?? record.cursor});
    return {kind: 'clean'};
  }
  const resumeBelow = gap.oldest !== undefined && gap.oldest.finalized ? gap.oldest.signature : pending.resumeBelow;
  deps.setRecord(exit, source, {cursor: record.cursor, pending: {newest, resumeBelow}});
  return {kind: 'capped'};
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
