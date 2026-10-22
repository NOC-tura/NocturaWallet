import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {VersionedMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';
import type {WalletDeps} from './deps';
import {getSession} from './session';
import {armAutolock} from './autolock';
import {challengeSatisfied, consumeChallenge} from './reauthChallenges';
import {parseIntent, peekPrepared, preparedIntegrity, takePrepared, type PreparedEntry} from './prepare';
import {SEND_KIND, intentDigest, intentKind, type IntentKind} from './intents';
import {submitSigned} from './pending';
import type {PendingExtra, PendingView} from './pendingStore';
import {SendRefused, type SendIntent} from './sendTypes';

/**
 * Sign exactly the prepared message bytes (deserialised, signed, serialised — never rebuilt), as
 * its payer, with the session key; the key bytes are zeroed after.
 */
export function signPrepared(prepared: PreparedEntry, account: SessionAccount): Uint8Array {
  const message = VersionedMessage.deserialize(base64.decode(prepared.message));
  const payer = message.staticAccountKeys[0];
  if (payer === undefined || payer.toBase58() !== account.publicKey) throw new SendRefused('unknown-account');
  const secret = base64.decode(account.secretKey);
  try {
    const tx = new VersionedTransaction(message);
    tx.addSignature(payer, ed25519.sign(message.serialize(), secret.subarray(0, 32)));
    return tx.serialize();
  } finally {
    secret.fill(0);
  }
}

/** What the pending record says about a signed entry: a send carries its intent; any other kind its display data (B1d §1.3). */
function recordFields(kind: IntentKind<unknown>, prepared: PreparedEntry, intent: unknown): {intent: SendIntent} | {intent: null; extra: PendingExtra} {
  if (kind.kind !== SEND_KIND) return {intent: null, extra: {kind: kind.kind, data: kind.pendingData?.(prepared, intent) ?? null}};
  const send = parseIntent(prepared.intent);
  if (send === null) throw new SendRefused('prepared-invalid');
  return {intent: send};
}

/**
 * Sign and submit a prepared entry of the caller's kind (B1d §1.3, C29): the session, the entry and its kind; its
 * challenge, checked without consuming it; the kind's beforeSign; only then the single-use take, the integrity and the
 * challenge's consumption. `kindName` is the one kind the caller signs — `send` unless it names another (D17: wallet.send
 * signs only a send; a purchase is signed only through presale.buy, which names its own).
 */
export async function sendPrepared(ext: Ext, deps: WalletDeps, id: string, kindName: string = SEND_KIND): Promise<PendingView> {
  if ((await getSession(ext)) === null) throw new SendRefused('locked');
  const peek = await peekPrepared(ext, id);
  // An entry of another kind is not this caller's to sign: refused as unknown, nothing burned.
  if (peek === null || peek.kind !== kindName) throw new SendRefused('unknown-prepared');
  // A kind this build does not handle (an entry of a build with presale, signed in one without it) is never signed.
  const kind = intentKind(peek.kind);
  const peekIntent = kind === undefined ? null : kind.parseIntent(peek.intent);
  if (kind === undefined || peekIntent === null) throw new SendRefused('prepared-invalid');
  // Checked before the prepared send is taken, so a Send before re-authenticating does not burn it.
  if (peek.challengeId !== null && !(await challengeSatisfied(ext, deps.now(), peek.challengeId, intentDigest(kind, peek.account, peekIntent)))) {
    throw new SendRefused('reauth-required', peek.challengeId);
  }
  // C29 (review M4): the kind's own checks, still before the take — a refusal here leaves the entry stored and the
  // proof proven, so the re-prepare that follows asks for no second re-authentication. A slow one ends in
  // takePrepared's unchanged TTL (prepared-expired).
  await kind.beforeSign({ext, deps}, peek, peekIntent);
  const prepared = await takePrepared(ext, deps, id);
  // What is signed is the entry beforeSign checked: one changed or replaced since the peek is refused.
  if (prepared.integrity !== peek.integrity || prepared.kind !== peek.kind) throw new SendRefused('prepared-invalid');
  // What is about to be signed must be what was bound at prepare time: a stored entry changed
  // since (message, amount, recipient, account, challenge) no longer matches its integrity
  // digest and is refused. The challenge is bound to the intent, recomputed from the stored
  // fields — never taken from the stored intentDigest.
  const intent = kind.parseIntent(prepared.intent);
  if (intent === null) throw new SendRefused('prepared-invalid');
  const digest = intentDigest(kind, prepared.account, intent);
  if (preparedIntegrity(prepared) !== prepared.integrity || digest !== prepared.intentDigest) throw new SendRefused('prepared-invalid');
  if (prepared.challengeId !== null && !(await consumeChallenge(ext, deps.now(), prepared.challengeId, digest))) {
    throw new SendRefused('reauth-required');
  }
  // The session as it is now (a lock or a changed account list since the start is honoured).
  const session = await getSession(ext);
  if (session === null) throw new SendRefused('locked');
  const account = session.find(a => a.publicKey === prepared.account);
  if (account === undefined) throw new SendRefused('unknown-account');
  const view = await submitSigned(ext, deps, {
    account: prepared.account,
    wire: signPrepared(prepared, account),
    lastValidBlockHeight: prepared.lastValidBlockHeight,
    ...recordFields(kind, prepared, intent),
    // What this transaction pays, in two parts: its network fee (5 000 per signature plus the priority fee,
    // both fixed by the signed compute-unit price and limit) and the Noctura fee ('0' when none is charged).
    // Apart, because a landed-but-failed transaction pays the first and gets the second rolled back.
    fee: {networkLamports: prepared.shown.fees.networkLamports, markupLamports: prepared.shown.fees.markupLamports},
  });
  // An approved signature resets the idle timer (spec §2) — best effort: the transaction is out,
  // and a failed re-arm must not turn its answer into "failed".
  await armAutolock(ext).catch((e: unknown) => console.warn('idle timer not re-armed after a send', e));
  return view;
}
