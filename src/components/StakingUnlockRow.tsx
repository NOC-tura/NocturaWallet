import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {StakingPosition} from '../modules/staking/types';

interface StakingUnlockRowProps {
  position: StakingPosition;
}

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export function StakingUnlockRow({position}: StakingUnlockRowProps) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilUnlock = position.unlockAt - nowSeconds;
  const daysUntilUnlock = Math.ceil(secondsUntilUnlock / (24 * 60 * 60));

  if (secondsUntilUnlock > SEVEN_DAYS_SECONDS || secondsUntilUnlock <= 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.unlockIcon}>{'!'}</Text>
        <Text style={styles.unlockText}>
          Your stake unlocks in {daysUntilUnlock} {daysUntilUnlock === 1 ? 'day' : 'days'}
        </Text>
      </View>
      <Text style={styles.hint}>Relock for 10-15% bonus yield</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,179,0,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,179,0,0.3)',
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  unlockIcon: {
    fontSize: 16,
    color: '#FFB300',
    fontWeight: '800',
  },
  unlockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFB300',
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,179,0,0.7)',
    marginLeft: 24,
  },
});
