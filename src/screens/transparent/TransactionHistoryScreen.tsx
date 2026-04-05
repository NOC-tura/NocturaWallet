import React, {useState} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useTransactionHistory} from '../../hooks/useSolanaQueries';
import {formatAddress} from '../../utils/formatAddress';
import type {ParsedTransaction} from '../../modules/solana/types';

type FilterTab = 'All' | 'Sent' | 'Received' | 'Shielded' | 'Staking';

const FILTER_TABS: FilterTab[] = ['All', 'Sent', 'Received', 'Shielded', 'Staking'];

interface Props {
  onSelectTx: (signature: string) => void;
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
  onPress: () => void;
}

function TransactionRow({tx, publicKey, onPress}: TransactionRowProps) {
  const isSent = tx.from === publicKey;
  const icon = isSent ? '↑' : '↓';
  const counterparty = isSent ? tx.to : tx.from;
  const dateStr = tx.timestamp
    ? new Date(tx.timestamp * 1000).toLocaleString()
    : '—';

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
        <View style={[styles.badge, statusBadgeStyle(tx.status)]}>
          <Text style={styles.badgeText}>{statusLabel(tx.status)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function TransactionHistoryScreen({onSelectTx, onBack}: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const publicKey = useWalletStore(s => s.publicKey);
  const {data: transactions = []} = useTransactionHistory(publicKey);

  const filtered = React.useMemo(() => {
    if (activeFilter === 'All') return transactions;
    if (activeFilter === 'Sent') {
      return transactions.filter(tx => tx.from === publicKey);
    }
    if (activeFilter === 'Received') {
      return transactions.filter(tx => tx.to === publicKey);
    }
    // Shielded and Staking: not yet distinguishable from on-chain data in Phase 2
    // Return empty until shielded/staking tx parsing is implemented
    return [];
  }, [transactions, activeFilter, publicKey]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Transaction History</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
        testID="filter-tabs"
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            testID={`filter-tab-${tab}`}
            style={[styles.tab, activeFilter === tab && styles.tabActive]}
            onPress={() => setActiveFilter(tab)}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.tabText,
                activeFilter === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.signature}
        renderItem={({item}) => (
          <TransactionRow
            tx={item}
            publicKey={publicKey}
            onPress={() => onSelectTx(item.signature)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
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
  tabsContainer: {maxHeight: 52},
  tabsContent: {paddingHorizontal: 16, gap: 8, alignItems: 'center'},
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  tabActive: {backgroundColor: '#7c3aed'},
  tabText: {color: '#9ca3af', fontSize: 14},
  tabTextActive: {color: '#ffffff', fontWeight: '600'},
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
  badge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  badgeGreen: {backgroundColor: '#065f46'},
  badgeAmber: {backgroundColor: '#92400e'},
  badgeRed: {backgroundColor: '#7f1d1d'},
  badgeText: {color: '#ffffff', fontSize: 11},
  emptyContainer: {flex: 1, alignItems: 'center', marginTop: 80},
  emptyText: {color: '#6b7280', fontSize: 16},
});
