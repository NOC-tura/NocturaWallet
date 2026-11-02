import {createHash} from 'node:crypto';
import {VAULT_KEY, WALLET_DATA_KEYS, forgetDamaged, vaultReading} from '../accountsStore';
import {handleMessage} from '../messages';
import {SESSION_KEY, getSession, setSession} from '../session';
import {PENDING_KEY, readPending, updatePending} from '../pendingStore';
import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../balanceCache';
import {FORBIDDEN_UNTIL_KEY} from '../deps';
import {AUTOLOCK_ALARM, armAutolock} from '../autolock';
import {DELETABLE, F, breadth, edited, firstEncoder, fixtureEnvelope} from '../../shared/__tests__/vaultControls';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, pendingRecord} from './fixtures';

// B1e §2.4, §2.6: vault.forgetDamaged — the one removal of v1_vault without a password. The digest is computed here with
// node:crypto over JSON.stringify of the stored value, independently of src/shared/storedDigest.ts.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const from = (path: string) => ({id: ID, origin: ORIGIN, url: `${ORIGIN}${path}`});
const digestOf = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');
const UNREADABLE = edited(e => (e.seed = 'damaged'));
/** A second unreadable value, as a disk fault might leave in the first one's place. */
const OTHER_UNREADABLE = edited(e => (e.password = 'damaged'));

