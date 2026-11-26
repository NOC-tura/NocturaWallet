/** post-M1d R8 / r2-6: a symbol on #27 comes only from CORE_TOKENS, A0_TOKEN, or the DAS cache for a mint that
 *  passes classifyToken ('verified'). Anything else is the short mint — a scam mint may call itself "USDC". */
const mockFeatures = {shielded: true};
jest.mock('../../../constants/features', () => ({isShieldedEnabled: () => mockFeatures.shielded}));
const mockCache: {current: Record<string, {name: string; symbol: string}>} = {current: {}};
jest.mock('../tokenMetadata', () => ({loadCachedMetadata: () => mockCache.current}));
const mockClassify = jest.fn((_mint: string): 'core' | 'verified' | 'unknown' => 'unknown');
jest.mock('../tokenModule', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({classifyToken: (m: string) => mockClassify(m)})),
}));

import {shortMint, trustedSymbol} from '../trustedSymbol';
import {A0_TOKEN} from '../../shielded/a0/screenSupport';
import {NOC_MINT} from '../../../constants/programs';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WSOL = 'So11111111111111111111111111111111111111112';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const SCAM = 'ScamMint1111111111111111111111111111111111';

beforeEach(() => {
  mockFeatures.shielded = true;
  mockCache.current = {};
  mockClassify.mockReset().mockReturnValue('unknown');
});

it('native and the core tokens', () => {
  expect(trustedSymbol('native')).toBe('SOL');
  expect(trustedSymbol(NOC_MINT)).toBe('NOC');
  expect(trustedSymbol(USDC)).toBe('USDC');
  expect(trustedSymbol(WSOL)).toBe('wSOL');
});

it('the pool token is "TEST" where private balances exist; elsewhere the short mint', () => {
  expect(trustedSymbol(A0_TOKEN.mint)).toBe('TEST');
  mockFeatures.shielded = false;
  expect(trustedSymbol(A0_TOKEN.mint)).toBe(shortMint(A0_TOKEN.mint));
});

it('r2-6: a verified mint takes its symbol from the DAS cache', () => {
  mockClassify.mockReturnValue('verified');
  mockCache.current = {[BONK]: {name: 'Bonk', symbol: 'BONK'}};
  expect(trustedSymbol(BONK)).toBe('BONK');
});

// Y3 (Review Focus 2)
it('R8: an UNVERIFIED mint that calls itself "USDC" in the DAS cache shows its short mint, never "USDC"', () => {
  mockCache.current = {[SCAM]: {name: 'USD Coin', symbol: 'USDC'}};
  expect(trustedSymbol(SCAM)).toBe('ScamMi…1111');
  expect(trustedSymbol(SCAM)).not.toContain('USDC');
});

it('a verified mint with no cached symbol, or a blank one → the short mint (never "")', () => {
  mockClassify.mockReturnValue('verified');
  expect(trustedSymbol(BONK)).toBe('DezXAZ…B263');
  mockCache.current = {[BONK]: {name: 'Bonk', symbol: '  '}};
  expect(trustedSymbol(BONK)).toBe('DezXAZ…B263');
});

it('shortMint: first 6 … last 4; a short string is left whole', () => {
  expect(shortMint(BONK)).toBe('DezXAZ…B263');
  expect(shortMint('abc')).toBe('abc');
});
