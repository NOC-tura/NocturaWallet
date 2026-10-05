import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {advisoriesIn, evaluate, validateExceptions} from '../check-audit.mjs';

// The real `npm audit --json` for web/ on 2026-10-05, trimmed to the braces chain, one
// moderate advisory and the packages that are "high" only because they depend on braces.
// Read from disk, never from the network: the gate's logic is what is under test here,
// and the registry's answer changes daily.
const FIXTURE = 'scripts/__tests__/fixtures/npm-audit-2026-10-05.json';
const AUDIT = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const BRACES = 'GHSA-vfj7-8cjw-p6xm';
const TODAY = '2026-10-05';

const braces = (over = {}) => ({
  id: BRACES,
  package: 'braces',
  reason: 'bundler-only, not in dist',
  reviewBy: '2026-11-05',
  decidedBy: 'owner, 2026-10-05',
  ...over,
});

/** An extra high on a package that would ship, added to a copy of the real report. */
function withUnlistedHigh() {
  const a = structuredClone(AUDIT);
  a.vulnerabilities['bn.js'] = {
    name: 'bn.js',
    severity: 'high',
    via: [{source: 7, name: 'bn.js', title: 'made up for the test', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'high', range: '<5.2.3'}],
    fixAvailable: true,
  };
  return a;
}

// Vitest already runs with web/ as cwd, so the script path is relative to that.
function run(audit, exceptions, today = TODAY) {
  const d = mkdtempSync(join(tmpdir(), 'audit-'));
  writeFileSync(join(d, 'audit.json'), JSON.stringify(audit));
  writeFileSync(join(d, 'exceptions.json'), JSON.stringify({exceptions}));
  try {
    const stdout = execFileSync(
      process.execPath,
      ['scripts/check-audit.mjs', '--audit-json', join(d, 'audit.json'), '--exceptions', join(d, 'exceptions.json'), '--today', today],
      {stdio: 'pipe', encoding: 'utf8'},
    );
    return {status: 0, out: stdout};
  } catch (e) {
    return {status: e.status ?? -1, out: String(e.stdout ?? '') + String(e.stderr ?? '')};
  }
}

describe('advisoriesIn', () => {
  it('counts the advisory once, on the package that carries it — not on the thirteen that depend on it', () => {
    const highs = advisoriesIn(AUDIT).filter(a => a.severity === 'high');
    expect(highs.map(a => [a.id, a.package])).toEqual([[BRACES, 'braces']]);
  });
});

describe('the gate', () => {
  it('passes the real 2026-10-05 report with the braces exception (positive control — it can say yes)', () => {
    const r = run(AUDIT, [braces()]);
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/excepted: high braces \(GHSA-vfj7-8cjw-p6xm\)/);
  });

  it('fails the same report with no exception — the bare `npm audit --audit-level=high` answer', () => {
    const r = run(AUDIT, []);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/high braces <=3\.0\.3: .*\(GHSA-vfj7-8cjw-p6xm\)/);
  });

  it('fails on a high that is not listed, even while braces is excepted', () => {
    const r = run(withUnlistedHigh(), [braces()]);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/bn\.js/);
    expect(r.out).not.toMatch(/high braces <=/);
  });

  it('does not fail on a moderate (the threshold is high, as before)', () => {
    expect(advisoriesIn(AUDIT).some(a => a.severity === 'moderate')).toBe(true);
    expect(run(AUDIT, [braces()]).status).toBe(0);
  });

  it('holds through the reviewBy day itself', () => {
    expect(run(AUDIT, [braces()], '2026-11-05').status).toBe(0);
  });

  it('fails the day after reviewBy — an exception expires, it is not a pardon', () => {
    const r = run(AUDIT, [braces()], '2026-11-06');
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/expired on 2026-11-05/);
    // …and the advisory it covered is reported again as a failure, not left excused.
    expect(r.out).toMatch(/high braces <=3\.0\.3: .*\(GHSA-vfj7-8cjw-p6xm\)/);
  });

  it('fails on a stale exception that no longer matches any advisory', () => {
    const fixed = structuredClone(AUDIT);
    delete fixed.vulnerabilities.braces;
    const r = run(fixed, [braces()]);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/stale exception/);
  });

  it('fails when the advisory id matches but the package is a different one', () => {
    const r = run(AUDIT, [braces({package: 'micromatch'})]);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/exception is for "micromatch", but the advisory now affects "braces"/);
  });

  it('refuses to read a report npm could not produce as "nothing found"', () => {
    expect(run({error: {code: 'ENOTFOUND'}}, []).status).toBe(2);
  });
});

describe('validateExceptions', () => {
  it('accepts the committed file', () => {
    const {exceptions} = JSON.parse(readFileSync('audit-exceptions.json', 'utf8'));
    expect(validateExceptions(exceptions)).toEqual([]);
  });

  it.each([
    ['no reviewBy — it would never expire', {reviewBy: undefined}],
    ['a reviewBy that is not an ISO date', {reviewBy: '5 Nov 2026'}],
    ['no reason', {reason: ''}],
    ['no decider', {decidedBy: undefined}],
    ['no package', {package: undefined}],
    ['an id that is not a GHSA id', {id: 'CVE-2026-1'}],
  ])('rejects %s', (_label, over) => {
    expect(validateExceptions([braces(over)]).length).toBeGreaterThan(0);
    expect(evaluate(AUDIT, [braces(over)], TODAY).failures.length).toBeGreaterThan(0);
  });
});
