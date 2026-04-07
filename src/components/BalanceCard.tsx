import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface BalanceCardProps {
  solBalance: string;
  nocBalance: string;
  totalUsdValue: number;
  nocUsdPrice: number;
  hidden: boolean;
  mode: 'transparent' | 'shielded';
}

const MASK = '•••••';

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BalanceCard({
  solBalance,
  nocBalance,
  totalUsdValue,
  nocUsdPrice,
  hidden,
  mode,
}: BalanceCardProps) {
  // NOC USD = nocBalance (lamports as string) converted to display units * price
  // Note: balances are stored as lamport strings (BigInt). For USD display,
  // we convert to float only at the UI layer (cardinal rule: BigInt for storage, float for display).
  const nocLamports = parseFloat(nocBalance) || 0;
  const nocDisplay = nocLamports / 1e9; // 9 decimals
  const nocUsd = nocDisplay * nocUsdPrice;
  // SOL USD = total portfolio minus NOC USD (avoids needing a separate SOL price prop)
  const solUsd = Math.max(0, totalUsdValue - nocUsd);

  return (
    <View style={[styles.container, mode === 'shielded' && styles.shieldedContainer]}>
      <View style={styles.row}>
        <Text style={styles.symbol}>SOL</Text>
        <View
          style={styles.valueGroup}
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
          <Text style={styles.balance}>{hidden ? MASK : solBalance}</Text>
          <Text style={styles.usd}>{hidden ? MASK : formatUsd(solUsd)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.symbol}>NOC</Text>
        <View
          style={styles.valueGroup}
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
          <Text style={styles.balance}>{hidden ? MASK : nocBalance}</Text>
          <Text style={styles.usd}>{hidden ? MASK : formatUsd(nocUsd)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total Portfolio</Text>
        <View
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
          <Text style={styles.totalValue}>
            {hidden ? MASK : formatUsd(totalUsdValue)}
          </Text>
        </View>
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
  shieldedContainer: {
    borderColor: 'rgba(108,71,255,0.4)',
    backgroundColor: 'rgba(108,71,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  symbol: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
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
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
