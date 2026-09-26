/**
 * The Noctura mark: the owner's own logo, the same artwork the Android app uses for NOC
 * (src/assets/tokens/noc-logo.png), cropped to the letter and scaled to 96 px so it is
 * sharp at 44 px on a 2x screen.
 *
 * It replaces a CSS-drawn "N" lifted from the design file, which was a placeholder mark
 * and not the logo (owner, 2026-09-26). Served from our own origin (/noc-mark.png), which
 * `img-src 'self'` already allows; no third-party request.
 *
 * Decorative: the heading beside it already says "Noctura".
 */
export function BrandMark() {
  return <img className="brand-mark" src="/noc-mark.png" width={44} height={44} alt="" />;
}
