import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
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
      style={{backgroundColor: scheme.bg, borderWidth: 1, borderColor: scheme.border, borderRadius: 12, padding: 12, marginBottom: 16}}
      testID="privacy-meter"
    >
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={{color: scheme.text, fontSize: 14, flex: 1}}>{message}</Text>
        <TouchableOpacity onPress={onDismiss} testID="privacy-meter-dismiss" accessibilityLabel="Dismiss privacy warning">
          <Text style={{color: '#888', fontSize: 18, paddingLeft: 8}}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
