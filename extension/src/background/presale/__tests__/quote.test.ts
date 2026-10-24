import {PRESALE_FEE_BOUND_LAMPORTS, lamportsForCents, quote, solCents, type PresaleBalances, type QuoteInput} from '../quote';
import {scaledUsdPrice, usdMicros} from '../../reauthPolicy';
import {CEILING} from '../../../../../core/solana/priorityFee';
import {COMPUTE_UNIT_LIMIT} from '../../../../../core/presale/buyInstructions';
import {PRESALE_ALLOCATION_RENT_LAMPORTS, PRESALE_USER_ACCOUNT_RENT_LAMPORTS, TOKENS_PER_STAGE_BASE, tokensFor} from '../../../../../core/presale/limits';
import {SYSTEM_ACCOUNT_RENT_LAMPORTS} from '../../../../../core/solana/transfer';

// B1d §3.2, C8, C9, D7: the quote is integer arithmetic on the last view's snapshot — no network, no float but the
// price itself, every division floored as the program's. One limit rule for SOL, USDC and USDT.
const SOL_USD = 198.42;
const SCALED = scaledUsdPrice(SOL_USD) as bigint;
const NEW_PDA_RENT = PRESALE_USER_ACCOUNT_RENT_LAMPORTS + PRESALE_ALLOCATION_RENT_LAMPORTS;
const RESERVE = PRESALE_FEE_BOUND_LAMPORTS + NEW_PDA_RENT;
const RICH: PresaleBalances = {SOL: 1_000_000_000_000n, USDC: {largest: 900_000_000_000n, total: 900_000_000_000n}, USDT: {largest: 900_000_000_000n, total: 900_000_000_000n}};
const LIMITS = {minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n, firstPurchase: true};
const STAGE = {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 0n, stageCapBase: TOKENS_PER_STAGE_BASE, raisedCents: 0n};

function input(o: {limits?: Partial<typeof LIMITS>; balances?: Partial<PresaleBalances>; solUsd?: number | null; newPdaRent?: bigint; stage?: number} = {}): QuoteInput {
  return {
    snapshot: {stage: {...STAGE, stage: o.stage ?? 0}, limits: {...LIMITS, ...o.limits}, newPdaRent: o.newPdaRent ?? NEW_PDA_RENT},
    balances: {...RICH, ...o.balances},
    solUsd: o.solUsd === undefined ? SOL_USD : o.solUsd,
  };
}
/** The fewest lamports worth `cents` at our price (the boundary from below). */
const lamportsAt = (cents: bigint) => lamportsForCents(cents - 1n, SCALED) + 1n;
const CURRENCIES = ['SOL', 'USDC', 'USDT'] as const;
/** An amount of `currency` worth exactly `cents`: SOL at our price (its smallest such), a stablecoin at 10⁴ base units a cent. */
const worth = (currency: (typeof CURRENCIES)[number], cents: bigint) => (currency === 'SOL' ? lamportsAt(cents) : cents * 10_000n);

describe('the fee bound and the SOL arithmetic', () => {
  it('the network-fee bound is one signature plus the normal tier’s priority ceiling over the purchase’s compute limit', () => {
    expect(PRESALE_FEE_BOUND_LAMPORTS).toBe(2_405_000n);
    expect(PRESALE_FEE_BOUND_LAMPORTS).toBe(5_000n + (BigInt(CEILING.normal) * BigInt(COMPUTE_UNIT_LIMIT) + 999_999n) / 1_000_000n);
  });

  it('solCents is usdMicros / 10 000, floored — the value B1b’s helper gives, for every amount and price tried', () => {
    for (const price of [198.42, 0.000_731, 150, 1_234.567_891, 9.99]) {
      const scaled = scaledUsdPrice(price) as bigint;
      for (const l of [0n, 1n, 50_399n, 50_400n, 999_999_999n, 1_000_000_000n, 123_456_789_012n, 18_446_744_073_709_551_615n]) {
        expect([price, l, solCents(l, scaled)]).toEqual([price, l, (usdMicros(l, 9, price) as bigint) / 10_000n]);
      }
    }
  });

  it('lamportsForCents is the most lamports worth at most that many cents — one more lamport is worth more', () => {
    for (const price of [198.42, 0.000_731, 150, 1_234.567_891]) {
      const scaled = scaledUsdPrice(price) as bigint;
      for (const c of [0n, 1n, 999n, 1_000n, 5_000_000n, 20_000_000n]) {
        const l = lamportsForCents(c, scaled);
        expect([price, c, solCents(l, scaled) <= c, solCents(l + 1n, scaled) > c]).toEqual([price, c, true, true]);
      }
    }
  });
});

