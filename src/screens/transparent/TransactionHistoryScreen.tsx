/**
 * #26 (history spec 2026-11-26 §5): the selected account's history — real rows under date sections,
 * filtered by chips. What a row says is `rowView` (pure, `modules/solana/activityView.ts`); the rows
 * come from `useActivityHistory`.
 *
 * NEVER A CLAIM THAT WAS NOT READ (§1.2): "No transactions yet" only after a successful read that
 * reached the end of history with zero rows; a chip with no match among the loaded rows says so
 * ("in the last {n}") and offers "Load older"; with no account resolved the list area is empty.
 * When the wallet owns more token accounts than were read, the line saying so ("History from 24 of
 * 31 token accounts") stands under the rows AND under either empty line: "no transactions" is never
 * said alone about a history that was only partly read.
 *
 * HIDE BALANCES (owner, Q2): with the dashboard's eye closed every figure of a row reads "•••";
 * the title, the counter-party, the time and the status stay.
 *
 * THE CLOCK the sections are cut by is read again when the data changes and when the app comes back
 * to the foreground (a list left open overnight). A list that stays in the foreground through
 * midnight with no new data keeps its sections until one of the two happens.
 *
 * LOADING OLDER (§5.2): reaching the end of the list loads the next page, but stops after 3
 * consecutive pages that added no row under the active chip (an empty chip cannot be scrolled, and a
 * list shorter than the screen would otherwise read the whole history in a burst). After that only
 * "Load older" loads. The All chip never stops: every page adds rows.
 *
 * THE FIFTH CHIP, "Private", exists only in a build with the private mode (owner Q1, 2026-11-27): without
 * it no row can be a pool move (classifier rule 2 runs only on the pool's cluster), and the chip would page
 * the whole history for rows that cannot exist. A stored 'private' then reads as All.
 */
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, SectionList, View} from 'react-native';
import {ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Circle, Settings, Shield, TriangleAlert} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {cn} from '../../utils/cn';
import {useAccountList, useSelectedAccount} from '../../hooks/useSelectedAccount';
import {useActivityHistory} from '../../hooks/useActivityHistory';
import {chipMatches, counterpartyLabel, deviceTimeZone, groupSections, rowView, sectionHeading} from '../../modules/solana/activityView';
import type {RowIcon, RowView} from '../../modules/solana/activityView';
import type {HistoryRow, HistorySnapshot} from '../../modules/solana/history';
import {HISTORY_PAGE_SIZE} from '../../modules/solana/historySession';
import {HISTORY_EMPTY, HISTORY_ERROR, HISTORY_LOADING, VALUE_HIDDEN, VALUE_HIDDEN_SPOKEN} from '../../copy/accounts';
import {
  HISTORY_BACK,
  HISTORY_CHIPS,
  HISTORY_TITLE,
  HISTORY_LOAD_OLDER,
  SECTION_TODAY,
  SECTION_YESTERDAY,
  TX_POOL_BADGE_LABEL,
  historyChipNone,
  historyChipNoneLoaded,
  historyCoverage,
} from '../../copy/transactions';
import type {HistoryChipId} from '../../copy/transactions';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {shortAccountAddress} from '../../modules/accounts/accountList';
import {usePublicSettingsStore} from '../../store/zustand/publicSettingsStore';
import {isShieldedEnabled} from '../../constants/features';

interface Props {
  onSelectTx: (signature: string, account: string) => void;
  onBack: () => void;
  /** for tests: the clock (ms) and the IANA zone the sections are cut in; the device's by default */
  now?: number;
  timeZone?: string;
}

/** §5.2: automatic loading stops after this many consecutive pages with no row under the active chip */
const DRY_PAGE_LIMIT = 3;

const ICON_SHELL: Record<RowIcon, string> = {
  sent: 'bg-bg-surface-2',
  received: 'bg-[rgba(63,214,139,0.14)]',
  swap: 'bg-[rgba(125,168,255,0.14)]',
  private: 'bg-accent-shielded-tint',
  setup: 'bg-bg-surface-2',
  failed: 'bg-[rgba(255,92,106,0.14)]',
  dot: 'bg-bg-surface-2',
};

