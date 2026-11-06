import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {REQUIRED_CONNECT_SRC, REQUIRED_CONTENT_SCRIPTS, REQUIRED_CSP, VERSION_PATTERN, comparePermissions, connectSrcViolations, contentScriptViolations, cspViolations, keyViolations, versionViolations} from '../check-permissions.mjs';
import {EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION, VERSION, isReleaseVersion, packageVersion, render} from '../../manifest/source.mjs';
import {STORE_KEY_PATH, readStoreKey} from '../storeKey.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// package.json read by the test itself — neither source.mjs's VERSION nor the gate's own read.
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const VECTOR = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/chrome-id-vector.json'), 'utf8'));
const RECORDED = {id: VECTOR.id, key: VECTOR.key};

describe('permissions gate', () => {
  it('accepts the rendered manifests', () => {
    expect(comparePermissions(render('chrome'), 'chrome')).toEqual([]);
    expect(comparePermissions(render('firefox'), 'firefox')).toEqual([]);
  });

  it('refuses an added permission', () => {
    const m = render('chrome');
    m.permissions = [...m.permissions, 'tabs'];
    expect(comparePermissions(m, 'chrome')).toEqual(['permissions differ: storage,alarms,tabs']);
  });

  it('refuses an added host', () => {
    const m = render('firefox');
    m.host_permissions = [...m.host_permissions, '<all_urls>'];
    expect(comparePermissions(m, 'firefox')[0]).toMatch(/^host_permissions differ/);
  });

  // B1c §6.2 (review L4): both content-script entries pinned in place of B1b's "no content_scripts" line.
  it('pins the two content scripts — matches, world, run_at, all_frames — and refuses any change, extra or missing entry', () => {
    expect(REQUIRED_CONTENT_SCRIPTS).toEqual([
      {matches: ['<all_urls>'], js: ['provider.js'], run_at: 'document_start', all_frames: false, world: 'MAIN'},
      {matches: ['<all_urls>'], js: ['relay.js'], run_at: 'document_start', all_frames: false, world: 'ISOLATED'},
    ]);
    const changed = [
      m => (m.content_scripts[0].all_frames = true),
      m => (m.content_scripts[1].world = 'MAIN'),
      m => (m.content_scripts[0].run_at = 'document_idle'),
      m => (m.content_scripts[1].matches = ['<all_urls>', 'file:///*']),
      m => m.content_scripts.push({matches: ['<all_urls>'], js: ['x.js']}),
      m => m.content_scripts.pop(),
      m => (m.content_scripts[0].match_about_blank = true),
      m => delete m.content_scripts,
    ];
    for (const change of changed) {
      const m = render('chrome');
      change(m);
      expect(comparePermissions(m, 'chrome').some(p => p.startsWith('content_scripts'))).toBe(true);
    }
    expect(contentScriptViolations(render('firefox').content_scripts)).toEqual([]);
  });

  it('refuses a loosened CSP', () => {
    const m = render('chrome');
    m.content_security_policy = {extension_pages: "script-src 'self' 'unsafe-eval'"};
    expect(comparePermissions(m, 'chrome')[0]).toMatch(/^CSP differs/);
  });

  // Fix round 3: the runtime backstop for check-rpc-methods.mjs's text-based checks. Pinned
  // independent of EXTENSION_CSP (REQUIRED_CONNECT_SRC is its own hardcoded list, not read from
  // it), so a loosened EXTENSION_CSP is caught here too, not just a manifest that drifted from it.
  it('requires connect-src to be exactly the coordinator host, nothing else', () => {
    expect(REQUIRED_CONNECT_SRC).toEqual(['https://api.noc-tura.io']);
    expect(connectSrcViolations(EXTENSION_CSP)).toEqual([]);
    expect(connectSrcViolations("script-src 'self'; object-src 'self'")).toEqual([
      'connect-src is "(missing)", want exactly "https://api.noc-tura.io"',
    ]);
    expect(connectSrcViolations("script-src 'self'; connect-src https://api.noc-tura.io https://evil.example")).toEqual([
      'connect-src is "https://api.noc-tura.io https://evil.example", want exactly "https://api.noc-tura.io"',
    ]);
    expect(connectSrcViolations("script-src 'self'; connect-src *")).toEqual([
      'connect-src is "*", want exactly "https://api.noc-tura.io"',
    ]);
    expect(connectSrcViolations("script-src 'self'; connect-src 'self' https://api.noc-tura.io")).toEqual([
      'connect-src is "\'self\' https://api.noc-tura.io", want exactly "https://api.noc-tura.io"',
    ]);
  });

  // Controller hardening (2026-10-01): every directive is pinned here, independent of EXTENSION_CSP, so a
  // loosened source.mjs fails too — not just a manifest that drifted from it.
  it('pins every directive of the extension CSP, independent of source.mjs', () => {
    expect(REQUIRED_CSP).toEqual([
      ['default-src', "'self'"],
      ['script-src', "'self'"],
      ['object-src', "'self'"],
      ['style-src', "'self'"],
      ['img-src', "'self' data:"],
      ['font-src', "'self'"],
      ['connect-src', 'https://api.noc-tura.io'],
      ['base-uri', "'none'"],
      ['form-action', "'none'"],
      ['frame-ancestors', "'none'"],
    ]);
    expect(cspViolations(EXTENSION_CSP)).toEqual([]);
    expect(EXTENSION_CSP).toBe(REQUIRED_CSP.map(([d, v]) => `${d} ${v}`).join('; '));
  });

  it.each(['default-src', 'style-src', 'img-src', 'font-src', 'base-uri', 'form-action', 'frame-ancestors', 'script-src', 'object-src'])(
    'refuses a CSP without %s (negative control)',
    name => {
      const csp = EXTENSION_CSP.split('; ').filter(d => !d.startsWith(`${name} `)).join('; ');
      const want = REQUIRED_CSP.find(([d]) => d === name)[1];
      expect(cspViolations(csp)).toEqual([`${name} is "(missing)", want exactly "${want}"`]);
      const m = render('firefox');
      m.content_security_policy = {extension_pages: csp};
      expect(comparePermissions(m, 'firefox')).toEqual([`CSP differs: ${csp}`, `${name} is "(missing)", want exactly "${want}"`]);
    },
  );

  it.each([
    ["style-src 'self' 'unsafe-inline'", 'style-src', "'self' 'unsafe-inline'"],
    ["style-src 'self' https://fonts.googleapis.com", 'style-src', "'self' https://fonts.googleapis.com"],
    ['img-src *', 'img-src', '*'],
    ["img-src 'self' data: https:", 'img-src', "'self' data: https:"],
    ["font-src 'self' data:", 'font-src', "'self' data:"],
    ["default-src *", 'default-src', '*'],
    ["base-uri 'self'", 'base-uri', "'self'"],
  ])('refuses a loosened directive: %s', (directive, name, got) => {
    const csp = EXTENSION_CSP.split('; ').map(d => (d.startsWith(`${name} `) ? directive : d)).join('; ');
    const want = REQUIRED_CSP.find(([d]) => d === name)[1];
    expect(cspViolations(csp)).toEqual([`${name} is "${got}", want exactly "${want}"`]);
  });

  it('refuses an extra or a repeated directive', () => {
    expect(cspViolations(`${EXTENSION_CSP}; worker-src *`)).toEqual(['unexpected directive "worker-src *"']);
    expect(cspViolations(`${EXTENSION_CSP}; style-src 'unsafe-inline'`)).toEqual(['directive style-src appears twice']);
    expect(cspViolations(`${EXTENSION_CSP};`)).toEqual([]);
  });

  it('refuses a built manifest whose CSP is missing connect-src', () => {
    const m = render('chrome');
    m.content_security_policy = {extension_pages: "script-src 'self'; object-src 'self'"};
    expect(comparePermissions(m, 'chrome')).toEqual(
      expect.arrayContaining(['connect-src is "(missing)", want exactly "https://api.noc-tura.io"']),
    );
  });

  it('refuses a Firefox manifest without gecko.id', () => {
    const m = render('firefox');
    delete m.browser_specific_settings.gecko.id;
    expect(comparePermissions(m, 'firefox')).toContain('firefox: gecko.id missing');
  });

  it('pins the minimum browsers to the plan: Chrome 122, Firefox 150', () => {
    expect(MIN_CHROME_VERSION).toBe('122');
    expect(MIN_FIREFOX_VERSION).toBe('150.0');
  });

  it('refuses a Chrome manifest with a different or missing minimum_chrome_version', () => {
    const lowered = render('chrome');
    lowered.minimum_chrome_version = '100';
    expect(comparePermissions(lowered, 'chrome')).toEqual(['chrome: minimum_chrome_version differs: 100']);
    const missing = render('chrome');
    delete missing.minimum_chrome_version;
    expect(comparePermissions(missing, 'chrome')).toEqual(['chrome: minimum_chrome_version differs: undefined']);
  });

  it('refuses a Firefox manifest with a different or missing gecko.strict_min_version', () => {
    const lowered = render('firefox');
    lowered.browser_specific_settings.gecko.strict_min_version = '128.0';
    expect(comparePermissions(lowered, 'firefox')).toEqual(['firefox: gecko.strict_min_version differs: 128.0']);
    const missing = render('firefox');
    delete missing.browser_specific_settings.gecko.strict_min_version;
    expect(comparePermissions(missing, 'firefox')).toEqual(['firefox: gecko.strict_min_version differs: undefined']);
  });

  // B1e §5.2 (R5): one version source, package.json; every built manifest carries it.
  it('both manifests carry package.json\'s version, which matches the release pattern (no constant)', () => {
    expect(PKG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(VERSION).toBe(PKG_VERSION);
    expect(render('chrome').version).toBe(PKG_VERSION);
    expect(render('firefox').version).toBe(PKG_VERSION);
    expect(VERSION_PATTERN.source).toBe('^\\d+\\.\\d+\\.\\d+$');
    expect(readFileSync(join(ROOT, 'manifest/source.mjs'), 'utf8')).not.toMatch(/version: '|\bVERSION = '/);
  });

  it('refuses a hand-edited or missing version, and a package.json version outside the pattern', () => {
    for (const browser of ['chrome', 'firefox']) {
      const m = render(browser);
      m.version = '1.0.1';
      expect(comparePermissions(m, browser)).toEqual([`version is "1.0.1", want package.json's ${JSON.stringify(PKG_VERSION)}`]);
      delete m.version;
      expect(comparePermissions(m, browser)).toEqual([`version is undefined, want package.json's ${JSON.stringify(PKG_VERSION)}`]);
    }
    expect(versionViolations({version: '1.0'}, '1.0')).toEqual(['package.json version "1.0" does not match /^\\d+\\.\\d+\\.\\d+$/', 'version "1.0" does not match /^\\d+\\.\\d+\\.\\d+$/']);
    expect(versionViolations({version: '1.0.0.1'}, '1.0.0')).toEqual(['version is "1.0.0.1", want package.json\'s "1.0.0"']);
    expect(versionViolations({}, undefined)).toEqual([`version is undefined, want package.json's ${JSON.stringify(PKG_VERSION)}`]);
    expect(versionViolations({version: '2.3.4'}, '2.3.4')).toEqual([]);
  });

  it.each(['1.0.0', '0.0.0', '10.20.30', '65535.65535.65535'])('source.mjs accepts the version %j', v => expect(isReleaseVersion(v)).toBe(true));
  it.each(['1.0', '1.0.0.0', '01.0.0', '1.00.0', '1.0.65536', '1.0.0-beta', ' 1.0.0', 'v1.0.0', '', 1, undefined])('source.mjs refuses the version %j', v =>
    expect(isReleaseVersion(v)).toBe(false),
  );

  it('source.mjs reads package.json and throws on a missing or malformed version (the build fails)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkg-version-'));
    try {
      const pkg = json => {
        const p = join(dir, 'package.json');
        writeFileSync(p, JSON.stringify(json));
        return pathToFileURL(p);
      };
      expect(packageVersion(pkg({name: 'x', version: '3.2.1'}))).toBe('3.2.1');
      expect(() => packageVersion(pkg({name: 'x'}))).toThrow(/version must be three integers 0–65535 without leading zeros \(B1e §5\.2\), is undefined/);
      expect(() => packageVersion(pkg({name: 'x', version: '0.1'}))).toThrow(/is "0\.1"/);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  // B1e §5.3: the `key` render option — never by default; Chrome only.
  it('render adds a key only when given one, for Chrome only', () => {
    expect(Object.hasOwn(render('chrome'), 'key')).toBe(false);
    expect(Object.hasOwn(render('chrome', {}), 'key')).toBe(false);
    expect(Object.hasOwn(render('firefox'), 'key')).toBe(false);
    expect(render('chrome', {key: VECTOR.key}).key).toBe(VECTOR.key);
    const {key: _key, ...rest} = render('chrome', {key: VECTOR.key});
    expect(rest).toEqual(render('chrome'));
    expect(() => render('firefox', {key: VECTOR.key})).toThrow('a manifest key is a non-empty string for Chrome only (B1e §5.3)');
    expect(() => render('chrome', {key: ''})).toThrow('a manifest key is a non-empty string for Chrome only');
    expect(() => render('chrome', {key: 1})).toThrow('a manifest key is a non-empty string for Chrome only');
  });

  it('refuses a key in a dist/ or dist-nopresale/ manifest, Chrome or Firefox', () => {
    expect(comparePermissions(render('chrome'), 'chrome')).toEqual([]);
    const chrome = {...render('chrome'), key: VECTOR.key};
    expect(comparePermissions(chrome, 'chrome')).toEqual(['chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
    const firefox = {...render('firefox'), key: VECTOR.key};
    expect(comparePermissions(firefox, 'firefox')).toEqual(['firefox: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
    expect(keyViolations({...render('chrome'), key: undefined}, 'chrome', undefined)).toEqual(['chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
  });

  it('a --dev-key build: Chrome\'s key equals the recorded one (read from a store-key file), Firefox carries none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dev-key-gate-'));
    try {
      const path = join(dir, 'store-key.json');
      writeFileSync(path, JSON.stringify(RECORDED));
      const recorded = readStoreKey(path);
      expect(comparePermissions(render('chrome', {key: recorded.key}), 'chrome', {recorded})).toEqual([]);
      expect(comparePermissions(render('firefox'), 'firefox', {recorded})).toEqual([]);
      expect(comparePermissions(render('chrome'), 'chrome', {recorded})).toEqual([`chrome: key missing, want the recorded store key (release/store-key.json, id ${VECTOR.id})`]);
      const other = render('chrome', {key: `${recorded.key.slice(0, -8)}AAAAAAAA`});
      expect(comparePermissions(other, 'chrome', {recorded})).toEqual([`chrome: key differs from the recorded store key (release/store-key.json, id ${VECTOR.id})`]);
      expect(comparePermissions({...render('firefox'), key: recorded.key}, 'firefox', {recorded})).toEqual(['firefox: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});

// The gate as `npm run gates` runs it, over a build directory written for the test (cwd = a temp package root).
describe('check-permissions.mjs (CLI)', () => {
  const GATE = join(ROOT, 'scripts/check-permissions.mjs');
  let cwd;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'perm-cli-'));
  });
  afterEach(() => rmSync(cwd, {recursive: true, force: true}));
  const write = (dist, manifests) => {
    for (const [browser, m] of Object.entries(manifests)) {
      mkdirSync(join(cwd, dist, browser), {recursive: true});
      writeFileSync(join(cwd, dist, browser, 'manifest.json'), JSON.stringify(m));
    }
  };
  const run = (env, args = []) => spawnSync('node', [GATE, ...args], {cwd, encoding: 'utf8', env: {...process.env, ...env}});

  it.each(['dist', 'dist-nopresale'])('%s: passes the rendered manifests (positive control), fails a key or a hand-edited version', dist => {
    write(dist, {chrome: render('chrome'), firefox: render('firefox')});
    const ok = run({NOCTURA_DIST: dist});
    expect([ok.status, ok.stdout.trim()]).toEqual([0, `permissions ok (${dist}): both manifests match manifest/source.mjs, version ${PKG_VERSION}, no key`]);
    write(dist, {chrome: {...render('chrome'), key: VECTOR.key}});
    const keyed = run({NOCTURA_DIST: dist});
    expect([keyed.status, keyed.stderr.trim()]).toEqual([1, 'chrome: chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
    write(dist, {chrome: render('chrome'), firefox: {...render('firefox'), version: '0.1.0'}});
    const edited = run({NOCTURA_DIST: dist});
    expect([edited.status, edited.stderr.trim()]).toEqual([1, `firefox: version is "0.1.0", want package.json's ${JSON.stringify(PKG_VERSION)}`]);
  });

  it.runIf(!existsSync(STORE_KEY_PATH))('--dev-key <outDir> refuses while release/store-key.json is absent', () => {
    write('out', {chrome: render('chrome', {key: VECTOR.key}), firefox: render('firefox')});
    const r = run({}, ['--dev-key', 'out']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain(`${STORE_KEY_PATH}: absent`);
  });

  it('refuses other arguments', () => {
    for (const args of [['--dev-key'], ['out'], ['--dev-key', 'a', 'b']]) {
      const r = run({}, args);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('usage: node scripts/check-permissions.mjs [--dev-key <outDir>]');
    }
  });
});

