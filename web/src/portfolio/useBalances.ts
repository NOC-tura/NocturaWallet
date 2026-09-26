import {useQuery} from '@tanstack/react-query';
import {PublicKey} from '@solana/web3.js';
import {connection} from '../lib/solana';
import {
  MAINNET_NOC_MINT,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
} from '../../../core/presale/addresses';

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

interface ParsedTokenAccount {
  account: {data: {parsed: {info: {mint: string; tokenAmount: {amount: string}}}}};
}

export interface Balances {
  sol: bigint | null;
  noc: bigint | null;
  usdc: bigint | null;
  usdt: bigint | null;
  isError: boolean;
  isLoading: boolean;
}

const EMPTY: Balances = {sol: null, noc: null, usdc: null, usdt: null, isError: false, isLoading: false};

/**
 * Polled, not subscribed. `onAccountChange` opens a WebSocket, and a `wss://` endpoint
 * would expose the RPC key exactly as the HTTP one would, so S0 asks on a timer.
 *
 * Every figure is `null` on failure and never 0: "0 NOC" and "we could not read your
 * balance" mean opposite things to someone checking whether their money arrived.
 */
export function useBalances(publicKey: PublicKey | null): Balances {
  const q = useQuery({
    queryKey: ['balances', publicKey?.toBase58() ?? null],
    enabled: publicKey !== null,
    refetchInterval: 20_000,
    queryFn: async () => {
      const owner = publicKey as PublicKey;
      // One token call for all three mints rather than one per mint. The RPC proxy
      // allows 240 requests a minute with an Origin, and this hook polls every 20 s from
      // two panels — three calls each would be a quarter of the budget for nothing.
      const [lamports, tokens] = await Promise.all([
        connection().getBalance(owner),
        connection().getParsedTokenAccountsByOwner(owner, {programId: TOKEN_PROGRAM}),
      ]);

      // Every account for a mint, not the derived ATA: this project has a wallet whose
      // tokens sit in a non-canonical account, and reading only the ATA reports a zero
      // that is not true.
      const sum = (mint: string): bigint =>
        (tokens.value as unknown as ParsedTokenAccount[]).reduce(
          (total, a) =>
            a.account.data.parsed.info.mint === mint
              ? total + BigInt(a.account.data.parsed.info.tokenAmount.amount)
              : total,
          0n,
        );

      return {
        sol: BigInt(lamports),
        noc: sum(MAINNET_NOC_MINT),
        usdc: sum(MAINNET_USDC_MINT),
        usdt: sum(MAINNET_USDT_MINT),
      };
    },
  });

  if (!publicKey) return EMPTY;
  if (q.isError || !q.data) {
    return {...EMPTY, isError: q.isError, isLoading: q.isPending};
  }
  return {...q.data, isError: false, isLoading: false};
}
