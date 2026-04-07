import React, {useCallback, useState} from 'react';
import {View, TextInput, Text, TouchableOpacity, Clipboard} from 'react-native';
import {isValidShieldedAddress} from '../modules/shielded/shieldedAddressCodec';

interface ShieldedAddressInputProps {
  value: string;
  onChange: (addr: string) => void;
  error?: string;
}

export function ShieldedAddressInput({value, onChange, error}: ShieldedAddressInputProps) {
  const [touched, setTouched] = useState(false);

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getString();
    if (text) {
      onChange(text.trim());
      setTouched(true);
    }
  }, [onChange]);

  const showError = touched && value.length > 0 && !isValidShieldedAddress(value);

  return (
    <View style={{marginBottom: 16}}>
      <Text style={{color: '#888', fontSize: 12, marginBottom: 4}}>Recipient address</Text>
      <View style={{flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 12, borderWidth: 1, borderColor: showError || error ? '#FF4444' : '#333', padding: 12}}>
        <TextInput
          style={{flex: 1, color: '#FFF', fontSize: 14}}
          value={value}
          onChangeText={text => { onChange(text); setTouched(true); }}
          placeholder="noc1..."
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
          testID="shielded-address-input"
          accessibilityLabel="Recipient shielded address"
        />
        <TouchableOpacity onPress={handlePaste} testID="paste-button" accessibilityLabel="Paste address">
          <Text style={{color: '#6C63FF', fontSize: 14}}>Paste</Text>
        </TouchableOpacity>
      </View>
      {(showError || error) && (
        <Text style={{color: '#FF4444', fontSize: 12, marginTop: 4}} testID="address-error">
          {error ?? 'Invalid private address. Must start with noc1.'}
        </Text>
      )}
    </View>
  );
}
