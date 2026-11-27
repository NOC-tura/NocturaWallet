/**
 * History spec (2026-11-26) §3.2, §3.4: the merged signature stream of ONE account on ONE cluster.
 *
 * WHY SOURCES: an SPL transfer into a token account that already exists does not list the recipient
 * wallet, so a wallet's history is read from the wallet address AND every token account it owns
 * (§3.1). Each source is paged on its own; this object merges them, newest first.
 *
 * STATE, per source: `buffer` (signatures fetched and not yet emitted, in the order the source
 * returned them), `cursor` (the last signature FETCHED — the `before` of the next fetch), `exhausted`
 * (the last fetch returned fewer than its limit), `newest` (the first signature ever fetched from the
 * source in this session — what a refresh pages down to).
 *
 * It lives OUTSIDE the query cache and holds signatures only: transactions are read and cached per
 * signature elsewhere (`historyReads.ts`). Every method that reads the chain is serialised (`run`): a
 * refresh and a "load older" never interleave.
 *
 * NOTHING IS LOST ON A FAILURE: a page that throws keeps what it had taken (`carry`) and what every
 * source had fetched; a refresh commits only when every source was read.
 */
import type {ActivityStatus} from './activity';

export const HISTORY_PAGE_SIZE = 20;
/** §3.2: the wallet plus at most 24 token accounts */
export const HISTORY_MAX_SOURCES = 25;
/** §3.4: a refresh that needs more pages than this for one source restarts the session */
export const HISTORY_REFRESH_MAX_PAGES = 5;

export interface SignatureItem {
  signature: string;
  slot: number;
  blockTime: number | null;
  /** from the signature list: `err` set → 'failed', else its confirmation status */
  status: ActivityStatus;
  /** the cluster finalized it — kept apart because a failed transaction's `status` is 'failed' (the link scan's cursor, spec §6.3) */
  finalized: boolean;
}

export interface SourceList {
  /** the wallet first, then its token accounts — at most HISTORY_MAX_SOURCES entries */
  sources: string[];
  /** every token account the wallet owns, read or not (the footer's {m}) */
  tokenAccountsTotal: number;
}

export interface HistorySessionDeps {
  listSources: () => Promise<SourceList>;
  /**
   * newest first; `before` undefined reads from the head. It must return the RPC page UNFILTERED: a page
   * shorter than `limit` marks the source exhausted, so a dropped item would end the history early.
   */
  fetchSignatures: (source: string, before: string | undefined, limit: number) => Promise<SignatureItem[]>;
}

interface SourceState {
  buffer: SignatureItem[];
  cursor: string | undefined;
  exhausted: boolean;
  newest: string | undefined;
}

/** newest first; within one slot by signature, so the order is fixed (it is not chain order, §3.2) */
function newerFirst(a: SignatureItem, b: SignatureItem): number {
  if (a.slot !== b.slot) {
    return b.slot - a.slot;
  }
  return a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0;
}

let nextId = 1;

