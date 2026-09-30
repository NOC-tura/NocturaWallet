// @vitest-environment happy-dom
import {render, screen, waitFor} from '@testing-library/react';
import {base58} from '@scure/base';
import {renderInWallet, setupWallet, walletReader} from './harness';
import {ExplorerLink, TxDetail} from '../screens/TxDetail';
import {explorerUrl} from '../explorer';
import {useWallet, WalletProvider} from '../WalletContext';
import {REFUSED_TEXT} from '../ui/Banner';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import type {Engine, HistoryItem} from '../engine';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {COUNTERPARTY, otherTx, sentSol, sig} from '../../../e2e/historyFixtures';

// Spec §6.3 (#27) and §6.5 (the one external link).
const NOW = Math.floor(Date.now() / 1000);
const item = (over: Partial<HistoryItem>): HistoryItem => ({
  signature: sig(1),
  blockTime: NOW,
  kind: 'sent',
  token: 'SOL',
  mint: null,
  amount: 2_480_000_000n,
  counterparty: RECIPIENT,
  feeLamports: 5_000n,
  failed: false,
  ...over,
});
const show = async (i: HistoryItem) => {
  const w = await renderInWallet(<TxDetail signature={i.signature} item={i} onBack={() => undefined} />);
  // The account is read by the provider's open sequence; its address then appears on the page.
  await waitFor(() => expect(document.body.textContent).toContain(ACCOUNT.publicKey));
  return w;
};

