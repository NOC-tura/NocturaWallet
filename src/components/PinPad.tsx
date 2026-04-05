import React, {useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface PinPadProps {
  onComplete: (pin: string) => void;
  maxLength: number;
  error?: string | null;
  disabled?: boolean;
}

// Layout: [1,2,3], [4,5,6], [7,8,9], ['',0,'⌫']
const KEYPAD_ROWS: (string | number)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['', 0, '⌫'],
];

/**
 * Custom numeric keypad for PIN entry.
 * Does NOT use system keyboard — prevents keylogger interception.
 * Tracks digits internally and calls onComplete when maxLength is reached.
 * Resets internal state after onComplete fires.
 */
export function PinPad({onComplete, maxLength, error, disabled}: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);

  const handleKey = useCallback(
    (key: string | number) => {
      if (disabled) return;

      if (key === '⌫') {
        setDigits(prev => prev.slice(0, -1));
        return;
      }

      if (key === '') return;

      const digit = String(key);

      setDigits(prev => {
        const next = [...prev, digit];

        if (next.length === maxLength) {
          // Use setTimeout(0) so the state update (filling the last dot)
          // renders before we call onComplete and the parent resets / shows error.
          const pinString = next.join('');
          setTimeout(() => {
            onComplete(pinString);
          }, 0);
          // Reset to empty after completing
          return [];
        }

        return next;
      });
    },
    [disabled, maxLength, onComplete],
  );

  const filledCount = digits.length;

  return (
    <View style={styles.container}>
      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {Array.from({length: maxLength}).map((_, i) => {
          const filled = i < filledCount;
          const hasError = Boolean(error);
          return (
            <View
              key={i}
              testID="pin-dot"
              style={[
                styles.dot,
                filled && styles.dotFilled,
                filled && hasError && styles.dotError,
              ]}
            />
          );
        })}
      </View>

      {/* Error message */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((key, colIdx) => {
              const isEmpty = key === '';
              return (
                <TouchableOpacity
                  key={colIdx}
                  style={[styles.keyButton, isEmpty && styles.keyButtonHidden]}
                  onPress={() => !isEmpty && handleKey(key)}
                  disabled={disabled || isEmpty}
                  activeOpacity={0.6}>
                  <Text style={styles.keyText}>{String(key)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  dotError: {
    backgroundColor: '#F87171',
    borderColor: '#F87171',
  },
  errorText: {
    fontSize: 13,
    color: '#F87171',
    marginBottom: 12,
    textAlign: 'center',
  },
  keypad: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  keyButton: {
    width: 80,
    height: 80,
    margin: 6,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyButtonHidden: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '400',
    color: '#FFFFFF',
  },
});
