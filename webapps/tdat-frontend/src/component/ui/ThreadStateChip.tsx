import React from 'react';
import { Chip } from '@mui/material';

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    RUNNABLE: { bg: '#f0fdf4', text: '#16a34a' },
    BLOCKED: { bg: '#fef2f2', text: '#dc2626' },
    WAITING: { bg: '#fff7ed', text: '#ea580c' },
    TIMED_WAITING: { bg: '#fefce8', text: '#ca8a04' },
    NEW: { bg: '#eff6ff', text: '#2563eb' },
    TERMINATED: { bg: '#f3f4f6', text: '#6b7280' },
};

const ThreadStateChip: React.FC<{ state: string }> = ({ state }) => {
    const c = COLOR_MAP[state] ?? { bg: '#f3f4f6', text: '#6b7280' };
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
                borderRadius: 1.5,
                letterSpacing: '0.04em',
                flexShrink: 0,
            }}
        />
    );
};

export default ThreadStateChip;
