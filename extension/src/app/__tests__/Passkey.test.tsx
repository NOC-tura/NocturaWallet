// @vitest-environment happy-dom
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {base64} from '@scure/base';
import {Passkey} from '../screens/Passkey';
import {ENV, renderInWallet} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';

// B1b-2b §4.4 (#6 "manage", D12, D13): off and on, each action a vault-tab page; the popup closes.
const SELECTORS = selectorsOf(UI_SHEETS);
const B = (n: number) => base64.encode(new Uint8Array(n).fill(1));
const WITH_PASSKEY = {...ENV, passkey: {credentialId: B(16), prfSalt: B(32), wrapped: B(40)}};

describe('the passkey screen', () => {
  it('off: #6’s offer — title, lede, three rows, the tip, [Add a passkey] and its caption; nothing of "PIN still wins"', async () => {
    await renderInWallet(<Passkey onBack={() => undefined} />);
    expect(await screen.findByRole('heading', {name: 'Unlock Noctura with a passkey'})).toBeTruthy();
    expect(screen.getByText('Passkey')).toBeTruthy();
    expect(screen.getByText('Adds convenience. Your password always works too — keep it safe.')).toBeTruthy();
    for (const t of ['Faster unlock', 'Password still works', 'Where your passkey lives']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText('Your password always works too.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Add a passkey'})).toBeTruthy();
    expect(screen.getByText('Confirmation opens in a new tab.')).toBeTruthy();
    for (const gone of ['PIN still wins', 'Resets on enrollment change', 'Replace passkey', 'Remove passkey']) expect(screen.queryByText(gone)).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-bio')!, SELECTORS)).toEqual([]);
  });

  it('[Add a passkey] opens passkey&op=add and closes the popup', async () => {
    const w = await renderInWallet(<Passkey onBack={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Add a passkey'}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=passkey&op=add']);
    expect(w.platform.closed).toBe(1);
  });

  it('on: "Passkey is on", O62, the one row, the tip; [Replace passkey] → op=add, [Remove passkey] → op=remove; O63', async () => {
    const w = await renderInWallet(<Passkey onBack={() => undefined} />, {env: WITH_PASSKEY});
    expect(await screen.findByRole('heading', {name: 'Passkey is on'})).toBeTruthy();
    expect(screen.getByText('You can unlock and confirm with it. A wallet has one passkey: a new one replaces this one.')).toBeTruthy();
    expect(screen.getByText('Where your passkey lives')).toBeTruthy();
    expect(screen.queryByText('Faster unlock')).toBeNull();
    expect(screen.getByText('Removing it here does not delete it from your passkey manager.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Replace passkey'}));
    await waitFor(() => expect(w.platform.opened).toEqual(['unlock.html?mode=passkey&op=add']));
    fireEvent.click(screen.getByRole('button', {name: 'Remove passkey'}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=passkey&op=add', 'unlock.html?mode=passkey&op=remove']);
    expect(unstyledClasses(document.querySelector('.s-bio')!, SELECTORS)).toEqual([]);
  });

  it('rule 6: a second [Add a passkey] inside 500 ms opens nothing more', async () => {
    const w = await renderInWallet(<Passkey onBack={() => undefined} />);
    const add = await screen.findByRole('button', {name: 'Add a passkey'});
    fireEvent.click(add);
    (add as HTMLButtonElement).disabled = false;
    fireEvent.click(add);
    expect(w.platform.opened).toHaveLength(1);
  });

  it('Back pops', async () => {
    let backs = 0;
    await renderInWallet(<Passkey onBack={() => void (backs += 1)} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}));
    expect(backs).toBe(1);
  });
});
