import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {PublicKey, SystemProgram, VersionedTransaction} from '@solana/web3.js';
import {AUTOLOCK_ALARM, lock} from '../../autolock';
import {GRANTS_KEY, type Grant} from '../grants';
import {runtimeFor} from '../ports';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {SIM_REFRESH_MS, SIM_RETRY_MS, SIM_VALID_MS, dappAbout, dappDigest, outgoingGrew, withSignature} from '../signTx';
import {MAX_DAPP_OUTGOING, issueChallenge} from '../../reauthChallenges';
import {REAUTH_KEY} from '../../session';
import {ACCOUNT, RECIPIENT} from '../../__tests__/fixtures';
import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {CO, ME, coSigned, transfer, txScene, until, v0} from './txHarness';
import {handleMessage} from '../../messages';
import {describeChallenge} from '../../../unlock/challenge';
import {createEngine} from '../../../app/engine';

const sigs = (b64: string) => VersionedTransaction.deserialize(base64.decode(b64)).signatures;
const verifies = (b64: string, slot: number, key: Uint8Array) => {
  const tx = VersionedTransaction.deserialize(base64.decode(b64));
  return ed25519.verify(tx.signatures[slot] ?? new Uint8Array(64), tx.message.serialize(), key);
};

// Spec B1c §3.3: #48's simulation — run when the window asks, refreshed after 30 s, held until it answers.
describe('a transaction request’s simulation (dapp.pending)', () => {
  it('the first read shows the decoded instructions while simulating; the next shows the balance changes, the fee — one simulation, however many reads', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const first = await c.pend();
    expect(first.state).toBe('request');
    expect(first.request?.tx?.simulation).toEqual({status: 'simulating'});
    expect((first.request?.tx?.transactions as {instructions: {name: string}[]}[])[0]?.instructions.map(i => i.name)).toEqual(['transfer']);
    await c.pend();
    await c.pend();
    const view = await c.simulated();
    expect(c.chain.calls.get('simulateTransaction')).toBe(1);
    expect(view.request?.tx).toMatchObject({
      account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
      kind: 'signTransaction',
      simulation: {status: 'ok', slot: 777},
      reauth: null,
      transactions: [{version: 0, feePayer: ACCOUNT.publicKey, outcome: {ok: true, changes: [{mint: null, amount: '-1005000', decimals: 9, usdMicros: '-150750'}], feeLamports: '5000'}}],
      labels: [{address: ACCOUNT.publicKey, kind: 'account', name: 'Main'}],
    });
    expect((await c.entry(String(r?.requestId)))?.sim).toMatchObject({status: 'ok'});
  });

  it('refreshed SIM_REFRESH_MS after the last one (a new id); an unreachable proxy is shown as such and tried again after SIM_RETRY_MS', async () => {
    const c = await txScene({known: [RECIPIENT]});
    await c.signTx('t', [v0()]);
    const one = (await c.simulated()).request?.tx?.simulation.id;
    c.deps.clock.t += SIM_REFRESH_MS - 1;
    await c.pend();
    await c.pend();
    expect(c.chain.calls.get('simulateTransaction')).toBe(1);
    c.deps.clock.t += 1;
    const two = (await c.simulated(one)).request?.tx?.simulation.id;
    expect(two).not.toBe(one);
    expect(c.chain.calls.get('simulateTransaction')).toBe(2);
    c.chain.down = true;
    c.deps.clock.t += SIM_REFRESH_MS;
    await c.pend();
    await until(async () => (await c.queue())[0]?.sim?.status === 'unreachable');
    expect((await c.pend()).request?.tx?.simulation).toEqual({status: 'unreachable'});
    c.chain.down = false;
    c.deps.clock.t += SIM_RETRY_MS;
    expect((await c.simulated()).request?.tx?.simulation).toMatchObject({status: 'ok'});
  });

  it('a simulation that answers after the request was decided is not stored (the decision wins)', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0()]);
    await c.pend();
    await c.decide({requestId: r?.requestId, decision: 'reject'});
    await until(async () => runtimeFor(c.ext).simulating.size === 0);
    expect((await c.entry(String(r?.requestId)))?.sim).toBeNull();
  });
});

