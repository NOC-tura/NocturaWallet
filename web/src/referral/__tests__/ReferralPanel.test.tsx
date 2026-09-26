import {render, screen} from '@testing-library/react';
import {ReferralPanel} from '../ReferralPanel';
import {buildReferralLink} from '../../../../core/referral';

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

  it('splits base and address so a line can only break between them', () => {
    // The live page broke the link mid-address ("…CoaAe / 1myqKAT…"): a link nobody can
    // retype or check by eye. Two no-wrap runs leave one legal break point.
    const {container} = render(<ReferralPanel address={ADDR} stats={STATS} />);
    expect(container.querySelector('.link-base')?.textContent).toBe('https://noc-tura.io?ref=');
    expect(container.querySelector('.link-ref')?.textContent).toBe(ADDR);
    expect(screen.getByTestId('referral-link').textContent).toBe(buildReferralLink(ADDR));
  });

  it('offers the whole link to copy', () => {
    render(<ReferralPanel address={ADDR} stats={STATS} />);
    expect(screen.getByRole('button', {name: 'Copy link'})).toBeTruthy();
  });

  it('shows the bonus exactly as the allocation shows the same credit', () => {
    // The live figures: the coordinator's totalBonusNoc is the very credit the chain holds,
    // 16.142571618. Under the allocation it read 16.1425; in this card it read 16.14 —
    // one number, two precisions, on the same screen.
    render(<ReferralPanel address={ADDR} stats={{...STATS, totalBonusNoc: 16.142571618}} />);
    const bonus = screen.getByTestId('referral-bonus');
    expect(bonus.textContent).toBe('16.1425 NOC');
    expect(bonus.getAttribute('title')).toBe('16.142571618 NOC');
  });

  it('never rounds the bonus up', () => {
    // 0.99999 to two places is "1": a card claiming a whole NOC that was never credited.
    render(<ReferralPanel address={ADDR} stats={{...STATS, totalBonusNoc: 0.99999}} />);
    expect(screen.getByTestId('referral-bonus').textContent).toBe('0.9999 NOC');
  });

  it('prints the referred volume in dollars the way every other amount is printed', () => {
    render(<ReferralPanel address={ADDR} stats={{...STATS, totalReferredUsd: 1234.5}} />);
    expect(screen.getByTestId('referral-volume').textContent).toMatch(/\(\$1,234\.50\)$/);
  });
});
