import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export type ThemeMode = 'light' | 'dark';

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
      translucent: isDark ? 'rgba(23,34,58,0.75)' : 'rgba(255,255,255,0.8)',
      muted: isDark ? 'rgba(13,13,13,0.55)' : 'rgba(242,242,242,0.6)',
      inset: isDark ? '#0D0D0D' : '#F2F2F2',
      insetTranslucent: isDark ? 'rgba(13,13,13,0.7)' : 'rgba(242,242,242,0.7)',
      border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      borderStrong: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
      headerBg: isDark ? 'rgba(13,13,13,0.7)' : 'rgba(255,255,255,0.65)',
      sidebarBg: isDark ? 'rgba(13,13,13,0.6)' : 'rgba(255,255,255,0.55)',
      footerBg: isDark ? 'rgba(13,13,13,0.55)' : 'rgba(255,255,255,0.5)',
      pageGradient: isDark
        ? `radial-gradient(ellipse at 18% 8%, rgba(255,103,0,0.18) 0%, transparent 55%),
           radial-gradient(ellipse at 72% 55%, rgba(92,209,255,0.16) 0%, transparent 55%),
           #0D0D0D`
        : `radial-gradient(ellipse at 18% 8%, rgba(183,228,252,0.22) 0%, transparent 55%),
           radial-gradient(ellipse at 72% 55%, rgba(255,103,0,0.18) 0%, transparent 55%),
           #F2F2F2`,
      hoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      codeBg: isDark ? '#000000' : '#0D0D0D',
      codeText: '#D9D9D9',
      codeBorder: isDark ? '#262626' : '#565656',
    },
    brand: {
      main: '#FF6700',
      contrast: '#FFFFFF',
      hover: '#F14E23',
      softBg: isDark ? 'rgba(255,103,0,0.15)' : 'rgba(255,103,0,0.12)',
      softText: isDark ? '#FF6700' : '#F14E23',
      softBorder: isDark ? 'rgba(255,103,0,0.35)' : 'rgba(241,78,35,0.5)',
      shadow: isDark ? '0 4px 14px rgba(255,103,0,0.35)' : '0 4px 14px rgba(241,78,35,0.3)',
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
        main: '#F14E23',
        text: '#F14E23',
        bg: isDark ? 'rgba(241,78,35,0.15)' : 'rgba(241,78,35,0.12)',
        border: '#F14E23',
      },
      high: {
        main: '#FF6700',
        text: isDark ? '#FF6700' : '#F14E23',
        bg: isDark ? 'rgba(255,103,0,0.15)' : 'rgba(255,103,0,0.12)',
        border: '#FF6700',
      },
      medium: {
        main: '#FF6700',
        text: isDark ? '#FF6700' : '#F14E23',
        bg: isDark ? 'rgba(255,103,0,0.10)' : 'rgba(255,103,0,0.08)',
        border: '#FF6700',
      },
      info: {
        main: '#5CD1FF',
        text: isDark ? '#5CD1FF' : '#17223A',
        bg: isDark ? 'rgba(92,209,255,0.15)' : 'rgba(183,228,252,0.40)',
        border: isDark ? '#5CD1FF' : '#B7E4FC',
      },
      recommendation: {
        main: '#FF6700',
        text: isDark ? '#FF6700' : '#F14E23',
        bg: isDark ? 'rgba(255,103,0,0.15)' : 'rgba(255,103,0,0.10)',
        border: isDark ? '#FF6700' : '#FF6700',
      },
      summary: {
        main: '#5CD1FF',
        text: isDark ? '#B7E4FC' : '#17223A',
        bg: isDark ? 'rgba(92,209,255,0.15)' : 'rgba(183,228,252,0.40)',
        border: isDark ? '#5CD1FF' : '#B7E4FC',
      },
      success: {
        main: '#B7E4FC',
        text: isDark ? '#B7E4FC' : '#17223A',
        bg: isDark ? 'rgba(183,228,252,0.15)' : 'rgba(183,228,252,0.40)',
        border: '#B7E4FC',
      },
    },
    accent: {
      link: '#5CD1FF',
      linkHover: '#B7E4FC',
      owner: '#FF6700',
      ownerBg: isDark ? 'rgba(255,103,0,0.20)' : 'rgba(255,103,0,0.10)',
      ownerBgHover: isDark ? 'rgba(255,103,0,0.30)' : 'rgba(255,103,0,0.18)',
      victim: '#F14E23',
      victimBg: isDark ? 'rgba(241,78,35,0.15)' : 'rgba(241,78,35,0.10)',
      victimBgHover: isDark ? 'rgba(241,78,35,0.25)' : 'rgba(241,78,35,0.18)',
      deadlock: '#F14E23',
      deadlockBg: isDark ? 'rgba(241,78,35,0.25)' : 'rgba(241,78,35,0.20)',
      monitor: '#FF6700',
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
        main: isDark ? '#FF6700' : '#F14E23',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#B7E4FC' : '#5CD1FF',
        contrastText: isDark ? '#0D0D0D' : '#17223A',
      },
      background: {
        default: isDark ? '#0D0D0D' : '#F2F2F2',
        paper: isDark ? '#17223A' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#FFFFFF' : '#17223A',
        secondary: isDark ? '#D9D9D9' : '#565656',
        disabled: isDark ? '#565656' : '#D9D9D9',
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