// §2.3's table, extended by §3.3 (C13): the window names the simulation it showed.
describe('dapp.decide for a transaction request', () => {
  // Final review I3: `stale` only when the window named another simulation than the newest (the transaction's review
  // changed under it); the newest one merely SIM_VALID_MS old is `out-of-date` (nothing changed — a refresh is due).
  it('refused before a simulation answered, for another simulation than the newest (stale), for the newest one SIM_VALID_MS old (out-of-date); positive control: approved', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const requestId = String(r?.requestId);
    expect(await c.approve(requestId)).toEqual({ok: false, error: 'not-simulated'});
    const id = String((await c.simulated()).request?.tx?.simulation.id);
    expect(await c.approve(requestId)).toEqual({ok: false, error: 'stale'});
    expect(await c.approve(requestId, 'AAAAAAAAAAAAAAAAAAAAAA')).toEqual({ok: false, error: 'stale'});
    c.deps.clock.t += SIM_VALID_MS - 1;
    expect(await c.approve(requestId, 'AAAAAAAAAAAAAAAAAAAAAA')).toEqual({ok: false, error: 'stale'});
    c.deps.clock.t += 1;
    expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'out-of-date'});
    // Another id AND old: the id decides — the window showed something other than the newest simulation.
    expect(await c.approve(requestId, 'AAAAAAAAAAAAAAAAAAAAAA')).toEqual({ok: false, error: 'stale'});
    expect(c.page.answersFor(requestId)).toEqual([]);
    c.deps.clock.t -= SIM_VALID_MS;
    expect(await c.approve(requestId, id)).toEqual({ok: true});
    expect(c.page.answersFor(requestId)).toHaveLength(1);
  });

  it('a failed simulation has no approval; an expired blockhash (Q21) neither', async () => {
    const failed = await txScene({known: [RECIPIENT]});
    failed.chain.err = {InstructionError: [0, {Custom: 1}]};
    const r1 = await failed.signTx('t', [v0()]);
    const v1 = await failed.simulated();
    expect((v1.request?.tx?.transactions as {outcome: unknown}[])[0]?.outcome).toEqual({ok: false, error: 'failed', detail: '{"InstructionError":[0,{"Custom":1}]}'});
    expect(await failed.approve(String(r1?.requestId), v1.request?.tx?.simulation.id)).toEqual({ok: false, error: 'simulation-failed'});
    const expired = await txScene({known: [RECIPIENT]});
    expired.chain.err = 'BlockhashNotFound';
    const r2 = await expired.signTx('t', [v0()]);
    const v2 = await expired.simulated();
    expect(await expired.approve(String(r2?.requestId), v2.request?.tx?.simulation.id)).toEqual({ok: false, error: 'blockhash-expired'});
    // Reject is always open.
    expect(await expired.decide({requestId: r2?.requestId, decision: 'reject'})).toEqual({ok: true});
  });

  it('approve: every transaction of a batch signed at the account’s slot, the co-signer’s signature kept, exactly one answer; recorded on the grant', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const wires = [v0([transfer(1)]), coSigned(), v0([transfer(3)])];
    const r = await c.signTx('t', wires);
    const requestId = String(r?.requestId);
    const view = await c.simulated();
    expect(await c.approve(requestId, view.request?.tx?.simulation.id)).toEqual({ok: true});
    const answers = c.page.answersFor(requestId);
    expect(answers).toHaveLength(1);
    const signed = (answers[0]?.result as {signed: string[]}).signed;
    expect(signed).toHaveLength(3);
    expect(verifies(signed[0] ?? '', 0, ME.toBytes())).toBe(true);
    // The co-signed one: the account is signer 1; the dApp's signature at 0 is exactly as sent.
    expect(verifies(signed[1] ?? '', 1, ME.toBytes())).toBe(true);
    expect(sigs(signed[1] ?? '')[0]).toEqual(sigs(wires[1] ?? '')[0]);
    expect(verifies(signed[1] ?? '', 0, CO.toBytes())).toBe(true);
    // Nothing but the signature changed: the message bytes are the dApp's.
    expect(VersionedTransaction.deserialize(base64.decode(signed[2] ?? '')).message.serialize()).toEqual(VersionedTransaction.deserialize(base64.decode(wires[2] ?? '')).message.serialize());
    expect(((await c.ext.local.get(GRANTS_KEY)) as Grant[])[0]?.recent[0]).toEqual({type: 'signTransaction', at: c.deps.clock.t, outcome: 'approved'});
  });

  // Review Focus 5: a legacy (not v0) transaction — the format half of all dApps still send.
  it('a legacy transaction: decoded, simulated, signed at its slot, the bytes otherwise the dApp’s', async () => {
    const {Transaction} = await import('@solana/web3.js');
    const c = await txScene({known: [RECIPIENT]});
    const legacy = base64.encode(new Transaction({feePayer: ME, recentBlockhash: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}).add(transfer(1)).serialize({requireAllSignatures: false, verifySignatures: false}));
    const r = await c.signTx('l', [legacy]);
    const view = await c.simulated();
    expect((view.request?.tx?.transactions as {version: unknown; outcome: {ok: boolean}}[])[0]).toMatchObject({version: 'legacy', outcome: {ok: true}});
    expect(await c.approve(String(r?.requestId), view.request?.tx?.simulation.id)).toEqual({ok: true});
    const [signed] = (c.page.answersFor(String(r?.requestId))[0]?.result as {signed: string[]}).signed;
    expect(verifies(signed ?? '', 0, ME.toBytes())).toBe(true);
    expect(base64.decode(signed ?? '').slice(65)).toEqual(base64.decode(legacy).slice(65));
  });

  it('withSignature writes only the slot it is given', () => {
    const wire = base64.decode(coSigned());
    const out = withSignature(wire, 1, new Uint8Array(64).fill(9));
    expect(out.slice(1 + 64, 1 + 128)).toEqual(new Uint8Array(64).fill(9));
    expect(out.slice(0, 1 + 64)).toEqual(wire.slice(0, 1 + 64));
    expect(out.slice(1 + 128)).toEqual(wire.slice(1 + 128));
  });

  it('a refresh that lands between the window’s read and its click: refused stale; the window re-reads, and the new one is approvable', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const requestId = String(r?.requestId);
    const shown = String((await c.simulated()).request?.tx?.simulation.id);
    c.deps.clock.t += SIM_REFRESH_MS;
    const fresh = String((await c.simulated(shown)).request?.tx?.simulation.id);
    expect(await c.approve(requestId, shown)).toEqual({ok: false, error: 'stale'});
    expect(await c.approve(requestId, fresh)).toEqual({ok: true});
  });

  it('the grant moved to another account, or revoked, while queued: no-grant both times — never a signature', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    await c.ext.local.set(GRANTS_KEY, [{origin: 'https://dapp.test', account: RECIPIENT, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    expect(await c.approve(String(r?.requestId), id)).toEqual({ok: false, error: 'no-grant'});
    await c.ext.local.set(GRANTS_KEY, []);
    expect(await c.approve(String(r?.requestId), id)).toEqual({ok: false, error: 'no-grant'});
    expect(c.page.answersFor(String(r?.requestId))).toEqual([]);
  });

  it('a lock between deciding and the signature answers rejected; a restart with a deciding entry answers rejected — never re-signed (C17)', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    // The decision arms the auto-lock between the deciding section and the signing: a lock lands right there (the
    // queue's own expiry alarm, armed by every queue access, is left alone).
    const create = c.ext.alarms.create;
    c.ext.alarms.create = (name, o) => (name === AUTOLOCK_ALARM ? lock(c.ext) : create(name, o));
    expect(await c.approve(requestId, id)).toEqual({ok: true});
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);

    const d = await txScene({known: [RECIPIENT]});
    const r2 = await d.signTx('t', [v0()]);
    const rid = String(r2?.requestId);
    await d.simulated();
    const s = await readDappSession(d.ext);
    await d.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: d.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}}))});
    expect(await d.page.ask({type: 'page.resume', requestIds: [rid]})).toEqual({resume: [{requestId: rid, error: 'rejected'}]});
  });

  it('the account removed from the session while its key is read: rejected, the signatures dropped', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    const other = {index: 1, publicKey: base58.encode(ed25519.getPublicKey(new Uint8Array(32).fill(2))), secretKey: base64.encode(new Uint8Array([...new Uint8Array(32).fill(2), ...ed25519.getPublicKey(new Uint8Array(32).fill(2))]))};
    const get = c.ext.session.get;
    let deciding = 0;
    let swapped = false;
    c.ext.session.get = async k => {
      const v = await get(k);
      // While deciding, the session is read three times before the answering section: by the decision's idle-timer
      // check, by the effect's first section, then for the key (outside any section). The key read gets the account —
      // the signatures ARE made — and the session loses it right after, so only the answering section's own re-check
      // can drop them (mutation M4h turns this red; an earlier swap would drop them for another reason).
      if (k === 'v1_session' && (await readDappSession(c.ext)).queue[0]?.state === 'deciding' && ++deciding === 3) {
        swapped = true;
        // Written directly (setSession takes sessionMutex, which a section may be holding while it reads).
        await c.ext.session.set('v1_session', {accounts: [other]});
      }
      return v;
    };
    expect(await c.approve(requestId, id)).toEqual({ok: true});
    expect(swapped).toBe(true);
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });
});

