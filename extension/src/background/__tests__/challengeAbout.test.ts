import {CHALLENGE_MAX_LIFE_MS, CHALLENGE_TTL_MS, challengeInfo, issueChallenge, rebaseChallenge, satisfyChallenge, type ChallengeAbout, type SendAboutRefresh} from '../reauthChallenges';
import {handleMessage} from '../messages';
import {prepareSend, sendIntentDigest} from '../prepare';
import {REAUTH_KEY} from '../session';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, SETTINGS_ABOUT, sendReader, unlocked} from './fixtures';

// Spec B1b-2a E3: the action behind a challenge, read by the vault page from the background; the
// challenge life re-based by a same-intent re-prepare (D39) and capped at ten minutes (C5).
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const from = (path: string) => ({id: ID, origin: ORIGIN, url: `${ORIGIN}${path}`});
const SEND_ABOUT: ChallengeAbout = {
  kind: 'send',
  account: ACCOUNT.publicKey,
  token: 'SOL',
  recipient: RECIPIENT,
  amount: '1000000',
  networkLamports: '5050',
  markupLamports: '0',
  markupReason: 'status-unknown',
  rentLamports: '0',
  reasons: ['first-send'],
  thresholdCents: 10_000,
};
const REFRESH: SendAboutRefresh = {networkLamports: '9050', markupLamports: '0', markupReason: 'status-unknown', rentLamports: '0', reasons: ['first-send', 'over-usd-threshold'], thresholdCents: 10_000};
const SOL_INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};

describe('the challenge describes its action (E3)', () => {
  it('prepareSend stores what #10 shows, from the values it bound the digest to', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const view = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    expect(await challengeInfo(ext, deps.now(), view.reauth!.challengeId)).toEqual({
      kind: 'send',
      account: ACCOUNT.publicKey,
      token: 'SOL',
      recipient: RECIPIENT,
      amount: '1000000',
      networkLamports: '5050',
      markupLamports: '0',
      markupReason: 'status-unknown',
      rentLamports: '0',
      reasons: ['first-send'],
      thresholdCents: 10_000,
    });
  });

  it('a reuse refreshes the fee fields and keeps the digest and the identity fields', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const first = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
    const id = first.reauth!.challengeId;
    const before = ((await ext.session.get(REAUTH_KEY)) as Record<string, {digest: string}>)[id]!.digest;
    const busier = fakeDeps({reader: sendReader({getRecentPrioritizationFees: async () => [{prioritizationFee: 4_000_000}]})});
    busier.clock.t = deps.clock.t + 10_000;
    const again = await prepareSend(ext, busier, ACCOUNT.publicKey, SOL_INTENT, {challengeId: id});
    expect(again.reauth?.challengeId).toBe(id);
    const stored = ((await ext.session.get(REAUTH_KEY)) as Record<string, {digest: string; about: ChallengeAbout}>)[id]!;
    expect(stored.digest).toBe(before);
    expect(stored.digest).toBe(sendIntentDigest(ACCOUNT.publicKey, SOL_INTENT));
    expect(stored.about).toMatchObject({account: ACCOUNT.publicKey, recipient: RECIPIENT, amount: '1000000', token: 'SOL'});
    expect(stored.about).not.toMatchObject({networkLamports: '5050'});
  });

  it('a stored record whose about has another shape is dropped', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    const stored = (await ext.session.get(REAUTH_KEY)) as Record<string, Record<string, unknown>>;
    for (const about of [{...SEND_ABOUT, token: 'BONK'}, {...SEND_ABOUT, amount: '1.5'}, {...SEND_ABOUT, reasons: ['nope']}, {...SEND_ABOUT, extra: 1}, {kind: 'settings'}, null]) {
      await ext.session.set(REAUTH_KEY, {[id]: {...stored[id], about}});
      expect(await challengeInfo(ext, deps.now(), id)).toBeNull();
    }
  });

  it('issueChallenge refuses a malformed about', async () => {
    await expect(issueChallenge(fakeExt(), fakeDeps(), 'd', {kind: 'settings'} as unknown as ChallengeAbout)).rejects.toThrow();
  });
});

