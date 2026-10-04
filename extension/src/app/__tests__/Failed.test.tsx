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
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    expect(text()).toEqual([FAILED_TEXT.expiredHead, FAILED_TEXT.expiredSub, 'Reason · blockhash-expired']);
    expect(document.querySelector('.s9-reason-banner .body')?.textContent).toBe(FAILED_TEXT.expiredWhy);
    expect(screen.getByText(FAILED_TEXT.payload)).toBeTruthy();
    const rows = [...document.querySelectorAll('.s9-payload-card .row')].map(r => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
    expect(rows).toEqual([
      ['To', RECIPIENT],
      ['Amount', '2.4800 SOL'],
      ['Valid until block', '1150'],
    ]);
    expect(screen.getByText(FAILED_TEXT.expiredFoot)).toBeTruthy();
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
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect(text()).toEqual([FAILED_TEXT.rejectedHead, FAILED_TEXT.rejectedSub, 'Reason · rejected-by-program']);
    expect(document.querySelector('.s9-reason-banner .meta')?.textContent).toBe(detail);
    expect(document.querySelector('.top-bar .step')?.textContent).toBe('Rejected');
    const link = screen.getByRole('link', {name: FAILED_TEXT.explorer}) as HTMLAnchorElement;
    expect([link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]).toEqual([`https://solscan.io/tx/${sig(7)}`, '_blank', 'noopener noreferrer']);
    expect(document.body.textContent).not.toContain('Your funds are unchanged');
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.details}));
    expect(nav.onDetails).toHaveBeenCalledWith(sig(7));
  });

  it('network-error (failed, not-sent): "Couldn\'t send", the engine detail as the caption; [Try again]', async () => {
    const detail = 'The network refused this transaction (rejected: Blockhash not found). No funds moved.';
    await renderFailed(record({failure: 'not-sent', detail}));
    expect(await screen.findByText(FAILED_TEXT.notSentHead)).toBeTruthy();
    expect(text()).toEqual([FAILED_TEXT.notSentHead, detail, 'Reason · network-error']);
    expect(screen.getByRole('button', {name: FAILED_TEXT.tryAgain})).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    // Nothing reached the chain: no [View details] (only rejected-by-program has a transaction to show).
    expect(screen.queryByRole('button', {name: FAILED_TEXT.details})).toBeNull();
  });

  it('generic (failed with no failure, an older build’s record): "Transaction failed", the detail, [View on explorer] only', async () => {
    await renderFailed(record({detail: 'Something odd.'}));
    expect(await screen.findByText(FAILED_TEXT.genericHead)).toBeTruthy();
    expect(text()).toEqual([FAILED_TEXT.genericHead, 'Something odd.', null]);
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

  it('fees (spec §4.5 display rule): no state shows an amount as paid — rejected says the network fee was charged, in words; the markup never appears', async () => {
    // fee: network 5 050 + markup 20 000 lamports. Neither part, nor their sum, is printed in any state.
    for (const p of [record({state: 'expired', detail: 'Not confirmed — no funds moved.'}), record({failure: 'landed', detail: 'x'}), record({failure: 'not-sent', detail: 'x'}), record({detail: 'x'})]) {
      cleanup();
      await renderFailed(p);
      await screen.findByRole('heading');
      expect(document.body.textContent).not.toMatch(/0\.00000505|0\.00002|0\.00002505|Fee paid|Network fee/);
    }
    expect(document.body.textContent).not.toContain('fee was charged');
    cleanup();
    await renderFailed(record({failure: 'landed', detail: 'x'}));
    expect(await screen.findByText(FAILED_TEXT.rejectedSub)).toBeTruthy();
    expect(FAILED_TEXT.rejectedSub).toContain('The network fee was charged');
  });

  it('the back arrow and Esc go to #12 with the form kept (the design’s exit)', async () => {
    await renderFailed(record({failure: 'landed', detail: 'x'}));
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(nav.onEdit).toHaveBeenCalledTimes(2);
  });
});

describe('#44’s user-cancelled toast', () => {
  it('"Transaction cancelled. No fees charged." in the design’s pill, gone after 1.8 s', async () => {
    vi.useFakeTimers();
    try {
      const done = vi.fn();
      render(<CancelledToast onDone={done} />);
      expect(screen.getByRole('status').textContent).toBe(CANCELLED_TEXT);
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
