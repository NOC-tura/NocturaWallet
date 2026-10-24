import {base64} from '@scure/base';
import {PublicKey, TransactionInstruction} from '@solana/web3.js';
import type {GeoAnswer, GeoReason} from '../../geo/gate';
import {decodeInstructions} from '../decode/decode';
import {resolveKeys} from '../decode/keys';
import {PRESALE_INSTRUCTIONS} from '../decode/presaleIdl';
import {parseWire} from '../decode/wire';
import {PRESALE_PURCHASES, expectedOverrides, overridesMatch, presalePurchasesOf, redFlagsOf, storedFlagsOf, type RedFlag, type RedFlagInput} from '../redFlags';
import {DAPP_SESSION_KEY, readDappSession, type Entry} from '../store';
import {carriesPurchase, dappAbout, dappDigest, txRefused} from '../signTx';
import {simStateOf} from '../simulate';
import {issueChallenge, satisfyChallenge} from '../../reauthChallenges';
import {ACCOUNT, RECIPIENT} from '../../__tests__/fixtures';
import {ME, assign, presaleIx, transfer, txScene, v0} from './txHarness';

/**
 * B1d §3.6 (D9, D15, C31): F12 — a site's presale purchase is a refusal with no override whenever the extension's
 * jurisdiction gate is closed or unreachable, in both builds (this file runs in both vitest runs, with the same
 * answers). Against the real background: the detection, redFlagsOf, the stored form, txRefused's row, and dapp.decide
 * asking the gate again before `deciding`.
 */
const off = process.env.NOCTURA_PRESALE === '0';
const OTHER = new PublicKey(new Uint8Array(32).fill(91));
const parsed = (instructions: TransactionInstruction[]) => {
  const p = parseWire(base64.decode(v0(instructions)));
  if (p === null) throw new Error('unparsable');
  return p;
};
/** redFlagsOf over one simulated transaction (nothing read before or after), with the gate's answer. */
function flagsOf(instructions: TransactionInstruction[], region?: GeoAnswer | null): RedFlag[] {
  const tx = parsed(instructions);
  const input: RedFlagInput = {account: ME.toBase58(), txs: [{tx, decoded: decodeInstructions(tx, resolveKeys(tx, new Map())), pre: new Map(), outcome: {status: 'simulated', post: new Map()}, firstSend: false}], mints: new Map(), reasons: [], ...(region === undefined ? {} : {region})};
  return redFlagsOf(input)[0] ?? [];
}

const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
const CLOSED: readonly {reason: GeoReason; countryCode: string | null}[] = [
  {reason: 'sanctioned', countryCode: 'KP'},
  {reason: 'stale_list', countryCode: 'SI'},
  {reason: 'unknown_country', countryCode: null},
  {reason: 'no_check', countryCode: null},
  {reason: 'refused', countryCode: null},
];
const closed = (c: {reason: GeoReason; countryCode: string | null}): GeoAnswer => ({open: false, ...c});
const REFUSED = (error: string) => ({ok: false, error});

describe(`F12: detection (${off ? 'off' : 'on'} build)`, () => {
  it('the six purchase instructions of the IDL, by program and discriminator — whether or not the rest parses; no other presale instruction, no other program', () => {
    expect(PRESALE_PURCHASES).toEqual(['presale_purchase_with_sol', 'presale_purchase_with_usdc', 'presale_purchase_with_usdt', 'presale_purchase_and_vest_stake', 'presale_purchase_usdc_and_vest_stake', 'presale_purchase_usdt_and_vest_stake']);
    expect(PRESALE_INSTRUCTIONS.filter(x => x.name.startsWith('presale_purchase')).map(x => x.name).sort()).toEqual([...PRESALE_PURCHASES].sort());
    for (const name of PRESALE_PURCHASES) expect([name, presalePurchasesOf(parsed([transfer(), presaleIx(name)]))]).toEqual([name, [1]]);
    // Every other instruction of the program — claims, the referral, the admin's — is not a purchase.
    for (const x of PRESALE_INSTRUCTIONS.filter(i => !PRESALE_PURCHASES.includes(i.name))) expect([x.name, presalePurchasesOf(parsed([presaleIx(x.name)]))]).toEqual([x.name, []]);
    const sol = PRESALE_INSTRUCTIONS.find(x => x.name === 'presale_purchase_with_sol');
    if (sol === undefined) throw new Error('no presale_purchase_with_sol');
    // The discriminator alone (its argument missing): still a purchase, and the decoder's unknown program (F1).
    const bare = presaleIx('presale_purchase_with_sol', {data: [...sol.discriminator]});
    expect(presalePurchasesOf(parsed([bare]))).toEqual([0]);
    expect(decodeInstructions(parsed([bare]), resolveKeys(parsed([bare]), new Map()))[0]?.program).toBeNull();
    // Seven bytes of it, or the same bytes under another program: not a purchase.
    expect(presalePurchasesOf(parsed([presaleIx('presale_purchase_with_sol', {data: sol.discriminator.slice(0, 7)})]))).toEqual([]);
    expect(presalePurchasesOf(parsed([new TransactionInstruction({programId: OTHER, data: Buffer.from([...sol.discriminator, 1, 0, 0, 0, 0, 0, 0, 0]), keys: [{pubkey: ME, isSigner: true, isWritable: true}]})]))).toEqual([]);
    // Two purchases: both indexes; F12 names the first.
    expect(presalePurchasesOf(parsed([presaleIx('presale_purchase_with_usdc'), transfer(), presaleIx('presale_purchase_with_sol')]))).toEqual([0, 2]);
  });
});

