import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {digestOf} from './digest';
import type {PreparedEntry} from './prepare';

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
}

const kinds = new Map<string, IntentKind<unknown>>();

export function registerIntentKind<I>(k: IntentKind<I>): void {
  if (!KIND_NAME.test(k.kind)) throw new TypeError(`registerIntentKind: ${JSON.stringify(k.kind)} is not a kind name`);
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
