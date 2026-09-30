// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, walletReader, type WalletOptions} from './harness';
import {Home} from '../screens/Home';
import {useWallet, type WalletModel} from '../WalletContext';
import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../../background/balanceCache';
import {PENDING_KEY} from '../../background/pendingStore';
import {HIDE_BALANCES_KEY} from '../prefs';
import {REFUSED_TEXT} from '../ui/Banner';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';

// Spec §5.1 (#11) and §5.4 (#42 and the D26 refused state). Totals from walletReader: SOL
// 62.4821 × $150 + USDC 740.21 × $1 = $10,112.52 (NOC at the stage price is outside it).
// Synced a few seconds ago, today: the clock-time captions ("last synced 09:41:13") read as clock times.
const CACHE = {[ACCOUNT.publicKey]: {sol: '62482100000', noc: '4200000000000', usdc: '740210000', usdt: '0', at: Date.now() - 5_000}};
const never = () => new Promise<never>(() => undefined);
const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', {value, configurable: true});
const nav = {onReceive: vi.fn(), onActivity: vi.fn(), onAccounts: vi.fn()};
/** #11 inside the real provider; its three ways out are spies (App.test.tsx follows them). */
const renderHome = (o: WalletOptions = {}) => renderInWallet(<Home {...nav} />, o);
/** #11 plus a probe that hands the test the live model (to call refresh() and lock() as a screen would). */
async function renderHomeWithModel(o: WalletOptions = {}): Promise<{model: () => WalletModel}> {
  let current: WalletModel | null = null;
  function Probe() {
    current = useWallet();
    return null;
  }
  await renderInWallet(
    <>
      <Home {...nav} />
      <Probe />
    </>,
    o,
  );
  return {
    model: () => {
      if (current === null) throw new Error('no model yet');
      return current;
    },
  };
}

afterEach(() => {
  setOnline(true);
  localStorage.clear();
  vi.clearAllMocks();
});

