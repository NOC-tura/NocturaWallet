/**
 * History spec §3.1, §3.3, §8 "History reading": the source list, a signature page, and the parsed
 * transaction read with its cache — against a scripted connection. The real rpcLimiter runs (its
 * keys are what is tested); it is reset between tests. The time limit is HANDED IN (30 ms against a
 * promise that never settles): real timers, no fake ones.
 *
 * Plan review r2 C1: a node may answer a batch in ANY order, so every scripted batch here gives each
 * answer its own signature and hands them back out of order (`shuffled`) — a reader that pairs by
 * position fails most of the tests below, not only the two written for it (R21, R22).
 */
import {QueryClient} from '@tanstack/react-query';
import {Connection} from '@solana/web3.js';
import {rpcLimiter, _resetRateLimitersForTest} from '../rpcLimiter';
import {
  HISTORY_READ_TIMEOUT_MS,
  PARSED_TX_GC_MS,
  applyParsedTxDefaults,
  getSignaturePage,
  listHistorySources,
  orderSources,
  parsedTxKey,
  readParsedTransaction,
  readParsedTransactions,
  readParsedTransactionsTimed,
} from '../historyReads';
import {TimeoutError} from '../withTimeout';
import type {RawParsedTx} from '../txDetail';
import type {TokenAccount} from '../types';

const WALLET = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const ta = (address: string, amount: string): TokenAccount => ({address, amount, mint: 'M', owner: WALLET, decimals: 9});
/** a transaction that says itself which one it is — as every real answer does */
const tx = (signature: string, slot = 1): RawParsedTx => ({slot, meta: {fee: 5000}, transaction: {signatures: [signature]}});
/** the same answers in another order: every position is wrong when there are two or more */
const shuffled = <T,>(answers: T[]): T[] => [...answers.slice(1), ...answers.slice(0, 1)];
/** resolves after `ms` real milliseconds */
const after = <T,>(ms: number, value: T): Promise<T> => new Promise(resolve => setTimeout(() => resolve(value), ms));
/** a request the node never answers */
const never = <T,>(): Promise<T> => new Promise<T>(() => undefined);
const SHORT = 30;

let client: QueryClient;
beforeEach(() => {
  _resetRateLimitersForTest();
  client = new QueryClient();
  applyParsedTxDefaults(client);
});
afterEach(() => {
  client.clear(); // no 24 h gc timer outlives a test
  jest.restoreAllMocks(); // a Date.now spy of one test never reaches the next
});

describe('orderSources', () => {
  // R1
  it('the wallet first, then funded token accounts, then empty ones, each by address', () => {
    expect(orderSources(WALLET, [ta('Zempty', '0'), ta('Bfunded', '5'), ta('Aempty', '0'), ta('Afunded', '1')])).toEqual({
      sources: [WALLET, 'Afunded', 'Bfunded', 'Aempty', 'Zempty'],
      tokenAccounts: ['Afunded', 'Bfunded', 'Aempty', 'Zempty'],
      tokenAccountsTotal: 4,
    });
  });

  // R2 (§3.2 bound)
  it('at most 25 sources: the wallet and 24 token accounts, funded ones kept first; the total counts them all', () => {
    const empty = Array.from({length: 20}, (_, k) => ta(`E${String(k).padStart(2, '0')}`, '0'));
    const funded = Array.from({length: 11}, (_, k) => ta(`F${String(k).padStart(2, '0')}`, '7'));
    const list = orderSources(WALLET, [...empty, ...funded]);
    expect(list.sources).toHaveLength(25);
    expect(list.sources[0]).toBe(WALLET);
    expect(list.sources.slice(1, 12)).toEqual(funded.map(a => a.address));
    expect(list.sources.slice(12)).toEqual(empty.slice(0, 13).map(a => a.address));
    expect(list.tokenAccountsTotal).toBe(31);
    // final review 10: every owned token account is carried, the 7 that are not read too
    expect(list.tokenAccounts).toHaveLength(31);
    expect(list.tokenAccounts).toEqual(expect.arrayContaining(empty.slice(13).map(a => a.address)));
  });
});

