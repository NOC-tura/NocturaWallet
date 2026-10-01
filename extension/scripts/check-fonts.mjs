#!/usr/bin/env node
// Spec B1b-2a §1.2/§1.3 (review L5): design-system.css loads Geist from `/fonts/*.woff2`. Both files
// must be in the build at dist/app/fonts/, and every font URL in the built CSS must resolve to one of
// them — a font from anywhere else would be a third-party request.
//
// Measured in the plan's dry run: with `base: './'`, Vite rewrites the absolute `/fonts/…` of a
// public/ asset to `../fonts/…`, relative to the CSS file in assets/ — not "stays /fonts/…" as the
// spec assumed. Both forms land on dist/app/fonts/, so both are accepted; what is checked is where the
// URL resolves. Plan 2 adds the vault page's CSS, which the same rule covers, and checks that the
// vault page's own stylesheets load Geist (vaultPageFontViolations).
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join, posix, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const FONTS = ['Geist-Variable.woff2', 'GeistMono-Variable.woff2'];

/** Where a url() in assets/<file>.css points, relative to dist/app; null for another origin. */
function target(url) {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) return null;
  return url.startsWith('/') ? posix.normalize(url.slice(1)) : posix.normalize(posix.join('assets', url));
}

export function fontViolations(distApp) {
  const out = [];
  for (const f of FONTS) if (!existsSync(join(distApp, 'fonts', f))) out.push(`fonts/${f} is missing from the build`);
  const assets = join(distApp, 'assets');
  const css = existsSync(assets) ? readdirSync(assets).filter(f => f.endsWith('.css')) : [];
  let geist = false;
  for (const f of css) {
    const text = readFileSync(join(assets, f), 'utf8');
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+\.woff2)['"]?\s*\)/g)) {
      const t = target(m[1]);
      if (t === null || !FONTS.some(name => t === `fonts/${name}`)) out.push(`assets/${f} loads a font from ${m[1]} — only a bundled fonts/ file is allowed`);
      if (t === 'fonts/Geist-Variable.woff2') geist = true;
    }
  }
  if (!geist) out.push('INCONCLUSIVE: no built CSS loads fonts/Geist-Variable.woff2');
  return out;
}

/**
 * Plan 2: the vault page itself must load Geist — the stylesheets unlock.html links (Vite injects
 * them) must name fonts/Geist-Variable.woff2. The rule above checks the URLs wherever they are; this
 * checks the vault page really gets the design's type, not the browser's fallback.
 */
export function vaultPageFontViolations(distApp) {
  const page = join(distApp, 'unlock.html');
  if (!existsSync(page)) return ['unlock.html is missing from the build'];
  const html = readFileSync(page, 'utf8');
  for (const m of html.matchAll(/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi)) {
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1];
    if (href === undefined || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) continue;
    const css = join(distApp, posix.normalize(href.replace(/^\//, '')));
    if (!existsSync(css)) continue;
    for (const u of readFileSync(css, 'utf8').matchAll(/url\(\s*['"]?([^'")]+\.woff2)['"]?\s*\)/g)) if (target(u[1]) === 'fonts/Geist-Variable.woff2') return [];
  }
  return ['unlock.html loads no stylesheet that names fonts/Geist-Variable.woff2 — the vault page would render in a fallback font'];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist', 'app');
  const problems = [...fontViolations(dist), ...vaultPageFontViolations(dist)];
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('fonts ok: both Geist files are in dist/app/fonts, every font URL in the CSS resolves there, and the vault page loads Geist');
}
