import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {handleMessage} from '../../messages';
import {lock, onWindowRemoved, AUTOLOCK_ALARM} from '../../autolock';
import {SESSION_KEY, getSession, setSession} from '../../session';
import {VAULT_KEY, forgetWallet} from '../../accountsStore';
import {GRANTS_KEY, type Grant} from '../grants';
import {BLOCKED_KEY} from '../blocked';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {runtimeFor} from '../ports';
import {envelopeRevision} from '../../../shared/envelopeRevision';
import {fakeExt, memKV} from '../../__tests__/fakeExt';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {ACCOUNT} from '../../__tests__/fixtures';
import {REQUEST_TTL_MS, runUnlockHook} from '../queue';
import {onApprovalWindowRemoved} from '../window';
import {openPage} from './pageHarness';

const DAPP = 'https://dapp.test';
const JUP = 'https://jup.ag';
/** A second real keypair (32 × 0x02 seed): vault.setKeys checks every key against its address. */
const SEED2 = new Uint8Array(32).fill(2);
const PUB2 = ed25519.getPublicKey(SEED2);
const SECOND = {index: 1, publicKey: base58.encode(PUB2), secretKey: base64.encode(new Uint8Array([...SEED2, ...PUB2]))};
const RECIPIENT = SECOND.publicKey;
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: RECIPIENT},
  ],
};

/** A wallet unlocked with a queued connect from DAPP (a window open for it), a granted JUP page and an ungranted OTHER page. */
async function scene() {
  const ext = fakeExt();
  const deps = fakeDeps({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []})});
  await ext.local.set(VAULT_KEY, STORED);
  await setSession(ext, [ACCOUNT, SECOND]);
  await ext.local.set(GRANTS_KEY, [grant(JUP)]);
  const page = openPage(ext, deps, DAPP);
  const r = await page.ask({type: 'page.connect', id: 'c1', silent: false});
  const granted = openPage(ext, deps, JUP, {tab: {id: 8}});
  const ungranted = openPage(ext, deps, 'https://other.test', {tab: {id: 9}});
  return {ext, deps, page, granted, ungranted, requestId: String(r?.requestId)};
}
type Scene = Awaited<ReturnType<typeof scene>>;

/** What every lock must leave: no keys; the queued request answered rejected, stored for resume; the window closed; change [] to the granted page only. */
async function expectHooked(c: Scene): Promise<void> {
  expect(await getSession(c.ext)).toBeNull();
  expect((await readDappSession(c.ext)).queue.map(e => [e.requestId, e.state, e.answer])).toEqual([[c.requestId, 'answered', {error: 'rejected'}]]);
  expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
  expect(c.ext.approval.removed).toContain(100);
  expect(c.granted.changes()).toEqual([[]]);
  expect(c.ungranted.changes()).toEqual([]);
  expect(c.page.changes()).toEqual([]);
}