describe('#27 tx-detail', () => {
  it('a send: eyebrow, amount, fiat "now", Confirmed; From (name + full address), To (full, labelled), Hash, fee, date, Explorer', async () => {
    await show(item({}));
    expect(screen.getByText('SENT')).toBeTruthy();
    expect(screen.getByText('−2.4800 SOL')).toBeTruthy();
    expect(await screen.findByText('≈ $372.00 now')).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText('Transfer')).toBeTruthy();
    expect(screen.getByText('Your account: Savings')).toBeTruthy();
    // Full addresses in groups of four (AddressGroups): the groups join to the exact address.
    const groups = [...document.querySelectorAll('.addr-groups')].map(g => [...g.children].map(c => c.textContent).join(''));
    expect(groups).toEqual([ACCOUNT.publicKey, RECIPIENT, sig(1)]);
    expect(screen.getByText('0.000005 SOL')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Copy recipient'})).toBeTruthy();
    // Absent by decision: Block and Memo (G13), Save (B1b-2b), share (D19).
    for (const gone of ['Block', 'Memo', 'Save', 'Share']) expect(screen.queryByText(gone)).toBeNull();
    expect((screen.getByRole('link', {name: 'Explorer'}) as HTMLAnchorElement).getAttribute('href')).toBe(`https://solscan.io/tx/${sig(1)}`);
  });

  it('an SPL send reads "USDC transfer"', async () => {
    await show(item({token: 'USDC', amount: 12_000_000n}));
    expect(screen.getByText('USDC transfer')).toBeTruthy();
    expect(screen.getByText('−12.00 USDC')).toBeTruthy();
  });

  it('a receive: RECEIVED, +amount, To "Your wallet", fee paid by sender', async () => {
    await show(item({kind: 'received', token: 'USDC', amount: 250_000_000n, counterparty: COUNTERPARTY}));
    expect(screen.getByText('RECEIVED')).toBeTruthy();
    expect(screen.getByText('+250.00 USDC')).toBeTruthy();
    expect(screen.getByText('Your wallet')).toBeTruthy();
    expect(screen.getByText('Paid by sender')).toBeTruthy();
  });

  it('a failed transaction: the danger pill and banner, the fee charged; no Try again in plan 1', async () => {
    const w = renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} />);
    await w;
    expect(await screen.findByText('FAILED')).toBeTruthy();
    // No token is known for a failed row: a dash, never "— SOL" (review L3).
    expect(document.querySelector('.amount-card .amt')?.textContent).toBe('—');
    expect(screen.getByText('Fee charged')).toBeTruthy();
    expect(document.querySelector('.status-pill.fail')?.textContent).toBe('Failed');
    expect(screen.getByText('The transaction failed on chain. The network fee was charged; the amount did not move.')).toBeTruthy();
    expect(screen.getByText('Network fee charged')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('a presale purchase and an other: their eyebrows and the decoded fields that exist', async () => {
    renderInWallet(<TxDetail signature={sig(3)} item={item({signature: sig(3), kind: 'purchase', amount: 1_000_000_000n, counterparty: null})} onBack={() => undefined} />);
    expect(await screen.findByText('PRESALE PURCHASE')).toBeTruthy();
    expect(screen.getByText('−1.0000 SOL')).toBeTruthy();
  });

  it('reached by signature only: reads history pages until it finds it; not found in 3 pages → the not-yet line and the explorer link', async () => {
    const reader = walletReader({
      getSignaturesForAddress: async () => [{signature: sig(1), blockTime: NOW, err: null}],
      getTransaction: async () => sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW),
    });
    await renderInWallet(<TxDetail signature={sig(1)} onBack={() => undefined} />, {reader});
    expect(await screen.findByText('SENT')).toBeTruthy();
  });

  it('not in the recent history: the line, and still the explorer link', async () => {
    let pages = 0;
    const reader = walletReader({getSignaturesForAddress: async () => (pages++, [])});
    await renderInWallet(<TxDetail signature={sig(8)} onBack={() => undefined} />, {reader});
    expect(await screen.findByText('This transaction is not in the recent history yet.')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
    await waitFor(() => expect(pages).toBe(1));
  });

  // Review fix round 1, #3: a hardcoded 3 (never FIND_PAGES itself) — a mutation raising the cap
  // (e.g. to 50) must turn this red, which referencing the exported constant could never do.
  it('a 3-page cap: 3 full pages without the signature → exactly 3 requests, then not-found', async () => {
    let calls = 0;
    const reader = walletReader({
      getSignaturesForAddress: async () => {
        calls += 1;
        return Array.from({length: 10}, (_, i) => ({signature: sig(calls * 100 + i), blockTime: NOW, err: null}));
      },
      getTransaction: async () => otherTx(ACCOUNT.publicKey, NOW),
    });
    await renderInWallet(<TxDetail signature={sig(9999)} onBack={() => undefined} />, {reader});
    expect(await screen.findByText('This transaction is not in the recent history yet.')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
    expect(calls).toBe(3);
  });

  // Review fix round 2, M5: no wallet.history call is ever made with the account still unknown
  // (owner ''). A spy on the engine itself, not the reader: walletApi.ts's own `isAddress` check
  // would silently answer 'malformed' for an empty account without ever reaching the reader, so a
  // reader-level spy could not tell the two apart.
  it('never calls wallet.history before the account is known', async () => {
    const reader = walletReader({getSignaturesForAddress: async () => []});
    const w = await setupWallet({reader});
    const calls: string[] = [];
    const engine: Engine = {...w.engine, history: (account, before) => (calls.push(account), w.engine.history(account, before))};
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <TxDetail signature={sig(1)} onBack={() => undefined} />
      </WalletProvider>,
    );
    await screen.findByText('This transaction is not in the recent history yet.');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(a => a === ACCOUNT.publicKey)).toBe(true);
  });

  // Review fix round 2, M6: page 1 ends in an unindexed signature, so its real last signature (next)
  // differs from the last DECODED item's signature — page 2 must be asked for with `next`.
  it('pages on next, not the last decoded item, when page 1 ends in an unindexed signature', async () => {
    const list1 = Array.from({length: 10}, (_, i) => sig(300 + i));
    const txs: Record<string, unknown> = {};
    for (let i = 0; i < 9; i++) txs[list1[i] as string] = otherTx(ACCOUNT.publicKey, NOW - i);
    // list1[9] (the page's real last signature) has no getTransaction result: not indexed yet.
    const target = sig(999);
    txs[target] = sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW);
    const seenBefore: (string | undefined)[] = [];
    const reader = walletReader({
      getSignaturesForAddress: async (_a, o) => {
        seenBefore.push(o.before);
        if (o.before === undefined) return list1.map(s => ({signature: s, blockTime: NOW, err: null}));
        if (o.before === list1[9]) return [{signature: target, blockTime: NOW, err: null}];
        return [];
      },
      getTransaction: async s => txs[s] ?? null,
    });
    await renderInWallet(<TxDetail signature={target} onBack={() => undefined} />, {reader});
    expect(await screen.findByText('SENT')).toBeTruthy();
    expect(seenBefore).toEqual([undefined, list1[9]]);
  });
});

