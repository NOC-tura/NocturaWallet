// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {PublicKey} from '@solana/web3.js';
import {drainInFlight, renderInWallet, setupWallet, type Wallet} from '../../__tests__/harness';
import {WalletProvider} from '../../WalletContext';
import {Presale} from '../Presale';
import {PresaleConfirm} from '../PresaleConfirm';
import {PRESALE_ROUTE} from '../routes';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../../__tests__/styled';
import {registerPresale} from '../../../background/presale/api';
import {registerPresaleHandler} from '../../../background/messages';
import {satisfyChallenge} from '../../../background/reauthChallenges';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {RECIPIENT} from '../../../background/__tests__/fixtures';
import {ACCOUNT, allocationData, program, userData, type Chain} from '../../../background/presale/__tests__/chain';
import {derivePresalePdas} from '../../../../../core/presale/allocation';
import type {AccountData} from '../../../../../core/solana/rpc';
import {purchaseViewOf, type PurchaseView} from '../client';
import {BOUGHT_BEFORE, purchaseWorld, type PurchaseWorld} from './world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 3 (§3.5, §4.1, §4.2, C3, C32, D8; Q45–Q48): #23a's referral address and #20's "Referred by", against the
// REAL background — presale.view's referral, presale.checkReferrer on blur, presale.prepareBuy's intent.referrer, the
// purchase that registers it. The popup judges nothing: every line is what the background answered.
const SELECTORS = selectorsOf(UI_SHEETS);
/** The referral address (32 × 0x09): a presale buyer when the test gives it an allocation. */
const R = 'cGfHiC6Kgg3FpFZvgwGcswsCRtp4aBP2fzuXRQPizuN';
/** Another referrer (32 × 0x0a), registered on chain. */
const ON_CHAIN = 'gBxS1f6uyyGPuW5MzGBukidSb71jdsCb5fZaoSzULE5';
const allocationOf = (k: string): string => derivePresalePdas(new PublicKey(k)).userAllocation.toBase58();
const ALLOCATED: AccountData = program(allocationData({user: R, count: 1}));
/** An allocation that never bought (purchase_count 0): still a first purchase (C21). */
const neverBought = (o: Parameters<typeof allocationData>[0] = {}): Partial<Chain> => ({user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, ...o}))});
const Q45 = 'Referral address (optional)';
const Q46A = 'Not a valid Solana address';
const Q46B = "You can't refer yourself or another account in this wallet";
const Q46C = "This address has no presale allocation, so it can't receive a referral bonus";
const Q47 = "Saved to your presale account with this purchase. It can't be changed later.";
const Q48 = 'This account can no longer take a referrer — review again';

const nav = {onBack: vi.fn(), onDone: vi.fn(), onPrepared: vi.fn(), onRegion: vi.fn(), onGeo: vi.fn()};
const confirmNav = {onPresale: vi.fn(), onTrack: vi.fn(), onHome: vi.fn()};
const groups = (a: string) => (a.match(/.{1,4}/g) ?? []).join('');
const rows = () => [...document.querySelectorAll('.detail-grid .detail-row')].map(r => [...r.children].map(c => c.textContent));
const sent = (asked: unknown[], type: string) => asked.filter(m => (m as {type: string}).type === type);
const buyButton = () => document.querySelector<HTMLButtonElement>('.sticky-bar .btn-primary');
const field = (): HTMLInputElement | null => document.querySelector<HTMLInputElement>('#presale-referrer');
const theField = (): HTMLInputElement => {
  const f = field();
  if (f === null) throw new Error('no referral address field');
  return f;
};
const line = (): string | null => document.querySelector('.app-pre-referral .helper')?.textContent?.trim() ?? null;
const enter = (value: string) => fireEvent.change(theField(), {target: {value}});
const leave = () => fireEvent.blur(theField());
const amount = (value: string) => fireEvent.change(screen.getByLabelText('YOU PAY'), {target: {value}});
/** Every answer the background owes has landed and been rendered: the gate's release, the background's work, the screen's continuation. */
const landed = () =>
  act(async () => {
    await new Promise<void>(r => setTimeout(r, 0));
    await drainInFlight();
    await new Promise<void>(r => setTimeout(r, 0));
  });
/** The rule-6 lock is 500 ms. */
const settle = () => act(() => new Promise<void>(r => setTimeout(r, 600)));

