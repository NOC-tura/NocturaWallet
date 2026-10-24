import {send as runtimeSend} from '../ui/send';

/**
 * The approval window's one way to the background (spec §1.4, §2.3, §4.3): `dapp.pending` and `dapp.decide`, nothing
 * else. Every reply is shape-checked before a screen sees it (as the popup's engine.ts does); a reply of any other
 * shape is null — the window keeps what it shows and asks again on its next poll. The window holds no state and no
 * listener (C5, C13): what it shows always comes from here.
 */
export type SiteKind = 'verified' | 'unknown' | 'lookalike';
export interface IdnDetail {
  char: string;
  codePoint: string;
  script: string | null;
  latin: string;
  latinCodePoint: string;
}
export interface Site {
  kind: SiteKind;
  name: string;
  imitates: string | null;
  rule: 'idn' | 'edit' | 'embedded' | 'swap' | 'subdomain' | null;
  idn: IdnDetail | null;
  international: boolean;
}
export interface AccountChoice {
  index: number;
  name: string;
  publicKey: string;
}
export interface ConnectDetail {
  accounts: AccountChoice[];
  selected: number;
  cap: boolean;
}
export interface SignDetail {
  account: AccountChoice;
  text: string;
  chars: number;
  keyword: string | null;
  marks: {start: number; end: number}[];
  siwsMismatch: string | null;
}
/** B1c-2 (#48): what the background decoded, as decode.ts builds it — re-checked here like everything else it sends. */
export type ProgramKey = 'system' | 'token' | 'token-2022' | 'associated-token' | 'compute-budget' | 'presale';
export type FieldValue =
  | {kind: 'address'; value: string}
  /**
   * Fix round 1, I1: a legitimate protocol-level absence (setAuthority's new authority when the Option tag is 0,
   * Token-2022's OptionalNonZeroPubkey of all zero bytes) — decode.ts's own distinct value, never the same shape as
   * a resolution failure (which makes the whole instruction unknown instead — `address` is never null here).
   */
  | {kind: 'none'}
  | {kind: 'lamports'; value: string}
  | {kind: 'amount'; value: string; decimals: number | null}
  | {kind: 'number'; value: string}
  | {kind: 'bool'; value: boolean}
  | {kind: 'text'; value: string}
  | {kind: 'hex'; value: string};
export interface Field {
  name: string;
  value: FieldValue;
}
export interface DecodedInstruction {
  programId: string | null;
  program: ProgramKey | null;
  name: string | null;
  fields: Field[];
}
export interface BalanceChange {
  mint: string | null;
  amount: string;
  decimals: number | null;
  usdMicros: string | null;
}
export type TxOutcome =
  | {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null}
  | {ok: false; error: 'expired' | 'failed'; detail: string}
  /** B1c-3 (F10): it depends on step `on` (1-based) of the same batch. */
  | {ok: false; error: 'dependent'; on: number; detail: string};
/**
 * B1c-3 (spec §3.3 rev 3.6): the red flags as the background computed them (redFlags.ts) — the window renders them and
 * computes none (C13). `at`: the first instruction a flag concerns (0-based), null for chain state and the whole
 * transaction. A dependent step names the step it depends on as `step`, 1-based — read it with `dependsOnStep`.
 */
export type FlagSymbol = 'NOC' | 'USDC' | 'USDT';
export interface FlaggedInstruction {
  index: number;
  program: ProgramKey;
  name: string | null;
}
export interface AuthorityInstruction {
  index: number;
  program: 'token' | 'token-2022';
  account: string;
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
  at: number | null;
  source: string;
  mint: string | null;
  symbol: FlagSymbol | null;
  decimals: number | null;
  delegate: string | null;
  amount: string;
  balance: string;
}
export interface Token2022Settings {
  freezeAuthority: string | null;
  permanentDelegate: string | null;
  transferHookProgram: string | null;
}
export type Flag =
  | {kind: 'unknown-program'; severity: 'warn'; word: null; at: number; programs: (string | null)[]}
  | {kind: 'non-transfer'; severity: 'warn'; word: null; at: number; instructions: FlaggedInstruction[]}
  | {kind: 'assign'; severity: 'block'; word: 'ASSIGN'; at: number | null; instructions: FlaggedInstruction[]; chain: {owner: string; space: number} | null}
  | {kind: 'set-authority'; severity: 'block'; word: 'AUTHORITY'; at: number | null; instructions: AuthorityInstruction[]; chain: AuthorityChange[]}
  | {kind: 'unlimited-approve'; severity: 'block'; word: FlagSymbol | 'UNLIMITED' | 'ALLOWANCE'; at: number | null; approvals: Approval[]}
  | {kind: 'bounded-approve'; severity: 'warn'; word: null; at: number | null; approvals: Approval[]}
  /** settings null: the mint could not be read (Q36). */
  | {kind: 'token-2022'; severity: 'warn'; word: null; at: number | null; mint: string; settings: Token2022Settings | null}
  | {kind: 'durable-nonce'; severity: 'warn'; word: null; at: 0}
  | {kind: 'whole-balance'; severity: 'warn'; word: null; at: null}
  | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; step: number}
  /** B1d §3.6, F12: a presale purchase while the region check is not open — Reject only; `countryCode` the detected one (Q50a). */
  | {kind: 'presale-region'; severity: 'refuse'; word: null; at: number; reason: RegionReason; countryCode: string | null};
