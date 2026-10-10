import type {Contact, Token} from './engine';
import {MAX_NAME_LENGTH} from '../shared/envelopeRules';

/**
 * The address book's display rules (B1b-2b §6): pure functions, no engine. What decides anything — a contact's
 * `known`, its `lastSentAt`, whether a name is taken — comes from the background (E17); these only choose words.
 */

/**
 * C18 (rev 2, review H3; rev 3, review L2): a received amount below these floors is "tiny" — 0.001 SOL, 0.01 USDC or
 * USDT, 1 NOC — in base units, compared as bigint (cardinal rule 2). It only chooses which warning #27c's "Save sender"
 * sheet shows (O78 + "Save anyway"); nothing is refused. Frozen (Task 3 fix round 1, M3): no caller can widen a floor.
 */
export const DUST_FLOOR: Readonly<Record<Token, bigint>> = Object.freeze({SOL: 1_000_000n, USDC: 10_000n, USDT: 10_000n, NOC: 1_000_000_000n});

/**
 * Dust (C18): below the token's floor — and, failing closed (Task 3 fix round 1, M3), an amount or a token the
 * decoder could not read (null), or a token string that is not one of the four floors (`DUST_FLOOR[token]`
 * undefined — the `Token` type promises this cannot happen, but the check holds even if that promise is broken).
 */
export function isDust(token: Token | null, amount: bigint | null): boolean {
  if (token === null || amount === null) return true;
  const floor = DUST_FLOOR[token];
  if (floor === undefined) return true;
  return amount < floor;
}

const dayStart = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * #15's "last sent" (ix:7522: relative natural language, no numerals beyond the count): "today" (O67), "yesterday"
 * (O68), "N days ago" (ix:7398), "last month" (ix:7408), "N months ago" (ix:7413), "last year" (O69), "N years ago"
 * (O70), "never" (ix:7418). Calendar days and months in local time (UTC stored, local only here — cardinal rule 3); a
 * time in the future (a clock set back) reads "today".
 */
export function whenText(lastSentAt: number | null, now: number): string {
  if (lastSentAt === null) return 'never';
  const days = Math.round((dayStart(now) - dayStart(lastSentAt)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  const a = new Date(lastSentAt);
  const n = new Date(now);
  const months = (n.getFullYear() - a.getFullYear()) * 12 + (n.getMonth() - a.getMonth()) - (n.getDate() < a.getDate() ? 1 : 0);
  if (months < 1) return `${days} days ago`;
  if (months === 1) return 'last month';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'last year' : `${years} years ago`;
}

/** The design's five avatar gradients (ix:1440-1444), chosen from the address so a contact keeps its colour. */
export const AVATARS = ['violet', 'mint', 'coral', 'amber', 'blue'] as const;
export function avatarOf(address: string): (typeof AVATARS)[number] {
  let sum = 0;
  for (let i = 0; i < address.length; i++) sum += address.charCodeAt(i);
  return AVATARS[sum % AVATARS.length] ?? 'violet';
}

/** The name's first character, upper-cased (a whole code point: an emoji or an astral letter is not cut in half). */
export const initialOf = (name: string): string => (Array.from(name)[0] ?? '').toUpperCase();

/** The same base58 length check the engine uses for an address (not exported there): local to this module's own ruling. */
const ADDRESS_SHAPED = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * #15's one "is this an address" test (final code review L2): the search, the results line and "Add new contact" all
 * use it. Alphabet and length only, deliberately not the 32-byte decode — a near-miss (a truncated or mistyped paste)
 * must still get the exact-equality search, never fall back to a substring match that would show the trusted contact.
 */
export const isAddressShaped = (text: string): boolean => ADDRESS_SHAPED.test(text);

/**
 * A search query as a pre-filled name (final code review L2): its first MAX_NAME_LENGTH UTF-16 units — the unit
 * cleanName counts in — without splitting a code point (an emoji straddling the limit is dropped, not halved).
 */
export function clampName(text: string): string {
  let out = '';
  for (const ch of text) {
    if (out.length + ch.length > MAX_NAME_LENGTH) break;
    out += ch;
  }
  return out;
}

/**
 * #15's search: by name, case-insensitive substring — or, when the trimmed query is itself address-shaped, by
 * **exact, case-sensitive equality against the address only** (Task 3 fix round 1, M4, controller ruling; spec
 * §6.1). No substring and no case-folding for a full address: address poisoning is this plan's threat model, and a
 * look-alike that only differs by a suffix or by case must never read as the trusted one. An empty query matches
 * everything.
 */
export function searchContacts(contacts: readonly Contact[], query: string): Contact[] {
  const trimmed = query.trim();
  if (trimmed === '') return [...contacts];
  if (isAddressShaped(trimmed)) return contacts.filter(c => c.address === trimmed);
  const q = trimmed.toLowerCase();
  return contacts.filter(c => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q));
}

/**
 * The name split around the first case-insensitive match of the query, for `<mark>` (ix:7483): null when the name does
 * not contain it (an address match), or when lower-casing changed the name's length (no safe index to cut at).
 */
export function markParts(name: string, query: string): [string, string, string] | null {
  const q = query.trim();
  const lower = name.toLowerCase();
  if (q === '' || lower.length !== name.length) return null;
  const at = lower.indexOf(q.toLowerCase());
  if (at < 0) return null;
  return [name.slice(0, at), name.slice(at, at + q.length), name.slice(at + q.length)];
}

/**
 * The label wherever a contact names an address (O88) — #12, #20, #27 — with the "From your address book:" prefix, so a
 * name can never pose as "Your account: …" (spec §6.3, E17). Precedence own > treasury > contact is the caller's.
 */
export const fromBook = (name: string): string => `From your address book: ${name}`;

/** #31's "Address book" meta: "N contacts" (ix:13552); "1 contact" for one (the singular — O92, owner-confirmed 2026-10-08). */
export const contactsCount = (n: number): string => (n === 1 ? '1 contact' : `${n} contacts`);

/** #15's search overline (ix:7480): "N results for "q"", "1 result for "q"" (→ adapted singular, §6.1). */
export const resultsLine = (n: number, query: string): string => `${n} ${n === 1 ? 'result' : 'results'} for "${query.trim()}"`;
