import {base58, base64, base64urlnopad} from '@scure/base';
import type {WalletDeps} from '../deps';
import {dappReauthReasons, usdMicros, type DappReauthReason} from '../reauthPolicy';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../core/presale/addresses';
import type {AccountData} from '../../../../core/solana/rpc';
import {COMPUTE_BUDGET_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, decodeInstructions, type DecodedInstruction} from './decode/decode';
import {ADDRESS_LOOKUP_TABLE_PROGRAM, resolveKeys, tableAddresses, tablesOf} from './decode/keys';
import {isWritableIndex, type ParsedTx} from './decode/wire';

/**
 * The simulation (spec B1c §3.3, B1 §3): a dApp's transactions are run through the proxy (`simulateTransaction`, one
 * source — the coordinator, stated), with `accounts` = the signer's wallet account and every writable account the
 * transaction names (resolved through its lookup tables), so the account's token accounts it touches — an existing one,
 * one it creates, one it closes — come back in their post-state. A balance change is post − pre per mint, in base units
 * (bigint, rule 2): SOL from the wallet account (the fee included, as the node reports it) PLUS the lamports of the
 * account's own token accounts (fix round 1, Promoted Minor 3 — a close to a foreign destination moves those lamports
 * out of custody without ever touching the wallet's own system account); each NON-native token from the account's token
 * accounts, pre AND post read from CHAIN STATE (getAccountsData, fresh immediately before each transaction's own
 * simulation, for exactly the addresses that simulation returns post state for — fix round 1, I1/I2; getTokenAccountsByOwner's
 * one-time batch snapshot is used only for the reauth rules' balance denominator and the known-recipient check, never
 * for a per-transaction pre amount). A native-mint (wSOL) account produces NO token line at all (fix round 2, IMPORTANT):
 * its lamports already are its value (the Token program enforces lamports = amount + rent for every is_native account),
 * so counting both would show every wrapped lamport moved twice. The transactions of a batch are simulated one by one
 * against the current state (a node cannot chain them). The re-authentication reasons (B1b's rules) are computed here —
 * `approval` from chain state too (a new or raised delegation, a changed close authority, or an own account's owner
 * reassigned away — fix round 2, ruled-in: a dApp program can CPI an Approve, a SetAuthority close-authority change or a
 * SetAuthority AccountOwner with no top-level instruction that names it) — so `dapp.decide` needs no read of its own.
 */
export const DEFAULT_UNITS_PER_INSTRUCTION = 200_000;
export const MAX_COMPUTE_UNITS = 1_400_000;
export const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
/** Decimals the wallet knows without a read (SOL's own and its wrapped mint, NOC, USDC, USDT). */
const KNOWN_DECIMALS: ReadonlyMap<string, number> = new Map([
  [WRAPPED_SOL_MINT, 9],
  [MAINNET_NOC_MINT, 9],
  [MAINNET_USDC_MINT, 6],
  [MAINNET_USDT_MINT, 6],
]);

/** One mint's change for the account. `mint` null is SOL; `amount` signed base units; `usdMicros` signed, null without a price. */
export interface BalanceChange {
  mint: string | null;
  amount: string;
  decimals: number | null;
  usdMicros: string | null;
}

export type TxOutcome =
  | {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null}
  /** `expired`: the node does not know the transaction's blockhash any more (Q21); `failed`: it ran and failed. */
  | {ok: false; error: 'expired' | 'failed'; detail: string};

export interface TxSimulation {
  /** 128 random bits: `dapp.decide` names the simulation the window showed (stale → refused). */
  id: string;
  at: number;
  slot: number;
  elapsedMs: number;
  /** Per transaction, every account index resolved (null: a lookup table did not resolve it). */
  keys: (string | null)[][];
  outcomes: TxOutcome[];
  reasons: DappReauthReason[];
  /** An upper bound of the dApp blockhash's last valid height (the latest blockhash's, read now): a pending send's expiry check waits at least this long. */
  lastValidBlockHeight: number;
}