/** The jurisdiction gate's closed reasons (geo/gate.ts `GeoReason`). */
export type RegionReason = 'refused' | 'no_check' | 'stale_list' | 'unknown_country' | 'sanctioned';
const REGION_REASONS: readonly string[] = ['refused', 'no_check', 'stale_list', 'unknown_country', 'sanctioned'];
const COUNTRY = /^[A-Z]{2}$/;
export interface TxItem {
  version: 'legacy' | 0;
  feePayer: string;
  instructions: DecodedInstruction[] | null;
  /** Fix round 1 (promoted minor 3, R5): computed locally (signTx.ts's `feeOf`) — present before any simulation answers. */
  unitLimit: number | null;
  feeLamports: string | null;
  outcome: TxOutcome | null;
  /** B1c-3: this transaction's red flags, blocks first (null while simulating, as `outcome`). */
  flags: Flag[] | null;
}

/** B1c-3 (Q32): the step (1-based, as the copy says it) this transaction depends on, or null — the one way the window reads it. */
export const dependsOnStep = (t: TxItem): number | null => t.flags?.find(f => f.kind === 'dependent')?.step ?? null;
export type SimulationView = {status: 'simulating'} | {status: 'unreachable'} | {status: 'ok'; id: string; slot: number; elapsedMs: number; at: number};
export interface AddressLabel {
  address: string;
  kind: 'account' | 'contact';
  name: string;
}
export interface TxDetail {
  kind: 'signTransaction' | 'signAndSendTransaction';
  account: AccountChoice;
  transactions: TxItem[];
  simulation: SimulationView;
  reauth: {reasons: string[]; state: 'needed' | 'waiting' | 'proven'} | null;
  labels: AddressLabel[];
}
export interface RequestView {
  requestId: string;
  type: 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction' | 'mismatch';
  origin: string;
  host: string;
  site: Site;
  offerBlock: boolean;
  connect: ConnectDetail | null;
  sign: SignDetail | null;
  tx: TxDetail | null;
  mismatch: {granted: string} | null;
}
export type PendingView = {state: 'none'} | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};
/** B1c-3: an approval's `overrides` — the typed word of each blocked (transaction, kind), `tx` the 0-based index in the batch. */
export type Decision =
  | {decision: 'reject' | 'report' | 'block'}
  | {decision: 'approve'; account: string; scope?: 'session' | 'persistent'; simulation?: string; overrides?: {tx: number; word: string}[]};
export type DecideReply = {ok: true} | {ok: false; error: string};

type J = Record<string, unknown>;
const obj = (x: unknown): J | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as J) : undefined);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isBool = (x: unknown): x is boolean => typeof x === 'boolean';
const nullOr = <T,>(x: unknown, f: (v: unknown) => T | undefined): T | null | undefined => (x === null ? null : f(x));

function idnOf(x: unknown): IdnDetail | undefined {
  const o = obj(x);
  if (o === undefined || !isStr(o.char) || !isStr(o.codePoint) || !(o.script === null || isStr(o.script)) || !isStr(o.latin) || !isStr(o.latinCodePoint)) return undefined;
  return {char: o.char, codePoint: o.codePoint, script: o.script, latin: o.latin, latinCodePoint: o.latinCodePoint};
}

