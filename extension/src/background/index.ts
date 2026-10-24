import {browserExt} from '../ext';
import {handleMessage, registerPresaleHandler, type Sender} from './messages';
import {AUTOLOCK_ALARM, lock, onWindowRemoved} from './autolock';
import {browserDeps} from './deps';
import {isOpen, readPending} from './pendingStore';
import {PENDING_ALARM, armPendingAlarm, onPendingAlarm, startPoller} from './pending';
import {acceptPagePort} from './dapp/pageApi';
import {QUEUE_ALARM} from './dapp/queue';
import {onApprovalWindowRemoved, onQueueAlarm} from './dapp/window';
import type {PortLike} from './dapp/ports';
import {registerPresale} from './presale/api';

interface BgApi {
  runtime: {
    getURL(path: string): string;
    onMessage: {addListener(cb: (m: unknown, s: Sender, reply: (r: unknown) => void) => boolean): void};
    /** B1c §1.3: the relay's `noctura-page` ports. */
    onConnect: {addListener(cb: (port: PortLike) => void): void};
    onStartup: {addListener(cb: () => void): void};
    onInstalled: {addListener(cb: (details: {reason: string}) => void): void};
  };
  tabs: {create(o: {url: string}): Promise<unknown> | void};
  alarms: {onAlarm: {addListener(cb: (a: {name: string}) => void): void}};
  windows: {onRemoved: {addListener(cb: (windowId: number) => void): void}};
}

const g = globalThis as unknown as {browser?: BgApi; chrome?: BgApi};
const api = (g.browser ?? g.chrome) as BgApi;
const ext = browserExt();
// One per background instance: its latch is the one every coordinator route shares.
const deps = browserDeps(ext);
// First thing on every start: storage.session readable by trusted contexts only (no-op on
// Firefox). Caught, not left to reject unhandled — a browser that refuses the call must not
// stop the listeners below from registering.
void ext.pinSessionAccess().catch(e => console.warn('storage.session access level not pinned', e));
// B1d §1.1: presale joins here, before any listener can deliver a message (the stub in the build without it).
registerPresale({ext, deps, handle: registerPresaleHandler});

api.runtime.onMessage.addListener((msg, sender, reply) => {
  handleMessage(ext, msg, sender, deps).then(reply, () => reply({ok: false, error: 'internal'}));
  return true; // reply asynchronously
});
api.runtime.onConnect.addListener(port => acceptPagePort(ext, deps, port));
api.alarms.onAlarm.addListener(a => {
  if (a.name === AUTOLOCK_ALARM) void lock(ext);
  if (a.name === PENDING_ALARM) void onPendingAlarm(ext, deps).catch(e => console.warn('pending alarm tick failed', e));
  if (a.name === QUEUE_ALARM) void onQueueAlarm(ext, deps).catch(e => console.warn('dApp queue tick failed', e));
});
// The approval window first: it decides for itself whether to lock (and drain the queue) or reopen, from
// ext.windowCount() as of right after the reject — before anything here could change that count (fix round 1,
// Important 1; §2.4, review 2 L9). Only when the closed window was not ours does the plain browser-closed check run
// — and it also runs when onApprovalWindowRemoved itself rejects (fix round 2, Important 1): a storage error there
// must never read as "it was ours, so nothing else to do" — the browser-closed lock has to fire whenever
// windowCount is zero, whatever the dApp path did. Fail closed, not open.
api.windows.onRemoved.addListener(windowId => {
  void onApprovalWindowRemoved(ext, deps, windowId).then(
    ours => (ours ? undefined : onWindowRemoved(ext)),
    e => {
      console.warn('dApp window removal failed', e);
      return onWindowRemoved(ext);
    },
  );
});
api.runtime.onStartup.addListener(() => {
  void lock(ext);
});
// B1b-2a §1.1: a fresh install opens the welcome page (the vault page's `welcome` mode) once. An
// update or a browser update opens nothing. tabs.create needs no permission.
api.runtime.onInstalled.addListener(details => {
  if (details.reason !== 'install') return;
  void Promise.resolve(api.tabs.create({url: api.runtime.getURL('unlock.html?mode=welcome')})).catch(e => console.warn('welcome tab not opened', e));
});

// A service worker stopped while a send was open restarts here: resume watching it.
void readPending(ext).then(
  records => {
    if (!records.some(isOpen)) return;
    void startPoller(ext, deps);
    void armPendingAlarm(ext).catch(e => console.warn('pending alarm not armed at start-up; the poller still runs', e));
  },
  () => undefined,
);
