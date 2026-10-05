import {Sheet} from '../ui/Sheet';
import {TokenTile} from '../ui/TokenTile';
import {TOKEN_INFO, showAmount, showUsd} from '../format';
import {valuation} from '../valuation';
import type {Balances, Prices, Token} from '../engine';

/**
 * #43 token selector (D18: the design's bottom sheet, as a list of the four tokens). Built in plan 1
 * with the sheet it shares with the account switcher; #12 opens it (plan 3). With no balances read yet
 * (`null`), each row's amount and value read "—" — never 0 (§7.3).
 */
export function TokenSheet({balances, prices, selected, onSelect, onClose}: {balances: Balances | null; prices: Prices | null; selected: Token; onSelect: (t: Token) => void; onClose: () => void}) {
  const v = balances === null ? null : valuation(balances, prices);
  return (
    <Sheet title="Choose a token" onClose={onClose}>
      <div className="list">
        {(['SOL', 'NOC', 'USDC', 'USDT'] as const).map(t => (
          <button
            type="button"
            key={t}
            className={`row app-token-row${t === selected ? ' sel' : ''}`}
            aria-pressed={t === selected}
            onClick={() => {
              onSelect(t);
              onClose();
            }}
          >
            <TokenTile token={t} size={32} />
            <span>
              {/* index.html #s43's "All tokens" rows: the name, then the symbol under it. */}
              <span className="pri">{TOKEN_INFO[t].name}</span>
              <span className="sec">{t}</span>
            </span>
            <span>
              <span className="amt">{v === null ? '—' : showAmount(t, v.rows[t].base)}</span>
              <span className="fiat">
                {v === null || v.rows[t].usd === null ? '—' : showUsd(v.rows[t].usd)}
                {t === 'NOC' && v !== null && v.rows[t].usd !== null ? ' at stage price' : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
