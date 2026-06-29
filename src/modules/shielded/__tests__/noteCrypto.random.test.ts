import {randomFieldElement} from '../noteCrypto';
import {BN254_FIELD_PRIME} from '../../merkle/field';

describe('randomFieldElement', () => {
  it('returns a bigint in [0, F)', () => {
    for (let i = 0; i < 50; i++) {
      const x = randomFieldElement();
      expect(typeof x).toBe('bigint');
      expect(x >= 0n).toBe(true);
      expect(x < BN254_FIELD_PRIME).toBe(true);
    }
  });
  it('is not constant across calls', () => {
    expect(randomFieldElement()).not.toBe(randomFieldElement());
  });
});
