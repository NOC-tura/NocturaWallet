import React, {useState, useCallback} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../../types/navigation';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
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

export function ShieldedTransferScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ShieldedTransfer'>>();
  const {tokens} = useWalletStore();
  const {merkleLeafCount} = useShieldedStore();

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

  const parsedAmount: bigint = BigInt(
    Math.round(parseFloat(amount || '0') * 1e9),
  );
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

  const handleConfirm = useCallback(async () => {
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
        />

        <Text style={styles.label}>Memo</Text>
        <TextInput
          testID="memo-input"
          style={styles.input}
          value={memo}
          onChangeText={setMemo}
          placeholder="Add a note..."
          placeholderTextColor="#555"
        />

        <Text testID="change-note" style={styles.changeNote}>
          Remainder stays in your private balance
        </Text>

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
