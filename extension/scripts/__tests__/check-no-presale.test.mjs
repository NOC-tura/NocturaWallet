import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  BOTH_BUILDS,
  CORE_PRESALE_ALLOWED,
  MARKERS,
  MUST_STAY,
  ON_BUILD,
  checkNoPresale,
  decoderInstructionNames,
  featureViolations,
  markerViolations,
  missingModules,
  missingStrings,
  moduleIds,
  offModuleViolations,
} from '../check-no-presale.mjs';
import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';
import {PRESALE_INSTRUCTIONS} from '../../src/background/dapp/decode/presaleIdl';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/app.modules.0b79442.json'), 'utf8'));
const map = ids => ({chunks: {'background.js': ids}});
const without = (m, id) => ({...m, chunks: Object.fromEntries(Object.entries(m.chunks).map(([f, ids]) => [f, ids.filter(i => i !== id)]))});
const SHARED = ['src/background/index.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];

// B1d §6.2 item 1 (C38, D15): the off build's module rule — an allowlist for core/presale/**, core/geo/** whole.
describe('the off-build module rule', () => {
  it('self-test: the map of commit 0b79442 (before B1d) fails naming exactly core/presale/buyInstructions.ts', () => {
    expect(Object.keys(FIXTURE)[0]).toBe('builtFrom');
    expect(FIXTURE.builtFrom).toMatch(/^commit 0b79442 /);
    const v = offModuleViolations(moduleIds([FIXTURE]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(/^off build carries core\/presale\/buyInstructions\.ts /);
  });

  it('self-test: and passes with that one entry removed', () => {
    expect(offModuleViolations(moduleIds([without(FIXTURE, '../core/presale/buyInstructions.ts')]))).toEqual([]);
  });

  it('allows exactly addresses, allocation and stagePrices of core/presale, and all of core/geo (D15)', () => {
    expect(CORE_PRESALE_ALLOWED).toEqual(['core/presale/addresses.ts', 'core/presale/allocation.ts', 'core/presale/stagePrices.ts']);
    const geo = ['../core/geo/fetch.ts', '../core/geo/freshness.ts', '../core/geo/classify.ts', '../core/geo/restrictedList.ts', 'src/background/geo/gate.ts'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...geo])]))).toEqual([]);
  });

  it.each([
    'src/background/presale/api.ts',
    'src/background/presale/state.ts',
    'src/app/presale/index.ts',
    'src/app/presale/Presale.tsx',
    'src/unlock/presale.ts',
    '../core/referral/index.ts',
    '../core/presale/buyInstructions.ts',
    '../core/presale/limits.ts',
    '../core/presale/stats.ts',
    '../core/presale/purchaseGate.ts',
    '../core/presale/buyInstructions.ts?commonjs-proxy',
    'src/unlock/presale.ts?v=1',
    '../core/presale/limits.ts#x',
  ])('refuses %s in the off build', id => {
    expect(offModuleViolations(moduleIds([map([...SHARED, id])]))).toHaveLength(1);
  });

  it('reads every chunk of every map it is given, and a map without chunks is INCONCLUSIVE', () => {
    const two = [map(SHARED), {chunks: {'assets/x.js': ['src/x.ts'], 'assets/y.js': ['src/app/presale/index.ts']}}];
    expect(offModuleViolations(moduleIds(two))).toHaveLength(1);
    expect(() => moduleIds([{}])).toThrow(/INCONCLUSIVE/);
    expect(() => moduleIds([])).toThrow(/INCONCLUSIVE/);
    expect(() => moduleIds([{chunks: {}}])).toThrow(/INCONCLUSIVE/);
  });

  it('a stub and a presale-named module outside the presale directories are not presale modules', () => {
    const ok = ['src/presale-off/background.ts', 'src/presale-off/app.ts', 'src/presale-off/unlock.ts', 'src/background/presaleHost.ts', 'src/background/dapp/decode/presaleIdl.ts'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...ok])]))).toEqual([]);
  });
});

