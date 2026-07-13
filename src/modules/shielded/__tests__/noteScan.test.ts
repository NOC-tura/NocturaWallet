// ── Mocks (hoisted) ──────────────────────────────────────────────────────────
// Mirror merkleSync.test.ts's connection + mmkv mocks. Crypto (encryption,
// commitment, session, note store representation) is REAL so the round-trip is
// genuine; only the network + persistence + note store are stubbed.
const mockMmkvStore = new Map<string, string>();
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    getString: (k: string) => mockMmkvStore.get(k),
    set: (k: string, v: string) => {
      mockMmkvStore.set(k, v);
    },
    remove: (k: string) => {
      mockMmkvStore.delete(k);
    },
  },
}));

const mockGetSignatures = jest.fn();
const mockGetTransaction = jest.fn();
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({
    getSignaturesForAddress: mockGetSignatures,
    getTransaction: mockGetTransaction,
  }),
}));

const mockGetShieldedViewSession = jest.fn();
jest.mock('../shieldedViewSession', () => ({
  getShieldedViewSession: () => mockGetShieldedViewSession(),
}));

const mockGetNotes = jest.fn();
const mockAddNote = jest.fn();
jest.mock('../noteStore', () => ({
  // hasNote is spent-inclusive; mirror the test's mocked note set.
  hasNote: (mint: string, commitment: string) =>
    (mockGetNotes(mint) as Array<{commitment: string}>).some(
      n => n.commitment === commitment,
    ),
  addNote: (note: unknown) => mockAddNote(note),
}));

import {PublicKey} from '@solana/web3.js';
import {scanIncomingNotes} from '../noteScan';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';
import {getViewPublicKey, getPkRecipientHash} from '../shieldedIdentity';
import {encryptNote} from '../noteEncryption';
import {noteCommitment, mintHash} from '../noteCrypto';
import {decToHex64} from '../fieldCodec';

const MINT = 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe';
const mintBytes = new PublicKey(MINT).toBytes();

// Two distinct seeds → distinct view keys. `SEED` is "ours", `OTHER` is a foreign
// recipient whose ciphertext must not decrypt for us.
const SEED = new Uint8Array(64).fill(7);
const OTHER = new Uint8Array(64).fill(9);

// Build a NoteCiphertext Program-data log line:
// disc(8) + leaf_index(u64 LE, 8) + Vec len(u32 LE, 4)=128 + ciphertext(128) = 148 B.
function noteCiphertextLog(ct: Uint8Array, leafIndex: number): string {
  const buf = Buffer.alloc(8 + 8 + 4 + 128);
  buf.writeUInt32LE(leafIndex, 8);
  buf.writeUInt32LE(128, 8 + 8);
  Buffer.from(ct).copy(buf, 8 + 8 + 4);
  return `Program data: ${buf.toString('base64')}`;
}

// Build a LeafInserted Program-data log line:
// disc(8) + commitment[32] + leaf_index(u64 LE) + root[32] = 80 B.
function leafLog(commitmentHex: string, leafIndex: number): string {
  const buf = Buffer.alloc(8 + 32 + 8 + 32);
  Buffer.from(commitmentHex, 'hex').copy(buf, 8);
  buf.writeUInt32LE(leafIndex, 8 + 32);
  return `Program data: ${buf.toString('base64')}`;
}

const AMOUNT = 123_456n;
const NOTE_SECRET = 0x1234567890abcdefn;

/** Genuine ciphertext + matching commitment (hex) for a recipient seed at leafIndex. */
function craftNote(seed: Uint8Array, amount: bigint, noteSecret: bigint) {
  const ct = encryptNote(getViewPublicKey(seed), amount, noteSecret);
  const commit = noteCommitment({
    pkRecipientHash: getPkRecipientHash(seed),
    amount,
    mintHash: mintHash(mintBytes),
    noteSecret,
  });
  return {ct, commitmentDec: commit.toString(), commitmentHex: decToHex64(commit.toString())};
}

