/**
 * M1d spec §4.1 — the Accounts sheet (undrawn until M1d; built from the design system, the
 * TokenPickerSheet's bottom-sheet pattern). Lists the main account and every fresh exit with its
 * tags, short address and balances; the selected row has the check. No Add, no rename, no remove
 * (D6). Rows are radios in a radiogroup.
 */
import React, {useMemo} from 'react';
import {Modal, Pressable, ScrollView, useWindowDimensions, View} from 'react-native';
import {Check} from 'lucide-react-native';
import {Text} from '../ui';
import {cn} from '../../utils/cn';
import {useAccountRowBalances} from '../../hooks/useAccountRowBalances';
import type {RowBalance} from '../../hooks/useAccountRowBalances';
import {useWalletStore} from '../../store/zustand/walletStore';
import {mainBalanceIsStale, mainBalanceIsUnknown} from '../../modules/accounts/staleness';
import {withPoolToken} from '../../modules/accounts/poolToken';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {shortAccountAddress} from '../../modules/accounts/accountList';
import type {AccountList, WalletAccount} from '../../modules/accounts/accountList';
import {formatSide, publicSide} from '../../modules/accounts/valueLine';
import type {TokenPrice} from '../../modules/prices/priceModule';
import {isShieldedEnabled} from '../../constants/features';
import {useLinkCheckUnfinished} from '../../hooks/useLinkCheckUnfinished';
import {
  ACCOUNTS_CLOSE_A11Y,
  ACCOUNTS_FOOTER,
  ACCOUNTS_TITLE,
  ACCOUNTS_UNREADABLE,
  LINK_CHECK_UNFINISHED,
  ROW_NOT_CHECKED,
  ROW_UNAVAILABLE,
  TAG_EXIT,
  TAG_LINKED,
  TAG_MAIN,
  VALUE_HIDDEN,
  VALUE_HIDDEN_SPOKEN,
  rowA11y,
  staleRow,
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
  // 'ready' and 'stale' carry a figure; the caller dims a stale one and adds " · not updated" (post-M1d §3.2)
  return formatSide(publicSide({status: 'ready', ...row.data, syncedAt: row.at}), prices, ' · ');
}

export function AccountsSheet({visible, list, selectedScheme, hidden, onSelect, onClose}: AccountsSheetProps) {
  // The list takes up to 60% of the screen (a fixed 384 dp cut it after ~3½ rows) and shows its scrollbar.
  const {height: windowHeight} = useWindowDimensions();
  // M1d review M11: the main account's figures are walletStore's (what the dashboard shows) — no RPC read
  // for it here; only the other accounts are read by address.
  const solBalance = useWalletStore(s => s.solBalance);
  const nocBalance = useWalletStore(s => s.nocBalance);
  const tokenBalances = useWalletStore(s => s.tokenBalances);
  const tokens = useWalletStore(s => s.tokens);
  const lastSyncedAt = useWalletStore(s => s.lastSyncedAt);
  const lastSyncFailedAt = useWalletStore(s => s.lastSyncFailedAt);
  const others = list.accounts.filter(a => !a.isMain);
  const otherRows = useAccountRowBalances(
    others.map(a => a.address),
    visible,
  );
  const rows = useMemo<Record<string, RowBalance>>(() => {
    const out: Record<string, RowBalance> = {...otherRows};
    for (const a of list.accounts) {
      if (a.isMain) {
        if (mainBalanceIsUnknown(lastSyncedAt, lastSyncFailedAt)) {
          out[a.address] = {state: 'failed'}; // review r1-1: a sync was tried, nothing was ever read → "Balance unavailable"
        } else if (!lastSyncedAt) {
          out[a.address] = {state: 'not-checked'};
        } else {
          const data = withPoolToken({solBalance, nocBalance, tokenBalances, tokens});
          // R10: the main row reads walletStore, so it applies the main account's stale rule itself
          out[a.address] = mainBalanceIsStale(lastSyncedAt, lastSyncFailedAt)
            ? {state: 'stale', data, at: lastSyncedAt}
            : {state: 'ready', data, at: lastSyncedAt};
        }
      }
    }
    return out;
  }, [otherRows, list.accounts, solBalance, nocBalance, tokenBalances, tokens, lastSyncedAt, lastSyncFailedAt]);
  const {prices, havePrices} = useResolvedPrices();
  // owner Q3: the last link scan of an exit did not read its history through (failed / capped)
  const linkUnfinished = useLinkCheckUnfinished();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose} accessibilityLabel={ACCOUNTS_CLOSE_A11Y}>
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
          <ScrollView style={{maxHeight: Math.round(windowHeight * 0.6)}} showsVerticalScrollIndicator persistentScrollbar>
            <View accessibilityRole="radiogroup" testID="accounts-radiogroup">
              {list.accounts.map(a => {
                const checked = a.scheme === selectedScheme;
                const tags = tagsOf(a);
                const row = rows[a.address];
                const stale = row?.state === 'stale';
                const figure = hidden ? VALUE_HIDDEN : rowBalanceText(row, havePrices ? prices : null);
                // hidden wins over stale: "•••", and the suffix still says the figure is not current
                const balanceText = stale ? staleRow(figure) : figure;
                // the same line for a screen reader: only the mask itself is spoken as "Hidden"
                const spokenBalance = hidden ? (stale ? staleRow(VALUE_HIDDEN_SPOKEN) : VALUE_HIDDEN_SPOKEN) : balanceText;
                // a tagged exit needs no caption: the tag already says more than an unfinished check could
                const unfinished = !a.isMain && !a.linked && linkUnfinished(a.address);
                const rowLabel = rowA11y(a.label, tags, shortAccountAddress(a.address), spokenBalance);
                return (
                  <Pressable
                    key={a.scheme}
                    onPress={() => (checked ? onClose() : onSelect(a.scheme))}
                    accessibilityRole="radio"
                    accessibilityState={{checked}}
                    accessibilityLabel={unfinished ? `${rowLabel}, ${LINK_CHECK_UNFINISHED}` : rowLabel}
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
                      <Text variant="body-sm" numeral className={cn('mt-0.5', stale ? 'text-fg-tertiary' : 'text-fg-secondary')} testID={`accounts-row-${a.scheme}-balance`} accessibilityLabel={hidden ? spokenBalance : undefined}>
                        {balanceText}
                      </Text>
                      {unfinished ? (
                        <Text variant="caption" className="text-fg-tertiary mt-0.5" testID={`accounts-row-${a.scheme}-link-unfinished`}>
                          {LINK_CHECK_UNFINISHED}
                        </Text>
                      ) : null}
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
