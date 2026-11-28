/** M1d review M4: a wipe or an import drops the old wallet's per-account query entries from memory. */
import {clearAllStores, initSecureMmkv} from '../../store/mmkv/instances';
import {queryClient} from '../queryClient';
import {PARSED_TX_GC_MS, parsedTxKey} from '../../modules/solana/historyReads';
import {dropHistorySessions, historyLiveness, historySession, peekHistorySession} from '../../modules/solana/historySession';

const A = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const B = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const deps = {listSources: async () => ({sources: [], tokenAccounts: [], tokenAccountsTotal: 0}), fetchSignatures: async () => []};

beforeEach(() => {
  queryClient.clear();
  dropHistorySessions();
  queryClient.setQueryData(['accountSnapshot', A], {solBalance: '1'});
  queryClient.setQueryData(['txHistory', A, undefined], []);
  queryClient.setQueryData(['prices'], {keep: true});
  // history spec §3.3: a raw transaction of the old wallet, and its history session
  queryClient.setQueryData(parsedTxKey('devnet', 'SIG'), {slot: 1});
  historySession('devnet', A, deps);
});
afterAll(() => {
  queryClient.clear();
  dropHistorySessions();
});

it('wipe (clearAllStores) removes accountSnapshot and txHistory entries, not unrelated ones', () => {
  clearAllStores();
  expect(queryClient.getQueryData(['accountSnapshot', A])).toBeUndefined();
  expect(queryClient.getQueryData(['txHistory', A, undefined])).toBeUndefined();
  expect(queryClient.getQueryData(['prices'])).toEqual({keep: true});
});

it('import (initSecureMmkv) removes them too', () => {
  initSecureMmkv('the-next-wallet');
  expect(queryClient.getQueryData(['accountSnapshot', A])).toBeUndefined();
  expect(queryClient.getQueryData(['txHistory', A, undefined])).toBeUndefined();
});

// history spec §3.3
it('a wipe and an import also clear every parsedTx entry and every history session', () => {
  clearAllStores();
  expect(queryClient.getQueryData(parsedTxKey('devnet', 'SIG'))).toBeUndefined();
  expect(peekHistorySession('devnet', A)).toBeUndefined();
  queryClient.setQueryData(parsedTxKey('devnet', 'SIG'), {slot: 1});
  historySession('devnet', A, deps);
  initSecureMmkv('the-next-wallet');
  expect(queryClient.getQueryData(parsedTxKey('devnet', 'SIG'))).toBeUndefined();
  expect(peekHistorySession('devnet', A)).toBeUndefined();
});

// final review 5: a load begun before a wipe or an import is no longer live after it
it('a wipe and an import end the liveness of every history load begun before them', () => {
  const beforeWipe = historyLiveness();
  expect(beforeWipe()).toBe(true);
  clearAllStores();
  expect(beforeWipe()).toBe(false);
  const beforeImport = historyLiveness();
  initSecureMmkv('the-next-wallet');
  expect(beforeImport()).toBe(false);
  expect(historyLiveness()()).toBe(true); // a load of the new wallet is live
});

// history spec §3.3: the client default of 5 min would collect them
it('parsedTx entries of the app client never go stale and are kept for 24 h', () => {
  const query = queryClient.getQueryCache().find({queryKey: parsedTxKey('devnet', 'SIG')})!;
  expect(query.gcTime).toBe(PARSED_TX_GC_MS);
  expect(PARSED_TX_GC_MS).toBe(24 * 60 * 60 * 1000);
  expect(query.isStale()).toBe(false);
  // every other entry keeps the client default
  expect(queryClient.getQueryCache().find({queryKey: ['prices']})!.gcTime).toBe(5 * 60_000);
});

// history spec §3.3: #21 invalidates ['txHistory', address] (TransactionStatusScreen) — the prefix must keep matching
it("invalidating ['txHistory', address] drops that account's history session, and no other", async () => {
  queryClient.setQueryData(['txHistory', A, 'devnet', 20], {rows: []});
  historySession('devnet', B, deps);
  await queryClient.invalidateQueries({queryKey: ['txHistory', A]});
  expect(peekHistorySession('devnet', A)).toBeUndefined();
  expect(peekHistorySession('devnet', B)).toBeDefined();
  expect(queryClient.getQueryState(['txHistory', A, 'devnet', 20])!.isInvalidated).toBe(true);
});
