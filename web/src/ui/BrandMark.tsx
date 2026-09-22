/**
 * The Noctura mark, copied from screen #1 of the design file — a rounded square carrying
 * two radial washes, purple from the top-left and teal from the bottom-right, with a
 * gradient-clipped "N" over it.
 *
 * It is pure CSS in the original and stays pure CSS here: no image asset, so no request,
 * no bundle weight, and it scales to any size without a second file. The two colours are
 * the DS accents at reduced alpha — the mark carries the dual-mode identity (transparent
 * purple, shielded teal) that the product is built around, which is exactly why the
 * design file draws it this way rather than as a flat logo.
 */
export function BrandMark({size = 40}: {size?: number}) {
  return (
    <span
      className="brand-mark"
      style={{width: size, height: size, borderRadius: size * 0.29}}
      aria-hidden
    >
      <span className="brand-mark-n" style={{fontSize: size * 0.5}}>
        N
      </span>
    </span>
  );
}
