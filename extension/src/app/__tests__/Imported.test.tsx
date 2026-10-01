// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {App} from '../App';
import {createEngine} from '../engine';
import {STATE_POLL_MS} from '../WalletContext';
import {CLOSE_CHECK_MS} from '../ui/useCloseTab';
import {CLIPBOARD_LINE, MAX_READ} from '../screens/Imported';
import {renderApp} from './appHarness';
import {ENV, setupWallet, walletReader} from './harness';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {clearSession, setSession} from '../../background/session';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {deriveSessionAccounts} from '../../vault/accounts';

const M7 = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

const SELECTORS = selectorsOf(UI_SHEETS);
const ONE = {...ENV, accounts: [ENV.accounts[0]]};
const styled = () => unstyledClasses(document.querySelector('.app-onb-imported')!, SELECTORS);
const zero = () => walletReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});

// Spec §3.12: #40 in the UI tab at #/imported.
describe('#40 import-success (wallet.html#/imported)', () => {
  it('single account: "Wallet imported", the market total and ≈ SOL, a row per token held (NOC at stage price), the address, the D10 line', async () => {
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT]});
    expect(await screen.findByText('Wallet imported')).toBeTruthy();
    expect(screen.getByText('1 account · 3 tokens recovered. Welcome back.')).toBeTruthy();
    expect(screen.getByText('Total value recovered')).toBeTruthy();
    // 62.4821 SOL × $150 + 740.21 USDC × $1 = $10,112.52 (NOC is outside the market total).
    expect(screen.getByText('$10,112.52')).toBeTruthy();
    // 10,112.52 / 150 = 67.4168…: truncated, never rounded up (M1).
    expect(screen.getByText('≈ 67.41 SOL')).toBeTruthy();
    const rows = [...document.querySelectorAll('.s8-token-row')].map(r => [r.querySelector('.pri')?.textContent, r.querySelector('.sec')?.textContent, r.querySelector('.amt')?.textContent, r.querySelector('.fiat')?.textContent]);
    expect(rows).toEqual([
      ['SOL', 'Solana', '62.4821', '$9,372.31'],
      ['NOC', 'Noctura', '4,200.00', '$630.42 at stage price'],
      ['USDC', 'USD Coin', '740.21', '$740.21'],
    ]);
    expect(screen.getByText('Your wallet address')).toBeTruthy();
    expect([...document.querySelectorAll('.s8-addr-chip .addr-groups > span')].map(s => s.textContent).join('')).toBe(ACCOUNT.publicKey);
    expect(screen.getByRole('button', {name: 'Copy address'})).toBeTruthy();
    expect(screen.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeTruthy();
    expect(screen.getByText('Wallet is ready — open the Noctura icon')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Close this tab'})).toBeTruthy();
    expect(screen.queryByText('Try a different seed')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Open wallet|more tokens|BONK|JUP|v1_imported/);
    expect(styled()).toEqual([]);
  });

  it('multi account: summed rows "Solana · 2 accounts", "across 2 accounts · ≈ … SOL"; reads each account once, then the prices — nothing else', async () => {
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: '#/imported', spy: m => void sent.push((m as {type: string}).type)});
    expect(await screen.findByText('2 accounts · 3 tokens recovered.')).toBeTruthy();
    expect(screen.getByText('across 2 accounts · ≈ 134.83 SOL')).toBeTruthy();
    expect(screen.getByText('$20,225.05')).toBeTruthy();
    expect([...document.querySelectorAll('.s8-token-row .sec')].map(s => s.textContent)).toEqual(['Solana · 2 accounts', 'Noctura · 2 accounts', 'USD Coin · 2 accounts']);
    expect(sent.filter(t => t !== 'wallet.state')).toEqual(['wallet.balances', 'wallet.balances', 'wallet.prices']);
    expect(screen.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeTruthy();
    expect(styled()).toEqual([]);
  });

  // M2 (plan review): past MAX_READ the screen claims only the accounts it read.
  it('seven accounts: six read, and the copy says so — "recovered from the first 6", "across the first 6 of 7 accounts"', async () => {
    const session = await deriveSessionAccounts(M7, 'slip10', [0, 1, 2, 3, 4, 5, 6]);
    const env = {...ENV, accounts: session.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}))};
    const sent: {type: string; account?: string}[] = [];
    await renderApp({surface: 'tab', hash: '#/imported', env, accounts: session, spy: m => void sent.push(m as {type: string})});
    expect(await screen.findByText('7 accounts · 3 tokens recovered from the first 6.')).toBeTruthy();
    expect(screen.getByText(/^across the first 6 of 7 accounts · ≈ [\d.]+ SOL$/)).toBeTruthy();
    const reads = sent.filter(m => m.type === 'wallet.balances');
    expect(reads).toHaveLength(6);
    expect(reads.map(m => m.account)).toEqual(session.slice(0, 6).map(a => a.publicKey));
    expect(document.body.textContent).not.toMatch(/across 7 accounts|7 accounts · 3 tokens recovered\./);
  });

  it('no-assets-empty: only when every read succeeded — the info ring, the adapted copy, the real paths, [Try a different seed]', async () => {
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader: zero()});
    expect(await screen.findByText('Wallet imported · empty')).toBeTruthy();
    expect(screen.getByText("Your seed checked out, but this wallet holds none of the tokens Noctura shows yet. That's fine — go receive some.")).toBeTruthy();
    expect(screen.getByText('Recovered')).toBeTruthy();
    expect(screen.getByText('0 tokens')).toBeTruthy();
    expect(screen.getByText('1 account · address derivation succeeded')).toBeTruthy();
    expect(screen.getByText('A few reasons this can happen:')).toBeTruthy();
    expect([...document.querySelectorAll('.app-onb-reasons li')].map(li => li.textContent)).toEqual([
      'This is a fresh seed — never received any tokens',
      'You imported the wrong seed for this account',
      "Your assets are on a different derivation path (we check m/44'/501'/n'/0' for n = 0–4, and the Solana CLI key)",
    ]);
    expect(screen.getByText('You can send SOL to this address to fund the wallet.')).toBeTruthy();
    expect(screen.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeTruthy();
    expect(screen.getByText('Wallet is ready — open the Noctura icon')).toBeTruthy();
    expect(document.querySelector('.s8-success-hero .ring')?.className).toBe('ring app-onb-info');
    expect(styled()).toEqual([]);
  });

  it('rule 6: a double click on [Try a different seed] re-reads once and navigates once', async () => {
    const sent: string[] = [];
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader: zero(), spy: m => void sent.push((m as {type: string}).type)});
    const button = await screen.findByRole('button', {name: 'Try a different seed'});
    const before = sent.filter(t => t === 'wallet.balances').length;
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(platform.navigated).toEqual(['unlock.html?mode=import&source=retry']));
    expect(sent.filter(t => t === 'wallet.balances').length - before).toBe(1);
    expect(platform.navigated).toHaveLength(1);
  });

  it('[Try a different seed] re-reads first; all still zero → the vault page’s retry path (D41)', async () => {
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader: zero()});
    fireEvent.click(await screen.findByRole('button', {name: 'Try a different seed'}));
    await waitFor(() => expect(platform.navigated).toEqual(['unlock.html?mode=import&source=retry']));
  });

  it('[Try a different seed] when funds arrived: the funded state, the button gone, no navigation', async () => {
    let calls = 0;
    const reader = walletReader({getBalance: async () => (calls++ === 0 ? 0n : 5_000_000_000n), getTokenAccountsByOwner: async () => []});
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader});
    fireEvent.click(await screen.findByRole('button', {name: 'Try a different seed'}));
    expect(await screen.findByText('1 account · 1 token recovered. Welcome back.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Try a different seed'})).toBeNull();
    expect(platform.navigated).toEqual([]);
  });

  it('a read that got no answer is "Balances could not be read right now." + refresh — never "empty"', async () => {
    let fail = true;
    const reader = walletReader({
      getBalance: async () => {
        if (fail) throw new RequestUnreachable('getBalance', 'offline');
        return 0n;
      },
      getTokenAccountsByOwner: async () => [],
    });
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader});
    expect(await screen.findByText('Balances could not be read right now.')).toBeTruthy();
    expect(screen.queryByText('Wallet imported · empty')).toBeNull();
    expect(styled()).toEqual([]);
    fail = false;
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText('Wallet imported · empty')).toBeTruthy();
  });

  it('a 403: the D26 banner and the refresh disabled (nothing retries)', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RpcForbidden('getBalance');
      },
    });
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader});
    expect(await screen.findByText('The server is not answering for now — try again in 10 minutes.')).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('locked: "Wallet imported. Unlock it to see what was recovered." + [Unlock] → the vault page, back here', async () => {
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', unlocked: false});
    fireEvent.click(await screen.findByRole('button', {name: 'Unlock'}));
    expect(screen.getByText('Wallet imported. Unlock it to see what was recovered.')).toBeTruthy();
    expect(platform.navigated).toEqual(['unlock.html?mode=unlock&return=imported']);
  });
});

