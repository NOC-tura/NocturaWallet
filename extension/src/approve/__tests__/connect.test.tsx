// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {GRANTS_KEY, MAX_GRANTS, type Grant} from '../../background/dapp/grants';
import {BLOCKED_KEY} from '../../background/dapp/blocked';
import {LIMITS_KEY} from '../../background/dapp/limits';
import {readDappSession} from '../../background/dapp/store';
import {REQUEST_TTL_MS} from '../../background/dapp/queue';
import {SETTINGS_KEY} from '../../background/settings';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {Approve, POLL_MS} from '../Approve';
import {ARM_MS} from '../useArmed';
import {CONFIRM_DELAY_MS} from '../ui';
import {pendingOf, type ApproveClient} from '../client';
import {SECOND, elapse, nextTimer, onHarnessClock, openWindow, settled} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const cta = (name: string | RegExp) => screen.getByRole('button', {name});
onHarnessClock();

// Spec §3.1 (#47, index.html ix:17686-18261), §4.3 and C12, C15 — the approval window against the real background.
describe('#47 47a — a verified origin', () => {
  it('47a-initial: every drawn string, the account picker (Q01, the active account chosen), Connect locked as .btn-secondary', async () => {
    const w = await openWindow();
    await w.ext.local.set(SETTINGS_KEY, {selectedAccount: 1});
    await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    expect(text('.top-bar .title')).toBe('Connection request');
    expect(document.querySelector('.top-bar .title')?.className).toBe('title noc-overline app-dim');
    expect(screen.getByText('Connecting lets the dApp see your public address. It does not move funds. Every transaction will still ask for your approval.')).toBeTruthy();
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['Jupiter', 'jup.ag', 'Verified']);
    expect(text('.s9-origin-card .ico')).toBe('J');
    const perms = document.querySelector('.s9-perm-card') as HTMLElement;
    expect(within(perms).getByText('Jupiter will be able to')).toBeTruthy();
    expect([...perms.querySelectorAll('.s9-perm-row')].map(r => [r.querySelector('.pri')?.textContent, r.querySelector('.sec')?.textContent, r.querySelector('.badge')?.textContent])).toEqual([
      ['See your public address', `${SECOND.publicKey.slice(0, 4)}…${SECOND.publicKey.slice(-4)} — never your seed or private key`, 'AUTOMATIC'],
      ['Request transaction signatures', 'You will approve each transaction individually', 'WITH PROMPT'],
      ['Request message signatures', 'You will approve each signature individually', 'WITH PROMPT'],
    ]);
    const ack = screen.getByRole('checkbox', {name: /I've read these permissions/});
    expect(ack.textContent).toBe("I've read these permissionsTap to acknowledge · gates the Connect button");
    const picker = screen.getByRole('combobox') as HTMLSelectElement;
    expect([...picker.options].map(o => o.textContent)).toEqual([`Main · ${ACCOUNT.publicKey.slice(0, 4)}…${ACCOUNT.publicKey.slice(-4)}`, `Savings · ${SECOND.publicKey.slice(0, 4)}…${SECOND.publicKey.slice(-4)}`]);
    expect(picker.value).toBe('1');
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Stay connected')).toBeTruthy();
    const [session, persistent] = screen.getAllByRole('radio');
    expect([session?.textContent, session?.getAttribute('aria-checked'), persistent?.textContent, persistent?.getAttribute('aria-checked')]).toEqual([
      'For this session onlyDisconnects when the wallet locks or the browser closes',
      'true',
      'Until I revokeSaved in Settings → Connected dApps · revoke any time',
      'false',
    ]);
    expect(text('.s9-gate-status')).toBe('0 of 1 acknowledgments');
    const connect = cta('Connect');
    expect([connect.className, connect.getAttribute('aria-disabled'), connect.getAttribute('title')]).toEqual(['btn btn-secondary app-cta-wide', 'true', 'Read the permissions above before connecting']);
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
  });

  it('a tap on the locked Connect does nothing, shakes the unmet gate and says why', async () => {
    const w = await openWindow();
    const {requestId} = await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    fireEvent.click(cta('Connect'));
    expect(screen.getByText('Read the permissions above before connecting')).toBeTruthy();
    expect(screen.getByRole('checkbox').className).toBe('s9-ack-row app-shake');
    fireEvent.click(cta('Connect'));
    expect(screen.getByRole('checkbox').className).toBe('s9-ack-row app-shake-again');
    expect((await readDappSession(w.ext)).queue.find(e => e.requestId === requestId)?.state).toBe('queued');
    expect(w.sent.filter(m => (m as {type: string}).type === 'dapp.decide')).toEqual([]);
  });

  it('47a-acknowledged: "Permissions acknowledged", "Ready to connect", Connect promoted — held 500 ms (C15), then a session grant; the window closes', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox').textContent).toBe('Permissions acknowledgedConnect is now enabled');
    expect(document.querySelector('.s9-gate-status')?.className).toBe('s9-gate-status is-ready');
    expect(text('.s9-gate-status')).toBe('Ready to connect');
    const connect = cta('Connect');
    expect([connect.className, (connect as HTMLButtonElement).disabled]).toEqual(['btn btn-primary app-cta-wide', true]);
    await elapse(ARM_MS);
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(cta('Connect'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
    expect((await readDappSession(w.ext)).grants.map(g => [g.origin, g.scope])).toEqual([['https://jup.ag', 'session']]);
  });

  it('"Until I revoke" and another account: a persistent grant for that account', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    fireEvent.change(screen.getByRole('combobox'), {target: {value: '1'}});
    expect(document.querySelector('.s9-perm-row .sec')?.textContent).toBe(`${SECOND.publicKey.slice(0, 4)}…${SECOND.publicKey.slice(-4)} — never your seed or private key`);
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.click(screen.getByRole('checkbox'));
    await elapse(ARM_MS);
    fireEvent.click(cta('Connect'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(((await w.ext.local.get(GRANTS_KEY)) as Grant[]).map(g => [g.origin, g.account, g.scope])).toEqual([['https://jup.ag', SECOND.publicKey, 'persistent']]);
  });
});

describe('#47 47b — an unknown origin: two gates, in order; session only (C12)', () => {
  it('47b-initial → domain-acked → fully-acked, every string; Connect for this session; a session grant', async () => {
    const w = await openWindow();
    await w.connect('https://solana-mint-hub.xyz');
    w.show();
    await settled(() => screen.getByText('Connect to this app?'));
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Unknown origin', 'title noc-overline noc-warning']);
    expect(screen.getByText("We don't recognize this domain. That doesn't always mean it's bad — but proceed with care.")).toBeTruthy();
    expect([text('.s9-origin-card .ico'), text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['?', 'solana-mint-hub', 'solana-mint-hub.xyz', 'Unknown']);
    expect(text('.s9-flag-banner.warn .head')).toBe("This domain isn't on the verified list");
    expect(document.querySelector('.s9-flag-banner.warn .body')).toBeNull();
    const [domain, perms] = screen.getAllByRole('checkbox');
    expect(domain?.textContent).toBe('I understand this domain is not on the verified list');
    expect(perms?.textContent).toBe("I've read these permissionsTap to acknowledge · second gate for unknown domain");
    expect(text('.s9-perm-card .noc-overline')).toBe('If you connect, the dApp can');
    expect(document.querySelectorAll('.s9-perm-row')).toHaveLength(3);
    expect(document.querySelector('.s9-perm-row .sec')?.textContent).toBe(`${SECOND.publicKey.slice(0, 4)}…${SECOND.publicKey.slice(-4)} · cannot see your seed or private key`.replace(SECOND.publicKey.slice(0, 4), ACCOUNT.publicKey.slice(0, 4)).replace(SECOND.publicKey.slice(-4), ACCOUNT.publicKey.slice(-4)));
    expect([text('.s9-scope-card .noc-overline'), document.querySelector('.s9-scope-card .noc-overline')?.className]).toEqual(['Recommended for unknown', 'noc-overline noc-warning app-card-overline']);
    const [session, persistent] = screen.getAllByRole('radio') as HTMLButtonElement[];
    expect(session?.textContent).toBe('For this session onlyConnection ends when the wallet locks · safest option for unknown domains');
    expect([persistent?.textContent, persistent?.disabled, persistent?.className]).toEqual(['Until I revokeDiscouraged for unknown domains — re-grant per session instead', true, 's9-scope-row app-scope-off']);
    expect(text('.s9-gate-status')).toBe('0 of 2 acknowledgments');
    expect(cta('Connect for this session').getAttribute('title')).toBe('Acknowledge both gates to connect');
    // The permissions ack is the second gate: tapped first, it shakes the domain ack and stays unticked.
    fireEvent.click(perms!);
    expect([perms?.getAttribute('aria-checked'), domain?.className]).toEqual(['false', 'ack app-shake']);
    fireEvent.click(domain!);
    expect(screen.getAllByRole('checkbox')[0]?.textContent).toBe('Acknowledged — new domain');
    expect(screen.getAllByRole('checkbox')[1]?.textContent).toBe("I've read these permissionsFinal gate — tap to enable Connect");
    expect([text('.s9-gate-status'), document.querySelector('.s9-gate-status')?.className]).toEqual(['1 of 2 acknowledgments', 's9-gate-status app-gate-partial']);
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    expect(screen.getAllByRole('checkbox')[1]?.textContent).toBe('Permissions acknowledgedConnect is now enabled · session-only scope');
    expect(text('.app-approve-lede')).toBe('Both gates cleared. Connect is enabled for this session only — the persisted-scope path stays locked out for unknown domains.');
    expect(document.querySelector('.app-approve-lede i')?.textContent).toBe('for this session only');
    expect(text('.s9-gate-status')).toBe('Ready to connect · for this session');
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    await elapse(ARM_MS);
    fireEvent.click(cta('Connect for this session'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect((await readDappSession(w.ext)).grants.map(g => [g.origin, g.scope])).toEqual([['https://solana-mint-hub.xyz', 'session']]);
  });

  it('an unknown xn-- host gets Q18', async () => {
    const w = await openWindow();
    await w.connect('https://xn--bcher-kva.example');
    w.show();
    expect(await settled(() => screen.getByText('This address uses international characters: xn--bcher-kva.example'))).toBeTruthy();
  });
});

describe('#47 lookalike — the flipped bar, the 2-second confirm, 47b’s gates under the lookalike chrome', () => {
  it('rules b–d: "Suspicious origin", the host’s own label (never the brand), Q05; Reject and report blocks it', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://tensr.trade');
    w.show();
    await settled(() => screen.getByText('Connect to this app?'));
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Suspicious origin', 'title noc-overline noc-danger']);
    expect(text('.app-approve-lede')).toBe('Connecting lets the dApp see your public address.');
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['tensr', 'tensr.trade', 'Lookalike']);
    expect(document.body.textContent).not.toContain('Tensor');
    expect(text('.s9-domain-warn .body')).toBe('This domain is not tensor.tradeIt looks like tensor.trade but is a different site.');
    expect(document.querySelector('.s9-ack-row')).toBeNull();
    const report = cta('Reject and report');
    // Fix round 1, M1: btn-destructive, not the duplicate app-btn-danger (see the "Connect anyway" test below).
    expect(report.className).toBe('btn btn-destructive');
    expect(cta('Connect anyway (not recommended)').className).toBe('btn btn-tertiary noc-body-sm app-dim');
    expect(unstyledClasses(document.querySelector('.app-approve')!, SELECTORS)).toEqual([]);
    fireEvent.click(report);
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(await w.ext.local.get(BLOCKED_KEY)).toEqual([{host: 'tensr.trade', blockedAt: w.deps.clock.t, imitates: 'tensor.trade'}]);
  });

  it('rule a: the IDN sentence names the character, its script and code point, the Latin one and the Punycode form', async () => {
    const w = await openWindow();
    await w.connect('https://xn--phntom-4nf.app');
    w.show();
    await settled(() => screen.getByText('Connect to this app?'));
    expect(text('.s9-domain-warn .body')).toBe('This domain is not phantom.appThe "\u0430" in this URL is a Cyrillic letter (U+0430), not a Latin "a" (U+0061). The Punycode form is xn--phntom-4nf.app.');
    expect([...document.querySelectorAll('.s9-domain-warn code')].map(c => c.textContent)).toEqual(['\u0430', 'xn--phntom-4nf.app']);
    expect(text('.s9-origin-card .name')).toBe('xn--phntom-4nf');
  });

  it('rule e (rev 3.2): a brand as a subdomain label — the lookalike chrome, the host’s own label on the card, Q05; Reject and report blocks the host', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://phantom.vercel.app');
    w.show();
    await settled(() => screen.getByText('Connect to this app?'));
    expect(text('.top-bar .title')).toBe('Suspicious origin');
    expect([text('.s9-origin-card .name'), text('.s9-origin-card .dom'), text('.s9-origin-card .badge')]).toEqual(['vercel', 'phantom.vercel.app', 'Lookalike']);
    expect(text('.s9-domain-warn .body')).toBe('This domain is not phantom.appIt looks like phantom.app but is a different site.');
    expect(document.querySelector('.s9-ack-row')).toBeNull();
    fireEvent.click(cta('Reject and report'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(await w.ext.local.get(BLOCKED_KEY)).toEqual([{host: 'phantom.vercel.app', blockedAt: w.deps.clock.t, imitates: 'phantom.app'}]);
  });

  it('Connect anyway → the confirm (I understand the risk held 2 s; Cancel goes back) → 47b’s two gates, session only', async () => {
    const w = await openWindow();
    await w.connect('https://tensr.trade');
    w.show();
    await settled(() => screen.getByText('Connect to this app?'));
    await elapse(ARM_MS);
    fireEvent.click(cta('Connect anyway (not recommended)'));
    const sheet = await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    const understandBtn = within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement;
    expect(understandBtn.disabled).toBe(true);
    // Fix round 1, M1: btn-destructive (design-system.css), not the duplicate app-btn-danger class — the duplicate's
    // specificity tied .btn[disabled] and so lost to source order, leaving it looking live while held/disabled.
    expect(understandBtn.className).toBe('btn btn-destructive app-nowrap');
    fireEvent.click(within(sheet).getByRole('button', {name: 'Cancel'}));
    await settled(() => expect(screen.queryByRole('dialog')).toBeNull());
    await elapse(ARM_MS);
    fireEvent.click(cta('Connect anyway (not recommended)'));
    const again = await settled(() => screen.getByRole('dialog'));
    // The 2-second confirm itself (Task 9 fix round 1, I1): C15's hold is long past at 1 999 ms, so only the delay holds it.
    await elapse(CONFIRM_DELAY_MS - 1);
    expect((within(again).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement).disabled).toBe(true);
    await elapse(1);
    fireEvent.click(within(again).getByRole('button', {name: 'I understand the risk'}));
    await settled(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    expect(text('.top-bar .title')).toBe('Suspicious origin');
    expect(document.querySelector('.s9-domain-warn')).not.toBeNull();
    expect(text('.s9-flag-banner.warn .head')).toBe("This domain isn't on the verified list");
    expect((screen.getAllByRole('radio')[1] as HTMLButtonElement).disabled).toBe(true);
    expect(cta('Connect for this session')).toBeTruthy();
  });
});

describe('#47 — the cap, the cooldown offer, the window chrome (§2.1, C14, Q12, Q16, Q17, Q24)', () => {
  it('cap: 200 persistent grants — Q16 and only [Reject]', async () => {
    const w = await openWindow();
    await w.ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => ({origin: `https://s${i}.test`, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []})));
    await w.connect('https://jup.ag');
    w.show();
    expect(await settled(() => screen.getByText('You have 200 connected apps. Revoke one in Settings first.'))).toBeTruthy();
    expect(screen.queryByRole('button', {name: /Connect/})).toBeNull();
    expect(document.querySelectorAll('.sticky-bar button')).toHaveLength(1);
    expect(cta('Reject')).toBeTruthy();
  });

  it('the third request from a host offers [Block this site] (Q17)', async () => {
    const w = await openWindow();
    await w.ext.local.set(LIMITS_KEY, {rejections: [{key: 'host:dapp.test', at: w.deps.clock.t}, {key: 'host:dapp.test', at: w.deps.clock.t}], cooldowns: [], windows: [], notice: false});
    await w.connect('https://dapp.test');
    w.show();
    fireEvent.click(await settled(() => screen.getByRole('button', {name: 'Block this site'})));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(((await w.ext.local.get(BLOCKED_KEY)) as {host: string}[]).map(b => b.host)).toEqual(['dapp.test']);
  });

  it('"1 more request waiting" / "2 more requests waiting" (Q12); the budget notice latches once shown, across every later poll, until the head changes (Q24, fix round 1 I1)', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    await w.connect('https://a.test');
    await w.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: [], notice: true});
    w.show();
    expect(await settled(() => screen.getByText('1 more request waiting'))).toBeTruthy();
    expect(screen.getByText('Too many requests from sites in the last few minutes — some were declined without asking you.')).toBeTruthy();
    await w.connect('https://b.test');
    // The window's next poll (B1c-3 Task 9: on the harness's clock).
    await elapse(POLL_MS);
    expect(await settled(() => screen.getByText('2 more requests waiting'))).toBeTruthy();
    // The background's own flag is one-shot (cleared on the read that first saw it); this is still the same head
    // (jup.ag), so the window must still be showing it — not only on the poll that first saw it.
    expect(screen.getByText('Too many requests from sites in the last few minutes — some were declined without asking you.')).toBeTruthy();
  });

  // Final-fix item 8 (Q24, spec §4.3 "once"): the latch is per head — the head changing resets it in the same commit
  // that shows the new head. Mutation `prev || v.windowNotice` (a latch that never resets) turns this red.
  it('the budget notice is dropped the moment the head changes (Q24 latch reset)', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    await w.connect('https://a.test');
    await w.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: [], notice: true});
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    expect(screen.getByText('Too many requests from sites in the last few minutes — some were declined without asking you.')).toBeTruthy();
    fireEvent.click(cta('Reject'));
    await settled(() => screen.getByText('Connect to this app?'));
    expect(screen.queryByText('Too many requests from sites in the last few minutes — some were declined without asking you.')).toBeNull();
  });

  // Review Focus 2: the popup revokes (or the page disconnects) while the window shows that origin's request.
  it('a request answered elsewhere while shown (the page disconnected): Connect is refused as not-head, the window moves on and closes', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    await page.ask({type: 'page.disconnect', id: 'd1'});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    fireEvent.click(screen.getByRole('checkbox'));
    await elapse(ARM_MS);
    fireEvent.click(cta('Connect'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect((await readDappSession(w.ext)).grants).toEqual([]);
  });

  it('✕ is Reject; closing on the last request closes the window; the next head follows a decision', async () => {
    const w = await openWindow();
    const first = await w.connect('https://jup.ag');
    const second = await w.connect('https://a.test');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    await settled(() => screen.getByText('Connect to this app?'));
    expect(first.page.answersFor(first.requestId)).toEqual([{requestId: first.requestId, error: 'rejected'}]);
    fireEvent.click(cta('Reject'));
    await settled(() => expect(w.closed.n).toBe(1));
    expect(second.page.answersFor(second.requestId)).toEqual([{requestId: second.requestId, error: 'rejected'}]);
  });
});

