/**
 * The A0 field equations, implemented from the frozen spec (§1.4a).
 *
 * These are written from the SPEC — tags, arities, argument order — and are
 * compared against the coordinator's `golden-vectors.json` in the test beside
 * this file. Never the other way round.
 *
 * Why that direction matters, since it is the whole reason this module exists
 * rather than importing their numbers: while two implementations are
 * independent, a defect in either shows up as DIVERGENCE. Once both read the
 * same file, a defect in the file shows up as AGREEMENT — and agreement is
 * exactly what we were using as evidence. Each side therefore needs at least one
 * path from the frozen spec to a test that passes through no shared artefact.
 * This module is that path for the positive half.
 *
 * Nothing here may be derived from their file. In particular the TAG values
 * below are the spec's, and the test asserts they equal theirs rather than
 * reading theirs.
 */
import {poseidon2, poseidon3, poseidon5} from 'poseidon-lite';

/**
 * Domain tags, §1.4a. `0x01–0x0F` are the ENTIRE old scheme and are burned:
 * no old-scheme value may be syntactically valid under the new one.
 * Uniqueness is on the `(tag, arity)` pair, and the Merkle node is the single
 * named exception — untagged, arity 2.
 */
export const TAG = {
  CM: 0x10n,
  NULL: 0x11n,
  ADDR: 0x12n,
  RHO: 0x13n,
  NK: 0x14n,
  IVK: 0x15n,
} as const;

/** BN254 scalar field order. */
export const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const assertInField = (name: string, v: bigint): bigint => {
  if (v < 0n || v >= FIELD_MODULUS) {
    // poseidon-lite would silently reduce mod p, so an out-of-range input would
    // hash to a value the circuit never accepts, with nothing saying why.
    throw new Error(`${name} is outside the BN254 scalar field: ${v}`);
  }
  return v;
};

/**
 * 32-byte BIG-ENDIAN hex, unprefixed and zero-padded — what the on-chain
 * verifier reads. Two implementations can agree on every integer and still
 * disagree on the bytes, and the bytes are the half that fails at the verifier
 * rather than in a unit test.
 */
export function toBe32Hex(v: bigint): string {
  assertInField('value', v);
  return v.toString(16).padStart(64, '0');
}

/** `addrField = Poseidon3(TAG_ADDR, nk, d)` — opens the address a note commits to. */
export function addrField(nk: bigint, d: bigint): bigint {
  return poseidon3([TAG.ADDR, assertInField('nk', nk), assertInField('d', d)]);
}

/** `cm = Poseidon5(TAG_CM, addrField, amount, mintHash, rho)`. */
export function commitment(note: {
  addrField: bigint;
  amount: bigint;
  mintHash: bigint;
  rho: bigint;
}): bigint {
  return poseidon5([
    TAG.CM,
    assertInField('addrField', note.addrField),
    assertInField('amount', note.amount),
    assertInField('mintHash', note.mintHash),
    assertInField('rho', note.rho),
  ]);
}

/** `nullifier = Poseidon3(TAG_NULL, nk, rho)`. Spend authority is `nk`, never a note secret. */
export function nullifier(nk: bigint, rho: bigint): bigint {
  return poseidon3([TAG.NULL, assertInField('nk', nk), assertInField('rho', rho)]);
}

/**
 * `rho_out_j = Poseidon3(TAG_RHO, nullifier_in_0, j)`.
 *
 * The index is load-bearing. Hardcoding 0 gives both transfer outputs the same
 * rho, therefore the same nullifier — and the second note becomes permanently
 * unspendable with nothing failing at proving time.
 */
export function rhoOut(nullifierIn0: bigint, index: number): bigint {
  if (index !== 0 && index !== 1) {
    throw new Error(`rhoOut: index must be 0 or 1, got ${index}`);
  }
  return poseidon3([TAG.RHO, assertInField('nullifierIn0', nullifierIn0), BigInt(index)]);
}

/** Merkle internal node: `Poseidon2(left, right)`, UNTAGGED — the one named exception. */
export function merkleNode(left: bigint, right: bigint): bigint {
  return poseidon2([assertInField('left', left), assertInField('right', right)]);
}

/**
 * Empty-subtree constants: `Z[0] = 0`, `Z[i] = Poseidon2(Z[i-1], Z[i-1])`.
 *
 * NOT pinned by any golden vector, by the coordinator's own `_notValidatedHere`:
 * the circuit accepts any path, so these enter a witness as arbitrary sibling
 * data and cancel on both sides. A wallet using different constants still proves
 * membership against every vector shipped and computes WRONG ROOTS against the
 * real tree. They are checkable only against the deployed program's tree
 * account, and must be read from that account rather than from anyone's source.
 *
 * Indexing is the trap, not the arithmetic. This returns `depth + 1` entries,
 * `Z[0..depth]`, where `Z[depth]` is the empty-tree ROOT. The program stores
 * `depth` entries `zeros[0..depth-1]` and its empty root is
 * `P2(zeros[depth-1], zeros[depth-1])` — the same value, one index along. Two
 * correct implementations disagree by a level purely by counting entries
 * instead of levels.
 */
export function emptySubtreeRoots(depth: number): bigint[] {
  if (!Number.isInteger(depth) || depth < 1) {
    throw new Error(`emptySubtreeRoots: depth must be a positive integer, got ${depth}`);
  }
  const z: bigint[] = [0n];
  for (let i = 1; i <= depth; i++) {
    z.push(merkleNode(z[i - 1]!, z[i - 1]!));
  }
  return z;
}
