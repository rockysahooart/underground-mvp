import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import App from './app/App';
import { storageAvailable } from './data/store';
import { toast } from './data/ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (!storageAvailable()) toast('Storage is unavailable, so changes last only until you close this page.', { icon: 'warning', duration: 6000 });
