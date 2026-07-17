import {Keypair} from '@solana/web3.js';

const captured: {ciphertext?: Uint8Array} = {};
jest.mock('../poolInstructions', () => ({
  buildDepositIx: jest.fn((p: {ciphertext: Uint8Array}) => {
    captured.ciphertext = p.ciphertext;
    return {}; // opaque ix; submitPoolTx is mocked
  }),
}));
jest.mock('../../zkProver/zkProverModule', () => ({
  proveShielded: jest.fn(async () => ({proofBytes: '00'.repeat(256), publicInputs: [], proofData: ''})),
}));
jest.mock('../poolTx', () => ({submitPoolTx: jest.fn(async () => 'SIG')}));
jest.mock('../leafResolver', () => ({resolveLeafIndex: jest.fn(async () => 3)}));
jest.mock('../noteStore', () => ({addNote: jest.fn()}));
jest.mock('../../solana/transactionBuilder', () => ({
  resolveSourceTokenAccount: jest.fn(async () => ({
    toBuffer: () => new Uint8Array(32).fill(5),
  })),
}));
jest.mock('../../solana/connection', () => ({getConnection: () => ({})}));
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({}), initSecureMmkv: jest.fn(),
}));

import {depositShield} from '../depositFlow';
import {addNote} from '../noteStore';
import {tryDecryptNote} from '../noteEncryption';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';

const MINT = 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe';
const seed = new Uint8Array(64).fill(7);
const feePayer = Keypair.generate();

it('emits a 128-byte memo that decrypts to the stored note amount + noteSecret', async () => {
  await depositShield(seed, feePayer, MINT, 1_000n);
  expect(captured.ciphertext).toHaveLength(128);
  const dec = tryDecryptNote(deriveShieldedViewKey(seed), captured.ciphertext!);
  expect(dec).not.toBeNull();
  expect(dec!.amount).toBe(1_000n);
  // the memo carries the SAME noteSecret that was persisted for the note
  const stored = (addNote as jest.Mock).mock.calls[0][0];
  expect(dec!.noteSecret.toString()).toBe(stored.noteSecret);
});
