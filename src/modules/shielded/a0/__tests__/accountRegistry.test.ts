/**
 * The account registry (spec §10, S5, S9; §6.1 the fresh rule and the `fresh-pending`
 * reservation, I-5; §14 "multi-account derivation equal to the extension's for slip10:0..3; the
 * registry rules (cli single, lowest free index, no renumbering of main)").
 *
 * THE VECTORS are not the code under test's: `fixtures/a0-account-vectors.json` is written by
 * `scripts/a0-vectors/gen-account-vectors.mjs` from Node's own crypto (PBKDF2, HMAC-SHA512, OpenSSL
 * Ed25519) and its own base58 — it imports neither `core/keys/transparent.ts` nor
 * micro-key-producer nor @noble — and is anchored to HAgk14… (the extension's published vector).
 *
 * THE RPC is a fake `getSignaturesForAddress` with a set of addresses that have history; every
 * call is recorded. The real @solana/web3.js is loaded (`__testing__/realWeb3.ts`), so the
 * `PublicKey` the registry encodes with and hands to the RPC is the real one.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../../constants/mmkvKeys';
import {storeTransparentScheme} from '../../../keyDerivation/derivationScheme';
import {
  A0_ACCOUNT_DISCOVERY_GAP,
  A0_FRESH_HISTORY_SKIP_LIMIT,
  A0_MAX_ACCOUNTS,
  A0AccountRegistryError,
  a0AccountAddress,
  a0SeedPublicKeys,
  addA0RecoveredExitAccounts,
  hasA0AccountRegistry,
  loadA0AccountRegistry,
  markA0AccountsLinked,
  onA0AccountPromoted,
  openA0AccountRegistry,
  parseA0Scheme,
  promoteA0FreshAccount,
  releaseA0FreshAccount,
  reserveA0FreshAccount,
  resetA0ReservationsForTests,
} from '../accountRegistry';
import type {A0AccountEntry, A0HistoryRpc} from '../accountRegistry';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);

interface Vectors {
  anchor: {mnemonic: string; scheme: string; address: string};
  seeds: {mnemonic: string; seed: string; accounts: {scheme: string; address: string}[]}[];
}
const VECTORS = JSON.parse(readFileSync(join(__dirname, 'fixtures/a0-account-vectors.json'), 'utf8')) as Vectors;
const ABANDON = VECTORS.seeds[0]!;
const ZOO = VECTORS.seeds[1]!;
const seedOf = (v: typeof ABANDON): Uint8Array => Uint8Array.from(Buffer.from(v.seed, 'hex'));
const addr = (v: typeof ABANDON, scheme: string): string => v.accounts.find(a => a.scheme === scheme)!.address;
const KEY = 'v1_accounts';

/** A fake history RPC: `withHistory` addresses answer one signature; every call recorded. */
function historyRpc(withHistory: ReadonlySet<string> = new Set(), hold?: Promise<void>) {
  const calls: {address: string; config: unknown; commitment: unknown}[] = [];
  const rpc: A0HistoryRpc = {
    getSignaturesForAddress: (async (address: {toBase58(): string}, config?: unknown, commitment?: unknown) => {
      calls.push({address: address.toBase58(), config, commitment});
      if (hold) {
        await hold;
      }
      return withHistory.has(address.toBase58())
        ? [{signature: '5'.repeat(88), slot: 1, err: null, memo: null, blockTime: 1}]
        : [];
    }) as unknown as A0HistoryRpc['getSignaturesForAddress'],
  };
  return {rpc, calls};
}

const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (e instanceof A0AccountRegistryError) {
      return e.code;
    }
    throw e;
  }
  throw new Error('did not throw');
};
const codeAsync = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    if (e instanceof A0AccountRegistryError) {
      return e.code;
    }
    throw e;
  }
  throw new Error('did not reject');
};
/** Let microtasks run until `cond` holds (the reservation reached its history request). */
async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !cond(); i++) {
    await Promise.resolve();
  }
  if (!cond()) {
    throw new Error('the condition never held');
  }
}
const raw = (): unknown => JSON.parse(mmkvSecure()!.getString(KEY)!);
const setRaw = (accounts: unknown[], extra: Record<string, unknown> = {}): void => {
  mmkvSecure()!.set(KEY, JSON.stringify({schema: 1, accounts, ...extra}));
};
const entry = (v: typeof ABANDON, scheme: string, role: string): A0AccountEntry =>
  ({scheme, role, address: addr(v, scheme)}) as A0AccountEntry;

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
  resetA0ReservationsForTests();
});

