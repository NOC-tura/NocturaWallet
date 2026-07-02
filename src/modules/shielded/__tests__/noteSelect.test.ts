import {selectBestFit} from '../noteSelect';
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
