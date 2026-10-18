import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {PublicKey, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount, type TransactionInstruction} from '@solana/web3.js';
import {ATA_PROGRAM} from '../decode/decode';
import {MAX_OVERRIDES, decideRequestOf} from '../decide';
import {DAPP_SESSION_KEY, readDappSession, type Entry} from '../store';
import {SIM_REFRESH_MS, SIM_VALID_MS, dappAbout, dappDigest, txRefused} from '../signTx';
import {UNRESOLVED_LOOKUP_DETAIL} from '../simulate';
import {issueChallenge, satisfyChallenge} from '../../reauthChallenges';
import {REAUTH_KEY} from '../../session';
import {ACCOUNT, BLOCKHASH, RECIPIENT} from '../../__tests__/fixtures';
import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {dependsOnStep, pendingOf} from '../../../approve/client';
import {describeChallenge} from '../../../unlock/challenge';
import {ME, assign, ataCreate, tokenTransfer, transfer, txScene, v0} from './txHarness';

/**
 * B1c-3 (spec §3.3 rev 3.6, "The override rule"; B1 §3; O1, O2): dapp.decide's override gate against the real
 * background. A block is approvable only with its exact typed word for its own transaction AND a re-authentication
 * through #10 (the `override` reason); the background recomputes every word from the simulation it stored (C13).
 */
const DEST = new PublicKey(new Uint8Array(32).fill(74));
const OTHER = new PublicKey(new Uint8Array(32).fill(75));
const invalid = (i = 0) => ({InstructionError: [i, 'InvalidAccountData']});
/** The later step fails alone: its token transfer names DEST, which the step with the ATA create makes. */
const dependentStep =
  (i = 0) =>
  (keys: string[]) =>
    keys.includes(DEST.toBase58()) && !keys.includes(ATA_PROGRAM) ? invalid(i) : null;
const message = (b64: string) => VersionedTransaction.deserialize(base64.decode(b64)).message.serialize();
const signedBy = (b64: string, slot = 0) => {
  const tx = VersionedTransaction.deserialize(base64.decode(b64));
  return ed25519.verify(tx.signatures[slot] ?? new Uint8Array(64), tx.message.serialize(), ME.toBytes());
};
const REFUSED = (error: string) => ({ok: false, error});

/** A queued, simulated request (by default one System assign of the wallet account: F3, ASSIGN) and its approval. */
async function scene(o: {txs?: string[]; errFor?: (keys: string[]) => unknown; err?: unknown} = {}) {
  const c = await txScene({known: [RECIPIENT]});
  if (o.errFor !== undefined) c.chain.errFor = o.errFor;
  if (o.err !== undefined) c.chain.err = o.err;
  const wires = o.txs ?? [v0([assign()])];
  const requestId = String((await c.signTx('t', wires))?.requestId);
  const view = await c.simulated();
  const simulation = String(view.request?.tx?.simulation.id);
  const approve = (overrides?: unknown, sim = simulation) => c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, simulation: sim, ...(overrides === undefined ? {} : {overrides})});
  const challengeId = async (): Promise<string | null> => (await c.entry(requestId))?.challengeId ?? null;
  const signed = (): string[] => (c.page.answersFor(requestId)[0]?.result as {signed: string[]} | undefined)?.signed ?? [];
  /** The stored simulation rewritten in place (another id, unless `id` is given) — as a refresh would store it. */
  const restore = async (f: (sim: Extract<Entry['sim'], {status: 'ok'}>['sim']) => void, id = 'N'.repeat(22)): Promise<string> => {
    const s = await readDappSession(c.ext);
    const queue = structuredClone(s.queue);
    const e = queue.find(x => x.requestId === requestId);
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    f(e.sim.sim);
    e.sim.sim.id = id;
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue});
    return id;
  };
  return {...c, wires, requestId, view, simulation, approve, challengeId, signed, restore};
}
type Scene = Awaited<ReturnType<typeof scene>>;

/** The challenge proven for these words: the first approval issues it, #10's proof satisfies it. */
async function proveWith(c: Scene, words: {tx: number; word: string}[], simulation = c.simulation): Promise<string> {
  expect(await c.approve(words, simulation)).toEqual(REFUSED('reauth-required'));
  const id = String(await c.challengeId());
  expect(await c.reauthOk(id)).toEqual({ok: true});
  return id;
}

