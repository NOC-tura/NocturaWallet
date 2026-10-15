import {Component, type ReactNode} from 'react';
import {LockedButton} from '../app/ui/LockedButton';
import {ExtIcon} from '../app/ui/ExtIcon';
import {WINDOW_TEXT} from './strings';

/**
 * Fix round 2 (extracted to its own module, tested, in fix round 3 — "a check without a test that can fail is not a
 * check"): a render throw anywhere under `<Approve>` (Rules of Hooks, or anything else) is otherwise caught by
 * nothing — React unmounts the whole tree and the window goes blank, with no ✕, no Reject, no way out but the
 * browser's own window chrome. [Close] here never decides anything itself: it is the SAME `close` the design's ✕
 * uses everywhere, and closing the window is already how the background answers a STILL-QUEUED head request
 * `rejected` (`window.ts`'s `onApprovalWindowRemoved`, `e?.state === 'queued'`) — this boundary adds no new path
 * into dApp state, reads nothing, writes nothing. Fix round 3 (copy truth): a request already `deciding` —
 * approval in flight — is NOT touched by that check, so the fallback's own copy never claims every request is
 * rejected, only one not yet approved. It never recovers the crashed tree either (React does not clear an error
 * boundary's state on new props): the next request is a new window.
 */
export class ApproveErrorBoundary extends Component<{close: () => void; children: ReactNode}, {broke: boolean}> {
  state: {broke: boolean} = {broke: false};
  static getDerivedStateFromError(): {broke: boolean} {
    return {broke: true};
  }
  override componentDidCatch(error: unknown): void {
    console.error('approve window: a screen threw', error);
  }
  override render(): ReactNode {
    if (!this.state.broke) return this.props.children;
    return (
      <div className="screen app-approve">
        <div className="scroll-area app-approve-scroll">
          {/* Owner-delegated (controller, 2026-10-16; fix round 3): this screen has no design — the crash case. */}
          <p className="noc-body-sm app-muted app-approve-lede">Something went wrong showing this request. Close this window — a request you haven't approved is rejected.</p>
        </div>
        <div className="sticky-bar">
          <LockedButton className="btn btn-secondary" onPress={this.props.close}>
            <ExtIcon name="close" size={18} />
            {WINDOW_TEXT.close}
          </LockedButton>
        </div>
      </div>
    );
  }
}
