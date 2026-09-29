import {PublicKey, SystemProgram} from '@solana/web3.js';
import {
  SplitTokenBalance,
  TOKEN_ACCOUNT_RENT_LAMPORTS,
  buildSolTransferInstructions,
  priorityFeeLamports,
  selectSourceTokenAccount,
} from '../../../../core/solana/transfer';

// The app's jest maps @solana/web3.js to its manual mock, so this proves the moved module loads
// under the app's runner and makes the same calls; the byte-level checks run under vitest
// (core/solana/__tests__/transfer.test.ts), and the on-device check stays part of an app release.
describe('core/solana/transfer, as the app imports it', () => {
  const sender = new PublicKey('So11111111111111111111111111111111111111112');
  const recipient = new PublicKey('TokenAccountAddr111111111111111111111111111');
  const treasury = new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');

  beforeEach(() => jest.clearAllMocks());

  it('selects the largest holding and refuses a split balance', () => {
    expect(selectSourceTokenAccount([{pubkey: 'a', amount: 1n}, {pubkey: 'b', amount: 9n}], 9n)).toBe('b');
    expect(() => selectSourceTokenAccount([{pubkey: 'a', amount: 5n}, {pubkey: 'b', amount: 5n}], 10n)).toThrow(SplitTokenBalance);
  });

  it('prices the recipient token account and the priority fee in BigInt', () => {
    expect(TOKEN_ACCOUNT_RENT_LAMPORTS).toBe(2_039_280n);
    expect(priorityFeeLamports(50_000, 1_000)).toBe(50n);
  });

  it('adds the markup transfer only when one is charged', () => {
    buildSolTransferInstructions({sender, recipient, lamports: 5n, markup: null});
    expect(SystemProgram.transfer).toHaveBeenCalledTimes(1);
    buildSolTransferInstructions({sender, recipient, lamports: 5n, markup: {lamports: 20_000n, treasury}});
    expect(SystemProgram.transfer).toHaveBeenCalledTimes(3);
    expect(SystemProgram.transfer).toHaveBeenLastCalledWith({fromPubkey: sender, toPubkey: treasury, lamports: 20_000n});
  });
});
