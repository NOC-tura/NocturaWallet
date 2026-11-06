import {crc32, deflateSync} from 'node:zlib';
import {STORE_SHOT, pngHeader, storeShotProblems} from '../png.mjs';

// B1e §6.4 (Minor 9): the store takes JPEG or 24-bit PNG screenshots at 1280 × 800. e2e/storeScreenshots.spec.ts
// checks each PNG it writes with storeShotProblems; this test checks the reader itself on PNGs written here by an
// encoder of the test's own (never png.mjs's code), so the check holds whether or not release/screenshots/out/ exists.
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const be32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type, data, o = {}) {
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
  const crc = (crc32(typed) ^ (o.crcXor ?? 0)) >>> 0;
  return Buffer.concat([Buffer.from(be32(data.length)), typed, Buffer.from(be32(crc))]);
}
const BYTES_PER_PIXEL = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4};
/** A whole PNG: IHDR, an IDAT of black rows (filter byte 0), IEND — or the chunks `o.chunks` puts in their place. */
function png(o = {}) {
  const width = o.width ?? 1280;
  const height = o.height ?? 800;
  const bitDepth = o.bitDepth ?? 8;
  const colourType = o.colourType ?? 2;
  const ihdr = chunk('IHDR', [...be32(width), ...be32(height), bitDepth, colourType, 0, 0, 0], {crcXor: o.ihdrCrcXor});
  const row = 1 + width * (BYTES_PER_PIXEL[colourType] ?? 3) * (bitDepth / 8);
  const idat = chunk('IDAT', deflateSync(Buffer.alloc(row * height)));
  const iend = chunk('IEND', []);
  const chunks = o.chunks?.({ihdr, idat, iend, chunk}) ?? [ihdr, idat, iend];
  return Buffer.concat([Buffer.from(o.signature ?? SIGNATURE), ...chunks]);
}

describe('the store screenshot PNG check (B1e §6.4)', () => {
  test('a 1280 × 800 8-bit truecolour PNG with no transparency passes, and its header reads back exactly', () => {
    expect(STORE_SHOT).toEqual({width: 1280, height: 800, bitDepth: 8, colourType: 2});
    const bytes = png();
    expect(pngHeader(bytes)).toEqual({width: 1280, height: 800, bitDepth: 8, colourType: 2, chunks: ['IHDR', 'IDAT', 'IEND']});
    expect(storeShotProblems(bytes)).toEqual([]);
  });

  test('every other size, depth and colour type is named', () => {
    expect(storeShotProblems(png({width: 1279}))).toEqual(['width 1279, not 1280']);
    expect(storeShotProblems(png({height: 801}))).toEqual(['height 801, not 800']);
    expect(storeShotProblems(png({width: 412, height: 600}))).toEqual(['width 412, not 1280', 'height 600, not 800']);
    expect(storeShotProblems(png({colourType: 6}))).toEqual(['colour type 6 (truecolour with alpha), not 2 (truecolour: 24-bit)']);
    expect(storeShotProblems(png({colourType: 3}))).toEqual(['colour type 3 (palette), not 2 (truecolour: 24-bit)']);
    expect(storeShotProblems(png({bitDepth: 16}))).toEqual(['bit depth 16, not 8']);
  });

  test('a tRNS chunk (transparency in a truecolour PNG) is refused', () => {
    const withTrns = png({chunks: ({ihdr, idat, iend, chunk: c}) => [ihdr, c('tRNS', [0, 0, 0, 0, 0, 0]), idat, iend]});
    expect(pngHeader(withTrns).chunks).toEqual(['IHDR', 'tRNS', 'IDAT', 'IEND']);
    expect(storeShotProblems(withTrns)).toEqual(['a tRNS chunk: the image carries transparency']);
  });

  test('what is not a whole, well-formed PNG is refused, naming why', () => {
    expect(storeShotProblems(png({signature: [137, 80, 78, 71, 13, 10, 26, 11]}))).toEqual(['not a PNG: no PNG signature']);
    expect(storeShotProblems(Buffer.from('<!doctype html>'))).toEqual(['not a PNG: no PNG signature']);
    expect(storeShotProblems(png({ihdrCrcXor: 1}))).toEqual(['not a PNG: chunk IHDR at byte 8 fails its CRC']);
    expect(storeShotProblems(png({chunks: ({ihdr, idat}) => [ihdr, idat]}))).toEqual(['not a PNG: it does not end with IEND']);
    expect(storeShotProblems(png({chunks: ({ihdr, idat, iend}) => [idat, ihdr, iend]}))).toEqual(['not a PNG: IHDR is not the first chunk']);
    expect(storeShotProblems(png({chunks: ({ihdr, idat, iend}) => [ihdr, idat, iend, Buffer.from([0, 0])]}))).toEqual([`not a PNG: a chunk at byte ${png().length} runs past the end`]);
    const short = png({chunks: ({idat, iend, chunk: c}) => [c('IHDR', [0, 0, 5, 0, 0, 0, 3, 32, 8, 2, 0, 0]), idat, iend]});
    expect(storeShotProblems(short)).toEqual(['not a PNG: IHDR is 12 bytes, not 13']);
    expect(storeShotProblems(png().subarray(0, 40))).toEqual(['not a PNG: a chunk at byte 33 runs past the end']);
  });
});
