import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';

interface ModeToggleProps {
  mode: 'transparent' | 'shielded';
  onToggle: () => void;
  /** Called instead of onToggle the very first time the user taps "Private",
   *  before the privacy explainer has been acknowledged. */
  onFirstShieldedToggle?: () => void;
}

export function ModeToggle({mode, onToggle, onFirstShieldedToggle}: ModeToggleProps) {
  function handleShieldedPress() {
    if (mode === 'shielded') return; // already active — no-op
    const explainerShown = mmkvPublic.getBoolean(MMKV_KEYS.PRIVACY_EXPLAINER_SHOWN);
    if (!explainerShown && onFirstShieldedToggle) {
      onFirstShieldedToggle();
    } else {
      onToggle();
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.segment, mode === 'transparent' && styles.activeSegment]}
        onPress={mode !== 'transparent' ? onToggle : undefined}
        activeOpacity={0.8}
        accessibilityLabel="Switch to transparent mode">
        <Text style={[styles.label, mode === 'transparent' && styles.activeLabel]}>
          Transparent
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segment, mode === 'shielded' && styles.activeSegment]}
        onPress={handleShieldedPress}
        activeOpacity={0.8}
        accessibilityLabel="Switch to private mode">
        <Text style={[styles.label, mode === 'shielded' && styles.activeLabel]}>
          Private
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  activeSegment: {
    backgroundColor: '#6C47FF',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  activeLabel: {
    color: '#FFFFFF',
  },
});
