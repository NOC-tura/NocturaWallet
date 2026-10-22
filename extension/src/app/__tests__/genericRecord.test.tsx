// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {base64} from '@scure/base';
import {renderInWallet, type Wallet} from './harness';
import {Home} from '../screens/Home';
import {Activity} from '../screens/Activity';
import {Status, STATUS_TEXT} from '../screens/Status';
import {FAILED_TEXT, Failed} from '../screens/Failed';
import {STUCK_TEXT, Stuck} from '../screens/Stuck';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {PENDING_KEY, type PendingRecord} from '../../background/pendingStore';
import {firstSignature} from '../../../../core/solana/broadcast';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire} from '../../background/__tests__/fixtures';
import type {Pending} from '../engine';

// B1d §1.3 "Screens that read intent", §4.5, Q42 (C19): the wallet's own record of a kind this build cannot show — a
// purchase (`intent: null`, `extra` of kind presale-buy) in both builds while no kind renderer exists (B1d-1a) — is
// shown generically on #11, #26, #21, #44 and #54: Q42's words, the transaction's own facts (signature, explorer link,
// fee, block height, B1b's resend), never an amount, a recipient or anything from `extra.data`. Runs in both vitest runs.
const SELECTORS = selectorsOf(UI_SHEETS);
// Q42, as literals: a wrong constant must not pass by being compared with itself.
const Q42 = {pending: 'Transaction · pending', slow: 'Transaction · taking longer than usual', line: 'Transaction'};
const WIRE = signedWire(9n);
const SIGNATURE = firstSignature(WIRE);
/** B1d §2.3's display data: every value here must stay off the screen. */
const DATA = {currency: 'USDC', amount: '25000000', stage: '2', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '2500', destination: RECIPIENT, referrer: null};
const EXTRA = {kind: 'presale-buy', data: DATA};
const FEE = {networkLamports: '5050', markupLamports: '0'};
/** A stored purchase record, B1d §2.3's shape (as pendingKinds.test.ts's PURCHASE). */
const purchase = (over: Partial<PendingRecord> = {}): PendingRecord =>
  pendingRecord({id: 'b1', account: ACCOUNT.publicKey, signature: SIGNATURE, wire: base64.encode(WIRE), createdAt: Date.now(), lastSentAt: Date.now(), lastValidBlockHeight: 1150, intent: null, fee: FEE, extra: EXTRA, ...over});
