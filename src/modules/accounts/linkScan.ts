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
 * THE CURSOR, per exit and source: the newest FINALIZED signature fully scanned. A signature that is
 * only confirmed is scanned but never becomes the cursor (it could still be dropped), so it is
 * scanned again. Nothing moves when a transaction could not be read.
 *
 * Pure: every read and every write is handed in (`LinkScanDeps`).
 */
import {keyString} from '../solana/txDetail';
import type {RawParsedTx} from '../solana/txDetail';
import type {SignatureItem} from '../solana/historySession';

export const LINK_SCAN_PAGE = 20;
/** §6.3: every scan of a source, first or later, reads at most this many signatures */
export const LINK_SCAN_CAP = 300;

export type LinkScanResult = 'linked' | 'clean' | 'failed';

export interface LinkScanDeps {
  /** the exit wallet and every token account it owns (classic and Token-2022) */
  listSources: (exit: string) => Promise<string[]>;
  /** newest first; `before` undefined reads from the head */
  fetchSignatures: (source: string, before: string | undefined, limit: number) => Promise<SignatureItem[]>;
  /** a signature absent from the answer could not be read (null from the node, or a failed read) */
  readTransactions: (signatures: string[]) => Promise<Map<string, RawParsedTx>>;
  getCursor: (exit: string, source: string) => string | undefined;
  setCursor: (exit: string, source: string, signature: string) => void;
  /** tags fresh-exit entries only — never the main account */
  markLinked: (exit: string) => void;
}

/**
 * §6.2. True when the transaction's account keys (the full list) hold BOTH the exit — or a token
 * account whose owner in the token balances is the exit — AND a wallet of `seedWallets` — or a token
 * account owned by one. `meta.err` is not consulted: a failed transaction is public too.
 */
export function transactionLinks(raw: RawParsedTx, exit: string, seedWallets: ReadonlySet<string>): boolean {
  const present = new Set((raw.transaction?.message?.accountKeys ?? []).map(k => keyString(k.pubkey)));
  for (const b of [...(raw.meta?.preTokenBalances ?? []), ...(raw.meta?.postTokenBalances ?? [])]) {
    if (typeof b.owner === 'string' && b.owner !== '') {
      present.add(b.owner);
    }
  }
  if (!present.has(exit)) {
    return false;
  }
  for (const wallet of seedWallets) {
    if (wallet !== exit && present.has(wallet)) {
      return true;
    }
  }
  return false;
}

async function scanSource(exit: string, source: string, seedWallets: ReadonlySet<string>, deps: LinkScanDeps): Promise<LinkScanResult> {
  const cursor = deps.getCursor(exit, source);
  let before: string | undefined;
  let read = 0;
  let newestFinalized: string | undefined;
  let unread = false;
  for (;;) {
    const page = await deps.fetchSignatures(source, before, LINK_SCAN_PAGE);
    // the cursor is matched by value (not `until`): everything above it is new
    const at = cursor === undefined ? -1 : page.findIndex(x => x.signature === cursor);
    const fresh = (at >= 0 ? page.slice(0, at) : page).slice(0, LINK_SCAN_CAP - read);
    if (fresh.length > 0) {
      const txs = await deps.readTransactions(fresh.map(x => x.signature));
      for (const item of fresh) {
        const raw = txs.get(item.signature);
        if (raw === undefined) {
          unread = true; // keep looking for a link, but this source's cursor will not move
        } else if (transactionLinks(raw, exit, seedWallets)) {
          return 'linked';
        }
      }
      newestFinalized = newestFinalized ?? fresh.find(x => x.finalized)?.signature;
      read += fresh.length;
    }
    if (at >= 0 || page.length < LINK_SCAN_PAGE || read >= LINK_SCAN_CAP) {
      break;
    }
    before = page[page.length - 1]!.signature;
  }
  if (unread) {
    return 'failed';
  }
  // also when the cap stopped the scan: older history is not scanned (§9)
  if (newestFinalized !== undefined) {
    deps.setCursor(exit, source, newestFinalized);
  }
  return 'clean';
}

/**
 * §6.3: scan one exit. A link → `markLinked(exit)` and 'linked' (no cursor is needed after a link).
 * A source that fails does not stop the others — a link may still be found there — but the result is
 * then 'failed' and that source's cursor stays where it was. Never throws.
 */
export async function scanExitForLinks(exit: string, seedWallets: ReadonlySet<string>, deps: LinkScanDeps): Promise<LinkScanResult> {
  let sources: string[];
  try {
    sources = await deps.listSources(exit);
  } catch {
    return 'failed';
  }
  let failed = false;
  for (const source of sources) {
    let outcome: LinkScanResult;
    try {
      outcome = await scanSource(exit, source, seedWallets, deps);
    } catch {
      outcome = 'failed';
    }
    if (outcome === 'linked') {
      try {
        deps.markLinked(exit);
      } catch {
        return 'failed'; // the registry could not be written: the next scan finds the link again
      }
      return 'linked';
    }
    if (outcome === 'failed') {
      failed = true;
    }
  }
  return failed ? 'failed' : 'clean';
}
