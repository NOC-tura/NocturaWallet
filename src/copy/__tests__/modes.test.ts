/**
 * Shielded UX part B, spec §2 (decision B-1): the one vocabulary, verbatim, and its honesty rows.
 * Every expected string is the spec's text typed out here, never read back from the module.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as modes from '../modes';
import {bannedStrings, forbiddenClaims, userVisibleStrings} from '../__testing__/copyScan';

const FILE = path.resolve(__dirname, '../modes.ts');
const SRC = fs.readFileSync(FILE, 'utf8');

describe('src/copy/modes.ts — the §2 table', () => {
  it('the terms, verbatim', () => {
    expect(modes.MODE_PUBLIC).toBe('Public');
    expect(modes.MODE_PRIVATE).toBe('Private');
    expect(modes.MAKE_PRIVATE).toBe('Make private');
    expect(modes.MAKE_PUBLIC).toBe('Make public');
    expect(modes.PRIVATE_PUBLIC_TITLE).toBe('Private ⇄ Public');
    expect(modes.PRIVATE_BALANCE).toBe('Private balance');
    expect(modes.PUBLIC_BALANCE).toBe('Public balance');
    expect(modes.PRIVATE_ASSETS).toBe('Private assets'); // the overline variant renders "PRIVATE ASSETS"
    expect(modes.PRIVATE_SUFFIX).toBe(' · private');
    expect(modes.PRIVATE_MARK).toBe('Private'); // the overline renders "PRIVATE"
    expect(modes.MAKING_PUBLIC).toBe('Making public…');
    expect(modes.NOW_PUBLIC).toBe('Now public');
    expect(modes.MAKING_PRIVATE).toBe('Making private…');
    expect(modes.NOW_PRIVATE).toBe('Now private');
    expect(modes.NATIVE_CONFIRM_TITLE).toBe('Confirm making public');
    expect(modes.NATIVE_PROMPT_TITLE).toBe('Approve making this public');
    expect(modes.NATIVE_PROMPT_SUBTITLE).toBe('Confirm it is you to authorize this one transfer to public');
    expect(modes.NATIVE_FEE_LINE).toBe('Relayer fee %1$s %2$s, taken from your private balance');
    expect(modes.DETAILS).toBe('Details');
    expect(modes.DESTINATION_FRESH).toBe('A new account');
    expect(modes.DESTINATION_MAIN).toBe('My main account');
    expect(modes.DESTINATION_EXTERNAL).toBe('Another address');
    expect(modes.DESTINATION_EXTERNAL_SUB).toBe('A wallet address outside this wallet');
    expect(modes.RECOMMENDED).toBe(' (recommended)');
    expect(modes.CHANGE).toBe('Change');
    expect(modes.DESTINATION_NONE).toBe('Choose a destination'); // owner decision A1
  });

  it('the CTAs: with an amount, and the disabled form without one', () => {
    expect(modes.makePublicCta('1.25', 'TEST')).toBe('Make 1.25 TEST public');
    expect(modes.makePrivateCta('1.25', 'TEST')).toBe('Make 1.25 TEST private');
    expect(modes.makePublicCtaIdle('TEST')).toBe('Make TEST public');
    expect(modes.makePrivateCtaIdle('TEST')).toBe('Make TEST private');
  });

  it('AmountLimitHint and DestinationRow lines (spec §3.3, §3.4)', () => {
    expect(modes.makePublicLimit('1.99999', 'TEST')).toBe('You can make up to 1.99999 TEST public at once.');
    expect(modes.destinationSummary('A new account (recommended)')).toBe('To: A new account (recommended)');
    expect(modes.destinationSummary(null)).toBe('To: Choose a destination'); // owner decision A1: nothing preselected
  });

  it('the Private balance card keeps the honest sentence (spec §2 "Kept as is")', () => {
    expect(modes.PRIVATE_CARD_BODY).toBe('Make private moves tokens in with a proof made on this device. Deposits are public on chain.');
  });
});

describe('src/copy/modes.ts — honesty', () => {
  it('the scan reads the module (positive control: it is not empty)', () => {
    expect(userVisibleStrings('src/copy/modes.ts', SRC).length).toBeGreaterThanOrEqual(25);
  });

  it('no string of the module carries a banned word', () => {
    expect(bannedStrings('src/copy/modes.ts', SRC)).toEqual([]);
  });

  it('spec §2 "Forbidden": nothing the module says implies anonymous, untraceable, invisible, fully private, no one can see', () => {
    expect(forbiddenClaims('src/copy/modes.ts', SRC)).toEqual([]);
  });

  it('negative controls: each forbidden phrase is caught in a string; an honest one and a comment are not', () => {
    expect(forbiddenClaims('f.ts', "const a = 'Your transfer is anonymous';")).toEqual(['anonymous']);
    expect(forbiddenClaims('f.ts', "const a = 'Untraceable by design';")).toEqual(['untraceable']);
    expect(forbiddenClaims('f.ts', "const a = 'Invisible on chain';")).toEqual(['invisible']);
    expect(forbiddenClaims('f.ts', "const a = 'It is fully private';")).toEqual(['fully private']);
    expect(forbiddenClaims('f.ts', "const a = 'No one can see it';")).toEqual(['no one can see']);
    // review M-2 / I-5: what IMPLIES it, too
    expect(forbiddenClaims('f.ts', 'const a = "It can\'t be traced";')).toHaveLength(1);
    expect(forbiddenClaims('f.ts', "const a = 'It cannot be traced';")).toHaveLength(1);
    expect(forbiddenClaims('f.ts', "const a = 'Hidden from everyone';")).toEqual(['hidden from everyone']);
    expect(forbiddenClaims('f.ts', "const a = 'Amounts and parties stay private on-chain.';")).toEqual(['stays? private on-?chain']);
    expect(forbiddenClaims('f.ts', "// anonymous, in a comment\nconst a = 'Deposits are public on chain.';")).toEqual([]);
  });
});
