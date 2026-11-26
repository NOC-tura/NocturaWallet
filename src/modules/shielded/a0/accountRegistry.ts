/**
 * The account registry (spec §10, S5, S9; §6.1 "Destination", I-5): the transparent accounts of
 * this seed the wallet knows, each a `TransparentScheme` string with a role.
 *
 * ROLES — `main` (the scheme the wallet was created or imported with,
 * `WALLET_TRANSPARENT_DERIVATION`, whatever it is: `slip10:3` stays `slip10:3`, never renumbered;
 * no call here changes it), `fresh-pending` (a fresh exit account reserved when the user proceeds
 * to the unshield confirmation, §6.1) and `fresh-exit` (the reservation promoted when the unshield
 * landed, §6.8, or an exit account found by a restore, §7). `linked` on a `fresh-exit` is also set by
 * `markA0AccountsLinked` after a confirmed own-account Send (post-M1d §4). A `fresh-pending` entry is removed on a
 * known non-landing (`releaseA0FreshAccount`); it is never shown in the switcher nor a Send source
 * (M1d's rule — this module only stores it).
 *
 * RULES, as the extension's (`extension/src/shared/envelopeRules.ts`
 * `accountsPolicyOk` / `MAX_ACCOUNTS`, `extension/src/unlock/accountsFlow.ts` `isAccountIndex` /
 * `lowestFreeIndex`):
 *   - a `cli` wallet has exactly one account, its `main` (S9): no fresh index is ever handed out;
 *   - `slip10` indices are integers in 0 … 2^31 − 1, no two entries share one, at most 100 entries
 *     (the main included);
 *   - the fresh index is the lowest `slip10` index not in the registry under ANY role, then the
 *     history check: `getSignaturesForAddress(address, {limit: 1})` at `confirmed` must be empty
 *     (on the pool's cluster — devnet; it says nothing about mainnet). That request is the ONE
 *     fresh-account RPC request §2 states; an index with history is skipped (an account the
 *     extension or another wallet of this phrase uses) and the next one is checked, at most
 *     `A0_FRESH_HISTORY_SKIP_LIMIT` of them per reservation.
 *
 * ENTRIES — `{scheme, role, address}`. The address (base58 public key) is stored so that the
 * account list can be shown and polled without the seed (which sits behind biometrics); it is
 * derived from the seed when the entry is written, and every call that is handed the seed
 * re-derives every entry and refuses a stored address that differs (`E_A0_ACCOUNTS_SEED`). The
 * public-key set the post-landing verifier needs (`a0SeedPublicKeys`) is always the re-derived one,
 * plus the seed's `cli` key and `slip10:0` whatever the main is.
 *
 * STORAGE — the ENCRYPTED instance only (a plaintext list of one's own accounts is itself a link),
 * one key (`v1_accounts`, schema 1), one value; every write is one synchronous read-modify-write.
 * FAIL CLOSED: no encrypted instance → `E_A0_STORE_LOCKED`; a record that does not decode exactly
 * (any other key, a rule above broken) → `E_A0_ACCOUNTS_CORRUPT` — never an empty list. An absent
 * record is not an empty one either: it is created, with its main, only by a call that holds the
 * seed (`openA0AccountRegistry`).
 *
 * BINDING (M1b's R2-N1 / R3-N5 pattern) — every call takes an optional `bound`: the encrypted
 * instance its caller captured at its own entry. When given, the call refuses with
 * `E_A0_STORE_CHANGED` before reading or writing anything if the open instance is another one (an
 * in-app wipe + import in between), so a stale flow can neither write the old wallet's accounts
 * into the new wallet's registry nor create the new one's record. `reserveA0FreshAccount` captures
 * it itself at entry and holds it across its RPC await.
 *
 * ONE RESERVATION AT A TIME — reservations in this process run one after another (a promise
 * chain), so a second unshield started while the first one's history check is in flight picks the
 * NEXT index, never the same one.
 *
 * SECRETS — the seed is borrowed, never stored, never zero-filled here (the caller owns it); each
 * derived secret key is zero-filled at once. The record holds public values only.
 */
