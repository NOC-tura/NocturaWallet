import {PublicKey, TransactionMessage, VersionedTransaction, type TransactionInstruction} from '@solana/web3.js';
import {base64} from '@scure/base';
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {PREPARED_KEY, REAUTH_KEY, getSession, sessionMutex} from './session';
import {inFlightFor, readPending} from './pendingStore';
import {EXTENSION_FEE_INPUTS} from './feePolicy';
import {knownRecipients} from './knownRecipients';
import {readSettings} from './settings';
import {sendReauthReasons, usdMicros, type SendReauthReason} from './reauthPolicy';
import {CHALLENGE_TTL_MS, challengeReusable, issueChallenge} from './reauthChallenges';
import {digestOf, randomId} from './digest';
import {SendRefused, type SendIntent} from './sendTypes';
import {estimatePriorityFee} from '../../../core/solana/priorityFee';
import {
  InsufficientTokenBalance,
  SYSTEM_ACCOUNT_RENT_LAMPORTS,
  SplitTokenBalance,
  TOKEN_ACCOUNT_RENT_LAMPORTS,
  buildSolTransferInstructions,
  buildSplTransferInstructions,
  computeUnitLimitFor,
  findAssociatedTokenAddress,
  networkFeeLamports,
  priorityFeeLamports,
  selectSourceTokenAccount,
  type Markup,
} from '../../../core/solana/transfer';
import {WALLET_TOKENS, type WalletToken} from '../../../core/solana/balances';
import {MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS, effectiveFee, type FeeReason} from '../../../core/fees/transferMarkup';
import type {Prices} from '../../../core/portfolio/value';
import {RpcForbidden} from '../../../core/solana/rpc';

/** Spec §3: after 30 s unconfirmed a transaction is simulated again — a prepared send older than that is re-prepared. */
export const PREPARED_TTL_MS = 30_000;
export const MAX_PREPARED = 5;
const MAX_U64 = 18_446_744_073_709_551_615n;
const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];

export interface PreparedSend {
  id: string;
  account: string;
  intent: SendIntent;
  /** The unsigned v0 message, base64 — exactly what will be signed. */
  message: string;
  lastValidBlockHeight: number;
  createdAt: number;
  /**
   * What a re-auth challenge is bound to: the intent (sendIntentDigest), not the message bytes.
   * The bytes carry a blockhash that a re-prepare must renew every 30 s, and a human
   * re-authentication routinely takes longer (final review, Important 1).
   */
  intentDigest: string;
  challengeId: string | null;
  /** preparedIntegrity of every field above: an entry changed after prepare is refused at send. */
  integrity: string;
  /** What prepare showed, kept so wallet.preparedFor can show it again. Not signed, not bound. */
  shown: {fees: PreparedView['fees']; solRequiredLamports: string; reasons: SendReauthReason[]};
}

export interface PreparedView {
  id: string;
  fees: {networkLamports: string; priorityLamports: string; rentLamports: string; markupLamports: string; markupReason: FeeReason};
  solRequiredLamports: string;
  reauth: {challengeId: string; reasons: SendReauthReason[]} | null;
}

/** wallet.preparedFor: the view again, with the intent; `expired` = no longer sendable, prepare again. */
export type ResumableView = PreparedView & {intent: SendIntent; expired: boolean};

/** The re-auth binding of a send: who sends what to whom — amounts as decimal strings. */
export function sendIntentDigest(account: string, intent: SendIntent): string {
  return digestOf('send', {account, token: intent.token, recipient: intent.recipient, amount: intent.amount});
}

/** Message integrity of a stored prepared send: every field that decides what is signed, or whether re-auth is asked. */
export function preparedIntegrity(p: Omit<PreparedSend, 'integrity' | 'shown'>): string {
  return digestOf('prepared', {
    id: p.id,
    account: p.account,
    intent: {token: p.intent.token, recipient: p.intent.recipient, amount: p.intent.amount},
    message: p.message,
    lastValidBlockHeight: p.lastValidBlockHeight,
    createdAt: p.createdAt,
    intentDigest: p.intentDigest,
    challengeId: p.challengeId,
  });
}

