import '../../../web/src/styles/design-system.css';
import '../styles/design-ext.css';
import './app.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import type {Surface} from './WalletContext';

/**
 * StrictMode runs every effect twice in development builds only (mount, unmount, mount): the provider's
 * open sequence may then read twice in `vite dev`. Production builds — what the extension ships — run
 * each effect once (review L10).
 */
export function mount(surface: Surface): void {
  const root = document.getElementById('root');
  if (root === null) throw new Error('no #root element');
  createRoot(root).render(
    <StrictMode>
      <App surface={surface} />
    </StrictMode>,
  );
}
