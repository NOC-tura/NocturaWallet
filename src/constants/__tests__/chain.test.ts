/**
 * The build's chain identity (spec S13): the devnet build names devnet and links the explorer
 * with ?cluster=devnet; presale exists on mainnet only; the identity comes from NETWORK alone,
 * whose unknown / missing value refuses to load (never mainnet).
 */
import {chainIdentity, explorerTxUrl, isPresaleEnabled, isPricingEnabled, CHAIN} from '../chain';

const SIG = '3DR6F7oWyKJmV2b1S5ERa2q8N9u5vR1c7Ff6y3Hj3rZ8cVgUoPqXk2Lw1Yt4Mn6Bs9Df7Gh2Jk5Lz8Xc4Vb1Nm3Q';

describe('chainIdentity', () => {
  it('devnet is named devnet; mainnet-beta is named mainnet', () => {
    expect(chainIdentity('devnet')).toEqual({network: 'devnet', label: 'Solana devnet', short: 'devnet'});
    expect(chainIdentity('mainnet-beta')).toEqual({network: 'mainnet-beta', label: 'Solana mainnet', short: 'mainnet'});
  });
});

describe('explorerTxUrl', () => {
  it('devnet: every explorer link carries ?cluster=devnet', () => {
    expect(explorerTxUrl(SIG, 'solscan', 'devnet')).toBe(`https://solscan.io/tx/${SIG}?cluster=devnet`);
    expect(explorerTxUrl(SIG, 'solanaexplorer', 'devnet')).toBe(`https://explorer.solana.com/tx/${SIG}?cluster=devnet`);
    // Solana FM reads another devnet parameter: the devnet link goes to the Solana Explorer.
    expect(explorerTxUrl(SIG, 'solanafm', 'devnet')).toBe(`https://explorer.solana.com/tx/${SIG}?cluster=devnet`);
    for (const e of ['solscan', 'solanaexplorer', 'solanafm'] as const) {
      expect(explorerTxUrl(SIG, e, 'devnet')).toMatch(/\?cluster=devnet$/);
    }
  });

  it('mainnet: no cluster parameter (the explorers default to mainnet)', () => {
    expect(explorerTxUrl(SIG, 'solscan', 'mainnet-beta')).toBe(`https://solscan.io/tx/${SIG}`);
    expect(explorerTxUrl(SIG, 'solanafm', 'mainnet-beta')).toBe(`https://solana.fm/tx/${SIG}`);
  });
});

describe('isPresaleEnabled', () => {
  it('mainnet only', () => {
    expect(isPresaleEnabled('mainnet-beta')).toBe(true);
    expect(isPresaleEnabled('devnet')).toBe(false);
  });
});

describe('isPricingEnabled', () => {
  it('mainnet only: devnet SOL has no market, so the devnet build prices nothing', () => {
    expect(isPricingEnabled('mainnet-beta')).toBe(true);
    expect(isPricingEnabled('devnet')).toBe(false);
  });
});

describe('the identity is NETWORK, read at import', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('react-native-config');
  });

  const load = (network: unknown): typeof import('../chain') => {
    jest.resetModules();
    jest.doMock('react-native-config', () => ({__esModule: true, default: {NETWORK: network, API_BASE: 'https://x/v1'}}));
    return require('../chain');
  };

  it('the test env (NETWORK=mainnet-beta) is mainnet, with presale', () => {
    expect(CHAIN.label).toBe('Solana mainnet');
    expect(isPresaleEnabled()).toBe(true);
  });

  it('NETWORK=devnet: devnet everywhere — the label, the default explorer link, no presale', () => {
    const chain = load('devnet');
    expect(chain.CHAIN).toEqual({network: 'devnet', label: 'Solana devnet', short: 'devnet'});
    expect(chain.isPresaleEnabled()).toBe(false);
    expect(chain.explorerTxUrl(SIG)).toBe(`https://solscan.io/tx/${SIG}?cluster=devnet`);
    // the app's link helper is the same function
    const {getExplorerUrl} = require('../../utils/explorerUrl') as typeof import('../../utils/explorerUrl');
    expect(getExplorerUrl(SIG)).toBe(`https://solscan.io/tx/${SIG}?cluster=devnet`);
  });

  it('a missing or unknown NETWORK refuses to load — never a mainnet default', () => {
    expect(() => load(undefined)).toThrow(/NETWORK/);
    expect(() => load('devnet ')).toThrow(/NETWORK/);
    expect(() => load('mainnet')).toThrow(/NETWORK/);
  });
});

describe('programs.ts has no devnet placeholders (cardinal rule; S13)', () => {
  it('no placeholder value, and the presale constants are the mainnet ones in every build', () => {
    jest.resetModules();
    jest.doMock('react-native-config', () => ({__esModule: true, default: {NETWORK: 'devnet', API_BASE: 'https://x/v1'}}));
    const devnet = require('../programs') as Record<string, unknown>;
    jest.resetModules();
    jest.dontMock('react-native-config');
    const mainnet = require('../programs') as Record<string, unknown>;
    for (const k of ['NOC_MINT', 'PROGRAM_ID', 'ADMIN_ADDRESS', 'SOL_TREASURY', 'NOCTURA_FEE_TREASURY']) {
      expect(String(devnet[k])).not.toMatch(/TODO/);
      expect(devnet[k]).toBe(mainnet[k]);
    }
    expect(devnet.NETWORK).toBe('devnet');
    expect(mainnet.NETWORK).toBe('mainnet-beta');
  });
});