describe('the limits — one rule for every currency (D7)', () => {
  it.each(CURRENCIES)('%s: one cent below the configured minimum is below-min; the minimum itself passes', currency => {
    expect(quote(input(), currency, worth(currency, 999n)).line).toBe('below-min');
    expect(quote(input(), currency, worth(currency, 1_000n))).toMatchObject({cents: 1_000n, line: null});
  });

  it.each(CURRENCIES)('%s: no client floor beyond config.min_purchase_usd — 1 000 to 2 499 cents buy; the program’s fallback of 2 500 applies only to a 0 field', currency => {
    for (const cents of [1_000n, 1_001n, 2_499n]) expect([currency, cents, quote(input(), currency, worth(currency, cents)).line]).toEqual([currency, cents, null]);
    expect(quote(input({limits: {minCents: 2_500n}}), currency, worth(currency, 2_499n)).line).toBe('below-min');
    expect(quote(input({limits: {minCents: 2_500n}}), currency, worth(currency, 2_500n)).line).toBeNull();
  });

  it.each(CURRENCIES)('%s: the per-transaction maximum and +1 cent', currency => {
    expect(quote(input(), currency, worth(currency, 5_000_000n)).line).toBeNull();
    expect(quote(input(), currency, worth(currency, 5_000_001n)).line).toBe('above-max-tx');
  });

  it.each(CURRENCIES)('%s: what the account may still spend and +1 cent', currency => {
    const limits = {userRemainingCents: 300_000n};
    expect(quote(input({limits}), currency, worth(currency, 300_000n)).line).toBeNull();
    expect(quote(input({limits}), currency, worth(currency, 300_001n)).line).toBe('above-user-limit');
  });

  it('a limit line comes before a balance line, in checkLimits’ order', () => {
    const poor = {SOL: 0n, USDC: {largest: 0n, total: 0n}};
    expect(quote(input({balances: poor}), 'SOL', worth('SOL', 999n)).line).toBe('below-min');
    expect(quote(input({balances: poor}), 'USDC', worth('USDC', 5_000_001n)).line).toBe('above-max-tx');
  });

  it('the estimate is tokensFor(cents, stage) at the snapshot’s stage', () => {
    expect(quote(input({stage: 3}), 'USDC', 100_000_000n)).toEqual({amount: 100_000_000n, cents: 10_000n, nocBase: tokensFor(10_000n, 3), line: null});
    const q = quote(input(), 'SOL', 1_000_000_000n);
    expect(q).toEqual({amount: 1_000_000_000n, cents: 19_842n, nocBase: tokensFor(19_842n, 0), line: null});
  });

  it('a stablecoin amount floors to cents (9 999 base units are no cent)', () => {
    expect(quote(input(), 'USDT', 10_009_999n)).toMatchObject({cents: 1_000n, line: null});
  });
});

describe('the balance lines', () => {
  it('SOL: the amount, the fee bound and the new-PDA rent bound must leave at least 890 880 lamports', () => {
    const amount = 1_000_000_000n;
    const exact = amount + RESERVE + SYSTEM_ACCOUNT_RENT_LAMPORTS;
    expect(quote(input({balances: {SOL: exact}}), 'SOL', amount).line).toBeNull();
    expect(quote(input({balances: {SOL: exact - 1n}}), 'SOL', amount).line).toBe('sender-below-rent');
    expect(quote(input({balances: {SOL: amount + RESERVE}}), 'SOL', amount).line).toBe('sender-below-rent');
    expect(quote(input({balances: {SOL: amount + RESERVE - 1n}}), 'SOL', amount).line).toBe('insufficient-sol');
  });

  it('SOL: an account whose two PDAs exist reserves only the fee bound', () => {
    const amount = 1_000_000_000n;
    const sol = amount + PRESALE_FEE_BOUND_LAMPORTS + SYSTEM_ACCOUNT_RENT_LAMPORTS;
    expect(quote(input({newPdaRent: 0n, balances: {SOL: sol}}), 'SOL', amount).line).toBeNull();
    expect(quote(input({balances: {SOL: sol}}), 'SOL', amount).line).toBe('insufficient-sol');
  });

  it.each(['USDC', 'USDT'] as const)('%s: within the largest holding; a split balance; too little; SOL for the fee and rent bounds', currency => {
    const held = {largest: 50_000_000n, total: 80_000_000n};
    const b = (sol: bigint) => ({SOL: sol, [currency]: held});
    const enough = RESERVE + SYSTEM_ACCOUNT_RENT_LAMPORTS;
    expect(quote(input({balances: b(enough)}), currency, 50_000_000n).line).toBeNull();
    expect(quote(input({balances: b(enough)}), currency, 50_000_001n).line).toBe('split-balance');
    expect(quote(input({balances: b(enough)}), currency, 80_000_000n).line).toBe('split-balance');
    expect(quote(input({balances: b(enough)}), currency, 80_000_001n).line).toBe('insufficient-token');
    expect(quote(input({balances: b(enough - 1n)}), currency, 50_000_000n).line).toBe('sender-below-rent');
    expect(quote(input({balances: b(RESERVE - 1n)}), currency, 50_000_000n).line).toBe('insufficient-sol');
  });

  it('a token line comes before the SOL line', () => {
    expect(quote(input({balances: {SOL: 0n, USDC: {largest: 10_000_000n, total: 10_000_000n}}}), 'USDC', 20_000_000n).line).toBe('insufficient-token');
  });
});

