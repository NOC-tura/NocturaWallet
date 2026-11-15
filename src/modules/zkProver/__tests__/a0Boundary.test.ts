/**
 * The JS ↔ native boundary of the A0 core (spec §3 "JNI surface", §14 "Boundary", INV-NK,
 * INV-NULL): what JS can call, read three ways —
 *  1. the bridge module's runtime exports, exactly;
 *  2. the native methods the bridge touches when every export is called, exactly — recorded by a
 *     Proxy standing in for NativeModules.NocturaProver;
 *  3. the @ReactMethod set of NocturaProverModule.kt and the `external fun`s, read from the
 *     Kotlin source and held to native/noctura-prover/jni-exports.txt (the JVM test
 *     ReactSurfaceTest reads the same off the compiled classes; this one runs in CI's jest).
 * Each reading has a negative control: the same reader on an input that has one name too many.
 */
import * as fs from 'fs';
import * as path from 'path';

const mockTouched = new Set<string>();
jest.mock('react-native', () => {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop) {
      if (typeof prop === 'string') {
        mockTouched.add(prop);
      }
      return (...args: unknown[]) => {
        // keysOpen must receive a plain number[] (never a string, never the Uint8Array)
        if (prop === 'keysOpen' && !Array.isArray(args[0])) {
          throw new Error('keysOpen got a non-array seed');
        }
        return prop === 'isSupported' ? true : Promise.resolve(prop === 'matchSpent' ? [] : '1');
      };
    },
  };
  return {NativeModules: {NocturaProver: new Proxy({}, handler)}};
});

import * as bridge from '../nativeProverBridge';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');

const EXPECTED_EXPORTS = [
  'a0Commitment',
  'a0DepositRho',
  'a0KeysClose',
  'a0KeysOpen',
  'a0MatchSpent',
  'a0Prove',
  'isProverSupported',
  'nativeProve', // v1 — removed with the v1 path in M1b
];
const EXPECTED_REACT_METHODS = [
  'commitment',
  'depositRho',
  'isSupported',
  'keysClose',
  'keysOpen',
  'matchSpent',
  'prove',
  'proveV1', // v1 — removed in M1b
];
const KOTLIN_ONLY = ['authorizeUnshield', 'parseUnshield'];

function exportsOf(mod: Record<string, unknown>): string[] {
  return Object.keys(mod).sort();
}

/** `@ReactMethod` (with or without arguments) followed by `fun <name>`. */
function reactMethodsIn(kotlin: string): string[] {
  const out = new Set<string>();
  const re = /@ReactMethod(?:\([^)]*\))?\s+(?:(?:override|internal|public)\s+)*fun\s+(\w+)/g;
  for (const m of kotlin.matchAll(re)) {
    out.add(m[1]);
  }
  return [...out].sort();
}
/** Every `fun <name>` declared, annotated or not. */
function funsIn(kotlin: string): string[] {
  return [...kotlin.matchAll(/\bfun\s+(\w+)\s*\(/g)].map(m => m[1]);
}
/** `external fun <name>` → its JNI symbol, for the given class. */
function nativesIn(kotlin: string, cls: string): string[] {
  return [...kotlin.matchAll(/\bexternal\s+fun\s+(\w+)/g)].map(
    m => `Java_com_nocturawallet_prover_${cls}_${m[1]}`,
  );
}
function jniList(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '' && !l.startsWith('#'))
    .sort();
}

const MODULE_KT = 'android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt';
const NATIVE_KT = 'android/app/src/main/java/com/nocturawallet/prover/NocturaA0Native.kt';

describe('1. the bridge module exports exactly the bound surface', () => {
  it('runtime exports', () => {
    expect(exportsOf(bridge)).toEqual(EXPECTED_EXPORTS);
  });
  it('negative control: one export more is seen', () => {
    const leaky = {...bridge, a0Nullifier: () => '00'};
    expect(exportsOf(leaky)).not.toEqual(EXPECTED_EXPORTS);
  });
  it('no export is named after a secret or an own nullifier', () => {
    for (const name of exportsOf(bridge)) {
      expect(name).not.toMatch(/sk|spend|nk|ivk|dSelf|addrField|nullifier|viewKey|seed/i);
    }
  });
});

describe('2. calling every export touches exactly the React methods JS may use', () => {
  it('records the native methods reached', async () => {
    mockTouched.clear();
    const h = '1' as bridge.A0Handle;
    bridge.isProverSupported();
    await bridge.nativeProve('deposit', '{}', '/z', '/w');
    await bridge.a0KeysOpen(new Uint8Array(64));
    await bridge.a0KeysClose(h);
    await bridge.a0DepositRho(h, 0n);
    await bridge.a0MatchSpent(h, [], []);
    await bridge.a0Commitment(h, 1n, '00'.repeat(32));
    await bridge.a0Prove(h, 'deposit', '{}', null, '/z', '/w');
    expect([...mockTouched].sort()).toEqual(EXPECTED_REACT_METHODS);
    for (const k of KOTLIN_ONLY) {
      expect(mockTouched.has(k)).toBe(false);
    }
  });
  it('covers every export (a new export must be added to the call list above)', () => {
    expect(exportsOf(bridge).length).toBe(8);
  });
});

describe('3. the Kotlin module', () => {
  const kt = read(MODULE_KT);
  it('its @ReactMethods are exactly the surface; parseUnshield / authorizeUnshield are not among them', () => {
    expect(reactMethodsIn(kt)).toEqual(EXPECTED_REACT_METHODS);
    for (const k of KOTLIN_ONLY) {
      expect(funsIn(kt)).toContain(k);
    }
  });
  it('negative control: an annotated parseUnshield is seen', () => {
    const leaky = kt.replace(/(\n\s*)(internal fun parseUnshield)/, '$1@ReactMethod$1$2');
    expect(leaky).not.toBe(kt);
    expect(reactMethodsIn(leaky)).toContain('parseUnshield');
    expect(reactMethodsIn(leaky)).not.toEqual(EXPECTED_REACT_METHODS);
  });
  it('the Kotlin natives are exactly native/noctura-prover/jni-exports.txt', () => {
    const natives = [
      ...nativesIn(read(NATIVE_KT), 'NocturaA0Native'),
      ...nativesIn(kt, 'NocturaProverModule'),
    ].sort();
    const list = jniList(read('native/noctura-prover/jni-exports.txt'));
    expect(list.length).toBe(10);
    expect(natives).toEqual(list);
    // negative control: a list with one symbol more does not match
    expect(natives).not.toEqual([...list, 'Java_com_nocturawallet_prover_NocturaA0Native_nullifier'].sort());
  });
});
