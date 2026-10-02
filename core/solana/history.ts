import {PublicKey} from '@solana/web3.js';
import {MAINNET_PROGRAM_ID} from '../presale/addresses';
import {findAssociatedTokenAddress} from '../presale/buyInstructions';
import {MAINNET_FEE_TREASURY} from '../fees/transferMarkup';
import {WALLET_TOKENS, tokenForMint, type WalletToken} from './balances';

export type HistoryKind = 'sent' | 'received' | 'purchase' | 'other';

export interface HistoryEntry {
  signature: string;
  blockTime: number | null;
  kind: HistoryKind;
  token: WalletToken | null;
  mint: string | null;
  /**
   * Base units, always positive; null when there is nothing to show. For a failed `sent` entry it is what the
   * transaction tried to send — which did not move.
   */
  amount: bigint | null;
  counterparty: string | null;
  feeLamports: bigint;
  failed: boolean;
}

type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
const asArray = (x: unknown): unknown[] => (Array.isArray(x) ? (x as unknown[]) : []);
function big(x: unknown): bigint {
  if (typeof x === 'number' && Number.isInteger(x)) return BigInt(x);
  if (typeof x === 'string' && /^-?\d+$/.test(x)) return BigInt(x);
  return 0n;
}
function keyOf(k: unknown): string | null {
  if (typeof k === 'string') return k;
  if (isObj(k) && typeof k.pubkey === 'string') return k.pubkey;
  return null;
}

/** owner → (mint → post − pre), from the token balances the RPC reports. */
function tokenDeltasByOwner(meta: Json): Map<string, Map<string, bigint>> {
  const out = new Map<string, Map<string, bigint>>();
  const add = (entries: unknown, sign: bigint) => {
    for (const e of asArray(entries)) {
      if (!isObj(e) || typeof e.owner !== 'string' || typeof e.mint !== 'string' || !isObj(e.uiTokenAmount)) continue;
      const perMint = out.get(e.owner) ?? new Map<string, bigint>();
      perMint.set(e.mint, (perMint.get(e.mint) ?? 0n) + sign * big(e.uiTokenAmount.amount));
      out.set(e.owner, perMint);
    }
  };
  add(meta.preTokenBalances, -1n);
  add(meta.postTokenBalances, 1n);
  return out;
}

function systemTransfers(instructions: Json[]): {source: string; destination: string; lamports: bigint}[] {
  const out: {source: string; destination: string; lamports: bigint}[] = [];
  for (const ix of instructions) {
    if (ix.program !== 'system' || !isObj(ix.parsed) || ix.parsed.type !== 'transfer' || !isObj(ix.parsed.info)) continue;
    const {source, destination, lamports} = ix.parsed.info;
    if (typeof source === 'string' && typeof destination === 'string') out.push({source, destination, lamports: big(lamports)});
  }
  return out;
}

/** The owner of a token account, from the balances the RPC reports for this transaction (pre or post). */
function tokenAccountOwner(meta: Json, keys: readonly (string | null)[], account: string): {owner: string; mint: string} | null {
  const index = keys.indexOf(account);
  if (index < 0) return null;
  for (const e of [...asArray(meta.postTokenBalances), ...asArray(meta.preTokenBalances)]) {
    if (isObj(e) && e.accountIndex === index && typeof e.owner === 'string' && typeof e.mint === 'string') return {owner: e.owner, mint: e.mint};
  }
  return null;
}

/** Program ids a failed send may carry (plan-3 Task 4 fix round 1, review I1/M1). */
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
const MEMO_PROGRAMS: readonly string[] = ['MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo'];
/** The classic SPL Token program only: the wallet's mints are classic (balances.ts); a Token-2022 transfer is `other`. */
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const MAX_U64 = 18_446_744_073_709_551_615n;

/**
 * A u64 read exactly, or null (review M4). A JSON number above 2^53 was already rounded by JSON.parse, so it is
 * unreadable — never a rounded amount; a string must be plain decimal digits within u64.
 */
function exactU64(x: unknown): bigint | null {
  if (typeof x === 'number') return Number.isSafeInteger(x) && x >= 0 ? BigInt(x) : null;
  if (typeof x === 'string' && /^\d+$/.test(x)) {
    const v = BigInt(x);
    return v <= MAX_U64 ? v : null;
  }
  return null;
}

/** Whether `account` is `wallet`'s associated token account for `mint` (review M3). Untrusted strings: never throws. */
function isAssociatedTokenAccount(account: string, wallet: string, mint: string): boolean {
  try {
    return findAssociatedTokenAddress(new PublicKey(wallet), new PublicKey(mint)).toBase58() === account;
  } catch {
    return false;
  }
}

