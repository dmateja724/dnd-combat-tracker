import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EncounterProvider } from './context/EncounterContext';
import { CombatantLibraryProvider } from './context/CombatantLibraryContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CombatantLibraryProvider>
          <EncounterProvider>
            <App />
          </EncounterProvider>
        </CombatantLibraryProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
