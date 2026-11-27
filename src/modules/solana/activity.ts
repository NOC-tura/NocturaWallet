/**
 * History spec (2026-11-26) §4: one parsed transaction → the row #26 shows for ONE account, and the
 * balance changes #27 lists. Pure: the response, the account, the status and every constant are handed
 * in (`ActivityContext`).
 *
 * THE RULE ABOVE ALL (§1.2): a wrong row is worse than none. Nothing is guessed — a field the response
 * does not prove stays null, an entry that cannot be attributed sets `incomplete`, and the kind falls
 * to 'unknown'.
 *
 * AMOUNTS (§4.2, H2) are the account's NET CHANGE per asset, from the balances before and after:
 *   - SOL: postBalances[i] − preBalances[i] for the account's own index i, plus the fee when i == 0
 *     (the fee is never part of a delta). Lamports are integers; tokens are read ONLY from
 *     `uiTokenAmount.amount` (a base-unit decimal string), never from `uiAmount` (a float).
 *   - the native change is then split by role: `rent` (an account PROVEN created or closed by an
 *     instruction, top-level or inner — never inferred from a 0 balance), `markup` (the Noctura fee
 *     transfer, when something else moved too), `grant` (the relayer's gas grant on a relayed Make
 *     public), and the remainder `moved`.
 * All indexes are over `accountKeys`, which in a parsed response already holds the lookup-table
 * addresses.
 */
import {base58} from '@scure/base';
import {A0_DEPOSIT_ACCOUNTS, A0_WITHDRAW_CHANGE_ACCOUNTS} from '../shielded/a0/constants';
import {a0PoolInstructionKind} from '../shielded/a0/syncedTx';
import {keyString} from './txDetail';
import type {RawInstruction, RawParsedTx, RawTokenBalance} from './txDetail';

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const JUPITER_V6_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const SOL_DECIMALS = 9;

export type ActivityStatus = 'confirmed' | 'finalized' | 'failed';

export type ActivityKind =
  | 'sent'
  | 'received'
  | 'swap'
  | 'made-private'
  | 'made-public'
  | 'wrap'
  | 'unwrap'
  | 'account-setup'
  | 'no-funds-moved'
  | 'failed'
  | 'unknown';

export interface Delta {
  /** 'native' for SOL, else the mint */
  mint: 'native' | string;
  symbol: string;
  /** signed, base units */
  raw: bigint;
  decimals: number;
  role: 'moved' | 'rent' | 'markup' | 'grant';
}

export interface ActivityRow {
  signature: string;
  slot: number;
  blockTime: number | null;
  status: ActivityStatus;
  kind: ActivityKind;
  /** the asset the row shows (§4.4) */
  primary: Delta | null;
  /** a swap's incoming leg; null otherwise */
  secondary: Delta | null;
  /** other deltas with role 'moved' (the "+N more") */
  extraAssets: number;
  /** every net change of this account, ordered (§4.4) — #27 lists them */
  deltas: Delta[];
  /** §4.5 — sent / received only */
  counterparty: string | null;
  via: 'Jupiter' | null;
  /** the fee when the account is index 0; null when someone else paid (a relayer) */
  feePaidByAccount: bigint | null;
  /** a balance entry could not be attributed (§4.2) — never 'no-funds-moved', never 'account-setup' */
  incomplete: boolean;
}

export interface ActivityContext {
  /** the trusted symbol source (`trustedSymbol`); 'native' → 'SOL' */
  symbolOf: (mint: string) => string;
  /** the build's cluster (`NETWORK`) */
  cluster: string;
  /** the A0 constants rule 2 needs beyond `isOurA0Ix`: it applies only when `cluster === a0.cluster` */
  a0: {cluster: string; mint: string};
  feeTreasury: string;
  relayerFeePayer: string;
  jupiterProgramId: string;
  /** the account's token-account sources (§3.1); an owner-less entry of one of them sets `incomplete` */
  ownTokenAccounts: ReadonlySet<string>;
}

interface Ix {
  programId: string;
  type: string | null;
  info: Record<string, unknown>;
  accounts: string[];
  data: string | null;
}

interface Proven {
  /** who paid for the creation; undefined when the account was not proven created */
  payer?: string;
  /** where the lamports went on close; undefined when the account was not proven closed */
  closedTo?: string;
}

