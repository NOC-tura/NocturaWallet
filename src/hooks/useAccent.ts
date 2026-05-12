import {useMode} from './useMode';

/**
 * Accent color helpers — derive the appropriate accent for the current mode.
 *
 * The accent tokens live in tailwind.config.js. These hooks expose them both as
 * raw hex strings (for native props that don't accept className — RefreshControl
 * tintColor, StatusBar barStyle equivalents, Reanimated shared values) and as
 * NativeWind utility class names (for components that style via className).
 *
 * Keep hex values in sync with tailwind.config.js `colors`. If you change a
 * token in tailwind, you MUST update these literal hex constants below.
 */

/** Solana violet — default mode accent (matches `tailwind.config.js#colors.accent-transparent`). */
const ACCENT_TRANSPARENT_HEX = '#B084FC';

/** Mint — shielded mode accent (matches `tailwind.config.js#colors.accent-shielded`). */
const ACCENT_SHIELDED_HEX = '#5BE3C2';

/**
 * Returns the raw accent hex for the current mode.
 *
 * Use when you need the literal color for a prop that doesn't accept className,
 * e.g. RefreshControl `tintColor`, StatusBar `backgroundColor`, Reanimated
 * `withTiming` color interpolation.
 */
export function useAccentColor(): string {
  const mode = useMode();
  return mode === 'shielded' ? ACCENT_SHIELDED_HEX : ACCENT_TRANSPARENT_HEX;
}

/**
 * Returns the NativeWind utility class for the current mode's accent
 * BACKGROUND. Use as `className={useAccentBgClass()}` or compose:
 *   <View className={`p-3 ${useAccentBgClass()}`} />
 */
export function useAccentBgClass(): 'bg-accent-transparent' | 'bg-accent-shielded' {
  const mode = useMode();
  return mode === 'shielded' ? 'bg-accent-shielded' : 'bg-accent-transparent';
}

/**
 * Returns the NativeWind utility class for the current mode's accent TEXT.
 *   <Text className={useAccentTextClass()}>$14,881.19</Text>
 */
export function useAccentTextClass(): 'text-accent-transparent' | 'text-accent-shielded' {
  const mode = useMode();
  return mode === 'shielded' ? 'text-accent-shielded' : 'text-accent-transparent';
}

/**
 * Returns the NativeWind utility class for the current mode's accent BORDER.
 *   <View className={`border ${useAccentBorderClass()}`} />
 */
export function useAccentBorderClass(): 'border-accent-transparent' | 'border-accent-shielded' {
  const mode = useMode();
  return mode === 'shielded' ? 'border-accent-shielded' : 'border-accent-transparent';
}
