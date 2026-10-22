import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  BOTH_BUILDS,
  CORE_PRESALE_ALLOWED,
  MARKERS,
  MUST_STAY,
  ON_BUILD,
  WEB_ALLOWED,
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
const SHARED = ['src/background/index.ts', 'src/background/intents.ts', 'src/background/geo/gate.ts', '../core/geo/fetch.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];

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

  // Fix round 1 (review I1): an allowlist for ../web/ too, not a denylist — web/src/presale/** imports only erased
  // core/presale types, so no other branch of rule 1 would catch it.
  it('allows exactly web/src/ui/** and web/src/styles/** of ../web/, and nothing else under ../web/', () => {
    expect(WEB_ALLOWED).toEqual(['../web/src/ui/', '../web/src/styles/']);
    const web = ['../web/src/ui/AddressGroups.tsx', '../web/src/ui/Icon.tsx', '../web/src/styles/design-system.css'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...web])]))).toEqual([]);
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
    '../web/src/presale/PresalePanel.tsx',
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

  // Minor (fix round 1): a chunk's value must be an array — a string is iterable character by character and would
  // otherwise pass every rule silently (a bundler never writes this; hardening only).
  it('a chunk whose value is a string, not an array, is INCONCLUSIVE', () => {
    expect(() => moduleIds([{chunks: {'a.js': 'src/app/presale/index.ts'}}])).toThrow(/INCONCLUSIVE/);
  });

  it('a stub and a presale-named module outside the presale directories are not presale modules', () => {
    const ok = ['src/presale-off/background.ts', 'src/presale-off/app.ts', 'src/presale-off/unlock.ts', 'src/background/presaleHost.ts', 'src/background/dapp/decode/presaleIdl.ts'];
    expect(offModuleViolations(moduleIds([map([...SHARED, ...ok])]))).toEqual([]);
  });
});

