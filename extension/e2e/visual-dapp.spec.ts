import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {contained, launchPopup, seedUnlockedWallet, MAIN, SAVINGS, type Harness} from './popupHarness';
import {DAPP_HOSTS, approvalWindow, connect, openDapp, serveDapp, sign, windowClosed, type DappServer} from './dappPage';
import {gateClear, shot} from './visualTab';

// Spec B1c §6.4: every B1c-1 state the real extension can be put in, saved for the opus-tier review against index.html
// (#46 ix:17442-17686, #47 ix:17686-18261, #49 ix:18705-19100, #31 ix:13552) — not a pixel diff. The approval window at
// 412 × 720 (its windows.create size), #49 in the popup at 412 × 600. Every state asserts its own copy before its shot.
// The window budget and the cooldown are reset between states (`fresh`): the pass opens more windows than C14 allows in
// ten minutes, by design of the pass, not of a user.
//
// Four states beyond the plan's own enumeration, all created by review fixes landed after the plan's dry run (not
// present when its own code was written): #46 `sign === null` (the account unlocked no more — a bare top bar, a
// Reject-only exit, Task 9 review fix round 1 item 2); #46 a lookalike origin AND a SIWS domain mismatch together
// (keeps the lookalike bar — Reject-and-report, never Sign/Sign-anyway — item 4); the locked window with Q24 latched
// (Task 8 review fix round 1, I1 — the notice is shown there too, not only once unlocked); #49's loading skeleton
// (Task 10 review fix round 1, I2a — the design's own summary bar over the skeleton rows). Every other review-fix
// item named in the task brief (no disclaimer on a lookalike, app-cta-busy, btn-destructive, the Sort-button spacer,
// the dimmed list behind the sheet, the held-state row meta, the hold helper's numeral, the centred empty state) is a
// style change on a state the plan's own list already shoots — the current source is what the harness renders, so
// those shots already show the committed behaviour with no code change needed here.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>}; session: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
};
const DAY = 86_400_000;
const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);
const fresh = (sw: Worker, notice = false) => set(sw, {v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice}});
const siws = (domain: string) => [`${domain} wants you to sign in with your Solana account:`, MAIN.publicKey, '', 'Sign in to the test dApp.', '', `URI: https://${domain}`, 'Version: 1', 'Chain ID: solana:mainnet', 'Nonce: 4f3a92ceb1d8', 'Issued At: 2026-10-10T09:40:23Z'].join('\n');
const grant = (origin: string, o: {scope?: string; lastUsedAt?: number; connectedAt?: number; recent?: object[]} = {}) => ({
  origin,
  account: MAIN.publicKey,
  scope: o.scope ?? 'persistent',
  connectedAt: o.connectedAt ?? Date.now() - 30 * DAY,
  lastUsedAt: o.lastUsedAt ?? Date.now(),
  recent: o.recent ?? [],
});
/** A computed style of the element (the `css()` helper pattern, visual-settings.spec.ts:50) — real Chromium, not happy-dom. */
const css = (l: Locator, prop: string) => l.evaluate((e, x) => getComputedStyle(e).getPropertyValue(x), prop);

/**
 * A window state: its own copy first, then the shot (the pointer off the column; `ready`, a held CTA, awaited enabled).
 * B1c-3: a #47 state with the gate line (`'gate'`) also proves the line clear of the scroll area (`gateClear`).
 */
async function still(win: Page, name: string, visible: Locator, ready?: Locator, gate: 'gate' | 'no-gate' = 'no-gate'): Promise<void> {
  await expect(visible).toBeVisible();
  // Final review (Task 8's deferred minor): whether the state draws #47's gate line is the caller's statement, checked
  // both ways — a state named 'gate' whose line is absent fails here (never a silently skipped gateClear), and a state
  // named 'no-gate' that draws one fails too.
  await expect(win.locator('.app-approve > .s9-gate-status'), `${name}: ${gate === 'gate' ? 'the gate line drawn' : 'no gate line'}`).toHaveCount(gate === 'gate' ? 1 : 0);
  if (gate === 'gate') await gateClear(win);
  await win.mouse.move(0, 0);
  await shot(win, name, {fullPage: false, ...(ready === undefined ? {} : {ready})});
}
/** The approval window for a request `ask` makes, at its 412 × 720; `hold` keeps every dapp.decide unanswered until released. */
async function windowFor(h: Harness, ask: () => unknown): Promise<Page> {
  const win = await approvalWindow(h.ctx, ask);
  await win.setViewportSize({width: 412, height: 720});
  return win;
}
/** Answers the window's request (✕ = Reject) and waits for the window to close itself. */
async function dismiss(win: Page): Promise<void> {
  const closed = win.waitForEvent('close');
  await win.getByRole('button', {name: 'Close'}).click();
  await closed;
}

