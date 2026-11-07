#!/usr/bin/env node
// B1e §5.4 (I8, R6): the store package as a hand-written STORE (uncompressed) zip, no dependency. A deflated zip's bytes
// depend on the zlib build, so a reviewer on another Node could not reproduce its sha256; STORE has no compressor, so
// "two builds, one zip, one sha256" holds on any machine.
//
// The format, fixed (and nothing else is written): entries = every regular file under the package directory, paths
// relative with `/`, sorted by the C collation (byte order), no directory entries — an empty directory has no entry and
// disappears from the zip; per entry a local header and the data, then the central directory, then the end record;
// version 20 (made by: 20 on host 0), flags 0 (no data descriptor; every path printable ASCII, so no UTF-8 flag), method
// 0, DOS time 0 and date 0x0021 (1980-01-01 00:00), CRC-32 by `zlib.crc32`, both sizes in both headers, internal and
// external attributes 0, no extra field, no file or archive comment, no zip64. Nothing of the file system but a file's
// path and bytes reaches the zip: no mtime, no mode, no owner.
//
// Refused (the zip is not written): a path that is not printable ASCII or not a plain relative path; anything under the
// directory that is not a regular file or a directory (a symlink — to a file or a directory —, a FIFO, a socket, a
// device); a directory holding no file at all; 65 535 entries or more, or any 32-bit field (a size, an offset) reaching
// 0xFFFFFFFF — the all-ones values are zip64's sentinels (APPNOTE 4.4.1.4), so a zip that needs one is refused, never
// written as zip64.
import {lstatSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {crc32} from 'node:zlib';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {isMain} from './isMain.mjs';

export const ZIP_VERSION = 20;
export const DOS_TIME = 0;
export const DOS_DATE = 0x0021;
/** The first entry count the end record cannot hold without zip64's sentinel. */
export const MAX_ENTRIES = 0xffff - 1;
/** The largest value a 32-bit size or offset field may hold without zip64's sentinel. */
export const MAX_FIELD = 0xffffffff - 1;
export const LOCAL_HEADER = 30;
export const CENTRAL_HEADER = 46;
export const END_RECORD = 22;

/** A path the zip may carry: printable ASCII, `/`-separated, relative, no empty, `.` or `..` segment, no backslash. */
export function pathProblem(path) {
  if (typeof path !== 'string' || path === '') return 'is empty';
  if (!/^[\x20-\x7e]+$/.test(path)) return 'is not printable ASCII';
  if (path.includes('\\')) return 'contains a backslash';
  if (path.split('/').some(s => s === '' || s === '.' || s === '..')) return 'is not a plain relative path';
  return null;
}

const byteOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The files the zip of `root` holds, `{path, bytes}` sorted by path. Throws on anything that is not a regular file or a
 * directory (symlinks included, by lstat), on a path `pathProblem` refuses, and when there is no file at all.
 */
export function zipInputs(root) {
  const top = resolve(root);
  if (!lstatSync(top).isDirectory()) throw new Error(`zip-store: ${root} is not a directory`);
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(top, p).split(sep).join('/');
      const st = lstatSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile()) files.push({path: rel, bytes: readFileSync(p)});
      else throw new Error(`zip-store: ${JSON.stringify(rel)} is not a regular file or a directory${st.isSymbolicLink() ? ' (a symlink)' : ''}`);
    }
  };
  walk(top);
  if (files.length === 0) throw new Error(`zip-store: ${root} holds no file`);
  return files.sort((a, b) => byteOrder(a.path, b.path));
}

/**
 * Where each record lands, from the paths and sizes alone: `{offsets, centralOffset, centralSize, length}`. Throws when
 * the entries are not sorted and unique, a path is refused, or a count, size or offset would need zip64.
 */