describe('scanIncomingNotes', () => {
  beforeEach(() => {
    mockMmkvStore.clear();
    jest.clearAllMocks();
    mockGetNotes.mockReturnValue([]);
    mockGetShieldedViewSession.mockReturnValue({
      skView: deriveShieldedViewKey(SEED),
      pkH: getPkRecipientHash(SEED),
    });
  });

  it('returns 0 without touching RPC when the session is locked', async () => {
    mockGetShieldedViewSession.mockReturnValue(null);
    const count = await scanIncomingNotes(MINT);
    expect(count).toBe(0);
    expect(mockGetSignatures).not.toHaveBeenCalled();
  });

  it('discovers a note encrypted to my key with a matching commitment', async () => {
    const {ct, commitmentDec, commitmentHex} = craftNote(SEED, AMOUNT, NOTE_SECRET);
    mockGetSignatures.mockResolvedValueOnce([{signature: 'sig1', err: null}]);
    mockGetTransaction.mockResolvedValueOnce({
      meta: {err: null, logMessages: [noteCiphertextLog(ct, 5), leafLog(commitmentHex, 5)]},
    });

    const count = await scanIncomingNotes(MINT);

    expect(count).toBe(1);
    expect(mockAddNote).toHaveBeenCalledTimes(1);
    expect(mockAddNote).toHaveBeenCalledWith(
      expect.objectContaining({
        commitment: commitmentDec,
        nullifier: '',
        mint: MINT,
        amount: AMOUNT,
        index: 5,
        spent: false,
        noteSecret: NOTE_SECRET.toString(),
      }),
    );
    // cursor persisted at the analogous key
    expect(mockMmkvStore.get('noctura.noteScanCursor.' + MINT)).toBe('sig1');
  });

  it('ignores a foreign ciphertext (encrypted to a different view key)', async () => {
    const {commitmentHex} = craftNote(OTHER, AMOUNT, NOTE_SECRET);
    const foreign = encryptNote(getViewPublicKey(OTHER), AMOUNT, NOTE_SECRET);
    mockGetSignatures.mockResolvedValueOnce([{signature: 'sig1', err: null}]);
    mockGetTransaction.mockResolvedValueOnce({
      meta: {err: null, logMessages: [noteCiphertextLog(foreign, 5), leafLog(commitmentHex, 5)]},
    });

    const count = await scanIncomingNotes(MINT);

    expect(count).toBe(0);
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('rejects a note whose recomputed commitment does not match the leaf (tamper guard)', async () => {
    const {ct} = craftNote(SEED, AMOUNT, NOTE_SECRET);
    // The on-chain LeafInserted commitment at this index is something ELSE.
    const wrongHex = (99n).toString(16).padStart(64, '0');
    mockGetSignatures.mockResolvedValueOnce([{signature: 'sig1', err: null}]);
    mockGetTransaction.mockResolvedValueOnce({
      meta: {err: null, logMessages: [noteCiphertextLog(ct, 5), leafLog(wrongHex, 5)]},
    });

    const count = await scanIncomingNotes(MINT);

    expect(count).toBe(0);
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('rejects a note when no LeafInserted commitment exists at that index', async () => {
    const {ct} = craftNote(SEED, AMOUNT, NOTE_SECRET);
    mockGetSignatures.mockResolvedValueOnce([{signature: 'sig1', err: null}]);
    mockGetTransaction.mockResolvedValueOnce({
      meta: {err: null, logMessages: [noteCiphertextLog(ct, 5)]}, // no leaf log
    });

    const count = await scanIncomingNotes(MINT);

    expect(count).toBe(0);
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('deduplicates against an already-known note (same commitment)', async () => {
    const {ct, commitmentDec, commitmentHex} = craftNote(SEED, AMOUNT, NOTE_SECRET);
    mockGetNotes.mockReturnValue([
      {
        commitment: commitmentDec,
        nullifier: '',
        mint: MINT,
        amount: AMOUNT,
        index: 5,
        spent: false,
        createdAt: 0,
        noteSecret: NOTE_SECRET.toString(),
      },
    ]);
    mockGetSignatures.mockResolvedValueOnce([{signature: 'sig1', err: null}]);
    mockGetTransaction.mockResolvedValueOnce({
      meta: {err: null, logMessages: [noteCiphertextLog(ct, 5), leafLog(commitmentHex, 5)]},
    });

    const count = await scanIncomingNotes(MINT);

    expect(count).toBe(0);
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('passes the cursor (until) from mmkv and advances it after a successful scan', async () => {
    mockMmkvStore.set('noctura.noteScanCursor.' + MINT, 'oldSig');
    const {ct, commitmentHex} = craftNote(SEED, AMOUNT, NOTE_SECRET);
    mockGetSignatures.mockResolvedValueOnce([{signature: 'newSig', err: null}]);
    mockGetTransaction.mockResolvedValueOnce({
      meta: {err: null, logMessages: [noteCiphertextLog(ct, 5), leafLog(commitmentHex, 5)]},
    });

    await scanIncomingNotes(MINT);

    expect(mockGetSignatures.mock.calls[0]![1].until).toBe('oldSig');
    expect(mockMmkvStore.get('noctura.noteScanCursor.' + MINT)).toBe('newSig');
  });

  it('never throws on a transient RPC error — returns count so far', async () => {
    mockGetSignatures.mockRejectedValueOnce(new Error('RPC timeout'));
    await expect(scanIncomingNotes(MINT)).resolves.toBe(0);
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('does not advance the cursor when there are no new signatures', async () => {
    mockMmkvStore.set('noctura.noteScanCursor.' + MINT, 'oldSig');
    mockGetSignatures.mockResolvedValueOnce([]);
    const count = await scanIncomingNotes(MINT);
    expect(count).toBe(0);
    expect(mockGetTransaction).not.toHaveBeenCalled();
    expect(mockMmkvStore.get('noctura.noteScanCursor.' + MINT)).toBe('oldSig');
  });
});
