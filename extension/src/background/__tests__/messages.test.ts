import {handleMessage} from '../messages';
import {getSession} from '../session';
import {AUTOLOCK_ALARM, DEFAULT_AUTOLOCK_MINUTES} from '../autolock';
import {fakeExt} from './fakeExt';

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};
const popup = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const page = {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};
// A well-formed raw Ed25519 keypair encoding (32-byte seed + 32-byte pubkey) is exactly 64 bytes;
// this is 64 arbitrary non-zero bytes, base64-encoded, so it is distinguishable from an
// all-zero placeholder and actually exercises the decode-and-measure check.
const SECRET64 = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ==';
const ACC = [{index: 0, publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', secretKey: SECRET64}];

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

  it('refuses a vault page sender (own id+origin) whose url claims another origin — negative control on pagePath', async () => {
    const ext = fakeExt();
    const spoofedPath = {id: ID, origin: ORIGIN, url: 'https://evil.example/unlock.html', tab: {}, frameId: 0};
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, spoofedPath)).toEqual({ok: false, error: 'forbidden'});
    expect(await getSession(ext)).toBeNull();
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

  it('refuses malformed accounts in vault.setKeys, and never writes a session for them', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: [{index: 0}]}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses a negative index', async () => {
    const ext = fakeExt();
    const bad = [{index: -1, publicKey: ACC[0]?.publicKey, secretKey: SECRET64}];
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses a secretKey that does not decode to 64 bytes', async () => {
    const ext = fakeExt();
    const bad = [{index: 0, publicKey: ACC[0]?.publicKey, secretKey: 'AAAA'}];
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses an empty publicKey', async () => {
    const ext = fakeExt();
    const bad = [{index: 0, publicKey: '', secretKey: SECRET64}];
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await getSession(ext)).toBeNull();
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

  it('a successful vault.setKeys arms the auto-lock alarm at the default', async () => {
    const ext = fakeExt();
    await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(DEFAULT_AUTOLOCK_MINUTES);
  });

  it('vault.setKeys leaves no session behind when arming the auto-lock alarm fails (no fail-open)', async () => {
    const ext = fakeExt();
    ext.alarms.create = async () => {
      throw new Error('alarms.create rejected');
    };
    await expect(handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage)).rejects.toThrow('alarms.create rejected');
    expect(await getSession(ext)).toBeNull();
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
  });

  it('activity.ping while locked leaves no alarm armed', async () => {
    const ext = fakeExt();
    expect(await getSession(ext)).toBeNull();
    await handleMessage(ext, {type: 'activity.ping'}, popup);
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
  });

  it('activity.ping while unlocked re-arms using the current settings', async () => {
    const ext = fakeExt();
    await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(DEFAULT_AUTOLOCK_MINUTES);
    await ext.local.set('v1_settings', {autoLockMinutes: 20});
    await handleMessage(ext, {type: 'activity.ping'}, popup);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(20);
  });
});
