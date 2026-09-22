import type {ReferralStats} from '../../../core/referral';
import {buildReferralLink} from '../../../core/referral';
import {Icon} from '../ui/Icon';

export function ReferralPanel({address, stats}: {address: string; stats: ReferralStats}) {
  return (
    <section>
      <h2>
        <Icon name="users" />
        Referral
      </h2>
      <div className="noc-card-quiet">
        <span className="noc-overline noc-dim">Your link</span>
        {/* The link is the thing to copy, so it breaks rather than truncating: a shortened
            invite link is one a reader cannot check and cannot retype. */}
        <p data-testid="referral-link" className="noc-body-sm noc-mono link-break">
          {buildReferralLink(address)}
        </p>
      </div>

      <div className="stat-row">
        <div className="noc-card-quiet">
          <span className="noc-overline noc-dim">Referred</span>
          <p data-testid="referral-count" className="noc-balance-md noc-numeral">
            {stats.totalReferrals} referred
          </p>
        </div>
        <div className="noc-card-quiet">
          <span className="noc-overline noc-dim">Bonus</span>
          <p data-testid="referral-bonus" className="noc-balance-md noc-numeral">
            {stats.totalBonusNoc} NOC bonus
          </p>
        </div>
      </div>

      <p data-testid="referral-volume" className="noc-body-sm noc-dim noc-numeral">
        {stats.totalReferredNoc} NOC referred (${stats.totalReferredUsd})
      </p>
    </section>
  );
}
