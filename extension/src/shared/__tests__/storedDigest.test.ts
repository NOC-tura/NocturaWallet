import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {storedDigest, storedText} from '../storedDigest';
import {DELETABLE, fixtureEnvelope} from './vaultControls';

// B1e §2.3, §2.4: the digest is sha256 of the UTF-8 bytes of JSON.stringify of the stored value — checked here against
// node:crypto, not against the module's own helpers.
const independent = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');

describe('storedText / storedDigest', () => {
  it('the text is JSON.stringify of the value, keys in stored order; the digest its sha256, lowercase hex', () => {
    for (const raw of [fixtureEnvelope(), ...DELETABLE.map(([, v]) => v), {b: 1, a: 2}, {name: 'é\u{1F600}'}]) {
      expect(storedText(raw)).toBe(JSON.stringify(raw));
      expect(storedDigest(raw)).toBe(independent(raw));
      expect(storedDigest(raw)).toMatch(/^[0-9a-f]{64}$/);
    }
    // Key order is part of the text: the same object reordered is another digest.
    expect(storedDigest({a: 1, b: 2})).not.toBe(storedDigest({b: 2, a: 1}));
  });

  it('a lone surrogate is escaped by JSON.stringify, so the text is well formed and its bytes are those hashed', () => {
    const raw = {v: 1, accounts: [{index: 0, name: '\uD800', publicKey: 'x'}]};
    expect(storedText(raw)).toContain('\\ud800');
    expect(storedDigest(raw)).toBe(independent(raw));
  });

  it('undefined (no wallet) has no text: it throws, never a digest', () => {
    expect(() => storedText(undefined)).toThrow(TypeError);
    expect(() => storedDigest(undefined)).toThrow(TypeError);
  });

  it('imports only @noble/hashes (the vault page and the background both carry it)', () => {
    const src = readFileSync(join(__dirname, '..', 'storedDigest.ts'), 'utf8');
    expect([...src.matchAll(/^import .* from '([^']+)';$/gm)].map(m => m[1])).toEqual(['@noble/hashes/sha2.js', '@noble/hashes/utils.js']);
  });
});
