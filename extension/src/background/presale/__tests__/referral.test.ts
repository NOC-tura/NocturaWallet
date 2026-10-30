import {PublicKey} from '@solana/web3.js';
import {registerPresale} from '../api';
import {referralStatsFrom} from '../referral';
import {handleMessage, registerPresaleHandler} from '../../messages';
import {createJsonGetter} from '../../deps';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {RECIPIENT, unlocked} from '../../__tests__/fixtures';
import {derivePresalePdas} from '../../../../../core/presale/allocation';
import {FORBIDDEN_COOLDOWN_MS, RequestUnreachable, RpcHttpError, createForbiddenLatch, type AccountData} from '../../../../../core/solana/rpc';
import {ACCOUNT, NOW_MS, allocationData, chainMap, chainReader, program, type Chain} from './chain';

// B1d §3.5 "#24's data", §4.4 (C1, D4; §1.4 presale.referral): #24's ReferralView through the real background's message
// handler — the link whole; EARNED from the chain allocation's referral_bonus_tokens, never the coordinator's figure;
// REFERRALS and REFERRED from GET /referral-stats/<address>, read strictly, the dollars made cents here; each source
// failing alone nulls only its own fields; a 403 trips the shared latch. No test reaches the network: every GET is the
// test's own function, and the global fetch throws.
registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

const EXT = fakeExt();
const POPUP = {id: EXT.runtimeId, origin: EXT.extensionOrigin, url: `${EXT.extensionOrigin}/popup.html`};
const LINK = `https://noc-tura.io?ref=${ACCOUNT}`;
const ALLOCATION = derivePresalePdas(new PublicKey(ACCOUNT)).userAllocation.toBase58();
/** The coordinator's answer as postgres.js getReferralStats builds it (coordinator main 9e7d468): every key it sends. */
const STATS = {totalReferrals: 3, totalReferredPurchases: 5, totalBaseBonusNoc: 999, totalExtraBonusNoc: 0, totalBonusNoc: 999, totalReferredNoc: 8_000, totalReferredUsd: 1234.56, tierBonusCount: 0};
const body = (data: unknown = STATS) => ({success: true, data});

interface World {
  deps: ReturnType<typeof fakeDeps>;
  reads: string[][];
  gets: string[];
}
function world(o: {chain?: Partial<Chain>; get?: (path: string) => Promise<unknown>; read?: () => Promise<(AccountData | null)[]>} = {}): World {
  const reads: string[][] = [];
  const gets: string[] = [];
  const chain = chainMap(o.chain);
  const read = o.read;
  const reader = chainReader(chain, reads, read === undefined ? {} : {getAccountsData: async addresses => (reads.push([...addresses]), read())});
  const deps = fakeDeps({
    reader,
    getJson: async path => {
      gets.push(path);
      return o.get === undefined ? body() : o.get(path);
    },
  });
  deps.clock.t = NOW_MS;
  return {deps, reads, gets};
}
async function ask(w: World, msg: Record<string, unknown> = {type: 'presale.referral', account: ACCOUNT}) {
  const ext = fakeExt();
  await unlocked(ext);
  return handleMessage(ext, msg, POPUP, w.deps);
}
/** An allocation of ACCOUNT that earned `bonus` (its referral_bonus_tokens). */
const earned = (bonus: bigint): Partial<Chain> => ({allocation: program(allocationData({bonus}))});

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('a test reached for the network');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('presale.referral (§1.4, §3.5)', () => {
  it('populated: the link whole, EARNED from the chain, REFERRALS and REFERRED from /referral-stats — one read of the allocation, one GET of the address', async () => {
    const w = world({chain: earned(16_142_571_618n)});
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: '16142571618', referrals: '3', referredCents: '123456'}});
    expect(w.reads).toEqual([[ALLOCATION]]);
    expect(w.gets).toEqual([`/referral-stats/${ACCOUNT}`]);
  });

  it('EARNED is the allocation’s referral_bonus_tokens — never the coordinator’s bonus figures, which move nothing (and the chain’s does)', async () => {
    const a = await ask(world({chain: earned(7n), get: async () => body({...STATS, totalBaseBonusNoc: 5, totalExtraBonusNoc: 6, totalBonusNoc: 11})}));
    const b = await ask(world({chain: earned(7n), get: async () => body({...STATS, totalBaseBonusNoc: 0, totalExtraBonusNoc: 0, totalBonusNoc: 0})}));
    const c = await ask(world({chain: earned(8n)}));
    expect([a, b]).toEqual([
      {ok: true, data: {link: LINK, earnedBase: '7', referrals: '3', referredCents: '123456'}},
      {ok: true, data: {link: LINK, earnedBase: '7', referrals: '3', referredCents: '123456'}},
    ]);
    expect(c).toEqual({ok: true, data: {link: LINK, earnedBase: '8', referrals: '3', referredCents: '123456'}});
    // Not the account's own purchases either: total_tokens is not the referral bonus.
    expect(await ask(world({chain: {allocation: program(allocationData({bonus: 0n, totalTokens: 5_000_000_000n}))}}))).toEqual({ok: true, data: {link: LINK, earnedBase: '0', referrals: '3', referredCents: '123456'}});
  });

  it('24b: no allocation on chain earned nothing ("0", not "—"); a coordinator that counts nothing answers zeros', async () => {
    const zeros = {...STATS, totalReferrals: 0, totalReferredPurchases: 0, totalBaseBonusNoc: 0, totalBonusNoc: 0, totalReferredNoc: 0, totalReferredUsd: 0};
    expect(await ask(world({chain: {allocation: null}, get: async () => body(zeros)}))).toEqual({ok: true, data: {link: LINK, earnedBase: '0', referrals: '0', referredCents: '0'}});
  });

  it('/referral-stats failing alone (500, 429, a timeout, a 403) nulls REFERRALS and REFERRED only; EARNED stays', async () => {
    for (const e of [new RpcHttpError('/referral-stats', 500), new RpcHttpError('/referral-stats', 429), new RequestUnreachable('/referral-stats', 'no answer within 20000 ms; aborted')]) {
      const w = world({chain: earned(16_142_571_618n), get: async () => Promise.reject(e)});
      expect([e.message, await ask(w)]).toEqual([e.message, {ok: true, data: {link: LINK, earnedBase: '16142571618', referrals: null, referredCents: null}}]);
    }
  });

  it('the chain read failing alone (a throw, a short answer, a foreign or malformed allocation) nulls EARNED only; the stats stay', async () => {
    const stats = {link: LINK, earnedBase: null, referrals: '3', referredCents: '123456'};
    expect(await ask(world({read: async () => Promise.reject(new RequestUnreachable('/rpc', 'down'))}))).toEqual({ok: true, data: stats});
    expect(await ask(world({read: async () => []}))).toEqual({ok: true, data: stats});
    expect(await ask(world({chain: {allocation: program(allocationData({user: RECIPIENT}))}}))).toEqual({ok: true, data: stats});
    expect(await ask(world({chain: {allocation: program(allocationData({length: 100}))}}))).toEqual({ok: true, data: stats});
    expect(await ask(world({chain: {allocation: {...program(allocationData()), owner: RECIPIENT}}}))).toEqual({ok: true, data: stats});
  });

  it('both failing: every figure null, the link still whole', async () => {
    const w = world({read: async () => Promise.reject(new Error('down')), get: async () => Promise.reject(new RpcHttpError('/referral-stats', 503))});
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: null, referrals: null, referredCents: null}});
  });

  it('strict payload: {account} only, an address in the unlocked session', async () => {
    for (const m of [{type: 'presale.referral'}, {type: 'presale.referral', account: 'nope'}, {type: 'presale.referral', account: ACCOUNT, extra: 1}]) expect(await ask(world(), m)).toEqual({ok: false, error: 'malformed'});
    const w = world();
    expect(await handleMessage(fakeExt(), {type: 'presale.referral', account: ACCOUNT}, POPUP, w.deps)).toEqual({ok: false, error: 'locked'});
    expect(await ask(w, {type: 'presale.referral', account: RECIPIENT})).toEqual({ok: false, error: 'unknown-account'});
    expect([w.reads, w.gets]).toEqual([[], []]);
  });
});

