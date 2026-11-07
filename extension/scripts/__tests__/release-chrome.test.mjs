import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  INSTALLED_FIELDS,
  INSTALLED_LOCKFILE,
  LIVE_TIMEOUT_MS,
  LOCKFILE,
  OUT_DIR,
  PACKAGE,
  RP_ID_FILE,
  RP_ID_RECORD,
  RP_ID_SOURCE,
  STEPS,
  GIT_STATUS,
  childEnv,
  cliProblem,
  installedTreeProblems,
  notesPath,
  partialPath,
  readRpId,
  realIo,
  refusalLines,
  releaseNotes,
  releaseSteps,
  rpIdProblems,
  runRelease,
  timedFetch,
  treeProblems,
  zipPath,
  zipWitnessProblems,
} from '../release-chrome.mjs';
import {CONTACT, LIVE_PAGES} from '../live-check.mjs';
import {zipFiles} from '../zip-store.mjs';
import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
import {RP_ID} from '../../src/vault/passkey';
import {appConfig} from '../../vite.config';
import {contentConfig} from '../../vite.content.config';
import {ENV_FILE, envFilesIn} from '../buildEnv.mjs';

// B1e §5.1, §5.6, §6.5: `npm run release:chrome` — the orchestrator and its steps, offline. Every step's world is an
// injected io (a recorder): no test runs `npm run verify`, builds, zips the real package, writes outside a temp dir or
// reaches the network. globalThis.fetch is replaced by a recorder that throws, for every test, and must stay unused.
// Two rows spawn a real process: realIo's run (a one-line `node -e`) and build.mjs refusing a NODE_ENV — which it does
// before anything is built.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PASSKEY_TS = readFileSync(join(ROOT, RP_ID_SOURCE), 'utf8');
const RP_ID_JSON = readFileSync(join(ROOT, RP_ID_FILE), 'utf8');
const COMMIT = 'c0ffee'.padEnd(40, '0');
const DIGEST = 'd'.repeat(64);
const LOCK_SHA = '1'.repeat(64);
/** A lockfile and npm's record of the tree it installed from it (the final review's I3): `fsevents` is optional, for another platform, and so not installed. */
const pkg = (name, extra = {}) => ({version: '1.0.0', resolved: `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`, integrity: `sha512-${name}`, ...extra});
const LOCK_PACKAGES = {
  '': {name: 'noctura-extension', version: '1.0.0'},
  'node_modules/a': pkg('a'),
  'node_modules/b': pkg('b', {dev: true}),
  'node_modules/a/node_modules/c': pkg('c'),
  'node_modules/fsevents': pkg('fsevents', {dev: true, optional: true}),
  'node_modules/@noctura/core': {resolved: '../core', link: true},
};
const lockJson = (packages, lockfileVersion = 3) => JSON.stringify({name: 'noctura-extension', version: '1.0.0', lockfileVersion, requires: true, packages}, null, 2);
const LOCK_TEXT = lockJson(LOCK_PACKAGES);
const installedOf = (packages = LOCK_PACKAGES) =>
  Object.fromEntries(Object.entries(packages).filter(([name, e]) => name !== '' && !(e.optional === true && name.endsWith('fsevents'))));
const INSTALLED_TEXT = lockJson(installedOf());
const sha256 = b => createHash('sha256').update(b).digest('hex');
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
/** The package as the fake io sees it: 28 files, and a real §5.4 zip of exactly them (Task 2's writer). */
const PACKED = Array.from({length: 28}, (_, i) => ({path: `f${i}`, bytes: Buffer.from(`file ${i}\n`)})).sort(byPath);
const FILES = PACKED.map(f => ({path: f.path, sha256: sha256(f.bytes)}));
const ZIP = zipFiles(PACKED);

let globalCalls;
let realFetch;
beforeEach(() => {
  globalCalls = [];
  realFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    globalCalls.push(String(url));
    throw new Error('the global fetch is not to be used');
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  expect(globalCalls).toEqual([]);
});

