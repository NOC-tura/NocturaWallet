/**
 * History spec §6.4, §8 "Link scan": when the scan runs — single-flight, the 60 s interval, the
 * generation guard — and its storage (the cursors, encrypted instance only). The scan itself is
 * scripted here (linkScan.test.ts pins it); the registry and the store are real. Real timers only.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {QueryClient} from '@tanstack/react-query';
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {storeTransparentScheme} from '../../keyDerivation/derivationScheme';
import {loadA0AccountRegistry} from '../../shielded/a0/accountRegistry';
import {
  LINK_SCAN_MIN_INTERVAL_MS,
  linkScanDepsFor,
  linkScanSeedDigest,
  readLinkScanRecord,
  runLinkScans,
  scanLinksForWallet,
  writeLinkScanRecord,
} from '../linkScanRunner';
import type {LinkScanRunnerEnv} from '../linkScanRunner';
import type {AccountList, WalletAccount} from '../accountList';
import type {LinkScanResult} from '../linkScan';

// the chain behind scanLinksForWallet, scripted per test. A batch is answered in REVERSE order (a node may: plan
// review r2 C1) and the reader matches each answer by its own signature — so `transactions` is keyed by the
// fixtures' full signatures.
const mockChain: {signatures: Record<string, unknown[]>; transactions: Record<string, unknown>} = {signatures: {}, transactions: {}};
const mockConnection = {
  getParsedTokenAccountsByOwner: jest.fn(async () => ({value: []})),
  getSignaturesForAddress: jest.fn(async (address: {toBase58: () => string}) => mockChain.signatures[address.toBase58()] ?? []),
  getParsedTransactions: jest.fn(async (signatures: string[]) => signatures.map(s => mockChain.transactions[s] ?? null).reverse()),
  getParsedTransaction: jest.fn(async () => null),
};
jest.mock('../../solana/connection', () => ({getConnection: () => mockConnection}));

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const A4 = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const REG = 'v1_accounts';

const account = (n: number, address: string, role: 'main' | 'fresh-exit', linked = false): WalletAccount => ({
  scheme: `slip10:${n}`, address, label: `Account ${n + 1}`, number: n + 1, role, isMain: role === 'main', linked,
});
const listOf = (accounts: WalletAccount[], extraSeed: string[] = [], unreadable = false): AccountList => ({
  accounts,
  seed: [...accounts.map(a => ({address: a.address, role: a.role})), ...extraSeed.map(address => ({address, role: 'fresh-pending' as const}))],
  walletKind: 'slip10',
  unreadable,
});

function env(list: AccountList | null, results: Record<string, LinkScanResult> = {}) {
  const calls: Array<{exit: string; seedWallets: string[]}> = [];
  const state = {now: 1_000_000, linked: 0};
  const e: LinkScanRunnerEnv = {
    accounts: () => list,
    now: () => state.now,
    onLinked: () => {
      state.linked += 1;
    },
    scanExit: async (exit, seedWallets) => {
      calls.push({exit, seedWallets: [...seedWallets].sort()});
      return results[exit] ?? 'clean';
    },
  };
  return {e, calls, state};
}

beforeEach(() => {
  clearAllStores(); // fires the reset hook: the runner's in-memory state (interval, in-flight) starts over
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
});

it('the key is v1_linkScanCursors', () => {
  expect(MMKV_KEYS.LINK_SCAN_CURSORS).toBe('v1_linkScanCursors');
});

describe('runLinkScans (§6.4)', () => {
  // N1 (§6.1)
  it('scans every fresh-exit that is not tagged yet — never main, never a tagged one; seedWallets is every other address of the seed', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit'), account(4, A4, 'fresh-exit', true)], [A1]);
    const {e, calls} = env(list);
    expect(await runLinkScans(e)).toBe(0);
    expect(calls).toEqual([{exit: A3, seedWallets: [A4, MAIN, A1].sort()}]); // the fresh-pending A1 is a seed wallet too
  });

  // N2
  it('a hit counts, calls onLinked, and the others are still scanned', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit'), account(4, A4, 'fresh-exit')]);
    const {e, calls, state} = env(list, {[A3]: 'linked', [A4]: 'failed'});
    expect(await runLinkScans(e)).toBe(1);
    expect(calls.map(c => c.exit)).toEqual([A3, A4]);
    expect(state.linked).toBe(1);
  });

  // N3
  it('an unreadable list, no list, and a scan that throws: nothing is tagged and nothing is thrown', async () => {
    expect(await runLinkScans(env(listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit')], [], true)).e)).toBe(0);
    expect(await runLinkScans(env(null).e)).toBe(0);
    const {e} = env(listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit')]));
    e.scanExit = async () => {
      throw new Error('boom');
    };
    await expect(runLinkScans(e)).resolves.toBe(0);
  });

  // N4
  it('single-flight: an open while a scan runs joins it', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit')]);
    const {e, calls} = env(list);
    let release: (r: LinkScanResult) => void = () => undefined;
    e.scanExit = (exit, seedWallets) => {
      calls.push({exit, seedWallets: [...seedWallets]});
      return new Promise<LinkScanResult>(r => {
        release = r;
      });
    };
    const first = runLinkScans(e);
    const second = runLinkScans(e);
    expect(second).toBe(first);
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    release('linked');
    expect(await first).toBe(1);
  });

  // N5
  it('the minimum interval: an exit is not scanned again within 60 s; it is after', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit')]);
    const {e, calls, state} = env(list);
    await runLinkScans(e);
    state.now += LINK_SCAN_MIN_INTERVAL_MS - 1;
    await runLinkScans(e);
    expect(calls).toHaveLength(1);
    state.now += 1;
    await runLinkScans(e);
    expect(calls).toHaveLength(2);
    // a clock that went backwards never blocks a scan forever
    state.now -= 10 * LINK_SCAN_MIN_INTERVAL_MS;
    await runLinkScans(e);
    expect(calls).toHaveLength(3);
  });

  // N6
  it('the generation guard: a wipe while a scan runs makes `live()` false, drops its result, and frees the next scan', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit'), account(4, A4, 'fresh-exit')]);
    const {e, calls, state} = env(list);
    let release: (r: LinkScanResult) => void = () => undefined;
    let liveSeen: (() => boolean) | null = null;
    e.scanExit = (exit, _seed, live) => {
      calls.push({exit, seedWallets: []});
      liveSeen = live;
      return new Promise<LinkScanResult>(r => {
        release = r;
      });
    };
    const old = runLinkScans(e);
    await Promise.resolve();
    expect(liveSeen!()).toBe(true);
    clearAllStores(); // the wallet is gone
    expect(liveSeen!()).toBe(false);
    // the new wallet's open is not joined to the old scan, and its interval starts over
    const fresh = env(list);
    const next = runLinkScans(fresh.e);
    expect(next).not.toBe(old);
    release('linked');
    expect(await old).toBe(0); // the old result is dropped: no tag counted, no onLinked, the second exit not scanned
    expect(state.linked).toBe(0);
    expect(calls.map(c => c.exit)).toEqual([A3]);
    await next;
    expect(fresh.calls.map(c => c.exit)).toEqual([A3, A4]);
  });
});

describe('the records (§6.3)', () => {
  const S1 = linkScanSeedDigest(new Set([MAIN, A1]));
  const S2 = linkScanSeedDigest(new Set([MAIN, A1, A4]));

  it('the digest is of the SET: order does not matter, a wallet more or less does', () => {
    expect(linkScanSeedDigest(new Set([A1, MAIN]))).toBe(S1);
    expect(S2).not.toBe(S1);
    expect(S1).toMatch(/^[0-9a-f]{64}$/);
  });

  // N7
  it('are stored per exit and source in the ENCRYPTED instance, keyed on the seed set, and survive a malformed value', () => {
    const store = mmkvSecure()!;
    expect(readLinkScanRecord(store, A3, S1, 'src1')).toBeUndefined();
    writeLinkScanRecord(store, A3, S1, 'src1', {cursor: 'sigA'});
    writeLinkScanRecord(store, A3, S1, 'src2', {cursor: 'sigB', pending: {newest: 'sigN', resumeBelow: 'sigR'}});
    writeLinkScanRecord(store, A4, S1, 'src1', {cursor: 'sigC'});
    expect(JSON.parse(store.getString('v1_linkScanCursors')!)).toEqual({
      [A3]: {seeds: S1, sources: {src1: {cursor: 'sigA'}, src2: {cursor: 'sigB', pending: {newest: 'sigN', resumeBelow: 'sigR'}}}},
      [A4]: {seeds: S1, sources: {src1: {cursor: 'sigC'}}},
    });
    expect(readLinkScanRecord(store, A3, S1, 'src2')).toEqual({cursor: 'sigB', pending: {newest: 'sigN', resumeBelow: 'sigR'}});
    expect(mmkvPublic.getString('v1_linkScanCursors')).toBeUndefined();
    store.set('v1_linkScanCursors', '{not json');
    expect(readLinkScanRecord(store, A3, S1, 'src1')).toBeUndefined();
    writeLinkScanRecord(store, A3, S1, 'src1', {cursor: 'sigD'});
    expect(readLinkScanRecord(store, A3, S1, 'src1')).toEqual({cursor: 'sigD'});
  });

  it('a malformed stored record is no record (re-read), never "read through"', () => {
    const store = mmkvSecure()!;
    const bad = (sources: unknown) => store.set('v1_linkScanCursors', JSON.stringify({[A3]: {seeds: S1, sources}}));
    for (const sources of [
      {src: 'sigA'}, // the old bare-signature shape
      {src: 7},
      {src: null},
      {src: {cursor: 5}},
      {src: {cursor: ''}},
      {src: {pending: {newest: 'n'}}}, // no resumeBelow
      {src: {pending: {resumeBelow: 3}}},
      {src: {pending: 'x'}},
    ]) {
      bad(sources);
      expect(readLinkScanRecord(store, A3, S1, 'src')).toBeUndefined();
    }
    store.set('v1_linkScanCursors', JSON.stringify({[A3]: 'sigA'}));
    expect(readLinkScanRecord(store, A3, S1, 'src')).toBeUndefined();
    store.set('v1_linkScanCursors', JSON.stringify([1]));
    expect(readLinkScanRecord(store, A3, S1, 'src')).toBeUndefined();
    bad({src: {pending: {resumeBelow: 'r'}}}); // `newest` may be absent (decoded from storage)
    expect(readLinkScanRecord(store, A3, S1, 'src')).toEqual({pending: {resumeBelow: 'r'}});
  });

  // I1.1: a record is valid only for the seed set it was scanned against
  it('I1.1: records of one seed set are ignored under another, and only the latest set is kept', () => {
    const store = mmkvSecure()!;
    writeLinkScanRecord(store, A3, S1, 'src', {cursor: 'sigA'});
    writeLinkScanRecord(store, A4, S1, 'src', {cursor: 'sigX'});
    expect(readLinkScanRecord(store, A3, S2, 'src')).toBeUndefined(); // a wallet was added: scan from the head
    writeLinkScanRecord(store, A3, S2, 'src', {cursor: 'sigB'});
    expect(readLinkScanRecord(store, A3, S2, 'src')).toEqual({cursor: 'sigB'});
    expect(readLinkScanRecord(store, A3, S1, 'src')).toBeUndefined(); // S1 again: only the latest set is kept
    expect(readLinkScanRecord(store, A4, S1, 'src')).toEqual({cursor: 'sigX'}); // another exit is untouched
    // the replacement drops the old set's other sources too
    writeLinkScanRecord(store, A3, S1, 'other', {cursor: 'sigC'});
    expect(JSON.parse(store.getString('v1_linkScanCursors')!)[A3]).toEqual({seeds: S1, sources: {other: {cursor: 'sigC'}}});
  });

  // N8
  it('a wipe removes them with the store', () => {
    writeLinkScanRecord(mmkvSecure()!, A3, S1, 'src1', {cursor: 'sigA'});
    clearAllStores();
    initSecureMmkv('another-wallet');
    expect(readLinkScanRecord(mmkvSecure()!, A3, S1, 'src1')).toBeUndefined();
  });
});

describe('scanLinksForWallet', () => {
  // N9
  it('with the encrypted store closed, or no wallet, nothing is read', async () => {
    clearAllStores();
    expect(await scanLinksForWallet(MAIN, {} as never)).toBe(0);
    initSecureMmkv('test-key');
    expect(await scanLinksForWallet(null, {} as never)).toBe(0);
  });

  // N10
  it('with no exit to scan it resolves 0 without touching the registry', async () => {
    mmkvSecure()!.set(REG, JSON.stringify({schema: 1, accounts: [{scheme: 'slip10:0', role: 'main', address: MAIN}]}));
    expect(await scanLinksForWallet(MAIN, {} as never)).toBe(0);
    expect(loadA0AccountRegistry()![0]!.linked).toBeUndefined();
  });

  // the real devnet pair of fixture QAgzVzY6…: main Da83cA…, Account 2 (an exit) 9Y7Ftt…
  const DEV_MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
  const DEV_EXIT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
  const fixture = (name: string): unknown =>
    (JSON.parse(readFileSync(join(__dirname, '../../solana/__tests__/fixtures', name), 'utf8')) as {result: unknown}).result;
  const QAGZ = 'QAgzVzY6RhvmFWTiCueAyPfQY3qkyjXVZXXBnbYd9KXfkua1JEHJvxxSEjJbiwvQ2bCupghhRnY6WuwdQMGqgNY';
  const I53Q = '5i53q9tRrCQUyoXjc41cBtW3gb9wcMeD7hspooqz3cPBmndWAXfWn5FXMMv2sCR2kjLMYakvFvWpobNzcSy6LGNZ';
  const finalized = (signature: string) => ({signature, slot: 9, blockTime: 9, confirmationStatus: 'finalized', err: null});
  const devRegistry = (): void =>
    mmkvSecure()!.set(
      REG,
      JSON.stringify({
        schema: 1,
        accounts: [
          {scheme: 'slip10:0', role: 'main', address: DEV_MAIN},
          {scheme: 'slip10:1', role: 'fresh-exit', address: DEV_EXIT},
        ],
      }),
    );
  // the seed set the runner scans DEV_EXIT against: every other address of the registry
  const DEV_SEEDS = linkScanSeedDigest(new Set([DEV_MAIN]));
  const exitEntry = () => loadA0AccountRegistry()!.find(x => x.address === DEV_EXIT)!;

  // N11
  it('end to end: a link on chain tags the exit in the registry — and never main', async () => {
    devRegistry();
    mockChain.signatures = {[DEV_EXIT]: [finalized(QAGZ)]};
    mockChain.transactions = {[QAGZ]: fixture('tx-test-to-main.json')};
    const client = new QueryClient();
    expect(await scanLinksForWallet(DEV_MAIN, client)).toBe(1);
    expect(exitEntry().linked).toBe(true);
    expect(loadA0AccountRegistry()!.find(x => x.address === DEV_MAIN)!.linked).toBeUndefined();
    expect(mmkvSecure()!.getString('v1_linkScanCursors')).toBeUndefined(); // no cursor is needed after a link
    client.clear();
  });

  // N11b (plan review r2 C1): the scan trusts an answer only for the signature it carries
  it('end to end: a linking transaction answered for ANOTHER signature tags nothing and moves no cursor', async () => {
    devRegistry();
    // the exit's one signature is a clean transaction's; the node answers it with the linking QAgzVzY6…
    mockChain.signatures = {[DEV_EXIT]: [finalized(I53Q)]};
    mockChain.transactions = {[I53Q]: fixture('tx-test-to-main.json')};
    const client = new QueryClient();
    expect(await scanLinksForWallet(DEV_MAIN, client)).toBe(0);
    expect(exitEntry().linked).toBeUndefined();
    expect(mmkvSecure()!.getString('v1_linkScanCursors')).toBeUndefined(); // unread, not clean: the cursor stays
    client.clear();
  });

  // N12
  it('end to end: a clean history writes the cursor and no tag; a wipe during the scan writes nothing', async () => {
    devRegistry();
    mockChain.signatures = {[DEV_EXIT]: [finalized(I53Q)]};
    mockChain.transactions = {[I53Q]: fixture('tx-test-to-outside.json')};
    const client = new QueryClient();
    expect(await scanLinksForWallet(DEV_MAIN, client)).toBe(0);
    expect(exitEntry().linked).toBeUndefined();
    expect(readLinkScanRecord(mmkvSecure()!, DEV_EXIT, DEV_SEEDS, DEV_EXIT)).toEqual({cursor: I53Q});

    // a new wallet in the same process: the old scan's tag and cursor must not land in it
    clearAllStores();
    initSecureMmkv('test-key');
    storeTransparentScheme({kind: 'slip10', account: 0});
    devRegistry();
    mockChain.signatures = {[DEV_EXIT]: [finalized(QAGZ)]};
    mockChain.transactions = {[QAGZ]: fixture('tx-test-to-main.json')};
    let release: () => void = () => undefined;
    mockConnection.getParsedTransactions.mockImplementationOnce(async (signatures: string[]) => {
      await new Promise<void>(r => {
        release = r;
      });
      return signatures.map(s => mockChain.transactions[s] ?? null);
    });
    client.clear();
    const scan = scanLinksForWallet(DEV_MAIN, client);
    await new Promise<void>(r => setImmediate(r)); // let the scan reach the transaction read
    clearAllStores();
    initSecureMmkv('the-next-wallet');
    devRegistry();
    release();
    expect(await scan).toBe(0);
    expect(exitEntry().linked).toBeUndefined();
    client.clear();
  });

  /** a CLEAN scan of the dev exit, held open at its transaction read; resolves once the read was asked for */
  async function heldCleanScan(client: QueryClient): Promise<{scan: Promise<number>; release: () => void}> {
    devRegistry();
    mockChain.signatures = {[DEV_EXIT]: [finalized(I53Q)]};
    mockChain.transactions = {[I53Q]: fixture('tx-test-to-outside.json')};
    let release: () => void = () => undefined;
    const asked = new Promise<void>(reached => {
      mockConnection.getParsedTransactions.mockImplementationOnce(async (signatures: string[]) => {
        reached();
        await new Promise<void>(r => {
          release = r;
        });
        return signatures.map(s => mockChain.transactions[s] ?? null);
      });
    });
    const scan = scanLinksForWallet(DEV_MAIN, client);
    await asked;
    return {scan, release: () => release()};
  }

  // N13 (plan review r1 I2): the CURSOR write after a wipe — N12's wipe case writes a tag, never a cursor
  it('a wipe while a clean scan is reading: its cursor is not written into the store the next wallet opens', async () => {
    const client = new QueryClient();
    // control: the same held scan, with no wipe, does write the cursor
    const control = await heldCleanScan(client);
    control.release();
    expect(await control.scan).toBe(0);
    expect(readLinkScanRecord(mmkvSecure()!, DEV_EXIT, DEV_SEEDS, DEV_EXIT)).toEqual({cursor: I53Q});

    clearAllStores();
    initSecureMmkv('test-key');
    storeTransparentScheme({kind: 'slip10', account: 0});
    client.clear(); // the transaction is asked for again, so the scan can be held at it
    const held = await heldCleanScan(client);
    clearAllStores(); // the wallet is gone …
    initSecureMmkv('the-next-wallet'); // … and another one is open
    held.release();
    expect(await held.scan).toBe(0);
    // the old wallet's account addresses must not be in the new wallet's store
    expect(mmkvSecure()!.getString('v1_linkScanCursors')).toBeUndefined();
    client.clear();
  });

  // N14 (plan review r1 I2): the second half of the guard. Every replacement of the instance also bumps the
  // generation, so through scanLinksForWallet the two halves always fail together; here `live` is handed in.
  it('the write guard needs BOTH: a live generation and the same encrypted instance', () => {
    const captured = mmkvSecure()!;
    const seeds = new Set([DEV_MAIN]);
    const deps = (live: boolean) => linkScanDepsFor(captured, mockConnection as never, {} as never, () => live, seeds);
    deps(true).setRecord(DEV_EXIT, 'src', {cursor: 'sigA'});
    expect(readLinkScanRecord(mmkvSecure()!, DEV_EXIT, DEV_SEEDS, 'src')).toEqual({cursor: 'sigA'}); // control: live and the same instance
    expect(deps(true).getRecord(DEV_EXIT, 'src')).toEqual({cursor: 'sigA'});
    deps(false).setRecord(DEV_EXIT, 'src', {cursor: 'sigB'});
    expect(readLinkScanRecord(mmkvSecure()!, DEV_EXIT, DEV_SEEDS, 'src')).toEqual({cursor: 'sigA'}); // an older generation writes nothing
    clearAllStores();
    initSecureMmkv('the-next-wallet');
    devRegistry();
    deps(true).setRecord(DEV_EXIT, 'src', {cursor: 'sigC'}); // `live` alone is not enough: the instance is another one
    expect(mmkvSecure()!.getString('v1_linkScanCursors')).toBeUndefined();
    deps(true).markLinked([DEV_EXIT]);
    expect(exitEntry().linked).toBeUndefined();
  });

  // markLinked takes the exit and every other wallet the transaction named: main is never tagged
  it('markLinked tags the exit and drops main (only fresh-exit entries are tagged)', () => {
    devRegistry();
    linkScanDepsFor(mmkvSecure()!, mockConnection as never, {} as never, () => true, new Set([DEV_MAIN])).markLinked([DEV_EXIT, DEV_MAIN]);
    expect(exitEntry().linked).toBe(true);
    expect(loadA0AccountRegistry()!.find(x => x.address === DEV_MAIN)!.linked).toBeUndefined();
  });

  // I1.1 through the runner: a wallet added to the seed makes the next scan start from the head again
  it('I1.1 end to end: a changed seed set re-reads the history a record had read through', async () => {
    devRegistry();
    mockChain.signatures = {[DEV_EXIT]: [finalized(I53Q)]};
    mockChain.transactions = {[I53Q]: fixture('tx-test-to-outside.json')};
    const client = new QueryClient();
    const clock = jest.spyOn(Date, 'now');
    clock.mockReturnValue(1_000_000);
    mockConnection.getParsedTransactions.mockClear();
    expect(await scanLinksForWallet(DEV_MAIN, client)).toBe(0);
    expect(mockConnection.getParsedTransactions).toHaveBeenCalledTimes(1);
    // control: the same seed set — the record reads through, the transaction is not asked for again
    clock.mockReturnValue(1_000_000 + 2 * LINK_SCAN_MIN_INTERVAL_MS);
    client.clear();
    expect(await scanLinksForWallet(DEV_MAIN, client)).toBe(0);
    expect(mockConnection.getParsedTransactions).toHaveBeenCalledTimes(1);
    // a wallet of this seed is reserved: the set changed, the exit is read from the head
    mmkvSecure()!.set(
      REG,
      JSON.stringify({
        schema: 1,
        accounts: [
          {scheme: 'slip10:0', role: 'main', address: DEV_MAIN},
          {scheme: 'slip10:1', role: 'fresh-exit', address: DEV_EXIT},
          {scheme: 'slip10:2', role: 'fresh-pending', address: A1},
        ],
      }),
    );
    clock.mockReturnValue(1_000_000 + 4 * LINK_SCAN_MIN_INTERVAL_MS);
    client.clear();
    expect(await scanLinksForWallet(DEV_MAIN, client)).toBe(0);
    expect(mockConnection.getParsedTransactions).toHaveBeenCalledTimes(2);
    clock.mockRestore();
    client.clear();
  });
});
