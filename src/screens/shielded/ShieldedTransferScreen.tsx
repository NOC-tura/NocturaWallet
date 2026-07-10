import React, {useState, useCallback, useEffect, useRef} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Linking} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {Keypair} from '@solana/web3.js';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../../types/navigation';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';

const securityManager = new ScreenSecurityManager();
import {sendPrivateTransfer} from '../../modules/shielded/transferFlow';
import {warmProver} from '../../modules/zkProver/zkProverModule';
import {maxTransferable} from '../../modules/shielded/noteSelect';
import {getNotes} from '../../modules/shielded/noteStore';
import {shouldRepeatWarning} from '../../modules/shielded/privacyMeter';
import {isValidShieldedAddress} from '../../modules/shielded/shieldedAddressCodec';
import {feeEngine} from '../../modules/fees/feeEngine';
import {keychainManager} from '../../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair} from '../../modules/keyDerivation/transparent';
import {loadTransparentScheme} from '../../modules/keyDerivation/derivationScheme';
import {zeroize} from '../../modules/session/zeroize';
import {SHIELDED_POOL_MINTS} from '../../constants/programs';
import {poolTokenMeta} from '../../modules/shielded/poolTokens';
import {getExplorerUrl} from '../../utils/explorerUrl';
import {PrivacyMeter} from '../../components/PrivacyMeter';
import {FeeDisplayRow} from '../../components/FeeDisplayRow';
import {ProofProgressOverlay} from '../../components/ProofProgressOverlay';
import {ShieldedAddressInput} from '../../components/ShieldedAddressInput';
import {TokenSelector} from '../../components/TokenSelector';
import type {ShieldedScreenStep} from '../../modules/shielded/types';
import {parseTokenAmount, formatTokenAmount} from '../../utils/parseTokenAmount';

// The shielded transfer always targets the single live pool mint — the same
// source ZkProofScreen uses for shield/unshield.
const POOL_MINT = SHIELDED_POOL_MINTS[0] ?? '';
const POOL_META = poolTokenMeta(POOL_MINT);

export function ShieldedTransferScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ShieldedTransfer'>>();
  const {tokens} = useWalletStore();
  const {merkleLeafCount} = useShieldedStore();

  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => { void securityManager.disableSecureScreen(); };
  }, []);

  // Warm the hosted transfer prover on mount so the first real prove of the
  // session isn't a cold-start. Best-effort, fire-and-forget, never throws.
  useEffect(() => {
    void warmProver('transfer');
  }, []);

  const lastTapRef = useRef(0);

  const initialRecipient = route.params?.recipient ?? '';
  const [step, setStep] = useState<ShieldedScreenStep>('input');
  const [selectedMint, setSelectedMint] = useState<string>(
    tokens[0]?.mint ?? '',
  );
  const [recipient, setRecipient] = useState<string>(initialRecipient);
  const [amount, setAmount] = useState<string>('');
  const [privacyDismissed, setPrivacyDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [txSignature, setTxSignature] = useState<string>('');

  const parsedAmount: bigint = (() => {
    try {
      return parseTokenAmount(amount || '0', POOL_META.decimals);
    } catch {
      return 0n;
    }
  })();
  // 2-in transfer cap: cannot spend more than the sum of the two largest notes.
  const maxAmount = maxTransferable(getNotes(POOL_MINT));
  const overCap = parsedAmount > maxAmount;
  const canConfirm =
    isValidShieldedAddress(recipient) && parsedAmount > 0n && !overCap;
  const feeInfo = feeEngine.getFeeDisplayInfo('privateTransfer');
  const showPrivacyMeter =
    shouldRepeatWarning(merkleLeafCount) && !privacyDismissed;

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
    setProgressLabel('Preparing…');
    setStep('proving');
    let seed: Uint8Array | null = null;
    try {
      const mnemonic = await keychainManager.retrieveSeed();
      seed = await mnemonicToSeed(mnemonic);
      const scheme = loadTransparentScheme();
      const {secretKey} = deriveTransparentKeypair(seed, scheme);
      const feePayer = Keypair.fromSecretKey(secretKey);
      const result = await sendPrivateTransfer(
        seed,
        feePayer,
        POOL_MINT,
        recipient,
        parsedAmount,
        label => setProgressLabel(label),
      );
      setTxSignature(result.txSignature);
      setStep('success');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'An error occurred');
      setStep('error');
    } finally {
      if (seed) zeroize(seed);
    }
  }, [canConfirm, recipient, parsedAmount]);

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

  const isOverlayVisible = step === 'proving';

  if (step === 'success') {
    const shortSig =
      txSignature.length > 16
        ? `${txSignature.slice(0, 8)}…${txSignature.slice(-8)}`
        : txSignature;
    return (
      <View style={styles.centered}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successText}>Transfer sent privately</Text>
        {txSignature ? (
          <>
            <Text style={styles.sigLabel}>Transaction</Text>
            <TouchableOpacity
              testID="copy-signature"
              onPress={() => Clipboard.setString(txSignature)}
              accessibilityLabel="Copy transaction signature">
              <Text style={styles.sigValue}>{shortSig}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="view-explorer"
              style={styles.secondaryButton}
              onPress={() => void Linking.openURL(getExplorerUrl(txSignature))}
              accessibilityLabel="View on explorer">
              <Text style={styles.secondaryButtonText}>View on explorer</Text>
            </TouchableOpacity>
          </>
        ) : null}
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
              <Text style={styles.summaryValue}>{POOL_META.symbol}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>{`${amount} ${POOL_META.symbol}`}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Recipient</Text>
              <Text style={styles.summaryValue} numberOfLines={1} ellipsizeMode="middle">
                {recipient}
              </Text>
            </View>
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
        message={progressLabel || 'Securing transaction...'}
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

        {overCap && parsedAmount > 0n ? (
          <Text testID="cap-error" style={styles.errorText}>
            {`Max per private transfer is ${formatTokenAmount(maxAmount, 9)} (two largest notes)`}
          </Text>
        ) : null}

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
    marginBottom: 24,
    textAlign: 'center',
  },
  sigLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  sigValue: {
    color: '#FFF',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
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
