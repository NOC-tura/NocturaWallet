/**
 * USD price per NOC by presale stage. Display stages are 1-indexed; the array
 * is 0-indexed. Each stage sells 10,240,000 NOC. NOC is presale-only (not on a
 * market), so the wallet uses these prices for NOC's USD value until the
 * presale store is wired to live on-chain stage data.
 */
export const PRESALE_STAGE_PRICES: readonly number[] = [
  0.1501, 0.1723, 0.1945, 0.2167, 0.2389,
  0.2611, 0.2833, 0.3055, 0.3277, 0.3499,
];

/** Resolve the NOC USD price for a 1-indexed stage, defaulting to stage 1. */
export function nocUsdPriceForStage(stage: number | null): number {
  if (stage == null || stage < 1 || stage > PRESALE_STAGE_PRICES.length) {
    return PRESALE_STAGE_PRICES[0];
  }
  return PRESALE_STAGE_PRICES[stage - 1];
}
