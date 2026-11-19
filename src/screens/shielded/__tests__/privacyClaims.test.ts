import * as fs from 'fs';
import * as path from 'path';

/**
 * The shielded screens must not claim a privacy property the scheme does not deliver today: with one
 * transparent key and a self-relayed exit, a deposit and its withdrawal can be linked by reading two
 * transactions (memory: shielded privacy guarantee). The questionnaire answer of 2026-11-05 lists the
 * claims that were removed; this test keeps them out.
 */
const UNSUPPORTED = [
  /won't be linked/i,
  /unlinkable/i,
  /not even Noctura/i,
  /onward is private/i,
  /untraceable/i,
  /fully anonymous/i,
  /Plonk/i,
];

const SCREENS = path.resolve(__dirname, '..');

function screenSources(): Array<{file: string; text: string}> {
  return fs
    .readdirSync(SCREENS)
    .filter(f => f.endsWith('.tsx'))
    .map(f => ({file: f, text: fs.readFileSync(path.join(SCREENS, f), 'utf8')}));
}

/**
 * The native unshield confirmation's strings (spec §4: "The dialog's strings live in an Android
 * resource covered by the privacy-claims guard"; M1c Task 6). Its text is what a user reads at the
 * moment of approving an exit, so it is held to the same list.
 */
const NATIVE_STRINGS = path.resolve(__dirname, '../../../../android/app/src/main/res/values/a0_confirm_strings.xml');

export function unsupportedClaims(text: string): string[] {
  return UNSUPPORTED.filter(re => re.test(text)).map(re => re.source);
}

describe('shielded screens make no unsupported privacy claim', () => {
  it('reads every shielded screen (positive control: the scan is not empty)', () => {
    expect(screenSources().length).toBeGreaterThanOrEqual(5);
  });

  it('flags each unsupported phrase (negative control)', () => {
    expect(unsupportedClaims("Recipients won't be linked to your public address.")).toEqual(["won't be linked"]);
    expect(unsupportedClaims('Sender and amount are unlinkable on-chain.')).toEqual(['unlinkable']);
    expect(unsupportedClaims('a Plonk-style proof')).toEqual(['Plonk']);
    expect(unsupportedClaims('Deposits and withdrawals are public and can be linked to your address.')).toEqual([]);
  });

  it.each(screenSources().map(s => [s.file, s.text] as const))('%s carries none of them', (_file, text) => {
    expect(unsupportedClaims(text)).toEqual([]);
  });

  it('the native confirmation strings resource carries none of them', () => {
    const xml = fs.readFileSync(NATIVE_STRINGS, 'utf8');
    // positive control: this is the dialog's resource, not an empty file
    expect(xml).toContain('name="a0_confirm_amount_line"');
    expect(xml).toContain('taken from your shielded balance');
    expect(unsupportedClaims(xml)).toEqual([]);
    // negative control: a planted claim in the same resource is flagged
    const planted = xml.replace('Confirm unshield', 'Confirm your unlinkable unshield');
    expect(planted).not.toBe(xml);
    expect(unsupportedClaims(planted)).toEqual(['unlinkable']);
  });
});
