import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';

import {
  TAG,
  addrField,
  commitment,
  emptySubtreeRoots,
  merkleNode,
  nullifier,
  rhoOut,
  toBe32Hex,
} from '../fieldEquations';

/**
 * The coordinator's golden vectors are a COMPARISON TARGET, never an input.
 *
 * Reading `out` into a builder makes the same number appear on both sides of the
 * equals sign, and a wrong value in their file would then produce a green test on
 * both sides at once — a defect in a shared artefact shows up as AGREEMENT. So
 * every value here is computed from the frozen spec (§1.4a: tags, arities,
 * argument order) and only then compared.
 *
 * Note in particular that TAG values come from `../fieldEquations`, not from the
 * file's `_tags` block. Reading those would be reading a value.
 */
const vectors = JSON.parse(
  readFileSync(join(__dirname, 'golden-vectors.json'), 'utf8'),
) as GoldenVectors;

interface Vector {
  label: string;
  in: Record<string, string | number>;
  out: string;
  outHexBE32: string;
}
interface GoldenVectors {
  schema: string;
  _tags: Record<string, string>;
  equations: Record<string, string>;
  vectors: Record<string, Vector[]>;
  publicInputVectors: Record<string, Array<{index: number; name: string; dec: string; hexBE32: string}>>;
}

const each = (group: string): Array<[string, Vector]> => {
  const vs = vectors.vectors[group];
  if (!vs || vs.length === 0) {
    throw new Error(`golden vectors carry no '${group}' group — the file is not what this test assumes`);
  }
  return vs.map(v => [v.label, v]);
};

describe('the fixture is the artifact we recorded', () => {
  it('hashes to the sha256 the coordinator published', () => {
    const raw = readFileSync(join(__dirname, 'golden-vectors.json'));
    expect(createHash('sha256').update(raw).digest('hex')).toBe(
      '8c5904c6a2f40ee4594eede998fa862bffe6988fbd5c59ba87d953c69ec662ed',
    );
  });

  it('states the equations this suite implements, so a redefinition is visible', () => {
    expect(vectors.equations).toEqual({
      addrField: 'Poseidon3(TAG_ADDR, nk, d)',
      commitment: 'Poseidon5(TAG_CM, addrField, amount, mintHash, rho)',
      nullifier: 'Poseidon3(TAG_NULL, nk, rho)',
      rhoOut: 'Poseidon3(TAG_RHO, nullifier_in_0, j)',
      merkleNode: 'Poseidon2(left, right)   // UNTAGGED',
    });
  });

  it('agrees with our independently-held tag numbers', () => {
    // Ours come from the frozen spec; theirs from their file. Comparing them is
    // the point — if we read theirs, agreement would prove nothing.
    expect(TAG.CM).toBe(BigInt(vectors._tags.TAG_CM));
    expect(TAG.NULL).toBe(BigInt(vectors._tags.TAG_NULL));
    expect(TAG.ADDR).toBe(BigInt(vectors._tags.TAG_ADDR));
    expect(TAG.RHO).toBe(BigInt(vectors._tags.TAG_RHO));
  });
});

describe('addrField = Poseidon3(TAG_ADDR, nk, d)', () => {
  it.each(each('addrField'))('%s', (_label, v) => {
    const got = addrField(BigInt(v.in.nk as string), BigInt(v.in.d as string));
    expect(got.toString()).toBe(v.out);
    expect(toBe32Hex(got)).toBe(v.outHexBE32);
  });
});

describe('commitment = Poseidon5(TAG_CM, addrField, amount, mintHash, rho)', () => {
  it.each(each('commitment'))('%s', (_label, v) => {
    const got = commitment({
      addrField: BigInt(v.in.addrField as string),
      amount: BigInt(v.in.amount as string),
      mintHash: BigInt(v.in.mintHash as string),
      rho: BigInt(v.in.rho as string),
    });
    expect(got.toString()).toBe(v.out);
    expect(toBe32Hex(got)).toBe(v.outHexBE32);
  });
});

describe('nullifier = Poseidon3(TAG_NULL, nk, rho)', () => {
  it.each(each('nullifier'))('%s', (_label, v) => {
    const got = nullifier(BigInt(v.in.nk as string), BigInt(v.in.rho as string));
    expect(got.toString()).toBe(v.out);
    expect(toBe32Hex(got)).toBe(v.outHexBE32);
  });
});

