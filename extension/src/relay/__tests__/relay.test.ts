import {BACKOFF_MS, PING_MS, startRelay, type PortLike} from '../relay';
import * as relayProtocol from '../protocol';
import * as providerProtocol from '../../provider/protocol';
import {PAGE_TYPES} from '../../background/dapp/pageApi';
import {PAGE_PORT} from '../../background/dapp/ports';

const ORIGIN = 'https://dapp.test';

interface FakePort extends PortLike {
  name: string;
  sent: Record<string, unknown>[];
  /** The background posting to the relay. */
  push(m: unknown): void;
  /** The background side going away (a worker stop). */
  drop(): void;
}

function harness(o: {prerendering?: boolean; origin?: string; protocol?: string; connectFails?: number} = {}) {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {prerendering: o.prerendering ?? false, visibilityState: 'visible'});
  const toPage: Record<string, unknown>[] = [];
  const origin = o.origin ?? ORIGIN;
  const protocol = o.protocol ?? 'https:';
  Object.assign(win, {location: {origin, protocol}, postMessage: (m: Record<string, unknown>, to: string) => void (to === origin && toPage.push(m))});
  const ports: FakePort[] = [];
  let connectFails = o.connectFails ?? 0;
  const connect = (name: string): FakePort => {
    if (connectFails > 0) {
      connectFails -= 1;
      throw new Error('Extension context invalidated.');
    }
    const onMessage: ((m: unknown) => void)[] = [];
    const onDisconnect: (() => void)[] = [];
    const p: FakePort = {
      name,
      sent: [],
      postMessage: m => void p.sent.push(m as Record<string, unknown>),
      disconnect: () => undefined,
      onMessage: {addListener: cb => void onMessage.push(cb)},
      onDisconnect: {addListener: cb => void onDisconnect.push(cb)},
      push: m => onMessage.forEach(cb => cb(m)),
      drop: () => onDisconnect.forEach(cb => cb()),
    };
    ports.push(p);
    return p;
  };
  startRelay({
    win: win as unknown as Window,
    doc: doc as unknown as Document,
    connect,
    setTimeout: (f, ms) => setTimeout(f, ms),
    setInterval: (f, ms) => setInterval(f, ms),
    clearInterval: id => clearInterval(id as ReturnType<typeof setInterval>),
  });
  const fromPage = (data: unknown, source: unknown = win) => win.dispatchEvent(Object.assign(new Event('message'), {data, origin, source}));
  const ask = (type: string, id: string, payload: Record<string, unknown> = {}) => fromPage({source: 'noctura-provider', id, type, payload});
  return {win, doc, toPage, ports, fromPage, ask};
}

