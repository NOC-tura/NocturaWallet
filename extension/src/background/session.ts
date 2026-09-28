import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';

/** Per-account signing keys while unlocked; memory-only storage.session, base64 strings. */
export const SESSION_KEY = 'v1_session';

export async function setSession(ext: Ext, accounts: SessionAccount[]): Promise<void> {
  await ext.session.set(SESSION_KEY, {accounts});
}

export async function getSession(ext: Ext): Promise<SessionAccount[] | null> {
  const v = (await ext.session.get(SESSION_KEY)) as {accounts?: SessionAccount[]} | undefined;
  return v?.accounts ?? null;
}

export async function clearSession(ext: Ext): Promise<void> {
  await ext.session.remove(SESSION_KEY);
}
