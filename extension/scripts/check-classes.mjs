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
  // Plan 3: #19's check rows (screens/Review.tsx) — PASS rows `ok`, the recipient warnings `warn`.
  '${c.tone}': ['ok', 'warn'],
  // B1b-2b plan 2: #15's avatar gradient (addressBook.ts AVATARS, ix:1440-1444).
  '${avatarOf(c.address)}': ['violet', 'mint', 'coral', 'amber', 'blue'],
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

// ── The vault page (plan 2) ───────────────────────────────────────────────────────────────────
// unlock.html and src/unlock are plain DOM (spec S1): no className= JSX. The page names classes in
// its markup (`class="…"`) and in code only through the DOM helper `h(tag, '…')`, `.className = '…'`
// and `classList.add|remove|toggle('…')`. In the vault page a class must be one literal string: a
// computed one is refused outright (nothing to list, nothing to check).

/** `h` itself assigns its parameter (`el.className = cls`): the one computed class the gate accepts, there only. */
const HELPER = {path: 'src/unlock/view/dom.ts', expr: 'cls'};

/** The stylesheets src/unlock/main.ts imports, relative to the package. */
export const VAULT_SHEETS = ['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/unlock/unlock.css'];

/**
 * Classes named in unlock.html (`html: true`) or in a src/unlock module, and any computed class expression.
 * Read: `h('tag', cls)`, `.className = cls` and `+=`, every argument of `classList.add|remove|replace`,
 * the first of `classList.toggle` (its second is the force flag), and `setAttribute('class', cls)`.
 * Known blind spots: h()'s tag is matched only as a single-quoted literal (`h('div', …)`, the one form
 * Prettier writes today), so a template-literal or computed tag hides that call's class; an argument
 * list is read up to its first `)`, so a call inside one (`add('a', f(x))`) is reported as a computed
 * `f(x` rather than parsed; `classList.value =`, `setAttributeNS(…, 'class', …)` and `toggleAttribute`
 * are not read (src/unlock uses none; a computed property write is refused by the vault-isolation
 * gate's MARKUP_EVASIONS).
 */
export function vaultClassUses(src, html) {
  const classes = [];
  const computed = [];
  if (html) {
    for (const m of src.matchAll(/\bclass\s*=\s*(["'])([^"']*)\1/g)) classes.push(...words(m[2]));
    return {classes, computed};
  }
  const take = arg => {
    const a = arg.trim();
    const lit = /^(['"])([^'"]*)\1$/.exec(a);
    if (lit) classes.push(...words(lit[2]));
    else computed.push(a);
  };
  for (const m of src.matchAll(/\bh\(\s*'[a-z0-9]+'\s*,\s*([^,)]+)/g)) take(m[1]);
  for (const m of src.matchAll(/\.className\s*\+?=(?!=)\s*([^;\n]+)/g)) take(m[1]);
  for (const m of src.matchAll(/\bclassList\.(add|remove|replace|toggle)\(([^)]*)\)?/g)) {
    const args = m[2].split(',').filter(a => a.trim() !== '');
    for (const a of m[1] === 'toggle' ? args.slice(0, 1) : args) take(a);
  }
  for (const m of src.matchAll(/\bsetAttribute\(\s*(['"])class\1\s*,\s*([^)]+)\)?/g)) take(m[2]);
  return {classes, computed};
}

/** unlock.html and every .ts under src/unlock/ except the tests, relative to the package. */
export function listVaultFiles(root = ROOT) {
  const out = [];
  const walkTs = dir => {
    for (const e of readdirSync(dir, {withFileTypes: true})) {
      if (e.name === '__tests__') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walkTs(p);
      else if (e.name.endsWith('.ts')) out.push(relative(root, p).split(sep).join('/'));
    }
  };
  if (existsSync(join(root, 'src', 'unlock'))) walkTs(join(root, 'src', 'unlock'));
  return ['unlock.html', ...out.sort()];
}

function loadVaultDefined() {
  const all = new Set();
  for (const sheet of VAULT_SHEETS) for (const c of definedClasses(readFileSync(join(ROOT, sheet), 'utf8'))) all.add(c);
  return all;
}

/** One line per vault-page class defined in no vault stylesheet, and per computed class. */
export function vaultClassViolations(files = listVaultFiles().map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')})), defined = loadVaultDefined()) {
  const out = [];
  for (const {path, text} of files) {
    const {classes, computed} = vaultClassUses(text, path.endsWith('.html'));
    for (const c of new Set(classes)) if (!defined.has(c)) out.push(`${path}: class "${c}" is defined in no stylesheet the vault page loads`);
    for (const e of computed) if (e !== "''" && !(path === HELPER.path && e === HELPER.expr)) out.push(`${path}: computed class ${e} — the vault page names classes as literal strings only`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = listScreens();
  const vaultFiles = listVaultFiles();
  const problems = [...classViolations(), ...vaultClassViolations()];
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`classes ok: every class in ${files.length} src/app files is defined by ${SHEETS.join(', ')}; every class in ${vaultFiles.length} vault-page files by ${VAULT_SHEETS.join(', ')}`);
}