function RowGlyph({icon}: {icon: RowIcon}) {
  switch (icon) {
    case 'sent':
      return <ArrowUpRight size={20} color="#F2F3F5" />;
    case 'received':
      return <ArrowDownLeft size={20} color="#3FD68B" />;
    case 'swap':
      return <ArrowLeftRight size={20} color="#7DA8FF" />;
    case 'private':
      return <Shield size={20} color="#5BE3C2" />;
    case 'setup':
      return <Settings size={20} color="#A8ACB5" />;
    case 'failed':
      return <TriangleAlert size={20} color="#FF5C6A" />;
    case 'dot':
      return <Circle size={8} color="#A8ACB5" fill="#A8ACB5" />;
  }
}

const TONE: Record<RowView['amountTone'], string> = {
  default: 'text-fg-primary',
  success: 'text-success',
  tertiary: 'text-fg-tertiary',
};

/** Controller ruling C: the figure reads "•••" on screen and "Hidden" to a screen reader */
const spoken = (part: string, hidden: boolean): string => (hidden && part === VALUE_HIDDEN ? VALUE_HIDDEN_SPOKEN : part);

interface RowItemProps {
  row: HistoryRow;
  labelOf: (address: string) => string;
  clock: number;
  zone: string;
  hidden: boolean;
  onSelect: (signature: string) => void;
}

