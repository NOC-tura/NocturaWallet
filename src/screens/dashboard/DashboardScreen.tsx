import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  Vibration,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Bell,
  ScanLine,
  Eye,
  EyeOff,
  ShieldCheck,
  Shield,
  Send,
  ArrowDownToLine,
  ArrowLeftRight,
  CreditCard,
  ChevronRight,
  TrendingUp,
  Rocket,
} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {usePublicSettingsStore} from '../../store/zustand/publicSettingsStore';
import {useNetworkStatus} from '../../hooks/useNetworkStatus';
import {useAccentColor} from '../../hooks/useAccent';
import {forceSync} from '../../modules/backgroundSync/backgroundSyncModule';
import {TokenManager} from '../../modules/tokens/tokenModule';
import {NOC_MINT} from '../../constants/programs';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {cn} from '../../utils/cn';

const SOLANA_LOGO = require('../../assets/tokens/solana-sol-logo.png');
const NOC_LOGO = require('../../assets/tokens/noc-logo.png');

/**
 * #11 Dashboard — Phase B migration · mirror /home/user/Downloads/index.html §s11
 *
 * Sections:
 *   - Top row · avatar (initial) + bell + scan
 *   - Mode toggle · Transparent / Shielded segmented pill
 *   - Balance hero · overline, eye toggle, balance + cents, change line, sub-balance
 *   - Quick actions · Send · Receive · Swap|Shield · Buy (4-button grid)
 *   - Tokens section · header + token rows
 *   - Banner · presale (transparent) or "Privacy is on" (shielded)
 *
 * Mode-aware:
 *   - Transparent: violet accents, "Total balance" eyebrow, Swap action, presale banner
 *   - Shielded: mint accents, "SHIELDED · vault balance" eyebrow, Shield action,
 *     privacy banner, "· shielded" tag on rows
 *
 * Privacy hide-ladder (per design D · "Hide-balance privacy completeness"):
 *   - Hero balance + cents → blurred dots
 *   - Sub-balance counts → "••••"
 *   - Token row balances + fiat values → "••••"
 *   - 24h % deltas remain visible (no leak — they're public market data)
 *
 * Deferred (separate work):
 *   - Skeleton state (600 ms cold-mount loading shimmer)
 *   - Notifications screen (bell tap no-op for now)
 *   - QR scan screen (scan tap no-op for now)
 *   - Recent activity strip (annotation-only in design; lives on #28 detail)
 *   - iOS floating-tab Liquid Glass variant
 */

const tokenManager = new TokenManager();

interface DashboardScreenProps {
  onSend?: () => void;
  onReceive?: () => void;
  onShield?: () => void;
  onBuy?: () => void;
  onScan?: () => void;
  onNotifications?: () => void;
  onProfileTap?: () => void;
  onPresale?: () => void;
  onFirstShieldedToggle?: () => void;
  onTokenTap?: (mint: string) => void;
  onSeeAllTokens?: () => void;
}

function formatUsd(value: number): {whole: string; cents: string} {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(2);
  const [w, c] = fixed.split('.');
  const whole = '$' + Number(w).toLocaleString('en-US');
  return {whole, cents: `.${c ?? '00'}`};
}