const pageHtml = page =>
  page.sentences
    ? `<h1>${page.title}</h1>${PRIVACY_SENTENCES.map(s => `<p>${s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')}`
    : `<h1>${page.title.replace(/&/g, '&amp;')}</h1><p>${CONTACT}</p>`;
const live = async url => ({status: 200, headers: {get: () => null}, text: async () => pageHtml(LIVE_PAGES.find(p => p.url === url))});
const notFound = async () => ({status: 404, headers: {get: () => null}, text: async () => 'Not Found'});

/** The files the fake io reads, each replaceable (`over`: path → text, or undefined for an absent file). */
const readWith = over => path =>
  ({[RP_ID_FILE]: RP_ID_JSON, [RP_ID_SOURCE]: PASSKEY_TS, [LOCKFILE]: LOCK_TEXT, [INSTALLED_LOCKFILE]: INSTALLED_TEXT, ...over})[path];

/**
 * A recording io in which every step passes (the positive control); `over` (an object, or a function of `calls` and
 * `written`) replaces any member. `calls` lists, in order, every effect a step asked for: a command run, a git question,
 * a digest, a GET, a zip, a write, a move into place, a removal. `written` is the file system the run left.
 */
function fakeIo(over = {}) {
  const calls = [];
  const written = new Map();
  const io = {
    version: '1.0.0',
    node: 'v22.12.0',
    env: {},
    run: (cmd, args) => {
      calls.push(`run ${cmd} ${args.join(' ')}`);
      return 0;
    },
    git: args => {
      calls.push(`git ${args.join(' ')}`);
      return args[0] === 'rev-parse' ? `${COMMIT}\n` : '';
    },
    tempDir: () => {
      calls.push('tempDir');
      return '/tmp/witness';
    },
    removeDir: dir => calls.push(`removeDir ${dir}`),
    digest: dir => {
      calls.push(`digest ${dir}`);
      return {files: FILES, digest: DIGEST};
    },
    exists: path => written.has(path),
    list: dir => [...written.keys()].filter(path => path.startsWith(`${dir}/`)).map(path => path.slice(dir.length + 1)),
    read: readWith({}),
    hashFile: path => (path === LOCKFILE ? LOCK_SHA : undefined),
    fetch: async (url, init) => {
      calls.push(`GET ${url}`);
      expect(init).toMatchObject({method: 'GET', redirect: 'manual'});
      return live(url);
    },
    zip: dir => {
      calls.push(`zip ${dir}`);
      return Buffer.from(ZIP);
    },
    write: (path, bytes) => {
      calls.push(`write ${path}`);
      written.set(path, Buffer.from(bytes));
    },
    place: (from, to) => {
      calls.push(`place ${from} ${to}`);
      written.set(to, written.get(from));
      written.delete(from);
    },
    remove: path => {
      calls.push(`remove ${path}`);
      written.delete(path);
    },
    ...(typeof over === 'function' ? over(calls, written) : over),
  };
  return {io, calls, written};
}

const release = async (over, log = () => {}) => {
  const f = fakeIo(over);
  const result = await runRelease(releaseSteps(f.io), log);
  return {...f, result};
};

const GETS = LIVE_PAGES.map(p => `GET ${p.url}`);
const [ZIP_PATH, NOTES_PATH] = [zipPath('1.0.0'), notesPath('1.0.0')];
const EVERYTHING = [
  'git status --porcelain --untracked-files=all --ignore-submodules=none',
  'git rev-parse HEAD',
  ...GETS,
  'run npm run verify',
  'tempDir',
  'run node scripts/build.mjs /tmp/witness --no-presale',
  'digest /tmp/witness/chrome',
  `digest ${PACKAGE}`,
  'removeDir /tmp/witness',
  ...GETS,
  `zip ${PACKAGE}`,
  `zip ${PACKAGE}`,
  `digest ${PACKAGE}`,
  'git status --porcelain --untracked-files=all --ignore-submodules=none',
  'git rev-parse HEAD',
  `write ${partialPath(ZIP_PATH)}`,
  `write ${partialPath(NOTES_PATH)}`,
  `place ${partialPath(ZIP_PATH)} ${ZIP_PATH}`,
  `place ${partialPath(NOTES_PATH)} ${NOTES_PATH}`,
];
/** The calls up to and including the `nth` (1-based) one matching `last` — what a run that refuses there may have done. */
const upTo = (last, nth = 1) => {
  let seen = 0;
  return EVERYTHING.slice(0, EVERYTHING.findIndex(c => c.startsWith(last) && (seen += 1) === nth) + 1);
};

describe('release:chrome — the order (B1e §5.1, E26)', () => {
  it('is §5.1 in order, after a preflight and the live pre-check: verify, the third witness, the RP-ID record, the live check, the zip twice, the write', () => {
    expect(STEPS).toEqual(['preflight', 'livePrecheck', 'verify', 'witness', 'rpId', 'liveCheck', 'zip', 'write']);
  });

  it('runs every step in that order, and each sees what the ones before it produced', async () => {
    const seen = [];
    const steps = Object.fromEntries(
      STEPS.map(name => [
        name,
        async done => {
          seen.push([name, Object.keys(done)]);
          return {problems: [], value: name.toUpperCase()};
        },
      ]),
    );
    const result = await runRelease(steps, () => {});
    expect(result).toMatchObject({ok: true});
    expect(seen).toEqual(STEPS.map((name, i) => [name, STEPS.slice(0, i)]));
  });

  it.each(STEPS.map((name, i) => [name, i]))('a refusal at %s stops everything after it (and a throw is a refusal)', async (failing, i) => {
    for (const how of ['problems', 'throw']) {
      const ran = [];
      const steps = Object.fromEntries(
        STEPS.map(name => [
          name,
          async () => {
            ran.push(name);
            if (name !== failing) return {problems: []};
            if (how === 'throw') throw new Error('boom');
            return {problems: ['no']};
          },
        ]),
      );
      const result = await runRelease(steps, () => {});
      expect(ran).toEqual(STEPS.slice(0, i + 1));
      expect(result).toEqual({ok: false, stoppedAt: failing, problems: [how === 'throw' ? `${failing}: boom` : 'no']});
    }
  });

  it('refuses a missing step and a step that answers nothing usable, before running anything after it', async () => {
    const steps = Object.fromEntries(STEPS.map(name => [name, async () => ({problems: []})]));
    await expect(runRelease({...steps, liveCheck: undefined}, () => {})).resolves.toEqual({
      ok: false,
      stoppedAt: 'liveCheck',
      problems: ['liveCheck: no such step'],
    });
    await expect(runRelease({...steps, rpId: async () => undefined}, () => {})).resolves.toEqual({
      ok: false,
      stoppedAt: 'rpId',
      problems: ['rpId: answered no problem list'],
    });
  });

  it('the live check runs twice: three GETs before verify (nothing built yet), three after the RP-ID record — six per run', async () => {
    const {calls} = await release({});
    const gets = calls.map((c, i) => [c, i]).filter(([c]) => c.startsWith('GET '));
    expect(gets.map(([c]) => c)).toEqual([...GETS, ...GETS]);
    const verify = calls.indexOf('run npm run verify');
    const witnessed = calls.indexOf('removeDir /tmp/witness');
    expect(gets.slice(0, 3).every(([, i]) => i < verify)).toBe(true);
    expect(gets.slice(3).every(([, i]) => i > witnessed && i < calls.indexOf(`zip ${PACKAGE}`))).toBe(true);
  });
});

describe('release:chrome — the steps over an injected io (positive control)', () => {
  it('all green: every effect in order, the zip and the notes written last, nothing else left', async () => {
    const lines = [];
    const {result, calls, written} = await release({}, line => lines.push(line));
    expect(result).toMatchObject({ok: true, zip: ZIP_PATH, notes: NOTES_PATH, sha256: sha256(ZIP)});
    expect(calls).toEqual(EVERYTHING);
    expect([...written.keys()]).toEqual([ZIP_PATH, NOTES_PATH]);
    expect(written.get(ZIP_PATH).equals(ZIP)).toBe(true);
    expect(lines).toEqual(STEPS.map(s => expect.stringMatching(new RegExp(`^release: ${s} ok`))));
    expect(lines[0]).toBe(`release: preflight ok — version 1.0.0, commit ${COMMIT}, working tree clean, NODE_ENV unset`);
    expect(lines[6]).toBe(`release: zip ok — ${ZIP.length} bytes, 28 entries (each a witnessed file, path and sha256), sha256 ${sha256(ZIP)}, twice`);
  });

  it('the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe', async () => {
    const {written} = await release({});
    const notes = written.get(NOTES_PATH).toString('utf8');
    expect(notes).toBe(
      releaseNotes({
        version: '1.0.0',
        sha256: sha256(ZIP),
        bytes: ZIP.length,
        entries: 28,
        digest: DIGEST,
        files: 28,
        commit: COMMIT,
        lockfile: LOCK_SHA,
        node: 'v22.12.0',
      }),
    );
    for (const want of [
      '# Noctura for Chrome 1.0.0 — release notes',
      '- Version: 1.0.0',
      `- Zip: \`${ZIP_PATH}\` (${ZIP.length} bytes, 28 entries, not committed)`,
      `- Zip sha256: \`${sha256(ZIP)}\``,
      `- Package file digest: \`sha256:${DIGEST}\` (28 files of \`extension/${PACKAGE}\`, web/scripts/build-manifest.mjs;`,
      '  each zip entry is one of these files, its path and sha256 compared)',
      `- Commit: \`${COMMIT}\`, working tree clean`,
      `- Lockfile: \`extension/package-lock.json\` sha256 \`${LOCK_SHA}\`; \`node_modules/.package-lock.json\` (npm's record of the installed`,
      "  tree) agreed with it: every package's version, resolved, integrity, link",
      '- NODE_ENV: unset',
      '- Passkey RP ID: wallet.noc-tura.io (release/rp-id.json, E17)',
      '- Node: v22.12.0',
      'To reproduce: check out the commit, then `cd extension && npm ci --ignore-scripts && env -u NODE_ENV npm run build`.',
      '`node ../web/scripts/build-manifest.mjs dist-nopresale/chrome --print-only` prints the same file count and package',
      '`node scripts/zip-store.mjs dist-nopresale/chrome <out.zip>` prints 28 entries and the same sha256.',
    ])
      expect(notes).toContain(want);
    // The recipe never installs with lifecycle scripts, and never runs the manifest CLI in its writing mode.
    expect(notes).not.toMatch(/npm ci(?! --ignore-scripts)/);
    // The final review's I3: the notes claim no install the run did not check — nothing records --ignore-scripts.
    expect(notes).not.toMatch(/installed with/);
    expect(notes.match(/npm ci --ignore-scripts/g)).toHaveLength(1);
    expect(notes).not.toMatch(/build-manifest\.mjs dist-nopresale\/chrome(?! --print-only)`/);
  });

  it('the zip and notes paths: the zip under the git-ignored release/out/, the notes beside the other release texts', () => {
    expect(OUT_DIR).toBe('release/out');
    expect(ZIP_PATH).toBe('release/out/noctura-chrome-1.0.0.zip');
    expect(NOTES_PATH).toBe('release/notes-1.0.0.md');
    expect(partialPath(NOTES_PATH)).toBe('release/notes-1.0.0.md.partial');
    expect(readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n')).toContain('release/out/');
  });
});

describe('release:chrome — each refusal stops before anything is written (negative controls)', () => {
  it.each([['development'], ['test'], ['production'], ['']])('NODE_ENV=%j in the environment: refused at the preflight, nothing run, no GET', async value => {
    const {result, calls, written} = await release({env: {NODE_ENV: value, PATH: '/usr/bin'}});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: [
        `NODE_ENV is set (to ${JSON.stringify(value)}) — the store build is made with none: Vite keeps a NODE_ENV it finds, and development or test builds React's development bundle, which verify, the third witness and the zip would all agree on. Any value is refused, production included: the notes record "NODE_ENV: unset", one condition a reproducer can meet. Run \`env -u NODE_ENV npm run release:chrome\`, or unset it.`,
      ],
    });
    expect(calls).toEqual(upTo('git rev-parse'));
    expect(written.size).toBe(0);
  });

  // Fix round 1 (review I1): Vite's two other doors to React's development bundle while NODE_ENV is unset.
  it.each([['development'], ['production'], ['']])('VITE_USER_NODE_ENV=%j in the environment: refused at the preflight, nothing run, no GET', async value => {
    const {result, calls, written} = await release({env: {VITE_USER_NODE_ENV: value, PATH: '/usr/bin'}});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: [
        `VITE_USER_NODE_ENV is set (to ${JSON.stringify(value)}) — with NODE_ENV unset, Vite turns VITE_USER_NODE_ENV=development into NODE_ENV=development and builds React's development bundle, which verify, the third witness and the zip would all agree on. Run \`env -u VITE_USER_NODE_ENV npm run release:chrome\`, or unset it.`,
      ],
    });
    expect(calls).toEqual(upTo('git rev-parse'));
    expect(written.size).toBe(0);
  });

  it('an env file in extension/ (git ignores it, so the tree looks clean): each refused at the preflight, named; other dotfiles pass', async () => {
    const names = ['.gitignore', '.env.production', '.envrc', 'env.example', '.env', '.env.local'];
    const {result, calls, written} = await release({list: dir => (dir === '.' ? names : [])});
    const refused = name =>
      `extension/${name} exists — Vite reads a NODE_ENV=development in an env file as a development build, and git ignores env files, so the clean-tree check cannot see it; the extension build reads none: remove it.`;
    expect(result).toEqual({ok: false, stoppedAt: 'preflight', problems: [refused('.env'), refused('.env.local'), refused('.env.production')]});
    expect(calls).toEqual(upTo('git rev-parse'));
    expect(written.size).toBe(0);
    const others = await release({list: dir => (dir === '.' ? ['.gitignore', '.envrc', 'env.example', '.environment'] : [])});
    expect(others.result).toMatchObject({ok: true});
  });

  it('a dirty working tree: refused before verify, the paths named as the repository root has them', async () => {
    const {result, calls, written} = await release({
      git: args => (args[0] === 'rev-parse' ? `${COMMIT}\n` : ' M extension/src/app/App.tsx\n?? extension/stray.ts\n'),
    });
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: [
        'the working tree is not clean — the notes would name a commit that is not what was packed (git status --porcelain --untracked-files=all; the paths are relative to the repository root, not to extension/):',
        '   M extension/src/app/App.tsx',
        '  ?? extension/stray.ts',
      ],
    });
    expect(calls.some(c => c.startsWith('run') || c.startsWith('GET'))).toBe(false);
    expect(written.size).toBe(0);
  });

  it.each([ZIP_PATH, NOTES_PATH])('%s already exists: refused before verify, never overwritten', async path => {
    const {result, calls, written} = await release({exists: p => p === path});
    expect(result.stoppedAt).toBe('preflight');
    expect(result.problems).toEqual([
      `${path} exists — version 1.0.0 was packed already: bump extension/package.json's version, or remove the file if that pack was abandoned`,
    ]);
    expect(calls.some(c => c.startsWith('run') || c.startsWith('GET'))).toBe(false);
    expect(written.size).toBe(0);
  });

  // B1e-2 (review 2 M2): a `.partial` an interrupted run left is refused at the preflight, before verify — not after
  // verify, at the write.
  const LEFT = path => `${path} exists — left by an interrupted run (a .partial is never moved into place by a later one): remove it, and anything else that run left, before running again`;
  it.each([partialPath(ZIP_PATH), `${OUT_DIR}/noctura-chrome-0.9.0.zip.partial`, `${OUT_DIR}/stray.partial`, partialPath(NOTES_PATH)])(
    '%s left by an interrupted run: refused at the preflight, named, before verify and before any GET',
    async path => {
      const inOut = path.startsWith(`${OUT_DIR}/`);
      const {result, calls, written} = await release({
        exists: p => p === path,
        list: dir => (inOut && dir === OUT_DIR ? ['noctura-chrome-0.9.0.zip', path.slice(OUT_DIR.length + 1)] : []),
      });
      expect(result).toEqual({ok: false, stoppedAt: 'preflight', problems: [LEFT(path)]});
      expect(calls).toEqual(upTo('git rev-parse'));
      expect(written.size).toBe(0);
    },
  );

  it('every .partial under release/out/ is named, in order (and only those)', async () => {
    const names = ['b.zip.partial', 'noctura-chrome-0.9.0.zip', 'a.partial', 'notes.md'];
    const {result} = await release({list: dir => (dir === OUT_DIR ? names : [])});
    expect(result).toEqual({ok: false, stoppedAt: 'preflight', problems: [LEFT(`${OUT_DIR}/a.partial`), LEFT(`${OUT_DIR}/b.zip.partial`)]});
  });

  it('positive control: another version’s finished zip in release/out/ and another version’s notes .partial are not refused', async () => {
    const other = 'release/notes-0.9.0.md.partial';
    const {result} = await release({
      exists: p => p === other,
      list: dir => (dir === OUT_DIR ? ['noctura-chrome-0.9.0.zip', 'noctura-chrome-0.9.0.zip.sha256'] : []),
    });
    expect(result).toMatchObject({ok: true});
  });

  it('no lockfile: refused at the preflight (the notes record its sha256)', async () => {
    const {result} = await release({hashFile: () => undefined});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: ['package-lock.json is absent — the notes record the dependency set the zip is built from'],
    });
  });

  it('node_modules is not the lockfile’s tree (the final review’s I3): refused at the preflight, nothing run, no GET', async () => {
    const stale = {...installedOf(), 'node_modules/a': pkg('a', {version: '0.9.0'})};
    const {result, calls, written} = await release({read: readWith({[INSTALLED_LOCKFILE]: lockJson(stale)})});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: [
        expect.stringMatching(/^node_modules is not the tree package-lock\.json names \(node_modules\/\.package-lock\.json disagrees\)/),
        '  node_modules/a: version "0.9.0" installed, "1.0.0" in package-lock.json',
      ],
    });
    expect(calls).toEqual(upTo('git rev-parse'));
    expect(written.size).toBe(0);
  });

  it('no node_modules/.package-lock.json (not installed by npm): refused at the preflight', async () => {
    const {result} = await release({read: readWith({[INSTALLED_LOCKFILE]: undefined})});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: ['node_modules/.package-lock.json is absent — node_modules was not installed by npm from package-lock.json: run `npm ci --ignore-scripts` first'],
    });
  });

  it('the live pre-check fails (a 404, as today): refused before verify — nothing built, every page asked once', async () => {
    const {result, calls, written} = await release(calls => ({
      fetch: async url => {
        calls.push(`GET ${url}`);
        return notFound();
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'livePrecheck',
      problems: LIVE_PAGES.map(p => `${p.name}: ${p.url} answered 404, want 200`),
    });
    expect(calls).toEqual(upTo(GETS[2]));
    expect(calls.some(c => c.startsWith('run'))).toBe(false);
    expect(written.size).toBe(0);
  });

  it('verify fails: nothing after it runs', async () => {
    const {result, calls, written} = await release(calls => ({
      run: (cmd, args) => {
        calls.push(`run ${cmd} ${args.join(' ')}`);
        return cmd === 'npm' ? 1 : 0;
      },
    }));
    expect(result).toEqual({ok: false, stoppedAt: 'verify', problems: ['npm run verify exited 1']});
    expect(calls).toEqual(upTo('run npm run verify'));
    expect(written.size).toBe(0);
  });

  it('a build-manifest.json in the package: refused at the witness, before the third build (the digest cannot see it, the zip would pack it)', async () => {
    const {result, calls, written} = await release({exists: p => p === `${PACKAGE}/build-manifest.json`});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'witness',
      problems: [
        `${PACKAGE}/build-manifest.json exists — the file digest skips that name, so the witness cannot see it and the zip would pack it; no build writes it (build-manifest.mjs run there without --print-only does): run verify again`,
      ],
    });
    expect(calls).toEqual(upTo('run npm run verify'));
    expect(written.size).toBe(0);
  });

  it('the third witness differs from verify’s package: refused before the RP-ID record, the live check and the zip', async () => {
    const other = 'f'.repeat(64);
    const {result, calls, written} = await release(calls => ({
      digest: dir => {
        calls.push(`digest ${dir}`);
        return {files: FILES, digest: dir === PACKAGE ? DIGEST : other};
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'witness',
      problems: [`the third build's chrome/ is sha256:${other}, verify's ${PACKAGE} is sha256:${DIGEST} — not the package verify checked`],
    });
    expect(calls).toEqual(upTo('removeDir'));
    expect(written.size).toBe(0);
  });

  it('the third build fails, or is empty: refused (the temp dir removed either way)', async () => {
    const failed = await release({run: cmd => (cmd === 'node' ? 2 : 0)});
    expect(failed.result).toEqual({
      ok: false,
      stoppedAt: 'witness',
      problems: ['the third build (node scripts/build.mjs /tmp/witness --no-presale) exited 2'],
    });
    expect(failed.calls.at(-1)).toBe('removeDir /tmp/witness');
    const empty = await release({digest: () => ({files: [], digest: DIGEST})});
    expect(empty.result).toEqual({
      ok: false,
      stoppedAt: 'witness',
      problems: [`INCONCLUSIVE: the third build's chrome/ or verify's ${PACKAGE} holds no file`],
    });
    expect(empty.written.size).toBe(0);
  });

  it.each([
    ['absent', undefined, [`${RP_ID_FILE} is absent — the owner's confirmation of the passkey RP ID (E17, B1e §5.6) is recorded before upload`]],
    ['not JSON', '{rpId:', [expect.stringMatching(new RegExp(`^${RP_ID_FILE} is not JSON \\(`))]],
  ])('the RP-ID record %s: refused before the final live check and the zip', async (_, text, problems) => {
    const {result, calls, written} = await release({read: readWith({[RP_ID_FILE]: text})});
    expect(result).toEqual({ok: false, stoppedAt: 'rpId', problems});
    expect(calls).toEqual(upTo('removeDir'));
    expect(written.size).toBe(0);
  });

  it('the RP-ID record names another host: refused before the final live check', async () => {
    const {result, calls} = await release({
      read: readWith({[RP_ID_FILE]: JSON.stringify({...RP_ID_RECORD, rpId: 'passkey.noc-tura.io'})}),
    });
    expect(result.stoppedAt).toBe('rpId');
    expect(result.problems).toEqual([
      `${RP_ID_FILE}: rpId is "passkey.noc-tura.io", want "wallet.noc-tura.io" (E17)`,
      `${RP_ID_FILE}: rpId is "passkey.noc-tura.io", but ${RP_ID_SOURCE} says RP_ID = "wallet.noc-tura.io"`,
    ]);
    expect(calls.filter(c => c.startsWith('GET'))).toEqual(GETS);
  });

  it('passkey.ts no longer says RP_ID plainly: refused (the reader fails closed)', async () => {
    const {result} = await release({read: readWith({[RP_ID_SOURCE]: 'export const RP_ID = "wallet.noc-tura.io";\n'})});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'rpId',
      problems: [`${RP_ID_SOURCE}: no single plain \`export const RP_ID = '<host>';\` line — the RP ID cannot be read without a TypeScript loader`],
    });
  });

  it('the final live check fails (the pre-check passed, a page went down during verify): refused before the zip', async () => {
    let n = 0;
    const {result, calls, written} = await release(calls => ({
      fetch: async url => {
        calls.push(`GET ${url}`);
        n += 1;
        return n <= 3 || url !== LIVE_PAGES[1].url ? live(url) : notFound();
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'liveCheck',
      problems: [`${LIVE_PAGES[1].name}: ${LIVE_PAGES[1].url} answered 404, want 200`],
    });
    expect(calls).toEqual(upTo(GETS[2], 2));
    expect(written.size).toBe(0);
  });

  it('the two zips differ: refused, nothing written', async () => {
    let n = 0;
    const {result, calls, written} = await release(calls => ({
      zip: dir => {
        calls.push(`zip ${dir}`);
        n += 1;
        return Buffer.from(`PK ${n}`);
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'zip',
      problems: [`the two zips of ${PACKAGE} differ: sha256 ${sha256(Buffer.from('PK 1'))} vs ${sha256(Buffer.from('PK 2'))}`],
    });
    expect(calls.filter(c => c.startsWith('zip'))).toHaveLength(2);
    expect(written.size).toBe(0);
  });

  it.each([
    ['a 29th file the witness did not see (a build-manifest.json the digest skips)', [...PACKED, {path: 'build-manifest.json', bytes: Buffer.from('{}\n')}], ['  the zip holds build-manifest.json, which the witness did not see']],
    ['a witnessed file missing', PACKED.slice(1), [`  the witness saw ${PACKED[0].path}, which the zip does not hold`]],
    [
      'a file with other bytes',
      PACKED.map((f, i) => (i === 3 ? {path: f.path, bytes: Buffer.from('changed\n')} : f)),
      [`  the zip's ${PACKED[3].path} is sha256 ${sha256(Buffer.from('changed\n'))}, the witness saw ${FILES[3].sha256}`],
    ],
  ])('the zip, read back, is not the witnessed package — %s: refused at the zip, nothing written', async (_, files, unbound) => {
    const bytes = zipFiles([...files].sort(byPath));
    const {result, written} = await release({zip: () => Buffer.from(bytes)});
    expect(result).toEqual({ok: false, stoppedAt: 'zip', problems: ['the zip is not the package the witness saw:', ...unbound]});
    expect(written.size).toBe(0);
  });

  it('bytes that are no store zip: refused at the zip (the reader throws), nothing written', async () => {
    const {result, written} = await release({zip: () => Buffer.from('PK the same bytes twice')});
    expect(result).toEqual({ok: false, stoppedAt: 'zip', problems: ['zip: store zip: no end record']});
    expect(written.size).toBe(0);
  });

  it('the package digest after zipping must still be the witnessed one', async () => {
    let digests = 0;
    const {result, written} = await release({
      digest: () => {
        digests += 1;
        return {files: FILES, digest: digests === 3 ? 'a'.repeat(64) : DIGEST};
      },
    });
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'zip',
      problems: [`${PACKAGE} changed after the witness: sha256:${'a'.repeat(64)}, was sha256:${DIGEST}`],
    });
    expect(written.size).toBe(0);
  });

  it('the tree changed during the run (dirty, or another HEAD): refused at the write, nothing written', async () => {
    for (const [answer, problem] of [
      [args => (args[0] === 'rev-parse' ? `${COMMIT}\n` : '?? extension/new.ts\n'), 'the working tree is not clean'],
      [args => (args[0] === 'rev-parse' ? `${'b'.repeat(40)}\n` : ''), `HEAD moved during the run: ${COMMIT} → ${'b'.repeat(40)}`],
    ]) {
      let n = 0;
      const {result, written} = await release({git: args => ((n += 1) <= 2 ? (args[0] === 'rev-parse' ? `${COMMIT}\n` : '') : answer(args))});
      expect(result.stoppedAt).toBe('write');
      expect(result.problems[0]).toContain(problem);
      expect(written.size).toBe(0);
    }
  });

  it.each([ZIP_PATH, NOTES_PATH, partialPath(ZIP_PATH), partialPath(NOTES_PATH)])(
    '%s appears during the run: refused at the write, nothing written, nothing overwritten',
    async path => {
      let late = false;
      const {result, calls} = await release(calls => ({
        exists: p => late && p === path,
        zip: dir => {
          calls.push(`zip ${dir}`);
          late = true;
          return Buffer.from(ZIP);
        },
      }));
      expect(result).toEqual({
        ok: false,
        stoppedAt: 'write',
        problems: [`${path} exists — appeared during the run, or left by an earlier one; never overwritten`],
      });
      expect(calls.some(c => c.startsWith('write') || c.startsWith('place'))).toBe(false);
    },
  );

  it('a git answer that is no commit: refused at the preflight', async () => {
    const {result} = await release({git: args => (args[0] === 'rev-parse' ? 'fatal: not a git repository\n' : '')});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: ['git rev-parse HEAD answered "fatal: not a git repository" — no commit to record'],
    });
  });
});

