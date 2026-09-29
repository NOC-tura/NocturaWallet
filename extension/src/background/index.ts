import {browserExt} from '../ext';
import {handleMessage, type Sender} from './messages';
import {AUTOLOCK_ALARM, lock, onWindowRemoved} from './autolock';
import {browserDeps} from './deps';
import {isOpen, readPending} from './pendingStore';
import {PENDING_ALARM, armPendingAlarm, onPendingAlarm, startPoller} from './pending';

interface BgApi {
  runtime: {
    onMessage: {addListener(cb: (m: unknown, s: Sender, reply: (r: unknown) => void) => boolean): void};
    onStartup: {addListener(cb: () => void): void};
  };
  alarms: {onAlarm: {addListener(cb: (a: {name: string}) => void): void}};
  windows: {onRemoved: {addListener(cb: () => void): void}};
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

api.runtime.onMessage.addListener((msg, sender, reply) => {
  handleMessage(ext, msg, sender, deps).then(reply, () => reply({ok: false, error: 'internal'}));
  return true; // reply asynchronously
});
api.alarms.onAlarm.addListener(a => {
  if (a.name === AUTOLOCK_ALARM) void lock(ext);
  if (a.name === PENDING_ALARM) void onPendingAlarm(ext, deps).catch(e => console.warn('pending alarm tick failed', e));
});
api.windows.onRemoved.addListener(() => {
  void onWindowRemoved(ext);
});
api.runtime.onStartup.addListener(() => {
  void lock(ext);
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