describe('rebaseChallenge (D39, C5)', () => {
  it('a same-intent reuse renews the 120 s life and keeps satisfied', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    expect(await satisfyChallenge(ext, deps.now(), id)).toBe(true);
    deps.clock.t += 100_000;
    expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(true);
    deps.clock.t += 100_000; // 200 s after issue: alive only because it was re-based
    const c = ((await ext.session.get(REAUTH_KEY)) as Record<string, {expiresAt: number; satisfied: boolean; about: ChallengeAbout}>)[id]!;
    expect(c.satisfied).toBe(true);
    expect(c.expiresAt).toBe(deps.clock.t - 100_000 + CHALLENGE_TTL_MS);
    expect(c.about).toMatchObject({networkLamports: '9050', reasons: ['first-send', 'over-usd-threshold'], amount: '1000000'});
    expect(await challengeInfo(ext, deps.now(), id)).not.toBeNull();
  });

  it('never re-bases another digest, and never revives an expired challenge', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    expect(await rebaseChallenge(ext, deps.now(), id, 'other', REFRESH)).toBe(false);
    deps.clock.t += CHALLENGE_TTL_MS;
    expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(false);
    expect(await challengeInfo(ext, deps.now(), id)).toBeNull();
  });

  it('the Nth re-base stops at issuedAt + 10 min, and the one after finds the challenge expired', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const issuedAt = deps.clock.t;
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    // A re-prepare every 100 s keeps it alive…
    while (deps.clock.t + 100_000 < issuedAt + CHALLENGE_MAX_LIFE_MS) {
      deps.clock.t += 100_000;
      expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(true);
    }
    const c = ((await ext.session.get(REAUTH_KEY)) as Record<string, {expiresAt: number}>)[id]!;
    expect(c.expiresAt).toBe(issuedAt + CHALLENGE_MAX_LIFE_MS);
    // …but never past the cap.
    deps.clock.t = issuedAt + CHALLENGE_MAX_LIFE_MS;
    expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(false);
    expect(await challengeInfo(ext, deps.now(), id)).toBeNull();
  });

  it('a settings challenge is never re-based as a send', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', SETTINGS_ABOUT);
    expect(await rebaseChallenge(ext, deps.now(), id, 'd', REFRESH)).toBe(false);
  });
});

describe('vault.challengeInfo (E3)', () => {
  async function setup() {
    const ext = fakeExt();
    const deps = fakeDeps();
    await unlocked(ext);
    const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
    return {ext, deps, id};
  }

  it('answers the vault page with the stored description', async () => {
    const {ext, deps, id} = await setup();
    expect(await handleMessage(ext, {type: 'vault.challengeInfo', challengeId: id}, from('/unlock.html'), deps)).toEqual({ok: true, data: SEND_ABOUT});
  });

  it('refuses the popup, the tab and a web page', async () => {
    const {ext, deps, id} = await setup();
    for (const sender of [from('/popup.html'), from('/wallet.html'), {id: ID, origin: 'https://evil.example', url: 'https://evil.example/unlock.html'}]) {
      expect(await handleMessage(ext, {type: 'vault.challengeInfo', challengeId: id}, sender, deps)).toEqual({ok: false, error: 'forbidden'});
    }
  });

  it('malformed id, locked, expired', async () => {
    const {ext, deps, id} = await setup();
    const ask = (challengeId: unknown) => handleMessage(ext, {type: 'vault.challengeInfo', challengeId}, from('/unlock.html'), deps);
    expect(await ask('<b>')).toEqual({ok: false, error: 'malformed'});
    expect(await ask('f'.repeat(32))).toEqual({ok: false, error: 'unknown-challenge'});
    deps.clock.t += CHALLENGE_TTL_MS;
    expect(await ask(id)).toEqual({ok: false, error: 'unknown-challenge'});
    await handleMessage(ext, {type: 'vault.lock'}, from('/popup.html'), deps);
    expect(await ask(id)).toEqual({ok: false, error: 'locked'});
  });
});
