import React, {useCallback, useRef, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {PinPad} from '../../components/PinPad';
import {KeychainManager} from '../../modules/keychain/keychainModule';

type Step = 'verify' | 'new' | 'confirm';

const keychainManager = new KeychainManager();

export function ChangePinScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<Step>('verify');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const currentPinRef = useRef('');

  const titleMap: Record<Step, string> = {
    verify: 'Enter current PIN',
    new: 'Enter new PIN',
    confirm: 'Confirm new PIN',
  };

  const handleVerify = useCallback(
    async (pin: string) => {
      setLoading(true);
      setError(null);
      try {
        const valid = await keychainManager.verifyPin(pin);
        if (!valid) {
          setError('Current PIN is incorrect');
        } else {
          currentPinRef.current = pin;
          setStep('new');
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleNew = useCallback((pin: string) => {
    setError(null);
    setNewPin(pin);
    setStep('confirm');
  }, []);

  const handleConfirm = useCallback(
    async (pin: string) => {
      if (pin !== newPin) {
        setError('PINs do not match');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await keychainManager.changePin(currentPinRef.current, newPin);
        currentPinRef.current = ''; // Clear old PIN from memory
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    },
    [newPin, navigation],
  );

  const onComplete =
    step === 'verify' ? handleVerify : step === 'new' ? handleNew : handleConfirm;

  return (
    <View style={styles.container}>
      <Text testID="pin-title" style={styles.title}>
        {titleMap[step]}
      </Text>
      <PinPad
        testID="pin-pad"
        onComplete={onComplete}
        maxLength={6}
        error={error}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
  },
});
