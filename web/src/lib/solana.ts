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
