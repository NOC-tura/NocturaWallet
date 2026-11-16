import {FEATURES, isShieldedEnabled, isLocalProvingEnabled} from '../features';

describe('features flag', () => {
  it('shielded is disabled by default (the production build)', () => {
    expect(FEATURES.shielded).toBe(false);
    expect(isShieldedEnabled()).toBe(false);
  });

  it('localProving is off unless env LOCAL_PROVING=true', () => {
    // Config is mocked without it in the test env → flag false by default.
    expect(isLocalProvingEnabled()).toBe(false);
  });

  it('the v1 flags are gone (spec §12: the self-relay and the transfer flags)', () => {
    expect(Object.keys(FEATURES).sort()).toEqual(['localProving', 'shielded']);
  });
});

describe('features.ts applies the shielded guards at import', () => {
  const load = (config: Record<string, string | undefined>) => {
    jest.resetModules();
    jest.doMock('react-native-config', () => ({
      __esModule: true,
      default: {API_BASE: 'https://x/v1', ...config},
    }));
    return () => require('../features');
  };

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('react-native-config');
  });

  it('the devnet shielded build loads (NETWORK=devnet, FEATURES_SHIELDED, LOCAL_PROVING)', () => {
    expect(load({NETWORK: 'devnet', FEATURES_SHIELDED: 'true', LOCAL_PROVING: 'true'})).not.toThrow();
  });

  it('REFUSES shielded on mainnet-beta (the old .env.devnet: NETWORK=mainnet-beta)', () => {
    expect(load({NETWORK: 'mainnet-beta', FEATURES_SHIELDED: 'true', LOCAL_PROVING: 'true'})).toThrow(
      /requires NETWORK=devnet/,
    );
  });

  it('REFUSES shielded without local proving', () => {
    expect(load({NETWORK: 'devnet', FEATURES_SHIELDED: 'true'})).toThrow(/LOCAL_PROVING/);
  });

  it('the production build loads (NETWORK=mainnet-beta, shielded off)', () => {
    expect(load({NETWORK: 'mainnet-beta'})).not.toThrow();
  });
});