describe('C15 — no CTA focused, held 500 ms after focus and each state change, Enter never confirms; Reject never held', () => {
  it('at mount nothing is focused; Reject is enabled at once; Connect waits 500 ms after the ack, and again after the window regains focus', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    expect(document.activeElement).toBe(document.body);
    expect((cta('Reject') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(true);
    await elapse(ARM_MS);
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(false);
    act(() => void window.dispatchEvent(new Event('focus')));
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(true);
    await elapse(ARM_MS);
    // A scope change is a state change too.
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(true);
    await elapse(ARM_MS);
    // Enter on the focused Connect: its default action (the click) is prevented.
    cta('Connect').focus();
    expect(fireEvent.keyDown(cta('Connect'), {key: 'Enter'})).toBe(false);
    expect(fireEvent.keyDown(cta('Reject'), {key: 'Enter'})).toBe(true);
    // Fix round 1, M3: Space is a button's other activation key — it must be refused too, on Connect but never on Reject.
    expect(fireEvent.keyDown(cta('Connect'), {key: ' '})).toBe(false);
    expect(fireEvent.keyDown(cta('Reject'), {key: ' '})).toBe(true);
    // Task 9 controller ruling (b): Gecko dispatches a held Space's click on keyup, not keydown — refuse it there too.
    expect(fireEvent.keyUp(cta('Connect'), {key: ' '})).toBe(false);
    expect(fireEvent.keyUp(cta('Reject'), {key: ' '})).toBe(true);
  });
});

describe('review 1: the confirm sheet (L4), the port on the card (L5), an expiry on screen (L1)', () => {
  it('the 2-second confirm opens with no control focused, and "I understand the risk" is held again after the window regains focus', async () => {
    const w = await openWindow();
    await w.connect('https://tensr.trade');
    w.show();
    await settled(() => screen.getByText('Connect to this app?'));
    await elapse(ARM_MS);
    fireEvent.click(cta('Connect anyway (not recommended)'));
    const sheet = await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    expect(document.activeElement).toBe(sheet);
    const understand = () => within(sheet).getByRole('button', {name: 'I understand the risk'}) as HTMLButtonElement;
    // The 2-second confirm itself (Task 9 fix round 1, I1): C15's hold is long past at 1 999 ms, so only the delay holds it.
    await elapse(CONFIRM_DELAY_MS - 1);
    expect(understand().disabled).toBe(true);
    await elapse(1);
    expect(understand().disabled).toBe(false);
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(understand().disabled).toBe(true);
    await elapse(ARM_MS);
    expect(understand().disabled).toBe(false);
  });

  it('an origin with an explicit port shows host:port on the card; one without shows the host', async () => {
    const w = await openWindow();
    await w.connect('https://dapp.test:8443');
    w.show();
    await settled(() => screen.getByText('Connect to this app?'));
    expect(text('.s9-origin-card .dom')).toBe('dapp.test:8443');
    cleanup();
    const v = await openWindow();
    await v.connect('https://dapp.test');
    v.show();
    await settled(() => screen.getByText('Connect to this app?'));
    expect(text('.s9-origin-card .dom')).toBe('dapp.test');
  });

  it('a single shown request that expires: the window learns it within two seconds and closes (nothing else waiting)', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    w.deps.clock.t += REQUEST_TTL_MS;
    // Within one poll (B1c-3 Task 9: the window's poll on the harness's clock).
    await elapse(POLL_MS);
    await settled(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'timeout'}]);
  });
});