// Spec §2.4 (review H3, review 2 M6, M7, M9; D4, D5): lock() is the hook — one test per caller — and the unlock hook.
describe('the lock hook — one test per caller', () => {
  it('lock() itself: everything above; session grants wiped, persistent kept; the resume still finds the answer', async () => {
    const c = await scene();
    await c.ext.session.set(DAPP_SESSION_KEY, {...(await readDappSession(c.ext)), grants: [grant('https://s.test', {scope: 'session'})]});
    await lock(c.ext);
    await expectHooked(c);
    expect((await readDappSession(c.ext)).grants).toEqual([]);
    expect(await c.ext.local.get(GRANTS_KEY)).toEqual([grant(JUP)]);
    const back = openPage(c.ext, c.deps, DAPP);
    expect(await back.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, error: 'rejected'}]});
  });

  it('vault.lock (what the vault page’s lockOnMismatch sends)', async () => {
    const c = await scene();
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    expect(await handleMessage(c.ext, {type: 'vault.lock'}, popup, c.deps)).toEqual({ok: true});
    await expectHooked(c);
  });

  it('onWindowRemoved: the last browser window closed', async () => {
    const c = await scene();
    c.ext.windows = 0;
    await onWindowRemoved(c.ext);
    await expectHooked(c);
  });

  it('forgetWallet: a delete locks first', async () => {
    const c = await scene();
    expect(await forgetWallet(c.ext, c.deps, {expectedRevision: envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0])})).toBe('forgotten');
    await expectHooked(c);
    // …and then the wallet's grants go with it (C11).
    expect(await c.ext.local.get(GRANTS_KEY)).toBeUndefined();
  });

  it('vault.setKeys’s failure path: the auto-lock alarm refused', async () => {
    const c = await scene();
    const unlock = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/unlock.html`};
    c.ext.alarms.create = () => Promise.reject(new Error('alarm refused'));
    await expect(handleMessage(c.ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, unlock, c.deps)).rejects.toThrow('alarm refused');
    await expectHooked(c);
  });

  it('the auto-lock alarm and onStartup (the background’s own listeners)', async () => {
    for (const fire of ['alarm', 'startup'] as const) {
      const c = await scene();
      const listeners: Record<string, (x?: unknown) => void> = {};
      const on = (name: string) => ({addListener: (cb: (x?: unknown) => void) => void (listeners[name] = cb)});
      const area = (kv: ReturnType<typeof memKV>) => ({
        get: async (k: string) => (kv.data.has(k) ? {[k]: kv.data.get(k)} : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) await kv.set(k, v);
        },
        remove: (k: string) => kv.remove(k),
        clear: () => kv.clear(),
      });
      vi.stubGlobal('chrome', {
        runtime: {id: c.ext.runtimeId, getURL: (p: string) => `https://ext.example/${p}`, onMessage: on('message'), onConnect: on('connect'), onStartup: on('startup'), onInstalled: on('installed')},
        tabs: {create: async () => undefined},
        storage: {session: {...area(c.ext.session as ReturnType<typeof memKV>), setAccessLevel: async () => undefined}, local: area(c.ext.local as ReturnType<typeof memKV>)},
        alarms: {create: () => undefined, clear: async () => true, onAlarm: on('alarm')},
        windows: {getAll: async () => [], onRemoved: on('removed'), create: async () => ({id: 1}), get: async () => ({}), remove: async (id: number) => void c.ext.approval.removed.push(id)},
      });
      vi.resetModules();
      try {
        await import('../../index');
        if (fire === 'alarm') listeners.alarm?.({name: AUTOLOCK_ALARM});
        else listeners.startup?.();
        await vi.waitFor(async () => expect(await c.ext.session.get(SESSION_KEY)).toBeUndefined());
        await vi.waitFor(() => expect(c.ext.approval.removed).toContain(100));
        const s = (await c.ext.session.get(DAPP_SESSION_KEY)) as {queue: {state: string; answer: unknown}[]};
        expect([fire, s.queue.map(e => [e.state, e.answer])]).toEqual([fire, [['answered', {error: 'rejected'}]]]);
      } finally {
        vi.unstubAllGlobals();
        vi.resetModules();
      }
    }
  });

  it('a deciding entry is answered rejected by the lock (a restart: nothing left the extension); an answered one is kept as it was', async () => {
    const c = await scene();
    const s = await readDappSession(c.ext);
    const answered = {...s.queue[0]!, requestId: 'B'.repeat(22), state: 'answered' as const, answer: {result: {accounts: ['x']}}, answeredAt: 5};
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: [{...s.queue[0]!, state: 'deciding', decidedBy: runtimeFor(c.ext).instance, decidingAt: c.deps.clock.t}, answered]});
    await lock(c.ext);
    expect((await readDappSession(c.ext)).queue.map(e => [e.state, e.answer])).toEqual([
      ['answered', {error: 'rejected'}],
      ['answered', {result: {accounts: ['x']}}],
    ]);
  });

  it('closing the window fires onWindowRemoved, which may lock again: the second pass finds nothing and does not throw', async () => {
    const c = await scene();
    await lock(c.ext);
    await expect(lock(c.ext)).resolves.toBeUndefined();
    expect(c.page.answersFor(c.requestId)).toHaveLength(1);
  });

  // Fix round 1, item 3 (promoted Minor; Scope R11): the real sequence is windows.remove (afterLock) then the browser's
  // own onRemoved event for THAT window id — which must find the lock already got there first (the write-back nulled
  // `window`), so it is not ours: no rejection recorded (nothing is still `queued` to reject anyway, but the window
  // must not read as still open), nothing reopened, and a second lock still resolves cleanly.
  it('the window onApprovalWindowRemoved fires for after a lock: not ours, no rejection recorded, nothing reopened, a second lock resolves', async () => {
    const c = await scene();
    await lock(c.ext);
    expect(await onApprovalWindowRemoved(c.ext, c.deps, 100)).toBe(false);
    expect(await c.ext.local.get(GRANTS_KEY)).toEqual([grant(JUP)]);
    expect(c.ext.approval.created).toHaveLength(1);
    await expect(lock(c.ext)).resolves.toBeUndefined();
  });

  it('the approval popup counts as a window: closing the last browser window while it is open does not lock (review 2 L9)', async () => {
    const c = await scene();
    c.ext.windows = 1;
    await onWindowRemoved(c.ext);
    expect(await getSession(c.ext)).not.toBeNull();
  });
});

