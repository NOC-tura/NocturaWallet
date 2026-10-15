import '../../../web/src/styles/design-system.css';
import '../styles/design-ext.css';
import '../app/app.css';
import {Component, StrictMode, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {Approve} from './Approve';
import {createClient} from './client';
import {LockedButton} from '../app/ui/LockedButton';
import {ExtIcon} from '../app/ui/ExtIcon';
import {WINDOW_TEXT} from './strings';

/**
 * Fix round 2: a render throw anywhere under `<Approve>` (Rules of Hooks, or anything else) is otherwise caught by
 * nothing — React unmounts the whole tree and the window goes blank, with no ✕, no Reject, no way out but the
 * browser's own window chrome. [Close] here never decides anything itself: it is the SAME `close` the design's ✕
 * uses everywhere, and closing the window is already how the background answers a head request `rejected`
 * (`window.ts`'s `windows.onRemoved`) — this boundary adds no new path into dApp state, reads nothing, writes
 * nothing. It never recovers the crashed tree either (React does not clear an error boundary's state on new props):
 * the next request is a new window.
 */
class ApproveErrorBoundary extends Component<{close: () => void; children: ReactNode}, {broke: boolean}> {
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
          {/* Owner-delegated (controller, 2026-10-16; fix round 2): this screen has no design — the crash case. */}
          <p className="noc-body-sm app-muted app-approve-lede">Something went wrong showing this request. Closing keeps it safe — rejected, never signed.</p>
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

/** approve.html (spec §1.7, §4.3): the approval window — the popup's React shell and styles, its own page. */
const root = document.getElementById('root');
if (root === null) throw new Error('no #root element');
const client = createClient();
const close = () => window.close();
createRoot(root).render(
  <StrictMode>
    <div className="app app-window">
      <ApproveErrorBoundary close={close}>
        <Approve client={client} close={close} />
      </ApproveErrorBoundary>
    </div>
  </StrictMode>,
);
