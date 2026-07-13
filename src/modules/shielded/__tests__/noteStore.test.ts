jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {
    ...actual,
    mmkvSecure: () => actual.mmkvPublic,
  };
});

import {getNotes, getBalance, selectNotes, addNote, hasNote, markSpent, markSpentByIndex, markSpentByCommitment, clearMint} from '../noteStore';
import type {ShieldedNote} from '../types';

const MINT = 'TestMint111111111111111111111111111111111111';

function makeNote(overrides: Partial<ShieldedNote> = {}): ShieldedNote {
  return {
    commitment: Math.random().toString(16).padStart(64, '0'),
    nullifier: Math.random().toString(16).padStart(64, '0'),
    mint: MINT,
    amount: 1_000_000n,
    index: 0,
    spent: false,
    createdAt: Date.now(),
    noteSecret: '',
    ...overrides,
  };
}

describe('noteStore', () => {
  beforeEach(() => {
    clearMint(MINT);
  });

  it('getNotes returns empty array when no notes exist', () => {
    expect(getNotes(MINT)).toEqual([]);
  });

  it('addNote persists and getNotes retrieves it', () => {
    const note = makeNote();
    addNote(note);
    const notes = getNotes(MINT);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.commitment).toBe(note.commitment);
    expect(notes[0]!.amount).toBe(1_000_000n);
  });

  it('addNote is idempotent by commitment (no double-count on re-add)', () => {
    const note = makeNote({commitment: 'c0ffee', amount: 500_000n});
    addNote(note);
    addNote({...note}); // rescan re-encounters the same commitment
    expect(getNotes(MINT)).toHaveLength(1);
    expect(getBalance(MINT)).toBe(500_000n);
  });

  it('does NOT re-add a SPENT note as unspent (balance-inflation regression #3)', () => {
    const note = makeNote({commitment: 'deadbeef', amount: 500_000n});
    addNote(note);
    markSpentByCommitment(MINT, 'deadbeef');
    expect(getBalance(MINT)).toBe(0n);
    // A full rescan re-encounters the note and tries to add it as unspent again.
    addNote(makeNote({commitment: 'deadbeef', amount: 500_000n, spent: false}));
    // It must NOT reappear as spendable.
    expect(getBalance(MINT)).toBe(0n);
    expect(getNotes(MINT)).toHaveLength(0); // still spent-filtered
  });

  it('hasNote is spent-INCLUSIVE (true for spent and unspent)', () => {
    const note = makeNote({commitment: 'abc123'});
    expect(hasNote(MINT, 'abc123')).toBe(false);
    addNote(note);
    expect(hasNote(MINT, 'abc123')).toBe(true);
    markSpentByCommitment(MINT, 'abc123');
    expect(getNotes(MINT)).toHaveLength(0); // filtered from getNotes
    expect(hasNote(MINT, 'abc123')).toBe(true); // but still known
  });

  it('getBalance sums all unspent note amounts', () => {
    addNote(makeNote({amount: 500_000n}));
    addNote(makeNote({amount: 300_000n}));
    expect(getBalance(MINT)).toBe(800_000n);
  });

  it('getBalance returns 0n when all notes are spent', () => {
    const note = makeNote();
    addNote(note);
    markSpent(MINT, [note.nullifier]);
    expect(getBalance(MINT)).toBe(0n);
  });

  it('selectNotes returns fewest notes covering amount+fee', () => {
    addNote(makeNote({amount: 100_000n}));
    addNote(makeNote({amount: 500_000n}));
    addNote(makeNote({amount: 200_000n}));
    const selected = selectNotes(MINT, 500_000n, 100_000n);
    expect(selected).toHaveLength(2);
    expect(selected[0]!.amount).toBe(500_000n);
    expect(selected[1]!.amount).toBe(200_000n);
  });

  it('selectNotes throws when insufficient balance', () => {
    addNote(makeNote({amount: 100_000n}));
    expect(() => selectNotes(MINT, 500_000n, 100_000n)).toThrow();
  });

  it('markSpent sets matching notes to spent=true', () => {
    const note = makeNote();
    addNote(note);
    markSpent(MINT, [note.nullifier]);
    const notes = getNotes(MINT);
    expect(notes).toHaveLength(0);
  });

  it('clearMint removes all notes for a given mint', () => {
    addNote(makeNote());
    addNote(makeNote());
    clearMint(MINT);
    expect(getNotes(MINT)).toEqual([]);
  });

  it('round-trips noteSecret through MMKV (de)serialization', () => {
    const mint = 'MintForSecretTest1111111111111111111111111';
    clearMint(mint);
    addNote({commitment: 'c1', nullifier: '', mint, amount: 5n, index: 0,
      spent: false, createdAt: 1, noteSecret: 'secret-123'});
    expect(getNotes(mint)[0]!.noteSecret).toBe('secret-123');
  });
});

const MINT_MBI = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';

describe('noteStore.markSpentByIndex', () => {
  beforeEach(() => {
    clearMint(MINT_MBI);
  });
  it('marks the note at the given leaf index spent (nullifier is empty)', () => {
    addNote({commitment: 'c0', nullifier: '', mint: MINT_MBI, amount: 100n, index: 0, spent: false, createdAt: 1, noteSecret: 's0'});
    addNote({commitment: 'c1', nullifier: '', mint: MINT_MBI, amount: 200n, index: 1, spent: false, createdAt: 2, noteSecret: 's1'});
    expect(getBalance(MINT_MBI)).toBe(300n);
    markSpentByIndex(MINT_MBI, 1);
    expect(getBalance(MINT_MBI)).toBe(100n);
    expect(getNotes(MINT_MBI).map(n => n.index)).toEqual([0]);
  });
});
