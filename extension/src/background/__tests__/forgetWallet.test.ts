import {base64} from '@scure/base';
import {GUARD_CONCURRENCY, VAULT_KEY, forgetWallet, storeEnvelope, type ForgetResult} from '../accountsStore';
import {handleMessage} from '../messages';
import {SESSION_KEY, getSession, setSession} from '../session';
import {PENDING_KEY, readPending, updatePending} from '../pendingStore';
import {pollOnce} from '../pending';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {SETTINGS_KEY} from '../settings';
import {CONTACTS_KEY} from '../contacts';
import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../balanceCache';
import {FORBIDDEN_UNTIL_KEY} from '../deps';
import {AUTOLOCK_ALARM} from '../autolock';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {RequestUnreachable, RpcForbidden, type SolanaReader} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, pendingRecord} from './fixtures';

// Spec B1b-2a E5: the engine half of delete-wallet. The proof ran in the vault page; the background
// binds a replacement to the same wallet (C4), guards a delete against funds (C6), and does it all in
// one serial section (H1, R2-M1).
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const from = (path: string) => ({id: ID, origin: ORIGIN, url: `${ORIGIN}${path}`});
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: K1},
  ],
};
const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
/** The same wallet under a new password: new salt, wrap and ciphertext; the same keys; names the page copied. */
const REPLACEMENT = {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}};
const zero = () => fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});

async function setup(reader: SolanaReader = zero()) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, STORED);
  await setSession(ext, [ACCOUNT]);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
  await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
  await ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Marko'}]);
  await ext.local.set(BALANCE_CACHE_KEY, {});
  await ext.local.set(PRICE_CACHE_KEY, {});
  await ext.local.set(FORBIDDEN_UNTIL_KEY, 123);
  const deps = fakeDeps({reader});
  return {ext, deps};
}
const vault = (ext: ReturnType<typeof fakeExt>) => ext.local.get(VAULT_KEY);

describe('vault.forgetWallet — who may ask', () => {
  it('only the vault page: refused from the popup, the tab and a web page', async () => {
    const {ext, deps} = await setup();
    const msg = {type: 'vault.forgetWallet', expectedRevision: REV};
    for (const sender of [from('/popup.html'), from('/wallet.html'), {id: ID, origin: 'https://evil.example', url: 'https://evil.example/unlock.html'}]) {
      expect(await handleMessage(ext, msg, sender, deps)).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await vault(ext)).toEqual(STORED);
    expect(await handleMessage(ext, msg, from('/unlock.html'), deps)).toEqual({ok: true});
    expect(await vault(ext)).toBeUndefined();
  });

  it('malformed requests change nothing', async () => {
    const {ext, deps} = await setup();
    for (const req of [
      {expectedRevision: 'x'},
      {expectedRevision: REV, guard: 'funded'},
      {expectedRevision: REV, guard: 'unfunded', replacement: REPLACEMENT},
      {expectedRevision: REV, replacement: {...REPLACEMENT, v: 2}},
    ]) {
      expect(await forgetWallet(ext, deps, req)).toBe('malformed');
    }
    expect(await vault(ext)).toEqual(STORED);
    expect(await getSession(ext)).not.toBeNull();
  });
});

describe('vault.forgetWallet — the stored wallet', () => {
  it('no-wallet, stored-invalid, busy on a stale revision — nothing changed, not locked', async () => {
    const ext = fakeExt();
    expect(await forgetWallet(ext, fakeDeps(), {expectedRevision: REV})).toBe('no-wallet');
    await ext.local.set(VAULT_KEY, {...STORED, seed: 'damaged'});
    expect(await forgetWallet(ext, fakeDeps(), {expectedRevision: REV})).toBe('stored-invalid');
    const s = await setup();
    expect(await forgetWallet(s.ext, s.deps, {expectedRevision: 'f'.repeat(64)})).toBe('busy');
    expect(await vault(s.ext)).toEqual(STORED);
    expect(await getSession(s.ext)).not.toBeNull();
  });
});

describe('vault.forgetWallet — a delete (no replacement)', () => {
  it('locks, removes the vault, the known recipients, the settings, the address book and both caches; keeps the 403 cool-down', async () => {
    const {ext, deps} = await setup();
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: RECIPIENT, name: 'Marko'}]);
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await vault(ext)).toBeUndefined();
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
    // B1b-2b E17 (D20): the address book goes with the wallet.
    for (const key of [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) expect(await ext.local.get(key)).toBeUndefined();
    expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
  });

  it('removes closed pending records', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(PENDING_KEY, [pendingRecord({state: 'confirmed'}), pendingRecord({id: 'r2', state: 'expired'})]);
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await readPending(ext)).toEqual([]);
  });
});

