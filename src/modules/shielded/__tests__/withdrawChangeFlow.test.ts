import {Keypair} from '@solana/web3.js';

// logState is referenced lazily inside the async getTransaction fn, so hoisting
// of the jest.mock factory is safe — the object is mutated before each call.
const logState: {logs: string[]} = {logs: []};
const leafInsertedLog = `Program data: ${Buffer.concat([
  Buffer.alloc(8),
  Buffer.alloc(32, 9),
  (() => { const b = Buffer.alloc(8); b.writeUInt32LE(7, 0); return b; })(),
  Buffer.alloc(32),
]).toString('base64')}`;

jest.mock('../merkleSync', () => ({syncLeaves: jest.fn()}));
jest.mock('../withdrawChangeWitness', () => ({
  buildWithdrawChangeWitness: jest.fn(() => ({
    params: {withdrawAmount: '200'},
    nullifier32: new Uint8Array(32).fill(2),
    merkleRoot32: new Uint8Array(32).fill(1),
    changeCommitment32: new Uint8Array(32).fill(9),
    changeCommitmentDec: '12345',
    changeAmount: 300n,
  })),
}));
jest.mock('../../zkProver/zkProverModule', () => ({
  proveShielded: jest.fn(async () => ({
    proofBytes: '00'.repeat(256),
    publicInputs: ['a', 'b', 'c', 'd', 'e', '12345'],
    proofData: '',
  })),
}));
jest.mock('../poolTx', () => ({submitPoolTxMany: jest.fn(async () => 'SIG')}));
jest.mock('../noteStore', () => ({markSpentByIndex: jest.fn(), addNote: jest.fn()}));
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({
    getTransaction: jest.fn(async () => ({meta: {err: null, logMessages: logState.logs}})),
  }),
}));
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({}),
  initSecureMmkv: jest.fn(),
}));

import {unshieldWithChange, MerkleRootStaleError} from '../withdrawFlow';
import {syncLeaves} from '../merkleSync';
import {markSpentByIndex, addNote} from '../noteStore';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const note: ShieldedNote = {
  commitment: 'c',
  nullifier: '',
  mint: MINT,
  amount: 500n,
  index: 0,
  spent: false,
  createdAt: 1,
  noteSecret: '9',
};
const feePayer = Keypair.generate();
const seed = new Uint8Array(32).fill(3);
const rootHex = '01'.repeat(32);

describe('unshieldWithChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logState.logs = [leafInsertedLog];
  });

  it('proves, submits, marks input spent, and stores the change note by its LeafInserted leaf_index', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: [rootHex]});
    const res = await unshieldWithChange(seed, feePayer, MINT, note, 200n);
    expect(res.withdrawn).toBe(200n);
    expect(res.change).toBe(300n);
    expect(addNote).toHaveBeenCalledWith(
      expect.objectContaining({
        commitment: '12345',
        mint: MINT,
        amount: 300n,
        index: 7,
        spent: false,
        noteSecret: expect.any(String),
      }),
    );
    expect(markSpentByIndex).toHaveBeenCalledWith(MINT, 0);
  });

  it('falls back to resync to locate the change leaf when the tx has no logs', async () => {
    const {decToHex64} = jest.requireActual('../fieldCodec') as typeof import('../fieldCodec');
    logState.logs = []; // no LeafInserted event in the tx
    (syncLeaves as jest.Mock)
      .mockResolvedValueOnce({leaves: ['c'], onChainRoots: [rootHex]}) // 1st: pre-prove sync
      .mockResolvedValueOnce({leaves: [decToHex64('12345')], onChainRoots: [rootHex]}); // 2nd: fallback finds change commitment at index 0
    const res = await unshieldWithChange(seed, feePayer, MINT, note, 200n);
    expect(res.change).toBe(300n);
    expect(addNote).toHaveBeenCalledWith(
      expect.objectContaining({commitment: '12345', index: 0}),
    );
    expect(markSpentByIndex).toHaveBeenCalledWith(MINT, 0);
  });

  it('throws MerkleRootStaleError before proving when the root is absent', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: ['ab'.repeat(32)]});
    await expect(
      unshieldWithChange(seed, feePayer, MINT, note, 200n),
    ).rejects.toBeInstanceOf(MerkleRootStaleError);
    expect(markSpentByIndex).not.toHaveBeenCalled();
  });
});
