/**
 * Shielded UX part B (spec §2 row 9, §4 "Native confirmation"): the Android dialog cannot import
 * src/copy/modes.ts, so this holds its resource equal to the module, and free of the banned words.
 */
import * as fs from 'fs';
import * as path from 'path';
import {NATIVE_CONFIRM_TITLE, NATIVE_FEE_LINE, NATIVE_PROMPT_SUBTITLE, NATIVE_PROMPT_TITLE} from '../modes';
import {BANNED_WORDS} from '../__testing__/copyScan';

const XML = fs.readFileSync(path.resolve(__dirname, '../../../android/app/src/main/res/values/a0_confirm_strings.xml'), 'utf8');

function value(name: string): string {
  const m = new RegExp(`<string name="${name}">([^<]*)</string>`).exec(XML);
  if (m === null) throw new Error(`no string ${name}`);
  return m[1]!;
}

describe('the native confirmation resource speaks the one vocabulary', () => {
  it('the four strings equal the module', () => {
    expect(value('a0_confirm_title')).toBe(NATIVE_CONFIRM_TITLE);
    expect(value('a0_confirm_fee_line')).toBe(NATIVE_FEE_LINE);
    expect(value('a0_prompt_title')).toBe(NATIVE_PROMPT_TITLE);
    expect(value('a0_prompt_subtitle')).toBe(NATIVE_PROMPT_SUBTITLE);
  });

  it('no string value carries a banned word (positive control: the scan sees ten strings)', () => {
    const values = [...XML.matchAll(/<string name="[^"]+">([^<]*)<\/string>/g)].map(m => m[1]!);
    expect(values.length).toBe(10);
    expect(values.filter(v => BANNED_WORDS.test(v))).toEqual([]);
  });
});
