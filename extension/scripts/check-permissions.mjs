#!/usr/bin/env node
// The built manifests must say exactly what manifest/source.mjs says. A permission that
// arrives by a hand edit of dist/ — or by a future generator bug — fails here.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP} from '../manifest/source.mjs';

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
  if (manifest.content_scripts !== undefined) problems.push('content_scripts present (not before B1c)');
  if (browser === 'firefox') {
    const gecko = manifest.browser_specific_settings?.gecko;
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
