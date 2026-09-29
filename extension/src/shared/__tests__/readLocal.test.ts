import {readLocal} from '../readLocal';
import * as readLocalModule from '../readLocal';

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

describe('readLocal module', () => {
  it('exports readLocal and nothing else — no writer', () => {
    expect(Object.keys(readLocalModule)).toEqual(['readLocal']);
  });
});
