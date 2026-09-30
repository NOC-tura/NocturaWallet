// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderInWallet, type WalletOptions} from './harness';
import {Receive} from '../screens/Receive';
import {QR_DEBOUNCE_MS} from '../screens/Receive';
import {ACCOUNT} from '../../background/__tests__/fixtures';

// Spec §5.3 (#13).
const A = ACCOUNT.publicKey;
const short = `${A.slice(0, 4)}…${A.slice(-4)}`;
function clipboard(writeText: (v: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
}
const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', {value, configurable: true});
const onBack = vi.fn();
async function openReceive(o: WalletOptions = {}) {
  const r = await renderInWallet(<Receive onBack={onBack} />, o);
  await waitFor(() => expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`));
  return r;
}

afterEach(() => {
  setOnline(true);
  vi.useRealTimers();
});

describe('#13 receive', () => {
  it('plain address: the QR of solana:<address>, the short URI, the full address in groups, Copy address', async () => {
    await openReceive();
    expect(screen.getByText('Receive')).toBeTruthy();
    expect(screen.getByText('Public address')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`);
    expect(screen.getByText(`solana:${short}`)).toBeTruthy();
    expect(screen.getByText('WALLET ADDRESS')).toBeTruthy();
    expect(screen.getByText('tap to copy')).toBeTruthy();
    const groups = [...(document.querySelector('.addr-groups')?.children ?? [])].map(c => c.textContent);
    expect(groups.join('')).toBe(A);
    expect(groups.every(g => (g ?? '').length <= 4)).toBe(true);
    expect(screen.getByText('Request amount (optional)')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Copy address'})).toBeTruthy();
    // D19 and D4: no Share, no shielded vocabulary; spec §4: nothing auto-clears.
    expect(screen.queryByText(/Share|Transparent|Shielded|auto-clears/)).toBeNull();
  });

  it('copy: "Copied" only when the clipboard accepted it — with the card header and the toast saying it is not cleared', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    await openReceive();
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    expect(writeText).toHaveBeenCalledWith(A);
    expect(await screen.findByText('Copied. Noctura does not clear your clipboard.')).toBeTruthy();
    expect(screen.getByText('COPIED TO CLIPBOARD')).toBeTruthy();
    expect(screen.getByText('Noctura does not clear it afterwards.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Copied'})).toBeTruthy();
  });

  it('a refused clipboard says "Copy failed", never "Copied"', async () => {
    clipboard(vi.fn().mockRejectedValue(new Error('denied')));
    await openReceive();
    fireEvent.click(screen.getByRole('button', {name: 'Copy address'}));
    expect(await screen.findByRole('button', {name: 'Copy failed'})).toBeTruthy();
    expect(screen.queryByText('COPIED TO CLIPBOARD')).toBeNull();
  });

  it('pay request: the ribbon, the QR with amount and label (after 200 ms), the fiat line, Copy link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    await openReceive();
    fireEvent.change(screen.getByRole('textbox', {name: 'Request amount'}), {target: {value: '2.48'}});
    await act(async () => new Promise(r => setTimeout(r, QR_DEBOUNCE_MS + 20)));
    expect(screen.getByText('Requested amount')).toBeTruthy();
    expect(document.querySelector('.pay-ribbon')?.textContent).toBe('PAY · 2.480000 SOL');
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}?amount=2.48&label=Noctura`);
    expect(screen.getByText(`solana:${short}?amount=2.48`)).toBeTruthy();
    expect(screen.getByText('SOL · ≈ $372.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Copy link'}));
    expect(writeText).toHaveBeenCalledWith(`solana:${A}?amount=2.48&label=Noctura`);
    fireEvent.click(screen.getByRole('button', {name: 'Clear amount'}));
    await waitFor(() => expect(screen.getByText('Request amount (optional)')).toBeTruthy());
  });

  it('an amount with more places than SOL has is not a request', async () => {
    await openReceive();
    fireEvent.change(screen.getByRole('textbox', {name: 'Request amount'}), {target: {value: '1.0000000001'}});
    await act(async () => new Promise(r => setTimeout(r, QR_DEBOUNCE_MS + 20)));
    expect(document.querySelector('.pay-ribbon')).toBeNull();
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`);
  });

  it('the QR follows only the LAST keystroke, exactly QR_DEBOUNCE_MS later — a keystroke inside the window restarts it', async () => {
    expect(QR_DEBOUNCE_MS).toBe(200);
    await openReceive();
    vi.useFakeTimers();
    const field = screen.getByRole('textbox', {name: 'Request amount'});
    fireEvent.change(field, {target: {value: '1'}});
    await act(async () => vi.advanceTimersByTime(QR_DEBOUNCE_MS - 1));
    // Not yet: the debounce has one ms left.
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`);
    // A second keystroke inside the window restarts the debounce from here, not from the first one.
    fireEvent.change(field, {target: {value: '2.48'}});
    await act(async () => vi.advanceTimersByTime(QR_DEBOUNCE_MS - 1));
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`);
    await act(async () => vi.advanceTimersByTime(1));
    // QR_DEBOUNCE_MS after the LAST keystroke (2 × (QR_DEBOUNCE_MS − 1) + 2 ms since the first one),
    // and it carries the final value, never the '1' that was overtaken.
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}?amount=2.48&label=Noctura`);
  });

  // Final review M2: the sticky button copies what the field says NOW, not the debounced request.
  it('a copy inside the debounce window copies the field as typed: the new amount, or the bare address once the field is no request; the QR stays debounced', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    await openReceive();
    const field = screen.getByRole('textbox', {name: 'Request amount'});
    fireEvent.change(field, {target: {value: '2.48'}});
    await act(async () => new Promise(r => setTimeout(r, QR_DEBOUNCE_MS + 20)));
    vi.useFakeTimers();
    fireEvent.change(field, {target: {value: '3'}});
    await act(async () => vi.advanceTimersByTime(QR_DEBOUNCE_MS - 1));
    // The request (and its QR) has not followed yet…
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}?amount=2.48&label=Noctura`);
    // …but the copy does.
    fireEvent.click(screen.getByRole('button', {name: 'Copy link'}));
    expect(writeText).toHaveBeenLastCalledWith(`solana:${A}?amount=3&label=Noctura`);
    // The same sticky button (its label may still read "Copied"): a field that is no request copies the bare address.
    fireEvent.change(field, {target: {value: '1.0000000001'}});
    fireEvent.click(document.querySelector('.sticky-bar .btn') as HTMLButtonElement);
    expect(writeText).toHaveBeenLastCalledWith(A);
    await act(async () => vi.advanceTimersByTime(QR_DEBOUNCE_MS));
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`);
  });

  // Final re-review F1: the button's label says what a click copies, at once; the QR stays debounced.
  it('the button label follows the field at once: "Copy link" before QR_DEBOUNCE_MS, "Copy address" once the field is no request', async () => {
    await openReceive();
    vi.useFakeTimers();
    const field = screen.getByRole('textbox', {name: 'Request amount'});
    fireEvent.change(field, {target: {value: '2.48'}});
    await act(async () => vi.advanceTimersByTime(QR_DEBOUNCE_MS - 1));
    expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`);
    expect(document.querySelector('.pay-ribbon')).toBeNull();
    expect(screen.getByRole('button', {name: 'Copy link'})).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(1));
    fireEvent.change(field, {target: {value: '1.0000000001'}});
    expect(screen.getByRole('button', {name: 'Copy address'})).toBeTruthy();
    expect(document.querySelector('.pay-ribbon')).toBeTruthy();
  });

  it('no price: the fiat line reads "SOL · ≈ —", never "$0.00"', async () => {
    await openReceive({
      deps: {
        prices: async () => {
          throw new Error('down');
        },
        stagePrice: async () => {
          throw new Error('down');
        },
      },
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Request amount'}), {target: {value: '2.48'}});
    await act(async () => new Promise(r => setTimeout(r, QR_DEBOUNCE_MS + 20)));
    expect(screen.getByText('SOL · ≈ —')).toBeTruthy();
    expect(document.body.textContent).not.toContain('$0.00');
  });

  it('offline: a price is present, but the fiat line still reads "—" (D36 — never a stale $ figure)', async () => {
    await openReceive();
    fireEvent.change(screen.getByRole('textbox', {name: 'Request amount'}), {target: {value: '2.48'}});
    await act(async () => new Promise(r => setTimeout(r, QR_DEBOUNCE_MS + 20)));
    expect(screen.getByText('SOL · ≈ $372.00')).toBeTruthy();
    await act(async () => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('SOL · ≈ —')).toBeTruthy();
  });

  it('pay state: the WALLET ADDRESS card still copies the bare address; [Copy link] copies the URI (index.html #13 pay state)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    await openReceive();
    fireEvent.change(screen.getByRole('textbox', {name: 'Request amount'}), {target: {value: '2.48'}});
    await act(async () => new Promise(r => setTimeout(r, QR_DEBOUNCE_MS + 20)));
    expect(screen.getByText('WALLET ADDRESS')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Copy link'}));
    expect(writeText).toHaveBeenLastCalledWith(`solana:${A}?amount=2.48&label=Noctura`);
    fireEvent.click(screen.getByRole('button', {name: 'Copy wallet address'}));
    expect(writeText).toHaveBeenLastCalledWith(A);
  });
});
