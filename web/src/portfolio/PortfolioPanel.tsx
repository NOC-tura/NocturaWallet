import {useWallet} from '@solana/wallet-adapter-react';
import {useBalances} from './useBalances';
import {usePrices} from './usePrices';
import {useChart} from './useChart';
import {Sparkline} from './Sparkline';
import {periodChangePct} from './periodChange';
import {formatAmount} from '../format';
import {valueHoldings, marketTotalUsd} from '../../../core/portfolio/value';
import {Icon} from '../ui/Icon';

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

export function PortfolioPanel({stagePriceUsd}: {stagePriceUsd: number}) {
  const {publicKey} = useWallet();
  const {sol, noc, usdc, usdt, isError, isLoading} = useBalances(publicKey ?? null);
  const {prices, isError: priceError} = usePrices();
  const chart = useChart(7);
  if (!publicKey) return null;

  const valued = valueHoldings({sol, noc, usdc, usdt}, prices, stagePriceUsd);
  const total = marketTotalUsd(valued);
  const change = chart.points ? periodChangePct(chart.points) : null;

  return (
    <section>
      <h2>
        <Icon name="pie" />
        Balances
      </h2>

      {/*
        Holdings lead; market value is the card's footer. It used to be the largest figure
        on the panel, and for a presale buyer — whose holding is NOC, which has no market
        before TGE — it was usually "$0.00" in 28 px over the numbers that mattered.
      */}
      <div className="noc-card holdings-card">
        {isLoading ? <p className="reading noc-body">Reading…</p> : null}
        {isError ? (
          <p className="read-error noc-body-sm">
            <Icon name="alert" />
            Balances could not be read. This is a connection problem, not a zero balance.
          </p>
        ) : null}

        {valued.length > 0 ? (
          <ul className="holdings">
            {valued.map(v => {
              const f = formatAmount(v.base, v.decimals, v.symbol);
              return (
                <li className="holding" key={v.symbol}>
                  <span className="amt-md" title={f.exact}>
                    <span className="noc-balance-md noc-numeral">
                      {f.text.slice(0, -(v.symbol.length + 1))}
                    </span>{' '}
                    <span className="noc-ticker">{v.symbol}</span>
                  </span>
                  {v.usd === null ? (
                    <span className="noc-caption noc-dim">{priceError ? 'price unavailable' : '—'}</span>
                  ) : (
                    <span className="holding-val noc-body-sm noc-numeral">
                      {usd(v.usd)}
                      {/* Said, not implied. There is no market for NOC before TGE, so this
                          is the presale price and not something anyone has paid on an
                          exchange. */}
                      {v.basis === 'stage' ? <span className="basis"> at stage price</span> : null}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        {/*
          MARKET value only, and the NOC row carries its own basis above. Folding NOC in
          would make one figure that is part market price and part a price the project set
          for itself, with nothing in the number saying which part is which.
        */}
        {total !== null ? (
          <div className="holding-total">
            <span className="noc-overline noc-dim">Market value</span>
            <span className="mv noc-numeral">{usd(total)}</span>
          </div>
        ) : null}
      </div>

      {/* The row appears only when there are real points to draw. A failed read leaves it
          out rather than showing an empty frame that implies a flat price. */}
      {chart.points ? (
        <div className="noc-card spark-card">
          <div className="spark-copy">
            <span className="noc-overline noc-dim">SOL · 7 days</span>
            <p className="spark-price">
              <span className="noc-balance-md noc-numeral">
                {prices.solana !== undefined ? usd(prices.solana) : '—'}
              </span>
              {change !== null ? (
                <span className={change >= 0 ? 'chg noc-success' : 'chg noc-danger'}>
                  {change >= 0 ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              ) : null}
            </p>
          </div>
          <Sparkline points={chart.points} width={160} height={44} label="SOL price over the last 7 days" />
        </div>
      ) : null}
    </section>
  );
}
