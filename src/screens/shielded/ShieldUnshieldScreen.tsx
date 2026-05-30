import React, {useCallback, useMemo, useState} from 'react';
import {View, Pressable, TextInput, ScrollView, Image} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ShieldCheck, Eye, AlertTriangle, Shield} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Text} from '../../components/ui';
import {useWalletStore} from '../../store/zustand/walletStore';
import {cn} from '../../utils/cn';
import {parseTokenAmount} from '../../utils/parseTokenAmount';
import type {RootStackParamList} from '../../types/navigation';

const SOLANA_LOGO = require('../../assets/tokens/solana-sol-logo.png');

/**
 * #16 Shield / Unshield — Phase B migration · mirror /home/user/Downloads/index.html §s16
 *
 * Unified screen for moving SOL between transparent address and shielded vault.
 * Direction tabs at top switch between:
 *   - "Make private"  · transparent → vault   (deposit / shield)
 *   - "Make public"   · vault → transparent   (withdraw / unshield)
 *
 * Per design baseline, direction tabs do NOT push a new route — they flip the
 * mode of the amount + fee sub-region within the same screen. The parent
 * container stays `mode="shielded"` (mint accent on tabs + ZK fee glyph + meter
 * + sticky CTA), while the "Make public" amount card visually nests back to
 * transparent so the user sees the funds leaving the vault.
 *
 * 5 states implemented:
 *   1. Make private · idle (fees pending until amount entered)
 *   2. Make public · idle (nested transparent + warning banner)
 *   3. Make private · amount entered · fees loaded · privacy meter populated
 *   4. Insufficient balance (red border on amount card + helper)
 *   5. Make public · amount entered · fees loaded · withdraw warning
 *
 * Fees (mock values until ZK fee oracle lands):
 *   - Network fee:  ~0.00012 SOL
 *   - ZK proof fee: ~0.0021 SOL
 *
 * On Shield/Unshield CTA → navigation.navigate('ZkProofModal', {direction,
 * amount, recipient?}) — #16 → #18 directly. #17 (shielded-explainer) is
 * gated separately at the Dashboard's first Shielded toggle, NOT in this
 * CTA flow. #18 success destination is currently a placeholder Alert →
 * popToTop until #19 (tx-simulate) lands in a future PR.
 *
 * No FLAG_SECURE on this screen (no PIN entry); re-auth lifts at #20 → #10.
 */

interface ShieldUnshieldScreenProps {
  onBack: () => void;
  initialDirection?: Direction;
}

type Direction = 'private' | 'public';

const NETWORK_FEE_SOL = '0.00012';
const ZK_PROOF_FEE_SOL = '0.0021';
const TOTAL_FEE_SOL = '0.00222'; // Network + ZK; used in summary line
const MOCK_USD_PER_SOL = 238; // Placeholder until price oracle wired

function formatNumber(n: number, decimals = 4): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Plain ungrouped string for TextInput state — `parseFloat` stops at the
 * thousands separator, so values like "1,234.5" parse as 1 instead of 1234.5,
 * silently breaking validation + netReceived math. Use `formatNumber()` only
 * for display labels (Available balance, fiat estimate, summary line).
 */
function toInputString(n: number, decimals = 4): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  // Trim trailing zeros for cleaner UX, but keep at least one decimal if rounding
  return n.toFixed(decimals).replace(/\.?0+$/, '');
}

