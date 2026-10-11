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
  rule: 'idn' | 'edit' | 'embedded' | 'swap' | null;
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
export interface RequestView {
  requestId: string;
  type: 'connect' | 'signMessage';
  origin: string;
  host: string;
  site: Site;
  offerBlock: boolean;
  connect: ConnectDetail | null;
  sign: SignDetail | null;
}
export type PendingView = {state: 'none'} | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};
export type Decision = {decision: 'reject' | 'report' | 'block'} | {decision: 'approve'; account: string; scope?: 'session' | 'persistent'};
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
  const rule = nullOr(o.rule, v => (v === 'idn' || v === 'edit' || v === 'embedded' || v === 'swap' ? v : undefined));
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

function requestOf(x: unknown): RequestView | undefined {
  const o = obj(x);
  const site = siteOf(o?.site);
  if (o === undefined || site === undefined || !isStr(o.requestId) || (o.type !== 'connect' && o.type !== 'signMessage') || !isStr(o.origin) || !isStr(o.host) || !isBool(o.offerBlock)) return undefined;
  const connect = nullOr(o.connect, connectOf);
  const sign = nullOr(o.sign, signOf);
  if (connect === undefined || sign === undefined) return undefined;
  return {requestId: o.requestId, type: o.type, origin: o.origin, host: o.host, site, offerBlock: o.offerBlock, connect, sign};
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
