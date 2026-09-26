import type {ReactNode} from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {PublicKey} from '@solana/web3.js';

const h = vi.hoisted(() => ({getBalance: vi.fn(), getParsed: vi.fn()}));
vi.mock('../../lib/solana', () => ({
  connection: () => ({getBalance: h.getBalance, getParsedTokenAccountsByOwner: h.getParsed}),
}));

import {useBalances} from '../useBalances';

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');

function wrapper({children}: {children: ReactNode}) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const NOC = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

/** One call now returns every token account, so each carries the mint it belongs to. */
const tokenAccount = (amount: string, mint: string = NOC) => ({
  account: {data: {parsed: {info: {mint, tokenAmount: {amount}}}}},
});

beforeEach(() => {
  h.getBalance.mockReset();
  h.getParsed.mockReset();
});

describe('useBalances', () => {
  it('returns lamports as bigint, never a float', async () => {
    h.getBalance.mockResolvedValue(473081440);
    h.getParsed.mockResolvedValue({value: []});
    const {result} = renderHook(() => useBalances(USER), {wrapper});
    await waitFor(() => expect(result.current.sol).toBe(473081440n));
  });

  it('sums EVERY account for the mint, not the derived ATA alone', async () => {
    // This wallet's tokens live in a non-canonical account. Reading only the ATA
    // shows a zero that is not true, which is a lie about someone's money.
    h.getBalance.mockResolvedValue(0);
    h.getParsed.mockResolvedValue({value: [tokenAccount('1000000000'), tokenAccount('2000000000')]});
    const {result} = renderHook(() => useBalances(USER), {wrapper});
    await waitFor(() => expect(result.current.noc).toBe(3000000000n));
  });

  it('keeps the three mints apart in the one call that fetches them all', async () => {
    // A single getParsedTokenAccountsByOwner now covers NOC, USDC and USDT, so each
    // account has to be attributed by its mint. Summing blindly would report someone's
    // dollars as NOC and let them buy against a balance they do not have.
    h.getBalance.mockResolvedValue(0);
    h.getParsed.mockResolvedValue({
      value: [
        tokenAccount('3000000000', NOC),
        tokenAccount('25000000', USDC),
        tokenAccount('7000000', USDT),
        tokenAccount('999', 'So11111111111111111111111111111111111111112'),
      ],
    });
    const {result} = renderHook(() => useBalances(USER), {wrapper});
    await waitFor(() => expect(result.current.noc).toBe(3000000000n));
    expect(result.current.usdc).toBe(25000000n);
    expect(result.current.usdt).toBe(7000000n);
  });

  it('asks the RPC once, not once per mint', async () => {
    // The proxy allows 240 requests a minute with an Origin and this hook polls every
    // 20 s from two panels; three calls each would spend a quarter of that on nothing.
    h.getBalance.mockResolvedValue(0);
    h.getParsed.mockResolvedValue({value: []});
    const {result} = renderHook(() => useBalances(USER), {wrapper});
    await waitFor(() => expect(result.current.noc).toBe(0n));
    expect(h.getParsed).toHaveBeenCalledTimes(1);
  });

  it('distinguishes an empty wallet from a failed read', async () => {
    h.getBalance.mockResolvedValue(0);
    h.getParsed.mockResolvedValue({value: []});
    const {result: empty} = renderHook(() => useBalances(USER), {wrapper});
    await waitFor(() => expect(empty.current.noc).toBe(0n));
    expect(empty.current.isError).toBe(false);

    h.getBalance.mockRejectedValue(new Error('rpc down'));
    const {result: broken} = renderHook(() => useBalances(USER), {wrapper});
    await waitFor(() => expect(broken.current.isError).toBe(true));
    expect(broken.current.sol).toBeNull();
    expect(broken.current.noc).toBeNull();
    expect(broken.current.usdc).toBeNull();
    expect(broken.current.usdt).toBeNull();
  });

  it('asks for nothing when no wallet is connected', async () => {
    const {result} = renderHook(() => useBalances(null), {wrapper});
    await waitFor(() => expect(result.current.sol).toBeNull());
    expect(h.getBalance).not.toHaveBeenCalled();
    // Positive control: the spy does register calls, so the assertion can fail.
    h.getBalance('x');
    expect(h.getBalance).toHaveBeenCalledTimes(1);
  });
});
