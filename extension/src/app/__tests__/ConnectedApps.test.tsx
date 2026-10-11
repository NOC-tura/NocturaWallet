// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {ConnectedApps, initialsOf, isoDay, tileOf} from '../screens/ConnectedApps';
import {renderInWallet, setupWallet} from './harness';
import {WalletProvider} from '../WalletContext';
import type {HoldClock} from '../ui/HoldButton';
import type {Engine} from '../engine';
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
    // Review 1 I2c/I2d: the Sort button becomes the spacer, and the list behind dims to .4, while the sheet is open.
    expect(screen.getByRole('button', {name: 'Sort'})).toBeTruthy();
    expect(document.querySelector('.scroll-area.app-connected-body')?.classList.contains('app-dim-behind-sheet')).toBe(false);
    fireEvent.click(rows()[1]!);
    const sheet = await screen.findByRole('dialog', {name: 'Tensor'});
    expect(screen.queryByRole('button', {name: 'Sort'})).toBeNull();
    expect(document.querySelector('.top-bar .app-top-spacer')).not.toBeNull();
    expect(document.querySelector('.scroll-area.app-connected-body')?.classList.contains('app-dim-behind-sheet')).toBe(true);
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
    // Closed: the Sort button and the full-opacity list are back.
    expect(screen.getByRole('button', {name: 'Sort'})).toBeTruthy();
    expect(document.querySelector('.scroll-area.app-connected-body')?.classList.contains('app-dim-behind-sheet')).toBe(false);
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
    // Review 1 I2f: the count in the helper is its own node (`.noc-numeral`), not flattened into the sentence — so
    // the whole line is read from the element's own textContent, not `getByText` (RTL does not match split text by default).
    expect(document.querySelector('.app-hold-helper')?.textContent).toBe('All 3 sessions will be wiped · release the button to cancel');
    expect(document.querySelector('.app-hold-helper .noc-numeral')?.textContent).toBe('3');
    // Review 1 I2c: the Sort button is the 22 px spacer while held.
    expect(screen.queryByRole('button', {name: 'Sort'})).toBeNull();
    expect(document.querySelector('.top-bar .app-top-spacer')).not.toBeNull();
    // Review 1 I2e: each row's meta drops "Connected <date> ·" while held — only "last used <when>" shows.
    expect(rows().map(r => r.querySelector('.meta > span:first-child')?.textContent)).toEqual(['last used today', 'last used yesterday', 'last used 2 days ago']);
    expect(hold.textContent).toBe('Hold to disconnect all · 0.24 s');
    fireEvent.pointerUp(hold);
    expect(hold.textContent).toBe('Hold to disconnect all · 3 sessions');
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[])).toHaveLength(2);
    // Released: the Sort button and the "Connected <date> ·" lead-in are back.
    expect(screen.getByRole('button', {name: 'Sort'})).toBeTruthy();
    expect(rows()[0]?.querySelector('.meta > span:first-child')?.textContent).toBe(`Connected ${isoDay(NOW - 30 * DAY)} · last used today`);
    fireEvent.pointerDown(hold, {button: 0});
    c.advance(630);
    await screen.findByText('No connected apps');
    expect(await w.ext.local.get(GRANTS_KEY)).toEqual([]);
  });

  // Review 1, I1: `done.current` on HoldButton used to be set once and never cleared — a disconnectAll that failed, or
  // one a fresh grant outlived, left that instance permanently spent. Both fixed by keying HoldButton on a counter
  // bumped after every completed hold.
  it('I1: a failing disconnectAll shows the existing failed state (Q15); Try again reads fresh and the hold works again', async () => {
    const c = manualClock();
    let fail = true;
    const w = await renderInWallet(<ConnectedApps onBack={() => undefined} clock={c.clock} />, {
      now: () => NOW,
      before: async ext => seed(ext),
      gate: m => ((m as {type: string}).type === 'dapp.grants.revokeAll' && fail ? Promise.reject(new Error('down')) : undefined),
    });
    await waitFor(() => expect(rows()).toHaveLength(2));
    const hold = document.querySelector('.sticky-bar .btn') as HTMLButtonElement;
    fireEvent.pointerDown(hold, {button: 0});
    c.advance(630);
    expect(await screen.findByText('Could not load your connections. Try again.')).toBeTruthy();
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[])).toHaveLength(2); // the failed call never reached the background
    fail = false;
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    await waitFor(() => expect(rows()).toHaveLength(2));
    const hold2 = document.querySelector('.sticky-bar .btn') as HTMLButtonElement;
    fireEvent.pointerDown(hold2, {button: 0});
    c.advance(630);
    await screen.findByText('No connected apps');
    expect(await w.ext.local.get(GRANTS_KEY)).toEqual([]);
  });

  it('I1: a grant arriving between the revoke and #49’s own re-read leaves the hold usable, not spent', async () => {
    const c = manualClock();
    let listCalls = 0;
    let w!: Awaited<ReturnType<typeof renderInWallet>>;
    const gate = async (m: unknown) => {
      if ((m as {type: string}).type !== 'dapp.grants.list') return;
      listCalls += 1;
      // The second read is #49's own re-read right after a successful revokeAll — a fresh connection lands first.
      if (listCalls === 2) await w.ext.local.set(GRANTS_KEY, [grant('https://new-dapp.test')]);
    };
    w = await renderInWallet(<ConnectedApps onBack={() => undefined} clock={c.clock} />, {now: () => NOW, before: async ext => seed(ext), gate});
    await waitFor(() => expect(rows()).toHaveLength(2));
    const hold = document.querySelector('.sticky-bar .btn') as HTMLButtonElement;
    fireEvent.pointerDown(hold, {button: 0});
    c.advance(630);
    // Both original grants are gone, but the fresh one survived the race — this HoldButton instance is still mounted.
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(document.querySelector('.sticky-bar .btn')?.textContent).toBe('Hold to disconnect all · 1 session');
    const hold2 = document.querySelector('.sticky-bar .btn') as HTMLButtonElement;
    fireEvent.pointerDown(hold2, {button: 0});
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
    // Review 1 I2g: the empty state's own scroll-area is centred (ix:18812), not top-anchored like every other state.
    expect(document.querySelector('.scroll-area.app-connected-body-empty')).not.toBeNull();
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

  it('the skeleton while it reads (49e: five rows, each its own sub-line width, "Loading sessions…"), then the list', async () => {
    let release = () => undefined as void;
    const held = new Promise<void>(r => (release = r));
    renderInWallet(<ConnectedApps onBack={() => undefined} />, {now: () => NOW, before: ext => seed(ext), gate: m => ((m as {type: string}).type === 'dapp.grants.list' ? held : undefined)});
    await waitFor(() => expect(document.querySelectorAll('.s10-skel-row')).toHaveLength(5));
    // Review 1 I2a: the design's own summary bar sits above the skeleton too.
    const count = document.querySelector('.s10-summary-bar .count') as HTMLElement;
    expect(count.textContent).toBe('Loading sessions…');
    expect(count.classList.contains('app-skel-loading')).toBe(true);
    expect(document.querySelector('.s10-summary-bar .sort')?.textContent).toBe('');
    // Review 1 I2b: each row's sub-line has its own width (78/64/84/70/72 %), not one flat width repeated five times.
    expect([...document.querySelectorAll('.s10-skel-row .skel-line.app-skel-sub')].map(e => e.className)).toEqual([
      'skel-line app-skel-sub app-sub78',
      'skel-line app-skel-sub app-sub64',
      'skel-line app-skel-sub app-sub84',
      'skel-line app-skel-sub app-sub70',
      'skel-line app-skel-sub app-sub72',
    ]);
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

describe('#49 the undo deadline (review 1, h)', () => {
  it('is taken at the click, before the (possibly slow) revoke reply — never later', async () => {
    let t = NOW;
    let release: () => void = () => undefined;
    let gated = false;
    const held = new Promise<void>(r => (release = r));
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {
      now: () => t,
      before: async ext => seed(ext),
      gate: m => {
        if ((m as {type: string}).type === 'dapp.grants.revoke' && !gated) {
          gated = true;
          return held;
        }
        return undefined;
      },
    });
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rows()[0]!).getByRole('button', {name: 'Revoke'}));
    expect(gated).toBe(true);
    expect(screen.queryByText('Jupiter revoked')).toBeNull(); // the reply has not landed yet
    // A slow reply: four (simulated) seconds pass before the background answers.
    t += 4_000;
    release();
    // The deadline was fixed at the click (NOW + 5 s), not recomputed against the now-advanced clock after the await
    // (which would read NOW + 4 s + 5 s and so show "9 s" — offering UNDO past the background's own 5 s buffer). Read
    // synchronously off the element the instant it appears — `findByText` would poll for up to a second, long enough
    // for #49's own display clock (ticking every real second) to catch up to `t` and mask a buggy later capture too.
    const toast = await screen.findByRole('status');
    expect(toast.querySelector('.timer')?.textContent).toBe('undo · 5 s');
  });
});

describe('#49 every await is guarded (review 1, j): a late answer after unmount, and an overtaken read', () => {
  it('load(): an older read overtaken by a newer one sets nothing from the stale answer', async () => {
    const w0 = await setupWallet({before: async ext => seed(ext)});
    let callNum = 0;
    let release2: () => void = () => undefined;
    const engine: Engine = {
      ...w0.engine,
      dappGrants: () => {
        callNum += 1;
        if (callNum === 2) {
          // Fetched now (storage still at two grants) — released later, so it answers with what it would really
          // have answered at the time it was asked, not a fresh read of whatever storage holds by then.
          const stale = w0.engine.dappGrants();
          return new Promise(resolve => (release2 = () => void stale.then(resolve)));
        }
        return w0.engine.dappGrants();
      },
    };
    render(
      <WalletProvider engine={engine} platform={w0.platform} surface="popup">
        <ConnectedApps onBack={() => undefined} clock={manualClock().clock} />
      </WalletProvider>,
    );
    await waitFor(() => expect(rows()).toHaveLength(2));
    window.dispatchEvent(new Event('focus')); // the second (held) read starts
    await waitFor(() => expect(callNum).toBe(2));
    await w0.ext.local.set(GRANTS_KEY, [...GRANTS, grant('https://fresh.test')]);
    window.dispatchEvent(new Event('focus')); // the third read, fresh, overtakes the still-pending second
    await waitFor(() => expect(rows()).toHaveLength(3));
    release2(); // the stale second read answers last, with the OLD two-grant snapshot — it must be dropped
    await new Promise(r => setTimeout(r, 30));
    expect(rows()).toHaveLength(3);
  });

  it('load(): a "locked" reply landing after unmount triggers no reload', async () => {
    let stateReads = 0;
    const w = await setupWallet({before: async ext => seed(ext), gate: m => void ((m as {type: string}).type === 'wallet.state' && stateReads++)});
    let release: (v: Awaited<ReturnType<Engine['dappGrants']>>) => void = () => undefined;
    const held = new Promise<Awaited<ReturnType<Engine['dappGrants']>>>(r => (release = r));
    const engine: Engine = {...w.engine, dappGrants: () => held};
    const {unmount} = render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <ConnectedApps onBack={() => undefined} clock={manualClock().clock} />
      </WalletProvider>,
    );
    await waitFor(() => expect(document.querySelectorAll('.s10-skel-row')).toHaveLength(5));
    unmount();
    const before = stateReads;
    release({ok: false, error: 'locked'});
    await new Promise(r => setTimeout(r, 30));
    expect(stateReads).toBe(before);
  });

  it('revoke(): a reply landing after unmount triggers no re-read', async () => {
    let listReads = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let gatedOnce = false;
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {
      now: () => NOW,
      before: async ext => seed(ext),
      gate: m => {
        const t = (m as {type: string}).type;
        if (t === 'dapp.grants.list') listReads += 1;
        if (t === 'dapp.grants.revoke' && !gatedOnce) {
          gatedOnce = true;
          return held;
        }
        return undefined;
      },
    });
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rows()[0]!).getByRole('button', {name: 'Revoke'}));
    await waitFor(() => expect(gatedOnce).toBe(true));
    cleanup();
    const before = listReads;
    release();
    await new Promise(r => setTimeout(r, 30));
    expect(listReads).toBe(before);
  });

  it('undo(): a reply landing after unmount triggers no re-read', async () => {
    let listReads = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let gatedOnce = false;
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {
      now: () => NOW,
      before: async ext => seed(ext),
      gate: m => {
        const t = (m as {type: string}).type;
        if (t === 'dapp.grants.list') listReads += 1;
        if (t === 'dapp.grants.undo' && !gatedOnce) {
          gatedOnce = true;
          return held;
        }
        return undefined;
      },
    });
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rows()[0]!).getByRole('button', {name: 'Revoke'}));
    const toast = await screen.findByRole('status');
    fireEvent.click(within(toast).getByRole('button', {name: 'UNDO'}));
    await waitFor(() => expect(gatedOnce).toBe(true));
    cleanup();
    const before = listReads;
    release();
    await new Promise(r => setTimeout(r, 30));
    expect(listReads).toBe(before);
  });

  it('disconnectAll(): a reply landing after unmount triggers no re-read', async () => {
    let listReads = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let gatedOnce = false;
    const c = manualClock();
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={c.clock} />, {
      now: () => NOW,
      before: async ext => seed(ext),
      gate: m => {
        const t = (m as {type: string}).type;
        if (t === 'dapp.grants.list') listReads += 1;
        if (t === 'dapp.grants.revokeAll' && !gatedOnce) {
          gatedOnce = true;
          return held;
        }
        return undefined;
      },
    });
    await waitFor(() => expect(rows()).toHaveLength(2));
    const hold = document.querySelector('.sticky-bar .btn') as HTMLButtonElement;
    fireEvent.pointerDown(hold, {button: 0});
    c.advance(630);
    await waitFor(() => expect(gatedOnce).toBe(true));
    cleanup();
    const before = listReads;
    release();
    await new Promise(r => setTimeout(r, 30));
    expect(listReads).toBe(before);
  });

  it('unblock(): a reply landing after unmount triggers no re-read', async () => {
    let listReads = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let gatedOnce = false;
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {
      now: () => NOW,
      before: async ext => seed(ext, {blocked: true}),
      gate: m => {
        const t = (m as {type: string}).type;
        if (t === 'dapp.grants.list') listReads += 1;
        if (t === 'dapp.blocked.remove' && !gatedOnce) {
          gatedOnce = true;
          return held;
        }
        return undefined;
      },
    });
    const row = (await screen.findByText('tensr.trade')).closest('.s10-app-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', {name: 'Unblock'}));
    await waitFor(() => expect(gatedOnce).toBe(true));
    cleanup();
    const before = listReads;
    release();
    await new Promise(r => setTimeout(r, 30));
    expect(listReads).toBe(before);
  });
});

