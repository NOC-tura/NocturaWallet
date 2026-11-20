/**
 * TEST-ONLY: the REAL `react-native-ssl-pinning` JS wrapper (`node_modules/react-native-ssl-pinning/
 * index.js`) over a fake native module that calls back exactly as the library's Android source
 * does — the argument lists recorded from that source by
 * `scripts/a0-fixtures/record-ssl-pinning-callbacks.mjs` into
 * `__tests__/fixtures/rn-ssl-pinning-callbacks.json`. Never imported by app code.
 *
 * Why not `jest.requireActual`: the package ships ESM (`import … export {fetch}`) and is not in
 * jest.config's transform allow-list, and the root `__mocks__/react-native-ssl-pinning.ts` stands
 * in for it app-wide. Widening the allow-list would change the module graph of every suite; this
 * loader instead compiles the one file with Babel's CommonJS transform and evaluates it with its
 * two imports supplied: `react-native` → `{NativeModules: {RNSslPinning: native}}` and `q` → the
 * real `q` (the version the library resolves). Used as
 *
 *   jest.mock('react-native-ssl-pinning', () =>
 *     jest.requireActual<typeof import('../__testing__/realSslPinning')>('../__testing__/realSslPinning').loadRealSslPinning(),
 *   );
 *
 * after which `pinnedFetch` in that suite talks to the real wrapper. `setNativeCallback(args)`
 * picks the recorded argument list the fake native module answers the next calls with.
 */
import {transformSync} from '@babel/core';
import {readFileSync} from 'fs';
import {join} from 'path';

const LIB = join(__dirname, '../../../../node_modules/react-native-ssl-pinning');

type Callback = (...args: unknown[]) => void;

type Responder = (url: string, options: Record<string, unknown>) => unknown[];
const DEFAULT: Responder = () => [null, {status: 200, bodyString: '', headers: {}}];

/**
 * The fake native module's state lives on the global object, not in this module: a suite that
 * loads the app under another config in `jest.isolateModules` gets a fresh copy of this module from
 * the mock factory, and its responder must still be the one the test set.
 */
interface NativeState {
  responder: Responder;
  calls: Array<{url: string; options: Record<string, unknown>}>;
}
const KEY = '__nocturaRealSslPinningNative';
function state(): NativeState {
  const g = globalThis as unknown as Record<string, NativeState | undefined>;
  if (!g[KEY]) {
    g[KEY] = {responder: DEFAULT, calls: []};
  }
  return g[KEY]!;
}

/** The argument list the fake native module passes to the wrapper's callback (deep-copied per call). */
export function setNativeCallback(args: unknown[]): void {
  state().responder = () => args;
}

/** Per request: the argument list chosen from the URL / options (e.g. quote → 200, submit → 400). */
export function setNativeResponder(r: Responder): void {
  state().responder = r;
}

/** What the wrapper handed the native module (url + options, as the bridge would carry them). */
export function nativeCalls(): ReadonlyArray<{url: string; options: Record<string, unknown>}> {
  return state().calls;
}

export function resetNative(): void {
  state().calls = [];
  state().responder = DEFAULT;
}

const native = {
  fetch(url: string, options: Record<string, unknown>, callback: Callback): void {
    state().calls.push({url, options: JSON.parse(JSON.stringify(options)) as Record<string, unknown>});
    // the bridge delivers a copy (a WritableMap becomes a fresh plain object), asynchronously
    const args = JSON.parse(JSON.stringify(state().responder(url, options))) as unknown[];
    setTimeout(() => {
      try {
        callback(...args);
      } catch {
        // an exception inside the callback is the library's own (a null error argument): the promise
        // it was to settle stays pending. What React Native does with the exception on the phone
        // (its global handler; fatal in a release build?) is NOT replayed here.
      }
    }, 0);
  },
};

export function loadRealSslPinning(): Record<string, unknown> {
  const src = readFileSync(join(LIB, 'index.js'), 'utf8');
  const out = transformSync(src, {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    filename: 'react-native-ssl-pinning/index.js',
  });
  if (!out?.code) {
    throw new Error('realSslPinning: Babel produced no code');
  }
  const q = require(require.resolve('q', {paths: [LIB]})) as unknown;
  const shimRequire = (name: string): unknown => {
    if (name === 'react-native') {
      return {NativeModules: {RNSslPinning: native}};
    }
    if (name === 'q') {
      return q;
    }
    throw new Error(`realSslPinning: unexpected import ${name}`);
  };
  const module = {exports: {} as Record<string, unknown>};
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', out.code)(shimRequire, module, module.exports);
  if (typeof module.exports.fetch !== 'function') {
    throw new Error('realSslPinning: index.js did not export fetch');
  }
  return module.exports;
}
