import {
  ALLOWED_RPC_METHODS, API_BASE, FORBIDDEN_COOLDOWN_MS, RPC_ENDPOINT, RpcCoolingDown, RpcForbidden, RpcHttpError, RpcMalformed, RpcMethodRefused, RpcResponseError,
  createForbiddenLatch, createRpc, solanaReader, type FetchInit, type RpcMethod,
} from '../rpc';

interface Call {
  url: string;
  init: FetchInit;
  body: {jsonrpc: string; id: number; method: string; params: unknown[]};
}

/** A fake coordinator: records every request and answers from `reply`. Nothing here opens a socket. */
function fakeFetch(reply: (method: string, params: unknown[]) => {status: number; body?: unknown}) {
  const calls: Call[] = [];
  const fetch = async (url: string, init: FetchInit) => {
    const body = JSON.parse(init.body ?? '{}') as Call['body'];
    calls.push({url, init, body});
    const r = reply(body.method, body.params);
    return {status: r.status, json: async () => r.body};
  };
  return {fetch, calls};
}
const ok = (result: unknown) => ({status: 200, body: {jsonrpc: '2.0', id: 1, result}});

// The compile-time half of the allowlist: if a refused method were ever added to the list, this
// type would become `true` and the assignment would stop compiling (tsc runs in `npm run build`).
type SendTransactionAllowed = 'sendTransaction' extends RpcMethod ? true : false;
const sendTransactionAllowed: SendTransactionAllowed = false;

const SPEC_ALLOWED = [
  'getBalance', 'getAccountInfo', 'getMultipleAccounts', 'getLatestBlockhash', 'simulateTransaction', 'getSignaturesForAddress',
  'getTransaction', 'getSignatureStatuses', 'getRecentPrioritizationFees', 'getTokenAccountsByOwner', 'getBlockHeight',
];

describe('the RPC allowlist', () => {
  it('is exactly the eleven methods spec §4 records as allowed', () => {
    expect([...ALLOWED_RPC_METHODS].sort()).toEqual([...SPEC_ALLOWED].sort());
    expect(sendTransactionAllowed).toBe(false);
  });

  it('points at the coordinator proxy', () => {
    expect(API_BASE).toBe('https://api.noc-tura.io/api/v1');
    expect(RPC_ENDPOINT).toBe('https://api.noc-tura.io/api/v1/rpc');
  });
});