describe('the in-progress state and the client’s shape check', () => {
  it('a deciding head: "Connecting…" with the ring, every CTA and ✕ disabled, the origin card at .55', async () => {
    const w = await openWindow();
    const {requestId} = await w.connect('https://jup.ag');
    const s = await readDappSession(w.ext);
    const {DAPP_SESSION_KEY} = await import('../../background/dapp/store');
    const {runtimeFor} = await import('../../background/dapp/ports');
    await w.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.requestId === requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(w.ext).instance, decidingAt: w.deps.clock.t} : e))});
    w.show();
    const busy = await settled(() => screen.getByRole('button', {name: 'Connecting…'}));
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    // Fix round 1, I2: the busy-CTA class that keeps the accent fill against design-system.css's `.btn[disabled]`
    // (happy-dom cannot compute the cascade itself — the class is the assertion; Task 12's visual pass shoots it).
    expect(busy.className).toBe('btn btn-primary app-cta-wide app-cta-busy');
    expect(busy.querySelector('.app-ring-spinner')).not.toBeNull();
    expect((cta('Reject') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Close'}) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.app-origin-slot')?.className).toBe('app-origin-slot app-busy-dim');
  });

  it('pendingOf: a reply of any other shape is null (the window asks again)', () => {
    expect(pendingOf({state: 'none'})).toEqual({state: 'none'});
    expect(pendingOf({state: 'request', waiting: 0, windowNotice: false, request: {requestId: 'x'}})).toBeNull();
    expect(pendingOf({state: 'weird'})).toBeNull();
    expect(pendingOf(null)).toBeNull();
  });
});

