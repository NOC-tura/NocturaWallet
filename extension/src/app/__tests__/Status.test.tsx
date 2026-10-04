// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {renderInWallet, setupWallet, type Wallet} from './harness';
import {SLOW_AFTER_MS, STATUS_TEXT, STUCK_AFTER_MS, Status} from '../screens/Status';
import {STUCK_TEXT} from '../screens/Stuck';
import {FAILED_TEXT} from '../screens/Failed';
import {CLOSE_CHECK_MS} from '../ui/useCloseTab';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {PENDING_KEY, type PendingRecord} from '../../background/pendingStore';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {sig} from '../../../e2e/historyFixtures';
import {WalletProvider, useWallet, type Surface, type WalletModel} from '../WalletContext';
import type {Engine, Pending} from '../engine';

// Spec §4.6 (#21): the pending record re-read every 2 s from wallet.pending, matched by id; #54 at 90 s or
// `stuck`, #44 on `failed` (and `expired` when #54 was never shown).
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onDone: vi.fn(), onDetails: vi.fn(), onActivity: vi.fn(), onTryAgain: vi.fn(), onEdit: vi.fn()};
const SIGNATURE = sig(3);
// The record's split fee (Task 3): 5 050 network + 20 000 Noctura fee — paid only once confirmed.
const FEE = {networkLamports: '5050', markupLamports: '20000'};
const rec = (over: Partial<PendingRecord> = {}) =>
  pendingRecord({id: 'r1', account: ACCOUNT.publicKey, signature: SIGNATURE, createdAt: Date.now(), lastSentAt: Date.now(), lastValidBlockHeight: 1150, intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, fee: FEE, ...over});

