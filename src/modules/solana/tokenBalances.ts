import type {TokenAccount} from './types';

/**
 * Aggregate raw token-account balances into a mint → total-amount map.
 *
 * An owner can hold the same mint across several token accounts, and this
 * wallet routinely does (tokens are held in non-canonical accounts, not the
 * derived ATA). The previous `Object.fromEntries(accounts.map(...))` kept only
 * the LAST account per mint, so a funded account followed by an empty canonical
 * ATA displayed a balance of zero, and a split balance displayed only one part.
 *
 * Amounts are raw base units as decimal strings and are summed as BigInt —
 * never as Number, which loses precision above 2^53.
 */
export function sumTokenBalancesByMint(accounts: TokenAccount[]): Record<string, string> {
  const totals = new Map<string, bigint>();

  for (const account of accounts) {
    let amount: bigint;
    try {
      amount = BigInt(account.amount);
    } catch {
      // A malformed amount from the RPC must not poison the whole map.
      continue;
    }
    totals.set(account.mint, (totals.get(account.mint) ?? 0n) + amount);
  }

  const out: Record<string, string> = {};
  for (const [mint, total] of totals) {
    out[mint] = total.toString();
  }
  return out;
}
