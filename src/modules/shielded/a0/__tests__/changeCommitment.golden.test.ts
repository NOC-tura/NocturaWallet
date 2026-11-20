/**
 * The change note's equations against the program side's circuit-validated golden vectors (spec §3
 * "Change note", §7 "Change notes", §15 "a golden changeCommitment row with its inputs"; the M1c
 * brief's update R6′).
 *
 * THE SOURCE — fixtures/change-commitment-golden.json, a BYTE COPY of the program side's
 * docs/zk-contract/change-commitment-golden.json at their commit 2146368 (written by their
 * zk/scripts/gen-change-commitment-golden.mjs; each vector's witness accepted by the
 * withdraw_change circuit, a Groth16 proof from the published keys/v2 zkey verifying with
 * publicSignals[5] == changeCommitment, and three wrong commitments rejected). Pinned below by its
 * sha256. Its own header: "COMPUTE every step from the spec and COMPARE; do not read these into a
 * builder" — so nothing here feeds a golden value into the code under test as an expected input
 * of a builder; every step is COMPUTED by our code from the vector's `in` and compared with the
 * vector's `steps` / `changeCommitment`.
 *
 * WHAT IS OURS, AND HOW EACH PIECE IS HELD:
 *   - `a0ChangeRho` (recovery.ts — the one change equation computed in JS, on a public
 *     nullifier) and `a0ChangeAmount`: against every vector's `rho_change` / `changeAmount`;
 *   - the frozen equations of `fieldEquations.ts` (`nullifier`, `addrField`, `commitment`): every
 *     step and the change commitment. `fieldEquations.ts` is what the offline key-vector generator
 *     (`scripts/a0-vectors/gen-key-vectors.mjs`) computes `a0-key-vectors.json` with, and the Rust
 *     core is held to that file (`keys_match_the_offline_vectors_for_every_fixture_seed`: nullifier,
 *     rhoChange, commitment for 25 notes) — so this file closes the chain golden → JS equations →
 *     key vectors → Rust without a Rust change;
 *   - the offline fake of the native core (`offlineA0.ts`, under every recovery suite): its
 *     `rhoChange` against every vector, so the change-note recovery tests built on the fake
 *     inherit the golden composition;
 *   - our pinned `mintHash` (`A0_MINT_HASH`, and the key vectors' `constants.mintHash`): equal to the
 *     A0-mint vectors' `in.mintHash`.
 * The Rust bridge cannot be given these vectors' `nk` / `change_d`: `keysOpen` takes a seed, and
 * every own note uses `change_d = d_self` (R9). That is the stated reason the Rust half is held
 * through the key vectors, not here.
 *
 * NEGATIVE CONTROLS: the same comparison is shown to fail for the three wrong commitments the
 * program side rejects (amount + 1, j = 1, d_in instead of change_d), so a pass is not vacuous.
 */
import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';
import {addrField, commitment, nullifier, rhoOut, toBe32Hex} from '../fieldEquations';
import {a0ChangeAmount, a0ChangeRho} from '../recovery';
import {A0_MINT_HASH} from '../depositFlow';
import {KEY_VECTORS, OfflineA0Keys} from '../__testing__/offlineA0';

interface Fe {
  dec: string;
  hexBE32: string;
}
interface ChangeVector {
  label: string;
  in: {
    nk: Fe;
    d_in: Fe;
    change_d: Fe;
    rho_in: Fe;
    inputAmount: string;
    withdrawAmount: string;
    fee: string;
    mintHash: Fe;
    recipientField: Fe;
  };
  steps: {changeAmount: string; nullifier_in: Fe; rho_change: Fe; addrField_self: Fe};
  changeCommitment: Fe;
  context: {inputCommitment: Fe; merkleRootLeafAtIndex0: Fe};
}

const RAW = readFileSync(join(__dirname, 'fixtures/change-commitment-golden.json'));
const GOLDEN = JSON.parse(RAW.toString('utf8')) as {schema: string; equations: Record<string, string>; vectors: ChangeVector[]};
const ZK_GOLDEN = JSON.parse(readFileSync(join(__dirname, 'golden-vectors.json'), 'utf8')) as {
  publicInputVectors: {withdraw_change: {name: string; hexBE32: string}[]};
};

const fe = (v: Fe): bigint => {
  const n = BigInt(v.dec);
  expect(toBe32Hex(n)).toBe(v.hexBE32); // the vector's two encodings agree
  return n;
};
const hex = (n: bigint): string => toBe32Hex(n);

describe('the fixture', () => {
  it('is the byte copy of the program side\'s file at 2146368 (sha256 pinned), schema 1, three vectors', () => {
    expect(createHash('sha256').update(RAW).digest('hex')).toBe(
      'e56160c0ea8e2c8b2ad1f10b93f72ab82ffb8856685d8cb937e78af539068198',
    );
    expect(GOLDEN.schema).toBe('noctura.zk.change-commitment-golden/1');
    expect(GOLDEN.vectors.map(v => v.label)).toEqual(['golden_vectors_withdraw_change', 'a0_devnet_mint_relayed', 'zero_change']);
  });

  it('states the equations of our §3 (their names, our tags and argument order)', () => {
    expect(GOLDEN.equations).toEqual({
      changeAmount: 'inputAmount - withdrawAmount - fee',
      nullifier_in: 'Poseidon3(TAG_NULL=0x11, nk, rho_in)',
      rho_change: 'Poseidon3(TAG_RHO=0x13, nullifier_in, 0)',
      addrField_self: 'Poseidon3(TAG_ADDR=0x12, nk, change_d)',
      changeCommitment: 'Poseidon5(TAG_CM=0x10, addrField_self, changeAmount, mintHash, rho_change)',
    });
  });

  it('its first vector IS the zk golden file\'s withdraw_change public-input case (changeCommitment 124709b8…, nullifier 01dfc21e…)', () => {
    const v = GOLDEN.vectors[0]!;
    const pub = Object.fromEntries(ZK_GOLDEN.publicInputVectors.withdraw_change.map(p => [p.name, p.hexBE32]));
    expect(v.changeCommitment.hexBE32).toBe(pub.changeCommitment);
    expect(v.steps.nullifier_in.hexBE32).toBe(pub.nullifier);
    expect(v.context.merkleRootLeafAtIndex0.hexBE32).toBe(pub.merkleRoot);
  });
});

