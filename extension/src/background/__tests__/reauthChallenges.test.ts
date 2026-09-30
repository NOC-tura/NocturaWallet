import {SETTINGS_ABOUT} from './fixtures';
import {lock} from '../autolock';
import {REAUTH_KEY} from '../session';
import {CHALLENGE_TTL_MS, challengeSatisfied, consumeChallenge, issueChallenge, satisfyChallenge} from '../reauthChallenges';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';

describe('re-auth challenges', () => {
  it('issue → satisfy → consume once, with the same digest (positive control)', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd1', SETTINGS_ABOUT);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(await challengeSatisfied(ext, deps.now(), id, 'd1')).toBe(false);
    expect(await satisfyChallenge(ext, deps.now(), id)).toBe(true);
    expect(await challengeSatisfied(ext, deps.now(), id, 'd1')).toBe(true);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(true);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
  });

  it('an unsatisfied challenge cannot be consumed, and stays usable', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd1', SETTINGS_ABOUT);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
    await satisfyChallenge(ext, deps.now(), id);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(true);
  });

  it('a different digest never consumes it — and burns it', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd1', SETTINGS_ABOUT);
    await satisfyChallenge(ext, deps.now(), id);
    expect(await consumeChallenge(ext, deps.now(), id, 'd2')).toBe(false);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
  });

  it('expires after two minutes, satisfied or not', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const a = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    const b = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    expect(await satisfyChallenge(ext, deps.now() + CHALLENGE_TTL_MS - 1, b)).toBe(true);
    expect(await satisfyChallenge(ext, deps.now() + CHALLENGE_TTL_MS, a)).toBe(false);
    expect(await consumeChallenge(ext, deps.now() + CHALLENGE_TTL_MS, b, 'd')).toBe(false);
    expect(CHALLENGE_TTL_MS).toBe(120_000);
  });

  it('an unknown id is not satisfied', async () => {
    expect(await satisfyChallenge(fakeExt(), 0, 'f'.repeat(32))).toBe(false);
  });

  it('ids that name inherited properties, or are malformed, are refused by every function', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const real = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    await satisfyChallenge(ext, deps.now(), real);
    const hostile = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'xyz', '', 'F'.repeat(32), 'f'.repeat(31), 'f'.repeat(33), `${real} `];
    for (const id of hostile) {
      expect(await satisfyChallenge(ext, deps.now(), id)).toBe(false);
      expect(await challengeSatisfied(ext, deps.now(), id, 'd')).toBe(false);
      expect(await consumeChallenge(ext, deps.now(), id, 'd')).toBe(false);
    }
    // A stored entry under a hostile key (storage is a claim) is ignored as well.
    const raw = (await ext.session.get(REAUTH_KEY)) as Record<string, unknown>;
    await ext.session.set(REAUTH_KEY, {...raw, constructor: {digest: 'd', expiresAt: deps.now() + CHALLENGE_TTL_MS, satisfied: true}});
    expect(await challengeSatisfied(ext, deps.now(), 'constructor', 'd')).toBe(false);
    expect(await consumeChallenge(ext, deps.now(), 'constructor', 'd')).toBe(false);
    // The real one was not disturbed.
    expect(await consumeChallenge(ext, deps.now(), real, 'd')).toBe(true);
  });

  it('a malformed id is refused before the store is read', async () => {
    const ext = fakeExt();
    const realGet = ext.session.get;
    let reads = 0;
    ext.session.get = async k => {
      reads += 1;
      return realGet(k);
    };
    for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'xyz']) {
      expect(await satisfyChallenge(ext, 0, id)).toBe(false);
      expect(await challengeSatisfied(ext, 0, id, 'd')).toBe(false);
      expect(await consumeChallenge(ext, 0, id, 'd')).toBe(false);
    }
    expect(reads).toBe(0);
  });

  it('issueChallenge refuses to bind an empty digest', async () => {
    await expect(issueChallenge(fakeExt(), fakeDeps(), '', SETTINGS_ABOUT)).rejects.toThrow();
  });

  it('consume succeeds at TTL − 1 and fails at TTL', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const a = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    const b = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    await satisfyChallenge(ext, deps.now(), a);
    await satisfyChallenge(ext, deps.now(), b);
    expect(await challengeSatisfied(ext, deps.now() + CHALLENGE_TTL_MS - 1, a, 'd')).toBe(true);
    expect(await consumeChallenge(ext, deps.now() + CHALLENGE_TTL_MS - 1, a, 'd')).toBe(true);
    expect(await challengeSatisfied(ext, deps.now() + CHALLENGE_TTL_MS, b, 'd')).toBe(false);
    expect(await consumeChallenge(ext, deps.now() + CHALLENGE_TTL_MS, b, 'd')).toBe(false);
  });

  it('issueChallenge prunes expired entries', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const old = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    deps.clock.t += CHALLENGE_TTL_MS;
    const fresh = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    expect(Object.keys((await ext.session.get(REAUTH_KEY)) as object)).toEqual([fresh]);
    expect(old).not.toBe(fresh);
  });

  it('a lock landing between a write\'s read and its write leaves no store behind', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const realGet = ext.session.get;
    let entered!: () => void;
    const readStarted = new Promise<void>(r => (entered = r));
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    ext.session.get = async k => {
      if (k === REAUTH_KEY) {
        entered();
        await gate;
      }
      return realGet(k);
    };
    const issuing = issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    await readStarted;
    const locking = lock(ext);
    // Give the lock every chance to run ahead of the pending write.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    release();
    const id = await issuing;
    await locking;
    ext.session.get = realGet;
    expect(await ext.session.get(REAUTH_KEY)).toBeUndefined();
    expect(await satisfyChallenge(ext, deps.now(), id)).toBe(false);
  });
});
