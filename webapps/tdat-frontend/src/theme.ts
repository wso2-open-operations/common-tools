import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export type ThemeMode = 'light' | 'dark';
export type ColorModePreference = 'light' | 'dark' | 'system';

// ─── Custom palette token augmentation ───────────────────────────────────────

type StateTokens = { main: string; text: string; bg: string; border: string };
type SeverityTokens = { main: string; text: string; bg: string; border: string };

declare module '@mui/material/styles' {
  interface Palette {
    surface: {
      translucent: string;
      muted: string;
      inset: string;
      insetTranslucent: string;
      border: string;
      borderStrong: string;
      headerBg: string;
      sidebarBg: string;
      footerBg: string;
      pageGradient: string;
      hoverBg: string;
      codeBg: string;
      codeText: string;
      codeBorder: string;
    };
    brand: {
      main: string;
      contrast: string;
      hover: string;
      softBg: string;
      softText: string;
      softBorder: string;
      shadow: string;
    };
    state: {
      runnable: StateTokens;
      blocked: StateTokens;
      waiting: StateTokens;
      timedWaiting: StateTokens;
      terminated: StateTokens;
      na: StateTokens;
      new: StateTokens;
    };
    severity: {
      critical: SeverityTokens;
      high: SeverityTokens;
      medium: SeverityTokens;
      info: SeverityTokens;
      recommendation: SeverityTokens;
      summary: SeverityTokens;
      success: SeverityTokens;
    };
    accent: {
      link: string;
      linkHover: string;
      owner: string;
      ownerBg: string;
      ownerBgHover: string;
      victim: string;
      victimBg: string;
      victimBgHover: string;
      deadlock: string;
      deadlockBg: string;
      monitor: string;
    };
  }

  interface PaletteOptions {
    surface?: Palette['surface'];
    brand?: Palette['brand'];
    state?: Palette['state'];
    severity?: Palette['severity'];
    accent?: Palette['accent'];
  }
}

// ─── Token values per mode ───────────────────────────────────────────────────

