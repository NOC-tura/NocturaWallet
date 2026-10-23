#!/usr/bin/env node
// vite build once into dist/app, then one directory per browser: the same files plus that
// browser's manifest. The JS is identical across browsers by construction, so a reviewer
// comparing the two packages sees only the manifest differ.
//
// B1d §1.1: `node scripts/build.mjs [outDir] [--no-presale]`. --no-presale builds the extension without presale
// (NOCTURA_PRESALE=0 for every vite build, scripts/presaleFlag.mjs), into dist-nopresale/ unless outDir is given; the
// default is the build with it, into dist/. Either way <outDir>/app.features.json says which it is — next to
// app.modules.json, never inside a package — for the gates that read the build.
import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {render} from '../manifest/source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const presale = !args.includes('--no-presale');
const dirs = args.filter(a => a !== '--no-presale');
if (dirs.length > 1 || dirs.some(a => a.startsWith('-'))) throw new Error('usage: node scripts/build.mjs [outDir] [--no-presale]');
const outRoot = dirs[0] ? resolve(dirs[0]) : join(ROOT, presale ? 'dist' : 'dist-nopresale');
const app = join(outRoot, 'app');
const env = {...process.env, NOCTURA_PRESALE: presale ? '1' : '0'};
// Written last, removed first: a build that fails part-way leaves no claim about what it built.
const features = join(outRoot, 'app.features.json');
rmSync(features, {force: true});

execFileSync('npx', ['vite', 'build', '--outDir', app, '--emptyOutDir'], {cwd: ROOT, stdio: 'inherit', env});
// B1c §1.7: the two content scripts, each a classic script, into the same directory (vite.content.config.ts).
for (const content of ['provider', 'relay']) {
  execFileSync('npx', ['vite', 'build', '--config', 'vite.content.config.ts', '--outDir', app], {cwd: ROOT, stdio: 'inherit', env: {...env, NOCTURA_CONTENT: content}});
}

for (const browser of ['chrome', 'firefox']) {
  const dir = join(outRoot, browser);
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  cpSync(app, dir, {recursive: true});
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(render(browser), null, 2)}\n`);
}
writeFileSync(features, `${JSON.stringify({presale})}\n`);
