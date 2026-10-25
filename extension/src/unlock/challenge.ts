import {formatAmount} from '../shared/amount';
import {SITE} from '../shared/site';
import {REAUTH} from './strings';
import {describePresale} from './presale';
import type {Send} from './types';

/**
 * #10's description of a re-authentication (spec B1b-2a E3). The vault page takes the challenge ID
 * from its URL and the description ONLY from the background (vault.challengeInfo), and renders nothing
 * untrusted: every field is re-validated here against a closed alphabet before any text is built —
 * the token in this page's own four-entry table, amounts ^\d{1,20}$, addresses the base58 alphabet at
 * 32–44 characters, the priority no larger than the network fee it is part of, each reason and fee
 * reason one of its known codes mapped to a fixed string, thresholds integers in range, and exactly the
 * record's keys. Anything else is null: #10 then shows
 * "The details of this action could not be shown." with only Cancel — it never offers a confirmation
 * it cannot describe.
 */
const TOKENS = {SOL: 9, NOC: 9, USDC: 6, USDT: 6} as const;
export type TokenSymbol = keyof typeof TOKENS;
const DIGITS = /^\d{1,20}$/;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SEND_KEYS = ['account', 'amount', 'kind', 'markupLamports', 'markupReason', 'networkLamports', 'priorityLamports', 'reasons', 'recipient', 'rentLamports', 'thresholdCents', 'token'];
const DAPP_KEYS = ['account', 'flags', 'kind', 'omitted', 'outgoing', 'reasons', 'site', 'thresholdCents', 'transactions'];
const FLAG_KEYS = ['row', 'step', 'tx', 'word'];
/** F5's keys: its scope too (O9 — `unlimited` at u64::MAX, else `nearly-all`). */
const F5_KEYS = ['row', 'scope', 'step', 'tx', 'word'];
/**
 * B1c-3: each row of the red-flag table (spec §3.3, F1–F10) and its override word (a block) or null (a warning) — this
 * page's own copy of the background's table (reauthChallenges.ts); F5's word is the wallet's own symbol for the token,
 * or UNLIMITED at u64::MAX and ALLOWANCE below it (review 3 L14), each only with its own scope.
 */
const ROW_WORDS: Record<string, string | null> = {F1: null, F2: null, F3: 'ASSIGN', F4: 'AUTHORITY', F5: 'UNLIMITED', F6: null, F7: null, F8: null, F9: null, F10: 'UNCHECKED'};
/** This page's copy of the background's F5_WORDS (the page imports nothing); f5Words.test.ts pins them equal (final review M1). */
export const F5_WORDS: readonly string[] = ['NOC', 'USDC', 'USDT', 'UNLIMITED', 'ALLOWANCE'];
const MAX_FLAGS = 50;
const OUTGOING_KEYS = ['amount', 'decimals', 'mint', 'symbol'];
const SETTINGS_KEYS = ['autoLockMinutes', 'kind', 'reauthUsdCents'];
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

export interface FeeLine {
  label: string;
  /** "0.000005 SOL"; null for a reason line (a zero Noctura fee says why, in the label). */
  value: string | null;
}
export interface SendDescription {
  kind: 'send';
  account: string;
  /** Exact: every base unit shown (a confirmation never rounds). */
  amount: string;
  symbol: TokenSymbol;
  recipient: string;
  fees: FeeLine[];
  reasons: string[];
}
export interface SettingsDescription {
  kind: 'settings';
  lines: string[];
}
/** B1c-2: a dApp's transaction request (spec B1c §3.3): the site, how many transactions, what leaves the account, why. */
export interface DappDescription {
  kind: 'dapp';
  site: string;
  transactions: number;
  /**
   * One row per token leaving the account: the label (a symbol, or "Token") and the exact amount (never rounded), unsigned
   * — B1c-3: #10's rows show it with a minus, its headline without one, as the design's send headline (reauth.ts).
   */
  outgoing: {label: string; amount: string; mint: string | null}[];
  /** How many more tokens leave the account than the rows show (plan 2 review 1 L9: the background lists at most 16). */
  omitted: number;
  reasons: string[];
  /** B1c-3: one row per block — what is overridden and, in a batch, on which transaction ("Transaction 2 of 3"). */
  overrides: {label: string; transaction: string | null}[];
}
/**
 * B1d §4.2: a challenge of a kind outside the three above, described by the presale entry (`describePresale`, in the
 * build with presale only) from its own fixed strings and the values it re-validated, as the three are: the eyebrow
 * and the headline amount, the rows (a value, an address shown whole in groups of four, or both), the reason lines, and
 * the line said once [Cancel] discarded it. Proven, it hands over to the tab's resume route as a send does (D38).
 */
