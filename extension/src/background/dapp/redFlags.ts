import {tokenForMint, WALLET_TOKENS, type WalletToken} from '../../../../core/solana/balances';
import type {AccountData} from '../../../../core/solana/rpc';
import type {GeoAnswer, GeoReason} from '../geo/gate';
import {WHOLE_BALANCE_PERCENT, type DappReauthReason} from '../reauthPolicy';
import {AUTHORITY_TYPES, PRESALE_PROGRAM, SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, type DecodedInstruction, type ProgramKey} from './decode/decode';
import {PRESALE_INSTRUCTIONS} from './decode/presaleIdl';
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
 * token account, closeAccount of one to the account — are exempt; an instruction F3, F4, F5, F6 or F8 already names is
 * not repeated) · F3 System assign / allocate (and their …WithSeed forms) of the wallet account, or the
 * wallet account owned by another program or holding data after the simulation (block, ASSIGN) · F4 SetAuthority on a
 * token account whose owner field is the wallet, on a mint whose mint or freeze authority is the wallet, or signed by
 * the wallet as the current authority; or, in chain state, an own token account's owner or close authority changed, a
 * mint authority of the wallet's moved (block, AUTHORITY) · F5 an approve of 99 % or more of the source's balance
 * (O5; u64::MAX and the whole balance always are) — decoded against the balance before, or the delegation it leaves
 * against the balance after; in chain state against the balance after (O8); each balance less what the batch's other
 * transactions send out of the source (final review I1) — (block, the wallet's own symbol or
 * UNLIMITED at u64::MAX, ALLOWANCE below it) · F6 any other approve (warn) · F7 a
 * Token-2022 mint's freeze authority, permanent delegate or transfer hook, or a mint that cannot be read (warn; a
 * classic mint never, O3) · F8 a durable nonce (warn) · F9 the whole balance to a first-time address (warn) · F10 a
 * step that depends on an earlier one (block, UNCHECKED). F11 (origin mismatch) is B1c-1/2's and never reaches here.
 * F12 (B1d §3.6, D9, D15) a presale purchase while the jurisdiction gate is not open — a refusal (`severity: 'refuse'`):
 * no word, no re-authentication and no setting opens it; it sorts before every block.
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
  /** B1d §3.6: the jurisdiction gate's answer for a request carrying a presale purchase; absent or null — not asked, so a purchase is F12 `no_check`. */
  region?: GeoAnswer | null;
}

