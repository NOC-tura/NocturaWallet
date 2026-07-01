import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Pressable,
  TextInput,
  ScrollView,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {Check, Copy, ArrowRight, ChevronDown} from 'lucide-react-native';
import {PublicKey} from '@solana/web3.js';
import {Text, Button, Card} from '../../components/ui';
import {KeychainManager} from '../../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../../modules/keyDerivation/mnemonicUtils';
import {
  deriveTransparentKeypair,
  type TransparentScheme,
} from '../../modules/keyDerivation/transparent';
import {storeTransparentScheme} from '../../modules/keyDerivation/derivationScheme';
import {deriveShieldedViewKey} from '../../modules/keyDerivation/shielded';
import {useWalletStore} from '../../store/zustand/walletStore';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {zeroize} from '../../modules/session/zeroize';
import {unlockSecureStorageWithSeed} from '../../modules/session/secureStorageSession';

/**
 * #7 OnboardSuccess — Phase B migration · mirror /home/user/Downloads/index.html §s7
 *
 * Layout:
 *   - Hero ring · 96 px circle with --success tint + 44 px Check icon
 *   - H1 "Wallet created"
 *   - Body: "Your Solana address is below. Receive funds at any time."
 *   - Address card · overline + full mono address + Copy button + 30 s clipboard caption
 *   - Next-steps card · 3 arrow-right lines (educational only)
 *   - Optional referral section (legacy flow preserved, restyled)
 *   - Sticky CTA · "Open wallet"
 *
 * On mount: derive the Solana public key from the mnemonic so the user can see
 * + copy their address BEFORE confirming entry. Seed material zeroized
 * immediately after derivation; view key held in ref until "Open wallet"
 * persists it, then zeroized.
 *
 * On "Open wallet":
 *   1. storeSeed (Keychain BIOMETRY_ANY_OR_DEVICE_PASSCODE access control)
 *   2. storeViewKey
 *   3. Update Zustand wallet store
 *   4. Set MMKV WALLET_EXISTS + ONBOARDING_COMPLETED flags
 *   5. Zeroize cached buffers, onComplete()
 *
 * Clipboard auto-clear: 30 s timeout only. Earlier iteration also wiped on
 * AppState 'background' (per design note), but that BROKE the legitimate paste
 * flow — user copies → switches to Notepad / Outlook → app backgrounds →
 * clipboard cleared before paste lands. Addresses are public anyway; the 30 s
 * timeout is sufficient defense-in-depth without sabotaging the primary use.
 *
 * Single state (no error variants in design spec). Failures during persist
 * surface as a small caption above the CTA and re-enable the button.
 */

interface SuccessScreenProps {
  mnemonic: string;
  scheme: TransparentScheme;
  onComplete: () => void;
}

const keychainManager = new KeychainManager();
const CLIPBOARD_CLEAR_MS = 30_000;
const COPIED_TOAST_MS = 2_000;

