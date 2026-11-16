/**
 * The deposit TRANSACTION the flow builds against the deposit that landed on devnet (3DR6F7oW…,
 * recorded once by scripts/a0-fixtures/fetch-devnet-tx.mjs, slot 520075903): given the landed
 * tx's own arguments, accounts, blockhash and ComputeBudget limit (1,400,000), the flow's
 * `buildA0DepositTransaction` compiles the WHOLE message the depositor signed, byte for byte, and
 * the recorded signature verifies over our bytes. With the app's limit (200,000) the message
 * differs in exactly the limit's four bytes. The landed instruction is read here at fixed offsets
 * of the §1 layout (an independent reader), never through the code under test.
 */
jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
jest.mock('react-native', () => ({NativeModules: {}, Platform: {OS: 'android', select: () => undefined}}));
import {readFileSync} from 'fs';
import {join} from 'path';
import {ed25519} from '@noble/curves/ed25519.js';
import {VersionedTransaction} from '@solana/web3.js';
import {buildA0DepositTransaction} from '../depositFlow';
import type {A0PreparedDeposit} from '../depositFlow';

const landed = JSON.parse(readFileSync(join(__dirname, 'fixtures/landed-deposit-3DR6F7oW.json'), 'utf8')) as {
  slot: number;
  result: {transaction: [string, string]};
};
const tx = VersionedTransaction.deserialize(Buffer.from(landed.result.transaction[0], 'base64'));
const keys = tx.message.staticAccountKeys.map(k => k.toBase58());
const ix = tx.message.compiledInstructions.find(i => keys[i.programIdIndex] === 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH')!;
const data = Buffer.from(ix.data);
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

/** The landed deposit as a prepared deposit (§1: disc | amount u64 LE | commitment | rho | u32 len | proof). */
const prepared: A0PreparedDeposit = {
  amount: data.readBigUInt64LE(8),
  commitment: hex(data.subarray(16, 48)),
  rho: hex(data.subarray(48, 80)),
  proof: Uint8Array.from(data.subarray(84, 340)),
  depositIndex: 0n,
  depositor: keys[ix.accountKeyIndexes[3]!]!,
  depositorTokenAccount: keys[ix.accountKeyIndexes[4]!]!,
  importedNotes: 0,
  foreignRhoHits: 0,
};

describe('the flow\'s deposit tx against the landed 3DR6F7oW…', () => {
  it('reads the fixture it expects (slot 520075903, a 340-byte deposit with a 256-byte proof)', () => {
    expect(landed.slot).toBe(520075903);
    expect(data).toHaveLength(340);
    expect(data.readUInt32LE(80)).toBe(256);
    expect(prepared.amount).toBe(1_000_000n);
  });

  it('with the landed limit (1,400,000) the WHOLE signed message is ours byte for byte; the signature verifies over it', () => {
    const ours = buildA0DepositTransaction(prepared, tx.message.recentBlockhash, 1_400_000);
    expect(ours.version).toBe('legacy');
    const bytes = ours.message.serialize();
    expect(hex(bytes)).toBe(hex(tx.message.serialize()));
    expect(ed25519.verify(Uint8Array.from(tx.signatures[0]!), bytes, ours.message.staticAccountKeys[0]!.toBytes())).toBe(true);
  });

  it('with the app\'s limit (200,000) the message differs only inside the limit u32 (3 bytes: its high byte is 0 in both)', () => {
    const a = buildA0DepositTransaction(prepared, tx.message.recentBlockhash).message.serialize();
    const b = tx.message.serialize();
    expect(a).toHaveLength(b.length);
    const diff = [...a].flatMap((x, i) => (x === b[i] ? [] : [i]));
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toHaveLength(3); // 40 0d 03 00 vs c0 5c 15 00: the high byte is 0 in both
    const at = Buffer.from(a).indexOf(Buffer.from([2, 0x40, 0x0d, 0x03, 0x00]));
    expect(at).toBeGreaterThan(0);
    expect(diff.every(i => i > at && i <= at + 4)).toBe(true);
    expect(Buffer.from(b).subarray(at, at + 5)).toEqual(Buffer.from([2, 0xc0, 0x5c, 0x15, 0x00])); // 1,400,000 = 0x155cc0, LE
  });

  it('negative control: one amount unit more and the message no longer matches', () => {
    const off = buildA0DepositTransaction({...prepared, amount: prepared.amount + 1n}, tx.message.recentBlockhash, 1_400_000);
    expect(hex(off.message.serialize())).not.toBe(hex(tx.message.serialize()));
  });
});
