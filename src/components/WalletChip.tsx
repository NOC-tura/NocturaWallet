import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface WalletChipProps {
  address: string;
  onCopy: () => void;
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletChip({address, onCopy}: WalletChipProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.address}>{truncateAddress(address)}</Text>
      <TouchableOpacity onPress={onCopy} hitSlop={8} style={styles.copyButton} accessibilityLabel="Copy wallet address">
        <Text style={styles.copyIcon}>📋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
  },
  address: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  copyButton: {
    marginLeft: 8,
  },
  copyIcon: {
    fontSize: 14,
  },
});