describe('fix round 1 — I3: a null first read still polls; M2: busy clears only after the refresh', () => {
  it('I3: a first dapp.pending that resolves null (malformed, or the background momentarily unreachable) does not leave the window blank — the next poll renders the request', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    let calls = 0;
    const flaky: ApproveClient = {
      pending: () => {
        calls += 1;
        return calls === 1 ? Promise.resolve(null) : w.client.pending();
      },
      decide: (requestId, d) => w.client.decide(requestId, d),
    };
    render(
      <div className="app app-window">
        <Approve client={flaky} close={() => undefined} />
      </div>,
    );
    // The first read answered null: blank, until the window's own poll (B1c-3 Task 9: on the harness's clock).
    await settled(() => expect(calls).toBe(1));
    expect(document.querySelector('.app-approve')?.getAttribute('aria-busy')).toBe('true');
    await elapse(POLL_MS);
    expect(await settled(() => screen.getByText('Connect to Jupiter?'))).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('M2: busy (Connect shows "Connecting…", disabled) stays true until the post-decide refresh resolves — not as soon as dapp.decide itself does', async () => {
    const w = await openWindow();
    await w.connect('https://jup.ag');
    let release: (() => void) | undefined;
    let pendingCalls = 0;
    const gated: ApproveClient = {
      // Call 1 is the window's own mount read; call 2 is the refresh `decide`'s `finally` awaits — gate only that one.
      pending: () => {
        pendingCalls += 1;
        if (pendingCalls === 2) return new Promise(resolve => (release = () => resolve(w.client.pending())));
        return w.client.pending();
      },
      decide: (requestId, d) => w.client.decide(requestId, d),
    };
    const closed = {n: 0};
    render(
      <div className="app app-window">
        <Approve client={gated} close={() => void (closed.n += 1)} />
      </div>,
    );
    await settled(() => screen.getByText('Connect to Jupiter?'));
    fireEvent.click(screen.getByRole('checkbox'));
    await elapse(ARM_MS);
    fireEvent.click(cta('Connect'));
    await settled(() => expect(screen.queryByRole('button', {name: 'Connecting…'})).not.toBeNull());
    // client.decide() itself (not gated) has settled and its refresh is asked; that refresh has not answered — busy must
    // still hold. (B1c-3 Task 9: no poll can be call 2 — the window's clock has not reached its first poll.)
    await settled(() => expect([pendingCalls, release === undefined]).toEqual([2, false]));
    const busy = screen.getByRole('button', {name: 'Connecting…'});
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect((cta('Reject') as HTMLButtonElement).disabled).toBe(true);
    expect(closed.n).toBe(0);
    release?.();
    await settled(() => expect(closed.n).toBe(1));
  });
});

// Task 9 controller ruling (a): the C15 armed key folds in busy/in-progress for Connect too, so a stale poll that
// clears busy (without the user doing anything) can never leave Connect already armed from before the busy window.
describe('controller ruling (a): busy is in the C15 key for #47', () => {
  it('Connect goes disabled the instant a stale poll clears busy; armed again only after a fresh 500 ms hold', async () => {
    const w = await openWindow();
    const {requestId} = await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connect to Jupiter?'));
    fireEvent.click(screen.getByRole('checkbox'));
    await elapse(ARM_MS);
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(false);
    const s = await readDappSession(w.ext);
    const {DAPP_SESSION_KEY} = await import('../../background/dapp/store');
    const {runtimeFor} = await import('../../background/dapp/ports');
    await w.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.requestId === requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(w.ext).instance, decidingAt: w.deps.clock.t} : e))});
    await elapse(POLL_MS);
    await settled(() => screen.getByRole('button', {name: 'Connecting…'}));
    // The stale poll: the background's own state goes back to a plain request (not deciding) with no action from the
    // user — exactly what a slow, outdated `dapp.pending` resolving late would show. Assert the instant the button
    // reappears (not after a further sleep): the 500 ms re-arm must not have had time to finish by then.
    await w.ext.session.set(DAPP_SESSION_KEY, s);
    // B1c-3 Task 9: the window's own next poll (its only timer left), on the harness's clock.
    await nextTimer();
    // Fix round 2: useArmed derives `armed` by comparing the current key to the key the hold last finished for, so
    // the busy→false key change disarms in the SAME render as the commit. This window-level check is NOT the proof of
    // that: the check runs after React has flushed, so FR2-M1 (the old effect-only reset) turned it red only about
    // 1 run in 10 on the wall clock (task 9 report) and never on the harness's clock (B1c-3 plan 3 Task 9: 0 of 3
    // runs). The deterministic proof is useArmed.test.tsx, which FR2-M1 turns red
    // every run (8/8); this test pins the outcome the window must keep — disabled at once, then re-armed after the hold.
    const connect = await settled(() => screen.getByRole('button', {name: 'Connect'}));
    expect((connect as HTMLButtonElement).disabled).toBe(true);
    await elapse(ARM_MS - 1);
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(true);
    await elapse(1);
    expect((cta('Connect') as HTMLButtonElement).disabled).toBe(false);
  });
});