/** memoised: only a change of its own row, the clock, the zone, the mask or the labels re-renders it */
const HistoryRowItem = memo(function HistoryRowItem({row, labelOf, clock, zone, hidden, onSelect}: RowItemProps) {
  const signature = row.item.signature;
  const view = useMemo(() => rowView(row, labelOf, clock, zone, hidden), [row, labelOf, clock, zone, hidden]);
  // the design sets a counter-party ADDRESS in the mono face; a wallet's label ("Account 2") stays in the body face
  const counterparty = row.activity?.counterparty ?? null;
  const mono = counterparty !== null && view.secondary.includes(shortAccountAddress(counterparty));
  const onPress = useCallback(() => onSelect(signature), [onSelect, signature]);
  const id = `tx-row-${signature}`;
  return (
    <Pressable
      testID={id}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[view.title, view.badge ? TX_POOL_BADGE_LABEL : '', view.secondary, `${spoken(view.amount, hidden)}${view.note ?? ''}`, spoken(view.sub ?? '', hidden)].filter(s => s !== '').join(', ')}
      className="flex-row items-center gap-3 px-5 py-3 min-h-touch-lg active:bg-bg-surface-1">
      <View testID={`${id}-icon-${view.icon}`} className={cn('w-10 h-10 rounded-pill items-center justify-center', ICON_SHELL[view.icon])}>
        <RowGlyph icon={view.icon} />
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-2">
          <Text variant="body-lg" numberOfLines={1} className="shrink" testID={`${id}-title`}>
            {view.title}
          </Text>
          {view.badge ? (
            // owner, Q1: an icon and no word — both pool transactions are public on chain
            <View
              testID={`${id}-badge`}
              accessible
              accessibilityRole="image"
              accessibilityLabel={TX_POOL_BADGE_LABEL}
              className="w-5 h-5 rounded-pill items-center justify-center bg-accent-shielded-tint">
              <Shield size={10} color="#5BE3C2" />
            </View>
          ) : null}
        </View>
        {view.secondary !== '' ? (
          <Text variant="body-sm" mono={mono} numberOfLines={1} className="text-fg-tertiary" testID={`${id}-secondary`}>
            {view.secondary}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text variant={view.amountTone === 'tertiary' ? 'body-sm' : 'body-lg'} numeral className={TONE[view.amountTone]} testID={`${id}-amount`}>
          {view.amount}
          {view.note !== null ? <Text variant="body-sm" className="text-fg-tertiary">{view.note}</Text> : null}
        </Text>
        {view.sub !== null ? (
          <Text variant="body-sm" numeral className="text-fg-tertiary" testID={`${id}-sub`}>
            {view.sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

function SkeletonRow() {
  return (
    <View testID="history-skeleton-row" className="flex-row items-center gap-3 px-5 py-3 min-h-touch-lg">
      <View className="w-10 h-10 rounded-pill bg-bg-surface-2" />
      <View className="flex-1 gap-2">
        <View className="h-3 w-3/5 rounded bg-bg-surface-2" />
        <View className="h-2.5 w-1/3 rounded bg-bg-surface-2" />
      </View>
      <View className="h-3 w-16 rounded bg-bg-surface-2" />
    </View>
  );
}

/** 26a: 5 skeleton rows across 2 sections while the first page is read */
function Skeleton() {
  return (
    <View testID="history-skeleton" accessible accessibilityLabel={HISTORY_LOADING}>
      <Text variant="overline" className="px-5 pt-4 pb-2 text-fg-secondary">
        {SECTION_TODAY}
      </Text>
      <SkeletonRow />
      <SkeletonRow />
      <Text variant="overline" className="px-5 pt-4 pb-2 text-fg-secondary">
        {SECTION_YESTERDAY}
      </Text>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

const countUnder = (rows: readonly HistoryRow[], chip: HistoryChipId): number => rows.filter(r => chipMatches(chip, r)).length;

export function TransactionHistoryScreen({onSelectTx, onBack, now, timeZone}: Props) {
  // M1d (spec §4.2, D1): the SELECTED account's history
  const selected = useSelectedAccount();
  const accountList = useAccountList();
  const publicKey = selected?.address ?? null;
  const {data, isSuccess, isError, refetch, loadOlder, loadingOlder} = useActivityHistory(publicKey);
  // owner, Q2: the dashboard's hide-balances setting (its one source) also hides the figures of these rows
  const hidden = usePublicSettingsStore(s => s.hideBalances);
  // owner Q1: the Private chip only where the private mode is built (a build constant: read once per mount)
  const chips = useMemo(() => HISTORY_CHIPS.filter(c => c.id !== 'private' || isShieldedEnabled()), []);
  // #26 (design): the chip last chosen survives a remount; an unknown stored value — or a chip this build
  // does not show — reads as All
  const [chip, setChip] = useState<HistoryChipId>(() => {
    const stored = mmkvPublic.getString(MMKV_KEYS.ACTIVITY_FILTER);
    return chips.find(c => c.id === stored)?.id ?? 'all';
  });
  const pickChip = useCallback((next: HistoryChipId) => {
    setChip(next);
    mmkvPublic.set(MMKV_KEYS.ACTIVITY_FILTER, next);
  }, []);
  // I1: an older page that could not be read stops the scrolling's own loading until the user taps "Load older"
  const [olderFailed, setOlderFailed] = useState(false);
  // m2: the chip a load was started under, against the one now
  const chipRef = useRef(chip);

  // r1-1: one read in flight at a time (the pattern of #12); the line says "Loading…" while it runs
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // m5: a retry started for one account must not block, or later reset, another account's
  const generationRef = useRef(0);
  // §5.2: consecutive pages that added no row under the active chip
  const dryPagesRef = useRef(0);
  useEffect(() => {
    generationRef.current += 1;
    retryingRef.current = false;
    setRetrying(false);
    setRefreshing(false);
    setOlderFailed(false);
    dryPagesRef.current = 0;
  }, [publicKey]);
  useEffect(() => {
    chipRef.current = chip;
    dryPagesRef.current = 0;
    setOlderFailed(false);
  }, [chip]);

  const read = useCallback(
    (onDone: () => void) => {
      if (retryingRef.current) {
        return;
      }
      retryingRef.current = true;
      const generation = generationRef.current;
      refetch()
        .catch(() => undefined)
        .finally(() => {
          if (generation !== generationRef.current) {
            return;
          }
          retryingRef.current = false;
          onDone();
        });
    },
    [refetch],
  );
  const retry = useCallback(() => {
    if (retryingRef.current) {
      return;
    }
    setRetrying(true);
    setOlderFailed(false);
    read(() => setRetrying(false));
  }, [read]);
  const onRefresh = useCallback(() => {
    if (retryingRef.current) {
      return;
    }
    setRefreshing(true);
    setOlderFailed(false);
    read(() => setRefreshing(false));
  }, [read]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const visible = useMemo(() => rows.filter(r => chipMatches(chip, r)), [rows, chip]);
  const endReached = data?.endReached ?? false;
  // the clock the sections are cut by: read again whenever the data changes, and when the app comes back to the
  // foreground (a list left open past midnight)
  const [clock, setClock] = useState(() => now ?? Date.now());
  useEffect(() => {
    setClock(now ?? Date.now());
  }, [now, data]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setClock(now ?? Date.now());
      }
    });
    return () => subscription.remove();
  }, [now]);
  const zone = useMemo(() => timeZone ?? deviceTimeZone(), [timeZone]);
  const sections = useMemo(() => groupSections(visible, clock, zone), [visible, clock, zone]);
  const labelOf = useCallback((address: string) => counterpartyLabel(accountList, address), [accountList]);

  const loadMore = useCallback(async () => {
    if (data === undefined || endReached || loadingOlder) {
      return;
    }
    const startedChip = chip;
    const generation = generationRef.current;
    const before = countUnder(rows, chip);
    const next: HistorySnapshot | null = await loadOlder();
    if (chipRef.current !== startedChip || generation !== generationRef.current) {
      return; // the verdict belongs to a chip or an account that is no longer shown
    }
    if (next === null) {
      setOlderFailed(true);
      return;
    }
    setOlderFailed(false);
    dryPagesRef.current = countUnder(next.rows, chip) > before ? 0 : dryPagesRef.current + 1;
  }, [data, endReached, loadingOlder, rows, chip, loadOlder]);
  const onEndReached = useCallback(() => {
    if (olderFailed) {
      return; // I1: a failed page is retried by the user's tap, never by the list's own re-firing
    }
    if (chip === 'all' || dryPagesRef.current < DRY_PAGE_LIMIT) {
      loadMore().catch(() => undefined);
    }
  }, [chip, loadMore, olderFailed]);
  const onSelect = useCallback(
    (signature: string) => {
      if (publicKey !== null) {
        onSelectTx(signature, publicKey);
      }
    },
    [publicKey, onSelectTx],
  );
  const renderItem = useCallback(
    ({item}: {item: HistoryRow}) => <HistoryRowItem row={item} labelOf={labelOf} clock={clock} zone={zone} hidden={hidden} onSelect={onSelect} />,
    [labelOf, clock, zone, hidden, onSelect],
  );

  const loadOlderButton =
    data !== undefined && !endReached ? (
      <Pressable
        testID="history-load-older"
        onPress={() => {
          loadMore().catch(() => undefined);
        }}
        disabled={loadingOlder}
        accessibilityRole="button"
        accessibilityState={{disabled: loadingOlder, busy: loadingOlder}}
        className="self-center mt-3 px-5 min-h-touch-min items-center justify-center rounded-pill bg-bg-surface-2 active:opacity-80">
        <Text variant="body-sm" className="text-accent-transparent">
          {loadingOlder ? HISTORY_LOADING : HISTORY_LOAD_OLDER}
        </Text>
      </Pressable>
    ) : null;

  // §3.2: said wherever the list says anything about what exists — under the rows and under either empty line
  const coverageLine =
    data !== undefined && data.coverage.read < data.coverage.total ? (
      <Text variant="caption" className="text-fg-tertiary text-center px-5 pt-4" testID="history-coverage">
        {historyCoverage(data.coverage.read, data.coverage.total)}
      </Text>
    ) : null;

  const empty =
    // post-M1d §7 (m1): with no account resolved nothing is being read, so nothing is claimed
    publicKey === null ? null : data === undefined ? (
      isError ? null : (
        <Skeleton />
      )
    ) : rows.length === 0 && endReached && isSuccess ? (
      // I2: "No transactions yet" only after a successful read that reached the end of history
      <View className="items-center mt-20 px-6">
        <Text variant="body" className="text-fg-tertiary">
          {HISTORY_EMPTY}
        </Text>
        {coverageLine}
      </View>
    ) : rows.length === 0 || chip === 'all' ? null : (
      // the All chip with rows never has an empty state (and "No transactions yet" would be wrong: older ones may exist)
      <View className="items-center mt-12 px-6" testID="history-chip-empty">
        <Text variant="body" className="text-fg-tertiary text-center">
          {/* final review 6: "… yet" only when the last read succeeded — after a failed refresh, the loaded span */}
          {endReached && isSuccess ? historyChipNone(chip) : historyChipNoneLoaded(chip, rows.length)}
        </Text>
        {loadOlderButton}
        {coverageLine}
      </View>
    );

  const footer =
    data === undefined || visible.length === 0 ? null : (
      <View className="pb-8">
        {/* the All chip loads by itself; under a filter the explicit control is always there (§5.2) */}
        {chip === 'all' ? (
          // a constant height: the spinner coming and going must not change the list's length (that re-fires onEndReached)
          <View className="h-16 items-center justify-center">
            {loadingOlder ? (
              <View testID="history-loading-older">
                <ActivityIndicator color="#B084FC" />
              </View>
            ) : olderFailed ? (
              loadOlderButton
            ) : null}
          </View>
        ) : (
          loadOlderButton
        )}
        {coverageLine}
      </View>
    );

  return (
    <View className="flex-1 bg-bg-base">
      <View className="flex-row items-center gap-3 p-4">
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text variant="body-lg" className="text-accent-transparent">
            {HISTORY_BACK}
          </Text>
        </Pressable>
        <View>
          <Text variant="h2">{HISTORY_TITLE}</Text>
          {selected ? (
            <Text variant="body-sm" className="text-fg-secondary mt-0.5" testID="history-account-label">
              {selected.label}
            </Text>
          ) : null}
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 gap-2 pb-2">
          {chips.map(c => {
            const active = c.id === chip;
            const mint = c.id === 'private';
            return (
              <Pressable
                key={c.id}
                testID={`history-chip-${c.id}`}
                onPress={() => pickChip(c.id)}
                accessibilityRole="button"
                accessibilityState={{selected: active}}
                className={cn(
                  'min-h-[44px] min-w-[44px] px-4 rounded-pill items-center justify-center',
                  mint && 'flex-row gap-1.5',
                  active ? (mint ? 'bg-accent-shielded-tint' : 'bg-accent-transparent-tint') : 'bg-bg-surface-2',
                )}>
                {mint ? (
                  <View testID={`history-chip-${c.id}-icon`}>
                    <Shield size={13} color={active ? '#5BE3C2' : '#A8ACB5'} />
                  </View>
                ) : null}
                <Text variant="body-sm" className={active ? (mint ? 'text-accent-shielded' : 'text-accent-transparent') : 'text-fg-secondary'}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <SectionList
        testID="history-list"
        sections={sections}
        keyExtractor={item => item.item.signature}
        stickySectionHeadersEnabled={false}
        initialNumToRender={HISTORY_PAGE_SIZE}
        renderSectionHeader={({section}) => (
          <Text variant="overline" className="px-5 pt-4 pb-2 text-fg-secondary" testID={`history-section-${section.key}`}>
            {sectionHeading(section, section.data[0], clock, zone)}
          </Text>
        )}
        renderItem={renderItem}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          publicKey === null ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B084FC" colors={['#B084FC']} />
        }
        ListHeaderComponent={
          isError && publicKey !== null ? (
            <Pressable
              testID="history-retry"
              onPress={retry}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityState={{disabled: retrying, busy: retrying}}
              className="px-4 py-3"
              hitSlop={8}>
              <Text variant="body-sm" className="text-warning">
                {retrying ? HISTORY_LOADING : HISTORY_ERROR}
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
      />
    </View>
  );
}