describe('derivation (§10, §14): equal to the offline vectors, never computed by the code under test', () => {
  it('the vector file is anchored to the extension\'s published slip10:0 and to the A0 key vectors\' seed', () => {
    expect(VECTORS.anchor).toEqual({
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      scheme: 'slip10:0',
      address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    });
    expect(addr(ABANDON, 'slip10:0')).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    const keyVectors = JSON.parse(
      readFileSync(join(__dirname, '../../../../../native/noctura-prover/tests/fixtures/a0-key-vectors.json'), 'utf8'),
    ) as {seeds: {mnemonic?: string; seed: string}[]};
    for (const v of [ABANDON, ZOO]) {
      expect(keyVectors.seeds.find(s => s.mnemonic === v.mnemonic)?.seed).toBe(v.seed);
    }
  });

  it.each([ABANDON, ZOO].flatMap(v => v.accounts.map(a => [v.mnemonic.split(' ')[0]!, a.scheme, a.address] as const)))(
    '%s / %s = %s',
    (word, scheme, address) => {
      const v = word === 'abandon' ? ABANDON : ZOO;
      expect(a0AccountAddress(seedOf(v), parseA0Scheme(scheme)!)).toBe(address);
    },
  );

  it('control: another seed\'s vector does not match (the comparison can fail)', () => {
    expect(a0AccountAddress(seedOf(ZOO), {kind: 'slip10', account: 0})).not.toBe(addr(ABANDON, 'slip10:0'));
  });

  it('parses scheme strings strictly: slip10:0 … slip10:2147483647 and cli; nothing else (no default)', () => {
    expect(parseA0Scheme('cli')).toEqual({kind: 'cli'});
    expect(parseA0Scheme('slip10:0')).toEqual({kind: 'slip10', account: 0});
    expect(parseA0Scheme('slip10:2147483647')).toEqual({kind: 'slip10', account: 2147483647});
    for (const bad of ['slip10:2147483648', 'slip10:01', 'slip10:-1', 'slip10:1.5', 'slip10:', 'slip10: 1', 'CLI', '', null, 3]) {
      expect(parseA0Scheme(bad)).toBeNull();
    }
  });

  it('refuses a seed that is not 64 bytes and an index past 2^31 − 1', () => {
    expect(code(() => a0AccountAddress(new Uint8Array(32), {kind: 'slip10', account: 0}))).toBe('E_A0_ACCOUNTS_INVALID');
    expect(code(() => a0AccountAddress(seedOf(ABANDON), {kind: 'slip10', account: 2 ** 31}))).toBe('E_A0_ACCOUNTS_INVALID');
  });
});

