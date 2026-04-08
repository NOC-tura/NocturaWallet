import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
  StyleSheet,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useTransactionHistory} from '../../hooks/useSolanaQueries';
import {useWalletStore} from '../../store/zustand/walletStore';
import {getExplorerUrl} from '../../utils/explorerUrl';
import {formatAddress} from '../../utils/formatAddress';

interface Props {
  signature: string;
  onBack: () => void;
}

export function TransactionDetailScreen({signature, onBack}: Props) {
  const publicKey = useWalletStore(s => s.publicKey);
  const {data: transactions = []} = useTransactionHistory(publicKey);
  const tx = transactions.find(t => t.signature === signature) ?? null;

  const explorerUrl = getExplorerUrl(signature);

  function handleCopySignature() {
    Clipboard.setString(signature);
  }

  function handleViewOnSolscan() {
    Linking.openURL(explorerUrl).catch(() => {});
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Transaction Detail</Text>
      </View>

      {/* Signature */}
      <View style={styles.section}>
        <Text style={styles.label}>Signature</Text>
        <TouchableOpacity
          onPress={handleCopySignature}
          accessibilityRole="button"
          accessibilityLabel="Copy signature"
        >
          <Text style={styles.signatureText}>{signature}</Text>
          <Text style={styles.copyHint}>Tap to copy</Text>
        </TouchableOpacity>
      </View>

      {tx ? (
        <>
          {/* From / To */}
          <View style={styles.section}>
            <Text style={styles.label}>From</Text>
            <Text style={styles.value}>
              {tx.from ? formatAddress(tx.from) : '—'}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>To</Text>
            <Text style={styles.value}>
              {tx.to ? formatAddress(tx.to) : '—'}
            </Text>
          </View>

          {/* Amount */}
          {tx.amount != null && (
            <View style={styles.section}>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.value}>{tx.amount}</Text>
            </View>
          )}

          {/* Fee */}
          <View style={styles.section}>
            <Text style={styles.label}>Fee</Text>
            <Text style={styles.value}>{tx.fee} lamports</Text>
          </View>

          {/* Timestamp */}
          <View style={styles.section}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>
              {tx.timestamp
                ? new Date(tx.timestamp * 1000).toLocaleString()
                : '—'}
            </Text>
          </View>

          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{tx.status}</Text>
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <Text style={styles.value}>Transaction data not available locally.</Text>
        </View>
      )}

      {/* Explorer link */}
      <TouchableOpacity
        style={styles.explorerButton}
        onPress={handleViewOnSolscan}
        accessibilityRole="link"
        testID="solscan-link"
      >
        <Text style={styles.explorerButtonText}>View on Solscan →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d'},
  content: {padding: 16, paddingBottom: 48},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  backButton: {color: '#a78bfa', fontSize: 16},
  title: {color: '#ffffff', fontSize: 20, fontWeight: '700'},
  section: {marginBottom: 20},
  label: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  signatureText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontFamily: 'monospace',
    flexWrap: 'wrap',
  },
  copyHint: {color: '#7c3aed', fontSize: 12, marginTop: 2},
  value: {color: '#ffffff', fontSize: 15},
  explorerButton: {
    marginTop: 24,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  explorerButtonText: {color: '#ffffff', fontWeight: '700', fontSize: 15},
});
