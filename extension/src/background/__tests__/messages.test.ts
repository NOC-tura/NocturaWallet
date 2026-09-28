import {handleMessage} from '../messages';
import {getSession} from '../session';
import {fakeExt} from './fakeExt';

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};
const popup = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const page = {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};
const ACC = [{index: 0, publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', secretKey: 'AAAA'}];

describe('message partitions', () => {
  it('accepts vault.setKeys from the vault page (positive control)', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage)).toEqual({ok: true});
    expect(await getSession(ext)).toEqual(ACC);
  });

  it('refuses vault.setKeys from the popup — only the vault page may', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, popup)).toEqual({ok: false, error: 'forbidden'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses every privileged type from a web page', async () => {
    for (const type of ['vault.setKeys', 'vault.lock', 'vault.status', 'activity.ping']) {
      const ext = fakeExt();
      expect(await handleMessage(ext, {type, accounts: ACC}, page)).toEqual({ok: false, error: 'forbidden'});
    }
  });

  it('refuses a page that claims the extension origin in its url but not in sender.origin', async () => {
    const ext = fakeExt();
    const spoof = {...page, url: `${ORIGIN}/unlock.html`};
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, spoof)).toEqual({ok: false, error: 'forbidden'});
  });

  it('refuses a message from another extension', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.status'}, {...popup, id: 'someotherextensionidxxxxxxxxxxxx'})).toEqual({ok: false, error: 'forbidden'});
  });

  it('refuses unknown types and malformed messages', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.export'}, popup)).toEqual({ok: false, error: 'unknown type'});
    expect(await handleMessage(ext, 'hello', popup)).toEqual({ok: false, error: 'malformed'});
  });

  it('refuses malformed accounts in vault.setKeys', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: [{index: 0}]}, unlockPage)).toEqual({ok: false, error: 'malformed'});
  });

  it('vault.status reports locked/unlocked without keys', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.status'}, popup)).toEqual({ok: true, data: {unlocked: false, accounts: []}});
    await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
    const r = await handleMessage(ext, {type: 'vault.status'}, popup);
    expect(r).toEqual({ok: true, data: {unlocked: true, accounts: [{index: 0, publicKey: ACC[0]?.publicKey}]}});
    expect(JSON.stringify(r)).not.toContain('secretKey');
  });

  it('vault.lock clears the session', async () => {
    const ext = fakeExt();
    await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
    await handleMessage(ext, {type: 'vault.lock'}, popup);
    expect(await getSession(ext)).toBeNull();
  });

  it('vault.setKeys from an own-origin sender whose url does not parse is forbidden', async () => {
    const ext = fakeExt();
    const badUrl = {id: ID, origin: ORIGIN, url: 'not a url', tab: {}, frameId: 0};
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, badUrl)).toEqual({ok: false, error: 'forbidden'});
    expect(await getSession(ext)).toBeNull();
  });
});
