/**
 * History spec §3.2, §3.4, §8 "History reading": the merged stream against scripted sources. A source
 * is a list of signatures, newest first; `fetchSignatures` pages it exactly as getSignaturesForAddress
 * does (`before` = exclusive cursor). No timers, no React.
 */
import {
  HistorySession,
  HISTORY_PAGE_SIZE,
  dropHistorySessions,
  dropHistorySessionsExcept,
  historySession,
  peekHistorySession,
} from '../historySession';
import type {HistorySessionDeps, SignatureItem, SourceList} from '../historySession';

const item = (signature: string, slot: number): SignatureItem => ({signature, slot, blockTime: slot * 10, status: 'finalized', finalized: true});
/** n items named `${name}${slot}`, slots from `top` down by `step` */
const run = (name: string, top: number, n: number, step = 1): SignatureItem[] =>
  Array.from({length: n}, (_, k) => item(`${name}${top - k * step}`, top - k * step));

function chain(sources: Record<string, SignatureItem[]>, total?: number) {
  const calls: Array<{source: string; before: string | undefined}> = [];
  // `owned`: every token account the wallet owns (by default the listed sources without the wallet)
  const world = {sources, list: Object.keys(sources), total, owned: null as string[] | null, failOn: null as string | null};
  const deps: HistorySessionDeps = {
    listSources: async (): Promise<SourceList> => {
      const tokenAccounts = world.owned ?? world.list.slice(1);
      return {sources: [...world.list], tokenAccounts, tokenAccountsTotal: world.total ?? tokenAccounts.length};
    },
    fetchSignatures: async (source, before, limit) => {
      calls.push({source, before});
      if (world.failOn === source) {
        throw new Error('rpc down');
      }
      const all = world.sources[source] ?? [];
      const from = before === undefined ? 0 : all.findIndex(x => x.signature === before) + 1;
      return all.slice(from, from + limit);
    },
  };
  return {deps, calls, world};
}
const sigs = (s: HistorySession): string[] => s.items.map(x => x.signature);

// S1 (r2 N5)
it('three sources with interleaved slots across two pages lose no row and repeat none', async () => {
  // W: 30 rows on even slots, T1: 15 on odd slots, T2: 5 rows that are ALSO in W (the same transactions)
  const W = run('w', 200, 30, 2);
  const T1 = run('t', 199, 15, 2);
  const T2 = [W[0]!, W[3]!, W[10]!, W[20]!, W[29]!];
  const {deps} = chain({W, T1, T2});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(s.items).toHaveLength(HISTORY_PAGE_SIZE);
  expect(s.endReached).toBe(false);
  await s.loadNextPage();
  await s.loadNextPage();
  const all = sigs(s);
  expect(all).toHaveLength(45); // 30 + 15; T2 adds nothing
  expect(new Set(all).size).toBe(45);
  const slots = s.items.map(x => x.slot);
  expect(slots).toEqual([...slots].sort((a, b) => b - a)); // newest first across pages
  expect(s.endReached).toBe(true);
});

// S2
it('within one slot the order is by signature; a page is at most 20 rows', async () => {
  const W = [item('b', 9), item('a', 9), item('c', 8)];
  const {deps} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(sigs(s)).toEqual(['a', 'b', 'c']);
});

// S3 (r3 m-b)
it('a source is fetched exactly when its buffer is empty and it is not exhausted; nothing is fetched twice', async () => {
  const W = run('w', 100, 45);
  const T = run('t', 1000, 3); // all newer than W
  const {deps, calls} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  // page 1: both heads; T (3 < 20) is exhausted at once and is never fetched again
  expect(calls).toEqual([
    {source: 'W', before: undefined},
    {source: 'T', before: undefined},
  ]);
  expect(sigs(s).slice(0, 3)).toEqual(['t1000', 't999', 't998']);
  await s.loadNextPage(); // W's buffer (3 left of 20) runs out mid-page → fetched with its cursor
  expect(calls.slice(2)).toEqual([{source: 'W', before: 'w81'}]);
  await s.loadNextPage();
  expect(calls.slice(3)).toEqual([{source: 'W', before: 'w61'}]);
  expect(s.items).toHaveLength(48);
  expect(s.endReached).toBe(true);
});