export interface FlaggedInstruction {
  index: number;
  program: ProgramKey;
  name: string | null;
}
export interface AuthorityInstruction {
  index: number;
  /** Fix round 1 (Task 4 ⚠️, type parity): narrowed from `ProgramKey` — `isToken` below is the only producer, and it
   * is now a type predicate, so this matches `approve/client.ts`'s own `AuthorityInstruction.program` at compile time. */
  program: 'token' | 'token-2022';
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
/**
 * Fix round 1 (Task 4 ⚠️, type parity): the symbols F5's word and an approval's `symbol` can actually carry — never
 * 'SOL', despite `WalletToken`'s wider declared type. `tokenForMint` (core/solana/balances.ts) loops only these three;
 * it can never return 'SOL'. This is the union `approve/client.ts`'s `FlagSymbol` already uses on the window side —
 * narrowing it here makes the background and the window agree at compile time, with no change to either's behaviour.
 */
export type ApprovalSymbol = Exclude<WalletToken, 'SOL'>;
/**
 * Final review M1: the symbols F5's word can be, derived from the wallet's own table (every token but SOL — an approve
 * is of a token account) — the background's one list; the challenge store's F5 words are built from it, and a test
 * (f5Words.test.ts) pins the approval window's and the vault page's copies, which import nothing, equal to it.
 */
export const APPROVAL_SYMBOLS: readonly ApprovalSymbol[] = (Object.keys(WALLET_TOKENS) as WalletToken[]).filter((t): t is ApprovalSymbol => t !== 'SOL');

export interface Approval {
  /** The approving instruction's index; null when it is seen only in chain state (a CPI). */
  at: number | null;
  source: string;
  mint: string | null;
  /** The wallet's own symbol for the mint, only when the mint's decimals match the wallet's table. */
  symbol: ApprovalSymbol | null;
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
  | {kind: 'unlimited-approve'; severity: 'block'; word: ApprovalSymbol | 'UNLIMITED' | 'ALLOWANCE'; at: number | null; approvals: Approval[]}
  | {kind: 'bounded-approve'; severity: 'warn'; word: null; at: number | null; approvals: Approval[]}
  /** settings null: the mint could not be read (Q36). */
  | {kind: 'token-2022'; severity: 'warn'; word: null; at: number | null; mint: string; settings: Token2022Settings | null}
  | {kind: 'durable-nonce'; severity: 'warn'; word: null; at: number}
  | {kind: 'whole-balance'; severity: 'warn'; word: null; at: null}
  | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; on: number}
  /** F12: `at` the transaction's first purchase instruction; `reason` the gate's closed answer. */
  | {kind: 'presale-region'; severity: 'refuse'; word: null; at: number; reason: GeoReason};
export type RedFlagKind = RedFlag['kind'];
export type TxFlags = RedFlag[];

const KIND_ORDER: readonly RedFlagKind[] = ['presale-region', 'unknown-program', 'non-transfer', 'assign', 'set-authority', 'unlimited-approve', 'bounded-approve', 'token-2022', 'durable-nonce', 'whole-balance', 'dependent'];
const ASSIGNS: readonly string[] = ['assign', 'allocate', 'assignWithSeed', 'allocateWithSeed'];
/** A refusal first, then the blocks, then the warnings. */
const SEVERITY_RANK: Readonly<Record<RedFlag['severity'], number>> = {refuse: 0, block: 1, warn: 2};

/** B1d §3.6: the presale program's six purchase instructions — F12's; never a claim, the referral or an admin instruction. */
export const PRESALE_PURCHASES: readonly string[] = [
  'presale_purchase_with_sol',
  'presale_purchase_with_usdc',
  'presale_purchase_with_usdt',
  'presale_purchase_and_vest_stake',
  'presale_purchase_usdc_and_vest_stake',
  'presale_purchase_usdt_and_vest_stake',
];
const PURCHASE_DISCRIMINATORS: readonly (readonly number[])[] = PRESALE_INSTRUCTIONS.filter(x => PRESALE_PURCHASES.includes(x.name)).map(x => x.discriminator);

/**
 * The indexes of `tx`'s top-level presale purchases: the program the presale's and the first 8 data bytes one of the
 * six discriminators, whether or not the rest parses strictly (B1d §3.6). A purchase reached by a CPI is not seen here.
 */
export function presalePurchasesOf(tx: ParsedTx): number[] {
  return tx.instructions.flatMap((ix, i) =>
    tx.staticKeys[ix.program] === PRESALE_PROGRAM && ix.data.length >= 8 && PURCHASE_DISCRIMINATORS.some(d => d.every((b, j) => ix.data[j] === b)) ? [i] : [],
  );
}

// Fix round 1 (Task 4 ⚠️, type parity): a type predicate, not a plain boolean — the only producer of F4's
// `AuthorityInstruction.program`, so its narrowing is what proves that field's type below; no behaviour change.
const isToken = (ix: DecodedInstruction): ix is DecodedInstruction & {program: 'token' | 'token-2022'} => ix.program === 'token' || ix.program === 'token-2022';
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
  return input.txs.map((t, k) => ordered(txFlags(input, t, k)));
}

function ordered(flags: RedFlag[]): RedFlag[] {
  const at = (f: RedFlag): number => f.at ?? Number.MAX_SAFE_INTEGER;
  return flags
    .map((f, i) => ({f, i}))
    .sort((x, y) => SEVERITY_RANK[x.f.severity] - SEVERITY_RANK[y.f.severity] || at(x.f) - at(y.f) || KIND_ORDER.indexOf(x.f.kind) - KIND_ORDER.indexOf(y.f.kind) || x.i - y.i)
    .map(x => x.f);
}