// §6.2 item 1's positive control, staged per plan (review 2 M2): the lists only grow, and each plan's modules are named.
describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
  it('the on build must carry the three on-path entries — the plugin maps something real', () => {
    expect(ON_BUILD).toEqual(PRESALE_ENTRIES.map(e => e.entry));
    expect(BOTH_BUILDS).toEqual([]);
  });

  it('missingModules names each required module a map does not carry', () => {
    const on = moduleIds([map([...SHARED, ...ON_BUILD])]);
    expect(missingModules('on', on, ON_BUILD)).toEqual([]);
    const renamed = moduleIds([map([...SHARED, 'src/background/presale/index.ts', ...ON_BUILD.slice(1)])]);
    expect(missingModules('on', renamed, ON_BUILD)).toEqual(['on build does not carry src/background/presale/api.ts — renamed or moved? the positive control must name it']);
    expect(missingModules('off', moduleIds([map(['../core/geo/fetch.ts'])]), ['core/geo/fetch.ts'])).toEqual([]);
  });

  it('every ON_BUILD module is one the off build refuses (else its control proves nothing)', () => {
    for (const id of ON_BUILD) expect([id, offModuleViolations(new Set([id])).length]).toEqual([id, 1]);
  });
});

describe('wiring', () => {
  it('npm run gates runs the gate once, off build first, and npm run verify runs the gates after building both', () => {
    const {scripts} = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(scripts.gates.split(' && ').filter(c => c.includes('check-no-presale'))).toEqual(['node scripts/check-no-presale.mjs dist-nopresale dist']);
    expect(scripts.verify.split(' && ')).toEqual(expect.arrayContaining(['npm run build', 'npm run gates']));
    expect(scripts.build).toContain('node scripts/build.mjs --no-presale');
  });
});

describe('app.features.json', () => {
  it('must say what its directory is', () => {
    expect(featureViolations('dist-nopresale', {presale: false}, false)).toEqual([]);
    expect(featureViolations('dist', {presale: true}, true)).toEqual([]);
    expect(featureViolations('dist-nopresale', {presale: true}, false)).toHaveLength(1);
    expect(featureViolations('dist', {presale: false}, true)).toHaveLength(1);
    expect(featureViolations('dist', undefined, true)).toHaveLength(1);
    expect(featureViolations('dist', {presale: 'true'}, true)).toHaveLength(1);
    expect(featureViolations('dist', {presale: true, extra: 1}, true)).toHaveLength(1);
  });
});

// §6.2 items 2 and 3: markers stay out of the off build (each found in the on build), what both builds need stays in.
describe('strings', () => {
  const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});

  it('1a ships no marker: the list is empty and armed by B1d-1b (Q42 is "both")', () => {
    expect(MARKERS).toEqual([]);
  });

  it('a marker in any off-build file is a violation; each marker must be found in the on build', () => {
    const markers = ['NOC presale', 'v1_presale_records'];
    const off = [file('app/background.js', 'var a=1;'), file('chrome/assets/x.js', '"Buy in the NOC presale"')];
    const on = [file('app/background.js', '"v1_presale_records"'), file('app/assets/y.js', 'NOC presale')];
    expect(markerViolations(off, on, markers)).toEqual(['off build: chrome/assets/x.js contains the presale marker "NOC presale"']);
    expect(markerViolations([file('app/a.js', 'x')], on, markers)).toEqual([]);
    expect(markerViolations([file('app/a.js', 'x')], [file('app/a.js', 'NOC presale')], markers)).toEqual(['on build: no file contains the presale marker "v1_presale_records" — the marker does not describe the on build']);
  });

  it('refuses a marker shorter than 8 characters (it would match unrelated code)', () => {
    expect(() => markerViolations([], [file('app/a.js', 'presale')], ['presale'])).toThrow(/at least 8/);
  });

  it('must stay: B1b/B1c presale copy and the decoder instruction names are found in the off build', () => {
    expect(MUST_STAY).toEqual(['Presale purchase', 'PRESALE PURCHASE']);
    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"'), file('app/b.js', 'PRESALE PURCHASE')], MUST_STAY)).toEqual([]);
    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"')], MUST_STAY)).toEqual(['off build: no file contains "PRESALE PURCHASE" — the switch stripped what both builds need']);
  });

  it('the decoder names are read from presaleIdl.ts exactly as the module exports them', () => {
    const names = decoderInstructionNames(readFileSync(join(ROOT, 'src/background/dapp/decode/presaleIdl.ts'), 'utf8'));
    expect(names).toEqual(PRESALE_INSTRUCTIONS.map(i => i.name));
    expect(names).toContain('presale_purchase_with_sol');
    expect(decoderInstructionNames('export const X = 1;')).toEqual([]);
  });

  it('no marker overlaps a string that must stay', () => {
    for (const m of MARKERS) for (const s of MUST_STAY) expect([m, s, m.includes(s) || s.includes(m)]).toEqual([m, s, false]);
  });
});

