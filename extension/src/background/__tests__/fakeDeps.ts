import type {WalletDeps} from '../deps';
import type {SolanaReader} from '../../../../core/solana/rpc';

const unexpected = (name: string) => async (): Promise<never> => {
  throw new Error(`unexpected RPC call: ${name}`);
};

/** A reader where every method fails loudly unless a test overrides it. Nothing opens a socket. */
export function fakeReader(overrides: Partial<SolanaReader> = {}): SolanaReader {
  return {
    getBalance: unexpected('getBalance'),
    getAccountExists: unexpected('getAccountExists'),
    getMultipleLamports: unexpected('getMultipleLamports'),
    getLatestBlockhash: unexpected('getLatestBlockhash'),
    getBlockHeight: unexpected('getBlockHeight'),
    getSignatureStatuses: unexpected('getSignatureStatuses'),
    getRecentPrioritizationFees: unexpected('getRecentPrioritizationFees'),
    simulateTransaction: unexpected('simulateTransaction'),
    getTokenAccountsByOwner: unexpected('getTokenAccountsByOwner'),
    getSignaturesForAddress: unexpected('getSignaturesForAddress'),
    getTransaction: unexpected('getTransaction'),
    ...overrides,
  };
}

/**
 * Deterministic deps: a settable clock, counting random bytes, prices for SOL/USDC/USDT, a sleep
 * that never resolves (no poller runs unless a test asks for one), and a broadcast that fails
 * unless a test overrides it.
 */
export function fakeDeps(overrides: Partial<WalletDeps> = {}): WalletDeps & {clock: {t: number}; broadcasts: Uint8Array[]} {
  const clock = {t: 1_000_000};
  const broadcasts: Uint8Array[] = [];
  let counter = 0;
  return {
    reader: fakeReader(),
    broadcast: async () => {
      throw new Error('unexpected broadcast');
    },
    prices: async () => ({solana: 150, usdc: 1, usdt: 1}),
    stagePrice: async () => 0.1501,
    now: () => clock.t,
    randomBytes: n => {
      counter += 1;
      return new Uint8Array(n).fill(counter % 256);
    },
    sleep: () => new Promise<void>(() => undefined),
    ...overrides,
    clock,
    broadcasts,
  };
}
