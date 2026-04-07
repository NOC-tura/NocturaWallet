import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {FeeDisplayInfo} from '../modules/fees/types';

interface FeeDisplayRowProps {
  feeInfo: FeeDisplayInfo;
}

export function FeeDisplayRow({feeInfo}: FeeDisplayRowProps) {
  return (
    <View style={styles.row} testID="fee-display-row">
      <Text style={styles.label}>Fee</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} testID="fee-label">{feeInfo.label}</Text>
        {feeInfo.discountLabel ? (
          <Text style={styles.discount} testID="fee-discount">
            ({feeInfo.discountLabel})
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    color: '#888',
    fontSize: 14,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    color: '#FFF',
    fontSize: 14,
  },
  discount: {
    color: '#44FF44',
    fontSize: 12,
    marginLeft: 8,
  },
});
