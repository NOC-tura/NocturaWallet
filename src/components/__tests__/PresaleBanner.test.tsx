import React from 'react';
import {render} from '@testing-library/react-native';
import {PresaleBanner} from '../PresaleBanner';
import {usePresaleStore} from '../../store/zustand/presaleStore';

function seedStore(partial: Record<string, unknown>) {
  usePresaleStore.setState({
    currentStage: 1,
    pricePerNoc: '0.1501',
    soldInStage: (839030n * 1_000_000_000n).toString(),
    stageCapacity: (10_240_000n * 1_000_000_000n).toString(),
    tgeStatus: 'pre_tge',
    tokensPurchased: '0',
    claimedTokens: '0',
    referralBonusTokens: '0',
    ...partial,
  });
}

describe('PresaleBanner (buy state)', () => {
  it('renders the live stage + USD price + % to next stage', () => {
    seedStore({});
    const {getByText} = render(<PresaleBanner onPress={() => {}} />);
    getByText('NOC Presale · Stage 1');
    // 839030 / 10,240,000 ≈ 8%
    getByText('$0.1501 · 8% to next stage');
  });

  it('falls back to Stage 1 + stage-1 price when the store is empty (no 0.0012)', () => {
    seedStore({currentStage: null, pricePerNoc: null, soldInStage: null, stageCapacity: null});
    const {getByText, queryByText} = render(<PresaleBanner onPress={() => {}} />);
    getByText('NOC Presale · Stage 1');
    expect(queryByText(/0\.0012/)).toBeNull();
    expect(queryByText(/SOL/)).toBeNull();
  });
});
