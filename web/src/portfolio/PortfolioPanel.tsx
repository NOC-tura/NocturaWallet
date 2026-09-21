import {useWallet} from '@solana/wallet-adapter-react';
import {useBalances} from './useBalances';
import {formatBaseUnits} from '../format';

export function PortfolioPanel() {
  const {publicKey} = useWallet();
  const {sol, noc, isError, isLoading} = useBalances(publicKey ?? null);
  if (!publicKey) return null;

  return (
    <section>
      <h2>Balances</h2>
      {isLoading ? <p>Reading…</p> : null}
      {isError ? <p>Balances could not be read. This is a connection problem, not a zero balance.</p> : null}
      {sol !== null ? <p>{formatBaseUnits(sol, 9, 'SOL')}</p> : null}
      {noc !== null ? <p>{formatBaseUnits(noc, 9, 'NOC')}</p> : null}
    </section>
  );
}
