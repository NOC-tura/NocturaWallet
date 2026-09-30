// @vitest-environment happy-dom
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, setupWallet, walletReader} from './harness';
import {Activity} from '../screens/Activity';
import {rowText} from '../history';
import {Home} from '../screens/Home';
import {RECONNECTED_MS, useWallet, WalletProvider, type WalletModel} from '../WalletContext';
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

  // Task 17 fix round 1 (C6, C7): the design's row chrome (index.html #s26 26b).
  it('an address meta line is mono (noc-mono) as the design draws it; a label or words are not', async () => {
    await openActivity();
    await screen.findByText('Sent SOL');
    const sec = (title: string) => (screen.getByText(title).closest('button') as HTMLElement).querySelector('.sec') as HTMLElement;
    // "from H4qZ…m2N1" is an address; "to Your account: Savings" is a label (it would clip in mono).
    expect(sec('Received USDC').classList.contains('noc-mono')).toBe(true);
    expect(sec('Sent SOL').classList.contains('noc-mono')).toBe(false);
    const base = {signature: sig(9), blockTime: null, mint: null, feeLamports: 5_000n, failed: false} as const;
    expect(rowText({...base, kind: 'sent', token: 'SOL', amount: 1n, counterparty: COUNTERPARTY}, []).mono).toBe(true);
    expect(rowText({...base, kind: 'sent', token: 'SOL', amount: 1n, counterparty: null}, []).mono).toBe(false);
    expect(sec('Presale purchase').classList.contains('noc-mono')).toBe(false);
    expect(sec('Other transaction').classList.contains('noc-mono')).toBe(false);
    expect(sec('Failed · transaction').classList.contains('noc-mono')).toBe(false);
  });

  // Found in fix round 1's visual pass: 26b's TODAY / YESTERDAY rows end in the time ("· 9:14 AM"),
  // older sections' rows in the day ("· May 6", 11832, 11840).
  it('the meta ends in the time today and yesterday, and in the day ("May 6") in older sections', async () => {
    const old = NOW - 3 * 86_400;
    const reader = walletReader({
      getSignaturesForAddress: async () => [{signature: sig(1), blockTime: NOW, err: null}, {signature: sig(4), blockTime: old, err: null}],
      getTransaction: async s => (s === sig(1) ? sentSol(ACCOUNT.publicKey, COUNTERPARTY, 1_000_000_000, NOW) : otherTx(ACCOUNT.publicKey, old)),
    });
    await openActivity(reader);
    await screen.findByText('Other transaction');
    const sec = (title: string) => ((screen.getByText(title).closest('button') as HTMLElement).querySelector('.sec') as HTMLElement).textContent;
    const time = new Date(NOW * 1000).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
    const day = new Date(old * 1000).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
    expect(sec('Sent SOL')).toBe(`to ${COUNTERPARTY.slice(0, 4)}…${COUNTERPARTY.slice(-4)} · ${time}`);
    expect(sec('Other transaction')).toBe(`no transfer to or from this account · ${day}`);
  });

  it('the Other row is the design\'s no-funds row: a neutral icon circle with the document glyph', async () => {
    await openActivity();
    await screen.findByText('Other transaction');
    const ic = (screen.getByText('Other transaction').closest('button') as HTMLElement).querySelector('.ic') as HTMLElement;
    expect(ic.className).toBe('ic');
    expect(ic.querySelector('path[d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"]')).not.toBeNull();
    // The rest keep their tones: sent, recv (rotated in app.css), purchase in the swap tint, fail.
    const tone = (title: string) => ((screen.getByText(title).closest('button') as HTMLElement).querySelector('.ic') as HTMLElement).className;
    expect([tone('Sent SOL'), tone('Received USDC'), tone('Presale purchase'), tone('Failed · transaction')]).toEqual(['ic send', 'ic recv', 'ic swap', 'ic fail']);
    // Fix round 2 (#2): the purchase row follows 26b's swap row (11813): `.ic.swap` with #i-swap.
    const purchase = (screen.getByText('Presale purchase').closest('button') as HTMLElement).querySelector('.ic') as HTMLElement;
    expect([...purchase.querySelectorAll('path')].map(p => p.getAttribute('d'))).toEqual(['M3 8h13a4 4 0 0 1 0 8h-3', 'm7 4-4 4 4 4', 'M21 16H8a4 4 0 0 1 0-8h3', 'm17 20 4-4-4-4']);
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

  // Review fix round 1, #1: a full page of signatures with one not-yet-indexed entry must not lose
  // "Load more", and continuing must follow the RPC page's own last signature (`next`), not the last
  // row that happened to decode — those can differ once a signature is skipped.
  it('an unindexed signature in a full page: 9 rows but [Load more] still shows, and continuing uses next, not the last shown row', async () => {
    const list = Array.from({length: 10}, (_, i) => sig(i + 1));
    const txs: Record<string, unknown> = {};
    for (let i = 0; i < 9; i++) txs[list[i] as string] = otherTx(ACCOUNT.publicKey, NOW - i);
    // list[9] (the page's real last signature) has no getTransaction result: not indexed yet.
    const seenBefore: (string | undefined)[] = [];
    const reader = walletReader({
      getSignaturesForAddress: async (_a, o) => {
        seenBefore.push(o.before);
        if (o.before === undefined) return list.map(s => ({signature: s, blockTime: null, err: null}));
        return [];
      },
      getTransaction: async s => txs[s] ?? null,
    });
    await openActivity(reader);
    const btn = await screen.findByRole('button', {name: 'Load more'});
    expect(document.querySelectorAll('button.tx-row')).toHaveLength(9);
    fireEvent.click(btn);
    await waitFor(() => expect(seenBefore).toEqual([undefined, list[9]]));
  });

  it('a full page of all-unindexed signatures: 0 rows but [Load more] still shows — never the #41 empty state', async () => {
    const list = Array.from({length: 10}, (_, i) => sig(i + 1));
    const reader = walletReader({
      getSignaturesForAddress: async (_a, o) => (o.before === undefined ? list.map(s => ({signature: s, blockTime: null, err: null})) : []),
      getTransaction: async () => null,
    });
    await openActivity(reader);
    expect(await screen.findByRole('button', {name: 'Load more'})).toBeTruthy();
    expect(screen.queryByText('No activity yet')).toBeNull();
  });

  // Final review M3: a later good "Load more" clears the earlier one's error (and its banner).
  it('a failed [Load more] then a good one: the error banner goes, the rows are appended', async () => {
    const list = Array.from({length: 12}, (_, i) => sig(i + 1));
    const txs: Record<string, unknown> = {};
    for (const s of list) txs[s] = otherTx(ACCOUNT.publicKey, NOW - 300);
    let continued = 0;
    const reader = walletReader({
      getSignaturesForAddress: async (_a, o) => {
        if (o.before === undefined) return list.slice(0, 10).map(s => ({signature: s, blockTime: null, err: null}));
        continued += 1;
        if (continued === 1) throw new RequestUnreachable('u', 'x');
        return list.slice(10).map(s => ({signature: s, blockTime: null, err: null}));
      },
      getTransaction: async s => txs[s] ?? null,
    });
    await openActivity(reader);
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}));
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Load more'}));
    await waitFor(() => expect(document.querySelectorAll('button.tx-row')).toHaveLength(12));
    expect(screen.queryByText('Could not reach the Noctura server')).toBeNull();
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

  // Review fix round 1, #3: more()'s own report call needs a direct test, not just the visual pass —
  // a refused reply on [Load more] must reach the model (Home's refresh reacts too), the same as load()'s.
  it('a refused reply on [Load more] reports it too: Home\'s refresh disables from the same click', async () => {
    const list = Array.from({length: 10}, (_, i) => sig(i + 1));
    const txs: Record<string, unknown> = {};
    for (const s of list) txs[s] = otherTx(ACCOUNT.publicKey, NOW - 300);
    const reader = walletReader({
      getSignaturesForAddress: async (_a, o) => {
        if (o.before !== undefined) throw new RpcForbidden('getSignaturesForAddress');
        return list.map(s => ({signature: s, blockTime: null, err: null}));
      },
      getTransaction: async s => txs[s] ?? null,
    });
    await renderInWallet(
      <>
        <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
        <Activity {...nav} />
      </>,
      {reader},
    );
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}));
    await waitFor(() => expect(screen.getAllByRole('button', {name: 'Refresh'}).every(b => (b as HTMLButtonElement).disabled)).toBe(true));
  });

  // Review fix round 1, #4b: a mount while the model is already refused (a previous screen's 403)
  // must not spin the skeleton forever, and must not make a request of its own.
  it('mounted while already refused: no endless skeleton, and no request of its own', async () => {
    let historyReads = 0;
    const reader = walletReader({
      getBalance: async () => {
        throw new RpcForbidden('getBalance');
      },
      getSignaturesForAddress: async () => {
        historyReads += 1;
        return [];
      },
    });
    const w = await setupWallet({reader});
    const {rerender} = render(
      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
        <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
      </WalletProvider>,
    );
    await screen.findByText(REFUSED_TEXT);
    // Chose: nothing beyond the D26 banner (no skeleton, no #41 "No activity yet" copy — that would
    // be a claim about activity this screen never actually checked). Mirrors Home.tsx's own
    // cold-mount-while-refused fallback (dashes, never a skeleton or an invented claim).
    rerender(
      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
        <>
          <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
          <Activity {...nav} />
        </>
      </WalletProvider>,
    );
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getAllByText(REFUSED_TEXT)).toHaveLength(2);
    expect(historyReads).toBe(0);
  });

  // Review fix round 2, #1: a refused [Load more] left the model refused, then switching accounts
  // used to skip load() (still refused) without ever resetting `items`/`next`/`error` — so account
  // A's rows and A's cursor stayed on screen under account B. Load more would then ask
  // history(B, A's cursor) once clickable again, appending B's rows onto A's.
  it('a refused switch never leaves the old account\'s rows or cursor on screen under the new account', async () => {
    const listA = Array.from({length: 10}, (_, i) => sig(200 + i));
    const txsA: Record<string, unknown> = {};
    for (const s of listA) txsA[s] = otherTx(ACCOUNT.publicKey, NOW - 10);
    let historyForB = 0;
    const reader = walletReader({
      getSignaturesForAddress: async (address, o) => {
        if (address === ACCOUNT.publicKey) {
          if (o.before === undefined) return listA.map(s => ({signature: s, blockTime: null, err: null}));
          throw new RpcForbidden('getSignaturesForAddress'); // the "Load more" click that gets refused
        }
        historyForB += 1;
        return [];
      },
      getTransaction: async s => txsA[s] ?? null,
    });

    function SwitchTo1() {
      const m = useWallet();
      return (
        <button
          type="button"
          onClick={() =>
            void (async () => {
              await m.engine.select(1);
              await m.reload();
            })()
          }
        >
          switch
        </button>
      );
    }

    await renderInWallet(
      <>
        <Activity {...nav} />
        <SwitchTo1 />
      </>,
      {reader},
    );
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}));
    await screen.findByText(REFUSED_TEXT);
    fireEvent.click(screen.getByRole('button', {name: 'switch'}));
    // Account A's rows are gone, not merely hidden by a filter or a banner on top of them.
    await waitFor(() => expect(screen.queryByText('Other transaction')).toBeNull());
    // No cursor left to resume from: the button that would carry it is gone too.
    expect(screen.queryByRole('button', {name: 'Load more'})).toBeNull();
    // Never account B's own history at all while still refused — let alone one carrying A's cursor.
    expect(historyForB).toBe(0);
  });

  // Review fix round 1, #4c: a stale reply after the account changed must never land in the new
  // account's list. more() and load() share one request token for exactly this.
  //
  // background/history.ts serializes every page() through one mutex per popup session (shared by
  // every account, to pace getTransaction as one stream): the switched-to account's own load() is
  // *queued behind* the old account's still-hanging "Load more" and can only resolve after it, never
  // before. That ordering means a load() that SUCCEEDS after the stale reply would always overwrite
  // it anyway (a full replace) regardless of whether more()'s own guard fired — so this test makes
  // the new account's own read FAIL instead: nothing then overwrites items on its own, so only the
  // guard in more() stands between the stale reply and a corrupted list.
  it('a stale [Load more] reply after the account changed is dropped, even when the new account\'s own read then fails', async () => {
    const listA = Array.from({length: 10}, (_, i) => sig(100 + i));
    const txsA: Record<string, unknown> = {};
    for (const s of listA) txsA[s] = otherTx(ACCOUNT.publicKey, NOW - 10);
    let releaseA: (() => void) | undefined;
    const reader = walletReader({
      getSignaturesForAddress: async (address, o) => {
        if (address === ACCOUNT.publicKey) {
          if (o.before === undefined) return listA.map(s => ({signature: s, blockTime: null, err: null}));
          // The account we are about to switch away from: its "Load more" hangs until released.
          await new Promise<void>(r => {
            releaseA = r;
          });
          return listA.map(s => ({signature: s, blockTime: null, err: null}));
        }
        // The switched-to account's own read fails: nothing else will overwrite `items` afterwards.
        throw new RpcForbidden('getSignaturesForAddress');
      },
      getTransaction: async s => txsA[s] ?? null,
    });

    function SwitchTo1() {
      const m = useWallet();
      return (
        <>
          <div data-testid="current-account">{m.account?.publicKey}</div>
          <button
            type="button"
            onClick={() =>
              void (async () => {
                await m.engine.select(1);
                await m.reload();
              })()
            }
          >
            switch
          </button>
        </>
      );
    }

    await renderInWallet(
      <>
        <Activity {...nav} />
        <SwitchTo1 />
      </>,
      {reader},
    );
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}));
    await waitFor(() => expect(releaseA).toBeDefined());
    fireEvent.click(screen.getByRole('button', {name: 'switch'}));
    // The switch is fully committed — including the account-changed re-render that bumps Activity's
    // shared request token via its own fresh load() — before the stale reply below is allowed to
    // resolve. waitFor's act()-wrapped polling is what guarantees the effect it triggers has run.
    await waitFor(() => expect(screen.getByTestId('current-account').textContent).toBe(RECIPIENT));
    releaseA?.();
    // The switched-to account's own read failed: the D26 banner, not a corrupted list.
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    await new Promise(r => setTimeout(r, 20));
    // Never 20 (10 original + the stale reply's 10 more): the guard dropped the stale reply outright.
    expect(document.querySelectorAll('button.tx-row').length).toBeLessThanOrEqual(10);
  });

  // Review fix round 2, M4: load()'s OWN stale guard (as opposed to more()'s, above), observed the
  // same way — the account being left is the one whose read hangs, so its reply is the one that must
  // be dropped once the switched-to account's own (later) read fails and so never overwrites it.
  // Reversing this (the switched-to account hangs, the original one fails) would hit the same FIFO
  // mutex confound as #4c originally did: whichever read resolves LAST always wins the final render
  // if it succeeds, so only a failing "last" read isolates the EARLIER one's own guard.
  it('the load() stale guard: a reply for the account being left, released after the switch, is dropped even though the new account\'s own read then fails', async () => {
    const aSig = sig(700);
    let releaseA: (() => void) | undefined;
    const reader = walletReader({
      getSignaturesForAddress: async address => {
        if (address === ACCOUNT.publicKey) {
          // The initial mount load for the account being left: hangs until released.
          await new Promise<void>(r => {
            releaseA = r;
          });
          return [{signature: aSig, blockTime: null, err: null}];
        }
        throw new RpcForbidden('getSignaturesForAddress'); // the switched-to account's own read fails
      },
      getTransaction: async s => (s === aSig ? otherTx(ACCOUNT.publicKey, NOW) : null),
    });

    function SwitchTo1() {
      const m = useWallet();
      return (
        <>
          <div data-testid="current-account">{m.account?.publicKey}</div>
          <button
            type="button"
            onClick={() =>
              void (async () => {
                await m.engine.select(1);
                await m.reload();
              })()
            }
          >
            switch
          </button>
        </>
      );
    }

    await renderInWallet(
      <>
        <Activity {...nav} />
        <SwitchTo1 />
      </>,
      {reader},
    );
    // The very first (mount) load is the one that hangs: nothing has rendered A's row yet.
    await waitFor(() => expect(releaseA).toBeDefined());
    fireEvent.click(screen.getByRole('button', {name: 'switch'}));
    await waitFor(() => expect(screen.getByTestId('current-account').textContent).toBe(RECIPIENT));
    releaseA?.();
    // RECIPIENT's own read failed: the D26 banner, not A's row.
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('Other transaction')).toBeNull(); // A's stale reply never landed
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

// Task 16 (carried from Tasks 13 and 15): a good network read on Activity is a good read for the whole
// app — it moves #42 from unreachable to reconnecting exactly as Home's own successful refresh does.
// The model is read directly (not through Home, whose own reads could move it either way).
function NetProbe() {
  const m = useWallet();
  return (
    <>
      <div data-testid="net-mode">{m.net.mode}</div>
      <button type="button" onClick={() => m.report('unreachable')}>
        Drop the network
      </button>
    </>
  );
}

describe('#26 and the model: a successful read reports itself (m.reached)', () => {
  // Nothing but Activity's reads can succeed: every balance read (the provider's own refresh) is unreachable.
  const unreachableBalances = {
    getBalance: async (): Promise<bigint> => {
      throw new RequestUnreachable('u', 'x');
    },
  };

  it('the first page: unreachable → reconnecting', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>(r => {
      release = r;
    });
    const reader = walletReader({
      ...unreachableBalances,
      getSignaturesForAddress: async () => {
        await gate;
        return [];
      },
    });
    await renderInWallet(
      <>
        <NetProbe />
        <Activity {...nav} />
      </>,
      {reader},
    );
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('unreachable'));
    release();
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('reconnecting'));
  });

  it('[Load more]: unreachable → reconnecting', async () => {
    const list = Array.from({length: 10}, (_, i) => sig(i + 1));
    const reader = walletReader({
      ...unreachableBalances,
      getSignaturesForAddress: async (_a, o) => (o.before === undefined ? list.map(s => ({signature: s, blockTime: null, err: null})) : []),
      getTransaction: async () => otherTx(ACCOUNT.publicKey, NOW - 300),
    });
    await renderInWallet(
      <>
        <NetProbe />
        <Activity {...nav} />
      </>,
      {reader},
    );
    const more = await screen.findByRole('button', {name: 'Load more'});
    fireEvent.click(screen.getByRole('button', {name: 'Drop the network'}));
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('unreachable'));
    fireEvent.click(more);
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('reconnecting'));
  });

  // The model method itself, driven directly (a history read cannot succeed while refused: the
  // background's own 403 latch refuses it first, so a screen-level test here would prove nothing).
  it('reached(): unreachable → reconnecting → online after 1.5 s; refused stays refused', async () => {
    function Driver() {
      const m = useWallet();
      return (
        <>
          <div data-testid="mode">{m.net.mode}</div>
          <button type="button" onClick={() => m.report('unreachable')}>
            unreachable
          </button>
          <button type="button" onClick={() => m.report('coordinator-refused')}>
            refused
          </button>
          <button type="button" onClick={() => m.reached()}>
            reached
          </button>
        </>
      );
    }
    await renderInWallet(<Driver />, {reader: walletReader(unreachableBalances)});
    const mode = () => screen.getByTestId('mode').textContent;
    await waitFor(() => expect(mode()).toBe('unreachable'));
    fireEvent.click(screen.getByRole('button', {name: 'reached'}));
    expect(mode()).toBe('reconnecting');
    await waitFor(() => expect(mode()).toBe('online'), {timeout: 3_000});
    fireEvent.click(screen.getByRole('button', {name: 'refused'}));
    expect(mode()).toBe('refused');
    fireEvent.click(screen.getByRole('button', {name: 'reached'}));
    expect(mode()).toBe('refused');
  });
});

