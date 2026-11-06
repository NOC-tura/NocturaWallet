#!/usr/bin/env node
// The built manifests must say exactly what manifest/source.mjs says. A permission that
// arrives by a hand edit of dist/ — or by a future generator bug — fails here.
//
// Fix round 3: the manifest-vs-source equality check above only catches a manifest that drifted
// FROM source.mjs — it says nothing if EXTENSION_CSP itself were loosened in source.mjs, since the
// manifest would then "correctly" match a weaker policy. connect-src is the one runtime backstop
// for check-rpc-methods.mjs's text-based Connection/fetch checks (a bypass that check misses still
// cannot reach the network, because the browser enforces this independent of what the JS says), so
// its value is worth pinning independent of source.mjs too — REQUIRED_CONNECT_SRC is copied here on
// purpose, same pattern as check-rpc-methods.mjs's SPEC_ALLOWED against core/solana/rpc.ts's list.
import {readFileSync} from 'node:fs';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {distDir} from './distDir.mjs';
import {isMain} from './isMain.mjs';
import {readStoreKey} from './storeKey.mjs';
import {PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION} from '../manifest/source.mjs';

// B1e §5.2 (R5): the version every built manifest must carry — package.json's, read here on its own (not through
// source.mjs's VERSION, so a constant put back in source.mjs fails here), and the version pattern pinned here too.
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
export function packageJsonVersion() {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
}

/** Every way `manifest.version` is not exactly `want` (package.json's) in the release form. */
export function versionViolations(manifest, want = packageJsonVersion()) {
  const got = manifest.version;
  const out = [];
  if (typeof want !== 'string' || !VERSION_PATTERN.test(want)) out.push(`package.json version ${JSON.stringify(want)} does not match ${VERSION_PATTERN}`);
  if (got !== want) out.push(`version is ${JSON.stringify(got)}, want package.json's ${JSON.stringify(want)}`);
  else if (!VERSION_PATTERN.test(got)) out.push(`version ${JSON.stringify(got)} does not match ${VERSION_PATTERN}`);
  return out;
}

/**
 * B1e §5.3: the manifest `key`. `recorded` undefined (dist/, dist-nopresale/ — what verify, the gates and the release
 * read): no manifest carries a key. `recorded` = release/store-key.json's {id, key} (a `--dev-key` build): the Chrome
 * manifest carries exactly that key; Firefox's never carries one.
 */
export function keyViolations(manifest, browser, recorded) {
  const has = Object.hasOwn(manifest, 'key');
  if (browser !== 'chrome' || recorded === undefined) return has ? [`${browser}: carries a key — only a --dev-key Chrome build may (B1e §5.3)`] : [];
  if (manifest.key !== recorded.key) return [`chrome: key ${has ? 'differs from' : 'missing, want'} the recorded store key (release/store-key.json, id ${recorded.id})`];
  return [];
}

// The one host anything in the extension ever fetches (extension/src/background/deps.ts — RPC
// reads, JSON reads, the broadcast route, all through the coordinator proxy). No 'self': nothing
// fetches the extension's own origin. No wallet.noc-tura.io: that is the passkey RP ID, and a
// WebAuthn ceremony is not a fetch, so it is not governed by connect-src.
export const REQUIRED_CONNECT_SRC = ['https://api.noc-tura.io'];

/** connect-src in `csp` must be exactly REQUIRED_CONNECT_SRC — checked against a CSP string
 * directly, independent of whether it came from source.mjs or a built manifest. */
export function connectSrcViolations(csp) {
  const m = /(?:^|;)\s*connect-src\s+([^;]*)/.exec(csp ?? '');
  const got = m ? m[1].trim().split(/\s+/).filter(Boolean) : [];
  const want = REQUIRED_CONNECT_SRC;
  if (got.join(' ') !== want.join(' ')) {
    return [`connect-src is "${got.join(' ') || '(missing)'}", want exactly "${want.join(' ')}"`];
  }
  return [];
}

// Every directive of the extension CSP, pinned here independent of source.mjs (controller hardening,
// 2026-10-01; the reason is at EXTENSION_CSP). The CSP must be exactly these directives, each once, each
// with exactly this value: a missing, loosened, repeated or extra directive fails.
export const REQUIRED_CSP = [
  ['default-src', "'self'"],
  ['script-src', "'self'"],
  ['object-src', "'self'"],
  ['style-src', "'self'"],
  ['img-src', "'self' data:"],
  ['font-src', "'self'"],
  ['connect-src', REQUIRED_CONNECT_SRC.join(' ')],
  ['base-uri', "'none'"],
  ['form-action', "'none'"],
  ['frame-ancestors', "'none'"],
];

/** Every way `csp` differs from REQUIRED_CSP, directive by directive. */
export function cspViolations(csp) {
  const out = [];
  const got = new Map();
  for (const raw of (csp ?? '').split(';')) {
    const [name, ...sources] = raw.trim().split(/\s+/).filter(Boolean);
    if (name === undefined) continue;
    const key = name.toLowerCase();
    if (got.has(key)) out.push(`directive ${key} appears twice`);
    else got.set(key, sources.join(' '));
  }
  for (const [name, want] of REQUIRED_CSP) {
    const value = got.get(name);
    if (value !== want) out.push(`${name} is "${value ?? '(missing)'}", want exactly "${want}"`);
  }
  for (const [name, value] of got) {
    if (!REQUIRED_CSP.some(([d]) => d === name)) out.push(`unexpected directive "${`${name} ${value}`.trim()}"`);
  }
  return out;
}

