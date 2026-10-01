import {useMemo} from 'react';
import qrcode from 'qrcode-generator';

/**
 * A QR code drawn as our own SVG from qrcode-generator's module matrix (spec S6: a small, reviewed,
 * zero-dependency library, pinned exact; no CDN, no canvas, no data: URL). Error correction H, so the
 * design's centre "N" mark (the `.center` overlay) never makes it unreadable.
 */
export function QrCode({value, label}: {value: string; label: string}) {
  const {size, path} = useMemo(() => {
    const qr = qrcode(0, 'H');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return {size: n + 8, path: d};
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label={label} shapeRendering="crispEdges" data-qr={value}>
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
