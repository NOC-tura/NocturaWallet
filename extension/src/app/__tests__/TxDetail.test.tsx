// @vitest-environment happy-dom
import {render, screen, waitFor} from '@testing-library/react';
import {base58} from '@scure/base';
import {renderInWallet, walletReader} from './harness';
import {ExplorerLink, TxDetail} from '../screens/TxDetail';
import {explorerUrl} from '../explorer';
import type {HistoryItem} from '../engine';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {COUNTERPARTY, sentSol, sig} from '../../../e2e/historyFixtures';

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
