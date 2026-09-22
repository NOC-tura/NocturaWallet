/**
 * Six icons, copied path-for-path out of the design file's sprite
 * (/home/user/Downloads/index.html, the 83-symbol `<symbol id="i-*">` block).
 *
 * Copied rather than fetched: an icon font or a CDN sprite would be a third-party request
 * on a page whose whole premise is that it makes none, and the build gate would refuse the
 * host anyway. Six inline paths cost about 700 bytes.
 *
 * Copied rather than redrawn, for the same reason the tokens were: a stroke width or a
 * corner radius that merely resembles the design is how the phone and the web start
 * looking like two products. Every icon here keeps the sprite's `stroke-width: 1.75`,
 * round caps and round joins.
 *
 * `currentColor` throughout, so an icon takes the colour of the text it sits beside and
 * the shielded accent would carry into them without a second definition.
 */

export type IconName = 'key' | 'shield-check' | 'clock' | 'users' | 'pie' | 'trend-up';

const PATHS: Record<IconName, React.ReactNode> = {
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="m10 13 9-9 3 3-3 3 2 2-3 3-2-2-3 3" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <polyline points="9 12 11 14 15 10" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  pie: (
    <>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </>
  ),
  'trend-up': (
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),
};

/**
 * Decorative by default. Every icon on this page sits beside a word that already says
 * what it means, so announcing it again is noise in a screen reader — `aria-hidden`
 * unless a caller passes a label, which is the case where the icon carries the meaning
 * alone.
 */
export function Icon({
  name,
  size = 14,
  label,
}: {
  name: IconName;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
