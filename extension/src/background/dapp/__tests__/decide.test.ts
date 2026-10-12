import {handleMessage} from '../../messages';
import {lock} from '../../autolock';
import {getSession, setSession} from '../../session';
import {VAULT_KEY} from '../../accountsStore';
import {SETTINGS_KEY} from '../../settings';
import {GRANTS_KEY, MAX_GRANTS, type Grant} from '../grants';
import {BLOCKED_KEY} from '../blocked';
import {LIMITS_KEY} from '../limits';
import {REQUEST_TTL_MS, runUnlockHook} from '../queue';
import {DAPP_SESSION_KEY, readDappSession, type Entry} from '../store';
import {restartRuntime, runtimeFor} from '../ports';
import {UNDO_MS} from '../grantsApi';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT, RECIPIENT} from '../../__tests__/fixtures';
import {openPage, type Page} from './pageHarness';

const SECOND = {index: 1, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey};
const DAPP = 'https://dapp.test';
const JUP = 'https://jup.ag';
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});

async function setup(o: {unlocked?: boolean} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}, {index: 1, name: 'Savings', publicKey: RECIPIENT}]});
  if (o.unlocked !== false) await setSession(ext, [ACCOUNT, SECOND]);
  // Written directly: the session's unlock hook runs before any page opens (as vault.setKeys runs it).
  if (o.unlocked !== false) await runUnlockHook(ext, deps);
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const popup = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`};
  const pend = async () => (await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)) as {ok: boolean; data: Record<string, unknown> & {state: string; request: Record<string, unknown>}};
  const decide = (m: Record<string, unknown>) => handleMessage(ext, {type: 'dapp.decide', ...m}, approve, deps);
  const ui = (m: Record<string, unknown>) => handleMessage(ext, m, popup, deps);
  return {ext, deps, approve, popup, pend, decide, ui};
}
async function request(ext: ReturnType<typeof fakeExt>, deps: ReturnType<typeof fakeDeps>, origin: string, tab = 7): Promise<{page: Page; requestId: string}> {
  const page = openPage(ext, deps, origin, {tab: {id: tab}});
  const r = await page.ask({type: 'page.connect', id: `c${tab}`, silent: false});
  return {page, requestId: String(r?.requestId)};
}

// Spec §1.4, §1.5, §2.3, §2.7, C2, C12, C13, C14, C17 — the approval window's messages and #49's, against the real
// background. Each refusal of §2.3's table has its own test and its own mutation (plan Task 4).
describe('who may ask (§1.4)', () => {
  it('dapp.pending and dapp.decide only from approve.html; the grants messages only from the popup or the tab', async () => {
    const {ext, deps, approve, popup} = await setup();
    const unlock = {...popup, url: `${ext.extensionOrigin}/unlock.html`};
    const tab = {...popup, url: `${ext.extensionOrigin}/wallet.html`};
    const web = {id: ext.runtimeId, origin: DAPP, url: `${DAPP}/approve.html`, tab: {id: 1}, frameId: 0};
    for (const s of [popup, unlock, tab, web]) expect(await handleMessage(ext, {type: 'dapp.pending'}, s, deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)).toEqual({ok: true, data: {state: 'none'}});
    for (const s of [approve, unlock, web]) expect(await handleMessage(ext, {type: 'dapp.grants.list'}, s, deps)).toEqual({ok: false, error: 'forbidden'});
    for (const s of [popup, tab]) expect(await handleMessage(ext, {type: 'dapp.grants.list'}, s, deps)).toEqual({ok: true, data: {grants: []}});
  });
});

// Final review I2: approve.html is the one extension page a site can cause to exist — it may send its two types and
// nothing else (an inclusive allow-list for that sender). Every other privileged type is refused before its handler
// runs, so nothing below changes state (the session stays, no alarm is armed).
describe('approve.html may send dapp.pending and dapp.decide only (final review I2)', () => {
  it('refuses activity.ping, vault.lock, vault.status, wallet.send, contacts.set, accounts.select from the approval window', async () => {
    const {ext, deps, approve, popup} = await setup();
    const refused = [
      {type: 'activity.ping'},
      {type: 'vault.lock'},
      {type: 'vault.status'},
      {type: 'wallet.state'},
      {type: 'wallet.send', to: RECIPIENT, amount: '1'},
      {type: 'contacts.set', contacts: []},
      {type: 'accounts.select', index: 1},
    ];
    for (const m of refused) expect([m.type, await handleMessage(ext, m, approve, deps)]).toEqual([m.type, {ok: false, error: 'forbidden'}]);
    expect(await getSession(ext)).not.toBeNull();
    expect(ext.alarmsSet.size).toBe(0);
    // Positive controls: the window's own two pass; the popup's vault.status is not affected by the window's list.
    expect(await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)).toEqual({ok: true, data: {state: 'none'}});
    expect(await handleMessage(ext, {type: 'dapp.decide', requestId: 'A'.repeat(22), decision: 'reject'}, approve, deps)).not.toEqual({ok: false, error: 'forbidden'});
    expect(await handleMessage(ext, {type: 'vault.status'}, popup, deps)).toMatchObject({ok: true});
  });
});

describe('dapp.pending (§2.3, §4.3)', () => {
  it('the head as the window shows it: origin, the classification, the account picker (display order, active chosen), waiting', async () => {
    const {ext, deps, pend} = await setup();
    await ext.local.set(SETTINGS_KEY, {selectedAccount: 1, accountOrder: [1, 0]});
    const {requestId} = await request(ext, deps, 'https://tensr.trade');
    await request(ext, deps, JUP, 8);
    const r = await pend();
    expect(r.data).toEqual({
      state: 'request',
      waiting: 1,
      windowNotice: false,
      request: {
        requestId,
        type: 'connect',
        origin: 'https://tensr.trade',
        host: 'tensr.trade',
        site: {kind: 'lookalike', name: 'tensr', imitates: 'tensor.trade', rule: 'edit', idn: null, international: false},
        offerBlock: false,
        connect: {
          accounts: [
            {index: 1, name: 'Savings', publicKey: RECIPIENT},
            {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
          ],
          selected: 1,
          cap: false,
        },
        sign: null,
      },
    });
    // The window now shows it: closing the window rejects this one.
    expect((await readDappSession(ext)).window?.showing).toBe(requestId);
  });

  it('locked: the origin card only, no account list (D11); none: an empty queue (the window closes itself)', async () => {
    const {ext, deps, pend} = await setup({unlocked: false});
    await request(ext, deps, DAPP);
    const r = await pend();
    expect(r.data.state).toBe('locked');
    expect(r.data.request.connect).toBeNull();
    expect(r.data.request.site).toEqual({kind: 'unknown', name: 'dapp', imitates: null, rule: null, idn: null, international: false});
  });

  it('the budget notice (Q24) is shown once', async () => {
    const {ext, deps, pend} = await setup();
    await request(ext, deps, DAPP);
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [], windows: [], notice: true});
    expect((await pend()).data.windowNotice).toBe(true);
    expect((await pend()).data.windowNotice).toBe(false);
  });

  it('a request whose host or tab already has two rejections offers [Block this site] (Q17)', async () => {
    const {ext, deps, pend} = await setup();
    await ext.local.set(LIMITS_KEY, {rejections: [{key: 'host:dapp.test', at: deps.clock.t}, {key: 'host:dapp.test', at: deps.clock.t}], cooldowns: [], windows: [], notice: false});
    await request(ext, deps, DAPP);
    expect((await pend()).data.request.offerBlock).toBe(true);
  });

  it('the cap (§2.1): 200 persistent grants and none for this origin — cap: true', async () => {
    const {ext, deps, pend} = await setup();
    await ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => grant(`https://s${i}.test`)));
    await request(ext, deps, DAPP);
    expect((await pend()).data.request.connect).toMatchObject({cap: true});
  });
});

