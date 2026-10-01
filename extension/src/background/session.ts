import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';
import {createMutex} from './mutex';

/** Per-account signing keys while unlocked; memory-only storage.session, base64 strings. */
export const SESSION_KEY = 'v1_session';
/** Unsigned sends waiting for "Send" (cleared by lock). */
export const PREPARED_KEY = 'v1_prepared';
/** Re-authentication challenges (cleared by lock). */
export const REAUTH_KEY = 'v1_reauth';

/**
 * Serialises every read-modify-write of storage.session with clearSession (lock), so a write that
 * read the store before a lock cannot put it back after the lock. Not re-entrant: code running
 * inside it must not call clearSession or lock().
 */
export const sessionMutex = createMutex();

/**
 * Under sessionMutex, like every other storage.session write: an unlock that arrives while a
 * critical section is deciding what a lock left behind waits for it, instead of being undone by it.
 */
export async function setSession(ext: Ext, accounts: SessionAccount[]): Promise<void> {
  await sessionMutex(() => ext.session.set(SESSION_KEY, {accounts: cleanAccounts(accounts)}));
}

/**
 * Rebuild each account as exactly this shape before it touches storage — whatever the caller
 * validated (or didn't) is not what gets persisted. A stray field on the input object (e.g. an
 * accidental `seed`) must never reach storage.session.
 */
function cleanAccounts(accounts: SessionAccount[]): SessionAccount[] {
  return accounts.map(a => ({index: a.index, publicKey: a.publicKey, secretKey: a.secretKey}));
}

/**
 * setSession, only if `check` holds at the moment of the write: the check and the write run in ONE
 * sessionMutex section. vault.setKeys binds its keys to v1_vault this way (B1b-2a review H1): the
 * forget's vault write runs under sessionMutex too, so an unlock and a forget are totally ordered —
 * keys read against the old envelope can never be written after the wallet was forgotten. `check`
 * runs inside sessionMutex and must not take it (not re-entrant). False: nothing was written.
 */
export async function setSessionIf(ext: Ext, accounts: SessionAccount[], check: () => Promise<boolean>): Promise<boolean> {
  const clean = cleanAccounts(accounts);
  return sessionMutex(async () => {
    if (!(await check())) return false;
    await ext.session.set(SESSION_KEY, {accounts: clean});
    return true;
  });
}

export async function getSession(ext: Ext): Promise<SessionAccount[] | null> {
  const v = (await ext.session.get(SESSION_KEY)) as {accounts?: SessionAccount[]} | undefined;
  return v?.accounts ?? null;
}

export async function clearSession(ext: Ext): Promise<void> {
  // Clears the whole storage.session area, not just SESSION_KEY — lock() must leave nothing
  // behind, including any key another part of the extension may have written there.
  await sessionMutex(() => ext.session.clear());
}
