import {FEATURES, isShieldedEnabled, isLocalProvingEnabled} from '../features';

describe('features flag', () => {
  it('shielded is disabled in v1', () => {
    expect(FEATURES.shielded).toBe(false);
    expect(isShieldedEnabled()).toBe(false);
  });

  it('localProving is off unless env LOCAL_PROVING=true', () => {
    // Config is mocked to {} in the test env → flag false by default.
    expect(isLocalProvingEnabled()).toBe(false);
  });
});
