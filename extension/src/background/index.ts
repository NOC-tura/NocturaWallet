import {browserExt} from '../ext';
import {handleMessage, type Sender} from './messages';
import {AUTOLOCK_ALARM, lock, onWindowRemoved} from './autolock';

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

api.runtime.onMessage.addListener((msg, sender, reply) => {
  handleMessage(ext, msg, sender).then(reply, () => reply({ok: false, error: 'internal'}));
  return true; // reply asynchronously
});
api.alarms.onAlarm.addListener(a => {
  if (a.name === AUTOLOCK_ALARM) void lock(ext);
});
api.windows.onRemoved.addListener(() => {
  void onWindowRemoved(ext);
});
api.runtime.onStartup.addListener(() => {
  void lock(ext);
});
