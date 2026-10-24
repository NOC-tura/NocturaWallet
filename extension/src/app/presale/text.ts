import {formatAmount} from '../../shared/amount';
import type {GeoReason, PresaleCurrency} from './client';

/**
 * #23's strings (B1d §4.1, §10 — controller copy, owner-delegated 2026-10-19; the design's own where §4.1 keeps it) and
 * its number formats. Integer arithmetic on what the background answered, every division floored (cardinal rule 2):
 * the popup formats, it never prices, limits or estimates.
 */
export const PRESALE_TEXT = {
  title: 'NOC presale',
  liveEyebrow: (stage: number): string => `Stage ${stage} of 10 · live`,
  closedEyebrow: (stage: number): string => `Stage ${stage} of 10`,
  perNoc: '/ NOC',
  raised: ' raised',
  /** Q01's words after the cap ("10.24 M NOC stage cap"). */
  stageCap: ' stage cap',
  nextStage: 'Next stage ',
  youPay: 'YOU PAY',
  available: 'Available ',
  youReceive: 'YOU RECEIVE (EST.)',
  /** Q02 / Q03. */
  receiveSol: (price: string, sol: string): string => `@ ${price} · 1 SOL ≈ ${sol}`,
  receiveStable: (price: string): string => `@ ${price}`,
  /** Q04, and D5's only TGE copy. */
  allocation: 'Your allocation',
  claimable: 'Claimable after TGE',
  region: 'Not available in your region?',
  buy: (estimate: string): string => `Buy ${estimate} NOC`,
  buyPlain: 'Buy NOC',
  max: 'MAX',
  currency: (c: PresaleCurrency): string => `Currency: ${c}`,
  orderPending: 'Order pending',
  /** Q05. */
  waiting: 'Waiting for confirmation. Claimable after TGE.',
  paid: 'Paid',
  estimated: 'Estimated NOC',
  stage: 'Stage',
  stageRow: (stage: number, price: string): string => `Stage ${stage} of 10 · @ ${price}`,
  txHash: 'Tx hash',
  /** Q06. */
  closeNote: 'You can close the popup — Noctura keeps watching this purchase. Funds are non-refundable per presale terms.',
  explorer: 'View on Solana explorer',
  done: 'Done',
  /** Q11–Q16, Q19, Q43, Q52. */
  unavailable: 'Presale unavailable — try again later.',
  refused: 'The presale service refused this network.',
  inactive: 'The presale is not open.',
  blocked: "This account can't buy in the presale.",
  priceChanged: 'Price changed — review again',
  notSimulated: 'The purchase could not be simulated.',
  noSolPrice: 'SOL price unavailable — pay with USDC or USDT, or try again later.',
  accountChanged: 'Your presale account changed — review again',
  busy: 'The presale is busy right now — try again.',
  /** Q40 a–c. */
  belowMin: (min: string): string => `Minimum ${min}`,
  aboveMaxTx: (max: string): string => `Maximum ${max} per transaction`,
  aboveUser: (remaining: string): string => `Above your presale limit — you can buy up to ${remaining} more`,
  /** Q41 a–d. */
  insufficient: (c: PresaleCurrency): string => `Insufficient ${c} balance`,
  feeSol: 'Need a little SOL for the network fee',
  split: (c: PresaleCurrency, most: string): string => `Your ${c} is split across accounts — at most ${most} ${c} in one purchase`,
  keepRent: 'Keep at least 0.00089088 SOL, or buy with less',
  /** §4.1's closed line for a region answer, "Not available here — <reason>" (the reason in #50b's own words, §4.3). */
  regionLine: (reason: string): string => `Not available here — ${reason}`,
} as const;

/** The reason of a closed region answer, as #50b's sub says it (§4.3; for `sanctioned`, Q21's first sentence). */
export const GEO_REASON_TEXT: Record<GeoReason, string> = {
  sanctioned: "This wallet doesn't offer the presale in your region.",
  stale_list: 'The restricted-region list is out of date.',
  unknown_country: 'Your region could not be determined from your IP.',
  no_check: 'The region check is unavailable — try again later.',
  refused: 'The presale service refused this network.',
};

const group = (v: bigint): string => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** The program's price, ten-thousandths of a dollar, to its four places: "$ 0.1501". */
export const priceText = (ticks: bigint): string => `$ ${formatAmount(ticks, 4, {min: 4, max: 4})}`;

/** §4.1's raised figure, floored: "$ 1.55 M" from a million dollars on, "$ 12,345" below. */
export function raisedText(cents: bigint): string {
  const dollars = cents / 100n;
  return dollars >= 1_000_000n ? `$ ${formatAmount(dollars / 10_000n, 2, {min: 2, max: 2})} M` : `$ ${group(dollars)}`;
}

/** A NOC amount in millions, floored: "10.24 M NOC" (Q01's cap). */
export const millionsNoc = (base: bigint): string => `${formatAmount(base / 10n ** 13n, 2, {min: 2, max: 2})} M NOC`;

/** A limit in dollars, as core's lines write it: "$10", "$50,000", "$199,700.50" — whole dollars without cents. */
export const dollarsText = (cents: bigint): string => (cents % 100n === 0n ? `$${group(cents / 100n)}` : `$${formatAmount(cents, 2, {min: 2, max: 2})}`);

/** USD per SOL from the view's micro-dollars, floored to the cent: "$ 198.42". */
export const solPriceText = (micros: bigint): string => `$ ${formatAmount(micros / 10_000n, 2, {min: 2, max: 2})}`;

/** The stage bar's fill, a CSS width: sold / cap, floored to a hundredth of a percent, at most 100 %. */
export function fillWidth(sold: bigint, cap: bigint): string {
  const bp = (sold * 10_000n) / cap;
  const clamped = bp > 10_000n ? 10_000n : bp;
  return `${formatAmount(clamped, 2, {min: 0, max: 2})}%`;
}

/** 23b's Tx hash as drawn: the first 4 and the last 6 characters ("5x9k…u3Dj2P"). */
export const shortSignature = (signature: string): string => `${signature.slice(0, 4)}…${signature.slice(-6)}`;
