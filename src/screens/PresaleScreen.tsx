import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text as RNText,
  TouchableOpacity,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ArrowLeft} from 'lucide-react-native';
import {Text, Button} from '../components/ui';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {useWalletStore} from '../store/zustand/walletStore';
import {useResolvedPrices} from '../hooks/useResolvedPrices';
import {
  estimateNocForSol,
  estimateNocForUsd,
  MIN_PURCHASE_USD,
  MAX_PURCHASE_USD,
} from '../modules/presale/presaleBuyModule';
import {USDC_MINT, USDT_MINT} from '../modules/tokens/coreTokens';
import {PRESALE_STAGE_PRICES} from '../constants/presale';
import {presaleAllocationDisplay} from '../modules/presale/presaleAllocation';
import {
  stageProgressDisplay,
  stageSecondRow,
} from '../modules/presale/stageProgress';
import {useJurisdiction} from '../hooks/useJurisdiction';
import {isPresaleBlocked} from '../modules/geoFence/geoFenceModule';
import type {DashboardStackParamList} from '../types/navigation';

interface PresaleScreenProps {
  onSkip: () => void;
  onComplete: () => void;
  isOnboarding?: boolean;
}

// Headroom (SOL) reserved for the network fee so the buy can't drain the wallet
// below what's needed to pay for its own transaction.
export const FEE_HEADROOM_SOL = 0.001;

/**
 * Pure gating logic for the [Buy NOC] button — extracted so it can be unit
 * tested without rendering the screen (which pulls in Zustand + price hooks +
 * navigation). Token-aware: a positive amount, the $10 min / $50k max (USD;
 * stablecoins are 1:1), and enough balance (+ SOL for the network fee).
 */
export function canBuy({
  paymentToken,
  amount,
  solUsd,
  solBalance,
  tokenBalance,
}: {
  paymentToken: 'SOL' | 'USDC' | 'USDT';
  amount: string;
  solUsd: number;
  solBalance: number;
  tokenBalance: number; // display units of the selected stablecoin (ignored for SOL)
}): {enabled: boolean; reason: string | null} {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {enabled: false, reason: null};
  }
  // Stablecoins are 1:1 USD; SOL converts via the live price.
  const usdValue = paymentToken === 'SOL' ? amt * solUsd : amt;
  if (usdValue < MIN_PURCHASE_USD) {
    return {enabled: false, reason: `Minimum $${MIN_PURCHASE_USD}`};
  }
  if (usdValue > MAX_PURCHASE_USD) {
    return {enabled: false, reason: `Maximum $${MAX_PURCHASE_USD.toLocaleString('en-US')} per transaction`};
  }
  if (paymentToken === 'SOL') {
    if (amt + FEE_HEADROOM_SOL > solBalance) {
      return {enabled: false, reason: 'Insufficient SOL balance'};
    }
  } else {
    if (amt > tokenBalance) {
      return {enabled: false, reason: `Insufficient ${paymentToken} balance`};
    }
    if (solBalance < FEE_HEADROOM_SOL) {
      return {enabled: false, reason: 'Need a little SOL for the network fee'};
    }
  }
  return {enabled: true, reason: null};
}