describe('dapp.decide — a connect (§3.1 outcomes)', () => {
  it('approve, this session only: a session grant, the page gets its account; the next request is the head; auto-lock armed', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, DAPP);
    ext.alarmsSet.clear();
    expect(await decide({requestId, decision: 'approve', account: RECIPIENT, scope: 'session'})).toEqual({ok: true});
    expect(page.answersFor(requestId)).toEqual([{requestId, result: {accounts: [RECIPIENT]}}]);
    const s = await readDappSession(ext);
    expect(s.grants).toEqual([{origin: DAPP, account: RECIPIENT, scope: 'session', connectedAt: deps.clock.t, lastUsedAt: deps.clock.t, recent: [{type: 'connect', at: deps.clock.t, outcome: 'approved'}]}]);
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect(ext.alarmsSet.has('autolock')).toBe(true);
    // C1: the dApp's account is the one granted — a silent connect returns it, not the popup's active account.
    expect(await page.ask({type: 'page.connect', id: 's', silent: true})).toEqual({id: 's', result: {accounts: [RECIPIENT]}});
  });

  it('approve, until revoked, for a verified origin: a persistent grant', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, JUP);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(((await ext.local.get(GRANTS_KEY)) as Grant[]).map(g => [g.origin, g.scope])).toEqual([[JUP, 'persistent']]);
  });

  it('reject: rejected, counted for C14 per host and per tab, nothing granted (a first connect has no grant to record on)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'reject'})).toEqual({ok: true});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(((await ext.local.get(LIMITS_KEY)) as {rejections: {key: string}[]}).rejections.map(r => r.key)).toEqual(['host:dapp.test', 'tab:7']);
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect((await readDappSession(ext)).grants).toEqual([]);
  });

  it('three rejections from one host: the fourth request is rejected with no queue entry (C14)', async () => {
    const {ext, deps, decide} = await setup();
    for (let i = 0; i < 3; i++) {
      const {requestId} = await request(ext, deps, DAPP, 10 + i);
      await decide({requestId, decision: 'reject'});
    }
    const page = openPage(ext, deps, DAPP, {tab: {id: 20}});
    expect(await page.ask({type: 'page.connect', id: 'x', silent: false})).toEqual({id: 'x', error: 'rejected'});
  });

  it('report (and Block this site): rejected, the host blocked with what it imitates, its grants revoked in both scopes, change [] (§2.6)', async () => {
    const {ext, deps, decide} = await setup();
    await ext.local.set(GRANTS_KEY, [grant('https://tensr.trade:8443')]);
    const holder = openPage(ext, deps, 'https://tensr.trade:8443', {tab: {id: 3}});
    const {page, requestId} = await request(ext, deps, 'https://tensr.trade');
    expect(await decide({requestId, decision: 'report'})).toEqual({ok: true});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(await ext.local.get(BLOCKED_KEY)).toEqual([{host: 'tensr.trade', blockedAt: deps.clock.t, imitates: 'tensor.trade'}]);
    expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
    expect(holder.changes()).toEqual([[]]);
    // The next request from it: no window, no entry.
    expect(await page.ask({type: 'page.connect', id: 'again', silent: false})).toEqual({id: 'again', error: 'rejected'});
    const {requestId: b} = await request(ext, deps, 'https://unknown.test', 30);
    expect(await decide({requestId: b, decision: 'block'})).toEqual({ok: true});
    expect(((await ext.local.get(BLOCKED_KEY)) as {host: string; imitates: string | null}[])[0]).toEqual({host: 'unknown.test', blockedAt: deps.clock.t, imitates: null});
  });

  it('block answers the host’s other queued requests rejected — every port of it (review 1 M3; seeded: C3 admits one open request per host)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, 'https://tensr.trade');
    const other = openPage(ext, deps, 'https://tensr.trade:8443', {tab: {id: 31}});
    // Through the page path the host's second request never queues (C3) — so the queue is seeded as a later change of
    // C3, or a restored session, could leave it.
    expect(await other.ask({type: 'page.connect', id: 'o', silent: false})).toEqual({id: 'o', error: 'request-pending'});
    const s = await readDappSession(ext);
    const head = s.queue[0] as Entry;
    const second: Entry = {...head, requestId: 'S'.repeat(22), pageId: 'o2', origin: 'https://tensr.trade:8443', tabId: 31};
    const elsewhere: Entry = {...head, requestId: 'E'.repeat(22), pageId: 'e2', origin: JUP, host: 'jup.ag', tabId: 32};
    await ext.session.set(DAPP_SESSION_KEY, {...s, queue: [head, second, elsewhere]});
    expect(await decide({requestId, decision: 'block'})).toEqual({ok: true});
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
    expect(other.answersFor(second.requestId)).toEqual([{requestId: second.requestId, error: 'rejected'}]);
    // Positive control: another host's request is left queued.
    expect((await readDappSession(ext)).queue.find(e => e.requestId === elsewhere.requestId)?.state).toBe('queued');
  });
});

