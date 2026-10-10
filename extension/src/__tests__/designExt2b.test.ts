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

  // Plan 2 re-ran the extraction with `.s-abook` (#15, ix:1412-1490) added, and re-pins the hash here (plan 1 Scope §2).
  it('carries #15’s address-book classes (plan 2)', () => {
    for (const sel of ['.s-abook .search input', '.s-abook .row .ava.violet', '.s-abook .row .ava.blue', '.s-abook .row mark', '.s-abook .empty .ic']) {
      expect(CSS).toContain(`${sel} `);
    }
  });

  it('is the extraction output, byte for byte (the hash the plan pins)', () => {
    expect(createHash('sha256').update(CSS).digest('hex')).toBe('3092abb5608035c82f58c9097cdd23bc8b49f8d77f12c1622d8a304414caa4d7');
  });
});
