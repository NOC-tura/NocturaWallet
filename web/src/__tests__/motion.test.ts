import {readFileSync} from 'node:fs';

/**
 * Motion on this page is decoration; for some readers it is a symptom. `prefers-reduced-
 * motion` is not a nicety, and the way it rots is specific: someone adds an animation
 * months from now and does not think about the opt-out, because nothing asks them to.
 *
 * So this asks. Every selector that animates or transitions must appear inside a
 * reduced-motion block. The comment in the stylesheet claims "a rule added later cannot
 * forget" — that claim is only true because of this file.
 */
/**
 * Comments are stripped FIRST, and that is not tidiness. Parsing the raw file captured
 * each rule's preceding comment as part of its selector, so `.btn` arrived as
 * "/* … *​/ .btn" and matched nothing in the reduced-motion block. Every rule then looked
 * forgotten. The negative control is what exposed it: it expected one offender and got
 * ten.
 */
const CSS = readFileSync('src/styles/design-system.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Selectors of every rule whose body sets `animation` or `transition`. */
function animatedSelectors(css: string, insideQuery: boolean): string[] {
  const out: string[] = [];
  // Rules look like `sel, sel { … }`. Keyframe percentages are excluded by requiring the
  // body to carry an animation/transition property rather than by naming the at-rule.
  for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? '').trim();
    const body = m[2] ?? '';
    if (!/\b(animation|transition)\b\s*:/.test(body)) continue;
    if (/^\d|^from$|^to$/.test(selector)) continue; // keyframe steps
    const reduced = css.slice(0, m.index ?? 0).lastIndexOf('prefers-reduced-motion') !== -1
      && isInsideReducedBlock(css, m.index ?? 0);
    if (reduced === insideQuery) out.push(selector);
  }
  return out;
}

/** Is this offset within a `@media (prefers-reduced-motion…)` block? */
function isInsideReducedBlock(css: string, at: number): boolean {
  const open = css.lastIndexOf('@media (prefers-reduced-motion', at);
  if (open === -1) return false;
  // Walk braces from the query's opening brace to find where it closes.
  let depth = 0;
  for (let i = css.indexOf('{', open); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return at < i;
    }
  }
  return false;
}

/** Every individual selector in a comma-separated list, trimmed. */
const split = (list: string[]) => list.flatMap(s => s.split(',').map(x => x.trim())).filter(Boolean);

describe('reduced motion', () => {
  it('has a reduced-motion block at all (positive control)', () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-motion/);
  });

  it('opts every animated selector out of motion', () => {
    const animated = new Set(split(animatedSelectors(CSS, false)));
    const excused = new Set(split(animatedSelectors(CSS, true)));
    const forgotten = [...animated].filter(sel => !excused.has(sel));
    expect(forgotten).toEqual([]);
  });

  it('would notice a selector that was left out (negative control)', () => {
    // Without this, the check above passes on an empty stylesheet and on one where the
    // parser simply failed to find anything.
    const broken = `${CSS}\n.something-new { animation: noc-rise 220ms both; }\n`;
    const animated = new Set(split(animatedSelectors(broken, false)));
    const excused = new Set(split(animatedSelectors(broken, true)));
    expect([...animated].filter(s => !excused.has(s))).toEqual(['.something-new']);
  });

  it('found a non-trivial number of animated rules (the parser did something)', () => {
    // A regex that matched nothing would make the main assertion vacuously true.
    expect(split(animatedSelectors(CSS, false)).length).toBeGreaterThanOrEqual(4);
  });

  it('uses the design file\'s duration tokens rather than loose milliseconds', () => {
    // --dur-fast 120 / --dur-base 220 / --dur-slow 360 / --dur-spin 900 are part of the
    // design system. A stray `300ms` is a fifth tier nobody agreed to.
    // `animation-delay` is excluded on purpose: the stagger steps (80/120/…/240 ms) are
    // positions in a sequence, not a fifth duration tier.
    const durations = [...CSS.matchAll(/\b(animation|transition)(?!-delay)[^;]*?(\d+)ms/g)].map(m =>
      Number(m[2]),
    );
    const allowed = new Set([120, 220, 360, 900, 100]); // 100ms: the press transform, from the design file's .btn
    expect(durations.filter(d => !allowed.has(d))).toEqual([]);
  });
});