export function isAddress(x: unknown): x is string {
  if (typeof x !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x)) return false;
  try {
    return new PublicKey(x).toBase58() === x;
  } catch {
    return false;
  }
}

/** Page-supplied input is hostile until checked: a wallet token, an address, a positive u64 amount. */
export function parseIntent(x: unknown): SendIntent | null {
  if (typeof x !== 'object' || x === null) return null;
  const {token, recipient, amount} = x as Record<string, unknown>;
  if (typeof token !== 'string' || !TOKENS.includes(token)) return null;
  if (!isAddress(recipient)) return null;
  if (typeof amount !== 'string' || !/^[1-9]\d{0,19}$/.test(amount) || BigInt(amount) > MAX_U64) return null;
  return {token: token as WalletToken, recipient, amount};
}

/**
 * USD per whole token for the dollar re-auth rule. NOC has no market price; it is valued at the
 * current presale stage price (owner decision B). A price that cannot be read is `undefined`, which
 * the rule counts as above the threshold (fail closed) — but a 403 is never swallowed.
 */
async function unitPrice(deps: WalletDeps, token: WalletToken): Promise<number | undefined> {
  try {
    if (token === 'NOC') return (await deps.stagePrice()) ?? undefined;
    const prices: Prices = await deps.prices();
    if (token === 'SOL') return prices.solana;
    return token === 'USDC' ? prices.usdc : prices.usdt;
  } catch (e) {
    if (e instanceof RpcForbidden) throw e;
    return undefined;
  }
}

function isPreparedShape(x: unknown): x is PreparedSend {
  if (typeof x !== 'object' || x === null) return false;
  const p = x as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.integrity === 'string' && typeof p.createdAt === 'number' && typeof p.shown === 'object' && p.shown !== null;
}

async function loadPrepared(ext: Ext): Promise<PreparedSend[]> {
  const v = await ext.session.get(PREPARED_KEY);
  // An entry of another shape (an older build's) is not ours to sign or show.
  return Array.isArray(v) ? (v as unknown[]).filter(isPreparedShape) : [];
}

/**
 * `opts.challengeId`: the challenge an earlier prepare of the same intent issued (wallet.send answered
 * 'prepared-expired', or a reopened popup resumes via wallet.preparedFor). While it is live and bound
 * to this intent — proven or not — it is reused instead of issuing a new one, so one re-authentication
 * survives the 30 s re-prepare. The message itself is always rebuilt with a fresh blockhash.
 */
