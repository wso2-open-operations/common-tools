import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import App from '@src/App';
import { AuthProvider } from '@asgardeo/auth-react';
import authConfig from '@config/authConfig';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider config={authConfig}>
      <App />
    </AuthProvider>

  </StrictMode>,
)
