// @vitest-environment happy-dom
import {cleanup, render, screen} from '@testing-library/react';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import type {GeoAnswer} from '../../background/geo/gate';
import {readDappSession} from '../../background/dapp/store';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {presaleIx, transfer, v0} from '../../background/dapp/__tests__/txHarness';
import {pendingOf, type Flag, type RequestView} from '../client';
import {bannerInstruction, Tx} from '../Tx';
import {FLAG_HOLD_MS} from '../useArmed';
import {acted, elapse, onHarnessClock, openWindow, settled} from './windowHarness';

/**
 * B1d §3.6 (D9, D15, C31): #48 with F12 — the background's refusal of a site's presale purchase while the jurisdiction
 * gate is not open, rendered as stored: Q49's head, Q50a (the country's name) or Q50b, Q51; the eyebrow "Critical ·
 * Blocked transaction"; no typed field and no Approve — only Reject. Runs in both vitest runs (D15).
 */
const off = process.env.NOCTURA_PRESALE === '0';
const SELECTORS = selectorsOf(UI_SHEETS);
const Q49 = 'Presale purchase blocked';
const Q50A = (country: string) => `This transaction buys NOC in the presale, which this wallet doesn't allow from your region (${country}).`;
const Q50B = "This transaction buys NOC in the presale. The wallet's region check did not succeed, so it can't be approved — try again later.";
const Q51 = 'Only Reject is available · no override';
const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
const banners = () =>
  [...document.querySelectorAll('.app-tx-item .s9-flag-banner')].map(b => ({
    tone: b.className.replace('s9-flag-banner ', ''),
    head: b.querySelector('.head')?.textContent,
    body: [...b.querySelectorAll('.body')].map(e => e.textContent),
    meta: [...b.querySelectorAll('.meta')].map(e => e.textContent),
  }));
/** The sticky bar's CTAs (the top bar's ✕ is not one). */
const buttons = () => [...document.querySelectorAll('.sticky-bar button')].map(b => b.textContent);
const F2 = (name: string) => ({tone: 'warn', head: 'Instructions that are not transfers', body: ['Each can do more than move a balance. Check what it does before approving.'], meta: [`#1 noctura_presale::${name}`]});
onHarnessClock();

async function shown(geo: () => Promise<GeoAnswer>, shows: string, instructions = [presaleIx('presale_purchase_with_sol')]) {
  const w = await openWindow();
  await w.ext.local.set('v1_known_recipients', [{address: RECIPIENT, at: 1}]);
  w.deps.geo = geo;
  const r = await w.signTx('https://presale.example', [v0(instructions)]);
  w.show();
  await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim ?? null).not.toBeNull());
  await acted(() => window.dispatchEvent(new Event('focus')));
  await settled(() => screen.getAllByText(shows));
  return {...w, ...r};
}