function txFlags(input: RedFlagInput, t: TxFlagInput, k: number): RedFlag[] {
  const {account, mints} = input;
  const {decoded, pre} = t;
  const post = t.outcome.status === 'simulated' ? t.outcome.post : null;
  const out: RedFlag[] = [];
  const indexed = decoded.map((ix, index) => ({ix, index}));

  // F12
  const purchase = presalePurchasesOf(t.tx)[0];
  if (purchase !== undefined && input.region?.open !== true) out.push({kind: 'presale-region', severity: 'refuse', word: null, at: purchase, reason: input.region?.reason ?? 'no_check'});

  // F1
  const unknown = indexed.filter(x => x.ix.program === null);
  const first = unknown[0];
  if (first !== undefined) out.push({kind: 'unknown-program', severity: 'warn', word: null, at: first.index, programs: [...new Set(unknown.map(x => x.ix.programId))]});

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
  const symbolOf = (mint: string | null, decimals: number | null): ApprovalSymbol | null => {
    const candidate = mint === null ? null : tokenForMint(mint);
    // `candidate !== 'SOL'` is always true here (tokenForMint never returns it) — it only narrows the type, proving
    // F5's word can never be 'SOL' without changing which mints are recognised.
    return candidate !== null && candidate !== 'SOL' && decimals === WALLET_TOKENS[candidate].decimals ? candidate : null;
  };
  // Unlimited (O5): 99 % or more of the balance — u64::MAX and the whole balance always are. O8: each balance where it is
  // exact — a decoded approve's amount against the source's balance before (0 when it held nothing or could not be read:
  // a block, review 3 L13), or the delegation it leaves (its own delegate's, no more than it granted — L12) against the
  // balance after; a delegation seen in chain state against the balance after.
  const nearlyAll = (amount: bigint, balance: bigint): boolean => amount * 100n >= balance * WHOLE_BALANCE_PERCENT;
  // Final review I1: every transaction of a batch is simulated against the state as it is now, so an approve in step k
  // would be judged against a balance other steps of the batch move out, before it or after it. What EVERY OTHER
  // simulated step sends out of an own source (its pre-state's amount minus its post-state's; an account it closes or
  // hands to another owner counts as all of it) is taken off that source's balances here (the controller's ruling on
  // the I1 fix: earlier and later steps alike) — fail closed only: an inflow never raises them. A failed or dependent
  // step has no post-state and drains nothing (spec §9).
  const drained = (source: string): bigint => {
    let out = 0n;
    for (const earlier of input.txs.filter((_, j) => j !== k)) {
      if (earlier.outcome.status !== 'simulated' || !earlier.outcome.post.has(source)) continue;
      const was = tokenOf(earlier.pre.get(source));
      if (was === null || was.owner !== account) continue;
      const now = tokenOf(earlier.outcome.post.get(source));
      const left = now !== null && now.owner === account ? now.amount : 0n;
      if (was.amount > left) out += was.amount - left;
    }
    return out;
  };
  const lessDrained = (source: string, balance: bigint): bigint => {
    const d = drained(source);
    return balance > d ? balance - d : 0n;
  };
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
    const before = lessDrained(source, own ? src.amount : 0n);
    const after = ownAfter(source);
    const delegate = addressField(ix, 'delegate');
    const left = after !== null && after.delegate !== null && after.delegate === delegate && after.delegatedAmount <= amount && nearlyAll(after.delegatedAmount, lessDrained(source, after.amount));
    approval(index, source, src?.mint ?? addressField(ix, 'mint'), delegate, amount, before, nearlyAll(amount, before) || left);
  }
  for (const [address, after] of post ?? []) {
    const postToken = tokenOf(after);
    if (postToken === null || postToken.owner !== account || postToken.delegate === null) continue;
    const preToken = tokenOf(pre.get(address));
    const preOwn = preToken?.owner === account ? preToken : null;
    if (postToken.delegate === (preOwn?.delegate ?? null) && postToken.delegatedAmount <= (preOwn?.delegatedAmount ?? 0n)) continue;
    const balance = lessDrained(address, postToken.amount);
    approval(null, address, postToken.mint, postToken.delegate, postToken.delegatedAmount, balance, nearlyAll(postToken.delegatedAmount, balance));
  }
  // A chain-state delegation is folded into a decoded approve only when it is that approve's own (Task 2 review I1): the
  // same source and severity, the same delegate, and no more than it granted — otherwise it is listed with its own
  // delegate and amount (an account has one delegate: the post-state's is the one that exists after the transaction).
  const ownDelegation = (x: Approval, y: Approval): boolean => y.source === x.source && y.delegate === x.delegate && BigInt(x.amount) <= BigInt(y.amount);
  const approvals = found.filter(x => x.approval.at !== null || !found.some(y => y.approval.at !== null && y.unlimited === x.unlimited && ownDelegation(x.approval, y.approval)));
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

  // F2, last: an instruction a more specific flag of this transaction already names (F3, F4, F5, F6, F8) is not repeated;
  // O7: an own token account created and paid for by the account, synced, or closed to the account is rent only.
  const specific = new Set(out.flatMap(namedBy));
  const ownTokenAccount = (address: string | null): boolean => address !== null && tokenOf(pre.get(address))?.owner === account;
  const selfRent = (ix: DecodedInstruction): boolean =>
    (ix.program === 'associated-token' && (ix.name === 'create' || ix.name === 'createIdempotent') && addressField(ix, 'wallet') === account && addressField(ix, 'payer') === account) ||
    (isToken(ix) && ix.name === 'syncNative' && ownTokenAccount(addressField(ix, 'account'))) ||
    (isToken(ix) && ix.name === 'closeAccount' && ownTokenAccount(addressField(ix, 'account')) && addressField(ix, 'destination') === account);
  const named = indexed.flatMap(({ix, index}) => (ix.program === null || ix.program === 'compute-budget' || isTransfer(ix) || selfRent(ix) || specific.has(index) ? [] : [{index, program: ix.program, name: ix.name}]));
  const firstNamed = named[0];
  if (firstNamed !== undefined) out.push({kind: 'non-transfer', severity: 'warn', word: null, at: firstNamed.index, instructions: named});
  return out;
}

