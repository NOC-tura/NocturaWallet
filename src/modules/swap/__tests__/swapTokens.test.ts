import {SWAP_TOKENS, isSwappable} from '../swapTokens';
import {USDC_MINT} from '../../tokens/coreTokens';
import {NOC_MINT} from '../../../constants/programs';

describe('swap tokens', () => {
  it('includes SOL/USDC/USDT and excludes NOC', () => {
    const mints = SWAP_TOKENS.map(t => t.mint);
    expect(mints).toContain('native');
    expect(mints).toContain(USDC_MINT);
    expect(mints).not.toContain(NOC_MINT);
  });
  it('isSwappable: SOL/USDC true, NOC false', () => {
    expect(isSwappable('native')).toBe(true);
    expect(isSwappable(USDC_MINT)).toBe(true);
    expect(isSwappable(NOC_MINT)).toBe(false);
    expect(isSwappable('SomeUnknownMint')).toBe(false);
  });
});
