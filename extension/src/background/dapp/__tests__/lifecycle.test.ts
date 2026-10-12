import {handleMessage} from '../../messages';
import {lock} from '../../autolock';
import {getSession, setSession} from '../../session';
import {GRANTS_KEY, type Grant} from '../grants';
import {BLOCKED_KEY} from '../blocked';
import {LIMITS_KEY, WINDOW_BUDGET} from '../limits';
import {DECIDING_TTL_MS, MAX_OPEN, QUEUE_ALARM, REQUEST_TTL_MS, ANSWER_TTL_MS, runUnlockHook} from '../queue';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {OPENING_STALE_MS, WINDOW_HEIGHT, WINDOW_WIDTH, ensureWindow, onApprovalWindowRemoved, onQueueAlarm} from '../window';
import {restartRuntime, runtimeFor} from '../ports';
import {LAST_USED_STEP_MS, acceptPagePort} from '../pageApi';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT} from '../../__tests__/fixtures';
import {TAB, fakePort, openPage, senderFor, settle} from './pageHarness';

const DAPP = 'https://dapp.test';
const OTHER = 'https://other.test';
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});

async function setup(o: {unlocked?: boolean} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  // Written directly: the session's unlock hook runs before any page opens (as vault.setKeys runs it).
  if (o.unlocked !== false) await setSession(ext, [ACCOUNT]);
  if (o.unlocked !== false) await runUnlockHook(ext, deps);
  return {ext, deps};
}
const queue = async (ext: ReturnType<typeof fakeExt>) => (await readDappSession(ext)).queue;
const connect = (id: string, silent = false) => ({type: 'page.connect', id, silent});

// Spec §1.3–§1.6, §2.2, §2.3, C3, C4, C9, C14, C16, C17 — the PAGE partition and the request lifecycle, against the
// real background (fake chrome.* only).
describe('the origin rule, for ports (§1.3, §6.1)', () => {
  it('refuses an iframe, http:, a "null" or opaque origin, a foreign sender.id, no tab, a prerendered document — and accepts a top frame (positive control)', async () => {
    const {ext, deps} = await setup();
    const refused = [
      senderFor(ext, DAPP, {frameId: 1}),
      senderFor(ext, 'http://dapp.test'),
      senderFor(ext, 'null'),
      senderFor(ext, 'data:text/html,x'),
      senderFor(ext, DAPP, {id: 'another-extension-id'}),
      {...senderFor(ext, DAPP), tab: undefined},
      senderFor(ext, DAPP, {documentLifecycle: 'prerender'}),
      senderFor(ext, 'https://dapp.test/path'),
      senderFor(ext, 'https://user@dapp.test'),
      {...senderFor(ext, DAPP), origin: undefined},
    ];
    for (const s of refused) {
      const port = fakePort(s);
      expect([s, acceptPagePort(ext, deps, port)]).toEqual([s, null]);
      expect(port.disconnected).toBe(true);
    }
    expect(runtimeFor(ext).ports.size).toBe(0);
    const ok = fakePort(senderFor(ext, DAPP));
    expect(acceptPagePort(ext, deps, ok)).toMatchObject({tabId: TAB, origin: DAPP, host: 'dapp.test', documentId: 'doc-1'});
    expect(ok.disconnected).toBe(false);
    // A lifecycle the browser does not report (Firefox) is no refusal.
    expect(acceptPagePort(ext, deps, fakePort({...senderFor(ext, DAPP), documentLifecycle: undefined}))).not.toBeNull();
  });

  // Review Focus 1: an IP literal with a port — the origin as the browser serialises it, the bracketed host.
  it('an IP-literal origin with a port is accepted and keyed exactly; its request queues like any other', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, 'https://[2001:db8::1]:8443');
    expect([page.live.origin, page.live.host]).toEqual(['https://[2001:db8::1]:8443', '[2001:db8::1]']);
    expect(await page.ask(connect('c1'))).toMatchObject({accepted: true});
    expect((await queue(ext)).map(e => [e.origin, e.host])).toEqual([['https://[2001:db8::1]:8443', '[2001:db8::1]']]);
  });

  // Final review I3: a trailing-dot host is a distinct origin to the browser, but the same site — blocks, cooldowns
  // and C3's per-host cap all key on the host string, so `dapp.test.` would sidestep every one of them. Refused.
  it('refuses a trailing-dot host (with or without a port) — the same host without the dot is accepted (positive control)', async () => {
    const {ext, deps} = await setup();
    for (const origin of ['https://dapp.test.', 'https://dapp.test.:8443', 'https://jup.ag.']) {
      const port = fakePort(senderFor(ext, origin));
      expect([origin, acceptPagePort(ext, deps, port)]).toEqual([origin, null]);
      expect(port.disconnected).toBe(true);
    }
    expect(acceptPagePort(ext, deps, fakePort(senderFor(ext, 'https://dapp.test:8443')))).toMatchObject({host: 'dapp.test'});
    expect(acceptPagePort(ext, deps, fakePort(senderFor(ext, DAPP)))).toMatchObject({host: 'dapp.test'});
  });

  it('keys the port from sender.origin — a forged sender.url is never read', async () => {
    const {ext, deps} = await setup();
    const live = acceptPagePort(ext, deps, fakePort(senderFor(ext, 'https://evil.test', {url: 'https://jup.ag/'})));
    expect(live?.origin).toBe('https://evil.test');
    expect(live?.host).toBe('evil.test');
  });

  it('refuses a port of another name', async () => {
    const {ext, deps} = await setup();
    const port = fakePort(senderFor(ext, DAPP), 'other');
    expect(acceptPagePort(ext, deps, port)).toBeNull();
    expect(port.disconnected).toBe(true);
  });
});

