/**
 * History spec §4.6, §3.3: #27 reads the RAW parsed transaction from the same per-signature cache the
 * history fills (['parsedTx', cluster, signature]; never stale, kept 24 h), so a row opened from #26
 * costs no request. A transaction the node has not indexed yet is an error, not data — a null answer
 * is never cached — and is asked for again every 4 s until it is there.
 */
import {useQuery} from '@tanstack/react-query';
import {NETWORK} from '../constants/programs';
import {getConnection} from '../modules/solana/connection';
import {parsedTxKey, readParsedTransaction} from '../modules/solana/historyReads';
import type {RawParsedTx} from '../modules/solana/txDetail';

export const PARSED_TX_RETRY_MS = 4_000;

export function useParsedTx(signature: string | null): {raw: RawParsedTx | undefined; isLoading: boolean; notFound: boolean} {
  const query = useQuery<RawParsedTx>({
    queryKey: parsedTxKey(NETWORK, signature ?? ''),
    queryFn: async () => {
      const tx = signature ? await readParsedTransaction(getConnection(), NETWORK, signature) : null;
      if (tx === null) {
        throw new Error('transaction not indexed yet');
      }
      return tx;
    },
    enabled: !!signature,
    retry: false,
    // the app client's defaults for this key apply too; stated here so the hook is right under any client
    staleTime: Infinity,
    refetchInterval: q => (q.state.data ? false : PARSED_TX_RETRY_MS),
  });
  return {
    raw: query.data,
    isLoading: query.data === undefined && !query.isError,
    notFound: query.data === undefined && query.isError,
  };
}
