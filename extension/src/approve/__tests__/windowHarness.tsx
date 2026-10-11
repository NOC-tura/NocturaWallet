import {render} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
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
export async function openWindow(o: {unlocked?: boolean} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, ENV);
  if (o.unlocked !== false) {
    await setSession(ext, [ACCOUNT, SECOND]);
    await runUnlockHook(ext, deps);
  }
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const sent: unknown[] = [];
  const client: ApproveClient = createClient(m => {
    sent.push(m);
    return handleMessage(ext, m, approve, deps);
  });
  const closed = {n: 0};
  let tab = 10;
  /** A page on its own tab that asks to connect; the request's id and the page. */
  const connect = async (origin: string): Promise<{page: Page; requestId: string}> => {
    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
    const r = await page.ask({type: 'page.connect', id: `c${tab}`, silent: false});
    return {page, requestId: String(r?.requestId)};
  };
  const show = () =>
    render(
      <div className="app app-window">
        <Approve client={client} close={() => void (closed.n += 1)} />
      </div>,
    );
  return {ext, deps, client, closed, sent, connect, show, unlock: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, {...approve, url: `${ext.extensionOrigin}/unlock.html`}, deps)};
}