export interface OtherDescription {
  kind: 'other';
  account: string;
  about: string;
  amount: string;
  symbol: string;
  rows: {label: string; value: string | null; address: string | null}[];
  reasons: string[];
  cancelled: string;
}
export type Description = SendDescription | SettingsDescription | DappDescription | OtherDescription;

const sol = (lamports: string): string => `${formatAmount(BigInt(lamports), 9, {min: 0, max: 9})} SOL`;
const dollars = (cents: number): string => formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2});
const isInt = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;
const hasExactly = (o: Record<string, unknown>, keys: string[]): boolean => Object.keys(o).sort().join(',') === keys.join(',') && keys.every(k => own(o, k));

function describeSend(a: Record<string, unknown>): SendDescription | null {
  if (!hasExactly(a, SEND_KEYS)) return null;
  const {account, recipient, token, amount, networkLamports, priorityLamports, markupLamports, markupReason, rentLamports, reasons, thresholdCents} = a;
  if (typeof account !== 'string' || !ADDRESS.test(account) || typeof recipient !== 'string' || !ADDRESS.test(recipient)) return null;
  if (typeof token !== 'string' || !own(TOKENS, token)) return null;
  const symbol = token as TokenSymbol;
  if (![amount, networkLamports, priorityLamports, markupLamports, rentLamports].every(v => typeof v === 'string' && DIGITS.test(v))) return null;
  const network = BigInt(networkLamports as string);
  const priority = BigInt(priorityLamports as string);
  // The priority is a part of the network fee: a larger one describes no real transaction (fail closed).
  if (priority > network) return null;
  if (!isInt(thresholdCents, 100, 100_000)) return null;
  // The background issues a 'send' challenge only when sendReauthReasons returned at least one
  // code (prepare.ts: `if (reasons.length > 0) { ... issueChallenge ... }`), and that function
  // pushes each code at most once: an empty list or a duplicate is never a real challenge.
  if (!Array.isArray(reasons) || reasons.length === 0 || new Set(reasons).size !== reasons.length) return null;
  const lines: string[] = [];
  for (const r of reasons as unknown[]) {
    if (r === 'over-usd-threshold') lines.push(REAUTH.overUsd(dollars(thresholdCents)));
    else if (typeof r === 'string' && own(REAUTH.reason, r)) lines.push(REAUTH.reason[r as keyof typeof REAUTH.reason]);
    else return null;
  }
  // The fee rows as spec §4.5 defines them once for #19, #20 and #10 (plan 3, carry 1): the base fee (the
  // network fee less its priority part), the priority, the new token account when there is one, then the
  // Noctura fee — or, when it is zero, the line that says why.
  const fees: FeeLine[] = [
    {label: REAUTH.networkFee, value: sol((network - priority).toString())},
    {label: REAUTH.priority, value: sol(priority.toString())},
  ];
  if (BigInt(rentLamports as string) > 0n) fees.push({label: REAUTH.newTokenAccount, value: sol(rentLamports as string)});
  if (BigInt(markupLamports as string) > 0n) {
    if (markupReason !== 'charged') return null;
    fees.push({label: REAUTH.nocturaFee, value: sol(markupLamports as string)});
  } else {
    // 'charged' with nothing charged does not describe one action: fail closed.
    if (typeof markupReason !== 'string' || !own(REAUTH.feeReason, markupReason)) return null;
    fees.push({label: REAUTH.feeReason[markupReason as keyof typeof REAUTH.feeReason], value: null});
  }
  const decimals = TOKENS[symbol];
  return {
    kind: 'send',
    account,
    amount: formatAmount(BigInt(amount as string), decimals, {min: symbol === 'SOL' || symbol === 'NOC' ? 4 : 2, max: decimals}),
    symbol,
    recipient,
    fees,
    reasons: lines,
  };
}

