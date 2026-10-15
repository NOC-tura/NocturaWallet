// @vitest-environment happy-dom
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {ApproveErrorBoundary} from '../ErrorBoundary';

afterEach(() => cleanup());

function Thrower(): never {
  throw new Error('boom');
}
function Fine() {
  return <div>fine</div>;
}

// Fix round 3 (project rule: a check without a test that can fail is not a check) — extracted so it can be tested
// in isolation from the real background/window machinery `<Approve>` needs.
describe('ApproveErrorBoundary', () => {
  it('a child that throws: the fallback appears, no Approve/Reject/Sign button exists, Close calls the spy exactly once', () => {
    const close = vi.fn();
    // React logs the caught error to the console by default; the boundary's own componentDidCatch does too —
    // swallow both so the test's own output stays clean, without weakening what this test checks.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ApproveErrorBoundary close={close}>
        <Thrower />
      </ApproveErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong showing this request\./)).toBeTruthy();
    expect(screen.queryByText('boom')).toBeNull();
    expect(screen.queryByRole('button', {name: /Approve/})).toBeNull();
    expect(screen.queryByRole('button', {name: /Reject/})).toBeNull();
    expect(screen.queryByRole('button', {name: /Sign/})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(close).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  // Negative control: a non-throwing child is not a defect this boundary should ever mask.
  it('negative control: a non-throwing child renders normally — the fallback never shows, Close is never called', () => {
    const close = vi.fn();
    render(
      <ApproveErrorBoundary close={close}>
        <Fine />
      </ApproveErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
});
