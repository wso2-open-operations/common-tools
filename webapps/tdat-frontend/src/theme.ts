import { createTheme } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

export const themeSettings = (mode: ThemeMode) =>
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
  });
