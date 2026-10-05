import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {sendPrepared, signPrepared} from '../send';
import {discardPrepared, peekPrepared, preparedFor, preparedIntegrity, prepareSend, PREPARED_TTL_MS, sendIntentDigest, type PreparedSend} from '../prepare';
import {CHALLENGE_MAX_LIFE_MS, CHALLENGE_TTL_MS, challengeInfo, challengeSatisfied, consumeChallenge, satisfyChallenge} from '../reauthChallenges';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {PREPARED_KEY, setSession} from '../session';
import {PENDING_KEY, readPending} from '../pendingStore';
import type {SessionAccount} from '../../vault/accounts';
import {AUTOLOCK_ALARM} from '../autolock';
import {firstSignature} from '../../../../core/solana/broadcast';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, PUB, RECIPIENT, chargedByWire, pendingRecord, sendReader, signedWire, unlocked} from './fixtures';

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
    const {intentDigest: digest} = (await peekPrepared(ext, view.id))!;
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
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'prepared-invalid'});
    expect(deps.broadcasts).toHaveLength(0);
    expect(await ext.local.get(PENDING_KEY)).toBeUndefined();
  });

  it('a message altered after prepare is refused without a challenge too', async () => {
    const {ext, deps, view} = await setup(true);
    await alterMessage(ext);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'prepared-invalid'});
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

describe('re-authentication outlives the 30 s prepared send (final review, Important 1)', () => {
  it('the reviewer scenario: proof lands after 31 s → prepared-expired → re-prepare with the challengeId → sent, with ONE re-auth', async () => {
    const {ext, deps, view} = await setup(false);
    const challengeId = view.reauth!.challengeId;
    deps.clock.t += 31_000; // a human re-authentication: tab, password, Argon2id
    expect(await satisfyChallenge(ext, deps.now(), challengeId)).toBe(true);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'prepared-expired'});
    const again = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId});
    expect(again.reauth?.challengeId).toBe(challengeId);
    const sent = await sendPrepared(ext, deps, again.id);
    expect(sent.state).toBe('pending');
    expect(deps.broadcasts).toHaveLength(1);
    // The proof was consumed by that send: it authorises nothing else.
    const intentDigest = sendIntentDigest(ACCOUNT.publicKey, INTENT);
    expect(await consumeChallenge(ext, deps.now(), challengeId, intentDigest)).toBe(false);
  });

  it('without the challengeId a re-prepare asks again (negative control of the carry-over)', async () => {
    const {ext, deps, view} = await setup(false);
    const challengeId = view.reauth!.challengeId;
    deps.clock.t += 31_000;
    await satisfyChallenge(ext, deps.now(), challengeId);
    const again = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    expect(again.reauth?.challengeId).not.toBe(challengeId);
    await expect(sendPrepared(ext, deps, again.id)).rejects.toMatchObject({code: 'reauth-required', detail: again.reauth!.challengeId});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('a proof for one intent does not send another: other amount → a new, unproven challenge', async () => {
    const {ext, deps, view} = await setup(false);
    const challengeId = view.reauth!.challengeId;
    await satisfyChallenge(ext, deps.now(), challengeId);
    const other = await prepareSend(ext, deps, ACCOUNT.publicKey, {...INTENT, amount: '2000000'}, {challengeId});
    expect(other.reauth?.challengeId).not.toBe(challengeId);
    await expect(sendPrepared(ext, deps, other.id)).rejects.toMatchObject({code: 'reauth-required'});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('a stored entry whose challenge was dropped after prepare is refused as prepared-invalid, nothing broadcast', async () => {
    const {ext, deps, view} = await setup(false);
    const stored = (await ext.session.get(PREPARED_KEY)) as {challengeId: string | null}[];
    await ext.session.set(PREPARED_KEY, stored.map(p => ({...p, challengeId: null})));
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'prepared-invalid'});
    expect(deps.broadcasts).toHaveLength(0);
  });
});

