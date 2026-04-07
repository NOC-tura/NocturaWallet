import React, {useState, useCallback} from 'react';
import {View, ScrollView, RefreshControl, StatusBar, Text, StyleSheet} from 'react-native';
import {WalletChip} from '../../components/WalletChip';
import {ModeToggle} from '../../components/ModeToggle';
import {BackupReminderBanner} from '../../components/BackupReminderBanner';
import {OfflineBanner} from '../../components/OfflineBanner';
import {AppUpdateBanner} from '../../components/AppUpdateBanner';
import {BalanceCard} from '../../components/BalanceCard';
import {QuickActions} from '../../components/QuickActions';
import {TokenRow} from '../../components/TokenRow';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {useSettings} from '../../store/zustand/useSettings';
import {useNetworkStatus} from '../../hooks/useNetworkStatus';
import {useDashboardBanners} from '../../hooks/useDashboardBanners';
import {forceSync} from '../../modules/backgroundSync/backgroundSyncModule';
import {TokenManager} from '../../modules/tokens/tokenModule';
import {NOC_MINT} from '../../constants/programs';
import {getTierById, formatStakingAmount} from '../../modules/staking/stakingService';
import type {StakingPosition} from '../../modules/staking/types';

const tokenManager = new TokenManager();

interface DashboardScreenProps {
  onSend?: () => void;
  onReceive?: () => void;
  onStake?: () => void;
  onBackup?: () => void;
  onFirstShieldedToggle?: () => void;
  /** Active staking position (if any). Passed from Navigator or fetched upstream. */
  stakingPosition?: StakingPosition | null;
}

export function DashboardScreen({onSend, onReceive, onStake, onBackup, onFirstShieldedToggle, stakingPosition}: DashboardScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const {publicKey, solBalance, nocBalance, totalUsdValue, nocUsdPrice, tokens, tokenBalances} = useWalletStore();
  const {mode, setMode} = useShieldedStore();
  const {hideBalances} = useSettings();
  const {isOnline, lastOnlineAt} = useNetworkStatus();
  const {showBackupBanner, showOfflineBanner, showUpdateBanner, canDismissBackup, dismissBackup} = useDashboardBanners();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await forceSync();
    setRefreshing(false);
  }, []);

  const handleCopyAddress = useCallback(() => {
    if (publicKey) {
      // Clipboard.setString(publicKey); // Uncomment when @react-native-clipboard installed
    }
  }, [publicKey]);

  const sortedTokens = tokenManager.sortTokens(tokens);

  return (
    <View testID="dashboard-screen" style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C0C14" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6C47FF" />
        }>

        {/* 1. WalletChip */}
        <WalletChip address={publicKey ?? ''} onCopy={handleCopyAddress} />

        {/* 2. ModeToggle */}
        <ModeToggle
          mode={mode}
          onToggle={() => setMode(mode === 'transparent' ? 'shielded' : 'transparent')}
          onFirstShieldedToggle={onFirstShieldedToggle}
        />

        {/* 3-5. Conditional banners (priority: backup > offline > update) */}
        {showBackupBanner && (
          <BackupReminderBanner
            visible={true}
            onBackup={onBackup ?? (() => {})}
            onDismiss={dismissBackup}
            canDismiss={canDismissBackup}
          />
        )}
        {showOfflineBanner && (
          <OfflineBanner isOnline={false} lastSyncedAt={lastOnlineAt} />
        )}
        {showUpdateBanner && (
          <AppUpdateBanner visible={true} storeUrl="" onDismiss={() => {}} />
        )}

        {/* 6. BalanceCard */}
        <BalanceCard
          solBalance={solBalance}
          nocBalance={nocBalance}
          totalUsdValue={totalUsdValue}
          nocUsdPrice={nocUsdPrice}
          hidden={hideBalances}
          mode={mode}
        />

        {/* 7. QuickActions */}
        <QuickActions
          onSend={onSend ?? (() => {})}
          onReceive={onReceive ?? (() => {})}
          onStake={onStake ?? (() => {})}
          isOffline={!isOnline}
        />

        {/* 8. Tokens section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tokens</Text>
        </View>

        {sortedTokens.map(token => {
          const isNoc = token.mint === NOC_MINT;
          const tier = isNoc && stakingPosition ? getTierById(stakingPosition.tier) : undefined;
          return (
            <TokenRow
              key={token.mint}
              symbol={token.symbol}
              name={token.name}
              balance={tokenBalances[token.mint] ?? '0'}
              trust={token.trust}
              isPinned={token.mint === tokens[0]?.mint}
              hidden={hideBalances}
              stakedAmount={isNoc && stakingPosition ? formatStakingAmount(stakingPosition.stakedAmount) : undefined}
              stakingTierLabel={tier?.label}
              unlockAt={isNoc && stakingPosition ? stakingPosition.unlockAt : undefined}
            />
          );
        })}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0C0C14'},
  scroll: {flex: 1},
  scrollContent: {paddingBottom: 100}, // space for tab bar
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {fontSize: 16, fontWeight: '700', color: '#FFFFFF'},
});
