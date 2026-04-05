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

import {getNotes, getBalance, selectNotes, addNote, markSpent, clearMint} from '../noteStore';
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
});
