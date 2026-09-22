import {useWallet} from '@solana/wallet-adapter-react';
import {useBalances} from './useBalances';
import {usePrices} from './usePrices';
import {useChart} from './useChart';
import {Sparkline} from './Sparkline';
import {formatBaseUnits} from '../format';
import {valueHoldings, marketTotalUsd} from '../../../core/portfolio/value';
import {Icon} from '../ui/Icon';

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

export function PortfolioPanel({stagePriceUsd}: {stagePriceUsd: number}) {
  const {publicKey} = useWallet();
  const {sol, noc, usdc, usdt, isError, isLoading} = useBalances(publicKey ?? null);
  const {prices, solChange24h, isError: priceError} = usePrices();
  const chart = useChart(7);
  if (!publicKey) return null;

  const valued = valueHoldings({sol, noc, usdc, usdt}, prices, stagePriceUsd);
  const total = marketTotalUsd(valued);

  return (
    <section>
      <h2>
        <Icon name="pie" />
        Balances
      </h2>

      <div className="noc-card-quiet">
        {isLoading ? <p className="noc-body noc-muted">Reading…</p> : null}
        {isError ? (
          <p className="noc-body-sm noc-danger">
            Balances could not be read. This is a connection problem, not a zero balance.
          </p>
        ) : null}

        {/*
          MARKET value only, and the NOC row carries its own basis below. Folding NOC in
          would make one bold figure that is part market price and part a price the project
          set for itself, with nothing in the number saying which part is which.
        */}
        {total !== null ? (
          <div className="holding-total">
            <span className="noc-overline noc-dim">Market value</span>
            <p className="noc-balance-lg noc-numeral">{usd(total)}</p>
          </div>
        ) : null}

        {valued.map(v => (
          <div className="holding" key={v.symbol}>
            <span className="noc-body noc-numeral">
              {formatBaseUnits(v.base, v.decimals, v.symbol)}
            </span>
            {v.usd === null ? (
              <span className="noc-caption noc-dim">{priceError ? 'price unavailable' : '—'}</span>
            ) : (
              <span className="noc-caption noc-dim noc-numeral">
                {usd(v.usd)}
                {/* Said, not implied. There is no market for NOC before TGE, so this is the
                    presale price and not something anyone has paid on an exchange. */}
                {v.basis === 'stage' ? <span className="basis"> at stage price</span> : null}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* The row appears only when there are real points to draw. A failed read leaves it
          out rather than showing an empty frame that implies a flat price. */}
      {chart.points ? (
        <div className="noc-card-quiet spark-row">
          <div className="spark-copy">
            <span className="noc-overline noc-dim">SOL · 7 days</span>
            <p className="noc-body-lg noc-numeral">
              {prices.solana !== undefined ? usd(prices.solana) : '—'}
              {solChange24h !== null ? (
                <span className={solChange24h >= 0 ? 'chg noc-success' : 'chg noc-danger'}>
                  {solChange24h >= 0 ? '+' : ''}
                  {solChange24h.toFixed(2)}%
                </span>
              ) : null}
            </p>
          </div>
          <Sparkline points={chart.points} label="SOL price over the last 7 days" />
        </div>
      ) : null}
    </section>
  );
}
