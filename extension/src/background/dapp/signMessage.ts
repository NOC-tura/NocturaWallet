import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {Message, Transaction, VersionedMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {getSession} from '../session';
import {CONFUSABLES} from './confusables';
import {withRecent} from './grants';
import {answer, queueAccess} from './queue';
import {grantIn, putGrant} from './store';

/**
 * `signMessage` (spec §3.2; D9, review M5, review 2 L5, L6, M10.2). The page's bytes are checked in this order, and
 * each refusal names its reason (a later rule never masks an earlier one):
 *  1. `unauthorized` unless the origin holds a grant for exactly this account (pageApi.ts);
 *  2. `invalid-request`, no window: more than 4 KiB; bytes that deserialize as a legacy Message or Transaction, a
 *     VersionedTransaction or a VersionedMessage; the off-chain prefix `\xffsolana offchain`; not valid UTF-8; a
 *     control character other than \n, \t, and a \r directly before \n; any format character (\p{Cf});
 *  3. Sign-In-With-Solana: the second line must be the account (else `invalid-request`, no window), and the domain
 *     must be this origin's authority — a mismatch opens #46 with Q20 and no Sign (siwsMismatch);
 *  4. otherwise queued; the window shows #46.
 */
export const MAX_MESSAGE_BYTES = 4096;
/** The largest base64 a 4 KiB message can be (the page cannot make us decode more). */
const MAX_BASE64 = Math.ceil(MAX_MESSAGE_BYTES / 3) * 4;
const OFFCHAIN = Uint8Array.from([0xff, ...new TextEncoder().encode('solana offchain')]);

export type MessageRefusal = 'too-long' | 'transaction' | 'offchain' | 'utf8' | 'control' | 'format';

function deserializes(bytes: Uint8Array): boolean {
  const tries: (() => unknown)[] = [
    () => Message.from(bytes),
    () => Transaction.from(bytes),
    () => VersionedTransaction.deserialize(bytes),
    () => VersionedMessage.deserialize(bytes),
  ];
  return tries.some(t => {
    try {
      t();
      return true;
    } catch {
      return false;
    }
  });
}

/** Rule 2, in its order: the first reason the bytes are refused, or the decoded text. */
export function checkMessage(bytes: Uint8Array): {refused: MessageRefusal} | {text: string} {
  if (bytes.length > MAX_MESSAGE_BYTES) return {refused: 'too-long'};
  if (deserializes(bytes)) return {refused: 'transaction'};
  if (bytes.length >= OFFCHAIN.length && OFFCHAIN.every((b, i) => bytes[i] === b)) return {refused: 'offchain'};
  let text: string;
  try {
    // ignoreBOM: a leading U+FEFF stays in the text, where the format rule below sees it.
    text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  } catch {
    return {refused: 'utf8'};
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]|\r(?!\n)/.test(text)) return {refused: 'control'};
  if (/\p{Cf}/u.test(text)) return {refused: 'format'};
  return {text};
}

/** The SIWS first line (§3.2 rule 3). */
const SIWS_HEAD = /^(.+) wants you to sign in with your Solana account:$/;
const lines = (text: string): string[] => text.split('\n').map(l => l.replace(/\r$/, ''));

/** The authority a SIWS message must name for this origin: the host, or host:port with an explicit port (review 2 L5). */
export function authorityOf(origin: string): string {
  const u = new URL(origin);
  return u.port === '' ? u.hostname : `${u.hostname}:${u.port}`;
}

export type SiwsCheck = {siws: false} | {siws: true; domain: string; addressOk: boolean; domainOk: boolean};

export function checkSiws(text: string, origin: string, account: string): SiwsCheck {
  const [first, second] = lines(text);
  const m = SIWS_HEAD.exec(first ?? '');
  if (m === null) return {siws: false};
  const domain = m[1] ?? '';
  return {siws: true, domain, addressOk: second === account, domainOk: domain === authorityOf(origin)};
}