// Spec §1.2 (review 1 H1, L7; review 2 M1, M5, M8; C9, C16) and §6.1 "Relay".
describe('the relay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('no port at load — the first request of the document opens one, named noctura-page, and forwards it with its id', () => {
    const h = harness();
    expect(h.ports).toEqual([]);
    h.ask('page.connect', 'r1', {silent: false});
    expect(h.ports.map(p => p.name)).toEqual(['noctura-page']);
    expect(h.ports[0]?.sent).toEqual([{silent: false, type: 'page.connect', id: 'r1'}]);
  });

  // Review 1 IMPORTANT: ports.ts' origin rule disconnects a non-https or opaque port at once, with no answer — the
  // relay must never connect for a document that could never be served (it would otherwise retry forever).
  it('a non-https or opaque origin is answered unauthorized without ever opening a port, and nothing else', () => {
    for (const o of [{origin: 'http://insecure.test', protocol: 'http:'}, {origin: 'null', protocol: 'https:'}]) {
      const h = harness(o);
      h.ask('page.connect', 'r1', {silent: false});
      expect(h.ports).toEqual([]);
      expect(h.toPage).toEqual([{source: 'noctura-relay', id: 'r1', error: 'unauthorized'}]);
      vi.advanceTimersByTime(60_000);
      h.doc.dispatchEvent(new Event('visibilitychange'));
      expect(h.ports).toEqual([]);
    }
  });

  // Positive control: an https, non-opaque origin is unaffected by the gate above.
  it('an https origin still opens a port as before (positive control)', () => {
    const h = harness({origin: 'https://dapp.test', protocol: 'https:'});
    h.ask('page.connect', 'r1', {silent: false});
    expect(h.ports.map(p => p.name)).toEqual(['noctura-page']);
    expect(h.toPage).toEqual([]);
  });

  // Review 1 promoted Minor: runtime.connect throwing (an orphaned content script after an extension update or
  // reload) must not hang the request — it is answered a stable code instead.
  it('runtime.connect throwing answers every pending request timeout, instead of hanging', () => {
    const h = harness({connectFails: 1});
    h.ask('page.connect', 'r1', {silent: false});
    expect(h.ports).toEqual([]);
    expect(h.toPage).toEqual([{source: 'noctura-relay', id: 'r1', error: 'timeout'}]);
  });

  it('forwards only the five method types — resume, ack and ping from the page are dropped; so is another window’s message', () => {
    const h = harness();
    for (const type of ['page.resume', 'page.ack', 'page.ping', 'vault.lock', 'dapp.decide', 'page.unknown']) h.ask(type, 'x');
    h.fromPage({source: 'noctura-provider', id: 'y', type: 'page.connect', payload: {}}, {});
    h.fromPage({source: 'someone-else', id: 'z', type: 'page.connect', payload: {}});
    h.ask('page.connect', 'bad id!');
    expect(h.ports).toEqual([]);
    for (const [i, type] of ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction'].entries()) h.ask(type, `m${i}`);
    expect(h.ports[0]?.sent.map(m => m.type)).toEqual(['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction']);
  });

  it('a page cannot add fields the relay owns: its own type and id win over the payload', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {type: 'page.ack', id: 'forged', requestId: 'x'});
    expect(h.ports[0]?.sent[0]).toMatchObject({type: 'page.connect', id: 'r1'});
  });

  it('never connects while the document is prerendering — it waits for prerenderingchange (C16)', () => {
    const h = harness({prerendering: true});
    h.ask('page.connect', 'r1', {silent: true});
    expect(h.ports).toEqual([]);
    (h.doc as unknown as {prerendering: boolean}).prerendering = false;
    h.doc.dispatchEvent(new Event('prerenderingchange'));
    expect(h.ports[0]?.sent).toEqual([{silent: true, type: 'page.connect', id: 'r1'}]);
  });

  it('an immediate answer and a late answer reach the page under the page’s id; the late one is acked', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {silent: true});
    h.ports[0]?.push({id: 'r1', result: {accounts: []}});
    h.ask('page.connect', 'r2', {silent: false});
    h.ports[0]?.push({id: 'r2', accepted: true, requestId: 'Q'.repeat(22)});
    h.ports[0]?.push({requestId: 'Q'.repeat(22), result: {accounts: ['A']}});
    expect(h.toPage).toEqual([
      {source: 'noctura-relay', id: 'r1', result: {accounts: []}},
      {source: 'noctura-relay', id: 'r2', result: {accounts: ['A']}},
    ]);
    expect(h.ports[0]?.sent.at(-1)).toEqual({type: 'page.ack', requestId: 'Q'.repeat(22)});
  });

  it('change events go to the page', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {silent: true});
    h.ports[0]?.push({event: 'change', accounts: []});
    expect(h.toPage).toEqual([{source: 'noctura-relay', event: 'change', accounts: []}]);
  });

  it('a lost port: reconnect after 0.5 s, re-send what was not accepted, resume what is awaited; then 1 s, 2 s, then on visibilitychange', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {silent: false});
    h.ports[0]?.push({id: 'r1', accepted: true, requestId: 'R'.repeat(22)});
    h.ask('page.signMessage', 'r2', {account: 'A', message: 'aGk='});
    h.ports[0]?.drop();
    vi.advanceTimersByTime(BACKOFF_MS[0]! - 1);
    expect(h.ports).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(h.ports).toHaveLength(2);
    expect(h.ports[1]?.sent).toEqual([
      {account: 'A', message: 'aGk=', type: 'page.signMessage', id: 'r2'},
      {type: 'page.resume', requestIds: ['R'.repeat(22)]},
    ]);
    h.ports[1]?.drop();
    vi.advanceTimersByTime(BACKOFF_MS[1]!);
    expect(h.ports).toHaveLength(3);
    h.ports[2]?.drop();
    vi.advanceTimersByTime(BACKOFF_MS[2]!);
    expect(h.ports).toHaveLength(4);
    h.ports[3]?.drop();
    vi.advanceTimersByTime(60_000);
    expect(h.ports).toHaveLength(4);
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(h.ports).toHaveLength(5);
    // The resumed answer reaches the page once.
    h.ports[4]?.push({resume: [{requestId: 'R'.repeat(22), result: {accounts: ['A']}}]});
    h.ports[4]?.push({resume: [{requestId: 'R'.repeat(22), result: {accounts: ['A']}}]});
    expect(h.toPage.filter(m => m.id === 'r1')).toEqual([{source: 'noctura-relay', id: 'r1', result: {accounts: ['A']}}]);
  });

  it('pings every 20 s while it awaits a result, and stops when nothing is awaited', () => {
    const h = harness();
    h.ask('page.connect', 'r1', {silent: false});
    h.ports[0]?.push({id: 'r1', accepted: true, requestId: 'S'.repeat(22)});
    vi.advanceTimersByTime(PING_MS * 2);
    expect(h.ports[0]?.sent.filter(m => m.type === 'page.ping')).toHaveLength(2);
    h.ports[0]?.push({requestId: 'S'.repeat(22), error: 'rejected'});
    vi.advanceTimersByTime(PING_MS * 3);
    expect(h.ports[0]?.sent.filter(m => m.type === 'page.ping')).toHaveLength(2);
  });

  it('the protocol copies agree: provider ↔ relay, and the relay ↔ the background’s page partition and port name', () => {
    expect(relayProtocol.METHOD_TYPES).toEqual(providerProtocol.METHOD_TYPES);
    expect([relayProtocol.FROM_PROVIDER, relayProtocol.FROM_RELAY]).toEqual([providerProtocol.FROM_PROVIDER, providerProtocol.FROM_RELAY]);
    expect(relayProtocol.PAGE_PORT).toBe(PAGE_PORT);
    // B1c-2: the background serves all five method types the relay forwards, plus the relay's own three.
    expect([...PAGE_TYPES].sort()).toEqual([...relayProtocol.METHOD_TYPES, 'page.ack', 'page.ping', 'page.resume'].sort());
  });
});