// Task 16 review, fix round 1 #1: a success never clears the 403 state — not even in the same batch
// as the refusal, when the ref the old code read had not caught up yet.
describe('the model: a success never ends the refused cool-down', () => {
  function Batch() {
    const m = useWallet();
    return (
      <>
        <div data-testid="mode">{m.net.mode}</div>
        <button
          type="button"
          onClick={() => {
            m.report('coordinator-refused');
            m.reached();
          }}
        >
          refused then reached
        </button>
        <button
          type="button"
          onClick={() => {
            m.reached();
            m.report('coordinator-refused');
          }}
        >
          reached then refused
        </button>
      </>
    );
  }
  const unreachable = walletReader({
    getBalance: async () => {
      throw new RequestUnreachable('u', 'x');
    },
  });

  it.each(['refused then reached', 'reached then refused'])('%s in one batch: refused, and still refused after the 1.5 s', async name => {
    await renderInWallet(<Batch />, {reader: unreachable});
    const mode = () => screen.getByTestId('mode').textContent;
    await waitFor(() => expect(mode()).toBe('unreachable'));
    fireEvent.click(screen.getByRole('button', {name}));
    expect(mode()).toBe('refused');
    await new Promise(r => setTimeout(r, 1_700));
    expect(mode()).toBe('refused');
  });

  // Review fix round 2: the timer's own callback is a guard. A refusal queued but not yet committed
  // when the 1.5 s fires — both inside one act(), before any render — must win: the cleanup cannot
  // cancel a timer for a state that has not been committed yet.
  it('a refusal queued in the same act as the 1.5 s timer firing: refused, never online', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const seen: {m: WalletModel | null} = {m: null};
      function Grab() {
        const m = useWallet();
        seen.m = m;
        return <div data-testid="mode">{m.net.mode}</div>;
      }
      await renderInWallet(<Grab />, {reader: unreachable});
      const mode = () => screen.getByTestId('mode').textContent;
      await waitFor(() => expect(mode()).toBe('unreachable'));
      act(() => seen.m?.reached());
      expect(mode()).toBe('reconnecting');
      act(() => {
        seen.m?.report('coordinator-refused');
        vi.advanceTimersByTime(RECONNECTED_MS);
      });
      expect(mode()).toBe('refused');
      act(() => {
        vi.advanceTimersByTime(RECONNECTED_MS * 2);
      });
      expect(mode()).toBe('refused');
    } finally {
      vi.useRealTimers();
    }
  });

  it('refused while reconnecting: the pending 1.5 s never turns it online', async () => {
    function Steps() {
      const m = useWallet();
      return (
        <>
          <div data-testid="mode">{m.net.mode}</div>
          <button type="button" onClick={() => m.reached()}>
            reached
          </button>
          <button type="button" onClick={() => m.report('coordinator-refused')}>
            refused
          </button>
        </>
      );
    }
    await renderInWallet(<Steps />, {reader: unreachable});
    const mode = () => screen.getByTestId('mode').textContent;
    await waitFor(() => expect(mode()).toBe('unreachable'));
    fireEvent.click(screen.getByRole('button', {name: 'reached'}));
    expect(mode()).toBe('reconnecting');
    fireEvent.click(screen.getByRole('button', {name: 'refused'}));
    expect(mode()).toBe('refused');
    await new Promise(r => setTimeout(r, 1_700));
    expect(mode()).toBe('refused');
  });
});