import type {MMKV} from 'react-native-mmkv';
import {PublicKey} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import {mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {deriveTransparentKeypair, schemeToString} from '../../keyDerivation/transparent';
import type {TransparentScheme} from '../../keyDerivation/transparent';
import {loadTransparentScheme} from '../../keyDerivation/derivationScheme';
import type {A0StoreBinding} from './noteStore';

export const A0_ACCOUNT_REGISTRY_SCHEMA = 1;
/** The most entries the registry holds, the main included (the extension's MAX_ACCOUNTS). */
export const A0_MAX_ACCOUNTS = 100;
/** The SLIP-0010 hardened limit of the account level (the extension's MAX_ACCOUNT_INDEX). */
export const A0_MAX_ACCOUNT_INDEX = 2 ** 31 - 1;
/** Candidates with history one reservation skips before it refuses (`E_A0_ACCOUNTS_NO_FRESH`). */
export const A0_FRESH_HISTORY_SKIP_LIMIT = 20;
/**
 * §7 "Accounts": a restore compares exit destinations with `ATA(slip10:n, mint)` for n = 0, 1, …
 * and stops this many consecutive indices past the highest match. Controller ruling 7 (M1c): S15
 * raised the DEPOSIT gap only; this one stays 20. M1c Task 5 consumes it.
 */
export const A0_ACCOUNT_DISCOVERY_GAP = 20;

export type A0AccountRole = 'main' | 'fresh-pending' | 'fresh-exit';

export interface A0AccountEntry {
  /** `slip10:n` | `cli` — the string `schemeToString` writes */
  scheme: string;
  role: A0AccountRole;
  /** the account's base58 public key, derived from the seed when the entry was written */
  address: string;
  /**
   * `fresh-exit` only (M1c Task 7): the exit landed, but a key of this seed signed it (the
   * post-landing verifier's `E_A0_VERIFY_SEED_SIGNER`), so the account is linked to the seed on
   * chain — the screens show it with the linking warning (M1d). Never set otherwise.
   */
  linked?: true;
}

export type A0AccountRegistryErrorCode =
  /** no encrypted instance (before onboarding / after a wipe) */
  | 'E_A0_STORE_LOCKED'
  /** the caller's flow started on another encrypted instance (a wipe + import since) */
  | 'E_A0_STORE_CHANGED'
  /** the stored record does not decode exactly, or breaks a rule */
  | 'E_A0_ACCOUNTS_CORRUPT'
  /** a stored address is not the one the seed derives for its scheme */
  | 'E_A0_ACCOUNTS_SEED'
  /** the stored main is not the wallet's scheme (`WALLET_TRANSPARENT_DERIVATION`) */
  | 'E_A0_ACCOUNTS_MAIN'
  /** a `cli` wallet has no fresh accounts (S9) */
  | 'E_A0_ACCOUNTS_CLI'
  /** 100 entries already */
  | 'E_A0_ACCOUNTS_FULL'
  /** every candidate checked had history (A0_FRESH_HISTORY_SKIP_LIMIT of them) */
  | 'E_A0_ACCOUNTS_NO_FRESH'
  /** the history check's answer is not a list */
  | 'E_A0_ACCOUNTS_RPC'
  /** no entry with this scheme */
  | 'E_A0_ACCOUNTS_UNKNOWN'
  /** the entry is not in the role the call requires */
  | 'E_A0_ACCOUNTS_STATE'
  /** an argument out of range or shape (a seed not 64 bytes, a bad index or scheme) */
  | 'E_A0_ACCOUNTS_INVALID';

export class A0AccountRegistryError extends Error {
  readonly code: A0AccountRegistryErrorCode;
  constructor(code: A0AccountRegistryErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'A0AccountRegistryError';
    this.code = code;
  }
}

/** The one RPC method the fresh rule uses (a `Connection` satisfies it). */
export type A0HistoryRpc = Pick<Connection, 'getSignaturesForAddress'>;

export interface A0RegistryOptions {
  /** the encrypted instance the caller captured at its entry (`mmkvSecure()` then) */
  bound?: A0StoreBinding;
}

const KEY = MMKV_KEYS.ACCOUNTS_REGISTRY;
const SLIP10 = /^slip10:(0|[1-9][0-9]{0,9})$/;
const ROLES: readonly A0AccountRole[] = ['main', 'fresh-pending', 'fresh-exit'];

const err = (code: A0AccountRegistryErrorCode, message: string): A0AccountRegistryError =>
  new A0AccountRegistryError(code, message);

/** A scheme string parsed STRICTLY (unlike `schemeFromString`, which defaults): null if it is not one. */
export function parseA0Scheme(s: unknown): TransparentScheme | null {
  if (s === 'cli') {
    return {kind: 'cli'};
  }
  if (typeof s !== 'string') {
    return null;
  }
  const m = SLIP10.exec(s);
  if (!m) {
    return null;
  }
  const n = Number(m[1]);
  return n <= A0_MAX_ACCOUNT_INDEX ? {kind: 'slip10', account: n} : null;
}

/** The address `scheme` derives from `seed` (core/keys/transparent.ts); the secret key is zero-filled. */
export function a0AccountAddress(seed: Uint8Array, scheme: TransparentScheme): string {
  if (!(seed instanceof Uint8Array) || seed.length !== 64) {
    throw err('E_A0_ACCOUNTS_INVALID', 'the seed is not 64 bytes');
  }
  if (scheme.kind === 'slip10' && !(Number.isSafeInteger(scheme.account) && scheme.account >= 0 && scheme.account <= A0_MAX_ACCOUNT_INDEX)) {
    throw err('E_A0_ACCOUNTS_INVALID', `account index ${scheme.account} is not in 0 … 2^31 − 1`);
  }
  const {publicKey, secretKey} = deriveTransparentKeypair(seed, scheme);
  secretKey.fill(0);
  return new PublicKey(publicKey).toBase58();
}

/** The lowest index not in `taken` (the extension's `lowestFreeIndex`). */
export function lowestFreeA0Index(taken: Iterable<number>): number {
  const set = new Set(taken);
  let i = 0;
  while (set.has(i)) {
    i += 1;
  }
  return i;
}

const isAddress = (v: unknown): v is string => {
  if (typeof v !== 'string') {
    return false;
  }
  try {
    return new PublicKey(v).toBase58() === v;
  } catch {
    return false;
  }
};

const indexOf = (e: A0AccountEntry): number | null => {
  const s = parseA0Scheme(e.scheme);
  return s !== null && s.kind === 'slip10' ? s.account : null;
};

/** The registry's rules over a list (the extension's accountsPolicyOk, plus the roles). Null = ok. */
function ruleBroken(entries: readonly A0AccountEntry[]): string | null {
  if (entries.length === 0 || entries.length > A0_MAX_ACCOUNTS) {
    return `${entries.length} entries (1 … ${A0_MAX_ACCOUNTS})`;
  }
  const mains = entries.filter(e => e.role === 'main');
  if (mains.length !== 1) {
    return `${mains.length} main entries`;
  }
  if (mains[0]!.scheme === 'cli' && entries.length !== 1) {
    return 'a cli wallet has exactly one account';
  }
  const seenIndex = new Set<number>();
  const seenAddress = new Set<string>();
  for (const e of entries) {
    const s = parseA0Scheme(e.scheme);
    if (s === null) {
      return `scheme ${String(e.scheme)}`;
    }
    if (s.kind === 'cli' && e.role !== 'main') {
      return 'a cli entry that is not the main';
    }
    if (s.kind === 'slip10') {
      if (seenIndex.has(s.account)) {
        return `two entries with index ${s.account}`;
      }
      seenIndex.add(s.account);
    }
    if (!ROLES.includes(e.role)) {
      return `role ${String(e.role)}`;
    }
    if (!isAddress(e.address) || seenAddress.has(e.address)) {
      return `address ${String(e.address)}`;
    }
    if (e.linked !== undefined && (e.linked !== true || e.role !== 'fresh-exit')) {
      return `a linked mark on ${e.scheme} (${e.role})`;
    }
    seenAddress.add(e.address);
  }
  return null;
}

function decode(raw: string): A0AccountEntry[] {
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    throw err('E_A0_ACCOUNTS_CORRUPT', `the ${KEY} record is not JSON`);
  }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) {
    throw err('E_A0_ACCOUNTS_CORRUPT', `the ${KEY} record is not an object`);
  }
  const rec = o as Record<string, unknown>;
  if (Object.keys(rec).sort().join(',') !== 'accounts,schema' || rec.schema !== A0_ACCOUNT_REGISTRY_SCHEMA || !Array.isArray(rec.accounts)) {
    throw err('E_A0_ACCOUNTS_CORRUPT', `the ${KEY} record header`);
  }
  const entries = rec.accounts.map((a: unknown): A0AccountEntry => {
    if (a === null || typeof a !== 'object' || Array.isArray(a)) {
      throw err('E_A0_ACCOUNTS_CORRUPT', 'an entry that is not an object');
    }
    const e = a as Record<string, unknown>;
    const keys = Object.keys(e).sort().join(',');
    if (keys !== 'address,role,scheme' && keys !== 'address,linked,role,scheme') {
      throw err('E_A0_ACCOUNTS_CORRUPT', `an entry with the fields ${Object.keys(e).join(',')}`);
    }
    const entry: A0AccountEntry = {scheme: e.scheme as string, role: e.role as A0AccountRole, address: e.address as string};
    if (keys === 'address,linked,role,scheme') {
      entry.linked = e.linked as true;
    }
    return entry;
  });
  const broken = ruleBroken(entries);
  if (broken !== null) {
    throw err('E_A0_ACCOUNTS_CORRUPT', broken);
  }
  return entries;
}

