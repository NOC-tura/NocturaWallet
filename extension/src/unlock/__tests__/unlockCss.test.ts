import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// The vault page shows and hides with the `hidden` attribute, and the design's classes set `display`
// (.screen, .sticky-bar, .auto-blur-chip …), which beats the browser's own [hidden] rule: without this
// rule every screen renders at once. happy-dom has no layout, so only a real browser shows it (found by
// the plan's E2E dry run); this pins the fix.
// The rule must be the sheet's FIRST top-level rule, as written (review M2): not inside an @media, not
// in a comment.
it('unlock.css makes the hidden attribute win over the design classes', () => {
  const css = readFileSync(join(__dirname, '..', 'unlock.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const first = /^\s*([^{}]+)\{([^{}]*)\}/.exec(css);
  expect(first?.[1]?.trim()).toBe('[hidden]');
  expect(first?.[2]?.replace(/\s+/g, '').replace(/;$/, '')).toBe('display:none!important');
});

// Fix round 1 item 2: happy-dom has no layout, so the UA margins this rule resets (measured in a
// real browser: h1.wordmark 21px, tagline/terms 12-15px, .layer-card h3 17px, p 13px, #2's lede
// 15px) are invisible to the other vault-page tests. This pins the rule's text instead — its exact
// `:where()` selector (zero specificity, so it behaves like the design's `* { margin:0; padding:0 }`
// and never beats a design class's own margin/padding) and its declarations.
it('unlock.css resets margin/padding inside the vault column at zero specificity (:where)', () => {
  const css = readFileSync(join(__dirname, '..', 'unlock.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const m = /:where\(\.vlt-col\)\s*\*,\s*:where\(\.vlt-col\)\s*\{([^{}]*)\}/.exec(css);
  expect(m).not.toBeNull();
  expect(m?.[1]?.replace(/\s+/g, '')).toBe('margin:0;padding:0;');
  // A plain `.vlt-col *` is specificity (0,1,0) and would beat a design class's margin/padding if it
  // ever won the cascade; only the zero-specificity `:where()` form is allowed.
  expect(css).not.toContain('.vlt-col *');
});
