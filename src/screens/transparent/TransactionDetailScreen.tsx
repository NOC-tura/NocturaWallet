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
import {txDirection} from '../../modules/solana/txDetail';
import {
  TX_SENT,
  TX_RECEIVED,
  TX_NEUTRAL,
  TX_TOKEN_ACCOUNT,
  TX_FEE_PAYER,
  TX_AUTHORIZED_BY,
} from '../../copy/transactions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  signature: string;
  /** R9: the account whose history or #21 opened this detail; null from a deep link */
  account: string | null;
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
      <Text variant="overline" className="text-fg-secondary pt-0.5 shrink-0 pr-1">
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

export function TransactionDetailScreen({signature, account, onBack}: Props) {
  const {data: tx, isLoading} = useTransactionDetail(signature);
  const transfer = tx?.transfer ?? null;
  const direction = tx ? txDirection(tx, account) : 'none';
  const directionWord = direction === 'sent' ? TX_SENT : direction === 'received' ? TX_RECEIVED : TX_NEUTRAL;
  // a contact is a WALLET that is not this account: never a token account, never oneself
  const contactAddress = transfer !== null && !transfer.toIsTokenAccount && transfer.to !== account ? transfer.to : null;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleCopySig() {
    try {
      Clipboard.setString(signature);
      setTimeout(() => Clipboard.setString(''), 30_000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  const [saved, setSaved] = React.useState(false);
  const alreadyContact = contactAddress !== null ? addressBook.findByAddress(contactAddress) != null : false;

  function handleSaveContact() {
    if (contactAddress === null) return;
    try {
      addressBook.addContact({
        name: formatAddress(contactAddress),
        address: contactAddress,
        addressType: 'transparent',
        lastUsedAt: Date.now(),
      });
      setSaved(true);
    } catch {
      // address book write failed — keep the button tappable
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
            <Text variant="overline" className="text-fg-secondary" testID="tx-detail-direction">
              {directionWord}
            </Text>
            <Text className="text-fg-primary font-geist-semibold mt-2" style={{fontSize: 28}} testID="tx-detail-amount">
              {transfer?.amount ? `${transfer.amount} ${transfer.symbol}`.trim() : '—'}
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
            <DetailRow label="Type" value={directionWord} />
            <DetailRow label="Status" value={tx.status[0].toUpperCase() + tx.status.slice(1)} />
            {transfer !== null ? (
              <>
                <DetailRow
                  label="From"
                  value={
                    <View className="items-end" testID="tx-detail-from">
                      {transfer.from !== null ? <ChecksumAddr address={transfer.from} /> : <Text className="text-fg-primary">—</Text>}
                    </View>
                  }
                />
                {/* review r1-10: a delegate (or an authority whose relation to the funds is not known) is named apart */}
                {transfer.authority !== null && transfer.authority !== transfer.from ? (
                  <DetailRow
                    label={TX_AUTHORIZED_BY}
                    value={
                      <View className="items-end" testID="tx-detail-authority">
                        <ChecksumAddr address={transfer.authority} />
                      </View>
                    }
                  />
                ) : null}
                <DetailRow
                  label="To"
                  value={
                    <View className="items-end" testID="tx-detail-to">
                      <ChecksumAddr address={transfer.to} />
                      {transfer.toIsTokenAccount ? (
                        <Text variant="caption" className="text-fg-tertiary mt-0.5">
                          {TX_TOKEN_ACCOUNT}
                        </Text>
                      ) : null}
                    </View>
                  }
                />
              </>
            ) : (
              <DetailRow label={TX_FEE_PAYER} value={<ChecksumAddr address={tx.feePayer} />} />
            )}
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
            {contactAddress !== null ? (
              <Button
                label={saved || alreadyContact ? 'Saved to address book ✓' : 'Save to address book'}
                variant="primary"
                disabled={saved || alreadyContact}
                onPress={handleSaveContact}
              />
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