// B1b's re-authentication (spec §3.3, B1 §3) through #10 — reached from the toolbar icon (D11), never from the window.
describe('re-authentication for a transaction request', () => {
  // Final review I2: a host URL-legal to the browser (an underscore — pageOrigin accepts any `https:` origin `new URL`
  // parses) used to fail the SITE shape on issue: issueChallenge threw, `dapp.decide` answered `internal`. End to end
  // over the three sides' one shape (shared/site.ts): the challenge is issued, #10's describeChallenge describes it, and
  // the popup's strip (engine.dappReauth) reads it — each with the site exactly as `new URL(origin).host` gives it.
  it('a site whose host has an underscore (my_site.example.com): the challenge is issued, #10 describes the site, the popup’s strip reads it', async () => {
    const c = await txScene({origin: 'https://my_site.example.com'});
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'reauth-required'});
    const challengeId = String((await c.entry(requestId))?.challengeId);
    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
    const info = (await c.challengeInfo(challengeId)) as {ok: true; data: unknown};
    expect(info).toMatchObject({ok: true, data: {kind: 'dapp', site: 'my_site.example.com'}});
    expect(describeChallenge(info.data)).toMatchObject({kind: 'dapp', site: 'my_site.example.com'});
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    const engine = createEngine(m => handleMessage(c.ext, m, popup, c.deps), async () => undefined);
    expect(await engine.dappReauth()).toEqual({ok: true, data: {challengeId, site: 'my_site.example.com'}});
    // Positive control: proven, the same request signs.
    expect(await c.reauthOk(challengeId)).toEqual({ok: true});
    expect(await c.approve(requestId, id)).toEqual({ok: true});
  });

  it('a first send: Approve asks for a challenge (reauth-required), #10 describes it, the proof makes it proven, Approve then signs — once', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const view = await c.simulated();
    const id = view.request?.tx?.simulation.id;
    expect(view.request?.tx?.reauth).toEqual({reasons: ['first-send'], state: 'needed'});
    expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'reauth-required'});
    const challengeId = String((await c.entry(requestId))?.challengeId);
    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
    expect((await c.pend()).request?.tx?.reauth).toEqual({reasons: ['first-send'], state: 'waiting'});
    expect(await c.challengeInfo(challengeId)).toEqual({
      ok: true,
      data: {kind: 'dapp', account: ACCOUNT.publicKey, site: 'dapp.test', transactions: 1, outgoing: [{mint: null, symbol: 'SOL', amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000},
    });
    // Still refused while unproven; the challenge is not reissued.
    expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'reauth-required'});
    expect((await c.entry(requestId))?.challengeId).toBe(challengeId);
    expect(await c.reauthOk(challengeId)).toEqual({ok: true});
    expect((await c.pend()).request?.tx?.reauth).toEqual({reasons: ['first-send'], state: 'proven'});
    expect(await c.approve(requestId, id)).toEqual({ok: true});
    expect(c.page.answersFor(requestId)).toHaveLength(1);
    // Single use: the challenge is gone.
    expect(await c.challengeInfo(challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('an expired challenge is replaced by a new one at the next Approve (never revived)', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    await c.approve(requestId, id);
    const first = String((await c.entry(requestId))?.challengeId);
    c.deps.clock.t += 120_000;
    const id2 = (await c.simulated(id)).request?.tx?.simulation.id;
    expect(await c.approve(requestId, id2)).toEqual({ok: false, error: 'reauth-required'});
    expect((await c.entry(requestId))?.challengeId).not.toBe(first);
  });

  /** A proven request, and a hook on the challenge store's reads during the next Approve (the gate reads it twice, the consume once more). */
  async function proven() {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = String((await c.simulated()).request?.tx?.simulation.id);
    await c.approve(requestId, id);
    const challengeId = String((await c.entry(requestId))?.challengeId);
    await c.reauthOk(challengeId);
    const get = c.ext.session.get;
    const hook: {onRead: ((n: number) => Promise<unknown | undefined>) | null; reads: number} = {onRead: null, reads: 0};
    c.ext.session.get = async k => {
      if (k !== REAUTH_KEY || hook.onRead === null) return get(k);
      hook.reads++;
      const replaced = await hook.onRead(hook.reads);
      return replaced === undefined ? get(k) : replaced;
    };
    return {...c, requestId, id, challengeId, hook};
  }

  // Review 1 L1: the proof is consumed after `deciding` is written, so a refusal there does not spend it.
  it('a refresh that lands while the gate reads the proof: stale — the proof is not spent; the new simulation’s approval signs with it, once', async () => {
    const c = await proven();
    const fresh = 'R'.repeat(22);
    c.hook.onRead = async n => {
      // The gate's first read: a refresh lands now (a new simulation id on the entry), before the deciding section.
      if (n === 1) {
        const s = await readDappSession(c.ext);
        await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.sim?.status === 'ok' ? {...e, sim: {status: 'ok', sim: {...e.sim.sim, id: fresh}}} : e))});
      }
      return undefined;
    };
    expect(await c.approve(c.requestId, c.id)).toEqual({ok: false, error: 'stale'});
    c.hook.onRead = null;
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await c.pend()).request?.tx?.reauth?.state).toBe('proven');
    expect(await c.approve(c.requestId, fresh)).toEqual({ok: true});
    expect(c.page.answersFor(c.requestId)).toHaveLength(1);
    expect(c.page.answersFor(c.requestId)[0]?.result).toBeDefined();
    expect(await c.challengeInfo(c.challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('the proof gone between the gate and the consume (spent elsewhere): rejected, nothing signed — never signed on a proof not consumed', async () => {
    const c = await proven();
    // Reads 1–2 are the gate's (live, satisfied); read 3 is the consume's: the challenge is no longer in the store.
    c.hook.onRead = async n => (n === 3 ? {} : undefined);
    // The window is told the request is gone (no longer the head — review 2 L4), never asked to re-authenticate it.
    expect(await c.approve(c.requestId, c.id)).toEqual({ok: false, error: 'not-head'});
    expect(c.hook.reads).toBe(3);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
  });

  // Review 1 L9: a batch that loses more mints than #10 lists is cut and counted, never refused.
  it('dappAbout: at most MAX_DAPP_OUTGOING mints — SOL first, then the largest in USD, then the unpriced in order — and the rest counted', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    await c.simulated();
    const e = structuredClone(await c.entry(String(r?.requestId)));
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    const mint = (i: number) => base58.encode(new Uint8Array(32).fill(i + 1));
    const changes = [
      ...Array.from({length: 10}, (_, i) => ({mint: mint(i), amount: '-5', decimals: 0, usdMicros: null})),
      ...Array.from({length: 8}, (_, i) => ({mint: mint(20 + i), amount: '-5', decimals: 0, usdMicros: String(-(i + 1) * 1_000_000)})),
      {mint: null, amount: '-7', decimals: 9, usdMicros: null},
      {mint: mint(40), amount: '3', decimals: 0, usdMicros: '9000000000'},
    ];
    const [first] = e.sim.sim.outcomes;
    if (first === undefined || !first.ok) throw new Error('no outcome');
    e.sim = {status: 'ok', sim: {...e.sim.sim, outcomes: [{...first, changes}]}};
    const about = dappAbout(e, 'dapp.test', 10_000);
    expect(MAX_DAPP_OUTGOING).toBe(16);
    expect(about?.outgoing.map(o => o.mint)).toEqual([null, ...[7, 6, 5, 4, 3, 2, 1, 0].map(i => mint(20 + i)), ...[0, 1, 2, 3, 4, 5, 6].map(mint)]);
    expect(about?.omitted).toBe(3);
    // Positive control: a short list is whole, nothing omitted.
    e.sim = {status: 'ok', sim: {...e.sim.sim, outcomes: [{...first, changes: changes.slice(17)}]}};
    expect(dappAbout(e, 'dapp.test', 10_000)).toMatchObject({outgoing: [{mint: null}, {mint: mint(27)}], omitted: 0});
  });

  // Fix round 1 item 2: simulate.ts's decimals field is untrusted mint data (a hostile or merely unusual token can
  // report any u8 value); reauthChallenges.ts's isOutgoing only ever accepts 0–18. Out of range must show as base
  // units (decimals: null), never reach issueChallenge raw and make it throw an uncaught TypeError — a dApp-triggerable
  // unexpected error in the window.
  it('dappAbout clamps an out-of-range decimals (untrusted mint data) to null — issueChallenge never throws on it', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    await c.simulated();
    const e = structuredClone(await c.entry(String(r?.requestId)));
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    const [first] = e.sim.sim.outcomes;
    if (first === undefined || !first.ok) throw new Error('no outcome');
    const weird = base58.encode(new Uint8Array(32).fill(9));
    e.sim = {status: 'ok', sim: {...e.sim.sim, outcomes: [{...first, changes: [...first.changes, {mint: weird, amount: '-5', decimals: 19, usdMicros: null}]}]}};
    const about = dappAbout(e, 'dapp.test', 10_000);
    expect(about?.outgoing.find(o => o.mint === weird)?.decimals).toBeNull();
    if (about === null) throw new Error('no about');
    await expect(issueChallenge(c.ext, c.deps, dappDigest(e), about)).resolves.toMatch(/^[0-9a-f]{32}$/);
  });

  // Fix round 1 item 4 (promoted): the real USDC mint, but the simulation's own decimals for it (untrusted mint data —
  // an RPC can lie even about a legitimate mint's account) do not match this wallet's table (6) — named no more:
  // dappAbout names it `symbol: null`, shown unnamed in base units, never refused as undescribable for it; and
  // issueChallenge/isOutgoing refuses a mismatched symbol/decimals pair raw, so one can never reach the store even if
  // some other caller tried to build it directly (defense in depth, not only dappAbout's).
  it('dappAbout: a named token whose decimals do not match this wallet’s table is shown unnamed, never refused', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    await c.simulated();
    const e = structuredClone(await c.entry(String(r?.requestId)));
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    const [first] = e.sim.sim.outcomes;
    if (first === undefined || !first.ok) throw new Error('no outcome');
    e.sim = {status: 'ok', sim: {...e.sim.sim, outcomes: [{...first, changes: [...first.changes, {mint: MAINNET_USDC_MINT, amount: '-5', decimals: 9, usdMicros: null}]}]}};
    const about = dappAbout(e, 'dapp.test', 10_000);
    const row = about?.outgoing.find(o => o.mint === MAINNET_USDC_MINT);
    expect(row).toMatchObject({symbol: null, decimals: 9});
    if (about === null) throw new Error('no about');
    await expect(issueChallenge(c.ext, c.deps, dappDigest(e), about)).resolves.toMatch(/^[0-9a-f]{32}$/);
    // Defense in depth: issueChallenge itself refuses a mismatched symbol/decimals pair raw, whoever builds it.
    const mismatched = {...about, outgoing: [{mint: MAINNET_USDC_MINT, symbol: 'USDC' as const, amount: '5', decimals: 9}]};
    await expect(issueChallenge(c.ext, c.deps, 'd-mismatched', mismatched)).rejects.toThrow();
  });

  // Fix round 1 item 3: a live (even proven) challenge is frozen from the simulation that issued it — #10 described
  // that one. A refresh that grows an outgoing amount makes that description stale even when the reasons it named
  // are unchanged; the old proof must not stand for a bigger send than it ever described.
  it('a refresh that grows an outgoing amount (reasons unchanged) re-issues the challenge — the old proof no longer applies', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = String((await c.simulated()).request?.tx?.simulation.id);
    await c.approve(requestId, id);
    const first = String((await c.entry(requestId))?.challengeId);
    await c.reauthOk(first);
    expect(await c.challengeInfo(first)).toMatchObject({ok: true, data: {reasons: ['first-send']}});
    // A refresh lands with a far larger outflow (still well under the USD threshold, so still only 'first-send') —
    // written directly onto the stored simulation, as other tests in this file do.
    const s = await readDappSession(c.ext);
    const e = s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    const [outcome] = e.sim.sim.outcomes;
    if (outcome === undefined || !outcome.ok) throw new Error('no outcome');
    const grown = {...outcome, changes: outcome.changes.map(ch => (ch.mint === null ? {...ch, amount: (BigInt(ch.amount) * 100n).toString()} : ch))};
    const freshId = 'G'.repeat(22);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(x => (x.requestId === requestId && x.sim?.status === 'ok' ? {...x, sim: {status: 'ok', sim: {...x.sim.sim, id: freshId, outcomes: [grown]}}} : x))});
    expect(await c.approve(requestId, freshId)).toEqual({ok: false, error: 'reauth-required'});
    const second = String((await c.entry(requestId))?.challengeId);
    expect(second).not.toBe(first);
    expect(await c.challengeInfo(second)).toMatchObject({ok: true, data: {reasons: ['first-send']}});
    // Fix round 1 item 1: the superseded id is gone — a #10 tab left open on it reads back unknown-challenge
    // (dappExpired, never dappConfirmed, since reauthFlow.ts maps that error to 'expired'); the new id still proves
    // normally (positive control).
    expect(await c.reauthOk(first)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await c.reauthOk(second)).toEqual({ok: true});
  });

  // The other half of item 3: amounts unchanged, but the refresh names a reason the issued challenge never did
  // (chain state can surface 'approval' only once a simulation actually sees the delegation/authority change).
  it('a refresh that adds a reason (amounts unchanged) re-issues the challenge', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = String((await c.simulated()).request?.tx?.simulation.id);
    await c.approve(requestId, id);
    const first = String((await c.entry(requestId))?.challengeId);
    await c.reauthOk(first);
    const s = await readDappSession(c.ext);
    const freshId = 'H'.repeat(22);
    await c.ext.session.set(DAPP_SESSION_KEY, {
      ...s,
      queue: s.queue.map(x => (x.requestId === requestId && x.sim?.status === 'ok' ? {...x, sim: {status: 'ok', sim: {...x.sim.sim, id: freshId, reasons: [...x.sim.sim.reasons, 'approval']}}} : x)),
    });
    expect(await c.approve(requestId, freshId)).toEqual({ok: false, error: 'reauth-required'});
    const second = String((await c.entry(requestId))?.challengeId);
    expect(second).not.toBe(first);
    expect(await c.challengeInfo(second)).toMatchObject({ok: true, data: {reasons: ['first-send', 'approval']}});
    // Fix round 1 item 1: the old id is gone too (unknown-challenge), the new one still proves (positive control).
    expect(await c.reauthOk(first)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await c.reauthOk(second)).toEqual({ok: true});
  });

  // Fix round 1 item 4 (promoted), negative control: dappDigest binds the challenge to THIS request, not just to the
  // account and the bytes — two distinct requests can carry byte-identical transactions (a dApp resending the same
  // batch under a new id), and the earlier one's proof must never satisfy the later one.
  it('negative control: request A’s proven challenge cannot approve request B, even with byte-identical transactions', async () => {
    const c = await txScene();
    const rA = await c.signTx('a', [v0([transfer(1_000_000)])]);
    const requestIdA = String(rA?.requestId);
    const idA = (await c.simulated()).request?.tx?.simulation.id;
    await c.approve(requestIdA, idA);
    const challengeIdA = String((await c.entry(requestIdA))?.challengeId);
    await c.reauthOk(challengeIdA);
    expect(await c.challengeInfo(challengeIdA)).toMatchObject({ok: true});
    // A rejects: the dApp challenge store is untouched by a reject — only its own clock retires it.
    expect(await c.decide({requestId: requestIdA, decision: 'reject'})).toEqual({ok: true});
    expect(await c.challengeInfo(challengeIdA)).toMatchObject({ok: true});

    const rB = await c.signTx('b', [v0([transfer(1_000_000)])]);
    const requestIdB = String(rB?.requestId);
    const idB = String((await c.simulated()).request?.tx?.simulation.id);
    // The one way B's own challengeId field could ever point at A's record (a forged or raced write) — the real
    // defence below is the digest binding, not that this cannot happen structurally.
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.requestId === requestIdB ? {...e, challengeId: challengeIdA} : e))});
    expect(await c.approve(requestIdB, idB)).toEqual({ok: false, error: 'reauth-required'});
    expect(c.page.answersFor(requestIdB)).toEqual([]);
  });

  // Fix round 1 item 1: the gate only ever runs after a `peek` that found this entry; if that unsectioned read misses
  // it (a race, a malformed stored value — readDappSession silently drops what it cannot validate), the gate never
  // ran and `proof` stays null. The deciding section itself must still refuse a transaction that needs re-auth in
  // that case — it cannot lean on the gate having run at all.
  it('the peek misses the entry (an empty queue read): the deciding section itself still requires the proof — reauth-required, nothing answered, nothing signed', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    const get = c.ext.session.get;
    let calls = 0;
    c.ext.session.get = async k => {
      if (k === DAPP_SESSION_KEY) {
        calls++;
        if (calls === 1) return undefined; // the peek's own read: an empty queue, as if the entry were not there yet.
      }
      return get(k);
    };
    expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'reauth-required'});
    c.ext.session.get = get;
    expect(c.page.answersFor(requestId)).toEqual([]);
    expect((await c.entry(requestId))?.state).toBe('queued');
    expect((await c.entry(requestId))?.challengeId).toBeNull();
  });
});

