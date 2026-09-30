import {REQUEST_TIMEOUT_MS, RequestTimedOut, RequestUnreachable, createJsonGetter, timedFetch} from '../deps';
import {handleWallet} from '../walletApi';
import {RpcForbidden, createForbiddenLatch, createRpc, solanaReader} from '../../../../core/solana/rpc';
import {BroadcastUnavailable, broadcastSigned} from '../../../../core/solana/broadcast';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, signedWire} from './fixtures';

// Spec B1b-2a E4: a request that got no answer is 'unreachable', never 'failed' — #42 needs the code
// to tell "offline" from "something failed". Nothing here opens a socket: fetch is stubbed.
describe('RequestUnreachable (E4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('timedFetch turns a rejected fetch (offline, DNS, reset) into RequestUnreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const e = await timedFetch(REQUEST_TIMEOUT_MS)('https://example.invalid/x', {method: 'GET'}).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(RequestUnreachable);
    expect(e).not.toBeInstanceOf(RpcForbidden);
  });

  it('a timeout is a RequestUnreachable too (RequestTimedOut is its subclass)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const settled = timedFetch(REQUEST_TIMEOUT_MS)('https://example.invalid/x', {method: 'GET'}).catch((x: unknown) => x);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    const e = await settled;
    expect(e).toBeInstanceOf(RequestTimedOut);
    expect(e).toBeInstanceOf(RequestUnreachable);
  });

  // Each client must let it through UNWRAPPED — the same instance — or the message layer sees 'failed'.
  const lost = new RequestUnreachable('https://example.invalid', 'offline');
  const rejecting = async (): Promise<never> => {
    throw lost;
  };

  it('createRpc lets it propagate unwrapped', async () => {
    const reader = solanaReader(createRpc({fetch: rejecting, latch: createForbiddenLatch()}));
    await expect(reader.getBlockHeight()).rejects.toBe(lost);
  });

  it('createJsonGetter lets it propagate unwrapped', async () => {
    await expect(createJsonGetter(rejecting, createForbiddenLatch()).get('/stats')).rejects.toBe(lost);
  });

  it('broadcastSigned lets it propagate unwrapped (any other failure to reach is still BroadcastUnavailable)', async () => {
    await expect(broadcastSigned({fetch: rejecting, latch: createForbiddenLatch()}, signedWire())).rejects.toBe(lost);
    const typeError = async (): Promise<never> => {
      throw new TypeError('Failed to fetch');
    };
    await expect(broadcastSigned({fetch: typeError, latch: createForbiddenLatch()}, signedWire())).rejects.toBeInstanceOf(BroadcastUnavailable);
  });

  it('the message layer answers unreachable for a timeout and a rejected fetch, coordinator-refused for a 403, failed for anything else', async () => {
    const withError = (e: Error) =>
      fakeDeps({
        reader: fakeReader({
          getBalance: async () => {
            throw e;
          },
          getTokenAccountsByOwner: async () => [],
        }),
      });
    const ask = (e: Error) => handleWallet(fakeExt(), withError(e), 'wallet.balances', {account: ACCOUNT.publicKey});
    expect(await ask(new RequestTimedOut('u', 1))).toEqual({ok: false, error: 'unreachable'});
    expect(await ask(new RequestUnreachable('u', 'offline'))).toEqual({ok: false, error: 'unreachable'});
    expect(await ask(new RpcForbidden('getBalance'))).toEqual({ok: false, error: 'coordinator-refused'});
    expect(await ask(new Error('boom'))).toEqual({ok: false, error: 'failed'});
  });
});
