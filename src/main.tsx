import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AccountProvider } from './state/AccountContext';
import { AppStateProvider } from './state/AppState';
import './styles.css';

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppStateProvider>
        <AccountProvider>
          <App />
        </AccountProvider>
      </AppStateProvider>
    </HashRouter>
  </StrictMode>,
);
