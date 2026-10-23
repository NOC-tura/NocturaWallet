import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {presaleFlag} from '../presaleFlag.mjs';
import {PRESALE_ENTRIES, presaleSwitch} from '../presaleSwitch.mjs';
import {DIST_DIRS, distDir} from '../distDir.mjs';
import {appConfig} from '../../vite.config';
import {contentConfig} from '../../vite.content.config';
import nopresale from '../../vitest.nopresale.config';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// B1d §1.1 (D2, C4): one build input, two mechanisms — the plugin removes the three entry modules, the constant folds
// inline branches — and both Vite configs read the same flag.
describe('presaleFlag', () => {
  it("maps '1' and unset to on, '0' to off", () => {
    expect(presaleFlag({NOCTURA_PRESALE: '1'})).toBe(true);
    expect(presaleFlag({})).toBe(true);
    expect(presaleFlag({NOCTURA_PRESALE: '0'})).toBe(false);
  });

  it('throws on anything else — a typo never picks a build', () => {
    for (const v of ['', 'true', 'false', 'off', 'no', ' 0', '0 ', '00', '2']) expect(() => presaleFlag({NOCTURA_PRESALE: v})).toThrow('NOCTURA_PRESALE');
  });
});

describe('distDir', () => {
  it("selects dist by default and dist-nopresale by NOCTURA_DIST; anything else throws", () => {
    expect(DIST_DIRS).toEqual(['dist', 'dist-nopresale']);
    expect(distDir({})).toBe('dist');
    expect(distDir({NOCTURA_DIST: 'dist'})).toBe('dist');
    expect(distDir({NOCTURA_DIST: 'dist-nopresale'})).toBe('dist-nopresale');
    for (const v of ['', 'dist/', '../dist', 'dist-presale', '/tmp/dist']) expect(() => distDir({NOCTURA_DIST: v})).toThrow('NOCTURA_DIST');
  });
});