function formatTokenAmount(raw: string, decimals = 4): string {
  const num = Number(raw);
  if (!Number.isFinite(num)) return '0';
  if (num === 0) return '0';
  if (num < 0.0001) return num.toExponential(2);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function getAddressInitial(address?: string | null): string {
  if (!address || address.length === 0) return 'N';
  return address.charAt(0).toUpperCase();
}

export function DashboardScreen({
  onSend,
  onReceive,
  onShield,
  onBuy,
  onScan,
  onNotifications,
  onProfileTap,
  onPresale,
  onFirstShieldedToggle,
  onTokenTap,
  onSeeAllTokens,
}: DashboardScreenProps) {
  const {publicKey, solBalance, nocBalance, totalUsdValue, tokens, tokenBalances} =
    useWalletStore();
  const {mode, setMode} = useShieldedStore();
  const hideBalances = usePublicSettingsStore(s => s.hideBalances);
  const setHideBalances = usePublicSettingsStore(s => s.setHideBalances);
  const {isOnline} = useNetworkStatus();
  const accentColor = useAccentColor();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await forceSync();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleToggleBalance = useCallback(() => {
    Vibration.vibrate(15);
    setHideBalances(!hideBalances);
  }, [hideBalances, setHideBalances]);

  const handleModeToggle = useCallback(
    (target: 'transparent' | 'shielded') => {
      if (target === mode) return;
      // First shielded toggle fires the privacy explainer modal (which sets
      // PRIVACY_EXPLAINER_SHOWN + setMode('shielded') on dismiss). Once the
      // user has seen the explainer, toggle mode directly with no detour.
      if (target === 'shielded') {
        const seen = mmkvPublic.getBoolean(MMKV_KEYS.PRIVACY_EXPLAINER_SHOWN) === true;
        if (!seen && onFirstShieldedToggle) {
          onFirstShieldedToggle();
          return;
        }
      }
      setMode(target);
    },
    [mode, setMode, onFirstShieldedToggle],
  );

  // Display list: ALWAYS show SOL (native) + NOC even with 0 balance so the
  // dashboard isn't empty for a fresh wallet. Additional SPL tokens (USDC,
  // BONK, etc.) come from the dynamic on-chain `tokens` array. Backed wallets
  // (Phantom, Solflare, Trust) follow the same pattern — primary native + the
  // wallet's own token always pinned.
  const displayTokens = useMemo(() => {
    const NATIVE_SOL = 'native';
    const hasSol = tokens.some(t => t.mint === NATIVE_SOL || t.symbol === 'SOL');
    const hasNoc = tokens.some(t => t.mint === NOC_MINT);

    const defaults: typeof tokens = [];
    if (!hasSol) {
      defaults.push({
        mint: NATIVE_SOL,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        trust: 'core',
      });
    }
    if (!hasNoc) {
      defaults.push({
        mint: NOC_MINT,
        symbol: 'NOC',
        name: 'Noctura',
        decimals: 9,
        trust: 'core',
      });
    }
    return tokenManager.sortTokens([...defaults, ...tokens]);
  }, [tokens]);

  const usd = formatUsd(totalUsdValue);
  const avatarInitial = getAddressInitial(publicKey);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className="flex-1 bg-bg-base"
      testID="dashboard-screen">
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <FlatList
        data={displayTokens}
        keyExtractor={item => item.mint}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
          />
        }
        contentContainerStyle={{paddingBottom: 24}}
        ListHeaderComponent={
          <DashboardHeader
            mode={mode}
            avatarInitial={avatarInitial}
            usd={usd}
            solBalance={solBalance}
            nocBalance={nocBalance}
            hidden={hideBalances}
            onToggleBalance={handleToggleBalance}
            onModeToggle={handleModeToggle}
            onSend={onSend}
            onReceive={onReceive}
            onShield={onShield}
            onBuy={onBuy}
            onScan={onScan}
            onNotifications={onNotifications}
            onProfileTap={onProfileTap}
            isOffline={!isOnline}
          />
        }
        renderItem={({item: token}) => {
          const isNoc = token.mint === NOC_MINT;
          const isNativeSol = token.mint === 'native' || token.symbol === 'SOL';
          // Balance source: native SOL → solBalance, NOC → nocBalance fallback,
          // other SPL → tokenBalances[mint]
          let balance = '0';
          if (isNativeSol) balance = solBalance;
          else if (isNoc) balance = tokenBalances[NOC_MINT] ?? nocBalance;
          else balance = tokenBalances[token.mint] ?? '0';
          return (
            <TokenListRow
              symbol={token.symbol}
              name={token.name}
              balance={balance}
              hidden={hideBalances}
              mode={mode}
              isNoc={isNoc}
              onPress={onTokenTap ? () => onTokenTap(token.mint) : undefined}
            />
          );
        }}
        ListEmptyComponent={
          <View className="px-5 py-8">
            <Text variant="body-sm" className="text-fg-tertiary text-center">
              No tokens yet · pull to refresh
            </Text>
          </View>
        }
        ListFooterComponent={
          <DashboardFooter
            mode={mode}
            onPresale={onPresale}
            onSeeAllTokens={onSeeAllTokens}
          />
        }
      />
    </SafeAreaView>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  mode: 'transparent' | 'shielded';
  avatarInitial: string;
  usd: {whole: string; cents: string};
  solBalance: string;
  nocBalance: string;
  hidden: boolean;
  onToggleBalance: () => void;
  onModeToggle: (target: 'transparent' | 'shielded') => void;
  onSend?: () => void;
  onReceive?: () => void;
  onShield?: () => void;
  onBuy?: () => void;
  onScan?: () => void;
  onNotifications?: () => void;
  onProfileTap?: () => void;
  isOffline: boolean;
}

