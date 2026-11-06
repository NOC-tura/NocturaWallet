#!/usr/bin/env node
// vite build once into dist/app, then one directory per browser: the same files plus that
// browser's manifest. The JS is identical across browsers by construction, so a reviewer
// comparing the two packages sees only the manifest differ.
//
// B1d §1.1: `node scripts/build.mjs [outDir] [--no-presale]`. --no-presale builds the extension without presale
// (NOCTURA_PRESALE=0 for every vite build, scripts/presaleFlag.mjs), into dist-nopresale/ unless outDir is given; the
// default is the build with it, into dist/. Either way <outDir>/app.features.json says which it is — next to
// app.modules.json, never inside a package — for the gates that read the build.
//
// B1e §5.3: `--dev-key` writes the store's public key (release/store-key.json, scripts/storeKey.mjs) into the Chrome
// manifest, so an unpacked install has the store's ID. Only into a directory named on the command line, never dist/ or
// dist-nopresale/ (the directories verify, the gates and the release read, whose manifests must carry no key); the key
// file is read before anything is built, and an absent or malformed one fails the build. Firefox's manifest never
// carries a key.
//
// B1e-2 (review C1): Vite keeps a NODE_ENV it finds in the environment, and NODE_ENV=development (or vitest's test)
// builds React's development bundle. This script builds only with no NODE_ENV or NODE_ENV=production (the same bytes —
// measured in the B1e-2 dry run); any other value fails before anything is built.
import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {render} from '../manifest/source.mjs';
import {LICENCE_PAGE, buildLicencePage} from './licences.mjs';
import {readStoreKey} from './storeKey.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv !== undefined && nodeEnv !== 'production') {
  throw new Error(
    `NODE_ENV is ${JSON.stringify(nodeEnv)} — build.mjs builds only with no NODE_ENV or NODE_ENV=production (B1e §5.1): any other value builds React's development bundle. Unset it (env -u NODE_ENV …).`,
  );
}
const args = process.argv.slice(2);
const presale = !args.includes('--no-presale');
const devKey = args.includes('--dev-key');
const dirs = args.filter(a => a !== '--no-presale' && a !== '--dev-key');
const USAGE = 'usage: node scripts/build.mjs [outDir] [--no-presale] | node scripts/build.mjs <outDir> --dev-key [--no-presale]';
if (dirs.length > 1 || dirs.some(a => a.startsWith('-'))) throw new Error(USAGE);
const outRoot = dirs[0] ? resolve(dirs[0]) : join(ROOT, presale ? 'dist' : 'dist-nopresale');
// B1e-2 (review M2): not into either directory nor anywhere under them — a keyed build inside dist-nopresale/chrome/ would
// put a second manifest, with the key, into the package the gates read.
const inside = dir => outRoot === dir || outRoot.startsWith(dir + sep);
if (devKey && (dirs.length === 0 || ['dist', 'dist-nopresale'].some(d => inside(join(ROOT, d))))) {
  throw new Error(`--dev-key builds only into a directory named on the command line, never dist/, dist-nopresale/ or anything under them (B1e §5.3). ${USAGE}`);
}
const key = devKey ? readStoreKey().key : undefined;
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
// B1e §4.2: licenses.html, from the module maps the three builds wrote — before the per-browser copies, so both carry
// the same file. A package whose licence cannot be named, or is outside the allowlist, throws: the build fails.
writeFileSync(join(app, LICENCE_PAGE), buildLicencePage(ROOT, outRoot));

for (const browser of ['chrome', 'firefox']) {
  const dir = join(outRoot, browser);
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  cpSync(app, dir, {recursive: true});
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(render(browser, browser === 'chrome' && key !== undefined ? {key} : {}), null, 2)}\n`);
}
writeFileSync(features, `${JSON.stringify({presale})}\n`);
