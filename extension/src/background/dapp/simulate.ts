import {base64, base64urlnopad} from '@scure/base';
import type {WalletDeps} from '../deps';
import {dappReauthReasons, usdMicros, type DappReauthReason} from '../reauthPolicy';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../core/presale/addresses';
import {MAX_MULTIPLE_ACCOUNTS, type AccountData} from '../../../../core/solana/rpc';
import {COMPUTE_BUDGET_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, decodeInstructions, type DecodedInstruction} from './decode/decode';
import {ADDRESS_LOOKUP_TABLE_PROGRAM, resolveKeys, tableAddresses, tablesOf} from './decode/keys';
import {isWritableIndex, type ParsedTx} from './decode/wire';
import {expectedOverrides, flagMints, redFlagsOf, storedFlagsOf, type FlagOutcome, type RedFlag, type TxFlagInput} from './redFlags';
import {mintInfo, tokenAccountInfo} from './tokenState';

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
 * for a per-transaction pre amount). A native-mint account — is_native itself (fix round 3: both SOL's own wSOL mint
 * AND Token-2022's own, distinct native mint carry the identical invariant), never just WRAPPED_SOL_MINT — produces NO
 * token line at all (fix round 2, IMPORTANT): its lamports already are its value (the Token program enforces
 * lamports = amount + rent for every is_native account), so counting both would show every wrapped lamport moved
 * twice. The transactions of a batch are simulated one by one
 * against the current state (a node cannot chain them). The re-authentication reasons (B1b's rules) are computed here —
 * `approval` from chain state too (a new or raised delegation, a changed close authority, or an own account's owner
 * reassigned away — fix round 2, ruled-in: a dApp program can CPI an Approve, a SetAuthority close-authority change or a
 * SetAuthority AccountOwner with no top-level instruction that names it) — so `dapp.decide` needs no read of its own.
 * B1c-3 (spec §3.3 rev 3.6): the red flags (redFlags.ts) are computed here too, from the same reads plus one read of
 * every mint they need, and stored with the simulation; a block adds the reason `override`. A failed transaction of a
 * batch whose error names an account an earlier transaction creates is `dependent` (F10).
 */
export const DEFAULT_UNITS_PER_INSTRUCTION = 200_000;
export const MAX_COMPUTE_UNITS = 1_400_000;
export const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
/** The most decimals #48 formats an amount with (the window's own bound); a mint with more stays in base units. */
const MAX_DECIMALS = 18;
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
  | {ok: false; error: 'expired' | 'failed'; detail: string}
  /** B1c-3 (F10): it failed on an account transaction `on` (1-based) of the same batch creates — its effects unknown. */
  | {ok: false; error: 'dependent'; on: number; detail: string};

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
  /** B1c-3: per transaction, its red flags (redFlags.ts), in the order the window shows them. */
  flags: RedFlag[][];
  /**
   * B1c-3: per transaction, the decimals of each non-Checked Token / Token-2022 `transfer`, `approve` or `burn` (by its
   * instruction index) whose source account the pre-state reads as a token account of that instruction's program —
   * its mint's, as the simulation knows them (0–18); #48 shows that amount with them, every other one in base units.
   */
  amountDecimals: AmountDecimals[][];
  /** An upper bound of the dApp blockhash's last valid height (the latest blockhash's, read now): a pending send's expiry check waits at least this long. */
  lastValidBlockHeight: number;
}

export interface AmountDecimals {
  at: number;
  decimals: number;
}

/** The non-Checked amounts a token instruction carries without decimals, and the account its amount leaves. */
const NON_CHECKED: Readonly<Record<string, string>> = {transfer: 'source', approve: 'source', burn: 'account'};

/**
 * B1c-3: the mint of each non-Checked transfer / approve / burn's source account, by instruction index — only when
 * the pre-state reads it as a token account of the instruction's own program (a burn: of the mint it names); the
 * token program refuses any other, so no other mint is named.
 */
function amountMintsOf(decoded: readonly DecodedInstruction[], pre: ReadonlyMap<string, AccountData | null>): {at: number; mint: string}[] {
  return decoded.flatMap((ix, at) => {
    const role = (ix.program === 'token' || ix.program === 'token-2022') && ix.name !== null ? NON_CHECKED[ix.name] : undefined;
    const source = role === undefined ? null : addressField(ix, role);
    const state = source === null ? null : (pre.get(source) ?? null);
    const info = state === null ? null : tokenAccountInfo(state.data, state.owner);
    if (info === null || info.program !== ix.program || (ix.name === 'burn' && addressField(ix, 'mint') !== info.mint)) return [];
    return [{at, mint: info.mint}];
  });
}

/** `decoded` with each non-Checked amount `list` names given its decimals (txDetail, for #48); every other field as decoded. */
export function withAmountDecimals(decoded: DecodedInstruction[], list: readonly AmountDecimals[]): DecodedInstruction[] {
  return decoded.map((ix, at) => {
    const decimals = list.find(x => x.at === at)?.decimals;
    if (decimals === undefined) return ix;
    return {...ix, fields: ix.fields.map(f => (f.name === 'amount' && f.value.kind === 'amount' && f.value.decimals === null ? {name: f.name, value: {kind: 'amount', value: f.value.value, decimals}} : f))};
  });
}

/**
 * `a`'s state as a token account owned by `owner` — read from CHAIN STATE alone (fix round 1, I1: never the decoded
 * instruction, which a dApp program can route an Approve or a close-authority change through by CPI without any
 * top-level instruction that names it). Null when `a` is not a real token account (tokenState's `tokenAccountInfo` — I2:
 * never by length alone, a 355-byte Multisig excluded; B1c-3: one parser for the simulation and the red flags) or its
 * owner field is not `owner`. `lamports` is `a`'s own, for Promoted Minor 3 (a close to a foreign destination moves them
 * out of the wallet's custody without ever touching the wallet's own system account). `isNative` is the `is_native`
 * COption's own tag — fix round 3, IMPORTANT: this, not the mint address, is what decides native status (below), since
 * Token-2022 has its OWN native mint (`9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP`) carrying the identical invariant at
 * the identical offset.
 */
interface OwnTokenAccount {
  mint: string;
  amount: bigint;
  lamports: bigint;
  delegate: string | null;
  delegatedAmount: bigint;
  closeAuthority: string | null;
  isNative: boolean;
}
function ownTokenAccountOf(a: AccountData | null, owner: string): OwnTokenAccount | null {
  const t = a === null ? null : tokenAccountInfo(a.data, a.owner);
  if (a === null || t === null || t.owner !== owner) return null;
  return {mint: t.mint, amount: t.amount, lamports: a.lamports, delegate: t.delegate, delegatedAmount: t.delegatedAmount, closeAuthority: t.closeAuthority, isNative: t.isNative};
}

/**
 * The raw owner field of any real token account, whoever it names — unlike `ownTokenAccountOf`, which already requires
 * the owner to match and so cannot see what it changed TO. Fix round 2, ruled-in: an own account's owner reassigned
 * away (a CPI SetAuthority AccountOwner) is its own re-authentication signal, on top of the −all loss
 * `ownTokenAccountOf`'s owner mismatch already produces (the post side no longer reads as "ours" at all).
 */
function rawTokenOwner(a: AccountData | null): string | null {
  return a === null ? null : (tokenAccountInfo(a.data, a.owner)?.owner ?? null);
}

/** A mint account's decimals (tokenState's `mintInfo`: either program's mint, never a 355-byte Multisig — fix round 2,
 * Minor, consistent with I2), or null. */
function mintDecimals(a: AccountData | null): number | null {
  return a === null ? null : (mintInfo(a.data, a.owner)?.decimals ?? null);
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

/**
 * Controller ruling (B1c-3 Task 3, ledger): a transaction naming an account a lookup table did not resolve (an index
 * the tables the wallet read do not hold) is Reject only, exactly like a failed simulation — its outcome is `failed`
 * with this detail whatever the node answers (the node resolves the table itself, perhaps to an account the wallet
 * never showed). F1 still names every instruction touching it. The wallet's own detail, never a node error's name.
 */
export const UNRESOLVED_LOOKUP_DETAIL = 'unresolved-lookup-table-address';

/** The account an instruction creates (F10's creators, spec §3.3 "Attribution"), or null. */
function createdBy(ix: DecodedInstruction): string | null {
  if (ix.program === 'system' && (ix.name === 'createAccount' || ix.name === 'createAccountWithSeed')) return addressField(ix, 'newAccount');
  if (ix.program === 'associated-token' && (ix.name === 'create' || ix.name === 'createIdempotent')) return addressField(ix, 'account');
  if ((ix.program === 'token' || ix.program === 'token-2022') && (ix.name === 'initializeAccount' || ix.name === 'initializeAccount2' || ix.name === 'initializeAccount3')) return addressField(ix, 'account');
  return null;
}

/**
 * The accounts a simulation's error names, for F10's attribution — null for every other error. Agave's
 * `TransactionError` as the RPC returns it (serde's JSON; mirrored by @solana/errors' `transaction-error.ts`, "Keep
 * synced with RPC source: agave/sdk/src/transaction/error.rs"): `{"InstructionError": [i, <InstructionError>]}` —
 * instruction i of the message failed: its resolved accounts; `"AccountNotFound"` — the fee payer holds no lamports
 * (Agave's fee-payer check): the fee payer. Nothing else names an account a transaction could have created.
 */
function accountsNamed(err: unknown, p: ParsedTx, keys: readonly (string | null)[]): string[] | null {
  if (err === 'AccountNotFound') return p.staticKeys.slice(0, 1);
  if (typeof err !== 'object' || err === null || Array.isArray(err) || Object.keys(err).length !== 1) return null;
  const pair: unknown = (err as Record<string, unknown>).InstructionError;
  if (!Array.isArray(pair) || pair.length !== 2) return null;
  const i: unknown = pair[0];
  const ix = typeof i === 'number' && Number.isSafeInteger(i) && i >= 0 ? p.instructions[i] : undefined;
  return ix === undefined ? null : ix.accounts.map(a => keys[a] ?? null).filter((a): a is string => a !== null);
}

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
  const flagInputs: TxFlagInput[] = [];
  /** Per transaction, its non-Checked amounts' mints (B1c-3). */
  const amountMints: {at: number; mint: string}[][] = [];
  /** Per transaction, the accounts it creates (F10). */
  const created: Set<string>[] = [];
  let approvalFromChain = false;
  for (const [i, p] of input.txs.entries()) {
    const keys = resolved[i]?.keys ?? [];
    const decoded = decodeInstructions(p, {keys});
    created.push(new Set(decoded.map(createdBy).filter((a): a is string => a !== null)));
    const writable = [...new Set(keys.filter((k, j): k is string => k !== null && k !== account && isWritableIndex(p, j)))];
    const addresses = [account, ...writable];
    // Fix round 1 (I1, I2): the pre state is read fresh, immediately before THIS transaction's own simulation, for
    // exactly the addresses the simulation returns post state for — never the batch's one-time getTokenAccountsByOwner
    // snapshot (`before`, below), which can be stale by the time this transaction simulates (slot skew) and cannot be
    // paired index-for-index with a transaction's own writable set (an own account the snapshot does not cover would
    // otherwise show +post instead of post − pre).
    const preAccounts = await deps.reader.getAccountsData(addresses);
    const pre = new Map(addresses.map((a, j) => [a, preAccounts[j] ?? null]));
    amountMints.push(amountMintsOf(decoded, pre));
    const firstSend = firstSendOf(decoded, pre, account, input.known, a => before.has(a));
    const sim = await deps.reader.simulateTransaction(base64.encode(input.wires[i] ?? new Uint8Array()), {accounts: addresses});
    slot = Math.max(slot, sim.slot);
    if (keys.includes(null)) {
      outcomes.push({ok: false, error: 'failed', detail: UNRESOLVED_LOOKUP_DETAIL});
      flagInputs.push({tx: p, decoded, pre, outcome: {status: 'failed'}, firstSend});
      continue;
    }
    if (sim.err !== null) {
      const detail = JSON.stringify(sim.err);
      // F10 (O2): a transaction k ≥ 2 whose error names an account an earlier transaction of the batch creates — the
      // earliest such step. An expired blockhash is never dependent.
      const named = isExpired(sim.err) ? null : accountsNamed(sim.err, p, keys);
      const on = named === null ? -1 : created.slice(0, i).findIndex(c => named.some(a => c.has(a)));
      const outcome: TxOutcome = isExpired(sim.err) ? {ok: false, error: 'expired', detail} : on >= 0 ? {ok: false, error: 'dependent', on: on + 1, detail} : {ok: false, error: 'failed', detail};
      outcomes.push(outcome);
      flagInputs.push({tx: p, decoded, pre, outcome: on >= 0 ? {status: 'dependent', on} : {status: 'failed'}, firstSend});
      continue;
    }
    const post = sim.accounts ?? [];
    const flagOutcome: FlagOutcome = {status: 'simulated', post: new Map(addresses.map((a, j) => [a, post[j] ?? null]))};
    flagInputs.push({tx: p, decoded, pre, outcome: flagOutcome, firstSend});
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
      // Fix round 3 (IMPORTANT, still open after round 2): native status is decided from the is_native COption tag
      // itself (pre OR post), never the mint address alone — Token-2022 has its own native mint
      // (9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP) carrying the identical invariant at the identical offset, so a
      // WRAPPED_SOL_MINT-only check would miss it (a dApp could fund a wallet-owned Token-2022 native account by CPI
      // and show the gain twice). The mint check stays, but only as an extra — never the sole test.
      const nativeMint = preOwn?.isNative === true || postOwn?.isNative === true || postOwn?.mint === WRAPPED_SOL_MINT || preOwn?.mint === WRAPPED_SOL_MINT;
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
  // 4. The mints, read once: every one the red flags need (the wallet's own tokens too — F5's word compares the mint's
  // own decimals with the wallet's table) and the decimals the holdings did not tell (a mint the account did not hold
  // before). At most one read's worth: a mint past MAX_MULTIPLE_ACCOUNTS is not read — it warns that it could not be
  // read (Q36) and its amounts stay in base units (fail closed, never an unreachable proxy).
  const changed = outcomes.flatMap(o => (o.ok ? o.changes.map(c => c.mint) : []));
  const unknownMints = [...new Set([...changed, ...amountMints.flat().map(x => x.mint)].filter((m): m is string => m !== null && !decimals.has(m)))];
  const wanted = [...new Set([...flagMints({account, txs: flagInputs}), ...unknownMints])].slice(0, MAX_MULTIPLE_ACCOUNTS);
  const mintData = wanted.length > 0 ? await deps.reader.getAccountsData(wanted) : [];
  const mints = new Map(wanted.map((m, i) => [m, mintData[i] ?? null]));
  for (const m of unknownMints) {
    const d = mintDecimals(mints.get(m) ?? null);
    if (d !== null) decimals.set(m, d);
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
  const firstSend = flagInputs.some(t => t.firstSend);
  const base = dappReauthReasons({
    outgoing: [...outgoing].map(([mint, amount]) => {
      const d = mint === null ? 9 : (decimals.get(mint) ?? null);
      return {amount, balance: balanceOf(mint), usdMicros: d === null ? null : usdMicros(amount, d, priceOf(mint))};
    }),
    firstSend,
    approval: approvalFromChain,
    thresholdCents: input.thresholdCents,
  });
  const flags = redFlagsOf({account, txs: flagInputs, mints, reasons: base});
  const amountDecimals = amountMints.map(list =>
    list.flatMap(({at, mint}) => {
      const d = decimals.get(mint);
      return d !== undefined && d <= MAX_DECIMALS ? [{at, decimals: d}] : [];
    }),
  );
  // The override rule (spec §3.3): a request with any block re-authenticates — a dependent step is always one.
  const reasons: DappReauthReason[] = expectedOverrides(flags).length > 0 ? [...base, 'override'] : base;
  return {
    id: base64urlnopad.encode(deps.randomBytes(16)),
    at: deps.now(),
    slot,
    elapsedMs: Math.max(0, deps.now() - started),
    keys: resolved.map(r => r.keys),
    outcomes,
    reasons,
    flags,
    amountDecimals,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}

/**
 * B1b's first-send rule for one transaction (F9 is per transaction): a decoded System transfer from the account to an
 * address it never sent to, or a Token / Token-2022 transfer signed by the account whose destination's OWNER is not
 * one (R10, spec §9): the destination's pre-state as a token account gives its owner field; absent before and created
 * in the same transaction by an ATA create / createIdempotent, that instruction's wallet. A destination unreadable, not
 * a token account, or not created by the transaction is a first send (fail closed). `known`: B1b's recipients; `held`:
 * the account's own token accounts in the holdings snapshot (never a recipient).
 */
function firstSendOf(decoded: readonly DecodedInstruction[], pre: ReadonlyMap<string, AccountData | null>, account: string, known: (address: string) => boolean, held: (address: string) => boolean): boolean {
  const ownerOf = (destination: string): string | null => {
    const state = pre.get(destination) ?? null;
    if (state !== null) return tokenAccountInfo(state.data, state.owner)?.owner ?? null;
    const creating = decoded.find(ix => ix.program === 'associated-token' && (ix.name === 'create' || ix.name === 'createIdempotent') && addressField(ix, 'account') === destination);
    return creating === undefined ? null : addressField(creating, 'wallet');
  };
  return decoded.some(ix => {
    if (ix.program === 'system' && ix.name === 'transfer') {
      const to = addressField(ix, 'to');
      return addressField(ix, 'from') === account && to !== null && !known(to) && !held(to);
    }
    if ((ix.program !== 'token' && ix.program !== 'token-2022') || (ix.name !== 'transfer' && ix.name !== 'transferChecked') || addressField(ix, 'owner') !== account) return false;
    const to = addressField(ix, 'destination');
    if (to === null || held(to)) return false;
    const owner = ownerOf(to);
    return owner === null || !(owner === account || known(owner));
  });
}

/** What an entry holds (store.ts): the newest simulation, or that the last attempt could not reach the proxy. */
export type SimState = {status: 'ok'; sim: TxSimulation} | {status: 'unreachable'; at: number};

const REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new', 'approval', 'override'];
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isIntOrNull = (x: unknown): x is number | null => x === null || isInt(x);
const SIGNED = /^-?\d{1,40}$/;
const DIGITS = /^\d{1,40}$/;
const SIM_ID = /^[A-Za-z0-9_-]{22}$/;
const obj = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null);

function changeOf(x: unknown): BalanceChange | null {
  const o = obj(x);
  if (o === null || !(o.mint === null || typeof o.mint === 'string') || typeof o.amount !== 'string' || !SIGNED.test(o.amount) || !isIntOrNull(o.decimals)) return null;
  if (!(o.usdMicros === null || (typeof o.usdMicros === 'string' && SIGNED.test(o.usdMicros)))) return null;
  return {mint: o.mint, amount: o.amount, decimals: o.decimals, usdMicros: o.usdMicros};
}

const isUnresolvedFailure = (o: TxOutcome | null): boolean => o !== null && !o.ok && o.error === 'failed' && o.detail === UNRESOLVED_LOOKUP_DETAIL;

function outcomeOf(x: unknown): TxOutcome | null {
  const o = obj(x);
  if (o === null) return null;
  if (o.ok === false && o.error === 'dependent') return isInt(o.on) && o.on >= 1 && typeof o.detail === 'string' ? {ok: false, error: 'dependent', on: o.on, detail: o.detail} : null;
  if (o.ok === false) return (o.error === 'expired' || o.error === 'failed') && typeof o.detail === 'string' ? {ok: false, error: o.error, detail: o.detail} : null;
  if (o.ok !== true || !Array.isArray(o.changes) || !isIntOrNull(o.unitsConsumed) || !isInt(o.unitLimit) || !(o.feeLamports === null || (typeof o.feeLamports === 'string' && DIGITS.test(o.feeLamports)))) return null;
  const changes = (o.changes as unknown[]).map(changeOf);
  if (changes.some(c => c === null)) return null;
  return {ok: true, changes: changes as BalanceChange[], unitsConsumed: o.unitsConsumed, unitLimit: o.unitLimit, feeLamports: o.feeLamports};
}

/** One transaction's stored non-Checked decimals, rebuilt; null when any entry is not exactly {at, decimals ≤ 18}. */
function amountDecimalsOf(x: unknown): AmountDecimals[] | null {
  if (!Array.isArray(x)) return null;
  const out: AmountDecimals[] = [];
  for (const v of x as unknown[]) {
    const o = obj(v);
    if (o === null || Object.keys(o).length !== 2 || !isInt(o.at) || !isInt(o.decimals) || o.decimals > MAX_DECIMALS) return null;
    out.push({at: o.at, decimals: o.decimals});
  }
  return out;
}

/** A stored SimState, rebuilt field by field (fresh objects, never the stored ones); null when anything is off — it is then simulated again. */
export function simStateOf(x: unknown): SimState | null {
  const o = obj(x);
  if (o === null) return null;
  if (o.status === 'unreachable') return isInt(o.at) ? {status: 'unreachable', at: o.at} : null;
  const s = o.status === 'ok' ? obj(o.sim) : null;
  if (s === null || typeof s.id !== 'string' || !SIM_ID.test(s.id) || !isInt(s.at) || !isInt(s.slot) || !isInt(s.elapsedMs) || !isInt(s.lastValidBlockHeight)) return null;
  if (!Array.isArray(s.keys) || !(s.keys as unknown[]).every(k => Array.isArray(k) && (k as unknown[]).every(a => a === null || typeof a === 'string'))) return null;
  if (!Array.isArray(s.outcomes) || !Array.isArray(s.reasons) || !(s.reasons as unknown[]).every(r => typeof r === 'string' && REASONS.includes(r))) return null;
  const outcomes = (s.outcomes as unknown[]).map(outcomeOf);
  if (outcomes.some(x => x === null) || outcomes.length !== s.keys.length) return null;
  // The controller's lookup ruling: a transaction with an unresolved key is stored only as that failure.
  if ((s.keys as (string | null)[][]).some((k, i) => k.includes(null) && !isUnresolvedFailure(outcomes[i] ?? null))) return null;
  // B1c-3: the flags, one list per transaction, each flag exactly as redFlagsOf gives it; a block ⇔ the reason
  // `override`; a dependent outcome ⇔ its transaction's F10 flag naming the same step (the flag's `on` is 0-based).
  const flags = Array.isArray(s.flags) ? (s.flags as unknown[]).map(storedFlagsOf) : null;
  if (flags === null || flags.length !== outcomes.length || flags.some(f => f === null)) return null;
  const lists = flags as RedFlag[][];
  if (lists.some(l => l.some(f => f.severity === 'block')) !== (s.reasons as unknown[]).includes('override')) return null;
  const stepsAgree = (outcomes as TxOutcome[]).every((o, i) => {
    const on = lists[i]?.find(f => f.kind === 'dependent')?.on;
    return !o.ok && o.error === 'dependent' ? on === o.on - 1 && on < i : on === undefined;
  });
  if (!stepsAgree) return null;
  const amountDecimals = Array.isArray(s.amountDecimals) ? (s.amountDecimals as unknown[]).map(amountDecimalsOf) : null;
  if (amountDecimals === null || amountDecimals.length !== outcomes.length || amountDecimals.some(a => a === null)) return null;
  return {
    status: 'ok',
    sim: {
      id: s.id,
      at: s.at,
      slot: s.slot,
      elapsedMs: s.elapsedMs,
      keys: (s.keys as (string | null)[][]).map(k => k.slice()),
      outcomes: outcomes as TxOutcome[],
      reasons: (s.reasons as DappReauthReason[]).slice(),
      flags: lists,
      amountDecimals: amountDecimals as AmountDecimals[][],
      lastValidBlockHeight: s.lastValidBlockHeight,
    },
  };
}
