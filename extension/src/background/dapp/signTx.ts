import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {digestOf} from '../digest';
import {getSession} from '../session';
import {readSettings} from '../settings';
import {recipientFacts} from '../knownRecipients';
import {MAX_DAPP_OUTGOING, challengeInfo, challengeSatisfied, issueChallenge, type ChallengeAbout, type DappOutgoing} from '../reauthChallenges';
import {readContacts} from '../contacts';
import {decodeInstructions, type DecodedInstruction} from './decode/decode';
import {resolveKeys} from './decode/keys';
import {parseWire, type ParsedTx} from './decode/wire';
import {withRecent} from './grants';
import {runtimeFor} from './ports';
import {answer, queueAccess} from './queue';
import {simulateTransactions, type SimState, type TxOutcome} from './simulate';
import {grantIn, putGrant, type Entry, type Tx} from './store';
import {slotOf} from './txRequest';
import type {DappReauthReason} from '../reauthPolicy';

/**
 * A transaction request after it is queued (spec B1c §3.3, §1.5; C13, C15, C17): its simulation — run when the window
 * asks (`dapp.pending`) and again SIM_REFRESH_MS after the last one (§3.3: "after 30 s on screen the transaction is
 * re-simulated to refresh the shown effects"), never inside a queue section (it reads the proxy) and at most once at a
 * time per request; what #48 shows of it; the checks `dapp.decide` adds for it — the simulation the window showed, still
 * fresh, every transaction simulated without error; B1b's re-authentication through #10 — and the `signTransaction`
 * effect: each transaction signed at the account's own slot, every other signature kept as the dApp sent it.
 */
export const SIM_REFRESH_MS = 30_000;
/** An approval needs a simulation at most this old: the refresh at 30 s has ten seconds to land before Approve stops working. */
export const SIM_VALID_MS = 40_000;
/** After an unreachable proxy, the next attempt. */
export const SIM_RETRY_MS = 5_000;

export const isTxType = (t: Entry['type']): t is 'signTransaction' | 'signAndSendTransaction' => t === 'signTransaction' || t === 'signAndSendTransaction';

/** The request's transactions, parsed again from what is stored (the page's bytes: parsed when queued, never trusted half-read). */
export function txsOf(e: Pick<Entry, 'transactions'>): {wires: Uint8Array[]; txs: ParsedTx[]} | null {
  if (e.transactions === null || e.transactions.length === 0) return null;
  const wires: Uint8Array[] = [];
  const txs: ParsedTx[] = [];
  for (const w of e.transactions) {
    let bytes: Uint8Array;
    try {
      bytes = base64.decode(w);
    } catch {
      return null;
    }
    const p = parseWire(bytes);
    if (p === null) return null;
    wires.push(bytes);
    txs.push(p);
  }
  return {wires, txs};
}

/** Whether `dapp.pending` should start a simulation of this head now. */
export function needsSimulation(e: Entry, now: number): boolean {
  if (!isTxType(e.type) || e.state !== 'queued') return false;
  if (e.sim === null) return true;
  return e.sim.status === 'ok' ? now - e.sim.sim.at >= SIM_REFRESH_MS : now - e.sim.at >= SIM_RETRY_MS;
}

/**
 * One simulation of a queued transaction request. Section 1 reads what to simulate (still queued, the session unlocked,
 * its account still in it); the reads and the simulation run outside any section; section 2 stores the result only if
 * the entry is still `queued` — a decision, a lock or an expiry meanwhile wins. A thrown read is stored as `unreachable`
 * (the window says so and offers only Reject until the next attempt answers).
 */
