import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// B1b-2b §1.6: design-ext.css regenerated from index.html with plan 1's prefixes — never by hand. The ring is not
// copied (C15: no score, no ring).
const CSS = readFileSync(join(__dirname, '..', 'styles', 'design-ext.css'), 'utf8');

describe('design-ext.css (B1b-2b plan 1)', () => {
  it('carries the settings and security classes, and not the score ring', () => {
    for (const sel of ['.s7-picker .opt.sel', '.s7-tip svg', '.s7-score-card', '.s7-task .label', '.s7-stepper .seg.cur', '.s7-pw input', '.s7-longpress .fill', '.s7-toast', '.s7-row.danger .s7-glyph,']) {
      expect(CSS).toContain(`${sel} `);
    }
    expect(CSS).not.toContain('.s7-ring');
  });

  // Plan 2 re-ran the extraction with `.s-abook` (#15, ix:1412-1490) added, and re-pins the hash here (plan 1 Scope §2).
  it('carries #15’s address-book classes (plan 2)', () => {
    for (const sel of ['.s-abook .search input', '.s-abook .row .ava.violet', '.s-abook .row .ava.blue', '.s-abook .row mark', '.s-abook .empty .ic']) {
      expect(CSS).toContain(`${sel} `);
    }
  });

  // B1c plan 1 re-ran the extraction with #46's, #47's and #49's classes added (ix:3786-3950, 4067-4084), and re-pins the hash.
  it('carries #46’s, #47’s and #49’s classes (B1c plan 1)', () => {
    for (const sel of ['.s9-origin-card .badge.verified', '.s9-msg-preview mark', '.s9-domain-warn .body code', '.s9-struct-alert .head', '.s9-perm-row .badge', '.s9-scope-row.sel .radio::after', '.s9-flag-banner .ack.is-acked .box', '.s9-ack-row.is-acked .lbl', '.s9-gate-status.is-ready .dot', '.s10-app-row .verified-dot', '.s10-undo-toast .undo-btn', '.s10-sheet .head-row .name', '.s10-skel-row .ico', '.s10-empty .ill']) {
      expect(CSS).toContain(`${sel} `);
    }
  });

  // B1c plan 2 re-ran the extraction with #48's classes and #26/#27's OriginBadge added (ix:3824-3859, 4080-4084).
  it('carries #48’s classes and the OriginBadge (B1c plan 2)', () => {
    for (const sel of ['.s9-sim-banner .m3', '.s9-bal-card .label', '.s9-bal-row .delta.neg', '.s9-bal-row .fiat', '.s9-origin-pill .dot.ok', '.origin-badge[data-origin="dapp"]']) {
      expect(CSS).toContain(`${sel} `);
    }
  });

  // B1c plan 3 re-ran the extraction with #48's typed-confirm added (ix:3856-3860).
  it('carries #48’s typed-confirm (B1c plan 3)', () => {
    for (const sel of ['.s9-typed-confirm', '.s9-typed-confirm .label', '.s9-typed-confirm .input', '.s9-typed-confirm .input.match', '.s9-typed-confirm .input.empty']) {
      expect(CSS).toContain(`\n${sel} {`);
    }
  });

  // B1d-1b re-ran the extraction with #23's classes added (ix:2615-2796).
  it('carries #23’s presale classes (B1d-1b)', () => {
    for (const sel of ['.s-pre .stage-card', '.s-pre .stage-card .progress > i', '.s-pre .input-card .lbl-row', '.s-pre .input-card .est .ticker', '.s-pre .geo-link', '.s-pre .pending-card .ring', '.s-pre .pending-card .row .r.mono', '.s-pre .receipt .row']) {
      expect(CSS).toContain(`\n${sel} {`);
    }
  });

  // B1d-1b Task 6 re-ran the extraction with #50's classes, read from the design's Section XI <style> block (ix:19322-19376).
  it('carries #50’s geo-blocked classes from the Section XI block (B1d-1b Task 6), and none of that block’s aliases', () => {
    for (const sel of ['.s11-geo-hero', '.s11-geo-hero .glyph', '.s11-geo-region', '.s11-geo-region .col', '.s11-reason-row', '.s11-reason-row + .s11-reason-row', '.s11-reason-row .ico', '.s11-stillworks', '.s11-stillworks .head', '.s11-stillworks li']) {
      expect(CSS).toContain(`\n${sel} {`);
    }
    for (const alias of ['\n.topbar', '\n.sticky-bottom-bar', '\n.phone-row', '\n.s11-airgap', '\n.s11-stepdots', '\n.screen-section']) expect([alias, CSS.includes(alias)]).toEqual([alias, false]);
  });

  // B1d-2 Task 4 re-ran the extraction with #24's classes added (ix:2799-2929).
  it('carries #24’s referral classes (B1d-2 Task 4)', () => {
    for (const sel of ['.s-ref .scroll', '.s-ref .stats', '.s-ref .stats .stat', '.s-ref .stats .stat .val.acc', '.s-ref .code-card', '.s-ref .code-card .lbl-row', '.s-ref .code-card .code-row', '.s-ref .code-card .code-row .code', '.s-ref .code-card .actions button', '.s-ref .code-card .share-btn', '.s-ref .legalese']) {
      expect(CSS).toContain(`\n${sel} {`);
    }
  });

  it('is the extraction output, byte for byte (the hash the plan pins; scripts/extract-design-css.mjs --check against the design)', () => {
    expect(createHash('sha256').update(CSS).digest('hex')).toBe('ab642e2a20c7abcddcd4b657ed480132a4fa17a806a914a9a07455f056adfb3d');
  });
});
