// @vitest-environment happy-dom
import {render} from '@testing-library/react';
import {StatusPill} from '../ui/StatusPill';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';

const SELECTORS = selectorsOf(UI_SHEETS);

// Plan 3 (carry 4): scripts/check-classes.mjs asks only whether a class appears in SOME selector. `.status-pill`
// is styled only as `.s-txd .status-pill`, so a StatusPill on #21 would pass that gate and render unstyled. The
// send flow's screens are therefore checked where they render (src/__tests__/styled.ts, every class matched in
// place, as plan 2 did for the vault page); this is the negative fixture that proves the check sees it.
describe('the send flow’s classes, matched where they stand (carry 4)', () => {
  it('negative fixture: a StatusPill outside #27’s .s-txd matches no rule; inside it, it does', () => {
    const {container} = render(
      <div>
        <div className="screen s-stat" data-testid="status">
          <StatusPill text="Confirmed" />
        </div>
        <div className="screen s-txd" data-testid="detail">
          <StatusPill text="Confirmed" />
        </div>
      </div>,
    );
    const status = container.querySelector('[data-testid="status"] .status-pill') as Element;
    const detail = container.querySelector('[data-testid="detail"] .status-pill') as Element;
    expect(unstyledClasses(status, SELECTORS)).toEqual(['div.status-pill: .status-pill matches no rule in place']);
    expect(unstyledClasses(detail, SELECTORS)).toEqual([]);
  });

  it('design-ext.css carries the send flow’s design classes (regenerated from index.html, never by hand)', () => {
    expect(SELECTORS).toEqual(
      expect.arrayContaining([
        '.s-send .recipient-row .input',
        '.s-send .amount-row .max-chip',
        '.s-sim .check-row.warn .ic',
        '.s-sim .delta-row .val.neg',
        '.s-conf .fee-row.total',
        '.s-conf .first-time-banner',
        '.s-stat .ring.broadcasting',
        '.s-stat .stuck-watch',
        '.s-stuck .recovery-card.recommended',
        '.s-stuck .progress-state.done-cancelled .ring',
        '.s9-fail-hero .ring',
        '.s9-reason-banner',
        '.s9-payload-card .row',
        '.s9-toast-cancelled',
      ]),
    );
  });
});
