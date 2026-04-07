import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Linking} from 'react-native';
import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';

const PRIVACY_URL = 'https://noc-tura.io/privacy';

interface PrivacyExplainerScreenProps {
  onDismiss: () => void;
}

const BULLETS = [
  'Your balance is hidden on-chain',
  'Transactions are not traceable',
  'Only you can see your history',
];

export function PrivacyExplainerScreen({onDismiss}: PrivacyExplainerScreenProps) {
  function handleGotIt() {
    mmkvPublic.set(MMKV_KEYS.PRIVACY_EXPLAINER_SHOWN, true);
    onDismiss();
  }

  function handleLearnMore() {
    void Linking.openURL(PRIVACY_URL);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>🔒 Privacy Mode</Text>

      <View style={styles.bulletsContainer}>
        {BULLETS.map((bullet, idx) => (
          <View key={idx} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>

      <View style={styles.howItWorksCard}>
        <Text style={styles.howItWorksLabel}>How it works:</Text>
        <Text style={styles.howItWorksBody}>
          Your funds are protected using zero-knowledge cryptography — the same
          tech used by leading privacy protocols.
        </Text>
      </View>

      <TouchableOpacity
        testID="got-it-button"
        style={styles.ctaButton}
        onPress={handleGotIt}>
        <Text style={styles.ctaButtonText}>Got it →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="learn-more-button"
        style={styles.learnMoreButton}
        onPress={handleLearnMore}>
        <Text style={styles.learnMoreButtonText}>Learn more</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 36,
  },
  bulletsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bulletDot: {
    fontSize: 20,
    color: '#6C47FF',
    lineHeight: 24,
  },
  bulletText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    flex: 1,
    fontWeight: '500',
  },
  howItWorksCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 18,
    marginBottom: 40,
    borderLeftWidth: 3,
    borderLeftColor: '#6C47FF',
  },
  howItWorksLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9999B3',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  howItWorksBody: {
    fontSize: 14,
    color: '#C8C8E0',
    lineHeight: 21,
  },
  ctaButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  learnMoreButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.4)',
  },
  learnMoreButtonText: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: '500',
  },
});
