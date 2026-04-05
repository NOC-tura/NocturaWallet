import React, {useCallback, useRef, useState, useEffect} from 'react';
import {
  Clipboard,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ReceiveScreenProps {
  address: string;
}

export function ReceiveScreen({address}: ReceiveScreenProps) {
  const [copied, setCopied] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    Clipboard.setString(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Auto-clear clipboard after 30s for security
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = setTimeout(() => {
      Clipboard.setString('');
    }, 30_000);
  }, [address]);

  const handleShare = useCallback(() => {
    Share.share({message: address, title: 'My Solana Address'});
  }, [address]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Receive</Text>

      <View testID="qr-area" style={styles.qrArea}>
        <Text style={styles.qrPlaceholder}>{address}</Text>
      </View>

      <Text selectable style={styles.address}>
        {address}
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleCopy}>
        <Text style={styles.buttonText}>{copied ? 'Copied!' : 'Copy'}</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        Your address works for all SPL tokens on Solana
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleShare}>
        <Text style={styles.buttonText}>Share</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  header: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 32,
  },
  qrArea: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    padding: 12,
  },
  qrPlaceholder: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  address: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 16,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
});
