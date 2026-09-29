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
});
