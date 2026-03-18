import { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  CircularProgress,
  Container,
  Paper,
  Typography,
  Button
} from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthContext } from '@asgardeo/auth-react';
import LockIcon from '@mui/icons-material/Lock';
import Header from './components/Header';
import Footer from './components/Footer';
import UploadPage from './pages/UploadPage';
import DashboardLayout from './pages/DashboardLayout';
import DashboardHome from './components/Dashboard/DashboardHome';
import ThreadExplorer from './components/Dashboard/ThreadExplorer';
import LockContention from './components/Dashboard/LockContention';
import { AnalysisProvider } from './context/AnalysisContext';
import LoginIcon from '@mui/icons-material/Login';

// Create the client outside the component
const queryClient = new QueryClient();

function App() {
  const { state, signIn, signOut } = useAuthContext();
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  
  // Lifted Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
          primary: { main: '#0d1117' },
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

  // Loading State for Asgardeo Session Check
  if (state.isLoading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress sx={{ color: '#ff6d00' }} />
      </Box>
    );
  }

  // Signed Out State
  if (!state.isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Paper elevation={3} sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
            <Box sx={{ mb: 2, color: '#ff6d00', display: 'flex', justifyContent: 'center' }}>
              <LockIcon sx={{ fontSize: 60 }} />
            </Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Thread Dump Analyzer
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Internal tool for diagnosing JVM performance issues.
              <br />
              <strong>WSO2 Employees Only</strong>
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => signIn()}
              sx={{ bgcolor: '#ff6d00', textTransform: 'none', px: 4, '&:hover': { bgcolor: '#e65100' } }}
            >
              <LoginIcon sx={{ mr: 1 }} /> Login
            </Button>
          </Paper>
        </Container>
      </ThemeProvider>
    );
  }

  // Signed In State
  return (
    <QueryClientProvider client={queryClient}>
      <AnalysisProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

              {/* Passing state and toggle function to Header */}
              <Header
                onToggleTheme={colorMode.toggleColorMode}
                onSignOut={() => signOut()}
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              />

              <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Routes>
                  <Route path="/" element={<UploadPage />} />

                  {/* Passing state down to the Dashboard Layout */}

                  {/* Dashboard */}
                  <Route path="/dashboard" element={<DashboardLayout isSidebarOpen={isSidebarOpen} />}>
                    <Route index element={<DashboardHome />} />
                  </Route>

                  {/* Thread Explorer */}
                  <Route path="/thread-explorer" element={<DashboardLayout isSidebarOpen={isSidebarOpen} />}>
                    <Route index element={<ThreadExplorer />} />
                  </Route>

                  {/* Lock Contention */}
                  <Route path="/lock-contention" element={<DashboardLayout isSidebarOpen={isSidebarOpen} />}>
                    <Route index element={<LockContention />} />
                  </Route>

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