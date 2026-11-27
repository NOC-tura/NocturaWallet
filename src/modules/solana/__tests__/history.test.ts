/**
 * History spec §3, §8 "History reading": `loadHistory` against a scripted chain built from the REAL
 * fixtures. The connection is a plain object; the query client is real (the per-signature cache).
 * Real timers only: where a time limit is tested it is handed in (`env.timeoutMs`).
 *
 * Plan review r2 C1: the scripted node answers every batch OUT OF ORDER (`shuffled`), as the public
 * endpoints do, and the signatures here are the fixtures' own — a reader that pairs an answer with a
 * signature by position puts one transaction on another's row and fails H1.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {QueryClient} from '@tanstack/react-query';
import {_resetRateLimitersForTest} from '../rpcLimiter';
import {applyParsedTxDefaults} from '../historyReads';
import {dropHistorySessions} from '../historySession';
import {loadHistory} from '../history';
import type {HistoryEnv} from '../history';
import type {ActivityContext} from '../activity';
import type {RawParsedTx} from '../txDetail';

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as {result: RawParsedTx}).result;

const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const MAIN_TA = 'A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const ACC_4 = 'AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR';
const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// the fixtures' own signatures: an answer is matched to its row by the signature it carries (plan review r2 C1)
// QAgzVzY6…: Account 2 → main's EXISTING token account; main's wallet address is not in it (review C1)
const QAGZ = 'QAgzVzY6RhvmFWTiCueAyPfQY3qkyjXVZXXBnbYd9KXfkua1JEHJvxxSEjJbiwvQ2bCupghhRnY6WuwdQMGqgNY';
const XGJN = '2XgjNKS8cJ9LrFofPLJqgm4mFbHxgoDem4BpQCv1Hy3WMwHyyXKrpmKkHhqvcjPPAfZqEE7Ac3m4G71o5BXrEfds';
const BGSO = '2bGSoVSGjYHJC2VFvjG8eU16vwVEhsd9VzeCfHfdRowhXQ4bSVwmvgzQn18u29YY3T64RbBxL14XGo5qVxLFRtMH';
const FIXTURES: Record<string, RawParsedTx> = {
  [QAGZ]: load('tx-test-to-main.json'),
  [XGJN]: load('tx-test-acc4-to-main-2XgjNKS8.json'),
  [BGSO]: load('tx-sol-to-empty-2bGSoVSG.json'),
};
/** DERIVED: a fixture under another signature — the filler rows of a long list (only its signature is changed) */
const stamped = (fixture: RawParsedTx, signature: string): RawParsedTx => ({...fixture, transaction: {...fixture.transaction, signatures: [signature]}});
/** the same answers in another order: every position is wrong when there are two or more */
const shuffled = <T,>(answers: T[]): T[] => [...answers.slice(1), ...answers.slice(0, 1)];

const ctxFor = (own: ReadonlySet<string>): ActivityContext => ({
  symbolOf: m => (m === 'native' ? 'SOL' : m === TEST_MINT ? 'TEST' : 'short'),
  cluster: 'devnet',
  a0: {cluster: 'devnet', mint: TEST_MINT},
  feeTreasury: 'TREASURY',
  relayerFeePayer: 'RELAYER',
  jupiterProgramId: 'JUP',
  ownTokenAccounts: own,
});

interface Sig {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: string;
  err: unknown;
}
const sig = (signature: string, slot: number): Sig => ({signature, slot, blockTime: slot, confirmationStatus: 'finalized', err: null});

