import {createHash} from 'node:crypto';
import {PRESALE_INSTRUCTIONS, STAKE_TIERS} from '../presaleIdl';

// Spec B1c §3.3: the presale program is decoded by its Anchor discriminators, from the program's IDL (generated,
// never typed — scripts/gen-presale-idl.mjs, from the ICO repository's lib/idl.json; scripts/__tests__/gen-presale-idl.test.mjs
// checks the file is that script's output).
describe('presaleIdl.ts', () => {
  it('every discriminator is sha256("global:" + name)[0..8] (Anchor’s rule), each name once', () => {
    for (const ix of PRESALE_INSTRUCTIONS) {
      const expected = [...createHash('sha256').update(`global:${ix.name}`).digest().subarray(0, 8)];
      expect([ix.name, ix.discriminator]).toEqual([ix.name, expected]);
    }
    expect(new Set(PRESALE_INSTRUCTIONS.map(i => i.name)).size).toBe(PRESALE_INSTRUCTIONS.length);
    expect(PRESALE_INSTRUCTIONS.length).toBe(36);
    expect(STAKE_TIERS).toEqual(['TierA', 'TierB', 'TierC']);
  });

  it('carries the instructions the wallet and the web build (core/presale/buyInstructions.ts)', () => {
    const sol = PRESALE_INSTRUCTIONS.find(i => i.name === 'presale_purchase_with_sol');
    expect(sol?.discriminator).toEqual([161, 153, 65, 238, 160, 236, 43, 165]);
    expect(PRESALE_INSTRUCTIONS.find(i => i.name === 'register_referrer')?.discriminator).toEqual([122, 229, 215, 169, 100, 145, 198, 120]);
  });
});
