import {Keypair} from '@solana/web3.js';

// logState is referenced lazily inside the async getTransaction fn, so hoisting
// of the jest.mock factory is safe — the object is mutated before each call.
const logState: {logs: string[]} = {logs: []};
const POOL_ID = 'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES';
/** Wrap event lines in the pool program's invoke/success bracket, as the RPC returns them. */
const inPoolInvoke = (...lines: string[]): string[] => [
  `Program ${POOL_ID} invoke [1]`,
  ...lines,
  `Program ${POOL_ID} success`,
];
const leafInsertedLog = `Program data: ${Buffer.concat([
  Buffer.from('59f3d408d7bfbb98', 'hex'),
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
jest.mock('../noteStore', () => ({
  markSpentByIndex: jest.fn(),
  markSpentByCommitment: jest.fn(),
  setNoteIndex: jest.fn(),
  addNote: jest.fn(),
}));
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({
    getTransaction: jest.fn(async () => ({meta: {err: null, logMessages: logState.logs}})),
  }),
}));
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({}),
  initSecureMmkv: jest.fn(),
}));

const capturedW: {ciphertext?: Uint8Array} = {};
jest.mock('../poolInstructions', () => ({
  buildWithdrawWithChangeIx: jest.fn((p: {ciphertext: Uint8Array}) => {
    capturedW.ciphertext = p.ciphertext;
    return {};
  }),
  buildWithdrawIx: jest.fn(() => ({})),
}));

import {unshieldWithChange, MerkleRootStaleError} from '../withdrawFlow';
import {syncLeaves} from '../merkleSync';
import {buildWithdrawChangeWitness} from '../withdrawChangeWitness';
import {markSpentByCommitment, setNoteIndex, addNote} from '../noteStore';
import {tryDecryptNote} from '../noteEncryption';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';
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
    logState.logs = inPoolInvoke(leafInsertedLog);
  });

  it('proves, submits, marks input spent, stores the change note with a SENTINEL index when no LeafInserted commitment matches', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: [rootHex]});
    const res = await unshieldWithChange(seed, feePayer, MINT, note, 200n);
    expect(res.withdrawn).toBe(200n);
    expect(res.change).toBe(300n);
    expect(addNote).toHaveBeenCalledWith(
      expect.objectContaining({
        commitment: '12345',
        mint: MINT,
        amount: 300n,
        index: -1,
        spent: false,
        noteSecret: expect.any(String),
      }),
    );
    expect(markSpentByCommitment).toHaveBeenCalledWith(MINT, 'c');
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
    expect(markSpentByCommitment).toHaveBeenCalledWith(MINT, 'c');
  });

  it('resolves a sentinel input-note index from the synced leaves and backfills it', async () => {
    const {decToHex64} = jest.requireActual('../fieldCodec') as typeof import('../fieldCodec');
    // Input note stored with an unresolved index (-1); its commitment 'c' hashes
    // to decToHex64('...') — put that hex in the leaves at index 2.
    const cHex = decToHex64('777');
    const sentinelNote: ShieldedNote = {...note, commitment: '777', index: -1};
    (syncLeaves as jest.Mock).mockResolvedValue({
      leaves: ['x', 'y', cHex],
      onChainRoots: [rootHex],
    });
    await unshieldWithChange(seed, feePayer, MINT, sentinelNote, 200n);
    expect(setNoteIndex).toHaveBeenCalledWith(MINT, '777', 2);
    expect(markSpentByCommitment).toHaveBeenCalledWith(MINT, '777');
  });

  it('throws MerkleRootStaleError before proving when the root is absent', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: ['ab'.repeat(32)]});
    await expect(
      unshieldWithChange(seed, feePayer, MINT, note, 200n),
    ).rejects.toBeInstanceOf(MerkleRootStaleError);
    expect(markSpentByCommitment).not.toHaveBeenCalled();
  });

  it('emits a change-note memo that decrypts to the change amount + change secret', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: [rootHex]});
    await unshieldWithChange(seed, feePayer, MINT, note, 200n);
    expect(capturedW.ciphertext).toHaveLength(128);
    const dec = tryDecryptNote(deriveShieldedViewKey(seed), capturedW.ciphertext!);
    expect(dec).not.toBeNull();
    expect(dec!.amount).toBe(300n); // changeAmount from the mocked witness
    const stored = (addNote as jest.Mock).mock.calls[0][0];
    expect(dec!.noteSecret.toString()).toBe(stored.noteSecret);
  });

  it('emits a non-recoverable filler memo (not addNote) for a whole-note (0-change) unshield', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: [rootHex]});
    (buildWithdrawChangeWitness as jest.Mock).mockReturnValueOnce({
      params: {withdrawAmount: '500'},
      nullifier32: new Uint8Array(32).fill(2),
      merkleRoot32: new Uint8Array(32).fill(1),
      changeCommitment32: new Uint8Array(32).fill(9),
      changeCommitmentDec: '12345',
      changeAmount: 0n,
    });
    await unshieldWithChange(seed, feePayer, MINT, note, 500n);
    expect(capturedW.ciphertext).toHaveLength(128);
    const dec = tryDecryptNote(deriveShieldedViewKey(seed), capturedW.ciphertext!);
    expect(dec).toBeNull();
    expect(addNote).not.toHaveBeenCalled();
    expect(markSpentByCommitment).toHaveBeenCalledWith(MINT, 'c');
  });
});

describe('leafResolver — no guessing', () => {
  it('adopts the leaf index when the commitment MATCHES', async () => {
    // Same log, but the change commitment now equals the logged one.
    const matching = `Program data: ${Buffer.concat([
      Buffer.from('59f3d408d7bfbb98', 'hex'),
      Buffer.from('0909090909090909090909090909090909090909090909090909090909090909', 'hex'),
      (() => { const b = Buffer.alloc(8); b.writeUInt32LE(7, 0); return b; })(),
      Buffer.alloc(32),
    ]).toString('base64')}`;
    logState.logs = inPoolInvoke(matching);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {resolveLeafIndex} = jest.requireActual('../leafResolver');
    const idx = await resolveLeafIndex(
      'SIG',
      // 0x0909...09 as a decimal string
      BigInt('0x0909090909090909090909090909090909090909090909090909090909090909').toString(),
      MINT,
    );
    expect(idx).toBe(7);
  });
});