/** A chain-state F4 block (an own token account's owner reassigned by a CPI) — as redFlagsOf stores it. */
const authorityBlock = {
  kind: 'set-authority',
  severity: 'block',
  word: 'AUTHORITY',
  at: null,
  instructions: [],
  chain: [{account: OTHER.toBase58(), change: 'owner', from: ME.toBase58(), to: DEST.toBase58()}],
} as const;

describe('dapp.decide reads the overrides strictly (decideRequestOf)', () => {
  const base = {requestId: 'r', decision: 'approve', account: ACCOUNT.publicKey, simulation: 's'};
  it('absent → none; at most MAX_OVERRIDES of exactly {tx, word}, tx a whole number below the batch cap, a word of at most 32 characters; anything else is malformed', async () => {
    expect(decideRequestOf(base)?.overrides).toEqual([]);
    const ok = [
      {tx: 0, word: 'ASSIGN'},
      {tx: 4, word: 'U'.repeat(32)},
      {tx: 1, word: ''},
    ];
    expect(decideRequestOf({...base, overrides: ok})?.overrides).toEqual(ok);
    expect(MAX_OVERRIDES).toBe(20);
    expect(decideRequestOf({...base, overrides: Array.from({length: MAX_OVERRIDES}, (_, i) => ({tx: i % 5, word: 'X'}))})?.overrides).toHaveLength(MAX_OVERRIDES);
    const bad: unknown[] = [
      null,
      {},
      'ASSIGN',
      [null],
      new Array(1),
      [[0, 'ASSIGN']],
      [{tx: 0}],
      [{word: 'ASSIGN'}],
      [{tx: 0, word: 'ASSIGN', extra: 1}],
      [{tx: -1, word: 'ASSIGN'}],
      [{tx: 5, word: 'ASSIGN'}],
      [{tx: 0.5, word: 'ASSIGN'}],
      [{tx: '0', word: 'ASSIGN'}],
      [{tx: Number.NaN, word: 'ASSIGN'}],
      [{tx: 0, word: 1}],
      [{tx: 0, word: null}],
      [{tx: 0, word: 'U'.repeat(33)}],
      Array.from({length: MAX_OVERRIDES + 1}, () => ({tx: 0, word: 'X'})),
    ];
    for (const overrides of bad) expect([overrides, decideRequestOf({...base, overrides})]).toEqual([overrides, null]);
    // End to end: the message is refused before any check runs.
    const c = await scene();
    expect(await c.approve([{tx: '0', word: 'ASSIGN'}])).toEqual(REFUSED('malformed'));
    expect(c.page.answersFor(c.requestId)).toEqual([]);
  });
});

