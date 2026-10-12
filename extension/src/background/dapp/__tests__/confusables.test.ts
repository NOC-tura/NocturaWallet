import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CONFUSABLES} from '../confusables';

// Spec §2.5: the table is generated from Unicode's confusables.txt 16.0.0 — never edited by hand (the plan's script).
describe('confusables.ts', () => {
  it('maps the homoglyphs the lookalike rules meet to their Latin prototypes', () => {
    expect(CONFUSABLES.get(0x430)).toBe('a'); // Cyrillic \u0430
    expect(CONFUSABLES.get(0x3bf)).toBe('o'); // Greek \u03BF
    expect(CONFUSABLES.get(0x43e)).toBe('o'); // Cyrillic \u043E
    expect(CONFUSABLES.get(0x6d)).toBe('rn'); // confusables.txt's own prototype for m
    expect(CONFUSABLES.get(0x31)).toBe('l');
    expect(CONFUSABLES.size).toBe(792);
    // Every target is Latin a–z / 0–9 only.
    for (const t of CONFUSABLES.values()) expect(t).toMatch(/^[a-z0-9]+$/);
  });

  it('is the generator output, byte for byte (the hash the plan pins)', () => {
    const text = readFileSync(join(__dirname, '..', 'confusables.ts'), 'utf8');
    expect(createHash('sha256').update(text).digest('hex')).toBe('64a02d1dad7cae885ee239a81f81ad87cc2703b8751f0da6e5be05ae3377fba1');
  });
});