function siteOf(x: unknown): Site | undefined {
  const o = obj(x);
  if (o === undefined || (o.kind !== 'verified' && o.kind !== 'unknown' && o.kind !== 'lookalike') || !isStr(o.name) || !isBool(o.international)) return undefined;
  const imitates = nullOr(o.imitates, v => (isStr(v) ? v : undefined));
  const rule = nullOr(o.rule, v => (v === 'idn' || v === 'edit' || v === 'embedded' || v === 'swap' || v === 'subdomain' ? v : undefined));
  const idn = nullOr(o.idn, idnOf);
  if (imitates === undefined || rule === undefined || idn === undefined) return undefined;
  return {kind: o.kind, name: o.name, imitates, rule, idn, international: o.international};
}

function accountOf(x: unknown): AccountChoice | undefined {
  const o = obj(x);
  return o !== undefined && isInt(o.index) && isStr(o.name) && isStr(o.publicKey) ? {index: o.index, name: o.name, publicKey: o.publicKey} : undefined;
}

function connectOf(x: unknown): ConnectDetail | undefined {
  const o = obj(x);
  if (o === undefined || !Array.isArray(o.accounts) || !isInt(o.selected) || !isBool(o.cap)) return undefined;
  const accounts = (o.accounts as unknown[]).map(accountOf);
  if (accounts.some(a => a === undefined)) return undefined;
  return {accounts: accounts as AccountChoice[], selected: o.selected, cap: o.cap};
}

function signOf(x: unknown): SignDetail | undefined {
  const o = obj(x);
  const account = accountOf(o?.account);
  if (o === undefined || account === undefined || !isStr(o.text) || !isInt(o.chars) || !(o.keyword === null || isStr(o.keyword)) || !Array.isArray(o.marks)) return undefined;
  const marks: {start: number; end: number}[] = [];
  for (const m of o.marks as unknown[]) {
    const r = obj(m);
    if (r === undefined || !isInt(r.start) || !isInt(r.end) || r.end <= r.start || r.end > o.text.length) return undefined;
    marks.push({start: r.start, end: r.end});
  }
  if (!(o.siwsMismatch === null || isStr(o.siwsMismatch))) return undefined;
  return {account, text: o.text, chars: o.chars, keyword: o.keyword, marks, siwsMismatch: o.siwsMismatch};
}

const PROGRAM_KEYS: readonly string[] = ['system', 'token', 'token-2022', 'associated-token', 'compute-budget', 'presale'];
const DIGITS = /^\d{1,40}$/;
const SIGNED = /^-?\d{1,40}$/;

function fieldValueOf(x: unknown): FieldValue | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  // Fix round 1, I1: `address` is never null (the background never sends it); a legitimate absence is its own `none`.
  if (o.kind === 'address') return isStr(o.value) ? {kind: 'address', value: o.value} : undefined;
  if (o.kind === 'none') return {kind: 'none'};
  if (o.kind === 'lamports') return isStr(o.value) && DIGITS.test(o.value) ? {kind: 'lamports', value: o.value} : undefined;
  // An i64 argument (the presale program's) may be negative.
  if (o.kind === 'number') return isStr(o.value) && SIGNED.test(o.value) ? {kind: 'number', value: o.value} : undefined;
  if (o.kind === 'amount') return isStr(o.value) && DIGITS.test(o.value) && (o.decimals === null || (isInt(o.decimals) && o.decimals <= 18)) ? {kind: 'amount', value: o.value, decimals: o.decimals} : undefined;
  if (o.kind === 'bool') return isBool(o.value) ? {kind: 'bool', value: o.value} : undefined;
  if (o.kind === 'text' || o.kind === 'hex') return isStr(o.value) ? {kind: o.kind, value: o.value} : undefined;
  return undefined;
}

function instructionOf(x: unknown): DecodedInstruction | undefined {
  const o = obj(x);
  if (o === undefined || !(o.programId === null || isStr(o.programId)) || !(o.name === null || isStr(o.name)) || !Array.isArray(o.fields)) return undefined;
  if (!(o.program === null || (isStr(o.program) && PROGRAM_KEYS.includes(o.program)))) return undefined;
  const fields: Field[] = [];
  for (const f of o.fields as unknown[]) {
    const fo = obj(f);
    const value = fieldValueOf(fo?.value);
    if (fo === undefined || !isStr(fo.name) || value === undefined) return undefined;
    fields.push({name: fo.name, value});
  }
  return {programId: o.programId, program: o.program as ProgramKey | null, name: o.name, fields};
}

