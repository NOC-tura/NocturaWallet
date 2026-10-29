// @vitest-environment happy-dom
import {act, fireEvent, render, screen} from '@testing-library/react';
import {drainInFlight, renderInWallet} from '../../__tests__/harness';
import {ReferFriend} from '../ReferFriend';
import {REFERRAL_ROUTE} from '../routes';
import {earnedText, referredText} from '../text';
import {ExtIcon} from '../../ui/ExtIcon';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../../__tests__/styled';
import {registerPresale} from '../../../background/presale/api';
import {registerPresaleHandler} from '../../../background/messages';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {ACCOUNT, allocationData, program, type Chain} from '../../../background/presale/__tests__/chain';
import {RpcHttpError, type AccountData} from '../../../../../core/solana/rpc';
import {purchaseWorld} from './world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 4 (§3.5, §4.4, C1, C15; index.html #24 ix 10903-11233; Q35–Q39): #24 against the REAL background —
// presale.referral over chain.ts's allocation and a /referral-stats answer that is the test's own function (the global
// fetch throws: nothing reaches the network). Every state as drawn: populated (24a), empty (24b), a figure whose source
// failed ("—"), copied (24a-bis without its toast), copy failed; and nothing §9 omits.
const SELECTORS = selectorsOf(UI_SHEETS);
const LINK = `https://noc-tura.io?ref=${ACCOUNT}`;
const STATS = {totalReferrals: 3, totalReferredPurchases: 5, totalBaseBonusNoc: 999, totalExtraBonusNoc: 0, totalBonusNoc: 999, totalReferredNoc: 8_000, totalReferredUsd: 1234.56, tierBonusCount: 0};
const Q39 = 'Earn NOC when friends you invite buy in the presale.';
const LEGALESE = 'Referral payouts are subject to program terms. Self-referrals are detected and rejected.';
const earned = (bonus: bigint): Partial<Chain> => ({allocation: program(allocationData({bonus}))});

/** The three stat cards: label, value, sub. */
const stats = () => [...document.querySelectorAll('.s-ref .stats .stat')].map(s => [...s.children].map(c => c.textContent));
const value = (label: string) => [...document.querySelectorAll('.s-ref .stats .stat')].find(s => s.firstElementChild?.textContent === label)?.querySelector('.val') ?? null;
const uses = () => document.querySelector('.s-ref .code-card .uses');
const code = () => document.querySelector('.s-ref .code-card .code-row .code');
const codeRow = () => document.querySelector('.s-ref .code-card .code-row');
const copyButton = () => document.querySelector<HTMLButtonElement>('.s-ref .code-card .actions button');
const shareButton = () => document.querySelector<HTMLButtonElement>('.s-ref .code-card .share-btn');
/** The markup ExtIcon draws for `name` at the copy icon's size — how a test tells the checkmark from the copy glyph. */
function iconHtml(name: 'check' | 'copy' | 'close'): string {
  const c = document.createElement('div');
  const r = render(<ExtIcon name={name} size={18} />, {container: c});
  const html = c.innerHTML;
  r.unmount();
  return html;
}
/** Boolean, with neutral messages (public CI logs): no date, no countdown, and nothing §9 omits from #24. */
function expectNothingOmitted() {
  const t = document.body.textContent ?? '';
  expect(/\b(19|20)\d{2}\b/.test(t)).toBe(false);
  expect(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d/.test(t)).toBe(false);
  for (const v of ['ACTIVE', 'staking', 'stake', 'Recent rewards', 'View all', 'epoch', 'No rewards yet', '5 %', 'NOCT-', 'auto-clear', '…']) expect([v, t.includes(v)]).toEqual([v, false]);
  expect(document.querySelector('.copy-toast, .rewards, .empty-rewards')).toBeNull();
}

interface Shown {
  sent: unknown[];
  gets: string[];
}
/** #24 over this chain and this /referral-stats answer (or failure); every message the screen sent. */
async function show(o: {chain?: Partial<Chain>; stats?: () => Promise<unknown>; read?: () => Promise<(AccountData | null)[]>; failReply?: boolean} = {}): Promise<Shown> {
  const sent: unknown[] = [];
  const gets: string[] = [];
  const w = purchaseWorld({
    ...(o.chain === undefined ? {} : {chain: o.chain}),
    gate: m => {
      sent.push(m);
      if (o.failReply === true && (m as {type: string}).type === 'presale.referral') throw new Error('the popup lost its port');
    },
  });
  const base = w.options.reader;
  const reader = o.read === undefined || base === undefined ? base : {...base, getAccountsData: o.read};
  await renderInWallet(<ReferFriend onBack={vi.fn()} />, {
    ...w.options,
    ...(reader === undefined ? {} : {reader}),
    deps: {
      ...w.options.deps,
      getJson: async path => {
        gets.push(path);
        return o.stats === undefined ? {success: true, data: STATS} : o.stats();
      },
    },
  });
  await landed();
  return {sent, gets};
}
/** Every answer the background owes has landed and been rendered: the open sequence, presale.referral, the screen's continuation. */
const landed = () =>
  act(async () => {
    await new Promise<void>(r => setTimeout(r, 0));
    await drainInFlight();
    await new Promise<void>(r => setTimeout(r, 0));
  });