/** What wallet.pending hands a screen for it. */
const view = (over: Partial<Pending> = {}): Pending => ({
  id: 'b1',
  account: ACCOUNT.publicKey,
  signature: SIGNATURE,
  lastValidBlockHeight: 1150,
  createdAt: 1_000_000_000_000,
  lastSentAt: 1_000_000_000_000,
  state: 'pending',
  detail: null,
  detailCode: null,
  intent: null,
  extra: EXTRA,
  expiryNullSeenAt: null,
  failure: null,
  fee: {networkLamports: 5_050n, markupLamports: 0n},
  ...over,
});
const seed = (records: PendingRecord[]) => ({before: (ext: Wallet['ext']) => ext.local.set(PENDING_KEY, records)});
/** Nothing of a purchase's amount, recipient or display data, and no send wording, in `el` (the row, or the whole screen). */
function expectGeneric(el: Element = document.body) {
  const text = el.textContent ?? '';
  for (const v of ['USDC', '25,000', '25.00', '1998667554963357', '1,998,667', 'presale', 'Presale', 'Sending ', 'Recipient', RECIPIENT]) expect([v, text.includes(v)]).toEqual([v, false]);
  expect(el.querySelector('.addr-groups')).toBeNull();
}
const meta = () => [...document.querySelectorAll('.meta-row')].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]);
const cardRows = (card: string) => [...document.querySelectorAll(`${card} .row`)].map(r => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
const nav = {onSend: vi.fn(), onReceive: vi.fn(), onPending: vi.fn(), onAccounts: vi.fn(), onTx: vi.fn()};
const status = {onDone: vi.fn(), onDetails: vi.fn(), onActivity: vi.fn(), onTryAgain: vi.fn(), onEdit: vi.fn()};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('#11 and #26: the pending row of a record without an intent (Q42a)', () => {
  it('#11: "Transaction · pending", no amount; it opens that record — and a send beside it keeps its own row (positive control)', async () => {
    await renderInWallet(<Home onSend={nav.onSend} onReceive={nav.onReceive} onPending={nav.onPending} onAccounts={nav.onAccounts} />, seed([purchase()]));
    const strip = await screen.findByText(Q42.pending);
    expect(document.querySelector('.app-pending-strip .noc-body-sm')?.textContent).toBe(Q42.pending);
    expectGeneric(document.querySelector('.app-pending-strip')!);
    fireEvent.click(strip);
    expect(nav.onPending).toHaveBeenCalledWith(expect.objectContaining({id: 'b1', intent: null, extra: EXTRA}));
  });

  it('#11: a send is still "Sending 2.48 SOL · pending" (the generic row is only for a record without an intent)', async () => {
    await renderInWallet(
      <Home onSend={nav.onSend} onReceive={nav.onReceive} onPending={nav.onPending} onAccounts={nav.onAccounts} />,
      seed([pendingRecord({id: 's1', account: ACCOUNT.publicKey, signature: SIGNATURE, createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}})]),
    );
    expect(await screen.findByText('Sending 2.48 SOL · pending')).toBeTruthy();
    expect(screen.queryByText(Q42.pending)).toBeNull();
  });

  it('#11: past 80 s, or stuck, "Transaction · taking longer than usual"', async () => {
    for (const over of [{createdAt: Date.now() - 81_000}, {state: 'stuck' as const}]) {
      await renderInWallet(<Home onSend={nav.onSend} onReceive={nav.onReceive} onPending={nav.onPending} onAccounts={nav.onAccounts} />, seed([purchase(over)]));
      expect(await screen.findByText(Q42.slow)).toBeTruthy();
      expectGeneric(document.querySelector('.app-pending-strip')!);
      cleanup();
    }
  });

  it('#11: a record whose extra the background could not read (extra null) is shown the same way — kept, never hidden', async () => {
    await renderInWallet(<Home onSend={nav.onSend} onReceive={nav.onReceive} onPending={nav.onPending} onAccounts={nav.onAccounts} />, seed([purchase({extra: null})]));
    expect(await screen.findByText(Q42.pending)).toBeTruthy();
  });

  it('#26: "Transaction · pending" and the time it has waited, no amount; it opens that record', async () => {
    await renderInWallet(<Activity onTx={nav.onTx} onReceive={nav.onReceive} onPending={nav.onPending} />, seed([purchase({createdAt: Date.now() - 5_000})]));
    const row = await waitFor(() => {
      const r = document.querySelector('.tx-row[data-pending="b1"]');
      if (r === null) throw new Error('no pending row');
      return r as HTMLElement;
    });
    expect(row.querySelector('.pri')?.textContent).toBe(Q42.pending);
    expect(row.querySelector('.sec')?.textContent).toMatch(/^waiting · 0 m \d s$/);
    expectGeneric(row);
    fireEvent.click(row);
    expect(nav.onPending).toHaveBeenCalledWith(expect.objectContaining({id: 'b1', intent: null}));
    expect(unstyledClasses(row, SELECTORS)).toEqual([]);
  });

  it('#26: past 80 s, "Transaction · taking longer than usual"; a send beside it keeps "Sending …" (positive control)', async () => {
    const send = pendingRecord({id: 's1', account: ACCOUNT.publicKey, signature: SIGNATURE, createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}});
    await renderInWallet(<Activity onTx={nav.onTx} onReceive={nav.onReceive} onPending={nav.onPending} />, seed([purchase({createdAt: Date.now() - 81_000}), send]));
    await waitFor(() => expect(document.querySelectorAll('.tx-row[data-pending]').length).toBe(2));
    expect([...document.querySelectorAll('.tx-row[data-pending] .pri')].map(p => p.textContent)).toEqual([Q42.slow, 'Sending 2.48 SOL']);
  });
});

describe('#21: a record without an intent (Q42b)', () => {
  const renderStatus = (records: PendingRecord[]) => renderInWallet(<Status account={ACCOUNT.publicKey} id="b1" since={0} canRetry {...status} />, seed(records));

  it('broadcasting: the amount line is "Transaction" — no fiat, no To row; the status row and the honest lines as for a send', async () => {
    await renderStatus([purchase()]);
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(document.querySelector('.amount-card')?.textContent).toBe(Q42.line);
    expect(document.querySelector('.amount-card .amount')?.textContent).toBe(Q42.line);
    expect(document.querySelector('.amount-card .ticker')).toBeNull();
    expect(meta()).toEqual([['Status', STATUS_TEXT.statusBroadcasting]]);
    expect(screen.getByText(STATUS_TEXT.canClose)).toBeTruthy();
    expectGeneric();
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });

  it('slow (80–90 s): the hash with its copy and the waited time — still no To row', async () => {
    await renderStatus([purchase({createdAt: Date.now() - 83_000})]);
    expect(await screen.findByText(STATUS_TEXT.slowLabel)).toBeTruthy();
    expect(meta()).toEqual([
      ['Tx hash', SIGNATURE],
      ['Status', 'Waiting · 1 m 23 s'],
    ]);
    expect(screen.getByRole('button', {name: 'Copy transaction hash'})).toBeTruthy();
    expectGeneric();
  });

  it('polled to confirmed: "Sent successfully", the amount line "Transaction", the hash and the fee paid; [View details] opens its signature', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([purchase()]);
    await screen.findByText(STATUS_TEXT.broadcasting);
    await w.ext.local.set(PENDING_KEY, [purchase({state: 'confirmed'})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(STATUS_TEXT.sentOk)).toBeTruthy();
    expect(document.querySelector('.amount-card')?.textContent).toBe(Q42.line);
    expect(meta()).toEqual([
      ['Tx hash', SIGNATURE],
      ['Fee paid', '0.00000505 SOL'],
    ]);
    expectGeneric();
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.details}));
    expect(status.onDetails).toHaveBeenCalledWith(SIGNATURE);
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });
});

