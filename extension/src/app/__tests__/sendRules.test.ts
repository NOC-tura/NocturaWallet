import {parseAmount} from '../../shared/amount';
import {sendReauthReasons, usdMicros} from '../../background/reauthPolicy';
import {
  BASE_FEE_LAMPORTS,
  FEE_REASON_TEXT,
  MARKUP_CEILING_LAMPORTS,
  PRIORITY_CEILING_MICRO_LAMPORTS,
  RENT_EXEMPT_LAMPORTS,
  SOL_SEND_COMPUTE_UNITS,
  WORST_SOL_FEE_LAMPORTS,
  draftOf,
  feeRows,
  isAddressText,
  isDraft,
  isIntent,
  maxSendable,
  sameIntent,
  percentOf,
  plainAmount,
  predictReasons,
  sentBeforeText,
  showExact,
  showLamports,
  unitPrice,
  usdOf,
} from '../send/rules';
import {CEILING} from '../../../../core/solana/priorityFee';
import {BASE_FEE_LAMPORTS_PER_SIGNATURE, SYSTEM_ACCOUNT_RENT_LAMPORTS, computeUnitLimitFor, networkFeeLamports} from '../../../../core/solana/transfer';
import {TRANSFER_MARKUP_LAMPORTS} from '../../../../core/fees/transferMarkup';
import {RECIPIENT} from '../../background/__tests__/fixtures';

