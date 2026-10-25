// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {base64} from '@scure/base';
import {renderInWallet, type Wallet} from '../../__tests__/harness';
import {Status, STATUS_TEXT} from '../../screens/Status';
import {FAILED_TEXT, Failed} from '../../screens/Failed';
import {STUCK_TEXT, Stuck} from '../../screens/Stuck';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../../__tests__/styled';
import {PENDING_KEY, type PendingRecord} from '../../../background/pendingStore';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire} from '../../../background/__tests__/fixtures';
import {MAINNET_SOL_TREASURY} from '../../../../../core/presale/addresses';
import {PRESALE_SLOTS} from '../records';
import {createEngine, type Pending} from '../../engine';

// B1d §4.2 (C17, Q31, Q32, Q53–Q55): the wallet's own purchase on #21, #44 and #54 in the build with presale — its
// kind's words from the presale entry's slot, its record's own facts beside them (signature, explorer link, fee paid,
// B1b's same-bytes resend), Done back to #23 and [Try again] to #23 with the amount. Data that does not read back, or a
// kind no entry registers, stays generic (Q42): never words from partial data.
const SELECTORS = selectorsOf(UI_SHEETS);
const WIRE = signedWire(9n);
const SIGNATURE = firstSignature(WIRE);
/** B1d §2.3's display data, as Task 3's pendingData writes it (stage 0-indexed, every number a decimal string). */
const DATA = {currency: 'USDC', amount: '25000000', stage: '0', priceTicks: '1501', nocBase: '166555629580', spentCents: '2500', destination: 'DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3', referrer: null};
const EXTRA = {kind: 'presale-buy', data: DATA};
const AGAIN = {screen: 'presale', again: {currency: 'USDC', amount: '25000000', code: null, challengeId: null}};
const purchase = (over: Partial<PendingRecord> = {}): PendingRecord =>
  pendingRecord({id: 'b1', account: ACCOUNT.publicKey, signature: SIGNATURE, wire: base64.encode(WIRE), createdAt: Date.now(), lastSentAt: Date.now(), lastValidBlockHeight: 1150, intent: null, fee: {networkLamports: '11000', markupLamports: '0'}, extra: EXTRA, ...over});
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
  fee: {networkLamports: 11_000n, markupLamports: 0n},
  ...over,
});
const seed = (records: PendingRecord[]) => ({before: (ext: Wallet['ext']) => ext.local.set(PENDING_KEY, records)});
const nav = {onDone: vi.fn(), onDetails: vi.fn(), onActivity: vi.fn(), onTryAgain: vi.fn(), onEdit: vi.fn(), onRoute: vi.fn()};
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const meta = () => [...document.querySelectorAll('.meta-row')].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]);
const cardRows = (card: string) => [...document.querySelectorAll(`${card} .row`)].map(r => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
/** #21's amount card for the purchase as index.html #s21 draws a send's: eyebrow, figure + ticker, the dollar line — reading Q32. */
function expectCard() {
  expect(text('.amount-card .eyebrow')).toBe('Buying NOC with');
  expect(text('.amount-card .amount-line .amount')).toBe('25.00');
  expect(text('.amount-card .amount-line .ticker')).toBe('USDC');
  expect(text('.amount-card .noc-caption')).toBe('≈ $25.00 USD');
  expect(text('.amount-card')).toBe('Buying NOC with 25.00 USDC ≈ $25.00 USD');
}
const explorerLinks = () => document.querySelectorAll('a[href*="solscan.io"]').length;
/** None of B1b's send words, and no recipient as a send shows it. */
function expectNoSendWords() {
  const t = document.body.textContent ?? '';
  for (const v of ['Sending…', 'Sent successfully', 'the amount did not move', 'Recipient address']) expect([v, t.includes(v)]).toEqual([v, false]);
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('the record slot (§1.3, §4.2): words for a purchase whose data reads back, null for anything else', () => {
  it('a purchase: Q32 with the exact amount, Q31, the titles, Q55; Done → #23 (C17), [Try again] → #23 with the amount', () => {
    expect(PRESALE_SLOTS.record(EXTRA)).toEqual({
      line: 'Buying NOC with 25.00 USDC',
      badge: 'Presale',
      sending: 'Buying NOC…',
      sent: 'Purchased',
      sentOk: 'Purchase confirmed',
      rejectedSub: 'The presale program rejected the purchase. Only the network fee was charged; your payment did not move and no NOC was bought.',
      // Q33 (Task 6): #11's and #26's pending row.
      pending: 'Buying NOC · pending',
      slow: 'Buying NOC · taking longer than usual',
      amount: '25.00 USDC',
      to: 'Noctura presale',
      // Task 9: #21's card as drawn — Q32's lead as the eyebrow, the amount as the figure, the program's dollars.
      card: {lead: 'Buying NOC with', figure: '25.00', ticker: 'USDC', usd: '$25.00'},
      done: {screen: 'presale'},
      again: AGAIN,
    });
    expect(PRESALE_SLOTS.record({kind: 'presale-buy', data: {...DATA, currency: 'SOL', amount: '2000000000', destination: MAINNET_SOL_TREASURY}})?.line).toBe('Buying NOC with 2.0000 SOL');
  });

  it('another kind, or data that does not read back (each field), is null — the screens stay generic', () => {
    expect(PRESALE_SLOTS.record({kind: 'later-kind', data: DATA})).toBeNull();
    for (const data of [
      null,
      'x',
      {...DATA, currency: 'NOC'},
      {...DATA, amount: 25_000_000},
      {...DATA, amount: '-1'},
      {...DATA, stage: '10'},
      {...DATA, nocBase: '1.5'},
      {...DATA, destination: 'not-an-address'},
      {...DATA, referrer: 'x'},
      {...DATA, extra: '1'},
      (({spentCents, ...rest}) => rest)(DATA),
    ]) {
      expect(PRESALE_SLOTS.record({kind: 'presale-buy', data})).toBeNull();
    }
  });
});

describe('#21 for a purchase (§4.2, C17)', () => {
  const renderStatus = (records: PendingRecord[], over: Partial<{canRetry: boolean}> = {}) => renderInWallet(<Status account={ACCOUNT.publicKey} id="b1" since={0} canRetry {...nav} {...over} />, seed(records));

  it('broadcasting: Q53 as the title, the "Presale" badge beside the status, Q32’s words in the drawn amount card (eyebrow, figure, ticker, dollars) and the To row (Q10); B1b’s honest lines', async () => {
    await renderStatus([purchase()]);
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(text('.top-bar .title')).toBe('Buying NOC…');
    expect(text('.top-bar .status-pill')).toBe('Presale');
    expectCard();
    expect(meta()).toEqual([
      ['To', 'Noctura presale'],
      ['Status', STATUS_TEXT.statusBroadcasting],
    ]);
    expect(screen.getByText(STATUS_TEXT.canClose)).toBeTruthy();
    expectNoSendWords();
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });

  it('polled to confirmed: Q54 (title and line), the badge, the hash and the fee paid; Done → #23, not #11', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([purchase()]);
    await screen.findByText(STATUS_TEXT.broadcasting);
    await w.ext.local.set(PENDING_KEY, [purchase({state: 'confirmed'})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText('Purchase confirmed')).toBeTruthy();
    expect(text('.top-bar .title')).toBe('Purchased');
    expect(text('.top-bar .status-pill')).toBe('Presale');
    expect(text('.top-bar .step')).toBe(STATUS_TEXT.confirmed);
    expectCard();
    expect(meta()).toEqual([
      ['To', 'Noctura presale'],
      ['Tx hash', SIGNATURE],
      ['Fee paid', '0.000011 SOL'],
    ]);
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.done}));
    expect(nav.onRoute).toHaveBeenCalledWith({screen: 'presale'});
    expect(nav.onDone).not.toHaveBeenCalled();
    expectNoSendWords();
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });

  it('a purchase whose data does not read back: generic (Q42) — "Sending…", no badge, Done → #11 (negative control)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([purchase({extra: {kind: 'presale-buy', data: {...DATA, amount: 'x'}}})]);
    await screen.findByText(STATUS_TEXT.broadcasting);
    expect(text('.top-bar .title')).toBe(STATUS_TEXT.sending);
    expect(document.querySelector('.status-pill')).toBeNull();
    expect(text('.amount-card')).toBe('Transaction');
    await w.ext.local.set(PENDING_KEY, [purchase({state: 'confirmed', extra: {kind: 'presale-buy', data: {...DATA, amount: 'x'}}})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    fireEvent.click(await screen.findByRole('button', {name: STATUS_TEXT.done}));
    expect(nav.onDone).toHaveBeenCalledTimes(1);
    expect(nav.onRoute).not.toHaveBeenCalled();
  });

  it('a send keeps B1b’s #21 (positive control): its amount, its To row, no badge', async () => {
    await renderInWallet(<Status account={ACCOUNT.publicKey} id="s1" since={0} canRetry {...nav} />, seed([pendingRecord({id: 's1', account: ACCOUNT.publicKey, signature: SIGNATURE, createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}})]));
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(text('.top-bar .title')).toBe(STATUS_TEXT.sending);
    expect(document.querySelector('.status-pill')).toBeNull();
    expect(meta()[0]?.[0]).toBe('To');
  });
});

