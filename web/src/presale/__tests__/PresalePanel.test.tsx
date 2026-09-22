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
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '1234000000000'}} />);
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
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '773484343768'}} />);
    const node = screen.getByText('773.4843 NOC');
    expect(node.getAttribute('title')).toBe('773.484343768 NOC');
  });

  it('never rounds the allocation up, because that would overstate the holding', () => {
    // 0.99999 rounded to four places is 1.0 — a page claiming a whole NOC the buyer does
    // not have. Truncation can only ever understate, which is the safe direction.
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '999990000'}} />);
    expect(screen.getByText('0.9999 NOC')).toBeTruthy();
  });

  it('shows a dust allocation in full rather than printing a flat zero', () => {
    // Truncating 4 base units to four decimals gives "0 NOC", which says the buyer holds
    // nothing. That is a different claim, not a shorter one.
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '4'}} />);
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
