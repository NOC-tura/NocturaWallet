import {readFileSync} from 'node:fs';
import {ICON_PATH, PNG_PATH, iconSource} from '../gen-icon.mjs';

// Global constraints: src/provider/icon.ts is generated only — it must be exactly what the committed generator writes.
describe('the icon generator', () => {
  it('src/provider/icon.ts is byte for byte gen-icon.mjs’s output for web/public/noc-mark.png', () => {
    expect(readFileSync(ICON_PATH, 'utf8')).toBe(iconSource(readFileSync(PNG_PATH)));
  });

  // Negative control: a different PNG (one byte changed) gives a different file.
  it('a changed mark gives a different icon.ts (negative control)', () => {
    const png = Buffer.from(readFileSync(PNG_PATH));
    png[png.length - 1] ^= 1;
    expect(iconSource(png)).not.toBe(readFileSync(ICON_PATH, 'utf8'));
  });
});