/** The instructions a flag names by index — F3's and F4's, F5's and F6's decoded approvals, F8's first instruction. */
function namedBy(f: RedFlag): number[] {
  switch (f.kind) {
    case 'assign':
    case 'set-authority':
      return f.instructions.map(x => x.index);
    case 'unlimited-approve':
    case 'bounded-approve':
      return f.approvals.flatMap(a => (a.at === null ? [] : [a.at]));
    case 'durable-nonce':
      return [f.at];
    default:
      return [];
  }
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

type J = Record<string, unknown>;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DIGITS = /^\d{1,20}$/;
const PROGRAM_KEYS: readonly string[] = ['system', 'token', 'token-2022', 'associated-token', 'compute-budget', 'presale'];
const AUTHORITY_TYPE_NAMES: readonly string[] = ['', ...AUTHORITY_TYPES];
const TOKENS: readonly string[] = Object.keys(WALLET_TOKENS);
const GEO_REASONS: Readonly<Record<GeoReason, true>> = {refused: true, no_check: true, stale_list: true, unknown_country: true, sanctioned: true};
/** One of the gate's closed reasons (geo/gate.ts). */
export const isGeoReason = (x: unknown): x is GeoReason => typeof x === 'string' && Object.hasOwn(GEO_REASONS, x);
/** `x` as an object with exactly these keys, or null. */
const exactly = (x: unknown, keys: readonly string[]): J | null => {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const o = x as J;
  return Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k)) ? o : null;
};
const isIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isIndexOrNull = (x: unknown): x is number | null => x === null || isIndex(x);
const isAddress = (x: unknown): x is string => typeof x === 'string' && ADDRESS.test(x);
const isAddressOrNull = (x: unknown): x is string | null => x === null || isAddress(x);
/** Every item read by `f` (fresh), or null when any is not; `nonEmpty` refuses an empty list. */
function listOf<T>(x: unknown, f: (v: unknown) => T | null, nonEmpty: boolean): T[] | null {
  if (!Array.isArray(x) || (nonEmpty && x.length === 0)) return null;
  const out: T[] = [];
  for (const v of x as unknown[]) {
    const r = f(v);
    if (r === null) return null;
    out.push(r);
  }
  return out;
}

function flaggedOf(x: unknown): FlaggedInstruction | null {
  const o = exactly(x, ['index', 'program', 'name']);
  if (o === null || !isIndex(o.index) || typeof o.program !== 'string' || !PROGRAM_KEYS.includes(o.program) || !(o.name === null || typeof o.name === 'string')) return null;
  return {index: o.index, program: o.program as ProgramKey, name: o.name};
}

