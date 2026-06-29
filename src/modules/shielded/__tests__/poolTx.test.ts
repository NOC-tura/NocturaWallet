import {Keypair, ComputeBudgetProgram} from '@solana/web3.js';
import {submitPoolTx} from '../poolTx';

jest.mock('../../solana/signAndSend', () => ({signAndSend: jest.fn()}));
jest.mock('../../solana/connection', () => ({getConnection: jest.fn(() => ({}))}));
import {signAndSend} from '../../solana/signAndSend';
const mockSAS = signAndSend as jest.MockedFunction<typeof signAndSend>;

describe('submitPoolTx', () => {
  it('prepends a ComputeBudget limit ix and passes payer+signer', async () => {
    mockSAS.mockResolvedValue({signature: 'sig123', confirmationStatus: 'confirmed'});
    const kp = Keypair.generate();
    const poolIx = ComputeBudgetProgram.setComputeUnitPrice({microLamports: 1}); // any ix
    const sig = await submitPoolTx(poolIx, 200_000, kp);
    expect(sig).toBe('sig123');
    const spec = mockSAS.mock.calls[0][1];
    expect(spec.payer.equals(kp.publicKey)).toBe(true);
    expect(spec.instructions).toHaveLength(2); // [computeBudget, poolIx]
    expect(mockSAS.mock.calls[0][2][0]).toBe(kp); // signer
  });
});
