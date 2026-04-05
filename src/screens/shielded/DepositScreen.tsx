import React, {useState, useCallback, useRef} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {deposit} from '../../modules/shielded/shieldedService';
import {shouldRepeatWarning} from '../../modules/shielded/privacyMeter';
import {feeEngine} from '../../modules/fees/feeEngine';
import {PrivacyMeter} from '../../components/PrivacyMeter';
import {FeeDisplayRow} from '../../components/FeeDisplayRow';
import {ProofProgressOverlay} from '../../components/ProofProgressOverlay';
import {TokenSelector} from '../../components/TokenSelector';
import type {ShieldedScreenStep} from '../../modules/shielded/types';

export function DepositScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const {publicKey, tokens} = useWalletStore();
  const {merkleLeafCount} = useShieldedStore();

  const lastTapRef = useRef(0);

  const [step, setStep] = useState<ShieldedScreenStep>('input');
  const [selectedMint, setSelectedMint] = useState<string>(
    tokens[0]?.mint ?? '',
  );
  const [amount, setAmount] = useState<string>('');
  const [privacyDismissed, setPrivacyDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const parsedAmount: bigint = BigInt(
    Math.round(parseFloat(amount || '0') * 1e9),
  );
  const canConfirm = parsedAmount > 0n;
  const feeInfo = feeEngine.getFeeDisplayInfo('crossModeDeposit');
  const showPrivacyMeter =
    shouldRepeatWarning(merkleLeafCount) && !privacyDismissed;

  const handleReviewTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canConfirm || publicKey === null) return;
    setStep('confirm');
  }, [canConfirm, publicKey]);

  const handleConfirm = useCallback(async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canConfirm || publicKey === null) {
      return;
    }
    setStep('proving');
    try {
      await deposit({
        mint: selectedMint,
        amount: parsedAmount,
        senderPubkey: publicKey,
      });
      setStep('success');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'An error occurred');
      setStep('error');
    }
  }, [canConfirm, publicKey, selectedMint, parsedAmount]);

  const handleBack = useCallback(() => {
    setStep('input');
  }, []);

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
        <Text style={styles.successText}>Moved to private balance</Text>
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

  if (step === 'confirm') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text testID="screen-title" style={styles.title}>
            Confirm deposit
          </Text>

          <View testID="confirm-summary" style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Token</Text>
              <Text style={styles.summaryValue}>{selectedMint}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>{amount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Destination</Text>
              <Text style={styles.summaryValue}>Private balance</Text>
            </View>
          </View>

          <FeeDisplayRow feeInfo={feeInfo} />

          <TouchableOpacity
            testID="confirm-button"
            style={styles.primaryButton}
            onPress={handleConfirm}>
            <Text style={styles.primaryButtonText}>Confirm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="back-button"
            style={styles.secondaryButton}
            onPress={handleBack}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
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
          Move to private balance
        </Text>

        {showPrivacyMeter && (
          <PrivacyMeter
            leafCount={merkleLeafCount}
            isFirstDeposit={merkleLeafCount === 0}
            onDismiss={() => setPrivacyDismissed(true)}
          />
        )}

        <Text style={styles.label}>Token</Text>
        <TokenSelector
          tokens={tokens.map(t => ({mint: t.mint, symbol: t.symbol}))}
          selected={selectedMint}
          onSelect={setSelectedMint}
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
          onPress={handleReviewTap}
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
  summaryCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 14,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  primaryButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  secondaryButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
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