describe('the record (§10): encrypted instance, created with its main by a holder of the seed, fail closed', () => {
  it('no record is null, not an empty list; open creates [main] in the ENCRYPTED instance only', () => {
    expect(hasA0AccountRegistry()).toBe(false);
    expect(loadA0AccountRegistry()).toBeNull();
    const publicKeys = mmkvPublic.getAllKeys();
    expect(openA0AccountRegistry(seedOf(ABANDON))).toEqual([entry(ABANDON, 'slip10:0', 'main')]);
    expect(raw()).toEqual({schema: 1, accounts: [{scheme: 'slip10:0', role: 'main', address: addr(ABANDON, 'slip10:0')}]});
    expect(mmkvPublic.getAllKeys()).toEqual(publicKeys);
    expect(MMKV_KEYS.ACCOUNTS_REGISTRY).toBe(KEY);
  });

  it('the record holds public values only — no seed, no secret key', () => {
    openA0AccountRegistry(seedOf(ABANDON));
    const text = mmkvSecure()!.getString(KEY)!;
    expect(text).not.toContain(ABANDON.seed);
    expect(text).not.toContain(ABANDON.seed.slice(0, 64));
  });

  it('without the encrypted instance every call refuses (E_A0_STORE_LOCKED)', async () => {
    clearAllStores();
    expect(code(() => loadA0AccountRegistry())).toBe('E_A0_STORE_LOCKED');
    expect(code(() => openA0AccountRegistry(seedOf(ABANDON)))).toBe('E_A0_STORE_LOCKED');
    expect(code(() => releaseA0FreshAccount('slip10:1'))).toBe('E_A0_STORE_LOCKED');
    const {rpc, calls} = historyRpc();
    expect(await codeAsync(reserveA0FreshAccount(rpc, seedOf(ABANDON)))).toBe('E_A0_STORE_LOCKED');
    expect(calls).toEqual([]);
  });

  const main0 = (): A0AccountEntry => entry(ABANDON, 'slip10:0', 'main');
  it.each<[string, () => void]>([
    ['not JSON', () => mmkvSecure()!.set(KEY, '{')],
    ['another top-level key', () => setRaw([main0()], {pool: 'x'})],
    ['schema 2', () => setRaw([main0()], {schema: 2})],
    ['no entry', () => setRaw([])],
    ['no main', () => setRaw([entry(ABANDON, 'slip10:0', 'fresh-exit')])],
    ['two mains', () => setRaw([main0(), entry(ABANDON, 'slip10:1', 'main')])],
    ['two entries with one index', () => setRaw([main0(), {...entry(ABANDON, 'slip10:1', 'fresh-exit'), scheme: 'slip10:0'}])],
    ['a cli main with another entry', () => setRaw([entry(ABANDON, 'cli', 'main'), entry(ABANDON, 'slip10:1', 'fresh-exit')])],
    ['a cli entry that is not the main', () => setRaw([main0(), entry(ABANDON, 'cli', 'fresh-exit')])],
    ['index 2^31', () => setRaw([main0(), {scheme: 'slip10:2147483648', role: 'fresh-exit', address: addr(ABANDON, 'slip10:1')}])],
    ['a non-canonical index', () => setRaw([main0(), {...entry(ABANDON, 'slip10:1', 'fresh-exit'), scheme: 'slip10:01'}])],
    ['an unknown role', () => setRaw([main0(), {...entry(ABANDON, 'slip10:1', 'fresh-exit'), role: 'exit'}])],
    ['an address that is not a key', () => setRaw([{...main0(), address: '1111'}])],
    ['an entry with a field §10 does not list', () => setRaw([{...main0(), name: 'Account 1'}])],
    ['101 entries', () => setRaw([main0(), ...Array.from({length: 100}, (_x, i) => ({scheme: `slip10:${i + 1}`, role: 'fresh-exit', address: addr(ZOO, 'slip10:0')}))])],
  ])('a record with %s is CORRUPT — never read as empty', (_what, plant) => {
    plant();
    expect(code(() => loadA0AccountRegistry())).toBe('E_A0_ACCOUNTS_CORRUPT');
    expect(code(() => openA0AccountRegistry(seedOf(ABANDON)))).toBe('E_A0_ACCOUNTS_CORRUPT');
  });

  it('control: the same shape with valid values decodes', () => {
    setRaw([main0(), entry(ABANDON, 'slip10:1', 'fresh-exit'), entry(ABANDON, 'slip10:2', 'fresh-pending')]);
    expect(loadA0AccountRegistry()).toHaveLength(3);
  });

  it('a stored address the seed does not derive refuses (E_A0_ACCOUNTS_SEED); so does another wallet\'s seed', () => {
    setRaw([main0(), {...entry(ABANDON, 'slip10:1', 'fresh-exit'), address: addr(ABANDON, 'slip10:2')}]);
    expect(code(() => a0SeedPublicKeys(seedOf(ABANDON)))).toBe('E_A0_ACCOUNTS_SEED');
    setRaw([main0()]);
    expect(code(() => a0SeedPublicKeys(seedOf(ZOO)))).toBe('E_A0_ACCOUNTS_SEED');
    expect(a0SeedPublicKeys(seedOf(ABANDON))).toEqual([addr(ABANDON, 'slip10:0'), addr(ABANDON, 'cli')]);
  });

  it('a registry whose main is not the wallet\'s scheme refuses (E_A0_ACCOUNTS_MAIN)', () => {
    openA0AccountRegistry(seedOf(ABANDON));
    storeTransparentScheme({kind: 'slip10', account: 1});
    expect(code(() => openA0AccountRegistry(seedOf(ABANDON)))).toBe('E_A0_ACCOUNTS_MAIN');
  });
});

