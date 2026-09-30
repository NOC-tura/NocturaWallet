// @vitest-environment happy-dom
import {useState} from 'react';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, type WalletOptions} from './harness';
import {Home} from '../screens/Home';
import {Switcher} from '../screens/Switcher';
import {VAULT_KEY} from '../../background/accountsStore';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {walletReader} from './harness';
import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
import {RequestUnreachable} from '../../../../core/solana/rpc';

// Spec §5.2 (D14): the switcher, derived from #43's sheet, opened from #11's account button.
function HomeWithSwitcher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => setOpen(true)} />
      {open ? <Switcher onClose={() => setOpen(false)} /> : null}
    </>
  );
}
const renderApp = (o: WalletOptions = {}) => renderInWallet(<HomeWithSwitcher />, o);

async function open() {
  const r = await renderApp();
  await screen.findByText('$10,112');
  fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
  return {...r, sheet: await screen.findByRole('dialog', {name: 'Accounts'})};
}

describe('the account switcher', () => {
  it('a row per account: initial, name, the first two groups, balance and value; the selected one checked', async () => {
    const {sheet} = await open();
    const rows = sheet.querySelectorAll('[data-account]');
    expect(rows).toHaveLength(2);
    const main = within(rows[0] as HTMLElement);
    expect(main.getByText('Main')).toBeTruthy();
    expect(main.getByText(`${ACCOUNT.publicKey.slice(0, 4)} ${ACCOUNT.publicKey.slice(4, 8)}…`)).toBeTruthy();
    expect(await main.findByText('62.4821 SOL · $10,112.52')).toBeTruthy();
    expect(main.getByRole('img', {name: 'Selected'})).toBeTruthy();
    expect((rows[0] as HTMLElement).className).toContain('sel');
  });

  it('selecting an account closes the sheet and #11 follows it', async () => {
    await open();
    fireEvent.click(screen.getByText('Savings'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Savings'));
  });

  it('rename: saved names show at once; a refused name says why', async () => {
    const {ext} = await open();
    fireEvent.click(screen.getByRole('button', {name: 'Rename Main'}));
    const input = screen.getByRole('textbox', {name: 'Account name'}) as HTMLInputElement;
    expect(input.maxLength).toBe(32);
    fireEvent.change(input, {target: {value: 'Daily'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Daily'));
    expect(((await ext.local.get(VAULT_KEY)) as {accounts: {name: string}[]}).accounts[0]?.name).toBe('Daily');
    fireEvent.click(screen.getByRole('button', {name: 'Rename Daily'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Account name'}), {target: {value: 'bad\u0007name'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(await screen.findByText('Names are 1 to 32 characters, without control characters.')).toBeTruthy();
  });

  it('Add account opens the vault page’s accounts mode; a CLI wallet cannot add one', async () => {
    const {platform} = await open();
    fireEvent.click(screen.getByRole('button', {name: 'Add account'}));
    expect(platform.opened).toEqual(['unlock.html?mode=accounts']);
  });

  it('a CLI wallet: Add account disabled, with the reason', async () => {
    await renderApp({env: {v: 1, scheme: 'cli', accounts: [{index: 0, name: 'CLI', publicKey: ACCOUNT.publicKey}]}, accounts: [ACCOUNT]});
    await screen.findByText('TOKENS');
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    expect((await screen.findByRole('button', {name: 'Add account'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('A Solana CLI wallet has exactly one account.')).toBeTruthy();
  });

  it('Esc and the backdrop close it without a change', async () => {
    await open();
    fireEvent.keyDown(document, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    fireEvent.click(await screen.findByTestId('sheet-backdrop'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Main');
  });

  // Review M5: no fresh pass while away; and the pass stops at the first read that gets no answer.
  it('offline or unreachable: only the cached rows, no fresh reads', async () => {
    const asked: string[] = [];
    const reader = walletReader({
      getBalance: async owner => {
        asked.push(owner);
        throw new RequestUnreachable('u', 'no answer');
      },
    });
    await renderApp({reader, before: ext => ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: {sol: '1000000000', noc: '0', usdc: '0', usdt: '0', at: 1}})});
    await screen.findByText('Could not reach the Noctura server');
    const before = asked.length;
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    const sheet = await screen.findByRole('dialog', {name: 'Accounts'});
    expect(await within(sheet).findByText(/^cached /)).toBeTruthy();
    await new Promise(r => setTimeout(r, 50));
    expect(asked.length).toBe(before);
  });

  it('a first fresh read with no answer ends the pass (the second account is not asked) and sets #42', async () => {
    let down = false;
    const asked: string[] = [];
    const reader = walletReader({
      getBalance: async owner => {
        asked.push(owner);
        if (down) throw new RequestUnreachable('u', 'no answer');
        return 1_000_000_000n;
      },
    });
    await renderApp({reader});
    await screen.findByText('1.0000 SOL');
    down = true;
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    await screen.findByText('Could not reach the Noctura server');
    await new Promise(r => setTimeout(r, 50));
    expect(asked.filter(o => o === RECIPIENT)).toEqual([]);
  });

  it('ages come from the provider’s clock (review L8)', async () => {
    const at = 1_000_000;
    await renderInWallet(<HomeWithSwitcher />, {now: () => at + 2 * 3_600_000, reader: walletReader({getBalance: () => new Promise(() => undefined)}), before: ext => ext.local.set(BALANCE_CACHE_KEY, {[RECIPIENT]: {sol: '1', noc: '0', usdc: '0', usdt: '0', at}})});
    fireEvent.click(await screen.findByRole('button', {name: 'Accounts'}));
    expect(await screen.findByText('cached 2 h ago')).toBeTruthy();
  });
});
