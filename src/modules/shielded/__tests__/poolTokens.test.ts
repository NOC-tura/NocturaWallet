import {SHIELDED_POOL_MINTS} from '../../../constants/programs';
import {poolTokenMeta} from '../poolTokens';

describe('shielded pool tokens', () => {
  it('exposes at least one pool mint', () => {
    expect(SHIELDED_POOL_MINTS.length).toBeGreaterThanOrEqual(1);
  });
  it('returns display metadata (symbol + decimals) for a pool mint', () => {
    const m = poolTokenMeta(SHIELDED_POOL_MINTS[0]!);
    expect(typeof m.symbol).toBe('string');
    expect(m.symbol.length).toBeGreaterThan(0);
    expect(m.decimals).toBe(9);
  });
});
