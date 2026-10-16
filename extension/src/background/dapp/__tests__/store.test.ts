import {GRANTS_KEY, MAX_GRANTS, grantsOf, withRecent, type Grant} from '../grants';
import {BLOCKED_KEY, MAX_BLOCKED, blockedOf, isBlocked, withBlock, withoutBlock} from '../blocked';
import {COOLDOWN_MS, EMPTY_LIMITS, LIMITS_KEY, LIMIT_WINDOW_MS, WINDOW_BUDGET, budgetLeft, inCooldown, limitsOf, rejectionsOf, withRejection, withWindow} from '../limits';
import {DAPP_SESSION_KEY, EMPTY_SESSION, dappSection, dropGrant, grantIn, putGrant, readDappSession, wipeDappStores, type Entry} from '../store';
import {clearSession, setSession} from '../../session';
import {fakeExt} from '../../__tests__/fakeExt';
import {ACCOUNT} from '../../__tests__/fixtures';

const T = 1_000_000_000;
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: T, lastUsedAt: T, recent: [], ...over});
const entry = (over: Partial<Entry> = {}): Entry => ({
  requestId: 'r1', pageId: 'p1', origin: 'https://dapp.test', host: 'dapp.test', tabId: 7, documentId: null, type: 'connect', account: null,
  message: null, transactions: null, granted: null, sim: null, challengeId: null, sent: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null, decision: null, answer: null, answeredAt: null, ...over,
});

// Spec §2.1, §2.6, C14 — the stores the request lifecycle writes, and the one section that writes them.
describe('grants (§2.1)', () => {
  it('a stored list is re-validated: a bad field, an http origin and a second grant for one origin are dropped; at most the cap', () => {
    const ok = grant('https://jup.ag');
    const stored = [ok, {...ok}, grant('http://jup.ag'), {...grant('https://a.test'), scope: 'session'}, {...grant('https://b.test'), recent: [{type: 'x', at: 1, outcome: 'approved'}]}, null, 'x'];
    expect(grantsOf(stored, 'persistent', MAX_GRANTS)).toEqual([ok]);
    expect(grantsOf(Array.from({length: MAX_GRANTS + 5}, (_, i) => grant(`https://s${i}.test`)), 'persistent', MAX_GRANTS)).toHaveLength(MAX_GRANTS);
    expect(grantsOf({not: 'a list'}, 'persistent', MAX_GRANTS)).toEqual([]);
    expect(MAX_GRANTS).toBe(200);
  });

  // Review Focus 1: an IP-literal origin with a port is an origin like any other — kept by the re-validation.
  it('an IP literal and a port: https://[2001:db8::1]:8443 is kept, as its host is in the block list and the limits', () => {
    const ip = grant('https://[2001:db8::1]:8443');
    expect(grantsOf([ip], 'persistent', MAX_GRANTS)).toEqual([ip]);
    expect(blockedOf([{host: '[2001:db8::1]', blockedAt: 1, imitates: null}])).toEqual([{host: '[2001:db8::1]', blockedAt: 1, imitates: null}]);
    expect(inCooldown(withRejection(withRejection(withRejection(EMPTY_LIMITS, '[2001:db8::1]', 1, T), '[2001:db8::1]', 2, T), '[2001:db8::1]', 3, T), '[2001:db8::1]', 9, T + 1)).toBe(true);
    expect(limitsOf(withRejection(EMPTY_LIMITS, '[2001:db8::1]', 1, T), T).rejections).toHaveLength(2);
  });

  it('withRecent keeps the last three, newest first; only an approval moves lastUsedAt', () => {
    let g = grant('https://jup.ag');
    for (let i = 1; i <= 4; i++) g = withRecent(g, 'signMessage', T + i, i === 4 ? 'rejected' : 'approved');
    expect(g.recent.map(r => r.at)).toEqual([T + 4, T + 3, T + 2]);
    expect(g.lastUsedAt).toBe(T + 3);
  });
});

