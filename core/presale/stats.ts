import type {JsonGetter} from '../ports';
import {parseTokenAmount} from '../util/parseTokenAmount';
import {PRESALE_STAGE_PRICES, TOKENS_PER_STAGE} from './stagePrices';

const NOC_DECIMALS = 9;
const STAGE_CAPACITY_BASE = (BigInt(TOKENS_PER_STAGE) * 10n ** BigInt(NOC_DECIMALS)).toString();

export interface PresaleStats {
  displayStage: number; // 1-indexed (coordinator currentStage is 0-indexed)
  pricePerNocUsd: number;
  soldInStageBase: string; // NOC into the current stage, 9-dec base units
  stageCapacityBase: string; // 10,240,000 NOC in base units
  isPaused: boolean;
}

/**
 * Convert a NOC display-amount string (≤9 dp, possibly a float like
 * "839030.874670029") to base units. Goes through Number().toFixed(9) so a value with
 * >9 fractional digits (or float noise) can't make parseTokenAmount throw.
 * Non-finite / non-positive → 0n.
 */
export function nocStringToBase(s: string): bigint {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) {
    return 0n;
  }
  return parseTokenAmount(n.toFixed(NOC_DECIMALS), NOC_DECIMALS);
}

/**
 * Live global presale stage/price/progress. Throws on failure — a wallet that quotes
 * stage 1 at full price because the backend was unreachable is worse than one that
 * says it does not know.
 */
export async function fetchPresaleStats(json: JsonGetter): Promise<PresaleStats> {
  const body = await json.get<{
    success?: boolean;
    data?: {currentStage?: number; totalNocSold?: number; isPaused?: boolean};
  }>('/stats');
  if (!body.success || !body.data) {
    throw new Error('presale stats unsuccessful');
  }
  const idx = Math.min(Math.max(body.data.currentStage ?? 0, 0), PRESALE_STAGE_PRICES.length - 1);
  const totalNocSold = body.data.totalNocSold ?? 0;
  const intoStage = Math.max(0, totalNocSold - idx * TOKENS_PER_STAGE);
  return {
    displayStage: idx + 1,
    pricePerNocUsd: PRESALE_STAGE_PRICES[idx] as number,
    soldInStageBase: nocStringToBase(String(intoStage)).toString(),
    stageCapacityBase: STAGE_CAPACITY_BASE,
    isPaused: body.data.isPaused === true,
  };
}
