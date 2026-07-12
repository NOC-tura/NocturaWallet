import React, {useState, useCallback, useEffect, useRef, useMemo} from 'react';
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {Keypair} from '@solana/web3.js';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {
  ArrowLeft,
  ShieldCheck,
  ClipboardPaste,
  X,
  Check,
  AlertTriangle,
  Lock,
  Copy,
  ExternalLink,
  ScanLine,
  ChevronDown,
} from 'lucide-react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../types/navigation';
import {Text} from '../../components/ui';
import {TokenLogo} from '../../components/TokenLogo';
import {cn} from '../../utils/cn';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import {sendPrivateTransfer} from '../../modules/shielded/transferFlow';
import {warmProver} from '../../modules/zkProver/zkProverModule';
import {maxTransferable} from '../../modules/shielded/noteSelect';
import {getNotes, getBalance} from '../../modules/shielded/noteStore';
import {getPrivacyStrength} from '../../modules/shielded/privacyMeter';
import {isValidShieldedAddress} from '../../modules/shielded/shieldedAddressCodec';
import {keychainManager} from '../../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair} from '../../modules/keyDerivation/transparent';
import {loadTransparentScheme} from '../../modules/keyDerivation/derivationScheme';
import {zeroize} from '../../modules/session/zeroize';
import {SHIELDED_POOL_MINTS} from '../../constants/programs';
import {ProofProgressOverlay} from '../../components/ProofProgressOverlay';
import type {ShieldedScreenStep} from '../../modules/shielded/types';
import {parseTokenAmount, formatTokenAmount} from '../../utils/parseTokenAmount';
import {poolTokenMeta} from '../../modules/shielded/poolTokens';
import {formatAddress} from '../../utils/formatAddress';

const securityManager = new ScreenSecurityManager();

// The shielded transfer always targets the single live pool mint — the same
// source ZkProofScreen uses for shield/unshield.
const POOL_MINT = SHIELDED_POOL_MINTS[0] ?? '';
const POOL_META = poolTokenMeta(POOL_MINT);

// Shielded is devnet-only (see project memory); point the explorer at the devnet
// cluster like ZkProofScreen, otherwise a mainnet explorer can't locate the tx.
const shieldedExplorerUrl = (sig: string): string =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

// Mint accent (index.html §s12 shielded variant · §8 status mapping).
const ACCENT = '#5BE3C2';