describe('the partitions (§1.3, §6.1)', () => {
  it('a page type through runtime.sendMessage is refused — from an extension page and from a content script', async () => {
    const {ext, deps} = await setup();
    const popup = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`};
    expect(await handleMessage(ext, connect('a'), popup, deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await handleMessage(ext, connect('a'), {...senderFor(ext, DAPP)}, deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await queue(ext)).toEqual([]);
  });

  it('a privileged type on a page port is refused: vault.lock from a page locks nothing; a later-plan type is refused too', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    expect(await page.ask({type: 'vault.lock', id: 'x1'})).toEqual({id: 'x1', error: 'invalid-request'});
    expect(await page.ask({type: 'page.signTransaction', id: 'x2'})).toEqual({id: 'x2', error: 'invalid-request'});
    expect(await getSession(ext)).not.toBeNull();
  });

  it('a privileged message from a content script (sender.id ours, origin a web page) is forbidden', async () => {
    const {ext, deps} = await setup();
    expect(await handleMessage(ext, {type: 'vault.lock'}, senderFor(ext, DAPP), deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await getSession(ext)).not.toBeNull();
  });
});

describe('connect (§2.2) — silent and explicit, with and without a grant, locked and unlocked', () => {
  it('silent: [] without a grant, [account] with one while unlocked, [] while locked even for a persistent grant — never a window', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    expect(await page.ask(connect('s1', true))).toEqual({id: 's1', result: {accounts: []}});
    await ext.local.set(GRANTS_KEY, [grant(DAPP)]);
    deps.clock.t += 5;
    expect(await page.ask(connect('s2', true))).toEqual({id: 's2', result: {accounts: [ACCOUNT.publicKey]}});
    expect(((await ext.local.get(GRANTS_KEY)) as Grant[])[0]?.lastUsedAt).toBe(deps.clock.t);
    await lock(ext);
    expect(await page.ask(connect('s3', true))).toEqual({id: 's3', result: {accounts: []}});
    expect(ext.approval.created).toEqual([]);
    expect(await queue(ext)).toEqual([]);
  });

  // Fix round 1, item 2 (D3): a lingering grant (a restore keeps both the block and the grant) must never let a
  // blocked host learn the account, silent or explicit — the block is checked before the grant is even read.
  it('a blocked host with a lingering grant: silent connect returns [], explicit is rejected, regardless of the grant', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(DAPP)]);
    await ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    expect(await openPage(ext, deps, DAPP).ask(connect('s1', true))).toEqual({id: 's1', result: {accounts: []}});
    expect(await openPage(ext, deps, DAPP, {tab: {id: 9}}).ask(connect('c1'))).toEqual({id: 'c1', error: 'rejected'});
  });

  it('explicit with a grant while unlocked: the account at once, no window (§2.2 row 3)', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(DAPP)]);
    expect(await openPage(ext, deps, DAPP).ask(connect('c1'))).toEqual({id: 'c1', result: {accounts: [ACCOUNT.publicKey]}});
    expect(ext.approval.created).toEqual([]);
  });

  it('explicit without a grant: queued, accepted with a 128-bit requestId, and the approval window opens at 412 × 720', async () => {
    const {ext, deps} = await setup();
    const r = await openPage(ext, deps, DAPP).ask(connect('c1'));
    expect(r).toEqual({id: 'c1', accepted: true, requestId: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/)});
    expect(await queue(ext)).toMatchObject([{requestId: r?.requestId, pageId: 'c1', origin: DAPP, host: 'dapp.test', tabId: TAB, documentId: 'doc-1', type: 'connect', state: 'queued', arrivedAt: deps.clock.t}]);
    expect(ext.approval.created).toEqual([{page: 'approve.html', width: WINDOW_WIDTH, height: WINDOW_HEIGHT}]);
    expect([WINDOW_WIDTH, WINDOW_HEIGHT]).toEqual([412, 720]);
    expect((await readDappSession(ext)).window).toEqual({id: 100, showing: null});
    expect(ext.alarmsSet.has(QUEUE_ALARM)).toBe(true);
  });

  it('explicit while locked, no grant: queued (the window shows "locked", D11)', async () => {
    const {ext, deps} = await setup({unlocked: false});
    expect(await openPage(ext, deps, DAPP).ask(connect('c1'))).toMatchObject({accepted: true});
    expect(ext.approval.created).toHaveLength(1);
  });

  it('a re-sent request (the same relay id, tab and origin) is the same request — C9, never a second entry', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const a = await page.ask(connect('c1'));
    const b = await openPage(ext, deps, DAPP).ask(connect('c1'));
    expect(b).toEqual(a);
    expect(await queue(ext)).toHaveLength(1);
  });

  it('malformed: no id or a bad silent flag — invalid-request when there is an id to answer, else nothing', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    expect(await page.ask({type: 'page.connect', id: 'c1', silent: 'yes'})).toEqual({id: 'c1', error: 'invalid-request'});
    expect(await page.ask({type: 'page.connect', id: 'has space', silent: false})).toBeUndefined();
    expect(await queue(ext)).toEqual([]);
  });
});

describe('C3 — one open request per host and per tab, five in total, FIFO across origins', () => {
  it('a second from the same host (another tab) or the same tab (another host) gets request-pending; the sixth gets busy', async () => {
    const {ext, deps} = await setup();
    expect(await openPage(ext, deps, DAPP).ask(connect('a'))).toMatchObject({accepted: true});
    expect(await openPage(ext, deps, DAPP, {tab: {id: 8}}).ask(connect('b'))).toEqual({id: 'b', error: 'request-pending'});
    expect(await openPage(ext, deps, OTHER).ask(connect('c'))).toEqual({id: 'c', error: 'request-pending'});
    for (let i = 1; i < MAX_OPEN; i++) expect(await openPage(ext, deps, `https://s${i}.test`, {tab: {id: 100 + i}}).ask(connect(`q${i}`))).toMatchObject({accepted: true});
    expect(await openPage(ext, deps, 'https://six.test', {tab: {id: 200}}).ask(connect('q6'))).toEqual({id: 'q6', error: 'busy'});
    expect((await queue(ext)).map(e => e.origin)).toEqual([DAPP, 'https://s1.test', 'https://s2.test', 'https://s3.test', 'https://s4.test']);
    // One window for all of them (C3: no stacked windows).
    expect(ext.approval.created).toHaveLength(1);
  });

  it('a page sending a thousand requests at once: the first is queued, the rest request-pending (§5)', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const out = await Promise.all(Array.from({length: 1000}, (_, i) => page.ask(connect(`m${i}`))));
    expect(out.filter(r => r?.accepted === true)).toHaveLength(1);
    expect(out.filter(r => r?.error === 'request-pending')).toHaveLength(999);
  });
});

