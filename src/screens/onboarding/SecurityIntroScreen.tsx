import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

interface SecurityIntroScreenProps {
  onContinue: () => void;
}

const WARNINGS = [
  'If you lose your recovery phrase, you permanently lose access to your funds',
  'Noctura never stores your private keys or recovery phrase',
  'No one — not even Noctura — can recover your wallet for you',
];

export function SecurityIntroScreen({onContinue}: SecurityIntroScreenProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCheckbox = () => {
    const next = !acknowledged;
    setAcknowledged(next);
    if (next) {
      mmkvPublic.set(MMKV_KEYS.ONBOARDING_SECURITY_ACK, 'true');
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your wallet, your responsibility</Text>

      <View style={styles.warningsContainer}>
        {WARNINGS.map((warning, index) => (
          <View key={index} style={styles.warningRow}>
            <Text style={styles.warningIcon}>❗</Text>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.checkboxRow} onPress={handleCheckbox}>
        <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
          {acknowledged && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>
          I understand and accept responsibility for my wallet security
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="continue-button"
        style={[styles.ctaButton, !acknowledged && styles.ctaButtonDisabled]}
        onPress={acknowledged ? onContinue : undefined}
        disabled={!acknowledged}
        accessibilityState={{disabled: !acknowledged}}>
        <Text style={styles.ctaButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0C0C14',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
  },
  warningsContainer: {
    marginBottom: 32,
    gap: 16,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    color: '#E0E0E8',
    lineHeight: 22,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 32,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#6C47FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#6C47FF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#C0C0CC',
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