function world(bySource: Record<string, Sig[]>, tokenAccounts: Record<string, string[]>) {
  const state = {bySource, unreadable: new Set<string>(), signatureCalls: 0, txCalls: [] as string[][], filler: null as RawParsedTx | null};
  /** the node's answer for one signature: its fixture, else (when the test set one) the filler under that signature */
  const answer = (s: string): RawParsedTx | null =>
    state.unreadable.has(s) ? null : FIXTURES[s] ?? (state.filler === null ? null : stamped(state.filler, s));
  const connection = {
    getParsedTokenAccountsByOwner: jest.fn(async (owner: {toBase58: () => string}, filter: {programId: {toBase58: () => string}}) => ({
      value:
        filter.programId.toBase58() === TOKEN_2022
          ? []
          : (tokenAccounts[owner.toBase58()] ?? []).map(address => ({
              pubkey: {toBase58: () => address},
              account: {data: {parsed: {info: {mint: TEST_MINT, owner: owner.toBase58(), tokenAmount: {amount: '5', decimals: 9}}}}},
            })),
    })),
    getSignaturesForAddress: jest.fn(async (address: {toBase58: () => string}, options: {limit: number; before?: string}) => {
      state.signatureCalls += 1;
      const all = state.bySource[address.toBase58()] ?? [];
      const from = options.before === undefined ? 0 : all.findIndex(x => x.signature === options.before) + 1;
      return all.slice(from, from + options.limit);
    }),
    getParsedTransactions: jest.fn(async (signatures: string[]) => {
      state.txCalls.push(signatures);
      return shuffled(signatures.map(answer));
    }),
    getParsedTransaction: jest.fn(async (_signature: string): Promise<RawParsedTx | null> => null),
  };
  return {connection, state, answer};
}

let client: QueryClient;
const env = (connection: unknown): HistoryEnv => ({connection: connection as HistoryEnv['connection'], client, cluster: 'devnet', context: ctxFor});

beforeEach(() => {
  _resetRateLimitersForTest();
  dropHistorySessions();
  client = new QueryClient();
  applyParsedTxDefaults(client);
});
afterEach(() => {
  client.clear();
  jest.restoreAllMocks(); // a Date.now spy of one test never reaches the next
});

// H1 (review C1)
it("QAgzVzY6… appears in main's history through main's token-account source, as Received from Account 2", async () => {
  // the wallet's own signature list does not hold it: only the token account's does
  const {connection} = world({[MAIN]: [sig(BGSO, 100)], [MAIN_TA]: [sig(QAGZ, 300), sig(XGJN, 400)]}, {[MAIN]: [MAIN_TA]});
  const snap = await loadHistory(MAIN, 'head', env(connection));
  expect(snap.rows.map(r => r.item.signature)).toEqual([XGJN, QAGZ, BGSO]);
  const q = snap.rows[1]!.activity!;
  expect(q).toMatchObject({signature: QAGZ, slot: 300, blockTime: 300, kind: 'received', counterparty: ACC_2, status: 'finalized'});
  expect(q.primary).toMatchObject({mint: TEST_MINT, symbol: 'TEST', raw: 200000n, decimals: 9});
  expect(snap.rows[0]!.activity).toMatchObject({kind: 'received', counterparty: ACC_4});
  expect(snap.rows[2]!.activity).toMatchObject({kind: 'sent', counterparty: '2ixJm1hh6Ff8KuUCoaAe1myqKAT2PimVJ3B6ubuYQMr9'});
  expect(snap.endReached).toBe(true);
  expect(snap.coverage).toEqual({read: 1, total: 1});
});

// H2 (§3.4)
it('a partial row: a transaction that is not readable yet still has a row, and the next load re-tries it', async () => {
  const {connection, state} = world({[MAIN]: [sig(BGSO, 100)], [MAIN_TA]: [sig(QAGZ, 300)]}, {[MAIN]: [MAIN_TA]});
  state.unreadable.add(QAGZ);
  const first = await loadHistory(MAIN, 'head', env(connection));
  expect(first.rows.map(r => [r.item.signature, r.activity === null])).toEqual([
    [QAGZ, true],
    [BGSO, false],
  ]);
  expect(first.rows[0]!.item).toEqual({signature: QAGZ, slot: 300, blockTime: 300, status: 'finalized', finalized: true});
  state.unreadable.clear();
  const second = await loadHistory(MAIN, 'head', env(connection)); // a refresh
  expect(second.rows[0]!.activity).toMatchObject({kind: 'received'});
  // the second transaction read asked ONLY for the unparsed one (the other is cached)
  expect(state.txCalls).toEqual([[QAGZ, BGSO], [QAGZ]]);
});

// H7 (Review Focus 1)
it('a transaction the node refuses is one partial row; the rest of the page is parsed', async () => {
  const {connection} = world({[MAIN]: [sig(BGSO, 100), sig('refused', 90)], [MAIN_TA]: [sig(QAGZ, 300)]}, {[MAIN]: [MAIN_TA]});
  connection.getParsedTransactions.mockRejectedValue(new Error('failed to get transactions: Transaction version (2) is not supported'));
  connection.getParsedTransaction.mockImplementation(async (s: string) => {
    if (s === 'refused') {
      throw new Error('Transaction version (2) is not supported');
    }
    return FIXTURES[s] ?? null;
  });
  const snap = await loadHistory(MAIN, 'head', env(connection));
  expect(snap.rows.map(r => [r.item.signature, r.activity?.kind ?? 'partial'])).toEqual([
    [QAGZ, 'received'],
    [BGSO, 'sent'],
    ['refused', 'partial'],
  ]);
});

