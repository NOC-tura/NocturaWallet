#!/usr/bin/env node
// Owner rule: the TGE date is not published anywhere yet — not in the extension's sources, not in
// what it ships. This gate reads every source file of the package (src/, e2e/, scripts/, the HTML
// entries, the stylesheets) and every built file under dist/, and fails on any written form of the
// date the design uses (#22, #35: ISO, "Mon D, YYYY", the Unix timestamp) plus the other common ones.
//
// The date itself is never written in this file either: it is assembled from parts at run time, so
// the gate cannot become the leak it looks for.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** English ordinal suffix: 1st, 2nd, 3rd, 4th … 11th–13th, 21st … */
const ordinal = n => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[n % 10] ?? 'th'));

/**
 * Every written form this gate refuses, assembled from parts, lowercased (the comparison is
 * case-insensitive: "JAN", "Jan" and "jan" are the same date). Review H2 added the slash-ISO,
 * unpadded US, comma-less and ordinal forms, and the millisecond timestamp.
 */
export function forbiddenForms() {
  const year = 2000 + 27;
  const month = 3 - 2;
  const day = 2 * 9;
  const pad = n => String(n).padStart(2, '0');
  const long = MONTHS[month - 1];
  const short = long.slice(0, 3);
  const nth = `${day}${ordinal(day)}`;
  const seconds = Date.UTC(year, month - 1, day) / 1000;
  return [
    `${year}-${pad(month)}-${pad(day)}`,
    `${year}/${pad(month)}/${pad(day)}`,
    `${short} ${day}, ${year}`,
    `${short} ${day} ${year}`,
    `${long} ${day}, ${year}`,
    `${long} ${day} ${year}`,
    `${day} ${short} ${year}`,
    `${day} ${long} ${year}`,
    `${nth} ${long} ${year}`,
    `${long} ${nth}, ${year}`,
    `${long} ${nth} ${year}`,
    `${pad(day)}.${pad(month)}.${year}`,
    `${pad(day)}-${pad(month)}-${year}`,
    `${pad(day)}/${pad(month)}/${year}`,
    `${pad(month)}/${pad(day)}/${year}`,
    `${month}/${day}/${year}`,
    String(seconds),
    String(seconds * 1000),
  ].map(f => f.toLowerCase());
}

/** [path, form] for every file whose text contains a forbidden form, in any letter case. */
export function dateViolations(files, forms = forbiddenForms()) {
  const out = [];
  for (const {path, text} of files) {
    const lower = text.toLowerCase();
    for (const form of forms) if (lower.includes(form)) out.push(`${path}: contains the TGE date (${form.length} characters, not repeated here)`);
  }
  return out;
}

const TEXT = /\.(?:[cm]?[jt]sx?|html?|css|json|md|txt|svg|map)$/;
const SKIP_ROOT = new Set(['node_modules', 'test-results', 'playwright-report']);

function walk(dir, root, atRoot, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (atRoot && SKIP_ROOT.has(e)) continue;
      walk(p, root, false, out);
    } else if (TEXT.test(e)) out.push(relative(root, p).split(sep).join('/'));
  }
}

export function listScanned(root) {
  const out = [];
  walk(root, root, true, out);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (!existsSync(join(ROOT, 'dist', 'app'))) {
    console.error('INCONCLUSIVE: dist/app does not exist — build first, or the built files go unchecked');
    process.exit(1);
  }
  const files = listScanned(ROOT).map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')}));
  const problems = dateViolations(files);
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`no TGE date: ${files.length} source and built files checked`);
}
