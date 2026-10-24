import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {armAutolock} from '../autolock';
import {getSession} from '../session';
import {readWalletView} from '../accountsStore';
import {readSettings} from '../settings';
import {displayOrder} from '../walletApi';
import {isBlocked, withBlock} from './blocked';
import {classify, siteName, type IdnDetail, type LookalikeRule} from './classify';
import {MAX_GRANTS, type Grant} from './grants';
import {inCooldown, rejectionsOf, REJECTIONS_FOR_COOLDOWN} from './limits';
import {runtimeFor} from './ports';
import {answer, headOf, isOpenEntry, queueAccess, rejectQueued, userRejected, type Effects} from './queue';
import {dropGrant, grantIn, putGrant, readDappSession, type Decision, type Entry, type Tx} from './store';
import {base64} from '@scure/base';
import {checkMessage, checkSiws, finishSign, homoglyphRanges, keywordIn} from './signMessage';
import {carriesPurchase, dappDigest, finishSend, finishSignTx, isTxType, needsSimulation, reauthGate, regionNow, runSimulation, txDetail, txRefused, type TxDetail, type TxRefusal} from './signTx';
import {consumeChallenge} from '../reauthChallenges';
import {OVERRIDE_WORDS} from './redFlags';
import {MAX_BATCH} from './txRequest';

/**
 * The approval window's two messages (spec §1.4, §2.3, C13, C17): `dapp.pending` — what the window shows — and
 * `dapp.decide` — validated here as if the window were untrusted (C13: "the window decides nothing"). A decision's
 * effect happens once (§1.5 step 2): `deciding` is written in the same queue section that passed the checks, and only
 * then does the effect run; its outcome is written as `answered` in a later section that first confirms the entry is
 * still this instance's `deciding` one (a lock in between answered it `rejected`, §2.4).
 */

/** What the origin card and the banners say about a site (§2.5, C7): never a name the page supplied. */
export interface SiteView {
  kind: 'verified' | 'unknown' | 'lookalike';
  /** C7: the known list's name for a verified host, else the host's second-level label — never the imitated brand. */
  name: string;
  /** The listed domain a lookalike imitates (shown only in the banner), or null. */
  imitates: string | null;
  rule: LookalikeRule | null;
  idn: IdnDetail | null;
  /** An `xn--` label anywhere in the host (47b's Q18 line for an unknown one). */
  international: boolean;
}

export function siteView(host: string): SiteView {
  const c = classify(host);
  return {
    kind: c.kind,
    name: siteName(host, c),
    imitates: c.kind === 'lookalike' ? c.imitates : null,
    rule: c.kind === 'lookalike' ? c.rule : null,
    idn: c.kind === 'lookalike' ? c.idn : null,
    international: c.kind === 'unknown' ? c.international : host.split('.').some(l => l.startsWith('xn--')),
  };
}

export interface AccountChoice {
  index: number;
  name: string;
  publicKey: string;
}

/** #47's details: the account picker (Q01; the wallet's unlocked accounts in display order, the active one chosen) and the cap (Q16). */
export interface ConnectDetail {
  accounts: AccountChoice[];
  selected: number;
  cap: boolean;
}

/** #46's details (§3.2 steps 4–6): the granted account, the text as text, its length, the keyword alert, the marks, a SIWS mismatch. */
export interface SignDetail {
  account: AccountChoice;
  text: string;
  /** Characters (code points), for "Message · UTF-8 (<n> chars)". */
  chars: number;
  /** The first structured-approval keyword (rule 6), or null. */
  keyword: string | null;
  /** UTF-16 ranges of `text` to <mark>: the keyword's occurrences, and — for a lookalike origin — every homoglyph. */
  marks: {start: number; end: number}[];
  /** Rule 3: the domain a SIWS message names when it is not this site's (Q20: no Sign), else null. */
  siwsMismatch: string | null;
}

export interface RequestView {
  requestId: string;
  type: Entry['type'];
  origin: string;
  host: string;
  site: SiteView;
  /** C14: this host or tab already has two rejections in ten minutes — the screen offers [Block this site] (Q17). */
  offerBlock: boolean;
  /** Null while locked: the locked screen shows the origin card only (D11). */
  connect: ConnectDetail | null;
  sign: SignDetail | null;
  /** B1c-2, #48: a transaction request's account and detail (null while locked, or when it can no longer be signed — Q26). */
  tx: (TxDetail & {account: AccountChoice; kind: 'signTransaction' | 'signAndSendTransaction'}) | null;
  /** B1c-2, #48 "origin-mismatch · auto-reject": the origin the named account is granted to. */
  mismatch: {granted: string} | null;
}