const encode = (entries: readonly A0AccountEntry[]): string =>
  JSON.stringify({
    schema: A0_ACCOUNT_REGISTRY_SCHEMA,
    accounts: entries.map(e => ({scheme: e.scheme, role: e.role, address: e.address, ...(e.linked ? {linked: true} : {})})),
  });

function storage(bound?: A0StoreBinding): MMKV {
  const store = mmkvSecure();
  if (!store) {
    throw err('E_A0_STORE_LOCKED', 'the encrypted store is not open');
  }
  if (bound !== undefined && store !== bound) {
    throw err('E_A0_STORE_CHANGED', 'the encrypted store was replaced (wipe + import) while this flow was in flight; nothing written');
  }
  return store;
}

function readRecord(bound?: A0StoreBinding): A0AccountEntry[] | null {
  const raw = storage(bound).getString(KEY);
  return raw === undefined ? null : decode(raw);
}

function readExisting(bound?: A0StoreBinding): A0AccountEntry[] {
  const entries = readRecord(bound);
  if (entries === null) {
    throw err('E_A0_ACCOUNTS_UNKNOWN', `no ${KEY} record`);
  }
  return entries;
}

function write(entries: readonly A0AccountEntry[], bound?: A0StoreBinding): void {
  const broken = ruleBroken(entries);
  if (broken !== null) {
    throw err('E_A0_ACCOUNTS_INVALID', broken);
  }
  storage(bound).set(KEY, encode(entries));
}

