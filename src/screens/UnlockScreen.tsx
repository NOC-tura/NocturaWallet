import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Keychain from 'react-native-keychain';
import {Lock, AlertTriangle, Clock, X} from 'lucide-react-native';
import {Text, Button} from '../components/ui';
import {usePinInput, PinDots, PinKeypad} from '../components/PinPad';
import {KeychainManager} from '../modules/keychain/keychainModule';
import {ScreenSecurityManager} from '../modules/screenSecurity/screenSecurityModule';
import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';
import {cn} from '../utils/cn';

/**
 * #9 Unlock — Phase B migration · mirror /home/user/Downloads/index.html §s9
 *
 * States implemented:
 *   - idle      — lock icon tile (accent tint) + dots + keypad + Forgot PIN
 *   - error     — lock icon flips to danger tint, dots danger-filled, helper
 *                 "Wrong PIN · N attempts left"
 *   - cooldown  — keypad replaced with countdown card, cycle banner, disabled
 *                 "Keypad paused" button
 *
 * Biometric:
 *   - Auto-trigger on mount (once) if SECURITY_BIOMETRIC_ENABLED='true' AND
 *     OS reports a supported biometry type
 *   - Fingerprint key in keypad's bottom-left lets user re-trigger biometric
 *     after PIN-fallback without leaving the screen
 *   - On any biometric cancel/fail → PIN keypad becomes the surface
 *
 * Deferred (separate security feature with MMKV cumulative tracking + wipe flow):
 *   - final-warning state (cycle 2 visual variant)
 *   - cumulative attempt counter persisting across launches (current count
 *     resets on success, but app-restart bypasses cooldown — TODO)
 *   - wipe-on-15-cumulative-wrong handler
 *
 * Security:
 *   - FLAG_SECURE on mount (PIN digits in scope)
 *   - PIN verified via KeychainManager.verifyPin (Argon2id hash, has its own
 *     cooldown ledger via pinLockout module — keep our UI gate as defence
 *     against UI race; the keychain layer is the authoritative gate)
 */

const PIN_LENGTH = 6;
const DEFAULT_MAX_PIN_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 180; // 3 min · design baseline

const keychainManager = new KeychainManager();
const securityManager = new ScreenSecurityManager();

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface SendIntent {
  /** Pre-formatted amount string (e.g. "10.0000"). Mode is 4-decimal canonical. */
  amount: string;
  /** Token ticker (e.g. "SOL", "NOC", "USDC"). */
  ticker: string;
  /** Full recipient address; rendered truncated 6+6 in confirm modal. */
  recipient: string;
  /** Pre-formatted network fee string (e.g. "0.00021 SOL"). Optional. */
  networkFee?: string;
}

interface UnlockScreenProps {
  onUnlock: () => void;
  onRestore: () => void;
  walletAddress?: string;
  reason?: string;
  maxPinAttempts?: number;
  /**
   * When provided, switches the screen into #10 unlock-send variant:
   *   - Top bar with X (cancel) + eyebrow "Confirm with PIN"
   *   - Intent card (amount + recipient + fee)
   *   - Smaller "Enter your PIN" h2 (no lock-icon hero)
   *   - Tertiary "Cancel send" → onCancel
   */
  sendIntent?: SendIntent;
  /** Only used when sendIntent is provided — fires on top-X or "Cancel send". */
  onCancel?: () => void;
}

