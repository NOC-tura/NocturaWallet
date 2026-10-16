import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {IDL_SHA256, OUTPUT_SHA256, OUT_PATH, PROGRAM_ID, presaleSource} from '../gen-presale-idl.mjs';
import {PRESALE_INSTRUCTIONS, STAKE_TIERS} from '../../src/background/dapp/decode/presaleIdl';

// Global constraints (plan 2 review 1 M2): presaleIdl.ts is generated only — it must be exactly what the committed
// generator writes. The IDL itself is in the ICO repository, which CI does not have: the table's own content, turned
// back into the IDL's shape, must give the committed file byte for byte, and the file must hash to the pinned output.
const idlOf = (instructions, tiers) => ({
  address: PROGRAM_ID,
  instructions: instructions.map(ix => ({
    name: ix.name,
    discriminator: [...ix.discriminator],
    args: ix.args.map(a => ({name: a.name, type: a.type === 'tier' ? {defined: {name: 'StakeTier'}} : typeof a.type === 'object' ? {array: ['u8', a.type.bytes]} : a.type})),
    accounts: ix.accounts.map(name => ({name})),
  })),
  types: [{name: 'StakeTier', type: {kind: 'enum', variants: tiers.map(name => ({name}))}}],
});

describe('the presale IDL generator', () => {
  it('presaleIdl.ts hashes to the generator’s pinned OUTPUT_SHA256', () => {
    expect(createHash('sha256').update(readFileSync(OUT_PATH)).digest('hex')).toBe(OUTPUT_SHA256);
  });

  it('presaleIdl.ts is byte for byte presaleSource() of its own content (no IDL file needed)', () => {
    expect(presaleSource(idlOf(PRESALE_INSTRUCTIONS, STAKE_TIERS), IDL_SHA256)).toBe(readFileSync(OUT_PATH, 'utf8'));
  });

  // Negative controls: a changed table gives a different file; another program and a wrong discriminator are refused.
  it('a changed instruction gives a different presaleIdl.ts; another program or a wrong discriminator is refused (negative controls)', () => {
    const renamed = PRESALE_INSTRUCTIONS.map((ix, i) => (i === 0 ? {...ix, accounts: [...ix.accounts, 'extra']} : ix));
    expect(presaleSource(idlOf(renamed, STAKE_TIERS), IDL_SHA256)).not.toBe(readFileSync(OUT_PATH, 'utf8'));
    expect(() => presaleSource({...idlOf(PRESALE_INSTRUCTIONS, STAKE_TIERS), address: '11111111111111111111111111111111'}, IDL_SHA256)).toThrow('another program');
    const wrong = PRESALE_INSTRUCTIONS.map((ix, i) => (i === 0 ? {...ix, discriminator: ix.discriminator.map((b, j) => (j === 0 ? b ^ 1 : b))} : ix));
    expect(() => presaleSource(idlOf(wrong, STAKE_TIERS), IDL_SHA256)).toThrow('discriminator of');
  });
});
