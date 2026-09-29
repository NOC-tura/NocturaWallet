import {sendReauthReasons, usdMicros} from '../reauthPolicy';

const base = {knownRecipient: true, amount: 10n, balance: 1_000n, usdMicros: 1_000_000n, thresholdCents: 10_000};

describe('usdMicros', () => {
  it('values an amount in micro-dollars, in BigInt', () => {
    expect(usdMicros(500_000_000n, 9, 150)).toBe(75_000_000n);
    expect(usdMicros(1_000_000n, 6, 1)).toBe(1_000_000n);
  });

  it('is null — "unknown" — without a usable price', () => {
    for (const p of [undefined, 0, -1, Number.NaN]) expect(usdMicros(1n, 9, p)).toBeNull();
  });
});

describe('sendReauthReasons (spec §2, §3)', () => {
  it('asks nothing for a small send to a known address (positive control)', () => {
    expect(sendReauthReasons(base)).toEqual([]);
  });

  it('first send to a new address', () => {
    expect(sendReauthReasons({...base, knownRecipient: false})).toEqual(['first-send']);
  });

  it('above 5 % of the balance — exactly 5 % is not above', () => {
    expect(sendReauthReasons({...base, amount: 50n})).toEqual([]);
    expect(sendReauthReasons({...base, amount: 51n})).toEqual(['over-5-percent']);
    expect(sendReauthReasons({...base, balance: 0n})).toEqual(['over-5-percent']);
  });

  it('above the dollar threshold — and a missing price counts as above', () => {
    expect(sendReauthReasons({...base, usdMicros: 100_000_000n})).toEqual([]);
    expect(sendReauthReasons({...base, usdMicros: 100_000_001n})).toEqual(['over-usd-threshold']);
    expect(sendReauthReasons({...base, usdMicros: null})).toEqual(['over-usd-threshold']);
  });

  it('the whole balance to a first-time address', () => {
    expect(sendReauthReasons({...base, knownRecipient: false, amount: 990n})).toEqual(['first-send', 'over-5-percent', 'whole-balance-to-new']);
    expect(sendReauthReasons({...base, knownRecipient: true, amount: 1_000n})).toEqual(['over-5-percent']);
  });
});