function DashboardHeader({
  mode,
  avatarInitial,
  usd,
  solBalance,
  nocBalance,
  hidden,
  onToggleBalance,
  onModeToggle,
  onSend,
  onReceive,
  onShield,
  onBuy,
  onScan,
  onNotifications,
  onProfileTap,
  isOffline,
}: DashboardHeaderProps) {
  const isShielded = mode === 'shielded';

  return (
    <View>
      {/* Top row · avatar + bell + scan */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          onPress={onProfileTap}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          className="w-10 h-10 rounded-pill bg-bg-surface-2 items-center justify-center active:opacity-80">
          <Text
            variant="body-lg"
            className={cn(
              'font-geist-semibold',
              isShielded ? 'text-accent-shielded' : 'text-accent-transparent',
            )}>
            {avatarInitial}
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={onNotifications}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            className="w-10 h-10 rounded-pill items-center justify-center active:bg-bg-surface-2">
            <Bell size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
          <Pressable
            onPress={onScan}
            accessibilityRole="button"
            accessibilityLabel="Scan QR"
            className="w-10 h-10 rounded-pill items-center justify-center active:bg-bg-surface-2">
            <ScanLine size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
        </View>
      </View>

      {/* Mode toggle · segmented pill */}
      <View className="px-5 mb-4">
        <View className="flex-row bg-bg-surface-2 rounded-pill p-1">
          <ModeButton
            label="Transparent"
            isActive={!isShielded}
            mode="transparent"
            onPress={() => onModeToggle('transparent')}
          />
          <ModeButton
            label="Shielded"
            isActive={isShielded}
            mode="shielded"
            onPress={() => onModeToggle('shielded')}
            withShieldIcon
          />
        </View>
      </View>

      {/* Balance hero card */}
      <View className="px-5 mb-4">
        <View className="bg-bg-surface-1 rounded-lg p-5">
          {/* Label row */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              {isShielded ? (
                <ShieldCheck size={14} color="#5BE3C2" strokeWidth={1.75} />
              ) : null}
              <Text variant="overline">
                {isShielded ? 'Shielded · vault balance' : 'Total balance'}
              </Text>
            </View>
            <Pressable
              onPress={onToggleBalance}
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
              className={cn(
                'w-10 h-10 rounded-pill items-center justify-center',
                hidden
                  ? isShielded
                    ? 'bg-[rgba(91,227,194,0.16)]'
                    : 'bg-[rgba(176,132,252,0.16)]'
                  : 'active:bg-bg-surface-2',
              )}>
              {hidden ? (
                <EyeOff
                  size={20}
                  color={isShielded ? '#5BE3C2' : '#B084FC'}
                  strokeWidth={1.75}
                />
              ) : (
                <Eye size={20} color="#A8ACB5" strokeWidth={1.75} />
              )}
            </Pressable>
          </View>

          {/* Balance value */}
          {hidden ? (
            <View className="flex-row items-center gap-2 mb-2 h-[50px]">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <View
                  key={i}
                  className="w-3 h-3 rounded-pill bg-fg-secondary opacity-50"
                />
              ))}
            </View>
          ) : (
            <View className="flex-row items-baseline mb-2">
              <Text variant="balance-xl" numeral className="text-fg-primary">
                {usd.whole}
              </Text>
              <Text variant="body-lg" numeral className="text-fg-secondary ml-0.5">
                {usd.cents}
              </Text>
            </View>
          )}

          {/* Change / anonymity line */}
          {hidden ? (
            <Text variant="body-sm" className="text-fg-tertiary mb-3">
              Tap eye to reveal
            </Text>
          ) : isShielded ? (
            <View className="flex-row items-center gap-2 mb-3">
              <Shield size={14} color="#5BE3C2" strokeWidth={1.75} />
              <Text variant="body-sm" numeral className="text-accent-shielded">
                Anonymity set · 1,284
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2 mb-3">
              <TrendingUp size={14} color="#3FD68B" strokeWidth={2} />
              <Text variant="body-sm" numeral className="text-success">
                +2.34% · 24h
              </Text>
            </View>
          )}

          {/* Sub-balance · SOL + NOC */}
          <View className="flex-row items-center gap-3">
            <SubBalanceCell
              amount={hidden ? '••••' : formatTokenAmount(solBalance)}
              ticker="SOL"
              hidden={hidden}
            />
            <View className="w-1 h-1 rounded-pill bg-fg-tertiary" />
            <SubBalanceCell
              amount={hidden ? '••••' : formatTokenAmount(nocBalance)}
              ticker="NOC"
              hidden={hidden}
            />
          </View>
        </View>
      </View>

      {/* Offline indicator (subtle, doesn't break design) */}
      {isOffline ? (
        <View className="px-5 mb-3">
          <View className="flex-row items-center gap-2 p-3 rounded-md bg-bg-surface-2 border-l-2 border-l-warning">
            <Text variant="caption" className="text-fg-secondary">
              Offline · balances may be stale
            </Text>
          </View>
        </View>
      ) : null}

      {/* Quick actions */}
      <View className="px-5 mb-5">
        <View className="flex-row gap-3">
          <QuickAction
            Icon={Send}
            label="Send"
            onPress={onSend}
            mode={mode}
          />
          <QuickAction
            Icon={ArrowDownToLine}
            label="Receive"
            onPress={onReceive}
            mode={mode}
          />
          {isShielded ? (
            <QuickAction
              Icon={ShieldCheck}
              label="Shield"
              onPress={onShield}
              mode={mode}
            />
          ) : (
            <QuickAction
              Icon={ArrowLeftRight}
              label="Swap"
              onPress={onSend}
              mode={mode}
            />
          )}
          <QuickAction
            Icon={CreditCard}
            label="Buy"
            onPress={onBuy}
            mode={mode}
          />
        </View>
      </View>

      {/* Tokens section header */}
      <View className="flex-row items-center justify-between px-5 mb-2">
        <Text variant="overline">
          {isShielded ? 'Shielded assets' : 'Tokens'}
        </Text>
      </View>
    </View>
  );
}

