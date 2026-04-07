import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Linking,
} from 'react-native';

interface AppUpdateModalProps {
  visible: boolean;
  storeUrl: string;
  message?: string;
}

/**
 * Full-screen blocking overlay for required app updates.
 * Cannot be dismissed — user MUST update via the store.
 * Background: #0C0C14, accent button #6C47FF
 */
export function AppUpdateModal({visible, storeUrl, message}: AppUpdateModalProps) {
  if (!visible) return null;

  const handleUpdate = () => {
    Linking.openURL(storeUrl);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={() => {
        // Intentionally do nothing — this modal cannot be dismissed
      }}>
      <View style={styles.container}>
        <Text style={styles.title}>Update required</Text>
        {message ? (
          <Text style={styles.message}>{message}</Text>
        ) : (
          <Text style={styles.message}>
            A new version of Noctura Wallet is required to continue.
          </Text>
        )}
        <TouchableOpacity style={styles.button} onPress={handleUpdate} accessibilityLabel="Update app">
          <Text style={styles.buttonText}>Update now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
