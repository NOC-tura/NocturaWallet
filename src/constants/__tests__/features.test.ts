import {FEATURES, isShieldedEnabled} from '../features';

describe('features flag', () => {
  it('shielded is disabled in v1', () => {
    expect(FEATURES.shielded).toBe(false);
    expect(isShieldedEnabled()).toBe(false);
  });
});