// B1c-3 (the final review's minor): #10 lists at most MAX_DAPP_OUTGOING mints and counts the rest — a refresh that
// adds a mint past the list moves nothing listed, but the description no longer covers it.
describe('outgoingGrew', () => {
  const row = {mint: null, symbol: 'SOL' as const, amount: '5', decimals: 9};
  it('a mint more cut from the list (omitted grew) is growth; the same count, or fewer, is not', () => {
    expect(outgoingGrew({outgoing: [row], omitted: 1}, {outgoing: [row], omitted: 0})).toBe(true);
    expect(outgoingGrew({outgoing: [row], omitted: 1}, {outgoing: [row], omitted: 1})).toBe(false);
    expect(outgoingGrew({outgoing: [row], omitted: 0}, {outgoing: [row], omitted: 1})).toBe(false);
    // B1c-2's rule unchanged: a listed amount that grew.
    expect(outgoingGrew({outgoing: [{...row, amount: '6'}], omitted: 0}, {outgoing: [row], omitted: 0})).toBe(true);
  });
});

// Brief "Carried items" (B1c-3): a durable-nonce transaction against the 30 s refresh and Q21. The proxy simulates with
// replaceRecentBlockhash: false (core/solana/rpc.ts; pinned by core's rpc.test.ts), so the node checks a nonce
// transaction's blockhash against its nonce account, not against the recent-blockhash queue: its age never expires it,
// and the wallet derives no expiry of its own. Only the node's BlockhashNotFound does — the nonce advanced or the
// account closed, so the transaction can never land: Q21 is then the truth.
describe('a durable-nonce transaction and the refresh (Q21)', () => {
  const nonceTx = () => v0([SystemProgram.nonceAdvance({noncePubkey: new PublicKey(new Uint8Array(32).fill(61)), authorizedPubkey: ME}), transfer(1)]);

  it('every refresh stays simulated — never expired by age; the warning is stored with each; approvable', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const requestId = String((await c.signTx('t', [nonceTx()]))?.requestId);
    let id = String((await c.simulated()).request?.tx?.simulation.id);
    for (let n = 0; n < 3; n++) {
      c.deps.clock.t += SIM_REFRESH_MS;
      const view = await c.simulated(id);
      id = String(view.request?.tx?.simulation.id);
      expect((view.request?.tx?.transactions as {outcome: unknown}[])[0]?.outcome).toMatchObject({ok: true});
      const e = await c.entry(requestId);
      expect(e?.sim?.status === 'ok' ? e.sim.sim.flags[0]?.map(f => f.kind) : null).toContain('durable-nonce');
    }
    expect(c.chain.calls.get('simulateTransaction')).toBe(4);
    expect(await c.approve(requestId, id)).toEqual({ok: true});
  });

  it('the node’s own BlockhashNotFound (the nonce advanced) is expired, as for any transaction: Reject only', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const requestId = String((await c.signTx('t', [nonceTx()]))?.requestId);
    const id = String((await c.simulated()).request?.tx?.simulation.id);
    c.chain.err = 'BlockhashNotFound';
    c.deps.clock.t += SIM_REFRESH_MS;
    const view = await c.simulated(id);
    expect((view.request?.tx?.transactions as {outcome: unknown}[])[0]?.outcome).toEqual({ok: false, error: 'expired', detail: '"BlockhashNotFound"'});
    expect(await c.approve(requestId, view.request?.tx?.simulation.id)).toEqual({ok: false, error: 'blockhash-expired'});
  });
});

