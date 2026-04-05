import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {TierSelector} from '../../components/TierSelector';
import {RewardCalculator} from '../../components/RewardCalculator';
import {StakingPositionCard} from '../../components/StakingPositionCard';
import {StakingUnlockRow} from '../../components/StakingUnlockRow';
import {usePresaleStore} from '../../store/zustand/presaleStore';
import {STAKING_TIERS} from '../../modules/staking/stakingService';
import type {StakingTier, StakingPosition} from '../../modules/staking/types';

/**
 * Convert user-entered NOC amount (e.g., "1000") to lamports string.
 * NOC has 9 decimals. Returns '0' for invalid input.
 */
function nocToLamports(input: string): string {
  try {
    const cleaned = input.replace(/[^0-9.]/g, '');
    if (!cleaned || cleaned === '.') return '0';
    const parts = cleaned.split('.');
    const whole = parts[0] || '0';
    const frac = (parts[1] || '').padEnd(9, '0').slice(0, 9);
    const lamports = BigInt(whole) * 1_000_000_000n + BigInt(frac);
    return lamports.toString();
  } catch {
    return '0';
  }
}

interface StakingScreenProps {
  onBack?: () => void;
}

export function StakingScreen({onBack}: StakingScreenProps) {
  const [selectedTier, setSelectedTier] = useState<StakingTier['id']>('90d');
  const [amount, setAmount] = useState('');

  const {isZeroFeeEligible} = usePresaleStore();
  // useWalletStore — will be used for balance validation when staking tx is wired

  // No live position in this implementation — position comes from on-chain in a later step
  const position: StakingPosition | null = null;

  const currentTier = STAKING_TIERS.find(t => t.id === selectedTier);
  const feeDiscountPct = currentTier ? Math.round(currentTier.feeDiscount * 100) : 0;

  const tierLabel = currentTier ? currentTier.label : '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>{'←'}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>Staking</Text>
      </View>

      {/* Existing position */}
      {position ? (
        <StakingPositionCard
          position={position}
          onClaimRewards={() => {}}
          onExtendLock={() => {}}
        />
      ) : null}

      {/* Unlock row (< 7 days warning) */}
      {position ? <StakingUnlockRow position={position} /> : null}

      <View style={styles.divider} />

      {/* New Stake section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New Stake</Text>

        {/* Amount input */}
        <TextInput
          style={styles.amountInput}
          placeholder="Amount (NOC)"
          placeholderTextColor="rgba(255,255,255,0.3)"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Tier selector */}
        <TierSelector selectedTier={selectedTier} onSelect={setSelectedTier} />

        {/* Reward calculator */}
        <View style={styles.rewardCalcWrapper}>
          <RewardCalculator amount={nocToLamports(amount || '0')} tierId={selectedTier} />
        </View>

        {/* Presale buyer badge */}
        {isZeroFeeEligible ? (
          <View style={styles.zeroBadge}>
            <Text style={styles.zeroBadgeText}>
              Zero-fee eligible — 18 months remaining
            </Text>
          </View>
        ) : null}

        {/* Fee discount badge */}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>
            Your {tierLabel} stake gives you {feeDiscountPct}% off private transaction fees
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaButton, !amount && styles.ctaButtonDisabled]}
          activeOpacity={0.85}
          disabled={!amount}
          onPress={() => {/* Staking tx wired in Anchor integration step */}}>
          <Text style={styles.ctaText}>STAKE NOC</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backText: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
    marginVertical: 16,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
  },
  amountInput: {
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rewardCalcWrapper: {
    paddingHorizontal: 20,
  },
  zeroBadge: {
    marginHorizontal: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,200,100,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(0,200,100,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  zeroBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00C864',
  },
  discountBadge: {
    marginHorizontal: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(108,71,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(108,71,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  discountText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  ctaButton: {
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#6C47FF',
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
