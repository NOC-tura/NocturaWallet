import {FROM_PROVIDER, FROM_RELAY, METHOD_TYPES, PAGE_PORT} from './protocol';

/**
 * The relay (spec §1.2; review 1 H1, L7, review 2 M1, M5, M8; C9, C16): the isolated-world content script between the
 * page and the background. It decides nothing and adds nothing but the request id it received:
 *  - it accepts a window message only from this window (`event.source === window`), with `source: 'noctura-provider'`
 *    and one of the five method types; it originates `page.resume`, `page.ack` and `page.ping` itself — the same
 *    types from the page are dropped;
 *  - it opens its port lazily, on the document's first request — never at load, never while `document.prerendering`
 *    (it waits for `prerenderingchange`) — and, once the document has asked, keeps one: on `onDisconnect` it reconnects
 *    (0.5 s, 1 s, 2 s, then on `visibilitychange`), re-sends what was not yet accepted (the same id: the same request)
 *    and sends `page.resume` for every request it still awaits;
 *  - while it awaits a result it sends `page.ping` every 20 s (Chrome: a port message keeps the worker alive);
 *  - it posts answers and `change` events to the page (targetOrigin = location.origin) and acks each answer.
 */
export const BACKOFF_MS = [500, 1000, 2000];
export const PING_MS = 20_000;
const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** The background answers at most 16 ids per resume. */
const RESUME_BATCH = 16;

export interface PortLike {
  postMessage(m: unknown): void;
  disconnect(): void;
  onMessage: {addListener(cb: (m: unknown) => void): void};
  onDisconnect: {addListener(cb: () => void): void};
}

