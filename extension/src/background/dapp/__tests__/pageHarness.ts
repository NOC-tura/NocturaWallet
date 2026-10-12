import type {WalletDeps} from '../../deps';
import {acceptPagePort, onPageMessage} from '../pageApi';
import type {LivePort, PageSenderInfo, PortLike} from '../ports';
import {fakeExt} from '../../__tests__/fakeExt';

/** A fake runtime.Port: what the background posted, whether it disconnected, and the listeners it registered. */
export interface FakePort extends PortLike {
  posted: Record<string, unknown>[];
  disconnected: boolean;
  /** The relay's side closing the port (fires onDisconnect). */
  drop(): void;
}

export function fakePort(sender: PageSenderInfo, name = 'noctura-page'): FakePort {
  const onDisconnect: (() => void)[] = [];
  const port: FakePort = {
    name,
    sender,
    posted: [],
    disconnected: false,
    postMessage(m) {
      if (port.disconnected) throw new Error('Attempting to use a disconnected port object');
      port.posted.push(m as Record<string, unknown>);
    },
    disconnect() {
      port.disconnected = true;
    },
    onMessage: {addListener: () => undefined},
    onDisconnect: {addListener: cb => void onDisconnect.push(cb)},
    drop() {
      port.disconnected = true;
      for (const cb of onDisconnect) cb();
    },
  };
  return port;
}

export const TAB = 7;
/** What Chrome reports for this extension's relay in a top-level https document (the origin rule's positive control). */
export function senderFor(ext: ReturnType<typeof fakeExt>, origin: string, over: Partial<PageSenderInfo> = {}): PageSenderInfo {
  return {id: ext.runtimeId, origin, url: `${origin}/app`, tab: {id: TAB}, frameId: 0, documentId: 'doc-1', documentLifecycle: 'active', ...over};
}

/** A page: its port, registered as the background registers one; `ask` hands it one message and waits for the handler. */
export interface Page {
  port: FakePort;
  live: LivePort;
  ask(m: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  /** Every message posted to this port that answers `requestId` (late answers), in order. */
  answersFor(requestId: string): Record<string, unknown>[];
  /** Every `change` event posted to this port. */
  changes(): unknown[][];
}

export function openPage(ext: ReturnType<typeof fakeExt>, deps: WalletDeps, origin: string, over: Partial<PageSenderInfo> = {}): Page {
  const port = fakePort(senderFor(ext, origin, over));
  const live = acceptPagePort(ext, deps, port);
  if (live === null) throw new Error(`port refused for ${origin}`);
  return {
    port,
    live,
    async ask(m) {
      const before = port.posted.length;
      await onPageMessage(ext, deps, live, m);
      return port.posted.slice(before).find(x => (typeof m.id === 'string' ? x.id === m.id : 'resume' in x));
    },
    answersFor: requestId => port.posted.filter(x => x.requestId === requestId && !('accepted' in x)),
    changes: () => port.posted.filter(x => x.event === 'change').map(x => x.accounts as unknown[]),
  };
}

/** Lets the background's fire-and-forget work (a port's document check) finish. */
/**
 * Lets fire-and-forget work finish: a port message runs a queue access (two mutexes, five storage reads, the writes,
 * the delivery, the alarm), each await one turn of the fake chrome.* — 20 macrotask turns is about twice what the
 * longest chain here needs (a port open that answers an old document's request, then opens the window).
 */
export async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise<void>(r => setTimeout(r, 0));
}