describe('dapp.decide — §2.3’s refusals, one row each', () => {
  it('head: not the head, or not queued; unknown id', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId: first} = await request(ext, deps, DAPP);
    const {requestId: second} = await request(ext, deps, JUP, 8);
    expect(await decide({requestId: second, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'not-head'});
    expect(await decide({requestId: 'A'.repeat(22), decision: 'reject'})).toEqual({ok: false, error: 'not-head'});
    // Positive control: the head is decidable.
    expect(await decide({requestId: first, decision: 'reject'})).toEqual({ok: true});
    expect(await decide({requestId: first, decision: 'reject'})).toEqual({ok: false, error: 'not-head'});
  });

  it('expiry: a request past five minutes', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    deps.clock.t += REQUEST_TTL_MS;
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'expired'});
    expect((await readDappSession(ext)).grants).toEqual([]);
  });

  it('unlocked: locked at the write — no grant written', async () => {
    const {ext, deps, decide} = await setup({unlocked: false});
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'locked'});
    // Review 1 L2: report and block write the user's lists — refused while locked too; nothing blocked.
    expect(await decide({requestId, decision: 'report'})).toEqual({ok: false, error: 'locked'});
    expect(await decide({requestId, decision: 'block'})).toEqual({ok: false, error: 'locked'});
    expect(await ext.local.get(BLOCKED_KEY)).toBeUndefined();
    // Reject works while locked (the locked screen's [Reject]).
    expect(await decide({requestId, decision: 'reject'})).toEqual({ok: true});
  });

  it('account: not one of the session’s accounts', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve', account: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', scope: 'session'})).toEqual({ok: false, error: 'unknown-account'});
    expect(await decide({requestId, decision: 'approve', scope: 'session'})).toEqual({ok: false, error: 'unknown-account'});
  });

  it('scope: persistent for an unknown or a lookalike origin (C12); session for them is fine', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: false, error: 'scope'});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: true});
    const {requestId: look} = await request(ext, deps, 'https://xn--phntom-4nf.app', 9);
    expect(await decide({requestId: look, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: false, error: 'scope'});
  });

  it('blocked: the host blocked, or the host or tab in cooldown, after the request was queued', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    await ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'blocked'});
    await ext.local.set(BLOCKED_KEY, []);
    await ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: 'tab:7', until: deps.clock.t + 1}], windows: [], notice: false});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'blocked'});
  });

  it('cap: 200 persistent grants and none for this origin — only Reject (Q16)', async () => {
    const {ext, deps, decide} = await setup();
    await ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => grant(`https://s${i}.test`)));
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'cap'});
  });

  it('a second decide for a deciding entry is refused (not-head) — and dapp.pending shows it as deciding, never decidable', async () => {
    const {ext, deps, decide, pend} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    const s = await readDappSession(ext);
    await ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: runtimeFor(ext).instance, decidingAt: deps.clock.t}))});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'not-head'});
    expect(await decide({requestId, decision: 'reject'})).toEqual({ok: false, error: 'not-head'});
    expect((await pend()).data.state).toBe('deciding');
  });

  it('malformed: a decision that is not one of the four', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'approve-all'})).toEqual({ok: false, error: 'malformed'});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'malformed'});
  });
});