// S4
it('end of history: an empty account ends on the first page with zero rows', async () => {
  const {deps} = chain({W: []});
  const s = new HistorySession(deps);
  expect(s.endReached).toBe(false); // nothing was read yet: never "no transactions"
  await s.loadNextPage();
  expect(s.items).toEqual([]);
  expect(s.endReached).toBe(true);
  expect(s.pagesLoaded).toBe(1);
});

// S5
it('a failed source fails the page and loses nothing: the retry returns every row once', async () => {
  const W = run('w', 100, 5);
  const T = run('t', 200, 5);
  const {deps, world} = chain({W, T});
  const s = new HistorySession(deps);
  world.failOn = 'T';
  await expect(s.loadNextPage()).rejects.toThrow('rpc down');
  expect(s.items).toEqual([]);
  expect(s.endReached).toBe(false);
  expect(s.pagesLoaded).toBe(0);
  world.failOn = null;
  await s.loadNextPage();
  expect(sigs(s)).toEqual([...T, ...W].map(x => x.signature));
});

// S5b (plan review r1 I3): the failure comes AFTER rows were taken for the page
it('a source that fails in the middle of a page loses nothing: the rows already taken come back, once, on the retry', async () => {
  const W = run('w', 100, 45);
  const T = run('t', 1000, 3); // all newer than W
  const {deps, world} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage(); // t1000…t998 and w100…w84; W's buffer keeps w83, w82, w81
  world.failOn = 'W';
  // page 2 takes those three, W's buffer runs out, and the fetch that follows fails
  await expect(s.loadNextPage()).rejects.toThrow('rpc down');
  expect(s.items).toHaveLength(20);
  expect(s.pagesLoaded).toBe(1);
  expect(s.endReached).toBe(false);
  world.failOn = null;
  await s.loadNextPage();
  expect(sigs(s)).toEqual([...T, ...W.slice(0, 37)].map(x => x.signature)); // w83…w81 are there, and nothing twice
  await s.loadNextPage();
  expect(sigs(s)).toEqual([...T, ...W].map(x => x.signature));
  expect(s.endReached).toBe(true);
});

// S6 (r2 N6)
it('refresh: 45 new signatures on one source all appear, in order, above the old rows', async () => {
  const W = run('w', 100, 30);
  const {deps, world} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const id = s.id;
  const old = sigs(s);
  const fresh = run('n', 500, 45);
  world.sources.W = [...fresh, ...W];
  await s.refresh();
  expect(s.id).toBe(id); // not restarted
  expect(sigs(s)).toEqual([...fresh.map(x => x.signature), ...old]);
  // the older paging is untouched: the next page continues after w81
  await s.loadNextPage();
  expect(sigs(s).slice(-10)).toEqual(run('w', 80, 10).map(x => x.signature));
});

// S6b (plan review r1 I3): every token send is in the wallet's list AND in its token account's
it('refresh: one new signature present on two sources appears once', async () => {
  const W = run('w', 100, 5);
  const T = run('t', 50, 2);
  const {deps, world} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const old = sigs(s);
  const sent = item('sent', 999);
  world.sources.W = [sent, ...W];
  world.sources.T = [sent, ...T];
  await s.refresh();
  expect(sigs(s)).toEqual(['sent', ...old]);
});

