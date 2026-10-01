import {MIN_PASSWORD_LENGTH} from '../onboarding';
import {PASSWORD} from '../strings';

/**
 * #5's length meter (D7: "the strength meter shows only the length rule"): four bars filling at 3, 6, 9
 * and 12 characters, and the label "N of 12 characters" until 12, then "Long enough". Nothing here
 * judges a password's strength — the engine's only rule is its length.
 */
export function lengthMeter(length: number): {filled: number; label: string} {
  return {filled: Math.min(4, Math.floor(length / 3)), label: length >= MIN_PASSWORD_LENGTH ? PASSWORD.longEnough : PASSWORD.lengthOf(length)};
}

/** Paints the meter's four bars (`i.filled`) and its label. */
export function renderMeter(bars: HTMLElement, label: HTMLElement, length: number): void {
  const m = lengthMeter(length);
  [...bars.children].forEach((bar, i) => bar.classList.toggle('filled', i < m.filled));
  label.textContent = m.label;
}