describe('referralStatsFrom: no stat without a source', () => {
  it('reads totalReferrals and totalReferredUsd; the dollars become whole cents here (0.29 → 29, never 28)', () => {
    expect(referralStatsFrom(body())).toEqual({referrals: 3n, referredCents: 123_456n});
    expect(referralStatsFrom(body({...STATS, totalReferredUsd: 0.29}))).toEqual({referrals: 3n, referredCents: 29n});
    expect(referralStatsFrom(body({...STATS, totalReferredUsd: 19_696.72}))).toEqual({referrals: 3n, referredCents: 1_969_672n});
    expect(referralStatsFrom(body({...STATS, totalReferredUsd: 0}))).toEqual({referrals: 3n, referredCents: 0n});
    // Only the two it reads: the coordinator's other keys, present or not, change nothing (C34's rule for the gate's bodies).
    expect(referralStatsFrom(body({totalReferrals: 1, totalReferredUsd: 25}))).toEqual({referrals: 1n, referredCents: 2_500n});
  });

  it.each([
    ['not an object', 'ok'],
    ['null', null],
    ['no success', {data: STATS}],
    ['success false', {success: false, data: STATS}],
    ['success a string', {success: 'true', data: STATS}],
    ['no data', {success: true}],
    ['data null', {success: true, data: null}],
    ['totalReferrals missing (core would say 0)', body({...STATS, totalReferrals: undefined})],
    ['totalReferredUsd missing (core would say 0)', body({...STATS, totalReferredUsd: undefined})],
    ['totalReferrals a string', body({...STATS, totalReferrals: '3'})],
    ['totalReferrals negative', body({...STATS, totalReferrals: -1})],
    ['totalReferrals a fraction', body({...STATS, totalReferrals: 2.5})],
    ['totalReferredUsd a string', body({...STATS, totalReferredUsd: '1234.56'})],
    ['totalReferredUsd negative', body({...STATS, totalReferredUsd: -0.01})],
    ['totalReferredUsd beyond whole cents a double holds', body({...STATS, totalReferredUsd: 1e17})],
  ])('%s → null (no figure), never 0', (_name, b) => {
    expect(referralStatsFrom(b)).toBeNull();
  });
});

describe('a 403 on /referral-stats trips the shared latch (§5: never retried inside the cool-down)', () => {
  it('the 403 nulls the stats; the next #24 within the cool-down sends no GET; after it, the GET goes again', async () => {
    const urls: string[] = [];
    const clock = {t: NOW_MS};
    const latch = createForbiddenLatch({now: () => clock.t});
    let status = 403;
    const get = createJsonGetter(async url => (urls.push(url), {status, json: async () => body()}), latch);
    const w = world({chain: earned(9n), get: path => get.get<unknown>(path)});
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: '9', referrals: null, referredCents: null}});
    status = 200;
    clock.t += FORBIDDEN_COOLDOWN_MS - 1;
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: '9', referrals: null, referredCents: null}});
    expect(urls).toHaveLength(1);
    clock.t += 1;
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: '9', referrals: '3', referredCents: '123456'}});
    expect(urls).toEqual([`https://api.noc-tura.io/api/v1/referral-stats/${ACCOUNT}`, `https://api.noc-tura.io/api/v1/referral-stats/${ACCOUNT}`]);
  });
});
