import type {ReactNode} from 'react';
import {renderHook, act} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {PublicKey} from '@solana/web3.js';

const h = vi.hoisted(() => ({
  account: vi.fn(),
  geo: vi.fn(),
  simulate: vi.fn(),
  send: vi.fn(),
  blockhash: vi.fn(),
  height: vi.fn(),
  statuses: vi.fn(),
  fees: vi.fn(),
  record: vi.fn(),
  resolve: vi.fn(),
  price: vi.fn(),
  features: {'solana:signAndSendTransaction': {}} as Record<string, unknown>,
}));

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');

vi.mock('../../geo/useGeo', () => ({checkGeo: h.geo}));
vi.mock('../../lib/api', () => ({json: {get: h.price}, post: {post: vi.fn()}}));
vi.mock('../../../../core/presale/record', () => ({recordPresalePurchase: h.record}));
vi.mock('../../../../core/presale/referrer', () => ({resolveReferrer: h.resolve}));
vi.mock('../../lib/solana', () => ({
  connection: () => ({
    simulateTransaction: h.simulate,
    getLatestBlockhash: h.blockhash,
    getBlockHeight: h.height,
    getSignatureStatuses: h.statuses,
    getRecentPrioritizationFees: h.fees,
  }),
  accountReader: {getAccountInfo: h.account},
}));
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: USER,
    sendTransaction: h.send,
    wallet: {adapter: {name: 'Phantom', wallet: {features: h.features}}},
  }),
}));

import {useBuy} from '../useBuy';

function wrapper({children}: {children: ReactNode}) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * A real Config account, 370 bytes with the treasury at offset 338 — the layout the
 * program uses. Built rather than stubbed away, so this suite exercises the OFFSET too:
 * the destination is read from chain precisely because a constant drifted from it once.
 */
const CONFIG_ACCOUNT = (() => {
  const data = new Uint8Array(370);
  // admin@8 and sale_token@40 are not decoration: readSolTreasury checks them as a
  // positional control before trusting offset 338, so a fixture that omits them is
  // rejected — as this one was, the moment the control was added.
  data.set(new PublicKey('KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr').toBytes(), 8);
  data.set(new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW').toBytes(), 40);
  data.set(new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd').toBytes(), 338);
  return {data};
})();

const ALLOW = {result: {action: 'allow', countryCode: 'SI', transparentAllowed: true}, listSource: 'server', listStale: false, listUpdatedAt: '2026-09-21'};

beforeEach(() => {
  for (const k of ['geo', 'simulate', 'send', 'blockhash', 'height', 'statuses', 'fees', 'record', 'resolve', 'price'] as const) {
    h[k].mockReset();
  }
  h.features = {'solana:signAndSendTransaction': {}};
  h.account.mockReset();
  h.account.mockResolvedValue(CONFIG_ACCOUNT);
  h.blockhash.mockResolvedValue({blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 100});
  h.height.mockResolvedValue(10);
  h.statuses.mockResolvedValue({value: [{confirmationStatus: 'confirmed', err: null}]});
  h.fees.mockResolvedValue([{prioritizationFee: 1000}]);
  h.price.mockResolvedValue({success: true, data: {solana: {usd: 118.18}}});
  h.resolve.mockResolvedValue({referrerAllocation: PublicKey.default, registerReferrer: null, effectiveReferrerAddress: null});
  h.geo.mockResolvedValue(ALLOW);
  h.simulate.mockResolvedValue({value: {err: null}});
  h.send.mockResolvedValue('5orjuduJpk6F3oF9YZM3signature');
});

const STAGE = {displayStage: 1, pricePerNocUsd: 0.1501};

describe('useBuy — every refusal happens before a signature is requested', () => {
  it('refuses a sanctioned region', async () => {
    h.geo.mockResolvedValue({...ALLOW, result: {action: 'block', countryCode: 'IR', reason: 'sanctioned', transparentAllowed: true}});
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    await act(async () => {
      await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/restricted|sanctioned/i);
    });
    expect(h.send).not.toHaveBeenCalled();
  });

  it('refuses when the geo service itself fails — spec 6.8', async () => {
    h.geo.mockRejectedValue(new Error('geo unreachable'));
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    await act(async () => {
      await expect(result.current.submit(1_000_000_000n)).rejects.toThrow();
    });
    expect(h.send).not.toHaveBeenCalled();
  });

  it('refuses when the simulation errors', async () => {
    h.simulate.mockResolvedValue({value: {err: {InstructionError: [0, 'Custom']}}});
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    await act(async () => {
      await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/simulation/i);
    });
    expect(h.send).not.toHaveBeenCalled();
  });

  it('refuses a wallet that cannot broadcast, and says so before any amount is entered', async () => {
    h.features = {'solana:signTransaction': {}};
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    expect(result.current.canBuy).toBe(false);
    expect(result.current.blockedReason).toMatch(/cannot/i);
    await act(async () => {
      await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/cannot/i);
    });
    expect(h.send).not.toHaveBeenCalled();
  });

  it('allows a wallet that can broadcast (positive control)', () => {
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    expect(result.current.canBuy).toBe(true);
    expect(result.current.blockedReason).toBeNull();
  });

  it('rejects a second submit inside the debounce window, per hook instance', async () => {
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    await act(async () => {
      await result.current.submit(1_000_000_000n);
      await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/too soon|in flight/i);
    });
    expect(h.send).toHaveBeenCalledTimes(1);
  });
});

describe('useBuy — the successful path', () => {
  it('uses the RESOLVED referrer allocation, never one derived from the buyer', async () => {
    const R2 = new PublicKey('9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4');
    h.resolve.mockResolvedValue({referrerAllocation: R2, registerReferrer: null, effectiveReferrerAddress: R2.toBase58()});
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    await act(async () => {
      await result.current.submit(1_000_000_000n);
    });
    const tx = h.send.mock.calls[0]![0];
    expect(tx.message.staticAccountKeys.some((k: PublicKey) => k.equals(R2))).toBe(true);
  });

  it('records the purchase in the coordinator field names, with a real NOC amount', async () => {
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    await act(async () => {
      await result.current.submit(1_000_000_000n);
    });
    const rec = h.record.mock.calls[0]![1];
    expect(rec.txHash).toBe('5orjuduJpk6F3oF9YZM3signature');
    expect(rec.paymentToken).toBe('SOL');
    expect(rec.buyerAddress).toBe(USER.toBase58());
    expect(rec.paymentAmount).toBeCloseTo(1, 9);
    expect(rec.usdValue).toBeCloseTo(118.18, 2);
    expect(rec.nocAmount).toBeCloseTo(118.18 / 0.1501, 2);
    expect(rec.stage).toBe(1);
  });

  it('still resolves when the record call fails — the chain is the source of truth', async () => {
    h.record.mockRejectedValue(new Error('coordinator down'));
    const {result} = renderHook(() => useBuy(STAGE), {wrapper});
    await act(async () => {
      await expect(result.current.submit(1_000_000_000n)).resolves.toContain('signature');
    });
  });
});
