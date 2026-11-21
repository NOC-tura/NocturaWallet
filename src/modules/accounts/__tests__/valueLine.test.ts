/** M1d spec §4.5 (D2–D4; plan A9–A12): the combined line's formatter. BigInt amounts; USD is display only. */
import {combinedValueLine, formatSide, LISTED_ASSETS, privateSide, publicSide} from '../valueLine';
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

describe('the sides', () => {
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

describe('combinedValueLine (spec §4.5)', () => {
  it('"Public X · Private Y", the two sides never summed', () => {
    const pub = known([sol(1_000_000_000n)]);
    const priv = privateSide({kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1});
    expect(combinedValueLine(pub, priv, PRICES, false)).toBe('Public $150.00 · Private 1.0038 TEST');
    expect(combinedValueLine(known([sol(20_000_000n), tst(8_990_000_000n)]), priv, null, false)).toBe('Public 8.99 TEST, 0.02 SOL · Private 1.0038 TEST');
  });
  it('an unknown side is "—" on its own side only', () => {
    expect(combinedValueLine({kind: 'unknown'}, known([tst(0n)], 'TEST'), null, false)).toBe('Public — · Private 0 TEST');
    expect(combinedValueLine(known([sol(1_000_000_000n)]), {kind: 'unknown'}, null, false)).toBe('Public 1 SOL · Private —');
  });
  it('hidden balances → "Public ••• · Private •••" whatever is known', () => {
    expect(combinedValueLine(known([sol(1n)]), {kind: 'unknown'}, PRICES, true)).toBe('Public ••• · Private •••');
  });
});
