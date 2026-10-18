import {tokenForMint, WALLET_TOKENS, type WalletToken} from '../../../../core/solana/balances';
import type {AccountData} from '../../../../core/solana/rpc';
import {WHOLE_BALANCE_PERCENT, type DappReauthReason} from '../reauthPolicy';
import {SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, type DecodedInstruction, type ProgramKey} from './decode/decode';
import type {ParsedTx} from './decode/wire';
import {mintInfo, tokenAccountInfo, type TokenAccountInfo} from './tokenState';
import {usesDurableNonce} from './txRequest';

/**
 * The red flags (spec B1c §3.3 rev 3.6, B1 §3's table): per transaction of a request, from its decoded instructions,
 * the pre-state read immediately before its simulation, the simulation's post-state, and the mints read through the
 * proxy. Pure — the simulation (Task 3) gathers the reads and stores the result; the window only renders it (C13).
 *
 * F1 unknown program (warn) · F2 an instruction of a decoded program that is not a transfer (warn; Compute Budget is
 * the fee, and O7's three self-rent instructions — an ATA created for and paid by the account, syncNative of an own
 * token account, closeAccount of one to the account — are exempt) · F3 System assign / allocate (and their …WithSeed forms) of the wallet account, or the
 * wallet account owned by another program or holding data after the simulation (block, ASSIGN) · F4 SetAuthority on a
 * token account whose owner field is the wallet, on a mint whose mint or freeze authority is the wallet, or signed by
 * the wallet as the current authority; or, in chain state, an own token account's owner or close authority changed, a
 * mint authority of the wallet's moved (block, AUTHORITY) · F5 an approve of 99 % or more of the source's balance
 * (O5; u64::MAX and the whole balance always are) — decoded against the balance before, or the delegation it leaves
 * against the balance after; in chain state against the balance after (O8) — (block, the wallet's own symbol or
 * UNLIMITED at u64::MAX, ALLOWANCE below it) · F6 any other approve (warn) · F7 a
 * Token-2022 mint's freeze authority, permanent delegate or transfer hook, or a mint that cannot be read (warn; a
 * classic mint never, O3) · F8 a durable nonce (warn) · F9 the whole balance to a first-time address (warn) · F10 a
 * step that depends on an earlier one (block, UNCHECKED). F11 (origin mismatch) is B1c-1/2's and never reaches here.
 */
export const OVERRIDE_WORDS = {assign: 'ASSIGN', setAuthority: 'AUTHORITY', unlimited: 'UNLIMITED', dependent: 'UNCHECKED'} as const;
/** F5's word for a token the wallet cannot name below u64::MAX (review 3 L14) — a second word for the same block kind, so not in OVERRIDE_WORDS (one per kind). */
export const ALLOWANCE_WORD = 'ALLOWANCE';
/** u64::MAX as an approval's base-unit amount (review 3 L14: `UNLIMITED` only for it). */
const U64_MAX = ((1n << 64n) - 1n).toString();

/** What the simulation says of one transaction: its post-state by address, a failure, or that it depends on transaction `on` (0-based). */
export type FlagOutcome = {status: 'simulated'; post: ReadonlyMap<string, AccountData | null>} | {status: 'failed'} | {status: 'dependent'; on: number};

export interface TxFlagInput {
  tx: ParsedTx;
  decoded: readonly DecodedInstruction[];
  /** The wallet account and every writable account, read immediately before this transaction's simulation; null: absent. */
  pre: ReadonlyMap<string, AccountData | null>;
  outcome: FlagOutcome;
  /** Whether a decoded transfer of this transaction sends to a first-time address (B1b's first-send rule). */
  firstSend: boolean;
}

export interface RedFlagInput {
  account: string;
  txs: readonly TxFlagInput[];
  /** Every mint `flagMints` names, as read; a mint not in the map, or null, could not be read. */
  mints: ReadonlyMap<string, AccountData | null>;
  /** The request's re-authentication reasons (B1b's rules over the whole batch). */
  reasons: readonly DappReauthReason[];
}