export async function prepareSend(
  ext: Ext,
  deps: WalletDeps,
  account: string,
  intent: SendIntent,
  opts: {challengeId?: string} = {},
): Promise<PreparedView> {
  const session = await getSession(ext);
  if (session === null) throw new SendRefused('locked');
  if (!session.some(a => a.publicKey === account)) throw new SendRefused('unknown-account');
  // One in-flight send per account: nothing new is built while an earlier one may still land.
  if (inFlightFor(await readPending(ext), account) !== undefined) throw new SendRefused('in-flight');

  const sender = new PublicKey(account);
  const recipient = new PublicKey(intent.recipient);
  const amount = BigInt(intent.amount);
  const token = WALLET_TOKENS[intent.token];
  const fee = effectiveFee(TRANSFER_MARKUP_LAMPORTS, EXTENSION_FEE_INPUTS);
  const markup: Markup | null = fee.lamports > 0n ? {lamports: fee.lamports, treasury: new PublicKey(MAINNET_FEE_TREASURY)} : null;
  const [price, latest, solBalance] = await Promise.all([
    estimatePriorityFee(deps.reader, 'normal'),
    deps.reader.getLatestBlockhash(),
    deps.reader.getBalance(account),
  ]);

  let instructions: TransactionInstruction[];
  let computeUnitLimit: number;
  let rent = 0n;
  let tokenBalance: bigint;
  let recipientExists = true;
  if (token.mint === null) {
    recipientExists = await deps.reader.getAccountExists(intent.recipient);
    computeUnitLimit = computeUnitLimitFor({kind: 'sol'});
    instructions = buildSolTransferInstructions({sender, recipient, lamports: amount, priorityFee: price, computeUnitLimit, markup});
    tokenBalance = solBalance;
  } else {
    const mint = new PublicKey(token.mint);
    const holdings = await deps.reader.getTokenAccountsByOwner(account, {mint: token.mint});
    tokenBalance = holdings.reduce((sum, h) => sum + h.amount, 0n);
    let source: string | null;
    try {
      source = selectSourceTokenAccount(holdings.map(h => ({pubkey: h.pubkey, amount: h.amount})), amount);
    } catch (e) {
      if (e instanceof SplitTokenBalance) throw new SendRefused('split-balance', e.message);
      if (e instanceof InsufficientTokenBalance) throw new SendRefused('insufficient-token', e.message);
      throw e;
    }
    if (source === null) throw new SendRefused('insufficient-token', 'This account holds none of this token.');
    const createAta = !(await deps.reader.getAccountExists(findAssociatedTokenAddress(recipient, mint).toBase58()));
    rent = createAta ? TOKEN_ACCOUNT_RENT_LAMPORTS : 0n;
    computeUnitLimit = computeUnitLimitFor({kind: 'spl', createAta});
    instructions = buildSplTransferInstructions({
      sender,
      recipient,
      mint,
      amount,
      decimals: token.decimals,
      priorityFee: price,
      computeUnitLimit,
      createAta,
      sourceTokenAccount: new PublicKey(source),
      markup,
    });
  }

  const message = new TransactionMessage({payerKey: sender, recentBlockhash: latest.blockhash, instructions}).compileToV0Message();
  const networkLamports = networkFeeLamports(message.header.numRequiredSignatures, price, computeUnitLimit);
  const priorityLamports = priorityFeeLamports(price, computeUnitLimit);
  const markupLamports = markup?.lamports ?? 0n;
  const solRequired = (token.mint === null ? amount : 0n) + networkLamports + rent + markupLamports;
  if (solRequired > solBalance) throw new SendRefused('insufficient-sol', `${solRequired} lamports needed, ${solBalance} held`);
  // Rent-exempt minimums (review M4): the runtime refuses a transfer that leaves the sender with
  // 1…889 879 lamports, or creates a system account with less than 890 880 — refuse it here, with a
  // reason, rather than as an opaque simulation failure.
  const remainder = solBalance - solRequired;
  if (remainder > 0n && remainder < SYSTEM_ACCOUNT_RENT_LAMPORTS) {
    throw new SendRefused('sender-below-rent', `${remainder} lamports would remain; keep at least ${SYSTEM_ACCOUNT_RENT_LAMPORTS} or send everything`);
  }
  if (!recipientExists && amount < SYSTEM_ACCOUNT_RENT_LAMPORTS) {
    throw new SendRefused('recipient-below-rent', `a new account needs at least ${SYSTEM_ACCOUNT_RENT_LAMPORTS} lamports`);
  }

  const simulation = await deps.reader.simulateTransaction(base64.encode(new VersionedTransaction(message).serialize()));
  if (simulation.err !== null) throw new SendRefused('simulation-failed', JSON.stringify(simulation.err));

  const knownRecipient = session.some(a => a.publicKey === intent.recipient) || (await knownRecipients(ext)).has(intent.recipient);
  const settings = await readSettings(ext);
  const reasons = sendReauthReasons({
    knownRecipient,
    amount,
    balance: tokenBalance,
    usdMicros: usdMicros(amount, token.decimals, await unitPrice(deps, intent.token)),
    thresholdCents: settings.reauthUsdCents,
  });

  const messageB64 = base64.encode(message.serialize());
  const intentDigest = sendIntentDigest(account, intent);
  const carried = opts.challengeId;
  // Issued before the critical section below: issueChallenge takes sessionMutex itself, which is not re-entrant.
  let challengeId: string | null = null;
  if (reasons.length > 0) {
    challengeId = carried !== undefined && (await challengeReusable(ext, deps.now(), carried, intentDigest)) ? carried : await issueChallenge(ext, deps, intentDigest);
  }
  const fees = {
    networkLamports: networkLamports.toString(),
    priorityLamports: priorityLamports.toString(),
    rentLamports: rent.toString(),
    markupLamports: markupLamports.toString(),
    markupReason: fee.reason,
  };
  const bound = {
    id: randomId(deps.randomBytes),
    account,
    intent,
    message: messageB64,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    createdAt: deps.now(),
    intentDigest,
    challengeId,
  };
  const prepared: PreparedSend = {...bound, integrity: preparedIntegrity(bound), shown: {fees, solRequiredLamports: solRequired.toString(), reasons}};
  // Under sessionMutex, the one lock (clearSession) takes: a lock that landed while this send was
  // being read, simulated or challenged is seen here, and nothing is written back after it.
  await sessionMutex(async () => {
    if ((await getSession(ext)) === null) {
      // Locked meanwhile. A challenge issued after the lock's clear would outlive it: remove just
      // that (PREPARED_KEY was never written). Never clear the area — clearSession would wait on
      // this very mutex, and a direct clear() could wipe a session written since (fix round 1).
      await ext.session.remove(REAUTH_KEY);
      throw new SendRefused('locked');
    }
    const now = deps.now();
    // Other accounts' entries stay while their challenge can live: past 30 s they are unsendable,
    // but wallet.preparedFor still resumes them (see there).
    const keep = (await loadPrepared(ext)).filter(p => p.account !== account && now - p.createdAt < CHALLENGE_TTL_MS).slice(-(MAX_PREPARED - 1));
    await ext.session.set(PREPARED_KEY, [...keep, prepared]);
  });
  return viewOf(prepared);
}

