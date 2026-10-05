// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {renderInWallet, walletReader, type WalletOptions} from './harness';
import {FAILED_TEXT, Failed, failedKind} from '../screens/Failed';
import {CANCELLED_MS, CANCELLED_TEXT, CancelledToast} from '../ui/CancelledToast';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {REFUSED_TEXT} from '../ui/Banner';
import {RpcForbidden} from '../../../../core/solana/rpc';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {sig} from '../../../e2e/historyFixtures';
import type {Pending} from '../engine';

// Spec §4.7 (#44): the state from `failure` (E8, C3), `detail` only the caption.
const SELECTORS = selectorsOf(UI_SHEETS);
// The spec's exact strings (§4.7), as literals: a wrong FAILED_TEXT constant must not pass by being compared with itself.
const SPEC = {
  expiredHead: 'Recent blockhash expired',
  expiredSub: 'Not confirmed — no funds moved.',
  expiredWhy: 'Solana rotated past the blockhash before your transaction reached a leader. Tap retry — the wallet will fetch a fresh one.',
  expiredFoot: 'No fees were charged. Retry is a fresh transaction with a new blockhash — same recipient, same amount.',
  rejectedHead: 'Program rejected the transaction',
  rejectedSub: 'The on-chain program returned an error. The network fee was charged; the amount did not move.',
  notSentHead: "Couldn't send",
  // index.html #s44 network-error's hero sub, its second sentence verbatim (Task 17 fix round 1, C4).
  notSentSub: 'Funds are unchanged — the request never reached a leader.',
  genericHead: 'Transaction failed',
};
const caption = () => document.querySelector('.scroll-area > .noc-caption')?.textContent ?? null;
const nav = {onTryAgain: vi.fn(), onEdit: vi.fn(), onDetails: vi.fn()};
const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: 2_480_000_000n};
const record = (over: Partial<Pending>): Pending => ({
  id: 'r1',
  account: ACCOUNT.publicKey,
  signature: sig(7),
  lastValidBlockHeight: 1150,
  createdAt: 1,
  lastSentAt: 1,
  state: 'failed',
  detail: null,
  intent: INTENT,
  expiryNullSeenAt: null,
  failure: null,
  detailCode: null,
  fee: {networkLamports: 5_050n, markupLamports: 20_000n},
  ...over,
});
const renderFailed = (p: Pending, o: WalletOptions = {}) => renderInWallet(<Failed record={p} {...nav} />, o);
const text = () => [document.querySelector('.s9-fail-hero .head')?.textContent, document.querySelector('.s9-fail-hero .sub')?.textContent ?? null, document.querySelector('.s9-reason-banner .label')?.textContent ?? null];

afterEach(() => vi.clearAllMocks());

