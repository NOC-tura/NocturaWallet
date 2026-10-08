import type {Ext} from '../ext';
import {createMutex} from './mutex';
import {MAX_ACCOUNTS} from '../shared/envelopeRules';

/** storage.local key. Written only by the background (scripts/check-vault-isolation.mjs). */
export const SETTINGS_KEY = 'v1_settings';

export interface Settings {
  /** Idle minutes before auto-lock, 1–60 (spec §2). */
  autoLockMinutes: number;
  /** The absolute re-authentication threshold, in US cents (spec §3: default $100). */
  reauthUsdCents: number;
  /** The account index the popup shows. */
  selectedAccount: number;
  /**
   * B1b-2b E14 (D17, C7): the popup's display order of the accounts, by index — outside the envelope, so it
   * needs no proof and touches no AAD. Null: no order (envelope order).
   */
  accountOrder: number[] | null;
  /** B1b-2b E15 (C8): when the recovery phrase was last verified (epoch ms). A fact, not a security guarantee. */
  phraseVerifiedAt: number | null;
  /** B1b-2b C10: when the password was last changed (epoch ms), written by vault.changePassword (E10). */
  passwordChangedAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null};
export const AUTOLOCK_RANGE = {min: 1, max: 60};
/** $1 … $1 000: one re-authentication must not be able to raise the threshold a hundredfold (controller ruling). */
export const REAUTH_USD_CENTS_RANGE = {min: 100, max: 100_000};

const inRange = (v: unknown, r: {min: number; max: number}): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= r.min && v <= r.max;
const isIndex = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** An array of unique safe non-negative integers, at most MAX_ACCOUNTS long; anything else is no order — never "repaired". */
function orderOf(x: unknown): number[] | null {
  if (!Array.isArray(x) || x.length > MAX_ACCOUNTS) return null;
  const list = x as unknown[];
  if (!list.every(isIndex) || new Set(list).size !== list.length) return null;
  return [...(list as number[])];
}

/**
 * Stored values are claims: a field that is not an integer in its range falls back to the safe
 * default — never clamped to the nearest bound, which for a too-long lock or a too-high threshold
 * would be the weakest setting there is (controller ruling).
 */
export async function readSettings(ext: Ext): Promise<Settings> {
  const raw = await ext.local.get(SETTINGS_KEY);
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const sel = o.selectedAccount;
  return {
    autoLockMinutes: inRange(o.autoLockMinutes, AUTOLOCK_RANGE) ? o.autoLockMinutes : DEFAULT_SETTINGS.autoLockMinutes,
    reauthUsdCents: inRange(o.reauthUsdCents, REAUTH_USD_CENTS_RANGE) ? o.reauthUsdCents : DEFAULT_SETTINGS.reauthUsdCents,
    selectedAccount: typeof sel === 'number' && Number.isSafeInteger(sel) && sel >= 0 ? sel : DEFAULT_SETTINGS.selectedAccount,
    accountOrder: orderOf(o.accountOrder),
    phraseVerifiedAt: isIndex(o.phraseVerifiedAt) ? o.phraseVerifiedAt : null,
    passwordChangedAt: isIndex(o.passwordChangedAt) ? o.passwordChangedAt : null,
  };
}

/** Every field, rebuilt by name (C7): a field this does not name would be erased by the next write of any other. */
export async function writeSettings(ext: Ext, s: Settings): Promise<void> {
  await ext.local.set(SETTINGS_KEY, {
    autoLockMinutes: s.autoLockMinutes,
    reauthUsdCents: s.reauthUsdCents,
    selectedAccount: s.selectedAccount,
    accountOrder: s.accountOrder,
    phraseVerifiedAt: s.phraseVerifiedAt,
    passwordChangedAt: s.passwordChangedAt,
  });
}

/**
 * Every read-modify-write of v1_settings, one at a time (C7: moved here from walletApi.ts): a select that read
 * the settings before a strengthening must not write the weaker value back after it. Its own mutex, not
 * sessionMutex (which is not re-entrant, and which the challenge calls inside take): the order is always
 * settingsMutex first, then sessionMutex; nothing under sessionMutex takes this one.
 */
export const settingsMutex = createMutex();

/** One read-modify-write of v1_settings under settingsMutex; resolves to what was written. */
export function updateSettings(ext: Ext, change: (s: Settings) => Settings): Promise<Settings> {
  return settingsMutex(async () => {
    const next = change(await readSettings(ext));
    await writeSettings(ext, next);
    return next;
  });
}

export type SettingsPatch = {autoLockMinutes?: number; reauthUsdCents?: number};

/** The security settings a message may change: only these two keys, integers, in range. */
export function parsePatch(x: unknown): SettingsPatch | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0 || keys.some(k => k !== 'autoLockMinutes' && k !== 'reauthUsdCents')) return null;
  const patch: SettingsPatch = {};
  if ('autoLockMinutes' in o) {
    if (!inRange(o.autoLockMinutes, AUTOLOCK_RANGE)) return null;
    patch.autoLockMinutes = o.autoLockMinutes;
  }
  if ('reauthUsdCents' in o) {
    if (!inRange(o.reauthUsdCents, REAUTH_USD_CENTS_RANGE)) return null;
    patch.reauthUsdCents = o.reauthUsdCents;
  }
  return patch;
}

/** A change that lowers protection needs re-authentication (spec §1): later lock, higher threshold. */
export function weakens(current: Settings, patch: SettingsPatch): boolean {
  return (
    (patch.autoLockMinutes !== undefined && patch.autoLockMinutes > current.autoLockMinutes) ||
    (patch.reauthUsdCents !== undefined && patch.reauthUsdCents > current.reauthUsdCents)
  );
}