// ── Mode toggle button ─────────────────────────────────────────────────────

interface ModeButtonProps {
  label: string;
  isActive: boolean;
  mode: 'transparent' | 'shielded';
  onPress: () => void;
  withShieldIcon?: boolean;
}

function ModeButton({label, isActive, mode, onPress, withShieldIcon}: ModeButtonProps) {
  const activeBg = mode === 'shielded' ? 'bg-accent-shielded' : 'bg-accent-transparent';
  const activeText = 'text-bg-base';
  const inactiveText = 'text-fg-secondary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{selected: isActive}}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-2 py-2 rounded-pill',
        isActive && activeBg,
      )}>
      {withShieldIcon ? (
        <Shield
          size={14}
          color={isActive ? '#0A0A0A' : '#A8ACB5'}
          strokeWidth={1.75}
        />
      ) : null}
      <Text
        variant="body-sm"
        className={cn(
          'font-geist-semibold',
          isActive ? activeText : inactiveText,
        )}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Sub-balance cell ───────────────────────────────────────────────────────

function SubBalanceCell({
  amount,
  ticker,
  hidden,
}: {
  amount: string;
  ticker: string;
  hidden: boolean;
}) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text
        variant="body-sm"
        numeral={!hidden}
        className={cn(
          'font-geist-semibold',
          hidden ? 'text-fg-secondary' : 'text-fg-primary',
        )}>
        {amount}
      </Text>
      <Text variant="body-sm" className="text-fg-tertiary">
        {ticker}
      </Text>
    </View>
  );
}

// ── Quick action button ────────────────────────────────────────────────────

interface QuickActionProps {
  Icon: typeof Send;
  label: string;
  onPress?: () => void;
  mode: 'transparent' | 'shielded';
}

function QuickAction({Icon, label, onPress, mode}: QuickActionProps) {
  const iconColor = mode === 'shielded' ? '#5BE3C2' : '#B084FC';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-1 items-center justify-center py-3 rounded-md bg-bg-surface-1 active:bg-bg-surface-2 gap-1.5">
      <View className="w-9 h-9 rounded-pill bg-bg-surface-2 items-center justify-center">
        <Icon size={18} color={iconColor} strokeWidth={1.75} />
      </View>
      <Text variant="caption" className="text-fg-secondary">
        {label}
      </Text>
    </Pressable>
  );
}

// ── Token list row ─────────────────────────────────────────────────────────

