/**
 * The test fake of the native A0 core is only as good as its values: before any recovery suite
 * leans on it, every value it computes is held to the committed OFFLINE vector file
 * (native/noctura-prover/tests/fixtures/a0-key-vectors.json, written by
 * scripts/a0-vectors/gen-key-vectors.mjs — the same file the Rust core is held to). A fake that
 * agreed only with the code under test would make recovery's tests agree by construction.
 */
import {
  KEY_VECTORS,
  OTHER_SEED,
  TEST_SEED,
  createFakeProverNative,
  offlineKeys,
  seedBytes,
} from '../__testing__/offlineA0';

describe('the offline equations equal every row of a0-key-vectors.json', () => {
  it.each(KEY_VECTORS.seeds.map(s => [s.label, s] as const))('%s', (_label, seed) => {
    const k = offlineKeys(seed);
    expect(k.dSelf.toString(16).padStart(64, '0')).toBe(seed.dSelf);
    expect(k.addrSelf.toString(16).padStart(64, '0')).toBe(seed.addrSelf);
    expect(seed.notes.length).toBeGreaterThanOrEqual(5);
    for (const n of seed.notes) {
      expect(k.rho(BigInt(n.depositIndex))).toBe(n.rho);
      expect(k.nullifier(n.rho)).toBe(n.nullifier);
      expect(k.rhoChange(n.nullifier)).toBe(n.rhoChange);
      for (const c of n.commitments) {
        expect(k.commitment(BigInt(c.amount), n.rho)).toBe(c.commitment);
      }
    }
  });

  it('negative control: another seed\'s keys do not reproduce the test seed\'s rows', () => {
    const other = offlineKeys(OTHER_SEED);
    const n = TEST_SEED.notes[0]!;
    expect(other.rho(0n)).not.toBe(n.rho);
    expect(other.nullifier(n.rho)).not.toBe(n.nullifier);
    expect(other.commitment(1n, n.rho)).not.toBe(n.commitments[1]!.commitment);
  });
});

describe('the fake native module follows the core\'s contract', () => {
  it('opens by the vector seed, answers with the offline values, and refuses a stale handle', async () => {
    const f = createFakeProverNative();
    const h = await f.keysOpen(Array.from(seedBytes(TEST_SEED)));
    expect(await f.depositRho(h, '0')).toBe(TEST_SEED.notes[0]!.rho);
    expect(await f.commitment(h, '1', TEST_SEED.notes[0]!.rho)).toBe(TEST_SEED.notes[0]!.commitments[1]!.commitment);
    const n1 = TEST_SEED.notes[1]!;
    expect(await f.matchSpent(h, [n1.nullifier, n1.nullifier, OTHER_SEED.notes[0]!.nullifier], [TEST_SEED.notes[0]!.rho, n1.rho])).toEqual([1]);
    await f.keysClose(h);
    await expect(f.depositRho(h, '0')).rejects.toMatchObject({code: 'E_A0_UNKNOWN_HANDLE'});
    await expect(f.keysClose(h)).rejects.toMatchObject({code: 'E_A0_UNKNOWN_HANDLE'});
  });

  it('a second keysOpen replaces the first; a repeated own rho and a non-canonical value refuse', async () => {
    const f = createFakeProverNative();
    const a = await f.keysOpen(Array.from(seedBytes(TEST_SEED)));
    const b = await f.keysOpen(Array.from(seedBytes(OTHER_SEED)));
    await expect(f.depositRho(a, '0')).rejects.toMatchObject({code: 'E_A0_UNKNOWN_HANDLE'});
    expect(await f.depositRho(b, '0')).toBe(OTHER_SEED.notes[0]!.rho);
    const r = OTHER_SEED.notes[0]!.rho;
    await expect(f.matchSpent(b, [], [r, r])).rejects.toMatchObject({code: 'E_A0_DUPLICATE_RHO'});
    await expect(f.commitment(b, '1', 'ff'.repeat(32))).rejects.toMatchObject({code: 'E_A0_NON_CANONICAL'});
    await expect(f.depositRho(b, '01')).rejects.toMatchObject({code: 'E_A0_NOT_U64'});
  });
});
