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
// Limits, deliberate: module references are read with the TypeScript parser (comments and strings
// are not code); a computed specifier (`import('../' + 'vault/x')`) is out of reach of any static check
// and is refused in the vault page's own walk. The bundle markers and the vault page's chunk module map
// (dist/app.modules.json, vaultPageModuleViolations) are the backstop. For CSS on the vault page the
// boundary is the browser's (the extension CSP: style-src, img-src and font-src 'self', fix round 4); the
// CSS rules here — the sheets read by scripts/css-scan.mjs, the page's HTML parsed, the code's runtime
// CSS refused — are the backstop that names an escape before a reviewer has to find it.
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, posix, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {isStylesheet, scanCss} from './css-scan.mjs';

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
  // Reflection by any access — dot, bracket string or destructuring key (`Object['defineProperty']`,
  // `const {defineProperty: dp} = Object`, `el.__lookupSetter__('…')`): the names themselves are refused.
  [/\b(?:Reflect|assign|defineProperty|defineProperties|getOwnPropertyDescriptors?|setPrototypeOf|__proto__|__lookupSetter__|__defineSetter__|__lookupGetter__|__defineGetter__)\b/, 'sets properties reflectively'],
  [/\bdocument\s*(?:\?\.\s*)?\[/, 'indexes document'],
  [/\bsetAttribute(?:NS)?\s*\(\s*(?!(['"])[\w:-]+\1\s*,)/, 'sets an attribute named by a computed value'],
  // An HTML document by another door (fix round 2): a Blob or a data: URL typed text/html, parsed by an
  // XHR with responseType 'document' or shown through an object URL. Every responseType and object URL
  // is refused; text/html is refused in any spelling the parser can fold (htmlTyped below).
  [/data:\s*text\/html/i, 'names a data:text/html URL'],
  [/\bresponseType\b/, 'sets an XHR responseType'],
  [/\bcreateObjectURL\b/, 'creates an object URL'],
];

// No CSS is built at run time in src/unlock (fix round 4): a stylesheet on the password page is an
// exfiltration surface (an attribute selector on an input's value plus a url()). The CSP refuses an inline
// <style> and a remote sheet in the browser; these rules are the backstop, and the built chunks the vault
// page loads are checked too (BUILT_STYLE). A sheet object cannot be reached at all (`.sheet`,
// `styleSheets`, `CSSStyleSheet`), so neither can its `replace()`.
const CSS_ONLY = 'the vault page is styled by its three named sheets only';
export const RUNTIME_CSS = [
  [/\b(?:createElementNS\s*\(\s*[^,()]*,\s*|createElement\s*\(\s*|h\s*\(\s*)(['"`])(?:style|link)\1/i, 'creates a <style> or <link> element'],
  [/\b(?:CSSStyleSheet|CSSRule|adoptedStyleSheets|styleSheets|insertRule|replaceSync)\b|\.\s*sheet\b/, 'builds a stylesheet at run time'],
  [/\bsetAttribute(?:NS)?\s*\(\s*(?:[^,()]*,\s*)?(['"`])style\1/i, 'sets a style attribute'],
  [/\b(?:cssText|attributeStyleMap|setProperty)\b/, 'writes CSS declarations'],
  // An element's inline style, by any access (`.style`, `?.style`, `['style']`, a destructuring key). A
  // CSSOM write is allowed by the CSP, so only this rule keeps it out; the vault page toggles classes.
  [/(?:\?\.|\.)\s*style\b|\[\s*(['"`])style\1\s*\]|[{,]\s*style\s*[,}:=]/, 'reaches an element’s inline style'],
];

/**
 * The one CSSOM write the vault page may make (controller ruling, 2026-10-01 — the design's conic-gradient
 * cooldown ring): exactly `<expr>.style.setProperty('--vlt-<name>', <value>)`, the name a literal matching
 * VLT_PROPERTY, two arguments, and the value made from a number inside this module:
 * - a template literal whose literal pieces are only letters or `%` (`${n}deg`, `${pct}%` — so no `url(`,
 *   `var(` or quote) and whose every `${…}` is numeric;
 * - `String(<numeric>)`;
 * - a call of a function declared in this module with one parameter typed `number` whose body is one
 *   `return` of one of the two forms above (its parameter counts as numeric).
 * Numeric: a number literal; `Math.<fn>(…)` or `Number(…)` (always a number); `- * / % **` (and `+` of two
 * numerics); unary `-`/`+`; a conditional with numeric branches; a parameter typed `number`; a const whose
 * initializer is numeric. Anything else — a parameter typed string, an untyped one, an import, a string
 * literal — is not, and the write stays refused by RUNTIME_CSS. Returns the source ranges of the allowed
 * `.style.setProperty('--vlt-…'` texts, which the RUNTIME_CSS check blanks out; nothing else is excused.
 */
const VLT_PROPERTY = /^--vlt-[a-z-]+$/;
const UNIT_TEXT = /^[a-z%]*$/i;
function allowedVltWrites(text, path) {
  const sf = parse(text, path);
  const ranges = [];
  const isLiteral = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const declarations = name => {
    const found = [];
    const visit = node => {
      if ((ts.isParameter(node) || ts.isVariableDeclaration(node)) && ts.isIdentifier(node.name) && node.name.text === name) found.push(node);
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
  };
  const numeric = (node, depth = 0) => {
    if (depth > 8) return false;
    if (ts.isParenthesizedExpression(node)) return numeric(node.expression, depth + 1);
    if (ts.isNumericLiteral(node)) return true;
    if (ts.isCallExpression(node)) {
      const c = node.expression;
      if (ts.isIdentifier(c) && c.text === 'Number') return true;
      return ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'Math';
    }
    if (ts.isPrefixUnaryExpression(node)) return (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) && numeric(node.operand, depth + 1);
    if (ts.isConditionalExpression(node)) return numeric(node.whenTrue, depth + 1) && numeric(node.whenFalse, depth + 1);
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.PlusToken) return numeric(node.left, depth + 1) && numeric(node.right, depth + 1);
      return [ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken, ts.SyntaxKind.AsteriskAsteriskToken].includes(op);
    }
    if (ts.isIdentifier(node)) {
      const decls = declarations(node.text);
      return decls.length > 0 && decls.every(d => {
        if (ts.isParameter(d)) return d.type !== undefined && d.type.kind === ts.SyntaxKind.NumberKeyword;
        const list = d.parent;
        return ts.isVariableDeclarationList(list) && (list.flags & ts.NodeFlags.Const) !== 0 && d.initializer !== undefined && numeric(d.initializer, depth + 1);
      });
    }
    return false;
  };
  const formatted = node => {
    if (ts.isParenthesizedExpression(node)) return formatted(node.expression);
    if (ts.isTemplateExpression(node)) {
      return UNIT_TEXT.test(node.head.text) && node.templateSpans.every(sp => UNIT_TEXT.test(sp.literal.text) && numeric(sp.expression));
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'String') {
      return node.arguments.length === 1 && numeric(node.arguments[0]);
    }
    return false;
  };
  const formatter = name => {
    const fns = sf.statements.filter(st => ts.isFunctionDeclaration(st) && st.name?.text === name);
    if (fns.length !== 1) return false;
    const fn = fns[0];
    const [param] = fn.parameters;
    if (fn.parameters.length !== 1 || !ts.isIdentifier(param.name) || param.type?.kind !== ts.SyntaxKind.NumberKeyword) return false;
    const body = fn.body?.statements ?? [];
    return body.length === 1 && ts.isReturnStatement(body[0]) && body[0].expression !== undefined && formatted(body[0].expression);
  };
  const value = node => formatted(node) || (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length === 1 && formatter(node.expression.text));
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'setProperty') {
      const style = node.expression.expression;
      const [name, val] = node.arguments;
      if (ts.isPropertyAccessExpression(style) && style.name.text === 'style' && node.arguments.length === 2 && isLiteral(name) && VLT_PROPERTY.test(name.text) && value(val)) {
        ranges.push([style.name.getStart(sf) - 1, name.getEnd()]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return ranges;
}

/** The text with the allowed `--vlt-` writes' `.style.setProperty('--vlt-…'` blanked to spaces. */
function withoutVltWrites(text, path) {
  let out = text;
  for (const [from, to] of allowedVltWrites(text, path)) out = out.slice(0, from) + ' '.repeat(to - from) + out.slice(to);
  return out;
}

/**
 * Does the module create an element whose tag is not one plain string (fix round 4)? A computed tag can
 * be 'style'. The one exception is structural, not a file allowance: the DOM helper `h` in
 * src/unlock/view/dom.ts passes its own first parameter to createElement — and every call of `h` must
 * name its tag (a computed tag in an `h(…)` call is refused here, a literal 'style'/'link' by RUNTIME_CSS).
 */
function computedTag(text, path) {
  let found = false;
  const ownTag = (call, arg) => {
    if (path !== 'src/unlock/view/dom.ts' || !ts.isIdentifier(arg)) return false;
    let fn = call.parent;
    while (fn !== undefined && !ts.isFunctionLike(fn)) fn = fn.parent;
    if (fn === undefined || !ts.isFunctionDeclaration(fn) || fn.name?.text !== 'h') return false;
    const first = fn.parameters[0];
    return first !== undefined && ts.isIdentifier(first.name) && first.name.text === arg.text;
  };
  const visit = node => {
    if (found) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
      const at = name === 'createElementNS' ? 1 : name === 'createElement' || name === 'h' ? 0 : -1;
      if (at >= 0) {
        const arg = node.arguments[at];
        const literal = arg !== undefined && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg));
        if (!literal && !(name === 'createElement' && ownTag(node, arg))) found = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(text, path));
  return found;
}

const TEXT_HTML = /text\s*\/\s*html/i;
/**
 * Does the module name the text/html type — in a comment or string as written, or assembled from string
 * pieces (`'text/ht' + 'ml'`, `` `text/${x}html` ``)? Every `+` chain and template is read with its
 * literal pieces joined (what is not a literal is left out: fail-closed).
 */
function htmlTyped(text, path) {
  if (TEXT_HTML.test(text)) return true;
  const pieces = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map(sp => pieces(sp.expression) + sp.literal.text).join('');
    if (ts.isParenthesizedExpression(node)) return pieces(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return pieces(node.left) + pieces(node.right);
    return '';
  };
  let found = false;
  const visit = node => {
    if (found) return;
    if ((ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) || ts.isTemplateExpression(node)) found = TEXT_HTML.test(pieces(node));
    ts.forEachChild(node, visit);
  };
  visit(parse(text, path));
  return found;
}

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

// Module references are found with the TypeScript parser, not with patterns (Task 5 review, fix round
// 2): a comment between tokens (`import(/*x*/'../app/engine')`, `import {e} /*c*/ from …`) hid an import
// from every regex this gate used to have, and Vite bundled it. The parser sees what the bundler sees:
// static imports and re-exports, `import x = require()`, dynamic `import()`, `require()`, and a worker or
// asset `new URL('x', import.meta.url)` (`import('x').T` in a type is recorded as type-only). A specifier
// that is not one plain string — a template with `${…}`, a concatenation, a variable — is recorded as
// '' (computed). Comments and strings are never read as code.
const SCRIPT_KIND = {'.tsx': ts.ScriptKind.TSX, '.jsx': ts.ScriptKind.JSX, '.js': ts.ScriptKind.JS, '.mjs': ts.ScriptKind.JS, '.cjs': ts.ScriptKind.JS};

function parse(text, path) {
  const ext = /\.[cm]?[jt]sx?$/.exec(path)?.[0] ?? '.ts';
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, SCRIPT_KIND[ext] ?? ts.ScriptKind.TS);
}

const literalText = node =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : '';
const isImportMeta = node => node !== undefined && ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword;
const isImportMetaUrl = node => node !== undefined && ts.isPropertyAccessExpression(node) && isImportMeta(node.expression) && node.name.text === 'url';

/**
 * Every module a source file names, with whether that reference is type-only (erased). `bundled` is
 * false only for a `new URL('x')` without `import.meta.url` (a runtime URL, which no bundler follows).
 */
function moduleReferences(text, path = 'x.ts') {
  const refs = [];
  const visit = node => {
    if (ts.isImportDeclaration(node)) {
      refs.push({spec: literalText(node.moduleSpecifier), typeOnly: node.importClause?.isTypeOnly === true, bundled: true});
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      refs.push({spec: literalText(node.moduleSpecifier), typeOnly: node.isTypeOnly, bundled: true});
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      refs.push({spec: literalText(node.moduleReference.expression), typeOnly: node.isTypeOnly, bundled: true});
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      refs.push({spec: ts.isLiteralTypeNode(arg) ? literalText(arg.literal) : '', typeOnly: true, bundled: true});
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      refs.push({spec: literalText(node.arguments[0]), typeOnly: false, bundled: true});
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && (node.arguments?.length ?? 0) > 0) {
      const [first, second] = node.arguments ?? [];
      const withMeta = isImportMetaUrl(second);
      if (withMeta || literalText(first) !== '') refs.push({spec: literalText(first), typeOnly: false, bundled: withMeta});
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(text, path));
  return refs;
}

/**
 * Every `import.meta` use other than `import.meta.url` (fix round 2): `import.meta.glob('../app/x.ts')`
 * makes Vite bundle the files it names with no import statement at all. The vault page may name
 * import.meta.url only (its worker's URL).
 */
function importMetaMisuses(text, path) {
  const out = [];
  const visit = node => {
    if (isImportMeta(node) && !isImportMetaUrl(node.parent)) out.push(node.parent.getText().slice(0, 40));
    ts.forEachChild(node, visit);
  };
  visit(parse(text, path));
  return out;
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
  /^\.\.\/core\/keys\//,
  /^\.\.\/core\/util\//,
];
// The vault page's stylesheets, by name (fix round 3, N1): a stylesheet on the password page is an
// exfiltration surface (an attribute selector with a url() reads the field), so no folder admits one —
// not src/styles/, not src/unlock/. These three, and only these, may reach the page.
export const VAULT_PAGE_SHEETS = ['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/unlock/unlock.css'];
// Every url() a vault-page sheet may contain, exactly: the two bundled Geist faces, in design-system.css
// (where they resolve is pinned by the font gate, scripts/check-fonts.mjs). Any other url(), any
// @import, any other function that loads a URL (image-set(), image(), cross-fade(), src()) and any
// backslash escape (`\\75rl(` spells url) is refused.
export const VAULT_PAGE_CSS_URLS = {'../web/src/styles/design-system.css': ['/fonts/Geist-Variable.woff2', '/fonts/GeistMono-Variable.woff2']};
// Every CSS language Vite compiles is a stylesheet (fix round 4: `src/unlock/zz.pcss` with an @import
// of app.css was neither walked as a sheet nor named in the map, and Vite inlined app.css into the vault
// page's CSS); any sheet that is not one of the three named .css files is refused outright.
const isSheet = isStylesheet;
const vaultPageFileAllowed = path => (isSheet(path) ? VAULT_PAGE_SHEETS.includes(path) : VAULT_PAGE_FILES.some(re => re.test(path)));

/** What a vault-page stylesheet may not contain, from its source (read by scripts/css-scan.mjs). */
function sheetViolations(path, text) {
  const out = [];
  const css = scanCss(text);
  const allowed = VAULT_PAGE_CSS_URLS[path] ?? [];
  if (css.imports.length > 0) out.push(`${path}: the vault page's stylesheet uses @import — every sheet it loads is named in VAULT_PAGE_SHEETS`);
  for (const url of css.urls) {
    if (!allowed.includes(url)) out.push(`${path}: the vault page's stylesheet loads url(${url}) — only the bundled Geist faces may be loaded`);
  }
  for (const fn of css.loaders) out.push(`${path}: the vault page's stylesheet uses ${fn}() — it loads URLs without url()`);
  if (css.escapes) out.push(`${path}: the vault page's stylesheet uses a backslash escape — an escape can spell url( or @import`);
  return out;
}
export const VAULT_PAGE_PACKAGES = ['@noble/curves', '@noble/hashes', '@scure/base', '@scure/bip39', 'micro-key-producer'];
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx'];
const MODULE_SPECIFIER = /^[\w@.\/-]+$/;
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
    if (!vaultPageFileAllowed(path)) out.push(`the vault page reaches ${path} — only vault-page code may be bundled with the seed`);
    if (isSheet(path)) {
      // A stylesheet may import nothing and load only the fonts (fix round 3): @import is refused, so
      // there is nothing in it to follow. A sheet in another CSS language is refused outright (round 4).
      const lang = /\.([^./]+)$/.exec(path)?.[1] ?? '';
      if (lang.toLowerCase() !== 'css') out.push(`${path}: a .${lang} stylesheet — only the three named .css sheets may reach the vault page, never another CSS language Vite compiles`);
      out.push(...sheetViolations(path, read(path) ?? ''));
      continue;
    }
    if (!SOURCE_EXT.test(path)) continue;
    const text = read(path) ?? '';
    for (const use of importMetaMisuses(text, path)) out.push(`${path}: the vault page uses ${use} — only import.meta.url is allowed (import.meta.glob bundles files without an import)`);
    for (const ref of moduleReferences(text, path)) {
      // Every reference that is not one plain module specifier is refused, never skipped (Task 5 review
      // I1: Vite bundled `../app/engine?v` into the vault page with every gate green): a query, a hash or
      // subpath import (`#app`), a scheme (`virtual:app`), a computed specifier (''). The built-chunk
      // module map (vaultPageModuleViolations) is the authoritative backstop.
      if (ref.typeOnly || !ref.bundled) continue;
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
    const refs = moduleReferences(text, path);
    const values = refs.filter(r => !r.typeOnly);
    if (!VAULT_ALLOWED.test(path) && values.some(r => namesVault(path, r.spec))) out.push(`${path}: imports the vault`);
    if (!VAULT_ALLOWED.test(path) && values.some(r => namesCoreKeys(path, r.spec))) out.push(`${path}: imports core/keys (seed code)`);
    if (!UNLOCK_ALLOWED.test(path) && values.some(r => namesUnlock(path, r.spec))) out.push(`${path}: imports the vault page (src/unlock)`);
    // Any value reference, whatever it carries (`?v`, `#x`, `virtual:`, computed); prose in a string is
    // not code to the parser ('Continue to import').
    if (STANDALONE.includes(path) && values.length > 0) out.push(`${path}: imports a module — it must stand alone`);
    // src/shared/ is reachable from the vault page: it may never reach UI code (B1b-2a M4).
    // Deliberately all references, type-only ones too — stricter than the stand-alone rule above.
    if (/^src\/shared\//.test(path) && refs.some(r => namesUiCode(path, r.spec))) out.push(`${path}: imports UI code (src/app, ../web) — src/shared is vault-page reachable`);
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
      if (htmlTyped(text, path)) out.push(`${path}: names the text/html type — the vault page sets text only (textContent)`);
      const cssText = withoutVltWrites(text, path);
      for (const [re, what] of RUNTIME_CSS) if (re.test(cssText)) out.push(`${path}: ${what} — ${CSS_ONLY}`);
      if (computedTag(text, path)) out.push(`${path}: creates an element by a computed tag — ${CSS_ONLY}`);
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
 * The start tags of an HTML document, read as the HTML tokenizer reads them (fix round 4): the tag name
 * and the attribute names lower-cased, a value quoted ('…', "…") or unquoted, an attribute straight after
 * a quoted value (`title="a"style="…"`) read as the next attribute. Comments are skipped. A tag inside a
 * raw-text element (`<title><style>`) is still reported: fail-closed.
 * @returns {{name: string, attrs: Map<string, string>}[]}
 */
export function htmlTags(html) {
  const tags = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    const open = /^<([a-zA-Z][^\s/>]*)/.exec(html.slice(lt, lt + 256));
    if (open === null) {
      i = lt + 1;
      continue;
    }
    const attrs = new Map();
    let j = lt + open[0].length;
    while (j < n) {
      while (j < n && /[\s/]/.test(html[j])) j += 1;
      if (j >= n || html[j] === '>') {
        j += 1;
        break;
      }
      let k = j + 1;
      while (k < n && !/[\s/>=]/.test(html[k])) k += 1;
      const name = html.slice(j, k).toLowerCase();
      j = k;
      while (j < n && /\s/.test(html[j])) j += 1;
      let value = '';
      if (html[j] === '=') {
        j += 1;
        while (j < n && /\s/.test(html[j])) j += 1;
        if (html[j] === '"' || html[j] === "'") {
          const end = html.indexOf(html[j], j + 1);
          value = html.slice(j + 1, end < 0 ? n : end);
          j = end < 0 ? n : end + 1;
        } else {
          let e = j;
          while (e < n && !/[\s>]/.test(html[e])) e += 1;
          value = html.slice(j, e);
          j = e;
        }
      }
      if (!attrs.has(name)) attrs.set(name, value);
    }
    tags.push({name: open[1].toLowerCase(), attrs});
    i = j;
  }
  return tags;
}

/** CSS in the vault page's HTML: a <style> element or a style attribute anywhere (fix round 4). */
function inlineCss(path, html, why) {
  const out = [];
  for (const tag of htmlTags(html)) {
    if (tag.name === 'style') out.push(`${path}: has a <style> element — ${why}`);
    if (tag.attrs.has('style')) out.push(`${path}: <${tag.name}> has a style attribute — ${why}`);
  }
  return out;
}

/**
 * Every `<script>` in the root HTML pages must be `src=` its own page's entry (ENTRIES). A page
 * with no entry of its own may load nothing; an inline script (Vite bundles an inline module
 * too) or a src it cannot read fails closed.
 *
 * The vault page's source (unlock.html) carries no CSS at all (fix round 4): no <style>, no style
 * attribute, no <link> — the build adds its stylesheets.
 */
export function htmlViolations(pages) {
  const out = [];
  for (const {path, text} of pages) {
    if (path === 'unlock.html') {
      out.push(...inlineCss(path, text, CSS_ONLY));
      if (htmlTags(text).some(t => t.name === 'link')) out.push('unlock.html: has a <link> — the build adds the vault page’s stylesheets; its source links nothing');
    }
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
  /\b(?:innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|setHTMLUnsafe|setHTML|parseHTMLUnsafe|srcdoc|execCommand|responseType|createObjectURL)\b|\.\s*write(?:ln)?\s*\(|\[\s*["'`]write(?:ln)?["'`]\s*\]|[tT][eE][xX][tT]\/[hH][tT][mM][lL]/;
// Reflection in a built chunk. A legitimate dependency the vault page loads uses it: @noble/curves
// (abstract/modular.js, the Field constructor) calls `Object.defineProperty(this, 'sqrt', {value: …})`,
// which lands in a chunk unlock.html reaches. So what is refused is reflection that could reach a sink
// unnamed: a property name that is not one plain string literal, a reflective function taken as a value
// (`const d = Object.defineProperty`), and the plural forms. A literal name that is a sink trips
// BUILT_MARKUP by name.
export const BUILT_REFLECTION =
  /\b(?:defineProperty|getOwnPropertyDescriptor)\b(?!\s*\(\s*[\w$.]+\s*,\s*(["'`])[\w$]+\1\s*[,)])|\b(?:__lookupSetter__|__defineSetter__|__lookupGetter__|__defineGetter__)\b(?!\s*\(\s*(["'`])[\w$]+\2\s*[,)])|\b(?:defineProperties|getOwnPropertyDescriptors)\b/;
// CSS built at run time in a chunk the vault page loads (fix round 4): a <style> or <link> element, a
// constructed or adopted sheet, an inserted rule, a style attribute, declaration text, an element's inline
// style (`.style`, `["style"]`, `setProperty`). A computed
// createElement is the h() helper's (dom.ts) and is not refused here; the source rule checks its callers.
export const BUILT_STYLE =
  /createElement(?:NS)?\(\s*(?:[^,()]*,\s*)?(["'`])(?:style|link)\1|\b(?:CSSStyleSheet|CSSRule|adoptedStyleSheets|styleSheets|insertRule|replaceSync|cssText|attributeStyleMap)\b|setAttribute(?:NS)?\(\s*(?:[^,()]*,\s*)?(["'`])style\2|\.style\b|\[\s*(["'`])style\3\s*\]|\bsetProperty\b/i;
const BUILT_VLT_WRITE = /\.style\.setProperty\((["'`])--vlt-[a-z-]+\1,/g;
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
          // The one shape the ruling allows (the cooldown ring): `.style.setProperty("--vlt-…",` — blanked
          // before the check, so any other style write in the same chunk is still seen.
          const css = BUILT_STYLE.exec(text.replace(BUILT_VLT_WRITE, ' '));
          if (css) out.push(`${file} (reachable from unlock.html) builds CSS at run time (${css[0]}) — the vault page is styled by its built stylesheets only`);
          const reflect = BUILT_REFLECTION.exec(text);
          if (reflect) out.push(`${file} (reachable from unlock.html) uses reflection by a computed name (${reflect[0]}) — the vault page sets text only`);
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

// ── What the bundler put in the vault page (fix round 2, the authoritative backstop) ──────────────
// vite.config.ts's chunkModules plugin writes dist/app.modules.json: for every built chunk (the KDF
// worker's too), the source modules it carries, package-relative. However a module got in — a comment
// inside an import, import.meta.glob, a query — it is listed here. Every module of every chunk the vault
// page loads must be vault-page code (VAULT_PAGE_FILES), the page itself, or a file of one of the five
// packages (VAULT_PAGE_PACKAGES, not a package nested inside one). A Vite virtual module (`\0…`) is
// refused too: none is bundled today (modulePreload is off), and a new one is a decision to make here.
function vaultPageModuleAllowed(id) {
  const path = id.replace(/[?#].*$/, '');
  if (path === 'unlock.html' || vaultPageFileAllowed(path)) return true;
  const pkg = /^node_modules\/((?:@[^/]+\/)?[^/]+)\/(.+)$/.exec(path);
  return pkg !== null && VAULT_PAGE_PACKAGES.includes(pkg[1]) && !pkg[2].split('/').includes('node_modules');
}

/**
 * `modules`: the parsed dist/app.modules.json ({chunks, css, chunkCss, cssRefs}; vite.config.ts), or
 * undefined when it is missing. Checks every JS chunk and every stylesheet unlock.html loads.
 *
 * Known gap (fix round 3, N2): an inline worker (`./x?worker&inline`) is built into a base64 string
 * inside the importing chunk; the modules of the worker's own build are recorded, but under a chunk name
 * no page loads, so this map would not tie them to the vault page. The source walk refuses the `?worker`
 * query outright (a query is never a plain specifier), and an inline worker starts through
 * `URL.createObjectURL(new Blob(…))`, which BUILT_MARKUP's createObjectURL name refuses in any chunk the
 * vault page loads — the incidental backstop.
 */
export function vaultPageModuleViolations(distApp, modules) {
  if (modules === undefined || typeof modules.chunks !== 'object' || typeof modules.css !== 'object' || typeof modules.cssRefs !== 'object') {
    return ['INCONCLUSIVE: no chunk module map (app.modules.json next to dist/app, with chunks, css, chunkCss and cssRefs) — the build must write one'];
  }
  const out = [];
  const problems = new Set();
  const seen = new Set();
  const sheets = new Set();
  const page = existsSync(join(distApp, 'unlock.html')) ? readFileSync(join(distApp, 'unlock.html'), 'utf8') : '';
  // The built page is parsed as HTML (fix round 4: an unquoted `rel=stylesheet` was not read). It carries
  // no inline CSS, and every <link> is a stylesheet of the build's own.
  const tags = htmlTags(page);
  out.push(...inlineCss('unlock.html', page, 'the vault page is styled by its built stylesheets only'));
  for (const tag of tags.filter(t => t.name === 'link')) {
    const rel = (tag.attrs.get('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const href = (tag.attrs.get('href') ?? '').trim();
    if (!rel.includes('stylesheet')) out.push(`unlock.html has a <link rel="${rel.join(' ')}"> — only the build’s own stylesheets may be linked`);
    else if (href === '') out.push('unlock.html has a stylesheet <link> without an href — only the build’s own stylesheets may be linked');
    else if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) out.push(`unlock.html links a stylesheet from another origin (${href}) — only the build’s own stylesheets`);
    else {
      const r = resolveBuilt(distApp, 'unlock.html', href);
      if (r.problem) problems.add(r.problem);
      else sheets.add(r.target);
    }
  }
  for (const src of tags.filter(t => t.name === 'script' && t.attrs.has('src')).map(t => t.attrs.get('src') ?? '')) {
    const r = resolveBuilt(distApp, 'unlock.html', src);
    if (r.problem) {
      problems.add(r.problem);
      continue;
    }
    for (const file of reachable(distApp, r.target, problems)) {
      if (!/\.m?js$/.test(file)) continue;
      for (const css of modules.chunkCss?.[file] ?? []) sheets.add(css);
      const ids = modules.chunks[file];
      if (!Array.isArray(ids)) {
        out.push(`${file} (reachable from unlock.html) is not in the chunk module map — what it carries is unknown`);
        continue;
      }
      for (const id of ids) {
        seen.add(id);
        if (!vaultPageModuleAllowed(id)) out.push(`${file} (reachable from unlock.html) carries ${JSON.stringify(id)} — only vault-page code and its five packages may be bundled with the seed`);
      }
    }
  }
  // Positive control: the map really describes the vault page (its entry module is in a chunk it loads).
  if (!seen.has(VAULT_PAGE_ENTRY)) out.push(`INCONCLUSIVE: no chunk reachable from unlock.html carries ${VAULT_PAGE_ENTRY} in the module map — the check would pass trivially`);

  // Fix round 3 (N1): every stylesheet the vault page loads is built from the three named sheets — all
  // three, nothing else — and none of them @imports or loads a url() beyond the Geist faces (read from
  // the RAW source, before Vite inlines an @import). The built text is checked too.
  const from = new Set();
  for (const sheet of [...sheets].sort()) {
    const sources = modules.css[sheet];
    if (!Array.isArray(sources)) {
      out.push(`${sheet} (loaded by unlock.html) is not in the module map — what it was built from is unknown`);
      continue;
    }
    for (const id of sources) {
      const path = id.replace(/[?#].*$/, '');
      from.add(path);
      if (!VAULT_PAGE_SHEETS.includes(path)) out.push(`${sheet} (loaded by unlock.html) is built from ${JSON.stringify(id)} — only ${VAULT_PAGE_SHEETS.join(', ')} may style the vault page`);
      // The raw source as scripts/css-scan.mjs read it (vite.config.ts): every field, or no record at all.
      const refs = modules.cssRefs[id] ?? modules.cssRefs[path];
      if (refs === undefined || !Array.isArray(refs.imports) || !Array.isArray(refs.urls) || !Array.isArray(refs.loaders) || typeof refs.escapes !== 'boolean') {
        out.push(`${sheet} (loaded by unlock.html): no source record for ${id} — what it imports is unknown`);
        continue;
      }
      for (const spec of refs.imports) out.push(`${sheet} (loaded by unlock.html): ${path} @imports ${spec} — the vault page's sheets import nothing`);
      for (const url of refs.urls) if (!(VAULT_PAGE_CSS_URLS[path] ?? []).includes(url)) out.push(`${sheet} (loaded by unlock.html): ${path} loads url(${url}) — only the bundled Geist faces may be loaded`);
      for (const fn of refs.loaders) out.push(`${sheet} (loaded by unlock.html): ${path} uses ${fn}() — it loads URLs without url()`);
      if (refs.escapes) out.push(`${sheet} (loaded by unlock.html): ${path} contains a backslash escape — an escape can spell url( or @import`);
    }
    // The built text, read by the same tokenizer (fix round 4): no @import, no backslash, no URL loaded
    // without url(), and every url() resolves to one of the two Geist faces.
    const built = scanCss(existsSync(join(distApp, sheet)) ? readFileSync(join(distApp, sheet), 'utf8') : '');
    if (built.imports.length > 0) out.push(`${sheet} (loaded by unlock.html) contains @import`);
    for (const url of built.urls) {
      const target = posix.normalize(posix.join(posix.dirname(sheet), url));
      if (target !== 'fonts/Geist-Variable.woff2' && target !== 'fonts/GeistMono-Variable.woff2') out.push(`${sheet} (loaded by unlock.html) loads url(${url}) — only the bundled Geist faces may be loaded`);
    }
    for (const fn of built.loaders) out.push(`${sheet} (loaded by unlock.html) uses ${fn}() — it loads URLs without url()`);
    if (built.escapes) out.push(`${sheet} (loaded by unlock.html) contains a backslash escape — an escape can spell url( or @import`);
  }
  for (const want of VAULT_PAGE_SHEETS) if (!from.has(want)) out.push(`INCONCLUSIVE: no stylesheet unlock.html loads is built from ${want} — the map does not describe the vault page's styles`);
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
  // dist/chrome and dist/firefox are copies of dist/app (scripts/build.mjs): one module map covers all three.
  const mapPath = join(ROOT, 'dist', 'app.modules.json');
  const modules = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : undefined;
  for (const p of vaultPageModuleViolations(join(ROOT, 'dist', 'app'), modules)) problems.push(`dist/app: ${p}`);
  for (const browser of ['chrome', 'firefox']) {
    const m = JSON.parse(readFileSync(join(ROOT, 'dist', browser, 'manifest.json'), 'utf8'));
    for (const p of manifestViolations(m)) problems.push(`dist/${browser}/manifest.json: ${p}`);
  }
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('vault isolation ok: sources, built popup/background and both manifests carry no path to the vault; no page reaches storage.session; every module bundled into the vault page is vault-page code or one of its five packages, and its stylesheets are the three named sheets, importing nothing and loading only the Geist faces; its HTML carries no inline CSS and links only its built sheets, and its code builds no CSS at run time');
}