// S6c (plan review r1 m7; spec §3.4 "sets `newest` to the new head")
it('refresh moves `newest` to the new head: the next refresh pages down to it, not to the first one', async () => {
  const W = run('w', 100, 30);
  const {deps, calls, world} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const id = s.id;
  const first = run('a', 500, 60);
  world.sources.W = [...first, ...W];
  calls.length = 0;
  await s.refresh();
  expect(calls).toHaveLength(4); // 3 full pages of new signatures, and the page that meets w100
  const second = run('b', 900, 60);
  world.sources.W = [...second, ...first, ...W];
  calls.length = 0;
  await s.refresh();
  expect(calls).toHaveLength(4); // down to a500 — paging down to w100 would be 120 signatures, past the 5-page cap
  expect(s.id).toBe(id); // so no false restart: the older rows stay
  expect(sigs(s)).toEqual([...second, ...first, ...W.slice(0, 20)].map(x => x.signature));
});

// S7 (r2 N6)
it('refresh past the 5-page cap restarts the session from the head', async () => {
  const W = run('w', 100, 30);
  const {deps, world} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  await s.loadNextPage();
  const id = s.id;
  world.sources.W = [...run('n', 900, 101), ...W]; // 101 new: the 6th page would be needed
  await s.refresh();
  expect(s.id).not.toBe(id);
  expect(s.pagesLoaded).toBe(1);
  expect(sigs(s)).toEqual(run('n', 900, 20).map(x => x.signature));
});

// S8 (r3 P1)
it('refresh with a second source that has emitted nothing yet takes only what is newer than its newest', async () => {
  const W = run('w', 500, 25);
  const T = run('t', 100, 4); // all older than page 1: fetched, buffered, not emitted
  const {deps, world} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(sigs(s).some(x => x.startsWith('t'))).toBe(false);
  const id = s.id;
  world.sources.T = [item('tNew', 900), ...T];
  await s.refresh();
  expect(s.id).toBe(id);
  expect(sigs(s)[0]).toBe('tNew');
  expect(sigs(s).filter(x => x.startsWith('t'))).toEqual(['tNew']); // T's old rows are still to come, once
  await s.loadNextPage();
  expect(sigs(s).filter(x => x.startsWith('t'))).toEqual(['tNew', 't100', 't99', 't98', 't97']);
  expect(new Set(sigs(s)).size).toBe(s.items.length);
});

// S9 (r3 P1, r4 q2)
it('a new token account, or a missing one, restarts the session', async () => {
  const W = run('w', 100, 30);
  const {deps, world} = chain({W, T: run('t', 50, 2)});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  await s.loadNextPage();
  let id = s.id;
  world.sources.T2 = run('x', 999, 1);
  world.list = ['W', 'T', 'T2'];
  await s.refresh();
  expect(s.id).not.toBe(id);
  expect(sigs(s)[0]).toBe('x999');
  expect(s.pagesLoaded).toBe(1);
  id = s.id;
  world.list = ['W', 'T2'];
  await s.refresh();
  expect(s.id).not.toBe(id);
  expect(s.tokenAccountSources).toEqual(new Set(['T2']));
});

// S10 (r4 q2)
it('a source that ends without meeting its newest restarts; one that was empty is simply read', async () => {
  const W = run('w', 100, 5);
  const {deps, world} = chain({W, E: []});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const id = s.id;
  world.sources.E = run('e', 300, 2); // E was empty: these are all new, no hole is possible
  await s.refresh();
  expect(s.id).toBe(id);
  expect(sigs(s)).toEqual(['e300', 'e299', ...W.map(x => x.signature)]);
  world.sources.W = run('z', 400, 3); // W's history was replaced: its newest is gone
  await s.refresh();
  expect(s.id).not.toBe(id);
});

// S11
it('a refresh that fails changes nothing', async () => {
  const W = run('w', 100, 5);
  const {deps, world} = chain({W, T: run('t', 50, 2)});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const before = sigs(s);
  world.sources.W = [item('new', 999), ...W];
  world.failOn = 'T';
  await expect(s.refresh()).rejects.toThrow('rpc down');
  expect(sigs(s)).toEqual(before);
  world.failOn = null;
  await s.refresh();
  expect(sigs(s)).toEqual(['new', ...before]);
});