describe('the fresh rule (§6.1, §10): lowest free index across every role, then the history check', () => {
  it('reserves slip10:1 beside a slip10:0 main, as fresh-pending, after ONE history request at confirmed', async () => {
    const {rpc, calls} = historyRpc();
    const got = await reserveA0FreshAccount(rpc, seedOf(ABANDON));
    expect(got).toEqual(entry(ABANDON, 'slip10:1', 'fresh-pending'));
    expect(calls).toEqual([{address: addr(ABANDON, 'slip10:1'), config: {limit: 1}, commitment: 'confirmed'}]);
    expect(loadA0AccountRegistry()).toEqual([entry(ABANDON, 'slip10:0', 'main'), got]);
  });

  it('the lowest index not taken under ANY role: main 0, exit 1, pending 3 → 2, then 4', async () => {
    setRaw([entry(ABANDON, 'slip10:0', 'main'), entry(ABANDON, 'slip10:1', 'fresh-exit'), entry(ABANDON, 'slip10:3', 'fresh-pending')]);
    const {rpc} = historyRpc();
    expect((await reserveA0FreshAccount(rpc, seedOf(ABANDON))).scheme).toBe('slip10:2');
    expect((await reserveA0FreshAccount(rpc, seedOf(ABANDON))).scheme).toBe('slip10:4');
  });

  it('a main of slip10:3 stays slip10:3: the fresh account is slip10:0, and promote / release never touch the main', async () => {
    storeTransparentScheme({kind: 'slip10', account: 3});
    const {rpc} = historyRpc();
    const got = await reserveA0FreshAccount(rpc, seedOf(ABANDON));
    expect(got.scheme).toBe('slip10:0');
    expect(promoteA0FreshAccount('slip10:0')).toBe('promoted');
    const next = await reserveA0FreshAccount(rpc, seedOf(ABANDON));
    expect(next.scheme).toBe('slip10:1');
    expect(releaseA0FreshAccount('slip10:1')).toBe(true);
    expect(loadA0AccountRegistry()).toEqual([entry(ABANDON, 'slip10:3', 'main'), entry(ABANDON, 'slip10:0', 'fresh-exit')]);
    expect(code(() => promoteA0FreshAccount('slip10:3'))).toBe('E_A0_ACCOUNTS_STATE');
    expect(code(() => releaseA0FreshAccount('slip10:3'))).toBe('E_A0_ACCOUNTS_STATE');
  });

  it('a cli wallet gets no fresh index (S9): refused before any request, the registry stays [cli main]', async () => {
    storeTransparentScheme({kind: 'cli'});
    const {rpc, calls} = historyRpc();
    expect(await codeAsync(reserveA0FreshAccount(rpc, seedOf(ABANDON)))).toBe('E_A0_ACCOUNTS_CLI');
    expect(calls).toEqual([]);
    expect(loadA0AccountRegistry()).toEqual([entry(ABANDON, 'cli', 'main')]);
    expect(a0SeedPublicKeys(seedOf(ABANDON))).toEqual([addr(ABANDON, 'cli'), addr(ABANDON, 'slip10:0')]);
  });

  it('an index whose address has history is skipped; the next one is checked and reserved', async () => {
    const {rpc, calls} = historyRpc(new Set([addr(ABANDON, 'slip10:1'), addr(ABANDON, 'slip10:2')]));
    expect((await reserveA0FreshAccount(rpc, seedOf(ABANDON))).scheme).toBe('slip10:3');
    expect(calls.map(c => c.address)).toEqual(['slip10:1', 'slip10:2', 'slip10:3'].map(s => addr(ABANDON, s)));
  });

  it(`${A0_FRESH_HISTORY_SKIP_LIMIT} candidates with history refuse (E_A0_ACCOUNTS_NO_FRESH), nothing written; ${A0_FRESH_HISTORY_SKIP_LIMIT - 1} do not`, async () => {
    const seed = seedOf(ABANDON);
    const used = (k: number) => new Set(Array.from({length: k}, (_x, i) => a0AccountAddress(seed, {kind: 'slip10', account: i + 1})));
    const all = historyRpc(used(A0_FRESH_HISTORY_SKIP_LIMIT));
    expect(await codeAsync(reserveA0FreshAccount(all.rpc, seed))).toBe('E_A0_ACCOUNTS_NO_FRESH');
    expect(all.calls).toHaveLength(A0_FRESH_HISTORY_SKIP_LIMIT);
    expect(loadA0AccountRegistry()).toEqual([entry(ABANDON, 'slip10:0', 'main')]);
    const fewer = historyRpc(used(A0_FRESH_HISTORY_SKIP_LIMIT - 1));
    expect((await reserveA0FreshAccount(fewer.rpc, seed)).scheme).toBe(`slip10:${A0_FRESH_HISTORY_SKIP_LIMIT}`);
  });

  it('a history check that fails or answers no list reserves nothing', async () => {
    const failing: A0HistoryRpc = {
      getSignaturesForAddress: (() => Promise.reject(new Error('429'))) as unknown as A0HistoryRpc['getSignaturesForAddress'],
    };
    await expect(reserveA0FreshAccount(failing, seedOf(ABANDON))).rejects.toThrow('429');
    const odd: A0HistoryRpc = {
      getSignaturesForAddress: (() => Promise.resolve({})) as unknown as A0HistoryRpc['getSignaturesForAddress'],
    };
    expect(await codeAsync(reserveA0FreshAccount(odd, seedOf(ABANDON)))).toBe('E_A0_ACCOUNTS_RPC');
    expect(loadA0AccountRegistry()).toEqual([entry(ABANDON, 'slip10:0', 'main')]);
  });

  it('a second reservation started while the first is in flight picks the NEXT index (I-5)', async () => {
    let open!: () => void;
    const hold = new Promise<void>(r => {
      open = r;
    });
    const {rpc, calls} = historyRpc(new Set(), hold);
    const first = reserveA0FreshAccount(rpc, seedOf(ABANDON));
    const second = reserveA0FreshAccount(rpc, seedOf(ABANDON));
    await until(() => calls.length === 1);
    open();
    expect([(await first).scheme, (await second).scheme]).toEqual(['slip10:1', 'slip10:2']);
    expect(calls.map(c => c.address)).toEqual([addr(ABANDON, 'slip10:1'), addr(ABANDON, 'slip10:2')]);
    expect(loadA0AccountRegistry()!.map(e => [e.scheme, e.role])).toEqual([
      ['slip10:0', 'main'],
      ['slip10:1', 'fresh-pending'],
      ['slip10:2', 'fresh-pending'],
    ]);
  });

  it('a restore that takes the candidate during the history check: the reservation moves to the next index', async () => {
    let open!: () => void;
    const hold = new Promise<void>(r => {
      open = r;
    });
    const {rpc, calls} = historyRpc(new Set(), hold);
    const p = reserveA0FreshAccount(rpc, seedOf(ABANDON));
    await until(() => calls.length === 1);
    expect(addA0RecoveredExitAccounts([1], seedOf(ABANDON))).toEqual(['slip10:1']);
    open();
    expect((await p).scheme).toBe('slip10:2');
  });

  it(`a full registry (${A0_MAX_ACCOUNTS} entries) refuses before any request; ${A0_MAX_ACCOUNTS - 1} take one more`, async () => {
    const seed = seedOf(ABANDON);
    const fill = (k: number) =>
      setRaw([
        entry(ABANDON, 'slip10:0', 'main'),
        ...Array.from({length: k - 1}, (_x, i) => ({scheme: `slip10:${i + 1}`, role: 'fresh-exit', address: a0AccountAddress(seed, {kind: 'slip10', account: i + 1})})),
      ]);
    fill(A0_MAX_ACCOUNTS);
    const full = historyRpc();
    expect(await codeAsync(reserveA0FreshAccount(full.rpc, seed))).toBe('E_A0_ACCOUNTS_FULL');
    expect(full.calls).toEqual([]);
    fill(A0_MAX_ACCOUNTS - 1);
    expect((await reserveA0FreshAccount(historyRpc().rpc, seed)).scheme).toBe(`slip10:${A0_MAX_ACCOUNTS - 1}`);
    expect(loadA0AccountRegistry()).toHaveLength(A0_MAX_ACCOUNTS);
  });
});

