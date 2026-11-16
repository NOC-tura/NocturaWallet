/* eslint-disable no-bitwise -- byte edits of a recorded account */
/**
 * The A0 MerkleTree account 5URd… (spec §1 "3352 bytes: nextLeafIndex @8, zeros @16,
 * filledSubtrees @656, rootHistory @1296, rootHistoryHead @3344; depth 20, history 64"; §9
 * "zeros / emptyRoot are computed by the wallet and compared with the account's zeros @16").
 *
 * The bytes are the real account, recorded ONCE from devnet by
 * scripts/a0-fixtures/record-devnet-tree.mjs (slot pinned below, digest pinned below). Our values
 * come from `fieldEquations.emptySubtreeRoots` (M1a, held to the a0 golden vectors); the program
 * side's published empty root is a second, independent target.
 */
import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';
import {A0_MERKLE_TREE} from '../constants';
import {emptySubtreeRoots, toBe32Hex} from '../fieldEquations';
import {parseA0TreeAccount} from '../treeAccount';

const FIXTURE = join(__dirname, 'fixtures/devnet-tree-5URd.json');
const raw = readFileSync(FIXTURE);
const fixture = JSON.parse(raw.toString('utf8')) as {
  schema: string;
  genesisHash: string;
  tree: string;
  account: {context: {slot: number}; value: {data: [string, string]; owner: string; space: number}};
};
const bytes = () => Uint8Array.from(Buffer.from(fixture.account.value.data[0], 'base64'));

/** devnet-a0-deployed-contract.json `emptyRoot` (program side, read from the account and recomputed there). */
const PROGRAM_SIDE_EMPTY_ROOT = '2134e76ac5d21aab186c2be1dd8f84ee880a1e46eaf712f9d371b6df22191f3e';

describe('the recorded tree fixture', () => {
  it('is the recording this plan pinned (devnet, 5URd…, slot 522620135)', () => {
    expect(createHash('sha256').update(raw).digest('hex')).toBe(
      'e81d69413fbd148f426b5a5ff5333858bf4325aa82d5702252baaaf1349a6d98',
    );
    expect(fixture.schema).toBe('noctura.a0.devnet-tree-fixture/1');
    expect(fixture.genesisHash).toBe('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
    expect(fixture.tree).toBe('5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc');
    expect(fixture.account.context.slot).toBe(522620135);
    expect(fixture.account.value.owner).toBe('FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH');
    expect(fixture.account.value.space).toBe(3352);
  });
});

describe('parseA0TreeAccount on the real account', () => {
  const acc = parseA0TreeAccount(bytes());
  const z = emptySubtreeRoots(20);

  it('reads 17 leaves and the head at 17', () => {
    expect(acc.nextLeafIndex).toBe(17);
    expect(acc.rootHistoryHead).toBe(17);
    expect(acc.zeros).toHaveLength(20);
    expect(acc.filledSubtrees).toHaveLength(20);
    expect(acc.rootHistory).toHaveLength(64);
  });

  it("our zeros equal the account's zeros @16, all twenty (zeros[0] is the zero leaf)", () => {
    expect(acc.zeros).toEqual(z.slice(0, 20).map(toBe32Hex));
    expect(acc.zeros[0]).toBe('0'.repeat(64));
  });

  it('our empty root (one level above zeros[19]) = the program side\'s = the ring\'s first root', () => {
    expect(toBe32Hex(z[20]!)).toBe(PROGRAM_SIDE_EMPTY_ROOT);
    expect(acc.rootHistory[0]).toBe(PROGRAM_SIDE_EMPTY_ROOT);
  });

  it('the ring past the head is still empty (17 inserts, never wrapped)', () => {
    expect(acc.rootHistory.slice(18).every(r => r === '0'.repeat(64))).toBe(true);
    expect(acc.rootHistory.slice(1, 18).every(r => r !== '0'.repeat(64))).toBe(true);
  });
});

describe('parseA0TreeAccount refuses what it does not parse', () => {
  const layout = (data: Uint8Array) => () => parseA0TreeAccount(data);

  it('one byte short / one byte long', () => {
    expect(layout(bytes().subarray(0, 3351))).toThrow(/E_A0_TREE_LAYOUT: .*3351 bytes/);
    expect(layout(Uint8Array.from([...bytes(), 0]))).toThrow(/E_A0_TREE_LAYOUT: .*3353 bytes/);
  });

  it('another account discriminator', () => {
    const b = bytes();
    b[0] ^= 1;
    expect(layout(b)).toThrow(/E_A0_TREE_LAYOUT: account discriminator 633333e2a21449d4/);
  });

  it('a head outside the ring', () => {
    const b = bytes();
    b[A0_MERKLE_TREE.offsets.rootHistoryHead] = 64;
    expect(layout(b)).toThrow(/E_A0_TREE_LAYOUT: rootHistoryHead 64/);
  });

  it('a leaf count beyond 2^20', () => {
    const b = bytes();
    b.fill(0, 8, 16);
    b[8 + 2] = 0x10; // 2^20
    expect(parseA0TreeAccount(b).nextLeafIndex).toBe(1 << 20); // the full tree is still a tree
    b[8] = 1; // 2^20 + 1
    expect(layout(b)).toThrow(/E_A0_TREE_LAYOUT: nextLeafIndex 1048577/);
  });
});