describe('MAX (C9)', () => {
  it('SOL leaves exactly 890 880 + the fee bound + the new-PDA rent bound, when no limit binds', () => {
    const sol = 10_000_000_000n;
    const q = quote(input({balances: {SOL: sol}}), 'SOL', 'max');
    expect(q.amount).toBe(sol - PRESALE_FEE_BOUND_LAMPORTS - NEW_PDA_RENT - 890_880n);
    expect(q.line).toBeNull();
    expect(quote(input({newPdaRent: 0n, balances: {SOL: sol}}), 'SOL', 'max').amount).toBe(sol - PRESALE_FEE_BOUND_LAMPORTS - 890_880n);
  });

  it('SOL is capped by the per-transaction maximum — the most lamports worth it at our price', () => {
    const q = quote(input({limits: {maxTxCents: 100_000n}}), 'SOL', 'max');
    expect(q).toEqual({amount: lamportsForCents(100_000n, SCALED), cents: 100_000n, nocBase: tokensFor(100_000n, 0), line: null});
  });

  it('SOL is capped by what the account may still spend', () => {
    const q = quote(input({limits: {userRemainingCents: 40_000n}}), 'SOL', 'max');
    expect(q).toMatchObject({amount: lamportsForCents(40_000n, SCALED), cents: 40_000n, line: null});
  });

  it('SOL: a balance below the reserve is MAX 0, below the minimum — and so is a remainder below the minimum', () => {
    expect(quote(input({balances: {SOL: RESERVE}}), 'SOL', 'max')).toEqual({amount: 0n, cents: 0n, nocBase: 0n, line: 'below-min'});
    expect(quote(input({limits: {userRemainingCents: 999n}}), 'SOL', 'max')).toMatchObject({cents: 999n, line: 'below-min'});
  });

  it.each(['USDC', 'USDT'] as const)('%s: the largest holding, not the total; capped by each limit at exact cents', currency => {
    const held = {largest: 50_000_000n, total: 80_000_000n};
    expect(quote(input({balances: {[currency]: held}}), currency, 'max')).toEqual({amount: 50_000_000n, cents: 5_000n, nocBase: tokensFor(5_000n, 0), line: null});
    expect(quote(input({limits: {maxTxCents: 3_000n}, balances: {[currency]: held}}), currency, 'max')).toMatchObject({amount: 30_000_000n, cents: 3_000n, line: null});
    expect(quote(input({limits: {userRemainingCents: 2_000n}, balances: {[currency]: held}}), currency, 'max')).toMatchObject({amount: 20_000_000n, cents: 2_000n, line: null});
    expect(quote(input({balances: {[currency]: {largest: 0n, total: 0n}}}), currency, 'max')).toMatchObject({amount: 0n, line: 'below-min'});
  });
});

describe('no SOL price (C8): no estimate, never an invented price', () => {
  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('price %s: SOL answers no-sol-price with no cents and no estimate', solUsd => {
    expect(quote(input({solUsd}), 'SOL', 1_000_000_000n)).toEqual({amount: 1_000_000_000n, cents: null, nocBase: null, line: 'no-sol-price'});
    expect(quote(input({solUsd}), 'SOL', 'max')).toEqual({amount: RICH.SOL - RESERVE - SYSTEM_ACCOUNT_RENT_LAMPORTS, cents: null, nocBase: null, line: 'no-sol-price'});
  });

  it('the stablecoins are still quoted without a SOL price (positive control)', () => {
    expect(quote(input({solUsd: null}), 'USDC', 100_000_000n)).toEqual({amount: 100_000_000n, cents: 10_000n, nocBase: tokensFor(10_000n, 0), line: null});
    expect(quote(input({solUsd: null}), 'USDT', 'max').line).toBeNull();
  });
});
