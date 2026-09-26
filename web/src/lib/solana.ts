import {Connection, PublicKey} from '@solana/web3.js';
import {rpcEndpoint} from '../config';

let cached: Connection | null = null;

/** One Connection for the page, pointed at our same-origin proxy. */
export function connection(): Connection {
  if (!cached) cached = new Connection(rpcEndpoint(), 'confirmed');
  return cached;
}

/** The narrow reader core asks for, backed by that Connection. */
export const accountReader = {
  getAccountInfo: async (address: PublicKey) => {
    const info = await connection().getAccountInfo(address);
    return info ? {data: info.data} : null;
  },
};

/**
 * The signature reader `verifySignatures` asks for.
 *
 * `searchTransactionHistory` is not optional here: without it the RPC answers only from
 * its recent-signature cache, so every purchase older than a couple of days comes back
 * null — and null means "the chain does not have this". Forgetting the flag would print
 * "not found on chain" under every historic purchase on the page.
 */
export const signatureStatusReader = {
  getSignatureStatuses: async (signatures: string[]) => {
    const {value} = await connection().getSignatureStatuses(signatures, {
      searchTransactionHistory: true,
    });
    return value.map(v => (v === null ? null : {err: v.err}));
  },
};

/**
 * Every transaction that touched an account, with its logs.
 *
 * Paginated deliberately, and a page that cannot be read aborts the whole walk rather
 * than returning what it has: a short answer here is indistinguishable from a complete
 * one, and the caller reconciles against an exact total, so a silently truncated history
 * would present as a mismatch — or worse, as a match that happens to land.
 */
export async function accountTransactions(address: PublicKey) {
  const conn = connection();
  const out: {signature: string; blockTime: number | null; logs: string[]}[] = [];
  let before: string | undefined;
  for (;;) {
    const page = await conn.getSignaturesForAddress(address, {limit: 1000, before});
    if (page.length === 0) break;
    for (const s of page) {
      const tx = await conn.getTransaction(s.signature, {maxSupportedTransactionVersion: 0});
      if (!tx) throw new Error(`transaction ${s.signature} could not be read`);
      out.push({
        signature: s.signature,
        blockTime: s.blockTime ?? null,
        logs: tx.meta?.logMessages ?? [],
      });
    }
    if (page.length < 1000) break;
    before = page[page.length - 1]?.signature;
  }
  return out;
}
