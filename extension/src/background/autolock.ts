import type {Ext} from '../ext';
import {clearSession} from './session';
import {DEFAULT_SETTINGS, readSettings} from './settings';

export const AUTOLOCK_ALARM = 'autolock';
export const DEFAULT_AUTOLOCK_MINUTES = DEFAULT_SETTINGS.autoLockMinutes;

async function minutes(ext: Ext): Promise<number> {
  return (await readSettings(ext)).autoLockMinutes;
}

/** Re-arm on every user action and every unlock; the alarm firing locks. */
export async function armAutolock(ext: Ext): Promise<void> {
  await ext.alarms.create(AUTOLOCK_ALARM, {delayInMinutes: await minutes(ext)});
}

export async function lock(ext: Ext): Promise<void> {
  await clearSession(ext);
  await ext.alarms.clear(AUTOLOCK_ALARM);
}

/** Chrome can keep running with no windows, so session storage alone is not "browser closed". */
export async function onWindowRemoved(ext: Ext): Promise<void> {
  if ((await ext.windowCount()) === 0) await lock(ext);
}