/*
 * Task 12 fix round 1, I2: `.s9-flag-banner.warn svg { color: var(--warning) }` (design-ext.css's own banner-icon
 * rule, meant for the banner's top alert-triangle) also recoloured the NESTED check icon inside the unacked domain
 * `.ack .box`, defeating that box's own `color: transparent` — a colour set directly on an element always wins over
 * one only inherited from an ancestor, regardless of specificity, so the box showed a warning-coloured check before
 * anyone had acknowledged anything. Fixed with a more specific rule (app.css's `.s9-flag-banner .ack .box svg {
 * color: inherit }`), verified pixel-for-pixel against a real Chromium (the visual pass's 47b-initial,
 * 47-lookalike-gates, 47-queue-and-notice, 47-block-this-site shots, and a one-off computed-style probe during this
 * fix). happy-dom's own cascade engine does NOT reliably resolve a 4-part descendant selector against a 3-part one
 * here — confirmed empirically (a throwaway test with the same shape as this bug got the LOWER-specificity rule's
 * colour from happy-dom, the opposite of a real browser) — so this asserts the state the CSS switches on
 * (`.is-acked`), the same way every other test in this file reads the component, rather than a cascade result
 * happy-dom cannot be trusted to reproduce.
 */
describe('fix round 1, I2: the unacked domain-ack box carries no `.is-acked` (its check is CSS-gated on that class)', () => {
  it('unacked → `ack` only, no `.is-acked`; acking sets it, unticking clears it', async () => {
    const w = await openWindow();
    await w.connect('https://dapp.test');
    w.show();
    await settled(() => screen.getByText('0 of 2 acknowledgments'));
    const domainAck = screen.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'});
    expect(domainAck.className).toBe('ack');
    expect(domainAck.querySelector('.box svg')).toBeTruthy();
    fireEvent.click(domainAck);
    expect(domainAck.className).toBe('ack is-acked');
    fireEvent.click(domainAck);
    expect(domainAck.className).toBe('ack');
  });
});

