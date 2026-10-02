import {MAINNET_PROGRAM_ID} from '../presale/addresses';
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

/**
 * What a FAILED transaction tried to send (plan 3, owner question 1, option A): nothing moved, so the balance
 * changes say nothing — but its own instructions do. Only for a transaction this owner paid for and signed (the
 * first key), and only when it carries EXACTLY ONE transfer from the owner (plan-3 review H1: #27's [Try again]
 * proposes this intent, so a batch is never summed into one send to its first recipient): an SPL TransferChecked
 * or Transfer whose authority is the owner, of a mint the wallet knows (the mint from the instruction or from the
 * source account's balance entry; the recipient wallet from the destination's balance entry, or from an
 * associated-token-account create for it in the same transaction), or one System transfer from the owner (the
 * Noctura fee's transfer to the treasury left out). Top-level instructions only: a transfer a program makes for
 * the owner (an inner, CPI instruction) is not read, so a dApp's wrapped transfer stays `other`. Anything else
 * is null: the caller's `other`.
 */
function attemptedSend(owner: string, keys: readonly (string | null)[], instructions: Json[], meta: Json): {token: WalletToken; mint: string | null; amount: bigint; counterparty: string | null} | null {
  if (keys[0] !== owner) return null;
  const found: {token: WalletToken | null; mint: string | null; amount: bigint; counterparty: string | null}[] = [];
  for (const ix of instructions) {
    if (ix.program !== 'spl-token' || !isObj(ix.parsed) || (ix.parsed.type !== 'transferChecked' && ix.parsed.type !== 'transfer') || !isObj(ix.parsed.info)) continue;
    const info = ix.parsed.info;
    if (info.authority !== owner || typeof info.source !== 'string' || typeof info.destination !== 'string') continue;
    const amount = ix.parsed.type === 'transferChecked' ? (isObj(info.tokenAmount) ? big(info.tokenAmount.amount) : 0n) : big(info.amount);
    const mint = typeof info.mint === 'string' ? info.mint : (tokenAccountOwner(meta, keys, info.source)?.mint ?? null);
    let counterparty = tokenAccountOwner(meta, keys, info.destination)?.owner ?? null;
    if (counterparty === null) {
      for (const c of instructions) {
        if (c.program === 'spl-associated-token-account' && isObj(c.parsed) && isObj(c.parsed.info) && c.parsed.info.account === info.destination && typeof c.parsed.info.wallet === 'string') {
          counterparty = c.parsed.info.wallet;
        }
      }
    }
    if (amount > 0n) found.push({token: mint === null ? null : tokenForMint(mint), mint, amount, counterparty});
  }
  for (const tr of systemTransfers(instructions)) {
    if (tr.source === owner && tr.destination !== MAINNET_FEE_TREASURY) found.push({token: 'SOL', mint: null, amount: tr.lamports, counterparty: tr.destination});
  }
  const only = found.length === 1 ? found[0] : undefined;
  // One transfer, of a token the wallet knows: an unknown mint is not a send the wallet can name or repeat.
  if (only === undefined || only.token === null) return null;
  return {...only, token: only.token};
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
