import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';

type PriorityLevel = 'normal' | 'fast' | 'urgent';

interface PriorityFeeToggleProps {
  level: PriorityLevel;
  onSelect: (level: PriorityLevel) => void;
}

const LEVELS: {value: PriorityLevel; label: string}[] = [
  {value: 'normal', label: 'Normal'},
  {value: 'fast', label: 'Fast'},
  {value: 'urgent', label: 'Urgent'},
];

export function PriorityFeeToggle({level, onSelect}: PriorityFeeToggleProps) {
  return (
    <View style={styles.container}>
      {LEVELS.map(item => {
        const isSelected = item.value === level;
        return (
          <TouchableOpacity
            key={item.value}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelect(item.value)}
            activeOpacity={0.75}>
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillSelected: {
    borderColor: '#6C47FF',
    backgroundColor: 'rgba(108,71,255,0.1)',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  pillTextSelected: {
    color: '#A385FF',
  },
});