/** The world, the referral address's allocation in its chain, and a gate that records every message and holds the ones `hold` names. */
function world(o: {chain?: Partial<Chain>; referrer?: AccountData | null} = {}) {
  const asked: unknown[] = [];
  const held: (() => void)[] = [];
  const hold = {type: null as string | null};
  const w = purchaseWorld({
    ...(o.chain === undefined ? {} : {chain: o.chain}),
    gate: m => {
      asked.push(m);
      if ((m as {type: string}).type === hold.type) return new Promise<void>(r => void held.push(r));
    },
  });
  w.chain.set(allocationOf(R), o.referrer === undefined ? ALLOCATED : o.referrer);
  w.chain.set(allocationOf(ON_CHAIN), program(allocationData({user: ON_CHAIN})));
  return {w, asked, held, hold};
}
async function show23(x: ReturnType<typeof world>) {
  await renderInWallet(<Presale {...nav} />, x.w.options);
  await screen.findByText('Stage 1 of 10 · live');
}
/** 2 SOL quoted: Buy is enabled exactly when nothing else holds it. */
async function quoted() {
  amount('2');
  await screen.findByText('Buy 2,643.83 NOC');
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('#23a: the referral address is offered only while it can take effect (§3.5, §4.1, D8)', () => {
  it('a first purchase with no referrer on chain: Q45’s label and placeholder, B1b’s single-line input between the receive card and the region link, no capitalising, correcting or spell-checking; no line; every class styled', async () => {
    await show23(world());
    const f = screen.getByLabelText(Q45) as HTMLInputElement;
    expect(f).toBe(field());
    expect(f.placeholder).toBe('Solana address of the person who invited you');
    expect(f.className).toBe('app-input noc-mono');
    expect([f.getAttribute('autocapitalize'), f.getAttribute('autocorrect'), f.getAttribute('spellcheck'), f.getAttribute('autocomplete')]).toEqual(['off', 'off', 'false', 'off']);
    expect(f.value).toBe('');
    const block = f.closest('.app-pre-referral');
    expect(block?.previousElementSibling?.className).toBe('input-card');
    expect(block?.nextElementSibling?.className).toBe('geo-link noc-body-sm');
    expect(line()).toBeNull();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('an allocation that never bought and holds a bonus: still offered — above the allocation row (the order of §4.1)', async () => {
    await show23(world({chain: neverBought({totalTokens: 8_787_475_016n, bonus: 8_787_475_016n})}));
    expect(field()?.closest('.app-pre-referral')?.nextElementSibling?.className).toBe('receipt');
    expect(screen.getByText('Your allocation')).toBeTruthy();
  });

  it('not offered: an account that bought before; an allocation with a referrer on chain, bought or not (an on-chain referrer always wins)', async () => {
    for (const chain of [BOUGHT_BEFORE, neverBought({referrer: ON_CHAIN}), {...BOUGHT_BEFORE, allocation: program(allocationData({referrer: ON_CHAIN}))}]) {
      await show23(world({chain}));
      expect(field()).toBeNull();
      expect(screen.queryByText(Q45)).toBeNull();
      cleanup();
    }
  });
});

describe('#23a: the line is the background’s answer on blur (§3.5, C3, Q46 a–c, Q48)', () => {
  it('typing asks nothing; blur asks presale.checkReferrer once with what the field holds; until it answers no line shows and Buy waits; then the background’s line, Buy disabled', async () => {
    const x = world();
    await show23(x);
    await quoted();
    x.hold.type = 'presale.checkReferrer';
    enter('not-an-address');
    expect(sent(x.asked, 'presale.checkReferrer')).toEqual([]);
    expect(buyButton()?.disabled).toBe(false);
    leave();
    expect(sent(x.asked, 'presale.checkReferrer')).toEqual([{type: 'presale.checkReferrer', account: ACCOUNT, referrer: 'not-an-address'}]);
    // Held: the popup has judged nothing — no line, and Buy waits for the answer.
    await landed();
    expect(line()).toBeNull();
    expect(buyButton()?.disabled).toBe(true);
    x.held.forEach(r => r());
    expect(await screen.findByText(Q46A)).toBeTruthy();
    expect(line()).toBe(Q46A);
    expect(theField().className).toBe('app-input noc-mono is-error');
    expect(buyButton()?.disabled).toBe(true);
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('each line from the background: Q46a, Q46b for this account and for another account of this wallet (only the background knows it), Q46c for an address with no allocation — Buy disabled while each shows', async () => {
    for (const [typed, referrer, want] of [
      ['x'.repeat(44), ALLOCATED, Q46A],
      [ACCOUNT, ALLOCATED, Q46B],
      [RECIPIENT, ALLOCATED, Q46B],
      [R, null, Q46C],
    ] as const) {
      const x = world({referrer});
      await show23(x);
      await quoted();
      enter(typed);
      leave();
      await screen.findByText(want);
      expect([typed, line(), buyButton()?.disabled]).toEqual([typed, want, true]);
      cleanup();
    }
  });

  it('an address the purchase would register: no line, Buy enabled (positive control); a blur on an empty field asks nothing', async () => {
    const x = world();
    await show23(x);
    await quoted();
    leave();
    expect(sent(x.asked, 'presale.checkReferrer')).toEqual([]);
    enter(R);
    leave();
    await waitFor(() => expect(sent(x.asked, 'presale.checkReferrer')).toHaveLength(1));
    await landed();
    expect(line()).toBeNull();
    expect(buyButton()?.disabled).toBe(false);
  });

  it('Q48 from the check — a purchase landed on chain since the view: the line, the view read again, then the field gone and Q48 said (never dropped in silence)', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter(R);
    x.w.chain.set(allocationOf(ACCOUNT), program(allocationData({count: 1})));
    x.w.chain.set(derivePresalePdas(new PublicKey(ACCOUNT)).userAccount.toBase58(), program(userData()));
    const views = sent(x.asked, 'presale.view').length;
    leave();
    // Q48 is said last (an effect after the re-read view removed the field), and the line under the field says it first:
    // wait on the banner itself, then the field is already gone (review 1 I1).
    await waitFor(() => expect(document.querySelector('.banner .banner-title')?.textContent).toBe(Q48));
    expect(field()).toBeNull();
    expect(sent(x.asked, 'presale.view').length).toBe(views + 1);
  });

  it('an edit clears the line; Buy is back with it', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter('abc');
    leave();
    expect(await screen.findByText(Q46A)).toBeTruthy();
    expect(buyButton()?.disabled).toBe(true);
    enter('abcd');
    expect(line()).toBeNull();
    expect(buyButton()?.disabled).toBe(false);
  });

  it('a stale answer never shows: an older check answering after a newer one, and an answer landing after an edit', async () => {
    const x = world();
    await show23(x);
    await quoted();
    x.hold.type = 'presale.checkReferrer';
    enter('abc');
    leave();
    enter(ACCOUNT);
    leave();
    await landed();
    expect(x.held).toHaveLength(2);
    const [older, newer] = x.held;
    newer?.();
    expect(await screen.findByText(Q46B)).toBeTruthy();
    older?.();
    await landed();
    expect(line()).toBe(Q46B);
    expect(screen.queryByText(Q46A)).toBeNull();
    // An answer for text the user has since edited (no blur after the edit): dropped.
    enter('abc');
    leave();
    enter('abcd');
    await landed();
    x.held.at(-1)?.();
    await landed();
    expect(line()).toBeNull();
    expect(buyButton()?.disabled).toBe(false);
  });
});

describe('#23a: what Buy sends (§3.5: refused, never dropped)', () => {
  it('an empty field is no referrer: B1d-1b’s intent exactly (no referrer key), the purchase registers nothing; spaces alone are empty too', async () => {
    for (const typed of ['', '   ']) {
      vi.clearAllMocks();
      const x = world();
      await show23(x);
      await quoted();
      if (typed !== '') {
        enter(typed);
        leave();
      }
      fireEvent.click(buyButton() as HTMLButtonElement);
      await settle();
      expect([typed, sent(x.asked, 'presale.checkReferrer')]).toEqual([typed, []]);
      expect([typed, sent(x.asked, 'presale.prepareBuy')]).toEqual([typed, [{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0}}]]);
      const [, view] = nav.onPrepared.mock.calls[0] as [string, PurchaseView];
      expect([typed, view.referrer, view.simulation.instructionCount]).toEqual([typed, null, 3]);
      cleanup();
    }
  });

  it('the field’s value travels in the intent: presale.prepareBuy carries it, and the purchase the background prepared registers it', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter(R);
    leave();
    await landed();
    fireEvent.click(buyButton() as HTMLButtonElement);
    await settle();
    expect(sent(x.asked, 'presale.prepareBuy')).toEqual([{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, referrer: R}}]);
    expect(nav.onPrepared).toHaveBeenCalledTimes(1);
    const [, view] = nav.onPrepared.mock.calls[0] as [string, PurchaseView];
    expect([view.referrer, view.simulation.instructionCount, view.reauth?.reasons.includes('first-purchase')]).toEqual([{address: R, registers: true}, 4, true]);
  });

  it('refused at prepare, never dropped — the purchase can no longer take it (bought since the check): nothing prepared, Q48, the view read again, the field gone', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter(R);
    leave();
    await landed();
    x.w.chain.set(allocationOf(ACCOUNT), program(allocationData({count: 1})));
    x.w.chain.set(derivePresalePdas(new PublicKey(ACCOUNT)).userAccount.toBase58(), program(userData()));
    const views = sent(x.asked, 'presale.view').length;
    fireEvent.click(buyButton() as HTMLButtonElement);
    // As above: the banner is the last thing written (review 1 I1).
    await waitFor(() => expect(document.querySelector('.banner .banner-title')?.textContent).toBe(Q48));
    expect(field()).toBeNull();
    expect(sent(x.asked, 'presale.prepareBuy')).toEqual([{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, referrer: R}}]);
    expect(nav.onPrepared).not.toHaveBeenCalled();
    expect(sent(x.asked, 'presale.view').length).toBe(views + 1);
  });

  it('refused at prepare — its allocation gone since the check: Q46c under the field, nothing prepared, Buy disabled until edited', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter(R);
    leave();
    await landed();
    x.w.chain.set(allocationOf(R), null);
    fireEvent.click(buyButton() as HTMLButtonElement);
    expect(await screen.findByText(Q46C)).toBeTruthy();
    expect(nav.onPrepared).not.toHaveBeenCalled();
    expect([line(), buyButton()?.disabled, field()?.value]).toEqual([Q46C, true, R]);
  });

  it('a check that fails (the presale unreadable) says so, shows no line and holds nothing: prepare decides again', async () => {
    const x = world();
    await show23(x);
    await quoted();
    x.w.chain.delete(allocationOf(R));
    enter(R);
    leave();
    expect(await screen.findByText('Presale unavailable — try again later.')).toBeTruthy();
    expect([line(), buyButton()?.disabled]).toEqual([null, false]);
  });
});

