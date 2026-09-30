import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {PRIVILEGED, handleMessage} from '../messages';
import {getSession} from '../session';
import {AUTOLOCK_ALARM, DEFAULT_AUTOLOCK_MINUTES} from '../autolock';
import {fakeExt} from './fakeExt';
import {issueChallenge} from '../reauthChallenges';
import {fakeDeps} from './fakeDeps';
import {envelopeRevision} from '../../shared/envelopeRevision';

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};
const popup = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const page = {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};
// A real raw Ed25519 keypair encoding (32-byte seed + the 32-byte public key it derives),
// base64-encoded, with the matching base58 address: the only shape vault.setKeys accepts.
const SEED = new Uint8Array(32).fill(1);
const PUB = ed25519.getPublicKey(SEED);
const SECRET64 = base64.encode(new Uint8Array([...SEED, ...PUB]));
const ACC = [{index: 0, publicKey: base58.encode(PUB), secretKey: SECRET64}];
// 64 × 0x01 is 64 bytes but not a keypair: its "public half" is not what its seed derives.
const ONES64 = base64.encode(new Uint8Array(64).fill(1));
const UNRELATED = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

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

  it('refuses 64 × 0x01 with an unrelated address — 64 bytes is not a keypair', async () => {
    const ext = fakeExt();
    const bad = [{index: 0, publicKey: UNRELATED, secretKey: ONES64}];
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses a real keypair sent under another address', async () => {
    const ext = fakeExt();
    const bad = [{index: 0, publicKey: UNRELATED, secretKey: SECRET64}];
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses a secretKey whose embedded public key matches the address but whose seed does not derive it', async () => {
    const ext = fakeExt();
    const otherSeed = new Uint8Array(32).fill(2);
    const bad = [{index: 0, publicKey: ACC[0]?.publicKey, secretKey: base64.encode(new Uint8Array([...otherSeed, ...PUB]))}];
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses a secretKey whose seed derives the address but whose embedded public half is something else', async () => {
    const ext = fakeExt();
    const bad = [{index: 0, publicKey: ACC[0]?.publicKey, secretKey: base64.encode(new Uint8Array([...SEED, ...new Uint8Array(32).fill(9)]))}];
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: bad}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses a publicKey that is not base58', async () => {
    const ext = fakeExt();
    const bad = [{index: 0, publicKey: '0OIl', secretKey: SECRET64}];
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

describe('message partitions (B1b-1 types)', () => {
  // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
  // 'unknown type' here, which fails, rather than silently shrinking the test.
  const ALL = [
    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'activity.ping',
    'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
    'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'accounts.rename', 'accounts.select', 'settings.get', 'settings.set',
  ];

  it('every privileged type is refused from a web page and from another extension', async () => {
    expect([...PRIVILEGED].sort()).toEqual([...ALL].sort());
    const otherId = 'someotherextensionidxxxxxxxxxxxx';
    const others = [
      {...popup, id: otherId},
      {id: otherId, origin: `chrome-extension://${otherId}`, url: `chrome-extension://${otherId}/popup.html`},
      {...unlockPage, id: otherId},
    ];
    for (const type of ALL) {
      expect(await handleMessage(fakeExt(), {type}, page, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
      for (const sender of others) expect(await handleMessage(fakeExt(), {type}, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
  });

  it('vault.reauthOk only from the vault page, only while unlocked, only for a live challenge', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
    const challengeId = await issueChallenge(ext, deps, 'd');
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, popup, deps)).toEqual({ok: false, error: 'forbidden'});
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId: 'f'.repeat(32)}, unlockPage, deps)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps)).toEqual({ok: true});
    await handleMessage(ext, {type: 'vault.lock'}, popup);
    expect(await handleMessage(ext, {type: 'vault.reauthOk', challengeId}, unlockPage, deps)).toEqual({ok: false, error: 'locked'});
  });

  // Envelope fixtures with the byte lengths a real envelope has (the background checks them).
  const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
  const STORED = {
    v: 1,
    scheme: 'slip10',
    kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
    seed: {iv: B(12, 2), ct: B(48, 3)},
    password: {wrapped: B(40, 4)},
    accounts: [{index: 0, name: 'Account 1', publicKey: UNRELATED}],
  };
  const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
  const otherId = 'someotherextensionidxxxxxxxxxxxx';
  const refused = [page, popup, {...unlockPage, id: otherId}, {id: otherId, origin: `chrome-extension://${otherId}`, url: `chrome-extension://${otherId}/unlock.html`}];

  it('vault.storeEnvelope only from the vault page, only while a wallet exists, only over the revision it opened', async () => {
    const NEXT = {...STORED, seed: {iv: B(12, 5), ct: B(48, 6)}, accounts: [...STORED.accounts, {index: 1, name: 'Account 2', publicKey: 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'}]};
    const msg = {type: 'vault.storeEnvelope', expectedRevision: REV, envelope: NEXT};
    const ext = fakeExt();
    expect(await handleMessage(ext, msg, unlockPage)).toEqual({ok: false, error: 'no-wallet'});
    expect(await ext.local.get('v1_vault')).toBeUndefined();
    await ext.local.set('v1_vault', STORED);
    for (const sender of refused) expect(await handleMessage(ext, msg, sender)).toEqual({ok: false, error: 'forbidden'});
    expect(await ext.local.get('v1_vault')).toEqual(STORED);
    expect(await handleMessage(ext, {...msg, envelope: {...NEXT, v: 2}}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await handleMessage(ext, {...msg, expectedRevision: 'f'.repeat(64)}, unlockPage)).toEqual({ok: false, error: 'busy'});
    expect(await ext.local.get('v1_vault')).toEqual(STORED);
    expect(await handleMessage(ext, msg, unlockPage)).toEqual({ok: true});
    expect(await ext.local.get('v1_vault')).toEqual(NEXT);
    await ext.local.set('v1_vault', {...STORED, seed: 'damaged'});
    expect(await handleMessage(ext, msg, unlockPage)).toEqual({ok: false, error: 'stored-invalid'});
  });

  it('vault.storeEnvelope with expectedRevision null (the first write) only from the vault page, only without a wallet', async () => {
    const msg = {type: 'vault.storeEnvelope', expectedRevision: null, envelope: STORED};
    const ext = fakeExt();
    for (const sender of refused) expect(await handleMessage(ext, msg, sender)).toEqual({ok: false, error: 'forbidden'});
    expect(await ext.local.get('v1_vault')).toBeUndefined();
    expect(await handleMessage(ext, {...msg, envelope: {...STORED, v: 2}}, unlockPage)).toEqual({ok: false, error: 'malformed'});
    expect(await handleMessage(ext, {...msg, expectedRevision: REV}, unlockPage)).toEqual({ok: false, error: 'no-wallet'});
    expect(await ext.local.get('v1_vault')).toBeUndefined();
    expect(await handleMessage(ext, msg, unlockPage)).toEqual({ok: true});
    expect(await ext.local.get('v1_vault')).toEqual(STORED);
    const other = {...STORED, seed: {iv: B(12, 7), ct: B(48, 8)}};
    expect(await handleMessage(ext, {...msg, envelope: other}, unlockPage)).toEqual({ok: false, error: 'wallet-exists'});
    expect(await ext.local.get('v1_vault')).toEqual(STORED);
  });

  it('wallet types answer "unavailable" when the background has no deps, and route when it does', async () => {
    expect(await handleMessage(fakeExt(), {type: 'settings.get'}, popup)).toEqual({ok: false, error: 'unavailable'});
    expect(await handleMessage(fakeExt(), {type: 'settings.get'}, popup, fakeDeps())).toMatchObject({ok: true, data: {autoLockMinutes: 5}});
  });
});
