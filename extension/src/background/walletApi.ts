import {base58} from '@scure/base';
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {REAUTH_KEY, getSession, sessionMutex} from './session';
import {armAutolock} from './autolock';
import {parsePatch, readSettings, settingsMutex, updateSettings, weakens, writeSettings, type Settings, type SettingsPatch} from './settings';
import {cleanName, readWalletView, renameAccount} from './accountsStore';
import {issueChallenge, takeSettingsChallenge} from './reauthChallenges';
import {digestOf} from './digest';
import {discardPrepared, isAddress, parseIntent, preparedFor, prepareSend} from './prepare';
import {isKnownRecipient, lastSentAt} from './knownRecipients';
import {MAINNET_FEE_TREASURY} from '../../../core/fees/transferMarkup';
import {sendPrepared} from './send';
import {resend, startPoller} from './pending';
import {isOpen, readPending, viewOf} from './pendingStore';
import {createHistory, type History} from './history';
import {ResendRefused, SendRefused, SentUnconfirmed} from './sendTypes';
import {readCachedBalances, readCachedPrices, writeCachedBalances, writeCachedPrices, type PriceView} from './balanceCache';
import {readWalletBalances, WALLET_TOKENS} from '../../../core/solana/balances';
import {RequestUnreachable, RpcForbidden} from '../../../core/solana/rpc';

export type Result = {ok: true; data?: unknown} | {ok: false; error: string; data?: unknown};

export const WALLET_TYPES = [
  'wallet.state',
  'wallet.balances',
  'wallet.probeBalances',
  'wallet.prepareSend',
  'wallet.send',
  'wallet.resend',
  'wallet.pending',
  'wallet.preparedFor',
  'wallet.history',
  'wallet.prices',
  'wallet.cached',
  'wallet.recipientInfo',
  'wallet.discardPrepared',
  'accounts.rename',
  'accounts.select',
  'accounts.order',
  'settings.get',
  'settings.set',
] as const;
export type WalletType = (typeof WALLET_TYPES)[number];
export const isWalletType = (t: string): t is WalletType => (WALLET_TYPES as readonly string[]).includes(t);

/** Onboarding probes SLIP-0010 accounts 0–4 and cli: six public keys at most. */
const MAX_PROBE = 6;
const MALFORMED: Result = {ok: false, error: 'malformed'};
const histories = new WeakMap<WalletDeps, History>();
const isIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

/** A transaction signature: base58 of exactly 64 bytes (review M6 — a page cursor is never passed on unchecked). */
function isSignature(x: unknown): x is string {
  if (typeof x !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(x)) return false;
  try {
    return base58.decode(x).length === 64;
  } catch {
    return false;
  }
}

function historyFor(deps: WalletDeps): History {
  let h = histories.get(deps);
  if (h === undefined) {
    h = createHistory(deps);
    histories.set(deps, h);
  }
  return h;
}

/**
 * Every refusal is a fixed code. A 403 — and the latch refusing during the cool-down that follows
 * one (RpcCoolingDown, a subclass) — is 'coordinator-refused': terminal, never retried. A send
 * recorded (and possibly broadcast) whose state could not be read back is 'check-pending'. A request
 * that got no answer is 'unreachable'. Anything unexpected is 'failed', never a thrown error across
 * the message boundary.
 */
function failure(e: unknown): Result {
  if (e instanceof SendRefused) {
    if (e.code === 'reauth-required' && e.detail !== '') return {ok: false, error: e.code, data: {challengeId: e.detail}};
    return e.detail === '' ? {ok: false, error: e.code} : {ok: false, error: e.code, data: {detail: e.detail}};
  }
  if (e instanceof ResendRefused) return {ok: false, error: e.code};
  // Recorded and possibly broadcast: not 'failed' — the screens send the user to wallet.pending.
  if (e instanceof SentUnconfirmed) return {ok: false, error: 'check-pending', data: {id: e.id, signature: e.signature}};
  if (e instanceof RpcForbidden) return {ok: false, error: 'coordinator-refused'};
  // No answer at all (a timeout, or the fetch rejecting): the screens say "could not reach", never "failed".
  if (e instanceof RequestUnreachable) return {ok: false, error: 'unreachable'};
  return {ok: false, error: 'failed'};
}

