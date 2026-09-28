#!/usr/bin/env node
// Same rules as web/: no inline script or style in the HTML, no eval / new Function in the
// JS. Imported rather than copied, so the two gates cannot drift apart.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {checkHtml, checkJs} from '../../web/scripts/check-csp.mjs';

const root = process.argv[2] ?? 'dist/app';
const problems = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith('.html')) problems.push(...checkHtml(readFileSync(p, 'utf8')).map(x => `${p}: ${x}`));
    else if (entry.endsWith('.js')) problems.push(...checkJs(readFileSync(p, 'utf8')).map(x => `${p}: ${x}`));
  }
}
walk(root);
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`CSP ok: ${root} needs no unsafe-inline or unsafe-eval`);
