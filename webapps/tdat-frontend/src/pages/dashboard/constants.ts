import type { Theme } from '@mui/material/styles';

export const STATE_ORDER = ['RUNNABLE', 'WAITING', 'TIMED_WAITING', 'BLOCKED', 'TERMINATED', 'N/A'];

// Returns mode-aware state colors for charts and dots.
export function stateColors(theme: Theme): Record<string, string> {
    const s = theme.palette.state;
    return {
        RUNNABLE: s.runnable.main,
        WAITING: s.waiting.main,
        TIMED_WAITING: s.timedWaiting.main,
        BLOCKED: s.blocked.main,
        TERMINATED: s.terminated.main,
        'N/A': s.na.main,
    };
}

// Shared table header cell style (mode-aware). Call with the theme from useTheme().
export function tableHeadCellSx(theme: Theme) {
    return {
        fontWeight: 700,
        fontSize: '0.71rem',
        color: theme.palette.text.secondary,
        letterSpacing: '0.05em',
        bgcolor: theme.palette.surface.inset,
        borderBottom: `1px solid ${theme.palette.surface.border}`,
    } as const;
}