describe('release:chrome — a write that fails part-way says what it left (review M1)', () => {
  it('the second file cannot be written: the first is removed, nothing is left, and the CLI says "nothing was written"', async () => {
    const {result, calls, written} = await release((calls, written) => ({
      write: (path, bytes) => {
        calls.push(`write ${path}`);
        if (path === partialPath(NOTES_PATH)) throw new Error('ENOSPC: no space left on device');
        written.set(path, Buffer.from(bytes));
      },
    }));
    expect(result).toEqual({ok: false, stoppedAt: 'write', problems: ['writing failed (ENOSPC: no space left on device)']});
    expect(calls.slice(-3)).toEqual([`write ${partialPath(ZIP_PATH)}`, `write ${partialPath(NOTES_PATH)}`, `remove ${partialPath(ZIP_PATH)}`]);
    expect(written.size).toBe(0);
    expect(refusalLines(result)).toEqual(['release: refused at write — nothing was written', '  writing failed (ENOSPC: no space left on device)']);
  });

  it('the notes cannot be moved into place after the zip was: the zip is named as left, and the CLI does not say "nothing was written"', async () => {
    const {result, written} = await release((calls, written) => ({
      place: (from, to) => {
        calls.push(`place ${from} ${to}`);
        if (to === NOTES_PATH) throw new Error(`EEXIST: file already exists, link '${from}' -> '${to}'`);
        written.set(to, written.get(from));
        written.delete(from);
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'write',
      problems: [`moving into place failed (EEXIST: file already exists, link '${partialPath(NOTES_PATH)}' -> '${NOTES_PATH}')`],
      written: [ZIP_PATH],
    });
    expect([...written.keys()]).toEqual([ZIP_PATH]);
    expect(refusalLines(result)[0]).toBe(`release: refused at write — the write failed part-way: remove ${ZIP_PATH} (in extension/) before running again`);
  });

  it('a move whose link was made but whose unlink failed: the final file is named as left, never "nothing was written" (ledger line 23)', async () => {
    const {result, written} = await release((calls, written) => ({
      place: (from, to) => {
        calls.push(`place ${from} ${to}`);
        written.set(to, written.get(from));
        if (to === ZIP_PATH) throw new Error(`EPERM: operation not permitted, unlink '${from}'`);
        written.delete(from);
      },
    }));
    // The zip is in place, its temporary name removed by the cleanup; the notes were never moved, their temporary
    // name removed too: the zip is what is left.
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'write',
      problems: [`moving into place failed (EPERM: operation not permitted, unlink '${partialPath(ZIP_PATH)}')`],
      written: [ZIP_PATH],
    });
    expect([...written.keys()]).toEqual([ZIP_PATH]);
    expect(refusalLines(result)[0]).toBe(`release: refused at write — the write failed part-way: remove ${ZIP_PATH} (in extension/) before running again`);
  });

  it('the same, and the temporary name cannot be removed either: both the final file and the temporary one are named', async () => {
    const {result} = await release((calls, written) => ({
      place: (from, to) => {
        written.set(to, written.get(from));
        throw new Error('EPERM');
      },
      remove: path => {
        if (path === partialPath(ZIP_PATH)) throw new Error('EPERM');
        written.delete(path);
      },
    }));
    expect(result.written).toEqual([ZIP_PATH, partialPath(ZIP_PATH)]);
  });

  it('a temporary file that cannot be removed is named as left too', async () => {
    const {result} = await release((calls, written) => ({
      write: (path, bytes) => {
        if (path === partialPath(NOTES_PATH)) throw new Error('EIO');
        written.set(path, Buffer.from(bytes));
      },
      remove: () => {
        throw new Error('EACCES');
      },
    }));
    expect(result.written).toEqual([partialPath(ZIP_PATH)]);
    expect(refusalLines(result)[0]).toContain(`remove ${partialPath(ZIP_PATH)} (in extension/)`);
  });

  it('refusalLines: "nothing was written" for every refusal that left nothing', () => {
    expect(refusalLines({ok: false, stoppedAt: 'liveCheck', problems: ['a', 'b']})).toEqual(['release: refused at liveCheck — nothing was written', '  a', '  b']);
  });
});

