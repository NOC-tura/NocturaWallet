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

// Review fix round 1, #4d: a page navigation is as much an "external link" as an <a href>, and it
// leaves no href for the other checks below to catch — `location.href =`, `.assign(`, `.replace(`
// and a bare `location =` are all forbidden the same way `window.open` is.
const LOCATION_REDIRECT = /\blocation\.href\s*=(?!=)|\blocation\.assign\s*\(|\blocation\.replace\s*\(|\blocation\s*=(?!=)/;

describe('links out of the UI', () => {
  const sources = files(APP).map(p => ({path: relative(APP, p), text: readFileSync(p, 'utf8')}));

  it('reads the real tree (positive control)', () => {
    expect(sources.map(s => s.path)).toEqual(expect.arrayContaining(['explorer.ts', 'platform.ts', 'screens/TxDetail.tsx']));
  });

  // Negative control: the same regex the real-tree check below uses, run against planted violations
  // (never against the real tree) — proves the check is not vacuous, before trusting it to find nothing.
  it('catches a planted location-redirect (negative control)', () => {
    for (const bad of ['location.href = "https://evil.example";', 'location.assign("https://evil.example");', 'location.replace("https://evil.example");', 'location = "https://evil.example";']) {
      expect(LOCATION_REDIRECT.test(bad)).toBe(true);
    }
    // Comparisons and unrelated identifiers must not trip it.
    for (const fine of ['if (location === x) {}', 'const relocationTarget = 1;', 'href={locationLabel}']) {
      expect(LOCATION_REDIRECT.test(fine)).toBe(false);
    }
  });

  // Plan 2: the UI tab hands over to the vault page in the same tab (#7's and #40's [Unlock], #40's
  // [Try a different seed]) — through platform.ts's navigate(), whose target is the closed ExtensionPage list.
  it('no page navigation but the explorer link and platform.ts’s navigate(): no location.href / .assign( / .replace( / bare location =', () => {
    for (const {path, text} of sources) {
      if (path === 'platform.ts') continue;
      expect(`${path}: ${LOCATION_REDIRECT.test(text)}`).toBe(`${path}: false`);
    }
    const platform = sources.find(s => s.path === 'platform.ts')?.text ?? '';
    expect([...platform.matchAll(new RegExp(LOCATION_REDIRECT, 'g'))].map(m => m[0])).toEqual(['location.assign(']);
    expect(platform).toMatch(/navigate: page => location\.assign\(page\)/);
    // The closed list, plus #20's one data-built page — a branded ReauthPage only reauthPage() makes (Task 9 fix round 1).
    expect(platform).toMatch(/navigate\(page: ExtensionPage \| ReauthPage\): void;/);
    // B1b-2b §1.3: and the accounts manager's remove page — a branded RemoveAccountPage only removeAccountPage() makes.
    expect(platform).toMatch(/openPage\(page: ExtensionPage \| ReauthPage \| RemoveAccountPage\): void;/);
    expect([...platform.matchAll(/as ReauthPage\b/g)]).toHaveLength(1);
    expect([...platform.matchAll(/as RemoveAccountPage\b/g)]).toHaveLength(1);
    for (const {path, text} of sources) if (path !== 'platform.ts') expect(`${path}: ${/as (?:ReauthPage|RemoveAccountPage)\b/.test(text)}`).toBe(`${path}: false`);
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
