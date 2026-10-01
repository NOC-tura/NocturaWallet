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
export const ENTRIES = {'popup.html': 'src/app/popup.tsx', 'wallet.html': 'src/app/tab.tsx', 'unlock.html': 'src/unlock/main.ts'};
// node_modules/, dist/, e2e/ and scripts/ are skipped only at the package ROOT — a nested
// src/popup/scripts/ is ordinary source a page can bundle, not this package's own tooling.
// __tests__/ is skipped at any depth (never bundled, wherever it sits). See the header.
const SKIP_DIRS_ROOT = new Set(['node_modules', 'dist', 'e2e', 'scripts']);
// Every extension a source file under the package can have: .ts/.tsx/.js/.jsx/.mjs/.cjs/.mts/.cts.
const SOURCE_EXT = /\.[cm]?[jt]sx?$/;
// The seed code the vault uses also lives in ../core/keys (mnemonic → seed, SLIP-0010), shared
// with the app; for this package it is vault code, allowed exactly where the vault is.
// src/ext.ts is the one wrapper over chrome.* / browser.*, so it names storage.session; in
// exchange, only the background may value-import it (EXT_IMPORT_ALLOWED). The vault page's one
// storage call is src/shared/readLocal.ts (LOCAL_READER): it reads storage.local and nothing else —
// it may not name storage.session, write, or import anything — and only the vault page may import
// it. (It used to be an ext.ts export, which put all of ext.ts in the vault page's bundle.)
// Everywhere else `storage` may not appear as a property access or a destructuring key at all:
// `storage.session` alone missed `const {session} = chrome.storage` and
// `const {storage: {session: s}} = chrome`.
const SESSION_ALLOWED = /^src\/background\/|^src\/ext\.ts$/;
const EXT_IMPORT_ALLOWED = /^src\/background\//;
const LOCAL_READER = 'src/shared/readLocal';
const LOCAL_READER_PATH = `${LOCAL_READER}.ts`;
const LOCAL_READER_ALLOWED = /^src\/unlock\//;
// Modules that may import nothing (B1b-2a review M4; a type-only import is erased and allowed, as it
// always was for readLocal): the vault page's storage
// reader, and the two pure modules the vault page shares — amounts and its fixed strings. The vault
// page may reach all of src/shared/, so a shared file importing UI code would carry it in through an
// allowed door; a stand-alone module cannot.
export const STANDALONE = [LOCAL_READER_PATH, 'src/shared/amount.ts', 'src/unlock/strings.ts'];
// A storage write in any spelling: a call (`.set(`), a bracket (`['set']`), a destructured name.
const WRITES_STORAGE = /(?:\?\.|\.)\s*(?:set|remove|clear)\s*\(|\[\s*['"`](?:set|remove|clear)['"`]\s*\]|[{,]\s*(?:set|remove|clear)\s*[,}:=]/;
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
// B1b-2a E4 adds the two caches: a popup writing one could show a balance the chain never had.
export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache'];
const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
// The vault page renders only fixed strings and the user's own words, as text (B1b-2a §1.2 item 3):
// no file in src/unlock may parse or write markup, so nothing it shows can become an element.
// Every sink by name (a `.write(`/`.writeln(` call on anything: `document` can be aliased).
export const SETS_MARKUP =
  /\b(?:innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|srcdoc|setHTMLUnsafe|setHTML|parseHTMLUnsafe|execCommand)\b|\bdocument\s*\.\s*write(?:ln)?\b|\.\s*write(?:ln)?\s*\(/;
// A name need not be spelled (Task 5 review I2): src/unlock may not reach a property by a computed
// name at all — conservative on purpose, since a static check cannot tell `el[k] = s` from an array
// write. A bracket holding one plain quoted name (`x['href']`) is not computed (a sink's name there
// trips SETS_MARKUP); a declaration's destructuring (`const [a, b] =`) and a tuple type (`: [A, B] =`)
// are not member writes. The built chunks the vault page loads are checked too (BUILT_MARKUP).
const COMPUTED_MEMBER = String.raw`(?<!\b(?:const|let|var)\s*|:\s*)\[(?!\s*(['"])[\w$-]*\1\s*\])(?!\s*\])[^\]]+\][\]\s]*`;
export const MARKUP_EVASIONS = [
  [new RegExp(`${COMPUTED_MEMBER}(?:\\*\\*|<<|>>>?|&&|\\|\\||\\?\\?|[-+*/%&|^])?=(?![=>])`), 'writes a computed property'],
  [new RegExp(`${COMPUTED_MEMBER}(?:\\?\\.\\s*)?\\(`), 'calls a computed property'],
  // `el.inner\u0048TML = s`: an escaped identifier spells a sink no name pattern sees. A string can
  // use the character itself.
  [/\\u/, 'uses a \\u escape'],
  [/\bReflect\b|\bObject\s*\.\s*(?:assign|defineProperty|defineProperties|getOwnPropertyDescriptors?|setPrototypeOf)\b/, 'sets properties reflectively'],
  [/\bdocument\s*(?:\?\.\s*)?\[/, 'indexes document'],
  [/\bsetAttribute(?:NS)?\s*\(\s*(?!(['"])[\w:-]+\1\s*,)/, 'sets an attribute named by a computed value'],
  [/data:\s*text\/html/i, 'names a data:text/html URL'],
];

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
// React 18's internal export name, present only in react / react-dom 18 (React 19 renamed it). The
// vault page is plain DOM (spec B1b-2a S1): no file it loads may carry React. The marker must also be
// present in SOME built file (the popup's), or a React upgrade would make the rule pass trivially —
// that INCONCLUSIVE is what an upgrade trips, and the fix is to update this marker.
export const REACT_MARKER = '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED';
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

/**
 * Where a specifier points, as a path relative to the package (`src/vault/kdf`), or null. A query or
 * hash (`../vault/x?v`, `./y#z`) is dropped first: the bundler loads the same file with it.
 */
function resolveSource(fromPath, spec) {
  if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
    return posix.normalize(posix.join(posix.dirname(fromPath), spec.replace(/[?#].*$/, '')));
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

function namesLocalReader(fromPath, spec) {
  const target = resolveSource(fromPath, spec);
  return target !== null && target.replace(/\.[cm]?[jt]s$/, '') === LOCAL_READER;
}

function namesUiCode(fromPath, spec) {
  const target = resolveSource(fromPath, spec);
  return target !== null && (target === 'src/app' || target.startsWith('src/app/') || target.startsWith('../web/'));
}

// ── The vault page's import allowlist (B1b-2a §1.2) ─────────────────────────────────────────────
// Every file reachable from the vault page's entry, following relative imports (into ../core and
// ../web too), must be vault-page code or a stylesheet; every package it imports must be one of the
// five the vault needs. So src/app/**, react, react-dom and ../web/src/ui/** can never reach the page
// that holds the seed. Type-only imports are erased and not followed.
export const VAULT_PAGE_ENTRY = 'src/unlock/main.ts';
const VAULT_PAGE_FILES = [
  /^src\/unlock\//,
  /^src\/vault\//,
  /^src\/shared\//,
  /^src\/ui\/send\.ts$/,
  /^src\/styles\/[^/]+\.css$/,
  /^\.\.\/web\/src\/styles\/design-system\.css$/,
  /^\.\.\/core\/keys\//,
  /^\.\.\/core\/util\//,
];
export const VAULT_PAGE_PACKAGES = ['@noble/curves', '@noble/hashes', '@scure/base', '@scure/bip39', 'micro-key-producer'];
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx'];
const MODULE_SPECIFIER = /^[\w@.\/-]+$/;
// The loose reference patterns also match prose (`mode === 'import' || …`, 'Continue to import'): a
// "specifier" with whitespace in it is prose. Anything else is a reference — and one that is not a
// plain module specifier (a query `../app/x?v`, a hash or subpath import `#app`, a scheme
// `virtual:app`, an empty computed prefix) is refused, never skipped (Task 5 review I1: Vite bundled
// `../app/engine?v` into the vault page with every gate green).
const PROSE = /\s/;
// A specifier-shaped token that carries a backslash (checked before the prose filter below, which
// would otherwise skip it): no bundler treats `\` as a separator the same way on every platform.
const BACKSLASH_SPECIFIER = /^[\w@.\/\\-]*\\[\w@.\/\\-]*$/;
const packageOf = spec => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
// `@scure/base/../../../app/leak` has an allowed package name but names a file outside it.
const packageSubpathEscapes = spec => spec.split('/').slice(spec.startsWith('@') ? 2 : 1).some(s => s === '.' || s === '..');

/** `read(path)` → text or undefined; `exists(path)` → boolean. Paths package-relative, / separators. */
export function vaultPageViolations(read, exists, entry = VAULT_PAGE_ENTRY) {
  const out = [];
  const seen = new Set();
  const stack = [entry];
  if (read(entry) === undefined) return [`INCONCLUSIVE: the vault page entry ${entry} does not exist`];
  while (stack.length > 0) {
    const path = stack.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    if (!VAULT_PAGE_FILES.some(re => re.test(path))) out.push(`the vault page reaches ${path} — only vault-page code may be bundled with the seed`);
    if (!SOURCE_EXT.test(path)) continue; // a stylesheet carries no code and imports nothing we follow
    const text = read(path) ?? '';
    for (const ref of moduleReferences(text)) {
      // Prose (whitespace) is skipped; every other reference that is not a plain module specifier is
      // refused (PROSE above). A specifier computed past its first literal part is out of any static
      // reach (the bundle checks are the backstop); its empty or partial prefix is refused here.
      if (ref.typeOnly || PROSE.test(ref.spec)) continue;
      if (BACKSLASH_SPECIFIER.test(ref.spec)) {
        out.push(`${path}: the vault page imports ${ref.spec} — a specifier may not contain a backslash`);
        continue;
      }
      if (!MODULE_SPECIFIER.test(ref.spec)) {
        out.push(`${path}: the vault page imports '${ref.spec}' — a query, hash, scheme or computed specifier is refused, never skipped`);
        continue;
      }
      const target = resolveSource(path, ref.spec);
      if (target === null) {
        if (!VAULT_PAGE_PACKAGES.includes(packageOf(ref.spec))) out.push(`${path}: the vault page imports the package ${ref.spec}`);
        else if (packageSubpathEscapes(ref.spec)) out.push(`${path}: the vault page imports ${ref.spec} — a package path may not contain a . or .. segment`);
        continue;
      }
      const file = RESOLVE_EXTENSIONS.map(e => target + e).find(exists);
      if (file === undefined) out.push(`${path} imports ${ref.spec}, which does not resolve to a file`);
      else stack.push(file);
    }
  }
  return out;
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
    // Prose a loose pattern matched ('Continue to import', in the vault page's own strings) has
    // whitespace and is not an import; every other reference is one, whatever it carries (`?v`, `#x`,
    // `virtual:`) — the vault-page walk filters the same way (PROSE).
    if (STANDALONE.includes(path) && values.some(r => !PROSE.test(r.spec))) out.push(`${path}: imports a module — it must stand alone`);
    // src/shared/ is reachable from the vault page: it may never reach UI code (B1b-2a M4).
    // Deliberately all references, type-only ones too — stricter than the stand-alone rule above.
    if (/^src\/shared\//.test(path) && moduleReferences(text).some(r => namesUiCode(path, r.spec))) out.push(`${path}: imports UI code (src/app, ../web) — src/shared is vault-page reachable`);
    if (path === LOCAL_READER_PATH) {
      if (TOUCHES_SESSION.test(text)) out.push(`${path}: touches storage.session — it may read storage.local only`);
      if (WRITES_STORAGE.test(text)) out.push(`${path}: writes storage — it may only read`);
    } else if (!SESSION_ALLOWED.test(path) && (TOUCHES_SESSION.test(text) || TOUCHES_STORAGE.test(text))) {
      out.push(`${path}: touches storage outside src/ext.ts and the background`);
    }
    if (!LOCAL_READER_ALLOWED.test(path) && values.some(r => namesLocalReader(path, r.spec))) {
      out.push(`${path}: imports ${LOCAL_READER}, the vault page's storage reader`);
    }
    if (!LISTEN_ALLOWED.test(path) && LISTENS_RUNTIME.test(text)) out.push(`${path}: listens for runtime messages outside the background`);
    if (UNLOCK_ALLOWED.test(path)) {
      if (SETS_MARKUP.test(text)) out.push(`${path}: writes markup — the vault page sets text only (textContent)`);
      for (const [re, what] of MARKUP_EVASIONS) if (re.test(text)) out.push(`${path}: ${what} — the vault page sets text only (textContent)`);
    }
    if (!BACKGROUND_OWNED_ALLOWED.test(path)) {
      for (const key of BACKGROUND_OWNED_KEYS) if (text.includes(key)) out.push(`${path}: names ${key}, which only the background may write`);
    }
    if (!EXT_IMPORT_ALLOWED.test(path) && path !== 'src/ext.ts' && values.some(r => namesExt(path, r.spec))) {
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
// storage.session in a built file: the property (minified `r.storage.session`), a bracketed key,
// or ext.ts's access pin.
const BUILT_SESSION = /storage\s*(?:\?\.|\.)\s*session\b|storage\s*\[\s*['"`]session['"`]\s*\]|\bsetAccessLevel\b/;
// A markup sink in a built chunk the vault page loads (Task 5 review I2): the backstop for every
// source spelling the source rule cannot see — a minifier folds `'inner' + 'HTML'` back into the name.
// A legitimate dependency naming one must be reported and decided, never allow-listed here silently.
export const BUILT_MARKUP =
  /\b(?:innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|setHTMLUnsafe|setHTML|parseHTMLUnsafe|srcdoc|execCommand)\b|\.\s*write(?:ln)?\s*\(|\[\s*["'`]write(?:ln)?["'`]\s*\]/;
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

  if (!js.some(p => readFileSync(join(distApp, p), 'utf8').includes(REACT_MARKER))) {
    out.push(`INCONCLUSIVE: the React marker "${REACT_MARKER}" is in no built JS file — React 19 renamed it: update REACT_MARKER, or the no-React-in-the-vault-page rule passes trivially`);
  }

  // The other direction: the vault page may not load the background entry. Importing background.js
  // runs it — its runtime listeners and its poller — inside the vault page (a Rolldown runtime helper
  // placed in background.js once made the unlock bundle import it, and every marker check passed).
  if (all.includes('unlock.html')) {
    const html = readFileSync(join(distApp, 'unlock.html'), 'utf8');
    for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g)) {
      const r = resolveBuilt(distApp, 'unlock.html', m[1]);
      if (r.problem) problems.add(r.problem);
      else {
        const files = reachable(distApp, r.target, problems);
        if (files.includes('background.js')) out.push(`the vault page (${r.target}) reaches background.js — it would run the background`);
        for (const file of files) {
          if (!/\.m?js$/.test(file)) continue;
          const text = readFileSync(join(distApp, file), 'utf8');
          if (text.includes(REACT_MARKER)) out.push(`${file} (reachable from unlock.html) contains React — the vault page must stay plain DOM`);
          const sink = BUILT_MARKUP.exec(text);
          if (sink) out.push(`${file} (reachable from unlock.html) names a markup sink (${sink[0]}) — the vault page sets text only`);
        }
      }
    }
  }

  // No page may reach storage.session: in the built files, not just the sources (final review
  // minor 4 — readLocal in ext.ts put ext.ts's storage.session and setAccessLevel into a chunk the
  // vault page loaded, and every source rule passed). Only the background may carry it.
  if (!js.some(p => BUILT_SESSION.test(readFileSync(join(distApp, p), 'utf8')))) {
    out.push('INCONCLUSIVE: no built JS file names storage.session — the vault-page rule would pass trivially');
  }
  for (const page of all.filter(p => /\.html?$/.test(p))) {
    const html = readFileSync(join(distApp, page), 'utf8');
    for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g)) {
      const r = resolveBuilt(distApp, page, m[1]);
      if (r.problem) {
        problems.add(r.problem);
        continue;
      }
      for (const file of reachable(distApp, r.target, problems)) {
        if (/\.m?js$/.test(file) && BUILT_SESSION.test(readFileSync(join(distApp, file), 'utf8'))) {
          out.push(`${file} (reachable from ${page}) touches storage.session — only the background may`);
        }
      }
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
  const readRel = rel => {
    const abs = join(ROOT, rel);
    return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : undefined;
  };
  const problems = [...sourceViolations(files), ...htmlViolations(pages), ...vaultPageViolations(readRel, rel => readRel(rel) !== undefined)];
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
  console.log('vault isolation ok: sources, built popup/background and both manifests carry no path to the vault; no page reaches storage.session');
}