describe('#11 dashboard', () => {
  it('loaded: the market total, SOL and NOC under it, one row per held token; NOC at the stage price, outside the total', async () => {
    await renderHome();
    expect(await screen.findByText('$10,112')).toBeTruthy();
    expect(screen.getByText('.52')).toBeTruthy();
    expect(screen.getByText('Total balance')).toBeTruthy();
    const rows = [...document.querySelectorAll('.tokens .row')].map(r => r.getAttribute('data-token'));
    expect(rows).toEqual(['SOL', 'NOC', 'USDC']);
    expect(screen.getByText('62.4821 SOL')).toBeTruthy();
    expect(screen.getByText('4,200.00 NOC')).toBeTruthy();
    expect(screen.getByText('740.21 USDC')).toBeTruthy();
    const noc = document.querySelector('[data-token="NOC"]') as HTMLElement;
    expect(within(noc).getByText('$630.42')).toBeTruthy();
    expect(within(noc).getByText('at stage price')).toBeTruthy();
    // The account and its switcher, the refresh button (D2), the eye.
    expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Main');
    fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
    expect(nav.onAccounts).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', {name: 'Refresh'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Hide balance'})).toBeTruthy();
  });

  it('what is deliberately absent: Send (plan 3), Swap, Buy, the bell, scan, 24 h change, the presale banner, See all', async () => {
    await renderHome();
    await screen.findByText('$10,112');
    for (const gone of ['Send', 'Swap', 'Buy', 'See all', 'Transparent', 'Shielded']) expect(screen.queryByText(gone)).toBeNull();
    expect(screen.queryByLabelText('Notifications')).toBeNull();
    expect(screen.queryByLabelText('Scan')).toBeNull();
    expect(document.body.textContent).not.toMatch(/24h|Presale|Stage \d/);
    expect(screen.getByRole('button', {name: 'Receive'})).toBeTruthy();
  });

  it('cold mount: the skeleton until the first read, when no cache exists — hero, quick action, TOKENS header, rows (design #11 state 1)', async () => {
    await renderHome({reader: walletReader({getBalance: never})});
    expect(await screen.findByTestId('skeleton')).toBeTruthy();
    expect(document.querySelectorAll('.hero .skel-line').length).toBe(3);
    expect(document.querySelectorAll('.quick .qa .skel-circle').length).toBe(1);
    expect(screen.getByText('TOKENS')).toBeTruthy();
    expect(document.querySelectorAll('.tokens .row .skel-circle').length).toBe(4);
    expect(document.querySelector('[data-token]')).toBeNull();
    expect(screen.queryByRole('button', {name: 'Receive'})).toBeNull();
  });

  it('stale: cached values at once, marked, until the fresh read lands', async () => {
    let answer: (v: bigint) => void = () => undefined;
    const reader = walletReader({getBalance: () => new Promise<bigint>(r => (answer = r))});
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText(/^Total balance · cached \d+ (s|min|h|d) ago$/)).toBeTruthy();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(true);
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    await act(async () => answer(1_000_000_000n));
    expect(await screen.findByText('1.0000 SOL')).toBeTruthy();
    expect(screen.getByText('Total balance')).toBeTruthy();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(false);
  });

  it('hidden balance: every layer hidden, and remembered in this page\u2019s localStorage', async () => {
    await renderHome();
    await screen.findByText('$10,112');
    fireEvent.click(screen.getByRole('button', {name: 'Hide balance'}));
    expect(screen.getByText('Tap eye to reveal').classList.contains('change')).toBe(true);
    expect(document.querySelectorAll('.hero .balance.hidden .dots i').length).toBe(6);
    expect(screen.queryByText('$10,112')).toBeNull();
    expect(document.querySelector('.sub-balance')?.textContent).toBe('••••SOL••••NOC');
    expect(screen.getByText('•••••• SOL')).toBeTruthy();
    expect(screen.queryByText('$630.42')).toBeNull();
    expect(localStorage.getItem(HIDE_BALANCES_KEY)).toBe('1');
    fireEvent.click(screen.getByRole('button', {name: 'Show balance'}));
    expect(screen.getByText('$10,112')).toBeTruthy();
  });

  it('no price: the total reads — and "Prices unavailable"; amounts still show, never $0.00', async () => {
    await renderHome({
      deps: {
        prices: async () => {
          throw new Error('down');
        },
        stagePrice: async () => {
          throw new Error('down');
        },
      },
    });
    expect(await screen.findByText('Prices unavailable')).toBeTruthy();
    expect(screen.getByText('62.4821 SOL')).toBeTruthy();
    expect(document.body.textContent).not.toContain('$0.00');
  });

  it('pending strip: an open send of this account — its text, and it opens Activity (plan-1 stand-in)', async () => {
    await renderHome({
      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
    });
    fireEvent.click(await screen.findByText('Sending 2.48 SOL · pending'));
    expect(nav.onActivity).toHaveBeenCalledTimes(1);
  });
});

