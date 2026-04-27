import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
  type ReactNode,
} from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { themeSettings, type ThemeMode } from '@src/theme';

const STORAGE_KEY = 'tdat-theme';

function isValidMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isValidMode(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

interface ColorModeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (value: ThemeMode) => void;
}

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

interface ColorModeProviderProps {
  children: ReactNode;
}

export const ColorModeProvider = ({ children }: ColorModeProviderProps) => {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  const setMode = useCallback((value: ThemeMode) => {
    setModeState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage might be unavailable; ignore.
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const theme = useMemo(() => themeSettings(mode), [mode]);

  const value = useMemo<ColorModeContextValue>(
    () => ({ mode, toggleMode, setMode }),
    [mode, toggleMode, setMode],
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
    }
  }, [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

export const useColorMode = (): ColorModeContextValue => {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within ColorModeProvider');
  return ctx;
};
