/**
 * History spec §3.3, §3.4: the hook — the query key, the account switch, "load older", and the
 * session dropped by #21's invalidation. `loadHistory` is scripted; real timers only (no fake timers
 * with async act — that hung CI in PR 1).
 */
import React from 'react';
import {renderHook, waitFor, act} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {HISTORY_STALE_MS, useActivityHistory, historyQueryKey} from '../useActivityHistory';
import {dropHistorySessionOnInvalidate} from '../../app/queryClient';
import {dropHistorySessions, historySession, peekHistorySession} from '../../modules/solana/historySession';
import type {HistorySnapshot} from '../../modules/solana/history';

const mockLoad = jest.fn();
jest.mock('../../modules/solana/history', () => ({loadHistory: (...args: unknown[]) => mockLoad(...args)}));
jest.mock('../../modules/solana/connection', () => ({getConnection: () => ({})}));

const A = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const B = 'AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR';
const snap = (signatures: string[], endReached = false): HistorySnapshot => ({
  sessionId: 1,
  rows: signatures.map((signature, k) => ({item: {signature, slot: 100 - k, blockTime: 1, status: 'finalized' as const, finalized: true}, activity: null})),
  endReached,
  coverage: {read: 0, total: 0},
});
const deps = {listSources: async () => ({sources: [], tokenAccountsTotal: 0}), fetchSignatures: async () => []};

let client: QueryClient;
const wrapper = ({children}: {children: React.ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  mockLoad.mockReset();
  dropHistorySessions();
  client = new QueryClient({defaultOptions: {queries: {retry: false}}});
});
afterEach(() => {
  client.clear();
});

// K1
it('the key keeps the txHistory prefix and holds the address, the cluster and the page size', () => {
  expect(historyQueryKey(A)).toEqual(['txHistory', A, 'mainnet-beta', 20]); // the jest Config mock's NETWORK
});

// K2
it('reads the head for the account and exposes the snapshot', async () => {
  mockLoad.mockResolvedValue(snap(['s1', 's2']));
  const {result} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mockLoad).toHaveBeenCalledWith(A, 'head', expect.objectContaining({cluster: 'mainnet-beta', client}));
  expect(result.current.data!.rows.map(r => r.item.signature)).toEqual(['s1', 's2']);
});

// K2b (plan review r1 m2; spec §3.3: a refresh can cost up to 25 signature calls)
it('the history stays fresh for 60 s: a second mount inside that time reads nothing', async () => {
  expect(HISTORY_STALE_MS).toBe(60_000);
  mockLoad.mockResolvedValue(snap(['s1']));
  const first = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
  const query = client.getQueryCache().find({queryKey: historyQueryKey(A)})!;
  expect(query.isStaleByTime(HISTORY_STALE_MS)).toBe(false);
  expect(query.observers[0]!.options.staleTime).toBe(60_000);
  first.unmount();
  // the test client's default staleTime is 0: without the hook's own, this mount would read again
  const second = renderHook(() => useActivityHistory(A), {wrapper});
  expect(second.result.current.data!.rows).toHaveLength(1);
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockLoad).toHaveBeenCalledTimes(1);
});

// K3
it('no account: nothing is read', () => {
  const {result} = renderHook(() => useActivityHistory(null), {wrapper});
  expect(mockLoad).not.toHaveBeenCalled();
  expect(result.current.data).toBeUndefined();
  expect(result.current.isSuccess).toBe(false);
});

// K4 (§3.4)
it("an account switch never shows the old account's rows, and drops its session and its cache entry", async () => {
  mockLoad.mockImplementation(async (account: string) => snap(account === A ? ['a1'] : ['b1']));
  historySession('mainnet-beta', A, deps);
  const {result, rerender} = renderHook(({account}: {account: string}) => useActivityHistory(account), {wrapper, initialProps: {account: A}});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data!.rows[0]!.item.signature).toBe('a1');
  rerender({account: B});
  expect(result.current.data).toBeUndefined(); // at once: never A's rows under B
  await waitFor(() => expect(result.current.data?.rows[0]?.item.signature).toBe('b1'));
  expect(peekHistorySession('mainnet-beta', A)).toBeUndefined();
  expect(client.getQueryData(historyQueryKey(A))).toBeUndefined();
});

