import React from 'react';
import {
  View,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {Check, X, Copy, ArrowLeft} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {useTransactionDetail} from '../../hooks/useSolanaQueries';
import {formatChecksumParts} from '../../modules/solana/transferRisk';
import {formatAddress} from '../../utils/formatAddress';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {getExplorerUrl} from '../../utils/explorerUrl';
import {addressBook} from '../../modules/addressBook/addressBookModule';
import {cn} from '../../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  signature: string;
  onBack: () => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChecksumAddr({address}: {address: string}) {
  const {head, tail} = formatChecksumParts(address);
  return (
    <Text className="font-geist-mono text-[13px] text-fg-secondary text-right">
      <Text className="text-accent-transparent font-geist-semibold">{head}</Text>
      {tail ? (
        <>
          {'…'}
          <Text className="text-accent-transparent font-geist-semibold">{tail}</Text>
        </>
      ) : null}
    </Text>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  onCopy?: () => void;
}

function DetailRow({label, value, mono, onCopy}: DetailRowProps) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-3 border-b border-bg-surface-2 min-h-[48px]">
      <Text variant="overline" className="text-fg-secondary pt-0.5">
        {label}
      </Text>
      <View className="flex-1 items-end">
        {typeof value === 'string' ? (
          <Text
            variant="body-sm"
            className={cn('text-right', mono ? 'font-geist-mono text-fg-secondary text-[13px]' : 'text-fg-primary')}
            numberOfLines={2}>
            {value}
          </Text>
        ) : (
          value
        )}
        {onCopy ? (
          <Pressable onPress={onCopy} className="flex-row items-center gap-1 mt-1">
            <Copy size={14} color="#B084FC" />
            <Text variant="caption" className="text-accent-transparent">
              Copy
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TransactionDetailScreen({signature, onBack}: Props) {
  const {data: tx, isLoading} = useTransactionDetail(signature);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleCopySig() {
    try {
      Clipboard.setString(signature);
      setTimeout(() => Clipboard.setString(''), 30_000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  function handleSaveContact() {
    try {
      if (tx?.to) {
        addressBook.addContact({
          name: formatAddress(tx.to),
          address: tx.to,
          addressType: 'transparent',
          lastUsedAt: Date.now(),
        });
      }
    } catch {
      // address book write failed — no-op
    }
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const truncatedSig =
    signature.length > 16
      ? `${signature.slice(0, 8)}…${signature.slice(-8)}`
      : signature;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={22} color="#A8ACB5" />
        </Pressable>
        <Text variant="h2" className="ml-1">
          Transaction
        </Text>
      </View>

      {/* Loading state */}
      {(isLoading || tx === undefined) ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#B084FC" />
          <Text variant="body-sm" className="text-fg-tertiary">
            Loading transaction…
          </Text>
        </View>
      ) : tx === null ? (
        /* Not-found state */
        <>
          <View className="flex-1 items-center justify-center px-6">
            <Text variant="body" className="text-fg-secondary text-center">
              Couldn't load this transaction
            </Text>
          </View>
          <View className="px-5 pb-4 gap-2">
            <Button
              label="View on explorer"
              variant="secondary"
              onPress={() => Linking.openURL(getExplorerUrl(signature)).catch(() => {})}
            />
            <Button label="Back" variant="primary" onPress={onBack} />
          </View>
        </>
      ) : (
        /* Ready state */
        <ScrollView contentContainerClassName="px-5 pb-4">
          {/* Amount card */}
          <View className="bg-bg-surface-1 rounded-2xl p-6 items-center mt-2">
            <Text variant="overline" className="text-fg-secondary">
              {tx.type === 'Send' ? 'Sent' : 'Transaction'}
            </Text>
            <Text
              className="text-fg-primary font-geist-semibold mt-2"
              style={{fontSize: 28}}>
              {tx.amount ? `${tx.amount} ${tx.tokenSymbol}` : '—'}
            </Text>

            {/* Status pill */}
            {tx.status === 'failed' ? (
              <View className="flex-row items-center gap-1 mt-3 px-3 py-1.5 rounded-pill bg-[rgba(248,113,113,0.14)]">
                <X size={12} color="#F87171" />
                <Text variant="caption" className="text-danger font-geist-semibold">
                  Failed
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1 mt-3 px-3 py-1.5 rounded-pill bg-[rgba(63,214,139,0.14)]">
                <Check size={12} color="#3FD68B" />
                <Text variant="caption" className="text-success font-geist-semibold">
                  Confirmed
                </Text>
              </View>
            )}
          </View>

          {/* Detail card */}
          <View className="bg-bg-surface-1 rounded-lg px-5 mt-4">
            <DetailRow label="Type" value={tx.type} />
            <DetailRow
              label="Status"
              value={tx.status[0].toUpperCase() + tx.status.slice(1)}
            />
            <DetailRow label="From" value={<ChecksumAddr address={tx.from} />} />
            <DetailRow
              label="To"
              value={
                tx.to ? (
                  <ChecksumAddr address={tx.to} />
                ) : (
                  <Text className="text-fg-primary">—</Text>
                )
              }
            />
            <DetailRow
              label="Hash"
              value={truncatedSig}
              mono
              onCopy={handleCopySig}
            />
            <DetailRow label="Block" value={String(tx.slot)} />
            <DetailRow
              label="Network fee"
              value={`${formatTokenAmount(tx.feeLamports, 9)} SOL`}
            />
            {tx.memo ? (
              <DetailRow label="Memo" value={tx.memo} />
            ) : null}
          </View>

          {/* Actions */}
          <View className="px-1 pt-4 gap-2">
            <Button
              label="View on explorer"
              variant="secondary"
              onPress={() => Linking.openURL(getExplorerUrl(signature)).catch(() => {})}
            />
            {tx.to ? (
              <Button
                label="Save to address book"
                variant="primary"
                onPress={handleSaveContact}
              />
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
