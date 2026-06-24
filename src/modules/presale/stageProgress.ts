import {PRESALE_STAGE_PRICES} from '../../constants/presale';

const NOC_DECIMALS = 9;
const TOTAL_STAGES = PRESALE_STAGE_PRICES.length;

/** Compact NOC label ("9.4M", "950K", "500"). */
function compactNoc(value: number): string {
  if (!isFinite(value) || value <= 0) {
    return '0';
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return `${Math.round(value)}`;
}

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

/**
 * Pure helper for the #23 stage card's SECOND meta row: next-stage price (+%
 * increase) on the left, NOC remaining in the current stage on the right.
 * `currentStage` is 1-indexed (presaleStore). The next price comes from
 * PRESALE_STAGE_PRICES; at the final stage there is no next price. The right
 * side replaces the design's fictional "Ends in N days" — the presale is
 * sold-out-based (no stage end date exists on-chain), so we show how much NOC
 * is left in the stage, which is what actually triggers the next price.
 * Hidden when stage capacity data is missing/non-positive.
 */
export function stageSecondRow(s: {
  currentStage: number | null;
  soldInStage: string | null;
  stageCapacity: string | null;
}): {
  show: boolean;
  isFinalStage: boolean;
  nextPriceText: string;
  nextPctText: string;
  nocLeftText: string;
} {
  const hidden = {
    show: false,
    isFinalStage: false,
    nextPriceText: '',
    nextPctText: '',
    nocLeftText: '',
  };

  const soldNoc = Number(s.soldInStage) / 10 ** NOC_DECIMALS;
  const capNoc = Number(s.stageCapacity) / 10 ** NOC_DECIMALS;
  if (!isFinite(soldNoc) || !isFinite(capNoc) || capNoc <= 0) {
    return hidden;
  }

  const stage = s.currentStage ?? 1; // 1-indexed
  const isFinalStage = stage >= TOTAL_STAGES;
  let nextPriceText = '';
  let nextPctText = '';
  if (!isFinalStage && stage >= 1) {
    const cur = PRESALE_STAGE_PRICES[stage - 1];
    const next = PRESALE_STAGE_PRICES[stage];
    nextPriceText = `$${next}`;
    nextPctText = `+${Math.round(((next - cur) / cur) * 100)}%`;
  }

  const left = Math.max(0, capNoc - soldNoc);
  return {
    show: true,
    isFinalStage,
    nextPriceText,
    nextPctText,
    nocLeftText: compactNoc(left), // compact NOC value; the " NOC left" label is added by the view
  };
}