export interface RelayEnv {
  win: Window;
  doc: Document;
  connect(name: string): PortLike;
  setTimeout(f: () => void, ms: number): unknown;
  setInterval(f: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function startRelay(env: RelayEnv): void {
  const {win, doc} = env;
  let port: PortLike | null = null;
  let asked = false;
  let failures = 0;
  let pinger: unknown = null;
  /** Requests sent but not yet accepted (or answered at once), by the page's id: re-sent after a reconnect. */
  const unaccepted = new Map<string, Record<string, unknown>>();
  /** Accepted requests whose answer has not come: requestId → the page's id. */
  const awaited = new Map<string, string>();

  /**
   * Review 1 IMPORTANT: ports.ts' origin rule serves only an `https:` top-frame origin — it disconnects anything
   * else at once, with no answer. A non-https page (http:, file:, an http://localhost dev server) or an opaque one
   * (a sandboxed frame: `location.origin === 'null'`) can therefore never be served; connecting anyway would just
   * retry forever (0.5/1/2 s, then every `visibilitychange`) while the page's promise never settles. So: answer
   * locally, without ever opening a port, whenever this document could not be served.
   */
  const servable = () => win.location.protocol === 'https:' && win.location.origin !== 'null';

  const toPage = (m: Record<string, unknown>) => {
    try {
      win.postMessage({source: FROM_RELAY, ...m}, win.location.origin);
    } catch {
      // Defensive, same cause as the IMPORTANT fix above: an opaque document's targetOrigin ('null') throws a
      // SyntaxError in compliant browsers. Nothing could be delivered to it anyway (its own provider's postMessage
      // would already have thrown first) — never let this escape the event listener uncaught.
    }
  };
  const send = (m: Record<string, unknown>) => {
    try {
      port?.postMessage(m);
    } catch {
      // The port died: onDisconnect reconnects.
    }
  };

  const keepAlive = () => {
    const busy = unaccepted.size + awaited.size > 0;
    if (busy && pinger === null) pinger = env.setInterval(() => send({type: 'page.ping'}), PING_MS);
    if (!busy && pinger !== null) {
      env.clearInterval(pinger);
      pinger = null;
    }
  };

  const answer = (pageId: string, m: Record<string, unknown>) => {
    unaccepted.delete(pageId);
    if ('error' in m) toPage({id: pageId, error: m.error});
    else toPage({id: pageId, result: m.result});
  };

  /**
   * Review 1 promoted Minor: an orphaned content script (the extension updated or reloaded) sees its
   * `runtime.connect` throw ("Extension context invalidated") — nothing here can recover a dead extension context,
   * so every request still outstanding is answered a stable code (C10) instead of hanging forever.
   */
  const failPending = () => {
    for (const id of unaccepted.keys()) toPage({id, error: 'timeout'});
    for (const id of awaited.values()) toPage({id, error: 'timeout'});
    unaccepted.clear();
    awaited.clear();
    keepAlive();
  };

  const onPortMessage = (m: unknown) => {
    if (!isObj(m)) return;
    // The background answered: this connection works, the backoff starts over.
    failures = 0;
    if (m.event === 'change' && Array.isArray(m.accounts)) {
      toPage({event: 'change', accounts: m.accounts});
      return;
    }
    if (Array.isArray(m.resume)) {
      for (const r of m.resume as unknown[]) if (isObj(r)) onPortMessage(r.unknown === true ? {requestId: r.requestId, error: 'timeout'} : r.pending === true ? null : r);
      return;
    }
    if (typeof m.id === 'string') {
      if (m.accepted === true && typeof m.requestId === 'string') {
        unaccepted.delete(m.id);
        awaited.set(m.requestId, m.id);
      } else if ('result' in m || 'error' in m) {
        answer(m.id, m);
      }
      keepAlive();
      return;
    }
    if (typeof m.requestId === 'string' && ('result' in m || 'error' in m)) {
      const pageId = awaited.get(m.requestId);
      if (pageId === undefined) return;
      awaited.delete(m.requestId);
      answer(pageId, m);
      send({type: 'page.ack', requestId: m.requestId});
      keepAlive();
    }
  };

  const open = () => {
    if (port !== null) return;
    // Document.prerendering (Chrome 108+; absent elsewhere, where a page is never prerendered).
    if ((doc as Document & {prerendering?: boolean}).prerendering === true) return;
    let p: PortLike;
    try {
      p = env.connect(PAGE_PORT);
    } catch {
      // Review 1 promoted Minor: the extension context is gone — this content script is orphaned, permanently.
      failPending();
      return;
    }
    port = p;
    p.onMessage.addListener(onPortMessage);
    p.onDisconnect.addListener(() => {
      if (port !== p) return;
      port = null;
      const delay = BACKOFF_MS[failures];
      failures += 1;
      if (delay !== undefined) env.setTimeout(reopen, delay);
    });
    for (const m of unaccepted.values()) send(m);
    const ids = [...awaited.keys()];
    for (let i = 0; i < ids.length; i += RESUME_BATCH) send({type: 'page.resume', requestIds: ids.slice(i, i + RESUME_BATCH)});
  };
  const reopen = () => {
    if (port === null && asked) open();
  };

  win.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== win) return;
    const d: unknown = e.data;
    if (!isObj(d) || d.source !== FROM_PROVIDER || typeof d.type !== 'string' || typeof d.id !== 'string' || !PAGE_ID.test(d.id)) return;
    if (!(METHOD_TYPES as readonly string[]).includes(d.type)) return;
    if (!servable()) {
      // The background would disconnect this port at once with no answer (ports.ts' origin rule) — never connect.
      toPage({id: d.id, error: 'unauthorized'});
      return;
    }
    const payload = isObj(d.payload) ? d.payload : {};
    const m = {...payload, type: d.type, id: d.id};
    asked = true;
    unaccepted.set(d.id, m);
    keepAlive();
    if (port === null) open();
    else send(m);
  });
  // §1.2: never before the page is shown.
  doc.addEventListener('prerenderingchange', () => {
    if (asked) open();
  });
  // After the backoff: the next time the page is looked at.
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') {
      failures = 0;
      reopen();
    }
  });
}
