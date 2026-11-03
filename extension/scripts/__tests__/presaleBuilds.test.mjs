import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkNoPresale} from '../check-no-presale.mjs';
import {linkViolations, packageFiles} from '../check-links.mjs';
import {pageViolations} from '../check-vault-isolation.mjs';
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
// B1e-1 Task 6: vitest sets NODE_ENV=test, and Vite keeps a NODE_ENV it finds — the builds here were React's development
// build until it was removed from their environment. They are the packages `node scripts/build.mjs` makes now.
const BUILD_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_ENV'));
beforeAll(() => {
  for (const [name, args] of [['on', []], ['off', ['--no-presale']]]) {
    const dir = mkdtempSync(join(tmpdir(), `presale-build-${name}-`));
    execFileSync('node', ['scripts/build.mjs', dir, ...args], {cwd: ROOT, stdio: 'pipe', env: BUILD_ENV});
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

  it('both: the moved helpers come from core/solana/encoding.ts; core/presale/buyInstructions.ts is never in the off build (M2) — the on build builds purchases with it (B1d-1b)', () => {
    for (const b of Object.values(builds)) expect(b.modules.has('../core/solana/encoding.ts')).toBe(true);
    expect(builds.off.modules.has('../core/presale/buyInstructions.ts')).toBe(false);
    expect(builds.on.modules.has('../core/presale/buyInstructions.ts')).toBe(true);
  });

  it('the off-build gate (scripts/check-no-presale.mjs) passes on the two builds, and fails with them swapped', () => {
    expect(checkNoPresale(builds.off.dir, builds.on.dir)).toEqual([]);
    expect(checkNoPresale(builds.on.dir, builds.off.dir).length).toBeGreaterThan(0);
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

// B1e §4.2–§4.4: the licence page and the link gate on the real packages of both builds. The packages with rendered code
// are derived here from the maps by a walk of this test's own, not by scripts/licences.mjs.
const renderedPackages = dir => {
  const out = new Set();
  for (const f of readdirSync(dir).filter(f => /^app(\.[a-z]+)?\.modules\.json$/.test(f))) {
    for (const modules of Object.values(JSON.parse(readFileSync(join(dir, f), 'utf8')).rendered)) {
      for (const [id, length] of Object.entries(modules)) {
        if (length === 0 || !id.includes('node_modules/')) continue;
        for (let d = dirname(join(ROOT, id)); d.includes('node_modules'); d = dirname(d)) {
          const file = join(d, 'package.json');
          const json = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
          if (typeof json.name === 'string') {
            out.add(`${json.name} ${json.version}`);
            break;
          }
        }
      }
    }
  }
  return [...out].sort();
};
const headings = html => [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1].replace(/&amp;/g, '&'));

describe('the licence page and the link gate on the real builds (B1e §4.2–§4.4)', () => {
  it('the builds are production builds (React’s production error decoder, none of its development warnings)', () => {
    for (const b of Object.values(builds)) {
      const files = packageFiles(join(b.dir, 'chrome'));
      expect(files.some(f => f.text.includes('https://reactjs.org/docs/error-decoder.html?invariant='))).toBe(true);
      expect(files.some(f => f.text.includes('https://reactjs.org/link/'))).toBe(false);
    }
  });

  it('each build carries one licenses.html — the same file in app/, chrome/ and firefox/', () => {
    for (const b of Object.values(builds)) {
      const [app, chrome, firefox] = ['app', 'chrome', 'firefox'].map(d => readFileSync(join(b.dir, d, 'licenses.html'), 'utf8'));
      expect(chrome).toBe(app);
      expect(firefox).toBe(app);
    }
  });

  it('lists Noctura, then exactly the packages with rendered code and the Geist fonts — no other', () => {
    for (const b of Object.values(builds)) {
      const listed = headings(readFileSync(join(b.dir, 'app', 'licenses.html'), 'utf8'));
      expect(listed[0]).toBe('Noctura');
      expect(listed.filter(h => h !== 'Noctura' && h !== 'geist 1.7.2').sort()).toEqual(renderedPackages(b.dir));
      expect(listed).toContain('geist 1.7.2');
      expect(listed).toContain('@solana/web3.js 1.99.0');
    }
  });

  it('rpc-websockets is in neither build’s maps (the alias took), and text-encoding-utf-8 1.0.2 ships under the Unlicense', () => {
    for (const b of Object.values(builds)) {
      expect([...b.modules].filter(id => id.includes('node_modules/rpc-websockets/'))).toEqual([]);
      const html = readFileSync(join(b.dir, 'app', 'licenses.html'), 'utf8');
      expect(html).toContain('<h2>text-encoding-utf-8 1.0.2</h2>\n<p>Unlicense</p>');
      expect(html).not.toContain('rpc-websockets');
      expect(html).not.toContain('LGPL');
    }
  });

  it('the link gate passes the real packages; with its skip removed it fails on the real licenses.html, and only there', () => {
    for (const b of Object.values(builds)) {
      for (const browser of ['chrome', 'firefox']) {
        const files = packageFiles(join(b.dir, browser));
        expect([b.features.presale, browser, linkViolations(files, b.features.presale)]).toEqual([b.features.presale, browser, []]);
        const unskipped = linkViolations(files, b.features.presale, {skipped: []});
        expect(unskipped.length).toBeGreaterThan(0);
        expect(unskipped.filter(p => !p.startsWith('licenses.html names '))).toEqual([]);
      }
    }
  });

  it('the real licenses.html never scrolls sideways: no line of a <pre> over 100 columns but a one-word line (a <p> wraps)', () => {
    for (const b of Object.values(builds)) {
      const lines = [...readFileSync(join(b.dir, 'app', 'licenses.html'), 'utf8').matchAll(/<pre>([\s\S]*?)<\/pre>/g)]
        .map(m => m[1])
        .join('\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .split('\n');
      expect(lines.filter(l => [...l].length > 100 && /\s/.test(l.trim()))).toEqual([]);
      expect(Math.max(...lines.map(l => [...l].length))).toBeGreaterThan(60);
    }
  });

  it('the static-page rule passes the real licenses.html; every page is an entry or the static page', () => {
    for (const b of Object.values(builds)) for (const d of ['app', 'chrome', 'firefox']) expect([d, pageViolations(join(b.dir, d))]).toEqual([d, []]);
  });
});
