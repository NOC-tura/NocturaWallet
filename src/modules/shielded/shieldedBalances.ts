import {getBalance} from './noteStore';
import {poolTokenMeta, type PoolTokenMeta} from './poolTokens';
import {SHIELDED_POOL_MINTS} from '../../constants/programs';
import {mmkvSecure} from '../../store/mmkv/instances';

export interface ShieldedBalanceRow extends PoolTokenMeta {
  amount: bigint; // raw units
}

/**
 * The user's shielded balance per pool mint (sum of unspent notes). Returns a
 * row per configured pool mint (amount 0n when nothing shielded). Reads the local
 * encrypted note store; if it isn't initialized yet, returns all-zero rows
 * (empty state) rather than throwing.
 */
export function getShieldedBalances(): ShieldedBalanceRow[] {
  const ready = mmkvSecure() !== null;
  return SHIELDED_POOL_MINTS.map(mint => {
    const meta = poolTokenMeta(mint);
    const amount = ready ? getBalance(mint) : 0n;
    return {...meta, amount};
  });
}
