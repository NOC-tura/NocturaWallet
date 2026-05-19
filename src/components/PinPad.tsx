import React, {useState, useEffect, useRef} from 'react';
import {View, Pressable} from 'react-native';
import {Delete, Fingerprint} from 'lucide-react-native';
import {Text} from './ui';
import {cn} from '../utils/cn';

/**
 * PIN entry primitives — split into dots + keypad so consuming screens can
 * compose them with custom layout (dots near title, keypad anchored to bottom).
 *
 * Three exports:
 *   - <PinDots>   visual-only · 6 circles, fill in --accent, danger on error
 *   - <PinKeypad> visual + onKey · 4×3 numeric keypad, 64 dp touch target
 *   - <PinPad>    bundled composition · backward-compatible with legacy
 *                 callers (UnlockScreen, ChangePinScreen, SetPinScreen).
 *
 * Plus a `usePinInput` hook that owns state (digits, double-fire guard,
 * resetKey). Screens that want split layout use the hook directly + render
 * <PinDots> and <PinKeypad> separately.
 *
 * Design reference: /home/user/Downloads/index.html §s5 pin-create — dots
 * sit in pin-head adjacent to title, keypad anchored to bottom with flex
 * spacer between.
 */

// ── usePinInput hook ────────────────────────────────────────────────────────

interface UsePinInputArgs {
  maxLength: number;
  onComplete: (pin: string) => void;
  /** Increment to reset digits + re-arm firedRef. */
  resetKey?: number;
}

export function usePinInput({maxLength, onComplete, resetKey}: UsePinInputArgs) {
  const [digits, setDigits] = useState<string[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);

  useEffect(() => {
    setDigits([]);
    firedRef.current = false;
  }, [resetKey]);

  const handleKey = (key: string | number) => {
    if (firedRef.current) return;
    if (key === '⌫') {
      setDigits(prev => prev.slice(0, -1));
      return;
    }
    if (key === '') return;

    const next = [...digits, String(key)];
    if (next.length > maxLength) return;

    setDigits(next);

    if (next.length === maxLength) {
      firedRef.current = true;
      onCompleteRef.current(next.join(''));
    }
  };

  return {digits, handleKey};
}

// ── PinDots component ──────────────────────────────────────────────────────

interface PinDotsProps {
  /** Number of currently filled dots (typically `digits.length`). */
  count: number;
  /** Total dots to render. */
  maxLength: number;
  /** When true, filled dots flip to --danger. */
  error?: boolean;
  className?: string;
}

export function PinDots({count, maxLength, error, className}: PinDotsProps) {
  return (
    <View className={cn('flex-row gap-3', className)}>
      {Array.from({length: maxLength}).map((_, i) => {
        const filled = i < count;
        return (
          <View
            key={i}
            testID="pin-dot"
            className={cn(
              'w-3.5 h-3.5 rounded-pill border',
              !filled && 'border-fg-tertiary',
              filled && !error && 'bg-accent-transparent border-accent-transparent',
              filled && error && 'bg-danger border-danger',
            )}
          />
        );
      })}
    </View>
  );
}

// ── PinKeypad component ────────────────────────────────────────────────────

interface PinKeypadProps {
  onKey: (key: string | number) => void;
  disabled?: boolean;
  className?: string;
  /**
   * Optional bottom-left cell: when provided, the empty cell renders a
   * Fingerprint glyph that fires this callback on tap. Used by UnlockScreen
   * (#9 / #10) to let the user retry biometric without leaving the keypad.
   */
  onFingerprintPress?: () => void;
}

const KEYPAD_ROWS: (string | number)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['', 0, '⌫'],
];

export function PinKeypad({
  onKey,
  disabled,
  className,
  onFingerprintPress,
}: PinKeypadProps) {
  // Keys sized at 80 dp (w-20 h-20) — bumped from design's 64 dp baseline per
  // Phase B real-user feedback that 64 dp felt too small + too cramped. 80 dp
  // is still well within thumb-reach on Pixel/standard-phone widths (3 keys ×
  // 80 dp + 4 × 10 dp gaps = 280 dp ≈ 68 % of 412 dp screen width). 4 row ×
  // 80 dp = 320 dp keypad height · ~35 % of typical 916 dp screen height.
  return (
    <View className={cn('items-center', className)}>
      {KEYPAD_ROWS.map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row justify-center">
          {row.map((key, colIdx) => {
            const isEmpty = key === '';
            const isBackspace = key === '⌫';
            const isFingerprintCell = isEmpty && !!onFingerprintPress;

            if (isFingerprintCell) {
              return (
                <Pressable
                  key={colIdx}
                  onPress={onFingerprintPress}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock with fingerprint"
                  className="w-20 h-20 m-2 rounded-pill items-center justify-center bg-bg-surface-2 active:bg-bg-surface-3">
                  <Fingerprint size={28} color="#B084FC" strokeWidth={1.75} />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={colIdx}
                className={cn(
                  'w-20 h-20 m-2 rounded-pill items-center justify-center',
                  isEmpty ? 'bg-transparent' : 'bg-bg-surface-2 active:bg-bg-surface-3',
                )}
                onPress={() => !isEmpty && onKey(key)}
                disabled={disabled || isEmpty}
                accessibilityRole={isEmpty ? undefined : 'button'}
                accessibilityLabel={
                  isBackspace ? 'Delete' : isEmpty ? undefined : `Digit ${key}`
                }>
                {isEmpty ? null : isBackspace ? (
                  <Delete size={26} color="#F4F5F7" strokeWidth={1.75} />
                ) : (
                  <Text variant="h2" className="text-fg-primary">
                    {String(key)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── PinPad bundled wrapper · backward-compatible ───────────────────────────

interface PinPadProps {
  onComplete: (pin: string) => void;
  maxLength: number;
  /** Helper text below dots (e.g., "Choose something memorable but not 111111."). */
  helperText?: string | null;
  /** Error text — flips dots + helper to --danger. */
  error?: string | null;
  disabled?: boolean;
  testID?: string;
  resetKey?: number;
}

export function PinPad({
  onComplete,
  maxLength,
  helperText,
  error,
  disabled,
  testID,
  resetKey,
}: PinPadProps) {
  const {digits, handleKey} = usePinInput({maxLength, onComplete, resetKey});

  return (
    <View className="items-center" testID={testID}>
      <PinDots count={digits.length} maxLength={maxLength} error={!!error} className="mb-3" />
      {error ? (
        <Text variant="caption" className="text-danger mb-3 text-center">
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" className="text-fg-tertiary mb-3 text-center">
          {helperText}
        </Text>
      ) : (
        <View className="h-4 mb-3" />
      )}
      <PinKeypad onKey={handleKey} disabled={disabled} className="mt-2" />
    </View>
  );
}
