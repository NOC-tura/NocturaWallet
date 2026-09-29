import {base58} from '@scure/base';
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {getSession} from './session';
import {armAutolock} from './autolock';
import {createMutex} from './mutex';
import {parsePatch, readSettings, weakens, writeSettings, type Settings} from './settings';
import {cleanName, readWalletView, renameAccount} from './accountsStore';
import {consumeChallenge, issueChallenge} from './reauthChallenges';
import {digestOf} from './digest';
import {isAddress, parseIntent, prepareSend} from './prepare';
import {sendPrepared} from './send';
import {resend, startPoller} from './pending';
import {isOpen, readPending, viewOf} from './pendingStore';
import {createHistory, type History} from './history';
import {ResendRefused, SendRefused} from './sendTypes';
import {readWalletBalances, WALLET_TOKENS} from '../../../core/solana/balances';
import {RpcForbidden} from '../../../core/solana/rpc';

export type Result = {ok: true; data?: unknown} | {ok: false; error: string; data?: unknown};

export const WALLET_TYPES = [
  'wallet.state',
  'wallet.balances',
  'wallet.probeBalances',
  'wallet.prepareSend',
  'wallet.send',
  'wallet.resend',
  'wallet.pending',
  'wallet.history',
  'accounts.rename',
  'accounts.select',
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
/**
 * Every read-modify-write of v1_settings (settings.set, accounts.select), one at a time: a select
 * that read the settings before a strengthening must not write the weaker value back after it.
 * Its own mutex, not sessionMutex (which is not re-entrant, and which the challenge calls inside
 * take); nothing under sessionMutex takes this one.
 */
const settingsMutex = createMutex();

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
 * one (RpcCoolingDown, a subclass) — is 'coordinator-refused': terminal, never retried. Anything
 * unexpected is 'failed', never a thrown error across the message boundary.
 */
function failure(e: unknown): Result {
  if (e instanceof SendRefused) {
    if (e.code === 'reauth-required' && e.detail !== '') return {ok: false, error: e.code, data: {challengeId: e.detail}};
    return e.detail === '' ? {ok: false, error: e.code} : {ok: false, error: e.code, data: {detail: e.detail}};
  }
  if (e instanceof ResendRefused) return {ok: false, error: e.code};
  if (e instanceof RpcForbidden) return {ok: false, error: 'coordinator-refused'};
  return {ok: false, error: 'failed'};
}

async function walletState(ext: Ext) {
  const [view, session, settings] = await Promise.all([readWalletView(ext), getSession(ext), readSettings(ext)]);
  if (view === null) return {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null};
  const selected = view.accounts.some(a => a.index === settings.selectedAccount) ? settings.selectedAccount : (view.accounts[0]?.index ?? null);
  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts: view.accounts, selected};
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
    let noc = 0n;
    try {
      noc = (await deps.reader.getTokenAccountsByOwner(publicKey, {mint: nocMint})).reduce((sum, a) => sum + a.amount, 0n);
    } catch (e) {
      if (e instanceof RpcForbidden) throw e; // best-effort like the app — but a 403 is never swallowed
    }
    balances.push({publicKey, lamports: (lamports[i] ?? 0n).toString(), noc: noc.toString()});
  }
  return {ok: true, data: {resolved: true, balances}};
}

async function setSettings(ext: Ext, deps: WalletDeps, msg: Record<string, unknown>): Promise<Result> {
  const patch = parsePatch(msg.patch);
  if (patch === null) return MALFORMED;
  const out = await settingsMutex(async (): Promise<Result> => {
    const current = await readSettings(ext);
    if (weakens(current, patch)) {
      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
      const digest = digestOf('settings', {autoLockMinutes: patch.autoLockMinutes ?? null, reauthUsdCents: patch.reauthUsdCents ?? null});
      const id = msg.challengeId;
      // Neither call runs inside sessionMutex here: each takes it itself (it is not re-entrant).
      if (typeof id !== 'string' || !(await consumeChallenge(ext, deps.now(), id, digest))) {
        return {ok: false, error: 'reauth-required', data: {challengeId: await issueChallenge(ext, deps, digest)}};
      }
    }
    const next: Settings = {...current, ...patch};
    await writeSettings(ext, next);
    return {ok: true, data: next};
  });
  if (out.ok && patch.autoLockMinutes !== undefined && (await getSession(ext)) !== null) await armAutolock(ext);
  return out;
}

async function selectAccount(ext: Ext, index: number): Promise<Result> {
  const view = await readWalletView(ext);
  if (view === null || !view.accounts.some(a => a.index === index)) return {ok: false, error: 'unknown-account'};
  await settingsMutex(async () => writeSettings(ext, {...(await readSettings(ext)), selectedAccount: index}));
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
        return {ok: true, data: {sol: b.sol.toString(), noc: b.noc.toString(), usdc: b.usdc.toString(), usdt: b.usdt.toString()}};
      }
      case 'wallet.probeBalances':
        return await probe(deps, msg.publicKeys);
      case 'wallet.prepareSend': {
        // Everything the page sent is checked before any request: the intent's shape, then the
        // account against the unlocked session.
        const {account} = msg;
        const intent = parseIntent(msg.intent);
        if (!isAddress(account) || intent === null) return MALFORMED;
        const session = await getSession(ext);
        if (session === null) return {ok: false, error: 'locked'};
        if (!session.some(a => a.publicKey === account)) return {ok: false, error: 'unknown-account'};
        return {ok: true, data: await prepareSend(ext, deps, account, intent)};
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
        return {ok: true, data: await historyFor(deps).page(account, before)};
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
      case 'settings.get':
        return {ok: true, data: await readSettings(ext)};
      case 'settings.set':
        return await setSettings(ext, deps, msg);
    }
  } catch (e) {
    return failure(e);
  }
}