// Spec §4.2–§4.5: the send flow's arithmetic and text, pure.
describe('the send flow’s rules', () => {
  it('a recipient is base58, 32–44 characters, and 32 bytes decoded', () => {
    expect(isAddressText(RECIPIENT)).toBe(true);
    expect(isAddressText('11111111111111111111111111111111')).toBe(true);
    for (const bad of ['', `0${RECIPIENT.slice(1)}`, RECIPIENT.slice(0, 31), `${RECIPIENT} `, `${RECIPIENT}x`, 'marko.sol', '1'.repeat(45), 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz']) {
      expect(`${bad}: ${isAddressText(bad)}`).toBe(`${bad}: false`);
    }
    // Fix round 1, #3: the invisible characters a paste can carry — before, after, and inside the address.
    for (const z of ['\u200b', '\u200c', '\u200d', '\ufeff']) {
      for (const bad of [`${RECIPIENT}${z}`, `${z}${RECIPIENT}`, `${RECIPIENT.slice(0, 10)}${z}${RECIPIENT.slice(10)}`]) {
        expect(`${JSON.stringify(bad)}: ${isAddressText(bad)}`).toBe(`${JSON.stringify(bad)}: false`);
      }
    }
  });

  it('a route draft is the user’s own text, bounded; an intent is a known token, an address and a positive u64', () => {
    expect(isDraft({token: 'SOL', recipient: 'abc', amount: '1.'})).toBe(true);
    expect(isDraft({token: 'BONK', recipient: '', amount: ''})).toBe(false);
    expect(isDraft({token: 'SOL', recipient: 'x'.repeat(65), amount: ''})).toBe(false);
    // Task 6 fix round 1 (M3): `max` carries "the amount is MAX's" across #15's pick — only `true`, or absent.
    expect(isDraft({token: 'SOL', recipient: '', amount: '1', max: true})).toBe(true);
    for (const max of [false, 'true', 1, null]) expect(isDraft({token: 'SOL', recipient: '', amount: '1', max})).toBe(false);
    expect(isIntent({token: 'NOC', recipient: RECIPIENT, amount: 1n})).toBe(true);
    for (const bad of [{token: 'NOC', recipient: RECIPIENT, amount: 0n}, {token: 'NOC', recipient: RECIPIENT, amount: 1}, {token: 'NOC', recipient: 'nope', amount: 1n}, {token: 'NOC', recipient: RECIPIENT, amount: 2n ** 64n}]) {
      expect(isIntent(bad)).toBe(false);
    }
  });

  it('amounts as the field takes them back, exact for confirmations, fees ungrouped', () => {
    expect(plainAmount(61_546_220_000n, 9)).toBe('61.54622');
    expect(plainAmount(1_234_567_000_000_000n, 9)).toBe('1234567');
    expect(parseAmount(plainAmount(12_345_678_901n, 9), 9)).toBe(12_345_678_901n);
    expect(draftOf({token: 'USDC', recipient: RECIPIENT, amount: 12_500_000n})).toEqual({token: 'USDC', recipient: RECIPIENT, amount: '12.5'});
    expect(showExact('SOL', 2_480_000_000n)).toBe('2.4800');
    expect(showExact('SOL', 2_480_000_001n)).toBe('2.480000001');
    expect(showExact('USDC', 12_000_000n)).toBe('12.00');
    expect(showLamports(5_000n)).toBe('0.000005');
    expect(showLamports(120_000n)).toBe('0.00012');
  });

  it('MAX’s constants are core’s: base fee, compute units, the normal priority ceiling, the Noctura fee, the rent minimum', () => {
    expect(BASE_FEE_LAMPORTS).toBe(BASE_FEE_LAMPORTS_PER_SIGNATURE);
    expect(SOL_SEND_COMPUTE_UNITS).toBe(BigInt(computeUnitLimitFor({kind: 'sol'})));
    expect(PRIORITY_CEILING_MICRO_LAMPORTS).toBe(BigInt(CEILING.normal));
    expect(MARKUP_CEILING_LAMPORTS).toBe(TRANSFER_MARKUP_LAMPORTS);
    expect(RENT_EXEMPT_LAMPORTS).toBe(SYSTEM_ACCOUNT_RENT_LAMPORTS);
    expect(WORST_SOL_FEE_LAMPORTS).toBe(networkFeeLamports(1, CEILING.normal, computeUnitLimitFor({kind: 'sol'})) + TRANSFER_MARKUP_LAMPORTS);
  });

  it('MAX: an SPL token’s whole balance; SOL less the worst fee and the rent minimum, never below 0', () => {
    expect(maxSendable('NOC', 4_200_000_000_000n)).toBe(4_200_000_000_000n);
    expect(maxSendable('SOL', 62_482_100_000n)).toBe(62_482_100_000n - 45_000n - 890_880n);
    expect(maxSendable('SOL', 935_880n)).toBe(0n);
    expect(maxSendable('SOL', 100n)).toBe(0n);
  });

  // Fix round 1, item 3: the exact edges of the bound, and the worst fee the engine can actually charge.
  it('MAX at its exact edges: worst + rent → 0, one lamport more → 1, one less → 0; the ceiling fee is the worst case', () => {
    const edge = WORST_SOL_FEE_LAMPORTS + RENT_EXEMPT_LAMPORTS;
    expect(edge).toBe(935_880n);
    expect(maxSendable('SOL', edge)).toBe(0n);
    expect(maxSendable('SOL', edge + 1n)).toBe(1n);
    expect(maxSendable('SOL', edge - 1n)).toBe(0n);
    const ceilingFee = networkFeeLamports(1, CEILING.normal, computeUnitLimitFor({kind: 'sol'})) + TRANSFER_MARKUP_LAMPORTS;
    expect(ceilingFee).toBe(WORST_SOL_FEE_LAMPORTS);
    for (const balance of [edge + 1n, 62_482_100_000n]) {
      expect(balance - maxSendable('SOL', balance) - ceilingFee).toBe(RENT_EXEMPT_LAMPORTS);
    }
  });

  // Spec §8.4 / §11.5: MAX never produces a sender-below-rent amount — a property over balances and every fee the
  // engine can charge (any priority up to the ceiling, the Noctura fee charged or not).
  it('MAX never leaves 1 … 890 879 lamports, whatever the real fee (property, 5 000 cases)', () => {
    let seed = 7;
    const next = (n: number) => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) % n);
    for (let i = 0; i < 5_000; i++) {
      const balance = BigInt(next(2_000_000_000)) * BigInt(1 + next(1_000));
      const max = maxSendable('SOL', balance);
      if (max === 0n) continue;
      const price = next(Number(PRIORITY_CEILING_MICRO_LAMPORTS) + 1);
      const fee = networkFeeLamports(1, price, 1_000) + (next(2) === 0 ? 0n : TRANSFER_MARKUP_LAMPORTS);
      const remainder = balance - max - fee;
      expect(remainder >= RENT_EXEMPT_LAMPORTS).toBe(true);
    }
  });

  it('the re-authentication hint is the engine’s own function, failing closed on what #12 does not know', () => {
    const prices = {sol: 150, usdc: 1, usdt: 1, noc: 0.15, at: 0};
    const base = {known: true, token: 'SOL' as const, balance: 10_000_000_000n, prices, thresholdCents: 10_000};
    expect(predictReasons({...base, amount: 10_000_000n})).toEqual([]);
    expect(predictReasons({...base, known: false, amount: 10_000_000n})).toEqual(['first-send']);
    expect(predictReasons({...base, amount: 600_000_000n})).toEqual(['over-5-percent']);
    expect(predictReasons({...base, amount: 700_000_000n})).toEqual(['over-5-percent', 'over-usd-threshold']);
    // Unknown price, threshold or balance: above the rule, as the engine.
    expect(predictReasons({...base, prices: null, amount: 1n})).toEqual(['over-usd-threshold']);
    expect(predictReasons({...base, thresholdCents: null, amount: 1n})).toEqual(['over-usd-threshold']);
    expect(predictReasons({...base, balance: null, amount: 1n})).toEqual(['over-5-percent']);
    // NOC is valued at the stage price.
    expect(predictReasons({...base, token: 'NOC', balance: 1_000_000_000_000n, amount: 700_000_000_000n})).toContain('over-usd-threshold');
    // Parity: the same inputs through the engine's function directly.
    for (const amount of [1n, 499_999_999n, 500_000_001n, 9_900_000_000n]) {
      expect(predictReasons({...base, known: false, amount})).toEqual(sendReauthReasons({knownRecipient: false, amount, balance: base.balance, usdMicros: usdMicros(amount, 9, 150), thresholdCents: 10_000}));
    }
  });

  it('percent of balance, truncated; none for an empty or unknown balance', () => {
    expect(percentOf(12_000_000_000n, 62_482_100_000n)).toBe(19);
    expect(percentOf(1n, 0n)).toBeNull();
    expect(percentOf(1n, null)).toBeNull();
  });

  it('the fee rows, defined once: base fee, priority, new token account when non-zero, Noctura fee or its reason', () => {
    expect(feeRows({networkLamports: 125_000n, priorityLamports: 120_000n, rentLamports: 0n, markupLamports: 0n, markupReason: 'status-unknown'})).toEqual([
      {label: 'Network fee', lamports: 5_000n},
      {label: 'Priority', lamports: 120_000n},
      {label: 'No Noctura fee (status unknown)', lamports: null},
    ]);
    expect(feeRows({networkLamports: 70_000n, priorityLamports: 65_000n, rentLamports: 2_039_280n, markupLamports: 20_000n, markupReason: 'charged'})).toEqual([
      {label: 'Network fee', lamports: 5_000n},
      {label: 'Priority', lamports: 65_000n},
      {label: 'New token account', lamports: 2_039_280n},
      {label: 'Noctura fee', lamports: 20_000n},
    ]);
    // Spec §4.5 / carry 1: `charged` with a zero fee is not described (#10 refuses it; the extension cannot produce it).
    expect(feeRows({networkLamports: 5_000n, priorityLamports: 0n, rentLamports: 0n, markupLamports: 0n, markupReason: 'charged'})).toEqual([
      {label: 'Network fee', lamports: 5_000n},
      {label: 'Priority', lamports: 0n},
    ]);
    expect(Object.values(FEE_REASON_TEXT)).toEqual(['No Noctura fee before TGE', 'No Noctura fee (zero-fee eligible)', 'No Noctura fee (status unknown)']);
  });

  // Fable L4: the rows are the engine's total, nothing more or less — with the amount (SOL only) they sum
  // back to solRequiredLamports exactly as background/prepare.ts computes it.
  it('the fee rows and the amount sum back to the engine’s solRequiredLamports', () => {
    const cases = [
      {token: 'SOL' as const, amount: 12_000_000_000n, fees: {networkLamports: 25_000n, priorityLamports: 20_000n, rentLamports: 0n, markupLamports: 20_000n, markupReason: 'charged' as const}},
      {token: 'SOL' as const, amount: 1n, fees: {networkLamports: 5_000n, priorityLamports: 0n, rentLamports: 0n, markupLamports: 0n, markupReason: 'pre-tge' as const}},
      {token: 'USDC' as const, amount: 12_500_000n, fees: {networkLamports: 70_000n, priorityLamports: 65_000n, rentLamports: 2_039_280n, markupLamports: 20_000n, markupReason: 'charged' as const}},
      {token: 'NOC' as const, amount: 5n, fees: {networkLamports: 45_000n, priorityLamports: 40_000n, rentLamports: 0n, markupLamports: 0n, markupReason: 'zero-fee-eligible' as const}},
    ];
    for (const c of cases) {
      const solRequired = (c.token === 'SOL' ? c.amount : 0n) + c.fees.networkLamports + c.fees.rentLamports + c.fees.markupLamports;
      const rows = feeRows(c.fees).reduce((sum, r) => sum + (r.lamports ?? 0n), 0n);
      expect((c.token === 'SOL' ? c.amount : 0n) + rows).toBe(solRequired);
    }
  });

  it('same intent is every field equal; USD is display-only and needs a price', () => {
    const a = {token: 'SOL' as const, recipient: RECIPIENT, amount: 5n};
    expect(sameIntent(a, {...a})).toBe(true);
    expect(sameIntent(a, {...a, amount: 6n})).toBe(false);
    expect(sameIntent(a, {...a, token: 'NOC'})).toBe(false);
    expect(sameIntent(a, {...a, recipient: '11111111111111111111111111111111'})).toBe(false);
    const prices = {sol: 150, usdc: 1, usdt: 1, noc: 0.15, at: 0};
    expect(unitPrice('NOC', prices)).toBe(0.15);
    expect(unitPrice('USDT', null)).toBeUndefined();
    expect(usdOf('SOL', 2_000_000_000n, prices)).toBe(300);
    expect(usdOf('USDC', 12_500_000n, prices)).toBe(12.5);
    expect(usdOf('SOL', 1n, null)).toBeNull();
  });

  // Fix round 1, items 1–2: the local calendar is pinned, never the machine's (CI runs in UTC, where a
  // UTC-calendar bug passes). Fixtures are explicit UTC instants; each zone first proves it took effect
  // (process.env.TZ is honoured by vitest's forks pool, not by worker threads — the control fails loudly).
  function inZone(zone: string, control: {at: number; hour: number}, body: () => void): void {
    const saved = process.env.TZ;
    process.env.TZ = zone;
    try {
      expect(`${zone}: ${new Date(control.at).getHours()}`).toBe(`${zone}: ${control.hour}`);
      body();
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  }
  const UTC = Date.UTC;

  it('"Verified · sent before" with the local calendar days since (Europe/Ljubljana, UTC+2), or without a date', () => {
    inZone('Europe/Ljubljana', {at: UTC(2026, 9, 2, 7, 41), hour: 9}, () => {
      const now = UTC(2026, 9, 2, 7, 41); // Fri 2 Oct 09:41 CEST
      expect(sentBeforeText(null, now)).toBe('Verified · sent before');
      expect(sentBeforeText(UTC(2026, 9, 1, 22, 5), now)).toBe('Verified · sent before · today'); // 00:05 local; 1 Oct in UTC
      expect(sentBeforeText(UTC(2026, 9, 1, 21, 59), now)).toBe('Verified · sent before · yesterday'); // 23:59 local
      expect(sentBeforeText(UTC(2026, 8, 30, 22, 30), now)).toBe('Verified · sent before · yesterday'); // 1 Oct 00:30 local; 30 Sep in UTC
      expect(sentBeforeText(UTC(2026, 8, 20, 10, 0), now)).toBe('Verified · sent before · last 12 days ago');
    });
  });

  it('"Verified · sent before" in a far zone (Pacific/Auckland, UTC+13), across its September DST change', () => {
    inZone('Pacific/Auckland', {at: UTC(2026, 9, 1, 20, 41), hour: 9}, () => {
      const now = UTC(2026, 9, 1, 20, 41); // Fri 2 Oct 09:41 NZDT — still 1 Oct in UTC
      expect(sentBeforeText(UTC(2026, 9, 1, 11, 5), now)).toBe('Verified · sent before · today'); // 00:05 local
      expect(sentBeforeText(UTC(2026, 9, 1, 10, 59), now)).toBe('Verified · sent before · yesterday'); // 23:59 local; same UTC day
      expect(sentBeforeText(UTC(2026, 8, 20, 0, 0), now)).toBe('Verified · sent before · last 12 days ago'); // 20 Sep 12:00 NZST, a 23-hour day between
    });
  });

  it('"Verified · sent before" across a 23-hour and a 25-hour day (Europe/Ljubljana DST)', () => {
    inZone('Europe/Ljubljana', {at: UTC(2026, 2, 30, 7, 0), hour: 9}, () => {
      // 29 Mar 2026 is 23 hours long: Mon 30 Mar 09:00 CEST after Sun 29 Mar 08:00 CEST is yesterday.
      expect(sentBeforeText(UTC(2026, 2, 29, 6, 0), UTC(2026, 2, 30, 7, 0))).toBe('Verified · sent before · yesterday');
      expect(sentBeforeText(UTC(2026, 2, 20, 11, 0), UTC(2026, 2, 30, 7, 0))).toBe('Verified · sent before · last 10 days ago');
      // 25 Oct 2026 is 25 hours long: Mon 26 Oct 09:00 CET after Sun 25 Oct 12:00 CET is yesterday.
      expect(sentBeforeText(UTC(2026, 9, 25, 11, 0), UTC(2026, 9, 26, 8, 0))).toBe('Verified · sent before · yesterday');
      expect(sentBeforeText(UTC(2026, 9, 20, 10, 0), UTC(2026, 9, 26, 8, 0))).toBe('Verified · sent before · last 6 days ago');
    });
  });
});