// The whole gate over two directories, as `npm run gates` runs it — synthetic builds, each rule's red and green.
describe('checkNoPresale(offDir, onDir)', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'no-presale-'));
  });
  afterEach(() => rmSync(tmp, {recursive: true, force: true}));

  const IDL = "{name: 'presale_purchase_with_sol', discriminator: [1]}, {name: 'register_referrer', discriminator: [2]}";
  const write = (dir, {presale, modules, text}) => {
    mkdirSync(join(tmp, dir), {recursive: true});
    writeFileSync(join(tmp, dir, 'app.features.json'), `${JSON.stringify({presale})}\n`);
    writeFileSync(join(tmp, dir, 'app.modules.json'), JSON.stringify(map(modules)));
    writeFileSync(join(tmp, dir, 'app.relay.modules.json'), JSON.stringify({chunks: {'relay.js': ['src/relay/index.ts']}}));
    for (const p of ['app', 'chrome', 'firefox']) {
      mkdirSync(join(tmp, dir, p, 'assets'), {recursive: true});
      writeFileSync(join(tmp, dir, p, 'background.js'), `"Presale purchase";"PRESALE PURCHASE";"presale_purchase_with_sol";"register_referrer";${text}`);
    }
  };
  const good = () => {
    write('off', {presale: false, modules: [...SHARED, 'src/presale-off/background.ts'], text: ''});
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD], text: ''});
  };
  const run = (o = {}) => checkNoPresale(join(tmp, 'off'), join(tmp, 'on'), {decoderSource: IDL, ...o});

  it('passes on a clean pair (positive control)', () => {
    good();
    expect(run()).toEqual([]);
  });

  it('fails when a presale module leaks into the off build — in any module map', () => {
    good();
    writeFileSync(join(tmp, 'off', 'app.relay.modules.json'), JSON.stringify({chunks: {'relay.js': ['src/relay/index.ts', '../core/presale/limits.ts']}}));
    expect(run()).toEqual([expect.stringMatching(/^off build carries core\/presale\/limits\.ts /)]);
  });

  it('fails when the on build lacks a positive-control module', () => {
    good();
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD.slice(1)], text: ''});
    expect(run()).toEqual(['on build does not carry src/background/presale/api.ts — renamed or moved? the positive control must name it']);
  });

  it('fails when a marker is in the off build, in chrome/ or firefox/ alone too', () => {
    good();
    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD], text: '"YOU RECEIVE (EST.)"'});
    expect(run({markers: ['YOU RECEIVE (EST.)']})).toEqual([]);
    writeFileSync(join(tmp, 'off', 'firefox', 'assets', 'p.js'), '"YOU RECEIVE (EST.)"');
    expect(run({markers: ['YOU RECEIVE (EST.)']})).toEqual(['off build: firefox/assets/p.js contains the presale marker "YOU RECEIVE (EST.)"']);
  });

  it('fails when a must-stay string or a decoder name is missing from the off build', () => {
    good();
    writeFileSync(join(tmp, 'off', 'app', 'background.js'), '"Presale purchase";"PRESALE PURCHASE";"presale_purchase_with_sol"');
    for (const p of ['chrome', 'firefox']) rmSync(join(tmp, 'off', p, 'background.js'));
    expect(run()).toEqual(['off build: no file contains "register_referrer" — the switch stripped what both builds need']);
  });

  it('is INCONCLUSIVE without the decoder names, a module map, a package directory or app.features.json — and with the directories swapped it fails', () => {
    good();
    expect(run({decoderSource: ''})).toEqual(['INCONCLUSIVE: no instruction names read from src/background/dapp/decode/presaleIdl.ts']);
    rmSync(join(tmp, 'off', 'app.modules.json'));
    expect(run()).toEqual([expect.stringMatching(/^INCONCLUSIVE: .*off.*app\.modules\.json/)]);
    good();
    rmSync(join(tmp, 'on', 'firefox'), {recursive: true});
    expect(run()).toEqual([expect.stringMatching(/^INCONCLUSIVE: .*on.*firefox/)]);
    good();
    rmSync(join(tmp, 'off', 'app.features.json'));
    expect(run()).toHaveLength(1);
    good();
    expect(checkNoPresale(join(tmp, 'on'), join(tmp, 'off'), {decoderSource: IDL}).length).toBeGreaterThan(2);
  });
});