describe('vault.forgetWallet — a restore (replacement, C4, D40)', () => {
  it('replaces the envelope, keeps every stored name, the known recipients and the settings; removes the caches', async () => {
    const {ext, deps} = await setup();
    const renamedByPage = {...REPLACEMENT, accounts: REPLACEMENT.accounts.map(a => ({...a, name: 'x'}))};
    expect(await forgetWallet(ext, deps, {expectedRevision: REV, replacement: renamedByPage})).toBe('forgotten');
    expect(await vault(ext)).toEqual(REPLACEMENT);
    expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1}]);
    expect(await ext.local.get(SETTINGS_KEY)).toEqual({autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
    // B1b-2b E17 (D20): a restore keeps the address book.
    expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: RECIPIENT, name: 'Marko'}]);
    expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
    expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
    expect(await getSession(ext)).toBeNull();
  });

  it('C4: another scheme, an extra account, a missing account or one changed key is malformed — nothing changed', async () => {
    const {ext, deps} = await setup();
    const [a0, a1] = REPLACEMENT.accounts as [(typeof REPLACEMENT.accounts)[0], (typeof REPLACEMENT.accounts)[0]];
    for (const replacement of [
      {...REPLACEMENT, scheme: 'cli', accounts: [a0]},
      {...REPLACEMENT, accounts: [a0, a1, {index: 2, name: 'Extra', publicKey: RECIPIENT}]},
      {...REPLACEMENT, accounts: [a0]},
      {...REPLACEMENT, accounts: [a0, {...a1, publicKey: RECIPIENT}]},
    ]) {
      expect(await forgetWallet(ext, deps, {expectedRevision: REV, replacement})).toBe('malformed');
    }
    expect(await vault(ext)).toEqual(STORED);
    expect(await getSession(ext)).not.toBeNull();
  });
});

