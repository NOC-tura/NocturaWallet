/** The design's shimmer placeholders (`.skel-line`, `.skel-circle`). Decorative: hidden from screen readers. */
export function SkelLine({width, height = 12}: {width: number; height?: number}) {
  return <span className="skel-line" aria-hidden="true" style={{display: 'block', width, height}} />;
}
export function SkelCircle({size = 36}: {size?: number}) {
  return <span className="skel-circle" aria-hidden="true" style={{display: 'block', width: size, height: size}} />;
}
