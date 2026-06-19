import React from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {Rocket, ChevronRight} from 'lucide-react-native';
import {Text} from './ui';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {PRESALE_STAGE_PRICES} from '../constants/presale';

interface PresaleBannerProps {
  onPress: () => void;
}

export function PresaleBanner({onPress}: PresaleBannerProps) {
  const {
    currentStage,
    pricePerNoc,
    soldInStage,
    stageCapacity,
    tgeStatus,
    tokensPurchased,
    claimedTokens,
    referralBonusTokens,
  } = usePresaleStore();

  // Hide once all tokens are claimed.
  if (tgeStatus === 'claimed') {
    return null;
  }

  // Post-TGE claim banner (unchanged — Cycle C will style/flesh this out).
  if (tgeStatus === 'claimable') {
    const total = BigInt(tokensPurchased) + BigInt(referralBonusTokens);
    const unclaimed = total - BigInt(claimedTokens);
    return (
      <Pressable testID="presale-claim-banner" style={styles.claimContainer} onPress={onPress}>
        <View style={styles.claimRow}>
          <View style={styles.claimDot} />
          <Text variant="body-lg" className="text-fg-primary">
            Claim Your NOC Tokens
          </Text>
        </View>
        <Text variant="body-sm" numeral className="text-success mt-1">
          {formatNoc(unclaimed)} NOC available
        </Text>
      </Pressable>
    );
  }

  // Pre-TGE buy banner — compact .presale design (index.html ≈ 6371).
  const stage = currentStage ?? 1;
  const price = pricePerNoc ?? String(PRESALE_STAGE_PRICES[0]);
  const sold = soldInStage ? BigInt(soldInStage) : 0n;
  const cap = stageCapacity ? BigInt(stageCapacity) : 0n;
  const pct = cap > 0n ? Number((sold * 100n) / cap) : 0;

  return (
    <Pressable
      testID="presale-buy-banner"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`NOC Presale, stage ${stage}`}
      className="mx-5 mt-2 mb-3 flex-row items-center gap-3 p-4 rounded-lg bg-bg-surface-1 border border-[#6C47FF33]">
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2">
        <Rocket size={20} color="#B084FC" strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text variant="body-lg" className="text-fg-primary">
          {`NOC Presale · Stage ${stage}`}
        </Text>
        <Text variant="body-sm" numeral className="text-fg-secondary mt-0.5">
          {`$${price} · ${pct}% to next stage`}
        </Text>
      </View>
      <ChevronRight size={18} color="#A8ACB5" strokeWidth={1.75} />
    </Pressable>
  );
}

function formatNoc(base: bigint): string {
  // base is 9-dec; show whole NOC with thousands separators.
  const whole = base / 1_000_000_000n;
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const styles = StyleSheet.create({
  claimContainer: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF5033',
  },
  claimRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  claimDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50'},
});
