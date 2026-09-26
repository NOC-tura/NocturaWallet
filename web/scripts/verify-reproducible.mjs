#!/usr/bin/env node
// §6.3's stated check: "a reproducible-build step that builds twice and compares hashes."
//
// What this proves and what it does not: two builds from one checkout, on one machine,
// with one Node and one npm tree. That catches the common causes of drift — a timestamp
// baked into the bundle, a build id, a path that leaks in, iteration order that depends
// on a hash seed. It does NOT prove a build on another machine matches; only CI running
// this on different hardware than the laptop does that, which is why it is wired into
// the workflow and not only into `npm run verify`.
//
// A published hash that the publisher cannot reproduce is not a control, it is a number.
import {mkdtempSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildManifest} from './build-manifest.mjs';

function build(outDir) {
  execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    stdio: 'inherit',
    // Vite refuses an outDir outside the project root without this.
    env: {...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true'},
  });
}

const dirs = [mkdtempSync(join(tmpdir(), 'noctura-rb-a-')), mkdtempSync(join(tmpdir(), 'noctura-rb-b-'))];

try {
  const manifests = dirs.map(d => {
    build(d);
    return buildManifest(d);
  });

  const [a, b] = manifests;

  if (a.files.length === 0) {
    console.error('INCONCLUSIVE: the build produced no files, so the two digests would match trivially');
    process.exit(2);
  }

  if (a.digest === b.digest) {
    console.log(`\nreproducible: ${a.files.length} files, both builds sha256:${a.digest}`);
    process.exit(0);
  }

  console.error('\nNOT REPRODUCIBLE — two builds of the same source differ:');
  const bByPath = new Map(b.files.map(f => [f.path, f.sha256]));
  for (const f of a.files) {
    const other = bByPath.get(f.path);
    if (other === undefined) console.error(`  only in build A: ${f.path}`);
    else if (other !== f.sha256) console.error(`  differs: ${f.path}\n    A ${f.sha256}\n    B ${other}`);
    bByPath.delete(f.path);
  }
  for (const path of bByPath.keys()) console.error(`  only in build B: ${path}`);
  process.exit(1);
} finally {
  for (const d of dirs) rmSync(d, {recursive: true, force: true});
}