describe('preparedFor (a reopened popup resumes)', () => {
  it('the newest prepared send for the account, with its intent, fees and challenge; null for another account', async () => {
    const {ext, deps, view} = await setup(false);
    const found = await preparedFor(ext, deps, ACCOUNT.publicKey);
    expect(found).toEqual({...view, intent: INTENT, expired: false});
    expect(await preparedFor(ext, deps, RECIPIENT)).toBeNull();
    const newer = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId: view.reauth!.challengeId});
    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.id).toBe(newer.id);
  });

  it('past 30 s it is reported expired (not sendable) so the popup re-prepares with the intent and the challengeId; gone with the challenge', async () => {
    const {ext, deps, view} = await setup(false);
    deps.clock.t += PREPARED_TTL_MS;
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toMatchObject({id: view.id, expired: true, intent: INTENT, reauth: view.reauth});
    deps.clock.t += CHALLENGE_TTL_MS;
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
  });

  it('nothing once it was sent (single use)', async () => {
    const {ext, deps, view} = await setup(true);
    await sendPrepared(ext, deps, view.id);
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
  });
});

// Plan 3: what #20 needs from the engine to take one tap per broadcast — whether the challenge is proven (so
// a resumed #20 sends on a tap instead of opening #10 again), when the quote ends, and the fee #21 shows.
describe('the views #20 and #21 read (plan 3)', () => {
  it('reauth.proven follows the challenge: false when issued, true once the vault page proves it, false again for a new grant', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const first = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    const challengeId = first.reauth!.challengeId;
    expect(first.reauth?.proven).toBe(false);
    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.reauth?.proven).toBe(false);
    await satisfyChallenge(ext, deps.now(), challengeId);
    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.reauth?.proven).toBe(true);
    // Past its 120 s life the proof is gone: preparedFor no longer reports the send at all.
    deps.clock.t += CHALLENGE_TTL_MS;
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
  });

  it('a young send whose challenge reached C5’s 10-minute cap is reported expired; prepared again, it gets a fresh live challenge, and is then live (review M1)', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const start = deps.clock.t;
    let view = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    const old = view.reauth!.challengeId;
    await satisfyChallenge(ext, deps.now(), old);
    // Kept alive by re-prepares carrying the challenge (each rebases it) up to 10 s before the cap.
    while (deps.clock.t + 100_000 < start + CHALLENGE_MAX_LIFE_MS - 10_000) {
      deps.clock.t += 100_000;
      view = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId: old});
      expect(view.reauth?.challengeId).toBe(old);
    }
    deps.clock.t = start + CHALLENGE_MAX_LIFE_MS - 10_000;
    view = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId: old});
    expect(view.reauth).toMatchObject({challengeId: old, proven: true});
    // 20 s on: the send is 20 s old (its 120 s window open), but the challenge passed its cap.
    deps.clock.t += 20_000;
    expect(await challengeInfo(ext, deps.now(), old)).toBeNull();
    const resumed = await preparedFor(ext, deps, ACCOUNT.publicKey);
    expect(resumed).toMatchObject({expired: true, reauth: {challengeId: old, proven: false}});
    // Prepared again carrying it: a fresh challenge, unproven, live — and preparedFor no longer says expired.
    const fresh = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId: old});
    expect(fresh.reauth?.challengeId).not.toBe(old);
    expect(fresh.reauth?.proven).toBe(false);
    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toMatchObject({expired: false, reauth: {challengeId: fresh.reauth?.challengeId}});
  });

  it('validUntil is the prepare time plus the 30 s prepared life, in the view and in preparedFor', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    const prepared = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    expect(prepared.validUntil).toBe(deps.clock.t + PREPARED_TTL_MS);
    deps.clock.t += 10_000;
    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.validUntil).toBe(prepared.validUntil);
  });

  it('the pending record carries the fee it pays in two parts: network fee and Noctura fee', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
    const deps = fakeDeps({reader: sendReader()});
    deps.broadcast = async wire => firstSignature(wire);
    const prepared = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    const view = await sendPrepared(ext, deps, prepared.id);
    expect(view.fee).toEqual({networkLamports: prepared.fees.networkLamports, markupLamports: prepared.fees.markupLamports});
    expect((await readPending(ext))[0]?.fee).toEqual(view.fee);
  });
});

