// gemini-repomix-ui/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { RepoFileManagerProvider } from './contexts/RepoFileManagerContext'; // New
import { ActiveRepomixDataProvider } from './contexts/ActiveRepomixDataContext'; // New

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RepoFileManagerProvider>
        <ActiveRepomixDataProvider>
          <App />
        </ActiveRepomixDataProvider>
      </RepoFileManagerProvider>
    </AuthProvider>
  </StrictMode>,
)