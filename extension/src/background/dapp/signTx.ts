import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {digestOf} from '../digest';
import {getSession} from '../session';
import {readSettings} from '../settings';
import {recipientFacts} from '../knownRecipients';
import {FLAG_ROW, MAX_DAPP_OUTGOING, challengeInfo, challengeSatisfied, dropChallenge, issueChallenge, type ChallengeAbout, type DappFlag, type DappOutgoing} from '../reauthChallenges';
import {readContacts} from '../contacts';
import {decodeInstructions, type DecodedInstruction} from './decode/decode';
import {resolveKeys} from './decode/keys';
import {parseWire, type ParsedTx} from './decode/wire';
import {withRecent} from './grants';
import {withDappTxs} from './dappTxs';
import {broadcastFirst, dropDappSend, recordDappSend} from '../pending';
import {firstSignature} from '../../../../core/solana/broadcast';
import {tokenForMint, WALLET_TOKENS} from '../../../../core/solana/balances';
import {runtimeFor} from './ports';
import {answer, queueAccess} from './queue';
import {feeOf, simulateTransactions, withAmountDecimals, type SimState, type TxOutcome} from './simulate';
import {overridesMatch, type RedFlag} from './redFlags';
import {grantIn, putGrant, type Entry, type Tx} from './store';
import {slotOf} from './txRequest';
import type {DappReauthReason} from '../reauthPolicy';

/** u64::MAX as an approval's base-unit amount: F5's scope is `unlimited` only for it (O9). */
const U64_MAX = '18446744073709551615';

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
  /**
   * Fix round 1 (promoted minor 3, R5): the unit limit and this account's own fee, computed LOCALLY from the decoded
   * instructions (`simulate.ts`'s `feeOf` — 5 000 lamports per required signature plus the priority fee, no RPC
   * round trip) — so #48 can show them while still simulating, not only once `outcome` answers. `unitLimit` is null
   * only when `instructions` is (a lookup table not yet resolved); `feeLamports` is also null when this account is
   * not the transaction's own fee payer.
   */
  unitLimit: number | null;
  feeLamports: string | null;
  /** This transaction's simulated outcome, or null while simulating. */
  outcome: TxOutcome | null;
  /** B1c-3: this transaction's red flags as #48 renders them (redFlags.ts's order), or null while simulating. */
  flags: FlagView[] | null;
}

/**
 * B1c-3: a red flag as the window sees it — the background's own, except that a dependent step names the step it
 * depends on as `step`, 1-based as Q32 says it ("depends on step <N>"), never redFlags.ts's 0-based `on`: the window
 * gets one convention only, the same as its outcome's `on`.
 */
export type FlagView = Exclude<RedFlag, {kind: 'dependent'}> | {kind: 'dependent'; severity: 'block'; word: 'UNCHECKED'; at: null; step: number};
export const flagView = (f: RedFlag): FlagView => (f.kind === 'dependent' ? {kind: 'dependent', severity: 'block', word: f.word, at: null, step: f.on + 1} : f);

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
    const instructions = keys !== undefined ? withAmountDecimals(decodeInstructions(p, {keys}), sim?.amountDecimals[i] ?? []) : p.lookups.length === 0 ? decodeInstructions(p, resolveKeys(p, new Map())) : null;
    const local = instructions === null ? null : feeOf(p, instructions);
    return {
      version: p.version,
      feePayer: p.signers[0] ?? '',
      instructions,
      unitLimit: local?.unitLimit ?? null,
      feeLamports: local !== null && p.signers[0] === e.account ? local.feeLamports.toString() : null,
      outcome: sim?.outcomes[i] ?? null,
      flags: sim === null ? null : (sim.flags[i] ?? []).map(flagView),
    };
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

type DappAbout = Extract<ChallengeAbout, {kind: 'dapp'}>;

/** What a dApp challenge is bound to: this request and its exact bytes, for this account. */
export const dappDigest = (e: Pick<Entry, 'requestId' | 'account' | 'transactions'>): string => digestOf('dapp', {requestId: e.requestId, account: e.account, transactions: e.transactions});

/**
 * The decision's checks for a transaction request (§2.3's table, extended by §3.3): null when approvable. B1c-3 (the
 * override rule): after every B1c-2 row, the typed words against the flags THIS stored simulation carries (C13: the
 * background recomputes them; the window's are only compared) — `override-mismatch` for any word not expected or given
 * twice, `override-missing` for a block with no word.
 */
