import React, {useState, useRef} from 'react';
import {View, Text, ActivityIndicator, StyleSheet, Alert} from 'react-native';
import {PinPad} from '../../components/PinPad';
import {KeychainManager} from '../../modules/keychain/keychainModule';

interface SetPinScreenProps {
  onPinSet: () => void;
}

const keychainManager = new KeychainManager();

export function SetPinScreen({onPinSet}: SetPinScreenProps) {
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const onPinSetRef = useRef(onPinSet);
  onPinSetRef.current = onPinSet;

  const isConfirmStep = firstPin !== null;

  const handlePinComplete = async (pin: string) => {
    if (saving) return;

    if (!isConfirmStep) {
      setFirstPin(pin);
      setError(null);
      setResetKey(k => k + 1); // Reset PinPad for confirm step
    } else {
      if (pin === firstPin) {
        setSaving(true);
        try {
          await keychainManager.setupPin(pin);
          onPinSetRef.current();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          Alert.alert('Error', `Failed to save PIN: ${msg}`);
          setFirstPin(null);
          setSaving(false);
        }
      } else {
        setError("PINs don't match — try again");
        setFirstPin(null);
        setResetKey(k => k + 1); // Reset PinPad for retry
      }
    }
  };

  if (saving) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Securing your wallet...</Text>
        <ActivityIndicator color="#6C47FF" size="large" style={styles.loader} />
      </View>
    );
  }

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
        resetKey={resetKey}
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
  loader: {
    marginTop: 32,
  },
});
