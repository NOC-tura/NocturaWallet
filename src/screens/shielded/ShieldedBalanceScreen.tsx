import React from 'react';
import {View, Text, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../types/navigation';
import {useWalletStore} from '../../store/zustand/walletStore';

export function ShieldedBalanceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {shieldedBalances} = useWalletStore();

  const entries = Object.entries(shieldedBalances).filter(([, bal]) => bal !== '0');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Private Balance</Text>

      {entries.length === 0 ? (
        <Text style={styles.emptyText}>No private balances yet. Deposit tokens to get started.</Text>
      ) : (
        entries.map(([mint, balance]) => (
          <View key={mint} style={styles.balanceRow}>
            <Text style={styles.mintText}>{mint.slice(0, 8)}...</Text>
            <Text style={styles.balanceText}>{balance}</Text>
          </View>
        ))
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Deposit', {})}
          accessibilityLabel="Move to private balance"
        >
          <Text style={styles.actionText}>Deposit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('ShieldedTransfer', {})}
          accessibilityLabel="Send privately"
        >
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Withdraw')}
          accessibilityLabel="Move to public balance"
        >
          <Text style={styles.actionText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 32,
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 32,
    marginBottom: 40,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  mintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'monospace',
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 40,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  backText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
  },
});
