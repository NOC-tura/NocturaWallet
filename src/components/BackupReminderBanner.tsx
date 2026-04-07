import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface BackupReminderBannerProps {
  visible: boolean;
  onBackup: () => void;
  onDismiss: () => void;
  canDismiss: boolean;
}

export function BackupReminderBanner({
  visible,
  onBackup,
  onDismiss,
  canDismiss,
}: BackupReminderBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.content} onPress={onBackup} activeOpacity={0.7} accessibilityLabel="Back up now">
        <View style={styles.row}>
          <Text style={styles.icon}>⚠️</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Back up your wallet</Text>
            <Text style={styles.subtitle}>
              Your funds are at risk without a recovery phrase backup
            </Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </View>
      </TouchableOpacity>
      {canDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(251,191,36,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FBBF24',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(251,191,36,0.75)',
    marginTop: 2,
  },
  arrow: {
    fontSize: 16,
    color: '#FBBF24',
    marginLeft: 8,
  },
  dismissButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    color: 'rgba(251,191,36,0.6)',
    fontWeight: '500',
  },
});