function changeOf(x: unknown): BalanceChange | undefined {
  const o = obj(x);
  if (o === undefined || !(o.mint === null || isStr(o.mint)) || !isStr(o.amount) || !SIGNED.test(o.amount) || !(o.decimals === null || (isInt(o.decimals) && o.decimals <= 18))) return undefined;
  if (!(o.usdMicros === null || (isStr(o.usdMicros) && SIGNED.test(o.usdMicros)))) return undefined;
  return {mint: o.mint, amount: o.amount, decimals: o.decimals, usdMicros: o.usdMicros};
}

function outcomeOf(x: unknown): TxOutcome | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  if (o.ok === false && o.error === 'dependent') return isInt(o.on) && o.on >= 1 && isStr(o.detail) ? {ok: false, error: 'dependent', on: o.on, detail: o.detail} : undefined;
  if (o.ok === false) return (o.error === 'expired' || o.error === 'failed') && isStr(o.detail) ? {ok: false, error: o.error, detail: o.detail} : undefined;
  if (o.ok !== true || !Array.isArray(o.changes) || !(o.unitsConsumed === null || isInt(o.unitsConsumed)) || !isInt(o.unitLimit) || !(o.feeLamports === null || (isStr(o.feeLamports) && DIGITS.test(o.feeLamports)))) return undefined;
  const changes = (o.changes as unknown[]).map(changeOf);
  if (changes.some(c => c === undefined)) return undefined;
  return {ok: true, changes: changes as BalanceChange[], unitsConsumed: o.unitsConsumed, unitLimit: o.unitLimit, feeLamports: o.feeLamports};
}

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const AMOUNT = /^\d{1,20}$/;
/** F5's symbols — this window's copy of the background's APPROVAL_SYMBOLS (it imports no background code); f5Words.test.ts pins them equal (final review M1). */
export const APPROVAL_SYMBOLS: readonly string[] = ['NOC', 'USDC', 'USDT'];
const isAddress = (x: unknown): x is string => isStr(x) && ADDRESS.test(x);
const isAddressOrNull = (x: unknown): x is string | null => x === null || isAddress(x);
const isIntOrNull = (x: unknown): x is number | null => x === null || isInt(x);
/** `x` with exactly these keys, or undefined. */
const exactly = (x: unknown, keys: readonly string[]): J | undefined => {
  const o = obj(x);
  return o !== undefined && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k)) ? o : undefined;
};
/** Every item read by `f`, or undefined when any is not (or `x` is no list; `nonEmpty`: an empty one). */
function listOf<T>(x: unknown, f: (v: unknown) => T | undefined, nonEmpty = false): T[] | undefined {
  if (!Array.isArray(x) || (nonEmpty && x.length === 0)) return undefined;
  const out: T[] = [];
  for (const v of x as unknown[]) {
    const r = f(v);
    if (r === undefined) return undefined;
    out.push(r);
  }
  return out;
}

function flaggedOf(x: unknown): FlaggedInstruction | undefined {
  const o = exactly(x, ['index', 'program', 'name']);
  return o !== undefined && isInt(o.index) && isStr(o.program) && PROGRAM_KEYS.includes(o.program) && (o.name === null || isStr(o.name)) ? {index: o.index, program: o.program as ProgramKey, name: o.name} : undefined;
}

function authorityOf(x: unknown): AuthorityInstruction | undefined {
  const o = exactly(x, ['index', 'program', 'account', 'owned', 'authorityType', 'newAuthority']);
  if (o === undefined || !isInt(o.index) || (o.program !== 'token' && o.program !== 'token-2022') || !isAddress(o.account) || !isStr(o.authorityType) || !isAddressOrNull(o.newAuthority)) return undefined;
  if (o.owned !== 'token-account' && o.owned !== 'mint' && o.owned !== 'current-authority') return undefined;
  return {index: o.index, program: o.program, account: o.account, owned: o.owned, authorityType: o.authorityType, newAuthority: o.newAuthority};
}

