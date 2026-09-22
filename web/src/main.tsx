import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// First, so every later sheet (the vendored wallet-adapter one included) overrides a
// base that is already the product's own.
import './styles/design-system.css';
import {App} from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
