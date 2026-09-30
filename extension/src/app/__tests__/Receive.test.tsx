// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderInWallet} from './harness';
import {Receive} from '../screens/Receive';
import {QR_DEBOUNCE_MS} from '../screens/Receive';
import {ACCOUNT} from '../../background/__tests__/fixtures';

// Spec §5.3 (#13).
const A = ACCOUNT.publicKey;
const short = `${A.slice(0, 4)}…${A.slice(-4)}`;
function clipboard(writeText: (v: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
}
const onBack = vi.fn();
async function openReceive() {
  const r = await renderInWallet(<Receive onBack={onBack} />);
  await waitFor(() => expect(document.querySelector('[data-qr]')?.getAttribute('data-qr')).toBe(`solana:${A}`));
  return r;
}

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
});
