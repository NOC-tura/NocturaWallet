import {render} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {Approve} from '../Approve';
import {createClient, type ApproveClient} from '../client';
import {handleMessage} from '../../background/messages';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {runUnlockHook} from '../../background/dapp/queue';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {openPage, type Page} from '../../background/dapp/__tests__/pageHarness';
import {chainReader, newChain, type Chain} from '../../background/dapp/__tests__/txHarness';

/** A second real keypair (32 × 0x02): vault.setKeys checks every key. */
const SEED2 = new Uint8Array(32).fill(2);
const PUB2 = ed25519.getPublicKey(SEED2);
export const SECOND = {index: 1, publicKey: base58.encode(PUB2), secretKey: base64.encode(new Uint8Array([...SEED2, ...PUB2]))};
export const ENV = {
  v: 1,
  scheme: 'slip10',
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: SECOND.publicKey},
  ],
};

/**
 * The approval window against the REAL background (handleMessage with approve.html as the sender, the fake chrome.*),
 * and pages that ask it through the real page partition (pageHarness). `closed` counts window.close().
 */
export async function openWindow(o: {unlocked?: boolean; chain?: Chain} = {}) {
  const ext = fakeExt();
  // B1c-2: the chain a transaction request is simulated against (txHarness's steered one).
  const chain = o.chain ?? newChain();
  const deps = fakeDeps({reader: chainReader(chain)});
  await ext.local.set(VAULT_KEY, ENV);
  if (o.unlocked !== false) {
    await setSession(ext, [ACCOUNT, SECOND]);
    await runUnlockHook(ext, deps);
  }
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const sent: unknown[] = [];
  const closed = {n: 0};
  // B1c-2 (plan 2 rev 2, dry-run item): a closed window is gone — it reads nothing more. Without this, a still-mounted
  // window's next 1 s poll read `none` again and counted a second close, so `closed.n === 1` was a race under load.
  const client: ApproveClient = createClient(m => {
    if (closed.n > 0) return Promise.reject(new Error('the window is closed'));
    sent.push(m);
    return handleMessage(ext, m, approve, deps);
  });
  let tab = 10;
  /** A page on its own tab that asks to connect; the request's id and the page. */
  const connect = async (origin: string): Promise<{page: Page; requestId: string}> => {
    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
    const r = await page.ask({type: 'page.connect', id: `c${tab}`, silent: false});
    return {page, requestId: String(r?.requestId)};
  };
  /** A page holding a session-free persistent grant for ACCOUNT that asks to sign `message` (UTF-8). */
  const sign = async (origin: string, message: string): Promise<{page: Page; requestId: string}> => {
    const grants = ((await ext.local.get(GRANTS_KEY)) as unknown[] | undefined) ?? [];
    await ext.local.set(GRANTS_KEY, [...grants, {origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
    const r = await page.ask({type: 'page.signMessage', id: `s${tab}`, account: ACCOUNT.publicKey, message: base64.encode(new TextEncoder().encode(message))});
    if (r?.accepted !== true) throw new Error(`sign request not queued: ${JSON.stringify(r)}`);
    return {page, requestId: String(r.requestId)};
  };
  /**
   * B1c-2: a page holding a persistent grant for ACCOUNT that asks to sign these transactions (base64) — or to sign and
   * send the first; `known` makes the recipients known (no re-authentication for a first send).
   */
  const signTx = async (origin: string, transactions: string[], o2: {send?: boolean} = {}): Promise<{page: Page; requestId: string}> => {
    const grants = ((await ext.local.get(GRANTS_KEY)) as unknown[] | undefined) ?? [];
    await ext.local.set(GRANTS_KEY, [...grants, {origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
    const m = o2.send === true ? {type: 'page.signAndSendTransaction', transaction: transactions[0]} : {type: 'page.signTransaction', transactions};
    const r = await page.ask({...m, id: `t${tab}`, account: ACCOUNT.publicKey});
    if (r?.accepted !== true) throw new Error(`transaction request not queued: ${JSON.stringify(r)}`);
    return {page, requestId: String(r.requestId)};
  };
  const show = () =>
    render(
      <div className="app app-window">
        <Approve client={client} close={() => void (closed.n += 1)} />
      </div>,
    );
  return {ext, deps, chain, client, closed, sent, connect, sign, signTx, show, unlock: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, {...approve, url: `${ext.extensionOrigin}/unlock.html`}, deps)};
}
