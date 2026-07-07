import * as fs from 'fs';
import * as path from 'path';
import {bls12_381} from '@noble/curves/bls12-381.js';
import {encryptNote, tryDecryptNote} from '../noteEncryption';

const G1 = bls12_381.G1.Point;
const VECTORS_PATH = path.join(__dirname, '../../../../docs/zk-contract/note-encryption-vectors.json');

function hex(b: Uint8Array): string {
  return Buffer.from(b).toString('hex');
}
function fromHex(h: string): Uint8Array {
  return Uint8Array.from(Buffer.from(h, 'hex'));
}
function bytesToBigIntBE(b: Uint8Array): bigint {
  let a = 0n;
  for (const x of b) a = (a << 8n) | BigInt(x);
  return a;
}
function pubOf(sk: Uint8Array): Uint8Array {
  return G1.BASE.multiply(bytesToBigIntBE(sk) % G1.Fn.ORDER).toBytes(true);
}

interface Vector {
  skViewHex: string; viewKeyG1Hex: string; rHex: string; nonceHex: string;
  amount: string; noteSecretHex: string; ciphertextHex: string;
}

// Deterministic inputs (fixed sk/r/nonce make the ciphertext reproducible).
const INPUTS = [
  {sk: new Uint8Array(32).fill(7), r: new Uint8Array(32).fill(3), nonce: new Uint8Array(24).fill(9), amount: 12345n, noteSecret: 999n},
  {sk: (() => {const s = new Uint8Array(32); s[31] = 1; s[0] = 2; return s;})(), r: (() => {const s = new Uint8Array(32); s[0] = 5; return s;})(), nonce: new Uint8Array(24).fill(1), amount: 0n, noteSecret: 18446744073709551616n},
];

function build(): Vector[] {
  return INPUTS.map(i => {
    const pub = pubOf(i.sk);
    const ct = encryptNote(pub, i.amount, i.noteSecret, {r: i.r, nonce: i.nonce});
    return {
      skViewHex: hex(i.sk), viewKeyG1Hex: hex(pub), rHex: hex(i.r), nonceHex: hex(i.nonce),
      amount: i.amount.toString(),
      noteSecretHex: (() => {const o = new Uint8Array(32); let x = i.noteSecret; for (let k = 31; k >= 0; k--) {o[k] = Number(x & 0xffn); x >>= 8n;} return hex(o);})(),
      ciphertextHex: hex(ct),
    };
  });
}

describe('noteEncryption golden vectors', () => {
  it('reproduces the committed vectors byte-for-byte (regenerate with GENERATE=1)', () => {
    const built = build();
    if (process.env.GENERATE === '1') {
      fs.writeFileSync(VECTORS_PATH, JSON.stringify(built, null, 2) + '\n');
    }
    const committed: Vector[] = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'));
    expect(built).toEqual(committed);
  });

  it('every committed vector decrypts back to its inputs', () => {
    const committed: Vector[] = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'));
    for (const v of committed) {
      const dec = tryDecryptNote(fromHex(v.skViewHex), fromHex(v.ciphertextHex));
      expect(dec).not.toBeNull();
      expect(dec!.amount.toString()).toBe(v.amount);
      expect(dec!.noteSecret).toBe(bytesToBigIntBE(fromHex(v.noteSecretHex)));
    }
  });
});
