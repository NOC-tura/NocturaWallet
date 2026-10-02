// @vitest-environment happy-dom
import {fireEvent, render, screen, within} from '@testing-library/react';
import {TokenSheet} from '../screens/TokenSheet';

// Spec §4.3 (#43, D18): the four tokens as a list; built in plan 1, opened by #12 in plan 3.
const balances = {sol: 62_482_100_000n, noc: 4_200_000_000_000n, usdc: 740_210_000n, usdt: 0n};
const prices = {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: 1};

describe('#43 token selector', () => {
  it('four rows — symbol, name, balance, value; NOC at stage price; the current token selected', () => {
    render(<TokenSheet balances={balances} prices={prices} selected="SOL" onSelect={() => undefined} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', {name: 'Choose a token'});
    const rows = within(dialog).getAllByRole('button', {pressed: undefined}).filter(b => b.classList.contains('app-token-row'));
    expect(rows.map(r => r.querySelector('.pri')?.textContent)).toEqual(['SOL', 'NOC', 'USDC', 'USDT']);
    expect(rows.map(r => r.querySelector('.sec')?.textContent)).toEqual(['Solana', 'Noctura', 'USD Coin', 'Tether']);
    expect(rows[1]?.querySelector('.fiat')?.textContent).toBe('$630.42 at stage price');
    expect(rows[0]?.getAttribute('aria-pressed')).toBe('true');
    for (const gone of ['Popular', 'Search', 'All tokens']) expect(screen.queryByText(new RegExp(gone))).toBeNull();
  });

  it('a row selects and closes; Esc closes without a change', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<TokenSheet balances={balances} prices={prices} selected="SOL" onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText('USD Coin'));
    expect(onSelect).toHaveBeenCalledWith('USDC');
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // Plan 3: #12 may open the sheet before the first balance read answers (or after it failed): never a 0.
  it('with no balances read: every amount and value reads "—", and NOC claims no stage price', () => {
    render(<TokenSheet balances={null} prices={prices} selected="NOC" onSelect={() => undefined} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', {name: 'Choose a token'});
    expect([...dialog.querySelectorAll('.amt')].map(a => a.textContent)).toEqual(['—', '—', '—', '—']);
    expect([...dialog.querySelectorAll('.fiat')].map(a => a.textContent)).toEqual(['—', '—', '—', '—']);
    expect(dialog.querySelector('.sel .pri')?.textContent).toBe('NOC');
  });
});
