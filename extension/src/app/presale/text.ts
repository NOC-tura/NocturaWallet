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
  /** As drawn (index.html 23b: "3 of 10 · @ $ 0.025") — the row's label already says "Stage". */
  stageRow: (stage: number, price: string): string => `${stage} of 10 · @ ${price}`,
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

/**
 * #20's purchase variant (§4.2; Q07–Q10, Q44 — controller copy, owner-delegated 2026-10-19; §4.2's own row labels and
 * B1b's #20 labels where it keeps them). Q57 and Q58 are new in B1d-1b Task 5 — controller copy, flagged to the owner:
 * B1b's "You have a send waiting." and "Confirmed. Review the fresh quote and send." name a send.
 */
export const CONFIRM_PURCHASE_TEXT = {
  /** Q07, Q08. */
  title: 'Confirm purchase',
  about: 'You are about to buy',
  receive: 'You receive (est.)',
  stage: 'Stage',
  stageOf: (stage: number): string => `${stage} of 10`,
  price: 'Price',
  perNoc: (price: string): string => `${price} / NOC`,
  from: 'From',
  to: 'To',
  /** Q10. */
  presale: 'Noctura presale',
  fees: 'Fees',
  networkFee: 'Network fee',
  priority: 'Priority',
  /** Q09. */
  setup: 'Account setup (first purchase)',
  total: 'Total',
  /** §4.2's "Simulation" receipt block with Q44 (#19's facts, C33). */
  simulation: 'Simulation',
  slot: (slot: string): string => `Simulated at slot ${slot}`,
  programs: 'Programs',
  programsValue: 'Compute Budget · Noctura presale',
  buy: 'Buy NOC',
  quote: (seconds: number): string => `Quote valid ${seconds} s`,
  /** Q57 (new, flagged). */
  resume: 'You have a purchase waiting.',
  /** Q58 (new, flagged). */
  confirmed: 'Confirmed. Review the fresh quote and buy.',
} as const;

/**
 * A purchase record on #21, #44 and #54 (§4.2; Q31, Q32 — controller copy, owner-delegated 2026-10-19). Q53–Q55 are new
 * in B1d-1b Task 5 — controller copy, flagged to the owner: they replace B1b's send words ("Sending…", "Sent", "Sent
 * successfully", "…the amount did not move") that the generic rendering (Q42) keeps.
 */
const RECORD_LEAD = 'Buying NOC with';
export const RECORD_TEXT = {
  /** Q31. */
  badge: 'Presale',
  /** Q32, and its words before the amount (#21's amount card sets them as the eyebrow). */
  line: (amount: string, currency: PresaleCurrency): string => `${RECORD_LEAD} ${amount} ${currency}`,
  lead: RECORD_LEAD,
  /** Q53. */
  sending: 'Buying NOC…',
  /** Q54 a, b. */
  sent: 'Purchased',
  sentOk: 'Purchase confirmed',
  /** Q55. */
  rejectedSub: 'The presale program returned an error. The network fee was charged; no NOC was bought.',
  /** Q33 (#11's and #26's pending row, B1d-1b Task 6). */
  pending: 'Buying NOC · pending',
  slow: 'Buying NOC · taking longer than usual',
} as const;

/** #11's presale banner (§4.5, index.html #11 ix:6371-6373): "NOC Presale · Stage N" / "$ 0.1501 · P% to next stage". */
export const BANNER_TEXT = {
  title: (stage: number): string => `NOC Presale · Stage ${stage}`,
  line: (price: string, percent: number): string => `${price} · ${percent}% to next stage`,
} as const;

/**
 * #50b region blocked, presale (§4.3, index.html #50 ix 19612-19906): the design's own lines where §4.3 keeps them, the
 * approved lines and Q20–Q30 (controller copy, owner-delegated 2026-10-19) where it replaces them. Nothing here names a
 * claim, a stake or a date: §9 omits the drawn "Stake existing NOC", the post-TGE claim line and "claim_ix".
 */
export const GEO_TEXT = {
  title: 'Not available here',
  close: 'Close',
  /** Q20 (C18): the gate is open. */
  open: 'NOC presale is open in your region',
  sanctioned: "NOC presale isn't open in your region",
  /** Q23: every fail-closed reason. */
  closed: "The presale can't be opened right now",
  region: (name: string): string => `Detected region: ${name}`,
  disclosure: 'Approximated from your IP. No GPS, no device location.',
  geofence: 'Presale geofence active',
  /** Q22. */
  geofenceSub: 'Checked by this wallet against the restricted-region list',
  /** Q24, Q25, Q27. */
  checkRequired: 'Region check required',
  checkRequiredSub: 'The presale opens only after a successful check against a current list',
  refusedSub: "Noctura's server did not answer requests from this network",
  why: 'Why this matters',
  /** Q28. */
  whySub: 'Token sales are restricted by jurisdiction · this wallet checks before every purchase',
  /** Q29. */
  lifts: 'If the restricted-region list changes, this screen lifts on its own.',
  rechecked: 'Re-checked at every presale screen mount.',
  works: 'What still works',
  sendReceive: 'Send / Receive NOC',
  /** Q30. */
  balances: 'View balances',
  gotIt: 'Got it',
} as const;

/** #50b's sub for each closed reason (§4.3): Q21 for `sanctioned`, the approved lines, Q26 for an unknown country. */
export const GEO_SUB_TEXT: Record<GeoReason, string> = {
  sanctioned: "This wallet doesn't offer the presale in your region. You can still hold, send and receive any NOC you already have.",
  stale_list: 'The restricted-region list is out of date.',
  unknown_country: 'Your region could not be determined from your IP.',
  no_check: 'The region check is unavailable — try again later.',
  refused: 'The presale service refused this network.',
};

/** The reason of a closed region answer, as #50b's sub says it (§4.3; for `sanctioned`, Q21's first sentence). */
export const GEO_REASON_TEXT: Record<GeoReason, string> = {...GEO_SUB_TEXT, sanctioned: "This wallet doesn't offer the presale in your region."};

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
