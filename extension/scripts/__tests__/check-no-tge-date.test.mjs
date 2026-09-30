import {dateViolations, forbiddenForms, listScanned} from '../check-no-tge-date.mjs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The owner's rule: the TGE date is never written. These tests assemble it from parts too.
describe('the TGE-date gate', () => {
  const [iso, monDay] = forbiddenForms();

  it('refuses a source or built file carrying any form of the date', () => {
    expect(dateViolations([{path: 'src/app/x.tsx', text: `const d = '${iso}';`}])).toHaveLength(1);
    expect(dateViolations([{path: 'dist/app/assets/p.js', text: `"claimable ${monDay}"`}])).toHaveLength(1);
    const seconds = forbiddenForms().find(f => /^\d{10}$/.test(f));
    expect(dateViolations([{path: 'dist/app/background.js', text: `t=${seconds}`}])).toHaveLength(1);
  });

  it('covers the forms the design writes (#22, #35): ISO, "Mon D, YYYY" and the Unix timestamp', () => {
    const forms = forbiddenForms();
    expect(forms.some(f => /^\d{4}-\d{2}-\d{2}$/.test(f))).toBe(true);
    expect(forms.some(f => /^[a-z]{3} \d{1,2}, \d{4}$/.test(f))).toBe(true);
    expect(forms.some(f => /^\d{10}$/.test(f))).toBe(true);
  });

  // Review H2: each added form, its fixture built here from parts — the test never holds the date either.
  describe('the added forms (review H2)', () => {
    const y = 2000 + 27;
    const m = 3 - 2;
    const d = 2 * 9;
    const p2 = n => String(n).padStart(2, '0');
    const month = ['Jan', 'uary'].join('');
    const ms = String(Date.UTC(y, m - 1, d));
    const cases = [
      ['slash ISO', `${y}/${p2(m)}/${p2(d)}`],
      ['unpadded US', `${m}/${d}/${y}`],
      ['"Mon D YYYY" without a comma', `${month.slice(0, 3)} ${d} ${y}`],
      ['the full month name without a comma', `${month} ${d} ${y}`],
      ['an ordinal, day first', `${d}th ${month} ${y}`],
      ['an ordinal, month first', `${month} ${d}th, ${y}`],
      ['the millisecond timestamp', ms],
    ];
    it.each(cases)('%s is a form, and is refused in any letter case', (_, form) => {
      expect(forbiddenForms()).toContain(form.toLowerCase());
      // (the millisecond form also contains the seconds form, so it may be reported twice)
      expect(dateViolations([{path: 'x', text: `a ${form.toUpperCase()} b`}]).length).toBeGreaterThanOrEqual(1);
      expect(dateViolations([{path: 'x', text: form}])[0]).not.toContain(form);
    });
  });

  it('passes a file without it (negative control), and never prints the date in its message', () => {
    expect(dateViolations([{path: 'src/app/x.tsx', text: "const d = '2026-09-29';"}])).toEqual([]);
    const [msg] = dateViolations([{path: 'x', text: iso}]);
    expect(msg).not.toContain(iso);
  });

  it('scans the package including dist/, and skips node_modules', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const scanned = listScanned(root);
    expect(scanned).toContain('src/background/index.ts');
    expect(scanned).toContain('unlock.html');
    expect(scanned.some(p => p.startsWith('node_modules/'))).toBe(false);
  });
});