describe('a worker restart after the request was shown (§1.5 step 5)', () => {
  it('the page gets the one answer through resume — never a second one, never re-run', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, DAPP);
    restartRuntime(ext);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: true});
    const back = openPage(ext, deps, DAPP);
    expect(await back.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, result: {accounts: [ACCOUNT.publicKey]}}]});
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'not-head'});
    expect((await readDappSession(ext)).grants).toHaveLength(1);
  });

  it('a lock between deciding and the effect: no grant is written, the page gets rejected (the lock hook, §2.4)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, JUP);
    // The decision arms the auto-lock between the deciding section and the grant section: a lock lands right there.
    ext.alarms.create = () => lock(ext);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect((await readDappSession(ext)).grants).toEqual([]);
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });
});

describe('the effect section’s own re-checks (review 1 M4)', () => {
  it('a block between deciding and the grant: rejected, no grant written (review 1 M4 — the effect section re-checks the block)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, JUP);
    // Between the sections (the auto-lock is armed there) another window blocks the host.
    ext.alarms.create = async () => ext.local.set(BLOCKED_KEY, [{host: 'jup.ag', blockedAt: 1, imitates: null}]);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });

  it('an account removed between deciding and the grant: rejected, no grant for it (review 1 M4)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, JUP);
    // The removal leaves the session without ACCOUNT (as vault.storeEnvelope does); a deciding entry is not `queued`,
    // so dropAccountGrants's rejection does not reach it — the effect's own re-check must.
    ext.alarms.create = async () => setSession(ext, [SECOND]);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });
});