const ROLE_ORDER: Record<Delta['role'], number> = {moved: 0, markup: 1, grant: 2, rent: 3};

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Lamports (a safe integer) or a base-unit string as BigInt; anything else is not an amount. */
function big(v: unknown): bigint | null {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) {
    return BigInt(v);
  }
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    return BigInt(v);
  }
  return null;
}

function readIx(raw: unknown): Ix {
  const ix = (raw !== null && typeof raw === 'object' ? raw : {}) as RawInstruction;
  const parsed = typeof ix.parsed === 'object' && ix.parsed !== null ? ix.parsed : undefined;
  return {
    programId: keyString(ix.programId),
    type: str(parsed?.type),
    info: parsed?.info ?? {},
    accounts: Array.isArray(ix.accounts) ? ix.accounts.map(keyString) : [],
    data: str(ix.data),
  };
}

/** Unparsed instruction data is base58; anything that does not decode is no data. */
function dataBytes(data: string | null): Uint8Array {
  if (data === null) {
    return new Uint8Array(0);
  }
  try {
    return base58.decode(data);
  } catch {
    return new Uint8Array(0);
  }
}

const sign = (v: bigint): number => (v > 0n ? 1 : v < 0n ? -1 : 0);

/**
 * §4.4: by role (moved, markup, grant, rent), then non-native before native, then by mint string. Two
 * deltas equal on all three (two rent deltas) keep the order they were made in — the index is the last
 * key, so the result does not depend on the engine's sort being stable.
 */
function ordered(deltas: Delta[]): Delta[] {
  return deltas
    .map((d, at) => ({d, at}))
    .sort((a, b) => {
      const byRole = ROLE_ORDER[a.d.role] - ROLE_ORDER[b.d.role];
      if (byRole !== 0) {
        return byRole;
      }
      const aNative = a.d.mint === 'native' ? 1 : 0;
      const bNative = b.d.mint === 'native' ? 1 : 0;
      if (aNative !== bNative) {
        return aNative - bNative;
      }
      if (a.d.mint !== b.d.mint) {
        return a.d.mint < b.d.mint ? -1 : 1;
      }
      return a.at - b.at;
    })
    .map(x => x.d);
}

