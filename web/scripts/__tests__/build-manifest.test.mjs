import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileEntries, sumLines, digestOf, buildManifest, MANIFEST_NAME} from '../build-manifest.mjs';

function fixture(files) {
  const d = mkdtempSync(join(tmpdir(), 'manifest-'));
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/');
    if (parts.length > 1) mkdirSync(join(d, ...parts.slice(0, -1)), {recursive: true});
    writeFileSync(join(d, path), content);
  }
  return d;
}

const SAMPLE = {'index.html': '<html></html>', 'assets/app.js': 'const a=1;', 'assets/app.css': 'body{}'};

it('hashes each file with sha256 of its bytes', () => {
  const d = fixture(SAMPLE);
  const entries = fileEntries(d);
  const js = entries.find(e => e.path === 'assets/app.js');
  expect(js.sha256).toBe(createHash('sha256').update('const a=1;').digest('hex'));
});

it('sorts paths under C collation, so the shell recipe in the header matches', () => {
  // Under many locales "a.js" and "A.js" sort together; under C, uppercase comes first.
  const d = fixture({'B.js': '1', 'a.js': '2', 'A.js': '3'});
  expect(fileEntries(d).map(e => e.path)).toEqual(['A.js', 'B.js', 'a.js']);
});

it('emits sha256sum line format exactly — hash, two spaces, path', () => {
  const lines = sumLines([{path: 'a.js', sha256: 'deadbeef'}]);
  expect(lines).toBe('deadbeef  a.js\n');
});

it('reproduces the digest the documented shell pipeline would produce', () => {
  // The claim in the header is that `… | xargs sha256sum | sha256sum` gives the same
  // number. Verified here against coreutils rather than against our own code.
  const d = fixture(SAMPLE);
  const ours = buildManifest(d).digest;
  const shell = execFileSync(
    'bash',
    [
      '-c',
      `cd ${JSON.stringify(d)} && find . -type f ! -name ${MANIFEST_NAME} -printf '%P\\n' | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -d' ' -f1`,
    ],
    {encoding: 'utf8'},
  ).trim();
  expect(ours).toBe(shell);
});

it('excludes the manifest itself, so re-running does not change the digest', () => {
  const d = fixture(SAMPLE);
  const before = buildManifest(d).digest;
  writeFileSync(join(d, MANIFEST_NAME), '{"schema":1}');
  expect(buildManifest(d).digest).toBe(before);
});

it('changes the digest when one byte of one file changes (negative control)', () => {
  const a = buildManifest(fixture(SAMPLE)).digest;
  const b = buildManifest(fixture({...SAMPLE, 'assets/app.js': 'const a=2;'})).digest;
  expect(b).not.toBe(a);
});

it('changes the digest when a file is renamed but its bytes are not (negative control)', () => {
  // Hashing contents alone would miss this: same bytes, different served path.
  const a = buildManifest(fixture({'a.js': 'x'})).digest;
  const b = buildManifest(fixture({'b.js': 'x'})).digest;
  expect(b).not.toBe(a);
});

it('is stable across two runs over the same tree (positive control)', () => {
  const d = fixture(SAMPLE);
  expect(buildManifest(d).digest).toBe(buildManifest(d).digest);
});

it('digestOf is the sha256 of the joined lines, not of anything else', () => {
  const entries = [{path: 'a', sha256: '00'}, {path: 'b', sha256: '11'}];
  expect(digestOf(entries)).toBe(createHash('sha256').update('00  a\n11  b\n').digest('hex'));
});

describe('as a process', () => {
  const run = (...args) => {
    try {
      const stdout = execFileSync(process.execPath, ['scripts/build-manifest.mjs', ...args], {encoding: 'utf8'});
      return {code: 0, stdout};
    } catch (e) {
      return {code: e.status ?? -1, stdout: e.stdout ?? ''};
    }
  };

  it('writes the manifest and prints the digest', () => {
    const d = fixture(SAMPLE);
    const {code, stdout} = run(d);
    expect(code).toBe(0);
    expect(existsSync(join(d, MANIFEST_NAME))).toBe(true);
    const written = JSON.parse(readFileSync(join(d, MANIFEST_NAME), 'utf8'));
    expect(stdout).toContain(`digest sha256:${written.digest}`);
    expect(written.files).toHaveLength(3);
  });

  it('leaves the directory alone with --print-only', () => {
    const d = fixture(SAMPLE);
    expect(run(d, '--print-only').code).toBe(0);
    expect(existsSync(join(d, MANIFEST_NAME))).toBe(false);
  });

  it('exits 2 — not 0 — on an empty directory', () => {
    // The digest of nothing is a real-looking sha256. Refuse it rather than publish it.
    expect(run(mkdtempSync(join(tmpdir(), 'manifest-empty-'))).code).toBe(2);
  });

  it('exits 2 when the directory was never built', () => {
    expect(run(join(tmpdir(), 'manifest-absent-never-built')).code).toBe(2);
  });
});