/**
 * E14 (D17): the envelope's accounts in the display order — the indexes of `order` that exist, in that order,
 * then every account `order` does not name, in envelope order. The envelope, its AAD and the session never see it.
 */
export function displayOrder<T extends {index: number}>(accounts: readonly T[], order: readonly number[] | null): T[] {
  if (order === null) return [...accounts];
  const byIndex = new Map(accounts.map(a => [a.index, a]));
  const out: T[] = [];
  for (const i of order) {
    const a = byIndex.get(i);
    if (a !== undefined) {
      out.push(a);
      byIndex.delete(i);
    }
  }
  for (const a of accounts) if (byIndex.has(a.index)) out.push(a);
  return out;
}

async function walletState(ext: Ext) {
  const [view, session, settings] = await Promise.all([readWalletView(ext), getSession(ext), readSettings(ext)]);
  if (view === null) return {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null, passkey: false};
  const accounts = displayOrder(view.accounts, settings.accountOrder);
  // The selection is only ever an account that exists: in the envelope, and — while unlocked — in the
  // session too (an account removed in the vault page must not stay selected). Otherwise the first such
  // account of the display order (E14).
  const inSession = (i: number) => session === null || session.some(a => a.index === i);
  const choices = accounts.map(a => a.index).filter(inSession);
  const selected = choices.includes(settings.selectedAccount) ? settings.selectedAccount : (choices[0] ?? accounts[0]?.index ?? null);
  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts, selected, passkey: view.passkey};
}

/** Balances for onboarding's candidate addresses: public keys in, public numbers out. */
async function probe(deps: WalletDeps, keys: unknown): Promise<Result> {
  if (!Array.isArray(keys)) return MALFORMED;
  const list = keys as unknown[];
  if (list.length === 0 || list.length > MAX_PROBE || !list.every(isAddress)) return MALFORMED;
  let lamports: bigint[];
  try {
    lamports = await deps.reader.getMultipleLamports(list);
  } catch (e) {
    if (e instanceof RpcForbidden) throw e;
    return {ok: true, data: {resolved: false, balances: []}};
  }
  const nocMint = WALLET_TOKENS.NOC.mint as string;
  const balances: {publicKey: string; lamports: string; noc: string}[] = [];
  for (const [i, publicKey] of list.entries()) {
    let noc: bigint;
    try {
      noc = (await deps.reader.getTokenAccountsByOwner(publicKey, {mint: nocMint})).reduce((sum, a) => sum + a.amount, 0n);
    } catch (e) {
      if (e instanceof RpcForbidden) throw e;
      // Never a zero for a read that failed: a NOC-only wallet would look unfunded, and import would
      // choose its (permanent) scheme from that. Unresolved makes the user choose.
      return {ok: true, data: {resolved: false, balances: []}};
    }
    balances.push({publicKey, lamports: (lamports[i] ?? 0n).toString(), noc: noc.toString()});
  }
  return {ok: true, data: {resolved: true, balances}};
}

/** The stored envelope's account addresses (none without a wallet): the cache writers' check, read inside their mutex. */
const envelopeKeys = async (ext: Ext): Promise<string[]> => (await readWalletView(ext))?.accounts.map(a => a.publicKey) ?? [];

/** USD per whole token, re-validated: finite and > 0, else null — never 0 (E1). */
const usd = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : null);

/**
 * wallet.prices (E1): SOL, USDC and USDT from /wallet/prices, NOC at the presale stage price from
 * /stats. The two reads are independent: one failing nulls only its own fields; both failing is the
 * first read's refusal. A 403 from either is never swallowed. The reply is cached (E4).
 */
