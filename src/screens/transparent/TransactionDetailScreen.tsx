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
import {useParsedTx} from '../../hooks/useParsedTx';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {formatChecksumParts} from '../../modules/solana/transferRisk';
import {formatAddress} from '../../utils/formatAddress';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {formatUsdString} from '../../utils/formatUsd';
import {getExplorerUrl} from '../../utils/explorerUrl';
import {addressBook} from '../../modules/addressBook/addressBookModule';
import {cn} from '../../utils/cn';
import {NETWORK} from '../../constants/programs';
import {parseTxDetail} from '../../modules/solana/txDetail';
import {classifyActivity} from '../../modules/solana/activity';
import {activityContext} from '../../modules/solana/activityContext';
import {peekHistorySession} from '../../modules/solana/historySession';
import {activityWord, changeLine, detailTime, deviceTimeZone, heroAmount, partiesAgree, primaryUsdToday} from '../../modules/solana/activityView';
import {priceKeyFor} from '../../modules/prices/portfolio';
import {trustedSymbol} from '../../modules/tokens/trustedSymbol';
import {TX_FEE_PAYER, TX_AUTHORIZED_BY, TX_BALANCE_CHANGES, TX_DATE, TX_INCOMPLETE, txAtTodaysPrice} from '../../copy/transactions';
import {usePublicSettingsStore} from '../../store/zustand/publicSettingsStore';
import {BELOW_ONE_CENT, VALUE_HIDDEN, VALUE_HIDDEN_SPOKEN} from '../../copy/accounts';

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
  /** what a screen reader says for a string value (a masked figure says "Hidden") */
  valueLabel?: string;
  onCopy?: () => void;
  copyTestID?: string;
}

