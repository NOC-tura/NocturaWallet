import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';
import {getSession, sessionMutex, setSessionIf} from './session';
import {armAutolock, lock} from './autolock';
import {readSettings, settingsMutex, writeSettings} from './settings';
import type {WalletDeps} from './deps';
import {CHALLENGE_ID, challengeInfo, satisfyChallenge} from './reauthChallenges';
import {changePassword, forgetWallet, provenRevisionIsStored, readWalletView, removePasskey, storeEnvelope} from './accountsStore';
import {isOpen, readPending} from './pendingStore';
import {startPoller} from './pending';
import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
import {PAGE_TYPES} from './dapp/pageApi';
import {decide, decideRequestOf, pending} from './dapp/decide';
import {runUnlockHook} from './dapp/queue';
import {dropAccountGrants, listBlocked, listGrants, revokeAll, revokeGrant, undoRevoke, unblock} from './dapp/grantsApi';

/** What the browser reports about a message's origin (runtime.MessageSender). */
export interface Sender {
  id?: string;
  origin?: string;
  url?: string;
  tab?: unknown;
  frameId?: number;
  /** B1c: Chrome 106+ (§2.3) — the document, and its lifecycle (C16). */
  documentId?: string;
  documentLifecycle?: string;
}

/**
 * Two partitions (spec §1). Privileged types come only from this extension's own pages;
 * page types only from https top frames, and only on the `noctura-page` port (B1c §1.3, §1.4:
 * dapp/pageApi.ts) — never through runtime.sendMessage, so here a page type is refused from
 * anyone, an extension page included. `sender.origin` is what the browser sets — never the URL
 * the message claims, and never "has a tab", which a full-tab extension page also has.
 */
export const PRIVILEGED = [
  'vault.setKeys',
  'vault.lock',
  'vault.status',
  'vault.reauthOk',
  'vault.storeEnvelope',
  'vault.challengeInfo',
  'vault.forgetWallet',
  'vault.changePassword',
  'vault.removePasskey',
  'vault.phraseVerified',
  'activity.ping',
  ...WALLET_TYPES,
  // B1c §1.4: the approval window's two, and #49's.
  'dapp.pending',
  'dapp.decide',
  'dapp.grants.list',
  'dapp.grants.revoke',
  'dapp.grants.undo',
  'dapp.grants.revokeAll',
  'dapp.blocked.list',
  'dapp.blocked.remove',
] as const;
/**
 * Only the vault page itself may hand over keys, report a re-authentication it proved, hand over
 * the envelope it re-encrypted (the background is the one writer of v1_vault), or read what a
 * re-authentication is for (vault.challengeInfo, B1b-2a E3), or forget the wallet it proved
 * (vault.forgetWallet, E5), change the password it proved (vault.changePassword, B1b-2b E10) or remove the passkey
 * (vault.removePasskey, E12), or record that the phrase was verified (vault.phraseVerified, E15): the popup and the
 * tab cannot.
 */
const VAULT_PAGE_ONLY: readonly string[] = [
  'vault.setKeys',
  'vault.reauthOk',
  'vault.storeEnvelope',
  'vault.challengeInfo',
  'vault.forgetWallet',
  'vault.changePassword',
  'vault.removePasskey',
  'vault.phraseVerified',
];
/** B1c §1.4: the approval window's messages come from approve.html only (sender.origin ours, the path /approve.html). */
const APPROVE_PAGE_ONLY: readonly string[] = ['dapp.pending', 'dapp.decide'];
/** …and #49's from the popup or the UI tab only — never the approval window a site caused, nor the vault page. */
const WALLET_UI_ONLY: readonly string[] = ['dapp.grants.list', 'dapp.grants.revoke', 'dapp.grants.undo', 'dapp.grants.revokeAll', 'dapp.blocked.list', 'dapp.blocked.remove'];
export const PAGE: readonly string[] = PAGE_TYPES;

function isOwnPage(ext: Ext, s: Sender): boolean {
  return s.id === ext.runtimeId && s.origin === ext.extensionOrigin;
}

