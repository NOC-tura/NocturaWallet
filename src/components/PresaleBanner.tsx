import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {usePresaleStore} from '../store/zustand/presaleStore';

interface PresaleBannerProps {
  onPress: () => void;
}

export function PresaleBanner({onPress}: PresaleBannerProps) {
  const {currentStage, pricePerNoc, soldInStage, stageCapacity, tgeStatus, tokensPurchased, claimedTokens, referralBonusTokens} = usePresaleStore();

  // Hide banner after all tokens claimed
  if (tgeStatus === 'claimed') {
    return null;
  }

  // Post-TGE: claim banner
  if (tgeStatus === 'claimable') {
    const total = BigInt(tokensPurchased) + BigInt(referralBonusTokens);
    const claimed = BigInt(claimedTokens);
    const unclaimed = total - claimed;

    return (
      <TouchableOpacity
        testID="presale-claim-banner"
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}>
        <View style={styles.topRow}>
          <View style={styles.claimDot} />
          <Text style={styles.claimTitle}>Claim Your NOC Tokens</Text>
        </View>
        <Text style={styles.claimAmount}>
          {formatAmount(unclaimed.toString())} NOC available
        </Text>
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>Claim Now →</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Pre-TGE: buy banner
  const stage = currentStage ?? 1;
  const price = pricePerNoc ?? '0.0012';
  const sold = soldInStage ? BigInt(soldInStage) : 0n;
  const cap = stageCapacity ? BigInt(stageCapacity) : 1_000_000n;
  const progressPct = cap > 0n ? Number((sold * 100n) / cap) : 0;

  return (
    <TouchableOpacity
      testID="presale-buy-banner"
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.topRow}>
        <View style={styles.stageBadge}>
          <View style={styles.dot} />
          <Text style={styles.stageText}>Stage {stage} of 10</Text>
        </View>
        <Text style={styles.priceText}>1 NOC = {price} SOL</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {width: `${Math.min(progressPct, 100)}%`}]} />
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.soldText}>
          {formatAmount(sold.toString())} / {formatAmount(cap.toString())} NOC
        </Text>
        <Text style={styles.ctaText}>Buy NOC →</Text>
      </View>
    </TouchableOpacity>
  );
}

function formatAmount(value: string): string {
  const num = Number(value);
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return value;
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6C47FF33',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C47FF',
  },
  stageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#2A2A3E',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6C47FF',
    borderRadius: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soldText: {
    fontSize: 12,
    color: '#888888',
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
  },
  // Claim state styles
  claimDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  claimTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  claimAmount: {
    fontSize: 13,
    color: '#4CAF50',
    marginBottom: 8,
  },
  ctaRow: {
    alignItems: 'flex-end',
  },
});