describe('#44 for a purchase (§4.2)', () => {
  const renderFailed = (p: Pending, canRetry = true) => renderInWallet(<Failed record={p} canRetry={canRetry} onTryAgain={nav.onTryAgain} onEdit={nav.onEdit} onDetails={nav.onDetails} onClose={nav.onDone} onRoute={nav.onRoute} />);

  it('rejected by the program: the reason meta keeps the program error without B1b’s send clause (Q55 says what moved); a detail without the clause as it is', async () => {
    const err = 'Landed but failed ({"InstructionError":[2,{"Custom":6023}]})';
    await renderFailed(view({state: 'failed', failure: 'landed', detail: `${err}: the network fee was paid, nothing was sent.`}));
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect(document.querySelector('.s9-reason-banner .meta')?.textContent).toBe(err);
    cleanup();
    await renderFailed(view({state: 'failed', failure: 'landed', detail: 'custom program error: 0x1770'}));
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect(document.querySelector('.s9-reason-banner .meta')?.textContent).toBe('custom program error: 0x1770');
  });

  it('rejected by the program (landed): Q32 under the head, Q55 (the fee paid, nothing bought); [Try again] → #23 with the amount, [View details]; the explorer link once', async () => {
    await renderFailed(view({state: 'failed', failure: 'landed', detail: 'custom program error: 0x1770'}));
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect([...document.querySelectorAll('.s9-fail-hero .sub')].map(e => e.textContent)).toEqual(['Buying NOC with 25.00 USDC', 'The presale program rejected the purchase. Only the network fee was charged; your payment did not move and no NOC was bought.']);
    expect(explorerLinks()).toBe(1);
    expect(document.querySelector('.s9-reason-banner a[href*="solscan.io"]')).not.toBeNull();
    expect([...document.querySelectorAll('.sticky-bar > *')].map(e => e.textContent)).toEqual([FAILED_TEXT.tryAgain, FAILED_TEXT.details]);
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.tryAgain}));
    expect(nav.onRoute).toHaveBeenCalledWith(AGAIN);
    expect(nav.onTryAgain).not.toHaveBeenCalled();
    expectNoSendWords();
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('blockhash expired: the kept payload is the purchase (To Q10, the amount) and its block height; no [Edit transaction], no "same recipient" footer; [Try again] and the back arrow → #23 with the amount; no explorer link', async () => {
    await renderFailed(view({state: 'expired', detail: 'Not confirmed — no funds moved.'}));
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    expect(cardRows('.s9-payload-card')).toEqual([
      ['To', 'Noctura presale'],
      ['Amount', '25.00 USDC'],
      ['Valid until block', '1150'],
    ]);
    expect(screen.queryByText(FAILED_TEXT.expiredFoot)).toBeNull();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.edit})).toBeNull();
    expect(explorerLinks()).toBe(0);
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.tryAgain}));
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onRoute.mock.calls).toEqual([[AGAIN], [AGAIN]]);
    expect(nav.onDone).not.toHaveBeenCalled();
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('not sent: [Try again] → #23 with the amount, in the explorer link’s place (one action, no second link)', async () => {
    await renderFailed(view({state: 'failed', failure: 'not-sent', detail: 'The route refused it.'}));
    expect(await screen.findByText(FAILED_TEXT.notSentHead)).toBeTruthy();
    expect(explorerLinks()).toBe(0);
    expect([...document.querySelectorAll('.sticky-bar > *')].map(e => e.textContent)).toEqual([FAILED_TEXT.tryAgain]);
  });

  it('another account selected (canRetry false): no [Try again]; the back arrow closes to #11', async () => {
    await renderFailed(view({state: 'expired'}), false);
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onDone).toHaveBeenCalledTimes(1);
    expect(nav.onRoute).not.toHaveBeenCalled();
  });
});