describe('delivery, resume and ack (§1.5, C9)', () => {
  async function shownThenClosed() {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    const requestId = String(r?.requestId);
    // The window showed it (dapp.pending records that, Task 4), and the user closed the window.
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: requestId}});
    ext.approval.open.delete(100);
    await onApprovalWindowRemoved(ext, deps, 100);
    return {ext, deps, page, requestId};
  }

  it('the answer is delivered on every live port of that (tabId, origin) — and only there', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const twin = openPage(ext, deps, DAPP);
    const elsewhere = openPage(ext, deps, DAPP, {tab: {id: 9}});
    const r = await page.ask(connect('c1'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: r?.requestId}});
    await onApprovalWindowRemoved(ext, deps, 100);
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(twin.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(elsewhere.answersFor(String(r?.requestId))).toEqual([]);
  });

  it('a port that was down resumes: the stored answer, once acked gone; a foreign port gets unknown and its ack deletes nothing', async () => {
    const {ext, deps, page, requestId} = await shownThenClosed();
    page.port.drop();
    expect(runtimeFor(ext).ports.size).toBe(0);
    const back = openPage(ext, deps, DAPP);
    expect(await back.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, error: 'rejected'}]});
    // Another tab of the same origin, and another origin in the same tab, own nothing of it.
    const foreign = openPage(ext, deps, DAPP, {tab: {id: 9}});
    expect(await foreign.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, unknown: true}]});
    await foreign.ask({type: 'page.ack', requestId});
    await openPage(ext, deps, OTHER).ask({type: 'page.ack', requestId});
    expect((await queue(ext)).map(e => e.requestId)).toEqual([requestId]);
    // Positive control: the owner's ack deletes it.
    await back.ask({type: 'page.ack', requestId});
    expect(await queue(ext)).toEqual([]);
    expect(await back.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, unknown: true}]});
  });

  it('a still-open request resumes as pending; a worker restart keeps it (storage, not memory) — the old port is gone', async () => {
    const {ext, deps} = await setup();
    const r = await openPage(ext, deps, DAPP).ask(connect('c1'));
    restartRuntime(ext);
    expect(runtimeFor(ext).ports.size).toBe(0);
    const back = openPage(ext, deps, DAPP);
    expect(await back.ask({type: 'page.resume', requestIds: [r?.requestId]})).toEqual({resume: [{requestId: r?.requestId, pending: true}]});
  });

  it('an answered entry nobody acks is deleted ten minutes after its answer', async () => {
    const {ext, deps, requestId} = await shownThenClosed();
    deps.clock.t += ANSWER_TTL_MS - 1;
    await onQueueAlarm(ext, deps);
    expect((await queue(ext)).map(e => e.requestId)).toEqual([requestId]);
    deps.clock.t += 1;
    await onQueueAlarm(ext, deps);
    expect(await queue(ext)).toEqual([]);
    expect(ext.alarmsSet.has(QUEUE_ALARM)).toBe(false);
  });

  it('page.resume and page.ack with malformed ids do nothing', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    expect(await page.ask({type: 'page.resume', requestIds: 'x'})).toBeUndefined();
    expect(await page.ask({type: 'page.resume', requestIds: Array.from({length: 17}, () => 'A'.repeat(22))})).toBeUndefined();
    expect(await page.ask({type: 'page.ack', requestId: 42})).toBeUndefined();
    expect(await page.ask({type: 'page.ping'})).toBeUndefined();
  });
});

