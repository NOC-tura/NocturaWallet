import {base58, base64} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';
import {PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {BROADCAST_ENDPOINT, BroadcastRejected, BroadcastSubstituted, BroadcastUnavailable, broadcastSigned, firstSignature} from '../broadcast';
import {RpcForbidden, createForbiddenLatch, type FetchInit} from '../rpc';

const OTHER = new PublicKey('9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4');
const BLOCKHASH = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

// Signed with @noble directly and added with addSignature — as the extension signs. (web's secret
// scan reads this file in source mode and refuses Keypair constructors, so none is used here.)
const SEED = new Uint8Array(32).fill(1);

/** A real v0 transfer, signed or not. */
function wire(signed: boolean): {bytes: Uint8Array; signature: string} {
  const payer = new PublicKey(ed25519.getPublicKey(SEED));
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: BLOCKHASH,
    instructions: [SystemProgram.transfer({fromPubkey: payer, toPubkey: OTHER, lamports: 1n})],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  if (signed) tx.addSignature(payer, ed25519.sign(message.serialize(), SEED));
  const bytes = tx.serialize();
  return {bytes, signature: base58.encode(bytes.subarray(1, 65))};
}

function fakeFetch(answer: {status: number; body?: unknown} | 'throw') {
  const calls: {url: string; init: FetchInit}[] = [];
  const fetch = async (url: string, init: FetchInit) => {
    calls.push({url, init});
    if (answer === 'throw') throw new TypeError('Failed to fetch');
    return {status: answer.status, json: async () => answer.body};
  };
  return {fetch, calls};
}

describe('firstSignature', () => {
  it('is the base58 of the first 64-byte slot after the count', () => {
    const w = wire(true);
    expect(firstSignature(w.bytes)).toBe(w.signature);
  });

  it('refuses an unsigned transaction, an empty count and truncated bytes', () => {
    expect(() => firstSignature(wire(false).bytes)).toThrow(BroadcastRejected);
    expect(() => firstSignature(new Uint8Array([0]))).toThrow(BroadcastRejected);
    expect(() => firstSignature(new Uint8Array([1, 7, 7]))).toThrow(BroadcastRejected);
  });
});

describe('broadcastSigned', () => {
  it('POSTs {transaction: base64} to the broadcast route and returns the signature it verified (positive control)', async () => {
    const w = wire(true);
    const {fetch, calls} = fakeFetch({status: 200, body: {signature: w.signature}});
    expect(await broadcastSigned({fetch, latch: createForbiddenLatch()}, w.bytes)).toBe(w.signature);
    expect(BROADCAST_ENDPOINT).toBe('https://api.noc-tura.io/api/v1/tx/broadcast');
    expect(calls[0]?.url).toBe(BROADCAST_ENDPOINT);
    expect(calls[0]?.init).toMatchObject({method: 'POST', credentials: 'omit', headers: {'content-type': 'application/json'}});
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({transaction: base64.encode(w.bytes)});
  });

  it('refuses a signature that is not the one it sent — a coordinator cannot substitute another transaction', async () => {
    const w = wire(true);
    const {fetch} = fakeFetch({status: 200, body: {signature: base58.encode(new Uint8Array(64).fill(9))}});
    await expect(broadcastSigned({fetch, latch: createForbiddenLatch()}, w.bytes)).rejects.toBeInstanceOf(BroadcastSubstituted);
  });

  it('never sends an unsigned transaction', async () => {
    const {fetch, calls} = fakeFetch({status: 200, body: {}});
    await expect(broadcastSigned({fetch, latch: createForbiddenLatch()}, wire(false).bytes)).rejects.toMatchObject({reason: 'unsigned'});
    expect(calls).toHaveLength(0);
  });

  it('maps a 400 to BroadcastRejected with the route\'s reason; an unknown reason is "rejected"', async () => {
    const w = wire(true);
    const malformed = fakeFetch({status: 400, body: {error: 'malformed', message: 'bad base64'}});
    await expect(broadcastSigned({fetch: malformed.fetch, latch: createForbiddenLatch()}, w.bytes)).rejects.toMatchObject({reason: 'malformed', detail: 'bad base64'});
    const odd = fakeFetch({status: 400, body: {error: 'weird'}});
    await expect(broadcastSigned({fetch: odd.fetch, latch: createForbiddenLatch()}, w.bytes)).rejects.toMatchObject({reason: 'rejected'});
  });

  it('a 403 is terminal and trips the shared latch — the next broadcast sends nothing', async () => {
    const w = wire(true);
    const {fetch, calls} = fakeFetch({status: 403});
    const latch = createForbiddenLatch();
    await expect(broadcastSigned({fetch, latch}, w.bytes)).rejects.toBeInstanceOf(RpcForbidden);
    await expect(broadcastSigned({fetch, latch}, w.bytes)).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
  });

  it('a 5xx, a network failure or an unreadable 200 is "not acknowledged"', async () => {
    const w = wire(true);
    for (const answer of [{status: 502}, 'throw' as const, {status: 200, body: {nope: 1}}]) {
      const {fetch} = fakeFetch(answer);
      await expect(broadcastSigned({fetch, latch: createForbiddenLatch()}, w.bytes)).rejects.toBeInstanceOf(BroadcastUnavailable);
    }
  });
});