async function renderStatus(records: PendingRecord[], o: {id?: string | null; since?: number; surface?: Surface} = {}): Promise<Wallet & {reads: () => number}> {
  let reads = 0;
  const w = await renderInWallet(<Status account={ACCOUNT.publicKey} id={o.id === undefined ? 'r1' : o.id} since={o.since ?? 0} {...nav} />, {
    surface: o.surface,
    before: ext => ext.local.set(PENDING_KEY, records),
    gate: m => {
      if ((m as {type: string}).type === 'wallet.pending') reads += 1;
    },
  });
  return {...w, reads: () => reads};
}
const set = (w: Wallet, records: PendingRecord[]) => w.ext.local.set(PENDING_KEY, records);
const meta = () => [...document.querySelectorAll('.meta-row')].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]);

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('#21 tx-status', () => {
  it('broadcasting (< 80 s): the ring, "Broadcasting transaction…", the amount, To in groups of four, "Broadcasting", the two honest lines, the disabled CTA', async () => {
    await renderStatus([rec()]);
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.sending)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.submitted)).toBeTruthy();
    expect(document.querySelector('.ring')?.className).toBe('ring broadcasting');
    expect(document.querySelector('.amount-card .amount')?.textContent).toBe('2.4800');
    expect(document.querySelector('.amount-card .noc-caption')?.textContent).toBe('≈ $372.00 USD');
    expect(meta()).toEqual([
      ['To', RECIPIENT],
      ['Status', STATUS_TEXT.statusBroadcasting],
    ]);
    expect([...document.querySelectorAll('.meta-row .addr-groups > span')].map(s => s.textContent)).toEqual(RECIPIENT.match(/.{1,4}/g));
    expect(screen.getByText(STATUS_TEXT.canClose)).toBeTruthy();
    // The design's reassurance line, its lead in bold (index.html #s21).
    expect(document.querySelector('.app-reassure')?.textContent).toBe(STATUS_TEXT.ifFails);
    expect(document.querySelector('.app-reassure b')?.textContent).toBe('If this fails, your funds stay in your wallet');
    expect((screen.getByRole('button', {name: STATUS_TEXT.waiting}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Back'}) as HTMLButtonElement).disabled).toBe(true);
    // Adapted: closing is allowed and said so — never "Don't close the app".
    expect(document.body.textContent).not.toMatch(/Don't close|Slot|8–12 s/);
    // Carry 4: every class matched where it stands (ancestor-aware), not merely present in some selector.
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });

  it('slow (80–90 s): SLOW, the dashed ring, the honest sub, the hash with a copy, "Waiting · 1 m 23 s", recovery in 07 s', async () => {
    await renderStatus([rec({createdAt: Date.now() - 83_000})]);
    expect(await screen.findByText(STATUS_TEXT.slowLabel)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.slow)).toBeTruthy();
    expect(document.querySelector('.ring')?.className).toBe('ring stuck');
    expect(screen.getByText(STATUS_TEXT.slowSub)).toBeTruthy();
    expect(meta()).toEqual([
      ['To', RECIPIENT],
      ['Tx hash', SIGNATURE],
      ['Status', 'Waiting · 1 m 23 s'],
    ]);
    expect(screen.getByRole('button', {name: 'Copy transaction hash'})).toBeTruthy();
    expect(document.querySelector('.stuck-watch')?.textContent).toBe(`${STATUS_TEXT.recoveryIn}07 s`);
    expect(document.body.textContent).not.toMatch(/congested|mempool/);
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });

  it('at 90 s, or when the engine says stuck, #54 takes over', async () => {
    await renderStatus([rec({createdAt: Date.now() - STUCK_AFTER_MS})]);
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    cleanup();
    await renderStatus([rec({state: 'stuck'})]);
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    expect(SLOW_AFTER_MS).toBe(80_000);
  });

  it('success seen live: "Sent", CONFIRMED, "Confirmed in N s", the amount at 36 px, To, the full hash, the fee paid (network + Noctura fee); [View details], [Done]', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const created = Date.now();
    const w = await renderStatus([rec({createdAt: created})]);
    await screen.findByText(STATUS_TEXT.broadcasting);
    vi.setSystemTime(created + 8_000);
    await set(w, [rec({createdAt: created, state: 'confirmed'})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(STATUS_TEXT.sentOk)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.sent)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.confirmed)).toBeTruthy();
    expect(document.querySelector('.ring')?.className).toBe('ring success');
    expect(screen.getByText(/^Confirmed in \d+ s$/).textContent).toMatch(/^Confirmed in (9|10|11) s$/);
    expect(document.querySelector('.amount-card .amount')?.classList.contains('app-amount-big')).toBe(true);
    expect(meta()).toEqual([
      ['To', RECIPIENT],
      ['Tx hash', SIGNATURE],
      ['Fee paid', '0.00002505 SOL'],
    ]);
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.details}));
    expect(nav.onDetails).toHaveBeenCalledWith(SIGNATURE);
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.done}));
    expect(nav.onDone).toHaveBeenCalledTimes(1);
  });

  it('opened on a send already confirmed: no "Confirmed in" (it was not seen live); a record from before plan 3 has no fee row', async () => {
    await renderStatus([rec({state: 'confirmed', fee: null})]);
    expect(await screen.findByText(STATUS_TEXT.sentOk)).toBeTruthy();
    expect(screen.queryByText(/Confirmed in/)).toBeNull();
    expect(meta().map(r => r[0])).toEqual(['To', 'Tx hash']);
  });

  it('"Fee paid" only in success: never on broadcasting, slow, #54 stuck, #54 expired, #44 expired or #44 failed, though every record carries a fee', async () => {
    const states: [Partial<PendingRecord>, string][] = [
      [{}, STATUS_TEXT.broadcasting],
      [{createdAt: Date.now() - 83_000}, STATUS_TEXT.slowLabel],
      [{state: 'stuck'}, STUCK_TEXT.title],
      [{state: 'expired', detail: 'Not confirmed — no funds moved.'}, FAILED_TEXT.expiredHead],
      [{state: 'failed', failure: 'landed', detail: 'x'}, FAILED_TEXT.rejectedHead],
      [{state: 'failed', failure: 'not-sent', detail: 'y'}, FAILED_TEXT.notSentHead],
    ];
    for (const [over, shown] of states) {
      await renderStatus([rec(over)]);
      expect(await screen.findByText(shown)).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/Fee paid|0\.00002505|0\.00000505/);
      cleanup();
    }
    // #54's expired layout, reached from #54: no fee either.
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([rec({state: 'stuck'})]);
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    await set(w, [rec({state: 'expired', detail: 'Not confirmed — no funds moved.'})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Fee paid|0\.00002505|0\.00000505/);
  });

  it('in the UI tab: "Done — open the Noctura icon any time." and [Close this tab], hidden when the browser keeps the tab', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([rec({state: 'confirmed'})], {surface: 'tab'});
    expect(await screen.findByText(STATUS_TEXT.doneTab)).toBeTruthy();
    expect(screen.queryByRole('button', {name: STATUS_TEXT.done})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.closeTab}));
    expect(w.platform.closed).toBe(1);
    await act(async () => void vi.advanceTimersByTime(CLOSE_CHECK_MS));
    expect(screen.queryByRole('button', {name: STATUS_TEXT.closeTab})).toBeNull();
  });

  it('failed → #44 by its failure; expired without #54 → #44’s blockhash-expired; expired after #54 → #54’s expired layout', async () => {
    await renderStatus([rec({state: 'failed', failure: 'landed', detail: 'x'})]);
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    cleanup();
    await renderStatus([rec({state: 'expired', detail: 'Not confirmed — no funds moved.'})]);
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    cleanup();
    // An expired record long past 90 s on the page's clock, #54 never shown: still #44 (what was shown decides).
    await renderStatus([rec({state: 'expired', createdAt: Date.now() - 600_000, detail: 'Not confirmed — no funds moved.'})]);
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    cleanup();
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([rec({state: 'stuck'})]);
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    await set(w, [rec({state: 'expired', detail: 'Not confirmed — no funds moved.'})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(screen.queryByText(FAILED_TEXT.expiredHead)).toBeNull();
  });

  it('with no id (the send’s answer was lost): this account’s record from the tap on is tracked; none → the check-pending line and [Open Activity]', async () => {
    const since = Date.now() - 1_000;
    await renderStatus([rec({id: 'old', createdAt: since - 10_000, state: 'confirmed'}), rec({id: 'new', createdAt: since + 5})], {id: null, since});
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    cleanup();
    // Another account's record from the tap on is not this send.
    await renderStatus([rec({id: 'old', createdAt: since - 10_000, state: 'confirmed'}), rec({id: 'theirs', account: RECIPIENT, createdAt: since + 5})], {id: null, since});
    expect(await screen.findByText(STATUS_TEXT.unsure)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/nothing (was )?sent/i);
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.openActivity}));
    expect(nav.onActivity).toHaveBeenCalledTimes(1);
  });

  it('an id the engine no longer has: "This transaction is no longer tracked."', async () => {
    await renderStatus([], {id: 'gone'});
    expect(await screen.findByText(STUCK_TEXT.untracked)).toBeTruthy();
    expect(screen.getByRole('button', {name: STATUS_TEXT.openActivity})).toBeTruthy();
  });

  it('the engine’s detail shows as a caption under the status', async () => {
    await renderStatus([rec({detail: 'Not acknowledged yet; still watching. "Send again" re-sends the same transaction.', detailCode: 'unacked'})]);
    expect(await screen.findByText('Not acknowledged yet; still watching. "Send again" re-sends the same transaction.')).toBeTruthy();
  });

  it('reads every 2 s while shown, and not once after it is left', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([rec()]);
    await screen.findByText(STATUS_TEXT.broadcasting);
    const first = w.reads();
    await act(async () => void vi.advanceTimersByTime(4_000));
    await waitFor(() => expect(w.reads()).toBeGreaterThanOrEqual(first + 2));
    cleanup();
    const unmounted = w.reads();
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(w.reads()).toBe(unmounted);
  });

  it('a settled record (#44, or success) stops the reads: its screen is never moved by a later one', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([rec({state: 'failed', failure: 'landed', detail: 'x'})]);
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    await set(w, []);
    const settled = w.reads();
    await act(async () => void vi.advanceTimersByTime(6_000));
    expect(screen.getByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect(screen.queryByText(STUCK_TEXT.untracked)).toBeNull();
    expect(w.reads()).toBe(settled);
  });
});

