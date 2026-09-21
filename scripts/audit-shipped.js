#!/usr/bin/env node
/**
 * npm audit, narrowed to what actually ships in the APK.
 *
 * `npm audit --omit=dev` is the wrong question for a React Native app: `react-native`
 * is a runtime dependency and drags the entire Metro toolchain into the "production"
 * tree, so the answer is mostly advisories about a bundler that never runs on a phone.
 * Raising the threshold to catch a real one therefore drowns the signal, and leaving it
 * at `critical` is how a high-severity buffer overflow in bigint-buffer rode along
 * inside the bundle until 2026-09-21.
 *
 * The only honest source for "what ships" is the bundle Metro produced. Its source map
 * lists every module that went in, so the packages named there are the shipped set, and
 * an advisory is reported only if its package is in it.
 *
 * Usage:
 *   node scripts/audit-shipped.js                       # builds the bundle, then audits
 *   node scripts/audit-shipped.js --sourcemap m.json --audit-json a.json   # offline
 *   node scripts/audit-shipped.js --min-severity high   # default: high
 */
'use strict';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];

/**
 * Package names for every `node_modules/...` path in a source map's `sources`.
 * Nested installs are attributed to the innermost package, which is the one whose
 * code is actually present: `a/node_modules/b` ships b, not a.
 */
function packagesFromSourcemap(sources) {
  const found = new Set();
  for (const source of sources || []) {
    if (typeof source !== 'string') continue;
    const idx = source.lastIndexOf('node_modules/');
    if (idx === -1) continue;
    const rest = source.slice(idx + 'node_modules/'.length);
    const parts = rest.split('/');
    if (parts.length === 0 || !parts[0]) continue;
    const name = parts[0].startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
    found.add(name);
  }
  return found;
}

/** Advisories whose package is in `shipped` and at least `minSeverity`. */
function shippedAdvisories(auditJson, shipped, minSeverity = 'high') {
  const floor = SEVERITY_ORDER.indexOf(minSeverity);
  if (floor === -1) throw new Error(`unknown severity: ${minSeverity}`);
  const out = [];
  const vulns = (auditJson && auditJson.vulnerabilities) || {};
  for (const [name, v] of Object.entries(vulns)) {
    if (!shipped.has(name)) continue;
    const rank = SEVERITY_ORDER.indexOf(v.severity);
    if (rank < floor) continue;
    const via = Array.isArray(v.via) ? v.via : [];
    const titled = via.find(x => x && typeof x === 'object' && x.title);
    out.push({
      name,
      severity: v.severity,
      title: titled ? titled.title : '(transitive)',
      fixAvailable: v.fixAvailable,
    });
  }
  return out.sort((a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity));
}

module.exports = {SEVERITY_ORDER, packagesFromSourcemap, shippedAdvisories};

if (require.main === module) {
  const {execFileSync} = require('node:child_process');
  const {readFileSync, mkdtempSync} = require('node:fs');
  const {tmpdir} = require('node:os');
  const {join} = require('node:path');

  const argv = process.argv.slice(2);
  const arg = name => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  const minSeverity = arg('--min-severity') || 'high';

  let sourcemapPath = arg('--sourcemap');
  if (!sourcemapPath) {
    const dir = mkdtempSync(join(tmpdir(), 'noctura-bundle-'));
    sourcemapPath = join(dir, 'bundle.map');
    console.error('building the release bundle to learn what ships (about a minute)…');
    execFileSync(
      'npx',
      ['react-native', 'bundle', '--platform', 'android', '--dev', 'false',
       '--entry-file', 'index.js', '--bundle-output', join(dir, 'bundle.js'),
       '--sourcemap-output', sourcemapPath],
      {stdio: ['ignore', 'ignore', 'inherit']},
    );
  }

  const auditPath = arg('--audit-json');
  // `npm audit` exits non-zero whenever it finds anything, so execFileSync throws and
  // the report arrives on the error's stdout. Treating that as a failure would make
  // this gate crash precisely when it has something to say.
  function runNpmAudit() {
    try {
      return execFileSync('npm', ['audit', '--json'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (e) {
      if (typeof e.stdout === 'string' && e.stdout.trim().startsWith('{')) return e.stdout;
      throw e;
    }
  }
  const auditRaw = auditPath ? readFileSync(auditPath, 'utf8') : runNpmAudit();

  const shipped = packagesFromSourcemap(JSON.parse(readFileSync(sourcemapPath, 'utf8')).sources);
  const hits = shippedAdvisories(JSON.parse(auditRaw), shipped, minSeverity);

  console.log(`packages in the shipped bundle: ${shipped.size}`);
  if (hits.length === 0) {
    console.log(`no advisories at or above "${minSeverity}" in a package that ships.`);
    process.exit(0);
  }
  console.error(`\n${hits.length} advisory(ies) at or above "${minSeverity}" in SHIPPED packages:\n`);
  for (const h of hits) {
    console.error(`  ${h.severity.padEnd(8)} ${h.name}`);
    console.error(`  ${''.padEnd(8)} ${h.title}`);
    console.error(`  ${''.padEnd(8)} fix: ${JSON.stringify(h.fixAvailable)}\n`);
  }
  process.exit(1);
}
