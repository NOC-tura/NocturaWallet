// @vitest-environment happy-dom
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {Sheet} from '../ui/Sheet';
import {QrCode} from '../ui/QrCode';
import {Banner, REFUSED_TEXT, RefusedBanner} from '../ui/Banner';
import {TabBar} from '../ui/TabBar';
import {Toast} from '../ui/Toast';
import {ChipRow} from '../ui/Chip';
import {useCopy} from '../ui/useCopy';

// Spec §1.3: the extension-local components, each doing what the screens rely on.
describe('Sheet (#43’s sheet)', () => {
  it('a dialog with its title; Esc, the backdrop, the grabber and the close button all close it', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Accounts" onClose={onClose}>
        <button type="button">Inside</button>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', {name: 'Accounts'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    for (const b of screen.getAllByRole('button', {name: 'Close'})) fireEvent.click(b);
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('traps focus: Tab from the last control returns to the first, Shift+Tab from the first goes to the last', () => {
    render(
      <Sheet title="Accounts" onClose={() => undefined}>
        <button type="button">Last</button>
      </Sheet>,
    );
    const [grabber] = screen.getAllByRole('button', {name: 'Close'});
    const last = screen.getByRole('button', {name: 'Last'});
    expect(document.activeElement).toBe(grabber);
    last.focus();
    fireEvent.keyDown(document, {key: 'Tab'});
    expect(document.activeElement).toBe(grabber);
    fireEvent.keyDown(document, {key: 'Tab', shiftKey: true});
    expect(document.activeElement).toBe(last);
  });

  it('gives focus back to where it was when it closes', () => {
    const {rerender} = render(<button type="button">Opener</button>);
    const opener = screen.getByRole('button', {name: 'Opener'});
    opener.focus();
    rerender(
      <>
        <button type="button">Opener</button>
        <Sheet title="Accounts" onClose={() => undefined}>
          <span />
        </Sheet>
      </>,
    );
    expect(document.activeElement).not.toBe(opener);
    rerender(<button type="button">Opener</button>);
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Opener'}));
  });
});

describe('QrCode (S6)', () => {
  it('draws the payload’s modules as one SVG path, with a quiet zone, and says what it encodes', () => {
    render(<QrCode value="solana:HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk" label="QR code for receive" />);
    const svg = screen.getByRole('img', {name: 'QR code for receive'});
    expect(svg.getAttribute('data-qr')).toBe('solana:HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    const size = Number(svg.getAttribute('viewBox')?.split(' ')[2]);
    // Version ≥ 4 at error correction H for this payload: 33+ modules, plus 4 quiet modules each side.
    expect(size).toBeGreaterThanOrEqual(41);
    expect((svg.querySelector('path')?.getAttribute('d') ?? '').length).toBeGreaterThan(1000);
  });

  it('a different payload draws a different code', () => {
    const {rerender} = render(<QrCode value="solana:a" label="q" />);
    const first = screen.getByRole('img').querySelector('path')?.getAttribute('d');
    rerender(<QrCode value="solana:b" label="q" />);
    expect(screen.getByRole('img').querySelector('path')?.getAttribute('d')).not.toBe(first);
  });
});

describe('Banner, TabBar, Toast, ChipRow', () => {
  it('Banner: info is a status, warning an alert; the D26 text is exact', () => {
    render(<Banner tone="info" title="Heads up" />);
    expect(screen.getByRole('status').textContent).toBe('Heads up');
    render(<RefusedBanner />);
    expect(screen.getByRole('alert').textContent).toBe(REFUSED_TEXT);
    expect(REFUSED_TEXT).toBe('The server is not answering for now — try again in 10 minutes.');
  });

  it('TabBar: Home / Activity / Settings (D3), the active one marked', () => {
    const onChange = vi.fn();
    render(<TabBar active="activity" onChange={onChange} />);
    const tabs = screen.getAllByRole('button');
    expect(tabs.map(t => t.textContent)).toEqual(['Home', 'Activity', 'Settings']);
    expect(tabs[1]?.getAttribute('aria-current')).toBe('page');
    fireEvent.click(tabs[2] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('settings');
    // Task 17 fix round 1 (C13): Activity's glyph is the design's #i-trend-up (index.html #s26 tab bar).
    const points = [...(tabs[1] as HTMLElement).querySelectorAll('polyline')].map(p => p.getAttribute('points'));
    expect(points).toEqual(['22 7 13.5 15.5 8.5 10.5 2 17', '16 7 22 7 22 13']);
  });

  it('Toast: shown, then gone after its time', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast text="Copied." onDone={onDone} ms={1800} />);
    expect(screen.getByRole('status').textContent).toContain('Copied.');
    await act(async () => vi.advanceTimersByTime(1799));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('ChipRow: one selected, a click chooses', () => {
    const onChange = vi.fn();
    render(<ChipRow label="Filter" options={[{value: 'a', text: 'A'}, {value: 'b', text: 'B'}]} active="a" onChange={onChange} />);
    expect(screen.getByRole('tab', {name: 'A'}).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', {name: 'B'}));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('useCopy (CopyButton’s honesty)', () => {
  function Probe() {
    const [state, copy] = useCopy();
    return (
      <button type="button" onClick={() => copy('abc')}>
        {state}
      </button>
    );
  }
  const clipboard = (writeText: unknown) => Object.defineProperty(navigator, 'clipboard', {value: writeText === undefined ? undefined : {writeText}, configurable: true});

  it('copied only when the clipboard accepted it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('copied'));
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('failed when it refused, and when there is no clipboard at all', async () => {
    clipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const {unmount} = render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('failed'));
    unmount();
    clipboard(undefined);
    render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('failed');
  });
});
