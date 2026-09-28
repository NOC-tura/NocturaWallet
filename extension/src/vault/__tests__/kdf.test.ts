import {argon2idKdf} from '../kdf';

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

describe('argon2idKdf', () => {
  it('is deterministic and 32 bytes', async () => {
    const salt = new Uint8Array(16).fill(7);
    const a = await argon2idKdf('password', salt, {m: 64, t: 1, p: 1});
    const b = await argon2idKdf('password', salt, {m: 64, t: 1, p: 1});
    expect(a.length).toBe(32);
    expect(hex(a)).toBe(hex(b));
  });

  it('depends on every input', async () => {
    const salt = new Uint8Array(16).fill(7);
    const base = hex(await argon2idKdf('password', salt, {m: 64, t: 1, p: 1}));
    expect(hex(await argon2idKdf('passwore', salt, {m: 64, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', new Uint8Array(16).fill(8), {m: 64, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', salt, {m: 128, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', salt, {m: 64, t: 2, p: 1}))).not.toBe(base);
  });
});
