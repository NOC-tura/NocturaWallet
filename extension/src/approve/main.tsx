import '../../../web/src/styles/design-system.css';
import '../styles/design-ext.css';
import '../app/app.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Approve} from './Approve';
import {ApproveErrorBoundary} from './ErrorBoundary';
import {createClient} from './client';

/**
 * approve.html (spec §1.7, §4.3): the approval window — the popup's React shell and styles, its own page.
 * Fix round 2: `ApproveErrorBoundary` (its own module — `ErrorBoundary.tsx`, tested there) wraps `<Approve>` — a
 * render throw anywhere under it is otherwise caught by nothing, and React unmounts the whole tree, leaving the
 * window blank with no ✕, no Reject, no way out but the browser's own window chrome.
 */
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
