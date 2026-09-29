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

export function fakeExt(windows = 1) {
  const alarms = new Map<string, number>();
  const ext: Ext & {alarmsSet: Map<string, number>; windows: number} = {
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
    alarmsSet: alarms,
    windows,
  };
  return ext;
}