// Plan 3, the send engine's invariants with the new fields in place: a proof authorises one intent once, a
// prepared id is spent by any ending, and the fee a record carries is what the signed bytes charge.
describe('send invariants (plan 3)', () => {
  it('a proof authorises only its own intent: a stored send for another intent carrying the proven challenge is refused, nothing broadcast', async () => {
    const {ext, deps, view} = await setup(false);
    const proven = view.reauth!.challengeId;
    await satisfyChallenge(ext, deps.now(), proven);
    const other = await prepareSend(ext, deps, ACCOUNT.publicKey, {...INTENT, amount: '2000000'});
    // Re-bound by hand to the proven challenge, with a recomputed integrity digest so only the digest binding stands.
    const stored = (await ext.session.get(PREPARED_KEY)) as PreparedSend[];
    await ext.session.set(PREPARED_KEY, stored.map(p => (p.id === other.id ? {...p, challengeId: proven, integrity: preparedIntegrity({...p, challengeId: proven})} : p)));
    await expect(sendPrepared(ext, deps, other.id)).rejects.toMatchObject({code: 'reauth-required'});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('a proof authorises once: after its send, a re-prepare carrying the same challenge is not proven and its send is refused', async () => {
    const {ext, deps, view} = await setup(false);
    const challengeId = view.reauth!.challengeId;
    await satisfyChallenge(ext, deps.now(), challengeId);
    expect((await sendPrepared(ext, deps, view.id)).state).toBe('pending');
    // The open pending send would refuse a second prepare (one in flight per account); let it settle first.
    await ext.local.set(PENDING_KEY, []);
    const again = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId});
    expect(again.reauth?.proven).toBe(false);
    expect(again.reauth?.challengeId).not.toBe(challengeId);
    await expect(sendPrepared(ext, deps, again.id)).rejects.toMatchObject({code: 'reauth-required'});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('a prepared id is spent by a discard (#20 Cancel, #10 Cancel send): its send is refused, nothing broadcast', async () => {
    const {ext, deps, view} = await setup(true);
    await discardPrepared(ext, ACCOUNT.publicKey);
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'unknown-prepared'});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('a prepared id is spent by its expiry: refused as prepared-expired, and refused again even with the clock turned back', async () => {
    const {ext, deps, view} = await setup(true);
    const start = deps.clock.t;
    deps.clock.t += PREPARED_TTL_MS;
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'prepared-expired'});
    deps.clock.t = start;
    await expect(sendPrepared(ext, deps, view.id)).rejects.toMatchObject({code: 'unknown-prepared'});
    expect(deps.broadcasts).toHaveLength(0);
  });

  it('fee is what the broadcast bytes charge (network: signatures × 5 000 + signed priority fee; no markup), digit strings', async () => {
    const {ext, deps, view} = await setup(true);
    const sent = await sendPrepared(ext, deps, view.id);
    const {network, markup} = chargedByWire(deps.broadcasts[0]!, MAINNET_FEE_TREASURY);
    expect(sent.fee).toEqual({networkLamports: network.toString(), markupLamports: markup.toString()});
    expect(sent.fee?.markupLamports).toBe('0');
    expect((await readPending(ext))[0]?.fee).toEqual(sent.fee);
  });

  it('validUntil is the engine clock at prepare plus 30 s — neither the wall clock nor the time of a later read', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    const deps = fakeDeps({reader: sendReader()});
    deps.clock.t = 5_000_000;
    const prepared = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
    expect(prepared.validUntil).toBe(5_000_000 + PREPARED_TTL_MS);
    deps.clock.t += PREPARED_TTL_MS + 1;
    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.validUntil).toBe(5_000_000 + PREPARED_TTL_MS);
  });
});
