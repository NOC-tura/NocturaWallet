// @vitest-environment happy-dom
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {render} from '@testing-library/react';
import {renderApp} from './appHarness';
import {setupWallet} from './harness';
import {App} from '../App';
import {getSession} from '../../background/session';

// Spec §6.1: the minimal Settings tab and #38 about.
async function openSettings() {
  const r = await renderApp();
  await screen.findByText('TOKENS');
  fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
  await screen.findByRole('heading', {name: 'Settings'});
  return r;
}

describe('Settings (minimal)', () => {
  it('three groups: Accounts (with the count), Lock now, About Noctura (with the version); nothing else of #31', async () => {
    await openSettings();
    expect(screen.getAllByText(/^(Account|Security|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'About']);
    expect(screen.getByText('2 accounts')).toBeTruthy();
    expect(screen.getByText('v0.1.0')).toBeTruthy();
    for (const gone of ['Currency', 'Notifications', 'Change password', 'Backup', 'Delete wallet', 'Connections', 'Advanced']) expect(screen.queryByText(gone)).toBeNull();
  });

  it('Accounts opens the switcher', async () => {
    await openSettings();
    fireEvent.click(screen.getByText('Accounts'));
    expect(await screen.findByRole('dialog', {name: 'Accounts'})).toBeTruthy();
  });

  it('Lock now locks the wallet and shows the locked screen', async () => {
    const {ext} = await openSettings();
    fireEvent.click(screen.getByText('Lock now'));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    expect(await getSession(ext)).toBeNull();
  });

  it('#38 about: the wordmark, the adapted line, the version, the site as text, the licence', async () => {
    await openSettings();
    fireEvent.click(screen.getByText('About Noctura'));
    expect(await screen.findByText('Solana wallet for your browser — your keys stay on this device.')).toBeTruthy();
    expect(document.querySelector('.s7-wordmark')?.textContent).toBe('noctura.');
    expect(screen.getByText('noc-tura.io').closest('a')).toBeNull();
    expect(screen.getByText('© 2026 Noctura')).toBeTruthy();
    expect(screen.getByText(/BSL 1\.1 · converts to MIT on/)).toBeTruthy();
    for (const gone of ['Terms of Service', 'Privacy Policy', 'Open-source licenses', 'Help & support', 'shielded']) expect(screen.queryByText(new RegExp(gone))).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    await waitFor(() => expect(screen.getByRole('heading', {name: 'Settings'})).toBeTruthy());
  });

  // Review M3 / spec §7.6: "Lock now" is a LockedButton — a second click inside 500 ms, or before the
  // lock settles, does nothing.
  async function withSlowLock(settle: 'now' | 'never') {
    const w = await setupWallet();
    let locks = 0;
    const engine = {...w.engine, lock: () => (locks++, settle === 'now' ? Promise.resolve({ok: true as const, data: null}) : new Promise<never>(() => undefined))};
    render(<App surface="popup" engine={engine} platform={w.platform} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Settings'}));
    return {count: () => locks};
  }

  it('Lock now: a second click inside 500 ms does nothing', async () => {
    const {count} = await withSlowLock('now');
    const button = await screen.findByRole('button', {name: /Lock now/});
    fireEvent.click(button);
    // The lock has settled; the 500 ms floor has not passed.
    await new Promise(r => setTimeout(r, 50));
    fireEvent.click(button);
    expect(count()).toBe(1);
  });

  it('Lock now: a second click after 500 ms but before the lock settles does nothing', async () => {
    const {count} = await withSlowLock('never');
    const button = await screen.findByRole('button', {name: /Lock now/});
    fireEvent.click(button);
    await new Promise(r => setTimeout(r, 600));
    fireEvent.click(button);
    expect(count()).toBe(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
