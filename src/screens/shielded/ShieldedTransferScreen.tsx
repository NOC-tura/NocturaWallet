import React, {useState, useCallback, useEffect, useRef} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../../types/navigation';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';

const securityManager = new ScreenSecurityManager();
import {transfer} from '../../modules/shielded/shieldedService';
import {shouldRepeatWarning} from '../../modules/shielded/privacyMeter';
import {isValidShieldedAddress} from '../../modules/shielded/shieldedAddressCodec';
import {feeEngine} from '../../modules/fees/feeEngine';
import {PrivacyMeter} from '../../components/PrivacyMeter';
import {FeeDisplayRow} from '../../components/FeeDisplayRow';
import {ProofProgressOverlay} from '../../components/ProofProgressOverlay';
import {ShieldedAddressInput} from '../../components/ShieldedAddressInput';
import {TokenSelector} from '../../components/TokenSelector';
import type {ShieldedScreenStep, ConsolidationProgress} from '../../modules/shielded/types';
import {parseTokenAmount} from '../../utils/parseTokenAmount';

export function ShieldedTransferScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ShieldedTransfer'>>();
  const {tokens} = useWalletStore();
  const {merkleLeafCount} = useShieldedStore();

  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => { void securityManager.disableSecureScreen(); };
  }, []);

  const lastTapRef = useRef(0);

  const initialRecipient = route.params?.recipient ?? '';
  const [step, setStep] = useState<ShieldedScreenStep>('input');
  const [selectedMint, setSelectedMint] = useState<string>(
    tokens[0]?.mint ?? '',
  );
  const [recipient, setRecipient] = useState<string>(initialRecipient);
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [privacyDismissed, setPrivacyDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [consolidationProgress, setConsolidationProgress] =
    useState<ConsolidationProgress | undefined>(undefined);

  const parsedAmount: bigint = (() => {
    try {
      return parseTokenAmount(amount || '0', 9);
    } catch {
      return 0n;
    }
  })();
  const canConfirm = isValidShieldedAddress(recipient) && parsedAmount > 0n;
  const feeInfo = feeEngine.getFeeDisplayInfo('privateTransfer');
  const showPrivacyMeter =
    shouldRepeatWarning(merkleLeafCount) && !privacyDismissed;

  const onConsolidationProgress = useCallback(
    (progress: ConsolidationProgress) => {
      setConsolidationProgress(progress);
      setStep('consolidating');
    },
    [],
  );

  const handleReviewTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canConfirm) return;
    setStep('confirm');
  }, [canConfirm]);

  const handleConfirm = useCallback(async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canConfirm) {
      return;
    }
    setStep('proving');
    try {
      await transfer(
        {
          mint: selectedMint,
          amount: parsedAmount,
          recipientAddress: recipient,
          memo: memo || undefined,
        },
        0,
        onConsolidationProgress,
      );
      setStep('success');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'An error occurred');
      setStep('error');
    }
  }, [
    canConfirm,
    selectedMint,
    parsedAmount,
    recipient,
    memo,
    onConsolidationProgress,
  ]);

  const handleBack = useCallback(() => {
    setStep('input');
  }, []);

  const handleTryAgain = useCallback(() => {
    setStep('input');
    setErrorMessage('');
    setConsolidationProgress(undefined);
  }, []);

  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const isOverlayVisible =
    step === 'proving' || step === 'consolidating';

  if (step === 'success') {
    return (
      <View style={styles.centered}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successText}>Transfer sent privately</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleDone} accessibilityLabel="Done">
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
        <TouchableOpacity style={styles.primaryButton} onPress={handleTryAgain} accessibilityLabel="Try again">
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
            Confirm transfer
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
              <Text style={styles.summaryLabel}>Recipient</Text>
              <Text style={styles.summaryValue} numberOfLines={1} ellipsizeMode="middle">
                {recipient}
              </Text>
            </View>
            {memo ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Memo</Text>
                <Text style={styles.summaryValue}>{memo}</Text>
              </View>
            ) : null}
          </View>

          <FeeDisplayRow feeInfo={feeInfo} />

          <TouchableOpacity
            testID="confirm-button"
            style={styles.primaryButton}
            onPress={handleConfirm}
            accessibilityLabel="Confirm transfer">
            <Text style={styles.primaryButtonText}>Confirm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="back-button"
            style={styles.secondaryButton}
            onPress={handleBack}
            accessibilityLabel="Back">
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProofProgressOverlay
        visible={isOverlayVisible}
        message="Securing transaction..."
        consolidation={consolidationProgress}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text testID="screen-title" style={styles.title}>
          Send privately
        </Text>

        {showPrivacyMeter && (
          <PrivacyMeter
            leafCount={merkleLeafCount}
            isFirstDeposit={merkleLeafCount === 0}
            onDismiss={() => setPrivacyDismissed(true)}
          />
        )}

        <ShieldedAddressInput
          value={recipient}
          onChange={setRecipient}
        />

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
          accessibilityLabel="Amount"
        />

        <Text style={styles.label}>Memo</Text>
        <TextInput
          testID="memo-input"
          style={styles.input}
          value={memo}
          onChangeText={setMemo}
          placeholder="Add a note..."
          placeholderTextColor="#555"
          accessibilityLabel="Memo"
        />

        <Text testID="change-note" style={styles.changeNote}>
          Remainder stays in your private balance
        </Text>

        <FeeDisplayRow feeInfo={feeInfo} />

        <TouchableOpacity
          testID="confirm-button"
          style={[styles.primaryButton, !canConfirm && styles.disabledButton]}
          onPress={handleReviewTap}
          disabled={!canConfirm}
          accessibilityLabel="Review transfer">
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
  changeNote: {
    color: '#888',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
    fontStyle: 'italic',
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
