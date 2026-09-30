import {KNOWN_RECIPIENTS_KEY, addKnownRecipient, isKnownRecipient, lastSentAt} from '../knownRecipients';
import {handleWallet} from '../walletApi';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {PREPARED_KEY, REAUTH_KEY, setSession} from '../session';
import {discardPrepared, preparedFor, prepareSend} from '../prepare';
import {challengeInfo, issueChallenge} from '../reauthChallenges';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, SETTINGS_ABOUT, sendReader, unlocked} from './fixtures';

const OTHER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const SECOND = {index: 1, publicKey: OTHER, secretKey: ACCOUNT.secretKey};
const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}, {index: 1, name: 'Savings', publicKey: OTHER}]};

describe('known recipients: {address, at} (E6)', () => {
  it('records the confirmation time; the B1b-1 string format still reads as known, with no time', async () => {
    const ext = fakeExt();
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    expect(await lastSentAt(ext, RECIPIENT)).toBeNull();
    expect(await isKnownRecipient(ext, [], RECIPIENT)).toBe(true);
    await addKnownRecipient(ext, RECIPIENT, 1_700_000_000_000);
    expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1_700_000_000_000}]);
    expect(await lastSentAt(ext, RECIPIENT)).toBe(1_700_000_000_000);
  });
});

describe('wallet.recipientInfo (E6)', () => {
  async function setup() {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    await setSession(ext, [ACCOUNT, SECOND]);
    return ext;
  }
  const ask = (ext: ReturnType<typeof fakeExt>, recipient: unknown, account: unknown = ACCOUNT.publicKey) =>
    handleWallet(ext, fakeDeps(), 'wallet.recipientInfo', {account, recipient});

  it('an own account: known, labelled with its index and name', async () => {
    expect(await ask(await setup(), OTHER)).toEqual({ok: true, data: {known: true, lastSentAt: null, label: {kind: 'own', index: 1, name: 'Savings'}, self: false}});
  });

  it('the sending account itself: self', async () => {
    expect((await ask(await setup(), ACCOUNT.publicKey)).data).toMatchObject({known: true, self: true, label: {kind: 'own', index: 0}});
  });

  it('the fee treasury is labelled, and a first send there is still unknown', async () => {
    expect((await ask(await setup(), MAINNET_FEE_TREASURY)).data).toEqual({known: false, lastSentAt: null, label: {kind: 'treasury'}, self: false});
  });

  it('a confirmed recipient: known, with the time of the last send', async () => {
    const ext = await setup();
    await addKnownRecipient(ext, RECIPIENT, 1_700_000_000_000);
    expect((await ask(ext, RECIPIENT)).data).toEqual({known: true, lastSentAt: 1_700_000_000_000, label: null, self: false});
  });

  it('an unknown address: not known, no label', async () => {
    expect((await ask(await setup(), RECIPIENT)).data).toEqual({known: false, lastSentAt: null, label: null, self: false});
  });

  it('refused while locked, and for a malformed address', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await ask(ext, RECIPIENT)).toEqual({ok: false, error: 'locked'});
    await unlocked(ext);
    expect(await ask(ext, 'nope')).toEqual({ok: false, error: 'malformed'});
    expect(await ask(ext, RECIPIENT, 'nope')).toEqual({ok: false, error: 'malformed'});
  });

  it('parity: known === !first-send, for the same intent through prepareSend', async () => {
    for (const [recipient, remember] of [[RECIPIENT, false], [RECIPIENT, true], [OTHER, false]] as const) {
      const ext = await setup();
      if (remember) await addKnownRecipient(ext, recipient, 5);
      const info = (await ask(ext, recipient)).data as {known: boolean};
      const view = await prepareSend(ext, fakeDeps({reader: sendReader()}), ACCOUNT.publicKey, {token: 'SOL', recipient, amount: '1000000'});
      expect(info.known).toBe(!(view.reauth?.reasons ?? []).includes('first-send'));
    }
  });

  it('is refused from a web page', async () => {
    const ext = await setup();
    const web = {id: ext.runtimeId, origin: 'https://evil.example', url: 'https://evil.example/'};
    expect(await handleMessage(ext, {type: 'wallet.recipientInfo', account: ACCOUNT.publicKey, recipient: RECIPIENT}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
  });
});

describe('wallet.discardPrepared (E7)', () => {
  const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};

  it('drops this account’s prepared sends and the send challenge bound to them; keeps a settings challenge and another account’s', async () => {
    const ext = fakeExt();
    await setSession(ext, [ACCOUNT, SECOND]);
    const deps = fakeDeps({reader: sendReader({getBalance: async () => 10_000_000_000n})});
    const mine = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    const settings = await issueChallenge(ext, deps, 'settings-digest', SETTINGS_ABOUT);
    const theirs = await issueChallenge(ext, deps, 'their-send-digest', {...SETTINGS_ABOUT});
    expect(await handleWallet(ext, deps, 'wallet.discardPrepared', {account: ACCOUNT.publicKey})).toEqual({ok: true});
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
    // A stale #10 tab for that intent now finds nothing: unknown-challenge, which #10 shows as "expired".
    expect(await challengeInfo(ext, deps.now(), mine.reauth!.challengeId)).toBeNull();
    expect(await challengeInfo(ext, deps.now(), settings)).not.toBeNull();
    expect(await challengeInfo(ext, deps.now(), theirs)).not.toBeNull();
    // A later Send of the discarded id finds nothing.
    expect(await handleWallet(ext, deps, 'wallet.send', {id: mine.id})).toEqual({ok: false, error: 'unknown-prepared'});
  });

  it('leaves another account’s prepared send alone, and is idempotent', async () => {
    const ext = fakeExt();
    await setSession(ext, [ACCOUNT, SECOND]);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const deps = fakeDeps({reader: sendReader()});
    await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    await discardPrepared(ext, OTHER);
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).not.toBeNull();
    await discardPrepared(ext, ACCOUNT.publicKey);
    await discardPrepared(ext, ACCOUNT.publicKey);
    expect(await ext.session.get(PREPARED_KEY)).toEqual([]);
  });

  it('writes nothing when there is nothing to drop (a lock leaves the area empty)', async () => {
    const ext = fakeExt();
    await discardPrepared(ext, ACCOUNT.publicKey);
    expect(await ext.session.get(PREPARED_KEY)).toBeUndefined();
    expect(await ext.session.get(REAUTH_KEY)).toBeUndefined();
  });

  it('refuses a malformed account, and a web page', async () => {
    const ext = fakeExt();
    expect(await handleWallet(ext, fakeDeps(), 'wallet.discardPrepared', {account: 'nope'})).toEqual({ok: false, error: 'malformed'});
    const web = {id: ext.runtimeId, origin: 'https://evil.example', url: 'https://evil.example/'};
    expect(await handleMessage(ext, {type: 'wallet.discardPrepared', account: ACCOUNT.publicKey}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
  });
});
