#!/usr/bin/env node
// B1e §4.3 (I1, R8): every URL string the package carries is one this table names — matched as a whole string, scheme
// http, https, ws, wss and ftp alike — in the file kind the table allows; the four links a user is given must be
// present. Run for one build's chrome/ and firefox/ packages (NOCTURA_DIST). licenses.html is skipped by name (N1): its
// licence texts carry URLs as escaped text, and check-vault-isolation.mjs's static-page rule holds there instead (no
// <a, no href=). fonts/LICENSE.txt is skipped by name too (rev 2.6): the Geist fonts' OFL text (public/fonts/LICENSE.txt,
// copied as is), which names its licence's home page and is no page. A library update that changes an inert string fails here until a reviewer adds the new string with
// its reason.
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMain} from './isMain.mjs';
import {distDir} from './distDir.mjs';

/**
 * Every URL literal: the spec's extraction, as written in §4.3 — the scheme matched in any case (rev 2.6): a browser
 * navigates `HTTPS://…` as it does `https://…`. The table compare stays exact, so an upper-case string fails.
 */
export const URL_LITERAL = /\b(?:https?|wss?|ftp):\/\/[^\s"'`<>)\\;]*/gi;
/** A template literal's interpolation inside a match, folded so a minifier's renaming (`${e}`, `${t}`) is one string. */
const INTERPOLATION = /\$\{[\w$]*\}/g;
/** The two files the gate does not read, by their exact package path: the licence page (N1) and the fonts' licence text (rev 2.6). */
export const SKIPPED = ['licenses.html', 'fonts/LICENSE.txt'];
/**
 * The text files a package may carry a URL in — an SVG document too (`<a xlink:href>`), though none ships today (review
 * M5); `.mjs` and `.txt` too (rev 2.6).
 */
export const READ = /\.(?:js|mjs|html|css|json|svg|txt)$/;

const MANIFEST = path => path === 'manifest.json';
const BACKGROUND = path => path === 'background.js';
const JS = path => path.endsWith('.js');
const PAGE_FILE = path => path.endsWith('.js') || path.endsWith('.html');

/**
 * The URL strings the package may carry. `where`: the files it may appear in. `present`: a navigable link the user is
 * given — the gate fails when it is in no file. `build`: only in that build (the default: both).
 */
export const LINKS = [
  // The coordinator: named by the manifest and the background only — pages reach it only through the background.
  {url: 'https://api.noc-tura.io/*', where: MANIFEST, kind: 'host permission (the coordinator)'},
  {url: 'https://api.noc-tura.io', where: MANIFEST, kind: "CSP connect-src (the one host anything fetches)"},
  {url: 'https://api.noc-tura.io/api/v1', where: BACKGROUND, kind: 'the coordinator base (API_BASE)'},
  {url: 'https://api.noc-tura.io/api/v1/rpc', where: BACKGROUND, kind: 'the coordinator RPC endpoint'},
  // The passkey relying-party ID (B1e §5.6, E17): a host permission only — nothing is served there, nothing fetches it.
  {url: 'https://wallet.noc-tura.io/*', where: MANIFEST, kind: 'host permission (the passkey RP ID)'},
  // Navigable links (an <a target="_blank">, never a fetch): each must also be PRESENT.
  {url: 'https://solscan.io/tx/', where: PAGE_FILE, present: true, kind: 'the explorer link prefix (src/app/explorer.ts)'},
  {url: 'https://noc-tura.io/extension/terms', where: PAGE_FILE, present: true, kind: 'Terms (#1, #38)'},
  {url: 'https://noc-tura.io/extension/privacy', where: PAGE_FILE, present: true, kind: 'Privacy Policy (#1, #38)'},
  {url: 'https://noc-tura.io/extension/help', where: PAGE_FILE, present: true, kind: 'Help & support (#38)'},
  // The presale build only: #24's invite link, shown and copied, never navigated or fetched (core/referral).
  {url: 'https://noc-tura.io?ref=${}', where: JS, build: 'presale', kind: "the referral invite link (core/referral's buildReferralLink)"},
  // Inert library strings: message text and namespace identifiers. Never fetched (connect-src admits only the
  // coordinator) and never navigated (no href, window.open or openPage is built from them).
  {url: 'https://reactjs.org/docs/error-decoder.html?invariant=', where: JS, kind: 'inert: react-dom 18.3.1, its production error text'},
  {url: 'https://github.com/uuidjs/uuid#getrandomvalues-not-supported', where: JS, kind: 'inert: uuid 8.3.2, its error text'},
  {url: 'http://www.w3.org/1999/xhtml', where: JS, kind: 'inert: react-dom, an XML namespace identifier'},
  {url: 'http://www.w3.org/2000/svg', where: JS, kind: 'inert: react-dom and React elements, an XML namespace identifier'},
  {url: 'http://www.w3.org/1999/xlink', where: JS, kind: 'inert: react-dom, an XML namespace identifier'},
  {url: 'http://www.w3.org/XML/1998/namespace', where: JS, kind: 'inert: react-dom, an XML namespace identifier'},
  {url: 'http://www.w3.org/1998/Math/MathML', where: JS, kind: 'inert: react-dom, an XML namespace identifier'},
];

const toPosix = p => p.split(sep).join('/');
function listFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/** Every URL string in `text`, as the table names them (an interpolation folded to `${}`). */
export const urlStrings = text => [...text.matchAll(URL_LITERAL)].map(m => m[0].replace(INTERPOLATION, '${}'));

/**
 * `files`: [{path (package-relative, /), text}]; `presale`: which build the package is. Returns every violation.
 * `links` and `skipped` are the table and the skip, as parameters for the controls.
 */
export function linkViolations(files, presale, {links = LINKS, skipped = SKIPPED} = {}) {
  const out = [];
  const table = links.filter(l => l.build === undefined || l.build === (presale ? 'presale' : 'no-presale'));
  const seen = new Set();
  let matches = 0;
  for (const {path, text} of files) {
    if (skipped.includes(path) || !READ.test(path)) continue;
    for (const url of urlStrings(text)) {
      matches += 1;
      const entry = table.find(l => l.url === url);
      if (entry === undefined) out.push(`${path} names ${JSON.stringify(url)} — a URL the link table does not name`);
      else if (!entry.where(path)) out.push(`${path} names ${JSON.stringify(url)} — ${entry.kind}, not allowed in this file`);
      else seen.add(url);
    }
  }
  if (matches === 0) return ['INCONCLUSIVE: no URL string in the package — the extraction broke'];
  for (const l of table.filter(l => l.present === true && !seen.has(l.url))) out.push(`${l.url} (${l.kind}) is in no file — the link the user is given is gone`);
  return out;
}

/** Reads one package directory. */
export function packageFiles(dir) {
  return listFiles(dir)
    .map(p => toPosix(relative(dir, p)))
    .sort()
    .map(path => ({path, text: READ.test(path) ? readFileSync(join(dir, path), 'utf8') : ''}));
}

if (isMain(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const DIST = distDir();
  const featuresFile = join(ROOT, DIST, 'app.features.json');
  const features = existsSync(featuresFile) ? JSON.parse(readFileSync(featuresFile, 'utf8')) : undefined;
  const problems = [];
  if (typeof features?.presale !== 'boolean') problems.push(`INCONCLUSIVE: ${DIST}/app.features.json does not say which build this is`);
  else {
    for (const browser of ['chrome', 'firefox']) {
      const dir = join(ROOT, DIST, browser);
      if (!existsSync(dir)) problems.push(`INCONCLUSIVE: ${DIST}/${browser} is missing`);
      else for (const p of linkViolations(packageFiles(dir), features.presale)) problems.push(`${DIST}/${browser}: ${p}`);
    }
  }
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`links ok (${DIST}): every URL string in chrome/ and firefox/ is one of the link table's, in a file it allows, and the four links the user is given are present (licenses.html and fonts/LICENSE.txt skipped by name)`);
}
