// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {base64} from '@scure/base';
import {renderApp} from './appHarness';
import {drainInFlight, renderInWallet} from './harness';
import {Home} from '../screens/Home';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {registerPresale} from '../../background/presale/api';
import {registerPresaleHandler} from '../../background/messages';
import {PENDING_KEY} from '../../background/pendingStore';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {pendingRecord, signedWire} from '../../background/__tests__/fixtures';
import {ACCOUNT, TREASURY_ADDRESS, configData, program, userData} from '../../background/presale/__tests__/chain';
import {purchaseWorld, type PurchaseWorld} from '../presale/__tests__/world';
import {firstSignature} from '../../../../core/solana/broadcast';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d §4.5 (C30; §9's #11 row): #11's presale banner and Buy quick action in the whole App against the REAL background —
// the program state from chain.ts, the gate as a dep. The banner is `presale.banner`'s (no geo check; null on any failure
// or an inactive sale); Buy asks `presale.view` and goes where it says: an open purchase or an open sale → #23, the gate
// closed → #50b, anything else → nowhere, the action hidden. #50b's [Got it] goes back to its trigger. This file runs in
// both vitest runs: the build without presale shows none of it and sends no presale message (§1.1, D2).
const off = process.env.NOCTURA_PRESALE === '0';
const SELECTORS = selectorsOf(UI_SHEETS);
const BANNER = {title: 'NOC Presale · Stage 1', line: '$ 0.1501 · 12% to next stage'};
const SANCTIONED = {open: false, reason: 'sanctioned', countryCode: 'KP'} as const;
const quick = () => [...document.querySelectorAll('.s-dash .quick .qa .lbl')].map(e => e.textContent);
const buyAction = () => [...document.querySelectorAll<HTMLButtonElement>('.s-dash .quick .qa')].find(b => b.textContent === 'Buy') ?? null;
const banner = () => document.querySelector<HTMLButtonElement>('.s-dash button.presale');
const types = (sent: unknown[]) => sent.map(m => (m as {type: string}).type);
/** Every engine call the screen made has answered, and React has rendered what they answered. */
const settled = () => act(() => drainInFlight());
/** The App over this world, and every message it sent (`seen` sees each one before the background does). */
async function app(w: PurchaseWorld, seen?: (m: unknown) => void) {
  const sent: unknown[] = [];
  const wallet = await renderApp({
    ...w.options,
    spy: m => {
      sent.push(m);
      seen?.(m);
    },
  });
  return {wallet, sent};
}
const SIGNATURE = firstSignature(signedWire(7n));
const DATA = {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '2643837441705', spentCents: '39684', destination: TREASURY_ADDRESS, referrer: null};
const openPurchase = () =>
  pendingRecord({id: 'b1', account: ACCOUNT, signature: SIGNATURE, wire: base64.encode(signedWire(7n)), createdAt: Date.now(), lastSentAt: Date.now(), intent: null, fee: {networkLamports: '5050', markupLamports: '0'}, extra: {kind: 'presale-buy', data: DATA}});
const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', {value, configurable: true});

afterEach(() => {
  setOnline(true);
  vi.clearAllMocks();
});

describe(`#11 in this build (${off ? 'off' : 'on'})`, () => {
  it(off ? 'off: no banner and no Buy — Send and Receive only — and no presale message, over a chain the on build shows them for' : 'on: the banner and Buy over the same chain (positive control of the off run)', async () => {
    const {sent} = await app(purchaseWorld());
    await screen.findByText('TOKENS');
    await settled();
    if (off) {
      expect(quick()).toEqual(['Send', 'Receive']);
      expect(banner()).toBeNull();
      expect(screen.queryByText(BANNER.title)).toBeNull();
      expect(types(sent).filter(t => t.startsWith('presale.'))).toEqual([]);
    } else {
      expect(await screen.findByText(BANNER.title)).toBeTruthy();
      expect(quick()).toEqual(['Send', 'Receive', 'Buy']);
      // The banner reads no gate (§1.4): #11's mount sends presale.banner, and no presale.view until Buy is tapped.
      expect(types(sent).filter(t => t.startsWith('presale.')).sort()).toEqual(['presale.banner', 'presale.preparedFor']);
    }
  });
});

describe.skipIf(off)('#11’s banner and Buy (§4.5)', () => {
  it('as drawn: the banner below the tokens ("NOC Presale · Stage N" / "$ price · P% to next stage", P floored), Buy third after Send and Receive; every class styled', async () => {
    await app(purchaseWorld());
    expect(await screen.findByText(BANNER.title)).toBeTruthy();
    expect(document.querySelector('.s-dash .tokens + button.presale')).toBe(banner());
    expect([...(banner()?.querySelectorAll('.copy > span') ?? [])].map(e => [e.className, e.textContent])).toEqual([
      ['noc-body-lg', BANNER.title],
      ['sm noc-body-sm noc-numeral', BANNER.line],
    ]);
    expect(banner()?.querySelector('.ic svg')).not.toBeNull();
    expect(quick()).toEqual(['Send', 'Receive', 'Buy']);
    expect(buyAction()?.disabled).toBe(false);
    expect(unstyledClasses(banner()!, SELECTORS)).toEqual([]);
    expect(unstyledClasses(document.querySelector('.s-dash .quick')!, SELECTORS)).toEqual([]);
  });

  it('Buy asks presale.view and, the sale open, opens #23 — whose own mount asks again (two views)', async () => {
    const {sent} = await app(purchaseWorld());
    await screen.findByText(BANNER.title);
    expect(types(sent).filter(t => t === 'presale.view')).toEqual([]);
    fireEvent.click(buyAction()!);
    expect(await screen.findByText('Stage 1 of 10 · live')).toBeTruthy();
    expect(document.querySelector('.top-bar .title')?.textContent).toBe('NOC presale');
    await settled();
    expect(types(sent).filter(t => t === 'presale.view')).toEqual(['presale.view', 'presale.view']);
  });

  it('the banner’s tap is Buy’s routing (→ #23)', async () => {
    await app(purchaseWorld());
    await screen.findByText(BANNER.title);
    fireEvent.click(banner()!);
    expect(await screen.findByText('Stage 1 of 10 · live')).toBeTruthy();
  });

  it('the gate closed → #50b at once (never #23: two views — Buy’s and #50b’s mount); [Got it] → #11, Buy and the banner still there', async () => {
    const w = purchaseWorld();
    w.geo.answer = SANCTIONED;
    const {sent} = await app(w);
    await screen.findByText(BANNER.title);
    fireEvent.click(buyAction()!);
    expect(await screen.findByText("NOC presale isn't open in your region")).toBeTruthy();
    await settled();
    expect(types(sent).filter(t => t === 'presale.view')).toEqual(['presale.view', 'presale.view']);
    expect(screen.queryByText('Stage 1 of 10 · live')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Got it'}));
    expect(await screen.findByText(BANNER.title)).toBeTruthy();
    expect(quick()).toEqual(['Send', 'Receive', 'Buy']);
  });

  it('#23’s "Not available in your region?" → #50b over #23 (the open variant, Q20); [Got it] → #23 again; ✕ → #11', async () => {
    await app(purchaseWorld());
    await screen.findByText(BANNER.title);
    fireEvent.click(buyAction()!);
    await screen.findByText('Stage 1 of 10 · live');
    fireEvent.click(screen.getByRole('button', {name: 'Not available in your region?'}));
    expect(await screen.findByText('NOC presale is open in your region')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Got it'}));
    expect(await screen.findByText('Stage 1 of 10 · live')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Not available in your region?'}));
    await screen.findByText('NOC presale is open in your region');
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(await screen.findByText(BANNER.title)).toBeTruthy();
    expect(screen.queryByText('Stage 1 of 10 · live')).toBeNull();
  });

  it('the gate closes between Buy’s view and #23’s: #23 is replaced by #50b (§4.1); [Got it] → #11, not #23', async () => {
    let views = 0;
    const w = purchaseWorld();
    await app(w, m => {
      if ((m as {type: string}).type === 'presale.view' && ++views === 2) w.geo.answer = SANCTIONED;
    });
    await screen.findByText(BANNER.title);
    fireEvent.click(buyAction()!);
    expect(await screen.findByText("NOC presale isn't open in your region")).toBeTruthy();
    expect(views).toBe(3);
    fireEvent.click(screen.getByRole('button', {name: 'Got it'}));
    expect(await screen.findByText(BANNER.title)).toBeTruthy();
    expect(screen.queryByText('Not available here')).toBeNull();
    expect(document.querySelector('.s-pre')).toBeNull();
  });

  it('an open purchase → #23 (23b) whatever the gate says (C30)', async () => {
    const w = purchaseWorld({before: ext => ext.local.set(PENDING_KEY, [openPurchase()])});
    w.geo.answer = SANCTIONED;
    await app(w);
    await screen.findByText(BANNER.title);
    fireEvent.click(buyAction()!);
    expect(await screen.findByText('Order pending')).toBeTruthy();
  });

  it('no route (a blocked account): Buy and the banner hide, #11 stays; the next banner read (a focus) brings them back', async () => {
    await app(purchaseWorld({chain: {user: program(userData({blocked: 1}))}}));
    await screen.findByText(BANNER.title);
    fireEvent.click(buyAction()!);
    await settled();
    expect(buyAction()).toBeNull();
    expect(banner()).toBeNull();
    expect(quick()).toEqual(['Send', 'Receive']);
    expect(document.querySelector('.s-dash')).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(await screen.findByText(BANNER.title)).toBeTruthy();
    expect(quick()).toEqual(['Send', 'Receive', 'Buy']);
  });

  it.each([
    ['a 403', {read: true}],
    ['a malformed config (369 bytes)', {chain: {config: program(configData({length: 369}))}}],
    ['an inactive sale', {chain: {config: program(configData({active: 0}))}}],
  ] as const)('presale.banner null — %s: no banner, no Buy; #11 otherwise as always', async (_name, o) => {
    const w = purchaseWorld('chain' in o ? {chain: o.chain} : {});
    const reader =
      'read' in o
        ? {
            ...w.options.reader!,
            getAccountsData: async () => {
              throw new RpcForbidden('403');
            },
          }
        : w.options.reader!;
    await renderApp({...w.options, reader});
    await screen.findByText('TOKENS');
    await settled();
    expect(banner()).toBeNull();
    expect(buyAction()).toBeNull();
    expect(quick()).toEqual(['Send', 'Receive']);
  });

  it('offline: Buy and the banner disabled, as Send (B1b D36); Receive stays', async () => {
    setOnline(false);
    const w = purchaseWorld();
    const reader = {
      ...w.options.reader!,
      getBalance: async () => {
        throw new RequestUnreachable('u', 'offline');
      },
    };
    await renderApp({...w.options, reader});
    expect(await screen.findByText("You're offline")).toBeTruthy();
    await screen.findByText(BANNER.title);
    expect(buyAction()?.disabled).toBe(true);
    expect(banner()?.disabled).toBe(true);
    expect([...document.querySelectorAll<HTMLButtonElement>('.s-dash .quick .qa')].map(b => [b.textContent, b.disabled])).toEqual([
      ['Send', true],
      ['Receive', false],
      ['Buy', true],
    ]);
  });

  it('a tap whose view answers after #11 is gone routes nowhere; the same tap while #11 is shown routes (positive control)', async () => {
    const onRoute = vi.fn();
    let hold = false;
    let release: () => void = () => undefined;
    const w = purchaseWorld({gate: m => ((m as {type: string}).type === 'presale.view' && hold ? new Promise<void>(r => (release = r)) : undefined)});
    const home = () => <Home onSend={() => undefined} onReceive={() => undefined} onPending={() => undefined} onAccounts={() => undefined} onRoute={onRoute} />;
    await renderInWallet(home(), w.options);
    await screen.findByText(BANNER.title);
    fireEvent.click(buyAction()!);
    await vi.waitFor(() => expect(onRoute).toHaveBeenCalledWith({screen: 'presale'}));
    cleanup();
    onRoute.mockClear();
    hold = true;
    await renderInWallet(home(), w.options);
    await screen.findByText(BANNER.title);
    fireEvent.click(buyAction()!);
    cleanup();
    release();
    await act(() => drainInFlight());
    expect(onRoute).not.toHaveBeenCalled();
  });
});