export function SuccessScreen({mnemonic, scheme, onComplete}: SuccessScreenProps) {
  const [publicKeyBase58, setPublicKeyBase58] = useState<string | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Referral state (legacy flow preserved)
  const alreadyApplied =
    mmkvPublic.getBoolean(MMKV_KEYS.REFERRAL_ONBOARDING_CODE_APPLIED) === true;
  const [referralExpanded, setReferralExpanded] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const [referralApplied, setReferralApplied] = useState(alreadyApplied);

  // Refs for sensitive buffers — held until "Open wallet" persists them
  const viewKeyRef = useRef<Uint8Array | null>(null);
  const publicKeyBytesRef = useRef<Uint8Array | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive keys on mount so we can display the address
  useEffect(() => {
    let cancelled = false;
    const derive = async () => {
      try {
        const seed = await mnemonicToSeed(mnemonic);
        const keypair = deriveTransparentKeypair(seed, scheme);
        const viewKey = deriveShieldedViewKey(seed);
        zeroize(seed);
        zeroize(keypair.secretKey);
        if (cancelled) {
          zeroize(viewKey);
          return;
        }
        viewKeyRef.current = viewKey;
        publicKeyBytesRef.current = keypair.publicKey;
        setPublicKeyBase58(new PublicKey(keypair.publicKey).toBase58());
      } catch {
        if (!cancelled) setDeriveError('Could not derive wallet address. Please retry.');
      }
    };
    derive();
    return () => {
      cancelled = true;
      if (viewKeyRef.current) zeroize(viewKeyRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [mnemonic, scheme]);

  const handleCopy = useCallback(() => {
    if (!publicKeyBase58) return;
    Clipboard.setString(publicKeyBase58);
    Vibration.vibrate(30);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_TOAST_MS);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      Clipboard.setString('');
      clearTimerRef.current = null;
    }, CLIPBOARD_CLEAR_MS);
  }, [publicKeyBase58]);

  const handleApplyReferral = () => {
    const trimmed = referralCode.trim().toUpperCase();
    if (!trimmed) {
      setReferralMessage('Please enter a referral code');
      return;
    }
    mmkvPublic.set(MMKV_KEYS.REFERRAL_ONBOARDING_CODE_APPLIED, true);
    mmkvPublic.set(MMKV_KEYS.REFERRAL_ONBOARDING_CODE_VALUE, trimmed);
    setReferralApplied(true);
    setReferralMessage(`Code ${trimmed} applied!`);
    setReferralCode('');
  };

  const handleOpenWallet = async () => {
    if (persisting) return;
    if (!publicKeyBase58 || !viewKeyRef.current) {
      setPersistError('Wallet not ready yet. Please wait.');
      return;
    }
    setPersisting(true);
    setPersistError(null);
    try {
      await keychainManager.storeSeed(mnemonic);
      await keychainManager.storeViewKey(viewKeyRef.current);
      useWalletStore.getState().setPublicKey(publicKeyBase58);
      storeTransparentScheme(scheme);
      mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
      mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true');
      // Defense-in-depth: write publicKey directly to mmkvPublic as a backup
      // path. The walletStore.persist also writes there, but this redundant
      // write protects against any zustand hydration timing issues.
      mmkvPublic.set(MMKV_KEYS.WALLET_PUBLIC_KEY, publicKeyBase58);
      zeroize(viewKeyRef.current);
      viewKeyRef.current = null;
      // Initialize the encrypted note store for this session so the dashboard
      // can read shielded notes immediately after onboarding completes.
      const sessionSeed = await mnemonicToSeed(mnemonic);
      unlockSecureStorageWithSeed(sessionSeed);
      zeroize(sessionSeed);
      // Clear clipboard if the address is still copied — defence in depth
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
        Clipboard.setString('');
      }
      onComplete();
    } catch {
      setPersisting(false);
      setPersistError('Could not save wallet. Please try again.');
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      <ScrollView
        contentContainerClassName="flex-grow pb-4"
        showsVerticalScrollIndicator={false}>
        {/* Hero block · 96 dp success ring + title + body
         * Design: padding 32/24/24, gap 20 between ring and text */}
        <View className="items-center pt-7 px-6 pb-6">
          <View className="w-24 h-24 rounded-full bg-[rgba(63,214,139,0.14)] items-center justify-center mb-5">
            <Check size={44} color="#3FD68B" strokeWidth={2} />
          </View>
          <Text variant="h1" className="text-center mb-2">
            Wallet created
          </Text>
          <Text variant="body" className="text-center text-fg-secondary max-w-sm">
            Your Solana address is below. Receive funds at any time.
          </Text>
        </View>

        {/* Address card */}
        <View className="px-5 mb-3">
          <Card padding="p-4">
            <Text variant="overline" className="mb-2">
              Solana address
            </Text>
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                {publicKeyBase58 ? (
                  <Text
                    variant="body"
                    mono
                    selectable
                    testID="success-address-text"
                    className="text-fg-primary">
                    {publicKeyBase58}
                  </Text>
                ) : deriveError ? (
                  <Text variant="body-sm" className="text-danger">
                    {deriveError}
                  </Text>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#B084FC" />
                    <Text variant="body-sm" className="text-fg-tertiary">
                      Generating address…
                    </Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={handleCopy}
                disabled={!publicKeyBase58}
                accessibilityRole="button"
                accessibilityLabel="Copy address"
                testID="success-copy-button"
                className="w-12 h-12 items-center justify-center rounded-pill bg-bg-surface-2 active:opacity-80">
                <Copy size={20} color="#B084FC" strokeWidth={1.75} />
              </Pressable>
            </View>
            <Text variant="caption" className="text-fg-tertiary mt-3">
              {copied
                ? 'Copied — clipboard auto-clears in 30 s.'
                : 'Tap copy → clipboard auto-clears in 30 s.'}
            </Text>
          </Card>
        </View>

        {/* Next steps card */}
        <View className="px-5 mb-3">
          <Card padding="p-4">
            <Text variant="overline" className="mb-2">
              Next steps
            </Text>
            <View className="gap-2">
              <NextStepRow text="Fund the wallet with SOL or NOC" />
              <NextStepRow text="Try a shielded send (privacy by design)" />
              <NextStepRow text="Export an encrypted backup from Settings" />
            </View>
          </Card>
        </View>

        {/* Referral section · legacy flow preserved */}
        {!referralApplied ? (
          <View className="px-5 mb-3">
            {!referralExpanded ? (
              <Pressable
                onPress={() => setReferralExpanded(true)}
                accessibilityRole="button"
                testID="referral-expand-button"
                className="flex-row items-center justify-center gap-2 py-3">
                <Text variant="body-sm" className="text-accent-transparent">
                  Have a referral code?
                </Text>
                <ChevronDown size={16} color="#B084FC" strokeWidth={2} />
              </Pressable>
            ) : (
              <Card padding="p-4">
                <Text variant="overline" className="mb-2">
                  Referral code
                </Text>
                <View className="gap-2">
                  <TextInput
                    testID="referral-input-onboarding"
                    value={referralCode}
                    onChangeText={setReferralCode}
                    placeholder="Enter referral code"
                    placeholderTextColor="#6B7280"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    className="bg-bg-surface-2 text-fg-primary rounded-md px-3 py-3 font-geist text-body"
                  />
                  <Button
                    label="Apply"
                    variant="secondary"
                    onPress={handleApplyReferral}
                    testID="apply-referral-onboarding"
                  />
                </View>
                {referralMessage ? (
                  <Text
                    variant="caption"
                    testID="referral-message-onboarding"
                    className={
                      referralMessage.includes('applied')
                        ? 'text-success mt-2 text-center'
                        : 'text-danger mt-2 text-center'
                    }>
                    {referralMessage}
                  </Text>
                ) : null}
              </Card>
            )}
          </View>
        ) : (
          <View className="px-5 mb-3 items-center">
            <Text
              variant="caption"
              testID="referral-message-onboarding"
              className="text-success">
              {referralMessage ?? 'Referral code applied'}
            </Text>
          </View>
        )}

        <View className="flex-1" />
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 pb-8 pt-2">
        {persistError ? (
          <Text variant="caption" className="text-danger text-center mb-2">
            {persistError}
          </Text>
        ) : null}
        <Button
          label="Open wallet"
          variant="primary"
          onPress={handleOpenWallet}
          loading={persisting}
          disabled={!publicKeyBase58}
          testID="enter-wallet-button"
        />
      </View>
    </SafeAreaView>
  );
}

function NextStepRow({text}: {text: string}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="w-5 mt-0.5">
        <ArrowRight size={18} color="#B084FC" strokeWidth={2} />
      </View>
      <Text variant="body" className="flex-1 text-fg-primary">
        {text}
      </Text>
    </View>
  );
}
