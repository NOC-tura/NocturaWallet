import {browserExt, deriveExtensionOrigin, readLocal} from '../ext';
import * as extModule from '../ext';

describe('deriveExtensionOrigin', () => {
  it('returns protocol+host for a URL whose origin the parser actually computes', () => {
    expect(deriveExtensionOrigin('https://wallet.noc-tura.io/unlock.html')).toBe('https://wallet.noc-tura.io');
  });

  it('throws on a scheme this parser gives a "null" origin to — fail closed rather than trust it', () => {
    // Real Chrome/Firefox compute a proper web-exposed origin for their own extension scheme
    // (Chrome registers chrome-extension: as standard; Firefox's moz-extension: carries
    // URI_HAS_WEB_EXPOSED_ORIGIN), but Node's URL implementation — this test environment — does
    // not know the scheme and reports the literal string "null" for `.origin`. That mismatch is
    // exactly the case this function must refuse to paper over.
    expect(() => deriveExtensionOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnop/')).toThrow();
  });
});

describe('readLocal (the vault page\'s one storage call)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads one key from storage.local and nothing from storage.session', async () => {
    const asked: string[] = [];
    const area = (name: string, data: Record<string, unknown>) => ({
      get: async (k: string) => (asked.push(`${name}:${k}`), {[k]: data[k]}),
    });
    vi.stubGlobal('chrome', {storage: {local: area('local', {v1_vault: {v: 1}}), session: area('session', {v1_vault: 'no'})}});
    expect(await readLocal('v1_vault')).toEqual({v: 1});
    expect(await readLocal('missing')).toBeUndefined();
    expect(asked).toEqual(['local:v1_vault', 'local:missing']);
  });

  it('prefers browser.* over chrome.* and throws outside an extension', async () => {
    vi.stubGlobal('browser', {storage: {local: {get: async (k: string) => ({[k]: 'firefox'})}}});
    vi.stubGlobal('chrome', {storage: {local: {get: async (k: string) => ({[k]: 'chrome'})}}});
    expect(await readLocal('x')).toBe('firefox');
    vi.unstubAllGlobals();
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    await expect(readLocal('x')).rejects.toThrow('not running in an extension');
  });
});

// Fable review (Minor 10): pin storage.session to trusted contexts where the browser lets us
// (Chrome); Firefox has no setAccessLevel, and there the call is a no-op.
describe('pinSessionAccess', () => {
  afterEach(() => vi.unstubAllGlobals());
  const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
  const fake = (session: object) => ({
    runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`},
    storage: {session, local: area()},
    alarms: {create: () => undefined, clear: async () => true},
    windows: {getAll: async () => []},
  });

  it('sets the session area to TRUSTED_CONTEXTS where setAccessLevel exists', async () => {
    const calls: unknown[] = [];
    vi.stubGlobal('chrome', fake({...area(), setAccessLevel: async (o: unknown) => void calls.push(o)}));
    await browserExt().pinSessionAccess();
    expect(calls).toEqual([{accessLevel: 'TRUSTED_CONTEXTS'}]);
  });

  it('is a no-op where the API is absent (Firefox)', async () => {
    vi.stubGlobal('browser', fake(area()));
    await expect(browserExt().pinSessionAccess()).resolves.toBeUndefined();
  });
});

describe('the vault page has no storage writer (B1b-1 ruling: the background is the one writer of v1_vault)', () => {
  it('ext.ts exports readLocal and no other plain storage function', () => {
    expect(Object.keys(extModule).sort()).toEqual(['browserExt', 'deriveExtensionOrigin', 'readLocal']);
  });
});
