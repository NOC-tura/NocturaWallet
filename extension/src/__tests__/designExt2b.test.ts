import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// B1b-2b §1.6: design-ext.css regenerated from index.html with plan 1's prefixes — never by hand. The ring is not
// copied (C15: no score, no ring).
const CSS = readFileSync(join(__dirname, '..', 'styles', 'design-ext.css'), 'utf8');

describe('design-ext.css (B1b-2b plan 1)', () => {
  it('carries the settings and security classes, and not the score ring', () => {
    for (const sel of ['.s7-picker .opt.sel', '.s7-tip svg', '.s7-score-card', '.s7-task .label', '.s7-stepper .seg.cur', '.s7-pw input', '.s7-longpress .fill', '.s7-toast', '.s7-row.danger .s7-glyph,']) {
      expect(CSS).toContain(`${sel} `);
    }
    expect(CSS).not.toContain('.s7-ring');
  });

  it('is the extraction output, byte for byte (the hash the plan pins)', () => {
    expect(createHash('sha256').update(CSS).digest('hex')).toBe('541733335b0e35945521c490435e6910c1a8e23663954f04a0fc4c7dbec1bd6f');
  });
});
