import {render, screen} from '@testing-library/react';
import {ReferralPanel} from '../ReferralPanel';

const ADDR = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const STATS = {
  totalReferrals: 3,
  totalBaseBonusNoc: 10,
  totalExtraBonusNoc: 2.5,
  totalBonusNoc: 12.5,
  totalReferredNoc: 500,
  totalReferredUsd: 75,
  tierBonusCount: 1,
};

describe('ReferralPanel', () => {
  it('renders the address-based link the website records', () => {
    render(<ReferralPanel address={ADDR} stats={STATS} />);
    expect(screen.getByTestId('referral-link').textContent).toBe(`https://noc-tura.io?ref=${ADDR}`);
  });

  it('labels each figure, so no number is ambiguous', () => {
    // Queried by testid on purpose: getByText(/3/) also matches the address, and RTL
    // throws on multiple matches.
    render(<ReferralPanel address={ADDR} stats={STATS} />);
    expect(screen.getByTestId('referral-count').textContent).toContain('3');
    expect(screen.getByTestId('referral-bonus').textContent).toContain('12.5');
    expect(screen.getByTestId('referral-volume').textContent).toContain('500');
  });

  it('renders zeros as zeros rather than as blanks', () => {
    render(<ReferralPanel address={ADDR} stats={{...STATS, totalReferrals: 0, totalBonusNoc: 0}} />);
    expect(screen.getByTestId('referral-count').textContent).toContain('0');
    expect(screen.getByTestId('referral-bonus').textContent).toContain('0');
  });
});