// Task 4's own controller checks (impl prompt), each with its own test since the brief has none:
describe('controller checks (task-4-impl-prompt.md)', () => {
  it('check 1: a restart between deciding and the effect — the sweep (mismatched instance) answers it rejected, no grant (§1.5 step 2)', async () => {
    const {ext, deps, decide} = await setup();
    const {requestId} = await request(ext, deps, JUP);
    // The decision arms the auto-lock between the deciding section and the effect section: a restart lands right
    // there. `decide`'s own `instance` variable, captured before the restart, is still the old one — only the
    // effect section's fresh `runtimeFor(ext).instance` (read inside its own queueAccess) sees the mismatch. (A
    // real restart also drops every live port, so the answer is checked in storage and by a fresh page's resume,
    // not on the original page's port — same as the given "worker restart" describe block above.)
    ext.alarms.create = () => restartRuntime(ext);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect((await readDappSession(ext)).grants).toEqual([]);
    const back = openPage(ext, deps, JUP);
    expect(await back.ask({type: 'page.resume', requestIds: [requestId]})).toEqual({resume: [{requestId, error: 'rejected'}]});
  });

  it('check 2: a timeout (C4) between deciding and the effect — answered once, `timeout`, no grant (not a second `rejected`)', async () => {
    const {ext, deps, decide} = await setup();
    const {page, requestId} = await request(ext, deps, JUP);
    // Same instance throughout; only the clock moves past REQUEST_TTL_MS between the sections. The effect's own
    // queueAccess sweeps first and times the entry out before finishConnect's callback ever reads it.
    ext.alarms.create = () => void (deps.clock.t += REQUEST_TTL_MS);
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'persistent'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toBeUndefined();
    expect((await readDappSession(ext)).grants).toEqual([]);
    // Exactly one answer, and it is the sweep's `timeout` — not a second, later `rejected` from finishConnect.
    expect(page.answersFor(requestId)).toEqual([{requestId, error: 'timeout'}]);
  });

  it('check 3: a silent connect from a blocked host that held a grant (another port) returns no accounts (§2.6)', async () => {
    const {ext, deps, decide} = await setup();
    await ext.local.set(GRANTS_KEY, [grant('https://tensr.trade:8443')]);
    const holder = openPage(ext, deps, 'https://tensr.trade:8443', {tab: {id: 50}});
    // Before the block: the held grant answers a silent connect from its own port.
    expect(await holder.ask({type: 'page.connect', id: 'pre', silent: true})).toEqual({id: 'pre', result: {accounts: [ACCOUNT.publicKey]}});
    const {requestId} = await request(ext, deps, 'https://tensr.trade', 51);
    expect(await decide({requestId, decision: 'block'})).toEqual({ok: true});
    // After: the block revoked it (by host, every port and scheme) — not an isBlocked check on the silent path,
    // which has none; the grant itself is gone.
    expect(await holder.ask({type: 'page.connect', id: 'post', silent: true})).toEqual({id: 'post', result: {accounts: []}});
  });

  it('check 4 (§2.1 cap): the connect/decide path itself refuses the 201st persistent grant — the store enforces it only on read', async () => {
    const {ext, deps, decide} = await setup();
    await ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => grant(`https://s${i}.test`)));
    const {requestId} = await request(ext, deps, DAPP);
    // #47 would show cap:true and only [Reject] (dapp.pending's own test covers the view); here the decide path
    // itself is the enforcement point — an approve past the cap is refused even though the store's own write
    // would accept a 201st entry if nothing stopped it first.
    expect(await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: false, error: 'cap'});
    expect(((await ext.local.get(GRANTS_KEY)) as Grant[]).length).toBe(MAX_GRANTS);
    expect((await readDappSession(ext)).grants).toEqual([]);
  });
});

