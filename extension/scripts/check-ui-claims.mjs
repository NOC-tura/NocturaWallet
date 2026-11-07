#!/usr/bin/env node
// B1e §6.1, §6.4 (B1e-2 Task 6): the extension's own screens say nothing its privacy policy contradicts. The claims and
// the true sentences allowed (each with its verdict and the tiers it holds on) are scripts/claims.mjs — the one list the
// store texts' and the privacy policy's tests read too; this file is the guard's readers and the gate's CLI.
//
// What is read is what a user can see: in the HTML entries, the text between tags and the visible attributes (in any
// quoting: double, single or none; comments, <script>, <style>, <template> dropped with their content); in src/**/*.ts(x)
// (tests excluded), the string literals, template literals and JSX text found by the TypeScript parser — never comments
// or identifiers. The CLI reads the BUILT packages the same way (HTML and JS) per NOCTURA_DIST, on the 'built' tier, so
// text from ../core that a bundle carries is read too; an allowance no built file uses any more fails.
//
// The limit (claims.mjs says it too): a sentence assembled at run time from pieces, or text from data, is read piece by
// piece — a word list is a review aid, not a proof.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {isMain} from './isMain.mjs';
import {distDir} from './distDir.mjs';
import {claimViolations, unusedAllowances} from './claims.mjs';

const collapse = s => s.replace(/\s+/g, ' ').trim();

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', middot: '·', hellip: '…'};
const decode = s =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** The attributes a user sees or hears (a button's `value` is its label). */
const VISIBLE_ATTRS = new Set(['aria-label', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'aria-valuetext', 'placeholder', 'title', 'alt', 'value']);
/** One attribute in a start tag: its name, then a double-quoted, single-quoted or unquoted value (HTML's three forms). */
const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
/** Tags that run inside a sentence: removed without a break, so "the <a>Terms</a>." stays one unit. */
const INLINE = /^(?:a|b|i|em|strong|span|code|small|svg|use|kbd|br|wbr|label)$/i;

/** The visible text of an HTML file: one unit per block of text, plus one per visible attribute value. */
export function htmlUnits(html, where) {
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, '');
  const units = [];
  for (const tag of body.matchAll(/<[a-z][a-z0-9-]*\b([^>]*)>/gi)) {
    for (const m of tag[1].matchAll(ATTR)) {
      const value = m[2] ?? m[3] ?? m[4];
      if (VISIBLE_ATTRS.has(m[1].toLowerCase()) && value !== undefined && value.trim() !== '') units.push({where: `${where} [attribute]`, text: decode(value)});
    }
  }
  const text = body.replace(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi, (_, tag) => (INLINE.test(tag) ? '' : '\n'));
  for (const line of text.split('\n')) {
    const t = collapse(decode(line));
    if (t !== '') units.push({where, text: t});
  }
  return units;
}

/** The string literals, template literals (each `${…}` as "${}") and JSX text of a TS / TSX / JS file. */
export function scriptUnits(code, where, kind = ts.ScriptKind.TSX) {
  const sf = ts.createSourceFile(where, code, ts.ScriptTarget.Latest, true, kind);
  const units = [];
  const visit = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) units.push({where, text: node.text});
    else if (ts.isTemplateExpression(node)) units.push({where, text: node.head.text + node.templateSpans.map(s => '${}' + s.literal.text).join('')});
    else if (ts.isJsxText(node)) {
      const t = collapse(node.text);
      if (t !== '') units.push({where, text: t});
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return units;
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

const toPosix = p => p.split(sep).join('/');
const isTest = rel => /(^|\/)__tests__\//.test(rel) || /\.test\.tsx?$/.test(rel);

/** The source tier: the package's HTML entries and every non-test .ts / .tsx under src/ (both builds' code). */
export function sourceUnits(root) {
  const files = [];
  for (const name of readdirSync(root).sort()) if (name.endsWith('.html')) files.push(name);
  for (const p of listFiles(join(root, 'src'))) {
    const rel = toPosix(relative(root, p));
    if (/\.tsx?$/.test(rel) && !rel.endsWith('.d.ts') && !isTest(rel)) files.push(rel);
  }
  const units = [];
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    units.push(...(rel.endsWith('.html') ? htmlUnits(text, rel) : scriptUnits(text, rel, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)));
  }
  return {files, units};
}

/** The built tier: every .html and .js file of one package directory. */
export function builtUnits(dir, label = dir) {
  const files = listFiles(dir)
    .map(p => toPosix(relative(dir, p)))
    .filter(rel => rel.endsWith('.html') || rel.endsWith('.js'))
    .filter(rel => rel !== 'licenses.html'); // the licence texts: other people's words, as written (B1e §4.2)
  const units = [];
  for (const rel of files) {
    const text = readFileSync(join(dir, rel), 'utf8');
    units.push(...(rel.endsWith('.html') ? htmlUnits(text, `${label}/${rel}`) : scriptUnits(text, `${label}/${rel}`, ts.ScriptKind.JS)));
  }
  return {files, units};
}

if (isMain(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const DIST = distDir();
  const problems = [];
  const used = new Set();
  let files = 0;
  for (const browser of ['chrome', 'firefox']) {
    const dir = join(ROOT, DIST, browser);
    if (!existsSync(dir)) {
      problems.push(`INCONCLUSIVE: ${DIST}/${browser} is missing`);
      continue;
    }
    const built = builtUnits(dir, `${DIST}/${browser}`);
    files += built.files.length;
    problems.push(...claimViolations(built.units, {tier: 'built', used}));
  }
  if (problems.length === 0) problems.push(...unusedAllowances(used, 'built'));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`ui claims ok (${DIST}): ${files} built HTML / JS files of chrome/ and firefox/, no claim the privacy policy contradicts (${used.size} allowances used)`);
}
