import {base58, base64} from '@scure/base';
import {API_BASE, RequestUnreachable, RpcForbidden, type FetchLike, type FetchResponse, type ForbiddenLatch} from './rpc';

/**
 * The coordinator's broadcast-only route (spec §4 "Broadcast — through the coordinator"). The
 * public RPC hosts answer 403 to any request carrying an extension Origin, so a signed transaction
 * reaches the chain through this route or not at all. The route can drop or delay a transaction;
 * it cannot author or alter one — and cannot pass off another transaction's signature as ours,
 * because the answer is checked against the bytes sent. Contract: the plan's Global Constraints
 * and docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md.
 */
export const BROADCAST_ENDPOINT = `${API_BASE}/tx/broadcast`;

export type BroadcastRefusal = 'malformed' | 'unsigned' | 'rejected';

/** Refused before forwarding (by the route's 400 with a contract reason, or locally): nothing reached the network. */
export class BroadcastRejected extends Error {
  readonly reason: BroadcastRefusal;
  readonly detail: string;
  constructor(reason: BroadcastRefusal, detail: string) {
    super(`broadcast refused (${reason}): ${detail}`);
    this.name = 'BroadcastRejected';
    this.reason = reason;
    this.detail = detail;
  }
}

/** The route answered with a signature that is not our transaction's. */
export class BroadcastSubstituted extends Error {
  readonly expected: string;
  readonly returned: string;
  constructor(expected: string, returned: string) {
    super(`the broadcast route returned ${returned}, not ${expected}`);
    this.name = 'BroadcastSubstituted';
    this.expected = expected;
    this.returned = returned;
  }
}

/** Not acknowledged: the bytes may or may not be on their way. The caller keeps watching. */
export class BroadcastUnavailable extends Error {
  readonly status: number | null;
  constructor(status: number | null) {
    super(status === null ? 'the broadcast route could not be reached' : `the broadcast route answered HTTP ${status}`);
    this.name = 'BroadcastUnavailable';
    this.status = status;
  }
}

const REASONS: readonly string[] = ['malformed', 'unsigned', 'rejected'];

/** Compact-u16 ("shortvec"): the signature count that opens every serialized transaction. */
function readShortVec(bytes: Uint8Array): {value: number; size: number} {
  let value = 0;
  for (let size = 0; size < 3; size++) {
    const b = bytes[size];
    if (b === undefined) break;
    value |= (b & 0x7f) << (7 * size);
    if ((b & 0x80) === 0) return {value, size: size + 1};
  }
  throw new BroadcastRejected('malformed', 'no signature count');
}

/** A transaction's id: base58 of its first signature. Refuses what could not be one. */
export function firstSignature(wire: Uint8Array): string {
  const {value: count, size} = readShortVec(wire);
  if (count < 1) throw new BroadcastRejected('unsigned', 'the transaction has no signature slot');
  const signature = wire.subarray(size, size + 64);
  if (signature.length !== 64) throw new BroadcastRejected('malformed', 'the first signature is truncated');
  if (signature.every(b => b === 0)) throw new BroadcastRejected('unsigned', 'the first signature is empty');
  return base58.encode(signature);
}

export async function broadcastSigned(opts: {fetch: FetchLike; latch: ForbiddenLatch; endpoint?: string}, wire: Uint8Array): Promise<string> {
  const expected = firstSignature(wire);
  const body = JSON.stringify({transaction: base64.encode(wire)});
  let res: FetchResponse;
  try {
    // Through the shared latch: queued behind any read in flight; a 403 is terminal for all.
    res = await opts.latch.request('broadcast', () =>
      opts.fetch(opts.endpoint ?? BROADCAST_ENDPOINT, {method: 'POST', headers: {'content-type': 'application/json'}, body, credentials: 'omit'}),
    );
  } catch (e) {
    // A 403 is terminal; no answer at all is the caller's to name ("unreachable"). Both mean "not
    // acknowledged" to the pending record, which keeps watching either way.
    if (e instanceof RpcForbidden || e instanceof RequestUnreachable) throw e;
    throw new BroadcastUnavailable(null);
  }
  if (res.status === 400) {
    // Only the route's own refusal — a body naming one of the contract's reasons — proves the
    // transaction was not forwarded. Any other 400 (a proxy's, a CDN's, an unreadable body) proves
    // nothing: "not acknowledged", and the send stays pending.
    let answer: unknown = null;
    try {
      answer = await res.json();
    } catch {
      answer = null;
    }
    const {error, message} = (typeof answer === 'object' && answer !== null ? answer : {}) as {error?: unknown; message?: unknown};
    if (typeof error !== 'string' || !REASONS.includes(error)) throw new BroadcastUnavailable(400);
    throw new BroadcastRejected(error as BroadcastRefusal, typeof message === 'string' ? message : 'refused');
  }
  if (res.status !== 200) throw new BroadcastUnavailable(res.status);
  let answer: unknown;
  try {
    answer = await res.json();
  } catch {
    throw new BroadcastUnavailable(200);
  }
  const returned = typeof answer === 'object' && answer !== null ? (answer as {signature?: unknown}).signature : undefined;
  if (typeof returned !== 'string') throw new BroadcastUnavailable(200);
  if (returned !== expected) throw new BroadcastSubstituted(expected, returned);
  return expected;
}