// ── Every await checks its generation ─────────────────────────────────────────────────────────────
// wallet.pending answered by the test (held until answered, in order of asking) once `hold` is on. The records belong
// to the account that is NOT selected, so the provider's own 2 s poll stays off and the held reads are the screen's.

type PendingReply = Awaited<ReturnType<Engine['pending']>>;
const probe: {m: WalletModel | null} = {m: null};
function Spy() {
  probe.m = useWallet();
  return null;
}
const view = (over: Partial<Pending> = {}): Pending => ({
  id: 'r1',
  account: RECIPIENT,
  signature: SIGNATURE,
  lastValidBlockHeight: 1150,
  createdAt: Date.now(),
  lastSentAt: Date.now(),
  state: 'pending',
  detail: null,
  detailCode: null,
  intent: {token: 'SOL', recipient: ACCOUNT.publicKey, amount: 2_480_000_000n},
  expiryNullSeenAt: null,
  failure: null,
  fee: {networkLamports: 5_050n, markupLamports: 20_000n},
  ...over,
});

async function mountHeld() {
  const w = await setupWallet({before: ext => ext.local.set(PENDING_KEY, [])});
  const held: ((r: PendingReply) => void)[] = [];
  let hold = false;
  const engine: Engine = {
    ...w.engine,
    pending: () => (hold ? new Promise<PendingReply>(r => held.push(r)) : Promise.resolve({ok: true, data: [view()]})),
  };
  const tree = (id: string) => (
    <WalletProvider engine={engine} platform={w.platform} surface="popup">
      <Spy />
      <Status account={RECIPIENT} id={id} since={0} {...nav} />
    </WalletProvider>
  );
  const r = render(tree('r1'));
  await screen.findByText(STATUS_TEXT.broadcasting);
  await waitFor(() => expect(probe.m?.account?.publicKey).toBe(ACCOUNT.publicKey));
  hold = true;
  return {
    ...w,
    held,
    show: (id: string) => r.rerender(tree(id)),
    /** Answers the read asked `i`-th since `hold` went on. */
    answer: (i: number, data: Pending[]) => act(async () => held[i]?.({ok: true, data})),
    tick: () => act(async () => void vi.advanceTimersByTime(2_000)),
  };
}

