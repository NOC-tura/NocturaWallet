import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Task 17 fix round 1 (A2, C11, C12): what the design says in inline styles (index.html #s26/#s27) is
// said in app.css, never in design-ext.css — that file is the design's own CSS, extracted rule for
// rule, and a hand edit there is overwritten (and hidden) by the next extraction.
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(HERE, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = read('../app.css');
const EXT = read('../../styles/design-ext.css');
/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(css: string, selector: string): string | null {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if ((m[1] ?? '').trim().replace(/\s+/g, ' ') === selector) return (m[2] ?? '').replace(/\s+/g, ' ').trim();
  }
  return null;
}

describe('the design\'s inline styles, in app.css', () => {
  it('a received row\'s arrow is the same glyph turned 180° (26b), in app.css and not in design-ext.css', () => {
    expect(rule(APP, '.tx-row .ic.recv svg')).toBe('transform: rotate(180deg); transform-origin: center;');
    expect(EXT).not.toContain('.ic.recv svg');
    expect(EXT).not.toContain('rotate(180deg)');
  });

  it('the Explorer link-button is not underlined (27a draws a button)', () => {
    expect(rule(APP, 'a.btn')).toBe('text-decoration: none;');
  });

  it('27c: a received amount in --success; 27d: the failed card and its eyebrow in --danger', () => {
    expect(rule(APP, '.s-txd .amount-card .amt.app-amt-in')).toBe('color: var(--success);');
    expect(rule(APP, '.s-txd .amount-card.app-failed')).toBe(
      'background: radial-gradient(120% 100% at 30% 0%, color-mix(in oklab, var(--danger) 20%, transparent), transparent 65%), var(--bg-surface-1);',
    );
    expect(rule(APP, '.s-txd .amount-card.app-failed .eyebrow')).toBe('color: var(--danger);');
  });
});
