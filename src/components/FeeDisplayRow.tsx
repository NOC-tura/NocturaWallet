import React from 'react';
import {View, Text} from 'react-native';
import type {FeeDisplayInfo} from '../modules/fees/types';

interface FeeDisplayRowProps {
  feeInfo: FeeDisplayInfo;
}

export function FeeDisplayRow({feeInfo}: FeeDisplayRowProps) {
  return (
    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8}} testID="fee-display-row">
      <Text style={{color: '#888', fontSize: 14}}>Fee</Text>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Text style={{color: '#FFF', fontSize: 14}} testID="fee-label">{feeInfo.label}</Text>
        {feeInfo.discountLabel ? (
          <Text style={{color: '#44FF44', fontSize: 12, marginLeft: 8}} testID="fee-discount">
            ({feeInfo.discountLabel})
          </Text>
        ) : null}
      </View>
    </View>
  );
}
