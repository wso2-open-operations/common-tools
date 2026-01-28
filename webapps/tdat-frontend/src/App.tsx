import { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box
} from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Header from './components/Header';
import Footer from './components/Footer';
import UploadPage from './pages/UploadPage';
import DashboardLayout from './pages/DashboardLayout';
import DashboardHome from './components/Dashboard/DashboardHome';
import ThreadExplorer from './components/Dashboard/ThreadExplorer';
import { AnalysisProvider } from './context/AnalysisContext';

// Create the client outside the component to prevent recreation on render
const queryClient = new QueryClient();

function App() {
  // Theme State Management
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#0d1117',
          },
          background: {
            default: mode === 'light' ? '#ffffff' : '#121212',
            paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
          },
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        },
      }),
    [mode],
  );

  return (
    // Wrap the entire app in the QueryClientProvider
    <QueryClientProvider client={queryClient}>
      <AnalysisProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

              <Header onToggleTheme={colorMode.toggleColorMode} />

              {/* Main Content Area */}
              <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Routes>
                  {/* Upload Page */}
                  <Route path="/" element={<UploadPage />} />

                  {/* Dashboard Layout */}
                  <Route path="/dashboard" element={<DashboardLayout />}>
                    {/* Default view: /dashboard */}
                    <Route index element={<DashboardHome />} />

                    {/* Explorer view: /dashboard/thread-explorer */}
                    <Route path="thread-explorer" element={<ThreadExplorer />} />
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Box>

              <Footer />

            </Box>
          </Router>
        </ThemeProvider>
      </AnalysisProvider>
    </QueryClientProvider>
  );
}

export default App;