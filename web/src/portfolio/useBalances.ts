import {useQuery} from '@tanstack/react-query';
import {PublicKey} from '@solana/web3.js';
import {connection} from '../lib/solana';
import {MAINNET_NOC_MINT} from '../../../core/presale/addresses';

const NOC_MINT = new PublicKey(MAINNET_NOC_MINT);

interface ParsedTokenAccount {
  account: {data: {parsed: {info: {tokenAmount: {amount: string}}}}};
}

export interface Balances {
  sol: bigint | null;
  noc: bigint | null;
  isError: boolean;
  isLoading: boolean;
}

/**
 * Polled, not subscribed. `onAccountChange` opens a WebSocket, and a `wss://` endpoint
 * would expose the RPC key exactly as the HTTP one would, so S0 asks on a timer.
 *
 * Both figures are `null` on failure and never 0: "0 NOC" and "we could not read your
 * balance" mean opposite things to someone checking whether their money arrived.
 */
export function useBalances(publicKey: PublicKey | null): Balances {
  const q = useQuery({
    queryKey: ['balances', publicKey?.toBase58() ?? null],
    enabled: publicKey !== null,
    refetchInterval: 20_000,
    queryFn: async () => {
      const owner = publicKey as PublicKey;
      const [lamports, tokens] = await Promise.all([
        connection().getBalance(owner),
        connection().getParsedTokenAccountsByOwner(owner, {mint: NOC_MINT}),
      ]);
      // Every account for the mint, not the derived ATA: this project has a wallet
      // whose tokens sit in a non-canonical account, and reading only the ATA reports
      // a zero that is not true.
      const noc = (tokens.value as unknown as ParsedTokenAccount[]).reduce(
        (sum, a) => sum + BigInt(a.account.data.parsed.info.tokenAmount.amount),
        0n,
      );
      return {sol: BigInt(lamports), noc};
    },
  });

  if (!publicKey) return {sol: null, noc: null, isError: false, isLoading: false};
  if (q.isError || !q.data) {
    return {sol: null, noc: null, isError: q.isError, isLoading: q.isPending};
  }
  return {sol: q.data.sol, noc: q.data.noc, isError: false, isLoading: false};
}