const referralMessages = (sent: unknown[]) => sent.filter(m => (m as {type: string}).type === 'presale.referral');
function setClipboard(writeText: ((v: string) => Promise<void>) | null) {
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: writeText === null ? undefined : {writeText}});
}

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('a test reached for the network');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setClipboard(null);
});

describe('#24 referral (§4.4)', () => {
  it('24a populated, as drawn and as the app corrected it: three stats, the code card with the whole link, Copy and Share, Q39, the legalese — one presale.referral, every class styled', async () => {
    const {sent, gets} = await show({chain: earned(16_142_571_618n)});
    expect(document.querySelector('.top-bar .title.noc-h3')?.textContent).toBe('Refer a friend');
    expect(stats()).toEqual([
      ['REFERRALS', '3', 'total joined'],
      ['EARNED', '16.1', 'NOC lifetime'],
      ['REFERRED', '$1,234.56', 'from your invites'],
    ]);
    expect(value('EARNED')?.className).toBe('val noc-balance-md noc-numeral acc');
    expect(value('REFERRALS')?.className).toBe('val noc-balance-md noc-numeral');
    expect(document.querySelector('.s-ref .code-card .lbl-row .noc-overline')?.textContent).toBe('YOUR INVITE LINK');
    expect(uses()?.textContent).toBe('Used by 3 people');
    expect(uses()?.querySelector('.noc-numeral')?.textContent).toBe('3');
    // The address is the code (C1): the link whole, in the mono face, never shortened.
    expect(code()?.textContent).toBe(LINK);
    expect(code()?.classList.contains('noc-mono')).toBe(true);
    expect(copyButton()?.getAttribute('aria-label')).toBe('Copy invite link');
    expect(copyButton()?.innerHTML).toBe(iconHtml('copy'));
    expect(shareButton()?.textContent).toBe('Share invite link');
    expect(document.querySelector('.s-ref .banner.shield')?.textContent).toBe(Q39);
    expect(document.querySelector('.s-ref .legalese')?.textContent).toBe(LEGALESE);
    // No sticky bar on this screen (the design: no primary terminal action).
    expect(document.querySelector('.sticky-bar')).toBeNull();
    expectNothingOmitted();
    expect(referralMessages(sent)).toEqual([{type: 'presale.referral', account: ACCOUNT}]);
    expect(gets).toEqual([`/referral-stats/${ACCOUNT}`]);
    expect(unstyledClasses(document.querySelector('.s-ref')!, SELECTORS)).toEqual([]);
  });

  it('24b empty: zeros as returned — "0", "0.0" muted, "$0.00" — and "Not used yet"', async () => {
    await show({chain: {allocation: null}, stats: async () => ({success: true, data: {...STATS, totalReferrals: 0, totalReferredPurchases: 0, totalReferredUsd: 0}})});
    expect(stats()).toEqual([
      ['REFERRALS', '0', 'total joined'],
      ['EARNED', '0.0', 'NOC lifetime'],
      ['REFERRED', '$0.00', 'from your invites'],
    ]);
    expect(value('EARNED')?.className).toBe('val noc-balance-md noc-numeral app-ref-muted');
    expect(uses()?.textContent).toBe('Not used yet');
    expect(code()?.textContent).toBe(LINK);
    expectNothingOmitted();
    expect(unstyledClasses(document.querySelector('.s-ref')!, SELECTORS)).toEqual([]);
  });

  it('/referral-stats failing: REFERRALS and REFERRED "—", the "Used" line hidden — EARNED still shown from the chain', async () => {
    await show({chain: earned(16_142_571_618n), stats: async () => Promise.reject(new RpcHttpError('/referral-stats', 500))});
    expect(stats()).toEqual([
      ['REFERRALS', '—', 'total joined'],
      ['EARNED', '16.1', 'NOC lifetime'],
      ['REFERRED', '—', 'from your invites'],
    ]);
    expect(uses()).toBeNull();
    expect(code()?.textContent).toBe(LINK);
  });

  it('the chain read failing: EARNED "—" (muted); REFERRALS, REFERRED and "Used by 3 people" still shown from /referral-stats', async () => {
    await show({read: async () => Promise.reject(new Error('rpc down'))});
    expect(stats()).toEqual([
      ['REFERRALS', '3', 'total joined'],
      ['EARNED', '—', 'NOC lifetime'],
      ['REFERRED', '$1,234.56', 'from your invites'],
    ]);
    expect(value('EARNED')?.className).toBe('val noc-balance-md noc-numeral app-ref-muted');
    expect(uses()?.textContent).toBe('Used by 3 people');
  });

  it('a body without a figure is no figure: "—" (never the 0 core would make of it)', async () => {
    await show({chain: earned(1_000_000_000n), stats: async () => ({success: true, data: {totalReferredUsd: 25}})});
    expect(stats()).toEqual([
      ['REFERRALS', '—', 'total joined'],
      ['EARNED', '1.0', 'NOC lifetime'],
      ['REFERRED', '—', 'from your invites'],
    ]);
    expect(uses()).toBeNull();
  });

  it.each([
    [1, 'Used by 1 person'],
    [2, 'Used by 2 people'],
    [1234, 'Used by 1,234 people'],
  ])('%i referrals: "%s" — people, not uses (D27; the count in .noc-numeral, grouped)', async (n, line) => {
    await show({stats: async () => ({success: true, data: {...STATS, totalReferrals: n}})});
    expect(uses()?.textContent).toBe(line);
  });

  it('large figures whole, each breakable only after a group separator (the 412 px frame holds three thirds)', async () => {
    await show({chain: earned(123_456_789_000_000_000n), stats: async () => ({success: true, data: {totalReferrals: 12_345, totalReferredUsd: 1_234_567.89}})});
    expect(stats().map(s => s[1])).toEqual(['12,345', '123,456,789.0', '$1,234,567.89']);
    expect(['REFERRALS', 'EARNED', 'REFERRED'].map(l => value(l)?.innerHTML)).toEqual(['12,<wbr>345', '123,<wbr>456,<wbr>789.0', '$1,<wbr>234,<wbr>567.89']);
  });

  it('a reply that failed: every figure "—", no link and no copy, Q11 said', async () => {
    await show({failReply: true});
    expect(stats().map(s => s[1])).toEqual(['—', '—', '—']);
    expect(document.querySelector('.s-ref .code-card')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Presale unavailable — try again later.');
  });

  it('the figures are formatted from bigints, never through a float: EARNED floored to one place, REFERRED exact beyond a double', () => {
    expect(earnedText(16_199_999_999n)).toBe('16.1');
    expect(earnedText(123_456_789_000_000_000n)).toBe('123,456,789.0');
    expect(referredText(900_719_925_474_099_312n)).toBe('$9,007,199,254,740,993.12');
    expect(referredText(29n)).toBe('$0.29');
  });

  it('the route `referral` carries nothing; its screen is #24', () => {
    expect(REFERRAL_ROUTE.isRoute({screen: 'referral'})).toBe(true);
    for (const bad of [{screen: 'referral', account: ACCOUNT}, {screen: 'referral', link: LINK}, {screen: 'referrals'}]) expect(REFERRAL_ROUTE.isRoute(bad)).toBe(false);
  });
});

describe('#24 copy (C15, 24a-bis without its toast)', () => {
  it('Copy: the clipboard holds exactly the link; while copied the icon is the checkmark and the code row carries the accent border, "Copied" said — no toast; after its 2 s, idle again', async () => {
    const writes: string[] = [];
    setClipboard(async v => void writes.push(v));
    await show({chain: earned(9n)});
    expect(codeRow()?.className).toBe('code-row');
    await act(async () => {
      fireEvent.click(copyButton()!);
    });
    expect(writes).toEqual([LINK]);
    expect(codeRow()?.className).toBe('code-row app-ref-copied');
    expect(copyButton()?.innerHTML).toBe(iconHtml('check'));
    expect(copyButton()?.className).toBe('app-ref-check');
    expect(copyButton()?.getAttribute('aria-label')).toBe('Copied');
    expect(shareButton()?.textContent).toBe('Copied');
    expectNothingOmitted();
    expect(unstyledClasses(document.querySelector('.s-ref')!, SELECTORS)).toEqual([]);
    await act(() => new Promise<void>(r => setTimeout(r, 2_100)));
    expect(codeRow()?.className).toBe('code-row');
    expect(copyButton()?.innerHTML).toBe(iconHtml('copy'));
    expect(shareButton()?.textContent).toBe('Share invite link');
  });

  it('"Share invite link" copies the link (C15): the same clipboard write, the same checkmark and border', async () => {
    const writes: string[] = [];
    setClipboard(async v => void writes.push(v));
    await show();
    await act(async () => {
      fireEvent.click(shareButton()!);
    });
    expect(writes).toEqual([LINK]);
    expect(codeRow()?.className).toBe('code-row app-ref-copied');
    expect(copyButton()?.innerHTML).toBe(iconHtml('check'));
    expect(shareButton()?.textContent).toBe('Copied');
  });

  it.each([
    ['the clipboard refused', async () => Promise.reject(new Error('denied'))],
    ['no clipboard API', null],
  ] as const)('"Copy failed" (%s): said, and no checkmark, no accent border', async (_name, writeText) => {
    setClipboard(writeText);
    await show();
    await act(async () => {
      fireEvent.click(copyButton()!);
    });
    expect(copyButton()?.getAttribute('aria-label')).toBe('Copy failed');
    expect(shareButton()?.textContent).toBe('Copy failed');
    expect(copyButton()?.innerHTML).not.toBe(iconHtml('check'));
    expect(copyButton()?.innerHTML).toBe(iconHtml('close'));
    expect(codeRow()?.className).toBe('code-row');
  });
});