export type PendingView =
  | {state: 'none'}
  | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};

/** The wallet's accounts as the popup orders them (E14), only those unlocked, and the active one (C1: only a default). */
async function choices(ext: Ext, tx: Tx): Promise<{accounts: AccountChoice[]; selected: number}> {
  const [view, settings] = await Promise.all([readWalletView(ext), readSettings(ext)]);
  const unlocked = new Set((tx.session ?? []).map(a => a.publicKey));
  const accounts = displayOrder(view?.accounts ?? [], settings.accountOrder).filter(a => unlocked.has(a.publicKey));
  const selected = accounts.some(a => a.index === settings.selectedAccount) ? settings.selectedAccount : (accounts[0]?.index ?? 0);
  return {accounts: accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})), selected};
}

function signDetail(e: Entry, site: SiteView, account: AccountChoice): SignDetail | null {
  if (e.message === null || e.account === null) return null;
  const checked = checkMessage(base64.decode(e.message));
  if ('refused' in checked) return null;
  const text = checked.text;
  const keyword = keywordIn(text);
  const siws = checkSiws(text, e.origin, e.account);
  const marks = [...(keyword?.ranges ?? []), ...(site.kind === 'lookalike' ? homoglyphRanges(text) : [])].sort((a, b) => a.start - b.start);
  return {account, text, chars: [...text].length, keyword: keyword?.word ?? null, marks, siwsMismatch: siws.siws && !siws.domainOk ? siws.domain : null};
}

async function viewOf(ext: Ext, tx: Tx, e: Entry): Promise<RequestView> {
  const unlocked = tx.session !== null;
  const site = siteView(e.host);
  let connect: ConnectDetail | null = null;
  let sign: SignDetail | null = null;
  let txView: RequestView['tx'] = null;
  if (unlocked) {
    const c = await choices(ext, tx);
    if (e.type === 'connect') connect = {...c, cap: grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS};
    const named = c.accounts.find(a => a.publicKey === e.account);
    if (e.type === 'signMessage' && named !== undefined) sign = signDetail(e, site, named);
    if (isTxType(e.type) && named !== undefined && tx.session !== null) {
      const names = new Map(c.accounts.map(a => [a.publicKey, a.name]));
      const detail = await txDetail(ext, e, tx.session, names, tx.now, runtimeFor(ext).simulating.has(e.requestId));
      if (detail !== null) txView = {...detail, account: named, kind: e.type};
    }
  }
  return {
    requestId: e.requestId,
    type: e.type,
    origin: e.origin,
    host: e.host,
    site,
    offerBlock: rejectionsOf(tx.limits, e.host, e.tabId) >= REJECTIONS_FOR_COOLDOWN - 1,
    connect,
    sign,
    tx: txView,
    mismatch: e.type === 'mismatch' && e.granted !== null ? {granted: e.granted} : null,
  };
}

/**
 * dapp.pending (§2.3, §4.3): the head as the window shows it — a `deciding` head as `deciding` (never decidable),
 * `locked` while locked (D11), `none` when the queue is empty (the window closes itself) — with how many more wait (Q12)
 * and the budget notice (Q24, once). Records which request the window shows: closing the window rejects that one.
 */
export async function pending(ext: Ext, deps: WalletDeps): Promise<PendingView> {
  let simulate: string | null = null;
  const view = await queueAccess(ext, deps, async (tx): Promise<PendingView> => {
    const h = headOf(tx);
    if (h === null) return {state: 'none'};
    if (tx.s.window !== null) tx.s.window = {...tx.s.window, showing: h.requestId};
    const windowNotice = tx.limits.notice;
    if (windowNotice) tx.limits = {...tx.limits, notice: false};
    const waiting = tx.s.queue.filter(isOpenEntry).length - 1;
    const state = tx.session === null ? 'locked' : h.state === 'deciding' ? 'deciding' : 'request';
    // B1c-2 (§3.3): the head's simulation — the first, the 30 s refresh, a retry — starts after this section.
    if (tx.session !== null && needsSimulation(h, tx.now)) simulate = h.requestId;
    return {state, request: await viewOf(ext, tx, h), waiting, windowNotice};
  });
  if (simulate !== null) void runSimulation(ext, deps, simulate).catch(e => console.warn('dApp: a simulation failed to run', e));
  return view;
}

