/**
 * TEST-ONLY: a "live" A0 relayer over the live devnet fake (never imported by app code; it is
 * NEVER the real relayer — no test contacts api.noc-tura.io).
 *
 * It is plugged in as the relayer transport's `fetchImpl` (`relayerTransport.ts` is unchanged:
 * the real URL check, the real JSON parsing, the real deadline). `GET …/relayer/quote` answers the
 * contract's quote (`quote`, editable; `gasGrantLamports` only when the relayer grants).
 * `POST …/relayer/submit` checks the payload the way the coordinator does what the wallet relies
 * on (kind, the destination = ATA(destinationOwner) from the OFFLINE vectors, the fee = the quote's
 * minFee, the named fields = the public inputs read big-endian) and then does what the test
 * scripted (`script`, one entry per submit; default `confirmed`):
 *   - landing = the relayer's tx in the RECORDED shape (`ownHistory.appendWithdraw`): a clone of
 *     the landed `47k56NfB…` (create-ATA + the grant, the owner at 0 lamports) when the quote
 *     grants and the owner is not `funded`, else of `3oHktG2X…` (create-ATA no-op, no grant) —
 *     carrying OUR nullifier, change commitment, amount, fee, root and proof bytes, to OUR owner
 *     and ATA, at the chain's clock; the tree account advanced as the program does it;
 *   - `confirmed` → lands, answers 200 `{outcome: confirmed, txSignature}`; `hideForSyncs: k` keeps
 *     it out of the tree's signature list for the next k tree walks (RPC lag, I-2); `mutate` edits
 *     the landed recorded tx (a refusal row);
 *   - `unconfirmed` → lands or not (`lands`), answers 502 with the signature;
 *   - `already_spent` → 409, no signature; `relay_failed` → 502 without a signature (`lands`: the
 *     tx landed all the same — R2-N1's transport failure after the node took it; `before` runs
 *     next, e.g. to push the root out of the ring); `text` → the given status and a body that is
 *     not JSON (a gateway's HTML, the rate limiter's plain text; `lands` lands first); `raw` → the given
 *     status and body (a refusal, or an answer the contract does not allow; `lands` lands first and
 *     `"<landed>"` in the body is replaced by the signature); `transport` → the request throws;
 *     `hang` → never answers (the transport's deadline decides);
 *   - `kill` → lands or not, and the answer never comes (the app died waiting); `abandon()` ends it.
 * A nullifier that already landed answers `already_spent` whatever the script says (the chain's
 * `init` of the nullifier record would refuse the tx).
 */
import type {PinnedFetchResponse} from '../../../sslPinning/pinnedFetch';
import type {RelayerRequestOptions} from '../relayerTransport';
import {offlineAta} from './offlineA0';
import {appendWithdraw} from './ownHistory';
import {blobsOf, freshSignature, toHex} from './chainEdits';
import type {WithdrawTemplate} from './ownHistory';
import type {LiveDevnet} from './liveDevnet';
import type {RecordedTx} from './recordedRpc';

export const LIVE_RELAYER_BASE = 'https://live-relayer.invalid/api/v1';
export const RELAYER_FEE_PAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
export const LIVE_GRANT = 3_000_000n;
export const LIVE_FEE = 10_000n;

export type RelayerScript =
  | {
      answer: 'confirmed';
      hideForSyncs?: number;
      template?: WithdrawTemplate;
      mutate?: (tx: RecordedTx) => void;
      /** land another change commitment than the payload's (a relayer that swapped it; the tree stays consistent) */
      changeCommitment?: string;
    }
  | {answer: 'unconfirmed'; lands: boolean; template?: WithdrawTemplate}
  | {answer: 'already_spent'}
  | {answer: 'relay_failed'; before?: () => void; lands?: boolean}
  | {answer: 'raw'; status: number; body: unknown; lands?: boolean}
  /** a body that is not JSON (a gateway's HTML page, the rate limiter's plain text) */
  | {answer: 'text'; status: number; text: string; lands?: boolean}
  | {answer: 'transport'}
  | {answer: 'hang'}
  | {answer: 'kill'; lands: boolean};

export interface LiveRelayer {
  /** pass as `options.transport` */
  transport: RelayerRequestOptions;
  /** the quote body served (edit it between calls) */
  quote: Record<string, unknown>;
  quoteRequests: number;
  /** the payloads received, parsed */
  submits: Record<string, unknown>[];
  /** the signatures landed, in order */
  landed: string[];
  /** consumed one per submit */
  script: RelayerScript[];
  /** owners that already hold SOL (no grant for them) */
  funded: Set<string>;
  /** end every answer the `kill` entries left hanging (they reject as a transport error) */
  abandon(): void;
}

const status = {confirmed: 200, unconfirmed: 502, already_spent: 409, relay_failed: 502} as const;

function respond(code: number, body: unknown): PinnedFetchResponse {
  const text = JSON.stringify(body);
  return {status: code, headers: {}, json: async () => JSON.parse(text) as unknown, text: async () => text};
}

function respondText(code: number, text: string): PinnedFetchResponse {
  return {
    status: code,
    headers: {},
    json: async () => JSON.parse(text) as unknown,
    text: async () => text,
  };
}

const be = (hex: string): string => BigInt(`0x${hex}`).toString();

