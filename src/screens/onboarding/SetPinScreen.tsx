import React, {useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {PinPad} from '../../components/PinPad';
import {KeychainManager} from '../../modules/keychain/keychainModule';

interface SetPinScreenProps {
  onPinSet: () => void;
}

const keychainManager = new KeychainManager();

export function SetPinScreen({onPinSet}: SetPinScreenProps) {
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConfirmStep = firstPin !== null;

  const handlePinComplete = async (pin: string) => {
    if (!isConfirmStep) {
      // Step 1: store the first entry
      setFirstPin(pin);
      setError(null);
    } else {
      // Step 2: verify match
      if (pin === firstPin) {
        await keychainManager.setupPin(pin);
        onPinSet();
      } else {
        setError("PINs don't match — try again");
        setFirstPin(null);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text testID="pin-title" style={styles.title}>
        {isConfirmStep ? 'Confirm PIN' : 'Create PIN'}
      </Text>
      <Text style={styles.subtitle}>
        {isConfirmStep
          ? 'Re-enter your PIN to confirm'
          : 'Choose a 6-digit PIN to secure your wallet'}
      </Text>

      <PinPad
        maxLength={6}
        onComplete={handlePinComplete}
        error={error}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6C6C80',
    textAlign: 'center',
    marginBottom: 32,
  },
});
