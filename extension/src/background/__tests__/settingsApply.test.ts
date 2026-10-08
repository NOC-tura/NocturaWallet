import {handleMessage} from '../messages';
import {handleWallet} from '../walletApi';
import {readSettings} from '../settings';
import {AUTOLOCK_ALARM, lock} from '../autolock';
import {CHALLENGE_TTL_MS, challengeInfo, issueChallenge, takeSettingsChallenge} from '../reauthChallenges';
import {REAUTH_KEY, SESSION_KEY} from '../session';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from './fixtures';

// B1b-2b E9 (D6, C1): a weakening setting is applied by the background when #10's proof satisfies its challenge —
// vault.reauthOk carries only the id, the patch is the one bound at issue, applied exactly once.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};
const popup = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};

async function weaken(patch: {autoLockMinutes?: number; reauthUsdCents?: number}) {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = fakeDeps();
  const r = await handleWallet(ext, deps, 'settings.set', {patch});
  expect(r).toMatchObject({ok: false, error: 'reauth-required'});
  return {ext, deps, challengeId: (r.data as {challengeId: string}).challengeId};
}
const reauthOk = (ext: ReturnType<typeof fakeExt>, deps: ReturnType<typeof fakeDeps>, challengeId: string) =>
  handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps);

describe('E9: settings applied on vault.reauthOk', () => {
  it('a weakening answers reauth-required and writes nothing; vault.reauthOk applies it, re-arms the alarm, and says so', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: true, data: {applied: 'settings'}});
    expect(await handleWallet(ext, deps, 'settings.get', {})).toMatchObject({ok: true, data: {autoLockMinutes: 15}});
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(15);
  });

  it('the threshold: applied in cents, exactly as bound', async () => {
    const {ext, deps, challengeId} = await weaken({reauthUsdCents: 50_000});
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: true, data: {applied: 'settings'}});
    expect(await readSettings(ext)).toMatchObject({reauthUsdCents: 50_000, autoLockMinutes: 5});
  });

  it('applied exactly once: a replayed vault.reauthOk is unknown-challenge and writes nothing twice', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    expect(await reauthOk(ext, deps, challengeId)).toMatchObject({ok: true});
    // Strengthen in between: a replay that applied again would put 15 back.
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 1}})).toMatchObject({ok: true});
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(1);
  });

  it('an expired id is unknown-challenge; nothing is written', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    deps.clock.t += CHALLENGE_TTL_MS;
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
  });

  it('locked: refused, nothing applied (a lock clears the challenges anyway)', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    await lock(ext);
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: false, error: 'locked'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
  });

  it('a send challenge is satisfied as before and applies no settings ({ok: true} with no data)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    const about = {kind: 'send', account: ACCOUNT.publicKey, token: 'SOL', recipient: RECIPIENT, amount: '1', networkLamports: '5000', priorityLamports: '0', markupLamports: '0', markupReason: 'pre-tge', rentLamports: '0', reasons: ['first-send'], thresholdCents: 10_000} as const;
    const id = await issueChallenge(ext, deps, 'd', {...about, reasons: ['first-send']});
    expect(await reauthOk(ext, deps, id)).toEqual({ok: true});
    expect(await readSettings(ext)).toMatchObject({autoLockMinutes: 5, reauthUsdCents: 10_000});
    // takeSettingsChallenge never takes a send challenge.
    expect(await takeSettingsChallenge(ext, deps.now(), id)).toBe('unknown-challenge');
    expect(await challengeInfo(ext, deps.now(), id)).toMatchObject({kind: 'send'});
  });

  it('a stored settings record out of range is malformed: burned, nothing written (the range is re-checked)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    // isAbout checks only that the fields are integers or null: a record with 600 minutes is storable.
    const id = await issueChallenge(ext, deps, 'd', {kind: 'settings', autoLockMinutes: 600, reauthUsdCents: null});
    expect(await reauthOk(ext, deps, id)).toEqual({ok: false, error: 'malformed'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
    expect(await reauthOk(ext, deps, id)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('a settings record with no field set is malformed too', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', {kind: 'settings', autoLockMinutes: null, reauthUsdCents: null});
    expect(await reauthOk(ext, deps, id)).toEqual({ok: false, error: 'malformed'});
  });

  it('C1: settings.set carrying a challengeId is malformed, whatever the patch', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 15}, challengeId})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 1}, challengeId})).toEqual({ok: false, error: 'malformed'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
    // The challenge is untouched by the refused call: #10 can still apply it.
    expect(await reauthOk(ext, deps, challengeId)).toMatchObject({ok: true});
  });

  it('review M6: the last CONFIRMED proof wins — weaken A, strengthen B, confirm A → A', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 60});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 1}})).toMatchObject({ok: true});
    expect(await reauthOk(ext, deps, challengeId)).toMatchObject({ok: true});
    expect((await readSettings(ext)).autoLockMinutes).toBe(60);
  });

  it('review M6, the reverse order: confirm A, then strengthen B → B', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 60});
    expect(await reauthOk(ext, deps, challengeId)).toMatchObject({ok: true});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 1}})).toMatchObject({ok: true});
    expect((await readSettings(ext)).autoLockMinutes).toBe(1);
  });

  it('review M6: a second weakening issues its own challenge and revokes neither — confirm A, then B → B; each applies its own patch', async () => {
    const {ext, deps, challengeId: a} = await weaken({autoLockMinutes: 60});
    const second = await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 15}});
    expect(second).toMatchObject({ok: false, error: 'reauth-required'});
    const b = (second.data as {challengeId: string}).challengeId;
    expect(b).not.toBe(a);
    expect(await challengeInfo(ext, deps.now(), a)).toEqual({kind: 'settings', autoLockMinutes: 60, reauthUsdCents: null});
    expect(await reauthOk(ext, deps, a)).toEqual({ok: true, data: {applied: 'settings'}});
    expect((await readSettings(ext)).autoLockMinutes).toBe(60);
    expect(await reauthOk(ext, deps, b)).toEqual({ok: true, data: {applied: 'settings'}});
    expect((await readSettings(ext)).autoLockMinutes).toBe(15);
  });

  it('only the vault page may confirm: the popup is refused and nothing is applied', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, popup, deps)).toEqual({ok: false, error: 'forbidden'});
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
  });

  it('a storage failure while applying is failed, never a thrown error', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 15});
    const set = ext.local.set;
    ext.local.set = async () => {
      throw new Error('quota');
    };
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: false, error: 'failed'});
    ext.local.set = set;
    expect((await readSettings(ext)).autoLockMinutes).toBe(5);
    expect(await ext.session.get(REAUTH_KEY)).toEqual({});
  });

  it('fix round 1: a re-arm that throws AFTER the write is still applied — never "failed" for a saved change', async () => {
    const {ext, deps, challengeId} = await weaken({autoLockMinutes: 60});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    ext.alarms.create = () => {
      throw new Error('alarms down');
    };
    expect(await reauthOk(ext, deps, challengeId)).toEqual({ok: true, data: {applied: 'settings'}});
    expect((await readSettings(ext)).autoLockMinutes).toBe(60);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('takeSettingsChallenge (direct)', () => {
  it('no session but the record kept: locked, and the record is not taken', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    const id = await issueChallenge(ext, deps, 'd', {kind: 'settings', autoLockMinutes: 15, reauthUsdCents: null});
    await ext.session.remove(SESSION_KEY);
    expect(await takeSettingsChallenge(ext, deps.now(), id)).toBe('locked');
    expect(Object.keys((await ext.session.get(REAUTH_KEY)) as object)).toEqual([id]);
    // Positive control: with the session back, the same record is taken.
    await unlocked(ext);
    expect(await takeSettingsChallenge(ext, deps.now(), id)).toEqual({autoLockMinutes: 15, reauthUsdCents: null});
  });

  it('expiry is filtered in the take itself: at issuedAt + CHALLENGE_TTL_MS it is unknown-challenge; one ms earlier it is taken', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    const issuedAt = deps.now();
    const expired = await issueChallenge(ext, deps, 'd', {kind: 'settings', autoLockMinutes: 15, reauthUsdCents: null});
    const fresh = await issueChallenge(ext, deps, 'd', {kind: 'settings', autoLockMinutes: 60, reauthUsdCents: null});
    expect(await takeSettingsChallenge(ext, issuedAt + CHALLENGE_TTL_MS, expired)).toBe('unknown-challenge');
    expect(await takeSettingsChallenge(ext, issuedAt + CHALLENGE_TTL_MS - 1, fresh)).toEqual({autoLockMinutes: 60, reauthUsdCents: null});
  });
});
