/**
 * The only file that touches `chrome.*` / `browser.*`. Everything else takes an `Ext`, so the
 * background's logic is tested in Node against an in-memory fake, and Chrome's and Firefox's
 * namespaces differ in one place only.
 */
export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface Ext {
  runtimeId: string;
  extensionOrigin: string;
  session: KV;
  local: KV;
  alarms: {create(name: string, o: {delayInMinutes: number}): void; clear(name: string): Promise<boolean>};
  windowCount(): Promise<number>;
}

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}
interface BrowserLike {
  runtime: {id: string; getURL(path: string): string};
  storage: {session: StorageArea; local: StorageArea};
  alarms: {create(name: string, o: {delayInMinutes: number}): void; clear(name: string): Promise<boolean>};
  windows: {getAll(): Promise<unknown[]>};
}

function kv(area: StorageArea): KV {
  return {
    get: async key => (await area.get(key))[key],
    set: (key, value) => area.set({[key]: value}),
    remove: key => area.remove(key),
  };
}

export function browserExt(): Ext {
  const g = globalThis as unknown as {browser?: BrowserLike; chrome?: BrowserLike};
  const b = g.browser ?? g.chrome;
  if (!b) throw new Error('not running in an extension');
  return {
    runtimeId: b.runtime.id,
    extensionOrigin: new URL(b.runtime.getURL('')).origin,
    session: kv(b.storage.session),
    local: kv(b.storage.local),
    alarms: b.alarms,
    windowCount: async () => (await b.windows.getAll()).length,
  };
}