describe('blocked hosts (§2.6)', () => {
  it('newest first, one per host, at most 200 — the oldest falls out; unblock removes only the block', () => {
    let list = blockedOf(undefined);
    for (let i = 0; i < MAX_BLOCKED + 1; i++) list = withBlock(list, `h${i}.test`, null, T + i);
    expect(list).toHaveLength(MAX_BLOCKED);
    expect(isBlocked(list, 'h0.test')).toBe(false);
    expect(list[0]).toEqual({host: `h${MAX_BLOCKED}.test`, blockedAt: T + MAX_BLOCKED, imitates: null});
    list = withBlock(list, 'h5.test', 'tensor.trade', T + 999);
    expect(list.filter(b => b.host === 'h5.test')).toEqual([{host: 'h5.test', blockedAt: T + 999, imitates: 'tensor.trade'}]);
    expect(isBlocked(withoutBlock(list, 'h5.test'), 'h5.test')).toBe(false);
    expect(blockedOf([{host: 'a b', blockedAt: 1, imitates: null}, {host: 'ok.test', blockedAt: -1, imitates: null}])).toEqual([]);
  });
});

describe('limits (C14)', () => {
  it('the third rejection from one host within ten minutes starts a ten-minute cooldown for it — two do not', () => {
    let l = withRejection(withRejection(EMPTY_LIMITS, 'spam.test', 1, T), 'spam.test', 2, T + 1);
    expect(inCooldown(l, 'spam.test', 9, T + 2)).toBe(false);
    expect(rejectionsOf(l, 'spam.test', 9)).toBe(2);
    l = withRejection(l, 'spam.test', 3, T + 2);
    expect(inCooldown(l, 'spam.test', 9, T + 3)).toBe(true);
    expect(inCooldown(l, 'spam.test', 9, T + 2 + COOLDOWN_MS)).toBe(false);
    // Rejections older than the window do not count.
    const old = withRejection(withRejection(EMPTY_LIMITS, 'slow.test', 1, T), 'slow.test', 2, T + 1);
    expect(inCooldown(withRejection(old, 'slow.test', 3, T + LIMIT_WINDOW_MS + 5), 'slow.test', 9, T + LIMIT_WINDOW_MS + 6)).toBe(false);
  });

  it('one tab hopping across three origins is cooled down per tab (review 2 H2)', () => {
    let l = EMPTY_LIMITS;
    for (const [i, host] of ['a.test', 'b.test', 'c.test'].entries()) l = withRejection(l, host, 42, T + i);
    expect(inCooldown(l, 'd.test', 42, T + 5)).toBe(true);
    expect(inCooldown(l, 'd.test', 43, T + 5)).toBe(false);
  });

  it('the window budget: ten approval windows per ten minutes across all sites', () => {
    let l = EMPTY_LIMITS;
    for (let i = 0; i < WINDOW_BUDGET; i++) {
      expect(budgetLeft(l, T + i)).toBe(true);
      l = withWindow(l, T + i);
    }
    expect(budgetLeft(l, T + 20)).toBe(false);
    expect(budgetLeft(l, T + LIMIT_WINDOW_MS + 1)).toBe(true);
  });

  it('a stored value is re-validated and pruned; anything else is no limit', () => {
    expect(limitsOf('x', T)).toEqual(EMPTY_LIMITS);
    expect(limitsOf({rejections: [{key: 'host:a.test', at: T}, {key: 'evil', at: T}, {key: 'tab:1', at: T - LIMIT_WINDOW_MS - 1}], cooldowns: [], windows: [T, 'x'], notice: true}, T)).toEqual({
      rejections: [{key: 'host:a.test', at: T}],
      cooldowns: [],
      windows: [T],
      notice: true,
    });
  });
});

describe('dappSection — the queue mutex (store.ts)', () => {
  it('reads every store and the session, and writes back only what the section changed', async () => {
    const ext = fakeExt();
    await setSession(ext, [ACCOUNT]);
    await ext.local.set(GRANTS_KEY, [grant('https://jup.ag')]);
    const writes: string[] = [];
    const set = ext.local.set.bind(ext.local);
    ext.local.set = async (k, v) => {
      writes.push(k);
      await set(k, v);
    };
    const seen = await dappSection(ext, T, tx => {
      tx.blocked = withBlock(tx.blocked, 'tensr.trade', 'tensor.trade', T);
      tx.s.queue.push(entry());
      return {unlocked: tx.session !== null, grants: tx.grants.length};
    });
    expect(seen).toEqual({unlocked: true, grants: 1});
    expect(writes).toEqual([BLOCKED_KEY]);
    expect((await readDappSession(ext)).queue).toEqual([entry()]);
    expect(await ext.local.get(LIMITS_KEY)).toBeUndefined();
  });

  it('a session grant and a persistent grant: one per origin — putGrant replaces across scopes, dropGrant removes both', async () => {
    const ext = fakeExt();
    await dappSection(ext, T, tx => {
      putGrant(tx, grant('https://jup.ag'));
      putGrant(tx, grant('https://jup.ag', {scope: 'session'}));
      expect(tx.grants).toEqual([]);
      expect(grantIn(tx, 'https://jup.ag')?.scope).toBe('session');
      expect(grantIn(tx, 'https://www.jup.ag')).toBeNull();
      putGrant(tx, grant('https://www.jup.ag'));
      expect(dropGrant(tx, 'https://jup.ag')?.scope).toBe('session');
      expect(grantIn(tx, 'https://jup.ag')).toBeNull();
    });
    expect(await ext.local.get(GRANTS_KEY)).toEqual([grant('https://www.jup.ag')]);
  });

  it('the stored session state is re-validated: a malformed entry is dropped, never repaired', async () => {
    const ext = fakeExt();
    await ext.session.set(DAPP_SESSION_KEY, {queue: [entry(), {...entry(), state: 'weird'}, {...entry(), answer: {error: 'internal text'}}], window: {id: 'x'}});
    expect(await readDappSession(ext)).toEqual({...EMPTY_SESSION, queue: [entry()]});
  });
});

