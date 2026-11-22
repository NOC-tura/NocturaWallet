import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useSelectedAccount} from '../../hooks/useSelectedAccount';
import {useTransactionHistory} from '../../hooks/useSolanaQueries';
import {formatAddress} from '../../utils/formatAddress';
import type {ParsedTransaction} from '../../modules/solana/types';
import {parseTokenAmount} from '../../utils/parseTokenAmount';
import {HISTORY_EMPTY, HISTORY_ERROR, HISTORY_LOADING} from '../../copy/accounts';

interface Props {
  onSelectTx: (signature: string, account: string) => void;
  onBack: () => void;
}

function statusBadgeStyle(status: ParsedTransaction['status']) {
  switch (status) {
    case 'confirmed':
    case 'finalized':
      return styles.badgeGreen;
    case 'failed':
      return styles.badgeRed;
    default:
      return styles.badgeAmber;
  }
}

function statusLabel(status: ParsedTransaction['status']) {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'finalized':
      return 'Finalized';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
  }
}

interface TransactionRowProps {
  tx: ParsedTransaction;
  publicKey: string | null;
  nocUsdPrice: number;
  onPress: () => void;
}

/**
 * Approximates USD value for a tx amount string (e.g. "1.5 SOL" or "100 NOC").
 * Only applies nocUsdPrice to NOC amounts — returns null for other tokens
 * since we don't have their USD price data in the store.
 */
function approximateUsd(amount: string | undefined | null, nocUsdPrice: number): string | null {
  if (!amount || nocUsdPrice <= 0) return null;
  const parts = amount.split(' ');
  const numStr = parts[0];
  const token = parts[1]?.toUpperCase();
  if (!numStr) return null;
  // Only show USD for NOC — other tokens need their own price feeds
  if (token && token !== 'NOC') return null;
  try {
    const lamports = parseTokenAmount(numStr, 9);
    const tokenUnits = Number(lamports) / 1e9;
    const usd = tokenUnits * nocUsdPrice;
    if (!isFinite(usd) || usd <= 0) return null;
    return `≈ $${usd.toFixed(2)}`;
  } catch {
    return null;
  }
}

function TransactionRow({tx, publicKey, nocUsdPrice, onPress}: TransactionRowProps) {
  // I1: getTransactionHistory sets no from/to/amount — claim no direction that is not known
  const hasDirection = tx.from != null || tx.to != null;
  const isSent = tx.from === publicKey;
  const icon = !hasDirection ? '•' : isSent ? '↑' : '↓';
  const counterparty = isSent ? tx.to : tx.from;
  const dateStr = tx.timestamp
    ? new Date(tx.timestamp * 1000).toLocaleString()
    : '—';
  const usdApprox = approximateUsd(tx.amount, nocUsdPrice);

  return (
    <TouchableOpacity
      testID={`tx-row-${tx.signature}`}
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowMiddle}>
        <Text style={styles.rowAddress}>
          {counterparty ? formatAddress(counterparty) : '—'}
        </Text>
        <Text style={styles.rowDate}>{dateStr}</Text>
      </View>
      <View style={styles.rowRight}>
        {tx.amount != null && (
          <Text style={styles.rowAmount}>{tx.amount}</Text>
        )}
        {usdApprox != null && (
          <Text style={styles.rowUsd}>{usdApprox}</Text>
        )}
        <View style={[styles.badge, statusBadgeStyle(tx.status)]}>
          <Text style={styles.badgeText}>{statusLabel(tx.status)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function TransactionHistoryScreen({onSelectTx, onBack}: Props) {
  // M1d (spec §4.2, D1): the SELECTED account's history
  const selected = useSelectedAccount();
  const publicKey = selected?.address ?? null;
  const nocUsdPrice = useWalletStore(s => s.nocUsdPrice);
  const {data, isSuccess, isError, refetch} = useTransactionHistory(publicKey);
  const transactions = React.useMemo(() => data ?? [], [data]);
  // r1-1: one read in flight at a time (the pattern of #12); the line says "Loading…" while it runs
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  // m5: a retry started for one account must not block, or later reset, another account's
  const generationRef = useRef(0);
  useEffect(() => {
    generationRef.current += 1;
    retryingRef.current = false;
    setRetrying(false);
  }, [publicKey]);
  const retry = useCallback(() => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    const generation = generationRef.current;
    refetch().finally(() => {
      if (generation !== generationRef.current) return;
      retryingRef.current = false;
      setRetrying(false);
    });
  }, [refetch]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Transaction History</Text>
          {selected ? (
            <Text style={styles.accountLabel} testID="history-account-label">
              {selected.label}
            </Text>
          ) : null}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={transactions}
        keyExtractor={item => item.signature}
        renderItem={({item}) => (
          <TransactionRow
            tx={item}
            publicKey={publicKey}
            nocUsdPrice={nocUsdPrice}
            onPress={() => {
              if (publicKey !== null) onSelectTx(item.signature, publicKey);
            }}
          />
        )}
        ListHeaderComponent={
          isError ? (
            <Pressable
              testID="history-retry"
              onPress={retry}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityState={{disabled: retrying, busy: retrying}}
              style={styles.retry}
              hitSlop={8}>
              <Text style={styles.retryText}>{retrying ? HISTORY_LOADING : HISTORY_ERROR}</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          // I2: "No transactions yet" only after a completed, successful read. post-M1d §7 (m1): with no
          // account resolved nothing is being read, so nothing is claimed — not even "Loading".
          publicKey === null ? null : isSuccess ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{HISTORY_EMPTY}</Text>
            </View>
          ) : isError ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{HISTORY_LOADING}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  backButton: {color: '#a78bfa', fontSize: 16},
  title: {color: '#ffffff', fontSize: 20, fontWeight: '700'},
  accountLabel: {color: '#A8ACB5', fontSize: 13, marginTop: 2},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  rowIcon: {fontSize: 20, color: '#a78bfa', marginRight: 12},
  rowMiddle: {flex: 1},
  rowAddress: {color: '#ffffff', fontSize: 14, fontWeight: '500'},
  rowDate: {color: '#6b7280', fontSize: 12, marginTop: 2},
  rowRight: {alignItems: 'flex-end', gap: 4},
  rowAmount: {color: '#ffffff', fontSize: 14, fontWeight: '600'},
  rowUsd: {color: '#6b7280', fontSize: 11, marginTop: 1},
  badge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  badgeGreen: {backgroundColor: '#065f46'},
  badgeAmber: {backgroundColor: '#92400e'},
  badgeRed: {backgroundColor: '#7f1d1d'},
  badgeText: {color: '#ffffff', fontSize: 11},
  emptyContainer: {flex: 1, alignItems: 'center', marginTop: 80},
  retry: {paddingHorizontal: 16, paddingVertical: 12},
  retryText: {color: '#F2B53B', fontSize: 14},
  emptyText: {color: '#6b7280', fontSize: 16},
});
