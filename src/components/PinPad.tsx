import React, {useState, useCallback, useEffect, useRef} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface PinPadProps {
  onComplete: (pin: string) => void;
  maxLength: number;
  error?: string | null;
  disabled?: boolean;
  testID?: string;
  resetKey?: number;
}

const KEYPAD_ROWS: (string | number)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['', 0, '⌫'],
];

export function PinPad({onComplete, maxLength, error, disabled, testID, resetKey}: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const processingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Reset when parent signals step change
  useEffect(() => {
    setDigits([]);
    processingRef.current = false;
  }, [resetKey]);

  // Detect when digits reach maxLength → fire onComplete after brief delay
  useEffect(() => {
    if (digits.length !== maxLength || processingRef.current) return;
    processingRef.current = true;
    const pin = digits.join('');
    const timer = setTimeout(() => {
      setDigits([]);
      processingRef.current = false;
      onCompleteRef.current(pin);
    }, 150);
    return () => {
      clearTimeout(timer);
      processingRef.current = false;
    };
  }, [digits, maxLength]);

  const handleKey = useCallback(
    (key: string | number) => {
      if (disabled || processingRef.current) return;

      if (key === '⌫') {
        setDigits(prev => prev.slice(0, -1));
        return;
      }
      if (key === '') return;

      setDigits(prev => {
        if (prev.length >= maxLength) return prev;
        return [...prev, String(key)];
      });
    },
    [disabled, maxLength],
  );

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.dotsRow}>
        {Array.from({length: maxLength}).map((_, i) => {
          const filled = i < digits.length;
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((key, colIdx) => {
              const isEmpty = key === '';
              const isBackspace = key === '⌫';
              return (
                <TouchableOpacity
                  key={colIdx}
                  style={[styles.keyButton, isEmpty && styles.keyButtonHidden]}
                  onPress={() => !isEmpty && handleKey(key)}
                  disabled={disabled || isEmpty}
                  activeOpacity={0.6}
                  accessibilityLabel={isBackspace ? 'Delete' : isEmpty ? undefined : `Key ${key}`}>
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
  container: {alignItems: 'center', paddingVertical: 16},
  dotsRow: {flexDirection: 'row', marginBottom: 12, gap: 14},
  dot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'transparent',
  },
  dotFilled: {backgroundColor: '#6C47FF', borderColor: '#6C47FF'},
  dotError: {backgroundColor: '#F87171', borderColor: '#F87171'},
  errorText: {fontSize: 13, color: '#F87171', marginBottom: 12, textAlign: 'center'},
  keypad: {marginTop: 8},
  row: {flexDirection: 'row', justifyContent: 'center'},
  keyButton: {
    width: 80, height: 80, margin: 6, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  keyButtonHidden: {backgroundColor: 'transparent'},
  keyText: {fontSize: 24, fontWeight: '400', color: '#FFFFFF'},
});