describe('the zip bound to the witness (review I1)', () => {
  it('[] iff the same paths with the same hashes, one for one (positive control)', () => {
    expect(zipWitnessProblems(FILES, FILES)).toEqual([]);
    expect(zipWitnessProblems([...FILES].reverse(), FILES)).toEqual([]);
  });

  it('a repeated entry is refused even when every path and hash is a witnessed one', () => {
    expect(zipWitnessProblems([...FILES, FILES[0]], FILES)).toEqual(['the zip has 29 entries, the witness 28 files']);
  });
});

describe('NODE_ENV never reaches a command the release runs (review C1)', () => {
  it('childEnv drops NODE_ENV and VITE_USER_NODE_ENV (fix round 1, review I1) and nothing else', () => {
    expect(childEnv({NODE_ENV: 'development', VITE_USER_NODE_ENV: 'development', PATH: '/bin', HOME: '/h'})).toEqual({PATH: '/bin', HOME: '/h'});
    expect(childEnv({PATH: '/bin', VITE_OTHER: 'x'})).toEqual({PATH: '/bin', VITE_OTHER: 'x'});
  });

  it('realIo.run: a child sees no VITE_USER_NODE_ENV either — and would, without it', () => {
    const before = process.env.VITE_USER_NODE_ENV;
    process.env.VITE_USER_NODE_ENV = 'development';
    try {
      const probe = ['-e', 'process.exit(process.env.VITE_USER_NODE_ENV === undefined ? 0 : 3)'];
      expect(spawnSync('node', probe).status).toBe(3);
      const root = mkdtempSync(join(tmpdir(), 'release-env-'));
      try {
        expect(realIo(root).run('node', probe)).toBe(0);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    } finally {
      if (before === undefined) delete process.env.VITE_USER_NODE_ENV;
      else process.env.VITE_USER_NODE_ENV = before;
    }
  });

  it.each([['development'], ['production'], ['']])('build.mjs refuses VITE_USER_NODE_ENV=%j before anything else (fix round 1, review I1)', value => {
    const r = spawnSync('node', ['scripts/build.mjs', 'a', 'b'], {cwd: ROOT, encoding: 'utf8', env: {...childEnv(process.env), VITE_USER_NODE_ENV: value}});
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain(`VITE_USER_NODE_ENV is ${JSON.stringify(value)} — Vite turns VITE_USER_NODE_ENV=development into NODE_ENV=development`);
    expect(r.stderr).not.toContain('usage: node scripts/build.mjs');
  });

  // An env file cannot be planted in the package itself while other tests build from it: build.mjs is run from a copy
  // of what it imports (scripts/, manifest/, package.json) — it refuses before it builds, so nothing else is needed.
  it.each([['.env'], ['.env.production'], ['.env.production.local'], ['.env.local']])(
    'build.mjs refuses an env file in extension/ (%s, NODE_ENV=development in it) before anything else; without it, the usage error (positive control)',
    name => {
      const copy = mkdtempSync(join(tmpdir(), 'build-envfile-'));
      try {
        for (const dir of ['scripts', 'manifest']) cpSync(join(ROOT, dir), join(copy, dir), {recursive: true, filter: src => !src.includes('__tests__')});
        cpSync(join(ROOT, 'package.json'), join(copy, 'package.json'));
        const run = () => spawnSync('node', ['scripts/build.mjs', 'a', 'b'], {cwd: copy, encoding: 'utf8', env: childEnv(process.env)});
        const clean = run();
        expect(clean.stderr).toContain('usage: node scripts/build.mjs');
        expect(clean.stderr).not.toContain('env file in extension/');
        writeFileSync(join(copy, name), 'NODE_ENV=development\n');
        writeFileSync(join(copy, '.envrc'), 'export X=1\n');
        const r = run();
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain(`env file in extension/: ${name} — Vite reads NODE_ENV=development from one as a development build`);
        expect(r.stderr).not.toContain('usage: node scripts/build.mjs');
      } finally {
        rmSync(copy, {recursive: true, force: true});
      }
    },
  );

  it('realIo.run: a child of this process (vitest sets NODE_ENV=test) sees no NODE_ENV — and would, without it', () => {
    expect(process.env.NODE_ENV).toBe('test');
    const probe = ['-e', 'process.exit(process.env.NODE_ENV === undefined ? 0 : 3)'];
    expect(spawnSync('node', probe).status).toBe(3);
    const root = mkdtempSync(join(tmpdir(), 'release-env-'));
    try {
      expect(realIo(root).run('node', probe)).toBe(0);
      expect(realIo(root).env).toBe(process.env);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it.each([['development'], ['test'], ['']])('build.mjs refuses NODE_ENV=%j before anything else (two directories: the usage error never comes)', value => {
    const r = spawnSync('node', ['scripts/build.mjs', 'a', 'b'], {cwd: ROOT, encoding: 'utf8', env: {...childEnv(process.env), NODE_ENV: value}});
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain(`NODE_ENV is ${JSON.stringify(value)} — build.mjs builds only with no NODE_ENV or NODE_ENV=production (B1e §5.1)`);
    expect(r.stderr).not.toContain('usage: node scripts/build.mjs');
  });

  it.each([['unset', undefined], ['production', 'production']])('build.mjs lets NODE_ENV %s through (positive control: it stops at the usage error instead)', (_, value) => {
    const env = value === undefined ? childEnv(process.env) : {...childEnv(process.env), NODE_ENV: value};
    const r = spawnSync('node', ['scripts/build.mjs', 'a', 'b'], {cwd: ROOT, encoding: 'utf8', env});
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('usage: node scripts/build.mjs');
    expect(r.stderr).not.toContain('NODE_ENV is');
  });
});

describe('the RP-ID record (B1e §5.6, E17)', () => {
  it('reads RP_ID from passkey.ts without a TypeScript loader — the value the module exports (positive control)', () => {
    expect(readRpId(PASSKEY_TS)).toBe(RP_ID);
    expect(readRpId(PASSKEY_TS)).toBe('wallet.noc-tura.io');
  });

  it.each([
    ['double quotes', 'export const RP_ID = "wallet.noc-tura.io";'],
    ['a second declaration', "export const RP_ID = 'wallet.noc-tura.io';\nlet RP_ID = 'evil.example';"],
    ['a computed value', 'export const RP_ID = HOST;'],
    ['not exported', "const RP_ID = 'wallet.noc-tura.io';"],
    ['none', ''],
  ])('the reader refuses %s', (_, text) => {
    expect(() => readRpId(text)).toThrow(/no single plain/);
  });

  it('the committed release/rp-id.json passes the gate as it stands (positive control)', () => {
    expect(JSON.parse(RP_ID_JSON)).toEqual(RP_ID_RECORD);
    expect(rpIdProblems(JSON.parse(RP_ID_JSON), readRpId(PASSKEY_TS))).toEqual([]);
    expect(RP_ID_RECORD).toEqual({rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'});
  });

  it.each([
    ['an array', [], ['release/rp-id.json is not a JSON object']],
    ['null', null, ['release/rp-id.json is not a JSON object']],
    ['an extra field', {...RP_ID_RECORD, note: 'x'}, ['release/rp-id.json: fields are confirmedBy, decision, note, rpId — want exactly confirmedBy, decision, rpId']],
    ['a missing field', {rpId: 'wallet.noc-tura.io', decision: 'E17'}, ['release/rp-id.json: fields are decision, rpId — want exactly confirmedBy, decision, rpId', 'release/rp-id.json: confirmedBy is undefined, want "owner" (E17)']],
    ['confirmedBy someone else', {...RP_ID_RECORD, confirmedBy: 'Owner'}, ['release/rp-id.json: confirmedBy is "Owner", want "owner" (E17)']],
    ['another decision', {...RP_ID_RECORD, decision: 'E18'}, ['release/rp-id.json: decision is "E18", want "E17" (E17)']],
  ])('refuses %s', (_, value, problems) => {
    expect(rpIdProblems(value, 'wallet.noc-tura.io')).toEqual(problems);
  });

  it('refuses a record and a passkey.ts moved together to another host — 1.0.0 freezes the name, not just their agreement', () => {
    expect(rpIdProblems({...RP_ID_RECORD, rpId: 'keys.noc-tura.io'}, 'keys.noc-tura.io')).toEqual([
      'release/rp-id.json: rpId is "keys.noc-tura.io", want "wallet.noc-tura.io" (E17)',
    ]);
  });

  it('refuses a record that disagrees with passkey.ts', () => {
    expect(rpIdProblems(RP_ID_RECORD, 'passkey.noc-tura.io')).toEqual([
      'release/rp-id.json: rpId is "wallet.noc-tura.io", but src/vault/passkey.ts says RP_ID = "passkey.noc-tura.io"',
    ]);
  });
});

// Fix round 1 (review I1): the structural wall — neither Vite config reads an env file — beside the two refusals.
describe('no env file reaches a build (review I1)', () => {
  it('both Vite configs set envDir: false, for every build they make', () => {
    for (const env of [{}, {NOCTURA_PRESALE: '0'}]) {
      expect(appConfig(env).envDir).toBe(false);
      for (const name of ['provider', 'relay']) expect(contentConfig({...env, NOCTURA_CONTENT: name}).envDir).toBe(false);
    }
  });

  it('ENV_FILE is every name Vite could read as an env file, and nothing else; envFilesIn lists them sorted', () => {
    for (const name of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.x'])
      expect(ENV_FILE.test(name)).toBe(true);
    for (const name of ['.envrc', 'env', '.environment', 'x.env', '.gitignore', 'env.example']) expect(ENV_FILE.test(name)).toBe(false);
    const dir = mkdtempSync(join(tmpdir(), 'env-files-'));
    try {
      for (const name of ['.env.production', '.envrc', '.env', 'a']) writeFileSync(join(dir, name), '');
      expect(envFilesIn(dir)).toEqual(['.env', '.env.production']);
      expect(envFilesIn(join(dir, 'absent'))).toEqual([]);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});

// Fix round 1 (review I2): plain `git status --porcelain` honours status.showUntrackedFiles=no and then prints nothing for
// an untracked file; both tree checks ask with --untracked-files=all. A real git, in a temp repository with that config.
describe('the tree checks see untracked files whatever git is configured to show (review I2)', () => {
  const sh = (cwd, ...args) => spawnSync('git', args, {cwd, encoding: 'utf8'});
  const repo = () => {
    const root = mkdtempSync(join(tmpdir(), 'release-git-'));
    for (const args of [['init', '-q'], ['config', 'user.email', 't@example.invalid'], ['config', 'user.name', 't'], ['config', 'status.showUntrackedFiles', 'no']])
      expect(sh(root, ...args).status).toBe(0);
    writeFileSync(join(root, 'a.txt'), 'a\n');
    expect(sh(root, 'add', 'a.txt').status).toBe(0);
    expect(sh(root, 'commit', '-q', '-m', 'a').status).toBe(0);
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'sub', 'stray.ts'), 'x\n');
    return root;
  };

  it('the config really hides it from plain porcelain (the control), and GIT_STATUS lists it file by file', () => {
    const root = repo();
    try {
      expect(sh(root, 'status', '--porcelain').stdout).toBe('');
      expect(GIT_STATUS).toEqual(['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none']);
      expect(realIo(root).git(GIT_STATUS)).toBe('?? sub/stray.ts\n');
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it('the preflight and the write step, over that repository’s real git, both refuse the untracked file', async () => {
    const root = repo();
    try {
      const {io} = fakeIo({git: realIo(root).git});
      const steps = releaseSteps(io);
      const pre = await steps.preflight({});
      expect(pre.problems).toEqual([expect.stringMatching(/^the working tree is not clean/), '  ?? sub/stray.ts']);
      const commit = sh(root, 'rev-parse', 'HEAD').stdout.trim();
      const write = await steps.write({preflight: {commit, lockfile: LOCK_SHA}, witness: {files: FILES, digest: DIGEST}, zip: {bytes: ZIP, sha256: sha256(ZIP), entries: 28}});
      expect(write.problems).toEqual([expect.stringMatching(/^the working tree is not clean/), '  ?? sub/stray.ts']);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });
});

describe('node_modules is the lockfile’s tree (the final review’s I3)', () => {
  const problemsOf = (installed, lock = LOCK_PACKAGES) => installedTreeProblems(lockJson(lock), lockJson(installed));
  const one = p => [expect.stringMatching(/^node_modules is not the tree package-lock\.json names/), `  ${p}`];

  it('the fields compared are what names the installed package', () => {
    expect(INSTALLED_FIELDS).toEqual(['version', 'resolved', 'integrity', 'link']);
    expect(INSTALLED_LOCKFILE).toBe('node_modules/.package-lock.json');
  });

  it('positive controls: the same tree; an optional package not installed (another platform’s); a field npm adds only to one file', () => {
    expect(installedTreeProblems(LOCK_TEXT, INSTALLED_TEXT)).toEqual([]);
    expect(problemsOf({...installedOf(), 'node_modules/a': {...pkg('a'), license: 'MIT'}})).toEqual([]);
  });

  it('positive control on the real files: this checkout’s node_modules, installed by npm ci, passes', () => {
    const read = name => (existsSync(join(ROOT, name)) ? readFileSync(join(ROOT, name), 'utf8') : undefined);
    expect(installedTreeProblems(read(LOCKFILE), read(INSTALLED_LOCKFILE))).toEqual([]);
  });

  it.each([
    ['version', {'node_modules/a': pkg('a', {version: '0.9.0'})}, 'node_modules/a: version "0.9.0" installed, "1.0.0" in package-lock.json'],
    ['resolved', {'node_modules/b': pkg('b', {dev: true, resolved: 'https://evil.example/b.tgz'})}, 'node_modules/b: resolved "https://evil.example/b.tgz" installed, "https://registry.npmjs.org/b/-/b-1.0.0.tgz" in package-lock.json'],
    ['integrity', {'node_modules/a/node_modules/c': pkg('c', {integrity: 'sha512-other'})}, 'node_modules/a/node_modules/c: integrity "sha512-other" installed, "sha512-c" in package-lock.json'],
    ['link', {'node_modules/@noctura/core': {resolved: '../core'}}, 'node_modules/@noctura/core: link undefined installed, true in package-lock.json'],
    ['an extra package', {'node_modules/d': pkg('d')}, 'node_modules/d is installed, and package-lock.json has no such package'],
  ])('a different %s is named', (_, change, problem) => {
    expect(problemsOf({...installedOf(), ...change})).toEqual(one(problem));
  });

  it('a non-optional package of the lockfile not installed is named; an optional one is not', () => {
    const {['node_modules/b']: _b, ...withoutB} = installedOf();
    expect(problemsOf(withoutB)).toEqual(one('node_modules/b is in package-lock.json and not installed'));
    expect(problemsOf({...installedOf(), 'node_modules/fsevents': pkg('fsevents', {dev: true, optional: true})})).toEqual([]);
  });

  it('another lockfileVersion, a file that is not JSON or holds no packages: refused', () => {
    expect(installedTreeProblems(LOCK_TEXT, lockJson(installedOf(), 2))).toEqual(one('lockfileVersion 2 installed, 3 in package-lock.json'));
    expect(installedTreeProblems(LOCK_TEXT, '{')).toEqual([expect.stringMatching(/^node_modules\/\.package-lock\.json is not JSON/)]);
    expect(installedTreeProblems('{"lockfileVersion": 3}', INSTALLED_TEXT)).toEqual(['package-lock.json holds no "packages" object']);
    expect(installedTreeProblems(LOCK_TEXT, 'null')).toEqual(['node_modules/.package-lock.json holds no "packages" object']);
  });

  it('names at most ten differences, then their count; an absent lockfile is the preflight’s own refusal', () => {
    const many = Object.fromEntries(Array.from({length: 12}, (_, i) => [`node_modules/x${i}`, pkg(`x${i}`)]));
    const out = problemsOf({...installedOf(), ...many});
    expect(out).toHaveLength(12);
    expect(out.at(-1)).toBe('  … and 2 more');
    expect(installedTreeProblems(undefined, INSTALLED_TEXT)).toEqual([]);
  });
});

describe('the pieces', () => {
  it('treeProblems: an empty status is clean, anything else is listed', () => {
    expect(treeProblems('')).toEqual([]);
    expect(treeProblems('\n')).toEqual([]);
    expect(treeProblems('?? a\n')).toEqual([
      'the working tree is not clean — the notes would name a commit that is not what was packed (git status --porcelain --untracked-files=all; the paths are relative to the repository root, not to extension/):',
      '  ?? a',
    ]);
  });

  it('the live check’s fetch carries a timeout: the request is aborted after LIVE_TIMEOUT_MS', async () => {
    expect(LIVE_TIMEOUT_MS).toBe(15_000);
    const seen = [];
    const never = (url, init) => {
      seen.push(init);
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    };
    await expect(timedFetch(never, 20)('https://example.invalid/', {method: 'GET', redirect: 'manual'})).rejects.toMatchObject({name: 'TimeoutError'});
    expect(seen[0]).toMatchObject({method: 'GET', redirect: 'manual'});
    expect(seen[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('no skip flag: any argument is refused with the usage line', () => {
    expect(cliProblem([])).toBe(null);
    for (const argv of [['--skip-live-check'], ['--no-live'], ['--force'], ['x']])
      expect(cliProblem(argv)).toBe('usage: npm run release:chrome (no arguments — every step runs, the live check included; B1e §5.1, §6.5)');
  });

  it('realIo writes without overwriting, moves into place without overwriting, and reads an absent file as undefined (a temp root)', () => {
    const root = mkdtempSync(join(tmpdir(), 'release-io-'));
    try {
      const io = realIo(root);
      expect(io.read('release/rp-id.json')).toBeUndefined();
      expect(io.hashFile('package-lock.json')).toBeUndefined();
      expect(io.exists('release/out/a.zip')).toBe(false);
      io.write('release/out/a.zip', Buffer.from('one'));
      expect(io.exists('release/out/a.zip')).toBe(true);
      expect(() => io.write('release/out/a.zip', Buffer.from('two'))).toThrow(/EEXIST/);
      expect(readFileSync(join(root, 'release/out/a.zip'), 'utf8')).toBe('one');
      expect(io.hashFile('release/out/a.zip')).toBe(sha256(Buffer.from('one')));
      io.write('release/out/b.partial', Buffer.from('three'));
      expect(() => io.place('release/out/b.partial', 'release/out/a.zip')).toThrow(/EEXIST/);
      expect(readFileSync(join(root, 'release/out/a.zip'), 'utf8')).toBe('one');
      io.place('release/out/b.partial', 'release/out/b.zip');
      expect(existsSync(join(root, 'release/out/b.partial'))).toBe(false);
      expect(readFileSync(join(root, 'release/out/b.zip'), 'utf8')).toBe('three');
      writeFileSync(join(root, 'gone'), 'x');
      io.remove('gone');
      expect(existsSync(join(root, 'gone'))).toBe(false);
      // B1e-2 (review 2 M2): the preflight's listing of release/out/ — an absent directory lists nothing.
      expect(io.list('release/none')).toEqual([]);
      expect(io.list('release/out').sort()).toEqual(['a.zip', 'b.zip']);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });
});
