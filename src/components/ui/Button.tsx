import React from 'react';
import {Pressable, PressableProps, ActivityIndicator, View} from 'react-native';
import {cn} from '../../utils/cn';
import {Text} from './Text';
import {useMode} from '../../hooks/useMode';

/**
 * Button primitive — matches DS v0.2 §9 button variants.
 *
 * Variants:
 *   - primary       — pill, full-width by default, accent fill, bg-base foreground
 *                     mode-aware: violet (transparent) or mint (shielded)
 *   - secondary     — pill, surface-2 fill, fg-primary foreground, no border
 *   - tertiary      — text-only, accent foreground, no fill
 *                     mode-aware
 *   - destructive   — pill, danger fill, danger-on foreground (#FFFFFF)
 *                     For high-stakes destructive actions (clear wallet,
 *                     disconnect all), use the LONG-PRESS pattern via
 *                     `<Button variant="destructive" longPress />` (TODO Phase B —
 *                     not yet implemented; for now uses standard tap).
 *
 * Touch target — all variants are 56 dp tall (--touch-target-rec) by default.
 * Width — full-width via `fullWidth` prop (default true on primary/secondary,
 * false on tertiary).
 *
 * Loading state — shows a spinner replacing the label; disables touch
 * automatically. Use during async actions (broadcast, sign, encrypt).
 *
 * Disabled state — surface-3 fill + fg-disabled label; NO opacity change
 * (per DS §9: "no faded mystery state").
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Button label text. */
  label: string;
  /** Visual variant. Defaults to 'primary'. */
  variant?: ButtonVariant;
  /** Full-width pill. Default true for primary / secondary / destructive. */
  fullWidth?: boolean;
  /** Show spinner instead of label; disables touch. */
  loading?: boolean;
  /** Disable touch; renders surface-3 fill + fg-disabled label. */
  disabled?: boolean;
  /** Optional className appended to variant base styles. */
  className?: string;
}

// Use min-h-touch-rec because tailwind.config.js declares minHeight (not height)
// for touch tokens. Buttons can grow taller for long labels but never below 56 dp.
const HEIGHT_CLASS = 'min-h-touch-rec'; // 56 dp minimum

function variantClasses(
  variant: ButtonVariant,
  mode: 'transparent' | 'shielded',
  disabled: boolean,
): {container: string; label: string} {
  if (disabled) {
    return {
      container: 'bg-bg-surface-3 rounded-pill',
      label: 'text-fg-disabled',
    };
  }
  const accentBg = mode === 'shielded' ? 'bg-accent-shielded' : 'bg-accent-transparent';
  const accentText = mode === 'shielded' ? 'text-accent-shielded' : 'text-accent-transparent';

  switch (variant) {
    case 'primary':
      return {
        container: `${accentBg} rounded-pill`,
        label: 'text-bg-base',
      };
    case 'secondary':
      return {
        container: 'bg-bg-surface-2 rounded-pill',
        label: 'text-fg-primary',
      };
    case 'tertiary':
      return {
        container: 'bg-transparent',
        label: accentText,
      };
    case 'destructive':
      return {
        container: 'bg-danger rounded-pill',
        label: 'text-danger-on',
      };
  }
}

export function Button({
  label,
  variant = 'primary',
  fullWidth,
  loading = false,
  disabled = false,
  className,
  onPress,
  ...rest
}: ButtonProps) {
  const mode = useMode();
  const isDisabled = disabled || loading;
  const {container, label: labelClass} = variantClasses(variant, mode, isDisabled);
  // Default fullWidth: true for primary/secondary/destructive, false for tertiary
  const isFullWidth = fullWidth ?? variant !== 'tertiary';
  const widthClass = isFullWidth ? 'w-full' : '';

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{disabled: isDisabled}}
      accessibilityLabel={label}
      className={cn(
        HEIGHT_CLASS,
        widthClass,
        container,
        'items-center justify-center',
        // Press feedback — scale 0.98 on press per DS §9
        // NativeWind v4 supports active: variant
        'active:opacity-90',
        className,
      )}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={labelClass.startsWith('text-bg-base') ? '#0A0A0A' : '#F4F5F7'} />
      ) : (
        <View>
          <Text variant="body-lg" className={cn(labelClass, 'font-geist-semibold')}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