// Review fix round 2, #3: a searchError code that is neither 'unreachable' nor 'coordinator-refused'
// (only 'malformed' remains, from Engine.history's type — the client never sends a bad account or
// `before`, but the UI must not go blank if the coordinator ever answered one) gets a fixed line.
describe('#27 a malformed searchError', () => {
  it('shows a fixed line, not a bare screen, and keeps the explorer link', async () => {
    const w = await setupWallet();
    const engine: Engine = {...w.engine, history: async () => ({ok: false, error: 'malformed'})};
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <TxDetail signature={sig(1)} onBack={() => undefined} />
      </WalletProvider>,
    );
    expect(await screen.findByText('Could not read this transaction.')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
    expect(screen.queryByText('This transaction is not in the recent history yet.')).toBeNull();
  });
});

// A direct read of the shared model's net state — proves `m.report` was actually called (review M4),
// not just that #27's own local copy happened to say the same thing. Rendering Home alongside for
// this would risk a false pass: Home's OWN balance read could independently trip the same net mode
// (or, if it succeeds first, flip it back to "reconnecting"), making the assertion insensitive to
// whether #27 ever called report() at all.
function NetModeProbe() {
  const m = useWallet();
  return <div data-testid="net-mode">{m.net.mode}</div>;
}

// Review fix round 1, #2: a network failure while searching by signature is never shown as "not in
// the recent history" — that line is reserved for a real, answered, empty search (§7.2, §7.3).
describe('#27 network failure while searching', () => {
  it('unreachable: the #42 banner, no not-in-history line, the explorer link stays, reports it, and stops', async () => {
    let calls = 0;
    const reader = walletReader({
      getSignaturesForAddress: async () => {
        calls += 1;
        throw new RequestUnreachable('u', 'x');
      },
    });
    await renderInWallet(
      <>
        <NetModeProbe />
        <TxDetail signature={sig(1)} onBack={() => undefined} />
      </>,
      {reader},
    );
    expect(await screen.findByText('Could not reach the Noctura server')).toBeTruthy();
    expect(screen.queryByText('This transaction is not in the recent history yet.')).toBeNull();
    expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
    // Reported to the model (review M4): its shared net state changed, not just #27's own copy.
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('unreachable'));
    const seen = calls;
    await new Promise(r => setTimeout(r, 30));
    expect(calls).toBe(seen); // no further page was read once the search itself failed
  });

  it('refused: the D26 banner, no not-in-history line, the explorer link stays, reports it, and stops', async () => {
    let calls = 0;
    const reader = walletReader({
      getSignaturesForAddress: async () => {
        calls += 1;
        throw new RpcForbidden('getSignaturesForAddress');
      },
    });
    await renderInWallet(
      <>
        <NetModeProbe />
        <TxDetail signature={sig(1)} onBack={() => undefined} />
      </>,
      {reader},
    );
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect(screen.queryByText('This transaction is not in the recent history yet.')).toBeNull();
    expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('refused'));
    const seen = calls;
    await new Promise(r => setTimeout(r, 30));
    expect(calls).toBe(seen);
  });
});

describe('the explorer link (§6.5)', () => {
  it('Solscan, a new tab, no opener, no referrer — and only for a real signature', () => {
    render(<ExplorerLink signature={sig(9)} />);
    const a = screen.getByRole('link', {name: 'Explorer'}) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe(`https://solscan.io/tx/${sig(9)}`);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(explorerUrl('not-a-signature')).toBeNull();
    expect(explorerUrl(ACCOUNT.publicKey)).toBeNull(); // 32 bytes: an address, not a signature
    // In the signature's length range, but 48 bytes: not a signature either.
    const notASignature = base58.encode(new Uint8Array(48).fill(7));
    expect(notASignature.length).toBeGreaterThanOrEqual(64);
    expect(explorerUrl(notASignature)).toBeNull();
    expect(explorerUrl(`${sig(9)}?x=1`)).toBeNull();
  });
});

// Task 16 (carried from Tasks 13 and 15): #27's by-signature search that got an answer is a good read
// for the whole app — #42 moves from unreachable to reconnecting, as after Home's own refresh.
describe('#27 and the model: a successful search reports itself (m.reached)', () => {
  it('unreachable → reconnecting once the search is answered', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>(r => {
      release = r;
    });
    const reader = walletReader({
      getBalance: async () => {
        throw new RequestUnreachable('u', 'x');
      },
      getSignaturesForAddress: async () => {
        await gate;
        return [];
      },
    });
    await renderInWallet(
      <>
        <NetModeProbe />
        <TxDetail signature={sig(1)} onBack={() => undefined} />
      </>,
      {reader},
    );
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('unreachable'));
    release();
    expect(await screen.findByText('This transaction is not in the recent history yet.')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('reconnecting'));
  });
});
