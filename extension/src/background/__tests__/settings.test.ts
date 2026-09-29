import {DEFAULT_SETTINGS, SETTINGS_KEY, parsePatch, readSettings, weakens, writeSettings} from '../settings';
import {fakeExt} from './fakeExt';

describe('settings', () => {
  it('defaults to a 5-minute auto-lock, a $100 re-auth threshold and account 0', async () => {
    expect(DEFAULT_SETTINGS).toEqual({autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0});
    expect(await readSettings(fakeExt())).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps stored values into range and ignores garbage', async () => {
    const ext = fakeExt();
    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 600, reauthUsdCents: 5, selectedAccount: -1});
    expect(await readSettings(ext)).toEqual({autoLockMinutes: 60, reauthUsdCents: 100, selectedAccount: 0});
    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: '15', reauthUsdCents: 25_000.4, selectedAccount: 2});
    expect(await readSettings(ext)).toEqual({autoLockMinutes: 5, reauthUsdCents: 25_000, selectedAccount: 2});
    await ext.local.set(SETTINGS_KEY, {reauthUsdCents: 1_000_000});
    expect((await readSettings(ext)).reauthUsdCents).toBe(100_000);
  });

  it('writes only its own fields', async () => {
    const ext = fakeExt();
    await writeSettings(ext, {...DEFAULT_SETTINGS, ...({extra: 'no'} as object)});
    expect(await ext.local.get(SETTINGS_KEY)).toEqual(DEFAULT_SETTINGS);
  });

  it('parsePatch accepts the two security settings in range and nothing else', () => {
    expect(parsePatch({autoLockMinutes: 10})).toEqual({autoLockMinutes: 10});
    expect(parsePatch({reauthUsdCents: 50_000, autoLockMinutes: 1})).toEqual({reauthUsdCents: 50_000, autoLockMinutes: 1});
    for (const bad of [{}, null, 'x', {autoLockMinutes: 0}, {autoLockMinutes: 61}, {autoLockMinutes: 2.5}, {reauthUsdCents: 99}, {reauthUsdCents: 100_001}, {selectedAccount: 1}, {autoLockMinutes: 5, x: 1}]) {
      expect(parsePatch(bad)).toBeNull();
    }
  });

  it('weakens: a longer auto-lock or a higher dollar threshold; shorter/lower/equal does not', () => {
    const s = DEFAULT_SETTINGS;
    expect(weakens(s, {autoLockMinutes: 6})).toBe(true);
    expect(weakens(s, {reauthUsdCents: 10_001})).toBe(true);
    expect(weakens(s, {autoLockMinutes: 4, reauthUsdCents: 5_000})).toBe(false);
    expect(weakens(s, {autoLockMinutes: 5})).toBe(false);
  });
});
