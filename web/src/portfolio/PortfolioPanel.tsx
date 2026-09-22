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
      <div className="noc-card-quiet">
        {isLoading ? <p className="noc-body noc-muted">Reading…</p> : null}
        {isError ? (
          <p className="noc-body-sm noc-danger">
            Balances could not be read. This is a connection problem, not a zero balance.
          </p>
        ) : null}
        {/* NOC first and largest: it is what this page is about. SOL is what pays for it. */}
        {noc !== null ? <p className="noc-balance-lg noc-numeral">{formatBaseUnits(noc, 9, 'NOC')}</p> : null}
        {sol !== null ? <p className="noc-body noc-muted noc-numeral">{formatBaseUnits(sol, 9, 'SOL')}</p> : null}
      {/*
        Shown only when held. A row reading "0 USDC" on a wallet that has never touched
        one is noise; a row that appears when there is something to spend is an answer to
        "what can I pay with". Stablecoins carry 6 decimals, not 9 — the same distinction
        the amount field makes.
      */}
        {usdc !== null && usdc > 0n ? (
          <p className="noc-body noc-muted noc-numeral">{formatBaseUnits(usdc, 6, 'USDC')}</p>
        ) : null}
        {usdt !== null && usdt > 0n ? (
          <p className="noc-body noc-muted noc-numeral">{formatBaseUnits(usdt, 6, 'USDT')}</p>
        ) : null}
      </div>
    </section>
  );
}