describe('rhoOut = Poseidon3(TAG_RHO, nullifier_in_0, j)', () => {
  // j0 and j1 are separate vectors on purpose: an implementation hardcoding
  // index 0 gives both transfer outputs the same rho, hence the same nullifier,
  // and the second note is permanently unspendable with nothing failing at
  // proving time. A "typical" case cannot speak for that.
  it.each(each('rhoOut'))('%s', (_label, v) => {
    const got = rhoOut(BigInt(v.in.nullifierIn0 as string), Number(v.in.index));
    expect(got.toString()).toBe(v.out);
    expect(toBe32Hex(got)).toBe(v.outHexBE32);
  });

  it('j0 and j1 differ — the whole reason both are shipped', () => {
    const n0 = 847659508468183968581499747419711796613625445405826683657885953076716734712n;
    expect(rhoOut(n0, 0)).not.toBe(rhoOut(n0, 1));
  });
});

describe('merkleNode = Poseidon2(left, right), UNTAGGED', () => {
  // The two vectors in this group have DIFFERENT shapes, which is easy to miss:
  // the first is a single pair, the second describes a whole fold in prose
  // ("fold of the leaf above with Z[i], i = 0..19"). Treating them uniformly
  // made this suite fail against a correct vector — my bug, not theirs, and a
  // reminder that a group name is not a schema.
  const [pairVector, foldVector] = vectors.vectors.merkleNode;
  const LEAF = BigInt(pairVector!.in.left as string);

  it('folds a leaf with an empty sibling at level 0', () => {
    const got = merkleNode(LEAF, BigInt(pairVector!.in.right as string));
    expect(got.toString()).toBe(pairVector!.out);
    expect(toBe32Hex(got)).toBe(pairVector!.outHexBE32);
  });

  it('folds that leaf at index 0 through depth 20 to the public merkleRoot', () => {
    // The vector the whole Z-constant question rests on: the leaf sits at index
    // 0, so it is the LEFT child at every level and the sibling is Z[i]. This is
    // the only place our empty-subtree constants and our index convention are
    // exercised together against a value we did not compute.
    const Z = emptySubtreeRoots(20);
    let acc = LEAF;
    for (let i = 0; i < 20; i++) {
      acc = merkleNode(acc, Z[i]!);
    }
    expect(acc.toString()).toBe(foldVector!.out);
    expect(toBe32Hex(acc)).toBe(foldVector!.outHexBE32);
  });
});

describe('public-input vectors — the ORDER, and the bytes', () => {
  it.each(Object.keys(vectors.publicInputVectors))('%s', circuit => {
    const rows = vectors.publicInputVectors[circuit];
    // Order is part of the contract: the verifier reads a flat array, so a
    // permutation that agrees on every value still fails on chain.
    expect(rows.map(r => r.index)).toEqual(rows.map((_, i) => i));
    for (const r of rows) {
      expect(toBe32Hex(BigInt(r.dec))).toBe(r.hexBE32);
    }
  });

  it('deposit carries rho — the field the currently-deployed program does not have', () => {
    expect(vectors.publicInputVectors.deposit.map(r => r.name)).toEqual([
      'commitment',
      'amount',
      'mintHash',
      'rho',
    ]);
  });
});

describe('empty-subtree constants — derived from the rule, not from their file', () => {
  // _notValidatedHere in their file: NOTHING pins these. The circuit accepts any
  // path, so the constants enter a witness as arbitrary sibling data and cancel
  // on both sides. A wallet using different Z[i] still proves membership against
  // every vector shipped and computes wrong roots against the real tree.
  //
  // So they are derived here from Z[0] = 0, Z[i] = P2(Z[i-1], Z[i-1]) — and must
  // still be checked against the DEPLOYED program's tree account, which does not
  // exist yet for A0.
  const Z = emptySubtreeRoots(20);

  it('has DEPTH + 1 entries, indices 0..20', () => {
    expect(Z).toHaveLength(21);
    expect(Z[0]).toBe(0n);
  });

  it('Z[20] is the empty-tree root, i.e. P2(Z[19], Z[19])', () => {
    // The naming convention is the trap, not the values. The program stores 20
    // entries zeros[0..19]; its empty-tree root is P2(zeros[19], zeros[19]),
    // which is Z[20] here. Two correct implementations disagree by one level
    // purely by counting entries instead of levels.
    expect(Z[20]).toBe(merkleNode(Z[19], Z[19]));
  });

  it('matches what merkleModule already derives, so the two cannot drift apart', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {computeMerkleRoot} = require('../../../merkle/merkleModule');
    expect(BigInt(`0x${computeMerkleRoot([])}`)).toBe(Z[20]);
  });
});