/** Every entry re-derived from `seed`, and the main against the wallet's scheme. */
function checkAgainstSeed(entries: readonly A0AccountEntry[], seed: Uint8Array): void {
  const main = entries.find(e => e.role === 'main')!;
  const wallet = schemeToString(loadTransparentScheme());
  if (main.scheme !== wallet) {
    throw err('E_A0_ACCOUNTS_MAIN', `the registry's main is ${main.scheme}, the wallet's scheme is ${wallet}`);
  }
  for (const e of entries) {
    const derived = a0AccountAddress(seed, parseA0Scheme(e.scheme)!);
    if (derived !== e.address) {
      throw err('E_A0_ACCOUNTS_SEED', `${e.scheme} is stored as ${e.address}, the seed derives ${derived}`);
    }
  }
}

function openWith(seed: Uint8Array, bound?: A0StoreBinding): A0AccountEntry[] {
  const existing = readRecord(bound);
  if (existing !== null) {
    checkAgainstSeed(existing, seed);
    return existing;
  }
  const scheme = loadTransparentScheme();
  const created: A0AccountEntry[] = [{scheme: schemeToString(scheme), role: 'main', address: a0AccountAddress(seed, scheme)}];
  write(created, bound);
  return created;
}

// ------------------------------------------------------------------ the API