describe('dapp.decide for a request with a block (B1 §3’s override rule)', () => {
  it('no word → override-missing; a wrong, cased, padded, extra, repeated or another step’s word → override-mismatch; the right word without the proof → reauth-required; with it → signed, exactly the stored bytes', async () => {
    const c = await scene();
    expect(c.view.request?.tx?.reauth).toEqual({reasons: ['override'], state: 'needed'});
    expect(await c.approve()).toEqual(REFUSED('override-missing'));
    expect(await c.approve([])).toEqual(REFUSED('override-missing'));
    const wrong = [
      [{tx: 0, word: 'assign'}],
      [{tx: 0, word: 'ASSIGN '}],
      [{tx: 0, word: ' ASSIGN'}],
      [{tx: 1, word: 'ASSIGN'}],
      [{tx: 0, word: 'UNCHECKED'}],
      [
        {tx: 0, word: 'ASSIGN'},
        {tx: 0, word: 'ASSIGN'},
      ],
      [
        {tx: 0, word: 'ASSIGN'},
        {tx: 0, word: 'AUTHORITY'},
      ],
    ];
    for (const overrides of wrong) expect([overrides, await c.approve(overrides)]).toEqual([overrides, REFUSED('override-mismatch')]);
    // None of these reached the re-authentication gate: no challenge was issued.
    expect(await c.challengeId()).toBeNull();
    const words = [{tx: 0, word: 'ASSIGN'}];
    const challengeId = await proveWith(c, words);
    // The proof never stands in for the word, nor a wrong one for it.
    expect(await c.approve()).toEqual(REFUSED('override-missing'));
    expect(await c.approve([{tx: 0, word: 'Assign'}])).toEqual(REFUSED('override-mismatch'));
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect(await c.approve(words)).toEqual({ok: true});
    expect(c.page.answersFor(c.requestId)).toHaveLength(1);
    const [signed] = c.signed();
    expect(message(signed ?? '')).toEqual(message(c.wires[0] ?? ''));
    expect(signedBy(signed ?? '')).toBe(true);
    // Single use, as every proof.
    expect(await c.challengeInfo(challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('a request with no block: no words → signed; any word → override-mismatch (negative control)', async () => {
    const c = await scene({txs: [v0([transfer(1)])]});
    expect(c.view.request?.tx?.reauth).toBeNull();
    expect(await c.approve([{tx: 0, word: 'ASSIGN'}])).toEqual(REFUSED('override-mismatch'));
    expect(await c.approve([])).toEqual({ok: true});
  });

  it('every earlier refusal keeps its place: not-simulated, stale, out-of-date, an expired blockhash and a failed simulation come before the words', async () => {
    const early = await txScene({known: [RECIPIENT]});
    const r = await early.signTx('t', [v0([assign()])]);
    expect(await early.decide({requestId: r?.requestId, decision: 'approve', account: ACCOUNT.publicKey, overrides: [{tx: 0, word: 'nope'}]})).toEqual(REFUSED('not-simulated'));
    const c = await scene();
    expect(await c.approve([{tx: 0, word: 'nope'}], 'A'.repeat(22))).toEqual(REFUSED('stale'));
    c.deps.clock.t += SIM_VALID_MS;
    expect(await c.approve([{tx: 0, word: 'nope'}])).toEqual(REFUSED('out-of-date'));
    const expired = await scene({err: 'BlockhashNotFound'});
    expect(expired.view.request?.tx?.reauth).toMatchObject({reasons: ['override']});
    for (const words of [undefined, [{tx: 0, word: 'ASSIGN'}], [{tx: 0, word: 'nope'}]]) expect(await expired.approve(words)).toEqual(REFUSED('blockhash-expired'));
    const failed = await scene({err: {InstructionError: [0, {Custom: 1}]}});
    for (const words of [undefined, [{tx: 0, word: 'ASSIGN'}], [{tx: 0, word: 'nope'}]]) expect(await failed.approve(words)).toEqual(REFUSED('simulation-failed'));
    // A wrong word beside a missing one is the mismatch (the precedence of overridesMatch).
    const two = await scene({txs: [v0([assign()]), v0([assign()])]});
    expect(await two.approve([{tx: 0, word: 'nope'}])).toEqual(REFUSED('override-mismatch'));
    expect(await two.approve([{tx: 0, word: 'ASSIGN'}])).toEqual(REFUSED('override-missing'));
    expect(await two.approve([{tx: 1, word: 'ASSIGN'}])).toEqual(REFUSED('override-missing'));
    expect(await two.approve([{tx: 0, word: 'ASSIGN'}, {tx: 1, word: 'ASSIGN'}])).toEqual(REFUSED('reauth-required'));
  });

  it('a dependent step (F10): no word → override-missing, never simulation-failed; UNCHECKED for that step and the proof → the batch signed as stored', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])], errFor: dependentStep()});
    const items = c.view.request?.tx?.transactions as {outcome: unknown}[];
    expect(items[1]?.outcome).toEqual({ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'});
    expect(c.view.request?.tx?.reauth).toMatchObject({reasons: ['first-send', 'override']});
    expect(await c.approve()).toEqual(REFUSED('override-missing'));
    expect(await c.approve([{tx: 0, word: 'UNCHECKED'}])).toEqual(REFUSED('override-mismatch'));
    expect(await c.approve([{tx: 1, word: 'unchecked'}])).toEqual(REFUSED('override-mismatch'));
    const words = [{tx: 1, word: 'UNCHECKED'}];
    await proveWith(c, words);
    expect(await c.approve(words)).toEqual({ok: true});
    const signed = c.signed();
    expect(signed.map(message)).toEqual(c.wires.map(message));
    expect(signed.map(s => signedBy(s))).toEqual([true, true]);
  });

  it('negative controls: a later failure no earlier step explains, or an expired step, stays Reject-only with or without words', async () => {
    const unrelated = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(OTHER)])], errFor: keys => (keys.includes(OTHER.toBase58()) ? invalid() : null)});
    expect((unrelated.view.request?.tx?.transactions as {outcome: unknown}[])[1]?.outcome).toMatchObject({ok: false, error: 'failed'});
    for (const words of [undefined, [{tx: 1, word: 'UNCHECKED'}]]) expect(await unrelated.approve(words)).toEqual(REFUSED('simulation-failed'));
    const expired = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])], errFor: keys => (keys.includes(DEST.toBase58()) && !keys.includes(ATA_PROGRAM) ? 'BlockhashNotFound' : null)});
    for (const words of [undefined, [{tx: 1, word: 'UNCHECKED'}]]) expect(await expired.approve(words)).toEqual(REFUSED('blockhash-expired'));
    expect(unrelated.page.answersFor(unrelated.requestId)).toEqual([]);
    expect(expired.page.answersFor(expired.requestId)).toEqual([]);
  });

  it('two kinds of block on one step need both words (one field per transaction and kind); #10 names each, on its transaction', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([assign(), tokenTransfer(DEST)])], errFor: dependentStep(1)});
    expect(await c.approve([{tx: 1, word: 'ASSIGN'}])).toEqual(REFUSED('override-missing'));
    expect(await c.approve([{tx: 1, word: 'UNCHECKED'}])).toEqual(REFUSED('override-missing'));
    const words = [
      {tx: 1, word: 'UNCHECKED'},
      {tx: 1, word: 'ASSIGN'},
    ];
    expect(await c.approve(words)).toEqual(REFUSED('reauth-required'));
    const info = (await c.challengeInfo(String(await c.challengeId()))) as {ok: true; data: {flags: unknown[]}};
    expect(info.data.flags).toEqual(
      expect.arrayContaining([
        {tx: 1, row: 'F3', word: 'ASSIGN', step: null},
        {tx: 1, row: 'F10', word: 'UNCHECKED', step: 1},
        {tx: 0, row: 'F2', word: null, step: null},
      ]),
    );
    expect(describeChallenge(info.data)).toMatchObject({
      kind: 'dapp',
      overrides: [
        {label: 'Assign / Allocate on your wallet account', transaction: 'Transaction 2 of 2'},
        {label: 'Depends on step 1 — not checked on its own', transaction: 'Transaction 2 of 2'},
      ],
    });
  });
});

