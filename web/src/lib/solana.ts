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