describe('listHistorySources', () => {
  const account = (address: string, amount: string) => ({
    pubkey: {toBase58: () => address},
    account: {data: {parsed: {info: {mint: 'M', owner: WALLET, tokenAmount: {amount, decimals: 9}}}}},
  });

  // R3 (§3.1)
  it('reads the classic program AND Token-2022', async () => {
    const connection = new Connection('https://x');
    (connection.getParsedTokenAccountsByOwner as jest.Mock).mockImplementation(async (_owner: unknown, filter: {programId: {toBase58: () => string}}) => ({
      value: filter.programId.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' ? [account('T22', '3')] : [account('Classic', '0')],
    }));
    expect(await listHistorySources(connection, 'devnet', WALLET)).toEqual({sources: [WALLET, 'T22', 'Classic'], tokenAccounts: ['T22', 'Classic'], tokenAccountsTotal: 2});
    expect(connection.getParsedTokenAccountsByOwner).toHaveBeenCalledTimes(2);
  });

  // R4
  it('one failed read fails the list (a partial list would hide rows)', async () => {
    const connection = new Connection('https://x');
    (connection.getParsedTokenAccountsByOwner as jest.Mock).mockImplementation(async (_owner: unknown, filter: {programId: {toBase58: () => string}}) => {
      if (filter.programId.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
        throw new Error('rpc down');
      }
      return {value: []};
    });
    await expect(listHistorySources(connection, 'devnet', WALLET)).rejects.toThrow('rpc down');
  });

  // R15 (plan review r1 m10; spec §3.3 "any history read")
  it('the limiter keys are the history\'s own and hold the cluster, the owner and the program', async () => {
    const spy = jest.spyOn(rpcLimiter, 'execute');
    const connection = new Connection('https://x');
    (connection.getParsedTokenAccountsByOwner as jest.Mock).mockResolvedValue({value: []});
    await listHistorySources(connection, 'devnet', WALLET);
    await listHistorySources(connection, 'mainnet-beta', WALLET);
    expect(spy.mock.calls.map(c => c[0])).toEqual([
      `historyTokenAccounts:devnet:${WALLET}:TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`,
      `historyTokenAccounts:devnet:${WALLET}:TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`,
      `historyTokenAccounts:mainnet-beta:${WALLET}:TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`,
      `historyTokenAccounts:mainnet-beta:${WALLET}:TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`,
    ]);
    spy.mockRestore();
  });

  // R16 (plan review r1 I6)
  it('a source-list read that never answers fails after its time limit, and the retry is a new request', async () => {
    const connection = new Connection('https://x');
    const read = connection.getParsedTokenAccountsByOwner as jest.Mock;
    read.mockImplementation((_owner: unknown, filter: {programId: {toBase58: () => string}}) =>
      filter.programId.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' ? never() : Promise.resolve({value: []}),
    );
    await expect(listHistorySources(connection, 'devnet', WALLET, SHORT)).rejects.toBeInstanceOf(TimeoutError);
    // the SAME key again: were the hung request still the limiter's in-flight entry, this would join it and time out too
    read.mockImplementation(async () => ({value: [account('T', '1')]}));
    expect(await listHistorySources(connection, 'devnet', WALLET, SHORT)).toEqual({sources: [WALLET, 'T'], tokenAccounts: ['T'], tokenAccountsTotal: 1});
  });
});

