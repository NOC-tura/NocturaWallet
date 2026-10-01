import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DYNAMIC, SHEETS, VAULT_SHEETS, classUses, classViolations, definedClasses, listScreens, listVaultFiles, vaultClassUses, vaultClassViolations} from '../check-classes.mjs';

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

// Plan 2: the vault page (unlock.html + src/unlock) is plain DOM; its classes are checked against the
// three stylesheets it loads, and a class there must be a literal.
describe('the class gate: the vault page', () => {
  it('reads class="" in the page, and h(tag, …), className = … and classList calls in its code', () => {
    expect(vaultClassUses('<section class="screen s-welcome" hidden><p class=\'noc-caption terms\'>x</p></section>', true)).toEqual({classes: ['screen', 's-welcome', 'noc-caption', 'terms'], computed: []});
    const code = "h('div', 'word');\nh('span', 'num', two(i));\nel.className = 'slot filled';\nbar.classList.toggle('filled', on);\nel.classList.add('is-error');";
    expect(vaultClassUses(code, false)).toEqual({classes: ['word', 'num', 'slot', 'filled', 'filled', 'is-error'], computed: []});
  });

  it('refuses a planted class and a computed one; accepts the DOM helper’s own parameter, there only', () => {
    const files = [
      {path: 'unlock.html', text: '<div class="screen vlt-planted-nowhere"></div>'},
      {path: 'src/unlock/screens/x.ts', text: "h('div', tone);\nel.className = `slot ${state}`;"},
      {path: 'src/unlock/view/dom.ts', text: 'if (cls !== \'\') el.className = cls;'},
      {path: 'src/unlock/view/other.ts', text: 'el.className = cls;'},
    ];
    expect(vaultClassViolations(files, new Set(['screen']))).toEqual([
      'unlock.html: class "vlt-planted-nowhere" is defined in no stylesheet the vault page loads',
      'src/unlock/screens/x.ts: computed class tone — the vault page names classes as literal strings only',
      'src/unlock/screens/x.ts: computed class `slot ${state}` — the vault page names classes as literal strings only',
      'src/unlock/view/other.ts: computed class cls — the vault page names classes as literal strings only',
    ]);
  });

  it('reads unlock.html and every src/unlock module but the tests; the real page passes', () => {
    const files = listVaultFiles(ROOT);
    expect(files[0]).toBe('unlock.html');
    expect(files).toEqual(expect.arrayContaining(['src/unlock/main.ts', 'src/unlock/view/dom.ts']));
    expect(files.some(f => f.includes('__tests__'))).toBe(false);
    expect(VAULT_SHEETS).toEqual(['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/unlock/unlock.css']);
    expect(vaultClassViolations()).toEqual([]);
  });
});
