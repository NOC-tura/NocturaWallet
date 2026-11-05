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
});
