import {argon2idAsync} from '@noble/hashes/argon2.js';

/**
 * Known-answer tests for the vault's cryptographic primitives (spec §5). Each vector is copied
 * verbatim from its primary source, cited by URL above the vector, and exercised through the
 * exact WebCrypto/library call envelope.ts and kdf.ts use.
 */

const fromHex = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(s.match(/../g)!.map(b => parseInt(b, 16)));
const toHex = (b: Uint8Array): string => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const subtle = () => globalThis.crypto.subtle;

describe('Argon2id — RFC 9106 known-answer vector', () => {
  // https://www.rfc-editor.org/rfc/rfc9106.txt §5.3 "Argon2id Test Vectors"
  //   Argon2id version number 19
  //   Memory: 32 KiB, Passes: 3, Parallelism: 4 lanes, Tag length: 32 bytes
  //   Password[32]: 01 01 ... (32 bytes of 0x01)
  //   Salt[16]: 02 02 ... (16 bytes of 0x02)
  //   Secret[8]: 03 03 03 03 03 03 03 03
  //   Associated data[12]: 04 04 04 04 04 04 04 04 04 04 04 04
  //   Tag: 0d 64 0d f5 8d 78 76 6c 08 c0 37 a3 4a 8b 53 c9 d0
  //        1e f0 45 2d 75 b6 5e b5 25 20 e9 6b 01 e6 59
  const password = new Uint8Array(32).fill(0x01);
  const salt = new Uint8Array(16).fill(0x02);
  const key = new Uint8Array(8).fill(0x03);
  const personalization = new Uint8Array(12).fill(0x04);
  const expectedTag = '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659';

  it('matches the RFC 9106 §5.3 Argon2id tag', async () => {
    const tag = await argon2idAsync(password, salt, {m: 32, t: 3, p: 4, key, personalization, dkLen: 32, version: 0x13});
    expect(toHex(tag)).toBe(expectedTag);
  });
});

describe('AES-KW — RFC 3394 known-answer vectors', () => {
  async function wrap(kekBytes: Uint8Array<ArrayBuffer>, keyDataBytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const kek = await subtle().importKey('raw', kekBytes, 'AES-KW', false, ['wrapKey', 'unwrapKey']);
    const dk = await subtle().importKey('raw', keyDataBytes, 'AES-GCM', true, ['encrypt', 'decrypt']);
    return new Uint8Array(await subtle().wrapKey('raw', dk, kek, 'AES-KW'));
  }
  async function unwrap(kekBytes: Uint8Array<ArrayBuffer>, wrapped: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const kek = await subtle().importKey('raw', kekBytes, 'AES-KW', false, ['wrapKey', 'unwrapKey']);
    const dk = await subtle().unwrapKey('raw', wrapped, kek, 'AES-KW', 'AES-GCM', true, ['encrypt', 'decrypt']);
    return new Uint8Array(await subtle().exportKey('raw', dk));
  }

  it('§4.1 wraps 128 bits of key data with a 128-bit KEK', async () => {
    // https://www.rfc-editor.org/rfc/rfc3394.txt §4.1 "Wrap 128 bits of Key Data with a 128-bit KEK"
    //   KEK:       000102030405060708090A0B0C0D0E0F
    //   Key Data:  00112233445566778899AABBCCDDEEFF
    //   Ciphertext: 1FA68B0A8112B447 AEF34BD8FB5A7B82 9D3E862371D2CFE5
    const kek = fromHex('000102030405060708090A0B0C0D0E0F');
    const keyData = fromHex('00112233445566778899AABBCCDDEEFF');
    const expected = '1fa68b0a8112b447aef34bd8fb5a7b829d3e862371d2cfe5';
    const ct = await wrap(kek, keyData);
    expect(toHex(ct)).toBe(expected);
    expect(toHex(await unwrap(kek, ct))).toBe(toHex(keyData));
  });

  it('§4.6 wraps 256 bits of key data with a 256-bit KEK', async () => {
    // https://www.rfc-editor.org/rfc/rfc3394.txt §4.6 "Wrap 256 bits of Key Data with a 256-bit KEK"
    //   KEK:       000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F
    //   Key Data:  00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F
    //   Ciphertext: 28C9F404C4B810F4 CBCCB35CFB87F826 3F5786E2D80ED326
    //               CBC7F0E71A99F43B FB988B9B7A02DD21
    const kek = fromHex('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F');
    const keyData = fromHex('00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F');
    const expected = '28c9f404c4b810f4cbccb35cfb87f8263f5786e2d80ed326cbc7f0e71a99f43bfb988b9b7a02dd21';
    const ct = await wrap(kek, keyData);
    expect(toHex(ct)).toBe(expected);
    expect(toHex(await unwrap(kek, ct))).toBe(toHex(keyData));
  });
});

