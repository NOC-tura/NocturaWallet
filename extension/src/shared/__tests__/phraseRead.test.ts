import {PHRASE_FAILED, PHRASE_NONE, phraseRead} from '../phraseRead';

// B1e §1.2 (R9): what a screen makes of the `phrase` field it was sent. Strings that do not print, or that NFC
// changes, are \u escapes printed by a generator.
describe('phraseRead', () => {
  it('null is none; a clean phrase is shown as it is — markup included, as text', () => {
    expect(phraseRead(null)).toEqual(PHRASE_NONE);
    expect(phraseRead('Blue horse 42')).toEqual({state: 'set', phrase: 'Blue horse 42'});
    expect(phraseRead('<b>x</b>')).toEqual({state: 'set', phrase: '<b>x</b>'});
    expect(phraseRead('caf\u00e9 noir')).toEqual({state: 'set', phrase: 'caf\u00e9 noir'});
  });

  it('a field missing, of another type, or not exactly what the background stores is failed — never none, never shown', () => {
    for (const bad of [undefined, 7, true, {}, [], '', 'ab', 'x'.repeat(33), ' Blue horse 42 ', 'Blue \u202ehorse 42', 'cafe\u0301 noir']) expect([bad, phraseRead(bad)]).toEqual([bad, PHRASE_FAILED]);
  });
});