/**
 * Whether `a`'s bytes are a real SPL Token / Token-2022 account — never by length alone (fix round 1, I2: a 355-byte
 * Multisig, or any other same-length impostor, must never be read as a token account just because it is long enough).
 * Classic Token accounts are exactly 165 bytes; Token-2022 accounts are the same 165 bytes, or longer with an
 * AccountType::Account discriminator (2) at a fixed offset 165 (its TLV extensions follow) — EXCEPT 355 bytes
 * specifically, the Multisig struct's own size, which collides with that discriminator's position by coincidence and
 * must stay excluded even when byte 165 happens to equal 2. Either way, the state byte (108) must be Initialized (1)
 * or Frozen (2) — never Uninitialized (0), which carries no meaning at all.
 */
function isTokenAccountLayout(a: AccountData): boolean {
  if (a.owner === TOKEN_PROGRAM) {
    if (a.data.length !== 165) return false;
  } else if (a.owner === TOKEN_2022_PROGRAM) {
    if (!(a.data.length === 165 || (a.data.length > 165 && a.data.length !== 355 && a.data[165] === 2))) return false;
  } else {
    return false;
  }
  return a.data[108] === 1 || a.data[108] === 2;
}

/**
 * `a`'s state as a token account owned by `owner` — read from CHAIN STATE alone (fix round 1, I1: never the decoded
 * instruction, which a dApp program can route an Approve or a close-authority change through by CPI without any
 * top-level instruction that names it). Null when `a` is not a real token account (`isTokenAccountLayout`, I2) or its
 * owner field is not `owner`. `delegate`/`delegatedAmount` (COption<Pubkey> at 72..108, u64 at 121..129) and
 * `closeAuthority` (COption<Pubkey> at 129..165) are read as the runtime does; `lamports` is `a`'s own, for Promoted
 * Minor 3 (a close to a foreign destination moves them out of the wallet's custody without ever touching the wallet's
 * own system account).
 */
interface OwnTokenAccount {
  mint: string;
  amount: bigint;
  lamports: bigint;
  delegate: string | null;
  delegatedAmount: bigint;
  closeAuthority: string | null;
}
function ownTokenAccountOf(a: AccountData | null, owner: string): OwnTokenAccount | null {
  if (a === null || !isTokenAccountLayout(a)) return null;
  if (base58.encode(a.data.subarray(32, 64)) !== owner) return null;
  const view = new DataView(a.data.buffer, a.data.byteOffset, a.data.byteLength);
  return {
    mint: base58.encode(a.data.subarray(0, 32)),
    amount: view.getBigUint64(64, true),
    lamports: a.lamports,
    delegate: view.getUint32(72, true) === 1 ? base58.encode(a.data.subarray(76, 108)) : null,
    delegatedAmount: view.getBigUint64(121, true),
    closeAuthority: view.getUint32(129, true) === 1 ? base58.encode(a.data.subarray(133, 165)) : null,
  };
}

/**
 * The raw owner field (32..64) of any real token-account-layout account, whoever it names — unlike `ownTokenAccountOf`,
 * which already requires the owner to match and so cannot see what it changed TO. Fix round 2, ruled-in: an own
 * account's owner reassigned away (a CPI SetAuthority AccountOwner) is its own re-authentication signal, on top of the
 * −all loss `ownTokenAccountOf`'s owner mismatch already produces (the post side no longer reads as "ours" at all).
 */
function rawTokenOwner(a: AccountData | null): string | null {
  if (a === null || !isTokenAccountLayout(a)) return null;
  return base58.encode(a.data.subarray(32, 64));
}

/** A mint account's decimals (byte 44 of the base layout — 82 bytes classic, or Token-2022 with the same AccountType
 * discriminator at 165, this time marking a Mint (1) rather than an Account (2)), or null. Fix round 2 (Minor,
 * consistent with I2): the same 355-byte exclusion as `isTokenAccountLayout` — a Multisig that happens to be 355 bytes
 * with byte 165 equal to 1 is not an extended Mint either. */
function mintDecimals(a: AccountData | null): number | null {
  if (a === null) return null;
  if (a.owner === TOKEN_PROGRAM) {
    if (a.data.length !== 82) return null;
  } else if (a.owner === TOKEN_2022_PROGRAM) {
    if (!(a.data.length === 82 || (a.data.length > 165 && a.data.length !== 355 && a.data[165] === 1))) return null;
  } else {
    return null;
  }
  return a.data[44] ?? null;
}