async function prices(ext: Ext, deps: WalletDeps): Promise<Result> {
  const [market, stage] = await Promise.allSettled([deps.prices(), deps.stagePrice()]);
  for (const r of [market, stage]) if (r.status === 'rejected' && r.reason instanceof RpcForbidden) throw r.reason;
  if (market.status === 'rejected' && stage.status === 'rejected') throw market.reason;
  const m = market.status === 'fulfilled' ? market.value : {};
  const data: PriceView = {
    sol: usd(m.solana),
    usdc: usd(m.usdc),
    usdt: usd(m.usdt),
    noc: stage.status === 'fulfilled' ? usd(stage.value) : null,
    at: deps.now(),
  };
  // Best effort: a storage hiccup must not turn fresh prices into 'failed'. The wallet check runs
  // inside the cache's mutex (see writeCachedPrices).
  await writeCachedPrices(ext, () => envelopeKeys(ext), data).catch(() => undefined);
  return {ok: true, data};
}

/**
 * wallet.recipientInfo (E6): what #12 may say about a recipient before anything is prepared. Local
 * only — no network. Refused while locked: it reveals whom this wallet has paid. A hint: prepareSend
 * recomputes everything that decides.
 */
async function recipientInfo(ext: Ext, account: unknown, recipient: unknown): Promise<Result> {
  if (!isAddress(account) || !isAddress(recipient)) return MALFORMED;
  const session = await getSession(ext);
  if (session === null) return {ok: false, error: 'locked'};
  const view = await readWalletView(ext);
  const own = view?.accounts.find(a => a.publicKey === recipient);
  const label = own !== undefined ? {kind: 'own' as const, index: own.index, name: own.name} : recipient === MAINNET_FEE_TREASURY ? {kind: 'treasury' as const} : null;
  return {
    ok: true,
    data: {known: await isKnownRecipient(ext, session, recipient), lastSentAt: await lastSentAt(ext, recipient), label, self: recipient === account},
  };
}

/**
 * settings.set. Strengthening writes at once, also while locked (it lowers nothing). A weakening always issues a
 * challenge bound to the exact patch and answers `reauth-required`; it is applied only by vault.reauthOk (E9,
 * applySettingsChallenge). C1: a message carrying `challengeId` is `malformed` — the re-call path is gone, so it
 * cannot be a second door.
 */
async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unknown>): Promise<Result> {
  if (msg.challengeId !== undefined) return MALFORMED;
  const patch = parsePatch(msg.patch);
  if (patch === null) return MALFORMED;
  const out = await settingsMutex(async (): Promise<Result> => {
    const current = await readSettings(ext);
    if (weakens(current, patch)) {
      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
      const about = {autoLockMinutes: patch.autoLockMinutes ?? null, reauthUsdCents: patch.reauthUsdCents ?? null};
      // A lock may have landed since the check above: never issue a challenge into a locked session.
      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
      // issueChallenge takes sessionMutex itself (it is not re-entrant): never called inside it here.
      const challengeId = await issueChallenge(ext, deps, digestOf('settings', about), {kind: 'settings', ...about});
      // …nor keep one a lock raced past (issueChallenge wrote after the lock's clear): as in
      // prepareSend, remove just the challenges, under the mutex the lock takes — never lock()
      // or clearSession() here, which would wait on this very mutex.
      const lockedMeanwhile = await sessionMutex(async () => {
        if ((await getSession(ext)) !== null) return false;
        await ext.session.remove(REAUTH_KEY);
        return true;
      });
      return lockedMeanwhile ? {ok: false, error: 'locked'} : {ok: false, error: 'reauth-required', data: {challengeId}};
    }
    const next: Settings = {...current, ...patch};
    await writeSettings(ext, next);
    return {ok: true, data: next};
  });
  if (out.ok && patch.autoLockMinutes !== undefined && (await getSession(ext)) !== null) await armAutolock(ext);
  return out;
}

