import type {Ext} from '../ext';
import {createMutex} from './mutex';

/**
 * Addresses this wallet has sent to (a send confirmed on chain), for the "first send to a new
 * address" re-authentication trigger. storage.local, written only by the background. Since B1b-2a
 * (E6) each entry is `{address, at}` — `at` the confirmation time, for #12's "sent before · last N
 * days ago". An entry stored as a plain string (the B1b-1 format) reads as `{address, at: null}`:
 * still known, with no date, so no migration is needed.
 */
export const KNOWN_RECIPIENTS_KEY = 'v1_known_recipients';
export const MAX_KNOWN_RECIPIENTS = 1000;

export interface KnownRecipient {
  address: string;
  at: number | null;
}

const serial = createMutex();

function entryOf(x: unknown): KnownRecipient | null {
  if (typeof x === 'string') return {address: x, at: null};
  if (typeof x !== 'object' || x === null) return null;
  const {address, at} = x as {address?: unknown; at?: unknown};
  if (typeof address !== 'string') return null;
  return {address, at: typeof at === 'number' && Number.isSafeInteger(at) && at >= 0 ? at : null};
}

async function load(ext: Ext): Promise<KnownRecipient[]> {
  const v = await ext.local.get(KNOWN_RECIPIENTS_KEY);
  if (!Array.isArray(v)) return [];
  const out: KnownRecipient[] = [];
  for (const x of v as unknown[]) {
    const e = entryOf(x);
    if (e !== null) out.push(e);
  }
  return out;
}

export async function knownRecipients(ext: Ext): Promise<Set<string>> {
  return new Set((await load(ext)).map(e => e.address));
}

/** When a send to this address last confirmed; null when never, or when only the B1b-1 format knows it. */
export async function lastSentAt(ext: Ext, address: string): Promise<number | null> {
  let at: number | null = null;
  for (const e of await load(ext)) if (e.address === address) at = e.at;
  return at;
}

/**
 * The one rule for "known" (E6): one of the session's accounts, or an address a send has confirmed
 * to. prepareSend's `first-send` reason and wallet.recipientInfo both call this, so #12's hint and
 * #19/#20's reason cannot disagree.
 */
export async function isKnownRecipient(ext: Ext, session: readonly {publicKey: string}[], recipient: string): Promise<boolean> {
  return session.some(a => a.publicKey === recipient) || (await knownRecipients(ext)).has(recipient);
}

export async function addKnownRecipient(ext: Ext, address: string, at: number): Promise<void> {
  await serial(async () => {
    const list = (await load(ext)).filter(e => e.address !== address);
    list.push({address, at});
    await ext.local.set(KNOWN_RECIPIENTS_KEY, list.slice(-MAX_KNOWN_RECIPIENTS));
  });
}
