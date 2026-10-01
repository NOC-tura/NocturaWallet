#!/usr/bin/env node
// Every class a screen names must be styled (CLAUDE.md: build to the design, never silently drop an
// element of it). The app loads three stylesheets — web's design-system.css (tokens, type, buttons),
// design-ext.css (the design's screen classes, extracted from index.html) and app.css (the extension's
// own layout) — and a className defined in none of them renders unstyled with no error anywhere.
// Tasks 12–15 kept lists of such classes by hand; this gate reads the source instead.
//
// What it reads, in every .tsx under src/app/ (tests excluded): `className=` and `<name>Class=`
// attributes, and `className = '…'` / `<name>Class = '…'` parameter defaults — a string, or a braced
// expression whose string literals (those not compared with === / !==) and template-literal text are
// classes. An interpolation with no string in it (`${tone}`) is dynamic: it must be listed in DYNAMIC
// with every value it can take, and each value is checked too. A class passed through a prop
// (`${className}`) is checked where the prop is given its value.
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The stylesheets src/app/mount.tsx imports, relative to the package. */
export const SHEETS = ['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/app/app.css'];

/**
 * Each dynamic class pattern the app uses, with every value it can take. The values follow the
 * types: Banner's `tone` ('info' | 'warning' | 'danger'), history's row tone, TokenTile's token
 * (lower-cased), App's surface. A pass-through prop maps to [] (its values are literals elsewhere).
 */
export const DYNAMIC = {
  '${tone}': ['info', 'warning', 'danger'],
  '${t.tone}': ['send', 'recv', 'swap', 'fail'],
  '${token.toLowerCase()}': ['sol', 'noc', 'usdc', 'usdt'],
  'app-${surface}': ['app-popup', 'app-tab'],
  '${className}': [],
  '${titleClass}': [],
};

/** The text of the quoted string that starts at `i` (the quote), and the index after it. */
function readString(src, i) {
  const q = src[i];
  let j = i + 1;
  let out = '';
  while (j < src.length && src[j] !== q) {
    if (src[j] === '\\') {
      out += src[j + 1] ?? '';
      j += 2;
    } else out += src[j++];
  }
  return {text: out, end: j + 1};
}

/** The index after the brace that closes the one at `i`, skipping strings and template literals. */
function closeBrace(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "'" || c === '"') j = readString(src, j).end - 1;
    else if (c === '`') j = readTemplate(src, j).end - 1;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return j + 1;
  }
  return src.length;
}

/** A template literal at `i`: its static parts and its `${…}` expressions, in order. */
function readTemplate(src, i) {
  const parts = [];
  let text = '';
  let j = i + 1;
  while (j < src.length && src[j] !== '`') {
    if (src[j] === '\\') {
      text += src[j + 1] ?? '';
      j += 2;
    } else if (src[j] === '$' && src[j + 1] === '{') {
      parts.push({text});
      text = '';
      const end = closeBrace(src, j + 1);
      parts.push({expr: src.slice(j + 2, end - 1).trim()});
      j = end;
    } else text += src[j++];
  }
  parts.push({text});
  return {parts, end: j + 1};
}

/** The string literals in an expression that are classes — not the operands of === or !==. */
function literalsIn(expr) {
  const out = [];
  for (let j = 0; j < expr.length; j++) {
    const c = expr[j];
    if (c !== "'" && c !== '"' && c !== '`') continue;
    const r = c === '`' ? {text: readTemplate(expr, j).parts.map(p => p.text ?? ' ').join(''), end: readTemplate(expr, j).end} : readString(expr, j);
    const before = expr.slice(0, j).trimEnd();
    const after = expr.slice(r.end).trimStart();
    if (!/[!=]==$/.test(before) && !/^[!=]==/.test(after)) out.push(r.text);
    j = r.end - 1;
  }
  return out;
}

const words = s => s.split(/\s+/).filter(Boolean);

/** Classes and dynamic class patterns named in one source file, in order of appearance. */
export function classUses(src) {
  const classes = [];
  const dynamic = [];
  const attr = /\b(?:className|[a-z][A-Za-z]*Class)\s*=\s*(?=['"{`])/g;
  for (const m of src.matchAll(attr)) {
    const i = m.index + m[0].length;
    const c = src[i];
    if (c === "'" || c === '"') {
      classes.push(...words(readString(src, i).text));
      continue;
    }
    const expr = c === '{' ? src.slice(i + 1, closeBrace(src, i) - 1).trim() : src.slice(i, readTemplate(src, i).end);
    if (expr.startsWith('`')) {
      // Rebuild the class list with each readable interpolation as a gap and each unreadable one kept
      // as `${expr}`, so a prefix like `app-${surface}` stays one (dynamic) token.
      let shape = '';
      for (const p of readTemplate(expr, 0).parts) {
        if (p.text !== undefined) shape += p.text;
        else {
          const lits = literalsIn(p.expr);
          if (lits.length > 0) shape += ` ${lits.join(' ')} `;
          else shape += '${' + p.expr + '}';
        }
      }
      for (const w of words(shape)) (w.includes('${') ? dynamic : classes).push(w);
    } else classes.push(...literalsIn(expr).flatMap(words));
  }
  return {classes, dynamic};
}

/** Every class a stylesheet has a selector for (comments, strings and url()s ignored). */
export function definedClasses(css) {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/url\([^)]*\)/g, ' ')
    .replace(/(['"])(?:\\.|(?!\1).)*\1/g, ' ');
  return new Set([...text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));
}

function walk(root, dir, out) {
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    if (e.name === '__tests__') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(root, p, out);
    else if (e.name.endsWith('.tsx')) out.push(relative(root, p).split(sep).join('/'));
  }
}

/** Every .tsx under src/app/ except the tests, relative to the package. */
export function listScreens(root = ROOT) {
  const out = [];
  const dir = join(root, 'src', 'app');
  if (existsSync(dir)) walk(root, dir, out);
  return out.sort();
}

function loadDefined() {
  const all = new Set();
  for (const sheet of SHEETS) for (const c of definedClasses(readFileSync(join(ROOT, sheet), 'utf8'))) all.add(c);
  return all;
}

/** One line per class named in `files` and defined in no stylesheet; [] when all are styled. */
export function classViolations(files = listScreens().map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')})), defined = loadDefined()) {
  const out = [];
  for (const {path, text} of files) {
    const {classes, dynamic} = classUses(text);
    const seen = new Set();
    for (const c of classes) {
      if (defined.has(c) || seen.has(c)) continue;
      seen.add(c);
      out.push(`${path}: class "${c}" is defined in no stylesheet`);
    }
    for (const d of new Set(dynamic)) {
      const values = DYNAMIC[d];
      if (values === undefined) {
        out.push(`${path}: dynamic class ${d} is not listed in DYNAMIC — list the values it can take`);
        continue;
      }
      for (const v of values) if (!defined.has(v)) out.push(`${path}: class "${v}" (a value of ${d}) is defined in no stylesheet`);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = listScreens();
  const problems = classViolations();
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`classes ok: every class in ${files.length} src/app files is defined by ${SHEETS.join(', ')}`);
}
