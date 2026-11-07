import {spawnSync} from 'node:child_process';
import {generateKeyPairSync} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {STORE_KEY, STORE_KEY_PATH, extensionId, readStoreKey, storeKeyProblems} from '../storeKey.mjs';
import {comparePermissions} from '../check-permissions.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BUILD_MS = 180_000;
// The ID Chromium itself gave an unpacked extension carrying this key (the dry run's probe) — not our derivation.
const VECTOR = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/chrome-id-vector.json'), 'utf8'));
const RECORDED = {id: VECTOR.id, key: VECTOR.key};
const BUILD_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_ENV'));
const build = args => spawnSync('node', ['scripts/build.mjs', ...args], {cwd: ROOT, encoding: 'utf8', env: BUILD_ENV});

// B1e §5.3: release/store-key.json — exactly {id, key} as the store assigns them — read only by --dev-key.
describe('the store key (B1e §5.3)', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'store-key-'));
  });
  afterEach(() => rmSync(dir, {recursive: true, force: true}));
  const file = text => {
    const p = join(dir, 'store-key.json');
    writeFileSync(p, text);
    return p;
  };

  it('is release/store-key.json in the package', () => {
    expect(STORE_KEY).toBe('release/store-key.json');
    expect(STORE_KEY_PATH).toBe(join(ROOT, 'release', 'store-key.json'));
  });

  it('derives the ID Chromium gives the key (the observed vector); another key gives another ID', () => {
    expect(extensionId(Buffer.from(VECTOR.key, 'base64'))).toBe(VECTOR.id);
    const other = generateKeyPairSync('rsa', {modulusLength: 2048}).publicKey.export({type: 'spki', format: 'der'});
    expect(extensionId(other)).toMatch(/^[a-p]{32}$/);
    expect(extensionId(other)).not.toBe(VECTOR.id);
  });

  it('reads a well-formed file: exactly {id, key} (positive control)', () => {
    expect(storeKeyProblems(RECORDED)).toEqual([]);
    expect(readStoreKey(file(`${JSON.stringify(RECORDED, null, 2)}\n`))).toEqual(RECORDED);
    expect(readStoreKey(file(JSON.stringify({key: VECTOR.key, id: VECTOR.id})))).toEqual(RECORDED);
  });

  it('refuses an absent file, naming the step that records it', () => {
    expect(() => readStoreKey(join(dir, 'store-key.json'))).toThrow(/store-key\.json: absent — the store assigns the ID at the first upload; record \{id, key\} then \(B1e §5\.3, §7 step 7\)/);
  });

  it.each([['', /unreadable or not JSON/], ['{"id": ', /unreadable or not JSON/], ['null', /must be a JSON object \{id, key\}/], ['[]', /must be a JSON object \{id, key\}/], ['"x"', /must be a JSON object \{id, key\}/]])(
    'refuses a file that is not a JSON object: %j',
    (text, why) => {
      expect(() => readStoreKey(file(text))).toThrow(why);
    },
  );

  it.each([
    ['an extra field', {...RECORDED, name: 'Noctura'}, 'must hold exactly the fields id and key, has id, key, name'],
    ['no id', {key: VECTOR.key}, 'must hold exactly the fields id and key, has key'],
    ['no key', {id: VECTOR.id}, 'must hold exactly the fields id and key, has id'],
    ['nothing', {}, 'must hold exactly the fields id and key, has none'],
    ['an id of 31 letters', {...RECORDED, id: VECTOR.id.slice(1)}, `id must be 32 letters a–p, is "${VECTOR.id.slice(1)}"`],
    ['an id in capitals', {...RECORDED, id: VECTOR.id.toUpperCase()}, `id must be 32 letters a–p, is "${VECTOR.id.toUpperCase()}"`],
    ['an id with a q', {...RECORDED, id: `q${VECTOR.id.slice(1)}`}, `id must be 32 letters a–p, is "q${VECTOR.id.slice(1)}"`],
    ['an id that is a number', {...RECORDED, id: 1}, 'id must be 32 letters a–p, is 1'],
  ])('refuses %s', (_, value, why) => {
    expect(storeKeyProblems(value)).toEqual([why]);
    expect(() => readStoreKey(file(JSON.stringify(value)))).toThrow(why);
  });

  const B64 = 'key must be the public key as one line of canonical base64 (no PEM BEGIN / END lines, no line breaks)';
  it.each([
    ['PEM armour', `-----BEGIN PUBLIC KEY-----\n${VECTOR.key}\n-----END PUBLIC KEY-----`, B64],
    ['line breaks', `${VECTOR.key.slice(0, 64)}\n${VECTOR.key.slice(64)}`, B64],
    ['a trailing space', `${VECTOR.key} `, B64],
    ['base64url', VECTOR.key.replace(/\+/g, '-').replace(/\//g, '_'), B64],
    ['non-canonical padding bits', 'AB==', B64],
    ['an empty string', '', B64],
    ['a number', 7, B64],
    ['base64 of bytes that are no public key', Buffer.from('not a key at all').toString('base64'), 'key is not a DER SubjectPublicKeyInfo public key'],
  ])('refuses a key with %s', (_, key, why) => {
    expect(storeKeyProblems({id: VECTOR.id, key})).toEqual([why]);
  });

  it('refuses a well-formed id that is not the key’s own ID', () => {
    const other = generateKeyPairSync('rsa', {modulusLength: 2048}).publicKey.export({type: 'spki', format: 'der'}).toString('base64');
    expect(storeKeyProblems({id: VECTOR.id, key: other})).toEqual([`id ${VECTOR.id} is not the ID of this key (${extensionId(Buffer.from(other, 'base64'))})`]);
    expect(storeKeyProblems({id: extensionId(Buffer.from(other, 'base64')), key: other})).toEqual([]);
  });
});

