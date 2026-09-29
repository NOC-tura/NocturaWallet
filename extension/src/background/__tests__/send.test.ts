import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {sendPrepared, signPrepared} from '../send';
import {peekPrepared, prepareSend, PREPARED_TTL_MS} from '../prepare';
import {challengeSatisfied, consumeChallenge, satisfyChallenge} from '../reauthChallenges';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {PREPARED_KEY, setSession} from '../session';
import {PENDING_KEY} from '../pendingStore';
import type {SessionAccount} from '../../vault/accounts';
import {AUTOLOCK_ALARM} from '../autolock';
import {firstSignature} from '../../../../core/solana/broadcast';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, PUB, RECIPIENT, pendingRecord, sendReader, signedWire, unlocked} from './fixtures';

const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};

async function setup(known: boolean) {
  const ext = fakeExt();
  await unlocked(ext);
  if (known) await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  const deps = fakeDeps({reader: sendReader()});
  deps.broadcast = async wire => {
    deps.broadcasts.push(wire);
    return firstSignature(wire);
  };
  const view = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
  return {ext, deps, view};
}

describe('sendPrepared', () => {
  it('signs the prepared message with the session key and broadcasts it (positive control)', async () => {
    const {ext, deps, view} = await setup(true);
    const sent = await sendPrepared(ext, deps, view.id);
    const tx = VersionedTransaction.deserialize(deps.broadcasts[0]!);
    expect(ed25519.verify(tx.signatures[0]!, tx.message.serialize(), PUB)).toBe(true);
    expect(sent.signature).toBe(base58.encode(tx.signatures[0]!));
    expect(sent.state).toBe('pending');
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(true);
  });

  it('refuses before re-authentication without burning the prepared send, then sends once it is proven', async () => {
    const {ext, deps, view} = await setup(false);
    const challengeId = view.reauth!.challengeId;
    const {digest} = (await peekPrepared(ext, view.id))!;
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'reauth-required', detail: challengeId});
    expect(await peekPrepared(ext, view.id)).not.toBeNull();
    expect(deps.broadcasts).toHaveLength(0);
    await satisfyChallenge(ext, deps.now(), challengeId);
    expect((await sendPrepared(ext, deps, view.id)).state).toBe('pending');
    expect(await peekPrepared(ext, view.id)).toBeNull();
    // Consumed: the same proof cannot authorise anything again.
    expect(await challengeSatisfied(ext, deps.now(), challengeId, digest)).toBe(false);
    expect(await consumeChallenge(ext, deps.now(), challengeId, digest)).toBe(false);
  });

  it('a prepared send is single use: a second Send finds nothing', async () => {
    const {ext, deps, view} = await setup(true);
    await sendPrepared(ext, deps, view.id);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'unknown-prepared'});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('refuses an expired prepared send as prepared-expired (the caller re-prepares) and a locked wallet', async () => {
    const {ext, deps, view} = await setup(true);
    deps.clock.t += PREPARED_TTL_MS;
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'prepared-expired'});
    await expect(sendPrepared(fakeExt(), deps, 'x')).rejects.toMatchObject({code: 'locked'});
  });
});

describe('sendPrepared — what is signed is what was prepared', () => {
  it('signs exactly the stored message bytes — no rebuild', async () => {
    const {ext, deps, view} = await setup(true);
    const prepared = (await peekPrepared(ext, view.id))!;
    const wire = signPrepared(prepared, ACCOUNT);
    expect([...VersionedTransaction.deserialize(wire).message.serialize()]).toEqual([...base64.decode(prepared.message)]);
    await sendPrepared(ext, deps, view.id);
    expect([...VersionedTransaction.deserialize(deps.broadcasts[0]!).message.serialize()]).toEqual([...base64.decode(prepared.message)]);
  });

  /** Replace the stored message of the one prepared send with another (valid) message from the same payer. */
  async function alterMessage(ext: ReturnType<typeof fakeExt>) {
    const stored = (await ext.session.get(PREPARED_KEY)) as {message: string}[];
    const other = base64.encode(VersionedTransaction.deserialize(signedWire(2n)).message.serialize());
    expect(other).not.toBe(stored[0]!.message);
    await ext.session.set(PREPARED_KEY, stored.map(p => ({...p, message: other})));
  }

  it('a message altered after prepare is refused, even with re-authentication proven, and nothing is broadcast', async () => {
    const {ext, deps, view} = await setup(false);
    const challengeId = view.reauth!.challengeId;
    await satisfyChallenge(ext, deps.now(), challengeId);
    await alterMessage(ext);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'reauth-required'});
    expect(deps.broadcasts).toHaveLength(0);
    expect(await ext.local.get(PENDING_KEY)).toBeUndefined();
  });

  it('a message altered after prepare is refused without a challenge too', async () => {
    const {ext, deps, view} = await setup(true);
    await alterMessage(ext);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'reauth-required'});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('a pending send that appeared since prepare refuses the send (one open per account), nothing broadcast', async () => {
    const {ext, deps, view} = await setup(true);
    await ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey})]);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'in-flight'});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('an account no longer in the session is refused, nothing broadcast', async () => {
    const {ext, deps, view} = await setup(true);
    const seed = new Uint8Array(32).fill(2);
    const pub = ed25519.getPublicKey(seed);
    const other: SessionAccount = {index: 1, publicKey: base58.encode(pub), secretKey: base64.encode(new Uint8Array([...seed, ...pub]))};
    await setSession(ext, [other]);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'unknown-account'});
    expect(deps.broadcasts).toHaveLength(0);
  });
});
