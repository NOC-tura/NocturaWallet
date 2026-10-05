import {createEngine, feePaidLamports, RETRY_AFTER_MS, type Transport} from '../engine';
import {handleMessage} from '../../background/messages';
import {VAULT_KEY} from '../../background/accountsStore';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {setSession} from '../../background/session';
import {firstSignature} from '../../../../core/solana/broadcast';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, RECIPIENT, sendReader} from '../../background/__tests__/fixtures';

// Spec B1b-2a §8.3: the client wired to the REAL handleMessage, a fake Ext and fake deps, sent from
// /popup.html — the real background logic with no browser.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const POPUP = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]};
const NOC = WALLET_TOKENS.NOC.mint as string;
const noSleep = async () => undefined;

async function wired(depsOver: Parameters<typeof fakeDeps>[0] = {}, unlocked = true) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, ENV);
  if (unlocked) await setSession(ext, [ACCOUNT]);
  const deps = fakeDeps(depsOver);
  const transport: Transport = m => handleMessage(ext, m, POPUP, deps);
  return {ext, deps, engine: createEngine(transport, noSleep)};
}

describe('the B1b-2b client calls against the real background', () => {
  it('settingsSet: a strengthening is written; a weakening is reauth-required with its challenge id; locked; malformed', async () => {
    const {engine} = await wired();
    expect(await engine.settingsSet({autoLockMinutes: 1})).toMatchObject({ok: true, data: {autoLockMinutes: 1}});
    const weak = await engine.settingsSet({reauthUsdCents: 50_000});
    expect(weak).toMatchObject({ok: false, error: 'reauth-required'});
    expect((weak as {data?: {challengeId?: string}}).data?.challengeId).toMatch(/^[0-9a-f]{32}$/);
    expect(await engine.settingsSet({autoLockMinutes: 61})).toEqual({ok: false, error: 'malformed'});
    const locked = await wired({}, false);
    expect(await locked.engine.settingsSet({autoLockMinutes: 60})).toEqual({ok: false, error: 'locked'});
  });

  it('order: ok for a permutation, stale for another set; wallet.state follows it', async () => {
    const {engine, ext} = await wired();
    await ext.local.set(VAULT_KEY, {...ENV, accounts: [...ENV.accounts, {index: 1, name: 'Two', publicKey: RECIPIENT}]});
    expect(await engine.order([1, 0])).toEqual({ok: true, data: null});
    const state = await engine.state();
    expect(state.ok ? state.data.accounts.map(a => a.index) : null).toEqual([1, 0]);
    expect(await engine.order([0])).toEqual({ok: false, error: 'stale'});
    expect(await engine.order([0, 0])).toEqual({ok: false, error: 'malformed'});
  });
});