interface TokenListRowProps {
  symbol: string;
  name: string;
  balance: string;
  hidden: boolean;
  mode: 'transparent' | 'shielded';
  isNoc: boolean;
  onPress?: () => void;
}

function TokenListRow({
  symbol,
  name,
  balance,
  hidden,
  mode,
  isNoc,
  onPress,
}: TokenListRowProps) {
  const isShielded = mode === 'shielded';
  const formattedBalance = hidden ? '•••••• ' + symbol : `${formatTokenAmount(balance)} ${symbol}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center px-5 py-3 active:bg-bg-surface-1">
      <TokenLogo symbol={symbol} isNoc={isNoc} />
      <View className="flex-1 ml-3">
        <Text variant="body-lg" className="text-fg-primary">
          {name}
        </Text>
        <Text
          variant="body-sm"
          numeral={!hidden}
          className={hidden ? 'text-fg-tertiary' : 'text-fg-secondary'}>
          {formattedBalance}
          {isShielded ? ' · shielded' : ''}
        </Text>
      </View>
      <ChevronRight size={18} color="#6E727A" strokeWidth={1.75} />
    </Pressable>
  );
}

// ── Token logo · per-token brand badge ──────────────────────────────────────
// Known tokens get brand colors + white text. Unknown SPL tokens fall back to
// the neutral surface-2 chip with first letter.
// (NOC keeps accent-tint until user supplies a real PNG/SVG asset.)

interface TokenLogoProps {
  symbol: string;
  isNoc: boolean;
}

function TokenLogo({symbol, isNoc}: TokenLogoProps) {
  if (symbol === 'SOL') {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={SOLANA_LOGO}
          style={{width: 22, height: 22}}
          resizeMode="contain"
          accessibilityLabel="Solana logo"
        />
      </View>
    );
  }
  if (isNoc) {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={NOC_LOGO}
          style={{width: 28, height: 28}}
          resizeMode="contain"
          accessibilityLabel="Noctura logo"
        />
      </View>
    );
  }
  // USDC, BONK, and other SPL tokens — use the first letter
  return (
    <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2">
      <Text
        variant="body-sm"
        numberOfLines={1}
        className="font-geist-semibold text-fg-primary">
        {symbol.charAt(0)}
      </Text>
    </View>
  );
}

// ── Footer (presale or privacy banner) ─────────────────────────────────────

interface DashboardFooterProps {
  mode: 'transparent' | 'shielded';
  onPresale?: () => void;
  onSeeAllTokens?: () => void;
}

function DashboardFooter({mode, onPresale, onSeeAllTokens}: DashboardFooterProps) {
  if (mode === 'shielded') {
    return (
      <View className="px-5 mt-4">
        <View className="flex-row items-center gap-3 p-4 rounded-lg bg-[rgba(91,227,194,0.08)] border border-[rgba(91,227,194,0.32)]">
          <View className="w-9 h-9 rounded-pill bg-[rgba(91,227,194,0.16)] items-center justify-center">
            <ShieldCheck size={20} color="#5BE3C2" strokeWidth={1.75} />
          </View>
          <View className="flex-1">
            <Text variant="body-lg" className="text-fg-primary">
              Privacy is on
            </Text>
            <Text variant="body-sm" className="text-fg-secondary">
              Sends from this view use ZK proofs
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="px-5 mt-8">
      {onSeeAllTokens ? (
        <Pressable
          onPress={onSeeAllTokens}
          className="py-3 items-center active:opacity-70 mb-2">
          <Text variant="body-sm" className="text-accent-transparent">
            See all tokens
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPresale}
        disabled={!onPresale}
        accessibilityRole="button"
        accessibilityLabel="NOC Presale"
        className="flex-row items-center gap-3 p-4 rounded-lg bg-bg-surface-1 border border-bg-surface-3 active:bg-bg-surface-2">
        <View className="w-9 h-9 rounded-pill bg-accent-transparent-tint items-center justify-center">
          <Rocket size={20} color="#B084FC" strokeWidth={1.75} />
        </View>
        <View className="flex-1">
          <Text variant="body-lg" className="text-fg-primary">
            NOC Presale · Stage 1
          </Text>
          <Text variant="body-sm" numeral className="text-fg-secondary">
            $0.1501 · 0% to next stage
          </Text>
        </View>
        <ChevronRight size={18} color="#A8ACB5" strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}
