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
