/**
 * TEST-ONLY: a fake `NativeModules.RNSslPinning` for `pinnedFetchDirect` (spec M1c Task 1 review
 * I1 — the transport must not depend on the npm package's buggy `index.js` wrapper, so it calls
 * the native module directly). Driven by the SAME recorded argument lists
 * (`__tests__/fixtures/rn-ssl-pinning-callbacks.json`) that `realSslPinning.ts` replays through the
 * installed library's own wrapper — those lists are what the NATIVE side invokes its callback
 * with, independent of which JS sits on top of it, so the same fixture proves both paths.
 *
 * Wired in with `pinnedFetch.ts`'s `__setRNSslPinningNativeForTests`, never with
 * `jest.mock('react-native-ssl-pinning', …)`: `pinnedFetchDirect` never imports that package.
 *
 * Unlike `realSslPinning.ts`'s fake, this one does NOT swallow an exception thrown inside the
 * callback. `pinnedFetchDirect`'s own callback (`nativeFetch` in `pinnedFetch.ts`) must never
 * throw — every branch resolves or rejects after checking its shape — and if a future regression
 * ever reintroduced a throw, this fake lets it surface loudly (an uncaught exception) rather than
 * hide it behind a promise that silently never settles, which is the exact failure mode being
 * fixed.
 */
type Callback = (...args: unknown[]) => void;
type Responder = (url: string, options: Record<string, unknown>) => unknown[];
const DEFAULT: Responder = () => [null, {status: 200, bodyString: '', headers: {}}];

export interface FakeRNSslPinningNative {
  fetch(url: string, options: Record<string, unknown>, callback: Callback): void;
}

let responder: Responder = DEFAULT;
let calls: Array<{url: string; options: Record<string, unknown>}> = [];

export const fakeRNSslPinningNative: FakeRNSslPinningNative = {
  fetch(url, options, callback) {
    calls.push({url, options: JSON.parse(JSON.stringify(options)) as Record<string, unknown>});
    // the bridge delivers a copy, asynchronously, exactly as `realSslPinning.ts`'s fake does
    const args = JSON.parse(JSON.stringify(responder(url, options))) as unknown[];
    setTimeout(() => callback(...args), 0);
  },
};

/** The argument list the fake invokes the callback with for every subsequent call. */
export function setFakeNativeCallback(args: unknown[]): void {
  responder = () => args;
}

/** Per request: the argument list chosen from the URL / options (e.g. quote → 200, submit → 400). */
export function setFakeNativeResponder(r: Responder): void {
  responder = r;
}

/** What was handed to `fetch` (url + options, as the bridge would carry them). */
export function fakeNativeCalls(): ReadonlyArray<{url: string; options: Record<string, unknown>}> {
  return calls;
}

export function resetFakeNative(): void {
  calls = [];
  responder = DEFAULT;
}
