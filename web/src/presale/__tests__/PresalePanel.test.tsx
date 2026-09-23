import {render, screen} from '@testing-library/react';
import {PresalePanel} from '../PresalePanel';

const stats = {
  displayStage: 2,
  pricePerNocUsd: 0.1723,
  soldInStageBase: '0',
  stageCapacityBase: '10240000000000000',
  isPaused: false,
};

describe('PresalePanel', () => {
  it('shows the stage and the price a buyer is quoted', () => {
    render(<PresalePanel stats={stats} allocation={{status: 'absent'}} />);
    expect(screen.getByText(/stage 2/i)).toBeTruthy();
    expect(screen.getByText(/0\.1723/)).toBeTruthy();
  });

  it('shows the allocation when the read succeeded and found one', () => {
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '1234000000000', referralBonusBase: null}} />);
    expect(screen.getByText('1,234 NOC')).toBeTruthy();
  });

  it('says "no allocation" only when the read succeeded and found none', () => {
    render(<PresalePanel stats={stats} allocation={{status: 'absent'}} />);
    expect(screen.getByText(/no allocation/i)).toBeTruthy();
  });

  it('says the read FAILED when it failed — never "no allocation"', () => {
    // The one that matters. "We could not read your allocation" and "you have none"
    // are opposite statements to someone checking whether their money arrived, and an
    // RPC outage must never produce the second.
    render(<PresalePanel stats={stats} allocation={{status: 'error'}} />);
    expect(screen.queryByText(/no allocation/i)).toBeNull();
    expect(screen.getByText(/could not be read/i)).toBeTruthy();
  });

  it('shows no allocation section at all when no wallet is connected', () => {
    // It used to print a third "Connect a wallet to …" here, under a heading with nothing
    // beneath it. The connect panel above already explains what connecting is for; this
    // section now simply does not exist until there is a wallet to have an allocation.
    render(<PresalePanel stats={stats} allocation={{status: 'disconnected'}} />);
    expect(screen.queryByRole('heading', {name: /your allocation/i})).toBeNull();
    expect(screen.queryByText(/reading/i)).toBeNull();
    expect(screen.queryByText(/no allocation/i)).toBeNull();
    expect(screen.queryByText(/could not be read/i)).toBeNull();
  });

  it('still shows the stage, the price and the progress with no wallet', () => {
    // The point of the change above is NOT to hide the presale behind connecting. A page
    // that shows a visitor nothing until they connect is the habit phishing relies on.
    render(<PresalePanel stats={stats} allocation={{status: 'disconnected'}} />);
    expect(screen.getByText(/stage 2/i)).toBeTruthy();
    expect(screen.getByText(/0\.1723/)).toBeTruthy();
  });

  it('shows the stage total in whole NOC, not to the ninth decimal', () => {
    // What the live page printed: "1,279,937.425329514 NOC of 10,240,000 NOC".
    // Asserted on the section's text rather than on one node: the figure now sits in a
    // meta row where the sold amount is bold and the capacity is not, so the sentence is
    // split across elements. The claim is about what the reader sees, not the markup.
    const {container} = render(
      <PresalePanel
        stats={{...stats, soldInStageBase: '1279937425329514'}}
        allocation={{status: 'disconnected'}}
      />,
    );
    expect(container.textContent).toMatch(/1,279,937 NOC of/);
    expect(container.textContent).not.toMatch(/425329514/);
  });

  it('shows an allocation at four decimals, with the last unit still reachable', () => {
    // This test used to demand all nine decimals, on the reasoning that the smallest unit
    // is the buyer's money. The money argument survives; the display argument did not.
    // "773.484343768 NOC" is not a figure anyone reads — the ninth decimal of a NOC is
    // around a hundred-millionth of a cent — and a number no one can read is not a number
    // anyone can check. So four on screen, all nine on the element itself, which is where
    // someone who wants to compare against the chain goes.
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '773484343768', referralBonusBase: null}} />);
    const node = screen.getByText('773.4843 NOC');
    expect(node.getAttribute('title')).toBe('773.484343768 NOC');
  });

  it('never rounds the allocation up, because that would overstate the holding', () => {
    // 0.99999 rounded to four places is 1.0 — a page claiming a whole NOC the buyer does
    // not have. Truncation can only ever understate, which is the safe direction.
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '999990000', referralBonusBase: null}} />);
    expect(screen.getByText('0.9999 NOC')).toBeTruthy();
  });

  it('shows a dust allocation in full rather than printing a flat zero', () => {
    // Truncating 4 base units to four decimals gives "0 NOC", which says the buyer holds
    // nothing. That is a different claim, not a shorter one.
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '4', referralBonusBase: null}} />);
    expect(screen.getByText('0.000000004 NOC')).toBeTruthy();
  });

  it('says nothing about an allocation while the read is still running', () => {
    render(<PresalePanel stats={stats} allocation={{status: 'loading'}} />);
    expect(screen.queryByText(/no allocation/i)).toBeNull();
    expect(screen.queryByText(/could not be read/i)).toBeNull();
  });

  it('marks the presale paused when the backend says so', () => {
    render(<PresalePanel stats={{...stats, isPaused: true}} allocation={{status: 'absent'}} />);
    expect(screen.getByText(/paused/i)).toBeTruthy();
  });

  it('shows progress through the current stage', () => {
    render(
      <PresalePanel
        stats={{...stats, soldInStageBase: '5120000000000000'}}
        allocation={{status: 'absent'}}
      />,
    );
    expect(screen.getByText(/50(\.0)?%/)).toBeTruthy();
  });
});