// S12
it('a refresh and a load-older never interleave', async () => {
  const W = run('w', 100, 45);
  const {deps, world} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  world.sources.W = [item('new', 999), ...W];
  await Promise.all([s.refresh(), s.loadNextPage()]);
  expect(new Set(sigs(s)).size).toBe(41);
  expect(sigs(s)[0]).toBe('new');
});

// S13 (§3.2 bound)
it('coverage reports the token accounts read and owned', async () => {
  const sources: Record<string, SignatureItem[]> = {W: []};
  for (let k = 0; k < 24; k++) {
    sources[`T${k}`] = [];
  }
  const {deps, world} = chain(sources, 31);
  // the wallet owns 31 token accounts; 24 are read
  world.owned = [...Object.keys(sources).slice(1), ...Array.from({length: 7}, (_, k) => `U${k}`)];
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(s.coverage).toEqual({read: 24, total: 31});
  // final review 10: the classifier knows EVERY owned token account, read or not — an owner-less entry of the
  // 25th one still marks its row incomplete
  expect(s.tokenAccountSources.size).toBe(31);
  expect(s.tokenAccountSources.has('U6')).toBe(true);
  expect(s.tokenAccountSources.has('W')).toBe(false);
});

// final review 10: a refresh that keeps the read sources still takes in a token account past the 24 read
it('refresh: an unread token account that appears joins tokenAccountSources without a restart', async () => {
  const {deps, world} = chain({W: run('w', 100, 3), T: []});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const id = s.id;
  world.owned = ['T', 'U1'];
  world.total = 2;
  await s.refresh();
  expect(s.id).toBe(id);
  expect([...s.tokenAccountSources]).toEqual(['T', 'U1']);
  expect(s.coverage).toEqual({read: 1, total: 2});
});

// S14
it('the registry: one session per cluster and account; drops by account, by exception and all', async () => {
  const {deps} = chain({W: []});
  dropHistorySessions();
  const a = historySession('devnet', 'A', deps);
  expect(historySession('devnet', 'A', deps)).toBe(a);
  expect(historySession('mainnet-beta', 'A', deps)).not.toBe(a);
  const b = historySession('devnet', 'B', deps);
  dropHistorySessionsExcept('B');
  expect(peekHistorySession('devnet', 'A')).toBeUndefined();
  expect(peekHistorySession('mainnet-beta', 'A')).toBeUndefined();
  expect(peekHistorySession('devnet', 'B')).toBe(b);
  dropHistorySessions('B');
  expect(peekHistorySession('devnet', 'B')).toBeUndefined();
  historySession('devnet', 'A', deps);
  dropHistorySessions();
  expect(peekHistorySession('devnet', 'A')).toBeUndefined();
});

// ---- Task 3 review fixes (2026-11-27). Real timers only: `tick` yields to the event loop. ----
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** the same scripted world, but every fetch waits on one gate until `release()`; `started` records fetches as they begin */
function gated(sources: Record<string, SignatureItem[]>) {
  const base = chain(sources);
  const started: Array<{source: string; before: string | undefined}> = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const deps: HistorySessionDeps = {
    listSources: base.deps.listSources,
    fetchSignatures: async (source, before, limit) => {
      started.push({source, before});
      await gate;
      return base.deps.fetchSignatures(source, before, limit);
    },
  };
  return {deps, started, release, world: base.world};
}