export type DecideError = 'malformed' | 'not-head' | 'expired' | 'locked' | 'unknown-account' | 'scope' | 'blocked' | 'cap' | 'no-grant' | 'account' | 'siws-mismatch' | TxRefusal | 'reauth-required';
export interface DecideRequest {
  requestId: string;
  decision: Decision;
  account: string | null;
  scope: Grant['scope'] | null;
  /** B1c-2: a transaction request's approval names the simulation the window showed (C13). */
  simulation: string | null;
  /**
   * B1c-3 (the override rule): the words typed, one per blocked (transaction, kind) — `tx` the transaction's index in
   * the batch. Never trusted: txRefused compares them with the words the stored simulation's flags give.
   */
  overrides: {tx: number; word: string}[];
}

const DECISIONS: readonly string[] = ['approve', 'reject', 'report', 'block'];
/** One word per (transaction, block kind), at most: four kinds of block over a five-transaction batch. */
export const MAX_OVERRIDES = MAX_BATCH * Object.keys(OVERRIDE_WORDS).length;
/** No override word is near this long (the longest is UNCHECKED / UNLIMITED); a longer string is not a typed word. */
const MAX_WORD = 32;

/** The overrides' exact shape — absent is none; anything else than at most MAX_OVERRIDES `{tx, word}` is null (malformed). */
function overridesOf(x: unknown): {tx: number; word: string}[] | null {
  if (x === undefined) return [];
  if (!Array.isArray(x) || x.length > MAX_OVERRIDES) return null;
  const out: {tx: number; word: string}[] = [];
  for (const v of x as unknown[]) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const {tx, word, ...rest} = v as Record<string, unknown>;
    if (Object.keys(rest).length > 0 || typeof tx !== 'number' || !Number.isSafeInteger(tx) || tx < 0 || tx >= MAX_BATCH || typeof word !== 'string' || word.length > MAX_WORD) return null;
    out.push({tx, word});
  }
  return out;
}

/** dapp.decide's shape: a request id, a decision, and — for an approval — the account (and a connect's scope, a transaction's simulation and overrides). */
export function decideRequestOf(msg: Record<string, unknown>): DecideRequest | null {
  const {requestId, decision, account, scope, simulation} = msg;
  if (typeof requestId !== 'string' || typeof decision !== 'string' || !DECISIONS.includes(decision)) return null;
  if (account !== undefined && typeof account !== 'string') return null;
  if (scope !== undefined && scope !== 'session' && scope !== 'persistent') return null;
  if (simulation !== undefined && typeof simulation !== 'string') return null;
  const overrides = overridesOf(msg.overrides);
  if (overrides === null) return null;
  return {requestId, decision: decision as Decision, account: account ?? null, scope: scope ?? null, simulation: simulation ?? null, overrides};
}

/** Blocking a host (§2.6): every grant of that host (both scopes, every port and scheme) revoked, its queued requests rejected. */
export function blockHost(tx: Tx, fx: Effects, host: string): void {
  const imitates = siteView(host).imitates;
  tx.blocked = withBlock(tx.blocked, host, imitates, tx.now);
  const origins = new Set([...tx.s.grants, ...tx.grants].filter(g => hostOf(g.origin) === host).map(g => g.origin));
  for (const origin of origins) {
    dropGrant(tx, origin);
    fx.changes.set(origin, []);
  }
  rejectQueued(tx, fx, e => e.host === host);
}

export function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

/** §2.3's table, for an approval: each refusal in its row's order. Null: approvable. */
function approvalRefused(tx: Tx, e: Entry, d: DecideRequest): DecideError | null {
  // unlocked — read inside sessionMutex (dappSection), so a grant is never written after a concurrent lock.
  if (tx.session === null) return 'locked';
  if (d.account === null || !tx.session.some(a => a.publicKey === d.account)) return 'unknown-account';
  if (e.type === 'connect') {
    if (d.scope === null) return 'malformed';
    // C12: an unknown or lookalike origin can only get "This session only".
    if (d.scope === 'persistent' && classify(e.host).kind !== 'verified') return 'scope';
  }
  if (isBlocked(tx.blocked, e.host) || inCooldown(tx.limits, e.host, e.tabId, tx.now)) return 'blocked';
  // §2.1: beyond 200 persistent grants a connect has only [Reject] (Q16).
  if (e.type === 'connect' && grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS) return 'cap';
  if (e.type === 'signMessage' || isTxType(e.type)) {
    // review 2 M9: the grant must still be held for the request's account.
    if (grantIn(tx, e.origin)?.account !== e.account) return 'no-grant';
    if (d.account !== e.account) return 'account';
  }
  if (e.type === 'signMessage') {
    // §3.2 rule 3: a sign-in message for another domain has no Sign (C13: the window's missing button is not the check).
    if (e.message !== null) {
      const checked = checkMessage(base64.decode(e.message));
      if (!('text' in checked)) return 'malformed';
      const siws = checkSiws(checked.text, e.origin, e.account ?? '');
      if (siws.siws && !siws.domainOk) return 'siws-mismatch';
    }
  }
  return null;
}

