import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {isBlocked} from './blocked';
import {inCooldown, noticeBudgetLeft, withNoticeWindow} from './limits';
import {PAGE_PORT, owns, pageOrigin, runtimeFor, type LivePort, type PortLike} from './ports';
import {MAX_OPEN, documentChanged, isOpenEntry, newRequestId, queueAccess, rejectQueued} from './queue';
import {dropGrant, grantIn, putGrant, type Entry, type ErrorCode, type Tx} from './store';
import {checkMessage, checkSiws, signRequestOf} from './signMessage';
import {othersSigned, sameMessage, slotOf, txRequestOf, usesDurableNonce} from './txRequest';
import {ensureWindow} from './window';

/**
 * The PAGE partition's handlers (spec §1.3–§1.6). Page messages arrive only on the `noctura-page` port; the port's
 * sender passed the origin rule when it connected (ports.ts pageOrigin), and every request is keyed `(tabId, origin)`
 * from that report — never from anything the page sends. The relay forwards exactly the method types and originates
 * resume / ack / ping itself (§1.2); a privileged type on a port is refused like any unknown one.
 */
export const PAGE_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction', 'page.resume', 'page.ack', 'page.ping'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** The relay's own request id (it adds nothing else, §1.2). */
const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** A requestId this background issued: 16 bytes, base64url without padding. */
const REQUEST_ID = /^[A-Za-z0-9_-]{22}$/;
/** At most this many ids in one page.resume (C3 keeps a port's open requests far below it). */
export const MAX_RESUME = 16;

type Reply = {id: string; accepted: true; requestId: string} | {id: string; result: Record<string, unknown>} | {id: string; error: ErrorCode};

