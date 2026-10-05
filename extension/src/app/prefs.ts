/**
 * UI-only preferences in this page's localStorage (spec S4): no security meaning, per viewer,
 * allowed to vanish. Every access is wrapped — a blocked or private store must never break a screen.
 */
export const HIDE_BALANCES_KEY = 'noctura.ui.v1.hideBalances';
export const ACTIVITY_FILTER_KEY = 'noctura.ui.v1.activityFilter';
/**
 * #20's loop guard (spec §4.5, §7.7, plan 3): the challenge whose confirmation did not carry over once. UI state
 * with no security meaning — losing it only lets the guard show its first line again; it can never send anything.
 * In localStorage because the round trip through #10 may close the popup that saw the first strike.
 */
export const CONFIRM_STRIKE_KEY = 'noctura.ui.v1.confirmStrike';

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