// B1c §1.7, §6.2 (review L4): the two content scripts, pinned here independently of source.mjs — the matches, the
// world, run_at and all_frames of each, in this order, and nothing else. `<all_urls>` reaches every page, so a widened
// entry (all frames, a third script, the isolated relay moved into the page's world) is a decision, never an edit.
export const REQUIRED_CONTENT_SCRIPTS = [
  {matches: ['<all_urls>'], js: ['provider.js'], run_at: 'document_start', all_frames: false, world: 'MAIN'},
  {matches: ['<all_urls>'], js: ['relay.js'], run_at: 'document_start', all_frames: false, world: 'ISOLATED'},
];

/** Every way a manifest's content_scripts differ from REQUIRED_CONTENT_SCRIPTS (key order ignored, nothing extra allowed). */
export function contentScriptViolations(scripts) {
  const norm = x => JSON.stringify(x, Object.keys(x ?? {}).sort());
  if (!Array.isArray(scripts) || scripts.length !== REQUIRED_CONTENT_SCRIPTS.length) return [`content_scripts must be exactly the provider and the relay, got ${JSON.stringify(scripts)}`];
  return scripts.flatMap((got, i) => (norm(got) === norm(REQUIRED_CONTENT_SCRIPTS[i]) ? [] : [`content_scripts[${i}] is ${JSON.stringify(got)}, want ${JSON.stringify(REQUIRED_CONTENT_SCRIPTS[i])}`]));
}

export function comparePermissions(manifest, browser, {recorded, version} = {}) {
  const problems = [...versionViolations(manifest, version), ...keyViolations(manifest, browser, recorded)];
  const want = PERMISSIONS.map(p => p.value).join(',');
  const got = (manifest.permissions ?? []).join(',');
  if (got !== want) problems.push(`permissions differ: ${got}`);
  const wantHosts = HOST_PERMISSIONS.map(p => p.value).join(',');
  const gotHosts = (manifest.host_permissions ?? []).join(',');
  if (gotHosts !== wantHosts) problems.push(`host_permissions differ: ${gotHosts}`);
  if (manifest.content_security_policy?.extension_pages !== EXTENSION_CSP) {
    problems.push(`CSP differs: ${manifest.content_security_policy?.extension_pages}`);
  }
  problems.push(...cspViolations(manifest.content_security_policy?.extension_pages));
  problems.push(...contentScriptViolations(manifest.content_scripts));
  if (browser === 'chrome' && manifest.minimum_chrome_version !== MIN_CHROME_VERSION) {
    problems.push(`chrome: minimum_chrome_version differs: ${manifest.minimum_chrome_version}`);
  }
  if (browser === 'firefox') {
    const gecko = manifest.browser_specific_settings?.gecko;
    if (gecko?.strict_min_version !== MIN_FIREFOX_VERSION) problems.push(`firefox: gecko.strict_min_version differs: ${gecko?.strict_min_version}`);
    if (!gecko?.id) problems.push('firefox: gecko.id missing');
    if (!gecko?.data_collection_permissions) problems.push('firefox: data_collection_permissions missing');
  }
  return problems;
}

// CLI: `node scripts/check-permissions.mjs` reads NOCTURA_DIST's build (dist/ or dist-nopresale/: no key allowed);
// `node scripts/check-permissions.mjs --dev-key <outDir>` reads a --dev-key build against release/store-key.json (absent
// or malformed: fails). B1e-2 (Task 1's review): `--dev-key` refuses the directories `build.mjs --dev-key` refuses —
// dist/, dist-nopresale/ and anything under them, by the same prefix test on the resolved path — before reading the
// key: a key there is never right, and the form without `--dev-key` is the one that reads them.
if (isMain(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const USAGE = 'usage: node scripts/check-permissions.mjs [--dev-key <outDir>]';
  const args = process.argv.slice(2);
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--dev-key')) throw new Error(USAGE);
  const devKey = args.length === 2;
  const inside = dir => resolve(args[1]) === dir || resolve(args[1]).startsWith(dir + sep);
  if (devKey && ['dist', 'dist-nopresale'].some(d => inside(join(ROOT, d)))) {
    throw new Error(
      `--dev-key reads only a directory a --dev-key build may write, never dist/, dist-nopresale/ or anything under them (B1e §5.3); those are read without --dev-key, where a key fails. ${USAGE}`,
    );
  }
  const DIST = devKey ? resolve(args[1]) : distDir();
  const recorded = devKey ? readStoreKey() : undefined;
  let bad = 0;
  for (const browser of ['chrome', 'firefox']) {
    const m = JSON.parse(readFileSync(join(DIST, browser, 'manifest.json'), 'utf8'));
    for (const p of comparePermissions(m, browser, {recorded})) {
      console.error(`${browser}: ${p}`);
      bad += 1;
    }
  }
  if (bad) process.exit(1);
  console.log(
    devKey
      ? `permissions ok (${DIST}): both manifests match manifest/source.mjs, version ${packageJsonVersion()}; chrome carries the recorded store key (id ${recorded.id}), firefox none`
      : `permissions ok (${DIST}): both manifests match manifest/source.mjs, version ${packageJsonVersion()}, no key`,
  );
}