describe('the override’s re-authentication follows the flags (reauthGate)', () => {
  const WORDS = [{tx: 0, word: 'ASSIGN'}];

  it('a refresh with the same flags keeps the proof: signed with it (positive control)', async () => {
    const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
    const first = await proveWith(c, WORDS);
    c.deps.clock.t += SIM_REFRESH_MS;
    const fresh = String((await c.simulated(c.simulation)).request?.tx?.simulation.id);
    expect(fresh).not.toBe(c.simulation);
    expect(await c.approve(WORDS, fresh)).toEqual({ok: true});
    expect(await c.challengeInfo(first)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('a refresh that adds a block (reasons and amounts unchanged) re-issues the challenge: the old proof is not satisfied, the old id is gone', async () => {
    const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
    const first = await proveWith(c, WORDS);
    const fresh = await c.restore(sim => (sim.flags[0] = [structuredClone(authorityBlock) as unknown as (typeof sim.flags)[0][0], ...(sim.flags[0] ?? [])]));
    const both = [...WORDS, {tx: 0, word: 'AUTHORITY'}];
    expect(await c.approve(WORDS, fresh)).toEqual(REFUSED('override-missing'));
    expect(await c.approve(both, fresh)).toEqual(REFUSED('reauth-required'));
    const second = String(await c.challengeId());
    expect(second).not.toBe(first);
    expect(await c.reauthOk(first)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(((await c.challengeInfo(second)) as {data: {flags: unknown[]; reasons: unknown}}).data).toMatchObject({reasons: ['override'], flags: expect.arrayContaining([{tx: 0, row: 'F4', word: 'AUTHORITY', step: null}])});
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect(await c.reauthOk(second)).toEqual({ok: true});
    expect(await c.approve(both, fresh)).toEqual({ok: true});
  });

  it('a refresh that adds a warning re-issues it too — #10 described every flag it was shown', async () => {
    const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
    const first = await proveWith(c, WORDS);
    const fresh = await c.restore(sim => sim.flags[0]?.push({kind: 'whole-balance', severity: 'warn', word: null, at: null}));
    expect(await c.approve(WORDS, fresh)).toEqual(REFUSED('reauth-required'));
    expect(await c.challengeId()).not.toBe(first);
  });

  it('a refresh that changes a block’s word (the wallet no longer names the token: USDC → UNLIMITED) re-issues it — the word is part of what #10 named', async () => {
    const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
    const approval = {at: null, source: OTHER.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DEST.toBase58(), amount: '18446744073709551615', balance: '0'};
    const unlimited = (symbol: string | null, decimals: number) => ({kind: 'unlimited-approve', severity: 'block', word: symbol ?? 'UNLIMITED', at: null, approvals: [{...approval, symbol, decimals}]}) as unknown as Extract<Entry['sim'], {status: 'ok'}>['sim']['flags'][0][0];
    const named = await c.restore(sim => (sim.flags[0] = [unlimited('USDC', 6), ...(sim.flags[0] ?? [])]), 'U'.repeat(22));
    const first = await proveWith(c, [...WORDS, {tx: 0, word: 'USDC'}], named);
    const unnamed = await c.restore(sim => (sim.flags[0] = [unlimited(null, 9), ...(sim.flags[0] ?? []).slice(1)]), 'V'.repeat(22));
    expect(await c.approve([...WORDS, {tx: 0, word: 'USDC'}], unnamed)).toEqual(REFUSED('override-mismatch'));
    expect(await c.approve([...WORDS, {tx: 0, word: 'UNLIMITED'}], unnamed)).toEqual(REFUSED('reauth-required'));
    expect(await c.challengeId()).not.toBe(first);
    expect(c.page.answersFor(c.requestId)).toEqual([]);
  });

  it('a refresh that turns a nearly-all approval unlimited (O9: the same word, another #10 row) re-issues it — #10 named the scope; the same scope keeps the proof (negative control)', async () => {
    const approval = {at: null, source: OTHER.toBase58(), mint: MAINNET_USDC_MINT, symbol: 'USDC', decimals: 6, delegate: DEST.toBase58(), amount: '990', balance: '1000'};
    const block = (amount: string) => ({kind: 'unlimited-approve', severity: 'block', word: 'USDC', at: null, approvals: [{...approval, amount}]}) as unknown as Extract<Entry['sim'], {status: 'ok'}>['sim']['flags'][0][0];
    const words = [...WORDS, {tx: 0, word: 'USDC'}];
    const proven = async () => {
      const c = await scene({txs: [v0([assign(), transfer(1_000_000)])]});
      const nearly = await c.restore(sim => (sim.flags[0] = [block('990'), ...(sim.flags[0] ?? [])]), 'U'.repeat(22));
      return {c, first: await proveWith(c, words, nearly)};
    };
    // Negative control: still nearly all (995 of 1 000) — the proof stands, signed.
    const kept = await proven();
    expect(((await kept.c.challengeInfo(kept.first)) as {data: {flags: unknown[]}}).data.flags).toContainEqual({tx: 0, row: 'F5', word: 'USDC', step: null, scope: 'nearly-all'});
    const same = await kept.c.restore(sim => (sim.flags[0] = [block('995'), ...(sim.flags[0] ?? []).slice(1)]), 'V'.repeat(22));
    expect(await kept.c.approve(words, same)).toEqual({ok: true});
    // u64::MAX: the word is the same, the row is not — a new challenge.
    const {c, first} = await proven();
    const max = await c.restore(sim => (sim.flags[0] = [block('18446744073709551615'), ...(sim.flags[0] ?? []).slice(1)]), 'W'.repeat(22));
    expect(await c.approve(words, max)).toEqual(REFUSED('reauth-required'));
    const second = String(await c.challengeId());
    expect(second).not.toBe(first);
    expect(((await c.challengeInfo(second)) as {data: {flags: unknown[]}}).data.flags).toContainEqual({tx: 0, row: 'F5', word: 'USDC', step: null, scope: 'unlimited'});
    expect(c.page.answersFor(c.requestId)).toEqual([]);
  });

  it('the deciding section checks the words itself: a block stored between the gate and that section (the same simulation) is refused override-missing — nothing signed', async () => {
    const c = await scene();
    await proveWith(c, WORDS);
    const get = c.ext.session.get;
    let reads = 0;
    c.ext.session.get = async k => {
      // The gate's first read of the challenge store: the entry's stored simulation gains a block, keeping its id.
      if (k === REAUTH_KEY && ++reads === 1) await c.restore(sim => (sim.flags[0] = [structuredClone(authorityBlock) as unknown as (typeof sim.flags)[0][0], ...(sim.flags[0] ?? [])]), c.simulation);
      return get(k);
    };
    expect(await c.approve(WORDS)).toEqual(REFUSED('override-missing'));
    expect(reads).toBeGreaterThan(0);
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await c.entry(c.requestId))?.state).toBe('queued');
  });
});

describe('txRefused: a dependent step is open only beside its own F10 flag', () => {
  it('without the flag, or with one naming another step, the dependent outcome is a failure (simulation-failed)', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])], errFor: dependentStep()});
    const e = structuredClone(await c.entry(c.requestId));
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    const words = [{tx: 1, word: 'UNCHECKED'}];
    const now = c.deps.now();
    expect(txRefused(e, c.simulation, words, now)).toBeNull();
    const flags = e.sim.sim.flags;
    const dependent = flags[1]?.find(f => f.kind === 'dependent');
    if (dependent === undefined || dependent.kind !== 'dependent') throw new Error('no dependent flag');
    dependent.on = 1;
    expect(txRefused(e, c.simulation, words, now)).toBe('simulation-failed');
    flags[1] = (flags[1] ?? []).filter(f => f.kind !== 'dependent');
    expect(txRefused(e, c.simulation, [], now)).toBe('simulation-failed');
  });
});