export async function runSimulation(ext: Ext, deps: WalletDeps, requestId: string): Promise<void> {
  const rt = runtimeFor(ext);
  if (rt.simulating.has(requestId)) return;
  rt.simulating.add(requestId);
  try {
    const work = await queueAccess(ext, deps, tx => {
      const e = tx.s.queue.find(x => x.requestId === requestId);
      if (e === undefined || e.state !== 'queued' || !isTxType(e.type) || e.account === null || tx.session === null) return null;
      const account = e.account;
      if (!tx.session.some(a => a.publicKey === account)) return null;
      const parsed = txsOf(e);
      return parsed === null ? null : {account, ...parsed, session: tx.session.map(a => ({publicKey: a.publicKey}))};
    });
    if (work === null) return;
    let state: SimState;
    try {
      const [facts, settings] = await Promise.all([recipientFacts(ext, work.session), readSettings(ext)]);
      const sim = await simulateTransactions(deps, {account: work.account, wires: work.wires, txs: work.txs, known: facts.known, thresholdCents: settings.reauthUsdCents});
      state = {status: 'ok', sim};
    } catch {
      state = {status: 'unreachable', at: deps.now()};
    }
    await queueAccess(ext, deps, tx => {
      const e = tx.s.queue.find(x => x.requestId === requestId);
      if (e !== undefined && e.state === 'queued') e.sim = state;
    });
  } finally {
    rt.simulating.delete(requestId);
  }
}

/** A label for an address #48 shows (B1 §3 "Addresses … with a label where known"): one of the wallet's accounts, or an address-book contact. */
export interface AddressLabel {
  address: string;
  kind: 'account' | 'contact';
  name: string;
}

export interface TxItemView {
  version: 'legacy' | 0;
  feePayer: string;
  /** Null while a lookup table is not yet resolved (before the first simulation of a v0 transaction that uses one). */
  instructions: DecodedInstruction[] | null;
  /** This transaction's simulated outcome, or null while simulating. */
  outcome: TxOutcome | null;
}

export type SimulationView = {status: 'simulating'} | {status: 'unreachable'} | {status: 'ok'; id: string; slot: number; elapsedMs: number; at: number};

/** #48's view of a transaction request (spec §3.3). */
export interface TxDetail {
  transactions: TxItemView[];
  simulation: SimulationView;
  /** B1b's rules (the simulation's reasons); `state`: none asked yet, a challenge waiting for #10, or proven (Approve signs). */
  reauth: {reasons: DappReauthReason[]; state: 'needed' | 'waiting' | 'proven'} | null;
  labels: AddressLabel[];
}

/** The request's #48 view; null when its bytes no longer read back (then the window offers only Reject). */
export async function txDetail(ext: Ext, e: Entry, session: readonly {publicKey: string}[], names: ReadonlyMap<string, string>, now: number, running: boolean): Promise<TxDetail | null> {
  const parsed = txsOf(e);
  if (parsed === null) return null;
  const sim = e.sim?.status === 'ok' ? e.sim.sim : null;
  const transactions = parsed.txs.map((p, i): TxItemView => {
    const keys = sim?.keys[i];
    const instructions = keys !== undefined ? decodeInstructions(p, {keys}) : p.lookups.length === 0 ? decodeInstructions(p, resolveKeys(p, new Map())) : null;
    return {version: p.version, feePayer: p.signers[0] ?? '', instructions, outcome: sim?.outcomes[i] ?? null};
  });
  const simulation: SimulationView =
    sim !== null ? {status: 'ok', id: sim.id, slot: sim.slot, elapsedMs: sim.elapsedMs, at: sim.at} : e.sim?.status === 'unreachable' && !running ? {status: 'unreachable'} : {status: 'simulating'};
  let reauth: TxDetail['reauth'] = null;
  if (sim !== null && sim.reasons.length > 0) {
    let state: 'needed' | 'waiting' | 'proven' = 'needed';
    if (e.challengeId !== null && (await challengeInfo(ext, now, e.challengeId)) !== null) state = (await challengeSatisfied(ext, now, e.challengeId, dappDigest(e))) ? 'proven' : 'waiting';
    reauth = {reasons: sim.reasons, state};
  }
  // Labels for every address the instructions name: the wallet's own accounts and the address book.
  const addresses = new Set(transactions.flatMap(t => (t.instructions ?? []).flatMap(ix => ix.fields.map(f => (f.value.kind === 'address' ? f.value.value : null)).filter((a): a is string => a !== null))));
  const contacts = await readContacts(ext).catch(() => []);
  const labels: AddressLabel[] = [];
  for (const address of addresses) {
    const own = session.some(a => a.publicKey === address) ? names.get(address) : undefined;
    const contact = contacts.find(c => c.address === address);
    if (own !== undefined) labels.push({address, kind: 'account', name: own});
    else if (contact !== undefined) labels.push({address, kind: 'contact', name: contact.name});
  }
  return {transactions, simulation, reauth, labels};
}

