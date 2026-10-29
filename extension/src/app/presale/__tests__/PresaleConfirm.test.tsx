// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {base64} from '@scure/base';
import {renderInWallet, setupWallet, type Wallet} from '../../__tests__/harness';
import {STATE_POLL_MS, WalletProvider} from '../../WalletContext';
import {PresaleConfirm} from '../PresaleConfirm';
import {PRESALE_CONFIRM_ROUTE, PRESALE_ROUTE} from '../routes';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../../__tests__/styled';
import {registerPresale} from '../../../background/presale/api';
import {registerPresaleHandler} from '../../../background/messages';
import {satisfyChallenge} from '../../../background/reauthChallenges';
import {PENDING_KEY, type PendingRecord} from '../../../background/pendingStore';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {RECIPIENT, pendingRecord, signedWire} from '../../../background/__tests__/fixtures';
import {ACCOUNT, TREASURY_ADDRESS, USDC_VAULT, allocationData, configData, program} from '../../../background/presale/__tests__/chain';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {BOUGHT_BEFORE, preparePurchase, purchaseWorld, type PurchaseWorld} from './world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d §4.2 (C25, C29, C33, D38, rule 6): #20's purchase variant against the REAL background — the purchase prepared by
// presale.prepareBuy over chain.ts's program state and the honest simulation, signed by presale.buy through the shared
// pipeline, broadcast to the world's route. Every number on screen is the background's (these literals are what its
// prepare answered for this chain); the screen formats them.
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onPresale: vi.fn(), onTrack: vi.fn(), onHome: vi.fn()};
const groups = (a: string) => (a.match(/.{1,4}/g) ?? []).join('');
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const rows = (sel: string) => [...document.querySelectorAll(sel)].map(r => [...r.children].map(c => c.textContent));
const buyButton = () => screen.getByRole('button', {name: 'Buy NOC'}) as HTMLButtonElement;
const settle = () => act(() => new Promise<void>(r => setTimeout(r, 600)));
const sent = (asked: unknown[], type: string) => asked.filter(m => (m as {type: string}).type === type);
/** Boolean, with neutral messages (public CI logs): no date and no countdown on the screen (D5, owner rule). */
function expectNoTgeDate() {
  const t = document.body.textContent ?? '';
  expect(/\b(19|20)\d{2}\b/.test(t)).toBe(false);
  expect(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d/.test(t)).toBe(false);
}

