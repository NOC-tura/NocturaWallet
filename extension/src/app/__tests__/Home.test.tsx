// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, walletReader, type WalletOptions} from './harness';
import {BALANCES_FAILED_TEXT, Home} from '../screens/Home';
import {ago, stamp} from '../format';
import {useWallet, type WalletModel} from '../WalletContext';
import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../../background/balanceCache';
import {PENDING_KEY} from '../../background/pendingStore';
import {HIDE_BALANCES_KEY} from '../prefs';
import {REFUSED_TEXT} from '../ui/Banner';
import {RequestUnreachable, RpcForbidden, RpcMalformed} from '../../../../core/solana/rpc';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';

// Spec §5.1 (#11) and §5.4 (#42 and the D26 refused state). Totals from walletReader: SOL
// 62.4821 × $150 + USDC 740.21 × $1 = $10,112.52 (NOC at the stage price is outside it).
// Synced a few seconds ago, today: the clock-time captions ("last synced 09:41:13") read as clock times.
// Stamped when each test writes it, not at module load (the final review's M2): under a loaded full
// suite a module-load stamp aged past a minute before the later tests ran ("cached 1 min ago").
const cache = () => ({[ACCOUNT.publicKey]: {sol: '62482100000', noc: '4200000000000', usdc: '740210000', usdt: '0', at: Date.now() - 5_000}});
const never = () => new Promise<never>(() => undefined);
const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', {value, configurable: true});
const nav = {onSend: vi.fn(), onReceive: vi.fn(), onPending: vi.fn(), onAccounts: vi.fn()};
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

  it('what is deliberately absent: Swap, Buy, the bell, scan, 24 h change, the presale banner, See all', async () => {
    await renderHome();
    await screen.findByText('$10,112');
    for (const gone of ['Swap', 'Buy', 'See all', 'Transparent', 'Shielded']) expect(screen.queryByText(gone)).toBeNull();
    expect(screen.queryByLabelText('Notifications')).toBeNull();
    expect(screen.queryByLabelText('Scan')).toBeNull();
    expect(document.body.textContent).not.toMatch(/24h|Presale|Stage \d/);
    expect(screen.getByRole('button', {name: 'Receive'})).toBeTruthy();
  });

  it('cold mount: the skeleton until the first read, when no cache exists — hero, quick action, TOKENS header, rows (design #11 state 1)', async () => {
    await renderHome({reader: walletReader({getBalance: never})});
    expect(await screen.findByTestId('skeleton')).toBeTruthy();
    expect(document.querySelectorAll('.hero .skel-line').length).toBe(3);
    // Plan 3: the skeleton draws the actions that exist — Send and Receive (§5.1 Differs).
    expect(document.querySelectorAll('.quick .qa .skel-circle').length).toBe(2);
    expect(screen.getByText('TOKENS')).toBeTruthy();
    expect(document.querySelectorAll('.tokens .row .skel-circle').length).toBe(4);
    expect(document.querySelector('[data-token]')).toBeNull();
    expect(screen.queryByRole('button', {name: 'Receive'})).toBeNull();
  });

  // Final review I1: a first read that fails with a code that is neither a network one nor a 403
  // ('failed') settles the first read too — never an endless skeleton (§5.1 "until the first read"),
  // and Receive stays usable (D36).
  it('a first read that fails without a network code (\'failed\'): the layout, not the skeleton; Receive, the refresh button and the failed-read line; a good retry clears it', async () => {
    let reads = 0;
    const reader = walletReader({
      getBalance: async () => {
        reads += 1;
        if (reads === 1) throw new RpcMalformed('getBalance: no result');
        return 62_482_100_000n;
      },
    });
    await renderHome({reader});
    expect(await screen.findByText('Could not read your balances. Try again.')).toBeTruthy();
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    // Not a network state: no #42 or D26 banner.
    expect(screen.queryByText('Could not reach the Noctura server')).toBeNull();
    expect(screen.queryByText(REFUSED_TEXT)).toBeNull();
    expect([...document.querySelectorAll('.tokens .row')].map(r => r.getAttribute('data-token'))).toEqual(['SOL', 'NOC']);
    expect(document.body.textContent).not.toContain('$0.00');
    const receive = screen.getByRole('button', {name: 'Receive'}) as HTMLButtonElement;
    expect(receive.disabled).toBe(false);
    fireEvent.click(receive);
    expect(nav.onReceive).toHaveBeenCalledTimes(1);
    const refresh = screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement;
    await waitFor(() => expect(refresh.disabled).toBe(false));
    fireEvent.click(refresh);
    expect(await screen.findByText('$10,112')).toBeTruthy();
    expect(screen.queryByText('Could not read your balances. Try again.')).toBeNull();
  });

  it('the settled first read is per account: after a failed read of one account, another with nothing cached shows the skeleton until its own read, not the failed line', async () => {
    const reader = walletReader({
      getBalance: async address => {
        if (address === ACCOUNT.publicKey) throw new RpcMalformed('getBalance: no result');
        return never();
      },
    });
    const {model} = await renderHomeWithModel({reader});
    expect(await screen.findByText('Could not read your balances. Try again.')).toBeTruthy();
    await act(async () => {
      await model().engine.select(1);
      // Not awaited: the second account's read never answers here.
      void model().reload();
    });
    expect(await screen.findByTestId('skeleton')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Savings');
    expect(screen.queryByText('Could not read your balances. Try again.')).toBeNull();
  });

  it('stale: cached values at once, marked, until the fresh read lands', async () => {
    let answer: (v: bigint) => void = () => undefined;
    const reader = walletReader({getBalance: () => new Promise<bigint>(r => (answer = r))});
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
    expect(await screen.findByText(/^Total balance · cached \d+ (s|min|h|d) ago$/)).toBeTruthy();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(true);
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    await act(async () => answer(1_000_000_000n));
    expect(await screen.findByText('1.0000 SOL')).toBeTruthy();
    expect(screen.getByText('Total balance')).toBeTruthy();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(false);
  });

  // Owner decision 2026-10-01 (delegated to the controller, spec §5.1): a failed refresh over fresh
  // balances marks them stale exactly as cached ones (E4); lastSync stays at the last good read.
  it('a failed refresh (\'failed\') over fresh balances: the stale marks, the failed-read line and "last synced"; lastSync does not move; a good read clears both', async () => {
    let t = Date.now();
    let fail = false;
    const reader = walletReader({
      getBalance: async () => {
        if (fail) throw new RpcMalformed('getBalance: no result');
        return 62_482_100_000n;
      },
    });
    const {model} = await renderHomeWithModel({reader, now: () => t});
    expect(await screen.findByText('$10,112')).toBeTruthy();
    const synced = model().lastSync;
    expect(synced).not.toBeNull();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(false);
    const refresh = screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement;
    await waitFor(() => expect(refresh.disabled).toBe(false));
    t += 120_000;
    fail = true;
    fireEvent.click(refresh);
    expect(await screen.findByText(BALANCES_FAILED_TEXT)).toBeTruthy();
    expect(model().stale).toBe(true);
    expect(model().lastSync).toBe(synced);
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(true);
    expect(document.querySelector('.hero .s8-stale-mark')).toBeTruthy();
    expect(document.querySelector('.tokens')?.classList.contains('s8-stale')).toBe(true);
    // The screen's clock ticks each second through the model's now().
    expect(await screen.findByText(`Total balance · cached ${ago(synced ?? 0, t)}`, undefined, {timeout: 2_500})).toBeTruthy();
    expect(screen.getByText(`≈ 67.41 SOL · last synced ${stamp(synced ?? 0, t)}`)).toBeTruthy();
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    // The balances stay, never zero or "failed" in their place (§7.3); no network banner.
    expect(screen.getByText('$10,112')).toBeTruthy();
    expect(document.body.textContent).not.toContain('$0.00');
    expect(screen.queryByText('Could not reach the Noctura server')).toBeNull();
    expect(screen.queryByText(REFUSED_TEXT)).toBeNull();
    t += 1_000;
    fail = false;
    await waitFor(() => expect(refresh.disabled).toBe(false));
    fireEvent.click(refresh);
    await waitFor(() => expect(screen.queryByText(BALANCES_FAILED_TEXT)).toBeNull());
    expect(model().stale).toBe(false);
    expect(model().lastSync).toBe(t);
    expect(screen.getByText('Total balance')).toBeTruthy();
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(false);
    expect(screen.queryByText(/last synced/)).toBeNull();
    expect(screen.getByText('62.4821 SOL')).toBeTruthy();
  });

  it('a refresh that answers \'unreachable\' over fresh balances: #42\u2019s banner and the stale marks, no failed-read line; lastSync does not move; a good read clears the marks', async () => {
    let t = Date.now();
    let down = false;
    const reader = walletReader({
      getBalance: async () => {
        if (down) throw new RequestUnreachable('u', 'no answer');
        return 62_482_100_000n;
      },
    });
    const {model} = await renderHomeWithModel({reader, now: () => t});
    expect(await screen.findByText('$10,112')).toBeTruthy();
    const synced = model().lastSync;
    const refresh = screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement;
    await waitFor(() => expect(refresh.disabled).toBe(false));
    t += 5_000;
    down = true;
    fireEvent.click(refresh);
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
    await waitFor(() => expect(model().stale).toBe(true));
    expect(model().lastSync).toBe(synced);
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(true);
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    expect(screen.queryByText(BALANCES_FAILED_TEXT)).toBeNull();
    t += 1_000;
    down = false;
    await waitFor(() => expect(refresh.disabled).toBe(false));
    fireEvent.click(refresh);
    expect(await screen.findByText('Connected · syncing')).toBeTruthy();
    await waitFor(() => expect(model().stale).toBe(false));
    expect(model().lastSync).toBe(t);
    expect(document.querySelector('.hero')?.classList.contains('s8-stale')).toBe(false);
    expect(screen.queryByText(BALANCES_FAILED_TEXT)).toBeNull();
  });

  it('a 403 refresh over fresh balances: the D26 banner over stale balances; lastSync does not move', async () => {
    let refused = false;
    const reader = walletReader({
      getBalance: async () => {
        if (refused) throw new RpcForbidden('getBalance');
        return 62_482_100_000n;
      },
    });
    const {model} = await renderHomeWithModel({reader});
    expect(await screen.findByText('$10,112')).toBeTruthy();
    const synced = model().lastSync;
    const refresh = screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement;
    await waitFor(() => expect(refresh.disabled).toBe(false));
    refused = true;
    fireEvent.click(refresh);
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect(model().stale).toBe(true);
    expect(model().lastSync).toBe(synced);
    expect(screen.getByText('62.4821 SOL · cached')).toBeTruthy();
    expect(screen.queryByText(BALANCES_FAILED_TEXT)).toBeNull();
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

  it('pending strip: an open send of this account — its text, and it opens that send (#21/#54)', async () => {
    await renderHome({
      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
    });
    fireEvent.click(await screen.findByText('Sending 2.48 SOL · pending'));
    expect(nav.onPending).toHaveBeenCalledWith(expect.objectContaining({id: 'p1'}));
  });

  // Plan 3 (§5.1, §5.4, D36): the Send quick action opens #12; offline, unreachable and refused disable it — Receive stays.
  it('Send opens #12; it is disabled offline, while the server cannot be reached, and in the 403 cool-down — Receive is not', async () => {
    await renderHome();
    await screen.findByText('$10,112');
    expect([...document.querySelectorAll('.quick .qa .lbl')].map(l => l.textContent)).toEqual(['Send', 'Receive']);
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));
    expect(nav.onSend).toHaveBeenCalledTimes(1);
    for (const failing of [new RequestUnreachable('u', 'x'), new RpcForbidden('getBalance')]) {
      cleanup();
      await renderHome({
        reader: walletReader({
          getBalance: async () => {
            throw failing;
          },
        }),
        before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache()),
      });
      await waitFor(() => expect((screen.getByRole('button', {name: 'Send'}) as HTMLButtonElement).disabled).toBe(true));
      expect((screen.getByRole('button', {name: 'Receive'}) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  // Rule 6 (Task 14 carry): Send is a LockedButton — a second click, `disabled` lifted, opens #12 no second time.
  it('Send: a double click opens #12 once', async () => {
    await renderHome();
    const send = (await screen.findByRole('button', {name: 'Send'})) as HTMLButtonElement;
    fireEvent.click(send);
    send.disabled = false;
    fireEvent.click(send);
    expect(nav.onSend).toHaveBeenCalledTimes(1);
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
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
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
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
    expect(screen.getByText('Showing your last synced balances.')).toBeTruthy();
    expect(screen.queryByText(/offline/)).toBeNull();
  });

  // Final review M1: a 403 from the price read is not hidden behind the balance read's "unreachable".
  it('balances unreachable and prices refused (403): refused wins — the D26 banner, refresh disabled', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'no answer');
      },
    });
    await renderHome({
      reader,
      before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache()),
      deps: {
        prices: async () => {
          throw new RpcForbidden('/wallet/prices');
        },
      },
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect(screen.queryByText('Could not reach the Noctura server')).toBeNull();
    expect((screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('balances refused (403) and prices unreachable: still refused', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RpcForbidden('getBalance');
      },
    });
    await renderHome({
      reader,
      deps: {
        prices: async () => {
          throw new RequestUnreachable('u', 'no answer');
        },
      },
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect(screen.queryByText('Could not reach the Noctura server')).toBeNull();
  });

  it('just disconnected: the design\u2019s banner and caption; Receive stays enabled and opens #13 (D36)', async () => {
    setOnline(false);
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'offline');
      },
    });
    // The background's clock at today's time, so the fresh prices' `at` reads as a clock time.
    await renderHome({reader, deps: {now: () => Date.now()}, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(screen.getByText('Network just dropped · the Noctura server is unreachable')).toBeTruthy();
    expect(screen.getByText('Sending needs a network connection. Receiving works — your address is on this device. Use the refresh button to retry.')).toBeTruthy();
    // (62.4821 × $150 + 740.21) / $150 = 67.4168…: truncated to 67.41, never rounded up (review L6).
    // The hero line waits on the cache and price reads, which can land after the banner (M2).
    expect(await screen.findByText(/^≈ 67\.41 SOL · last synced \d\d:\d\d:\d\d$/)).toBeTruthy();
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
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
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
    await renderHome({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
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
      before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache()),
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
        await ext.local.set(BALANCE_CACHE_KEY, cache());
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

  // Final re-review F2: once refused, a later 'unreachable' report never replaces the D26 state.
  it('refused, then a screen reports unreachable: the D26 banner stays, refresh stays disabled, no #42', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RpcForbidden('getBalance');
      },
    });
    const {model} = await renderHomeWithModel({reader});
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    act(() => model().report('unreachable'));
    expect(model().net.mode).toBe('refused');
    expect(screen.getByText(REFUSED_TEXT)).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Could not reach the Noctura server')).toBeNull();
    expect(screen.queryByText(/offline/)).toBeNull();
  });

  it('refused is terminal for this popup: neither the online event nor a refresh() call reads again', async () => {
    let reads = 0;
    const reader = walletReader({
      getBalance: async () => {
        reads += 1;
        throw new RpcForbidden('getBalance');
      },
    });
    const {model} = await renderHomeWithModel({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
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
    await renderHome({reader, now: () => t, before: async ext => ext.local.set(BALANCE_CACHE_KEY, cache())});
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