/** Whether a registry record exists (decodable or not), without creating one. Throws LOCKED / CHANGED. */
export function hasA0AccountRegistry(options: A0RegistryOptions = {}): boolean {
  return storage(options.bound).getString(KEY) !== undefined;
}

/**
 * The registry as stored, without the seed: null when there is no record yet (never an empty
 * list). Throws LOCKED / CHANGED / CORRUPT. For display (M1d) — the addresses are the stored ones.
 */
export function loadA0AccountRegistry(options: A0RegistryOptions = {}): readonly A0AccountEntry[] | null {
  return readRecord(options.bound);
}

/**
 * The registry, created with its main if absent (the wallet's scheme, its address derived from
 * `seed`), and every entry checked against `seed` (`E_A0_ACCOUNTS_SEED`, `E_A0_ACCOUNTS_MAIN`).
 */
export function openA0AccountRegistry(seed: Uint8Array, options: A0RegistryOptions = {}): readonly A0AccountEntry[] {
  return openWith(seed, options.bound);
}

/**
 * The seed's public-key set (§6.8 "no signer of the tx is any key of this seed"): the address of
 * EVERY registry entry — the main, every `fresh-pending` and `fresh-exit` — each re-derived from
 * `seed` (a stored address that differs refuses), and ALWAYS the seed's `cli` key and `slip10:0`,
 * whatever the main scheme is (controller ruling on Task 2: another wallet app may use either key
 * of this phrase). Registry order first, then `cli`, then `slip10:0`; no address twice.
 */
export function a0SeedPublicKeys(seed: Uint8Array, options: A0RegistryOptions = {}): string[] {
  const keys = openWith(seed, options.bound).map(e => e.address);
  keys.push(a0AccountAddress(seed, {kind: 'cli'}));
  keys.push(a0AccountAddress(seed, {kind: 'slip10', account: 0}));
  return [...new Set(keys)];
}

let reservations: Promise<unknown> = Promise.resolve();

/**
 * §6.1: reserve the fresh exit account — the lowest `slip10` index not in the registry under any
 * role whose address has no history — as `fresh-pending`, and return its entry. Refuses a `cli`
 * wallet (S9) and a full registry BEFORE any request. Reservations run one at a time.
 */
export function reserveA0FreshAccount(
  rpc: A0HistoryRpc,
  seed: Uint8Array,
  options: A0RegistryOptions = {},
): Promise<A0AccountEntry> {
  const bound = options.bound !== undefined ? options.bound : mmkvSecure();
  const run = reservations.then(
    () => reserveOnce(rpc, seed, bound),
    () => reserveOnce(rpc, seed, bound),
  );
  reservations = run.catch(() => undefined);
  return run;
}

