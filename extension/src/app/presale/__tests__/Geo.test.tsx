// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {base64} from '@scure/base';
import {renderInWallet} from '../../__tests__/harness';
import {Geo} from '../Geo';
import {GEO_ROUTE} from '../routes';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../../__tests__/styled';
import {registerPresale} from '../../../background/presale/api';
import {registerPresaleHandler} from '../../../background/messages';
import {PENDING_KEY} from '../../../background/pendingStore';
import type {GeoAnswer} from '../../../background/geo/gate';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {pendingRecord, signedWire} from '../../../background/__tests__/fixtures';
import {ACCOUNT, TREASURY_ADDRESS, configData, program, userData} from '../../../background/presale/__tests__/chain';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {purchaseWorld} from './world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d §4.3 (C3, C12, C18; §9's #50b rows; Q20–Q30): #50b against the REAL background — presale.view over chain.ts's
// program state with the gate's answer as a dep. Every reason as §4.3's table words it, the region card only where it
// names a country, and nothing §9 omits ("claim_ix", staking, the post-TGE claim line, a date).
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onBack: vi.fn(), onClose: vi.fn(), onDone: vi.fn()};
const Q = {
  q20: 'NOC presale is open in your region',
  sanctioned: "NOC presale isn't open in your region",
  q21: "This wallet doesn't offer the presale in your region. You can still hold, send and receive any NOC you already have.",
  q22: 'Checked by this wallet against the restricted-region list',
  q23: "The presale can't be opened right now",
  q24: 'Region check required',
  q25: 'The presale opens only after a successful check against a current list',
  q26: 'Your region could not be determined from your IP.',
  q27: "Noctura's server did not answer requests from this network",
  q28: 'Token sales are restricted by jurisdiction · this wallet checks before every purchase',
  q29: 'If the restricted-region list changes, this screen lifts on its own.',
  q30: 'View balances',
  stale: 'The restricted-region list is out of date.',
  noCheck: 'The region check is unavailable — try again later.',
  refused: 'The presale service refused this network.',
  disclosure: 'Approximated from your IP. No GPS, no device location.',
  geofence: 'Presale geofence active',
  why: 'Why this matters',
  rechecked: 'Re-checked at every presale screen mount.',
};
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const texts = (sel: string) => [...document.querySelectorAll(sel)].map(e => e.textContent);
/** The reason rows, head and sub. */
const reasonRows = () => [...document.querySelectorAll('.app-geo-card .s11-reason-row .body')].map(b => [...b.children].map(c => c.textContent));
/** The region card's lines. */
const regionLines = () => texts('.s11-geo-region .col > *');
/** Boolean, with neutral messages (public CI logs): no date, no countdown, and nothing §9 omits. */
function expectNothingOmitted() {
  const t = document.body.textContent ?? '';
  expect(/\b(19|20)\d{2}\b/.test(t)).toBe(false);
  expect(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d/.test(t)).toBe(false);
  for (const v of ['claim_ix', 'Stake', 'stake', 'Claim', 'View portfolio', 'allowlist', "honor the program's"]) expect([v, t.includes(v)]).toEqual([v, false]);
  expect(document.querySelector('.s11-geo-region .flag')).toBeNull();
}
/** #50b over this gate answer, and the presale.view messages it sent. */
type WorldOptions = NonNullable<Parameters<typeof purchaseWorld>[0]>;
async function show(answer: GeoAnswer, o: {before?: WorldOptions['before']; chain?: WorldOptions['chain']; failView?: boolean} = {}) {
  const views: unknown[] = [];
  const w = purchaseWorld({
    ...(o.chain === undefined ? {} : {chain: o.chain}),
    ...(o.before === undefined ? {} : {before: o.before}),
    gate: m => {
      if ((m as {type: string}).type !== 'presale.view') return;
      views.push(m);
      if (o.failView === true) throw new Error('the popup lost its port');
    },
  });
  w.geo.answer = answer;
  const wallet = await renderInWallet(<Geo {...nav} />, w.options);
  await screen.findByText(/^(NOC presale is|NOC presale isn't|The presale can't)/);
  return {w, wallet, views};
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('#50b × 6 (§4.3), each reason as the table words it', () => {
  it('sanctioned: the design’s headline, Q21, "Detected region: North Korea" with the disclosure, the geofence row (Q22) and "Why this matters" (Q28), the info banner (Q29) and "What still works"; every class styled', async () => {
    const {views} = await show({open: false, reason: 'sanctioned', countryCode: 'KP'});
    expect(text('.top-bar .title.noc-h1-compact')).toBe('Not available here');
    expect(text('.s11-geo-hero h2.noc-h2')).toBe(Q.sanctioned);
    expect(text('.s11-geo-hero p.noc-body.app-geo-sub')).toBe(Q.q21);
    expect(document.querySelector('.s11-geo-hero .glyph.app-geo-warn')).not.toBeNull();
    expect(regionLines()).toEqual(['Detected region: North Korea', Q.disclosure]);
    expect(reasonRows()).toEqual([
      [Q.geofence, Q.q22],
      [Q.why, Q.q28],
    ]);
    expect(document.querySelectorAll('.app-geo-card .s11-reason-row .ico.app-geo-warn')).toHaveLength(1);
    expect(texts('.app-geo-banner > div > *')).toEqual([Q.q29, Q.rechecked]);
    expect(text('.s11-stillworks .head .noc-overline')).toBe('What still works');
    expect(texts('.s11-stillworks li')).toEqual(['Send / Receive NOC', Q.q30]);
    expect(texts('.sticky-bar button')).toEqual(['Got it']);
    expectNothingOmitted();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
    // "Re-checked at every presale screen mount": exactly one view for this mount (C12).
    expect(views).toEqual([{type: 'presale.view', account: ACCOUNT}]);
  });

  it('stale_list with a known country: Q23, the approved sub, "Detected region: Slovenia · EU", Q24 · Q25', async () => {
    await show({open: false, reason: 'stale_list', countryCode: 'SI'});
    expect(text('.s11-geo-hero h2')).toBe(Q.q23);
    expect(text('.s11-geo-hero p')).toBe(Q.stale);
    expect(regionLines()).toEqual(['Detected region: Slovenia · EU', Q.disclosure]);
    expect(reasonRows()).toEqual([
      [Q.q24, Q.q25],
      [Q.why, Q.q28],
    ]);
    expect(texts('.s11-stillworks li')).toEqual(['Send / Receive NOC', Q.q30]);
    expectNothingOmitted();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('stale_list with no country known: the disclosure line only', async () => {
    await show({open: false, reason: 'stale_list', countryCode: null});
    expect(text('.s11-geo-hero p')).toBe(Q.stale);
    expect(regionLines()).toEqual([Q.disclosure]);
  });

  it('unknown_country: Q23, Q26, the disclosure line only, Q24 · Q25', async () => {
    await show({open: false, reason: 'unknown_country', countryCode: null});
    expect(text('.s11-geo-hero h2')).toBe(Q.q23);
    expect(text('.s11-geo-hero p')).toBe(Q.q26);
    expect(regionLines()).toEqual([Q.disclosure]);
    expect(reasonRows()).toEqual([
      [Q.q24, Q.q25],
      [Q.why, Q.q28],
    ]);
    expectNothingOmitted();
  });

  it('no_check: Q23, the approved sub, the disclosure line only — even when the check named a country (the list failed) — Q24 · Q25', async () => {
    await show({open: false, reason: 'no_check', countryCode: 'SI'});
    expect(text('.s11-geo-hero h2')).toBe(Q.q23);
    expect(text('.s11-geo-hero p')).toBe(Q.noCheck);
    expect(regionLines()).toEqual([Q.disclosure]);
    expect(reasonRows()).toEqual([
      [Q.q24, Q.q25],
      [Q.why, Q.q28],
    ]);
    expectNothingOmitted();
  });

  it('refused (a 403): Q23, the approved sub, the disclosure line only, Q24 · Q27', async () => {
    await show({open: false, reason: 'refused', countryCode: null});
    expect(text('.s11-geo-hero h2')).toBe(Q.q23);
    expect(text('.s11-geo-hero p')).toBe(Q.refused);
    expect(regionLines()).toEqual([Q.disclosure]);
    expect(reasonRows()).toEqual([
      [Q.q24, Q.q27],
      [Q.why, Q.q28],
    ]);
    expectNothingOmitted();
  });

  it('open (C18): Q20, no sub, "Detected region: Slovenia · EU" with the disclosure (D22), no reason row, no info banner (nothing to lift), no "What still works"; the default glyph', async () => {
    await show({open: true, reason: null, countryCode: 'SI'});
    expect(text('.s11-geo-hero h2')).toBe(Q.q20);
    expect(document.querySelector('.s11-geo-hero p')).toBeNull();
    expect(document.querySelector('.s11-geo-hero .glyph')?.className).toBe('glyph');
    expect(regionLines()).toEqual(['Detected region: Slovenia · EU', Q.disclosure]);
    expect(reasonRows()).toEqual([[Q.why, Q.q28]]);
    expect(document.querySelector('.app-geo-banner')).toBeNull();
    expect(document.querySelector('.s11-stillworks')).toBeNull();
    expectNothingOmitted();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('open with no country the gate could name: the disclosure line only (D22 shows a country only when there is one); outside the EU, the name alone', async () => {
    await show({open: true, reason: null, countryCode: null});
    expect(text('.s11-geo-hero h2')).toBe(Q.q20);
    expect(regionLines()).toEqual([Q.disclosure]);
    cleanup();
    await show({open: true, reason: null, countryCode: 'CH'});
    expect(regionLines()).toEqual(['Detected region: Switzerland', Q.disclosure]);
  });

  it('any other answer of the view was given with the gate open (§2.2: the gate decides first): an inactive sale, a blocked account, an open purchase → the open variant', async () => {
    for (const chain of [{config: program(configData({active: 0}))}, {user: program(userData({blocked: 1}))}]) {
      // The gate was open, but these variants carry no country (only the open view does, D22): the disclosure line only.
      await show({open: true, reason: null, countryCode: 'SI'}, {chain});
      expect(text('.s11-geo-hero h2')).toBe(Q.q20);
      expect(regionLines()).toEqual([Q.disclosure]);
      cleanup();
    }
    const SIGNATURE = firstSignature(signedWire(7n));
    const data = {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '2643837441705', spentCents: '39684', destination: TREASURY_ADDRESS, referrer: null};
    const record = pendingRecord({id: 'b1', account: ACCOUNT, signature: SIGNATURE, wire: base64.encode(signedWire(7n)), createdAt: Date.now(), intent: null, extra: {kind: 'presale-buy', data}});
    // With the gate closed, an open purchase does not soften #50b: the reason stays the gate's (positive control).
    await show({open: false, reason: 'sanctioned', countryCode: 'KP'}, {before: ext => ext.local.set(PENDING_KEY, [record])});
    expect(text('.s11-geo-hero h2')).toBe(Q.sanctioned);
  });

  it('a view that did not answer → no_check: closed, Q23 with the approved sub (fail closed, never the open variant)', async () => {
    await show({open: true, reason: null, countryCode: null}, {failView: true});
    expect(text('.s11-geo-hero h2')).toBe(Q.q23);
    expect(text('.s11-geo-hero p')).toBe(Q.noCheck);
    expect(reasonRows()[0]).toEqual([Q.q24, Q.q25]);
  });
});

describe('#50b’s exits and its re-check (§4.3)', () => {
  it('[Got it] → back to the trigger (onDone), ✕ → #11 (onClose), back → onBack', async () => {
    await show({open: false, reason: 'sanctioned', countryCode: 'KP'});
    fireEvent.click(screen.getByRole('button', {name: 'Got it'}));
    expect(nav.onDone).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(nav.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onBack).toHaveBeenCalledTimes(1);
    expect([nav.onDone, nav.onClose, nav.onBack].map(f => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('every mount is a fresh check — a new mount asks again and shows the new answer; a focus asks nothing (the re-check is per mount)', async () => {
    const {w, views} = await show({open: false, reason: 'no_check', countryCode: null});
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(views).toHaveLength(1);
    cleanup();
    w.geo.answer = {open: false, reason: 'sanctioned', countryCode: 'KP'};
    await renderInWallet(<Geo {...nav} />, w.options);
    expect(await screen.findByText(Q.sanctioned)).toBeTruthy();
    expect(views).toHaveLength(2);
  });

  it('the route: exactly {screen: "geo"}; Got it and back pop (to the trigger), ✕ goes home', async () => {
    expect(GEO_ROUTE.screen).toBe('geo');
    expect(GEO_ROUTE.isRoute({screen: 'geo'})).toBe(true);
    for (const extra of [{reason: 'sanctioned'}, {countryCode: 'KP'}, {account: ACCOUNT}]) expect(GEO_ROUTE.isRoute({screen: 'geo', ...extra})).toBe(false);
    const n = {pop: vi.fn(), home: vi.fn(), push: vi.fn(), replace: vi.fn(), reset: vi.fn()};
    const w = purchaseWorld();
    w.geo.answer = {open: false, reason: 'sanctioned', countryCode: 'KP'};
    await renderInWallet(<>{GEO_ROUTE.render({screen: 'geo'}, n)}</>, w.options);
    await screen.findByText(Q.sanctioned);
    fireEvent.click(screen.getByRole('button', {name: 'Got it'}));
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(n.pop).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(n.home).toHaveBeenCalledTimes(1);
    expect([n.push, n.replace, n.reset].map(f => f.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it('regionName with Intl.DisplayNames throwing → the code itself on the screen ("Detected region: KP")', async () => {
    vi.spyOn(Intl, 'DisplayNames').mockImplementation(function () {
      throw new RangeError('no display names');
    });
    await show({open: false, reason: 'sanctioned', countryCode: 'KP'});
    expect(regionLines()).toEqual(['Detected region: KP', Q.disclosure]);
  });
});