describe('#44: a record without an intent — no [Try again], no [Edit transaction] (nothing to prepare again)', () => {
  const renderFailed = (p: Pending) => renderInWallet(<Failed record={p} canRetry onTryAgain={status.onTryAgain} onEdit={status.onEdit} onDetails={status.onDetails} onClose={status.onDone} />);

  it('blockhash-expired: the kept payload is its block height only; the footer about the same recipient and amount is not shown; the explorer link instead of [Try again]', async () => {
    await renderFailed(view({state: 'expired', detail: 'Not confirmed — no funds moved.'}));
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    expect(document.querySelector('.top-bar .title')?.textContent).toBe(Q42.line);
    expect(cardRows('.s9-payload-card')).toEqual([['Valid until block', '1150']]);
    expect(screen.queryByText(FAILED_TEXT.expiredFoot)).toBeNull();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.edit})).toBeNull();
    expect(screen.getByRole('link', {name: FAILED_TEXT.explorer}).getAttribute('href')).toContain(SIGNATURE);
    expectGeneric();
    // The back arrow closes (it would open #12 with the draft for a send).
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(status.onDone).toHaveBeenCalledTimes(1);
    expect(status.onEdit).not.toHaveBeenCalled();
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('rejected by the program: the reason and its explorer link, [View details]; no [Try again]', async () => {
    await renderFailed(view({state: 'failed', failure: 'landed', detail: 'custom program error: 0x1'}));
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.details}));
    expect(status.onDetails).toHaveBeenCalledWith(SIGNATURE);
    expectGeneric();
  });

  it('not sent: the reason; the explorer link instead of [Try again]', async () => {
    await renderFailed(view({state: 'failed', failure: 'not-sent', detail: 'The route refused it.'}));
    expect(await screen.findByText(FAILED_TEXT.notSentHead)).toBeTruthy();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
    expect(screen.getByRole('link', {name: FAILED_TEXT.explorer})).toBeTruthy();
    expectGeneric();
  });
});

describe('#54: a record without an intent', () => {
  const NOW = 1_000_000_094_000;
  const renderStuck = (p: Pending, deps: Parameters<typeof renderInWallet>[1] = {}) =>
    renderInWallet(<Stuck record={p} now={NOW} canRetry onClose={status.onDone} onActivity={status.onActivity} onTryAgain={status.onTryAgain} />, {
      ...seed([purchase({state: p.state, createdAt: p.createdAt, lastSentAt: p.lastSentAt})]),
      ...deps,
    });

  it('stuck: the original’s card names it "Transaction" — its hash and block height, no amount, no recipient; Send again re-sends its own bytes', async () => {
    const broadcasts: string[] = [];
    await renderStuck(view({state: 'stuck'}), {
      deps: {
        now: () => NOW,
        broadcast: async wire => {
          broadcasts.push(base64.encode(wire));
          return firstSignature(wire);
        },
      },
    });
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    expect(document.querySelector('.orig-card .pill')?.textContent).toBe(Q42.line);
    expect(cardRows('.orig-card').map(([k]) => k)).toEqual(['Tx hash', 'Valid until block']);
    expectGeneric();
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.sentLine)).toBeTruthy();
    expect(broadcasts).toEqual([base64.encode(WIRE)]);
  });

  it('expired: "Not confirmed — no funds moved." and Done — no [Try again] (nothing to prepare again)', async () => {
    await renderStuck(view({state: 'expired'}));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(screen.queryByRole('button', {name: STUCK_TEXT.tryAgain})).toBeNull();
    expect(screen.getByRole('button', {name: STUCK_TEXT.done})).toBeTruthy();
    expectGeneric();
  });
});
