import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {getPrivacyLevel} from '../modules/shielded/privacyMeter';

interface PrivacyMeterProps {
  leafCount: number;
  isFirstDeposit: boolean;
  onDismiss: () => void;
}

const COLORS = {
  red: {bg: '#2D1B1B', border: '#FF4444', text: '#FF6666'},
  yellow: {bg: '#2D2A1B', border: '#FFAA44', text: '#FFCC66'},
  green: {bg: '#1B2D1B', border: '#44FF44', text: '#66FF66'},
} as const;

export function PrivacyMeter({leafCount, isFirstDeposit, onDismiss}: PrivacyMeterProps) {
  const {message, color, shouldShow} = getPrivacyLevel(leafCount, isFirstDeposit);
  if (!shouldShow) return null;
  const scheme = COLORS[color];

  return (
    <View
      style={[styles.container, {backgroundColor: scheme.bg, borderColor: scheme.border}]}
      testID="privacy-meter"
    >
      <View style={styles.row}>
        <Text style={[styles.message, {color: scheme.text}]}>{message}</Text>
        <TouchableOpacity onPress={onDismiss} testID="privacy-meter-dismiss" accessibilityLabel="Dismiss privacy warning">
          <Text style={styles.dismissButton}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    flex: 1,
  },
  dismissButton: {
    color: '#888',
    fontSize: 18,
    paddingLeft: 8,
  },
});
