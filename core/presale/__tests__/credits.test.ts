import {attributeCredits, type CreditLog} from '../credits';

const ME = 'F3szUSp2gFpWA3qbHGkfx5TYnYe56KqnmRbptmiqHyjj';
const SOMEONE_ELSE = 'GpyRax3nzk9Wroq48npo9yzfp28CTbQuksqma6TVay11';

const tx = (signature: string, blockTime: number, ...logs: string[]): CreditLog => ({
  signature,
  blockTime,
  logs: logs.map(l => `Program log: ${l}`),
});

describe('attributeCredits', () => {
  it('attributes a giveaway that names this wallet', () => {
    // The mainnet case of 2026-09-23: one transaction, the whole allocation.
    const out = attributeCredits(
      [tx('jS8QcY', 1, `ADMIN_GIVEAWAY: Added 188607594936 tokens to user ${ME} (total allocation: 188607594936)`)],
      ME,
      188_607_594_936n,
    );
    expect(out).toEqual([
      {kind: 'giveaway', base: 188_607_594_936n, signature: 'jS8QcY', blockTime: 1},
    ]);
  });

  it('ignores a giveaway that names somebody else', () => {
    const out = attributeCredits(
      [tx('x', 1, `ADMIN_GIVEAWAY: Added 5 tokens to user ${SOMEONE_ELSE} (total allocation: 5)`)],
      ME,
      0n,
    );
    expect(out).toEqual([]);
  });

  it('adds referral awards and a giveaway to the exact field value', () => {
    // GpyRax3n on mainnet: 80.539640239 awarded across four purchases plus a
    // 40.247084996 giveaway = 120.786725235, which is what the account holds.
    const out = attributeCredits(
      [
        tx('a', 4, 'One-time referral bonus awarded: 16142571618 tokens'),
        tx('b', 3, 'One-time referral bonus awarded: 24000000000 tokens'),
        tx('c', 2, 'One-time referral bonus awarded: 40397068621 tokens'),
        tx('d', 1, `ADMIN_GIVEAWAY: Added 40247084996 tokens to user ${ME} (total allocation: 1)`),
      ],
      ME,
      120_786_725_235n,
    );
    expect(out?.map(c => c.signature)).toEqual(['a', 'b', 'c', 'd']);
    expect(out?.reduce((s, c) => s + c.base, 0n)).toBe(120_786_725_235n);
  });

  it('RETURNS NULL when a referral line belongs to someone else', () => {
    // THE test. A purchase transaction touches the buyer's allocation AND the referrer's,
    // and the referral log names nobody — so walking a BUYER's account finds tokens that
    // went to their referrer. The buyer's own field is 0, the sum is not, and rather than
    // show them a credit they never received the itemisation is withheld entirely.
    const out = attributeCredits(
      [tx('buy', 1, 'Instruction: PresalePurchaseWithSol', 'One-time referral bonus awarded: 16142571618 tokens')],
      ME,
      0n,
    );
    expect(out).toBeNull();
  });

  it('returns null on any mismatch, over or under', () => {
    const one = [tx('a', 1, 'One-time referral bonus awarded: 100 tokens')];
    expect(attributeCredits(one, ME, 99n)).toBeNull();
    expect(attributeCredits(one, ME, 101n)).toBeNull();
    // The positive control: the same input reconciles when the field agrees.
    expect(attributeCredits(one, ME, 100n)).toHaveLength(1);
  });

  it('does not mistake the lines that award nothing', () => {
    // These appear in the same logs and mean the opposite. Matching them would invent
    // credits out of a refusal to grant one.
    const out = attributeCredits(
      [
        tx('a', 2, 'Referral bonus skipped - not first purchase'),
        tx('b', 1, 'Referral pool exhausted - no bonus awarded'),
        // Cross-chain: a DIFFERENT account and field, and the wording has no "awarded".
        tx('c', 3, 'One-time referral bonus: 500 tokens'),
      ],
      ME,
      0n,
    );
    expect(out).toEqual([]);
  });

  it('newest first, and an empty history reconciles with a zero field', () => {
    expect(attributeCredits([], ME, 0n)).toEqual([]);
    const out = attributeCredits(
      [
        tx('old', 100, 'One-time referral bonus awarded: 1 tokens'),
        tx('new', 200, 'One-time referral bonus awarded: 2 tokens'),
      ],
      ME,
      3n,
    );
    expect(out?.map(c => c.signature)).toEqual(['new', 'old']);
  });
});