describe('promote / release (§6.8) and the binding (R3-N5)', () => {
  it('promote: fresh-pending → fresh-exit; again → already; unknown → UNKNOWN', async () => {
    await reserveA0FreshAccount(historyRpc().rpc, seedOf(ABANDON));
    expect(promoteA0FreshAccount('slip10:1')).toBe('promoted');
    expect(promoteA0FreshAccount('slip10:1')).toBe('already');
    expect(loadA0AccountRegistry()![1]).toEqual(entry(ABANDON, 'slip10:1', 'fresh-exit'));
    expect(code(() => promoteA0FreshAccount('slip10:7'))).toBe('E_A0_ACCOUNTS_UNKNOWN');
  });

  it('release: a fresh-pending entry is removed and its index is handed out again; absent → false; fresh-exit → STATE', async () => {
    const {rpc} = historyRpc();
    await reserveA0FreshAccount(rpc, seedOf(ABANDON));
    expect(releaseA0FreshAccount('slip10:1')).toBe(true);
    expect(releaseA0FreshAccount('slip10:1')).toBe(false);
    expect(loadA0AccountRegistry()).toEqual([entry(ABANDON, 'slip10:0', 'main')]);
    expect((await reserveA0FreshAccount(rpc, seedOf(ABANDON))).scheme).toBe('slip10:1');
    promoteA0FreshAccount('slip10:1');
    expect(code(() => releaseA0FreshAccount('slip10:1'))).toBe('E_A0_ACCOUNTS_STATE');
  });

  it('a wipe + import during the history check: the reservation refuses (E_A0_STORE_CHANGED), the new store gains no record', async () => {
    let open!: () => void;
    const hold = new Promise<void>(r => {
      open = r;
    });
    const {rpc, calls} = historyRpc(new Set(), hold);
    const p = reserveA0FreshAccount(rpc, seedOf(ABANDON));
    await until(() => calls.length === 1);
    clearAllStores();
    initSecureMmkv('another-wallet');
    open();
    expect(await codeAsync(p)).toBe('E_A0_STORE_CHANGED');
    expect(mmkvSecure()!.getString(KEY)).toBeUndefined();
  });

  it('promote / release / open with a stale binding refuse before reading or writing', async () => {
    await reserveA0FreshAccount(historyRpc().rpc, seedOf(ABANDON));
    const old = mmkvSecure();
    const before = mmkvSecure()!.getString(KEY);
    initSecureMmkv('test-key'); // the same data, another instance object (an import of the same phrase)
    expect(code(() => promoteA0FreshAccount('slip10:1', {bound: old}))).toBe('E_A0_STORE_CHANGED');
    expect(code(() => releaseA0FreshAccount('slip10:1', {bound: old}))).toBe('E_A0_STORE_CHANGED');
    expect(code(() => openA0AccountRegistry(seedOf(ABANDON), {bound: old}))).toBe('E_A0_STORE_CHANGED');
    expect(mmkvSecure()!.getString(KEY)).toBe(before);
    expect(promoteA0FreshAccount('slip10:1', {bound: mmkvSecure()})).toBe('promoted');
  });
});