describe('expiry (C4) and the worker-restart rule (C17)', () => {
  it('a request is answered timeout five minutes after it arrived — by the alarm or by any queue access', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    deps.clock.t += REQUEST_TTL_MS - 1;
    await onQueueAlarm(ext, deps);
    expect(page.answersFor(String(r?.requestId))).toEqual([]);
    deps.clock.t += 1;
    await page.ask(connect('silent', true));
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'timeout'}]);
  });

  it('a deciding entry another worker instance wrote is answered rejected at the next access — nothing left the extension', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'a-dead-instance', decidingAt: deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: 'session'}}))});
    await page.ask(connect('s', true));
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    // Positive control: this instance's own deciding entry is left alone (its effect is running).
    const t = await openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('c2'));
    const s2 = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s2, queue: s2.queue.map(e => (e.requestId === t?.requestId ? {...e, state: 'deciding', decidedBy: runtimeFor(ext).instance, decidingAt: deps.clock.t} : e))});
    await page.ask(connect('s2', true));
    expect((await queue(ext)).find(e => e.requestId === t?.requestId)?.state).toBe('deciding');
  });
});

describe('a deciding entry that never answers (review 1 M1)', () => {
  /** A request of DAPP made `deciding` by this instance at the clock's now, as dapp.decide writes it — and then nothing. */
  async function stuck() {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    const requestId = String(r?.requestId);
    const s = await readDappSession(ext);
    const decision = {kind: 'approve', account: ACCOUNT.publicKey, scope: 'session'};
    await ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: runtimeFor(ext).instance, decidingAt: deps.clock.t, decision}))});
    return {ext, deps, page, requestId};
  }

  it('this instance’s deciding entry is answered rejected DECIDING_TTL_MS after deciding — not a millisecond before — and the host may ask again', async () => {
    const c = await stuck();
    c.deps.clock.t += DECIDING_TTL_MS - 1;
    await onQueueAlarm(c.ext, c.deps);
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await queue(c.ext))[0]?.state).toBe('deciding');
    // While it is deciding the host's next request is request-pending (C3) — the wedge the deadline ends.
    expect(await c.page.ask(connect('c2'))).toEqual({id: 'c2', error: 'request-pending'});
    c.deps.clock.t += 1;
    await onQueueAlarm(c.ext, c.deps);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
    expect(await c.page.ask(connect('c3'))).toMatchObject({accepted: true});
  });

  it('C4 "queued or shown": a deciding entry is answered timeout five minutes after it arrived, even when deciding began a moment ago', async () => {
    const c = await stuck();
    c.deps.clock.t += REQUEST_TTL_MS - 10;
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, decidingAt: c.deps.clock.t}))});
    c.deps.clock.t += 10;
    await onQueueAlarm(c.ext, c.deps);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'timeout'}]);
  });
});

