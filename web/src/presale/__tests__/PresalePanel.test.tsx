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
    render(
      <PresalePanel
        stats={{...stats, soldInStageBase: '1279937425329514'}}
        allocation={{status: 'disconnected'}}
      />,
    );
    expect(screen.getByText(/1,279,937 NOC of/)).toBeTruthy();
    expect(screen.queryByText(/425329514/)).toBeNull();
  });

  it('shows an allocation to the last unit, because that one is the buyer\'s money', () => {
    render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '773484343768'}} />);
    expect(screen.getByText('773.484343768 NOC')).toBeTruthy();
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
