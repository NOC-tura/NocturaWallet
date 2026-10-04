// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {App} from '../App';
import {createEngine} from '../engine';
import {renderApp} from './appHarness';
import {setupWallet} from './harness';
import {USE_IT_LINE} from '../screens/Created';
import {WELCOME} from '../../unlock/strings';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {CLOSE_CHECK_MS} from '../ui/useCloseTab';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';

const SELECTORS = selectorsOf(UI_SHEETS);

// Spec §3.7: #7 in the UI tab at #/created, where the vault page hands over after #6.
describe('#7 onboard-success (wallet.html#/created)', () => {
  it('idle: the ring, "Wallet created", the full address in groups of four with a 48 px copy, the clipboard line, next steps, and the D10 line', async () => {
    await renderApp({surface: 'tab', hash: '#/created'});
    expect(await screen.findByText('Wallet created')).toBeTruthy();
    expect(screen.getByText('Your Solana address is below. Receive funds at any time.')).toBeTruthy();
    expect(screen.getByText('Solana address')).toBeTruthy();
    const groups = [...document.querySelectorAll('.addr-mono .addr-groups > span')].map(s => s.textContent);
    expect(groups.join('')).toBe(ACCOUNT.publicKey);
    expect(groups).toEqual(ACCOUNT.publicKey.match(/.{1,4}/g));
    expect(screen.getByRole('button', {name: 'Copy address'}).className).toBe('copy-btn');
    expect(screen.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeTruthy();
    expect(screen.getByText('Next steps')).toBeTruthy();
    expect([...document.querySelectorAll('.app-onb-steps li')].map(li => li.textContent)).toEqual(['Fund the wallet with SOL or NOC', 'Pin Noctura to your browser toolbar so it is one click away']);
    expect(screen.getByText('Wallet is ready — open the Noctura icon')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Close this tab'})).toBeTruthy();
    // Removed by decision: shielded send (D4), backup (D17), [Open wallet] (D10), the 30 s clear (§4).
    expect(document.body.textContent).not.toMatch(/shielded|backup|Open wallet|auto-clears|30 s/i);
    expect(screen.queryByRole('navigation', {name: 'Main'})).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-success')!, SELECTORS)).toEqual([]);
  });

  // The provider is quiet on a hand-over route: #7 shows the stored address, and the open sequence's
  // cache, pending, balance and price reads do not run (they would on #11).
  it('reads the state only: no cached, pending, balance or price message', async () => {
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: '#/created', spy: m => void sent.push((m as {type: string}).type)});
    await screen.findByText('Wallet created');
    await new Promise(r => setTimeout(r, 20));
    expect(new Set(sent)).toEqual(new Set(['wallet.state']));
  });

  it('negative control: the same wallet on #/home runs the open sequence', async () => {
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: '#/home', spy: m => void sent.push((m as {type: string}).type)});
    await screen.findByText('TOKENS');
    await waitFor(() => expect(sent).toEqual(expect.arrayContaining(['wallet.cached', 'wallet.balances', 'wallet.prices'])));
  });

  it('copy says "Copied" only when the clipboard took it', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: async (t: string) => void writes.push(t)}, configurable: true});
    await renderApp({surface: 'tab', hash: '#/created'});
    fireEvent.click(await screen.findByRole('button', {name: 'Copy address'}));
    expect(await screen.findByRole('button', {name: 'Copied'})).toBeTruthy();
    expect(writes).toEqual([ACCOUNT.publicKey]);
  });

  it('copy says "Copy failed" when the clipboard refused it', async () => {
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: async () => Promise.reject(new Error('denied'))}, configurable: true});
    await renderApp({surface: 'tab', hash: '#/created'});
    fireEvent.click(await screen.findByRole('button', {name: 'Copy address'}));
    expect(await screen.findByRole('button', {name: 'Copy failed'})).toBeTruthy();
  });

  // Rule 6 (§7.6, the carry for this task): [Unlock] and [Close this tab] are LockedButtons — a second
  // click inside 500 ms does nothing.
  it('rule 6: a double click hands over once and closes once', async () => {
    const locked = await renderApp({surface: 'tab', hash: '#/created', unlocked: false});
    const unlock = await screen.findByRole('button', {name: 'Unlock'});
    fireEvent.click(unlock);
    fireEvent.click(unlock);
    expect(locked.platform.navigated).toEqual(['unlock.html?mode=unlock&return=created']);
    cleanup();
    const open = await renderApp({surface: 'tab', hash: '#/created'});
    const close = await screen.findByRole('button', {name: 'Close this tab'});
    fireEvent.click(close);
    fireEvent.click(close);
    expect(open.platform.closed).toBe(1);
  });

  it('[Close this tab] closes, and hides when the browser keeps the tab', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const {platform} = await renderApp({surface: 'tab', hash: '#/created'});
      fireEvent.click(await screen.findByRole('button', {name: 'Close this tab'}));
      expect(platform.closed).toBe(1);
      await act(async () => {
        vi.advanceTimersByTime(CLOSE_CHECK_MS);
      });
      expect(screen.queryByRole('button', {name: 'Close this tab'})).toBeNull();
      expect(screen.getByText('Wallet is ready — open the Noctura icon')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('created-locked: "Wallet created. Unlock it to use it." + [Unlock] → the vault page, which returns here', async () => {
    const {platform} = await renderApp({surface: 'tab', hash: '#/created', unlocked: false});
    fireEvent.click(await screen.findByRole('button', {name: 'Unlock'}));
    expect(screen.getByText('Wallet created. Unlock it to use it.')).toBeTruthy();
    expect(platform.navigated).toEqual(['unlock.html?mode=unlock&return=created']);
    expect(platform.opened).toEqual([]);
  });
});