const tokens = (mode: ThemeMode) => {
  const isDark = mode === 'dark';

  return {
    surface: {
      translucent: isDark ? 'rgba(30,34,42,0.75)' : 'rgba(255,255,255,0.8)',
      muted: isDark ? 'rgba(22,26,32,0.55)' : 'rgba(249,250,251,0.6)',
      inset: isDark ? '#11151c' : '#f9fafb',
      insetTranslucent: isDark ? 'rgba(17,21,28,0.7)' : 'rgba(249,250,251,0.7)',
      border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      borderStrong: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
      headerBg: isDark ? 'rgba(15,18,24,0.7)' : 'rgba(255,255,255,0.65)',
      sidebarBg: isDark ? 'rgba(15,18,24,0.6)' : 'rgba(255,255,255,0.55)',
      footerBg: isDark ? 'rgba(15,18,24,0.55)' : 'rgba(255,255,255,0.5)',
      pageGradient: isDark
        ? `radial-gradient(ellipse at 18% 8%, rgba(255,109,0,0.10) 0%, transparent 55%),
           radial-gradient(ellipse at 72% 55%, rgba(196,181,243,0.08) 0%, transparent 55%),
           #0a0d12`
        : `radial-gradient(ellipse at 18% 8%, rgba(196,181,243,0.22) 0%, transparent 55%),
           radial-gradient(ellipse at 72% 55%, rgba(255,197,150,0.18) 0%, transparent 55%),
           #f5f6fa`,
      hoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      codeBg: isDark ? '#05080d' : '#0d1117',
      codeText: '#c9d1d9',
      codeBorder: isDark ? '#1f242c' : '#30363d',
    },
    brand: {
      main: '#ff6d00',
      contrast: '#ffffff',
      hover: isDark ? '#ff8a33' : '#e65100',
      softBg: isDark ? 'rgba(255,109,0,0.15)' : 'rgba(255,237,213,0.7)',
      softText: isDark ? '#ffb870' : '#ea580c',
      softBorder: isDark ? 'rgba(255,109,0,0.35)' : 'rgba(253,186,116,0.5)',
      shadow: isDark ? '0 4px 14px rgba(255,109,0,0.35)' : '0 4px 14px rgba(255,109,0,0.3)',
    },
    state: {
      runnable: {
        main: isDark ? '#4ade80' : '#43a047',
        text: isDark ? '#86efac' : '#16a34a',
        bg: isDark ? 'rgba(22,163,74,0.18)' : '#f0fdf4',
        border: isDark ? 'rgba(74,222,128,0.4)' : 'rgba(187,247,208,0.7)',
      },
      blocked: {
        main: isDark ? '#f87171' : '#e53935',
        text: isDark ? '#fca5a5' : '#dc2626',
        bg: isDark ? 'rgba(220,38,38,0.18)' : '#fef2f2',
        border: isDark ? 'rgba(248,113,113,0.4)' : 'rgba(252,165,165,0.4)',
      },
      waiting: {
        main: isDark ? '#fb923c' : '#ff9800',
        text: isDark ? '#fdba74' : '#ea580c',
        bg: isDark ? 'rgba(234,88,12,0.18)' : '#fff7ed',
        border: isDark ? 'rgba(253,186,116,0.4)' : 'rgba(253,186,116,0.5)',
      },
      timedWaiting: {
        main: isDark ? '#93c5fd' : '#1976d2',
        text: isDark ? '#fde68a' : '#ca8a04',
        bg: isDark ? 'rgba(202,138,4,0.18)' : '#fefce8',
        border: isDark ? 'rgba(253,224,71,0.35)' : 'rgba(253,224,71,0.5)',
      },
      terminated: {
        main: isDark ? '#9ca3af' : '#9e9e9e',
        text: isDark ? '#9ca3af' : '#6b7280',
        bg: isDark ? 'rgba(107,114,128,0.18)' : '#f3f4f6',
        border: isDark ? 'rgba(156,163,175,0.3)' : 'rgba(0,0,0,0.08)',
      },
      na: {
        main: isDark ? '#9ca3af' : '#bdbdbd',
        text: isDark ? '#9ca3af' : '#6b7280',
        bg: isDark ? 'rgba(107,114,128,0.18)' : '#f3f4f6',
        border: isDark ? 'rgba(156,163,175,0.3)' : 'rgba(0,0,0,0.08)',
      },
      new: {
        main: isDark ? '#93c5fd' : '#2563eb',
        text: isDark ? '#93c5fd' : '#2563eb',
        bg: isDark ? 'rgba(37,99,235,0.18)' : '#eff6ff',
        border: isDark ? 'rgba(147,197,253,0.35)' : 'rgba(147,197,253,0.5)',
      },
    },
    severity: {
      critical: {
        main: isDark ? '#ef5350' : '#c62828',
        text: isDark ? '#fca5a5' : '#c62828',
        bg: isDark ? 'rgba(239,83,80,0.15)' : '#ffebee',
        border: isDark ? '#ef5350' : '#c62828',
      },
      high: {
        main: isDark ? '#fb923c' : '#ef6c00',
        text: isDark ? '#fdba74' : '#ef6c00',
        bg: isDark ? 'rgba(251,146,60,0.15)' : '#fff3e0',
        border: isDark ? '#fb923c' : '#ef6c00',
      },
      medium: {
        main: isDark ? '#fbbf24' : '#f57c00',
        text: isDark ? '#fde68a' : '#f57c00',
        bg: isDark ? 'rgba(251,191,36,0.15)' : '#fff8e1',
        border: isDark ? '#fbbf24' : '#f57c00',
      },
      info: {
        main: isDark ? '#60a5fa' : '#1565c0',
        text: isDark ? '#93c5fd' : '#1565c0',
        bg: isDark ? 'rgba(96,165,250,0.15)' : '#e3f2fd',
        border: isDark ? '#60a5fa' : '#90caf9',
      },
      recommendation: {
        main: isDark ? '#fbbf24' : '#e65100',
        text: isDark ? '#fde68a' : '#e65100',
        bg: isDark ? 'rgba(251,191,36,0.15)' : '#fff8e1',
        border: isDark ? '#fbbf24' : '#ffe082',
      },
      summary: {
        main: isDark ? '#fb7185' : '#c2185b',
        text: isDark ? '#fda4af' : '#880e4f',
        bg: isDark ? 'rgba(251,113,133,0.15)' : '#fce4ec',
        border: isDark ? '#fb7185' : '#ef9a9a',
      },
      success: {
        main: isDark ? '#4ade80' : '#2e7d32',
        text: isDark ? '#86efac' : '#2e7d32',
        bg: isDark ? 'rgba(22,163,74,0.15)' : '#f0fdf4',
        border: isDark ? '#4ade80' : '#bbf7d0',
      },
    },
    accent: {
      link: isDark ? '#60a5fa' : '#1565c0',
      linkHover: isDark ? '#93c5fd' : '#0d47a1',
      owner: isDark ? '#fb923c' : '#ea580c',
      ownerBg: isDark ? 'rgba(234,88,12,0.2)' : '#fff7ed',
      ownerBgHover: isDark ? 'rgba(234,88,12,0.3)' : '#ffedd5',
      victim: isDark ? '#f87171' : '#dc2626',
      victimBg: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2',
      victimBgHover: isDark ? 'rgba(220,38,38,0.25)' : '#fee2e2',
      deadlock: isDark ? '#f87171' : '#dc2626',
      deadlockBg: isDark ? 'rgba(248,113,113,0.25)' : '#fecaca',
      monitor: isDark ? '#fb923c' : '#ea580c',
    },
  };
};

// ─── Theme factory ───────────────────────────────────────────────────────────

export const themeSettings = (mode: ThemeMode) => {
  const t = tokens(mode);
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode: mode as PaletteMode,
      primary: {
        main: isDark ? '#e6edf3' : '#0d1117',
        contrastText: isDark ? '#0d1117' : '#ffffff',
      },
      secondary: {
        main: '#ff6d00',
      },
      background: {
        default: isDark ? '#0a0d12' : '#f5f6fa',
        paper: isDark ? '#151a22' : '#ffffff',
      },
      text: {
        primary: isDark ? '#e6edf3' : '#111827',
        secondary: isDark ? '#9ca3af' : '#6b7280',
        disabled: isDark ? '#6b7280' : '#9ca3af',
      },
      divider: t.surface.border,
      action: {
        hover: t.surface.hoverBg,
        selected: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
        disabled: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(0,0,0,0.26)',
        disabledBackground: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      },
      surface: t.surface,
      brand: t.brand,
      state: t.state,
      severity: t.severity,
      accent: t.accent,
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#0a0d12' : '#f5f6fa',
            color: isDark ? '#e6edf3' : '#111827',
            transition: 'background-color 0.2s ease, color 0.2s ease',
          },
        },
      },
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
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#1f242c' : '#374151',
            color: '#ffffff',
            fontSize: '0.72rem',
            fontWeight: 500,
          },
          arrow: {
            color: isDark ? '#1f242c' : '#374151',
          },
        },
      },
    },
  });
};
