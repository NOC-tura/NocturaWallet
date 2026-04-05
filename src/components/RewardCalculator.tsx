import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {StakingTier} from '../modules/staking/types';
import {
  calculateProjectedReward,
  formatStakingAmount,
} from '../modules/staking/stakingService';

interface RewardCalculatorProps {
  amount: string;
  tierId: StakingTier['id'];
}

export function RewardCalculator({amount, tierId}: RewardCalculatorProps) {
  const rewardLamports = calculateProjectedReward(amount, tierId);
  const rewardDisplay = formatStakingAmount(rewardLamports);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Projected Reward</Text>
      <Text style={styles.value}>{rewardDisplay} NOC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(108,71,255,0.08)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(108,71,255,0.25)',
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C47FF',
  },
});
