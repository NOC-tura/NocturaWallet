import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DYNAMIC, SHEETS, classUses, classViolations, definedClasses, listScreens} from '../check-classes.mjs';

// Every class a screen names must be styled by one of the three stylesheets the app loads
// (design-system.css, design-ext.css, app.css): a class defined nowhere is a design element that
// silently renders unstyled (Tasks 12–15 left a list of them for app.css; this gate replaces the list).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the class gate: reading className', () => {
  it('reads plain strings, template literals, conditionals and *Class props and defaults', () => {
    const src = [
      '<div className="screen s-act" />',
      "<span className='noc-caption app-dim' />",
      '<b className={`item${active ? \' is-active\' : \'\'}`} />',
      "<i className={busy ? 'is-spinning' : undefined} />",
      '<TopBar titleClass="noc-h3" />',
      "function B({className = 'btn btn-primary', titleClass = 'noc-h1'}) {}",
    ].join('\n');
    expect(classUses(src)).toEqual({
      classes: ['screen', 's-act', 'noc-caption', 'app-dim', 'item', 'is-active', 'is-spinning', 'noc-h3', 'btn', 'btn-primary', 'noc-h1'],
      dynamic: [],
    });
  });

  it('never takes a compared value for a class, and reports interpolations it cannot read as dynamic', () => {
    const src = "<p className={`amt${t.tone === 'recv' ? ' up' : ''} ic ${t.tone} app-${surface}`} />";
    expect(classUses(src)).toEqual({classes: ['amt', 'up', 'ic'], dynamic: ['${t.tone}', 'app-${surface}']});
  });
});

describe('the class gate: stylesheets', () => {
  it('collects class selectors, not numbers, urls or comments', () => {
    const css = "/* .ghost */ .a .b-c, .d:hover > .e_f { width: 1.5px; src: url(x.woff2); } @media (x) { .g { } }";
    expect([...definedClasses(css)].sort()).toEqual(['a', 'b-c', 'd', 'e_f', 'g']);
  });
});

describe('the class gate: the app', () => {
  // Negative control: a class nobody defines is caught, in a plain string, a conditional, a
  // default prop, and through an unknown dynamic pattern.
  it('refuses a planted class defined in no stylesheet, and an unlisted dynamic class', () => {
    const files = [
      {path: 'src/app/screens/X.tsx', text: '<div className="screen app-planted-nowhere" />'},
      {path: 'src/app/ui/Y.tsx', text: "<i className={on ? 'also-nowhere' : ''} />\n<b className={`s7-row ${kind}`} />"},
    ];
    expect(classViolations(files, new Set(['screen', 's7-row']))).toEqual([
      'src/app/screens/X.tsx: class "app-planted-nowhere" is defined in no stylesheet',
      'src/app/ui/Y.tsx: class "also-nowhere" is defined in no stylesheet',
      'src/app/ui/Y.tsx: dynamic class ${kind} is not listed in DYNAMIC — list the values it can take',
    ]);
  });

  it('checks the values of each listed dynamic class too', () => {
    const files = [{path: 'src/app/ui/Banner.tsx', text: '<div className={`banner ${tone}`} />'}];
    expect(classViolations(files, new Set(['banner', 'info', 'warning']))).toEqual(['src/app/ui/Banner.tsx: class "danger" (a value of ${tone}) is defined in no stylesheet']);
  });

  it('reads every .tsx under src/app/ except the tests', () => {
    const files = listScreens(ROOT);
    expect(files).toContain('src/app/screens/Activity.tsx');
    expect(files).toContain('src/app/ui/Sheet.tsx');
    expect(files.some(f => f.includes('__tests__'))).toBe(false);
    expect(files.every(f => f.startsWith('src/app/') && f.endsWith('.tsx'))).toBe(true);
  });

  it('the real app: every class it names is defined by design-system.css, design-ext.css or app.css', () => {
    expect(SHEETS).toEqual(['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/app/app.css']);
    expect(Object.keys(DYNAMIC).length).toBeGreaterThan(0);
    expect(classViolations()).toEqual([]);
  });
});