/**
 * E9 (D6): #10's Confirm satisfied a settings challenge — the background applies the patch it bound at issue. Inside
 * settingsMutex (taken BEFORE sessionMutex, the existing order): take the challenge (deleted in the same section
 * that reads it: applied exactly once), re-check the range (the stored `about` is checked only for integers), write
 * over whatever is stored now — the last confirmed proof wins, nothing re-bases or revokes another live challenge
 * (review M6). Then, outside the mutex, the auto-lock alarm is re-armed when it changed and a session exists.
 * Refusals: `unknown-challenge` (absent, expired, applied), `locked`, `malformed` (the challenge is burned, nothing
 * written), `failed` (a storage error up to and including the write; a re-arm that fails after it is only logged).
 */
export async function applySettingsChallenge(ext: Ext, deps: Pick<WalletDeps, 'now'>, challengeId: string): Promise<Result> {
  const applied: {patch: SettingsPatch | null} = {patch: null};
  let out: Result;
  try {
    out = await settingsMutex(async (): Promise<Result> => {
      const taken = await takeSettingsChallenge(ext, deps.now(), challengeId);
      if (taken === 'unknown-challenge' || taken === 'locked') return {ok: false, error: taken};
      const raw: Record<string, number> = {};
      if (taken.autoLockMinutes !== null) raw.autoLockMinutes = taken.autoLockMinutes;
      if (taken.reauthUsdCents !== null) raw.reauthUsdCents = taken.reauthUsdCents;
      const patch = parsePatch(raw);
      if (patch === null) return MALFORMED;
      await writeSettings(ext, {...(await readSettings(ext)), ...patch});
      applied.patch = patch;
      return {ok: true, data: {applied: 'settings'}};
    });
  } catch {
    return {ok: false, error: 'failed'};
  }
  // The write happened: never answer `failed` now (#10 would say "Nothing was changed"). A re-arm that fails leaves
  // the alarm already armed, which still locks — it fails safe.
  if (out.ok && applied.patch?.autoLockMinutes !== undefined) {
    try {
      if ((await getSession(ext)) !== null) await armAutolock(ext);
    } catch (e) {
      console.warn('settings applied, but the idle timer was not re-armed', e);
    }
  }
  return out;
}

async function selectAccount(ext: Ext, index: number): Promise<Result> {
  const view = await readWalletView(ext);
  if (view === null || !view.accounts.some(a => a.index === index)) return {ok: false, error: 'unknown-account'};
  await updateSettings(ext, s => ({...s, selectedAccount: index}));
  return {ok: true};
}

/**
 * accounts.order (E14, D17): a permutation of the stored envelope's index set, kept in v1_settings. No proof — the
 * order never touches the envelope or the session; every action names an account by index or key, never by
 * position. A different set (an account added or removed since the manager read it) is `stale`: an order is
 * never written for a list the user did not see. Two popups moving rows at once are last-writer-wins (review L9).
 */
async function orderAccounts(ext: Ext, order: unknown): Promise<Result> {
  if (!Array.isArray(order)) return MALFORMED;
  const list = order as unknown[];
  if (!list.every(isIndex) || new Set(list).size !== list.length) return MALFORMED;
  const indexes = list as number[];
  const view = await readWalletView(ext);
  if (view === null) return {ok: false, error: 'no-wallet'};
  const stored = new Set(view.accounts.map(a => a.index));
  if (indexes.length !== stored.size || !indexes.every(i => stored.has(i))) return {ok: false, error: 'stale'};
  await updateSettings(ext, s => ({...s, accountOrder: [...indexes]}));
  return {ok: true};
}

/**
 * A service worker stopped while a send was open, and woken by a message: resume watching it.
 * startPoller never doubles a running loop. A storage failure here must not fail the message.
 */
async function resumePolling(ext: Ext, deps: WalletDeps): Promise<void> {
  try {
    if ((await readPending(ext)).some(isOpen)) void startPoller(ext, deps);
  } catch {
    // The 30 s alarm and the next message try again.
  }
}

