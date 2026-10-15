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
  | {kind: 'address'; value: string | null}
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
export type TxOutcome = {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null} | {ok: false; error: 'expired' | 'failed'; detail: string};
export interface TxItem {
  version: 'legacy' | 0;
  feePayer: string;
  instructions: DecodedInstruction[] | null;
  outcome: TxOutcome | null;
}
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
export type Decision = {decision: 'reject' | 'report' | 'block'} | {decision: 'approve'; account: string; scope?: 'session' | 'persistent'; simulation?: string};
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
  if (o.kind === 'address') return o.value === null || isStr(o.value) ? {kind: 'address', value: o.value} : undefined;
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
  if (o.ok === false) return (o.error === 'expired' || o.error === 'failed') && isStr(o.detail) ? {ok: false, error: o.error, detail: o.detail} : undefined;
  if (o.ok !== true || !Array.isArray(o.changes) || !(o.unitsConsumed === null || isInt(o.unitsConsumed)) || !isInt(o.unitLimit) || !(o.feeLamports === null || (isStr(o.feeLamports) && DIGITS.test(o.feeLamports)))) return undefined;
  const changes = (o.changes as unknown[]).map(changeOf);
  if (changes.some(c => c === undefined)) return undefined;
  return {ok: true, changes: changes as BalanceChange[], unitsConsumed: o.unitsConsumed, unitLimit: o.unitLimit, feeLamports: o.feeLamports};
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
  const outcome = nullOr(o.outcome, outcomeOf);
  if (outcome === undefined) return undefined;
  return {version: o.version, feePayer: o.feePayer, instructions, outcome};
}

function simulationOf(x: unknown): SimulationView | undefined {
  const o = obj(x);
  if (o?.status === 'simulating' || o?.status === 'unreachable') return {status: o.status};
  if (o?.status !== 'ok' || !isStr(o.id) || !isInt(o.slot) || !isInt(o.elapsedMs) || !isInt(o.at)) return undefined;
  return {status: 'ok', id: o.id, slot: o.slot, elapsedMs: o.elapsedMs, at: o.at};
}

function txDetailOf(x: unknown): TxDetail | undefined {
  const o = obj(x);
  const account = accountOf(o?.account);
  const simulation = simulationOf(o?.simulation);
  if (o === undefined || account === undefined || simulation === undefined || (o.kind !== 'signTransaction' && o.kind !== 'signAndSendTransaction') || !Array.isArray(o.transactions) || !Array.isArray(o.labels)) return undefined;
  const transactions = (o.transactions as unknown[]).map(txItemOf);
  if (transactions.length === 0 || transactions.some(t => t === undefined)) return undefined;
  const labels: AddressLabel[] = [];
  for (const l of o.labels as unknown[]) {
    const lo = obj(l);
    if (lo === undefined || !isStr(lo.address) || (lo.kind !== 'account' && lo.kind !== 'contact') || !isStr(lo.name)) return undefined;
    labels.push({address: lo.address, kind: lo.kind, name: lo.name});
  }
  const reauth = nullOr(o.reauth, v => {
    const r = obj(v);
    if (r === undefined || !Array.isArray(r.reasons) || !(r.reasons as unknown[]).every(isStr) || (r.state !== 'needed' && r.state !== 'waiting' && r.state !== 'proven')) return undefined;
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
  // An older background sends neither (B1c-1): read as none.
  const tx = o.tx === undefined ? null : nullOr(o.tx, txDetailOf);
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
