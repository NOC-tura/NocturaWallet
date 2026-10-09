import type {Ext} from '../ext';
import {createMutex} from './mutex';
import {getSession, sessionMutex} from './session';
import {isAddress} from './prepare';
import {recipientFacts} from './knownRecipients';
import {cleanName} from '../shared/envelopeRules';

/**
 * The address book (B1b-2b E17; D18–D20, C12, C19): a name for an address, nothing more — no notes, no import or export
 * (D18). storage.local, written only by the background (scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS). Newest
 * first; one contact per address; the address never changes once saved (delete and add again). Removed by a delete,
 * kept by a restore (D20; accountsStore's WALLET_DATA_KEYS).
 *
 * **A contact is a label, never trust (D19).** Nothing here makes an address "known": knownRecipients' rule reads no
 * contact, so the first-send re-authentication still fires for a saved address — #27c's "Save sender" on a dusting
 * look-alike must not disarm it (spec E17's security argument).
 */
export const CONTACTS_KEY = 'v1_contacts';
export const MAX_CONTACTS = 200;

export interface Contact {
  address: string;
  name: string;
}
/** contacts.list's row: `lastSentAt` and `known` come from E6's one rule (recipientFacts), never from the book. */
export interface ContactView extends Contact {
  lastSentAt: number | null;
  known: boolean;
}
export type SetContactResult = {created: boolean} | 'malformed' | 'duplicate-name' | 'full' | 'locked';

/** One mutex for every read-modify-write of v1_contacts. Lock order: this, then sessionMutex — never the reverse. */
const serial = createMutex();

/**
 * C19: two contacts may not share a name, compared after Unicode NFKC and case-folding. JavaScript has no full case
 * fold; lower-, upper- then lower-casing folds what simple lower-casing misses ("Straße" and "STRASSE") and is
 * idempotent where upper-then-lower is not: the capital ẞ (U+1E9E) only reaches "ss" through ß (fix round 1, M1).
 * Cross-script look-alikes are NOT folded together ("Вinance" with a Cyrillic В is another name) — the stated limit; a
 * pick row's full address is the defence for addresses.
 */
export const nameKey = (name: string): string => name.normalize('NFKC').toLowerCase().toUpperCase().toLowerCase();

/**
 * The stored list, re-validated: an entry is kept only with an address (base58, 32 bytes, canonical — prepare's
 * isAddress) and a name cleanName accepts (as stored: trimmed); a later entry for an address already read is dropped;
 * at most MAX_CONTACTS. Anything else in the key reads as an empty book — never "repaired" on read.
 */
export async function readContacts(ext: Ext): Promise<Contact[]> {
  const v = await ext.local.get(CONTACTS_KEY);
  if (!Array.isArray(v)) return [];
  const out: Contact[] = [];
  const seen = new Set<string>();
  for (const x of v as unknown[]) {
    if (out.length >= MAX_CONTACTS) break;
    if (typeof x !== 'object' || x === null) continue;
    const {address, name} = x as {address?: unknown; name?: unknown};
    const clean = cleanName(name);
    if (!isAddress(address) || clean === null || seen.has(address)) continue;
    seen.add(address);
    out.push({address, name: clean});
  }
  return out;
}

/** The contact saved for this address, or null. For E6's label (wallet.recipientInfo). */
export async function contactFor(ext: Ext, address: string): Promise<Contact | null> {
  return (await readContacts(ext)).find(c => c.address === address) ?? null;
}

/**
 * contacts.list: every contact with E6's facts about it, from one read of the known-recipient list — `known` is the very
 * rule prepareSend's `first-send` reason uses (recipientFacts), so a pick row can say "You have never sent to this
 * address." truthfully. Refused while locked (C12): the list says whom the user pays.
 */
export async function listContacts(ext: Ext): Promise<ContactView[] | 'locked'> {
  const session = await getSession(ext);
  if (session === null) return 'locked';
  const [contacts, facts] = await Promise.all([readContacts(ext), recipientFacts(ext, session)]);
  return contacts.map(c => ({address: c.address, name: c.name, lastSentAt: facts.lastSentAt(c.address), known: facts.known(c.address)}));
}

/**
 * contacts.set (C12): adds a contact first, or renames the one saved for this address in place (its position kept).
 * `malformed` — not an address, or a name cleanName refuses (C19); `duplicate-name` — another address already has this
 * name after NFKC and case-folding (renaming a contact to its own name is fine); `full` — a new address with
 * MAX_CONTACTS stored; `locked`. The session check and the write share one sessionMutex section: a lock — and so a
 * delete, which locks first and removes v1_contacts after — is ordered wholly before the check or wholly after the write.
 */
export async function setContact(ext: Ext, address: unknown, name: unknown): Promise<SetContactResult> {
  const clean = cleanName(name);
  if (!isAddress(address) || clean === null) return 'malformed';
  return serial(() =>
    sessionMutex(async (): Promise<SetContactResult> => {
      if ((await getSession(ext)) === null) return 'locked';
      const list = await readContacts(ext);
      const key = nameKey(clean);
      if (list.some(c => c.address !== address && nameKey(c.name) === key)) return 'duplicate-name';
      const at = list.findIndex(c => c.address === address);
      if (at >= 0) {
        list[at] = {address, name: clean};
        await ext.local.set(CONTACTS_KEY, list);
        return {created: false};
      }
      if (list.length >= MAX_CONTACTS) return 'full';
      await ext.local.set(CONTACTS_KEY, [{address, name: clean}, ...list]);
      return {created: true};
    }),
  );
}

/** contacts.remove: answers ok whether or not the address was saved (nothing is written then). `malformed`, `locked`. */
export async function removeContact(ext: Ext, address: unknown): Promise<'removed' | 'malformed' | 'locked'> {
  if (!isAddress(address)) return 'malformed';
  return serial(() =>
    sessionMutex(async () => {
      if ((await getSession(ext)) === null) return 'locked' as const;
      const list = await readContacts(ext);
      const kept = list.filter(c => c.address !== address);
      if (kept.length !== list.length) await ext.local.set(CONTACTS_KEY, kept);
      return 'removed' as const;
    }),
  );
}
