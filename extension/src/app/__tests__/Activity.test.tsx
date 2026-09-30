// @vitest-environment happy-dom
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, walletReader} from './harness';
import {Activity} from '../screens/Activity';
import {Home} from '../screens/Home';
import {PENDING_KEY} from '../../background/pendingStore';
import {ACTIVITY_FILTER_KEY} from '../prefs';
import {REFUSED_TEXT} from '../ui/Banner';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {COUNTERPARTY, failedTx, otherTx, presalePurchase, receivedUsdc, sentSol, sig} from '../../../e2e/historyFixtures';

// Spec §6.2 (#26) and §6.4 (#41).
const NOW = Math.floor(Date.now() / 1000);
function historyReader(n = 5) {
  const txs: Record<string, unknown> = {
    [sig(1)]: sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW - 60),
    [sig(2)]: receivedUsdc(ACCOUNT.publicKey, COUNTERPARTY, 250_000_000, NOW - 120),
    [sig(3)]: presalePurchase(ACCOUNT.publicKey, 1_000_000_000, NOW - 180),
    [sig(4)]: otherTx(ACCOUNT.publicKey, NOW - 240),
    [sig(5)]: failedTx(ACCOUNT.publicKey, NOW - 300),
  };
  const list = Array.from({length: n}, (_, i) => sig(i + 1));
  for (let i = 6; i <= n; i++) txs[sig(i)] = otherTx(ACCOUNT.publicKey, NOW - 300 - i);
  return walletReader({
    getSignaturesForAddress: async (_a, o) => {
      const from = o.before === undefined ? 0 : list.indexOf(o.before) + 1;
      return list.slice(from, from + o.limit).map(s => ({signature: s, blockTime: null, err: null}));
    },
    getTransaction: async s => txs[s] ?? null,
  });
}

const nav = {onTx: vi.fn(), onReceive: vi.fn()};
async function openActivity(reader = historyReader(), before?: NonNullable<Parameters<typeof renderInWallet>[1]>['before']) {
  return renderInWallet(<Activity {...nav} />, {reader, before});
}

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('#26 activity', () => {
  it('rows per kind: sent (own account label), received, purchase, other, failed — no fiat, no origin badge', async () => {
    await openActivity();
    expect(await screen.findByText('Sent SOL')).toBeTruthy();
    const sent = screen.getByText('Sent SOL').closest('button') as HTMLElement;
    expect(within(sent).getByText(/^to Your account: Savings · /)).toBeTruthy();
    expect(within(sent).getByText('−2.4800')).toBeTruthy();
    const received = screen.getByText('Received USDC').closest('button') as HTMLElement;
    expect(within(received).getByText(/^from H4qZ…m2N1 · /)).toBeTruthy();
    expect(within(received).getByText('+250.00')).toBeTruthy();
    expect(screen.getByText('Presale purchase')).toBeTruthy();
    expect(screen.getByText(/^no transfer to or from this account/)).toBeTruthy();
    expect(screen.getByText('Failed · transaction')).toBeTruthy();
    expect(screen.getByText(/^the network fee was charged · /)).toBeTruthy();
    expect(screen.getByText(/^TODAY · /)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\$\d|Wallet|Dapp|Swaps|Shielded/);
    fireEvent.click(sent);
    expect(nav.onTx).toHaveBeenCalledWith(expect.objectContaining({signature: sig(1), kind: 'sent', amount: 2_480_000_000n}));
  });

  it('filters Sent / Received / Purchases apply to the loaded rows, and the choice is remembered', async () => {
    await openActivity();
    await screen.findByText('Sent SOL');
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['All', 'Sent', 'Received', 'Purchases']);
    fireEvent.click(screen.getByRole('tab', {name: 'Sent'}));
    expect(screen.getByText('Sent SOL')).toBeTruthy();
    expect(screen.queryByText('Received USDC')).toBeNull();
    fireEvent.click(screen.getByRole('tab', {name: 'Received'}));
    expect(screen.getByText('Received USDC')).toBeTruthy();
    expect(screen.queryByText('Sent SOL')).toBeNull();
    fireEvent.click(screen.getByRole('tab', {name: 'Purchases'}));
    expect(screen.getByText('Presale purchase')).toBeTruthy();
    expect(localStorage.getItem(ACTIVITY_FILTER_KEY)).toBe('purchases');
  });

  it('"Load more" while the last page was full, continuing from its last signature', async () => {
    await openActivity(historyReader(12));
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}));
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Load more'})).toBeNull());
    expect(document.querySelectorAll('button.tx-row')).toHaveLength(12);
  });

  it('open sends on top, in a PENDING section', async () => {
    await openActivity(historyReader(), ext =>
      ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now() - 72_000})]),
    );
    expect(await screen.findByText('PENDING')).toBeTruthy();
    expect(screen.getByText('Sending 2.48 SOL')).toBeTruthy();
    expect(screen.getByText(/^waiting · 1 m \d+ s$/)).toBeTruthy();
  });

  it('unreachable and refused show their banners over what loaded', async () => {
    const down = walletReader({
      getSignaturesForAddress: async () => {
        throw new RequestUnreachable('u', 'x');
      },
    });
    await openActivity(down);
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
  });

  it('a 403 is the D26 banner', async () => {
    const refused = walletReader({
      getSignaturesForAddress: async () => {
        throw new RpcForbidden('getSignaturesForAddress');
      },
    });
    await openActivity(refused);
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
  });
});

describe('#41 empty activity', () => {
  it('no rows and no open send: the empty state, Receive crypto → #13; no "View popular dApps"', async () => {
    await openActivity(walletReader());
    expect(await screen.findByText('No activity yet')).toBeTruthy();
    expect(screen.getByText('Your transactions will appear here once you send or receive assets.')).toBeTruthy();
    expect(screen.getByText('Use the refresh button to check again.')).toBeTruthy();
    expect(screen.queryByText('View popular dApps')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Receive crypto'}));
    expect(nav.onReceive).toHaveBeenCalledTimes(1);
  });

  it('refresh active: "Checking the network…" while it reads again', async () => {
    let calls = 0;
    const reader = walletReader({
      getSignaturesForAddress: async () => {
        calls += 1;
        if (calls > 1) await new Promise(() => undefined);
        return [];
      },
    });
    await openActivity(reader);
    await screen.findByText('No activity yet');
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText('Checking the network…')).toBeTruthy();
    expect(screen.getByText('Re-fetching through the Noctura server')).toBeTruthy();
  });

  // Review M4: a 403 on any screen is the whole app's D26 state — Home's refresh is disabled too, and nothing more is asked.
  it('a 403 on Activity disables Home’s refresh; no further coordinator request', async () => {
    let reads = 0;
    const reader = walletReader({
      getBalance: async () => (reads++, 62_482_100_000n),
      getSignaturesForAddress: async () => {
        reads++;
        throw new RpcForbidden('getSignaturesForAddress');
      },
    });
    await renderInWallet(
      <>
        <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
        <Activity {...nav} />
      </>,
      {reader},
    );
    await waitFor(() => expect(screen.getAllByText(REFUSED_TEXT).length).toBe(2));
    const refresh = screen.getAllByRole('button', {name: 'Refresh'});
    expect(refresh.every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    const seen = reads;
    for (const b of refresh) fireEvent.click(b);
    await new Promise(r => setTimeout(r, 50));
    expect(reads).toBe(seen);
  });
});
