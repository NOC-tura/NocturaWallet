import {decToBe32, be32ToDec, hexToDec, decToHex64, hexToBytes, bytesToHex} from '../fieldCodec';

describe('fieldCodec', () => {
  it('decToBe32 is big-endian, 32 bytes', () => {
    const b = decToBe32('1');
    expect(b.length).toBe(32);
    expect(b[31]).toBe(1);
    expect(b[0]).toBe(0);
  });
  it('be32ToDec round-trips decToBe32', () => {
    const dec = '123456789012345678901234567890';
    expect(be32ToDec(decToBe32(dec))).toBe(dec);
  });
  it('hexToDec and decToHex64 round-trip', () => {
    const dec = '255';
    expect(decToHex64(dec)).toBe('00'.repeat(31) + 'ff');
    expect(hexToDec('ff')).toBe('255');
  });
  it('hexToBytes and bytesToHex round-trip', () => {
    const hex = 'deadbeef';
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });
});
