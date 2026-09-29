/**
 * The only file that touches `chrome.*` / `browser.*`. Everything else takes an `Ext`, so the
 * background's logic is tested in Node against an in-memory fake, and Chrome's and Firefox's
 * namespaces differ in one place only.
 */
export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface Ext {
  runtimeId: string;
  extensionOrigin: string;
  session: KV;
  local: KV;
  alarms: {create(name: string, o: {delayInMinutes: number}): Promise<void> | void; clear(name: string): Promise<boolean>};
  windowCount(): Promise<number>;
  /** Restrict storage.session to trusted (extension) contexts where the browser supports it. */
  pinSessionAccess(): Promise<void>;
}

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}
// Chrome only (102+); Firefox has no storage.session.setAccessLevel.
interface SessionArea extends StorageArea {
  setAccessLevel?(o: {accessLevel: 'TRUSTED_CONTEXTS' | 'TRUSTED_AND_UNTRUSTED_CONTEXTS'}): Promise<void>;
}
interface BrowserLike {
  runtime: {id: string; getURL(path: string): string};
  storage: {session: SessionArea; local: StorageArea};
  alarms: {create(name: string, o: {delayInMinutes: number}): Promise<void> | void; clear(name: string): Promise<boolean>};
  windows: {getAll(): Promise<unknown[]>};
}

function kv(area: StorageArea): KV {
  return {
    get: async key => (await area.get(key))[key],
    set: (key, value) => area.set({[key]: value}),
    remove: key => area.remove(key),
    clear: () => area.clear(),
  };
}

/**
 * Builds the extension's own origin from `protocol` + `host` (not the `.origin` getter — see
 * messages.ts `pagePath` for why), then fails closed by cross-checking that value against what
 * the runtime's own URL parser computes as `.origin` for the same URL. In a real Chrome or
 * Firefox, an extension-scheme URL DOES get a proper web-exposed origin (Chrome registers
 * `chrome-extension:` as a standard scheme; Firefox's `moz-extension:` carries
 * URI_HAS_WEB_EXPOSED_ORIGIN), so the two values should always agree there. If they don't —
 * including the degenerate case where `.origin` comes back as the literal string `"null"`, which
 * is what a URL implementation that does NOT special-case the extension's own scheme returns —
 * refuse to start rather than silently run every origin comparison in this codebase (isOwnPage,
 * pagePath) against a value that cannot be trusted.
 */
export function deriveExtensionOrigin(url: string): string {
  const u = new URL(url);
  const origin = `${u.protocol}//${u.host}`;
  if (origin === 'null' || u.origin !== origin) {
    throw new Error(`extension origin is not web-exposed: derived ${origin}, url.origin was ${u.origin}`);
  }
  return origin;
}

function extensionApi(): BrowserLike {
  const g = globalThis as unknown as {browser?: BrowserLike; chrome?: BrowserLike};
  const b = g.browser ?? g.chrome;
  if (!b) throw new Error('not running in an extension');
  return b;
}

export function browserExt(): Ext {
  const b = extensionApi();
  return {
    runtimeId: b.runtime.id,
    extensionOrigin: deriveExtensionOrigin(b.runtime.getURL('')),
    session: kv(b.storage.session),
    local: kv(b.storage.local),
    alarms: b.alarms,
    windowCount: async () => (await b.windows.getAll()).length,
    // TRUSTED_CONTEXTS is Chrome's default today; pinning it means a future default (or another
    // piece of code) cannot open the signing keys to content scripts. Where the API is absent
    // (Firefox), there is nothing to pin and the call is a no-op.
    pinSessionAccess: async () => {
      if (typeof b.storage.session.setAccessLevel === 'function') await b.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
    },
  };
}
