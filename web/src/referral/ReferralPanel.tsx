import type {ReferralStats} from '../../../core/referral';
import {buildReferralLink} from '../../../core/referral';
import {Icon} from '../ui/Icon';
import {CopyButton} from '../ui/CopyButton';
import {formatAmount} from '../format';

/** Two decimals for the referred volume — other people's purchases, a figure to glance
 *  at, not a holding of yours. Kept tolerant of a non-numeric value rather than rendering
 *  NaN at someone. */
function formatNoc(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2})
    : String(value);
}

const NOC_DECIMALS = 9;

/**
 * The coordinator sends NOC as a JSON number (16.142571618). Into base units through its
 * fixed-point string rather than by multiplying, so the conversion is exact at nine
 * places. Null for anything that is not a finite, non-negative amount.
 */
function nocBase(value: number): bigint | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const [whole = '0', frac = ''] = value.toFixed(NOC_DECIMALS).split('.');
  return BigInt(whole) * 10n ** BigInt(NOC_DECIMALS) + BigInt(frac.padEnd(NOC_DECIMALS, '0'));
}

/** Money always carries both places: "$65.5" is a typo, "$65.50" is an amount. */
const usd = (n: number) =>
  `$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

export function ReferralPanel({address, stats}: {address: string; stats: ReferralStats}) {
  const link = buildReferralLink(address);
  // Everything before the address. Derived from the link rather than restated, so the
  // two runs below can never disagree with what buildReferralLink produces.
  const base = link.slice(0, link.length - address.length);
  const bonus = nocBase(stats.totalBonusNoc);
  return (
    <section>
      <h2>
        <Icon name="users" />
        Referral
      </h2>
      <div className="noc-card">
        <div className="ref-head">
          <span className="noc-overline noc-dim">Your link</span>
          <CopyButton value={link} label="Copy link" />
        </div>
        {/* Never truncated: a shortened invite link is one a reader cannot check and
            cannot retype. Two no-wrap runs, so the only place a line can break is between
            the base and the address — never inside the address, which is what the live
            page did. */}
        <p data-testid="referral-link" className="link-field noc-mono">
          <span className="link-base">{base}</span>
          <span className="link-ref">{address}</span>
        </p>
      </div>

      <div className="stat-group">
        <div className="stat-row">
          <div className="noc-card stat">
            <span className="noc-overline noc-dim">Referred</span>
            {/* The overline already says "Referred"; repeating the word beside the figure
                made the card read twice and wrap to two lines in a 1fr track. */}
            <p data-testid="referral-count" className="noc-balance-md noc-numeral">
              {stats.totalReferrals}
            </p>
          </div>
          <div className="noc-card stat">
            <span className="noc-overline noc-dim">Bonus</span>
            {/*
              The same rule as the allocation: four decimals, truncated, the exact figure
              on hover. It was two, rounded — so the one credit read 16.1425 under the
              allocation and 16.14 here, and 0.99999 would have read as a whole NOC. The
              two-place version existed because nine places wrapped in the old narrow
              card; four fit in this one.
            */}
            {bonus !== null ? (
              <p
                data-testid="referral-bonus"
                className="amt-md"
                title={formatAmount(bonus, NOC_DECIMALS, 'NOC').exact}
              >
                <span className="noc-balance-md noc-numeral">
                  {formatAmount(bonus, NOC_DECIMALS, 'NOC').text.replace(/ NOC$/, '')}
                </span>{' '}
                <span className="noc-ticker">NOC</span>
              </p>
            ) : (
              <p data-testid="referral-bonus" className="noc-balance-md noc-numeral">
                {formatNoc(stats.totalBonusNoc)}
                <span className="noc-ticker"> NOC</span>
              </p>
            )}
          </div>
        </div>
        {/* Under the row rather than beside it: the same fact at a coarser grain, not a
            third statistic competing for a track. */}
        <p data-testid="referral-volume" className="noc-caption noc-dim noc-numeral">
          {formatNoc(stats.totalReferredNoc)} NOC referred ({usd(stats.totalReferredUsd)})
        </p>
      </div>
    </section>
  );
}