export function UnlockScreen({
  onUnlock,
  onRestore,
  walletAddress,
  reason,
  maxPinAttempts = DEFAULT_MAX_PIN_ATTEMPTS,
  sendIntent,
  onCancel,
}: UnlockScreenProps) {
  const [attempts, setAttempts] = useState(0);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinResetKey, setPinResetKey] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [biometricBusy, setBiometricBusy] = useState(false);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const biometricAttemptedRef = useRef(false);

  // FLAG_SECURE while PIN digits are in scope
  useEffect(() => {
    securityManager.enableSecureScreen();
    return () => {
      securityManager.disableSecureScreen();
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const triggerBiometric = useCallback(async () => {
    if (biometricBusy) return;
    setBiometricBusy(true);
    try {
      // Gate: only fire if user enabled biometric during onboarding (#6)
      const enabled =
        mmkvPublic.getString(MMKV_KEYS.SECURITY_BIOMETRIC_ENABLED) === 'true';
      if (!enabled) return;

      const supported = await Keychain.getSupportedBiometryType();
      if (!supported) return;

      await keychainManager.retrieveSeed();
      onUnlock();
    } catch {
      // User cancelled / sensor failed / lockout → stay on PIN surface
    } finally {
      setBiometricBusy(false);
    }
  }, [biometricBusy, onUnlock]);

  // Auto-trigger biometric on mount (once)
  useEffect(() => {
    if (biometricAttemptedRef.current) return;
    biometricAttemptedRef.current = true;
    triggerBiometric();
  }, [triggerBiometric]);

  const startCooldown = useCallback(() => {
    setCooldownRemaining(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          setAttempts(0);
          setPinError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handlePinComplete = async (pin: string) => {
    if (cooldownRemaining > 0) return;

    const verified = await keychainManager.verifyPin(pin);
    if (verified) {
      setAttempts(0);
      setPinError(null);
      onUnlock();
      return;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setPinResetKey(k => k + 1);

    if (newAttempts >= maxPinAttempts) {
      setPinError(null);
      startCooldown();
    } else {
      const left = maxPinAttempts - newAttempts;
      setPinError(`Wrong PIN · ${left} attempt${left === 1 ? '' : 's'} left.`);
    }
  };

  const {digits, handleKey} = usePinInput({
    maxLength: PIN_LENGTH,
    onComplete: handlePinComplete,
    resetKey: pinResetKey,
  });

  const isCoolingDown = cooldownRemaining > 0;
  const hasError = pinError !== null && attempts > 0;
  const biometricEnabled =
    mmkvPublic.getString(MMKV_KEYS.SECURITY_BIOMETRIC_ENABLED) === 'true';

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base"
      testID="unlock-screen">
      {isCoolingDown ? (
        <CooldownView
          remaining={cooldownRemaining}
          onForgotPin={onRestore}
        />
      ) : (
        <UnlockKeypadView
          digits={digits}
          onKey={handleKey}
          onFingerprintPress={biometricEnabled ? triggerBiometric : undefined}
          error={hasError}
          errorText={pinError}
          walletAddress={walletAddress}
          reason={reason}
          sendIntent={sendIntent}
          onTertiaryPress={sendIntent && onCancel ? onCancel : onRestore}
          onTopBarClose={sendIntent && onCancel ? onCancel : undefined}
        />
      )}
    </SafeAreaView>
  );
}

// ── idle / error view (keypad surface) ──────────────────────────────────────

interface UnlockKeypadViewProps {
  digits: string[];
  onKey: (key: string | number) => void;
  onFingerprintPress?: () => void;
  error: boolean;
  errorText: string | null;
  walletAddress?: string;
  reason?: string;
  sendIntent?: SendIntent;
  onTertiaryPress: () => void;
  onTopBarClose?: () => void;
}

function truncateRecipient(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function UnlockKeypadView({
  digits,
  onKey,
  onFingerprintPress,
  error,
  errorText,
  walletAddress,
  reason,
  sendIntent,
  onTertiaryPress,
  onTopBarClose,
}: UnlockKeypadViewProps) {
  const isSendVariant = !!sendIntent;

  return (
    <View className="flex-1">
      {/* Top bar — only in send variant */}
      {isSendVariant ? (
        <View className="flex-row items-center px-4 py-3 min-h-touch-min">
          <Pressable
            onPress={onTopBarClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel send"
            className="w-12 h-12 items-center justify-center -ml-2">
            <X size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
          <View className="flex-1 items-center">
            <Text variant="overline" className="text-fg-tertiary">
              Confirm with PIN
            </Text>
          </View>
          <View className="w-12" />
        </View>
      ) : null}

      {isSendVariant && sendIntent ? (
        <>
          {/* Intent card */}
          <View className="px-5 mb-4">
            <View className="bg-bg-surface-1 rounded-lg p-5">
              <Text variant="overline" className="mb-2">
                You are about to send
              </Text>
              <View className="flex-row items-baseline gap-2 mb-3">
                <Text variant="balance-lg" numeral className="text-fg-primary">
                  {sendIntent.amount}
                </Text>
                <Text variant="body-lg" className="text-fg-secondary">
                  {sendIntent.ticker}
                </Text>
              </View>
              <IntentRow
                label="To"
                value={truncateRecipient(sendIntent.recipient)}
                mono
              />
              {sendIntent.networkFee ? (
                <IntentRow
                  label="Network fee"
                  value={sendIntent.networkFee}
                  numeral
                />
              ) : null}
            </View>
          </View>

          {/* Compact PIN header */}
          <View className="items-center px-6 mb-2">
            <Text variant="h2" className="text-center mb-1">
              Enter your PIN
            </Text>
            <Text variant="body-sm" className="text-center text-fg-secondary">
              Re-auth required for this transaction.
            </Text>
            <View className="mt-4">
              <PinDots count={digits.length} maxLength={PIN_LENGTH} error={error} />
            </View>
            <View className="mt-3 min-h-[20px]">
              {error && errorText ? (
                <Text variant="caption" className="text-danger text-center">
                  {errorText}
                </Text>
              ) : null}
            </View>
          </View>
        </>
      ) : (
        /* #9 idle/error hero · lock icon tile + title + body + dots + helper */
        <View className="items-center px-6 pt-8 pb-4">
          <View
            className={cn(
              'w-14 h-14 rounded-icon-hero items-center justify-center mb-4',
              error
                ? 'bg-[rgba(255,92,106,0.18)]'
                : 'bg-accent-transparent-tint',
            )}>
            <Lock
              size={28}
              color={error ? '#FF5C6A' : '#B084FC'}
              strokeWidth={1.75}
            />
          </View>
          <Text variant="h1" className="text-center mb-1">
            Welcome back
          </Text>
          <Text variant="body" className="text-center text-fg-secondary">
            {reason ?? 'Enter your PIN to unlock.'}
          </Text>
          {walletAddress ? (
            <Text variant="caption" mono className="text-fg-tertiary mt-1">
              {truncateAddress(walletAddress)}
            </Text>
          ) : null}

          <View className="mt-5">
            <PinDots count={digits.length} maxLength={PIN_LENGTH} error={error} />
          </View>

          <View className="mt-3 min-h-[20px]">
            {error && errorText ? (
              <Text variant="caption" className="text-danger text-center">
                {errorText}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Spacer */}
      <View className="flex-1" />

      {/* Tertiary above keypad */}
      <View className="items-center pb-2">
        <Button
          label={isSendVariant ? 'Cancel send' : 'Forgot PIN?'}
          variant="tertiary"
          onPress={onTertiaryPress}
        />
      </View>

      {/* Keypad · fingerprint cell on bottom-left when biometric enabled */}
      <View className="pb-6">
        <PinKeypad onKey={onKey} onFingerprintPress={onFingerprintPress} />
      </View>
    </View>
  );
}

interface IntentRowProps {
  label: string;
  value: string;
  mono?: boolean;
  numeral?: boolean;
}

function IntentRow({label, value, mono, numeral}: IntentRowProps) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text variant="body-sm" className="text-fg-tertiary">
        {label}
      </Text>
      <Text variant="body-sm" mono={mono} numeral={numeral} className="text-fg-primary">
        {value}
      </Text>
    </View>
  );
}

// ── cooldown view ───────────────────────────────────────────────────────────

interface CooldownViewProps {
  remaining: number;
  onForgotPin: () => void;
}

function CooldownView({remaining, onForgotPin}: CooldownViewProps) {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <View className="flex-1">
      {/* Title + body */}
      <View className="px-6 pt-7 pb-5 items-center">
        <View className="w-14 h-14 rounded-icon-hero items-center justify-center mb-4 bg-[rgba(255,92,106,0.18)]">
          <Clock size={28} color="#FF5C6A" strokeWidth={1.75} />
        </View>
        <Text variant="h1" className="text-center mb-2">
          Too many wrong PINs
        </Text>
        <Text variant="body" className="text-center text-fg-secondary max-w-sm">
          For your safety, the keypad is paused. It will re-enable when the
          timer ends.
        </Text>
      </View>

      {/* Cooldown card · large numeral timer */}
      <View className="px-5 mb-4">
        <View className="bg-bg-surface-1 rounded-lg p-6 items-center">
          <Text variant="display" numeral className="text-fg-primary mb-2">
            {formatMmSs(remaining)}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary text-center">
            Cooldown · <Text variant="body-sm" numeral>{minutes}</Text> minute
            {minutes === 1 ? '' : 's'} <Text variant="body-sm" numeral>{seconds}</Text> second
            {seconds === 1 ? '' : 's'} remaining
          </Text>
        </View>
      </View>

      {/* Cycle banner · warning */}
      <View className="px-5 mb-3">
        <View className="flex-row items-start gap-3 p-4 rounded-md bg-bg-surface-2 border-l-2 border-l-warning">
          <AlertTriangle size={16} color="#F2B53B" strokeWidth={1.75} />
          <Text variant="body-sm" className="flex-1 text-fg-primary">
            Cycle 1 of 2 · After this cooldown, more wrong PINs may trigger
            additional protection.
          </Text>
        </View>
      </View>

      <View className="flex-1" />

      <View className="items-center pb-2">
        <Button
          label="Forgot PIN?"
          variant="tertiary"
          onPress={onForgotPin}
        />
      </View>

      <View className="px-6 pb-8">
        <Button label="Keypad paused" variant="secondary" disabled />
      </View>
    </View>
  );
}