function authorityOf(x: unknown): AuthorityInstruction | null {
  const o = exactly(x, ['index', 'program', 'account', 'owned', 'authorityType', 'newAuthority']);
  if (o === null || !isIndex(o.index) || (o.program !== 'token' && o.program !== 'token-2022') || !isAddress(o.account) || !isAddressOrNull(o.newAuthority)) return null;
  if ((o.owned !== 'token-account' && o.owned !== 'mint' && o.owned !== 'current-authority') || typeof o.authorityType !== 'string' || !AUTHORITY_TYPE_NAMES.includes(o.authorityType)) return null;
  return {index: o.index, program: o.program, account: o.account, owned: o.owned, authorityType: o.authorityType, newAuthority: o.newAuthority};
}

function changeOf(x: unknown): AuthorityChange | null {
  const o = exactly(x, ['account', 'change', 'from', 'to']);
  if (o === null || !isAddress(o.account) || !isAddressOrNull(o.from) || !isAddressOrNull(o.to)) return null;
  if (o.change !== 'owner' && o.change !== 'close-authority' && o.change !== 'mint-authority' && o.change !== 'freeze-authority') return null;
  return {account: o.account, change: o.change, from: o.from, to: o.to};
}

function approvalOf(x: unknown): Approval | null {
  const o = exactly(x, ['at', 'source', 'mint', 'symbol', 'decimals', 'delegate', 'amount', 'balance']);
  if (o === null || !isIndexOrNull(o.at) || !isAddress(o.source) || !isAddressOrNull(o.mint) || !isAddressOrNull(o.delegate) || !(o.decimals === null || (isIndex(o.decimals) && o.decimals <= 255))) return null;
  if (typeof o.amount !== 'string' || !DIGITS.test(o.amount) || typeof o.balance !== 'string' || !DIGITS.test(o.balance)) return null;
  // The symbol is the wallet's own name for the mint, only at its own decimals (redFlagsOf's rule) — never another.
  if (o.symbol !== null && (typeof o.symbol !== 'string' || !TOKENS.includes(o.symbol) || o.mint === null || tokenForMint(o.mint) !== o.symbol || o.decimals !== WALLET_TOKENS[o.symbol as WalletToken].decimals)) return null;
  // `tokenForMint(o.mint) !== o.symbol` above already rejects 'SOL' (tokenForMint never returns it), so this narrows safely.
  return {at: o.at, source: o.source, mint: o.mint, symbol: o.symbol as ApprovalSymbol | null, decimals: o.decimals, delegate: o.delegate, amount: o.amount, balance: o.balance};
}

function settingsOf(x: unknown): Token2022Settings | null {
  const o = exactly(x, ['freezeAuthority', 'permanentDelegate', 'transferHookProgram']);
  if (o === null || !isAddressOrNull(o.freezeAuthority) || !isAddressOrNull(o.permanentDelegate) || !isAddressOrNull(o.transferHookProgram)) return null;
  if (o.freezeAuthority === null && o.permanentDelegate === null && o.transferHookProgram === null) return null;
  return {freezeAuthority: o.freezeAuthority, permanentDelegate: o.permanentDelegate, transferHookProgram: o.transferHookProgram};
}

const firstAt = (approvals: readonly Approval[]): number | null => approvals.find(a => a.at !== null)?.at ?? null;