describe('presaleSwitch', () => {
  const ctx = id => ({resolve: async () => (id === null ? null : {id, external: false})});
  const call = (plugin, id, source = './x') => plugin.resolveId.call(ctx(id), source, join(ROOT, 'src/background/index.ts'), {});

  it('names exactly the three entries of §1.1 and their stubs outside every presale directory', () => {
    expect(PRESALE_ENTRIES).toEqual([
      {entry: 'src/background/presale/api.ts', stub: 'src/presale-off/background.ts'},
      {entry: 'src/app/presale/index.ts', stub: 'src/presale-off/app.ts'},
      {entry: 'src/unlock/presale.ts', stub: 'src/presale-off/unlock.ts'},
    ]);
  });

  it('off: resolves each entry to its stub, with or without a query or hash, and nothing else', async () => {
    const off = presaleSwitch(false);
    expect(off.enforce).toBe('pre');
    expect(off.api).toEqual({presale: false});
    for (const {entry, stub} of PRESALE_ENTRIES) {
      expect(await call(off, join(ROOT, entry))).toBe(join(ROOT, stub));
      expect(await call(off, `${join(ROOT, entry)}?v=1`)).toBe(join(ROOT, stub));
      expect(await call(off, `${join(ROOT, entry)}#x`)).toBe(join(ROOT, stub));
    }
    // Negative controls: a module beside an entry, a stub itself, an unresolvable import, an external one.
    expect(await call(off, join(ROOT, 'src/background/presaleHost.ts'))).toBeNull();
    expect(await call(off, join(ROOT, 'src/background/presale/state.ts'))).toBeNull();
    expect(await call(off, join(ROOT, 'src/presale-off/background.ts'))).toBeNull();
    expect(await call(off, null)).toBeNull();
    expect(await off.resolveId.call({resolve: async () => ({id: join(ROOT, PRESALE_ENTRIES[0].entry), external: true})}, 'x', undefined, {})).toBeNull();
  });

  it('on: resolves nothing — it never even asks the resolver', async () => {
    const on = presaleSwitch(true);
    expect(on.api).toEqual({presale: true});
    let asked = 0;
    const counting = {resolve: async () => ((asked += 1), {id: join(ROOT, PRESALE_ENTRIES[0].entry), external: false})};
    for (const {entry} of PRESALE_ENTRIES) expect(await on.resolveId.call(counting, join(ROOT, entry), undefined, {})).toBeNull();
    expect(asked).toBe(0);
  });

  it('throws on a flag that is not a boolean, and on a missing stub (naming it)', () => {
    for (const v of ['1', '0', 1, 0, undefined, null, 'true']) expect(() => presaleSwitch(v)).toThrow('presaleSwitch');
    const root = mkdtempSync(join(tmpdir(), 'presale-switch-'));
    try {
      mkdirSync(join(root, 'src/presale-off'), {recursive: true});
      writeFileSync(join(root, 'src/presale-off/background.ts'), '');
      writeFileSync(join(root, 'src/presale-off/app.ts'), '');
      expect(() => presaleSwitch(false, root)).toThrow('src/presale-off/unlock.ts');
      expect(() => presaleSwitch(true, root)).toThrow('src/presale-off/unlock.ts');
      writeFileSync(join(root, 'src/presale-off/unlock.ts'), '');
      expect(() => presaleSwitch(false, root)).not.toThrow();
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });
});

describe('both configs read the same flag (review L11)', () => {
  const switches = plugins => plugins.flat(Infinity).filter(p => p && p.name === 'noctura:presale-switch');
  const modeOf = plugins => switches(plugins).map(p => p.api.presale);

  it.each([
    ['unset', {}, true],
    ["'1'", {NOCTURA_PRESALE: '1'}, true],
    ["'0'", {NOCTURA_PRESALE: '0'}, false],
  ])('NOCTURA_PRESALE %s: the same define and the same plugin mode in the app, worker and content builds', (_name, env, on) => {
    const app = appConfig(env);
    const content = contentConfig({...env, NOCTURA_CONTENT: 'relay'});
    expect(app.define).toEqual({__NOCTURA_PRESALE__: JSON.stringify(on)});
    expect(content.define).toEqual({__NOCTURA_PRESALE__: JSON.stringify(on)});
    expect(modeOf(app.plugins)).toEqual([on]);
    expect(modeOf(app.worker.plugins())).toEqual([on]);
    expect(modeOf(content.plugins)).toEqual([on]);
  });

  it('a bad flag fails both configs; the content config still requires its script name', () => {
    expect(() => appConfig({NOCTURA_PRESALE: 'off'})).toThrow('NOCTURA_PRESALE');
    expect(() => contentConfig({NOCTURA_PRESALE: 'off', NOCTURA_CONTENT: 'relay'})).toThrow('NOCTURA_PRESALE');
    expect(() => contentConfig({NOCTURA_PRESALE: '1'})).toThrow('NOCTURA_CONTENT');
  });

  it('vitest.nopresale.config.ts is the app config with the flag off, its own include list, and the run marked off', () => {
    expect(nopresale.define).toEqual({__NOCTURA_PRESALE__: 'false'});
    expect(modeOf(nopresale.plugins)).toEqual([false]);
    expect(nopresale.test.env).toEqual({NOCTURA_PRESALE: '0'});
    expect(nopresale.test.include).toContain('src/__tests__/presaleSwitch.test.ts');
    // The on run (vite.config.ts) is not marked: unset reads as on.
    expect(appConfig({}).test.env).toBeUndefined();
  });

  it('the shared send pipeline is tested in the off run too: the intent-kind registry and a purchase record (B1d §6.1 "Switch, off build", C19)', () => {
    expect(nopresale.test.include).toEqual(expect.arrayContaining(['src/background/__tests__/intents.test.ts', 'src/background/__tests__/pendingKinds.test.ts']));
  });

  it('the generic rendering of a record without an intent is tested in the off run too: #11, #26, #21, #44, #54 (B1d Q42, C19)', () => {
    expect(nopresale.test.include).toEqual(expect.arrayContaining(['src/app/__tests__/genericRecord.test.tsx', 'src/app/__tests__/engine.test.ts']));
  });
});

// Why the plugin and not a guarded call (C4): a module whose top level has an effect stays in the bundle when only its
// call site is folded away; resolving the import to the stub is what removes it. A three-module fixture, built twice.
describe('the plugin removes a module with a side-effectful top level; a folded call site does not', () => {
  let root;
  const EFFECT = 'presale-module-top-level-effect';
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'presale-switch-build-'));
    for (const {entry, stub} of PRESALE_ENTRIES) {
      mkdirSync(dirname(join(root, entry)), {recursive: true});
      mkdirSync(dirname(join(root, stub)), {recursive: true});
      writeFileSync(join(root, stub), "export const run = () => 'from-the-stub';\n");
      writeFileSync(join(root, entry), `globalThis.effects = [...(globalThis.effects ?? []), '${EFFECT}'];\nexport const run = () => 'from-the-entry';\n`);
    }
    writeFileSync(join(root, 'plain.js'), "import {run} from './src/background/presale/api.ts';\nglobalThis.ran = run();\n");
    writeFileSync(join(root, 'guarded.js'), "import {run} from './src/background/presale/api.ts';\nif (__NOCTURA_PRESALE__) globalThis.ran = run();\n");
  });
  afterAll(() => rmSync(root, {recursive: true, force: true}));

  const bundle = async (input, on) => {
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      define: {__NOCTURA_PRESALE__: JSON.stringify(on)},
      plugins: [presaleSwitch(on, root)],
      build: {write: false, minify: false, lib: {entry: join(root, input), formats: ['es'], fileName: 'out'}},
    });
    const chunk = (Array.isArray(out) ? out[0] : out).output[0];
    return {code: chunk.code, modules: chunk.moduleIds.map(id => id.slice(root.length + 1))};
  };

  it('on: the entry is bundled with its effect (positive control)', async () => {
    const b = await bundle('plain.js', true);
    expect(b.modules).toContain('src/background/presale/api.ts');
    expect(b.code).toContain(EFFECT);
    expect(b.code).toContain('from-the-entry');
  });

  it('off: the stub is bundled instead, and the effect is gone', async () => {
    const b = await bundle('plain.js', false);
    expect(b.modules).toContain('src/presale-off/background.ts');
    expect(b.modules).not.toContain('src/background/presale/api.ts');
    expect(b.code).toContain('from-the-stub');
    expect(b.code).not.toContain('from-the-entry');
    expect(b.code).not.toContain(EFFECT);
  });

  it('the constant alone (the call folded away, no plugin) keeps the effect — negative control for C4', async () => {
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      define: {__NOCTURA_PRESALE__: 'false'},
      build: {write: false, minify: false, lib: {entry: join(root, 'guarded.js'), formats: ['es'], fileName: 'out'}},
    });
    const chunk = (Array.isArray(out) ? out[0] : out).output[0];
    expect(chunk.code).not.toContain('from-the-entry');
    expect(chunk.code).toContain(EFFECT);
  });
});

