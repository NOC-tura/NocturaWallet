// @vitest-environment happy-dom
import {useEffect, useState} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {base64} from '@scure/base';
import {drainInFlight, renderInWallet, setupWallet, type WalletOptions} from '../../__tests__/harness';
import {WalletProvider} from '../../WalletContext';
import {Presale} from '../Presale';
import {PRESALE_ROUTE} from '../routes';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../../__tests__/styled';
import {registerPresale} from '../../../background/presale/api';
import {registerPresaleHandler} from '../../../background/messages';
import {PENDING_KEY, type PendingRecord} from '../../../background/pendingStore';
import type {GeoAnswer} from '../../../background/geo/gate';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL, pendingRecord, signedWire} from '../../../background/__tests__/fixtures';
import {ACCOUNT, NOW_MS, TREASURY_ADDRESS, allocationData, chainMap, chainReader, configData, program, userData, type Chain} from '../../../background/presale/__tests__/chain';
import {honestSimulation} from '../../../background/presale/__tests__/simulation';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {RpcForbidden, type AccountData, type TokenAccountEntry} from '../../../../../core/solana/rpc';
import type {Prices} from '../../../../../core/portfolio/value';
import type {PurchaseView} from '../client';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d §4.1 (C3, C8, C17, C18, C30, C35, D5): #23 against the REAL background — handleMessage with the presale handlers,
// the program state from chain.ts's byte builders, the gate and the prices as deps — rendered in happy-dom. Every
// number on screen is the background's: these literals were computed by the background's own quote for this chain.
const SELECTORS = selectorsOf(UI_SHEETS);
const SOL_USD = 198.42;
const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
const holding = (pubkey: string, mint: string, amount: bigint): TokenAccountEntry => ({pubkey, mint, owner: ACCOUNT, amount, decimals: mint === MAINNET_NOC_MINT ? 9 : 6});
const USDC_SMALL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const HOLDINGS: TokenAccountEntry[] = [holding(USDC_SMALL, MAINNET_USDC_MINT, 30_000_000n), holding(HOLDING_LARGE, MAINNET_USDC_MINT, 50_000_000n), holding(HOLDING_SMALL, MAINNET_USDT_MINT, 7_000_000n)];

interface Calls {
  accounts: string[][];
  balance: number;
  tokens: number;
  prices: number;
  geo: number;
}
interface World {
  chain: Map<string, AccountData | null>;
  calls: Calls;
  wallet: {sol: bigint};
  geo: {answer: GeoAnswer};
  prices: {answer: () => Promise<Prices>};
  options: WalletOptions;
}
/** The chain, the wallet's SOL and holdings, the gate and the prices — each mutable mid-test (a stage that moves, a gate that closes). */
function world(o: {chain?: Partial<Chain>; sol?: bigint; geo?: GeoAnswer; prices?: () => Promise<Prices>; before?: WalletOptions['before']; gate?: WalletOptions['gate']; read?: () => Promise<never>} = {}): World {
  const calls: Calls = {accounts: [], balance: 0, tokens: 0, prices: 0, geo: 0};
  const chain = chainMap(o.chain);
  const wallet = {sol: o.sol ?? 12_482_100_000n};
  const geo = {answer: o.geo ?? OPEN};
  const prices = {answer: o.prices ?? (async (): Promise<Prices> => ({solana: SOL_USD, usdc: 1, usdt: 1}))};
  const reader = chainReader(chain, calls.accounts, {
    ...(o.read === undefined ? {} : {getAccountsData: o.read}),
    getBalance: async () => {
      calls.balance += 1;
      return wallet.sol;
    },
    getTokenAccountsByOwner: async (_owner, filter) => {
      calls.tokens += 1;
      return HOLDINGS.filter(h => !('mint' in filter) || h.mint === filter.mint);
    },
    getSignaturesForAddress: async () => [],
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    simulateTransaction: async (wire, opts) => honestSimulation(wire, opts?.accounts ?? [], chain, wallet.sol, HOLDINGS, SOL_USD),
  });
  const deps = {
    geo: async () => {
      calls.geo += 1;
      return geo.answer;
    },
    prices: async () => {
      calls.prices += 1;
      return prices.answer();
    },
    now: () => NOW_MS,
  };
  return {chain, calls, wallet, geo, prices, options: {reader, deps, ...(o.before === undefined ? {} : {before: o.before}), ...(o.gate === undefined ? {} : {gate: o.gate})}};
}
const nav = {onBack: vi.fn(), onDone: vi.fn(), onPrepared: vi.fn(), onRegion: vi.fn(), onGeo: vi.fn()};
const presale = () => <Presale {...nav} />;
const show = (w: World) => renderInWallet(presale(), w.options);
const requests = (c: Calls) => ({accounts: c.accounts.length, balance: c.balance, tokens: c.tokens, prices: c.prices, geo: c.geo});
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const buyButton = () => document.querySelector<HTMLButtonElement>('.sticky-bar .btn-primary');
const amountInput = () => screen.getByLabelText('YOU PAY') as HTMLInputElement;
const type = (value: string) => fireEvent.change(amountInput(), {target: {value}});
/** The rule-6 lock is 500 ms: a second Buy needs the button back. */
const settle = () => act(() => new Promise<void>(r => setTimeout(r, 600)));
/** Boolean, with neutral messages (public CI logs): no date and no countdown on the screen (D5, owner rule). */
function expectNoTgeDate() {
  const t = document.body.textContent ?? '';
  expect(/\b(19|20)\d{2}\b/.test(t)).toBe(false);
  expect(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d/.test(t)).toBe(false);
  expect(/\b(in|ends|claimable in)\s+~?\d+\s*(d|h|days?|hours?|weeks?|months?)\b/i.test(t)).toBe(false);
}
const SIGNATURE = firstSignature(signedWire(7n));
const DATA = {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '2643837441705', spentCents: '39684', destination: TREASURY_ADDRESS, referrer: null};
/** B1d §2.3: an open purchase of ACCOUNT in v1_pending. */
const purchase = (over: Partial<PendingRecord> = {}): PendingRecord =>
  pendingRecord({id: 'b1', account: ACCOUNT, signature: SIGNATURE, wire: base64.encode(signedWire(7n)), createdAt: Date.now(), lastSentAt: Date.now(), intent: null, fee: {networkLamports: '5050', markupLamports: '0'}, extra: {kind: 'presale-buy', data: DATA}, ...over});