// Task 16 carries: #40 is a hand-over route, so its provider is quiet (Task 15) — the open sequence does
// not run, refresh() is a no-op and nothing pings. #40 makes its own explicit reads (readAll): the
// balances of up to MAX_READ accounts, then the prices, reported through the model's latch.
async function pageEvents(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    Object.defineProperty(document, 'visibilityState', {value: 'visible', configurable: true});
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
    vi.setSystemTime(Date.now() + 31_000);
    fireEvent.pointerDown(document);
    fireEvent.keyDown(document, {key: 'a'});
  });
  // Two of the provider's 5 s state polls.
  await act(async () => {
    vi.advanceTimersByTime(STATE_POLL_MS * 2 + 50);
  });
}

describe('#40 reads only what it shows (Task 16 carries)', () => {
  it('MAX_READ is six, and CLIPBOARD_LINE is #7’s sentence', () => {
    expect(MAX_READ).toBe(6);
    expect(CLIPBOARD_LINE).toBe('Copying puts the address on your clipboard. Noctura does not clear it afterwards.');
  });

  it('online, visibility, focus, pageshow, input and the state polls add no read and no ping', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const sent: string[] = [];
      await renderApp({surface: 'tab', hash: '#/imported', spy: m => void sent.push((m as {type: string}).type)});
      await screen.findByText('2 accounts · 3 tokens recovered.');
      await pageEvents();
      expect(sent.filter(t => t !== 'wallet.state')).toEqual(['wallet.balances', 'wallet.balances', 'wallet.prices']);
      expect(sent.filter(t => t === 'wallet.state').length).toBeGreaterThanOrEqual(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a deliberate refresh reads once more — every account, then the prices — and nothing else', async () => {
    let fail = true;
    const reader = walletReader({
      getBalance: async () => {
        if (fail) throw new RequestUnreachable('getBalance', 'offline');
        return 0n;
      },
      getTokenAccountsByOwner: async () => [],
    });
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: '#/imported', reader, spy: m => void sent.push((m as {type: string}).type)});
    expect(await screen.findByText('Balances could not be read right now.')).toBeTruthy();
    // The first account's read failed: the second is not read, and neither are the prices.
    expect(sent.filter(t => t !== 'wallet.state')).toEqual(['wallet.balances']);
    fail = false;
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText('Wallet imported · empty')).toBeTruthy();
    expect(sent.filter(t => t !== 'wallet.state')).toEqual(['wallet.balances', 'wallet.balances', 'wallet.balances', 'wallet.prices']);
  });

  it('a 403 on the prices alone is the D26 state too, never "empty"', async () => {
    const w = await setupWallet({surface: 'tab', env: ONE, accounts: [ACCOUNT], reader: zero(), deps: {prices: async () => Promise.reject(new RpcForbidden('prices'))}});
    render(<App surface="tab" engine={w.engine} platform={w.platform} hash="#/imported" />);
    expect(await screen.findByText('The server is not answering for now — try again in 10 minutes.')).toBeTruthy();
    expect(screen.queryByText('Wallet imported · empty')).toBeNull();
  });

  it('the 403 goes to the model’s latch: after a lock and an unlock the page reads nothing and stays refused', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const reader = walletReader({
        getBalance: async () => {
          throw new RpcForbidden('getBalance');
        },
      });
      const sent: string[] = [];
      const {ext} = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader, spy: m => void sent.push((m as {type: string}).type)});
      expect(await screen.findByText('The server is not answering for now — try again in 10 minutes.')).toBeTruthy();
      expect(sent.filter(t => t === 'wallet.balances')).toHaveLength(1);
      await clearSession(ext);
      await act(async () => {
        vi.advanceTimersByTime(STATE_POLL_MS + 50);
      });
      expect(await screen.findByText('Wallet imported. Unlock it to see what was recovered.')).toBeTruthy();
      await setSession(ext, [ACCOUNT]);
      await act(async () => {
        vi.advanceTimersByTime(STATE_POLL_MS + 50);
      });
      expect(await screen.findByText('The server is not answering for now — try again in 10 minutes.')).toBeTruthy();
      expect((screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement).disabled).toBe(true);
      expect(sent.filter(t => t === 'wallet.balances')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('copy says "Copied" only when the clipboard took it, "Copy failed" when it refused', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: async (t: string) => void writes.push(t)}, configurable: true});
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT]});
    fireEvent.click(await screen.findByRole('button', {name: 'Copy address'}));
    expect(await screen.findByRole('button', {name: 'Copied'})).toBeTruthy();
    expect(writes).toEqual([ACCOUNT.publicKey]);
    cleanup();
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: async () => Promise.reject(new Error('denied'))}, configurable: true});
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT]});
    fireEvent.click(await screen.findByRole('button', {name: 'Copy address'}));
    expect(await screen.findByRole('button', {name: 'Copy failed'})).toBeTruthy();
  });

  // Rule 6 (§7.6), as on #7 (Task 15): [Unlock] and [Close this tab] are LockedButtons.
  it('rule 6: a double click on [Unlock] hands over once, on [Close this tab] closes once', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const locked = await renderApp({surface: 'tab', hash: '#/imported', unlocked: false});
      const unlock = await screen.findByRole('button', {name: 'Unlock'});
      fireEvent.click(unlock);
      fireEvent.click(unlock);
      expect(locked.platform.navigated).toEqual(['unlock.html?mode=unlock&return=imported']);
      cleanup();
      const open = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT]});
      const close = await screen.findByRole('button', {name: 'Close this tab'});
      fireEvent.click(close);
      fireEvent.click(close);
      expect(open.platform.closed).toBe(1);
      // The browser refused to close it: the button goes (§3.7).
      await act(async () => {
        vi.advanceTimersByTime(CLOSE_CHECK_MS);
      });
      expect(screen.queryByRole('button', {name: 'Close this tab'})).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('more than six accounts, all zero: never "empty" (not every account was read), and no [Try a different seed]', async () => {
    const session = await deriveSessionAccounts(M7, 'slip10', [0, 1, 2, 3, 4, 5, 6]);
    const env = {...ENV, accounts: session.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}))};
    await renderApp({surface: 'tab', hash: '#/imported', env, accounts: session, reader: zero()});
    expect(await screen.findByText('7 accounts · 0 tokens recovered from the first 6.')).toBeTruthy();
    expect(screen.queryByText('Wallet imported · empty')).toBeNull();
    expect(screen.queryByRole('button', {name: 'Try a different seed'})).toBeNull();
  });

  it('an unlocked wallet with no account fails closed as #7 does — the neutral line, nothing read', async () => {
    const w = await setupWallet({surface: 'tab'});
    const sent: string[] = [];
    const engine = createEngine(async m => {
      sent.push((m as {type: string}).type);
      const r = (await w.transport(m)) as {ok?: boolean; data?: Record<string, unknown>};
      return (m as {type: string}).type === 'wallet.state' && r.ok === true ? {...r, data: {...r.data, accounts: [], selected: null}} : r;
    }, async () => undefined);
    render(<App surface="tab" engine={engine} platform={w.platform} hash="#/imported" />);
    expect(await screen.findByText('Open the Noctura icon to use it.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Unlock'})).toBeNull();
    expect(new Set(sent)).toEqual(new Set(['wallet.state']));
  });
});