// The build's side: --dev-key reads the fixed path before building anything, and writes only into a named directory.
describe('build.mjs --dev-key (B1e §5.3)', () => {
  const REFUSED = '--dev-key builds only into a directory named on the command line, never dist/, dist-nopresale/ or anything under them (B1e §5.3).';
  it('refuses without a directory, or with dist/ or dist-nopresale/, before reading the key or building', () => {
    for (const args of [['--dev-key'], ['--dev-key', '--no-presale'], ['dist', '--dev-key'], [join(ROOT, 'dist-nopresale'), '--dev-key', '--no-presale'], ['./dist/', '--dev-key']]) {
      const r = build(args);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain(REFUSED);
    }
  });

  it('refuses any directory under dist/ or dist-nopresale/ (B1e-2, review M2: a prefix test on the resolved path)', () => {
    for (const args of [['dist-nopresale/chrome', '--dev-key', '--no-presale'], [join(ROOT, 'dist', 'a', 'b'), '--dev-key'], ['./dist-nopresale/chrome/../firefox', '--dev-key', '--no-presale']]) {
      const r = build(args);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain(REFUSED);
    }
  });

  it.runIf(!existsSync(STORE_KEY_PATH))('a sibling whose name only starts like them is not refused by that rule (positive control: it stops at the absent key)', () => {
    const r = build([join(ROOT, 'dist-nopresale-elsewhere'), '--dev-key', '--no-presale']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).not.toContain(REFUSED);
    expect(r.stderr).toContain(`${STORE_KEY_PATH}: absent`);
    expect(existsSync(join(ROOT, 'dist-nopresale-elsewhere'))).toBe(false);
  });

  it.runIf(!existsSync(STORE_KEY_PATH))('refuses while release/store-key.json is absent (until §7 step 7), and builds nothing', () => {
    const parent = mkdtempSync(join(tmpdir(), 'dev-key-absent-'));
    try {
      const out = join(parent, 'out');
      const r = build([out, '--dev-key', '--no-presale']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain(`${STORE_KEY_PATH}: absent — the store assigns the ID at the first upload`);
      expect(existsSync(out)).toBe(false);
    } finally {
      rmSync(parent, {recursive: true, force: true});
    }
  });

  it.runIf(existsSync(STORE_KEY_PATH))(
    'once recorded: the Chrome manifest carries the recorded key, Firefox none, and both pass the gate against the file',
    () => {
      const recorded = readStoreKey();
      const out = mkdtempSync(join(tmpdir(), 'dev-key-'));
      try {
        const r = build([out, '--dev-key', '--no-presale']);
        expect(r.status).toBe(0);
        const chrome = JSON.parse(readFileSync(join(out, 'chrome', 'manifest.json'), 'utf8'));
        const firefox = JSON.parse(readFileSync(join(out, 'firefox', 'manifest.json'), 'utf8'));
        expect(chrome.key).toBe(recorded.key);
        expect(Object.hasOwn(firefox, 'key')).toBe(false);
        expect(comparePermissions(chrome, 'chrome', {recorded})).toEqual([]);
        expect(comparePermissions(firefox, 'firefox', {recorded})).toEqual([]);
        expect(comparePermissions(chrome, 'chrome')).toEqual(['chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
      } finally {
        rmSync(out, {recursive: true, force: true});
      }
    },
    BUILD_MS,
  );
});