/** The connect effect: the grant written and the request answered — in one section, only if still this instance's `deciding` entry. */
async function finishConnect(ext: Ext, deps: Pick<WalletDeps, 'now'>, requestId: string, instance: string): Promise<void> {
  await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.decision === null) return;
    const {account, scope} = e.decision;
    // The section's own checks again: a block or an account removed since `deciding` was written end it here (each
    // tested, review 1 M4). A lock cannot reach this line — the lock hook answers a `deciding` entry first — so
    // `tx.session === null` is the type's narrowing and a second line of defence.
    // Final-fix item 2: and §2.1's cap — an undo between the sections can restore the 200th grant meanwhile; the
    // 201st is refused here, never written over the oldest (the same condition as approvalRefused's `cap` row).
    const capped = grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS;
    if (account === null || scope === null || tx.session === null || !tx.session.some(a => a.publicKey === account) || isBlocked(tx.blocked, e.host) || capped) {
      answer(fx, e, {error: 'rejected'}, tx.now);
      return;
    }
    putGrant(tx, {origin: e.origin, account, scope, connectedAt: tx.now, lastUsedAt: tx.now, recent: [{type: 'connect', at: tx.now, outcome: 'approved'}]});
    answer(fx, e, {result: {accounts: [account]}}, tx.now);
  });
}

/** The site as the window shows it (host, or host:port — review 1 L5, R35), for #10's description. */
function siteOf(origin: string, host: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return host;
  }
}

/** expiry, head: the first two rows of §2.3's table, for any decision. */
function headRefused(tx: Tx, e: Entry | undefined): DecideError | null {
  // expiry: the sweep at the top of this section has answered an expired request `timeout`.
  if (e?.state === 'answered' && e.answer !== null && 'error' in e.answer && e.answer.error === 'timeout') return 'expired';
  // head: only the queue head, and only while `queued` (a `deciding` one is never decided twice).
  if (e === undefined || headOf(tx) !== e || e.state !== 'queued') return 'not-head';
  return null;
}