describe('#44 tx-failed', () => {
  it('blockhash-expired (engine `expired`): the hero, the reason, the payload kept, the footer; [Try again] and [Edit transaction]', async () => {
    await renderFailed(record({state: 'expired', detail: 'Not confirmed — no funds moved.'}));
    expect(await screen.findByText(SPEC.expiredHead)).toBeTruthy();
    expect(text()).toEqual([SPEC.expiredHead, SPEC.expiredSub, 'Reason · blockhash-expired']);
    expect(document.querySelector('.s9-reason-banner .body')?.textContent).toBe(SPEC.expiredWhy);
    expect(screen.getByText(FAILED_TEXT.payload)).toBeTruthy();
    const rows = [...document.querySelectorAll('.s9-payload-card .row')].map(r => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
    expect(rows).toEqual([
      ['To', RECIPIENT],
      ['Amount', '2.4800 SOL'],
      ['Valid until block', '1150'],
    ]);
    expect(caption()).toBe(SPEC.expiredFoot);
    expect(document.querySelector('.top-bar .step')?.textContent).toBe('Failed');
    expect(screen.getByRole('button', {name: FAILED_TEXT.tryAgain})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.edit}));
    expect(nav.onEdit).toHaveBeenCalledWith({token: 'SOL', recipient: RECIPIENT, amount: '2.48'});
    // Removed by decision: insufficient-fee (D15), the slippage content, the RPC picker.
    expect(document.body.textContent).not.toMatch(/higher priority|slippage|Switch RPC|Built at/);
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('rejected-by-program (failed, landed): "Rejected", the fee-charged sentence, the engine detail in mono; [Try again], [View details] → #27, [View on explorer]', async () => {
    const detail = 'Landed but failed ({"InstructionError":[2,{"Custom":1}]}): the network fee was paid, nothing was sent.';
    await renderFailed(record({failure: 'landed', detail}));
    expect(await screen.findByText(SPEC.rejectedHead)).toBeTruthy();
    expect(text()).toEqual([SPEC.rejectedHead, SPEC.rejectedSub, 'Reason · rejected-by-program']);
    expect(caption()).toBeNull();
    expect(document.querySelector('.s9-reason-banner .meta')?.textContent).toBe(detail);
    expect(document.querySelector('.top-bar .step')?.textContent).toBe('Rejected');
    const link = screen.getByRole('link', {name: FAILED_TEXT.explorer}) as HTMLAnchorElement;
    expect([link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]).toEqual([`https://solscan.io/tx/${sig(7)}`, '_blank', 'noopener noreferrer']);
    // 44c: the explorer link is the reason banner's own `.explorer` link, after its meta line; the bar holds two CTAs
    // (§1.4: no bar stacks three) — Task 17 fix round 2.
    expect(link.closest('.s9-reason-banner')).not.toBeNull();
    expect(link.className).toBe('explorer');
    expect(link.previousElementSibling?.className).toBe('meta');
    expect([...document.querySelectorAll('.sticky-bar > *')].map(b => b.textContent)).toEqual([FAILED_TEXT.tryAgain, FAILED_TEXT.details]);
    expect(document.body.textContent).not.toContain('Your funds are unchanged');
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.details}));
    expect(nav.onDetails).toHaveBeenCalledWith(sig(7));
  });

  it('network-error (failed, not-sent): "Couldn\'t send", the design\'s sub, the engine detail as the reason banner\'s body (44d); [Try again]', async () => {
    const detail = 'The network refused this transaction (rejected: Blockhash not found). No funds moved.';
    await renderFailed(record({failure: 'not-sent', detail}));
    expect(await screen.findByText(SPEC.notSentHead)).toBeTruthy();
    expect(text()).toEqual([SPEC.notSentHead, SPEC.notSentSub, 'Reason · network-error']);
    // 44d puts the cause in the banner's body (`.s9-reason-banner .body`), never an empty label box.
    expect(document.querySelector('.s9-reason-banner .body')?.textContent).toBe(detail);
    expect(document.querySelector('.s9-reason-banner .meta')).toBeNull();
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
    expect(caption()).toBeNull();
    expect(screen.getByRole('button', {name: FAILED_TEXT.tryAgain})).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    // Nothing reached the chain: no [View details] (only rejected-by-program has a transaction to show).
    expect(screen.queryByRole('button', {name: FAILED_TEXT.details})).toBeNull();
  });

  it('generic (failed with no failure, an older build’s record): "Transaction failed", the detail, [View on explorer] only', async () => {
    await renderFailed(record({detail: 'Something odd.'}));
    expect(await screen.findByText(SPEC.genericHead)).toBeTruthy();
    expect(text()).toEqual([SPEC.genericHead, 'Something odd.', null]);
    expect(caption()).toBeNull();
    expect(screen.getByRole('link', {name: FAILED_TEXT.explorer})).toBeTruthy();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
  });

  it('the state comes from `failure`, never from `detail` (C3)', () => {
    expect(failedKind(record({failure: 'landed', detail: 'Not confirmed — no funds moved.'}))).toBe('rejected-by-program');
    expect(failedKind(record({failure: 'not-sent', detail: 'Landed but failed'}))).toBe('network-error');
    expect(failedKind(record({state: 'expired', failure: null}))).toBe('blockhash-expired');
    expect(failedKind(record({failure: null, detail: 'The network refused this transaction'}))).toBe('generic');
  });

  it('[Try again] hands #19 the same intent — once per tap (rule 6, `disabled` lifted); disabled in the 403 cool-down', async () => {
    await renderFailed(record({failure: 'not-sent', detail: 'x'}));
    const again = (await screen.findByRole('button', {name: FAILED_TEXT.tryAgain})) as HTMLButtonElement;
    fireEvent.click(again);
    again.disabled = false;
    fireEvent.click(again);
    expect(nav.onTryAgain).toHaveBeenCalledTimes(1);
    expect(nav.onTryAgain).toHaveBeenCalledWith(INTENT);
    cleanup();
    await renderFailed(record({failure: 'not-sent', detail: 'Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds moved.', detailCode: 'cooling'}), {
      reader: walletReader({
        getBalance: async () => {
          throw new RpcForbidden('getBalance');
        },
      }),
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect((screen.getByRole('button', {name: FAILED_TEXT.tryAgain}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('[Try again] pressed twice inside one act() (before any re-render: the ref is the guard): one call, the same intent — never the old bytes', async () => {
    await renderFailed(record({failure: 'landed', detail: 'x'}));
    const again = (await screen.findByRole('button', {name: FAILED_TEXT.tryAgain})) as HTMLButtonElement;
    act(() => {
      fireEvent.click(again);
      again.disabled = false;
      fireEvent.click(again);
    });
    expect(nav.onTryAgain).toHaveBeenCalledTimes(1);
    expect(nav.onTryAgain).toHaveBeenCalledWith(INTENT);
  });

  it('fees (spec §4.5 display rule): no state shows an amount as paid; only rejected says a fee was charged (the network fee, in words); expired and not-sent never claim one', async () => {
    // fee: network 5 050 + markup 20 000 lamports. Neither part, nor their sum, is printed in any state.
    const states = {
      expired: record({state: 'expired', detail: 'Not confirmed — no funds moved.'}),
      landed: record({failure: 'landed', detail: 'x'}),
      notSent: record({failure: 'not-sent', detail: 'The network refused this transaction (rejected: x). No funds moved.'}),
      cooling: record({failure: 'not-sent', detail: 'Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds moved.', detailCode: 'cooling'}),
      generic: record({detail: 'x'}),
    };
    for (const [name, p] of Object.entries(states)) {
      cleanup();
      await renderFailed(p);
      await screen.findByRole('heading');
      const body = document.body.textContent ?? '';
      expect(body).not.toMatch(/0\.00000505|0\.00002|0\.00002505|fee paid|network fee \d|network fee:/i);
      // A claim that a fee was charged/paid: only rejected-by-program makes one. "No fees were charged" is the opposite claim.
      const claims = /(?<!no )fees? (was|were|has been|have been)? ?(charged|paid)/i.test(body);
      expect([name, claims]).toEqual([name, name === 'landed']);
    }
    cleanup();
    await renderFailed(states.landed);
    expect(await screen.findByText(SPEC.rejectedSub)).toBeTruthy();
  });

  it('the expired sub is the engine record\'s own line; the spec\'s line only when an expired record has none', async () => {
    await renderFailed(record({state: 'expired', detail: 'Expired before it landed — nothing moved.'}));
    await screen.findByText(SPEC.expiredHead);
    expect(text()[1]).toBe('Expired before it landed — nothing moved.');
    cleanup();
    await renderFailed(record({state: 'expired', detail: null}));
    await screen.findByText(SPEC.expiredHead);
    expect(text()[1]).toBe(SPEC.expiredSub);
  });

  it('the back arrow and Esc go to #12 with the form kept (the design’s exit)', async () => {
    await renderFailed(record({failure: 'landed', detail: 'x'}));
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(nav.onEdit).toHaveBeenCalledTimes(2);
  });
});

describe('#44’s user-cancelled toast', () => {
  it('unmounted before 1.8 s: its timer is cleared — nothing fires afterwards', async () => {
    vi.useFakeTimers();
    try {
      const done = vi.fn();
      const view = render(<CancelledToast onDone={done} />);
      await act(async () => void vi.advanceTimersByTime(CANCELLED_MS - 100));
      view.unmount();
      await act(async () => void vi.advanceTimersByTime(CANCELLED_MS * 2));
      expect(done).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('"Transaction cancelled. No fees charged." in the design’s pill, gone after 1.8 s', async () => {
    vi.useFakeTimers();
    try {
      const done = vi.fn();
      render(<CancelledToast onDone={done} />);
      expect([screen.getByRole('status').textContent, CANCELLED_TEXT, CANCELLED_MS]).toEqual(['Transaction cancelled. No fees charged.', 'Transaction cancelled. No fees charged.', 1_800]);
      expect(document.querySelector('.s9-toast-cancelled')).not.toBeNull();
      await act(async () => void vi.advanceTimersByTime(CANCELLED_MS - 1));
      expect(done).not.toHaveBeenCalled();
      await act(async () => void vi.advanceTimersByTime(1));
      expect(done).toHaveBeenCalledTimes(1);
      expect(unstyledClasses(document.querySelector('.s9-toast-cancelled')!, SELECTORS)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
