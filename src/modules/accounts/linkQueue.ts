/**
 * post-M1d spec §4 (P3), R2, R3: the "linked" tag after a CONFIRMED Send between two accounts of this
 * seed. #21 hands the fresh-exit participants here on proof of confirmation; they are written to the
 * registry (`markA0AccountsLinked`) as soon as it is writable.
 *
 * THE QUEUE is held in memory and also stored in the ENCRYPTED MMKV whenever that store is open (a
 * list of one's own accounts is itself a link — never the public instance). A locked store throws
 * (`accountRegistry.ts` `storage`), so the queue never relies on it.
 *
 * A DRAIN needs the encrypted store open and the registry readable; otherwise the queue stays. Per
 * address, by its role in the registry now: `fresh-exit` → marked, removed; `fresh-pending` → stays
 * (the record forbids the mark on a reservation; it is applied when the entry is promoted, R3);
 * `main`, or not in the registry (a released reservation) → dropped. Drains run after unlock, when
 * the Accounts sheet opens, after every confirmed Send, and when a reservation is promoted.
 *
 * CLEARED with the wallet: the reset hook empties the memory queue (a new encrypted instance, or a
 * wipe); the wipe removes the stored one. If the process dies while the store is locked the tag is
 * lost — accepted (R2): the copy never claims "not linked", and PR 2's scan recovers it.
 *
 * Nothing here throws: the Send it follows already succeeded.
 */
import type {MMKV} from 'react-native-mmkv';
import {mmkvSecure, onSecureMmkvReset} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {loadA0AccountRegistry, markA0AccountsLinked, onA0AccountPromoted} from '../shielded/a0/accountRegistry';

const KEY = MMKV_KEYS.ACCOUNTS_LINK_PENDING;

let memory = new Set<string>();
let hooked = false;

/** Registered on first use, not at import: a screen test that stubs `instances` loads this module too. */
function hook(): void {
  if (hooked) {
    return;
  }
  hooked = true;
  onSecureMmkvReset(() => {
    memory = new Set();
  });
  onA0AccountPromoted(() => {
    drainLinkQueue();
  });
}

function readStored(store: MMKV): string[] {
  const raw = store.getString(KEY);
  if (raw === undefined) {
    return [];
  }
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : [];
  } catch {
    return []; // a malformed record is no queue: it is rewritten by the next write
  }
}

function writeStored(store: MMKV, addresses: readonly string[]): void {
  if (addresses.length === 0) {
    store.remove(KEY);
  } else {
    store.set(KEY, JSON.stringify(addresses));
  }
}

function drain(): number {
  hook();
  const store = mmkvSecure();
  if (store === null) {
    return 0; // locked: the memory queue waits
  }
  const queued = [...new Set([...memory, ...readStored(store)])];
  if (queued.length === 0) {
    if (store.getString(KEY) !== undefined) {
      store.remove(KEY); // a malformed or empty record
    }
    return 0;
  }
  // whatever follows, both copies hold the whole queue: a failure below loses nothing
  memory = new Set(queued);
  writeStored(store, queued);
  const entries = loadA0AccountRegistry({bound: store}); // throws when the record is corrupt: the queue stays
  const roleOf = new Map((entries ?? []).map(e => [e.address, e.role]));
  const exits = queued.filter(a => roleOf.get(a) === 'fresh-exit');
  const waiting = queued.filter(a => roleOf.get(a) === 'fresh-pending'); // R3
  const changed = exits.length > 0 ? markA0AccountsLinked(exits, {bound: store}) : 0; // throws: the queue stays
  memory = new Set(waiting);
  writeStored(store, waiting);
  return changed;
}

/** Apply every queued address the registry can take now; the number of entries newly marked. Never throws. */
export function drainLinkQueue(): number {
  try {
    return drain();
  } catch {
    return 0;
  }
}

/** Add addresses to the queue (memory, and the encrypted store when it is open). Writes no tag. Never throws. */
export function queueLinkedAccounts(addresses: readonly string[]): void {
  try {
    hook();
    for (const a of addresses) {
      memory.add(a);
    }
    const store = mmkvSecure();
    if (store !== null && addresses.length > 0) {
      writeStored(store, [...new Set([...memory, ...readStored(store)])]);
    }
  } catch {
    // the memory queue holds them
  }
}

/** #21, on proof of confirmation: queue the Send's fresh-exit participants, then drain. Never throws. */
export function recordConfirmedSendLinks(addresses: readonly string[]): number {
  if (addresses.length === 0) {
    return 0;
  }
  queueLinkedAccounts(addresses);
  return drainLinkQueue();
}

/** What is waiting: the memory queue, plus the stored one when the encrypted store is open. */
export function pendingLinkedAccounts(): string[] {
  try {
    const store = mmkvSecure();
    return [...new Set([...memory, ...(store !== null ? readStored(store) : [])])];
  } catch {
    return [...memory];
  }
}