describe('the message client against the real background', () => {
  it('state, settings, ping, lock', async () => {
    const {engine} = await wired();
    expect(await engine.state()).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 0, passkey: false}});
    expect(await engine.settings()).toEqual({ok: true, data: {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null}});
    expect(await engine.ping()).toEqual({ok: true, data: null});
    expect(await engine.lock()).toEqual({ok: true, data: null});
    expect((await engine.state()).data).toMatchObject({unlocked: false});
  });

  it('balances become bigint; its refusals come through typed', async () => {
    const reader = fakeReader({getBalance: async () => 7n, getTokenAccountsByOwner: async () => [{pubkey: 'a', mint: NOC, owner: ACCOUNT.publicKey, amount: 12n, decimals: 9}]});
    const {engine} = await wired({reader});
    expect(await engine.balances(ACCOUNT.publicKey)).toEqual({ok: true, data: {sol: 7n, noc: 12n, usdc: 0n, usdt: 0n}});
    expect(await engine.balances('nope')).toEqual({ok: false, error: 'malformed'});
    for (const [e, code] of [[new RequestUnreachable('u', 'x'), 'unreachable'], [new RpcForbidden('getBalance'), 'coordinator-refused'], [new Error('x'), 'failed']] as const) {
      const failing = fakeReader({
        getBalance: async () => {
          throw e;
        },
        getTokenAccountsByOwner: async () => [],
      });
      expect(await (await wired({reader: failing})).engine.balances(ACCOUNT.publicKey)).toEqual({ok: false, error: code});
    }
  });

  it('prices and the cache', async () => {
    const reader = fakeReader({getBalance: async () => 7n, getTokenAccountsByOwner: async () => []});
    const {engine, deps} = await wired({reader});
    expect(await engine.prices()).toEqual({ok: true, data: {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: deps.clock.t}});
    expect(await engine.cached(ACCOUNT.publicKey)).toEqual({ok: true, data: {balances: null, prices: {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: deps.clock.t}}});
    await engine.balances(ACCOUNT.publicKey);
    expect((await engine.cached(ACCOUNT.publicKey)).data).toMatchObject({balances: {sol: 7n, noc: 0n, usdc: 0n, usdt: 0n, at: deps.clock.t}});
    await engine.lock();
    expect(await engine.cached(ACCOUNT.publicKey)).toEqual({ok: false, error: 'locked'});
  });

  it('prepare, resume, send, pending — and the refusal that carries a challenge', async () => {
    const {engine, ext, deps} = await wired({reader: sendReader()});
    deps.broadcast = async wire => firstSignature(wire);
    const intent = {token: 'SOL' as const, recipient: RECIPIENT, amount: 1_000_000n};
    const first = await engine.prepareSend(ACCOUNT.publicKey, intent);
    expect(first.ok && first.data.reauth?.reasons).toEqual(['first-send']);
    if (!first.ok) throw new Error('prepare');
    expect(first.data.simulation.sol.before).toBe(10_000_000_000n);
    const resumed = await engine.preparedFor(ACCOUNT.publicKey);
    expect(resumed.ok && resumed.data?.intent).toEqual(intent);
    expect(await engine.send(first.data.id)).toEqual({ok: false, error: 'reauth-required', data: {challengeId: first.data.reauth?.challengeId}});
    // A known recipient: no re-auth, and the send goes out.
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const again = await engine.prepareSend(ACCOUNT.publicKey, intent);
    if (!again.ok) throw new Error('prepare');
    expect(again.data.reauth).toBeNull();
    const sent = await engine.send(again.data.id);
    expect(sent.ok && sent.data.state).toBe('pending');
    const pending = await engine.pending();
    expect(pending.ok && pending.data.map(p => [p.state, p.intent.amount])).toEqual([['pending', 1_000_000n]]);
    expect(await engine.send(again.data.id)).toEqual({ok: false, error: 'unknown-prepared'});
  });

  it('recipientInfo, discardPrepared, rename, select, history', async () => {
    const reader = sendReader({getSignaturesForAddress: async () => []});
    const {engine} = await wired({reader});
    expect(await engine.recipientInfo(ACCOUNT.publicKey, RECIPIENT)).toEqual({ok: true, data: {known: false, lastSentAt: null, label: null, self: false}});
    await engine.prepareSend(ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: 1_000_000n});
    expect(await engine.discardPrepared(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
    expect(await engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
    expect(await engine.rename(0, 'Savings')).toEqual({ok: true, data: null});
    expect((await engine.state()).data).toMatchObject({accounts: [{name: 'Savings'}]});
    expect(await engine.rename(9, 'x')).toEqual({ok: false, error: 'unknown-account'});
    expect(await engine.select(0)).toEqual({ok: true, data: null});
    expect(await engine.history(ACCOUNT.publicKey)).toEqual({ok: true, data: {items: [], next: null}});
    expect(await engine.history(ACCOUNT.publicKey, 'not-a-signature')).toEqual({ok: false, error: 'malformed'});
  });
});