/**
 * The network fee, computed locally (B1 §4): 5 000 lamports per required signature plus the priority fee the
 * transaction sets (unit price × unit limit / 10⁶, rounded up; without a limit instruction, 200 000 units per other
 * instruction, at most 1 400 000 — the runtime's defaults).
 */
export function feeOf(p: ParsedTx, decoded: readonly DecodedInstruction[]): {feeLamports: bigint; unitLimit: number} {
  let limit: number | null = null;
  let price = 0n;
  for (const ix of decoded) {
    if (ix.programId !== COMPUTE_BUDGET_PROGRAM) continue;
    const v = ix.fields[0]?.value;
    if (ix.name === 'setComputeUnitLimit' && v?.kind === 'number') limit = Math.min(Number(v.value), MAX_COMPUTE_UNITS);
    if (ix.name === 'setComputeUnitPrice' && v?.kind === 'number') price = BigInt(v.value);
  }
  const others = decoded.filter(ix => ix.programId !== COMPUTE_BUDGET_PROGRAM).length;
  const unitLimit = limit ?? Math.min(others * DEFAULT_UNITS_PER_INSTRUCTION, MAX_COMPUTE_UNITS);
  const priority = (price * BigInt(unitLimit) + 999_999n) / 1_000_000n;
  return {feeLamports: 5_000n * BigInt(p.header.numRequiredSignatures) + priority, unitLimit};
}

/** The node's own word for an unknown blockhash (Q21). */
const isExpired = (err: unknown): boolean => err === 'BlockhashNotFound';

/** USD per whole token for a change's fiat line and the dollar rule: SOL (and wrapped SOL), USDC, USDT, NOC at the stage price; else none. */
async function pricesFor(deps: Pick<WalletDeps, 'prices' | 'stagePrice'>): Promise<(mint: string | null) => number | undefined> {
  const [p, stage] = await Promise.all([deps.prices().catch(() => null), deps.stagePrice().catch(() => null)]);
  return mint => {
    if (mint === null || mint === WRAPPED_SOL_MINT) return p?.solana;
    if (mint === MAINNET_USDC_MINT) return p?.usdc;
    if (mint === MAINNET_USDT_MINT) return p?.usdt;
    if (mint === MAINNET_NOC_MINT) return stage ?? undefined;
    return undefined;
  };
}

export interface SimulateInput {
  account: string;
  wires: readonly Uint8Array[];
  txs: readonly ParsedTx[];
  /** B1b's first-send facts (knownRecipients.ts recipientFacts): an own account or an address sent to before. */
  known: (address: string) => boolean;
  thresholdCents: number;
}

