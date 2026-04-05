import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

interface BiometricSetupScreenProps {
  onEnable: () => void;
  onSkip: () => void;
}

export function BiometricSetupScreen({onEnable, onSkip}: BiometricSetupScreenProps) {
  const handleEnable = () => {
    mmkvPublic.set(MMKV_KEYS.SECURITY_BIOMETRIC_ENABLED, 'true');
    onEnable();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔐</Text>

      <Text style={styles.title}>Enable biometrics for faster access</Text>

      <Text style={styles.description}>
        Use Face ID, Touch ID, or fingerprint to unlock your wallet quickly and securely.
      </Text>

      <TouchableOpacity style={styles.enableButton} onPress={handleEnable}>
        <Text style={styles.enableButtonText}>Enable</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#6C6C80',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  enableButton: {
    width: '100%',
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
});
