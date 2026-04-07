export const STATE_COLORS: Record<string, string> = {
    RUNNABLE: '#43a047',
    WAITING: '#ff9800',
    TIMED_WAITING: '#1976d2',
    BLOCKED: '#e53935',
    TERMINATED: '#9e9e9e',
    'N/A': '#bdbdbd',
};

export const STATE_ORDER = ['RUNNABLE', 'WAITING', 'TIMED_WAITING', 'BLOCKED', 'TERMINATED', 'N/A'];

// Shared table header cell style used in ThreadActivityCard
export const thSx = {
    fontWeight: 700,
    fontSize: '0.71rem',
    color: '#666',
    letterSpacing: '0.05em',
    bgcolor: '#fafafa',
    borderBottom: '1px solid #E0E0E0',
} as const;
