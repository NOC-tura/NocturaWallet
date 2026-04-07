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
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationSheet({
  from,
  to,
  amount,
  tokenSymbol,
  networkFee,
  accountCreation,
  simulationPassed,
  loading,
  onConfirm,
  onCancel,
}: ConfirmationSheetProps) {
  const isDisabled = !simulationPassed || loading;

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

      {!simulationPassed && (
        <Text style={styles.simulationError}>
          Transaction simulation failed. Please check your balance and try again.
        </Text>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.75}
          accessibilityLabel="Cancel transaction">
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, isDisabled && styles.confirmButtonDisabled]}
          onPress={onConfirm}
          disabled={isDisabled}
          activeOpacity={0.75}
          accessibilityLabel="Confirm transaction">
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.confirmText}>Confirm &amp; Send</Text>
          )}
        </TouchableOpacity>
      </View>
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
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
});