/**
 * A popup shot (fix round 1): the state's own element in the viewport AND clear of the pinned bars — not drawn under
 * the top bar or the action bar (the B1b `pop` helper's pattern, visual-settings.spec.ts). `still()`'s
 * `scrollIntoViewIfNeeded` no-ops when the element is already geometrically inside the viewport, which says nothing
 * about a `position: sticky` bar painted on top of it (`49-blocked-section` landed byte-identical to `49a-populated`
 * this way — the sticky action bar covered the heading, and nothing ever scrolled). The native `scrollIntoView`
 * always scrolls; `under()` is re-checked after, not assumed.
 */
async function pop(page: Page, name: string, visible: Locator): Promise<void> {
  const bars = page.locator('main.app-content > .screen > .top-bar, main.app-content > .screen > .sticky-bar, nav.app-tab-bar');
  const under = async (): Promise<string | null> => {
    const box = await visible.boundingBox();
    if (box === null) return 'no box';
    const el = await visible.elementHandle();
    for (const bar of await bars.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  if ((await under()) !== null) await visible.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(visible).toBeInViewport();
  expect(await under(), `${name}: the state's element clear of the pinned bars`).toBeNull();
  await shot(page, name, {fullPage: false});
}

async function scene(): Promise<{h: Harness; server: DappServer}> {
  const h = await launchPopup('noctura-e2e-visual-dapp-', {hosts: DAPP_HOSTS});
  const server = await serveDapp(h.ctx);
  await seedUnlockedWallet(h.sw);
  // A decision held open: approve.html's sendMessage for dapp.decide waits while window.__holdDecide is set (the
  // in-progress states "Connecting…" and "Signing…").
  await h.ctx.addInitScript(() => {
    if (location.pathname !== '/approve.html') return;
    const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
    const send = rt.sendMessage.bind(rt);
    const w = window as unknown as {__holdDecide?: boolean};
    rt.sendMessage = (m: unknown) => ((m as {type?: string}).type === 'dapp.decide' && w.__holdDecide === true ? new Promise(() => undefined) : send(m));
  });
  return {h, server};
}

test('visual · #47: 47a ×3, 47b ×4, lookalike (and its confirm), cap, connecting; the locked window; the queue lines (Q12, Q24)', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene();
  try {
    // A popup read keeps contained() honest (the coordinator route saw the popup's balance reads).
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});

    // 47a — verified (jup.ag).
    const jup = await openDapp(h.ctx, 'https://jup.ag');
    await fresh(h.sw);
    let win = await windowFor(h, () => connect(jup));
    await still(win, '47a-initial', win.getByText('0 of 1 acknowledgments'), win.getByRole('button', {name: 'Reject'}), 'gate');
    // aria-disabled, not disabled (#47 E: the tap shakes the unmet gate): Playwright's actionability check would wait for it.
    await win.getByRole('button', {name: 'Connect', exact: true}).click({force: true});
    await still(win, '47a-locked-tap', win.getByText('Read the permissions above before connecting'), undefined, 'gate');
    await win.getByRole('checkbox').click();
    await still(win, '47a-acknowledged', win.getByText('Ready to connect'), win.getByRole('button', {name: 'Connect', exact: true}), 'gate');
    await win.getByRole('radio', {name: /Until I revoke/}).click();
    await win.evaluate(() => void ((window as unknown as {__holdDecide: boolean}).__holdDecide = true));
    await win.getByRole('button', {name: 'Connect', exact: true}).click();
    await still(win, '47-connecting', win.getByRole('button', {name: 'Connecting…'}), undefined, 'gate');
    await win.close();

    // 47b — unknown (dapp.test), then an international (xn--) unknown host for Q18.
    const dapp = await openDapp(h.ctx, 'https://dapp.test');
    await fresh(h.sw);
    win = await windowFor(h, () => connect(dapp));
    await expect(win.getByText('0 of 2 acknowledgments')).toBeVisible();
    // Fix round 2, I2 (proven in Chromium, not happy-dom): the unacked domain-ack box's check glyph is transparent —
    // `.s9-flag-banner .ack .box svg { color: inherit }` wins over the banner's own `svg { color: var(--warning) }`.
    // Reverting that rule in a scratch copy turns this red (the svg's computed colour becomes the warning amber).
    const domainBoxSvg = win.locator('.s9-flag-banner .ack .box svg');
    await expect(domainBoxSvg).toBeVisible();
    expect(await css(domainBoxSvg, 'color')).toBe('rgba(0, 0, 0, 0)');
    await still(win, '47b-initial', win.getByText('0 of 2 acknowledgments'), win.getByRole('button', {name: 'Reject'}), 'gate');

    // New shot: 47b's own locked tap (two gates: the hint names both, unlike 47a's one-gate hint).
    await win.getByRole('button', {name: 'Connect for this session', exact: true}).click({force: true});
    await still(win, '47b-locked-tap', win.getByText('Acknowledge both gates to connect'), undefined, 'gate');

    // New shot: the scope card, scrolled into view — "Recommended for unknown" (Q19), "Until I revoke" disabled.
    const scope = win.getByRole('radiogroup', {name: 'Recommended for unknown'});
    await scope.scrollIntoViewIfNeeded();
    await expect(win.getByText('Connection ends when the wallet locks · safest option for unknown domains')).toBeVisible();
    const persistentOption = win.getByRole('radio', {name: /Until I revoke/});
    await expect(persistentOption).toBeDisabled();
    await still(win, '47b-scope-card', scope, undefined, 'gate');

    await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
    // Fix round 2, I2's positive control: acked, the same box's icon is no longer transparent (`.is-acked .box`'s
    // own `background`/`color` now wins — the same element, a different class, a different real colour).
    expect(await css(domainBoxSvg, 'color')).not.toBe('rgba(0, 0, 0, 0)');
    await still(win, '47b-domain-acked', win.getByText('1 of 2 acknowledgments'), undefined, 'gate');
    await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
    await still(win, '47b-fully-acked', win.getByText('Ready to connect · for this session'), win.getByRole('button', {name: 'Connect for this session'}), 'gate');
    await dismiss(win);
    const idn = await openDapp(h.ctx, 'https://xn--bcher-kva.example');
    await fresh(h.sw);
    win = await windowFor(h, () => connect(idn));
    await still(win, '47b-international', win.getByText('This address uses international characters: xn--bcher-kva.example'), undefined, 'gate');
    await dismiss(win);

    // Lookalike — rule b (tensr.trade) with its confirm and its gates; rule a (the Cyrillic phantom).
    const tensr = await openDapp(h.ctx, 'https://tensr.trade');
    await fresh(h.sw);
    win = await windowFor(h, () => connect(tensr));
    await still(win, '47-lookalike', win.getByText('It looks like tensor.trade but is a different site.'), win.getByRole('button', {name: 'Connect anyway (not recommended)'}));
    await win.getByRole('button', {name: 'Connect anyway (not recommended)'}).click();
    await still(win, '47-lookalike-confirm', win.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    await win.getByRole('button', {name: 'I understand the risk'}).click();
    await still(win, '47-lookalike-gates', win.getByText('0 of 2 acknowledgments'), undefined, 'gate');
    await dismiss(win);
    const phantom = await openDapp(h.ctx, 'https://xn--phntom-4nf.app');
    await fresh(h.sw);
    win = await windowFor(h, () => connect(phantom));
    await still(win, '47-lookalike-idn', win.getByText('The Punycode form is', {exact: false}), win.getByRole('button', {name: 'Connect anyway (not recommended)'}));
    await dismiss(win);

    // Cap (Q16): 200 persistent grants.
    await set(h.sw, {v1_dapp_grants: Array.from({length: 200}, (_, i) => grant(`https://s${i}.test`))});
    await fresh(h.sw);
    win = await windowFor(h, () => connect(dapp));
    await still(win, '47-cap', win.getByText('You have 200 connected apps. Revoke one in Settings first.'));
    await dismiss(win);
    await set(h.sw, {v1_dapp_grants: []});

    // The queue: two waiting behind the head (Q12) and the budget notice (Q24); the third request's Block this site (Q17).
    await fresh(h.sw, true);
    win = await windowFor(h, () => connect(dapp));
    connect(jup).catch(() => undefined);
    connect(tensr).catch(() => undefined);
    // The window asks again on focus (§2.3): the two that arrived after its first read now show.
    await expect.poll(async () => {
      await win.evaluate(() => void window.dispatchEvent(new Event('focus')));
      return win.getByText('2 more requests waiting').count();
    }).toBe(1);
    await still(win, '47-queue-and-notice', win.getByText('2 more requests waiting'), undefined, 'gate');
    for (let i = 0; i < 3; i++) await win.getByRole('button', {name: 'Close'}).click();
    // Fix round 1: `waitForEvent('close')` registered AFTER the clicks races the window's own close() (dry-run
    // record item 5) — polled instead, same as `dismiss()`.
    await windowClosed(win);
    await set(h.sw, {v1_dapp_limits: {rejections: [{key: 'host:dapp.test', at: Date.now()}, {key: 'host:dapp.test', at: Date.now()}], cooldowns: [], windows: [], notice: false}});
    win = await windowFor(h, () => connect(dapp));
    await still(win, '47-block-this-site', win.getByRole('button', {name: 'Block this site'}), undefined, 'gate');
    await dismiss(win);

    // The locked window (D11).
    await fresh(h.sw);
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    win = await windowFor(h, () => connect(dapp));
    await still(win, 'window-locked', win.getByText('Noctura is locked'), win.getByRole('button', {name: 'Reject'}));
    await win.getByRole('button', {name: 'Reject'}).click();
    await windowClosed(win);

    // Review fix (Task 8 review fix round 1, I1): Q24 is latched by Approve — it survives to the locked screen too,
    // not only once the window has unlocked. The wallet is still locked from the request above.
    await set(h.sw, {v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: true}});
    win = await windowFor(h, () => connect(dapp));
    await still(win, 'window-locked-notice', win.getByText('Too many requests from sites in the last few minutes — some were declined without asking you.'), win.getByRole('button', {name: 'Reject'}));
    await win.getByRole('button', {name: 'Reject'}).click();
    await windowClosed(win);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});

