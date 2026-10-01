import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// The vault page shows and hides with the `hidden` attribute, and the design's classes set `display`
// (.screen, .sticky-bar, .auto-blur-chip …), which beats the browser's own [hidden] rule: without this
// rule every screen renders at once. happy-dom has no layout, so only a real browser shows it (found by
// the plan's E2E dry run); this pins the fix.
it('unlock.css makes the hidden attribute win over the design classes', () => {
  const css = readFileSync(join(__dirname, '..', 'unlock.css'), 'utf8');
  expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});
