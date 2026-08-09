import {assertKnownNetwork, assertShieldedRequiresLocalProving} from '../networkGuard';

describe('assertKnownNetwork', () => {
  it('accepts the two supported clusters', () => {
    expect(() => assertKnownNetwork('devnet')).not.toThrow();
    expect(() => assertKnownNetwork('mainnet-beta')).not.toThrow();
  });

  it('REJECTS an undefined NETWORK instead of defaulting to mainnet', () => {
    // `Config.NETWORK as 'devnet' | 'mainnet-beta'` is an unchecked cast, and
    // IS_DEVNET === NETWORK === 'devnet' makes MAINNET the default branch. A
    // missing dotenv wiring therefore silently selects the real NOC mint, the
    // real program, and the real treasuries.
    expect(() => assertKnownNetwork(undefined)).toThrow(/NETWORK/);
  });

  it('REJECTS a typo rather than treating it as mainnet', () => {
    expect(() => assertKnownNetwork('Devnet')).toThrow(/NETWORK/);
    expect(() => assertKnownNetwork('mainnet')).toThrow(/NETWORK/);
    expect(() => assertKnownNetwork('')).toThrow(/NETWORK/);
  });
});

describe('assertShieldedRequiresLocalProving', () => {
  it('allows a build with shielded off', () => {
    expect(() => assertShieldedRequiresLocalProving(false, false)).not.toThrow();
  });

  it('REJECTS shielded without local proving', () => {
    // Hosted proving POSTs the full private witness — including the note secret,
    // which is the entire spend authority — to the coordinator. A build that
    // enables shielded and forgets LOCAL_PROVING=true hands custody away
    // silently, with no UI difference.
    expect(() => assertShieldedRequiresLocalProving(true, false)).toThrow(/LOCAL_PROVING/);
  });

  it('accepts a coherent shielded build', () => {
    expect(() => assertShieldedRequiresLocalProving(true, true)).not.toThrow();
  });
});

describe('programs.ts applies the guard at import', () => {
  // A unit test of assertKnownNetwork passes whether or not anything calls it.
  // This asserts the wiring: importing the constants module with a bad NETWORK
  // must fail loudly rather than silently resolving to the mainnet branch.
  const load = (network: unknown) => {
    jest.resetModules();
    jest.doMock('react-native-config', () => ({
      __esModule: true,
      default: {NETWORK: network, API_BASE: 'https://x/v1'},
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return () => require('../programs');
  };

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('react-native-config');
  });

  it('throws when NETWORK is unset', () => {
    expect(load(undefined)).toThrow(/NETWORK/);
  });

  it('throws on a typo instead of selecting mainnet', () => {
    expect(load('Devnet')).toThrow(/NETWORK/);
  });

  it('loads normally for a supported cluster', () => {
    expect(load('devnet')).not.toThrow();
  });
});