async function reserveOnce(rpc: A0HistoryRpc, seed: Uint8Array, bound: A0StoreBinding): Promise<A0AccountEntry> {
  if (bound === null) {
    throw err('E_A0_STORE_LOCKED', 'the encrypted store is not open');
  }
  const skipped = new Set<number>();
  // Bounded: each pass either skips a candidate with history (at most the skip limit), finds it
  // taken by another writer after the await (each such index is then in the registry), or returns.
  for (let pass = 0; pass < A0_MAX_ACCOUNTS + A0_FRESH_HISTORY_SKIP_LIMIT; pass++) {
    const entries = openWith(seed, bound);
    if (entries.some(e => e.scheme === 'cli')) {
      throw err('E_A0_ACCOUNTS_CLI', 'a cli wallet has exactly one account (S9): no fresh account');
    }
    if (entries.length >= A0_MAX_ACCOUNTS) {
      throw err('E_A0_ACCOUNTS_FULL', `the registry holds ${entries.length} accounts`);
    }
    const taken = entries.map(indexOf).filter((n): n is number => n !== null);
    const index = lowestFreeA0Index([...taken, ...skipped]);
    if (index > A0_MAX_ACCOUNT_INDEX) {
      throw err('E_A0_ACCOUNTS_FULL', 'no slip10 index left');
    }
    const scheme = `slip10:${index}`;
    const address = a0AccountAddress(seed, {kind: 'slip10', account: index});
    const history: unknown = await rpc.getSignaturesForAddress(new PublicKey(address), {limit: 1}, 'confirmed');
    if (!Array.isArray(history)) {
      throw err('E_A0_ACCOUNTS_RPC', `the history check of ${scheme} did not answer a list`);
    }
    if (history.length > 0) {
      skipped.add(index);
      if (skipped.size >= A0_FRESH_HISTORY_SKIP_LIMIT) {
        throw err('E_A0_ACCOUNTS_NO_FRESH', `${skipped.size} candidate accounts have history`);
      }
      continue;
    }
    // after the await: re-read through the binding; another writer (a restore) may have taken it
    const now = openWith(seed, bound);
    if (now.some(e => e.scheme === scheme)) {
      continue;
    }
    if (now.length >= A0_MAX_ACCOUNTS) {
      throw err('E_A0_ACCOUNTS_FULL', `the registry holds ${now.length} accounts`);
    }
    const entry: A0AccountEntry = {scheme, role: 'fresh-pending', address};
    write([...now, entry], bound);
    return entry;
  }
  throw err('E_A0_ACCOUNTS_NO_FRESH', 'no candidate account could be reserved');
}

/**
 * §6.8: the unshield to a reserved account landed — `fresh-pending` → `fresh-exit`. Already
 * `fresh-exit` → no role change (`'already'`; a second settler of the same exit). Any other role →
 * `E_A0_ACCOUNTS_STATE`; no such entry → `E_A0_ACCOUNTS_UNKNOWN`. `linked` (M1c Task 7): the exit
 * landed with a key of this seed as a signer — the entry is also marked `linked` (also on an
 * existing `fresh-exit`); the mark is never removed.
 */
export function promoteA0FreshAccount(
  scheme: string,
  options: A0RegistryOptions & {linked?: boolean} = {},
): 'promoted' | 'already' {
  const entries = readExisting(options.bound);
  const i = entries.findIndex(e => e.scheme === scheme);
  if (i < 0) {
    throw err('E_A0_ACCOUNTS_UNKNOWN', `no entry ${scheme}`);
  }
  const e = entries[i]!;
  if (e.role !== 'fresh-exit' && e.role !== 'fresh-pending') {
    throw err('E_A0_ACCOUNTS_STATE', `${scheme} is ${e.role}, not fresh-pending`);
  }
  const mark = options.linked === true && e.linked !== true;
  if (e.role === 'fresh-exit' && !mark) {
    return 'already';
  }
  const next = [...entries];
  next[i] = {...e, role: 'fresh-exit', ...(options.linked === true || e.linked ? {linked: true as const} : {})};
  write(next, options.bound);
  if (e.role === 'fresh-pending') {
    firePromoted(); // post-M1d R3: a queued "linked" for this account can be applied now
    return 'promoted';
  }
  return 'already';
}

/**
 * §6.8: the unshield to a reserved account is known not to have landed — the `fresh-pending`
 * entry is removed (its index is free again). No such entry → `false` (nothing to release; a
 * second settler). `main` / `fresh-exit` → `E_A0_ACCOUNTS_STATE`: never removed here.
 */
export function releaseA0FreshAccount(scheme: string, options: A0RegistryOptions = {}): boolean {
  const entries = readRecord(options.bound);
  const i = entries === null ? -1 : entries.findIndex(e => e.scheme === scheme);
  if (entries === null || i < 0) {
    return false;
  }
  const e = entries[i]!;
  if (e.role !== 'fresh-pending') {
    throw err('E_A0_ACCOUNTS_STATE', `${scheme} is ${e.role}, not fresh-pending`);
  }
  write(entries.filter((_e, j) => j !== i), options.bound);
  return true;
}