describe('lastUsedAt (§2.1, review 1 L3)', () => {
  it('moves at most once a minute: a loop of silent connects is not a grant write each', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(DAPP)]);
    const page = openPage(ext, deps, DAPP);
    const used = async () => ((await ext.local.get(GRANTS_KEY)) as Grant[])[0]?.lastUsedAt;
    const t0 = deps.clock.t;
    await page.ask(connect('s1', true));
    expect(await used()).toBe(t0);
    deps.clock.t += LAST_USED_STEP_MS - 1;
    for (let i = 0; i < 5; i++) await page.ask(connect(`s${i + 2}`, true));
    expect(await used()).toBe(t0);
    deps.clock.t += 1;
    await page.ask(connect('s9', true));
    expect(await used()).toBe(t0 + LAST_USED_STEP_MS);
  });
});

describe('a document that goes away (§2.3, review 2 H2)', () => {
  it('a new port from the same tab with another documentId answers the old document’s queued request rejected', async () => {
    const {ext, deps} = await setup();
    const old = openPage(ext, deps, DAPP);
    const r = await old.ask(connect('c1'));
    openPage(ext, deps, OTHER, {documentId: 'doc-2'});
    await settle();
    expect(old.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
  });

  it('negative control: the same document (or none reported, Firefox) cancels nothing', async () => {
    const {ext, deps} = await setup();
    const old = openPage(ext, deps, DAPP);
    const r = await old.ask(connect('c1'));
    openPage(ext, deps, DAPP);
    openPage(ext, deps, OTHER, {documentId: undefined});
    await settle();
    expect(old.answersFor(String(r?.requestId))).toEqual([]);
  });
});

describe('the approval window (§2.3, C14)', () => {
  it('windows.create rejects → the marker is cleared and the next request opens a window', async () => {
    const {ext, deps} = await setup();
    ext.approval.failNext = true;
    await expect(openPage(ext, deps, DAPP).ask(connect('c1'))).rejects.toThrow('windows.create failed');
    expect((await readDappSession(ext)).opening).toBeNull();
    expect(ext.approval.created).toEqual([]);
    expect(await openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('c2'))).toMatchObject({accepted: true});
    expect(ext.approval.created).toHaveLength(1);
    expect((await readDappSession(ext)).window).toEqual({id: 100, showing: null});
  });

  it('the alarm opens a window for a head that has none (a failed create is not left waiting)', async () => {
    const {ext, deps} = await setup();
    ext.approval.failNext = true;
    await openPage(ext, deps, DAPP)
      .ask(connect('c1'))
      .catch(() => undefined);
    await onQueueAlarm(ext, deps);
    expect(ext.approval.created).toHaveLength(1);
  });

  it('a stale marker (a worker that died mid-create) is cleared at the next queue access and the window opens', async () => {
    const {ext, deps} = await setup();
    await openPage(ext, deps, DAPP).ask(connect('c1'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: null, opening: deps.clock.t - OPENING_STALE_MS + 1});
    await ensureWindow(ext, deps);
    expect(ext.approval.created).toHaveLength(1);
    deps.clock.t += 1;
    await ensureWindow(ext, deps);
    expect(ext.approval.created).toHaveLength(2);
  });

  it('a recorded window that no longer exists is not "open": windows.get fails → a new one opens', async () => {
    const {ext, deps} = await setup();
    await openPage(ext, deps, DAPP).ask(connect('c1'));
    ext.approval.open.clear();
    await ensureWindow(ext, deps);
    expect(ext.approval.created).toHaveLength(2);
    expect((await readDappSession(ext)).window?.id).toBe(101);
  });

  it('two requests racing a window open: one create (the marker)', async () => {
    const {ext, deps} = await setup();
    const release = ext.approval.hold();
    const first = openPage(ext, deps, DAPP).ask(connect('c1'));
    const second = openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('c2'));
    await settle();
    release();
    await Promise.all([first, second]);
    expect(ext.approval.created).toHaveLength(1);
  });

  it('closing the window rejects only the request it showed, only if still queued, and counts it for C14', async () => {
    const {ext, deps} = await setup();
    const a = await openPage(ext, deps, DAPP).ask(connect('a'));
    const b = await openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('b'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: b?.requestId}});
    ext.approval.open.delete(100);
    await onApprovalWindowRemoved(ext, deps, 100);
    expect((await queue(ext)).map(e => [e.requestId, e.state])).toEqual([
      [a?.requestId, 'queued'],
      [b?.requestId, 'answered'],
    ]);
    expect(((await ext.local.get(LIMITS_KEY)) as {rejections: unknown[]}).rejections).toHaveLength(2);
    // The rest of the queue gets a window again.
    expect(ext.approval.created).toHaveLength(2);
    // Another window id is not ours: nothing happens.
    await onApprovalWindowRemoved(ext, deps, 555);
    expect((await queue(ext)).find(e => e.requestId === a?.requestId)?.state).toBe('queued');
  });

  it('C14 budget: beyond ten windows in ten minutes a request is rejected with no window, and the next window carries the notice flag', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: Array.from({length: WINDOW_BUDGET}, () => deps.clock.t), notice: false});
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(ext.approval.created).toEqual([]);
    expect(((await ext.local.get(LIMITS_KEY)) as {notice: boolean}).notice).toBe(true);
  });
});