describe('the unlock hook (§2.4, D5)', () => {
  async function lockedWithQueuedGrantedConnect() {
    const ext = fakeExt();
    const deps = fakeDeps();
    await ext.local.set(VAULT_KEY, STORED);
    await ext.local.set(GRANTS_KEY, [grant(JUP)]);
    const page = openPage(ext, deps, JUP);
    const r = await page.ask({type: 'page.connect', id: 'c1', silent: false});
    const unknown = openPage(ext, deps, DAPP, {tab: {id: 9}});
    const u = await unknown.ask({type: 'page.connect', id: 'c2', silent: false});
    const unlock = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/unlock.html`};
    return {ext, deps, page, unknown, requestId: String(r?.requestId), other: String(u?.requestId), setKeys: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, unlock, deps)};
  }

  it('locked + persistent grant: queued; vault.setKeys answers it {accounts: [granted]} and sends change [granted]; an ungranted one stays for the window', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    expect((await readDappSession(c.ext)).queue.map(e => e.state)).toEqual(['queued', 'queued']);
    expect(await c.setKeys()).toEqual({ok: true});
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
    expect(c.page.changes()).toEqual([[ACCOUNT.publicKey]]);
    expect(c.unknown.changes()).toEqual([]);
    expect((await readDappSession(c.ext)).queue.find(e => e.requestId === c.other)?.state).toBe('queued');
  });

  it('unlock → lock → unlock: the hook runs again for the second session (a lock clears it)', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    await c.setKeys();
    await lock(c.ext);
    const again = await c.page.ask({type: 'page.connect', id: 'again', silent: false});
    expect(again).toMatchObject({accepted: true});
    await c.setKeys();
    expect(c.page.answersFor(String(again?.requestId))).toEqual([{requestId: again?.requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
  });

  it('the grant re-checked at that moment: an account no longer in the session is not restored', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    await c.ext.local.set(GRANTS_KEY, [grant(JUP, {account: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'})]);
    await c.setKeys();
    expect(c.page.answersFor(c.requestId)).toEqual([]);
  });

  it('the block re-checked at that moment: a restored grant of a blocked host is not restored (review 1 M4)', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    // A block and a grant both kept by a restore (delete wipes both, restore keeps both): the host was blocked while locked.
    await c.ext.local.set(BLOCKED_KEY, [{host: 'jup.ag', blockedAt: 1, imitates: null}]);
    await c.setKeys();
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await readDappSession(c.ext)).queue.find(e => e.requestId === c.requestId)?.state).toBe('queued');
    // Fix round 1, item 1: the `change` loop must skip a blocked host's grant too — the page must learn neither the
    // account nor the unlock timing (D3).
    expect(c.page.changes()).toEqual([]);
  });

  // Review 1 L6: the flag is now written inside the hook's section. The interleaving the review describes (a lock's whole
  // section between the commit and a flag write after it) cannot be produced here — the lock's section awaits storage
  // first — so no test tells the two placements apart; this one pins the outcome both must keep.
  it('a lock queued while the unlock hook commits: the wallet ends locked and the hook flag cleared', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    const set = c.ext.session.set.bind(c.ext.session);
    let locking: Promise<void> | null = null;
    c.ext.session.set = async (k, v) => {
      await set(k, v);
      // The hook's commit writes the dApp session; a lock asks for the mutex right then and runs as soon as it is free.
      if (k === DAPP_SESSION_KEY && locking === null && (await getSession(c.ext)) !== null) locking = lock(c.ext);
    };
    expect(await c.setKeys()).toEqual({ok: true});
    expect(locking).not.toBeNull();
    await locking;
    expect(await getSession(c.ext)).toBeNull();
    expect(runtimeFor(c.ext).hooked).toBe(false);
  });

  it('if the hook throws, the session stays unlocked and the next queue access runs it again', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    const get = c.ext.local.get.bind(c.ext.local);
    let fail = true;
    c.ext.local.get = async k => {
      if (k === GRANTS_KEY && fail) {
        fail = false;
        throw new Error('storage hiccup');
      }
      return get(k);
    };
    expect(await c.setKeys()).toEqual({ok: true});
    expect(await getSession(c.ext)).not.toBeNull();
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    await c.unknown.ask({type: 'page.connect', id: 's', silent: true});
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {accounts: [ACCOUNT.publicKey]}}]);
  });

  // Fix round 1, item 4 (promoted Minor; C4): the TTL sweep must run before the unlock hook gets a look at the
  // queue — a connect already past REQUEST_TTL_MS while still locked must time out, never be granted late.
  it('a queued connect already past its TTL times out instead of being granted by the unlock hook (C4)', async () => {
    const c = await lockedWithQueuedGrantedConnect();
    c.deps.clock.t += REQUEST_TTL_MS;
    expect(await c.setKeys()).toEqual({ok: true});
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'timeout'}]);
  });
});

describe('an account removed (§2.1, review 2 M9)', () => {
  it('vault.storeEnvelope without account 1: its grants deleted, change [] to their pages, their queued requests rejected', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    await ext.local.set(VAULT_KEY, STORED);
    await setSession(ext, [ACCOUNT, SECOND]);
    await ext.local.set(GRANTS_KEY, [grant(JUP, {account: RECIPIENT}), grant('https://keep.test')]);
    // The session was written directly: run its unlock hook before any page is open.
    await runUnlockHook(ext, deps);
    const gone = openPage(ext, deps, JUP);
    const kept = openPage(ext, deps, 'https://keep.test', {tab: {id: 8}});
    // Review 1 M3: a queued sign request of each origin — the removed account's is rejected, the kept one waits.
    const hello = 'aGVsbG8=';
    const rg = await gone.ask({type: 'page.signMessage', id: 'g', account: RECIPIENT, message: hello});
    const rk = await kept.ask({type: 'page.signMessage', id: 'k', account: ACCOUNT.publicKey, message: hello});
    expect([rg?.accepted, rk?.accepted]).toEqual([true, true]);
    const unlock = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/unlock.html`};
    const next = {...STORED, seed: {iv: B(12, 9), ct: B(48, 9)}, accounts: [STORED.accounts[0]]};
    expect(await handleMessage(ext, {type: 'vault.storeEnvelope', expectedRevision: envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]), envelope: next}, unlock, deps)).toEqual({ok: true});
    expect(((await ext.local.get(GRANTS_KEY)) as Grant[]).map(g => g.origin)).toEqual(['https://keep.test']);
    expect([gone.changes(), kept.changes()]).toEqual([[[]], []]);
    expect(gone.answersFor(String(rg?.requestId))).toEqual([{requestId: rg?.requestId, error: 'rejected'}]);
    expect((await readDappSession(ext)).queue.find(e => e.requestId === rk?.requestId)?.state).toBe('queued');
  });
});
