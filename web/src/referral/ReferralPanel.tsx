import type {ReferralStats} from '../../../core/referral';
import {buildReferralLink} from '../../../core/referral';

export function ReferralPanel({address, stats}: {address: string; stats: ReferralStats}) {
  return (
    <section>
      <h2>Referral</h2>
      <p data-testid="referral-link">{buildReferralLink(address)}</p>
      <p data-testid="referral-count">{stats.totalReferrals} referred</p>
      <p data-testid="referral-bonus">{stats.totalBonusNoc} NOC bonus</p>
      <p data-testid="referral-volume">
        {stats.totalReferredNoc} NOC referred (${stats.totalReferredUsd})
      </p>
    </section>
  );
}