describe('blocked and cooling-down hosts (§2.6, C14)', () => {
  it('a blocked host is answered rejected at once: no window, no queue entry — whatever its port or scheme', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    expect(await openPage(ext, deps, DAPP).ask(connect('c1'))).toEqual({id: 'c1', error: 'rejected'});
    expect(await openPage(ext, deps, 'https://dapp.test:8443', {tab: {id: 9}}).ask(connect('c2'))).toEqual({id: 'c2', error: 'rejected'});
    expect(await queue(ext)).toEqual([]);
    expect(ext.approval.created).toEqual([]);
  });

  it('a host or a tab in cooldown is answered rejected at once', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: `tab:${TAB}`, until: deps.clock.t + 1}], windows: [], notice: false});
    expect(await openPage(ext, deps, 'https://fresh.test').ask(connect('c1'))).toEqual({id: 'c1', error: 'rejected'});
    expect(await openPage(ext, deps, 'https://fresh.test', {tab: {id: 9}}).ask(connect('c2'))).toMatchObject({accepted: true});
  });
});

describe('page.disconnect (C2)', () => {
  it('removes a persistent grant, rejects the origin’s queued requests and sends change [] to its ports', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(DAPP), grant(OTHER)]);
    const page = openPage(ext, deps, DAPP);
    const twin = openPage(ext, deps, DAPP, {tab: {id: 9}});
    const other = openPage(ext, deps, OTHER, {tab: {id: 10}});
    expect(await page.ask({type: 'page.disconnect', id: 'd1'})).toEqual({id: 'd1', result: {}});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([grant(OTHER)]);
    expect([page.changes(), twin.changes(), other.changes()]).toEqual([[[]], [[]], []]);
    // The next connect asks again (#47).
    expect(await page.ask(connect('c1'))).toMatchObject({accepted: true});
  });
});