export async function handleWallet(ext: Ext, deps: WalletDeps, type: WalletType, msg: Record<string, unknown>): Promise<Result> {
  await resumePolling(ext, deps);
  try {
    switch (type) {
      case 'wallet.state':
        return {ok: true, data: await walletState(ext)};
      case 'wallet.balances': {
        const {account} = msg;
        if (!isAddress(account)) return MALFORMED;
        const b = await readWalletBalances(deps.reader, account);
        const data = {sol: b.sol.toString(), noc: b.noc.toString(), usdc: b.usdc.toString(), usdt: b.usdt.toString()};
        // E4: the last good read, for the next popup to show (stale) at once. Best effort.
        // The envelope is read inside the cache's mutex (see writeCachedBalances).
        await writeCachedBalances(ext, () => envelopeKeys(ext), account, data, deps.now()).catch(() => undefined);
        return {ok: true, data};
      }
      case 'wallet.prices':
        return await prices(ext, deps);
      case 'wallet.cached': {
        const {account} = msg;
        if (!isAddress(account)) return MALFORMED;
        // Not served while locked: a locked popup shows no balances.
        if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
        const [balances, cachedPrices] = await Promise.all([readCachedBalances(ext, account), readCachedPrices(ext)]);
        return {ok: true, data: {balances, prices: cachedPrices}};
      }
      case 'wallet.probeBalances':
        return await probe(deps, msg.publicKeys);
      case 'wallet.prepareSend': {
        // Everything the page sent is checked before any request: the intent's shape, then the
        // account against the unlocked session.
        const {account, challengeId} = msg;
        const intent = parseIntent(msg.intent);
        if (!isAddress(account) || intent === null) return MALFORMED;
        // Optional: the challenge of an earlier prepare of this intent (reused only if live and bound to it).
        if (challengeId !== undefined && typeof challengeId !== 'string') return MALFORMED;
        const session = await getSession(ext);
        if (session === null) return {ok: false, error: 'locked'};
        if (!session.some(a => a.publicKey === account)) return {ok: false, error: 'unknown-account'};
        return {ok: true, data: await prepareSend(ext, deps, account, intent, challengeId === undefined ? {} : {challengeId})};
      }
      case 'wallet.recipientInfo':
        return await recipientInfo(ext, msg.account, msg.recipient);
      case 'wallet.discardPrepared': {
        const {account} = msg;
        if (!isAddress(account)) return MALFORMED;
        await discardPrepared(ext, account);
        return {ok: true};
      }
      case 'wallet.preparedFor': {
        const {account} = msg;
        if (!isAddress(account)) return MALFORMED;
        return {ok: true, data: await preparedFor(ext, deps, account)};
      }
      case 'wallet.send': {
        const {id} = msg;
        if (typeof id !== 'string') return MALFORMED;
        return {ok: true, data: await sendPrepared(ext, deps, id)};
      }
      case 'wallet.resend': {
        const {id} = msg;
        if (typeof id !== 'string') return MALFORMED;
        return {ok: true, data: await resend(ext, deps, id)};
      }
      case 'wallet.pending':
        // Polling was resumed above if anything is open.
        return {ok: true, data: (await readPending(ext)).map(viewOf)};
      case 'wallet.history': {
        const {account, before} = msg;
        if (!isAddress(account) || (before !== undefined && !isSignature(before))) return MALFORMED;
        const {items, next} = await historyFor(deps).page(account, before);
        return {ok: true, data: {items, next}};
      }
      case 'accounts.rename': {
        const {index} = msg;
        const name = cleanName(msg.name);
        if (!isIndex(index) || name === null) return MALFORMED;
        const r = await renameAccount(ext, index, name);
        return r === 'renamed' ? {ok: true} : {ok: false, error: r};
      }
      case 'accounts.select': {
        const {index} = msg;
        if (!isIndex(index)) return MALFORMED;
        return await selectAccount(ext, index);
      }
      case 'accounts.order':
        return await orderAccounts(ext, msg.order);
      case 'settings.get':
        return {ok: true, data: await readSettings(ext)};
      case 'settings.set':
        return await setSettings(ext, deps, msg);
    }
  } catch (e) {
    return failure(e);
  }
}