/** Rule 6's words: the design's six and four of ours, as whole words (maximal runs of ASCII letters), case-insensitive. */
export const KEYWORDS = ['approve', 'approval', 'permit', 'allowance', 'authorize', 'authorise', 'spending', 'spend', 'delegate', 'transfer', 'withdraw'];

/** The first keyword in text order, and every occurrence of it (UTF-16 ranges) — or null. */
export function keywordIn(text: string): {word: string; ranges: {start: number; end: number}[]} | null {
  let word: string | null = null;
  const ranges: {start: number; end: number}[] = [];
  for (const m of text.matchAll(/[A-Za-z]+/g)) {
    const w = m[0].toLowerCase();
    if (word === null && KEYWORDS.includes(w)) word = w;
    if (word !== null && w === word) ranges.push({start: m.index, end: m.index + m[0].length});
  }
  return word === null ? null : {word, ranges};
}

/** §3.2 step 5: every character outside ASCII that skel maps to Latin (the lookalike state marks it). */
export function homoglyphRanges(text: string): {start: number; end: number}[] {
  const out: {start: number; end: number}[] = [];
  let at = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '');
    if (cp >= 0x80 && (CONFUSABLES.has(cp) || (base !== ch && /^[A-Za-z0-9]$/.test(base)))) out.push({start: at, end: at + ch.length});
    at += ch.length;
  }
  return out;
}

const ACCOUNT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isAccount = (x: unknown): x is string => {
  if (typeof x !== 'string' || !ACCOUNT.test(x)) return false;
  try {
    return base58.decode(x).length === 32;
  } catch {
    return false;
  }
};

/** The page message, decoded: the account and the message bytes — null when either is not even that. */
export function signRequestOf(msg: Record<string, unknown>): {account: string; bytes: Uint8Array} | null {
  const {account, message} = msg;
  if (!isAccount(account) || typeof message !== 'string' || message.length > MAX_BASE64 + 4) return null;
  try {
    return {account, bytes: base64.decode(message)};
  } catch {
    return null;
  }
}

/**
 * §3.2 step 7: the signature. Runs after the `deciding` section (decide.ts): reads the granted account's key, signs the
 * exact bytes with ed25519, and writes the answer in a section that first confirms the entry is still this instance's
 * `deciding` one — a lock or a restart in between answered it `rejected`, and then the signature is dropped here,
 * never delivered.
 */
export async function finishSign(ext: Ext, deps: Pick<WalletDeps, 'now'>, requestId: string, instance: string): Promise<void> {
  const work = await queueAccess(ext, deps, tx => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.account === null || e.message === null) return null;
    return {account: e.account, message: e.message};
  });
  if (work === null) return;
  const key = (await getSession(ext))?.find(a => a.publicKey === work.account);
  let signature: string | null = null;
  if (key !== undefined) {
    const sk = base64.decode(key.secretKey);
    try {
      signature = base64.encode(ed25519.sign(base64.decode(work.message), sk.subarray(0, 32)));
    } finally {
      sk.fill(0);
    }
  }
  await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return;
    // A lock answered the entry before this section (the check above). An account removed while its key was read is
    // still a signature computed — dropped here, never delivered (review 1 M4); `tx.session === null` is the narrowing.
    // Fix round 1 (controller ruling, spec §2.7 "requests are refused from that moment"): a revoke — or a re-grant to
    // a different account — during the key read must drop the computed signature the same way.
    if (signature === null || tx.session === null || !tx.session.some(a => a.publicKey === work.account) || grantIn(tx, e.origin)?.account !== work.account) {
      answer(fx, e, {error: 'rejected'}, tx.now);
      return;
    }
    const g = grantIn(tx, e.origin);
    if (g !== null) putGrant(tx, withRecent(g, 'signMessage', tx.now, 'approved'));
    answer(fx, e, {result: {signature, signedMessage: work.message}}, tx.now);
  });
}
