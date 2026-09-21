import {API_BASE} from '../../constants/programs';
import {getCoordinatorJson} from '../backend/coordinatorClient';
import {
  fetchPresaleStats as coreFetchPresaleStats,
  nocStringToBase,
  type PresaleStats,
} from '../../../core/presale/stats';

export type {PresaleStats};

/** The app's transport, handed to core: certificate-pinned, bare paths. */
const appJson = {get: <T,>(path: string) => getCoordinatorJson(path) as Promise<T>};

export interface UserAllocation {
  tokensPurchasedBase: string;
  referralBonusBase: string;
}

/** Live global presale stage/price/progress from the coordinator. Throws on failure. */
export const fetchPresaleStats = () => coreFetchPresaleStats(appJson);

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

export interface PresalePurchaseRecord {
  txHash: string;
  buyerAddress: string;
  paymentToken: 'SOL' | 'USDC' | 'USDT';
  paymentAmount: number;
  nocAmount: number;
  usdValue: number;
  stage: number;
  referrerAddress?: string;
}

/** Best-effort archive of a completed purchase to the coordinator. Never throws. */
export async function recordPresalePurchase(rec: PresalePurchaseRecord): Promise<void> {
  try {
    await fetch(`${API_BASE}/solana/purchase`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(rec),
    });
  } catch {
    // non-critical (matches the website — the on-chain tx is the source of truth)
  }
}