// Task 16 fix round 1 (items 1 and 2): a failed re-read never navigates, and a read that answered for
// one account but not another is never "empty" — on the first read or on the re-read.
describe('#40: a failed or partial read is never empty and never leaves for the retry path (fix round 1)', () => {
  it.each([
    ['unreachable', () => new RequestUnreachable('getBalance', 'offline'), 'Balances could not be read right now.'],
    ['a 403', () => new RpcForbidden('getBalance'), 'The server is not answering for now — try again in 10 minutes.'],
  ])('[Try a different seed] whose re-read fails (%s): no navigation, the failure state shown', async (_name, error, text) => {
    let calls = 0;
    const reader = walletReader({
      getBalance: async () => {
        if (calls++ === 0) return 0n;
        throw error();
      },
      getTokenAccountsByOwner: async () => [],
    });
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader});
    fireEvent.click(await screen.findByRole('button', {name: 'Try a different seed'}));
    expect(await screen.findByText(text)).toBeTruthy();
    await new Promise(r => setTimeout(r, 20));
    expect(platform.navigated).toEqual([]);
    expect(screen.queryByText('Wallet imported · empty')).toBeNull();
    expect(screen.queryByRole('button', {name: 'Try a different seed'})).toBeNull();
  });

  it('two accounts, the first zero and the second unanswered: "Balances could not be read right now.", never empty', async () => {
    const reader = walletReader({
      getBalance: async owner => {
        if (owner === RECIPIENT) throw new RequestUnreachable('getBalance', 'offline');
        return 0n;
      },
      getTokenAccountsByOwner: async () => [],
    });
    await renderApp({surface: 'tab', hash: '#/imported', reader});
    expect(await screen.findByText('Balances could not be read right now.')).toBeTruthy();
    expect(screen.queryByText('Wallet imported · empty')).toBeNull();
  });

  it('two accounts, the re-read answers for the first and not the second: the unreachable state, no navigation', async () => {
    let second = 0;
    const reader = walletReader({
      getBalance: async owner => {
        if (owner === RECIPIENT && second++ > 0) throw new RequestUnreachable('getBalance', 'offline');
        return 0n;
      },
      getTokenAccountsByOwner: async () => [],
    });
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', reader});
    fireEvent.click(await screen.findByRole('button', {name: 'Try a different seed'}));
    expect(await screen.findByText('Balances could not be read right now.')).toBeTruthy();
    await new Promise(r => setTimeout(r, 20));
    expect(platform.navigated).toEqual([]);
    expect(screen.queryByText('Wallet imported · empty')).toBeNull();
  });

  // Rule 6 on the unreachable state's Refresh (item 4). The behaviour is what is pinned: a double click
  // reads once. Limitation, measured: the first click's load() swaps the state to loading in the same
  // act(), so the button is gone before the second click — this test passes with a plain <button> too;
  // the LockedButton is the second guard, not separately provable here.
  it('a double click on Refresh reads once', async () => {
    let fail = true;
    const reader = walletReader({
      getBalance: async () => {
        if (fail) throw new RequestUnreachable('getBalance', 'offline');
        return 0n;
      },
      getTokenAccountsByOwner: async () => [],
    });
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader, spy: m => void sent.push((m as {type: string}).type)});
    const refresh = await screen.findByRole('button', {name: 'Refresh'});
    fail = false;
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    expect(await screen.findByText('Wallet imported · empty')).toBeTruthy();
    expect(sent.filter(t => t === 'wallet.balances')).toHaveLength(2);
  });
});
