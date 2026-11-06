// B1e §6.4 (Minor 9): the Chrome Web Store takes screenshots as JPEG or 24-bit PNG, 1280 × 800. This reads a PNG's
// chunk list and header (PNG spec §5: the 8-byte signature, then length / type / data / CRC-32 chunks, IHDR first and
// 13 bytes, IEND last) and names every way a file is not exactly that. Reading only: nothing here writes or converts
// an image. e2e/storeScreenshots.spec.ts checks each PNG it writes; scripts/__tests__/png.test.mjs checks
// this reader on PNGs written by the test's own encoder.
import {crc32} from 'node:zlib';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
/** What the store takes: 1280 × 800, 8 bits a sample, colour type 2 (truecolour — red, green, blue: 24 bits a pixel). */
export const STORE_SHOT = Object.freeze({width: 1280, height: 800, bitDepth: 8, colourType: 2});
const COLOUR_TYPES = {0: 'greyscale', 2: 'truecolour: 24-bit', 3: 'palette', 4: 'greyscale with alpha', 6: 'truecolour with alpha'};

/** The chunks of a PNG, each CRC-checked; throws naming the first fault. */
function chunks(bytes) {
  if (bytes.length < SIGNATURE.length || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('no PNG signature');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  for (let at = SIGNATURE.length; at < bytes.length; ) {
    if (at + 12 > bytes.length) throw new Error(`a chunk at byte ${at} runs past the end`);
    const length = view.getUint32(at);
    if (at + 12 + length > bytes.length) throw new Error(`a chunk at byte ${at} runs past the end`);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const crc = view.getUint32(at + 8 + length);
    if (crc32(bytes.subarray(at + 4, at + 8 + length)) !== crc) throw new Error(`chunk ${type} at byte ${at} fails its CRC`);
    out.push({type, data: bytes.subarray(at + 8, at + 8 + length)});
    at += 12 + length;
  }
  if (out[0]?.type !== 'IHDR') throw new Error('IHDR is not the first chunk');
  if (out[0].data.length !== 13) throw new Error(`IHDR is ${out[0].data.length} bytes, not 13`);
  if (out[out.length - 1]?.type !== 'IEND') throw new Error('it does not end with IEND');
  return out;
}

/** The header of a whole, well-formed PNG and its chunk types in order; throws `not a PNG: …` otherwise. */
export function pngHeader(bytes) {
  let list;
  try {
    list = chunks(bytes);
  } catch (e) {
    throw new Error(`not a PNG: ${e instanceof Error ? e.message : String(e)}`);
  }
  const ihdr = list[0].data;
  const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
  return {width: view.getUint32(0), height: view.getUint32(4), bitDepth: ihdr[8], colourType: ihdr[9], chunks: list.map(c => c.type)};
}

/** Every way `bytes` is not a store screenshot (STORE_SHOT, no tRNS); empty when it is one. */
export function storeShotProblems(bytes) {
  let h;
  try {
    h = pngHeader(bytes);
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
  const out = [];
  if (h.width !== STORE_SHOT.width) out.push(`width ${h.width}, not ${STORE_SHOT.width}`);
  if (h.height !== STORE_SHOT.height) out.push(`height ${h.height}, not ${STORE_SHOT.height}`);
  if (h.bitDepth !== STORE_SHOT.bitDepth) out.push(`bit depth ${h.bitDepth}, not ${STORE_SHOT.bitDepth}`);
  if (h.colourType !== STORE_SHOT.colourType) out.push(`colour type ${h.colourType} (${COLOUR_TYPES[h.colourType] ?? 'unknown'}), not ${STORE_SHOT.colourType} (${COLOUR_TYPES[STORE_SHOT.colourType]})`);
  if (h.chunks.includes('tRNS')) out.push('a tRNS chunk: the image carries transparency');
  return out;
}
