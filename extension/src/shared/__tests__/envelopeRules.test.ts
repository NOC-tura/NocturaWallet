import {base64} from '@scure/base';
import {ENVELOPE_BYTES, MAX_ACCOUNTS, MAX_NAME_LENGTH, b64Length, cleanName} from '../envelopeRules';

describe('envelope rules shared by the vault page and the background', () => {
  it('pins the limits', () => {
    expect(MAX_ACCOUNTS).toBe(100);
    expect(MAX_NAME_LENGTH).toBe(32);
    expect(ENVELOPE_BYTES).toEqual({salt: 16, iv: 12, minCt: 17, wrapped: 40, prfSalt: 32, minCredentialId: 1});
  });

  it('b64Length is the decoded length of strict base64, null for anything else', () => {
    expect(b64Length(base64.encode(new Uint8Array(40)))).toBe(40);
    expect(b64Length('')).toBe(0);
    for (const bad of ['not base64!', 'AAA', 'AA=A', 7, null, undefined]) expect(b64Length(bad)).toBeNull();
  });

  it('cleanName trims, and refuses empty, long, control and bidi-override names', () => {
    expect(cleanName('  Savings  ')).toBe('Savings');
    expect(cleanName('x'.repeat(MAX_NAME_LENGTH))).toBe('x'.repeat(MAX_NAME_LENGTH));
    for (const bad of ['', '   ', 'x'.repeat(MAX_NAME_LENGTH + 1), 'a\nb', 'a\u202eb', 'a\u2066b', 3]) expect(cleanName(bad)).toBeNull();
  });

  // B1b-2b C19 (review L8, rev 3 L5): every control and format character by Unicode category, and the two invisible Mn
  // marks named beside them \u2014 each inside a name (a leading or trailing U+FEFF is whitespace to trim()).
  it('C19: refuses every format character and the invisible marks \u2014 "Mo\u200bm" is not "Mom"', () => {
    const FORMAT = [0x00ad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff, 0x061c, 0x180e, 0x034f, 0xfe00, 0xfe0f, 0xe0041];
    for (const cp of FORMAT) expect([cp.toString(16), cleanName(`Mo${String.fromCodePoint(cp)}m`)]).toEqual([cp.toString(16), null]);
    // C0, DEL and C1 controls by category too.
    for (const cp of [0x00, 0x1f, 0x7f, 0x80, 0x9f]) expect(cleanName(`a${String.fromCodePoint(cp)}b`)).toBeNull();
    expect(cleanName('Mom')).toBe('Mom');
  });

  it('C19: accepts ordinary text in any script, punctuation and emoji \u2014 names are not otherwise normalised', () => {
    for (const ok of ['Marko \u00b7 Mom', 'Bistro Ljubljana', '\u017diga', '\u039c\u03b1\u03c1\u03af\u03b1', '\u0418\u0432\u0430\u043d', '\u674e\u96f7', 'caf\u00e9', 'Cold storage \ud83d\udd12', "O'Brien-Smith"]) expect(cleanName(ok)).toBe(ok);
  });

  // Rev 3, review L4: the stated limit, pinned \u2014 a cross-script look-alike is a different, accepted name. Changing this is a
  // decision (spec C19), not an accident.
  it('C19 limit: "\u0412inance" (Cyrillic \u0412) is accepted beside "Binance" \u2014 confusables are not caught here', () => {
    expect(cleanName('\u0412inance')).toBe('\u0412inance');
    expect('\u0412inance'.normalize('NFKC')).not.toBe('Binance');
  });
});
