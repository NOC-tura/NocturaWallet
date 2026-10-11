import {isBlocked} from './blocked';
import {putGrant, type Answer, type Entry, type Tx} from './store';

/**
 * The unlock hook (spec §2.4, review 2 M7). Run by the first queue access of an unlocked session in this background
 * instance (ports.ts Runtime.hooked, which the lock clears) — vault.setKeys makes that access right after setSessionIf
 * succeeded and the auto-lock is armed (messages.ts), and if it throws there the session stays unlocked and the next
 * queue access runs it again:
 *  1. each `queued` connect of an origin holding a PERSISTENT grant is answered `{accounts: [granted]}` — the grant,
 *     the account (still in the session) and the block re-checked at that moment (D5: restored without #47);
 *  2. `change {accounts: [granted]}` to the open ports of persistent-grant origins;
 *  3. the rest is left for the window, which sees the unlock on its next poll (§2.3).
 * `answer` is queue.ts's (passed in, so this module needs nothing from the queue).
 */
export function unlockWork(tx: Tx, changes: Map<string, string[]>, answer: (e: Entry, a: Answer) => void): void {
  const session = tx.session;
  if (session === null) return;
  const usable = (account: string) => session.some(a => a.publicKey === account);
  for (const e of tx.s.queue) {
    if (e.state !== 'queued' || e.type !== 'connect') continue;
    const g = tx.grants.find(x => x.origin === e.origin);
    if (g === undefined || !usable(g.account) || isBlocked(tx.blocked, e.host)) continue;
    putGrant(tx, {...g, lastUsedAt: tx.now});
    answer(e, {result: {accounts: [g.account]}});
  }
  for (const g of tx.grants) if (usable(g.account)) changes.set(g.origin, [g.account]);
}
