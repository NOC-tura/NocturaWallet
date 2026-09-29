import {armAutolock, lock, onWindowRemoved, AUTOLOCK_ALARM, DEFAULT_AUTOLOCK_MINUTES} from '../autolock';
import {setSession, getSession} from '../session';
import {fakeExt} from './fakeExt';

const ACC = [{index: 0, publicKey: 'x', secretKey: 'AAAA'}];

describe('auto-lock', () => {
  it('a failed alarms.create surfaces as an error, not a silently unarmed lock', async () => {
    const ext = fakeExt();
    ext.alarms.create = () => Promise.reject(new Error('alarm refused'));
    await expect(armAutolock(ext)).rejects.toThrow('alarm refused');
  });
  it('arms the alarm for the default five minutes', async () => {
    const ext = fakeExt();
    await armAutolock(ext);
    expect(DEFAULT_AUTOLOCK_MINUTES).toBe(5);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(5);
  });
  it('honours a stored setting inside 1–60, and falls back to the default outside it', async () => {
    const ext = fakeExt();
    await ext.local.set('v1_settings', {autoLockMinutes: 15});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(15);
    await ext.local.set('v1_settings', {autoLockMinutes: 600});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(DEFAULT_AUTOLOCK_MINUTES);
    await ext.local.set('v1_settings', {autoLockMinutes: 0});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(DEFAULT_AUTOLOCK_MINUTES);
  });
  it('lock clears the session and the alarm', async () => {
    const ext = fakeExt();
    await setSession(ext, ACC);
    await armAutolock(ext);
    await lock(ext);
    expect(await getSession(ext)).toBeNull();
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
  });
  it('locks when the last window closes, not before', async () => {
    const ext = fakeExt(2);
    await setSession(ext, ACC);
    ext.windows = 1;
    await onWindowRemoved(ext);
    expect(await getSession(ext)).not.toBeNull();
    ext.windows = 0;
    await onWindowRemoved(ext);
    expect(await getSession(ext)).toBeNull();
  });
  it('lock clears the whole storage.session area, not just SESSION_KEY', async () => {
    const ext = fakeExt();
    await ext.session.set('some_unrelated_key', 'still here?');
    await setSession(ext, ACC);
    await armAutolock(ext);
    await lock(ext);
    expect(await getSession(ext)).toBeNull();
    expect(await ext.session.get('some_unrelated_key')).toBeUndefined();
  });
  it('a NaN, Infinite, or non-numeric stored autoLockMinutes falls back to the default', async () => {
    const ext = fakeExt();
    // fakeExt's memKV JSON-round-trips (`JSON.parse(JSON.stringify(v))`), which is what a real
    // storage.local write would do too — but that turns NaN/Infinity into `null` before minutes()
    // ever sees them, which would trivially pass via the `typeof m !== 'number'` branch alone and
    // never actually exercise the `Number.isFinite` guard. Writing the raw map directly is the
    // only way to get a real NaN/Infinity in front of minutes().
    const raw = (ext.local as unknown as {data: Map<string, unknown>}).data;
    for (const bad of [NaN, Infinity, '15']) {
      raw.set('v1_settings', {autoLockMinutes: bad});
      await armAutolock(ext);
      expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(DEFAULT_AUTOLOCK_MINUTES);
    }
  });
});
