import React, {useCallback, useState} from 'react';
import {View, TextInput, Text, TouchableOpacity, Clipboard, StyleSheet} from 'react-native';
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
    <View style={styles.container}>
      <Text style={styles.label}>Recipient address</Text>
      <View style={[styles.inputRow, (showError || error) ? styles.inputRowError : styles.inputRowNormal]}>
        <TextInput
          style={styles.input}
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
          <Text style={styles.pasteButton}>Paste</Text>
        </TouchableOpacity>
      </View>
      {(showError || error) && (
        <Text style={styles.errorText} testID="address-error">
          {error ?? 'Invalid private address. Must start with noc1.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  inputRowNormal: {
    borderColor: '#333',
  },
  inputRowError: {
    borderColor: '#FF4444',
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
  },
  pasteButton: {
    color: '#6C63FF',
    fontSize: 14,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 12,
    marginTop: 4,
  },
});
