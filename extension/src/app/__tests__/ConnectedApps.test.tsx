// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {ConnectedApps, initialsOf, isoDay, tileOf} from '../screens/ConnectedApps';
import {renderInWallet} from './harness';
import type {HoldClock} from '../ui/HoldButton';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {GRANTS_KEY, type Grant} from '../../background/dapp/grants';
import {BLOCKED_KEY} from '../../background/dapp/blocked';
import {DAPP_SESSION_KEY, EMPTY_SESSION} from '../../background/dapp/store';
import {ACCOUNT} from '../../background/__tests__/fixtures';

// B1c §4.4 (#49, index.html ix:18705-19100; D1, D3, D9, C6, C7) against the real background.
const SELECTORS = selectorsOf(UI_SHEETS);
const DAY = 86_400_000;
const NOW = new Date(new Date().setHours(12, 0, 0, 0)).getTime();
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: NOW - 30 * DAY, lastUsedAt: NOW, recent: [], ...over});
const GRANTS = [
  grant('https://tensor.trade', {connectedAt: NOW - 40 * DAY, lastUsedAt: NOW - 2 * DAY, recent: [{type: 'signMessage', at: NOW - 2 * DAY, outcome: 'approved'}, {type: 'connect', at: NOW - 40 * DAY, outcome: 'approved'}]}),
  grant('https://jup.ag', {lastUsedAt: NOW}),
];
async function seed(ext: {local: {set(k: string, v: unknown): Promise<void>}; session: {set(k: string, v: unknown): Promise<void>}}, o: {session?: boolean; blocked?: boolean} = {}) {
  await ext.local.set(GRANTS_KEY, GRANTS);
  if (o.session === true) await ext.session.set(DAPP_SESSION_KEY, {...EMPTY_SESSION, grants: [grant('https://solana-mint-hub.xyz', {scope: 'session', lastUsedAt: NOW - DAY})]});
  if (o.blocked === true) await ext.local.set(BLOCKED_KEY, [{host: 'tensr.trade', blockedAt: NOW - DAY, imitates: 'tensor.trade'}]);
}
function manualClock() {
  let t = 0;
  const jobs = new Set<() => void>();
  const clock: HoldClock = {now: () => t, every: (_ms, f) => (jobs.add(f), () => void jobs.delete(f))};
  return {clock, advance: (ms: number) => act(() => {
    for (let step = 0; step < ms; step += 30) {
      t += 30;
      for (const f of [...jobs]) f();
    }
  })};
}
const rows = () => [...document.querySelectorAll('.s10-app-row')].filter(r => r.querySelector('.name') !== null) as HTMLElement[];
const show = (o: {session?: boolean; blocked?: boolean; empty?: boolean} = {}, clock = manualClock().clock, now: () => number = () => NOW) =>
  renderInWallet(<ConnectedApps onBack={() => undefined} clock={clock} />, {now, before: async ext => (o.empty === true ? undefined : seed(ext, o))});

