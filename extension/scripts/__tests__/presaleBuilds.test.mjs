import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BUILD_MS = 180_000;

// B1d §1.1, §6.1 "Switch": the real build, both ways — `node scripts/build.mjs <dir> [--no-presale]` — read through the
// module maps the build writes next to its output (the bundler's own account of what each chunk carries).
const builds = {};
const modulesOf = dir => {
  const out = new Set();
  for (const f of readdirSync(dir).filter(f => /^app(\.[a-z]+)?\.modules\.json$/.test(f))) {
    for (const ids of Object.values(JSON.parse(readFileSync(join(dir, f), 'utf8')).chunks)) for (const id of ids) out.add(id);
  }
  return out;
};
beforeAll(() => {
  for (const [name, args] of [['on', []], ['off', ['--no-presale']]]) {
    const dir = mkdtempSync(join(tmpdir(), `presale-build-${name}-`));
    execFileSync('node', ['scripts/build.mjs', dir, ...args], {cwd: ROOT, stdio: 'pipe'});
    builds[name] = {dir, modules: modulesOf(dir), features: JSON.parse(readFileSync(join(dir, 'app.features.json'), 'utf8'))};
  }
}, BUILD_MS);
afterAll(() => {
  for (const b of Object.values(builds)) rmSync(b.dir, {recursive: true, force: true});
});

describe('the two builds', () => {
  it('each writes app.features.json next to app.modules.json, never inside a package', () => {
    expect(builds.on.features).toEqual({presale: true});
    expect(builds.off.features).toEqual({presale: false});
    for (const b of Object.values(builds)) {
      for (const d of ['app', 'chrome', 'firefox']) expect(existsSync(join(b.dir, d, 'app.features.json'))).toBe(false);
      expect(existsSync(join(b.dir, 'app.modules.json'))).toBe(true);
    }
  });

  it.each(PRESALE_ENTRIES.map(e => [e.entry, e.stub]))('on: %s is bundled and its stub is not (positive control)', (entry, stub) => {
    expect(builds.on.modules.has(entry)).toBe(true);
    expect(builds.on.modules.has(stub)).toBe(false);
  });

  it.each(PRESALE_ENTRIES.map(e => [e.entry, e.stub]))('off: %s is replaced by %s', (entry, stub) => {
    expect(builds.off.modules.has(entry)).toBe(false);
    expect(builds.off.modules.has(stub)).toBe(true);
  });

  it('off: no module under a presale directory at all', () => {
    const presale = [...builds.off.modules].filter(id => /^src\/(background|app)\/presale\/|^src\/unlock\/presale\.ts$/.test(id));
    expect(presale).toEqual([]);
  });

  it('both: the moved helpers come from core/solana/encoding.ts, and core/presale/buyInstructions.ts is in neither (M2)', () => {
    for (const b of Object.values(builds)) {
      expect(b.modules.has('../core/solana/encoding.ts')).toBe(true);
      expect(b.modules.has('../core/presale/buyInstructions.ts')).toBe(false);
    }
  });

  it('both: the same manifest — the switch adds no permission, host or CSP entry', () => {
    for (const browser of ['chrome', 'firefox']) {
      expect(readFileSync(join(builds.off.dir, browser, 'manifest.json'), 'utf8')).toBe(readFileSync(join(builds.on.dir, browser, 'manifest.json'), 'utf8'));
    }
  });

  // C4: the background is a module service worker, where import() throws. A method named `import` (`x.import()`) is not one.
  it('no chunk the background loads contains a dynamic import, in either build', () => {
    const DYNAMIC = /(?<![.\w$])import\s*\(/;
    for (const b of Object.values(builds)) {
      const app = join(b.dir, 'app');
      const seen = new Set();
      const stack = ['background.js'];
      while (stack.length > 0) {
        const file = stack.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        const code = readFileSync(join(app, file), 'utf8');
        expect([file, DYNAMIC.test(code)]).toEqual([file, false]);
        for (const m of code.matchAll(/(?:from|import)\s*["']\.\/([^"']+)["']/g)) stack.push(join(dirname(file), m[1]));
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });
});
