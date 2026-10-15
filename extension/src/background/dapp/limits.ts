/**
 * The rejection cooldown and the window budget (spec C14, §2.3; review 1 M8, review 2 H2, L1). Counters live in
 * storage.local (v1_dapp_limits, background-owned) so a lock does not reset them; wiped by a delete. Pure functions
 * over the stored value; store.ts's dappSection reads and writes it.
 */
export const LIMITS_KEY = 'v1_dapp_limits';
/** Everything here counts within the last ten minutes. */
export const LIMIT_WINDOW_MS = 10 * 60_000;
/** The third rejection from one host or one tab starts a cooldown … */
export const REJECTIONS_FOR_COOLDOWN = 3;
/** … of ten minutes, in which its requests are answered `rejected` with no window. */
export const COOLDOWN_MS = 10 * 60_000;
/** At most this many approval windows in LIMIT_WINDOW_MS, across all sites. */
export const WINDOW_BUDGET = 10;
/**
 * Fix round 2 (controller ruling, channel 2): a mismatch notice's OWN window budget — separate from WINDOW_BUDGET.
 * A real request's window budget must never be spendable by a page that repeatedly triggers (and the user
 * dismisses) notices for accounts granted elsewhere; nor may a flood of notices ever be answered `rejected` the way
 * an exhausted WINDOW_BUDGET answers a real request (that would be a new, visible side channel) — exhausting this
 * one instead silently stops new notices from being queued at all (pageApi.ts mismatchNotice), same as its other
 * caps. Smaller than WINDOW_BUDGET: a notice is never itself something the user asked for.
 */
export const NOTICE_WINDOW_BUDGET = 3;

export interface Limits {
  /** One per rejection and key (`host:<h>` and `tab:<id>`), at UTC ms. */
  rejections: {key: string; at: number}[];
  cooldowns: {key: string; until: number}[];
  /** When each approval window was opened. */
  windows: number[];
  /** Fix round 2: when each mismatch notice was queued (reserving its own budget slot) — kept apart from `windows`. */
  noticeWindows: number[];
  /** A request was declined because the budget was spent: the next window shows Q24, once. */
  notice: boolean;
}

/** A fresh, unshared value every call (fix round 1, CRITICAL 1): `EMPTY_LIMITS` below is one instance for
 * comparisons, never a value a caller may mutate — `limitsOf`'s "nothing stored" branch must not hand out
 * this same instance, or a section that mutates its `limits` in place pollutes every future "no limits". */
function emptyLimits(): Limits {
  return {rejections: [], cooldowns: [], windows: [], noticeWindows: [], notice: false};
}

export const EMPTY_LIMITS: Limits = emptyLimits();

const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const KEY = /^(host:[^\s/?#@]{1,253}|tab:\d{1,10})$/;
/** Bounds what one key can grow to whatever happens (a tab key per rejection, ten minutes kept). */
const MAX_ENTRIES = 1000;

export const hostKey = (host: string): string => `host:${host}`;
export const tabKey = (tabId: number): string => `tab:${tabId}`;

/** The stored value, re-validated and pruned to the window; anything else reads as no limits at all. */
export function limitsOf(x: unknown, now: number): Limits {
  if (typeof x !== 'object' || x === null) return emptyLimits();
  const o = x as Record<string, unknown>;
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);
  const rejections = list(o.rejections)
    .filter((r): r is {key: string; at: number} => typeof r === 'object' && r !== null && typeof (r as {key?: unknown}).key === 'string' && KEY.test((r as {key: string}).key) && isTime((r as {at?: unknown}).at))
    .map(r => ({key: r.key, at: r.at}));
  const cooldowns = list(o.cooldowns)
    .filter((c): c is {key: string; until: number} => typeof c === 'object' && c !== null && typeof (c as {key?: unknown}).key === 'string' && KEY.test((c as {key: string}).key) && isTime((c as {until?: unknown}).until))
    .map(c => ({key: c.key, until: c.until}));
  const windows = list(o.windows).filter(isTime);
  const noticeWindows = list(o.noticeWindows).filter(isTime);
  return prune({rejections, cooldowns, windows, noticeWindows, notice: o.notice === true}, now);
}

/** Only what still counts: rejections and windows of the last ten minutes, cooldowns not yet over. */
export function prune(l: Limits, now: number): Limits {
  const since = now - LIMIT_WINDOW_MS;
  return {
    rejections: l.rejections.filter(r => r.at > since && r.at <= now).slice(-MAX_ENTRIES),
    cooldowns: l.cooldowns.filter(c => c.until > now).slice(-MAX_ENTRIES),
    windows: l.windows.filter(t => t > since && t <= now).slice(-MAX_ENTRIES),
    noticeWindows: l.noticeWindows.filter(t => t > since && t <= now).slice(-MAX_ENTRIES),
    notice: l.notice,
  };
}

const count = (l: Limits, key: string): number => l.rejections.filter(r => r.key === key).length;

/** How many rejections the more-rejected of the request's host and tab has had in the window. */
export function rejectionsOf(l: Limits, host: string, tabId: number): number {
  return Math.max(count(l, hostKey(host)), count(l, tabKey(tabId)));
}

/** A rejection from this host and tab; the third within ten minutes for either starts its cooldown. */
export function withRejection(l: Limits, host: string, tabId: number, now: number): Limits {
  const keys = [hostKey(host), tabKey(tabId)];
  const next = prune({...l, rejections: [...l.rejections, ...keys.map(key => ({key, at: now}))]}, now);
  const cooling = keys.filter(k => count(next, k) >= REJECTIONS_FOR_COOLDOWN && !next.cooldowns.some(c => c.key === k));
  return {...next, cooldowns: [...next.cooldowns, ...cooling.map(key => ({key, until: now + COOLDOWN_MS}))]};
}

export function inCooldown(l: Limits, host: string, tabId: number, now: number): boolean {
  const keys = [hostKey(host), tabKey(tabId)];
  return l.cooldowns.some(c => keys.includes(c.key) && c.until > now);
}

export const budgetLeft = (l: Limits, now: number): boolean => prune(l, now).windows.length < WINDOW_BUDGET;

export const withWindow = (l: Limits, now: number): Limits => prune({...l, windows: [...l.windows, now]}, now);

/** Fix round 2: the mismatch notice's own budget — independent of `budgetLeft`/`withWindow` above. */
export const noticeBudgetLeft = (l: Limits, now: number): boolean => prune(l, now).noticeWindows.length < NOTICE_WINDOW_BUDGET;

export const withNoticeWindow = (l: Limits, now: number): Limits => prune({...l, noticeWindows: [...l.noticeWindows, now]}, now);
