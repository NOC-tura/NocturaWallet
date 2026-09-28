#!/usr/bin/env node
// vite build once into dist/app, then one directory per browser: the same files plus that
// browser's manifest. The JS is identical across browsers by construction, so a reviewer
// comparing the two packages sees only the manifest differ.
import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {render} from '../manifest/source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'dist');
const app = join(outRoot, 'app');

execFileSync('npx', ['vite', 'build', '--outDir', app, '--emptyOutDir'], {cwd: ROOT, stdio: 'inherit'});

for (const browser of ['chrome', 'firefox']) {
  const dir = join(outRoot, browser);
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  cpSync(app, dir, {recursive: true});
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(render(browser), null, 2)}\n`);
}