describe('getSignaturePage', () => {
  // R5
  it('maps status: err → failed, finalized, anything else → confirmed; keeps `finalized` apart; passes limit and before', async () => {
    const connection = {
      getSignaturesForAddress: jest.fn(async (_address: unknown, _options: unknown) => [
        {signature: 'a', slot: 3, blockTime: 30, confirmationStatus: 'finalized', err: null},
        {signature: 'b', slot: 2, blockTime: null, confirmationStatus: 'confirmed', err: null},
        {signature: 'c', slot: 1, blockTime: 10, confirmationStatus: 'finalized', err: {InstructionError: [0, 'Custom']}},
      ]),
    };
    expect(await getSignaturePage(connection as never, 'devnet', WALLET, 'cursor', 20)).toEqual([
      {signature: 'a', slot: 3, blockTime: 30, status: 'finalized', finalized: true},
      {signature: 'b', slot: 2, blockTime: null, status: 'confirmed', finalized: false},
      {signature: 'c', slot: 1, blockTime: 10, status: 'failed', finalized: true},
    ]);
    expect(connection.getSignaturesForAddress.mock.calls[0]![1]).toEqual({limit: 20, before: 'cursor'});
  });

  // R6 (r2 m2)
  it('the limiter key holds the method, the cluster, the source and the cursor: it differs per page', async () => {
    const spy = jest.spyOn(rpcLimiter, 'execute');
    const connection = {getSignaturesForAddress: jest.fn(async () => [])};
    await getSignaturePage(connection as never, 'devnet', WALLET, undefined, 20);
    await getSignaturePage(connection as never, 'devnet', WALLET, 'sigX', 20);
    await getSignaturePage(connection as never, 'mainnet-beta', WALLET, 'sigX', 20);
    await getSignaturePage(connection as never, 'devnet', 'OtherSource', 'sigX', 20);
    const keys = spy.mock.calls.map(c => c[0]);
    expect(keys[0]).toBe(`getSignaturesForAddress:devnet:${WALLET}:head:20`);
    expect(new Set(keys).size).toBe(4);
    spy.mockRestore();
  });

  // R17 (plan review r1 I6)
  it('a signature read that never answers fails after its time limit; the same page can then be read', async () => {
    const connection = {getSignaturesForAddress: jest.fn((_address: unknown, _options: unknown): Promise<unknown[]> => never())};
    await expect(getSignaturePage(connection as never, 'devnet', WALLET, undefined, 20, SHORT)).rejects.toBeInstanceOf(TimeoutError);
    connection.getSignaturesForAddress.mockResolvedValueOnce([{signature: 'a', slot: 3, blockTime: 30, confirmationStatus: 'finalized', err: null}]);
    expect(await getSignaturePage(connection as never, 'devnet', WALLET, undefined, 20, SHORT)).toHaveLength(1);
    expect(connection.getSignaturesForAddress).toHaveBeenCalledTimes(2);
  });

  it('the default time limit is 20 s', () => {
    expect(HISTORY_READ_TIMEOUT_MS).toBe(20_000);
  });
});

