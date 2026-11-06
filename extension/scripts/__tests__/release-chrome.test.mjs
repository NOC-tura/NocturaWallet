import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  LIVE_TIMEOUT_MS,
  LOCKFILE,
  OUT_DIR,
  PACKAGE,
  RP_ID_FILE,
  RP_ID_RECORD,
  RP_ID_SOURCE,
  STEPS,
  childEnv,
  cliProblem,
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
    read: path => (path === RP_ID_FILE ? RP_ID_JSON : path === RP_ID_SOURCE ? PASSKEY_TS : undefined),
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
  'git status --porcelain',
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
  'git status --porcelain',
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
      `- Lockfile: \`extension/package-lock.json\` sha256 \`${LOCK_SHA}\` (installed with \`npm ci --ignore-scripts\`)`,
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

  it('a dirty working tree: refused before verify, the paths named as the repository root has them', async () => {
    const {result, calls, written} = await release({
      git: args => (args[0] === 'rev-parse' ? `${COMMIT}\n` : ' M extension/src/app/App.tsx\n?? extension/stray.ts\n'),
    });
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: [
        'the working tree is not clean — the notes would name a commit that is not what was packed (git status --porcelain; the paths are relative to the repository root, not to extension/):',
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
      problems: LIVE_PAGES.map(p => `${p.name}: ${p.url} answered 404, want 200 — a redirect fails`),
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
    const {result, calls, written} = await release({read: p => (p === RP_ID_FILE ? text : PASSKEY_TS)});
    expect(result).toEqual({ok: false, stoppedAt: 'rpId', problems});
    expect(calls).toEqual(upTo('removeDir'));
    expect(written.size).toBe(0);
  });

  it('the RP-ID record names another host: refused before the final live check', async () => {
    const {result, calls} = await release({
      read: p => (p === RP_ID_FILE ? JSON.stringify({...RP_ID_RECORD, rpId: 'passkey.noc-tura.io'}) : PASSKEY_TS),
    });
    expect(result.stoppedAt).toBe('rpId');
    expect(result.problems).toEqual([
      `${RP_ID_FILE}: rpId is "passkey.noc-tura.io", want "wallet.noc-tura.io" (E17)`,
      `${RP_ID_FILE}: rpId is "passkey.noc-tura.io", but ${RP_ID_SOURCE} says RP_ID = "wallet.noc-tura.io"`,
    ]);
    expect(calls.filter(c => c.startsWith('GET'))).toEqual(GETS);
  });

  it('passkey.ts no longer says RP_ID plainly: refused (the reader fails closed)', async () => {
    const {result} = await release({read: p => (p === RP_ID_FILE ? RP_ID_JSON : 'export const RP_ID = "wallet.noc-tura.io";\n')});
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
      problems: [`${LIVE_PAGES[1].name}: ${LIVE_PAGES[1].url} answered 404, want 200 — a redirect fails`],
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
  it('childEnv drops NODE_ENV and nothing else', () => {
    expect(childEnv({NODE_ENV: 'development', PATH: '/bin', HOME: '/h'})).toEqual({PATH: '/bin', HOME: '/h'});
    expect(childEnv({PATH: '/bin'})).toEqual({PATH: '/bin'});
  });

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

describe('the pieces', () => {
  it('treeProblems: an empty status is clean, anything else is listed', () => {
    expect(treeProblems('')).toEqual([]);
    expect(treeProblems('\n')).toEqual([]);
    expect(treeProblems('?? a\n')).toEqual([
      'the working tree is not clean — the notes would name a commit that is not what was packed (git status --porcelain; the paths are relative to the repository root, not to extension/):',
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
