import {base58} from '@scure/base';
import {handleWallet} from '../walletApi';
import {SETTINGS_KEY, readSettings} from '../settings';
import {VAULT_KEY} from '../accountsStore';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {satisfyChallenge} from '../reauthChallenges';
import {AUTOLOCK_ALARM} from '../autolock';
import {PREPARED_TTL_MS} from '../prepare';
import {PREPARED_KEY, REAUTH_KEY, SESSION_KEY, setSession} from '../session';
import {PENDING_KEY} from '../pendingStore';
import {POLL_INTERVAL_MS} from '../pending';
import {firstSignature} from '../../../../core/solana/broadcast';
import {RpcCoolingDown, RpcForbidden} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, pendingRecord, sendReader, unlocked} from './fixtures';

// A second session account for the selection tests (index 3, the envelope's 'Old'); setSession stores it as given.
const OTHER = {index: 3, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey};

const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT.publicKey}, {index: 3, name: 'Old', publicKey: RECIPIENT}]};
const NOC = WALLET_TOKENS.NOC.mint as string;

describe('handleWallet', () => {
  it('wallet.state: public account data, lock state and the selected account', async () => {
    const ext = fakeExt();
    expect(await handleWallet(ext, fakeDeps(), 'wallet.state', {})).toEqual({ok: true, data: {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null}});
    await ext.local.set(VAULT_KEY, ENV);
    await unlocked(ext);
    await ext.local.set(SETTINGS_KEY, {selectedAccount: 3});
    await setSession(ext, [ACCOUNT, OTHER]);
    const r = await handleWallet(ext, fakeDeps(), 'wallet.state', {});
    expect(r).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 3}});
    expect(JSON.stringify(r)).not.toContain('secretKey');
  });

  it('wallet.state never reports a selection the session does not hold: it falls back to the first session account', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    await ext.local.set(SETTINGS_KEY, {selectedAccount: 3});
    // Locked: the stored selection stands while the envelope has it.
    expect((await handleWallet(ext, fakeDeps(), 'wallet.state', {})).data).toMatchObject({unlocked: false, selected: 3});
    // A removal whose keys reached the session while the envelope still names index 3 (or the reverse).
    await unlocked(ext);
    expect((await handleWallet(ext, fakeDeps(), 'wallet.state', {})).data).toMatchObject({unlocked: true, selected: 0});
    // A selection gone from the envelope falls back too (positive control of the old rule).
    await ext.local.set(SETTINGS_KEY, {selectedAccount: 7});
    expect((await handleWallet(ext, fakeDeps(), 'wallet.state', {})).data).toMatchObject({selected: 0});
    // The session's first account, not the envelope's: the session holds only index 3.
    await setSession(ext, [OTHER]);
    expect((await handleWallet(ext, fakeDeps(), 'wallet.state', {})).data).toMatchObject({selected: 3});
  });

  it('wallet.balances: strings, for a valid address only', async () => {
    const reader = fakeReader({getBalance: async () => 7n, getTokenAccountsByOwner: async () => [{pubkey: 'a', mint: NOC, owner: ACCOUNT.publicKey, amount: 12n, decimals: 9}]});
    expect(await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.balances', {account: ACCOUNT.publicKey})).toEqual({ok: true, data: {sol: '7', noc: '12', usdc: '0', usdt: '0'}});
    expect(await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.balances', {account: 'nope'})).toEqual({ok: false, error: 'malformed'});
  });

  it('wallet.probeBalances: public keys only, at most six; any failed read — SOL or NOC — is "unresolved", never a zero', async () => {
    const reader = fakeReader({
      getMultipleLamports: async keys => keys.map((_, i) => BigInt(i)),
      getTokenAccountsByOwner: async owner => {
        if (owner === RECIPIENT) throw new Error('flaky');
        return [{pubkey: 'a', mint: NOC, owner, amount: 5n, decimals: 9}];
      },
    });
    // A NOC-only wallet whose token read fails must not read as unfunded (import would pick the wrong, permanent scheme).
    expect(await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.probeBalances', {publicKeys: [ACCOUNT.publicKey, RECIPIENT]})).toEqual({ok: true, data: {resolved: false, balances: []}});
    const r = await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.probeBalances', {publicKeys: [ACCOUNT.publicKey]});
    expect(r).toEqual({ok: true, data: {resolved: true, balances: [{publicKey: ACCOUNT.publicKey, lamports: '0', noc: '5'}]}});
    const down = fakeReader({
      getMultipleLamports: async () => {
        throw new Error('down');
      },
    });
    expect(await handleWallet(fakeExt(), fakeDeps({reader: down}), 'wallet.probeBalances', {publicKeys: [RECIPIENT]})).toEqual({ok: true, data: {resolved: false, balances: []}});
    expect(await handleWallet(fakeExt(), fakeDeps(), 'wallet.probeBalances', {publicKeys: Array(7).fill(RECIPIENT)})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(fakeExt(), fakeDeps(), 'wallet.probeBalances', {publicKeys: ['x']})).toEqual({ok: false, error: 'malformed'});
  });

  it('prepareSend → send → pending, end to end through the API', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const deps = fakeDeps({reader: sendReader()});
    deps.broadcast = async wire => firstSignature(wire);
    const prep = await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000'}});
    expect(prep.ok).toBe(true);
    const {id} = prep.data as {id: string};
    const sent = await handleWallet(ext, deps, 'wallet.send', {id});
    expect(sent).toMatchObject({ok: true, data: {state: 'pending'}});
    const pending = await handleWallet(ext, deps, 'wallet.pending', {});
    expect((pending.data as {state: string}[]).map(p => p.state)).toEqual(['pending']);
    expect(JSON.stringify(pending)).not.toContain('"wire"');
  });

  it('wallet.send before re-authentication answers reauth-required with the challenge id', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const prep = await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000'}});
    const {id, reauth} = prep.data as {id: string; reauth: {challengeId: string}};
    expect(await handleWallet(ext, deps, 'wallet.send', {id})).toEqual({ok: false, error: 'reauth-required', data: {challengeId: reauth.challengeId}});
  });

  it('wallet.prepareSend carries a challengeId into a re-prepare; wallet.preparedFor resumes a reopened popup', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    deps.broadcast = async wire => firstSignature(wire);
    const intent = {token: 'SOL', recipient: RECIPIENT, amount: '1000'};
    const prep = await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent});
    const {reauth} = prep.data as {reauth: {challengeId: string}};
    // The popup closed while the user re-authenticated; reopened past the 30 s, it finds the send and its challenge.
    await satisfyChallenge(ext, deps.now(), reauth.challengeId);
    deps.clock.t += PREPARED_TTL_MS + 1_000;
    const resumed = await handleWallet(ext, deps, 'wallet.preparedFor', {account: ACCOUNT.publicKey});
    expect(resumed).toMatchObject({ok: true, data: {expired: true, intent, reauth: {challengeId: reauth.challengeId}}});
    const again = await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent, challengeId: reauth.challengeId});
    expect(again).toMatchObject({ok: true, data: {reauth: {challengeId: reauth.challengeId}}});
    expect(await handleWallet(ext, deps, 'wallet.send', {id: (again.data as {id: string}).id})).toMatchObject({ok: true, data: {state: 'pending'}});
    expect(await handleWallet(ext, deps, 'wallet.preparedFor', {account: ACCOUNT.publicKey})).toEqual({ok: true, data: null});
  });

  it('wallet.prepareSend refuses a non-string challengeId; wallet.preparedFor refuses a non-address', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const intent = {token: 'SOL', recipient: RECIPIENT, amount: '1000'};
    expect(await handleWallet(ext, fakeDeps(), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent, challengeId: 5})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.preparedFor', {account: 'nope'})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.preparedFor', {account: ACCOUNT.publicKey})).toEqual({ok: true, data: null});
  });

  it('refusals and a 403 become fixed error codes', async () => {
    const ext = fakeExt();
    expect(await handleWallet(ext, fakeDeps(), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}})).toMatchObject({ok: false, error: 'locked'});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'BONK'}})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.resend', {id: 'x'})).toEqual({ok: false, error: 'unknown'});
    const reader = fakeReader({
      getBalance: async () => {
        throw new RpcForbidden('getBalance');
      },
      getTokenAccountsByOwner: async () => [],
    });
    expect(await handleWallet(ext, fakeDeps({reader}), 'wallet.balances', {account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'coordinator-refused'});
  });

  it('a latch cooling down, and any other failure, are typed answers — never a crash (ruling 2)', async () => {
    const cooling = fakeReader({
      getBalance: async () => {
        throw new RpcCoolingDown('getBalance');
      },
      getTokenAccountsByOwner: async () => [],
    });
    expect(await handleWallet(fakeExt(), fakeDeps({reader: cooling}), 'wallet.balances', {account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'coordinator-refused'});
    const cold = fakeReader({getMultipleLamports: async () => Promise.reject(new RpcCoolingDown('getMultipleAccounts'))});
    expect(await handleWallet(fakeExt(), fakeDeps({reader: cold}), 'wallet.probeBalances', {publicKeys: [RECIPIENT]})).toEqual({ok: false, error: 'coordinator-refused'});
    // fakeDeps' own reader throws a plain Error on any call.
    expect(await handleWallet(fakeExt(), fakeDeps(), 'wallet.balances', {account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'failed'});
  });

  it('every send refusal code crosses as itself: prepared-expired, prepared-invalid, unknown-prepared, in-flight, too-soon (ruling 2)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const deps = fakeDeps({reader: sendReader()});
    deps.broadcast = async wire => firstSignature(wire);
    const intent = {token: 'SOL', recipient: RECIPIENT, amount: '1000'};
    const prepare = async () => ((await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent})).data as {id: string}).id;

    const stale = await prepare();
    deps.clock.t += PREPARED_TTL_MS;
    expect(await handleWallet(ext, deps, 'wallet.send', {id: stale})).toEqual({ok: false, error: 'prepared-expired'});
    expect(await handleWallet(ext, deps, 'wallet.send', {id: stale})).toEqual({ok: false, error: 'unknown-prepared'});

    const tampered = await prepare();
    const stored = (await ext.session.get(PREPARED_KEY)) as {id: string; intent: {amount: string}}[];
    await ext.session.set(PREPARED_KEY, stored.map(p => (p.id === tampered ? {...p, intent: {...p.intent, amount: '2000'}} : p)));
    expect(await handleWallet(ext, deps, 'wallet.send', {id: tampered})).toEqual({ok: false, error: 'prepared-invalid'});

    const good = await prepare();
    const sent = await handleWallet(ext, deps, 'wallet.send', {id: good});
    expect(sent).toMatchObject({ok: true, data: {state: 'pending'}});
    expect(await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent})).toEqual({ok: false, error: 'in-flight'});
    const pendingId = (sent.data as {id: string}).id;
    expect(await handleWallet(ext, deps, 'wallet.resend', {id: pendingId})).toEqual({ok: false, error: 'too-soon'});
  });

  // Final review minor 2: once the signed bytes may have left, the answer is never a bare 'failed' ("nothing sent").
  async function broadcastReady() {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const deps = fakeDeps({reader: sendReader()});
    deps.broadcast = async wire => {
      deps.broadcasts.push(wire);
      return firstSignature(wire);
    };
    const prep = await handleWallet(ext, deps, 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000'}});
    return {ext, deps, id: (prep.data as {id: string}).id};
  }

  it('wallet.send: an idle-timer re-arm that fails after the broadcast still answers the pending send', async () => {
    const {ext, deps, id} = await broadcastReady();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const create = ext.alarms.create;
    ext.alarms.create = (name, o) => {
      if (name === AUTOLOCK_ALARM) throw new Error('alarms unavailable');
      return create(name, o);
    };
    const sent = await handleWallet(ext, deps, 'wallet.send', {id});
    expect(sent).toMatchObject({ok: true, data: {state: 'pending', signature: firstSignature(deps.broadcasts[0]!)}});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('wallet.send: a storage failure after the record exists answers check-pending with its id and signature — never "failed"', async () => {
    const {ext, deps, id} = await broadcastReady();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const set = ext.local.set.bind(ext.local);
    let writes = 0;
    ext.local.set = async (key, value) => {
      // The first write is the record itself (before the broadcast); every later one fails.
      if (key === PENDING_KEY && ++writes >= 2) throw new Error('quota');
      return set(key, value);
    };
    const sent = await handleWallet(ext, deps, 'wallet.send', {id});
    expect(deps.broadcasts).toHaveLength(1);
    const records = (await ext.local.get(PENDING_KEY)) as {id: string; signature: string}[];
    expect(records).toHaveLength(1);
    expect(sent).toEqual({ok: false, error: 'check-pending', data: {id: records[0]!.id, signature: firstSignature(deps.broadcasts[0]!)}});
    warn.mockRestore();
  });

  it('wallet.send: a failure BEFORE the record is written is still a plain failure (nothing was sent)', async () => {
    const {ext, deps, id} = await broadcastReady();
    ext.local.set = async () => {
      throw new Error('quota');
    };
    expect(await handleWallet(ext, deps, 'wallet.send', {id})).toEqual({ok: false, error: 'failed'});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('wallet.prepareSend checks the intent and the account BEFORE any request (ruling 6)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    // fakeDeps' reader throws on any call: a request would answer 'failed'.
    for (const intent of [
      {token: 'SOL', recipient: RECIPIENT, amount: '0'},
      {token: 'SOL', recipient: RECIPIENT, amount: '-1'},
      {token: 'SOL', recipient: RECIPIENT, amount: 1000},
      {token: 'SOL', recipient: RECIPIENT, amount: '18446744073709551616'},
      {token: 'SOL', recipient: 'nope', amount: '1'},
      null,
    ]) {
      expect(await handleWallet(ext, fakeDeps(), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent})).toEqual({ok: false, error: 'malformed'});
    }
    expect(await handleWallet(ext, fakeDeps(), 'wallet.prepareSend', {account: 'nope', intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.prepareSend', {account: RECIPIENT, intent: {token: 'SOL', recipient: ACCOUNT.publicKey, amount: '1'}})).toEqual({
      ok: false,
      error: 'unknown-account',
    });
  });

  it('any wallet.* message resumes polling when a record is open, and none starts without one (ruling 5)', async () => {
    const sleeps: number[] = [];
    const deps = () => fakeDeps({sleep: ms => (sleeps.push(ms), new Promise<void>(() => undefined))});
    await handleWallet(fakeExt(), deps(), 'settings.get', {});
    expect(sleeps).toEqual([]);
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [pendingRecord()]);
    await handleWallet(ext, deps(), 'settings.get', {});
    expect(sleeps).toEqual([POLL_INTERVAL_MS]);
  });

  it('wallet.history refuses a malformed page cursor without a request (review M6)', async () => {
    const sig = base58.encode(new Uint8Array(64).fill(7));
    const reader = fakeReader({getSignaturesForAddress: async () => []});
    expect(await handleWallet(fakeExt(), fakeDeps({reader}), 'wallet.history', {account: ACCOUNT.publicKey, before: sig})).toEqual({ok: true, data: []});
    // fakeDeps' own reader throws on any call, so a request here would answer 'failed', not 'malformed'.
    for (const before of ['nope', base58.encode(new Uint8Array(32).fill(7)), 42]) {
      expect(await handleWallet(fakeExt(), fakeDeps(), 'wallet.history', {account: ACCOUNT.publicKey, before})).toEqual({ok: false, error: 'malformed'});
    }
  });

  it('accounts.rename and accounts.select', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await handleWallet(ext, fakeDeps(), 'accounts.rename', {index: 3, name: ' Savings '})).toEqual({ok: true});
    expect(((await ext.local.get(VAULT_KEY)) as typeof ENV).accounts[1]?.name).toBe('Savings');
    expect(await handleWallet(ext, fakeDeps(), 'accounts.rename', {index: 3, name: 'a‮b'})).toEqual({ok: false, error: 'malformed'});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.rename', {index: 9, name: 'x'})).toEqual({ok: false, error: 'unknown-account'});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.select', {index: 3})).toEqual({ok: true});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.select', {index: 9})).toEqual({ok: false, error: 'unknown-account'});
  });

  it('accounts.rename answers busy while the vault page keeps rewriting the envelope (ruling 7)', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    const get = ext.local.get;
    let n = 0;
    ext.local.get = async k => {
      const v = await get(k);
      if (k === VAULT_KEY) await ext.local.set(VAULT_KEY, {...ENV, rev: ++n});
      return v;
    };
    expect(await handleWallet(ext, fakeDeps(), 'accounts.rename', {index: 3, name: 'Savings'})).toEqual({ok: false, error: 'busy'});
  });

  it('accounts.select cannot undo a concurrent strengthening of the settings (one writer at a time)', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    const get = ext.local.get;
    let slowFirst = true;
    // The first settings read (accounts.select's) is slow: without serialisation its stale copy
    // would be written after the strengthening, putting the 5-minute lock back.
    ext.local.get = async k => {
      const v = await get(k);
      if (k === SETTINGS_KEY && slowFirst) {
        slowFirst = false;
        await new Promise(r => setTimeout(r, 20));
      }
      return v;
    };
    const deps = fakeDeps();
    const [a, b] = await Promise.all([handleWallet(ext, deps, 'accounts.select', {index: 3}), handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 2}})]);
    expect([a.ok, b.ok]).toEqual([true, true]);
    expect(await readSettings(ext)).toEqual({autoLockMinutes: 2, reauthUsdCents: 10_000, selectedAccount: 3});
  });

  it('settings.set: strengthening applies at once; weakening needs a satisfied challenge for that exact patch', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 2}})).toMatchObject({ok: true, data: {autoLockMinutes: 2}});
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(2);
    const ask = await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}});
    expect(ask).toMatchObject({ok: false, error: 'reauth-required'});
    const {challengeId} = ask.data as {challengeId: string};
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}, challengeId})).toMatchObject({ok: false, error: 'reauth-required'});
    await satisfyChallenge(ext, deps.now(), challengeId);
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 60}, challengeId})).toMatchObject({ok: false, error: 'reauth-required'});
    const second = await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}});
    const id2 = (second.data as {challengeId: string}).challengeId;
    await satisfyChallenge(ext, deps.now(), id2);
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}, challengeId: id2})).toMatchObject({ok: true, data: {autoLockMinutes: 30}});
    expect(await handleWallet(ext, deps, 'settings.get', {})).toMatchObject({ok: true, data: {autoLockMinutes: 30}});
  });

  it('settings.set: a challenge proved for one dollar threshold cannot raise it to another (the digest binds both fields)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps();
    const ask = await handleWallet(ext, deps, 'settings.set', {patch: {reauthUsdCents: 20_000}});
    const {challengeId} = ask.data as {challengeId: string};
    await satisfyChallenge(ext, deps.now(), challengeId);
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {reauthUsdCents: 100_000}, challengeId})).toMatchObject({ok: false, error: 'reauth-required'});
    expect(await readSettings(ext)).toMatchObject({reauthUsdCents: 10_000});
    const again = await handleWallet(ext, deps, 'settings.set', {patch: {reauthUsdCents: 20_000}});
    const id2 = (again.data as {challengeId: string}).challengeId;
    await satisfyChallenge(ext, deps.now(), id2);
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {reauthUsdCents: 20_000}, challengeId: id2})).toMatchObject({ok: true, data: {reauthUsdCents: 20_000}});
  });

  it('settings.set: a lock landing before the challenge is issued answers locked and leaves no challenge behind', async () => {
    // (a) the lock lands between the first session check and issueChallenge
    const ext = fakeExt();
    await unlocked(ext);
    const get = ext.session.get;
    let sessionReads = 0;
    ext.session.get = async k => {
      const v = await get(k);
      if (k === SESSION_KEY && ++sessionReads === 1) await ext.session.clear();
      return v;
    };
    const issued: number[] = [];
    const deps = fakeDeps({randomBytes: n => (issued.push(n), new Uint8Array(n).fill(9))});
    expect(await handleWallet(ext, deps, 'settings.set', {patch: {autoLockMinutes: 30}})).toEqual({ok: false, error: 'locked'});
    expect(issued).toEqual([]); // no challenge was even issued
    expect(await get(REAUTH_KEY)).toBeUndefined();
    expect(await readSettings(ext)).toMatchObject({autoLockMinutes: 5});

    // (b) the lock lands while issueChallenge is writing: the challenge it wrote is removed
    const ext2 = fakeExt();
    await unlocked(ext2);
    const set = ext2.session.set;
    ext2.session.set = async (k, v) => {
      await set(k, v);
      if (k === REAUTH_KEY) await ext2.session.remove(SESSION_KEY);
    };
    expect(await handleWallet(ext2, fakeDeps(), 'settings.set', {patch: {autoLockMinutes: 30}})).toEqual({ok: false, error: 'locked'});
    expect(await ext2.session.get(REAUTH_KEY)).toBeUndefined();
  });

  it('settings.set: a weakening patch while locked is refused outright', async () => {
    expect(await handleWallet(fakeExt(), fakeDeps(), 'settings.set', {patch: {reauthUsdCents: 50_000}})).toEqual({ok: false, error: 'locked'});
    expect(await handleWallet(fakeExt(), fakeDeps(), 'settings.set', {patch: {x: 1}})).toEqual({ok: false, error: 'malformed'});
  });
});
