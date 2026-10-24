import {formatAmount} from '../shared/amount';
import {REAUTH} from './strings';
import type {OtherDescription} from './challenge';

/**
 * B1d §1.1, §4.2: the vault page's presale entry — #10's description of a challenge whose kind is none of the shared ones
 * (challenge.ts `describeChallenge` asks it last). The build without presale resolves it to `src/presale-off/unlock.ts`,
 * which describes nothing. It describes a `presale-buy` challenge (the background's `PurchaseAbout`) and nothing else,
 * re-validated here against a closed alphabet before any text is built, as challenge.ts does for a send: exactly the
 * record's keys, the currency in this page's own three-entry table, amounts ^\d{1,20}$ (the payment a positive one),
 * the stage an integer 0–9, addresses the base58 alphabet at 32–44 characters, the priority no larger than the network
 * fee it is part of, the threshold an integer in range, and the reasons a non-empty list of known codes, each once.
 * Anything else is null: #10 then offers only Cancel. Header Q18 (as #10's eyebrow and its headline amount), the rows
 * of #20's purchase variant, reason lines Q17 and B1b's (controller copy, owner-delegated 2026-10-19); Q56 — new in
 * B1d-1b Task 5, flagged to the owner — the line once Cancel discarded the purchase (B1b's names a send).
 */
const CURRENCIES = {SOL: 9, USDC: 6, USDT: 6} as const;
const DIGITS = /^\d{1,20}$/;
const AMOUNT = /^[1-9]\d{0,19}$/;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const KEYS = ['account', 'amount', 'currency', 'destination', 'kind', 'networkLamports', 'nocBase', 'priceTicks', 'priorityLamports', 'reasons', 'rentLamports', 'spentCents', 'stage', 'thresholdCents'];
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const PURCHASE_TEXT = {
  /** Q18, as #10 draws it: the eyebrow, then the amount and its currency as the headline. */
  about: 'Confirm buying NOC with',
  receive: 'You receive (est.)',
  stage: 'Stage',
  stageOf: (stage: number): string => `${stage} of 10`,
  price: 'Price',
  perNoc: (ticks: bigint): string => `$ ${formatAmount(ticks, 4, {min: 4, max: 4})} / NOC`,
  /** Q09. */
  setup: 'Account setup (first purchase)',
  /** Q10. */
  presale: 'Noctura presale',
  /** Q17. */
  firstPurchase: 'Re-auth required for your first presale purchase from this account.',
  /** Q56 (new, flagged). */
  cancelled: 'Purchase cancelled. Nothing was sent.',
} as const;

const sol = (lamports: bigint): string => `${formatAmount(lamports, 9, {min: 0, max: 9})} SOL`;
const dollars = (cents: number): string => formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2});

export function describePresale(about: Readonly<Record<string, unknown>>): OtherDescription | null {
  if (about.kind !== 'presale-buy' || Object.keys(about).sort().join(',') !== KEYS.join(',') || !KEYS.every(k => own(about, k))) return null;
  const {account, destination, currency, amount, stage, priceTicks, nocBase, spentCents, networkLamports, priorityLamports, rentLamports, reasons, thresholdCents} = about;
  if (typeof account !== 'string' || !ADDRESS.test(account) || typeof destination !== 'string' || !ADDRESS.test(destination)) return null;
  if (typeof currency !== 'string' || !own(CURRENCIES, currency)) return null;
  if (typeof amount !== 'string' || !AMOUNT.test(amount)) return null;
  if (typeof stage !== 'number' || !Number.isSafeInteger(stage) || stage < 0 || stage > 9) return null;
  if (![priceTicks, nocBase, spentCents, networkLamports, priorityLamports, rentLamports].every(v => typeof v === 'string' && DIGITS.test(v))) return null;
  const network = BigInt(networkLamports as string);
  const priority = BigInt(priorityLamports as string);
  const rent = BigInt(rentLamports as string);
  // The priority is a part of the network fee: a larger one describes no real transaction (fail closed).
  if (priority > network) return null;
  if (typeof thresholdCents !== 'number' || !Number.isSafeInteger(thresholdCents) || thresholdCents < 100 || thresholdCents > 100_000) return null;
  // The background issues a purchase challenge only for at least one reason, each once (buy.ts presaleReauthReasons).
  if (!Array.isArray(reasons) || reasons.length === 0 || new Set(reasons).size !== reasons.length) return null;
  const lines: string[] = [];
  for (const r of reasons as unknown[]) {
    if (r === 'first-purchase') lines.push(PURCHASE_TEXT.firstPurchase);
    else if (r === 'over-5-percent') lines.push(REAUTH.reason['over-5-percent']);
    else if (r === 'over-usd-threshold') lines.push(REAUTH.overUsd(dollars(thresholdCents)));
    else return null;
  }
  const symbol = currency as keyof typeof CURRENCIES;
  const decimals = CURRENCIES[symbol];
  const rows: OtherDescription['rows'] = [
    {label: PURCHASE_TEXT.receive, value: `${formatAmount(BigInt(nocBase as string), 9, {min: 2, max: 2})} NOC`, address: null},
    {label: PURCHASE_TEXT.stage, value: PURCHASE_TEXT.stageOf(stage + 1), address: null},
    {label: PURCHASE_TEXT.price, value: PURCHASE_TEXT.perNoc(BigInt(priceTicks as string)), address: null},
    {label: REAUTH.to, value: PURCHASE_TEXT.presale, address: destination},
    {label: REAUTH.networkFee, value: sol(network - priority), address: null},
    {label: REAUTH.priority, value: sol(priority), address: null},
  ];
  if (rent > 0n) rows.push({label: PURCHASE_TEXT.setup, value: sol(rent), address: null});
  return {
    kind: 'other',
    account,
    about: PURCHASE_TEXT.about,
    amount: formatAmount(BigInt(amount), decimals, {min: symbol === 'SOL' ? 4 : 2, max: decimals}),
    symbol,
    rows,
    reasons: lines,
    cancelled: PURCHASE_TEXT.cancelled,
  };
}
