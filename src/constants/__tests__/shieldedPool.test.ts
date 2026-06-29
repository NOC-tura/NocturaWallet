import {PublicKey} from '@solana/web3.js';
import {SHIELDED_POOL_PROGRAM_ID, SHIELDED_CU} from '../programs';

describe('shielded pool constants', () => {
  it('program id is a valid PublicKey', () => {
    expect(() => new PublicKey(SHIELDED_POOL_PROGRAM_ID)).not.toThrow();
    expect(SHIELDED_POOL_PROGRAM_ID).toBe(
      'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES',
    );
  });
  it('CU limits cover the measured deposit/withdraw cost with headroom', () => {
    expect(SHIELDED_CU.deposit).toBeGreaterThanOrEqual(132_256);
    expect(SHIELDED_CU.withdraw).toBeGreaterThanOrEqual(152_508);
    expect(SHIELDED_CU.deposit).toBeLessThan(400_000);
  });
});