function authorityChangeOf(x: unknown): AuthorityChange | undefined {
  const o = exactly(x, ['account', 'change', 'from', 'to']);
  if (o === undefined || !isAddress(o.account) || !isAddressOrNull(o.from) || !isAddressOrNull(o.to)) return undefined;
  if (o.change !== 'owner' && o.change !== 'close-authority' && o.change !== 'mint-authority' && o.change !== 'freeze-authority') return undefined;
  return {account: o.account, change: o.change, from: o.from, to: o.to};
}

function approvalOf(x: unknown): Approval | undefined {
  const o = exactly(x, ['at', 'source', 'mint', 'symbol', 'decimals', 'delegate', 'amount', 'balance']);
  if (o === undefined || !isIntOrNull(o.at) || !isAddress(o.source) || !isAddressOrNull(o.mint) || !isAddressOrNull(o.delegate) || !(o.decimals === null || (isInt(o.decimals) && o.decimals <= 255))) return undefined;
  if (!isStr(o.amount) || !AMOUNT.test(o.amount) || !isStr(o.balance) || !AMOUNT.test(o.balance) || !(o.symbol === null || (isStr(o.symbol) && APPROVAL_SYMBOLS.includes(o.symbol)))) return undefined;
  return {at: o.at, source: o.source, mint: o.mint, symbol: o.symbol as FlagSymbol | null, decimals: o.decimals, delegate: o.delegate, amount: o.amount, balance: o.balance};
}

function settingsOf(x: unknown): Token2022Settings | undefined {
  const o = exactly(x, ['freezeAuthority', 'permanentDelegate', 'transferHookProgram']);
  return o !== undefined && isAddressOrNull(o.freezeAuthority) && isAddressOrNull(o.permanentDelegate) && isAddressOrNull(o.transferHookProgram)
    ? {freezeAuthority: o.freezeAuthority, permanentDelegate: o.permanentDelegate, transferHookProgram: o.transferHookProgram}
    : undefined;
}

/** One flag, read exactly: its kind known, its keys exactly that kind's, its severity and word that kind's — else undefined. */
function flagOf(x: unknown): Flag | undefined {
  const kind = obj(x)?.kind;
  const warn = (o: J | undefined): o is J => o !== undefined && o.severity === 'warn' && o.word === null;
  switch (kind) {
    case 'unknown-program': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'programs']);
      const programs = listOf(o?.programs, v => (isAddressOrNull(v) ? {v} : undefined), true);
      return warn(o) && isInt(o.at) && programs !== undefined ? {kind, severity: 'warn', word: null, at: o.at, programs: programs.map(p => p.v)} : undefined;
    }
    case 'non-transfer': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions']);
      const instructions = listOf(o?.instructions, flaggedOf, true);
      return warn(o) && isInt(o.at) && instructions !== undefined ? {kind, severity: 'warn', word: null, at: o.at, instructions} : undefined;
    }
    case 'assign': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions', 'chain']);
      const instructions = listOf(o?.instructions, flaggedOf);
      const chain = nullOr(o?.chain, v => {
        const c = exactly(v, ['owner', 'space']);
        return c !== undefined && isAddress(c.owner) && isInt(c.space) ? {owner: c.owner, space: c.space} : undefined;
      });
      if (o === undefined || o.severity !== 'block' || o.word !== 'ASSIGN' || !isIntOrNull(o.at) || instructions === undefined || chain === undefined) return undefined;
      return {kind, severity: 'block', word: 'ASSIGN', at: o.at, instructions, chain};
    }
    case 'set-authority': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'instructions', 'chain']);
      const instructions = listOf(o?.instructions, authorityOf);
      const chain = listOf(o?.chain, authorityChangeOf);
      if (o === undefined || o.severity !== 'block' || o.word !== 'AUTHORITY' || !isIntOrNull(o.at) || instructions === undefined || chain === undefined) return undefined;
      return {kind, severity: 'block', word: 'AUTHORITY', at: o.at, instructions, chain};
    }
    case 'unlimited-approve':
    case 'bounded-approve': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'approvals']);
      const approvals = listOf(o?.approvals, approvalOf, true);
      if (o === undefined || !isIntOrNull(o.at) || approvals === undefined) return undefined;
      if (kind === 'bounded-approve') return warn(o) ? {kind, severity: 'warn', word: null, at: o.at, approvals} : undefined;
      const word = o.word;
      // Review 3 L14: UNLIMITED only when an approval is u64::MAX, ALLOWANCE only when none is — the background's own rule.
      const max = approvals.some(a => a.amount === '18446744073709551615');
      const named = isStr(word) && (APPROVAL_SYMBOLS.includes(word) || (word === 'UNLIMITED' && max) || (word === 'ALLOWANCE' && !max));
      return o.severity === 'block' && named ? {kind, severity: 'block', word: word as FlagSymbol | 'UNLIMITED' | 'ALLOWANCE', at: o.at, approvals} : undefined;
    }
    case 'token-2022': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'mint', 'settings']);
      const settings = nullOr(o?.settings, settingsOf);
      return warn(o) && isIntOrNull(o.at) && isAddress(o.mint) && settings !== undefined ? {kind, severity: 'warn', word: null, at: o.at, mint: o.mint, settings} : undefined;
    }
    case 'durable-nonce': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at']);
      return warn(o) && o.at === 0 ? {kind, severity: 'warn', word: null, at: 0} : undefined;
    }
    case 'whole-balance': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at']);
      return warn(o) && o.at === null ? {kind, severity: 'warn', word: null, at: null} : undefined;
    }
    case 'dependent': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'step']);
      return o !== undefined && o.severity === 'block' && o.word === 'UNCHECKED' && o.at === null && isInt(o.step) && o.step >= 1 ? {kind, severity: 'block', word: 'UNCHECKED', at: null, step: o.step} : undefined;
    }
    case 'presale-region': {
      const o = exactly(x, ['kind', 'severity', 'word', 'at', 'reason', 'countryCode']);
      if (o === undefined || o.severity !== 'refuse' || o.word !== null || !isInt(o.at) || !isStr(o.reason) || !REGION_REASONS.includes(o.reason)) return undefined;
      if (!(o.countryCode === null || (isStr(o.countryCode) && COUNTRY.test(o.countryCode)))) return undefined;
      return {kind, severity: 'refuse', word: null, at: o.at, reason: o.reason as RegionReason, countryCode: o.countryCode};
    }
    default:
      return undefined;
  }
}