// Task 15 fix round 1 (I-1, m-1): a quiet provider reads the state only, whatever happens in the page —
// the browser's online event, a tab coming back into view or focus, user input (no activity.ping: a
// hand-over page does not keep the wallet unlocked).
async function pageEvents(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    Object.defineProperty(document, 'visibilityState', {value: 'visible', configurable: true});
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
    // Past the 30 s ping pacing, then input.
    vi.setSystemTime(Date.now() + 31_000);
    fireEvent.pointerDown(document);
    fireEvent.keyDown(document, {key: 'a'});
  });
  await act(async () => {
    vi.advanceTimersByTime(50);
  });
}

describe('a quiet provider stays quiet (fix round 1)', () => {
  // Plan 3: the resume route is #20 now, which reads its own prepared send — its quiet test is in sendFlow.test.tsx.
  it.each([['#7', '#/created', 'Wallet created']])('%s: online, visibility, focus, pageshow and input send wallet.state only', async (_name, hash, text) => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const sent: string[] = [];
      await renderApp({surface: 'tab', hash, spy: m => void sent.push((m as {type: string}).type)});
      await screen.findByText(text);
      await pageEvents();
      expect(new Set(sent)).toEqual(new Set(['wallet.state']));
    } finally {
      vi.useRealTimers();
    }
  });

  it('negative control: the same events on #/home refresh and ping', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const sent: string[] = [];
      await renderApp({surface: 'tab', hash: '#/home', spy: m => void sent.push((m as {type: string}).type)});
      await screen.findByText('TOKENS');
      await waitFor(() => expect(sent).toContain('activity.ping'));
      const before = sent.length;
      await pageEvents();
      await waitFor(() => expect(sent.slice(before)).toEqual(expect.arrayContaining(['wallet.balances', 'wallet.prices', 'activity.ping'])));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the hand-over screens without a wallet or an account (fix round 1)', () => {
  it('#7 with no wallet shows the tab’s no-wallet screen too', async () => {
    await renderApp({surface: 'tab', hash: '#/created', wallet: false});
    expect(await screen.findByText('No wallet on this browser yet.')).toBeTruthy();
  });

  it('m-2: #7 on an unlocked wallet with no account fails closed — the neutral line and [Close this tab], no [Unlock]', async () => {
    const w = await setupWallet({surface: 'tab'});
    const engine = createEngine(async m => {
      const r = (await w.transport(m)) as {ok?: boolean; data?: Record<string, unknown>};
      return (m as {type: string}).type === 'wallet.state' && r.ok === true ? {...r, data: {...r.data, accounts: [], selected: null}} : r;
    }, async () => undefined);
    render(<App surface="tab" engine={engine} platform={w.platform} hash="#/created" />);
    expect(await screen.findByText('Open the Noctura icon to use it.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Close this tab'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Unlock'})).toBeNull();
    expect(screen.queryByText('Wallet created. Unlock it to use it.')).toBeNull();
  });
});

it('the neutral line is the vault page’s WELCOME.useIt, word for word', () => {
  expect(USE_IT_LINE).toBe(WELCOME.useIt);
});
