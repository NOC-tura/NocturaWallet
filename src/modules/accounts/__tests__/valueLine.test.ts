/** M1d spec §4.5 (D2–D4; plan A9–A12; 2026-11-22 addendum): the split row's and the sheet rows' formatter. BigInt amounts; USD is display only. */
import {formatSide, LISTED_ASSETS, privateSide, publicSide, sideLines, splitValue} from '../valueLine';
import type {SideAsset, SideValue} from '../valueLine';
import {NOC_MINT} from '../../../constants/programs';
import {A0_TOKEN} from '../../shielded/a0/screenSupport';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const sol = (raw: bigint): SideAsset => ({mint: 'native', symbol: 'SOL', amountRaw: raw, decimals: 9});
const tst = (raw: bigint): SideAsset => ({mint: A0_TOKEN.mint, symbol: 'TEST', amountRaw: raw, decimals: 9});
const known = (assets: SideAsset[], zeroSymbol = 'SOL'): SideValue => ({kind: 'known', assets, zeroSymbol});
const PRICES = {native: {usd: 150, change24h: null}, [NOC_MINT]: {usd: 0.5, change24h: null}};

describe('formatSide', () => {
  it('unknown → "—", never 0', () => {
    expect(formatSide({kind: 'unknown'}, PRICES, ', ')).toBe('—');
  });

  it('every held asset priced → one USD figure for the side', () => {
    const s = known([sol(1_000_000_000n), {mint: NOC_MINT, symbol: 'NOC', amountRaw: 2_000_000_000n, decimals: 9}]);
    expect(formatSide(s, PRICES, ', ')).toBe('$151.00');
  });

  it('one held asset unpriced → the token amounts, largest first, at most two (the side is never half USD)', () => {
    const s = known([sol(20_000_000n), tst(8_990_000_000n)]);
    expect(formatSide(s, PRICES, ', ')).toBe('8.99 TEST, 0.02 SOL');
    expect(formatSide(s, PRICES, ' · ')).toBe('8.99 TEST · 0.02 SOL'); // a sheet row's separator
  });

  it('no prices at all (the devnet build) → the token amounts', () => {
    expect(formatSide(known([sol(1_000_000_000n)]), null, ', ')).toBe('1 SOL');
  });

  it('more than two held assets → two, then "+N"', () => {
    expect(LISTED_ASSETS).toBe(2);
    const s = known([
      sol(1_000_000_000n),
      tst(3_000_000_000n),
      {mint: USDC, symbol: 'USDC', amountRaw: 2_000_000n, decimals: 6},
      {mint: NOC_MINT, symbol: 'NOC', amountRaw: 500_000_000n, decimals: 9},
    ]);
    expect(formatSide(s, null, ', ')).toBe('3 TEST, 2 USDC +2');
  });

  it('"largest" is decimals-normalised: 5 USDC (6 decimals) before 0.5 SOL (9 decimals); a tie by symbol', () => {
    expect(formatSide(known([sol(500_000_000n), {mint: USDC, symbol: 'USDC', amountRaw: 5_000_000n, decimals: 6}]), null, ', ')).toBe('5 USDC, 0.5 SOL');
    expect(formatSide(known([tst(1_000_000_000n), sol(1_000_000_000n)]), null, ', ')).toBe('1 SOL, 1 TEST');
  });

  it('nothing held → "0 {zeroSymbol}" (a known zero, not an unknown)', () => {
    expect(formatSide(known([sol(0n)]), PRICES, ', ')).toBe('0 SOL');
    expect(formatSide(known([tst(0n)], 'TEST'), null, ', ')).toBe('0 TEST');
  });

  it('a zero, unpriced asset does not stop the USD form', () => {
    expect(formatSide(known([sol(1_000_000_000n), tst(0n)]), PRICES, ', ')).toBe('$150.00');
  });
});

