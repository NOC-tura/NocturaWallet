import type {MMKV, Configuration} from 'react-native-mmkv';

const stores = new Map<string, Map<string, string>>();

function createMockMMKV(config?: Configuration): MMKV {
  const id = config?.id ?? 'mmkv.default';
  if (!stores.has(id)) stores.set(id, new Map());
  const store = stores.get(id)!;

  return {
    id,
    length: 0,
    size: 0,
    byteSize: 0,
    isReadOnly: false,
    isEncrypted: config?.encryptionKey != null,

    getString(key: string): string | undefined {
      return store.get(key);
    },

    set(key: string, value: boolean | string | number | ArrayBuffer): void {
      store.set(key, String(value));
    },

    getBoolean(key: string): boolean | undefined {
      const v = store.get(key);
      if (v === undefined) return undefined;
      return v === 'true';
    },

    getNumber(key: string): number | undefined {
      const v = store.get(key);
      if (v === undefined) return undefined;
      return Number(v);
    },

    getBuffer(_key: string): ArrayBuffer | undefined {
      return undefined;
    },

    remove(key: string): boolean {
      return store.delete(key);
    },

    contains(key: string): boolean {
      return store.has(key);
    },

    getAllKeys(): string[] {
      return Array.from(store.keys());
    },

    clearAll(): void {
      store.clear();
    },

    recrypt(_key: string | undefined): void {},
    encrypt(_key: string): void {},
    decrypt(): void {},
    trim(): void {},

    addOnValueChangedListener(_cb: (key: string) => void) {
      return {remove: () => {}};
    },

    importAllFrom(_other: MMKV): number {
      return 0;
    },

    // HybridObject stubs
    getNativeState() {
      return {};
    },
    dispose() {},
    name: 'MockMMKV',
    equals(_other: unknown): boolean {
      return false;
    },
  } as unknown as MMKV;
}

export const createMMKV = createMockMMKV;
