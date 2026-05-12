import React from 'react';
import {Text as RNText, TextProps as RNTextProps} from 'react-native';
import {cn} from '../../utils/cn';

/**
 * Typography primitive — matches DS v0.2 §2 + v0.2.1 type scale.
 *
 * Variants map 1:1 to .noc-* shortcut classes in src/global.css and to
 * `text-*` utilities in tailwind.config.js#fontSize. Two equivalent paths:
 *   <Text variant="h1">Welcome</Text>          // semantic via variant prop
 *   <RNText className="noc-h1" />              // direct .noc-* class
 *   <RNText className="font-geist text-h1 text-fg-primary" />  // utilities
 *
 * Choose `variant` prop for readability; reach for raw className when composing
 * multiple modifiers (color override, numeral / mono additives).
 *
 * Compose with `numeral` / `mono` props for tabular alignment / monospace —
 * these stack via fontVariant under the hood (React Native native prop).
 */
export type TextVariant =
  | 'display'
  | 'h1'
  | 'h1-compact'  // DS v0.2.1
  | 'h2'
  | 'h3'
  | 'body-lg'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'overline'
  | 'balance-xl'
  | 'balance-lg'
  | 'balance-md';

const VARIANT_CLASSES: Record<TextVariant, string> = {
  'display':     'font-geist text-display text-fg-primary',
  'h1':          'font-geist text-h1 text-fg-primary',
  'h1-compact':  'font-geist text-h1-compact text-fg-primary',
  'h2':          'font-geist text-h2 text-fg-primary',
  'h3':          'font-geist text-h3 text-fg-primary',
  'body-lg':     'font-geist text-body-lg text-fg-primary',
  'body':        'font-geist text-body text-fg-primary',
  'body-sm':     'font-geist text-body-sm text-fg-primary',
  'caption':     'font-geist text-caption text-fg-secondary',
  'overline':    'font-geist text-overline text-fg-tertiary uppercase',
  'balance-xl':  'font-geist text-balance-xl text-fg-primary',
  'balance-lg':  'font-geist text-balance-lg text-fg-primary',
  'balance-md':  'font-geist text-balance-md text-fg-primary',
};

interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TextVariant;
  /**
   * Apply `font-variant-numeric: tabular-nums` for vertical column alignment.
   * Use on every fee, price, balance, percentage, latency value, countdown.
   */
  numeral?: boolean;
  /**
   * Apply Geist Mono + `font-variant-numeric: tabular-nums slashed-zero`.
   * Use on addresses, hashes, contract IDs, signatures, RPC URLs, seed words.
   * NOTE: setting `mono` overrides any variant's font-family.
   */
  mono?: boolean;
  /**
   * Optional className to merge with variant + numeral / mono modifiers.
   * Use for color overrides, spacing, layout — same Tailwind utility names
   * as documented in tailwind.config.js.
   */
  className?: string;
}

/**
 * Compute fontVariant array based on numeral / mono flags. React Native maps
 * this to native font-variant-numeric on both platforms.
 *
 * NOTE: RN's `FontVariant` type does NOT support 'slashed-zero' (that's a
 * web-only CSS feature). For mono text, slashed-zero must come from the font
 * file itself — Geist Mono's default '0' glyph is non-slashed but clearly
 * distinguishable from 'O' through its monospaced shape + character spacing.
 * If slashed-zero proves necessary for address legibility in production,
 * consider a different mono font variant or font subset that ships with
 * slashed-zero as the default glyph.
 *
 * Spec: https://reactnative.dev/docs/text-style-props#fontvariant
 */
function fontVariantFor(numeral: boolean, mono: boolean): Array<'tabular-nums'> | undefined {
  if (numeral || mono) return ['tabular-nums'];
  return undefined;
}

export function Text({
  variant = 'body',
  numeral = false,
  mono = false,
  className,
  ...rest
}: TextProps) {
  // mono overrides variant's font-family; build class chain accordingly
  const variantClass = VARIANT_CLASSES[variant];
  const monoClass = mono ? 'font-geist-mono' : '';
  const merged = cn(variantClass, monoClass, className);
  const fontVariant = fontVariantFor(numeral, mono);

  return (
    <RNText
      className={merged}
      style={fontVariant ? {fontVariant} : undefined}
      {...rest}
    />
  );
}
