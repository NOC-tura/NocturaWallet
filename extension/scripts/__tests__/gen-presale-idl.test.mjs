import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {IDL_SHA256, LAYOUTS_PATH, LAYOUTS_SHA256, LAYOUT_ACCOUNTS, OUTPUT_SHA256, OUT_PATH, PROGRAM_ID, layoutsSource, presaleSource} from '../gen-presale-idl.mjs';
import {PRESALE_INSTRUCTIONS, STAKE_TIERS} from '../../src/background/dapp/decode/presaleIdl';
import * as LAYOUTS from '../../src/background/presale/layouts';

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

// B1d §2.1: layouts.ts is the generator's second output from the same pinned IDL — generated only, hash-pinned, and
// rebuilt here from its own content (CI has no IDL). The IDL's shape for accounts: `accounts` carries each account's
// discriminator, `types` its struct's fields in order.
const layoutIdlOf = layouts => ({
  address: PROGRAM_ID,
  accounts: layouts.map(l => ({name: l.name, discriminator: [...l.discriminator]})),
  types: layouts.map(l => ({name: l.name, type: {kind: 'struct', fields: Object.entries(l.fields).map(([name, f]) => ({name, type: f.type}))}})),
});
const GENERATED = LAYOUT_ACCOUNTS.map(([, constant]) => LAYOUTS[constant]);

describe('the presale IDL generator — account layouts (B1d §2.1)', () => {
  it('layouts.ts hashes to the generator’s pinned LAYOUTS_SHA256', () => {
    expect(createHash('sha256').update(readFileSync(LAYOUTS_PATH)).digest('hex')).toBe(LAYOUTS_SHA256);
  });

  it('layouts.ts is byte for byte layoutsSource() of its own content (no IDL file needed) — Config, PresaleAllocation, UserAccount', () => {
    expect(LAYOUT_ACCOUNTS.map(([name]) => name)).toEqual(['Config', 'PresaleAllocation', 'UserAccount']);
    expect(GENERATED.map(l => l.name)).toEqual(['Config', 'PresaleAllocation', 'UserAccount']);
    expect(layoutsSource(layoutIdlOf(GENERATED), IDL_SHA256)).toBe(readFileSync(LAYOUTS_PATH, 'utf8'));
  });

  it('a wrong account discriminator is refused — the generator recomputes sha256("account:<Name>") (negative control)', () => {
    for (const i of [0, 1, 2]) {
      const wrong = GENERATED.map((l, j) => (j === i ? {...l, discriminator: l.discriminator.map((b, k) => (k === 7 ? b ^ 1 : b))} : l));
      expect(() => layoutsSource(layoutIdlOf(wrong), IDL_SHA256)).toThrow(`discriminator of account ${GENERATED[i].name}`);
    }
  });

  it('u32 is accepted (purchase_count); any other type throws, naming the field; another program or a missing account is refused', () => {
    expect(readFileSync(LAYOUTS_PATH, 'utf8')).toContain("purchase_count: {offset: 56, type: 'u32'}");
    const typed = type => GENERATED.map((l, j) => (j === 2 ? {...l, fields: {...l.fields, has_staked: {offset: 41, type}}} : l));
    for (const type of ['u16', 'u128', 'i32', 'string']) expect(() => layoutsSource(layoutIdlOf(typed(type)), IDL_SHA256)).toThrow('of UserAccount.has_staked');
    const arrayType = layoutIdlOf(GENERATED);
    arrayType.types[0].type.fields[0].type = {array: ['u8', 32]};
    expect(() => layoutsSource(arrayType, IDL_SHA256)).toThrow('of Config.admin');
    expect(() => layoutsSource({...layoutIdlOf(GENERATED), address: '11111111111111111111111111111111'}, IDL_SHA256)).toThrow('another program');
    expect(() => layoutsSource(layoutIdlOf(GENERATED.slice(0, 2)), IDL_SHA256)).toThrow('no account UserAccount');
  });

  it('a changed field gives a different layouts.ts, with every later offset moved (negative control)', () => {
    const inserted = GENERATED.map((l, j) => (j === 1 ? {...l, fields: {extra: {offset: 0, type: 'u8'}, ...l.fields}} : l));
    const out = layoutsSource(layoutIdlOf(inserted), IDL_SHA256);
    expect(out).not.toBe(readFileSync(LAYOUTS_PATH, 'utf8'));
    expect(out).toContain("referrer: {offset: 85, type: 'pubkey'}");
    expect(out).toContain('length: 118,');
  });
});
