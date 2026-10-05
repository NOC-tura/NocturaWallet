import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {VersionedMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';
import type {WalletDeps} from './deps';
import {getSession} from './session';
import {armAutolock} from './autolock';
import {challengeSatisfied, consumeChallenge} from './reauthChallenges';
import {peekPrepared, preparedIntegrity, sendIntentDigest, takePrepared, type PreparedSend} from './prepare';
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

export async function sendPrepared(ext: Ext, deps: WalletDeps, id: string): Promise<PendingView> {
  if ((await getSession(ext)) === null) throw new SendRefused('locked');
  const peek = await peekPrepared(ext, id);
  if (peek === null) throw new SendRefused('unknown-prepared');
  // Checked before the prepared send is taken, so a Send before re-authenticating does not burn it.
  if (peek.challengeId !== null && !(await challengeSatisfied(ext, deps.now(), peek.challengeId, sendIntentDigest(peek.account, peek.intent)))) {
    throw new SendRefused('reauth-required', peek.challengeId);
  }
  const prepared = await takePrepared(ext, deps, id);
  // What is about to be signed must be what was bound at prepare time: a stored entry changed
  // since (message, amount, recipient, account, challenge) no longer matches its integrity
  // digest and is refused. The challenge is bound to the intent, recomputed from the stored
  // fields — never taken from the stored intentDigest.
  const intentDigest = sendIntentDigest(prepared.account, prepared.intent);
  if (preparedIntegrity(prepared) !== prepared.integrity || intentDigest !== prepared.intentDigest) throw new SendRefused('prepared-invalid');
  if (prepared.challengeId !== null && !(await consumeChallenge(ext, deps.now(), prepared.challengeId, intentDigest))) {
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
