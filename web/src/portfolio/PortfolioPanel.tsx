import {useWallet} from '@solana/wallet-adapter-react';
import {useBalances} from './useBalances';
import {formatBaseUnits} from '../format';

export function PortfolioPanel() {
  const {publicKey} = useWallet();
  const {sol, noc, usdc, usdt, isError, isLoading} = useBalances(publicKey ?? null);
  if (!publicKey) return null;

  return (
    <section>
      <h2>Balances</h2>
      {isLoading ? <p>Reading…</p> : null}
      {isError ? <p>Balances could not be read. This is a connection problem, not a zero balance.</p> : null}
      {sol !== null ? <p>{formatBaseUnits(sol, 9, 'SOL')}</p> : null}
      {noc !== null ? <p>{formatBaseUnits(noc, 9, 'NOC')}</p> : null}
      {/*
        Shown only when held. A row reading "0 USDC" on a wallet that has never touched
        one is noise; a row that appears when there is something to spend is an answer to
        "what can I pay with". Stablecoins carry 6 decimals, not 9 — the same distinction
        the amount field makes.
      */}
      {usdc !== null && usdc > 0n ? <p>{formatBaseUnits(usdc, 6, 'USDC')}</p> : null}
      {usdt !== null && usdt > 0n ? <p>{formatBaseUnits(usdt, 6, 'USDT')}</p> : null}
    </section>
  );
}
