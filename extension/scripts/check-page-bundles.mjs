#!/usr/bin/env node
// B1c §6.2: the page-bundle gate. The two content scripts run in every web page (manifest/source.mjs CONTENT_SCRIPTS):
// the provider in the page's own world, the relay beside it. What the bundler put into each is read from the module
// maps the content builds write (vite.content.config.ts → dist/app.<name>.modules.json): each may carry only its own
// sources and — the provider only — @wallet-standard/*. Any module of src/background, src/vault, src/unlock, src/app,
// src/approve, core/ or web/ fails, as does any other package. Each is a classic script (a content script cannot be an
// ES module) and is the same file in dist/app, dist/chrome and dist/firefox.
//
// The dev-origin gate (§1.3, §6.2) lives here too: a store build's background.js accepts no http://localhost or
// http://127.0.0.1 page (plan 1 builds no development variant at all — a controller ruling; E2E serves its test dApp
// on https through ctx.route).
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CONTENT = {
  provider: {own: 'src/provider/', packages: ['@wallet-standard/wallet', '@wallet-standard/base']},
  relay: {own: 'src/relay/', packages: []},
};

/** Every module of the named content script's map that it may not carry; INCONCLUSIVE without a map or its entry. */
export function pageBundleViolations(name, modules) {
  const rule = CONTENT[name];
  const file = `${name}.js`;
  const ids = modules?.chunks?.[file];
  if (!Array.isArray(ids)) return [`INCONCLUSIVE: no module map for ${file} (dist/app.${name}.modules.json) — the content build must write one`];
  const out = [];
  if (Object.keys(modules.chunks).length !== 1) out.push(`${file}: the build made more than one chunk (${Object.keys(modules.chunks).join(', ')}) — a content script is one classic script`);
  if (!ids.includes(`${rule.own}index.ts`)) out.push(`INCONCLUSIVE: ${file}'s map does not carry ${rule.own}index.ts — it does not describe the ${name}`);
  for (const id of ids) {
    const path = String(id).replace(/[?#].*$/, '');
    if (path.startsWith(rule.own) && !path.includes('/__tests__/')) continue;
    const pkg = /^node_modules\/((?:@[^/]+\/)?[^/]+)\/(.+)$/.exec(path);
    if (pkg !== null && rule.packages.includes(pkg[1]) && !pkg[2].split('/').includes('node_modules')) continue;
    out.push(`${file} carries ${JSON.stringify(id)} — a content script may carry only ${rule.own} and ${rule.packages.length > 0 ? rule.packages.join(', ') : 'no package'}`);
  }
  return out;
}

/**
 * A content script must be a classic script: no top-level import or export statement. The pattern is textual: a
 * minified `}import(` (a dynamic import) would match too — none is built today; a hit means "look", then fix the
 * bundle or the pattern, never silence the gate (review 1 L10).
 */
export function classicScriptViolations(name, text) {
  if (typeof text !== 'string') return [`${name}.js is missing`];
  return /(^|[;}\n])\s*(import\s*[{*\w"'`]|export\s*[{*\w])/.test(text) ? [`${name}.js is an ES module — a content script must be a classic script`] : [];
}

/** §6.2: the store build's background accepts no development origin. */
export function devOriginViolations(backgroundJs) {
  if (typeof backgroundJs !== 'string' || backgroundJs.length === 0) return ['INCONCLUSIVE: background.js is missing'];
  return ['localhost', '127.0.0.1'].filter(h => backgroundJs.includes(h)).map(h => `background.js names ${h} — a store build accepts no development origin`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : undefined);
  const problems = [];
  for (const name of Object.keys(CONTENT)) {
    const map = read(join(ROOT, 'dist', `app.${name}.modules.json`));
    problems.push(...pageBundleViolations(name, map === undefined ? undefined : JSON.parse(map)));
    const app = read(join(ROOT, 'dist', 'app', `${name}.js`));
    problems.push(...classicScriptViolations(name, app));
    for (const browser of ['chrome', 'firefox']) {
      if (read(join(ROOT, 'dist', browser, `${name}.js`)) !== app) problems.push(`dist/${browser}/${name}.js differs from dist/app/${name}.js`);
    }
  }
  for (const d of ['app', 'chrome', 'firefox']) problems.push(...devOriginViolations(read(join(ROOT, 'dist', d, 'background.js'))).map(p => `dist/${d}: ${p}`));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('page bundles ok: provider.js carries only src/provider and @wallet-standard, relay.js only src/relay; both classic scripts; background.js accepts no development origin');
}