function txItemOf(x: unknown): TxItem | undefined {
  const o = obj(x);
  if (o === undefined || (o.version !== 'legacy' && o.version !== 0) || !isStr(o.feePayer)) return undefined;
  let instructions: DecodedInstruction[] | null = null;
  if (o.instructions !== null) {
    if (!Array.isArray(o.instructions)) return undefined;
    const list = (o.instructions as unknown[]).map(instructionOf);
    if (list.some(i => i === undefined)) return undefined;
    instructions = list as DecodedInstruction[];
  }
  if (!(o.unitLimit === null || isInt(o.unitLimit))) return undefined;
  if (!(o.feeLamports === null || (isStr(o.feeLamports) && DIGITS.test(o.feeLamports)))) return undefined;
  const outcome = nullOr(o.outcome, outcomeOf);
  // B1c-3: the flags come with the outcome (the same simulation): both, or neither while simulating.
  const flags = nullOr(o.flags, v => listOf(v, flagOf));
  if (outcome === undefined || flags === undefined || (outcome === null) !== (flags === null)) return undefined;
  // A dependent outcome stands exactly beside one F10 flag naming the same step (Q32's <N>).
  const dependent = (flags ?? []).filter(f => f.kind === 'dependent');
  const on = outcome !== null && !outcome.ok && outcome.error === 'dependent' ? outcome.on : null;
  if (on === null ? dependent.length > 0 : dependent.length !== 1 || dependent[0]?.step !== on) return undefined;
  return {version: o.version, feePayer: o.feePayer, instructions, unitLimit: o.unitLimit, feeLamports: o.feeLamports, outcome, flags};
}

function simulationOf(x: unknown): SimulationView | undefined {
  const o = obj(x);
  if (o?.status === 'simulating' || o?.status === 'unreachable') return {status: o.status};
  if (o?.status !== 'ok' || !isStr(o.id) || !isInt(o.slot) || !isInt(o.elapsedMs) || !isInt(o.at)) return undefined;
  return {status: 'ok', id: o.id, slot: o.slot, elapsedMs: o.elapsedMs, at: o.at};
}

/** The background's dApp re-authentication reasons (reauthPolicy.ts `DappReauthReason`): anything else is refused. */
const REAUTH_REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new', 'approval', 'override'];

