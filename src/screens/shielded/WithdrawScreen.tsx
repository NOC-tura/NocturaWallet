import React, {useState, useCallback} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {withdraw} from '../../modules/shielded/shieldedService';
import {feeEngine} from '../../modules/fees/feeEngine';
import {FeeDisplayRow} from '../../components/FeeDisplayRow';
import {ProofProgressOverlay} from '../../components/ProofProgressOverlay';
import {NOC_MINT} from '../../constants/programs';
import type {ShieldedScreenStep} from '../../modules/shielded/types';

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function WithdrawScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const [step, setStep] = useState<ShieldedScreenStep>('input');
  const [destination, setDestination] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const parsedAmount: bigint = BigInt(
    Math.round(parseFloat(amount || '0') * 1e9),
  );
  const isValidDestination = SOLANA_ADDRESS_REGEX.test(destination);
  const canConfirm = isValidDestination && parsedAmount > 0n;
  const feeInfo = feeEngine.getFeeDisplayInfo('crossModeWithdraw');

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) {
      return;
    }
    setStep('proving');
    try {
      await withdraw({
        mint: NOC_MINT,
        amount: parsedAmount,
        destinationPubkey: destination,
      });
      setStep('success');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'An error occurred');
      setStep('error');
    }
  }, [canConfirm, parsedAmount, destination]);

  const handleTryAgain = useCallback(() => {
    setStep('input');
    setErrorMessage('');
  }, []);

  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (step === 'success') {
    return (
      <View style={styles.centered}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successText}>Moved to public balance</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>✗</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleTryAgain}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProofProgressOverlay
        visible={step === 'proving'}
        message="Securing transaction..."
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text testID="screen-title" style={styles.title}>
          Move to public balance
        </Text>

        <View testID="withdraw-warning" style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Withdrawal is NOT linkable to your deposit history
          </Text>
        </View>

        <Text style={styles.label}>Destination address</Text>
        <TextInput
          testID="destination-input"
          style={styles.input}
          value={destination}
          onChangeText={setDestination}
          placeholder="Solana address"
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          testID="amount-input"
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#555"
          keyboardType="decimal-pad"
        />

        <FeeDisplayRow feeInfo={feeInfo} />

        <TouchableOpacity
          testID="confirm-button"
          style={[styles.primaryButton, !canConfirm && styles.disabledButton]}
          onPress={handleConfirm}
          disabled={!canConfirm}>
          <Text style={styles.primaryButtonText}>Confirm</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  scrollContent: {
    padding: 20,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0A0A1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  warningBanner: {
    backgroundColor: '#2D1B1B',
    borderWidth: 1,
    borderColor: '#FF4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  warningText: {
    color: '#FF6666',
    fontSize: 14,
    textAlign: 'center',
  },
  label: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    color: '#FFF',
    fontSize: 16,
    padding: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successIcon: {
    fontSize: 64,
    color: '#44FF44',
    marginBottom: 16,
  },
  successText: {
    fontSize: 18,
    color: '#44FF44',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 64,
    color: '#FF4444',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    marginBottom: 32,
    textAlign: 'center',
  },
});
