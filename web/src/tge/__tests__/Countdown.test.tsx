import {render, screen} from '@testing-library/react';
import {Countdown} from '../Countdown';

afterEach(() => {
  vi.useRealTimers();
});

describe('Countdown', () => {
  it('counts in UTC from the on-chain timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T00:00:00Z'));
    render(<Countdown tgeUnix={Math.floor(Date.UTC(2026, 8, 22) / 1000)} />);
    expect(screen.getByText(/2 days/i)).toBeTruthy();
  });

  it('says the date is unset rather than counting from 1970', () => {
    render(<Countdown tgeUnix={null} />);
    expect(screen.getByText(/not set/i)).toBeTruthy();
    expect(screen.queryByText(/days/i)).toBeNull();
  });

  it('says TGE has passed instead of counting through zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-02T00:00:00Z'));
    render(<Countdown tgeUnix={1_893_456_000} />);
    expect(screen.getByText(/has passed/i)).toBeTruthy();
  });

  it('shows the real date for the real on-chain value (positive control)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T00:00:00Z'));
    render(<Countdown tgeUnix={1_893_456_000} />);
    expect(screen.getByText(/2030-01-01/)).toBeTruthy();
  });

  it('keeps every state inside the TGE card, under its label', () => {
    // "The TGE date is not set yet." used to render as a bare line with no card and no
    // heading — a sentence floating on the page with nothing saying what it was about.
    for (const tge of [null, 1]) {
      const {container, unmount} = render(<Countdown tgeUnix={tge} />);
      const card = container.querySelector('.noc-card.tge');
      expect(card?.textContent).toMatch(/Token generation event/i);
      unmount();
    }
  });

  it('still shows the date once TGE has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-02T00:00:00Z'));
    render(<Countdown tgeUnix={1_893_456_000} />);
    expect(screen.getByText(/2030-01-01/)).toBeTruthy();
  });
});
