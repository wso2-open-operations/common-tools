// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

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
  } catch (err) {
    console.warn('[TDAT] ColorModeContext: failed to read theme from localStorage, defaulting to light', err);
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
    } catch (err) {
      // Storage might be unavailable (private mode, quota), preference won't persist across sessions.
      console.warn('[TDAT] ColorModeContext: failed to persist theme to localStorage', { value, error: err });
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch (err) {
        console.warn('[TDAT] ColorModeContext: failed to persist theme toggle to localStorage', { next, error: err });
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
