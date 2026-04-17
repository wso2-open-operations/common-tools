import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
  type ReactNode,
} from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { themeSettings, type ColorModePreference, type ThemeMode } from '@src/theme';

const STORAGE_KEY = 'tdat-theme';

function isValidPreference(value: unknown): value is ColorModePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredPreference(): ColorModePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isValidPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function getSystemMode(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ColorModeContextValue {
  preference: ColorModePreference;
  resolvedMode: ThemeMode;
  setPreference: (value: ColorModePreference) => void;
}

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

interface ColorModeProviderProps {
  children: ReactNode;
}

export const ColorModeProvider = ({ children }: ColorModeProviderProps) => {
  const [preference, setPreferenceState] = useState<ColorModePreference>(readStoredPreference);
  const [systemMode, setSystemMode] = useState<ThemeMode>(getSystemMode);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemMode(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);

  const setPreference = useCallback((value: ColorModePreference) => {
    setPreferenceState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage might be unavailable; ignore.
    }
  }, []);

  const resolvedMode: ThemeMode = preference === 'system' ? systemMode : preference;

  const theme = useMemo(() => themeSettings(resolvedMode), [resolvedMode]);

  const value = useMemo<ColorModeContextValue>(
    () => ({ preference, resolvedMode, setPreference }),
    [preference, resolvedMode, setPreference],
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = resolvedMode;
      document.documentElement.style.colorScheme = resolvedMode;
    }
  }, [resolvedMode]);

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