describe('#49’s messages: list, revoke + undo, revoke all, blocked, unblock (§2.7, §4.4)', () => {
  it('list: both scopes, each with its C7 name and the verified flag', async () => {
    const {ext, ui} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(JUP), grant('https://solana-mint-hub.xyz')]);
    const r = (await ui({type: 'dapp.grants.list'})) as {data: {grants: {origin: string; name: string; verified: boolean}[]}};
    expect(r.data.grants.map(g => [g.origin, g.name, g.verified])).toEqual([
      [JUP, 'Jupiter', true],
      ['https://solana-mint-hub.xyz', 'solana-mint-hub', false],
    ]);
  });

  it('revoke: the grant goes at once, change [] — Undo within five seconds restores exactly it and says change [account]', async () => {
    const {ext, deps, ui} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(JUP, {connectedAt: 5, lastUsedAt: 6})]);
    const page = openPage(ext, deps, JUP);
    const r = (await ui({type: 'dapp.grants.revoke', origin: JUP})) as {ok: boolean; data: {undoToken: string}};
    expect(r.ok).toBe(true);
    expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
    expect(await page.ask({type: 'page.connect', id: 's', silent: true})).toEqual({id: 's', result: {accounts: []}});
    expect(await ui({type: 'dapp.grants.undo', undoToken: r.data.undoToken})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([grant(JUP, {connectedAt: 5, lastUsedAt: 6})]);
    expect(page.changes()).toEqual([[], [ACCOUNT.publicKey]]);
    // Single-shot.
    expect(await ui({type: 'dapp.grants.undo', undoToken: r.data.undoToken})).toEqual({ok: false, error: 'unknown-token'});
  });

  it('undo refusals: expired, locked, blocked, granted again, account gone, cap, scope', async () => {
    const cases: [string, (c: Awaited<ReturnType<typeof setup>>) => Promise<void>, string, Grant][] = [
      ['expired', async c => void (c.deps.clock.t += UNDO_MS), 'unknown-token', grant(JUP)],
      ['locked', async c => lock(c.ext), 'unknown-token', grant(JUP)],
      ['blocked', async c => c.ext.local.set(BLOCKED_KEY, [{host: 'jup.ag', blockedAt: 1, imitates: null}]), 'blocked', grant(JUP)],
      ['granted', async c => c.ext.local.set(GRANTS_KEY, [grant(JUP, {connectedAt: 99})]), 'granted', grant(JUP)],
      ['account', async c => c.ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 1, name: 'Savings', publicKey: RECIPIENT}]}), 'unknown-account', grant(JUP)],
      ['cap', async c => c.ext.local.set(GRANTS_KEY, Array.from({length: MAX_GRANTS}, (_, i) => grant(`https://s${i}.test`))), 'cap', grant(JUP)],
      ['scope', async () => undefined, 'scope', grant(DAPP)],
    ];
    for (const [name, change, error, g] of cases) {
      const c = await setup();
      await c.ext.local.set(GRANTS_KEY, [g]);
      const r = (await c.ui({type: 'dapp.grants.revoke', origin: g.origin})) as {data: {undoToken: string}};
      await change(c);
      // A lock wipes the undo buffer with the session: the token is unknown then.
      if (name === 'locked') await setSession(c.ext, [ACCOUNT]);
      expect([name, await c.ui({type: 'dapp.grants.undo', undoToken: r.data.undoToken})]).toEqual([name, {ok: false, error}]);
    }
  });

  it('revoke all: every grant in both scopes, change [] to each, no undo', async () => {
    const {ext, deps, ui, decide} = await setup();
    await ext.local.set(GRANTS_KEY, [grant(JUP)]);
    const {requestId} = await request(ext, deps, DAPP);
    await decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'});
    const a = openPage(ext, deps, JUP, {tab: {id: 2}});
    const b = openPage(ext, deps, DAPP, {tab: {id: 3}});
    // Review 1 M3: a queued request of each granted origin (signMessage — the granted origins' only queued kind) — and
    // a queued connect of an ungranted origin, left as it is (positive control).
    const hello = 'aGVsbG8=';
    const ra = await a.ask({type: 'page.signMessage', id: 'sa', account: ACCOUNT.publicKey, message: hello});
    const rb = await b.ask({type: 'page.signMessage', id: 'sb', account: ACCOUNT.publicKey, message: hello});
    const {requestId: ungranted} = await request(ext, deps, 'https://other.test', 4);
    expect([ra?.accepted, rb?.accepted]).toEqual([true, true]);
    expect(await ui({type: 'dapp.grants.revokeAll'})).toEqual({ok: true});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
    expect((await readDappSession(ext)).grants).toEqual([]);
    expect([a.changes(), b.changes()]).toEqual([[[]], [[]]]);
    expect([a.answersFor(String(ra?.requestId)), b.answersFor(String(rb?.requestId))]).toEqual([
      [{requestId: ra?.requestId, error: 'rejected'}],
      [{requestId: rb?.requestId, error: 'rejected'}],
    ]);
    expect((await readDappSession(ext)).queue.find(e => e.requestId === ungranted)?.state).toBe('queued');
  });

  it('unblock removes the block only: the grant the block revoked does not come back — the next connect opens #47 again', async () => {
    const {ext, deps, decide, ui} = await setup();
    // A grant on another port of the host: blocks are by host, every port and scheme (§2.6).
    await ext.local.set(GRANTS_KEY, [grant('https://dapp.test:8443')]);
    const {requestId} = await request(ext, deps, DAPP);
    expect(await decide({requestId, decision: 'block'})).toEqual({ok: true});
    expect(await ui({type: 'dapp.blocked.list'})).toEqual({ok: true, data: {blocked: [{host: 'dapp.test', blockedAt: deps.clock.t, imitates: null}]}});
    expect(await ui({type: 'dapp.blocked.remove', host: 'dapp.test'})).toEqual({ok: true});
    expect(await ui({type: 'dapp.blocked.list'})).toEqual({ok: true, data: {blocked: []}});
    expect(await ext.local.get(GRANTS_KEY)).toEqual([]);
    expect(await openPage(ext, deps, 'https://dapp.test:8443', {tab: {id: 6}}).ask({type: 'page.connect', id: 'n', silent: false})).toMatchObject({accepted: true});
  });

  it('refused while locked (a controller ruling, as contacts.*)', async () => {
    const {ui} = await setup({unlocked: false});
    for (const type of ['dapp.grants.list', 'dapp.grants.revokeAll', 'dapp.blocked.list']) expect(await ui({type})).toEqual({ok: false, error: 'locked'});
    expect(await ui({type: 'dapp.grants.revoke', origin: JUP})).toEqual({ok: false, error: 'locked'});
    expect(await ui({type: 'dapp.blocked.remove', host: 'x.test'})).toEqual({ok: false, error: 'locked'});
  });
});
