/**
 * History spec §6.2, §6.3, §8 "Link scan": the rule against REAL devnet responses (the fixtures of
 * modules/solana/__tests__), and the paging against scripted sources. A DERIVED case names what it
 * changed. No timers, no storage: every read and write is handed in.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {LINK_SCAN_CAP, LINK_SCAN_PAGE, scanExitForLinks, transactionLinks} from '../linkScan';
import type {LinkScanDeps} from '../linkScan';
import type {RawParsedTx} from '../../solana/txDetail';
import type {SignatureItem} from '../../solana/historySession';

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, '../../solana/__tests__/fixtures', name), 'utf8')) as {result: RawParsedTx}).result;

const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const ACC_2_TA = '3WzwveDj8C6AGyiq5T13SeffM6HaP2zuc4rH1oW6QNu2';
const ACC_3 = '5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7';
const ACC_4 = 'AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR';
const seedWithout = (exit: string): Set<string> => new Set([MAIN, ACC_2, ACC_3, ACC_4].filter(a => a !== exit));

describe('transactionLinks (§6.2)', () => {
  // L1
  it('positive: QAgzVzY6… (Account 2 → main) links Account 2 — main is not a key, only an owner in the token balances', () => {
    expect(transactionLinks(load('tx-test-to-main.json'), ACC_2, seedWithout(ACC_2))).toBe(true);
  });

  // L2
  it('positive: 2XgjNKS8… (Account 4 → main) links Account 4', () => {
    expect(transactionLinks(load('tx-test-acc4-to-main-2XgjNKS8.json'), ACC_4, seedWithout(ACC_4))).toBe(true);
  });

  // L3
  it('negative: 54J9kjQ8… (the relayed Make public into Account 3) does not link Account 3', () => {
    expect(transactionLinks(load('tx-unshield-relayed-54J9kjQ8.json'), ACC_3, seedWithout(ACC_3))).toBe(false);
  });

  // L4
  it('negative: a send to an outside wallet (5i53q9tR…), and a transaction the exit is not in', () => {
    expect(transactionLinks(load('tx-test-to-outside.json'), ACC_2, seedWithout(ACC_2))).toBe(false);
    expect(transactionLinks(load('tx-test-acc4-to-main-2XgjNKS8.json'), ACC_2, seedWithout(ACC_2))).toBe(false);
  });

  // L5 — the real 2XgjNKS8… (a seed wallet sends into ANOTHER seed wallet's existing token account) read with the
  // RECIPIENT as the exit: the scanned wallet (Da83cA…) is absent from the account keys and present only as the owner
  // of the destination token account. No devnet transaction has an exit on that side yet; the shape is the same.
  it("positive: a seed wallet sends into the exit's EXISTING token account — the exit is absent from the keys", () => {
    const tx = load('tx-test-acc4-to-main-2XgjNKS8.json');
    const keys = tx.transaction!.message!.accountKeys!.map(k => k.pubkey);
    expect(keys).not.toContain(MAIN);
    expect(transactionLinks(tx, MAIN, new Set([ACC_4]))).toBe(true);
  });

  // L6 — DERIVED from QAgzVzY6…: `meta.err` is set
  it('a FAILED transaction with both sides links: it is public too', () => {
    const tx = load('tx-test-to-main.json');
    tx.meta!.err = {InstructionError: [2, 'Custom']};
    expect(transactionLinks(tx, ACC_2, seedWithout(ACC_2))).toBe(true);
  });

  // L7
  it('the exit itself is never its own other side, even if the caller left it in the set', () => {
    expect(transactionLinks(load('tx-test-to-outside.json'), ACC_2, new Set([ACC_2]))).toBe(false);
  });

  // L8 — DERIVED from QAgzVzY6…: the account keys are PublicKey-like objects, as web3.js hands them over
  it('reads account keys that are objects with toString()', () => {
    const tx = load('tx-test-to-main.json');
    tx.transaction!.message!.accountKeys = tx.transaction!.message!.accountKeys!.map(k => ({...k, pubkey: {toString: () => String(k.pubkey)}}));
    expect(transactionLinks(tx, ACC_2, seedWithout(ACC_2))).toBe(true);
  });
});

// ── the paging, against scripted sources ────────────────────────────────────────────────────────────

const LINKING = load('tx-test-to-main.json'); // links ACC_2 with main
const CLEAN = load('tx-test-to-outside.json'); // ACC_2 → an outside wallet
const sig = (signature: string, finalized = true): SignatureItem => ({signature, slot: 1, blockTime: 1, status: finalized ? 'finalized' : 'confirmed', finalized});
const run = (name: string, n: number): SignatureItem[] => Array.from({length: n}, (_, k) => sig(`${name}${k + 1}`));

function chain(sources: Record<string, SignatureItem[]>) {
  const world = {
    sources,
    cursors: {} as Record<string, string>,
    linking: new Set<string>(),
    unreadable: new Set<string>(),
    failSource: null as string | null,
    marked: [] as string[],
    fetched: [] as Array<{source: string; before: string | undefined}>,
    readCount: 0,
  };
  const deps: LinkScanDeps = {
    listSources: async () => Object.keys(world.sources),
    fetchSignatures: async (source, before, limit) => {
      world.fetched.push({source, before});
      if (world.failSource === source) {
        throw new Error('rpc down');
      }
      const all = world.sources[source]!;
      const from = before === undefined ? 0 : all.findIndex(x => x.signature === before) + 1;
      return all.slice(from, from + limit);
    },
    readTransactions: async signatures => {
      world.readCount += signatures.length;
      const out = new Map<string, RawParsedTx>();
      for (const s of signatures) {
        if (!world.unreadable.has(s)) {
          out.set(s, world.linking.has(s) ? LINKING : CLEAN);
        }
      }
      return out;
    },
    getCursor: (exit, source) => world.cursors[`${exit}/${source}`],
    setCursor: (exit, source, signature) => {
      world.cursors[`${exit}/${source}`] = signature;
    },
    markLinked: exit => {
      world.marked.push(exit);
    },
  };
  return {world, deps};
}
const scan = (deps: LinkScanDeps) => scanExitForLinks(ACC_2, seedWithout(ACC_2), deps);

describe('scanExitForLinks (§6.3)', () => {
  // L9
  it('150 new signatures with the link at the 120th are found by `before` paging; the exit is marked, no cursor is written', async () => {
    const all = run('s', 150);
    const {world, deps} = chain({[ACC_2]: all});
    world.linking.add('s120');
    expect(await scan(deps)).toBe('linked');
    expect(world.marked).toEqual([ACC_2]);
    expect(world.fetched.map(f => f.before)).toEqual([undefined, 's20', 's40', 's60', 's80', 's100']);
    expect(world.cursors).toEqual({});
    expect(world.marked).not.toContain(MAIN); // main is never passed to markLinked
  });

  // L10
  it('a clean source moves its cursor to the newest FINALIZED signature read; the next scan reads only what is above it', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 45)});
    expect(await scan(deps)).toBe('clean');
    expect(world.marked).toEqual([]);
    expect(world.cursors).toEqual({[`${ACC_2}/${ACC_2}`]: 's1'});
    expect(world.readCount).toBe(45);
    // two new signatures arrive
    world.sources[ACC_2] = [sig('n2'), sig('n1'), ...world.sources[ACC_2]!];
    world.readCount = 0;
    world.fetched.length = 0;
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(2); // matched by value at the cursor: nothing below it is read again
    expect(world.fetched).toHaveLength(1);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('n2');
  });

  // L11
  it('a confirmed-only signature is scanned but never becomes the cursor', async () => {
    const {world, deps} = chain({[ACC_2]: [sig('c2', false), sig('c1', false), sig('f1'), sig('f0')]});
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(4);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('f1');
    // nothing finalized at all: no cursor is written
    const young = chain({[ACC_2]: [sig('c2', false), sig('c1', false)]});
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), young.deps)).toBe('clean');
    expect(young.world.cursors).toEqual({});
  });

  // L12
  it('a transaction that cannot be read → failed, and that source\'s cursor is unmoved', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 5)});
    world.cursors[`${ACC_2}/${ACC_2}`] = 's5';
    world.unreadable.add('s3');
    expect(await scan(deps)).toBe('failed');
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s5');
    expect(world.marked).toEqual([]);
  });

  // L13
  it('an unreadable transaction does not hide a link further down the same source', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 30)});
    world.unreadable.add('s2');
    world.linking.add('s25');
    expect(await scan(deps)).toBe('linked');
    expect(world.marked).toEqual([ACC_2]);
  });

  // L14
  it('a failed source does not stop the others: a link in the token-account source is still found', async () => {
    const {world, deps} = chain({[ACC_2]: run('w', 3), [ACC_2_TA]: run('t', 3)});
    world.failSource = ACC_2;
    world.linking.add('t2');
    expect(await scan(deps)).toBe('linked');
    // with no link anywhere the result is failed, and only the readable source's cursor moves
    const second = chain({[ACC_2]: run('w', 3), [ACC_2_TA]: run('t', 3)});
    second.world.failSource = ACC_2;
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), second.deps)).toBe('failed');
    expect(second.world.cursors).toEqual({[`${ACC_2}/${ACC_2_TA}`]: 't1'});
  });

  // L15 (r2 m6, r3 m-d)
  it('the cap: at most 300 signatures per source per scan, first or later; the cursor is still set', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 400)});
    world.linking.add('s350'); // beyond the cap: not found (spec §9)
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(LINK_SCAN_CAP);
    // the cap also ends the PAGING: 15 signature pages of 20, not the source's whole list (21 fetches)
    expect(world.fetched).toHaveLength(LINK_SCAN_CAP / LINK_SCAN_PAGE);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s1');
    // a LATER scan with more than 300 new signatures above the cursor is capped the same way
    world.sources[ACC_2] = [...run('n', 320), ...world.sources[ACC_2]!];
    world.readCount = 0;
    world.fetched.length = 0;
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(LINK_SCAN_CAP);
    expect(world.fetched).toHaveLength(LINK_SCAN_CAP / LINK_SCAN_PAGE);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('n1');
  });

  // L16
  it('an empty source, and a source list that cannot be read', async () => {
    const empty = chain({[ACC_2]: []});
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), empty.deps)).toBe('clean');
    expect(empty.world.cursors).toEqual({});
    const {deps} = chain({[ACC_2]: run('s', 2)});
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), {...deps, listSources: async () => { throw new Error('rpc down'); }})).toBe('failed');
  });

  // L17
  it('a cursor that is no longer in the list (pruned history) reads to the end or the cap, never forever', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 30)});
    world.cursors[`${ACC_2}/${ACC_2}`] = 'gone';
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(30);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s1');
  });

  // L18
  it('a registry that cannot be written reports failed: the next scan finds the link again', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 2)});
    world.linking.add('s1');
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), {...deps, markLinked: () => { throw new Error('locked'); }})).toBe('failed');
    expect(world.cursors).toEqual({});
  });
});