// Review fix round 1.
describe('fix round 1', () => {
  // CRITICAL 1: readDappSession's "nothing stored" branch used to return `{...EMPTY_SESSION}`, a shallow copy
  // whose queue/grants/undo were still EMPTY_SESSION's own arrays — a section's `tx.s.queue.push(...)` mutated
  // the module's shared constant, and a lock (clearSession) clearing storage.session did not undo that: the next
  // "nothing stored" read handed back the same, now-polluted array, unvalidated.
  it('a lock clearing storage.session leaves the next read truly empty, not a polluted shared array', async () => {
    const ext = fakeExt();
    await dappSection(ext, T, tx => {
      tx.s.queue.push(entry());
    });
    expect((await readDappSession(ext)).queue).toEqual([entry()]); // the write-back did its job
    await clearSession(ext); // the lock hook's clear, over the same storage.session
    // A fresh literal, not EMPTY_SESSION: under the bug, the "nothing stored" branch hands back a shallow copy
    // sharing EMPTY_SESSION's own arrays, so EMPTY_SESSION itself is polluted too — comparing against the module
    // constant would (wrongly) pass by comparing the polluted value to itself.
    expect(await readDappSession(ext)).toEqual({queue: [], grants: [], window: null, opening: null, undo: []});
  });

  // Same bug, limits.ts: limitsOf's "nothing stored" branch returned EMPTY_LIMITS itself (not even a shallow copy).
  it('two reads of an empty limits store are never the same mutable object', () => {
    const l1 = limitsOf(undefined, T);
    l1.rejections.push({key: 'host:evil.test', at: T});
    // A fresh literal, not EMPTY_LIMITS: under the bug, l1 IS EMPTY_LIMITS, so comparing the next read against the
    // module constant would (wrongly) pass — both sides are the same, now-polluted object.
    expect(limitsOf(undefined, T)).toEqual({rejections: [], cooldowns: [], windows: [], notice: false});
  });

  // IMPORTANT 1: removeWalletData used to remove the three dApp keys with a plain ext.local.remove, outside
  // dappMutex/sessionMutex — a dappSection already in flight reads the old lists before that remove and writes
  // them back after it, undoing the delete (or the first write's cleanup). wipeDappStores takes the same lock
  // order a dappSection does, so the two can never interleave.
  it('wipeDappStores waits for an open dappSection — it cannot settle until the section releases the mutex', async () => {
    const ext = fakeExt();
    await ext.local.set(GRANTS_KEY, [grant('https://jup.ag')]);
    let started: () => void = () => {};
    const startedP = new Promise<void>(r => {
      started = r;
    });
    let release: () => void = () => {};
    const gate = new Promise<void>(r => {
      release = r;
    });
    const sectionDone = dappSection(ext, T, async tx => {
      putGrant(tx, grant('https://new.test'));
      started();
      await gate;
    });
    await startedP; // the section now holds dappMutex and sessionMutex, paused inside its callback
    let wipeSettled = false;
    const wipeDone = wipeDappStores(ext).then(() => {
      wipeSettled = true;
    });
    // A macrotask flush: every microtask a plain (unprotected) remove could ride on has had its turn.
    await new Promise(r => setTimeout(r, 0));
    expect(wipeSettled).toBe(false);
    release();
    await Promise.all([sectionDone, wipeDone]);
    for (const key of [GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY]) expect(await ext.local.get(key)).toBeUndefined();
  });
});