/** What a dApp challenge is bound to: this request and its exact bytes, for this account. */
export const dappDigest = (e: Pick<Entry, 'requestId' | 'account' | 'transactions'>): string => digestOf('dapp', {requestId: e.requestId, account: e.account, transactions: e.transactions});

/** The decision's checks for a transaction request (§2.3's table, extended by §3.3): null when approvable. */
export type TxRefusal = 'not-simulated' | 'stale' | 'simulation-failed' | 'blockhash-expired';
export function txRefused(e: Entry, simulation: string | null, now: number): TxRefusal | null {
  if (e.sim?.status !== 'ok') return 'not-simulated';
  const sim = e.sim.sim;
  // C13: the window names the simulation it showed; another one (a refresh landed) or an old one is not approvable.
  if (simulation !== sim.id || now - sim.at >= SIM_VALID_MS) return 'stale';
  if (sim.outcomes.some(o => !o.ok && o.error === 'expired')) return 'blockhash-expired';
  if (sim.outcomes.some(o => !o.ok)) return 'simulation-failed';
  return null;
}

/** What #10 says about a dApp challenge: the site, the batch's size, what leaves the account per mint, the reasons. */
export function dappAbout(e: Entry, site: string, thresholdCents: number): Extract<ChallengeAbout, {kind: 'dapp'}> | null {
  if (e.sim?.status !== 'ok' || e.account === null || e.transactions === null) return null;
  // Per mint: what leaves, and its USD value when every part of it has a price (null otherwise).
  const out = new Map<string | null, {amount: bigint; decimals: number | null; usd: bigint | null}>();
  for (const o of e.sim.sim.outcomes) {
    if (!o.ok) continue;
    for (const c of o.changes) {
      const a = BigInt(c.amount);
      if (a >= 0n) continue;
      const prev = out.get(c.mint);
      const usd = c.usdMicros === null ? null : -BigInt(c.usdMicros);
      out.set(c.mint, {amount: (prev?.amount ?? 0n) - a, decimals: c.decimals, usd: prev !== undefined && prev.usd === null ? null : usd === null ? null : (prev?.usd ?? 0n) + usd});
    }
  }
  // Review 1 L9: more mints than #10 lists is cut, not refused — SOL first, then the largest in USD, then the unpriced
  // ones in the order the batch names them; the rest are counted.
  const rank = (m: string | null, usd: bigint | null): [number, bigint] => (m === null ? [0, 0n] : usd === null ? [2, 0n] : [1, -usd]);
  const all = [...out].map(([mint, v], i) => ({mint, v, i})).sort((x, y) => {
    const [a, b] = [rank(x.mint, x.v.usd), rank(y.mint, y.v.usd)];
    return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || x.i - y.i;
  });
  const outgoing: DappOutgoing[] = all.slice(0, MAX_DAPP_OUTGOING).map(({mint, v}) => ({mint, amount: v.amount.toString(), decimals: v.decimals}));
  return {kind: 'dapp', account: e.account, site, transactions: e.transactions.length, outgoing, omitted: all.length - outgoing.length, reasons: e.sim.sim.reasons.slice(), thresholdCents};
}

/**
 * B1b's re-authentication for a transaction request (spec §3.3): when the simulation gave reasons, Approve first asks
 * for a challenge — issued once, kept on the entry, described by #10 (reached from the Noctura icon, never from the
 * window: D11) — and signs only once it is proven. Runs outside every queue section (the challenge store takes
 * sessionMutex). `ready`: no challenge needed; `proven`: approvable once the challenge is consumed — dapp.decide
 * consumes it right after the `deciding` section (plan 2 review 1 L1: a refusal in that section — a refresh landed,
 * the request is no longer the head — leaves the proof standing, so the user is not asked again for it). Still single
 * use: a `deciding` entry is never decided twice, and a failed consume ends the request `rejected` before any key is read.
 */
