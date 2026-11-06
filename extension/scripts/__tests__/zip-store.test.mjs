import {createHash} from 'node:crypto';
import {spawnSync, execFileSync} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, utimesSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {crc32} from 'node:zlib';
import {MAX_ENTRIES, MAX_FIELD, zipFiles, zipInputs, zipPlan, zipStore} from '../zip-store.mjs';
import {crc32Of, readStoreZip} from './storeZipReader.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** The package as the file system holds it, walked here (not by the writer): every regular file, path → bytes. */
function filesOf(dir, base = dir, out = new Map()) {
  for (const d of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, d.name);
    if (d.isDirectory()) filesOf(p, base, out);
    else out.set(p.slice(base.length + 1).split('\\').join('/'), readFileSync(p));
  }
  return out;
}

/** The C collation of the paths, by their bytes. */
const cOrder = paths => [...paths].sort((a, b) => Buffer.compare(Buffer.from(a, 'latin1'), Buffer.from(b, 'latin1')));

/** Every byte value, so a text-mode or encoding slip shows. */
const ALL_BYTES = Buffer.from(Array.from({length: 256}, (_, i) => i));

// B1e §5.4 (I8, R6): the store zip — every field §5.4 fixes, read back by an independent reader from the end record.
describe('the STORE zip (B1e §5.4)', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'zip-store-test-'));
  });
  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });
  const tree = (name, files) => {
    const dir = join(tmp, name);
    mkdirSync(dir, {recursive: true});
    for (const [rel, bytes] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), {recursive: true});
      writeFileSync(join(dir, rel), bytes);
    }
    return dir;
  };
  // A tree whose C order differs from a per-directory walk ('a.txt' sorts before 'a/b'; 'B' and 'Z/…' before 'a'), with
  // an empty file and a file of every byte value.
  const TRAP = {
    'a/b': 'in a\n',
    'a.txt': 'beside a\n',
    'a-b': 'dash\n',
    B: 'upper\n',
    'Z/y/deep.json': '{"k":1}\n',
    _x: '',
    'bin/all.bin': ALL_BYTES,
    'manifest.json': '{"manifest_version":3}\n',
  };
  const TRAP_ORDER = ['B', 'Z/y/deep.json', '_x', 'a-b', 'a.txt', 'a/b', 'bin/all.bin', 'manifest.json'];

  describe('the independent reader is itself a check', () => {
    it('computes the standard CRC-32 check value and agrees with zlib on every byte value', () => {
      expect(crc32Of(Buffer.from('123456789'))).toBe(0xcbf43926);
      expect(crc32Of(ALL_BYTES)).toBe(crc32(ALL_BYTES) >>> 0);
      expect(crc32Of(Buffer.alloc(0))).toBe(0);
    });

    it('never imports the writer or zlib', () => {
      const src = readFileSync(join(HERE, 'storeZipReader.mjs'), 'utf8');
      expect(src).not.toMatch(/^\s*import\b|\bimport\s*\(|\brequire\s*\(/m);
    });

    // Each a single field of a valid zip changed — the reader must refuse every one (negative controls), and the unchanged
    // zip must pass (the positive one).
    it('refuses a zip with any one field §5.4 fixes changed', () => {
      const good = zipStore(tree('p', {'a.txt': 'hi\n', 'b/c.txt': 'there\n'}));
      expect(readStoreZip(good).map(e => e.path)).toEqual(['a.txt', 'b/c.txt']);
      const lh = 0; // the first local header
      const ch = good.readUInt32LE(good.length - 22 + 16); // the first central header
      const patch = (off, bytes) => {
        const z = Buffer.from(good);
        z.set(bytes, off);
        return z;
      };
      const u16 = v => [v & 0xff, v >> 8];
      const cases = [
        ['local method 8', patch(lh + 8, u16(8)), /local entry 0: method is 8/],
        ['central method 8', patch(ch + 10, u16(8)), /central entry 0: method is 8/],
        ['local flags 0x0008 (a data descriptor)', patch(lh + 6, u16(8)), /local entry 0: flags/],
        ['central flags 0x0800 (UTF-8)', patch(ch + 8, u16(0x800)), /central entry 0: flags/],
        ['local DOS date 0', patch(lh + 12, u16(0)), /local entry 0: DOS date is 0/],
        ['central DOS time 1', patch(ch + 12, u16(1)), /central entry 0: DOS time is 1/],
        ['central version made by 0x0314 (Unix)', patch(ch + 4, u16(0x314)), /version made by is 788/],
        ['local version 10', patch(lh + 4, u16(10)), /local entry 0: version needed is 10/],
        ['central external attributes 0x81a40000', patch(ch + 38, [0, 0, 0xa4, 0x81]), /external attributes/],
        ['local CRC flipped', patch(lh + 14, [good[lh + 14] ^ 1]), /local entry 0: CRC-32/],
        ['both CRCs flipped alike', patch(ch + 16, [good[ch + 16] ^ 1]).fill(good[lh + 14] ^ 1, lh + 14, lh + 15), /the CRC-32 of its data/],
        ['a data byte changed', patch(lh + 30 + 5, [0x48]), /the CRC-32 of its data/],
        ['an archive comment', Buffer.concat([patch(good.length - 2, u16(3)), Buffer.from('abc')]), /end record offset/],
        ['bytes after the end record', Buffer.concat([good, Buffer.from([0])]), /end record offset/],
        ['the central offset off by one', patch(good.length - 22 + 16, [good[good.length - 22 + 16] + 1]), /central directory ends at/],
      ];
      for (const [what, zip, error] of cases) expect(() => readStoreZip(zip), what).toThrow(error);
    });
  });

  it('one file: exactly the bytes §5.4 fixes, field by field', () => {
    const hex = [
      // local header: signature, version 20, flags 0, method 0, DOS time 0, DOS date 0x0021, CRC-32, sizes 3 and 3, name 5, extra 0
      '504b0304', '1400', '0000', '0000', '0000', '2100', '7a7a6fed', '03000000', '03000000', '0500', '0000',
      '612e747874', // a.txt
      '68690a', // hi\n
      // central header: signature, made by 20 (host 0), needed 20, flags, method, time, date, CRC-32, sizes, name 5, extra 0,
      // comment 0, disk 0, internal 0, external 0, local offset 0
      '504b0102', '1400', '1400', '0000', '0000', '0000', '2100', '7a7a6fed', '03000000', '03000000', '0500', '0000', '0000',
      '0000', '0000', '00000000', '00000000', '612e747874',
      // end record: signature, disk 0, central directory's disk 0, 1 and 1 entries, central size 51, central offset 38, comment 0
      '504b0506', '0000', '0000', '0100', '0100', '33000000', '26000000', '0000',
    ].join('');
    expect(crc32Of(Buffer.from('hi\n'))).toBe(0xed6f7a7a);
    expect(zipStore(tree('one', {'a.txt': 'hi\n'})).toString('hex')).toBe(hex);
  });

  it('holds every file of the package — in the C collation, no directory entry, each entry byte for byte with its CRC', () => {
    const dir = tree('pkg', TRAP);
    const entries = readStoreZip(zipStore(dir));
    const disk = filesOf(dir);
    expect(entries.map(e => e.path)).toEqual(TRAP_ORDER);
    expect(entries.map(e => e.path)).toEqual(cOrder(disk.keys()));
    for (const e of entries) {
      expect(e.bytes.equals(disk.get(e.path)), e.path).toBe(true);
      expect(e.crc, e.path).toBe(crc32Of(disk.get(e.path)));
    }
  });

  it('two runs give one sha256; so does a copy with other mtimes, modes and creation order', () => {
    const a = tree('a', TRAP);
    const first = zipStore(a);
    expect(sha256(zipStore(a))).toBe(sha256(first));
    const b = tree('b', Object.fromEntries(Object.entries(TRAP).reverse()));
    for (const rel of Object.keys(TRAP)) {
      utimesSync(join(b, rel), new Date('2031-07-04T12:34:56Z'), new Date('2031-07-04T12:34:56Z'));
      chmodSync(join(b, rel), 0o751);
    }
    chmodSync(join(b, 'bin'), 0o700);
    expect(sha256(zipStore(b))).toBe(sha256(first));
  });

  it('a changed byte, a renamed file or an added empty file changes the sha256 (positive controls)', () => {
    const base = sha256(zipStore(tree('base', TRAP)));
    const changed = tree('changed', {...TRAP, 'a.txt': 'beside A\n'});
    expect(sha256(zipStore(changed))).not.toBe(base);
    expect(readStoreZip(zipStore(changed)).find(e => e.path === 'a.txt').bytes.toString()).toBe('beside A\n');
    const renamed = tree('renamed', TRAP);
    renameSync(join(renamed, 'a-b'), join(renamed, 'a-c'));
    expect(sha256(zipStore(renamed))).not.toBe(base);
    const added = tree('added', {...TRAP, 'empty.txt': ''});
    expect(sha256(zipStore(added))).not.toBe(base);
    expect(readStoreZip(zipStore(added)).map(e => e.path)).toContain('empty.txt');
  });

  it('an empty directory has no entry: it disappears, and the zip equals the tree without it', () => {
    const without = zipStore(tree('without', TRAP));
    const withEmpty = tree('with', TRAP);
    mkdirSync(join(withEmpty, 'empty/nested/deeper'), {recursive: true});
    mkdirSync(join(withEmpty, 'Z/y/hollow'));
    const zip = zipStore(withEmpty);
    expect(zip.equals(without)).toBe(true);
    expect(readStoreZip(zip).some(e => e.path.startsWith('empty') || e.path.includes('hollow'))).toBe(false);
  });

  it('refuses a directory that holds no file at all, and a root that is not a directory', () => {
    const hollow = join(tmp, 'hollow');
    mkdirSync(join(hollow, 'a/b'), {recursive: true});
    expect(() => zipStore(hollow)).toThrow(/holds no file/);
    const file = join(tmp, 'plain.txt');
    writeFileSync(file, 'x');
    expect(() => zipStore(file)).toThrow(/is not a directory/);
    const real = tree('real', {'a.txt': 'x'});
    symlinkSync(real, join(tmp, 'link'));
    expect(() => zipStore(join(tmp, 'link'))).toThrow(/is not a directory/);
    expect(readStoreZip(zipStore(real)).map(e => e.path)).toEqual(['a.txt']);
  });

  it('refuses a non-ASCII path on disk — and passes the same tree with an ASCII name', () => {
    for (const name of ['caf\u00e9.txt', 'a\u00a0b.txt', 'dir\u2010x/a.txt', '\u0430pp.js']) {
      const dir = tree(`n${createHash('md5').update(name).digest('hex')}`, {...TRAP, [name]: 'x'});
      expect(() => zipStore(dir), name).toThrow(/is not printable ASCII/);
    }
    expect(() => zipStore(tree('ascii', {...TRAP, 'cafe.txt': 'x'}))).not.toThrow();
  });

  it('refuses every path that is not printable ASCII or not a plain relative path', () => {
    const bad = ['', 'a\tb', 'a\x7fb', 'a\nb', 'a\\b', '/abs', '../x', 'a/../b', 'a//b', './a', 'a/./b', 'a/', 'caf\u00e9'];
    for (const path of bad) expect(() => zipFiles([{path, bytes: Buffer.from('x')}]), JSON.stringify(path)).toThrow(/the path/);
    for (const path of ['a', 'a b/c d.txt', '~!@#$%^&()-_=+[]{};,\'`.txt']) expect(() => zipFiles([{path, bytes: Buffer.alloc(0)}]), path).not.toThrow();
  });

  it('refuses a symlink (to a file, to a directory, dangling) and a FIFO, naming it — the same tree without passes', () => {
    const makers = {
      'file symlink': d => symlinkSync(join(d, 'a.txt'), join(d, 'link.txt')),
      'directory symlink': d => symlinkSync(join(d, 'a'), join(d, 'linkdir')),
      'dangling symlink': d => symlinkSync(join(d, 'nowhere'), join(d, 'gone')),
      FIFO: d => execFileSync('mkfifo', [join(d, 'a', 'pipe')]),
    };
    for (const [what, make] of Object.entries(makers)) {
      const d = tree(what.replace(/ /g, '-'), TRAP);
      expect(() => zipStore(d), `${what} control`).not.toThrow();
      make(d);
      expect(() => zipStore(d), what).toThrow(/is not a regular file or a directory/);
    }
    const d = tree('named', TRAP);
    symlinkSync(join(d, 'a.txt'), join(d, 'Z', 'evil'));
    expect(() => zipStore(d)).toThrow('zip-store: "Z/evil" is not a regular file or a directory (a symlink)');
  });

  it('refuses files that are unsorted or repeated (the in-memory form)', () => {
    const f = path => ({path, bytes: Buffer.from(path)});
    expect(() => zipFiles([f('b'), f('a')])).toThrow(/out of order or repeated/);
    expect(() => zipFiles([f('a'), f('a')])).toThrow(/out of order or repeated/);
    expect(() => zipFiles([f('a/b'), f('a.txt')])).toThrow(/out of order or repeated/);
    expect(readStoreZip(zipFiles([f('a.txt'), f('a/b')])).map(e => e.path)).toEqual(['a.txt', 'a/b']);
  });

  it(`holds ${MAX_ENTRIES} entries, and refuses one more (zip64's 0xFFFF sentinel)`, () => {
    expect(MAX_ENTRIES).toBe(65534);
    const many = n => Array.from({length: n}, (_, i) => ({path: `f/${String(i).padStart(5, '0')}`, bytes: Buffer.alloc(0)}));
    const entries = readStoreZip(zipFiles(many(65534)));
    expect(entries.length).toBe(65534);
    expect(entries.at(-1).path).toBe('f/65533');
    expect(() => zipFiles(many(65535))).toThrow('zip-store: 65535 entries — more than 65534 needs zip64');
  });

  it('refuses any size or offset that would need zip64 (4 GiB), from the plan alone', () => {
    expect(MAX_FIELD).toBe(0xfffffffe);
    expect(() => zipPlan([{path: 'a', size: 0xffffffff}])).toThrow(/is 4294967295 bytes — needs zip64/);
    expect(() => zipPlan([{path: 'a', size: 0xfffffffe}])).toThrow(/the central directory starts at 4294967325 — needs zip64/);
    // The largest single file: its data ends where the central directory may still start.
    const fits = zipPlan([{path: 'a', size: 0xfffffffe - 31}]);
    expect(fits.centralOffset).toBe(0xfffffffe);
    expect(fits.length).toBe(0xfffffffe + 47 + 22);
    expect(() => zipPlan([{path: 'a', size: 0xfffffffe - 30}])).toThrow(/central directory starts at 4294967295/);
    // A later file's local header past the 32-bit offset range.
    expect(() => zipPlan([{path: 'a', size: 0xffffffe0}, {path: 'b', size: 0}])).toThrow(/"b" starts at 4294967295 — needs zip64/);
    expect(() => zipPlan([{path: 'a', size: -1}])).toThrow(/needs zip64/);
    expect(() => zipPlan([{path: 'a', size: 1.5}])).toThrow(/needs zip64/);
  });

  describe('the CLI: node scripts/zip-store.mjs <dir> <out.zip>', () => {
    const cli = args => spawnSync(process.execPath, ['scripts/zip-store.mjs', ...args], {cwd: ROOT, encoding: 'utf8'});

    it('writes zipStore(dir) and prints its count, size and sha256', () => {
      const dir = tree('pkg', TRAP);
      const out = join(tmp, 'out.zip');
      const r = cli([dir, out]);
      expect(r.status).toBe(0);
      const zip = readFileSync(out);
      expect(zip.equals(zipStore(dir))).toBe(true);
      expect(r.stdout).toBe(`zip ${out}: 8 entries, ${zip.length} bytes, sha256:${sha256(zip)}\n`);
    });

    it('refuses an output inside the directory, and an output that exists (nothing written, nothing changed)', () => {
      const dir = tree('pkg', TRAP);
      const inside = cli([dir, join(dir, 'Z', 'x.zip')]);
      expect(inside.status).toBe(1);
      expect(inside.stderr).toMatch(/is inside/);
      expect(existsSync(join(dir, 'Z', 'x.zip'))).toBe(false);
      const exists = join(tmp, 'there.zip');
      writeFileSync(exists, 'keep');
      const again = cli([dir, exists]);
      expect(again.status).toBe(1);
      expect(again.stderr).toMatch(/EEXIST/);
      expect(readFileSync(exists, 'utf8')).toBe('keep');
      // A name inside that starts with '..' is still inside; a sibling of the directory is outside (control).
      expect(cli([dir, join(dir, '..x.zip')]).status).toBe(1);
      expect(existsSync(join(dir, '..x.zip'))).toBe(false);
      expect(cli([dir, join(tmp, 'sibling.zip')]).status).toBe(0);
    });

    it('refuses a refused package with exit 1, and wrong arguments with exit 2', () => {
      const dir = tree('pkg', {...TRAP, 'caf\u00e9': 'x'});
      const r = cli([dir, join(tmp, 'bad.zip')]);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/is not printable ASCII/);
      expect(existsSync(join(tmp, 'bad.zip'))).toBe(false);
      expect(cli([dir]).status).toBe(2);
      expect(cli([]).stderr).toBe('usage: node scripts/zip-store.mjs <dir> <out.zip>\n');
    });
  });

  it('zipInputs is the walk zipStore packs: sorted, regular files only', () => {
    const dir = tree('pkg', TRAP);
    expect(zipInputs(dir).map(f => f.path)).toEqual(TRAP_ORDER);
    expect(zipFiles(zipInputs(dir)).equals(zipStore(dir))).toBe(true);
  });
});
