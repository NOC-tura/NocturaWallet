/**
 * The pool's note count from the MerkleTree account, read from the committed devnet fixture
 * (Task 2's `devnet-tree-5URd.json`, slot 522620135). The expected count is the fixture's own
 * bytes 8..16 read as u64 LE by Node's Buffer — not by the code under test — and equals the 17
 * leaves Task 2 recorded.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import type {Connection} from '@solana/web3.js';
import {readA0PoolNoteCount} from '../poolSize';
import {A0} from '../constants';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
const {PublicKey} = jest.requireMock<typeof import('@solana/web3.js')>('@solana/web3.js');

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8')) as {
  account: {value: {data: [string, string]; owner: string}};
};
const DATA = Buffer.from(fixture.account.value.data[0], 'base64');

function fakeConnection(answer: {data: Uint8Array; owner: string} | null | 'throw') {
  const calls: {key: string; commitment: unknown}[] = [];
  const connection = {
    getAccountInfo: async (key: {toBase58: () => string}, commitment: unknown) => {
      calls.push({key: key.toBase58(), commitment});
      if (answer === 'throw') throw new Error('fetch failed');
      return answer && {data: Buffer.from(answer.data), owner: new PublicKey(answer.owner), lamports: 1, executable: false};
    },
  } as unknown as Connection;
  return {connection, calls};
}

it('reads the tree account 5URd… once and returns nextLeafIndex (= 17 in the fixture, read independently)', async () => {
  const independent = Number(DATA.readBigUInt64LE(8));
  expect(independent).toBe(17);
  const {connection, calls} = fakeConnection({data: DATA, owner: fixture.account.value.owner});
  expect(await readA0PoolNoteCount(connection)).toEqual({status: 'ok', count: independent});
  expect(calls).toEqual([{key: A0.merkleTree, commitment: 'confirmed'}]);
});

it('an account not owned by the pool program is "unavailable" (nobody else can write a tree there)', async () => {
  const {connection} = fakeConnection({data: DATA, owner: '11111111111111111111111111111111'});
  expect(await readA0PoolNoteCount(connection)).toEqual({status: 'unavailable'});
});

it('no account / an RPC failure is "unavailable"', async () => {
  expect(await readA0PoolNoteCount(fakeConnection(null).connection)).toEqual({status: 'unavailable'});
  expect(await readA0PoolNoteCount(fakeConnection('throw').connection)).toEqual({status: 'unavailable'});
});

it('a wrong layout is "incompatible", with the reason', async () => {
  const short = fakeConnection({data: DATA.subarray(0, 3000), owner: A0.programId});
  const r = await readA0PoolNoteCount(short.connection);
  expect(r.status).toBe('incompatible');
  expect(r.status === 'incompatible' && r.reason).toMatch(/E_A0_TREE_LAYOUT/);
});