describe('formatSide — large values, wide decimals, small USD (review M1, M3)', () => {
  it('M1: raw amounts above 2^53 that differ by 1 still order exactly (BigInt, no Number)', () => {
    const a: SideAsset = {mint: 'A', symbol: 'AAA', amountRaw: 9007199254740992n, decimals: 9};
    const b: SideAsset = {mint: 'B', symbol: 'BBB', amountRaw: 9007199254740993n, decimals: 9};
    const c: SideAsset = {mint: 'C', symbol: 'CCC', amountRaw: 1n, decimals: 9};
    expect(formatSide(known([a, b, c]), null, ', ')).toBe('9,007,199.2547 BBB, 9,007,199.2547 AAA +1');
  });
  it('M1: a 24-decimal asset is normalised down, not up (the decimals >= 18 branch)', () => {
    const wide: SideAsset = {mint: 'W', symbol: 'WIDE', amountRaw: 2_000_000_000_000_000_000_000_000n, decimals: 24}; // 2 whole
    expect(formatSide(known([sol(1_000_000_000n), wide]), null, ', ')).toBe('2 WIDE, 1 SOL');
    expect(formatSide(known([sol(3_000_000_000n), wide]), null, ', ')).toBe('3 SOL, 2 WIDE');
  });
  it('M1: u64 max formats whole at 9 decimals', () => {
    expect(formatSide(known([sol(18446744073709551615n)]), null, ', ')).toBe('18,446,744,073.7096 SOL');
  });
  it('M2: both sides in USD → two separate figures, never one sum', () => {
    const pub = known([sol(1_000_000_000n)]);
    const priv = known([tst(2_000_000_000n)], 'TEST');
    const prices = {...PRICES, [A0_TOKEN.mint]: {usd: 0.5, change24h: null}};
    expect(splitValue(pub, priv, prices, false)).toEqual({publicLines: ['$150.00'], privateLines: ['$1.00']});
  });
  it('re-review N3: a NaN / Infinity price falls to the token form, never "<$0.01" or a made-up USD', () => {
    expect(formatSide(known([sol(1_000_000_000n)]), {native: {usd: NaN, change24h: null}}, ', ')).toBe('1 SOL');
    expect(formatSide(known([sol(1_000_000_000n)]), {native: {usd: Infinity, change24h: null}}, ', ')).toBe('1 SOL');
  });

  it('M3: a priced, non-empty side worth under half a cent reads "<$0.01", never "$0.00"', () => {
    expect(formatSide(known([sol(1_000n)]), PRICES, ', ')).toBe('<$0.01');
    expect(formatSide(known([sol(0n)]), PRICES, ', ')).toBe('0 SOL'); // known-empty stays distinguishable
  });
});

describe('the sides', () => {
  it('M6: wrapped SOL is folded into SOL (one "SOL", priced as SOL)', () => {
    const WSOL = 'So11111111111111111111111111111111111111112';
    const s = publicSide({
      status: 'ready', syncedAt: 1, solBalance: '1000000000', nocBalance: '0',
      tokenBalances: {[WSOL]: '500000000'},
      tokens: [{mint: WSOL, symbol: 'SOL', name: 'Wrapped SOL', decimals: 9, trust: 'core'}],
    });
    expect(s).toEqual(known([sol(1_500_000_000n), {mint: NOC_MINT, symbol: 'NOC', amountRaw: 0n, decimals: 9}]));
    expect(formatSide(s, PRICES, ', ')).toBe('$225.00');
  });

  it('re-review N2: a malformed wrapped-SOL amount makes the side unknown ("—"), not silently dropped', () => {
    const WSOL = 'So11111111111111111111111111111111111111112';
    const s = publicSide({
      status: 'ready', syncedAt: 1, solBalance: '1000000000', nocBalance: '0',
      tokenBalances: {[WSOL]: '5e8'},
      tokens: [],
    });
    expect(s).toEqual({kind: 'unknown'});
    expect(formatSide(s, PRICES, ', ')).toBe('—');
  });

  const ready = {status: 'ready' as const, syncedAt: 1, solBalance: '20000000', nocBalance: '0', tokenBalances: {}, tokens: []};

  it('publicSide: loading / error / never synced (plan A12) / a malformed amount → unknown', () => {
    expect(publicSide({status: 'loading'})).toEqual({kind: 'unknown'});
    expect(publicSide({status: 'error'})).toEqual({kind: 'unknown'});
    expect(publicSide({...ready, syncedAt: null})).toEqual({kind: 'unknown'});
    expect(publicSide({...ready, solBalance: '1.5'})).toEqual({kind: 'unknown'});
  });

  it('publicSide: SOL, NOC and the listed tokens (plan A11)', () => {
    const s = publicSide({
      ...ready,
      tokenBalances: {[USDC]: '2000000'},
      tokens: [{mint: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}],
    });
    expect(s).toEqual(
      known([
        sol(20_000_000n),
        {mint: NOC_MINT, symbol: 'NOC', amountRaw: 0n, decimals: 9},
        {mint: USDC, symbol: 'USDC', amountRaw: 2_000_000n, decimals: 6},
      ]),
    );
  });

  it('privateSide: only a ready view is known; the unspent total, pending excluded', () => {
    for (const v of [{kind: 'unsupported'}, {kind: 'idle'}, {kind: 'running'}, {kind: 'error', code: 'E_X', message: 'm'}] as const) {
      expect(privateSide(v)).toEqual({kind: 'unknown'});
    }
    expect(privateSide({kind: 'ready', unspent: 1_003_800_000n, pending: 5n, notes: 1})).toEqual(known([tst(1_003_800_000n)], 'TEST'));
    expect(formatSide(privateSide({kind: 'ready', unspent: 0n, pending: 250_000_000n, notes: 0}), null, ', ')).toBe('0 TEST');
  });
});

