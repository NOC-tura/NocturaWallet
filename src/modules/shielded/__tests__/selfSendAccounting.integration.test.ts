// Reproduction: a self-send (transfer to your own noc1) must CONSERVE the local
// shielded balance. Models the exact note-store writes sendPrivateTransfer +
// scanIncomingNotes perform, using the REAL noteStore (in-memory mmkv) and REAL
// crypto — only the network + session are stubbed. If the balance inflates here,
// the accounting bug is reproduced.
const mockSecure = new Map<string, string>();
const mockPublic = new Map<string, string>();
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({
    getString: (k: string) => mockSecure.get(k),
    set: (k: string, v: string) => {
      mockSecure.set(k, v);
    },
    remove: (k: string) => {
      mockSecure.delete(k);
    },
  }),
  mmkvPublic: {
    getString: (k: string) => mockPublic.get(k),
    set: (k: string, v: string) => {
      mockPublic.set(k, v);
    },
    remove: (k: string) => {
      mockPublic.delete(k);
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

import {PublicKey} from '@solana/web3.js';
import {addNote, markSpentByCommitment, getBalance} from '../noteStore';
import {scanIncomingNotes} from '../noteScan';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';
import {getViewPublicKey, getPkRecipientHash} from '../shieldedIdentity';
import {encryptNote} from '../noteEncryption';
import {noteCommitment, mintHash} from '../noteCrypto';
import {decToHex64} from '../fieldCodec';

const MINT = 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe';
const mintBytes = new PublicKey(MINT).toBytes();
const SEED = new Uint8Array(64).fill(7);

const mH = mintHash(mintBytes);
const pkH = getPkRecipientHash(SEED);

function commitOf(amount: bigint, noteSecret: bigint): string {
  return noteCommitment({pkRecipientHash: pkH, amount, mintHash: mH, noteSecret}).toString();
}

function noteCiphertextLog(ct: Uint8Array, leafIndex: number): string {
  const buf = Buffer.alloc(8 + 8 + 4 + 128);
  buf.writeUInt32LE(leafIndex, 8);
  buf.writeUInt32LE(128, 8 + 8);
  Buffer.from(ct).copy(buf, 8 + 8 + 4);
  return `Program data: ${buf.toString('base64')}`;
}

function leafLog(commitmentHex: string, leafIndex: number): string {
  const buf = Buffer.alloc(8 + 32 + 8 + 32);
  Buffer.from(commitmentHex, 'hex').copy(buf, 8);
  buf.writeUInt32LE(leafIndex, 8 + 32);
  return `Program data: ${buf.toString('base64')}`;
}

describe('self-send conserves the local shielded balance', () => {
  beforeEach(() => {
    mockSecure.clear();
    mockPublic.clear();
    jest.clearAllMocks();
    mockGetShieldedViewSession.mockReturnValue({
      skView: deriveShieldedViewKey(SEED),
      pkH,
    });
  });

  // Input: one deposit note of 2300 at leaf 0. Self-send 500 → out_0=500 (self),
  // out_1(change)=1800 (self). transferFlow marks the input spent + stores the
  // change; the scan later discovers out_0 (and re-sees out_1, which must dedup).
  it('single 2300 note, send 500 → balance stays 2300 after the scan', async () => {
    const inSecret = 111n;
    const s0 = 770n; // recipient (self) out_0 secret
    const s1 = 880n; // change out_1 secret

    addNote({
      commitment: commitOf(2300n, inSecret),
      nullifier: '',
      mint: MINT,
      amount: 2300n,
      index: 0,
      spent: false,
      createdAt: 1,
      noteSecret: inSecret.toString(),
    });
    expect(getBalance(MINT)).toBe(2300n);

    // ── transferFlow local writes (self-send 500) ──
    const c0 = commitOf(500n, s0); // recipient = self (NOT stored by flow)
    const c1 = commitOf(1800n, s1); // change = self (stored by flow)
    addNote({
      commitment: c1,
      nullifier: '',
      mint: MINT,
      amount: 1800n,
      index: -1, // UNRESOLVED sentinel, as transferFlow may store
      spent: false,
      createdAt: 2,
      noteSecret: s1.toString(),
    });
    markSpentByCommitment(MINT, commitOf(2300n, inSecret));
    expect(getBalance(MINT)).toBe(1800n); // input spent, change stored

    // ── scan discovers the transfer's two output ciphertexts ──
    const ct0 = encryptNote(getViewPublicKey(SEED), 500n, s0);
    const ct1 = encryptNote(getViewPublicKey(SEED), 1800n, s1);
    mockGetSignatures.mockResolvedValueOnce([{signature: 'xfer', err: null}]);
    mockGetTransaction.mockResolvedValueOnce({
      meta: {
        err: null,
        logMessages: [
          noteCiphertextLog(ct0, 10),
          leafLog(decToHex64(c0), 10),
          noteCiphertextLog(ct1, 11),
          leafLog(decToHex64(c1), 11),
        ],
      },
    });

    const discovered = await scanIncomingNotes(MINT);

    // out_0 is new (+500); out_1 duplicates the stored change and must be skipped.
    expect(discovered).toBe(1);
    expect(getBalance(MINT)).toBe(2300n); // CONSERVED
  });

  // A second scan (e.g. another dashboard focus) must not re-add anything.
  it('re-scanning the same transfer does not inflate the balance', async () => {
    const inSecret = 111n;
    const s0 = 770n;
    const s1 = 880n;
    addNote({
      commitment: commitOf(2300n, inSecret), nullifier: '', mint: MINT,
      amount: 2300n, index: 0, spent: false, createdAt: 1, noteSecret: inSecret.toString(),
    });
    const c1 = commitOf(1800n, s1);
    addNote({
      commitment: c1, nullifier: '', mint: MINT, amount: 1800n, index: -1,
      spent: false, createdAt: 2, noteSecret: s1.toString(),
    });
    markSpentByCommitment(MINT, commitOf(2300n, inSecret));

    const ct0 = encryptNote(getViewPublicKey(SEED), 500n, s0);
    const ct1 = encryptNote(getViewPublicKey(SEED), 1800n, s1);
    const logs = [
      noteCiphertextLog(ct0, 10),
      leafLog(decToHex64(commitOf(500n, s0)), 10),
      noteCiphertextLog(ct1, 11),
      leafLog(decToHex64(c1), 11),
    ];
    // Two separate scans (cursor reset so the second re-reads the same tx).
    mockGetSignatures.mockResolvedValue([{signature: 'xfer', err: null}]);
    mockGetTransaction.mockResolvedValue({meta: {err: null, logMessages: logs}});

    await scanIncomingNotes(MINT);
    mockPublic.delete('noctura.noteScanCursor.' + MINT); // force re-scan
    await scanIncomingNotes(MINT);

    expect(getBalance(MINT)).toBe(2300n);
  });
});