describe('shape checks: a reply of the wrong shape is failed', () => {
  const engineAnswering = (reply: unknown) => createEngine(async () => reply, noSleep);
  const acc = ACCOUNT.publicKey;

  it.each([
    ['a number where a base-unit string belongs', {ok: true, data: {sol: 7, noc: '0', usdc: '0', usdt: '0'}}],
    ['a decimal amount', {ok: true, data: {sol: '7.5', noc: '0', usdc: '0', usdt: '0'}}],
    ['a missing field', {ok: true, data: {sol: '7', noc: '0', usdc: '0'}}],
    ['an unknown refusal code', {ok: false, error: 'exploded'}],
    ['not an object', 'ok'],
    ['nothing', undefined],
  ])('balances: %s', async (_, reply) => {
    expect(await engineAnswering(reply).balances(acc)).toEqual({ok: false, error: 'failed'});
  });

  it('state: an address outside base58, an unknown scheme', async () => {
    const good = {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: acc}], selected: 0, passkey: false};
    expect((await engineAnswering({ok: true, data: good}).state()).ok).toBe(true);
    expect(await engineAnswering({ok: true, data: {...good, accounts: [{index: 0, name: 'A', publicKey: '0OIl'}]}}).state()).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: true, data: {...good, scheme: 'bip32'}}).state()).toEqual({ok: false, error: 'failed'});
  });

  it('B1b-2b: state requires a boolean passkey; settings requires the three new fields', async () => {
    const good = {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: acc}], selected: 0, passkey: true};
    expect(await engineAnswering({ok: true, data: good}).state()).toEqual({ok: true, data: good});
    const {passkey: _p, ...missing} = good;
    expect(await engineAnswering({ok: true, data: missing}).state()).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: true, data: {...good, passkey: 'yes'}}).state()).toEqual({ok: false, error: 'failed'});
    const settings = {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: [1, 0], phraseVerifiedAt: 3, passwordChangedAt: null};
    expect(await engineAnswering({ok: true, data: settings}).settings()).toEqual({ok: true, data: settings});
    for (const bad of [{accountOrder: [1, -1]}, {accountOrder: 'x'}, {phraseVerifiedAt: -1}, {passwordChangedAt: '1'}, {phraseVerifiedAt: undefined}]) {
      expect(await engineAnswering({ok: true, data: {...settings, ...bad}}).settings()).toEqual({ok: false, error: 'failed'});
    }
  });

  it('prices: zero is not a price (null is)', async () => {
    expect(await engineAnswering({ok: true, data: {sol: 0, usdc: 1, usdt: 1, noc: null, at: 1}}).prices()).toEqual({ok: false, error: 'failed'});
    expect((await engineAnswering({ok: true, data: {sol: null, usdc: 1, usdt: 1, noc: null, at: 1}}).prices()).ok).toBe(true);
  });

  // Review fix round 2, M1: `next` is checked the same way an item's own `signature` is (review fix
  // round 1 #1) — null, or a string that passes SIGNATURE — never trusted as-is.
  it('history: a malformed next (not null, not a valid signature)', async () => {
    const good = {items: [], next: null};
    expect((await engineAnswering({ok: true, data: good}).history(acc)).ok).toBe(true);
    expect((await engineAnswering({ok: true, data: {...good, next: '5'.repeat(88)}}).history(acc)).ok).toBe(true);
    expect(await engineAnswering({ok: true, data: {...good, next: 'not-a-signature'}}).history(acc)).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: true, data: {...good, next: 42}}).history(acc)).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: true, data: {...good, next: undefined}}).history(acc)).toEqual({ok: false, error: 'failed'});
  });

  it('pending: an unknown state or failure value', async () => {
    const p = {
      id: 'r1', account: acc, signature: '5'.repeat(88), lastValidBlockHeight: 1, createdAt: 1, lastSentAt: 1, state: 'pending', detail: null, detailCode: null,
      intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: {networkLamports: '5050', markupLamports: '0'},
    };
    expect((await engineAnswering({ok: true, data: [p]}).pending()).ok).toBe(true);
    expect(await engineAnswering({ok: true, data: [{...p, state: 'lost'}]}).pending()).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: true, data: [{...p, failure: 'maybe'}]}).pending()).toEqual({ok: false, error: 'failed'});
    // Plan 3: the fee is two base-unit strings or null, nothing else — and the field must be there.
    expect(await engineAnswering({ok: true, data: [p]}).pending()).toMatchObject({ok: true, data: [{fee: {networkLamports: 5050n, markupLamports: 0n}}]});
    expect((await engineAnswering({ok: true, data: [{...p, fee: null}]}).pending()).ok).toBe(true);
    const {fee: _omitted, ...withoutFee} = p;
    for (const fee of [undefined, '5050', 5050, {networkLamports: '5050'}, {networkLamports: '5050', markupLamports: 0}, {networkLamports: 'x', markupLamports: '0'}]) {
      expect(await engineAnswering({ok: true, data: [{...p, fee}]}).pending()).toEqual({ok: false, error: 'failed'});
    }
    expect(await engineAnswering({ok: true, data: [withoutFee]}).pending()).toEqual({ok: false, error: 'failed'});
    // Task 10 fix round 1: detailCode is a closed enum or null, and the field must be there.
    for (const detailCode of ['forbidden', 'cooling', 'unacked', 'substituted'] as const) {
      expect(await engineAnswering({ok: true, data: [{...p, detailCode}]}).pending()).toMatchObject({ok: true, data: [{detailCode}]});
    }
    for (const detailCode of [undefined, 'refused', 'FORBIDDEN', 3, {}]) {
      expect(await engineAnswering({ok: true, data: [{...p, detailCode}]}).pending()).toEqual({ok: false, error: 'failed'});
    }
    const {detailCode: _code, ...withoutCode} = p;
    expect(await engineAnswering({ok: true, data: [withoutCode]}).pending()).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: true, data: {...p, detailCode: 'other'}}).resend('r1')).toEqual({ok: false, error: 'failed'});
  });

  // Plan 3 follow-up ruling: what is shown as paid follows the state — a landed-but-failed send paid the network
  // fee and had its markup rolled back; not-sent and expired paid nothing; a send not yet settled claims nothing.
  it('feePaidLamports: confirmed = network + markup; failed/landed = network only; not-sent, expired, unsettled = null', () => {
    const fee = {networkLamports: 5_050n, markupLamports: 20_000n};
    expect(feePaidLamports({state: 'confirmed', failure: null, fee})).toBe(25_050n);
    expect(feePaidLamports({state: 'failed', failure: 'landed', fee})).toBe(5_050n);
    expect(feePaidLamports({state: 'failed', failure: 'not-sent', fee})).toBeNull();
    expect(feePaidLamports({state: 'expired', failure: null, fee})).toBeNull();
    expect(feePaidLamports({state: 'failed', failure: null, fee})).toBeNull();
    expect(feePaidLamports({state: 'pending', failure: null, fee})).toBeNull();
    expect(feePaidLamports({state: 'stuck', failure: null, fee})).toBeNull();
    expect(feePaidLamports({state: 'confirmed', failure: null, fee: null})).toBeNull();
  });

  // Plan 3: #20 reads whether the challenge is proven and when the quote ends; anything else is failed.
  it('prepareSend: reauth.proven must be a boolean and validUntil a time', async () => {
    const view = {
      id: 'ab'.repeat(16),
      fees: {networkLamports: '5050', priorityLamports: '50', rentLamports: '0', markupLamports: '0', markupReason: 'status-unknown'},
      solRequiredLamports: '1005050',
      reauth: {challengeId: 'cd'.repeat(16), reasons: ['first-send'], proven: false},
      validUntil: 1_030_000,
      simulation: {slot: 1, elapsedMs: 2, instructions: 3, programs: ['compute-budget', 'system'], recipient: 'wallet', sol: {before: '10', after: '9'}, token: null},
    };
    const intent = {token: 'SOL' as const, recipient: RECIPIENT, amount: 1n};
    expect(await engineAnswering({ok: true, data: view}).prepareSend(acc, intent)).toMatchObject({ok: true, data: {reauth: {proven: false}, validUntil: 1_030_000}});
    for (const bad of [{...view, reauth: {...view.reauth, proven: 'yes'}}, {...view, reauth: {challengeId: view.reauth.challengeId, reasons: ['first-send']}}, {...view, validUntil: -1}, {...view, validUntil: undefined}]) {
      expect(await engineAnswering({ok: true, data: bad}).prepareSend(acc, intent)).toEqual({ok: false, error: 'failed'});
    }
  });
});

describe('a thrown sendMessage (the service worker restarting)', () => {
  it('is retried once after 300 ms', async () => {
    let calls = 0;
    const waits: number[] = [];
    const engine = createEngine(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error('Could not establish connection. Receiving end does not exist.');
        return {ok: true};
      },
      async ms => void waits.push(ms),
    );
    expect(await engine.ping()).toEqual({ok: true, data: null});
    expect(calls).toBe(2);
    expect(waits).toEqual([RETRY_AFTER_MS]);
  });

  it('twice is failed', async () => {
    let calls = 0;
    const engine = createEngine(async () => {
      calls += 1;
      throw new Error('gone');
    }, noSleep);
    expect(await engine.ping()).toEqual({ok: false, error: 'failed'});
    expect(calls).toBe(2);
  });
});
