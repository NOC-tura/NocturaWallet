const NOC_DECIMALS = 9;

/**
 * Compact USD label matching the #23 design ("$1.55M", "$5.00M", "$25").
 * Avoids Number.toLocaleString (broken under Hermes for grouping).
 */
function compactUsd(value: number): string {
  if (!isFinite(value) || value <= 0) {
    return '$0';
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${Math.round(value)}`;
}

/**
 * Pure helper for the presale stage progress bar (#23). Computes the fill
 * percent from NOC sold-in-stage / stage capacity, plus the USD "raised" and
 * "stage cap" meta labels (NOC × price). All inputs are presaleStore fields:
 * `soldInStage`/`stageCapacity` are 9-dec NOC base-unit strings, `pricePerNoc`
 * is a USD-per-NOC string. Hidden when data is missing/malformed or the
 * capacity/price is non-positive.
 */
export function stageProgressDisplay(s: {
  soldInStage: string | null;
  stageCapacity: string | null;
  pricePerNoc: string | null;
}): {show: boolean; percent: number; raisedText: string; capText: string} {
  const hidden = {show: false, percent: 0, raisedText: '', capText: ''};

  const soldNoc = Number(s.soldInStage) / 10 ** NOC_DECIMALS;
  const capNoc = Number(s.stageCapacity) / 10 ** NOC_DECIMALS;
  const price = Number(s.pricePerNoc);

  if (
    !isFinite(soldNoc) ||
    !isFinite(capNoc) ||
    !isFinite(price) ||
    capNoc <= 0 ||
    price <= 0
  ) {
    return hidden;
  }

  const percent = Math.min(100, Math.max(0, Math.round((soldNoc / capNoc) * 1000) / 10));
  return {
    show: true,
    percent,
    raisedText: compactUsd(soldNoc * price),
    capText: compactUsd(capNoc * price),
  };
}
