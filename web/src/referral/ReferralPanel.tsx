import type {ReferralStats} from '../../../core/referral';
import {buildReferralLink} from '../../../core/referral';
import {Icon} from '../ui/Icon';
import {CopyButton} from '../ui/CopyButton';

/** Two decimals for a glanceable figure; the chain's full precision belongs to an
 *  allocation, not to a summary card. Kept tolerant of a non-numeric string rather than
 *  rendering NaN at someone. */
function formatNoc(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2})
    : String(value);
}

export function ReferralPanel({address, stats}: {address: string; stats: ReferralStats}) {
  const link = buildReferralLink(address);
  // Everything before the address. Derived from the link rather than restated, so the
  // two runs below can never disagree with what buildReferralLink produces.
  const base = link.slice(0, link.length - address.length);
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
            {/* Two decimals here, not the chain's nine: this is a figure to glance at, and
                "40.247084996 NOC bonus" wrapped across two lines inside a small card. The
                exact number is the allocation above, which IS shown to the last unit. */}
            <p data-testid="referral-bonus" className="noc-balance-md noc-numeral">
              {formatNoc(stats.totalBonusNoc)}
              <span className="noc-ticker"> NOC</span>
            </p>
          </div>
        </div>
        {/* Under the row rather than beside it: the same fact at a coarser grain, not a
            third statistic competing for a track. */}
        <p data-testid="referral-volume" className="noc-caption noc-dim noc-numeral">
          {formatNoc(stats.totalReferredNoc)} NOC referred (${stats.totalReferredUsd})
        </p>
      </div>
    </section>
  );
}