// Controller ruling, Task 4 (ledger a): the dependent exemption opens only a dependent outcome — every plain `failed`,
// the unresolved-lookup one above all, stays Reject-only even with every word right and a proof in hand.
describe('the dependent exemption never lets a plain failure through (the unresolved-lookup rule)', () => {
  const TABLE = new PublicKey(new Uint8Array(32).fill(76));
  /** A v0 transaction compiled against a table holding `address` — a table the harness's chain does not hold (unresolved). */
  const viaTable = (instructions: TransactionInstruction[], address: PublicKey): string => {
    const alt = {key: TABLE, state: {deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: [address]}, isActive: () => true} as unknown as AddressLookupTableAccount;
    return base64.encode(new VersionedTransaction(new TransactionMessage({payerKey: ME, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message([alt])).serialize());
  };
  /** A satisfied challenge for exactly this entry, as #10 would leave it — the proof the request would need. */
  async function withProof(c: Scene): Promise<string> {
    const e = await c.entry(c.requestId);
    const about = e === undefined ? null : dappAbout(e, 'dapp.test', 10_000);
    if (e === undefined || about === null) throw new Error('no about');
    const id = await issueChallenge(c.ext, c.deps, dappDigest(e), about);
    expect(await satisfyChallenge(c.ext, c.deps.now(), id)).toBe(true);
    const s = await readDappSession(c.ext);
    const queue = structuredClone(s.queue);
    const x = queue.find(q => q.requestId === c.requestId);
    if (x === undefined) throw new Error('not queued');
    x.challengeId = id;
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue});
    return id;
  }
  const WORDS = [{tx: 1, word: 'UNCHECKED'}];

  it('positive control: the injected proof is a working proof — a dependent batch with its word signs on it', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])], errFor: dependentStep()});
    await withProof(c);
    expect(await c.approve(WORDS)).toEqual({ok: true});
    expect(c.signed()).toHaveLength(2);
  });

  it('step 2 dependent (F10, its word right, proven), step 3 an unresolved lookup: refused `simulation-failed`, nothing signed', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)]), viaTable([transfer(1, ME, OTHER)], OTHER)], errFor: dependentStep()});
    const outcomes = (c.view.request?.tx?.transactions as {outcome: unknown}[]).map(t => t.outcome);
    expect(outcomes[1]).toMatchObject({ok: false, error: 'dependent', on: 1});
    expect(outcomes[2]).toEqual({ok: false, error: 'failed', detail: UNRESOLVED_LOOKUP_DETAIL});
    await withProof(c);
    for (const words of [WORDS, undefined]) expect(await c.approve(words)).toEqual(REFUSED('simulation-failed'));
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await c.entry(c.requestId))?.state).toBe('queued');
  });

  it('a dependent step whose own key is unresolved: its outcome is the unresolved-lookup failure (the node’s error notwithstanding), no F10, no reason — refused `simulation-failed` with no word (all that is expected) and with UNCHECKED', async () => {
    const SOURCE = new PublicKey(new Uint8Array(32).fill(77));
    const c = await scene({txs: [v0([ataCreate(DEST)]), viaTable([tokenTransfer(DEST, SOURCE)], SOURCE)], errFor: dependentStep()});
    const items = c.view.request?.tx?.transactions as {outcome: unknown; flags: {kind: string}[]}[];
    expect(items[1]?.outcome).toEqual({ok: false, error: 'failed', detail: UNRESOLVED_LOOKUP_DETAIL});
    expect(items[1]?.flags.map(f => f.kind)).not.toContain('dependent');
    // No block, so no reason: nothing to re-authenticate — the words (none) match, and the failure alone refuses it.
    expect(c.view.request?.tx?.reauth).toBeNull();
    for (const words of [undefined, [], WORDS]) expect(await c.approve(words)).toEqual(REFUSED('simulation-failed'));
    expect(c.page.answersFor(c.requestId)).toEqual([]);
  });

  it('txRefused: a dependent step’s outcome replaced by the unresolved-lookup failure, its F10 flag and the word left in place — `simulation-failed`', async () => {
    const c = await scene({txs: [v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])], errFor: dependentStep()});
    const e = structuredClone(await c.entry(c.requestId));
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    const now = c.deps.now();
    expect(txRefused(e, c.simulation, WORDS, now)).toBeNull();
    e.sim.sim.outcomes[1] = {ok: false, error: 'failed', detail: UNRESOLVED_LOOKUP_DETAIL};
    expect(txRefused(e, c.simulation, WORDS, now)).toBe('simulation-failed');
  });
});