describe('readParsedTransactions', () => {
  // R7
  it('the batch path: one call for every uncached signature; the answers are cached for 24 h', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => shuffled(s.map((x, k) => tx(x, k + 1)))),
      getParsedTransaction: jest.fn(),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    // version 1: the highest web3.js 1.99 parses (spec §3.3, owner decision 2026-11-27)
    expect(connection.getParsedTransactions).toHaveBeenCalledWith(['a', 'b'], {maxSupportedTransactionVersion: 1});
    expect(got.get('a')).toEqual(tx('a', 1));
    expect(got.get('b')).toEqual(tx('b', 2));
    expect(connection.getParsedTransaction).not.toHaveBeenCalled();
    expect(client.getQueryData(parsedTxKey('devnet', 'a'))).toEqual(tx('a', 1));
    const query = client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'a')})!;
    expect(query.gcTime).toBe(PARSED_TX_GC_MS);
    expect(query.isStale()).toBe(false);
  });

  // R8
  it('the cache is used: no second read of a cached signature; only the new ones are asked for', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => shuffled(s.map(x => tx(x, 7)))),
      getParsedTransaction: jest.fn(),
    };
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    const second = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    expect(connection.getParsedTransactions).toHaveBeenCalledTimes(1);
    expect([second.get('a'), second.get('b')]).toEqual([tx('a', 7), tx('b', 7)]);
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'c']);
    expect(connection.getParsedTransactions).toHaveBeenLastCalledWith(['c'], {maxSupportedTransactionVersion: 1});
    // another cluster shares nothing
    await readParsedTransactions(connection as never, client, 'mainnet-beta', ['a']);
    expect(connection.getParsedTransactions).toHaveBeenLastCalledWith(['a'], {maxSupportedTransactionVersion: 1});
  });

  // R9
  it('the fallback: when the batch throws, the same signatures are read one at a time', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('batch requests are not allowed');
      }),
      getParsedTransaction: jest.fn(async (s: string, _config: unknown) => (s === 'b' ? null : tx(s, s === 'a' ? 1 : 3))),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b', 'c']);
    expect(connection.getParsedTransaction.mock.calls.map(c => c[0])).toEqual(['a', 'b', 'c']);
    expect(connection.getParsedTransaction.mock.calls[0]![1]).toEqual({maxSupportedTransactionVersion: 1});
    expect([...got.keys()]).toEqual(['a', 'c']);
    expect(got.get('c')).toEqual(tx('c', 3));
  });

  // R10 (§3.4)
  it('a null answer and a failed single read are absent and NOT cached; the next read asks again', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (_s: string[]): Promise<Array<RawParsedTx | null>> => [null, tx('a', 1)]),
      getParsedTransaction: jest.fn(),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    expect(got.get('a')).toEqual(tx('a', 1));
    expect(got.has('b')).toBe(false);
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'b')})).toBeUndefined();
    expect(connection.getParsedTransaction).not.toHaveBeenCalled(); // an answered batch is final: no single read for the null
    connection.getParsedTransactions.mockResolvedValueOnce([tx('b', 2)]);
    const again = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    expect(connection.getParsedTransactions).toHaveBeenLastCalledWith(['b'], {maxSupportedTransactionVersion: 1});
    expect(again.get('b')).toEqual(tx('b', 2));

    const failing = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('no batch');
      }),
      getParsedTransaction: jest.fn(async () => {
        throw new Error('rpc down');
      }),
    };
    expect((await readParsedTransactions(failing as never, client, 'devnet', ['z'])).size).toBe(0);
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'z')})).toBeUndefined();
  });

  // R14 (Review Focus 1): a transaction the node will not serve — a version above 1, a node that knows no
  // version 1, or one signature rate-limited inside the batch
  it('one refused signature fails the batch, then only itself: every other transaction of the page is still read', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('failed to get transactions: Transaction version (2) is not supported by the requesting client');
      }),
      getParsedTransaction: jest.fn(async (s: string) => {
        if (s === 'refused') {
          throw new Error('Transaction version (2) is not supported by the requesting client');
        }
        return tx(s);
      }),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'refused', 'b']);
    expect([...got.keys()]).toEqual(['a', 'b']);
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'refused')})).toBeUndefined();
  });

  // R21 (plan review r2 C1): JSON-RPC 2.0 lets a node answer a batch in any order; both public endpoints do
  it('a batch answered in REVERSE order: each transaction is returned and cached under its own signature', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => s.map((x, k) => tx(x, 100 + k)).reverse()),
      getParsedTransaction: jest.fn(),
    };
    const asked = ['a', 'b', 'c', 'd', 'e'];
    const got = await readParsedTransactions(connection as never, client, 'devnet', asked);
    asked.forEach((signature, k) => {
      expect(got.get(signature)).toEqual(tx(signature, 100 + k));
      expect(client.getQueryData(parsedTxKey('devnet', signature))).toEqual(tx(signature, 100 + k));
    });
    expect(connection.getParsedTransaction).not.toHaveBeenCalled();
  });

  // R22 (plan review r2 C1)
  it('an answer for a signature that was not asked for is dropped: not returned, not cached — under any key', async () => {
    const connection = {
      // in a's place: a transaction nobody asked for
      getParsedTransactions: jest.fn(async (_s: string[]) => [tx('foreign', 9), tx('b', 2)]),
      getParsedTransaction: jest.fn(),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    expect([...got.keys()]).toEqual(['b']);
    expect(got.get('b')).toEqual(tx('b', 2));
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'a')})).toBeUndefined();
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'foreign')})).toBeUndefined();
    expect(connection.getParsedTransaction).not.toHaveBeenCalled();
  });

  // R23 (plan review r2 C1): which of two answers is right cannot be told
  it('a signature that two answers of one batch claim is unread: neither is returned or cached', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (_s: string[]) => [tx('a', 1), tx('b', 2), tx('a', 3)]),
      getParsedTransaction: jest.fn(),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b', 'c']);
    expect([...got.keys()]).toEqual(['b']);
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'a')})).toBeUndefined();
  });

  // R24 (plan review r2 C1)
  it('an answer that carries no signature, a short answer and a non-array answer leave their signatures unread', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (_s: string[]): Promise<unknown> => [{slot: 5, meta: {fee: 5000}}, tx('b', 2)]),
      getParsedTransaction: jest.fn(),
    };
    expect([...(await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b'])).keys()]).toEqual(['b']);
    connection.getParsedTransactions.mockResolvedValueOnce([tx('d', 4)]); // one answer for two signatures
    expect([...(await readParsedTransactions(connection as never, client, 'devnet', ['c', 'd'])).keys()]).toEqual(['d']);
    connection.getParsedTransactions.mockResolvedValueOnce({error: 'not an array'});
    expect((await readParsedTransactions(connection as never, client, 'devnet', ['e', 'f'])).size).toBe(0);
    expect(connection.getParsedTransaction).not.toHaveBeenCalled();
  });

  // R25 (plan review r2 C1 / n4): the single read checks its one answer the same way
  it('a single read answered with another transaction is null — in the fallback too, where it is not cached', async () => {
    const wrong = {getParsedTransaction: jest.fn(async (_s: string) => tx('other', 9))};
    expect(await readParsedTransaction(wrong as never, 'devnet', 'a')).toBeNull();
    const right = {getParsedTransaction: jest.fn(async (s: string) => tx(s, 4))};
    expect(await readParsedTransaction(right as never, 'devnet', 'a')).toEqual(tx('a', 4));
    _resetRateLimitersForTest();
    const connection = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('batch requests are not allowed');
      }),
      getParsedTransaction: jest.fn(async (s: string) => (s === 'b' ? tx('a', 9) : tx(s, 1))),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b', 'c']);
    expect([...got.keys()]).toEqual(['a', 'c']);
    expect(got.get('a')).toEqual(tx('a', 1)); // b's wrong answer did not overwrite a's own
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'b')})).toBeUndefined();
  });

  // R11 (r2 m2)
  it('the batch key is a hash of EVERY signature: two pages sharing a first signature never share an answer', async () => {
    const spy = jest.spyOn(rpcLimiter, 'execute');
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => shuffled(s.map(x => tx(x)))),
      getParsedTransaction: jest.fn(),
    };
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    await readParsedTransactions(connection as never, client, 'devnet', ['c', 'd']);
    client.clear();
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'd']);
    const keys = spy.mock.calls.map(c => c[0]);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect(keys.every(k => /^getParsedTransactions:devnet:[0-9a-f]{32}$/.test(k))).toBe(true);
    spy.mockRestore();
  });

  // R13
  it('more than 20 uncached signatures are read in batches of 20', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => shuffled(s.map(x => tx(x, Number(x.slice(1)))))),
      getParsedTransaction: jest.fn(),
    };
    const many = Array.from({length: 45}, (_, k) => `s${k}`);
    const got = await readParsedTransactions(connection as never, client, 'devnet', many);
    expect(got.size).toBe(45);
    expect(many.every(s => got.get(s)!.slot === Number(s.slice(1)))).toBe(true); // each under its own signature
    expect(connection.getParsedTransactions.mock.calls.map(c => c[0].length)).toEqual([20, 20, 5]);
  });

  // R18 (plan review r1 I6)
  it('a batch that never answers: its signatures stay unread and uncached, and are NOT asked for one at a time', async () => {
    const connection = {
      getParsedTransactions: jest.fn((_s: string[]): Promise<Array<RawParsedTx | null>> => never()),
      getParsedTransaction: jest.fn(async (s: string) => tx(s)),
    };
    const many = Array.from({length: 45}, (_, k) => `s${k}`);
    const {transactions: got, timedOut} = await readParsedTransactionsTimed(connection as never, client, 'devnet', many, SHORT);
    expect(timedOut).toBe(true);
    expect(got.size).toBe(0);
    expect(connection.getParsedTransaction).not.toHaveBeenCalled();
    expect(connection.getParsedTransactions).toHaveBeenCalledTimes(1); // no second batch after a timeout
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 's0')})).toBeUndefined();
    // the next read asks again, and is answered
    connection.getParsedTransactions.mockImplementation(async (s: string[]) => shuffled(s.map(x => tx(x, 2))));
    expect(await readParsedTransactionsTimed(connection as never, client, 'devnet', ['s0', 's1'], SHORT)).toEqual({
      transactions: new Map([
        ['s0', tx('s0', 2)],
        ['s1', tx('s1', 2)],
      ]),
      timedOut: false,
    });
  });

  // R19 (plan review r1 I6)
  it('the one-at-a-time path stops at the first read that never answers; what was read before it is kept', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('batch requests are not allowed');
      }),
      getParsedTransaction: jest.fn((s: string): Promise<RawParsedTx | null> => (s === 'b' ? never() : Promise.resolve(tx(s)))),
    };
    const {transactions: got, timedOut} = await readParsedTransactionsTimed(connection as never, client, 'devnet', ['a', 'b', 'c', 'd'], SHORT);
    expect(timedOut).toBe(true);
    expect([...got.keys()]).toEqual(['a']);
    expect(connection.getParsedTransaction.mock.calls.map(c => c[0])).toEqual(['a', 'b']);
  });

  // R26 (plan review r2 n2): a node that answers every single read, but slowly (or after web3.js waited out a 429)
  it('one deadline for the whole call: once the time limit has passed, no further single read is started', async () => {
    // final review 14: a SPIED clock (as R28), so a timer that fires late on a loaded machine cannot change the count
    let clock = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    const connection = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('429 Too Many Requests');
      }),
      // each read takes "25 ms": well inside its own 60 ms limit
      getParsedTransaction: jest.fn(async (s: string): Promise<RawParsedTx | null> => {
        clock += 25;
        return tx(s);
      }),
    };
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    const {transactions: got, timedOut} = await readParsedTransactionsTimed(connection as never, client, 'devnet', six, 60);
    expect(timedOut).toBe(true);
    // the reads start at 0, 25 and 50; at 75 the deadline (60) has passed
    expect(connection.getParsedTransaction.mock.calls.map(c => c[0])).toEqual(['a', 'b', 'c']);
    expect([...got.keys()]).toEqual(['a', 'b', 'c']); // what was read before the deadline is kept …
    expect(client.getQueryData(parsedTxKey('devnet', 'a'))).toEqual(tx('a')); // … and cached
  });

  // R27 (plan review r2 n2)
  it('one deadline for the whole call: no further batch is started either', async () => {
    let clock = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    const connection = {
      // each batch takes "40 ms": inside its own 60 ms limit
      getParsedTransactions: jest.fn(async (s: string[]): Promise<Array<RawParsedTx | null>> => {
        clock += 40;
        return shuffled(s.map(x => tx(x)));
      }),
      getParsedTransaction: jest.fn(),
    };
    const many = Array.from({length: 45}, (_, k) => `s${k}`);
    const {transactions: got, timedOut} = await readParsedTransactionsTimed(connection as never, client, 'devnet', many, 60);
    expect(timedOut).toBe(true);
    // batches start at 0 and 40; the third would start at 80, past the deadline
    expect(connection.getParsedTransactions).toHaveBeenCalledTimes(2);
    expect(got.size).toBe(40);
    expect(connection.getParsedTransaction).not.toHaveBeenCalled();
  });

  // R28 (controller ruling A, plan review r3 Minor 1): overrunning the deadline is reported even when no request timed out
  it('a call that ran past its time limit reports timedOut even though every read answered in time', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('429 Too Many Requests');
      }),
      // two reads of "40 ms" on a SPIED clock (no real delay: a slow machine cannot change the outcome):
      // each inside the 60 ms limit, together 80 ms
      getParsedTransaction: jest.fn(async (s: string): Promise<RawParsedTx | null> => {
        clock += 40;
        return tx(s);
      }),
    };
    let clock = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    const {transactions: got, timedOut} = await readParsedTransactionsTimed(connection as never, client, 'devnet', ['a', 'b'], 60);
    expect(connection.getParsedTransaction).toHaveBeenCalledTimes(2); // the second read WAS started
    expect(got.size).toBe(2); // both were read …
    expect(timedOut).toBe(true); // … and the call still says it ran out of time
  });

  // R20 (plan review r1 I6): #27's read
  it('a single read that never answers rejects with a TimeoutError', async () => {
    const connection = {getParsedTransaction: jest.fn((_s: string): Promise<RawParsedTx | null> => never())};
    await expect(readParsedTransaction(connection as never, 'devnet', 'a', SHORT)).rejects.toBeInstanceOf(TimeoutError);
  });

  // R29–R32 (final review 2): the limit is raced INSIDE the limiter's function, so it starts only once a slot is
  // free. Ten reads elsewhere in the app that never settle (they have no limit) hold every slot: a history read must
  // still settle, with a TimeoutError, instead of waiting in the queue for good.
  describe('while the limiter is full of reads that never settle', () => {
    const fillLimiter = (): void => {
      for (let k = 0; k < 10; k++) {
        rpcLimiter.execute(`hung:${k}`, () => never()).catch(() => undefined);
      }
    };

    // R29
    it('a signature page rejects with a TimeoutError, and no call was made', async () => {
      fillLimiter();
      const connection = {getSignaturesForAddress: jest.fn()};
      await expect(getSignaturePage(connection as never, 'devnet', WALLET, undefined, 20, SHORT)).rejects.toBeInstanceOf(TimeoutError);
      expect(connection.getSignaturesForAddress).not.toHaveBeenCalled();
    });

    // R30
    it('a single transaction read rejects with a TimeoutError', async () => {
      fillLimiter();
      const connection = {getParsedTransaction: jest.fn()};
      await expect(readParsedTransaction(connection as never, 'devnet', 'a', SHORT)).rejects.toBeInstanceOf(TimeoutError);
      expect(connection.getParsedTransaction).not.toHaveBeenCalled();
    });

    // R31
    it('a batch read settles with timedOut, nothing read and nothing cached', async () => {
      fillLimiter();
      const connection = {getParsedTransactions: jest.fn(), getParsedTransaction: jest.fn()};
      const {transactions: got, timedOut} = await readParsedTransactionsTimed(connection as never, client, 'devnet', ['a', 'b'], SHORT);
      expect(timedOut).toBe(true);
      expect(got.size).toBe(0);
      expect(connection.getParsedTransactions).not.toHaveBeenCalled();
      expect(client.getQueryData(parsedTxKey('devnet', 'a'))).toBeUndefined();
    });

    // R32
    it('the source list rejects with a TimeoutError', async () => {
      fillLimiter();
      const connection = {getParsedTokenAccountsByOwner: jest.fn()};
      await expect(listHistorySources(connection as never, 'devnet', WALLET, SHORT)).rejects.toBeInstanceOf(TimeoutError);
      expect(connection.getParsedTokenAccountsByOwner).not.toHaveBeenCalled();
    });
  });

  // R33 (final review 5): `live()` false once the batch answered — nothing is cached, and no further batch starts
  it('a read whose liveness ends while a batch is in flight caches nothing and starts no further batch', async () => {
    let alive = true;
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]): Promise<Array<RawParsedTx | null>> => {
        alive = false; // the wallet goes while this batch is answered
        return shuffled(s.map(x => tx(x)));
      }),
      getParsedTransaction: jest.fn(),
    };
    const many = Array.from({length: 25}, (_, k) => `s${k}`);
    await readParsedTransactionsTimed(connection as never, client, 'devnet', many, SHORT, () => alive);
    expect(connection.getParsedTransactions).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(parsedTxKey('devnet', 's0'))).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  // R12
  it('nothing to read: no call at all', async () => {
    const connection = {getParsedTransactions: jest.fn(), getParsedTransaction: jest.fn()};
    expect((await readParsedTransactions(connection as never, client, 'devnet', [])).size).toBe(0);
    expect(connection.getParsedTransactions).not.toHaveBeenCalled();
  });
});