describe(`#48 F12 (${off ? 'off' : 'on'} build)`, () => {
  it('sanctioned: Q49, Q50a with the country’s name, Q51 — first in the section, before F2; the eyebrow; no typed field, no Approve; Reject rejects', async () => {
    const w = await shown(async () => ({open: false, reason: 'sanctioned', countryCode: 'KP'}), Q49);
    expect(banners()).toEqual([{tone: 'danger', head: Q49, body: [Q50A('North Korea')], meta: [Q51]}, F2('PresalePurchaseWithSol')]);
    expect([document.querySelector('.top-bar .title')?.textContent, document.querySelector('.top-bar .title')?.className]).toEqual(['Critical · Blocked transaction', 'title noc-overline noc-danger']);
    expect(document.querySelector('.s9-typed-confirm')).toBeNull();
    expect(document.querySelector('.s9-origin-pill')).toBeNull();
    // Nothing can be approved here, so no "after you approve" caption (owner-delegated copy call, 2026-10-25).
    expect(document.querySelector('.app-tx-sends')).toBeNull();
    // Past every hold: still nothing but Reject.
    await elapse(FLAG_HOLD_MS);
    expect(buttons()).toEqual(['Reject']);
    expect(screen.queryByRole('button', {name: /Approve/})).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    screen.getByRole('button', {name: 'Reject'}).click();
    await settled(() => expect(w.closed.n).toBe(1));
    expect(w.page.answersFor(w.requestId).map(a => a.error)).toEqual(['rejected']);
  });

  it('every fail-closed reason — a stale list (a country known), an unknown country, no check, a refusal, the gate throwing: Q50b, the country never named; only Reject', async () => {
    const answers: (() => Promise<GeoAnswer>)[] = [
      async () => ({open: false, reason: 'stale_list', countryCode: 'SI'}),
      async () => ({open: false, reason: 'unknown_country', countryCode: null}),
      async () => ({open: false, reason: 'no_check', countryCode: null}),
      async () => ({open: false, reason: 'refused', countryCode: null}),
      async () => {
        throw new Error('the gate failed');
      },
    ];
    for (const geo of answers) {
      await shown(geo, Q49);
      expect(banners()[0]).toEqual({tone: 'danger', head: Q49, body: [Q50B], meta: [Q51]});
      expect(document.body.textContent?.includes('Slovenia')).toBe(false);
      await elapse(FLAG_HOLD_MS);
      expect(buttons()).toEqual(['Reject']);
      cleanup();
    }
  });

  it('the country’s name when Intl.DisplayNames throws: the code itself (B1d §6.1, the window half)', async () => {
    const real = Intl.DisplayNames;
    vi.spyOn(Intl, 'DisplayNames').mockImplementation(() => {
      throw new RangeError('no display names');
    });
    try {
      await shown(async () => ({open: false, reason: 'sanctioned', countryCode: 'KP'}), Q49);
      expect(banners()[0]?.body).toEqual([Q50A('KP')]);
    } finally {
      vi.mocked(Intl.DisplayNames).mockRestore();
    }
    expect(Intl.DisplayNames).toBe(real);
  });

  it('the gate open: no F12 — F2 as before, Approve drawn and signing (positive control)', async () => {
    const w = await shown(async () => OPEN, 'Instructions that are not transfers');
    expect(banners()).toEqual([F2('PresalePurchaseWithSol')]);
    expect(document.querySelector('.app-tx-sends')?.textContent).toBe('The site sends this transaction itself after you approve.');
    await elapse(FLAG_HOLD_MS);
    expect(buttons()).toEqual(['Reject', 'Approve']);
    screen.getByRole('button', {name: 'Approve'}).click();
    await settled(() => expect(w.closed.n).toBe(1));
    expect(w.page.answersFor(w.requestId)).toHaveLength(1);
  });

  it('a refresh that changes the gate’s answer re-evaluates: open → Approve; closed at the 30 s refresh → F12, only Reject; open again → Approve', async () => {
    let answer: GeoAnswer = OPEN;
    const w = await shown(async () => answer, 'Instructions that are not transfers');
    await elapse(FLAG_HOLD_MS);
    expect(buttons()).toEqual(['Reject', 'Approve']);
    const refresh = async () => {
      const before = (await readDappSession(w.ext)).queue[0]?.sim;
      w.deps.clock.t += 30_000;
      await acted(() => document.dispatchEvent(new Event('visibilitychange')));
      await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(before));
      await acted(() => document.dispatchEvent(new Event('visibilitychange')));
    };
    answer = {open: false, reason: 'sanctioned', countryCode: 'IR'};
    await refresh();
    await settled(() => screen.getByText(Q49));
    expect(banners()[0]).toEqual({tone: 'danger', head: Q49, body: [Q50A('Iran')], meta: [Q51]});
    await elapse(FLAG_HOLD_MS);
    expect(buttons()).toEqual(['Reject']);
    answer = OPEN;
    await refresh();
    await settled(() => expect(screen.queryByText(Q49)).toBeNull());
    await elapse(FLAG_HOLD_MS);
    expect(buttons()).toEqual(['Reject', 'Approve']);
  });

  it('a batch: F12 in the purchase’s own section; the request has only Reject', async () => {
    const w = await openWindow();
    await w.ext.local.set('v1_known_recipients', [{address: RECIPIENT, at: 1}]);
    w.deps.geo = async () => ({open: false, reason: 'no_check', countryCode: null});
    await w.signTx('https://presale.example', [v0([transfer(1)]), v0([presaleIx('presale_purchase_usdc_and_vest_stake')])]);
    w.show();
    await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim ?? null).not.toBeNull());
    await acted(() => window.dispatchEvent(new Event('focus')));
    await settled(() => screen.getByText(Q49));
    const sections = [...document.querySelectorAll('.app-tx-item')];
    expect(sections.map(s => [...s.querySelectorAll('.s9-flag-banner .head')].map(h => h.textContent))).toEqual([[], [Q49, 'Instructions that are not transfers']]);
    await elapse(FLAG_HOLD_MS);
    expect(buttons()).toEqual(['Reject']);
  });
});