describe('#54 for a purchase (§4.2)', () => {
  const NOW = 1_000_000_094_000;
  const renderStuck = (p: Pending, canRetry = true) =>
    renderInWallet(<Stuck record={p} now={NOW} canRetry={canRetry} onClose={nav.onDone} onActivity={nav.onActivity} onTryAgain={nav.onTryAgain} onRoute={nav.onRoute} />, {
      ...seed([purchase({state: p.state, createdAt: p.createdAt, lastSentAt: p.lastSentAt})]),
      deps: {
        now: () => NOW,
        broadcast: async wire => firstSignature(wire),
      },
    });

  it('stuck: the original’s card — the "Presale" pill, Q32 as its amount, Q10 as its recipient, the hash and block height; Send again re-sends its own bytes', async () => {
    await renderStuck(view({state: 'stuck'}));
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    expect(text('.orig-card .pill')).toBe('Presale');
    expect(cardRows('.orig-card').map(([k, v]) => [k, k === 'Tx hash' ? 'hash' : v])).toEqual([
      ['Amount', 'Buying NOC with 25.00 USDC'],
      ['Recipient', 'Noctura presale'],
      ['Tx hash', 'hash'],
      ['Valid until block', '1150'],
    ]);
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.sentLine)).toBeTruthy();
  });

  it('expired: "…You can now make a new attempt." with its [Try again] → #23 with the amount (1a’s wording gap closed), and Done', async () => {
    await renderStuck(view({state: 'expired'}));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.tryAgain}));
    expect(nav.onRoute).toHaveBeenCalledWith(AGAIN);
    expect(screen.getByRole('button', {name: STUCK_TEXT.done})).toBeTruthy();
  });

  it('expired, another account selected: no [Try again] (the owner rule)', async () => {
    await renderStuck(view({state: 'expired'}), false);
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(screen.queryByRole('button', {name: STUCK_TEXT.tryAgain})).toBeNull();
  });
});

// B1d §4.5 (final review M6, R-B2): the banner slot shows only an `ok` answer — a refusal is no banner, even one whose
// reply carries a payload shaped like a banner (the engine passes a refusal's `data` through).
describe('#11’s banner slot', () => {
  const engineAnswering = (answer: unknown) => createEngine(async () => answer, async () => undefined);
  const BANNER = {stage: 0, priceTicks: '1501', stagePercent: 12};

  it('an ok answer is the banner (positive control); a refusal is null, whatever data it carries', async () => {
    expect(await PRESALE_SLOTS.banner(engineAnswering({ok: true, data: BANNER}))).toEqual({title: 'NOC Presale · Stage 1', line: '$ 0.1501 · 12% to next stage'});
    expect(await PRESALE_SLOTS.banner(engineAnswering({ok: false, error: 'locked', data: {...BANNER, priceTicks: 1501n}}))).toBeNull();
    expect(await PRESALE_SLOTS.banner(engineAnswering({ok: false, error: 'locked'}))).toBeNull();
  });
});