describe(`F12: redFlagsOf (${off ? 'off' : 'on'} build)`, () => {
  it('each purchase × each closed reason → F12 with that reason at the purchase, a refusal no word opens; open → no F12, the purchase F2 as before; not asked → no_check', () => {
    for (const name of PRESALE_PURCHASES) {
      for (const c of CLOSED) {
        const flags = flagsOf([transfer(), presaleIx(name)], closed(c));
        expect([name, c.reason, flags[0]]).toEqual([name, c.reason, {kind: 'presale-region', severity: 'refuse', word: null, at: 1, reason: c.reason}]);
        expect(expectedOverrides([flags])).toEqual([]);
        // No word belongs to it: any word given is a mismatch, none is "ok" — which is why txRefused's row precedes the words.
        expect(overridesMatch([flags], [{tx: 0, word: 'PRESALE'}])).toBe('mismatch');
      }
      expect([name, flagsOf([presaleIx(name)], undefined)[0]]).toEqual([name, {kind: 'presale-region', severity: 'refuse', word: null, at: 0, reason: 'no_check'}]);
      expect([name, flagsOf([presaleIx(name)], null)[0]?.kind]).toEqual([name, 'presale-region']);
      // A closed answer without a reason is still closed.
      expect([name, flagsOf([presaleIx(name)], {open: false, reason: null, countryCode: null})[0]]).toEqual([name, {kind: 'presale-region', severity: 'refuse', word: null, at: 0, reason: 'no_check'}]);
      // Positive control: the gate open — no F12; F2 names the purchase, as B1c does today.
      const open = flagsOf([presaleIx(name)], OPEN);
      expect([name, open]).toEqual([name, [{kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'presale', name}]}]]);
    }
  });

  it('a non-purchase presale instruction (register_referrer) is no F12, whatever the gate says', () => {
    for (const region of [closed({reason: 'sanctioned', countryCode: 'KP'}), null, undefined]) {
      expect(flagsOf([presaleIx('register_referrer')], region).map(f => f.kind)).toEqual(['non-transfer']);
    }
  });

  it('F12 sorts before every block and every warning, wherever its instruction is', () => {
    const flags = flagsOf([assign(), transfer(), presaleIx('presale_purchase_with_sol')], closed({reason: 'no_check', countryCode: null}));
    expect(flags.map(f => [f.kind, f.severity, f.at])).toEqual([
      ['presale-region', 'refuse', 2],
      ['assign', 'block', 0],
      ['non-transfer', 'warn', 2],
    ]);
  });

  it('the stored F12 is read back exactly; a word, another severity, an unknown reason, no index or a key more is not', () => {
    const f12 = {kind: 'presale-region', severity: 'refuse', word: null, at: 2, reason: 'stale_list'};
    expect(storedFlagsOf([f12])).toEqual([f12]);
    for (const reason of CLOSED.map(c => c.reason)) expect(storedFlagsOf([{...f12, reason}])).toEqual([{...f12, reason}]);
    const bad: unknown[] = [{...f12, word: 'PRESALE'}, {...f12, severity: 'block'}, {...f12, severity: 'warn'}, {...f12, reason: 'vpn'}, {...f12, reason: null}, {...f12, at: null}, {...f12, at: -1}, {...f12, countryCode: 'SI'}, {kind: 'presale-region', severity: 'refuse', word: null, at: 2}];
    for (const b of bad) expect([b, storedFlagsOf([b])]).toEqual([b, null]);
  });
});