function viewOf(p: PreparedSend): PreparedView {
  return {
    id: p.id,
    fees: p.shown.fees,
    solRequiredLamports: p.shown.solRequiredLamports,
    reauth: p.challengeId === null ? null : {challengeId: p.challengeId, reasons: p.shown.reasons},
  };
}

/**
 * wallet.preparedFor: the newest prepared send of this account, so a popup closed during
 * re-authentication can resume. Past PREPARED_TTL_MS it is still reported — `expired`, not
 * sendable — while its challenge can live (CHALLENGE_TTL_MS): the popup then prepares the same
 * intent again with that challengeId instead of asking for a second re-authentication.
 */
export async function preparedFor(ext: Ext, deps: Pick<WalletDeps, 'now'>, account: string): Promise<ResumableView | null> {
  const now = deps.now();
  const mine = (await loadPrepared(ext)).filter(p => p.account === account && now - p.createdAt < CHALLENGE_TTL_MS);
  const newest = mine.reduce<PreparedSend | null>((a, p) => (a === null || p.createdAt >= a.createdAt ? p : a), null);
  if (newest === null) return null;
  return {...viewOf(newest), intent: newest.intent, expired: now - newest.createdAt >= PREPARED_TTL_MS};
}

export async function peekPrepared(ext: Ext, id: string): Promise<PreparedSend | null> {
  return (await loadPrepared(ext)).find(p => p.id === id) ?? null;
}

/** Single use: removed as it is taken, so a second "Send" with the same id finds nothing. */
export async function takePrepared(ext: Ext, deps: Pick<WalletDeps, 'now'>, id: string): Promise<PreparedSend> {
  return sessionMutex(async () => {
    const all = await loadPrepared(ext);
    const found = all.find(p => p.id === id);
    if (found === undefined) throw new SendRefused('unknown-prepared');
    await ext.session.set(PREPARED_KEY, all.filter(p => p.id !== id));
    if (deps.now() - found.createdAt >= PREPARED_TTL_MS) throw new SendRefused('prepared-expired');
    return found;
  });
}
