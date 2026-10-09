// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {base58} from '@scure/base';
import {renderInWallet, setupWallet, walletReader, type WalletOptions} from './harness';
import {ExplorerLink, TxDetail} from '../screens/TxDetail';
import {explorerUrl} from '../explorer';
import {useWallet, WalletProvider} from '../WalletContext';
import {REFUSED_TEXT} from '../ui/Banner';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {decodeHistoryEntry} from '../../../../core/solana/history';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import type {Engine, HistoryItem} from '../engine';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {CONTACTS_KEY} from '../../background/contacts';
import {lock} from '../../background/autolock';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {COUNTERPARTY, otherTx, sentSol, sig} from '../../../e2e/historyFixtures';

// Spec §6.3 (#27) and §6.5 (the one external link).
const NOW = Math.floor(Date.now() / 1000);
const tryAgain = vi.fn();
afterEach(() => vi.clearAllMocks());
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
  const w = await renderInWallet(<TxDetail signature={i.signature} account={ACCOUNT.publicKey} item={i} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
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
    // The fee line as index.html 12136 draws it (Task 17 fix round 1, C8/C9): grouped, with its dollars.
    expect(await screen.findByText('0.000 005 SOL · $0.0007')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Copy recipient'})).toBeTruthy();
    // Absent by decision: Block and Memo (G13), share (D19). Plan 2: [Save] beside [Explorer] (27a).
    for (const gone of ['Block', 'Memo', 'Share']) expect(screen.queryByText(gone)).toBeNull();
    expect(await screen.findByRole('button', {name: 'Save'})).toBeTruthy();
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

  // Task 17 fix round 1 (C11): index.html 27c — the amount in --success, "Type · USDC transfer", "Your
  // wallet" in the accent, and the pill "Confirmed · 8h ago" (format.ts's ago, the injected clock).
  it('a receive as 27c draws it: success amount, the Type row, "Your wallet" in accent, "Confirmed · <age>"', async () => {
    const at = 1_780_000_000;
    await renderInWallet(<TxDetail signature={sig(2)} account={ACCOUNT.publicKey} item={item({signature: sig(2), blockTime: at, kind: 'received', token: 'USDC', amount: 250_000_000n, counterparty: COUNTERPARTY})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      now: () => (at + 8 * 3_600) * 1000,
    });
    await waitFor(() => expect(document.body.textContent).toContain(ACCOUNT.publicKey));
    const amt = document.querySelector('.amount-card .amt') as HTMLElement;
    expect(amt.textContent).toBe('+250.00 USDC');
    expect(amt.classList.contains('app-amt-in')).toBe(true);
    const typeRow = screen.getByText('Type').closest('.detail-row') as HTMLElement;
    expect(typeRow.querySelector('.val')?.textContent).toBe('USDC transfer');
    expect(screen.getByText('Your wallet').classList.contains('noc-accent')).toBe(true);
    expect(document.querySelector('.status-pill')?.textContent).toBe('Confirmed · 8 h ago');
  });

  it('a receive of SOL reads "Transfer"; with no block time the pill is plain "Confirmed"; a send\'s pill carries no age (27a)', async () => {
    await show(item({kind: 'received', token: 'SOL', blockTime: null, counterparty: COUNTERPARTY}));
    expect((screen.getByText('Type').closest('.detail-row') as HTMLElement).querySelector('.val')?.textContent).toBe('Transfer');
    expect(document.querySelector('.status-pill')?.textContent).toBe('Confirmed');
    expect(document.querySelector('.amount-card .amt')?.classList.contains('app-amt-in')).toBe(true);
  });

  it('a send: the pill is "Confirmed" alone and the amount is not tinted', async () => {
    await show(item({}));
    expect(document.querySelector('.status-pill')?.textContent).toBe('Confirmed');
    expect(document.querySelector('.amount-card .amt')?.classList.contains('app-amt-in')).toBe(false);
  });

  it('no price: the fee line reads "· —", never a made-up dollar value', async () => {
    await renderInWallet(<TxDetail signature={sig(1)} account={ACCOUNT.publicKey} item={item({})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      deps: {
        prices: async () => {
          throw new Error('down');
        },
      },
    });
    expect(await screen.findByText('0.000 005 SOL · —')).toBeTruthy();
  });

  // Task 17 fix round 1 (C10): index.html 12115 — each address line carries the design's inline
  // `.copy-btn` ("Copy", with the copy glyph), not an icon-only button; honest copy as useCopy.
  it('Copy is the design\'s copy-btn: the word "Copy", then "Copied" only when the clipboard took it', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async (v: string) => void writes.push(v)}});
    await show(item({}));
    const buttons = [...document.querySelectorAll('.detail-row .val button')] as HTMLElement[];
    expect(buttons.map(b => [b.className, b.textContent])).toEqual([
      ['copy-btn', 'Copy'],
      ['copy-btn', 'Copy'],
      ['copy-btn', 'Copy'],
    ]);
    fireEvent.click(screen.getByRole('button', {name: 'Copy recipient'}));
    await waitFor(() => expect(writes).toEqual([RECIPIENT]));
    expect(await screen.findByRole('button', {name: 'Copied'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Copied'}).textContent).toBe('Copied');
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async () => Promise.reject(new Error('denied'))}});
    fireEvent.click(screen.getByRole('button', {name: 'Copy sender'}));
    expect(await screen.findByRole('button', {name: 'Copy failed'})).toBeTruthy();
  });

  it('failed, as 27d: the eyebrow and card in danger, "Fee charged · $…", the grouped fee', async () => {
    await renderInWallet(<TxDetail signature={sig(5)} account={ACCOUNT.publicKey} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    expect(await screen.findByText('Fee charged · $0.0007')).toBeTruthy();
    expect(document.querySelector('.amount-card')?.classList.contains('app-failed')).toBe(true);
    expect(screen.getByText('0.000 005 SOL')).toBeTruthy();
  });

  it('a failed transaction that was not a send: "FAILED", a dash, the danger pill and banner, the fee charged; no Try again', async () => {
    const w = renderInWallet(<TxDetail signature={sig(5)} account={ACCOUNT.publicKey} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    await w;
    expect(await screen.findByText('FAILED')).toBeTruthy();
    // No token is known for a failed row: a dash, never "— SOL" (review L3).
    expect(document.querySelector('.amount-card .amt')?.textContent).toBe('—');
    expect(await screen.findByText('Fee charged · $0.0007')).toBeTruthy();
    expect(document.querySelector('.status-pill.fail')?.textContent).toBe('Failed');
    expect(screen.getByText('The transaction failed on chain. The network fee was charged; the amount did not move.')).toBeTruthy();
    expect(screen.getByText('Network fee charged')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
  });

  // Plan 3, owner question 1 (option A): the engine reads what a failed send tried to send.
  it('a failed send: "FAILED · SENT" and "— SOL", the danger pill and banner, the fee charged', async () => {
    await renderInWallet(<TxDetail signature={sig(5)} account={ACCOUNT.publicKey} item={item({signature: sig(5), amount: 1_000_000n, counterparty: COUNTERPARTY, failed: true})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    expect(await screen.findByText('FAILED · SENT')).toBeTruthy();
    expect(document.querySelector('.amount-card .amt')?.textContent).toBe('— SOL');
    expect(await screen.findByText('Fee charged · $0.0007')).toBeTruthy();
    expect(document.querySelector('.status-pill.fail')?.textContent).toBe('Failed');
    expect(screen.getByText('The transaction failed on chain. The network fee was charged; the amount did not move.')).toBeTruthy();
  });

  // Plan-3 review H1: a failed batch (two transfers) is not one send — decoded "other", it offers no [Try again].
  it('a failed transaction with two transfers from this account: "FAILED", a dash, and no [Try again]', async () => {
    const transfer = (destination: string, lamports: number) => ({program: 'system', programId: '11111111111111111111111111111111', parsed: {type: 'transfer', info: {source: ACCOUNT.publicKey, destination, lamports}}});
    const decoded = decodeHistoryEntry(ACCOUNT.publicKey, sig(6), {
      blockTime: NOW,
      meta: {err: {InstructionError: [0, {Custom: 1}]}, fee: 5000, preBalances: [3_000_000_000, 0, 0, 1], postBalances: [2_999_995_000, 0, 0, 1], preTokenBalances: [], postTokenBalances: []},
      transaction: {message: {accountKeys: [ACCOUNT.publicKey, COUNTERPARTY, RECIPIENT, MAINNET_FEE_TREASURY].map(k => ({pubkey: k, signer: false, writable: true})), instructions: [transfer(COUNTERPARTY, 1_000_000_000), transfer(RECIPIENT, 1_000_000_000)]}},
    });
    expect(decoded).toMatchObject({kind: 'other', failed: true});
    await renderInWallet(<TxDetail signature={sig(6)} account={ACCOUNT.publicKey} item={decoded} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    expect(await screen.findByText('FAILED')).toBeTruthy();
    expect(screen.queryByText('FAILED · SENT')).toBeNull();
    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
  });

  // Plan 3 (owner question 1, option A): [Try again] → #19 with what the failed send tried, when it is known.
  it('a failed send offers [Try again] with its intent — once per tap (rule 6, `disabled` lifted); none without a recipient or for another kind', async () => {
    await renderInWallet(<TxDetail signature={sig(5)} account={ACCOUNT.publicKey} item={item({signature: sig(5), amount: 1_000_000n, counterparty: COUNTERPARTY, failed: true})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    const again = (await screen.findByRole('button', {name: 'Try again'})) as HTMLButtonElement;
    fireEvent.click(again);
    again.disabled = false;
    fireEvent.click(again);
    expect(tryAgain).toHaveBeenCalledTimes(1);
    expect(tryAgain).toHaveBeenCalledWith({token: 'SOL', recipient: COUNTERPARTY, amount: 1_000_000n});
    cleanup();
    await renderInWallet(<TxDetail signature={sig(5)} account={ACCOUNT.publicKey} item={item({signature: sig(5), amount: 1_000_000n, counterparty: null, failed: true})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    await screen.findByText('FAILED · SENT');
    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
    cleanup();
    await renderInWallet(<TxDetail signature={sig(1)} account={ACCOUNT.publicKey} item={item({})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    await screen.findByText('SENT');
    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
  });

  // Fix round 1 #1: another account than the owner selected (canRetry false) — no [Try again].
  it('a failed send while another account is selected: no [Try again]', async () => {
    await renderInWallet(<TxDetail signature={sig(5)} account={ACCOUNT.publicKey} item={item({signature: sig(5), amount: 1_000_000n, counterparty: COUNTERPARTY, failed: true})} canRetry={false} onBack={() => undefined} onTryAgain={tryAgain} />);
    await screen.findByText('FAILED · SENT');
    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
  });

  // Fix round 1 #2 (D26): in the 403 cool-down [Try again] is disabled — a click, `disabled` lifted, still proposes nothing.
  it('a failed send in the 403 cool-down: [Try again] is disabled', async () => {
    // Another screen's read was refused: the model's shared net state is the D26 cool-down.
    function Refuse() {
      const m = useWallet();
      return (
        <button type="button" onClick={() => m.report('coordinator-refused')}>
          refuse
        </button>
      );
    }
    await renderInWallet(
      <>
        <Refuse />
        <TxDetail signature={sig(5)} account={ACCOUNT.publicKey} item={item({signature: sig(5), amount: 1_000_000n, counterparty: COUNTERPARTY, failed: true})} canRetry onBack={() => undefined} onTryAgain={tryAgain} />
      </>,
    );
    const again = (await screen.findByRole('button', {name: 'Try again'})) as HTMLButtonElement;
    expect(again.disabled).toBe(false);
    expect(screen.queryByText(REFUSED_TEXT)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'refuse'}));
    await waitFor(() => expect(again.disabled).toBe(true));
    // Final whole-branch review M2 (carry c): §7.2 — the D26 banner says why it is disabled.
    expect(screen.getByText(REFUSED_TEXT)).toBeTruthy();
    again.disabled = false;
    fireEvent.click(again);
    expect(tryAgain).not.toHaveBeenCalled();
  });

  // Task 14 carry: only a `sent` decode proposes a send — a failed row of another kind with every field known does not.
  it('a failed receive with a token, a counterparty and an amount: no [Try again]', async () => {
    await renderInWallet(<TxDetail signature={sig(5)} account={ACCOUNT.publicKey} item={item({signature: sig(5), kind: 'received', token: 'USDC', amount: 250_000_000n, counterparty: COUNTERPARTY, failed: true})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    await screen.findByText('Fee charged · $0.0007');
    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
  });

  it('a presale purchase and an other: their eyebrows and the decoded fields that exist', async () => {
    renderInWallet(<TxDetail signature={sig(3)} account={ACCOUNT.publicKey} item={item({signature: sig(3), kind: 'purchase', amount: 1_000_000_000n, counterparty: null})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
    expect(await screen.findByText('PRESALE PURCHASE')).toBeTruthy();
    expect(screen.getByText('−1.0000 SOL')).toBeTruthy();
    // Fix round 2 (#3): the purchase's fee line carries its dollars too (12136's form).
    expect(await screen.findByText('0.000 005 SOL · $0.0007')).toBeTruthy();
  });

  it('reached by signature only: reads history pages until it finds it; not found in 3 pages → the not-yet line and the explorer link', async () => {
    const reader = walletReader({
      getSignaturesForAddress: async () => [{signature: sig(1), blockTime: NOW, err: null}],
      getTransaction: async () => sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW),
    });
    await renderInWallet(<TxDetail signature={sig(1)} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {reader});
    expect(await screen.findByText('SENT')).toBeTruthy();
  });

  it('not in the recent history: the line, and still the explorer link', async () => {
    let pages = 0;
    const reader = walletReader({getSignaturesForAddress: async () => (pages++, [])});
    await renderInWallet(<TxDetail signature={sig(8)} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {reader});
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
    await renderInWallet(<TxDetail signature={sig(9999)} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {reader});
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
        <TxDetail signature={sig(1)} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />
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
    await renderInWallet(<TxDetail signature={target} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {reader});
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
        <TxDetail signature={sig(1)} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />
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
        <TxDetail signature={sig(1)} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />
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
        <TxDetail signature={sig(1)} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />
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
        <TxDetail signature={sig(1)} account={ACCOUNT.publicKey} onBack={() => undefined} canRetry onTryAgain={tryAgain} />
      </>,
      {reader},
    );
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('unreachable'));
    release();
    expect(await screen.findByText('This transaction is not in the recent history yet.')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('net-mode').textContent).toBe('reconnecting'));
  });
});

// B1b-2b plan 2 (§6.3; review H3): #27's [Save] / [Save sender] and the contact label.
describe('#27 and the address book', () => {
  const SELECTORS = selectorsOf(UI_SHEETS);
  const showWith = async (i: HistoryItem, before?: WalletOptions['before']) => {
    const w = await renderInWallet(<TxDetail signature={i.signature} account={ACCOUNT.publicKey} item={i} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {before});
    await screen.findByText('Transaction');
    return w;
  };
  const actions = () => [...document.querySelectorAll('.actions-row > *')].map(e => e.textContent);
  const sendTo = item({counterparty: COUNTERPARTY});
  const receivedFrom = (over: Partial<HistoryItem> = {}) => item({kind: 'received', token: 'USDC', amount: 250_000_000n, counterparty: COUNTERPARTY, ...over});

  it('27a: [Explorer] then [Save] (the bookmark icon); Save opens the add sheet prefilled with the recipient', async () => {
    await showWith(sendTo);
    await screen.findByRole('button', {name: 'Save'});
    expect(actions()).toEqual(['Explorer', 'Save']);
    expect(screen.getByRole('button', {name: 'Save'}).className).toBe('btn btn-secondary');
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    expect([...dialog.querySelectorAll('.app-contact-addr .addr-groups > span')].map(x => x.textContent)).toEqual(COUNTERPARTY.match(/.{1,4}/g));
    expect(unstyledClasses(document.querySelector('.s-txd')!, SELECTORS)).toEqual([]);
  });

  // Rule 6 (spec §7): #27's Save is a LockedButton — the lock is what is pinned (a second open looks the same).
  it('rule 6: Save locks on the tap', async () => {
    await showWith(sendTo);
    const save = (await screen.findByRole('button', {name: 'Save'})) as HTMLButtonElement;
    fireEvent.click(save);
    expect(save.disabled).toBe(true);
    expect(save.className).toBe('btn btn-secondary is-busy');
  });

  // The alive guard after the book read: a late `locked` must not reload after #27 went.
  it('a book answer after #27 went does nothing: a late `locked` reloads nothing', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    let gone = false;
    let lists = 0;
    const after: string[] = [];
    let ext: Parameters<typeof lock>[0] | null = null;
    await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      before: async e => {
        ext = e;
      },
      gate: async m => {
        const type = (m as {type: string}).type;
        if (gone) after.push(type);
        if (type === 'contacts.list') {
          lists += 1;
          await held;
        }
      },
    });
    await screen.findByText('Transaction');
    // Fix round 1 (I1): the provider's open sequence selects the account (null → A), which re-reads the book. Wait for
    // that read, so it is held with the first — never sent during the unmount, after "gone".
    await waitFor(() => expect(lists).toBe(2));
    await lock(ext!);
    gone = true;
    cleanup();
    release();
    await act(async () => new Promise(r => setTimeout(r, 30)));
    // What the guard stops is the reload: a `wallet.state` read (its positive control is below).
    expect(after).toEqual([]);
  });

  it('saved: the To label reads "From your address book: <name>", and Save opens the edit sheet', async () => {
    const w = await showWith(sendTo);
    fireEvent.click(await screen.findByRole('button', {name: 'Save'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Supplier'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    expect(await screen.findByText('From your address book: Supplier')).toBeTruthy();
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: COUNTERPARTY, name: 'Supplier'}]);
    // Its 500 ms lock (rule 6) ends first.
    const save = screen.getByRole('button', {name: 'Save'}) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    const edit = await screen.findByRole('dialog', {name: 'Edit contact'});
    expect((edit.querySelector('#contact-name') as HTMLInputElement).value).toBe('Supplier');
  });

  it('27c: [Save sender]; a sender never sent to → O77, no dust banner for 250 USDC; the From label once saved', async () => {
    await showWith(receivedFrom());
    fireEvent.click(await screen.findByRole('button', {name: 'Save sender'}));
    expect(await screen.findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
    expect(document.querySelector('.banner.danger')).toBeNull();
    fireEvent.change(document.getElementById('contact-name')!, {target: {value: 'Client'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    const from = (await screen.findByText('From your address book: Client')).closest('.detail-row');
    expect(from?.querySelector('.lbl')?.textContent).toBe('From');
  });

  it.each([
    ['0.009999 USDC', {token: 'USDC' as const, amount: 9_999n}],
    ['0.000999999 SOL', {token: 'SOL' as const, amount: 999_999n}],
    ['an undecodable amount', {amount: null}],
  ])('27c dust (%s): the danger banner, O77 and "Save anyway"', async (_, over) => {
    await showWith(receivedFrom(over));
    fireEvent.click(await screen.findByRole('button', {name: 'Save sender'}));
    await screen.findByRole('dialog', {name: 'Add contact'});
    expect(document.querySelector('.banner.danger')?.textContent).toBe('Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.');
    expect(await screen.findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Save anyway'})).toBeTruthy();
  });

  it('27c from a sender this wallet has paid: no warning', async () => {
    await showWith(receivedFrom({amount: 1n}), ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: COUNTERPARTY, at: 1}]));
    fireEvent.click(await screen.findByRole('button', {name: 'Save sender'}));
    await screen.findByRole('dialog', {name: 'Add contact'});
    await waitFor(() => expect(screen.queryByText(/You have never sent/)).toBeNull());
    expect(document.querySelector('.banner.danger')).toBeNull();
  });

  it('no button on a purchase, an other, a failed transaction, or a row with no counter-party', async () => {
    for (const i of [item({kind: 'purchase', counterparty: null}), item({kind: 'other', counterparty: COUNTERPARTY}), item({failed: true, counterparty: COUNTERPARTY}), item({counterparty: null})]) {
      cleanup();
      await showWith(i);
      await act(async () => new Promise(r => setTimeout(r, 20)));
      expect(screen.queryByRole('button', {name: /^Save/})).toBeNull();
    }
  });

  it('the book unread (refused): no Save button, no contact label', async () => {
    await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Supplier'}]),
      gate: m => {
        if ((m as {type: string}).type === 'contacts.list') throw new Error('worker restarting');
      },
    });
    await waitFor(() => expect(document.body.textContent).toContain(ACCOUNT.publicKey));
    await act(async () => new Promise(r => setTimeout(r, 20)));
    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
    expect(screen.queryByText(/From your address book/)).toBeNull();
  });

  it('own > contact: an own account saved as a contact keeps "Your account: Savings"', async () => {
    await showWith(item({}), ext => ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Not my savings'}]));
    await screen.findByRole('button', {name: 'Save'});
    expect(screen.getByText('Your account: Savings')).toBeTruthy();
    expect(screen.queryByText(/From your address book/)).toBeNull();
  });

  // Task 8 (D36): a SENT row the extension never confirmed — the history never feeds `known` — keeps O72, fail closed,
  // and is not the received wording (no O77, no dust banner).
  it('27a for a recipient this extension never paid: O72, not O77, no dust banner', async () => {
    await showWith(sendTo);
    fireEvent.click(await screen.findByRole('button', {name: 'Save'}));
    await screen.findByRole('dialog', {name: 'Add contact'});
    expect(await screen.findByText('You have never sent to this address.')).toBeTruthy();
    expect(screen.queryByText(/it only sent to you/)).toBeNull();
    expect(document.querySelector('.banner.danger')).toBeNull();
    expect(within(screen.getByRole('dialog', {name: 'Add contact'})).getByRole('button', {name: 'Save'})).toBeTruthy();
  });

  // The threat model (address poisoning, §6.3, review H3): the user has paid PAID; a look-alike — the same first four and
  // last four characters — sends dust. [Save sender] warns (O77, the dust banner, "Save anyway"), saving it is allowed,
  // and the save never makes it known: the stored known list is unchanged, the engine still says `known: false`, and the
  // edit sheet re-opened from #27 warns exactly as before.
  it('poisoning: [Save sender] on dust from a look-alike of a paid address warns, and saving never makes it known', async () => {
    const LOOKALIKE: string = 'H4qZ7Lp2Wc9tKqRbV3mXnYdE8sFgUhJk2PzT6vB4m2N1';
    expect([LOOKALIKE.slice(0, 4), LOOKALIKE.slice(-4), LOOKALIKE === COUNTERPARTY]).toEqual([COUNTERPARTY.slice(0, 4), COUNTERPARTY.slice(-4), false]);
    const KNOWN = [{address: COUNTERPARTY, at: 1}];
    const w = await showWith(receivedFrom({counterparty: LOOKALIKE, token: 'SOL', amount: 1_000n}), ext => ext.local.set(KNOWN_RECIPIENTS_KEY, KNOWN));
    const warned = async (title: string) => {
      const dialog = await screen.findByRole('dialog', {name: title});
      expect([...dialog.querySelectorAll('.app-contact-addr .addr-groups > span')].map(x => x.textContent).join('')).toBe(LOOKALIKE);
      expect(await within(dialog).findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
      expect(dialog.querySelector('.banner.danger')?.textContent).toBe('Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.');
      return dialog;
    };
    fireEvent.click(await screen.findByRole('button', {name: 'Save sender'}));
    const dialog = await warned('Add contact');
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Binance'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save anyway'}));
    const label = await screen.findByText('From your address book: Binance');
    expect(label.closest('.detail-row')?.querySelector('.lbl')?.textContent).toBe('From');
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: LOOKALIKE, name: 'Binance'}]);
    // Never known: the list the background writes is untouched, and its own answer is still "never sent".
    expect(await w.ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual(KNOWN);
    const info = await w.engine.recipientInfo(ACCOUNT.publicKey, LOOKALIKE);
    expect(info.ok && info.data.known).toBe(false);
    // Re-opened (now the edit sheet), it warns as before.
    const again = screen.getByRole('button', {name: 'Save sender'}) as HTMLButtonElement;
    await waitFor(() => expect(again.disabled).toBe(false));
    fireEvent.click(again);
    const edit = await warned('Edit contact');
    expect((edit.querySelector('#contact-name') as HTMLInputElement).value).toBe('Binance');
    expect(within(edit).getByRole('button', {name: 'Save anyway'})).toBeTruthy();
  });

  // D35: the received From row carries the full label — own > treasury > contact, as the sent To row.
  it.each([
    ['own', RECIPIENT, 'Your account: Savings'],
    ['treasury', MAINNET_FEE_TREASURY, 'Noctura treasury'],
  ])('the received From row: %s > contact', async (_, from, label) => {
    await showWith(receivedFrom({counterparty: from}), ext => ext.local.set(CONTACTS_KEY, [{address: from, name: 'A contact'}]));
    await screen.findByRole('button', {name: 'Save sender'});
    expect(screen.getByText(label).closest('.detail-row')?.querySelector('.lbl')?.textContent).toBe('From');
    expect(screen.queryByText(/From your address book/)).toBeNull();
  });

  it('treasury > contact on the sent To row', async () => {
    await showWith(item({counterparty: MAINNET_FEE_TREASURY}), ext => ext.local.set(CONTACTS_KEY, [{address: MAINNET_FEE_TREASURY, name: 'Not the treasury'}]));
    await screen.findByRole('button', {name: 'Save'});
    expect(screen.getByText('Noctura treasury').closest('.detail-row')?.querySelector('.lbl')?.textContent).toBe('To');
    expect(screen.queryByText(/From your address book/)).toBeNull();
  });

  // Task 7 fix round 1 (I1), carried: every close re-reads the book, and no Save is offered until that read answers. A
  // contact saved elsewhere while the sheet was open is an edit, never a second "add" that would silently rename it.
  it('a sheet close re-reads the book: no Save until it answers, then Save opens the edit sheet for an address saved meanwhile', async () => {
    // The first book read once the sheet is open (the close's re-read) is held.
    let armed = false;
    let lists = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    let ext: Parameters<typeof lock>[0] | null = null;
    await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      before: async e => {
        ext = e;
      },
      gate: async m => {
        if ((m as {type: string}).type !== 'contacts.list' || !armed) return;
        if (++lists === 1) await held;
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: 'Save'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    armed = true;
    // Saved elsewhere (another window) while this sheet is open.
    await ext!.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Supplier'}]);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => new Promise(r => setTimeout(r, 30)));
    expect(lists).toBe(1);
    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
    release();
    expect(await screen.findByText('From your address book: Supplier')).toBeTruthy();
    const save = screen.getByRole('button', {name: 'Save'}) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    expect(await screen.findByRole('dialog', {name: 'Edit contact'})).toBeTruthy();
  });

  it('Delete from #27\'s edit sheet: the label goes, and Save opens the add sheet again', async () => {
    await showWith(sendTo, ext => ext.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Supplier'}]));
    expect(await screen.findByText('From your address book: Supplier')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    const edit = await screen.findByRole('dialog', {name: 'Edit contact'});
    fireEvent.click(within(edit).getByRole('button', {name: 'Delete contact'}));
    fireEvent.click(await screen.findByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.queryByText(/From your address book/)).toBeNull());
    const save = (await screen.findByRole('button', {name: 'Save'})) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    expect(await screen.findByRole('dialog', {name: 'Add contact'})).toBeTruthy();
  });

  // The positive control for the late-`locked` test above: while #27 is shown, a `locked` book answer reloads (a
  // wallet.state read) — so that test's empty list is the guard, not a silent path.
  it('a timely `locked` on the book read reloads (a wallet.state read)', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    const sent: string[] = [];
    let ext: Parameters<typeof lock>[0] | null = null;
    await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      before: async e => {
        ext = e;
      },
      gate: async m => {
        const type = (m as {type: string}).type;
        sent.push(type);
        if (type === 'contacts.list') await held;
      },
    });
    await screen.findByText('Transaction');
    await lock(ext!);
    await act(async () => new Promise(r => setTimeout(r, 20)));
    const before = sent.filter(t => t === 'wallet.state').length;
    release();
    await waitFor(() => expect(sent.filter(t => t === 'wallet.state').length).toBeGreaterThan(before));
  });

  // #27 stays when another account is selected (it shows the route owner's transaction): a book answer asked for before
  // the switch is dropped — the switch reads the book afresh, and only that answer offers Save. The read out at the
  // switch is a sheet close's re-read, so Save is hidden (stale) until an answer is taken.
  it('another account selected while the book read is out: the old answer is dropped, the fresh read answers', async () => {
    let armed = false;
    let lists = 0;
    let releaseOld: () => void = () => undefined;
    let releaseNew: () => void = () => undefined;
    const old = new Promise<void>(r => {
      releaseOld = r;
    });
    const fresh = new Promise<void>(r => {
      releaseNew = r;
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
        <TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />
        <SwitchTo1 />
      </>,
      {
        gate: async m => {
          if ((m as {type: string}).type !== 'contacts.list' || !armed) return;
          lists += 1;
          await (lists === 1 ? old : fresh);
        },
      },
    );
    fireEvent.click(await screen.findByRole('button', {name: 'Save'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    armed = true;
    fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(lists).toBe(1));
    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'switch'}));
    await waitFor(() => expect(lists).toBe(2));
    releaseOld();
    await act(async () => new Promise(r => setTimeout(r, 30)));
    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
    releaseNew();
    expect(await screen.findByRole('button', {name: 'Save'})).toBeTruthy();
  });

  // Fix round 1, I2 (reviewer P1): the label and the edit sheet need the exact address — case-sensitive, every character.
  // A look-alike (same first four and last four) and a case variant of a saved address are strangers: no O88, and
  // [Save sender] opens "Add contact", never the saved contact's edit sheet.
  it.each([
    ['a first-4/last-4 look-alike', 'H4qZ7Lp2Wc9tKqRbV3mXnYdE8sFgUhJk2PzT6vB4m2N1'],
    ['a case variant', 'H4qZoWSV5iyeysmHzYnVfqVBtSfoJTZQJ33YtjAXm2N1'],
  ])('exact address: %s of a saved contact gets no label, and [Save sender] opens Add', async (_, other) => {
    expect([other.slice(0, 4), other.slice(-4), other === COUNTERPARTY]).toEqual([COUNTERPARTY.slice(0, 4), COUNTERPARTY.slice(-4), false]);
    await showWith(receivedFrom({counterparty: other}), ext => ext.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Binance'}]));
    fireEvent.click(await screen.findByRole('button', {name: 'Save sender'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    expect((dialog.querySelector('#contact-name') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/From your address book/)).toBeNull();
  });

  // Fix round 1, I3 (reviewer P2): after a save the book is re-read; until it answers there is no Save — also once the
  // tap's 500 ms lock is over, when an "add" sheet from the old book would rename the contact just saved.
  it('after a save, no Save until the re-read answers — past the 500 ms lock', async () => {
    let armed = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      gate: async m => {
        if ((m as {type: string}).type === 'contacts.list' && armed) await held;
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: 'Save'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Supplier'}});
    armed = true;
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => new Promise(r => setTimeout(r, 700)));
    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
    release();
    expect(await screen.findByText('From your address book: Supplier')).toBeTruthy();
    const save = screen.getByRole('button', {name: 'Save'}) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    expect(await screen.findByRole('dialog', {name: 'Edit contact'})).toBeTruthy();
  });

  // Fix round 1, m1 (reviewer P3): only the latest book read is taken. The switch's read took the book before the save
  // and answers after the post-save read: the book stays the post-save one (label kept, Save opens the edit sheet).
  it('the latest read wins: an earlier read answering last with the pre-save book changes nothing', async () => {
    let hold = false;
    let reached = false;
    let release: () => void = () => undefined;
    const old = new Promise<void>(r => {
      release = r;
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
        <TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />
        <SwitchTo1 />
      </>,
      {
        // The background's read of the book: the held one has read it (the old book) and answers when released.
        before: async ext => {
          const get = ext.local.get.bind(ext.local);
          ext.local.get = async (k: string) => {
            const v = await get(k);
            if (k === CONTACTS_KEY && hold) {
              hold = false;
              reached = true;
              await old;
            }
            return v;
          };
        },
      },
    );
    fireEvent.click(await screen.findByRole('button', {name: 'Save'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    hold = true;
    fireEvent.click(screen.getByRole('button', {name: 'switch'}));
    await waitFor(() => expect(reached).toBe(true));
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Supplier'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    expect(await screen.findByText('From your address book: Supplier')).toBeTruthy();
    release();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(screen.getByText('From your address book: Supplier')).toBeTruthy();
    const save = screen.getByRole('button', {name: 'Save'}) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    expect(await screen.findByRole('dialog', {name: 'Edit contact'})).toBeTruthy();
  });

  // Fix round 1, m2 (reviewer P4): no contact label while the book is stale — a delete whose re-read fails does not keep
  // showing the deleted contact's name from the old book.
  it('a delete whose re-read fails: the contact label is gone (and Save with it)', async () => {
    let fail = false;
    await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={sendTo} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: COUNTERPARTY, name: 'Supplier'}]),
      gate: m => {
        if ((m as {type: string}).type === 'contacts.list' && fail) throw new Error('worker restarting');
      },
    });
    expect(await screen.findByText('From your address book: Supplier')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    const edit = await screen.findByRole('dialog', {name: 'Edit contact'});
    fireEvent.click(within(edit).getByRole('button', {name: 'Delete contact'}));
    fail = true;
    fireEvent.click(await screen.findByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => new Promise(r => setTimeout(r, 30)));
    expect(screen.queryByText(/From your address book/)).toBeNull();
    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
  });

  it('own and treasury labels need no book: they stay while it is stale', async () => {
    let armed = false;
    await renderInWallet(<TxDetail signature={sendTo.signature} account={ACCOUNT.publicKey} item={item({counterparty: MAINNET_FEE_TREASURY})} onBack={() => undefined} canRetry onTryAgain={tryAgain} />, {
      gate: async m => {
        if ((m as {type: string}).type === 'contacts.list' && armed) await new Promise<void>(() => undefined);
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: 'Save'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    armed = true;
    fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
    expect(screen.getByText('Noctura treasury')).toBeTruthy();
  });
});