// §6.2 item 1's positive control, staged per plan (review 2 M2): the lists only grow, and each plan's modules are named.
describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
  it('the on build must carry the three on-path entries — the plugin maps something real — and the program state (Task 5)', () => {
    expect(ON_BUILD).toEqual([...PRESALE_ENTRIES.map(e => e.entry), 'src/background/presale/layouts.ts', 'src/background/presale/state.ts', 'core/presale/limits.ts']);
  });

  it('both builds must carry the intent-kind registry (Task 3) and the jurisdiction gate with its fetcher (Task 6, D15)', () => {
    expect(BOTH_BUILDS).toEqual(['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts']);
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

  it('every BOTH_BUILDS module is one the off build may carry (else the two rules contradict each other)', () => {
    for (const id of BOTH_BUILDS) expect([id, offModuleViolations(new Set([id])).length]).toEqual([id, 0]);
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

  it('must stay: B1b/B1c presale copy, Q42 and the decoder instruction names are found in the off build', () => {
    // Q42a (B1d §10, both builds): the generic pending row of a record the build cannot show (B1d-1a Task 4). Q42b
    // ("Transaction") is too short to mean anything as a string search; its screens are tested in both vitest runs.
    expect(MUST_STAY).toEqual(['Presale purchase', 'PRESALE PURCHASE', 'Transaction · pending', 'Transaction · taking longer than usual']);
    const all = [file('app/a.js', '"Presale purchase"'), file('app/b.js', 'PRESALE PURCHASE'), file('app/c.js', '`Transaction · pending`,`Transaction · taking longer than usual`')];
    expect(missingStrings('off', all, MUST_STAY)).toEqual([]);
    expect(missingStrings('off', [file('app/a.js', '"Presale purchase"')], MUST_STAY)).toEqual([
      'off build: no file contains "PRESALE PURCHASE" — the switch stripped what both builds need',
      'off build: no file contains "Transaction · pending" — the switch stripped what both builds need',
      'off build: no file contains "Transaction · taking longer than usual" — the switch stripped what both builds need',
    ]);
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
      writeFileSync(join(tmp, dir, p, 'background.js'), `"Presale purchase";"PRESALE PURCHASE";"Transaction · pending";"Transaction · taking longer than usual";"presale_purchase_with_sol";"register_referrer";${text}`);
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
    writeFileSync(join(tmp, 'off', 'app', 'background.js'), '"Presale purchase";"PRESALE PURCHASE";"Transaction · pending";"Transaction · taking longer than usual";"presale_purchase_with_sol"');
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

// Fix round 1 (review I2): the CLI guard must actually run the gate, at any checkout path. The old
// `import.meta.url === \`file://${process.argv[1]}\`` compares a percent-encoded left side against a
// never-encoded right side, so it silently takes the else branch (prints nothing, exits 0) once the path contains
// a space or another reserved character — `npm run gates` would then report this gate green without it having
// run. `isMain` (pathToFileURL(argv[1]).href) must not have that hole, proven here by spawning the real CLI, not
// by calling checkNoPresale() in-process.
describe('the CLI, spawned as a real node process', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'no-presale-cli-'));
  });
  afterEach(() => rmSync(tmp, {recursive: true, force: true}));

  const DECODER_NAMES = PRESALE_INSTRUCTIONS.map(i => i.name);
  const writeCliBuild = (dir, {presale, modules}) => {
    mkdirSync(dir, {recursive: true});
    writeFileSync(join(dir, 'app.features.json'), `${JSON.stringify({presale})}\n`);
    writeFileSync(join(dir, 'app.modules.json'), JSON.stringify(map(modules)));
    const text = [...MUST_STAY, ...DECODER_NAMES].map(s => JSON.stringify(s)).join(';');
    for (const p of ['app', 'chrome', 'firefox']) {
      mkdirSync(join(dir, p), {recursive: true});
      writeFileSync(join(dir, p, 'background.js'), text);
    }
  };
  const buildGoodPair = () => {
    const off = join(tmp, 'off');
    const on = join(tmp, 'on');
    writeCliBuild(off, {presale: false, modules: [...SHARED, 'src/presale-off/background.ts']});
    writeCliBuild(on, {presale: true, modules: [...SHARED, ...ON_BUILD]});
    return {off, on};
  };
  const runCli = (scriptPath, args) => {
    try {
      return {status: 0, stdout: execFileSync('node', [scriptPath, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})};
    } catch (e) {
      return {status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? ''};
    }
  };
  // The real CLI's decoder read and must-stay check use the real presaleIdl.ts and the real on-repo path; only
  // scripts/check-no-presale.mjs, scripts/isMain.mjs and the decoder source need to exist at the copy.
  const copyToSpacePath = () => {
    const spaceDir = join(tmp, 'a directory with a space');
    mkdirSync(join(spaceDir, 'scripts'), {recursive: true});
    mkdirSync(join(spaceDir, 'src/background/dapp/decode'), {recursive: true});
    cpSync(join(ROOT, 'scripts/check-no-presale.mjs'), join(spaceDir, 'scripts/check-no-presale.mjs'));
    cpSync(join(ROOT, 'scripts/isMain.mjs'), join(spaceDir, 'scripts/isMain.mjs'));
    cpSync(join(ROOT, 'src/background/dapp/decode/presaleIdl.ts'), join(spaceDir, 'src/background/dapp/decode/presaleIdl.ts'));
    return join(spaceDir, 'scripts/check-no-presale.mjs');
  };

  it.each([
    ['its normal repository path', () => join(ROOT, 'scripts/check-no-presale.mjs')],
    ['a path containing a space (review I2)', copyToSpacePath],
  ])('passes a good pair (exit 0, the ok line) and fails a swapped one (exit 1), run from %s', (_label, scriptPathFor) => {
    const scriptPath = scriptPathFor();
    const {off, on} = buildGoodPair();
    const good = runCli(scriptPath, [off, on]);
    expect(good.status).toBe(0);
    expect(good.stdout).toMatch(/^no presale ok \(/);
    const swapped = runCli(scriptPath, [on, off]);
    expect(swapped.status).toBe(1);
  });
});

// Fix round 1 (review I2): every gate that has this CLI main-guard imports the shared helper — a gate whose guard
// never fires passes `npm run gates` without having run at all.
describe('every gate with a CLI main-guard imports isMain', () => {
  const GATE_FILES = [
    'check-no-presale.mjs',
    'check-classes.mjs',
    'check-fonts.mjs',
    'check-no-tge-date.mjs',
    'check-page-bundles.mjs',
    'check-permissions.mjs',
    'check-rpc-methods.mjs',
    'check-vault-isolation.mjs',
  ];

  it.each(GATE_FILES)('%s imports isMain from ./isMain.mjs and guards on isMain(import.meta.url)', file => {
    const source = readFileSync(join(ROOT, 'scripts', file), 'utf8');
    expect(source).toMatch(/import \{isMain\} from '\.\/isMain\.mjs';/);
    expect(source).toMatch(/if \(isMain\(import\.meta\.url\)\) \{/);
    expect(source).not.toMatch(/file:\/\/\$\{process\.argv\[1\]\}/);
  });
});
