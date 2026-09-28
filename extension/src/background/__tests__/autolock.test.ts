import {armAutolock, lock, onWindowRemoved, AUTOLOCK_ALARM, DEFAULT_AUTOLOCK_MINUTES} from '../autolock';
import {setSession, getSession} from '../session';
import {fakeExt} from './fakeExt';

const ACC = [{index: 0, publicKey: 'x', secretKey: 'AAAA'}];

describe('auto-lock', () => {
  it('arms the alarm for the default five minutes', async () => {
    const ext = fakeExt();
    await armAutolock(ext);
    expect(DEFAULT_AUTOLOCK_MINUTES).toBe(5);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(5);
  });
  it('honours a stored setting inside 1–60, and clamps outside it', async () => {
    const ext = fakeExt();
    await ext.local.set('v1_settings', {autoLockMinutes: 15});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(15);
    await ext.local.set('v1_settings', {autoLockMinutes: 600});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(60);
    await ext.local.set('v1_settings', {autoLockMinutes: 0});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(1);
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
});