/**
 * null on anything that isn't this extension's origin, including a `url` that fails to parse.
 * Built from `protocol` + `host`, not the `.origin` getter: the WHATWG URL spec only computes
 * `.origin` for a fixed list of "special" schemes, and `chrome-extension:` / `moz-extension:`
 * are not on it outside an actual browser — Node's parser (this test environment) returns the
 * literal string "null" for them, which would make every real page path check fail.
 */
function pagePath(ext: Ext, s: Sender): string | null {
  if (!s.url) return null;
  try {
    const u = new URL(s.url);
    return `${u.protocol}//${u.host}` === ext.extensionOrigin ? u.pathname : null;
  } catch {
    return null;
  }
}

/** A signing key's secretKey is a raw Ed25519 keypair encoding: 32-byte seed + 32-byte pubkey. */
const SECRET_KEY_BYTES = 64;

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * The secretKey must be a real keypair FOR the address it is stored under: its embedded public
 * half equals the base58-decoded `publicKey`, and its seed half derives that same key. Anything
 * else would sign as one address while the wallet shows another.
 */
function isValidAccount(a: unknown): a is SessionAccount {
  if (typeof a !== 'object' || a === null) return false;
  const {index, publicKey, secretKey} = a as SessionAccount;
  if (!Number.isInteger(index) || index < 0) return false;
  if (typeof publicKey !== 'string' || publicKey.length === 0) return false;
  if (typeof secretKey !== 'string') return false;
  let sk: Uint8Array | undefined;
  try {
    const pub = base58.decode(publicKey);
    sk = base64.decode(secretKey);
    if (sk.length !== SECRET_KEY_BYTES || pub.length !== 32) return false;
    return sameBytes(sk.subarray(32), pub) && sameBytes(ed25519.getPublicKey(sk.subarray(0, 32)), pub);
  } catch {
    return false;
  } finally {
    sk?.fill(0);
  }
}

function validAccounts(v: unknown): v is SessionAccount[] {
  return Array.isArray(v) && v.length > 0 && v.every(isValidAccount);
}