export function liveRelayer(net: LiveDevnet, o: {grant?: boolean} = {}): LiveRelayer {
  const hanging: ((e: Error) => void)[] = [];
  const hidden: {entry: (typeof net.chain.signatures)[number]; walks: number}[] = [];
  const previous = net.onRequest;
  net.onRequest = (method, params) => {
    if (method === 'getSignaturesForAddress' && params[0] === net.chain.tree) {
      for (const h of [...hidden]) {
        h.walks -= 1;
        if (h.walks < 0) {
          net.chain.signatures.unshift(h.entry);
          hidden.splice(hidden.indexOf(h), 1);
        }
      }
    }
    previous?.(method, params);
  };

  const r: LiveRelayer = {
    transport: {base: LIVE_RELAYER_BASE, fetchImpl: undefined},
    quote: {
      programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
      pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
      mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
      feePayer: RELAYER_FEE_PAYER,
      maxFee: '100000',
      minFee: {transfer: LIVE_FEE.toString(), withdraw_change: LIVE_FEE.toString()},
      ...(o.grant === false ? {} : {gasGrantLamports: LIVE_GRANT.toString()}),
      validForSeconds: 60,
    },
    quoteRequests: 0,
    submits: [],
    landed: [],
    script: [],
    funded: new Set(),
    abandon() {
      for (const reject of hanging.splice(0)) {
        reject(new Error('live relayer: the app died waiting for this answer'));
      }
    },
  };

  const land = (p: Record<string, string>, template?: WithdrawTemplate, changeCommitment?: string): string => {
    const grants = r.quote.gasGrantLamports !== undefined && !r.funded.has(p.destinationOwner!);
    const sig = appendWithdraw(net.chain, {
      nullifier: p.nullifier!,
      changeCommitment: changeCommitment ?? p.changeCommitment!,
      amount: BigInt(p.withdrawAmount!),
      fee: BigInt(p.fee!),
      to: {owner: p.destinationOwner!, ata: p.destination!},
      template: template ?? (grants ? '47k56NfB' : '3oHktG2X'),
      ...(net.clock.blockTime !== null ? {blockTime: net.clock.blockTime} : {}),
      merkleRoot: p.merkleRoot!,
      proofBytes: p.proofBytes!,
    }).signature;
    r.landed.push(sig);
    return sig;
  };

  const submit = async (body: string): Promise<PinnedFetchResponse> => {
    const p = JSON.parse(body) as Record<string, string> & {publicInputs: string[]; cuLimit: number};
    r.submits.push(p);
    const pi = p.publicInputs;
    const minFee = (r.quote.minFee as {withdraw_change: string}).withdraw_change;
    if (
      p.kind !== 'withdraw_change' ||
      p.destination !== offlineAta(p.destinationOwner!) ||
      p.fee !== minFee ||
      p.cuLimit !== 200_000 ||
      !Array.isArray(pi) ||
      pi.length !== 7 ||
      pi[0] !== be(p.merkleRoot!) ||
      pi[1] !== be(p.nullifier!) ||
      pi[2] !== p.withdrawAmount ||
      pi[5] !== be(p.changeCommitment!) ||
      pi[6] !== p.fee
    ) {
      return respond(400, {outcome: 'invalid_request', error: 'live relayer: the payload does not hold together'});
    }
    const withdrawBlob = `c0f1c9d946965af7${p.nullifier!}`;
    const spentBefore = Object.values(net.chain.transactions).some(t => blobsOf(t).some(b => toHex(b.bytes) === withdrawBlob));
    if (spentBefore) {
      return respond(409, {outcome: 'already_spent', alreadySpentIndexes: [0]});
    }
    const s = r.script.shift() ?? {answer: 'confirmed'};
    switch (s.answer) {
      case 'confirmed': {
        const sig = land(p, s.template, s.changeCommitment);
        const tx = net.chain.transactions[sig]!;
        s.mutate?.(tx);
        if (s.hideForSyncs !== undefined && s.hideForSyncs > 0) {
          const i = net.chain.signatures.findIndex(e => e.signature === sig);
          hidden.push({entry: net.chain.signatures.splice(i, 1)[0]!, walks: s.hideForSyncs});
        }
        return respond(status.confirmed, {success: true, outcome: 'confirmed', txSignature: sig});
      }
      case 'unconfirmed': {
        // a forwarded tx that did not land still has a signature: a fresh one nobody lists
        const sig = s.lands ? land(p, s.template) : freshSignature(200 + r.submits.length);
        return respond(status.unconfirmed, {success: false, outcome: 'unconfirmed', txSignature: sig});
      }
      case 'already_spent':
        return respond(status.already_spent, {outcome: 'already_spent'});
      case 'relay_failed':
        // `lands`: the node took the tx and the relayer's HTTP exchange with it failed (R2-N1)
        if (s.lands) {
          land(p);
        }
        s.before?.();
        return respond(status.relay_failed, {outcome: 'relay_failed', error: 'live relayer: simulation failed'});
      case 'raw': {
        const sig = s.lands ? land(p) : null;
        const text = JSON.stringify(s.body).replace('"<landed>"', JSON.stringify(sig));
        return respond(s.status, JSON.parse(text) as unknown);
      }
      case 'text':
        if (s.lands) {
          land(p);
        }
        return respondText(s.status, s.text);
      case 'transport':
        throw new Error('live relayer: connection reset');
      case 'hang':
        return new Promise<PinnedFetchResponse>((_ok, reject) => {
          hanging.push(reject);
        });
      case 'kill':
        if (s.lands) {
          land(p);
        }
        net.killed = true;
        return new Promise<PinnedFetchResponse>((_ok, reject) => {
          hanging.push(reject);
        });
    }
  };

  r.transport.fetchImpl = async (url, init) => {
    if (url === `${LIVE_RELAYER_BASE}/relayer/quote` && init?.method === 'GET') {
      r.quoteRequests += 1;
      return respond(200, r.quote);
    }
    if (url === `${LIVE_RELAYER_BASE}/relayer/submit` && init?.method === 'POST') {
      return submit(String(init.body));
    }
    throw new Error(`live relayer: ${init?.method ?? '?'} ${url} is not the contract's`);
  };
  return r;
}
