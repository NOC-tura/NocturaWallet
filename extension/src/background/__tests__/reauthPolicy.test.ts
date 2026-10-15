import {dappReauthReasons, sendReauthReasons, usdMicros} from '../reauthPolicy';

const base = {knownRecipient: true, amount: 10n, balance: 1_000n, usdMicros: 1_000_000n, thresholdCents: 10_000};

describe('usdMicros', () => {
  it('values an amount in micro-dollars, in BigInt', () => {
    expect(usdMicros(500_000_000n, 9, 150)).toBe(75_000_000n);
    expect(usdMicros(1_000_000n, 6, 1)).toBe(1_000_000n);
  });

  it('is null — "unknown" — without a usable price', () => {
    for (const p of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(usdMicros(1n, 9, p)).toBeNull();
  });

  it('scales the price at 1e-12 precision, so a sub-micro-dollar price is exact, not rounded away', () => {
    // 1e12 whole tokens at $0.0000004 = $400 000.
    expect(usdMicros(10n ** 21n, 9, 4e-7)).toBe(400_000_000_000n);
    // 1e6 whole tokens at $0.0000014 = $1.40 (a micro-dollar price scale would say $1.00).
    expect(usdMicros(10n ** 15n, 9, 1.4e-6)).toBe(1_400_000n);
    expect(usdMicros(10n ** 9n, 9, 0.1501)).toBe(150_100n);
  });

  it('a non-zero price too small to represent is unknown (null), never $0', () => {
    expect(usdMicros(10n ** 30n, 9, 1e-13)).toBeNull();
  });

  it('refuses a negative amount', () => {
    expect(() => usdMicros(-1n, 9, 150)).toThrow(RangeError);
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

  it('the whole-balance bound is 99 %: just under it does not flag', () => {
    expect(sendReauthReasons({...base, knownRecipient: false, amount: 989n})).toEqual(['first-send', 'over-5-percent']);
  });

  it('refuses a negative amount (throws: the send fails closed instead of being judged)', () => {
    expect(() => sendReauthReasons({...base, amount: -1n})).toThrow(RangeError);
    expect(() => sendReauthReasons({...base, knownRecipient: false, amount: -1_000n})).toThrow(RangeError);
  });

  it('the whole balance to a first-time address', () => {
    expect(sendReauthReasons({...base, knownRecipient: false, amount: 990n})).toEqual(['first-send', 'over-5-percent', 'whole-balance-to-new']);
    expect(sendReauthReasons({...base, knownRecipient: true, amount: 1_000n})).toEqual(['over-5-percent']);
  });
});

// B1c-2 (spec B1c §3.3, B1 §3): B1b's rules for a dApp's transaction, from its balance changes and its instructions.
describe('dappReauthReasons', () => {
  const quiet = {outgoing: [{amount: 10n, balance: 1_000n, usdMicros: 1_000_000n}], firstSend: false, approval: false, thresholdCents: 10_000};
  it('positive control: a small outgoing amount, known recipients, no approval, a known price under the threshold — nothing', () => {
    expect(dappReauthReasons(quiet)).toEqual([]);
    expect(dappReauthReasons({...quiet, outgoing: []})).toEqual([]);
  });
  it('each rule by itself', () => {
    expect(dappReauthReasons({...quiet, firstSend: true})).toEqual(['first-send']);
    expect(dappReauthReasons({...quiet, outgoing: [{amount: 51n, balance: 1_000n, usdMicros: 1n}]})).toEqual(['over-5-percent']);
    expect(dappReauthReasons({...quiet, outgoing: [{amount: 50n, balance: 1_000n, usdMicros: 1n}]})).toEqual([]);
    expect(dappReauthReasons({...quiet, outgoing: [{amount: 1n, balance: 1_000n, usdMicros: 100_000_001n}]})).toEqual(['over-usd-threshold']);
    expect(dappReauthReasons({...quiet, approval: true})).toEqual(['approval']);
  });
  it('fails closed: no price is above the threshold, a zero balance is above 5 %', () => {
    expect(dappReauthReasons({...quiet, outgoing: [{amount: 1n, balance: 1_000n, usdMicros: null}]})).toEqual(['over-usd-threshold']);
    expect(dappReauthReasons({...quiet, outgoing: [{amount: 1n, balance: 0n, usdMicros: 1n}]})).toEqual(['over-5-percent']);
  });
  it('the whole balance to a first-time address adds its own reason', () => {
    expect(dappReauthReasons({...quiet, firstSend: true, outgoing: [{amount: 990n, balance: 1_000n, usdMicros: 1n}]})).toEqual(['first-send', 'over-5-percent', 'whole-balance-to-new']);
    expect(dappReauthReasons({...quiet, firstSend: false, outgoing: [{amount: 990n, balance: 1_000n, usdMicros: 1n}]})).toEqual(['over-5-percent']);
  });
  it('a zero or incoming amount is not outgoing', () => {
    expect(dappReauthReasons({...quiet, outgoing: [{amount: 0n, balance: 0n, usdMicros: null}]})).toEqual([]);
  });
});
