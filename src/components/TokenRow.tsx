import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface TokenRowProps {
  symbol: string;
  name: string;
  balance: string;
  usdValue?: number;
  trust: 'core' | 'verified' | 'unknown';
  isPinned?: boolean;
  hidden?: boolean;
  /** Staking info — shown below balance for NOC token */
  stakedAmount?: string;
  stakingTierLabel?: string;
  unlockAt?: number;
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUnlockTime(unlockAt: number): string {
  const remaining = unlockAt - Date.now();
  if (remaining <= 0) return 'Unlocked';
  const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export function TokenRow({symbol, name, balance, usdValue, trust, isPinned, hidden = false, stakedAmount, stakingTierLabel, unlockAt}: TokenRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{symbol.charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.nameGroup}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {isPinned === true && <Text style={styles.pinIndicator}>📌</Text>}
        </View>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{symbol}</Text>
          {trust === 'unknown' && (
            <View style={styles.unverifiedBadge}>
              <Text style={styles.unverifiedText}>⚠️ Unverified</Text>
            </View>
          )}
        </View>
      </View>

      <View
        style={styles.valueGroup}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
        <Text style={styles.balance}>{balance}</Text>
        {usdValue !== undefined && (
          <Text style={styles.usd}>{formatUsd(usdValue)}</Text>
        )}
        {stakedAmount && !hidden && (
          <Text style={styles.stakingInfo} testID="staking-info">
            Staked: {stakedAmount}{stakingTierLabel ? ` (${stakingTierLabel})` : ''}
          </Text>
        )}
        {unlockAt !== undefined && !hidden && (
          <Text
            style={[styles.unlockInfo, unlockAt - Date.now() <= 7 * 24 * 60 * 60 * 1000 && styles.unlockSoon]}
            testID="unlock-info"
          >
            {formatUnlockTime(unlockAt)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108,71,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C47FF',
  },
  nameGroup: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pinIndicator: {
    fontSize: 12,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  symbol: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
  unverifiedBadge: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  unverifiedText: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: '500',
  },
  valueGroup: {
    alignItems: 'flex-end',
  },
  balance: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  usd: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  stakingInfo: {
    fontSize: 11,
    color: '#6C47FF',
    marginTop: 3,
    fontWeight: '500',
  },
  unlockInfo: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  unlockSoon: {
    color: '#FBBF24',
  },
});
