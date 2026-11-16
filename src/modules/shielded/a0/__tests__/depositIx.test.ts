/* eslint-disable no-bitwise -- byte-level encoding is what this file is about */
/**
 * The A0 deposit builder's own rules (spec §1 layout; CLAUDE.md: integer amounts as BigInt,
 * u64 encoded by hand — Hermes' Buffer polyfill has no writeBigUInt64LE). The landed-tx golden
 * is depositIx.golden.test.ts; this file holds the encoding edges and the refusals.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
import {PublicKey} from '@solana/web3.js';

import {A0_IX_DISCRIMINATOR} from '../constants';
import {buildA0DepositIx, encodeA0DepositData} from '../depositIx';
import type {A0DepositArgs} from '../depositIx';

/** BN254 scalar field r — written out here, not imported from the code under test. */
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const be32 = (v: bigint): Uint8Array => Uint8Array.from(Buffer.from(v.toString(16).padStart(64, '0'), 'hex'));
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

const ARGS: A0DepositArgs = {
  amount: 1n,
  commitment: be32(5n),
  rho: be32(7n),
  proof: new Uint8Array(256).fill(9),
};
const ACCOUNTS = {
  depositor: new PublicKey('GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd'),
  depositorTokenAccount: new PublicKey('9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn'),
};

describe('encodeA0DepositData', () => {
  it('lays out disc | amount u64 LE | commitment | rho | u32 LE 256 | proof (340 bytes)', () => {
    const d = encodeA0DepositData({...ARGS, amount: 0x0102030405060708n});
    expect(d.length).toBe(340);
    expect(hex(d.subarray(0, 8))).toBe(A0_IX_DISCRIMINATOR.deposit);
    expect(hex(d.subarray(8, 16))).toBe('0807060504030201');
    expect(hex(d.subarray(16, 48))).toBe(hex(ARGS.commitment));
    expect(hex(d.subarray(48, 80))).toBe(hex(ARGS.rho));
    expect(hex(d.subarray(80, 84))).toBe('00010000');
    expect(hex(d.subarray(84))).toBe(hex(ARGS.proof));
  });

  it.each([
    [1n, '0100000000000000'],
    [(1n << 64n) - 1n, 'ffffffffffffffff'],
    [1n << 63n, '0000000000000080'],
  ])('u64 %p → %s', (amount, want) => {
    expect(hex(encodeA0DepositData({...ARGS, amount}).subarray(8, 16))).toBe(want);
  });

  it('accepts the largest canonical field element (r − 1) as commitment and rho', () => {
    expect(() => encodeA0DepositData({...ARGS, commitment: be32(R - 1n), rho: be32(R - 1n)})).not.toThrow();
  });

  it.each([
    ['amount 0', {...ARGS, amount: 0n}, /amount must be in 1\.\.2\^64-1/],
    ['amount 2^64', {...ARGS, amount: 1n << 64n}, /amount must be in 1\.\.2\^64-1/],
    ['amount −1', {...ARGS, amount: -1n}, /amount must be in 1\.\.2\^64-1/],
    ['commitment 31 bytes', {...ARGS, commitment: new Uint8Array(31)}, /commitment must be 32 bytes, got 31/],
    ['rho 33 bytes', {...ARGS, rho: new Uint8Array(33)}, /rho must be 32 bytes, got 33/],
    ['proof 255 bytes', {...ARGS, proof: new Uint8Array(255)}, /proof must be 256 bytes, got 255/],
    ['proof 257 bytes', {...ARGS, proof: new Uint8Array(257)}, /proof must be 256 bytes, got 257/],
    ['rho = r', {...ARGS, rho: be32(R)}, /rho is not a canonical field element/],
    ['commitment = r', {...ARGS, commitment: be32(R)}, /commitment is not a canonical field element/],
    ['rho = 2^256 − 1', {...ARGS, rho: new Uint8Array(32).fill(0xff)}, /rho is not a canonical field element/],
  ])('refuses %s', (_label, args, re) => {
    expect(() => encodeA0DepositData(args)).toThrow(re);
    expect(() => buildA0DepositIx(args, ACCOUNTS)).toThrow(re);
  });

  it('copies its inputs: changing the caller’s arrays afterwards does not change the data', () => {
    const rho = be32(7n);
    const d = encodeA0DepositData({...ARGS, rho});
    rho[31] = 8;
    expect(d[79]).toBe(7);
  });
});

describe('the source never uses Buffer#writeBigUInt64LE (absent from Hermes’ Buffer polyfill)', () => {
  it('depositIx.ts encodes u64 by hand', () => {
    const src = readFileSync(join(__dirname, '..', 'depositIx.ts'), 'utf8');
    expect(src).not.toMatch(/writeBigU?Int64/);
    expect(src).not.toMatch(/readBigU?Int64/);
  });
});
