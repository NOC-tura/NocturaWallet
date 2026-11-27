/**
 * History spec §6.2, §6.3, §8 "Link scan": the rule against REAL devnet responses (the fixtures of
 * modules/solana/__tests__), and the paging against scripted sources. A DERIVED case names what it
 * changed. No timers, no storage: every read and write is handed in.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {LINK_SCAN_CAP, LINK_SCAN_PAGE, linkedSeedWallets, scanExitForLinks, transactionLinks} from '../linkScan';
import type {LinkScanDeps, LinkScanRecord} from '../linkScan';
import type {RawParsedTx} from '../../solana/txDetail';
import type {SignatureItem} from '../../solana/historySession';

const withKey = (tx: RawParsedTx, address: string): RawParsedTx => {
  const copy = JSON.parse(JSON.stringify(tx)) as RawParsedTx;
  copy.transaction!.message!.accountKeys!.push({pubkey: address, signer: false, writable: false} as never);
  return copy;
};
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

  // L8a / L8b (review M3) — DERIVED from 2XgjNKS8…: main (the exit here) is named by ONE side of the token balances only
  it('derived: the exit is an owner in the POST token balances only — still links', () => {
    const tx = load('tx-test-acc4-to-main-2XgjNKS8.json');
    const before = tx.meta!.preTokenBalances!.length;
    tx.meta!.preTokenBalances = tx.meta!.preTokenBalances!.filter(b => b.owner !== MAIN);
    expect(tx.meta!.postTokenBalances!.some(b => b.owner === MAIN)).toBe(true);
    expect(tx.meta!.preTokenBalances.length).toBeLessThanOrEqual(before);
    expect(transactionLinks(tx, MAIN, new Set([ACC_4]))).toBe(true);
  });
  it('derived: the exit is an owner in the PRE token balances only — still links', () => {
    const tx = load('tx-test-acc4-to-main-2XgjNKS8.json');
    tx.meta!.postTokenBalances = tx.meta!.postTokenBalances!.filter(b => b.owner !== MAIN);
    tx.meta!.preTokenBalances = [...tx.meta!.preTokenBalances!, {...tx.meta!.postTokenBalances![0]!, owner: MAIN}];
    expect(transactionLinks(tx, MAIN, new Set([ACC_4]))).toBe(true);
  });

  // L8c (review I1.2) — the matched set
  it('linkedSeedWallets names EVERY other seed wallet the transaction holds, never the exit, and [] when the exit is absent', () => {
    const tx = withKey(load('tx-test-to-main.json'), ACC_3);
    expect(linkedSeedWallets(tx, ACC_2, seedWithout(ACC_2)).sort()).toEqual([MAIN, ACC_3].sort());
    expect(linkedSeedWallets(tx, ACC_2, new Set([ACC_2, MAIN]))).toEqual([MAIN]);
    expect(linkedSeedWallets(load('tx-test-to-outside.json'), ACC_2, seedWithout(ACC_2))).toEqual([]);
    expect(linkedSeedWallets(load('tx-test-acc4-to-main-2XgjNKS8.json'), ACC_2, seedWithout(ACC_2))).toEqual([]);
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
    pendings: {} as Record<string, NonNullable<LinkScanRecord['pending']>>,
    txs: {} as Record<string, RawParsedTx>,
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
          out.set(s, world.txs[s] ?? (world.linking.has(s) ? LINKING : CLEAN));
        }
      }
      return out;
    },
    getRecord: (exit, source) => {
      const key = `${exit}/${source}`;
      return {cursor: world.cursors[key], pending: world.pendings[key]};
    },
    setRecord: (exit, source, record) => {
      const key = `${exit}/${source}`;
      if (record.cursor === undefined) {
        delete world.cursors[key];
      } else {
        world.cursors[key] = record.cursor;
      }
      if (record.pending === undefined) {
        delete world.pendings[key];
      } else {
        world.pendings[key] = record.pending;
      }
    },
    markLinked: wallets => {
      world.marked.push(...wallets);
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
    expect(world.marked).toEqual([ACC_2, MAIN]); // the exit AND the wallet it met (the registry itself never tags main: accountRegistry.test)
    expect(world.fetched.map(f => f.before)).toEqual([undefined, 's20', 's40', 's60', 's80', 's100']);
    expect(world.cursors).toEqual({});
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
    expect(world.marked).toEqual([ACC_2, MAIN]);
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

  // L15 (r2 m6, r3 m-d; review I2) — the cap ends the paging and the scan is 'capped', never 'clean'
  it('the cap: at most 300 signatures per source per scan; result capped; the OLD cursor is kept and the gap is recorded as pending', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 400)});
    expect(await scan(deps)).toBe('capped');
    expect(world.readCount).toBe(LINK_SCAN_CAP);
    // the cap also ends the PAGING: 15 signature pages of 20, not the source's whole list (21 fetches)
    expect(world.fetched).toHaveLength(LINK_SCAN_CAP / LINK_SCAN_PAGE);
    expect(world.cursors).toEqual({});
    expect(world.pendings[`${ACC_2}/${ACC_2}`]).toEqual({newest: 's1', resumeBelow: 's300'});
  });

  // L15a — the next scan resumes below the oldest signature read and promotes `pending.newest` once it reaches the end
  it('the next scan resumes at resumeBelow, finds a link beyond the first 300, and otherwise promotes the cursor and clears pending', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 400)});
    await scan(deps);
    world.fetched.length = 0;
    world.readCount = 0;
    expect(await scan(deps)).toBe('clean');
    // the head first (one fetch, nothing new above s1), then the gap from s300 down: 5 full pages and an empty one
    expect(world.fetched.map(f => f.before)).toEqual([undefined, 's300', 's320', 's340', 's360', 's380', 's400']);
    expect(world.readCount).toBe(100); // s301..s400 only
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s1');
    expect(world.pendings).toEqual({});

    const found = chain({[ACC_2]: run('s', 400)});
    found.world.linking.add('s350');
    expect(await scan(found.deps)).toBe('capped');
    expect(await scan(found.deps)).toBe('linked');
    expect(found.world.marked).toEqual([ACC_2, MAIN]);
  });

  // L15b
  it('a later scan with more than 300 new signatures keeps the old cursor, records pending, and the one after promotes it', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 10)});
    expect(await scan(deps)).toBe('clean');
    world.sources[ACC_2] = [...run('n', 320), ...world.sources[ACC_2]!];
    world.readCount = 0;
    world.fetched.length = 0;
    expect(await scan(deps)).toBe('capped');
    expect(world.readCount).toBe(LINK_SCAN_CAP);
    expect(world.fetched).toHaveLength(LINK_SCAN_CAP / LINK_SCAN_PAGE);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s1'); // the old cursor
    expect(world.pendings[`${ACC_2}/${ACC_2}`]).toEqual({newest: 'n1', resumeBelow: 'n300'});
    world.readCount = 0;
    expect(await scan(deps)).toBe('clean'); // n301..n320, then the old cursor s1
    expect(world.readCount).toBe(20); // the gap stops at the OLD cursor: s1..s10 are not read again
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('n1');
    expect(world.pendings).toEqual({});
  });

  // L15c
  it('an unread transaction while resuming → failed, and neither the cursor nor pending moves', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 400)});
    await scan(deps);
    const before = JSON.stringify([world.cursors, world.pendings]);
    world.unreadable.add('s350');
    expect(await scan(deps)).toBe('failed');
    expect(JSON.stringify([world.cursors, world.pendings])).toBe(before);
    expect(world.marked).toEqual([]);
  });

  // L15d — a second cap stop while resuming moves resumeBelow only
  it('a resume that is itself capped moves resumeBelow down and keeps pending.newest and the old cursor', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 700)});
    await scan(deps);
    expect(await scan(deps)).toBe('capped');
    expect(world.pendings[`${ACC_2}/${ACC_2}`]).toEqual({newest: 's1', resumeBelow: 's600'});
    expect(world.cursors).toEqual({});
  });

  // R1 — the reviewer's N1 repro: a trimmed page is never an end
  it('a gap pass trimmed by the budget is capped, never read as the end: the cursor does not jump past unread signatures', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 10)});
    expect(await scan(deps)).toBe('clean'); // cursor s1
    world.sources[ACC_2] = [...run('n', 598), ...world.sources[ACC_2]!];
    expect(await scan(deps)).toBe('capped'); // pending {n1, n300}
    world.sources[ACC_2] = [...run('m', 5), ...world.sources[ACC_2]!];
    world.linking.add('n597'); // in the tail the trimmed page would skip
    world.readCount = 0;
    expect(await scan(deps)).toBe('capped'); // head 5 + gap 295 of 298: n596..n598 stay
    expect(world.readCount).toBe(LINK_SCAN_CAP);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s1');
    expect(world.pendings[`${ACC_2}/${ACC_2}`]).toEqual({newest: 'm1', resumeBelow: 'n595'});
    expect(await scan(deps)).toBe('linked');
    expect(world.marked).toEqual([ACC_2, MAIN]);
  });

  // R2 — N2: the head is read first even while a gap is pending
  it('a link at the head is found on the next scan although a gap is still pending', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 2000)});
    expect(await scan(deps)).toBe('capped');
    world.sources[ACC_2] = [sig('h1'), ...world.sources[ACC_2]!];
    world.linking.add('h1');
    expect(await scan(deps)).toBe('linked');
    expect(world.marked).toEqual([ACC_2, MAIN]);
  });

  // R3 — N3: an unreadable transaction in the gap does not hide the head
  it('an unreadable transaction inside the pending gap does not hide a link at the head', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 1000)});
    await scan(deps);
    world.unreadable.add('s350');
    world.sources[ACC_2] = [sig('h1'), ...world.sources[ACC_2]!];
    world.linking.add('h1');
    expect(await scan(deps)).toBe('linked');
  });

  // R4 — an unread inside a range that caps: failed, the record is unchanged
  it('an unread transaction in a head pass that caps → failed, record unchanged; the same in a gap pass that caps', async () => {
    const head = chain({[ACC_2]: run('s', 400)});
    head.world.unreadable.add('s100');
    expect(await scan(head.deps)).toBe('failed');
    expect(head.world.cursors).toEqual({});
    expect(head.world.pendings).toEqual({});
    const gap = chain({[ACC_2]: run('s', 700)});
    await scan(gap.deps);
    const before = JSON.stringify(gap.world.pendings);
    gap.world.unreadable.add('s400');
    expect(await scan(gap.deps)).toBe('failed'); // s301..s600 is a capped gap pass holding s400
    expect(JSON.stringify(gap.world.pendings)).toBe(before);
    expect(gap.world.cursors).toEqual({});
  });

  // R5 — N5: a resume point that is not finalized is not stored
  it('a cap whose oldest signature is not finalized leaves the record unchanged', async () => {
    const all = run('s', 400);
    all[299] = sig('s300', false);
    const {world, deps} = chain({[ACC_2]: all});
    expect(await scan(deps)).toBe('capped');
    expect(world.cursors).toEqual({});
    expect(world.pendings).toEqual({});
  });

  // R5b — the same for a gap pass that caps
  it('a gap pass that caps on a non-finalized signature keeps resumeBelow where it was', async () => {
    const all = run('s', 700);
    all[599] = sig('s600', false);
    const {world, deps} = chain({[ACC_2]: all});
    await scan(deps);
    expect(await scan(deps)).toBe('capped');
    expect(world.pendings[`${ACC_2}/${ACC_2}`]).toEqual({newest: 's1', resumeBelow: 's300'});
  });

  // R7 (round 2, R2-1) — an unread in a head that did NOT cap, with a gap that ends clean
  it('an unreadable transaction in the head with a pending gap that ends clean → failed, the record is unchanged', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 400)});
    await scan(deps);
    world.sources[ACC_2] = [...run('h', 3), ...world.sources[ACC_2]!];
    world.unreadable.add('h2');
    const before = JSON.stringify([world.cursors, world.pendings]);
    expect(await scan(deps)).toBe('failed');
    expect(JSON.stringify([world.cursors, world.pendings])).toBe(before);
    expect(world.pendings[`${ACC_2}/${ACC_2}`]).toEqual({newest: 's1', resumeBelow: 's300'});
  });

  // R6 — promotion with nothing finalized in the head keeps the old cursor
  it('promotion with pending.newest undefined and nothing finalized in the head keeps the old cursor', async () => {
    const u = (n: number) => sig(`u${n}`, false);
    const {world, deps} = chain({[ACC_2]: [u(1), u(2), u(3), u(4), u(5)]});
    world.cursors[`${ACC_2}/${ACC_2}`] = 'u5';
    world.pendings[`${ACC_2}/${ACC_2}`] = {resumeBelow: 'u2'};
    expect(await scan(deps)).toBe('clean');
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('u5');
    expect(world.pendings).toEqual({});
  });

  // L15e (review I1.2) — B's scan that finds a transaction holding A marks both
  it('a link marks the exit AND every other seed wallet the transaction names', async () => {
    const {world, deps} = chain({[ACC_3]: run('s', 3)});
    world.txs.s2 = withKey(LINKING, ACC_3); // main + ACC_2 + ACC_3 in one transaction
    expect(await scanExitForLinks(ACC_3, seedWithout(ACC_3), deps)).toBe('linked');
    expect(world.marked.sort()).toEqual([ACC_3, ACC_2, MAIN].sort());
    expect(world.marked[0]).toBe(ACC_3);
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