// B1d §6.2 item 1's positive control names presale background modules no B1d-1a code calls yet (layouts.ts, state.ts):
// in the on build every module under src/background/presale/ is kept whole, so the module maps list what the entry
// imports rather than what tree-shaking left of it.
describe('on: the presale background modules are kept whole', () => {
  it('transform marks a module under src/background/presale/ (a query included) no-treeshake, its code unchanged; nothing else, and nothing off', () => {
    const on = presaleSwitch(true);
    const off = presaleSwitch(false);
    for (const id of [join(ROOT, 'src/background/presale/state.ts'), `${join(ROOT, 'src/background/presale/layouts.ts')}?v=1`]) {
      expect(on.transform('const x = 1;', id)).toEqual({code: 'const x = 1;', map: null, moduleSideEffects: 'no-treeshake'});
      expect(off.transform('const x = 1;', id)).toBeNull();
    }
    for (const path of ['src/background/presaleHost.ts', 'src/app/presale/index.ts', 'src/unlock/presale.ts', 'src/background/index.ts', '../core/presale/limits.ts']) {
      expect([path, on.transform('const x = 1;', join(ROOT, path))]).toEqual([path, null]);
    }
  });

  let root;
  const PURE = 'a-pure-presale-module-no-caller-uses';
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'presale-switch-whole-'));
    for (const {entry, stub} of PRESALE_ENTRIES) {
      mkdirSync(dirname(join(root, entry)), {recursive: true});
      mkdirSync(dirname(join(root, stub)), {recursive: true});
      writeFileSync(join(root, stub), 'export const run = () => 0;\n');
    }
    writeFileSync(join(root, 'src/background/presale/api.ts'), "import './pure.ts';\nexport const run = () => 1;\n");
    writeFileSync(join(root, 'src/background/presale/pure.ts'), `export const PURE = {name: '${PURE}'};\n`);
    writeFileSync(join(root, 'main.js'), "import {run} from './src/background/presale/api.ts';\nglobalThis.ran = run();\n");
  });
  afterAll(() => rmSync(root, {recursive: true, force: true}));

  const bundle = async plugins => {
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      define: {__NOCTURA_PRESALE__: 'true'},
      plugins,
      build: {write: false, minify: false, lib: {entry: join(root, 'main.js'), formats: ['es'], fileName: 'out'}},
    });
    return (Array.isArray(out) ? out[0] : out).output[0].moduleIds.map(id => id.slice(root.length + 1));
  };

  it('a pure module the entry imports and nobody calls is in the on build’s module map', async () => {
    expect(await bundle([presaleSwitch(true, root)])).toContain('src/background/presale/pure.ts');
  });

  it('negative control: without the plugin, tree-shaking drops it from the map', async () => {
    const modules = await bundle([]);
    expect(modules).toContain('src/background/presale/api.ts');
    expect(modules).not.toContain('src/background/presale/pure.ts');
  });
});