describe('PresalePanel referral bonus', () => {
  const ok = (base: string, referralBonusBase: string | null) =>
    ({status: 'ok', base, referralBonusBase}) as const;

  it('names the referral bonus, so the allocation can be added up', () => {
    // The mainnet case: 533.710859424 bought across five purchases + 16.142571618
    // credited by someone else's first purchase = the 549.853431042 on screen. Without
    // this line a buyer who sums their own history is 16 NOC short and cannot tell why.
    const {container} = render(
      <PresalePanel stats={stats} allocation={ok('549853431042', '16142571618')} />,
    );
    expect(screen.getByText('549.8534 NOC')).toBeTruthy();
    expect(container.textContent).toMatch(
      /includes 16\.1425 NOC that did not come from your own purchases/,
    );
  });

  it('says nothing when there is nothing credited outside the holder\'s purchases', () => {
    const {container} = render(<PresalePanel stats={stats} allocation={ok('549853431042', '0')} />);
    expect(container.textContent).not.toMatch(/did not come from your own purchases/i);
  });

  it('does not call an admin giveaway a referral bonus', () => {
    // The mainnet account that carries both: 80.539640239 awarded by referrals plus
    // 40.247084996 added by admin_add_allocation, whose log says ADMIN_GIVEAWAY and
    // whose code comment says the field is reused for giveaway tracking. The field
    // cannot distinguish them, so the copy must not claim to.
    const {container} = render(
      <PresalePanel stats={stats} allocation={ok('1964890655947', '120786725235')} />,
    );
    expect(container.textContent).toMatch(/includes 120\.7867 NOC that did not come from/);
    expect(container.textContent).not.toMatch(/earned as a referral bonus/);
  });

  it('says nothing when the bonus could not be read', () => {
    // null is "we do not know", and an unknown must not be printed as a zero or as a
    // figure. Silence is the only honest rendering of it.
    const {container} = render(<PresalePanel stats={stats} allocation={ok('549853431042', null)} />);
    expect(container.textContent).not.toMatch(/did not come from your own purchases/i);
  });
});

describe('PresalePanel itemised credits', () => {
  const ok = (base: string, referralBonusBase: string | null) =>
    ({status: 'ok', base, referralBonusBase}) as const;
  const SIG = 'jS8QcYTyTw16Qh2vNRqWhpwSywiXz2oDoJ2uvsZX66RR2vWUHcze6DJJC7tcBMUDzQwZzA6QhdUFF7K1fQzVKaz';

  it('makes the credit checkable: amount, kind, date and a link to the chain', () => {
    // The mainnet account of 2026-09-23: the whole allocation is one project credit and
    // there are no purchases at all, so the sentence alone left its owner nothing to
    // check against.
    render(
      <PresalePanel
        stats={stats}
        allocation={ok('188607594936', '188607594936')}
        credits={[{kind: 'giveaway', base: 188_607_594_936n, signature: SIG, blockTime: 1790143419}]}
      />,
    );
    const link = screen.getByRole('link', {name: /jS8QcYTy/});
    expect(link.getAttribute('href')).toBe(`https://explorer.solana.com/tx/${SIG}`);
    expect(link.getAttribute('title')).toBe(SIG);
    // Scoped to the row: the allocation total above happens to be the same figure here,
    // because the whole allocation IS this credit.
    const row = screen.getByRole('listitem');
    expect(row.textContent).toMatch(/^188\.6075 NOC added by the project · 2026-09-23/);
  });

  it('names a referral bonus as a referral bonus', () => {
    render(
      <PresalePanel
        stats={stats}
        allocation={ok('549853431042', '16142571618')}
        credits={[{kind: 'referral', base: 16_142_571_618n, signature: SIG, blockTime: null}]}
      />,
    );
    // Scoped to the row, because the sentence above legitimately contains the phrase
    // "an allocation added by the project" as one of the possibilities it lists.
    const row = screen.getByRole('listitem');
    expect(row.textContent).toMatch(/^16\.1425 NOC referral bonus/);
    expect(row.textContent).not.toMatch(/added by the project/);
    expect(row.textContent).not.toMatch(/·\s*$/);
  });

  it('draws no empty list when there is nothing to itemise', () => {
    // A mutation survived without this: dropping the length check rendered an empty <ul>,
    // which is a frame around nothing rather than an absence.
    render(<PresalePanel stats={stats} allocation={ok('549853431042', '0')} credits={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('keeps the unitemised sentence when attribution did not reconcile', () => {
    // credits === null is "nothing to explain", "not read yet" and "could not be
    // attributed" at once, and all three render the same way on purpose.
    const {container} = render(
      <PresalePanel stats={stats} allocation={ok('549853431042', '16142571618')} credits={null} />,
    );
    expect(container.textContent).toMatch(/did not come from your own purchases/);
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});