export interface FlaggedInstruction {
  index: number;
  program: ProgramKey;
  name: string | null;
}
export interface AuthorityInstruction {
  index: number;
  program: ProgramKey;
  account: string;
  /** Why the account is the user's: a token account's owner field, a mint's mint or freeze authority, or the wallet signing as its current authority. */
  owned: 'token-account' | 'mint' | 'current-authority';
  authorityType: string;
  newAuthority: string | null;
}
export interface AuthorityChange {
  account: string;
  change: 'owner' | 'close-authority' | 'mint-authority' | 'freeze-authority';
  from: string | null;
  to: string | null;
}
export interface Approval {
  /** The approving instruction's index; null when it is seen only in chain state (a CPI). */
  at: number | null;
  source: string;
  mint: string | null;
  /** The wallet's own symbol for the mint, only when the mint's decimals match the wallet's table. */
  symbol: WalletToken | null;
  decimals: number | null;
  delegate: string | null;
  /** Base units, decimal strings. */
  amount: string;
  balance: string;
}
export interface Token2022Settings {
  freezeAuthority: string | null;
  permanentDelegate: string | null;
  transferHookProgram: string | null;
}

/** `at`: the index of the first instruction the flag concerns; null for chain state and the whole transaction. */
export type RedFlag =
  | {kind: 'unknown-program'; severity: 'warn'; word: null; at: number; programs: (string | null)[]}
  | {kind: 'non-transfer'; severity: 'warn'; word: null; at: number; instructions: FlaggedInstruction[]}
  | {kind: 'assign'; severity: 'block'; word: 'ASSIGN'; at: number | null; instructions: FlaggedInstruction[]; chain: {owner: string; space: number} | null}
  | {kind: 'set-authority'; severity: 'block'; word: 'AUTHORITY'; at: number | null; instructions: AuthorityInstruction[]; chain: AuthorityChange[]}
  | {kind: 'unlimited-approve'; severity: 'block'; word: string; at: number | null; approvals: Approval[]}
  | {kind: 'bounded-approve'; severity: 'warn'; word: null; at: number | null; approvals: Approval[]}
  /** settings null: the mint could not be read (Q36). */
  | {kind: 'token-2022'; severity: 'warn'; word: null; at: number | null; mint: string; settings: Token2022Settings | null}
  | {kind: 'durable-nonce'; severity: 'warn'; word: null; at: number}
  | {kind: 'whole-balance'; severity: 'warn'; word: null; at: null}
  | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; on: number};
export type RedFlagKind = RedFlag['kind'];
export type TxFlags = RedFlag[];

const KIND_ORDER: readonly RedFlagKind[] = ['unknown-program', 'non-transfer', 'assign', 'set-authority', 'unlimited-approve', 'bounded-approve', 'token-2022', 'durable-nonce', 'whole-balance', 'dependent'];
const ASSIGNS: readonly string[] = ['assign', 'allocate', 'assignWithSeed', 'allocateWithSeed'];

const isToken = (ix: DecodedInstruction): boolean => ix.program === 'token' || ix.program === 'token-2022';
const isTransfer = (ix: DecodedInstruction): boolean => (ix.program === 'system' && ix.name === 'transfer') || (isToken(ix) && (ix.name === 'transfer' || ix.name === 'transferChecked'));
const tokenOf = (a: AccountData | null | undefined): TokenAccountInfo | null => (a === null || a === undefined ? null : tokenAccountInfo(a.data, a.owner));
const plainAccount = (a: AccountData): boolean => a.owner === SYSTEM_PROGRAM && a.data.length === 0;

/** Every mint F5's word and F7 read: those a decoded token or ATA instruction names, then those of the wallet's own token accounts, pre and post. */
export function flagMints(input: Pick<RedFlagInput, 'account' | 'txs'>): string[] {
  return [...new Set(input.txs.flatMap(t => [...mintsOf(input.account, t).keys()]))];
}

function mintsOf(account: string, t: TxFlagInput): Map<string, number | null> {
  const out = new Map<string, number | null>();
  t.decoded.forEach((ix, index) => {
    const mint = isToken(ix) || ix.program === 'associated-token' ? addressField(ix, 'mint') : null;
    if (mint !== null && !out.has(mint)) out.set(mint, index);
  });
  const states = t.outcome.status === 'simulated' ? [t.pre, t.outcome.post] : [t.pre];
  for (const m of states) {
    for (const a of m.values()) {
      const own = tokenOf(a);
      if (own !== null && own.owner === account && !out.has(own.mint)) out.set(own.mint, null);
    }
  }
  return out;
}