// B1c-3 visual pass (controller ruling): #47's gate line sat flush against the card the scroll area cuts at its edge
// ("ACCOUNT" at 412 × 720, 47a). happy-dom lays nothing out, so this proves the rule that keeps them apart — on the
// rendered window, with both sheets loaded — and visual-dapp.spec.ts measures the gap in Chromium.
describe('B1c-3: #47’s gate line keeps a gap below the scroll area’s clip edge', () => {
  it('the rendered gate line: a --space-2 top padding, never shrunk, on the bar’s background', async () => {
    const style = document.createElement('style');
    const sheet = (p: string) => readFileSync(join(__dirname, ...p.split('/')), 'utf8');
    style.textContent = `:root { --space-2: 8px; --bg-base: rgb(1, 2, 3); }\n${sheet('../../styles/design-ext.css')}\n${sheet('../../app/app.css')}`;
    document.head.append(style);
    try {
      const w = await openWindow();
      await w.connect('https://jup.ag');
      w.show();
      await settled(() => screen.getByText('Connect to Jupiter?'));
      const gate = document.querySelector('.s9-gate-status') as HTMLElement;
      expect(gate.parentElement?.classList.contains('app-approve')).toBe(true);
      expect(gate.previousElementSibling?.classList.contains('app-approve-scroll')).toBe(true);
      const cs = getComputedStyle(gate);
      expect([cs.paddingTop, cs.flexShrink, cs.backgroundColor]).toEqual(['8px', '0', 'rgb(1, 2, 3)']);
    } finally {
      style.remove();
    }
  });
});