// Fix round 1, Important 1 (§2.4, review 2 L9): closing the approval window must not reopen one before the
// browser-closed check has a chance to see the count it left behind — a reopen changes the count first and the
// close is never seen as "the last window".
describe('closing the last window locks instead of reopening (§2.4, review 2 L9, fix round 1)', () => {
  it('closing the popup when it is the last window locks, delivers rejected to every live port, and opens no window', async () => {
    const {ext, deps} = await setup();
    const pageA = openPage(ext, deps, DAPP);
    const pageB = openPage(ext, deps, OTHER, {tab: {id: 9}});
    const a = await pageA.ask(connect('a'));
    const b = await pageB.ask(connect('b'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: a?.requestId}});
    ext.approval.open.delete(100);
    // The popup was the only window the browser had open.
    ext.windows = 0;
    expect(await onApprovalWindowRemoved(ext, deps, 100)).toBe(true);
    expect(await getSession(ext)).toBeNull();
    // Exactly the one window the first queued request opened — none reopened for what was left.
    expect(ext.approval.created).toHaveLength(1);
    // Both the shown request and the one still queued are delivered rejected to their ports (this drain, before the
    // lock). The lock hook (B1c §2.4) then wipes storage.session but writes the already-answered queue back, so a
    // relay's resume still finds them — the stored queue is not emptied, both entries stay `answered`/`rejected`.
    expect(pageA.answersFor(String(a?.requestId))).toEqual([{requestId: a?.requestId, error: 'rejected'}]);
    expect(pageB.answersFor(String(b?.requestId))).toEqual([{requestId: b?.requestId, error: 'rejected'}]);
    expect((await queue(ext)).map(e => [e.requestId, e.state, e.answer])).toEqual([
      [a?.requestId, 'answered', {error: 'rejected'}],
      [b?.requestId, 'answered', {error: 'rejected'}],
    ]);
  });

  it('positive control: with a browser window still open, the rest of the queue still gets a window', async () => {
    const {ext, deps} = await setup();
    const a = await openPage(ext, deps, DAPP).ask(connect('a'));
    const b = await openPage(ext, deps, OTHER, {tab: {id: 9}}).ask(connect('b'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: a?.requestId}});
    ext.approval.open.delete(100);
    expect(await onApprovalWindowRemoved(ext, deps, 100)).toBe(true);
    expect(await getSession(ext)).not.toBeNull();
    expect(ext.approval.created).toHaveLength(2);
    expect((await queue(ext)).find(e => e.requestId === b?.requestId)?.state).toBe('queued');
  });

  it('a window id that is not ours returns false and touches neither the lock nor the queue', async () => {
    const {ext, deps} = await setup();
    ext.windows = 0;
    expect(await onApprovalWindowRemoved(ext, deps, 555)).toBe(false);
    expect(await getSession(ext)).not.toBeNull();
    expect(ext.approval.created).toEqual([]);
  });

  // Fix round 2, Important 1(b): a storage failure in the drain must not skip the lock — fail closed.
  it('(b) our window closed as the last one, and the drain throws — still locks', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: r?.requestId}});
    ext.approval.open.delete(100);
    ext.windows = 0;
    // The first read (determining "ours") succeeds; the second (the drain, inside the windowCount === 0 branch)
    // throws — a storage error, a quota failure, a bad stored shape.
    let calls = 0;
    const realGet = ext.session.get.bind(ext.session);
    ext.session.get = async key => {
      if (key === DAPP_SESSION_KEY) {
        calls += 1;
        if (calls === 2) throw new Error('storage exploded mid-drain');
      }
      return realGet(key);
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(onApprovalWindowRemoved(ext, deps, 100)).resolves.toBe(true);
    warnSpy.mockRestore();
    expect(await getSession(ext)).toBeNull();
  });
});