describe('createRpc', () => {
  it('POSTs one JSON-RPC 2.0 request without credentials and returns its result (positive control)', async () => {
    const {fetch, calls} = fakeFetch(() => ok(42));
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    expect(await rpc.call('getBlockHeight', [])).toBe(42);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(RPC_ENDPOINT);
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.credentials).toBe('omit');
    expect(calls[0]?.body).toMatchObject({jsonrpc: '2.0', method: 'getBlockHeight', params: []});
  });

  it('refuses a method outside the list at run time, before any request exists', async () => {
    const {fetch, calls} = fakeFetch(() => ok(null));
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    const loose = rpc.call as (method: string, params: readonly unknown[]) => Promise<unknown>;
    for (const m of ['sendTransaction', 'getProgramAccounts', 'getMinimumBalanceForRentExemption', 'getbalance']) {
      await expect(loose(m, [])).rejects.toBeInstanceOf(RpcMethodRefused);
    }
    expect(calls).toHaveLength(0);
  });

  it('a 403 is terminal: typed, never retried, and every later call is refused without a request until the cooldown ends', async () => {
    let t = 0;
    const {fetch, calls} = fakeFetch(() => ({status: 403}));
    const rpc = createRpc({fetch, latch: createForbiddenLatch({now: () => t})});
    await expect(rpc.call('getBalance', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
    t = FORBIDDEN_COOLDOWN_MS - 1;
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
    t = FORBIDDEN_COOLDOWN_MS;
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(2);
  });

  it('a 403 response and a refusal during the cool-down are told apart: only the latter is RpcCoolingDown (nothing sent)', async () => {
    const {fetch, calls} = fakeFetch(() => ({status: 403}));
    const rpc = createRpc({fetch, latch: createForbiddenLatch({now: () => 0})});
    const answered = await rpc.call('getBalance', []).catch((e: unknown) => e);
    expect(answered).toBeInstanceOf(RpcForbidden);
    expect(answered).not.toBeInstanceOf(RpcCoolingDown);
    expect(calls).toHaveLength(1);
    const refused = await rpc.call('getBalance', []).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(RpcCoolingDown);
    // Still an RpcForbidden: every existing `instanceof RpcForbidden` caller keeps treating it as terminal.
    expect(refused).toBeInstanceOf(RpcForbidden);
    expect(calls).toHaveLength(1);
  });

  it('three concurrent calls into a 403 send exactly ONE request — the queue is what stops a burst', async () => {
    const {fetch, calls} = fakeFetch(() => ({status: 403}));
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    const results = await Promise.allSettled([rpc.call('getBalance', []), rpc.call('getBlockHeight', []), rpc.call('getLatestBlockhash', [])]);
    expect(results.every(r => r.status === 'rejected' && r.reason instanceof RpcForbidden)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('requests go out one at a time, in call order', async () => {
    let inFlight = 0;
    let most = 0;
    const order: string[] = [];
    const fetch = async (_url: string, init: FetchInit) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      order.push((JSON.parse(init.body ?? '{}') as {method: string}).method);
      await new Promise(r => setTimeout(r, 5));
      inFlight -= 1;
      return {status: 200, json: async () => ({jsonrpc: '2.0', id: 1, result: 1})};
    };
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    await Promise.all([rpc.call('getBalance', []), rpc.call('getBlockHeight', []), rpc.call('getLatestBlockhash', [])]);
    expect(most).toBe(1);
    expect(order).toEqual(['getBalance', 'getBlockHeight', 'getLatestBlockhash']);
  });

  it('the cool-down survives a new latch through its store', async () => {
    const saved: number[] = [];
    const store = {load: async () => saved.at(-1) ?? 0, save: async (u: number) => void saved.push(u)};
    const first = fakeFetch(() => ({status: 403}));
    await expect(createRpc({fetch: first.fetch, latch: createForbiddenLatch({now: () => 5, store})}).call('getBalance', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(saved).toEqual([5 + FORBIDDEN_COOLDOWN_MS]);
    const second = fakeFetch(() => ok(1));
    await expect(createRpc({fetch: second.fetch, latch: createForbiddenLatch({now: () => 6, store})}).call('getBalance', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(second.calls).toHaveLength(0);
  });

  it('any other HTTP status is an error, trips nothing, and is not retried', async () => {
    let status = 500;
    const {fetch, calls} = fakeFetch(() => (status === 200 ? ok(7) : {status}));
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    await expect(rpc.call('getBlockHeight', [])).rejects.toMatchObject({name: 'RpcHttpError', status: 500});
    expect(calls).toHaveLength(1);
    status = 200;
    expect(await rpc.call('getBlockHeight', [])).toBe(7);
  });

  it('a JSON-RPC error becomes RpcResponseError with its code; a body without result is malformed', async () => {
    const {fetch} = fakeFetch(m =>
      m === 'getBalance' ? {status: 200, body: {jsonrpc: '2.0', id: 1, error: {code: -32602, message: 'bad params'}}} : {status: 200, body: {jsonrpc: '2.0', id: 1}},
    );
    const rpc = createRpc({fetch, latch: createForbiddenLatch()});
    await expect(rpc.call('getBalance', [])).rejects.toMatchObject({name: 'RpcResponseError', code: -32602});
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcMalformed);
    expect(new RpcHttpError('x', 502).status).toBe(502);
    expect(new RpcResponseError(-1, 'm').code).toBe(-1);
  });
});

describe('solanaReader', () => {
  const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
  const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
  const reader = (reply: (method: string, params: unknown[]) => {status: number; body?: unknown}) => {
    const f = fakeFetch(reply);
    return {r: solanaReader(createRpc({fetch: f.fetch, latch: createForbiddenLatch()})), calls: f.calls};
  };

  it('getBalance asks at confirmed commitment and returns BigInt lamports', async () => {
    const {r, calls} = reader(() => ok({context: {slot: 1}, value: 1_500_000_000}));
    expect(await r.getBalance(OWNER)).toBe(1_500_000_000n);
    expect(calls[0]?.body.params).toEqual([OWNER, {commitment: 'confirmed'}]);
  });

  it('getLatestBlockhash and getBlockHeight return typed values', async () => {
    const {r} = reader(m => (m === 'getBlockHeight' ? ok(900) : ok({context: {slot: 1}, value: {blockhash: OWNER, lastValidBlockHeight: 1000}})));
    expect(await r.getLatestBlockhash()).toEqual({blockhash: OWNER, lastValidBlockHeight: 1000});
    expect(await r.getBlockHeight()).toBe(900);
  });

  it('getSignatureStatuses keeps nulls, passes searchTransactionHistory, and refuses a wrong-length answer', async () => {
    const {r, calls} = reader(() => ok({context: {slot: 1}, value: [null, {slot: 5, err: null, confirmationStatus: 'confirmed'}]}));
    expect(await r.getSignatureStatuses(['a', 'b'], true)).toEqual([null, {err: null, confirmationStatus: 'confirmed'}]);
    expect(calls[0]?.body.params).toEqual([['a', 'b'], {searchTransactionHistory: true}]);
    await expect(r.getSignatureStatuses(['a'])).rejects.toBeInstanceOf(RpcMalformed);
  });

  it('getTokenAccountsByOwner asks for jsonParsed and returns BigInt amounts', async () => {
    const {r, calls} = reader(() =>
      ok({
        context: {slot: 1},
        value: [{pubkey: 'Acc1', account: {data: {parsed: {info: {mint: MINT, owner: OWNER, tokenAmount: {amount: '13399619', decimals: 9}}}}}}],
      }),
    );
    expect(await r.getTokenAccountsByOwner(OWNER, {mint: MINT})).toEqual([{pubkey: 'Acc1', mint: MINT, owner: OWNER, amount: 13_399_619n, decimals: 9}]);
    expect(calls[0]?.body.params).toEqual([OWNER, {mint: MINT}, {encoding: 'jsonParsed', commitment: 'confirmed'}]);
  });

  it('getMultipleLamports reads lamports only (a zero-length data slice) and maps a missing account to 0n', async () => {
    const {r, calls} = reader(() => ok({context: {slot: 1}, value: [null, {lamports: 17}]}));
    expect(await r.getMultipleLamports(['a', 'b'])).toEqual([0n, 17n]);
    expect(calls[0]?.body.params).toEqual([['a', 'b'], {encoding: 'base64', dataSlice: {offset: 0, length: 0}, commitment: 'confirmed'}]);
  });

  it('getAccountExists distinguishes null from an account', async () => {
    let value: unknown = null;
    const {r} = reader(() => ok({context: {slot: 1}, value}));
    expect(await r.getAccountExists(OWNER)).toBe(false);
    value = {lamports: 1, data: ['', 'base64']};
    expect(await r.getAccountExists(OWNER)).toBe(true);
  });

  it('simulateTransaction sends base64 without signature verification and returns err, logs, units and the slot', async () => {
    const {r, calls} = reader(() => ok({context: {slot: 1}, value: {err: {InstructionError: [0, 'Custom']}, logs: ['a', 3], unitsConsumed: 450}}));
    expect(await r.simulateTransaction('AQID')).toEqual({err: {InstructionError: [0, 'Custom']}, logs: ['a'], unitsConsumed: 450, slot: 1, accounts: null});
    expect(calls[0]?.body.params).toEqual(['AQID', {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, commitment: 'confirmed'}]);
  });

  // B1b-2a E2: the post-states of the requested accounts, for #19's balance changes.
  describe('simulateTransaction with accounts (E2)', () => {
    const SYSTEM = '11111111111111111111111111111111';
    const U64_MAX = 18446744073709552000; // what JSON.parse makes of rentEpoch u64::MAX — never read
    const acct = (lamports: number, data = '') => ({lamports, owner: SYSTEM, data: [data, 'base64'], executable: false, rentEpoch: U64_MAX, space: 0});

    it('asks for the addresses in base64 and returns their post-states in order; a missing account is null', async () => {
      const {r, calls} = reader(() => ok({context: {slot: 271408921}, value: {err: null, logs: [], unitsConsumed: 450, accounts: [acct(7_500_000_000, 'AQID'), null]}}));
      const out = await r.simulateTransaction('AQID', {accounts: [OWNER, MINT]});
      expect(out.slot).toBe(271408921);
      expect(out.accounts).toEqual([{lamports: 7_500_000_000n, owner: SYSTEM, data: Uint8Array.from([1, 2, 3])}, null]);
      expect(calls[0]?.body.params).toEqual([
        'AQID',
        {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, commitment: 'confirmed', accounts: {encoding: 'base64', addresses: [OWNER, MINT]}},
      ]);
    });

    it('a failed simulation answers accounts: null — that is {err, accounts: null}, not a malformed reply (review H2)', async () => {
      const {r} = reader(() => ok({context: {slot: 5}, value: {err: 'AccountNotFound', logs: null, accounts: null, unitsConsumed: 0}}));
      expect(await r.simulateTransaction('AQID', {accounts: [OWNER]})).toEqual({err: 'AccountNotFound', logs: [], unitsConsumed: 0, slot: 5, accounts: null});
    });

    it('with err null, accounts must be an array of exactly the requested length', async () => {
      for (const accounts of [null, undefined, [], [acct(1)], [acct(1), acct(2), acct(3)]]) {
        const {r} = reader(() => ok({context: {slot: 5}, value: {err: null, logs: [], accounts}}));
        await expect(r.simulateTransaction('AQID', {accounts: [OWNER, MINT]})).rejects.toBeInstanceOf(RpcMalformed);
      }
    });

    it('a reply without context.slot is malformed, whether or not the simulation failed', async () => {
      for (const value of [{err: null, logs: [], accounts: [acct(1)]}, {err: 'x', logs: [], accounts: null}]) {
        const {r} = reader(() => ok({context: {}, value}));
        await expect(r.simulateTransaction('AQID', {accounts: [OWNER]})).rejects.toBeInstanceOf(RpcMalformed);
      }
    });

    // Spec §11.5, measured by the coordinator team 2026-10-01: an account drained to exactly 0 is an
    // object, not null — lamports 0, System-owned, empty data, space 0, rentEpoch u64 max as JSON.
    it('a drained account (lamports 0, rentEpoch u64 max as a JSON number) decodes to lamports 0n, not malformed', async () => {
      const drained: unknown = JSON.parse(`{"lamports":0,"owner":"${SYSTEM}","data":["","base64"],"executable":false,"rentEpoch":18446744073709551615,"space":0}`);
      const {r} = reader(() => ok({context: {slot: 5}, value: {err: null, logs: [], unitsConsumed: 300, accounts: [drained]}}));
      const out = await r.simulateTransaction('AQID', {accounts: [OWNER]});
      expect(out.accounts).toEqual([{lamports: 0n, owner: SYSTEM, data: new Uint8Array(0)}]);
    });

    // Spec §11.5, measured 2026-10-01: a payer left below rent exemption answers err
    // InsufficientFundsForRent with EVERY account null; the outcome is decided on err alone.
    it('a payer left below rent: err InsufficientFundsForRent with every account null → {err, accounts: null}', async () => {
      const err = {InsufficientFundsForRent: {account_index: 0}};
      const {r} = reader(() => ok({context: {slot: 5}, value: {err, logs: ['Program 11111111111111111111111111111111 success'], unitsConsumed: 150, accounts: [null, null]}}));
      const out = await r.simulateTransaction('AQID', {accounts: [OWNER, MINT]});
      expect(out.err).toEqual(err);
      expect(out.accounts).toBeNull();
    });

    it('refuses lamports a JSON number cannot hold exactly (above 2^53), and data that is not [base64, "base64"]', async () => {
      const bad = [{...acct(1), lamports: 2 ** 53}, {...acct(1), lamports: -1}, {...acct(1), data: 'AQID'}, {...acct(1), data: ['AQID', 'base58']}, {...acct(1), owner: 7}];
      for (const a of bad) {
        const {r} = reader(() => ok({context: {slot: 5}, value: {err: null, logs: [], accounts: [a]}}));
        await expect(r.simulateTransaction('AQID', {accounts: [OWNER]})).rejects.toBeInstanceOf(RpcMalformed);
      }
    });
  });

  it('getAccountKind: missing, a System-owned wallet, an executable program, anything else (E2)', async () => {
    let value: unknown = null;
    const {r, calls} = reader(() => ok({context: {slot: 1}, value}));
    expect(await r.getAccountKind(OWNER)).toBe('missing');
    expect(calls[0]?.body).toMatchObject({method: 'getAccountInfo', params: [OWNER, {encoding: 'base64', dataSlice: {offset: 0, length: 0}, commitment: 'confirmed'}]});
    value = {lamports: 1, owner: '11111111111111111111111111111111', executable: false, data: ['', 'base64']};
    expect(await r.getAccountKind(OWNER)).toBe('wallet');
    value = {lamports: 1, owner: 'BPFLoaderUpgradeab1e11111111111111111111111', executable: true, data: ['', 'base64']};
    expect(await r.getAccountKind(OWNER)).toBe('program');
    value = {lamports: 1, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', executable: false, data: ['', 'base64']};
    expect(await r.getAccountKind(OWNER)).toBe('other');
  });

  it('getTransaction asks for jsonParsed v0 and passes null through', async () => {
    const {r, calls} = reader(() => ok(null));
    expect(await r.getTransaction('sig')).toBeNull();
    expect(calls[0]?.body.params).toEqual(['sig', {encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed'}]);
  });

  it('getSignaturesForAddress sends before only when given', async () => {
    const {r, calls} = reader(() => ok([{signature: 's1', blockTime: 10, err: null}, {signature: 's2', blockTime: null, err: {x: 1}}]));
    expect(await r.getSignaturesForAddress(OWNER, {limit: 10})).toEqual([
      {signature: 's1', blockTime: 10, err: null},
      {signature: 's2', blockTime: null, err: {x: 1}},
    ]);
    await r.getSignaturesForAddress(OWNER, {limit: 10, before: 's2'});
    expect(calls[0]?.body.params).toEqual([OWNER, {limit: 10, commitment: 'confirmed'}]);
    expect(calls[1]?.body.params).toEqual([OWNER, {limit: 10, before: 's2', commitment: 'confirmed'}]);
  });

  it('refuses a malformed value instead of guessing', async () => {
    const {r} = reader(() => ok({context: {slot: 1}, value: '12'}));
    await expect(r.getBalance(OWNER)).rejects.toBeInstanceOf(RpcMalformed);
  });
});
