/**
 * M1d plan A11 (controller ruling on review r1 C1): where private balances exist
 * (`isShieldedEnabled()`), the pool token (A0_TOKEN, "TEST" on devnet) is a listed token of EVERY
 * account that holds it — the funds a fresh exit received must be visible (the sheet, the dashboard's
 * list, the split row) and sendable from #12. Display layer only: walletStore and forceSync are
 * untouched. The production build (no private balances) is unchanged. Pure.
 */
import {isShieldedEnabled} from '../../constants/features';
import {A0_TOKEN} from '../shielded/a0/screenSupport';
import type {TokenMetadata} from '../../store/zustand/walletStore';

const DIGITS = /^\d+$/;

export function withPoolToken<T extends {tokenBalances: Record<string, string>; tokens: TokenMetadata[]}>(
  data: T,
  enabled: boolean = isShieldedEnabled(),
): T {
  const held = data.tokenBalances[A0_TOKEN.mint];
  if (!enabled || held === undefined || !DIGITS.test(held) || BigInt(held) === 0n || data.tokens.some(t => t.mint === A0_TOKEN.mint)) {
    return data;
  }
  const pool: TokenMetadata = {mint: A0_TOKEN.mint, symbol: A0_TOKEN.symbol, name: A0_TOKEN.name, decimals: A0_TOKEN.decimals, trust: 'unknown'};
  return {...data, tokens: [...data.tokens, pool]};
}