function reply(live: LivePort, m: unknown): void {
  try {
    live.port.postMessage(m);
  } catch {
    // The port died meanwhile: the relay re-sends (same id: the same request) or resumes.
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The accounts a grant shows a page right now: its account while unlocked and still in the session (D5), else none. */
function grantedAccount(tx: Tx, origin: string): string | null {
  const g = grantIn(tx, origin);
  if (g === null || tx.session === null || !tx.session.some(a => a.publicKey === g.account)) return null;
  return g.account;
}

/**
 * `lastUsedAt` moves on accepted requests (§2.1) — at most once a minute per grant (review 1 L3): a page's loop of
 * silent connects is not a storage write each, and #49 shows the time to the minute at best.
 */
export const LAST_USED_STEP_MS = 60_000;
function touch(tx: Tx, origin: string): void {
  const g = grantIn(tx, origin);
  if (g !== null && tx.now - g.lastUsedAt >= LAST_USED_STEP_MS) putGrant(tx, {...g, lastUsedAt: tx.now});
}

/**
 * A request the user must answer, after C3's caps; null when it was queued, else the immediate refusal. Fix round 1,
 * controller ruling: a `mismatch` entry never counts here — for this host's own real requests, NOR for the total —
 * or a site could learn, from a later `request-pending`, that the account it named is held elsewhere (the notice
 * would be a two-message oracle otherwise). A notice's own cap (mismatchNotice, below) uses the unfiltered count.
 */
function admit(tx: Tx, live: LivePort): ErrorCode | null {
  const open = tx.s.queue.filter(isOpenEntry).filter(e => e.type !== 'mismatch');
  if (open.some(e => e.host === live.host || e.tabId === live.tabId)) return 'request-pending';
  if (open.length >= MAX_OPEN) return 'busy';
  return null;
}

type EntryFields = Pick<Entry, 'type' | 'account' | 'message'> & Partial<Pick<Entry, 'transactions' | 'granted'>>;
function enqueue(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort, id: string, fields: EntryFields): Entry {
  const e: Entry = {
    requestId: newRequestId(deps),
    pageId: id,
    origin: live.origin,
    host: live.host,
    tabId: live.tabId,
    documentId: live.documentId,
    transactions: null,
    granted: null,
    ...fields,
    arrivedAt: tx.now,
    state: 'queued',
    decidedBy: null,
    decidingAt: null,
    decision: null,
    answer: null,
    answeredAt: null,
  };
  tx.s.queue.push(e);
  return e;
}

/**
 * The same request re-sent after a lost connection (same relay id, same tab and origin) is the same request (C9).
 * Fix round 1 (promoted Minor 3, D5): also the same document when both report one — a stored entry of document A
 * is never document B's (a new document in the same tab, same relay id by coincidence), or document B could be
 * handed A's answer, including an `{accounts}` approval granted to A. Neither reporting one (Firefox) falls back to
 * (tabId, origin, pageId) alone, as before.
 */
function resent(tx: Tx, live: LivePort, id: string): Entry | null {
  return tx.s.queue.find(e => owns(live, e) && e.pageId === id && (e.documentId === null || live.documentId === null || e.documentId === live.documentId)) ?? null;
}

/**
 * The reply to a re-sent request (C9). Final review I1: one answered meanwhile is answered inline, under the page's id —
 * never `accepted` plus a delivery. The relay re-sends only a request it never saw accepted, so it does not await this
 * requestId yet and drops an answer keyed by it (relay.ts); a delivery would reach it before this reply (queueAccess
 * delivers inside itself) and the page's promise would never settle. The entry is never acked then; the TTL sweep
 * drops it (ANSWER_TTL_MS), and a further re-send gets the same answer again.
 */
function resentReply(again: Entry, id: string): Reply {
  if (again.state === 'answered' && again.answer !== null) return {id, ...again.answer};
  return {id, accepted: true, requestId: again.requestId};
}

async function connect(ext: Ext, deps: WalletDeps, live: LivePort, id: string, silent: boolean): Promise<Reply> {
  return queueAccess(ext, deps, (tx, fx): Reply => {
    documentChanged(tx, fx, live);
    const again = resent(tx, live, id);
    if (again !== null) return resentReply(again, id);
    // Fix round 1 item 2 (D3): a blocked host's lingering grant (a restore keeps both the block and the grant) must
    // never surface the account — silent or explicit — so the block is checked before the grant is even read, not
    // only before an explicit connect's window-or-reject branch below.
    const blocked = isBlocked(tx.blocked, live.host);
    const account = blocked ? null : grantedAccount(tx, live.origin);
    // §2.2: a silent connect never opens a window and never tells "locked" from "not granted" — nor "blocked".
    if (silent) {
      if (account !== null) touch(tx, live.origin);
      return {id, result: {accounts: account === null ? [] : [account]}};
    }
    // §2.6, C14: a blocked or cooling-down host is answered at once — no window, no queue entry.
    if (blocked || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {id, error: 'rejected'};
    if (account !== null) {
      touch(tx, live.origin);
      return {id, result: {accounts: [account]}};
    }
    const refused = admit(tx, live);
    if (refused !== null) return {id, error: refused};
    return {id, accepted: true, requestId: enqueue(tx, deps, live, id, {type: 'connect', account: null, message: null}).requestId};
  });
}

/**
 * page.signMessage (§3.2): the checks in the spec's order — each refusal before any window — then queued. A SIWS
 * message naming another domain is queued too (#46 shows Q20 and only [Reject]); one naming another address is not.
 */
async function signMessage(ext: Ext, deps: WalletDeps, live: LivePort, id: string, m: Record<string, unknown>): Promise<Reply> {
  const req = signRequestOf(m);
  return queueAccess(ext, deps, (tx, fx): Reply => {
    documentChanged(tx, fx, live);
    const again = resent(tx, live, id);
    if (again !== null) return resentReply(again, id);
    if (req === null) return {id, error: 'invalid-request'};
    // 1. Only the granted account of a granted origin, while unlocked (§2.2: a sign request while locked is unauthorized).
    if (grantedAccount(tx, live.origin) !== req.account) return {id, error: 'unauthorized'};
    // 2.
    const checked = checkMessage(req.bytes);
    if ('refused' in checked) return {id, error: 'invalid-request'};
    // 3.
    const siws = checkSiws(checked.text, live.origin, req.account);
    if (siws.siws && !siws.addressOk) return {id, error: 'invalid-request'};
    if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {id, error: 'rejected'};
    const refused = admit(tx, live);
    if (refused !== null) return {id, error: refused};
    touch(tx, live.origin);
    const message = typeof m.message === 'string' ? m.message : '';
    return {id, accepted: true, requestId: enqueue(tx, deps, live, id, {type: 'signMessage', account: req.account, message}).requestId};
  });
}

const hostOf = (origin: string): string => {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
};

/**
 * B1c-2, #48 "origin-mismatch · auto-reject" (B1 §3: "request origin differs from the granted origin → blocked, no
 * override"): a sign request naming an account of this unlocked wallet that ANOTHER origin holds a grant for. The page
 * is answered `unauthorized` at once, exactly as any ungranted request (§2.2 — it learns nothing more), and the window
 * shows the user what was refused: a notice entry, with no approval path. Only when this host is not blocked or cooling
 * down, and its OWN caps admit it — at most one open entry of ANY type for this host or tab (so a site cannot stack
 * notices), the total open strictly under C3's budget (fix round 1: this check is deliberately NOT `admit()`, which
 * now excludes a `mismatch` from its own counts — the notice must still respect the shared queue budget, or it could
 * stack past it unnoticed), and — fix round 2, controller ruling channel 2 — the notice's OWN window budget
 * (`noticeBudgetLeft`/`withNoticeWindow`, limits.ts): spent here, at the moment a notice would be queued, never
 * the real `WINDOW_BUDGET` a genuine request's window draws from. A page cannot spend a real account's budget by
 * triggering (and having the user dismiss) notices, and exhausting the notice budget never falls back to the
 * `rejected`-with-Q24 behaviour WINDOW_BUDGET's exhaustion uses for real requests (window.ts) — it only stops this
 * and further notices from being queued at all, silently, same as every other cap here. Past any cap the notice is
 * silent: no entry, nothing new for the page to see. The notice's relay id is '' — never a page's (PAGE_ID needs a
 * character), so a re-sent request can never be answered from it. Fix round 1: its dismissal records NO rejection
 * (see queue.ts userRejected) — a C14 cooldown keyed on this host or tab would leak, through a later silent
 * `rejected`, the very bit the notice already answers without leaking. Returns true when a notice was queued.
 */
function mismatchNotice(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort, account: string): boolean {
  if (tx.session === null || !tx.session.some(a => a.publicKey === account)) return false;
  if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return false;
  const open = tx.s.queue.filter(isOpenEntry);
  if (open.some(e => e.host === live.host || e.tabId === live.tabId) || open.length >= MAX_OPEN) return false;
  if (!noticeBudgetLeft(tx.limits, tx.now)) return false;
  const other = [...tx.s.grants, ...tx.grants].find(g => g.account === account && g.origin !== live.origin && !isBlocked(tx.blocked, hostOf(g.origin)));
  if (other === undefined) return false;
  tx.limits = withNoticeWindow(tx.limits, tx.now);
  enqueue(tx, deps, live, '', {type: 'mismatch', account, message: null, granted: other.origin});
  return true;
}

type TxReply = {reply: Reply; notice: boolean};

/**
 * page.signTransaction / page.signAndSendTransaction (spec §1.4, §3.3; D8, C3, C14, C17), in this order, each refusal
 * before any window: the payload's shape (txRequest.ts: 1–5 transactions, each ≤ 1 232 bytes, canonical, the chain) →
 * `invalid-request`; the grant (`unauthorized` unless this origin holds one for exactly this account, while unlocked —
 * and the mismatch notice above); the account must sign every transaction (fee payer or a required signer) →
 * `invalid-request`; signAndSend only: every other signature present and valid, no durable nonce → `invalid-request`,
 * and the same message already open → `rejected` (§3.3: a second identical request while the first is unanswered);
 * a blocked or cooling-down host → `rejected`; C3's caps; then queued.
 */
async function signTx(ext: Ext, deps: WalletDeps, live: LivePort, id: string, m: Record<string, unknown>, kind: 'signTransaction' | 'signAndSendTransaction'): Promise<TxReply> {
  const req = txRequestOf(m, kind);
  return queueAccess(ext, deps, (tx, fx): TxReply => {
    documentChanged(tx, fx, live);
    const again = resent(tx, live, id);
    if (again !== null) return {reply: resentReply(again, id), notice: false};
    if (req === null) return {reply: {id, error: 'invalid-request'}, notice: false};
    if (grantedAccount(tx, live.origin) !== req.account) return {reply: {id, error: 'unauthorized'}, notice: mismatchNotice(tx, deps, live, req.account)};
    if (req.txs.some(t => slotOf(t, req.account) < 0)) return {reply: {id, error: 'invalid-request'}, notice: false};
    if (kind === 'signAndSendTransaction') {
      const t = req.txs[0];
      if (t === undefined || !othersSigned(t, req.account) || usesDurableNonce(t)) return {reply: {id, error: 'invalid-request'}, notice: false};
      if (tx.s.queue.some(e => isOpenEntry(e) && e.type === 'signAndSendTransaction' && e.transactions !== null && sameMessage(e.transactions, req.wires))) return {reply: {id, error: 'rejected'}, notice: false};
    }
    if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {reply: {id, error: 'rejected'}, notice: false};
    const refused = admit(tx, live);
    if (refused !== null) return {reply: {id, error: refused}, notice: false};
    touch(tx, live.origin);
    const e = enqueue(tx, deps, live, id, {type: kind, account: req.account, message: null, transactions: req.wires});
    return {reply: {id, accepted: true, requestId: e.requestId}, notice: false};
  });
}

/** C2: a dApp's disconnect removes its grant, whichever the scope; its queued requests are answered `rejected`. */
async function disconnect(ext: Ext, deps: WalletDeps, live: LivePort, id: string): Promise<Reply> {
  return queueAccess(ext, deps, (tx, fx): Reply => {
    documentChanged(tx, fx, live);
    const dropped = dropGrant(tx, live.origin);
    rejectQueued(tx, fx, e => e.origin === live.origin);
    if (dropped !== null) fx.changes.set(live.origin, []);
    return {id, result: {}};
  });
}

/** §1.4 page.resume: per id this port's (tabId, origin) owns — the stored answer, or pending; anything else unknown. */
async function resume(ext: Ext, deps: WalletDeps, live: LivePort, ids: string[]): Promise<void> {
  const out = await queueAccess(ext, deps, tx =>
    ids.map(requestId => {
      const e = tx.s.queue.find(x => x.requestId === requestId);
      if (e === undefined || !owns(live, e)) return {requestId, unknown: true};
      return e.state === 'answered' && e.answer !== null ? {requestId, ...e.answer} : {requestId, pending: true};
    }),
  );
  reply(live, {resume: out});
}

/** §1.4 page.ack: the stored answer is dropped — only an answered entry this port's (tabId, origin) owns. */
async function ack(ext: Ext, deps: WalletDeps, live: LivePort, requestId: string): Promise<void> {
  await queueAccess(ext, deps, tx => {
    tx.s.queue = tx.s.queue.filter(e => !(e.requestId === requestId && e.state === 'answered' && owns(live, e)));
  });
}

/** One message on a page port. Malformed input gets `invalid-request` when it carries an id to answer, else nothing. */
export async function onPageMessage(ext: Ext, deps: WalletDeps, live: LivePort, m: unknown): Promise<void> {
  if (!isObj(m) || typeof m.type !== 'string') return;
  const id = typeof m.id === 'string' && PAGE_ID.test(m.id) ? m.id : null;
  const invalid = () => {
    if (id !== null) reply(live, {id, error: 'invalid-request'});
  };
  switch (m.type) {
    case 'page.ping':
      return;
    case 'page.ack':
      if (typeof m.requestId === 'string' && REQUEST_ID.test(m.requestId)) await ack(ext, deps, live, m.requestId);
      return;
    case 'page.resume': {
      const ids = m.requestIds;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_RESUME || !ids.every(x => typeof x === 'string' && REQUEST_ID.test(x))) return;
      await resume(ext, deps, live, ids as string[]);
      return;
    }
    case 'page.connect': {
      if (id === null || typeof m.silent !== 'boolean') return invalid();
      const r = await connect(ext, deps, live, id, m.silent);
      reply(live, r);
      if ('accepted' in r) await ensureWindow(ext, deps);
      return;
    }
    case 'page.signMessage': {
      if (id === null) return invalid();
      const r = await signMessage(ext, deps, live, id, m);
      reply(live, r);
      if ('accepted' in r) await ensureWindow(ext, deps);
      return;
    }
    case 'page.signTransaction':
    case 'page.signAndSendTransaction': {
      if (id === null) return invalid();
      const {reply: r, notice} = await signTx(ext, deps, live, id, m, m.type === 'page.signTransaction' ? 'signTransaction' : 'signAndSendTransaction');
      reply(live, r);
      if ('accepted' in r || notice) await ensureWindow(ext, deps);
      return;
    }
    case 'page.disconnect':
      if (id === null) return invalid();
      reply(live, await disconnect(ext, deps, live, id));
      return;
    default:
      // A privileged type, a type of a later plan, or garbage: refused.
      return invalid();
  }
}

/**
 * runtime.onConnect (§1.3): a port named `noctura-page` whose sender passes the origin rule is registered, keyed
 * `(tabId, origin)` from `port.sender`; any other port is disconnected at once. A new document in a tab ends its
 * predecessor's queued requests (§2.3). Returns the registered port (null when refused).
 */
export function acceptPagePort(ext: Ext, deps: WalletDeps, port: PortLike): LivePort | null {
  const o = port.name === PAGE_PORT ? pageOrigin(ext, port.sender) : null;
  if (o === null) {
    port.disconnect();
    return null;
  }
  const live: LivePort = {...o, port};
  const rt = runtimeFor(ext);
  rt.ports.add(live);
  port.onDisconnect.addListener(() => {
    rt.ports.delete(live);
  });
  port.onMessage.addListener(m => {
    void onPageMessage(ext, deps, live, m).catch(e => console.warn('dApp page message failed', e));
  });
  void queueAccess(ext, deps, (tx, fx) => documentChanged(tx, fx, live)).catch(e => console.warn('dApp port: document check failed', e));
  return live;
}