describe('vault.forgetWallet — a send still open refuses (H1)', () => {
  it('send-open for a pending and for a stuck record — locked, otherwise unchanged; allowed once closed', async () => {
    for (const state of ['pending', 'stuck'] as const) {
      const {ext, deps} = await setup();
      await ext.local.set(PENDING_KEY, [pendingRecord({state})]);
      expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('send-open');
      expect(await vault(ext)).toEqual(STORED);
      expect(await getSession(ext)).toBeNull();
      expect((await readPending(ext)).map(r => r.state)).toEqual([state]);
      await ext.local.set(PENDING_KEY, [pendingRecord({state: 'expired'})]);
      expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    }
  });

  it('a send written by a send that passed its session check before the lock, landing DURING the pending check, is never deleted', async () => {
    const {ext, deps} = await setup();
    const get = ext.local.get.bind(ext.local);
    let injected: Promise<unknown> | undefined;
    ext.local.get = async key => {
      const v = await get(key);
      // The first pending read after the lock: submitSigned appends its record now, through the store's
      // mutex, and this read gives it a moment to land. Atomic (the real step 4): the append waits for the
      // clear and lands after it. A check-then-remove would let it land in between and delete it.
      if (key === PENDING_KEY && injected === undefined && (await getSession(ext)) === null) {
        injected = updatePending(ext, rs => [...rs, pendingRecord({id: 'late', account: ACCOUNT.publicKey})]);
        await Promise.race([injected, new Promise(resolve => setTimeout(resolve, 50))]);
      }
      return v;
    };
    const r = await forgetWallet(ext, deps, {expectedRevision: REV});
    await injected;
    expect(r).toBe('forgotten');
    expect((await readPending(ext)).map(x => x.id)).toEqual(['late']);
    // It confirms later: its recipient must not become "known" to whatever wallet comes next (review M1).
    deps.reader = fakeReader({getSignatureStatuses: async () => [{err: null, confirmationStatus: 'confirmed'}], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
    expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
  });
});

describe('vault.forgetWallet — one serial section (R2-M1)', () => {
  it('an envelope write landing after the lock makes it busy, and the vault holds that write untouched', async () => {
    const {ext, deps} = await setup();
    const clear = ext.session.clear.bind(ext.session);
    const OTHER = {...STORED, seed: {iv: B(12, 5), ct: B(48, 6)}};
    ext.session.clear = async () => {
      await clear();
      await ext.local.set(VAULT_KEY, OTHER); // a writer outside the section (an older page, a bug)
    };
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('busy');
    expect(await vault(ext)).toEqual(OTHER);
  });

  it('an unlock landing after the lock is refused as unlocked (review L4), and the vault is byte-identical', async () => {
    const {ext, deps} = await setup();
    const clear = ext.session.clear.bind(ext.session);
    ext.session.clear = async () => {
      await clear();
      void setSession(ext, [ACCOUNT]); // vault.setKeys does not take serial
    };
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('unlocked');
    expect(JSON.stringify(await vault(ext))).toBe(JSON.stringify(STORED));
  });

  it('a storeEnvelope issued mid-forget waits for it (the same mutex), then finds no wallet', async () => {
    const {ext, deps} = await setup();
    const clear = ext.session.clear.bind(ext.session);
    let store: Promise<unknown> | undefined;
    ext.session.clear = async () => {
      await clear();
      store = storeEnvelope(ext, REV, {...STORED, seed: {iv: B(12, 5), ct: B(48, 6)}});
    };
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await store).toBe('no-wallet');
    expect(await vault(ext)).toBeUndefined();
  });

  it('the vault write is the commit point: a failed cleanup after it still answers forgotten (review M2)', async () => {
    const {ext, deps} = await setup();
    const remove = ext.local.remove.bind(ext.local);
    ext.local.remove = async key => {
      if (key === SETTINGS_KEY) throw new Error('quota');
      return remove(key);
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await vault(ext)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a storage failure before the vault write leaves the vault in place', async () => {
    const {ext, deps} = await setup();
    await ext.local.set(PENDING_KEY, []);
    const set = ext.local.set.bind(ext.local);
    ext.local.set = async (key, value) => {
      if (key === PENDING_KEY) throw new Error('quota');
      return set(key, value);
    };
    expect(await handleMessage(ext, {type: 'vault.forgetWallet', expectedRevision: REV}, from('/unlock.html'), deps)).toEqual({ok: false, error: 'failed'});
    expect(await vault(ext)).toEqual(STORED);
  });
});

describe('vault.forgetWallet — the unfunded guard (C6)', () => {
  const NOC = WALLET_TOKENS.NOC.mint as string;
  const USDC = WALLET_TOKENS.USDC.mint as string;
  const USDT = WALLET_TOKENS.USDT.mint as string;
  const holding = (mint: string) => async (owner: string) => (owner === K1 ? [{pubkey: 'a', mint, owner, amount: 1n, decimals: 6}] : []);

  it('reads every account; any of the four tokens anywhere is funded — nothing changed, not locked', async () => {
    const readers = [
      fakeReader({getBalance: async owner => (owner === K1 ? 1n : 0n), getTokenAccountsByOwner: async () => []}),
      fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: holding(NOC)}),
      fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: holding(USDC)}),
      fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: holding(USDT)}),
    ];
    for (const reader of readers) {
      const {ext, deps} = await setup(reader);
      expect(await forgetWallet(ext, deps, {expectedRevision: REV, guard: 'unfunded'})).toBe('funded');
      expect(await vault(ext)).toEqual(STORED);
      expect(await getSession(ext)).not.toBeNull();
    }
  });

  it('funds arriving after #40 rendered empty are caught at the moment of deletion', async () => {
    let credited = false;
    const reader = fakeReader({getBalance: async owner => (credited && owner === ACCOUNT.publicKey ? 5n : 0n), getTokenAccountsByOwner: async () => []});
    const {ext, deps} = await setup(reader);
    credited = true;
    expect(await forgetWallet(ext, deps, {expectedRevision: REV, guard: 'unfunded'})).toBe('funded');
  });

  it('a failed read is unreachable, a 403 coordinator-refused — fail closed, nothing changed', async () => {
    for (const [e, code] of [[new RequestUnreachable('u', 'x'), 'unreachable'], [new Error('boom'), 'unreachable'], [new RpcForbidden('getBalance'), 'coordinator-refused']] as const) {
      const reader = fakeReader({
        getBalance: async () => {
          throw e;
        },
        getTokenAccountsByOwner: async () => [],
      });
      const {ext, deps} = await setup(reader);
      expect(await forgetWallet(ext, deps, {expectedRevision: REV, guard: 'unfunded'})).toBe(code);
      expect(await vault(ext)).toEqual(STORED);
      expect(await getSession(ext)).not.toBeNull();
    }
  });

  it('all zero: deleted', async () => {
    const {ext, deps} = await setup();
    expect(await forgetWallet(ext, deps, {expectedRevision: REV, guard: 'unfunded'})).toBe('forgotten');
    expect(await vault(ext)).toBeUndefined();
  });
});