interface Attempt {
  token: WalletToken;
  mint: string | null;
  amount: bigint;
  counterparty: string | null;
  destination: string;
}

/**
 * What a FAILED transaction tried to send (plan 3, owner question 1, option A): nothing moved, so the balance
 * changes say nothing — but its own instructions do. #27's [Try again] proposes what this returns, so it answers
 * only for a PURE send (plan-3 review H1 and Task 4 fix round 1, I1), and null — the caller's `other` — otherwise:
 *
 * - this owner paid for it (the first key);
 * - every top-level instruction is on an allowlist: ComputeBudget, Memo, System advanceNonce, the Noctura fee's
 *   System transfer from the owner to the treasury (at most ONE; its amount is not pinned — it follows the fee
 *   policy of its day, which the decoder cannot know), an associated-token-account create for the transfer's
 *   destination, and the one transfer itself. Anything else (a swap, a Jito tip beside one, a wrap, a
 *   createAccount, a transferWithSeed, an unparsed instruction) makes it a dApp transaction, not a send;
 * - EXACTLY ONE transfer, so a batch is never summed into one send to its first recipient: a System transfer
 *   from the owner, or an SPL Transfer/TransferChecked under the classic Token program (M1) whose authority is the
 *   owner AND whose source account the owner owns (M2: a delegate's transfer is not the owner's send), of a mint
 *   the wallet knows (from the source's balance entry; an instruction mint that disagrees is `other`);
 * - an amount above zero, read exactly (M4).
 *
 * On purpose, a deliberate send TO the treasury address is never the one transfer: every transfer there is read
 * as the fee, so such a failed transaction decodes as `other` (fix round 1 follow-up).
 *
 * The recipient wallet is the destination's balance-entry owner or, for a destination created in the same
 * transaction, the create's wallet — only when the destination is that wallet's derived ATA for the mint (M3);
 * otherwise null. Top-level instructions only: a transfer a program makes for the owner (an inner, CPI
 * instruction) is not read, so a dApp's wrapped transfer stays `other`.
 */
function attemptedSend(owner: string, keys: readonly (string | null)[], instructions: Json[], meta: Json): Omit<Attempt, 'destination'> | null {
  if (keys[0] !== owner) return null;
  const transfers: Attempt[] = [];
  const creates: {account: string; wallet: string}[] = [];
  let feeTransfers = 0;
  for (const ix of instructions) {
    const id = ix.programId;
    if (id === COMPUTE_BUDGET_PROGRAM || (typeof id === 'string' && MEMO_PROGRAMS.includes(id))) continue;
    const parsed = isObj(ix.parsed) ? ix.parsed : null;
    const info = parsed !== null && isObj(parsed.info) ? parsed.info : null;
    if (parsed === null || info === null) return null;
    if (id === SYSTEM_PROGRAM && ix.program === 'system') {
      if (parsed.type === 'advanceNonce') continue;
      if (parsed.type !== 'transfer' || info.source !== owner || typeof info.destination !== 'string') return null;
      const lamports = exactU64(info.lamports);
      if (lamports === null) return null;
      if (info.destination === MAINNET_FEE_TREASURY) {
        // One fee transfer at most: a second one is not something the send flow builds.
        if (++feeTransfers > 1) return null;
        continue;
      }
      transfers.push({token: 'SOL', mint: null, amount: lamports, counterparty: info.destination, destination: info.destination});
      continue;
    }
    if (id === TOKEN_PROGRAM && ix.program === 'spl-token') {
      if (parsed.type !== 'transferChecked' && parsed.type !== 'transfer') return null;
      if (info.authority !== owner || typeof info.source !== 'string' || typeof info.destination !== 'string') return null;
      const amount = exactU64(parsed.type === 'transferChecked' ? (isObj(info.tokenAmount) ? info.tokenAmount.amount : null) : info.amount);
      const source = tokenAccountOwner(meta, keys, info.source);
      if (amount === null || source === null || source.owner !== owner) return null;
      if (info.mint !== undefined && info.mint !== source.mint) return null;
      const token = tokenForMint(source.mint);
      // An unknown mint is not a send the wallet can name or repeat.
      if (token === null) return null;
      const counterparty = tokenAccountOwner(meta, keys, info.destination)?.owner ?? null;
      transfers.push({token, mint: source.mint, amount, counterparty, destination: info.destination});
      continue;
    }
    if (id === ATA_PROGRAM && ix.program === 'spl-associated-token-account' && (parsed.type === 'create' || parsed.type === 'createIdempotent')) {
      if (typeof info.account !== 'string' || typeof info.wallet !== 'string') return null;
      creates.push({account: info.account, wallet: info.wallet});
      continue;
    }
    return null;
  }
  const only = transfers.length === 1 ? transfers[0] : undefined;
  if (only === undefined || only.amount <= 0n) return null;
  // A create is allowed only for the one transfer's destination, and only beside a token transfer.
  if (creates.some(c => only.mint === null || c.account !== only.destination)) return null;
  let counterparty = only.counterparty;
  if (counterparty === null && only.mint !== null) {
    const mint = only.mint;
    counterparty = creates.find(c => isAssociatedTokenAccount(c.account, c.wallet, mint))?.wallet ?? null;
  }
  return {token: only.token, mint: only.mint, amount: only.amount, counterparty};
}