export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps?: WalletDeps): Promise<Result> {
  if (typeof msg !== 'object' || msg === null || typeof (msg as {type?: unknown}).type !== 'string') {
    return {ok: false, error: 'malformed'};
  }
  const type = (msg as {type: string}).type;
  const privileged = (PRIVILEGED as readonly string[]).includes(type);
  if (!privileged && !PAGE.includes(type)) return {ok: false, error: 'unknown type'};
  // B1c §1.4: page types travel on the page port only.
  if (!privileged) return {ok: false, error: 'forbidden'};
  if (!isOwnPage(ext, sender)) return {ok: false, error: 'forbidden'};
  if (VAULT_PAGE_ONLY.includes(type) && pagePath(ext, sender) !== '/unlock.html') return {ok: false, error: 'forbidden'};
  if (APPROVE_PAGE_ONLY.includes(type) && pagePath(ext, sender) !== '/approve.html') return {ok: false, error: 'forbidden'};
  if (WALLET_UI_ONLY.includes(type) && pagePath(ext, sender) !== '/popup.html' && pagePath(ext, sender) !== '/wallet.html') return {ok: false, error: 'forbidden'};

  switch (type) {
    case 'vault.setKeys': {
      const accounts = (msg as {accounts?: unknown}).accounts;
      if (!validAccounts(accounts)) return {ok: false, error: 'malformed'};
      // The keys must be the stored wallet's (B1b-2a review H1): every {index, publicKey} handed over is
      // one the envelope records. Every vault-page flow stores the envelope before it hands over keys
      // (onboarding and D41's retry: storeEnvelope then setKeys; #39's restore: forgetWallet with the
      // same-key replacement, then setKeys; add account: storeEnvelope then setKeys; unlock: the
      // envelope exists), so this refuses only keys of no stored wallet. The envelope is read inside
      // the same sessionMutex section as the session write (setSessionIf), the section vault.forgetWallet
      // writes the vault in: keys bound to a wallet a forget removes meanwhile are never written.
      const bound = async (): Promise<boolean> => {
        const view = await readWalletView(ext);
        const stored = new Map((view?.accounts ?? []).map(a => [a.index, a.publicKey]));
        return accounts.every(a => stored.get(a.index) === a.publicKey);
      };
      // Fail closed: keys in storage.session with no alarm armed would never auto-lock, while
      // the vault page reports "Unlock failed". Anything that throws after the write undoes it.
      try {
        if (!(await setSessionIf(ext, accounts, bound))) return {ok: false, error: 'unknown-account'};
        await armAutolock(ext);
      } catch (e) {
        await lock(ext);
        throw e;
      }
      // B1c §2.4: the unlock hook. If it throws, the session stays unlocked and the next queue access runs it again.
      await runUnlockHook(ext, deps ?? {now: Date.now}).catch(e => console.warn('dApp unlock hook failed; the next queue access runs it again', e));
      return {ok: true};
    }
    case 'vault.lock':
      await lock(ext);
      return {ok: true};
    case 'vault.status': {
      const s = await getSession(ext);
      return {ok: true, data: {unlocked: s !== null, accounts: (s ?? []).map(a => ({index: a.index, publicKey: a.publicKey}))}};
    }
    case 'activity.ping':
      if ((await getSession(ext)) !== null) await armAutolock(ext);
      return {ok: true};
    case 'vault.reauthOk': {
      if (deps === undefined) return {ok: false, error: 'unavailable'};
      const challengeId = (msg as {challengeId?: unknown}).challengeId;
      if (typeof challengeId !== 'string') return {ok: false, error: 'malformed'};
      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
      // E9 (D6): a settings challenge is applied here, by the background, from the patch it bound at issue — the
      // message carries only the id. A send challenge (or an unknown one) is satisfied as before (D38).
      const about = await challengeInfo(ext, deps.now(), challengeId);
      if (about?.kind === 'settings') return applySettingsChallenge(ext, deps, challengeId);
      return (await satisfyChallenge(ext, deps.now(), challengeId)) ? {ok: true} : {ok: false, error: 'unknown-challenge'};
    }
    case 'vault.challengeInfo': {
      if (deps === undefined) return {ok: false, error: 'unavailable'};
      const challengeId = (msg as {challengeId?: unknown}).challengeId;
      if (typeof challengeId !== 'string' || !CHALLENGE_ID.test(challengeId)) return {ok: false, error: 'malformed'};
      if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
      // The description comes only from here, never from the vault page's URL (E3).
      const about = await challengeInfo(ext, deps.now(), challengeId);
      return about === null ? {ok: false, error: 'unknown-challenge'} : {ok: true, data: about};
    }
    case 'vault.forgetWallet': {
      if (deps === undefined) return {ok: false, error: 'unavailable'};
      const {expectedRevision, replacement, guard} = msg as {expectedRevision?: unknown; replacement?: unknown; guard?: unknown};
      let r: Awaited<ReturnType<typeof forgetWallet>>;
      try {
        r = await forgetWallet(ext, deps, {expectedRevision, replacement, guard});
      } catch {
        // A storage failure: the steps before the vault write leave the wallet in place (locked at most).
        return {ok: false, error: 'failed'};
      }
      if (r !== 'forgotten') return {ok: false, error: r};
      // After the commit point, so never 'failed' (the vault is already removed or replaced): a send
      // that passed its session check before the lock may have appended a record after the clear — it
      // is kept, and watched without keys. If this read fails, the 30 s alarm, the next wallet.*
      // message or a service-worker start resumes the polling.
      try {
        if ((await readPending(ext)).some(isOpen)) void startPoller(ext, deps);
      } catch (e) {
        console.warn('vault.forgetWallet: forgotten, but the pending check after it failed', e);
      }
      return {ok: true};
    }
    case 'vault.changePassword': {
      if (deps === undefined) return {ok: false, error: 'unavailable'};
      const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
      try {
        const r = await changePassword(ext, deps.now(), expectedRevision, envelope);
        return r === 'changed' ? {ok: true} : {ok: false, error: r};
      } catch {
        return {ok: false, error: 'failed'};
      }
    }
    case 'vault.removePasskey': {
      const {expectedRevision} = msg as {expectedRevision?: unknown};
      try {
        const r = await removePasskey(ext, expectedRevision);
        return r === 'removed' ? {ok: true} : {ok: false, error: r};
      } catch {
        return {ok: false, error: 'failed'};
      }
    }
    case 'vault.phraseVerified': {
      // E15 (D15, C8): a fact, not a security guarantee — the background cannot check it, and it gates nothing; it
      // only decides two #35 task rows and one protections row. Vault page only keeps the popup and the web out.
      if (deps === undefined) return {ok: false, error: 'unavailable'};
      // The final review's m7: bound to the wallet whose phrase was checked — the page sends the revision it proved
      // against; another one stored (a wallet deleted and another created meanwhile, or this one changed) is `busy`.
      const {expectedRevision} = msg as {expectedRevision?: unknown};
      try {
        // Lock order settingsMutex → sessionMutex (walletApi's). The session check, the revision check and the
        // settings write share one sessionMutex section: a lock — and so a vault.forgetWallet, which locks first and
        // removes v1_settings after — is ordered wholly before the checks (`locked`) or wholly after the write (a
        // delete then removes the fact).
        const recorded = await settingsMutex(() =>
          sessionMutex(async () => {
            const bound = await provenRevisionIsStored(ext, expectedRevision);
            if (bound === 'malformed') return bound;
            if ((await getSession(ext)) === null) return 'locked';
            if (bound !== 'same') return bound;
            await writeSettings(ext, {...(await readSettings(ext)), phraseVerifiedAt: deps.now()});
            return 'recorded';
          }),
        );
        return recorded === 'recorded' ? {ok: true} : {ok: false, error: recorded};
      } catch {
        return {ok: false, error: 'failed'};
      }
    }
    case 'dapp.pending':
      return deps === undefined ? {ok: false, error: 'unavailable'} : {ok: true, data: await pending(ext, deps)};
    case 'dapp.decide': {
      if (deps === undefined) return {ok: false, error: 'unavailable'};
      const d = decideRequestOf(msg as Record<string, unknown>);
      return d === null ? {ok: false, error: 'malformed'} : decide(ext, deps, d);
    }
    case 'dapp.grants.list':
      return deps === undefined ? {ok: false, error: 'unavailable'} : listGrants(ext, deps);
    case 'dapp.grants.revoke':
      return deps === undefined ? {ok: false, error: 'unavailable'} : revokeGrant(ext, deps, (msg as {origin?: unknown}).origin);
    case 'dapp.grants.undo':
      return deps === undefined ? {ok: false, error: 'unavailable'} : undoRevoke(ext, deps, (msg as {undoToken?: unknown}).undoToken);
    case 'dapp.grants.revokeAll':
      return deps === undefined ? {ok: false, error: 'unavailable'} : revokeAll(ext, deps);
    case 'dapp.blocked.list':
      return deps === undefined ? {ok: false, error: 'unavailable'} : listBlocked(ext, deps);
    case 'dapp.blocked.remove':
      return deps === undefined ? {ok: false, error: 'unavailable'} : unblock(ext, deps, (msg as {host?: unknown}).host);
    case 'vault.storeEnvelope': {
      const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
      const dropped: string[] = [];
      const r = await storeEnvelope(ext, expectedRevision, envelope, keys => void dropped.push(...keys));
      // B1c §2.1 (review 2 M9): a removed account's dApp grants go with it.
      if (r === 'stored' && dropped.length > 0) await dropAccountGrants(ext, deps ?? {now: Date.now}, dropped).catch(e => console.warn('dApp grants of a removed account not removed', e));
      return r === 'stored' ? {ok: true} : {ok: false, error: r};
    }
    default:
      if (isWalletType(type)) {
        return deps === undefined ? {ok: false, error: 'unavailable'} : handleWallet(ext, deps, type, msg as Record<string, unknown>);
      }
      return {ok: false, error: 'unknown type'};
  }
}