test('visual · #46: verified (SIWS), unknown, keyword alert, lookalike and its confirm, SIWS mismatch, signing', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene();
  try {
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await set(h.sw, {v1_dapp_grants: ['https://jup.ag', 'https://dapp.test', 'https://tensr.trade', 'https://xn--phntom-4nf.app'].map(o => grant(o))});
    const jup = await openDapp(h.ctx, 'https://jup.ag');
    const dapp = await openDapp(h.ctx, 'https://dapp.test');
    const tensr = await openDapp(h.ctx, 'https://tensr.trade');
    const phantom = await openDapp(h.ctx, 'https://xn--phntom-4nf.app');
    for (const pg of [jup, dapp, tensr, phantom]) await connect(pg, true);

    await fresh(h.sw);
    let win = await windowFor(h, () => sign(jup, siws('jup.ag')));
    await still(win, '46-verified', win.getByText('Message · UTF-8', {exact: false}), win.getByRole('button', {name: 'Sign', exact: true}));
    await dismiss(win);

    // Review fix (Task 9 review fix round 1, item 2): `sign === null` — the account that made this request is no
    // longer unlocked (removed from the session mid-flight, here: while the window held its first read). The bare
    // top bar and a Reject-only exit, never a blank window with no ✕ and no Reject.
    await fresh(h.sw);
    win = await windowFor(h, () => sign(jup, 'This signer is about to be removed from the session.'));
    await expect(win.getByRole('button', {name: 'Sign', exact: true})).toBeVisible();
    await h.sw.evaluate(a => chrome.storage.session.set({v1_session: {accounts: [a]}}), {index: SAVINGS.index, publicKey: SAVINGS.publicKey, secretKey: SAVINGS.secretKey});
    await win.evaluate(() => void window.dispatchEvent(new Event('focus')));
    await expect(win.getByRole('button', {name: 'Sign', exact: true})).toHaveCount(0);
    // Rev 3.2 (Q26, owner-delegated 2026-10-12): the line under the title says why; asserted before the shot. B1c-3: drawn
    // as #48 draws it — a danger flag banner, its head.
    await expect(win.locator('.s9-flag-banner.danger .head')).toHaveText('This request can no longer be signed. Reject it and ask the site to try again.');
    await still(win, '46-sign-null', win.getByRole('button', {name: 'Reject'}));
    await dismiss(win);
    await seedUnlockedWallet(h.sw);

    await fresh(h.sw);
    win = await windowFor(h, () => sign(dapp, 'Sign in to the test dApp.'));
    await still(win, '46-unknown', win.getByText("This won't broadcast or move funds. dapp will use the signature only to verify you own this wallet."), win.getByRole('button', {name: 'Sign', exact: true}));
    await dismiss(win);
    await fresh(h.sw);
    win = await windowFor(h, () => sign(jup, "jup.ag asks you to approve the following terms:\n\nBy signing, you agree to Jupiter's terms of service and authorize the routing of swaps through any of the verified AMMs in the registry as of this signature timestamp."));
    await still(win, '46-keyword', win.getByText('This message includes an authorization'), win.getByRole('button', {name: 'Sign', exact: true}));
    await win.evaluate(() => void ((window as unknown as {__holdDecide: boolean}).__holdDecide = true));
    await win.getByRole('button', {name: 'Sign', exact: true}).click();
    await still(win, '46-signing', win.getByRole('button', {name: 'Signing…'}));
    await win.close();
    await fresh(h.sw);
    win = await windowFor(h, () => sign(tensr, 'Welcome back!\n\nClick sign to confirm ownership of your wallet and continue.\n\nDomain: ph\u0430ntom.app'));
    await still(win, '46-lookalike', win.getByText('Message preview'), win.getByRole('button', {name: 'Sign anyway (not recommended)'}));
    await win.getByRole('button', {name: 'Sign anyway (not recommended)'}).click();
    await still(win, '46-lookalike-confirm', win.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    await win.getByRole('button', {name: 'Cancel'}).click();
    await dismiss(win);

    // New shot: rule a (the IDN phantom) signing — #46's own version of 47-lookalike-idn (the connect flow already
    // shoots this rule; the sign flow had only rule b, tensr.trade, until now).
    await fresh(h.sw);
    win = await windowFor(h, () => sign(phantom, 'Welcome back! Click sign to confirm ownership of your wallet.'));
    await still(win, '46-lookalike-idn', win.getByText('The Punycode form is', {exact: false}), win.getByRole('button', {name: 'Sign anyway (not recommended)'}));
    await dismiss(win);

    // Review fix (Task 9 review fix round 1, item 4): a lookalike origin AND a SIWS domain mismatch together keep
    // the lookalike bar — [Reject and report] primary, plain [Reject] — never a Sign or a Sign-anyway escape hatch.
    await fresh(h.sw);
    win = await windowFor(h, () => sign(tensr, siws('jup.ag')));
    await still(win, '46-lookalike-siws-mismatch', win.getByText('This sign-in message names jup.ag, not this site (tensr.trade).'), win.getByRole('button', {name: 'Reject and report'}));
    await dismiss(win);

    await fresh(h.sw);
    win = await windowFor(h, () => sign(dapp, siws('jup.ag')));
    await still(win, '46-siws-mismatch', win.getByText('This sign-in message names jup.ag, not this site (dapp.test).'));
    await dismiss(win);

    // New shot: the cooldown's Block this site (Q17) on a #46 sign request — C14's third request, same as 47's.
    await set(h.sw, {v1_dapp_limits: {rejections: [{key: 'host:dapp.test', at: Date.now()}, {key: 'host:dapp.test', at: Date.now()}], cooldowns: [], windows: [], notice: false}});
    win = await windowFor(h, () => sign(dapp, 'Sign in to the test dApp.'));
    await still(win, '46-cooldown-block', win.getByRole('button', {name: 'Block this site'}), win.getByRole('button', {name: 'Sign', exact: true}));
    await dismiss(win);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});

test('visual · #49 and #31: populated, sorted by name, detail, hold, undo toast, undo refused, blocked section, empty; #31’s Connected dApps row', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene();
  try {
    const now = Date.now();
    await set(h.sw, {
      v1_dapp_grants: [
        grant('https://tensor.trade', {lastUsedAt: now - 5 * 3_600_000, connectedAt: now - 40 * DAY, recent: [{type: 'signMessage', at: now - 5 * 3_600_000, outcome: 'approved'}, {type: 'signMessage', at: now - 2 * DAY, outcome: 'rejected'}, {type: 'connect', at: now - 40 * DAY, outcome: 'approved'}]}),
        grant('https://jup.ag', {lastUsedAt: now - 18 * 3_600_000, connectedAt: now - 60 * DAY}),
        grant('https://magiceden.io', {lastUsedAt: now - 3 * DAY, connectedAt: now - 80 * DAY}),
      ],
      v1_dapp_blocked: [{host: 'tensr.trade', blockedAt: now - DAY, imitates: 'tensor.trade'}],
    });
    await h.sw.evaluate(g => chrome.storage.session.set({v1_dapp_session: {queue: [], grants: [g], window: null, opening: null, undo: []}}), grant('https://drift.trade', {scope: 'session', lastUsedAt: now - 30 * DAY, connectedAt: now - 30 * DAY}));
    const p = await h.openPopup({clock: true});
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Settings'}).click();
    const row = p.locator('.s7-row', {hasText: 'Connected dApps'});
    await expect(row.locator('.s7-meta')).toHaveText('4 connected');
    await row.scrollIntoViewIfNeeded();
    await still(p, '31-connected-dapps', row);

    // Review fix (Task 10 review fix round 1, I2a): #49's own loading skeleton, the summary bar reading "Loading
    // sessions…" above the skeleton rows. `dapp.grants.list`/`dapp.blocked.list` held open by a page-scoped patch of
    // chrome.runtime.sendMessage (the same technique `scene()` uses for `dapp.decide`), released by a focus poll —
    // ConnectedApps re-reads on focus, same as the approval window.
    await p.evaluate(() => {
      const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
      const send = rt.sendMessage.bind(rt);
      const w = window as unknown as {__holdGrants?: boolean};
      w.__holdGrants = true;
      rt.sendMessage = (m: unknown) => {
        const t = (m as {type?: string}).type;
        return (t === 'dapp.grants.list' || t === 'dapp.blocked.list') && w.__holdGrants === true ? new Promise(() => undefined) : send(m);
      };
    });
    await row.click();
    await still(p, '49-skeleton', p.getByText('Loading sessions…'));
    await p.evaluate(() => void ((window as unknown as {__holdGrants: boolean}).__holdGrants = false));
    await p.evaluate(() => void window.dispatchEvent(new Event('focus')));
    await still(p, '49a-populated', p.getByText('4 active sessions'), p.getByRole('button', {name: 'Revoke'}).first());
    await p.getByRole('button', {name: 'Sort'}).click();
    await still(p, '49a-sorted-by-name', p.getByText('Sorted by name'));
    await p.getByRole('button', {name: 'Sort'}).click();
    await p.locator('.s10-app-row', {hasText: 'tensor.trade'}).locator('.name').click();
    await still(p, '49c-detail', p.getByRole('dialog', {name: 'Tensor'}));
    // New shot (fix round 1, review of I1): the sheet's own body scrolls now (it did not before the fix) — the
    // Session grid and Last 3 interactions sit below the fold at 49c-detail's own scrollTop. Fix round 2, item 3:
    // scrolled fully to the body's own end (not merely until "Last 3 interactions" first appears), and the LAST
    // history row — not the heading — is what's asserted in the viewport: that is what proves the CTA below it
    // (pinned at its own flex size, fix round 1 I1) never cuts the group off.
    await p.locator('.app-grant-sheet-body').evaluate(e => void (e.scrollTop = e.scrollHeight));
    const lastHistoryRow = p.locator('.s10-history .row').last();
    await expect(lastHistoryRow).toBeInViewport();
    await expect(p.getByText('Last 3 interactions')).toBeVisible();
    await shot(p, '49c-full', {fullPage: false});
    await p.getByRole('dialog').getByRole('button', {name: 'Close'}).click();
    const blocked = p.getByText('Blocked sites');
    await pop(p, '49-blocked-section', blocked);
    // 49d: a mid-hold frame (~60 %) on the page's paused clock.
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('.app-hold').hover();
    await p.mouse.down();
    await p.clock.runFor(360);
    await expect(p.locator('.app-hold')).toHaveText('Hold to disconnect all · 0.24 s');
    await shot(p, '49d-hold', {fullPage: false});
    await p.mouse.move(0, 0);
    await p.mouse.up();
    // 49e: the undo toast. Realigned (fix round 1): `revoke`'s deadline is `m.now() + 5_000` read fresh, but the
    // toast displays ConnectedApps's own `useNow(1_000, …)` — ticks once a second, so on the very next render it is
    // always at least slightly behind the fresh reading, and `Math.ceil` rounds the gap up to "undo · 6 s" (a probe
    // outside this sequence, with no clock paused at all, hit the same "6 s" 5 of 5 runs — the stale tick, not the
    // pause, is the cause). `fastForward` fires the overdue tick once while the clock is still paused, syncing
    // useNow's `t` to the exact instant Revoke is clicked immediately after — `until - now` is then exactly 5 000 ms.
    await p.clock.fastForward(1_000);
    await p.locator('.s10-app-row', {hasText: 'magiceden.io'}).getByRole('button', {name: 'Revoke'}).click();
    await still(p, '49e-undo-toast', p.getByText('Magic Eden revoked'));
    await expect(p.locator('.s10-undo-toast .timer')).toHaveText('undo · 5 s');
    // New shot (rev 3.2, Q25, owner-delegated 2026-10-12): the background refuses the undo — here its token is gone
    // from the session's undo buffer (`unknown-token`, the same answer an expired one gets). The toast says so, with no
    // countdown and no UNDO, for five seconds (held on the page's paused clock for the shot).
    await h.sw.evaluate(async () => {
      const k = 'v1_dapp_session';
      const cur = ((await chrome.storage.session.get(k))[k] ?? {}) as object;
      await chrome.storage.session.set({[k]: {...cur, undo: []}});
    });
    await p.locator('.s10-undo-toast').getByRole('button', {name: 'UNDO'}).click();
    const refused = p.getByText('Could not undo — Magic Eden stays disconnected.');
    await expect(refused).toBeVisible();
    await expect(p.locator('.s10-undo-toast .timer')).toHaveCount(0);
    await expect(p.locator('.s10-undo-toast').getByRole('button')).toHaveCount(0);
    await still(p, '49e-undo-refused', refused);
    await p.clock.resume();
    // 49b: empty (the blocked section stays below it).
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'dapp.grants.revokeAll'}));
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-title', {hasText: 'Connected dApps'}).click();
    await still(p, '49b-empty', p.getByText('No connected apps'));

    // New shot: Q15's failure state. `dapp.grants.list`/`dapp.blocked.list` answered directly (not through the
    // background) with a shape `call()` cannot parse as success and does not recognise as `locked` — the same
    // "failed" `engine.dappGrants()` returns for any other read it cannot make sense of.
    await p.getByRole('button', {name: 'Back'}).click();
    await p.evaluate(() => {
      const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
      const send = rt.sendMessage.bind(rt);
      rt.sendMessage = (m: unknown) => {
        const t = (m as {type?: string}).type;
        return t === 'dapp.grants.list' || t === 'dapp.blocked.list' ? Promise.resolve({ok: false, error: 'unreachable'}) : send(m);
      };
    });
    await p.locator('.s7-title', {hasText: 'Connected dApps'}).click();
    await still(p, '49-failed', p.getByText('Could not load your connections. Try again.'), p.getByRole('button', {name: 'Try again'}));

    // New shot: #37's "erased" bullet — the sentence this plan adds ("…and dApp connections and blocked sites are
    // erased and not recoverable.", DeleteWallet.tsx's `DELETE_TEXT.bulletErased`), explicitly asserted in the
    // viewport before the shot (fix round 2, item 2: `visual-settings.spec.ts`'s existing 37a-idle is a
    // viewport-only `pop()` shot framed on the title text, not asserted to carry this specific bullet into view).
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    const bullet = p.getByText('dApp connections and blocked sites are', {exact: false});
    await pop(p, '37-dapp-bullet', bullet);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});
