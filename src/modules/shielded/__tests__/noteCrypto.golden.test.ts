import * as fs from 'fs';
import * as path from 'path';
import {base58} from '@scure/base';
import {
  bytesToBigIntBE,
  pkRecipientHash,
  mintHash,
  noteCommitment,
  nullifier,
} from '../noteCrypto';
import {computeMerkleRoot} from '../../merkle/merkleModule';

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