function describeSettings(a: Record<string, unknown>): SettingsDescription | null {
  if (!hasExactly(a, SETTINGS_KEYS)) return null;
  const {autoLockMinutes, reauthUsdCents} = a;
  const lines: string[] = [];
  if (autoLockMinutes !== null) {
    if (!isInt(autoLockMinutes, 1, 60)) return null;
    lines.push(REAUTH.autoLock(autoLockMinutes));
  }
  if (reauthUsdCents !== null) {
    if (!isInt(reauthUsdCents, 100, 100_000)) return null;
    lines.push(REAUTH.threshold(dollars(reauthUsdCents)));
  }
  return lines.length === 0 ? null : {kind: 'settings', lines};
}

/** One reason's line (#10's own table; `approval` is B1c-2's, `override` B1c-3's). */
function reasonLine(r: unknown, thresholdCents: number): string | null {
  if (r === 'over-usd-threshold') return REAUTH.overUsd(dollars(thresholdCents));
  if (r === 'approval') return REAUTH.approval;
  if (r === 'override') return REAUTH.override;
  return typeof r === 'string' && own(REAUTH.reason, r) ? REAUTH.reason[r as keyof typeof REAUTH.reason] : null;
}

function describeDapp(a: Record<string, unknown>): DappDescription | null {
  if (!hasExactly(a, DAPP_KEYS)) return null;
  const {account, site, transactions, outgoing, omitted, reasons, thresholdCents} = a;
  if (typeof account !== 'string' || !ADDRESS.test(account) || typeof site !== 'string' || !SITE.test(site) || !isInt(transactions, 1, 5) || !isInt(thresholdCents, 100, 100_000) || !isInt(omitted, 0, 10_000)) return null;
  if (!Array.isArray(outgoing) || outgoing.length > 16 || !Array.isArray(reasons) || reasons.length === 0 || new Set(reasons).size !== reasons.length) return null;
  const rows: DappDescription['outgoing'] = [];
  for (const x of outgoing as unknown[]) {
    if (typeof x !== 'object' || x === null || Array.isArray(x) || !hasExactly(x as Record<string, unknown>, OUTGOING_KEYS)) return null;
    const {mint, symbol, amount, decimals} = x as Record<string, unknown>;
    if (typeof amount !== 'string' || !DIGITS.test(amount)) return null;
    if (mint === null) {
      // SOL: its own name and nine decimals, nothing else.
      if (symbol !== 'SOL' || decimals !== 9) return null;
      rows.push({label: 'SOL', amount: formatAmount(BigInt(amount), 9, {min: 0, max: 9}), mint: null});
      continue;
    }
    if (typeof mint !== 'string' || !ADDRESS.test(mint)) return null;
    if (symbol !== null) {
      // A named token must carry its own decimals (this page's table): anything else describes no real token.
      if (typeof symbol !== 'string' || !own(TOKENS, symbol) || symbol === 'SOL' || decimals !== TOKENS[symbol as TokenSymbol]) return null;
      const d = TOKENS[symbol as TokenSymbol];
      rows.push({label: symbol, amount: formatAmount(BigInt(amount), d, {min: 0, max: d}), mint});
      continue;
    }
    if (decimals !== null && !isInt(decimals, 0, 18)) return null;
    rows.push({label: REAUTH.token, amount: decimals === null ? REAUTH.baseUnits(amount) : formatAmount(BigInt(amount), decimals, {min: 0, max: decimals}), mint});
  }
  const lines: string[] = [];
  for (const r of reasons as unknown[]) {
    const line = reasonLine(r, thresholdCents);
    if (line === null) return null;
    lines.push(line);
  }
  const overrides = overridesOf(a.flags, transactions, reasons as unknown[]);
  if (overrides === null) return null;
  return {kind: 'dapp', site, transactions, outgoing: rows, omitted, reasons: lines, overrides};
}

/**
 * B1c-3: the rows for what is overridden, from the challenge's flags — each re-validated as the background issues it
 * (a known row on a transaction of the batch, a block with its own word and a warning with none, a dependent step
 * naming an earlier one, F5 with its scope and no other row with one, one per (transaction, row), a block exactly when a
 * reason is `override`); null for anything else. A warning is no row: #10 names what the typed words override.
 */
