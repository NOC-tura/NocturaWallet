import {normalizeMnemonicInput} from '../../../core/keys/mnemonic';
import {derivePublicKeys, deriveSessionAccounts} from '../vault/accounts';
import {CorruptEnvelope, UnsafeKdfParams, WrongPasskey, WrongPassword, createEnvelope, type EnvelopeV1, type Kdf} from '../vault/envelope';
import {unwrapDataKey, type ReauthFactor} from '../vault/reauth';
import {envelopeRevision} from '../shared/envelopeRevision';
import {MIN_PASSWORD_LENGTH, acceptedPhrase, commitWallet, type PreparedWallet} from './onboarding';
import {storedVault} from './stored';
import type {Send, VaultStore} from './types';

/**
 * The vault page's half of vault.forgetWallet (spec B1b-2a E5). The background cannot check a
 * password or a seed without holding them, so the proof runs here, in the one page allowed to hold
 * them, and the message carries the revision of the envelope the proof ran against.
 *
 * Two proofs, two messages, and nothing else may send vault.forgetWallet (a source test holds every
 * other src/unlock file to that):
 *  - SEED proof (#39's restore): the phrase derives, under the STORED scheme, every stored account's
 *    key. Its only use is restoreWallet, whose message always carries a `replacement` — the same wallet
 *    re-encrypted under a new password (the background binds it, C4).
 *  - FACTOR proof (#40's "Try a different seed", D41): the password (or passkey) unwraps the stored
 *    data key; no session is needed. Its only use is replaceEmptyWallet, whose message ALWAYS carries
 *    `guard: 'unfunded'`. The background cannot enforce "a factor-proven delete only with the guard"
 *    — #37's delete (B1b-2b) has none — so this module does (plan-1 carry).
 * A proof is an object only proveSeed/proveFactor can mint (a WeakSet records each one): a value
 * that merely looks like a proof sends nothing.
 */
const minted = new WeakSet<object>();

export interface SeedProof {
  readonly kind: 'seed';
  readonly env: EnvelopeV1;
  readonly revision: string;
  /** The phrase as proven, normalised: the replacement encrypts exactly this. */
  readonly mnemonic: string;
}
export interface FactorProof {
  readonly kind: 'factor';
  readonly revision: string;
}

export type SeedProofResult = {outcome: 'match'; proof: SeedProof} | {outcome: 'not-this-wallet' | 'invalid-mnemonic' | 'no-wallet' | 'damaged' | 'failed'};

/** #8 with `source=forgot`: is this phrase the stored wallet's? Local only; nothing is sent. */
export async function proveSeed(readEnvelope: () => Promise<unknown>, phrase: string): Promise<SeedProofResult> {
  try {
    const stored = storedVault(await readEnvelope());
    if (stored.kind === 'none') return {outcome: 'no-wallet'};
    if (stored.kind === 'damaged') return {outcome: 'damaged'};
    if (!acceptedPhrase(phrase)) return {outcome: 'invalid-mnemonic'};
    const {env} = stored;
    const mnemonic = normalizeMnemonicInput(phrase);
    // Under the stored scheme only: the same phrase under the other scheme is another wallet.
    const keys = await derivePublicKeys(mnemonic, env.scheme, env.accounts.map(a => a.index));
    const same = keys.length === env.accounts.length && keys.every((k, i) => k === env.accounts[i]?.publicKey);
    if (!same) return {outcome: 'not-this-wallet'};
    const proof: SeedProof = Object.freeze({kind: 'seed', env, revision: envelopeRevision(env), mnemonic});
    minted.add(proof);
    return {outcome: 'match', proof};
  } catch {
    return {outcome: 'failed'};
  }
}

export type FactorProofResult = {outcome: 'proven'; proof: FactorProof} | {outcome: 'wrong' | 'no-wallet' | 'damaged' | 'failed'};

/**
 * #8 with `source=retry`: the password (or passkey) of the wallet being replaced unwraps its data key
 * — the openWithPassword shape, no session comparison, so it works on a locked wallet. The data key is
 * zeroed at once and nothing else is derived (review R2-L7); a PRF output is zeroed on every path.
 */
