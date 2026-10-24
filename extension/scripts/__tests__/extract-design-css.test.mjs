import {readFileSync} from 'node:fs';
import {HEADER, OUT_PATH, kept, rulesOf} from '../extract-design-css.mjs';

// Global constraints (plan 2 review 1 M2): design-ext.css is generated only. CI has no design file, so this checks
// what it can without one: the file is the script's header and then only rules the script keeps — a rule typed in by
// hand under any other selector fails here. The byte-for-byte check against the design is `--check` (Task 7 Step 3).
describe('the design CSS extraction', () => {
  const css = readFileSync(OUT_PATH, 'utf8');

  it('design-ext.css starts with the script’s HEADER, and every rule after it is one the extraction keeps', () => {
    expect(css.startsWith(HEADER)).toBe(true);
    const rules = rulesOf(css.slice(HEADER.length));
    expect(rules.length).toBeGreaterThan(800);
    expect(rules.filter(r => !kept(r))).toEqual([]);
  });

  // Negative controls: a rule under a prefix the script does not list, and an at-rule, are not kept.
  it('a hand-added rule outside the listed prefixes, or an @media block, is not kept (negative controls)', () => {
    expect(kept('.app-mine { color: red; }')).toBe(false);
    expect(kept('@media (max-width: 400px) { .screen { padding: 0; } }')).toBe(false);
    expect(kept('.s9-bal-card .label { color: red; }')).toBe(true);
    // B1d-1b Task 6: of the Section XI block, #50's geo-blocked rules are kept, its air-gap rules are not.
    expect(kept('.s11-reason-row .ico { color: red; }')).toBe(true);
    expect(kept('.s11-airgap-headline { color: red; }')).toBe(false);
  });
});