function DetailRow({label, value, mono, valueLabel, onCopy, copyTestID}: DetailRowProps) {
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
            numberOfLines={2}
            accessibilityLabel={valueLabel}>
            {value}
          </Text>
        ) : (
          value
        )}
        {onCopy ? (
          <Pressable onPress={onCopy} className="flex-row items-center gap-1 mt-1" testID={copyTestID}>
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
  // history spec §4.6: the raw transaction (the cache #26 fills), read twice — `parseTxDetail` for the rows PR 1
  // built, `classifyActivity` for the hero: what the transaction was for the account it was opened from
  const {raw, isLoading, notFound} = useParsedTx(signature);
  const tx = React.useMemo(() => (raw === undefined ? null : parseTxDetail(raw, signature, trustedSymbol)), [raw, signature]);
  const row = React.useMemo(() => {
    if (raw === undefined || account === null) {
      return null; // a deep link: no account, so nothing is claimed about a direction or an amount
    }
    // the history session's token accounts when one exists; otherwise (from #21, a deep link) none (r3 m-f)
    const own = peekHistorySession(NETWORK, account)?.tokenAccountSources;
    return classifyActivity(raw, account, raw.meta?.err ? 'failed' : 'confirmed', activityContext(own));
  }, [raw, account]);
  const transfer = tx?.transfer ?? null;
  const directionWord = activityWord(row);
  // owner, Q2: the dashboard's hide-balances setting (the one source — `publicSettingsStore`) also covers every
  // figure here: the hero, today's value, the balance changes and the fee. Words, addresses and the hash stay.
  const hidden = usePublicSettingsStore(s => s.hideBalances);
  const shownHero = heroAmount(row);
  const hero = shownHero !== null && hidden ? VALUE_HIDDEN : shownHero;
  // From / To only when the transfer the parser read IS the row (§4.6); then both wallets are known
  const parties = transfer !== null && transfer.from !== null && partiesAgree(transfer, row, account) ? {...transfer, from: transfer.from} : null;
  const {prices} = useResolvedPrices();
  // an incomplete row claims no value: no "≈ $x" line (Task 8 review I1)
  const incomplete = row?.incomplete === true;
  const usdToday = incomplete ? null : primaryUsdToday(row, mint => prices[priceKeyFor(mint)]?.usd ?? null);
  // a contact is a WALLET that is not this account: never a token account, never oneself
  const contactAddress = parties !== null && parties.to !== account ? parties.to : null;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function copyText(text: string) {
    try {
      Clipboard.setString(text);
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
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#B084FC" />
          <Text variant="body-sm" className="text-fg-tertiary">
            Loading transaction…
          </Text>
        </View>
      ) : notFound || tx === null ? (
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
            {/* §4.6: with no `primary` there is no amount line */}
            {hero !== null ? (
              <Text className="text-fg-primary font-geist-semibold mt-2 text-center" style={{fontSize: 28}} testID="tx-detail-amount" accessibilityLabel={hidden ? VALUE_HIDDEN_SPOKEN : undefined}>
                {hero}
              </Text>
            ) : null}
            {incomplete && hero !== null ? (
              <Text variant="caption" className="text-fg-tertiary mt-1" testID="tx-detail-incomplete">
                {TX_INCOMPLETE}
              </Text>
            ) : null}
            {/* H7: only today's price is known — the line says so, and is absent with no price */}
            {usdToday !== null ? (
              <Text variant="body-sm" numeral className="text-fg-secondary mt-1" testID="tx-detail-usd" accessibilityLabel={hidden ? VALUE_HIDDEN_SPOKEN : undefined}>
                {hidden ? VALUE_HIDDEN : txAtTodaysPrice(usdToday < 0.005 ? BELOW_ONE_CENT : formatUsdString(usdToday))}
              </Text>
            ) : null}

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
            <DetailRow label={TX_DATE} value={<Text variant="body-sm" className="text-fg-primary text-right" testID="tx-detail-date">{detailTime(tx.blockTime, deviceTimeZone())}</Text>} />
            {parties !== null ? (
              <>
                <DetailRow
                  label="From"
                  onCopy={() => copyText(parties.from)}
                  copyTestID="tx-detail-copy-from"
                  value={
                    <View className="items-end" testID="tx-detail-from">
                      <ChecksumAddr address={parties.from} />
                    </View>
                  }
                />
                {/* review r1-10: a delegate is named apart (state 27f) */}
                {parties.authority !== null && parties.authority !== parties.from ? (
                  <DetailRow
                    label={TX_AUTHORIZED_BY}
                    onCopy={() => copyText(parties.authority ?? '')}
                    copyTestID="tx-detail-copy-authority"
                    value={
                      <View className="items-end" testID="tx-detail-authority">
                        <ChecksumAddr address={parties.authority} />
                      </View>
                    }
                  />
                ) : null}
                <DetailRow
                  label="To"
                  onCopy={() => copyText(parties.to)}
                  copyTestID="tx-detail-copy-to"
                  value={
                    <View className="items-end" testID="tx-detail-to">
                      <ChecksumAddr address={parties.to} />
                    </View>
                  }
                />
              </>
            ) : (
              <>
                <DetailRow label={TX_FEE_PAYER} value={<ChecksumAddr address={tx.feePayer} />} />
              </>
            )}
            {/* §4.6: every net change of this account, each with its role — in place of From / To, and under them
                whenever there is more than the one figure (a rent paid, a markup, a second asset; review I2) */}
            {row !== null && row.deltas.length > 0 && (parties === null || row.deltas.length > 1) ? (
              <DetailRow
                label={TX_BALANCE_CHANGES}
                value={
                  <View className="items-end" testID="tx-detail-changes">
                    {row.deltas.map((d, k) => (
                      <Text key={`${d.role}-${d.mint}-${k}`} variant="body-sm" numeral className="text-fg-primary text-right" testID={`tx-detail-change-${k}`} accessibilityLabel={hidden ? changeLine(d, true).replace(VALUE_HIDDEN, VALUE_HIDDEN_SPOKEN) : undefined}>
                        {changeLine(d, hidden)}
                      </Text>
                    ))}
                    {incomplete ? (
                      <Text variant="caption" className="text-fg-tertiary" testID="tx-detail-changes-incomplete">
                        {TX_INCOMPLETE}
                      </Text>
                    ) : null}
                  </View>
                }
              />
            ) : null}
            <DetailRow
              label="Hash"
              value={truncatedSig}
              mono
              onCopy={() => copyText(signature)}
              copyTestID="tx-detail-copy-hash"
            />
            <DetailRow label="Block" value={String(tx.slot)} />
            <DetailRow
              label="Network fee"
              value={hidden ? VALUE_HIDDEN : `${formatTokenAmount(tx.feeLamports, 9)} SOL`}
              valueLabel={hidden ? VALUE_HIDDEN_SPOKEN : undefined}
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
