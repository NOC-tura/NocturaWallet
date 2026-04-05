import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {StakingPosition} from '../modules/staking/types';
import {formatStakingAmount} from '../modules/staking/stakingService';

interface StakingPositionCardProps {
  position: StakingPosition;
  onClaimRewards: () => void;
  onExtendLock: () => void;
}

function formatUnlockDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function StakingPositionCard({
  position,
  onClaimRewards,
  onExtendLock,
}: StakingPositionCardProps) {
  const displayAmount = formatStakingAmount(position.stakedAmount);
  const displayRewards = formatStakingAmount(position.accruedRewards);
  const unlockDate = formatUnlockDate(position.unlockAt);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Locked</Text>
        <Text style={styles.value}>{displayAmount} NOC</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Tier</Text>
        <Text style={styles.value}>{position.tier}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Unlock</Text>
        <Text style={styles.value}>{unlockDate}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Accrued Rewards</Text>
        <Text style={styles.rewardValue}>{displayRewards} NOC</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.accentButton]}
          onPress={onClaimRewards}>
          <Text style={styles.accentButtonText}>CLAIM REWARDS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.ghostButton]}
          onPress={onExtendLock}>
          <Text style={styles.ghostButtonText}>EXTEND LOCK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C47FF',
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  accentButton: {
    backgroundColor: '#6C47FF',
  },
  accentButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.5)',
    backgroundColor: 'transparent',
  },
  ghostButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
    letterSpacing: 0.5,
  },
});
