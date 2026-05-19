import React, {ReactNode} from 'react';
import {View, ViewProps} from 'react-native';
import {cn} from '../../utils/cn';

/**
 * Card primitive — matches DS v0.2 §9 Card component.
 *
 * Default chrome:
 *   - background: --bg-surface-1
 *   - radius: --radius-lg (14px)
 *   - padding: --space-5 (20px)
 *   - no border, no shadow (DS hierarchy comes from surface elevation, not chrome)
 *
 * Elevation variants — bump the surface tier when nesting cards or for
 * sheet-style content:
 *   surface-1 (default) | surface-2 (raised) | surface-3 (highest)
 *
 * Accent border — opt-in via `accentBorder` prop. Used on shielded hero cards
 * (per DS §7 non-color mode cue — hairline border treatment).
 */

export type CardSurface = 'surface-1' | 'surface-2' | 'surface-3';

interface CardProps extends Omit<ViewProps, 'style' | 'children'> {
  children: ReactNode;
  /** Background tier. Defaults to surface-1. */
  surface?: CardSurface;
  /** Override default padding (`p-5`). Pass full Tailwind utility, e.g. 'p-4'. */
  padding?: string;
  /** Override default radius (`rounded-lg`). Pass full Tailwind utility. */
  radius?: string;
  /**
   * Add a 1px hairline border in the current mode's accent. Used on shielded
   * hero cards as a non-color mode cue (DS §7).
   */
  accentBorder?: boolean;
  /** Optional className appended to base styles (e.g. layout, gap). */
  className?: string;
}

const SURFACE_CLASSES: Record<CardSurface, string> = {
  'surface-1': 'bg-bg-surface-1',
  'surface-2': 'bg-bg-surface-2',
  'surface-3': 'bg-bg-surface-3',
};

export function Card({
  children,
  surface = 'surface-1',
  padding = 'p-5',
  radius = 'rounded-lg',
  accentBorder = false,
  className,
  ...rest
}: CardProps) {
  // Accent border: hardcoded utility classes since useMode() can't run here
  // without making Card a hook consumer. For mode-aware borders, pass
  // className="border border-accent-shielded" explicitly from the consumer
  // (which CAN read useMode). This keeps Card a leaf primitive.
  const borderClass = accentBorder ? 'border border-accent-transparent' : '';

  return (
    <View
      className={cn(SURFACE_CLASSES[surface], radius, padding, borderClass, className)}
      {...rest}>
      {children}
    </View>
  );
}
