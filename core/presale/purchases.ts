import type {JsonGetter} from '../ports';

/**
 * The buyer's own purchases, one row each, from `GET /user/:address`.
 *
 * This exists because the page could show someone a total and nothing else. After a
 * purchase the signature appeared once and was gone on reload, so a buyer who closed the
 * tab had no record on this site that their money had moved — only an allocation, which
 * is a sum with no items. The signature is the part they can check against the chain
 * themselves, which is the only kind of proof worth offering.
 *
 * Shape confirmed against the live endpoint 2026-09-22, not read from a document.
 */
export interface PresalePurchase {
  /** The Solana signature. `solana_tx_hash` when present, else `tx_hash`. */
  signature: string;
  /**
   * 'solana' | 'ethereum' | 'bnb' — which chain this hash belongs to, as recorded.
   *
   * Carried because everything this page does with a hash is chain-specific: asking
   * Solana whether it has an Ethereum transaction gets "no", and "no" is rendered as an
   * accusation that no payment was taken. Unknown is deliberately NOT read as 'solana':
   * saying less is the safe failure here, saying the wrong thing is not.
   */
  chain: string;
  /** 'SOL' | 'USDC' | 'USDT' — as the coordinator recorded it. */
  paymentToken: string;
  /** Paid, in whole tokens. */
  paymentAmount: number;
  /** Received, in whole NOC. */
  nocAmount: number;
  usdValue: number;
  stage: number;
  /** 'confirmed' and anything else the coordinator may say. Rendered, never interpreted. */
  status: string;
  /** ISO 8601, as recorded. */
  createdAt: string;
  /**
   * The coordinator's own sentence for a non-`confirmed` status, or '' when it set none.
   *
   * Authored by whoever set the status, stored on the row, and rendered verbatim. Since
   * 2026-09-22 the coordinator refuses to write `not_on_chain` or `not_credited` without
   * one, so in practice these arrive together. '' is still handled, because a guarantee
   * on the writing side is not a guarantee about what arrives over a network.
   */
  statusReason: string;
}

/*
 * `referral_bonus` is deliberately NOT parsed into the type above.
 *
 * The coordinator writes 10% onto every referred purchase; the program awards the bonus
 * ONCE, on the referred buyer's first purchase, and says so in the logs of the others
 * ("Referral bonus skipped - not first purchase"). Measured across five referrers on
 * 2026-09-22 the column totals 1,155.75 NOC against 311.66 actually credited on chain —
 * and for one referrer it runs the other way, 80.49 recorded against 120.79 on chain.
 * It is not a record of what was paid in either direction.
 *
 * The number that IS a record is `PresaleAllocation.referral_bonus_tokens`, read from the
 * account in core/presale/allocation.ts and shown under the allocation. A field nobody
 * should trust, sitting in a type, is a field somebody renders later.
 */

interface RawPurchase {
  chain?: unknown;
  tx_hash?: unknown;
  solana_tx_hash?: unknown;
  payment_token?: unknown;
  payment_amount?: unknown;
  noc_amount?: unknown;
  usd_value?: unknown;
  stage?: unknown;
  status?: unknown;
  status_reason?: unknown;
  created_at?: unknown;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Newest first, and rows without a signature are dropped rather than rendered.
 *
 * A row with no signature is a record of something that may not have happened: the
 * coordinator's own notes record purchases marked `completed` carrying no signature at
 * all. Showing one on a page whose whole purpose is proof would be worse than showing
 * nothing — the reader cannot tell it apart from a real one.
 */
export function parsePurchases(body: unknown): PresalePurchase[] {
  const data = (body as {success?: boolean; data?: {purchases?: unknown}})?.data;
  const rows = Array.isArray(data?.purchases) ? (data.purchases as RawPurchase[]) : [];

  return rows
    .map(r => ({
      signature: str(r.solana_tx_hash) || str(r.tx_hash),
      chain: str(r.chain),
      paymentToken: str(r.payment_token),
      paymentAmount: num(r.payment_amount),
      nocAmount: num(r.noc_amount),
      usdValue: num(r.usd_value),
      stage: num(r.stage),
      status: str(r.status),
      createdAt: str(r.created_at),
      statusReason: str(r.status_reason),
    }))
    .filter(p => p.signature !== '')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Fetch and parse. Throws when the call fails; an empty list means "none", not "unknown". */
export async function fetchPurchases(get: JsonGetter, address: string): Promise<PresalePurchase[]> {
  const body = await get.get<unknown>(`/user/${address}`);
  if (!(body as {success?: boolean})?.success) {
    throw new Error('purchase history unsuccessful');
  }
  return parsePurchases(body);
}
