import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';

import '@ionic/react/css/core.css';

import { App } from './App';

setupIonicReact();

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
