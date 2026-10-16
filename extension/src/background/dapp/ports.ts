import type {Ext} from '../../ext';
import type {Entry} from './store';

/**
 * The PAGE partition's ports (spec §1.3, §1.4, C9, C16). The relay holds one `runtime.connect({name: 'noctura-page'})`
 * port per document; results and events travel on it. The registry lives in memory — a service worker that stops
 * loses it, the relay reconnects and sends `page.resume` (§1.5), and nothing here treats "port disconnected" as
 * "request cancelled".
 */
export const PAGE_PORT = 'noctura-page';

/** What the browser reports about a port's or a message's sender (runtime.MessageSender). */
export interface PageSenderInfo {
  id?: string;
  origin?: string;
  url?: string;
  tab?: unknown;
  frameId?: number;
  documentId?: string;
  documentLifecycle?: string;
}

export interface PortLike {
  name: string;
  sender?: PageSenderInfo;
  postMessage(m: unknown): void;
  disconnect(): void;
  onMessage: {addListener(cb: (m: unknown) => void): void};
  onDisconnect: {addListener(cb: () => void): void};
}

/** A sender the origin rule accepted: everything keyed from the browser's report, never from what the page sends. */
export interface PageOrigin {
  tabId: number;
  /** Exactly sender.origin (C8): scheme + ASCII / punycode host + port. */
  origin: string;
  /** The origin's host (lower-case ASCII / punycode as the browser reports it). */
  host: string;
  documentId: string | null;
}

/**
 * The origin rule, for messages and for ports alike (§1.3; B1 §3, review M3, C16): this extension's own content
 * script (`sender.id`), in a tab, in the top frame, from an `https:` origin, of an active document where the browser
 * reports the lifecycle. Opaque and `null` origins and trailing-dot hosts are refused, and `sender.url` is never read (no fallback). The
 * store build accepts no `http://localhost` (the dev-origin gate). Null: refused.
 */
export function pageOrigin(ext: Pick<Ext, 'runtimeId'>, s: PageSenderInfo | undefined): PageOrigin | null {
  if (s === undefined || s.id !== ext.runtimeId) return null;
  const tabId = typeof s.tab === 'object' && s.tab !== null ? (s.tab as {id?: unknown}).id : undefined;
  if (typeof tabId !== 'number' || !Number.isSafeInteger(tabId) || tabId < 0) return null;
  if (s.frameId !== 0) return null;
  if (s.documentLifecycle !== undefined && s.documentLifecycle !== 'active') return null;
  if (typeof s.origin !== 'string') return null;
  let u: URL;
  try {
    u = new URL(s.origin);
  } catch {
    return null;
  }
  // Exactly an origin, as the browser serialises one: no path, no credentials, nothing the parser had to repair.
  if (u.protocol !== 'https:' || u.hostname === '' || `${u.protocol}//${u.host}` !== s.origin) return null;
  // Final review I3: a trailing-dot FQDN (`dapp.test.`) is a distinct origin to the browser but the same site; blocks,
  // cooldowns and C3's per-host cap all key on the host string, so it would sidestep each. Refused, not normalised.
  if (u.hostname.endsWith('.')) return null;
  return {tabId, origin: s.origin, host: u.hostname, documentId: typeof s.documentId === 'string' ? s.documentId : null};
}

export interface LivePort extends PageOrigin {
  port: PortLike;
}

/** The ports of one background instance, and its instance id (C17: a `deciding` entry of another instance is a restart). */
export interface Runtime {
  instance: string;
  ports: Set<LivePort>;
  /**
   * §2.4: the unlock hook ran for the current unlocked session in this instance. In memory, not in storage.session (a
   * lock leaves nothing behind there but the answered queue): a lock clears it; a worker restart runs the hook again at
   * its first queue access, which is harmless — it answers only what is still queued and repeats a `change` the pages
   * already have.
   */
  hooked: boolean;
  /** B1c-2: the requests whose simulation is running in this instance (signTx.ts) — one at a time per request. */
  simulating: Set<string>;
}

const runtimes = new WeakMap<Pick<Ext, 'runtimeId'>, Runtime>();

function randomHex(n: number): string {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
}

/** This background instance's runtime for `ext` (one per service-worker start). */
export function runtimeFor(ext: Pick<Ext, 'runtimeId'>): Runtime {
  let r = runtimes.get(ext);
  if (r === undefined) {
    r = {instance: randomHex(16), ports: new Set(), hooked: false, simulating: new Set()};
    runtimes.set(ext, r);
  }
  return r;
}

/**
 * A service-worker restart, as the unit tests model one: the ports and the instance id are gone (storage is not). Only
 * tests call it; a real restart starts a fresh module.
 */
export function restartRuntime(ext: Pick<Ext, 'runtimeId'>): void {
  runtimes.delete(ext);
}

/** Posts, ignoring a port that died meanwhile (its onDisconnect removes it). */
function post(p: LivePort, m: unknown): void {
  try {
    p.port.postMessage(m);
  } catch {
    // Disconnected: the relay resumes.
  }
}

const owns = (p: PageOrigin, e: Pick<Entry, 'tabId' | 'origin'>): boolean => p.tabId === e.tabId && p.origin === e.origin;

/**
 * §1.5 step 3: every answered entry, on every live port keyed to its (tabId, origin). Fix round 4, controller ruling:
 * a mismatch notice's answer (its dismissal, its C4 timeout, a lock's rejection) is never posted to any port — the
 * page was answered `unauthorized` inline, and the relay's request-id filter must not be the only thing keeping the
 * notice's existence (and so "X is this wallet's, granted elsewhere") off the page's port.
 */
export function deliver(ext: Pick<Ext, 'runtimeId'>, entries: readonly Entry[]): void {
  for (const e of entries) {
    if (e.answer === null || e.type === 'mismatch') continue;
    for (const p of runtimeFor(ext).ports) if (owns(p, e)) post(p, {requestId: e.requestId, ...e.answer});
  }
}

/** `change {accounts}` to every live port of these origins (review M3: callers name only origins that held a grant). */
export function sendChange(ext: Pick<Ext, 'runtimeId'>, changes: ReadonlyMap<string, readonly string[]>): void {
  for (const p of runtimeFor(ext).ports) {
    const accounts = changes.get(p.origin);
    if (accounts !== undefined) post(p, {event: 'change', accounts: [...accounts]});
  }
}

/** The origins of the live ports (the lock hook's "open ports"). */
export function liveOrigins(ext: Pick<Ext, 'runtimeId'>): Set<string> {
  return new Set([...runtimeFor(ext).ports].map(p => p.origin));
}

export {owns};
