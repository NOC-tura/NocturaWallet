import type {Ext, KV} from '../../ext';

export function memKV(): KV & {data: Map<string, unknown>} {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async k => data.get(k),
    set: async (k, v) => {
      // Chrome serialises storage as JSON: store what a real browser would give back.
      data.set(k, JSON.parse(JSON.stringify(v)));
    },
    remove: async k => {
      data.delete(k);
    },
    clear: async () => {
      data.clear();
    },
  };
}

/**
 * B1c: the approval windows the background opened. `failNext` makes the next create reject; `open` is the set a
 * windows.get would find; `created` and `removed` record every call.
 */
export interface FakeWindows {
  created: {page: string; width: number; height: number; focused: boolean}[];
  removed: number[];
  open: Set<number>;
  failNext: boolean;
  /** Holds every create until the returned function is called (a create in flight). */
  hold(): () => void;
}

function fakeWindows(): FakeWindows & {api: Ext['dappWindows']} {
  let next = 100;
  let gate: Promise<void> | null = null;
  const w: FakeWindows & {api: Ext['dappWindows']} = {
    created: [],
    removed: [],
    open: new Set(),
    failNext: false,
    hold() {
      let release = () => undefined as void;
      gate = new Promise<void>(r => (release = r));
      return () => {
        gate = null;
        release();
      };
    },
    api: {
      create: async o => {
        if (gate !== null) await gate;
        if (w.failNext) {
          w.failNext = false;
          throw new Error('windows.create failed');
        }
        w.created.push(o);
        const id = next++;
        w.open.add(id);
        return id;
      },
      exists: async id => w.open.has(id),
      remove: async id => {
        w.removed.push(id);
        if (!w.open.delete(id)) throw new Error(`no window with id: ${id}`);
      },
    },
  };
  return w;
}

export function fakeExt(windows = 1) {
  const alarms = new Map<string, number>();
  const win = fakeWindows();
  const ext: Ext & {alarmsSet: Map<string, number>; windows: number; approval: FakeWindows} = {
    runtimeId: 'abcdefghijklmnopabcdefghijklmnop',
    extensionOrigin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
    session: memKV(),
    local: memKV(),
    alarms: {
      create: (name, o) => {
        alarms.set(name, o.delayInMinutes);
      },
      clear: async name => alarms.delete(name),
    },
    windowCount: async () => ext.windows,
    pinSessionAccess: async () => undefined,
    dappWindows: win.api,
    alarmsSet: alarms,
    windows,
    approval: win,
  };
  return ext;
}