describe(`#48 F12 as the window reads it (${off ? 'off' : 'on'} build)`, () => {
  const f12: Flag = {kind: 'presale-region', severity: 'refuse', word: null, at: 0, reason: 'sanctioned', countryCode: 'KP'};
  const request = (flags: unknown[], site: RequestView['site'] = {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false}) => ({
    requestId: 'f',
    type: 'signTransaction',
    origin: 'https://jup.ag',
    host: 'jup.ag',
    site,
    offerBlock: false,
    connect: null,
    sign: null,
    mismatch: null,
    tx: {
      kind: 'signTransaction',
      account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
      simulation: {status: 'ok', id: 'AAAAAAAAAAAAAAAAAAAAAA', slot: 1, elapsedMs: 1, at: 1},
      reauth: null,
      labels: [],
      transactions: [{version: 0, feePayer: ACCOUNT.publicKey, unitLimit: null, feeLamports: null, outcome: {ok: true, changes: [], unitsConsumed: 1, unitLimit: 200_000, feeLamports: null}, instructions: [], flags}],
    },
  });
  const read = (flags: unknown[]) => pendingOf({state: 'request', request: request(flags), waiting: 0, windowNotice: false});

  it('pendingOf reads F12 exactly; a word, another severity, an unknown reason, a lower-case or missing country, a key more: the detail refused (Q26)', () => {
    const view = read([f12]);
    expect(view?.state === 'request' ? view.request.tx?.transactions[0]?.flags : null).toEqual([f12]);
    expect(read([{...f12, countryCode: null}])).not.toBeNull();
    const bad = [{...f12, word: 'PRESALE'}, {...f12, severity: 'block'}, {...f12, reason: 'vpn'}, {...f12, countryCode: 'kp'}, {...f12, countryCode: 'KPX'}, {kind: 'presale-region', severity: 'refuse', word: null, at: 0, reason: 'sanctioned'}, {...f12, extra: 1}, {...f12, at: null}];
    for (const b of bad) {
      const v = read([b]);
      expect([b, v?.state === 'request' ? v.request.tx : 'unread']).toEqual([b, null]);
    }
  });

  it('F12 beside a failed simulation: "Couldn’t simulate" and the F12 banner, the eyebrow still "Critical · Blocked transaction", only Reject', () => {
    const raw = request([f12]);
    const v = pendingOf({state: 'request', request: {...raw, tx: {...raw.tx, transactions: [{...raw.tx.transactions[0], outcome: {ok: false, error: 'failed', detail: '{"InstructionError":[0,"Custom"]}'}}]}}, waiting: 0, windowNotice: false});
    if (v?.state !== 'request') throw new Error('not read');
    render(<Tx request={v.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect([document.querySelector('.top-bar .title')?.textContent, document.querySelector('.top-bar .title')?.className]).toEqual(['Critical · Blocked transaction', 'title noc-overline noc-danger']);
    expect([...document.querySelectorAll('.s9-flag-banner .head')].map(h => h.textContent)).toEqual(["Couldn't simulate", Q49]);
    expect(buttons()).toEqual(['Reject']);
  });

  it('a lookalike origin with F12: [Reject and report] and Reject — never "Approve anyway"', () => {
    const site: RequestView['site'] = {kind: 'lookalike', name: 'jup', imitates: 'jup.ag', rule: 'edit', idn: null, international: false};
    const v = pendingOf({state: 'request', request: request([f12], site), waiting: 0, windowNotice: false});
    if (v?.state !== 'request') throw new Error('not read');
    render(<Tx request={v.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(buttons()).toEqual(['Reject and report', 'Reject']);
    expect(screen.queryByRole('button', {name: /Approve/})).toBeNull();
    expect(banners()[0]?.head).toBe(Q49);
  });
});

describe('bannerInstruction (owner-delegated copy call, 2026-10-25)', () => {
  it('an Anchor IDL snake_case name as PascalCase; a camelCase name keeps its case after the first letter', () => {
    expect(bannerInstruction('presale_purchase_with_sol')).toBe('PresalePurchaseWithSol');
    expect(bannerInstruction('claim_presale_allocation')).toBe('ClaimPresaleAllocation');
    expect(bannerInstruction('transferChecked')).toBe('TransferChecked');
    expect(bannerInstruction('approve')).toBe('Approve');
  });
});
