import {base58} from '@scure/base';
import {generateMnemonic, mnemonicToSeed, normalizeMnemonicInput, validateMnemonic} from '../../../core/keys/mnemonic';
import {deriveTransparentKeypair} from '../../../core/keys/transparent';
import {
  CorruptEnvelope, UnsafeKdfParams, WrongPassword, addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1, type Kdf,
} from '../vault/envelope';
import {deriveSessionAccounts} from '../vault/accounts';
import {registerPasskey, type CredentialsApi} from '../vault/passkey';
import {envelopeRevision} from '../shared/envelopeRevision';
import type {Send, VaultStore} from './types';

/** Spec §2: at least 12 characters. Recovery is the seed phrase and nothing else. */
export const MIN_PASSWORD_LENGTH = 12;
/** The app's auto-detection scans SLIP-0010 accounts 0–4 (accountDetection.ts), plus cli. */
export const SLIP10_ACCOUNTS_TO_SCAN = 5;

/** Create: 24 words, 256 bits of entropy (spec §2; the app's generate(wordlist, 256)). */
export function newMnemonic(): string {
  return generateMnemonic();
}

/**
 * A phrase this wallet imports: exactly 12 or 24 words once normalised (spec §2, as the app's
 * ImportSeedScreen), and a valid BIP-39 checksum. 15-, 18- and 21-word phrases are valid BIP-39
 * but refused, as the app refuses them.
 */
export function acceptedPhrase(mnemonic: string): boolean {
  const words = normalizeMnemonicInput(mnemonic).split(' ').length;
  return (words === 12 || words === 24) && validateMnemonic(mnemonic);
}

export interface Candidate {
  scheme: 'slip10' | 'cli';
  index: number;
  publicKey: string;
}

/** Every address the phrase could mean, derived locally; the secret halves are zeroed at once. */
export async function importCandidates(mnemonic: string): Promise<Candidate[]> {
  const seed = await mnemonicToSeed(mnemonic);
  try {
    const out: Candidate[] = [];
    const add = (scheme: Candidate['scheme'], index: number, kp: {publicKey: Uint8Array; secretKey: Uint8Array}) => {
      out.push({scheme, index, publicKey: base58.encode(kp.publicKey)});
      kp.secretKey.fill(0);
    };
    for (let i = 0; i < SLIP10_ACCOUNTS_TO_SCAN; i++) add('slip10', i, deriveTransparentKeypair(seed, {kind: 'slip10', account: i}));
    add('cli', 0, deriveTransparentKeypair(seed, {kind: 'cli'}));
    return out;
  } finally {
    seed.fill(0);
  }
}

export interface ProbeResult {
  /** False when the balances could not be read: the user chooses, nothing is assumed empty. */
  resolved: boolean;
  funded: ReadonlySet<string>;
}

const positive = (x: unknown): boolean => typeof x === 'string' && /^\d+$/.test(x) && BigInt(x) > 0n;

/** The vault page never touches the network: it hands the background public keys and reads back numbers. */
export async function probeCandidates(send: Send, candidates: readonly Candidate[]): Promise<ProbeResult> {
  const unresolved: ProbeResult = {resolved: false, funded: new Set()};
  let reply: Awaited<ReturnType<Send>>;
  try {
    reply = await send({type: 'wallet.probeBalances', publicKeys: candidates.map(c => c.publicKey)});
  } catch {
    return unresolved;
  }
  const data = reply.ok && typeof reply.data === 'object' && reply.data !== null ? (reply.data as {resolved?: unknown; balances?: unknown}) : null;
  if (data === null || data.resolved !== true || !Array.isArray(data.balances)) return unresolved;
  const funded = new Set<string>();
  for (const b of data.balances as unknown[]) {
    if (typeof b !== 'object' || b === null) continue;
    const {publicKey, lamports, noc} = b as {publicKey?: unknown; lamports?: unknown; noc?: unknown};
    if (typeof publicKey === 'string' && (positive(lamports) || positive(noc))) funded.add(publicKey);
  }
  return {resolved: true, funded};
}

export type SchemeChoice = {scheme: 'slip10' | 'cli'} | {choose: 'both-funded' | 'unresolved'};

/** Spec §2: import picks the scheme detection finds funded; if both are funded the user chooses. */
export function chooseScheme(candidates: readonly Candidate[], probe: ProbeResult): SchemeChoice {
  if (!probe.resolved) return {choose: 'unresolved'};
  const slip10 = candidates.some(c => c.scheme === 'slip10' && probe.funded.has(c.publicKey));
  const cli = candidates.some(c => c.scheme === 'cli' && probe.funded.has(c.publicKey));
  if (slip10 && cli) return {choose: 'both-funded'};
  return {scheme: cli ? 'cli' : 'slip10'};
}

/** cli: its one account. slip10: accounts 0 … the highest funded (0 alone when none is funded). */
export function indexesFor(scheme: 'slip10' | 'cli', candidates: readonly Candidate[], probe: ProbeResult): number[] {
  if (scheme === 'cli') return [0];
  const funded = candidates.filter(c => c.scheme === 'slip10' && probe.funded.has(c.publicKey)).map(c => c.index);
  const top = funded.length > 0 ? Math.max(...funded) : 0;
  return Array.from({length: top + 1}, (_, i) => i);
}

