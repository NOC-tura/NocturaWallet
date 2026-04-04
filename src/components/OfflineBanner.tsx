import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

// Dashboard integration: this banner is mutually exclusive with BackupReminderBanner.
// Priority order: BackupReminder > Offline > AppUpdate (never show two simultaneously).
// The parent Dashboard component handles this logic — see .instructions.md lines 2962-2986.

interface OfflineBannerProps {
  isOnline: boolean;
  lastSyncedAt: number | null;
}

function formatSyncDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

export function OfflineBanner({isOnline, lastSyncedAt}: OfflineBannerProps) {
  if (isOnline) return null;

  const message = lastSyncedAt
    ? `Offline — showing data from ${formatSyncDate(lastSyncedAt)}`
    : 'Offline — no internet connection';

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(248,113,113,0.25)',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F87171',
    textAlign: 'center',
  },
});
