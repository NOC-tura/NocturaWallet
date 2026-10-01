import {formatAmount} from '../shared/amount';
import {REAUTH} from './strings';
import type {Send} from './types';

/**
 * #10's description of a re-authentication (spec B1b-2a E3). The vault page takes the challenge ID
 * from its URL and the description ONLY from the background (vault.challengeInfo), and renders nothing
 * untrusted: every field is re-validated here against a closed alphabet before any text is built —
 * the token in this page's own four-entry table, amounts ^\d{1,20}$, addresses the base58 alphabet at
 * 32–44 characters, each reason and fee reason one of its known codes mapped to a fixed string,
 * thresholds integers in range, and exactly the record's keys. Anything else is null: #10 then shows
 * "The details of this action could not be shown." with only Cancel — it never offers a confirmation
 * it cannot describe.
 */
const TOKENS = {SOL: 9, NOC: 9, USDC: 6, USDT: 6} as const;
export type TokenSymbol = keyof typeof TOKENS;
const DIGITS = /^\d{1,20}$/;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SEND_KEYS = ['account', 'amount', 'kind', 'markupLamports', 'markupReason', 'networkLamports', 'reasons', 'recipient', 'rentLamports', 'thresholdCents', 'token'];
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
export type Description = SendDescription | SettingsDescription;

const sol = (lamports: string): string => `${formatAmount(BigInt(lamports), 9, {min: 0, max: 9})} SOL`;
const dollars = (cents: number): string => formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2});
const isInt = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;
const hasExactly = (o: Record<string, unknown>, keys: string[]): boolean => Object.keys(o).sort().join(',') === keys.join(',') && keys.every(k => own(o, k));

function describeSend(a: Record<string, unknown>): SendDescription | null {
  if (!hasExactly(a, SEND_KEYS)) return null;
  const {account, recipient, token, amount, networkLamports, markupLamports, markupReason, rentLamports, reasons, thresholdCents} = a;
  if (typeof account !== 'string' || !ADDRESS.test(account) || typeof recipient !== 'string' || !ADDRESS.test(recipient)) return null;
  if (typeof token !== 'string' || !own(TOKENS, token)) return null;
  const symbol = token as TokenSymbol;
  if (![amount, networkLamports, markupLamports, rentLamports].every(v => typeof v === 'string' && DIGITS.test(v))) return null;
  if (!isInt(thresholdCents, 100, 100_000)) return null;
  if (!Array.isArray(reasons)) return null;
  const lines: string[] = [];
  for (const r of reasons as unknown[]) {
    if (r === 'over-usd-threshold') lines.push(REAUTH.overUsd(dollars(thresholdCents)));
    else if (typeof r === 'string' && own(REAUTH.reason, r)) lines.push(REAUTH.reason[r as keyof typeof REAUTH.reason]);
    else return null;
  }
  const fees: FeeLine[] = [{label: REAUTH.networkFee, value: sol(networkLamports as string)}];
  if (BigInt(markupLamports as string) > 0n) {
    if (markupReason !== 'charged') return null;
    fees.push({label: REAUTH.nocturaFee, value: sol(markupLamports as string)});
  } else {
    // 'charged' with nothing charged does not describe one action: fail closed.
    if (typeof markupReason !== 'string' || !own(REAUTH.feeReason, markupReason)) return null;
    fees.push({label: REAUTH.feeReason[markupReason as keyof typeof REAUTH.feeReason], value: null});
  }
  if (BigInt(rentLamports as string) > 0n) fees.push({label: REAUTH.newTokenAccount, value: sol(rentLamports as string)});
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

/** The closed-alphabet renderer: a description built only from fixed strings and validated values, or null. */
export function describeChallenge(about: unknown): Description | null {
  if (typeof about !== 'object' || about === null || Array.isArray(about)) return null;
  const a = about as Record<string, unknown>;
  if (a.kind === 'send') return describeSend(a);
  if (a.kind === 'settings') return describeSettings(a);
  return null;
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
  if (!ADDRESS.test(account)) return false;
  try {
    return (await send({type: 'wallet.discardPrepared', account})).ok;
  } catch {
    return false;
  }
}