export type TxRefusal = 'not-simulated' | 'stale' | 'out-of-date' | 'simulation-failed' | 'blockhash-expired' | 'override-mismatch' | 'override-missing';
export function txRefused(e: Entry, simulation: string | null, overrides: readonly {tx: number; word: string}[], now: number): TxRefusal | null {
  if (e.sim?.status !== 'ok') return 'not-simulated';
  const sim = e.sim.sim;
  // C13: the window names the simulation it showed; another one (a refresh landed) or an old one is not approvable.
  // Final review I3: two refusals, so the window's line stays true — `stale` when the window named another simulation
  // than the newest (what it showed is no longer what would be signed: "The transaction changed…"); `out-of-date` when
  // it named the newest one but that is SIM_VALID_MS old (its refresh has not landed yet — nothing changed: "This
  // simulation is out of date. Wait a moment for it to refresh."). The id is checked first: another id is `stale`
  // whatever its age.
  if (simulation !== sim.id) return 'stale';
  if (now - sim.at >= SIM_VALID_MS) return 'out-of-date';
  if (sim.outcomes.some(o => !o.ok && o.error === 'expired')) return 'blockhash-expired';
  // O2: a step that depends on an earlier one is not a failure of its own only beside its F10 flag for that same step
  // — a block, so approvable only with UNCHECKED (below). Every other failure stays Reject-only.
  if (sim.outcomes.some((o, i) => !o.ok && !(o.error === 'dependent' && sim.flags[i]?.some(f => f.kind === 'dependent' && f.on === o.on - 1)))) return 'simulation-failed';
  const words = overridesMatch(sim.flags, overrides);
  if (words === 'mismatch') return 'override-mismatch';
  if (words === 'missing') return 'override-missing';
  return null;
}

/**
 * Fix round 1 item 2: `simulate.ts`'s `BalanceChange.decimals` is untrusted mint data (a hostile or merely unusual
 * token can report any u8); `reauthChallenges.ts`'s `isOutgoing` only ever accepted 0–18. Clamped to null (shown in
 * base units) here, at the one place a dApp challenge's `about` is built, so an out-of-range value can never reach
 * `issueChallenge` and make it throw (uncaught, an unexpected error reaching the window) — never a thrown exception.
 */
const dappDecimals = (d: number | null): number | null => (d !== null && d >= 0 && d <= 18 ? d : null);

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
      out.set(c.mint, {amount: (prev?.amount ?? 0n) - a, decimals: dappDecimals(c.decimals), usd: prev !== undefined && prev.usd === null ? null : usd === null ? null : (prev?.usd ?? 0n) + usd});
    }
  }
  // Review 1 L9: more mints than #10 lists is cut, not refused — SOL first, then the largest in USD, then the unpriced
  // ones in the order the batch names them; the rest are counted.
  const rank = (m: string | null, usd: bigint | null): [number, bigint] => (m === null ? [0, 0n] : usd === null ? [2, 0n] : [1, -usd]);
  const all = [...out].map(([mint, v], i) => ({mint, v, i})).sort((x, y) => {
    const [a, b] = [rank(x.mint, x.v.usd), rank(y.mint, y.v.usd)];
    return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || x.i - y.i;
  });
  // Fix round 1 item 4: a mint this wallet knows is named only when the simulation's own decimals for it still match
  // this wallet's table — simulate.ts's decimals are untrusted mint data (a hostile token, or an RPC that lies about
  // even a legitimate mint's account, can report anything); a mismatch names no real token and is shown unnamed, in
  // base units, never refused as undescribable for it.
  const outgoing: DappOutgoing[] = all.slice(0, MAX_DAPP_OUTGOING).map(({mint, v}) => {
    const candidate = mint === null ? 'SOL' : tokenForMint(mint);
    const symbol = candidate !== null && v.decimals === WALLET_TOKENS[candidate].decimals ? candidate : null;
    return {mint, symbol, amount: v.amount.toString(), decimals: v.decimals};
  });
  // B1c-3: the flags, one per (transaction, row) — what #10 names (a block's word, a dependent step's step) and what
  // a refresh is compared on; several Token-2022 mints of one transaction are one entry.
  const flags: DappFlag[] = [];
  e.sim.sim.flags.forEach((list, tx) => {
    for (const f of list) {
      const row = FLAG_ROW[f.kind];
      if (flags.some(x => x.tx === tx && x.row === row)) continue;
      const step = f.kind === 'dependent' ? f.on + 1 : null;
      flags.push(f.kind === 'unlimited-approve' ? {tx, row, word: f.word, step, scope: f.approvals.some(a => a.amount === U64_MAX) ? 'unlimited' : 'nearly-all'} : {tx, row, word: f.severity === 'block' ? f.word : null, step});
    }
  });
  return {kind: 'dapp', account: e.account, site, transactions: e.transactions.length, outgoing, omitted: all.length - outgoing.length, reasons: e.sim.sim.reasons.slice(), thresholdCents, flags};
}

