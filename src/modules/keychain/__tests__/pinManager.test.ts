import {hashPin, verifyPin, generateSalt, PIN_ITERATIONS} from '../pinManager';

jest.setTimeout(60_000); // PBKDF2 600K iterations is slow by design

describe('pinManager', () => {
  it('PIN_ITERATIONS is 600000 (OWASP 2024)', () => {
    expect(PIN_ITERATIONS).toBe(600_000);
  });

  it('generates a 32-byte random salt', () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(32);
  });

  it('generates different salts each time', () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    expect(Buffer.from(s1).equals(Buffer.from(s2))).toBe(false);
  });

  it('hashes a PIN to a 64-byte derived key', async () => {
    const salt = generateSalt();
    const hash = await hashPin('123456', salt);
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(64);
  });

  it('same PIN + salt produces same hash (deterministic)', async () => {
    const salt = generateSalt();
    const h1 = await hashPin('123456', salt);
    const h2 = await hashPin('123456', salt);
    expect(Buffer.from(h1).equals(Buffer.from(h2))).toBe(true);
  });

  it('different PINs produce different hashes', async () => {
    const salt = generateSalt();
    const h1 = await hashPin('123456', salt);
    const h2 = await hashPin('654321', salt);
    expect(Buffer.from(h1).equals(Buffer.from(h2))).toBe(false);
  });

  it('different salts produce different hashes', async () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    const h1 = await hashPin('123456', s1);
    const h2 = await hashPin('123456', s2);
    expect(Buffer.from(h1).equals(Buffer.from(h2))).toBe(false);
  });

  it('verifyPin returns true for correct PIN', async () => {
    const salt = generateSalt();
    const hash = await hashPin('123456', salt);
    expect(await verifyPin('123456', salt, hash)).toBe(true);
  });

  it('verifyPin returns false for wrong PIN', async () => {
    const salt = generateSalt();
    const hash = await hashPin('123456', salt);
    expect(await verifyPin('000000', salt, hash)).toBe(false);
  });
});