export async function proveFactor(readEnvelope: () => Promise<unknown>, factor: ReauthFactor): Promise<FactorProofResult> {
  try {
    const stored = storedVault(await readEnvelope());
    if (stored.kind === 'none') return {outcome: 'no-wallet'};
    if (stored.kind === 'damaged') return {outcome: 'damaged'};
    let key: Uint8Array;
    try {
      key = await unwrapDataKey(stored.env, factor);
    } catch (e) {
      if (e instanceof WrongPassword || e instanceof WrongPasskey) return {outcome: 'wrong'};
      if (e instanceof CorruptEnvelope || e instanceof UnsafeKdfParams) return {outcome: 'damaged'};
      return {outcome: 'failed'};
    }
    key.fill(0);
    const proof: FactorProof = Object.freeze({kind: 'factor', revision: envelopeRevision(stored.env)});
    minted.add(proof);
    return {outcome: 'proven', proof};
  } catch {
    return {outcome: 'failed'};
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}

/** vault.forgetWallet's refusals as the page names them (the background's `stored-invalid` is `damaged`). */
export type ForgetRefusal = 'send-open' | 'busy' | 'unlocked' | 'funded' | 'unreachable' | 'coordinator-refused' | 'no-wallet' | 'damaged' | 'failed';
const NAMED: readonly string[] = ['send-open', 'busy', 'unlocked', 'funded', 'unreachable', 'coordinator-refused', 'no-wallet'];

async function forget(send: Send, message: {type: 'vault.forgetWallet'; expectedRevision: string; replacement?: EnvelopeV1; guard?: 'unfunded'}): Promise<'forgotten' | ForgetRefusal> {
  try {
    const r = await send(message);
    if (r.ok) return 'forgotten';
    if (r.error === 'stored-invalid') return 'damaged';
    return NAMED.find(n => n === r.error) as ForgetRefusal | undefined ?? 'failed';
  } catch {
    return 'failed';
  }
}

export type RestoreOutcome = 'restored' | 'restored-locked' | 'weak-password' | ForgetRefusal;

/**
 * #39's restore (D35): the seed-proven wallet, re-encrypted under a new password with the stored
 * scheme, every stored account index and every stored name, replaces the stored envelope in ONE
 * message (vault.forgetWallet with `replacement`: no window without a wallet). Then the keys.
 * Known recipients and settings are kept by the background (D40): the same wallet is proven.
 */
export async function restoreWallet(deps: {send: Send; kdf: Kdf}, proof: SeedProof, password: string): Promise<RestoreOutcome> {
  if (!minted.has(proof) || proof.kind !== 'seed') return 'failed';
  if (password.length < MIN_PASSWORD_LENGTH) return 'weak-password';
  const {env, mnemonic} = proof;
  let replacement: EnvelopeV1;
  try {
    replacement = await createEnvelope({mnemonic, password, scheme: env.scheme, accounts: env.accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})), kdf: deps.kdf});
  } catch {
    return 'failed';
  }
  const r = await forget(deps.send, {type: 'vault.forgetWallet', expectedRevision: proof.revision, replacement});
  if (r !== 'forgotten') return r;
  try {
    const session = await deriveSessionAccounts(mnemonic, env.scheme, env.accounts.map(a => a.index));
    const set = await deps.send({type: 'vault.setKeys', accounts: session});
    return set.ok ? 'restored' : 'restored-locked';
  } catch {
    return 'restored-locked';
  }
}

export type ReplaceOutcome = 'created' | 'created-locked' | 'exists' | 'store-failed' | ForgetRefusal;

/**
 * #40's "Try a different seed" (D41, §11.13): a different seed is a different wallet, so C4 forbids it
 * as a replacement. The factor-proven wallet is deleted — always under the background's unfunded guard
 * (C6), which re-reads every account's balances at the moment of deletion — and the new wallet,
 * already encrypted (`next`), is stored at once as a first write. The two writes are not atomic: when
 * the store fails after the delete the answer is 'store-failed', and the page offers [Try again], which
 * runs commitWallet alone (never a second delete).
 */
export async function replaceEmptyWallet(deps: VaultStore & {send: Send}, proof: FactorProof, next: PreparedWallet): Promise<ReplaceOutcome> {
  if (!minted.has(proof) || proof.kind !== 'factor') return 'failed';
  const r = await forget(deps.send, {type: 'vault.forgetWallet', expectedRevision: proof.revision, guard: 'unfunded'});
  if (r !== 'forgotten') return r;
  const stored = await commitWallet(deps, next);
  return stored === 'failed' ? 'store-failed' : stored;
}
