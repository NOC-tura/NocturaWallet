import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  Vibration,
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {
  Bell,
  History,
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
  TrendingDown,
} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useAccountList, useRefreshAccounts, useSelectAccount, useSelectedAccount} from '../../hooks/useSelectedAccount';
import {NO_PUBLIC_DATA, useAccountPublicData} from '../../hooks/useAccountPublicData';
import {ACCOUNTS_TITLE, HISTORY_A11Y, PUBLIC_LOADING, REFRESH_ACCOUNT_FAILED, REFRESH_FAILED_TITLE, PUBLIC_UNAVAILABLE, SPLIT_PRIVATE, SPLIT_PUBLIC, VALUE_UNKNOWN, avatarA11y, splitA11y} from '../../copy/accounts';
import {AccountsSheet} from '../../components/accounts/AccountsSheet';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {usePublicSettingsStore} from '../../store/zustand/publicSettingsStore';
import {useNetworkStatus} from '../../hooks/useNetworkStatus';
import {useAccentColor} from '../../hooks/useAccent';
import {forceSync} from '../../modules/backgroundSync/backgroundSyncModule';
import {TokenManager} from '../../modules/tokens/tokenModule';
import {NOC_MINT} from '../../constants/programs';
import {isShieldedEnabled} from '../../constants/features';
import {privateSide, publicSide, splitValue, type SplitValue} from '../../modules/accounts/valueLine';
import {CHAIN} from '../../constants/chain';
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {cn} from '../../utils/cn';
import {computePortfolio, type Holding} from '../../modules/prices/portfolio';
import {buildHoldings} from '../../modules/prices/holdings';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {usePresaleSync} from '../../hooks/usePresaleSync';
import {formatUsd, formatUsdString} from '../../utils/formatUsd';
import {TokenLogo} from '../../components/TokenLogo';
import {PresaleBanner} from '../../components/PresaleBanner';
import {mmkvSecure} from '../../store/mmkv/instances';
import {unlockSecureStorage} from '../../modules/session/secureStorageSession';
import {useA0Shielded} from '../../hooks/useA0Shielded';
import type {A0CheckAgain, A0ShieldedView} from '../../hooks/useA0Shielded';
import {CheckAgainLink} from '../../components/CheckAgainLink';
import {a0RefusalLoudText} from '../shielded/unshield/unshieldCopy';
import type {A0VerifyRefusal} from '../../modules/shielded/a0/landedVerifier';
import {readA0PoolNoteCount} from '../../modules/shielded/a0/poolSize';
import {A0_TOKEN, displayAmount} from '../../modules/shielded/a0/screenSupport';
import {getConnection} from '../../modules/solana/connection';
import {DetailsDisclosure} from '../../components/private';
import {
  MAKE_PRIVATE,
  MAKE_PUBLIC,
  MODE_PRIVATE,
  MODE_PUBLIC,
  PRIVATE_ASSETS,
  PRIVATE_BALANCE,
  PUBLIC_BALANCE,
  PRIVATE_CARD_BODY,
  PRIVATE_SUFFIX,
} from '../../copy/modes';


/**
 * #11 Dashboard — Phase B migration · mirror /home/user/Downloads/index.html §s11
 *
 * Sections:
 *   - Top row · avatar (the selected account's number) + history + bell + scan
 *   - Mode toggle · Public / Private segmented pill
 *   - Balance hero · overline, eye toggle, balance + cents, change line, sub-balance, and (only
 *     where private balances exist) the Public | Private split row at the card's bottom: each
 *     side's value, never summed, "—" unknown, "•••" hidden; a tap on the other column switches
 *     the mode (owner 2026-11-22: it replaced M1d D3's thin line under the toggle)
 *   - Quick actions · Send · Receive · Swap|Make private · Buy (4-button grid)
 *   - Tokens section · header + token rows
 *   - Banner · presale (Public) or the Private balance card (Private)
 *
 * Mode-aware:
 *   - Public: violet accents, "Public balance" eyebrow (the selected account's public figure, not a total), Swap action, presale banner
 *   - Private: mint accents, "Private balance" eyebrow, Make private action,
 *     Private balance card, "· private" tag on rows
 *   - Private, DEPARTURE (owner-approved 2026-11-20, UX-A 7): a "Make public" action (the eye of
 *     #16's Make public screen) right after Make private, opening #16 as Make public. The design's private
 *     dashboard has Send / Receive / Make private / Buy; it is shown only when `onMakePublic` is passed,
 *     which the Navigator does only in the build that registers the unshield route.
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
  onSend?: (shielded?: boolean) => void;
  onReceive?: () => void;
  onShield?: () => void;
  /** UX-A 7: #16 on the unshield side — passed only where the unshield route exists (shielded build) */
  onMakePublic?: () => void;
  onSwap?: () => void;
  onBuy?: () => void;
  onScan?: () => void;
  onNotifications?: () => void;
  onHistory?: () => void;
  onPresale?: () => void;
  onFirstShieldedToggle?: () => void;
  onTokenTap?: (mint: string) => void;
  onSeeAllTokens?: () => void;
}

