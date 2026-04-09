import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import {getExplorerUrl} from '../../utils/explorerUrl';
import {formatAddress} from '../../utils/formatAddress';
import {getConnection} from '../../modules/solana/connection';
import {ERROR_CODES} from '../../constants/errors';

export interface TransactionStatusScreenProps {
  signature: string;
  amount: string;
  recipient: string;
  token: string;
  onDashboard: () => void;
  onRetry?: () => void;
}

type TxState = 'pending' | 'success' | 'failed' | 'timeout';

export function TransactionStatusScreen({
  signature,
  amount,
  recipient,
  token,
  onDashboard,
  onRetry,
}: TransactionStatusScreenProps) {
  const [txState, setTxState] = useState<TxState>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const connection = getConnection();
      const MAX_ATTEMPTS = 120;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 500));
        if (cancelled) return;
        try {
          const result = await connection.getSignatureStatus(signature);
          if (
            result?.value?.confirmationStatus === 'confirmed' ||
            result?.value?.confirmationStatus === 'finalized'
          ) {
            if (!cancelled) setTxState('success');
            return;
          }
          if (result?.value?.err) {
            if (cancelled) return;
            setTxState('failed');
            // Map RPC error to user-friendly message from ERROR_CODES
            const errStr = JSON.stringify(result.value.err);
            if (errStr.includes('InsufficientFunds')) {
              setErrorMessage(ERROR_CODES.INSUFFICIENT_SOL.message);
            } else if (errStr.includes('AccountNotFound')) {
              setErrorMessage(ERROR_CODES.INVALID_ADDRESS.message);
            } else {
              setErrorMessage(ERROR_CODES.TX_SEND_FAILED.message);
            }
            return;
          }
        } catch {
          // RPC error — continue polling
        }
      }
      if (!cancelled) setTxState('timeout');
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [signature]);

  const explorerUrl = getExplorerUrl(signature);
  const truncatedSig =
    signature.length > 16
      ? `${signature.slice(0, 8)}...${signature.slice(-8)}`
      : signature;

  const handleViewOnSolscan = () => {
    Linking.openURL(explorerUrl);
  };

  if (txState === 'success') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconCircleSuccess}>
          <Text style={styles.iconTextSuccess}>✓</Text>
        </View>
        <Text style={styles.titleSuccess}>Sent!</Text>
        <Text style={styles.subtitle}>
          {amount} {token} to {formatAddress(recipient)}
        </Text>
        <TouchableOpacity onPress={handleViewOnSolscan} activeOpacity={0.75}>
          <Text style={styles.linkAccent}>View on Solscan →</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.75} style={styles.addContactButton}>
          <Text style={styles.addContactText}>+ Add to contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onDashboard}
          activeOpacity={0.75}>
          <Text style={styles.primaryButtonText}>Back to dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (txState === 'failed') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconCircleFailed}>
          <Text style={styles.iconTextFailed}>✗</Text>
        </View>
        <Text style={styles.titleFailed}>Transaction failed</Text>
        {errorMessage ? (
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        ) : null}
        {onRetry ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onRetry}
            activeOpacity={0.75}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.ghostButton}
          onPress={onDashboard}
          activeOpacity={0.75}>
          <Text style={styles.ghostButtonText}>Back to dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (txState === 'timeout') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconCircleTimeout}>
          <Text style={styles.iconTextTimeout}>⚠</Text>
        </View>
        <Text style={styles.titleTimeout}>Transaction status unknown</Text>
        <Text style={styles.subtitle}>
          Your transaction may have been submitted. Check Activity tab for
          status.
        </Text>
        <TouchableOpacity onPress={handleViewOnSolscan} activeOpacity={0.75}>
          <Text style={styles.linkAccent}>View on Solscan →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onDashboard}
          activeOpacity={0.75}>
          <Text style={styles.primaryButtonText}>Back to dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Pending state (default)
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      <ActivityIndicator color="#6C47FF" size="large" style={styles.spinner} />
      <Text style={styles.titlePending}>Transaction submitted</Text>
      <Text style={styles.subtitleMuted}>
        Waiting for Solana confirmation...
      </Text>
      <Text style={styles.txHash}>{truncatedSig}</Text>
      <TouchableOpacity onPress={handleViewOnSolscan} activeOpacity={0.75}>
        <Text style={styles.link}>View on Solscan →</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>This usually takes 1–2 seconds</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
  },
  contentContainer: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 24,
  },
  titlePending: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  titleSuccess: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ADE80',
    marginBottom: 8,
    marginTop: 16,
  },
  titleFailed: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F87171',
    marginBottom: 8,
    marginTop: 16,
  },
  titleTimeout: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FBBF24',
    marginBottom: 8,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitleMuted: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
  },
  txHash: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  link: {
    fontSize: 14,
    color: '#6C47FF',
    marginBottom: 8,
  },
  linkAccent: {
    fontSize: 14,
    color: '#A78BFA',
    marginBottom: 24,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 16,
  },
  iconCircleSuccess: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 2,
    borderColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleFailed: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderWidth: 2,
    borderColor: '#F87171',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleTimeout: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 2,
    borderColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTextSuccess: {
    fontSize: 48,
    color: '#4ADE80',
    lineHeight: 56,
  },
  iconTextFailed: {
    fontSize: 48,
    color: '#F87171',
    lineHeight: 56,
  },
  iconTextTimeout: {
    fontSize: 36,
    color: '#FBBF24',
    lineHeight: 44,
  },
  addContactButton: {marginTop: 12, padding: 8},
  addContactText: {fontSize: 14, color: '#6C47FF', fontWeight: '600'},
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ghostButton: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ghostButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },
});
