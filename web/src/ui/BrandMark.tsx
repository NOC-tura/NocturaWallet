/**
 * The Noctura mark, copied from screen #1 of the design file — a rounded square carrying
 * two radial washes, purple from the top-left and teal from the bottom-right, with a
 * gradient-clipped "N" over it.
 *
 * It is pure CSS in the original and stays pure CSS here: no image asset, so no request,
 * no bundle weight. The two colours are the DS accents at reduced alpha — the mark carries
 * the dual-mode identity (transparent purple, shielded teal) that the product is built
 * around, which is exactly why the design file draws it this way rather than as a flat
 * logo.
 *
 * One size, set in the stylesheet (.brand-mark). It used to take a `size` prop applied as
 * an inline style, which is the one kind of style the CSP should not have to allow, for a
 * mark the page only ever draws at 44 px.
 */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <span className="brand-mark-n">N</span>
    </span>
  );
}
