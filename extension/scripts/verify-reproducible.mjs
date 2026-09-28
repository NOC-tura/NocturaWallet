#!/usr/bin/env node
// Two full builds (both browsers) into temp dirs; each browser's digest must match.
import {mkdtempSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildManifest} from '../../web/scripts/build-manifest.mjs';

const dirs = [mkdtempSync(join(tmpdir(), 'noctura-ext-a-')), mkdtempSync(join(tmpdir(), 'noctura-ext-b-'))];
try {
  for (const d of dirs) execFileSync('node', ['scripts/build.mjs', d], {stdio: 'inherit'});
  let bad = 0;
  for (const browser of ['chrome', 'firefox']) {
    const [a, b] = dirs.map(d => buildManifest(join(d, browser)));
    if (a.files.length === 0) {
      console.error(`INCONCLUSIVE: ${browser} build is empty`);
      process.exit(2);
    }
    if (a.digest !== b.digest) {
      console.error(`NOT REPRODUCIBLE: ${browser} sha256:${a.digest} vs sha256:${b.digest}`);
      bad += 1;
    } else console.log(`reproducible: ${browser} ${a.files.length} files sha256:${a.digest}`);
  }
  if (bad) process.exit(1);
} finally {
  for (const d of dirs) rmSync(d, {recursive: true, force: true});
}
