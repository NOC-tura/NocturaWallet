/**
 * Fee Engine Tests
 * 12 tests covering pre-TGE, zero-fee eligibility, discounts, instruction building,
 * formatFeeDisplay, FEE_DISTRIBUTION integrity, and SHIELDED_FEES constants.
 */

// Mock pinnedFetch (not directly used by feeEngine but required by module graph)
jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

// Mock presaleStore
jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: {
    getState: jest.fn(),
  },
}));

// Mock walletStore (for nocUsdPrice in getFeeDisplayInfo)
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: {
    getState: jest.fn(() => ({nocUsdPrice: 0, setNocUsdPrice: jest.fn()})),
  },
}));

import {usePresaleStore} from '../../../store/zustand/presaleStore';
import {FeeEngineManager, FEE_DISTRIBUTION} from '../feeEngine';
import {SHIELDED_FEES} from '../../../constants/programs';
import {PublicKey} from '@solana/web3.js';

const mockGetState = usePresaleStore.getState as jest.Mock;

function mockStore(overrides: {
  tgeStatus?: 'pre_tge' | 'claimable' | 'claimed';
  isZeroFeeEligible?: boolean;
}) {
  mockGetState.mockReturnValue({
    tgeStatus: 'claimable',
    isZeroFeeEligible: false,
    ...overrides,
  });
}

describe('FeeEngineManager', () => {
  let engine: FeeEngineManager;

  beforeEach(() => {
    engine = new FeeEngineManager();
    jest.clearAllMocks();
  });

  // ---- getEffectiveFee ----

  it('returns 0n pre-TGE regardless of fee type', () => {
    mockStore({tgeStatus: 'pre_tge'});
    expect(engine.getEffectiveFee('privateTransfer')).toBe(0n);
    expect(engine.getEffectiveFee('privateSwap')).toBe(0n);
    expect(engine.getEffectiveFee('transferMarkup')).toBe(0n);
  });

  it('returns 0n when isZeroFeeEligible is true (post-TGE)', () => {
    mockStore({tgeStatus: 'claimable', isZeroFeeEligible: true});
    expect(engine.getEffectiveFee('privateTransfer')).toBe(0n);
  });

  it('returns full SHIELDED_FEES.privateTransfer (500_000n) post-TGE with no discount', () => {
    mockStore({tgeStatus: 'claimable', isZeroFeeEligible: false});
    const fee = engine.getEffectiveFee('privateTransfer', 0);
    expect(fee).toBe(500_000n);
  });

  it('applies 10% discount (450_000n) for 90d staking tier', () => {
    mockStore({tgeStatus: 'claimable', isZeroFeeEligible: false});
    // 10% discount: 500_000 - (500_000 * 10 / 100) = 450_000
    const fee = engine.getEffectiveFee('privateTransfer', 0.1);
    expect(fee).toBe(450_000n);
  });

  it('applies 30% discount (350_000n) for 365d staking tier', () => {
    mockStore({tgeStatus: 'claimable', isZeroFeeEligible: false});
    // 30% discount: 500_000 - (500_000 * 30 / 100) = 350_000
    const fee = engine.getEffectiveFee('privateTransfer', 0.3);
    expect(fee).toBe(350_000n);
  });

  // ---- buildTransparentFeeInstruction ----

  it('buildTransparentFeeInstruction calls SystemProgram.transfer', () => {
    mockStore({tgeStatus: 'claimable'});
    const fromPubkey = new PublicKey('11111111111111111111111111111111');
    const instruction = engine.buildTransparentFeeInstruction({
      fromPubkey,
      feeLamports: 20_000n,
    });
    // SystemProgram.transfer returns an instruction with programId = SystemProgram.programId
    expect(instruction).toBeDefined();
    expect(instruction.programId).toBeDefined();
  });

  // ---- formatFeeDisplay / getFeeDisplayInfo ----

  it('formatFeeDisplay returns "Free (until TGE)" when fee is 0n and pre-TGE', () => {
    mockStore({tgeStatus: 'pre_tge'});
    const info = engine.getFeeDisplayInfo('privateTransfer', 0);
    expect(info.amount).toBe(0n);
    expect(info.label).toBe('Free (until TGE)');
  });

  it('formatFeeDisplay returns "0.0005 NOC" when fee is 500_000n', () => {
    mockStore({tgeStatus: 'claimable', isZeroFeeEligible: false});
    const info = engine.getFeeDisplayInfo('privateTransfer', 0);
    expect(info.amount).toBe(500_000n);
    // 500_000 lamports = 0.0005 NOC (9 decimals)
    expect(info.label).toBe('0.0005 NOC');
  });

  it('formatFeeDisplay includes discount text when discount is applied', () => {
    mockStore({tgeStatus: 'claimable', isZeroFeeEligible: false});
    const info = engine.getFeeDisplayInfo('privateTransfer', 0.1);
    expect(info.discountLabel).toBe('10% staking discount');
    expect(info.discountFraction).toBe(0.1);
  });

  // ---- FEE_DISTRIBUTION integrity ----

  it('FEE_DISTRIBUTION.privateTransfer sums to 1.0', () => {
    const dist = FEE_DISTRIBUTION.privateTransfer;
    const sum = dist.treasury + dist.stakers + dist.burn;
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
  });

  it('FEE_DISTRIBUTION.privateSwap sums to 1.0', () => {
    const dist = FEE_DISTRIBUTION.privateSwap;
    const sum = dist.treasury + dist.stakers + dist.burn;
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
  });

  it('FEE_DISTRIBUTION.transparent sums to 1.0', () => {
    const dist = FEE_DISTRIBUTION.transparent;
    const sum = dist.treasury + dist.stakers + dist.burn;
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
  });

  // ---- SHIELDED_FEES constant ----

  it('SHIELDED_FEES.privateTransfer === 500_000n', () => {
    expect(SHIELDED_FEES.privateTransfer).toBe(500_000n);
  });

  // ---- feeToUsd ----

  it('feeToUsd converts lamports to USD string', () => {
    const {feeToUsd} = require('../feeEngine');
    // 500_000 lamports = 0.0005 NOC, at $2.00/NOC = $0.001
    const result = feeToUsd(500_000n, 2.0);
    expect(result).toBe('$0.0010');
  });

  it('feeToUsd returns null when price is 0', () => {
    const {feeToUsd} = require('../feeEngine');
    expect(feeToUsd(500_000n, 0)).toBeNull();
  });

  // ---- getFeeDisplayInfo usdLabel ----

  it('getFeeDisplayInfo includes usdLabel when price available', () => {
    mockStore({tgeStatus: 'claimable', isZeroFeeEligible: false});
    // Set nocUsdPrice in walletStore mock
    const walletStore = require('../../../store/zustand/walletStore');
    walletStore.useWalletStore.getState.mockReturnValue({nocUsdPrice: 2.0});

    const info = engine.getFeeDisplayInfo('privateTransfer', 0);
    expect(info.usdLabel).not.toBeNull();
    expect(info.usdLabel).toMatch(/^\$/);
  });

  it('getFeeDisplayInfo usdLabel is null when pre-TGE (fee is 0)', () => {
    mockStore({tgeStatus: 'pre_tge'});
    const info = engine.getFeeDisplayInfo('privateTransfer', 0);
    expect(info.usdLabel).toBeNull();
  });
});
