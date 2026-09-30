import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Spec §6.5: Solscan is the ONLY external link. Over every file of src/app (tests aside): an href is a
// Solscan URL built by explorer.ts or absent; nothing calls window.open; tabs.create is reached only
// through platform.ts, whose targets are a closed list of extension pages.
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap(e => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return e === '__tests__' ? [] : files(p);
    return /\.(ts|tsx)$/.test(e) ? [p] : [];
  });
}

describe('links out of the UI', () => {
  const sources = files(APP).map(p => ({path: relative(APP, p), text: readFileSync(p, 'utf8')}));

  it('reads the real tree (positive control)', () => {
    expect(sources.map(s => s.path)).toEqual(expect.arrayContaining(['explorer.ts', 'platform.ts', 'screens/TxDetail.tsx']));
  });

  it('no URL but Solscan’s and the extension’s own pages', () => {
    for (const {path, text} of sources) {
      for (const m of text.matchAll(/https?:\/\/[^\s'"`)]+/g)) expect(`${path}: ${m[0]}`).toBe(`${path}: https://solscan.io/tx/`);
    }
  });

  it('no window.open, and tabs.create only in platform.ts', () => {
    for (const {path, text} of sources) {
      expect(`${path}: ${/\bwindow\.open\b|\bopen\s*\(\s*['"`]http/.test(text)}`).toBe(`${path}: false`);
      if (path !== 'platform.ts') expect(`${path}: ${/tabs\.create/.test(text)}`).toBe(`${path}: false`);
    }
  });

  it('every href is the explorer link', () => {
    for (const {path, text} of sources) {
      for (const m of text.matchAll(/\bhref=\{?([^\s>}]+)/g)) expect(`${path}: ${m[1]}`).toBe('screens/TxDetail.tsx: href');
    }
  });
});