const seed = (records: PendingRecord[]) => (ext: ReturnType<typeof fakeExt>) => ext.local.set(PENDING_KEY, records);

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('23a active (§4.1), as drawn', () => {
  it('the stage card, the pay and receive cards and the region link, every value the background’s; Buy NOC disabled with no amount; every class styled', async () => {
    await show(world());
    expect(await screen.findByText('Stage 1 of 10 · live')).toBeTruthy();
    expect(text('.top-bar .title.noc-h3')).toBe('NOC presale');
    expect(text('.stage-card .price .noc-balance-lg.noc-numeral')).toBe('$ 0.1501');
    expect(text('.stage-card .price .unit.noc-body-lg')).toBe('/ NOC');
    // 1 312 240.123… of 10 240 000 NOC sold: the fill floored to a hundredth of a percent, CSS only.
    expect(document.querySelector<HTMLElement>('.stage-card .progress > i')?.style.width).toBe('12.81%');
    expect([...document.querySelectorAll('.stage-card .meta .noc-caption')].map(e => e.textContent)).toEqual(['$ 196,967 raised', '10.24 M NOC stage cap', 'Next stage $ 0.1723']);
    expect(text('.input-card .lbl-row .noc-overline')).toBe('YOU PAY');
    expect([...document.querySelectorAll('.input-card .lbl-row')].map(e => e.textContent)).toEqual(['YOU PAYAvailable 12.4821 SOL', 'YOU RECEIVE (EST.)@ $ 0.1501 · 1 SOL ≈ $ 198.42']);
    expect(amountInput().getAttribute('inputmode')).toBe('decimal');
    expect(screen.getByRole('button', {name: 'Currency: SOL'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'MAX'})).toBeTruthy();
    expect(text('.input-card .est .noc-balance-md.noc-numeral')).toBe('—');
    expect(text('.geo-link')).toBe('Not available in your region?');
    expect(buyButton()?.textContent).toBe('Buy NOC');
    expect(buyButton()?.disabled).toBe(true);
    // No allocation yet: no row (positive control below).
    expect(screen.queryByText('Your allocation')).toBeNull();
    expect(document.querySelector('.helper')).toBeNull();
    expectNoTgeDate();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('typing asks the background: the estimate and the Buy label are its quote; Buy enabled with no line', async () => {
    await show(world());
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    expect(await screen.findByText('Buy 2,643.83 NOC')).toBeTruthy();
    expect(text('.input-card .est .noc-balance-md')).toBe('2,643.83');
    expect(buyButton()?.disabled).toBe(false);
    expect(document.querySelector('.helper')).toBeNull();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('empty or zero asks nothing and shows no line (the popup’s own {line: null}), Buy disabled', async () => {
    const asked: unknown[] = [];
    const w = world({gate: m => void asked.push(m)});
    await show(w);
    await screen.findByText('Stage 1 of 10 · live');
    type('0');
    await settle();
    expect(asked.filter(m => (m as {type: string}).type === 'presale.quote')).toEqual([]);
    expect(document.querySelector('.helper')).toBeNull();
    expect(buyButton()?.disabled).toBe(true);
    type('1');
    expect(await screen.findByText('Buy 1,321.91 NOC')).toBeTruthy();
    expect(asked.filter(m => (m as {type: string}).type === 'presale.quote')).toEqual([{type: 'presale.quote', account: ACCOUNT, currency: 'SOL', amount: '1000000000'}]);
  });

  it('below the minimum (the program’s, for every currency — D7): "Minimum $10" under the input, Buy disabled; at the minimum, none (positive control)', async () => {
    await show(world());
    await screen.findByText('Stage 1 of 10 · live');
    type('0.05');
    expect(await screen.findByText('Minimum $10')).toBeTruthy();
    expect(document.querySelector('.input-card .helper.error')?.textContent).toBe(' Minimum $10');
    expect(buyButton()?.disabled).toBe(true);
    type('0.0504');
    expect(await screen.findByText('Buy 66.62 NOC')).toBeTruthy();
    expect(document.querySelector('.helper')).toBeNull();
    expect(buyButton()?.disabled).toBe(false);
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('MAX: the background’s MAX in the field (fee bound, new-PDA rent bound and 890 880 kept — C9), its estimate, Buy enabled', async () => {
    await show(world());
    await screen.findByText('Stage 1 of 10 · live');
    fireEvent.click(screen.getByRole('button', {name: 'MAX'}));
    expect(await screen.findByText('Buy 16,491.93 NOC')).toBeTruthy();
    expect(amountInput().value).toBe('12.47580436');
    expect(buyButton()?.disabled).toBe(false);
  });

  it('a balance line: more SOL than the account holds → "Insufficient SOL balance"; 0.00089088 SOL left → Q41d', async () => {
    await show(world());
    await screen.findByText('Stage 1 of 10 · live');
    type('13');
    expect(await screen.findByText('Insufficient SOL balance')).toBeTruthy();
    expect(buyButton()?.disabled).toBe(true);
    // 12.4821 − 12.4766 SOL − the fee bound − the new-PDA rent bound leaves 95 240 lamports: below 890 880.
    type('12.4766');
    expect(await screen.findByText('Keep at least 0.00089088 SOL, or buy with less')).toBeTruthy();
  });

  it('no SOL price (C8): Q19 under the input for SOL, whatever the amount, Buy disabled; USDC still offered', async () => {
    await show(world({prices: async () => ({usdc: 1, usdt: 1})}));
    expect(await screen.findByText('SOL price unavailable — pay with USDC or USDT, or try again later.')).toBeTruthy();
    expect([...document.querySelectorAll('.input-card .lbl-row')].map(e => e.textContent)).toEqual(['YOU PAYAvailable 12.4821 SOL', 'YOU RECEIVE (EST.)@ $ 0.1501']);
    type('2');
    await settle();
    expect(screen.getByText('SOL price unavailable — pay with USDC or USDT, or try again later.')).toBeTruthy();
    expect(buyButton()?.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', {name: 'Currency: SOL'}));
    fireEvent.click(await screen.findByRole('button', {name: /USD Coin/}));
    await screen.findByRole('button', {name: 'Currency: USDC'});
    expect(await screen.findByText('50.00')).toBeTruthy();
    type('25');
    expect(await screen.findByText('Buy 166.55 NOC')).toBeTruthy();
    expect(screen.queryByText('SOL price unavailable — pay with USDC or USDT, or try again later.')).toBeNull();
  });
});

describe('the currency choice (C20): B1b’s token sheet limited to SOL, USDC and USDT', () => {
  it('lists the three, in order; USDC: its largest holding available, "@ $ 0.1501" alone, its own estimate', async () => {
    await show(world());
    await screen.findByText('Stage 1 of 10 · live');
    fireEvent.click(screen.getByRole('button', {name: 'Currency: SOL'}));
    await screen.findByRole('button', {name: /USD Coin/});
    expect([...document.querySelectorAll('.s8-sheet .app-token-row .sec')].map(e => e.textContent)).toEqual(['SOL', 'USDC', 'USDT']);
    fireEvent.click(screen.getByRole('button', {name: /USD Coin/}));
    expect(await screen.findByRole('button', {name: 'Currency: USDC'})).toBeTruthy();
    expect(await screen.findByText('50.00')).toBeTruthy();
    expect([...document.querySelectorAll('.input-card .lbl-row')].map(e => e.textContent)).toEqual(['YOU PAYAvailable 50.00 USDC', 'YOU RECEIVE (EST.)@ $ 0.1501']);
    type('25');
    expect(await screen.findByText('Buy 166.55 NOC')).toBeTruthy();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('USDC split across two accounts: Q41c with the largest; USDC below the minimum: Q40a — the same $10 as SOL (D7)', async () => {
    await show(world());
    await screen.findByText('Stage 1 of 10 · live');
    fireEvent.click(screen.getByRole('button', {name: 'Currency: SOL'}));
    fireEvent.click(await screen.findByRole('button', {name: /USD Coin/}));
    await screen.findByRole('button', {name: 'Currency: USDC'});
    type('60');
    expect(await screen.findByText('Your USDC is split across accounts — at most 50.00 USDC in one purchase')).toBeTruthy();
    type('9.99');
    expect(await screen.findByText('Minimum $10')).toBeTruthy();
    expect(buyButton()?.disabled).toBe(true);
  });

  it('a currency change asks a full view (C35) and clears the amount', async () => {
    const w = world();
    await show(w);
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    const before = requests(w.calls);
    fireEvent.click(screen.getByRole('button', {name: 'Currency: SOL'}));
    fireEvent.click(await screen.findByRole('button', {name: /Tether/}));
    await screen.findByRole('button', {name: 'Currency: USDT'});
    expect(await screen.findByText('7.00')).toBeTruthy();
    const after = requests(w.calls);
    expect({accounts: after.accounts - before.accounts, geo: after.geo - before.geo, balance: after.balance - before.balance, prices: after.prices - before.prices}).toEqual({accounts: 1, geo: 1, balance: 1, prices: 1});
    expect(amountInput().value).toBe('');
  });
});

describe('the allocation row (approved; D5)', () => {
  it('an allocation on chain: "Your allocation" · "<total> NOC" · "Claimable after TGE", in the receipt-row style', async () => {
    await show(world({chain: {user: program(userData()), allocation: program(allocationData())}}));
    expect(await screen.findByText('Your allocation')).toBeTruthy();
    const row = document.querySelector('.receipt .row');
    expect(row?.querySelector('.l.noc-body-sm')?.textContent).toBe('Your allocation');
    expect(row?.querySelector('.r .noc-body-sm.noc-numeral')?.textContent).toBe('1,998.66 NOC');
    expect(row?.querySelector('.r .noc-caption')?.textContent).toBe('Claimable after TGE');
    expectNoTgeDate();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('an allocation of 0 NOC, or none: no row', async () => {
    await show(world({chain: {user: program(userData()), allocation: program(allocationData({totalTokens: 0n, spent: 0n, count: 0}))}}));
    await screen.findByText('Stage 1 of 10 · live');
    expect(screen.queryByText('Your allocation')).toBeNull();
    expect(screen.queryByText('Claimable after TGE')).toBeNull();
  });
});

describe('23b pending (§4.1, C17, C30)', () => {
  it('an open purchase record: Order pending, Q05, Paid, Estimated NOC, Stage, the Tx hash, Q06, the explorer link, [Done] — no Order ID, no amount field, no Buy', async () => {
    await show(world({before: seed([purchase()])}));
    expect(await screen.findByText('Order pending')).toBeTruthy();
    expect(text('.pending-card .head .copy p.noc-body-sm')).toBe('Waiting for confirmation. Claimable after TGE.');
    expect([...document.querySelectorAll('.pending-card .row')].map(r => [r.querySelector('.l')?.textContent, r.querySelector('.r')?.textContent])).toEqual([
      ['Paid', '2.0000 SOL'],
      ['Estimated NOC', '2,643.83 NOC'],
      ['Stage', '1 of 10 · @ $ 0.1501'],
      ['Tx hash', `${SIGNATURE.slice(0, 4)}…${SIGNATURE.slice(-6)}`],
    ]);
    expect(document.querySelector('.pending-card .r.mono.noc-mono')?.getAttribute('title')).toBe(SIGNATURE);
    expect(text('.banner.info .noc-body-sm')).toBe('You can close the popup — Noctura keeps watching this purchase. Funds are non-refundable per presale terms.');
    const link = screen.getByRole('link', {name: 'View on Solana explorer'});
    expect(link.getAttribute('href')).toBe(`https://solscan.io/tx/${SIGNATURE}`);
    expect(screen.queryByText('Order ID')).toBeNull();
    expect(screen.queryByLabelText('YOU PAY')).toBeNull();
    expect(buyButton()).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Done'}));
    expect(nav.onDone).toHaveBeenCalledTimes(1);
    expectNoTgeDate();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('a stuck purchase is 23b too (C17: pending or stuck)', async () => {
    await show(world({before: seed([purchase({state: 'stuck'})])}));
    expect(await screen.findByText('Order pending')).toBeTruthy();
  });

  it('the gate no_check with an open record: 23b rendered, nothing hidden, the closed line beneath (C30) — a link to #50b, never a replacement (Task 6)', async () => {
    await show(world({geo: {open: false, reason: 'no_check', countryCode: null}, before: seed([purchase()])}));
    expect(await screen.findByText('Order pending')).toBeTruthy();
    const line = screen.getByRole('button', {name: 'Not available here — The region check is unavailable — try again later.'});
    expect(line.className).toBe('banner warning app-strip app-pre-region');
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(nav.onGeo).not.toHaveBeenCalled();
    fireEvent.click(line);
    expect(nav.onRegion).toHaveBeenCalledTimes(1);
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('the state unreadable with an open record: 23b, Q11 beneath', async () => {
    await show(
      world({
        before: seed([purchase()]),
        read: async () => {
          throw new Error('rpc down');
        },
      }),
    );
    expect(await screen.findByText('Order pending')).toBeTruthy();
    expect(screen.getByText('Presale unavailable — try again later.')).toBeTruthy();
  });

  it('another account’s record, a closed one, or a send: not 23b (positive control: 23a)', async () => {
    await show(world({before: seed([purchase({account: HOLDING_LARGE}), purchase({id: 'b2', state: 'confirmed'}), pendingRecord({id: 's1', account: ACCOUNT, state: 'pending'})])}));
    expect(await screen.findByText('Stage 1 of 10 · live')).toBeTruthy();
    expect(screen.queryByText('Order pending')).toBeNull();
  });

  it('23b reads its record every 6 s (no network); once it is no longer open, one full view: 23a with the allocation row', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const asked: string[] = [];
    const w = world({before: seed([purchase()]), gate: m => void asked.push((m as {type: string}).type)});
    const wallet = await show(w);
    await screen.findByText('Order pending');
    const reads = w.calls.accounts.length;
    // Review fix round 1, Important 1: a gate-only re-read (refresh: 'gate') would also bump `accounts` by one
    // (chain.ts's chainReader counts both a gate read and a full read the same way) without reading the balance —
    // this is the property C35 names ("once when 23b's record closes") and `accounts` alone cannot fail it.
    const fulls = w.calls.balance;
    await act(() => vi.advanceTimersByTimeAsync(6_000));
    expect(asked.filter(t => t === 'presale.pending').length).toBe(1);
    expect(w.calls.accounts.length).toBe(reads);
    expect(screen.getByText('Order pending')).toBeTruthy();
    // It confirms: the record closes, the allocation exists on chain.
    await wallet.ext.local.set(PENDING_KEY, [purchase({state: 'confirmed'})]);
    w.chain.set([...w.chain.keys()][1] as string, program(userData()));
    w.chain.set([...w.chain.keys()][2] as string, program(allocationData()));
    await act(() => vi.advanceTimersByTimeAsync(6_000));
    expect(await screen.findByText('Your allocation')).toBeTruthy();
    expect(screen.queryByText('Order pending')).toBeNull();
    expect(w.calls.accounts.length).toBe(reads + 1);
    // The one extra view is a FULL view (the balance re-read with it), not a gate-only one.
    expect(w.calls.balance).toBe(fulls + 1);
  });
});

describe('the closed answers (§4.1; #50b is Task 6)', () => {
  it('unavailable (the state unreadable): the title and Q11, no cards, no Buy', async () => {
    await show(
      world({
        read: async () => {
          throw new Error('rpc down');
        },
      }),
    );
    expect(await screen.findByText('Presale unavailable — try again later.')).toBeTruthy();
    expect(text('.top-bar .title')).toBe('NOC presale');
    expect(document.querySelector('.stage-card')).toBeNull();
    expect(document.querySelector('.input-card')).toBeNull();
    expect(buyButton()).toBeNull();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('refused (a 403): Q12, no Buy', async () => {
    await show(
      world({
        read: async () => {
          throw new RpcForbidden('getMultipleAccounts');
        },
      }),
    );
    expect(await screen.findByText('The presale service refused this network.')).toBeTruthy();
    expect(buyButton()).toBeNull();
  });

  it('inactive: the stage card as read, "Stage 1 of 10" without "· live", Q13, no Buy', async () => {
    await show(world({chain: {config: program(configData({active: 0}))}}));
    expect(await screen.findByText('The presale is not open.')).toBeTruthy();
    expect(text('.stage-card .eyebrow')).toBe(' Stage 1 of 10');
    expect(buyButton()).toBeNull();
    expect(document.querySelector('.input-card')).toBeNull();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('blocked: the stage card and Q14, no Buy', async () => {
    await show(world({chain: {user: program(userData({blocked: 1}))}}));
    expect(await screen.findByText("This account can't buy in the presale.")).toBeTruthy();
    expect(text('.stage-card .eyebrow')).toBe(' Stage 1 of 10 · live');
    expect(buyButton()).toBeNull();
  });

  it.each([
    ['sanctioned', 'KP', "Not available here — This wallet doesn't offer the presale in your region."],
    ['stale_list', 'SI', 'Not available here — The restricted-region list is out of date.'],
    ['unknown_country', null, 'Not available here — Your region could not be determined from your IP.'],
    ['no_check', null, 'Not available here — The region check is unavailable — try again later.'],
    ['refused', null, 'Not available here — The presale service refused this network.'],
  ] as const)('the gate closed (%s) with no open record: #23 is replaced by #50b (§4.1) — once, nothing of 23a drawn; with an open record the same reason is 23b’s link (positive control)', async (reason, countryCode, line) => {
    // As App draws it: a new onGeo on every render (the route's inline arrow); a focus re-renders and reads again.
    function Rerendering() {
      const [, setN] = useState(0);
      useEffect(() => {
        const f = () => setN(n => n + 1);
        window.addEventListener('focus', f);
        return () => window.removeEventListener('focus', f);
      }, []);
      return <Presale {...nav} onGeo={() => nav.onGeo()} />;
    }
    await renderInWallet(<Rerendering />, world({geo: {open: false, reason, countryCode}}).options);
    await vi.waitFor(() => expect(nav.onGeo).toHaveBeenCalledTimes(1));
    // The skeleton stays while #23 is replaced: no amount field, no stage of the answer.
    expect(screen.queryByLabelText('YOU PAY')).toBeNull();
    expect(document.querySelector('.stage-card[aria-busy="true"]')).not.toBeNull();
    expect(document.querySelector('.stage-card:not([aria-busy])')).toBeNull();
    expect(screen.queryByText(line)).toBeNull();
    expect(buyButton()?.disabled).toBe(true);
    // A focus re-renders with a new onGeo and asks a view again: the same answer does not replace twice.
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await act(() => drainInFlight());
    expect(nav.onGeo).toHaveBeenCalledTimes(1);
    cleanup();
    vi.clearAllMocks();
    await show(world({geo: {open: false, reason, countryCode}, before: seed([purchase()])}));
    expect(await screen.findByRole('button', {name: line})).toBeTruthy();
    expect(nav.onGeo).not.toHaveBeenCalled();
  });
});

describe('the request budget (C35, review 2 M3): five requests a view, two a re-read, none while hidden', () => {
  /** #23 alone in a quiet provider: the wallet's own open sequence reads nothing, so every request counted is #23's. */
  async function quiet(w: World) {
    const wallet = await setupWallet(w.options);
    render(
      <WalletProvider engine={wallet.engine} platform={wallet.platform} surface="popup" quiet>
        {presale()}
      </WalletProvider>,
    );
    await screen.findByText('Stage 1 of 10 · live');
    return wallet;
  }
  const setVisibility = (state: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state});
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
  };
  afterEach(() => setVisibility('visible'));

  it('mount: the snapshot, the gate, the SOL balance, the holdings and the price — five; each 25 s: the snapshot and the gate — two', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const asked: unknown[] = [];
    const w = world({gate: m => void asked.push(m)});
    await quiet(w);
    expect(requests(w.calls)).toEqual({accounts: 1, geo: 1, balance: 1, tokens: 1, prices: 1});
    // Review fix round 1, Minor 1: the POPUP's own first request carries no `refresh` — proves #23 itself asked a
    // full view on mount (not that the background upgraded a gate-only read because no `seen` entry existed yet,
    // which would pass the counts above too).
    expect(asked.filter(m => (m as {type: string}).type === 'presale.view')).toEqual([{type: 'presale.view', account: ACCOUNT}]);
    await act(() => vi.advanceTimersByTimeAsync(25_000));
    expect(requests(w.calls)).toEqual({accounts: 2, geo: 2, balance: 1, tokens: 1, prices: 1});
    await act(() => vi.advanceTimersByTimeAsync(25_000));
    expect(requests(w.calls)).toEqual({accounts: 3, geo: 3, balance: 1, tokens: 1, prices: 1});
  });

  it('hidden: no re-read at all; visible again: one full view, then the 25 s re-reads resume', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = world();
    await quiet(w);
    setVisibility('hidden');
    await act(() => vi.advanceTimersByTimeAsync(75_000));
    expect(requests(w.calls)).toEqual({accounts: 1, geo: 1, balance: 1, tokens: 1, prices: 1});
    setVisibility('visible');
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(requests(w.calls)).toEqual({accounts: 2, geo: 2, balance: 2, tokens: 2, prices: 2});
    await act(() => vi.advanceTimersByTimeAsync(25_000));
    expect(requests(w.calls)).toEqual({accounts: 3, geo: 3, balance: 2, tokens: 2, prices: 2});
  });

  it('focus asks a full view; typing asks quotes, which read nothing', async () => {
    const w = world();
    await quiet(w);
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    expect(requests(w.calls)).toEqual({accounts: 1, geo: 1, balance: 1, tokens: 1, prices: 1});
    act(() => void window.dispatchEvent(new Event('focus')));
    await act(() => new Promise<void>(r => setTimeout(r, 50)));
    expect(requests(w.calls)).toEqual({accounts: 2, geo: 2, balance: 2, tokens: 2, prices: 2});
  });

  it('23b does not re-read the view every 25 s (its record only, C30)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = world({before: seed([purchase()])});
    const wallet = await setupWallet(w.options);
    render(
      <WalletProvider engine={wallet.engine} platform={wallet.platform} surface="popup" quiet>
        {presale()}
      </WalletProvider>,
    );
    await screen.findByText('Order pending');
    // The mount's one full view (C30: the record first, then the same view as 23a's); after it, nothing for 50 s.
    expect(requests(w.calls)).toEqual({accounts: 1, geo: 1, balance: 1, tokens: 1, prices: 1});
    await act(() => vi.advanceTimersByTimeAsync(50_000));
    expect(requests(w.calls)).toEqual({accounts: 1, geo: 1, balance: 1, tokens: 1, prices: 1});
  });
});

describe('Buy (§3.3, rule 6): the background prepares; #23 hands its purchase on', () => {
  it('Buy → presale.prepareBuy with the amount and the stage the user saw → onPrepared with the background’s purchase', async () => {
    const asked: unknown[] = [];
    await show(world({gate: m => void asked.push(m)}));
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    fireEvent.click(buyButton() as HTMLButtonElement);
    await settle();
    expect(asked.filter(m => (m as {type: string}).type === 'presale.prepareBuy')).toEqual([{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0}}]);
    expect(nav.onPrepared).toHaveBeenCalledTimes(1);
    const [account, view] = nav.onPrepared.mock.calls[0] as [string, PurchaseView];
    expect(account).toBe(ACCOUNT);
    expect({currency: view.currency, amount: view.amount, stage: view.stage, nocBase: view.nocBase, spentCents: view.spentCents, destination: view.destination, reasons: view.reauth?.reasons}).toEqual({
      currency: 'SOL',
      amount: 2_000_000_000n,
      stage: 0,
      nocBase: 2_643_837_441_705n,
      spentCents: 39_684n,
      destination: TREASURY_ADDRESS,
      reasons: ['first-purchase', 'over-5-percent', 'over-usd-threshold'],
    });
    expect(view.id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('a double click prepares once (LockedButton, 500 ms)', async () => {
    const asked: unknown[] = [];
    await show(world({gate: m => void asked.push(m)}));
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    const b = buyButton() as HTMLButtonElement;
    fireEvent.click(b);
    b.disabled = false;
    fireEvent.click(b);
    await settle();
    expect(asked.filter(m => (m as {type: string}).type === 'presale.prepareBuy').length).toBe(1);
    expect(nav.onPrepared).toHaveBeenCalledTimes(1);
  });

  it('the stage moved since the view → Q15, the view read again (the new stage shown), nothing handed on', async () => {
    const w = world();
    await show(w);
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    w.chain.set([...w.chain.keys()][0] as string, program(configData({stage: 1, stageSold: 0n})));
    fireEvent.click(buyButton() as HTMLButtonElement);
    expect(await screen.findByText('Price changed — review again')).toBeTruthy();
    expect(await screen.findByText('Stage 2 of 10 · live')).toBeTruthy();
    expect(nav.onPrepared).not.toHaveBeenCalled();
  });

  it('the simulation refused by the program → Q16, nothing handed on; Buy stays offered', async () => {
    const w = world();
    const opts = w.options.reader;
    if (opts === undefined) throw new Error('no reader');
    w.options.reader = {...opts, simulateTransaction: async () => ({err: {InstructionError: [2, {Custom: 6001}]}, logs: [], unitsConsumed: 1, slot: 271_408_921, accounts: []})};
    await show(w);
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    fireEvent.click(buyButton() as HTMLButtonElement);
    expect(await screen.findByText('The purchase could not be simulated.')).toBeTruthy();
    expect(nav.onPrepared).not.toHaveBeenCalled();
    expect(buyButton()).not.toBeNull();
  });

  it('the gate closed since the view → geo-closed: the view read again, and #23 replaced by #50b; nothing handed on', async () => {
    const w = world();
    await show(w);
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    w.geo.answer = {open: false, reason: 'sanctioned', countryCode: 'KP'};
    fireEvent.click(buyButton() as HTMLButtonElement);
    await vi.waitFor(() => expect(nav.onGeo).toHaveBeenCalledTimes(1));
    expect(nav.onPrepared).not.toHaveBeenCalled();
  });

  it('the SOL balance fell since the view → the prepare’s own line under the input (insufficient-sol), no notice and no second view; Buy disabled until edited', async () => {
    const views: unknown[] = [];
    const w = world({gate: m => void ((m as {type: string}).type === 'presale.view' && views.push(m))});
    await show(w);
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    const viewed = views.length;
    w.wallet.sol = 1_000_000_000n;
    fireEvent.click(buyButton() as HTMLButtonElement);
    expect(await screen.findByText('Insufficient SOL balance')).toBeTruthy();
    await settle();
    expect(buyButton()?.disabled).toBe(true);
    // The line is the prepare's own answer: nothing else is shown, and the view is not read again for it.
    expect(document.querySelectorAll('.banner')).toHaveLength(0);
    expect(views.length).toBe(viewed);
    expect(nav.onPrepared).not.toHaveBeenCalled();
    type('0.5');
    expect(await screen.findByText('Buy 660.95 NOC')).toBeTruthy();
    expect(screen.queryByText('Insufficient SOL balance')).toBeNull();
  });

  it('a send of this account in flight → B1b’s pending line, the view read again; nothing handed on', async () => {
    const w = world();
    const wallet = await show(w);
    await screen.findByText('Stage 1 of 10 · live');
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    await wallet.ext.local.set(PENDING_KEY, [pendingRecord({id: 's1', account: ACCOUNT, state: 'pending'})]);
    fireEvent.click(buyButton() as HTMLButtonElement);
    expect(await screen.findByText('A send from this account is still pending. Wait until it confirms or expires.')).toBeTruthy();
    expect(nav.onPrepared).not.toHaveBeenCalled();
  });

  it('"Not available in your region?" → onRegion, even with an empty amount (design F)', async () => {
    await show(world());
    await screen.findByText('Stage 1 of 10 · live');
    fireEvent.click(screen.getByRole('button', {name: 'Not available in your region?'}));
    expect(nav.onRegion).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onBack).toHaveBeenCalledTimes(1);
  });
});

describe('the route (§4): `presale`, carrying nothing; its exits are nav’s', () => {
  const navSpy = () => ({pop: vi.fn(), home: vi.fn(), push: vi.fn(), replace: vi.fn(), reset: vi.fn()});

  it('exactly {screen: "presale"}', () => {
    expect(PRESALE_ROUTE.screen).toBe('presale');
    expect(PRESALE_ROUTE.isRoute({screen: 'presale'})).toBe(true);
    expect(PRESALE_ROUTE.isRoute({screen: 'presale', account: ACCOUNT})).toBe(false);
    expect(PRESALE_ROUTE.isRoute({screen: 'geo'})).toBe(false);
  });

  it('back → pop; the region link → #50b (`geo`); Buy → #20’s purchase variant with the prepared id (`presale-confirm`, `flow`)', async () => {
    const nav = navSpy();
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale'}, nav)}</>, world().options);
    await screen.findByText('Stage 1 of 10 · live');
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.pop).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', {name: 'Not available in your region?'}));
    expect(nav.push).toHaveBeenCalledWith({screen: 'geo'});
    type('2');
    await screen.findByText('Buy 2,643.83 NOC');
    fireEvent.click(buyButton() as HTMLButtonElement);
    await settle();
    expect(nav.push).toHaveBeenCalledTimes(2);
    const route = nav.push.mock.calls[1]?.[0] as {screen: string; account: string; entry: string; preparedId: string};
    expect({screen: route.screen, account: route.account, entry: route.entry}).toEqual({screen: 'presale-confirm', account: ACCOUNT, entry: 'flow'});
    expect(route.preparedId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('the gate’s closed answer with no open record → #23 replaced by #50b (`nav.replace`, never a push); 23b’s region line → #50b pushed over #23', async () => {
    const nav = navSpy();
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale'}, nav)}</>, world({geo: {open: false, reason: 'stale_list', countryCode: 'SI'}}).options);
    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith({screen: 'geo'}));
    expect(nav.push).not.toHaveBeenCalled();
    cleanup();
    const n = navSpy();
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale'}, n)}</>, world({geo: {open: false, reason: 'stale_list', countryCode: 'SI'}, before: seed([purchase()])}).options);
    fireEvent.click(await screen.findByRole('button', {name: 'Not available here — The restricted-region list is out of date.'}));
    expect(n.push).toHaveBeenCalledWith({screen: 'geo'});
    expect(n.replace).not.toHaveBeenCalled();
  });

  it('23b’s [Done] → home (#11)', async () => {
    const nav = navSpy();
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale'}, nav)}</>, world({before: seed([purchase()])}).options);
    await screen.findByText('Order pending');
    fireEvent.click(screen.getByRole('button', {name: 'Done'}));
    expect(nav.home).toHaveBeenCalledTimes(1);
  });
});
