import {getSwapQuote, getSwapTransaction, jupiterMint} from '../jupiter';
import {USDC_MINT} from '../../tokens/coreTokens';

const WSOL = 'So11111111111111111111111111111111111111112';

afterEach(() => {
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('jupiterMint', () => {
  it("maps 'native' to wrapped SOL, passes others through", () => {
    expect(jupiterMint('native')).toBe(WSOL);
    expect(jupiterMint(USDC_MINT)).toBe(USDC_MINT);
  });
});

describe('getSwapQuote', () => {
  it('parses a quote with a route', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        inputMint: WSOL,
        outputMint: USDC_MINT,
        inAmount: '1000000000',
        outAmount: '150000000',
        priceImpactPct: '0.0011',
        slippageBps: 50,
        routePlan: [{swapInfo: {}}],
      }),
    })) as unknown as typeof fetch;
    const q = await getSwapQuote({
      inputMint: WSOL,
      outputMint: USDC_MINT,
      amount: '1000000000',
      slippageBps: 50,
    });
    expect(q.outAmount).toBe('150000000');
    expect(q.priceImpactPct).toBe('0.0011');
    expect(q.raw).toBeDefined();
  });

  it('throws "no route" when routePlan is empty', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({routePlan: []}),
    })) as unknown as typeof fetch;
    await expect(
      getSwapQuote({inputMint: WSOL, outputMint: USDC_MINT, amount: '1', slippageBps: 50})
    ).rejects.toThrow();
  });

  it('throws on non-200', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({error: 'bad'}),
    })) as unknown as typeof fetch;
    await expect(
      getSwapQuote({inputMint: WSOL, outputMint: USDC_MINT, amount: '1', slippageBps: 50})
    ).rejects.toThrow();
  });
});

describe('getSwapTransaction', () => {
  it('returns the base64 tx + lastValidBlockHeight', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({swapTransaction: 'BASE64TX', lastValidBlockHeight: 12345}),
    })) as unknown as typeof fetch;
    const r = await getSwapTransaction({route: true}, 'OwnerPubkey');
    expect(r.swapTransaction).toBe('BASE64TX');
    expect(r.lastValidBlockHeight).toBe(12345);
  });

  it('throws on non-200', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(getSwapTransaction({}, 'Owner')).rejects.toThrow();
  });
});
