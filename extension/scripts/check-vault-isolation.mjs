#!/usr/bin/env node
// Spec §1: the vault module is imported only by the vault bundle (unlock page + worker, and
// the vault folder itself); storage.session is touched only by the background. Checked three
// ways: in the sources, in the built files — a shared chunk could carry vault code into the
// popup even when every source import looks right — and in the built manifests, because a
// web-accessible vault page could be framed by any web site, and messages from that frame
// would pass the background's own-origin check.
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, posix, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const VAULT_ALLOWED = /^src\/(unlock|vault)\//;
// src/ext.ts is the one wrapper over chrome.* / browser.*, so it names storage.session; in
// exchange, only the background may value-import it (EXT_IMPORT_ALLOWED).
const SESSION_ALLOWED = /^src\/background\/|^src\/ext\.ts$/;
const EXT_IMPORT_ALLOWED = /^src\/background\//;
const TOUCHES_SESSION = /storage\s*(?:\?\.|\.)\s*session\b|storage\s*\[\s*['"`]session['"`]\s*\]/;

// A string that exists only in the vault's envelope code (the passkey-wrap HKDF info).
export const VAULT_MARKER = 'noctura-ext-v1/passkey-wrap';
// A string that exists only in key derivation (micro-key-producer/slip10's MASTER_SECRET):
// derivation code in the background without the envelope must fail the gate as well.
export const DERIVATION_MARKER = 'ed25519 seed';
const MARKERS = [
  ['envelope', VAULT_MARKER],
  ['derivation', DERIVATION_MARKER],
];

// `import X from`, `import {a, type B} from`, `import * as n from`, `import type … from`,
// `export {a} from`, `export * from`, `export * as n from`, `export type {…} from`. The clause
// grammar is spelled out (not `[^;]*`) so one statement's match cannot swallow the next.
const FROM_CLAUSE =
  /\b(import|export)\s+(type\s+)?((?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+))\s*from\s*(['"`])([^'"`]+)\4/g;
// Every other way to name a module: `import 'x'`, `import('x')`, `require('x')`, and a worker
// or asset `new URL('x', import.meta.url)`. A template literal counts up to its first `${`.
const OTHER_REFERENCES = [
  /\bimport\s*(['"`])([^'"`]+)\1/g,
  /\bimport\s*\(\s*(['"`])([^'"`$]*)/g,
  /\brequire\s*\(\s*(['"`])([^'"`$]*)/g,
  /\bnew\s+URL\s*\(\s*(['"`])([^'"`$]*)/g,
];

/** Every module a source file names, with whether that reference is type-only (erased). */
function moduleReferences(text) {
  const refs = [];
  for (const m of text.matchAll(FROM_CLAUSE)) refs.push({spec: m[5], typeOnly: m[2] !== undefined});
  for (const re of OTHER_REFERENCES) for (const m of text.matchAll(re)) refs.push({spec: m[2], typeOnly: false});
  return refs;
}

/** Where a specifier points, as a path relative to the package (`src/vault/kdf`), or null. */
function resolveSource(fromPath, spec) {
  if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
    return posix.normalize(posix.join(posix.dirname(fromPath), spec));
  }
  return null;
}

function namesVault(fromPath, spec) {
  const target = resolveSource(fromPath, spec);
  if (target !== null) return target === 'src/vault' || target.startsWith('src/vault/');
  // A bare or aliased specifier (`@/vault/x`): refuse any path segment named vault.
  return /(^|\/)vault(\/|$)/.test(spec);
}

function namesExt(fromPath, spec) {
  const target = resolveSource(fromPath, spec);
  return target !== null && /^src\/ext(\.[cm]?[jt]s)?$/.test(target);
}

export function sourceViolations(files) {
  const out = [];
  for (const {path, text} of files) {
    // Only `import type` / `export type` is erased; an inline `{type A}` is not — under
    // verbatimModuleSyntax it survives as a side-effect import — so it counts as a value import.
    const values = moduleReferences(text).filter(r => !r.typeOnly);
    if (!VAULT_ALLOWED.test(path) && values.some(r => namesVault(path, r.spec))) out.push(`${path}: imports the vault`);
    if (!SESSION_ALLOWED.test(path) && TOUCHES_SESSION.test(text)) out.push(`${path}: touches storage.session`);
    if (!EXT_IMPORT_ALLOWED.test(path) && path !== 'src/ext.ts' && values.some(r => namesExt(path, r.spec))) {
      out.push(`${path}: imports src/ext.ts (storage.session) outside the background`);
    }
  }
  return out;
}

function listFiles(dir, re) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== '__tests__') out.push(...listFiles(p, re));
    } else if (re.test(e)) out.push(p);
  }
  return out;
}

const toPosix = p => p.split(sep).join('/');

// Module references in built JS: static and side-effect imports (`from"./x.js"`, `import"./x.js"`),
// dynamic ones (`import("./x.js")`, inside Vite's `__vitePreload(() => import(...))` too), and
// URLs built against the module (`new URL("w.js", import.meta.url)` — how Vite loads a worker).
const BUILT_IMPORT = /\b(?:from|import)\s*\(?\s*(['"`])([^'"`$]+)\1/g;
const BUILT_URL = /\bnew\s+URL\s*\(\s*(['"`])([^'"`$]+)\1\s*,\s*import\.meta\.url/g;

function builtReferences(text) {
  const refs = [];
  for (const m of text.matchAll(BUILT_IMPORT)) {
    if (/^(\.\.?\/|\/[^/])/.test(m[2])) refs.push(m[2]);
  }
  for (const m of text.matchAll(BUILT_URL)) {
    if (!/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(m[2])) refs.push(m[2]);
  }
  return refs;
}

/** A reference from `fromRel` resolved inside dist, or a problem string. */
function resolveBuilt(distApp, fromRel, spec) {
  const clean = spec.replace(/[?#].*$/, '');
  const target = clean.startsWith('/') ? posix.normalize(clean.slice(1)) : posix.normalize(posix.join(posix.dirname(fromRel), clean));
  if (target === '..' || target.startsWith('../')) return {problem: `${fromRel} imports ${spec}, which leaves dist`};
  const abs = join(distApp, target);
  if (!existsSync(abs) || !statSync(abs).isFile()) return {problem: `${fromRel} imports ${spec}, which is not a built file`};
  return {target};
}

/** Every file reachable from an entry inside dist, following every reference kind above. */
function reachable(distApp, entryRel, problems) {
  const seen = new Set();
  const stack = [entryRel];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!/\.m?js$/.test(rel)) continue;
    for (const spec of builtReferences(readFileSync(join(distApp, rel), 'utf8'))) {
      const r = resolveBuilt(distApp, rel, spec);
      if (r.problem) problems.add(r.problem);
      else stack.push(r.target);
    }
  }
  return [...seen];
}

export function bundleViolations(distApp) {
  const out = [];
  const problems = new Set();
  const all = listFiles(distApp, /./).map(p => toPosix(relative(distApp, p)));
  for (const [name, marker] of MARKERS) {
    if (!all.some(p => readFileSync(join(distApp, p), 'utf8').includes(marker))) {
      out.push(`INCONCLUSIVE: the ${name} marker "${marker}" is in no built file — the check would pass trivially`);
    }
  }

  // Non-vault entries: the background, and every page except the vault page itself.
  const entries = [];
  for (const required of ['background.js', 'popup.html']) {
    if (!all.includes(required)) out.push(`${required} is missing`);
  }
  if (all.includes('background.js')) entries.push('background.js');
  for (const page of all.filter(p => /\.html?$/.test(p) && p !== 'unlock.html')) {
    const html = readFileSync(join(distApp, page), 'utf8');
    for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g)) {
      const r = resolveBuilt(distApp, page, m[1]);
      if (r.problem) problems.add(r.problem);
      else entries.push(r.target);
    }
  }

  for (const entry of entries) {
    for (const file of reachable(distApp, entry, problems)) {
      const text = readFileSync(join(distApp, file), 'utf8');
      for (const [name, marker] of MARKERS) {
        if (text.includes(marker)) out.push(`${file} (reachable from ${entry}) contains vault code (${name})`);
      }
    }
  }
  return [...out, ...problems];
}

/** Could this web_accessible_resources pattern match an .html page? */
function coversPage(resource) {
  const s = resource.toLowerCase();
  if (/\.x?html?$/.test(s)) return true;
  if (!/[*?]/.test(s)) return false;
  // A wildcard is safe only when what follows the last one is a fixed, non-page extension
  // (`img/*.png`); anything else (`*`, `**/*`, `unlock.*`, `*.htm*`) could cover a page.
  const tail = s.slice(Math.max(s.lastIndexOf('*'), s.lastIndexOf('?')) + 1);
  return !/^\.[a-z0-9]+$/.test(tail) || /^\.x?html?$/.test(tail);
}

export function manifestViolations(manifest) {
  const war = manifest.web_accessible_resources;
  if (war === undefined) return [];
  const shape = ['web_accessible_resources has an unexpected shape'];
  if (!Array.isArray(war)) return shape;
  const resources = [];
  for (const entry of war) {
    if (typeof entry === 'string') resources.push(entry);
    else if (entry && Array.isArray(entry.resources) && entry.resources.every(r => typeof r === 'string')) resources.push(...entry.resources);
    else return shape;
  }
  return resources.filter(coversPage).map(r => `web_accessible_resources exposes "${r}" — a web page could frame the vault page`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = listFiles(join(ROOT, 'src'), /\.[cm]?[jt]sx?$/).map(p => ({path: toPosix(relative(ROOT, p)), text: readFileSync(p, 'utf8')}));
  const problems = [...sourceViolations(files)];
  for (const d of ['app', 'chrome', 'firefox']) {
    for (const p of bundleViolations(join(ROOT, 'dist', d))) problems.push(`dist/${d}: ${p}`);
  }
  for (const browser of ['chrome', 'firefox']) {
    const m = JSON.parse(readFileSync(join(ROOT, 'dist', browser, 'manifest.json'), 'utf8'));
    for (const p of manifestViolations(m)) problems.push(`dist/${browser}/manifest.json: ${p}`);
  }
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('vault isolation ok: sources, built popup/background and both manifests carry no path to the vault');
}