// H3 (§3.3)
it('the status of a row comes from the signature list; a failed one is failed', async () => {
  const failed: Sig = {...sig(BGSO, 100), err: {InstructionError: [0, 'Custom']}};
  const {connection} = world({[MAIN]: [failed]}, {});
  const snap = await loadHistory(MAIN, 'head', env(connection));
  expect(snap.rows[0]!.activity).toMatchObject({kind: 'failed', status: 'failed'});
});

// H4
it('older pages: "older" appends, "head" after that refreshes and keeps them', async () => {
  const many = Array.from({length: 45}, (_, k) => sig(`s${45 - k}`, 45 - k));
  const {connection, state} = world({[MAIN]: many}, {});
  const p1 = await loadHistory(MAIN, 'head', env(connection));
  expect(p1.rows).toHaveLength(20);
  expect(p1.endReached).toBe(false);
  const p2 = await loadHistory(MAIN, 'older', env(connection));
  expect(p2.rows).toHaveLength(40);
  state.bySource[MAIN] = [sig('new', 999), ...many];
  const p3 = await loadHistory(MAIN, 'head', env(connection));
  expect(p3.sessionId).toBe(p1.sessionId);
  expect(p3.rows).toHaveLength(41);
  expect(p3.rows[0]!.item.signature).toBe('new');
});

// H5 (§3.4)
it("an account switch never shows the old account's rows: sessions and rows are per account", async () => {
  const {connection} = world({[MAIN]: [sig(BGSO, 100)], [ACC_4]: [sig(XGJN, 400)]}, {});
  const a = await loadHistory(MAIN, 'head', env(connection));
  const b = await loadHistory(ACC_4, 'head', env(connection));
  expect(a.rows.map(r => r.item.signature)).toEqual([BGSO]);
  expect(b.rows.map(r => r.item.signature)).toEqual([XGJN]);
  expect(b.rows[0]!.activity).toMatchObject({kind: 'sent', counterparty: MAIN});
  expect(b.sessionId).not.toBe(a.sessionId);
});

// H9 (plan review r1 I5): web3.js fails a whole batch for one refused item
it('a signature the node never serves does not sit in the batch of a later page: it is read apart', async () => {
  const many = [sig('refused', 500), ...Array.from({length: 44}, (_, k) => sig(`s${44 - k}`, 44 - k))];
  const {connection} = world({[MAIN]: many}, {});
  const batches: string[][] = [];
  connection.getParsedTransactions.mockImplementation(async (signatures: string[]) => {
    batches.push(signatures);
    if (signatures.includes('refused')) {
      throw new Error('failed to get transactions: Transaction version (2) is not supported');
    }
    return shuffled(signatures.map(s => stamped(FIXTURES[BGSO]!, s)));
  });
  const singles: string[] = [];
  connection.getParsedTransaction.mockImplementation(async (s: string) => {
    singles.push(s);
    if (s === 'refused') {
      throw new Error('Transaction version (2) is not supported');
    }
    return stamped(FIXTURES[BGSO]!, s);
  });
  const p1 = await loadHistory(MAIN, 'head', env(connection));
  expect(p1.rows.filter(r => r.activity === null).map(r => r.item.signature)).toEqual(['refused']);
  expect(singles).toHaveLength(20); // page 1 holds it: that page, and only that one, is read one at a time
  batches.length = 0;
  singles.length = 0;
  const p2 = await loadHistory(MAIN, 'older', env(connection));
  expect(p2.rows).toHaveLength(40);
  expect(batches[0]).toHaveLength(20); // the new page's own batch …
  expect(batches[0]).not.toContain('refused'); // … without the old unparsed row, so it is answered whole
  expect(batches.slice(1)).toEqual([['refused']]);
  expect(singles).toEqual(['refused']); // no row of the new page was read one at a time
  expect(p2.rows.filter(r => r.activity === null).map(r => r.item.signature)).toEqual(['refused']);
});

