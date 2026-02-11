import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@asgardeo/auth-react';
import authConfig from './config/authConfig.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider config={authConfig}>
      <App />
    </AuthProvider>

  </StrictMode>,
)
