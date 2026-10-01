import {dateViolations, forbiddenForms, listScanned} from '../check-no-tge-date.mjs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The owner's rule: the TGE date is never written. These tests assemble it from parts too.
// CI logs of this repository are public, so no assertion here may print a form when it fails: every
// check is a boolean or a count with a neutral message — never toContain/toEqual on a form, on the
// forms array, or on a string that could hold one; no test title carries a form.
describe('the TGE-date gate', () => {
  const [iso, monDay] = forbiddenForms();

  it('refuses a source or built file carrying any form of the date', () => {
    expect(dateViolations([{path: 'src/app/x.tsx', text: `const d = '${iso}';`}]).length, 'ISO form: violation count').toBe(1);
    expect(dateViolations([{path: 'dist/app/assets/p.js', text: `"claimable ${monDay}"`}]).length, 'Mon D, YYYY form: violation count').toBe(1);
    const seconds = forbiddenForms().find(f => /^\d{10}$/.test(f));
    expect(seconds !== undefined, 'the seconds form is missing').toBe(true);
    expect(dateViolations([{path: 'dist/app/background.js', text: `t=${seconds}`}]).length, 'seconds form: violation count').toBe(1);
  });

  it('covers the forms the design writes (#22, #35): ISO, "Mon D, YYYY" and the Unix timestamp', () => {
    const forms = forbiddenForms();
    expect(forms.some(f => /^\d{4}-\d{2}-\d{2}$/.test(f)), 'no ISO form').toBe(true);
    expect(forms.some(f => /^[a-z]{3} \d{1,2}, \d{4}$/.test(f)), 'no "Mon D, YYYY" form').toBe(true);
    expect(forms.some(f => /^\d{10}$/.test(f)), 'no seconds form').toBe(true);
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
      // Review fix round 1: the day-first numeric forms.
      ['day-first with dashes (DD-MM-YYYY)', `${p2(d)}-${p2(m)}-${y}`],
      ['day-first with slashes (DD/MM/YYYY)', `${p2(d)}/${p2(m)}/${y}`],
      ['day-first with dots (DD.MM.YYYY)', `${p2(d)}.${p2(m)}.${y}`],
    ];
    it.each(cases)('%s is a form, and is refused in any letter case', (name, form) => {
      expect(forbiddenForms().includes(form.toLowerCase()), `${name}: not among the forms`).toBe(true);
      // (the millisecond form also contains the seconds form, so it may be reported twice)
      expect(dateViolations([{path: 'x', text: `a ${form.toUpperCase()} b`}]).length >= 1, `${name}: upper case not refused`).toBe(true);
      const [msg] = dateViolations([{path: 'x', text: form}]);
      expect(msg !== undefined && !msg.toLowerCase().includes(form.toLowerCase()), `${name}: missing, or the message repeats the form`).toBe(true);
    });
  });

  it('passes a file without it (negative control), and never prints the date in its message', () => {
    expect(dateViolations([{path: 'src/app/x.tsx', text: "const d = '2026-09-29';"}]).length, 'another date: violation count').toBe(0);
    const [msg] = dateViolations([{path: 'x', text: iso}]);
    expect(msg !== undefined && !msg.toLowerCase().includes(iso), 'ISO form: missing, or the message repeats the form').toBe(true);
  });

  it('scans the package including dist/, and skips node_modules', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const scanned = listScanned(root);
    expect(scanned).toContain('src/background/index.ts');
    expect(scanned).toContain('unlock.html');
    expect(scanned.some(p => p.startsWith('node_modules/'))).toBe(false);
  });
});