export function classifyActivity(raw: RawParsedTx, account: string, status: ActivityStatus, ctx: ActivityContext): ActivityRow {
  const meta = raw.meta ?? {};
  const keys = (raw.transaction?.message?.accountKeys ?? []).map(k => keyString(k.pubkey));
  const pre = meta.preBalances ?? [];
  const post = meta.postBalances ?? [];
  const preTokens = meta.preTokenBalances ?? [];
  const postTokens = meta.postTokenBalances ?? [];
  const fee = big(meta.fee) ?? 0n;
  const i = keys.indexOf(account);
  // §4.1: a parsed transaction carries no confirmation level; `meta.err` overrides the status handed in
  const finalStatus: ActivityStatus = meta.err ? 'failed' : status;

  const top = (raw.transaction?.message?.instructions ?? []).map(readIx);
  const inner = (meta.innerInstructions ?? []).flatMap(group => (group.instructions ?? []).map(readIx));

  // lamports of index k, before and after; a missing entry is not a balance
  const lamports = (side: number[], k: number): bigint | null => big(side[k]);
  const lamportChange = (k: number): bigint => {
    const a = lamports(pre, k);
    const b = lamports(post, k);
    return a === null || b === null ? 0n : b - a;
  };

  // ── token entries, joined by account index ──────────────────────────────────────────────────────────
  const tokenEntries = new Map<number, {pre?: RawTokenBalance; post?: RawTokenBalance}>();
  for (const b of preTokens) {
    if (typeof b.accountIndex === 'number') {
      tokenEntries.set(b.accountIndex, {...tokenEntries.get(b.accountIndex), pre: b});
    }
  }
  for (const b of postTokens) {
    if (typeof b.accountIndex === 'number') {
      tokenEntries.set(b.accountIndex, {...tokenEntries.get(b.accountIndex), post: b});
    }
  }
  const ownerOfIndex = (k: number): string | null => {
    const e = tokenEntries.get(k);
    return str(e?.post?.owner) ?? str(e?.pre?.owner);
  };
  /** the wSOL amount a token account holds on one side (§4.2 "w"); 0 for any other mint or no entry */
  const wrappedAt = (k: number, side: 'pre' | 'post'): bigint => {
    const b = tokenEntries.get(k)?.[side];
    return b !== undefined && b.mint === WSOL_MINT ? big(b.uiTokenAmount?.amount) ?? 0n : 0n;
  };

  // ── §4.3 rule 2: the pool, decided by role and not by sign ──────────────────────────────────────────
  let pool: 'made-private' | 'made-public' | 'other' | null = null;
  let rhoIndex = -1;
  if (ctx.cluster === ctx.a0.cluster) {
    for (const ix of top) {
      // ours = the program with the pool at account 0 and the merkle tree at account 1 (`isOurA0Ix`, not copied)
      const poolIx = a0PoolInstructionKind(ix, dataBytes(ix.data));
      if (poolIx === null) {
        continue;
      }
      pool = pool ?? 'other';
      if (poolIx === 'deposit' && ix.accounts[A0_DEPOSIT_ACCOUNTS.indexOf('depositor')] === account) {
        pool = 'made-private';
        rhoIndex = keys.indexOf(ix.accounts[A0_DEPOSIT_ACCOUNTS.indexOf('rho_marker')] ?? '');
        break;
      }
      if (poolIx === 'withdraw') {
        const destination = keys.indexOf(ix.accounts[A0_WITHDRAW_CHANGE_ACCOUNTS.indexOf('destination_token_account')] ?? '');
        if (destination >= 0 && ownerOfIndex(destination) === account) {
          pool = 'made-public';
          break;
        }
      }
    }
  }

  // ── §4.2: accounts PROVEN created or closed (top-level and inner instructions) ──────────────────────
  const proven = new Map<number, Proven>();
  const prove = (address: string | null, patch: Proven): void => {
    const k = address === null ? -1 : keys.indexOf(address);
    if (k < 0) {
      return;
    }
    const have = proven.get(k) ?? {};
    // each account is counted once: the first proof of a creation (or of a close) stands (review r3 m-a)
    proven.set(k, {payer: have.payer ?? patch.payer, closedTo: have.closedTo ?? patch.closedTo});
  };
  for (const ix of [...top, ...inner]) {
    if (ix.type === null) {
      continue;
    }
    if (ix.programId === SYSTEM_PROGRAM_ID && (ix.type === 'createAccount' || ix.type === 'createAccountWithSeed')) {
      prove(str(ix.info.newAccount), {payer: str(ix.info.source) ?? undefined});
    } else if (ix.programId === ASSOCIATED_TOKEN_PROGRAM_ID && ix.type === 'create') {
      prove(str(ix.info.account), {payer: str(ix.info.source) ?? undefined});
    } else if (ix.programId === ASSOCIATED_TOKEN_PROGRAM_ID && ix.type === 'createIdempotent') {
      const created = str(ix.info.account);
      const k = created === null ? -1 : keys.indexOf(created);
      // an idempotent create of an account that already exists creates nothing
      if (k >= 0 && lamports(pre, k) === 0n) {
        prove(created, {payer: str(ix.info.source) ?? undefined});
      }
    } else if ((ix.programId === TOKEN_PROGRAM_ID || ix.programId === TOKEN_2022_PROGRAM_ID) && ix.type === 'closeAccount') {
      prove(str(ix.info.account), {closedTo: str(ix.info.destination) ?? undefined});
    }
  }
  // the rho marker of our own deposit is the depositor's rent even when no system instruction is parsed (r2 N3)
  if (pool === 'made-private' && rhoIndex >= 0 && lamports(pre, rhoIndex) === 0n && proven.get(rhoIndex)?.payer === undefined) {
    proven.set(rhoIndex, {...proven.get(rhoIndex), payer: account});
  }

  // ── §4.2: the account's tokens ──────────────────────────────────────────────────────────────────────
  // The account's own lamports that are missing, or not a safe integer (above 2^53 the JSON number has already
  // lost digits), are not a balance: no native change is claimed at all, and the row is incomplete rather than wrong.
  const nativeKnown = i >= 0 && lamports(pre, i) !== null && lamports(post, i) !== null;
  // review m1: balances that were not there to read are not a proof of 'no funds moved'
  const tokenBalancesMissing = meta.preTokenBalances == null || meta.postTokenBalances == null;
  let incomplete =
    (i >= 0 && !nativeKnown) ||
    !raw.meta ||
    (tokenBalancesMissing && keys.some(k => ctx.ownTokenAccounts.has(k)));
  const tokenChange = new Map<string, {raw: bigint; decimals: number}>();
  for (const [k, e] of tokenEntries) {
    const owner = ownerOfIndex(k);
    if (owner === null) {
      // an entry with no owner cannot be attributed; if it is one of this account's token accounts the row is incomplete
      if (ctx.ownTokenAccounts.has(keys[k] ?? '')) {
        incomplete = true;
      }
      continue;
    }
    if (owner !== account) {
      continue;
    }
    const mint = str(e.post?.mint) ?? str(e.pre?.mint);
    const decimalsRaw = e.post?.uiTokenAmount?.decimals ?? e.pre?.uiTokenAmount?.decimals;
    const before = e.pre === undefined ? 0n : big(e.pre.uiTokenAmount?.amount);
    const after = e.post === undefined ? 0n : big(e.post.uiTokenAmount?.amount);
    if (mint === null || typeof decimalsRaw !== 'number' || !Number.isInteger(decimalsRaw) || decimalsRaw < 0 || before === null || after === null) {
      incomplete = true; // unknown decimals (or no readable amount): never a guessed figure
      continue;
    }
    const have = tokenChange.get(mint);
    tokenChange.set(mint, {raw: (have?.raw ?? 0n) + (after - before), decimals: decimalsRaw});
  }

  const deltas: Delta[] = [];
  for (const [mint, c] of tokenChange) {
    if (c.raw !== 0n) {
      deltas.push({mint, symbol: ctx.symbolOf(mint), raw: c.raw, decimals: c.decimals, role: 'moved'});
    }
  }
  const tokenMoved = deltas.length;

  // ── §4.2: the native change, split by role ──────────────────────────────────────────────────────────
  const native = (role: Delta['role'], amount: bigint): void => {
    if (amount !== 0n) {
      deltas.push({mint: 'native', symbol: ctx.symbolOf('native'), raw: amount, decimals: SOL_DECIMALS, role});
    }
  };
  if (nativeKnown) {
    let rest = lamportChange(i) + (i === 0 ? fee : 0n);
    const paid: bigint[] = [];
    const refunded: bigint[] = [];
    // a failed transaction moved nothing but its fee: no role split, only what the balances show (review I1)
    const splitRoles = finalStatus !== 'failed';
    for (const [k, p] of splitRoles ? [...proven].sort((a, b) => a[0] - b[0]) : []) {
      // An account created AND closed in one transaction (a swap's temporary wSOL account) has 0 lamports
      // before and after and no token entry on either side: both figures below are 0, so it adds nothing.
      if (p.payer === account) {
        paid.push(lamportChange(k) - wrappedAt(k, 'post'));
      }
      if (p.closedTo === account) {
        refunded.push((lamports(pre, k) ?? 0n) - wrappedAt(k, 'pre'));
      }
    }
    for (const rent of paid) {
      native('rent', -rent);
      rest += rent;
    }
    for (const refund of refunded) {
      native('rent', refund);
      rest -= refund;
    }
    // markup (r2 N3): a top-level system transfer from the account to the fee treasury, when something else moved too
    let markup = 0n;
    for (const ix of top) {
      if (ix.programId === SYSTEM_PROGRAM_ID && ix.type === 'transfer' && ix.info.source === account && ix.info.destination === ctx.feeTreasury) {
        markup += big(ix.info.lamports) ?? 0n;
      }
    }
    if (splitRoles && markup > 0n && (tokenMoved > 0 || rest + markup !== 0n)) {
      native('markup', -markup);
      rest += markup;
    }
    // grant (r2 N3): on a relayed Make public, what the relayer sent the account so it can exist and sign
    if (splitRoles && pool === 'made-public' && keys[0] === ctx.relayerFeePayer && rest > 0n) {
      native('grant', rest);
      rest = 0n;
    }
    native('moved', rest);
  }

  const all = ordered(deltas);
  const moved = all.filter(d => d.role === 'moved');
  const rents = all.filter(d => d.role === 'rent');

  // ── §4.3: the kind, first match wins ────────────────────────────────────────────────────────────────
  let kind: ActivityKind;
  const nativeMoved = moved.find(d => d.mint === 'native');
  const wsolMoved = moved.find(d => d.mint === WSOL_MINT);
  if (finalStatus === 'failed') {
    kind = 'failed';
  } else if (pool !== null) {
    kind = pool === 'other' ? 'unknown' : pool;
  } else if (
    moved.length === 2 &&
    nativeMoved !== undefined &&
    wsolMoved !== undefined &&
    nativeMoved.raw === -wsolMoved.raw
  ) {
    kind = nativeMoved.raw < 0n ? 'wrap' : 'unwrap';
  } else if (moved.some(d => d.raw < 0n) && moved.some(d => d.raw > 0n)) {
    kind = 'swap';
  } else if (moved.length > 0 && moved.every(d => d.raw < 0n)) {
    kind = 'sent';
  } else if (moved.length > 0) {
    kind = 'received';
  } else if (rents.length > 0 && !incomplete) {
    kind = 'account-setup';
  } else if (all.length === 0 && !incomplete) {
    kind = 'no-funds-moved';
  } else {
    kind = 'unknown';
  }

  // ── §4.4: which asset the row shows ─────────────────────────────────────────────────────────────────
  let primary: Delta | null = null;
  let secondary: Delta | null = null;
  switch (kind) {
    case 'sent':
    case 'received':
      primary = moved[0] ?? null;
      break;
    case 'swap':
      primary = moved.find(d => d.raw < 0n) ?? null;
      secondary = moved.find(d => d.raw > 0n) ?? null;
      break;
    case 'made-private':
    case 'made-public':
      primary = moved.find(d => d.mint === ctx.a0.mint) ?? null;
      break;
    case 'wrap':
    case 'unwrap':
      primary = nativeMoved ?? null;
      break;
    case 'account-setup':
      primary = rents[0] ?? null;
      break;
    default:
      break;
  }
  // a wrap's wSOL delta is the other half of the same move, not another asset (plan ruling 3)
  const extraAssets =
    kind === 'wrap' || kind === 'unwrap' ? 0 : moved.filter(d => d !== primary && d !== secondary).length;

  // ── §4.5: the counter-party — for `primary` only, sent and received only ────────────────────────────
  let counterparty: string | null = null;
  if ((kind === 'sent' || kind === 'received') && primary !== null) {
    const want = -sign(primary.raw);
    if (primary.mint === 'native') {
      let candidates: string[] = [];
      for (let k = 0; k < keys.length; k++) {
        if (k === i || tokenEntries.has(k) || proven.has(k)) {
          continue;
        }
        const address = keys[k] ?? '';
        if (address === '' || address === ctx.relayerFeePayer) {
          continue;
        }
        // the fee is added back to index 0: paying it is not a transfer
        if (sign(lamportChange(k) + (k === 0 ? fee : 0n)) === want) {
          candidates.push(address);
        }
      }
      if (candidates.length > 1) {
        candidates = candidates.filter(a => a !== ctx.feeTreasury);
      }
      counterparty = candidates.length === 1 ? candidates[0]! : null;
    } else {
      const owners = new Set<string>();
      let unknownOwner = false;
      for (const [k, e] of tokenEntries) {
        const mint = str(e.post?.mint) ?? str(e.pre?.mint);
        if (mint !== primary.mint) {
          continue;
        }
        const before = e.pre === undefined ? 0n : big(e.pre.uiTokenAmount?.amount) ?? 0n;
        const after = e.post === undefined ? 0n : big(e.post.uiTokenAmount?.amount) ?? 0n;
        if (sign(after - before) !== want) {
          continue;
        }
        const owner = ownerOfIndex(k);
        if (owner === null) {
          unknownOwner = true;
        } else if (owner !== account) {
          owners.add(owner);
        }
      }
      counterparty = !unknownOwner && owners.size === 1 ? [...owners][0]! : null;
    }
  }

  return {
    signature: raw.transaction?.signatures?.[0] ?? '',
    slot: raw.slot ?? 0,
    blockTime: raw.blockTime ?? null,
    status: finalStatus,
    kind,
    primary,
    secondary,
    extraAssets,
    deltas: all,
    counterparty,
    via: kind === 'swap' && top.some(ix => ix.programId === ctx.jupiterProgramId) ? 'Jupiter' : null,
    feePaidByAccount: i === 0 ? fee : null,
    incomplete,
  };
}
