import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';

const NOC_DECIMALS = 9;

/**
 * Pure helper for the pre-TGE presale allocation card: total = purchased +
 * referral bonus (both 9-dec base-unit strings from presaleStore). Hidden when
 * the total is zero or a value is malformed.
 */
export function presaleAllocationDisplay(a: {
  tokensPurchased: string;
  referralBonusTokens: string;
}): {show: boolean; nocText: string} {
  let total: bigint;
  try {
    total = BigInt(a.tokensPurchased || '0') + BigInt(a.referralBonusTokens || '0');
  } catch {
    return {show: false, nocText: ''};
  }
  if (total <= 0n) {
    return {show: false, nocText: ''};
  }
  return {show: true, nocText: formatBalanceForDisplay(total.toString(), NOC_DECIMALS, 2)};
}
