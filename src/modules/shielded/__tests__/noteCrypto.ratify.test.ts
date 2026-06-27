import * as fs from 'fs';
import * as path from 'path';
import {poseidon2} from 'poseidon-lite';
import {recipientField} from '../noteCrypto';

/**
 * Ratification against the ICO/program side's Phase-1 published vectors
 * (docs/zk-contract/golden-vectors.json — bound from the program repo). Confirms
 * the wallet's `recipientField` (the new withdraw-recipient binding) and the
 * incremental Merkle (poseidon2, depth 20) reproduce the exact decimals the
 * circuit + program were built against. Drift here = a wallet/circuit mismatch.
 */
const golden = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../../../docs/zk-contract/golden-vectors.json'),
    'utf8',
  ),
);

function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, '');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe('ratification — wallet reproduces ICO Phase-1 vectors', () => {
  it('recipientField = be(token_account) mod F matches the published vector', () => {
    const v = golden.recipientField[0];
    expect(recipientField(hexToBytes(v.tokenAccount_hex)).toString()).toBe(
      v.output,
    );
  });

  it('merkleIncremental: poseidon2 zero-subtree hashes + empty root match', () => {
    const mi = golden.merkleIncremental[0];
    const zeros: bigint[] = [0n];
    for (let i = 1; i < mi.zeros.length; i++) {
      zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));
    }
    expect(zeros.map(z => z.toString())).toEqual(mi.zeros);
    // emptyRoot = zeros[depth]
    expect(zeros[mi.depth].toString()).toBe(mi.emptyRoot);
  });

  it('merkleIncremental: root after inserting leaf at index 0 matches', () => {
    const mi = golden.merkleIncremental[0];
    const zeros: bigint[] = [0n];
    for (let i = 1; i < mi.depth; i++) {
      zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));
    }
    // Leaf index 0 is always the LEFT child at every level; its sibling is the
    // empty-subtree hash for that level.
    let node = BigInt(mi.insertLeaf);
    for (let level = 0; level < mi.depth; level++) {
      node = poseidon2([node, zeros[level]]);
    }
    expect(node.toString()).toBe(mi.rootAfterInsert);
  });
});
