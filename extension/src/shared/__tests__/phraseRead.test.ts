import {PHRASE_FAILED, PHRASE_NONE, phraseRead} from '../phraseRead';
import {readPhraseLine} from '../../unlock/view/phraseLine';

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

  // Task 5 fix round 1 (Minor 3): readers return fresh objects — nothing hands out a module-level value to mutate.
  it('every read is its own object: changing one leaves the next read, and the frozen constants, as they were', async () => {
    expect([Object.isFrozen(PHRASE_NONE), Object.isFrozen(PHRASE_FAILED)]).toEqual([true, true]);
    for (const field of [null, undefined, 'Blue horse 42']) {
      const first = phraseRead(field);
      const again = phraseRead(field);
      expect(first).not.toBe(again);
      (first as {state: string}).state = 'changed';
      expect([field, phraseRead(field)]).toEqual([field, again]);
    }
    const reads = [async () => Promise.reject(new Error('no answer')), async () => ({ok: false, error: 'failed'})];
    for (const send of reads) {
      const first = await readPhraseLine(send);
      (first as {state: string}).state = 'changed';
      expect(await readPhraseLine(send)).toEqual(PHRASE_FAILED);
    }
    expect([PHRASE_NONE, PHRASE_FAILED]).toEqual([{state: 'none'}, {state: 'failed'}]);
  });
});
