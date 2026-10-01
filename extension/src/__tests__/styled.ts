import {readFileSync} from 'node:fs';
import {join} from 'node:path';

/**
 * The class gate (scripts/check-classes.mjs) asks only whether a class appears in SOME selector; it
 * cannot see that `.ring` is styled only under `.s8-success-hero` (plan-1 lesson: a #21 StatusPill
 * outside `.s-txd` would pass it unstyled). This check is the ancestor-aware half, run on what a
 * test actually rendered: for every element and each of its classes, some selector naming that
 * class must MATCH the element where it stands (pseudo-classes and pseudo-elements stripped, so
 * `:hover` / `::before` rules count) — or, for a scope class such as `.s-secintro` that only appears
 * as an ancestor (`.s-secintro .layer-card`), match a descendant of it. A class that does neither
 * renders as nothing.
 */
const PKG = join(__dirname, '..', '..');

/** Every selector in the given stylesheets (package-relative paths), @-rule preludes and keyframe steps excluded. */
export function selectorsOf(sheets: readonly string[]): string[] {
  const out: string[] = [];
  for (const sheet of sheets) {
    const css = readFileSync(join(PKG, sheet), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const m of css.matchAll(/([^{}]+)\{/g)) {
      const prelude = (m[1] ?? '').trim();
      if (prelude === '' || prelude.startsWith('@')) continue;
      for (const sel of prelude.split(',')) {
        const s = sel.trim();
        if (s !== '' && !/^(from|to|\d+(\.\d+)?%)$/.test(s)) out.push(s);
      }
    }
  }
  return out;
}

/** The selector without pseudo-classes and pseudo-elements; a compound they emptied becomes `*`. */
function structural(selector: string): string {
  const s = selector
    .replace(/::?[a-zA-Z-]+(\((?:[^()]|\([^()]*\))*\))?/g, ' ')
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = s === '' ? [] : s.split(' ');
  const out: string[] = [];
  for (const p of parts) {
    const comb = p === '>' || p === '+' || p === '~';
    const prev = out[out.length - 1];
    if (comb && (prev === undefined || prev === '>' || prev === '+' || prev === '~')) out.push('*');
    out.push(p);
  }
  const last = out[out.length - 1];
  if (last === undefined || last === '>' || last === '+' || last === '~') out.push('*');
  return out.join(' ');
}

/** "div.word > .term" — enough to find the element in a failure message. */
function describe(el: Element): string {
  const id = el.id === '' ? '' : `#${el.id}`;
  return `${el.tagName.toLowerCase()}${id}.${[...el.classList].join('.')}`;
}

/** One line per (element, class) under `root` (inclusive) that no selector styles where it stands. */
export function unstyledClasses(root: Element, selectors: readonly string[]): string[] {
  const out: string[] = [];
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const c of el.classList) {
      const named = new RegExp(`\\.${c.replace(/[^\w-]/g, '\\$&')}(?![\\w-])`);
      const ok = selectors.some(s => {
        if (!named.test(s)) return false;
        try {
          const sel = structural(s);
          // matches() on each descendant: a selector's ancestors may lie above `el` (querySelector
          // would scope them to the subtree).
          return el.matches(sel) || [...el.querySelectorAll('*')].some(d => d.matches(sel));
        } catch {
          return false;
        }
      });
      if (!ok) out.push(`${describe(el)}: .${c} matches no rule in place`);
    }
  }
  return out;
}

/** The vault page's stylesheets (src/unlock/main.ts's imports) and the UI's (src/app/mount.tsx's). */
export const VAULT_PAGE_SHEETS = ['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/unlock/unlock.css'] as const;
export const UI_SHEETS = ['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/app/app.css'] as const;