describe('#48’s other views', () => {
  // Fix round 1, test hygiene item 5: retitled to what this actually checks — a queued signTransaction request is
  // swept the same way a connect/signMessage one is (there is no reachable "locked, a queued tx shows only its
  // origin" case for a transaction request: page.signTransaction itself refuses `unauthorized` while locked, before
  // any entry is ever queued — grantedAccount returns none while locked, so the request never reaches the queue to
  // be shown locked in the first place). The unrelated `runtimeFor(...).simulating.size` cleanup assertion (not a
  // view at all) is dropped.
  it('the mismatch notice names the origin the account is granted to; a lock sweeps a queued transaction request too — nothing left to show', async () => {
    const c = await txScene({grant: {origin: 'https://jup.ag'}});
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    const view = (await c.pend()) as unknown as {state: string; request: {type: string; mismatch: unknown; tx: unknown}};
    expect(view).toMatchObject({state: 'request', request: {type: 'mismatch', mismatch: {granted: 'https://jup.ag'}, tx: null}});
    const d = await txScene();
    await d.signTx('t', [v0()]);
    await lock(d.ext);
    // A lock answers the queue: nothing left to show.
    expect((await d.pend()).state).toBe('none');
  });
});

// D11: the approval window never links into the vault page; the popup (opened from the toolbar) offers #10.
describe('dapp.reauth (the popup’s offer of #10)', () => {
  it('the head’s live, unproven challenge with its site; null before Approve asked and once proven; locked refused; never from the window', async () => {
    const {handleMessage} = await import('../../messages');
    const c = await txScene();
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    const ask = (sender = popup) => handleMessage(c.ext, {type: 'dapp.reauth'}, sender, c.deps);
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    expect(await ask()).toEqual({ok: true, data: null});
    await c.approve(requestId, id);
    const challengeId = String((await c.entry(requestId))?.challengeId);
    expect(await ask()).toEqual({ok: true, data: {challengeId, site: 'dapp.test'}});
    expect(await ask({id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/approve.html`})).toEqual({ok: false, error: 'forbidden'});
    await c.reauthOk(challengeId);
    expect(await ask()).toEqual({ok: true, data: null});
    await lock(c.ext);
    expect(await ask()).toEqual({ok: false, error: 'locked'});
  });

  // Fix round 1 item 3: the site is the challenge's own stored about.site, read by the challengeInfo call this
  // already makes — not recomputed from the entry's origin/host — so the strip and #10 can never disagree about
  // which site a request names (the one source constructed here differs on purpose from what `new URL(origin).host`
  // would produce, to prove it is not consulted).
  it('the site is the challenge’s own about.site — never recomputed from the entry’s origin/host', async () => {
    const {handleMessage} = await import('../../messages');
    const c = await txScene();
    const entry = {
      requestId: 'BBBBBBBBBBBBBBBBBBBBBB', pageId: 'p1', origin: 'https://jup.ag', host: 'jup.ag', tabId: 7, documentId: null, type: 'signTransaction', account: ACCOUNT.publicKey,
      message: null, transactions: ['AQ=='], granted: null, sim: null, challengeId: null as string | null, sent: null, arrivedAt: c.deps.now(), state: 'queued', decidedBy: null, decidingAt: null,
      decision: null, answer: null, answeredAt: null,
    };
    const about = {
      kind: 'dapp' as const,
      account: ACCOUNT.publicKey,
      site: 'not-jup.ag-at-all.example',
      transactions: 1,
      outgoing: [{mint: null, symbol: 'SOL' as const, amount: '1', decimals: 9}],
      omitted: 0,
      reasons: ['first-send' as const],
      thresholdCents: 10_000,
    };
    entry.challengeId = await issueChallenge(c.ext, c.deps, dappDigest(entry), about);
    await c.ext.session.set(DAPP_SESSION_KEY, {queue: [entry], grants: [], window: null, opening: null, undo: []});
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    expect(await handleMessage(c.ext, {type: 'dapp.reauth'}, popup, c.deps)).toEqual({ok: true, data: {challengeId: entry.challengeId, site: 'not-jup.ag-at-all.example'}});
  });
});
