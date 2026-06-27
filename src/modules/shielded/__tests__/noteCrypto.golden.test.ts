import * as fs from 'fs';
import * as path from 'path';
import {base58} from '@scure/base';
import {poseidon2} from 'poseidon-lite';
import {
  bytesToBigIntBE,
  pkRecipientHash,
  mintHash,
  noteCommitment,
  nullifier,
  recipientField,
} from '../noteCrypto';
import {computeMerkleRoot, BN254_FIELD_PRIME} from '../../merkle/merkleModule';

const GOLDEN_PATH = path.join(
  __dirname,
  '../../../../docs/zk-contract/golden-vectors.json',
);

const G1_GEN_HEX =
  '97f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function buildVectors() {
  const pk = hexToBytes(G1_GEN_HEX);
  const nocMint = base58.decode('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
  const allFf = new Uint8Array(32).fill(0xff);

  const pkHash = pkRecipientHash(pk);
  const mintH = mintHash(nocMint);
  const amount = 1_000_000_000n;
  const noteSecret = 12_345_678_901_234_567_890n;
  const commitment = noteCommitment({
    pkRecipientHash: pkHash,
    amount,
    mintHash: mintH,
    noteSecret,
  });

  // Deterministic non-generator pk (clearly not key material): byte i = (i*7+3) mod 256.
  const pseudoPk = Uint8Array.from({length: 48}, (_unused, i) => (i * 7 + 3) % 256);
  const pseudoPkHex = Buffer.from(pseudoPk).toString('hex');
  const pseudoPkHash = pkRecipientHash(pseudoPk);

  // Field boundary F-1 encoded big-endian into 32 bytes.
  const feMinus1 = BN254_FIELD_PRIME - 1n;
  const feMinus1Bytes = new Uint8Array(32);
  let tmp = feMinus1;
  for (let i = 31; i >= 0; i--) {
    feMinus1Bytes[i] = Number(tmp % 256n);
    tmp = tmp / 256n;
  }
  const feMinus1Hex = Buffer.from(feMinus1Bytes).toString('hex');
  const feMinus1Roundtrip = bytesToBigIntBE(feMinus1Bytes);

  // --- Ratified-with-program-side vectors (recipientField + incremental merkle) ---
  // Sample devnet recipient ATA (deterministic fixture).
  const SAMPLE_RECIPIENT_TA =
    'd5f0e3a1b2c4968778695a4b3c2d1e0f00112233445566778899aabbccddeeff';
  // Sample leaf = the representative golden commitment (fixed constant).
  const SAMPLE_LEAF =
    12616215241406504088266863708796392158806576577856853960830103596174110701914n;
  // Empty-subtree zero hashes: zeros[0]=0, zeros[i]=poseidon2(zeros[i-1],zeros[i-1]).
  const miZeros: bigint[] = [0n];
  for (let i = 1; i <= 20; i++) {
    miZeros.push(poseidon2([miZeros[i - 1], miZeros[i - 1]]));
  }
  // Insert leaf at index 0 (always the left child): filledSubtrees[i] is the
  // left-edge node after i levels; rootAfterInsert folds all 20 levels.
  const filledSubtrees: bigint[] = [];
  let miNode = SAMPLE_LEAF;
  for (let level = 0; level < 20; level++) {
    filledSubtrees.push(miNode);
    miNode = poseidon2([miNode, miZeros[level]]);
  }
  const miRootAfterInsert = miNode;

  return {
    _meta: {
      scheme: 'noctura-zk-encoding-v1',
      field: 'BN254',
      endianness: 'big',
      domains: {commitment: '0x01', nullifier: '0x02', pkRecipient: '0x05'},
      note: 'Field elements are decimal strings; byte arrays are lowercase hex.',
    },
    pkRecipientHash: [
      {name: 'g1_generator', pk: G1_GEN_HEX, output: pkHash.toString()},
      {name: 'pseudo_random', pk: pseudoPkHex, output: pseudoPkHash.toString()},
    ],
    mintHash: [
      {name: 'NOC_MINT', mint_hex: Buffer.from(nocMint).toString('hex'), output: mintH.toString()},
      {name: 'all_ff_over_F', mint_hex: 'ff'.repeat(32), output: mintHash(allFf).toString()},
    ],
    noteCommitment: [
      {
        name: 'representative',
        pkRecipientHash: pkHash.toString(),
        amount: amount.toString(),
        mintHash: mintH.toString(),
        noteSecret: noteSecret.toString(),
        output: commitment.toString(),
      },
    ],
    nullifier: [
      {
        name: 'leaf_7',
        noteSecret: noteSecret.toString(),
        leafIndex: 7,
        output: nullifier({noteSecret, leafIndex: 7}).toString(),
      },
    ],
    merkle: [
      {
        name: 'root_of_two_leaves',
        leaves: [commitment.toString(16).padStart(64, '0'), pkHash.toString(16).padStart(64, '0')],
        root: computeMerkleRoot([
          commitment.toString(16).padStart(64, '0'),
          pkHash.toString(16).padStart(64, '0'),
        ]),
      },
    ],
    fieldBoundary: [
      {
        name: 'F_minus_1',
        be_hex: feMinus1Hex,
        value: feMinus1Roundtrip.toString(),
      },
    ],
    recipientField: [
      {
        name: 'sample_recipient_token_account',
        tokenAccount_hex: SAMPLE_RECIPIENT_TA,
        output: recipientField(hexToBytes(SAMPLE_RECIPIENT_TA)).toString(),
      },
    ],
    merkleIncremental: [
      {
        name: 'depth20_zeros_and_single_insert',
        depth: 20,
        zeroLeaf: '0',
        zeros: miZeros.map(x => x.toString()),
        emptyRoot: miZeros[20].toString(),
        insertLeafIndex: 0,
        insertLeaf: SAMPLE_LEAF.toString(),
        rootAfterInsert: miRootAfterInsert.toString(),
        filledSubtreesAfterInsert: filledSubtrees.map(x => x.toString()),
      },
    ],
  };
}

describe('golden vectors', () => {
  it('sanity: bytesToBigIntBE of the G1 generator is non-zero', () => {
    expect(bytesToBigIntBE(hexToBytes(G1_GEN_HEX))).toBeGreaterThan(0n);
  });

  if (process.env.GENERATE === '1') {
    it('writes golden-vectors.json', () => {
      const vectors = buildVectors();
      fs.mkdirSync(path.dirname(GOLDEN_PATH), {recursive: true});
      fs.writeFileSync(GOLDEN_PATH, JSON.stringify(vectors, null, 2) + '\n');
      expect(fs.existsSync(GOLDEN_PATH)).toBe(true);
    });
  } else {
    it('code reproduces the pinned golden vectors exactly', () => {
      const pinned = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
      const fresh = buildVectors();
      expect(fresh).toEqual(pinned);
    });
  }
});