function txDetailOf(x: unknown): TxDetail | undefined {
  const o = obj(x);
  const account = accountOf(o?.account);
  const simulation = simulationOf(o?.simulation);
  if (o === undefined || account === undefined || simulation === undefined || (o.kind !== 'signTransaction' && o.kind !== 'signAndSendTransaction') || !Array.isArray(o.transactions) || !Array.isArray(o.labels)) return undefined;
  const transactions = (o.transactions as unknown[]).map(txItemOf);
  if (transactions.length === 0 || transactions.some(t => t === undefined)) return undefined;
  // A step depends only on an earlier one: step <N> of transaction i (0-based) is at most i.
  if ((transactions as TxItem[]).some((t, i) => (dependsOnStep(t) ?? 0) > i)) return undefined;
  const labels: AddressLabel[] = [];
  for (const l of o.labels as unknown[]) {
    const lo = obj(l);
    if (lo === undefined || !isStr(lo.address) || (lo.kind !== 'account' && lo.kind !== 'contact') || !isStr(lo.name)) return undefined;
    labels.push({address: lo.address, kind: lo.kind, name: lo.name});
  }
  const reauth = nullOr(o.reauth, v => {
    const r = obj(v);
    if (r === undefined || !Array.isArray(r.reasons) || !(r.reasons as unknown[]).every(x => isStr(x) && REAUTH_REASONS.includes(x)) || (r.state !== 'needed' && r.state !== 'waiting' && r.state !== 'proven')) return undefined;
    return {reasons: (r.reasons as string[]).slice(), state: r.state as 'needed' | 'waiting' | 'proven'};
  });
  if (reauth === undefined) return undefined;
  return {kind: o.kind, account, transactions: transactions as TxItem[], simulation, reauth, labels};
}

const TYPES: readonly string[] = ['connect', 'signMessage', 'signTransaction', 'signAndSendTransaction', 'mismatch'];

function requestOf(x: unknown): RequestView | undefined {
  const o = obj(x);
  const site = siteOf(o?.site);
  if (o === undefined || site === undefined || !isStr(o.requestId) || !isStr(o.type) || !TYPES.includes(o.type) || !isStr(o.origin) || !isStr(o.host) || !isBool(o.offerBlock)) return undefined;
  const connect = nullOr(o.connect, connectOf);
  const sign = nullOr(o.sign, signOf);
  // An older background sends neither (B1c-1): read as none. B1c-3: a detail the window cannot read is none either —
  // the request shows Q26 with only Reject, never a blank window and never the detail with a flag dropped.
  const tx = o.tx === undefined || o.tx === null ? null : (txDetailOf(o.tx) ?? null);
  const mismatch = o.mismatch === undefined ? null : nullOr(o.mismatch, v => (isStr(obj(v)?.granted) ? {granted: obj(v)?.granted as string} : undefined));
  if (connect === undefined || sign === undefined || tx === undefined || mismatch === undefined) return undefined;
  return {requestId: o.requestId, type: o.type as RequestView['type'], origin: o.origin, host: o.host, site, offerBlock: o.offerBlock, connect, sign, tx, mismatch};
}

export function pendingOf(x: unknown): PendingView | null {
  const o = obj(x);
  if (o === undefined) return null;
  if (o.state === 'none') return {state: 'none'};
  if (o.state !== 'locked' && o.state !== 'deciding' && o.state !== 'request') return null;
  const request = requestOf(o.request);
  if (request === undefined || !isInt(o.waiting) || !isBool(o.windowNotice)) return null;
  return {state: o.state, request, waiting: o.waiting, windowNotice: o.windowNotice};
}

export type Transport = (m: unknown) => Promise<unknown>;

export interface ApproveClient {
  pending(): Promise<PendingView | null>;
  decide(requestId: string, d: Decision): Promise<DecideReply | null>;
}

export function createClient(transport: Transport = runtimeSend): ApproveClient {
  const ask = async (m: unknown): Promise<J | undefined> => {
    try {
      return obj(await transport(m));
    } catch {
      // The service worker was restarting: the next poll asks again.
      return undefined;
    }
  };
  return {
    async pending() {
      const r = await ask({type: 'dapp.pending'});
      return r?.ok === true ? pendingOf(r.data) : null;
    },
    async decide(requestId, d) {
      const r = await ask({type: 'dapp.decide', requestId, ...d});
      if (r?.ok === true) return {ok: true};
      return r?.ok === false && isStr(r.error) ? {ok: false, error: r.error} : null;
    },
  };
}
