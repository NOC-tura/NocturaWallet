// @vitest-environment happy-dom
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {renderApp} from './appHarness';
import {walletReader} from './harness';
import {PENDING_KEY} from '../../background/pendingStore';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {sentSol, sig} from '../../../e2e/historyFixtures';

// Spec §1.6 step 1 and §4.1: what the popup and the tab show before #11.
describe('the app before #11', () => {
  it('popup, no wallet: opens the welcome page in a tab, closes itself, and says so meanwhile', async () => {
    const {platform} = await renderApp({wallet: false});
    expect(await screen.findByText('Opening setup in a new tab…')).toBeTruthy();
    await waitFor(() => expect(platform.opened).toEqual(['unlock.html?mode=welcome']));
    expect(platform.closed).toBe(1);
  });

  it('tab, no wallet: never closes itself; offers setup with a button', async () => {
    const {platform} = await renderApp({wallet: false, surface: 'tab'});
    fireEvent.click(await screen.findByRole('button', {name: 'Set up a wallet'}));
    expect(screen.getByText('No wallet on this browser yet.')).toBeTruthy();
    expect(platform.opened).toEqual(['unlock.html?mode=welcome']);
    expect(platform.closed).toBe(0);
  });

  it('locked: the derived locked screen — no password field; Unlock opens the vault page in a tab', async () => {
    const {platform} = await renderApp({unlocked: false});
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('Unlock Noctura to continue. Unlocking opens in a new tab.')).toBeTruthy();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    // Plan 1: no "Forgot password?" until #39 exists (plan 2).
    expect(screen.queryByText('Forgot password?')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Unlock'}));
    expect(platform.opened).toEqual(['unlock.html?mode=unlock']);
    expect(platform.closed).toBe(1);
  });

  // Task 16 review, fix round 1 #5 (ruling): the tab is the page the user is looking at — its
  // [Unlock] opens the vault page (§7.1) and leaves wallet.html open. The popup still closes.
  it('locked, tab: Unlock opens the vault page and does not close the tab', async () => {
    const {platform} = await renderApp({unlocked: false, surface: 'tab'});
    fireEvent.click(await screen.findByRole('button', {name: 'Unlock'}));
    expect(platform.opened).toEqual(['unlock.html?mode=unlock']);
    expect(platform.closed).toBe(0);
  });

  it('unlocked: #11 with the tab bar Home / Activity / Settings (D3)', async () => {
    await renderApp();
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    const nav = screen.getByRole('navigation', {name: 'Main'});
    expect([...nav.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Home', 'Activity', 'Settings']);
  });
});

describe('navigation (spec §1.6: an in-memory stack; no route acts)', () => {
  it('#11 → #13 → back; Esc also goes back one step', async () => {
    await renderApp();
    fireEvent.click(await screen.findByRole('button', {name: 'Receive'}));
    expect(await screen.findByText('Public address')).toBeTruthy();
    expect(screen.queryByRole('navigation', {name: 'Main'})).toBeNull(); // a flow screen: no tab bar
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Receive'}));
    await screen.findByText('Public address');
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(await screen.findByText('TOKENS')).toBeTruthy();
  });

  it('Activity → a row → #27 → back to the list', async () => {
    const now = Math.floor(Date.now() / 1000);
    const reader = walletReader({
      getSignaturesForAddress: async () => [{signature: sig(1), blockTime: now, err: null}],
      getTransaction: async () => sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, now),
    });
    await renderApp({reader});
    fireEvent.click(await screen.findByRole('button', {name: 'Activity'}));
    fireEvent.click(await screen.findByText('Sent SOL'));
    expect(await screen.findByText('SENT')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText('Sent SOL')).toBeTruthy();
  });

  it('the pending strip opens Activity (plan-1 stand-in), where the send is in PENDING', async () => {
    await renderApp({
      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
    });
    fireEvent.click(await screen.findByText('Sending 2.48 SOL · pending'));
    expect(await screen.findByText('PENDING')).toBeTruthy();
  });

  it('the avatar opens the account switcher; Settings → Accounts opens it too', async () => {
    await renderApp();
    fireEvent.click(await screen.findByRole('button', {name: 'Accounts'}));
    expect(await screen.findByRole('dialog', {name: 'Accounts'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('an auto-lock while open switches to the locked screen at the next 5 s state read', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const {ext} = await renderApp();
      await screen.findByText('TOKENS');
      await ext.session.clear();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await screen.findByText('Welcome back')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