// H12 (plan review r2 C1; spec §1.2 "a wrong row is worse than none")
it("a batch answered in another order, with a stranger's transaction in it: every row shows its OWN transaction or none", async () => {
  const {connection} = world({[MAIN]: [sig(BGSO, 100)], [MAIN_TA]: [sig(QAGZ, 300), sig(XGJN, 400)]}, {[MAIN]: [MAIN_TA]});
  // asked for [2Xgj, QAgz, 2bGS]; answered [2bGS, a transaction nobody asked for, 2Xgj] — nothing for QAgz
  const stranger = load('tx-test-to-outside.json');
  connection.getParsedTransactions.mockImplementationOnce(async () => [FIXTURES[BGSO]!, stranger, FIXTURES[XGJN]!]);
  const snap = await loadHistory(MAIN, 'head', env(connection));
  expect(snap.rows.map(r => [r.item.signature, r.activity?.kind ?? 'partial', r.activity?.counterparty ?? null])).toEqual([
    [XGJN, 'received', ACC_4],
    [QAGZ, 'partial', null], // never the stranger's transaction, never a neighbour's
    [BGSO, 'sent', '2ixJm1hh6Ff8KuUCoaAe1myqKAT2PimVJ3B6ubuYQMr9'],
  ]);
  // each cached under its own signature; nothing under QAgz, nothing under the stranger's
  expect(client.getQueryData(['parsedTx', 'devnet', XGJN])).toBe(FIXTURES[XGJN]);
  expect(client.getQueryData(['parsedTx', 'devnet', BGSO])).toBe(FIXTURES[BGSO]);
  expect(client.getQueryData(['parsedTx', 'devnet', QAGZ])).toBeUndefined();
  expect(client.getQueryData(['parsedTx', 'devnet', stranger.transaction!.signatures![0]!])).toBeUndefined();
  // the refresh asks for the one unread row again, and it is then itself
  const again = await loadHistory(MAIN, 'head', env(connection));
  expect(again.rows[1]!.activity).toMatchObject({kind: 'received', counterparty: ACC_2});
});

// H10 (plan review r1 m6; spec §4.6): the session's token accounts reach the classifier
it("the session's token accounts are handed to the classifier: an owner-less entry of one of them is incomplete", async () => {
  // DERIVED from QAgzVzY6…: main's token entries lose their `owner` (the classifier's test A35)
  const ownerless = load('tx-test-to-main.json');
  delete ownerless.meta!.preTokenBalances![1]!.owner;
  delete ownerless.meta!.postTokenBalances![1]!.owner;
  FIXTURES.ownerless = stamped(ownerless, 'ownerless');
  const {connection} = world({[MAIN]: [], [MAIN_TA]: [sig('ownerless', 300)]}, {[MAIN]: [MAIN_TA]});
  const snap = await loadHistory(MAIN, 'head', env(connection));
  delete FIXTURES.ownerless;
  // with an empty set the same transaction reads "no funds moved" (A35's second half): a wrong row
  expect(snap.rows[0]!.activity).toMatchObject({kind: 'unknown', incomplete: true, primary: null});
});

// H8 (plan review r1 I6): the session serialises its reads — one that never settles must not block the next
it('a signature read that never answers fails the load after the time limit; the next load is not stuck behind it', async () => {
  const {connection} = world({[MAIN]: [sig(BGSO, 100)]}, {});
  connection.getSignaturesForAddress.mockImplementationOnce(() => new Promise<never>(() => undefined));
  await expect(loadHistory(MAIN, 'head', {...env(connection), timeoutMs: 30})).rejects.toThrow('timed out');
  const ok = await loadHistory(MAIN, 'head', {...env(connection), timeoutMs: 30});
  expect(ok.rows.map(r => r.item.signature)).toEqual([BGSO]);
});

// H11 (plan review r1 I6)
it('transaction reads that never answer leave partial rows after the time limit: the list is shown, not held', async () => {
  const {connection} = world({[MAIN]: [sig(BGSO, 100)]}, {});
  connection.getParsedTransactions.mockImplementationOnce(() => new Promise<never>(() => undefined));
  const snap = await loadHistory(MAIN, 'head', {...env(connection), timeoutMs: 30});
  expect(snap.rows.map(r => [r.item.signature, r.activity === null])).toEqual([[BGSO, true]]);
  expect(connection.getParsedTransaction).not.toHaveBeenCalled();
  const again = await loadHistory(MAIN, 'head', {...env(connection), timeoutMs: 30}); // the refresh re-tries it
  expect(again.rows[0]!.activity).toMatchObject({kind: 'sent'});
});

