#!/usr/bin/env node
// Spec §1: the vault module is imported only by the vault bundle (unlock page + worker, and
// the vault folder itself); storage.session is touched, and runtime messages are listened
// for, only by the background. Checked three
// ways: in the sources, in the built files — a shared chunk could carry vault code into the
// popup even when every source import looks right — and in the built manifests, because a
// web-accessible vault page could be framed by any web site, and messages from that frame
// would pass the background's own-origin check.
//
// The source rule reads every .ts/.tsx/.js/.jsx/.mjs/.cjs/.mts/.cts under extension/ (paths
// relative to it), not just src/: a file anywhere in the package can be bundled once an HTML
// entry loads it, and a file outside src/ importing ../src/vault/passkey did exactly that past
// an earlier src-only walk. Skipped, but only at the package ROOT: node_modules/ and dist/ (not
// ours / our output), e2e/ (never bundled) and scripts/ — Node tooling (this gate, the build,
// the fixture generator) that no page loads; a folder with one of these names nested deeper
// (src/popup/scripts/) is ordinary source and is read. __tests__/ is skipped at any depth
// (never bundled, wherever it sits). The HTML entries at the package root are checked as well:
// each may load only its own page's entry (ENTRIES), so no other file can become a bundle root.
//
// Limits, deliberate: the source rule reads text, so a comment that spells out a vault import
// trips it (fail-closed); a computed specifier (`import('../' + 'vault/x')`) is out of reach of
// any static check — the bundle markers below are the backstop for both.
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, posix, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const VAULT_ALLOWED = /^src\/(unlock|vault)\//;
// The vault page's own modules (unlockFlow, orchestrate, main) hold the seed while they run:
// they are vault code too, and only the vault page itself may import them.
const UNLOCK_ALLOWED = /^src\/unlock\//;
// The one entry each HTML page at the package root may load.
export const ENTRIES = {'popup.html': 'src/popup/main.ts', 'unlock.html': 'src/unlock/main.ts'};
// node_modules/, dist/, e2e/ and scripts/ are skipped only at the package ROOT — a nested
// src/popup/scripts/ is ordinary source a page can bundle, not this package's own tooling.
// __tests__/ is skipped at any depth (never bundled, wherever it sits). See the header.
const SKIP_DIRS_ROOT = new Set(['node_modules', 'dist', 'e2e', 'scripts']);
// Every extension a source file under the package can have: .ts/.tsx/.js/.jsx/.mjs/.cjs/.mts/.cts.
const SOURCE_EXT = /\.[cm]?[jt]sx?$/;
// The seed code the vault uses also lives in ../core/keys (mnemonic → seed, SLIP-0010), shared
// with the app; for this package it is vault code, allowed exactly where the vault is.
// src/ext.ts is the one wrapper over chrome.* / browser.*, so it names storage.session; in
// exchange, only the background may value-import it (EXT_IMPORT_ALLOWED) — except that the
// vault page may import exactly `readLocal` (LOCAL_READER), which reads storage.local only.
// Everywhere else `storage` may not appear as a property access or a destructuring key at all:
// `storage.session` alone missed `const {session} = chrome.storage` and
// `const {storage: {session: s}} = chrome`.
const SESSION_ALLOWED = /^src\/background\/|^src\/ext\.ts$/;
const EXT_IMPORT_ALLOWED = /^src\/background\//;
const LOCAL_READER = 'readLocal';
const LOCAL_READER_ALLOWED = /^src\/unlock\//;
const TOUCHES_SESSION = /storage\s*(?:\?\.|\.)\s*session\b|storage\s*\[\s*['"`]session['"`]\s*\]/;
// `.storage` / `?.storage`, `x['storage']`, and `storage` as a destructuring key (`{storage}`,
// `{a, storage}`, `{storage: …}`, `{storage = …}`). localStorage/sessionStorage do not match.
const TOUCHES_STORAGE = /(?:\?\.|\.)\s*storage\b|\[\s*['"`]storage['"`]\s*\]|[{,]\s*storage\s*[,}:=]/;
// vault.setKeys travels by runtime.sendMessage, which EVERY extension page with a runtime
// listener receives, keys included — so only the background may listen. Any mention of the
// listener names counts (property, bracket, destructured, comment: fail-closed); a worker's
// lowercase `onmessage` and `sendMessage` are different identifiers.
const LISTENS_RUNTIME = /\bon(?:Message|Connect)(?:External)?\b/;
const LISTEN_ALLOWED = /^src\/background\//;
// storage.local keys only the background writes (plan B1b-1): no other file may even name them —
// a popup writing v1_settings could undo a re-authenticated setting without re-authenticating.
export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until'];
const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;

// A string that exists only in the vault's envelope code (the passkey-wrap HKDF info).
export const VAULT_MARKER = 'noctura-ext-v1/passkey-wrap';
// A string that exists only in key derivation (micro-key-producer/slip10's MASTER_SECRET):
// derivation code in the background without the envelope must fail the gate as well.
export const DERIVATION_MARKER = 'ed25519 seed';
// A string that exists only in @scure/bip39 (its phrase normalizer, which mnemonicToSeed and
// validateMnemonic run): core/keys/mnemonic carries neither marker above.
export const BIP39_MARKER = 'invalid mnemonic type: ';
// The passkey RP ID, which only src/vault/passkey.ts spells in code. The built manifest names
// the same host (a host permission), so only JS files count — for presence and for leaks.
export const PASSKEY_MARKER = 'wallet.noc-tura.io';
// An error message of @noble/hashes' Argon2 parameter check: the KDF, found in the vault
// worker only (checked against the real build: no other built file carries it).
export const KDF_MARKER = '(memory) must be at least 8*p bytes';
// The BIP-39 English wordlist, as the build emits it (a template literal with real newlines —
// checked against a real Vite build): generateMnemonic and validateMnemonic carry it into the vault
// page, and nothing else may carry it.
export const WORDLIST_MARKER = 'abandon\nability\nable\nabout';
const MARKERS = [
  ['envelope', VAULT_MARKER],
  ['derivation', DERIVATION_MARKER],
  ['bip39', BIP39_MARKER],
  ['passkey', PASSKEY_MARKER],
  ['kdf', KDF_MARKER],
  ['wordlist', WORDLIST_MARKER],
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
  for (const m of text.matchAll(FROM_CLAUSE)) refs.push({spec: m[5], typeOnly: m[2] !== undefined, kind: m[1], clause: m[3]});
  for (const re of OTHER_REFERENCES) for (const m of text.matchAll(re)) refs.push({spec: m[2], typeOnly: false, kind: null, clause: null});
  return refs;
}

/** `import {readLocal}` (optionally renamed, alongside inline type-only names) and nothing else. */
function importsOnlyLocalReader(ref) {
  if (ref.kind !== 'import' || ref.clause === null) return false;
  const named = /^\{([^}]*)\}$/.exec(ref.clause.trim());
  if (!named) return false;
  const values = named[1].split(',').map(n => n.trim()).filter(n => n !== '' && !/^type\s/.test(n));
  return values.length > 0 && values.every(n => new RegExp(`^${LOCAL_READER}(\\s+as\\s+[\\w$]+)?$`).test(n));
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

function namesUnlock(fromPath, spec) {
  const target = resolveSource(fromPath, spec);
  return target !== null && (target === 'src/unlock' || target.startsWith('src/unlock/'));
}

function namesCoreKeys(fromPath, spec) {
  const target = resolveSource(fromPath, spec);
  if (target !== null) return target === '../core/keys' || target.startsWith('../core/keys/');
  return /(^|[/@])core\/keys(\/|$)/.test(spec);
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
    if (!VAULT_ALLOWED.test(path) && values.some(r => namesCoreKeys(path, r.spec))) out.push(`${path}: imports core/keys (seed code)`);
    if (!UNLOCK_ALLOWED.test(path) && values.some(r => namesUnlock(path, r.spec))) out.push(`${path}: imports the vault page (src/unlock)`);
    if (!SESSION_ALLOWED.test(path) && (TOUCHES_SESSION.test(text) || TOUCHES_STORAGE.test(text))) {
      out.push(`${path}: touches storage outside src/ext.ts and the background`);
    }
    if (!LISTEN_ALLOWED.test(path) && LISTENS_RUNTIME.test(text)) out.push(`${path}: listens for runtime messages outside the background`);
    if (!BACKGROUND_OWNED_ALLOWED.test(path)) {
      for (const key of BACKGROUND_OWNED_KEYS) if (text.includes(key)) out.push(`${path}: names ${key}, which only the background may write`);
    }
    const extRefs = values.filter(r => namesExt(path, r.spec));
    const localReaderOnly = LOCAL_READER_ALLOWED.test(path) && extRefs.every(importsOnlyLocalReader);
    if (!EXT_IMPORT_ALLOWED.test(path) && path !== 'src/ext.ts' && extRefs.length > 0 && !localReaderOnly) {
      out.push(`${path}: imports src/ext.ts (storage.session) outside the background`);
    }
  }
  return out;
}

/**
 * Every `<script>` in the root HTML pages must be `src=` its own page's entry (ENTRIES). A page
 * with no entry of its own may load nothing; an inline script (Vite bundles an inline module
 * too) or a src it cannot read fails closed.
 */
export function htmlViolations(pages) {
  const out = [];
  for (const {path, text} of pages) {
    const own = ENTRIES[path];
    for (const m of text.matchAll(/<script\b[^>]*>/gi)) {
      const src = /\bsrc\s*=\s*(["'])([^"']*)\1/i.exec(m[0]);
      if (!src) {
        out.push(`${path}: has a <script> without a src`);
        continue;
      }
      const target = posix.normalize(src[2].replace(/^\//, ''));
      if (own === undefined) out.push(`${path}: loads ${src[2]} — this page has no entry of its own`);
      else if (target !== own) out.push(`${path}: loads ${src[2]} — only ${own} may be its entry`);
    }
  }
  return out;
}

/** The files the source rule reads, relative to `root` with / separators (see the header). */
export function listSourceFiles(root) {
  const out = [];
  const walk = (dir, atRoot) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        if (e === '__tests__') continue;
        if (atRoot && SKIP_DIRS_ROOT.has(e)) continue;
        walk(p, false);
      } else if (SOURCE_EXT.test(e)) out.push(toPosix(relative(root, p)));
    }
  };
  walk(root, true);
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
  const js = all.filter(p => /\.m?js$/.test(p));
  for (const [name, marker] of MARKERS) {
    if (!js.some(p => readFileSync(join(distApp, p), 'utf8').includes(marker))) {
      out.push(`INCONCLUSIVE: the ${name} marker "${marker}" is in no built JS file — the check would pass trivially`);
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

  // The other direction: the vault page may not load the background entry. Importing background.js
  // runs it — its runtime listeners and its poller — inside the vault page (a Rolldown runtime helper
  // placed in background.js once made the unlock bundle import it, and every marker check passed).
  if (all.includes('unlock.html')) {
    const html = readFileSync(join(distApp, 'unlock.html'), 'utf8');
    for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g)) {
      const r = resolveBuilt(distApp, 'unlock.html', m[1]);
      if (r.problem) problems.add(r.problem);
      else if (reachable(distApp, r.target, problems).includes('background.js')) out.push(`the vault page (${r.target}) reaches background.js — it would run the background`);
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
  const files = listSourceFiles(ROOT).map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')}));
  const pages = readdirSync(ROOT).filter(e => /\.html?$/i.test(e)).map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')}));
  const problems = [...sourceViolations(files), ...htmlViolations(pages)];
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