describe('sideLines — the split row\'s columns (plan 2026-11-22 Task 5)', () => {
  it('a USD side → one line', () => {
    expect(sideLines(known([sol(1_000_000_000n)]), PRICES)).toEqual(['$150.00']);
    expect(sideLines(known([sol(1_000n)]), PRICES)).toEqual(['<$0.01']);
  });
  it('a token side with two assets → one line each, largest first', () => {
    expect(sideLines(known([sol(3_000_000n), tst(1_000_000n)]), null)).toEqual(['0.003 SOL', '0.001 TEST']);
  });
  it('three assets → two, then "+1 more" (replaces the sheet\'s "+N")', () => {
    const s = known([sol(469_300_000n), tst(8_995_000_000n), {mint: USDC, symbol: 'USDC', amountRaw: 100_000n, decimals: 6}]);
    expect(sideLines(s, null)).toEqual(['8.995 TEST', '0.4693 SOL', '+1 more']);
    expect(formatSide(s, null, ' · ')).toBe('8.995 TEST · 0.4693 SOL +1'); // r1-6: the sheet row keeps "+N"
  });
  it('nothing held → one line "0 {zeroSymbol}"', () => {
    expect(sideLines(known([sol(0n)]), PRICES)).toEqual(['0 SOL']);
    expect(sideLines(known([tst(0n)], 'TEST'), null)).toEqual(['0 TEST']);
  });
  it('unknown → exactly one line "—"', () => {
    expect(sideLines({kind: 'unknown'}, PRICES)).toEqual(['—']);
  });
  it('a malformed amount → unknown → "—" (kept)', () => {
    const s = publicSide({status: 'ready', syncedAt: 1, solBalance: '1.5', nocBalance: '0', tokenBalances: {}, tokens: []});
    expect(sideLines(s, PRICES)).toEqual(['—']);
  });
  it('r1-9: a tiny amount with prices = null → "<0.0001 TEST", never 0 or scientific notation', () => {
    expect(sideLines(known([tst(1n)], 'TEST'), null)).toEqual(['<0.0001 TEST']);
  });
});

describe('splitValue (spec §4.5, 2026-11-22 addendum)', () => {
  const many = known([sol(1_000_000_000n), tst(3_000_000_000n), {mint: USDC, symbol: 'USDC', amountRaw: 2_000_000n, decimals: 6}]);
  it('the two sides formatted apart, never summed', () => {
    const priv = privateSide({kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1});
    expect(splitValue(known([sol(1_000_000_000n)]), priv, PRICES, false)).toEqual({publicLines: ['$150.00'], privateLines: ['1.0038 TEST']});
    expect(splitValue(many, priv, null, false)).toEqual({publicLines: ['3 TEST', '2 USDC', '+1 more'], privateLines: ['1.0038 TEST']});
  });
  it('an unknown side is "—" on its own side only, one line', () => {
    expect(splitValue({kind: 'unknown'}, known([tst(0n)], 'TEST'), null, false)).toEqual({publicLines: ['—'], privateLines: ['0 TEST']});
    expect(splitValue(many, {kind: 'unknown'}, null, false)).toEqual({publicLines: ['3 TEST', '2 USDC', '+1 more'], privateLines: ['—']});
  });
  it('r1-8: hidden → exactly one "•••" per column, whatever is known (never "+N more", never a digit)', () => {
    const r = splitValue(many, known([tst(5n)], 'TEST'), PRICES, true);
    expect(r).toEqual({publicLines: ['•••'], privateLines: ['•••']});
    expect(JSON.stringify(r)).not.toMatch(/\d/);
  });

  it('post-M1d §3.2: a stale figure is a known side (the screen dims it); the same lines as the ready one', () => {
    const figure = {solBalance: '1000000000', nocBalance: '0', tokenBalances: {}, tokens: []};
    const ready = publicSide({status: 'ready', syncedAt: 5, ...figure});
    const stale = publicSide({status: 'stale', syncedAt: 5, failedAt: 9, ...figure});
    expect(stale).toEqual(ready);
    expect(sideLines(stale, null)).toEqual(['1 SOL']);
  });

  it('an error (a never-read main whose sync failed) is an unknown side: "—"', () => {
    expect(sideLines(publicSide({status: 'error'}), null)).toEqual(['—']);
  });
});