describe(`F12 through the background (${off ? 'off' : 'on'} build)`, () => {
  /** A queued request of these transactions, simulated with the gate answering `geo` (a spy). */
  async function scene(wires: string[], geo: () => Promise<GeoAnswer>) {
    const c = await txScene({known: [RECIPIENT]});
    const asked = vi.fn(geo);
    c.deps.geo = asked;
    const requestId = String((await c.signTx('t', wires))?.requestId);
    const view = await c.simulated();
    const simulation = String(view.request?.tx?.simulation.id);
    const approve = (overrides?: {tx: number; word: string}[], sim = simulation) => c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, simulation: sim, ...(overrides === undefined ? {} : {overrides})});
    const stored = async (): Promise<Entry> => {
      const e = await c.entry(requestId);
      if (e === undefined) throw new Error('no entry');
      return e;
    };
    const signed = () => c.page.answersFor(requestId).filter(a => 'result' in a);
    return {...c, asked, requestId, view, simulation, approve, stored, signed};
  }
  const flagsIn = (view: {request: {tx: Record<string, unknown> | null} | null}) => (view.request?.tx?.transactions as {flags: {kind: string; reason?: string; countryCode?: string | null}[] | null}[] | undefined)?.map(t => t.flags);

  it('each purchase × the gate closed, unreachable or throwing → F12 shown, and dapp.decide refuses `presale-region` — nothing decided, nothing signed; open → no F12, approved and signed', async () => {
    const answers: [string, () => Promise<GeoAnswer>, string, string | null][] = [
      ...CLOSED.map((c): [string, () => Promise<GeoAnswer>, string, string | null] => [c.reason, async () => closed(c), c.reason, c.countryCode]),
      [
        'throws',
        async () => {
          throw new Error('the gate failed');
        },
        'no_check',
        null,
      ],
    ];
    for (const name of PRESALE_PURCHASES) {
      for (const [label, geo, reason, countryCode] of answers) {
        const c = await scene([v0([presaleIx(name)])], geo);
        expect([name, label, flagsIn(c.view)]).toEqual([name, label, [[{kind: 'presale-region', severity: 'refuse', word: null, at: 0, reason, countryCode}, {kind: 'non-transfer', severity: 'warn', word: null, at: 0, instructions: [{index: 0, program: 'presale', name}]}]]]);
        expect([name, label, (await c.stored()).sim]).toMatchObject([name, label, {status: 'ok', sim: {presaleRegion: {open: false, reason, countryCode}}}]);
        expect([name, label, await c.approve()]).toEqual([name, label, REFUSED('presale-region')]);
        expect([name, label, (await c.stored()).state, (await c.stored()).challengeId, c.signed()]).toEqual([name, label, 'queued', null, []]);
      }
      const c = await scene([v0([presaleIx(name)])], async () => OPEN);
      expect([name, flagsIn(c.view)?.[0]?.map(f => f.kind)]).toEqual([name, ['non-transfer']]);
      expect([name, await c.approve()]).toEqual([name, {ok: true}]);
      expect([name, c.signed().length]).toEqual([name, 1]);
    }
  });

  it('txRefused: `presale-region` with every word given and a proven re-authentication — the row stands after `simulation-failed`, before the words', async () => {
    // F12 beside F3's block in one transaction: the block's word and a challenge proven for exactly this request.
    const c = await scene([v0([assign(), presaleIx('presale_purchase_with_sol')])], async () => closed({reason: 'sanctioned', countryCode: 'KP'}));
    expect(await c.approve([{tx: 0, word: 'ASSIGN'}])).toEqual(REFUSED('presale-region'));
    expect((await c.stored()).challengeId).toBeNull();
    const e = await c.stored();
    const about = dappAbout(e, 'dapp.test', 10_000);
    if (about === null) throw new Error('no description');
    const id = await issueChallenge(c.ext, c.deps, dappDigest(e), about);
    expect(await satisfyChallenge(c.ext, c.deps.now(), id)).toBe(true);
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(x => (x.requestId === c.requestId ? {...x, challengeId: id} : x))});
    expect(txRefused({...(await c.stored()), challengeId: id}, c.simulation, [{tx: 0, word: 'ASSIGN'}], c.deps.now())).toBe('presale-region');
    for (const words of [[{tx: 0, word: 'ASSIGN'}], [], [{tx: 0, word: 'PRESALE'}]]) expect(await c.approve(words)).toEqual(REFUSED('presale-region'));
    expect([(await c.stored()).state, c.signed()]).toEqual(['queued', []]);
    // The row order: a failed simulation is still `simulation-failed` beside an F12; a stale id still `stale`.
    const failed = await c.stored();
    if (failed.sim?.status !== 'ok') throw new Error('not simulated');
    const sim = failed.sim.sim;
    expect(txRefused({...failed, sim: {status: 'ok', sim: {...sim, outcomes: [{ok: false, error: 'failed', detail: 'x'}]}}}, c.simulation, [], c.deps.now())).toBe('simulation-failed');
    expect(txRefused(failed, 'N'.repeat(22), [], c.deps.now())).toBe('stale');
    // Positive control: the gate open, the same block — its word and the proof sign it.
    const ok = await scene([v0([assign(), presaleIx('presale_purchase_with_sol')])], async () => OPEN);
    expect(await ok.approve([{tx: 0, word: 'ASSIGN'}])).toEqual(REFUSED('reauth-required'));
    expect(await ok.reauthOk(String((await ok.stored()).challengeId))).toEqual({ok: true});
    expect(await ok.approve([{tx: 0, word: 'ASSIGN'}])).toEqual({ok: true});
    expect(ok.signed().length).toBe(1);
  });

  it('a batch with one purchase among other transactions: F12 on that transaction only, the whole request refused; open → approved as a whole', async () => {
    const wires = [v0([transfer(1)]), v0([transfer(2), presaleIx('presale_purchase_usdt_and_vest_stake')]), v0([transfer(3)])];
    const c = await scene(wires, async () => closed({reason: 'refused', countryCode: null}));
    expect(flagsIn(c.view)?.map(l => l?.filter(f => f.kind === 'presale-region').map(f => f.reason))).toEqual([[], ['refused'], []]);
    expect(c.asked).toHaveBeenCalledTimes(1);
    expect(await c.approve()).toEqual(REFUSED('presale-region'));
    expect(c.signed()).toEqual([]);
    const ok = await scene(wires, async () => OPEN);
    expect(await ok.approve()).toEqual({ok: true});
    expect((ok.signed()[0]?.result as {signed: string[]}).signed).toHaveLength(3);
  });

  it('a non-purchase presale instruction (register_referrer): the gate is never asked, no F12, approvable', async () => {
    const c = await scene([v0([presaleIx('register_referrer')])], async () => closed({reason: 'sanctioned', countryCode: 'KP'}));
    expect(flagsIn(c.view)?.[0]?.map(f => f.kind)).toEqual(['non-transfer']);
    expect(carriesPurchase(await c.stored())).toBe(false);
    expect(await c.approve()).toEqual({ok: true});
    expect(c.asked).not.toHaveBeenCalled();
    expect((await c.stored())?.sim).toMatchObject({status: 'ok', sim: {presaleRegion: null}});
  });

  it('the decision asks the gate again: open at the simulation, closed at the approval → `presale-region` before `deciding` (no challenge, nothing signed), re-simulated with the F12 it now has; open again → signed', async () => {
    let answer: GeoAnswer = OPEN;
    const c = await scene([v0([presaleIx('presale_purchase_with_usdc')])], async () => answer);
    expect(flagsIn(c.view)?.[0]?.map(f => f.kind)).toEqual(['non-transfer']);
    expect(c.asked).toHaveBeenCalledTimes(1);
    answer = closed({reason: 'stale_list', countryCode: 'SI'});
    expect(await c.approve()).toEqual(REFUSED('presale-region'));
    // Asked at the decision, then by the re-simulation; the entry never left `queued`.
    expect(c.asked).toHaveBeenCalledTimes(3);
    const e = await c.stored();
    expect([e.state, e.decidedBy, e.challengeId, c.signed()]).toEqual(['queued', null, null, []]);
    expect(e.sim?.status === 'ok' ? [e.sim.sim.id === c.simulation, e.sim.sim.flags[0]?.[0]] : null).toEqual([false, {kind: 'presale-region', severity: 'refuse', word: null, at: 0, reason: 'stale_list'}]);
    // The refresh's answer is what the window now shows; the old simulation's id is stale.
    const view = await c.pend();
    expect(flagsIn(view)?.[0]?.[0]).toEqual({kind: 'presale-region', severity: 'refuse', word: null, at: 0, reason: 'stale_list', countryCode: 'SI'});
    const fresh = String(view.request?.tx?.simulation.id);
    expect(await c.approve(undefined, fresh)).toEqual(REFUSED('presale-region'));
    // The gate opens again: the next simulation drops F12, and the decision (asking again) signs.
    answer = OPEN;
    c.deps.clock.t += 30_000;
    const reopened = await c.simulated(fresh);
    expect(flagsIn(reopened)?.[0]?.map(f => f.kind)).toEqual(['non-transfer']);
    const calls = c.asked.mock.calls.length;
    expect(await c.approve(undefined, String(reopened.request?.tx?.simulation.id))).toEqual({ok: true});
    expect(c.asked).toHaveBeenCalledTimes(calls + 1);
    expect(c.signed().length).toBe(1);
  });

  it('a forged approval of a stored simulation that lost its F12: refused — read back invalid, or the decision’s own gate', async () => {
    const c = await scene([v0([presaleIx('presale_purchase_with_sol')])], async () => closed({reason: 'no_check', countryCode: null}));
    const e = await c.stored();
    if (e.sim?.status !== 'ok') throw new Error('not simulated');
    // The F12 dropped but the closed answer kept: the stored simulation does not read back (simulated again).
    const dropped = {...e.sim.sim, flags: [e.sim.sim.flags[0]?.filter(f => f.kind !== 'presale-region') ?? []]};
    expect(simStateOf(JSON.parse(JSON.stringify({status: 'ok', sim: dropped})))).toBeNull();
    // The F12 kept beside no answer, or beside an open one: the same.
    for (const presaleRegion of [null, OPEN]) expect([presaleRegion, simStateOf(JSON.parse(JSON.stringify({status: 'ok', sim: {...e.sim.sim, presaleRegion}})))]).toEqual([presaleRegion, null]);
    // An F12 whose reason is not the stored answer's, or a stored answer of another shape: the same.
    const other = {...e.sim.sim, flags: [e.sim.sim.flags[0]?.map(f => (f.kind === 'presale-region' ? {...f, reason: 'sanctioned' as const} : f)) ?? []]};
    expect(simStateOf(JSON.parse(JSON.stringify({status: 'ok', sim: other})))).toBeNull();
    for (const presaleRegion of [{open: true, reason: 'no_check', countryCode: null}, {open: false, reason: null, countryCode: null}, {open: false, reason: 'no_check', countryCode: 'si'}, {open: false, reason: 'no_check'}, undefined]) {
      expect([presaleRegion, simStateOf(JSON.parse(JSON.stringify({status: 'ok', sim: {...e.sim.sim, presaleRegion}})))]).toEqual([presaleRegion, null]);
    }
    expect(simStateOf(JSON.parse(JSON.stringify({status: 'ok', sim: e.sim.sim})))).toEqual({status: 'ok', sim: e.sim.sim});
    // Both rewritten (no F12, an open answer) — what the window then shows approvable — and the gate still closed:
    // the decision asks it and refuses.
    const forged = {...e.sim.sim, flags: [dropped.flags[0] ?? []], presaleRegion: OPEN};
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(x => (x.requestId === c.requestId ? {...x, sim: {status: 'ok', sim: forged}} : x))});
    expect(await c.approve()).toEqual(REFUSED('presale-region'));
    expect([(await c.stored()).state, c.signed()]).toEqual(['queued', []]);
  });

  it('the decision’s own section refuses a purchase the gate was not asked open for — even when the first read missed the entry', async () => {
    const c = await scene([v0([presaleIx('presale_purchase_with_sol')])], async () => OPEN);
    // The gate closes; the decision's first, unsectioned read (the peek) misses the entry, so neither the pre-section
    // nor the gate runs before the deciding section.
    c.deps.geo = async () => closed({reason: 'sanctioned', countryCode: 'KP'});
    const get = c.ext.session.get.bind(c.ext.session);
    let hide = true;
    c.ext.session.get = async (k: string) => {
      if (k === DAPP_SESSION_KEY && hide) {
        hide = false;
        return undefined;
      }
      return get(k);
    };
    expect(await c.approve()).toEqual(REFUSED('presale-region'));
    expect([hide, (await c.stored()).state, c.signed()]).toEqual([false, 'queued', []]);
  });
});
