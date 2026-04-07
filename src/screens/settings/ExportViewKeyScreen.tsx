import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Clipboard,
  StyleSheet,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import * as Keychain from 'react-native-keychain';
import {bech32m} from '@scure/base';

type Step = 'warning' | 'display';

const VIEW_KEY_SERVICE = 'noctura.viewKey';
const VIEW_KEY_HRP = 'nocvk';
const VIEW_KEY_BECH32_LIMIT = 90;

export function ExportViewKeyScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<Step>('warning');
  const [viewKeyEncoded, setViewKeyEncoded] = useState('');
  const [loading, setLoading] = useState(false);
  const clipboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear clipboard on unmount (security: view key should not persist)
  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current) {
        clearTimeout(clipboardTimerRef.current);
      }
      if (viewKeyEncoded) {
        Clipboard.setString('');
      }
    };
  }, [viewKeyEncoded]);

  const handleExport = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await Keychain.getGenericPassword({
        service: VIEW_KEY_SERVICE,
        authenticationPrompt: {
          title: 'Authenticate to export view key',
          subtitle: 'Biometric verification required',
          cancel: 'Cancel',
        },
      });
      if (!result) {
        Alert.alert('Error', 'View key not found. Please set up your wallet first.');
        return;
      }
      // View key stored as hex string in keychain
      const hexStr = result.password;
      const bytes = new Uint8Array(
        hexStr.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [],
      );
      const words = bech32m.toWords(bytes);
      const encoded = bech32m.encode(VIEW_KEY_HRP, words, VIEW_KEY_BECH32_LIMIT);
      setViewKeyEncoded(encoded);
      setStep('display');
    } catch {
      Alert.alert('Error', 'Failed to retrieve view key. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleCopy = useCallback(() => {
    Clipboard.setString(viewKeyEncoded);
    // Auto-clear clipboard after 30 seconds (matches seed phrase timing)
    if (clipboardTimerRef.current) {
      clearTimeout(clipboardTimerRef.current);
    }
    clipboardTimerRef.current = setTimeout(() => {
      Clipboard.setString('');
      clipboardTimerRef.current = null;
    }, 30_000);
  }, [viewKeyEncoded]);

  if (step === 'display') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Your View Key</Text>
        <Text
          testID="viewkey-text"
          style={styles.viewKeyText}
          selectable>
          {viewKeyEncoded}
        </Text>
        <Text testID="readonly-message" style={styles.readonlyMessage}>
          This view key is read-only. It cannot move your funds.
        </Text>
        <TouchableOpacity
          testID="copy-button"
          style={styles.button}
          onPress={handleCopy}
          activeOpacity={0.7}
          accessibilityLabel="Copy view key to clipboard">
          <Text style={styles.buttonText}>Copy to Clipboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityLabel="Done">
          <Text style={styles.backButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Export View Key</Text>
      <Text style={styles.warningText}>
        Your view key (nocvk1...) allows others to see your shielded transaction
        history and incoming notes, but it{'\u2019'}s read-only — it{'\u00A0'}
        <Text style={styles.bold}>cannot</Text> move your funds or access your
        spending key.
        {'\n\n'}
        Share your view key only with parties you trust to audit your activity,
        such as a tax accountant or compliance tool.
      </Text>
      <TouchableOpacity
        testID="export-button"
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleExport}
        disabled={loading}
        activeOpacity={0.7}
        accessibilityLabel="Export view key">
        <Text style={styles.buttonText}>
          {loading ? 'Authenticating…' : 'Export View Key'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        accessibilityLabel="Cancel">
        <Text style={styles.backButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  warningText: {
    fontSize: 15,
    color: '#CCCCCC',
    lineHeight: 22,
    marginBottom: 32,
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewKeyText: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: '#6C47FF',
    backgroundColor: '#1E1E2E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  readonlyMessage: {
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6C47FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    color: '#888888',
  },
});
