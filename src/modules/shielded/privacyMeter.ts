import type {PrivacyLevel} from './types';

export function getPrivacyLevel(leafCount: number, isFirstDeposit: boolean): PrivacyLevel {
  if (leafCount < 100) {
    return {
      level: 'low',
      message: 'Privacy pool is very small. May be traceable.',
      color: 'red',
      shouldShow: true,
    };
  }
  if (leafCount < 1000) {
    return {
      level: 'moderate',
      message: 'Privacy pool is growing. Moderate protection.',
      color: 'yellow',
      shouldShow: true,
    };
  }
  if (leafCount < 10000) {
    return {
      level: 'good',
      message: 'Good privacy protection.',
      color: 'green',
      shouldShow: true,
    };
  }
  return {
    level: 'good',
    message: 'Good privacy protection.',
    color: 'green',
    shouldShow: isFirstDeposit,
  };
}

export function shouldRepeatWarning(leafCount: number): boolean {
  return leafCount < 1000;
}

export interface PrivacyStrength {
  /** Filled bars, 0..5 — the strength-meter fill count. */
  bars: number;
  /** Human strength label, e.g. "Strong". */
  label: string;
  /** Tone driving the bar/label colour. */
  tone: 'accent' | 'warn' | 'danger' | 'muted';
}

/**
 * Maps the on-chain anonymity set (merkle leaf count) to a 5-bar privacy
 * strength (index.html #12 shielded "Privacy meter" card). Purely a function of
 * how large the crowd is that a spent note hides among — bigger set, stronger
 * unlinkability. Thresholds mirror getPrivacyLevel's low/moderate/good bands.
 */
export function getPrivacyStrength(leafCount: number): PrivacyStrength {
  if (leafCount <= 0) return {bars: 0, label: 'None', tone: 'muted'};
  if (leafCount < 10) return {bars: 1, label: 'Very weak', tone: 'danger'};
  if (leafCount < 100) return {bars: 2, label: 'Weak', tone: 'danger'};
  if (leafCount < 1000) return {bars: 3, label: 'Fair', tone: 'warn'};
  if (leafCount < 10000) return {bars: 4, label: 'Strong', tone: 'accent'};
  return {bars: 5, label: 'Very strong', tone: 'accent'};
}