function overridesOf(flags: unknown, transactions: number, reasons: readonly unknown[]): DappDescription['overrides'] | null {
  if (!Array.isArray(flags) || flags.length > MAX_FLAGS) return null;
  const seen = new Set<string>();
  const rows: DappDescription['overrides'] = [];
  for (const x of flags as unknown[]) {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
    const {row, tx, word, step, scope} = x as Record<string, unknown>;
    if (!hasExactly(x as Record<string, unknown>, row === 'F5' ? F5_KEYS : FLAG_KEYS) || (row === 'F5' && scope !== 'unlimited' && scope !== 'nearly-all')) return null;
    if (typeof row !== 'string' || !own(ROW_WORDS, row) || !isInt(tx, 0, transactions - 1) || seen.has(`${tx}:${row}`)) return null;
    seen.add(`${tx}:${row}`);
    const expected = ROW_WORDS[row] ?? null;
    if (expected === null ? word !== null : row === 'F5' ? typeof word !== 'string' || !F5_WORDS.includes(word) : word !== expected) return null;
    if ((word === 'UNLIMITED' && scope !== 'unlimited') || (word === 'ALLOWANCE' && scope !== 'nearly-all')) return null;
    if (row === 'F10' ? !isInt(step, 1, tx) : step !== null) return null;
    if (expected === null) continue;
    const label = row === 'F3' ? REAUTH.overridden.F3 : row === 'F4' ? REAUTH.overridden.F4 : row === 'F10' ? REAUTH.overridden.F10(step as number) : (scope === 'unlimited' ? REAUTH.overridden.F5 : REAUTH.overridden.F5NearlyAll)(word === 'UNLIMITED' || word === 'ALLOWANCE' ? null : (word as string));
    rows.push({label, transaction: transactions > 1 ? REAUTH.transactionOf(tx + 1, transactions) : null});
  }
  return (rows.length > 0) === reasons.includes('override') ? rows : null;
}

/** The closed-alphabet renderer: a description built only from fixed strings and validated values, or null. */
export function describeChallenge(about: unknown): Description | null {
  if (typeof about !== 'object' || about === null || Array.isArray(about)) return null;
  const a = about as Record<string, unknown>;
  if (a.kind === 'send') return describeSend(a);
  if (a.kind === 'settings') return describeSettings(a);
  if (a.kind === 'dapp') return describeDapp(a);
  return describePresale(a);
}

export type ChallengeRead =
  | {state: 'described'; description: Description}
  | {state: 'undescribable'; account: string | null}
  | {state: 'expired' | 'not-unlocked'};

/**
 * The one field of a send record #10 may use when the rest cannot be described: its account, valid by
 * itself (the base58 alphabet, 32–44 characters). [Cancel send] discards that account's prepared send
 * (E7) — without it the page could not drop the send, and must not say "Send cancelled".
 */
function sendAccount(about: unknown): string | null {
  if (typeof about !== 'object' || about === null || Array.isArray(about)) return null;
  const a = about as Record<string, unknown>;
  return a.kind === 'send' && own(a, 'account') && typeof a.account === 'string' && ADDRESS.test(a.account) ? a.account : null;
}

/**
 * vault.challengeInfo, read for #10's first state. `unknown-challenge` (absent or expired) is
 * `expired`; `locked` is `not-unlocked`; any other answer — a reply the renderer cannot describe, a
 * refusal it does not name, a thrown message — is `undescribable`, which offers only Cancel, and carries
 * the send's account when that one field is valid by itself (H1 of the plan review).
 */
export async function readChallenge(send: Send, challengeId: string): Promise<ChallengeRead> {
  try {
    const r = await send({type: 'vault.challengeInfo', challengeId});
    if (!r.ok) {
      if (r.error === 'unknown-challenge') return {state: 'expired'};
      if (r.error === 'locked') return {state: 'not-unlocked'};
      return {state: 'undescribable', account: null};
    }
    const description = describeChallenge(r.data);
    return description === null ? {state: 'undescribable', account: sendAccount(r.data)} : {state: 'described', description};
  } catch {
    return {state: 'undescribable', account: null};
  }
}

/** E7: #10's [Cancel send] drops the account's prepared send and its challenge. True when the background says so. */
export async function discardPrepared(send: Send, account: string): Promise<boolean> {
  if (typeof account !== 'string' || !ADDRESS.test(account)) return false;
  try {
    return (await send({type: 'wallet.discardPrepared', account})).ok;
  } catch {
    return false;
  }
}
