import { createTheme } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

export const themeSettings = (mode: ThemeMode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: '#0d1117' },
      background: {
        default: mode === 'light' ? '#f5f6fa' : '#121212',
        paper: mode === 'light' ? 'rgba(255,255,255,0.8)' : '#1e1e1e',
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            borderRadius: 8,
          },
        },
      },
    },
  });