// R1 (review Important 1): serialisation, pinned by a test that can fail
it('a refresh and a load-older never interleave (gated)', async () => {
  const W = run('w', 100, 45);
  const world = chain({W});
  let hold: Promise<void> | null = null;
  let open: () => void = () => undefined;
  const started: Array<{source: string; before: string | undefined}> = [];
  const deps: HistorySessionDeps = {
    listSources: world.deps.listSources,
    fetchSignatures: async (source, before, limit) => {
      started.push({source, before});
      if (hold !== null) {
        await hold;
      }
      return world.deps.fetchSignatures(source, before, limit);
    },
  };
  const s = new HistorySession(deps);
  await s.loadNextPage(); // w100…w81
  world.world.sources.W = [item('new', 999), ...W];
  hold = new Promise<void>(resolve => {
    open = resolve;
  });
  started.length = 0;
  const refreshing = s.refresh();
  const loading = s.loadNextPage();
  await tick();
  await tick();
  expect(started).toEqual([{source: 'W', before: undefined}]); // only the refresh's read: no {before: 'w81'} yet
  open();
  await Promise.all([refreshing, loading]);
  expect(started.slice(1)).toEqual([{source: 'W', before: 'w81'}]);
  expect(sigs(s)).toEqual(['new', ...run('w', 100, 40).map(x => x.signature)]);
});

it('two concurrent loadNextPage calls run one after the other', async () => {
  const W = run('w', 100, 45);
  const g = gated({W});
  const s = new HistorySession(g.deps);
  const a = s.loadNextPage();
  const b = s.loadNextPage();
  await tick();
  await tick();
  expect(g.started).toEqual([{source: 'W', before: undefined}]); // the second call has not begun
  g.release();
  await Promise.all([a, b]);
  expect(g.started).toEqual([
    {source: 'W', before: undefined},
    {source: 'W', before: 'w81'},
  ]);
  expect(s.pagesLoaded).toBe(2);
  expect(sigs(s)).toEqual(run('w', 100, 40).map(x => x.signature));
});

// R2 (review Important 2): the refresh commit places rows by (slot desc, signature asc)
it('refresh: a row found late on another source, older than one already loaded, is merged into place below it', async () => {
  const W = [item('y', 501), ...run('w', 100, 3)];
  const T = run('t', 50, 2);
  const {deps, world} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  world.sources.T = [item('x', 500), ...T]; // T's first read missed x; W's already holds y at 501
  await s.refresh();
  expect(sigs(s).slice(0, 3)).toEqual(['y', 'x', 'w100']);
});

// final review 8 (Ruling F): a refreshed row older than the oldest loaded one keeps its place after the next page
it('refresh: a late row older than every loaded row is merged into place, and stays in place after the next page', async () => {
  const W = run('w', 100, 40);
  const T = run('t', 10, 1);
  const {deps, world} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage(); // w100 … w81
  world.sources.T = [item('x', 60), ...T]; // a new signature at T's head, at a slot below every loaded row
  await s.refresh();
  expect(sigs(s).slice(-2)).toEqual(['w81', 'x']);
  await s.loadNextPage(); // w80 … w61 (and x's slot lies inside this page)
  const slots = s.items.map(i => i.slot);
  expect(slots).toEqual([...slots].sort((a, b) => b - a));
  expect(sigs(s).slice(19, 22)).toEqual(['w81', 'w80', 'w79']);
  expect(sigs(s).indexOf('x')).toBe(sigs(s).indexOf('w61') + 1);
});

// R3 (review Minor 1)
it('a restart whose first page fails keeps the list as it was', async () => {
  const W = run('w', 100, 30);
  // T also holds w81 (one transaction, two sources): page 1 ends on W's w81, so T's copy is still buffered
  const {deps, world, calls} = chain({W, T: [item('w81', 81), ...run('t', 50, 2)]});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const before = {items: s.items, pages: s.pagesLoaded, id: s.id, end: s.endReached, tokens: s.tokenAccountSources};
  world.sources.T2 = run('x', 999, 1);
  world.list = ['W', 'T', 'T2'];
  world.failOn = 'W'; // the restart's page 1 fails on W, after T and T2 were read: the restart's own state is not the old one
  await expect(s.refresh()).rejects.toThrow('rpc down');
  expect(s.items).toEqual(before.items);
  expect(s.pagesLoaded).toBe(before.pages);
  expect(s.id).toBe(before.id);
  expect(s.endReached).toBe(before.end);
  expect(s.tokenAccountSources).toEqual(before.tokens);
  // Task 3 re-review New 3: the next page continues the OLD session — each source from its cursor (one W:w81 read,
  // no head re-read) and with its emitted set (T's buffered copy of w81 is not shown twice)
  world.failOn = null;
  const mark = calls.length;
  await s.loadNextPage();
  expect(calls.slice(mark).filter(c => c.source === 'W')).toEqual([{source: 'W', before: 'w81'}]);
  expect(s.items).toHaveLength(32); // w100…w71 and t50, t49
  expect(new Set(sigs(s)).size).toBe(32);
  await s.refresh();
  expect(s.id).not.toBe(before.id);
  expect(sigs(s)[0]).toBe('x999');
});

