import '../../../web/src/styles/design-system.css';
import '../styles/design-ext.css';
import '../app/app.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Approve} from './Approve';
import {createClient} from './client';

/** approve.html (spec §1.7, §4.3): the approval window — the popup's React shell and styles, its own page. */
const root = document.getElementById('root');
if (root === null) throw new Error('no #root element');
const client = createClient();
const close = () => window.close();
createRoot(root).render(
  <StrictMode>
    <div className="app app-window">
      <Approve client={client} close={close} />
    </div>
  </StrictMode>,
);