describe('HKDF-SHA-256 — RFC 5869 known-answer vector', () => {
  it('matches Appendix A.1 Test Case 1', async () => {
    // https://www.rfc-editor.org/rfc/rfc5869.txt Appendix A.1 "Test Case 1" (Basic test case with SHA-256)
    //   IKM  = 0x0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b (22 octets)
    //   salt = 0x000102030405060708090a0b0c (13 octets)
    //   info = 0xf0f1f2f3f4f5f6f7f8f9 (10 octets)
    //   L    = 42
    //   OKM  = 0x3cb25f25faacd57a90434f64d0362f2a
    //          2d2d0a90cf1a5a4c5db02d56ecc4c5bf
    //          34007208d5b887185865 (42 octets)
    const ikm = fromHex('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
    const salt = fromHex('000102030405060708090a0b0c');
    const info = fromHex('f0f1f2f3f4f5f6f7f8f9');
    const expectedOkm = '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865';

    const ikmKey = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const okm = new Uint8Array(await subtle().deriveBits({name: 'HKDF', hash: 'SHA-256', salt, info}, ikmKey, 42 * 8));
    expect(toHex(okm)).toBe(expectedOkm);
  });
});

describe('AES-256-GCM — NIST CAVP known-answer vector', () => {
  it('matches a 256-bit-key GCM encrypt/tag vector', async () => {
    // https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/mac/gcmtestvectors.zip
    // gcmEncryptExtIV256.rsp — [Keylen = 256] [IVlen = 96] [PTlen = 128] [AADlen = 128] [Taglen = 128], Count = 0
    //   Key = 92e11dcdaa866f5ce790fd24501f92509aacf4cb8b1339d50c9c1240935dd08b
    //   IV  = ac93a1a6145299bde902f21a
    //   PT  = 2d71bcfa914e4ac045b2aa60955fad24
    //   AAD = 1e0889016f67601c8ebea4943bc23ad6
    //   CT  = 8995ae2e6df3dbf96fac7b7137bae67f
    //   Tag = eca5aa77d51d4a0a14d9c51e1da474ab
    const key = fromHex('92e11dcdaa866f5ce790fd24501f92509aacf4cb8b1339d50c9c1240935dd08b');
    const iv = fromHex('ac93a1a6145299bde902f21a');
    const pt = fromHex('2d71bcfa914e4ac045b2aa60955fad24');
    const aad = fromHex('1e0889016f67601c8ebea4943bc23ad6');
    const expectedCt = '8995ae2e6df3dbf96fac7b7137bae67f';
    const expectedTag = 'eca5aa77d51d4a0a14d9c51e1da474ab';

    const cryptoKey = await subtle().importKey('raw', key, 'AES-GCM', false, ['encrypt']);
    const out = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv, additionalData: aad, tagLength: 128}, cryptoKey, pt));
    expect(toHex(out.slice(0, pt.length))).toBe(expectedCt);
    expect(toHex(out.slice(pt.length))).toBe(expectedTag);
  });
});