// R4 (review Minor 2)
it('a failed page waits for its sibling fetches: the late result lands once and the retry does not re-fetch it', async () => {
  const W = run('w', 100, 5);
  const T = run('t', 200, 5);
  const calls: string[] = [];
  let failT = true;
  let openW: () => void = () => undefined;
  const gateW = new Promise<void>(resolve => {
    openW = resolve;
  });
  const deps: HistorySessionDeps = {
    listSources: async () => ({sources: ['W', 'T'], tokenAccounts: ['T'], tokenAccountsTotal: 1}),
    fetchSignatures: async (source, before) => {
      calls.push(`${source}:${String(before)}`);
      if (source === 'T' && failT) {
        throw new Error('rpc down');
      }
      if (source === 'W') {
        await gateW;
      }
      return before === undefined ? (source === 'W' ? W : T) : [];
    },
  };
  const s = new HistorySession(deps);
  let settled = false;
  const page = s.loadNextPage().then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await tick();
  await tick();
  expect(settled).toBe(false); // T failed at once, but W's read is still in flight
  openW();
  await page;
  failT = false;
  await s.loadNextPage();
  expect(calls.filter(c => c === 'W:undefined')).toHaveLength(1);
  expect(sigs(s)).toEqual([...T, ...W].map(x => x.signature));
});

// R5 (review Minor 3)
it('loadNextPage after the end of history does not count a page', async () => {
  const {deps} = chain({W: run('w', 100, 5)});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(s.endReached).toBe(true);
  await s.loadNextPage();
  expect(s.pagesLoaded).toBe(1);
  expect(s.items).toHaveLength(5);
});

// R6 (review Minor 4)
it('a same-slot tie across two sources and across a page boundary is ordered by signature', async () => {
  const mk = (names: string[]): SignatureItem[] => names.map(n => item(n, 7));
  const W = mk(Array.from({length: 15}, (_, k) => `m${String(2 * k).padStart(2, '0')}`));
  const T = mk(Array.from({length: 15}, (_, k) => `m${String(2 * k + 1).padStart(2, '0')}`));
  const {deps} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  await s.loadNextPage();
  expect(sigs(s)).toEqual(Array.from({length: 30}, (_, k) => `m${String(k).padStart(2, '0')}`));
});

it('a row without a block time keeps its place by slot and stays null', async () => {
  const W = [{...item('a', 9), blockTime: null}, item('b', 8)];
  const {deps} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(sigs(s)).toEqual(['a', 'b']);
  expect(s.items[0]!.blockTime).toBeNull();
});

// R7 (review Minor 5)
it('tokenAccountSources is the same object until the source list changes', async () => {
  const {deps, world} = chain({W: [], T: []});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const first = s.tokenAccountSources;
  expect(s.tokenAccountSources).toBe(first);
  await s.refresh(); // the same list: the same object
  expect(s.tokenAccountSources).toBe(first);
  world.sources.T2 = [];
  world.list = ['W', 'T', 'T2'];
  await s.refresh(); // a new token account: the session restarts with a new set
  expect(s.tokenAccountSources).not.toBe(first);
  expect([...s.tokenAccountSources]).toEqual(['T', 'T2']);
});
