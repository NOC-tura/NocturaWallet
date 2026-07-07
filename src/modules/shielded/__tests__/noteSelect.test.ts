import {selectBestFit, selectTransferInputs} from '../noteSelect';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const note = (amount: bigint, index: number): ShieldedNote => ({
  commitment: `c${index}`, nullifier: '', mint: MINT, amount, index, spent: false, createdAt: index, noteSecret: `s${index}`,
});

describe('noteSelect', () => {
  const notes = [note(100n, 0), note(300n, 1), note(200n, 2)];

  it('selectBestFit picks the SMALLEST note >= target', () => {
    expect(selectBestFit(notes, 150n)?.amount).toBe(200n); // smallest >= 150
    expect(selectBestFit(notes, 200n)?.amount).toBe(200n); // exact fit
    expect(selectBestFit(notes, 100n)?.amount).toBe(100n);
  });

  it('selectBestFit returns null when no note covers the target', () => {
    expect(selectBestFit(notes, 301n)).toBeNull();
  });

  it('selectBestFit on a tie returns a covering note of that amount', () => {
    const withTie = [note(200n, 0), note(200n, 1)];
    expect(selectBestFit(withTie, 150n)?.amount).toBe(200n);
  });
});

describe('selectTransferInputs', () => {
  const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
  const note2 = (amount: bigint, index: number): ShieldedNote => ({
    commitment: `c${index}`, nullifier: '', mint: MINT, amount, index, spent: false, createdAt: index, noteSecret: `s${index}`,
  });
  it('picks the smallest single note >= target when one exists', () => {
    const notes = [note2(100n, 0), note2(300n, 1), note2(200n, 2)];
    const sel = selectTransferInputs(notes, 150n);
    expect(sel!.map(n => n.amount)).toEqual([200n]);
  });
  it('picks the two largest notes when no single note covers the target', () => {
    const notes = [note2(100n, 0), note2(300n, 1), note2(200n, 2)];
    const sel = selectTransferInputs(notes, 450n); // 300+200 = 500 >= 450
    expect(sel!.map(n => n.amount).sort()).toEqual([200n, 300n]);
  });
  it('returns null when even the two largest cannot cover the target', () => {
    const notes = [note2(100n, 0), note2(300n, 1), note2(200n, 2)];
    expect(selectTransferInputs(notes, 600n)).toBeNull(); // max 2 = 500
  });
});