describe('#49 connected apps — populated, sort, detail sheet', () => {
  it('49a: "<n> active sessions", the rows — initials tile, name, verified dot (known list only), domain, Connected <date> · last used <when>, the "This session" pill — newest use first', async () => {
    await show({session: true});
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.getByText('Connected apps', {selector: '.top-bar .title.noc-h1-compact'})).toBeTruthy();
    expect(document.querySelector('.s10-summary-bar .count')?.textContent).toBe('3 active sessions');
    expect(document.querySelector('.s10-summary-bar .sort')?.textContent).toBe('Sorted by last used');
    expect(rows().map(r => [r.querySelector('.ico')?.textContent, r.querySelector('.name')?.textContent, r.querySelector('.verified-dot') !== null, r.querySelector('.domain')?.textContent])).toEqual([
      ['JU', 'Jupiter', true, 'jup.ag'],
      ['SM', 'solana-mint-hub', false, 'solana-mint-hub.xyz'],
      ['TE', 'Tensor', true, 'tensor.trade'],
    ]);
    expect(rows()[0]?.querySelector('.meta')?.textContent).toBe(`Connected ${isoDay(NOW - 30 * DAY)} · last used today`);
    expect(rows()[1]?.querySelector('.meta')?.textContent).toBe(`Connected ${isoDay(NOW - 30 * DAY)} · last used yesterdayThis session`);
    expect(rows()[1]?.querySelector('.badge.app-session-pill')?.textContent).toBe('This session');
    expect(rows()[0]?.querySelector('.ico')?.className).toBe(`ico ${tileOf('jup.ag')}`);
    expect(screen.getAllByRole('button', {name: 'Revoke'})).toHaveLength(3);
    expect(document.querySelector('.sticky-bar .btn')?.textContent).toBe('Hold to disconnect all · 3 sessions');
    expect(unstyledClasses(document.querySelector('.app-connected')!, SELECTORS)).toEqual([]);
  });

  it('the Sort button toggles "Sorted by name" and the order', async () => {
    // Tensor used last, so the two orders differ (with GRANTS above they coincide, and a Sort that sorts nothing passes).
    const twoOrders = [grant('https://jup.ag', {lastUsedAt: NOW - 2 * DAY}), grant('https://tensor.trade', {lastUsedAt: NOW})];
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {now: () => NOW, before: async ext => ext.local.set(GRANTS_KEY, twoOrders)});
    await waitFor(() => expect(rows()).toHaveLength(2));
    const names = () => rows().map(r => r.querySelector('.name')?.textContent);
    expect(names()).toEqual(['Tensor', 'Jupiter']);
    fireEvent.click(screen.getByRole('button', {name: 'Sort'}));
    expect(document.querySelector('.s10-summary-bar .sort')?.textContent).toBe('Sorted by name');
    expect(names()).toEqual(['Jupiter', 'Tensor']);
    fireEvent.click(screen.getByRole('button', {name: 'Sort'}));
    expect(document.querySelector('.s10-summary-bar .sort')?.textContent).toBe('Sorted by last used');
    expect(names()).toEqual(['Tensor', 'Jupiter']);
  });

  it('an origin with an explicit port: the row and the sheet show host:port (review 1 L5); one without, the host', async () => {
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {now: () => NOW, before: async ext => ext.local.set(GRANTS_KEY, [grant('https://dapp.test:8443'), grant('https://jup.ag', {lastUsedAt: NOW - DAY})])});
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows().map(r => r.querySelector('.domain')?.textContent)).toEqual(['dapp.test:8443', 'jup.ag']);
    fireEvent.click(rows()[0]!.querySelector('.app-row-open')!);
    expect((await screen.findByRole('dialog')).querySelector('.domain')?.textContent).toBe('dapp.test:8443');
  });

  it('49c: a row tap opens the detail sheet — permissions with the grant date, the session cells, the last interactions', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[1]!);
    const sheet = await screen.findByRole('dialog', {name: 'Tensor'});
    expect(within(sheet).getByText('tensor.trade')).toBeTruthy();
    expect(sheet.querySelector('.app-verified-dot')).not.toBeNull();
    expect([...sheet.querySelectorAll('.group-label')].map(e => e.textContent)).toEqual(['Permissions', 'Session', 'Last 3 interactions']);
    expect([...sheet.querySelectorAll('.s10-perm-row')].map(r => [r.querySelector('.pri')?.textContent, r.querySelector('.sub')?.textContent, r.querySelector('.ts')?.textContent])).toEqual([
      ['Read public keys', 'Granted at connect — view-only', isoDay(NOW - 40 * DAY)],
      ['Sign transactions (with prompt)', 'Each request asks before signing', isoDay(NOW - 40 * DAY)],
      ['Sign messages (with prompt)', 'Each request asks before signing', isoDay(NOW - 40 * DAY)],
    ]);
    expect([...sheet.querySelectorAll('.s10-meta-grid .cell')].map(c => [c.querySelector('.k')?.textContent, c.querySelector('.v')?.textContent])).toEqual([
      ['Connected', isoDay(NOW - 40 * DAY)],
      ['Last used', '2 days ago'],
      ['Scope', 'Until revoked'],
    ]);
    expect([...sheet.querySelectorAll('.s10-history .row')].map(r => [r.querySelector('.op')?.textContent, r.querySelector('.when')?.textContent])).toEqual([
      ['Sign message (approved)', '2 d ago'],
      ['Connect (approved)', '40 d ago'],
    ]);
    expect(unstyledClasses(sheet, SELECTORS)).toEqual([]);
    fireEvent.click(within(sheet).getByRole('button', {name: 'Close'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('[Revoke this connection] in the sheet revokes (no hold, rule 6) and shows the undo toast', async () => {
    const w = await show();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[0]!);
    fireEvent.click(await screen.findByRole('button', {name: 'Revoke this connection'}));
    await waitFor(() => expect(screen.getByText('Jupiter revoked')).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[]).map(g => g.origin)).toEqual(['https://tensor.trade']);
  });
});

describe('#49 revoke and undo (§2.7, 49e)', () => {
  it('Revoke: the row leaves at once, the toast says "<name> revoked · undo · 5 s"; UNDO restores exactly that grant, single-shot', async () => {
    const w = await show();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rows()[0]!).getByRole('button', {name: 'Revoke'}));
    expect(rows().map(r => r.querySelector('.name')?.textContent)).toEqual(['Tensor']);
    const toast = await screen.findByRole('status');
    expect([toast.querySelector('.body')?.textContent, toast.querySelector('.timer')?.textContent, toast.querySelector('.undo-btn')?.textContent]).toEqual(['Jupiter revoked', 'undo · 5 s', 'UNDO']);
    expect(unstyledClasses(toast, SELECTORS)).toEqual([]);
    fireEvent.click(within(toast).getByRole('button', {name: 'UNDO'}));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByText('Jupiter revoked')).toBeNull();
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[]).map(g => g.origin).sort()).toEqual(['https://jup.ag', 'https://tensor.trade']);
  });

  it('the countdown runs on the clock and the toast goes after five seconds (the grant stays revoked)', async () => {
    let t = NOW;
    await show({}, manualClock().clock, () => t);
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rows()[0]!).getByRole('button', {name: 'Revoke'}));
    await screen.findByText('undo · 5 s');
    t += 2_100;
    expect(await screen.findByText('undo · 3 s', {}, {timeout: 1_500})).toBeTruthy();
    t += 3_000;
    await waitFor(() => expect(screen.queryByText('Jupiter revoked')).toBeNull(), {timeout: 1_500});
    expect(rows().map(r => r.querySelector('.name')?.textContent)).toEqual(['Tensor']);
  });
});