export type Detection = {outcome: 'invalid-mnemonic'} | {outcome: 'detected'; candidates: Candidate[]; probe: ProbeResult; choice: SchemeChoice};

/** Import's detection: refuse a phrase it does not import (before anything is sent), derive, probe, choose. */
export async function detectImport(send: Send, mnemonic: string): Promise<Detection> {
  if (!acceptedPhrase(mnemonic)) return {outcome: 'invalid-mnemonic'};
  const candidates = await importCandidates(mnemonic);
  const probe = await probeCandidates(send, candidates);
  return {outcome: 'detected', candidates, probe, choice: chooseScheme(candidates, probe)};
}

export type FinishOutcome = 'created' | 'created-locked' | 'exists' | 'weak-password' | 'invalid-mnemonic' | 'failed';

const present = (x: unknown): boolean => x !== undefined && x !== null;

/**
 * Encrypt and store a new or imported wallet, then hand the background its signing keys. Never
 * overwrites a stored vault: checked here before the seconds-long Argon2id run, and enforced by
 * the background at the store — a first write (expectedRevision null) lands only while no wallet is
 * stored, so a wallet another tab finished first answers 'wallet-exists'. The phrase is stored
 * normalised — the exact string that validated and that the seed is derived from.
 */
export async function finishOnboarding(
  deps: VaultStore & {send: Send; kdf: Kdf},
  input: {mnemonic: string; password: string; scheme: 'slip10' | 'cli'; indexes: number[]},
): Promise<FinishOutcome> {
  if (input.password.length < MIN_PASSWORD_LENGTH) return 'weak-password';
  if (!acceptedPhrase(input.mnemonic)) return 'invalid-mnemonic';
  try {
    if (present(await deps.readEnvelope())) return 'exists';
    const mnemonic = normalizeMnemonicInput(input.mnemonic);
    const session = await deriveSessionAccounts(mnemonic, input.scheme, input.indexes);
    const accounts = session.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}));
    const env = await createEnvelope({mnemonic, password: input.password, scheme: input.scheme, accounts, kdf: deps.kdf});
    const stored = await deps.storeEnvelope(null, env);
    if (stored === 'wallet-exists') return 'exists';
    if (stored !== 'stored') return 'failed';
    try {
      const r = await deps.send({type: 'vault.setKeys', accounts: session});
      return r.ok ? 'created' : 'created-locked';
    } catch {
      return 'created-locked';
    }
  } catch {
    return 'failed';
  }
}

export type PasskeyOutcome = 'added' | 'unsupported' | 'wrong' | 'no-wallet' | 'damaged' | 'failed';

type Unwrapped = {dataKey: Uint8Array; env: EnvelopeV1} | Exclude<PasskeyOutcome, 'added' | 'unsupported'>;

async function openWithPassword(deps: VaultStore, factor: {password: string; kdf: Kdf}): Promise<Unwrapped> {
  const raw = await deps.readEnvelope();
  if (!present(raw)) return 'no-wallet';
  const env = raw as EnvelopeV1;
  try {
    return {dataKey: await unlockWithPassword(env, factor.password, factor.kdf), env};
  } catch (e) {
    if (e instanceof WrongPassword) return 'wrong';
    if (e instanceof CorruptEnvelope || e instanceof UnsafeKdfParams) return 'damaged';
    return 'failed';
  }
}

/**
 * Add a passkey to a stored wallet (spec §2): the password unwraps the data key, the passkey is
 * created and proven with a get() (PRF), and the data key is wrapped a second time; the background
 * stores it over the revision of the envelope that was opened. On 'busy' (the envelope moved), the
 * envelope is read and the password proven again — once — and the SAME new passkey is wrapped (one
 * credential prompt, never two). Every data key and the PRF output are zeroed on every path. Runs in a
 * tab. B1b-1 has no page control for it (B1b-2's security screen).
 */
export async function addPasskey(
  deps: VaultStore & {credentials: CredentialsApi; randomBytes(n: number): Uint8Array},
  factor: {password: string; kdf: Kdf},
): Promise<PasskeyOutcome> {
  const keys: Uint8Array[] = [];
  let prfOutput: Uint8Array | null = null;
  try {
    let opened = await openWithPassword(deps, factor);
    if (typeof opened === 'string') return opened;
    keys.push(opened.dataKey);
    const reg = await registerPasskey(deps.credentials, deps.randomBytes(16));
    if ('unsupported' in reg) return 'unsupported';
    prfOutput = reg.prfOutput;
    for (let i = 0; i < 2; i++) {
      if (i > 0) {
        opened = await openWithPassword(deps, factor);
        if (typeof opened === 'string') return opened;
        keys.push(opened.dataKey);
      }
      const next = await addPasskeyWrap(opened.env, opened.dataKey, reg.prfOutput, reg.credentialId, reg.prfSalt);
      const stored = await deps.storeEnvelope(envelopeRevision(opened.env), next);
      if (stored === 'stored') return 'added';
      if (stored === 'stored-invalid') return 'damaged';
      if (stored === 'no-wallet') return 'no-wallet';
      if (stored !== 'busy') return 'failed';
    }
    return 'failed';
  } catch {
    return 'failed';
  } finally {
    for (const k of keys) k.fill(0);
    prfOutput?.fill(0);
  }
}