// K5
it('loadOlder asks for the next page, replaces the snapshot, and is single-flight', async () => {
  mockLoad.mockResolvedValueOnce(snap(['s1']));
  const {result} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  let release: (s: HistorySnapshot) => void = () => undefined;
  mockLoad.mockImplementationOnce(() => new Promise<HistorySnapshot>(r => { release = r; }));
  let first: Promise<HistorySnapshot | null> = Promise.resolve(null);
  let second: Promise<HistorySnapshot | null> = Promise.resolve(null);
  act(() => {
    first = result.current.loadOlder();
    second = result.current.loadOlder();
  });
  await waitFor(() => expect(result.current.loadingOlder).toBe(true));
  expect(await second).toBeNull();
  await act(async () => {
    release(snap(['s1', 's2'], true));
    await first;
  });
  expect(mockLoad).toHaveBeenLastCalledWith(A, 'older', expect.anything());
  expect(mockLoad).toHaveBeenCalledTimes(2);
  expect(result.current.data!.rows).toHaveLength(2);
  expect(result.current.data!.endReached).toBe(true);
  expect(result.current.loadingOlder).toBe(false);
});

// K6
it('a failed loadOlder keeps the rows and resolves null', async () => {
  mockLoad.mockResolvedValueOnce(snap(['s1']));
  const {result} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  mockLoad.mockRejectedValueOnce(new Error('rpc down'));
  let got: HistorySnapshot | null = snap([]);
  await act(async () => {
    got = await result.current.loadOlder();
  });
  expect(got).toBeNull();
  expect(result.current.data!.rows).toHaveLength(1);
  expect(result.current.isError).toBe(false);
});

// K8 (Review Focus 3)
it('an older page that arrives after the account changed is dropped: never written into either list', async () => {
  mockLoad.mockImplementation(async (account: string) => snap(account === A ? ['a1'] : ['b1']));
  const {result, rerender} = renderHook(({account}: {account: string}) => useActivityHistory(account), {wrapper, initialProps: {account: A}});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  let release: (s: HistorySnapshot) => void = () => undefined;
  mockLoad.mockImplementationOnce(() => new Promise<HistorySnapshot>(r => { release = r; }));
  let older: Promise<HistorySnapshot | null> = Promise.resolve(null);
  act(() => {
    older = result.current.loadOlder(); // for A
  });
  rerender({account: B});
  await waitFor(() => expect(result.current.data?.rows[0]?.item.signature).toBe('b1'));
  await act(async () => {
    release(snap(['a1', 'a2']));
    expect(await older).toBeNull();
  });
  expect(result.current.data!.rows.map(r => r.item.signature)).toEqual(['b1']);
  expect(client.getQueryData(historyQueryKey(A))).toBeUndefined(); // A's entry is not brought back
});

// K7 (§3.3)
it("#21's invalidation of ['txHistory', address] drops that account's session, and only that one", async () => {
  const off = dropHistorySessionOnInvalidate(client);
  mockLoad.mockResolvedValue(snap(['s1']));
  const {result, unmount} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  unmount();
  historySession('mainnet-beta', A, deps);
  historySession('mainnet-beta', B, deps);
  await act(async () => {
    await client.invalidateQueries({queryKey: ['txHistory', A]});
  });
  expect(peekHistorySession('mainnet-beta', A)).toBeUndefined();
  expect(peekHistorySession('mainnet-beta', B)).toBeDefined();
  off();
});

// (a) controller requirement: a refetch and a "load older" never run loadHistory at the same time
it('a refetch during loadOlder waits for it: loadHistory calls never overlap', async () => {
  mockLoad.mockResolvedValueOnce(snap(['s1']));
  const {result} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  let running = 0;
  let overlapped = false;
  let releaseOlder: (s: HistorySnapshot) => void = () => undefined;
  mockLoad.mockImplementationOnce(() => {
    running += 1;
    return new Promise<HistorySnapshot>(r => {
      releaseOlder = s => {
        running -= 1;
        r(s);
      };
    });
  });
  mockLoad.mockImplementationOnce(async () => {
    running += 1;
    overlapped = running > 1;
    running -= 1;
    return snap(['s0', 's1', 's2']);
  });
  let older: Promise<HistorySnapshot | null> = Promise.resolve(null);
  let refetched: Promise<unknown> = Promise.resolve();
  act(() => {
    older = result.current.loadOlder();
    refetched = result.current.refetch();
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockLoad).toHaveBeenCalledTimes(2); // the refetch has not begun
  await act(async () => {
    releaseOlder(snap(['s1', 's2']));
    await older;
    await refetched;
  });
  expect(mockLoad).toHaveBeenCalledTimes(3);
  expect(overlapped).toBe(false);
  expect(result.current.data!.rows).toHaveLength(3);
});