/** A purchase prepared through the real background, with the referral address when given — as #23's Buy asks it. */
async function prepared(wallet: Wallet, referrer?: string): Promise<PurchaseView> {
  const r = (await wallet.transport({type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, ...(referrer === undefined ? {} : {referrer})}})) as {ok: boolean; data?: unknown; error?: string};
  const view = r.ok ? purchaseViewOf(r.data) : undefined;
  if (view === undefined) throw new Error(`prepare refused: ${r.error ?? 'malformed'}`);
  return view;
}
async function show20(w: PurchaseWorld, referrer?: string, o: {prove?: boolean} = {}) {
  const wallet = await setupWallet(w.options);
  const view = await prepared(wallet, referrer);
  if (o.prove === true && view.reauth !== null) expect(await satisfyChallenge(wallet.ext, w.now(), view.reauth.challengeId)).toBe(true);
  render(
    <WalletProvider engine={wallet.engine} platform={wallet.platform} surface="popup" now={w.now}>
      <PresaleConfirm account={ACCOUNT} preparedId={view.id} {...confirmNav} />
    </WalletProvider>,
  );
  await screen.findByRole('button', {name: 'Buy NOC'});
  return {wallet, view};
}
const B1D1B_ROWS = ['You receive (est.)', 'Stage', 'Price', 'From', 'To', 'Network'];

