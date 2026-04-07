import React from 'react';
import { Chip } from '@mui/material';

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    RUNNABLE: { bg: '#e8f5e9', text: '#2e7d32' },
    BLOCKED: { bg: '#ffebee', text: '#c62828' },
    WAITING: { bg: '#fff3e0', text: '#e65100' },
    TIMED_WAITING: { bg: '#fff8e1', text: '#f57f17' },
    NEW: { bg: '#e3f2fd', text: '#1565c0' },
    TERMINATED: { bg: '#f5f5f5', text: '#616161' },
};

const ThreadStateChip: React.FC<{ state: string }> = ({ state }) => {
    const c = COLOR_MAP[state] ?? { bg: '#f5f5f5', text: '#616161' };
    return (
        <Chip
            label={state}
            size="small"
            sx={{
                backgroundColor: c.bg,
                color: c.text,
                fontWeight: 700,
                fontSize: '0.65rem',
                height: 22,
                borderRadius: 1,
                letterSpacing: '0.04em',
                flexShrink: 0,
            }}
        />
    );
};

export default ThreadStateChip;
