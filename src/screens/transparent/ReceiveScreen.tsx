import React, {useCallback, useRef, useState, useEffect} from 'react';
import {
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

interface ReceiveScreenProps {
  address: string;
}

// Token selector items — all share the same Solana address
const TOKEN_OPTIONS = ['SOL', 'NOC', 'USDC', 'USDT'] as const;

/**
 * Transparent receive screen.
 * QR code + copyable address + 30s clipboard auto-clear + share.
 * Token selector shows that the same address works for all SPL tokens.
 */
export function ReceiveScreen({address}: ReceiveScreenProps) {
  const [copied, setCopied] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('SOL');
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    Clipboard.setString(address);
    setCopied(true);

    // "Copied!" feedback for 2s
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);

    // Auto-clear clipboard after 30s for security (matches seed phrase timing)
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      Clipboard.setString('');
    }, 30_000);
  }, [address]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({message: address, title: 'My Solana Address'});
    } catch {
      // User cancelled or share failed — no action needed
    }
  }, [address]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      <Text style={styles.header}>Receive</Text>

      {/* QR Code area */}
      <View testID="qr-area" style={styles.qrArea}>
        <Text style={styles.qrPlaceholder}>{address}</Text>
      </View>

      {/* Full address (monospace, selectable) */}
      <Text selectable style={styles.address}>
        {address}
      </Text>

      {/* Copy button */}
      <TouchableOpacity style={styles.copyButton} onPress={handleCopy} accessibilityLabel="Copy address">
        <Text style={styles.copyButtonText}>
          {copied ? 'Copied!' : 'Copy'}
        </Text>
      </TouchableOpacity>

      {/* Token selector — same address for all */}
      <View style={styles.tokenSelector}>
        {TOKEN_OPTIONS.map(token => (
          <TouchableOpacity
            key={token}
            style={[
              styles.tokenPill,
              selectedToken === token && styles.tokenPillActive,
            ]}
            onPress={() => setSelectedToken(token)}
            accessibilityLabel={`Select ${token}`}>
            <Text
              style={[
                styles.tokenPillText,
                selectedToken === token && styles.tokenPillTextActive,
              ]}>
              {token}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.note}>
        Your address works for all SPL tokens on Solana
      </Text>

      {/* Share button */}
      <TouchableOpacity style={styles.shareButton} onPress={handleShare} accessibilityLabel="Share address">
        <Text style={styles.shareButtonText}>Share</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0C0C14'},
  contentContainer: {alignItems: 'center', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40},
  header: {color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 32},
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
  copyButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 24,
    minWidth: 160,
    alignItems: 'center',
  },
  copyButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
  tokenSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tokenPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tokenPillActive: {
    backgroundColor: '#6C47FF',
  },
  tokenPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  tokenPillTextActive: {
    color: '#FFFFFF',
  },
  note: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  shareButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    minWidth: 160,
    alignItems: 'center',
  },
  shareButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
});
