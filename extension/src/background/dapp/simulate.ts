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
 * (bigint, rule 2): SOL from the wallet account (the fee included, as the node reports it), each token from the
 * account's token accounts (pre: getTokenAccountsByOwner for both token programs; post: the simulated 165-byte layout
 * whose owner field is this account). The transactions of a batch are simulated one by one against the current state
 * (a node cannot chain them). The re-authentication reasons (B1b's rules) are computed here, from the changes and the
 * decoded instructions, so `dapp.decide` needs no read of its own.
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

const TOKEN_PROGRAMS: ReadonlySet<string> = new Set([TOKEN_PROGRAM, TOKEN_2022_PROGRAM]);

/** A token account of `owner` in its post-state: mint and amount, or null when it is not one (or no longer exists). */
function tokenAccountOf(a: AccountData | null, owner: string): {mint: string; amount: bigint} | null {
  if (a === null || !TOKEN_PROGRAMS.has(a.owner) || a.data.length < 165) return null;
  if (base58.encode(a.data.subarray(32, 64)) !== owner) return null;
  return {mint: base58.encode(a.data.subarray(0, 32)), amount: new DataView(a.data.buffer, a.data.byteOffset, a.data.byteLength).getBigUint64(64, true)};
}

/** A mint account's decimals (byte 44 of the base layout), or null. */
function mintDecimals(a: AccountData | null): number | null {
  if (a === null || !TOKEN_PROGRAMS.has(a.owner) || a.data.length < 82) return null;
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
  for (const [i, p] of input.txs.entries()) {
    const keys = resolved[i]?.keys ?? [];
    const decoded = decodeInstructions(p, {keys});
    decodedAll.push(decoded);
    const writable = [...new Set(keys.filter((k, j): k is string => k !== null && k !== account && isWritableIndex(p, j)))];
    const addresses = [account, ...writable];
    const sim = await deps.reader.simulateTransaction(base64.encode(input.wires[i] ?? new Uint8Array()), {accounts: addresses});
    slot = Math.max(slot, sim.slot);
    if (sim.err !== null) {
      outcomes.push({ok: false, error: isExpired(sim.err) ? 'expired' : 'failed', detail: JSON.stringify(sim.err)});
      continue;
    }
    const post = sim.accounts ?? [];
    const delta = new Map<string | null, bigint>();
    const add = (mint: string | null, d: bigint) => delta.set(mint, (delta.get(mint) ?? 0n) + d);
    const self = post[0] ?? null;
    add(null, (self?.lamports ?? 0n) - lamportsBefore);
    for (const [j, address] of writable.entries()) {
      const after = tokenAccountOf(post[j + 1] ?? null, account);
      const pre = before.get(address);
      if (after !== null) add(after.mint, after.amount - (pre?.mint === after.mint ? pre.amount : 0n));
      else if (pre !== undefined) add(pre.mint, -pre.amount);
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
  const approval = decodedAll.some(list => list.some(ix => (ix.program === 'token' || ix.program === 'token-2022') && (ix.name === 'approve' || ix.name === 'approveChecked') && addressField(ix, 'owner') === account));
  const reasons = dappReauthReasons({
    outgoing: [...outgoing].map(([mint, amount]) => {
      const d = mint === null ? 9 : (decimals.get(mint) ?? null);
      return {amount, balance: balanceOf(mint), usdMicros: d === null ? null : usdMicros(amount, d, priceOf(mint))};
    }),
    firstSend,
    approval,
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