// Group integers with thousands separators while preserving up to 2 decimals.
function formatNoc(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── State A: Presale Active (#23 active) ──────────────────────────────────

export function PresaleActive({
  onSkip,
  isOnboarding,
  currentStage,
}: {
  onSkip: () => void;
  onComplete: () => void;
  isOnboarding: boolean;
  currentStage: number | null;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();
  const stage = currentStage ?? 1;

  // Jurisdiction gate (OFAC-only): `block` swaps the buy CTA for a route into
  // #50; `warn` shows a discreet caption but leaves the buy enabled.
  const {result: jur} = useJurisdiction();
  const geoBlocked = jur ? isPresaleBlocked(jur) : false;
  const onRegionInfo = useCallback(() => {
    navigation.navigate('GeoBlocked', {
      countryCode: jur?.countryCode,
      presaleBlocked: geoBlocked,
    });
  }, [navigation, jur?.countryCode, geoBlocked]);

  const pricePerNoc = usePresaleStore(s => s.pricePerNoc);
  const soldInStage = usePresaleStore(s => s.soldInStage);
  const stageCapacity = usePresaleStore(s => s.stageCapacity);
  const tokensPurchased = usePresaleStore(s => s.tokensPurchased);
  const referralBonusTokens = usePresaleStore(s => s.referralBonusTokens);
  const allocation = presaleAllocationDisplay({tokensPurchased, referralBonusTokens});
  const progress = stageProgressDisplay({soldInStage, stageCapacity, pricePerNoc});
  const secondRow = stageSecondRow({currentStage, soldInStage, stageCapacity});
  const stagePriceUsd =
    pricePerNoc != null && Number(pricePerNoc) > 0
      ? Number(pricePerNoc)
      : PRESALE_STAGE_PRICES[0];

  const {prices} = useResolvedPrices();
  const solUsd = prices.native?.usd ?? 0;

  // solBalance is stored as a string in lamports.
  const solBalanceLamports = useWalletStore(s => s.solBalance);
  const solBalance = Number(solBalanceLamports) / 1e9;

  const [paymentToken, setPaymentToken] = useState<'SOL' | 'USDC' | 'USDT'>(
    'SOL',
  );
  const [amount, setAmount] = useState('');

  // tokenBalances are stored as base-unit strings keyed by mint (verified
  // against TokenDetailScreen, which renders them via `/ 10 ** decimals`).
  // USDC/USDT are 6 dp.
  const tokenBalances = useWalletStore(s => s.tokenBalances);
  const stableMint =
    paymentToken === 'USDC'
      ? USDC_MINT
      : paymentToken === 'USDT'
        ? USDT_MINT
        : null;
  const tokenBalance = stableMint
    ? Number(tokenBalances[stableMint] ?? '0') / 1e6
    : 0;

  const onChangeToken = useCallback((next: 'SOL' | 'USDC' | 'USDT') => {
    setPaymentToken(next);
    setAmount('');
  }, []);

  const amountNum = Number(amount) || 0;
  const usdValue = paymentToken === 'SOL' ? amountNum * solUsd : amountNum;
  const nocEstimate =
    paymentToken === 'SOL'
      ? estimateNocForSol(amountNum, solUsd, stagePriceUsd)
      : estimateNocForUsd(amountNum, stagePriceUsd);

  const gate = useMemo(
    () => canBuy({paymentToken, amount, solUsd, solBalance, tokenBalance}),
    [paymentToken, amount, solUsd, solBalance, tokenBalance],
  );

  const onChangeAmount = useCallback((raw: string) => {
    // decimal-pad still allows commas on some locales; normalize + restrict to
    // one decimal point and digits only.
    const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setAmount(normalized);
  }, []);

  const onMax = useCallback(() => {
    if (paymentToken === 'SOL') {
      const max = Math.max(0, solBalance - FEE_HEADROOM_SOL);
      // Trim trailing zeros; keep up to 9 dp (lamport precision).
      setAmount(max > 0 ? String(Number(max.toFixed(9))) : '0');
    } else {
      // Stablecoin fee is paid in SOL, so no headroom is reserved here.
      setAmount(tokenBalance > 0 ? String(tokenBalance) : '0');
    }
  }, [paymentToken, solBalance, tokenBalance]);

  const onBuy = useCallback(() => {
    if (!gate.enabled) {
      return;
    }
    const amountBaseUnits =
      paymentToken === 'SOL'
        ? BigInt(Math.round(amountNum * 1e9))
        : BigInt(Math.round(amountNum * 1e6));
    navigation.navigate('PresaleBuyConfirm', {
      paymentToken,
      amountBaseUnits: amountBaseUnits.toString(),
    });
  }, [gate.enabled, paymentToken, amountNum, navigation]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        {!isOnboarding && (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-12 h-12 items-center justify-center -ml-2">
            <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
        )}
        <Text variant="h3" className="ml-1 flex-1">
          NOC presale
        </Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Stage card */}
          <View className="rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-5 mb-4">
            <Text variant="overline" className="text-accent-transparent mb-3">
              Stage {stage} of 10 · live
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text variant="balance-lg" numeral>
                ${stagePriceUsd}
              </Text>
              <Text variant="body-lg" className="text-fg-secondary">
                / NOC
              </Text>
            </View>
            {/* Progress bar — filled by NOC sold-in-stage / stage capacity */}
            <View className="h-2 rounded-pill bg-bg-surface-3 overflow-hidden mt-4">
              <View
                className="h-full bg-accent-transparent rounded-pill"
                style={{width: `${progress.show ? progress.percent : 0}%`}}
              />
            </View>
            {/* Meta row — USD raised / stage cap (matches #23 design) */}
            {progress.show ? (
              <View className="flex-row items-baseline justify-between mt-3">
                <Text variant="caption" className="text-fg-tertiary">
                  <Text variant="caption" numeral className="text-fg-secondary">
                    {progress.raisedText}
                  </Text>{' '}
                  raised
                </Text>
                <Text variant="caption" className="text-fg-tertiary">
                  <Text variant="caption" numeral className="text-fg-secondary">
                    {progress.capText}
                  </Text>{' '}
                  stage cap
                </Text>
              </View>
            ) : null}
            {/* Second meta row — next-stage price / NOC remaining in stage.
                Replaces the design's fictional "Ends in N days" (no stage end
                date exists — the presale is sold-out-based). */}
            {progress.show && secondRow.show ? (
              <View className="flex-row items-baseline justify-between mt-1">
                <Text variant="caption" className="text-fg-tertiary">
                  {secondRow.isFinalStage ? (
                    'Final stage'
                  ) : (
                    <>
                      Next stage{' '}
                      <Text variant="caption" numeral className="text-fg-secondary">
                        {secondRow.nextPriceText}
                      </Text>{' '}
                      <Text
                        variant="caption"
                        numeral
                        className="text-accent-transparent">
                        {secondRow.nextPctText}
                      </Text>
                    </>
                  )}
                </Text>
                <Text variant="caption" className="text-fg-tertiary">
                  <Text variant="caption" numeral className="text-fg-secondary">
                    {secondRow.nocLeftText}
                  </Text>{' '}
                  NOC left
                </Text>
              </View>
            ) : null}
          </View>

          {/* Payment token selector */}
          <View className="flex-row items-center gap-2 mb-4">
            {(['SOL', 'USDC', 'USDT'] as const).map(t => {
              const active = paymentToken === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => onChangeToken(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`Pay with ${t}`}
                  accessibilityState={{selected: active}}
                  testID={`pay-chip-${t}`}
                  style={{minHeight: 44, justifyContent: 'center', alignItems: 'center'}}
                  className={
                    active
                      ? 'flex-1 px-4 rounded-pill bg-accent-transparent-tint'
                      : 'flex-1 px-4 rounded-pill'
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

          {/* Input card */}
          <View className="rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-5 mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text variant="overline">YOU PAY</Text>
              <Text variant="caption">
                Available{' '}
                <Text variant="caption" numeral className="text-fg-secondary">
                  {(paymentToken === 'SOL'
                    ? solBalance
                    : tokenBalance
                  ).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 4,
                  })}
                </Text>{' '}
                {paymentToken}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TextInput
                value={amount}
                onChangeText={onChangeAmount}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor="#5B5F66"
                accessibilityLabel={`${paymentToken} amount`}
                testID="presale-sol-input"
                className="flex-1 text-balance-lg text-fg-primary font-geist p-0"
              />
              <Text variant="body-lg" className="text-fg-secondary">
                {paymentToken}
              </Text>
              <Pressable
                onPress={onMax}
                accessibilityRole="button"
                accessibilityLabel="Use max balance"
                className="px-3 h-8 rounded-pill bg-bg-surface-3 items-center justify-center">
                <Text variant="caption" className="text-fg-primary font-semibold">
                  MAX
                </Text>
              </Pressable>
            </View>

            <View className="h-px bg-bg-surface-3 my-4" />

            <View className="flex-row items-center justify-between mb-2">
              <Text variant="overline">YOU RECEIVE (EST.)</Text>
              <Text variant="caption">
                @{' '}
                <Text variant="caption" numeral className="text-fg-secondary">
                  ${stagePriceUsd}
                </Text>
                {paymentToken === 'SOL' && solUsd > 0
                  ? ` · 1 SOL = $${formatUsd(solUsd)}`
                  : ''}
              </Text>
            </View>
            <View className="flex-row items-baseline gap-2">
              <Text variant="balance-md" numeral>
                ≈ {formatNoc(nocEstimate)}
              </Text>
              <Text variant="body-lg" className="text-accent-transparent">
                NOC
              </Text>
            </View>
            {usdValue > 0 && (
              <Text variant="caption" className="mt-1">
                ≈ ${formatUsd(usdValue)}
              </Text>
            )}
          </View>

          {allocation.show ? (
            <View className="rounded-lg bg-bg-surface-2 border-l-2 border-l-info p-4 mb-4">
              <Text variant="overline" className="text-fg-secondary mb-1">
                YOUR PRESALE ALLOCATION
              </Text>
              <View className="flex-row items-baseline gap-2">
                <Text variant="body-lg" numeral className="text-fg-primary">
                  {allocation.nocText}
                </Text>
                <Text variant="body-sm" className="text-fg-secondary">
                  NOC
                </Text>
              </View>
              <Text variant="caption" className="text-fg-tertiary mt-1">
                Claimable after TGE
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onRegionInfo}
            accessibilityRole="button"
            className="self-center py-2">
            <Text variant="body-sm" className="text-fg-secondary">
              Not available in your region?
            </Text>
          </Pressable>
        </ScrollView>

        {/* Sticky bottom bar */}
        <View className="px-5 pt-3 pb-4 border-t border-bg-surface-3 bg-bg-base">
          {!geoBlocked && jur?.action === 'warn' && (
            <Text
              variant="caption"
              className="text-center mb-2 text-fg-secondary">
              Limited availability in your region — purchases still settle
              on-chain.
            </Text>
          )}
          {geoBlocked ? (
            <Button
              variant="primary"
              onPress={onRegionInfo}
              testID="presale-buy-button"
              label="Not available in your region"
            />
          ) : (
            <Button
              variant="primary"
              disabled={!gate.enabled}
              onPress={onBuy}
              testID="presale-buy-button"
              label={
                nocEstimate > 0 ? `Buy ${formatNoc(nocEstimate)} NOC` : 'Buy NOC'
              }
            />
          )}
          {!geoBlocked && gate.reason != null && (
            <Text variant="caption" className="text-center mt-2 text-fg-secondary">
              {gate.reason}
            </Text>
          )}
          {isOnboarding && (
            <TouchableOpacity
              className="items-center py-3 mt-1"
              onPress={onSkip}>
              <Text variant="body" className="text-fg-secondary">
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── State B: Post-TGE Claim ───────────────────────────────────────────────

function PresaleClaim({
  onComplete,
  tokensPurchased,
  referralBonusTokens,
}: {
  onComplete: () => void;
  tokensPurchased: string;
  referralBonusTokens: string;
}) {
  const totalRaw = BigInt(tokensPurchased) + BigInt(referralBonusTokens);
  const totalDisplay = totalRaw.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (
    <View style={styles.container}>
      <RNText style={styles.title}>Claim Your NOC Tokens</RNText>

      <View style={styles.allocationCard}>
        <RNText style={styles.allocationLabel}>Your allocation</RNText>
        <RNText style={styles.allocationValue}>{totalDisplay} NOC</RNText>
        {BigInt(referralBonusTokens) > 0n && (
          <RNText style={styles.allocationBonus}>
            Includes {BigInt(referralBonusTokens).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} referral bonus
          </RNText>
        )}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onComplete}>
        <RNText style={styles.primaryButtonText}>Claim NOC</RNText>
      </TouchableOpacity>
    </View>
  );
}

// ─── State C: Fully Claimed ────────────────────────────────────────────────

function PresaleClaimed({onSkip, onComplete}: {onSkip: () => void; onComplete: () => void}) {
  return (
    <View style={styles.container}>
      <View style={styles.claimedBadge}>
        <RNText style={styles.claimedBadgeText}>All Claimed ✓</RNText>
      </View>

      <RNText style={styles.claimedTitle}>Your NOC tokens are in your wallet</RNText>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={styles.quickActionButton} onPress={() => Alert.alert('Coming Soon', 'Staking will be available after on-chain program integration.')}>
          <RNText style={styles.quickActionText}>Stake</RNText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton} onPress={() => Alert.alert('Coming Soon', 'Send will be available from the Dashboard.')}>
          <RNText style={styles.quickActionText}>Send</RNText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickActionButton, styles.quickActionButtonAccent]}
          onPress={onComplete}>
          <RNText style={[styles.quickActionText, styles.quickActionTextAccent]}>Dashboard</RNText>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.ghostButton} onPress={onSkip}>
        <RNText style={styles.ghostButtonText}>Close</RNText>
      </TouchableOpacity>
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────

export function PresaleScreen({onSkip, onComplete, isOnboarding = false}: PresaleScreenProps) {
  const {tgeStatus, currentStage, tokensPurchased, referralBonusTokens} = usePresaleStore();

  if (tgeStatus === 'claimed') {
    return <PresaleClaimed onSkip={onSkip} onComplete={onComplete} />;
  }

  if (tgeStatus === 'claimable') {
    return (
      <PresaleClaim
        onComplete={onComplete}
        tokensPurchased={tokensPurchased}
        referralBonusTokens={referralBonusTokens}
      />
    );
  }

  // Default: pre_tge (State A)
  return (
    <PresaleActive
      onSkip={onSkip}
      onComplete={onComplete}
      isOnboarding={isOnboarding}
      currentStage={currentStage}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },

  // Stage B
  allocationCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  allocationLabel: {
    fontSize: 12,
    color: '#9999B3',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  allocationValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  allocationBonus: {
    fontSize: 12,
    color: '#22C55E',
  },

  // Stage C
  claimedBadge: {
    alignSelf: 'center',
    backgroundColor: '#1A4731',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 20,
  },
  claimedBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22C55E',
  },
  claimedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 36,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E2E44',
  },
  quickActionButtonAccent: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickActionTextAccent: {
    color: '#FFFFFF',
  },

  // Shared buttons
  primaryButton: {
    backgroundColor: '#6C47FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ghostButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: '#9999B3',
    fontSize: 15,
    fontWeight: '500',
  },
});
