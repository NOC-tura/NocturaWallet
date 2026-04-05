import React from 'react';
import {ScrollView, TouchableOpacity, Text, StyleSheet, View} from 'react-native';

interface Token {
  mint: string;
  symbol: string;
}

interface TokenSelectorProps {
  tokens: Token[];
  selected: string;
  onSelect: (mint: string) => void;
}

export function TokenSelector({tokens, selected, onSelect}: TokenSelectorProps) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {tokens.map(token => {
          const isSelected = token.mint === selected;
          return (
            <TouchableOpacity
              key={token.mint}
              style={[styles.pill, isSelected && styles.pillSelected]}
              onPress={() => onSelect(token.mint)}
              activeOpacity={0.75}>
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {token.symbol}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillSelected: {
    backgroundColor: '#6C47FF',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
});
