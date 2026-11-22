import React from 'react';
import {View, ScrollView, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send as SendIcon,
  ArrowDownToLine,
  Repeat,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {TokenLogo} from '../../components/TokenLogo';
import {SparkChart, SparkChartSkeleton} from '../../components/SparkChart';
import {useSelectedAccount} from '../../hooks/useSelectedAccount';
import {NO_PUBLIC_DATA, useAccountPublicData} from '../../hooks/useAccountPublicData';
import {VALUE_UNKNOWN, relativeAge, staleNote} from '../../copy/accounts';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {usePriceHistory} from '../../hooks/usePriceHistory';
import {buildHoldings} from '../../modules/prices/holdings';
import {computePortfolio, priceKeyFor} from '../../modules/prices/portfolio';
import {
  coingeckoIdForMint,
  changeOverSeries,
  type Timeframe,
} from '../../modules/prices/priceHistory';
import {CORE_TOKENS} from '../../modules/tokens/coreTokens';
import {NOC_MINT} from '../../constants/programs';
import {isPricingEnabled} from '../../constants/chain';
import {isSwappable} from '../../modules/swap/swapTokens';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {mmkvPublic} from '../../store/mmkv/instances';
import {formatUsdString} from '../../utils/formatUsd';
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  mint: string;
  onBack: () => void;
  onSend: (mint: string) => void;
  onReceive: () => void;
  onSwap: (mint: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEFRAMES: Timeframe[] = ['24H', '7D', '30D', '1Y'];

// ── Main component ────────────────────────────────────────────────────────────

export function TokenDetailScreen({mint, onBack, onSend, onReceive, onSwap}: Props) {
  // ── Data wiring ────────────────────────────────────────────────────────────

  // M1d (plan A6): opened from the dashboard's list of the SELECTED account — its holding is that account's
  const {data: publicData} = useAccountPublicData(useSelectedAccount());
  // post-M1d R10: a stale holding is drawn (dimmed, with its age) — "known" = a figure exists
  const publicKnown = publicData.status === 'ready' || publicData.status === 'stale';
  const {solBalance, nocBalance, tokenBalances, tokens} =
    publicData.status === 'ready' || publicData.status === 'stale' ? publicData : NO_PUBLIC_DATA;
  const staleText = publicData.status === 'stale' ? staleNote(relativeAge(publicData.syncedAt, Date.now())) : null;
  // review r1-7 / R16: the age is recomputed on every render, and a tick re-renders every 60 s while the figure is
  // stale. A plain effect, not useFocusEffect: this screen is a modal (mounted = shown) and its tests render it
  // without a navigator.
  const isStale = staleText !== null;
  const [, setAgeTick] = React.useState(0);
  React.useEffect(() => {
    if (!isStale) {
      return undefined;
    }
    const id = setInterval(() => setAgeTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isStale]);
  const {prices, havePrices} = useResolvedPrices();

  const isNoc = mint === NOC_MINT;
  const isSol = mint === 'native';

  const meta = isSol
    ? {symbol: 'SOL', name: 'Solana', decimals: 9}
    : CORE_TOKENS.find(t => t.mint === mint) ??
      tokens.find(t => t.mint === mint) ??
      {symbol: '?', name: 'Token', decimals: 9};

  const balanceRaw = isSol
    ? solBalance
    : (tokenBalances[mint] ?? (isNoc ? nocBalance : '0'));

  const price = prices[priceKeyFor(mint)]?.usd ?? null; // r2-4: wSOL is priced as SOL
  // Display-only float: feeds the USD fiat figure, NOT a money path. The exact
  // token amount shown to the user comes from formatBalanceForDisplay (BigInt).
  const uiAmount = Number(balanceRaw || '0') / 10 ** meta.decimals;
  const fiat = price != null ? uiAmount * price : null;

  const holdings = buildHoldings({solBalance, nocBalance, tokenBalances, tokens});
  const portfolio = computePortfolio(holdings, prices);
  const pct =
    portfolio.totalUsd > 0 && portfolio.perToken[mint] != null
      ? (portfolio.perToken[mint].usd / portfolio.totalUsd) * 100
      : null;

  const tfKey = `${MMKV_KEYS.TOKEN_TIMEFRAME_PREFIX}${mint}`;
  const [tf, setTf] = React.useState<Timeframe>(() => {
    // Validate the persisted value — a stale 'All' (removed) falls back to 24H.
    const stored = mmkvPublic.getString(tfKey) as Timeframe;
    return TIMEFRAMES.includes(stored) ? stored : '24H';
  });
  const onPickTf = (next: Timeframe) => {
    setTf(next);
    mmkvPublic.set(tfKey, next);
  };

  const logoUri = tokens.find(t => t.mint === mint)?.logoUri;

  // No market chart for NOC (pre-TGE), nor on a build without pricing (devnet: its SOL has no
  // market) — there the history query is never scheduled.
  const pricing = isPricingEnabled();
  const noMarket = isNoc || !pricing;
  const cgId = coingeckoIdForMint(priceKeyFor(mint));
  const history = usePriceHistory(pricing ? cgId : null, tf);
  const series = history.data?.prices ?? [];
  const change = noMarket ? null : changeOverSeries(series);

  // ── Derived display values ─────────────────────────────────────────────────

  const ticker = isNoc ? 'NOC · pre-TGE' : meta.symbol;
  const priceDisplay =
    havePrices && price != null ? formatUsdString(price) : '—';
  const isUp = (change?.pct ?? 0) >= 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <ArrowLeft size={22} color="#A8ACB5" />
        </Pressable>
        <Text variant="h2" className="ml-2">
          {meta.symbol}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}>
        {/* Price hero */}
        <View className="items-center px-5 pt-4 pb-6">
          <TokenLogo symbol={meta.symbol} isNoc={isNoc} logoUri={logoUri} />

          <Text variant="body-lg" className="text-fg-primary mt-3">
            {meta.name}
          </Text>
          <Text variant="body-sm" className="text-fg-tertiary mt-0.5">
            {ticker}
          </Text>

          <Text
            className="text-fg-primary font-geist-semibold mt-4"
            style={{fontSize: 32}}>
            {priceDisplay}
          </Text>

          {/* Change line — hidden for NOC (no market) */}
          {change != null ? (
            <View className="flex-row items-center gap-1.5 mt-2">
              {isUp ? (
                <TrendingUp size={14} color="#3FD68B" strokeWidth={2} />
              ) : (
                <TrendingDown size={14} color="#F87171" strokeWidth={2} />
              )}
              <Text
                variant="body-sm"
                numeral
                className={isUp ? 'text-success' : 'text-danger'}>
                {`${change.absUsd >= 0 ? '+' : '−'}${formatUsdString(
                  Math.abs(change.absUsd),
                )} · ${change.pct >= 0 ? '+' : '−'}${Math.abs(change.pct).toFixed(2)}% · ${tf}`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Chart area */}
        <View className="px-5 mb-2">
          {isNoc ? (
            <View className="items-center py-6">
              <Text variant="body-sm" className="text-fg-tertiary">
                Pre-TGE · no market chart yet
              </Text>
            </View>
          ) : !pricing || history.isError ? (
            <View className="items-center" style={{height: 120, justifyContent: 'center'}}>
              <Text variant="body-sm" className="text-fg-tertiary">
                Chart unavailable
              </Text>
            </View>
          ) : history.isLoading ? (
            <SparkChartSkeleton height={120} />
          ) : (
            <SparkChart prices={series} up={isUp} height={120} />
          )}
        </View>

        {/* Timeframe chips — only where a market chart exists */}
        {!noMarket ? (
          <View className="flex-row items-center justify-between px-5 mt-3 mb-6">
            {TIMEFRAMES.map(t => {
              const active = tf === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => onPickTf(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t} timeframe`}
                  accessibilityState={{selected: active}}
                  style={{minHeight: 44, justifyContent: 'center', alignItems: 'center'}}
                  className={
                    active
                      ? 'px-4 rounded-pill bg-accent-transparent-tint'
                      : 'px-4 rounded-pill'
                  }>
                  <Text
                    variant="body-sm"
                    className={
                      active
                        ? 'text-accent-transparent font-geist-semibold'
                        : 'text-fg-tertiary'
                    }>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="mb-6" />
        )}

        {/* Holdings card */}
        <View className="mx-5 bg-bg-surface-1 rounded-2xl p-5 mb-4">
          <Text variant="overline" className="text-fg-secondary mb-3">
            YOUR HOLDINGS
          </Text>
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="body-lg" numeral className={isStale ? 'text-fg-tertiary' : 'text-fg-primary'}>
                {`${publicKnown ? formatBalanceForDisplay(balanceRaw, meta.decimals) : VALUE_UNKNOWN} ${meta.symbol}`}
              </Text>
              <Text variant="body-sm" numeral className={isStale ? 'text-fg-tertiary mt-0.5' : 'text-fg-secondary mt-0.5'}>
                {fiat != null && publicKnown ? formatUsdString(fiat) : '—'}
              </Text>
            </View>
            {pct != null ? (
              <View className="items-end">
                <Text variant="body-sm" numeral className="text-fg-tertiary">
                  {`${pct.toFixed(1)}% of portfolio`}
                </Text>
              </View>
            ) : null}
          </View>
          {staleText !== null ? (
            <Text variant="caption" className="text-fg-secondary mt-2" testID="token-detail-stale">
              {staleText}
            </Text>
          ) : null}
        </View>

        {/* Quick actions */}
        <View className="flex-row mx-5 gap-3">
          <ActionCell
            Icon={SendIcon}
            label="Send"
            onPress={() => onSend(mint)}
          />
          <ActionCell
            Icon={ArrowDownToLine}
            label="Receive"
            onPress={onReceive}
          />
          {isSwappable(mint) ? (
            <ActionCell
              Icon={Repeat}
              label="Swap"
              onPress={() => onSwap(mint)}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ActionCellProps {
  Icon: typeof SendIcon;
  label: string;
  sub?: string;
  onPress?: () => void;
  disabled?: boolean;
}

function ActionCell({Icon, label, sub, onPress, disabled = false}: ActionCellProps) {
  const iconColor = disabled ? '#6E727A' : '#B084FC';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      className={`flex-1 items-center justify-center py-3 rounded-2xl bg-bg-surface-1 gap-1${
        disabled ? ' opacity-50' : ' active:bg-bg-surface-2'
      }`}>
      <View className="w-9 h-9 rounded-pill bg-bg-surface-2 items-center justify-center">
        <Icon size={18} color={iconColor} strokeWidth={1.75} />
      </View>
      <Text variant="caption" className="text-fg-secondary">
        {label}
      </Text>
      {sub != null ? (
        <Text variant="caption" className="text-fg-tertiary">
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}
