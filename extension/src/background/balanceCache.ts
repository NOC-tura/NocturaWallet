import type {Ext} from '../ext';
import {createMutex} from './mutex';

/**
 * The last balances and prices the background read, so a popup opened offline or before the network
 * answers shows something — marked stale until a fresh read replaces it (spec B1b-2a E4). storage.local,
 * written only by the background (scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS). Public data
 * of public addresses: the same exposure the envelope's own account list has.
 */
export const BALANCE_CACHE_KEY = 'v1_balance_cache';
export const PRICE_CACHE_KEY = 'v1_price_cache';

/** Base units as decimal strings (rule 2), and when they were read (epoch ms). */
export interface CachedBalances {
  sol: string;
  noc: string;
  usdc: string;
  usdt: string;
  at: number;
}

/** USD per whole token; null when unknown — never 0. `noc` is the presale stage price. */
export interface PriceView {
  sol: number | null;
  usdc: number | null;
  usdt: number | null;
  noc: number | null;
  at: number;
}

const serial = createMutex();
const DIGITS = /^\d{1,20}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isPrice = (x: unknown): x is number | null => x === null || (typeof x === 'number' && Number.isFinite(x) && x > 0);

/** A stored entry is a claim: only the exact shape is read, anything else is null. */
function balancesOf(x: unknown): CachedBalances | null {
  if (!isObj(x)) return null;
  const {sol, noc, usdc, usdt, at} = x;
  for (const v of [sol, noc, usdc, usdt]) if (typeof v !== 'string' || !DIGITS.test(v)) return null;
  if (!isTime(at)) return null;
  return {sol: sol as string, noc: noc as string, usdc: usdc as string, usdt: usdt as string, at};
}

function pricesOf(x: unknown): PriceView | null {
  if (!isObj(x)) return null;
  const {sol, usdc, usdt, noc, at} = x;
  if (!isPrice(sol) || !isPrice(usdc) || !isPrice(usdt) || !isPrice(noc) || !isTime(at)) return null;
  return {sol, usdc, usdt, noc, at};
}

export async function readCachedBalances(ext: Ext, account: string): Promise<CachedBalances | null> {
  const all = await ext.local.get(BALANCE_CACHE_KEY);
  return isObj(all) && Object.hasOwn(all, account) ? balancesOf(all[account]) : null;
}

export async function readCachedPrices(ext: Ext): Promise<PriceView | null> {
  return pricesOf(await ext.local.get(PRICE_CACHE_KEY));
}

/**
 * After a successful wallet.balances. Only an account of the stored envelope is cached (`envelope`:
 * reads its accounts' addresses), and every write trims the cache to them (at most MAX_ACCOUNTS), so a
 * removed account's balances do not linger and the key cannot grow without bound. `envelope` is called
 * INSIDE this mutex, the one clearCaches takes (Task 7 review): vault.forgetWallet removes the vault
 * before it queues clearCaches, so a write either read the vault before the removal and is cleared
 * after it, or reads no wallet and writes nothing — a deleted wallet's balances are never left behind.
 * A reader function, not an import of accountsStore, which imports this module.
 */
export async function writeCachedBalances(
  ext: Ext,
  envelope: () => Promise<readonly string[]>,
  account: string,
  b: Omit<CachedBalances, 'at'>,
  at: number,
): Promise<void> {
  await serial(async () => {
    const keep = new Set(await envelope());
    if (!keep.has(account)) return;
    const stored = await ext.local.get(BALANCE_CACHE_KEY);
    const next: Record<string, CachedBalances> = {};
    if (isObj(stored)) {
      for (const [k, v] of Object.entries(stored)) {
        const e = balancesOf(v);
        if (keep.has(k) && e !== null) next[k] = e;
      }
    }
    next[account] = {sol: b.sol, noc: b.noc, usdc: b.usdc, usdt: b.usdt, at};
    await ext.local.set(BALANCE_CACHE_KEY, next);
  });
}

/**
 * After a successful wallet.prices, under the same mutex as writeCachedBalances and clearCaches, and
 * only while a wallet exists (`envelope` is read INSIDE the mutex; final review M5): a price read in
 * flight across vault.forgetWallet either wrote before its clearCaches, which then removes it, or
 * finds no wallet and writes nothing — never a price cache left behind a deleted wallet.
 */
export async function writeCachedPrices(ext: Ext, envelope: () => Promise<readonly string[]>, p: PriceView): Promise<void> {
  await serial(async () => {
    if ((await envelope()).length === 0) return;
    await ext.local.set(PRICE_CACHE_KEY, {sol: p.sol, usdc: p.usdc, usdt: p.usdt, noc: p.noc, at: p.at});
  });
}

/** Both caches, removed (vault.forgetWallet, E5). */
export async function clearCaches(ext: Ext): Promise<void> {
  await serial(async () => {
    await ext.local.remove(BALANCE_CACHE_KEY);
    await ext.local.remove(PRICE_CACHE_KEY);
  });
}