// Fix round 1, promoted Minor 2 (Scope R11): only a user's own rejection — closing the window on a request it
// showed — counts toward C14's cooldown. Every background refusal below must leave LIMITS.rejections untouched.
describe('Scope R11 — only a user’s own rejection counts (fix round 1)', () => {
  const rejectionsOf = async (ext: ReturnType<typeof fakeExt>): Promise<unknown[]> => ((await ext.local.get(LIMITS_KEY)) as {rejections?: unknown[]} | undefined)?.rejections ?? [];

  it('a blocked-host refusal records no rejection', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    expect(await openPage(ext, deps, DAPP).ask(connect('c1'))).toEqual({id: 'c1', error: 'rejected'});
    expect(await rejectionsOf(ext)).toEqual([]);
  });

  it('a cooldown refusal records no (additional) rejection', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: `tab:${TAB}`, until: deps.clock.t + 1}], windows: [], notice: false});
    expect(await openPage(ext, deps, DAPP).ask(connect('c1'))).toEqual({id: 'c1', error: 'rejected'});
    expect(await rejectionsOf(ext)).toEqual([]);
  });

  it('the C14 budget refusal records no rejection', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: Array.from({length: WINDOW_BUDGET}, () => deps.clock.t), notice: false});
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(await rejectionsOf(ext)).toEqual([]);
  });

  it('an expiry (timeout) records no rejection', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    deps.clock.t += REQUEST_TTL_MS;
    await onQueueAlarm(ext, deps);
    // Not vacuous: the cancellation this test is about actually happened.
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'timeout'}]);
    expect(await rejectionsOf(ext)).toEqual([]);
  });

  it('a documentChanged cancel records no rejection', async () => {
    const {ext, deps} = await setup();
    const old = openPage(ext, deps, DAPP);
    const r = await old.ask(connect('c1'));
    openPage(ext, deps, OTHER, {documentId: 'doc-2'});
    await settle();
    // Not vacuous: the cancellation this test is about actually happened.
    expect(old.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(await rejectionsOf(ext)).toEqual([]);
  });

  it('a page.disconnect records no rejection for the queued requests it cancels', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    await page.ask({type: 'page.disconnect', id: 'd1'});
    // Not vacuous: the cancellation this test is about actually happened.
    expect(page.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    expect(await rejectionsOf(ext)).toEqual([]);
  });

  it('positive control: a user closing the window on a shown request DOES record a rejection', async () => {
    const {ext, deps} = await setup();
    const page = openPage(ext, deps, DAPP);
    const r = await page.ask(connect('c1'));
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: r?.requestId}});
    ext.approval.open.delete(100);
    await onApprovalWindowRemoved(ext, deps, 100);
    // withRejection counts both the host and the tab key for one rejection.
    expect(await rejectionsOf(ext)).toHaveLength(2);
  });
});

// Fix round 1, promoted Minor 3 (C9, D5): a relay id is scoped to its document too, not only its tab and origin.
describe('C9 is also scoped to the document (fix round 1)', () => {
  it('a new document in the same tab, re-using the same relay id, never gets the old document’s stored answer', async () => {
    const {ext, deps} = await setup();
    const docA = openPage(ext, deps, DAPP, {documentId: 'doc-a'});
    const r = await docA.ask(connect('c1'));
    // The window showed doc A's request, and the user closed the window: it is answered rejected.
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, window: {id: 100, showing: r?.requestId}});
    ext.approval.open.delete(100);
    await onApprovalWindowRemoved(ext, deps, 100);
    expect(docA.answersFor(String(r?.requestId))).toEqual([{requestId: r?.requestId, error: 'rejected'}]);
    // A fresh document in the SAME tab, re-using the SAME relay id (each document keeps its own counter, so a
    // collision is only a coincidence, not a protocol guarantee) must never be handed doc A's stored answer.
    const docB = openPage(ext, deps, DAPP, {documentId: 'doc-b'});
    const r2 = await docB.ask(connect('c1'));
    expect(r2).toMatchObject({id: 'c1', accepted: true});
    expect(r2?.requestId).not.toBe(r?.requestId);
    expect((await queue(ext)).find(e => e.requestId === r2?.requestId)).toMatchObject({documentId: 'doc-b', state: 'queued'});
    expect(docB.answersFor(String(r?.requestId))).toEqual([]);
  });
});