describe('M1c Task 7: the linked mark (a landed exit a key of this seed signed)', () => {
  it('promote with linked → fresh-exit + linked, stored and read back; an existing fresh-exit gains the mark ("already")', async () => {
    const {rpc} = historyRpc();
    await reserveA0FreshAccount(rpc, seedOf(ABANDON));
    expect(promoteA0FreshAccount('slip10:1', {linked: true})).toBe('promoted');
    expect(loadA0AccountRegistry()![1]).toEqual({...entry(ABANDON, 'slip10:1', 'fresh-exit'), linked: true});
    expect((raw() as {accounts: unknown[]}).accounts[1]).toEqual({scheme: 'slip10:1', role: 'fresh-exit', address: addr(ABANDON, 'slip10:1'), linked: true});
    await reserveA0FreshAccount(rpc, seedOf(ABANDON));
    expect(promoteA0FreshAccount('slip10:2')).toBe('promoted');
    expect(promoteA0FreshAccount('slip10:2', {linked: true})).toBe('already');
    expect(loadA0AccountRegistry()![2]).toEqual({...entry(ABANDON, 'slip10:2', 'fresh-exit'), linked: true});
    expect(promoteA0FreshAccount('slip10:2')).toBe('already'); // the mark is never removed
    expect(loadA0AccountRegistry()![2]!.linked).toBe(true);
  });
  it('a record with linked on a fresh-pending / main entry, or linked: false, does not decode (CORRUPT)', () => {
    for (const bad of [
      {...entry(ABANDON, 'slip10:1', 'fresh-pending'), linked: true},
      {...entry(ABANDON, 'slip10:1', 'fresh-exit'), linked: false},
    ]) {
      setRaw([entry(ABANDON, 'slip10:0', 'main'), bad]);
      expect(code(() => loadA0AccountRegistry())).toBe('E_A0_ACCOUNTS_CORRUPT');
    }
    setRaw([{...entry(ABANDON, 'slip10:0', 'main'), linked: true}]);
    expect(code(() => loadA0AccountRegistry())).toBe('E_A0_ACCOUNTS_CORRUPT');
  });
});