/** One stored flag, rebuilt field by field (fresh objects) — null when its shape, its severity or its word is not what redFlagsOf gives. */
function storedFlagOf(x: unknown): RedFlag | null {
  const head = typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as J) : null;
  if (head === null) return null;
  switch (head.kind) {
    case 'unknown-program': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'programs']);
      const programs = listOf(o?.programs, v => (isAddressOrNull(v) ? {v} : null), true);
      if (o === null || o.severity !== 'warn' || o.word !== null || !isIndex(o.at) || programs === null) return null;
      return {kind: 'unknown-program', severity: 'warn', word: null, at: o.at, programs: programs.map(p => p.v)};
    }
    case 'non-transfer': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions']);
      const instructions = listOf(o?.instructions, flaggedOf, true);
      const first = instructions?.[0];
      if (o === null || o.severity !== 'warn' || o.word !== null || first === undefined || o.at !== first.index || instructions === null) return null;
      return {kind: 'non-transfer', severity: 'warn', word: null, at: first.index, instructions};
    }
    case 'assign': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions', 'chain']);
      const instructions = listOf(o?.instructions, v => {
        const f = flaggedOf(v);
        return f !== null && f.program === 'system' && f.name !== null && ASSIGNS.includes(f.name) ? f : null;
      }, false);
      if (o === null || o.severity !== 'block' || o.word !== OVERRIDE_WORDS.assign || instructions === null) return null;
      let chain: {owner: string; space: number} | null = null;
      if (o.chain !== null) {
        const c = exactly(o.chain, ['owner', 'space']);
        if (c === null || !isAddress(c.owner) || !isIndex(c.space)) return null;
        chain = {owner: c.owner, space: c.space};
      }
      if ((instructions.length === 0 && chain === null) || o.at !== (instructions[0]?.index ?? null)) return null;
      return {kind: 'assign', severity: 'block', word: OVERRIDE_WORDS.assign, at: instructions[0]?.index ?? null, instructions, chain};
    }
    case 'set-authority': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions', 'chain']);
      const instructions = listOf(o?.instructions, authorityOf, false);
      const chain = listOf(o?.chain, changeOf, false);
      if (o === null || o.severity !== 'block' || o.word !== OVERRIDE_WORDS.setAuthority || instructions === null || chain === null) return null;
      if ((instructions.length === 0 && chain.length === 0) || o.at !== (instructions[0]?.index ?? null)) return null;
      return {kind: 'set-authority', severity: 'block', word: OVERRIDE_WORDS.setAuthority, at: instructions[0]?.index ?? null, instructions, chain};
    }
    case 'unlimited-approve':
    case 'bounded-approve': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'approvals']);
      const approvals = listOf(o?.approvals, approvalOf, true);
      if (o === null || approvals === null || o.at !== firstAt(approvals)) return null;
      if (head.kind === 'bounded-approve') return o.severity === 'warn' && o.word === null ? {kind: 'bounded-approve', severity: 'warn', word: null, at: firstAt(approvals), approvals} : null;
      const symbols = [...new Set(approvals.map(a => a.symbol))];
      const word = (symbols.length === 1 ? symbols[0] : null) ?? (approvals.some(a => a.amount === U64_MAX) ? OVERRIDE_WORDS.unlimited : ALLOWANCE_WORD);
      return o.severity === 'block' && o.word === word ? {kind: 'unlimited-approve', severity: 'block', word, at: firstAt(approvals), approvals} : null;
    }
    case 'token-2022': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'mint', 'settings']);
      const settings = o?.settings === null ? null : settingsOf(o?.settings);
      if (o === null || o.severity !== 'warn' || o.word !== null || !isIndexOrNull(o.at) || !isAddress(o.mint) || (o.settings !== null && settings === null)) return null;
      return {kind: 'token-2022', severity: 'warn', word: null, at: o.at, mint: o.mint, settings};
    }
    case 'durable-nonce': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at']);
      return o !== null && o.severity === 'warn' && o.word === null && o.at === 0 ? {kind: 'durable-nonce', severity: 'warn', word: null, at: 0} : null;
    }
    case 'whole-balance': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at']);
      return o !== null && o.severity === 'warn' && o.word === null && o.at === null ? {kind: 'whole-balance', severity: 'warn', word: null, at: null} : null;
    }
    case 'dependent': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'on']);
      return o !== null && o.severity === 'block' && o.word === OVERRIDE_WORDS.dependent && o.at === null && isIndex(o.on) ? {kind: 'dependent', severity: 'block', word: OVERRIDE_WORDS.dependent, at: null, on: o.on} : null;
    }
    case 'presale-region': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'reason']);
      return o !== null && o.severity === 'refuse' && o.word === null && isIndex(o.at) && isGeoReason(o.reason) ? {kind: 'presale-region', severity: 'refuse', word: null, at: o.at, reason: o.reason} : null;
    }
    default:
      return null;
  }
}

/** One transaction's stored flags (simulate.ts's simStateOf), rebuilt — null when any flag is off. */
export function storedFlagsOf(x: unknown): TxFlags | null {
  return listOf(x, storedFlagOf, false);
}