const SOL_DECIMALS = 9;
const NOC_DECIMALS = 9;

function getAddressInitial(address?: string | null): string {
  if (!address || address.length === 0) return 'N';
  return address.charAt(0).toUpperCase();
}

export function DashboardScreen({
  onSend,
  onReceive,
  onShield,
  onMakePublic,
  onSwap,
  onBuy,
  onScan,
  onNotifications,
  onHistory,
  onPresale,
  onFirstShieldedToggle,
  onTokenTap,
  onSeeAllTokens,
}: DashboardScreenProps) {
  // M1d (spec §3.4, D1/D2, plan A6): walletStore.publicKey stays the MAIN account and forceSync keeps
  // writing its slot (every main-only screen reads it); Public mode shows the SELECTED account's data.
  const {publicKey} = useWalletStore();
  const selected = useSelectedAccount();
  const refreshAccountList = useRefreshAccounts();
  const {data: publicData, refetch: refetchPublic} = useAccountPublicData(selected);
  const publicReady = publicData.status === 'ready';
  const {solBalance, nocBalance, tokens, tokenBalances} = publicData.status === 'ready' ? publicData : NO_PUBLIC_DATA;

  const {prices, havePrices} = useResolvedPrices();
  const {isPaused: presalePaused} = usePresaleSync();

  const holdings: Holding[] = useMemo(
    () => buildHoldings({solBalance, nocBalance, tokenBalances, tokens}),
    [solBalance, nocBalance, tokenBalances, tokens],
  );

  const portfolio = useMemo(() => computePortfolio(holdings, prices), [holdings, prices]);

  const {mode, setMode} = useShieldedStore();
  const hideBalances = usePublicSettingsStore(s => s.hideBalances);
  const setHideBalances = usePublicSettingsStore(s => s.setHideBalances);
  const {isOnline} = useNetworkStatus();
  const accentColor = useAccentColor();

  const [refreshing, setRefreshing] = useState(false);
  const syncingRef = useRef(false);

  // Single sync entry point so mount, AppState, polling, and pull-to-refresh
  // share one in-flight guard (avoids hammering the RPC if several triggers
  // fire close together — common with public devnet RPC rate limits).
  // M1d: the selected account's own data refreshes on every sync trigger too (a no-op for main)
  const refetchPublicRef = useRef(refetchPublic);
  refetchPublicRef.current = refetchPublic;
  const selectedIsMainRef = useRef(true);
  selectedIsMainRef.current = selected === null || selected.isMain;
  const runSync = useCallback(async (opts: {showErrors: boolean; refetchSelected?: boolean}) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      // M1d (review r1 m11): the selected account's own read runs alongside the main account's
      // forceSync and is awaited too, so pull-to-refresh ends after BOTH; a switch passes
      // refetchSelected: false (the new account's query starts by itself, the old one is not read again)
      const selectedRead = opts.refetchSelected === false ? Promise.resolve(true) : refetchPublicRef.current();
      const result = await forceSync();
      // M1d review M2: the alert speaks for the account SHOWN — main's sync result while main is selected,
      // the selected account's own read otherwise (main's failure is not what the figures on screen are)
      const mainShown = selectedIsMainRef.current;
      if (!mainShown && opts.showErrors && (await selectedRead) === false) {
        Alert.alert(REFRESH_FAILED_TITLE, REFRESH_ACCOUNT_FAILED);
      } else if (mainShown && !result.success && opts.showErrors) {
        Alert.alert(
          REFRESH_FAILED_TITLE,
          result.error
            ? `RPC error: ${result.error}\n\nIf the funds are visible on a block explorer but not here, the bundle may be pointing at the wrong cluster.`
            : 'Unknown error. Try again in a moment.',
        );
      }
      await selectedRead;
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSync({showErrors: true});
    } finally {
      setRefreshing(false);
    }
  }, [runSync]);

  // M1d (spec §4.1, D5): the avatar opens the Accounts sheet — never Profile (it stays on its tab)
  const accountList = useAccountList();
  const selectAccountScheme = useSelectAccount();
  const [sheetOpen, setSheetOpen] = useState(false);
  const openAccounts = useCallback(() => {
    refreshAccountList();
    setSheetOpen(true);
    // review r1 m7: unreadable because the encrypted store is closed -> open it (biometric), then re-read
    if (accountList?.unreadable && mmkvSecure() === null) {
      unlockSecureStorage()
        .then(() => refreshAccountList())
        .catch(() => undefined);
    }
  }, [refreshAccountList, accountList]);
  const handleSelectAccount = useCallback(
    (scheme: string) => {
      selectAccountScheme(scheme);
      setSheetOpen(false);
      // review r1 m11: the main account's sync only - the newly selected account's query starts by itself
      runSync({showErrors: false, refetchSelected: false});
    },
    [selectAccountScheme, runSync],
  );

  // M1d: re-read the account list on focus — an exit that landed since appears, a wiped selection falls back
  useFocusEffect(
    useCallback(() => {
      refreshAccountList();
    }, [refreshAccountList]),
  );

  // 1. Sync once on mount (cold start / login → see latest balance immediately).
  // 2. Sync whenever the app returns to foreground (user funded the wallet from
  //    a faucet / another wallet while ours was backgrounded).
  // 3. Light polling every 60 s while Dashboard is mounted — public devnet RPC
  //    is rate-limited, so longer than typical to stay under the threshold.
  useEffect(() => {
    if (!publicKey) return;
    runSync({showErrors: false});

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        runSync({showErrors: false});
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    // Skip polling when the app is backgrounded — saves battery + avoids
    // hitting the public devnet RPC rate limit while invisible. AppState
    // 'active' listener above already re-syncs on resume, so we don't miss
    // an update.
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        runSync({showErrors: false});
      }
    }, 60_000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [publicKey, runSync]);

  const handleToggleBalance = useCallback(() => {
    Vibration.vibrate(15);
    setHideBalances(!hideBalances);
  }, [hideBalances, setHideBalances]);

  const handleModeToggle = useCallback(
    (target: 'transparent' | 'shielded') => {
      // Shielded is gated out of this build (FEATURES.shielded === false).
      if (target === 'shielded' && !isShieldedEnabled()) return;
      if (target === mode) return;
      // First shielded toggle fires the explainer screen (#17), which sets
      // SHIELDED_EXPLAINED on Continue and navigates to ShieldUnshield (#16).
      // Once the user has seen it, the toggle flips mode directly.
      if (target === 'shielded') {
        const seen = mmkvPublic.getBoolean(MMKV_KEYS.SHIELDED_EXPLAINED) === true;
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

  // ── Shielded balance (the A0 note store) ────────────────────────────────────
  // Shown ONLY once the startup restore/reconcile finished (`a0StartupState()` 'ready', Task 4);
  // before that the view is a state (restoring / error / unsupported), never a 0. Re-read on focus
  // so the balance updates after returning from a shield.
  const {view: a0View, refresh: refreshA0, checkAgain: a0CheckAgain, refusal: a0Refusal} = useA0Shielded();
  useFocusEffect(useCallback(() => { refreshA0(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  // If the user views the shielded vault but the encrypted note store isn't open
  // yet (unlock-time init was skipped/failed → the vault would show empty even
  // though notes exist), open it on demand (biometric), then re-read. No-op when
  // already open or not in shielded mode.
  useEffect(() => {
    if (mode !== 'shielded' || mmkvSecure() !== null) return;
    let alive = true;
    unlockSecureStorage()
      .then(() => { if (alive) refreshA0(); })
      .catch(() => { /* leave the state as it is; the user can retry or re-unlock */ });
    return () => { alive = false; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Anonymity set: the A0 pool's note count (a number, spec I4) ────────────
  const [anon, setAnon] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (isShieldedEnabled()) {
      readA0PoolNoteCount(getConnection())
        .then(r => { if (alive) setAnon(r.status === 'ok' ? r.count : null); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, []));

  // M1d (spec §4.5 + 2026-11-22 addendum, D2/D4, plan A9): the split row — the selected account's public
  // value and the wallet's private balance, never summed, "—" for an unknown side, "•••" hidden; only
  // where private balances exist
  const split = isShieldedEnabled()
    ? splitValue(publicSide(publicData), privateSide(a0View), havePrices ? prices : null, hideBalances)
    : null;

  const isShielded = mode === 'shielded';
  const usd = formatUsd(portfolio.totalUsd);
  const change24h = publicReady ? portfolio.change24hPct : null; // number | null (transparent only); M1d: none before the data is known
  const avatarText = selected ? String(selected.number) : getAddressInitial(publicKey);
  const avatarLabel = selected ? avatarA11y(selected.label) : ACCOUNTS_TITLE;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className="flex-1 bg-bg-base"
      testID="dashboard-screen">
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <FlatList
        data={isShielded || !publicReady ? ([] as typeof displayTokens) : displayTokens}
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
            avatarText={avatarText}
            avatarLabel={avatarLabel}
            onAvatarPress={openAccounts}
            usd={usd}
            solBalance={solBalance}
            nocBalance={nocBalance}
            hidden={hideBalances}
            onToggleBalance={handleToggleBalance}
            onModeToggle={handleModeToggle}
            onSend={onSend}
            onReceive={onReceive}
            onShield={onShield}
            onMakePublic={onMakePublic}
            onSwap={onSwap}
            onBuy={onBuy}
            onScan={onScan}
            onNotifications={onNotifications}
            onHistory={onHistory}
            isOffline={!isOnline}
            change24hPct={change24h}
            havePrices={havePrices}
            publicReady={publicReady}
            split={split}
            anonymitySet={anon}
            shieldedView={a0View}
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
          const fiat = portfolio.perToken[token.mint];
          return (
            <TokenListRow
              symbol={token.symbol}
              name={token.name}
              balance={balance}
              decimals={token.decimals}
              hidden={hideBalances}
              mode={mode}
              isNoc={isNoc}
              onPress={onTokenTap ? () => onTokenTap(token.mint) : undefined}
              usdValue={fiat?.usd ?? null}
              change24h={fiat?.change24h ?? null}
              logoUri={token.logoUri}
            />
          );
        }}
        ListEmptyComponent={
          isShielded ? (
            <ShieldedAssetsSection view={a0View} hidden={hideBalances} checkAgain={a0CheckAgain} refusal={a0Refusal ?? null} />
          ) : (
            <View className="px-5 py-8">
              <Text variant="body-sm" className="text-fg-tertiary text-center" testID="dashboard-public-empty">
                {publicData.status === 'loading'
                  ? PUBLIC_LOADING
                  : publicData.status === 'error'
                    ? PUBLIC_UNAVAILABLE
                    : 'No tokens yet · pull to refresh'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <DashboardFooter
            mode={mode}
            onPresale={onPresale}
            onSeeAllTokens={onSeeAllTokens}
            presalePaused={presalePaused}
          />
        }
      />
      {sheetOpen && accountList && selected ? (
        <AccountsSheet
          visible
          list={accountList}
          selectedScheme={selected.scheme}
          hidden={hideBalances}
          onSelect={handleSelectAccount}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  mode: 'transparent' | 'shielded';
  /** M1d: the selected account's number ("4") */
  avatarText: string;
  /** M1d: "Account 4, switch account" */
  avatarLabel: string;
  onAvatarPress: () => void;
  usd: {whole: string; cents: string};
  solBalance: string;
  nocBalance: string;
  hidden: boolean;
  onToggleBalance: () => void;
  onModeToggle: (target: 'transparent' | 'shielded') => void;
  onSend?: (shielded?: boolean) => void;
  onReceive?: () => void;
  onShield?: () => void;
  onMakePublic?: () => void;
  onSwap?: () => void;
  onBuy?: () => void;
  onScan?: () => void;
  onNotifications?: () => void;
  onHistory?: () => void;
  isOffline: boolean;
  change24hPct: number | null;
  havePrices: boolean;
  /** M1d (Review Focus 4): the selected account's public data is known — every public figure waits for it */
  publicReady: boolean;
  /** M1d (spec §4.5, 2026-11-22 addendum): the split row's two columns, or null where the build has no private balances */
  split: SplitValue | null;
  /** Live on-chain anonymity set leaf count; null while loading or on RPC error. */
  anonymitySet: number | null;
  /** The A0 shielded balance view (shielded mode's hero). */
  shieldedView: A0ShieldedView;
}

function DashboardHeader({
  mode,
  avatarText,
  avatarLabel,
  onAvatarPress,
  usd,
  solBalance,
  nocBalance,
  hidden,
  onToggleBalance,
  onModeToggle,
  onSend,
  onReceive,
  onShield,
  onMakePublic,
  onSwap,
  onBuy,
  onScan,
  onNotifications,
  onHistory,
  isOffline,
  change24hPct,
  havePrices,
  publicReady,
  split,
  anonymitySet,
  shieldedView,
}: DashboardHeaderProps) {
  const isShielded = mode === 'shielded';

  return (
    <View>
      {/* Top row · avatar + bell + scan */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel={avatarLabel}
          testID="dashboard-avatar"
          className="w-10 h-10 rounded-pill bg-bg-surface-2 items-center justify-center active:opacity-80">
          <Text
            variant="body-lg"
            className={cn(
              'font-geist-semibold',
              isShielded ? 'text-accent-shielded' : 'text-accent-transparent',
            )}>
            {avatarText}
          </Text>
        </Pressable>
        {/* The test build's chain marker (not in the design): a devnet build never passes for the
           mainnet wallet. Never rendered on mainnet. */}
        {CHAIN.network === 'devnet' ? (
          <View
            testID="dashboard-chain-badge"
            accessibilityLabel={CHAIN.label}
            className="px-2 py-0.5 rounded-pill bg-[rgba(242,181,59,0.16)]">
            <Text variant="overline" className="text-warning">
              Devnet
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={onHistory}
            accessibilityRole="button"
            accessibilityLabel={HISTORY_A11Y}
            testID="dashboard-history"
            className="w-10 h-10 rounded-pill items-center justify-center active:bg-bg-surface-2">
            <History size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
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
            label={MODE_PUBLIC}
            isActive={!isShielded}
            mode="transparent"
            onPress={() => onModeToggle('transparent')}
          />
          <ModeButton
            label={MODE_PRIVATE}
            isActive={isShielded}
            mode="shielded"
            onPress={() => onModeToggle('shielded')}
            withShieldIcon
            comingSoon={!isShieldedEnabled()}
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
                {isShielded ? PRIVATE_BALANCE : PUBLIC_BALANCE}
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
          ) : isShielded ? (
            // The shielded balance in the pool's token — the A0 view's own state, never a 0
            // before the restore finished (no price exists for the devnet test token).
            <View className="flex-row items-baseline mb-2" testID="dashboard-shielded-balance">
              <Text variant={shieldedView.kind === 'ready' ? 'balance-xl' : 'body-lg'} numeral className="text-fg-primary">
                {shieldedHeroText(shieldedView)}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-baseline mb-2" testID="dashboard-public-balance">
              {havePrices && publicReady ? (
                <>
                  <Text variant="balance-xl" numeral className="text-fg-primary">
                    {usd.whole}
                  </Text>
                  <Text variant="body-lg" numeral className="text-fg-secondary ml-0.5">
                    {usd.cents}
                  </Text>
                </>
              ) : (
                <Text variant="balance-xl" className="text-fg-primary">—</Text>
              )}
            </View>
          )}

          {/* Change / anonymity line */}
          {hidden ? (
            <Text variant="body-sm" className="text-fg-tertiary mb-3">
              Tap eye to reveal
            </Text>
          ) : isShielded ? (
            anonymitySet != null ? (
              <DetailsDisclosure testID="dashboard-details">
                <View className="flex-row items-center gap-2 mb-3">
                  <Shield size={14} color="#5BE3C2" strokeWidth={1.75} />
                  <Text variant="body-sm" numeral className="text-accent-shielded">
                    {`Anonymity set · ${anonymitySet.toLocaleString()}`}
                  </Text>
                </View>
              </DetailsDisclosure>
            ) : null
          ) : (
            change24hPct == null ? null : (
              <View className="flex-row items-center gap-2 mb-3">
                {change24hPct >= 0 ? (
                  <TrendingUp size={14} color="#3FD68B" strokeWidth={2} />
                ) : (
                  <TrendingDown size={14} color="#F87171" strokeWidth={2} />
                )}
                <Text
                  variant="body-sm"
                  numeral
                  className={change24hPct >= 0 ? 'text-success' : 'text-danger'}>
                  {`${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}% · 24h`}
                </Text>
              </View>
            )
          )}

          {/* Sub-balance · SOL + NOC — transparent only. In shielded mode this
             would mirror the (unrelated) transparent SOL/NOC balances, which is
             misleading; the shielded vault shows its own per-token asset rows +
             anonymity line below instead. */}
          {isShielded ? null : (
            <View className="flex-row items-center gap-3">
              <SubBalanceCell
                amount={hidden ? '••••' : publicReady ? formatBalanceForDisplay(solBalance, SOL_DECIMALS) : VALUE_UNKNOWN}
                ticker="SOL"
                testID="dashboard-sub-sol"
                hidden={hidden}
              />
              <View className="w-1 h-1 rounded-pill bg-fg-tertiary" />
              <SubBalanceCell
                amount={hidden ? '••••' : publicReady ? formatBalanceForDisplay(nocBalance, NOC_DECIMALS) : VALUE_UNKNOWN}
                ticker="NOC"
                testID="dashboard-sub-noc"
                hidden={hidden}
              />
            </View>
          )}

          {/* M1d (2026-11-22 addendum): the Public | Private split, both modes, only where private balances exist */}
          {split !== null ? (
            <>
              <View className="h-px bg-bg-surface-3 my-4" />
              <View className="flex-row gap-4">
                <SplitColumn
                  label={SPLIT_PUBLIC}
                  lines={split.publicLines}
                  isActive={!isShielded}
                  dotClass="bg-accent-transparent"
                  onSelect={() => onModeToggle('transparent')}
                  testID="dashboard-split-public"
                />
                <SplitColumn
                  label={SPLIT_PRIVATE}
                  lines={split.privateLines}
                  isActive={isShielded}
                  dotClass="bg-accent-shielded"
                  onSelect={() => onModeToggle('shielded')}
                  testID="dashboard-split-private"
                />
              </View>
            </>
          ) : null}
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
          {/* No Send in shielded mode: the shielded transfer is hidden until its plan lands (spec §12). */}
          {isShielded ? null : (
            <QuickAction
              Icon={Send}
              label="Send"
              onPress={() => onSend?.(false)}
              mode={mode}
            />
          )}
          {/* No Receive in shielded mode: no valid shielded receive address exists until M2 (I9). */}
          {isShielded ? null : (
            <QuickAction
              Icon={ArrowDownToLine}
              label="Receive"
              onPress={() => onReceive?.()}
              mode={mode}
            />
          )}
          {isShielded ? (
            <QuickAction
              Icon={ShieldCheck}
              label={MAKE_PRIVATE}
              onPress={onShield}
              mode={mode}
            />
          ) : (
            <QuickAction
              Icon={ArrowLeftRight}
              label="Swap"
              onPress={onSwap}
              mode={mode}
            />
          )}
          {/* DEPARTURE (owner-approved, UX-A 7): "Make public" next to Make private — not in the design's
              shielded dashboard; offered only where the unshield route exists (onMakePublic). */}
          {isShielded && onMakePublic ? (
            <QuickAction
              Icon={Eye}
              label={MAKE_PUBLIC}
              onPress={onMakePublic}
              mode={mode}
            />
          ) : null}
          {/* Buy is the presale: offered only where presale exists (mainnet, S13). */}
          {onBuy ? (
            <QuickAction
              Icon={CreditCard}
              label="Buy"
              onPress={onBuy}
              mode={mode}
            />
          ) : null}
        </View>
      </View>

      {/* Tokens section header */}
      <View className="flex-row items-center justify-between px-5 mb-2">
        <Text variant="overline">
          {isShielded ? PRIVATE_ASSETS : 'Tokens'}
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
  /** Render as a disabled "· soon" teaser (feature gated out of this build). */
  comingSoon?: boolean;
}

export function ModeButton({label, isActive, mode, onPress, withShieldIcon, comingSoon}: ModeButtonProps) {
  const activeBg = mode === 'shielded' ? 'bg-accent-shielded' : 'bg-accent-transparent';
  const activeText = 'text-bg-base';
  const inactiveText = 'text-fg-secondary';
  return (
    <Pressable
      onPress={comingSoon ? undefined : onPress}
      disabled={comingSoon}
      accessibilityRole="tab"
      accessibilityState={{selected: isActive, disabled: !!comingSoon}}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-2 py-2 rounded-pill',
        isActive && activeBg,
        comingSoon && 'opacity-50',
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
        {comingSoon ? `${label} · soon` : label}
      </Text>
    </Pressable>
  );
}

// ── Split column (M1d, 2026-11-22 addendum) ────────────────────────────────

interface SplitColumnProps {
  label: string;
  /** Already formatted by `splitValue`: "•••" when hidden, "—" when unknown — one line each */
  lines: string[];
  isActive: boolean;
  /** The mode's accent: Public #B084FC, Private #5BE3C2 */
  dotClass: 'bg-accent-transparent' | 'bg-accent-shielded';
  /** Not named onPress: a test's press must reach the Pressable's own handler, never bubble to this prop */
  onSelect: () => void;
  testID: string;
}

function SplitColumn({label, lines, isActive, dotClass, onSelect, testID}: SplitColumnProps) {
  return (
    <Pressable
      // the active column is the mode already shown: a tap does nothing
      onPress={isActive ? undefined : onSelect}
      accessibilityRole="button"
      accessibilityState={{selected: isActive}}
      accessibilityLabel={splitA11y(label, lines.join(', '), isActive)}
      testID={testID}
      className="flex-1 active:opacity-80">
      <View className="flex-row items-center gap-2 mb-1">
        <View className={cn('w-[6px] h-[6px] rounded-pill', dotClass)} />
        <Text variant="overline" className={isActive ? 'text-fg-primary' : 'text-fg-tertiary'}>
          {label}
        </Text>
      </View>
      {lines.map((line, i) => (
        <Text
          key={i}
          variant="body-sm"
          numeral
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          className="text-fg-secondary"
          testID={`${testID}-line`}>
          {line}
        </Text>
      ))}
    </Pressable>
  );
}

// ── Sub-balance cell ───────────────────────────────────────────────────────

function SubBalanceCell({
  amount,
  ticker,
  hidden,
  testID,
}: {
  amount: string;
  ticker: string;
  hidden: boolean;
  testID?: string;
}) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text
        variant="body-sm"
        numeral={!hidden}
        testID={testID}
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
  decimals: number;
  hidden: boolean;
  mode: 'transparent' | 'shielded';
  isNoc: boolean;
  onPress?: () => void;
  usdValue: number | null;
  change24h: number | null;
  logoUri?: string;
}

function TokenListRow({
  symbol,
  name,
  balance,
  decimals,
  hidden,
  mode,
  isNoc,
  onPress,
  usdValue,
  change24h,
  logoUri,
}: TokenListRowProps) {
  const isShielded = mode === 'shielded';
  const formattedBalance = hidden
    ? '•••••• ' + symbol
    : `${formatBalanceForDisplay(balance, decimals)} ${symbol}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center px-5 py-3 active:bg-bg-surface-1">
      <TokenLogo symbol={symbol} isNoc={isNoc} logoUri={logoUri} />
      <View className="flex-1 ml-3">
        <Text variant="body-lg" className="text-fg-primary">
          {name}
        </Text>
        <Text
          variant="body-sm"
          numeral={!hidden}
          className={hidden ? 'text-fg-tertiary' : 'text-fg-secondary'}>
          {formattedBalance}
          {isShielded ? PRIVATE_SUFFIX : ''}
        </Text>
      </View>
      {!hidden && usdValue != null ? (
        <View className="items-end mr-2">
          <Text variant="body-lg" numeral className="text-fg-primary">
            {formatUsdString(usdValue)}
          </Text>
          {change24h == null ? (
            <Text variant="body-sm" className="text-fg-tertiary">
              —
            </Text>
          ) : (
            <Text
              variant="body-sm"
              numeral
              className={change24h >= 0 ? 'text-success' : 'text-danger'}>
              {`${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
            </Text>
          )}
        </View>
      ) : null}
      <ChevronRight size={18} color="#6E727A" strokeWidth={1.75} />
    </Pressable>
  );
}

// ── Shielded assets section ────────────────────────────────────────────────

function shieldedHeroText(view: A0ShieldedView): string {
  switch (view.kind) {
    case 'ready':
      return `${displayAmount(view.unspent, A0_TOKEN.decimals)} ${A0_TOKEN.symbol}`;
    case 'running':
      return 'Restoring from the chain…';
    case 'error':
      return `Not restored · ${view.code ?? 'error'}`;
    case 'idle':
      return 'Not loaded yet';
    case 'unsupported':
      return 'Not available on this device';
  }
}

interface ShieldedAssetsSectionProps {
  view: A0ShieldedView;
  hidden: boolean;
  checkAgain: A0CheckAgain;
  /** final review I-1: a verifier refusal of a landed unshield found this session — LOUD, by its code (undrawn) */
  refusal: A0VerifyRefusal | null;
}

function ShieldedAssetsSection({view, hidden, checkAgain, refusal}: ShieldedAssetsSectionProps) {
  const loud = refusal ? (
    <View className="mx-5 mt-3 rounded-md bg-[rgba(255,92,106,0.08)] border border-danger p-4" testID="dashboard-shielded-refusal">
      <Text variant="body-sm" className="text-danger font-geist-semibold">
        {a0RefusalLoudText(refusal)}
      </Text>
    </View>
  ) : null;
  return view.kind === 'ready' ? (
    <>
      {loud}
      <ShieldedAssetsBody view={view} hidden={hidden} checkAgain={checkAgain} />
      {view.pending === 0n && checkAgain.note ? (
        // re-review N-2: the last pending item was decided — the check's caption stays, without the link
        <Text variant="caption" className="text-fg-tertiary px-5 pb-3" testID="dashboard-check-caption">
          {checkAgain.note}
        </Text>
      ) : null}
    </>
  ) : (
    <ShieldedAssetsBody view={view} hidden={hidden} checkAgain={checkAgain} />
  );
}

function ShieldedAssetsBody({view, hidden, checkAgain}: Omit<ShieldedAssetsSectionProps, 'refusal'>) {
  if (view.kind !== 'ready') {
    const text =
      view.kind === 'running'
        ? 'Your private balance is being restored from the chain.'
        : view.kind === 'error'
          ? `Your private balance could not be restored (${view.code ?? 'error'}). Open Make private to retry.`
          : view.kind === 'idle'
            ? 'Your private balance is not loaded yet. Open Make private to load it.'
            : 'Your private balance needs the on-device prover, which this device does not have.';
    return (
      <View className="px-5 py-10 items-center" testID="shielded-assets-state">
        <Text variant="body-sm" className="text-fg-tertiary text-center">
          {text}
        </Text>
      </View>
    );
  }
  if (view.unspent === 0n && view.pending === 0n) {
    return (
      <View className="px-5 py-10 items-center">
        <Text variant="body-lg" className="text-fg-secondary text-center">
          Nothing private yet
        </Text>
        <Text variant="body-sm" className="text-fg-tertiary text-center mt-1">
          Tap Make private to move a token in
        </Text>
      </View>
    );
  }
  const amount = hidden
    ? `•••••• ${A0_TOKEN.symbol}`
    : `${displayAmount(view.unspent, A0_TOKEN.decimals)}${PRIVATE_SUFFIX}`;
  return (
    <View className="flex-row items-center px-5 py-3" testID="shielded-assets-row">
      <TokenLogo symbol={A0_TOKEN.symbol} isNoc={false} />
      <View className="flex-1 ml-3">
        <Text variant="body-lg" className="text-fg-primary">
          {A0_TOKEN.name}
        </Text>
        <Text variant="body-sm" numeral={!hidden} className={hidden ? 'text-fg-tertiary' : 'text-accent-shielded'}>
          {amount}
        </Text>
        {!hidden && view.pending > 0n ? (
          <Text variant="caption" numeral className="text-warning">
            {`${displayAmount(view.pending, A0_TOKEN.decimals)} pending · not confirmed yet`}
          </Text>
        ) : null}
        {view.pending > 0n ? (
          <View className="flex-row items-center mt-1">
            {checkAgain.note ? (
              <Text variant="caption" className="text-fg-tertiary flex-1">
                {checkAgain.note}
              </Text>
            ) : (
              <View className="flex-1" />
            )}
            <CheckAgainLink checkAgain={checkAgain} testID="dashboard-check-again" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Footer (presale or privacy banner) ─────────────────────────────────────

interface DashboardFooterProps {
  mode: 'transparent' | 'shielded';
  onPresale?: () => void;
  onSeeAllTokens?: () => void;
  presalePaused?: boolean;
}

function DashboardFooter({mode, onPresale, onSeeAllTokens, presalePaused}: DashboardFooterProps) {
  if (mode === 'shielded') {
    return (
      <View className="px-5 mt-4">
        <View className="flex-row items-center gap-3 p-4 rounded-lg bg-[rgba(91,227,194,0.08)] border border-[rgba(91,227,194,0.32)]">
          <View className="w-9 h-9 rounded-pill bg-[rgba(91,227,194,0.16)] items-center justify-center">
            <ShieldCheck size={20} color="#5BE3C2" strokeWidth={1.75} />
          </View>
          <View className="flex-1">
            <Text variant="body-lg" className="text-fg-primary">
              {PRIVATE_BALANCE}
            </Text>
            <Text variant="body-sm" className="text-fg-secondary">
              {PRIVATE_CARD_BODY}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="mt-8">
      {onSeeAllTokens ? (
        <Pressable
          onPress={onSeeAllTokens}
          className="py-3 items-center active:opacity-70 mb-2 px-5">
          <Text variant="body-sm" className="text-accent-transparent">
            See all tokens
          </Text>
        </Pressable>
      ) : null}
      {/* Live presale banner (compact .presale design); hidden when paused. */}
      {!presalePaused && onPresale ? (
        <PresaleBanner onPress={onPresale} />
      ) : null}
    </View>
  );
}
