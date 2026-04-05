jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

import {
  encodeShieldedAddress,
  decodeShieldedAddress,
  isValidShieldedAddress,
  formatShieldedAddress,
} from '../shieldedAddressCodec';

describe('shieldedAddressCodec', () => {
  const validPk = new Uint8Array(48).fill(0xab);

  it('round-trips encode → decode', () => {
    const encoded = encodeShieldedAddress(validPk);
    const decoded = decodeShieldedAddress(encoded);
    expect(decoded).toEqual(validPk);
  });

  it('encodeShieldedAddress returns string starting with noc1', () => {
    const encoded = encodeShieldedAddress(validPk);
    expect(encoded.startsWith('noc1')).toBe(true);
  });

  it('decodeShieldedAddress throws for wrong HRP', () => {
    expect(() => decodeShieldedAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toThrow(
      'Invalid private address',
    );
  });

  it('decodeShieldedAddress throws for invalid checksum', () => {
    const encoded = encodeShieldedAddress(validPk);
    const corrupted = encoded.slice(0, -1) + 'x';
    expect(() => decodeShieldedAddress(corrupted)).toThrow('Invalid private address');
  });

  it('decodeShieldedAddress throws for wrong data length', () => {
    const shortPk = new Uint8Array(32).fill(0xcd);
    const {bech32m} = require('@scure/base');
    const words = bech32m.toWords(shortPk);
    const shortAddr = bech32m.encode('noc', words, 90);
    expect(() => decodeShieldedAddress(shortAddr)).toThrow('Invalid private address');
  });

  it('isValidShieldedAddress returns true for valid, false for invalid', () => {
    const encoded = encodeShieldedAddress(validPk);
    expect(isValidShieldedAddress(encoded)).toBe(true);
    expect(isValidShieldedAddress('noc1invalid')).toBe(false);
    expect(isValidShieldedAddress('not-an-address')).toBe(false);
  });

  it('formatShieldedAddress truncates correctly', () => {
    const encoded = encodeShieldedAddress(validPk);
    const formatted = formatShieldedAddress(encoded);
    expect(formatted).toMatch(/^noc1.{4}\.\.\..{4}$/);
    expect(formatted.length).toBe(15);
  });
});