describe('the public-key set and the restore\'s writer (handed to Tasks 4–7)', () => {
  it('the public-key set is every entry\'s address — main, fresh-pending, fresh-exit — re-derived from the seed', async () => {
    const {rpc} = historyRpc();
    await reserveA0FreshAccount(rpc, seedOf(ABANDON));
    promoteA0FreshAccount('slip10:1');
    await reserveA0FreshAccount(rpc, seedOf(ABANDON));
    expect(a0SeedPublicKeys(seedOf(ABANDON))).toEqual(['slip10:0', 'slip10:1', 'slip10:2', 'cli'].map(s => addr(ABANDON, s)));
  });

  it('a wallet whose main is slip10 (slip10:3) still reports its cli key and slip10:0 — each once', () => {
    storeTransparentScheme({kind: 'slip10', account: 3});
    expect(a0SeedPublicKeys(seedOf(ABANDON))).toEqual(['slip10:3', 'cli', 'slip10:0'].map(s => addr(ABANDON, s)));
    expect(loadA0AccountRegistry()).toEqual([entry(ABANDON, 'slip10:3', 'main')]);
  });

  it('the reverse: a cli wallet still reports its slip10:0 key (and its cli key once)', () => {
    storeTransparentScheme({kind: 'cli'});
    const keys = a0SeedPublicKeys(seedOf(ZOO));
    expect(keys).toEqual([addr(ZOO, 'cli'), addr(ZOO, 'slip10:0')]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(loadA0AccountRegistry()).toEqual([entry(ZOO, 'cli', 'main')]);
  });

  it('recovered exits: added as fresh-exit, a fresh-pending one promoted, the main untouched, one write', async () => {
    storeTransparentScheme({kind: 'slip10', account: 3});
    await reserveA0FreshAccount(historyRpc().rpc, seedOf(ABANDON)); // slip10:0 pending
    const set = jest.spyOn(mmkvSecure()!, 'set');
    expect(addA0RecoveredExitAccounts([2, 0, 3, 2], seedOf(ABANDON))).toEqual(['slip10:0', 'slip10:2']);
    expect(set).toHaveBeenCalledTimes(1);
    expect(loadA0AccountRegistry()).toEqual([
      entry(ABANDON, 'slip10:3', 'main'),
      entry(ABANDON, 'slip10:0', 'fresh-exit'),
      entry(ABANDON, 'slip10:2', 'fresh-exit'),
    ]);
    expect(addA0RecoveredExitAccounts([0, 2], seedOf(ABANDON))).toEqual([]);
  });

  it('recovered exits refuse as a whole: a cli wallet, a bad index, more than 100 entries', () => {
    storeTransparentScheme({kind: 'cli'});
    expect(code(() => addA0RecoveredExitAccounts([0], seedOf(ABANDON)))).toBe('E_A0_ACCOUNTS_CLI');
    expect(addA0RecoveredExitAccounts([], seedOf(ABANDON))).toEqual([]);
    clearAllStores();
    initSecureMmkv('test-key');
    storeTransparentScheme({kind: 'slip10', account: 0});
    expect(code(() => addA0RecoveredExitAccounts([2 ** 31], seedOf(ABANDON)))).toBe('E_A0_ACCOUNTS_INVALID');
    const many = Array.from({length: A0_MAX_ACCOUNTS}, (_x, i) => i + 1);
    expect(code(() => addA0RecoveredExitAccounts(many, seedOf(ABANDON)))).toBe('E_A0_ACCOUNTS_FULL');
    expect(loadA0AccountRegistry()).toEqual([entry(ABANDON, 'slip10:0', 'main')]);
  });

  it('the account-discovery gap stays 20 (controller ruling 7: S15 raised the deposit gap only)', () => {
    expect(A0_ACCOUNT_DISCOVERY_GAP).toBe(20);
  });
});

describe('post-M1d §4: markA0AccountsLinked (the tag after a confirmed own-account Send)', () => {
  const base = () =>
    setRaw([entry(ABANDON, 'slip10:0', 'main'), entry(ABANDON, 'slip10:1', 'fresh-exit'), entry(ABANDON, 'slip10:2', 'fresh-pending'), entry(ABANDON, 'slip10:3', 'fresh-exit')]);

  it('marks the matching fresh-exit entries only, returns how many changed, and the record still decodes', () => {
    base();
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:1')])).toBe(1);
    const stored = loadA0AccountRegistry()!;
    expect(stored[1]).toEqual({...entry(ABANDON, 'slip10:1', 'fresh-exit'), linked: true});
    expect(stored[3]!.linked).toBeUndefined(); // the other exit is untouched
  });

  it('never the main account, never a fresh-pending one (the validator forbids linked there)', () => {
    base();
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:0'), addr(ABANDON, 'slip10:2')])).toBe(0);
    const stored = loadA0AccountRegistry()!;
    expect(stored[0]!.linked).toBeUndefined();
    expect(stored[2]!.linked).toBeUndefined();
    expect(stored[2]!.role).toBe('fresh-pending');
  });

  it('idempotent: a second call changes nothing and writes nothing', () => {
    base();
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:1')])).toBe(1);
    const before = mmkvSecure()!.getString(KEY);
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:1')])).toBe(0);
    expect(mmkvSecure()!.getString(KEY)).toBe(before);
  });

  it('an address the registry does not know, an empty list, no record → 0', () => {
    base();
    expect(markA0AccountsLinked([addr(ZOO, 'slip10:1')])).toBe(0);
    expect(markA0AccountsLinked([])).toBe(0);
    mmkvSecure()!.remove(KEY);
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:1')])).toBe(0);
  });

  it('needs no seed, and fails closed: locked → E_A0_STORE_LOCKED, a corrupt record → E_A0_ACCOUNTS_CORRUPT, another instance → E_A0_STORE_CHANGED', () => {
    base();
    const bound = mmkvSecure();
    mmkvSecure()!.set(KEY, '{not json');
    expect(code(() => markA0AccountsLinked([addr(ABANDON, 'slip10:1')]))).toBe('E_A0_ACCOUNTS_CORRUPT');
    clearAllStores();
    expect(code(() => markA0AccountsLinked([addr(ABANDON, 'slip10:1')]))).toBe('E_A0_STORE_LOCKED');
    initSecureMmkv('other-key');
    expect(code(() => markA0AccountsLinked([addr(ABANDON, 'slip10:1')], {bound}))).toBe('E_A0_STORE_CHANGED');
  });
});

describe('post-M1d R3: onA0AccountPromoted', () => {
  it('fires after a fresh-pending → fresh-exit write (promote and a restore), not for "already", and a throwing listener never fails the promotion', () => {
    setRaw([entry(ABANDON, 'slip10:0', 'main'), entry(ABANDON, 'slip10:1', 'fresh-pending'), entry(ABANDON, 'slip10:2', 'fresh-pending')]);
    const seen: string[] = [];
    const off = onA0AccountPromoted(() => {
      seen.push(loadA0AccountRegistry()!.filter(e => e.role === 'fresh-exit').map(e => e.scheme).join(','));
      throw new Error('a listener that throws');
    });
    expect(promoteA0FreshAccount('slip10:1')).toBe('promoted');
    expect(seen).toEqual(['slip10:1']); // fired AFTER the write: the listener reads the promoted entry
    expect(promoteA0FreshAccount('slip10:1')).toBe('already');
    expect(seen).toHaveLength(1);
    expect(addA0RecoveredExitAccounts([2], seedOf(ABANDON))).toEqual(['slip10:2']);
    expect(seen).toHaveLength(2);
    off();
    setRaw([entry(ABANDON, 'slip10:0', 'main'), entry(ABANDON, 'slip10:1', 'fresh-pending')]);
    promoteA0FreshAccount('slip10:1');
    expect(seen).toHaveLength(2); // unregistered
  });
});
