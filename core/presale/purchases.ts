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
  referralBonusNoc: number;
}

interface RawPurchase {
  tx_hash?: unknown;
  solana_tx_hash?: unknown;
  payment_token?: unknown;
  payment_amount?: unknown;
  noc_amount?: unknown;
  usd_value?: unknown;
  stage?: unknown;
  status?: unknown;
  created_at?: unknown;
  referral_bonus?: unknown;
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
      paymentToken: str(r.payment_token),
      paymentAmount: num(r.payment_amount),
      nocAmount: num(r.noc_amount),
      usdValue: num(r.usd_value),
      stage: num(r.stage),
      status: str(r.status),
      createdAt: str(r.created_at),
      referralBonusNoc: num(r.referral_bonus),
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
