#!/usr/bin/env node
/**
 * The Kotlin JVM test job's own check (M1c Task 6, controller ruling 10): Gradle's exit status
 * alone does not say WHICH tests ran — a `--tests` filter that matches one class still passes, a
 * class whose every test is skipped (`assumeTrue`) still passes. This reads the JUnit XML reports
 * Gradle wrote and requires, for EVERY named class: exactly one report, at least one test, and
 * zero failures, errors and skipped tests. Any other report present is an error too (the job
 * runs exactly the classes it names).
 *
 *   node scripts/android-jvm/check-reports.mjs <reports dir> <fully.qualified.Class> [...]
 *
 * Exit 0 = every class ran and passed; 1 = a class is missing / empty / failed / skipped, or an
 * unnamed report is present; 2 = usage. Tested by check-reports.test.mjs (positive and negative
 * controls over hand-written reports).
 */
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

export function readSuites(dir) {
  const out = new Map();
  for (const f of readdirSync(dir)) {
    if (!/^TEST-.*\.xml$/.test(f)) {
      continue;
    }
    const xml = readFileSync(join(dir, f), 'utf8');
    const m = /<testsuite\b([^>]*)>/.exec(xml);
    if (!m) {
      throw new Error(`${f}: no <testsuite> element`);
    }
    const attr = name => {
      const a = new RegExp(`\\b${name}="([^"]*)"`).exec(m[1]);
      if (!a) {
        throw new Error(`${f}: <testsuite> has no ${name}`);
      }
      return a[1];
    };
    const num = name => {
      const v = attr(name);
      if (!/^\d+$/.test(v)) {
        throw new Error(`${f}: ${name}="${v}" is not a count`);
      }
      return Number(v);
    };
    const name = attr('name');
    if (out.has(name)) {
      throw new Error(`two reports for ${name}`);
    }
    out.set(name, {tests: num('tests'), skipped: num('skipped'), failures: num('failures'), errors: num('errors')});
  }
  return out;
}

export function judge(suites, expected) {
  const problems = [];
  for (const cls of expected) {
    const s = suites.get(cls);
    if (!s) {
      problems.push(`${cls}: no report — it did not run`);
      continue;
    }
    if (s.tests === 0) {
      problems.push(`${cls}: 0 tests`);
    }
    for (const k of ['failures', 'errors', 'skipped']) {
      if (s[k] !== 0) {
        problems.push(`${cls}: ${s[k]} ${k}`);
      }
    }
  }
  for (const name of suites.keys()) {
    if (!expected.includes(name)) {
      problems.push(`${name}: a report for a class the job does not name`);
    }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, ...expected] = process.argv.slice(2);
  if (!dir || expected.length === 0) {
    console.error('usage: check-reports.mjs <reports dir> <Class> [...]');
    process.exit(2);
  }
  const suites = readSuites(dir);
  const problems = judge(suites, expected);
  if (problems.length > 0) {
    for (const p of problems) {
      console.error(`FAIL ${p}`);
    }
    process.exit(1);
  }
  const total = expected.reduce((n, c) => n + suites.get(c).tests, 0);
  console.log(`${expected.length} classes, ${total} tests, all ran and passed (0 skipped)`);
}