export async function reauthGate(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, e: Entry, site: string): Promise<'ready' | 'proven' | 'reauth-required' | 'stale'> {
  if (e.sim?.status !== 'ok' || e.sim.sim.reasons.length === 0) return 'ready';
  const digest = dappDigest(e);
  const now = deps.now();
  const live = e.challengeId !== null && (await challengeInfo(ext, now, e.challengeId)) !== null;
  if (!live) {
    const about = dappAbout(e, site, (await readSettings(ext)).reauthUsdCents);
    if (about === null) return 'stale';
    const id = await issueChallenge(ext, deps, digest, about);
    await queueAccess(ext, deps, tx => {
      const x = tx.s.queue.find(q => q.requestId === e.requestId);
      if (x !== undefined && x.state === 'queued') x.challengeId = id;
    });
    return 'reauth-required';
  }
  const id = e.challengeId as string;
  return (await challengeSatisfied(ext, now, id, digest)) ? 'proven' : 'reauth-required';
}

/** The wire with this signature written into slot `slot` (every other byte as the dApp sent it). */
export function withSignature(wire: Uint8Array, slot: number, signature: Uint8Array): Uint8Array {
  // The wire was accepted only as canonical (decode/wire.ts), so its signature count is a shortvec of 1 to 3 bytes.
  let at = 0;
  while ((wire[at] ?? 0) & 0x80) at++;
  const offset = at + 1 + 64 * slot;
  const out = Uint8Array.from(wire);
  out.set(signature, offset);
  return out;
}

/** Each transaction signed by the account at its own slot. The key bytes are zeroed after. */
export function signAll(wires: readonly Uint8Array[], txs: readonly ParsedTx[], account: {publicKey: string; secretKey: string}): Uint8Array[] {
  const sk = base64.decode(account.secretKey);
  try {
    return wires.map((w, i) => {
      const p = txs[i];
      const slot = p === undefined ? -1 : slotOf(p, account.publicKey);
      if (p === undefined || slot < 0) throw new Error('the account does not sign this transaction');
      return withSignature(w, slot, ed25519.sign(p.message, sk.subarray(0, 32)));
    });
  } finally {
    sk.fill(0);
  }
}

/** The effect's own checks again, at the write (C17): still this instance's `deciding` entry, unlocked, the account in the session, the grant held. */
export function stillDeciding(tx: Tx, e: Entry | undefined, instance: string, account: string): e is Entry {
  if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return false;
  return tx.session !== null && tx.session.some(a => a.publicKey === account) && grantIn(tx, e.origin)?.account === account;
}

/**
 * page.signTransaction's effect (§1.5 step 2, C17): after the `deciding` section, read the key, sign every transaction,
 * and answer `{signed}` in a section that first confirms the entry is still this instance's `deciding` one (a lock, a
 * restart, a revoke or an account removal in between answered or ends it `rejected` — the signatures are dropped,
 * never delivered).
 */
export async function finishSignTx(ext: Ext, deps: Pick<WalletDeps, 'now'>, requestId: string, instance: string): Promise<void> {
  const work = await queueAccess(ext, deps, tx => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.type !== 'signTransaction' || e.account === null) return null;
    const parsed = txsOf(e);
    return parsed === null ? null : {account: e.account, ...parsed};
  });
  if (work === null) return;
  const key = (await getSession(ext))?.find(a => a.publicKey === work.account);
  let signed: string[] | null = null;
  if (key !== undefined) {
    try {
      signed = signAll(work.wires, work.txs, key).map(w => base64.encode(w));
    } catch {
      signed = null;
    }
  }
  await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return;
    if (signed === null || !stillDeciding(tx, e, instance, work.account)) {
      answer(fx, e, {error: 'rejected'}, tx.now);
      return;
    }
    const g = grantIn(tx, e.origin);
    if (g !== null) putGrant(tx, withRecent(g, 'signTransaction', tx.now, 'approved'));
    answer(fx, e, {result: {signed}}, tx.now);
  });
}
