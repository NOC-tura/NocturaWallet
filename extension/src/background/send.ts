import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {VersionedMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';
import type {WalletDeps} from './deps';
import {getSession} from './session';
import {armAutolock} from './autolock';
import {challengeSatisfied, consumeChallenge} from './reauthChallenges';
import {digestOf} from './digest';
import {peekPrepared, takePrepared, type PreparedSend} from './prepare';
import {submitSigned} from './pending';
import type {PendingView} from './pendingStore';
import {SendRefused} from './sendTypes';

/**
 * Sign exactly the prepared message bytes (deserialised, signed, serialised — never rebuilt), as
 * its payer, with the session key; the key bytes are zeroed after.
 */
export function signPrepared(prepared: PreparedSend, account: SessionAccount): Uint8Array {
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

/** The digest prepare.ts bound to this send, recomputed from what is stored now — same fields, same order. */
function recomputedDigest(p: PreparedSend): string {
  return digestOf('send', {account: p.account, token: p.intent.token, recipient: p.intent.recipient, amount: p.intent.amount, message: p.message});
}

export async function sendPrepared(ext: Ext, deps: WalletDeps, id: string): Promise<PendingView> {
  if ((await getSession(ext)) === null) throw new SendRefused('locked');
  const peek = await peekPrepared(ext, id);
  if (peek === null) throw new SendRefused('unknown-prepared');
  // Checked before the prepared send is taken, so a Send before re-authenticating does not burn it.
  if (peek.challengeId !== null && !(await challengeSatisfied(ext, deps.now(), peek.challengeId, peek.digest))) {
    throw new SendRefused('reauth-required', peek.challengeId);
  }
  const prepared = await takePrepared(ext, deps, id);
  // What is about to be signed must be what was bound at prepare time: a stored entry changed
  // since (message, amount, recipient, account) no longer matches its digest and is refused.
  const digest = recomputedDigest(prepared);
  if (digest !== prepared.digest) throw new SendRefused('reauth-required');
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
    intent: prepared.intent,
  });
  await armAutolock(ext); // an approved signature resets the idle timer (spec §2)
  return view;
}