describe('#42 offline and the D26 refused state', () => {
  it('refused (a 403): the D26 banner, cached values marked, refresh disabled, nothing retried', async () => {
    let reads = 0;
    const reader = walletReader({
      getBalance: async () => {
        reads += 1;
        throw new RpcForbidden('getBalance');
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    expect(reads).toBe(1);
  });

  it('unreachable while the browser is online: "Could not reach the Noctura server", never "offline" (review L3)', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'no answer');
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
    expect(screen.getByText('Showing your last synced balances.')).toBeTruthy();
    expect(screen.queryByText(/offline/)).toBeNull();
  });

  it('just disconnected: the design\u2019s banner and caption; Receive stays enabled and opens #13 (D36)', async () => {
    setOnline(false);
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'offline');
      },
    });
    // The background's clock at today's time, so the fresh prices' `at` reads as a clock time.
    await renderHome({reader, deps: {now: () => Date.now()}, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(screen.getByText('Network just dropped · the Noctura server is unreachable')).toBeTruthy();
    expect(screen.getByText('Sending needs a network connection. Receiving works — your address is on this device. Use the refresh button to retry.')).toBeTruthy();
    // (62.4821 × $150 + 740.21) / $150 = 67.4168…: truncated to 67.41, never rounded up (review L6).
    expect(screen.getByText(/^≈ 67\.41 SOL · last synced \d\d:\d\d:\d\d$/)).toBeTruthy();
    expect(screen.getByText(/^Total balance · cached \d+ s ago$/)).toBeTruthy();
    expect(document.querySelector('.hero .s8-stale-mark')).toBeTruthy();
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    expect(screen.getByText('4,200.00 NOC · cached')).toBeTruthy();
    expect(screen.getAllByText(/^price \d\d:\d\d:\d\d$/).length).toBe(3);
    fireEvent.click(screen.getByRole('button', {name: 'Receive'}));
    expect(nav.onReceive).toHaveBeenCalledTimes(1);
  });

  it('sustained (two failed refreshes): "Showing cached data", the retry count, the stale label and the offline callout', async () => {
    setOnline(false);
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'offline');
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    await screen.findByText("You're offline");
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText("You're offline · Showing cached data")).toBeTruthy();
    // The open read and one retry failed: one retry counted (the open read is not a retry).
    expect(screen.getByText(/^Last synced .+ ago · 1 retry failed$/)).toBeTruthy();
    expect(screen.getByText(/^Stale · \d\d:\d\d:\d\d$/)).toBeTruthy();
    expect(screen.getByText('≈ 67.41 SOL · prices may have moved')).toBeTruthy();
    // The design's sustained state has the callout, not the just-disconnected caption.
    expect(screen.queryByText(/^Sending needs a network connection/)).toBeNull();
    expect(document.querySelector('.hero .s8-stale-mark')).toBeTruthy();
    for (const line of ['What you can still do offline:', 'Read your last synced balances', 'Show your address to receive funds', 'Lock the wallet from Settings']) {
      expect(screen.getByText(line)).toBeTruthy();
    }
    expect(screen.getAllByText('stale').length).toBeGreaterThan(0);
  });

  it('reconnecting: the first good read after being away shows "Connected · syncing" and rows turn live', async () => {
    let down = true;
    const reader = walletReader({
      getBalance: async () => {
        if (down) throw new RequestUnreachable('u', 'no answer');
        return 62_482_100_000n;
      },
    });
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    await screen.findByText('Could not reach the Noctura server');
    down = false;
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText('Connected · syncing')).toBeTruthy();
    expect(screen.getByText('Auto-dismisses in 1.5 s')).toBeTruthy();
    expect(screen.getAllByText('live').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText('Connected · syncing')).toBeNull(), {timeout: 3_000});
  });

  it('reconnecting while the price read still runs: "Total balance · refreshing", the spinner beside the value, "re-fetching prices"', async () => {
    let down = true;
    let priceReads = 0;
    const reader = walletReader({
      getBalance: async () => {
        if (down) throw new RequestUnreachable('u', 'no answer');
        return 62_482_100_000n;
      },
    });
    await renderHome({
      reader,
      before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE),
      deps: {
        prices: async () => {
          priceReads += 1;
          if (priceReads > 1) return never();
          return {solana: 150, usdc: 1, usdt: 1};
        },
      },
    });
    await screen.findByText('Could not reach the Noctura server');
    down = false;
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText('Connected · syncing')).toBeTruthy();
    expect(screen.getByText('Total balance · refreshing')).toBeTruthy();
    expect(screen.getByText('≈ 67.41 SOL · re-fetching prices')).toBeTruthy();
    expect(document.querySelector('.hero .balance [data-spinner]')).toBeTruthy();
  });

  it('the price cache feeds the stale view too', async () => {
    await renderHome({
      reader: walletReader({getBalance: never}),
      before: async ext => {
        await ext.local.set(BALANCE_CACHE_KEY, CACHE);
        await ext.local.set(PRICE_CACHE_KEY, {sol: 100, usdc: 1, usdt: 1, noc: null, at: 1_000});
      },
    });
    // 62.4821 × $100 + 740.21 = $6,988.42.
    expect(await screen.findByText('$6,988')).toBeTruthy();
  });

  it('cached prices stay marked after fresh balances land, until a fresh price read succeeds (E4)', async () => {
    const pricedAt = Date.now() - 120_000;
    await renderHome({
      before: async ext => ext.local.set(PRICE_CACHE_KEY, {sol: 100, usdc: 1, usdt: 1, noc: null, at: pricedAt}),
      deps: {
        prices: async () => {
          throw new Error('down');
        },
        stagePrice: async () => {
          throw new Error('down');
        },
      },
    });
    // The fresh balances (the design's numbers) valued at the cached $100: $6,988.42.
    expect(await screen.findByText('62.4821 SOL')).toBeTruthy();
    expect(await screen.findByText('$6,988')).toBeTruthy();
    expect(screen.getByText(/^Total balance · cached 2 min ago$/)).toBeTruthy();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(true);
    expect(document.querySelector('.hero .s8-stale-mark')).toBeTruthy();
  });

  it('no balance read yet and unreachable: the layout with "—", never an endless skeleton; Receive enabled (D36)', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'no answer');
      },
    });
    await renderHome({reader});
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getByText('TOKENS')).toBeTruthy();
    expect([...document.querySelectorAll('.tokens .row')].map(r => r.getAttribute('data-token'))).toEqual(['SOL', 'NOC']);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('$0.00');
    const receive = screen.getByRole('button', {name: 'Receive'}) as HTMLButtonElement;
    expect(receive.disabled).toBe(false);
    fireEvent.click(receive);
    expect(nav.onReceive).toHaveBeenCalledTimes(1);
  });

  it('no balance read yet and refused (403): the D26 banner over the "—" layout; Receive enabled and reachable', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RpcForbidden('getBalance');
      },
    });
    await renderHome({reader});
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect((screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement).disabled).toBe(true);
    const receive = screen.getByRole('button', {name: 'Receive'}) as HTMLButtonElement;
    expect(receive.disabled).toBe(false);
    fireEvent.click(receive);
    expect(nav.onReceive).toHaveBeenCalledTimes(1);
  });

  it('refused is terminal for this popup: neither the online event nor a refresh() call reads again', async () => {
    let reads = 0;
    const reader = walletReader({
      getBalance: async () => {
        reads += 1;
        throw new RpcForbidden('getBalance');
      },
    });
    const {model} = await renderHomeWithModel({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    await screen.findByText(REFUSED_TEXT);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await model().refresh();
    });
    expect(reads).toBe(1);
    expect(screen.getByText(REFUSED_TEXT)).toBeTruthy();
  });

  it('the online event never starts a second read while one runs', async () => {
    let reads = 0;
    await renderHome({
      reader: walletReader({
        getBalance: () => {
          reads += 1;
          return never();
        },
      }),
    });
    await screen.findByTestId('skeleton');
    await waitFor(() => expect(reads).toBe(1));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(reads).toBe(1);
  });

  it('sustained after 30 s (the injected clock), with no retry made: no retry count, the stale label', async () => {
    let t = Date.now();
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'no answer');
      },
    });
    await renderHome({reader, now: () => t, before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE)});
    expect(await screen.findByText('Showing your last synced balances.')).toBeTruthy();
    expect(screen.queryByText(/^Stale · /)).toBeNull();
    t += 31_000;
    // The screen's clock ticks each second through the model's now().
    expect(await screen.findByText(/^Last synced \d+ s ago$/, undefined, {timeout: 2_500})).toBeTruthy();
    // Unreachable keeps its own title (L3), even sustained.
    expect(screen.getByText('Could not reach the Noctura server')).toBeTruthy();
    expect(screen.getByText(/^Stale · \d\d:\d\d:\d\d$/)).toBeTruthy();
    expect(screen.getByText('≈ 67.41 SOL · prices may have moved')).toBeTruthy();
  });

  it('lock: the pending strip goes with the session', async () => {
    const {model} = await renderHomeWithModel({
      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
    });
    await screen.findByText('Sending 2.48 SOL · pending');
    await act(async () => model().lock());
    expect(model().phase).toBe('locked');
    expect(model().pending).toEqual([]);
    expect(screen.queryByText('Sending 2.48 SOL · pending')).toBeNull();
  });
});
