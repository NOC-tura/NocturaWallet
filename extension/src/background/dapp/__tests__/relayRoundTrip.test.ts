import {base64} from '@scure/base';
import {handleMessage} from '../../messages';
import {setSession} from '../../session';
import {VAULT_KEY} from '../../accountsStore';
import {GRANTS_KEY, type Grant} from '../grants';
import {runUnlockHook} from '../queue';
import {readDappSession} from '../store';
import {acceptPagePort} from '../pageApi';
import type {PortLike as BackgroundPort} from '../ports';
import {startRelay, type PortLike as RelayPort} from '../../../relay/relay';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT} from '../../__tests__/fixtures';
import {senderFor, settle} from './pageHarness';

const DAPP = 'https://dapp.test';

/**
 * Final review I1: the REAL relay (src/relay/relay.ts) wired to the REAL background (acceptPagePort), both ends of a
 * runtime.Port in memory. `loseNext` drops the background's next message to the relay (a port that died between the
 * background's commit and its reply); `drop()` closes the port on both ends; the relay's timers are captured so the
 * test fires its reconnect itself.
 */
async function wired() {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
  await setSession(ext, [ACCOUNT]);
  await runUnlockHook(ext, deps);

  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {prerendering: false, visibilityState: 'visible'});
  const toPage: Record<string, unknown>[] = [];
  Object.assign(win, {location: {origin: DAPP, protocol: 'https:'}, postMessage: (m: Record<string, unknown>, to: string) => void (to === DAPP && toPage.push(m))});
  const timers: (() => void)[] = [];
  let loseNext = 0;
  let drop: () => void = () => undefined;

  const connect = (name: string): RelayPort => {
    const toRelay: ((m: unknown) => void)[] = [];
    const toBackground: ((m: unknown) => void)[] = [];
    const relayGone: (() => void)[] = [];
    const backgroundGone: (() => void)[] = [];
    let open = true;
    const bg: BackgroundPort = {
      name,
      sender: senderFor(ext, DAPP),
      postMessage: m => {
        if (!open) throw new Error('Attempting to use a disconnected port object');
        if (loseNext > 0) {
          loseNext -= 1;
          return;
        }
        for (const cb of toRelay) cb(JSON.parse(JSON.stringify(m)));
      },
      disconnect: () => undefined,
      onMessage: {addListener: cb => void toBackground.push(cb)},
      onDisconnect: {addListener: cb => void backgroundGone.push(cb)},
    };
    const relay: RelayPort = {
      postMessage: m => {
        if (open) for (const cb of toBackground) cb(JSON.parse(JSON.stringify(m)));
      },
      disconnect: () => undefined,
      onMessage: {addListener: cb => void toRelay.push(cb)},
      onDisconnect: {addListener: cb => void relayGone.push(cb)},
    };
    drop = () => {
      open = false;
      for (const cb of [...backgroundGone, ...relayGone]) cb();
    };
    if (acceptPagePort(ext, deps, bg) === null) throw new Error('port refused');
    return relay;
  };
  startRelay({
    win: win as unknown as Window,
    doc: doc as unknown as Document,
    connect,
    setTimeout: f => void timers.push(f),
    setInterval: () => null,
    clearInterval: () => undefined,
  });
  const ask = (id: string, type = 'page.connect', payload: Record<string, unknown> = {silent: false}) =>
    win.dispatchEvent(Object.assign(new Event('message'), {data: {source: 'noctura-provider', id, type, payload}, origin: DAPP, source: win}));
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const decide = (m: Record<string, unknown>) => handleMessage(ext, {type: 'dapp.decide', ...m}, approve, deps);
  return {
    ext,
    toPage,
    timers,
    ask,
    decide,
    lose: () => void (loseNext += 1),
    drop: () => drop(),
  };
}

describe('relay + background: a request re-sent after a lost accepted (final review I1, §1.5, C9)', () => {
  it('answered meanwhile: the reconnected relay hands the page the answer — it never hangs', async () => {
    const w = await wired();
    // The background commits the request, then its {id, accepted, requestId} is lost with the port.
    w.lose();
    w.ask('r1');
    await settle();
    const [entry] = (await readDappSession(w.ext)).queue;
    expect(entry?.state).toBe('queued');
    w.drop();
    // The window outlives the port: the user approves while the relay is away.
    expect(await w.decide({requestId: entry?.requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: true});
    expect((await readDappSession(w.ext)).queue[0]?.state).toBe('answered');
    expect(w.toPage).toEqual([]);
    // The relay's 0.5 s reconnect: it re-sends the still-unaccepted request under the same id.
    expect(w.timers).toHaveLength(1);
    w.timers.shift()?.();
    await settle();
    expect(w.toPage).toEqual([{source: 'noctura-relay', id: 'r1', result: {accounts: [ACCOUNT.publicKey]}}]);
  });

  // Positive control: nothing lost — the accepted arrives, the answer is delivered and reaches the page.
  it('nothing lost: accepted, then the answer reaches the page (positive control)', async () => {
    const w = await wired();
    w.ask('r1');
    await settle();
    const [entry] = (await readDappSession(w.ext)).queue;
    expect(await w.decide({requestId: entry?.requestId, decision: 'approve', account: ACCOUNT.publicKey, scope: 'session'})).toEqual({ok: true});
    await settle();
    expect(w.toPage).toEqual([{source: 'noctura-relay', id: 'r1', result: {accounts: [ACCOUNT.publicKey]}}]);
  });

  it('the same for page.signMessage: the signature reaches the page after the reconnect', async () => {
    const w = await wired();
    const grant: Grant = {origin: DAPP, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []};
    await w.ext.local.set(GRANTS_KEY, [grant]);
    const message = base64.encode(new TextEncoder().encode('Sign in to the test dApp.'));
    w.lose();
    w.ask('s1', 'page.signMessage', {account: ACCOUNT.publicKey, message});
    await settle();
    const [entry] = (await readDappSession(w.ext)).queue;
    expect(entry?.type).toBe('signMessage');
    w.drop();
    expect(await w.decide({requestId: entry?.requestId, decision: 'approve', account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(w.toPage).toEqual([]);
    w.timers.shift()?.();
    await settle();
    expect(w.toPage).toEqual([{source: 'noctura-relay', id: 's1', result: {signature: expect.any(String), signedMessage: message}}]);
  });
});
