import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {usePresaleStore} from '../store/zustand/presaleStore';

interface PresaleScreenProps {
  onSkip: () => void;
  onComplete: () => void;
  isOnboarding?: boolean;
}

// ─── State A: Presale Active ───────────────────────────────────────────────

function PresaleActive({
  onSkip,
  onComplete: _onComplete,
  isOnboarding,
  currentStage,
}: {
  onSkip: () => void;
  onComplete: () => void;
  isOnboarding: boolean;
  currentStage: number | null;
}) {
  const stage = currentStage ?? 1;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy NOC</Text>

      <View style={styles.stageBadge}>
        <Text style={styles.stageBadgeText}>Stage {stage} of 10</Text>
      </View>

      {/* Progress bar placeholder */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, {width: `${(stage / 10) * 100}%`}]} />
      </View>
      <Text style={styles.progressLabel}>Stage progress — live data coming soon</Text>

      {/* Price display placeholder */}
      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>Current price</Text>
        <Text style={styles.priceValue}>— SOL / NOC</Text>
        <Text style={styles.priceHint}>On-chain price loads after Anchor IDL integration</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => Alert.alert('Coming Soon', 'Presale purchase will be available after on-chain program integration.')}>
        <Text style={styles.primaryButtonText}>Buy NOC</Text>
      </TouchableOpacity>

      {isOnboarding && (
        <TouchableOpacity style={styles.ghostButton} onPress={onSkip}>
          <Text style={styles.ghostButtonText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
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
      <Text style={styles.title}>Claim Your NOC Tokens</Text>

      <View style={styles.allocationCard}>
        <Text style={styles.allocationLabel}>Your allocation</Text>
        <Text style={styles.allocationValue}>{totalDisplay} NOC</Text>
        {BigInt(referralBonusTokens) > 0n && (
          <Text style={styles.allocationBonus}>
            Includes {BigInt(referralBonusTokens).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} referral bonus
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onComplete}>
        <Text style={styles.primaryButtonText}>Claim NOC</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── State C: Fully Claimed ────────────────────────────────────────────────

function PresaleClaimed({onSkip, onComplete}: {onSkip: () => void; onComplete: () => void}) {
  return (
    <View style={styles.container}>
      <View style={styles.claimedBadge}>
        <Text style={styles.claimedBadgeText}>All Claimed ✓</Text>
      </View>

      <Text style={styles.claimedTitle}>Your NOC tokens are in your wallet</Text>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={styles.quickActionButton} onPress={() => Alert.alert('Coming Soon', 'Staking will be available after on-chain program integration.')}>
          <Text style={styles.quickActionText}>Stake</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton} onPress={() => Alert.alert('Coming Soon', 'Send will be available from the Dashboard.')}>
          <Text style={styles.quickActionText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickActionButton, styles.quickActionButtonAccent]}
          onPress={onComplete}>
          <Text style={[styles.quickActionText, styles.quickActionTextAccent]}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.ghostButton} onPress={onSkip}>
        <Text style={styles.ghostButtonText}>Close</Text>
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

  // Stage A
  stageBadge: {
    alignSelf: 'center',
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#6C47FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
  },
  stageBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C47FF',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#1A1A2E',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6C47FF',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#6C6C80',
    textAlign: 'center',
    marginBottom: 28,
  },
  priceCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 32,
  },
  priceLabel: {
    fontSize: 12,
    color: '#9999B3',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  priceHint: {
    fontSize: 11,
    color: '#6C6C80',
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