describe('#21 — a late read never moves the screen', () => {
  it('a newer read answered first: the older answer is dropped', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await mountHeld();
    await w.tick();
    await w.tick();
    await waitFor(() => expect(w.held.length).toBeGreaterThanOrEqual(2));
    await w.answer(1, [view({detail: 'newer'})]);
    expect(await screen.findByText('newer')).toBeTruthy();
    await w.answer(0, [view({state: 'failed', failure: 'landed', detail: 'older'})]);
    expect(screen.queryByText(FAILED_TEXT.rejectedHead)).toBeNull();
    expect(screen.getByText('newer')).toBeTruthy();
  });

  it('the record id changed while a read was out: its answer never lands on the new record', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await mountHeld();
    await w.tick();
    await waitFor(() => expect(w.held.length).toBe(1));
    w.show('r2');
    await waitFor(() => expect(w.held.length).toBe(2));
    await w.answer(1, [view(), view({id: 'r2', detail: 'the second send'})]);
    expect(await screen.findByText('the second send')).toBeTruthy();
    await w.answer(0, [view({state: 'failed', failure: 'landed', detail: 'x'}), view({id: 'r2', state: 'failed', failure: 'landed', detail: 'x'})]);
    expect(screen.queryByText(FAILED_TEXT.rejectedHead)).toBeNull();
    expect(screen.getByText('the second send')).toBeTruthy();
  });

  it('the account switched while a read was out: its answer is dropped', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await mountHeld();
    await w.tick();
    await waitFor(() => expect(w.held.length).toBe(1));
    expect((await w.engine.select(1)).ok).toBe(true);
    let reloaded = false;
    void probe.m!.reload().then(() => (reloaded = true));
    // The provider's own open read and the screen's fresh read (a new generation) are answered: still broadcasting.
    await waitFor(() => expect(w.held.length).toBeGreaterThanOrEqual(3));
    for (let i = 1; i < w.held.length; i += 1) await w.answer(i, [view({detail: 'after the switch'})]);
    await waitFor(() => expect(reloaded).toBe(true));
    expect(await screen.findByText('after the switch')).toBeTruthy();
    await w.answer(0, [view({state: 'confirmed'})]);
    expect(screen.queryByText(STATUS_TEXT.sentOk)).toBeNull();
    expect(screen.getByText(STATUS_TEXT.broadcasting)).toBeTruthy();
  });

  it('routed to #44 while an older read was out: that read never moves #44 back', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await mountHeld();
    await w.tick();
    await w.tick();
    await waitFor(() => expect(w.held.length).toBeGreaterThanOrEqual(2));
    await w.answer(1, [view({state: 'failed', failure: 'landed', detail: 'x'})]);
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    await w.answer(0, [view()]);
    expect(screen.getByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect(screen.queryByText(STATUS_TEXT.broadcasting)).toBeNull();
  });

  it('left while a read was out: nothing more is asked, and the answer lands nowhere', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await mountHeld();
    await w.tick();
    await waitFor(() => expect(w.held.length).toBe(1));
    cleanup();
    await w.answer(0, [view({state: 'confirmed'})]);
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(w.held.length).toBe(1);
    expect(document.body.textContent).toBe('');
  });
});
