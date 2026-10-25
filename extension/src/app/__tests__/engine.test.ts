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
import {ACCOUNT, RECIPIENT, pendingRecord, sendReader} from '../../background/__tests__/fixtures';
import {PENDING_KEY} from '../../background/pendingStore';

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

describe('the B1b-2b plan 2 client calls (E17) against the real background', () => {
  it('contacts, contactSet, contactRemove: typed replies and refusals; recipientInfo carries the contact label', async () => {
    const {engine} = await wired();
    expect(await engine.contacts()).toEqual({ok: true, data: {contacts: [], max: 200}});
    expect(await engine.contactSet(RECIPIENT, 'Marko')).toEqual({ok: true, data: {created: true}});
    expect(await engine.contactSet(RECIPIENT, 'Marko · Mom')).toEqual({ok: true, data: {created: false}});
    expect(await engine.contacts()).toEqual({ok: true, data: {contacts: [{address: RECIPIENT, name: 'Marko · Mom', lastSentAt: null, known: false}], max: 200}});
    expect(await engine.recipientInfo(ACCOUNT.publicKey, RECIPIENT)).toEqual({ok: true, data: {known: false, lastSentAt: null, label: {kind: 'contact', name: 'Marko · Mom'}, self: false}});
    expect(await engine.contactSet('nope', 'X')).toEqual({ok: false, error: 'malformed'});
    expect(await engine.contactSet(ACCOUNT.publicKey, 'marko · MOM')).toEqual({ok: false, error: 'duplicate-name'});
    expect(await engine.contactRemove(RECIPIENT)).toEqual({ok: true, data: null});
    expect(await engine.contacts()).toEqual({ok: true, data: {contacts: [], max: 200}});
    const locked = await wired({}, false);
    expect(await locked.engine.contacts()).toEqual({ok: false, error: 'locked'});
    expect(await locked.engine.contactSet(RECIPIENT, 'X')).toEqual({ok: false, error: 'locked'});
    expect(await locked.engine.contactRemove(RECIPIENT)).toEqual({ok: false, error: 'locked'});
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
    expect(pending.ok && pending.data.map(p => [p.state, p.intent?.amount, p.extra])).toEqual([['pending', 1_000_000n, null]]);
    expect(await engine.send(again.data.id)).toEqual({ok: false, error: 'unknown-prepared'});
  });

  // B1d §1.3, Q42: a purchase record (B1d §2.3) as the real background lists it — kept, its extra copied, a send's
  // prepare refused in-flight while it is open.
  it('pending: a stored record without an intent reaches the popup with its extra; a send is then in-flight', async () => {
    const {engine, ext} = await wired({reader: sendReader()});
    const extra = {kind: 'presale-buy', data: {currency: 'SOL', amount: '2000000000', stage: '2', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '30000', destination: RECIPIENT, referrer: null}};
    await ext.local.set(PENDING_KEY, [pendingRecord({id: 'b1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: null, fee: {networkLamports: '5050', markupLamports: '0'}, extra})]);
    expect(await engine.pending()).toEqual({ok: true, data: [expect.objectContaining({id: 'b1', intent: null, extra, fee: {networkLamports: 5050n, markupLamports: 0n}})]});
    expect(await engine.prepareSend(ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: 1n})).toMatchObject({ok: false, error: 'in-flight'});
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

  // Final review I2: the strip's site is whatever `new URL(origin).host` gives an https origin (shared/site.ts) — an
  // underscore, an IPv6 literal with a port — and never a path, a space or credentials.
  it('dappReauth: a URL-legal site (an underscore host, an IPv6 literal with a port) is read; a path, a space, credentials are failed', async () => {
    const id = 'a'.repeat(32);
    for (const site of ['my_site.example.com', '[::1]:8443', 'xn--80ak6aa92e.com', "a!$&'()*+,;=~b.test"]) {
      expect(await engineAnswering({ok: true, data: {challengeId: id, site}}).dappReauth()).toEqual({ok: true, data: {challengeId: id, site}});
    }
    for (const site of ['jup.ag/x', 'jup ag', 'user@jup.ag', 'jup.ag?x', 'jup.ag#x', '']) {
      expect([site, await engineAnswering({ok: true, data: {challengeId: id, site}}).dappReauth()]).toEqual([site, {ok: false, error: 'failed'}]);
    }
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

  // B1b-2b E17, rev 3 review L3: `known` must be a boolean when present, and a MISSING `known` reads as false — the
  // warning shows — never as true.
  it('contacts: a missing known is false; any other non-boolean, a bad address, a bad lastSentAt, an empty name or no max is failed', async () => {
    const row = {address: acc, name: 'Marko', lastSentAt: null, known: true};
    expect(await engineAnswering({ok: true, data: {contacts: [row], max: 200}}).contacts()).toEqual({ok: true, data: {contacts: [row], max: 200}});
    const {known: _k, ...noKnown} = row;
    expect(await engineAnswering({ok: true, data: {contacts: [noKnown], max: 200}}).contacts()).toEqual({ok: true, data: {contacts: [{...row, known: false}], max: 200}});
    for (const bad of [{known: 'yes'}, {known: 1}, {known: null}, {address: '0OIl'}, {name: 7}, {name: ''}, {lastSentAt: -1}, {lastSentAt: '5'}]) {
      expect(await engineAnswering({ok: true, data: {contacts: [{...row, ...bad}], max: 200}}).contacts()).toEqual({ok: false, error: 'failed'});
    }
    expect(await engineAnswering({ok: true, data: {contacts: [row]}}).contacts()).toEqual({ok: false, error: 'failed'});
    // Fix round 1, M5: max must be a non-negative integer, not merely present.
    for (const max of [-1, 1.5, '200', Number.NaN, undefined]) {
      expect(await engineAnswering({ok: true, data: {contacts: [row], max}}).contacts()).toEqual({ok: false, error: 'failed'});
    }
    expect(await engineAnswering({ok: true, data: {created: 'yes'}}).contactSet(acc, 'x')).toEqual({ok: false, error: 'failed'});
    expect(await engineAnswering({ok: false, error: 'exploded'}).contactSet(acc, 'x')).toEqual({ok: false, error: 'failed'});
  });

  // Fix round 1, M5: contactRemove's reply carries no data (`nothing`) — any data at all, not only the wrong shape
  // of it, is failed; a reply cannot smuggle a payload through a call whose success means nothing but "removed".
  it('contactRemove: a reply carrying any data is failed, not just a reply of the wrong shape', async () => {
    expect(await engineAnswering({ok: true, data: undefined}).contactRemove(acc)).toEqual({ok: true, data: null});
    for (const data of [null, {}, {removed: true}, [], 0, '']) {
      expect(await engineAnswering({ok: true, data}).contactRemove(acc)).toEqual({ok: false, error: 'failed'});
    }
  });

  it('recipientInfo: a contact label needs a non-empty string name; an unknown label kind is failed', async () => {
    const base = {known: false, lastSentAt: null, self: false};
    expect(await engineAnswering({ok: true, data: {...base, label: {kind: 'contact', name: 'M'}}}).recipientInfo(acc, acc)).toEqual({ok: true, data: {...base, label: {kind: 'contact', name: 'M'}}});
    for (const label of [{kind: 'contact'}, {kind: 'contact', name: 3}, {kind: 'contact', name: ''}, {kind: 'friend', name: 'M'}]) {
      expect(await engineAnswering({ok: true, data: {...base, label}}).recipientInfo(acc, acc)).toEqual({ok: false, error: 'failed'});
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

  // B1c-2: an item's origin — 'dapp', null, or absent (an older background) — and nothing else.
  it('history: an item’s origin is "dapp" or null (absent reads as null); any other value refuses the page', async () => {
    const one = {signature: '5'.repeat(88), blockTime: null, kind: 'other', token: null, mint: null, amount: null, counterparty: null, feeLamports: '5000', failed: false};
    const items = async (origin: unknown) => {
      const r = await engineAnswering({ok: true, data: {items: [origin === 'absent' ? one : {...one, origin}], next: null}}).history(acc);
      return r.ok ? r.data.items.map(i => i.origin) : r;
    };
    expect([await items('dapp'), await items(null), await items('absent')]).toEqual([['dapp'], [null], [null]]);
    for (const bad of ['wallet', 1, {}]) expect(await items(bad)).toEqual({ok: false, error: 'failed'});
  });

  it('pending: an unknown state or failure value', async () => {
    const p = {
      id: 'r1', account: acc, signature: '5'.repeat(88), lastValidBlockHeight: 1, createdAt: 1, lastSentAt: 1, state: 'pending', detail: null, detailCode: null,
      intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: {networkLamports: '5050', markupLamports: '0'}, extra: null,
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

  // B1d §1.3 (review H1), Q42: the wallet's own record of another kind — no intent, its kind and display data in
  // `extra` (or null: the background kept a record whose extra it could not read). On such a record the field must be
  // there and anything else is failed, as every other field; a send's extra is never read (review 1 L4).
  it('pending: a record without an intent is read with its extra, copied as it came; a malformed one is failed; a send’s extra is never read (review 1 L4)', async () => {
    const p = {
      id: 'r1', account: acc, signature: '5'.repeat(88), lastValidBlockHeight: 1, createdAt: 1, lastSentAt: 1, state: 'pending', detail: null, detailCode: null,
      intent: null, expiryNullSeenAt: null, failure: null, fee: {networkLamports: '5050', markupLamports: '0'},
      extra: {kind: 'presale-buy', data: {currency: 'SOL', amount: '2000000000', referrer: null, nested: [1, {a: 'b'}]}},
    };
    expect(await engineAnswering({ok: true, data: [p]}).pending()).toMatchObject({ok: true, data: [{id: 'r1', intent: null, extra: p.extra}]});
    for (const data of [null, 0, 'x', [], {}]) expect(await engineAnswering({ok: true, data: [{...p, extra: {kind: 'k', data}}]}).pending()).toMatchObject({ok: true, data: [{extra: {kind: 'k', data}}]});
    expect(await engineAnswering({ok: true, data: [{...p, extra: null}]}).pending()).toMatchObject({ok: true, data: [{intent: null, extra: null}]});
    // wallet.send and wallet.resend answer the same view.
    expect(await engineAnswering({ok: true, data: p}).resend('r1')).toMatchObject({ok: true, data: {intent: null, extra: p.extra}});
    expect(await engineAnswering({ok: true, data: p}).send('ab'.repeat(16))).toMatchObject({ok: true, data: {intent: null, extra: p.extra}});
    // A send with its extra null (positive control): read as before.
    const send = {...p, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, extra: null};
    expect(await engineAnswering({ok: true, data: [send]}).pending()).toMatchObject({ok: true, data: [{intent: {token: 'SOL', recipient: RECIPIENT, amount: 1n}, extra: null}]});
    const kinds = ['Presale-buy', 'presale buy', '1kind', '', 'k'.repeat(33), 'kind\u200b'];
    const malformed: unknown[] = [
      undefined,
      'presale-buy',
      [],
      {data: {}},
      {kind: 7, data: {}},
      {kind: 'presale-buy'},
      ...kinds.map(kind => ({kind, data: {}})),
    ];
    for (const extra of malformed) expect([extra, await engineAnswering({ok: true, data: [{...p, extra}]}).pending()]).toEqual([extra, {ok: false, error: 'failed'}]);
    const {extra: _omitted, ...withoutExtra} = p;
    expect(await engineAnswering({ok: true, data: [withoutExtra]}).pending()).toEqual({ok: false, error: 'failed'});
    // A send's extra is not read (review 1 L4): null whatever it carries — the send is shown, never dropped. An intent
    // that is neither null nor a send intent is failed.
    for (const extra of [p.extra, 'x', undefined]) {
      expect(await engineAnswering({ok: true, data: [{...send, extra}]}).pending()).toMatchObject({ok: true, data: [{intent: {token: 'SOL', recipient: RECIPIENT, amount: 1n}, extra: null}]});
    }
    for (const intent of [undefined, {}, {token: 'BONK', recipient: RECIPIENT, amount: '1'}, 'x']) expect(await engineAnswering({ok: true, data: [{...p, intent}]}).pending()).toEqual({ok: false, error: 'failed'});
    // One malformed record fails the whole list (it is never dropped silently).
    expect(await engineAnswering({ok: true, data: [send, {...p, extra: 'x'}]}).pending()).toEqual({ok: false, error: 'failed'});
    // A kind of 32 characters is a kind (the upper bound, positive control of the 33 above).
    expect((await engineAnswering({ok: true, data: [{...p, extra: {kind: 'k'.repeat(32), data: null}}]}).pending()).ok).toBe(true);
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

// B1d §1.1 (B1d-1b Task 4): the generic request — the presale entry's client asks its own types through it, so this
// client names none. The same transport, retry and reply rule as every named call; both builds.
describe('request: a message this client does not name', () => {
  const parseN = (x: unknown) => (typeof x === 'number' ? x : undefined);
  it('sends the message as given, and answers what the caller’s shape check accepts; a refused shape, an unlisted code, a thrown transport twice: failed', async () => {
    const sent: unknown[] = [];
    const answering = (reply: unknown) =>
      createEngine(async m => {
        sent.push(m);
        return reply;
      }, noSleep);
    expect(await answering({ok: true, data: 7}).request({type: 'x.get', a: 1}, ['nope'], parseN)).toEqual({ok: true, data: 7});
    expect(sent).toEqual([{type: 'x.get', a: 1}]);
    expect(await answering({ok: true, data: '7'}).request({type: 'x.get'}, ['nope'], parseN)).toEqual({ok: false, error: 'failed'});
    expect(await answering({ok: false, error: 'nope', data: {detail: 'd'}}).request({type: 'x.get'}, ['nope'], parseN)).toEqual({ok: false, error: 'nope', data: {detail: 'd'}});
    expect(await answering({ok: false, error: 'other'}).request({type: 'x.get'}, ['nope'], parseN)).toEqual({ok: false, error: 'failed'});
    let calls = 0;
    const throwing = createEngine(async () => {
      calls += 1;
      throw new Error('gone');
    }, noSleep);
    expect(await throwing.request({type: 'x.get'}, [], parseN)).toEqual({ok: false, error: 'failed'});
    expect(calls).toBe(2);
  });

  it('through the real background: an unknown type is refused as the background refuses it — failed unless listed', async () => {
    const {engine} = await wired();
    expect(await engine.request({type: 'x.unknown'}, ['unknown type'], parseN)).toEqual({ok: false, error: 'unknown type'});
    expect(await engine.request({type: 'x.unknown'}, [], parseN)).toEqual({ok: false, error: 'failed'});
  });
});
