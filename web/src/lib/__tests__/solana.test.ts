import {readFileSync} from 'node:fs';
import {join} from 'node:path';

/**
 * accountTransactions over the REAL web3.js Connection, with only the HTTP hop replaced.
 *
 * The transaction is a real devnet version-1 transaction, recorded verbatim for the wallet's tree
 * sync and copied here (web/src/lib/__tests__/fixtures/devnet-v1-tx-4T9Juo9P.json, identical to
 * src/modules/shielded/a0/__tests__/fixtures/ — kept inside web/ so web CI's path triggers cover it; the node's answer
 * with maxSupportedTransactionVersion 0, error -32015, and with 1, the transaction). The fake
 * answers getTransaction by that one field, as the node does.
 * CONSTRUCTED: the getSignaturesForAddress answer (one entry — this signature, for an account the
 * transaction really names, its static key 1). The recorded requests asked at `finalized`; the
 * Connection here asks at `confirmed`, which does not change either answer.
 */
interface Recorded {
  response: {
    result?: {version: unknown; meta: {logMessages: string[]}; transaction: {message: {accountKeys: string[]}}};
    error?: {code: number};
  };
}
const V1 = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/devnet-v1-tx-4T9Juo9P.json'), 'utf8'),
) as {signature: string; max0: Recorded; max1: Recorded};
const RESULT = V1.max1.response.result!;

const requests: {method: string; params: unknown[]}[] = [];
let listed: {signature: string; blockTime: number | null}[] = [];

const fakeFetch = async (_url: unknown, init?: {body?: unknown}) => {
  const body = JSON.parse(String(init?.body)) as {id: unknown; method: string; params: unknown[]};
  requests.push({method: body.method, params: body.params});
  let payload: unknown;
  if (body.method === 'getSignaturesForAddress') {
    const result = listed.map(s => ({...s, slot: 526720765, err: null, memo: null, confirmationStatus: 'finalized'}));
    payload = {jsonrpc: '2.0', id: body.id, result};
  } else if (body.method === 'getTransaction' && body.params[0] === V1.signature) {
    const max = (body.params[1] as {maxSupportedTransactionVersion?: number}).maxSupportedTransactionVersion;
    payload = {...(max === 1 ? V1.max1.response : V1.max0.response), id: body.id};
  } else if (body.method === 'getTransaction') {
    payload = {jsonrpc: '2.0', id: body.id, result: null};
  } else {
    payload = {jsonrpc: '2.0', id: body.id, error: {code: -32602, message: `not recorded: ${body.method}`}};
  }
  const text = JSON.stringify(payload);
  return {ok: true, status: 200, statusText: 'OK', text: async () => text, json: async () => payload};
};

describe('accountTransactions', () => {
  beforeEach(() => {
    requests.length = 0;
    listed = [{signature: V1.signature, blockTime: 1795747138}];
    // before the module (and web3.js) is first imported: the library may read `fetch` at load
    vi.stubGlobal('fetch', fakeFetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the recording: a v1 transaction, refused by the node at max 0 (controls on the fixture)', () => {
    expect(V1.max0.response.error?.code).toBe(-32015);
    expect(RESULT.version).toBe(1);
  });

  it('a version-1 transaction in the history does not abort the walk: it is read, with its logs', async () => {
    const {PublicKey} = await import('@solana/web3.js');
    const {accountTransactions} = await import('../solana');
    const named = RESULT.transaction.message.accountKeys[1]!;
    const out = await accountTransactions(new PublicKey(named));
    expect(out).toEqual([{signature: V1.signature, blockTime: 1795747138, logs: RESULT.meta.logMessages}]);
    expect(out[0]!.logs).toHaveLength(3);
    const asked = requests.filter(r => r.method === 'getTransaction').map(r => r.params);
    expect(asked).toEqual([[V1.signature, {commitment: 'confirmed', maxSupportedTransactionVersion: 1}]]);
  });

  it('still aborts the whole walk on a listed transaction the node does not return', async () => {
    const {PublicKey} = await import('@solana/web3.js');
    const {accountTransactions} = await import('../solana');
    const unknown = '5'.repeat(88);
    listed = [{signature: V1.signature, blockTime: 1795747138}, {signature: unknown, blockTime: null}];
    await expect(accountTransactions(new PublicKey('11111111111111111111111111111111'))).rejects.toThrow(
      `transaction ${unknown} could not be read`,
    );
  });
});