/** The flags of every transaction of the request, each list in the order the window shows them. */
export function redFlagsOf(input: RedFlagInput): TxFlags[] {
  return input.txs.map(t => ordered(txFlags(input, t)));
}

function ordered(flags: RedFlag[]): RedFlag[] {
  const at = (f: RedFlag): number => f.at ?? Number.MAX_SAFE_INTEGER;
  return flags
    .map((f, i) => ({f, i}))
    .sort((x, y) => (x.f.severity === y.f.severity ? 0 : x.f.severity === 'block' ? -1 : 1) || at(x.f) - at(y.f) || KIND_ORDER.indexOf(x.f.kind) - KIND_ORDER.indexOf(y.f.kind) || x.i - y.i)
    .map(x => x.f);
}

function txFlags(input: RedFlagInput, t: TxFlagInput): RedFlag[] {
  const {account, mints} = input;
  const {decoded, pre} = t;
  const post = t.outcome.status === 'simulated' ? t.outcome.post : null;
  const out: RedFlag[] = [];
  const indexed = decoded.map((ix, index) => ({ix, index}));

  // F1
  const unknown = indexed.filter(x => x.ix.program === null);
  const first = unknown[0];
  if (first !== undefined) out.push({kind: 'unknown-program', severity: 'warn', word: null, at: first.index, programs: [...new Set(unknown.map(x => x.ix.programId))]});

  // F2 — O7: an own token account created and paid for by the account, synced, or closed to the account is rent only.
  const ownTokenAccount = (address: string | null): boolean => address !== null && tokenOf(pre.get(address))?.owner === account;
  const selfRent = (ix: DecodedInstruction): boolean =>
    (ix.program === 'associated-token' && (ix.name === 'create' || ix.name === 'createIdempotent') && addressField(ix, 'wallet') === account && addressField(ix, 'payer') === account) ||
    (isToken(ix) && ix.name === 'syncNative' && ownTokenAccount(addressField(ix, 'account'))) ||
    (isToken(ix) && ix.name === 'closeAccount' && ownTokenAccount(addressField(ix, 'account')) && addressField(ix, 'destination') === account);
  const named = indexed.flatMap(({ix, index}) => (ix.program === null || ix.program === 'compute-budget' || isTransfer(ix) || selfRent(ix) ? [] : [{index, program: ix.program, name: ix.name}]));
  const firstNamed = named[0];
  if (firstNamed !== undefined) out.push({kind: 'non-transfer', severity: 'warn', word: null, at: firstNamed.index, instructions: named});

  // F3
  const assigns = indexed.flatMap(({ix, index}) => (ix.program === 'system' && ix.name !== null && ASSIGNS.includes(ix.name) && addressField(ix, 'account') === account ? [{index, program: ix.program, name: ix.name}] : []));
  const selfPre = pre.get(account) ?? null;
  const selfPost = post?.get(account) ?? null;
  const assignedChain =
    selfPost !== null && !plainAccount(selfPost) && (selfPre === null || selfPre.owner !== selfPost.owner || selfPre.data.length !== selfPost.data.length) ? {owner: selfPost.owner, space: selfPost.data.length} : null;
  if (assigns.length > 0 || assignedChain !== null) out.push({kind: 'assign', severity: 'block', word: OVERRIDE_WORDS.assign, at: assigns[0]?.index ?? null, instructions: assigns, chain: assignedChain});

  // F4
  const authorities: AuthorityInstruction[] = [];
  for (const {ix, index} of indexed) {
    if (!isToken(ix) || ix.name !== 'setAuthority' || ix.program === null) continue;
    const target = addressField(ix, 'account');
    if (target === null) continue;
    const state = pre.get(target) ?? mints.get(target) ?? null;
    const asAccount = tokenOf(state);
    const asMint = state === null ? null : mintInfo(state.data, state.owner);
    const owned =
      asAccount?.owner === account ? 'token-account' : asMint !== null && (asMint.mintAuthority === account || asMint.freezeAuthority === account) ? 'mint' : addressField(ix, 'currentAuthority') === account ? 'current-authority' : null;
    if (owned === null) continue;
    const type = ix.fields.find(f => f.name === 'authorityType')?.value;
    authorities.push({index, program: ix.program, account: target, owned, authorityType: type?.kind === 'text' ? type.value : '', newAuthority: addressField(ix, 'newAuthority')});
  }
  const changes: AuthorityChange[] = [];
  for (const [address, after] of post ?? []) {
    if (address === account) continue;
    const before = pre.get(address) ?? null;
    const preToken = tokenOf(before);
    const preOwn = preToken?.owner === account ? preToken : null;
    const postToken = tokenOf(after);
    if (preOwn !== null && postToken !== null && postToken.owner !== account) changes.push({account: address, change: 'owner', from: account, to: postToken.owner});
    if (postToken !== null && postToken.owner === account && postToken.closeAuthority !== (preOwn?.closeAuthority ?? null)) {
      changes.push({account: address, change: 'close-authority', from: preOwn?.closeAuthority ?? null, to: postToken.closeAuthority});
    }
    const preMint = before === null ? null : mintInfo(before.data, before.owner);
    const postMint = after === null ? null : mintInfo(after.data, after.owner);
    if (preMint !== null && postMint !== null) {
      if (preMint.mintAuthority === account && postMint.mintAuthority !== account) changes.push({account: address, change: 'mint-authority', from: account, to: postMint.mintAuthority});
      if (preMint.freezeAuthority === account && postMint.freezeAuthority !== account) changes.push({account: address, change: 'freeze-authority', from: account, to: postMint.freezeAuthority});
    }
  }
  if (authorities.length > 0 || changes.length > 0) out.push({kind: 'set-authority', severity: 'block', word: OVERRIDE_WORDS.setAuthority, at: authorities[0]?.index ?? null, instructions: authorities, chain: changes});

  // F5, F6
  const decimalsOf = (mint: string | null): number | null => {
    const a = mint === null ? null : (mints.get(mint) ?? null);
    return a === null ? null : (mintInfo(a.data, a.owner)?.decimals ?? null);
  };
  const symbolOf = (mint: string | null, decimals: number | null): WalletToken | null => {
    const candidate = mint === null ? null : tokenForMint(mint);
    return candidate !== null && decimals === WALLET_TOKENS[candidate].decimals ? candidate : null;
  };
  // Unlimited (O5): 99 % or more of the balance — u64::MAX and the whole balance always are. O8: each balance where it is
  // exact — a decoded approve's amount against the source's balance before (0 when it held nothing or could not be read:
  // a block, review 3 L13), or the delegation it leaves (its own delegate's, no more than it granted — L12) against the
  // balance after; a delegation seen in chain state against the balance after.
  const nearlyAll = (amount: bigint, balance: bigint): boolean => amount * 100n >= balance * WHOLE_BALANCE_PERCENT;
  const found: {approval: Approval; unlimited: boolean}[] = [];
  const approval = (at: number | null, source: string, mint: string | null, delegate: string | null, amount: bigint, balance: bigint, unlimited: boolean) => {
    const decimals = decimalsOf(mint);
    found.push({approval: {at, source, mint, symbol: symbolOf(mint, decimals), decimals, delegate, amount: amount.toString(), balance: balance.toString()}, unlimited});
  };
  const ownAfter = (address: string): TokenAccountInfo | null => {
    const a = tokenOf(post?.get(address));
    return a !== null && a.owner === account ? a : null;
  };
  for (const {ix, index} of indexed) {
    if (!isToken(ix) || (ix.name !== 'approve' && ix.name !== 'approveChecked')) continue;
    const source = addressField(ix, 'source');
    const value = ix.fields.find(f => f.name === 'amount')?.value;
    if (source === null || value?.kind !== 'amount') continue;
    const src = tokenOf(pre.get(source));
    const own = src !== null && src.owner === account;
    if (!own && addressField(ix, 'owner') !== account) continue;
    const amount = BigInt(value.value);
    const before = own ? src.amount : 0n;
    const after = ownAfter(source);
    const delegate = addressField(ix, 'delegate');
    const left = after !== null && after.delegate !== null && after.delegate === delegate && after.delegatedAmount <= amount && nearlyAll(after.delegatedAmount, after.amount);
    approval(index, source, src?.mint ?? addressField(ix, 'mint'), delegate, amount, before, nearlyAll(amount, before) || left);
  }
  for (const [address, after] of post ?? []) {
    const postToken = tokenOf(after);
    if (postToken === null || postToken.owner !== account || postToken.delegate === null) continue;
    const preToken = tokenOf(pre.get(address));
    const preOwn = preToken?.owner === account ? preToken : null;
    if (postToken.delegate === (preOwn?.delegate ?? null) && postToken.delegatedAmount <= (preOwn?.delegatedAmount ?? 0n)) continue;
    approval(null, address, postToken.mint, postToken.delegate, postToken.delegatedAmount, postToken.amount, nearlyAll(postToken.delegatedAmount, postToken.amount));
  }
  const approvals = found.filter(x => x.approval.at !== null || !found.some(y => y.approval.at !== null && y.approval.source === x.approval.source && y.unlimited === x.unlimited));
  const unlimited = approvals.filter(x => x.unlimited).map(x => x.approval);
  const unlimitedSources = new Set(unlimited.map(a => a.source));
  const bounded = approvals.filter(x => !x.unlimited && !unlimitedSources.has(x.approval.source)).map(x => x.approval);
  if (unlimited.length > 0) {
    const symbols = [...new Set(unlimited.map(a => a.symbol))];
    const only = symbols.length === 1 ? symbols[0] : null;
    const unnamed = unlimited.some(a => a.amount === U64_MAX) ? OVERRIDE_WORDS.unlimited : ALLOWANCE_WORD;
    out.push({kind: 'unlimited-approve', severity: 'block', word: only ?? unnamed, at: unlimited.find(a => a.at !== null)?.at ?? null, approvals: unlimited});
  }
  if (bounded.length > 0) out.push({kind: 'bounded-approve', severity: 'warn', word: null, at: bounded.find(a => a.at !== null)?.at ?? null, approvals: bounded});

  // F7
  for (const [mint, at] of mintsOf(account, t)) {
    const a = mints.get(mint) ?? null;
    if (a !== null && a.owner === TOKEN_PROGRAM) continue;
    const info = a !== null && a.owner === TOKEN_2022_PROGRAM ? mintInfo(a.data, a.owner) : null;
    if (info === null) {
      out.push({kind: 'token-2022', severity: 'warn', word: null, at, mint, settings: null});
    } else if (info.freezeAuthority !== null || info.permanentDelegate !== null || info.transferHookProgram !== null) {
      out.push({kind: 'token-2022', severity: 'warn', word: null, at, mint, settings: {freezeAuthority: info.freezeAuthority, permanentDelegate: info.permanentDelegate, transferHookProgram: info.transferHookProgram}});
    }
  }

  // F8, F9, F10
  if (usesDurableNonce(t.tx)) out.push({kind: 'durable-nonce', severity: 'warn', word: null, at: 0});
  if (t.firstSend && input.reasons.includes('whole-balance-to-new')) out.push({kind: 'whole-balance', severity: 'warn', word: null, at: null});
  if (t.outcome.status === 'dependent') out.push({kind: 'dependent', severity: 'block', word: OVERRIDE_WORDS.dependent, at: null, on: t.outcome.on});
  return out;
}

/** The words the user must type: one per (transaction, block kind), in the transactions' order and each one's flag order. */
export function expectedOverrides(flags: readonly (readonly RedFlag[])[]): {tx: number; word: string}[] {
  return flags.flatMap((list, tx) => list.flatMap(f => (f.severity === 'block' ? [{tx, word: f.word}] : [])));
}

/**
 * Whether the words the window sent are exactly the expected ones (exact, case-sensitive): `ok`; `missing` when some
 * expected word was not given and nothing else is wrong; `mismatch` for any entry not expected, or one given twice.
 */
export function overridesMatch(flags: readonly (readonly RedFlag[])[], given: readonly {tx: number; word: string}[]): 'ok' | 'missing' | 'mismatch' {
  const key = (o: {tx: number; word: string}): string => JSON.stringify([o.tx, o.word]);
  const expected = new Set(expectedOverrides(flags).map(key));
  const seen = new Set<string>();
  for (const g of given) {
    const k = key(g);
    if (!expected.has(k) || seen.has(k)) return 'mismatch';
    seen.add(k);
  }
  return seen.size === expected.size ? 'ok' : 'missing';
}
