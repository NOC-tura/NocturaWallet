#!/usr/bin/env node
// Two full builds (both browsers) into temp dirs; each browser's digest must match. B1d §6.2 (review L10): for both
// builds — with presale and without (--no-presale) — so four builds in all.
import {mkdtempSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildManifest} from '../../web/scripts/build-manifest.mjs';

let bad = 0;
for (const [variant, flags] of [['presale', []], ['no-presale', ['--no-presale']]]) {
  const dirs = [mkdtempSync(join(tmpdir(), `noctura-ext-${variant}-a-`)), mkdtempSync(join(tmpdir(), `noctura-ext-${variant}-b-`))];
  try {
    for (const d of dirs) execFileSync('node', ['scripts/build.mjs', d, ...flags], {stdio: 'inherit'});
    for (const browser of ['chrome', 'firefox']) {
      const [a, b] = dirs.map(d => buildManifest(join(d, browser)));
      if (a.files.length === 0) {
        console.error(`INCONCLUSIVE: ${variant} ${browser} build is empty`);
        process.exitCode = 2;
        break;
      }
      if (a.digest !== b.digest) {
        console.error(`NOT REPRODUCIBLE: ${variant} ${browser} sha256:${a.digest} vs sha256:${b.digest}`);
        bad += 1;
      } else console.log(`reproducible: ${variant} ${browser} ${a.files.length} files sha256:${a.digest}`);
    }
  } finally {
    for (const d of dirs) rmSync(d, {recursive: true, force: true});
  }
  if (process.exitCode === 2) break;
}
if (bad && !process.exitCode) process.exitCode = 1;
