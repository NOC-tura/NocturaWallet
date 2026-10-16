import type {Ext} from '../../ext';

/**
 * The transactions a site had this wallet sign (spec B1c §3.3: "The sent transaction appears in #26 with the design's
 * 'Dapp · simulated' origin badge"; index.html #26b, #27b): each one's id — its first signature, the fee payer's —
 * the origin, and when. Written by the signAndSendTransaction effect when it records the signed bytes, and by the
 * signTransaction effect for each transaction the account pays for (its id is then the account's own signature — the
 * dApp may broadcast it); never for a signature another signer made. History reads it to badge a row (history.ts).
 * storage.local, background-owned (v1_dapp_txs), newest first, at most MAX_DAPP_TXS; every write inside store.ts's
 * dappSection (dappMutex → sessionMutex); wiped by a delete, kept by a restore (C11, as the grants).
 */
export const DAPP_TXS_KEY = 'v1_dapp_txs';
export const MAX_DAPP_TXS = 500;

export interface DappTx {
  signature: string;
  origin: string;
  at: number;
}

const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const ORIGIN = /^https:\/\/[^\s/?#@]+$/;

/** The stored list, re-validated, fresh objects, newest first; anything else reads as none. */
export function dappTxsOf(x: unknown): DappTx[] {
  if (!Array.isArray(x)) return [];
  const out: DappTx[] = [];
  const seen = new Set<string>();
  for (const item of x as unknown[]) {
    if (out.length >= MAX_DAPP_TXS) break;
    if (typeof item !== 'object' || item === null) continue;
    const {signature, origin, at} = item as Record<string, unknown>;
    if (typeof signature !== 'string' || !SIGNATURE.test(signature) || seen.has(signature)) continue;
    if (typeof origin !== 'string' || !ORIGIN.test(origin) || typeof at !== 'number' || !Number.isSafeInteger(at) || at < 0) continue;
    seen.add(signature);
    out.push({signature, origin, at});
  }
  return out;
}

/** The list with these transactions first (a signature already listed moves to the front); at most MAX_DAPP_TXS. */
export function withDappTxs(list: readonly DappTx[], added: readonly DappTx[]): DappTx[] {
  const ids = new Set(added.map(t => t.signature));
  return [...added, ...list.filter(t => !ids.has(t.signature))].slice(0, MAX_DAPP_TXS);
}

/** History's read (read-only, no section needed): which signatures a site had signed here. */
export async function dappTxSignatures(ext: Ext): Promise<Set<string>> {
  return new Set(dappTxsOf(await ext.local.get(DAPP_TXS_KEY)).map(t => t.signature));
}