/**
 * One getTransaction(jsonParsed) result, seen from `owner`: sent, received, a presale purchase, or
 * other. Read from balance changes, not instruction shapes, so non-canonical token accounts and
 * inner instructions come out right. A SOL amount excludes the network fee the owner paid and the
 * Noctura markup (a separate transfer to the fee vault). Untrusted input: never throws.
 *
 * A failed transaction moved nothing but its fee: it is `sent` with what it tried to send when the owner signed a
 * transfer (attemptedSend), and `other` otherwise — `failed` is set on both.
 *
 * One entry per transaction: when a transaction moves both a token and SOL for the owner (a token
 * send that also paid rent for the recipient's account, or the markup), only the token leg is
 * reported — the SOL leg is not a separate entry (plan "Scope" item 12).
 */
export function decodeHistoryEntry(owner: string, signature: string, tx: unknown): HistoryEntry {
  const t = isObj(tx) ? tx : {};
  const meta = isObj(t.meta) ? t.meta : {};
  const message = isObj(t.transaction) && isObj(t.transaction.message) ? t.transaction.message : {};
  const keys = asArray(message.accountKeys).map(keyOf);
  const instructions = asArray(message.instructions).filter(isObj);
  const feeLamports = big(meta.fee);
  const failed = meta.err !== null && meta.err !== undefined;
  const base = {signature, blockTime: typeof t.blockTime === 'number' ? t.blockTime : null, feeLamports, failed};
  const other: HistoryEntry = {...base, kind: 'other', token: null, mint: null, amount: null, counterparty: null};
  if (failed) {
    // Nothing moved; what was attempted is read from the instructions (plan 3, owner question 1, option A).
    const tried = attemptedSend(owner, keys, instructions, meta);
    return tried === null ? other : {...base, kind: 'sent', ...tried};
  }

  const index = keys.indexOf(owner);
  let solDelta = 0n;
  if (index >= 0) {
    solDelta = big(asArray(meta.postBalances)[index]) - big(asArray(meta.preBalances)[index]);
    // The first account pays the fee: add it back, so the amount is what moved, not what it cost.
    if (index === 0) solDelta += feeLamports;
  }
  const deltas = tokenDeltasByOwner(meta);
  const mine = deltas.get(owner) ?? new Map<string, bigint>();

  if (instructions.some(ix => ix.programId === MAINNET_PROGRAM_ID)) {
    for (const token of ['USDC', 'USDT'] as const) {
      const mint = WALLET_TOKENS[token].mint as string;
      const d = mine.get(mint) ?? 0n;
      if (d < 0n) return {...base, kind: 'purchase', token, mint, amount: -d, counterparty: null};
    }
    return {...base, kind: 'purchase', token: 'SOL', mint: null, amount: solDelta < 0n ? -solDelta : 0n, counterparty: null};
  }

  for (const [mint, d] of mine) {
    if (d === 0n) continue;
    let counterparty: string | null = null;
    for (const [who, perMint] of deltas) {
      const theirs = perMint.get(mint) ?? 0n;
      if (who !== owner && (d < 0n ? theirs > 0n : theirs < 0n)) {
        counterparty = who;
        break;
      }
    }
    return {...base, kind: d < 0n ? 'sent' : 'received', token: tokenForMint(mint), mint, amount: d < 0n ? -d : d, counterparty};
  }

  if (solDelta < 0n) {
    const out = systemTransfers(instructions).filter(tr => tr.source === owner && tr.destination !== MAINNET_FEE_TREASURY);
    const amount = out.length > 0 ? out.reduce((s, tr) => s + tr.lamports, 0n) : -solDelta;
    return {...base, kind: 'sent', token: 'SOL', mint: null, amount, counterparty: out[0]?.destination ?? null};
  }
  if (solDelta > 0n) {
    const inbound = systemTransfers(instructions).find(tr => tr.destination === owner);
    return {...base, kind: 'received', token: 'SOL', mint: null, amount: solDelta, counterparty: inbound?.source ?? null};
  }
  return other;
}