export function zipPlan(entries) {
  if (entries.length > MAX_ENTRIES) throw new Error(`zip-store: ${entries.length} entries — more than ${MAX_ENTRIES} needs zip64`);
  const offsets = [];
  let at = 0;
  let central = 0;
  entries.forEach(({path, size}, i) => {
    const problem = pathProblem(path);
    if (problem) throw new Error(`zip-store: the path ${JSON.stringify(path)} ${problem}`);
    if (i > 0 && byteOrder(entries[i - 1].path, path) >= 0) throw new Error(`zip-store: ${JSON.stringify(path)} is out of order or repeated`);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_FIELD) throw new Error(`zip-store: ${JSON.stringify(path)} is ${size} bytes — needs zip64`);
    if (at > MAX_FIELD) throw new Error(`zip-store: ${JSON.stringify(path)} starts at ${at} — needs zip64`);
    offsets.push(at);
    at += LOCAL_HEADER + path.length + size;
    central += CENTRAL_HEADER + path.length;
  });
  if (at > MAX_FIELD) throw new Error(`zip-store: the central directory starts at ${at} — needs zip64`);
  if (central > MAX_FIELD) throw new Error(`zip-store: the central directory is ${central} bytes — needs zip64`);
  return {offsets, centralOffset: at, centralSize: central, length: at + central + END_RECORD};
}

/** The zip of `files` (`{path, bytes}`, sorted by path, unique), exactly §5.4's format. */
export function zipFiles(files) {
  const plan = zipPlan(files.map(f => ({path: f.path, size: f.bytes.length})));
  const out = Buffer.alloc(plan.length);
  let at = 0;
  const u16 = v => (out.writeUInt16LE(v, at), (at += 2));
  const u32 = v => (out.writeUInt32LE(v, at), (at += 4));
  const crcs = files.map(f => crc32(f.bytes) >>> 0);
  files.forEach((f, i) => {
    u32(0x04034b50);
    u16(ZIP_VERSION); // version needed
    u16(0); // flags
    u16(0); // method: stored
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(crcs[i]);
    u32(f.bytes.length); // compressed size
    u32(f.bytes.length); // uncompressed size
    u16(f.path.length);
    u16(0); // extra field length
    at += out.write(f.path, at, 'latin1');
    out.set(f.bytes, at);
    at += f.bytes.length;
  });
  files.forEach((f, i) => {
    u32(0x02014b50);
    u16(ZIP_VERSION); // version made by: 20, host 0
    u16(ZIP_VERSION); // version needed
    u16(0);
    u16(0);
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(crcs[i]);
    u32(f.bytes.length);
    u32(f.bytes.length);
    u16(f.path.length);
    u16(0); // extra field length
    u16(0); // file comment length
    u16(0); // disk number start
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(plan.offsets[i]);
    at += out.write(f.path, at, 'latin1');
  });
  u32(0x06054b50);
  u16(0); // this disk
  u16(0); // the central directory's disk
  u16(files.length);
  u16(files.length);
  u32(plan.centralSize);
  u32(plan.centralOffset);
  u16(0); // archive comment length
  if (at !== plan.length) throw new Error(`zip-store: wrote ${at} bytes, planned ${plan.length}`);
  return out;
}

/** The STORE zip of the directory `root`. */
export const zipStore = root => zipFiles(zipInputs(root));

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function main(args) {
  if (args.length !== 2) {
    console.error('usage: node scripts/zip-store.mjs <dir> <out.zip>');
    return 2;
  }
  const [dir, out] = args.map(a => resolve(a));
  const inside = relative(dir, out);
  if (inside === '' || !(inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside))) {
    console.error(`zip-store: ${args[1]} is inside ${args[0]} — the zip would pack itself on the next run`);
    return 1;
  }
  try {
    const files = zipInputs(dir);
    const zip = zipFiles(files);
    writeFileSync(out, zip, {flag: 'wx'});
    console.log(`zip ${args[1]}: ${files.length} entries, ${zip.length} bytes, sha256:${sha256(zip)}`);
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
