/**
 * A sparkline, drawn by hand rather than with a charting library.
 *
 * A dependency for this would bring a rendering engine, its own theming, and — in every
 * case I checked — its own fonts or CDN assets, onto a page whose build gate refuses
 * third-party hosts. The whole drawing is one polyline and one fill.
 *
 * The scale is the series' own min and max, so the shape is the shape of the week and
 * not of an axis starting at zero. That is the right choice for a sparkline and the wrong
 * one for a bar chart, which is why this is deliberately not one: it carries no numbers
 * of its own, and the figure it belongs to is printed beside it.
 */
export function Sparkline({
  points,
  width = 96,
  height = 28,
  label,
}: {
  points: number[];
  width?: number;
  height?: number;
  label: string;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1; // a flat week must not divide by zero
  const step = points.length > 1 ? width / (points.length - 1) : width;

  // 1px of padding top and bottom, so the extremes are not clipped by the stroke.
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2);
  const line = points.map((v, i) => `${(i * step).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const rising = (points.at(-1) as number) >= (points[0] as number);

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      focusable="false"
    >
      <polyline
        points={`0,${height} ${line} ${width},${height}`}
        fill={rising ? 'var(--spark-up-fill)' : 'var(--spark-down-fill)'}
        stroke="none"
      />
      <polyline
        points={line}
        fill="none"
        stroke={rising ? 'var(--success)' : 'var(--danger)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
