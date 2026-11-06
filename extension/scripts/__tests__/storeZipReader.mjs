// B1e §5.4: an independent reader of the store zip, for the tests only — it never imports scripts/zip-store.mjs (a
// source test in zip-store.test.mjs holds it to that) and computes its own CRC-32. It parses from the END: the end
// record, then the central directory it points to, then each local header the directory points to; every field §5.4
// fixes is checked, and every byte of the file must belong to exactly one record (no gap, no overlap, nothing after the
// end record). Anything else throws, naming the field.

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (ISO-HDLC, the zip one), table-driven, written here — not zlib's. */
export function crc32Of(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * The entries of a §5.4 store zip, `{path, bytes, crc, offset}` in file order. Throws on anything §5.4 does not write.
 */
export function readStoreZip(zip) {
  const buf = Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength);
  const fail = what => {
    throw new Error(`store zip: ${what}`);
  };
  const expect = (what, got, want) => {
    if (got !== want) fail(`${what} is ${got}, expected ${want}`);
  };
  if (buf.length < 22) fail(`${buf.length} bytes — shorter than an end record`);

  // The end record: searched for backwards over the largest comment a zip may carry, then required to be the last 22 bytes.
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i -= 1) {
    if (buf.readUInt32LE(i) === SIG_END) {
      end = i;
      break;
    }
  }
  if (end < 0) fail('no end record');
  expect('the end record offset', end, buf.length - 22);
  expect('the end record: this disk', buf.readUInt16LE(end + 4), 0);
  expect("the end record: the central directory's disk", buf.readUInt16LE(end + 6), 0);
  const count = buf.readUInt16LE(end + 8);
  expect('the end record: total entries', buf.readUInt16LE(end + 10), count);
  const cdSize = buf.readUInt32LE(end + 12);
  const cdOffset = buf.readUInt32LE(end + 16);
  expect('the end record: comment length', buf.readUInt16LE(end + 20), 0);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) fail('a zip64 sentinel in the end record');
  expect('the central directory ends at', cdOffset + cdSize, end);

  // The central directory.
  const central = [];
  let at = cdOffset;
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > end) fail(`central entry ${i} runs past the end record`);
    expect(`central entry ${i}: signature`, buf.readUInt32LE(at), SIG_CENTRAL);
    expect(`central entry ${i}: version made by`, buf.readUInt16LE(at + 4), 20);
    expect(`central entry ${i}: version needed`, buf.readUInt16LE(at + 6), 20);
    expect(`central entry ${i}: flags`, buf.readUInt16LE(at + 8), 0);
    expect(`central entry ${i}: method`, buf.readUInt16LE(at + 10), 0);
    expect(`central entry ${i}: DOS time`, buf.readUInt16LE(at + 12), 0);
    expect(`central entry ${i}: DOS date`, buf.readUInt16LE(at + 14), 0x0021);
    const crc = buf.readUInt32LE(at + 16);
    const csize = buf.readUInt32LE(at + 20);
    const usize = buf.readUInt32LE(at + 24);
    expect(`central entry ${i}: compressed size`, csize, usize);
    const nameLen = buf.readUInt16LE(at + 28);
    expect(`central entry ${i}: extra length`, buf.readUInt16LE(at + 30), 0);
    expect(`central entry ${i}: comment length`, buf.readUInt16LE(at + 32), 0);
    expect(`central entry ${i}: disk`, buf.readUInt16LE(at + 34), 0);
    expect(`central entry ${i}: internal attributes`, buf.readUInt16LE(at + 36), 0);
    expect(`central entry ${i}: external attributes`, buf.readUInt32LE(at + 38), 0);
    const offset = buf.readUInt32LE(at + 42);
    const nameBytes = buf.subarray(at + 46, at + 46 + nameLen);
    if (nameBytes.length !== nameLen || at + 46 + nameLen > end) fail(`central entry ${i}: its name runs past the end record`);
    for (const b of nameBytes) if (b < 0x20 || b > 0x7e) fail(`central entry ${i}: a name byte 0x${b.toString(16)} is not printable ASCII`);
    const path = nameBytes.toString('latin1');
    if (path === '' || path.endsWith('/')) fail(`central entry ${i}: ${JSON.stringify(path)} is a directory entry`);
    if (path.includes('\\') || path.split('/').some(s => s === '' || s === '.' || s === '..')) fail(`central entry ${i}: ${JSON.stringify(path)} is not a plain relative path`);
    central.push({path, crc, size: usize, offset});
    at += 46 + nameLen;
  }
  expect('the central directory size as parsed', at - cdOffset, cdSize);

  // Order: strictly increasing by bytes (the C collation) — sorted, and no path twice.
  for (let i = 1; i < central.length; i += 1) {
    const a = Buffer.from(central[i - 1].path, 'latin1');
    const b = Buffer.from(central[i].path, 'latin1');
    if (Buffer.compare(a, b) >= 0) fail(`${JSON.stringify(central[i].path)} is not after ${JSON.stringify(central[i - 1].path)} in byte order`);
  }

  // The local headers, in the directory's order, back to back from byte 0 to the central directory.
  let pos = 0;
  const entries = central.map((c, i) => {
    expect(`local entry ${i} (${c.path}): offset`, c.offset, pos);
    if (pos + 30 > cdOffset) fail(`local entry ${i} runs into the central directory`);
    expect(`local entry ${i}: signature`, buf.readUInt32LE(pos), SIG_LOCAL);
    expect(`local entry ${i}: version needed`, buf.readUInt16LE(pos + 4), 20);
    expect(`local entry ${i}: flags`, buf.readUInt16LE(pos + 6), 0);
    expect(`local entry ${i}: method`, buf.readUInt16LE(pos + 8), 0);
    expect(`local entry ${i}: DOS time`, buf.readUInt16LE(pos + 10), 0);
    expect(`local entry ${i}: DOS date`, buf.readUInt16LE(pos + 12), 0x0021);
    expect(`local entry ${i}: CRC-32`, buf.readUInt32LE(pos + 14), c.crc);
    expect(`local entry ${i}: compressed size`, buf.readUInt32LE(pos + 18), c.size);
    expect(`local entry ${i}: uncompressed size`, buf.readUInt32LE(pos + 22), c.size);
    const nameLen = buf.readUInt16LE(pos + 26);
    expect(`local entry ${i}: extra length`, buf.readUInt16LE(pos + 28), 0);
    expect(`local entry ${i}: name`, buf.subarray(pos + 30, pos + 30 + nameLen).toString('latin1'), c.path);
    const start = pos + 30 + nameLen;
    if (start + c.size > cdOffset) fail(`local entry ${i}: its data runs into the central directory`);
    const bytes = Buffer.from(buf.subarray(start, start + c.size));
    expect(`local entry ${i} (${c.path}): the CRC-32 of its data`, crc32Of(bytes), c.crc);
    pos = start + c.size;
    return {path: c.path, bytes, crc: c.crc, offset: c.offset};
  });
  expect('the local records end at', pos, cdOffset);
  return entries;
}