describe('#49 disconnect all (49d) — the 600 ms hold', () => {
  it('while held: rows at .55, per-row Revoke off, "Hold to revoke all", the helper, the count in two places; released early nothing happens; held 600 ms every grant goes', async () => {
    const c = manualClock();
    const w = await show({session: true}, c.clock);
    await waitFor(() => expect(rows()).toHaveLength(3));
    const hold = document.querySelector('.sticky-bar .btn') as HTMLButtonElement;
    fireEvent.pointerDown(hold, {button: 0});
    c.advance(360);
    expect(rows().every(r => r.className === 's10-app-row app-row-dim')).toBe(true);
    expect(screen.getAllByRole('button', {name: 'Revoke'}).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    expect([document.querySelector('.s10-summary-bar .sort')?.textContent, document.querySelector('.s10-summary-bar .sort')?.className]).toEqual(['Hold to revoke all', 'sort app-hold-note']);
    expect(screen.getByText('All 3 sessions will be wiped · release the button to cancel')).toBeTruthy();
    expect(hold.textContent).toBe('Hold to disconnect all · 0.24 s');
    fireEvent.pointerUp(hold);
    expect(hold.textContent).toBe('Hold to disconnect all · 3 sessions');
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[])).toHaveLength(2);
    fireEvent.pointerDown(hold, {button: 0});
    c.advance(630);
    await screen.findByText('No connected apps');
    expect(await w.ext.local.get(GRANTS_KEY)).toEqual([]);
  });
});

describe('#49 empty, blocked sites, loading, failure', () => {
  it('49b empty: "No connected apps", Q14 — no Browse button (D1) — and Disconnect all disabled', async () => {
    await show({empty: true});
    expect(await screen.findByText('No connected apps')).toBeTruthy();
    expect(screen.getByText('When you connect a site, it appears here.')).toBeTruthy();
    expect(screen.queryByText(/Browse/)).toBeNull();
    const all = screen.getByRole('button', {name: 'Disconnect all'}) as HTMLButtonElement;
    expect([all.disabled, all.className]).toEqual([true, 'btn btn-primary app-delete-gated']);
    expect(screen.queryByRole('button', {name: 'Sort'})).toBeNull();
    expect(unstyledClasses(document.querySelector('.app-connected')!, SELECTORS)).toEqual([]);
  });

  it('blocked sites (D3, Q13): the host in mono, "Blocked <date>", "Looked like <domain>", [Unblock] — which removes only the block', async () => {
    const w = await show({blocked: true});
    expect(await screen.findByText('Blocked sites')).toBeTruthy();
    const row = screen.getByText('tensr.trade').closest('.s10-app-row') as HTMLElement;
    expect(row.querySelector('.meta')?.textContent).toBe(`Blocked ${isoDay(NOW - DAY)}Looked like tensor.trade`);
    fireEvent.click(within(row).getByRole('button', {name: 'Unblock'}));
    await waitFor(() => expect(screen.queryByText('Blocked sites')).toBeNull());
    expect(await w.ext.local.get(BLOCKED_KEY)).toEqual([]);
  });

  it('the skeleton while it reads (49e: five rows), then the list', async () => {
    let release = () => undefined as void;
    const held = new Promise<void>(r => (release = r));
    renderInWallet(<ConnectedApps onBack={() => undefined} />, {now: () => NOW, before: ext => seed(ext), gate: m => ((m as {type: string}).type === 'dapp.grants.list' ? held : undefined)});
    await waitFor(() => expect(document.querySelectorAll('.s10-skel-row')).toHaveLength(5));
    expect(unstyledClasses(document.querySelector('.app-connected')!, SELECTORS)).toEqual([]);
    release();
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it('a failed read: Q15 and Try again', async () => {
    renderInWallet(<ConnectedApps onBack={() => undefined} />, {now: () => NOW, gate: m => ((m as {type: string}).type === 'dapp.grants.list' ? Promise.reject(new Error('down')) : undefined)});
    expect(await screen.findByText('Could not load your connections. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Try again'})).toBeTruthy();
  });

  it('initials (C6) and the tile gradient are the host’s, deterministic', () => {
    expect([initialsOf('Magic Eden'), initialsOf('Tensor'), initialsOf('solana-mint-hub'), initialsOf('x')]).toEqual(['ME', 'TE', 'SM', 'X']);
    expect(tileOf('jup.ag')).toBe(tileOf('jup.ag'));
  });
});