describe('a first write clears what a crashed delete left behind', () => {
  it('vault.storeEnvelope with expectedRevision null removes leftover known recipients, settings, contacts and caches (L1)', async () => {
    const ext = fakeExt();
    await ext.local.set(BALANCE_CACHE_KEY, {});
    await ext.local.set(PRICE_CACHE_KEY, {});
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
    await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 60, reauthUsdCents: 100000, selectedAccount: 0});
    await ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Left behind'}]);
    expect(await storeEnvelope(ext, null, STORED)).toBe('stored');
    expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
    expect(await ext.local.get(SETTINGS_KEY)).toBeUndefined();
    // B1b-2b E17: a book a crashed delete left behind never reaches the next wallet.
    expect(await ext.local.get(CONTACTS_KEY)).toBeUndefined();
    expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });
});

// Task 7 review, fix round 1.
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

describe('vault.forgetWallet — races with an unlock and a balance read (fix round 1)', () => {
  it('a vault.setKeys landing between the forget’s session check and its vault write never leaves the deleted wallet’s keys', async () => {
    const {ext, deps} = await setup();
    const remove = ext.local.remove.bind(ext.local);
    let setKeys: Promise<unknown> | undefined;
    ext.local.remove = async key => {
      if (key === VAULT_KEY && setKeys === undefined) {
        // forget has checked the session (none) and is about to remove the vault: an unlock arrives now.
        setKeys = handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT]}, from('/unlock.html'), deps);
        await settle();
      }
      return remove(key);
    };
    const r = await forgetWallet(ext, deps, {expectedRevision: REV});
    const k = await setKeys;
    expect(await getSession(ext)).toBeNull();
    // Totally ordered: the forget's section (session check + vault write) ran first, so the unlock's binding
    // read, under the same sessionMutex, finds no wallet.
    expect(r).toBe('forgotten');
    expect(k).toEqual({ok: false, error: 'unknown-account'});
    expect(await vault(ext)).toBeUndefined();
  });

  it('a wallet.balances whose envelope read straddles the forget leaves no balance of the deleted wallet', async () => {
    const {ext, deps} = await setup();
    const get = ext.local.get.bind(ext.local);
    let armed = true;
    let reached: () => void = () => undefined;
    const atRead = new Promise<void>(resolve => (reached = resolve));
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => (release = resolve));
    ext.local.get = async key => {
      const v = await get(key);
      if (key === VAULT_KEY && armed) {
        // The balance read's envelope read: it saw the old wallet, and its answer arrives late.
        armed = false;
        reached();
        await gate;
      }
      return v;
    };
    const popupPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
    const balances = handleMessage(ext, {type: 'wallet.balances', account: ACCOUNT.publicKey}, popupPage, deps);
    await atRead;
    const forget = forgetWallet(ext, deps, {expectedRevision: REV});
    await settle();
    release();
    expect(await forget).toBe('forgotten');
    await balances;
    expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
  });

  // Final review M5: v1_price_cache is written under the cache mutex, and only while a wallet exists.
  it('a wallet.prices whose answer lands after the forget leaves no price cache behind', async () => {
    const {ext} = await setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => (release = resolve));
    let asked: () => void = () => undefined;
    const inFlight = new Promise<void>(resolve => (asked = resolve));
    const deps = fakeDeps({
      reader: zero(),
      prices: async () => {
        asked();
        await gate;
        return {solana: 150, usdc: 1, usdt: 1};
      },
    });
    const popupPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
    const prices = handleMessage(ext, {type: 'wallet.prices'}, popupPage, deps);
    await inFlight;
    expect(await forgetWallet(ext, deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
    release();
    expect(await prices).toMatchObject({ok: true});
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });

  it('a wallet.prices whose wallet check straddles the forget leaves no price cache behind', async () => {
    const {ext} = await setup();
    const get = ext.local.get.bind(ext.local);
    let armed = false;
    let reached: () => void = () => undefined;
    const atRead = new Promise<void>(resolve => (reached = resolve));
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => (release = resolve));
    ext.local.get = async key => {
      const v = await get(key);
      if (key === VAULT_KEY && armed) {
        // The price write's wallet check: it saw the old wallet, and its answer arrives late.
        armed = false;
        reached();
        await gate;
      }
      return v;
    };
    const deps = fakeDeps({
      reader: zero(),
      prices: async () => {
        // Armed only once the prices are in: the next v1_vault read is the cache write's own check.
        armed = true;
        return {solana: 150, usdc: 1, usdt: 1};
      },
    });
    const popupPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
    const prices = handleMessage(ext, {type: 'wallet.prices'}, popupPage, deps);
    await atRead;
    const forget = forgetWallet(ext, deps, {expectedRevision: REV});
    await settle();
    release();
    expect(await forget).toBe('forgotten');
    expect(await prices).toMatchObject({ok: true});
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });

  it('a storage failure after the vault write (the poller restart) still answers ok', async () => {
    const {ext, deps} = await setup();
    const get = ext.local.get.bind(ext.local);
    ext.local.get = async key => {
      if (key === PENDING_KEY && (await get(VAULT_KEY)) === undefined) throw new Error('storage gone');
      return get(key);
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await handleMessage(ext, {type: 'vault.forgetWallet', expectedRevision: REV}, from('/unlock.html'), deps)).toEqual({ok: true});
    expect(await vault(ext)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a stored v1_vault that is not an object is stored-invalid, not no-wallet — nothing changed', async () => {
    for (const bad of [[], 'x', 5, null, true]) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, bad);
      await setSession(ext, [ACCOUNT]);
      expect(await forgetWallet(ext, fakeDeps(), {expectedRevision: REV})).toBe('stored-invalid');
      expect(await ext.local.get(VAULT_KEY)).toEqual(bad);
      expect(await getSession(ext)).not.toBeNull();
    }
  });
});