describe('#20: “Referred by” (§4.2, Q47)', () => {
  it('a purchase that registers its referrer: “Referred by” after To, the whole address in groups of four, then Q47’s note; every class styled', async () => {
    const {w} = world();
    await show20(w, R);
    expect(rows().map(r => r[0])).toEqual(['You receive (est.)', 'Stage', 'Price', 'From', 'To', 'Referred by', 'Network']);
    expect(rows()[5]).toEqual(['Referred by', `${groups(R)}${Q47}`]);
    const spans = [...document.querySelectorAll('.detail-row:nth-child(6) .addr-groups > span')].map(s => s.textContent ?? '');
    expect(spans.join('')).toBe(R);
    expect(spans.slice(0, -1).every(s => s.length === 4)).toBe(true);
    expect(document.querySelector('.detail-row:nth-child(6) .app-pre-note')?.textContent).toBe(Q47);
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('a referrer on chain: no field on #23, and #20 shows that referrer without the note — nothing is registered', async () => {
    const chain = {...BOUGHT_BEFORE, allocation: program(allocationData({referrer: ON_CHAIN}))};
    const x = world({chain});
    await show23(x);
    expect(field()).toBeNull();
    cleanup();
    const {view} = await show20(world({chain}).w);
    expect(view.referrer).toEqual({address: ON_CHAIN, registers: false});
    expect(rows()[5]).toEqual(['Referred by', groups(ON_CHAIN)]);
    expect(document.querySelector('.app-pre-note')).toBeNull();
    expect(screen.queryByText(Q47)).toBeNull();
  });

  it('a purchase without a referrer looks exactly as in B1d-1b: no “Referred by”, no note', async () => {
    await show20(world().w);
    expect(rows().map(r => r[0])).toEqual(B1D1B_ROWS);
    expect(screen.queryByText('Referred by')).toBeNull();
    expect(screen.queryByText(Q47)).toBeNull();
  });
});

describe('#20 ↔ #23 keep the referral address (never dropped)', () => {
  it('the quote’s end: the re-prepare carries the referral address and the challenge — the fresh purchase registers it too', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const x = world();
    const {view} = await show20(x.w, R);
    const before = sent(x.asked, 'presale.prepareBuy').length;
    await act(async () => void vi.advanceTimersByTime(31_000));
    expect(await screen.findByText('Updated with a fresh network quote')).toBeTruthy();
    expect(sent(x.asked, 'presale.prepareBuy').slice(before)).toEqual([
      {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, referrer: R}, challengeId: view.reauth?.challengeId},
    ]);
    expect(rows()[5]).toEqual(['Referred by', `${groups(R)}${Q47}`]);
  });

  it('back → #23 with the address it registers; an on-chain referrer is not carried (it is no input)', async () => {
    const {view} = await show20(world().w, R);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(confirmNav.onPresale).toHaveBeenCalledWith({currency: 'SOL', amount: '2000000000', code: null, challengeId: view.reauth?.challengeId, referrer: R});
    cleanup();
    vi.clearAllMocks();
    const chain = {...BOUGHT_BEFORE, allocation: program(allocationData({referrer: ON_CHAIN}))};
    const onChain = await show20(world({chain}).w);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(confirmNav.onPresale).toHaveBeenCalledWith({currency: 'SOL', amount: '2000000000', code: null, challengeId: onChain.view.reauth?.challengeId ?? null});
  });

  it('refused at the signature — its allocation gone since the review: kept (C29), #23 with the address and the code; nothing signed', async () => {
    const x = world();
    await show20(x.w, R, {prove: true});
    x.w.chain.set(allocationOf(R), null);
    fireEvent.click(screen.getByRole('button', {name: 'Buy NOC'}));
    await waitFor(() => expect(confirmNav.onPresale).toHaveBeenCalledTimes(1));
    expect(confirmNav.onPresale.mock.calls[0]?.[0]).toMatchObject({code: 'referrer-no-allocation', referrer: R});
    expect(x.w.broadcasts).toEqual([]);
  });

  it('#23 again with the address and its refusal: the field holds it, the line under it, Buy disabled; a route naming a non-address is not #23', async () => {
    const x = world();
    const n = {pop: vi.fn(), home: vi.fn(), push: vi.fn(), replace: vi.fn(), reset: vi.fn()};
    const again = {currency: 'SOL', amount: '2000000000', code: 'referrer-no-allocation', challengeId: null, referrer: R} as const;
    expect(PRESALE_ROUTE.isRoute({screen: 'presale', again})).toBe(true);
    expect(PRESALE_ROUTE.isRoute({screen: 'presale', again: {...again, referrer: 'not-an-address'}})).toBe(false);
    expect(PRESALE_ROUTE.isRoute({screen: 'presale', again: {...again, referrer: null}})).toBe(false);
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale', again}, n)}</>, x.w.options);
    expect(await screen.findByText(Q46C)).toBeTruthy();
    expect([field()?.value, line()]).toEqual([R, Q46C]);
    await screen.findByText('Buy 2,643.83 NOC');
    expect(buyButton()?.disabled).toBe(true);
    // The address edited: the line goes.
    enter(RECIPIENT);
    expect(line()).toBeNull();
  });
});