/** Runs the request's transactions through the proxy. Throws when a read fails (the caller records "unreachable"). */
export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'prices' | 'stagePrice' | 'now' | 'randomBytes'>, input: SimulateInput): Promise<TxSimulation> {
  const started = deps.now();
  const {account} = input;
  // 1. Lookup tables, read once for the whole batch.
  const tables = [...new Set(input.txs.flatMap(tablesOf))];
  const tableData = await deps.reader.getAccountsData(tables);
  const tableMap = new Map(tables.map((t, i) => {
    const a = tableData[i] ?? null;
    return [t, a !== null && a.owner === ADDRESS_LOOKUP_TABLE_PROGRAM ? tableAddresses(a.data) : null] as const;
  }));
  const resolved = input.txs.map(p => resolveKeys(p, tableMap));
  // 2. The account's state before.
  const [lamportsBefore, classic, t22, latest] = await Promise.all([
    deps.reader.getBalance(account),
    deps.reader.getTokenAccountsByOwner(account, {programId: TOKEN_PROGRAM}),
    deps.reader.getTokenAccountsByOwner(account, {programId: TOKEN_2022_PROGRAM}),
    deps.reader.getLatestBlockhash(),
  ]);
  const holdings = [...classic, ...t22];
  const before = new Map(holdings.map(h => [h.pubkey, h]));
  const decimals = new Map<string, number>(KNOWN_DECIMALS);
  for (const h of holdings) decimals.set(h.mint, h.decimals);
  const balanceOf = (mint: string | null): bigint => (mint === null ? lamportsBefore : holdings.filter(h => h.mint === mint).reduce((s, h) => s + h.amount, 0n));
  const priceOf = await pricesFor(deps);

  // 3. Each transaction.
  let slot = 0;
  const outcomes: TxOutcome[] = [];
  const decodedAll: DecodedInstruction[][] = [];
  let approvalFromChain = false;
  for (const [i, p] of input.txs.entries()) {
    const keys = resolved[i]?.keys ?? [];
    const decoded = decodeInstructions(p, {keys});
    decodedAll.push(decoded);
    const writable = [...new Set(keys.filter((k, j): k is string => k !== null && k !== account && isWritableIndex(p, j)))];
    const addresses = [account, ...writable];
    // Fix round 1 (I1, I2): the pre state is read fresh, immediately before THIS transaction's own simulation, for
    // exactly the addresses the simulation returns post state for — never the batch's one-time getTokenAccountsByOwner
    // snapshot (`before`, below), which can be stale by the time this transaction simulates (slot skew) and cannot be
    // paired index-for-index with a transaction's own writable set (an own account the snapshot does not cover would
    // otherwise show +post instead of post − pre).
    const preAccounts = await deps.reader.getAccountsData(addresses);
    const sim = await deps.reader.simulateTransaction(base64.encode(input.wires[i] ?? new Uint8Array()), {accounts: addresses});
    slot = Math.max(slot, sim.slot);
    if (sim.err !== null) {
      outcomes.push({ok: false, error: isExpired(sim.err) ? 'expired' : 'failed', detail: JSON.stringify(sim.err)});
      continue;
    }
    const post = sim.accounts ?? [];
    const delta = new Map<string | null, bigint>();
    const add = (mint: string | null, d: bigint) => delta.set(mint, (delta.get(mint) ?? 0n) + d);
    const selfPre = preAccounts[0] ?? null;
    const self = post[0] ?? null;
    add(null, (self?.lamports ?? 0n) - (selfPre?.lamports ?? lamportsBefore));
    for (const [j] of writable.entries()) {
      const preOwn = ownTokenAccountOf(preAccounts[j + 1] ?? null, account);
      const postOwn = ownTokenAccountOf(post[j + 1] ?? null, account);
      // Fix round 2 (IMPORTANT): a native-mint (wSOL) account's lamports ARE its value — the Token program enforces
      // lamports = amount + the rent-exempt reserve for every is_native account, moving real lamports alongside every
      // change to `amount` (a Transfer, a close, a SyncNative after a raw lamport transfer-in). Counting the token
      // `amount` delta AND the lamports delta would show every wrapped lamport moved twice (and, for an inflow, let a
      // dApp show the user receiving double what arrived). A native-mint account therefore produces NO token line at
      // all; its lamports delta (below) is its entire economic change, as SOL.
      const nativeMint = postOwn?.mint === WRAPPED_SOL_MINT || preOwn?.mint === WRAPPED_SOL_MINT;
      if (!nativeMint) {
        if (postOwn !== null) add(postOwn.mint, postOwn.amount - (preOwn?.mint === postOwn.mint ? preOwn.amount : 0n));
        else if (preOwn !== null) add(preOwn.mint, -preOwn.amount);
      }
      // Promoted Minor 3 (and, for a native mint, its whole change): lamports of the wallet's own token accounts
      // (incl. wSOL) are SOL too — a close to a foreign destination moves them out of custody without ever touching
      // the wallet's own system account (`self`, above).
      if (preOwn !== null || postOwn !== null) add(null, (postOwn?.lamports ?? 0n) - (preOwn?.lamports ?? 0n));
      // I1: approval is decided from chain state, not the decoded instruction (a dApp program can raise a delegation,
      // or change the close authority, via CPI with no decodable top-level Approve). A new delegate, or the same
      // delegate with a raised amount, is `approval`; a changed close authority re-authenticates too — the controller
      // ruling leaves the choice of reason to us: documented choice, the same `approval` (no separate copy exists for
      // it yet, and both are "someone else gained a claim on this account" in substance).
      if (postOwn !== null) {
        const priorDelegate = preOwn?.delegate ?? null;
        const priorAmount = preOwn?.delegatedAmount ?? 0n;
        if (postOwn.delegate !== null && (postOwn.delegate !== priorDelegate || postOwn.delegatedAmount > priorAmount)) approvalFromChain = true;
        if (postOwn.closeAuthority !== (preOwn?.closeAuthority ?? null)) approvalFromChain = true;
      }
      // Fix round 2, ruled-in: an own account's owner reassigned away (a CPI SetAuthority AccountOwner) also
      // re-authenticates, on top of the −all loss `ownTokenAccountOf`'s own owner-mismatch already produces above
      // (`postOwn` reads null once the owner no longer matches) — including an otherwise-empty account where only its
      // rent moves and no balance line would otherwise say anything happened at all.
      if (preOwn !== null) {
        const postOwnerField = rawTokenOwner(post[j + 1] ?? null);
        if (postOwnerField !== null && postOwnerField !== account) approvalFromChain = true;
      }
    }
    const {feeLamports, unitLimit} = feeOf(p, decoded);
    const changes: {mint: string | null; amount: bigint}[] = [...delta].filter(([, d]) => d !== 0n).map(([mint, amount]) => ({mint, amount}));
    outcomes.push({ok: true, changes: changes.map(c => ({mint: c.mint, amount: c.amount.toString(), decimals: null, usdMicros: null})), unitsConsumed: sim.unitsConsumed, unitLimit, feeLamports: p.signers[0] === account ? feeLamports.toString() : null});
  }
  // 4. Decimals the holdings did not tell (a mint the account did not hold before), read once.
  const unknownMints = [...new Set(outcomes.flatMap(o => (o.ok ? o.changes.map(c => c.mint) : [])).filter((m): m is string => m !== null && !decimals.has(m)))];
  if (unknownMints.length > 0) {
    const mints = await deps.reader.getAccountsData(unknownMints);
    unknownMints.forEach((m, i) => {
      const d = mintDecimals(mints[i] ?? null);
      if (d !== null) decimals.set(m, d);
    });
  }
  // 5. Decimals and dollars on every change; the outgoing totals per mint for the rules.
  const outgoing = new Map<string | null, bigint>();
  for (const o of outcomes) {
    if (!o.ok) continue;
    for (const c of o.changes) {
      const d = c.mint === null ? 9 : (decimals.get(c.mint) ?? null);
      const amount = BigInt(c.amount);
      const abs = amount < 0n ? -amount : amount;
      const usd = d === null ? null : usdMicros(abs, d, priceOf(c.mint));
      c.decimals = d;
      c.usdMicros = usd === null ? null : (amount < 0n ? -usd : usd).toString();
      if (amount < 0n) outgoing.set(c.mint, (outgoing.get(c.mint) ?? 0n) - amount);
    }
  }
  const firstSend = decodedAll.some(list =>
    list.some(ix => {
      const from = ix.program === 'system' && ix.name === 'transfer' ? addressField(ix, 'from') : (ix.program === 'token' || ix.program === 'token-2022') && (ix.name === 'transfer' || ix.name === 'transferChecked') ? addressField(ix, 'owner') : null;
      const to = ix.program === 'system' ? addressField(ix, 'to') : addressField(ix, 'destination');
      // An own token account (held before) is not a recipient.
      return from === account && to !== null && !input.known(to) && !before.has(to);
    }),
  );
  const reasons = dappReauthReasons({
    outgoing: [...outgoing].map(([mint, amount]) => {
      const d = mint === null ? 9 : (decimals.get(mint) ?? null);
      return {amount, balance: balanceOf(mint), usdMicros: d === null ? null : usdMicros(amount, d, priceOf(mint))};
    }),
    firstSend,
    approval: approvalFromChain,
    thresholdCents: input.thresholdCents,
  });
  return {
    id: base64urlnopad.encode(deps.randomBytes(16)),
    at: deps.now(),
    slot,
    elapsedMs: Math.max(0, deps.now() - started),
    keys: resolved.map(r => r.keys),
    outcomes,
    reasons,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}