/** Whether every reason the fresh simulation gives was already named in the challenge issued for it. */
function reasonsCovered(fresh: readonly DappReauthReason[], issued: readonly DappReauthReason[]): boolean {
  const have = new Set(issued);
  return fresh.every(r => have.has(r));
}

/**
 * B1c-3: whether every flag of the fresh simulation — its transaction, row, word, step and F5's scope — was already
 * named in the challenge issued for it (#10 described those); a refresh that adds a block, or a warning, or moves one to
 * another transaction or step, or turns a nearly-all approval unlimited, is not covered.
 */
function flagsCovered(fresh: readonly DappFlag[], issued: readonly DappFlag[]): boolean {
  const key = (f: DappFlag): string => JSON.stringify([f.tx, f.row, f.word, f.step, f.scope ?? null]);
  const have = new Set(issued.map(key));
  return fresh.every(f => have.has(key(f)));
}

/**
 * Whether any mint's fresh outgoing amount exceeds what the issued challenge described — a mint absent from the
 * issued list (new since the challenge was issued) counts as having had 0 — or more mints are cut from the list than
 * were (B1c-3, the final review's minor: a mint past MAX_DAPP_OUTGOING was never described either).
 */
export function outgoingGrew(fresh: Pick<DappAbout, 'outgoing' | 'omitted'>, issued: Pick<DappAbout, 'outgoing' | 'omitted'>): boolean {
  if (fresh.omitted > issued.omitted) return true;
  const had = new Map(issued.outgoing.map(o => [o.mint, BigInt(o.amount)]));
  return fresh.outgoing.some(o => BigInt(o.amount) > (had.get(o.mint) ?? 0n));
}

/**
 * B1b's re-authentication for a transaction request (spec §3.3): when the simulation gave reasons, Approve first asks
 * for a challenge — issued once, kept on the entry, described by #10 (reached from the Noctura icon, never from the
 * window: D11) — and signs only once it is proven. Runs outside every queue section (the challenge store takes
 * sessionMutex). `ready`: no challenge needed; `proven`: approvable once the challenge is consumed — dapp.decide
 * consumes it right after the `deciding` section (plan 2 review 1 L1: a refusal in that section — a refresh landed,
 * the request is no longer the head — leaves the proof standing, so the user is not asked again for it). Still single
 * use: a `deciding` entry is never decided twice, and a failed consume ends the request `rejected` before any key is read.
 * Fix round 1 item 3: a live, even proven, challenge is frozen from the simulation that issued it (#10 described that
 * one) — a 30 s refresh that grows an outgoing amount, or adds a reason, makes that description stale: it no longer
 * speaks for what Approve is about to sign. Re-issued (a new id) whenever the fresh simulation's reasons are not all
 * already named, or any mint's outgoing amount grew past what was described, or (B1c-3) it has a flag the issued
 * challenge did not name. Fix round 1 item 1: the superseded id is
 * then DELETED (dropChallenge, by id — never dropChallengesFor by digest, since the new one is issued for the same
 * digest and a digest-keyed drop could not tell the two apart), so a #10 tab already open on it reads back
 * `unknown-challenge` (dappExpired) instead of still showing "Confirmed" for a description Approve no longer honors.
 */
export async function reauthGate(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, e: Entry, site: string): Promise<'ready' | 'proven' | 'reauth-required' | 'stale'> {
  if (e.sim?.status !== 'ok' || e.sim.sim.reasons.length === 0) return 'ready';
  const digest = dappDigest(e);
  const now = deps.now();
  const current = e.challengeId !== null ? await challengeInfo(ext, now, e.challengeId) : null;
  const fresh = dappAbout(e, site, (await readSettings(ext)).reauthUsdCents);
  if (fresh === null) return 'stale';
  const stillCovers = current !== null && current.kind === 'dapp' && reasonsCovered(fresh.reasons, current.reasons) && !outgoingGrew(fresh, current) && flagsCovered(fresh.flags, current.flags);
  if (!stillCovers) {
    const id = await issueChallenge(ext, deps, digest, fresh);
    const superseded = e.challengeId;
    if (superseded !== null && superseded !== id) await dropChallenge(ext, superseded);
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
    // The history badge (#26): a transaction the account pays for is identified by the account's own signature.
    const paid = work.txs.flatMap((p, i) => {
      const w = signed?.[i];
      return p.signers[0] === work.account && w !== undefined ? [{signature: firstSignature(base64.decode(w)), origin: e.origin, at: tx.now}] : [];
    });
    if (paid.length > 0) tx.txs = withDappTxs(tx.txs, paid);
    answer(fx, e, {result: {signed}}, tx.now);
  });
}

