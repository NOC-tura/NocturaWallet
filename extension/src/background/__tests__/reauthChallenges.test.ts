import {CHALLENGE_TTL_MS, challengeSatisfied, consumeChallenge, issueChallenge, satisfyChallenge} from '../reauthChallenges';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';

describe('re-auth challenges', () => {
  it('issue → satisfy → consume once, with the same digest (positive control)', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd1');
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
    const id = await issueChallenge(ext, deps, 'd1');
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
    await satisfyChallenge(ext, deps.now(), id);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(true);
  });

  it('a different digest never consumes it — and burns it', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd1');
    await satisfyChallenge(ext, deps.now(), id);
    expect(await consumeChallenge(ext, deps.now(), id, 'd2')).toBe(false);
    expect(await consumeChallenge(ext, deps.now(), id, 'd1')).toBe(false);
  });

  it('expires after two minutes, satisfied or not', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const a = await issueChallenge(ext, deps, 'd');
    const b = await issueChallenge(ext, deps, 'd');
    expect(await satisfyChallenge(ext, deps.now() + CHALLENGE_TTL_MS - 1, b)).toBe(true);
    expect(await satisfyChallenge(ext, deps.now() + CHALLENGE_TTL_MS, a)).toBe(false);
    expect(await consumeChallenge(ext, deps.now() + CHALLENGE_TTL_MS, b, 'd')).toBe(false);
    expect(CHALLENGE_TTL_MS).toBe(120_000);
  });

  it('an unknown id is not satisfied', async () => {
    expect(await satisfyChallenge(fakeExt(), 0, 'f'.repeat(32))).toBe(false);
  });
});
