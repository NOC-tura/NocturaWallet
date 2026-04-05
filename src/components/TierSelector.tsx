import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';
import {STAKING_TIERS, StakingTier} from '../modules/staking/types';

interface TierSelectorProps {
  selectedTier: StakingTier['id'];
  onSelect: (id: StakingTier['id']) => void;
}

export function TierSelector({selectedTier, onSelect}: TierSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}>
      {STAKING_TIERS.map(tier => {
        const isSelected = tier.id === selectedTier;
        return (
          <TouchableOpacity
            key={tier.id}
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onSelect(tier.id)}
            activeOpacity={0.8}>
            <Text style={[styles.duration, isSelected && styles.durationSelected]}>
              {tier.label}
            </Text>
            <Text style={[styles.apy, isSelected && styles.apySelected]}>
              {tier.apyPercent}% APY
            </Text>
            <View style={[styles.badge, isSelected && styles.badgeSelected]}>
              <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                {tier.feeDiscount * 100}% fee discount
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    width: 120,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    alignItems: 'center',
  },
  cardSelected: {
    borderColor: '#6C47FF',
    backgroundColor: 'rgba(108,71,255,0.1)',
  },
  duration: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  durationSelected: {
    color: '#FFFFFF',
  },
  apy: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  apySelected: {
    color: '#6C47FF',
  },
  badge: {
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeSelected: {
    backgroundColor: 'rgba(108,71,255,0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  badgeTextSelected: {
    color: '#A385FF',
  },
});