/**
 * page.signAndSendTransaction's effect (spec §1.5 step 2, §3.3; C17 — real funds: no double signature, no double
 * broadcast), after the `deciding` section:
 *  1. read the key and sign (the dApp's bytes, the account's slot);
 *  2. record the signed bytes in v1_pending (B1b's pattern: the confirmation poller watches them from here on);
 *  3. in one section, still this instance's `deciding` entry, unlocked, the account in the session, the grant held:
 *     write `sent {wire, signature}` into the entry — from here a lock or a restart answers `{signature}` and never
 *     signs or broadcasts again (lockHook.ts, queue.ts sweep) — and badge the transaction for #26. If that section
 *     refuses, the entry is answered `rejected` and the recorded bytes are marked never sent;
 *  4. broadcast through the coordinator's route (pending.ts broadcastFirst) — even if a lock landed after step 3: the
 *     user approved it, the dApp may already hold the signature (B1b: a send in flight is not cancelled by a lock);
 *  5. answer `{signature}` — or, when the route refused it before forwarding (nothing reached the network),
 *     `send-failed` (spec §1.6, rev 3.3) — only if the entry is still this instance's `deciding` one (a lock or the
 *     dead-effect sweep may have answered `{signature}` already: answered once).
 * A worker stopped between steps 3 and 4 (review 1 M1): the restart answers `{signature}` from the entry, marking the
 * record `due` first, and the poller's next round hands the bytes to the route — once (pending.ts claimFirst).
 */
export async function finishSend(ext: Ext, deps: WalletDeps, requestId: string, instance: string): Promise<void> {
  const work = await queueAccess(ext, deps, tx => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.type !== 'signAndSendTransaction' || e.account === null || e.sim?.status !== 'ok') return null;
    const parsed = txsOf(e);
    return parsed === null || parsed.wires.length !== 1 ? null : {account: e.account, origin: e.origin, lastValidBlockHeight: e.sim.sim.lastValidBlockHeight, ...parsed};
  });
  if (work === null) return;
  const key = (await getSession(ext))?.find(a => a.publicKey === work.account);
  let wire: Uint8Array | null = null;
  if (key !== undefined) {
    try {
      wire = signAll(work.wires, work.txs, key)[0] ?? null;
    } catch {
      wire = null;
    }
  }
  const signed = wire;
  const record = signed === null ? null : await recordDappSend(ext, deps, {account: work.account, wire: signed, lastValidBlockHeight: work.lastValidBlockHeight, origin: work.origin});
  const recorded = await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return false;
    if (signed === null || record === null || !stillDeciding(tx, e, instance, work.account)) {
      answer(fx, e, {error: 'rejected'}, tx.now);
      return false;
    }
    e.sent = {wire: base64.encode(signed), signature: record.signature};
    const g = grantIn(tx, e.origin);
    if (g !== null) putGrant(tx, withRecent(g, 'signAndSendTransaction', tx.now, 'approved'));
    tx.txs = withDappTxs(tx.txs, [{signature: record.signature, origin: e.origin, at: tx.now}]);
    return true;
  });
  if (!recorded) {
    if (record !== null) await dropDappSend(ext, record.id);
    return;
  }
  const outcome = record === null ? 'not-sent' : await broadcastFirst(ext, deps, record);
  await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.sent === null) return;
    answer(fx, e, outcome === 'sent' ? {result: {signature: e.sent.signature}} : {error: 'send-failed'}, tx.now);
  });
}

/**
 * dapp.reauth (B1c-2; D11 — "the password is typed only after clicking the Noctura icon"): the popup and the UI tab ask
 * it when they open; the approval window never links into the vault page. The head request's challenge, while it is
 * live and not yet proven, with the site as the window shows it — the popup then offers #10 for it. Refused while
 * locked, as #49's messages.
 *
 * Fix round 1 item 3: the site comes from the challenge's own stored `about.site` — the same value #10 describes,
 * read by the one challengeInfo call this already makes — never recomputed here from the entry's origin/host (that
 * duplicated siteOf's own URL parsing and could, in principle, read back something #10 does not say).
 */
export async function reauthWaiting(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<{ok: true; data: {challengeId: string; site: string} | null} | {ok: false; error: 'locked'}> {
  return queueAccess(ext, deps, async tx => {
    if (tx.session === null) return {ok: false as const, error: 'locked' as const};
    const h = tx.s.queue.find(e => e.state === 'queued' || e.state === 'deciding');
    if (h === undefined || h.state !== 'queued' || !isTxType(h.type) || h.challengeId === null) return {ok: true as const, data: null};
    // Read-only loads of the challenge store (no mutex of their own): safe inside the section.
    const about = await challengeInfo(ext, tx.now, h.challengeId);
    if (about === null || about.kind !== 'dapp') return {ok: true as const, data: null};
    if (await challengeSatisfied(ext, tx.now, h.challengeId, dappDigest(h))) return {ok: true as const, data: null};
    return {ok: true as const, data: {challengeId: h.challengeId, site: about.site}};
  });
}
