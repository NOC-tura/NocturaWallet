#!/usr/bin/env node
// B1e §4.2 (R7, N3, E16): the licence gate, for one build (NOCTURA_DIST). Two rules over the module maps the build
// wrote next to its package, and one over the packages:
//   1. rpc-websockets (LGPL-3.0-only) ships no code: no module of node_modules/rpc-websockets/ is in any chunk (the
//      alias, scripts/rpcWebsockets.mjs, resolves the bare specifier to the stub — without it the package is in the maps
//      at 0 rendered bytes), and the stub renders 0 bytes in every chunk (something constructing a Connection renders it);
//   2. the licence page each package carries (app/, chrome/, firefox/) is exactly the page the build's maps give
//      (scripts/licences.mjs: rendered code only, the owner's allowlist, licence-ids.json) — a hand edit, a stale page or
//      a page from other maps fails.
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMain} from './isMain.mjs';
import {distDir} from './distDir.mjs';
import {LICENCE_PAGE, MODULE_MAPS, buildLicencePage} from './licences.mjs';
import {RPC_WEBSOCKETS_STUB} from './rpcWebsockets.mjs';

const RPC_WEBSOCKETS = /(?:^|\/)node_modules\/rpc-websockets\//;

/** Rule 1 over the parsed maps ([file name, map]). */
export function rpcWebsocketsViolations(maps) {
  const out = [];
  for (const [name, map] of maps) {
    if (map?.rendered === null || typeof map?.rendered !== 'object') {
      out.push(`INCONCLUSIVE: ${name} has no rendered section — what rpc-websockets renders is unknown`);
      continue;
    }
    if (map.chunks === null || typeof map.chunks !== 'object') {
      out.push(`INCONCLUSIVE: ${name} has no chunks section — whether rpc-websockets is in a chunk is unknown`);
      continue;
    }
    for (const [chunk, ids] of Object.entries(map.chunks)) {
      for (const id of Array.isArray(ids) ? ids : []) if (RPC_WEBSOCKETS.test(id)) out.push(`${name}: ${chunk} carries ${JSON.stringify(id)} — rpc-websockets must resolve to ${RPC_WEBSOCKETS_STUB} (the alias)`);
    }
    for (const [chunk, modules] of Object.entries(map.rendered)) {
      for (const [id, length] of Object.entries(modules ?? {})) {
        const path = id.replace(/[?#].*$/, '');
        if (RPC_WEBSOCKETS.test(path) && length !== 0) out.push(`${name}: ${chunk} renders ${length} bytes of ${JSON.stringify(id)} — no LGPL code may ship`);
        if (path === RPC_WEBSOCKETS_STUB && length !== 0) out.push(`${name}: ${chunk} renders ${length} bytes of ${RPC_WEBSOCKETS_STUB} — something constructs a Connection (a socket client); nothing the extension bundles may`);
      }
    }
  }
  return out;
}

/** Rule 2: each package's licenses.html equals the page the build's maps give. */
export function licencePageViolations(root, outRoot) {
  let want;
  try {
    want = buildLicencePage(root, outRoot);
  } catch (e) {
    return [e.message];
  }
  const out = [];
  for (const d of ['app', 'chrome', 'firefox']) {
    const file = join(outRoot, d, LICENCE_PAGE);
    if (!existsSync(file)) out.push(`${d}/${LICENCE_PAGE} is missing`);
    else if (readFileSync(file, 'utf8') !== want) out.push(`${d}/${LICENCE_PAGE} is not the page this build's module maps give — rebuild; never edit it by hand`);
  }
  return out;
}

if (isMain(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const DIST = distDir();
  const outRoot = join(ROOT, DIST);
  const maps = MODULE_MAPS.filter(f => existsSync(join(outRoot, f))).map(f => [f, JSON.parse(readFileSync(join(outRoot, f), 'utf8'))]);
  const problems = maps.length === MODULE_MAPS.length ? [...rpcWebsocketsViolations(maps), ...licencePageViolations(ROOT, outRoot)] : [`INCONCLUSIVE: ${DIST} lacks one of ${MODULE_MAPS.join(', ')}`];
  if (problems.length > 0) {
    for (const p of problems) console.error(`${DIST}: ${p}`);
    process.exit(1);
  }
  console.log(`licences ok (${DIST}): rpc-websockets resolves to its stub and renders 0 bytes; app/, chrome/ and firefox/ carry the licence page of the code this build renders`);
}