// Thousands grouping without Intl (Hermes ships no full Intl on some builds).
const groupThousands = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * #12 Send — SHIELDED variant (private transfer). Mirrors the transparent Send
 * (#12) DS/layout with the mint accent + a Privacy Meter card + ZK-proof fee row
 * + "Send private" CTA (index.html §s12 shielded). Recipient is a noc1… shielded
 * payment code; the flow runs a 2-in/2-out ZK transfer via sendPrivateTransfer.
 *
 * Steps: input → confirm → proving (staged overlay) → success (receipt with tx
 * signature + explorer) / error.
 */
export function ShieldedTransferScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ShieldedTransfer'>>();
  const {merkleLeafCount} = useShieldedStore();

  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => {
      void securityManager.disableSecureScreen();
    };
  }, []);

  // Warm the hosted transfer prover on mount so the first real prove isn't a
  // cold-start. Best-effort, fire-and-forget, never throws.
  useEffect(() => {
    void warmProver('transfer');
  }, []);

  const lastTapRef = useRef(0);

  const [step, setStep] = useState<ShieldedScreenStep>('input');
  const [recipient, setRecipient] = useState<string>(route.params?.recipient ?? '');
  const [amount, setAmount] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [txSignature, setTxSignature] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Spendable now (sum of unspent notes) and the 2-in cap (sum of the two largest
  // notes — the most that fits in one transfer). MAX targets the cap.
  const shieldedBalance = useMemo<bigint>(() => {
    try {
      return getBalance(POOL_MINT);
    } catch {
      return 0n;
    }
  }, []);
  const maxAmount = useMemo<bigint>(() => {
    try {
      return maxTransferable(getNotes(POOL_MINT));
    } catch {
      return 0n;
    }
  }, []);

  const parsedAmount: bigint = useMemo(() => {
    try {
      return parseTokenAmount(amount || '0', POOL_META.decimals);
    } catch {
      return 0n;
    }
  }, [amount]);

  const validRecipient = isValidShieldedAddress(recipient);
  const overCap = parsedAmount > maxAmount;
  const insufficient = parsedAmount > shieldedBalance;
  const canReview =
    validRecipient && parsedAmount > 0n && !overCap && !insufficient;

  // 5-bar privacy strength derived from the real on-chain anonymity set.
  const privacyStrength = getPrivacyStrength(merkleLeafCount);
  const privacyToneColor =
    privacyStrength.tone === 'accent'
      ? ACCENT
      : privacyStrength.tone === 'warn'
        ? '#E7B54A'
        : privacyStrength.tone === 'danger'
          ? '#FF5C6A'
          : '#6E727A';

  const handlePaste = useCallback(async () => {
    try {
      const clip = await Clipboard.getString();
      if (clip) setRecipient(clip.trim());
    } catch {
      // best-effort
    }
  }, []);

  const handleMax = useCallback(() => {
    setAmount(formatTokenAmount(maxAmount, POOL_META.decimals));
  }, [maxAmount]);

  // Opens the shared QR scanner modal (#14). Same route the transparent Send
  // uses; the camera→recipient return plumbing (#14) is a project-wide gap, not
  // wired here nor there.
  const handleQrScan = useCallback(() => {
    rootNav.navigate('ScanModal');
  }, [rootNav]);

  const handleReviewTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canReview) return;
    setStep('confirm');
  }, [canReview]);

  const handleConfirm = useCallback(async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canReview) return;
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
  }, [canReview, recipient, parsedAmount]);

  const handleCopySig = useCallback(() => {
    Clipboard.setString(txSignature);
    setCopied(true);
  }, [txSignature]);

  const handleDone = useCallback(() => navigation.goBack(), [navigation]);
  const handleTryAgain = useCallback(() => {
    setStep('input');
    setErrorMessage('');
  }, []);

  // ── Success receipt ────────────────────────────────────────────────────────
  if (step === 'success') {
    const shortSig =
      txSignature.length > 16
        ? `${txSignature.slice(0, 8)}…${txSignature.slice(-8)}`
        : txSignature;
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-bg-base">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-icon-hero bg-accent-shielded-tint items-center justify-center mb-5">
            <ShieldCheck size={40} color={ACCENT} strokeWidth={1.75} />
          </View>
          <Text variant="h2" className="text-center mb-1">
            Sent privately
          </Text>
          <Text variant="body" className="text-center text-fg-secondary mb-6">
            <Text variant="body" numeral className="text-accent-shielded font-geist-semibold">
              {amount} {POOL_META.symbol}
            </Text>{' '}
            moved inside the shielded pool
          </Text>

          {txSignature ? (
            <Pressable
              onPress={handleCopySig}
              testID="copy-signature"
              accessibilityRole="button"
              accessibilityLabel="Copy transaction signature"
              className="w-full rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-3 active:bg-bg-surface-2">
              <View className="flex-row items-center justify-between mb-1">
                <Text variant="overline" className={copied ? 'text-success' : ''}>
                  {copied ? 'Copied' : 'Transaction'}
                </Text>
                {copied ? (
                  <Check size={14} color="#3FD68B" strokeWidth={2.5} />
                ) : (
                  <Copy size={14} color="#A8ACB5" strokeWidth={1.75} />
                )}
              </View>
              <Text variant="body-sm" mono className="text-fg-primary">
                {shortSig}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View className="px-6 pb-8 pt-2 flex-row gap-3 border-t border-bg-surface-2 bg-bg-base">
          {txSignature ? (
            <Pressable
              onPress={() => void Linking.openURL(shieldedExplorerUrl(txSignature))}
              testID="view-explorer"
              accessibilityRole="button"
              accessibilityLabel="View on explorer"
              className="flex-1 min-h-touch-rec rounded-pill bg-bg-surface-2 items-center justify-center flex-row gap-2 active:opacity-80">
              <ExternalLink size={18} color="#F4F5F7" strokeWidth={1.75} />
              <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
                Explorer
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleDone}
            accessibilityRole="button"
            accessibilityLabel="Done"
            className="flex-1 min-h-touch-rec rounded-pill bg-accent-shielded items-center justify-center active:opacity-90">
            <Text variant="body-lg" className="font-geist-semibold text-bg-base">
              Done
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-bg-base">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-icon-hero bg-[rgba(255,92,106,0.18)] items-center justify-center mb-5">
            <AlertTriangle size={36} color="#FF5C6A" strokeWidth={1.75} />
          </View>
          <Text variant="h2" className="text-center mb-2">
            Transfer failed
          </Text>
          <Text testID="transfer-error" variant="body" className="text-center text-fg-secondary max-w-sm">
            {errorMessage}
          </Text>
        </View>
        <View className="px-6 pb-8 pt-2 border-t border-bg-surface-2 bg-bg-base">
          <Pressable
            onPress={handleTryAgain}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            className="min-h-touch-rec rounded-pill bg-accent-shielded items-center justify-center active:opacity-90">
            <Text variant="body-lg" className="font-geist-semibold text-bg-base">
              Try again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Confirm ────────────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-bg-base">
        <View className="flex-row items-center px-4 py-3 min-h-touch-min">
          <Pressable
            onPress={() => setStep('input')}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-12 h-12 items-center justify-center -ml-2">
            <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
          <View className="ml-1 flex-1 flex-row items-center gap-2">
            <ShieldCheck size={18} color={ACCENT} strokeWidth={2} />
            <Text testID="screen-title" variant="h1">
              Confirm private send
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-6">
          <View
            testID="confirm-summary"
            className="rounded-lg bg-bg-surface-1 border border-accent-shielded/30 p-4 mb-4">
            <SummaryRow label="Token" value={POOL_META.symbol} />
            <SummaryRow label="Amount" value={`${amount} ${POOL_META.symbol}`} accent />
            <SummaryRow label="To" value={formatAddress(recipient)} mono />
          </View>

          <View className="flex-row items-start gap-2 rounded-lg p-3 mb-4 bg-accent-shielded-tint border border-accent-shielded/30">
            <ShieldCheck size={16} color={ACCENT} strokeWidth={2} />
            <Text variant="caption" className="flex-1 text-shield-300">
              Sender, recipient and amount are unlinkable on-chain. The remainder
              stays in your private balance.
            </Text>
          </View>
        </ScrollView>

        <View className="px-6 pb-8 pt-2 border-t border-bg-surface-2 bg-bg-base">
          <Pressable
            onPress={handleConfirm}
            testID="confirm-button"
            accessibilityRole="button"
            accessibilityLabel="Confirm private send"
            className="min-h-touch-rec rounded-pill bg-accent-shielded items-center justify-center flex-row gap-2 active:opacity-90">
            <Lock size={18} color="#0A0A0A" strokeWidth={2} />
            <Text variant="body-lg" className="font-geist-semibold text-bg-base">
              {`Send ${amount} ${POOL_META.symbol} privately`}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg-base">
      <ProofProgressOverlay
        visible={step === 'proving'}
        message={progressLabel || 'Securing transaction...'}
      />

      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <View className="ml-1 flex-1 flex-row items-center gap-2">
          <ShieldCheck size={18} color={ACCENT} strokeWidth={2} />
          <Text testID="screen-title" variant="h1">
            Send private
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Eyebrow + token chip on one row (index.html #12 shielded, l.6705) */}
          <View className="flex-row items-center justify-between mb-4">
            <Text variant="overline" className="text-accent-shielded">
              Shielded · vault
            </Text>
            {/* Single live pool token → chip is display-only; a picker is a no-op
                while the pool holds one mint. */}
            <View className="flex-row items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-pill bg-bg-surface-1 border border-bg-surface-3">
              <TokenLogo symbol={POOL_META.symbol} isNoc={false} />
              <Text variant="body-lg" className="text-fg-primary">
                {POOL_META.symbol}
              </Text>
              <ChevronDown size={16} color="#6E727A" strokeWidth={2} />
            </View>
          </View>

          {/* Recipient (index.html #12 shielded, l.6709–6717) */}
          <View className="mb-4">
            <Text
              variant="overline"
              className={cn('mb-2', recipient.length > 0 && !validRecipient && 'text-danger')}>
              Recipient
            </Text>
            <View
              className={cn(
                'rounded-md border bg-bg-surface-1 p-4 gap-2',
                recipient.length > 0 && !validRecipient && 'border-danger',
                validRecipient && 'border-accent-shielded',
                recipient.length === 0 && 'border-bg-surface-3',
              )}>
              <TextInput
                testID="recipient-input"
                value={recipient}
                onChangeText={setRecipient}
                placeholder="Address or shielded payment code"
                placeholderTextColor="#6E727A"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                accessibilityLabel="Recipient shielded address"
                className="font-geist-mono text-body-sm text-fg-primary"
                style={{minHeight: 22}}
              />
              <View className="flex-row items-center gap-1">
                {recipient ? (
                  <Pressable
                    onPress={() => setRecipient('')}
                    accessibilityRole="button"
                    accessibilityLabel="Clear"
                    className="w-9 h-9 items-center justify-center rounded-pill active:bg-bg-surface-2">
                    <X size={18} color="#A8ACB5" strokeWidth={1.75} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handlePaste}
                    accessibilityRole="button"
                    accessibilityLabel="Paste"
                    className="w-9 h-9 items-center justify-center rounded-pill active:bg-bg-surface-2">
                    <ClipboardPaste size={18} color="#A8ACB5" strokeWidth={1.75} />
                  </Pressable>
                )}
                <Pressable
                  onPress={handleQrScan}
                  accessibilityRole="button"
                  accessibilityLabel="Scan QR"
                  testID="qr-scan-button"
                  className="w-9 h-9 items-center justify-center rounded-pill active:bg-bg-surface-2">
                  <ScanLine size={18} color="#A8ACB5" strokeWidth={1.75} />
                </Pressable>
              </View>
            </View>
            {recipient.length > 0 && !validRecipient ? (
              <View className="flex-row items-center gap-2 mt-2">
                <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
                <Text variant="caption" className="text-danger flex-1">
                  Invalid private address. Must start with noc1.
                </Text>
              </View>
            ) : validRecipient ? (
              <View className="flex-row items-center gap-2 mt-2">
                <Check size={12} color={ACCENT} strokeWidth={2.5} />
                <Text variant="caption" className="text-accent-shielded flex-1">
                  Valid payment code
                </Text>
              </View>
            ) : null}
          </View>

          {/* Amount */}
          <View className="mb-4">
            <Text
              variant="overline"
              className={cn('mb-2', (insufficient || overCap) && 'text-danger')}>
              Amount
            </Text>
            <View
              className={cn(
                'rounded-md border bg-bg-surface-1 p-4',
                insufficient || overCap ? 'border-danger' : 'border-bg-surface-3',
              )}>
              <View className="flex-row items-baseline gap-3">
                <TextInput
                  testID="amount-input"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.000000"
                  placeholderTextColor="#6E727A"
                  keyboardType="decimal-pad"
                  accessibilityLabel="Amount"
                  className={cn(
                    'flex-1 font-geist text-balance-lg',
                    insufficient || overCap ? 'text-danger' : 'text-fg-primary',
                  )}
                />
                <Pressable
                  onPress={handleMax}
                  accessibilityRole="button"
                  accessibilityLabel="Max"
                  testID="max-button"
                  className="px-3 py-1.5 rounded-pill bg-accent-shielded-tint active:opacity-80">
                  <Text variant="overline" className="text-accent-shielded">
                    MAX
                  </Text>
                </Pressable>
              </View>
              <View className="flex-row items-center mt-2">
                <Text variant="body-sm" className="text-fg-secondary">
                  Vault available{' '}
                </Text>
                <Text variant="body-sm" numeral className="font-geist-semibold text-fg-primary">
                  {formatTokenAmount(shieldedBalance, POOL_META.decimals)} {POOL_META.symbol}
                </Text>
              </View>
            </View>
            {overCap ? (
              <View className="flex-row items-center gap-2 mt-2">
                <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
                <Text testID="cap-error" variant="caption" className="text-danger flex-1">
                  {`Max per private transfer is ${formatTokenAmount(maxAmount, POOL_META.decimals)} ${POOL_META.symbol} (two largest notes)`}
                </Text>
              </View>
            ) : insufficient ? (
              <View className="flex-row items-center gap-2 mt-2">
                <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
                <Text variant="caption" className="text-danger flex-1">
                  Insufficient shielded balance
                </Text>
              </View>
            ) : null}
          </View>

          {/* Privacy meter — 5-bar strength card (index.html #12 shielded,
              l.6727–6734), between amount and fee. Strength + anonymity set are
              REAL (merkle leaf count). The note states the honest current model:
              hosted prover — NOT the mockup's "generated locally · no IP
              exposure" (both false for this devnet build). */}
          <View
            testID="privacy-meter"
            className="rounded-md bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={14} color={ACCENT} strokeWidth={2} />
                <Text variant="overline" className="text-fg-secondary">
                  Privacy meter
                </Text>
              </View>
              <Text
                variant="body-sm"
                className="font-geist-semibold"
                style={{color: privacyToneColor}}>
                {privacyStrength.label} · {privacyStrength.bars}/5
              </Text>
            </View>
            <View className="flex-row gap-1.5 mb-3">
              {[0, 1, 2, 3, 4].map(i => (
                <View
                  key={i}
                  className="flex-1 rounded-pill"
                  style={{
                    height: 6,
                    backgroundColor:
                      i < privacyStrength.bars ? privacyToneColor : '#2A2E37',
                  }}
                />
              ))}
            </View>
            <Text variant="caption" className="text-fg-tertiary">
              Anonymity set {groupThousands(merkleLeafCount)} · ZK proof via
              hosted prover
            </Text>
          </View>

          {/* Fee row — two lines per index.html #12 shielded (l.6735–6738).
              Network fee = real Solana base fee. ZK-proof line shows the honest
              current model (hosted prover, self-relayed devnet → no separate ZK
              charge), NOT the mockup's illustrative ~0.0021 SOL. */}
          <View className="rounded-md bg-bg-surface-1 border border-bg-surface-3 p-4 gap-2 mb-4">
            <View className="flex-row items-center justify-between">
              <Text variant="body-sm" className="text-fg-secondary">
                Network fee
              </Text>
              <Text variant="body-sm" numeral className="text-fg-primary">
                ~0.000005 SOL
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={14} color={ACCENT} strokeWidth={2} />
                <Text variant="body-sm" className="text-fg-secondary">
                  ZK proof fee
                </Text>
              </View>
              <Text variant="body-sm" className="text-fg-secondary">
                Hosted · included
              </Text>
            </View>
          </View>

          <Text testID="change-note" variant="caption" className="text-fg-tertiary text-center">
            The remainder stays in your private balance
          </Text>
        </ScrollView>

        {/* Sticky CTA */}
        <View className="px-6 pb-8 pt-2 bg-bg-base border-t border-bg-surface-2">
          <Pressable
            onPress={handleReviewTap}
            disabled={!canReview}
            accessibilityRole="button"
            testID="review-button"
            accessibilityLabel="Send private"
            className={cn(
              'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
              canReview ? 'bg-accent-shielded active:opacity-90' : 'bg-bg-surface-3',
            )}>
            <Lock
              size={18}
              color={canReview ? '#0A0A0A' : '#6E727A'}
              strokeWidth={2}
            />
            <Text
              variant="body-lg"
              className={cn(
                'font-geist-semibold',
                canReview ? 'text-bg-base' : 'text-fg-disabled',
              )}>
              {amount.trim() && canReview
                ? `Send ${amount} ${POOL_META.symbol} privately`
                : `Send private ${POOL_META.symbol}`}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}

function SummaryRow({label, value, accent, mono}: SummaryRowProps) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text variant="body-sm" className="text-fg-secondary">
        {label}
      </Text>
      <Text
        variant="body-sm"
        mono={mono}
        numeral={accent}
        className={cn('flex-shrink text-right ml-3', accent ? 'text-accent-shielded font-geist-semibold' : 'text-fg-primary')}
        numberOfLines={1}
        ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}
