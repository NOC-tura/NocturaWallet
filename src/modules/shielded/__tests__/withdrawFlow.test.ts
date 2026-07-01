import {PublicKey, Keypair} from '@solana/web3.js';

jest.mock('../merkleSync', () => ({
  syncLeaves: jest.fn(),
}));
jest.mock('../withdrawWitness', () => ({
  buildWithdrawWitness: jest.fn(() => ({
    params: {merkleRoot: '5'},
    nullifier32: new Uint8Array(32).fill(2),
    merkleRoot32: new Uint8Array(32).fill(1),
  })),
}));
jest.mock('../../zkProver/zkProverModule', () => ({
  proveShielded: jest.fn(async () => ({proofBytes: '00'.repeat(256), publicInputs: [], proofData: ''})),
}));
jest.mock('../poolTx', () => ({submitPoolTxMany: jest.fn(async () => 'SIG123')}));
jest.mock('../noteStore', () => ({markSpentByIndex: jest.fn()}));
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({
    getTransaction: jest.fn(async () => ({meta: {err: null}})),
  }),
}));
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({}), initSecureMmkv: jest.fn(),
}));

import {unshield, MerkleRootStaleError} from '../withdrawFlow';
import {syncLeaves} from '../merkleSync';
import {markSpentByIndex} from '../noteStore';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const note: ShieldedNote = {commitment: 'c', nullifier: '', mint: MINT, amount: 200n, index: 0, spent: false, createdAt: 1, noteSecret: '9'};
const feePayer = Keypair.generate();
const seed = new Uint8Array(32).fill(3);

const rootHex = '01'.repeat(32);

describe('unshield', () => {
  beforeEach(() => jest.clearAllMocks());
  it('proves, submits, and marks the note spent when the root is on-chain', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: [rootHex]});
    const res = await unshield(seed, feePayer, MINT, note);
    expect(res.txSignature).toBe('SIG123');
    expect(res.amount).toBe(200n);
    expect(markSpentByIndex).toHaveBeenCalledWith(MINT, 0);
  });
  it('throws MerkleRootStaleError when the local root is absent from root_history', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: ['ab'.repeat(32)]});
    await expect(unshield(seed, feePayer, MINT, note)).rejects.toBeInstanceOf(MerkleRootStaleError);
    expect(markSpentByIndex).not.toHaveBeenCalled();
  });
});
