import type {Ext} from '../ext';
import {sessionMutex} from './session';
import {DEFAULT_SETTINGS, readSettings} from './settings';
import {afterLock, lockInSection} from './dapp/lockHook';

export const AUTOLOCK_ALARM = 'autolock';
export const DEFAULT_AUTOLOCK_MINUTES = DEFAULT_SETTINGS.autoLockMinutes;

async function minutes(ext: Ext): Promise<number> {
  return (await readSettings(ext)).autoLockMinutes;
}

/** Re-arm on every user action and every unlock; the alarm firing locks. */
export async function armAutolock(ext: Ext): Promise<void> {
  await ext.alarms.create(AUTOLOCK_ALARM, {delayInMinutes: await minutes(ext)});
}

/**
 * The one lock, and the dApp provider's lock hook (B1c §2.4): the session cleared, the dApp queue answered and written
 * back, all in one sessionMutex section (dapp/lockHook.ts); then the alarm cleared, the approval window closed and the
 * pages told. Every caller calls this, from outside any sessionMutex section. A second lock right after (closing the
 * window fires onWindowRemoved, which may lock again) finds nothing to do and does not throw.
 */
export async function lock(ext: Ext, now: () => number = Date.now): Promise<void> {
  const out = await sessionMutex(() => lockInSection(ext, now()));
  await ext.alarms.clear(AUTOLOCK_ALARM);
  await afterLock(ext, out);
}

/** Chrome can keep running with no windows, so session storage alone is not "browser closed". */
export async function onWindowRemoved(ext: Ext): Promise<void> {
  if ((await ext.windowCount()) === 0) await lock(ext);
}
