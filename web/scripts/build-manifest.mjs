#!/usr/bin/env node
// §6.3: "the artifact hash published with each release so a served bundle can be
// compared against it."
//
// The digest is deliberately computable with coreutils alone. A hash that only our
// own script can reproduce is a hash nobody outside will ever check, and the whole
// point of publishing it is that someone who does not trust us — or does not trust
// whoever serves the page — can verify the bundle they were served is the bundle we
// built. So the format is `sha256sum` output, sorted by path, hashed again:
//
//   cd dist && find . -type f ! -name build-manifest.json -printf '%P\n' \
//     | LC_ALL=C sort | xargs sha256sum | sha256sum
//
// The manifest excludes itself, because a file cannot contain its own hash.
import {readdirSync, readFileSync, writeFileSync, statSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, relative, sep} from 'node:path';

export const MANIFEST_NAME = 'build-manifest.json';

const sha256 = buf => createHash('sha256').update(buf).digest('hex');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * One entry per emitted file, sorted by path under the C collation so the ordering
 * matches `LC_ALL=C sort` and the shell recipe above produces the same bytes.
 */
export function fileEntries(root) {
  return walk(root)
    .map(p => relative(root, p).split(sep).join('/'))
    .filter(p => p !== MANIFEST_NAME)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map(path => ({path, sha256: sha256(readFileSync(join(root, path)))}));
}

/** `sha256sum`'s exact line format: hash, two spaces, path. */
export function sumLines(entries) {
  return entries.map(e => `${e.sha256}  ${e.path}\n`).join('');
}

export function digestOf(entries) {
  return sha256(sumLines(entries));
}

export function buildManifest(root) {
  const files = fileEntries(root);
  return {schema: 1, digest: digestOf(files), files};
}

function main() {
  const [root, ...rest] = process.argv.slice(2);
  const write = !rest.includes('--print-only');
  if (!root) {
    console.error('usage: build-manifest.mjs <built-dir> [--print-only]');
    process.exit(2);
  }
  if (!existsSync(root)) {
    console.error(`NOT BUILT ${root} — run the build first`);
    process.exit(2);
  }

  const manifest = buildManifest(root);

  // No files means the build produced nothing and the digest below would be the hash
  // of an empty string — a stable, plausible-looking value that means nothing.
  if (manifest.files.length === 0) {
    console.error(`INCONCLUSIVE: ${root} holds no files to hash`);
    process.exit(2);
  }

  if (write) {
    writeFileSync(join(root, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  for (const f of manifest.files) console.log(`${f.sha256}  ${f.path}`);
  console.log(`\n${manifest.files.length} files`);
  console.log(`digest sha256:${manifest.digest}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
