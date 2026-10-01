/**
 * UI-only preferences in this page's localStorage (spec S4): no security meaning, per viewer,
 * allowed to vanish. Every access is wrapped — a blocked or private store must never break a screen.
 */
export const HIDE_BALANCES_KEY = 'noctura.ui.v1.hideBalances';
export const ACTIVITY_FILTER_KEY = 'noctura.ui.v1.activityFilter';

export function readPref(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Not remembered: fine for a preference.
  }
}
