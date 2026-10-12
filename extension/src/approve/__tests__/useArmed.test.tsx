// @vitest-environment happy-dom
import {act} from '@testing-library/react';
import ReactDOM from 'react-dom';
import {ARM_MS, useArmed} from '../useArmed';

/**
 * Fix round 2 (controller ruling): a key change must disarm the CTA in the SAME render it lands in, never a tick
 * later. Checked with the legacy `ReactDOM.render` (not @testing-library/react's `render`/`rerender`, and not
 * `react-dom/client`'s `createRoot`): both of those commit the key-change render asynchronously here (confirmed
 * by instrumentation — a `createRoot` update outside `act()` does not paint until a later microtask, so checking
 * the DOM right after the call sees last render's DOM, not this one, regardless of the hook's correctness and so
 * proving nothing). The legacy root commits synchronously for an update outside any batched context (the same
 * guarantee React 17 gave, and the one the real window relied on before `useState` had to carry a key instead of
 * a boolean) — so the assertion right after `ReactDOM.render` is reading the actual commit, with no event loop
 * turn in between for an effect to have run.
 */
function Probe({armKey}: {armKey: string}) {
  const armed = useArmed(armKey);
  return <button disabled={!armed}>{armed ? 'armed' : 'idle'}</button>;
}

describe('useArmed: a key change disarms in the same render, not a tick later', () => {
  it('synchronously disabled the instant the key changes — no effect has to run first', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      ReactDOM.render(<Probe armKey="a" />, container);
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, ARM_MS + 50));
    });
    expect(container.querySelector('button')?.disabled).toBe(false);
    // The key change itself, committed OUTSIDE act() on purpose (see the doc comment above): a mutation that puts
    // the reset back behind an effect leaves this `disabled` check reading the stale, still-armed value.
    ReactDOM.render(<Probe armKey="b" />, container);
    expect(container.querySelector('button')?.disabled).toBe(true);
    act(() => void ReactDOM.unmountComponentAtNode(container));
    container.remove();
  });
});
