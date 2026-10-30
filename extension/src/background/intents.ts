import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {digestOf} from './digest';
import type {PreparedEntry} from './prepare';
import type {PendingRecord} from './pendingStore';

/**
 * B1d §1.3 (C19): the shared send pipeline knows kinds, not presale. Each kind is registered once, by the module that
 * owns it — B1b's send by prepare.ts, unconditionally (both builds); `presale-buy` by the presale entry module (B1d-1b),
 * which the build without presale replaces by a stub that registers nothing. A prepared entry carries its kind; one
 * whose kind is not registered here is refused at signing (`prepared-invalid`), while a pending record of such a kind is
 * still read, counted, polled and shown generically (pendingStore.ts).
 */
export const SEND_KIND: 'send' = 'send';

/** A kind's name — also what `PendingRecord.extra.kind` must look like to be read (pendingStore.ts). */
export const KIND_NAME = /^[a-z][a-z0-9-]{0,31}$/;

/** What a kind's checks may use: the background's own extension handle and deps. */
export interface KindHost {
  ext: Ext;
  deps: WalletDeps;
}

/**
 * B1d §1.3 (`describe`): what #10 is shown for a challenge of a kind other than the shared three (`send`, `settings`,
 * `dapp` — reauthChallenges.ts) — the kind's own description, built by the kind from the same values as its digest.
 * The shared store keeps it only while its kind is registered and that kind's `isAbout` accepts it exactly.
 */
export type KindAbout = {readonly kind: string} & Readonly<Record<string, unknown>>;

export interface IntentKind<I> {
  readonly kind: string;
  /** Untrusted or stored input → the intent rebuilt key by key (its one JSON form), or null. */
  parseIntent(x: unknown): I | null;
  /** What a re-authentication is bound to, as plain JSON built key by key; intentDigest hashes it under the kind. */
  digestValue(account: string, intent: I): unknown;
  /**
   * C29 (review M4): the kind's last checks, on the entry as peeked — after its challenge was found proven, before the
   * single-use take. Refuses by throwing SendRefused; a refusal burns neither the entry nor the proof.
   */
  beforeSign(host: KindHost, entry: PreparedEntry, intent: I): Promise<void>;
  /** The pending record's `extra.data` — display only, plain JSON. Not asked of `send`: its record carries its intent. */
  pendingData?(entry: PreparedEntry, intent: I): unknown;
  /** The exact shape of this kind's challenge description (KindAbout): true only for what the kind itself issues. Not asked of `send`. */
  isAbout?(about: KindAbout): boolean;
  /**
   * A re-prepare of the same intent renews its live challenge (B1b's D39, as `rebaseChallenge` does for a send): the
   * stored description with every field a re-prepare recomputes taken from `fresh`, the identity fields from `stored`
   * only — or null when `fresh` describes another intent. Not asked of `send`.
   */
  rebaseAbout?(stored: KindAbout, fresh: KindAbout): KindAbout | null;
  /**
   * B1d §1.3: the poller's call, once, when a record of this kind first reaches `confirmed` — only the wallet's own
   * record (`extra` of this kind) of an account of the wallet stored now. Display and bookkeeping only: it decides
   * nothing about the transaction, and a hook that throws changes nothing the poller does. Not asked of `send`.
   */
  onConfirmed?(host: KindHost, record: PendingRecord): Promise<void>;
}

const kinds = new Map<string, IntentKind<unknown>>();

/**
 * Final review I2: a kind's name is `digestOf`'s domain for its challenge digest (`intentDigest` below). Every other
 * digest domain already in use by first-party code, by grep of `digestOf(`: `send` (SEND_KIND — reserved already by
 * the check below, since prepare.ts registers it unconditionally at load, before any other module can), `settings`
 * (walletApi.ts's about-settings challenge), `dapp` (dapp/signTx.ts's dappDigest), `prepared` (prepare.ts's
 * `preparedIntegrity`, the send kind's own integrity domain — `prepared/<kind>` for every other kind cannot collide,
 * since KIND_NAME forbids `/`). A kind registered under `settings`, `dapp` or `prepared` would share a digest
 * binding with that domain's existing challenge or integrity hash — refused here, before registration, not left as
 * a foot-gun for whoever registers the next kind (B1d-1b's `presale-buy`, in particular).
 */
const RESERVED_KINDS: ReadonlySet<string> = new Set(['settings', 'dapp', 'prepared']);

export function registerIntentKind<I>(k: IntentKind<I>): void {
  if (!KIND_NAME.test(k.kind)) throw new TypeError(`registerIntentKind: ${JSON.stringify(k.kind)} is not a kind name`);
  if (RESERVED_KINDS.has(k.kind)) throw new Error(`registerIntentKind: ${k.kind} is a reserved digest domain`);
  if (kinds.has(k.kind)) throw new Error(`registerIntentKind: ${k.kind} is registered already`);
  kinds.set(k.kind, k);
}

export function intentKind(kind: string): IntentKind<unknown> | undefined {
  return kinds.get(kind);
}

export function registeredKinds(): string[] {
  return [...kinds.keys()];
}

/**
 * The re-authentication binding of an intent of any kind: the kind is the digest's domain, so two kinds never share a
 * binding, and a send's is B1b's `digestOf('send', …)` — the same bytes as before kinds existed.
 */
export function intentDigest<I>(k: IntentKind<I>, account: string, intent: I): string {
  return digestOf(k.kind, k.digestValue(account, intent));
}
