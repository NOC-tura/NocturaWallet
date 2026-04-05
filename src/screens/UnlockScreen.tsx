import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Keychain from 'react-native-keychain';
import {PinPad} from '../components/PinPad';
import {KeychainManager} from '../modules/keychain/keychainModule';

const DEFAULT_MAX_PIN_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;
const PIN_LENGTH = 6;

const keychainManager = new KeychainManager();

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface UnlockScreenProps {
  onUnlock: () => void;
  onRestore: () => void;
  walletAddress?: string;
  reason?: string;
  maxPinAttempts?: number;
}

export function UnlockScreen({
  onUnlock,
  onRestore,
  walletAddress,
  reason,
  maxPinAttempts = DEFAULT_MAX_PIN_ATTEMPTS,
}: UnlockScreenProps) {
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Biometric auto-trigger on mount (spec lines 2936-2949)
  useEffect(() => {
    const attemptBiometric = async () => {
      try {
        // In production, this would call react-native-keychain's biometric prompt.
        // The KeychainManager.retrieveSeed() requires biometric auth on the native side.
        // For now, we attempt to check if biometric is available and fall back to PIN.
        const supported = await Keychain.getSupportedBiometryType();
        if (!supported) {
          // E041: Biometric not enrolled → directly show PIN pad
          setShowPinPad(true);
          return;
        }
        // Biometric is supported — in production, this triggers the native prompt.
        // On success: onUnlock() would be called.
        // On failure: fall back to PIN option.
        // For scaffold, we show the biometric area and let user choose PIN.
      } catch {
        // E040: Biometric failed → show PIN option
        setShowPinPad(false); // Keep biometric view but user can tap "Use PIN instead"
      }
    };
    attemptBiometric();

    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldownRemaining(COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          setAttempts(0);
          setPinError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePinComplete = async (pin: string) => {
    if (cooldownRemaining > 0) return;

    const verified = await keychainManager.verifyPin(pin);
    if (verified) {
      onUnlock();
      return;
    }

    setAttempts(prev => {
      const newAttempts = prev + 1;
      if (newAttempts >= maxPinAttempts) {
        setPinError(`Too many attempts. Try again in ${COOLDOWN_SECONDS}s.`);
        // Defer startCooldown to avoid calling it inside setState
        setTimeout(() => startCooldown(), 0);
      } else {
        setPinError('Incorrect PIN. Try again.');
      }
      return newAttempts;
    });
  };

  const isCoolingDown = cooldownRemaining > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      {walletAddress ? (
        <Text style={styles.address}>{truncateAddress(walletAddress)}</Text>
      ) : null}

      {reason ? <Text style={styles.reason}>{reason}</Text> : null}

      {!showPinPad ? (
        <View style={styles.biometricArea}>
          <ActivityIndicator color="#6C47FF" size="large" />
          <Text style={styles.biometricText}>Authenticating...</Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setShowPinPad(true)}>
            <Text style={styles.linkText}>Use PIN instead</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pinArea}>
          <Text style={styles.pinTitle}>Enter PIN</Text>
          {isCoolingDown ? (
            <Text style={styles.cooldownText}>
              Too many attempts. Try again in {cooldownRemaining}s.
            </Text>
          ) : (
            <PinPad
              onComplete={handlePinComplete}
              maxLength={PIN_LENGTH}
              error={pinError}
              disabled={isCoolingDown}
            />
          )}
        </View>
      )}

      <TouchableOpacity style={styles.restoreButton} onPress={onRestore}>
        <Text style={styles.restoreText}>Lost access? Restore wallet →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4},
  address: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  reason: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
    textAlign: 'center',
  },
  biometricArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  biometricText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 24,
  },
  pinArea: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  linkText: {
    fontSize: 14,
    color: '#6C47FF',
    textDecorationLine: 'underline',
  },
  cooldownText: {
    fontSize: 14,
    color: '#F87171',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  restoreButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
});