/** The wallet, a purchase prepared in it, then #20 for it — a flow entry bound to that purchase, or a resume. */
async function confirmFor(w: PurchaseWorld, intent: {currency: 'SOL' | 'USDC' | 'USDT'; amount: string}, o: {entry?: 'flow' | 'resume'; prove?: boolean; preparedId?: string} = {}) {
  const wallet = await setupWallet(w.options);
  const view = await preparePurchase(wallet, intent);
  if (o.prove === true && view.reauth !== null) expect(await satisfyChallenge(wallet.ext, w.now(), view.reauth.challengeId)).toBe(true);
  const preparedId = o.entry === 'resume' ? null : (o.preparedId ?? view.id);
  render(
    <WalletProvider engine={wallet.engine} platform={wallet.platform} surface={w.options.surface ?? 'popup'} now={w.now}>
      <PresaleConfirm account={ACCOUNT} preparedId={preparedId} {...nav} />
    </WalletProvider>,
  );
  await screen.findByRole('button', {name: 'Buy NOC'});
  return {wallet, view};
}
const records = async (wallet: Wallet): Promise<PendingRecord[]> => ((await wallet.ext.local.get(PENDING_KEY)) as PendingRecord[] | undefined) ?? [];
const preparedFor = async (wallet: Wallet) => ((await wallet.transport({type: 'presale.preparedFor', account: ACCOUNT})) as {data: unknown}).data;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('#20 purchase variant: the rows (§4.2)', () => {
  it('a first SOL purchase: Q07, Q08, the payment and its value from the simulation’s cents, the NOC the simulation credits, stage, price, from, Q10 over the whole treasury, the fees with Q09, #19’s facts; Buy NOC, never focused', async () => {
    const w = purchaseWorld();
    await confirmFor(w, {currency: 'SOL', amount: '2000000000'});
    expect(text('.top-bar .title')).toBe('Confirm purchase');
    // No step counter: the purchase's flow is #23 → #20 (C33).
    expect(document.querySelector('.top-bar .step')).toBeNull();
    expect(text('.review-card .eyebrow')).toBe('You are about to buy');
    expect(text('.review-card .head .amount')).toBe('2.0000');
    expect(text('.review-card .head .ticker')).toBe('SOL');
    // spentCents 39 684: the program's own valuation of the payment (C36), not the popup's.
    expect(text('.review-card .fiat')).toBe('≈ $396.84 USD');
    expect(rows('.detail-grid .detail-row')).toEqual([
      ['You receive (est.)', '2,643.83 NOC'],
      ['Stage', '1 of 10'],
      ['Price', '$ 0.1501 / NOC'],
      ['From', `Main${groups(ACCOUNT)}`],
      ['To', `Noctura presale${groups(TREASURY_ADDRESS)}`],
      ['Network', "Solana mainnet · sent through Noctura's broadcast route"],
    ]);
    // The recipient whole, in groups of four, equal weight (B1's address rule).
    expect([...document.querySelectorAll('.detail-row:nth-child(5) .addr-groups > span')].map(s => s.textContent).join('')).toBe(TREASURY_ADDRESS);
    const [fees, simulation] = [...document.querySelectorAll('.fee-block')];
    expect(fees?.querySelector('h3')?.textContent).toBe('Fees');
    // The network fee less its priority part, the priority, the two accounts this purchase creates (rent from the
    // simulation, C11) — no Noctura fee (C25).
    expect([...(fees?.querySelectorAll('.fee-row') ?? [])].map(r => [...r.children].map(c => c.textContent))).toEqual([
      ['Network fee', '0.000005 SOL', '$0.0009'],
      ['Priority', '0.000006 SOL', '$0.0011'],
      ['Account setup (first purchase)', '0.00218948 SOL', '$0.43'],
      ['Total', '2.00220048 SOL', '$397.27'],
    ]);
    expect(simulation?.querySelector('h3')?.textContent).toBe('Simulation');
    expect([...(simulation?.querySelectorAll('.fee-row') ?? [])].map(r => [...r.children].map(c => c.textContent))).toEqual([['Simulated at slot 271 408 921'], ['Programs', 'Compute Budget · Noctura presale']]);
    expect(text('.app-quote')).toBe('Quote valid 30 s');
    // B1b's #20 chrome without what a purchase does not have: no first-send banner, no high-value banner (§3.4).
    expect(document.querySelector('.first-time-banner')).toBeNull();
    expect(document.querySelector('.high-value-banner')).toBeNull();
    expect(screen.queryByText(/Noctura fee/)).toBeNull();
    // A first purchase re-authenticates (D3): #10 opens in a tab.
    expect(text('.sticky-bar p')).toBe('Confirmation opens in a new tab.');
    expect(buyButton().disabled).toBe(false);
    expect(document.activeElement).not.toBe(buyButton());
    expectNoTgeDate();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('a USDC purchase from an account that bought before: no account-setup row (nothing created), the pinned vault ATA as the recipient, the total in both', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    await confirmFor(w, {currency: 'USDC', amount: '25000000'});
    expect(text('.review-card .head .amount')).toBe('25.00');
    expect(text('.review-card .head .ticker')).toBe('USDC');
    expect(text('.review-card .fiat')).toBe('≈ $25.00 USD');
    expect(rows('.detail-grid .detail-row').slice(0, 3)).toEqual([
      ['You receive (est.)', '166.55 NOC'],
      ['Stage', '1 of 10'],
      ['Price', '$ 0.1501 / NOC'],
    ]);
    expect(rows('.detail-grid .detail-row')[4]).toEqual(['To', `Noctura presale${groups(USDC_VAULT)}`]);
    expect([...(document.querySelector('.fee-block')?.querySelectorAll('.fee-row') ?? [])].map(r => r.firstElementChild?.textContent)).toEqual(['Network fee', 'Priority', 'Total']);
    expect(text('.fee-block .fee-row.total .val')).toBe('25.00 USDC + 0.000011 SOL');
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('no re-authentication: no #10 line under Buy (positive control for the line above)', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const {view} = await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    expect(view.reauth).toBeNull();
    expect(document.querySelector('.sticky-bar p')).toBeNull();
  });
});

describe('#20 purchase variant: Buy (rule 6, D38, C29)', () => {
  it('Buy → presale.buy once → the purchase signed, recorded and broadcast once; #21 tracks its record', async () => {
    const asked: unknown[] = [];
    const w = purchaseWorld({chain: BOUGHT_BEFORE, gate: m => void asked.push(m)});
    const {wallet, view} = await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    const before = w.now();
    fireEvent.click(buyButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(sent(asked, 'presale.buy')).toEqual([{type: 'presale.buy', id: view.id}]);
    expect(sent(asked, 'wallet.send')).toEqual([]);
    expect(w.broadcasts).toHaveLength(1);
    const [record] = await records(wallet);
    expect({kind: record?.extra?.kind, signature: record?.signature}).toEqual({kind: 'presale-buy', signature: firstSignature(w.broadcasts[0] as Uint8Array)});
    const [account, id, since] = nav.onTrack.mock.calls[0] as [string, string, number];
    expect({account, id}).toEqual({account: ACCOUNT, id: record?.id});
    expect(since).toBeGreaterThanOrEqual(before);
  });

  it('a double click signs once (LockedButton, 500 ms; the prepared entry is single-use)', async () => {
    const asked: unknown[] = [];
    const w = purchaseWorld({chain: BOUGHT_BEFORE, gate: m => void asked.push(m)});
    await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    const b = buyButton();
    fireEvent.click(b);
    // Rule 6: disabled on the tap itself, not only guarded behind it.
    expect(b.disabled).toBe(true);
    b.disabled = false;
    fireEvent.click(b);
    await settle();
    expect(sent(asked, 'presale.buy')).toHaveLength(1);
    expect(w.broadcasts).toHaveLength(1);
  });

  it('nothing is signed without the tap: 10 s on screen, no presale.buy', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const asked: unknown[] = [];
    const w = purchaseWorld({chain: BOUGHT_BEFORE, gate: m => void asked.push(m)});
    await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(sent(asked, 'presale.buy')).toEqual([]);
    expect(w.broadcasts).toEqual([]);
  });

  it('a first purchase: Buy opens #10 for its challenge in a tab and closes the popup — nothing signed', async () => {
    const asked: unknown[] = [];
    const w = purchaseWorld({gate: m => void asked.push(m)});
    const {wallet, view} = await confirmFor(w, {currency: 'SOL', amount: '2000000000'});
    fireEvent.click(buyButton());
    await waitFor(() => expect(wallet.platform.closed).toBe(1));
    expect(wallet.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${view.reauth?.challengeId}`]);
    expect(sent(asked, 'presale.buy')).toEqual([]);
    expect(w.broadcasts).toEqual([]);
  });

  it('in the UI tab, #10 opens in the same tab (navigate), the popup rule’s twin', async () => {
    const w = purchaseWorld({surface: 'tab'});
    const {wallet, view} = await confirmFor(w, {currency: 'SOL', amount: '2000000000'});
    expect(text('.sticky-bar p')).toBe('Confirmation opens in this tab.');
    fireEvent.click(buyButton());
    await waitFor(() => expect(wallet.platform.navigated).toHaveLength(1));
    expect(wallet.platform.navigated).toEqual([`unlock.html?mode=reauth&challenge=${view.reauth?.challengeId}`]);
    expect(wallet.platform.opened).toEqual([]);
  });

  it('the challenge proven (by #10, with the popup closed): Q58, and Buy signs at once — no second proof, #10 not opened', async () => {
    const w = purchaseWorld();
    const {wallet} = await confirmFor(w, {currency: 'SOL', amount: '2000000000'}, {prove: true});
    expect(screen.getByText('Confirmed. Review the fresh quote and buy.')).toBeTruthy();
    fireEvent.click(buyButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(wallet.platform.opened).toEqual([]);
    expect(w.broadcasts).toHaveLength(1);
  });

  it('proven from another surface after #20 read it: the tap reads once more and signs — still one tap', async () => {
    const w = purchaseWorld();
    const {wallet, view} = await confirmFor(w, {currency: 'SOL', amount: '2000000000'});
    expect(await satisfyChallenge(wallet.ext, w.now(), view.reauth?.challengeId ?? '')).toBe(true);
    fireEvent.click(buyButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(wallet.platform.opened).toEqual([]);
    expect(w.broadcasts).toHaveLength(1);
  });

  it('the purchase gone between the read and the tap (Cancel in another window): unknown-prepared, no record made — #23 with the amount; nothing signed', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const {wallet} = await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    await wallet.transport({type: 'presale.discardPrepared', account: ACCOUNT});
    fireEvent.click(buyButton());
    await waitFor(() => expect(nav.onPresale).toHaveBeenCalledWith({currency: 'SOL', amount: '100000000', code: null, challengeId: null}));
    expect(nav.onTrack).not.toHaveBeenCalled();
    expect(w.broadcasts).toEqual([]);
  });

  it('a transaction of this account open: Buy disabled with B1b’s pending line — and nothing is asked to sign', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const wallet = await setupWallet(w.options);
    const view = await preparePurchase(wallet, {currency: 'SOL', amount: '100000000'});
    await wallet.ext.local.set(PENDING_KEY, [pendingRecord({id: 's1', account: ACCOUNT, signature: firstSignature(signedWire(7n)), wire: base64.encode(signedWire(7n)), createdAt: w.now(), lastSentAt: w.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000'}})]);
    render(
      <WalletProvider engine={wallet.engine} platform={wallet.platform} surface="popup" now={w.now}>
        <PresaleConfirm account={ACCOUNT} preparedId={view.id} {...nav} />
      </WalletProvider>,
    );
    expect(await screen.findByText('A send from this account is still pending.')).toBeTruthy();
    expect(buyButton().disabled).toBe(true);
  });
});

describe('#20 purchase variant: the entries and the quote (§4.2; B1b’s C5, D39)', () => {
  it('a resume (a reopened popup): Q57 over whatever the background holds; a flow entry has no such line', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    await confirmFor(w, {currency: 'SOL', amount: '100000000'}, {entry: 'resume'});
    expect(screen.getByText('You have a purchase waiting.')).toBeTruthy();
  });

  it('a flow entry bound to another purchase than the one held (a prepare landed in between): #23, nothing shown or signed', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const wallet = await setupWallet(w.options);
    await preparePurchase(wallet, {currency: 'SOL', amount: '100000000'});
    render(
      <WalletProvider engine={wallet.engine} platform={wallet.platform} surface="popup" now={w.now}>
        <PresaleConfirm account={ACCOUNT} preparedId={'ab'.repeat(16)} {...nav} />
      </WalletProvider>,
    );
    await waitFor(() => expect(nav.onPresale).toHaveBeenCalledWith(null));
    expect(screen.queryByRole('button', {name: 'Buy NOC'})).toBeNull();
    expect(w.broadcasts).toEqual([]);
  });

  it('nothing prepared (gone with its challenge, discarded, a lock): #23', async () => {
    const w = purchaseWorld();
    const wallet = await setupWallet(w.options);
    render(
      <WalletProvider engine={wallet.engine} platform={wallet.platform} surface="popup" now={w.now}>
        <PresaleConfirm account={ACCOUNT} preparedId={null} {...nav} />
      </WalletProvider>,
    );
    await waitFor(() => expect(nav.onPresale).toHaveBeenCalledWith(null));
  });

  it('the quote’s end: one re-prepare by itself carrying the challenge (“Updated…”), then untouched “Quote expired” [Refresh]', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const asked: unknown[] = [];
    const w = purchaseWorld({gate: m => void asked.push(m)});
    const {view} = await confirmFor(w, {currency: 'SOL', amount: '2000000000'});
    expect(text('.app-quote')).toBe('Quote valid 30 s');
    await act(async () => void vi.advanceTimersByTime(31_000));
    expect(await screen.findByText('Updated with a fresh network quote')).toBeTruthy();
    expect(sent(asked, 'presale.prepareBuy')).toEqual([{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0}, challengeId: view.reauth?.challengeId}]);
    await act(async () => void vi.advanceTimersByTime(31_000));
    expect(await screen.findByText('Quote expired')).toBeTruthy();
    expect(screen.queryByText('Updated with a fresh network quote')).toBeNull();
    expect(buyButton().disabled).toBe(true);
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(sent(asked, 'presale.prepareBuy')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    await waitFor(() => expect(sent(asked, 'presale.prepareBuy')).toHaveLength(2));
    expect(await screen.findByText('Quote valid 30 s')).toBeTruthy();
  });
});

describe('#20 purchase variant: its exits (§4.2, §3.3, §5)', () => {
  it('Cancel → presale.discardPrepared, then a fresh #23; nothing left prepared', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const {wallet} = await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(nav.onPresale).toHaveBeenCalledWith(null));
    expect(await preparedFor(wallet)).toBeNull();
  });

  it('back and Esc → #23 with the amount kept and the challenge carried — the purchase kept (not a cancel)', async () => {
    const w = purchaseWorld();
    const {wallet, view} = await confirmFor(w, {currency: 'SOL', amount: '2000000000'});
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onPresale).toHaveBeenCalledWith({currency: 'SOL', amount: '2000000000', code: null, challengeId: view.reauth?.challengeId});
    expect(await preparedFor(wallet)).not.toBeNull();
    vi.clearAllMocks();
    await confirmFor(w, {currency: 'SOL', amount: '2000000000'});
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(nav.onPresale).toHaveBeenCalledTimes(1);
  });

  it('the gate closed since the review (geo-closed at signing): the purchase discarded, #23 (its view says why); nothing signed', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const {wallet} = await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    w.geo.answer = {open: false, reason: 'sanctioned', countryCode: 'KP'};
    fireEvent.click(buyButton());
    await waitFor(() => expect(nav.onPresale).toHaveBeenCalledWith(null));
    expect(await preparedFor(wallet)).toBeNull();
    expect(w.broadcasts).toEqual([]);
    expect(await records(wallet)).toEqual([]);
  });

  it('the sale closed since the review (presale-closed): discarded, #23', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const {wallet} = await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    w.chain.set([...w.chain.keys()][0] as string, program(configData({active: 0})));
    fireEvent.click(buyButton());
    await waitFor(() => expect(nav.onPresale).toHaveBeenCalledWith(null));
    expect(await preparedFor(wallet)).toBeNull();
    expect(w.broadcasts).toEqual([]);
  });

  it('the stage moved since the review (price-changed): kept (C29), #23 with the amount, Q15’s code and the challenge carried; nothing signed', async () => {
    const w = purchaseWorld();
    const {wallet, view} = await confirmFor(w, {currency: 'SOL', amount: '2000000000'}, {prove: true});
    w.chain.set([...w.chain.keys()][0] as string, program(configData({stage: 1, stageSold: 0n})));
    fireEvent.click(buyButton());
    await waitFor(() => expect(nav.onPresale).toHaveBeenCalledTimes(1));
    expect(nav.onPresale).toHaveBeenCalledWith({currency: 'SOL', amount: '2000000000', code: 'price-changed', challengeId: view.reauth?.challengeId});
    expect(await preparedFor(wallet)).not.toBeNull();
    expect(w.broadcasts).toEqual([]);
  });

  it('the account bought elsewhere since the review (state-changed): kept, #23 with Q43’s code', async () => {
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const {wallet} = await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    const allocation = [...w.chain.keys()][2] as string;
    w.chain.set(allocation, program(allocationData({count: 3})));
    fireEvent.click(buyButton());
    await waitFor(() => expect(nav.onPresale).toHaveBeenCalledWith({currency: 'SOL', amount: '100000000', code: 'state-changed', challengeId: null}));
    expect(await preparedFor(wallet)).not.toBeNull();
    expect(w.broadcasts).toEqual([]);
  });

  it('another account selected (in another window): #11 — never this purchase under another account; nothing signed', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const {wallet} = await confirmFor(w, {currency: 'SOL', amount: '100000000'});
    expect(nav.onHome).not.toHaveBeenCalled();
    expect((await wallet.engine.select(1)).ok).toBe(true);
    await act(async () => void vi.advanceTimersByTime(STATE_POLL_MS + 50));
    await waitFor(() => expect(nav.onHome).toHaveBeenCalled());
    expect(w.broadcasts).toEqual([]);
  });
});

describe('the routes (§4): `presale-confirm` and #23 again', () => {
  const navSpy = () => ({pop: vi.fn(), home: vi.fn(), push: vi.fn(), replace: vi.fn(), reset: vi.fn()});

  it('presale-confirm handles Esc itself; a flow entry reads the purchase #23 handed over; its exits are nav’s resets', async () => {
    expect(PRESALE_CONFIRM_ROUTE.ownEscape).toBe(true);
    expect(PRESALE_ROUTE.ownEscape).toBeUndefined();
    const w = purchaseWorld({chain: BOUGHT_BEFORE});
    const wallet = await setupWallet(w.options);
    const view = await preparePurchase(wallet, {currency: 'SOL', amount: '100000000'});
    const show = (n: ReturnType<typeof navSpy>) =>
      render(
        <WalletProvider engine={wallet.engine} platform={wallet.platform} surface="popup" now={w.now}>
          {PRESALE_CONFIRM_ROUTE.render({screen: 'presale-confirm', account: ACCOUNT, entry: 'flow', preparedId: view.id}, n)}
        </WalletProvider>,
      );
    const back = navSpy();
    show(back);
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}));
    expect(back.reset).toHaveBeenCalledWith([{screen: 'presale', again: {currency: 'SOL', amount: '100000000', code: null, challengeId: null}}]);
    cleanup();
    const buy = navSpy();
    show(buy);
    fireEvent.click(await screen.findByRole('button', {name: 'Buy NOC'}));
    await waitFor(() => expect(buy.reset).toHaveBeenCalledTimes(1));
    const [[status]] = buy.reset.mock.calls[0] as [[{screen: string; account: string; id: string; since: number}]];
    expect({screen: status.screen, account: status.account}).toEqual({screen: 'status', account: ACCOUNT});
    expect(status.id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('#23 again: the currency and amount in the field, the refusal’s notice (Q15), and the next Buy carries the challenge', async () => {
    const asked: unknown[] = [];
    const w = purchaseWorld({gate: m => void asked.push(m)});
    const n = navSpy();
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale', again: {currency: 'SOL', amount: '2000000000', code: 'price-changed', challengeId: 'ab'.repeat(16)}}, n)}</>, w.options);
    expect(await screen.findByText('Price changed — review again')).toBeTruthy();
    expect((screen.getByLabelText('YOU PAY') as HTMLInputElement).value).toBe('2');
    fireEvent.click(await screen.findByRole('button', {name: 'Buy 2,643.83 NOC'}));
    await waitFor(() => expect(sent(asked, 'presale.prepareBuy')).toHaveLength(1));
    expect(sent(asked, 'presale.prepareBuy')).toEqual([{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0}, challengeId: 'ab'.repeat(16)}]);
  });

  it('#23 again with a limit line (a limit that moved at signing): the line under the input, Buy disabled', async () => {
    const w = purchaseWorld();
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale', again: {currency: 'USDC', amount: '25000000', code: 'above-user-limit', challengeId: null}}, navSpy())}</>, w.options);
    expect(await screen.findByText(/^Above your presale limit — you can buy up to /)).toBeTruthy();
    expect((screen.getByLabelText('YOU PAY') as HTMLInputElement).value).toBe('25');
    expect(screen.getByRole('button', {name: 'Currency: USDC'})).toBeTruthy();
    expect((document.querySelector('.sticky-bar .btn-primary') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a fresh #23 carries no challenge (negative control for the carry)', async () => {
    const asked: unknown[] = [];
    const w = purchaseWorld({gate: m => void asked.push(m)});
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale'}, navSpy())}</>, w.options);
    fireEvent.change(await screen.findByLabelText('YOU PAY'), {target: {value: '2'}});
    fireEvent.click(await screen.findByRole('button', {name: 'Buy 2,643.83 NOC'}));
    await waitFor(() => expect(sent(asked, 'presale.prepareBuy')).toHaveLength(1));
    expect(sent(asked, 'presale.prepareBuy')[0]).not.toHaveProperty('challengeId');
  });
});