describe('#48’s view of the flags (TxDetail)', () => {
  it('each transaction’s flags in the order stored, null while simulating; a dependent step names the step it depends on 1-based (dependsOnStep) — never the background’s 0-based index', async () => {
    const c = await txScene({known: [RECIPIENT]});
    c.chain.errFor = dependentStep();
    const requestId = String((await c.signTx('t', [v0([transfer(1)]), v0([ataCreate(DEST)]), v0([tokenTransfer(DEST)])]))?.requestId);
    const first = (await c.pend()) as unknown as {request: {tx: {transactions: {flags: unknown}[]}}};
    expect(first.request.tx.transactions.map(t => t.flags)).toEqual([null, null, null]);
    const view = await c.simulated();
    const raw = (view.request?.tx?.transactions as {flags: Record<string, unknown>[]}[])[2]?.flags ?? [];
    expect(raw.find(f => f.kind === 'dependent')).toEqual({kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, step: 2});
    const stored = await c.entry(requestId);
    expect(stored === undefined || stored.sim?.status !== 'ok' ? null : stored.sim.sim.flags.map(list => list.map(f => f.kind))).toEqual(
      (view.request?.tx?.transactions as {flags: {kind: string}[]}[]).map(t => t.flags.map(f => f.kind)),
    );
    const read = pendingOf(view);
    const items = read?.state === 'request' ? (read.request.tx?.transactions ?? []) : [];
    expect(items.map(dependsOnStep)).toEqual([null, null, 2]);
    expect(items[2]?.outcome).toMatchObject({error: 'dependent', on: 2});
  });
});
