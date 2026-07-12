import {Keypair} from '@solana/web3.js';

jest.mock('../merkleSync', () => ({syncLeaves: jest.fn()}));
jest.mock('../noteSelect', () => ({selectTransferInputs: jest.fn()}));
jest.mock('../transferWitness', () => ({
  buildTransferWitness: jest.fn(() => ({
    params: {merkleRoot: '5'},
    merkleRoot32: new Uint8Array(32).fill(1),
    nullifier32: [new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)],
    outCommitment32: [new Uint8Array(32).fill(4), new Uint8Array(32).fill(5)],
    outCommitmentDec: ['40', '50'],
    recipientOut: {commitment: '40', amount: 200n, noteSecret: 77n},
    changeOut: {commitment: '50', amount: 300n, noteSecret: 88n},
    change: 300n,
  })),
}));
jest.mock('../noteEncryption', () => ({encryptNote: jest.fn(() => new Uint8Array(128).fill(1))}));
jest.mock('../../zkProver/zkProverModule', () => ({
  proveShielded: jest.fn(async () => ({proofBytes: '00'.repeat(256), publicInputs: ['r', 'n0', 'n1', '40', '50', 'mh'], proofData: ''})),
}));
jest.mock('../poolTx', () => ({submitPoolTxMany: jest.fn(async () => 'SIG')}));
jest.mock('../relayerSubmit', () => ({
  submitTransferViaRelayer: jest.fn(async () => ({txSignature: 'RELAYER_SIG', alreadyLanded: false})),
}));
jest.mock('../../../constants/features', () => ({isShieldedRelayerEnabled: jest.fn(() => false)}));
jest.mock('../noteStore', () => ({markSpentByCommitment: jest.fn(), addNote: jest.fn(), getNotes: jest.fn(() => []), setNoteIndex: jest.fn()}));
jest.mock('../leafResolver', () => ({resolveLeafIndex: jest.fn(async () => 42), UNRESOLVED_INDEX: -1}));
jest.mock('../shieldedIdentity', () => ({getViewPublicKey: jest.fn(() => new Uint8Array(48).fill(9)), getPkRecipientHash: jest.fn()}));
jest.mock('../shieldedAddressCodec', () => ({decodeShieldedAddress: jest.fn(() => new Uint8Array(48).fill(1))}));
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({}), initSecureMmkv: jest.fn(),
}));

import {sendPrivateTransfer} from '../transferFlow';
import {syncLeaves} from '../merkleSync';
import {selectTransferInputs} from '../noteSelect';
import {markSpentByCommitment, addNote} from '../noteStore';
import {submitPoolTxMany} from '../poolTx';
import {submitTransferViaRelayer} from '../relayerSubmit';
import {isShieldedRelayerEnabled} from '../../../constants/features';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const rootHex = '01'.repeat(32); // = bytesToHex(mocked merkleRoot32 = Uint8Array(32).fill(1))
const input: ShieldedNote = {commitment: 'ci', nullifier: '', mint: MINT, amount: 500n, index: 0, spent: false, createdAt: 1, noteSecret: '9'};
const feePayer = Keypair.generate();
const seed = new Uint8Array(32).fill(3);

describe('sendPrivateTransfer', () => {
  beforeEach(() => jest.clearAllMocks());
  it('proves, submits, marks input spent, stores change, encrypts to recipient + self', async () => {
    (selectTransferInputs as jest.Mock).mockReturnValue([input]);
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['ci'], onChainRoots: [rootHex]});
    const res = await sendPrivateTransfer(seed, feePayer, MINT, 'noc1recipient', 200n);
    expect(res.sent).toBe(200n);
    expect(res.change).toBe(300n);
    expect(markSpentByCommitment).toHaveBeenCalledWith(MINT, 'ci');
    expect(addNote).toHaveBeenCalledWith(expect.objectContaining({commitment: '50', amount: 300n, index: 42}));
  });
  it('self-relays (submitPoolTxMany) when the relayer flag is OFF', async () => {
    (selectTransferInputs as jest.Mock).mockReturnValue([input]);
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['ci'], onChainRoots: [rootHex]});
    const res = await sendPrivateTransfer(seed, feePayer, MINT, 'noc1recipient', 200n);
    expect(res.txSignature).toBe('SIG');
    expect(submitPoolTxMany).toHaveBeenCalledTimes(1);
    expect(submitTransferViaRelayer).not.toHaveBeenCalled();
  });

  it('routes through the relayer (not self-relay) when the flag is ON', async () => {
    (isShieldedRelayerEnabled as jest.Mock).mockReturnValueOnce(true);
    (selectTransferInputs as jest.Mock).mockReturnValue([input]);
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['ci'], onChainRoots: [rootHex]});
    const res = await sendPrivateTransfer(seed, feePayer, MINT, 'noc1recipient', 200n);
    expect(res.txSignature).toBe('RELAYER_SIG');
    expect(submitTransferViaRelayer).toHaveBeenCalledTimes(1);
    expect(submitPoolTxMany).not.toHaveBeenCalled();
    // still marks input spent + records change on the relayer path
    expect(markSpentByCommitment).toHaveBeenCalledWith(MINT, 'ci');
  });

  it('throws when no inputs cover the amount', async () => {
    (selectTransferInputs as jest.Mock).mockReturnValue(null);
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: [], onChainRoots: [rootHex]});
    await expect(sendPrivateTransfer(seed, feePayer, MINT, 'noc1r', 999n)).rejects.toThrow();
  });

  // Regression: the input MUST be marked spent even if post-submit change-note
  // bookkeeping (leaf-index resolution) fails. Otherwise the input stays unspent,
  // the scan re-adds the received output, and the local balance inflates.
  it('marks the input spent even when change-note leaf resolution throws', async () => {
    const {resolveLeafIndex} = require('../leafResolver');
    (selectTransferInputs as jest.Mock).mockReturnValue([input]);
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['ci'], onChainRoots: [rootHex]});
    (resolveLeafIndex as jest.Mock).mockRejectedValueOnce(new Error('RPC exploded'));
    // The transfer succeeded on-chain (submit resolved); a bookkeeping failure
    // afterwards must not leave the input spendable.
    await sendPrivateTransfer(seed, feePayer, MINT, 'noc1recipient', 200n).catch(() => {});
    expect(markSpentByCommitment).toHaveBeenCalledWith(MINT, 'ci');
  });
});
