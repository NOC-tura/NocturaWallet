/**
 * M1d spec §4.1 — the Accounts sheet (undrawn until M1d; built from the design system, the
 * TokenPickerSheet's bottom-sheet pattern). Lists the main account and every fresh exit with its
 * tags, short address and balances; the selected row has the check. No Add, no rename, no remove
 * (D6). Rows are radios in a radiogroup.
 */
import React from 'react';
import {Modal, Pressable, ScrollView, View} from 'react-native';
import {Check} from 'lucide-react-native';
import {Text} from '../ui';
import {cn} from '../../utils/cn';
import {useAccountRowBalances} from '../../hooks/useAccountRowBalances';
import type {RowBalance} from '../../hooks/useAccountRowBalances';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {shortAccountAddress} from '../../modules/accounts/accountList';
import type {AccountList, WalletAccount} from '../../modules/accounts/accountList';
import {formatSide, publicSide} from '../../modules/accounts/valueLine';
import type {TokenPrice} from '../../modules/prices/priceModule';
import {isShieldedEnabled} from '../../constants/features';
import {
  ACCOUNTS_FOOTER,
  ACCOUNTS_TITLE,
  ACCOUNTS_UNREADABLE,
  ROW_NOT_CHECKED,
  ROW_UNAVAILABLE,
  TAG_EXIT,
  TAG_LINKED,
  TAG_MAIN,
  VALUE_HIDDEN,
} from '../../copy/accounts';

export interface AccountsSheetProps {
  visible: boolean;
  list: AccountList;
  selectedScheme: string;
  /** the dashboard's eye: balances hidden there are hidden here too (review r1 m4) */
  hidden: boolean;
  onSelect: (scheme: string) => void;
  onClose: () => void;
}

export function tagsOf(a: WalletAccount): string[] {
  const tags = [a.isMain ? TAG_MAIN : TAG_EXIT];
  if (a.linked) {
    tags.push(TAG_LINKED);
  }
  return tags;
}

/** One row's balances: the dashboard's public-side rule, assets joined by " · " (plan A10). */
export function rowBalanceText(row: RowBalance | undefined, prices: Record<string, TokenPrice> | null): string {
  if (!row || row.state === 'not-checked') {
    return ROW_NOT_CHECKED;
  }
  if (row.state === 'failed') {
    return ROW_UNAVAILABLE;
  }
  return formatSide(publicSide({status: 'ready', ...row.data, syncedAt: row.at}), prices, ' · ');
}

export function AccountsSheet({visible, list, selectedScheme, hidden, onSelect, onClose}: AccountsSheetProps) {
  const rows = useAccountRowBalances(
    list.accounts.map(a => a.address),
    visible,
  );
  const {prices, havePrices} = useResolvedPrices();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose} accessibilityLabel="Close accounts">
        {/* Inner press stops the backdrop tap from closing when tapping the sheet. */}
        <Pressable onPress={() => {}} className="bg-bg-surface-1 rounded-t-2xl pt-2 pb-8" testID="accounts-sheet">
          <View className="items-center py-2">
            <View className="w-10 h-1 rounded-pill bg-fg-tertiary" />
          </View>
          <Text variant="overline" className="text-fg-secondary px-5 pt-1 pb-2">
            {ACCOUNTS_TITLE}
          </Text>
          {list.unreadable ? (
            <Text variant="body-sm" className="text-warning px-5 pb-2" testID="accounts-unreadable">
              {ACCOUNTS_UNREADABLE}
            </Text>
          ) : null}
          <ScrollView className="max-h-96">
            <View accessibilityRole="radiogroup" testID="accounts-radiogroup">
              {list.accounts.map(a => {
                const checked = a.scheme === selectedScheme;
                const tags = tagsOf(a);
                return (
                  <Pressable
                    key={a.scheme}
                    onPress={() => (checked ? onClose() : onSelect(a.scheme))}
                    accessibilityRole="radio"
                    accessibilityState={{checked}}
                    accessibilityLabel={`${a.label}, ${tags.join(', ')}`}
                    testID={`accounts-row-${a.scheme}`}
                    className="flex-row items-center px-5 py-3 min-h-touch-rec active:bg-bg-surface-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text variant="body-lg" className="text-fg-primary">
                          {a.label}
                        </Text>
                        {tags.map(t => (
                          <View
                            key={t}
                            testID={`accounts-row-${a.scheme}-tag-${t}`}
                            className={cn(
                              'px-2 py-0.5 rounded-pill',
                              t === TAG_LINKED ? 'bg-[rgba(242,181,59,0.16)]' : 'bg-bg-surface-3',
                            )}>
                            <Text variant="caption" className={t === TAG_LINKED ? 'text-warning' : 'text-fg-secondary'}>
                              {t}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text variant="caption" mono className="text-fg-tertiary mt-0.5" testID={`accounts-row-${a.scheme}-address`}>
                        {shortAccountAddress(a.address)}
                      </Text>
                      <Text variant="body-sm" numeral className="text-fg-secondary mt-0.5" testID={`accounts-row-${a.scheme}-balance`}>
                        {hidden ? VALUE_HIDDEN : rowBalanceText(rows[a.address], havePrices ? prices : null)}
                      </Text>
                    </View>
                    {checked ? (
                      <View testID={`accounts-row-${a.scheme}-check`}>
                        <Check size={18} color="#B084FC" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          {/* review r1 I3: only where "A new account" exists (a build with private balances) */}
          {isShieldedEnabled() && list.walletKind === 'slip10' ? (
            <Text variant="caption" className="text-fg-tertiary px-5 pt-3" testID="accounts-footer">
              {ACCOUNTS_FOOTER}
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
