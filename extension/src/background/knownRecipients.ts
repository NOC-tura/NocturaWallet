import type {Ext} from '../ext';
import {createMutex} from './mutex';

/**
 * Addresses this wallet has sent to (a send confirmed on chain), for the "first send to a new
 * address" re-authentication trigger. storage.local, written only by the background.
 */
export const KNOWN_RECIPIENTS_KEY = 'v1_known_recipients';
export const MAX_KNOWN_RECIPIENTS = 1000;

const serial = createMutex();

async function load(ext: Ext): Promise<string[]> {
  const v = await ext.local.get(KNOWN_RECIPIENTS_KEY);
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

export async function knownRecipients(ext: Ext): Promise<Set<string>> {
  return new Set(await load(ext));
}

export async function addKnownRecipient(ext: Ext, address: string): Promise<void> {
  await serial(async () => {
    const list = (await load(ext)).filter(a => a !== address);
    list.push(address);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, list.slice(-MAX_KNOWN_RECIPIENTS));
  });
}