/** dapp.decide (§2.3): one refusal per row of the table, else the decision — a reject at once, an approval through `deciding`. */
export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Promise<{ok: true} | {ok: false; error: DecideError}> {
  const instance = runtimeFor(ext).instance;
  // B1c-2: a transaction request's approval first passes every check, then the re-authentication gate (outside any
  // section: the challenge store takes sessionMutex), then writes `deciding` in a second section that checks it all
  // again — INCLUDING, fail-closed, that a simulation needing re-auth carries a proof bound to it (R9/R11, fix round 1
  // item 1): the peek below only decides whether the gate runs at all; it is never trusted on its own, because an
  // unsectioned read can miss the entry (a race, a malformed stored value) and leave `proof` null while the entry
  // still needs one — the deciding section's own check below is what actually enforces it. A connect or a
  // signMessage decision takes the one section it always took.
  // B1d §3.6 (C12 "before every signature"): a request carrying a presale purchase asks the jurisdiction gate again
  // here, before `deciding` and before any challenge (a refusal burns nothing); not open → `presale-region`, re-simulated
  // so #48 shows the F12 it now has. The deciding section refuses a purchase this call did not find open.
  let regionOpen = false;
  const peek = (await readDappSession(ext)).queue.find(x => x.requestId === d.requestId);
  // A proven challenge to consume after `deciding` is written (review 1 L1): its id and what it is bound to.
  let proof: {id: string; digest: string} | null = null;
  if (d.decision === 'approve' && peek !== undefined && isTxType(peek.type)) {
    const pre = await queueAccess(ext, deps, (tx): DecideError | Entry | 'other' => {
      const e = tx.s.queue.find(x => x.requestId === d.requestId);
      const head = headRefused(tx, e);
      if (head !== null) return head;
      if (e === undefined || !isTxType(e.type)) return 'other';
      return approvalRefused(tx, e, d) ?? txRefused(e, d.simulation, d.overrides, tx.now) ?? structuredClone(e);
    });
    if (typeof pre === 'string' && pre !== 'other') return {ok: false, error: pre};
    if (typeof pre === 'object') {
      if (carriesPurchase(pre)) {
        if (!(await regionNow(deps)).open) {
          await runSimulation(ext, deps, d.requestId);
          return {ok: false, error: 'presale-region'};
        }
        regionOpen = true;
      }
      const gate = await reauthGate(ext, deps, pre, siteOf(pre.origin, pre.host));
      if (gate === 'proven' && pre.challengeId !== null) proof = {id: pre.challengeId, digest: dappDigest(pre)};
      else if (gate !== 'ready') return {ok: false, error: gate === 'proven' ? 'reauth-required' : gate};
    }
  }
  const out = await queueAccess(ext, deps, (tx, fx): DecideError | {approved: Entry['type']} | 'done' => {
    const e = tx.s.queue.find(x => x.requestId === d.requestId);
    const head = headRefused(tx, e);
    if (head !== null || e === undefined) return head ?? 'not-head';
    // B1c-2: a mismatch notice is only ever dismissed (#48 "origin-mismatch · auto-reject" has no approval path).
    if (e.type === 'mismatch' && d.decision !== 'reject') return 'malformed';
    if (d.decision === 'reject') {
      userRejected(tx, fx, e);
      return 'done';
    }
    if (d.decision === 'report' || d.decision === 'block') {
      // Review 1 L2: a block writes the user's lists (it revokes grants) — refused while locked, as #49's messages are
      // (R8); the locked screen offers only [Reject].
      if (tx.session === null) return 'locked';
      userRejected(tx, fx, e);
      blockHost(tx, fx, e.host);
      return 'done';
    }
    // B1c-3: the words again, against the entry as this section reads it (a block stored since the pre-section counts).
    const refused = approvalRefused(tx, e, d) ?? (isTxType(e.type) ? txRefused(e, d.simulation, d.overrides, tx.now) : null);
    if (refused !== null) return refused;
    if (isTxType(e.type) && carriesPurchase(e) && !regionOpen) return 'presale-region';
    // Fix round 1 item 1: fail closed even when the peek above missed this entry (the pre-section and the gate never
    // ran, so `proof` is still null here) — a simulation that names reasons may proceed only with a proof bound to
    // EXACTLY this entry's current challenge; a proof for a challenge the entry no longer points at does not count.
    if (isTxType(e.type) && e.sim?.status === 'ok' && e.sim.sim.reasons.length > 0 && (proof === null || proof.id !== e.challengeId)) return 'reauth-required';
    e.state = 'deciding';
    e.decidedBy = instance;
    e.decidingAt = tx.now;
    e.decision = {kind: 'approve', account: d.account, scope: e.type === 'connect' ? d.scope : null};
    return {approved: e.type};
  });
  if (typeof out === 'string' && out !== 'done') return {ok: false, error: out};
  // Review 1 L1: the proof is spent here — after `deciding` (never decided twice), before any key is read. If it is gone
  // (expired, or spent by another approval), the request ends `rejected`: nothing was signed. The window is told what
  // happened to the request — it is no longer the head (plan 2 review 2 L4), not "re-authenticate", which it can no
  // longer do for an answered request.
  if (proof !== null && typeof out === 'object' && !(await consumeChallenge(ext, deps.now(), proof.id, proof.digest))) {
    await queueAccess(ext, deps, (tx, fx) => {
      const e = tx.s.queue.find(x => x.requestId === d.requestId);
      if (e !== undefined && e.state === 'deciding' && e.decidedBy === instance) answer(fx, e, {error: 'rejected'}, tx.now);
    });
    return {ok: false, error: 'not-head'};
  }
  // §2.2: a decision in the window is a user action — it arms the auto-lock timer (page requests never do).
  if ((await getSession(ext)) !== null) await armAutolock(ext).catch(e => console.warn('dApp decide: the idle timer was not re-armed', e));
  if (typeof out === 'object') {
    // Each approvable type's effect, by name: a type with none (a mismatch notice — refused above) can never fall into another's.
    const effects: Partial<Record<Entry['type'], (ext: Ext, deps: WalletDeps, requestId: string, instance: string) => Promise<void>>> = {
      connect: finishConnect,
      signMessage: finishSign,
      signTransaction: finishSignTx,
      signAndSendTransaction: finishSend,
    };
    await effects[out.approved]?.(ext, deps, d.requestId, instance);
  }
  return {ok: true};
}