/**
 * post-M1d spec §4 (P3): the tag after a confirmed Send between two accounts of this seed. Sets
 * `linked` on every `fresh-exit` entry whose address is in `addresses` and returns how many changed
 * (0 → nothing written). Never touches `main` or `fresh-pending` (the record's rules forbid the mark
 * there). Needs no seed: the stored addresses are compared. The mark is never removed.
 */
export function markA0AccountsLinked(addresses: readonly string[], options: A0RegistryOptions = {}): number {
  if (addresses.length === 0) {
    return 0;
  }
  const entries = readRecord(options.bound);
  if (entries === null) {
    return 0;
  }
  const wanted = new Set(addresses);
  let changed = 0;
  const next = entries.map(e => {
    if (e.role === 'fresh-exit' && e.linked !== true && wanted.has(e.address)) {
      changed += 1;
      return {...e, linked: true as const};
    }
    return e;
  });
  if (changed > 0) {
    write(next, options.bound);
  }
  return changed;
}

const promotedListeners = new Set<() => void>();

/**
 * post-M1d R3: told after a write that promoted a `fresh-pending` entry to `fresh-exit` (a landed
 * unshield) or added recovered exit accounts (a restore: new `fresh-exit` entries, or promotions). The link queue (`modules/accounts/linkQueue.ts`) registers here, so this
 * module imports nothing of it. A listener that throws never fails the promotion.
 */
export function onA0AccountPromoted(listener: () => void): () => void {
  promotedListeners.add(listener);
  return () => {
    promotedListeners.delete(listener);
  };
}

function firePromoted(): void {
  for (const listener of [...promotedListeners]) {
    try {
      listener();
    } catch {
      // the promotion is written; a listener's failure is its own
    }
  }
}

/**
 * §7 "Accounts" (M1c Task 5's writer): the `slip10` indices a restore matched to exit
 * destinations become `fresh-exit` — added if absent, promoted if `fresh-pending`, left as they
 * are if `fresh-exit` or `main`. ONE write; refuses as a whole (nothing written) a `cli` wallet
 * with any index, a bad index, or a result over 100 entries. Returns the schemes it added or promoted.
 */
export function addA0RecoveredExitAccounts(
  indices: readonly number[],
  seed: Uint8Array,
  options: A0RegistryOptions = {},
): string[] {
  for (const n of indices) {
    if (!(Number.isSafeInteger(n) && n >= 0 && n <= A0_MAX_ACCOUNT_INDEX)) {
      throw err('E_A0_ACCOUNTS_INVALID', `account index ${n} is not in 0 … 2^31 − 1`);
    }
  }
  const entries = openWith(seed, options.bound);
  if (indices.length === 0) {
    return [];
  }
  if (entries.some(e => e.scheme === 'cli')) {
    throw err('E_A0_ACCOUNTS_CLI', 'a cli wallet has exactly one account (S9): no exit account');
  }
  const next = [...entries];
  const changed: string[] = [];
  for (const n of [...new Set(indices)].sort((a, b) => a - b)) {
    const scheme = `slip10:${n}`;
    const i = next.findIndex(e => e.scheme === scheme);
    if (i < 0) {
      next.push({scheme, role: 'fresh-exit', address: a0AccountAddress(seed, {kind: 'slip10', account: n})});
      changed.push(scheme);
    } else if (next[i]!.role === 'fresh-pending') {
      next[i] = {...next[i]!, role: 'fresh-exit'};
      changed.push(scheme);
    }
  }
  if (next.length > A0_MAX_ACCOUNTS) {
    throw err('E_A0_ACCOUNTS_FULL', `${next.length} accounts after the restore (at most ${A0_MAX_ACCOUNTS})`);
  }
  if (changed.length > 0) {
    write(next, options.bound);
    firePromoted(); // post-M1d R3
  }
  return changed;
}

/** TEST-ONLY: forget the reservation chain (a test that leaves one hanging). */
export function resetA0ReservationsForTests(): void {
  reservations = Promise.resolve();
}
