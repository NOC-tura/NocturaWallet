import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Linking} from 'react-native';

interface AppUpdateBannerProps {
  visible: boolean;
  storeUrl: string;
  onDismiss: () => void;
}

/**
 * Inline dismissable banner for optional app updates.
 * Color: noc-info (#60A5FA) with subtle background.
 */
export function AppUpdateBanner({visible, storeUrl, onDismiss}: AppUpdateBannerProps) {
  if (!visible) return null;

  const handleTap = () => {
    Linking.openURL(storeUrl);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.textArea} onPress={handleTap} activeOpacity={0.7}>
        <Text style={styles.text}>New version available — tap to update</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="app-update-banner-dismiss"
        onPress={onDismiss}
        style={styles.dismissButton}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
        accessibilityLabel="Dismiss update banner">
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(96,165,250,0.25)',
  },
  textArea: {
    flex: 1,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: '#60A5FA',
  },
  dismissButton: {
    marginLeft: 8,
    padding: 2,
  },
  dismissText: {
    fontSize: 13,
    color: '#60A5FA',
  },
});
