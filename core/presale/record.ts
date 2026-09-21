import type {JsonPoster} from '../ports';

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

/**
 * Best-effort archive of a completed purchase to the coordinator. **Never throws.**
 *
 * The on-chain transaction is the source of truth; a failed archive must not look like
 * a failed purchase to the person who just paid. The swallow is the behaviour, not an
 * oversight — an earlier draft of the web client made this throw, which would have
 * shown a failure after the money had already moved.
 */
export async function recordPresalePurchase(
  post: JsonPoster,
  rec: PresalePurchaseRecord,
): Promise<void> {
  try {
    await post.post('/solana/purchase', rec);
  } catch {
    // non-critical (matches the website — the on-chain tx is the source of truth)
  }
}