function parseAmount(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function ShieldUnshieldScreen({onBack, initialDirection}: ShieldUnshieldScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {solBalance, shieldedBalances} = useWalletStore();
  const [direction, setDirection] = useState<Direction>(initialDirection ?? 'private');
  const [amount, setAmount] = useState('');

  const transparentSol = useMemo(() => {
    try {
      return Number(BigInt(solBalance)) / 1_000_000_000;
    } catch {
      return 0;
    }
  }, [solBalance]);

  const vaultSol = useMemo(() => {
    const raw = shieldedBalances['native'] ?? shieldedBalances['SOL'] ?? '0';
    try {
      return Number(BigInt(raw)) / 1_000_000_000;
    } catch {
      return 0;
    }
  }, [shieldedBalances]);

  const sourceBalance = direction === 'private' ? transparentSol : vaultSol;
  const sourceLabel = direction === 'private' ? 'Available' : 'Vault balance';

  const parsed = parseAmount(amount);
  const hasAmount = amount.trim().length > 0 && parsed > 0;
  const insufficient = hasAmount && parsed > sourceBalance;
  const fiatEstimate = hasAmount ? parsed * MOCK_USD_PER_SOL : 0;
  const netReceived = hasAmount && !insufficient ? Math.max(0, parsed - parseFloat(TOTAL_FEE_SOL)) : 0;

  const handleMax = useCallback(() => {
    if (sourceBalance <= 0) return;
    // Use ungrouped numeric string — `formatNumber` adds thousands separators
    // which parseFloat then stops at, breaking downstream validation.
    setAmount(toInputString(Math.max(0, sourceBalance - parseFloat(TOTAL_FEE_SOL)), 4));
  }, [sourceBalance]);

  const handleSwitchDirection = useCallback((d: Direction) => {
    if (d === direction) return;
    setDirection(d);
    setAmount('');
  }, [direction]);

  const handleSubmit = useCallback(() => {
    if (insufficient || !hasAmount) return;
    const rawAmount = parseTokenAmount(amount, 9).toString();
    navigation.navigate('ZkProofModal', {
      direction,
      amount: rawAmount,
      recipient: undefined,
    });
  }, [insufficient, hasAmount, direction, amount, navigation]);

  const canSubmit = hasAmount && !insufficient;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <Text variant="h2" className="ml-1 flex-1">
          Shield / Unshield
        </Text>
        <View className="flex-row items-center gap-1 px-2 py-1 rounded-pill bg-bg-surface-2">
          <Image
            source={SOLANA_LOGO}
            style={{width: 16, height: 16}}
            resizeMode="contain"
          />
          <Text variant="caption" className="font-geist-semibold text-fg-primary">
            SOL
          </Text>
        </View>
      </View>

      {/* Direction tabs */}
      <View className="px-5 mb-4">
        <View className="flex-row bg-bg-surface-2 rounded-pill p-1">
          <DirTab
            label="Make private"
            Icon={ShieldCheck}
            active={direction === 'private'}
            onPress={() => handleSwitchDirection('private')}
          />
          <DirTab
            label="Make public"
            Icon={Eye}
            active={direction === 'public'}
            onPress={() => handleSwitchDirection('public')}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Amount card */}
        <View
          className={cn(
            'rounded-lg bg-bg-surface-1 border p-5 mb-4',
            insufficient ? 'border-danger' : 'border-bg-surface-3',
          )}>
          <View className="flex-row items-center justify-between mb-3">
            <Text variant="body-sm" className="text-fg-secondary">
              {sourceLabel}
            </Text>
            <Text variant="body-sm" numeral className="font-geist-semibold text-fg-primary">
              {formatNumber(sourceBalance, 4)} SOL
            </Text>
          </View>
          <View className="flex-row items-baseline justify-center gap-2 mb-3">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#6E727A"
              keyboardType="decimal-pad"
              accessibilityLabel="Amount"
              testID="shield-amount-input"
              className={cn(
                'font-geist text-balance-xl text-center min-w-[80px]',
                insufficient ? 'text-danger' : 'text-fg-primary',
              )}
              style={{minWidth: 120}}
            />
            <Text
              variant="h2"
              className={cn(insufficient ? 'text-danger' : 'text-fg-secondary')}>
              SOL
            </Text>
          </View>
          <View className="items-center">
            {insufficient ? (
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={12} color="#FF5C6A" strokeWidth={2} />
                <Text variant="caption" className="text-danger">
                  Insufficient balance · max {formatNumber(sourceBalance, 4)} SOL
                </Text>
              </View>
            ) : hasAmount ? (
              <Text variant="body-sm" numeral className="text-fg-tertiary">
                ≈ ${formatNumber(fiatEstimate, 2)} USD
              </Text>
            ) : (
              <Pressable
                onPress={handleMax}
                accessibilityRole="button"
                accessibilityLabel="Max"
                disabled={sourceBalance <= 0}
                className={cn(
                  'px-3 py-1.5 rounded-pill',
                  sourceBalance > 0
                    ? direction === 'private'
                      ? 'bg-[rgba(91,227,194,0.16)] active:opacity-80'
                      : 'bg-accent-transparent-tint active:opacity-80'
                    : 'bg-bg-surface-3',
                )}>
                <Text
                  variant="overline"
                  className={cn(
                    sourceBalance > 0
                      ? direction === 'private'
                        ? 'text-accent-shielded'
                        : 'text-accent-transparent'
                      : 'text-fg-disabled',
                  )}>
                  MAX
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Fees card */}
        <View
          className={cn(
            'rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4',
            insufficient && 'opacity-50',
          )}>
          <Text variant="overline" className="mb-3">
            Fees
          </Text>
          <FeeRow
            label="Network fee"
            value={hasAmount ? `${NETWORK_FEE_SOL} SOL` : '—'}
            fiat={hasAmount ? '$0.03' : '—'}
          />
          <FeeRow
            label="ZK proof fee"
            value={hasAmount ? `${ZK_PROOF_FEE_SOL} SOL` : '—'}
            fiat={hasAmount ? '$0.50' : '—'}
            zk
          />
          <View className="h-px bg-bg-surface-3 my-3" />
          <View className="flex-row items-center justify-between">
            <Text variant="body-sm" className="text-fg-secondary">
              {direction === 'private' ? "You'll shield" : "You'll receive"}
            </Text>
            <Text variant="balance-md" numeral className="text-fg-primary">
              {hasAmount && !insufficient ? formatNumber(netReceived, 5) : '—'} SOL
            </Text>
          </View>
        </View>

        {/* Privacy meter (Make private + has amount) */}
        {direction === 'private' && hasAmount && !insufficient ? (
          <View className="rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text variant="body-sm" className="text-fg-secondary">
                Anonymity set after this deposit
              </Text>
              <Text variant="body-sm" numeral className="text-accent-shielded font-geist-semibold">
                ~ 4,820
              </Text>
            </View>
            <View className="flex-row gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <View
                  key={i}
                  className={cn(
                    'flex-1 h-1.5 rounded-pill',
                    i < 4 ? 'bg-accent-shielded' : 'bg-bg-surface-3',
                  )}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Privacy-decreases banner (Make public) */}
        {direction === 'public' ? (
          <View className="rounded-md bg-bg-surface-2 border-l-2 border-l-warning p-4 mb-4 flex-row gap-3">
            <AlertTriangle size={16} color="#F2B53B" strokeWidth={1.75} />
            <View className="flex-1">
              <Text variant="body-sm" className="font-geist-semibold text-fg-primary mb-0.5">
                Privacy decreases on public withdraw
              </Text>
              <Text variant="caption" className="text-fg-secondary">
                SOL leaving the vault is associated with your transparent address from this point forward.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Explanation copy (Make private idle) */}
        {direction === 'private' && !hasAmount ? (
          <Text variant="caption" className="text-fg-tertiary text-center px-2 mt-1">
            Funds move into your private vault. Recipients of future shielded sends won't be linked to your public address.
          </Text>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 pb-8 pt-2 border-t border-bg-surface-2 bg-bg-base">
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          testID="shield-cta"
          accessibilityLabel={direction === 'private' ? 'Shield SOL' : 'Unshield SOL'}
          className={cn(
            'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
            canSubmit ? 'bg-accent-shielded active:opacity-90' : 'bg-bg-surface-3',
          )}>
          {direction === 'private' ? (
            <Shield
              size={18}
              color={canSubmit ? '#0A0A0A' : '#6E727A'}
              strokeWidth={2}
              fill={canSubmit ? '#0A0A0A' : 'transparent'}
            />
          ) : null}
          <Text
            variant="body-lg"
            className={cn(
              'font-geist-semibold',
              canSubmit ? 'text-bg-base' : 'text-fg-disabled',
            )}>
            {direction === 'private'
              ? canSubmit
                ? `Shield ${formatNumber(netReceived, 5)} SOL`
                : 'Shield SOL'
              : canSubmit
                ? `Unshield ${formatNumber(netReceived, 5)} SOL`
                : 'Unshield SOL'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Direction tab ───────────────────────────────────────────────────────────

interface DirTabProps {
  label: string;
  Icon: typeof ShieldCheck;
  active: boolean;
  onPress: () => void;
}

function DirTab({label, Icon, active, onPress}: DirTabProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{selected: active}}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-2 py-2 rounded-pill',
        active && 'bg-accent-shielded',
      )}>
      <Icon
        size={16}
        color={active ? '#0A0A0A' : '#A8ACB5'}
        strokeWidth={1.75}
      />
      <Text
        variant="body-sm"
        className={cn(
          'font-geist-semibold',
          active ? 'text-bg-base' : 'text-fg-secondary',
        )}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Fee row ────────────────────────────────────────────────────────────────

interface FeeRowProps {
  label: string;
  value: string;
  fiat: string;
  zk?: boolean;
}

function FeeRow({label, value, fiat, zk}: FeeRowProps) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center gap-2 flex-1">
        {zk ? (
          <View className="w-5 h-5 rounded-pill items-center justify-center bg-[rgba(91,227,194,0.16)]">
            <Shield size={12} color="#5BE3C2" strokeWidth={2} />
          </View>
        ) : null}
        <Text
          variant="body-sm"
          className={cn(zk ? 'text-accent-shielded' : 'text-fg-secondary')}>
          {label}
        </Text>
      </View>
      <View className="items-end">
        <Text variant="body-sm" numeral className="text-fg-primary">
          {value}
        </Text>
        <Text variant="caption" numeral className="text-fg-tertiary">
          {fiat}
        </Text>
      </View>
    </View>
  );
}
