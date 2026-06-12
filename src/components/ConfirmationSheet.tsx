import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {formatAddress} from '../utils/formatAddress';

interface ConfirmationSheetProps {
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  networkFee: string;
  accountCreation?: string;
  simulationPassed: boolean;
  /** Real reason the dry-run failed, surfaced instead of a generic message. */
  simulationError?: string | null;
  /** True while a re-simulation is in flight (Retry button spinner). */
  retrying?: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Re-run the simulation (shown only on the failed state). */
  onRetry?: () => void;
  /** Broadcast despite a failed simulation (shown only on the failed state). */
  onContinueAnyway?: () => void;
}

export function ConfirmationSheet({
  from,
  to,
  amount,
  tokenSymbol,
  networkFee,
  accountCreation,
  simulationPassed,
  simulationError,
  retrying = false,
  loading,
  onConfirm,
  onCancel,
  onRetry,
  onContinueAnyway,
}: ConfirmationSheetProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm Transaction</Text>

      <View style={styles.rows}>
        <Row label="From" value={formatAddress(from)} />
        <Row label="To" value={formatAddress(to)} />
        <Row label="Amount" value={`${amount} ${tokenSymbol}`} />
        <Row label="Network fee" value={networkFee} />
        {accountCreation != null && (
          <Row label="Account creation" value={accountCreation} warning />
        )}
      </View>

      {simulationPassed ? (
        // ── Simulation passed · standard confirm ───────────────────────────
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.75}
            accessibilityLabel="Cancel transaction">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.75}
            accessibilityLabel="Confirm transaction">
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.confirmText}>Confirm &amp; Send</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        // ── Simulation failed · Retry / Continue anyway / Cancel ───────────
        <>
          <Text style={styles.simulationError}>
            {simulationError
              ? `Simulation failed: ${simulationError}`
              : "The network couldn't dry-run this transaction. Retry, or continue anyway."}
          </Text>

          <View style={styles.stackedButtons}>
            <TouchableOpacity
              style={[styles.confirmButton, retrying && styles.confirmButtonDisabled]}
              onPress={onRetry}
              disabled={retrying || loading}
              activeOpacity={0.75}
              accessibilityLabel="Retry simulation">
              {retrying ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmText}>Retry simulation</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.warningButton}
              onPress={onContinueAnyway}
              disabled={loading}
              activeOpacity={0.75}
              accessibilityLabel="Continue anyway">
              {loading ? (
                <ActivityIndicator color="#F59E0B" size="small" />
              ) : (
                <Text style={styles.warningText}>Continue anyway</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostButton}
              onPress={onCancel}
              activeOpacity={0.75}
              accessibilityLabel="Cancel transaction">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

interface RowProps {
  label: string;
  value: string;
  warning?: boolean;
}

function Row({label, value, warning = false}: RowProps) {
  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, warning && rowStyles.valueWarning]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  valueWarning: {
    color: '#F59E0B',
  },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#13131E',
    borderRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  rows: {
    marginBottom: 20,
  },
  simulationError: {
    fontSize: 13,
    color: '#F87171',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  stackedButtons: {
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  ghostButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },
  confirmButton: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: '#6C47FF',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: 'rgba(108,71,255,0.35)',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  warningButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.5)',
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  warningText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
