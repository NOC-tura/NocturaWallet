import type {Ext} from '../ext';
import {clearSession} from './session';

export const AUTOLOCK_ALARM = 'autolock';
export const DEFAULT_AUTOLOCK_MINUTES = 5;

async function minutes(ext: Ext): Promise<number> {
  const s = (await ext.local.get('v1_settings')) as {autoLockMinutes?: number} | undefined;
  const m = s?.autoLockMinutes;
  if (typeof m !== 'number' || !Number.isFinite(m)) return DEFAULT_AUTOLOCK_MINUTES;
  return Math.min(60, Math.max(1, Math.round(m)));
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
