#!/usr/bin/env node
// `npm audit --audit-level=high` for web/, with exceptions that have to keep earning
// their place.
//
// The bare command has one answer for an advisory nobody can fix: red, forever, or the
// step deleted. Both lose the gate. The first such advisory arrived on 2026-10-05 —
// braces, deep in Metro, which wallet-adapter-react drags into the tree through the
// React Native mobile adapter that vite.config.ts aliases to a stub, so none of it is in
// dist. Proving that once is not the same as it staying true, so an exception here is:
//
//   - specific    one GHSA id on one named package; the same id on another package
//                 is a different decision nobody made, and fails
//   - dated       `reviewBy` — past it, the gate fails until someone looks again
//   - live        an exception that matches no advisory any more is stale and fails,
//                 so the list cannot quietly turn into a pre-approval for the future
//   - owned       who decided it, and when
//
// Only advisories proven not to ship belong in audit-exceptions.json (see SECURITY.md).
// Anything high or critical that is not listed fails, exactly as the bare command did.
//
// Usage:
//   node scripts/check-audit.mjs                         # runs npm audit --json here
//   node scripts/check-audit.mjs --audit-json a.json --exceptions e.json --today 2026-10-05
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

export const FAIL_SEVERITIES = new Set(['high', 'critical']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GHSA = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i;

/**
 * Every advisory in an `npm audit --json` report, one per (advisory, package).
 *
 * Only the OBJECTS in an entry's `via` are advisories, and each names the package that
 * carries it. Bare strings in `via` just say "a dependency of mine is affected"; counting
 * them would turn one braces advisory into thirteen "high" packages.
 */
export function advisoriesIn(audit) {
  const out = [];
  const seen = new Set();
  const vulns = (audit && audit.vulnerabilities) || {};
  for (const [key, v] of Object.entries(vulns)) {
    for (const x of Array.isArray(v && v.via) ? v.via : []) {
      if (!x || typeof x !== 'object') continue;
      const match = GHSA.exec(String(x.url ?? ''));
      const id = match ? match[0] : `npm-${x.source ?? x.title}`;
      const pkg = typeof x.name === 'string' && x.name ? x.name : key;
      if (seen.has(`${id}|${pkg}`)) continue;
      seen.add(`${id}|${pkg}`);
      out.push({id, package: pkg, severity: x.severity ?? v.severity, title: x.title ?? '', range: x.range ?? ''});
    }
  }
  return out;
}

/**
 * A malformed exception is a failure, not a skipped row: an entry missing its reviewBy
 * would otherwise never expire, and that is the one property the list exists to have.
 */
export function validateExceptions(list) {
  const problems = [];
  if (!Array.isArray(list)) return ['audit-exceptions.json: "exceptions" must be an array'];
  list.forEach((e, i) => {
    const where = `exception #${i + 1}${e && e.id ? ` (${e.id})` : ''}`;
    if (!e || typeof e !== 'object') return problems.push(`${where}: not an object`);
    for (const field of ['id', 'package', 'reason', 'reviewBy', 'decidedBy']) {
      if (typeof e[field] !== 'string' || !e[field].trim()) problems.push(`${where}: missing "${field}"`);
    }
    if (typeof e.id === 'string' && !GHSA.test(e.id)) problems.push(`${where}: id is not a GHSA id`);
    if (typeof e.reviewBy === 'string' && (!ISO_DATE.test(e.reviewBy) || Number.isNaN(Date.parse(e.reviewBy)))) {
      problems.push(`${where}: reviewBy "${e.reviewBy}" is not an ISO date (YYYY-MM-DD)`);
    }
  });
  return problems;
}

/**
 * The decision. `today` is a UTC YYYY-MM-DD string; an exception is good THROUGH its
 * reviewBy day and fails the day after.
 *
 * Returns {failures, excused}: failures are strings naming what to do; excused are the
 * advisories an exception covered, so the log still shows them.
 */
export function evaluate(audit, exceptions, today) {
  const failures = validateExceptions(exceptions);
  if (failures.length > 0) return {failures, excused: []};

  const advisories = advisoriesIn(audit);
  const excused = [];

  for (const e of exceptions) {
    const sameId = advisories.filter(a => a.id.toLowerCase() === e.id.toLowerCase());
    if (sameId.length === 0) {
      failures.push(`${e.id} (${e.package}): stale exception — no advisory matches it any more; remove it`);
      continue;
    }
    if (e.reviewBy < today) {
      failures.push(`${e.id} (${e.package}): exception expired on ${e.reviewBy} — review it again or fix the dependency`);
    }
    for (const a of sameId) {
      if (a.package !== e.package) {
        failures.push(`${e.id}: the exception is for "${e.package}", but the advisory now affects "${a.package}"`);
      }
    }
  }

  for (const a of advisories) {
    if (!FAIL_SEVERITIES.has(a.severity)) continue;
    const covered = exceptions.find(
      e => e.id.toLowerCase() === a.id.toLowerCase() && e.package === a.package && e.reviewBy >= today,
    );
    if (covered) {
      excused.push({...a, reviewBy: covered.reviewBy, decidedBy: covered.decidedBy});
    } else {
      failures.push(`${a.severity} ${a.package} ${a.range}: ${a.title} (${a.id})`);
    }
  }
  return {failures, excused};
}

/** `npm audit` exits non-zero whenever it finds anything; the report is still on stdout. */
function runNpmAudit() {
  try {
    return execFileSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {
    if (typeof e.stdout === 'string' && e.stdout.trim().startsWith('{')) return e.stdout;
    throw e;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const arg = name => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const exceptionsPath = arg('--exceptions') ?? join(here, '..', 'audit-exceptions.json');
  const auditPath = arg('--audit-json');
  const today = arg('--today') ?? new Date().toISOString().slice(0, 10);

  const audit = JSON.parse(auditPath ? readFileSync(auditPath, 'utf8') : runNpmAudit());
  // A report npm could not produce (offline, registry error) has no `vulnerabilities`;
  // reading that as "nothing found" would pass the gate on a network failure.
  if (!audit || typeof audit.vulnerabilities !== 'object' || audit.error) {
    console.error('check-audit: npm audit did not produce a report:', JSON.stringify(audit && audit.error));
    process.exit(2);
  }
  const {exceptions} = JSON.parse(readFileSync(exceptionsPath, 'utf8'));
  const {failures, excused} = evaluate(audit, exceptions, today);

  for (const a of excused) {
    console.log(`excepted: ${a.severity} ${a.package} (${a.id}) — decided by ${a.decidedBy}, review by ${a.reviewBy}`);
  }
  if (failures.length > 0) {
    console.error(`\ncheck-audit: ${failures.length} problem(s):\n`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`check-audit: no unexcepted high or critical advisory (${excused.length} excepted).`);
}
