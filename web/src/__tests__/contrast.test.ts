import {readFileSync} from 'node:fs';

/**
 * The redesign's AA claim, checked against the tokens rather than taken on its word.
 * Text on a card must reach 4.5:1; the old tertiary grey did not (3.9:1 on the card
 * fill), which is why dates, footnotes and the disabled buy label read as faded out.
 */
const CSS = readFileSync('src/styles/design-system.css', 'utf8');

const token = (name: string): string => {
  const m = CSS.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`${name} not found as a hex token`);
  return m[1] as string;
};

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('text contrast on the card surface (WCAG AA, 4.5:1)', () => {
  it.each(['--fg-primary', '--fg-secondary', '--fg-tertiary'])('%s on --elev-1', t => {
    expect(ratio(token(t), token('--elev-1'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the disabled buy label: --fg-tertiary on --elev-2', () => {
    expect(ratio(token('--fg-tertiary'), token('--elev-2'))).toBeGreaterThanOrEqual(4.5);
  });

  it('control: the old tertiary fails on the new card, so this test can fail', () => {
    expect(ratio('#6E727A', '#111114')).toBeLessThan(4.5);
  });
});