describe('#49 rule 6: no double submit', () => {
  /**
   * Two clicks dispatched inside one `act()`: React batches both before committing, so the SECOND reaches the button
   * while it is still mounted and not yet disabled in the DOM — exactly "a second click in the same frame, before
   * React re-renders" (LockedButton's own doc). Revoke, "Revoke this connection" and UNDO all remove their own button
   * from the tree as part of the very same press (the optimistic remove), so the usual "click, lift disabled, click
   * again" pattern would dispatch the second click at a node React has already detached — this reaches the real guard
   * (the ref, not the disabled attribute) instead.
   */
  function doublePress(btn: HTMLButtonElement) {
    act(() => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
  }
  function counts() {
    const n: Record<string, number> = {};
    const gate = (m: unknown) => {
      const t = (m as {type: string}).type;
      n[t] = (n[t] ?? 0) + 1;
    };
    return {gate, count: (t: string) => n[t] ?? 0};
  }

  it('the row’s Revoke fires dapp.grants.revoke once for two taps in the same frame', async () => {
    const c = counts();
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {now: () => NOW, before: async ext => seed(ext), gate: c.gate});
    await waitFor(() => expect(rows()).toHaveLength(2));
    doublePress(within(rows()[0]!).getByRole('button', {name: 'Revoke'}) as HTMLButtonElement);
    await waitFor(() => expect(c.count('dapp.grants.revoke')).toBe(1));
  });

  it('"Revoke this connection" in the sheet fires dapp.grants.revoke once for two taps in the same frame', async () => {
    const c = counts();
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {now: () => NOW, before: async ext => seed(ext), gate: c.gate});
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[0]!);
    const btn = (await screen.findByRole('button', {name: 'Revoke this connection'})) as HTMLButtonElement;
    doublePress(btn);
    await waitFor(() => expect(c.count('dapp.grants.revoke')).toBe(1));
  });

  it('UNDO fires dapp.grants.undo once for two taps in the same frame', async () => {
    const c = counts();
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {now: () => NOW, before: async ext => seed(ext), gate: c.gate});
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rows()[0]!).getByRole('button', {name: 'Revoke'}));
    const toast = await screen.findByRole('status');
    doublePress(within(toast).getByRole('button', {name: 'UNDO'}) as HTMLButtonElement);
    await waitFor(() => expect(c.count('dapp.grants.undo')).toBe(1));
  });

  it('[Unblock] fires dapp.blocked.remove once for two taps in the same frame', async () => {
    const c = counts();
    await renderInWallet(<ConnectedApps onBack={() => undefined} clock={manualClock().clock} />, {now: () => NOW, before: async ext => seed(ext, {blocked: true}), gate: c.gate});
    const row = (await screen.findByText('tensr.trade')).closest('.s10-app-row') as HTMLElement;
    doublePress(within(row).getByRole('button', {name: 'Unblock'}) as HTMLButtonElement);
    await waitFor(() => expect(c.count('dapp.blocked.remove')).toBe(1));
  });
});
