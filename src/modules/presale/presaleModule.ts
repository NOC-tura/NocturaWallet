import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {parseTokenAmount} from '../../utils/parseTokenAmount';
import {PRESALE_STAGE_PRICES} from '../../constants/presale';

const TOKENS_PER_STAGE = 10_240_000;
const NOC_DECIMALS = 9;
const STAGE_CAPACITY_BASE = (BigInt(TOKENS_PER_STAGE) * 10n ** BigInt(NOC_DECIMALS)).toString();

export interface PresaleStats {
  displayStage: number; // 1-indexed (coordinator currentStage is 0-indexed)
  pricePerNocUsd: number;
  soldInStageBase: string; // NOC into the current stage, 9-dec base units
  stageCapacityBase: string; // 10,240,000 NOC in base units
  isPaused: boolean;
}

export interface UserAllocation {
  tokensPurchasedBase: string;
  referralBonusBase: string;
}

/**
 * Convert a NOC display-amount string (≤9 dp, possibly a float like
 * "839030.874670029") to base units. Goes through Number().toFixed(9) so a
 * value with >9 fractional digits (or float noise) can't make parseTokenAmount
 * throw. Non-finite / non-positive → 0n.
 */
function nocStringToBase(s: string): bigint {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) {
    return 0n;
  }
  return parseTokenAmount(n.toFixed(NOC_DECIMALS), NOC_DECIMALS);
}

/**
 * GET a coordinator JSON endpoint. Backend-first via the SSL-pinned fetch; on
 * ANY pinned-fetch failure, fall back to a plain HTTPS fetch to the SAME
 * coordinator URL (public read-only data — same posture as the other modules'
 * direct CoinGecko/Helius fallbacks). Throws only when BOTH fail.
 */
async function getCoordinatorJson(path: string): Promise<unknown> {
  try {
    const res = await pinnedFetch(`${API_BASE}${path}`);
    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      throw new Error(`presale ${path} HTTP ${res.status}`);
    }
    return res.json();
  }
}

/** Live global presale stage/price/progress from the coordinator. Throws on failure. */
export async function fetchPresaleStats(): Promise<PresaleStats> {
  const body = (await getCoordinatorJson('/stats')) as {
    success?: boolean;
    data?: {currentStage?: number; totalNocSold?: number; isPaused?: boolean};
  };
  if (!body.success || !body.data) {
    throw new Error('presale stats unsuccessful');
  }
  const idx = Math.min(Math.max(body.data.currentStage ?? 0, 0), PRESALE_STAGE_PRICES.length - 1);
  const totalNocSold = body.data.totalNocSold ?? 0;
  const intoStage = Math.max(0, totalNocSold - idx * TOKENS_PER_STAGE);
  return {
    displayStage: idx + 1,
    pricePerNocUsd: PRESALE_STAGE_PRICES[idx],
    soldInStageBase: nocStringToBase(String(intoStage)).toString(),
    stageCapacityBase: STAGE_CAPACITY_BASE,
    isPaused: body.data.isPaused === true,
  };
}

/** The user's purchased NOC, summed from the coordinator's recorded purchases. Throws on failure. */
export async function fetchUserAllocation(address: string): Promise<UserAllocation> {
  const body = (await getCoordinatorJson(`/user/${address}`)) as {
    success?: boolean;
    data?: {purchases?: Array<{noc_amount?: string; referral_bonus?: string}>};
  };
  if (!body.success || !body.data) {
    throw new Error('presale user unsuccessful');
  }
  let purchased = 0n;
  let referral = 0n;
  for (const p of body.data.purchases ?? []) {
    purchased += nocStringToBase(p.noc_amount ?? '0');
    referral += nocStringToBase(p.referral_bonus ?? '0');
  }
  return {tokensPurchasedBase: purchased.toString(), referralBonusBase: referral.toString()};
}
