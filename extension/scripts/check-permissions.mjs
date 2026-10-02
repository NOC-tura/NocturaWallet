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
import {join} from 'node:path';
import {PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION} from '../manifest/source.mjs';

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

export function comparePermissions(manifest, browser) {
  const problems = [];
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
  if (manifest.content_scripts !== undefined) problems.push('content_scripts present (not before B1c)');
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

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0;
  for (const browser of ['chrome', 'firefox']) {
    const m = JSON.parse(readFileSync(join('dist', browser, 'manifest.json'), 'utf8'));
    for (const p of comparePermissions(m, browser)) {
      console.error(`${browser}: ${p}`);
      bad += 1;
    }
  }
  if (bad) process.exit(1);
  console.log('permissions ok: both manifests match manifest/source.mjs');
}