export class HistorySession {
  private sessionId = nextId++;
  private sources: string[] | null = null;
  private tokenSources: ReadonlySet<string> = new Set();
  private total = 0;
  private state = new Map<string, SourceState>();
  private emitted = new Set<string>();
  private loaded: SignatureItem[] = [];
  private carry: SignatureItem[] = [];
  private pages = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: HistorySessionDeps) {}

  /** changes when the session restarts from the head (a restart drops every loaded page) */
  get id(): number {
    return this.sessionId;
  }

  /** every emitted signature, newest page first */
  get items(): readonly SignatureItem[] {
    return this.loaded;
  }

  get pagesLoaded(): number {
    return this.pages;
  }

  /** §3.2: every source is exhausted and every buffer is empty */
  get endReached(): boolean {
    if (this.sources === null || this.carry.length > 0) {
      return false;
    }
    return this.sources.every(s => {
      const st = this.state.get(s)!;
      return st.exhausted && st.buffer.length === 0;
    });
  }

  /** the token accounts this session reads (its sources without the wallet) */
  get tokenAccountSources(): ReadonlySet<string> {
    return this.tokenSources;
  }

  /** §3.2 footer: how many token accounts are read, of how many the wallet owns */
  get coverage(): {read: number; total: number} {
    return {read: Math.max(0, (this.sources?.length ?? 1) - 1), total: this.total};
  }

  /** The next page of up to HISTORY_PAGE_SIZE rows (the first call also reads the source list). */
  loadNextPage(): Promise<void> {
    return this.run(() => this.buildPage());
  }

  /** §3.4 pull-to-refresh: what is new goes on top; a possible hole restarts the session instead. */
  refresh(): Promise<void> {
    return this.run(() => this.doRefresh());
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private adopt(list: SourceList): void {
    this.sources = [...list.sources];
    this.total = list.tokenAccountsTotal;
    this.tokenSources = new Set(this.sources.slice(1));
    this.state = new Map(this.sources.map(s => [s, {buffer: [], cursor: undefined, exhausted: false, newest: undefined}]));
  }

  private async fetchInto(source: string): Promise<void> {
    const st = this.state.get(source)!;
    const first = st.cursor === undefined && !st.exhausted;
    const got = await this.deps.fetchSignatures(source, st.cursor, HISTORY_PAGE_SIZE);
    if (first && got.length > 0) {
      st.newest = got[0]!.signature;
    }
    st.buffer.push(...got);
    if (got.length > 0) {
      st.cursor = got[got.length - 1]!.signature;
    }
    st.exhausted = got.length < HISTORY_PAGE_SIZE;
  }

  private async buildPage(): Promise<void> {
    if (this.sources === null) {
      this.adopt(await this.deps.listSources());
    }
    if (this.pages > 0 && this.endReached) {
      return; // nothing older exists: no empty page
    }
    const sources = this.sources!;
    while (this.carry.length < HISTORY_PAGE_SIZE) {
      // before each take, every source whose buffer ran out is fetched: no row surfaces a page late (r3 m-b)
      const dry = sources.filter(s => {
        const st = this.state.get(s)!;
        return st.buffer.length === 0 && !st.exhausted;
      });
      // allSettled: a failed page leaves no sibling fetch in flight to land after the retry
      const settled = await Promise.allSettled(dry.map(s => this.fetchInto(s)));
      for (const result of settled) {
        if (result.status === 'rejected') {
          throw result.reason;
        }
      }
      let best: SourceState | null = null;
      for (const s of sources) {
        const st = this.state.get(s)!;
        const head = st.buffer[0];
        if (head !== undefined && (best === null || newerFirst(head, best.buffer[0]!) < 0)) {
          best = st;
        }
      }
      if (best === null) {
        break; // every source is exhausted and empty: the end of history
      }
      const item = best.buffer.shift()!;
      if (!this.emitted.has(item.signature)) {
        this.emitted.add(item.signature);
        this.carry.push(item);
      }
    }
    const page = this.carry.sort(newerFirst);
    this.carry = [];
    this.loaded = [...this.loaded, ...page];
    this.pages += 1;
  }

  private async restart(list: SourceList): Promise<void> {
    // built aside: the old list stays until the new page 1 was read
    const old = {
      sources: this.sources,
      total: this.total,
      tokenSources: this.tokenSources,
      state: this.state,
      emitted: this.emitted,
      loaded: this.loaded,
      carry: this.carry,
      pages: this.pages,
    };
    this.emitted = new Set();
    this.loaded = [];
    this.carry = [];
    this.pages = 0;
    this.adopt(list);
    try {
      await this.buildPage();
    } catch (error) {
      Object.assign(this, old);
      throw error;
    }
    this.sessionId = nextId++;
  }

  private async doRefresh(): Promise<void> {
    if (this.sources === null || this.pages === 0) {
      await this.buildPage();
      return;
    }
    const list = await this.deps.listSources();
    const known = new Set(this.sources);
    const sameSources = list.sources.length === known.size && list.sources.every(s => known.has(s));
    if (!sameSources) {
      await this.restart(list); // a new token account, or one that is gone: its rows could be anywhere
      return;
    }
    let hole = false;
    const perSource = await Promise.all(
      this.sources.map(async source => {
        const st = this.state.get(source)!;
        const fresh: SignatureItem[] = [];
        let before: string | undefined;
        for (let page = 1; ; page++) {
          if (page > HISTORY_REFRESH_MAX_PAGES) {
            hole = true;
            return fresh;
          }
          const got = await this.deps.fetchSignatures(source, before, HISTORY_PAGE_SIZE);
          for (const item of got) {
            if (item.signature === st.newest) {
              return fresh; // met what the session already knows
            }
            fresh.push(item);
          }
          if (got.length < HISTORY_PAGE_SIZE) {
            // the source ended. One that was empty has now been read whole; one that had a `newest`
            // and did not meet it has lost it (r4 q2): its rows can no longer be placed.
            if (st.newest !== undefined) {
              hole = true;
            }
            return fresh;
          }
          before = got[got.length - 1]!.signature;
        }
      }),
    );
    if (hole) {
      await this.restart(list);
      return;
    }
    // every source was read: commit
    this.total = list.tokenAccountsTotal;
    const added: SignatureItem[] = [];
    this.sources.forEach((source, at) => {
      const fresh = perSource[at]!;
      if (fresh.length > 0) {
        this.state.get(source)!.newest = fresh[0]!.signature;
      }
      for (const item of fresh) {
        if (!this.emitted.has(item.signature)) {
          this.emitted.add(item.signature);
          added.push(item);
        }
      }
    });
    if (added.length > 0) {
      this.loaded = [...added, ...this.loaded].sort(newerFirst);
    }
  }
}

const sessions = new Map<string, HistorySession>();
const keyOf = (cluster: string, account: string): string => `${cluster}:${account}`;

/** The account's session on this cluster, created on first use. */
export function historySession(cluster: string, account: string, deps: HistorySessionDeps): HistorySession {
  const key = keyOf(cluster, account);
  let session = sessions.get(key);
  if (session === undefined) {
    session = new HistorySession(deps);
    sessions.set(key, session);
  }
  return session;
}

export function peekHistorySession(cluster: string, account: string): HistorySession | undefined {
  return sessions.get(keyOf(cluster, account));
}

/** Drop one account's sessions (every cluster), or all of them. */
export function dropHistorySessions(account?: string): void {
  if (account === undefined) {
    sessions.clear();
    return;
  }
  for (const key of [...sessions.keys()]) {
    if (key.endsWith(`:${account}`)) {
      sessions.delete(key);
    }
  }
}

/** An account switch: every other account's session goes (§3.2). */
export function dropHistorySessionsExcept(account: string | null): void {
  for (const key of [...sessions.keys()]) {
    if (account === null || !key.endsWith(`:${account}`)) {
      sessions.delete(key);
    }
  }
}