/** Every key of the wallet's data, the caches and the 403 cool-down, each holding something. */
async function withData(raw: unknown) {
  const ext = fakeExt();
  if (raw !== undefined) await ext.local.set(VAULT_KEY, raw);
  for (const key of WALLET_DATA_KEYS) await ext.local.set(key, [{of: key}]);
  await ext.local.set(BALANCE_CACHE_KEY, {});
  await ext.local.set(PRICE_CACHE_KEY, {});
  await ext.local.set(FORBIDDEN_UNTIL_KEY, 123);
  return ext;
}
const wiped = async (ext: ReturnType<typeof fakeExt>): Promise<Record<string, unknown>> => {
  const out: Record<string, unknown> = {};
  for (const key of [VAULT_KEY, ...WALLET_DATA_KEYS, PENDING_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) {
    const v = await ext.local.get(key);
    if (v !== undefined) out[key] = v;
  }
  return out;
};
const send = (ext: ReturnType<typeof fakeExt>, expectedDigest: unknown, path = '/unlock.html') => handleMessage(ext, {type: 'vault.forgetDamaged', expectedDigest}, from(path), fakeDeps());

describe('vault.forgetDamaged — who may ask', () => {
  it('only the vault page: refused from the popup, the UI tab, the approval window, another extension and a web page — nothing removed', async () => {
    const ext = await withData(UNREADABLE);
    const digest = digestOf(UNREADABLE);
    for (const path of ['/popup.html', '/wallet.html', '/approve.html']) expect(await send(ext, digest, path)).toEqual({ok: false, error: 'forbidden'});
    for (const sender of [
      {id: 'someotherextensionidxxxxxxxxxxxx', origin: ORIGIN, url: `${ORIGIN}/unlock.html`},
      {id: ID, origin: 'https://evil.example', url: 'https://evil.example/unlock.html'},
    ]) {
      expect(await handleMessage(ext, {type: 'vault.forgetDamaged', expectedDigest: digest}, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
    // Positive control: the same message from the vault page removes it.
    expect(await send(ext, digest)).toEqual({ok: true});
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('malformed digests are refused before anything is read: 63 hex, 65 hex, upper case, not a string, absent', async () => {
    const ext = await withData(UNREADABLE);
    await setSession(ext, [ACCOUNT]);
    const digest = digestOf(UNREADABLE);
    for (const bad of [digest.slice(1), `${digest}0`, digest.toUpperCase(), 7, null, undefined]) {
      expect(await forgetDamaged(ext, {expectedDigest: bad})).toBe('malformed');
      expect(await send(ext, bad)).toEqual({ok: false, error: 'malformed'});
    }
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
    // Nothing was locked either.
    expect(await getSession(ext)).not.toBeNull();
  });
});

describe('vault.forgetDamaged — never a readable vault (§2.6: F0–F18, the breadth, the first encoder)', () => {
  it.each(F.map(([name, env]) => [name, env] as const))('%s → not-unreadable, v1_vault byte-identical, not locked', async (_name, env) => {
    const ext = await withData(env);
    await setSession(ext, [ACCOUNT]);
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(env)})).toBe('not-unreadable');
    expect(JSON.stringify(await ext.local.get(VAULT_KEY))).toBe(JSON.stringify(env));
    expect(await getSession(ext)).not.toBeNull();
    expect(Object.keys(await wiped(ext)).sort()).toEqual([VAULT_KEY, ...WALLET_DATA_KEYS, BALANCE_CACHE_KEY, PRICE_CACHE_KEY].sort());
  });

  it('a refused vault (F2–F8, F13–F17) and a wallet (F_WALLETS) answer the same through the message', async () => {
    for (const [name, env] of F) {
      const ext = await withData(env);
      expect([name, await send(ext, digestOf(env))]).toEqual([name, {ok: false, error: 'not-unreadable'}]);
      expect([name, JSON.stringify(await ext.local.get(VAULT_KEY))]).toEqual([name, JSON.stringify(env)]);
    }
  });

  it('every envelope the real encoder writes, and the first encoder’s output (458dfcd), → not-unreadable', async () => {
    for (const [name, env] of [...(await breadth()), ...firstEncoder()]) {
      const ext = await withData(env);
      expect([name, await forgetDamaged(ext, {expectedDigest: digestOf(env)})]).toEqual([name, 'not-unreadable']);
      expect([name, JSON.stringify(await ext.local.get(VAULT_KEY))]).toEqual([name, JSON.stringify(env)]);
    }
  }, 60_000);
});

describe('vault.forgetDamaged — an unreadable vault (§2.6: every deletable control)', () => {
  it.each(DELETABLE.map(([name, raw]) => [name, raw] as const))('%s → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept', async (_name, raw) => {
    const ext = await withData(raw);
    await ext.local.set(PENDING_KEY, [pendingRecord({state: 'confirmed'}), pendingRecord({id: 'r2', state: 'expired'})]);
    expect(vaultReading(raw).kind).toBe('unreadable');
    expect(await send(ext, digestOf(raw))).toEqual({ok: true});
    expect(await wiped(ext)).toEqual({v1_pending: []});
    expect(await readPending(ext)).toEqual([]);
    expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
  });

  it('a session present at the click is locked first (step 3), then the vault removed', async () => {
    const ext = await withData(UNREADABLE);
    await setSession(ext, [ACCOUNT]);
    await armAutolock(ext);
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(true);
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('forgotten');
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('no wallet: no-wallet, nothing removed', async () => {
    const ext = await withData(undefined);
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('no-wallet');
    expect(Object.keys(await wiped(ext)).sort()).toEqual([...WALLET_DATA_KEYS, BALANCE_CACHE_KEY, PRICE_CACHE_KEY].sort());
  });

  it('two removal tabs confirming at once: one is forgotten, the other waits for it and finds no wallet', async () => {
    const ext = await withData(UNREADABLE);
    const digest = digestOf(UNREADABLE);
    expect(await Promise.all([send(ext, digest), send(ext, digest)])).toEqual([{ok: true}, {ok: false, error: 'no-wallet'}]);
    expect(await wiped(ext)).toEqual({v1_pending: []});
  });
});

describe('vault.forgetDamaged — the digest (C2)', () => {
  it('the digest of another value: busy, nothing removed, not locked', async () => {
    const ext = await withData(UNREADABLE);
    await setSession(ext, [ACCOUNT]);
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(OTHER_UNREADABLE)})).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
    expect(await getSession(ext)).not.toBeNull();
  });

  it('the same object in another key order is another text: busy (fails closed)', async () => {
    const ext = await withData(UNREADABLE);
    const reordered = Object.fromEntries(Object.entries(UNREADABLE).reverse());
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(reordered)})).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('an unreadable value replaced by another unreadable one after the lock (step 5): busy, the new value kept', async () => {
    const ext = await withData(UNREADABLE);
    const clear = ext.session.clear.bind(ext.session);
    ext.session.clear = async () => {
      await clear();
      await ext.local.set(VAULT_KEY, OTHER_UNREADABLE); // a writer outside the section (a disk fault, a bug)
    };
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(OTHER_UNREADABLE);
    expect(Object.keys(await wiped(ext))).toContain(WALLET_DATA_KEYS[0]);
  });

  it('an unreadable value replaced by a wallet after the lock (step 5): busy, the wallet kept', async () => {
    const ext = await withData(UNREADABLE);
    const clear = ext.session.clear.bind(ext.session);
    const wallet = fixtureEnvelope();
    ext.session.clear = async () => {
      await clear();
      await ext.local.set(VAULT_KEY, wallet);
    };
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(wallet);
  });
});

describe('vault.forgetDamaged — a send still open, a session back (E12, step 6)', () => {
  it('send-open for a pending and for a stuck record: locked, the vault and the record kept; removed once it settles', async () => {
    for (const state of ['pending', 'stuck'] as const) {
      const ext = await withData(UNREADABLE);
      await setSession(ext, [ACCOUNT]);
      await ext.local.set(PENDING_KEY, [pendingRecord({state})]);
      expect(await send(ext, digestOf(UNREADABLE))).toEqual({ok: false, error: 'send-open'});
      expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
      expect(await getSession(ext)).toBeNull();
      expect((await readPending(ext)).map(r => r.state)).toEqual([state]);
      expect(Object.keys(await wiped(ext))).toEqual(expect.arrayContaining([...WALLET_DATA_KEYS]));
      await ext.local.set(PENDING_KEY, [pendingRecord({state: 'expired'})]);
      expect(await send(ext, digestOf(UNREADABLE))).toEqual({ok: true});
      expect(await wiped(ext)).toEqual({v1_pending: []});
    }
  });

  it('a session written into the session store after the lock (as a disk fault would leave one): unlocked, the vault byte-identical', async () => {
    const ext = await withData(UNREADABLE);
    const clear = ext.session.clear.bind(ext.session);
    ext.session.clear = async () => {
      await clear();
      // Inside lock()'s sessionMutex section: queued behind it, so it lands before the removal's section (step 6).
      void setSession(ext, [ACCOUNT]);
    };
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('unlocked');
    expect(JSON.stringify(await ext.local.get(VAULT_KEY))).toBe(JSON.stringify(UNREADABLE));
    expect(Object.keys(await wiped(ext))).toEqual(expect.arrayContaining([...WALLET_DATA_KEYS]));
  });

  it('a send appended by one that passed its session check before the lock, landing during the pending check, is kept', async () => {
    const ext = await withData(UNREADABLE);
    await setSession(ext, [ACCOUNT]);
    const get = ext.local.get.bind(ext.local);
    let injected: Promise<unknown> | undefined;
    ext.local.get = async key => {
      const v = await get(key);
      if (key === PENDING_KEY && injected === undefined && (await getSession(ext)) === null) {
        injected = updatePending(ext, rs => [...rs, pendingRecord({id: 'late', account: ACCOUNT.publicKey})]);
        await Promise.race([injected, new Promise(resolve => setTimeout(resolve, 50))]);
      }
      return v;
    };
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('forgotten');
    await injected;
    expect((await readPending(ext)).map(r => r.id)).toEqual(['late']);
  });
});

describe('vault.forgetDamaged — storage failures', () => {
  it('a failure before the removal leaves the vault in place: failed', async () => {
    const ext = await withData(UNREADABLE);
    await ext.local.set(PENDING_KEY, []);
    const set = ext.local.set.bind(ext.local);
    ext.local.set = async (key, value) => {
      if (key === PENDING_KEY) throw new Error('quota');
      return set(key, value);
    };
    expect(await send(ext, digestOf(UNREADABLE))).toEqual({ok: false, error: 'failed'});
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('the removal is the commit point: a failed cleanup after it still answers forgotten', async () => {
    const ext = await withData(UNREADABLE);
    const remove = ext.local.remove.bind(ext.local);
    ext.local.remove = async key => {
      if (key === WALLET_DATA_KEYS[0]) throw new Error('quota');
      return remove(key);
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await send(ext, digestOf(UNREADABLE))).toEqual({ok: true});
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('without deps the message is unavailable and nothing is read', async () => {
    const ext = await withData(UNREADABLE);
    expect(await handleMessage(ext, {type: 'vault.forgetDamaged', expectedDigest: digestOf(UNREADABLE)}, from('/unlock.html'))).toEqual({ok: false, error: 'unavailable'});
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });
});
