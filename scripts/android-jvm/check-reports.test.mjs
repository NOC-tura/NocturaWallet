import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {judge, readSuites} from './check-reports.mjs';

const script = fileURLToPath(new URL('./check-reports.mjs', import.meta.url));

function reports(rows) {
  const dir = mkdtempSync(join(tmpdir(), 'jvm-reports-'));
  for (const [name, tests, skipped = 0, failures = 0, errors = 0] of rows) {
    writeFileSync(
      join(dir, `TEST-${name}.xml`),
      `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${name}" tests="${tests}" skipped="${skipped}" failures="${failures}" errors="${errors}" timestamp="2026-11-17T00:00:00" hostname="h" time="0.1">\n</testsuite>\n`,
    );
  }
  return dir;
}

const run = (dir, classes) => spawnSync(process.execPath, [script, dir, ...classes], {encoding: 'utf8'});

test('every named class ran and passed: exit 0 (positive control)', () => {
  const dir = reports([['a.B', 3], ['a.C', 1]]);
  try {
    const r = run(dir, ['a.B', 'a.C']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /2 classes, 4 tests, all ran and passed/);
  } finally {
    rmSync(dir, {recursive: true});
  }
});

test('each defect is refused (negative controls)', () => {
  const cases = [
    [[['a.B', 3]], ['a.B', 'a.C'], /a\.C: no report/],
    [[['a.B', 0]], ['a.B'], /a\.B: 0 tests/],
    [[['a.B', 3, 1]], ['a.B'], /a\.B: 1 skipped/],
    [[['a.B', 3, 0, 1]], ['a.B'], /a\.B: 1 failures/],
    [[['a.B', 3, 0, 0, 2]], ['a.B'], /a\.B: 2 errors/],
    [[['a.B', 3], ['a.X', 1]], ['a.B'], /a\.X: a report for a class the job does not name/],
  ];
  for (const [rows, classes, why] of cases) {
    const dir = reports(rows);
    try {
      const r = run(dir, classes);
      assert.equal(r.status, 1, `${why}: ${r.stdout}`);
      assert.match(r.stderr, why);
    } finally {
      rmSync(dir, {recursive: true});
    }
  }
});

test('a report without counts is an error, never a pass', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jvm-reports-'));
  try {
    writeFileSync(join(dir, 'TEST-a.B.xml'), '<testsuite name="a.B" tests="3">');
    assert.throws(() => readSuites(dir), /has no skipped/);
    assert.notEqual(run(dir, ['a.B']).status, 0);
  } finally {
    rmSync(dir, {recursive: true});
  }
});

test('usage errors exit 2', () => {
  assert.equal(spawnSync(process.execPath, [script], {encoding: 'utf8'}).status, 2);
});

test('judge reads the counts it is given', () => {
  const suites = new Map([['a.B', {tests: 1, skipped: 0, failures: 0, errors: 0}]]);
  assert.deepEqual(judge(suites, ['a.B']), []);
});