// H13 (plan review r2 n2): the node ran out of time on this load's rows — it is not asked again for the older ones
it('after a transaction read that timed out the second read is not started; older rows keep what the cache holds', async () => {
  const many = Array.from({length: 45}, (_, k) => sig(`s${45 - k}`, 45 - k));
  const {connection, state} = world({[MAIN]: many}, {});
  state.filler = FIXTURES[BGSO]!;
  state.unreadable.add('s30'); // one row of page 1 stays unparsed: the second read of the next load would ask for it
  const p1 = await loadHistory(MAIN, 'head', {...env(connection), timeoutMs: 30});
  expect(p1.rows.filter(r => r.activity === null).map(r => r.item.signature)).toEqual(['s30']);
  state.txCalls.length = 0;
  connection.getParsedTransactions.mockImplementationOnce((signatures: string[]) => {
    state.txCalls.push(signatures);
    return new Promise<never>(() => undefined);
  });
  const p2 = await loadHistory(MAIN, 'older', {...env(connection), timeoutMs: 30});
  expect(state.txCalls).toHaveLength(1); // page 2's batch only: no ['s30'] read behind it
  expect(state.txCalls[0]).toHaveLength(20);
  expect(connection.getParsedTransaction).not.toHaveBeenCalled();
  // page 1's rows are still parsed (from the cache); page 2's are partial rows, not an error
  expect(p2.rows.slice(0, 20).filter(r => r.activity !== null)).toHaveLength(19);
  expect(p2.rows.slice(20).every(r => r.activity === null)).toBe(true);
  expect(p2.rows).toHaveLength(40);
  // the next load (a refresh that adds nothing) reads every row still unparsed: page 2's twenty and the old one
  state.txCalls.length = 0;
  state.unreadable.clear();
  const p3 = await loadHistory(MAIN, 'head', {...env(connection), timeoutMs: 30});
  expect(p3.rows.every(r => r.activity !== null)).toBe(true);
  expect(state.txCalls.map(c => c.length).sort()).toEqual([1, 20]);
});

// H14 (controller ruling A): a read that ran past the limit with every request answering in time also skips the second read
it('after a transaction read that overran the time limit without any request timing out, the second read is not started', async () => {
  const many = Array.from({length: 22}, (_, k) => sig(`s${22 - k}`, 22 - k));
  const {connection, state} = world({[MAIN]: many}, {});
  state.filler = FIXTURES[BGSO]!;
  state.unreadable.add('s10'); // one row of page 1 stays unparsed: the second read of the next load would ask for it
  await loadHistory(MAIN, 'head', {...env(connection), timeoutMs: 60});
  state.txCalls.length = 0;
  connection.getParsedTransactions.mockImplementation(async (signatures: string[]) => {
    state.txCalls.push(signatures);
    throw new Error('429 Too Many Requests');
  });
  // the two new rows are read one at a time, "40 ms" each on a SPIED clock (no real delay): inside each
  // request's limit, past the call's
  let clock = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  connection.getParsedTransaction.mockImplementation(async (s: string) => {
    clock += 40;
    return stamped(FIXTURES[BGSO]!, s);
  });
  const p2 = await loadHistory(MAIN, 'older', {...env(connection), timeoutMs: 60});
  expect(state.txCalls).toEqual([['s2', 's1']]); // no ['s10'] read behind it
  expect(connection.getParsedTransaction.mock.calls.map(c => c[0])).toEqual(['s2', 's1']);
  expect(p2.rows).toHaveLength(22);
  expect(p2.rows.filter(r => r.activity === null).map(r => r.item.signature)).toEqual(['s10']);
});

// H6 (§3.4)
it('a failed signature read throws: nothing is claimed about an account that was not read', async () => {
  const {connection} = world({[MAIN]: []}, {});
  connection.getSignaturesForAddress.mockRejectedValueOnce(new Error('rpc down'));
  await expect(loadHistory(MAIN, 'head', env(connection))).rejects.toThrow('rpc down');
  const ok = await loadHistory(MAIN, 'head', env(connection));
  expect(ok).toMatchObject({rows: [], endReached: true});
});