describe.each(GOLDEN.vectors.map(v => [v.label, v] as const))('vector %s — every step computed by our code, compared', (_label, v) => {
  it('changeAmount = input − withdraw − fee (a0ChangeAmount)', () => {
    expect(a0ChangeAmount(BigInt(v.in.inputAmount), BigInt(v.in.withdrawAmount), BigInt(v.in.fee))).toBe(BigInt(v.steps.changeAmount));
  });

  it('nullifier_in = Poseidon3(0x11, nk, rho_in) (fieldEquations)', () => {
    expect(hex(nullifier(fe(v.in.nk), fe(v.in.rho_in)))).toBe(v.steps.nullifier_in.hexBE32);
  });

  it('rho_change = Poseidon3(0x13, nullifier_in, 0): recovery\'s a0ChangeRho, fieldEquations\' rhoOut(·, 0) and the offline fake agree with it', () => {
    const n = v.steps.nullifier_in.hexBE32;
    expect(a0ChangeRho(n)).toBe(v.steps.rho_change.hexBE32);
    expect(hex(rhoOut(fe(v.steps.nullifier_in), 0))).toBe(v.steps.rho_change.hexBE32);
    expect(new OfflineA0Keys('00'.repeat(32)).rhoChange(n)).toBe(v.steps.rho_change.hexBE32);
  });

  it('addrField_self = Poseidon3(0x12, nk, change_d) — our addrField(nk, d) with d = change_d', () => {
    expect(hex(addrField(fe(v.in.nk), fe(v.in.change_d)))).toBe(v.steps.addrField_self.hexBE32);
  });

  it('changeCommitment = Poseidon5(0x10, addrField_self, changeAmount, mintHash, rho_change), composed from OUR steps end to end', () => {
    const nk = fe(v.in.nk);
    const nIn = nullifier(nk, fe(v.in.rho_in));
    const amount = a0ChangeAmount(BigInt(v.in.inputAmount), BigInt(v.in.withdrawAmount), BigInt(v.in.fee))!;
    const cm = commitment({
      addrField: addrField(nk, fe(v.in.change_d)),
      amount,
      mintHash: fe(v.in.mintHash),
      rho: BigInt(`0x${a0ChangeRho(hex(nIn))}`),
    });
    expect(hex(cm)).toBe(v.changeCommitment.hexBE32);
  });

  it('the input note: inputCommitment = commitment(addrField(nk, d_in), input, mintHash, rho_in) (the note being spent)', () => {
    const cm = commitment({
      addrField: addrField(fe(v.in.nk), fe(v.in.d_in)),
      amount: BigInt(v.in.inputAmount),
      mintHash: fe(v.in.mintHash),
      rho: fe(v.in.rho_in),
    });
    expect(hex(cm)).toBe(v.context.inputCommitment.hexBE32);
  });

  it('NEGATIVE controls — the three wrong commitments the program side rejects do not compare equal', () => {
    const nk = fe(v.in.nk);
    const nIn = nullifier(nk, fe(v.in.rho_in));
    const base = {
      addrField: addrField(nk, fe(v.in.change_d)),
      amount: BigInt(v.steps.changeAmount),
      mintHash: fe(v.in.mintHash),
      rho: rhoOut(nIn, 0),
    };
    expect(hex(commitment(base))).toBe(v.changeCommitment.hexBE32); // the positive twin
    expect(hex(commitment({...base, amount: base.amount + 1n}))).not.toBe(v.changeCommitment.hexBE32);
    expect(hex(commitment({...base, rho: rhoOut(nIn, 1)}))).not.toBe(v.changeCommitment.hexBE32);
    expect(hex(commitment({...base, addrField: addrField(nk, fe(v.in.d_in))}))).not.toBe(v.changeCommitment.hexBE32);
  });
});

describe('our pinned mintHash', () => {
  it('equals the A0-mint vectors\' in.mintHash (be_mod_r of ERkp…), as the depositFlow constant and the offline key vectors pin it', () => {
    for (const v of GOLDEN.vectors.slice(1)) {
      expect(v.in.mintHash.hexBE32).toBe(A0_MINT_HASH);
      expect(v.in.mintHash.hexBE32).toBe(KEY_VECTORS.constants.mintHash);
    }
    // control: the first vector's mintHash is the zk file's synthetic 555555555, not ours
    expect(GOLDEN.vectors[0]!.in.mintHash.hexBE32).not.toBe(A0_MINT_HASH);
  });
});

describe('a0ChangeAmount refuses a spend above the input (null), and 0 is a change', () => {
  it('rows', () => {
    expect(a0ChangeAmount(10n, 4n, 6n)).toBe(0n);
    expect(a0ChangeAmount(10n, 4n, 7n)).toBeNull();
    expect(a0ChangeAmount(10n, 11n, 0n)).toBeNull();
  });
});