describe('vault.forgetWallet — the unfunded guard reads concurrently, bounded (fix round 1)', () => {
  const KEYS = ['K0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9'];
  const MANY = {...STORED, accounts: KEYS.map((publicKey, index) => ({index, name: `Account ${index + 1}`, publicKey}))};
  const MANY_REV = envelopeRevision(MANY as Parameters<typeof envelopeRevision>[0]);
  async function many(getBalance: (owner: string) => Promise<bigint>) {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, MANY);
    await setSession(ext, [ACCOUNT]);
    return {ext, deps: fakeDeps({reader: fakeReader({getBalance, getTokenAccountsByOwner: async () => []})})};
  }

  it('reads every account, several at a time but never more than GUARD_CONCURRENCY', async () => {
    let inFlight = 0;
    let peak = 0;
    const read: string[] = [];
    const {ext, deps} = await many(async owner => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--;
      read.push(owner);
      return 0n;
    });
    expect(await forgetWallet(ext, deps, {expectedRevision: MANY_REV, guard: 'unfunded'})).toBe('forgotten');
    expect([...read].sort()).toEqual([...KEYS].sort());
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(GUARD_CONCURRENCY);
  });

  it('precedence, whatever the order the answers arrive in: coordinator-refused > unreachable > funded', async () => {
    const cases: [Record<string, 'funded' | 'unreachable' | 'forbidden'>, ForgetResult][] = [
      [{K2: 'funded', K7: 'unreachable'}, 'unreachable'],
      [{K7: 'funded', K2: 'unreachable'}, 'unreachable'],
      [{K2: 'unreachable', K7: 'forbidden'}, 'coordinator-refused'],
      [{K2: 'forbidden', K7: 'unreachable'}, 'coordinator-refused'],
      [{K2: 'funded', K7: 'forbidden'}, 'coordinator-refused'],
      [{K2: 'funded', K9: 'funded'}, 'funded'],
    ];
    for (const [plan, expected] of cases) {
      for (const slowFirst of [true, false]) {
        const {ext, deps} = await many(async owner => {
          const what = plan[owner];
          // Vary which answer arrives first.
          await new Promise(resolve => setTimeout(resolve, what === undefined ? 1 : (owner === 'K2') === slowFirst ? 15 : 3));
          if (what === 'funded') return 1n;
          if (what === 'unreachable') throw new RequestUnreachable('u', 'x');
          if (what === 'forbidden') throw new RpcForbidden('getBalance');
          return 0n;
        });
        expect(await forgetWallet(ext, deps, {expectedRevision: MANY_REV, guard: 'unfunded'})).toBe(expected);
        expect(await ext.local.get(VAULT_KEY)).toEqual(MANY);
        expect(await getSession(ext)).not.toBeNull();
      }
    }
  });
});

describe('storeEnvelope on a stored v1_vault that is not an object (fix round 2)', () => {
  it('a revision write is stored-invalid, a first write is wallet-exists — nothing written', async () => {
    for (const bad of [[], 'x', 5, null, true]) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, bad);
      expect(await storeEnvelope(ext, REV, STORED)).toBe('stored-invalid');
      expect(await storeEnvelope(ext, null, STORED)).toBe('wallet-exists');
      expect(await ext.local.get(VAULT_KEY)).toEqual(bad);
    }
  });

  it('an absent v1_vault: a revision write is no-wallet, a first write is stored', async () => {
    const ext = fakeExt();
    expect(await storeEnvelope(ext, REV, STORED)).toBe('no-wallet');
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
    expect(await storeEnvelope(ext, null, STORED)).toBe('stored');
    expect(await ext.local.get(VAULT_KEY)).toEqual(STORED);
  });
});
